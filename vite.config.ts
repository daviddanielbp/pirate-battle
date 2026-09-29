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
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Keep Vite's preload helper out of the lazy PixiJS chunk, otherwise the entry
            // imports it from there and the whole engine is preloaded on the menu.
            { name: 'preload-helper', test: /vite[\\/]preload-helper/ },
            { name: 'pixi', test: /node_modules[\\/]pixi\.js/ },
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|@tanstack|axios)[\\/]/ },
          ],
        },
      },
    },
  },
});
