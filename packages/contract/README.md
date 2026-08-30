# `@nightshift/contract`

The Compact smart contract. Owner: **A**.

## Build

```bash
npm run compact -w @nightshift/contract        # fast: --skip-zk, seconds
npm run compact:full -w @nightshift/contract   # slow: real proving keys, minutes
```

Use `--skip-zk` (the `compact` script) for every compile while writing. It checks
correctness only. Drop it — run `compact:full` — when B needs real proving keys.

## `witnesses.ts` — the TypeScript half, now written

`src/witnesses.ts` supplies `localSk` — the secret the circuits ask for. It is
the file the generated `Contract` class refuses to be constructed without.
Typechecked against `@midnight-ntwrk/compact-runtime` 0.16.0.

Proven working by a local smoke run:

```bash
npm run smoke -w @nightshift/contract
```

```
hire ✅ · stranger rejected ❌ · wrong-rate accept rejected ❌ · acceptHire ✅
approveHours ✅ · re-approving the same period rejected ❌
UNDERPAYMENT of 4000 rejected ❌ ← THE DEMO · confirm ✅
double-confirm rejected ❌ · under-declared contribution rejected ❌
proveContribution ✅ · second period approved + confirmed ✅
endEmployment ✅ · post-end approvals rejected ❌ · double-end rejected ❌

final public ledger: paidFor 2 ✓, contributionOk 1 ✓, active(karim) false
anywhere to read a salary or amount: NO — the ledger type has no such field
```

Every ❌ is a rejection we want, each failing with our exact assert message.
The underpayment line is the demo, running locally for real.

Two of those lines exist because of the privacy audit on 2026-08-30.
*Re-approving the same period* must fail, or an employer could rewrite the hours
`confirmPayment` anchors to and get an underpayment recorded as correct
([question 13](../../A_docs/06-open-design-questions.md)). And running a
**second period** end to end is what proves `periodKey` actually distinguishes
periods — with only period 1 tested, a broken `Uint<32> → Bytes<32>` cast would
have gone unnoticed.

B: construct with `new Contract(witnesses)` and build private state with
`createPayrollPrivateState(secretKey)` — see the comments in the file.

## `src/managed/` is generated, and it is committed on purpose

That folder is compiler output. **Never edit it.** It is committed so C, D and E
can use the contract without installing the Compact toolchain.

> ✅ **The committed build is a full build, keys included.** `managed/keys/` holds
> a `.prover` and a `.verifier` for each of the six circuits, so real proofs can
> be generated — B is no longer blocked on this. Regenerated 2026-08-30 from the
> current source, after PR #5 merged (its keys predated the `approveHours` and
> `dappKey` fixes and were stale for all six circuits).

> ⚠️ **Every source change invalidates these keys.** A proving key is tied to the
> exact circuit it was built from. If you touch `payroll.compact` — even one
> assertion — re-run `npm run compact:full` and commit the result, or proofs made
> against the old keys will fail to verify. Note that anything touching `dappKey`
> restales **all six**, since every circuit calls it.

## Circuits

| Circuit | Status | What it does |
|---|---|---|
| `hire` | ✅ compiles | Employer seals a worker's agreed rate — **[documented](../../A_docs/02-files-and-the-typescript-bridge.md)** |
| `acceptHire` | ✅ compiles | Worker verifies the seal matches what they were told |
| `approveHours` | ✅ compiles | Employer approves a timesheet — **write-once**, so the anchor cannot be rewritten later |
| `confirmPayment` | ✅ compiles | **The one the product exists for.** Worker proves the payment matched the sealed rate |
| `proveContribution` | ✅ compiles | Proves the social-security declaration used the REAL earnings — cross-multiplied, since Compact has no division |
| `endEmployment` | ✅ compiles | Marks a worker inactive; history stays forever |

**All six circuits compile. The full lifecycle is exercised by the smoke run.**

Two pure helpers are also exported, because the api needs them and must match
the contract byte-for-byte:

| Helper | Use |
|---|---|
| `pureCircuits.dappKey(sk, deploymentId)` | Show a user their own key (C's "Your worker key" screen) |
| `pureCircuits.sealRate(rate, salt)` | Compute the commitment in `hire` exactly as `acceptHire` will check it |

The constructor takes **two** arguments:

| Argument | Value |
|---|---|
| `contributionPct` | The social-security percentage, e.g. `25n`. Public and sealed for the contract's life |
| `deployment` | **32 fresh random bytes, generated per deployment.** Stored as the public sealed field `deploymentId` |

`deployment` is what stops one worker presenting the same public key to every
employer running NightShift. Reusing a value across deployments — or hardcoding
one — silently restores that leak, so generate it with
`crypto.getRandomValues(new Uint8Array(32))` at deploy time and never copy it.

## Read first

All the deep explanation now lives in **[A_docs/](../../A_docs/README.md)** — this README is just how to build.


- **[A_docs/02 — files and the TypeScript bridge](../../A_docs/02-files-and-the-typescript-bridge.md): what every file in this folder is, how Compact and TypeScript connect, and the whole hiring flow step by step. Start here if the folder looks confusing.**
- [A_docs/01 — understanding the contract](../../A_docs/01-understanding-the-contract.md) — why any of this works
- [A_docs/04 — Compact arithmetic](../../A_docs/04-compact-arithmetic.md) — Compact has no division operator
- [A_docs/06 — open design questions](../../A_docs/06-open-design-questions.md) — the live risk register; read before the demo
