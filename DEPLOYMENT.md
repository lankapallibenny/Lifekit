# Deploying LIFEKIT

LIFEKIT builds to a plain folder of static files. There is no database, no server-side renderer
and no required backend, so any static host will serve it. This document covers free options,
their real limits, and what to check after you deploy.

Everything here is a description of how the build is configured — it is not a claim that a
deployment has already been performed. Verify your own deployment after following the steps.

---

## 1. Build it

```bash
npm install
npm run build
```

Output:

- `dist/` — the complete app (HTML, hashed JS/CSS, icons, manifest, `sw.js`)
- `dist/precache-manifest.json` — the list of files the service worker precaches, with a build
  version derived from the content hash
- `dist/index.html` — includes a strict `Content-Security-Policy` meta tag and relative asset paths

Test the production build locally before publishing:

```bash
npm run preview      # http://localhost:4173
```

Two things to check in the browser console:

1. No 404s (especially `sw.js`, `manifest.webmanifest`, `precache-manifest.json`).
2. The service worker registers and the app still works after you switch to offline mode in
   DevTools.

> `base: './'` in `vite.config.ts` means the build works from a domain root **and** from a
> sub-path such as `https://user.github.io/lifekit/`. Keep it if you deploy to a project page.

---

## 2. Option A — GitHub Pages (free)

Good for: a public demo you control from a repository. Limits: a 1 GB published site, a soft
10-minute build limit, ~100 GB/month bandwidth, and HTTPS is provided by GitHub. Sites are public
unless you have a paid plan with private Pages. GitHub does not read `_headers`, so the CSP lives
in the meta tag in `index.html` instead — that is why the build injects it.

```bash
npm run build
npx gh-pages -d dist          # or push dist/ to a gh-pages branch yourself
```

Or with a workflow file (`.github/workflows/deploy.yml`):

```yaml
name: Deploy LIFEKIT
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test          # do not publish a build whose tests fail
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

Then: **Settings → Pages → Source: GitHub Actions**.

## 3. Option B — Cloudflare Pages (free tier)

Good for: fast global delivery and header support. Limits: 500 builds/month, 20 000 files per
deployment, 25 MiB per file. Free tier includes unlimited bandwidth for static assets, and
Cloudflare can serve `_headers` (which this project already ships).

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20

Add `public/_headers` (already in the repo) to send the real CSP as a response header. A header
is stronger than the meta tag because it also covers directives that browsers ignore in meta
tags, such as `frame-ancestors`.

## 4. Option C — Netlify (free tier)

Limits change over time; check the current plan page before you rely on them. Typically: a
monthly bandwidth allowance (100 GB at the time of writing), 300 build minutes, and headers
supported through `public/_headers` (copied into `dist/`).

- Build command: `npm run build`
- Publish directory: `dist`

`public/_headers` is picked up automatically.

## 5. Option D — Vercel (free tier)

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

The hobby tier is intended for personal, non-commercial projects and has usage limits — read the
current terms before deploying something you depend on. Header rules go in `vercel.json`; convert
the entries from `public/_headers` if you need them.

## 6. Option E — any static file host

Because routing is hash-based (`index.html#/money`), the app needs **no rewrite rules** and no
server-side routing. You can copy `dist/` to:

- an Apache/nginx box you already pay for,
- a shared host with FTP,
- an object store with static hosting,
- a Raspberry Pi on your own network (HTTPS needs a certificate; `localhost` is the exception
  browsers make for service workers).

Serve the folder over **HTTPS** unless you are on `localhost`: service workers, installation and
notifications all require a secure context.

---

## 7. Hosting the optional content backend

The app works without it. If you want published announcements or a reviewed community directory,
`server/` needs a Node.js host with a persistent disk. Free tiers for that change frequently and
often have no durable filesystem — a host that resets the container loses `server/data/db.json`.

Practical options, in order of least surprise:

1. **A small VPS or an always-free VM** (for example a free-tier ARM instance) with `systemd` or
   `pm2` running `npm run server` behind nginx for TLS.
2. **A container platform** with a mounted volume, so the JSON file survives restarts.
3. **Skip it.** Ship the app without a backend and keep the announcement feed to the bundled
   examples until you actually need to publish something.

Set at least:

```
LIFEKIT_SESSION_SECRET=<32+ random characters>
LIFEKIT_ADMIN_PASSWORD_HASH=<output of npm run server:hash -- "your passphrase">
LIFEKIT_COOKIE_SECURE=true
LIFEKIT_DATA_FILE=/var/lib/lifekit/db.json
```

Then point the frontend at it by updating `REMOTE_CONTENT_PATHS` in `src/lib/defaults.ts` (or by
serving the JSON as static files at `content/announcements.json` and `content/directory.json`, in
which case you need no server at all — only write access to those two files at deploy time).

**If you serve content statically:** only publish files a human has reviewed. The app deliberately
refuses to display a listing that does not carry a verification date, a named reviewer and an
http(s) source URL — see `validateListingPack` in `src/pages/Community.tsx` and its tests.

---

## 8. First-content checklist for the backend

```bash
npm run server:hash -- "a long unique passphrase"   # copy the printed hash
curl -s localhost:8787/api/health
```

Log in and create your first announcement (drafts stay invisible to the public endpoint until you
PATCH them to `published`):

```bash
curl -s -c cookies.txt -X POST localhost:8787/api/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"your passphrase"}'

curl -s -b cookies.txt -X POST localhost:8787/api/admin/announcements \
  -H 'content-type: application/json' \
  -d '{"title":"Scheduled maintenance","body":"The content service will be briefly unavailable while we update it.","category":"service","priority":"normal","publishedAt":"2026-10-11","status":"published"}'
```

---

## 9. What to check after deploying

1. The app loads over HTTPS and shows the onboarding screen the first time.
2. Reload with the network disabled — it still opens (service worker worked).
3. Install it (Android Chrome: menu → "Install app"; iOS Safari: Share → "Add to Home Screen").
4. The manifest icons appear correctly and the theme colour matches the brand.
5. Open a deep link such as `https://your-host/#/money?quick=expense` directly.
6. No console errors, and no third-party requests in the network tab.
7. Deploy a trivial change and confirm the "update ready" banner appears instead of a silent
   reload.

## 10. Honest limitations of this setup

- **Free tiers are not permanent.** Quotas, features and terms change without notice; nothing here
  promises a permanently free host.
- **A static host cannot send notifications.** All reminders are local to the device.
- **GitHub Pages ignores `_headers`.** You get the meta-tag CSP there; the response-header CSP
  needs a host that supports headers.
- **A backend on a free container with no volume will lose its data.** The store is a file; if the
  filesystem is ephemeral, so is the data.
- **No domain is required.** A `*.github.io`, `*.pages.dev`, `*.netlify.app` or `*.vercel.app`
  address is fine for a personal deployment.

---

## Android APK

`npm run android:apk` builds an installable APK from the same build, with no Android SDK required
(the toolchain fetches what it needs on first run). It is not a store submission: install it by
copying the file to a phone, or with `adb install -r dist-android/Lifekit-<version>.apk`.

See [android/README.md](android/README.md) for signing with your own key — the default signature is
the Android debug key, which is fine for sideloading and not an identity for distribution.
