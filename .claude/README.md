# AI setup for this repository

## What is installed, what is not, and how to finish the rest

*Last verified 30 August 2026.*

Working on Midnight with an AI assistant is a different problem from working on most stacks. Compact and the Midnight SDK are barely present in any model's training data, so an unprepared assistant does not merely make mistakes — it **invents syntax fluently and confidently**, and the code fails at compile time. The official docs open with that warning.

The answer is layered. Here is the honest state of each layer.

| Layer | Provides | Status |
|---|---|---|
| **MIDSKILLS** | 28 community skills + 3 runnable dApp templates + shared reference code | ✅ **Installed** in `.claude/skills/` |
| **Kapa MCP** | Documentation-grounded answers from the live Midnight knowledge base | ✅ **Configured** in `.mcp.json` (restart Claude Code to connect) |
| **This repo's skills** | How *we* design privacy here, and how to check it | ✅ 3 skills in `.claude/skills/` |
| **This repo's agents** | Research and audit subagents scoped to this project | ✅ 2 agents in `.claude/agents/` |
| **Midnight Expert** | 13 official Claude Code plugins, 87 skills/commands, 17 agents, and a real compiler-backed verifier | ❌ **Not installed — needs a manual step, see below** |

### What is in `.claude/skills/` now

33 skill folders: 30 from MIDSKILLS plus this repo's own 3 (`midnight-privacy-design`, `compact-authoring`, `midnight-dev-setup`), and two support folders that MIDSKILLS skills read from disk:

- **`references/`** — `midnight-session.md` (canonical wallet session + patched indexer provider), `gotchas.md` (preprod deploy hangs, GraphQL `offset: null`, ZK asset paths), `versions.json`, `midnight-node-architecture.md`
- **`templates/`** — three complete runnable Next.js dApps: `leaderboard-dapp`, `locker-dapp`, `private-party-dapp`

> `npx skills add` copies **only** the skill folders. It does not fetch `references/` or `templates/`, and seven of the installed skills tell the agent to read those paths. They were downloaded separately from the [repository](https://github.com/Kali-Decoder/Midnight-skills). If you reinstall the skills, fetch them again.

**`references/midnight-session.md` is worth reading by hand** if you are building either frontend — it is working provider and wallet-session code, not prose.

### A caution about community versions

`references/versions.json` pins `@midnight-ntwrk/midnight-js-*` at **4.0.4**. The [official compatibility matrix](https://docs.midnight.network/relnotes/support-matrix) says **4.1.1**. The file itself says to cross-check the matrix first.

**The official docs win, always.** MIDSKILLS is community-maintained and lags. Treat its code as a strong starting point and its version numbers as suspect.

---

## 1. Midnight Expert — the one thing still to install

The official Claude Code plugin suite. [Docs](https://docs.midnight.network/ai-integration/midnight-expert) · [Marketplace](https://midnightntwrk.expert/) · [GitHub](https://github.com/midnightntwrk/midnight-expert)

**This one cannot be scripted from here.** The `claude` CLI is not on PATH in this environment (desktop-app install), so the marketplace has to be added from inside Claude Code:

> Run **`/plugin`** → *Add marketplace* → paste **`https://midnightntwrk.expert`**

If you have the CLI available in a terminal, this also works:

```bash
claude plugin marketplace add https://midnightntwrk.expert
```

Or the guided installer, which must run in **bash** — so on this machine, inside WSL:

```bash
curl -fsSL https://midnightntwrk.expert/install.sh | bash
```

> ⚠️ **macOS and Linux only. On Windows, run it inside WSL2.** This machine is Windows 11, so the installer must run from an Ubuntu WSL shell, with Claude Code launched from that same shell. Installing it from PowerShell will not work.
>
> The installer also wants `jq` and the GitHub CLI, and will help install them if missing.

After installing, verify:

```
/midnight-expert:doctor
```

It reports on plugin installation, external tools, and connectivity. If it flags a missing Compact CLI or proof server, ask the assistant to install them, then run it again.

### The commands worth remembering

| Command | Use |
|---|---|
| `/midnight-verify:verify "<claim>"` | Compiles and runs a tiny test contract, returns **Confirmed / Refuted / Inconclusive with evidence**. The single most valuable command in the suite — use it instead of asserting anything about Compact. |
| `/midnight-expert:doctor` | Ecosystem health check |
| `/midnight-tooling:doctor` | Compact CLI specifically |
| `/midnight-tooling:devnet` | Local node, indexer, proof server |
| `/midnight-status-codes:lookup` | Any error code in the ecosystem |
| `/midnight-expert:feedback` | File a bug upstream |

Slash commands from a plugin installed mid-session only appear after restarting Claude Code. Skills and agents activate immediately.

Marketplace releases lag GitHub by 3–5 days for community testing. To track the bleeding edge, use `midnightntwrk/midnight-expert` as the marketplace address instead.

---

## 2. Kapa MCP — already configured

Set up in this repo's `.mcp.json`. **Restart Claude Code once to connect.**

If you want it in another editor (Cursor, VS Code), open the [docs site](https://docs.midnight.network/) and click **Ask AI → Use MCP** for a one-click install. Or paste this config manually:

```json
{
  "mcpServers": {
    "midnight": {
      "type": "http",
      "url": "https://midnight.mcp.kapa.ai"
    }
  }
}
```

It indexes the official docs, hand-picked core repositories (ledger, midnight.js, node), and the whitepaper. This is the same knowledge base behind the "Ask AI" button on the docs site.

**Division of labour:** Kapa answers *"how does DUST generation work"*. Midnight Expert answers *"write this contract and prove it compiles"*. Use both.

[Docs](https://docs.midnight.network/ai-integration/kapa-mcp-server)

---

## 3. MIDSKILLS — already installed

30 skills sit in `.claude/skills/`, committed to the repo, so teammates get them by cloning. [Site](https://midskills.sevryn.xyz/home) · [GitHub](https://github.com/Kali-Decoder/Midnight-skills) · [registry](https://raw.githubusercontent.com/Kali-Decoder/Midnight-skills/main/skills.json)

To refresh them later:

```bash
npx skills add Kali-Decoder/Midnight-skills -a claude-code -y
```

Then re-copy `references/` and `templates/` from the repository, because that command does not fetch them.

The four most relevant to this project:

- `example-private-reserve-auction-dapp` — hidden reserve, `persistentCommit`, `Map`
- `example-zk-loan-application` — private credit evaluation with Schnorr attestation
- `example-private-party-dapp` — commitment guest list, DApp-specific keys, fee sponsorship
- `midnight-security` — privacy audit checklist and leak patterns

There is overlap with Midnight Expert. If both are installed and they disagree, **Midnight Expert wins** — it is official and it compiles what it claims.

Two smaller alternatives exist if you want a lighter footprint: [`midnight_agent_skills`](https://github.com/mzf11125/midnight_agent_skills) (four skills, excellent gotcha list, [documented officially](https://docs.midnight.network/sdks/community/ai-tools/midnight-agent-skills)) and [`midnight-agent-skills`](https://github.com/UvRoxx/midnight-agent-skills) by Webisoft (five skills).

---

## 4. What this repository provides

### Skills — `.claude/skills/`

| Skill | Loads when |
|---|---|
| `midnight-privacy-design` | Deciding what stays private, choosing a sealing mechanism, reviewing a design for leaks |
| `compact-authoring` | Writing or reading Compact — the traps, the primitives, the verification loop |
| `midnight-dev-setup` | Setting up the toolchain, WSL2, proof server, networks, version pinning |

### Agents — `.claude/agents/`

| Agent | Use for |
|---|---|
| `midnight-docs-researcher` | Answering a Midnight question from the live documentation with citations, instead of from memory |
| `compact-privacy-auditor` | Reviewing a contract or a design for data leaks against the visibility rules |

Both are read-only. Neither writes files.

---

## 4b. Using a tool other than Claude Code

**The skills work in GitHub Copilot, Codex, Antigravity, Cursor, and about 70 other agents.** They are already installed for all of them in this repo.

| What | Portable? | Where it lives |
|---|---|---|
| The 30 MIDSKILLS skills | ✅ Yes | `.agents/skills/` |
| This repo's 3 skills | ✅ Yes | `.agents/skills/` (copied) |
| `references/` and `templates/` | ✅ Yes | `.agents/skills/` |
| Kapa MCP server | ✅ Yes — any MCP client | see below |
| This repo's 2 subagents | ❌ Claude Code format only | `.claude/agents/` |
| Midnight Expert plugins | ❌ Claude Code only | not installed |

`.agents/skills/` is the shared convention those tools read from, so a teammate clones the repo and their assistant finds all 33 skills with no setup. `.claude/skills/` is the Claude Code copy of the same content.

### Adding an agent that is not already set up

```bash
npx skills add Kali-Decoder/Midnight-skills -a <agent> -y --copy
```

One agent per command — comma-separated names are rejected. Run `npx skills add Kali-Decoder/Midnight-skills -a x -y` with a bogus name to print the full list of 76 supported agents. Among them: `github-copilot`, `codex`, `antigravity`, `antigravity-cli`, `cursor`, `gemini-cli`, `windsurf`, `zed`, `continue`, `cline`, `roo`, `qwen-code`, `warp`, `junie`, `devin`, `opencode`, `goose`, and `universal`.

After adding one, re-copy `references/` and `templates/` into its skills directory — the installer never fetches them.

### Kapa MCP outside Claude Code

Cursor and VS Code: open [docs.midnight.network](https://docs.midnight.network/), click **Ask AI → Use MCP**, then **Add to Cursor** or **Add to VS Code**. One click.

Anything else that speaks MCP — Copilot in VS Code, Codex, Antigravity — takes the same config as `.mcp.json` in this repo:

```json
{
  "mcpServers": {
    "midnight": { "type": "http", "url": "https://midnight.mcp.kapa.ai" }
  }
}
```

### What non-Claude users give up

Only **Midnight Expert**, and specifically `/midnight-verify:verify` — the command that compiles a real test contract to confirm or refute a claim about Compact. There is no equivalent elsewhere.

The practical substitute is the discipline already in [the rule book](../tasks/RULEBOOK.md): **compile before you believe it.** `compact compile` is the ground truth for everyone regardless of which assistant they use.

---

## 5. Recommended order

1. Install **Midnight Expert** (in WSL2 on this machine) and run `/midnight-expert:doctor`
2. Add the **Kapa MCP** server
3. Read [docs/midnight-privacy-model.md](../docs/midnight-privacy-model.md) — 15 minutes, and it changes the design
4. Skim [docs/midnight-docs-map.md](../docs/midnight-docs-map.md) to know what exists
5. Add **MIDSKILLS** only if you want the reference dApps locally
6. Before writing any contract, run the checklist at the end of the privacy model

---

## Maintaining this

The skills here are short on purpose. Add to them only when something is **specific to this project** — a decision we made, a constraint we discovered, a correction to an earlier document. Anything that is a general fact about Midnight belongs upstream, where it can be kept current and verified by a compiler.

When one of these skills contradicts the official docs, the official docs are right and the skill is stale. Fix it rather than working around it.
