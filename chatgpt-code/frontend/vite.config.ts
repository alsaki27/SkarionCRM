import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the React frontend.  This config uses the
// React plugin and sets up module resolution for TypeScript.  During
// development the API server is assumed to run on localhost:4000; the
// frontend will call tRPC via relative URLs.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});