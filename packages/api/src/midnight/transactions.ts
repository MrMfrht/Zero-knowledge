import type { BalancingRecipe, WalletFacade } from '@midnight-ntwrk/wallet-sdk';

/**
 * Submits a balancing recipe and guards against a known wallet-SDK bug:
 * when a transaction is submitted but never confirms — a failed deploy, a
 * dropped connection, a rejected circuit call — the DUST coins it reserved
 * stay marked "pending" in the wallet's local state and are never released.
 * The documented workaround is to restart the whole process
 * (`.agents/skills/midnight-js/SKILL.md`, "DUST = 0 after failed deploy").
 *
 * `wallet.revert()` is the SDK's own release mechanism for exactly this case
 * — it walks the shielded, unshielded, and DUST sub-wallets and clears the
 * pending-transaction tracker for the given recipe (see
 * `wallet-sdk-facade/dist/index.js`, `revertTransaction`). Calling it on
 * every failure path here means a failed submission degrades to "try again",
 * not "the DApp needs restarting" — this is what every deploy and circuit
 * call in `MidnightPayrollApi` should go through instead of calling
 * `finalizeRecipe`/`submitTransaction` directly.
 *
 * `waitForConfirmation` is optional and caller-supplied because "confirmed"
 * means something different per call: SPIKE-PAY watched a shielded balance
 * increase, a circuit call would watch for its expected ledger-state effect.
 * This helper only owns the failure-handling shape, not what confirmation
 * looks like for a particular circuit.
 */

export interface SubmitAndConfirmOptions<T> {
  /**
   * Wait for the transaction's real-world effect before considering it done
   * — e.g. poll ledger state for the circuit's expected change. Omit to
   * resolve as soon as the node accepts the submission.
   */
  waitForConfirmation?: (txId: string) => Promise<T>;
  /** Ceiling for `waitForConfirmation`, in ms. Default 60_000. */
  confirmTimeoutMs?: number;
}

export interface SubmitAndConfirmResult<T> {
  txId: string;
  confirmation: T | undefined;
}

class ConfirmationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Transaction was not confirmed within ${timeoutMs}ms`);
    this.name = 'ConfirmationTimeoutError';
  }
}

/** Reverts and swallows any error from the revert itself — the original failure is what matters to the caller. */
async function revertSafely(wallet: WalletFacade, recipe: BalancingRecipe): Promise<void> {
  try {
    await wallet.revert(recipe);
  } catch {
    // A revert failure here must never mask the real error that triggered it.
    // Worst case the coins stay locked and the known SDK issue's own
    // documented fallback (restart the process) still applies.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ConfirmationTimeoutError(timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Finalize, submit, and (optionally) confirm a `BalancingRecipe` as one
 * guarded unit. Every failure path reverts the recipe before rethrowing, so
 * a caller can retry immediately instead of needing a process restart.
 */
export async function submitAndConfirm<T = never>(
  wallet: WalletFacade,
  recipe: BalancingRecipe,
  options: SubmitAndConfirmOptions<T> = {},
): Promise<SubmitAndConfirmResult<T>> {
  const { waitForConfirmation, confirmTimeoutMs = 60_000 } = options;

  const finalized = await wallet.finalizeRecipe(recipe).catch(async (err: unknown) => {
    await revertSafely(wallet, recipe);
    throw err;
  });

  const txId = await wallet.submitTransaction(finalized).catch(async (err: unknown) => {
    await revertSafely(wallet, recipe);
    throw err;
  });

  if (!waitForConfirmation) {
    return { txId, confirmation: undefined };
  }

  const confirmation = await withTimeout(waitForConfirmation(txId), confirmTimeoutMs).catch(
    async (err: unknown) => {
      await revertSafely(wallet, recipe);
      throw err;
    },
  );

  return { txId, confirmation };
}
