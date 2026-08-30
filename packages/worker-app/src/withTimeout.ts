/**
 * Turn a write that never settles into a failure someone can read.
 *
 * A `PayrollApi` write resolves only once the indexer reports the transaction
 * on chain, and there are two phases before that where the promise can simply
 * stop. Proving is one. Balancing -- the wallet assembling fee inputs and
 * spending DUST -- is the other, and it is the quieter of the two: the proof
 * server log shows a completed circuit proof, the node's transaction pool
 * stays empty, and nothing rejects. The button spins forever and the person
 * is told nothing.
 *
 * That is not hypothetical. It is how the first browser hire failed, and how
 * the first browser `acceptHire` failed after it.
 *
 * A timeout cannot cancel the underlying work -- nothing here can un-submit a
 * transaction. It only stops the UI from lying about still trying, so the
 * message says the outcome is unknown rather than claiming nothing happened.
 */

/**
 * Generous on purpose. A write blocks on human approval, and Lace raises a
 * separate OS window per step -- one to unlock, another to prove -- which
 * routinely opens behind a maximised browser. Finding it takes as long as it
 * takes. Proving itself is fast, 1-3s against the local proof server, so
 * nearly all of this budget is spent waiting for a person.
 */
export const WRITE_TIMEOUT_MS = 300_000;

export class WriteTimeoutError extends Error {
  override readonly name = 'WriteTimeoutError';
  constructor(action: string) {
    super(
      `${action} did not finish within ${Math.round(WRITE_TIMEOUT_MS / 1000)} seconds. ` +
        'It is most likely waiting on the wallet: check for a Lace approval window behind ' +
        'this one, and check that the wallet still has DUST, which is what the balancing ' +
        'step spends. The transaction may still have been submitted, so check the chain ' +
        'before retrying.',
    );
  }
}

export async function withTimeout<T>(action: string, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new WriteTimeoutError(action)), WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
