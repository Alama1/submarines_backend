import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
