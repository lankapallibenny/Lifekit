import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildContentSecurityPolicy, buildPrecacheManifest } from './scripts/precache-plugin';

// LIFEKIT build config.
// - `base: './'` keeps the build portable for static hosts (including GitHub Pages sub-paths).
// - A small first-party plugin writes dist/precache-manifest.json, which the service worker
//   (public/sw.js) reads to precache exactly the versioned assets of this build.
export default defineConfig({
  base: './',
  // Build-only CSP <meta> injection plus the first-party precache manifest writer.
  plugins: [react(), buildContentSecurityPolicy(), buildPrecacheManifest()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        // Keep the first paint lean: vendor chunk is cacheable independently of app code.
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  // Hosts that may reach the dev/preview server. Bound to 0.0.0.0 so a phone on the same
  // network (or a hosted preview proxy) can open the app, with Vite's host check restricted
  // to the proxy domains this project is previewed through rather than disabled entirely.
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: ['.e2b.app', '.arena.ai', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: ['.e2b.app', '.arena.ai', 'localhost', '127.0.0.1'],
  },
});
