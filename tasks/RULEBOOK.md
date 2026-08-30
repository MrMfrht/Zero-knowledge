# NightShift — Team Rule Book

One page. Read it once, keep it open.

---

## Who does what

| You are | Your file | Your folder | Your branch | Need WSL? |
|---|---|---|---|---|
| **A** — Contract | [01-contract.md](01-contract.md) | `packages/contract/` | `contract` | **YES** |
| **B** — Integration | [02-integration.md](02-integration.md) | `packages/api/` | `api` | **YES** |
| **C** — Worker app | [03-worker-app.md](03-worker-app.md) | `packages/worker-app/` | `worker-app` | **No** |
| **D** — Employer app | [04-employer-app.md](04-employer-app.md) | `packages/employer-app/` | `employer-app` | **No** |
| **E** — Auditor view | [05-auditor.md](05-auditor.md) | `packages/auditor/` | `auditor` | **No** |

**All branches come off `dev` and merge back into `dev`.** `main` is not used
during the build — a plain `git clone` lands you on it and it is nearly empty,
so run `git checkout dev` first.

Only the two people who compile smart contracts need WSL. Everyone else works normally on Windows, Mac, or Linux.

New here? Start with [COMMON.md](COMMON.md), then open your own file.

**Two folders are not your scope unless they are yours:** `A_docs/` is deep contract
detail for A, `D_docs/` is the backend plan for D. Ignore them otherwise — your task
file and [packages/api/README.md](../packages/api/README.md) are everything you need.

Want to understand *why* any of this works — salts, commitments, zero-knowledge, in plain language? **[01-contract-EXPLAINED.md](../A_docs/01-understanding-the-contract.md)**. Written for A, useful to everyone.

Before the demo, everyone reads **[JUDGE-QUESTIONS.md](JUDGE-QUESTIONS.md)** — the questions judges actually ask, honest answers, and who on the team answers what.

Writing code? Read **[packages/README.md](../packages/README.md)** first (what the folders are, three minutes), then **[packages/api/README.md](../packages/api/README.md)** — the API guide, one section per person.

---

## Everyone can start today

Nobody waits for anybody:

- **C and D** build their screens with fake hardcoded data. Layout does not need a blockchain.
- **E** queries a live public server right now, zero setup: `https://indexer.preview.midnight.network/api/v4/graphql`
- **A** reads three doc pages and runs the hello-world example.
- **B** runs the payment spike the moment Docker is working.

If you are waiting for someone, you have picked the wrong next task. Check your file again.

---

## The five rules

### 1. Only `packages/api/` may import `@midnight-ntwrk/*`

No UI file ever imports the Midnight SDK. If you think you need it, **the interface is missing something — ask.** Do not work around it.

*Why: if Midnight changes, one file changes instead of five apps.*

### 2. Secret keys and salts never leave the browser

Never send them to a server. Never log them. Never put them in a URL.

*Why: this is the entire product. If a server can hold a salt, that server can read everyone's salary, and we have built a normal payroll app with extra steps.*

### 3. One folder, one branch, one owner — and never touch root files

**Ports, agreed once:** worker-app `3000` · employer-app `3001` · backend `3002` · auditor `3003`. Proof server `6300`, indexer `8088`, node `9944` are fixed by Midnight.

**Nobody edits root `package.json`, `tsconfig.base.json`, or `.gitignore`.** They are the only files two people would both need to change, and therefore the only realistic source of merge conflicts. Need a change? Ask the lead, they make it once, everyone pulls.


Edit only your own folder. Pull from **`dev`** often — that is the branch everything merges into.

Two things belong to the lead, not to you: `packages/shared/` and `packages/api/src/PayrollApi.ts`. **Ask before touching either.** Five people build against them.

Need something the interface does not give you? That is a missing method, not a reason to reach around it. Say so — including B, especially B.

### 4. Never guess at Compact or Midnight syntax

AI models invent Compact that looks perfect and does not compile. The official docs open with that exact warning.

33 Midnight skills are already in this repo and load automatically in Copilot, Codex, Antigravity, Cursor and ~70 other tools. Beyond those, use the **Ask AI** button on [docs.midnight.network](https://docs.midnight.network/), or add the docs MCP server to your editor (Ask AI → Use MCP).

*A wrong guess costs an hour of debugging. Looking it up costs a minute.*

### 4b. If you compile contracts (A and B only): always use `--skip-zk`

```bash
compact compile --skip-zk src/payroll.compact src/managed
```

A plain `compact compile` also builds zero-knowledge proving keys — minutes, every time. `--skip-zk` checks correctness only, in seconds. Drop the flag once, at the end, when B needs the real keys.

### 5. Nothing is private just because you called it private

Anything written into a `Map`, a `Set`, or a plain ledger field is **visible to the entire world**. Naming a variable `privateSalary` does not hide it.

Only sealed commitments hide a value. If a screen or a README says something is private, check it against what the blockchain actually stores.

---

## Three "no" answers you will need

People will ask for these. The answer is no, and the reason matters:

- **"Add an edit-salary button to the employer app."** No. The salary is sealed and unchangeable. That is the product.
- **"Add a login to the auditor view."** No. Anyone being able to verify without permission *is* the feature.
- **"Just check the payment on our server, it is faster."** No. Then our server holds the private data, and the whole claim collapses.

---

## How the pieces join

```
   A writes payroll.compact
        │  compiles to →  managed/   (A commits this to git)
        ▼
   B wraps it in packages/api/
        │   PayrollApi interface
        │   ├── fake version   ← C, D, E use this from day one
        │   └── real version   ← B builds it
        ▼
   ┌────────────┬────────────────┬──────────────┐
   ▼            ▼                ▼
 C worker     D employer      E auditor
 accept &     hire, approve,  reads the chain,
 confirm      pay             no wallet needed
```

**The key detail:** C, D and E build against the *fake* API today. When B finishes the real one, they change which version they import — **and nothing else in their code changes.** That is why the interface was agreed before anyone wrote a line.

---

## What we are building, in four sentences

An employer pays workers in Midnight's private currency, so nobody can see the amounts. When someone is hired, both sides lock the agreed salary into a sealed value on the blockchain that nobody can read and nobody can change afterwards.

Each payday, the worker proves the money they received matches that sealed agreement. The blockchain records one public fact — **paid correctly** or **not confirmed** — and never the salary itself.

---

## The demo we are building toward

An employer pays 4,000 when 5,000 was agreed.

The worker tries to confirm it. **The app refuses** — the maths does not match the sealed agreement. That month stays publicly unconfirmed forever, while the actual salary stays unreadable to everyone on earth.

> The system cannot record a wrong payment as correct. Not *should not*. **Cannot.**

Every task in this project exists to make that moment work. If you are unsure whether something matters, ask whether it helps that scene.

---

## Stuck?

| Problem | Go here |
|---|---|
| A Midnight or Compact question | **Ask AI** on [docs.midnight.network](https://docs.midnight.network/) |
| Setup broken | The troubleshooting section of your own task file |
| The API does not do what you need | Ask B and the lead — do not bypass it |
| Anything unclear in your task file | Ask the lead. Do not guess |
| New to Midnight entirely | [academy.midnight.network](https://academy.midnight.network/) — short guided lessons |
