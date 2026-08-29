# NightShift — Private Payroll with Public Proof

> **Get paid in private. Prove it in public.**

*A build plan for a five-person team. Written 30 August 2026. Every technical claim below is grounded in either the official Midnight documentation ([docs.midnight.network](https://docs.midnight.network/), fetchable as markdown via [llms.txt](https://docs.midnight.network/llms.txt)) or a named skill from the MIDSKILLS registry ([midskills.sevryn.xyz](https://midskills.sevryn.xyz/home) · [GitHub](https://github.com/Kali-Decoder/Midnight-skills)). Where something is a design of ours rather than a documented fact, it is labelled as such. Companion constraints: [docs/midnight-privacy-model.md](../docs/midnight-privacy-model.md).*

*The name is a placeholder the team can change. It stuck because it fits: Midnight, and work shifts.*

---

# Part 1 — The idea

## 1.1 One paragraph

An employer pays workers in Midnight's shielded currency — amounts hidden from everyone. At hiring, both sides seal the agreed rate into an on-chain **commitment**: a scrambled 32-byte value that hides the number but can never be opened to a different one. Every pay period, the worker confirms receipt by proving, inside a zero-knowledge circuit, that what arrived matches the sealed agreement. The ledger records exactly one public fact per period: **paid correctly, or not confirmed**. From that trail fall three more products for free: a verifiable employment history the worker owns, proof that social-security contributions were calculated on the real salary, and hourly/contractor payment verification. No salary figure is ever readable by anyone, anywhere, ever.

## 1.2 Follow the money — the whole system in one story

**The cast:** Cedar Café employs Karim at **5,000/month**. Later they bring in Dana, a designer, at **85/hour**.

### Hiring: the sealed envelope. No money moves.

Karim and Cedar Café agree on 5,000. On Karim's device, his wallet generates a random 32-byte salt and computes:

```
persistentCommit(5000, salt)  →  0x9f3ac2…e81b
```

That output is a **commitment** — think of a sealed envelope with "5,000" written inside, dropped into a public safe. Anyone can see an envelope exists. Nobody can read it. And crucially, it only ever opens with the original number *and* the original salt, so neither side can later pretend a different figure was agreed. ([Commitment schemes — hiding and binding](https://docs.midnight.network/compact/smart-contract-security))

Two on-chain calls make it mutual:

1. Cedar Café calls `hire(karimKey, 0x9f3ac2…)` — the envelope goes on the ledger.
2. Karim calls `acceptHire(5000, salt)` — the circuit checks his numbers open the envelope. **If the employer sealed a different figure than they told him, this call fails and he finds out before day one.**

Cost to both parties: a transaction fee. **Deposited funds: zero.** A commitment commits to a *number*, not money.

### Payday: wallet to wallet, contract not involved

Cedar Café sends 5,000 in shielded tokens **directly to Karim's wallet**. This is a plain shielded transfer on the Zswap layer — the base function of Midnight's private money:

> "There is no public balance. The chain records commitments and nullifiers, not amounts."
> — [Create and transfer a shielded token](https://docs.midnight.network/tokens/shielded-token)

Amount hidden. Sender hidden. Recipient hidden. The payroll contract never touches the coin — which matters, because contract-held shielded value is the hard, constraint-laden part of Midnight ([fresh vs committed coins, caller-only delivery](https://docs.midnight.network/tokens/shielded-token)), and this design simply never needs it. The contract only ever handles hashes.

### Confirmation: the worker proves it, not the employer

Karim calls `confirmPayment(March, 5000, salt)`. The circuit recomputes the commitment from his inputs and checks it against the envelope from hiring. Match → the ledger gains one line:

```
karim  ·  March 2026  ·  ✅ paid in full
```

The amount appears nowhere. And the direction of trust is the point: **the proof comes from the recipient.** An employer cannot mark someone paid; only the person holding the money and the salt can.

### The failure case — the actual product

Cedar Café has a bad month and sends Karim 4,000.

Karim goes to confirm. The circuit computes `persistentCommit(4000, salt)`, compares it to the sealed 5,000 — **no match. The assertion fails. The transaction is rejected.**

> Karim is *unable* to confirm a wrong payment, even if he wanted to.

March stays permanently unconfirmed on a public ledger, visible to any auditor, while the real salary stays unreadable to everyone on earth. The system cannot record a wrong payment as correct — not "shouldn't." *Can't.*

### Dana, by the hour

Dana's rate — 85/hour, the most guarded number in freelancing — is sealed exactly like Karim's salary. Her **hours are not secret**: the client approved the timesheet, so 47 hours goes on the ledger openly. Selective disclosure means hiding exactly what needs hiding:

```
confirmHourly(March, 47, 85, salt, 3995):
    assert  persistentCommit(85, salt)  == her sealed rate
    assert  47                          == the approved hours for March
    assert  3995                        == 47 × 85
```

Three checks, one public bit. Nobody learns her rate or her invoice total, and a client who pays for 40 approved hours out of 47 produces a period that can never be marked paid.

**Salaried is just hourly with hours = 1.** A fixed-price milestone is hourly with hours = 1 and rate = the milestone fee. One circuit covers all three working arrangements — build the hourly one and the others fall out.

### What the trail becomes

After a year, the ledger holds:

```
karim  ·  Jan ✅  Feb ✅  Mar ✗  Apr ✅ … Dec ✅
```

**That sequence is an employment certificate.** Join date = first confirmed period. Leave date = last. Continuity, gaps, and disputes are all legible — and it was written month by month, at the time, by both parties, before anyone had a reason to shade it. A future employer can additionally ask Karim to prove `rate ≥ X` against the still-sealed commitment, without ever seeing the rate. No reference letter, no HR department that stopped answering, no ex-employer who can withhold it.

### The contribution check

Wherever social-security contributions are a percentage of *declared* salary — Lebanon's NSSF and its counterparts elsewhere — the classic fraud is declaring less than what is actually paid. The employee sees a payslip deduction and has no way to check what was remitted, until a pension claim fails years later.

NightShift already holds the one thing that closes this: a **binding commitment to the true salary, made at hiring, before anyone had a reason to lie.** One more circuit:

```
proveContribution(March, declared, 5000, salt):
    assert  persistentCommit(5000, salt) == the sealed salary
    assert  declared == 5000 × contributionRate / 100
```

The worker can prove their contributions were computed on their real salary — without revealing the salary. An under-declaring employer leaves a permanent, public gap they cannot fill. This works as employee-held evidence for a tribunal or inspection **whether or not the fund itself ever adopts anything**.

### What we deliberately do not build

Degree verification, age checks, and professional licences are the *same circuit* with a different signing issuer — `assert(verifyAttestation(sig, issuerKey, …))` three times over. Each would cost another mock issuer service, another credential format, another UI flow, and teach a judge nothing the first one didn't. **They go on a slide** ("the same circuit verifies any signed credential"), not in the build. The ClickUp/Zelt timesheet pull is likewise deferred: the trust mechanism is both parties signing off hours, which is what approving a timesheet already is; the integration only pre-fills the number. Convenience, not trust — v2.

## 1.3 What is public and what is not

Checked against the [on-chain visibility table](https://docs.midnight.network/guides/security-best-practices) — the definitive list of what any chain observer sees.

| | Visible to anyone? | Why |
|---|---|---|
| That an employment relationship exists (two pseudonyms) | **Yes** | `hire`/`acceptHire` are public contract calls |
| **The salary / hourly rate** | **No — never** | Salted `persistentCommit`; hiding and binding |
| The shielded payment itself | **No** | Zswap records commitments and nullifiers, not amounts |
| Approved hours per period (contractors) | **Yes** | Deliberately — the client already knows them |
| "Period P confirmed paid in full" | **Yes** | The product's one public output |
| An unconfirmed period | **Yes** | The failure signal — meant to be seen |
| Worker's real identity | **No** | Per-dApp derived key, not a wallet address or name |
| When confirmations happen | **Yes** | Block timing is always observable |
| Fee payments | **No** | DUST is shielded |

The honest rows are the timing and existence rows: an observer can see that *some* pseudonym is employed by *some* pseudonym and confirms monthly. Content is hidden; participation is not. That is a property of Midnight, stated in [our privacy model](../docs/midnight-privacy-model.md), and it goes in the README rather than waiting for a judge to find it.

---

# Part 2 — The contract

> **Uncompiled sketches.** Every construct below is drawn from the official docs and the referenced examples, but none of it has been through `compact compile`. The contract lead's first job is making these real. Verify claims with `/midnight-verify:verify` ([Midnight Expert](https://docs.midnight.network/ai-integration/midnight-expert)) or the compiler — never from memory. See [.claude/skills/compact-authoring](../.claude/skills/compact-authoring/SKILL.md).

```compact
pragma language_version 0.23;
import CompactStandardLibrary;

// --- fixed at deployment ---------------------------------------------
export sealed ledger employerKey:      Bytes<32>;   // derived, never a wallet address
export sealed ledger contributionRate: Uint<8>;     // e.g. 25 (percent) — config, not law

// --- one entry per worker --------------------------------------------
export ledger agreedRate: Map<Bytes<32>, Bytes<32>>;  // workerKey -> persistentCommit(rate, salt)
export ledger active:     Map<Bytes<32>, Boolean>;

// --- one entry per (worker, period) ----------------------------------
export ledger approvedHours:  Map<Bytes<32>, Uint<32>>;  // periodKey -> hours (public by design)
export ledger paidFor:        Map<Bytes<32>, Boolean>;   // the product
export ledger contributionOk: Map<Bytes<32>, Boolean>;

witness localSk(): Bytes<32>;

circuit myKey(): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([pad(32, "nightshift:pk:"), localSk()]);
}
circuit periodKey(worker: Bytes<32>, period: Uint<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([worker, persistentHash<Uint<32>>(period)]);
}

// Employer records the sealed rate. No funds move — a commitment commits to a number.
export circuit hire(worker: Bytes<32>, rateCommitment: Bytes<32>): [] {
    assert(disclose(myKey()) == employerKey, "employer only");
    assert(!agreedRate.member(worker), "already hired");
    agreedRate.insert(worker, rateCommitment);
}

// Worker accepts — and this only succeeds if the sealed number is the one they were told.
export circuit acceptHire(rate: Uint<64>, salt: Bytes<32>): [] {
    const k = disclose(myKey());
    assert(agreedRate.member(k), "no offer for you");
    assert(persistentCommit<Uint<64>>(rate, salt) == agreedRate.lookup(k),
           "sealed rate is not what you were told");
    active.insert(k, true);
}

// Employer approves a timesheet. Hours are public on purpose. Salaried: hours = 1.
export circuit approveHours(worker: Bytes<32>, period: Uint<32>, hours: Uint<32>): [] {
    assert(disclose(myKey()) == employerKey, "employer only");
    approvedHours.insert(disclose(periodKey(worker, period)), hours);
}

// The worker confirms. The circuit computes on private values; only the boolean lands.
export circuit confirmPayment(period: Uint<32>, hours: Uint<32>,
                              rate: Uint<64>, salt: Bytes<32>,
                              amountReceived: Uint<64>): [] {
    const k  = disclose(myKey());
    const pk = disclose(periodKey(k, period));
    assert(active.member(k),                       "not an active worker");
    assert(persistentCommit<Uint<64>>(rate, salt) == agreedRate.lookup(k),
           "not the agreed rate");
    assert(hours == approvedHours.lookup(pk),      "hours do not match the approved timesheet");
    assert(amountReceived == (hours as Uint<64>) * rate, "incorrect payment");
    assert(!paidFor.member(pk),                    "already confirmed");
    paidFor.insert(pk, true);
}

// Either party proves the social-security declaration matched the real salary.
export circuit proveContribution(period: Uint<32>, declared: Uint<64>,
                                 rate: Uint<64>, salt: Bytes<32>): [] {
    const k  = disclose(myKey());
    const pk = disclose(periodKey(k, period));
    assert(persistentCommit<Uint<64>>(rate, salt) == agreedRate.lookup(k),
           "not the agreed rate");
    assert(declared == rate * (contributionRate as Uint<64>) / 100, "under-declared");
    contributionOk.insert(pk, true);
}

export circuit endEmployment(worker: Bytes<32>): [] {
    assert(disclose(myKey()) == employerKey, "employer only");
    active.insert(worker, false);    // history stays; the last confirmed period is the leave date
}
```

Design rules carried over from [the privacy model](../docs/midnight-privacy-model.md), each with its source:

- **Identity is a derived key, never `ownPublicKey()`** — that's a witness the prover's machine controls; the docs say never to authenticate with it ([Smart contract security](https://docs.midnight.network/compact/smart-contract-security)).
- **`persistentCommit` output needs no `disclose()`** — the salt satisfies the compiler; `persistentHash` output does need one ([Explicit disclosure](https://docs.midnight.network/compact/reference/explicit-disclosure)).
- **Fresh salt per commitment, domain separators per purpose** ([Smart contract security](https://docs.midnight.network/compact/smart-contract-security)).
- **The multiplication needs a spike.** `hours × rate` in `Uint<64>` is far from any realistic payroll number, but Compact's arithmetic behaviour on overflow is documented in [Security and best practices](https://docs.midnight.network/guides/security-best-practices) and must be *read and tested*, not assumed — an assertion that can wrap is not an assertion.
- **No escrow anywhere.** The contract never holds a coin. This is the single biggest de-risking decision in the design: everything the [shielded token tutorial](https://docs.midnight.network/tokens/shielded-token) lists as hard (contract shielded balances, fresh-vs-committed coins, caller-only `sendShielded`) simply does not apply.

---

# Part 3 — Architecture

Six components. The arrows are the dependency structure Part 4 is built around.

```
                       ┌──────────────────────────┐
                       │   payroll.compact         │
                       │   (compiled → managed/)   │
                       └───────┬───────────────────┘
                               │ generated TS types + circuit bindings
                               ▼
   ┌───────────────────────────────────────────────────┐
   │        API layer (midnight.js providers)          │  ← the day-1 interface
   │  hire · acceptHire · approveHours · confirm · …   │     everyone codes against
   └───────┬──────────────────┬────────────────┬───────┘
           │                  │                │
           ▼                  ▼                ▼
   ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐
   │ Employer app  │  │ Worker app    │  │ Auditor view      │
   │ hire, approve │  │ accept, salt  │  │ read-only; talks  │
   │ hours, PAY    │  │ custody,      │  │ to the INDEXER,   │
   │ (shielded     │  │ confirm       │  │ not the contract  │
   │  transfer)    │  │               │  │                   │
   └───────────────┘  └───────┬───────┘  └───────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │ local proof server │  ← private data never leaves the device
                    │ :6300, Docker      │
                    └────────────────────┘

   Infrastructure (local devnet): node :9944 · indexer :8088 · proof server :6300
```

Three structural decisions worth stating once:

1. **Payments bypass the contract entirely** — employer wallet → worker wallet, shielded. The contract verifies; it never custodies.
2. **The auditor view reads the [Indexer GraphQL API v4](https://docs.midnight.network/api-reference/midnight-indexer)**, not the contract. Auditing is reading public state; it needs no wallet, no proofs, no permissions. That also makes it buildable completely in parallel.
3. **Proofs are generated on the worker's device via the local proof server** — the pattern every official example uses, and the difference between this product and a web form that promises not to look. The tempting shortcut under deadline pressure is checking `amount == hours × rate` on our own backend; it demos identically and is not the same product. Named here so nobody discovers it during judging.

---

# Part 4 — The team plan

Five people. The plan is built around one observation: **the critical path runs through the contract, and only one person can hold the compiler at a time.** Everyone else's work is arranged to either (a) not need the contract, (b) need only its *interface*, or (c) be research that de-risks a later phase.

## 4.1 The coordination move that makes parallel work possible

**Day 1, before anyone writes real code, the team agrees a `PayrollApi` TypeScript interface** — the exact function signatures the API layer will expose (`hire`, `acceptHire`, `approveHours`, `confirmPayment`, `proveContribution`, `getHistory`, `getUnconfirmed`). It lives in one file. Both app builders code against a **mock implementation** of it from hour one; the integration lead's job is to replace the mock with the real thing without changing the interface.

This one file is what lets three people build UIs and tests while the contract is still fighting the compiler. Skipping it is how five-person teams end up as one person typing and four people watching.

## 4.2 Roles

| | Role | Owns | Grounding to study first |
|---|---|---|---|
| **A** | **Contract lead** | `payroll.compact`, all circuits, compilation, the arithmetic spike | MIDSKILLS [`compact`](https://github.com/Kali-Decoder/Midnight-skills) + [Writing a contract](https://docs.midnight.network/compact/reference/writing) + [Smart contract security](https://docs.midnight.network/compact/smart-contract-security) |
| **B** | **Integration lead** | midnight.js provider wiring, deployment, generated types, the real `PayrollApi`, **the shielded-transfer spike** | MIDSKILLS [`midnight-js`](https://github.com/Kali-Decoder/Midnight-skills) + [`token-transfers`](https://github.com/Kali-Decoder/Midnight-skills) + [shielded token tutorial](https://docs.midnight.network/tokens/shielded-token) + [deploy and operate](https://docs.midnight.network/guides/deploy-and-operate) |
| **C** | **Worker-app lead** | Worker UI: accept hire, **salt custody**, confirm flow, the "what the chain sees" panel | MIDSKILLS [`react-wallet-connector`](https://github.com/Kali-Decoder/Midnight-skills) + [React wallet connector guide](https://docs.midnight.network/guides/react-wallet-connect) + [`1am-wallet`](https://github.com/Kali-Decoder/Midnight-skills) (shielded by default) |
| **D** | **Employer-app lead** | Employer UI: hire, approve hours, pay (shielded send), end employment; later the **DUST sponsorship** flow | Same wallet material as C + [DUST sponsorship guide](https://docs.midnight.network/guides/dust-sponsorship) + [example-private-party's SPONSORSHIP.md](https://github.com/midnightntwrk/example-private-party/blob/main/docs/SPONSORSHIP.md) |
| **E** | **Verification lead** | Auditor view (indexer), the vitest suite, the demo script, README, the privacy audit | MIDSKILLS [`midnight-indexer`](https://github.com/Kali-Decoder/Midnight-skills) + [`testing`](https://github.com/Kali-Decoder/Midnight-skills) + [Indexer API v4](https://docs.midnight.network/api-reference/midnight-indexer) + [testkit](https://docs.midnight.network/api-reference/testkit-js) |

Role E is not the junior seat. The auditor screen **is the demo** — the moment a regulator's view shows ✅ *every period confirmed* next to ❌ *no salary readable anywhere* is the entire pitch, and the failure-case walkthrough lives there too.

## 4.3 What runs in parallel and what cannot

```
PHASE 0 — everyone, together, first session
═══════════════════════════════════════════
  WSL2 + Docker + Compact toolchain + local devnet + proof server
  └─ gate: `compact compile --version` → 0.31.1, devnet up, everyone
     has deployed and called the hello-world counter once

PHASE 1 — five parallel tracks, no dependencies between them
════════════════════════════════════════════════════════════
  A: SPIKE-ARITH  read the Compact-arithmetic section, write a tiny
                  contract multiplying two Uint<64>s, test the edges     (day 1)
     then: hire / acceptHire / confirmPayment circuits                   (days 1–3)
  B: SPIKE-PAY    prove a shielded wallet-to-wallet transfer works on
                  the local devnet and the recipient sees the value      (day 1)
     then: providers + deployment scripts against the counter example    (days 1–3)
  C: worker UI on the MOCK PayrollApi                                    (days 1–3)
  D: employer UI on the MOCK PayrollApi                                  (days 1–3)
  E: auditor view against the indexer using the counter example's
     public state; vitest harness with explicit block-time contexts      (days 1–3)

  ⚠ SPIKE-PAY is the project's kill-switch. If shielded transfer
    between two dev wallets doesn't work day 1, the team decides
    IMMEDIATELY: fall back to unshielded payment (amounts public,
    every proof still works) and say so honestly, or fix forward.
    This decision cannot wait until integration week.

PHASE 2 — the merge (sequential, the critical path)
═══════════════════════════════════════════════════
  A's contract compiles ──► B swaps mock for real PayrollApi
                        ──► C and D re-point their UIs (interface
                            unchanged — that was the point)
                        ──► E runs the suite against the real thing
  └─ gate: hire → accept → approve → pay (shielded) → confirm → auditor
     shows ✅, all on localnet, driven from the UIs

PHASE 3 — parallel again, on top of the working loop
════════════════════════════════════════════════════
  A: proveContribution + endEmployment circuits
  B: DUST sponsorship (employer pays workers' fees)      } B+D pair here
  D: sponsorship UX in the employer app                  }
  C: employment-history view (reads the same confirmations)
  E: the FAILURE demo: underpay → confirm rejected → period
     permanently unconfirmed on the auditor screen; privacy-
     regression tests (dump the ledger, assert no salary anywhere)

PHASE 4 — convergence
═════════════════════
  Freeze features. E owns the demo run-through; A+E run the privacy
  audit; C polishes the public-vs-private panel; B tags versions;
  D records the walkthrough. Everyone rehearses the failure case.
```

## 4.4 Who researches while blocked

Blocking is inevitable; idle is a choice. Standing assignments for anyone whose track is waiting:

| If you're blocked on… | Spend the time on… |
|---|---|
| The contract compiling (C, D) | Salt-custody design: read [`level-private-state-provider`](https://docs.midnight.network/examples/dapps/zkloan) usage in the zkloan example — encrypted private state, 16+ char password. Losing the salt must never lose the money; decide what it *does* lose and write it down. |
| The real API (E) | Write the test matrix below as *failing* tests against the mock — they become the acceptance suite the moment the real API lands. |
| The shielded spike (B, briefly) | Read [networks and environments](https://docs.midnight.network/guides/networks-and-environments) and script the `undeployed → preview` promotion, so moving to a public testnet later is config, not surgery. |
| Anything (A) | A is never blocked; A is the bottleneck. Protect A's time — questions to A go through one channel, batched. |
| Everything (anyone) | Read [our privacy model](../docs/midnight-privacy-model.md) again and try to break the design. The best finding before integration week is worth a day of fixing after it. |

## 4.5 Definitions of done

A task is done when its gate passes, not when it "basically works":

- **Contract v1**: compiles under `0.31.1`; a wrong salt, wrong rate, wrong hours, and wrong amount are each rejected with the right message; the multiplication spike's edge cases are tests, not memories.
- **Integration**: the mock and real `PayrollApi` are interchangeable behind one import; deploy-to-localnet is one script.
- **Worker app**: a person who has never seen the project can accept a hire and confirm a payment without being told how; the salt survives a page reload; the public-vs-private panel is accurate.
- **Employer app**: hire → approve → pay in one sitting; the shielded send visibly leaves the employer wallet and arrives in the worker wallet.
- **Auditor view**: shows every worker-period as ✅/✗ with **no wallet connected at all** — that it needs no permission is itself the demo point.
- **Suite**: money-free by design, so it runs entirely on circuit contexts with [explicit block times](https://docs.midnight.network/guides/security-best-practices); green in CI.

---

# Part 5 — Grounding: every task mapped to its source

The user-facing rule for this repo applies to the team too: **never state a Compact fact from training data.** This table is where each piece of work gets its truth from.

| Task | MIDSKILLS skill | Official documentation |
|---|---|---|
| Environment (all) | [`midnight-environment-setup`](https://github.com/Kali-Decoder/Midnight-skills) | [Installation](https://docs.midnight.network/getting-started/installation) · [Windows/WSL2 setup](https://docs.midnight.network/guides/windows-compact-setup) |
| First deploy (all) | [`example-counter`](https://github.com/Kali-Decoder/Midnight-skills), [`hello-world`](https://github.com/Kali-Decoder/Midnight-skills) | [Quickstart / create-mn-app](https://docs.midnight.network/getting-started/quickstart) |
| Circuits (A) | [`compact`](https://github.com/Kali-Decoder/Midnight-skills) | [Writing a contract](https://docs.midnight.network/compact/reference/writing) · [Ledger data types](https://docs.midnight.network/compact/data-types/ledger-adt) · [Std library](https://docs.midnight.network/compact/standard-library) |
| Commitments & auth (A) | [`security`](https://github.com/Kali-Decoder/Midnight-skills) | [Smart contract security](https://docs.midnight.network/compact/smart-contract-security) · [Explicit disclosure](https://docs.midnight.network/compact/reference/explicit-disclosure) |
| Arithmetic spike (A) | — | [Security and best practices → Compact arithmetic behavior](https://docs.midnight.network/guides/security-best-practices) |
| Attestation pattern, if extended (A) | [`example-zk-loan-application`](https://github.com/Kali-Decoder/Midnight-skills) | [ZK Loan tutorial](https://docs.midnight.network/tutorials/zk-loan/smart-contract) |
| Shielded payment spike (B) | [`token-transfers`](https://github.com/Kali-Decoder/Midnight-skills) | [Shielded token tutorial](https://docs.midnight.network/tokens/shielded-token) · [Zswap](https://docs.midnight.network/concepts/how-midnight-works/zswap) |
| Providers & deploy (B) | [`midnight-js`](https://github.com/Kali-Decoder/Midnight-skills), [`multinetwork`](https://github.com/Kali-Decoder/Midnight-skills) | [Midnight.js](https://docs.midnight.network/sdks/official/midnight-js) · [Deploy and operate](https://docs.midnight.network/guides/deploy-and-operate) · [Networks](https://docs.midnight.network/guides/networks-and-environments) |
| Wallet connect (C, D) | [`react-wallet-connector`](https://github.com/Kali-Decoder/Midnight-skills), [`1am-wallet`](https://github.com/Kali-Decoder/Midnight-skills) | [React wallet connector](https://docs.midnight.network/guides/react-wallet-connect) · [Community wallets](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview) |
| Salt custody (C) | — | [ZK Loan example — level-private-state-provider](https://docs.midnight.network/examples/dapps/zkloan) |
| Fee sponsorship (B+D) | [`example-private-party-dapp`](https://github.com/Kali-Decoder/Midnight-skills) | [DUST sponsorship](https://docs.midnight.network/guides/dust-sponsorship) |
| Auditor / indexer (E) | [`midnight-indexer`](https://github.com/Kali-Decoder/Midnight-skills) | [Indexer API v4](https://docs.midnight.network/api-reference/midnight-indexer) — `contractAction` query, `contractActions` subscription |
| Test suite (E) | [`testing`](https://github.com/Kali-Decoder/Midnight-skills) | [Test and debug](https://docs.midnight.network/compact/test-and-debug) · [testkit-js](https://docs.midnight.network/api-reference/testkit-js) · the vitest pattern in [security best practices](https://docs.midnight.network/guides/security-best-practices) |
| Versions (B) | — | [Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix) — pin: compiler 0.31.1, runtime 0.16.0, midnight.js 4.1.1, wallet SDK **exactly** 1.2.0, proof server 8.1.0. Node.js ≥ 22. |
| AI-assisted verification (all) | — | [Midnight Expert](https://docs.midnight.network/ai-integration/midnight-expert) — `/midnight-verify:verify`, `/midnight-expert:doctor` · [Kapa MCP](https://docs.midnight.network/ai-integration/kapa-mcp-server) |

Install the MIDSKILLS set once per machine so the assistant has them: `npx skills add Kali-Decoder/Midnight-skills -a claude-code -y`. One honesty note carried from [the docs map](../docs/midnight-docs-map.md): the MIDSKILLS registry descriptions were verified against its `skills.json`; the individual SKILL.md bodies load into the assistant on install and are the assistant's problem to apply — the *authoritative* source for any conflict is always docs.midnight.network, and MIDSKILLS is community-maintained.

---

# Part 6 — Tests

Written by E, against the mock first (as failing tests), then the real contract. The suite needs no tokens — every circuit here handles hashes, which is why it can run entirely in circuit contexts.

**The seal**
- Wrong amount cannot confirm (the underpayment case — this is the demo, make it a test first)
- Wrong salt cannot confirm; wrong rate cannot confirm
- `acceptHire` fails when the sealed rate differs from what the worker was told
- After a full run, dump the ledger: **no rate, no amount, no derived value of either, anywhere**

**The arithmetic**
- `hours × rate` at realistic payroll values; at the documented edges from the arithmetic spike
- Salaried (hours = 1) and milestone (hours = 1, rate = fee) through the same circuit

**The lifecycle**
- Confirm before hours are approved → rejected
- Double-confirm a period → rejected
- Confirm after `endEmployment` → decide and test the intended behaviour (design choice — document it)
- History view: join = first confirmed, leave = last, the gap month shows as the gap month

**The contribution**
- Correct declaration passes; one unit under fails; the sealed rate is not derivable from either outcome

**Conservation of nothing**
- The contract balance is zero before, during, and after everything. It should never hold a coin; assert it.

---

# Part 7 — The demo, five minutes

1. **The problem, fifteen seconds.** "Your salary is in a database your employer controls, your payslip is a PDF they produced, and if your pension contributions were under-declared you find out in twenty years."
2. **Hire.** Seal 5,000 on-chain. Show the 32 bytes. Offer the audience the chance to read it.
3. **Karim accepts** — and mention what just silently happened: if the sealed number weren't 5,000, this click would have failed.
4. **Payday.** Shielded transfer, employer wallet to worker wallet. Show both wallets. Show the chain showing *nothing*.
5. **Confirm.** The auditor screen — no wallet connected — gains a ✅ for March.
6. **The moment.** Pay April at 4,000. Karim tries to confirm. **Rejected, live.** April stays ✗ on a public ledger while the number stays sealed. Repeat the sentence: *the system cannot record a wrong payment as correct.*
7. **The trail.** Twelve months on screen: an employment certificate the worker owns, and a contribution record the fund could check today.
8. **The honest slide.** Public: that the relationship exists, hours, timing, ✅/✗. Private: every number. Not built: degree/age checks (same circuit, different issuer — slide only), the ClickUp pull (convenience, not trust).

Step 6 is the demo. Everything before it is setup; everything after it is consequences.

---

# Part 8 — Honest limits

- **Participation is visible.** Two pseudonyms with a monthly rhythm are legible as an employment relationship. Content is sealed; existence and timing are not.
- **Pseudonym ≠ anonymous.** Within this contract the worker's confirmations are linkable to each other — that's what makes the history valuable, and it's a trade, stated openly.
- **The worker can decline to confirm** a correct payment out of spite; the employer's recourse is off-chain, like any dispute. The system proves payments *right*, it cannot force confirmations.
- **An employer can pay cash off the books** exactly as before. NightShift binds what was *agreed on-chain*; it cannot see around itself.
- **SPIKE-PAY may fail.** If contract-external shielded transfer misbehaves on the devnet, the fallback — unshielded payment with every proof intact — loses "amounts hidden in transit" but keeps the sealed rate, the confirmations, the history, and the contribution proofs. That fallback is stated here in advance so choosing it is a decision, not an embarrassment.
- **The fund and the employers have to want this.** Adoption is the hard problem, and the honest answer is that the worker-side value (evidence they hold themselves) exists even at zero institutional adoption.
- **Nothing here is compiled yet.** Every snippet is a sketch until the compiler says otherwise — the repo rule, applied to its own plan.

---

*Companions: [kickoff task board](NightShift_Kickoff_Task_Board.md) · [privacy model](../docs/midnight-privacy-model.md) · [docs map](../docs/midnight-docs-map.md) · [engineering standards](../CLAUDE.md) · [.claude setup](../.claude/README.md)*
