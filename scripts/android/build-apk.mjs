/**
 * Builds the LIFEKIT Android APK.
 *
 *   npm run android:apk                 # full build -> dist-android/Lifekit-<version>.apk
 *   npm run android:check               # verify the shell's config and icons, build nothing
 *
 * What it does, in order:
 *   1. checks that the shell's config, the manifest and the launcher icons all agree
 *   2. builds the web app with vite.android.config.ts (root-absolute asset paths, service worker
 *      off, kept out of dist/ so it cannot overwrite the web build)
 *   3. copies android/app/src/main into a scratch directory, stamps the version from package.json
 *      and generates BuildConfig.java plus R.java
 *   4. runs aapt2 (resources), ECJ (java), d8 (dex)
 *   5. appends classes.dex to the aapt2 archive, 4-byte aligned and stored (i.e. the part
 *      zipalign would normally do)
 *   6. signs the APK and verifies the signature, then prints what was produced
 *
 * No Android SDK, no Gradle and no JDK are required up front: scripts/android/toolchain.mjs
 * fetches what is missing into ~/.cache/lifekit-android-tools and reuses it afterwards.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAndroidTools, ensureJava, fileSize, log, run, runCapture, sha256, step } from './toolchain.mjs';
import { appendStoredEntry, listEntries } from './apk-zip.mjs';
import { generate as generateIcons } from './generate-launcher-icons.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SHELL_MAIN = join(ROOT, 'android', 'app', 'src', 'main');
const WORK = join(ROOT, '.android-build');
const PROJECT = join(WORK, 'project');
const OUT_DIR = join(ROOT, 'dist-android');
const APP_NAME = 'LIFEKIT';
const MIN_SDK = 29;
const TARGET_SDK = 34;
const DEBUG_KEYSTORE = { alias: 'androiddebugkey', storePass: 'android', keyPass: 'android' };

/* ------------------------------------------------------------------ */
/* project facts                                                       */
/* ------------------------------------------------------------------ */

function readProjectFacts() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const manifest = readFileSync(join(SHELL_MAIN, 'AndroidManifest.xml'), 'utf8');
  const appConfig = readFileSync(
    join(SHELL_MAIN, 'java', 'com', 'bennylankapalli', 'lifekit', 'AppConfig.java'),
    'utf8'
  );
  const manifestPackage = /package="([^"]+)"/.exec(manifest)?.[1];
  const manifestVersionCode = /android:versionCode="(\d+)"/.exec(manifest)?.[1];
  const manifestVersionName = /android:versionName="([^"]+)"/.exec(manifest)?.[1];
  const configPackage = /APPLICATION_ID = "([^"]+)"/.exec(appConfig)?.[1];
  const [major, minor, patch] = pkg.version.split('.').map((part) => parseInt(part, 10) || 0);
  return {
    name: APP_NAME,
    version: pkg.version,
    versionCode: String(major * 10000 + minor * 100 + patch),
    packageName: manifestPackage,
    configPackage,
    manifestVersionCode,
    manifestVersionName,
    manifest,
  };
}

/** Everything the build would silently get wrong, checked before it starts working. */
export function verifyProject() {
  const facts = readProjectFacts();
  const problems = [];

  if (!facts.packageName) problems.push('AndroidManifest.xml has no package attribute');
  if (facts.packageName !== facts.configPackage) {
    problems.push(`AppConfig.APPLICATION_ID (${facts.configPackage}) does not match the manifest package (${facts.packageName})`);
  }
  if (facts.manifestVersionName !== facts.version) {
    problems.push(`manifest versionName (${facts.manifestVersionName}) does not match package.json version (${facts.version})`);
  }
  if (facts.manifestVersionCode !== facts.versionCode) {
    problems.push(`manifest versionCode (${facts.manifestVersionCode}) does not match the derived code (${facts.versionCode})`);
  }
  const manifestMarkup = facts.manifest.replace(/<!--[\s\S]*?-->/g, '');
  if (/<uses-permission[^>]*android:name="android\.permission\.INTERNET"/.test(manifestMarkup)) {
    problems.push('the manifest asks for INTERNET — the Android app is meant to be unable to reach the network');
  }
  const icons = generateIcons({ check: true });
  for (const path of icons.problems) problems.push(`launcher icon out of date: ${path}`);

  return { facts, problems };
}

/* ------------------------------------------------------------------ */
/* build                                                               */
/* ------------------------------------------------------------------ */

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function webBuildIsPresent() {
  return existsSync(join(SHELL_MAIN, 'assets', 'www', 'index.html'));
}

function buildWebApp() {
  log('1/6  Building the web app for Android');
  const result = runCapture('npx', ['vite', 'build', '--config', 'vite.android.config.ts'], { cwd: ROOT });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error('The web build for Android failed.');
  }
  for (const line of (result.stdout ?? '').split('\n')) {
    if (line.includes('built in') || line.includes('assets/')) step(line.trim());
  }
  if (!webBuildIsPresent()) throw new Error('The web build did not produce assets/www/index.html');
  // vite.android.config.ts removes the service worker from the Android build; if that ever
  // regresses, the APK would carry a second, unused cache.
  for (const unwanted of ['sw.js', 'precache-manifest.json']) {
    if (existsSync(join(SHELL_MAIN, 'assets', 'www', unwanted))) {
      throw new Error(`The Android web build still contains ${unwanted}, which the shell does not use`);
    }
  }
}

function prepareProject(facts) {
  log('2/6  Preparing the Android project');
  rmSync(PROJECT, { recursive: true, force: true });
  mkdirSync(PROJECT, { recursive: true });
  cpSync(SHELL_MAIN, PROJECT, { recursive: true });

  // Stamp the version from package.json into the manifest copy (the checked-in manifest carries
  // the same values; a test asserts they match, this is what makes it impossible to drift).
  const manifestPath = join(PROJECT, 'AndroidManifest.xml');
  const manifest = readFileSync(manifestPath, 'utf8')
    .replace(/android:versionCode="\d+"/, `android:versionCode="${facts.versionCode}"`)
    .replace(/android:versionName="[^"]+"/, `android:versionName="${facts.version}"`);
  writeFileSync(manifestPath, manifest);

  const stringsPath = join(PROJECT, 'res', 'values', 'strings.xml');
  writeFileSync(
    stringsPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by scripts/android/build-apk.mjs -->\n<resources>\n    <string name="app_name">${facts.name}</string>\n</resources>\n`
  );

  const packageDir = facts.packageName.split('.').join('/');
  const buildConfigDir = join(PROJECT, 'java', packageDir);
  mkdirSync(buildConfigDir, { recursive: true });
  writeFileSync(
    join(buildConfigDir, 'BuildConfig.java'),
    `package ${facts.packageName};\n\n` +
      '/** Generated by scripts/android/build-apk.mjs from package.json — do not edit. */\n' +
      'public final class BuildConfig {\n' +
      '    private BuildConfig() {}\n\n' +
      `    public static final String APPLICATION_ID = "${facts.packageName}";\n` +
      `    public static final int VERSION_CODE = ${facts.versionCode};\n` +
      `    public static final String VERSION_NAME = "${facts.version}";\n` +
      '}\n'
  );
  step(`package ${facts.packageName}, version ${facts.version} (code ${facts.versionCode})`);
}

function compileResources(tools, facts) {
  log('3/6  Compiling resources and java');
  const compiled = join(WORK, 'resources.zip');
  run(tools.aapt2, ['compile', '--dir', join(PROJECT, 'res'), '-o', compiled]);

  const linked = join(WORK, 'linked.apk');
  run(tools.aapt2, [
    'link',
    '-o', linked,
    '-I', tools.androidJar,
    '--manifest', join(PROJECT, 'AndroidManifest.xml'),
    '-A', join(PROJECT, 'assets'),
    '--java', join(WORK, 'gen'),
    '--min-sdk-version', String(MIN_SDK),
    '--target-sdk-version', String(TARGET_SDK),
    '--no-version-vectors',
    compiled,
  ]);
  step('resources → linked.apk (manifest, resources.arsc, assets, generated R.java)');
  return linked;
}

function listFiles(dir, suffix, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, suffix, found);
    else if (full.endsWith(suffix)) found.push(full);
  }
  return found;
}

function compileJava(tools) {
  const classes = join(WORK, 'classes');
  mkdirSync(classes, { recursive: true });
  const sources = [...listFiles(join(WORK, 'gen'), '.java'), ...listFiles(join(PROJECT, 'java'), '.java')];
  run(tools.java, [
    '-jar', tools.ecjJar,
    '-source', '8', '-target', '8',
    '-encoding', 'UTF-8',
    '-nowarn',
    '-bootclasspath', tools.androidJar,
    '-classpath', tools.androidJar,
    '-d', classes,
    ...sources,
  ]);
  step(`java → ${sources.length} source files compiled (${relative(ROOT, classes)})`);
  return classes;
}

function compileDex(tools, classes) {
  const dexDir = join(WORK, 'dex');
  mkdirSync(dexDir, { recursive: true });
  const classFiles = listFiles(classes, '.class');
  run(tools.java, [
    '-cp', tools.d8Jar,
    'com.android.tools.r8.D8',
    '--min-api', String(MIN_SDK),
    '--lib', tools.androidJar,
    '--output', dexDir,
    ...classFiles,
  ]);
  const dex = join(dexDir, 'classes.dex');
  if (!existsSync(dex)) throw new Error('d8 produced no classes.dex');
  step(`classes → classes.dex (${fileSize(dex)} bytes)`);
  return dex;
}

function packageApk(linked, dex) {
  log('4/6  Packaging the APK');
  const unsigned = join(WORK, 'unsigned.apk');
  const withDex = appendStoredEntry(readFileSync(linked), 'classes.dex', readFileSync(dex), { align: 4 });
  writeFileSync(unsigned, withDex);

  // Self-check: the DEX must be stored and 4-byte aligned, and the web app must be inside.
  const entries = listEntries(withDex);
  const dexEntry = entries.find((entry) => entry.name === 'classes.dex');
  if (!dexEntry) throw new Error('classes.dex is missing from the packaged APK');
  if (dexEntry.method !== 0) throw new Error('classes.dex must be stored uncompressed');
  if (dexEntry.dataOffset % 4 !== 0) throw new Error('classes.dex must start on a 4-byte boundary');
  const index = entries.find((entry) => entry.name === 'assets/www/index.html');
  if (!index) throw new Error('the web app is missing from the APK (assets/www/index.html)');
  const assetCount = entries.filter((entry) => entry.name.startsWith('assets/www/')).length;
  step(`classes.dex stored at offset ${dexEntry.dataOffset} (4-byte aligned), ${assetCount} web assets bundled`);
  return unsigned;
}

function signApk(tools, facts, unsigned) {
  log('5/6  Signing the APK');
  const keystore = option('--keystore') ?? tools.debugKeystore;
  const alias = option('--ks-alias') ?? DEBUG_KEYSTORE.alias;
  const storePass = option('--ks-pass') ?? DEBUG_KEYSTORE.storePass;
  const keyPass = option('--key-pass') ?? DEBUG_KEYSTORE.keyPass;
  if (!keystore || !existsSync(keystore)) throw new Error('No keystore available for signing.');

  mkdirSync(OUT_DIR, { recursive: true });
  const output = option('--out') ?? join(OUT_DIR, `Lifekit-${facts.version}.apk`);
  run(tools.java, [
    '-jar', tools.apksignerJar, 'sign',
    '--ks', keystore,
    '--ks-key-alias', alias,
    '--ks-pass', `pass:${storePass}`,
    '--key-pass', `pass:${keyPass}`,
    '--v1-signing-enabled', 'false',
    '--v2-signing-enabled', 'true',
    '--v3-signing-enabled', 'true',
    '--v4-signing-enabled', 'false',
    '--out', output,
    unsigned,
  ]);
  if (keystore === tools.debugKeystore) {
    step('signed with the Android debug key — installable, but not a key for a store release');
  } else {
    step(`signed with ${keystore}`);
  }
  return output;
}

function report(tools, output) {
  log('6/6  Verifying');
  const verify = runCapture(tools.java, ['-jar', tools.apksignerJar, 'verify', '--verbose', '--print-certs', output]);
  const verification = `${verify.stdout ?? ''}`;
  if (verify.status !== 0) {
    process.stdout.write(verification);
    process.stderr.write(verify.stderr ?? '');
    throw new Error('apksigner could not verify the APK it just produced.');
  }
  const schemes = ['v1', 'v2', 'v3']
    .map((scheme) => {
      const line = verification.split('\n').find((row) => row.includes(`Verified using ${scheme} scheme`));
      return line ? `${scheme}:${line.trim().endsWith('true') ? 'yes' : 'no'}` : null;
    })
    .filter(Boolean);
  const signer = /Signer #1 certificate DN: (.*)/.exec(verification)?.[1] ?? 'unknown';
  step(`signature verified (${schemes.join(', ')}), signer ${signer}`);

  const badging = runCapture(tools.aapt2, ['dump', 'badging', output]);
  const bounds = (badging.stdout ?? '')
    .split('\n')
    .filter((line) => /^(package|minSdkVersion|targetSdkVersion|uses-permission|launchable-activity|application-label)/.test(line));
  for (const line of bounds) step(line.trim());

  const size = fileSize(output);
  const digest = sha256(output);
  writeFileSync(`${output}.sha256`, `${digest}  ${output.split('/').pop()}\n`);
  log('');
  log(`APK:    ${relative(ROOT, output)}`);
  log(`Size:   ${(size / 1024).toFixed(1)} KB (${size} bytes)`);
  log(`SHA256: ${digest}`);
}

async function main() {
  const facts = readProjectFacts();

  if (hasFlag('--check')) {
    const { problems } = verifyProject();
    if (problems.length > 0) {
      log('Android shell checks failed:');
      for (const problem of problems) log(`  ✗ ${problem}`);
      process.exitCode = 1;
      return;
    }
    log('Android shell checks passed (config, manifest, launcher icons).');
    return;
  }

  log(`${APP_NAME} Android build — version ${facts.version}`);
  const { problems } = verifyProject();
  if (problems.length > 0) {
    log('Refusing to build; fix these first:');
    for (const problem of problems) log(`  ✗ ${problem}`);
    process.exitCode = 1;
    return;
  }

  const java = await ensureJava();
  const tools = await ensureAndroidTools();
  const toolchain = { ...tools, java: java.java };
  step(`java ${java.java}${java.downloaded ? ' (fetched)' : ''}`);
  step(`tools ${tools.dir}${tools.downloaded ? ' (fetched)' : ''}`);

  if (hasFlag('--skip-web')) {
    log('1/6  Skipping the web build (--skip-web)');
    if (!webBuildIsPresent()) throw new Error('--skip-web was asked for, but assets/www is empty');
  } else {
    buildWebApp();
  }

  prepareProject(facts);
  const linked = compileResources(toolchain, facts);
  const classes = compileJava(toolchain);
  const dex = compileDex(toolchain, classes);
  const unsigned = packageApk(linked, dex);
  const output = signApk(toolchain, facts, unsigned);
  report(toolchain, output);

  if (!hasFlag('--keep')) rmSync(WORK, { recursive: true, force: true });
  else log(`\nIntermediate files kept in ${relative(ROOT, WORK)}`);
}

main().catch((error) => {
  log(`\nAndroid build failed: ${error.message}`);
  process.exitCode = 1;
});
