import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// The Midnight SDK ships WebAssembly, which Vite cannot bundle on its own --
// without this the build dies on "ESM integration proposal for Wasm is not
// supported currently". The SDK also uses top-level await; that needs no plugin
// because the esnext target below supports it natively.
import wasm from 'vite-plugin-wasm';
import path from 'path';
// Serves the contract's compiled proving keys at /zk/payroll -- without it every
// ZK artifact request falls through to the SPA fallback and returns index.html.
import { zkAssets } from '../../scripts/vite-plugin-zk-assets.mjs';

export default defineConfig({
  plugins: [tailwindcss(), react(), wasm(), zkAssets()],
  // esnext keeps the top-level await the SDK relies on, rather than trying to
  // downlevel it into something that cannot express it.
  build: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  server: {
    port: 3001,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@nightshift/shared/globals.css': path.resolve(__dirname, '../shared/src/globals.css'),
      '@nightshift/api': path.resolve(__dirname, '../api/src'),
      '@nightshift/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
