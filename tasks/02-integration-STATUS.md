# Task B — where you are, and what is next

*Status as of 30 August 2026, written by the lead after merging your PRs and the
contract into `dev`. Your original brief is [02-integration.md](02-integration.md);
this file is the living version. `git pull origin dev` before reading further —
everything below refers to what is on `dev` now.*

---

## ✅ What you have finished

Genuinely strong output — the riskiest unknown in the project is resolved, and
three working building blocks are merged.

| Done | Where it lives | Why it mattered |
|---|---|---|
| **SPIKE-PAY — passed** | `packages/api/SPIKE-PAY.md` | The project's kill switch. Shielded wallet-to-wallet transfer works end-to-end on the local devnet, verified down to the coin's raw color matching `nativeToken()` byte-for-byte. The whole payment design stands because of this |
| **`walletConnector.ts`** | `packages/api/src/midnight/` | Browser wallet connection via the DApp Connector API — enumerate `window.midnight`, connect, verify address |
| **`payment.ts`** | `packages/api/src/midnight/` | `sendPrivatePayment()` — the real wallet-to-wallet payment, bypassing the contract as designed |
| **`transactions.ts` + 7 tests** | `packages/api/src/midnight/` | `submitAndConfirm` with revert-on-failure, dodging the "DUST=0 after failed deploy" restart bug |
| **Interface additions** — signed off and merged | `PayrollApi.ts` | `connectWallet` / `disconnectWallet` / `getWalletStatus` / `payWorker` + `onStatus` lifecycle. The mock implements all of it, so C and D are building transaction UX against it right now |
| **Version-drift catches** | `versions.json`, `package.json` | `midnight-js` 4.0.4→4.1.1 and `ledger-v8` 8.0.3→8.1.1, both confirmed against the official matrix. Exactly the discipline the rule book asks for |

One sign-off note from the merge: `payWorker` now returns `Promise<{ txId?: string }>`
— optional, because your own `payment.ts` honestly cannot produce one. The README
documents it so D never builds UI that waits for a txId.

---

## 🔓 You are now unblocked — the contract is on `dev`

This is the news. Everything `MidnightPayrollApi` needs from A now exists:

| | Where |
|---|---|
| Compiled contract — TS bindings + ledger types | `packages/contract/src/managed/contract/` |
| Circuits compiled | **All six** — plus exported `pureCircuits.dappKey(sk)` and `pureCircuits.sealRate(rate, salt)`, which are exactly the helpers your api needs. Note: the constructor now takes `contributionPct` (e.g. `25n`) |
| **`witnesses.ts`** — supplies `localSk`, storage-agnostic | `packages/contract/src/witnesses.ts` |
| Proof it all runs | `npm run smoke -w @nightshift/contract` — deploys locally, hires as employer, rejects a stranger |
| The map of who calls what | [`A_docs/07-circuit-map.md`](../A_docs/07-circuit-map.md) |

Construct with:

```ts
import { Contract, ledger } from '@nightshift/contract/src/managed/contract/index.js';
import { witnesses, createPayrollPrivateState } from '@nightshift/contract/src/witnesses.js';

const contract = new Contract(witnesses);
```

Read `smoke.mjs` in the contract package first — it is a working example of
constructing the contract, building contexts, and calling a circuit.

> ⚠️ **The committed `managed/` is a `--skip-zk` build.** Types and bindings are
> real; **proving keys are absent**, so you can wire and typecheck everything but
> not generate a real proof yet. Ping the lead when you need the full build — it
> is one slow compile away.

---

## ⏳ What is still yours, in priority order

### 1. `MidnightPayrollApi` — the main deliverable

The class that implements `PayrollApi` against the real contract, so C, D and E
swap the mock for the real thing by changing one line. Nothing else on this list
matters until this exists.

Your spec is the ["For B" section of the api README](../packages/api/README.md)
— method-to-circuit mapping, which error class to throw for each assert failure,
and your definition of done. **All six circuits now compile**, so nothing needs
stubbing. `smoke.mjs` exercises the complete lifecycle including every failure
case — it is your worked example for contexts, state threading between calls
(`r.context.currentQueryContext.state`), and per-caller private state.

### 2. The deploy script

One command that deploys to the local devnet and prints the contract address.
E needs the address for the auditor's indexer queries; C and D need it to point
their apps at something real.

### 3. Payment confirmation tracking — your honestly-flagged gap

`submitTransaction` returns no txId; the `identifiers()` path needs the blob's
byte encoding, which the docs do not state. You left an explicit `throw` rather
than guessing — right call. Resolving it needs a real wallet extension
(Lace / 1AM) to test against. Not urgent: the interface already treats txId as
optional, so nothing downstream is waiting on this.

### 4. New question, from the storage decision

We decided secrets live in local storage for now
([A_docs/05](../A_docs/05-keys-storage-and-identity.md)). The upgrade path ends
at **deriving `localSk` from the wallet seed phrase** — which solves recovery for
free, *if* the DApp Connector exposes anything usable for it.

**Can it?** Nobody knows. You are the person who can find out. A one-paragraph
answer (yes / no / how) into
[A_docs/06, question 5](../A_docs/06-open-design-questions.md) settles it.

---

## The one process note

From the merge: **PR #2 contained PR #1** — branching off your own unmerged work
takes the base with it, which is why "merge #2 whenever" was not safe. Both are
now in `dev` via a single merge, so nothing to fix — just branch new work off
`dev` from here.

And the standing rule, unchanged: found something `PayrollApi` cannot express?
**Report it with specifics rather than bending the interface** — the lead edits
the interface, the mock and the README together. Your txId case is the worked
example of exactly that going well.
