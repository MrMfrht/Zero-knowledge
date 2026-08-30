/**
 * Turn a write that never settles into a failure someone can read.
 *
 * A `PayrollApi` write resolves only once the indexer reports the transaction
 * on chain. If the node rejects it, the indexer never sees it and the promise
 * neither resolves nor rejects -- the button spins forever and the person is
 * told nothing. That is not hypothetical: it is exactly how the first
 * browser-initiated hire failed, with a successful proof in the proof server
 * log and an empty ledger.
 *
 * A timeout cannot cancel the underlying work -- nothing here can un-submit a
 * transaction. It only stops the UI from lying about still trying. So the
 * message is careful to say the outcome is unknown rather than claiming
 * nothing happened.
 */
export const WRITE_TIMEOUT_MS = 90_000;

export class WriteTimeoutError extends Error {
  override readonly name = 'WriteTimeoutError';
  constructor(action: string) {
    super(
      `${action} did not complete within ${Math.round(WRITE_TIMEOUT_MS / 1000)} seconds. ` +
        'The transaction may still have been submitted — check the chain before retrying, ' +
        'because a hire that did land cannot be sent a second time.',
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

/** A WorkerKey is a 32-byte `dappKey`, so 64 hex characters — never 40. */
export function assertWorkerKey(value: string): string {
  const trimmed = value.trim();
  const bare = trimmed.replace(/^0x/, '');
  if (bare.length === 0) {
    throw new Error("Enter the worker's identity key. It is shown in the header of their app.");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(bare)) {
    throw new Error(
      `A worker key is 64 hex characters (32 bytes); this one is ${bare.length}. ` +
        "Copy it from the worker app's header, which shows the full value.",
    );
  }
  return `0x${bare.toLowerCase()}`;
}
