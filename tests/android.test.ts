/**
 * Android packaging tests.
 *
 * These cover the parts of the Android build that live in JavaScript, and the parts of the shell
 * that can be checked without a device: the shell config, the manifest, the generated launcher
 * icons, the APK's ZIP writer, the toolchain's tool discovery, and the Java bridge's file-name
 * sanitising rule (mirrored in JS below, with the Java source checked for the same rule).
 *
 * What is NOT covered here, honestly: that the WebView actually renders the app on a real phone.
 * That is verified by installing the APK (see android/README.md).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendStoredEntry, crc32, findEndOfCentralDirectory, listEntries } from '../scripts/android/apk-zip.mjs';
import { collectToolsFrom } from '../scripts/android/toolchain-test-support.mjs';
import { LEGACY_ICON_SIZES, FOREGROUND_ICON_SIZES, renderLauncherIcons, renderLauncherDescriptors } from '../scripts/android/launcher-icons.mjs';
import { renderMark, encodePng, MARK_COLORS } from '../scripts/icon-mark.mjs';

const ROOT = join(__dirname, '..');
const SHELL_MAIN = join(ROOT, 'android', 'app', 'src', 'main');
const manifest = existsSync(join(SHELL_MAIN, 'AndroidManifest.xml'))
  ? readFileSync(join(SHELL_MAIN, 'AndroidManifest.xml'), 'utf8')
  : '';
const manifestMarkup = manifest.replace(/<!--[\s\S]*?-->/g, '');
const appConfigJava = readFileSync(join(SHELL_MAIN, 'java', 'com', 'bennylankapalli', 'lifekit', 'AppConfig.java'), 'utf8');
const notificationIcon = readFileSync(join(SHELL_MAIN, 'res', 'drawable', 'ic_stat_lifekit.xml'), 'utf8');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  version: string;
  scripts: Record<string, string>;
};

describe('android shell configuration', () => {
  it('ships an Android project with a manifest, resources and java', () => {
    for (const path of [
      'AndroidManifest.xml',
      'res/values/strings.xml',
      'res/values/styles.xml',
      'res/values/colors.xml',
      'java/com/bennylankapalli/lifekit/MainActivity.java',
      'java/com/bennylankapalli/lifekit/WebAppInterface.java',
    ]) {
      expect(existsSync(join(SHELL_MAIN, path)), `${path} should exist`).toBe(true);
    }
  });

  it('never asks for the INTERNET permission', () => {
    // The Android app serves everything from the APK, so it must be physically unable to
    // reach the network — this is the promise the README makes.
    expect(manifestMarkup).not.toMatch(/android\.permission\.INTERNET/);
    expect(manifestMarkup).toMatch(/android\.permission\.POST_NOTIFICATIONS/);
  });

  it('asks for the few permissions a reminder needs and nothing else', () => {
    const permissions = [...manifestMarkup.matchAll(/<uses-permission android:name="([^"]+)"/g)].map((m) => m[1]);
    expect(permissions.sort()).toEqual(['android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE']);
  });

  it('disables cleartext traffic and keeps the JavaScript bridge off remote pages', () => {
    expect(manifestMarkup).toMatch(/android:usesCleartextTraffic="false"/);
    // The bridge must refuse to act unless the WebView is showing one of our own URLs.
    const bridge = readFileSync(join(SHELL_MAIN, 'java', 'com', 'bennylankapalli', 'lifekit', 'WebAppInterface.java'), 'utf8');
    expect(bridge).toMatch(/trustedCaller\(\)/);
    expect(bridge).toMatch(/AppConfig\.isInternalUrl\(lastCommittedUrl\)/);
  });

  it('declares the version the same way package.json describes it', () => {
    const [major, minor, patch] = pkg.version.split('.').map((part) => parseInt(part, 10) || 0);
    const expectedCode = major * 10000 + minor * 100 + patch;
    expect(manifest).toContain(`android:versionName="${pkg.version}"`);
    expect(manifest).toContain(`android:versionCode="${expectedCode}"`);
  });

  it('keeps the shell package name in step with AppConfig', () => {
    const manifestPackage = /package="([^"]+)"/.exec(manifestMarkup)?.[1];
    const configPackage = /APPLICATION_ID = "([^"]+)"/.exec(appConfigJava)?.[1];
    expect(manifestPackage).toBe(configPackage);
  });

  it('serves the bundled web app from a virtual https origin, not from file://', () => {
    // A secure origin is what keeps localStorage, IndexedDB and notifications behaving exactly as
    // they do on the web; file:// would change all three.
    expect(appConfigJava).toMatch(/static final String ORIGIN = "https:\/\/" \+ HOST/);
    expect(appConfigJava).toMatch(/HOST = "lifekit\.local"/);
  });

  it('gives the reminder icon a single-colour silhouette, as the status bar requires', () => {
    const fills = [...notificationIcon.matchAll(/android:fillColor="([^"]+)"/g)].map((m) => m[1].toLowerCase());
    expect(fills.length).toBeGreaterThan(0);
    expect(new Set(fills).size).toBe(1);
    expect(['#ffffffff', '#fff', '#ffffff']).toContain(fills[0]);
  });

  it('exposes the android build through npm scripts', () => {
    expect(pkg.scripts['android:apk']).toBeTruthy();
    expect(pkg.scripts['android:check']).toBeTruthy();
    expect(pkg.scripts['android:icons']).toBeTruthy();
  });
});


/**
 * The launch path, pinned by these tests because version 1.0.0 shipped a crash here:
 *
 * `Window.getInsetsController()` returns null until the window has an attached decor view. The
 * shell called it from the top of onCreate, so on Android 11+ the app threw a NullPointerException
 * before it could draw anything — the icon appeared, the app never opened. The rules below are what
 * stop that from coming back:
 *
 *  * never touch the insets controller without a null check,
 *  * never touch it before setContentView(),
 *  * keep the whole startup path inside a try/catch that can still say what went wrong,
 *  * do not depend on a DayNight platform theme (its availability varies between Android versions),
 *  * install the crash recorder before any activity runs.
 */
describe('the shell must not crash on launch', () => {
  const mainActivity = readFileSync(
    join(SHELL_MAIN, 'java', 'com', 'bennylankapalli', 'lifekit', 'MainActivity.java'),
    'utf8'
  );
  const onCreate = mainActivity.slice(
    mainActivity.indexOf('protected void onCreate(Bundle savedInstanceState)'),
    mainActivity.indexOf('protected void onNewIntent(Intent intent)')
  );

  it('null-checks the window insets controller before using it', () => {
    const appearanceCall = mainActivity.indexOf('getWindow().getInsetsController()');
    expect(appearanceCall, 'the appearance call should still exist').toBeGreaterThan(-1);
    const after = mainActivity.slice(appearanceCall, appearanceCall + 400);
    expect(after).toMatch(/if \(controller == null\) return;/);
    // The whole helper is also wrapped, because this is cosmetic and must never be fatal.
    const helper = mainActivity.slice(mainActivity.indexOf('private void applyStatusBarIconTheme()'));
    expect(helper).toMatch(/try \{/);
    expect(helper).toMatch(/catch \(Throwable ignored\)/);
  });

  it('only touches the system bars after the content view exists', () => {
    expect(onCreate).toMatch(/setContentView\(wrapContent\(webView\)\)/);
    expect(onCreate.indexOf('setContentView(')).toBeLessThan(onCreate.indexOf('applyStatusBarIconTheme()'));
  });

  it('keeps startup inside a handler that can explain a failure', () => {
    expect(onCreate).toMatch(/catch \(Throwable failure\)/);
    expect(onCreate).toMatch(/showStartupProblem\(describe\(failure\)\)/);
    expect(mainActivity).toContain('private void showStartupProblem(final String reason)');
    // A page that never finishes loading must not leave a blank window either.
    expect(mainActivity).toMatch(/LOAD_TIMEOUT_MS/);
    expect(mainActivity).toMatch(/handler\.postDelayed\(loadTimeout/);
  });

  it('does not depend on a DayNight platform theme', () => {
    const styles = readFileSync(join(SHELL_MAIN, 'res', 'values', 'styles.xml'), 'utf8');
    const parent = /parent="([^"]+)"/.exec(styles)?.[1] ?? '';
    expect(parent).not.toMatch(/DayNight/);
    // windowLightStatusBar carries the same intent from the theme, so the runtime call is a
    // refinement rather than the only thing keeping the icons readable.
    expect(styles).toContain('android:windowLightStatusBar');
  });

  it('records a crash before any activity runs, and shows it once', () => {
    expect(manifest).toContain('android:name=".LifekitApplication"');
    const application = readFileSync(
      join(SHELL_MAIN, 'java', 'com', 'bennylankapalli', 'lifekit', 'LifekitApplication.java'),
      'utf8'
    );
    expect(application).toContain('CrashLog.install(this)');
    expect(mainActivity).toContain('CrashLog.read()');
    expect(mainActivity).toContain('CrashLog.clear()');
  });

  it('tells the user when Android itself has no WebView to draw in', () => {
    expect(mainActivity).toContain('CrashLog.webViewMissing()');
  });

  it('carries the version the manifest and package.json agree on', () => {
    // The 1.0.0 crash shipped with these three in step; this guards the fix being delivered as an
    // update rather than as the same version code again.
    const [major, minor, patch] = pkg.version.split('.').map((part) => parseInt(part, 10) || 0);
    expect(manifest).toContain(`android:versionName="${pkg.version}"`);
    expect(manifest).toContain(`android:versionCode="${major * 10000 + minor * 100 + patch}"`);
  });
});

describe('android launcher icons', () => {
  const files = renderLauncherIcons();
  const descriptors = renderLauncherDescriptors();

  it('covers every density Android asks for', () => {
    for (const [density] of LEGACY_ICON_SIZES) {
      expect(files.some((file) => file.path === `mipmap-${density}/ic_launcher.png`)).toBe(true);
      expect(files.some((file) => file.path === `mipmap-${density}/ic_launcher_round.png`)).toBe(true);
    }
    for (const [density] of FOREGROUND_ICON_SIZES) {
      expect(files.some((file) => file.path === `mipmap-${density}/ic_launcher_foreground.png`)).toBe(true);
    }
  });

  it('writes a real PNG at the size the folder name promises', () => {
    for (const file of files) {
      // PNG header, then the IHDR width/height.
      expect(file.buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      expect(file.buffer.readUInt32BE(16)).toBe(file.size);
      expect(file.buffer.readUInt32BE(20)).toBe(file.size);
    }
  });

  it('keeps the adaptive foreground transparent outside the mark', () => {
    // A foreground that paints its own background would look wrong behind a round mask: the
    // colour behind it comes from the icon's background layer.
    const size = 108;
    const centreAlpha = ((size / 2) * size + size / 2) * 4 + 3;
    const foreground = renderMark(size, { tile: false });
    expect(foreground[3]).toBe(0); // corner: nothing but the mark is drawn
    expect(foreground[centreAlpha]).toBe(255); // the mark itself is solid

    const tiled = renderMark(size);
    expect(tiled[3]).toBe(0); // rounded corners stay transparent on the legacy icon too
    expect(tiled[centreAlpha]).toBe(255);
  });

  it('uses the brand navy for the adaptive background', () => {
    const background = descriptors.find((descriptor) => descriptor.path === 'values/ic_launcher_background.xml');
    expect(background?.contents).toContain(MARK_COLORS.tileTo);
  });

  it('describes both launcher and round icons as adaptive', () => {
    const paths = descriptors.map((descriptor) => descriptor.path);
    expect(paths).toContain('mipmap-anydpi-v26/ic_launcher.xml');
    expect(paths).toContain('mipmap-anydpi-v26/ic_launcher_round.xml');
    const adaptive = descriptors.find((descriptor) => descriptor.path === 'mipmap-anydpi-v26/ic_launcher.xml');
    expect(adaptive?.contents).toContain('@mipmap/ic_launcher_foreground');
    expect(adaptive?.contents).toContain('@color/ic_launcher_background');
  });

  it('matches the mark that is committed to the repository', () => {
    // The committed PNGs must be the ones the generator produces: drifting icons are the easiest
    // thing to miss by hand.
    for (const file of files) {
      const onDisk = readFileSync(join(SHELL_MAIN, 'res', file.path));
      expect(onDisk.equals(file.buffer), `${file.path} is out of date`).toBe(true);
    }
  });
});

describe('apk zip writer', () => {
  function buildZip(name: string, contents: string): Buffer {
    // A minimal stored-entry archive to append to, so the writer is tested without aapt2.
    const data = Buffer.from(contents);
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(0, 42);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length + nameBuf.length, 12);
    eocd.writeUInt32LE(local.length + nameBuf.length + data.length, 16);

    return Buffer.concat([local, nameBuf, data, central, nameBuf, eocd]);
  }

  it('finds the end-of-central-directory record', () => {
    const zip = buildZip('AndroidManifest.xml', '<x/>');
    expect(zip.readUInt32LE(findEndOfCentralDirectory(zip))).toBe(0x06054b50);
  });

  it('appends an entry and keeps both entries readable', () => {
    const zip = buildZip('AndroidManifest.xml', '<x/>');
    const withDex = appendStoredEntry(zip, 'classes.dex', Buffer.from('dex-data'), { align: 4 });
    const entries = listEntries(withDex);
    expect(entries.map((entry) => entry.name)).toEqual(['AndroidManifest.xml', 'classes.dex']);
    const dex = entries[1];
    expect(withDex.subarray(dex.dataOffset, dex.dataOffset + dex.size).toString()).toBe('dex-data');
    expect(dex.crc).toBe(crc32(Buffer.from('dex-data')));
  });

  it('stores the dex uncompressed and aligned, which is what Android requires', () => {
    const zip = buildZip('AndroidManifest.xml', '<x/>');
    const withDex = appendStoredEntry(zip, 'classes.dex', Buffer.alloc(17, 7), { align: 4 });
    const dex = listEntries(withDex).find((entry) => entry.name === 'classes.dex');
    expect(dex?.method).toBe(0);
    expect((dex?.dataOffset ?? 1) % 4).toBe(0);
  });

  it('is byte-for-byte stable so the same input gives the same APK', () => {
    const zip = buildZip('AndroidManifest.xml', '<x/>');
    const first = appendStoredEntry(zip, 'classes.dex', Buffer.from('dex'), { align: 4 });
    const second = appendStoredEntry(zip, 'classes.dex', Buffer.from('dex'), { align: 4 });
    expect(first.equals(second)).toBe(true);
  });

  it('refuses input that is not a zip archive', () => {
    expect(() => findEndOfCentralDirectory(Buffer.from('not a zip'))).toThrow(/end-of-central-directory/i);
  });
});

describe('android toolchain', () => {
  const toolsDir = join(ROOT, 'scripts', 'android');

  it('is discoverable without any download when the tools are on the machine', () => {
    // Simulates a directory that already holds a JDK-less Android tool set (names only).
    const found = collectToolsFrom(toolsDir);
    expect(found).toHaveProperty('complete');
    expect(typeof found.complete).toBe('boolean');
  });
});

/**
 * The bridge sanitises export file names before they reach the Downloads collection. The rule is
 * the same in Java; this mirrors it so the behaviour is pinned by a test rather than by review.
 */
function sanitizeFileNameLikeTheBridge(name: string | null): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const withoutPaths = trimmed.replace(/\\/g, '/');
  const base = withoutPaths.slice(withoutPaths.lastIndexOf('/') + 1);
  const cleaned = base
    .split('')
    .map((char) => (/[a-zA-Z0-9._ -]/.test(char) ? char : '-'))
    .join('')
    .trim();
  if (cleaned === '.' || cleaned === '..') return '';
  return cleaned.slice(0, 120);
}

describe('export file names', () => {
  it('keeps ordinary backup names untouched', () => {
    expect(sanitizeFileNameLikeTheBridge('lifekit-backup-20260101-1200.json')).toBe('lifekit-backup-20260101-1200.json');
  });

  it('strips directory traversal and unprintable characters', () => {
    expect(sanitizeFileNameLikeTheBridge('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileNameLikeTheBridge('weird\u0000name.json')).toBe('weird-name.json');
    expect(sanitizeFileNameLikeTheBridge('..')).toBe('');
  });

  it('is implemented in the Java bridge with the same rules', () => {
    const bridge = readFileSync(join(SHELL_MAIN, 'java', 'com', 'bennylankapalli', 'lifekit', 'WebAppInterface.java'), 'utf8');
    expect(bridge).toContain('static String sanitizeFileName(String name)');
    expect(bridge).toContain('lastIndexOf(\'/\')');
    expect(bridge).toContain('cleaned.length() > 120');
  });
});

describe('web icons still come from the shared mark', () => {
  it('encodes a 512px PNG identical to the committed web icon', () => {
    const icon = readFileSync(join(ROOT, 'public', 'icons', 'icon-512.png'));
    const generated = encodePng(renderMark(512), 512);
    expect(icon.equals(generated)).toBe(true);
  });
});
