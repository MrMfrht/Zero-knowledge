# Where the keys live, and what identity actually means here

*Two questions with uncomfortable answers. Both are better said out loud than
discovered by a judge. See [06-open-design-questions.md](06-open-design-questions.md)
for the ones still unresolved.*

---

# Part 1 — Is browser storage safe?

## Honestly: not very

Plain browser `localStorage` has real problems:

- **Any JavaScript on the page can read it.** One compromised npm dependency,
  one cross-site-scripting hole, and the secret walks out.
- **It is not encrypted at rest.**
- Browser extensions with the right permissions can read it.
- "Clear site data" destroys it, silently, with no warning.

## What the documentation recommends instead

`@midnight-ntwrk/midnight-js-level-private-state-provider` — encrypted on disk,
and it refuses to run without a password of at least 16 characters. This is what
the [ZK Loan example](https://docs.midnight.network/examples/dapps/zkloan) uses.

Better. Still not perfect: once unlocked, the decrypted key sits in memory for as
long as the app is open.

## The decision, as made — local storage for now

**DECIDED (for the hackathon):** the secret is 32 random bytes, generated once
by the app and kept in local storage on the device. This is what
[`packages/contract/src/witnesses.ts`](../packages/contract/src/witnesses.ts)
reflects: `localSk` reads `privateState.secretKey` from whatever private state
the caller supplies — it does not know or care where that state was stored.

That indifference is the important design property. **`witnesses.ts` is
storage-agnostic**, so upgrading storage later means changing where the private
state is loaded from, in one place in the api package — the contract, the
circuits, and `witnesses.ts` itself all stay untouched.

The upgrade path, in order:

| Stage | Where the secret lives | Status |
|---|---|---|
| **Now** | Local storage, via the private state handed to `witnesses.ts` | ✅ Decided, working (see the smoke run in the contract README) |
| Next | `@midnight-ntwrk/midnight-js-level-private-state-provider` — encrypted at rest, 16+ character password, the [ZK Loan example](https://docs.midnight.network/examples/dapps/zkloan)'s pattern | The straightforward hardening step |
| Later | Derive `localSk` from the wallet's seed phrase | Solves recovery for free — a seed phrase is already backed up. **Whether the DApp Connector allows this is unverified** — open question for B, tracked in [06](06-open-design-questions.md) |

## What to say about it

For the demo: local storage, stated plainly — losing the device costs the
identity, encrypted state is the next step, wallet-derived keys the one after.
A named limitation is a strength; a discovered one is a hole.

---

# Part 2 — The key has nothing to do with who you are

## There is no identity in the identity

```
localSk    = 32 random bytes.  Meaningless.
workerKey  = hash(localSk).    Also meaningless.
```

No name. No national ID. No document. **Nothing, anywhere in this system, checks
that the holder of a key is Karim.**

The contract knows exactly one thing: *"the holder of secret X."*

## So how does anyone know it is Karim?

**Because a human decided, in the real world, once.**

```
1. The employer interviews Karim. Sees his face, his documents.  ← the real check
2. Karim's app shows him his key:  0x7f3a…
3. He sends it to the employer.
4. The employer types it into `hire`.
```

**Step 1 is the identity verification, and it is not cryptographic — it is a
person in a room.** From then on, `0x7f3a…` *is* Karim as far as this contract is
concerned.

That is less strange than it sounds. It is how employment already works: you meet
someone, check their right to work, and then agree to pay *that person*.

*(Step 3 is not as safe as it looks — see
[06-open-design-questions.md](06-open-design-questions.md), question 1.)*

## The sentence worth memorising

> ### The contract provides continuity of identity, not verification of identity.

It guarantees, unbreakably, that **the same person who accepted the offer is the
one confirming the payments.** Nobody can step into that role later, ever.

It does **not** guarantee who that person is. It never claimed to.

## What actually goes wrong, and what does not

| Attack | Does it work? |
|---|---|
| Someone else confirms Karim's payments | Only if Karim hands over his secret — the same as giving away a bank login |
| An impostor is hired as "Karim" | They would have to fool the employer **in person, at interview**. The contract is not involved |
| Someone links `0x7f3a…` to a real name using the chain | No. The chain holds nothing but hashes |
| Someone links it using **the backend directory** | **Yes** — which is exactly why every directory route must be behind authentication. See [D_docs](../D_docs/implementation_plan.md) |

That last row is the one to hold on to: **the chain is safe precisely because the
keys are meaningless.** The directory is the file that makes them meaningful, and
it is therefore the highest-value target in the entire system.

## Could identity be bound cryptographically?

Yes — the attestation pattern from the ZK Loan example. An issuer (a bank, a
government, a previous employer) signs *"this key belongs to a verified person"*,
and the circuit checks that signature inside the proof.

**We deliberately did not build it.** It needs a real issuer, and no institution
is signing anything for us this week. Naming it as the next step is a better
answer than a mock that pretends to more than it does.

---

# Both answers in one line

**Storage:** encrypted local state, and losing the device costs the identity.
Wallet-derived keys are the fix and are unexplored.

**Identity:** the contract proves *the same person*, not *which person*. The
human check happens once, at interview, and everything after that is anchored to
it.
