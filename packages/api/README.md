# `@nightshift/api` — how to use it

This is the only package that talks to the blockchain. Your app talks to this.

**You never import `@midnight-ntwrk/*`. You never touch a salt. You call the methods below.**

There are two implementations behind one interface:

| | What it is | Use it |
|---|---|---|
| `MockPayrollApi` | Runs in memory. No blockchain, no wallet, no network. | **Today.** Build your whole app on it. |
| `MidnightPayrollApi` | The real one, on the contract. B is building it. | Later. |

They behave the same. When B is finished you **change one line** — the line that creates the object — and nothing else in your app changes.

---

## Quick start

```bash
npm install          # from the repo root, once
npm run build        # builds shared + api
```

```ts
import { MockPayrollApi, DEMO_KARIM } from '@nightshift/api';

const api = new MockPayrollApi({ actingAs: DEMO_KARIM });

const record = await api.getEmploymentRecord(DEMO_KARIM);
console.log(record.periods);
// [{ period: '2026-01', status: 'confirmed', hours: 1, contributionVerified: true }, …]
```

`actingAs` is "who is using this app right now". Use `DEMO_EMPLOYER` in the employer app, and a worker key in the worker app. There are three seeded workers to play with:

| Constant | Who | Story |
|---|---|---|
| `DEMO_KARIM` | Salaried, 5000/month | Everything confirmed |
| `DEMO_DANA` | Hourly, 85/hour | Varying hours, latest month still open |
| `DEMO_SAM` | Salaried, 4200/month | **March is unconfirmed** — use this one to build the failure screen |

`resetMockStore()` puts everything back to the seeded state. Useful in tests.

---

## The five types you will actually use

```ts
type WorkerKey = string;   // '0x7f3a…' — a person's ID. Not a name, not a wallet address.
type Period    = string;   // '2026-03' — one month. Sorts correctly as a plain string.
type Amount    = bigint;   // money, smallest unit. bigint, NEVER number (see below).
type Salt      = string;   // a secret. The api handles these; your app should not.
type Commitment = string;  // the sealed salary as stored publicly. Unreadable.
```

> **Amounts are `bigint`, not `number`.** Write `5000n`, not `5000`. Floating point cannot hold money exactly, and this value gets compared against a cryptographic seal — being one unit out means the payment cannot be confirmed. TypeScript will stop you, but it is worth knowing why.

---

## Version 1 — what is stable, and what will change

This interface compiles and enforces the real rules, so build on it today. It is
also a **v1**, and some of it is known to be rough. Here is the honest list, so
nobody is surprised and nobody quietly works around something we already know
about.

### Safe to build on — these will not break your UI

- The types: `WorkerKey`, `Period`, `Amount`, `PeriodStatus`, `EmploymentRecord`
- The error classes, especially `PaymentMismatchError` and `OfferMismatchError`
- The shape of `confirmPayment`, `acceptOffer`, `hire`, `approveHours`
- The rule that apps never touch a salt

### Known rough edges

| # | What | Why it will probably change |
|---|---|---|
| 1 | `hire()` returns `ratePerPeriod` **and** `salt` separately | The employer has to get two values to the worker by hand. Likely becomes one shareable `offerCode` string that encodes both |
| 2 | The read methods sit on `PayrollApi` | `getEmploymentRecord` and `listEmploymentRecords` need no wallet, yet E still has to pass `actingAs: '0xanyone'`. They probably split into a separate `PayrollReader` |
| ~~3~~ | ~~Contribution rate is hardcoded at 25%~~ | **Closed.** It is now `sealed ledger contributionRate`, set by the constructor (`contributionPct`) and readable by anyone |
| 4 | `PeriodStatus` is derived by a heuristic | The mock treats "most recent period" as open and older unconfirmed ones as failed. Real logic needs a deadline from A's contract |
| ~~5~~ | ~~No `connect()` / `disconnect()`~~ | **Closed.** B added `connectWallet`/`disconnectWallet`/`getWalletStatus` alongside SPIKE-PAY |
| 6 | Whatever the contract cannot actually do | Some method may not map cleanly onto a circuit. We find out when B builds it |

Items 1 and 2 make the interface **simpler**, not different — an `offerCode` is one
value instead of two, and a `PayrollReader` removes an argument E does not want.
Neither would force a rewrite of a screen.

### Who changes it

**The lead owns `PayrollApi.ts`.** Not B, not C, not D, not E. Five people build
against it, so it changes once, deliberately, with everyone told.

That is not bureaucracy. If two people patch the interface for their own screen
in the same afternoon, the other three lose a morning.

### What B does when the contract does not fit

This is the one that matters, because B is the person who will find these.

1. **Do not change `PayrollApi.ts`.** Not even a little.
2. **Do not bend the interface to fit the contract quietly.** A method that
   silently behaves differently from the mock is worse than one that is missing —
   three apps are already relying on the documented behaviour.
3. **Say so, with the specifics**: which method, which circuit, what the contract
   can and cannot do, and what you would change.
4. The lead edits the interface, the mock, and this file **together**, and tells
   everyone in one message.

The same goes for C, D or E: if you need something the interface does not
provide, that is a signal it is missing a method — say so rather than reaching
around it into `@midnight-ntwrk/*`.

### Where changes get recorded

Any change to `PayrollApi.ts` updates three things in the same commit:

- the interface
- `MockPayrollApi`, so the fake still matches the real behaviour
- this README, including the table above

If those three ever disagree, this README is wrong and should be trusted last —
the compiler is the source of truth.

---

## Wallet and payments

Added by B alongside SPIKE-PAY. Needed by C and D for anything that signs a
transaction; the read methods never touch a wallet.

### Connect

```ts
import type { WalletStatus } from '@nightshift/api';

const status: WalletStatus = await api.connectWallet();
// { connected: true, address: 'mn_addr_…' }  — address only, never a key

await api.getWalletStatus();   // poll or call after a route change
await api.disconnectWallet();
```

`WalletStatus` carries an address and nothing else. No key, no salt, ever.

**Gate your write buttons on it.** `hire`, `approveHours` and `payWorker` all
need a connected wallet and throw without one.

### Pay a worker

```ts
await api.payWorker({
  workerKey: DEMO_KARIM,                    // who, for your own records
  recipientShieldedAddress: theirAddress,   // where the money actually goes
  amount: 5000n,
  onStatus: (s) => setStage(s.stage),
});
```

This is a **plain wallet-to-wallet shielded transfer of NIGHT. It does not touch
the contract.** `confirmPayment` is the separate, later step where the worker
checks the amount against the sealed rate — that is the only place any checking
happens.

> ### The two identifiers are not interchangeable
>
> `workerKey` identifies someone **inside the contract**. `recipientShieldedAddress`
> is **where funds land**, and it comes from that person's own wallet via
> `getMyShieldedAddress()`. Nothing on-chain connects them, and nothing should:
> pairing an employment record with a payment address on a public ledger would
> undo the pseudonymity.
>
> So you cannot derive one from the other. The worker hands their employer both,
> once, at hiring. Passing a `workerKey` as the recipient fails against a real
> wallet — and the mock now rejects an empty address for the same reason, so you
> find out in development rather than on stage.
>
> **Pay in NIGHT, never DUST.** DUST is a non-transferable fee resource; it
> cannot be sent between people at all. A salary shown in DUST is a factual error.

> ### ⚠️ `txId` is optional and will often be absent
>
> ```ts
> payWorker(...): Promise<{ txId?: string }>
> ```
>
> The browser wallet's `submitTransaction` resolves to `void`, so the real
> implementation has no reliable transaction id to hand back. B investigated the
> alternatives and documented why each fails in `src/midnight/payment.ts`, rather
> than fabricating one.
>
> The mock **does** return a txId. **Do not build UI that depends on receiving
> it** — no "view transaction" link, no copy-the-hash button, no polling on it.
> Show success from the promise resolving, not from a txId arriving.

### Progress reporting

Proving takes real seconds. Without feedback the UI just freezes, so `hire`,
`approveHours` and `payWorker` all accept an optional `onStatus`:

```ts
type TransactionStatus =
  | { stage: 'signing' | 'proving' | 'submitting' | 'pending' }
  | { stage: 'confirmed'; txId?: string }     // txId optional here too
  | { stage: 'failed'; error: PayrollError };
```

```ts
await api.hire({
  workerKey, ratePerPeriod: 5000n, expectedHours: 1,
  onStatus: ({ stage }) => setStage(stage),   // 'proving' is the slow one
});
```

`onStatus` is **optional everywhere**. Omit it and every method behaves exactly
as it did before it existed — just `await` the result.

---

## For C — the worker app

### Show the pending offer

```ts
const offer = await api.getMyOffer();   // null if there is no offer

if (offer) {
  // offer.ratePerPeriod  → 5000n
  // offer.expectedHours  → 1 for salaried, real hours for hourly
  // offer.salt           → the employer sent this with the offer
}
```

### Accept it — and handle the case where the employer lied

```ts
import { OfferMismatchError } from '@nightshift/api';

try {
  await api.acceptOffer({ ratePerPeriod: 5000n, salt: offer.salt });
  // accepted. The rate and salt are now stored on this device.
} catch (e) {
  if (e instanceof OfferMismatchError) {
    // The employer sealed a DIFFERENT number than the one they told the worker.
    show('The sealed amount does not match what you entered. ' +
         'Do not accept — contact your employer.');
  }
}
```

This check is the reason `acceptOffer` exists. Without it, an employer could promise 5000 and seal 4000.

### List the worker's periods

```ts
const me = await api.getMyKey();
const record = await api.getEmploymentRecord(me);

for (const p of record.periods) {
  p.period;   // '2026-03'
  p.status;   // 'confirmed' | 'unconfirmed' | 'awaiting-hours' | 'awaiting-confirmation'
  p.hours;    // 1 for salaried, or null if the employer has not approved a timesheet
}
```

| status | What to show |
|---|---|
| `confirmed` | ✅ Confirmed paid |
| `awaiting-hours` | Waiting for the employer to approve hours |
| `awaiting-confirmation` | ⚠️ Payment due — a **Confirm** button |
| `unconfirmed` | ✗ Not confirmed (this period has closed) |

### Confirm a payment — this is the important one

```ts
import { PaymentMismatchError } from '@nightshift/api';

try {
  await api.confirmPayment({ period: '2026-04', amountReceived: 5000n });
  show('✅ Confirmed');
} catch (e) {
  if (e instanceof PaymentMismatchError) {
    show('Cannot confirm. The amount you received does not match your ' +
         'agreed salary. This period stays unconfirmed on the public record.');
  }
}
```

**`PaymentMismatchError` is not a bug.** It is the product working — the system refusing to record a wrong payment as correct. Style it as a deliberate refusal, not a crash. It is the moment the whole demo is built around.

Notice you do **not** pass the rate or the salt. The api reads them from the device. Keep it that way.

### Prove a social-security contribution (the NSSF check)

Wherever contributions are a percentage of *declared* salary, the classic fraud
is an employer declaring less than they actually pay. The worker sees a
deduction on a payslip and has no way to check what was really remitted — until
a pension claim fails years later.

The sealed salary closes that, because it was committed at hiring, before anyone
had a reason to lie.

```ts
import { ContributionMismatchError } from '@nightshift/api';

try {
  await api.proveContribution({ period: '2026-04', declared: 1250n });
  show('✅ Contribution verified against your real salary');
} catch (e) {
  if (e instanceof ContributionMismatchError) {
    show('The declared contribution was not calculated on your real salary.');
  }
}
```

`declared` is the figure the employer reported to the fund. The check is
`declared === hours × sealedRate × contributionRate ÷ 100` — the worker's real
**earnings** for that period, not just the rate — done in zero knowledge; the
salary is never revealed, to the fund or to anyone else. (The contract writes it
as a cross-multiplication, `declared × 100 == hours × rate × pct`, because
Compact has no division operator.)

The seeded mock uses a contribution rate of **25%**. `DEMO_KARIM` is salaried
(hours = 1), so on 5000 the correct declaration is `1250n`. Try `1000n` to see
the failure state. For hourly workers the right figure changes every period —
`DEMO_DANA` in January is 40 h × 85 × 25% = `850n`.

Once it succeeds, `contributionVerified` flips to `true` on that period, which is
what E renders on the auditor board:

```ts
for (const p of record.periods) {
  p.contributionVerified;   // boolean — show a badge, or a warning if false
}
```

### The privacy panel

Everything on the left comes from `getEmploymentRecord`. Everything on the right you simply do not have access to — and neither does anyone else.

```
┌─ On the blockchain ─────┐   ┌─ Never leaves this device ─┐
│ ✅ March: confirmed      │   │ Your salary                 │
│ ✅ April: confirmed      │   │ Your secret key             │
│ Employed since Jan 2026 │   │ Your salt                   │
└─────────────────────────┘   └─────────────────────────────┘
```

---

## For D — the employer app

### Hire someone

```ts
const offer = await api.hire({
  workerKey: '0x7f3a…',
  ratePerPeriod: 5000n,   // for hourly workers, the rate for ONE hour
  expectedHours: 1,        // 1 for salaried and fixed-price work
});

// offer.commitment  → goes on the blockchain, public, unreadable
// offer.ratePerPeriod + offer.salt → PRIVATE. Send these to the worker directly
//   (an offer letter, a message). They need both to accept.
```

Show the worker the rate **and** the salt. Without the salt they cannot accept.

> Put a real warning on this screen: **once sealed, the rate cannot be changed.** Not by the employer, not by us, not by anyone. If it is wrong, end the employment and hire again.

### Approve hours

```ts
await api.approveHours({ workerKey: '0x7f3a…', period: '2026-04', hours: 47 });
await api.approveHours({ workerKey: '0x91b2…', period: '2026-04', hours: 1 });  // salaried
```

Hours are **public on purpose** — the employer already knows them, and only the rate is sensitive. A worker cannot confirm a period until its hours are approved.

### The team list

```ts
const team = await api.listWorkers();
// [{ workerKey, active, confirmedPeriods: 4, unconfirmedPeriods: 0 }, …]
```

There is no salary field here, because **the employer app genuinely does not have it.** Worth a small note on the screen — it surprises people.

### End employment

```ts
await api.endEmployment('0x7f3a…');
```

Nothing is deleted. The last confirmed period becomes their leaving date.

### Paying

The actual money transfer is a **wallet-to-wallet shielded payment** and does not go through this api. Leave the amount field editable — in the demo someone types 4000 instead of 5000, and the worker's app then refuses to confirm it.

---

## For E — the auditor view

You need **no wallet, no login, and no permission**. `actingAs` can be anything.

```ts
const api = new MockPayrollApi({ actingAs: '0xanyone' });
const board = await api.listEmploymentRecords();

for (const r of board) {
  r.workerKey;             // '0x7f3a…'
  r.active;                // true
  r.joinedPeriod;          // '2026-01'  (first confirmed period)
  r.lastConfirmedPeriod;   // '2026-04'
  r.periods;               // the ✅ / ✗ row
}
```

That gives you the board directly:

```
                    Jan   Feb   Mar   Apr
0x7f3a…              ✅    ✅    ✅    ✅
0x91b2…              ✅    ✅    ✅    ⏳
0xc4e8…              ✅    ✅    ✗     ✅     ← DEMO_SAM
```

Use `DEMO_SAM` to build and style the ✗ state — it is seeded with an unconfirmed March.

**There is no salary anywhere in these types.** `EmploymentRecord` and `PeriodRecord` have nowhere to put one. That is deliberate: it makes the leak impossible rather than merely forbidden. If your screen ever shows a salary, something is very wrong.

---

## For B — building the real one

Everything above is your specification. Make `MidnightPayrollApi` satisfy the same interface and the three apps light up without changing.

### Where to put it

```
packages/api/src/
├── PayrollApi.ts          ← the interface. Do NOT change without telling everyone.
├── errors.ts              ← reuse these exact error classes
├── mock/MockPayrollApi.ts ← reference behaviour. Read it before you start.
└── midnight/              ← YOUR CODE GOES HERE
    └── MidnightPayrollApi.ts
```

Then uncomment the export in `src/index.ts`:

```ts
export { MidnightPayrollApi } from './midnight/MidnightPayrollApi.js';
```

### How each method maps to A's contract

| Interface method | Contract circuit | Notes |
|---|---|---|
| `getMyKey()` | — | `pureCircuits.dappKey(secret, deploymentId)` — read `deploymentId` from the ledger; do **not** reimplement the hash |
| `hire()` | `hire(worker, rateCommitment)` | You generate the salt and compute the commitment |
| `approveHours()` | `approveHours(worker, period, hours)` | |
| `acceptOffer()` | `acceptHire(rate, salt)` | Store rate+salt in private state on success |
| `confirmPayment()` | `confirmPayment(period, rate, salt, amountReceived)` | Read rate+salt from private state. `hours` is **not** an argument — the circuit reads it from the ledger, so a worker can never claim hours the employer did not approve |
| `proveContribution()` | `proveContribution(period, rate, salt, declared)` | Same argument order as the bindings — check `managed/contract/index.d.ts` |
| `endEmployment()` | `endEmployment(worker)` | |
| `getEmploymentRecord()` | — | Read via the **indexer**, not a circuit |
| `listEmploymentRecords()` | — | Indexer |
| `listWorkers()` | — | Indexer |

The last three are reads. They go through the [Indexer GraphQL API](https://docs.midnight.network/api-reference/midnight-indexer), need no wallet, and are the same queries E is already writing — talk to them rather than doing it twice.

### Turning contract failures into the right errors

The apps catch specific error types. Map assertion failures onto them:

| Contract assertion fails | Throw |
|---|---|
| Sealed rate does not open | `OfferMismatchError` |
| `amount !== hours × rate` | `PaymentMismatchError` |
| Declared contribution wrong | `ContributionMismatchError` |
| Hours not approved yet | `HoursNotApprovedError(period)` |
| Already confirmed | `AlreadyConfirmedError(period)` |
| No private state on device | `MissingPrivateStateError` |

If you throw a raw SDK error instead, C's "Cannot confirm" screen shows a stack trace to a judge. Please do not.

### Private state

`acceptOffer` stores the rate and salt; `confirmPayment` and `proveContribution` read them. Use `@midnight-ntwrk/midnight-js-level-private-state-provider` — encrypted on disk, needs a 16+ character password. The [ZK Loan example](https://docs.midnight.network/examples/dapps/zkloan) shows the wiring.

**This is the one part where a mistake breaks the product.** The salt must never reach a server. If the api is ever running server-side and holding salts, we can read everyone's salary and the whole claim collapses.

### Pin these versions exactly

From the [official compatibility matrix](https://docs.midnight.network/relnotes/support-matrix) — not from `references/versions.json`, which is community-maintained and currently one minor behind:

```
compact compiler                    0.31.1
@midnight-ntwrk/compact-runtime     0.16.0
@midnight-ntwrk/midnight-js-*       4.1.1
@midnight-ntwrk/wallet-sdk          1.2.0   ← exact, no ^ (npm "latest" is still 1.1.0)
@midnight-ntwrk/dapp-connector-api  4.0.1
proof server image                  8.1.0
```

### Your definition of done

- [ ] `MidnightPayrollApi implements PayrollApi` with nothing added or removed
- [ ] Every contract failure maps to the right error class
- [ ] An app switches from mock to real by changing **one line**
- [ ] The salt never crosses a network boundary

---

## Method reference

| Method | Who calls it | Returns |
|---|---|---|
| `getMyKey()` | everyone | `WorkerKey` |
| `connectWallet()` | C, D | `WalletStatus` |
| `disconnectWallet()` | C, D | `void` |
| `getWalletStatus()` | C, D | `WalletStatus` |
| `getMyShieldedAddress()` | everyone | `string` — Bech32m, needs a wallet |
| `payWorker({ workerKey, recipientShieldedAddress, amount, onStatus? })` | employer | `{ txId?: string }` — **txId often absent** |
| `hire({ workerKey, ratePerPeriod, expectedHours })` | employer | `Offer` |
| `approveHours({ workerKey, period, hours })` | employer | `void` |
| `endEmployment(workerKey)` | employer | `void` |
| `listWorkers()` | employer | `WorkerSummary[]` |
| `getMyOffer()` | worker | `Offer \| null` |
| `acceptOffer({ ratePerPeriod, salt })` | worker | `void` |
| `confirmPayment({ period, amountReceived })` | worker | `void` |
| `proveContribution({ period, declared })` | worker | `void` |
| `getEmploymentRecord(workerKey)` | **anyone** | `EmploymentRecord` |
| `listEmploymentRecords()` | **anyone** | `EmploymentRecord[]` |

### Errors

| Error | When | Is it a failure? |
|---|---|---|
| `OfferMismatchError` | Sealed rate ≠ what the worker was told | **No — a caught lie.** Show it clearly |
| `PaymentMismatchError` | Amount ≠ hours × rate | **No — the demo.** Show it deliberately |
| `ContributionMismatchError` | Employer under-declared | **No** |
| `HoursNotApprovedError` | Employer has not approved the timesheet | Ordinary — show a waiting state |
| `AlreadyConfirmedError` | Confirming twice | Ordinary |
| `MissingPrivateStateError` | Device has no rate/salt | Real problem — see the salt note in [task C](../../tasks/03-worker-app.md) |
| `UnknownWorkerError` | No such worker | Real problem |

All extend `PayrollError`, so `catch (e) { if (e instanceof PayrollError) … }` catches everything from this package.

---

## Three rules

1. **Never import `@midnight-ntwrk/*` outside this package.** Missing something? Ask — do not work around it.
2. **Never let a salt or a secret key reach a server**, a log, a URL, or an analytics event.
3. **Do not change `PayrollApi.ts` alone.** Five people build against it. Changing it is a group decision.

Everything else: [the rule book](../../tasks/RULEBOOK.md).
