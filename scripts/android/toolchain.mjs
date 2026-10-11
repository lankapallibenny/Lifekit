/**
 * Locating (and, if necessary, fetching) the tools that turn this project into an APK.
 *
 * LIFEKIT has no build dependencies beyond Node, and the Android build keeps that spirit: the
 * script uses a JDK and Android build tools that are already on the machine when they are there,
 * and otherwise downloads a self-contained set into ~/.cache/lifekit-android-tools:
 *
 *   - java + keytool   from the `jdk4py` PyPI package (a real Temurin JDK, no installer)
 *   - aapt2            from the `aaptjs3` npm package (Linux x64 build of the Android asset tool)
 *   - android.jar, d8.jar, apksigner.jar, ecj-*.jar, debug.keystore
 *                      from the `@drxiaozhi/minapk` npm package, which mirrors the Android
 *                      build-tools that would otherwise come from the Android SDK
 *
 * If you already have a JDK and an Android SDK, set LIFEKIT_ANDROID_TOOLS to a directory holding
 * aapt2 (or aapt2.exe), android.jar, d8.jar, apksigner.jar and ecj-*.jar and nothing is
 * downloaded. See android/README.md.
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, chmodSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { collectToolsFrom } from './toolchain-test-support.mjs';

export const CACHE_DIR = process.env.LIFEKIT_ANDROID_CACHE
  ? resolve(process.env.LIFEKIT_ANDROID_CACHE)
  : join(homedir(), '.cache', 'lifekit-android-tools');

const NPM_REGISTRY = 'https://registry.npmjs.org';
const PYPI_API = 'https://pypi.org/pypi';

export function log(message) {
  process.stdout.write(`${message}\n`);
}

export function step(message) {
  process.stdout.write(`  ${message}\n`);
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  mkdirSync(dirname(destination), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  return destination;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  return response.json();
}

/** Extracts a .tgz (tar) or a .zip/.whl (unzip, falling back to Python) without a shell. */
function extractArchive(archive, into) {
  mkdirSync(into, { recursive: true });
  const tar = spawnSync('tar', ['-xzf', archive, '-C', into], { stdio: 'ignore' });
  if (tar.status === 0) return;
  const unzip = spawnSync('unzip', ['-q', '-o', archive, '-d', into], { stdio: 'ignore' });
  if (unzip.status === 0) return;
  const python = spawnSync('python3', ['-m', 'zipfile', '-e', archive, into], { stdio: 'ignore' });
  if (python.status !== 0) throw new Error(`Could not extract ${archive} (need tar, unzip or python3)`);
}

/* ------------------------------------------------------------------ */
/* java                                                                */
/* ------------------------------------------------------------------ */

function javaFromEnvironment() {
  if (process.env.LIFEKIT_JAVA && existsSync(process.env.LIFEKIT_JAVA)) return process.env.LIFEKIT_JAVA;
  if (process.env.JAVA_HOME) {
    const candidate = join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (existsSync(candidate)) return candidate;
  }
  const probe = spawnSync('java', ['-version'], { stdio: 'ignore' });
  if (probe.status === 0) return 'java';
  return null;
}

/** Path to a `java` binary, downloading a JDK into the cache when the machine has none. */
export async function ensureJava() {
  const existing = javaFromEnvironment();
  if (existing) return { java: existing, downloaded: false };

  const home = join(CACHE_DIR, 'jdk');
  const cached = join(home, 'bin', 'java');
  if (existsSync(cached)) return { java: cached, downloaded: false };

  if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) {
    throw new Error(
      `No JDK found and no automatic download for ${process.platform}/${process.arch}.\n` +
        'Install a JDK 17 or newer and set JAVA_HOME, then run the build again.'
    );
  }

  step('No JDK on this machine — fetching one (jdk4py, ~35 MB, cached for next time)');
  const release = await fetchJson(`${PYPI_API}/jdk4py/json`);
  const wanted = process.arch === 'x64' ? 'x86_64' : 'aarch64';
  const wheel = release.urls.find(
    (file) => file.filename.includes('manylinux') && file.filename.includes(wanted)
  );
  if (!wheel) throw new Error(`jdk4py ${release.info.version} has no Linux ${process.arch} wheel`);

  const archive = join(CACHE_DIR, wheel.filename);
  if (!existsSync(archive)) await download(wheel.url, archive);

  const unpacked = join(CACHE_DIR, '.jdk-unpacked');
  rmSync(unpacked, { recursive: true, force: true });
  extractArchive(archive, unpacked);

  const runtime = join(unpacked, 'jdk4py', 'java-runtime');
  if (!existsSync(join(runtime, 'bin', 'java'))) {
    throw new Error('The downloaded JDK archive did not contain jdk4py/java-runtime');
  }
  rmSync(home, { recursive: true, force: true });
  mkdirSync(dirname(home), { recursive: true });
  renameSync(runtime, home);
  for (const entry of readdirSync(join(home, 'bin'))) {
    chmodSync(join(home, 'bin', entry), 0o755);
  }
  return { java: cached, downloaded: true };
}

/* ------------------------------------------------------------------ */
/* android build tools                                                 */
/* ------------------------------------------------------------------ */

/** A complete set of Android build tools, fetching the npm mirrors if the machine has no SDK. */
export async function ensureAndroidTools() {
  const dir = process.env.LIFEKIT_ANDROID_TOOLS ? resolve(process.env.LIFEKIT_ANDROID_TOOLS) : join(CACHE_DIR, 'android-tools');

  if (process.env.LIFEKIT_ANDROID_TOOLS) {
    const tools = collectToolsFrom(dir);
    if (!tools.complete) {
      throw new Error(
        `LIFEKIT_ANDROID_TOOLS=${dir} does not contain aapt2, android.jar, d8.jar, apksigner.jar and ecj-*.jar`
      );
    }
    return { ...tools, downloaded: false };
  }

  const cached = collectToolsFrom(dir);
  if (cached.complete) return { ...cached, downloaded: false };

  if (process.platform !== 'linux') {
    throw new Error(
      'Automatic tool downloads are only wired up for Linux. Set LIFEKIT_ANDROID_TOOLS to a\n' +
        'directory holding aapt2, android.jar, d8.jar, apksigner.jar and ecj-*.jar (see android/README.md).'
    );
  }
  if (process.arch !== 'x64') {
    throw new Error(
      `The npm mirror of aapt2 is x86_64-only and this machine is ${process.arch}.\n` +
        'Install Android SDK build-tools and point LIFEKIT_ANDROID_TOOLS at that directory\n' +
        '(see android/README.md).'
    );
  }

  mkdirSync(dir, { recursive: true });
  step('No Android build tools found — fetching the npm mirrors (~50 MB, cached for next time)');

  const aaptRelease = await fetchJson(`${NPM_REGISTRY}/aaptjs3`);
  const aaptVersion = aaptRelease['dist-tags'].latest;
  const aaptArchive = await download(aaptRelease.versions[aaptVersion].dist.tarball, join(CACHE_DIR, 'aaptjs3.tgz'));
  const aaptStage = join(CACHE_DIR, '.aapt2');
  rmSync(aaptStage, { recursive: true, force: true });
  extractArchive(aaptArchive, aaptStage);
  const aapt2 = join(aaptStage, 'package', 'bin', 'x64', 'linux', 'aapt2');
  if (!existsSync(aapt2)) throw new Error('The aaptjs3 package layout changed: aapt2 was not found');
  copyFileSync(aapt2, join(dir, 'aapt2'));
  chmodSync(join(dir, 'aapt2'), 0o755);

  const minapkRelease = await fetchJson(`${NPM_REGISTRY}/@drxiaozhi%2fminapk`);
  const minapkVersion = minapkRelease['dist-tags'].latest;
  const minapkArchive = await download(minapkRelease.versions[minapkVersion].dist.tarball, join(CACHE_DIR, 'minapk.tgz'));
  const minapkStage = join(CACHE_DIR, '.minapk');
  rmSync(minapkStage, { recursive: true, force: true });
  extractArchive(minapkArchive, minapkStage);
  const toolsDir = join(minapkStage, 'package', 'tools');
  for (const name of ['android.jar', 'd8.jar', 'apksigner.jar', 'debug.keystore']) {
    if (!existsSync(join(toolsDir, name))) throw new Error(`The minapk package layout changed: ${name} was not found`);
    copyFileSync(join(toolsDir, name), join(dir, name));
  }
  const ecjName = readdirSync(toolsDir).find((entry) => /^ecj-.*\.jar$/.test(entry));
  if (!ecjName) throw new Error('The minapk package layout changed: the ECJ compiler jar was not found');
  copyFileSync(join(toolsDir, ecjName), join(dir, ecjName));

  const tools = collectToolsFrom(dir);
  if (!tools.complete) throw new Error('Tool setup is still incomplete after downloading');
  return { ...tools, downloaded: true };
}

/* ------------------------------------------------------------------ */
/* running tools                                                       */
/* ------------------------------------------------------------------ */

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.slice(0, 3).join(' ')} … exited with status ${result.status}`);
  }
  return result;
}

export function runCapture(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
}

export function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function fileSize(file) {
  return statSync(file).size;
}
