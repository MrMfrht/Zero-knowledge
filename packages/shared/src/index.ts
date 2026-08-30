/**
 * Domain vocabulary for NightShift.
 *
 * Pure TypeScript. This package must never import the Midnight SDK, React, or
 * anything else — every other package depends on it, so it stays dependency-free.
 */

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/**
 * A person's public identity inside this contract. 32 bytes, hex, `0x`-prefixed.
 *
 * It is derived by hashing a secret that never leaves their device, so it
 * identifies them here without being their name or their wallet address.
 */
export type WorkerKey = string;

/**
 * A pay period, as `YYYY-MM`. Example: `"2026-03"`.
 *
 * Strings rather than dates because they sort correctly, compare exactly, and
 * survive a round trip through JSON without a timezone changing them.
 */
export type Period = string;

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * An amount of money in the smallest unit, as a `bigint`.
 *
 * Never a `number`. Floating point cannot represent money exactly, and this
 * value is compared against a cryptographic commitment — a rounding error of
 * one unit means the comparison fails and the payment cannot be confirmed.
 */
export type Amount = bigint;

// ---------------------------------------------------------------------------
// The sealed agreement
// ---------------------------------------------------------------------------

/**
 * Random 32 bytes, hex, `0x`-prefixed, generated once per offer.
 *
 * The salt is what makes a sealed rate unguessable. Without it, anyone could
 * try every plausible salary until the commitment matched.
 *
 * WARNING: a salt is a secret. It must never reach a server, a log, a URL, or
 * an analytics event. The `api` package handles salts for you — no UI code
 * should ever hold one.
 */
export type Salt = string;

/**
 * The sealed rate as stored on the blockchain: 32 bytes, hex, `0x`-prefixed.
 *
 * Anyone can read this value and nobody can work backwards from it to the
 * salary. It can only ever be opened by the exact rate and salt that created
 * it, which is what stops either side rewriting the agreement later.
 */
export type Commitment = string;

/**
 * A job offer. The employer creates it; the worker checks it and accepts.
 *
 * `rate` and `salt` are the private half — the employer passes them to the
 * worker directly (an offer letter, a message), not through the blockchain.
 * `commitment` is the public half that goes on-chain.
 */
export interface Offer {
  readonly workerKey: WorkerKey;
  /** Pay per period. For hourly workers this is the rate for ONE hour. */
  readonly ratePerPeriod: Amount;
  readonly salt: Salt;
  readonly commitment: Commitment;
  /** `1` for salaried and fixed-price work. Real hours for hourly workers. */
  readonly expectedHours: number;
}

// ---------------------------------------------------------------------------
// What the blockchain publicly records
// ---------------------------------------------------------------------------

/**
 * The state of one pay period.
 *
 * - `awaiting-hours`  — the employer has not approved a timesheet yet
 * - `awaiting-confirmation` — hours approved; the worker has not confirmed
 * - `confirmed`       — the worker proved the payment matched the sealed rate
 * - `unconfirmed`     — the period closed without a confirmation
 *
 * `unconfirmed` is the one that matters. It means the worker either was not
 * paid or was paid the wrong amount, and it stays on the public record.
 */
export type PeriodStatus =
  | 'awaiting-hours'
  | 'awaiting-confirmation'
  | 'confirmed'
  | 'unconfirmed';

/**
 * One period of one worker's history, exactly as a stranger reading the
 * blockchain would see it.
 *
 * Note what is absent: no salary, no payment amount, and nothing derived from
 * either. That absence is the product, so this type deliberately has nowhere
 * to put one.
 */
export interface PeriodRecord {
  readonly period: Period;
  readonly status: PeriodStatus;
  /** Approved hours, or `null` if the employer has not approved a timesheet. */
  readonly hours: number | null;
  /** True once someone proved the social-security declaration matched the real rate. */
  readonly contributionVerified: boolean;
}

/**
 * A worker's full public history — what an auditor sees without permission of
 * any kind, and what a future employer can be shown as proof of employment.
 */
export interface EmploymentRecord {
  readonly workerKey: WorkerKey;
  readonly active: boolean;
  /** First period ever confirmed. `null` if they have never confirmed one. */
  readonly joinedPeriod: Period | null;
  /** Most recent confirmed period. With `active: false`, this is the leaving date. */
  readonly lastConfirmedPeriod: Period | null;
  readonly periods: readonly PeriodRecord[];
}

/** A row in the employer's team list. Contains no salary, because nobody has it. */
export interface WorkerSummary {
  readonly workerKey: WorkerKey;
  readonly active: boolean;
  readonly confirmedPeriods: number;
  readonly unconfirmedPeriods: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** `"2026-03"` → `"March 2026"`, for display. */
export function formatPeriod(period: Period): string {
  const [year, month] = period.split('-');
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const index = Number(month) - 1;
  const name = names[index];
  return name ? `${name} ${year}` : period;
}

/** The period immediately after this one. `"2026-12"` → `"2027-01"`. */
export function nextPeriod(period: Period): Period {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Chronological sort key. Because periods are `YYYY-MM`, plain string order works. */
export function comparePeriods(a: Period, b: Period): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Design Tokens (for styling)
// ---------------------------------------------------------------------------

export { designTokens } from './design-tokens';
export type { DesignTokens } from './design-tokens';

// CSS: import '@nightshift/shared/globals.css' in each app's main.tsx
