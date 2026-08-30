/**
 * Step 0 of `tasks/THE-FLOW.md`: "the first time anyone opens app C or app D,
 * the api silently generates 32 random bytes ... and stores it in that
 * browser's local storage."
 *
 * This is the ONE secret this whole product depends on never leaving the
 * device. It is read here and handed to the contract's `localSk()` witness
 * (see `witnesses.ts`) — never logged, never sent anywhere, never returned
 * from any method on this class.
 */

import { bytesToHex, hexToBytes } from './encoding.js';

/**
 * Exported so Node tooling and tests can seed a storage with a known secret
 * instead of hardcoding this string in a second place. Nothing in the apps
 * should need it.
 */
export const LOCAL_SECRET_STORAGE_KEY = 'nightshift:localSk';
const STORAGE_KEY = LOCAL_SECRET_STORAGE_KEY;

function randomSecret(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Returns this browser's 32-byte secret, generating and persisting one the
 * first time it's asked for. Stored as hex in `localStorage` — plain
 * `localStorage`, not encrypted, matching the storage decision recorded in
 * `A_docs/05-keys-storage-and-identity.md` for this hackathon's timeline.
 */
export function getOrCreateLocalSecret(storage: Storage = window.localStorage): Uint8Array {
  const existing = storage.getItem(STORAGE_KEY);
  if (existing) {
    return hexToBytes(existing);
  }
  const secret = randomSecret();
  // Bare hex, no `0x` — this is a storage value, not a domain `WorkerKey`.
  storage.setItem(STORAGE_KEY, bytesToHex(secret).slice(2));
  return secret;
}
