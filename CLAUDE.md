# Working in this repository

This repo plans privacy-preserving sealed-bidding applications on the **Midnight Network**. It is currently a **planning repository** — markdown only, no code yet. Do not scaffold an application, add a `package.json`, or write contracts unless asked to.

## Layout

```
docs/
  midnight-explained.md            Plain-language explainer of Midnight (3 parts)
  midnight-explained-part2.md      Cross-chain vision and its honest limits
  midnight-explained-part3.md      Living fully inside Midnight; compliance
  midnight-docs-map.md             Annotated index of every Midnight doc worth reading
  midnight-privacy-model.md        What Midnight actually hides — the design constraints
Ideas/
  sealed-bidding-ideas.md          The three core concepts, in prose
  BlindBid_...md                   Sealed-bid auction build plan
  SealedRent_...md                 Private rent bidding build plan
  NightShift_...md                 Private payroll build plan (5-person team split)
.claude/
  README.md                        How to set up the external Midnight AI tooling
  skills/                          Repo-local skills
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

## House style for documents here

The existing documents share a voice, and new ones should match it:

- **Written for a person, not for a spec.** Prose over bullet-dumps. Explain the reasoning, not just the conclusion.
- **Honest about limits.** Every explainer in `docs/` contains a section that names what does not work. Keep that habit — the "honest caveats" sections are the most valuable parts of these files.
- **Quality over quantity.** One well-argued document beats five thin ones. Do not create a new file when an existing one should grow.
- **No invented facts.** If something was not verified, say it was not verified.
