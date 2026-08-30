/**
 * @nightshift/api — the only package that is allowed to know about Midnight.
 *
 * Apps import from here and nowhere else. If a UI file ever needs to import
 * `@midnight-ntwrk/*`, something is missing from `PayrollApi` — say so rather
 * than working around it.
 *
 * Start here: packages/api/README.md
 */

export type {
  OnTransactionStatus,
  PayrollApi,
  TransactionStatus,
  WalletStatus,
} from './PayrollApi.js';

export {
  PayrollError,
  OfferMismatchError,
  PaymentMismatchError,
  ContributionMismatchError,
  MissingPrivateStateError,
  HoursNotApprovedError,
  AlreadyConfirmedError,
  UnknownWorkerError,
} from './errors.js';

export {
  MockPayrollApi,
  resetMockStore,
  DEMO_EMPLOYER,
  DEMO_KARIM,
  DEMO_DANA,
  DEMO_SAM,
} from './mock/MockPayrollApi.js';
export type { MockPayrollApiOptions } from './mock/MockPayrollApi.js';

// The real implementation lands here when B finishes it:
// export { MidnightPayrollApi } from './midnight/MidnightPayrollApi.js';

// Re-exported so apps need only one import for the common types.
export type {
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
export { comparePeriods, formatPeriod, nextPeriod } from '@nightshift/shared';
