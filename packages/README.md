# `packages/` — what all this is

Read this before anything else in here. It takes three minutes.

---

## The short version

There is a **working fake payroll system** here with no blockchain behind it, which already enforces all the real rules — and, next to it, the **real contract**, which compiles and runs.

You build your app against the fake, today. When B finishes the real blockchain version, **one line in your app changes** and nothing else.

---

## What is actually here

```
packages/
├── shared/                         FOLDER 1 — the words we all agree on
│   └── src/index.ts                  "a WorkerKey is a string, a Period is 2026-03…"
│
├── api/                            FOLDER 2 — the thing your app calls
│   ├── src/PayrollApi.ts             the list of 15 functions your app can call
│   ├── src/errors.ts                 the error types your app catches
│   ├── src/mock/MockPayrollApi.ts    a fake that really works, no blockchain
│   ├── src/midnight/                 B's real wallet + payment code
│   ├── src/index.ts                  "here is what this folder gives you"
│   └── README.md                     👈 THE GUIDE — a section for each of you
│
└── contract/                       FOLDER 3 — the real smart contract (A)
    ├── src/payroll.compact           the rules: six circuits, all compiling
    ├── src/witnesses.ts              hands a caller's secret to a circuit
    ├── src/managed/                  compiler output — never edit, committed on purpose
    ├── smoke.mjs                     the whole lifecycle, run locally: `npm run smoke`
    └── README.md                     how to build it
```

**You do not need `contract/` to build your app.** It is there so B can wire the
real api against it, and so anyone curious can read what the chain actually
enforces. C, D and E work entirely through `api/`.

Folders that do not exist yet — each person creates their own:

```
packages/worker-app/     C
packages/employer-app/   D
packages/auditor/        E
```

---

## `src` and `dist` — this confuses everybody, and it is simple

Every folder here will end up with both. Here is the whole story:

| | Full name | What it is | Do you touch it? |
|---|---|---|---|
| **`src`** | **s**ou**rc**e | The code a human wrote, in TypeScript | **Yes.** This is the real code |
| **`dist`** | **dist**ribution | Plain JavaScript the computer generated from `src` | **No. Never.** |

You edit `src/index.ts` → you run `npm run build` → the computer creates `dist/index.js`.

Why? Browsers cannot run TypeScript, only JavaScript. `dist` is the translated copy.

Three things worth knowing:

- **`dist` is not in git.** It is in `.gitignore`. You will not see it in a pull request and you should not.
- **If `dist` looks wrong, delete it and run `npm run build` again.** Nothing is lost — it is regenerated from `src` every time.
- **Never open a file in `dist` to understand something.** It is machine output. Read `src`.

---

## Why two folders and not one

| Folder | Rule |
|---|---|
| **`shared`** | Just words — types, no logic. Depends on **nothing**. Anything may import it. |
| **`api`** | The **only** folder in the whole project allowed to talk to Midnight. |

When B writes the real blockchain code, it goes in `api` and nowhere else.

That is the anti-spaghetti rule from [CLAUDE.md](../CLAUDE.md): if Midnight changes, **one folder changes, not five apps.**

It is also why you must never write `import ... from '@midnight-ntwrk/...'` in an app. If you feel you need to, the interface is missing a method — say so, do not work around it.

---

## Getting started — 30 seconds

From the repo root, once:

```bash
npm install
npm run build
```

Then in your app:

```ts
import { MockPayrollApi, DEMO_KARIM } from '@nightshift/api';

const api = new MockPayrollApi({ actingAs: DEMO_KARIM });

const record = await api.getEmploymentRecord(DEMO_KARIM);
console.log(record.periods);
// [{ period: '2026-01', status: 'confirmed', hours: 1, contributionVerified: true }, …]
```

That is the whole thing. You call functions, you get data. You never see a blockchain, a wallet, `src`, or `dist`.

---

## The fake is not a toy

`MockPayrollApi` enforces the same rules the real contract will, so the important moments work **today**:

| You try to… | What happens |
|---|---|
| Accept an offer with the wrong salary | ❌ `OfferMismatchError` — the employer sealed a different number than they told you |
| Confirm a payment with the wrong amount | ❌ `PaymentMismatchError` — **this is the demo** |
| Read anyone's public record | ✅ Works, and there is **no salary in it anywhere** |

Three workers are already seeded so you have something on screen from minute one:

| Constant | Who | Why you would use them |
|---|---|---|
| `DEMO_KARIM` | Salaried, 5000/month | Everything confirmed — the happy path |
| `DEMO_DANA` | Hourly, 85/hour | Varying hours, latest month still open |
| `DEMO_SAM` | Salaried, 4200/month | **March is unconfirmed** — build the ✗ screen against this |

---

## Where to go next

| You are | Read |
|---|---|
| **Anyone writing code** | **[api/README.md](api/README.md)** — the guide. It has a section for each of C, D, E and B, with code you can paste |
| A — Contract | [tasks/01-contract.md](../tasks/01-contract.md) |
| B — Integration | [tasks/02-integration.md](../tasks/02-integration.md), then the "For B" section of the guide |
| C — Worker app | [tasks/03-worker-app.md](../tasks/03-worker-app.md), then "For C" |
| D — Employer app | [tasks/04-employer-app.md](../tasks/04-employer-app.md), then "For D" |
| E — Auditor view | [tasks/05-auditor.md](../tasks/05-auditor.md), then "For E" |
| Lost | [tasks/RULEBOOK.md](../tasks/RULEBOOK.md) — one page, the whole project |

---

## Three rules

1. **Only `packages/api/` may import `@midnight-ntwrk/*`.** Never in an app.
2. **Never send a salt or a secret key to a server**, a log, or a URL. They stay in the browser. This is the entire product.
3. **Only the lead edits `shared/` and `api/src/PayrollApi.ts`.** Five people build against them. Need a change? Ask — that includes B.
