# LIFEKIT — Everyday Tools. A Better Life.

A free, offline-first personal toolkit for money records, daily planning, learning, career
preparation, digital safety and community information. It runs entirely in the browser, keeps
your records on your own device, and works with no account, no bank connection, no AI service
and no paid API.

**Developed by Benny ❤️**

---

## What this is, and what it deliberately is not

| It is | It is not |
| --- | --- |
| A Progressive Web App you can install on Android, iOS or desktop | A Google Play download |
| Also buildable as an installable **Android APK** from this repository (`npm run android:apk`) | A rewritten native app: the APK is the same web app in a thin, audited shell |
| Local-first: records live in this browser's IndexedDB | A cloud service with an account and a login |
| Usable offline after the first load | Dependent on a server being up |
| Honest about limits (see [Offline limitations](#offline-limitations)) | A promise that reminders always fire |
| Original code, content and branding | A copy of anyone else's product or articles |

Deliberate exclusions, enforced by the code and the tests:

- **No AI.** No model calls, no chatbot, no generated text at runtime. Everything you read shipped
  inside the app.
- **No bank linking, payments or scraping.** LIFEKIT never asks for a bank password, card PIN, OTP
  or banking credential, and it never reads your bank automatically. Every figure is one you typed.
- **No ads, no trackers, no analytics SDK.** Nothing follows you.
- **One optional network feature, off by default.** The only request the app can make is fetching a
  published content pack, and only after you enable it in Settings. There is a test asserting that
  no request happens while it is off.
- **No secrets in the frontend.** The optional content backend keeps its session secret and its
  admin password hash on the server; the browser only ever receives an HttpOnly cookie.
- **No fabricated data.** Empty screens stay empty. There is no sample money, no invented job
  listing, no invented organisation, no invented notification.

---

## Feature checklist

Legend: ✅ implemented and covered by automated tests · 🟡 implemented, verified by hand in the
build (no automated test yet) · ⛔ intentionally not included.

### Home dashboard
- ✅ Greeting and today's date, using the name you optionally gave during setup
- ✅ Quick actions: add expense, add income, open offline tools
- ✅ Today's tasks, habit ticks, savings goal progress, budget progress
- ✅ Recorded income and expense totals for the current month, plus a three-month view
- ✅ Saved (bookmarked) lessons, career shortcuts, rotating safety tip
- ✅ Announcements card (bundled examples marked as examples)
- ✅ Offline indicator and a backup reminder that appears when it is actually due
- ✅ Empty states everywhere instead of invented data

### Money tracker
- ✅ Add, edit and delete entries (expense or income) with date, category, note and recurrence
- ✅ Bundled categories plus your own custom categories, with archiving instead of deletion
- ✅ Weekly/monthly/yearly/all-time summaries and a per-category breakdown
- ✅ Search and filter by text, type, category and period
- ✅ Budgets (weekly or monthly, per category or all expenses) with progress bars
- ✅ Savings goals with contributions and progress
- ✅ Recurring expense planner that shows an **estimate** — never a guaranteed bill
- ✅ CSV export and import with validation, per-line error messages and duplicate-safe ids
- ✅ JSON backup and restore (whole app), with a confirmation before a restore replaces data
- ✅ Money kept in integer minor units, so `0.1 + 0.2` style drift cannot reach your totals
- ✅ Every screen labels the figures "recorded cash flow", not a bank balance

### Planner
- ✅ Tasks with due dates, priorities, tags, notes and repeat rules
- ✅ Day, week and month views; study sessions and personal goals as first-class kinds
- ✅ Habit tracker with per-weekday schedules and a one-tick-per-day log
- ✅ Optional local reminders per task and per habit
- ✅ Search and filters; works fully offline
- 🟡 Repeating task materialisation is shown in the planner; the next-occurrence maths is unit tested

### Learn library
- ✅ Seven categories: computer basics, languages, maths, study methods, personal finance, digital
  safety, career skills
- ✅ 15 original short lessons written for this project (at least one in every category)
- ✅ Full-text search, subject filter, unread/saved/completed filters
- ✅ Bookmarks that cache the lesson text on the device so it stays readable offline
- ✅ Reading progress and a "Mark complete" control
- ✅ Further-reading links to reputable sources, each with the date it was last reviewed

### Career toolkit
- ✅ Résumé builder: details, education, experience, projects, skills, languages, certifications
- ✅ Print-friendly layout; "Print / Save as PDF" uses your browser's own print dialog
- ✅ Print CSS that hides navigation and buttons and fits an A4 page
- ✅ Interview question bank with a suggested structure, a sample answer and what to avoid
- ✅ Application tracker with statuses and follow-up dates
- ✅ Links to real resources only; no openings, endorsements or salary claims

### Safety centre
- ✅ Original checklists: fake job offers, phishing, suspicious links, impersonation, payment
  fraud, OTP/password requests, what to do after fraud, device and account hygiene
- ✅ Each topic: warning signs, what to do, and what to do if you are already affected
- ✅ Official reporting channels by country, each with a source URL and a "last reviewed" date
- ✅ A plain statement that this is educational and cannot detect malware or guarantee safety

### Community directory
- ✅ Searchable, category-filtered, with the organisation, region, services, source URL and
  last-verified date for each listing
- ✅ Ships **empty** and says so: listings appear only when an operator publishes a reviewed
  content pack, or when a local reviewer approves a submission on this device
- ✅ Submissions are stored as unpublished drafts; an unapproved draft is never shown
- ✅ "This looks outdated" reports are kept on the device
- ✅ Empty state explains exactly why nothing is listed

### Notification centre and settings
- ✅ Per-category toggles, master switch, reminder times, quiet hours (including windows that
  cross midnight), sound and vibration
- ✅ Upcoming reminders list, delivery history, mark announcements read, clear history
- ✅ Example preview that schedules nothing
- ✅ Permission requested only after you switch reminders on and press the button; a denial is
  never re-prompted
- ✅ Explains the three delivery types (local, in-app, remote push) and which this release has
- ✅ Bundled "announcements" are clearly labelled examples, are never notify-eligible, and are
  replaced by real messages only when an operator publishes a pack you opted into
- ✅ The screen says which of the three states it is in: bundled examples, published messages, or
  published feed unreachable (bundled examples kept rather than showing a fake empty feed)

### Offline tools
- ✅ Calculator (own parser, no `eval`), unit converter (including Indian land units),
  percentage calculator, days-between calculator, checklist maker, notes, study timer,
  savings goal calculator, printable shopping list, recurring expense planner
- ✅ Every formula unit tested, and estimates labelled as estimates

### Settings and privacy
- ✅ Theme (system/light/dark), larger text, reduced motion, week start, currency and locale
- ✅ Language architecture in place (UI strings in one place, content packs carry a language)
- ✅ Export everything, restore from a file, clear selected data, reset with typing confirmation
- ✅ Privacy notice, about page, open-source licence list, version number
- ✅ Footer credit on every screen

### Platform
- ✅ PWA manifest, maskable icons, installable, three shortcuts (quick expense, planner, tools)
- ✅ Service worker with precaching, runtime caching, offline navigation fallback and an
  "update ready" banner instead of a silent reload
- ✅ Strict CSP and hardening headers in the build and in `public/_headers`
- ✅ Accessibility: skip link, keyboard-operable dialogs, labelled fields, live regions,
  44 px touch targets, visible focus, `prefers-reduced-motion` support
- ✅ Android APK build: one command, no Android SDK or Gradle needed, generated launcher icons,
  exports saved to the device's Downloads folder, Android print dialog, system notifications
  (see [android/README.md](android/README.md))

## Build order (how this was put together)

The work was done in six phases so that each one left the app runnable:

1. **Foundation** — tooling, design tokens, routing shell, storage layer (IndexedDB plus an
   in-memory fallback), the data model, and the service worker strategy.
2. **Core data** — money, planner and the calculation/date/unit modules, with their pure logic
   unit tested before any screen was built on top of them.
3. **Screens** — Home, Money, Planner, Learn, Career, Safety, Community, Tools, Notifications and
   Settings, each reading and writing through the same repository layer.
4. **Offline and PWA** — manifest, icons, precache manifest generated from the build, offline
   navigation fallback, update banner, install metadata.
5. **Safety and polish** — validation everywhere, import/backup hardening, CSP and headers,
   accessibility pass, print styles, notification permission handling.
6. **Verification and handover** — the test suite, the first real build, the licence inventory,
   the optional backend, and this documentation.

---

## Project structure

```
lifekit/
├── index.html                  App shell, meta tags, noscript notice
├── public/
│   ├── sw.js                   Service worker: precache, runtime strategy, offline fallback
│   ├── manifest.webmanifest    PWA manifest (icons, shortcuts, standalone display)
│   ├── _headers                CSP + hardening headers for static hosts that read them
│   ├── robots.txt              No crawling, no analytics
│   ├── logo.svg                Original LIFEKIT mark
│   └── icons/                  Generated PNG icons (192, 512, maskable, favicon)
├── android/                    Android shell that packages the app as an APK
│   ├── README.md               Build, install, verify, sign and the shell's honest limits
│   └── app/src/main/           Manifest, java (WebView host + bridge), resources, assets
├── scripts/
│   ├── generate-icons.mjs      Zero-dependency PNG writer for the web icon set
│   ├── icon-mark.mjs           The LIFEKIT mark as maths, shared by web and Android icons
│   ├── precache-plugin.ts      Injects the CSP meta tag and writes dist/precache-manifest.json
│   ├── dependency-inventory.mjs Regenerates THIRD_PARTY_LICENSES.md and the in-app licence list
│   └── android/                APK build: toolchain, launcher icons, ZIP writer, build script
├── src/
│   ├── main.tsx                Mounts React, registers the service worker, surfaces updates
│   ├── App.tsx                 Routing, lazy loading, onboarding gate, update banner
│   ├── router.tsx              Hash router (works on any static host, no rewrites needed)
│   ├── styles.css              Design tokens, light/dark themes, print styles
│   ├── components/             Icons, UI primitives, layout, tiny Markdown renderer
│   ├── pages/                  Home, Money, Planner, Learn, Career, Safety, Community,
│   │                           Tools, Notifications, Settings, Onboarding
│   ├── state/store.tsx         Single store: data, settings, toasts, reminders, backups
│   ├── content/                Original written content (lessons, safety, career, licences)
│   └── lib/                    money, dates, calc, units, csv, backup, storage, repo,
│                               notifications, contentPacks, native, hooks, models, defaults
├── server/                     OPTIONAL content backend (zero dependencies)
│   ├── src/{index,app,auth,store,validate}.mjs
│   ├── .env.example            Documented configuration
│   └── data/                   Runtime JSON file (git-ignored)
├── tests/                      15 suites: money, calc, dates, csv, backup, repo,
│                               notifications, router, community, content, server, app,
│                               android (packaging), native (the bridge), about
├── THIRD_PARTY_LICENSES.md     Generated dependency and licence inventory
├── LICENSE                     MIT
├── DEPLOYMENT.md               Free hosting instructions, measured honestly
└── vite.android.config.ts      Build configuration for the APK's bundled copy of the app
```

---

## Running it locally

Requirements: Node.js 20 or newer and npm. Everything else is a dev dependency.

```bash
npm install          # once
npm run dev          # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:5173` |
| `npm run typecheck` | TypeScript, strict, no emit |
| `npm test` | All automated tests (15 suites) |
| `npm run test:watch` | Tests in watch mode |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm run preview` | Serves `dist/` on `0.0.0.0:4173` |
| `npm run icons` | Regenerates the PNG icons |
| `npm run inventory` | Regenerates the licence inventory |
| `npm run android:apk` | Builds the signed APK into `dist-android/` (no Android SDK needed) |
| `npm run android:check` | Verifies the Android shell's config, manifest and icons |
| `npm run server` | Starts the optional content backend (see below) |

### Testing on a phone

Run `npm run dev` on your computer and open `http://<your-computer-ip>:5173` on the phone. The
service worker is disabled in dev mode, so install/offline behaviour is only visible after
`npm run build && npm run preview`.

For the real phone experience, build the APK and install it:

```bash
npm run android:apk
adb install -r dist-android/Lifekit-1.0.0.apk     # or copy the file to the phone and tap it
```

See [android/README.md](android/README.md) for what the shell adds, how to sign with your own key,
and how to check it in three minutes.

---

## Android app (APK)

The same app can be packaged as an installable Android APK. It is the web app inside a thin Java
shell — about 700 lines that host a WebView, serve the bundled files from the APK, and add the few
things a WebView cannot do on its own:

- exports (CSV and backup files) are written to the device's `Downloads/LIFEKIT/` folder and can
  then be shared from Android's share sheet;
- "Print / Save as PDF" opens Android's print dialog;
- reminders are delivered as real system notifications, with your sound and vibration settings.

```bash
npm run android:apk          # -> dist-android/Lifekit-1.0.0.apk (+ .sha256)
npm run android:check        # verify the shell's config without building
```

No Android SDK, Gradle or Android Studio is required: if the machine has neither a JDK nor Android
build tools, the build fetches a self-contained set into `~/.cache/lifekit-android-tools` on first
run and reuses it. Set `JAVA_HOME` and/or `LIFEKIT_ANDROID_TOOLS` to use your own instead.

Deliberate choices, all explained in [android/README.md](android/README.md):

- **No `INTERNET` permission.** The app is served from inside the APK, so it is physically unable
  to reach the network. The one optional network feature (a published content pack, off by
  default) reports itself as unreachable in the Android app.
- **A virtual HTTPS origin (`https://lifekit.local`) rather than `file://`**, so storage,
  notifications and the CSP behave exactly as they do in a browser.
- **The JavaScript bridge is origin-checked**: it refuses every call unless the WebView is on the
  app's own origin, and external links open in the user's browser instead of inside the app.
- **The launcher icons are generated from the same mark as the web icons** (`scripts/icon-mark.mjs`),
  and a test fails if the committed PNGs drift from it.

## The optional content backend

The app never needs a server. If you want to publish announcements or a reviewed community
directory to users who opt in, `server/` contains a zero-dependency Node service.

```bash
npm run server:hash -- "your long admin passphrase"   # prints a scrypt hash
cp server/.env.example server/.env                    # then edit it
npm run server                                        # listens on 0.0.0.0:8787
```

Required environment variables:

| Variable | Meaning |
| --- | --- |
| `LIFEKIT_SESSION_SECRET` | At least 32 characters. Signs session tokens. The process refuses to start without it. |
| `LIFEKIT_ADMIN_PASSWORD_HASH` | The scrypt hash printed by `npm run server:hash`. Never the plaintext. |

Optional: `LIFEKIT_IP_SALT`, `LIFEKIT_DATA_FILE`, `LIFEKIT_COOKIE_SECURE` (default on),
`PORT`, `HOST`. See `server/.env.example`.

Endpoints:

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | none | Liveness check |
| `GET /api/announcements?language=` | none | Published, unexpired announcements only |
| `GET /api/directory` | none | Verified, published listings only |
| `POST /api/reports` | none | "This listing is outdated" report |
| `POST /api/admin/login` | password | Sets an HttpOnly, SameSite=Strict session cookie |
| `POST /api/admin/logout` | cookie | Clears the cookie |
| `GET, POST /api/admin/announcements` | cookie | List everything, or create |
| `PATCH /api/admin/announcements/:id` | cookie | Change `status` and/or `expiresAt` only |
| `GET, POST /api/admin/directory` | cookie | List everything, or create |
| `PATCH /api/admin/directory/:id` | cookie | Change verification fields only |
| `GET /api/admin/reports` | cookie | Read submitted reports |
| `GET /api/admin/audit?limit=` | cookie | Recent privileged actions |

Properties the tests actually verify: drafts are invisible to anonymous callers, tampered or
expired sessions are rejected, login is rate limited, bodies are size limited, oversized bodies
get a readable response, validation failures return field-level details, and privileged actions
are audited. See `tests/server.test.ts`.

The store is a single JSON file written atomically. To move to PostgreSQL, implement the same
methods (`listAnnouncements`, `publicAnnouncements`, `insertAnnouncement`, `updateAnnouncement`,
`listListings`, `insertListing`, `updateListing`, `insertReport`, `listReports`, `listAudit`) in
one adapter and pass it to `createApp`. The app itself never talks to the database.

---

## Tests: what actually runs

Every number below comes from an actual run of the suite in this repository, not from an
estimate. Re-run them yourself with `npm test`.

**Result of the last run:** `15 suites passed`, `325 tests passed`, `0 failed`.

| Suite | Verifies |
| --- | --- |
| `tests/money.test.ts` | Amount parsing (including Indian comma grouping and rejection of `1e5`, `1 2 3`), decimal drift, half-up rounding, summaries, category breakdown, budget status, goal progress, filters, recurrence and month-end clamping |
| `tests/calc.test.ts` | Calculator precedence, unary minus, bracket errors, division by zero, hostile input rejection, percentage helpers, savings plan edges, unit conversions incl. Indian land units, round-trip consistency, readable formatting |
| `tests/dates.test.ts` | ISO dates, period ranges, week/month matrices, day counts, labels, clock parsing |
| `tests/csv.test.ts` | Spreadsheet-formula neutralisation, RFC-4180 quoting, import validation with per-line errors, row and file caps |
| `tests/backup.test.ts` | Backup round trip, rejection of foreign/oversized/prototype-polluting files, partial-data salvage, settings and prefs sanitisation |
| `tests/repo.test.ts` | IndexedDB persistence for every collection, update-in-place, deletion, selective clearing, résumé document round trip, announcement read state |
| `tests/notifications.test.ts` | Quiet hours incl. midnight crossing, per-category switches, fixed-clock scheduling, once-per-day keys, deduplication, in-app fallback, published-announcement eligibility, and that a denied permission is never requested again |
| `tests/router.test.ts` | Hash parsing, query values, deep lesson links, unknown routes, history replacement |
| `tests/community.test.ts` | Pack validation: unverified rows, missing sources, future verification dates and prototype keys are rejected; good rows survive |
| `tests/content.test.ts` | Content integrity: every lesson and channel dates and URLs, no fabricated claims, examples flagged as examples, and validation of the optional published announcement pack |
| `tests/server.test.ts` | Backend integration over real HTTP: public/private separation, authorization, rate limits, body limits, validation, audit, cookies |
| `tests/app.test.tsx` | The real UI: onboarding gate, honest empty states, navigation, offline notice, offline task creation, money quick-add persistence, `dialog`-API regression, lesson bookmarking with cached text, résumé draft and application tracker, privacy and licence screens, and the rule that **no network request happens until the optional content feed is switched on** |
| `tests/android.test.ts` | The APK packaging rules: no `INTERNET` permission, only the two explained permissions, version agreement between `package.json` and the manifest, the origin check on the bridge, single-colour status-bar icon, launcher icons that are byte-identical to the mark, a DEX that is stored and 4-byte aligned, reproducible output, and export file names that cannot escape the Downloads folder |
| `tests/native.test.ts` | The Android bridge from JavaScript: exports written to the device rather than downloaded, reminders delivered as system notifications with the app's sound/vibration settings, printing routed to Android, share/open-external — plus every one of those behaving correctly with no shell, with a half-built bridge, with a bridge that throws, and with a bridge that answers with nonsense |
| `tests/about.test.tsx` | That the About screen tells the truth about where the copy is running: browser storage versus the Android app, where exports land, and that uninstalling removes data |

Not covered by automated tests (verified by hand in the built app): print/PDF output,
installed-PWA behaviour on a real phone, the visual appearance of each screen, and — for the
Android app — that the shell renders and notifies correctly on your specific device. The build does
verify the finished APK itself (`apksigner verify`, a badging dump, and a check that the web app is
inside the archive).

---

## Offline limitations

- The **first visit needs a connection** to download the app (the Android APK does not: the app is
  already inside it). After that the service worker serves the built files from cache.
- **Storage is per browser profile.** Clearing site data, using private browsing, or an OS that
  evicts storage for rarely used sites removes your records. LIFEKIT cannot recover them; the
  backup file is the recovery path.
- **Not every device is equal.** Some Android skins and battery savers purge cached data
  aggressively. Installing the PWA to the home screen reduces this.
- Anything that genuinely needs the network — opening external source links, or fetching a
  published content pack if you enabled it — does not work offline. The app says so rather than
  pretending.
- The service worker is registered only in production builds, so offline behaviour is not
  visible while running `npm run dev`.

## Notification limitations

- Reminders are **local**: computed on the device, shown while the app is open or the next time
  it is opened after the reminder time.
- In the **Android app**, reminders are delivered as Android system notifications, so they appear
  even when you have left the app. Coverage is still not guaranteed on a device with aggressive
  battery saving.
- Browsers cannot reliably wake a web app in the background. Android may delay or skip a
  notification when the app is closed, when battery saver is on, or when the tab has been
  discarded. LIFEKIT says this in the app instead of promising otherwise.
- If you deny the notification permission, nothing is lost: reminders still appear in the
  in-app notification centre, and LIFEKIT never asks again. You can re-enable it in your
  browser's site settings.
- **No push service is included.** Remote push would need a delivery service, an internet
  connection and extra infrastructure; it is out of scope for this release.
- Notification text never contains money amounts, balances or anything from your financial
  records. Borrowed amounts are not "sent" anywhere either — the notification is created on your
  device.

## Data and privacy summary

- Records live in this browser's IndexedDB and local storage. Nothing is uploaded.
- In the **Android app** they live in the app's own private storage instead, which is separate from
  your browser's. A backup file is how you move records between the two.
- Money data is never transmitted to a backend and never included in a notification.
- The only optional network feature is fetching a published content pack, and it is off until you
  enable it in Settings.
- You can export everything as a JSON file, and delete everything with a confirmation step.
- On a shared phone or computer, anyone who opens that browser profile can read your records:
  LIFEKIT has no separate app passcode. Use your own browser profile, and clear LIFEKIT data
  after use on a shared or public machine.

## Dependency and licence inventory

`THIRD_PARTY_LICENSES.md` (generated by `npm run inventory`) lists every dependency, its installed
version, its declared licence and why it is used, plus the Android build tools that are fetched
only when building the APK (none of which is bundled into the installed app). The short version: **2 runtime dependencies**
(React and React DOM, both MIT) and 12 development-only packages. All are permissive licences; no
copyleft code ships in the bundle. This inventory reduces licence risk — it is not a legal
guarantee.

LIFEKIT's own code, branding, artwork, interface text and written content are original work
released under the MIT License (`LICENSE`). Third-party learning resources are never copied into
the app; the Learn library links out to them instead, with each lesson's review date shown.

---

## Known issues and future improvements

Known issues (all real, none hidden):

1. **Recurring entries are estimates.** The recurring expense planner projects costs; it does not
   create transactions. It is labelled as an estimate wherever it appears.
2. **The community directory ships empty.** That is a design decision (nothing invented), but it
   means the screen is only useful once an operator publishes a reviewed pack.
3. **Remote push is not implemented**, so a reminder cannot fire while the app is fully closed on
   an aggressive battery-saver device.
4. **No import from bank statements or SMS.** Deliberate: it would require permissions and
   parsing that this project will not take on. CSV import from a file you prepared yourself is
   the supported path.
5. **The app is single-user per browser profile.** There is no multi-profile switching or app
   passcode.
6. **Language switching covers the architecture, not the content.** The UI strings and content
   packs are language-aware; the bundled written content is English only today.
7. **Layout is verified in jsdom and by hand, not by screenshot diffing**, so subtle mobile
   rendering issues could still exist on uncommon screen sizes.
8. **Calendar-specific behaviour**: reminders and "today" use the device clock and time zone. A
   device with a wrong clock will date entries wrongly.
9. **The Android APK is not on any app store, and its default signature is the Android debug
   key.** It is meant to be built and installed by whoever runs `npm run android:apk`; signing with
   your own key is documented in [android/README.md](android/README.md).
10. **In the Android app the optional remote content feed cannot work**, because the app asks for
    no `INTERNET` permission at all. That is a deliberate trade: the app is completely unable to
    reach the network, and the app says the feed is unreachable instead of pretending.
11. **The Android shell is the newest, least-tested part of the project.** Its packaging rules and
    JavaScript bridge are covered by tests, but the shell has not been run on a wide range of
    devices, and Android's print engine does not support `@page` print CSS (the app's print rules
    hide navigation and buttons, so the output is still the document rather than the screen).

Future improvements, in the order I would tackle them:

0. Screenshot-based visual checks on a real Android device for the APK (the packaging is tested;
   what the phone shows is checked by hand today).
1. Spanish/Hindi/Telugu content packs with a translation workflow and review dates.
2. Optional encrypted backup files (passphrase-protected export) so a shared drive copy is safe.
3. A "shared device" quick-lock: a local PIN that gates the UI (not a substitute for real
   encryption, and it would be described that way).
4. Import from the CSV exports of common banking apps, with a column-mapping screen and preview.
5. Printable monthly report (PDF via browser print) for offline record keeping.
6. A content-review checklist and date-stamping UI for operators publishing packs.
7. Screenshot-based visual regression tests for the main screens at 360 px width.
8. A second store adapter example (SQLite or PostgreSQL) shipped with migrations.

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for free hosting options on GitHub Pages, Cloudflare Pages,
Netlify and Vercel, with their real limits stated, plus what to check after a deploy. Short
version: the app is a static folder — `npm run build`, then publish `dist/`.

## Licence

MIT — see [LICENSE](LICENSE). Not affiliated with any bank, government body or employer
mentioned in the educational content.
