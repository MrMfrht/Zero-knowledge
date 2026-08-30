/**
 * Serve the compiled ZK proving artifacts to the browser.
 *
 * WHY THIS EXISTS
 *
 * `FetchZkConfigProvider` fetches proving keys from the *app's own origin* --
 * not from the wallet, not from the indexer. `packages/api`'s ZK_CONFIG_PATH
 * says that origin-relative base is `/zk/payroll`, and the provider then asks
 * for `keys/<circuit>.prover`, `keys/<circuit>.verifier` and
 * `zkir/<circuit>.bzkir` beneath it.
 *
 * Neither app had a `public/` directory, so every one of those requests hit
 * Vite's SPA fallback and came back as index.html. The provider has a
 * dedicated error for exactly that -- "Expected ZK artifact, but received
 * text/html ... This usually means the file does not exist" -- which is the
 * wall every write path would have hit the moment a wallet was connected.
 *
 * Copying 23 MB of prover keys into two `public/` folders would work and would
 * go stale the first time anyone recompiles the contract. Serving them from
 * `packages/contract/src/managed/` directly cannot go stale.
 */
import { createReadStream, existsSync, statSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANAGED_DIR = resolve(
  fileURLToPath(new URL('..', import.meta.url)),
  'packages/contract/src/managed',
);

/** Mirrors ZK_CONFIG_PATH in packages/api/src/midnight/contract.ts. */
const URL_PREFIX = '/zk/payroll/';

/** The only subdirectories the provider ever asks for. */
const SERVED_SUBDIRS = ['keys', 'zkir'];

export function zkAssets() {
  return {
    name: 'nightshift-zk-assets',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (!path.startsWith(URL_PREFIX)) return next();

        const relative = decodeURIComponent(path.slice(URL_PREFIX.length));
        const file = resolve(MANAGED_DIR, relative);

        // The circuit id reaches this path from the caller, so refuse anything
        // that resolves outside the managed directory rather than trusting it.
        if (!file.startsWith(MANAGED_DIR + sep) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end(`No ZK artifact at ${path}`);
          return;
        }

        // Anything but text/html: the provider rejects text/html outright,
        // because that is how an SPA fallback disguises a missing file.
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', statSync(file).size);
        createReadStream(file).pipe(res);
      });
    },

    // A production build has no middleware, so the same files are copied in
    // beside the bundle under the identical path.
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      for (const subdir of SERVED_SUBDIRS) {
        const from = join(MANAGED_DIR, subdir);
        if (!existsSync(from)) continue;
        const to = join(outDir, 'zk', 'payroll', subdir);
        mkdirSync(to, { recursive: true });
        for (const entry of readdirSync(from)) {
          copyFileSync(join(from, entry), join(to, entry));
        }
      }
    },
  };
}
