/**
 * The About screen has to be honest about which copy of LIFEKIT is being used, because the two
 * copies keep their records in different places: a browser profile, or the Android app's own
 * storage. Getting that wrong would be the kind of quiet inaccuracy this project avoids.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutPage } from '../src/pages/Settings';
import { StoreProvider } from '../src/state/store';

function installFakeBridge(downloadFolder = 'LIFEKIT') {
  (window as unknown as { LifekitAndroid?: unknown }).LifekitAndroid = {
    platform: () =>
      JSON.stringify({
        ok: true,
        platform: 'android',
        apiLevel: 34,
        versionCode: 10000,
        versionName: '1.0.0',
        applicationId: 'com.bennylankapalli.lifekit',
        downloadFolder,
      }),
    notificationPermission: () => 'granted',
    requestNotificationPermission: () => undefined,
    notify: () => '{"ok":true}',
    saveText: () => '{"ok":true}',
    shareText: () => '{"ok":true}',
    printPage: () => '{"ok":true}',
    openExternal: () => '{"ok":true}',
    toast: () => undefined,
  };
}

afterEach(() => {
  delete (window as unknown as { LifekitAndroid?: unknown }).LifekitAndroid;
});

describe('About: where this copy runs', () => {
  it('describes the web app in a browser, and does not pretend to be the Android app', async () => {
    render(
      <StoreProvider>
        <AboutPage />
      </StoreProvider>
    );
    // Note: these matchers deliberately avoid text that is split by an inline <strong>, because
    // Testing Library matches an element's own text nodes only.
    expect(await screen.findByText(/opened in a browser/i)).toBeTruthy();
    // The web copy must not advertise Android-only paths as if they existed here.
    expect(screen.queryByText(/Downloads\/LIFEKIT/)).toBeNull();
  });

  it('describes the Android app, including where exports go', async () => {
    installFakeBridge();
    render(
      <StoreProvider>
        <AboutPage />
      </StoreProvider>
    );
    expect(await screen.findByText(/running on Android API/i)).toBeTruthy();
    expect(screen.getByText(/Downloads\/LIFEKIT/)).toBeTruthy();
    // The two statements a user most needs are present: no network, and uninstalling removes data.
    expect(screen.getByText(/no internet permission at all/i)).toBeTruthy();
    expect(screen.getByText(/Uninstalling the app deletes its storage/i)).toBeTruthy();
  });

  it('follows the shell when it reports a different download folder', async () => {
    installFakeBridge('MyExports');
    render(
      <StoreProvider>
        <AboutPage />
      </StoreProvider>
    );
    expect(await screen.findByText(/Downloads\/MyExports/)).toBeTruthy();
  });
});
