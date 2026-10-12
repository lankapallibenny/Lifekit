/* LIFEKIT service worker — original code, no Workbox.
 *
 * Strategy summary
 * - Precache: read precache-manifest.json produced by the build, cache every asset of
 *   this build into a versioned cache (lifekit-<buildVersion>). Unversioned HTML
 *   navigations fall back to the cached app shell.
 * - navigate requests: network first with a short timeout, then cached index.html.
 *   The app is therefore fully usable offline after one successful load.
 * - hashed build assets: cache first (they are content-versioned and immutable).
 * - other same-origin GETs (e.g. public content JSON): stale-while-revalidate.
 * - cross-origin requests: never cached, passed straight through.
 *
 * Privacy: the cache only ever holds public application files. Personal data
 * (money records, tasks, resumes, notes) lives in IndexedDB/localStorage and is
 * never sent to this worker. Every SW-to-page message that names a cache is
 * answered without touching user data.
 */

const CACHE_PREFIX = 'lifekit-';
const NAV_TIMEOUT_MS = 4000;
let buildVersion = 'dev';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('./precache-manifest.json', { cache: 'no-store' });
        const manifest = await res.json();
        buildVersion = manifest.version || 'dev';
        const cache = await caches.open(CACHE_PREFIX + buildVersion);
        // Individual adds so one missing asset cannot fail the whole install.
        await Promise.all(
          manifest.assets.map((asset) =>
            cache.add(new Request(asset, { cache: 'reload' })).catch(() => undefined)
          )
        );
      } catch {
        // Offline or manifest missing: the app still works from the HTTP cache.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_PREFIX + buildVersion)
          .map((n) => caches.delete(n))
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {
          /* not supported */
        }
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'LIFEKIT_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: buildVersion });
  }
});

function isCacheable(response) {
  if (!response) return false;
  if (response.status !== 200) return false;
  const cc = response.headers.get('cache-control') || '';
  return !/no-store|private/i.test(cc);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_PREFIX + buildVersion);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);
    const fresh = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (isCacheable(fresh)) {
      cache.put('./index.html', fresh.clone()).catch(() => undefined);
    }
    return fresh;
  } catch {
    const cached = (await cache.match('./index.html')) || (await cache.match('./'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>LIFEKIT offline</title>' +
        '<body style="font-family:system-ui;padding:24px"><h1>LIFEKIT</h1>' +
        '<p>This page is not cached yet. Reconnect once, then open LIFEKIT again.</p></body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_PREFIX + buildVersion);
  const hit = await cache.match(request, { ignoreSearch: false });
  if (hit) return hit;
  const fresh = await fetch(request);
  if (isCacheable(fresh)) cache.put(request, fresh.clone()).catch(() => undefined);
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_PREFIX + buildVersion);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((fresh) => {
      if (isCacheable(fresh)) cache.put(request, fresh.clone()).catch(() => undefined);
      return fresh;
    })
    .catch(() => undefined);
  return hit || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache third-party responses
  // Never cache API traffic: it may be authenticated or user-specific.
  if (url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const destination = request.destination;
  if (destination === 'script' || destination === 'style' || destination === 'font' || destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
