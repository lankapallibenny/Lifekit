package com.bennylankapalli.lifekit;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * The only bridge between the web app and Android: {@code window.LifekitAndroid}.
 *
 * Rules this class follows, because it is the app's security boundary:
 *
 * <ul>
 *   <li>Every method checks the URL the WebView last committed ({@link #lastCommittedUrl}) and
 *       refuses to run for anything that is not the app's own origin. External links are opened
 *       in the user's browser instead of in this WebView, so no remote page can reach this API.</li>
 *   <li>Every method is defensive: it returns a JSON object and never throws into JavaScript.</li>
 *   <li>It writes only where the user asked it to (the Downloads collection, or a share sheet
 *       they confirm) and it never reads anything but the argument it is given.</li>
 * </ul>
 *
 * All methods run on a WebView JavaScript thread, not the UI thread, so anything that touches
 * the UI is posted to the main thread.
 */
final class WebAppInterface {

    private final Activity activity;
    private final MainActivity host;

    /** Last URL the WebView committed. Written on the UI thread, read on the bridge thread. */
    private volatile String lastCommittedUrl = "";

    WebAppInterface(MainActivity host, Activity activity) {
        this.host = host;
        this.activity = activity;
    }

    void setLastCommittedUrl(String url) {
        this.lastCommittedUrl = url == null ? "" : url;
    }

    /* ------------------------------------------------------------------ */
    /* security                                                            */
    /* ------------------------------------------------------------------ */

    private boolean trustedCaller() {
        return AppConfig.isInternalUrl(lastCommittedUrl);
    }

    private static String error(String message) {
        JSONObject out = new JSONObject();
        try {
            out.put("ok", false);
            out.put("error", message);
        } catch (JSONException ignored) {
            // JSONObject.put only throws for non-finite numbers; nothing to do here.
        }
        return out.toString();
    }

    private static String ok(JSONObject payload) {
        try {
            payload.put("ok", true);
        } catch (JSONException ignored) {
            // As above: keys and values here are always finite strings.
        }
        return payload.toString();
    }

    /* ------------------------------------------------------------------ */
    /* platform information                                                */
    /* ------------------------------------------------------------------ */

    /**
     * Tells the web app it is running inside the Android shell, and what it may assume.
     * The web app uses this to route exports through {@link #saveText}, print through
     * {@link #printPage} and reminders through {@link #notify}, and to skip the service worker
     * (the bundled build is already local).
     */
    @JavascriptInterface
    public String platform() {
        JSONObject out = new JSONObject();
        try {
            out.put("platform", "android");
            out.put("apiLevel", AppConfig.apiLevel());
            out.put("versionCode", BuildConfig.VERSION_CODE);
            out.put("versionName", BuildConfig.VERSION_NAME);
            out.put("applicationId", AppConfig.APPLICATION_ID);
            out.put("origin", AppConfig.ORIGIN);
            out.put("downloadFolder", AppConfig.DOWNLOAD_FOLDER);
            out.put("offline", true);
            out.put("notificationPermission", notificationPermission());
            out.put("shareText", true);
            out.put("print", true);
            out.put("saveToDownloads", true);
        } catch (JSONException ignored) {
            return error("could not describe the platform");
        }
        return ok(out);
    }

    /* ------------------------------------------------------------------ */
    /* saving exports                                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Saves a text export (CSV or JSON) into the device's Downloads collection, under
     * {@code Downloads/LIFEKIT/}. It does not need any storage permission on Android 10+ because
     * it writes through MediaStore, which is also why the app asks for no permissions at all.
     *
     * @param name    file name, e.g. {@code lifekit-backup-20260101-1200.json}
     * @param mime    MIME type, e.g. {@code application/json}
     * @param content the file's text
     * @return {@code {ok:true, uri, location, name}} or {@code {ok:false, error}}
     */
    @JavascriptInterface
    public String saveText(String name, String mime, String content) {
        if (!trustedCaller()) return error("not available to this page");
        String safeName = sanitizeFileName(name);
        if (safeName.isEmpty()) return error("invalid file name");
        String safeMime = mime == null || mime.isEmpty() ? "text/plain" : mime;
        byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
        try {
            if (AppConfig.apiLevel() >= 29) {
                return saveThroughMediaStore(safeName, safeMime, bytes);
            }
            return saveThroughLegacyPath(safeName, safeMime, bytes);
        } catch (Exception failure) {
            return error(describe(failure));
        }
    }

    private String saveThroughMediaStore(String name, String mime, byte[] bytes) throws IOException {
        ContentResolver resolver = activity.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, name);
        values.put(MediaStore.Downloads.MIME_TYPE, mime);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + AppConfig.DOWNLOAD_FOLDER);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (item == null) throw new IOException("the device refused to create the file");

        try (OutputStream stream = resolver.openOutputStream(item)) {
            if (stream == null) throw new IOException("the device refused to open the file");
            stream.write(bytes);
        } catch (IOException failure) {
            resolver.delete(item, null, null);
            throw failure;
        }

        ContentValues done = new ContentValues();
        done.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(item, done, null, null);

        JSONObject out = new JSONObject();
        try {
            out.put("uri", item.toString());
            out.put("name", name);
            out.put("location", "Downloads/" + AppConfig.DOWNLOAD_FOLDER + "/" + name);
        } catch (JSONException ignored) {
            // Unreachable for string values, but keep the contract.
        }
        return ok(out);
    }

    /** Fallback for the (already unsupported) case of a pre-Android-10 device. */
    private String saveThroughLegacyPath(String name, String mime, byte[] bytes) throws IOException {
        File dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) throw new IOException("no external storage directory");
        File target = new File(dir, name);
        try (FileOutputStream stream = new FileOutputStream(target)) {
            stream.write(bytes);
        }
        JSONObject out = new JSONObject();
        try {
            out.put("name", name);
            out.put("mime", mime);
            out.put("location", target.getAbsolutePath());
        } catch (JSONException ignored) {
            // As above.
        }
        return ok(out);
    }

    /**
     * Opens the Android share sheet for a previously saved file, so an export can be sent to
     * another app (mail, chat, cloud drive) without LIFEKIT itself ever sending anything.
     */
    @JavascriptInterface
    public String shareSavedFile(String uri, String mime, String name) {
        if (!trustedCaller()) return error("not available to this page");
        String safeMime = mime == null || mime.isEmpty() ? "text/plain" : mime;
        final Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType(safeMime);
        if (uri != null && !uri.isEmpty()) {
            intent.putExtra(Intent.EXTRA_STREAM, Uri.parse(uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        if (name != null && !name.isEmpty()) intent.putExtra(Intent.EXTRA_TITLE, name);
        return startChooser(intent, "Share LIFEKIT export");
    }

    /** Shares plain text through the Android share sheet. */
    @JavascriptInterface
    public String shareText(String subject, String text) {
        if (!trustedCaller()) return error("not available to this page");
        final Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_SUBJECT, subject == null ? "LIFEKIT" : subject);
        intent.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
        return startChooser(intent, subject == null ? "Share" : subject);
    }

    private String startChooser(final Intent intent, final String title) {
        final Intent chooser = Intent.createChooser(intent, title);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    activity.startActivity(chooser);
                } catch (Exception failure) {
                    toast("No app available to handle that.");
                }
            }
        });
        return ok(new JSONObject());
    }

    /* ------------------------------------------------------------------ */
    /* printing                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * Opens Android's print dialog for the current page, which is also how a PDF gets saved on a
     * device with no printer. Android's print engine does not support the {@code @page} rules of
     * print CSS, but the app's print stylesheet also hides the navigation and buttons with plain
     * rules, so the output is still the résumé or the shopping list rather than the whole screen.
     */
    @JavascriptInterface
    public String printPage() {
        if (!trustedCaller()) return error("not available to this page");
        return host.printCurrentPage();
    }

    /* ------------------------------------------------------------------ */
    /* notifications                                                       */
    /* ------------------------------------------------------------------ */

    /** One of {@code granted}, {@code denied}, {@code prompt}, {@code unsupported}. */
    @JavascriptInterface
    public String notificationPermission() {
        if (AppConfig.apiLevel() < 33) return "granted";
        int state = activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS);
        if (state == PackageManager.PERMISSION_GRANTED) return "granted";
        // There is no platform API to tell "denied" from "never asked" on Android, so the shell
        // reports "prompt" and the web app asks; a denial comes back as "denied" from the
        // permission callback.
        return "prompt";
    }

    /**
     * Asks for the notification permission (Android 13+). The answer is reported back to
     * JavaScript through {@code window.__lifekitNative.onPermissionResult(state)}.
     */
    @JavascriptInterface
    public void requestNotificationPermission() {
        if (!trustedCaller()) return;
        host.requestNotificationPermission();
    }

    /**
     * Shows a reminder as a real system notification. The web app decides *when* (it already
     * implements reminder times and quiet hours); the shell only shows it.
     *
     * @param tag    stable id so a re-delivered reminder replaces the previous one
     * @param route  in-app route to open when the notification is tapped, e.g. {@code /planner}
     * @param silent true when the user switched sound off
     * @param vibrate false when the user switched vibration off
     */
    @JavascriptInterface
    public String notify(String title, String body, String tag, String route, boolean silent, boolean vibrate) {
        if (!trustedCaller()) return error("not available to this page");
        if (!"granted".equals(notificationPermission())) return error("permission not granted");
        try {
            NotificationManager manager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return error("no notification service");

            String channelId = silent ? AppConfig.NOTIFICATION_CHANNEL_SILENT_ID : AppConfig.NOTIFICATION_CHANNEL_ID;
            ensureChannels(manager);

            Intent open = new Intent(activity, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (route != null && !route.isEmpty()) open.putExtra(AppConfig.EXTRA_ROUTE, route);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (AppConfig.apiLevel() >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pending = PendingIntent.getActivity(activity, notificationId(tag), open, flags);

            Notification.Builder builder = new Notification.Builder(activity, channelId)
                    .setSmallIcon(R.drawable.ic_stat_lifekit)
                    .setColor(AppConfig.COLOR_NAVY)
                    .setContentTitle(title == null || title.isEmpty() ? "LIFEKIT" : title)
                    .setContentText(body == null ? "" : body)
                    .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
                    .setAutoCancel(true)
                    .setShowWhen(true)
                    .setContentIntent(pending);

            // Sound is handled by the channel (see ensureChannels); vibration can be dropped
            // per notification, which is how the app's own vibration setting is honoured.
            if (!vibrate) builder.setVibrate(null);

            manager.notify(tag == null || tag.isEmpty() ? "lifekit" : tag, notificationId(tag), builder.build());
            return ok(new JSONObject());
        } catch (Exception failure) {
            return error(describe(failure));
        }
    }

    private void ensureChannels(NotificationManager manager) {
        if (AppConfig.apiLevel() < 26) return;
        NotificationChannel loud = new NotificationChannel(
                AppConfig.NOTIFICATION_CHANNEL_ID,
                AppConfig.NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT);
        loud.setDescription("Reminders you scheduled in LIFEKIT");
        loud.enableVibration(true);

        NotificationChannel quiet = new NotificationChannel(
                AppConfig.NOTIFICATION_CHANNEL_SILENT_ID,
                AppConfig.NOTIFICATION_CHANNEL_SILENT_NAME,
                NotificationManager.IMPORTANCE_LOW);
        quiet.setDescription("Reminders you scheduled in LIFEKIT while sound is switched off");
        quiet.setSound(null, null);
        quiet.enableVibration(false);

        manager.createNotificationChannel(loud);
        manager.createNotificationChannel(quiet);
    }

    private static int notificationId(String tag) {
        return tag == null ? 0 : (tag.hashCode() & 0x7FFFFFFF);
    }

    /* ------------------------------------------------------------------ */
    /* small helpers                                                       */
    /* ------------------------------------------------------------------ */

    /** Opens an external URL in the user's browser. */
    @JavascriptInterface
    public String openExternal(final String url) {
        if (!trustedCaller()) return error("not available to this page");
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return error("only http(s) links can be opened");
        }
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(intent);
                } catch (Exception failure) {
                    toast("No browser available to open that link.");
                }
            }
        });
        return ok(new JSONObject());
    }

    /** Short, honest feedback that does not interrupt what the user is doing. */
    @JavascriptInterface
    public void toast(final String message) {
        if (!trustedCaller()) return;
        final String text = message == null ? "" : message;
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                host.showToast(text);
            }
        });
    }

    private static String describe(Exception failure) {
        String message = failure.getMessage();
        if (message == null || message.isEmpty()) return failure.getClass().getSimpleName();
        return message;
    }

    /** Keeps a user-supplied export name safe for the Downloads collection. */
    static String sanitizeFileName(String name) {
        if (name == null) return "";
        String trimmed = name.trim();
        if (trimmed.isEmpty()) return "";
        String withoutPaths = trimmed.replace('\\', '/');
        int slash = withoutPaths.lastIndexOf('/');
        if (slash >= 0) withoutPaths = withoutPaths.substring(slash + 1);
        StringBuilder out = new StringBuilder(withoutPaths.length());
        for (int i = 0; i < withoutPaths.length(); i++) {
            char c = withoutPaths.charAt(i);
            boolean safe = Character.isLetterOrDigit(c) || c == '.' || c == '-' || c == '_' || c == ' ';
            out.append(safe ? c : '-');
        }
        String cleaned = out.toString().trim();
        if (cleaned.equals(".") || cleaned.equals("..")) return "";
        if (cleaned.length() > 120) cleaned = cleaned.substring(0, 120);
        return cleaned;
    }
}
