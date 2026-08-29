# Understanding the contract — from zero

*For A, and for anyone who wants to understand what we are actually building. No blockchain knowledge assumed. Read this before [01-contract.md](01-contract.md), which is the practical checklist.*

---

# Part 1 — The four ideas you need

Everything in this project rests on four ideas. If you understand these, the contract writes itself.

## Idea 1: The blockchain is a public notice board

Picture a giant notice board in a town square.

- **Anyone can read it.** No login, no permission, from anywhere in the world.
- **Nothing can ever be erased.** What goes up stays up, permanently.
- **Nobody controls it.** Not us, not the employer, not a government.

That is a blockchain. Useful properties — but a catastrophe for salaries. If we pin "Karim earns 5,000" on that board, the whole world knows Karim's salary forever.

**So the first rule of this project: never write a salary on the board.**

In our contract, the board is the part called `ledger`:

```compact
export ledger agreedRate: Map<Bytes<32>, Bytes<32>>;
```

Every `ledger` line is a thing pinned to the public board. `Map`, `Set`, `Counter` — all of them, readable by everyone. This is why the rule says *never put a salary in a `Map`*. It is not a style preference. Writing it there is the same as publishing it.

## Idea 2: A hash is a one-way scrambler

A **hash** turns any number into a scrambled 32-byte value:

```
5000  →  hash  →  0x9f3ac2b7e81b4d...
```

Two properties:

- **One-way.** Given `0x9f3ac2...`, you cannot work backwards to 5000.
- **Consistent.** Hashing 5000 always gives the same answer.

So we could pin the *hash* of the salary on the board instead of the salary. It looks like gibberish. Problem solved?

**No.** And this is the trap.

There are maybe 100,000 plausible monthly salaries. An attacker writes a five-line script: hash 1, hash 2, hash 3… hash 100,000, and compare each to what is on the board. One match, and they know the salary. **This takes under a second.**

A hash only protects a value that is hard to guess. A salary is easy to guess.

## Idea 3: A salt is what makes the hash actually safe

A **salt** is a big random number — 32 bytes, roughly a 77-digit number — that you mix in before hashing:

```
hash(5000 + 84710293847561028374...)  →  0x9f3ac2b7e81b4d...
```

Now the attacker has to guess the salary **and** the salt. There are more possible salts than atoms in the observable universe. They cannot.

> **Analogy.** Hashing a salary is like locking your diary with a 4-digit PIN — someone tries all 10,000 combinations over lunch. Adding a salt is like a 77-digit PIN.

The salt is generated once, randomly, and kept secret by the two people who need it. **A salt is a secret.** That is why the rule says salts never reach a server.

## Idea 4: A commitment is a sealed envelope

Put ideas 2 and 3 together and you get a **commitment**:

```
commitment = hash(salary + salt)
```

Think of it as **a sealed envelope with "5,000" written inside, dropped into a glass safe in the town square.**

Everyone can see there is an envelope. Nobody can read it. And two things are true:

| Property | What it means | Why it matters |
|---|---|---|
| **Hiding** | Nobody can work out the salary | The employer's competitors, the public, and *we* never learn it |
| **Binding** | You cannot swap it for a different envelope later | The employer cannot claim "I actually agreed 4,000" |

**Binding is the half people forget, and it is the one that makes the product work.** Only the original salary *and* the original salt produce that exact commitment. Change either, and you get a completely different value that will not match what is on the board.

In Compact that is one function call:

```compact
persistentCommit(rate, salt)
```

---

# Part 2 — How you prove things about a sealed envelope

Here is the part that sounds impossible.

**Question:** if the salary is sealed and unreadable, how can the blockchain check that a payment of 5,000 was correct?

**Answer: a zero-knowledge circuit.**

## What a circuit actually is

Compare two ways of checking something:

**The normal way (a website):**
```
You  ──send your salary──►  Server checks it  ──►  "Correct"
                            ↑
                     the server now knows your salary
```

**The circuit way:**
```
Your own computer does the check, and produces a mathematical PROOF
                            │
                            ▼
        Blockchain checks the proof  ──►  "Correct"
                            ↑
              never saw your salary. Nobody did.
```

A **circuit** is a function in the contract, but it runs **on your own machine**. What gets sent to the network is not your data — it is a proof that says *"I ran this function honestly and the answer was yes."*

The network can verify that proof is genuine without ever seeing what went into it. That is what "zero-knowledge" means: the network learns the **result** and zero **knowledge** about the inputs.

This is real mathematics, not obfuscation. The network genuinely cannot see the inputs, even if it wanted to.

## Witnesses — the private inputs

A **witness** is a piece of data that comes from your own computer and never gets published:

```compact
witness localSk(): Bytes<32>;    // your secret key
```

The contract declares that this function exists. The actual implementation lives in TypeScript on your device. The salary, the salt, the secret key — all witnesses.

> **The catch, and it matters:** because a witness runs on the *user's* machine, the user controls what it returns. **A witness value is never trustworthy on its own.** The contract must check it against something — that is what the commitment is for.

## `disclose()` — the most misleadingly named thing in Compact

You will see this everywhere:

```compact
qualified.insert(disclose(myKey()));
```

**`disclose()` does not hide anything. It does the opposite.**

Compact is paranoid by default. If you try to write private data onto the public board, the compiler **refuses to build** and tells you exactly which value and which path. That is a feature — it catches accidental leaks at compile time.

`disclose()` is you telling the compiler: *"yes, I know, I meant to publish this."*

So every `disclose()` in the contract is a deliberate decision to make something public, and each one should be justifiable. If you find yourself adding one to make an error go away, **stop** — the compiler is probably telling you that you are about to leak a salary.

---

# Part 3 — Why `ownPublicKey()` must never check who is calling

This is the rule that sounds most arbitrary, and it is the most important one.

## The problem

The contract needs to know who is calling. Only the employer may hire. Only Karim may confirm Karim's payments.

Compact has a built-in function that looks perfect for this:

```compact
ownPublicKey()    // "who is calling?"
```

**Never use it for that.** Here is why.

`ownPublicKey()` **is a witness** — it runs on the caller's own machine, and the caller controls what it returns. Nothing checks it against anything.

> **Analogy.** It is a website that asks you to type your username, with no password field. You type "admin". It says "Welcome, admin."

If we wrote `assert(ownPublicKey() == employerKey)`, then anyone at all could tell their own computer to return the employer's key, and the contract would believe them. They could hire people, approve hours, do anything.

## The fix: prove you know a secret

Instead of asking *"who are you?"*, we ask *"prove you know the secret."*

Every person has a random 32-byte secret on their own device, which never leaves it. Their public identity is the **hash** of that secret:

```compact
circuit myKey(): Bytes<32> {
    return persistentHash([pad(32, "nightshift:pk:"), localSk()]);
}
```

- The **secret** stays on the device, forever
- The **hash of it** goes on the public board as their identity

Now `assert(myKey() == employerKey)` is a real check. To produce the employer's identity hash, you must know the employer's secret. Nobody else can.

**That is the password check.** The hash is like a username; the secret is the password; and the maths does the verifying.

Two bonuses:

- **It is not your name.** `0x7f3a…` identifies you inside this contract and reveals nothing about who you are in real life.
- **It is different in every app.** The `"nightshift:pk:"` text is a *domain separator*. A different app uses a different word, so the same person gets a completely different identity there, and nobody can link the two.

---

# Part 4 — Why each circuit exists

Six circuits. Each solves one specific problem. Here is the problem first, then the circuit.

## 1. `hire`

**The problem.** The employer and Karim agree on 5,000. Six months later the employer says "we agreed 4,000." Who is right? Today: whoever has the better lawyer.

**What we need.** The agreed number recorded somewhere nobody can read and nobody can change.

**The circuit.**
```compact
export circuit hire(worker: Bytes<32>, rateCommitment: Bytes<32>): [] {
    assert(myKey() == employerKey, "employer only");
    agreedRate.insert(worker, rateCommitment);
}
```

The sealed envelope goes on the board. No money moves — a commitment commits to a *number*, not to funds. It costs a transaction fee and nothing else.

## 2. `acceptHire`

**The problem.** Here is a subtle one. The employer tells Karim "5,000" and seals a commitment. But the commitment is **unreadable** — so how does Karim know they sealed 5,000 and not 4,000?

Without this circuit, the employer could promise one number and seal another, and Karim would only discover it on payday when he cannot confirm.

**What we need.** Karim checks the seal opens to the number he was told, *before* he starts working.

**The circuit.**
```compact
export circuit acceptHire(rate: Uint<64>, salt: Bytes<32>): [] {
    const k = myKey();
    assert(persistentCommit(rate, salt) == agreedRate.lookup(k),
           "sealed rate is not what you were told");
    active.insert(k, true);
}
```

Karim's device recomputes `hash(5000 + salt)` and compares it to what is on the board. Match → he accepts. No match → **the transaction fails and he knows he is being lied to on day one.**

This is why the employer must send Karim both the rate **and** the salt. He needs both to do this check.

## 3. `approveHours`

**The problem.** Dana is paid 85 per hour. In March she worked 47 hours, so she is owed 3,995. But if Dana claims 60 hours and the employer says 40, who decides?

**What we need.** Both sides agreeing on the hours before payment is checked.

**The circuit.**
```compact
export circuit approveHours(worker: Bytes<32>, period: Uint<32>, hours: Uint<32>): [] {
    assert(myKey() == employerKey, "employer only");
    approvedHours.insert(periodKey(worker, period), hours);
}
```

**Hours go on the public board deliberately.** The employer already knows them, and hours alone reveal nothing about pay. Only the *rate* is sensitive. This is what "selective disclosure" means in practice: hide exactly what needs hiding and nothing more.

Salaried workers use `hours = 1`, so `1 × 5000 = 5000`. One circuit covers hourly, salaried, and fixed-price.

## 4. `confirmPayment` — the one that matters

**The problem.** The employer sends money. Was it the right amount? Today Karim looks at his bank app and… hopes. If they underpay by 200, he has no proof of what was agreed.

**What we need.** Karim proves the money that arrived equals hours × the sealed rate — **without any of those three numbers becoming public.**

**The circuit.**
```compact
export circuit confirmPayment(period: Uint<32>, hours: Uint<32>,
                              rate: Uint<64>, salt: Bytes<32>,
                              amountReceived: Uint<64>): [] {
    const k = myKey();
    // 1. this really is the rate we sealed at hiring
    assert(persistentCommit(rate, salt) == agreedRate.lookup(k), "not the agreed rate");
    // 2. these are the hours the employer approved
    assert(hours == approvedHours.lookup(periodKey(k, period)), "hours do not match");
    // 3. the money is exactly right
    assert(amountReceived == hours * rate, "incorrect payment");

    paidFor.insert(periodKey(k, period), true);   // ← the ONLY public output
}
```

Read the last line carefully. Three private numbers went in. **One boolean comes out.** The board gains:

```
karim · March 2026 · ✅
```

No amount. Anywhere. Ever.

**And now the demo.** The employer sends 4,000 instead of 5,000. Karim tries to confirm. Assertion 3 fails, because `4000 ≠ 1 × 5000`. The transaction is **rejected by the network**.

> Karim is *unable* to confirm a wrong payment, even if he wanted to.

March stays permanently blank on a public board that anyone can read, while the real salary stays unreadable to everyone on earth. **The system cannot record a wrong payment as correct.** Not "should not." *Cannot.*

## 5. `proveContribution`

**The problem.** In many countries the employer pays social security as a percentage of your *declared* salary. The classic fraud: pay you 5,000, declare 3,000, pocket the difference. You see a deduction on a payslip and have no way to check what was actually sent. You find out decades later when your pension is short.

**What we need.** Prove the declaration was calculated on the real salary — without revealing the salary.

**The circuit.**
```compact
export circuit proveContribution(period: Uint<32>, declared: Uint<64>,
                                 rate: Uint<64>, salt: Bytes<32>): [] {
    assert(persistentCommit(rate, salt) == agreedRate.lookup(myKey()), "not the agreed rate");
    assert(declared * 100 == rate * contributionRate, "under-declared");
    contributionOk.insert(periodKey(myKey(), period), true);
}
```

Why `declared * 100 == rate * pct` instead of `declared == rate * pct / 100`? **Because Compact has no division operator at all** — we found this out by compiling it, and it is written up in [SPIKE-ARITHMETIC.md](../packages/contract/SPIKE-ARITHMETIC.md). Multiplying both sides by 100 says the same thing without dividing.

The power here comes from *when* the commitment was made: at hiring, before anyone had a reason to lie.

## 6. `endEmployment`

**The problem.** People leave. But the record must not vanish — Karim's proof that he worked here for two years is valuable to him.

**The circuit.**
```compact
export circuit endEmployment(worker: Bytes<32>): [] {
    assert(myKey() == employerKey, "employer only");
    active.insert(worker, false);
}
```

Nothing is deleted. His last confirmed month becomes his leaving date, and the whole trail stays readable. **That trail is an employment certificate he owns** — written month by month, at the time, by both parties, and no ex-employer can withhold it.

---

# Part 5 — The whole contract in one picture

```
   PUBLIC BOARD (anyone on earth can read this)
   ┌──────────────────────────────────────────────────┐
   │  employerKey       0xe0e0…                        │
   │  agreedRate        karim → 0x9f3ac2…   ← sealed   │
   │  approvedHours     karim/March → 1                │
   │  paidFor           karim/March → ✅                │
   │  contributionOk    karim/March → ✅                │
   └──────────────────────────────────────────────────┘
              ▲                              ▲
              │ only booleans and            │ only sealed
              │ sealed values ever           │ envelopes
              │ get written up here          │
   ┌──────────┴──────────────────────────────┴────────┐
   │  THE CIRCUITS — run on the user's own machine     │
   │  They see the real numbers. They publish none.    │
   └──────────┬────────────────────────────────────────┘
              │ reads
   ┌──────────┴────────────────────────────────────────┐
   │  ON KARIM'S LAPTOP, never transmitted anywhere     │
   │  secret key · salary 5000 · salt 8471029…          │
   └───────────────────────────────────────────────────┘
```

**The three rules now make sense as one rule.** Everything sensitive lives in the bottom box. The circuits are the only thing that touches it, and all they publish upward are sealed envelopes and yes/no answers.

- *Never put a salary in a `Map`* → the top box is the town square
- *Never use `ownPublicKey()` to authenticate* → it lets anyone claim to be anyone
- *Never write `/`* → the operator does not exist

---

# Part 6 — What A actually does with all this

Now the job makes sense:

1. **Write the six circuits**, one at a time, compiling after each with `--skip-zk`.
2. **Test that the failures fail** — a wrong salt, a wrong rate, a wrong amount. The *rejections* are the product. Test them first.
3. **Compile for real once** (no `--skip-zk`) and commit `managed/`, so C, D and E can use the contract without installing anything.
4. **Be able to explain the above out loud.**

That fourth one is not decoration. When a judge asks *"why is the salary a commitment instead of a normal field?"*, the answer is:

> "Because a `Map` on this blockchain is a public notice board — writing the salary there publishes it to the world forever. A commitment is a sealed envelope: hiding, so nobody can read the salary, and binding, so neither side can pretend they agreed a different number. We can still prove a payment was correct against it, because the check happens inside a zero-knowledge circuit on the worker's own device. The network verifies the proof and never sees the number."

If you can say that in your own words, you can do this job.

---

*Practical checklist and setup: [01-contract.md](01-contract.md) · Arithmetic findings: [SPIKE-ARITHMETIC.md](../packages/contract/SPIKE-ARITHMETIC.md) · Full design: [NightShift build plan](../Ideas/NightShift_Private_Payroll_Midnight.md)*
