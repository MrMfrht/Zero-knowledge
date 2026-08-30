# `@nightshift/contract`

The Compact smart contract. Owner: **A**.

## Build

```bash
npm run compact -w @nightshift/contract        # fast: --skip-zk, seconds
npm run compact:full -w @nightshift/contract   # slow: real proving keys, minutes
```

Use `--skip-zk` (the `compact` script) for every compile while writing. It checks
correctness only. Drop it — run `compact:full` — when B needs real proving keys.

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
| `proveContribution` | not yet | Proves social security used the real salary |
| `endEmployment` | not yet | Marks a worker inactive |

## Read first

All the deep explanation now lives in **[A_docs/](../../A_docs/README.md)** — this README is just how to build.


- **[CIRCUIT-1-HIRE.md](../../A_docs/02-files-and-the-typescript-bridge.md) — what every file in this folder is, how Compact and TypeScript connect, and the whole hiring flow step by step. Start here if the folder looks confusing.**
- [tasks/01-contract-EXPLAINED.md](../../A_docs/01-understanding-the-contract.md) — why any of this works
- [SPIKE-ARITHMETIC.md](../../A_docs/04-compact-arithmetic.md) — Compact has no division operator
