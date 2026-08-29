# The Midnight Documentation Map

## Everything worth reading, with a link to each and a note on why it matters

*Researched 29 August 2026. Every link below was opened and checked on that date. The map covers the official documentation at [docs.midnight.network](https://docs.midnight.network/), the AI tooling built for Midnight, and the community ecosystem. It is written to be read by a person deciding what to open next — not as a dump of the sitemap.*

> **The single most useful link on this page:** [`docs.midnight.network/llms.txt`](https://docs.midnight.network/llms.txt) — the complete machine-readable index of the entire documentation site, roughly 1,800 lines. Every page is also available as raw markdown by appending `.md` to its URL. This is how an AI agent should read these docs: fetch the `.md`, not the rendered page.

---

# Part 1 — The AI tooling (read this first)

This section comes first because Midnight is genuinely hostile to AI assistants that have not been prepared for it. The docs say so directly:

> "AI coding assistants are fast, but they hallucinate on Midnight. Compact and the Midnight SDK are barely represented in their training data, so an assistant left on its own invents syntax, calls functions that do not exist, and hands you code that fails at compile time."
> — [AI integration](https://docs.midnight.network/ai-integration)

Three separate tools exist to fix this. They are complementary, not alternatives.

| Tool | What it is | Link |
|---|---|---|
| **Midnight Expert** | Official suite of **Claude Code plugins** — 13 plugins, 87 skills/commands, 17 agents. Writes and reviews Compact, then *compiles it against the real compiler* before claiming success. | [Docs](https://docs.midnight.network/ai-integration/midnight-expert) · [Marketplace](https://midnightntwrk.expert/) · [GitHub](https://github.com/midnightntwrk/midnight-expert) |
| **Kapa MCP server** | Remote MCP server exposing the same knowledge base behind the "Ask AI" button on the docs site. Grounds answers in current docs instead of stale training data. | [Docs](https://docs.midnight.network/ai-integration/kapa-mcp-server) |
| **MIDSKILLS** | Community skill registry — 28 skills including nine complete dApp reference implementations. Installs into any agent via `npx skills`. | [Site](https://midskills.sevryn.xyz/home) · [GitHub](https://github.com/Kali-Decoder/Midnight-skills) |

## Midnight Expert — the plugin catalogue

From the marketplace at [midnightntwrk.expert](https://midnightntwrk.expert/):

**Smart contracts**

- `compact-core` — contract structure, data types, ledger declarations, circuits, witnesses, disclosure rules, tokens, debugging. [README](https://github.com/midnightntwrk/midnight-expert/tree/main/plugins/compact-core)
- `compact-examples` — compilable Compact examples, from beginner contracts to full applications
- `compact-cli-dev` — scaffolds Oclif CLIs for contracts, with wallet management and deployment

**DApp**

- `midnight-dapp-dev` — scaffolds frontends: Vite + React 19 + shadcn + Tailwind v4. [README](https://github.com/midnightntwrk/midnight-expert/tree/main/plugins/midnight-dapp-dev)

**Testing and quality**

- `midnight-cq` — linting, formatting, type checking, testing
- `midnight-verify` — compiles and executes Compact to confirm or refute a claim. `/midnight-verify:verify "<claim>"` returns Confirmed / Refuted / Inconclusive **with evidence**
- `midnight-fact-check` — extracts testable claims from content and verifies them

**Toolchain**

- `midnight-tooling` — Compact CLI management, local devnet, compiler version switching
- `midnight-wallet` — wallet SDK reference and test-wallet patterns
- `midnight-status-codes` — lookup for every error code in the ecosystem

**Knowledge and meta**

- `core-concepts` — architecture, data models, ZK proofs
- `midnight-expert` — ecosystem diagnostics (`/midnight-expert:doctor`)
- `midnight-plugin-utils` — audits and resolves plugin dependencies

Install:

```bash
curl -fsSL https://midnightntwrk.expert/install.sh | bash
```

> ⚠️ **Midnight Expert runs on macOS and Linux only. On Windows you must work inside WSL2.** This is stated in its prerequisites and it is not a soft requirement. See [Part 5](#part-5--the-windows-problem).

## Kapa MCP server

```bash
claude mcp add --transport http midnight https://midnight.mcp.kapa.ai
```

It indexes the official docs, hand-picked core repositories (ledger, midnight.js, node), and the whitepaper. Use Kapa for "how does X work" questions; use Midnight Expert for "write this code and prove it compiles."

## MIDSKILLS — the community registry

```bash
npx skills add Kali-Decoder/Midnight-skills -a claude-code -y
```

The registry manifest is [`skills.json`](https://raw.githubusercontent.com/Kali-Decoder/Midnight-skills/main/skills.json) — 28 skills across foundation, wallet, SDK, domain, and full-template categories. The entries most relevant to sealed bidding:

| Skill | Why it matters here |
|---|---|
| `example-private-reserve-auction` | Hidden reserve price, `persistentCommit`, `Map` — the closest existing thing to our auction |
| `example-zk-loan-application` | Private credit evaluation with Schnorr attestation — the pattern for tenant qualification |
| `example-private-party-dapp` | `persistentCommit` guest list, DApp-specific public keys, fee sponsorship |
| `security` | Privacy audit checklist and data-leak patterns |
| `compact` | Language reference and the syntax traps |
| `midnight-environment-setup` | Toolchain, PATH, Docker, proof server, VS Code extension |

A fourth, smaller set exists — [`midnight_agent_skills`](https://github.com/mzf11125/midnight_agent_skills), documented officially at [Midnight agent skills](https://docs.midnight.network/sdks/community/ai-tools/midnight-agent-skills). Four skills (`midnight-concepts`, `midnight-compact`, `midnight-api`, `midnight-network`). Its real value is the **gotcha list**, worth quoting because it is the kind of thing that costs an afternoon:

```
// WRONG                                  // CORRECT
counter.value()                           counter.read()
GameState::playing                        GameState.playing
witness get_key(): Bytes<32> { ... }      witness local_key(): Bytes<32>;   // no body
```

And three mental-model corrections for anyone arriving from Ethereum:

- Circuits **declare constraints**, they do not execute. `assert` is a constraint declaration, not a runtime guard.
- `disclose()` is a **compile-time annotation, not encryption**.
- Block limits are **hard limits, not gas costs**. `BlockLimitExceeded` means the transaction cannot run at all.

A fifth option, [`midnight-agent-skills`](https://github.com/UvRoxx/midnight-agent-skills) by Webisoft, covers Compact guide / SDK guide / infra setup / deploy / test runner.

---

# Part 2 — Understanding what Midnight actually is

Read in this order if you are new. Skip to Part 3 if you have already read the *Midnight, Explained From Zero* series in this repo ([part 1](midnight-explained.md), [part 2](midnight-explained-part2.md), [part 3](midnight-explained-part3.md)).

| Page | What it gives you |
|---|---|
| [What is Midnight?](https://docs.midnight.network/what-is-midnight) | The one-page pitch: public ledger + private state + selective disclosure. |
| [How privacy blockchains work](https://docs.midnight.network/concepts/how-privacy-blockchains-work) | Why the usual two options — fully public, fully private — both fail for business. |
| [Zero-knowledge proofs](https://docs.midnight.network/concepts/zero-knowledge-proofs) | The primitive everything rests on. |
| [Private data](https://docs.midnight.network/concepts/how-midnight-works/keeping-data-private) | **Essential.** Hashes, commitments, randomness/salts, Merkle trees, and the commitment/nullifier pattern. This is the page that teaches you how to actually hide a bid. |
| [Midnight's hybrid architecture](https://docs.midnight.network/concepts/how-midnight-works/midnight-combined-model) | How the public and shielded layers fit together. |
| [End-to-end architecture](https://docs.midnight.network/concepts/how-midnight-works/end-to-end-architecture) | Where the proof server, node, indexer, and wallet sit relative to one another. |
| [Building blocks](https://docs.midnight.network/concepts/how-midnight-works/building-blocks) | Vocabulary: contract, circuit, witness, ledger, private state. |
| [Compact as a privacy-first language](https://docs.midnight.network/concepts/how-midnight-works/compact-privacy-first-language) | Why the language is shaped the way it is. |
| [Kachina](https://docs.midnight.network/concepts/kachina) | The academic protocol Midnight's contract model is built on. |
| [Zswap](https://docs.midnight.network/concepts/how-midnight-works/zswap) | The shielded token layer. |
| [The Impact VM](https://docs.midnight.network/concepts/how-midnight-works/impact) | What actually executes on-chain. |
| [Transaction semantics](https://docs.midnight.network/concepts/how-midnight-works/semantics) | What a transaction is and when it is valid. |
| [Ledgers](https://docs.midnight.network/concepts/ledgers), [UTXO model](https://docs.midnight.network/concepts/utxo), [Account model](https://docs.midnight.network/concepts/account) | The dual ledger. Midnight is UTXO-based, not account-based. |

## Comparisons worth reading before committing to a design

- [ZK vs FHE vs MPC: which should you use for a privacy-focused DApp?](https://docs.midnight.network/concepts/zk-vs-fhe-vs-mpc) — the honest answer to "why not just encrypt everything"
- [zk-SNARK vs zk-STARK](https://docs.midnight.network/concepts/zk-snark-vs-zk-stark)
- [What is FHE?](https://docs.midnight.network/concepts/fully-homomorphic-encryption)

## Tokens and fees

| Page | Note |
|---|---|
| [Tokens on Midnight](https://docs.midnight.network/tokens/overview) | NIGHT (transferable, staking, governance; 1 NIGHT = 10⁶ STAR) and DUST (shielded, **non-transferable**, consumed as fees; 1 DUST = 10¹⁵ SPECK). |
| [Dual-component tokenomics](https://docs.midnight.network/concepts/dual-component-tokenomics) | Why the two are split. |
| [DUST architecture](https://docs.midnight.network/concepts/dust-architecture) | Generation, decay, registration, protocol parameters. |
| [Sponsor transaction fees with DUST](https://docs.midnight.network/guides/dust-sponsorship) | **Read this for any consumer-facing app.** One wallet pays fees for another; the user needs zero DUST to transact from their first click. |
| [Create and transfer an unshielded token](https://docs.midnight.network/tokens/unshielded-token), [shielded token](https://docs.midnight.network/tokens/shielded-token) | The two-part token tutorial. |
| [Funding a wallet](https://docs.midnight.network/guides/acquire-tokens) | Faucets and registration. |

> **A timing trap worth knowing now:** most NIGHT reaches Midnight via the cross-chain path (cNIGHT on Cardano), and DUST registration takes **about 12 hours** to finalize. On a local network it takes about 5 minutes. Plan demos on `undeployed`, or fund testnet wallets a day early.

---

# Part 3 — Compact, the contract language

## The reference set

| Page | Note |
|---|---|
| [The Compact language](https://docs.midnight.network/compact) | Entry point. |
| [Writing a contract](https://docs.midnight.network/compact/reference/writing) | The guided walk-through: ledger section, circuits, local state, basic confidentiality. |
| [Compact reference](https://docs.midnight.network/compact/reference/compact-reference) | The full language reference. |
| [Compact grammar](https://docs.midnight.network/compact/reference/compact-grammar), [keywords](https://docs.midnight.network/compact/reference/compact-keywords) | For when the compiler and your mental model disagree. |
| [Compact standard library](https://docs.midnight.network/compact/standard-library), [detailed API](https://docs.midnight.network/compact/standard-library/exports) | Hashes, commitments, block-time predicates, token functions. |
| [Ledger data types](https://docs.midnight.network/compact/data-types/ledger-adt) | `Cell`, `Counter`, `Set`, `Map`, `List`, `MerkleTree`, `HistoricMerkleTree`, and the Kernel. |
| [Opaque data types](https://docs.midnight.network/compact/data-types/opaque_data) | Strings and byte blobs the circuit cannot look inside. |
| [Test and debug](https://docs.midnight.network/compact/test-and-debug) | The testing story. |
| [Troubleshoot compiler errors](https://docs.midnight.network/troubleshoot/compiler-errors) | When it will not build. |

## The two pages that decide whether your privacy design is real

### [Explicit disclosure — "The Midnight Witness Protection Program"](https://docs.midnight.network/compact/reference/explicit-disclosure)

The compiler runs an abstract interpreter that tracks witness data through *every* path in your program — arithmetic, struct fields, function calls, comparisons — and refuses to compile if that data reaches the public ledger, an exported circuit's return value, or another contract without a `disclose()` wrapper.

Two things to internalise:

1. **`disclose()` does not hide or encrypt anything.** It tells the compiler "I know, I meant to." The value becomes visible the moment it crosses a public boundary.
2. **Put `disclose()` as close to the disclosure point as possible.** Wrapping early means later code paths silently inherit permission to leak.

One useful exception the compiler already knows about: `transientCommit(e)` is treated as *not* containing witness data (the salt hides it), while `transientHash(e)` still is.

### [Smart contract security](https://docs.midnight.network/compact/smart-contract-security)

The three execution contexts — public ledger, ZK circuits, local computation — and where the boundaries between them leak. Covers `sealed` ledger fields, witness functions, commitment schemes, nullifiers, and domain separation.

The warning to tattoo somewhere:

> **`ownPublicKey()` is a witness function. The prover's machine chooses its return value. Never use it to authenticate a caller.** Authenticate by proving knowledge of a secret instead.

## [Security and best practices](https://docs.midnight.network/guides/security-best-practices)

A recipe book, and the most immediately practical page in the whole documentation set. Each section is procedure + verification + a runnable vitest example.

- **On-chain visibility table** — the definitive answer to "what can an observer see" (reproduced in [midnight-privacy-model.md](midnight-privacy-model.md))
- Authenticating a caller with a derived identity
- Restricting a circuit to a group
- Compact arithmetic behavior
- Validating inputs before computing
- **Block-time predicates** — `blockTimeLt`, `blockTimeLte`, `blockTimeGt`, `blockTimeGte`. There is no raw block-time accessor, and block time must never be used as a randomness source.
- **Enforcing a deadline** — exactly the pattern a bidding window needs
- Preventing replay attacks
- Rotating an owner key
- Durable and bounded on-chain state
- Cryptographic primitive selection
- Viewing keys
- **Pre-deployment security checklist**

## Tooling

| Page | Note |
|---|---|
| [Compact compiler usage](https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage) | Flags and output layout. |
| [Compact command-line tool](https://docs.midnight.network/compact/compilation-and-tooling/dev-tool-usage) | `compact update`, version management. |
| [Formatter](https://docs.midnight.network/compact/compilation-and-tooling/formatter-usage), [fixup](https://docs.midnight.network/compact/compilation-and-tooling/fixup-usage) | |
| [VS Code extension](https://docs.midnight.network/compact/compilation-and-tooling/vscode-plugin), [Neovim](https://docs.midnight.network/compact/compilation-and-tooling/neovim-setup) | Editor support. |

---

# Part 4 — Examples and tutorials

## Contract examples (single files, quick to read)

| Example | Why open it |
|---|---|
| [**Private Reserve Auction**](https://docs.midnight.network/examples/contracts/private-reserve-auction) | **The closest official code to our sealed-bidding work.** Hidden reserve via `persistentCommit`, DApp-specific public keys so bidders cannot be tracked across contracts, `Map` operations. Read the note in [midnight-privacy-model.md](midnight-privacy-model.md) about what it does *not* hide. |
| [Private Guest List](https://docs.midnight.network/examples/contracts/private-guest-list) | Commitment-based membership. |
| [Election](https://docs.midnight.network/examples/contracts/election) | Voting mechanics. |
| [Battleship (simple)](https://docs.midnight.network/examples/contracts/battleship-simple) | Hidden state that must be proven consistent — the purest ZK example here. |
| [Calculator](https://docs.midnight.network/examples/contracts/calculator) | The smallest useful contract. |
| [Shielded and unshielded token transfers](https://docs.midnight.network/examples/contracts/token-transfers) | Moving actual value. |

## Full dApps

| DApp | Note |
|---|---|
| [**ZK Loan**](https://docs.midnight.network/examples/dapps/zkloan) | **The reference for qualification-based selection.** Credit score, income, employment tenure and PIN never leave the user's machine; a bank-style provider signs the profile off-chain; the contract verifies a Schnorr-on-Jubjub signature inside the circuit and writes only the outcome to the ledger. Tutorial: [contract](https://docs.midnight.network/tutorials/zk-loan/smart-contract), [attestation API](https://docs.midnight.network/tutorials/zk-loan/attestation-api), [CLI](https://docs.midnight.network/tutorials/zk-loan/cli). Repo: [example-zkloan](https://github.com/midnightntwrk/example-zkloan). |
| [Bulletin board](https://docs.midnight.network/examples/dapps/bboard) | The canonical first dApp. Tutorial: [contract](https://docs.midnight.network/tutorials/bboard/smart-contract), [API](https://docs.midnight.network/tutorials/bboard/bboard-api-implementation), [CLI](https://docs.midnight.network/tutorials/bboard/bboard-cli). Repo: [example-bboard](https://github.com/midnightntwrk/example-bboard). |
| [Leaderboard](https://docs.midnight.network/examples/dapps/leaderboard) | React + Lace with **in-browser ZK proving**. Five-part tutorial: [overview](https://docs.midnight.network/tutorials/leaderboard/overview), [contract](https://docs.midnight.network/tutorials/leaderboard/smart-contract), [API layer](https://docs.midnight.network/tutorials/leaderboard/api-layer), [browser DApp](https://docs.midnight.network/tutorials/leaderboard/browser-dapp), [deployment](https://docs.midnight.network/tutorials/leaderboard/deployment). |
| [Private party](https://docs.midnight.network/tutorials/private-party) | [Contract](https://docs.midnight.network/tutorials/private-party/smart-contract). Repo: [example-private-party](https://github.com/midnightntwrk/example-private-party) — also the reference implementation for **DUST fee sponsorship** ([SPONSORSHIP.md](https://github.com/midnightntwrk/example-private-party/blob/main/docs/SPONSORSHIP.md)). |
| [Battleship](https://docs.midnight.network/tutorials/bship) | [Contract](https://docs.midnight.network/tutorials/bship/smart-contract), [test suite](https://docs.midnight.network/tutorials/bship/test-suite). |

## Getting started

- [Get started](https://docs.midnight.network/getting-started)
- [Install the toolchain](https://docs.midnight.network/getting-started/installation)
- [Create your first Midnight contract](https://docs.midnight.network/getting-started/hello-world)
- [Create a Midnight DApp](https://docs.midnight.network/getting-started/quickstart) — scaffolds via `npx create-mn-app`; templates are `hello-world`, `battleship`, `bboard`, `leaderboard`
- [Midnight Academy](https://academy.midnight.network/) — guided interactive lessons

---

# Part 5 — The Windows problem

**This repository lives on Windows 11. Midnight development does not support Windows natively.** Both statements come from the docs, not from inference:

- [Install the toolchain](https://docs.midnight.network/getting-started/installation): *"Development is supported on Linux and Mac. Windows is not supported natively at this time, if you are using Windows, development through WSL is recommended."*
- [Midnight Expert](https://docs.midnight.network/ai-integration/midnight-expert): *"macOS or Linux. On Windows, run everything inside WSL2."*

The dedicated guide is [**Windows Compact setup**](https://docs.midnight.network/guides/windows-compact-setup). The short version:

```bash
wsl --install -d ubuntu
```

Run that from an elevated PowerShell. Then install Docker Desktop with WSL2 integration, install the Compact toolchain **inside** Ubuntu, and keep the project files inside the Linux filesystem rather than on `/mnt/c` — cross-filesystem I/O is slow enough to matter when compiling circuits.

Decide this before writing any code, because it determines where the repository physically lives.

---

# Part 6 — Building, deploying, operating

| Page | Note |
|---|---|
| [**Networks and environments**](https://docs.midnight.network/guides/networks-and-environments) | The four networks and every endpoint. Summarised below. |
| [Deploying and operating a contract](https://docs.midnight.network/guides/deploy-and-operate) | The longest practical guide in the docs (~47 KB). |
| [Proof server](https://docs.midnight.network/guides/run-proof-server) | `docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v` |
| [Proving transactions locally](https://docs.midnight.network/guides/local-proving) | Why the proof server is always local, on port 6300, whatever network you target. |
| [Using Compact contracts from JavaScript](https://docs.midnight.network/guides/compact-javascript-runtime) | The bridge from `managed/` output to your app. |
| [React wallet connector](https://docs.midnight.network/guides/react-wallet-connect), [Next.js wallet connector](https://docs.midnight.network/guides/nextjs-wallet-connect) | Frontend wiring. |
| [Cross-chain DApp with EffectStream](https://docs.midnight.network/guides/build-cross-chain-dapp-with-effectstream), [Index contract state with EffectStream](https://docs.midnight.network/guides/index-state-with-effectstream) | The cross-chain path. |

## The four networks

| Network | Node RPC | Indexer (GraphQL) | Funding |
|---|---|---|---|
| `undeployed` (local) | `http://localhost:9944` | `http://localhost:8088/api/v4/graphql` | Genesis wallet pre-funded; funding menu transfers 50,000 tNIGHT |
| `preview` | `https://rpc.preview.midnight.network` | `https://indexer.preview.midnight.network/api/v4/graphql` | [Preview faucet](https://midnight-tmnight-preview.nethermind.dev/) |
| `preprod` | `https://rpc.preprod.midnight.network` | `https://indexer.preprod.midnight.network/api/v4/graphql` | [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/) |
| `mainnet` | `https://rpc.mainnet.midnight.network` | — | Real NIGHT, no faucet |

The proof server is `http://localhost:6300` on **every** network — it handles your private data, so it never leaves your machine. Local network tooling: [midnight-local-dev](https://github.com/midnightntwrk/midnight-local-dev).

Block explorers: [Midnight Explorer](https://preprod.midnightexplorer.com/), [Subscan](https://midnight-preprod.subscan.io/), [1am](https://explorer.1am.xyz/?network=preprod).

> The name `testnet-02` is retired and its endpoints no longer resolve. Ignore any tutorial that still uses it.

## Version pinning

From the [compatibility matrix](https://docs.midnight.network/relnotes/support-matrix), read 29 August 2026:

| Component | Version |
|---|---|
| Compact devtools (`compact`) | 0.5.1 |
| Compact compiler (`compact compile`) | 0.31.1 |
| Compact runtime | 0.16.0 |
| Compact JS | 2.5.1 |
| Midnight.js / testkit-js | 4.1.1 |
| Wallet SDK | 1.2.0 (**pin exactly** — npm `latest` still resolves to 1.1.0) |
| DApp Connector API | 4.0.1 |
| Proof server | 8.1.0 |
| Indexer | 4.3.5 (preview) / 4.3.3-hotfix (preprod) |
| Node | 1.0.1 (preview) / 1.0.2 (preprod, mainnet) |

Per-component release notes: [overview](https://docs.midnight.network/relnotes/overview), [Compact](https://docs.midnight.network/relnotes/compact), [Midnight.js](https://docs.midnight.network/relnotes/midnight-js), [ledger](https://docs.midnight.network/relnotes/ledger), [proof server](https://docs.midnight.network/relnotes/proof-server), [wallet](https://docs.midnight.network/relnotes/wallet), [indexer](https://docs.midnight.network/relnotes/midnight-indexer), [network endpoints](https://docs.midnight.network/relnotes/network).

---

# Part 7 — SDKs, APIs, and the community

## Official SDKs

- [Midnight SDKs](https://docs.midnight.network/sdks) — the index
- [Midnight.js](https://docs.midnight.network/sdks/official/midnight-js) — the DApp framework
- [Midnight wallet SDK](https://docs.midnight.network/sdks/official/wallet-developer-guide)
- [API reference](https://docs.midnight.network/api-reference) — `compact-runtime`, `midnight-js`, `wallet-sdk`, `ledger`, `onchain-runtime`, `zswap`, `dapp-connector`, `testkit-js`
- [Midnight Indexer API v4](https://docs.midnight.network/api-reference/midnight-indexer) — GraphQL queries and subscriptions, including `contractActions`, `shieldedTransactions`, `unshieldedTransactions`, `blocks`

## Error references — bookmark these, you will need them

- [Midnight.js errors](https://docs.midnight.network/sdks/error-reference/midnight-js)
- [Wallet SDK errors](https://docs.midnight.network/sdks/error-reference/wallet-sdk)
- [DApp Connector API errors](https://docs.midnight.network/api-reference/error-reference/dapp-connector-errors)
- [Indexer error codes](https://docs.midnight.network/api-reference/error-reference/indexer-errors)
- [Ledger errors](https://docs.midnight.network/api-reference/error-reference/ledger-errors)
- [Proof server errors](https://docs.midnight.network/api-reference/error-reference/proof-server-errors)
- [Node error codes](https://docs.midnight.network/nodes/error-codes)
- [Decode 1010 transaction rejection errors](https://docs.midnight.network/how-to/decode-1010-transaction-rejection-errors)
- [Fix version mismatch errors](https://docs.midnight.network/how-to/fix-version-mismatches)
- [Common SDK integration issues](https://docs.midnight.network/sdks/troubleshoot)
- [FAQ](https://docs.midnight.network/troubleshoot/faq), [Support](https://docs.midnight.network/troubleshoot/getting-help)

## Community projects

Listed at [Community projects](https://docs.midnight.network/sdks/community). These are maintained outside the Midnight Foundation and are mostly unaudited — check the compatibility matrix before integrating.

| Project | Use |
|---|---|
| [OpenZeppelin Contracts for Compact](https://docs.midnight.network/sdks/community/openzeppelin-compact-contracts), [GitHub](https://github.com/OpenZeppelin/compact-contracts) | Access control and security primitives. Experimental, unaudited. |
| [Nightforge](https://docs.midnight.network/sdks/community/nightforge), [GitHub](https://github.com/cadalt0/NIGHTFORGE) | CLI dev environment: compile, deploy, operate, proof-server orchestration. |
| [Edda starter template](https://docs.midnight.network/sdks/community/edda-midnight-starter), [GitHub](https://github.com/eddalabs/midnight-starter-template) | Full-stack monorepo: React + Compact + CLI. |
| [Midnight Explorer](https://docs.midnight.network/sdks/community/midnight-explorer) | Block, transaction, address, and contract explorer. |
| [Midnames](https://docs.midnight.network/sdks/community/midnames) | Name service and **in-browser Compact playground**. |
| [Midnight Live View](https://docs.midnight.network/sdks/community/midnight-live-view) | Terminal dashboard for validator nodes. |
| [Community wallets](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview), [integration](https://docs.midnight.network/sdks/community/wallets/community-wallets-integration), [CLI and MCP](https://docs.midnight.network/sdks/community/wallets/community-wallets-cli-mcp), [reference](https://docs.midnight.network/sdks/community/wallets/community-wallets-reference) | Lace, 1AM, urble, Kuira. **1AM and urble default to shielded; Lace is opt-in.** |

## Nodes

[Node overview](https://docs.midnight.network/nodes), [full node](https://docs.midnight.network/nodes/full-node), [RPC node](https://docs.midnight.network/nodes/rpc-node), [boot node](https://docs.midnight.network/nodes/boot-node), [Cardano node](https://docs.midnight.network/nodes/cardano-node), [cardano-db-sync](https://docs.midnight.network/nodes/cardano-db-sync), [endpoints](https://docs.midnight.network/nodes/node-endpoints).

Node internals, if you ever need them: [consensus](https://docs.midnight.network/concepts/network-architecture/consensus) (AURA block production, GRANDPA finality, Cardano partnerchain validator selection), [cryptography](https://docs.midnight.network/concepts/network-architecture/cryptography), [on-chain logic](https://docs.midnight.network/concepts/network-architecture/onchain-logic), [P2P networking](https://docs.midnight.network/concepts/network-architecture/p2p-networking), [RPC interface](https://docs.midnight.network/concepts/network-architecture/rpc-networking), [storage](https://docs.midnight.network/concepts/network-architecture/storage), [transactions](https://docs.midnight.network/concepts/network-architecture/transactions), [sidechains and partner chains](https://docs.midnight.network/concepts/sidechains-partnerchains).

## Everything else

[Glossary](https://docs.midnight.network/glossary), [Blockchain space tokenization](https://docs.midnight.network/concepts/blockchain-space-tokenization), [Web3](https://docs.midnight.network/concepts/web3), [Bun runtime setup](https://docs.midnight.network/how-to/bun-runtime-midnight), [NixOS toolchain issues](https://docs.midnight.network/troubleshoot/troubleshoot-compact-nixos), [package repository access failures](https://docs.midnight.network/how-to/fix-package-repository-access-failures).

---

# Part 8 — What I could not verify

The edges of this research, stated plainly:

- **The MIDSKILLS pages `/browse`, `/templates`, `/paths`, `/knowledge`, `/hackathons`, and `/community` render their content client-side**, so a plain fetch returns only the navigation shell. The skill list in Part 1 therefore comes from the authoritative [`skills.json`](https://raw.githubusercontent.com/Kali-Decoder/Midnight-skills/main/skills.json) in the repository. To browse them as a human, open the site in a browser.
- **Individual `SKILL.md` bodies** in the MIDSKILLS repo were not read one by one; the registry descriptions were.
- **The Midnight Expert per-plugin READMEs** were not read individually — the plugin catalogue and the counts (13 plugins, 87 skills/commands, 17 agents) come from the marketplace landing page and the docs quick start.
- **No code was compiled.** Every Compact snippet quoted anywhere in this repository's planning documents is copied from the official documentation, not written and verified here. Verify with `/midnight-verify:verify` or a real `compact compile` before trusting any of it.

---

*Next: [midnight-privacy-model.md](midnight-privacy-model.md) turns this research into the specific rules that constrain a sealed-bidding design — including the one that invalidates the naïve version of it.*
