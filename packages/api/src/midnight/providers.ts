/**
 * Builds the six `MidnightProviders` that `midnight-js-contracts`
 * (`deployContract`, `findDeployedContract`, `submitCallTx`) needs, from a
 * connected browser wallet — the "browser / 1AM wallet" pattern in the
 * midnight-js skill (§7), adapted to the generic DApp Connector API rather
 * than 1AM specifically, since that's what `walletConnector.ts` already
 * speaks.
 *
 * ⚠️ HONESTLY FLAGGED GAP, same shape as the one in `payment.ts`: the
 * DApp Connector API's `balanceUnsealedTransaction`/`submitTransaction` work
 * on a `tx: string`, while `midnight-js-types`'s `WalletProvider`/
 * `MidnightProvider` work on `UnboundTransaction`/`FinalizedTransaction`
 * objects (from `@midnight-ntwrk/midnight-js-protocol/ledger`, the same
 * `Transaction` family used elsewhere with `.serialize()` /
 * `.deserialize(sigMarker, proofMarker, bindingMarker, bytes)`). Neither the
 * DApp Connector API's own types nor its docs state whether that `tx` string
 * is hex or base64. `signData`'s `SignDataOptions.encoding` accepts both,
 * which confirms the wallet supports either — it does not tell us which one
 * `makeTransfer`/`balanceUnsealedTransaction`/`submitTransaction` actually
 * use. This file assumes hex (matching every other byte-string convention
 * documented for this SDK — Bech32m addresses aside), but that assumption
 * is UNVERIFIED against a real wallet extension. Test against Lace or 1AM
 * before relying on this in a demo; if transactions fail to balance or
 * submit, this encoding guess is the first thing to check.
 */
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type {
  MidnightProvider,
  PrivateStateProvider,
  ProofProvider,
  UnboundTransaction,
  WalletProvider,
  ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type {
  CoinPublicKey,
  EncPublicKey,
  FinalizedTransaction,
  TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { PayrollCircuitId, PayrollPrivateState, PayrollPrivateStateId } from './contract.js';
import { ZK_CONFIG_PATH } from './contract.js';
import { bytesToHex, hexToBytes } from './encoding.js';

// Bare hex, no `0x` prefix: this is the wire format the DApp connector and
// the ledger types use, not the prefixed domain form in `@nightshift/shared`.
const toHex = (bytes: Uint8Array): string => bytesToHex(bytes).slice(2);
const fromHex = (hex: string): Uint8Array => hexToBytes(hex);

/**
 * Bridges the connected wallet's `balanceUnsealedTransaction`/
 * `submitTransaction` into the shape `midnight-js-contracts` expects.
 *
 * `payFees: true` (the DApp Connector default) is intentional — the person's
 * own wallet pays its own DUST, same as every method in this file.
 */
function buildWalletAndMidnightProvider(connectedApi: ConnectedAPI): WalletProvider & MidnightProvider {
  return {
    getCoinPublicKey(): CoinPublicKey {
      throw new Error(
        'getCoinPublicKey is populated asynchronously — see connectPayrollProviders(); ' +
          'this placeholder exists only to satisfy the WalletProvider shape before that resolves.',
      );
    },
    getEncryptionPublicKey(): EncPublicKey {
      throw new Error('getEncryptionPublicKey — see the note on getCoinPublicKey.');
    },
    async balanceTx(tx: UnboundTransaction, _ttl?: Date): Promise<FinalizedTransaction> {
      const { tx: balancedHex } = await connectedApi.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balancedHex)) as FinalizedTransaction;
    },
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      const hex = toHex(tx.serialize());
      await connectedApi.submitTransaction(hex);
      // submitTransaction resolves to void (see payment.ts) — there is no
      // txId the wallet hands back. tx.transactionHash() is what ledger-v8
      // itself warns not to use for watching a specific transaction "due to
      // the ability to merge transactions", but as the identifier for
      // FinalizedCallTxData.public.txId there is nothing better available
      // from this API surface, so it is returned as a best-effort id, not a
      // confirmation guarantee.
      return tx.transactionHash() as unknown as TransactionId;
    },
  };
}

export interface PayrollProviders {
  readonly privateStateProvider: PrivateStateProvider<PayrollPrivateStateId, PayrollPrivateState>;
  readonly publicDataProvider: ReturnType<typeof indexerPublicDataProvider>;
  // Interfaces, not the concrete browser classes. The browser path supplies
  // `FetchZkConfigProvider` + `createProofProvider`; Node tooling supplies
  // `NodeZkConfigProvider` + `httpClientProofProvider`. Both satisfy these,
  // and naming the classes here would have made the real api unrunnable
  // outside a page with a wallet extension — which is why it had no tests.
  readonly zkConfigProvider: ZKConfigProvider<PayrollCircuitId>;
  readonly proofProvider: ProofProvider;
  readonly walletProvider: WalletProvider;
  readonly midnightProvider: MidnightProvider;
}

/**
 * In-memory private state, scoped by contract address — the browser variant
 * from the skill (§10). Nothing here persists across a reload; upgrading to
 * something that does is the open question this task's `SPIKE-PAY.md`
 * sibling — A_docs/06 question 5 — partially answers (see that file).
 */
function createInMemoryPrivateStateProvider<PS>(): PrivateStateProvider<PayrollPrivateStateId, PS> {
  let scope = '';
  const states = new Map<string, PS>();
  const signingKeys = new Map<string, unknown>();
  const key = (id: string) => `${scope}:${id}`;
  return {
    setContractAddress(address: string) {
      scope = address;
    },
    async set(id, state) {
      states.set(key(id), state);
    },
    async get(id) {
      return states.get(key(id)) ?? null;
    },
    async remove(id) {
      states.delete(key(id));
    },
    async clear() {
      states.clear();
    },
    async setSigningKey(address, signingKey) {
      signingKeys.set(address, signingKey);
    },
    async getSigningKey(address) {
      return signingKeys.get(address) ?? null;
    },
    async removeSigningKey(address) {
      signingKeys.delete(address);
    },
    async clearSigningKeys() {
      signingKeys.clear();
    },
  } as PrivateStateProvider<PayrollPrivateStateId, PS>;
}

/**
 * Builds the full provider set for a connected wallet, per the indexer/proof
 * server the wallet itself reports via `getConfiguration()` — honoring "use
 * the wallet's own service preferences" from the DApp Connector API's own
 * doc comment on `getConfiguration`.
 */
export async function connectPayrollProviders(connectedApi: ConnectedAPI): Promise<PayrollProviders> {
  const config = await connectedApi.getConfiguration();
  // ZK assets are served from THIS app's own origin (the employer/worker app
  // hosting this package), not from the wallet or the indexer — the app must
  // ship packages/contract/src/managed/{keys,zkir}/ under ZK_CONFIG_PATH.
  const zkConfigProvider = new FetchZkConfigProvider<PayrollCircuitId>(
    new URL(ZK_CONFIG_PATH, window.location.origin).toString(),
    window.fetch.bind(window),
  );

  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await connectedApi.getShieldedAddresses();

  const walletAndMidnightProvider = buildWalletAndMidnightProvider(connectedApi);
  // getCoinPublicKey/getEncryptionPublicKey must be synchronous per the
  // WalletProvider interface, so resolve them once up front and close over
  // the resolved values rather than the placeholder thrower above.
  //
  // ANOTHER UNVERIFIED ASSUMPTION: getShieldedAddresses() returns these in
  // Bech32m (its own doc comment says so explicitly); CoinPublicKey/
  // EncPublicKey elsewhere in this SDK family (e.g. the headless WalletFacade
  // path in transactions.ts) are raw hex. If midnight-js-contracts rejects
  // these as malformed, decoding Bech32m to the raw key first — see
  // `@midnight-ntwrk/wallet-sdk-address-format` — is the fix.
  const resolvedWalletProvider: WalletProvider & MidnightProvider = {
    ...walletAndMidnightProvider,
    getCoinPublicKey: () => shieldedCoinPublicKey as unknown as CoinPublicKey,
    getEncryptionPublicKey: () => shieldedEncryptionPublicKey as unknown as EncPublicKey,
  };

  const proofProvider = await resolveProofProvider(connectedApi, config, zkConfigProvider);

  return {
    privateStateProvider: createInMemoryPrivateStateProvider<PayrollPrivateState>(),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    zkConfigProvider,
    proofProvider,
    walletProvider: resolvedWalletProvider,
    midnightProvider: resolvedWalletProvider,
  };
}

/**
 * Get something that can produce proofs, from whichever mechanism this wallet
 * actually implements.
 *
 * There are two, and which one you get depends on the wallet's age rather
 * than on anything the DApp chooses:
 *
 *   `getProvingProvider` -- the wallet proves on the DApp's behalf. Added in
 *   dapp-connector-api 4.x, and what this file originally assumed.
 *
 *   `getConfiguration().proverServerUri` -- the wallet only says WHERE its
 *   proof server is, and the DApp proves against it directly. Marked
 *   deprecated in 4.0.1, but it is what shipped wallets still offer.
 *
 * Lace Midnight Preview 2.36 has only the second. Calling the first gives
 * "connectedApi.getProvingProvider is not a function", which reads like our
 * bug and is a version mismatch -- so this tries the new path, falls back to
 * the old one, and says plainly when neither exists.
 *
 * The fallback does not weaken anything. That prover URI points at the
 * user's own proof server (`Local (http://localhost:6300)` in Lace's
 * settings, the same container in docker/compose.yml). Proving still happens
 * on the user's machine, which is the whole trust boundary this product
 * rests on -- see CLAUDE.md. If a wallet ever reported a REMOTE prover here,
 * accepting it would hand witness values to a third party, so that case is
 * refused rather than trusted.
 */
async function resolveProofProvider(
  connectedApi: ConnectedAPI,
  config: Awaited<ReturnType<ConnectedAPI['getConfiguration']>>,
  zkConfigProvider: ZKConfigProvider<PayrollCircuitId>,
): Promise<ProofProvider> {
  if (typeof connectedApi.getProvingProvider === 'function') {
    return createProofProvider(await connectedApi.getProvingProvider(zkConfigProvider));
  }

  const proverServerUri = config.proverServerUri;
  if (!proverServerUri) {
    throw new Error(
      'This wallet offers no way to produce proofs: it has neither getProvingProvider ' +
        '(dapp-connector-api 4.x) nor a proverServerUri in its configuration. Point the ' +
        "wallet at a local proof server in its settings, or update it.",
    );
  }

  assertLocalProver(proverServerUri);
  return httpClientProofProvider(proverServerUri, zkConfigProvider);
}

/**
 * A proof server sees witness values -- salaries, salts, secret keys -- in
 * the clear. That is unavoidable: proving needs the secret. What IS avoidable
 * is sending them somewhere other than this machine, so a non-local prover is
 * refused rather than silently used.
 */
function assertLocalProver(uri: string): void {
  const host = new URL(uri).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '[::1]') {
    throw new Error(
      `Refusing to prove against "${uri}". A proof server sees your salary, your salt and ` +
        'your secret key in the clear, so it must run on your own machine. Set the wallet ' +
        "back to its local proof server (Lace: Settings -> Midnight -> Local).",
    );
  }
}
