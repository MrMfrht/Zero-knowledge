#!/usr/bin/env node
/**
 * Delete duplicate copies of Midnight's WebAssembly packages so the whole
 * workspace shares one instance of each.
 *
 * WHY THIS EXISTS
 *
 * These packages export WASM-backed classes, and the bindings check identity
 * with `instanceof`. Two copies on disk means two module instances, so an
 * object built by one is rejected by the other even though the versions are
 * compatible and the shapes identical. It surfaces as errors that read like
 * type bugs and are not:
 *
 *   Error: expected instance of StateValue      (onchain-runtime-v3)
 *   Error: expected instance of DustParameters  (ledger-v8)
 *
 * Both cost this team hours. The ledger-v8 case is fixable the normal way,
 * with an `overrides` entry in the root package.json. The onchain-runtime-v3
 * case is NOT: `@midnight-ntwrk/midnight-js-protocol` pins it to exactly
 * 3.0.0 while `@midnight-ntwrk/compact-runtime` resolves 3.1.0, and npm 11
 * declines to apply an override to it — plain and parent-scoped forms were
 * both tried on 2026-08-30, each with a deleted lockfile and a full
 * reinstall, and each left the nested 3.0.0 in place. The package is not
 * bundled, so that is npm's behaviour rather than a manifest restriction.
 *
 * Deleting the nested copy makes Node resolve up to the hoisted one. 3.1.0 is
 * the version `packages/contract`'s generated bindings were compiled against,
 * so it is the correct survivor.
 *
 * Runs as `postinstall`, because npm recreates the nested copy on every
 * install. Safe to run at any time; it only removes paths that exist.
 *
 * If a future SDK release aligns these versions, delete this script and its
 * postinstall hook — check by removing it, reinstalling, and confirming
 * `find node_modules -type d -name onchain-runtime-v3` prints one line.
 */
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Packages this script forces to one instance, by name.
 *
 * Exported because `check-dependency-tree.mjs` would otherwise report the
 * survivor as a version conflict — which it literally is, and deliberately
 * so. Those two scripts have to agree on this list or one of them is wrong.
 */
export const DEDUPED_PACKAGES = ['@midnight-ntwrk/onchain-runtime-v3'];

/** Nested copies to remove. Each shadows a correct hoisted copy. */
const duplicates = [
  'node_modules/@midnight-ntwrk/midnight-js-protocol/node_modules/@midnight-ntwrk/onchain-runtime-v3',
];

export function removeDuplicateWasmPackages() {
  let removed = 0;
  for (const relative of duplicates) {
    const path = new URL(relative, `file://${repoRoot.replace(/\\/g, '/')}`);
    const target = fileURLToPath(path);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
      console.log(`dedupe-wasm: removed duplicate ${relative}`);
      removed += 1;
    }
  }
  if (removed === 0) {
    console.log('dedupe-wasm: no duplicate WASM packages found');
  }
}

// Only when run as a script. `check-dependency-tree.mjs` imports
// DEDUPED_PACKAGES from here, and an import must not delete anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  removeDuplicateWasmPackages();
}
