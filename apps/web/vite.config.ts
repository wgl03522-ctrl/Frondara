import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the built index.html loads correctly from file://
  // inside the Electron shell. Harmless for the dev server.
  base: './',
  server: {
    port: 4318,
    proxy: {
      '/api': 'http://127.0.0.1:4317'
    }
  }
});
