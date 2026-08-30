/**
 * Persists a sealed offer's rate and salt on the employer's own device, so a
 * UI failure cannot destroy them.
 *
 * `hire` seals `persistentCommit(rate, salt)` into `agreedRate`, and the
 * contract refuses to ever overwrite that row -- `assert(!agreedRate.member(w))`.
 * The salt is 32 random bytes, and the commitment on chain is a hash, so a
 * lost salt cannot be recomputed, brute-forced, or recovered from the ledger.
 * The worker then can never call `acceptHire`, and the employer can never
 * re-hire them. One dropped promise permanently burns a worker key.
 *
 * That is exactly what happened on the first browser-driven hire: the
 * transaction landed, and the React state update that was the only copy of
 * the salt never ran. So the write happens BEFORE the transaction is
 * submitted, not after it succeeds -- a remembered offer for a transaction
 * that later failed is harmless clutter, while the reverse is unrecoverable.
 *
 * This is device-local storage of a secret that was already device-local.
 * Nothing here crosses a network boundary; the salt must reach the worker
 * out-of-band, exactly as before (see `MidnightPayrollApi.hire`'s note).
 */
import type { Amount, WorkerKey } from '@nightshift/shared';

const STORAGE_KEY = 'nightshift:sealedOffers';

export interface RememberedOffer {
  readonly workerKey: WorkerKey;
  /** Decimal string: `JSON.stringify` cannot represent a `bigint`. */
  readonly ratePerPeriod: string;
  readonly salt: string;
  readonly commitment: string;
  readonly expectedHours: number;
  /** ISO-8601, for telling two offers to the same worker apart by eye. */
  readonly sealedAt: string;
}

function readAll(storage: Storage): RememberedOffer[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RememberedOffer[]) : [];
  } catch {
    // A corrupt vault must not take the app down with it. Returning empty
    // loses nothing that was not already unreadable.
    return [];
  }
}

/** Call before submitting the hire transaction, never after. */
export function rememberOffer(
  offer: Omit<RememberedOffer, 'sealedAt'> & { sealedAt?: string },
  storage: Storage = window.localStorage,
): void {
  const existing = readAll(storage).filter((o) => o.workerKey !== offer.workerKey);
  existing.push({ ...offer, sealedAt: offer.sealedAt ?? new Date().toISOString() });
  storage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

/** Every offer this device has sealed, newest last. */
export function listRememberedOffers(storage: Storage = window.localStorage): RememberedOffer[] {
  return readAll(storage);
}

/** The offer for one worker, or null. */
export function recallOffer(
  workerKey: WorkerKey,
  storage: Storage = window.localStorage,
): RememberedOffer | null {
  return readAll(storage).find((o) => o.workerKey === workerKey) ?? null;
}

/** Parsed back into the shape `acceptOffer` wants. */
export function recallOfferAmount(offer: RememberedOffer): Amount {
  return BigInt(offer.ratePerPeriod);
}
