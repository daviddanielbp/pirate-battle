import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'pixi', test: /node_modules[\\/]pixi\.js/ },
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|@tanstack|axios)[\\/]/ },
          ],
        },
      },
    },
  },
});
