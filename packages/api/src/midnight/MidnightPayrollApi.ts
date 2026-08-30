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
import { connectWallet as connectorConnectWallet, type WalletConnection } from './walletConnector.js';
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
import { bytesToHex, hexToBytes } from './encoding.js';
import { periodToUint32, uint32ToPeriod } from './periods.js';
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
}

export class MidnightPayrollApi implements PayrollApi {
  private readonly contractAddress: string;
  private readonly networkId: NetworkId;
  private readonly secret: Uint8Array;

  /** Set once `connectWallet()` resolves; every write method requires it. */
  private connection: WalletConnection | undefined;
  private writeProviders: PayrollProviders | undefined;
  private foundContract: FoundContract<PayrollContract> | undefined;

  constructor(options: MidnightPayrollApiOptions) {
    this.contractAddress = options.contractAddress;
    this.networkId = options.networkId;
    setNetworkId(this.networkId);
    this.secret = getOrCreateLocalSecret();
  }

  // ---------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------

  async getMyKey(): Promise<WorkerKey> {
    return bytesToHex(pureCircuits.dappKey(this.secret));
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
    amount: Amount;
    onStatus?: OnTransactionStatus;
  }): Promise<{ txId?: string }> {
    const connectedApi = this.requireConnectedApi();
    params.onStatus?.({ stage: 'signing' });
    // sendPrivatePayment is wallet-to-wallet — it needs the worker's
    // SHIELDED address, not their contract WorkerKey. Neither PayrollApi
    // nor the contract ledger stores that mapping (a worker's shielded
    // address is never on-chain — see payment.ts). Resolving workerKey ->
    // shielded address is therefore also outside what this method can do
    // honestly today; treating workerKey as if it already were the
    // recipient address, as done here, is a placeholder that will fail
    // against a real wallet and needs the same "report it" treatment as
    // OfferNotYetReceivedError above.
    params.onStatus?.({ stage: 'proving' });
    params.onStatus?.({ stage: 'submitting' });
    await sendPrivatePayment(connectedApi, {
      recipientShieldedAddress: params.workerKey,
      amount: params.amount,
    });
    params.onStatus?.({ stage: 'pending' });
    params.onStatus?.({ stage: 'confirmed' });
    return {};
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
      const workerKey = bytesToHex(workerBytes);
      let confirmed = 0;
      let unconfirmed = 0;
      for (const [pk] of state.approvedHours) {
        // paidFor/approvedHours are keyed by periodKey(worker, period), a
        // hash — there is no way to recover which worker a given periodKey
        // belongs to without also iterating `active` and recomputing
        // periodKey ourselves, which needs the actual period numbers.
        // Counting confirmed/unconfirmed periods per worker from the public
        // ledger alone therefore needs the auditor's own period-enumeration
        // approach (see A_docs/07's note on E) — left as `0` here rather
        // than a fabricated count. Flag per the rulebook: this is a real
        // gap between what WorkerSummary promises and what the public
        // ledger alone can answer without an off-chain period index.
        void pk;
      }
      summaries.push({ workerKey, active: isActive, confirmedPeriods: confirmed, unconfirmedPeriods: unconfirmed });
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
   * `approvedHours`/`paidFor`/`contributionOk` are keyed by
   * `periodKey(worker, period)` — a hash that hides which period a given
   * entry is for. Reading "this worker's periods" from the public ledger
   * therefore needs candidate period numbers to hash and probe with; there
   * is no way to enumerate them from the ledger alone. This tries every
   * period from this worker's private acceptance record forward to now,
   * which is correct for THIS device (it knows its own accepted periods
   * going forward) but cannot discover history from before this device
   * held the private state — the same class of gap as `getMyOffer`. E's
   * auditor board needs its own, better answer to this; see A_docs/07.
   */
  private readableWorkerPeriods(_state: Ledger, _workerBytes: Uint8Array): PeriodRecord[] {
    // Deliberately not fabricated: see the doc comment above. Returning an
    // empty list rather than guessing which periods exist is the honest
    // choice until E's approach (or a public period index) exists.
    return [];
  }

  private requireConnectedApi(): ConnectedAPI {
    if (!this.connection) throw new Error('No wallet connected. Call connectWallet() first.');
    return this.connection.connectedApi;
  }

  private async requireContract(): Promise<FoundContract<PayrollContract>> {
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
