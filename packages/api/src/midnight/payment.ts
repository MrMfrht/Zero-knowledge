/**
 * Wallet-to-wallet private payment via the DApp Connector API.
 *
 * Per tasks/04-employer-app.md: "The money goes wallet to wallet, privately.
 * It does not go through the smart contract at all." This is why the send
 * side lives here, calling `ConnectedAPI.makeTransfer` directly, rather than
 * going through `@midnight-ntwrk/midnight-js-contracts` (that package is for
 * circuit calls — `hire`, `approveHours`, etc. — which do touch a contract).
 *
 * IMPORTANT — this file is NOT the same wallet surface as
 * `packages/api/src/midnight/transactions.ts` (`submitAndConfirm`). That
 * helper is written against `WalletFacade` (`@midnight-ntwrk/wallet-sdk`),
 * the headless/testkit pattern used for SPIKE-PAY and any Node-side script.
 * `ConnectedAPI` (from `walletConnector.ts`, a real browser wallet
 * extension) has no `finalizeRecipe`/`revert` — its `submitTransaction`
 * returns `void`, not a txId. Do not reuse `submitAndConfirm` here; the two
 * wallet surfaces are genuinely different shapes.
 */
import type { ConnectedAPI, DesiredOutput } from '@midnight-ntwrk/dapp-connector-api';
import { nativeToken } from '@midnight-ntwrk/ledger-v8';

export interface SendPrivatePaymentParams {
  /** The worker's shielded address (Bech32m), as returned by their own `getShieldedAddresses()`. */
  recipientShieldedAddress: string;
  /** Amount in NIGHT's smallest unit. */
  amount: bigint;
}

/**
 * Builds and submits a shielded NIGHT transfer.
 *
 * Confirmed against the real `@midnight-ntwrk/dapp-connector-api` 4.0.1
 * types: `makeTransfer` takes `DesiredOutput[]` and returns `{ tx: string }`
 * (an unsubmitted, wallet-built transfer transaction); `submitTransaction`
 * takes that string and resolves once the wallet has relayed it — but
 * resolves to `void`, giving us no txId back directly.
 *
 * Per the SPIKE-PAY finding: the sending wallet must already hold shielded
 * NIGHT. A wallet with only unshielded NIGHT will fail here with whatever
 * error the extension surfaces for insufficient shielded funds — that is
 * expected, not a bug in this function.
 */
export async function sendPrivatePayment(
  connectedApi: ConnectedAPI,
  params: SendPrivatePaymentParams,
): Promise<void> {
  const output: DesiredOutput = {
    kind: 'shielded',
    type: nativeToken().raw,
    value: params.amount,
    recipient: params.recipientShieldedAddress,
  };

  const { tx } = await connectedApi.makeTransfer([output]);
  await connectedApi.submitTransaction(tx);
}

/**
 * NOT YET IMPLEMENTED — confirmation tracking.
 *
 * `submitTransaction` gives no txId, so there is no confirmed way yet to
 * correlate a submitted transfer with a specific `getTxHistory()` entry.
 * `Transaction.transactionHash()` exists (ledger-v8) but its own doc
 * explicitly warns against using it to watch for a specific transaction —
 * "due to the ability to merge transactions" — and recommends
 * `identifiers()` instead. Getting there requires deserializing the `tx`
 * string with `Transaction.deserialize('signature', 'proof', 'binding',
 * rawBytes)` (marker convention confirmed via the "Failed to clone intent"
 * workaround in .agents/skills/midnight-js/SKILL.md §8), but the exact byte
 * encoding of the `tx` string (hex vs base64) is NOT stated anywhere in the
 * DApp Connector API's own types or docs I could find — guessing it here
 * would be exactly the kind of invented fact CLAUDE.md warns against.
 *
 * Needs verification against a real wallet extension (Lace/1AM) before
 * `payWorker`'s `onStatus` can report a real `'confirmed'` stage. Until
 * then, `payWorker` should report `'pending'` after a successful
 * `sendPrivatePayment` and stop there, rather than fabricate a txId.
 */
export function waitForPaymentConfirmed(): never {
  throw new Error(
    'waitForPaymentConfirmed is unimplemented — see the doc comment above this function.',
  );
}
