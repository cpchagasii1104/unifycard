// frontend/vite.config.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // @unificard/contracts compila só CommonJS (dist/index.js). Vite/ESM não infere named exports
  // a partir desse formato → "does not provide an export named 'isGender'". Resolver para a
  // fonte TS mantém SSOT (packages/contracts) sem redefinir tipos no frontend.
  resolve: {
    alias: {
      '@unificard/contracts': path.resolve(__dirname, '../packages/contracts/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@unificard/contracts'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
