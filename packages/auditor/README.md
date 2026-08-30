# @nightshift/auditor

The public payment audit board. Anyone can verify that every employee was paid correctly, without being given access to anything and without ever learning what anyone earns.

**No wallet. No login. No permissions required.**

---

## What this is

The auditor view proves the core claim of NightShift: that selective disclosure works. A worker's agreed salary is sealed in a cryptographic commitment on the blockchain. When a worker confirms they received the right amount, that confirmation is recorded as a public fact. When they cannot confirm (because they were underpaid), that month stays publicly unconfirmed forever — while the salary itself stays unreadable to everyone on earth.

This screen is the final piece of proof:

> Anyone — a regulator, a journalist, a worker's lawyer, a stranger — can verify that every employee was paid correctly, **without being given access to anything, and without ever learning what anyone earns.**

---

## Running

```bash
npm run dev:auditor
```

Runs on port 3003.

---

## What you see

- **The board**: workers and months with ✅ / ✗ / ⏳ status. Large, bold, readable from across a room for projector display.
- **Unconfirmed indicator**: prominently highlights any ✗ status so it is impossible to miss.
- **Worker detail**: click a worker to see their employment record — confirmed months, unconfirmed months, and the employment dates. Never shows a salary.
- **Privacy notice**: "Salary: 🔒 sealed — not readable by anyone, including this page" appears on every worker view.

---

## How it works

The auditor view queries the blockchain's public record. It reads:

- Worker identifiers (public)
- Period-by-period confirmation status (public)
- Hours worked (public — the employer already knows them)
- Employment dates (public)

It never reads, never stores, and never displays:

- Salaries (sealed in commitments)
- Secret keys (stored on workers' devices)
- Salts (stored on workers' devices)
- Any private data of any kind

---

## Components

- **Board.tsx** — the main grid showing workers and months with status badges
- **WorkerDetail.tsx** — modal that shows a selected worker's employment record
- **UnconfirmedIndicator.tsx** — highlights unconfirmed payment periods
- **PrivacyNotice.tsx** — "Salary: 🔒 sealed" notice that appears throughout
- **App.tsx** — main component with header, board, and privacy panel explaining why this can be trusted

---

## Tests

The test suite in `App.test.ts` is the acceptance suite for the whole project. It verifies:

1. **A wrong amount cannot be confirmed** — the core demo
2. **A wrong salt cannot be confirmed** — someone else's salt must not work
3. **No salary appears anywhere** in the blockchain data — this protects the main claim
4. **Confirming the same month twice fails**
5. **Cannot confirm before hours are approved**

These tests are written now against the mock API and will remain valid when the real contract is deployed.

---

## Data source

Currently running with demo hardcoded data to show the board layout and interaction patterns. When B deploys the real contract, this will query:

```
https://indexer.preview.midnight.network/api/v4/graphql
```

The GraphQL query stays the same — only the contract address changes.

---

## Rules

1. **Never add a login.** The absence of one is the feature.
2. **Never import `@midnight-ntwrk/*`.** Read the indexer over HTTPS or through `packages/api/`.
3. **Never display a number the blockchain does not actually contain.** If this screen shows a salary, either the contract is broken or this screen is lying. Both are project-ending.

---

## Done when

- [ ] The board renders every worker and month as ✅ / ✗ / ⏳
- [ ] It works with **no wallet connected** — demonstrate this deliberately
- [ ] An unconfirmed month is impossible to miss on a projector
- [ ] "Salary: 🔒 sealed" appears where people look for a number
- [ ] The test suite runs and the "no salary anywhere" test passes
- [ ] It is readable from the back of a room
