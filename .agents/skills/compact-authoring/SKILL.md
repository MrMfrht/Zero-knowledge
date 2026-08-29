---
name: compact-authoring
description: Write, read, or review Compact smart contracts for the Midnight Network without hallucinating syntax. Use whenever a .compact file, a circuit, a witness, a ledger declaration, disclose(), persistentCommit, or the Compact compiler is involved — including when merely quoting Compact in a document. Covers the known syntax traps, the ledger data types, and the verify-before-you-claim loop.
---

# Writing Compact

**The governing rule: never state a Compact fact from training data.** Compact is barely represented in it. An unprepared model produces syntax that reads perfectly and does not compile, which is worse than producing nothing. Every fact below is sourced; anything not below needs checking before it is asserted.

## The verification loop

In order of preference:

1. **`/midnight-verify:verify "<claim>"`** — if the [Midnight Expert](https://docs.midnight.network/ai-integration/midnight-expert) plugins are installed. It compiles and runs a test contract and returns Confirmed / Refuted / Inconclusive **with evidence**.
2. **`compact compile`** — the real compiler. Compiling is the only proof that matters.
3. **Fetch the docs as markdown** — append `.md` to any `docs.midnight.network` URL. Index: [`llms.txt`](https://docs.midnight.network/llms.txt).
4. **Ask Kapa** via the MCP server, for conceptual questions.

If none of these is available, **say the snippet is unverified** rather than implying it compiles. Uncompiled Compact in a document must be labelled as a sketch.

## The traps

Documented at [Midnight agent skills](https://docs.midnight.network/sdks/community/ai-tools/midnight-agent-skills). These are the ones that cost an afternoon:

```compact
// WRONG                                 // CORRECT
counter.value()                          counter.read()
if (s == State::open)                    if (s == State.open)      // dot, not ::
witness getKey(): Bytes<32> { ... }       witness getKey(): Bytes<32>;   // no body, ever
```

Three mental-model corrections for anyone arriving from Solidity:

- **Circuits declare constraints; they do not execute.** `assert` is a constraint declaration, not a runtime guard.
- **`disclose()` is a compile-time annotation, not encryption.** It switches off a check.
- **Block limits are hard limits, not gas costs.** `BlockLimitExceeded` means the transaction cannot run at all, not that it costs more.

## Anatomy

```compact
pragma language_version 0.23;
import CompactStandardLibrary;

export enum State { OPEN, CLOSED }

export sealed ledger owner: Bytes<32>;      // constructor-only, compiler-enforced
export ledger entries: Map<Bytes<32>, Bytes<32>>;
export ledger count: Counter;
export ledger state: State;

witness localSk(): Bytes<32>;               // declaration only; implemented in TypeScript

constructor(deadline: Uint<64>) { ... }     // may write sealed fields

export circuit doThing(arg: Uint<32>): [] { // exported: callable, its return is public
    assert(state == State.OPEN, "closed");
    ...
}

circuit helper(x: Bytes<32>): Bytes<32> { ... }   // internal, not callable from outside
```

The witness implementation lives in TypeScript and is **not** cryptographically verified:

```typescript
export const witnesses = {
  localSk: ({ privateState }: WitnessContext<Ledger, PrivateState>) =>
    [privateState, privateState.secretKey],
};
```

Because each user supplies their own, **contract logic must never trust a witness value without validating it.**

## Ledger data types

From [Ledger data types](https://docs.midnight.network/compact/data-types/ledger-adt):

| Type | Key operations | Privacy note |
|---|---|---|
| `Cell<T>` | `read`, `write`, `resetToDefault` | Public |
| `Counter` | `read`, `increment`, `decrement`, `lessThan` | Public — including the amount |
| `Set<T>` | `insert`, `member`, `remove`, `size`, `isEmpty` | **Members are public** |
| `Map<K,V>` | `insert`, `lookup`, `member`, `remove`, `size` | **Keys and values are public** |
| `List<T>` | `pushFront`, `popFront`, `head`, `length` | Public |
| `MerkleTree<n,T>` | `insert`, `insertHash`, `root`, `checkRoot`, `pathForLeaf`, `firstFree` | **The inserted leaf is hidden** — the only ledger op that hides its argument |
| `HistoricMerkleTree<n,T>` | as above, plus `resetHistory` | Same, and old roots stay valid |

Design note: prefer flat maps over maps of structs. Reading a struct pulls every field into the circuit, which costs constraints you did not ask for.

## Standard library, the parts that matter here

**Hashes and commitments** ([reference](https://docs.midnight.network/compact/smart-contract-security)):

| Function | Persistent across upgrades | Hides a guessable value |
|---|---|---|
| `transientHash<T>(v)` | No | No |
| `transientCommit<T>(v, rand)` | No | Yes |
| `persistentHash<T>(v)` | Yes | No |
| `persistentCommit<T>(v, rand)` | Yes | Yes |

Use `persistent*` for anything stored on the ledger. `persistentCommit` output needs no `disclose()`; `persistentHash` output does.

**Block time** — four predicates, all taking Unix seconds, all returning `Boolean`. There is no raw accessor.

`blockTimeLt(t)` · `blockTimeLte(t)` · `blockTimeGt(t)` · `blockTimeGte(t)`

Never use block time as randomness.

**Identity** — `ownPublicKey()` exists but is a witness. Use it only to route tokens to the caller, never to authenticate. Derive identity instead:

```compact
persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:pk:"), _sk])
```

## disclose(), correctly

The compiler runs an abstract interpreter that tracks witness data through arithmetic, struct fields, function calls, and comparisons. It refuses to compile if that data reaches the ledger, an exported circuit's return, or another contract without a wrapper. The error names the witness, the nature of the disclosure, and the full path — read it, it is unusually good.

```compact
// GOOD — disclosed at the point of use, narrowly
result = disclose(flag) ? disclose(derived) : 0;

// BAD — disclosed early; every later path inherits permission to leak
const secret = disclose(getSecret());
```

For a struct or tuple, wrap **only** the fields that are meant to be disclosed, not the whole value.

## Testing

vitest, driving the compiled contract through `@midnight-ntwrk/compact-runtime`. The seventh argument of `createCircuitContext` is block time, which is how deadline tests exercise both sides of a gate.

```typescript
const ctx = RT.createCircuitContext(ADDR, COIN, ctorState, {}, undefined, undefined, time);
expect(() => contract.impureCircuits.claim(ctx)).toThrow('expired');
```

Full worked example in [Security and best practices](https://docs.midnight.network/guides/security-best-practices).

## Versions

Pin these; do not float. From the [compatibility matrix](https://docs.midnight.network/relnotes/support-matrix), 29 August 2026:

`compact` devtools `0.5.1` · compiler `0.31.1` · runtime `0.16.0` · Compact JS `2.5.1` · Midnight.js & testkit `4.1.1` · wallet SDK `1.2.0` (**exact** — npm `latest` still resolves to `1.1.0`) · DApp Connector `4.0.1` · proof server `8.1.0`

Language pragma in current examples: `0.23`.

## Reference contracts worth copying from

- [Private Reserve Auction](https://docs.midnight.network/examples/contracts/private-reserve-auction) — commitments, derived keys, `Map`
- [ZK Loan](https://docs.midnight.network/tutorials/zk-loan/smart-contract) — in-circuit signature verification, private predicates
- [Bulletin board](https://docs.midnight.network/tutorials/bboard/smart-contract) — the simplest complete contract
- [Battleship](https://docs.midnight.network/tutorials/bship/smart-contract) — hidden state proven consistent
- [Private guest list](https://docs.midnight.network/examples/contracts/private-guest-list) — commitment membership

## Language reference

[Writing a contract](https://docs.midnight.network/compact/reference/writing) · [Compact reference](https://docs.midnight.network/compact/reference/compact-reference) · [Grammar](https://docs.midnight.network/compact/reference/compact-grammar) · [Keywords](https://docs.midnight.network/compact/reference/compact-keywords) · [Standard library](https://docs.midnight.network/compact/standard-library) · [Explicit disclosure](https://docs.midnight.network/compact/reference/explicit-disclosure) · [Compiler errors](https://docs.midnight.network/troubleshoot/compiler-errors)
