/**
 * Android shell integration.
 *
 * LIFEKIT is a web app first. When it is installed as the Android app
 * (see android/README.md), a small Java bridge is present at `window.LifekitAndroid`, and this
 * module is the only place in the codebase that talks to it. Everything here is progressive
 * enhancement: in a browser, or in a WebView without the bridge, each function falls back to the
 * plain web behaviour it had before.
 *
 * What the shell adds that a WebView cannot do on its own:
 *   * exports (CSV, JSON backup) are written to the device's Downloads/LIFEKIT folder instead of
 *     being handed to a browser download manager that does not exist inside a WebView;
 *   * "Print / Save as PDF" opens Android's print dialog;
 *   * reminders become real system notifications, with the app's sound/vibration settings applied;
 *   * an external link opens in the user's own browser rather than inside the app.
 */

export type NativePermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NativePlatformInfo {
  platform: 'android';
  apiLevel: number;
  versionCode: number;
  versionName: string;
  applicationId: string;
  downloadFolder: string;
}

interface NativeResult {
  ok: boolean;
  error?: string;
  location?: string;
  uri?: string;
  name?: string;
}

interface AndroidBridge {
  platform(): string;
  notificationPermission(): string;
  requestNotificationPermission(): void;
  notify(
    title: string,
    body: string,
    tag: string,
    route: string,
    silent: boolean,
    vibrate: boolean
  ): string;
  saveText(name: string, mime: string, text: string): string;
  shareSavedFile(uri: string, mime: string, name: string): string;
  shareText(subject: string, text: string): string;
  printPage(): string;
  openExternal(url: string): string;
  toast(message: string): void;
}

declare global {
  interface Window {
    LifekitAndroid?: Partial<AndroidBridge>;
    __lifekitNative?: { onPermissionResult?: (state: string) => void };
  }
}

const BRIDGE_METHODS: Array<keyof AndroidBridge> = [
  'platform',
  'notificationPermission',
  'requestNotificationPermission',
  'notify',
  'saveText',
  'shareText',
  'printPage',
  'openExternal',
  'toast',
];

const platformInfoCache = new WeakMap<object, NativePlatformInfo>();
let pendingPermission: ((state: NativePermissionState) => void) | null = null;

/**
 * The Android bridge, or null in a browser / a WebView without it.
 *
 * A positive answer is remembered; a negative one is not, so a page that gains the bridge later
 * (or a test that installs a stand-in) is not stuck with the first answer.
 */
export function getAndroidBridge(): AndroidBridge | null {
  const candidate = typeof window === 'undefined' ? undefined : window.LifekitAndroid;
  // Only accept an object that actually looks like the shell: a page cannot make LIFEKIT think
  // it is the Android app by defining a half-built global.
  if (candidate && BRIDGE_METHODS.every((method) => typeof candidate[method] === 'function')) {
    return candidate as AndroidBridge;
  }
  return null;
}

export function isNativeApp(): boolean {
  return getAndroidBridge() !== null;
}

function callRaw(method: keyof AndroidBridge, ...args: unknown[]): Record<string, unknown> | null {
  const active = getAndroidBridge();
  if (!active) return null;
  try {
    const target = active[method] as (...callArgs: unknown[]) => unknown;
    const raw = target.apply(active, args);
    if (typeof raw !== 'string') return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function call(method: keyof AndroidBridge, ...args: unknown[]): NativeResult {
  const parsed = callRaw(method, ...args);
  if (!parsed) return { ok: false, error: 'the Android app did not answer' };
  return {
    ok: parsed.ok === true,
    error: typeof parsed.error === 'string' ? parsed.error : undefined,
    location: typeof parsed.location === 'string' ? parsed.location : undefined,
    uri: typeof parsed.uri === 'string' ? parsed.uri : undefined,
    name: typeof parsed.name === 'string' ? parsed.name : undefined,
  };
}

/** What the shell says about itself, or null in a browser. */
export function nativePlatformInfo(): NativePlatformInfo | null {
  const active = getAndroidBridge();
  if (!active) return null;
  const known = platformInfoCache.get(active);
  if (known) return known;
  const raw = callRaw('platform');
  if (raw) {
    const info: NativePlatformInfo = {
      platform: 'android',
      apiLevel: Number(raw.apiLevel ?? 0),
      versionCode: Number(raw.versionCode ?? 0),
      versionName: String(raw.versionName ?? ''),
      applicationId: String(raw.applicationId ?? ''),
      downloadFolder: String(raw.downloadFolder ?? 'LIFEKIT'),
    };
    platformInfoCache.set(active, info);
    return info;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* exports                                                             */
/* ------------------------------------------------------------------ */

/**
 * Reads a blob as text. `Blob.text()` is used when it exists and a FileReader is used when it
 * does not: an Android WebView that has not been updated in years does not have it, and an export
 * that silently produces nothing would be worse than a few extra lines here.
 */
function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('the export could not be read'));
    reader.readAsText(blob);
  });
}

/**
 * Saves a text export to the device. Returns null when there is no shell, so callers can fall
 * back to the browser download they have always used.
 */
export async function saveExportToDevice(filename: string, blob: Blob): Promise<NativeResult | null> {
  const active = getAndroidBridge();
  if (!active) return null;
  let text: string;
  try {
    text = await readBlobText(blob);
  } catch {
    return { ok: false, error: 'the export could not be read' };
  }
  return call('saveText', filename, blob.type || 'application/octet-stream', text);
}

/* ------------------------------------------------------------------ */
/* notifications                                                       */
/* ------------------------------------------------------------------ */

/**
 * Android reports "prompt" where the web Notification API says "default"; this maps the shell's
 * answer onto the vocabulary the rest of the app already uses.
 */
export function nativeNotificationPermission(): NativePermissionState {
  const active = getAndroidBridge();
  if (!active) return 'unsupported';
  try {
    const state = active.notificationPermission();
    if (state === 'granted' || state === 'denied') return state;
    if (state === 'prompt' || state === 'default') return 'default';
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/**
 * Installs the one callback Android uses to report the answer to its permission dialog.
 * Idempotent, so both installNativeShell() and a permission request can call it.
 */
function ensurePermissionCallback(): void {
  if (typeof window === 'undefined') return;
  window.__lifekitNative = {
    ...(window.__lifekitNative ?? {}),
    onPermissionResult: (state: string) => {
      if (state === 'granted' || state === 'denied') pendingPermission?.(state);
      else pendingPermission?.('default');
    },
  };
}

/**
 * Asks Android for the notification permission. The answer arrives on the shell's own callback,
 * so this waits for it (with a timeout, because a permission dialog can be dismissed in ways
 * that produce no callback) and never rejects.
 */
export function requestNativeNotificationPermission(): Promise<NativePermissionState> {
  const active = getAndroidBridge();
  if (!active) return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    let settled = false;
    const finish = (state: NativePermissionState) => {
      if (settled) return;
      settled = true;
      pendingPermission = null;
      resolve(state);
    };
    pendingPermission = finish;
    ensurePermissionCallback();
    try {
      active.requestNotificationPermission();
    } catch {
      finish('unsupported');
      return;
    }
    // A permission dialog can be dismissed without any callback; fall back to the real state.
    window.setTimeout(() => finish(nativeNotificationPermission()), 60_000);
  });
}

/** Shows a reminder as a system notification. `null` means "no shell, use the web path". */
export function deliverNativeNotification(
  title: string,
  body: string,
  tag: string,
  options: { route?: string; silent?: boolean; vibrate?: boolean } = {}
): NativeResult | null {
  const active = getAndroidBridge();
  if (!active) return null;
  if (nativeNotificationPermission() !== 'granted') return { ok: false, error: 'permission not granted' };
  return call(
    'notify',
    title,
    body,
    tag,
    options.route ?? '',
    options.silent === true,
    options.vibrate !== false
  );
}

/* ------------------------------------------------------------------ */
/* small shell actions                                                 */
/* ------------------------------------------------------------------ */

export function shareTextNatively(subject: string, text: string): NativeResult | null {
  return getAndroidBridge() ? call('shareText', subject, text) : null;
}

export function printNatively(): NativeResult | null {
  return getAndroidBridge() ? call('printPage') : null;
}

export function openExternalNatively(url: string): NativeResult | null {
  return getAndroidBridge() ? call('openExternal', url) : null;
}

export function toastNatively(message: string): void {
  const active = getAndroidBridge();
  if (active) active.toast(message);
}

/* ------------------------------------------------------------------ */
/* installation                                                        */
/* ------------------------------------------------------------------ */

/**
 * Wires the shell into the app. Called once from main.tsx; does nothing in a browser.
 *
 * `window.print` is replaced because the WebView has no print dialog at all: without this the
 * résumé's "Print / Save as PDF" button would silently do nothing.
 */
export function installNativeShell(): boolean {
  if (!isNativeApp()) return false;

  const originalPrint = window.print?.bind(window);
  window.print = () => {
    const result = printNatively();
    if (result && !result.ok && originalPrint) originalPrint();
  };

  // Android reports the answer to its permission dialog here.
  ensurePermissionCallback();

  return true;
}
