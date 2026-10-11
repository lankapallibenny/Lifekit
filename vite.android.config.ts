import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildContentSecurityPolicy } from './scripts/precache-plugin';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Drops the service worker from the Android build.
 *
 * public/ is copied into every build, so sw.js and the precache manifest would otherwise ride
 * along inside the APK. The shell never registers them (everything is already local, and a second
 * cache next to the APK's own asset copy would only be one more thing to keep in step), so shipping
 * them would be dead weight and a misleading answer to "does this app use a service worker?".
 */
function dropServiceWorker(): Plugin {
  return {
    name: 'lifekit:android-drop-service-worker',
    apply: 'build',
    closeBundle() {
      const out = join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'www');
      for (const file of ['sw.js', 'precache-manifest.json']) {
        rmSync(join(out, file), { force: true });
      }
    },
  };
}

/**
 * Build config for the Android app (see android/README.md).
 *
 * It is deliberately separate from vite.config.ts so the web build stays byte-for-byte what it
 * was, and the two cannot overwrite each other:
 *
 *  - output goes straight into the APK's assets folder (android/app/src/main/assets/www),
 *    never into dist/;
 *  - assets are referenced with relative paths, which is what the shell's asset loader expects;
 *  - the precache-manifest plugin is left out: it exists for the service worker, and the Android
 *    app does not use one (everything is already local, and the shell's own cache headers apply);
 *  - the strict CSP is still injected, and inside the app `'self'` is the virtual origin
 *    https://lifekit.local, so the policy is exactly as tight as it is on the web.
 */
export default defineConfig({
  base: './',
  plugins: [react(), buildContentSecurityPolicy(), dropServiceWorker()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    outDir: 'android/app/src/main/assets/www',
    // Outside the project root, so Vite has to be told explicitly that emptying it is intended.
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
