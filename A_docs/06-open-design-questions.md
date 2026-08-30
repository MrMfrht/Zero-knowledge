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

## 🟠 5. Secrets are stored on one device with no recovery — INTERIM DECISION

Covered in full in [05-keys-storage-and-identity.md](05-keys-storage-and-identity.md).

**Decided for now:** plain local storage, as reflected by `witnesses.ts` — which
is deliberately storage-agnostic, so this can be upgraded without touching the
contract. Lose the device and you lose the identity and every salt; money is
unaffected, the ability to prove anything is not.

**Still open:** the upgrade itself. Encrypted local state
(`level-private-state-provider`) is the easy step; deriving `localSk` from the
wallet seed phrase would solve recovery for free, but **nobody has checked
whether Midnight's DApp Connector allows it.** Question for B.

**Answered by B — no.** Checked against the actual installed
`@midnight-ntwrk/dapp-connector-api@4.0.1` type declarations (not
documentation prose, the real `.d.ts` this app depends on:
`node_modules/@midnight-ntwrk/dapp-connector-api/dist/api.d.ts`), not from
memory. `WalletConnectedAPI` — the full surface a connected wallet exposes —
has exactly these methods: balance/address/history reads
(`getShieldedBalances`, `getUnshieldedBalances`, `getDustBalance`,
`getShieldedAddresses`, `getUnshieldedAddress`, `getDustAddress`,
`getTxHistory`), transaction building/signing/submission
(`balanceUnsealedTransaction`, `balanceSealedTransaction`, `makeTransfer`,
`makeIntent`, `signData`, `submitTransaction`), and service plumbing
(`getProvingProvider`, `getConfiguration`, `getConnectionStatus`). None of
them returns a seed, a mnemonic, an HD-derivation path, or any raw secret
key material — not even `signData`, which signs an opaque payload with the
wallet's unshielded key and returns only `{ data, signature, verifyingKey }`.
This is by design: exposing key material to a DApp is exactly what the
DApp Connector API exists to prevent, the same reason `localSk` is a
witness in the first place.

**So the recovery upgrade is `level-private-state-provider` (encrypted local
state) alone, not wallet-derived recovery** — there is no lower-effort path
via the wallet. If wallet-derived recovery is still wanted, the only route
is a *second*, independent secret the person manages themselves (e.g. a
recovery phrase this app generates and asks them to write down), not
anything the connected wallet can hand over.

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

## 🟢 11. Where `witnesses.ts` lives — DECIDED

**Written and proven.** It lives in `packages/contract/src/witnesses.ts`, where
CLAUDE.md's layout and the official zkloan example both place it. Storage-agnostic
by design — it reads whatever private state the caller supplies. Verified by the
smoke run in the contract README: deploy, hire as employer, stranger rejected.

Tracked so it does not get silently skipped.

---

# The three to fix if there is time

1. **Question 2** — the salt in a plaintext message undoes the product's headline claim
2. **Question 3** — an employer suppressing evidence by doing nothing is the sharpest attack on the demo
3. **Question 1** — key substitution, and it is nearly free to mitigate with a QR code

Everything else is safe to ship with a sentence of honesty.
