/**
 * The real `PayrollApi`, wired to the deployed contract.
 *
 * Built against `packages/contract`'s `--skip-zk` build — real bindings, no
 * proving keys yet (see `contract.ts`'s note). Every method below type-checks
 * and threads state exactly the way `smoke.mjs` proves the contract does;
 * generating a real proof still needs the `compact:full` build the contract
 * README says lands before integration, plus a live wallet extension to
 * verify the two encoding assumptions flagged in `providers.ts`.
 *
 * See `packages/api/README.md`'s "For B" section for the method → circuit
 * map this file follows, and `A_docs/07-circuit-map.md` for why each
 * circuit's assertions are trustworthy even though they run on the caller's
 * own machine.
 */
import type {
  Amount,
  EmploymentRecord,
  Offer,
  Period,
  PeriodRecord,
  PeriodStatus,
  WorkerKey,
  WorkerSummary,
} from '@nightshift/shared';
import type {
  OnTransactionStatus,
  PayrollApi,
  WalletStatus,
} from '../PayrollApi.js';
import {
  AlreadyConfirmedError,
  ContributionMismatchError,
  HoursNotApprovedError,
  MissingPrivateStateError,
  OfferMismatchError,
  PaymentMismatchError,
  PayrollError,
  UnknownWorkerError,
} from '../errors.js';
import {
  connectWallet as connectorConnectWallet,
  type FeeCapacity,
  type WalletConnection,
} from './walletConnector.js';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { sendPrivatePayment } from './payment.js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  PAYROLL_PRIVATE_STATE_ID,
  compiledPayrollContract,
  createPayrollPrivateState,
  ledger,
  pureCircuits,
  type Ledger,
  type PayrollContract,
} from './contract.js';
import { connectPayrollProviders, type PayrollProviders } from './providers.js';
import { getOrCreateLocalSecret } from './localSecret.js';
import { rememberOffer } from './offerVault.js';
import { bytesToHex, hexToBytes } from './encoding.js';
import { periodToUint32, uint32ToPeriod } from './periods.js';
import { periodKey } from './periodKey.js';
import { INDEXER_ENDPOINTS, type NetworkId } from './network.js';

/**
 * Thrown by `getMyOffer` when the chain shows a sealed offer for this key
 * that this device cannot open — because, correctly, nothing ever puts the
 * rate and salt anywhere this api could read them from. See the doc comment
 * on `getMyOffer` below. NOT a `PayrollError` subclass: none of the existing
 * ones describe this, and inventing a meaning for one of them would be worse
 * than a distinct, honestly-named error.
 */
export class OfferNotYetReceivedError extends Error {
  constructor(workerKey: WorkerKey) {
    super(
      `An offer is sealed on-chain for ${workerKey}, but this device does not have the rate ` +
        'and salt needed to show it — those never travel through the api or the chain. ' +
        "This is exactly the gap in PayrollApi's design: nothing in the interface lets a " +
        "worker's device receive an offer's rate+salt before acceptOffer(). Report it per " +
        'the rulebook rather than working around it.',
    );
    this.name = 'OfferNotYetReceivedError';
  }
}

export interface MidnightPayrollApiOptions {
  readonly contractAddress: string;
  readonly networkId: NetworkId;
  /**
   * Where this device's 32-byte secret lives. Defaults to the browser's
   * `localStorage`, which is the only correct answer for the apps.
   *
   * Node tooling and tests must pass their own, because `window` does not
   * exist there — without this the constructor throws before any method runs.
   * Whatever is passed holds the one secret the entire product depends on
   * never leaving the device, so it must not be anything that persists
   * somewhere shared.
   */
  readonly storage?: Storage;
  /**
   * The range of periods `getEmploymentRecord` will look for.
   *
   * Period entries are filed under a hash, so they cannot be listed — only
   * guessed at and probed for (see `readableWorkerPeriods`). That makes a
   * bound unavoidable, and an unavoidable bound is worth stating rather than
   * burying: **a period outside this window exists on chain and will not be
   * reported.** The default is the ten years ending one year from now, which
   * covers any employment this contract can plausibly hold and costs about a
   * hundred and thirty in-memory hashes per read.
   */
  readonly periodScanWindow?: { readonly from: Period; readonly to: Period };
}

/** Ten years back, one year forward, as month indices. */
function defaultPeriodScanWindow(now: Date): { firstPeriod: bigint; lastPeriod: bigint } {
  const thisMonth = BigInt(now.getUTCFullYear() * 12 + now.getUTCMonth());
  return { firstPeriod: thisMonth - 120n, lastPeriod: thisMonth + 12n };
}

export class MidnightPayrollApi implements PayrollApi {
  private readonly contractAddress: string;
  private readonly networkId: NetworkId;
  private readonly secret: Uint8Array;
  /** Kept so the offer vault writes where the device secret already lives. */
  private readonly storage: Storage;
  private readonly periodScanWindow: { firstPeriod: bigint; lastPeriod: bigint };

  /** Set once `connectWallet()` resolves; every write method requires it. */
  private connection: WalletConnection | undefined;
  private writeProviders: PayrollProviders | undefined;
  private foundContract: FoundContract<PayrollContract> | undefined;
  private cachedDeploymentId: Uint8Array | undefined;

  constructor(options: MidnightPayrollApiOptions) {
    this.contractAddress = options.contractAddress;
    this.networkId = options.networkId;
    setNetworkId(this.networkId);
    this.storage = options.storage ?? window.localStorage;
    this.secret = getOrCreateLocalSecret(this.storage);
    this.periodScanWindow = options.periodScanWindow
      ? {
          firstPeriod: periodToUint32(options.periodScanWindow.from),
          lastPeriod: periodToUint32(options.periodScanWindow.to),
        }
      : defaultPeriodScanWindow(new Date());
  }

  // ---------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------

  async getMyKey(): Promise<WorkerKey> {
    return bytesToHex(pureCircuits.dappKey(this.secret, await this.deploymentId()));
  }

  /**
   * The 32 random bytes fixed when this contract was deployed. Every identity
   * is hashed with them, so one person gets an unrelated key from each employer
   * and two employers cannot join their public ledgers to find a shared worker.
   *
   * Cached because it is sealed on-chain: it cannot change for this address, so
   * re-reading it on every `getMyKey()` would be a network round trip for a
   * constant.
   */
  private async deploymentId(): Promise<Uint8Array> {
    if (!this.cachedDeploymentId) {
      this.cachedDeploymentId = (await this.readLedger()).deploymentId;
    }
    return this.cachedDeploymentId;
  }

  // ---------------------------------------------------------------------
  // Wallet
  // ---------------------------------------------------------------------

  async connectWallet(): Promise<WalletStatus> {
    this.connection = await connectorConnectWallet(this.networkId);
    this.writeProviders = await connectPayrollProviders(this.connection.connectedApi);
    this.foundContract = undefined; // rebuild against the fresh providers
    return this.connection.status;
  }

  /**
   * Attach already-built providers instead of going through a browser wallet.
   *
   * `connectWallet()` reaches for `@midnight-ntwrk/dapp-connector-api`, which
   * only exists inside a page with a wallet extension. That is right for the
   * product and wrong for testing: it meant this class could not be executed
   * anywhere a test runner lives, which is the actual reason it shipped
   * untested. Node tooling builds the same six providers over a headless
   * wallet (`headlessWallet.ts`) and hands them in here.
   *
   * This is NOT a way for an app to bring its own signer. The apps must go
   * through `connectWallet()` so that keys stay in the extension — the trust
   * boundary in CLAUDE.md is the product, not a preference. Anything calling
   * this is Node-side tooling by definition, because assembling a
   * `WalletProvider` at all requires holding a secret key.
   */
  async connectWithProviders(providers: PayrollProviders): Promise<void> {
    this.writeProviders = providers;
    this.foundContract = undefined; // rebuild against the fresh providers
  }

  async disconnectWallet(): Promise<void> {
    this.connection = undefined;
    this.writeProviders = undefined;
    this.foundContract = undefined;
  }

  async getWalletStatus(): Promise<WalletStatus> {
    return this.connection?.status ?? { connected: false };
  }

  async payWorker(params: {
    workerKey: WorkerKey;
    recipientShieldedAddress: string;
    amount: Amount;
    onStatus?: OnTransactionStatus;
  }): Promise<{ txId?: string }> {
    const connectedApi = this.requireConnectedApi();

    // The recipient is the worker's SHIELDED address, never their WorkerKey.
    // The two are unrelated by design and nothing on-chain maps between them,
    // so the caller must supply it — see PayrollApi.payWorker.
    const recipient = params.recipientShieldedAddress?.trim();
    if (!recipient) {
      throw new PayrollError(
        'payWorker needs the worker\'s shielded address. A worker key identifies them ' +
          'inside the contract; it is not somewhere funds can be sent.',
      );
    }

    params.onStatus?.({ stage: 'signing' });
    params.onStatus?.({ stage: 'proving' });
    params.onStatus?.({ stage: 'submitting' });
    await sendPrivatePayment(connectedApi, {
      recipientShieldedAddress: recipient,
      amount: params.amount,
    });

    // Stops at 'pending' deliberately. The browser wallet's submitTransaction
    // resolves to void, so there is no txId to correlate against the chain and
    // nothing here has actually observed the transfer settle. Reporting
    // 'confirmed' would be a claim this code cannot support — see the
    // waitForPaymentConfirmed note in payment.ts.
    params.onStatus?.({ stage: 'pending' });
    return {};
  }

  async getMyShieldedAddress(): Promise<string> {
    const connectedApi = this.requireConnectedApi();
    const { shieldedAddress } = await connectedApi.getShieldedAddresses();
    return shieldedAddress;
  }

  // ---------------------------------------------------------------------
  // Employer
  // ---------------------------------------------------------------------

  async hire(params: {
    workerKey: WorkerKey;
    ratePerPeriod: Amount;
    expectedHours: number;
    onStatus?: OnTransactionStatus;
  }): Promise<Offer> {
    const contract = await this.requireContract();
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const commitment = pureCircuits.sealRate(params.ratePerPeriod, salt);
    const workerBytes = hexToBytes(params.workerKey);

    // Written BEFORE the transaction, deliberately. The salt is 32 random
    // bytes and the chain stores only its commitment, so losing it burns the
    // worker key forever -- `hire` refuses to overwrite an existing
    // `agreedRate` row, and `acceptHire` needs the salt to open it. A
    // remembered offer whose transaction then failed is harmless; the
    // reverse is unrecoverable.
    rememberOffer(
      {
        workerKey: params.workerKey,
        ratePerPeriod: params.ratePerPeriod.toString(),
        salt: bytesToHex(salt),
        commitment: bytesToHex(commitment),
        expectedHours: params.expectedHours,
      },
      this.storage,
    );

    params.onStatus?.({ stage: 'proving' });
    try {
      const result = await contract.callTx.hire(workerBytes, commitment);
      params.onStatus?.({ stage: 'confirmed', txId: result.public.txId });
    } catch (error) {
      params.onStatus?.({ stage: 'failed', error: asPayrollError(error) });
      throw error;
    }

    return {
      workerKey: params.workerKey,
      ratePerPeriod: params.ratePerPeriod,
      salt: bytesToHex(salt),
      commitment: bytesToHex(commitment),
      expectedHours: params.expectedHours,
    };
  }

  async approveHours(params: {
    workerKey: WorkerKey;
    period: Period;
    hours: number;
    onStatus?: OnTransactionStatus;
  }): Promise<void> {
    const contract = await this.requireContract();
    const workerBytes = hexToBytes(params.workerKey);
    const periodNum = periodToUint32(params.period);

    params.onStatus?.({ stage: 'proving' });
    try {
      const result = await contract.callTx.approveHours(workerBytes, periodNum, BigInt(params.hours));
      params.onStatus?.({ stage: 'confirmed', txId: result.public.txId });
    } catch (error) {
      params.onStatus?.({ stage: 'failed', error: asPayrollError(error) });
      throw error;
    }
  }

  async endEmployment(workerKey: WorkerKey): Promise<void> {
    const contract = await this.requireContract();
    await contract.callTx.endEmployment(hexToBytes(workerKey));
  }

  async listWorkers(): Promise<WorkerSummary[]> {
    const state = await this.readLedger();
    const summaries: WorkerSummary[] = [];
    for (const [workerBytes, isActive] of state.active) {
      // Iterating `approvedHours` is useless here — its keys are hashes, and
      // nothing in a `periodKey` says which worker it belongs to. Counting a
      // worker's periods means going the other way: take the worker we
      // already have, hash each candidate period, and see which keys exist.
      // `readableWorkerPeriods` does that, under the documented window.
      const periods = this.readableWorkerPeriods(state, workerBytes);
      summaries.push({
        workerKey: bytesToHex(workerBytes),
        active: isActive,
        confirmedPeriods: periods.filter((p) => p.status === 'confirmed').length,
        unconfirmedPeriods: periods.filter((p) => p.status === 'unconfirmed').length,
      });
    }
    return summaries;
  }

  // ---------------------------------------------------------------------
  // Worker
  // ---------------------------------------------------------------------

  async getMyOffer(): Promise<Offer | null> {
    const myKey = await this.getMyKey();
    const state = await this.readLedger();
    const myBytes = hexToBytes(myKey);
    if (!state.agreedRate.member(myBytes)) return null;
    if (state.active.member(myBytes)) return null; // already accepted
    // The commitment is on-chain and readable; the rate and salt that open
    // it are not, and never will be from here. See OfferNotYetReceivedError.
    throw new OfferNotYetReceivedError(myKey);
  }

  async acceptOffer(params: { ratePerPeriod: Amount; salt: string }): Promise<void> {
    const contract = await this.requireContract();
    try {
      await contract.callTx.acceptHire(params.ratePerPeriod, hexToBytes(params.salt));
    } catch (error) {
      throw mapCircuitError(error, undefined) ?? error;
    }
    // Store what confirmPayment/proveContribution will need to read back —
    // this is the one write this api ever makes to private state itself
    // (the witness's own secretKey is handled by createPayrollPrivateState).
    await this.rememberAcceptedRate(params.ratePerPeriod, hexToBytes(params.salt));
  }

  async confirmPayment(params: { period: Period; amountReceived: Amount }): Promise<void> {
    const contract = await this.requireContract();
    const accepted = await this.recallAcceptedRate();
    if (!accepted) throw new MissingPrivateStateError();
    try {
      await contract.callTx.confirmPayment(
        periodToUint32(params.period),
        accepted.ratePerPeriod,
        accepted.salt,
        params.amountReceived,
      );
    } catch (error) {
      throw mapCircuitError(error, params.period) ?? error;
    }
  }

  async proveContribution(params: { period: Period; declared: Amount }): Promise<void> {
    const contract = await this.requireContract();
    const accepted = await this.recallAcceptedRate();
    if (!accepted) throw new MissingPrivateStateError();
    try {
      await contract.callTx.proveContribution(
        periodToUint32(params.period),
        accepted.ratePerPeriod,
        accepted.salt,
        params.declared,
      );
    } catch (error) {
      throw mapCircuitError(error, params.period) ?? error;
    }
  }

  // ---------------------------------------------------------------------
  // Anyone
  // ---------------------------------------------------------------------

  async getEmploymentRecord(workerKey: WorkerKey): Promise<EmploymentRecord> {
    const state = await this.readLedger();
    const workerBytes = hexToBytes(workerKey);
    if (!state.active.member(workerBytes) && !state.agreedRate.member(workerBytes)) {
      throw new UnknownWorkerError(workerKey);
    }
    const periods = this.readableWorkerPeriods(state, workerBytes);
    const confirmedPeriods = periods.filter((p) => p.status === 'confirmed').map((p) => p.period);
    return {
      workerKey,
      active: state.active.member(workerBytes) ? state.active.lookup(workerBytes) : false,
      joinedPeriod: confirmedPeriods.at(0) ?? null,
      lastConfirmedPeriod: confirmedPeriods.at(-1) ?? null,
      periods,
    };
  }

  async listEmploymentRecords(): Promise<EmploymentRecord[]> {
    const state = await this.readLedger();
    const records: EmploymentRecord[] = [];
    for (const [workerBytes] of state.active) {
      records.push(await this.getEmploymentRecord(bytesToHex(workerBytes)));
    }
    return records;
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  /**
   * One worker's period history, recovered from the public ledger by probing.
   *
   * `approvedHours`/`paidFor`/`contributionOk` are keyed by
   * `periodKey(worker, period)` — a hash that hides which period a given
   * entry is for. That is deliberate: a chain observer cannot iterate the
   * maps and learn *when* anyone worked. The cost is that even a legitimate
   * reader cannot enumerate a worker's periods; they can only hash candidate
   * periods and ask whether that key is present.
   *
   * So that is what this does. Periods are month indices (see `periods.ts`),
   * which makes the candidate set a contiguous range, and the whole ledger is
   * already decoded in memory — a scan is some hundreds of hashes and map
   * lookups, no network.
   *
   * THE BOUND IS REAL AND IS NOT SILENT. Only periods inside
   * `periodScanWindow` are looked for; a period outside it exists on chain
   * and will not appear here. The default window is documented on
   * `MidnightPayrollApiOptions.periodScanWindow`. Widening it costs only CPU.
   *
   * Statuses match `MockPayrollApi.periodsOf` exactly, so the three apps
   * behave the same against either implementation. `awaiting-hours` is never
   * produced: it means "the employer has not approved a timesheet yet", and a
   * period nobody has approved leaves no trace on chain to find.
   */
  private readableWorkerPeriods(state: Ledger, workerBytes: Uint8Array): PeriodRecord[] {
    const { firstPeriod, lastPeriod } = this.periodScanWindow;
    const found: { period: bigint; hours: number; paid: boolean; contributionOk: boolean }[] = [];

    for (let period = firstPeriod; period <= lastPeriod; period += 1n) {
      const pk = periodKey(workerBytes, period);
      if (!state.approvedHours.member(pk)) continue;
      found.push({
        period,
        hours: Number(state.approvedHours.lookup(pk)),
        paid: state.paidFor.member(pk) && state.paidFor.lookup(pk),
        contributionOk: state.contributionOk.member(pk) && state.contributionOk.lookup(pk),
      });
    }

    // The most recent approved-but-unconfirmed period is still waiting on the
    // worker; an earlier one has been overtaken and stays unconfirmed on the
    // public record. That distinction is the whole point of `unconfirmed`.
    const latestApproved = found.at(-1)?.period;

    return found.map(({ period, hours, paid, contributionOk }) => ({
      period: uint32ToPeriod(period),
      status: paid ? 'confirmed' : period === latestApproved ? 'awaiting-confirmation' : 'unconfirmed',
      hours,
      contributionVerified: contributionOk,
    }));
  }

  private requireConnectedApi(): ConnectedAPI {
    if (!this.connection) throw new Error('No wallet connected. Call connectWallet() first.');
    return this.connection.connectedApi;
  }

  /**
   * Every DUST figure the wallet will tell a dApp.
   *
   * `balance` is what can be spent on fees right now; `cap` is the ceiling
   * the registered NIGHT can generate towards. Both are read-only: the DApp
   * Connector API has `getDustBalance` and no counterpart that registers
   * NIGHT for generation, because that has to be signed by the key owning the
   * UTXO. Refilling is the wallet's own "Generate tDUST" and cannot be driven
   * from here — checked against the full ConnectedAPI surface in
   * `dapp-connector-api/dist/api.d.ts`.
   */
  async readFeeCapacity(): Promise<FeeCapacity> {
    const { balance, cap } = await this.requireConnectedApi().getDustBalance();
    return { balance, cap, canPayFees: balance > 0n };
  }

  /**
   * Refuse a write the wallet cannot pay for, before it costs anything.
   *
   * Without this, an empty DUST tank surfaces as a successful proof, a
   * signature prompt, and then `Unexpected error submitting scoped
   * transaction '<unnamed>': Error` — the wallet failing internally with an
   * empty message, having never reached the node. That wording says nothing
   * about fees and sent several hours of this project chasing serialization
   * bugs that did not exist.
   */
  private async assertCanPayFees(): Promise<void> {
    const { balance, cap } = await this.readFeeCapacity();
    if (balance > 0n) return;
    throw new Error(
      `This wallet has no DUST, so it cannot pay for a transaction (balance 0 of cap ${cap}). ` +
        'DUST is generated by NIGHT that has been registered for it: open the wallet, press ' +
        '"Generate tDUST", and wait for the tank to fill. A dApp cannot do this for you — the ' +
        'registration must be signed by the key that owns the NIGHT. Nothing was sent.',
    );
  }

  private async requireContract(): Promise<FoundContract<PayrollContract>> {
    // Before the cache check, not after: this must run on every write, and
    // the contract is only looked up once.
    await this.assertCanPayFees();
    if (this.foundContract) return this.foundContract;
    if (!this.writeProviders) throw new Error('No wallet connected. Call connectWallet() first.');
    this.foundContract = (await findDeployedContract(this.writeProviders, {
      compiledContract: compiledPayrollContract,
      contractAddress: this.contractAddress,
      privateStateId: PAYROLL_PRIVATE_STATE_ID,
      initialPrivateState: createPayrollPrivateState(this.secret),
    })) as FoundContract<PayrollContract>;
    return this.foundContract;
  }

  /** Read-only path: no wallet, just the network's indexer — per the README. */
  private async readLedger(): Promise<Ledger> {
    const { http } = INDEXER_ENDPOINTS[this.networkId];
    const publicDataProvider = indexerPublicDataProvider(http, INDEXER_ENDPOINTS[this.networkId].ws);
    const state = await publicDataProvider.queryContractState(this.contractAddress);
    if (!state) throw new Error(`No contract found at ${this.contractAddress} on ${this.networkId}.`);
    return ledger(state.data);
  }

  private async rememberAcceptedRate(ratePerPeriod: bigint, salt: Uint8Array): Promise<void> {
    if (!this.writeProviders) return;
    this.writeProviders.privateStateProvider.setContractAddress(this.contractAddress);
    const existing = (await this.writeProviders.privateStateProvider.get(PAYROLL_PRIVATE_STATE_ID)) as
      | { secretKey: Uint8Array }
      | null;
    await this.writeProviders.privateStateProvider.set(PAYROLL_PRIVATE_STATE_ID, {
      ...(existing ?? createPayrollPrivateState(this.secret)),
      acceptedRate: { ratePerPeriod, salt },
    } as never);
  }

  private async recallAcceptedRate(): Promise<{ ratePerPeriod: bigint; salt: Uint8Array } | null> {
    if (!this.writeProviders) return null;
    this.writeProviders.privateStateProvider.setContractAddress(this.contractAddress);
    const stored = (await this.writeProviders.privateStateProvider.get(PAYROLL_PRIVATE_STATE_ID)) as
      | { acceptedRate?: { ratePerPeriod: bigint; salt: Uint8Array } }
      | null;
    return stored?.acceptedRate ?? null;
  }
}

/** Best-effort assert-message match, used to fill `TransactionStatus.failed`. */
function asPayrollError(error: unknown): PayrollError {
  const mapped = mapCircuitError(error, undefined);
  if (mapped) return mapped;
  return error instanceof PayrollError ? error : new PayrollError(String(error));
}

/**
 * Maps a contract assertion failure to the error class the README's "For B"
 * table specifies, matching on the exact assert message text from
 * `payroll.compact`. Returns `null` for asserts with no listed mapping
 * (the auth checks — "only the employer may ..." — are misuse, not one of
 * the documented UI states, so they are left to bubble as raw errors).
 */
function mapCircuitError(error: unknown, period: Period | string | undefined): PayrollError | null {
  const message = error instanceof Error ? error.message : String(error);
  const periodLabel = period !== undefined ? String(period) : 'this period';
  if (message.includes('the sealed rate does not match')) return new OfferMismatchError();
  if (message.includes('incorrect payment')) return new PaymentMismatchError();
  if (message.includes('does not match your real earnings')) return new ContributionMismatchError();
  if (message.includes('has not approved hours') || message.includes('no approved hours')) {
    return new HoursNotApprovedError(periodLabel);
  }
  if (message.includes('already confirmed') || message.includes('already proven')) {
    return new AlreadyConfirmedError(periodLabel);
  }
  return null;
}

export { uint32ToPeriod };
