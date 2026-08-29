# Task E — The auditor view

**You are building:** the screen that proves the whole project works. A public board showing every worker and every month as ✅ or ✗ — **with no login, no wallet, and no permission of any kind.**

**Your folder:** `packages/auditor/`
**Your branch:** `feat/auditor`

---

## Do you need WSL?

# No

You are building a normal React website that reads public data over HTTPS. Windows, Mac, Linux — all fine.

You need **Node.js 22+** from [COMMON.md](COMMON.md), and nothing else. No Docker, no compiler, no wallet.

**You are also the least blocked person on the team.** There is a live public server you can query right now:

```
https://indexer.preview.midnight.network/api/v4/graphql
```

That is real blockchain data, available today, with zero setup. Start there.

---

## Why this task exists

This is the demo. Everything else is setup for your screen.

Here is the argument the project is making, and your screen is the proof:

> Anyone — a regulator, a journalist, a worker's lawyer, a stranger — can verify that every employee was paid correctly, **without being given access to anything, and without ever learning what anyone earns.**

The fact that your app needs **no wallet and no login** is not a limitation. It is the point. When a judge asks *"but who can check this?"*, the answer is *"anyone, right now, from their phone"* — and you can prove it by handing them the URL.

---

## What to build

### 1. The board

```
                    Jan   Feb   Mar   Apr   May
Worker 0x7f3a…       ✅    ✅    ✅    ✅    ⏳
Worker 0x91b2…       ✅    ✅    ✗     ✅    ⏳
Worker 0xc4e8…       ✅    ✅    ✅    ✅    ⏳
```

Simple, big, readable from across a room. This will be on a projector.

### 2. Make the ✗ impossible to miss

One unconfirmed month is the entire story. Give it its own treatment — colour, a highlighted row, a summary count at the top:

```
⚠️  1 unconfirmed payment period
```

When someone clicks it, explain what it means in plain language:

> **March 2026 — not confirmed.**
> The worker did not confirm receiving the agreed amount. Either they were not paid, or they were paid the wrong amount.
> The agreed salary remains sealed and is not readable by anyone, including this page.

### 3. A worker's employment record

Click a worker, see their history:

```
Worker 0x7f3a…
Employed:     January 2026 – present
Confirmed:    11 of 12 months
Unconfirmed:  March 2026
Salary:       🔒 sealed — not readable by anyone
```

That last line is worth putting on every screen. People do not believe it the first time.

### 4. Social-security check (if there is time)

Same board, different column: was the declared contribution calculated on the real salary?

---

## How to start today

```bash
npm create vite@latest auditor -- --template react-ts
```

Two things in parallel:

**Build the board with fake data.** Hardcode a dozen rows. Get it looking good on a projector. This needs nothing from anyone.

**Learn the real data source.** Point a GraphQL client at the public preview indexer above and explore. You want the `contractAction` query and the `contractActions` subscription — reference: [Indexer API v4](https://docs.midnight.network/api-reference/midnight-indexer).

You will not find *our* contract there yet, because it does not exist. That is fine — you are learning the shape of the data. When B deploys ours, you point at a different address and the queries are the same.

---

## Your second job: the tests

You also write the test suite. Start now, before there is anything to test.

**Write them as failing tests against the fake API.** The moment B lands the real implementation, you have a ready-made acceptance suite.

The tests that matter most:

| Test | Why |
|---|---|
| A wrong amount **cannot** be confirmed | This is the demo. Test it first |
| A wrong salt cannot be confirmed | Someone else's salt must not work |
| After a full run, **no salary appears anywhere in the blockchain data** | This protects the project's main claim |
| Confirming the same month twice fails | |
| Confirming before hours are approved fails | |

That third one deserves care. Dump everything the blockchain stores, and assert that no salary, no payment amount, and nothing derived from them appears. If someone later changes the contract in a way that leaks a salary, your test catches it. Nothing else will.

Use vitest. The official pattern is in [Security and best practices](https://docs.midnight.network/guides/security-best-practices) — it shows how to set the block time so you can test both sides of a deadline.

---

## How your work connects to everything else

```
   A's contract  ──►  B deploys it  ──►  the blockchain
                                              │
   C's worker app confirms a payment  ────────┤
   D's employer app hires and pays   ─────────┤
                                              │
                                              ▼
                                    YOU read it back
                                    (no wallet, no login)
                                              │
                                              ▼
                                    The demo screen
```

Everyone else writes to the blockchain. **You only read.** That is why you are never blocked by anyone, and why your app can be developed against real public data before our own contract exists.

You need **B** only for one thing at the end: the deployed contract address.

---

## Done when

- [ ] The board renders every worker and month as ✅ / ✗
- [ ] It works with **no wallet connected** — demonstrate this deliberately
- [ ] An unconfirmed month is impossible to miss on a projector
- [ ] "Salary: 🔒 sealed" appears where people will look for a number
- [ ] The test suite runs, and the "no salary anywhere" test passes
- [ ] It is readable from the back of a room

---

## Rules you must not break

1. **Never add a login.** Someone will suggest it. The absence of one is the feature.
2. **Never `import` anything starting with `@midnight-ntwrk/`.** Read the indexer over HTTPS, or go through `packages/api/`.
3. **Never display a number the blockchain does not actually contain.** If your screen shows a salary, either the contract is broken or your screen is lying. Both are project-ending.

---

## Stuck?

- GraphQL questions → [Indexer API v4](https://docs.midnight.network/api-reference/midnight-indexer)
- Indexer errors → [Indexer error codes](https://docs.midnight.network/api-reference/error-reference/indexer-errors)
- Test setup → the vitest example in [Security and best practices](https://docs.midnight.network/guides/security-best-practices)
- Anything else → **Ask AI** on [docs.midnight.network](https://docs.midnight.network/)
