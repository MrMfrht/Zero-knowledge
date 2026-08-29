# SealedRent — Private Rent Bidding on Midnight

> **Bid privately. Get the flat fairly. Get your money back.**

*A build plan. Companion to [BlindBid](BlindBid_Closed_Private_Auction_Midnight.md), which auctions an object once; SealedRent runs a whole rental market where one person applies to many flats with one deposit. Written against the constraints in [docs/midnight-privacy-model.md](../docs/midnight-privacy-model.md).*

*This document is written to be understood, not skimmed. Section 2 follows one person's money from start to finish, and everything after it is detail on top of that story. If you read one thing, read Section 2.*

---

## 1. What it is, in four sentences

A rental market where applicants submit **sealed offers** — nobody, including the landlord, can read an offer until its window closes. Each applicant posts **one refundable deposit** that backs applications to as many flats as they like. When a listing closes, the highest sealed offer wins an **exclusive option** to take the flat; accepting locks their deposit and drops them out of every other listing. Everyone who doesn't win gets their deposit back, and every offer that never won stays sealed forever.

The one thing the market has never had: **a rejected applicant can verify they were treated fairly**, from public data, without trusting the landlord.

---

## 2. Follow the money

This is the whole product. Real numbers, every step, and what the world can see at each one.

**The cast**

- **Amina** lists Flat A. Asking 4,200/month. She'll take the highest offer.
- **Karim** has 2,000 to put down. He's applying to three flats — A, B, and C — because that's what actually happens when you're looking for somewhere to live.
- The market's deposit is **2,000, the same for everybody**. Published up front.

### Step 1 — Karim posts his deposit. Once.

He sends 2,000 into the market contract. Not to Amina, not to a letting agent — into the contract, which nobody controls.

```
Karim's wallet:  2,000  →  0
Contract holds:      0  →  2,000  (Karim's deposit, unlocked)
```

This 2,000 is **not rent**. It's a bond — proof he's serious. He'll get it back unless he wins a flat and then walks away.

### Step 2 — He makes three sealed offers, all backed by that one deposit

For Flat A he decides on **4,500**. On his own laptop, his wallet:

1. generates a random 32-byte salt
2. computes `commitment = persistentCommit(4500, salt)`
3. sends **only the commitment** to the chain

The commitment is a scrambled 32-byte value. It's **hiding** — nobody can work out 4,500 from it, because the random salt makes guessing impossible. And it's **binding** — Karim can never later claim he offered something else, because only the real number opens it.

He does the same for Flat B (4,300) and Flat C (4,400).

```
Karim's wallet:      0
Contract holds:  2,000  (still one deposit, now backing three offers)
```

What the world sees: *three offers exist from pseudonym `0x7f3a…`, one on each of A, B and C.* Not one of the amounts.

What **Amina** sees: `4 sealed offers`. Not the numbers. Not who. Not even whether the people bidding on her flat are bidding elsewhere.

### Step 3 — The window closes. Now people can open their offers.

Amina's listing had a deadline; block time passes it and no more offers are accepted.

Now the reveal window opens, and here is the part that makes this work:

> **Opening your offer is optional, and never revealing costs you nothing.**

Karim opens his: he sends `4500` and his salt. The contract recomputes `persistentCommit(4500, salt)`, checks it matches what he stored in step 2, and — it does — records him as the current leader at 4,500.

Another applicant, Dana, offered 4,100. She can see the leader is at 4,500. **She has no reason to open her offer.** Opening it would publish her number and change nothing — she'd still lose. So she doesn't.

**Dana's 4,100 stays sealed permanently.** Not encrypted on someone's server. Not "deleted, we promise." Mathematically unrecoverable, by anyone, forever. It does not follow her to her next viewing, and Amina never learns how close she came.

That's not a rule anyone enforces. It's what a rational person does, and the design just gets out of the way.

```
Karim's wallet:      0
Contract holds:  2,000  (deposit — untouched by any of this)
Public now:      Flat A's top offer is 4,500 from 0x7f3a…
Still sealed:    Dana's 4,100, and every other unopened offer
```

### Step 4 — Karim gets an offer. Not a win — an *option*.

The reveal window closes. Karim had the highest opened offer, so the contract hands him an **exclusive option** on Flat A, with a deadline — say 24 hours.

He hasn't won yet. He has the right to accept.

Meanwhile Flat B's window also closed, and he's the top there too. **He now holds two options and 2,000, and can only take one.**

### Step 5 — He accepts Flat A. Flat B falls to its runner-up.

Karim calls `acceptOffer(A)`. One thing happens on the ledger:

```
lockedTo[Karim] = Flat A
```

That single entry is the exclusivity mechanism. His deposit is now committed to A. When Flat B's option expires unaccepted, **anyone** can call `passToRunnerUp(B)`, and B's second-highest opener gets the option instead.

Nobody had to hunt Karim down and remove him. His deposit simply can't be in two places, and the contract checks that when he tries to accept.

```
Karim's wallet:      0
Contract holds:  2,000  (locked to Flat A)
Flat B:          option now with its runner-up
Flat C:          window not closed yet — his offer there is dead on arrival,
                 because he can't accept a second option
```

### Step 6 — He pays the rent. The deposit comes back.

He calls `settle(A)` and sends the first month: **4,500**.

```
Karim's wallet:  4,500  →  0        (he pays the rent)
Contract holds:  2,000  →  6,500    (deposit + rent)
                        →  2,000    (deposit returns to Karim)
Karim's wallet:      0  →  2,000    (deposit back)
```

Then Amina calls `claim(A)`:

```
Contract holds:  4,500  →  0
Amina:               0  →  4,500
```

Done. Karim has his 2,000 back and a flat. Amina has 4,500. The contract holds nothing.

### Step 7 — Everyone else takes their money back

Dana calls `claimRefund()`. She never revealed, she isn't locked to anything, so she gets her 2,000 back. Same for everyone who lost, and everyone who never opened their offer.

**Nobody has to be paid out by anybody.** Each person pulls their own money whenever they want. There is no queue, no admin, no "we'll process refunds within 14 days."

### And if Karim had vanished after accepting?

The payment deadline passes. Amina calls `claimForfeit(A)` and takes his **2,000 deposit** as compensation for the flat sitting empty. That's the only circumstance in which anyone loses money, it's published before anyone applies, and it's what makes an accepted option mean something.

---

## 3. Why it has to work this way

Three design choices look arbitrary until you see what breaks without them.

### "Why not just hide all the offers and let the contract pick the highest?"

Because **a contract cannot compare two hidden numbers.**

Comparison needs the actual values. The actual values are commitments — deliberately unreadable. To compare them, something must open them, and Midnight has no on-chain multi-party computation that could do that without someone holding a key.

Any design that promises "permanently sealed offers, and the highest automatically wins" has quietly reintroduced a trusted party who can read everything. That's the exact thing this product exists to remove.

**So there must be a reveal step.** The good news, from Step 3: rational players only reveal when it helps them, so almost nobody does. You get near-total secrecy from self-interest rather than from a promise.

### "Why a deposit instead of escrowing the rent?"

Because you asked for one pot of money to back several applications — and that's only possible if the money isn't the rent.

If Karim had to escrow the full rent for each flat, three applications would cost him 13,200 locked up. Backing three full rents with 2,000 isn't privacy engineering, it's double-spending, and no chain permits it.

A **deposit** breaks the deadlock:

| | Escrow the rent | Escrow a deposit |
|---|---|---|
| Apply to 3 flats with 2,000 | Impossible | Works |
| Money locked while searching | 3 × full rent | 2,000, once |
| Landlord protected if winner vanishes | Yes | Yes — takes the deposit |
| Deposit amount leaks your offer | **Yes** — a 4,500 escrow says your offer is 4,500 | **No** — everyone posts the same 2,000 |

That last row is the one that matters most. **Unshielded amounts are public on Midnight.** A per-offer escrow would print your bid on the chain in plain sight and unseal the whole auction. A uniform deposit is identical for everyone and therefore carries zero information.

This is also just how rental holding deposits already work, which makes it easier to explain to a landlord than anything cryptographic.

### "Why an option to accept, instead of just winning automatically?"

Two reasons, one technical and one human.

**Technical:** a contract cannot loop over every listing to remove someone who won elsewhere. Midnight's block limits are hard limits, not gas costs — an operation that's too big doesn't cost more, it **cannot run at all**. So there is no "automatically remove from the others" instruction to write.

Instead the check happens where it's cheap: at the moment of accepting. One lookup, `lockedTo[Karim]`. If it's set, you can't accept. Every other listing then falls through to its runner-up on its own schedule.

**Human:** if winning were automatic, whichever listing happened to close first would decide where Karim lives. He'd have no say. Giving him an option to accept — with a deadline, so nothing stalls — means the tenant chooses. In an app about not being pushed around by a rental market, that's not a small detail.

---

## 4. The lifecycle

```
                    ┌─────────────────────────────────┐
                    │  deposit()   — once per person  │
                    │  2,000 into the contract        │
                    └────────────────┬────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
   commitBid(A, c)             commitBid(B, c)             commitBid(C, c)
   opaque commitment           opaque commitment           opaque commitment
        │                            │                            │
        │  ── each listing's offer window closes on its own time ──
        ▼                            ▼                            ▼
   revealBid(A, …)             revealBid(B, …)              (never opened —
   optional, only if           optional                      stays sealed
   you'd actually win                                        forever)
        │                            │
        ▼                            ▼
   top opener gets            top opener gets
   an OPTION (24h)            an OPTION (24h)
        │                            │
   acceptOffer(A) ──── locks deposit to A ────► every other option
        │                                        becomes unacceptable
        ▼                                                │
   settle(A): pay rent, deposit returns                   ▼
        │                                        passToRunnerUp(B)
        ▼                                        (anyone may call)
   claim(A): landlord takes the rent
```

And the exits, so nothing can get stuck:

| Situation | What happens |
|---|---|
| Nobody opens an offer | No leader, listing closes empty, everyone refunds |
| Top opener declines or ignores the option | `passToRunnerUp` — next-highest opener gets it |
| Applicant loses their salt | Can't open the offer, so can't win — **but still refunds**, because refunds need only their secret |
| Winner accepts, then never pays | Landlord claims the deposit after the payment deadline |
| Applicant just changes their mind | Never reveals, never accepts, refunds. Costs nothing. |

---

## 5. The contract

> **Sketches, not compiled code.** Every construct comes from the official docs, but nothing here has been through `compact compile`. Verify before building — see [the compact-authoring skill](../.claude/skills/compact-authoring/SKILL.md).

### One contract for the whole market

This is the structural change that makes the shared deposit possible. One contract per listing can't do it, because contracts don't share state.

```compact
pragma language_version 0.23;
import CompactStandardLibrary;

// --- market-wide, fixed at deployment --------------------------------
export sealed ledger depositAmount: Uint<64>;   // identical for everyone

// --- one entry per listing -------------------------------------------
export ledger listingSeller:   Map<Bytes<32>, Bytes<32>>;  // listingId -> seller key
export ledger offerDeadline:   Map<Bytes<32>, Uint<64>>;
export ledger revealDeadline:  Map<Bytes<32>, Uint<64>>;
export ledger acceptDeadline:  Map<Bytes<32>, Uint<64>>;
export ledger payDeadline:     Map<Bytes<32>, Uint<64>>;

export ledger topBidder:       Map<Bytes<32>, Bytes<32>>;
export ledger topBid:          Map<Bytes<32>, Uint<64>>;
export ledger runnerUpBidder:  Map<Bytes<32>, Bytes<32>>;   // so an option can fall through
export ledger runnerUpBid:     Map<Bytes<32>, Uint<64>>;
export ledger acceptedBy:      Map<Bytes<32>, Bytes<32>>;
export ledger rentPaid:        Map<Bytes<32>, Uint<64>>;

// --- one entry per applicant -----------------------------------------
export ledger deposits: Map<Bytes<32>, Uint<64>>;   // uniform, so publishing it leaks nothing
export ledger lockedTo: Map<Bytes<32>, Bytes<32>>;  // ← the exclusivity mechanism

// --- one entry per (listing, applicant) pair --------------------------
export ledger offers: Map<Bytes<32>, Bytes<32>>;    // H(listingId, key) -> commitment

witness localSk(): Bytes<32>;

circuit myKey(): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([pad(32, "sealedrent:pk:"), localSk()]);
}

circuit offerKey(listingId: Bytes<32>, bidder: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([listingId, bidder]);
}
```

Every field there is public — and every one is meant to be. Read the list again: there is no offer amount, no name, no income, no document. `offers` holds commitments. `deposits` holds the same number for everybody. That's the whole on-chain footprint.

### Deposit, once

```compact
export circuit deposit(): [] {
    const k = disclose(myKey());
    assert(!deposits.member(k), "you already have a deposit");
    receiveUnshielded(default<Bytes<32>>, depositAmount as Uint<128>);
    deposits.insert(k, depositAmount);
}
```

### Offer — sealed, and reusable across listings

```compact
export circuit commitOffer(listingId: Bytes<32>, commitment: Bytes<32>): [] {
    assert(blockTimeLt(offerDeadline.lookup(listingId)), "offer window closed");
    const k = disclose(myKey());
    assert(deposits.member(k), "post a deposit first");
    assert(!lockedTo.member(k), "your deposit is committed to a flat already");
    const ok = disclose(offerKey(listingId, k));
    assert(!offers.member(ok), "one offer per listing");
    offers.insert(ok, commitment);            // opaque — the salt does the hiding
}
```

Notice what is **not** here: no second deposit, no per-listing escrow. The one deposit from `deposits` backs this offer and every other one.

### Reveal — optional, and it tracks two places

```compact
export circuit revealOffer(listingId: Bytes<32>, amount: Uint<64>, salt: Bytes<32>): [] {
    assert(blockTimeGte(offerDeadline.lookup(listingId)),  "reveal not open yet");
    assert(blockTimeLt(revealDeadline.lookup(listingId)),  "reveal window closed");
    const k  = disclose(myKey());
    const ok = disclose(offerKey(listingId, k));
    assert(offers.member(ok), "no offer here");
    assert(persistentCommit<Uint<64>>(amount, salt) == offers.lookup(ok),
           "that does not open your offer");

    const a = disclose(amount);
    if (a > topBid.lookup(listingId)) {
        runnerUpBidder.insert(listingId, topBidder.lookup(listingId));   // demote
        runnerUpBid.insert(listingId, topBid.lookup(listingId));
        topBidder.insert(listingId, k);
        topBid.insert(listingId, a);
    } else if (a > runnerUpBid.lookup(listingId)) {
        runnerUpBidder.insert(listingId, k);
        runnerUpBid.insert(listingId, a);
    }
}
```

Tracking the runner-up is what lets an unaccepted option fall through without anyone iterating over the bidders.

### Accept — one line does the exclusivity

```compact
export circuit acceptOffer(listingId: Bytes<32>): [] {
    assert(blockTimeGte(revealDeadline.lookup(listingId)), "reveal still open");
    assert(blockTimeLt(acceptDeadline.lookup(listingId)),  "your option expired");
    const k = disclose(myKey());
    assert(topBidder.lookup(listingId) == k, "the option is not yours");
    assert(!lockedTo.member(k),  "you have already accepted a flat");
    assert(!acceptedBy.member(listingId), "already taken");
    lockedTo.insert(k, listingId);        // ← this is it
    acceptedBy.insert(listingId, k);
}

export circuit passToRunnerUp(listingId: Bytes<32>): [] {
    assert(blockTimeGte(acceptDeadline.lookup(listingId)), "option window still open");
    assert(!acceptedBy.member(listingId), "already accepted");
    topBidder.insert(listingId, runnerUpBidder.lookup(listingId));   // promote
    topBid.insert(listingId, runnerUpBid.lookup(listingId));
    runnerUpBidder.insert(listingId, default<Bytes<32>>);
    runnerUpBid.insert(listingId, 0);
    acceptDeadline.insert(listingId, /* now + option window */);
}
```

`passToRunnerUp` is **permissionless on purpose**. Anyone can advance a stalled listing, so no landlord can freeze one to manipulate who ends up with it.

### Settle, refund, forfeit — every path ends somewhere

```compact
export circuit settle(listingId: Bytes<32>): [] {
    assert(blockTimeLt(payDeadline.lookup(listingId)), "payment window closed");
    const k = disclose(myKey());
    assert(acceptedBy.lookup(listingId) == k, "not your flat");
    assert(rentPaid.lookup(listingId) == 0,   "already settled");
    receiveUnshielded(default<Bytes<32>>, topBid.lookup(listingId) as Uint<128>);
    rentPaid.insert(listingId, topBid.lookup(listingId));
    lockedTo.remove(k);                                     // deposit released
    deposits.remove(k);
    sendUnshielded(default<Bytes<32>>, depositAmount as Uint<128>, ownPublicKey());
}

export circuit claimRent(listingId: Bytes<32>): [] {
    const k = disclose(myKey());
    assert(listingSeller.lookup(listingId) == k, "not your listing");
    const amount = rentPaid.lookup(listingId);
    assert(amount > 0, "nothing to collect");
    rentPaid.insert(listingId, 0);
    sendUnshielded(default<Bytes<32>>, amount as Uint<128>, ownPublicKey());
}

export circuit claimRefund(): [] {
    const k = disclose(myKey());
    assert(deposits.member(k),   "no deposit");
    assert(!lockedTo.member(k),  "your deposit is committed to a flat");
    deposits.remove(k);
    sendUnshielded(default<Bytes<32>>, depositAmount as Uint<128>, ownPublicKey());
}

export circuit claimForfeit(listingId: Bytes<32>): [] {
    assert(blockTimeGte(payDeadline.lookup(listingId)), "payment window still open");
    assert(rentPaid.lookup(listingId) == 0, "the tenant paid");
    const k = disclose(myKey());
    assert(listingSeller.lookup(listingId) == k, "not your listing");
    const winner = acceptedBy.lookup(listingId);
    assert(deposits.member(winner), "already claimed");
    deposits.remove(winner);
    lockedTo.remove(winner);
    sendUnshielded(default<Bytes<32>>, depositAmount as Uint<128>, ownPublicKey());
}
```

Two things carried over from the privacy rules, and both matter:

- **Payouts route with `ownPublicKey()`.** That's its one sanctioned use — saying *where the money lands*. It never authenticates anyone. Authentication is always proving you know `localSk()`. Storing a payout address at commit time would link your pseudonym to a real address on a public ledger, so don't.
- **Refunds need only the secret, never the salt.** Lose your salt and you lose the flat; you never lose your money.

---

## 6. What's public and what isn't

| | Visible to anyone | Notes |
|---|---|---|
| Listing, rent asked, all deadlines, the deposit | **Yes** | It's a listing. Meant to be read. |
| That an offer exists, and when it arrived | **Yes** | A contract call is a public transaction |
| Number of offers on a listing | **Yes** | |
| **The offer amount, before reveal** | **No** | Salted commitment — unreadable, including by the landlord |
| **An offer that is never opened** | **No, permanently** | Unrecoverable by anyone, forever |
| The winning offer | Yes, at reveal | Unavoidable — see §3 |
| Applicant's real identity | **No** | Disclosed off-chain, after winning, to sign the lease |
| Applicant's pseudonym | Yes | Per-market, not your name |
| **Which listings one pseudonym applied to** | **Yes** | ← the cost of the shared deposit. See below. |
| Fee payment | **No** | DUST is shielded |

### The trade you're making, stated plainly

The shared deposit **requires** the contract to recognise you across listings. Same secret, same market, same derived key. So the chain shows:

> pseudonym `0x7f3a…` offered on A, B and C; accepted A

That's not your name, and nobody can read a single one of those offers. But your *application pattern* is legible, and it wouldn't be if each listing were its own contract with its own key.

This is unavoidable, not an oversight — exclusivity means the contract must know it's the same person. Put it in the README rather than leaving it for a judge to find. It is a good trade, and it should be a knowing one.

---

## 7. The optional filter: qualification without disclosure

A landlord can require applicants to **prove** they qualify before they may offer — income, tenure, rental history — without ever receiving any of it.

```compact
witness incomeMonthly(): Uint<32>;
witness attestation():   Bytes<64>;

// gate on commitOffer
assert(verifyAttestation(attestation(), attestorPubKey, incomeMonthly(), myKey()),
       "credential invalid or from an unrecognised issuer");
assert(incomeMonthly() >= askingRent * 3, "income below the published multiple");
```

Three private numbers go in. **Nothing derived from them is stored anywhere.** The landlord learns one bit: this applicant qualifies.

Two things make it real rather than theatre:

1. **The signature.** Witnesses run on the applicant's own machine and are not verified by anything, so without an issuer's signature an applicant simply returns `income = 999999` and the proof proves nothing. Follow [example-zkloan](https://github.com/midnightntwrk/example-zkloan) — it verifies Schnorr-on-Jubjub inside the circuit.
2. **Bind the credential to the applicant's key.** Otherwise Karim borrows Dana's credential.

Be straight in the demo that the issuer is a mock — no bank issues these today. The claim is the architecture: *the landlord trusts the bank's signature, not the applicant's word, and never sees either.*

This is also the strongest fairness argument in the project. A selection circuit that never receives a name, a photo, an origin, or a family situation cannot discriminate on them. Anti-discrimination law punishes that after the fact; here it's simply unavailable.

**Build it after the bidding works.** It's an add-on, not a prerequisite.

---

## 8. Build order

Each step ends with something that runs. If time runs out, what's finished still demos.

| # | Build | Done when |
|---|---|---|
| 0 | WSL2, Docker, Compact toolchain, proof server | `compact compile --version` says `0.31.1`, proof server answers on `:6300` |
| 1 | Run `hello-world` end to end | Deploying and calling a contract is boring |
| 2 | **Verify escrow in isolation** | A contract takes NIGHT in and pays it back to the caller. Do this before anything else — see §10 |
| 3 | **One listing**: commit → reveal → settle → refund | An offer can't be opened to a different number; reveal fails outside the window; a loser gets their money back |
| 4 | **Market contract**: many listings, one deposit each | One deposit backs offers on three listings |
| 5 | **Options**: runner-up tracking, `acceptOffer`, `passToRunnerUp`, `lockedTo` | Accepting A makes B unacceptable, and B falls to its runner-up |
| 6 | UI: browse, offer, my applications, result | Someone who's never seen it can apply without being told how |
| 7 | Qualification filter | An unqualified applicant is rejected by the circuit and nothing is written |

**Step 5 is what nobody else will have.** But it only works if 3 and 4 are solid — a bug in `lockedTo` means somebody's deposit is stuck, and "your money is trapped in our contract" is the worst possible demo.

---

## 9. Tests

Follow the [documented pattern](https://docs.midnight.network/guides/security-best-practices): build a circuit context with an explicit block time so both sides of every gate are testable.

**Sealing**
- A commitment cannot be opened with a different amount
- A commitment cannot be opened with a different salt
- Before reveal, no offer amount is recoverable from `offers`
- After a full run, the ledger contains no unopened offer amount

**Windows** — offer before / at / after the deadline; reveal before it opens, inside, after it closes; accept inside and after the option window; settle inside and after the payment window

**The shared deposit — the heart of it**
- One deposit backs offers on three listings
- Accepting A makes accepting B fail
- After accepting A, `claimRefund` fails
- `passToRunnerUp(B)` promotes the correct person
- After `settle(A)`, the deposit returns and `claimRefund` no longer applies

**Money conservation — run this after every scenario**
- The contract's balance equals unlocked deposits + locked deposits + unclaimed rent
- No path lets anyone withdraw twice
- No path leaves a deposit unclaimable by anybody

**Failure paths**
- Nobody reveals → all refund, no sale
- Winner never pays → landlord forfeits the deposit, losers already refunded independently
- Applicant loses the salt → can't reveal, **can still refund**

---

## 10. What will actually cost you time

**Escrow.** The least-documented area, and everything else sits on top of it. `sendUnshielded` in the [official example](https://docs.midnight.network/examples/contracts/token-transfers) takes a `UserAddress`, while `ownPublicKey()` returns a Zswap coin public key — whether they compose directly, or the unshielded path needs a different accessor, is exactly what you should not guess. Settle it in ten minutes:

```
/midnight-verify:verify "a Compact circuit can send unshielded NIGHT to the caller using ownPublicKey()"
```

**Salt custody.** Encrypted private state handles storage (`@midnight-ntwrk/midnight-js-level-private-state-provider`, 16+ character password). It does not handle "user cleared their browser." Refunds survive it by design; the flat does not. Document that rather than pretend.

**Reveal-window UX.** People have to come back. You cannot auto-reveal from a server without handing that server the salt, which defeats the point. Reminders and a generous window; there's no clever fix.

**DUST.** Registration through the cross-chain path takes ~12 hours; local devnet takes ~5 minutes. Demo on `undeployed`, fund testnet wallets a day early, or implement [sponsorship](https://docs.midnight.network/guides/dust-sponsorship) so applicants need no tokens at all.

**WSL2.** Compact doesn't run natively on Windows, and neither do the Midnight Expert plugins. Repo on the Linux filesystem, not `/mnt/c`.

---

## 11. Where shielded tokens come in later

Not for the deposit — it's uniform, so publishing it leaks nothing. Not for the winning offer — reveal makes that public by construction.

**For the rent itself, once it recurs.** A public ledger reading *"this pseudonym paid 4,500 on the 1st of every month for three years"* is a tenancy history anyone can read. Shielded tokens exist to close exactly that leak — the chain records commitments and nullifiers, not amounts.

That's a real phase two, not a hedge. Unshielded for the MVP; shielded when SealedRent handles monthly rent rather than one settlement.

---

## 12. Demo, five minutes

1. **The lie.** *"Someone else offered more — can you match it?"* Ask who's heard it. Ask who could ever check.
2. **Karim applies to three flats with one deposit.** Show the amounts in his wallet. Show the commitments on the chain. Point at the screen: *these 32 bytes are his offer, and nobody in this room can read them, including the landlord.*
3. **Dana doesn't reveal.** Show that her 4,100 is still sealed after the auction is over — and always will be.
4. **Karim accepts Flat A.** Flat B falls to its runner-up, live, without anyone touching it.
5. **The money comes back.** Deposit returned, rent paid, contract empty.
6. **Verify as a loser.** From public data alone: the rule was set before offers opened, my offer was counted, the winner opened a real committed offer that beat mine. No trust in the landlord anywhere.
7. **The honest slide.** What's still public — the number of offers, their timing, and which listings one pseudonym applied to. Say it before anyone asks.

Step 3 is the one people remember. Step 4 is the one nobody else will have.

---

## 13. Honest limits

- **The winning offer becomes public.** Unavoidable with commit-reveal; the alternative is a trusted party who can read everything.
- **Application patterns are linkable** within the market. The price of the shared deposit.
- **Timing leaks.** A last-block offer is visible as a last-block offer.
- **Witnesses are untrusted.** Every value one returns must be validated in-circuit — the qualification filter is worthless without the attestation.
- **Credential issuers don't exist yet.** The adoption bottleneck is social, not cryptographic. Say so.
- **A lost salt costs the flat.** The money is always safe; the offer is not.
- **This does not fix housing supply.** It removes one specific category of lie. That's the whole claim, and keeping it narrow is what makes it true.

---

## 14. Why it's worth building

Every ethical tradition condemns the same three moves: inventing a rival to push a price up, deceiving someone about what they're agreeing to, and judging a person on what should be irrelevant. Islamic law names the first specifically — *najash*, fabricated bidding, prohibited directly by the Prophet Muhammad ﷺ. Jewish law names the second, *geneivat da'at*, stealing the mind. Every legal system on earth criminalises all three, and all three are ordinary features of renting a flat in any city, because they have always been possible and almost never provable.

What this design does isn't discourage them. It **removes what they need to exist**:

- A phantom rival needs a channel to be asserted through. Here the only offers that count are cryptographically committed ones.
- A changed rule needs the rule to be changeable. Here the deadlines and the deposit are `sealed` at deployment, and the compiler refuses to let a later circuit touch them.
- Discrimination needs the protected fact to reach the decision-maker. With the qualification filter, it never leaves the applicant's device.

Narrow claim, and worth keeping narrow. This doesn't make landlords honest, doesn't build houses, and does nothing about a landlord who declines to use it. What it does is take one category of profitable lie and make it structurally unavailable — including to the people who currently profit from it. That's the only kind of fairness that doesn't depend on someone choosing to be fair.

---

*Companion documents: [BlindBid](BlindBid_Closed_Private_Auction_Midnight.md) · [sealed-bidding-ideas](sealed-bidding-ideas.md) · [privacy model](../docs/midnight-privacy-model.md) · [docs map](../docs/midnight-docs-map.md)*
