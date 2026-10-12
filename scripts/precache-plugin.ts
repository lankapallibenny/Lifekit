import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, posix } from 'node:path';

/**
 * First-party build plugins for LIFEKIT (no third-party PWA plugin, so the
 * dependency surface stays small and auditable).
 *
 * 1. buildPrecacheManifest() — after the bundle is written, walk `dist/` and emit
 *    `precache-manifest.json` listing every static asset with a content hash.
 *    `public/sw.js` reads this file at install time and precaches exactly the
 *    assets that belong to the current build. Old caches are deleted on activate,
 *    which keeps versioned assets from going stale without ever touching user data
 *    (entries live in IndexedDB / localStorage, which the Cache Storage API does
 *    not manage).
 *
 * 2. buildContentSecurityPolicy() — inject a strict CSP <meta> into the production
 *    HTML only. The dev server needs inline scripts and a WebSocket, so injecting
 *    the strict policy at build time avoids a broken `npm run dev`. Platform
 *    header files (public/_headers) carry the same policy where headers are supported.
 */
export function buildPrecacheManifest(): Plugin {
  return {
    name: 'lifekit:precache-manifest',
    apply: 'build',
    closeBundle() {
      const distDir = join(process.cwd(), 'dist');
      const files: string[] = [];

      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          const st = statSync(full);
          if (st.isDirectory()) walk(full);
          else files.push(posix.join('./', relative(distDir, full).split('\\').join('/')));
        }
      };
      try {
        walk(distDir);
      } catch {
        this.warn('dist/ not found; skipping precache manifest');
        return;
      }

      const hash = createHash('sha256');
      const entries = files
        .filter((f) => !f.endsWith('/sw.js') && !f.endsWith('/precache-manifest.json'))
        .sort()
        .map((f) => {
          const body = statSync(join(distDir, f.replace('./', '')));
          hash.update(`${f}:${body.size}`);
          return f;
        });

      const manifest = {
        name: 'LIFEKIT',
        version: hash.digest('hex').slice(0, 12),
        generatedAt: new Date().toISOString(),
        assets: entries,
      };

      mkdirSync(distDir, { recursive: true });
      writeFileSync(join(distDir, 'precache-manifest.json'), JSON.stringify(manifest, null, 2));
      this.info?.(`precache manifest: ${entries.length} assets, version ${manifest.version}`);
    },
  };
}

export function buildContentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Same-origin only: the optional LIFEKIT backend for public content. No third-party
    // analytics, no AI endpoints, no ad networks.
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    // Listed for completeness. Browsers ignore frame-ancestors inside a <meta> policy, so the
    // authoritative anti-framing rule is the response header in public/_headers (and in the
    // backend's own headers) — this meta tag is the belt to that pair of braces.
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    name: 'lifekit:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`
      );
    },
  };
}
