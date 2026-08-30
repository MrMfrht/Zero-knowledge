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
git clone https://github.com/MrMfrht/Zero-knowledge.git
cd Zero-knowledge
git checkout dev          # ⚠️ IMPORTANT — see below
npm install
```

> **You must switch to `dev`.** A plain `git clone` puts you on `main`, which is
> almost empty. All the work lives on `dev`. If you cannot see a `tasks/` folder
> and a `packages/` folder, you are on the wrong branch.

Now create your own branch **off `dev`**:

```bash
git checkout -b contract        # A
git checkout -b api             # B
git checkout -b worker-app      # C
git checkout -b employer-app    # D
git checkout -b auditor         # E
```

When you have something working, merge back into `dev`, not into `main`.

**You only edit files inside your own folder.** Nobody else touches it, and you touch nobody else's. That way we never get merge conflicts.

| You | Your folder | Your branch |
|---|---|---|
| A | `packages/contract/` | `contract` |
| B | `packages/api/` | `api` |
| C | `packages/worker-app/` | `worker-app` |
| D | `packages/employer-app/` | `employer-app` |
| E | `packages/auditor/` | `auditor` |

All branches come off **`dev`** and merge back into **`dev`**.

Two folders belong to nobody and are read-only for everyone: `packages/shared/` (shared types) and the interface file inside `packages/api/`. The lead maintains those. If you need something added to them, **ask** — do not edit them yourself.

---

## 4. AI help — mostly already done

**You do not need Claude Code.** 33 Midnight skills are already committed to this repo, and your assistant picks them up automatically when you clone.

They work in **GitHub Copilot, Codex, Antigravity, Cursor, Gemini CLI, Windsurf, Zed, Cline, Roo, Continue** and about 70 other tools — they all read the same `.agents/skills/` folder. Nothing to install.

Two things worth doing yourself:

**Add the Midnight docs server to your editor.** Go to [docs.midnight.network](https://docs.midnight.network/) → **Ask AI → Use MCP → Add to Cursor** (or VS Code). One click, and your assistant answers from the real documentation instead of guessing. Any MCP-capable tool works — the config is in `.mcp.json` at the repo root if you need to paste it manually.

**Or just use the Ask AI button** on that site. Browser, no setup, works for everyone.

> **The one rule: never guess at Midnight or Compact syntax.** AI models invent Compact that looks perfect and does not compile — the official docs open with that exact warning. Looking it up costs a minute; guessing costs an hour.

New to Midnight? [academy.midnight.network](https://academy.midnight.network/) has short guided lessons. Worth 30 minutes.

---

## 5. Read the API guide

The lead has already pushed the two packages everything else is built on:

- `packages/shared/` — the shared TypeScript types
- `packages/api/` — the `PayrollApi` interface **and a working fake of it**

**New to this folder? Start with [packages/README.md](../packages/README.md)** — it explains what `src` and `dist` are, why there are two folders, and how to run it. Three minutes.

**→ Then [packages/api/README.md](../packages/api/README.md) is the guide. It has a section for each of C, D, E and B, with real code you can paste.**

The fake matters: **C, D and E can build their entire app today, without the smart contract existing.** You call `api.confirmPayment(...)` and get real behaviour back — including the failure case, which the mock enforces exactly as the contract will. When B finishes the real version, you change one line and nothing else.

Try it right now:

```bash
npm install && npm run build
```

```ts
import { MockPayrollApi, DEMO_SAM } from '@nightshift/api';
const api = new MockPayrollApi({ actingAs: DEMO_SAM });
console.log((await api.getEmploymentRecord(DEMO_SAM)).periods);
```

---

## What the project is, in four sentences

An employer pays workers in Midnight's private currency, so nobody can see the amounts. When someone is hired, both sides lock the agreed salary into a sealed value on the blockchain that nobody can read and nobody can change afterwards.

Each payday, the worker proves the money they received matches that sealed agreement. The blockchain records one public fact — **paid correctly** or **not confirmed** — and never the salary itself.

The demo moment: an employer underpays, and the worker **cannot** confirm it even if they wanted to. That month stays publicly unconfirmed forever, while the actual salary stays unreadable.

Curious how it actually works — what a salt is, how a sealed salary can still be checked? **[01-contract-EXPLAINED.md](../A_docs/01-understanding-the-contract.md)** explains it from zero.

Full detail if you want it: [NightShift build plan](../Ideas/NightShift_Private_Payroll_Midnight.md).

---

## Before the demo

Everyone reads **[JUDGE-QUESTIONS.md](JUDGE-QUESTIONS.md)** — what the judges ask, what the honest answers are, and which of us answers what. Do not walk into Q&A without it.

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
