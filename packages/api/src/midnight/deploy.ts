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
 * ✅ Verified end-to-end against the local devnet on 2026-08-30: deployed to
 * `309b78f7…6ae77080`, and `inspect.ts` read `contributionRate 25%` and a
 * populated `deploymentId` back off the indexer. Every bug fixed along the
 * way is commented below next to the line that caused it, with the error it
 * actually produced — none of them were found by reading.
 *
 * Before running this, `docker compose -f docker/compose.yml up -d` and wait
 * for all three services to report healthy.
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
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
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
 * The password that encrypts the deployer's private state on disk.
 *
 * `levelPrivateStateProvider` encrypts its LevelDB store at rest and enforces
 * a real strength policy on the password: 16+ characters, at least 3 of
 * {uppercase, lowercase, digit, special}, no run of 4+ identical or
 * consecutive characters. Those limits are constants in
 * `@midnight-ntwrk/midnight-js-utils` (`MIN_PASSWORD_LENGTH`,
 * `MIN_CHARACTER_CLASSES`, `MAX_CONSECUTIVE_REPEATED`,
 * `MIN_SEQUENTIAL_LENGTH`), and a violation aborts the deploy with
 * `PasswordValidationError` at the moment it first writes private state —
 * i.e. after proving, which is a slow way to learn you had a typo.
 *
 * The fallback is public knowledge, so it is confined to `undeployed`. On any
 * real network this is the thing standing between an attacker with disk
 * access and the deployer's private state, and it has to come from outside
 * the repository.
 */
function privateStorePassword(networkId: NetworkId): string {
  const fromEnv = process.env.NIGHTSHIFT_PRIVATE_STORE_PASSWORD;
  if (fromEnv) return fromEnv;
  if (networkId !== 'undeployed') {
    throw new Error(
      `NIGHTSHIFT_PRIVATE_STORE_PASSWORD must be set when deploying to "${networkId}". ` +
        'It encrypts the deployer private state at rest. The built-in fallback is ' +
        'committed to this repository and is only permitted against a local throwaway devnet.',
    );
  }
  // Local devnet only. This chain is wiped by `docker compose down -v` and
  // holds nothing real, so the password being in plain sight costs nothing.
  return 'Nightshift-Local-Devnet-9';
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
  // Derive from the builder's PER-ROLE seeds, never from the raw seed.
  //
  // A seed phrase is not a key. `withSeed()` runs it through the HD wallet
  // (`selectAccount(0)` + `Roles.Zswap` / `Roles.NightExternal` / `Roles.Dust`,
  // visible in testkit-js/dist/index.mjs) and hands the derived per-role seeds
  // back as `seeds`. Calling `DustSecretKey.fromSeed(rawSeed)` instead yields
  // a valid key for an account nobody funded.
  //
  // The failure is quiet and misleading, which is why this comment is long:
  // the unshielded side keeps working, because it uses `keystore`, which the
  // builder derived correctly. So the deployer address and its 250000000000000
  // NIGHT print exactly right, and only DUST stays stubbornly at 0 — for the
  // full 600s wait, never moving off zero, because the genesis NIGHT generates
  // DUST to the real Dust-role key while we sat watching a different one.
  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
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
      // Registered but generating nothing is its own failure mode, and the
      // registration flag alone cannot tell us which. `estimateDustGeneration`
      // projects what each UTXO should be producing, so a row of zeroes here
      // means the NIGHT is registered to a DUST address we do not hold the key
      // for, while nonzero values mean it is simply still accruing.
      console.log('All visible NIGHT UTXOs are already registered for DUST generation.');
      // A `DustAddress` is a class wrapping one bigint, with no `toString`.
      // Interpolating it prints "[object Object]" and `JSON.stringify` throws
      // outright ("Do not know how to serialize a BigInt") — which would turn
      // a diagnostic into a crash. Bech32m is the format a human can actually
      // compare against another wallet's.
      console.log(`  our DUST address: ${MidnightBech32m.encode(args.networkId, state.dust.address).asString()}`);
      // Do NOT reach for `state.dust.estimateDustGeneration` here to find out
      // what these UTXOs should be producing. It is broken in
      // wallet-sdk-dust-wallet 8.1.x: `fakeGenerationInfo` builds a projection
      // record with `dtime: undefined` and passes it to `ledger.updatedValue`,
      // which wants a u128 and rejects it with
      // "invalid type: unit value, expected u128"
      // (dist/v1/CoinsAndBalances.js). It also takes a plain `Utxo`, not the
      // `UtxoWithMeta` the unshielded wallet hands out, so it does not even
      // typecheck against `totalCoins`. Tried on 2026-08-30; cost half an hour.
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
          // DUST accrues on a chain-time curve, so a freshly-started devnet
          // genuinely needs minutes, not seconds. 180s was short enough to
          // look like a hang when it was only impatience.
          each: 600_000,
          with: () => Rx.throwError(() => new Error('No spendable DUST coin appeared within 600s')),
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
      // Scope the store to THIS deployer, not to a constant. `accountId` is
      // what keeps two wallets sharing one LevelDB from reading each other's
      // private state; the SDK's own doc example passes a wallet address.
      // A shared literal here would silently hand run #2 run #1's state.
      accountId: keystore.getBech32Address().asString(),
      privateStoragePasswordProvider: () => privateStorePassword(args.networkId),
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
