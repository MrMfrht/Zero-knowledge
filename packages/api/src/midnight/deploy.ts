#!/usr/bin/env node
/**
 * One command that deploys the payroll contract to a network and prints the
 * contract address — item 2 on `tasks/02-integration-STATUS.md`'s list.
 *
 *   npx tsx src/midnight/deploy.ts --contribution-pct 25 --seed <hex>
 *
 * This is a Node-side, headless-wallet tool, not part of the browser apps —
 * CLAUDE.md's "the browser is the trust boundary" rule is about C/D/E never
 * importing `@midnight-ntwrk/*` themselves; a deploy script run once by
 * whoever stands the contract up is the same category of tool as SPIKE-PAY,
 * not a served page. It follows the exact `WalletFacade` construction
 * verified working in SPIKE-PAY (`~/nightshift/midnight-local-dev/src/wallet.ts`)
 * and the Node `WalletProvider`/`MidnightProvider` bridge from the midnight-js
 * skill §8, "Failed to clone intent" workaround included since that bug is
 * confirmed real against this exact SDK generation.
 *
 * ⚠️ Not yet run end-to-end: it needs `compact:full` proving keys (the
 * committed build is `--skip-zk` — see contract.ts), which the contract
 * README says land before integration. Everything here type-checks against
 * the verified provider/contract shapes in `contract.ts` and `providers.ts`;
 * running it for real is the next step once those keys exist.
 */
import { WebSocket } from 'ws';
// Must happen before any wallet-sdk import triggers a GraphQL subscription —
// Node has no global WebSocket, but wallet sync needs one (skill §5).
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

import * as Rx from 'rxjs';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { Transaction as ProtocolTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { UnboundTransaction, WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
// The wallet family (`wallet-sdk`/`testkit-js`) and `midnight-js-contracts`
// resolve two nominally distinct copies of `ledger-v8` (confirmed by
// `npm run typecheck`: top-level 8.1.1 vs 8.1.0 nested under
// `midnight-js-protocol`). `ZswapSecretKeys`/`DustSecretKey`/`Intent` here
// are deliberately the WALLET family's, because they cross into
// `wallet.start`/`wallet.balanceUnboundTransaction` — mixing in the
// protocol-family versions of these three is what caused the errors this
// comment replaces. Only the transaction object itself is round-tripped
// between families, via `.serialize()`/`.deserialize(...)` below.
import { DustSecretKey, Intent, LedgerParameters, Transaction as WalletTransaction, ZswapSecretKeys } from '@midnight-ntwrk/ledger-v8';
import type { Signature } from '@midnight-ntwrk/ledger-v8';
import { FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import {
  PAYROLL_PRIVATE_STATE_ID,
  compiledPayrollContract,
  createPayrollPrivateState,
} from './contract.js';
import type { NetworkId } from './network.js';
import { INDEXER_ENDPOINTS } from './network.js';

interface DeployArgs {
  contributionPct: bigint;
  seedHex: string;
  networkId: NetworkId;
  indexerUri: string;
  indexerWsUri: string;
  nodeUri: string;
  nodeWsUri: string;
  proofServerUri: string;
  zkConfigPath: string;
}

function parseArgs(argv: string[]): DeployArgs {
  const get = (flag: string, fallback?: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  const networkId = (get('--network', 'undeployed') as NetworkId) ?? 'undeployed';
  const endpoints = INDEXER_ENDPOINTS[networkId];
  return {
    contributionPct: BigInt(get('--contribution-pct', '25')!),
    seedHex: get('--seed', '0000000000000000000000000000000000000000000000000000000000000001')!,
    networkId,
    indexerUri: get('--indexer', endpoints.http)!,
    indexerWsUri: get('--indexer-ws', endpoints.ws)!,
    nodeUri: get('--node', 'http://127.0.0.1:9944')!,
    nodeWsUri: get('--node-ws', 'ws://127.0.0.1:9944')!,
    proofServerUri: get('--proof-server', 'http://127.0.0.1:6300')!,
    // The base path must directly contain keys/ and zkir/ (siblings of
    // contract/, compiler/) — confirmed against
    // node_modules/@midnight-ntwrk/midnight-js-node-zk-config-provider's own
    // test fixtures, after a first attempt pointed one level too deep, into
    // managed/contract/, and failed with "Failed to read verifier key".
    zkConfigPath: get('--zk-path', new URL('../../../contract/src/managed', import.meta.url).pathname)!,
  };
}

/**
 * The documented workaround for the wallet SDK's `signRecipe` bug (see
 * `.agents/skills/midnight-js/SKILL.md` §8): a proven `UnboundTransaction`'s
 * intents carry `'proof'` data, but `signRecipe` hardcodes the `'pre-proof'`
 * marker when re-serializing them, which fails with "Failed to clone intent".
 * Signing manually with the correct marker per transaction half sidesteps it.
 */
function signTransactionIntents(
  tx: { intents?: Map<number, unknown> },
  signFn: (payload: Uint8Array) => Signature,
  proofMarker: 'proof' | 'pre-proof',
): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment) as {
      serialize(): Uint8Array;
      signatureData(segment: number): Uint8Array;
      fallibleUnshieldedOffer?: { inputs: unknown[]; signatures: { at(i: number): Signature | undefined }; addSignatures(sigs: Signature[]): unknown };
      guaranteedUnshieldedOffer?: { inputs: unknown[]; signatures: { at(i: number): Signature | undefined }; addSignatures(sigs: Signature[]): unknown };
    };
    if (!intent) continue;
    const cloned = Intent.deserialize('signature', proofMarker, 'pre-binding', intent.serialize()) as typeof intent;
    const signature = signFn(cloned.signatureData(segment));
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map((_, i) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs) as typeof cloned.fallibleUnshieldedOffer;
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map((_, i) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs) as typeof cloned.guaranteedUnshieldedOffer;
    }
    tx.intents.set(segment, cloned);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  setNetworkId(args.networkId);

  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(Buffer.from(args.seedHex, 'hex'));
  const dustSecretKey = DustSecretKey.fromSeed(Buffer.from(args.seedHex, 'hex'));

  // EnvironmentConfiguration's exact required shape (confirmed against
  // node_modules/@midnight-ntwrk/testkit-js/dist/test-environment/
  // environment-configuration.d.ts, not guessed — the first attempt here
  // passed only indexer/indexerWS/node/proofServer and failed with
  // "Invalid URL: undefined" because walletNetworkId, networkId and nodeWS
  // are also required, not optional).
  const { wallet, seeds, keystore } = await FluentWalletBuilder.forEnvironment({
    walletNetworkId: args.networkId,
    networkId: args.networkId,
    indexer: args.indexerUri,
    indexerWS: args.indexerWsUri,
    node: args.nodeUri,
    nodeWS: args.nodeWsUri,
    proofServer: args.proofServerUri,
    faucet: undefined,
  })
    // Without this, FluentWalletBuilder defaults additionalFeeOverhead to 0,
    // which fails "could not balance dust" on a real deploy transaction even
    // against a wallet with an enormous DUST balance — this parameter tunes
    // the fee-estimation margin, not how much DUST is available. Values match
    // the verified-working ~/nightshift/midnight-local-dev/src/wallet.ts.
    .withDustOptions({
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    })
    .withSeed(args.seedHex)
    .buildWithoutStarting();
  void seeds;
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  console.log('Waiting for wallet to sync...');
  let state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  console.log(`Deployer unshielded address: ${keystore.getBech32Address().asString()}`);

  // DUST accrues from NIGHT only after the NIGHT UTXO is explicitly
  // registered for generation (midnight-js skill §6) — this is a real,
  // required bootstrapping step, not a fee-parameter tuning issue. A first
  // attempt at this script skipped it entirely and failed with "could not
  // balance dust" even on a wallet holding real NIGHT. Pattern verified
  // working against this exact devnet in
  // `~/nightshift/midnight-local-dev/src/wallet.ts` (`registerNightForDust`).
  //
  // ⚠️ UNRESOLVED as of this writing: a live run against a genuinely fresh
  // local devnet (confirmed via `docker logs midnight-node` that blocks were
  // being produced continuously, ruling out a stalled chain) still left
  // `state.unshielded.availableCoins` reporting zero entries immediately
  // after `isSynced` went true, despite `state.unshielded.balances` showing
  // a real, nonzero NIGHT balance for the deployer address. That mismatch —
  // a nonzero balance with no enumerable coins to register — was not
  // resolved before time ran out on this investigation; the next step is
  // logging `state.unshielded.availableCoins` itself (not just its length)
  // right after sync to see whether coins appear a few seconds later, or
  // whether balances and availableCoins are populated by genuinely separate
  // sync phases that this script isn't waiting for correctly.
  if (state.dust.availableCoins.length === 0) {
    console.log(
      `No spendable DUST yet. Unshielded coins visible: ${state.unshielded.availableCoins.length}` +
        ` (balance: ${JSON.stringify(state.unshielded.balances, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))})`,
    );
    const unregistered = state.unshielded.availableCoins.filter(
      (coin) => coin.meta.registeredForDustGeneration === false,
    );
    if (unregistered.length > 0) {
      console.log(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST generation...`);
      const recipe = await wallet.registerNightUtxosForDustGeneration(
        unregistered,
        keystore.getPublicKey(),
        (payload) => keystore.signData(payload),
      );
      const finalized = await wallet.finalizeRecipe(recipe);
      const regTxId = await wallet.submitTransaction(finalized);
      console.log(`DUST registration submitted: ${regTxId}`);
    } else if (state.unshielded.availableCoins.length === 0) {
      console.log(
        'No unshielded coins are enumerable yet even though a balance is visible — ' +
          'see the UNRESOLVED note above. Waiting in case this resolves with more sync time.',
      );
    } else {
      console.log('All visible NIGHT UTXOs are already registered for DUST generation.');
    }
    console.log('Waiting for a spendable DUST coin (this can take a few minutes)...');
    state = await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.tap((s) =>
          console.log(
            `  DUST balance: ${s.dust.balance(new Date())}, spendable coins: ${s.dust.availableCoins.length}, unshielded coins: ${s.unshielded.availableCoins.length}`,
          ),
        ),
        Rx.filter((s) => s.dust.availableCoins.length >= 1),
        Rx.timeout({
          each: 180_000,
          with: () => Rx.throwError(() => new Error('No spendable DUST coin appeared within 180s')),
        }),
      ),
    );
  }
  console.log(`DUST ready: balance=${state.dust.balance(new Date())}, spendable coins=${state.dust.availableCoins.length}`);

  // `midnight-js-contracts` and `wallet-sdk`/`testkit-js` resolve two
  // structurally-identical but nominally distinct copies of `ledger-v8`
  // (confirmed by `npm run typecheck`: 8.1.1 top-level vs 8.1.0 nested under
  // `@midnight-ntwrk/midnight-js-protocol`). Neither `Transaction` class
  // accepts the other's instances directly. Round-tripping through
  // `.serialize()`/`.deserialize(...)` — the same marker convention as the
  // "Failed to clone intent" workaround below — crosses that boundary using
  // only the wire format both share, rather than fighting the type system.
  // UNVERIFIED end to end: no live devnet run has exercised this path yet.
  const walletAndMidnightProvider: WalletProvider & MidnightProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: UnboundTransaction, ttl?: Date) {
      const walletSideTx = WalletTransaction.deserialize(
        'signature',
        'proof',
        'pre-binding',
        (tx as unknown as { serialize(): Uint8Array }).serialize(),
      );
      const recipe = await wallet.balanceUnboundTransaction(
        walletSideTx as never,
        { shieldedSecretKeys, dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => keystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction as never, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction as never, signFn, 'pre-proof');
      }
      const finalized = await wallet.finalizeRecipe(recipe);
      return ProtocolTransaction.deserialize(
        'signature',
        'proof',
        'binding',
        (finalized as unknown as { serialize(): Uint8Array }).serialize(),
      ) as never;
    },
    async submitTx(tx) {
      const walletSideTx = WalletTransaction.deserialize(
        'signature',
        'proof',
        'binding',
        (tx as unknown as { serialize(): Uint8Array }).serialize(),
      );
      return wallet.submitTransaction(walletSideTx as never) as never;
    },
  };

  const zkConfigProvider = new NodeZkConfigProvider<string>(args.zkConfigPath);

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'payroll-private-state',
      accountId: 'nightshift-deploy',
      // Deploy-time-only local cache, not the salt/rate storage the README
      // warns about — a fixed password is acceptable for this CLI tool
      // (16+ chars per the README's private-state note); rotate if this
      // script is ever used against real funds instead of a local devnet.
      privateStoragePasswordProvider: () => 'nightshift-deploy-tool-local-cache',
    }),
    publicDataProvider: indexerPublicDataProvider(args.indexerUri, args.indexerWsUri),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(args.proofServerUri, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };

  // The deployer's OWN `localSk()` — becomes `employerKey` in the
  // constructor (`employerKey = dappKey(localSk())`, per payroll.compact).
  // Deliberately distinct from the wallet's shielded/unshielded keys: this
  // secret only ever identifies the caller inside this contract.
  const deployerSecret = new Uint8Array(Buffer.from(args.seedHex, 'hex')).slice(0, 32);

  console.log(`Deploying with contributionPct=${args.contributionPct}...`);
  try {
    const deployed = await deployContract(providers, {
      compiledContract: compiledPayrollContract,
      args: [args.contributionPct],
      privateStateId: PAYROLL_PRIVATE_STATE_ID,
      initialPrivateState: createPayrollPrivateState(deployerSecret),
    } as never);

    console.log('Deployed. Contract address:');
    console.log(deployed.deployTxData.public.contractAddress);
  } finally {
    // Without this in a `finally`, a failed deploy leaves the wallet's
    // WebSocket subscriptions open and the process never exits on its own —
    // confirmed live: a failed run sat at 100% CPU for minutes after
    // printing its error, needing a manual `pkill` to end it.
    await wallet.stop();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Belt-and-braces: even with wallet.stop() above, some transport handles
    // (indexer WS subscriptions in particular) have been observed to keep
    // the event loop alive. Same live-run evidence as the comment above.
    process.exit(process.exitCode ?? 0);
  });
