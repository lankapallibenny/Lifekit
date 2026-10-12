package com.bennylankapalli.lifekit;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsetsController;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * The whole Android app: one activity showing one WebView.
 *
 * The web app is bundled in the APK's assets and served to the WebView from a virtual HTTPS
 * origin ({@link AppConfig#ORIGIN}) by {@link #serveAsset}. Nothing is fetched from the network,
 * and the manifest asks for no internet permission, so the app cannot reach the network even if
 * something tried.
 */
public class MainActivity extends Activity {

    private static final int REQUEST_FILE_CHOOSER = 1001;
    private static final int REQUEST_NOTIFICATIONS = 1002;

    /** How long to wait for the bundled page before assuming something went wrong. */
    private static final long LOAD_TIMEOUT_MS = 8000;

    private WebView webView;
    private WebAppInterface bridge;
    private ValueCallback<Uri[]> pendingFileChooser;
    private String pendingRoute;

    /** Set once the bundled page has finished loading; used by the startup watchdog. */
    private volatile boolean pageLoaded;
    private volatile boolean servedDocument;
    private volatile String lastLoadError;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable loadTimeout = new Runnable() {
        @Override
        public void run() {
            if (!pageLoaded) showStartupProblem("the app's own page did not finish loading");
        }
    };

    /* ------------------------------------------------------------------ */
    /* lifecycle                                                           */
    /* ------------------------------------------------------------------ */

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (CrashLog.webViewMissing()) {
            showStartupProblem("Android's WebView component is missing or disabled on this device");
            return;
        }

        // A report from the last run is shown once, in the app's own view, before anything else.
        String previousCrash = CrashLog.read();
        if (previousCrash != null) CrashLog.clear();

        try {
            getWindow().setStatusBarColor(AppConfig.COLOR_NAVY);
            getWindow().setNavigationBarColor(AppConfig.COLOR_NAVY_DEEP);

            bridge = new WebAppInterface(this, this);
            webView = createWebView();
            setContentView(wrapContent(webView));

            // Only after setContentView() does the window have an attached decor view, which is
            // what the system-bar appearance call needs (see applyStatusBarIconTheme).
            applyStatusBarIconTheme();

            if (previousCrash != null) {
                showReportScreen(previousCrash);
                return;
            }

            applyRoute(getIntent());
            webView.loadUrl(AppConfig.START_URL);
            // If the bundled page has not finished in time, say so rather than showing nothing.
            handler.postDelayed(loadTimeout, LOAD_TIMEOUT_MS);
        } catch (Throwable failure) {
            // This used to mean the app closed with no explanation. Now it says what happened.
            showStartupProblem(describe(failure));
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(loadTimeout);
        if (webView != null) {
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) parent.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Tapping a reminder while the app is already running: just move to the screen it is about.
        applyRoute(intent);
    }

    @Override
    @SuppressWarnings("deprecation") // the platform still routes the system back gesture here
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    /**
     * No {@code uiMode} here on purpose: a change between day and night should recreate the
     * activity so the WebView picks the new system theme up, while a rotation must not, so
     * half-filled forms survive turning the phone.
     */
    @Override
    public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        applyStatusBarIconTheme();
    }

    /* ------------------------------------------------------------------ */
    /* web view setup                                                      */
    /* ------------------------------------------------------------------ */

    private View wrapContent(WebView view) {
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(AppConfig.COLOR_NAVY);
        frame.addView(view, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        return frame;
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private WebView createWebView() {
        WebView view = new WebView(this);
        view.setBackgroundColor(AppConfig.COLOR_NAVY);
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        // IndexedDB (where every record lives) needs DOM storage; it is the WebView's own
        // storage area, private to this app.
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        // The app is served from assets through the interceptor, so no file:// access is needed.
        settings.setAllowFileAccess(false);
        // Content access stays on because "restore from a backup file" hands the WebView a
        // content:// URI for the file the user picked in Android's file picker. Without it the
        // import would silently read nothing.
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setGeolocationEnabled(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // LIFEKIT ships its own light/dark themes; algorithmic darkening would recolour a design
        // that is already checked for contrast.
        if (Build.VERSION.SDK_INT >= 33) {
            settings.setAlgorithmicDarkeningAllowed(false);
        } else {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }

        if (AppConfig.WEBVIEW_DEBUGGING) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        view.addJavascriptInterface(bridge, "LifekitAndroid");

        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView source, WebResourceRequest request) {
                return serveAsset(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView source, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (AppConfig.isInternalUrl(url)) return false;
                // Nothing third-party loads inside the app: a subframe request is simply refused,
                // and a real navigation is handed to the user's own browser. The app has no
                // internet permission and a JavaScript bridge, so this is the safe default.
                if (request.isForMainFrame()) bridge.openExternal(url);
                return true;
            }

            @Override
            public void onPageStarted(WebView source, String url, Bitmap favicon) {
                bridge.setLastCommittedUrl(url);
            }

            @Override
            public void onPageFinished(WebView source, String url) {
                bridge.setLastCommittedUrl(url);
                pageLoaded = true;
                handler.removeCallbacks(loadTimeout);
                source.post(new Runnable() {
                    @Override
                    public void run() {
                        evaluatePendingRoute();
                    }
                });
            }

            @Override
            public void onReceivedError(WebView source, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                handler.removeCallbacks(loadTimeout);
                lastLoadError = String.valueOf(error.getDescription());
                showStartupProblem("the bundled page could not be loaded (" + lastLoadError + ")");
            }

            @Override
            public boolean onRenderProcessGone(WebView source, RenderProcessGoneDetail detail) {
                // The WebView's renderer can be killed by the system under memory pressure.
                // Rebuilding it keeps the app usable instead of taking the whole process down.
                if (source == webView) {
                    ViewGroup parent = (ViewGroup) source.getParent();
                    if (parent != null) parent.removeView(source);
                    source.destroy();
                    webView = null;
                    if (parent != null) {
                        WebView replacement = createWebView();
                        webView = replacement;
                        parent.addView(replacement, new FrameLayout.LayoutParams(
                                FrameLayout.LayoutParams.MATCH_PARENT,
                                FrameLayout.LayoutParams.MATCH_PARENT));
                        replacement.loadUrl(AppConfig.START_URL);
                    }
                    return true;
                }
                return false;
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            /**
             * The restore-from-backup screen uses a {@code <input type="file">}. Without this the
             * file picker silently does nothing inside a WebView.
             */
            @Override
            public boolean onShowFileChooser(WebView source, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileChooser != null) {
                    pendingFileChooser.onReceiveValue(null);
                }
                pendingFileChooser = callback;
                try {
                    startActivityForResult(params.createIntent(), REQUEST_FILE_CHOOSER);
                    return true;
                } catch (ActivityNotFoundException failure) {
                    pendingFileChooser = null;
                    showToast("This device has no file picker installed.");
                    return false;
                }
            }

            /** LIFEKIT asks the device for nothing, so every web permission request is denied. */
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
            }
        });

        return view;
    }

    /* ------------------------------------------------------------------ */
    /* serving the bundled web app                                         */
    /* ------------------------------------------------------------------ */

    /**
     * Answers every request for the app's own origin from the APK's assets. Anything that is not
     * one of our own URLs is not served here, and no request ever reaches the network stack.
     */
    private WebResourceResponse serveAsset(Uri uri) {
        if (uri == null) return null;
        if (!AppConfig.ORIGIN.equals(uri.getScheme() + "://" + uri.getHost())) return null;
        servedDocument = true;

        String path = uri.getPath() == null ? "/" : uri.getPath();
        if (path.isEmpty() || path.equals("/")) path = "/index.html";

        String assetPath = AppConfig.ASSET_ROOT + path;
        if (assetPath.contains("..")) return notFound(uri);

        InputStream stream;
        try {
            stream = getAssets().open(assetPath);
        } catch (IOException missing) {
            return notFound(uri);
        }

        String mime = guessMime(path);
        Map<String, String> headers = new HashMap<>();
        // Mirrors public/_headers: content-hashed assets may be cached hard, the entry points not.
        if (path.startsWith("/assets/")) {
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
        } else {
            headers.put("Cache-Control", "no-cache");
        }
        headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, stream);
    }

    private WebResourceResponse notFound(Uri uri) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "text/plain; charset=utf-8");
        headers.put("Cache-Control", "no-store");
        byte[] body = ("Not found in the LIFEKIT bundle: " + uri.getPath()).getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers,
                new ByteArrayInputStream(body));
    }

    private static String guessMime(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /**
     * Something went wrong before the app could show itself. Says what, in plain language, with
     * the details needed to report it, instead of leaving the user with an icon that does nothing.
     */
    private void showStartupProblem(final String reason) {
        StringBuilder detail = new StringBuilder();
        detail.append("What failed: ").append(reason).append('\n');
        detail.append("Start address: ").append(AppConfig.START_URL).append('\n');
        detail.append("Bundled page served: ").append(servedDocument ? "yes" : "no").append('\n');
        detail.append("Page finished loading: ").append(pageLoaded ? "yes" : "no").append('\n');
        if (lastLoadError != null) detail.append("Last load error: ").append(lastLoadError).append('\n');
        detail.append("Android: API ").append(AppConfig.apiLevel()).append('\n');
        detail.append("WebView: ").append(CrashLog.webViewVersion()).append('\n');
        detail.append("App: ").append(BuildConfig.VERSION_NAME).append(" (").append(BuildConfig.VERSION_CODE).append(')');
        showDiagnosticScreen(
                "LIFEKIT could not open",
                "The app started but the bundled toolkit did not load. Your saved records are not affected. "
                        + "This is the information needed to fix it:",
                detail.toString());
    }

    /** Shows a crash report that was recorded the last time the app died. */
    private void showReportScreen(final String report) {
        showDiagnosticScreen(
                "LIFEKIT closed unexpectedly last time",
                "This report was saved when the app stopped. It is shown once and then deleted, so copy it now "
                        + "if you want to report it. Nothing about your records is included.",
                report);
    }

    private void showDiagnosticScreen(final String heading, final String explanation, final String details) {
        final String html = "<!doctype html><html><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                + "<title>" + escapeHtml(heading) + "</title></head>"
                + "<body style=\"margin:0;padding:24px;background:#0b1f3a;color:#e8eefb;"
                + "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5\">"
                + "<h1 style=\"font-size:1.25rem;margin:0 0 12px\">" + escapeHtml(heading) + "</h1>"
                + "<p style=\"margin:0 0 16px;color:#c6d2e0\">" + escapeHtml(explanation) + "</p>"
                + "<pre style=\"white-space:pre-wrap;word-break:break-word;background:#08182b;"
                + "border:1px solid #1b4278;border-radius:12px;padding:14px;font-size:0.8rem;"
                + "-webkit-user-select:text;user-select:text\">" + escapeHtml(details) + "</pre>"
                + "<p style=\"margin:18px 0 8px\"><a href=\"" + AppConfig.START_URL + "\" "
                + "style=\"display:inline-block;background:#2fe0a8;color:#08182b;text-decoration:none;"
                + "font-weight:600;padding:12px 18px;border-radius:10px\">Open LIFEKIT again</a></p>"
                + "<p style=\"color:#8fa3bd;font-size:0.85rem\">If it fails again, this screen comes back with "
                + "the same information. Sending that text to whoever built this APK is enough to diagnose it.</p>"
                + "</body></html>";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (webView != null) {
                        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
                        applyStatusBarIconTheme();
                        return;
                    }
                    // No WebView to draw in (that may be the problem): fall back to a plain dialog.
                    new android.app.AlertDialog.Builder(MainActivity.this)
                            .setTitle(heading)
                            .setMessage(explanation + "\n\n" + details)
                            .setPositiveButton("OK", null)
                            .show();
                } catch (Throwable failure) {
                    showToast("LIFEKIT could not start. " + explanation);
                }
            }
        });
    }

    private static String describe(Throwable failure) {
        String message = failure.getMessage();
        String type = failure.getClass().getSimpleName();
        return message == null || message.isEmpty() ? type : type + ": " + message;
    }

    private static String escapeHtml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /* ------------------------------------------------------------------ */
    /* things only Android can do                                          */
    /* ------------------------------------------------------------------ */

    /** Used by {@link WebAppInterface#printPage} for the résumé and the printable shopping list. */
    String printCurrentPage() {
        final String[] result = new String[1];
        Thread job = new Thread(new Runnable() {
            @Override
            public void run() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                            if (manager == null || webView == null) {
                                result[0] = errorJson("printing is not available on this device");
                                return;
                            }
                            PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("LIFEKIT");
                            manager.print("LIFEKIT", adapter, new PrintAttributes.Builder().build());
                            result[0] = "{\"ok\":true}";
                        } catch (Exception failure) {
                            result[0] = errorJson(String.valueOf(failure.getMessage()));
                        }
                    }
                });
            }
        });
        job.start();
        try {
            // Only the opening of Android's print dialog is waited for; the dialog is asynchronous
            // by design, so nothing here blocks the app while the user chooses a printer.
            job.join(3000);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
        return result[0] == null ? "{\"ok\":true}" : result[0];
    }

    private static String errorJson(String message) {
        JSONObject out = new JSONObject();
        try {
            out.put("ok", false);
            out.put("error", message == null ? "unknown error" : message);
        } catch (Exception ignored) {
            // Nothing to add.
        }
        return out.toString();
    }

    /** Used by {@link WebAppInterface#requestNotificationPermission}. */
    void requestNotificationPermission() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (Build.VERSION.SDK_INT < 33) {
                    reportNotificationPermission("granted");
                    return;
                }
                if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                    reportNotificationPermission("granted");
                    return;
                }
                requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_NOTIFICATIONS);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_NOTIFICATIONS) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        reportNotificationPermission(granted ? "granted" : "denied");
    }

    private void reportNotificationPermission(String state) {
        evaluateJavascript("window.__lifekitNative && window.__lifekitNative.onPermissionResult('" + state + "')");
    }

    void showToast(String message) {
        if (message == null || message.isEmpty()) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* routing from a notification tap                                     */
    /* ------------------------------------------------------------------ */

    private void applyRoute(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra(AppConfig.EXTRA_ROUTE);
        if (route == null || route.isEmpty()) return;
        intent.removeExtra(AppConfig.EXTRA_ROUTE);
        pendingRoute = route;
    }

    /** Applies a route once a page is showing, so the hash navigation lands somewhere real. */
    private void evaluatePendingRoute() {
        if (pendingRoute == null) return;
        String route = pendingRoute;
        pendingRoute = null;
        evaluateJavascript("window.location.hash = " + JSONObject.quote("#" + route));
    }

    private void evaluateJavascript(final String script) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) webView.evaluateJavascript(script, null);
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* file chooser result                                                 */
    /* ------------------------------------------------------------------ */

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (pendingFileChooser != null) {
                pendingFileChooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                pendingFileChooser = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /* ------------------------------------------------------------------ */
    /* status bar icons                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * The status bar is navy in both themes, so its icons stay light.
     *
     * Two things matter here, both learned the hard way:
     *
     *  * `Window.getInsetsController()` returns **null** until the window has an attached decor
     *    view, so calling it from the top of onCreate throws a NullPointerException and takes the
     *    whole app down with it. This is only called after setContentView(), and it is still
     *    null-checked, because a cosmetic preference must never be able to kill the app.
     *  * The same appearance is already declared in the activity theme
     *    (android:windowLightStatusBar=false), so if the controller is not available yet there is
     *    nothing to fix: leave it alone.
     */
    private void applyStatusBarIconTheme() {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller == null) return;
                controller.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            } else {
                View decor = getWindow().getDecorView();
                if (decor == null) return;
                decor.setSystemUiVisibility(decor.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
        } catch (Throwable ignored) {
            // Cosmetic only: the theme's own windowLightStatusBar value keeps the icons readable.
        }
    }
}
