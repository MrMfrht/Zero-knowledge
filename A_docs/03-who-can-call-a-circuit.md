# Where the secret lives, and who is allowed to call a circuit

*Two questions that come up the moment the code starts making sense. Both have
answers that are slightly surprising, and both are load-bearing — if you
understand these, you understand why the whole design is safe.*

---

# Question 1: if the secret lives on the user's machine, how do we get it?

## Drop the word "extract"

There is no server reaching into anyone's laptop. Nothing is fetched, requested,
or transmitted.

> **The circuit runs *on* the user's machine. The program travels to the secret,
> not the secret to the program.**

That single sentence is the whole answer. Everything below is detail.

## What physically happens when the employer clicks "Hire"

```
  On the employer's own laptop, inside their own browser:

  ┌──────────────────────────────────────────────────────┐
  │                                                       │
  │  1. The app loads the contract code                   │
  │     (managed/contract/index.js — just a file)         │
  │                                                       │
  │  2. It RUNS the circuit. Right here. Locally.         │
  │                                                       │
  │  3. The circuit reaches localSk()                     │
  │           ↓                                           │
  │  4. witnesses.ts — also running right here — reads    │
  │     the secret out of this browser's own storage      │
  │           ↓                                           │
  │  5. The circuit uses it and builds a PROOF            │
  │                                                       │
  └───────────────────────────┬───────────────────────────┘
                              │
                              │   ← only the proof leaves
                              ▼
                        the network
```

Step 4 is a function reading a value that is **already sitting in the same
browser**. No network call. It is the same kind of thing as a website reading a
preference you saved last week.

## Where the secret came from in the first place

Generated **once**, randomly, the first time that person used the app, and saved
in encrypted local storage — the same way a password manager holds passwords.

Nobody sent it to them. They never send it anywhere. It is created locally and
it stays locally, for its whole life.

## Why this is the entire product

If a server held that secret, the server could compute anything the user could —
including opening every sealed salary. The privacy claim would be a promise
rather than a fact.

By running the circuit where the secret already is, **there is no moment at
which the secret could be intercepted, because there is no moment at which it
travels.**

This is also why [the rule book](../tasks/RULEBOOK.md) says a salt or a secret
key must never reach a server, in any form, ever. It is not a precaution. It is
the thing being sold.

---

# Question 2: can anyone call `hire`?

## Yes. Absolutely anyone.

This surprises people, so let it land properly:

> **There is no login on a blockchain.** The contract sits at a public address.
> Every `export circuit` is callable by anyone, from anywhere, with no
> permission from us. A total stranger can construct a transaction calling
> `hire`.

We cannot stop them, and we do not try.

## So what stops a stranger hiring themselves at a huge salary?

Say Malik wants exactly that. He can read our contract — it is public — so he
knows the shape. He calls:

```
hire(worker: Malik's own ID, rateCommitment: scramble(999999))
```

The circuit begins running **on Malik's laptop**, and immediately hits:

```compact
assert(dappKey(localSk()) == employerKey, "only the employer may hire");
```

His `localSk()` returns *his* secret. Hashed, it produces some value. Compared
to `employerKey` — **not equal.**

**The assert fails, so no proof can be produced.**

Notice what that means: he does not get a rejected transaction. He never gets a
transaction at all. His own computer refuses to build one.

## "Then he edits the code and deletes the assert"

He can. It is a JavaScript file on his own machine. Nothing physically prevents
him from opening it and cutting that line out.

And it still does not work, for the reason that makes this entire system
function:

> ### The network does not run your code. It checks your proof against the circuit that was deployed.

When we deployed the contract, a **verification key** went on-chain — effectively
a fingerprint of our exact circuit, asserts included.

Malik's edited circuit is a **different circuit**. It produces a proof carrying a
different fingerprint. The network compares it to the deployed key, sees a
mismatch, and rejects it.

To get a proof the network accepts, he would have to produce one matching *our*
circuit — which means satisfying *our* asserts — which means holding the
employer's secret.

## The two layers

| Where | What stops him |
|---|---|
| **On his own machine** | The assert fails, so no proof can be built |
| **On the network** | Even a hand-made proof will not match the deployed circuit's fingerprint |

He cannot get past the first without the secret, and he cannot get past the
second by cheating on the first.

## So why leave the circuits open at all?

Because **openness is not the vulnerability.**

Every smart contract on every blockchain works this way. Anyone may call
anything. Security comes from the asserts, not from hiding the door.

This is the [anchor idea](01-understanding-the-contract.md) again, stated
differently: the door is wide open, and the lock is that you cannot produce an
input that passes.

And it is not merely tolerable — it is the point:

- Nobody has to **grant** Karim permission to confirm his own payment
- Nobody can **revoke** it either
- He calls the circuit; the contract checks his secret; he is let through
- **No administrator stands in the middle**

An employer who fell out with Karim cannot lock him out of his own payment
history. There is no account to suspend. That is precisely the property the whole
product is built to sell, and it exists *because* the circuits are open to
everyone.

---

# The two answers, side by side

| | Where it happens | Why it is safe |
|---|---|---|
| **Getting the secret** | On the user's own machine, in the same browser as the app | It never travels, so it can never be intercepted |
| **Calling a circuit** | Anyone, from anywhere, no permission | The assert cannot be satisfied without the secret, and the proof cannot be faked |

Both come down to the same idea. **We never rely on controlling access.** We rely
on the mathematics being impossible to satisfy without the right secret — which
is a much stronger guarantee than a login, because there is no administrator who
could be bribed, hacked, or subpoenaed into granting it.

---

*Next: [circuit 2, `acceptHire`](../tasks/01-contract.md) — the same open door,
but the check is "does this rate and salt open the sealed value?" instead of
"do you know the employer's secret?"*
