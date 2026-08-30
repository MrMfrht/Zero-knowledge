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
 * The `compact:full` proving keys this needs are committed as of 2026-08-30
 * (`packages/contract/src/managed/keys/`, ~3-5 MB per circuit — if you see
 * kilobyte-sized files there, someone has committed a `--skip-zk` build over
 * them and no proof will generate).
 *
 * ⚠️ A full deploy has still not succeeded end-to-end. Four real bugs were
 * found and fixed by running it (see the comments below, each citing what it
 * actually failed with); the open one is the `availableCoins`/`balances`
 * mismatch documented at the DUST registration step.
 */
import { fileURLToPath } from 'node:url';
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
    //
    // `fileURLToPath`, not `.pathname`: on Windows the latter yields
    // "/C:/Users/..." — a leading slash `fs` cannot open. Half this team is
    // on Windows, so this is a real portability fix, not pedantry.
    zkConfigPath: get('--zk-path', fileURLToPath(new URL('../../../contract/src/managed', import.meta.url)))!,
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
  // ⚠️ OPEN: a live run against a genuinely fresh devnet saw
  // `state.unshielded.availableCoins` empty right after `isSynced` went true
  // while `state.unshielded.balances` showed real, nonzero NIGHT.
  //
  // `isSynced` is not the culprit — the facade defines it as all three
  // sub-wallets being strictly complete, unshielded included
  // (wallet-sdk-facade/dist/index.js, `get isSynced()`). The likelier
  // explanation is that the coins are *booked*: UnshieldedWallet exposes
  // THREE collections — `totalCoins`, `availableCoins` and `pendingCoins` —
  // and its own `rotateUtxos` doc says booking "moves the UTxOs from
  // available to pending so a concurrent build call cannot reuse them".
  // A balance counted from total, with every coin sitting in pending, would
  // look exactly like what we saw. The midnight-js skill lists the same
  // shape for DUST: "pendingCoins > 0 && availableCoins === 0 -> locked by a
  // pending/failed transaction", cured by restarting the process.
  //
  // So print all three counts before deciding anything. The previous run
  // logged only `availableCoins.length`, which is why it could not tell
  // "no coins exist" from "every coin is booked".
  const nightSummary = (s: typeof state) =>
    `total=${s.unshielded.totalCoins.length} available=${s.unshielded.availableCoins.length}` +
    ` pending=${s.unshielded.pendingCoins.length}` +
    ` balances=${JSON.stringify(s.unshielded.balances, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`;

  if (state.dust.availableCoins.length === 0) {
    console.log(`No spendable DUST yet. Unshielded coins: ${nightSummary(state)}`);
    if (state.unshielded.totalCoins.length > 0) {
      console.log(
        `  coin meta: ${JSON.stringify(
          state.unshielded.totalCoins.map((c) => c.meta),
          (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
        )}`,
      );
    }
    // `!== true`, not `=== false`: the midnight-js skill's own filter treats a
    // missing/undefined flag as unregistered, and `=== false` would silently
    // skip every coin whose meta omits the field.
    const unregistered = state.unshielded.availableCoins.filter(
      (coin) => coin.meta.registeredForDustGeneration !== true,
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
        state.unshielded.pendingCoins.length > 0
          ? `Every NIGHT UTXO is booked as pending (${state.unshielded.pendingCoins.length}), so none can be ` +
              'registered. That is a stale booking from an earlier failed run — kill this process and ' +
              'rerun; if it persists, `docker compose -f docker/compose.yml down -v` and redeploy.'
          : 'No NIGHT UTXOs at all for this address, yet a balance is reported. Check the seed is the ' +
              'genesis master wallet and that the indexer is caught up with the node.',
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
            `  DUST balance: ${s.dust.balance(new Date())}, spendable DUST coins: ${s.dust.availableCoins.length}` +
              `, NIGHT ${nightSummary(s)}`,
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

  // The deployer's OWN `localSk()` — becomes `employerKey` in the constructor
  // (`employerKey = dappKey(localSk(), deployment)`, per payroll.compact).
  // Deliberately distinct from the wallet's shielded/unshielded keys: this
  // secret only ever identifies the caller inside this contract.
  const deployerSecret = new Uint8Array(Buffer.from(args.seedHex, 'hex')).slice(0, 32);

  // Fresh randomness, every single deployment. This becomes the sealed
  // `deploymentId`, and every identity on this contract is hashed with it, so
  // one worker gets an unrelated key from each employer. Reusing a value across
  // deployments — or hardcoding one — makes the same worker look identical in
  // two employers' ledgers, which is exactly the leak it exists to prevent.
  const deployment = crypto.getRandomValues(new Uint8Array(32));

  console.log(`Deploying with contributionPct=${args.contributionPct}...`);
  try {
    const deployed = await deployContract(providers, {
      compiledContract: compiledPayrollContract,
      args: [args.contributionPct, deployment],
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
