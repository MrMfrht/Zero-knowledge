# The circuit map — who calls what, from which app, on whose machine

*The question that unlocks the whole design: every circuit runs on the machine of
whoever calls it, using **that person's** secret. This document makes that
concrete for all six circuits, then explains circuits 3 through 6 in detail.*

---

# Part 1 — Key vs secret, one more time, because it is the crux

| | Secret (`localSk`) | Key (`workerKey`) |
|---|---|---|
| What it is | 32 random bytes | `hash(secret)` |
| Who sees it | **Only its owner. Ever.** | **Everyone** — it is on the chain |
| Does it travel? | **Never leaves the device** | Freely — Karim sends his to the employer |

They are linked one way only:

```
secret  ──hash──►  key         ✅ easy
secret  ◄──???──   key         ❌ impossible
```

**Think of a padlock.** The **key** is the serial number engraved on the outside —
anyone can read it, and it identifies *which* padlock. The **secret** is the
physical key that opens it. Knowing the serial number gets you nothing.

**How each is used:**

- **The key is given away.** Karim sends his to the employer so they can type it
  into `hire`. It is how anyone refers to him.
- **The secret is never given away.** It is used *inside the circuit, on his own
  machine*, to prove he owns that key: `dappKey(localSk(), deploymentId) == theKeyOnChain`.
  He does not *say* "I am 0x7f3a…" — anyone could claim that. He *proves* it by
  producing a secret that hashes to it.

**And what does the secret actually tell us?** Two different questions, only one
of which is cryptographic:

| Question | Answered by |
|---|---|
| *"Is this the holder of `0x7f3a…`?"* | **The secret.** Absolutely, mathematically |
| *"Is `0x7f3a…` a man named Karim?"* | **Nothing in the system.** The employer decided that at the interview — see [05](05-keys-storage-and-identity.md) |

## One key per employer, not one key per person

`dappKey` takes a second argument — `deploymentId`, 32 random bytes fixed when
that employer's contract was deployed and readable by anyone:

```compact
export pure circuit dappKey(sk: Bytes<32>, deployment: Bytes<32>): Bytes<32> {
    return disclose(persistentHash<Vector<3, Bytes<32>>>(
        [pad(32, "nightshift:pk:"), deployment, sk]));
}
```

Karim has **one secret**, but a **different key in every employer's ledger**.
That matters because ledgers are public: if his key were the same everywhere,
two employers — or anyone reading the indexer — could match the two records and
learn he works for both, along with each relationship's timeline. Different keys
leave nothing to match on.

This was missing from the first version of the contract and was caught in review
([question 12](06-open-design-questions.md)). It is the kind of leak that is
invisible while you are thinking about one employer.

---

# Part 2 — The rule that makes it all work

> ### `localSk()` does not mean "Karim's secret."
> ### It means "the secret of whoever is running this circuit right now."

Same function name, same source code — **a different value depending on whose
machine it runs on.** When the employer calls a circuit, it runs in the
employer's browser and `localSk()` returns the employer's secret. When Karim
calls one, it runs in his browser and returns his.

So this identical line:

```compact
const k = dappKey(localSk(), deploymentId);
```

produces the **employer's** key inside `hire`, and **Karim's** key inside
`acceptHire`. Nobody has to be told who is calling — each person's own machine
supplies their own secret, and the hash proves it.

---

# Part 3 — The master table

Every circuit, who calls it, from which of our apps, and what its anchor is:

| # | Circuit | Called from | Runs on | `localSk()` returns | Anchor (what stops cheating) |
|---|---|---|---|---|---|
| 1 | `hire` | **D — employer app** | Employer's machine | Employer's secret | `employerKey` on the chain |
| 2 | `acceptHire` | **C — worker app** | Worker's machine | Worker's secret | The commitment `hire` published |
| 3 | `approveHours` | **D — employer app** | Employer's machine | Employer's secret | `employerKey` on the chain |
| 4 | `confirmPayment` | **C — worker app** | Worker's machine | Worker's secret | The commitment **and** `approvedHours` |
| 5 | `proveContribution` | **C — worker app** | Worker's machine | Worker's secret | The commitment and the sealed rate |
| 6 | `endEmployment` | **D — employer app** | Employer's machine | Employer's secret | `employerKey` on the chain |
| — | *(constructor)* | B's deploy script, once | Deployer's machine | Deployer's secret | Runs once; whoever deploys becomes the employer |

**E — the auditor — calls no circuits at all.** It only *reads* the public
ledger (`agreedRate`, `approvedHours`, `paidFor`, `active`) through the indexer.
No wallet, no secret, no proof. That is the point of E: anyone can verify
without being given anything.

Notice the rhythm: **D and C alternate.** The employer acts (hire, approve,
end), the worker responds (accept, confirm, prove). Every employer circuit is
anchored to `employerKey`; every worker circuit is anchored to something the
employer already published. Neither side ever has to trust the other's machine.

---

# Part 4 — Circuit 3: `approveHours`, explained

## The problem it solves

Dana is paid by the hour. In March she worked 47 hours. But if Dana claims 60
and the employer says 40 — who decides? Payment cannot be checked against
"hours" until somebody fixes what the hours *are*.

## The code

```compact
export circuit approveHours(worker: Bytes<32>, period: Uint<32>, hours: Uint<32>): [] {
    assert(dappKey(localSk(), deploymentId) == employerKey, "only the employer may approve hours");

    const w = disclose(worker);
    assert(active.member(w), "this worker has not accepted an offer");
    assert(active.lookup(w), "this worker's employment has ended");

    const pk = disclose(periodKey(w, period));
    assert(!approvedHours.member(pk), "hours already approved for this period");

    approvedHours.insert(pk, disclose(hours));
}
```

Line by line:

1. **The anchor.** Hash the caller's secret, compare to `employerKey`. This runs
   in **D's employer app**, so `localSk()` is the employer's secret. A worker
   calling this from C's app would fail here — their secret hashes to their key,
   not the employer's.
2. **Sanity:** the worker must have accepted (`active.member`) and still be
   employed (`active.lookup` is `true` — remember `false` means "ended").
3. **Write-once.** See below — this line is load-bearing.
4. **The write:** hours go into a public map.

## Why the write-once guard matters more than it looks

A privacy audit caught this line missing, and it was the most serious finding in
the contract. `confirmPayment` does not take `hours` as an argument — it *reads*
them from this map, and that is the whole reason a worker cannot inflate their
timesheet. But an anchor only works if it cannot move.

Without the guard: the employer approves 20 hours, pays for 10, and then
re-approves the same period as 10 hours before the worker confirms. The worker's
app reads 10, `10 × rate` matches the money that arrived, and a real
underpayment is recorded as **paid ✓**. The headline claim — the system cannot
record a wrong payment as correct — would have been false, through the one map
that was writable twice.

With it, timesheets are immutable once approved. Neither side can move the
number: the worker never supplies it, the employer cannot revise it. The
honest cost is that a mistaken approval is permanent for that period; the
recourse is off-chain. That trade is recorded as
[question 13](06-open-design-questions.md).

## Two design details worth understanding

**Hours are public on purpose.** The employer already knows them, and hours
alone say nothing about pay — 47 hours at an unknown rate is an unknown number.
Only the *rate* is sensitive, and it stays sealed. This is selective disclosure
in practice: hide exactly what needs hiding, and no more. (It also gives E's
auditor board something legible to show.)

**The `periodKey` helper.** A `Map` takes one key, but a timesheet is identified
by two things — *whose* and *which month*. So we hash them together:

```compact
pure circuit periodKey(worker: Bytes<32>, period: Uint<32>): Bytes<32> {
    return persistentHash<Vector<3, Bytes<32>>>(
        [pad(32, "nightshift:period:"), worker, period as Bytes<32>]);
}
```

One 32-byte value, unique to the pair. Its domain separator (`:period:`) differs
from the identity one (`:pk:`), so a period key can never collide with a
person's key — the same rule as commitment vs nullifier separators.

## Salaried workers

Pass `hours = 1`. Then `1 × rate = rate`, and the same circuit covers hourly,
salaried, and fixed-price work. One circuit, three employment types.

---

# Part 5 — Circuit 4: `confirmPayment`, explained

## This is the product

Everything else in the contract exists so this circuit can exist. Money arrived
in Karim's wallet. Was it right? Today he checks his banking app and *hopes*.
Here, he *proves* it — without the amount ever becoming public.

## The code

```compact
export circuit confirmPayment(
    period: Uint<32>, rate: Uint<64>, salt: Bytes<32>, amountReceived: Uint<64>
): [] {
    const k = disclose(dappKey(localSk(), deploymentId));
    assert(active.member(k), "you have not accepted an offer");
    assert(active.lookup(k), "your employment has ended");

    const pk = disclose(periodKey(k, period));
    assert(approvedHours.member(pk), "the employer has not approved hours for this period yet");
    assert(!paidFor.member(pk), "this period is already confirmed");

    // Anchor 1: this really is the rate sealed at hiring.
    assert(persistentCommit<Uint<64>>(rate, salt) == agreedRate.lookup(k),
           "that is not your agreed rate");

    // Anchor 2: the hours the EMPLOYER approved — read from the ledger,
    // never supplied by the worker.
    const hours = approvedHours.lookup(pk);

    // The check the whole product is built on.
    assert(amountReceived == (hours as Uint<64>) * rate, "incorrect payment");

    paidFor.insert(pk, true);
}
```

**Three private numbers go in** — the rate, the salt, the amount received.
**One public boolean comes out** — `paidFor[thisPeriod] = true`. None of the
three numbers reaches the ledger, and the generated public ledger type has
**nowhere to put an amount** even if someone tried.

## Runs on Karim's machine — so why can't Karim cheat?

This is [the anchor question](01-understanding-the-contract.md) applied one last
time, and it is worth walking through because the answer uses *both* anchors.

Karim controls `rate` and `amountReceived` — they come from his machine. Suppose
he was underpaid 4,000 and wants to pretend that was correct. He supplies
`rate = 4000, amountReceived = 4000`:

```
amountReceived == hours × rate      →  4000 == 1 × 4000   ✓ passes!
```

**That check alone is worthless — he picked both numbers.** What stops him is
the line above it: `persistentCommit(4000, someSalt)` must equal the commitment
sealed at hiring, which was built from `(5000, realSalt)`. No salt he can invent
makes 4000 hash to that value. The transaction fails.

And suppose Dana tries the other direction — claiming more hours than she
worked. **She cannot: hours is not an argument.** The circuit reads it from
`approvedHours`, where the employer put it. She never gets to supply that
number at all.

| Cheat attempt | Blocked by |
|---|---|
| Fake rate | Anchor 1 — the commitment from hiring |
| Fake hours | Anchor 2 — hours are read from the ledger, not passed in |
| Fake amount | The arithmetic — it must equal hours × the *real* rate |
| Confirm twice | `!paidFor.member(pk)` |
| Confirm someone else's period | `k` is derived from the caller's own secret |

Two anchors, two different sources: the rate is bound to what was sealed at
hiring, the hours to what the employer approved. **Neither number comes from
the person making the claim.** That is why a proof produced on Karim's own
machine is still trustworthy.

## The failure case is the demo

Employer sends 4,000 when 5,000 × 1 was agreed. Karim enters what actually
arrived. The final assert fails, **no proof can be produced**, and the period
stays permanently absent from `paidFor` — a public ✗ on E's auditor board,
forever, while the salary itself stays unreadable to everyone on earth.

> The system cannot record a wrong payment as correct. Not "should not."
> **Cannot.**

*(The known gap: an employer can dodge the ✗ by never calling `approveHours` at
all, leaving the period stuck before this circuit can run. That is
[open question 3](06-open-design-questions.md) — the fix is a block-time
deadline, not built yet.)*

---

---

# Part 5b — Circuit 5: `proveContribution`, explained

## The fraud it closes

Wherever social security is a percentage of *declared* salary, the classic move
is: pay Karim 5,000, declare 3,000 to the fund, pocket the difference in
contributions. Karim sees a deduction on his payslip and has **no way to check
what was actually reported** — until a pension claim falls short, decades later.

## The code

```compact
export circuit proveContribution(
    period: Uint<32>, rate: Uint<64>, salt: Bytes<32>, declared: Uint<64>
): [] {
    const k = disclose(dappKey(localSk(), deploymentId));
    assert(active.member(k), "you have not accepted an offer");

    const pk = disclose(periodKey(k, period));
    assert(approvedHours.member(pk), "no approved hours for this period");
    assert(!contributionOk.member(pk), "this period's contribution is already proven");

    assert(persistentCommit<Uint<64>>(rate, salt) == agreedRate.lookup(k),
           "that is not your agreed rate");

    const hours = approvedHours.lookup(pk);
    assert(declared * 100 ==
               (hours as Uint<64>) * rate * (contributionRate as Uint<64>),
           "the declaration does not match your real earnings");

    contributionOk.insert(pk, true);
}
```

Runs on **Karim's machine** (called from **app C**), same anchors as
`confirmPayment`: the rate must open the seal from hiring, and the hours come
from the ledger.

## Three details that are easy to miss

**The maths is a cross-multiplication.** The natural statement is
`declared == earnings × pct ÷ 100` — but Compact has no division operator
(verified by compiling, [A_docs/04](04-compact-arithmetic.md)). Multiplying both
sides by 100 says the same thing:

```
declared × 100  ==  hours × rate × contributionRate
```

**`declared` must stay private, and here is the trap:** `contributionRate` is
public (it is the law's number — 25 sits openly on the ledger). If `declared`
were ever published, anyone could compute the salary from it:
`rate = declared × 100 ÷ pct`. So `declared` goes into the proof and nowhere
else — exactly like the amount in `confirmPayment`.

**The power comes from *when* the commitment was made.** The rate was sealed at
hiring — before anyone had a reason to lie about contributions. The employer
cannot retroactively pretend a lower salary was agreed, because the seal will
not open to it.

Smoke-tested: declaring 1,250 (25% of real 5,000 earnings) passes; declaring
1,000 is rejected with *"the declaration does not match your real earnings."*

---

# Part 5c — Circuit 6: `endEmployment`, explained

## The problem

People leave. But Karim's two years of confirmed periods are **his** — proof of
employment he may need for a loan, a visa, his next job. An ex-employer must not
be able to erase it.

## The code

```compact
export circuit endEmployment(worker: Bytes<32>): [] {
    assert(dappKey(localSk(), deploymentId) == employerKey, "only the employer may end employment");

    const w = disclose(worker);
    assert(active.member(w), "this worker never accepted an offer");
    assert(active.lookup(w), "this worker's employment has already ended");

    active.insert(w, false);
}
```

Runs on the **employer's machine** (called from **app D**), anchored to
`employerKey` like every employer circuit.

**Nothing is deleted — that is the entire design.** `active` flips to `false`;
`paidFor`, `contributionOk` and `approvedHours` keep every entry forever. The
worker's last confirmed period becomes their leaving date. What ends is the
ability to add *new* periods: `approveHours` and `confirmPayment` both check
`active` and refuse from now on — smoke-tested on both sides.

*(This is also why `active` has three states: absent = offered, `true` =
employed, `false` = ended. Deleting the entry instead would make "ended" and
"never here" indistinguishable, which would erase exactly the history the
product exists to preserve.)*

# Part 6 — What each app builds against, in one glance

| App | Writes (circuits) | Reads (public ledger) |
|---|---|---|
| **C — worker** | `acceptHire`, `confirmPayment`, `proveContribution` | own periods and status |
| **D — employer** | `hire`, `approveHours`, `endEmployment` | team list, per-period status |
| **E — auditor** | **nothing — no wallet, no secret** | everything: `paidFor`, `approvedHours`, `active`, `agreedRate` (sealed values, unreadable) |
| **B — api** | wires all of the above and supplies `witnesses.ts` | — |

C and D never call these circuits directly — they go through
[`PayrollApi`](../packages/api/README.md), which hides the context/witness
plumbing. But this table is the truth underneath that interface.
