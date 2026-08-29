# AI setup for this repository

## What is here, what is external, and how to install the rest

*Last checked 29 August 2026.*

Working on Midnight with an AI assistant is a different problem from working on most stacks. Compact and the Midnight SDK are barely present in any model's training data, so an unprepared assistant does not merely make mistakes — it **invents syntax fluently and confidently**, and the code fails at compile time. The official docs open with exactly that warning.

The answer is layered. Three of the layers are external and maintained by other people; two are in this repository.

| Layer | Provides | Where it lives |
|---|---|---|
| **Midnight Expert** | 13 Claude Code plugins, 87 skills/commands, 17 agents. Writes Compact and **compiles it against the real compiler** before claiming success. | External — install it |
| **Kapa MCP** | Documentation-grounded answers from the live Midnight knowledge base | External — install it |
| **MIDSKILLS** | 28 community skills, including nine complete dApp reference implementations | External — optional |
| **This repo's skills** | How *we* design privacy here, and how to check it | `.claude/skills/` |
| **This repo's agents** | Research and audit subagents scoped to this project | `.claude/agents/` |

The local layer deliberately does **not** duplicate the external one. It holds only what is specific to this project: our privacy constraints, our house rules, our corrections. Everything about Compact syntax, the SDK, and the toolchain belongs to Midnight Expert, which stays current and can compile.

---

## 1. Midnight Expert — install this first

The official Claude Code plugin suite. [Docs](https://docs.midnight.network/ai-integration/midnight-expert) · [Marketplace](https://midnightntwrk.expert/) · [GitHub](https://github.com/midnightntwrk/midnight-expert)

```bash
curl -fsSL https://midnightntwrk.expert/install.sh | bash
```

Or from inside Claude Code: run `/plugin`, choose *Add marketplace*, and paste `https://midnightntwrk.expert`.

Or from the CLI:

```bash
claude plugin marketplace add https://midnightntwrk.expert
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

## 2. Kapa MCP — documentation-grounded answers

```bash
claude mcp add --transport http midnight https://midnight.mcp.kapa.ai
```

For any other MCP client:

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

## 3. MIDSKILLS — optional community skills

```bash
npx skills add Kali-Decoder/Midnight-skills -a claude-code -y
```

28 skills. [Site](https://midskills.sevryn.xyz/home) · [GitHub](https://github.com/Kali-Decoder/Midnight-skills) · [registry](https://raw.githubusercontent.com/Kali-Decoder/Midnight-skills/main/skills.json)

Install this if you want the nine full dApp reference implementations close at hand. The four most relevant to this project:

- `example-private-reserve-auction` — hidden reserve, `persistentCommit`, `Map`
- `example-zk-loan-application` — private credit evaluation with Schnorr attestation
- `example-private-party-dapp` — commitment guest list, DApp-specific keys, fee sponsorship
- `security` — privacy audit checklist and leak patterns

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
