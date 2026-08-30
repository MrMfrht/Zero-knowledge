import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3003,
    open: false,
  },
  resolve: {
    alias: {
      '@nightshift/shared/globals.css': path.resolve(__dirname, '../shared/src/globals.css'),
      '@nightshift/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@nightshift/api': path.resolve(__dirname, '../api/src/index.ts'),
    },
  },
});
