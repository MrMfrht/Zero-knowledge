/**
 * Turns anything a `PayrollApi` call can reject with into a sentence an
 * employer can act on.
 *
 * Two constraints shape this file:
 *
 * 1. `NoWalletFoundError` and the "no wallet connected" guard both live in
 *    `packages/api/src/midnight/`, and neither is re-exported from
 *    `@nightshift/api`. An app may only import another package's published
 *    entry point, so `instanceof` is not available here — matching on the
 *    `name` the connector sets, and on the guard's message, is the only check
 *    that does not reach through the package boundary.
 * 2. `PayrollError` subclasses already carry wording written for a person
 *    (see the doc comments in `packages/api/src/errors.ts`, which call
 *    `PaymentMismatchError` "the product working"). Those pass through
 *    untouched rather than being reworded here.
 */
import { PayrollError } from '@nightshift/api';

export interface FailureExplanation {
  /** Ready to render as-is. Never a stack trace, never a developer message. */
  message: string;
  /**
   * True when the fix is "get a wallet in place", not "try again" — the
   * caller can use it to point at the Connect Wallet button instead of
   * styling the failure as a broken circuit.
   */
  isWalletProblem: boolean;
}

const INSTALL_A_WALLET =
  'No Midnight wallet extension was found in this browser. Install one (Lace or 1AM), ' +
  'refresh this page, then connect. Nothing was sent.';

const CONNECT_A_WALLET =
  'No wallet is connected. Use Connect Wallet in the header, then try again. Nothing was sent.';

const WALLET_DECLINED =
  'The wallet extension declined the request. Approve it in the wallet popup, then try again.';

/**
 * Print every link in an error's `cause` chain to the console.
 *
 * The returned message is deliberately free of stack traces and SDK
 * vocabulary, which is right for the person reading it and useless for
 * debugging a chain rejection. Worse, midnight-js wraps submission failures
 * as `new Error(\`...: ${String(err)}\`, { cause: err })` — and when the
 * inner error carries an empty message, as WASM-thrown and extension-thrown
 * errors do, that interpolation renders the entire cause as the bare word
 * "Error". Everything that identifies the failure survives only on `.cause`.
 *
 * So walk it. A Substrate rejection's `Custom error: N` code, a proof
 * failure, a wallet's own refusal — all of them live somewhere in this chain
 * and nowhere else.
 */
function logFailureChain(error: unknown): void {
  console.groupCollapsed('[NightShift] write failed — full error chain');
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 8; depth += 1) {
    if (current instanceof Error) {
      console.error(`#${depth} ${current.name}: ${current.message || '(empty message)'}`);
      if (current.stack) console.error(current.stack);
      current = (current as { cause?: unknown }).cause;
    } else {
      console.error(`#${depth} (non-Error)`, current);
      break;
    }
  }
  console.groupEnd();
}

export function explainPayrollFailure(error: unknown): FailureExplanation {
  logFailureChain(error);

  if (error instanceof PayrollError) {
    return { message: error.message, isWalletProblem: false };
  }

  if (error instanceof Error) {
    if (error.name === 'NoWalletFoundError') {
      return { message: INSTALL_A_WALLET, isWalletProblem: true };
    }
    if (error.message.startsWith('No wallet connected')) {
      return { message: CONNECT_A_WALLET, isWalletProblem: true };
    }
    // The extension owns this rejection and its wording varies per wallet, so
    // there is no error type to match on — only the person's intent to refuse.
    if (/reject|declin|denied|cancel/i.test(error.message)) {
      return { message: WALLET_DECLINED, isWalletProblem: true };
    }
    return { message: error.message, isWalletProblem: false };
  }

  return { message: String(error), isWalletProblem: false };
}
