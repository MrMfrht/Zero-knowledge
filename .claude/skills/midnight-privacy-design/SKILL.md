---
name: midnight-privacy-design
description: Decide what a Midnight dApp keeps private and prove the design actually achieves it. Use when designing or reviewing any sealed bid, hidden reserve, private auction, confidential application, or selective-disclosure flow — and whenever choosing between commit-reveal, threshold, and predicate-proof mechanisms. Also use before claiming any data is "hidden" on Midnight.
---

# Designing privacy on Midnight

The mistake this skill exists to prevent: assuming that because Midnight is a privacy blockchain, the data you put in it is private. Most of it is not. Privacy on Midnight is something you construct deliberately, field by field.

Full reasoning with sources: [`docs/midnight-privacy-model.md`](../../../docs/midnight-privacy-model.md).

## Step 1 — Run the visibility table over every ledger field

From [Security and best practices](https://docs.midnight.network/guides/security-best-practices):

| Observable | Visible? |
|---|---|
| Which circuit and which contract you called | **Yes** |
| `Map`/`Set` keys **and values**, `Counter` amounts | **Yes** |
| Anything `disclose()`d into a ledger write, an exported return, or a cross-contract call | **Yes** |
| When the transaction landed | **Yes** |
| Witness return values | No, unless disclosed |
| Internal circuit computation | No |
| A leaf inserted into `MerkleTree` / `HistoricMerkleTree` | **No** — the only ledger op that hides its argument |

For every ledger field in the design, state out loud why a stranger may read it. If there is no good answer, it does not belong on the ledger in that form.

**`disclose()` does not hide anything.** It is a compiler annotation that switches off the private-data check. Naming it "disclose" is the clearest thing about it.

## Step 2 — Pick a mechanism, knowing the trade

You **cannot compare two hidden numbers on-chain.** There is no on-chain MPC; comparison needs plaintext, and the plaintext is on separate machines. Any design that finds the maximum of permanently sealed bids has smuggled in a trusted party.

Three mechanisms actually work:

| Mechanism | Shape | Losing values stay secret? | Cost |
|---|---|---|---|
| **A — Commit, then selective reveal** | Bid window stores `persistentCommit(v, salt)`; reveal window opens only what contends | Yes, if never revealed | Needs a second window and forfeiture for non-revealers |
| **B — Clear a hidden bar** | Seller commits a reserve; only offers clearing it are ever opened | Yes, always | Outcome is deal / no deal, not "highest wins" |
| **C — Predicate proof, no numbers at all** | Price fixed; applicants prove `income >= 3 × rent` etc. against a signed credential; ledger records one bit | Nothing to keep secret | Needs an attestation issuer |

**C is the strongest privacy and the least code.** Reach for it first and only fall back to A when price competition is genuinely required. The reference implementation for C is the [ZK Loan DApp](https://docs.midnight.network/examples/dapps/zkloan).

## Step 3 — Use the right primitive

| Need | Use |
|---|---|
| Hide a guessable number on the ledger | `persistentCommit(value, freshSalt)` — hiding **and** binding |
| Derive an identity or a nullifier | `persistentHash([pad(32, "domain:purpose:"), _sk])` |
| Anything within one circuit, never stored | `transient*` variants are cheaper |

Rules that are not negotiable:

- **A bare hash of a bid is not hiding.** Plausible rents number in the thousands; enumeration is instant. Salt it.
- **Never reuse a salt.** Reuse links commitments; compromise exposes everything the salt protected.
- **Distinct domain separator per purpose** — `":pk:"`, `":nul:"`, `":bid:"`.
- `persistentCommit` output needs **no** `disclose()` wrapper (the salt satisfies the compiler). `persistentHash` output does.

## Step 4 — Authenticate correctly

**`ownPublicKey()` is a witness function. The prover's machine chooses what it returns.** It can never authenticate a caller. Use it only to route tokens to whoever is calling.

The correct pattern, used by every official example:

```compact
circuit dappPubKey(_sk: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:pk:"), _sk]);
}
```

Authentication, pseudonymity, and cross-contract unlinkability in one construct.

## Step 5 — Freeze what must not move

Anything that defines fairness — the rule, the deadline, the reserve commitment, the organiser's key, the maximum count — goes in a `sealed` ledger field. Sealed fields are writable only by the constructor and its helper circuits, and the compiler enforces it.

*"The rule was fixed before anyone participated"* is the entire claim these products make. `sealed` is what makes that claim checkable by a stranger rather than a matter of trust.

Deadlines use `blockTimeLt` / `blockTimeLte` / `blockTimeGt` / `blockTimeGte` against a sealed field. There is no raw block-time accessor, time is accurate to the scale of blocks rather than seconds, and **block time is never a randomness source**.

## Step 6 — Name the leaks before someone else does

These are real and are not defects in the design:

- **Participation is public.** Contract address, circuit name, and block time are all observable. Counts and timing leak even when content does not.
- **Boundaries leak.** Bridging value in or out is visible. Unshielded escrow amounts are public.
- **Witnesses are untrusted.** They run on the user's machine outside the circuit and are not verified. A witness value is worthless until the contract validates it — via a commitment check, an attestation signature, or a proof.
- **A lost salt is a lost commitment.** Salt storage and recovery is a product decision, not an afterthought.

State these in any pitch or design doc. A judge who finds them is far worse than a slide that names them.

## Before calling a design done

- [ ] Every ledger field is deliberately public, with a stated reason
- [ ] No `Map`/`Set` holds a raw sensitive value — commitments only
- [ ] Fresh salt per commitment; distinct domain separator per hash purpose
- [ ] `persistent*` for anything stored; never `transient*`
- [ ] No `ownPublicKey()` in any authentication path
- [ ] Everything fairness-critical is `sealed`
- [ ] Deadlines enforced by a `blockTime*` predicate
- [ ] One-shot actions protected by a nullifier
- [ ] Every witness value validated before it is trusted
- [ ] Every `disclose()` sits close to its disclosure point and is individually justified
- [ ] The offline-participant failure mode has a contract-enforced consequence
- [ ] The leaks above are written down somewhere the team will read

## Sources

[Security and best practices](https://docs.midnight.network/guides/security-best-practices) · [Smart contract security](https://docs.midnight.network/compact/smart-contract-security) · [Explicit disclosure](https://docs.midnight.network/compact/reference/explicit-disclosure) · [Private data](https://docs.midnight.network/concepts/how-midnight-works/keeping-data-private) · [Private Reserve Auction](https://docs.midnight.network/examples/contracts/private-reserve-auction) · [ZK Loan](https://docs.midnight.network/examples/dapps/zkloan)
