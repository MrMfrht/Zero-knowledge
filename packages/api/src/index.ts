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
  DEMO_SHIELDED_ADDRESSES,
} from './mock/MockPayrollApi.js';
export type { MockPayrollApiOptions } from './mock/MockPayrollApi.js';

export { MidnightPayrollApi } from './midnight/MidnightPayrollApi.js';

// Both apps need to tell "no wallet extension in this browser" apart from a
// genuine circuit failure, and were reduced to matching on error.name because
// this class was not reachable from here. Exporting it lets them use
// `instanceof` without reaching into another package's internals.
export { NoWalletFoundError } from './midnight/walletConnector.js';
export type { MidnightPayrollApiOptions } from './midnight/MidnightPayrollApi.js';
export { NETWORK_IDS } from './midnight/network.js';
export type { NetworkId } from './midnight/network.js';

// How an app gets an api. Apps should call this rather than picking a class:
// see the comment at the top of createPayrollApi.ts.
export { createPayrollApi, payrollApiConfigFromEnv } from './createPayrollApi.js';
export type { PayrollApiConfig, PayrollApiDescription } from './createPayrollApi.js';

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

// The salt that opens a sealed rate exists only on the employer's device.
// Exported so an app can show it again after any UI failure -- see
// offerVault.ts for why losing it is unrecoverable.
export {
  listRememberedOffers,
  recallOffer,
  recallOfferAmount,
  rememberOffer,
} from './midnight/offerVault.js';
export type { RememberedOffer } from './midnight/offerVault.js';

// Devnet convenience: a hired worker key can never be hired again, so
// demoing the flow twice needs an identity with no history.
export { regenerateLocalSecret } from './midnight/localSecret.js';
