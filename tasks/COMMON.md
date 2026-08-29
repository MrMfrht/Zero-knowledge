# COMMON — do this before you start your task

Everyone does this. It takes about 20 minutes. Then open your own task file.

> Keep **[RULEBOOK.md](RULEBOOK.md)** open while you work — it is the one-page summary of everything here.

---

## 1. Find your task

| You are | Your file | Do you need WSL? |
|---|---|---|
| A — Contract | [01-contract.md](01-contract.md) | **YES** |
| B — Integration | [02-integration.md](02-integration.md) | **YES** |
| C — Worker app | [03-worker-app.md](03-worker-app.md) | **No** |
| D — Employer app | [04-employer-app.md](04-employer-app.md) | **No** |
| E — Auditor view | [05-auditor.md](05-auditor.md) | **No** |

Only the two people who compile smart contracts need WSL. Everyone else works normally on Windows, Mac, or Linux.

---

## 2. Install Node.js 22 or newer

Everyone needs this. Download from [nodejs.org](https://nodejs.org/).

```bash
node --version
```

Must print **v22** or higher. Node 20 crashes with the Midnight SDK — this is not optional.

---

## 3. Get the repo and make your branch

```bash
git clone <repo-url>
cd nightshift
npm install
```

Now create your own branch. **Use your own name from the table:**

```bash
git checkout -b feat/contract        # A
git checkout -b feat/api             # B
git checkout -b feat/worker-app      # C
git checkout -b feat/employer-app    # D
git checkout -b feat/auditor         # E
```

**You only edit files inside your own folder.** Nobody else touches it, and you touch nobody else's. That way we never get merge conflicts.

| You | Your folder |
|---|---|
| A | `packages/contract/` |
| B | `packages/api/` |
| C | `packages/worker-app/` |
| D | `packages/employer-app/` |
| E | `packages/auditor/` |

Two folders belong to nobody and are read-only for everyone: `packages/shared/` (shared types) and the interface file inside `packages/api/`. The lead maintains those. If you need something added to them, **ask** — do not edit them yourself.

---

## 4. Set up AI help

You do not need Claude Code. You do need something, because **AI models invent Compact syntax that looks correct and does not compile.** The official docs open with that exact warning.

Pick one:

- **Easiest:** go to [docs.midnight.network](https://docs.midnight.network/) and use the **Ask AI** button. Works in the browser, no setup.
- **Better:** on that same site click **Ask AI → Use MCP → Add to Cursor** (or VS Code). One click. Now your editor answers from the real documentation.

**Rule for everyone: never guess at Midnight or Compact syntax. Look it up or ask.** A wrong guess costs an hour of debugging.

New to Midnight? [academy.midnight.network](https://academy.midnight.network/) has short guided lessons. Worth 30 minutes.

---

## 5. Wait for one thing from the lead

The lead is pushing two things to `main`:

- `packages/shared/` — the shared TypeScript types
- `packages/api/` — the `PayrollApi` interface **and a fake version of it**

The fake version is important. It means **C, D and E can build their entire app without the smart contract existing.** You call `payrollApi.confirmPayment(...)` and get sensible fake data back. Later B replaces the fake with the real thing, and your code does not change at all.

Until that lands, C/D/E can still scaffold their app and build screens with hardcoded data.

---

## What the project is, in four sentences

An employer pays workers in Midnight's private currency, so nobody can see the amounts. When someone is hired, both sides lock the agreed salary into a sealed value on the blockchain that nobody can read and nobody can change afterwards.

Each payday, the worker proves the money they received matches that sealed agreement. The blockchain records one public fact — **paid correctly** or **not confirmed** — and never the salary itself.

The demo moment: an employer underpays, and the worker **cannot** confirm it even if they wanted to. That month stays publicly unconfirmed forever, while the actual salary stays unreadable.

Full detail if you want it: [NightShift build plan](../Ideas/NightShift_Private_Payroll_Midnight.md).

---

## Rules that apply to everyone

1. **Only import the Midnight SDK (`@midnight-ntwrk/*`) inside `packages/api/`.** Never in a UI file. If you think you need it, the interface is missing something — ask.
2. **Never send a secret key or a salt to any server.** Those stay in the browser. This is the whole product.
3. **One folder, one branch, one owner.** Pull from `main` often.
4. **Ask before editing `shared/` or the API interface.**

---

## Stuck?

- Midnight question → the **Ask AI** button on [docs.midnight.network](https://docs.midnight.network/)
- Something in your task file is unclear → ask the lead, do not guess
- Broken setup → check the troubleshooting notes in your own task file first
