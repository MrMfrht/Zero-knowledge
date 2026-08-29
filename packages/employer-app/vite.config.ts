import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@nightshift/api': path.resolve(__dirname, '../api/src'),
      '@nightshift/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
