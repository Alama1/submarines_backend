import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ff14/types': fileURLToPath(
        new URL('../../packages/shared-types/src/index.ts', import.meta.url)
      ),
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages[/\\]shared-types/],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
