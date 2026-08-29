import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3001,
    open: true,
  },
  resolve: {
    alias: {
      '@nightshift/api': path.resolve(__dirname, '../api/src/index.ts'),
      '@nightshift/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
