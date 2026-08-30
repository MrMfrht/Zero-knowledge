import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
