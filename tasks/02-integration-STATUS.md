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

## 🔴 Breaking change, 2026-08-30 — two lines in your branch

A privacy review found that `dappKey` had no per-deployment component, so one
worker showed the **same** public key to every employer running NightShift, and
two employers could join their public ledgers and discover a shared worker.
Fixed by mixing a per-deployment random value into every identity. Details in
[A_docs/06 question 12](../A_docs/06-open-design-questions.md).

Sorry — this lands on code you had already written and got right. Two changes:

**1. `dappKey` now takes two arguments.** In
`packages/api/src/midnight/MidnightPayrollApi.ts:111`:

```ts
// was
return bytesToHex(pureCircuits.dappKey(this.secret));
// now — deploymentId is a public sealed field, read it from the ledger
return bytesToHex(pureCircuits.dappKey(this.secret, deploymentId));
```

`deploymentId` is `export sealed ledger deploymentId: Bytes<32>`, so it comes
back from `ledger(state).deploymentId` like any other public field. Worth
caching once per contract rather than re-reading on every `getMyKey()`.

**2. The constructor now takes a second argument.** In
`packages/api/src/midnight/deploy.ts:221`:

```ts
// was
args: [args.contributionPct],
// now
args: [args.contributionPct, crypto.getRandomValues(new Uint8Array(32))],
```

**This must be 32 fresh random bytes, every deployment.** A constant, or a value
copied between deployments, silently restores the exact leak this fixes. It is
the one way to get this wrong, so it is worth a comment in the deploy script.

Everything else in your branch is unaffected — and your circuit call signatures
were already correct against the real bindings, including the ones the api
README had documented wrongly. Nicely done.

---

## 🔓 You are now unblocked — the contract is on `dev`

This is the news. Everything `MidnightPayrollApi` needs from A now exists:

| | Where |
|---|---|
| Compiled contract — TS bindings + ledger types | `packages/contract/src/managed/contract/` |
| Circuits compiled | **All six** — plus exported `pureCircuits.dappKey(sk, deploymentId)` and `pureCircuits.sealRate(rate, salt)`, which are exactly the helpers your api needs. The constructor takes `(contributionPct, deployment)` — see the breaking-change note above |
| **`witnesses.ts`** — supplies `localSk`, storage-agnostic | `packages/contract/src/witnesses.ts` |
| Proof it all runs | `npm run smoke -w @nightshift/contract` — the whole lifecycle over two periods, plus every rejection |
| The map of who calls what | [`A_docs/07-circuit-map.md`](../A_docs/07-circuit-map.md) |

**Two signatures worth checking against the bindings before you write them**,
because they are easy to guess wrong:

- `confirmPayment(period, rate, salt, amountReceived)` — **`hours` is not an
  argument.** The circuit reads it from the ledger, which is what stops a worker
  inflating their own timesheet. If you pass hours, it will not compile.
- `proveContribution(period, rate, salt, declared)` — and the check is against
  real earnings, `declared × 100 == hours × rate × pct`, not against the bare
  rate. For salaried workers (`hours = 1`) those coincide; for hourly workers
  they do not. `MockPayrollApi` now does exactly this too, so the mock and the
  chain agree.

`approveHours` is also **write-once** as of 2026-08-30 — approving a period that
already has hours is rejected. If your UI lets an employer edit an approved
timesheet, that call will fail on-chain; surface it as a real error rather than
retrying.

Construct with:

```ts
import { Contract, ledger, pureCircuits } from '@nightshift/contract/src/managed/contract/index.js';
import { witnesses, createPayrollPrivateState } from '@nightshift/contract/src/witnesses.ts';

const contract = new Contract(witnesses);
```

Note the second import ends in `.ts`, not `.js`: the contract package ships no
build step, so `witnesses.ts` exists only as source. Vite and `tsx` resolve that
fine. Plain `node` will not — which is why `smoke.mjs` inlines the one-line
witness instead of importing it. If you would rather import it everywhere,
say so and A will add a build to the contract package.

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
