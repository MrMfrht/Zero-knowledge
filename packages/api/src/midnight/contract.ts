/**
 * The one place `@nightshift/contract`'s generated output meets midnight-js.
 *
 * Everything here is module-level and built once — re-running
 * `CompiledContract.make` per call would reload the ZK keys on every circuit
 * call, which the midnight-js skill calls out as a real performance mistake.
 *
 * Reference: `.agents/skills/midnight-js/SKILL.md` §3–4, verified against the
 * actually-installed `@midnight-ntwrk/midnight-js-contracts@4.1.1` types
 * (`node_modules/@midnight-ntwrk/midnight-js-contracts/dist/*.d.ts`) rather
 * than trusted from memory — that package pulls in a newer, Effect-based
 * `CompiledContract` (from `@midnight-ntwrk/midnight-js-protocol/compact-js`)
 * than the skill's own pinned example, so every type below is imported from
 * the `midnight-js-protocol` subpaths, not the standalone `compact-js` or
 * `ledger-v8` packages, to guarantee the exact same type instances
 * `midnight-js-contracts` expects (two installed copies of `compact-js`,
 * 2.5.0 top-level vs 2.5.1 nested under `midnight-js-protocol`, would
 * otherwise be structurally incompatible even though the API is identical).
 */
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { Contract, ledger, pureCircuits } from '@nightshift/contract/src/managed/contract/index.js';
import type { Ledger } from '@nightshift/contract/src/managed/contract/index.js';
import { witnesses, createPayrollPrivateState } from '@nightshift/contract/src/witnesses.js';
import type { PayrollPrivateState } from '@nightshift/contract/src/witnesses.js';

export { ledger, pureCircuits, createPayrollPrivateState };
export type { Ledger, PayrollPrivateState };

/** Matches the `--skip-zk` build's contribution rate; see the compact:full note below. */
export const PAYROLL_PRIVATE_STATE_ID = 'payrollPrivateState' as const;
export type PayrollPrivateStateId = typeof PAYROLL_PRIVATE_STATE_ID;

/**
 * Where the ZK assets (`keys/`, `zkir/`) are served from at runtime.
 *
 * `packages/contract/src/managed/` is the `--skip-zk` build committed to the
 * repo — real bindings, but NO proving keys (see the contract README's
 * warning). A browser app must ship `packages/contract/src/managed/keys/`
 * and `.../zkir/` from a `compact:full` build under this path before any
 * circuit call here can actually produce a proof. Until then, everything up
 * to and including `deployContract`'s type-checking works; proving does not.
 */
export const ZK_CONFIG_PATH = '/zk/payroll';

/**
 * The compiled contract binding: our generated `Contract` class, wired to
 * `witnesses.ts`'s `localSk`, pointed at wherever the ZK assets are served.
 *
 * Built once at module load, per the skill's "don't call `.make` per deploy"
 * warning.
 */
export const compiledPayrollContract = CompiledContract.make('payroll', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
);

export type PayrollContract = typeof compiledPayrollContract extends CompiledContract.CompiledContract<
  infer C,
  unknown,
  unknown
>
  ? C
  : never;
