# SPIKE-PAY — can a wallet send another wallet a private payment?

**Status: ✅ CONFIRMED WORKING.** Wallet-to-wallet shielded (private) payments of the native NIGHT token work end-to-end. The plan is confirmed — proceed to Step 2 of [tasks/02-integration.md](../../tasks/02-integration.md).

---

## The answer

**Yes.** A wallet holding shielded NIGHT can send a shielded transfer directly to another wallet, and the receiver's wallet detects the funds arriving — no contract involved, no manual "shielding" step, using the documented `wallet.transferTransaction()` API exactly as the docs describe.

Confirmed by direct test on the local devnet (`midnight-local-dev`, node/indexer/proof-server all pinned per [tasks/02-integration.md](../../tasks/02-integration.md)'s compatibility matrix):

```
Master shielded balance: 250000000000000
Bob shielded balance (before): 0
Sending 1000 SHIELDED NIGHT from master to Bob...
Shielded transfer submitted: 006da1360f3009ff3008c916e1b931a9f23ad2fe43d35536771165c31d8a7e991a
Bob shielded balance: 1000
SPIKE-PAY RESULT: SUCCESS. Bob's shielded balance: 0 -> 1000
```

## The working code

```ts
const recipe = await sender.wallet.transferTransaction(
  [{
    type: 'shielded',
    outputs: [{ type: nativeToken().raw, receiverAddress: recipientShieldedAddress, amount }],
  }],
  { shieldedSecretKeys: sender.shieldedSecretKeys, dustSecretKey: sender.dustSecretKey },
  { ttl },
);
const finalized = await sender.wallet.finalizeRecipe(recipe); // shielded outputs skip signRecipe
const txId = await sender.wallet.submitTransaction(finalized);
```

`recipientShieldedAddress` is `state.shielded.address` read directly from the recipient's own synced wallet state (a `ShieldedAddress` object, not the bech32 string).

## The dead end that looked like a failure, and wasn't

The first attempt (documented below for anyone hitting the same thing) used two fresh test wallets — Alice and Bob — funded only through `midnight-local-dev`'s funding CLI, and failed with `Wallet.InsufficientFunds` thrown by the *shielded* wallet module specifically.

**Root cause:** the funding CLI's `transferNight()` helper (`midnight-local-dev/src/funding.ts`) only ever sends **unshielded** NIGHT. Alice had 50,000 NIGHT unshielded and exactly 0 shielded — there was nothing to fund a shielded output with. This is not a protocol limitation; it's a gap in that specific funding tool.

**How this was found:** checking `wallet.transferTransaction` (shielded output, no shielded input → `InsufficientFunds`) and `wallet.initSwap` (its actual implementation, `wallet-sdk-facade/dist/index.js`, routes a shielded output through `shielded.initSwap` fed only by `desiredInputs.shielded` — never `.unshielded` — so it doesn't cross-convert either) ruled out both wallet-level primitives as the source of the missing funds. That raised the real question: does NIGHT even have a shielded form at all, or is shielding reserved for contract-minted custom tokens?

The ledger types looked like they answered "NIGHT is unshielded-only" — `nativeToken(): UnshieldedTokenType` — but the docs ([tokens/overview](https://docs.midnight.network/tokens/overview)) explicitly and repeatedly state *"Both NIGHT and custom tokens can move between shielded and unshielded state."* Trusting the doc over the inference, checking the **genesis master wallet** directly (seed `0000...0001`, the one `midnight-local-dev` uses internally) settled it:

```
MASTER unshielded=249900000000000 shielded=250000000000000
```

The master wallet holds real shielded NIGHT, pre-seeded at genesis — roughly half its total balance in each form. `nativeToken()` just returns the *default/unshielded-tagged* descriptor for the NIGHT color for convenience (fee payment, DUST generation); the same raw color can be held and transferred in shielded form too, exactly as the docs said.

**Lesson for the team:** any wallet needs an existing shielded balance to *send* shielded value — a wallet with only unshielded NIGHT cannot originate a shielded payment. For the demo, either fund the employer's wallet with shielded NIGHT directly (not through the funding CLI's unshielded-only path), or the employer's very first payment needs a preceding step to acquire shielded funds. Worth flagging to whoever wires up the demo's wallet funding.

## What this means for the project

The plan holds as originally designed. No fallback to unshielded payments needed. Continue to Step 2: build the real `PayrollApi` implementation in `packages/api/src/midnight/`.

---

*Investigation and test script: `midnight-local-dev/spike-pay.ts` (local, not committed to that repo — ask B for the working script if reproducing this).*
