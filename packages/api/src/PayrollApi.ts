import type {
  Amount,
  EmploymentRecord,
  Offer,
  Period,
  WorkerKey,
  WorkerSummary,
} from '@nightshift/shared';
import type { PayrollError } from './errors.js';

// ---------------------------------------------------------------------------
// Wallet & transaction lifecycle
// ---------------------------------------------------------------------------

/** Wallet connection state, safe for UI code — never a key, salt, or secret. */
export type WalletStatus =
  | { readonly connected: false }
  | { readonly connected: true; readonly address: string };

/**
 * Mid-flight progress for a transaction that touches the chain. UI code
 * renders these stages directly; nothing here ever carries an SDK object, a
 * salt, or a secret key — that is the entire point of this type existing
 * instead of the app reaching into `@midnight-ntwrk/*` itself.
 */
export type TransactionStatus =
  | { readonly stage: 'signing' | 'proving' | 'submitting' | 'pending' }
  | { readonly stage: 'confirmed'; readonly txId: string }
  | { readonly stage: 'failed'; readonly error: PayrollError };

/**
 * Reports transaction progress as it happens. Optional on every method that
 * accepts it — omit it to just `await` the final result, the way every
 * method here worked before this existed.
 */
export type OnTransactionStatus = (status: TransactionStatus) => void;

/**
 * Everything the three apps can do.
 *
 * There are two implementations and they behave identically:
 *
 *   - `MockPayrollApi` — in memory, no blockchain. Use it today.
 *   - `MidnightPayrollApi` — the real one, built by B on top of the contract.
 *
 * Swapping between them is one import. No other code changes. That is the
 * whole reason this file exists, so please do not add methods to it without
 * telling everyone — five people build against it.
 *
 * See packages/api/README.md for worked examples of every method.
 */
export interface PayrollApi {
  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /**
   * The key of whoever is using this app right now.
   *
   * Derived from a secret held on their device. It is not a wallet address and
   * not a name — it identifies them inside this contract and nowhere else.
   */
  getMyKey(): Promise<WorkerKey>;

  // -------------------------------------------------------------------------
  // Wallet  (used by C and D — anything that signs a transaction)
  // -------------------------------------------------------------------------

  /**
   * Connect the browser wallet extension (Lace, 1AM, etc.).
   *
   * Required before calling anything that submits a transaction — `hire`,
   * `approveHours`, `payWorker`. Reading methods (`listWorkers`,
   * `getEmploymentRecord`, ...) never need a wallet.
   */
  connectWallet(): Promise<WalletStatus>;

  disconnectWallet(): Promise<void>;

  /** Current wallet state, so the UI can react without holding its own copy. */
  getWalletStatus(): Promise<WalletStatus>;

  /**
   * Send a private payment, wallet to wallet.
   *
   * This does not touch the contract at all — it is a plain shielded
   * transfer. `confirmPayment` is the separate, later step the worker takes
   * once the payment has arrived, and is the only place the amount is
   * checked against the sealed rate.
   *
   * Requires a connected wallet. Throws if none is connected.
   */
  payWorker(params: {
    workerKey: WorkerKey;
    amount: Amount;
    onStatus?: OnTransactionStatus;
  }): Promise<{ txId: string }>;

  // -------------------------------------------------------------------------
  // Employer  (used by D)
  // -------------------------------------------------------------------------

  /**
   * Seal a salary and offer someone a job.
   *
   * The returned `Offer` has two halves. `commitment` goes on the blockchain
   * and is public. `ratePerPeriod` and `salt` are private — pass them to the
   * worker directly, the way you would send an offer letter. They need both to
   * accept.
   *
   * Once sealed, the rate cannot be changed. Not by the employer, not by us.
   * If the salary is wrong, end the employment and hire again.
   *
   * @param ratePerPeriod For hourly workers this is the rate for ONE hour.
   * @param expectedHours `1` for salaried and fixed-price work.
   * @param onStatus Optional. Reports signing/proving/submitting/pending as
   *   they happen; the returned `Offer` is only what a successful `hire`
   *   ever resolved to, so existing callers that omit this see no change.
   */
  hire(params: {
    workerKey: WorkerKey;
    ratePerPeriod: Amount;
    expectedHours: number;
    onStatus?: OnTransactionStatus;
  }): Promise<Offer>;

  /**
   * Approve a timesheet, which unlocks that period for confirmation.
   *
   * Hours are stored publicly, on purpose: the employer already knows them, and
   * only the rate is sensitive. Pass `1` for salaried workers.
   *
   * The worker cannot confirm a period until its hours are approved.
   *
   * @param onStatus Optional. Same lifecycle reporting as `hire`.
   */
  approveHours(params: {
    workerKey: WorkerKey;
    period: Period;
    hours: number;
    onStatus?: OnTransactionStatus;
  }): Promise<void>;

  /**
   * Mark someone as no longer employed.
   *
   * Their history stays on the record — the last confirmed period becomes their
   * leaving date. Nothing is deleted.
   */
  endEmployment(workerKey: WorkerKey): Promise<void>;

  /** Everyone this employer has hired. Contains no salaries, because nobody has them. */
  listWorkers(): Promise<WorkerSummary[]>;

  // -------------------------------------------------------------------------
  // Worker  (used by C)
  // -------------------------------------------------------------------------

  /** A job offer waiting for the current user, or `null` if there is none. */
  getMyOffer(): Promise<Offer | null>;

  /**
   * Accept a job offer.
   *
   * Pass the rate and salt the employer sent you. This checks they really open
   * the sealed value already on the blockchain.
   *
   * Throws {@link OfferMismatchError} if they do not — meaning the employer
   * sealed a different number than the one they told you. Do not accept.
   * Show the error and tell the worker to contact them.
   *
   * On success the rate and salt are stored on this device so later
   * confirmations work without asking again.
   */
  acceptOffer(params: { ratePerPeriod: Amount; salt: string }): Promise<void>;

  /**
   * Confirm that a payment arrived and was correct.
   *
   * This is the heart of the product. The check happens inside a zero-knowledge
   * proof: it verifies `amountReceived === hours × sealedRate` without any of
   * those three numbers becoming public. Only the result is recorded.
   *
   * Throws {@link PaymentMismatchError} when the amount is wrong. That is not a
   * bug — it is the system refusing to record a wrong payment as correct.
   * Show it clearly and deliberately; see the README for the exact wording.
   *
   * You do not pass the rate or the salt. This method reads them from the
   * device's private state. No UI code should ever hold a salt.
   */
  confirmPayment(params: { period: Period; amountReceived: Amount }): Promise<void>;

  /**
   * Prove a social-security contribution was calculated on the real salary.
   *
   * Checks `declared === sealedRate × contributionRate / 100` in zero knowledge.
   * Records only whether it held. The salary stays sealed.
   *
   * Throws {@link ContributionMismatchError} if the employer under-declared.
   */
  proveContribution(params: { period: Period; declared: Amount }): Promise<void>;

  // -------------------------------------------------------------------------
  // Anyone  (used by E — no wallet, no login, no permission)
  // -------------------------------------------------------------------------

  /**
   * One worker's full public history.
   *
   * Readable by anyone. That is the point: a rejected job applicant, a
   * regulator, or a journalist can verify this without being granted anything.
   */
  getEmploymentRecord(workerKey: WorkerKey): Promise<EmploymentRecord>;

  /** Every worker's public history — the auditor board. */
  listEmploymentRecords(): Promise<EmploymentRecord[]>;
}
