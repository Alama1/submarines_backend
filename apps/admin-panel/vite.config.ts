import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use the shared-types TS source directly so both the dev server and
      // Rollup get real ESM named exports (the package dist is CommonJS,
      // which Vite's dev server cannot serve with named imports)
      '@ff14/types': fileURLToPath(
        new URL('../../packages/shared-types/src/index.ts', import.meta.url)
      ),
    },
  },
  build: {
    commonjsOptions: {
      // Also transform linked workspace packages (resolved outside node_modules),
      // e.g. @ff14/types which exports runtime values from its CJS dist
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
