#!/usr/bin/env node
/**
 * Fail loudly when an installed package declares a dependency that is not
 * actually resolvable from where it sits.
 *
 * WHY THIS EXISTS
 *
 * On 2026-08-30 this workspace had eleven packages missing from
 * node_modules — `nwsapi`, `parse5`, `node-releases`, `on-finished`,
 * `parseurl`, `path-to-regexp`, `parse-json`, `path-type`, `object-assign`,
 * `parent-module`, `@lukeed/csprng` — every one of them a declared
 * dependency of something that was installed. npm did not warn. It left them
 * out of package-lock.json too, and kept leaving them out through a cache
 * verify, a `--prefer-online` re-resolve, and three full lockfile
 * regenerations. The same package.json in an empty directory resolved them
 * correctly, so it is specific to this tree, and it was not diagnosed
 * further under deadline. npm 11.6.4, Node 25.2.1, Windows.
 *
 * What it cost was the point. Each one surfaced as a different unrelated
 * failure, hours apart:
 *
 *   Cannot find module 'nwsapi'                  -> every auditor test
 *   Cannot find module 'node-releases/...'       -> every Vite dev server, 500
 *   Cannot find module 'ora'                     -> the backend build
 *
 * None of them named the real problem, and `npm install` reported success
 * throughout. The missing packages are now declared explicitly in the root
 * package.json, which is a workaround and not a fix — this script is what
 * turns the next occurrence into one clear message instead of another day.
 *
 * Pinning matters as much as presence. `npm install --save-dev <name>` takes
 * the LATEST major, and four of these had dependents on older ones —
 * `cosmiconfig` wants `parse-json@^5` where latest is 8 and ESM-only,
 * `jsdom@24` wants `parse5@^7` where latest is 8. Installing those would
 * have replaced "module not found" with a subtler runtime break, so this
 * checks satisfaction, not just existence.
 *
 * Run by `postinstall`. If it ever prints nothing for several weeks and the
 * root package.json's odd entries can be removed without it complaining,
 * delete them — the check is cheap enough to keep either way.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { satisfies, validRange } from 'semver';
import { DEDUPED_PACKAGES } from './dedupe-wasm.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

/** Node's own algorithm: walk up node_modules until the package appears. */
function resolveFrom(startDir, name) {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Packages this repo deliberately forces to a single version.
 *
 * Two sources, both meaning "I know this contradicts what some dependent
 * declared, and I want it anyway": the root `overrides` block, and the list
 * `dedupe-wasm.mjs` pins by deleting nested copies outright (npm declined to
 * override that one at all). For the Midnight WASM packages a single
 * instance is the whole point — two copies of one WASM module make
 * `instanceof` fail across them. Reporting these as version conflicts would
 * make this check cry wolf on the one thing it must not.
 */
const deliberateOverrides = new Set([
  ...Object.keys(readJson(join(ROOT, 'package.json'))?.overrides ?? {}),
  ...DEDUPED_PACKAGES,
]);

const missing = [];
const unsatisfied = [];

function scan(nodeModulesDir) {
  for (const entry of readdirSync(nodeModulesDir)) {
    if (entry.startsWith('.')) continue;
    const full = join(nodeModulesDir, entry);
    if (entry.startsWith('@')) {
      scan(full); // scoped: one level deeper
      continue;
    }
    const manifest = readJson(join(full, 'package.json'));
    if (!manifest) continue;

    for (const [dep, range] of Object.entries(manifest.dependencies ?? {})) {
      const found = resolveFrom(full, dep);
      if (!found) {
        missing.push({ dep, range, by: `${manifest.name}@${manifest.version}` });
        continue;
      }
      if (deliberateOverrides.has(dep)) continue;
      const installed = readJson(found)?.version;
      // Skip ranges semver cannot judge (git urls, file:, workspace:).
      if (installed && validRange(range) && !satisfies(installed, range)) {
        unsatisfied.push({ dep, range, installed, by: `${manifest.name}@${manifest.version}` });
      }
    }

    const nested = join(full, 'node_modules');
    if (existsSync(nested)) scan(nested);
  }
}

const rootModules = join(ROOT, 'node_modules');
if (!existsSync(rootModules)) {
  console.log('check-dependency-tree: no node_modules yet, nothing to check');
  process.exit(0);
}

scan(rootModules);

if (missing.length === 0 && unsatisfied.length === 0) {
  console.log('check-dependency-tree: every declared dependency resolves');
  process.exit(0);
}

for (const { dep, range, by } of missing) {
  console.error(`  MISSING      ${dep}@${range}  required by ${by}`);
}
for (const { dep, range, installed, by } of unsatisfied) {
  console.error(`  WRONG VERSION ${dep}@${installed} does not satisfy ${range}  required by ${by}`);
}
console.error(
  `\ncheck-dependency-tree: ${missing.length} missing, ${unsatisfied.length} unsatisfied.\n` +
    'npm reported a successful install anyway — see the comment at the top of this file.\n' +
    'Fix by adding the package to the ROOT package.json devDependencies at the range the\n' +
    'dependent asks for (not `latest`), then reinstalling.',
);
process.exit(1);
