import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Tests run against the same module graph the app does.
 *
 * Merging `vite.config.ts` rather than redeclaring is not tidiness — it is
 * the fix for a real failure. That file aliases `@nightshift/api` to the
 * package's TypeScript source; without the alias, Vite resolves the workspace
 * link to `packages/api/dist`, whose compiled output imports
 * `@nightshift/contract/src/witnesses.js` — a path that does not exist on
 * disk, because `packages/contract` ships TypeScript and is consumed from
 * source everywhere else. The suite failed to collect at all.
 *
 * Two aliases in two files that must agree is exactly the kind of drift that
 * produces "works in the app, fails in tests", so there is only one copy.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [],
    },
  }),
);
