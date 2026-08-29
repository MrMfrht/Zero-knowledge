# What Midnight Actually Hides

## The privacy rules that constrain every sealed-bidding design in this repository

*Written 29 August 2026, from the official documentation. Sources are linked inline. This document exists because the difference between "Midnight is a privacy blockchain" and "Midnight will hide my bid" is larger than it looks, and the gap is where a project goes wrong.*

---

# Part 1 — The visibility table

This is the single most important table in the Midnight documentation. It comes from [Security and best practices → On-chain visibility](https://docs.midnight.network/guides/security-best-practices), reproduced here because every design decision in this repository has to be checked against it.

| What a chain observer sees | Visible? |
|---|---|
| Which **exported circuit** you called | **Yes** — the entry point is part of the transaction |
| Which **contract** you called | **Yes** — the contract address is public |
| **Arguments to ledger operations** — `Set` and `Map` keys *and values*, `Counter` amounts | **Yes** |
| Values you `disclose()` into a public position (ledger write, exported-circuit return, contract-to-contract call) | **Yes** |
| **When** the transaction landed on-chain | **Yes** — block timing is observable |
| **Witness function return values** | No, unless disclosed into a public position |
| **Internal circuit computation** | No |
| The **leaf inserted into a `MerkleTree`** or `HistoricMerkleTree` | **No** — this is the one ledger operation that hides its argument |

Three consequences follow immediately, and they are the load-bearing facts of this whole repository.

### 1. Anything you write into a `Map` is public. Including the values.

`bidders.insert(pubKey, bidAmount)` publishes the bid amount. Not the identity behind `pubKey`, but the number, permanently, to everyone.

### 2. `disclose()` does not hide anything.

From [Explicit disclosure](https://docs.midnight.network/compact/reference/explicit-disclosure):

> "Placing a `disclose()` wrapper does not cause disclosure in itself; in fact, it has no effect other than telling the compiler that it is okay to disclose the value of the wrapped expression."

It is a compiler annotation that switches off a safety check. The name reads like an action; it is a permission slip. The value becomes visible when — and only when — it crosses a public boundary, but by then you have already authorised it.

### 3. Participation is not private, only content is.

An observer cannot see *what* you bid, but they can see that an address called the `bid` circuit on this contract at this time. Bid **count** and bid **timing** are public unless you deliberately hide them. `Counter` values are public. This matters and is addressed in [Part 5](#part-5--the-honest-leaks).

---

# Part 2 — The primitives you have to work with

## Hashes and commitments

From [Smart contract security → Cryptographic primitives](https://docs.midnight.network/compact/smart-contract-security):

| Primitive | Use case | Survives protocol upgrades | Hides a guessable value |
|---|---|---|---|
| `transientHash<T>(value)` | Temporary consistency checks | No guarantee | No |
| `transientCommit<T>(value, rand)` | Temporary hiding | No guarantee | Yes |
| `persistentHash<T>(value)` | State derivation, authentication | Guaranteed | No |
| `persistentCommit<T>(value, rand)` | Long-term hiding | Guaranteed | Yes |

**Use `persistentCommit` for anything stored on the ledger that must stay hidden.** A bare hash of a bid amount is useless: the space of plausible rents is a few thousand values and an attacker enumerates it in milliseconds. The salt is what makes the commitment hiding.

Two properties, both needed:

- **Hiding** — the commitment reveals nothing about the value.
- **Binding** — you cannot later open it to a different value.

Binding is what makes a sealed bid honest. Hiding is what makes it sealed.

A useful compiler behaviour: `persistentCommit` output **does not require a `disclose()` wrapper**, because the salt makes the compiler treat it as sufficiently private to store publicly. `persistentHash` output does require one.

> **Never reuse a salt.** Reusing randomness across commitments lets an observer link them, and a compromised salt exposes every value it protected. One fresh random `Bytes<32>` per commitment.

## Identity

**`ownPublicKey()` is a witness function.** The prover's own machine chooses what it returns, and the protocol never checks it against the signing wallet. From [Smart contract security](https://docs.midnight.network/compact/smart-contract-security):

> "Do not use `ownPublicKey()` for verification of the caller in Compact circuits!"

The correct pattern, used by every official example, is a **derived per-dApp identity**: hash a witness-supplied secret together with a domain separator.

```compact
// From the Private Reserve Auction example
circuit getDappPubKey(_sk: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([pad(32, "silent-auction:pk:"), _sk]);
}
```

This gives you three things at once: authentication (only the holder of `_sk` can produce this key), pseudonymity (the key is not the wallet address), and **unlinkability across contracts** (a different domain string produces a different key for the same person).

Use a distinct domain separator for every purpose — `"…:pk:"`, `"…:nullifier:"`, `"…:bid-commit:"` — to prevent cross-purpose collisions.

## Preventing double actions

The nullifier pattern, from the same page:

```compact
export ledger usedNullifiers: Set<Bytes<32>>;

circuit nullifier(_sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "nullifier-domain"), _sk]);
}

export circuit spend(_sk: Bytes<32>): [] {
  const nul = nullifier(_sk);
  assert(!usedNullifiers.member(nul), "Already spent");
  usedNullifiers.insert(disclose(nul));
}
```

One application per applicant, one reveal per bidder, one claim per deposit — all the same shape.

## Deadlines

There is no raw block-time accessor. You get four predicates, each taking seconds since the Unix epoch ([Block-time predicates](https://docs.midnight.network/guides/security-best-practices)):

`blockTimeLt(t)` · `blockTimeLte(t)` · `blockTimeGt(t)` · `blockTimeGte(t)`

Store the cutoff in a `sealed` ledger field so no later circuit can move it:

```compact
export sealed ledger deadline: Uint<64>;

constructor(deadlineTime: Uint<64>) {
  deadline = disclose(deadlineTime);
}

export circuit bid(...): [] {
  assert(blockTimeLt(deadline), "bidding closed");
  ...
}
```

> Block time advances one step per block and the producer sets the timestamp within protocol bounds. **Treat a time gate as accurate to the scale of blocks, not seconds**, and never use block time as a randomness source.

## Sealed fields

A `sealed` ledger field can only be written by the constructor or by helper circuits the constructor calls. Afterwards no exported circuit can touch it, and the compiler enforces this. Use it for every parameter of the auction that must not move after bidding starts: the deadline, the rule, the organiser's identity, the maximum bid count, the committed reserve.

This is not a convenience. **"The rule was fixed before anyone bid" is the entire claim these products make**, and `sealed` is what makes it checkable by a stranger.

---

# Part 3 — The sealed-bid problem

Here is the uncomfortable part, and the reason this document exists.

## What the official auction example actually does

The [Private Reserve Auction](https://docs.midnight.network/examples/contracts/private-reserve-auction) is the closest official code to what we want. Read its ledger declarations carefully:

```compact
export sealed ledger hiddenPrice: Bytes<32>;          // the reserve — hidden (a commitment)
export ledger bidders: Map<Bytes<32>, Uint<16>>;      // pubKey -> bid amount
export ledger highestBid: Uint<16>;                    // public
export ledger bidCount: Counter;                       // public
```

And the bid circuit:

```compact
const publicBid = disclose(bidAmount);
bidders.insert(pubKey, publicBid);
```

The variable is called `publicBid` because it is public. **This contract hides the seller's reserve price and the bidders' real-world identities. It does not hide the bids.** Its own documentation says so: *"an auction with a private reserve that also maintains the privacy of bidders with bid amounts as public information."*

That is a legitimate and useful design. It is not a sealed-bid auction.

## Why the naïve fix does not work

The instinct is: store `persistentCommit(bid, salt)` instead of `bid`. Correct — and now nothing on-chain can compare two bids, because a circuit cannot compare two commitments without opening them. Comparison needs the plaintext. The plaintext is on the bidders' separate machines, and Midnight has no on-chain multi-party computation that could compare them without a trusted party holding a decryption key.

**So: on Midnight today, you cannot find the maximum of a set of permanently hidden numbers.** Any design claiming otherwise is either wrong or is quietly reintroducing a trusted auctioneer — which is the exact thing these products exist to remove.

## The three mechanisms that do work

### Mechanism A — Commit, then selective reveal

Two windows, enforced by `blockTimeLt` / `blockTimeGte` against sealed deadlines.

1. **Bid window.** Each bidder writes `persistentCommit(amount, salt)` into `Map<dappPubKey, Bytes<32>>` and escrows a deposit. Amounts are invisible. Commitments are binding, so no one can change their number later.
2. **Reveal window.** A bidder who wants to win opens their commitment: `reveal(amount, salt)`. The contract recomputes the commitment, checks it matches, and updates `highestRevealed` / `winner` if the amount beats the current leader.
3. **Settlement.** Highest revealed bid wins. Everyone else reclaims their deposit.

**What stays private forever:** every bid that is never revealed. A bidder who knows they are beaten simply does not open their commitment, and their number is sealed permanently. Nothing — not the landlord, not the platform, not a future subpoena of the chain — can recover it.

**What becomes public:** the winning bid, and any bid whose owner chose to reveal it. That is the honest cost, and in practice only serious contenders pay it.

**Why it stays honest:** the commitment is binding. Nobody can see others' numbers before committing, and nobody can adjust after. This is the textbook cryptographic sealed-bid auction, and it is the same construction real-world sealed tenders imitate with envelopes — minus the clerk who can peek.

**The failure mode to design for:** a winner who refuses to reveal. Solve it the way every commit–reveal protocol does — a deposit that is forfeited if you fail to open a commitment that would have won. State the rule publicly and enforce it in the contract.

### Mechanism B — Prove you cleared a hidden bar

The seller commits a reserve at construction (`sealed ledger hiddenPrice`). Bidders commit their offers. In the reveal window, **only bids that clear the reserve are ever opened** — everything below the bar stays sealed permanently and the failed bidders learn nothing about how far off they were.

This is Idea 3 in [sealed-bidding-ideas.md](../Ideas/sealed-bidding-ideas.md), the Secret Reserve Marketplace, and it is the mechanism the official example is halfway toward. It is strictly more private than Mechanism A on the losing side, at the cost of an outcome that is "deal or no deal" rather than "highest wins".

### Mechanism C — Compete on proven qualifications, never on price

Fix the price publicly. Applicants do not bid; they **prove predicates** about private facts they never transmit:

```
income ≥ 3 × rent      AND      no prior eviction      AND      tenure ≥ 12 months
```

The private facts are witnesses. They never leave the applicant's machine. The contract verifies an attestation signature inside the circuit and writes exactly one thing to the ledger: `qualified`, plus a nullifier so nobody applies twice.

This is the [ZK Loan DApp](https://docs.midnight.network/examples/dapps/zkloan) pattern, and its documentation describes the property precisely:

> "The blockchain learns *whether* the user qualifies for which tier, never *why*."

**This mechanism has no privacy compromise at all.** There is no reveal phase, because there is nothing to reveal. It is also the easiest of the three to build, and it carries the strongest fairness argument: a selection that provably cannot see an applicant's name, origin, religion, or family status is not merely compliant with anti-discrimination law — it makes the discrimination mechanically impossible.

## Choosing between them

| | A — Commit/reveal | B — Clear the bar | C — Qualification |
|---|---|---|---|
| Losing bids stay secret | Only if not revealed | Yes, always | Nothing to keep secret |
| Winning number public | Yes | Yes | N/A — price is fixed |
| Needs a reveal window | Yes | Yes | No |
| Contract complexity | Medium | Medium | Low |
| Fails if participants go offline | Yes — needs deposit forfeiture | Yes | No |
| Strongest claim | "Highest bid provably won" | "A deal existed, or nothing was exposed" | "Selection provably ignored who you are" |

**C is the safest to build and A is the most impressive.** Both project plans here use **A** as the core, because sealed price competition is the product: [BlindBid](../Ideas/BlindBid_Closed_Private_Auction_Midnight.md) for a one-shot auction, [SealedRent](../Ideas/SealedRent_Private_Rent_Bidding_Midnight.md) for a market where one deposit backs offers on many listings. C appears in SealedRent as an optional qualification filter layered on top of A — the landlord may require applicants to prove they qualify before they are allowed to bid.

One consequence of choosing A that is easy to miss: **the winning value always becomes public**, because someone has to open a commitment for the comparison to happen. Only the losers stay sealed. If the winning number must also stay private, A is the wrong mechanism and the design needs B or C instead.

---

# Part 4 — Corrections to earlier documents in this repository

The idea documents in `Ideas/` were written before this research. They are directionally right and two specific claims in them need adjusting. Recorded here rather than silently edited, because the reasoning matters more than the correction.

### Correction 1 — "Even the metadata is hidden"

[sealed-bidding-ideas.md](../Ideas/sealed-bidding-ideas.md) says, of the closed auction:

> "Because Midnight's fees are paid by burning invisible DUST rather than by visible payments, observers cannot even count how many bids arrived or when."

The DUST half is right: fee payment is shielded and reveals nothing. But **the contract call itself is a public transaction**. The visibility table is explicit that the contract address, the entry point, and the block timing are all observable. An observer counts bids by counting calls to the `bid` circuit.

**What is true instead:** observers see *that* N bids arrived and roughly when, and nothing about their contents or who made them. Hiding the count as well is possible — insert into a `MerkleTree`, which is the one ledger operation that hides its argument, or accept decoy submissions — but it is a deliberate extra design step, not a free property of the chain.

The stronger version of the claim, and the one that survives scrutiny: **a late flood of bids is visible; what those bids say is not.** For most of the fraud these products target — the phantom competing offer, the peeking clerk, the quietly altered outcome — the content is what matters.

### Correction 2 — "Private bid" in the BlindBid plan

[BlindBid](../Ideas/BlindBid_Closed_Private_Auction_Midnight.md) describes `placeBid()` as recording a private bid, and lists a five-call lifecycle: `createAuction` → `placeBid` → `closeAuction` → `settleAuction` → `claimRefund`.

If that is built on top of the official auction example, **the bids will be public**, because that example publishes them. To deliver what the pitch promises, `placeBid` must store a `persistentCommit(amount, salt)` and the lifecycle needs a **sixth call and a second window**:

```
createAuction → commitBid → [bid window closes] → revealBid → closeAuction → settle → claimRefund
```

This is a small change to the plan and a large change to the claim. Worth making before any code is written, because retrofitting a reveal phase means rewriting both the contract and the UI.

---

# Part 5 — The honest leaks

Every one of these is a real limitation of the platform as it stands in August 2026. None of them sinks the projects; all of them should be stated out loud rather than discovered by a judge.

**Participation is visible.** Calling a contract is a public act. A landlord who lists on a public contract has a publicly countable applicant list, even though no application's contents are readable.

**Timing is visible.** Block times are observable. If your contract has a bid window and someone submits in the last block, that is visible. In a competitive setting, timing alone is information.

**The boundary is where identity lives.** Bridging value in and out of Midnight is a visible event. As the [third part of the explainer series](midnight-explained-part3.md) puts it, privacy lives inside the shielded world and the doors in and out are where the transparent world gets its look. Any deposit or escrow denominated in unshielded NIGHT is public in amount.

**Witnesses are not trusted.** Witness implementations run on the user's own machine, outside the ZK circuit, and are not cryptographically verified. Anything a witness returns must be validated by the contract — through a commitment check, an attestation signature, or a proof — before it is believed. A contract that trusts a witness value has no security at all.

**A commitment binds only if the salt survives.** If a bidder loses their salt they cannot open their bid, and their deposit is at risk under any forfeiture rule. The salt has to be stored in the DApp's private state, and the recovery story is a product decision, not an afterthought.

**DUST is slow to arrive.** Registration through the cross-chain path takes about 12 hours; a local network takes about 5 minutes ([Tokens on Midnight](https://docs.midnight.network/tokens/overview)). For a consumer product, [DUST sponsorship](https://docs.midnight.network/guides/dust-sponsorship) is not optional — the operator holds the NIGHT and pays fees so users transact from their first click.

---

# Part 6 — The checklist

Run this before calling any contract in this repository finished. It condenses the [pre-deployment security checklist](https://docs.midnight.network/guides/security-best-practices) down to what applies to sealed bidding.

- [ ] Every ledger field is deliberately public. Say out loud, for each one, why a stranger may read it.
- [ ] No `Map` or `Set` holds a raw sensitive number. Commitments only.
- [ ] Every commitment uses a fresh, never-reused `Bytes<32>` salt.
- [ ] Every hash uses a distinct domain separator per purpose.
- [ ] `persistentCommit` / `persistentHash` for anything on the ledger — never the `transient` variants.
- [ ] No `ownPublicKey()` anywhere in an authentication path. Identity is derived from a witness secret.
- [ ] Every parameter that must not move after launch is `sealed`.
- [ ] Every deadline is enforced with a `blockTime*` predicate against a `sealed` field.
- [ ] Every one-shot action is protected by a nullifier.
- [ ] Every witness-supplied value is validated before it is trusted.
- [ ] Every `disclose()` sits as close to its disclosure point as the code allows, and each one has been justified individually.
- [ ] The offline-participant failure mode has a defined, contract-enforced consequence.
- [ ] The contract compiles. Not "looks right" — compiles, with `compact compile` or `/midnight-verify:verify`.

---

## Sources

Everything above traces to these pages, all read on 29 August 2026:

- [Security and best practices](https://docs.midnight.network/guides/security-best-practices) — visibility table, block-time predicates, deadlines, checklist
- [Smart contract security](https://docs.midnight.network/compact/smart-contract-security) — execution contexts, sealed fields, primitives, nullifiers, the `ownPublicKey()` warning
- [Explicit disclosure](https://docs.midnight.network/compact/reference/explicit-disclosure) — what `disclose()` is and is not
- [Private data](https://docs.midnight.network/concepts/how-midnight-works/keeping-data-private) — commitments, salts, Merkle trees, commitment/nullifier pattern
- [Private Reserve Auction](https://docs.midnight.network/examples/contracts/private-reserve-auction) — the contract quoted in Part 3
- [ZK Loan DApp](https://docs.midnight.network/examples/dapps/zkloan) — the qualification pattern
- [Ledger data types](https://docs.midnight.network/compact/data-types/ledger-adt) — what each ledger structure can do
- [Tokens on Midnight](https://docs.midnight.network/tokens/overview), [DUST sponsorship](https://docs.midnight.network/guides/dust-sponsorship) — fees and onboarding

Full annotated index: [midnight-docs-map.md](midnight-docs-map.md).
