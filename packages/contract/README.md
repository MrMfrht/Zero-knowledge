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
| `hire` | ✅ compiles | Employer seals a worker's agreed rate |
| `acceptHire` | not yet | Worker verifies the seal matches what they were told |
| `approveHours` | not yet | Employer approves a timesheet |
| `confirmPayment` | not yet | Worker proves the payment matched the sealed rate |
| `proveContribution` | not yet | Proves social security used the real salary |
| `endEmployment` | not yet | Marks a worker inactive |

## Read first

- [tasks/01-contract-EXPLAINED.md](../../tasks/01-contract-EXPLAINED.md) — why any of this works
- [SPIKE-ARITHMETIC.md](SPIKE-ARITHMETIC.md) — Compact has no division operator
