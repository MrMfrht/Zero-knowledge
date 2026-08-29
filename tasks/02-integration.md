# Task B — Integration

**You are building:** the layer that connects the smart contract to the three apps — plus you are answering the one question that could change the whole project.

**Your folder:** `packages/api/`
**Your branch:** `feat/api`

---

## Do you need WSL?

# YES

You compile contracts and run the local blockchain. Both are Linux-only.

- **On Mac or Linux?** You are fine.
- **On Windows?** You need WSL. Setup is identical to [Task A](01-contract.md#setup) — follow that section, then come back.
- **Cannot install WSL?** Use **GitHub Codespaces** — free Linux in your browser.

You also need **Docker Desktop**, with WSL integration switched on (Settings → Resources → WSL integration → toggle your Ubuntu → Apply).

---

## Why this task exists

Two reasons, and the first one is urgent.

**1. You are answering the project's riskiest question.**

Our whole design assumes an employer can send private money straight to a worker's wallet, with the amount hidden. We have read the documentation and it should work. **Nobody has tried it.**

If it does not work, we change the plan — and we want to find out on day one when it costs an hour, not on day four when it costs the project. Your first job is to try it. Details below.

**2. You are the only person allowed to touch the Midnight SDK.**

Everyone else's app talks to *your* code, never to the blockchain. That is deliberate. It means if something about Midnight changes, one file changes, not five apps.

---

## Step 1 — SPIKE-PAY. Do this first, before anything else.

**The question:** can one wallet send another wallet money privately, and can the receiver see it arrived?

1. Get the local blockchain running (node, indexer, proof server) — see [Running a local network](https://docs.midnight.network/guides/networks-and-environments)
2. Create two test wallets
3. Send a shielded (private) payment from wallet 1 to wallet 2
4. Check wallet 2 received it

Read first: [Create and transfer a shielded token](https://docs.midnight.network/tokens/shielded-token) and the [token transfers example](https://docs.midnight.network/examples/contracts/token-transfers).

### Report the answer to the team immediately

**If it works:** say so. The plan is confirmed and everyone continues.

**If it does not work:** say so **loudly and immediately.** It is not a disaster. The backup plan is to use public (unshielded) payments instead. Everything else in the project still works exactly the same — the sealed salary, the confirmations, the employment history, all of it. The only thing we lose is that payment *amounts* become visible while in transit, and we say so honestly in the README.

That is a survivable outcome **only if we know on day one.**

Do not start Step 2 until you have an answer.

---

## Step 2 — Build the real API

The lead has already put an interface and a **fake version** into `packages/api/`. It looks roughly like this:

```typescript
export interface PayrollApi {
  hire(workerKey: string, sealedRate: string): Promise<void>;
  acceptHire(rate: bigint, salt: string): Promise<void>;
  approveHours(workerKey: string, period: number, hours: number): Promise<void>;
  confirmPayment(period: number, hours: number, rate: bigint, salt: string,
                 amountReceived: bigint): Promise<void>;
  getHistory(workerKey: string): Promise<PeriodStatus[]>;
}
```

C, D and E are already building against the fake one.

**Your job: write a real version that satisfies the exact same interface.** Do not change the interface. If you genuinely need to change it, talk to the lead and everyone at once — it is the one file that affects all five of us.

What the real version does:

1. Imports A's compiled contract from `packages/contract/src/managed/`
2. Wires up the Midnight providers (see [Midnight.js](https://docs.midnight.network/sdks/official/midnight-js))
3. Connects to the wallet
4. Turns each interface method into a real contract call

Reference: [Deploying and operating a contract](https://docs.midnight.network/guides/deploy-and-operate).

---

## Step 3 — Deployment script

One command that deploys the contract to the local network and prints the address. Everyone else needs this to point their app at something real.

Later, make it work against the public `preview` network too — that is just different endpoints, no code change. See [Networks and environments](https://docs.midnight.network/guides/networks-and-environments).

---

## How your work connects to everything else

```
   A's contract  ──compiled──►  managed/
                                   │
                                   ▼
                          YOU: packages/api/
                          ┌─────────────────────┐
                          │ PayrollApi          │  ← the interface (do not change)
                          ├─────────────────────┤
                          │ fake version        │  ← lead wrote it; C/D/E use it now
                          │ real version        │  ← YOU write this
                          └─────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        C's worker app      D's employer app      E's auditor view
```

**The moment you finish, three apps start working — and none of their code changes.** That is the whole point of the interface being agreed up front. They swap which version they import, and that is it.

You are the busiest person in the middle of the project. Talk to A daily about circuit names and arguments.

---

## Done when

- [ ] **SPIKE-PAY answered and reported to the team** (this is the important one)
- [ ] The real API satisfies the same interface as the fake one, with nothing added or removed
- [ ] `deploy` script runs and prints a contract address
- [ ] C, D or E can switch from fake to real by changing one import
- [ ] The versions in `package.json` are pinned exactly (see below)

---

## Pin these versions exactly

From the [official compatibility matrix](https://docs.midnight.network/relnotes/support-matrix):

| Package | Version |
|---|---|
| Compact compiler | 0.31.1 |
| `@midnight-ntwrk/compact-runtime` | 0.16.0 |
| `@midnight-ntwrk/midnight-js-*` | 4.1.1 |
| `@midnight-ntwrk/wallet-sdk` | **1.2.0 — exact, no `^`** |
| `@midnight-ntwrk/dapp-connector-api` | 4.0.1 |
| Proof server image | 8.1.0 |

> The wallet SDK matters: npm's `latest` tag still points at 1.1.0, so a `^` range gives you the wrong version and things fail in confusing ways.

Version mismatches are the most common problem in this ecosystem, and they usually fail **silently**. If something behaves strangely, check versions before anything else: [Fix version mismatch errors](https://docs.midnight.network/how-to/fix-version-mismatches).

---

## Rules you must not break

1. **The API never receives a secret key or a salt from a server.** Those live in the browser. If your API is running server-side and handling salts, the product is broken — it means we could read everyone's salary.
2. **Do not change the interface without telling everyone.** Five people depend on it.
3. **Pin versions exactly.** No `^`, no `~`.

---

## Stuck?

- Transaction rejected → [Decode 1010 errors](https://docs.midnight.network/how-to/decode-1010-transaction-rejection-errors)
- SDK error → [Midnight.js error reference](https://docs.midnight.network/sdks/error-reference/midnight-js)
- Something behaves oddly → check versions first
- Anything else → **Ask AI** on [docs.midnight.network](https://docs.midnight.network/)
