/**
 * The witness implementations — the TypeScript half of the contract.
 *
 * payroll.compact declares `witness localSk(): Bytes<32>` with no body. That is
 * deliberate: the contract asks for a 32-byte secret and refuses to say where it
 * comes from, because the answer differs by environment (browser storage, test
 * fixture, CLI wallet). This file is the default answer: read it from the
 * private state the caller was constructed with.
 *
 * The secret never leaves the machine this runs on. It is handed to the circuit,
 * used inside the proof, and discarded. Only the proof travels.
 *
 * See A_docs/02 (the deliberate hole) and A_docs/03 (why lying here does not
 * help — the circuit hashes whatever this returns and compares).
 */

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/contract/index.js';

/**
 * Everything private to one participant. Today that is a single secret; salts
 * for the sealed rate live in the api package's private-state store, because
 * only the api knows which worker's salt is needed for which call.
 */
export interface PayrollPrivateState {
  /** The caller's 32-byte secret. Their public key is persistentHash of this. */
  readonly secretKey: Uint8Array;
}

export function createPayrollPrivateState(secretKey: Uint8Array): PayrollPrivateState {
  // A wrong-length secret would not error here or in the circuit — it would
  // just hash to a key that matches nothing, which is confusing to debug.
  if (secretKey.length !== 32) {
    throw new Error(`secretKey must be exactly 32 bytes, got ${secretKey.length}`);
  }
  return { secretKey };
}

/**
 * The object the generated Contract class demands in its constructor:
 *
 *   new Contract(witnesses)
 *
 * Each witness receives the current private state and returns a pair of
 * [possibly-updated private state, the requested value]. localSk changes
 * nothing, so it hands the state straight back.
 */
export const witnesses = {
  localSk: ({
    privateState,
  }: WitnessContext<Ledger, PayrollPrivateState>): [PayrollPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
};
