# A_docs — the contract, explained

Everything here is for **A**, who writes the smart contract. It is deep detail
about Compact, zero-knowledge proofs, and how the contract works underneath.

**If you are B, C, D or E: you do not need to read any of this.** Your task file
in [`tasks/`](../tasks/) and the API guide in
[`packages/api/README.md`](../packages/api/README.md) are your scope. These
documents exist so the contract knowledge lives in one place instead of being
scattered across the repo.

*(That said, `01` is genuinely useful to anyone who wants to understand what the
project actually does. It assumes no blockchain knowledge.)*

---

## Reading order

| # | Document | What it answers |
|---|---|---|
| **01** | [Understanding the contract](01-understanding-the-contract.md) | What is a salt? A commitment? A circuit? Why does a `Map` publish your salary? Why can't `ownPublicKey()` check who is calling? And why does each of the six circuits exist? **Start here.** |
| **02** | [Files and the TypeScript bridge](02-files-and-the-typescript-bridge.md) | What is every file in `packages/contract`? Why are there two programming languages? How do they connect? The full hiring flow, step by step. |
| **03** | [Who can call a circuit](03-who-can-call-a-circuit.md) | If the secret lives on the user's machine, how do we get it? Can a stranger call `hire`? What stops them? |
| **04** | [Compact arithmetic](04-compact-arithmetic.md) | Compiled findings: Compact has **no division operator**, multiplication widens the type, and what that means for our circuits. |
| **05** | [Keys, storage and identity](05-keys-storage-and-identity.md) | Is browser storage safe? Does a worker's key prove who they are? (No — and the difference between *continuity* of identity and *verification* of it.) |
| **06** | [Open design questions](06-open-design-questions.md) | **Live register of gaps that could bite us.** Read before the demo — anything still OPEN belongs on the honest slide. |
| **07** | [The circuit map](07-circuit-map.md) | Key vs secret, why `localSk()` means "whoever is calling", **which app (C/D/E) calls each circuit and on whose machine it runs**, and circuits 3–4 explained in depth. |

Read `01` before anything else. `02` and `03` answer questions that come up once
the code starts making sense. `04` is a reference — check it before writing maths.
`07` is the one-glance map of who calls what — useful to C, D and E too, not just A.

## The one-paragraph version

The blockchain is a public notice board, so we never write a salary on it. We
write a **commitment** instead — the salary scrambled together with a large
random **salt**, which hides the number while making it impossible to change
later. To check a payment, a **circuit** runs on the worker's own device and
produces a mathematical **proof** that the payment matched the sealed agreement.
The network verifies the proof and never sees any of the numbers.

---

## Where the other things live

| | |
|---|---|
| The contract itself | [`packages/contract/src/payroll.compact`](../packages/contract/src/payroll.compact) |
| How to build it | [`packages/contract/README.md`](../packages/contract/README.md) |
| A's task checklist | [`tasks/01-contract.md`](../tasks/01-contract.md) |
| Team rules | [`tasks/RULEBOOK.md`](../tasks/RULEBOOK.md) |
| Judge Q&A prep | [`tasks/JUDGE-QUESTIONS.md`](../tasks/JUDGE-QUESTIONS.md) |
| The full project plan | [`Ideas/NightShift_Private_Payroll_Midnight.md`](../Ideas/NightShift_Private_Payroll_Midnight.md) |

## The rules that constrain every line of the contract

All four were verified by compiling, not read from a blog post:

1. **Never put a salary in a `Map`, `Set`, or ledger field.** Those are public.
   Store `persistentCommit(value, salt)` instead.
2. **Never use `ownPublicKey()` to check who is calling.** It is a witness — the
   caller's own machine decides what it returns. Identity comes from
   `persistentHash([pad(32, "nightshift:pk:"), localSk()])`.
3. **Never write `/` or `%`.** Compact has no division operator. Cross-multiply:
   `declared * 100 == rate * pct`.
4. **`disclose()` does not hide anything.** It is the opposite — it tells the
   compiler "yes, publish this."
