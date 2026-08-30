# Circuit 1: `hire` — what every file is, and how the two languages connect

*Written for someone who does not code. If you have read
[tasks/01-contract-EXPLAINED.md](01-understanding-the-contract.md), you know
what a commitment and a circuit are. This document is about the **machinery**:
which file is which, why there are two programming languages, and what actually
happens when an employer clicks "Hire".*

---

# Part 1 — A tour of the files

Here is everything in `packages/contract/`, and who wrote it:

| File | What it is | Written by | Do you edit it? |
|---|---|---|---|
| **`src/payroll.compact`** | **The rules.** All six circuits | **A (us)** | **Yes — this is the work** |
| `src/witnesses.ts` | Hands the caller's secret to a circuit (Part 6) | us | Rarely |
| `smoke.mjs` | The whole lifecycle, run locally | us | When circuits change |
| `package.json` | The build and smoke commands | us | Rarely |
| `tsconfig.json` | TypeScript settings | us | No |
| `README.md` | How to build it | us | Sometimes |
| `src/managed/contract/index.js` | The contract, translated into JavaScript | **the compiler** | **Never** |
| `src/managed/contract/index.d.ts` | The instruction sheet for other programmers | **the compiler** | **Never** |
| `src/managed/contract/index.js.map` | A debugging aid | the compiler | Never |
| `src/managed/compiler/contract-info.json` | A summary of what was built | the compiler | Never |
| `src/managed/zkir/*.zkir` | **The maths.** One file per circuit — six of them | **the compiler** | **Never** |

Two things worth saying plainly:

**Everything under `src/managed/` is machine output.** You never open it to
change something. It is regenerated from scratch every time we compile. If it
ever looks wrong, delete the folder and rebuild — nothing is lost.

**Six human files, and everything else generated.** That ratio is normal, and it
is why the `.compact` file gets so much care. Every mistake in it is copied
faithfully into everything else.

*(Two documents that used to live in this folder have moved:
`SPIKE-ARITHMETIC.md` is now [A_docs/04](04-compact-arithmetic.md), and
`CIRCUIT-1-HIRE.md` is this document.)*

## What is in the generated files, really

They are not mysterious. Our own words are inside them.

Search the compiled JavaScript for our error messages and they are there:

```
only the employer may hire
this worker already has a sealed rate
```

Search for the domain separator we wrote — `pad(32, "nightshift:pk:")` — and you
find the bytes `110,105,103,104,116,115,104,105,102,116`, which spell
**`nightshift`**.

And `hire.zkir` — the maths — opens like this:

```json
{ "version": { "major": 2, "minor": 0 },
  "num_inputs": 4,
  "instructions": [
    { "op": "constrain_bits", "var": 0, "bits": 8 },
    ...
```

That is our contract expressed as a list of constraints — the "system of
equations" from the explainer, written out. **This file is what a proof is
actually checked against.**

---

# Part 2 — Why there are two languages

This is the question the whole document exists to answer.

## Each language can do something the other cannot

| | **Compact** | **TypeScript** |
|---|---|---|
| Can produce a zero-knowledge proof | **Yes** | No |
| Can run in a web browser | No | **Yes** |
| Can draw a button | No | **Yes** |
| Can read a file on your laptop | No | **Yes** |
| Can be enforced by the blockchain | **Yes** | No |

Compact is a specialist. It does one thing — turn rules into mathematics that a
blockchain can verify — and it cannot do anything else. It cannot show you a
screen, cannot read your saved password, cannot make a network request.

TypeScript is the generalist. It builds the app you look at. But nothing it says
is trustworthy to a blockchain, because TypeScript runs on your computer and
your computer can be told to lie.

**So each does the half it is good at, and the compiler builds the bridge.**

## An analogy

Think of a bank with a very secure vault.

- **The vault mechanism** is Compact. It only opens if the right conditions are
  met. It cannot talk, cannot see you, cannot take your coat.
- **The clerk at the counter** is TypeScript. They greet you, take your form,
  fetch your documents, and hand everything to the vault. They are helpful and
  they are not the security.
- **The compiler** builds the counter between them — the slot the clerk pushes
  documents through, shaped so only the right kind of document fits.

The clerk can be dishonest. It does not matter, because the vault checks the
documents itself and opens only if the mathematics says so.

---

# Part 3 — The bridge, line by line

When we run `compact compile`, the compiler reads our rules and writes an
**instruction sheet** for TypeScript programmers: `index.d.ts`.

Here is our file on the left and what the compiler produced on the right.

## Our public storage becomes a readable shape

**We wrote:**
```compact
export sealed ledger employerKey: Bytes<32>;
export ledger agreedRate: Map<Bytes<32>, Bytes<32>>;
```

**The compiler produced:**
```ts
export type Ledger = {
  readonly employerKey: Uint8Array;
  agreedRate: {
    member(key: Uint8Array): boolean;
    lookup(key: Uint8Array): Uint8Array;
    size(): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>;
  };
};
```

Three things happened automatically, and they are worth noticing:

1. **`Bytes<32>` became `Uint8Array`.** That is simply what "32 raw bytes" is
   called in TypeScript. Same thing, different name.
2. **`sealed` became `readonly`.** We wrote *"this can never be changed after
   deployment"* in one language, and the compiler enforced it in the other. A
   TypeScript programmer who tries to overwrite `employerKey` gets an error
   before their code ever runs. **We never asked for that — it came free.**
3. **The `Map` gained methods.** `member`, `lookup`, `size`, and a way to loop
   through everything. That last one is the auditor's view: E can walk the whole
   map and read every sealed value, which reveals nothing.

## Our circuit becomes a callable function

**We wrote:**
```compact
export circuit hire(worker: Bytes<32>, rateCommitment: Bytes<32>): [] {
```

**The compiler produced:**
```ts
hire(context: CircuitContext<PS>,
     worker_0: Uint8Array,
     rateCommitment_0: Uint8Array): CircuitResults<PS, []>;
```

Our two arguments survived, in order. The compiler added `context` at the front
— that is the bundle of "everything the circuit needs to run": the current state
of the blockchain, and a way to reach the witness.

---

# Part 4 — The witness: a deliberate hole

This is the most important connection between the two languages, and the one
that is easiest to miss.

**We wrote this, and it has no body:**

```compact
witness localSk(): Bytes<32>;
```

In most languages, a function with no body is an error — you forgot to write it.
Here it is **deliberate**. It means:

> *"There is a value called `localSk` that this contract needs. I am not going
> to say where it comes from. TypeScript will supply it when the time comes."*

It is a **hole in the contract, shaped like a 32-byte secret.**

**The compiler turned that hole into a requirement:**

```ts
export type Witnesses<PS> = {
  localSk(context: WitnessContext<Ledger, PS>): [PS, Uint8Array];
};

export declare class Contract<PS, W extends Witnesses<PS>> {
  constructor(witnesses: W);     // ← you cannot build the contract without them
}
```

Read that last line carefully. **You cannot create the contract at all without
handing it an implementation of `localSk`.** The compiler made the hole
impossible to forget.

## What `PS` means

`PS` stands for **private state** — the bag of secrets that lives on the user's
own device and never goes anywhere. For us it holds the secret key, and later
the salaries and salts.

The witness signature reads: *"given the current private state, return the
possibly-updated private state, and the secret."* It gets handed the bag, and
gives back the bag plus the one value asked for.

**The blockchain never sees `PS`.** It is not in the ledger type. It is not in
the proof. It exists only in memory on one laptop.

## And here is the trap you already spotted

TypeScript can return *anything* from `localSk`. It could return the employer's
key. Nothing stops it.

That is fine — because the circuit does not trust it:

```compact
assert(dappKey(localSk()) == employerKey, "only the employer may hire");
```

The circuit takes whatever TypeScript hands over, **hashes it**, and compares.
To pass, you would need a secret whose hash equals `employerKey`. Lying is
allowed. Lying successfully is not.

> **The clerk can hand the vault a forged document. The vault checks it anyway.**

---

# Part 5 — The whole hiring flow, start to finish

Now the pieces fit together. Here is everything that happens when an employer
hires Karim at 5,000 a month.

## Step 1 — A person clicks a button

In D's employer app, in the browser:

```
New employee
Worker's ID:      0x7f3a…
Monthly salary:   5000
[ Seal and send offer ]
```

## Step 2 — The app calls the API, and nothing else

```ts
const offer = await api.hire({
  workerKey: '0x7f3a…',
  ratePerPeriod: 5000n,
  expectedHours: 1,
});
```

That is the **entire** involvement of the app. It does not know what a
commitment is, has never heard of a salt, and cannot reach the blockchain. It
calls one method and waits.

## Step 3 — The API creates the salt and the commitment

Inside `packages/api` — the only package allowed to know about Midnight:

```ts
const salt = randomBytes(32);                          // fresh, random, secret
const commitment = persistentCommit(5000n, salt);      // the sealed envelope
```

**This is where the salary stops travelling.** From here on, only `commitment`
moves. The number `5000` and the salt go into two places and nowhere else:
this employer's private state, and (out of band) to Karim.

## Step 4 — The API calls the circuit

```ts
const contract = new Contract(witnesses);   // ← the hole must be filled here
await contract.impureCircuits.hire(context, workerKeyBytes, commitmentBytes);
```

Notice what is **not** passed: the salary, the salt. The circuit never receives
them. It receives a scrambled 32-byte value it cannot read.

## Step 5 — The circuit asks TypeScript for the secret

The circuit reaches `localSk()`. Execution jumps out of the mathematics and into
ordinary TypeScript, on this laptop:

```ts
const witnesses = {
  localSk: ({ privateState }) => [privateState, privateState.secretKey],
};
```

It reads the secret from the browser's local storage and hands it back. **This
value never leaves the machine.** It is used to compute, and then it is gone.

*(Today that storage is plain, not encrypted — see
[A_docs/05](05-keys-storage-and-identity.md). Encrypting it via
`level-private-state-provider` is the next step, and does not change anything
above: the secret still never crosses a network.)*

## Step 6 — The circuit checks the rules

Back inside the mathematics, on the employer's own computer:

```compact
assert(dappKey(localSk()) == employerKey, "only the employer may hire");
const w = disclose(worker);
assert(!agreedRate.member(w), "this worker already has a sealed rate");
agreedRate.insert(w, disclose(rateCommitment));
```

Line by line:
1. Hash the secret, compare to the employer's identity on the chain. Wrong
   person → **stop here**.
2. Take the worker's ID and mark it for publishing.
3. Already hired? **Stop here.**
4. Write the sealed rate into public storage.

## Step 7 — The proof server produces the receipt

The local proof server (Docker, port 6300) reads `hire.zkir` — those constraint
equations — and produces a proof: *"I ran `hire` and every check passed."*

This takes real seconds. It is why `onStatus` reports a `'proving'` stage.

**The proof does not contain the secret.** It cannot be worked backwards.

## Step 8 — The wallet signs and submits

The employer's wallet signs the transaction and sends it to the network. The
proof travels; the secret does not.

## Step 9 — The network verifies and records

Every node checks the proof against the same equations. **Not one of them ever
sees the secret, the salary, or the salt.** They see a proof, and it either
verifies or it does not.

The public ledger gains one line:

```
agreedRate:  0x7f3a… → 0x9f3ac2b7e81b4d…
```

A worker's ID, and 32 bytes of noise. Anyone can read it. Nobody can read *it*.

## Step 10 — The employer gets the offer back

```ts
// offer.commitment    → already public on the chain
// offer.ratePerPeriod → 5000n   PRIVATE — send to Karim directly
// offer.salt          → 0x84f…  PRIVATE — send to Karim directly
```

D's app shows the employer the rate and salt to pass to Karim — in a message, an
email, an offer letter. **Karim needs both to accept**, which is circuit 2.

## The whole journey on one page

```
  BROWSER                                            what moves
  ┌────────────────────────────────────────┐
  │ Employer types 5000                    │
  │      ↓                                 │
  │ api.hire({ ratePerPeriod: 5000n })     │   5000 ───┐
  │      ↓                                 │           │
  │ salt = random()                        │           │ never leaves
  │ commitment = commit(5000, salt)        │   salt ───┤ this box
  │      ↓                                 │           │
  │ contract.hire(worker, commitment)      │  secret ──┘
  │      ↓                                 │
  │ circuit asks → witnesses.ts → secret   │
  │      ↓                                 │
  │ proof server → PROOF                   │   proof ───┐
  │      ↓                                 │            │
  │ wallet signs                           │            │ this is all
  └────────────────────────────────────────┘            │ that travels
                     ↓                                  │
  ┌────────────────────────────────────────┐            │
  │ NETWORK: verifies the proof            │  ←─────────┘
  │ writes: 0x7f3a… → 0x9f3ac2…            │
  └────────────────────────────────────────┘
```

Everything sensitive stays in the top box. Only a proof crosses the line.

---

# Part 6 — The file that fills the hole: `witnesses.ts`

*(This section used to say "not written yet". It is written, it lives at
[`packages/contract/src/witnesses.ts`](../packages/contract/src/witnesses.ts),
and `smoke.mjs` runs the whole lifecycle through it.)*

It is small, and this is genuinely all of it:

```ts
export const witnesses = {
  localSk: ({ privateState }) => [privateState, privateState.secretKey],
};
```

Two things about that one line. It returns a **pair**: the private state
(possibly updated — ours never changes, so it is handed straight back) and the
value the circuit asked for. And it is storage-agnostic on purpose: it reads
whatever `privateState` it was handed, so the same file works whether the secret
came from browser storage today or a wallet-derived key later. B decides that in
`packages/api`; the contract does not care.

The real file adds one guard — a secret that is not exactly 32 bytes is rejected
at construction, because the alternative is a failure much deeper in the proof
system with a far worse error message.

---

# In one paragraph

The `.compact` file is the rules. The compiler turns it into two things: the
mathematics a proof is checked against, and an instruction sheet telling
TypeScript how to talk to it. TypeScript builds the app, fetches the secrets
from the user's own machine, and pushes them through the counter. The vault
checks them itself. The secrets never cross to the other side — only a proof
does, and a proof can be verified without being opened.

---

*Next: [circuit 2, `acceptHire`](../tasks/01-contract.md) — where Karim checks
that the sealed number really is the 5,000 he was promised.*
