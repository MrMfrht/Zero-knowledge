import type {
  Amount,
  Commitment,
  EmploymentRecord,
  Offer,
  Period,
  PeriodRecord,
  PeriodStatus,
  Salt,
  WorkerKey,
  WorkerSummary,
} from '@nightshift/shared';
import { comparePeriods } from '@nightshift/shared';
import type {
  OnTransactionStatus,
  PayrollApi,
  TransactionStatus,
  WalletStatus,
} from '../PayrollApi.js';
import {
  AlreadyConfirmedError,
  ContributionMismatchError,
  HoursNotApprovedError,
  MissingPrivateStateError,
  OfferMismatchError,
  PayrollError,
  PaymentMismatchError,
  UnknownWorkerError,
} from '../errors.js';

/**
 * An in-memory PayrollApi. No blockchain, no wallet, no network.
 *
 * It enforces the same rules the real contract will, so a wrong amount fails
 * here exactly as it will on-chain. Build and demo your whole app against this.
 *
 * What it is NOT: the hash below is a toy. It is deterministic and good enough
 * to make the rules bite during development. It is not cryptography, and it is
 * not what the real contract uses (`persistentCommit`, SHA-256 based, with a
 * proper random salt).
 */

// ---------------------------------------------------------------------------
// Toy commitment — development only
// ---------------------------------------------------------------------------

/** FNV-1a. Deterministic, tiny, and NOT secure. Development only. */
function toyHash(input: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (const ch of input) {
    h = ((h ^ BigInt(ch.codePointAt(0) ?? 0)) * prime) & mask;
  }
  return '0x' + h.toString(16).padStart(16, '0').repeat(4);
}

/** Stands in for the contract's `persistentCommit(rate, salt)`. */
function seal(rate: Amount, salt: Salt): Commitment {
  return toyHash(`${rate.toString()}|${salt}`);
}

function randomSalt(): Salt {
  let out = '0x';
  for (let i = 0; i < 64; i += 1) out += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return out;
}

/** Stands in for a real transaction hash. Same shape, no cryptographic meaning. */
function fakeTxId(): string {
  let out = '0x';
  for (let i = 0; i < 40; i += 1) out += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return out;
}

// ---------------------------------------------------------------------------
// The shared store
// ---------------------------------------------------------------------------

interface WorkerState {
  key: WorkerKey;
  active: boolean;
  commitment: Commitment;
  expectedHours: number;
  /** Approved timesheets. Absent means the employer has not approved that period. */
  approvedHours: Map<Period, number>;
  confirmed: Set<Period>;
  contributionVerified: Set<Period>;
  /** Set once the worker accepts. Absent means the offer is still pending. */
  accepted: boolean;
}

/**
 * What lives only on the worker's own device: the rate and salt behind their
 * sealed agreement. In the real app this is encrypted local storage. It never
 * reaches a server, here or in production.
 */
interface PrivateState {
  ratePerPeriod: Amount;
  salt: Salt;
}

interface Store {
  workers: Map<WorkerKey, WorkerState>;
  /** Rate + salt the employer generated, so `getMyOffer` can hand them over. */
  pendingOffers: Map<WorkerKey, PrivateState>;
  /** Per-device private state, keyed by worker. */
  privateState: Map<WorkerKey, PrivateState>;
  contributionRatePercent: bigint;
}

export const DEMO_EMPLOYER: WorkerKey = `0x${'e0'.repeat(32)}`;
export const DEMO_KARIM: WorkerKey = `0x${'7f3a'.repeat(16)}`;
export const DEMO_DANA: WorkerKey = `0x${'91b2'.repeat(16)}`;
export const DEMO_SAM: WorkerKey = `0x${'c4e8'.repeat(16)}`;

/** Karim is salaried. Dana is hourly. Sam has the unconfirmed month. */
function seededStore(): Store {
  const store: Store = {
    workers: new Map(),
    pendingOffers: new Map(),
    privateState: new Map(),
    contributionRatePercent: 25n,
  };

  const hire = (
    key: WorkerKey,
    rate: Amount,
    expectedHours: number,
    periods: { period: Period; hours: number; confirmed: boolean }[],
  ): void => {
    const salt = randomSalt();
    store.workers.set(key, {
      key,
      active: true,
      commitment: seal(rate, salt),
      expectedHours,
      approvedHours: new Map(periods.map((p) => [p.period, p.hours])),
      confirmed: new Set(periods.filter((p) => p.confirmed).map((p) => p.period)),
      contributionVerified: new Set(periods.filter((p) => p.confirmed).map((p) => p.period)),
      accepted: true,
    });
    store.privateState.set(key, { ratePerPeriod: rate, salt });
  };

  const salaried = (months: string[], unconfirmed: string[] = []) =>
    months.map((period) => ({ period, hours: 1, confirmed: !unconfirmed.includes(period) }));

  hire(DEMO_KARIM, 5000n, 1, salaried(['2026-01', '2026-02', '2026-03', '2026-04']));
  hire(DEMO_DANA, 85n, 47, [
    { period: '2026-01', hours: 40, confirmed: true },
    { period: '2026-02', hours: 52, confirmed: true },
    { period: '2026-03', hours: 47, confirmed: true },
    { period: '2026-04', hours: 38, confirmed: false },
  ]);
  hire(DEMO_SAM, 4200n, 1, salaried(['2026-01', '2026-02', '2026-03', '2026-04'], ['2026-03']));

  return store;
}

/**
 * One store shared by every MockPayrollApi in the process, so an employer app
 * and a worker app running side by side see the same data.
 */
let sharedStore: Store = seededStore();

/** Reset to the seeded demo data. Handy between tests. */
export function resetMockStore(): void {
  sharedStore = seededStore();
}

// ---------------------------------------------------------------------------
// The implementation
// ---------------------------------------------------------------------------

export interface MockPayrollApiOptions {
  /**
   * Who is using the app. Use `DEMO_EMPLOYER` in the employer app and one of
   * the worker keys in the worker app. The auditor view can pass anything —
   * its methods do not care who is asking, which is rather the point.
   */
  actingAs: WorkerKey;
  /** Fake network delay in milliseconds, so loading states are visible. Default 150. */
  latencyMs?: number;
}

export class MockPayrollApi implements PayrollApi {
  private readonly me: WorkerKey;
  private readonly latencyMs: number;
  private walletStatus: WalletStatus = { connected: false };

  constructor(options: MockPayrollApiOptions) {
    this.me = options.actingAs;
    this.latencyMs = options.latencyMs ?? 150;
  }

  // --- identity ------------------------------------------------------------

  async getMyKey(): Promise<WorkerKey> {
    await this.tick();
    return this.me;
  }

  // --- wallet ----------------------------------------------------------------

  async connectWallet(): Promise<WalletStatus> {
    await this.tick();
    // Deterministic fake address per identity, so re-connecting in a demo
    // shows the same address rather than a new random one each time.
    this.walletStatus = { connected: true, address: `mn_addr_undeployed_mock${this.me.slice(2, 10)}` };
    return this.walletStatus;
  }

  async disconnectWallet(): Promise<void> {
    await this.tick();
    this.walletStatus = { connected: false };
  }

  async getWalletStatus(): Promise<WalletStatus> {
    await this.tick();
    return this.walletStatus;
  }

  async payWorker(params: {
    workerKey: WorkerKey;
    amount: Amount;
    onStatus?: OnTransactionStatus;
  }): Promise<{ txId: string }> {
    this.requireWorker(params.workerKey);
    if (!this.walletStatus.connected) throw new PayrollError('No wallet connected.');
    return this.withLifecycle(params.onStatus, async () => ({ txId: fakeTxId() }));
  }

  // --- employer ------------------------------------------------------------

  async hire(params: {
    workerKey: WorkerKey;
    ratePerPeriod: Amount;
    expectedHours: number;
    onStatus?: OnTransactionStatus;
  }): Promise<Offer> {
    return this.withLifecycle(params.onStatus, async () => {
      const salt = randomSalt();
      const commitment = seal(params.ratePerPeriod, salt);

      sharedStore.workers.set(params.workerKey, {
        key: params.workerKey,
        active: true,
        commitment,
        expectedHours: params.expectedHours,
        approvedHours: new Map(),
        confirmed: new Set(),
        contributionVerified: new Set(),
        accepted: false,
      });
      sharedStore.pendingOffers.set(params.workerKey, {
        ratePerPeriod: params.ratePerPeriod,
        salt,
      });

      return {
        workerKey: params.workerKey,
        ratePerPeriod: params.ratePerPeriod,
        salt,
        commitment,
        expectedHours: params.expectedHours,
      };
    });
  }

  async approveHours(params: {
    workerKey: WorkerKey;
    period: Period;
    hours: number;
    onStatus?: OnTransactionStatus;
  }): Promise<void> {
    return this.withLifecycle(params.onStatus, async () => {
      const worker = this.requireWorker(params.workerKey);
      worker.approvedHours.set(params.period, params.hours);
    });
  }

  async endEmployment(workerKey: WorkerKey): Promise<void> {
    await this.tick();
    this.requireWorker(workerKey).active = false;
  }

  async listWorkers(): Promise<WorkerSummary[]> {
    await this.tick();
    return [...sharedStore.workers.values()].map((w) => {
      const periods = this.periodsOf(w);
      return {
        workerKey: w.key,
        active: w.active,
        confirmedPeriods: periods.filter((p) => p.status === 'confirmed').length,
        unconfirmedPeriods: periods.filter((p) => p.status === 'unconfirmed').length,
      };
    });
  }

  // --- worker --------------------------------------------------------------

  async getMyOffer(): Promise<Offer | null> {
    await this.tick();
    const worker = sharedStore.workers.get(this.me);
    const secret = sharedStore.pendingOffers.get(this.me);
    if (!worker || worker.accepted || !secret) return null;
    return {
      workerKey: this.me,
      ratePerPeriod: secret.ratePerPeriod,
      salt: secret.salt,
      commitment: worker.commitment,
      expectedHours: worker.expectedHours,
    };
  }

  async acceptOffer(params: { ratePerPeriod: Amount; salt: Salt }): Promise<void> {
    await this.tick();
    const worker = this.requireWorker(this.me);

    // The check that makes accepting meaningful: does what the worker was told
    // actually open the value the employer put on-chain?
    if (seal(params.ratePerPeriod, params.salt) !== worker.commitment) {
      throw new OfferMismatchError();
    }

    worker.accepted = true;
    sharedStore.privateState.set(this.me, {
      ratePerPeriod: params.ratePerPeriod,
      salt: params.salt,
    });
    sharedStore.pendingOffers.delete(this.me);
  }

  async confirmPayment(params: { period: Period; amountReceived: Amount }): Promise<void> {
    await this.tick();
    const worker = this.requireWorker(this.me);
    const secret = sharedStore.privateState.get(this.me);
    if (!secret) throw new MissingPrivateStateError();

    const hours = worker.approvedHours.get(params.period);
    if (hours === undefined) throw new HoursNotApprovedError(params.period);
    if (worker.confirmed.has(params.period)) throw new AlreadyConfirmedError(params.period);

    // The whole product, in one comparison. On-chain this happens inside a
    // zero-knowledge proof: none of these three numbers becomes public.
    const expected = BigInt(hours) * secret.ratePerPeriod;
    if (params.amountReceived !== expected) throw new PaymentMismatchError();

    worker.confirmed.add(params.period);
  }

  async proveContribution(params: { period: Period; declared: Amount }): Promise<void> {
    await this.tick();
    const worker = this.requireWorker(this.me);
    const secret = sharedStore.privateState.get(this.me);
    if (!secret) throw new MissingPrivateStateError();

    const expected = (secret.ratePerPeriod * sharedStore.contributionRatePercent) / 100n;
    if (params.declared !== expected) throw new ContributionMismatchError();

    worker.contributionVerified.add(params.period);
  }

  // --- anyone --------------------------------------------------------------

  async getEmploymentRecord(workerKey: WorkerKey): Promise<EmploymentRecord> {
    await this.tick();
    return this.recordFor(this.requireWorker(workerKey));
  }

  async listEmploymentRecords(): Promise<EmploymentRecord[]> {
    await this.tick();
    return [...sharedStore.workers.values()].map((w) => this.recordFor(w));
  }

  // --- internals -----------------------------------------------------------

  private recordFor(worker: WorkerState): EmploymentRecord {
    const periods = this.periodsOf(worker);
    const confirmed = periods.filter((p) => p.status === 'confirmed').map((p) => p.period);
    return {
      workerKey: worker.key,
      active: worker.active,
      joinedPeriod: confirmed[0] ?? null,
      lastConfirmedPeriod: confirmed[confirmed.length - 1] ?? null,
      periods,
    };
  }

  private periodsOf(worker: WorkerState): PeriodRecord[] {
    const all = new Set<Period>([...worker.approvedHours.keys(), ...worker.confirmed]);
    return [...all].sort(comparePeriods).map((period) => {
      const hours = worker.approvedHours.get(period) ?? null;
      let status: PeriodStatus;
      if (worker.confirmed.has(period)) status = 'confirmed';
      else if (hours === null) status = 'awaiting-hours';
      else if (period === this.latestPeriod(all)) status = 'awaiting-confirmation';
      else status = 'unconfirmed';
      return {
        period,
        status,
        hours,
        contributionVerified: worker.contributionVerified.has(period),
      };
    });
  }

  /** The most recent period is still open; anything older that is unconfirmed has failed. */
  private latestPeriod(periods: Set<Period>): Period | undefined {
    return [...periods].sort(comparePeriods).at(-1);
  }

  private requireWorker(key: WorkerKey): WorkerState {
    const worker = sharedStore.workers.get(key);
    if (!worker) throw new UnknownWorkerError(key);
    return worker;
  }

  private tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  /**
   * Runs `work`, reporting the same signing → proving → submitting → pending
   * → confirmed/failed stages a real chain call goes through, so employer-
   * and worker-app UI can be built against realistic transitions before the
   * real `MidnightPayrollApi` exists. `work` throwing surfaces as `'failed'`
   * and rethrows; nothing here changes what callers already get by ignoring
   * `onStatus` entirely.
   */
  private async withLifecycle<T>(
    onStatus: OnTransactionStatus | undefined,
    work: () => Promise<T>,
  ): Promise<T> {
    const stages: TransactionStatus[] = [
      { stage: 'signing' },
      { stage: 'proving' },
      { stage: 'submitting' },
      { stage: 'pending' },
    ];
    for (const status of stages) {
      onStatus?.(status);
      await this.tick();
    }

    try {
      const result = await work();
      onStatus?.({ stage: 'confirmed', txId: fakeTxId() });
      return result;
    } catch (err) {
      const error = err instanceof PayrollError ? err : new PayrollError(String(err));
      onStatus?.({ stage: 'failed', error });
      throw err;
    }
  }
}
