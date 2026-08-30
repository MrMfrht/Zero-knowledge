# Zero-knowledge

**NightShift** — private payroll with public proof, built on the [Midnight Network](https://docs.midnight.network/).

> **The idea in one line:** get paid in private, prove it in public.

Team members: go straight to **[tasks/COMMON.md](tasks/COMMON.md)**, then open your own task file.

---

## Start here

| If you want to… | Read |
|---|---|
| Understand Midnight from zero, in plain language | [docs/midnight-explained.md](docs/midnight-explained.md) → [part 2](docs/midnight-explained-part2.md) → [part 3](docs/midnight-explained-part3.md) |
| Know what Midnight *actually* keeps private | [docs/midnight-privacy-model.md](docs/midnight-privacy-model.md) |
| Find the right page in the official docs | [docs/midnight-docs-map.md](docs/midnight-docs-map.md) |
| Understand the project we are building | [Ideas/NightShift_Private_Payroll_Midnight.md](Ideas/NightShift_Private_Payroll_Midnight.md) |
| **Start work — pick your task** | **[tasks/COMMON.md](tasks/COMMON.md)** |
| Understand the code folders | [packages/README.md](packages/README.md) |
| The team rules, on one page | [tasks/RULEBOOK.md](tasks/RULEBOOK.md) |
| See the whole plan and team split | [Ideas/NightShift_Kickoff_Task_Board.md](Ideas/NightShift_Kickoff_Task_Board.md) |
| Set up AI tooling for this repo | [.claude/README.md](.claude/README.md) |

If you read only one file, read [the privacy model](docs/midnight-privacy-model.md). It contains the constraint that reshapes every design here: **`Map` and `Set` values are public on Midnight**, so a number written into one is not hidden at all.

---

## The project

**NightShift — private payroll with public proof.**

An employer pays workers in Midnight's shielded currency, so amounts are hidden from everyone. At hiring, both sides seal the agreed rate into an on-chain **commitment** — a scrambled value that hides the number and can never be opened to a different one. Every pay period the worker confirms receipt by proving, inside a zero-knowledge circuit, that what arrived matches the sealed agreement.

The ledger records exactly one public fact per period: **paid correctly, or not confirmed.** No salary figure is ever readable by anyone.

Three more products fall out of that same trail for free:

- **A verifiable employment history the worker owns** — join date, leave date, continuity, all written month by month at the time, by both parties.
- **Proof that social-security contributions were calculated on the real salary** — closing a fraud that workers currently cannot check at all.
- **Hourly and contractor verification** — the rate stays sealed while `hours × rate` is proven correct. Salaried is the same circuit with `hours = 1`.

The demo is the failure case: an employer underpays, and the worker is *unable* to confirm it even if they wanted to. The period stays permanently unconfirmed on a public ledger while the real salary stays unreadable.

Build plan: [NightShift](Ideas/NightShift_Private_Payroll_Midnight.md) · First-day tasks: [Kickoff task board](Ideas/NightShift_Kickoff_Task_Board.md)

---

## Layout

```
docs/
  midnight-explained{,-part2,-part3}.md   Plain-language explainer series
  midnight-docs-map.md                    Annotated index of the Midnight documentation
  midnight-privacy-model.md               What Midnight hides — and the design constraints
A_docs/                                   Deep contract detail — A only
D_docs/                                   Backend plan — D only
tasks/
  RULEBOOK.md                             One-page team rules — keep this open
  COMMON.md                               Setup everyone does first — start here
  01-contract.md … 05-auditor.md          One file per person
Ideas/
  NightShift_Private_Payroll_Midnight.md  The build plan: idea, contract, team split
  NightShift_Kickoff_Task_Board.md        First-day task board and blockers
.claude/
  README.md                               AI tooling setup for this repo
  skills/                                 33 skills (30 MIDSKILLS + 3 ours) + references/ + templates/
  agents/                                 midnight-docs-researcher, compact-privacy-auditor
CLAUDE.md                                 Repo conventions for AI assistants
```

---

## Does my machine need anything special?

**Only if you compile smart contracts.** The Compact compiler is Linux and macOS only — there is no Windows build.

| Role | Needs WSL (Windows users)? |
|---|---|
| A — Contract, B — Integration | **Yes** — or GitHub Codespaces, which is free and browser-based |
| C — Worker app, D — Employer app, E — Auditor | **No.** Node.js 22+ and a normal editor |

Three of the five roles never touch the compiler. They import the contract as ordinary TypeScript, which A commits after building it.

Setup instructions live in each person's task file. Start at **[tasks/COMMON.md](tasks/COMMON.md)**.
