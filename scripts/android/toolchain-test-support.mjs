/**
 * Test-only slice of toolchain.mjs.
 *
 * scripts/android/toolchain.mjs is written for a Node process that may download things; importing
 * it from a test would drag that in. Rather than export internals just for tests, the one function
 * the tests need lives here, and toolchain.mjs imports it. Tests import it too.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Finds the Android build tools in a directory, or reports what is missing. */
export function collectToolsFrom(dir) {
  const entries = existsSync(dir) ? readdirSync(dir) : [];
  const pick = (names) => {
    const found = entries.find((entry) => names.includes(entry.toLowerCase()));
    return found ? join(dir, found) : null;
  };
  const ecj = entries.find((entry) => /^ecj-.*\.jar$/i.test(entry));
  const aapt2 = pick(['aapt2', 'aapt2.exe']);
  const androidJar = pick(['android.jar']);
  const d8Jar = pick(['d8.jar']);
  const apksignerJar = pick(['apksigner.jar']);
  const ecjJar = ecj ? join(dir, ecj) : null;
  return {
    dir,
    aapt2,
    androidJar,
    d8Jar,
    apksignerJar,
    ecjJar,
    debugKeystore: pick(['debug.keystore']),
    /** True when every tool the build needs was found. */
    complete: Boolean(aapt2 && androidJar && d8Jar && apksignerJar && ecjJar),
  };
}
