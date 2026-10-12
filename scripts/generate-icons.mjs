/**
 * LIFEKIT web icon generator — zero dependencies.
 *
 * Rasterises the original geometric LIFEKIT mark (three ascending bars and a
 * mint "life dot" on a deep-navy tile) into the PNG files the web app and the PWA
 * manifest use. The drawing code lives in scripts/icon-mark.mjs so the Android launcher
 * icons are generated from exactly the same source (see scripts/android/).
 *
 * Usage:
 *   node scripts/generate-icons.mjs           # write public/icons/
 *   node scripts/generate-icons.mjs --check   # fail if the files on disk have drifted
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMark, encodePng } from './icon-mark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'icons');

/** Maskable artwork keeps a 14% safe margin so launchers can crop it to their own shape. */
const targets = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-192.png', 192, 0.86],
  ['maskable-512.png', 512, 0.86],
  ['favicon-64.png', 64, 1],
];

export function generate({ check = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const problems = [];
  for (const [name, size, scale] of targets) {
    const png = encodePng(renderMark(size, { scale }), size);
    const target = join(OUT, name);
    if (check) {
      const existing = existsSync(target) ? readFileSync(target) : null;
      if (!existing || !existing.equals(png)) problems.push(`public/icons/${name}`);
      continue;
    }
    writeFileSync(target, png);
    console.log(`wrote public/icons/${name} (${size}x${size}, ${png.length} bytes)`);
  }
  return { problems, count: targets.length };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const check = process.argv.includes('--check');
  const result = generate({ check });
  if (check) {
    if (result.problems.length > 0) {
      console.error('Web icons are out of date:');
      for (const path of result.problems) console.error(`  ${path}`);
      console.error('Run: npm run icons');
      process.exitCode = 1;
    } else {
      console.log(`Web icons match the mark (${result.count} files).`);
    }
  }
}
