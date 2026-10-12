# Published APK builds

Builds of the Android app that are meant to be **downloaded and installed**, so there is one link
to hand out instead of asking someone to build the app first.

| File | Version | Size | SHA-256 |
| --- | --- | --- | --- |
| `Lifekit-1.0.1.apk` | 1.0.1 | 273,979 bytes | `3a4c88bf796f328f8c1180311cc785611f7b6fc28b24a427abd093379955f865` |

Download link (open this on the phone):

```
https://github.com/lankapallibenny/Lifekit/raw/main/android/releases/Lifekit-1.0.1.apk
```

Until version 1.0.1 reaches `main`, use the branch in the URL:

```
https://github.com/lankapallibenny/Lifekit/raw/arena/c664e297-lifekit/android/releases/Lifekit-1.0.1.apk
```

## Version history

| Version | Status | Notes |
| --- | --- | --- |
| 1.0.1 | **current** | Fixes the launch crash described below. Adds a crash report screen and a startup diagnostic screen. |
| 1.0.0 | **withdrawn** | Installed and showed its icon, but crashed immediately on launch on Android 11 (API 30) and newer: the shell read `Window.getInsetsController()` before the window had a content view, which returns null and threw a `NullPointerException` during `onCreate`. The file is no longer published here — install 1.0.1 instead. |

## Why these files are in Git

They are build output, which normally does not belong in a repository — but the whole point of this
folder is a link that works on a phone, and this is the simplest way to have one. Each APK is small
(around 270 KB) and the build is reproducible, so any file here can be checked against the source:
`npm run android:apk` from the same commit produces a byte-identical file.

If you would rather keep binaries out of the repository, publish the same file as a GitHub
**release asset** instead (Releases → Draft a new release → attach `Lifekit-<version>.apk`) and
delete the copy here. Release assets are uploaded to `uploads.github.com`, which is why the build
script cannot attach them itself.

## Verifying a download

```bash
sha256sum -c Lifekit-1.0.1.apk.sha256      # Linux
shasum -a 256 -c Lifekit-1.0.1.apk.sha256  # macOS
```

Or check the signature of the APK you downloaded:

```bash
apksigner verify --print-certs Lifekit-1.0.1.apk
# Signer #1 certificate DN: CN=Android Debug, O=Android, C=US
```

That is the standard Android **debug** key: installable, but not a distribution identity. Builds you
intend to keep should be signed with your own key — see [../README.md](../README.md#signing).
