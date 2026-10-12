/**
 * Writes the Android launcher icons into android/app/src/main/res/.
 *
 * Usage:
 *   node scripts/android/generate-launcher-icons.mjs            # write
 *   node scripts/android/generate-launcher-icons.mjs --check    # verify nothing drifted
 *
 * `--check` is what CI (and tests/android.test.ts) use: it fails if the committed PNGs no
 * longer match the mark, which is the only way the two could silently disagree.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderLauncherIcons, renderLauncherDescriptors } from './launcher-icons.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RES_DIR = join(HERE, '..', '..', 'android', 'app', 'src', 'main', 'res');

export function generate({ check = false, resDir = RES_DIR } = {}) {
  const files = renderLauncherIcons();
  const descriptors = renderLauncherDescriptors();
  const problems = [];

  for (const file of files) {
    const target = join(resDir, file.path);
    if (check) {
      const existing = existsSync(target) ? readFileSync(target) : null;
      if (!existing || !existing.equals(file.buffer)) problems.push(file.path);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.buffer);
  }

  for (const descriptor of descriptors) {
    const target = join(resDir, descriptor.path);
    if (check) {
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (existing !== descriptor.contents) problems.push(descriptor.path);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, descriptor.contents);
  }

  return { written: files.length + descriptors.length, pngs: files.length, descriptors: descriptors.length, problems };
}

function main(argv) {
  const check = argv.includes('--check');
  const result = generate({ check });
  if (check) {
    if (result.problems.length > 0) {
      console.error('Android launcher icons are out of date:');
      for (const path of result.problems) console.error(`  ${path}`);
      console.error('Run: npm run android:icons');
      process.exitCode = 1;
      return;
    }
    console.log(`Android launcher icons match the mark (${result.written} files).`);
    return;
  }
  console.log(`Wrote ${result.pngs} launcher PNGs and ${result.descriptors} descriptors into android/app/src/main/res/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
