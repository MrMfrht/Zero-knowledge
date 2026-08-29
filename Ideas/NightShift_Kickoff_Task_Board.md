# NightShift — Kickoff Task Board

## Who starts what, in what order, and what is blocking what

*A working document for the first day. The full design lives in [NightShift](NightShift_Private_Payroll_Midnight.md); this file is only about who picks up which task and when they can begin.*

*Written 30 August 2026. Read the **Status** section first — some of this is already done.*

---

## Status right now

| Thing | State |
|---|---|
| WSL2 + Ubuntu-22.04 | ✅ Installed on the lead's machine |
| Node.js in WSL | ✅ v22.23.2 (the SDK requires ≥ 22) |
| Docker Desktop | ✅ Installed on Windows |
| **Compact toolchain in WSL** | ✅ **`compact 0.5.2`, compiler `0.31.1` — installed and verified** |
| Docker → WSL integration | ❌ **Not enabled. Blocks the devnet.** |
| Repo location | ❌ Not decided |
| Backend framework | ❌ Not decided (NestJS vs Fastify) |

**Two installation gotchas already hit and solved.** Anyone else setting up WSL will hit both:

1. The Compact installer needs `unzip`, which is **not** in a default Ubuntu image. Install it first: `sudo apt-get install -y unzip`.
2. If `compact update` fails part-way, it leaves a broken version directory behind and every later attempt reports *"already installed"* while the compiler binary is missing. Fix: `rm -rf ~/.compact/versions/0.31.1` and run `compact update 0.31.1` again.

---

## Track 0 — Only the lead can do these (about five minutes)

These are GUI or judgement calls. Nothing else can substitute for them, and two of them are blocking other people.

### 0.1 — Enable Docker's WSL integration ⛔ **BLOCKING**

Docker Desktop → Settings → Resources → WSL integration → toggle **Ubuntu-22.04** → Apply & restart.

Verify from an Ubuntu shell:

```bash
docker --version
```

Until this is done there is no local devnet, which blocks the integration lead's payment spike and the verification lead's real data.

### 0.2 — Decide where the repo lives

Recommendation: **`~/nightshift` inside Ubuntu**, not on the Windows Desktop. Circuit compilation across `/mnt/c` is slow enough to hurt the edit-compile loop. VS Code's WSL extension opens it like a local folder, so nothing feels different day to day.

### 0.3 — Decide NestJS or Fastify

The rule from [CLAUDE.md](../CLAUDE.md): **NestJS if two or more people already know it, Fastify otherwise.** Nest's modules and dependency injection give the required decoupling for free, but its boilerplate only pays for itself if the team can already read it. Either way the architecture is unchanged — only the contents of one box.

---

## Track 1 — What Claude can do right now, with nothing blocking it

Compiling needs the toolchain, not Docker, so all of this can proceed before Track 0 is finished.

Ordered by what each item unblocks:

| # | Task | Rough time | Unblocks |
|---|---|---|---|
| 1 | **Arithmetic spike.** The docs say Compact *aborts* rather than silently wrapping, and that addition widens the result type beyond the operand width. Multiplication has to be tested directly before the payment assertion can be trusted | ~20 min | The `confirmPayment` circuit |
| 2 | **`PayrollApi` interface + in-memory mock** | ~30 min | **Worker app, employer app and verification lead all start** |
| 3 | **`payroll.compact`** — `hire`, `acceptHire`, `approveHours`, `confirmPayment`, `proveContribution`, `endEmployment`, compiled clean against `0.31.1` | The bulk of the work | Everything downstream |
| 4 | **Monorepo scaffold**, `ARCHITECTURE.md`, `GLOSSARY.md`, per-package READMEs | ~30 min | Everyone reading the same map |
| 5 | **vitest suite** against the real contract | | The verification lead's acceptance tests |

**Item 2 is the highest-leverage task in the project.** It is the single file that lets three people build while the contract is still being fought with the compiler. Recommended order is therefore **1 → 2 → 3 → 4 → 5**, not strict numerical order of importance.

### A note on the contract-owner role

Claude can write the contract. A **human still has to own it.** If a judge asks *"why is the rate a commitment rather than a ledger field?"* and nobody on the team can answer, that is fatal regardless of how good the code is.

So the contract owner's job is not "wait for Claude to finish." It is:

- Review every circuit and every assertion as it lands
- Run the compile loop alongside Claude and read the actual errors
- Own the design decisions and be able to defend them out loud
- Extend the contract once the core compiles

Reading while that happens: [`.claude/skills/compact-authoring`](../.claude/skills/compact-authoring/SKILL.md) and [docs/midnight-privacy-model.md](../docs/midnight-privacy-model.md).

---

## Track 1b — What the rest of the team does *before* anything is handed to them

Only the lead has Claude Code. That matters less than it sounds: none of the work below needs it, and all of it is on the critical path anyway. Doing it now means Phase 0 of [the main plan](NightShift_Private_Payroll_Midnight.md#43-what-runs-in-parallel-and-what-cannot) is finished before the clock starts.

### Step 1 — Everyone sets up their own machine (60–90 min)

Every person needs this regardless of role. Windows users need WSL2; macOS and Linux users install directly.

**Windows only**, from an elevated PowerShell:

```powershell
wsl --install -d ubuntu
```

Then, inside Ubuntu (or a macOS/Linux terminal):

```bash
sudo apt-get update && sudo apt-get install -y unzip curl
```

> `unzip` is **not** in a default Ubuntu image and the Compact installer fails without it. This bit the lead already.

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

```bash
source ~/.bashrc && compact update 0.31.1
```

> If that fails part-way it leaves a broken directory and every retry then claims *"already installed"* while the binary is missing. Fix with `rm -rf ~/.compact/versions/0.31.1` and run it again.

```bash
compact --version && compact compile --version
```

Expected: `compact 0.5.2` and `0.31.1`. Also install **Node.js 22 or newer** (the SDK uses Iterator helpers and crashes on Node 20), **Docker Desktop** with WSL integration enabled, and the [VS Code Compact extension](https://docs.midnight.network/compact/compilation-and-tooling/vscode-plugin).

Full reference: [Install the toolchain](https://docs.midnight.network/getting-started/installation) · [Windows setup with screenshots](https://docs.midnight.network/guides/windows-compact-setup)

### Step 2 — Everyone runs one official example end to end

```bash
npx create-mn-app my-first-app
```

Choose **Contract**, then **hello-world**. Compile it, deploy it to the bundled devnet, call it. ([Quickstart](https://docs.midnight.network/getting-started/quickstart))

This is the single most valuable thing anyone can do before the project starts. It is worth more than reading, because it turns "deploy a contract" from a concept into something boring — and boring is what you want on day two.

### Step 3 — Everyone gets AI help that is not Claude Code

The Midnight Expert plugins are Claude Code only, but the rest is not:

- **Kapa MCP** — documentation-grounded answers inside the editor. From the [docs site](https://docs.midnight.network/), click **Ask AI → Use MCP → Add to Cursor** or **Add to VS Code**. One click. ([details](https://docs.midnight.network/ai-integration/kapa-mcp-server))
- **The Ask AI button itself** works in the browser with no setup at all. Anyone stuck on a Midnight question should use it before guessing.
- **MIDSKILLS** installs into Cursor and many other agents: `npx skills add Kali-Decoder/Midnight-skills` ([registry](https://github.com/Kali-Decoder/Midnight-skills))
- **[Midnight Academy](https://academy.midnight.network/)** — guided interactive lessons on selective disclosure and ZK proofs. The best structured introduction for anyone who has not used Midnight before.

Nobody on this team has to guess at Compact syntax. Guessing is the documented failure mode of this ecosystem — the docs open by warning about it.

### Step 4 — Role-specific work that needs nothing from anyone else

| Role | Do this now | Why it is not blocked |
|---|---|---|
| **A — Contract** | Read [Writing a contract](https://docs.midnight.network/compact/reference/writing), [Ledger data types](https://docs.midnight.network/compact/data-types/ledger-adt), [Smart contract security](https://docs.midnight.network/compact/smart-contract-security). Then read the [Private Reserve Auction](https://docs.midnight.network/examples/contracts/private-reserve-auction) example line by line and be able to explain why its variable is named `publicBid` | Needs only a browser. A has to be able to *defend* the contract, not just receive it |
| **B — Integration** | Read the [shielded token tutorial](https://docs.midnight.network/tokens/shielded-token) and [token transfers](https://docs.midnight.network/examples/contracts/token-transfers). Write the spike as a checklist before running it | The spike itself needs Docker; planning it does not |
| **C — Worker app** | Scaffold React + Vite + TypeScript. Build the accept-hire and confirm-payment screens against **hardcoded fake data**. Also build the "what the chain sees vs what never leaves your device" panel | Screens, layout and state shape do not depend on the API existing |
| **D — Employer app** | Scaffold React + Vite + TypeScript. Build hire, approve-hours and pay screens against hardcoded fake data. Then follow the [React wallet connector guide](https://docs.midnight.network/guides/react-wallet-connect) and get a wallet connecting to *anything* | Wallet connection is independent of our contract |
| **E — Verification** | **Query the public preview indexer right now** — no devnet, no setup: `https://indexer.preview.midnight.network/api/v4/graphql`. Learn the schema against real data, build the board UI with fake rows | The indexer is a public endpoint. This is the least blocked task on the whole project |

E's task deserves emphasis: the preview indexer is live and public, so the auditor view can be developed against genuine chain data before this team has deployed anything at all. See the [Indexer API reference](https://docs.midnight.network/api-reference/midnight-indexer) for queries and subscriptions.

### What nobody should do yet

- Write any part of `payroll.compact` — one person owns that file, and merge conflicts in a contract are expensive
- Invent an API shape — the interface is being written centrally, and two versions of it is the worst outcome
- Import `@midnight-ntwrk/*` into a UI component — see [CLAUDE.md](../CLAUDE.md); the SDK belongs behind the `api` package only

---

## Track 2 — The handout

Five roles, from [the main plan](NightShift_Private_Payroll_Midnight.md#42-roles). What each person picks up first, what they need before they can start, and when that is.

| Role | First task | Blocked by | Can start |
|---|---|---|---|
| **A — Contract owner** | Pair with Claude on `payroll.compact`. Review every circuit, run the compile loop, own the design | Nothing | **Now** |
| **B — Integration lead** | **SPIKE-PAY** — bring up the devnet, create two wallets, send a shielded transfer between them, confirm the recipient sees the value | Task 0.1 | **The moment Docker is toggled. Do this before anything else** |
| **C — Worker app** | React + Vite scaffold, wallet connect, accept-hire and confirm-payment screens, built against the mock | Claude's task 2 | Within the hour |
| **D — Employer app** | React + Vite scaffold, hire / approve-hours / pay screens, built against the mock | Claude's task 2 | Within the hour |
| **E — Verification** | Indexer GraphQL queries, the ✅/✗ per-period board, and the test matrix written as *failing* tests | Nothing (mock data first; devnet later for real data) | Within the hour |

### Why B goes first among the humans

**SPIKE-PAY is the project's kill switch**, and it is the only genuine unknown in the design.

If a shielded wallet-to-wallet transfer misbehaves on the local devnet, the fallback is unshielded payment — **every proof in the system still works**, and the only thing lost is "amounts hidden in transit." That is a survivable outcome, but only if the decision is made on day one. Discovering it during integration week is expensive.

Nothing else on the board should be allowed to delay this task.

### Why C and D are not blocked by the contract

Neither app ever imports `@midnight-ntwrk/*`. They import the `api` package, and on day one that package is Claude's in-memory mock. When B swaps the mock for the real implementation, **the app code does not change** — that is the entire purpose of agreeing the interface before writing anything.

If C or D find themselves reaching for the Midnight SDK directly, that is a signal the interface is missing a method, not a reason to bypass it.

### Why E needs no wallet at all

The auditor view is read-only: it queries the [Indexer GraphQL API](https://docs.midnight.network/api-reference/midnight-indexer) and nothing else. No wallet, no proofs, no permissions.

That is not a limitation, it is the demo. *Anyone can verify the payroll without being given access to anything* — which is exactly the claim the product is making.

---

## What to say to the group at kickoff

> Claude is writing the contract and the shared interface. **Nobody waits on the contract** — everyone builds against the mock, and the real implementation drops in behind the same interface later.
>
> B: run the payment spike first. If shielded transfer does not work, we change plans today, cheaply, instead of on Thursday.

---

## When each person is blocked, this is what they do instead

Blocking is inevitable. Idle is a choice. Standing assignments:

| Blocked on | Do this instead |
|---|---|
| The contract compiling (C, D) | Design salt custody. Read how the ZK Loan example uses `level-private-state-provider` — encrypted private state, 16+ character password. Losing a salt must never lose money; decide exactly what it *does* cost and write it down |
| The real API (E) | Write the test matrix as failing tests against the mock. They become the acceptance suite the moment the real API lands |
| The payment spike (B) | Read [networks and environments](https://docs.midnight.network/guides/networks-and-environments) and script the `undeployed → preview` promotion, so moving to a public testnet later is configuration rather than surgery |
| Docker (anyone) | Read [docs/midnight-privacy-model.md](../docs/midnight-privacy-model.md) and try to break the design. A hole found before integration week is worth a day of fixing after it |
| Anything (A) | A is never blocked — A is the bottleneck. Protect that time: questions go through one channel, batched |

---

## Done means

A task is finished when its gate passes, not when it appears to work:

- **Arithmetic spike** — the multiplication edge cases are committed tests, not remembered facts
- **`PayrollApi`** — mock and real implementation are interchangeable behind one import
- **Contract v1** — compiles under `0.31.1`; a wrong salt, wrong rate, wrong hours and wrong amount are each rejected with a clear message
- **SPIKE-PAY** — a shielded transfer between two dev wallets is demonstrated, or the fallback is formally chosen and written into the plan
- **Worker app** — someone who has never seen the project can accept a hire and confirm a payment unaided, and the salt survives a page reload
- **Employer app** — hire → approve hours → pay, in one sitting
- **Auditor view** — shows every worker-period as ✅/✗ **with no wallet connected**

---

*Full design and rationale: [NightShift](NightShift_Private_Payroll_Midnight.md) · Engineering standards: [CLAUDE.md](../CLAUDE.md) · Privacy constraints: [docs/midnight-privacy-model.md](../docs/midnight-privacy-model.md)*
