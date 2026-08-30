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

## ✅ Your PR #3 is merged, and the payWorker gap is closed

`MidnightPayrollApi` is on `dev`, and the two `dappKey` call sites were migrated
for you (see the breaking-change note below). Two further things changed in code
you wrote — both were gaps you had flagged honestly in your own comments:

**`payWorker` now takes the recipient's shielded address.** Your comment was
right that a `WorkerKey` is not somewhere money can be sent and that nothing
on-chain maps between them. The interface now carries it explicitly:

```ts
payWorker({ workerKey, recipientShieldedAddress, amount, onStatus? })
```

with a matching `getMyShieldedAddress()` that returns
`getShieldedAddresses().shieldedAddress`. That field does exist on the connector
— the type is `{ shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey }`,
all Bech32m — so your `payment.ts` comment was accurate.

**`payWorker` now stops at `'pending'` rather than reporting `'confirmed'`.**
Your `waitForPaymentConfirmed` note explains why there is no txId to correlate
against; claiming `'confirmed'` was the one place the code asserted something it
could not observe.

Your `payment.ts` was checked line by line against the connector's published
types and the official docs, and matches exactly — including the `void` return
from `submitTransaction`. Nothing in it needed changing.

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

### 1. ✅ `MidnightPayrollApi` — done, and all three apps run on it

Five of the six circuits have now run through the real class against the local
devnet, in sequence, on a real contract. `payWorker` is the exception and is
covered below.

```bash
docker compose -f docker/compose.yml up -d
cd packages/api
npx tsx src/midnight/deploy.ts --contribution-pct 25       # prints an address
npx tsx src/midnight/demo-lifecycle.ts --contract <address>
npx tsx src/midnight/inspect.ts <address>                  # read it back
```

`demo-lifecycle.ts` drives hire → acceptOffer → approveHours → confirmPayment →
proveContribution → endEmployment with two identities over one wallet. It
defaults to 85/h × 160h rather than a flat salary, because `hours != 1` is what
catches the mistake it was first written with: the circuit pays `hours * rate`,
not `rate`, and it reads `hours` from where the *employer* put it precisely so a
worker cannot inflate the claim.

Two things that were needed to make the class runnable outside a browser, both
narrow and both documented at their definitions:

- `MidnightPayrollApiOptions.storage` — Node has no `window.localStorage`.
- `connectWithProviders()` — Node tooling builds the six providers over a
  headless wallet. **Apps must still use `connectWallet()`** so keys stay in the
  extension. Anything calling `connectWithProviders` is holding a secret key by
  definition, which is why it is tooling-only.

**Reading periods back** needed `periodKey`, which `payroll.compact` does not
export — `packages/api/src/midnight/periodKey.ts` reimplements it from the
compiled bindings and `demo-lifecycle.ts` asserts the round trip, so a drifted
encoding fails the run instead of quietly reporting "never employed". Exporting
it from the contract would make that file a one-line re-export; worth doing next
time the contract is recompiled.

### 1b. ✅ C, D and E are wired to the chain

`createPayrollApi()` in `@nightshift/api` is the only place that chooses mock or
chain, so the three apps cannot disagree. Set `VITE_CONTRACT_ADDRESS` in an
app's `.env.local` and it is live; leave it out and it is the mock. Every app
shows which on screen — see `.env.example` in each app directory.

Verified in a browser against `d2e8d3be…e18a851e`: the auditor board lists the
worker and their confirmed April 2026 with no wallet at all, the employer
directory shows 1 confirmed period, and the worker app shows *160 hrs, Confirmed
Paid, 25% Verified* with the salary reading `[ HIDDEN / NONE ]`.

For the worker app to *be* a worker the scripts hired, `VITE_DEV_DEVICE_SECRET`
seeds the browser's device secret. It is refused on any network but
`undeployed` — it overwrites the one value the whole privacy model depends on
being generated locally, so it exists for the devnet demo and nowhere else.

### 2. ✅ The deploy script — done, and it works

`deploy.ts` completed end-to-end against the local devnet on 2026-08-30. There
is now a devnet to run it against (`docker/compose.yml`) and a companion
`inspect.ts` that reads the deployed ledger back off the indexer, so "it
printed an address" can be checked rather than believed.

```bash
docker compose -f docker/compose.yml up -d   # wait for all three healthy
npm run typecheck -w @nightshift/api
cd packages/api && npx tsx src/midnight/deploy.ts --contribution-pct 25
```

Then, with the address it prints:

```bash
cd packages/api && npx tsx src/midnight/inspect.ts <address>
```

That last one printed `contributionRate 25%` and a populated `deploymentId`,
which is what confirms the two-argument constructor survived the merge. E can
take the address for the auditor's indexer queries; C and D can point at it.

Your two open questions from the branch are both answered:

- **`availableCoins` empty while `balances` was non-zero** — not a sync bug.
  It was the duplicated `ledger-v8` (below): the coins were being decoded by a
  different copy of the WASM than the one being queried. With one copy on
  disk, the run reports `total=5 available=5 pending=0`.
- **`additionalFeeOverhead`** — your `1_000n` is what deployed successfully,
  so it stays. The midnight-js skill's `300_000_000_000_000n` was not needed
  here; leaving it unchanged rather than raising it on speculation.

#### Two traps this cost real time on — please read before your next install

**Your `overrides` pin needs the lockfile deleted to take effect.** Adding
`"overrides": { "@midnight-ntwrk/ledger-v8": "8.1.1" }` to the root
`package.json` and running `npm install` does *nothing* if `package-lock.json`
already pins a nested copy — npm honours the existing resolution. Worse, npm 11
does not write an `overrides` block into the lockfile root, so grepping the
lockfile to check whether the pin "took" tells you nothing either way. The fix:

```bash
rm package-lock.json && npm install
```

Until that is done you get **two copies of `ledger-v8`** and errors like
`Error: expected instance of DustParameters` — two structurally identical WASM
classes from different module instances failing an `instanceof`. Verify with:

```bash
find node_modules -type d -name ledger-v8 -not -path "*/ledger-v8/*"
```

One line of output is correct. Two means the override has not applied.

**Windows: `new URL(...).pathname` is not a filesystem path.** It yields
`/C:/Users/...`, with a leading slash `fs` cannot open, so `zkConfigPath`
silently pointed nowhere. Use `fileURLToPath`. Half this team is on Windows.

`docker/compose.yml`'s header documents two more Windows-only traps (Git Bash
path mangling, and Docker Desktop's containerd image store unpacking the
midnight-node image as zero-byte files). Worth reading before you spend an
afternoon on either.

### 3. `payWorker` — the one circuit still unexercised

It moves real funds through the browser wallet's `sendPrivatePayment`, which
needs a `ConnectedAPI` that only exists in a page with an extension. Nothing in
the headless path can stand in for it. `confirmPayment` in `demo-lifecycle.ts`
is the worker asserting an amount arrived; **no transfer actually happens** in
that script, and the file header says so rather than implying coverage.

### 4. Payment confirmation tracking — your honestly-flagged gap

`submitTransaction` returns no txId; the `identifiers()` path needs the blob's
byte encoding, which the docs do not state. You left an explicit `throw` rather
than guessing — right call. Resolving it needs a real wallet extension
(Lace / 1AM) to test against. Not urgent: the interface already treats txId as
optional, so nothing downstream is waiting on this.

### 5. New question, from the storage decision

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
