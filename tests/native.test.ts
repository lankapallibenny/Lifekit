/**
 * Native (Android shell) integration tests.
 *
 * The shell is optional by design: everything in src/lib/native.ts has to be a no-op in a browser.
 * These tests run in jsdom (i.e. with no bridge) and then again with a fake bridge installed, so
 * both halves of that promise are checked: the web app keeps working, and when the bridge *is*
 * there the app uses it for exports, printing, notifications and external links.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deliverNativeNotification,
  getAndroidBridge,
  installNativeShell,
  isNativeApp,
  nativeNotificationPermission,
  nativePlatformInfo,
  openExternalNatively,
  printNatively,
  saveExportToDevice,
  toastNatively,
} from '../src/lib/native';
import { downloadBlob, fileStamp } from '../src/lib/shared';
import { deliver, notificationSupport, requestPermission } from '../src/lib/notifications';
import { DEFAULT_NOTIFICATION_PREFS } from '../src/lib/defaults';
import type { ReminderDescriptor } from '../src/lib/notifications';

interface FakeBridge {
  calls: Array<{ method: string; args: unknown[] }>;
  [key: string]: unknown;
}

/** A faithful stand-in for the Java bridge: every method answers the way the shell does. */
function installFakeBridge(overrides: Record<string, unknown> = {}): FakeBridge {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const bridge: FakeBridge = { calls };
  const respond = (method: string, result: Record<string, unknown>) =>
    vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return JSON.stringify({ ok: true, ...result });
    });

  bridge.platform = respond('platform', {
    platform: 'android',
    apiLevel: 34,
    versionCode: 10000,
    versionName: '1.0.0',
    applicationId: 'com.bennylankapalli.lifekit',
    downloadFolder: 'LIFEKIT',
  });
  bridge.notificationPermission = vi.fn(() => 'granted');
  bridge.requestNotificationPermission = vi.fn(() => {
    calls.push({ method: 'requestNotificationPermission', args: [] });
    return undefined;
  });
  bridge.notify = respond('notify', {});
  bridge.saveText = respond('saveText', { location: 'Downloads/LIFEKIT/backup.json', name: 'backup.json', uri: 'content://1' });
  bridge.shareText = respond('shareText', {});
  bridge.printPage = respond('printPage', {});
  bridge.openExternal = respond('openExternal', {});
  bridge.toast = vi.fn((...args: unknown[]) => {
    calls.push({ method: 'toast', args });
  });

  Object.assign(bridge, overrides);
  (window as unknown as { LifekitAndroid?: unknown }).LifekitAndroid = bridge;
  return bridge;
}

const descriptor: ReminderDescriptor = {
  kind: 'task',
  title: 'Reminder — call the electricity office',
  body: 'Your recorded task time has passed.',
  key: 'task:abc',
};

beforeEach(() => {
  // jsdom implements neither of these; the app only needs them on the non-native path.
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  delete (window as unknown as { LifekitAndroid?: unknown }).LifekitAndroid;
  delete (window as unknown as { __lifekitNative?: unknown }).__lifekitNative;
});

describe('without the Android shell (a plain browser)', () => {
  it('reports that it is not the native app', () => {
    expect(isNativeApp()).toBe(false);
    expect(getAndroidBridge()).toBeNull();
    expect(nativePlatformInfo()).toBeNull();
    expect(nativeNotificationPermission()).toBe('unsupported');
  });

  it('leaves saving, printing and sharing to the web', () => {
    expect(printNatively()).toBeNull();
    expect(openExternalNatively('https://example.org')).toBeNull();
    expect(toastNatively('hello')).toBeUndefined();
    expect(installNativeShell()).toBe(false);
  });

  it('does not treat a half-built global as the shell', () => {
    // A page that defines window.LifekitAndroid with only some of the methods must be ignored,
    // otherwise it could make LIFEKIT write files or post notifications through a fake bridge.
    (window as unknown as { LifekitAndroid?: unknown }).LifekitAndroid = { platform: () => '{}' };
    expect(isNativeApp()).toBe(false);
  });

  it('uses the ordinary browser download for an export', async () => {
    const click = vi.fn();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === 'a') element.click = click;
      return element;
    });
    downloadBlob('lifekit-money-test.csv', new Blob(['a,b\n'], { type: 'text/csv' }));
    expect(click).toHaveBeenCalled();
  });
});

describe('with the Android shell present', () => {
  it('detects the bridge and reads what it says about the platform', () => {
    installFakeBridge();
    expect(isNativeApp()).toBe(true);
    const info = nativePlatformInfo();
    expect(info?.platform).toBe('android');
    expect(info?.apiLevel).toBe(34);
    expect(info?.versionName).toBe('1.0.0');
  });

  it('saves an export to the device instead of starting a download', async () => {
    const bridge = installFakeBridge();
    const click = vi.fn();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === 'a') element.click = click;
      return element;
    });

    downloadBlob('lifekit-backup-20260101-1200.json', new Blob(['{"v":1}'], { type: 'application/json' }));
    await vi.waitFor(() => expect(bridge.calls.some((call) => call.method === 'saveText')).toBe(true));

    const saved = bridge.calls.find((call) => call.method === 'saveText');
    expect(saved?.args[0]).toBe('lifekit-backup-20260101-1200.json');
    expect(saved?.args[1]).toBe('application/json');
    expect(saved?.args[2]).toBe('{"v":1}');
    expect(click).not.toHaveBeenCalled();
  });

  it('reports the shell state for notifications and asks the shell for permission', async () => {
    installFakeBridge();
    const support = notificationSupport();
    expect(support.supported).toBe(true);
    expect(support.permission).toBe('granted');
    await expect(requestPermission()).resolves.toBe('granted');

    installFakeBridge({ notificationPermission: () => 'prompt' });
    const asking = requestPermission();
    // requestPermission only resolves once Android's own callback fires.
    // The shell answers through the callback it was told about.
    (window as unknown as { __lifekitNative: { onPermissionResult: (state: string) => void } }).__lifekitNative.onPermissionResult('denied');
    await expect(asking).resolves.toBe('denied');
  });

  it('delivers a reminder as a system notification with the app settings applied', () => {
    const bridge = installFakeBridge();
    const result = deliverNativeNotification('Task due', 'body', 'task:abc', {
      route: '/planner',
      silent: false,
      vibrate: true,
    });
    expect(result?.ok).toBe(true);
    const call = bridge.calls.find((entry) => entry.method === 'notify');
    expect(call?.args).toEqual(['Task due', 'body', 'task:abc', '/planner', false, true]);
  });

  it('routes the reminder engine through the shell when notifications are on', async () => {
    installFakeBridge();
    const outcome = await deliver(descriptor, { ...DEFAULT_NOTIFICATION_PREFS, masterEnabled: true, sound: true, vibration: true });
    expect(outcome).toEqual({ delivered: true, via: 'system' });
  });

  it('falls back to the in-app record when the shell cannot post', async () => {
    installFakeBridge({ notify: () => JSON.stringify({ ok: false, error: 'permission not granted' }) });
    const outcome = await deliver(descriptor, { ...DEFAULT_NOTIFICATION_PREFS, masterEnabled: true });
    expect(outcome.delivered).toBe(true);
    expect(outcome.via).toBe('in-app');
  });

  it('uses Android printing for window.print', () => {
    const bridge = installFakeBridge();
    expect(installNativeShell()).toBe(true);
    window.print();
    expect(bridge.calls.some((call) => call.method === 'printPage')).toBe(true);
  });

  it('opens external links through the system browser', () => {
    const bridge = installFakeBridge();
    expect(openExternalNatively('https://example.org')?.ok).toBe(true);
    expect(bridge.calls[bridge.calls.length - 1]?.args[0]).toBe('https://example.org');
  });

  it('survives a bridge that throws instead of answering', async () => {
    installFakeBridge({
      saveText: () => {
        throw new Error('bridge exploded');
      },
      notify: () => {
        throw new Error('bridge exploded');
      },
    });
    const saved = await saveExportToDevice('backup.json', new Blob(['{}']));
    expect(saved?.ok).toBe(false);
    expect(deliverNativeNotification('t', 'b', 'k')).toEqual({ ok: false, error: 'the Android app did not answer' });
  });

  it('survives a bridge that answers with something that is not JSON', async () => {
    installFakeBridge({ platform: () => 'not json at all' });
    expect(nativePlatformInfo()).toBeNull();
  });
});

describe('export file naming', () => {
  it('stamps exports with a sortable date and time', () => {
    expect(fileStamp(new Date(2026, 0, 2, 3, 4))).toBe('20260102-0304');
  });
});
