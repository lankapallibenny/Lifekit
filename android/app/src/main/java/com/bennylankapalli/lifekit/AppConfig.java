package com.bennylankapalli.lifekit;

import android.os.Build;

/**
 * Values the Android shell needs, in one place.
 *
 * LIFEKIT is an offline-first web app, so the Android layer deliberately does as little as
 * possible: it serves the bundled build of the web app from inside the APK, keeps the user's
 * records in the WebView's own storage, and adds the three things a WebView cannot do by itself
 * — saving an export to the device's Downloads, printing, and real system notifications.
 *
 * There is no network code in this class or in any other class of this app.
 */
final class AppConfig {

    private AppConfig() {}

    /** Reverse-DNS id of the installed app. Keep in step with android/README.md. */
    static final String APPLICATION_ID = "com.bennylankapalli.lifekit";

    /**
     * Virtual HTTPS origin the WebView loads. Requests to it never leave the device: they are
     * answered from the APK's own assets by {@link MainActivity}'s resource interceptor. HTTPS is
     * used rather than file:// so the page is a normal secure origin (which keeps localStorage,
     * IndexedDB, notifications and the CSP working exactly as they do on the web).
     */
    static final String HOST = "lifekit.local";
    static final String ORIGIN = "https://" + HOST;
    static final String START_URL = ORIGIN + "/index.html";

    /** Where the built web app lives inside the APK. */
    static final String ASSET_ROOT = "www";

    /** Folder created inside the device's Downloads collection for exports. */
    static final String DOWNLOAD_FOLDER = "LIFEKIT";

    static final String NOTIFICATION_CHANNEL_ID = "lifekit-reminders";
    static final String NOTIFICATION_CHANNEL_NAME = "LIFEKIT reminders";
    static final String NOTIFICATION_CHANNEL_SILENT_ID = "lifekit-reminders-silent";
    static final String NOTIFICATION_CHANNEL_SILENT_NAME = "LIFEKIT reminders (silent)";

    /** Extra key used to deep-link a notification tap to a screen inside the app. */
    static final String EXTRA_ROUTE = "lifekit.route";

    /** Colours mirroring src/styles.css (--navy-800, --navy-900). */
    static final int COLOR_NAVY = 0xFF0B1F3A;
    static final int COLOR_NAVY_DEEP = 0xFF08182B;

    /**
     * WebView contents debugging (chrome://inspect). Off in shipped builds on purpose; flip it to
     * true locally when you need to inspect the app on a device.
     */
    static final boolean WEBVIEW_DEBUGGING = false;

    static int apiLevel() {
        return Build.VERSION.SDK_INT;
    }

    /**
     * True when a URL belongs to the app itself: the virtual origin (any path) or a bundled
     * asset. Everything else is external and is handed to the user's browser instead of being
     * loaded in the WebView, which is what keeps the JavaScript bridge unreachable from remote
     * pages.
     */
    static boolean isInternalUrl(String url) {
        if (url == null) return false;
        if (url.startsWith("file:///android_asset/")) return true;
        if (url.equals(ORIGIN) || url.equals(ORIGIN + "/")) return true;
        return url.startsWith(ORIGIN + "/") || url.startsWith(ORIGIN + "?") || url.startsWith(ORIGIN + "#");
    }
}
