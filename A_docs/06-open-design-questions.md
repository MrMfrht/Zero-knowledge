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

## ✅ 12. The same worker showed the same key to every employer — FIXED 2026-08-30

**Found in the privacy audit of 2026-08-30, not by us writing the code.**

`dappKey` mixes the caller's secret with one fixed word, `"nightshift:pk:"`. That
word is baked into the contract, so it is identical in **every** NightShift
deployment. Since each employer deploys their own contract, a worker with two
employers appears in both public ledgers under the **same** `Bytes<32>` key.

Two employers — or anyone reading the indexer, which is everyone — can therefore
join on that key and learn that one person works for both, plus each
relationship's timeline. That is the relationship graph the pseudonyms exist to
hide, and it is exactly what the comment above `dappKey` used to claim was
impossible. The comment has been corrected; the behaviour has not.

**Why it survived review:** the domain separator genuinely does separate
NightShift from *other apps*. It just does not separate NightShift from itself.

**The fix, now shipped.** A new sealed ledger field, `deploymentId` — 32 random
bytes supplied once as a constructor argument — is mixed into every identity:

```compact
export pure circuit dappKey(sk: Bytes<32>, deployment: Bytes<32>): Bytes<32> {
    return disclose(persistentHash<Vector<3, Bytes<32>>>(
        [pad(32, "nightshift:pk:"), deployment, sk]));
}
```

Two separators now, doing two different jobs: the constant string keeps
NightShift apart from other apps, and `deploymentId` keeps each NightShift
deployment apart from every other one. Karim's single secret yields an unrelated
key in each employer's ledger, so the two ledgers cannot be joined.

`smoke.mjs` asserts it directly — it derives Karim's key under two different
deployment values and fails the run if they match.

**The one way to get this wrong:** deploy two contracts with the *same*
`deploymentId`. Then the keys collide again and the protection silently
evaporates. The deploying app must generate 32 fresh random bytes per
deployment, never a constant and never a copy. That is stated in the
constructor's own comment, because it is the kind of thing a hurried deploy
script gets wrong.

**Why not use the contract's own address instead?** That was the obvious
alternative — the chain would supply the per-deployment value for free, with no
deploy script to get wrong. We checked the documentation before choosing, and
two things ruled it out:

- `kernel.self(): ContractAddress` does exist and returns the contract's own
  address ([ledger ADT reference](https://docs.midnight.network/compact/data-types/ledger-adt)).
  But `Kernel` exposes *ledger operations*, and the language reference defines a
  circuit containing a ledger operation as **impure** — so it cannot be called
  from `dappKey`, which is `pure`. It would have to be read at each call site and
  passed in, which is exactly the shape we already have, only with a value we
  control less.
- **Nothing in the documentation says whether the address is even knowable inside
  a `constructor`.** Every official example calls `kernel.self()` from an ordinary
  `export circuit`, never a constructor, and the address is described as
  *assigned by the deployment transaction* — the same transaction the constructor
  runs inside. We could not confirm it, so we did not build on it.

So the trade is deliberate: correctness now depends on the deploy script
generating fresh randomness, rather than on a chain behaviour we could not
verify. If someone later confirms the constructor can read `kernel.self()`,
switching is a small change — and would remove the one way to get this wrong.

---

## ✅ 13. `approveHours` could rewrite an approved timesheet — FIXED 2026-08-30

**Found in the same audit. This one was serious, and it is now closed.**

`approveHours` wrote to the ledger with no check that the period was already
approved — the only map write in the contract that lacked one. Because
`confirmPayment` *reads* hours from that map as its anchor, an employer could:
approve 20 hours, pay for 10, then re-approve the period as 10 hours before the
worker confirmed. The worker's app would read 10, the arithmetic would balance,
and a genuine underpayment would be recorded as **paid ✓** — the precise outcome
the headline claim says is impossible.

**Fixed** by adding the guard every sibling circuit already had:

```compact
assert(!approvedHours.member(pk), "hours already approved for this period");
```

`smoke.mjs` now proves it: re-approving period 1 with different hours is
rejected. Timesheets are write-once, so both sides are pinned — the worker never
supplies hours, and the employer cannot revise them after the fact.

**Consequence worth knowing:** a genuine mistake in an approval is now permanent
for that period. Given the alternative was a silent fraud path, that is the right
trade, but it is a real product constraint — an employer who fat-fingers hours
cannot fix that period, and the recourse is off-chain.

---

# The three to fix if there is time

1. **Question 2** — the salt in a plaintext message undoes the product's headline claim
2. **Question 3** — an employer suppressing evidence by doing nothing is the sharpest attack on the demo
3. **Question 1** — key substitution, and it is nearly free to mitigate with a QR code

Questions 12 and 13 were both found by review rather than by writing the code,
and both are now fixed. Worth remembering why they survived being written,
compiled and smoke-tested: **the tests only covered the case where the bug was
invisible** — one period, one salaried worker, one employer. Test data that
cannot distinguish a right answer from a wrong one is not a test.

Everything else is safe to ship with a sentence of honesty.
