# Zero-knowledge

Planning repository for privacy-preserving **sealed-bidding** applications on the [Midnight Network](https://docs.midnight.network/).

Everything here is currently markdown. No code yet — by design.

> **The idea in one line:** hide the inputs, publish the rule, prove the outcome.

---

## Start here

| If you want to… | Read |
|---|---|
| Understand Midnight from zero, in plain language | [docs/midnight-explained.md](docs/midnight-explained.md) → [part 2](docs/midnight-explained-part2.md) → [part 3](docs/midnight-explained-part3.md) |
| Know what Midnight *actually* keeps private | [docs/midnight-privacy-model.md](docs/midnight-privacy-model.md) |
| Find the right page in the official docs | [docs/midnight-docs-map.md](docs/midnight-docs-map.md) |
| See the product ideas | [Ideas/sealed-bidding-ideas.md](Ideas/sealed-bidding-ideas.md) |
| Build the auction | [Ideas/BlindBid_Closed_Private_Auction_Midnight.md](Ideas/BlindBid_Closed_Private_Auction_Midnight.md) |
| Build the rent bidding | [Ideas/SealedRent_Private_Rent_Bidding_Midnight.md](Ideas/SealedRent_Private_Rent_Bidding_Midnight.md) |
| Set up AI tooling for this repo | [.claude/README.md](.claude/README.md) |

If you read only one file, read [the privacy model](docs/midnight-privacy-model.md). It contains the constraint that reshapes every design here: **`Map` and `Set` values are public on Midnight**, so a bid written into one is not sealed at all.

---

## The three ideas

Described in full in [sealed-bidding-ideas.md](Ideas/sealed-bidding-ideas.md).

1. **The closed auction** — every bid secret, the winner provable, losing bids never revealed. Build plan: [BlindBid](Ideas/BlindBid_Closed_Private_Auction_Midnight.md).
2. **Sealed rent bidding** — offers hidden from everyone including the landlord, one refundable deposit backing applications to many flats, winning one automatically drops you from the rest, and everyone else gets their money back. Build plan: [SealedRent](Ideas/SealedRent_Private_Rent_Bidding_Midnight.md).
3. **The secret reserve marketplace** — a hidden minimum meets a hidden offer; if they overlap, the deal executes, and if they do not, nothing is revealed to anyone.

All three are the same machine wearing different clothes.

---

## Layout

```
docs/
  midnight-explained{,-part2,-part3}.md   Plain-language explainer series
  midnight-docs-map.md                    Annotated index of the Midnight documentation
  midnight-privacy-model.md               What Midnight hides — and the design constraints
Ideas/
  sealed-bidding-ideas.md                 The three concepts, in prose
  BlindBid_...md                          Sealed-bid auction build plan
  SealedRent_...md                        Private rent bidding build plan
.claude/
  README.md                               AI tooling setup for this repo
  skills/                                 midnight-privacy-design, compact-authoring, midnight-dev-setup
  agents/                                 midnight-docs-researcher, compact-privacy-auditor
CLAUDE.md                                 Repo conventions for AI assistants
```

---

## Before writing any code

Two things settle first:

1. **WSL2.** Midnight does not support Windows natively, and neither does the official Claude Code plugin suite. This decides where the repo physically lives. See [Part 5 of the docs map](docs/midnight-docs-map.md#part-5--the-windows-problem).
2. **The mechanism.** Commit-and-reveal, clear-a-hidden-bar, or predicate proof. They are not interchangeable and the choice cannot be deferred — it determines the contract, the UI, and what the product is allowed to claim. See [Part 3 of the privacy model](docs/midnight-privacy-model.md#part-3--the-sealed-bid-problem).
