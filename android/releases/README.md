# Published APK builds

This folder holds builds of the Android app that are meant to be **downloaded and installed**, so
there is one permanent link to hand out instead of asking someone to build the app first.

| File | Version | Size | SHA-256 |
| --- | --- | --- | --- |
| `Lifekit-1.0.0.apk` | 1.0.0 | 269,882 bytes | `e0eb2dad647bacdc58316c92b01d3fc0855189aafb64d24fd61c2cc8b6049682` |

Download link (tap this on the phone):

```
https://github.com/lankapallibenny/Lifekit/raw/main/android/releases/Lifekit-1.0.0.apk
```

Until version 1.0.0 is merged into `main`, use the branch in the URL:

```
https://github.com/lankapallibenny/Lifekit/raw/arena/c664e297-lifekit/android/releases/Lifekit-1.0.0.apk
```

## Why these files are in Git

They are build output, which normally does not belong in a repository — but the whole point of this
folder is a link that works on a phone, and this is the simplest way to have one. The APK is small
(264 KB) and the build is reproducible, so it can always be checked against the source:
`npm run android:apk` from the same commit produces a byte-identical file.

If you would rather keep binaries out of the repository, publish the same file as a GitHub
**release asset** instead (Releases → Draft a new release → attach `Lifekit-<version>.apk`) and
delete the copy here. Release assets are uploaded to `uploads.github.com`, which is why they cannot
be attached by the build script itself.

## Verifying a download

```bash
sha256sum -c Lifekit-1.0.0.apk.sha256      # Linux
shasum -a 256 -c Lifekit-1.0.0.apk.sha256  # macOS
```

Or check the signature of the installed app against this build:

```bash
apksigner verify --print-certs Lifekit-1.0.0.apk
# Signer #1 certificate DN: CN=Android Debug, O=Android, C=US
```

That is the standard Android **debug** key: installable, but not a distribution identity. Builds you
intend to keep should be signed with your own key — see [../README.md](../README.md#signing).
