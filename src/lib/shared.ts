import { isNativeApp, saveExportToDevice, toastNatively } from './native';

/** Tiny shared helpers kept separate so `csv.ts` and `backup.ts` avoid import cycles. */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODateFallback(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function createId(prefix = ''): string {
  const base =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${base}` : base;
}

export function cleanText(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return '';
  // Only strings and numbers are meaningful text. Anything else (objects, arrays, functions)
  // would stringify to "[object Object]" or similar junk, so it becomes an empty value.
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function cleanMultiline(value: unknown, maxLength = 4000): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/** True when a parsed JSON object contains a prototype-polluting key anywhere. */
export function hasUnsafeKeys(value: unknown, depth = 0): boolean {
  if (depth > 12 || value === null || typeof value !== 'object') return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
    if (hasUnsafeKeys((value as Record<string, unknown>)[key], depth + 1)) return true;
  }
  return false;
}

/**
 * Save a generated blob without any server round-trip.
 *
 * In a browser this is an ordinary download. Inside the Android app there is no browser download
 * manager, so the same call writes the file into the device's Downloads/LIFEKIT folder through
 * the shell's bridge (see src/lib/native.ts). Both paths keep the data on the device.
 */
export function downloadBlob(filename: string, blob: Blob): void {
  if (isNativeApp()) {
    void saveExportToDevice(filename, blob).then((result) => {
      if (result && !result.ok) {
        toastNatively(`Could not save ${filename}${result.error ? `: ${result.error}` : ''}`);
      }
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment with the object URL before revoking it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function fileStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
