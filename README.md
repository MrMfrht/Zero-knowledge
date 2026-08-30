# NightShift — Private Payroll with Public Proof

**Get paid in private. Prove it in public.**

NightShift is a payroll application built on the [Midnight Network](https://docs.midnight.network/) in which every salary is sealed inside a cryptographic commitment, every payment is verified by a zero-knowledge proof generated on the worker's own device, and anyone on earth — a regulator, a journalist, a worker's lawyer — can verify that every employee was paid exactly what their contract says **without ever learning what anyone earns**.

> A worker who is underpaid by a single unit cannot produce a confirmation proof. Their pay period stays publicly, permanently unconfirmed. That refusal — enforced by mathematics, not by trust — is the product.

---

## Team

| Member | Area |
|---|---|
| **Moussa Farhat** | Lead · Smart contract (Compact) · Chain integration |
| **Soham Kadu** | Frontend applications |
| **Larry D. Ross** | Backend services |
| **Rudra Kumar** | Frontend · Auditor experience |
| **Harsh** | Backend |

---

## How it works

Six Compact circuits, one public ledger, zero numbers revealed:

| Circuit | Caller | What the chain learns |
|---|---|---|
| `hire` | employer | A commitment hash. The rate and salt behind it never touch the chain. |
| `acceptHire` | worker | A ZK proof that the worker knows the exact sealed rate + salt. |
| `approveHours` | employer | Hours worked — public on purpose; both parties already know them. |
| `confirmPayment` | worker | One bit: *amount received = hours × sealed rate*. None of the three numbers. |
| `proveContribution` | worker | One bit: the pension declaration matches real earnings. Neither is revealed. |
| `endEmployment` | employer | Employment ended. The history stays verifiable forever. |

Identity is not the wallet: every caller is authenticated by a key derived from a secret that never leaves their browser (`dappKey(localSk(), deploymentId)`). The wallet only pays fees. All proofs are generated client-side against a local proof server — **no server ever holds a secret key, a salt, or a salary. The browser is the trust boundary; this is the product, not a preference.**

```
packages/
  shared/        domain types — pure TypeScript, zero Midnight imports
  contract/      payroll.compact (6 circuits), generated bindings, smoke test
  api/           PayrollApi interface + mock + real Midnight implementation
                   ← the ONLY package that imports @midnight-ntwrk/*
  worker-app/    React + Vite — accept offers, confirm payments, prove contributions
  employer-app/  React + Vite — hire, approve hours, pay
  auditor/       read-only public verification board — no wallet, no login
services/
  backend/       NestJS-style directory/timesheets service (reads chain, never writes)
```

Dependency direction is one-way: `shared ← api ← apps`. No app touches the Midnight SDK directly.

---

## Running the whole project

### Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 22+** | Node 20 crashes with the Midnight SDK. `node --version` must print v22 or higher. |
| **Docker Desktop** | Runs the local Midnight devnet (node + indexer + proof server). |
| **A Chromium browser** | For the Lace Midnight wallet extension. |
| **WSL2 (Windows only, contract work only)** | Only needed to *recompile* the contract. The compiled bindings are checked in, so running the apps needs no WSL. |

### 1. Install

```bash
git clone https://github.com/MrMfrht/Zero-knowledge.git
cd Zero-knowledge
npm install
```

### 2. Start the local Midnight devnet

A complete Midnight network on your machine — real node, real indexer, real ZK proof server:

```bash
docker compose -f docker/compose.yml up -d
docker compose -f docker/compose.yml ps    # wait until all three are healthy
```

| Service | Port | Role |
|---|---|---|
| node | 9944 | The blockchain — produces blocks, accepts transactions |
| indexer | 8088 | Makes the chain queryable (GraphQL) — all reads go through here |
| proof-server | 6300 | Generates ZK proofs **locally, on purpose** — it sees witness values in the clear and must never be reachable off this machine |

### 3. Deploy the contract

```bash
npm run deploy -w @nightshift/api
```

This prints a **contract address**. Put it in each app's `.env.local`:

```bash
# packages/worker-app/.env.local, packages/employer-app/.env.local, packages/auditor/.env.local
VITE_CONTRACT_ADDRESS=<the printed address>
VITE_NETWORK_ID=undeployed
```

### 4. Set up a wallet

1. Install the **Lace** wallet extension (Chrome/Edge store — Midnight support). Create a wallet and save the seed phrase.
2. Copy your **unshielded receive address** (`mn_addr_undeployed1…`) from the wallet.
3. Fund it from the devnet genesis wallet:

   ```bash
   npm run fund -w @nightshift/api -- --to mn_addr_undeployed1...
   ```

4. **In the wallet**, designate the received NIGHT for DUST generation ("Generate tDUST"). This step cannot be scripted — registering a UTXO for DUST must be signed by the key that owns it. DUST is the fee resource every transaction consumes; it regenerates over time toward a cap proportional to your designated NIGHT.

> The genesis seed used by `fund` is the well-known public dev-preset value. It funds nothing real and must never be used against preview, preprod, or mainnet.

### 5. Run the apps

```bash
npm run dev -w @nightshift/employer-app   # http://localhost:3001
npm run dev -w @nightshift/worker-app     # http://localhost:3000
npm run dev -w @nightshift/auditor        # http://localhost:3003
```

Two bonus pages on the auditor server:

- **`/`** — the public verification board (no wallet, no login)
- **`/chain-log.html`** — live circuit-execution log, streamed from the indexer over WebSocket, with a legend of what each circuit proves

Without `VITE_CONTRACT_ADDRESS` set, every app falls back to an in-memory mock with seeded demo personas — useful for UI work with no chain at all.

### 6. Walk the lifecycle

1. **Worker app** → *New Identity* (devnet only) → *Copy* the worker key.
2. **Employer app** → *Hire*: paste the key, enter a rate → approve the wallet prompts → the app hands you the rate + salt to deliver to the worker **privately** (the chain cannot carry them — that is the point).
3. **Worker app** → enter the rate + salt → *Accept Job Offer* → a ZK proof that you hold the exact sealed numbers.
4. **Employer app** → *Approve Hours* for the period.
5. **Worker app** → *Confirm Payment* with the amount received. The circuit proves `amount = hours × sealed rate`; entering anything else is refused by the proof system itself.
6. **Worker app** → *Prove Contribution* — the pension declaration is verified against real earnings without revealing either.
7. Watch the **auditor board** flip ⏳ → ✅ and the **chain log** stream each circuit as it lands.

> **Wallet prompts open as separate OS windows** and love to hide behind a maximised browser. Un-maximise before submitting, and answer both prompts (unlock, then "Prove transaction") promptly.

### Rebuilding the contract (optional, WSL2/Linux/macOS only)

```bash
# Inside WSL, with the Compact toolchain installed — see docs/midnight-docs-map.md, Part 5
compact compile packages/contract/src/payroll.compact packages/contract/src/managed/payroll
npm run smoke -w @nightshift/contract    # full lifecycle against an in-memory ledger
```

Pinned toolchain versions live in [docs/midnight-docs-map.md](docs/midnight-docs-map.md), taken from the official [compatibility matrix](https://docs.midnight.network/relnotes/support-matrix).

---

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| Write spins, then times out naming the wallet | A wallet approval window is hiding behind your browser, or DUST ran out. Un-maximise; check the tDUST tank. |
| "Authentication cancelled by user" | A wallet prompt was closed or timed out. Nothing was sent, no fees spent — retry and answer the popup. |
| Proof succeeds but nothing lands; wallet balance fine | DUST coins locked by an earlier failed transaction (known wallet issue). Close **all** browser windows and reopen. |
| tDUST tank shows 0/0 | No NIGHT designated for DUST. Fund the wallet, then "Generate tDUST" in the wallet. |
| "this worker already has a sealed rate" | A hired worker key can never be hired again — by design. Use *New Identity* for a fresh run. |

---

## Design principles

- **Never authenticate with `ownPublicKey()`** — it is a witness. Identity comes from a hash of a local secret.
- **Never store a hidden number in a `Map` or `Set`** — ledger collection values are public. Store `persistentCommit(value, salt)`.
- **`disclose()` hides nothing** — it is a compiler annotation that *permits* disclosure.
- **No secret, salt, or key ever crosses a network boundary.** The backend reads the chain and never writes to it.
- **Every package ships an interface and a mock**, so any layer can be built and tested while its dependency is still being written.

The full, sourced privacy model — including what Midnight does *not* hide (participation, timing, call counts) — is in [docs/midnight-privacy-model.md](docs/midnight-privacy-model.md). The honest-limits sections of every document in `docs/` are deliberate; read them before extending the design.

---

## Further reading

| Topic | Where |
|---|---|
| Midnight from zero, in plain language | [docs/midnight-explained.md](docs/midnight-explained.md) (3 parts) |
| What Midnight actually keeps private | [docs/midnight-privacy-model.md](docs/midnight-privacy-model.md) |
| Annotated map of the official docs | [docs/midnight-docs-map.md](docs/midnight-docs-map.md) |
| The whole app, start to finish | [tasks/THE-FLOW.md](tasks/THE-FLOW.md) |
| Contract internals | [A_docs/](A_docs/README.md) |
| Team workflow rules | [tasks/RULEBOOK.md](tasks/RULEBOOK.md) |
