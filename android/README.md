# LIFEKIT for Android (APK)

This folder is the Android shell around the LIFEKIT web app. It produces an installable APK that
contains the whole toolkit, so the phone needs no connection, no account and no server.

**What it is:** the same app, packaged. **What it is not:** a second codebase, or a claim that the
app has been tested on every device. The parts that can be checked automatically are tested (see
[What is verified](#what-is-verified-and-what-is-not)); installing it on a real phone is the check
that matters and only you can do it.

---

## 1. Build it

```bash
npm install
npm run android:apk
```

Output: `dist-android/Lifekit-<version>.apk` plus `Lifekit-<version>.apk.sha256`.

You do **not** need Android Studio, Gradle, or an Android SDK. If the machine has no JDK and no
Android build tools, the build fetches a self-contained set into
`~/.cache/lifekit-android-tools` on first run (about 85 MB) and reuses it afterwards. Everything it
uses is listed with its licence in [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md).

To use tools you already have instead, point the build at them:

```bash
# Any JDK 17+ (JAVA_HOME or LIFEKIT_JAVA)
export JAVA_HOME=/path/to/jdk

# A directory containing: aapt2, android.jar, d8.jar, apksigner.jar and ecj-*.jar
export LIFEKIT_ANDROID_TOOLS=/path/to/android-build-tools

npm run android:apk
```

Useful flags (`npm run android:apk -- <flag>`):

| Flag | Effect |
| --- | --- |
| `--skip-web` | Reuse the existing `android/app/src/main/assets/www` instead of rebuilding the web app |
| `--keep` | Keep `.android-build/` (the compiled java, dex and unsigned APK) for inspection |
| `--out <path>` | Write the APK somewhere else |
| `--keystore <path> --ks-alias <a> --ks-pass <p> --key-pass <p>` | Sign with your own key instead of the debug key |

Other scripts: `npm run android:check` (verify config, manifest and icons, build nothing),
`npm run android:web` (only the web build for Android), `npm run android:icons` (regenerate the
launcher icons from the LIFEKIT mark), `npm run android:icons:check` (fail if they have drifted).

### Signing

By default the APK is signed with the standard Android **debug** keystore
(`CN=Android Debug`). That is installable and fine for personal use, testing and sharing a sideload,
but it is not a release key: anyone can replace an app signed with it, and stores reject it.

For a build you intend to keep, create your own key and keep it safe — losing it means you cannot
update the app, only publish it under a new id:

```bash
keytool -genkeypair -v -keystore lifekit-release.jks -alias lifekit \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Your Name, O=Your Organisation, C=Your Country"

npm run android:apk -- --keystore lifekit-release.jks --ks-alias lifekit \
  --ks-pass pass:YOUR_PASSWORD --key-pass pass:YOUR_PASSWORD
```

Never commit a keystore or its passwords. `.gitignore` already excludes `.env`; add your keystore
path to your own ignore rules.

---

## 2. Install it

**Prebuilt:** a build of the released version is checked in at [`android/releases/`](releases/README.md),
so it can be downloaded and installed without building anything. Open this on the phone and tap the
file (the branch URL works until this work reaches `main`, then use the `main` URL):

```
https://github.com/lankapallibenny/Lifekit/raw/main/android/releases/Lifekit-1.0.0.apk
https://github.com/lankapallibenny/Lifekit/raw/arena/c664e297-lifekit/android/releases/Lifekit-1.0.0.apk
```

**On the phone, from a file:** copy the APK to the phone (USB, cloud drive, chat app), tap it, and
allow "install unknown apps" for the app doing the installing. Android 8 and newer will ask once.

**Over USB with adb:**

```bash
adb install -r dist-android/Lifekit-1.0.0.apk
```

The APK targets Android 10 (API 29) and newer, and is built against API 34.

---

## 3. What the shell adds

The web app already works offline. The shell exists for the three things a WebView cannot do by
itself, and for nothing else:

| Feature | In a browser | In the Android app |
| --- | --- | --- |
| Where records live | That browser profile | The app's private storage (separate from your browser) |
| CSV / backup export | Browser download | Saved to `Downloads/LIFEKIT/`, then sharable from the share sheet |
| Print / Save as PDF | Browser print dialog | Android's print dialog (also how you save a PDF) |
| Reminders | Web Notification API while the tab is alive | Real system notifications, with your sound and vibration settings |
| External links | Open in a new tab | Open in your own browser, not inside the app |
| Installing | "Add to home screen" | Ordinary APK install |

Everything else — money records, planner, learning library, career toolkit, safety centre,
community directory, offline tools, settings — is the same code, the same storage layer and the
same tests as the web app.

### How it is wired

```
android/app/src/main/
  AndroidManifest.xml              no INTERNET permission; POST_NOTIFICATIONS + VIBRATE only
  java/com/bennylankapalli/lifekit/
    AppConfig.java                 package id, virtual origin, colours, internal-URL rule
    MainActivity.java              the WebView, the asset loader, printing, notifications, picker
    WebAppInterface.java           window.LifekitAndroid — the only bridge, callable by our origin only
  res/                             theme, colours, launcher icons (generated), notification icon
  assets/www/                      the built web app (generated by the build, not committed)
src/lib/native.ts                  the JavaScript side of the bridge (no-ops in a browser)
```

Three decisions are worth knowing about, because they are what make this safe rather than clever:

1. **No `INTERNET` permission.** The web app is bundled inside the APK and served to the WebView
   from `https://lifekit.local` by an interceptor in `MainActivity`, so nothing has to be fetched.
   The one optional network feature of the web app (a published content pack, off by default)
   reports that the feed is unreachable inside the Android app — see
   [Known behaviour](#known-behaviour-in-the-android-app).
2. **A virtual HTTPS origin instead of `file://`.** `file://` pages are opaque origins with
   different rules for storage, service workers and notifications. Serving the same files from a
   secure origin keeps the web app's behaviour identical to the browser, which is why the app's own
   code did not have to be rewritten.
3. **The bridge is origin-checked.** Every method in `WebAppInterface` refuses to run unless the
   WebView is currently showing the app's own origin, and external URLs are opened in the user's
   browser instead of inside the WebView — so a remote page never gets a bridge that can write
   files or post notifications.

---

## 4. What is verified, and what is not

`npm test` runs 325 automated tests, including:

- the shell config: no INTERNET permission, only the two permissions that are explained, the
  version in the manifest matching `package.json`, the bridge's origin check, and a single-colour
  status-bar icon;
- the generated launcher icons being byte-identical to what the mark produces (so icons cannot
  drift from the web branding);
- the APK packer: the DEX is stored uncompressed and 4-byte aligned, the archive stays valid, and
  the same input gives byte-identical output;
- the JavaScript bridge: exports going to the device, reminders becoming system notifications,
  printing routed to Android, and every one of those falling back cleanly when there is no shell,
  when the bridge throws, or when it answers with something that is not JSON.

The build itself verifies the finished APK: `apksigner verify` must report a valid signature, the
badging dump must show the expected package, SDK levels and permissions, and the web app must be
present in the archive.

**Not verified automatically** (stated plainly, because pretending otherwise is how a project
starts lying):

- that the app renders correctly on your specific phone or Android version;
- that a notification actually appears on your device, with your battery settings;
- that Android's print engine lays the résumé out exactly like the browser's;
- the two-month-old-WebView case: the shell uses `Blob.text()` when it exists and a `FileReader`
  fallback when it does not, but a genuinely ancient WebView is untested.

### Checking it yourself, in three minutes

1. Install the APK, open it, and complete the first-run setup.
2. Add one expense, then Settings → Export everything: the file should land in
   `Downloads/LIFEKIT/` and be visible in the Files app.
3. Turn reminders on in Notification settings, allow the permission, then use Settings → Preview
   (it schedules nothing) and check that a notification appears.
4. Turn on aeroplane mode, force-stop the app, reopen it: your records are still there, which is
   the whole point.

If something is wrong, the app's own error path should tell you what: a missing bundle shows an
explicit screen rather than a blank one, and a failed export reports why through a toast.

---

## 5. Known behaviour in the Android app

These are the honest limits of the packaging, not bugs:

1. **The optional content feed cannot work.** With no `INTERNET` permission, "fetch a published
   content pack" reports the feed as unreachable. The app keeps its bundled examples and says so;
   it never shows a fake empty feed. Turning the setting on is harmless but has no effect.
2. **Web notifications are replaced by Android ones.** The web app's Notification API is not used
   inside the shell; reminders go through Android so they survive leaving the app.
3. **Background delivery is still not guaranteed.** Reminders are scheduled by the app and shown
   when Android allows it. Battery savers can delay them; nothing is lost, because the reminder
   stays in the in-app list.
4. **The web copy and the Android copy keep separate records.** They are different storage areas,
   like two browsers on the same phone. A backup file is the way to move between them (and to a new
   phone).
5. **Uninstalling removes the app's storage.** Android deletes the app's private data with it.
   Export a backup first.
6. **This is not on Google Play.** It is built and signed by whoever runs the build command above.
   The default signature is the Android debug key, which is fine for sideloading and not a
   distribution identity.
7. **The Android layer is intentionally thin — and young.** It is a few hundred lines of Java added
   to a web app that has far more tests behind it. Treat the packaging as the newest part of the
   project when you find something odd.
