/**
 * A funded, synced Midnight wallet and the provider bridge that lets
 * `midnight-js-contracts` spend from it — with no browser and no wallet
 * extension.
 *
 * This exists because `MidnightPayrollApi.connectWallet()` goes through
 * `@midnight-ntwrk/dapp-connector-api`, which only exists inside a page with
 * a wallet extension installed. That is correct for the product — CLAUDE.md's
 * "the browser is the trust boundary" rule is not negotiable — but it also
 * meant the real api could not be executed anywhere except by hand, in a
 * browser, which is why it shipped with zero tests. Everything here is Node
 * tooling: deploy scripts, integration tests, and the devnet demo. None of it
 * is imported by the three apps.
 *
 * The wallet construction below was verified end to end against the local
 * devnet on 2026-08-30. Each non-obvious line carries the error it fixes,
 * because every one of them was found by running, not by reading.
 */
import { WebSocket } from 'ws';
// Must happen before any wallet-sdk import triggers a GraphQL subscription —
// Node has no global WebSocket, but wallet sync needs one (midnight-js §5).
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

import * as Rx from 'rxjs';
import { Transaction as ProtocolTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { UnboundTransaction, WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
// The wallet family (`wallet-sdk`/`testkit-js`) and `midnight-js-contracts`
// may resolve two nominally distinct copies of `ledger-v8`. `DustSecretKey`,
// `Intent` and `ZswapSecretKeys` here are deliberately the WALLET family's,
// because they cross into `wallet.start`/`wallet.balanceUnboundTransaction`.
// Only the transaction object is round-tripped between families, via
// `.serialize()`/`.deserialize(...)` below.
import {
  DustSecretKey,
  Intent,
  LedgerParameters,
  Transaction as WalletTransaction,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v8';
import type { Signature } from '@midnight-ntwrk/ledger-v8';
import { FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { NetworkId } from './network.js';

/** Every endpoint the wallet needs. Defaults suit `docker/compose.yml`. */
export interface HeadlessWalletOptions {
  readonly networkId: NetworkId;
  readonly seedHex: string;
  readonly indexerUri: string;
  readonly indexerWsUri: string;
  readonly nodeUri: string;
  readonly nodeWsUri: string;
  readonly proofServerUri: string;
  /** How long to wait for DUST to accrue. Default 600s; see `waitForDust`. */
  readonly dustTimeoutMs?: number;
}

export interface HeadlessWallet {
  /** Signs and submits. Pass straight into a `providers` object. */
  readonly walletAndMidnightProvider: WalletProvider & MidnightProvider;
  /** Bech32m unshielded address — the one the faucet/genesis funds. */
  readonly address: string;
  /** Releases the wallet's subscriptions. Always call this in a `finally`. */
  stop(): Promise<void>;
}

/**
 * The documented workaround for the wallet SDK's `signRecipe` bug (midnight-js
 * §8): a proven `UnboundTransaction`'s intents carry `'proof'` data, but
 * `signRecipe` hardcodes the `'pre-proof'` marker when re-serializing them,
 * failing with "Failed to clone intent". Signing manually with the correct
 * marker per transaction half sidesteps it.
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

/**
 * Build the wallet, fund its DUST, and return a provider bridge over it.
 *
 * Blocks until a spendable DUST coin exists, because every contract call
 * needs one and failing later with "could not balance dust" is a much worse
 * error than waiting here.
 */
export async function createHeadlessWallet(options: HeadlessWalletOptions): Promise<HeadlessWallet> {
  // `EnvironmentConfiguration`'s exact required shape, confirmed against
  // testkit-js/dist/test-environment/environment-configuration.d.ts — passing
  // only indexer/indexerWS/node/proofServer fails with "Invalid URL: undefined"
  // because walletNetworkId, networkId and nodeWS are required too.
  const { wallet, seeds, keystore } = await FluentWalletBuilder.forEnvironment({
    walletNetworkId: options.networkId,
    networkId: options.networkId,
    indexer: options.indexerUri,
    indexerWS: options.indexerWsUri,
    node: options.nodeUri,
    nodeWS: options.nodeWsUri,
    proofServer: options.proofServerUri,
    faucet: undefined,
  })
    // Without this the builder defaults `additionalFeeOverhead` to 0, which
    // fails "could not balance dust" on a real transaction even against a
    // wallet holding an enormous DUST balance — the parameter tunes the
    // fee-estimation margin, not how much DUST is available.
    .withDustOptions({
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    })
    .withSeed(options.seedHex)
    .buildWithoutStarting();

  // Derive from the builder's PER-ROLE seeds, never from the raw seed.
  //
  // A seed phrase is not a key. `withSeed()` runs it through the HD wallet
  // (`selectAccount(0)` + `Roles.Zswap`/`NightExternal`/`Dust`, visible in
  // testkit-js/dist/index.mjs) and hands the derived per-role seeds back as
  // `seeds`. `DustSecretKey.fromSeed(rawSeed)` instead yields a perfectly
  // valid key for an account nobody funded.
  //
  // The failure is quiet and misleading, which is why this comment is long:
  // the unshielded side keeps working, because it uses `keystore`, which the
  // builder derived correctly. The address and its NIGHT balance print
  // exactly right and only DUST stays at 0 — forever, because the genesis
  // NIGHT generates DUST to the real Dust-role key, not the one being watched.
  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  let state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const address = keystore.getBech32Address().asString();
  console.log(`Wallet synced: ${address}`);

  if (state.dust.availableCoins.length === 0) {
    await bootstrapDust();
  }
  console.log(`DUST ready: balance=${state.dust.balance(new Date())}, spendable coins=${state.dust.availableCoins.length}`);

  async function bootstrapDust(): Promise<void> {
    // DUST accrues from NIGHT only after the NIGHT UTXO is explicitly
    // registered for generation (midnight-js §6). This is a required
    // bootstrapping step, not fee tuning: skipping it fails with "could not
    // balance dust" even on a wallet holding real NIGHT.
    //
    // `!== true`, not `=== false`: the skill's own filter treats a missing
    // flag as unregistered, and `=== false` would skip every coin whose meta
    // omits the field.
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
      console.log(`DUST registration submitted: ${await wallet.submitTransaction(finalized)}`);
    } else if (state.unshielded.availableCoins.length === 0) {
      // Three collections exist — total, available, pending — and a booked
      // coin sits in pending where nothing can spend it. Printing only
      // `availableCoins.length` cannot tell "no coins" from "all booked".
      console.log(
        state.unshielded.pendingCoins.length > 0
          ? `Every NIGHT UTXO is booked as pending (${state.unshielded.pendingCoins.length}). That is a stale ` +
              'booking from an earlier failed run — kill this process and rerun; if it persists, ' +
              '`docker compose -f docker/compose.yml down -v` and redeploy.'
          : 'No NIGHT UTXOs for this address. Check the seed is the genesis master wallet and that the ' +
              'indexer has caught up with the node.',
      );
    } else {
      console.log('All visible NIGHT UTXOs are already registered for DUST generation.');
      // A `DustAddress` wraps one bigint and has no `toString`, so
      // interpolating prints "[object Object]" and `JSON.stringify` throws on
      // the BigInt. Bech32m is what a human can compare against another wallet.
      console.log(`  our DUST address: ${MidnightBech32m.encode(options.networkId, state.dust.address).asString()}`);
      // Do NOT reach for `state.dust.estimateDustGeneration` to find out what
      // these UTXOs should be producing. It is broken in
      // wallet-sdk-dust-wallet 8.1.x: `fakeGenerationInfo` builds a projection
      // with `dtime: undefined` and hands it to `ledger.updatedValue`, which
      // wants a u128 and rejects it with "invalid type: unit value, expected
      // u128" (dist/v1/CoinsAndBalances.js). It also takes a plain `Utxo`, not
      // the `UtxoWithMeta` the unshielded wallet hands out, so it does not even
      // typecheck. Tried on 2026-08-30; cost half an hour.
    }

    console.log('Waiting for a spendable DUST coin...');
    state = await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.tap((s) => console.log(`  DUST balance: ${s.dust.balance(new Date())}, coins: ${s.dust.availableCoins.length}`)),
        Rx.filter((s) => s.dust.availableCoins.length >= 1),
        Rx.timeout({
          // DUST accrues on a chain-time curve, so a freshly-started devnet
          // genuinely needs minutes. 180s was short enough to look like a hang
          // when it was only impatience.
          each: options.dustTimeoutMs ?? 600_000,
          with: () => Rx.throwError(() => new Error('No spendable DUST coin appeared in time')),
        }),
      ),
    );
  }

  const walletAndMidnightProvider: WalletProvider & MidnightProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: UnboundTransaction, ttl?: Date) {
      // Cross the two-ledger-copy boundary using only the wire format both
      // families share, rather than fighting the type system.
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

  return {
    walletAndMidnightProvider,
    address,
    // Without this the wallet's subscriptions stay open and the process never
    // exits on its own — a failed run sat at 100% CPU for minutes, needing a
    // manual kill.
    stop: () => wallet.stop(),
  };
}
