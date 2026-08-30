import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  resolve: {
    alias: {
      '@nightshift/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@nightshift/api': path.resolve(__dirname, '../api/src/index.ts'),
    },
  },
});
