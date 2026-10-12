package com.bennylankapalli.lifekit;

import android.content.Context;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Keeps the reason the app last died, so it can be shown instead of a silent disappearance.
 *
 * A sideloaded app has no crash-reporting console behind it: when something throws during launch,
 * the user sees the app close (or never appear) and has nothing to send. This class writes the
 * uncaught exception into the app's own private storage on the way down, and the next launch reads
 * it back, shows it as plain text, and clears it.
 *
 * It is deliberately tiny: no network, no analytics, one file, capped at 64 kB, deleted as soon as
 * it has been shown.
 */
final class CrashLog {

    private static final String FILE_NAME = "last-crash.txt";
    private static final int MAX_CHARS = 64 * 1024;

    /** The application context: safe to hold for the life of the process, unlike an Activity. */
    private static Context appContext;

    private CrashLog() {}

    /** Installs the handler. Called once from {@link LifekitApplication}. */
    static void install(Context context) {
        appContext = context.getApplicationContext();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable failure) {
                try {
                    record(failure);
                } catch (Throwable ignored) {
                    // Reporting must never make a crash worse.
                }
                if (previous != null) previous.uncaughtException(thread, failure);
            }
        });
    }

    private static void record(Throwable failure) {
        File target = file();
        if (target == null) return;

        StringWriter buffer = new StringWriter();
        PrintWriter writer = new PrintWriter(buffer);
        writer.println("LIFEKIT " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")");
        writer.println("Android API " + AppConfig.apiLevel());
        writer.println("WebView: " + webViewVersion());
        writer.println("When: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()));
        writer.println();
        failure.printStackTrace(writer);
        writer.flush();

        String report = buffer.toString();
        if (report.length() > MAX_CHARS) report = report.substring(0, MAX_CHARS);

        try (FileOutputStream stream = new FileOutputStream(target, false)) {
            stream.write(report.getBytes(StandardCharsets.UTF_8));
        } catch (IOException ignored) {
            // Nothing left to do: the process is already going down.
        }
    }

    /** The last crash report, or null when there is nothing to report. */
    static String read() {
        File source = file();
        if (source == null || !source.isFile()) return null;
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new FileReader(source))) {
            String line;
            while ((line = reader.readLine()) != null) {
                text.append(line).append('\n');
                if (text.length() > MAX_CHARS) break;
            }
        } catch (IOException failure) {
            return null;
        }
        return text.length() == 0 ? null : text.toString();
    }

    /** Removes the report, so it is shown once rather than on every launch. */
    static void clear() {
        File source = file();
        if (source != null && source.isFile()) {
            //noinspection ResultOfMethodCallIgnored
            source.delete();
        }
    }

    private static File file() {
        if (appContext == null) return null;
        return new File(appContext.getFilesDir(), FILE_NAME);
    }

    /** The WebView provider's version: the first thing to check when a page will not load. */
    static String webViewVersion() {
        try {
            android.content.pm.PackageInfo info = android.webkit.WebView.getCurrentWebViewPackage();
            if (info == null) return "not installed";
            return info.packageName + " " + info.versionName;
        } catch (Throwable failure) {
            return "unknown (" + failure.getClass().getSimpleName() + ")";
        }
    }

    /** True when Android's WebView itself is missing or disabled, which no app can work around. */
    static boolean webViewMissing() {
        try {
            return android.webkit.WebView.getCurrentWebViewPackage() == null;
        } catch (Throwable failure) {
            return true;
        }
    }
}
