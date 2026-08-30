# Open design questions

*A live register of things that could bite us. Every entry is a real gap, not a
hypothetical. Some are fine to ship with — as long as we say so first.*

**How to use this file:** before the demo, read it once. Anything still marked
**OPEN** is something a judge might find, so it belongs on the honest slide.
Anything marked **DECIDED** has an answer we can give without hesitating.

**Who owns it:** the lead. Add to it freely; do not quietly resolve an entry
without telling everyone.

---

## 🔴 1. The key exchange is unauthenticated — OPEN

**The problem.** Karim sends his `workerKey` to the employer over WhatsApp,
email, whatever. Nothing authenticates that channel.

An attacker who intercepts it substitutes their own key. The employer hires the
**attacker**, believing it is Karim. Karim never receives an offer. The attacker
accepts, does no work, and gets paid.

Every cryptographic guarantee in the contract holds perfectly. The wrong person
is simply on the other end of it.

**Why it is easy to miss.** The key itself is not secret — it is on the chain
anyway. So sharing it feels harmless. The vulnerability is not disclosure, it is
**substitution**.

**Options:**
- Employer reads the key aloud to Karim in person or on a video call and both
  confirm the first and last six characters. Crude, effective, five seconds.
- Karim shows a QR code on his own screen, in the room. No channel to intercept.
- A signed credential from an issuer — the real fix, needs an issuer we do not have.

**For the demo:** say it. *"The key exchange happens out of band, and in
production it needs a verified channel."*

---

## 🔴 2. The rate and salt travel over that same channel — OPEN

**Worse than question 1.** The employer must send Karim the **rate and the salt**
so he can call `acceptHire`.

Anyone who intercepts that message **learns his salary directly.** No hashing, no
proof, no cryptography — it is the number, in a message.

We built an elaborate system to keep the salary off a public ledger, and then the
plaintext is emailed.

**Options:**
- Show it once, in the employer app, as a QR code the worker scans in the room.
  Never transmitted.
- Encrypt it to the worker's public key — but the key exchange is unauthenticated
  (question 1), so this needs that fixed first.
- Accept it for the demo and state it plainly.

**For the demo:** this is the most important honest caveat we have. Say it before
anyone asks.

---

## 🟠 3. The employer can freeze a worker out by never approving hours — OPEN

**The problem.** A worker cannot call `confirmPayment` until the employer has
called `approveHours` for that period.

So an employer who underpays does not have to leave a ✗ on the board. They simply
**never approve the timesheet.** The period sits in `awaiting-hours` forever.

And `awaiting-hours` looks administrative. It does not look like fraud. **The
employer can suppress the evidence by doing nothing at all**, which is the
cheapest possible attack.

This weakens the central demo claim. "The system cannot record a wrong payment as
correct" is still true — but the system can be prevented from recording anything.

**Options:**
- **A deadline.** If a period ends with no approval, it becomes `unconfirmed`
  automatically. Needs `blockTimeGte` and a sealed period-length — the block-time
  predicates are documented and we have not used them yet.
- Let the worker assert hours too, and flag a disagreement publicly.
- Accept it and say so.

**Worth fixing if there is time.** It is the gap most likely to be found by a
judge who thinks about incentives.

---

## 🟠 4. `employerKey` is sealed and cannot ever be rotated — OPEN

**The problem.** Whoever deploys becomes the employer, permanently. The field is
`sealed`, so no circuit can change it — by design, so nobody can seize the role.

But that means: **if the employer loses their secret, the contract is dead.** No
new hires, no hour approvals, no ending employment. Existing workers can still
confirm payments, but nothing new can happen, forever.

**Options:**
- A rotation circuit gated on the current secret (the [security guide](https://docs.midnight.network/guides/security-best-practices)
  documents a "rotating an owner key" pattern). Costs the "sealed" guarantee.
- Two employer keys from the start, either may act. Simple redundancy.
- Accept it — a hackathon contract is redeployable.

**Probably fine for now.** Worth one sentence in the limits.

---

## 🟠 5. Secrets are stored on one device with no recovery — OPEN

Covered in full in [05-keys-storage-and-identity.md](05-keys-storage-and-identity.md).

**Short version:** lose the device and you lose the identity and every salt. Money
is unaffected; the ability to prove anything is not.

**The unexplored fix:** derive `localSk` from the wallet seed phrase, which people
already back up. **Nobody has checked whether Midnight's DApp Connector allows
this.** Question for B.

---

## 🟡 6. The backend directory can deanonymize the whole chain — DECIDED

**The problem.** The chain is safe because keys are meaningless. The directory
maps key → real name, which makes every pseudonym meaningful.

**Decision: every directory route sits behind authentication, and the guard fails
closed.** Written into [D_docs/implementation_plan.md](../D_docs/implementation_plan.md)
as a blocking requirement, with a test that an unauthenticated request returns 401.

**Say it in the demo as a strength:** *"The one thing that could break our
privacy is the name directory, so it is the one thing behind auth."*

---

## 🟡 7. The employer necessarily knows the salaries they set — DECIDED

Not a bug. They agreed the number and generated the commitment, so they hold the
rate and salt for their own employees.

What they **cannot** do is change it afterwards, or read anyone else's from
another employer.

**Say it plainly if asked.** Confidentiality here is from the *public and from
each other*, not from the counterparty who set the figure.

---

## 🟡 8. A worker can refuse to confirm a correct payment — DECIDED

The system proves payments **correct**; it cannot compel a confirmation. A worker
could withhold one out of spite and leave a ✗ that the employer does not deserve.

**Accepted.** The employer's recourse is off-chain, like any dispute. Already in
the judge prep.

---

## 🟡 9. Participation and timing are public — DECIDED

An observer sees that two pseudonyms have a monthly relationship, roughly when it
started, and which periods are confirmed. Content is private; existence is not.

**Accepted and stated.** Already on the honest slide.

---

## 🟢 10. `PeriodStatus` has no deadline behind it — OPEN

The mock decides "the most recent period is open, older unconfirmed ones failed"
by heuristic. **The contract has no concept of a period ending.**

So `unconfirmed` currently means "the mock guessed." Nothing on-chain distinguishes
*"this period closed without confirmation"* from *"this period is still open."*

Fixing question 3 fixes this too — both need block-time deadlines.

---

## 🟢 11. Nobody has decided where `witnesses.ts` lives — OPEN

The file that supplies `localSk` does not exist. The contract cannot run without
it. `packages/contract` or `packages/api` — a decision to make with B.

Tracked so it does not get silently skipped.

---

# The three to fix if there is time

1. **Question 2** — the salt in a plaintext message undoes the product's headline claim
2. **Question 3** — an employer suppressing evidence by doing nothing is the sharpest attack on the demo
3. **Question 1** — key substitution, and it is nearly free to mitigate with a QR code

Everything else is safe to ship with a sentence of honesty.
