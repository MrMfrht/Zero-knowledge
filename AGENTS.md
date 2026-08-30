# Working in this repository

This repo builds **NightShift** — private payroll with public proof, on the **Midnight Network**.

It is now in implementation. The workspace skeleton, `packages/shared/`, and `packages/api/` (interface + mock) exist. The Compact contract does not yet. Follow the Engineering standards below, and check [tasks/RULEBOOK.md](tasks/RULEBOOK.md) for who owns which folder before editing anything.

## Layout

```
docs/
  midnight-explained.md            Plain-language explainer of Midnight (3 parts)
  midnight-explained-part2.md      Cross-chain vision and its honest limits
  midnight-explained-part3.md      Living fully inside Midnight; compliance
  midnight-docs-map.md             Annotated index of every Midnight doc worth reading
  midnight-privacy-model.md        What Midnight actually hides — the design constraints
packages/
  README.md                        What src/dist mean, why two folders — read first
  shared/                          Domain types. No Midnight imports, ever.
  api/                             PayrollApi interface + mock. README.md is the team guide.
tasks/
  RULEBOOK.md                      One-page team rules
  COMMON.md                        Shared setup; one task file per team member
  01-contract.md … 05-auditor.md   Per-person briefs (WSL needed / not needed)
Ideas/
  NightShift_...md                 Private payroll build plan (5-person team split)
  NightShift_Kickoff_Task_Board.md First-day task board: who starts what, and when
.Codex/
  README.md                        How to set up the external Midnight AI tooling
  skills/                          33 skills: 30 from MIDSKILLS + 3 repo-local
  skills/references/               Canonical wallet-session code, gotchas, versions
  skills/templates/                3 runnable Next.js dApp scaffolds
  agents/                          Repo-local subagents
```

## The five facts that govern every technical decision here

These are established in [docs/midnight-privacy-model.md](docs/midnight-privacy-model.md) with sources. Do not contradict them from memory.

1. **`Map` and `Set` values are public.** Writing a bid amount into a `Map` publishes it. Store `persistentCommit(value, salt)` instead when it must stay hidden.
2. **`disclose()` does not hide anything.** It is a compiler annotation that switches off the private-data check. The value becomes visible the moment it crosses a public boundary.
3. **`ownPublicKey()` is a witness and must never authenticate a caller.** Derive identity from a witness secret: `persistentHash([pad(32, "domain:pk:"), _sk])`.
4. **You cannot compare two hidden numbers on-chain.** There is no on-chain MPC. Finding the maximum of permanently sealed bids requires a reveal phase, or a trusted party — and a trusted party defeats the point.
5. **Participation and timing are public even when content is not.** A contract call is a public transaction. Bid counts and block times are observable.

## Verification rules

- **Never state a Compact fact from training data.** Compact is barely represented in it, and inventing plausible syntax is the failure mode this ecosystem is built around. Check the docs, or compile.
- Fetch docs as raw markdown: append `.md` to any `docs.midnight.network` URL. The full index is [`llms.txt`](https://docs.midnight.network/llms.txt).
- If the Midnight Expert plugins are installed, `/midnight-verify:verify "<claim>"` will compile a test contract and return Confirmed / Refuted / Inconclusive with evidence. Prefer that over asserting.
- Every Compact snippet in this repo is copied from official docs or is an explicitly labelled uncompiled sketch. Keep that labelling honest.

## Environment

This machine is **Windows 11**. Midnight development is **not supported natively on Windows** — the toolchain and the Midnight Expert plugins both require macOS, Linux, or WSL2. Any build work needs WSL2 with Ubuntu, with the project on the Linux filesystem rather than `/mnt/c`. See [Part 5 of the docs map](docs/midnight-docs-map.md#part-5--the-windows-problem).

Pinned versions live in the same file, taken from the [compatibility matrix](https://docs.midnight.network/relnotes/support-matrix). Re-check them rather than trusting the copy if more than a few weeks have passed.

## Engineering standards

When code is written in this project, it is written to be read by someone who knows neither this codebase nor Midnight. That is the bar. Concretely:

**Language.** TypeScript for anything that touches Midnight — the SDK is described in the docs as a "Complete TypeScript implementation of the Midnight Network", and `compact compile` emits TypeScript bindings. There is no Python, Rust, or Go binding, so FastAPI and friends cannot reach a contract at all. A non-TypeScript service is allowed only where it never imports a `@midnight-ntwrk/*` package — in practice, only the read-only reporting service qualifies, and using a second language there still costs a build pipeline and a serialization boundary. Prefer one language.

**The stack.**

| Layer | Choice | Why |
|---|---|---|
| Contracts | Compact | The only option |
| Frontends | **React + Vite + TypeScript** (Tailwind, shadcn optional) | The documented path: the `midnight-dapp-dev` plugin scaffolds Vite + React 19, MIDSKILLS ships `react-wallet-connector`, and the docs have React and Next.js wallet-connector guides. Going off it means writing wallet integration by hand |
| Backend | **NestJS** if two or more people already know it, otherwise Fastify with the same module layout | Nest's modules and dependency injection give the decoupling below for free. Its boilerplate is only worth paying for if the team can already read it |
| Tests | vitest via `createCircuitContext` | The pattern used throughout the official docs |

**The browser is the trust boundary — this is the product, not a preference.** Proofs are generated on the user's own device against their local proof server; the official examples do in-browser ZK proving. The moment a server holds a user's secret key, salt, or witness value in order to prove on their behalf, the application becomes custodial and can read everything it claims to protect. It would demo identically and would not be the same product.

Therefore:

- `@midnight-ntwrk/*` is imported **in the browser only**, and within the browser only by the `api` package.
- The backend **never** receives a secret key, a salt, or any witness value. If a backend module imports the Midnight SDK, that is a design error, not a shortcut.
- The backend reads the chain (indexer GraphQL) and never writes to it. Every state-changing transaction is proven and signed client-side.
- The backend owns what must *not* be on-chain: the real-name-to-pseudonym directory, draft timesheets, notifications, cached reads, reporting.

**Structure: a workspace monorepo, not a fleet of services.** Microservices for a small team on a deadline buys service discovery, health checks, and CORS debugging in exchange for nothing. Decoupling comes from package boundaries with explicit public APIs, not from network hops. A package may import another package's *published* entry point and never its internals. If a boundary later needs to become a deployed service, the seam is already there — the read-only reporting service is the one that genuinely qualifies today.

```
nightshift/
├── packages/
│   ├── shared/          domain types, pure TypeScript, zero Midnight imports
│   ├── contract/        payroll.compact, generated managed/, witnesses.ts
│   ├── api/             PayrollApi interface + real impl + mock impl
│   │                      ← the only package importing @midnight-ntwrk/*
│   ├── worker-app/      React + Vite
│   ├── employer-app/    React + Vite
│   └── auditor/         read-only; indexer GraphQL; no wallet at all
├── services/backend/    NestJS (or Fastify): directory, timesheets, reporting
├── docker/              local devnet compose
├── ARCHITECTURE.md
└── GLOSSARY.md          witness, circuit, ledger, commitment, nullifier, DUST
```

**Dependency direction is one-way.** `shared` ← `api` ← apps, and the backend depends on `shared` alone. No app ever imports `@midnight-ntwrk/*` directly; no backend module imports it at all. If a UI file imports the SDK, that is a bug, not a shortcut. This single rule is mechanically checkable in review and is what keeps the codebase from becoming spaghetti.

**Every package ships an interface and a fake.** The real implementation and an in-memory mock satisfy the same TypeScript interface, so any package can be built and tested while its dependency is still being written. This is what makes parallel work possible; it is not optional.

**Naming carries the domain.** `confirmPayment`, `agreedRate`, `sealedCommitment` — never `handle`, `process`, `data`, `util`. A reader should infer what a function does from its name before reading its body.

**Comments explain why, never what.** The code says what. A comment earns its place only by stating a constraint the code cannot show — a Midnight rule, a documented limitation, a link to the doc page that forced the design. Every non-obvious cryptographic choice cites its source.

**Documentation per package.** Each package has a README covering what it is, what it depends on, how to run it, and how to test it. The repo has an `ARCHITECTURE.md` and a glossary translating Midnight vocabulary (witness, circuit, ledger, commitment, nullifier, DUST) into plain English.

**No spaghetti, stated as rules.** No function longer than one screen. No file over ~300 lines without a reason. No business logic in a UI component. No secret, salt, or key crossing a network boundary. No `any`. No cross-package reach-through imports.

## House style for documents here

The existing documents share a voice, and new ones should match it:

- **Written for a person, not for a spec.** Prose over bullet-dumps. Explain the reasoning, not just the conclusion.
- **Honest about limits.** Every explainer in `docs/` contains a section that names what does not work. Keep that habit — the "honest caveats" sections are the most valuable parts of these files.
- **Quality over quantity.** One well-argued document beats five thin ones. Do not create a new file when an existing one should grow.
- **No invented facts.** If something was not verified, say it was not verified.
