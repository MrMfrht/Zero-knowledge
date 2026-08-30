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
approveHours ✅ · UNDERPAYMENT of 4000 rejected ❌ ← THE DEMO · confirm ✅
double-confirm rejected ❌ · under-declared contribution rejected ❌
proveContribution ✅ · endEmployment ✅ · post-end approvals rejected ❌

final public ledger: paidFor 1 ✓, contributionOk 1 ✓, active(karim) false
anywhere to read a salary or amount: NO — the ledger type has no such field
```

Every ❌ is a rejection we want, each failing with our exact assert message.
The underpayment line is the demo, running locally for real.

B: construct with `new Contract(witnesses)` and build private state with
`createPayrollPrivateState(secretKey)` — see the comments in the file.

## `src/managed/` is generated, and it is committed on purpose

That folder is compiler output. **Never edit it.** It is committed so C, D and E
can use the contract without installing the Compact toolchain.

> ⚠️ **The committed build is currently `--skip-zk`.** It contains the TypeScript
> bindings and the ledger shape, which is enough for B to wire the API against.
> It does **not** contain proving keys, so it cannot generate a real transaction
> yet. A full build lands before integration.

## Circuits

| Circuit | Status | What it does |
|---|---|---|
| `hire` | ✅ compiles | Employer seals a worker's agreed rate — **[documented](../../A_docs/02-files-and-the-typescript-bridge.md)** |
| `acceptHire` | ✅ compiles | Worker verifies the seal matches what they were told |
| `approveHours` | ✅ compiles | Employer approves a timesheet |
| `confirmPayment` | ✅ compiles | **The one the product exists for.** Worker proves the payment matched the sealed rate |
| `proveContribution` | ✅ compiles | Proves the social-security declaration used the REAL earnings — cross-multiplied, since Compact has no division |
| `endEmployment` | ✅ compiles | Marks a worker inactive; history stays forever |

**All six circuits compile. The full lifecycle is exercised by the smoke run.**

Two pure helpers are also exported, because the api needs them and must match
the contract byte-for-byte:

| Helper | Use |
|---|---|
| `pureCircuits.dappKey(sk)` | Show a user their own key (C's "Your worker key" screen) |
| `pureCircuits.sealRate(rate, salt)` | Compute the commitment in `hire` exactly as `acceptHire` will check it |

The constructor now takes one argument: `contributionPct` (e.g. `25n`) — the
social-security percentage, sealed for the contract's life.

## Read first

All the deep explanation now lives in **[A_docs/](../../A_docs/README.md)** — this README is just how to build.


- **[CIRCUIT-1-HIRE.md](../../A_docs/02-files-and-the-typescript-bridge.md) — what every file in this folder is, how Compact and TypeScript connect, and the whole hiring flow step by step. Start here if the folder looks confusing.**
- [tasks/01-contract-EXPLAINED.md](../../A_docs/01-understanding-the-contract.md) — why any of this works
- [SPIKE-ARITHMETIC.md](../../A_docs/04-compact-arithmetic.md) — Compact has no division operator
