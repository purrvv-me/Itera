package app.itera.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://itera.local/home";
    private static final String PROJECT_URL = "https://github.com/purrvv-me/Itera";

    private final List<Tab> tabs = new ArrayList<>();
    private LinearLayout root;
    private LinearLayout tabStrip;
    private FrameLayout webContainer;
    private EditText addressInput;
    private int activeIndex = -1;
    private int nextTabId = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        clearDisposableIdentity();
        buildUi();
        createTab(HOME_URL, true);
    }

    @Override
    protected void onDestroy() {
        clearDisposableIdentity();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        WebView active = getActiveWebView();
        if (active != null && active.canGoBack()) {
            active.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void buildUi() {
        getWindow().setStatusBarColor(color("#050811"));
        getWindow().setNavigationBarColor(color("#050811"));

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(color("#030814"));
        root.setPadding(0, getStatusBarHeight(), 0, 0);
        setContentView(root);

        LinearLayout chrome = new LinearLayout(this);
        chrome.setOrientation(LinearLayout.VERTICAL);
        chrome.setPadding(dp(12), dp(9), dp(12), dp(11));
        chrome.setBackgroundColor(color("#11141D"));
        root.addView(chrome, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout tabRow = new LinearLayout(this);
        tabRow.setGravity(Gravity.CENTER_VERTICAL);
        tabRow.setOrientation(LinearLayout.HORIZONTAL);
        chrome.addView(tabRow, new LinearLayout.LayoutParams(-1, dp(42)));

        ImageView brand = new ImageView(this);
        brand.setImageResource(R.drawable.ic_match);
        brand.setPadding(dp(6), dp(5), dp(6), dp(5));
        brand.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        brand.setBackground(rounded("#171C28", "#2B3142", 11));
        LinearLayout.LayoutParams brandParams = new LinearLayout.LayoutParams(dp(42), dp(38));
        brandParams.setMargins(0, 0, dp(8), 0);
        tabRow.addView(brand, brandParams);

        HorizontalScrollView tabScroll = new HorizontalScrollView(this);
        tabScroll.setHorizontalScrollBarEnabled(false);
        tabScroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        tabStrip = new LinearLayout(this);
        tabStrip.setOrientation(LinearLayout.HORIZONTAL);
        tabScroll.addView(tabStrip, new HorizontalScrollView.LayoutParams(-2, dp(36)));
        tabRow.addView(tabScroll, new LinearLayout.LayoutParams(0, dp(38), 1));

        TextView addTab = tool("+", v -> createTab(HOME_URL, true), 40, 24);
        addTab.setBackground(rounded("#1D2331", "#303748", 11));
        tabRow.addView(addTab);

        LinearLayout addressRow = new LinearLayout(this);
        addressRow.setGravity(Gravity.CENTER_VERTICAL);
        addressRow.setOrientation(LinearLayout.HORIZONTAL);
        addressRow.setPadding(0, dp(9), 0, 0);
        chrome.addView(addressRow, new LinearLayout.LayoutParams(-1, dp(56)));
        addressInput = new EditText(this);
        addressInput.setSingleLine(true);
        addressInput.setHint("Search or enter address");
        addressInput.setHintTextColor(color("#778296"));
        addressInput.setTextColor(color("#F3EEE7"));
        addressInput.setTextSize(15);
        addressInput.setPadding(dp(16), 0, dp(16), 0);
        addressInput.setBackground(rounded("#1A202D", "#30384B", 12));
        addressInput.setOnEditorActionListener((v, actionId, event) -> {
            navigate(addressInput.getText().toString());
            hideKeyboard();
            return true;
        });
        addressRow.addView(addressInput, new LinearLayout.LayoutParams(-1, dp(44)));

        webContainer = new FrameLayout(this);
        root.addView(webContainer, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setPadding(dp(12), dp(8), dp(12), dp(8));
        controls.setBackgroundColor(color("#10131B"));
        root.addView(controls, new LinearLayout.LayoutParams(-1, dp(62)));

        controls.addView(tool("‹", v -> goBack(), 42, 26));
        controls.addView(tool("›", v -> goForward(), 42, 26));
        controls.addView(tool("⌂", v -> openHome(), 42, 22));
        controls.addView(tool("↻", v -> reload(), 42, 22));
        controls.addView(spacer());
        controls.addView(tool("×", v -> closeTab(activeIndex), 42, 22));
        TextView burn = tool("Burn", v -> destroySession(), 72, 14);
        burn.setTextColor(color("#FFD0AD"));
        burn.setTypeface(Typeface.DEFAULT_BOLD);
        burn.setBackground(rounded("#241817", "#7A452D", 13));
        LinearLayout.LayoutParams burnParams = new LinearLayout.LayoutParams(dp(72), dp(40));
        burnParams.setMargins(dp(8), 0, 0, 0);
        burn.setLayoutParams(burnParams);
        controls.addView(burn);
    }

    private TextView tool(String label, View.OnClickListener listener) {
        return tool(label, listener, 38, label.length() > 1 ? 15 : 24);
    }

    private TextView tool(String label, View.OnClickListener listener, int widthDp, int textSp) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setTextColor(color("#9AA3B2"));
        view.setTextSize(textSp);
        view.setGravity(Gravity.CENTER);
        view.setOnClickListener(listener);
        view.setBackground(rounded("#11141D", "#11141D", 11));
        view.setLayoutParams(new LinearLayout.LayoutParams(dp(widthDp), dp(40)));
        return view;
    }

    private View spacer() {
        View view = new View(this);
        view.setLayoutParams(new LinearLayout.LayoutParams(0, 1, 1));
        return view;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createTab(String url, boolean activate) {
        WebView webView = new WebView(this);
        webView.setBackgroundColor(color("#030814"));
        webView.setVisibility(View.GONE);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        Tab tab = new Tab();
        tab.id = nextTabId++;
        tab.title = "New identity";
        tab.webView = webView;
        tab.button = buildTabButton(tab);
        tabs.add(tab);
        tabStrip.addView(tab.button);
        webContainer.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
                Toast.makeText(MainActivity.this, "Permission blocked for disposable identity", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                if (title != null && !title.trim().isEmpty() && !HOME_URL.equals(view.getUrl())) {
                    tab.title = title.trim();
                    renderTabs();
                }
            }
        });

        webView.setDownloadListener((downloadUrl, userAgent, contentDisposition, mimeType, contentLength) -> {
            confirmDeviceDownload(downloadUrl, userAgent, contentDisposition, mimeType);
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                tab.mobileUrl = url;
                return handleUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                tab.mobileUrl = url;
                return handleUrl(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && !"about:blank".equals(url)) {
                    tab.mobileUrl = url;
                }
                if (HOME_URL.equals(url)) {
                    tab.title = "New identity";
                }
                updateAddress();
                renderTabs();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request == null || !request.isForMainFrame()) {
                    return;
                }
                String failedUrl = request.getUrl() == null ? "" : request.getUrl().toString();
                if (HOME_URL.equals(failedUrl)) {
                    return;
                }
                tab.title = "Connection failed";
                tab.mobileUrl = failedUrl;
                renderTabs();
                updateAddress();
                view.loadDataWithBaseURL(failedUrl, errorHtml(failedUrl), "text/html", "UTF-8", null);
            }
        });

        if (activate) {
            activateTab(tabs.size() - 1);
        }
        loadInTab(tab, url);
    }

    private TextView buildTabButton(Tab tab) {
        TextView button = new TextView(this);
        button.setSingleLine(true);
        button.setTextColor(color("#F3EEE7"));
        button.setTextSize(13);
        button.setGravity(Gravity.CENTER_VERTICAL);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setPadding(dp(12), 0, dp(12), 0);
        attachMatchIcon(button);
        button.setOnClickListener(v -> activateTab(tabs.indexOf(tab)));
        button.setOnLongClickListener(v -> {
            closeTab(tabs.indexOf(tab));
            return true;
        });
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(148), dp(36));
        params.setMargins(0, 0, dp(6), 0);
        button.setLayoutParams(params);
        return button;
    }

    private void renderTabs() {
        for (int i = 0; i < tabs.size(); i++) {
            Tab tab = tabs.get(i);
            boolean active = i == activeIndex;
            tab.button.setText(tab.title);
            tab.button.setTextColor(active ? color("#FFFFFF") : color("#A7B0C0"));
            tab.button.setBackground(active ? rounded("#242A38", "#3A4154", 11) : rounded("#151A25", "#242B3A", 11));
            tab.button.setAlpha(active ? 1f : 0.9f);
        }
    }

    private void attachMatchIcon(TextView view) {
        Drawable icon = getResources().getDrawable(R.drawable.ic_match);
        icon.setBounds(0, 0, dp(22), dp(22));
        view.setCompoundDrawables(icon, null, null, null);
        view.setCompoundDrawablePadding(dp(8));
    }

    private void activateTab(int index) {
        if (index < 0 || index >= tabs.size()) {
            return;
        }
        activeIndex = index;
        for (int i = 0; i < tabs.size(); i++) {
            tabs.get(i).webView.setVisibility(i == activeIndex ? View.VISIBLE : View.GONE);
        }
        updateAddress();
        renderTabs();
    }

    private void closeTab(int index) {
        if (index < 0 || index >= tabs.size()) {
            return;
        }
        Tab tab = tabs.remove(index);
        tabStrip.removeView(tab.button);
        webContainer.removeView(tab.webView);
        tab.webView.destroy();

        if (tabs.isEmpty()) {
            createTab(HOME_URL, true);
            return;
        }
        activateTab(Math.min(index, tabs.size() - 1));
    }

    private void navigate(String raw) {
        WebView active = getActiveWebView();
        if (active == null) {
            return;
        }
        loadInTab(tabs.get(activeIndex), normalizeAddress(raw));
    }

    private void loadInTab(Tab tab, String url) {
        if (HOME_URL.equals(url)) {
            tab.title = "New identity";
            tab.mobileUrl = HOME_URL;
            updateAddress();
            renderTabs();
            tab.webView.loadDataWithBaseURL(HOME_URL, homeHtml(), "text/html", "UTF-8", null);
            return;
        }
        tab.mobileUrl = url;
        tab.webView.loadUrl(url);
    }

    private boolean handleUrl(String url) {
        if (url == null) {
            return false;
        }
        if (url.startsWith(PROJECT_URL)) {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            return true;
        }
        return false;
    }

    private String normalizeAddress(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            return HOME_URL;
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("about:")) {
            return trimmed;
        }
        if (trimmed.contains(".") && !trimmed.contains(" ")) {
            return "https://" + trimmed;
        }
        return "https://duckduckgo.com/?q=" + Uri.encode(trimmed);
    }

    private void goBack() {
        WebView active = getActiveWebView();
        if (active != null && active.canGoBack()) {
            active.goBack();
        }
    }

    private void goForward() {
        WebView active = getActiveWebView();
        if (active != null && active.canGoForward()) {
            active.goForward();
        }
    }

    private void reload() {
        WebView active = getActiveWebView();
        if (active != null) {
            active.reload();
        }
    }

    private void openHome() {
        if (activeIndex >= 0 && activeIndex < tabs.size()) {
            loadInTab(tabs.get(activeIndex), HOME_URL);
        }
    }

    private void destroySession() {
        new AlertDialog.Builder(this)
            .setTitle("Destroy Session")
            .setMessage("End this disposable identity now?")
            .setPositiveButton("Destroy", (dialog, which) -> finish())
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void confirmDeviceDownload(String downloadUrl, String userAgent, String contentDisposition, String mimeType) {
        String filename = URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType);
        new AlertDialog.Builder(this)
            .setTitle("Save outside Itera")
            .setMessage(filename + " will be saved to this device and will survive after the disposable browser identity is destroyed.")
            .setPositiveButton("Save", (dialog, which) -> startDeviceDownload(downloadUrl, userAgent, filename, mimeType))
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void startDeviceDownload(String downloadUrl, String userAgent, String filename, String mimeType) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(downloadUrl));
            request.addRequestHeader("User-Agent", userAgent);
            request.setTitle(filename);
            request.setDescription("Saved outside Itera disposable session");
            request.setMimeType(mimeType);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager != null) {
                manager.enqueue(request);
                Toast.makeText(this, "Saving to device Downloads", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception error) {
            Toast.makeText(this, "Download could not be started", Toast.LENGTH_SHORT).show();
        }
    }

    private void updateAddress() {
        WebView active = getActiveWebView();
        if (active == null) {
            addressInput.setText("");
            return;
        }
        Tab tab = tabs.get(activeIndex);
        String url = tab.mobileUrl != null ? tab.mobileUrl : active.getUrl();
        addressInput.setText(HOME_URL.equals(url) || url == null || "about:blank".equals(url) ? "" : url);
    }

    private WebView getActiveWebView() {
        if (activeIndex < 0 || activeIndex >= tabs.size()) {
            return null;
        }
        return tabs.get(activeIndex).webView;
    }

    private void clearDisposableIdentity() {
        try {
            CookieManager.getInstance().removeAllCookies(null);
            CookieManager.getInstance().flush();
            WebStorage.getInstance().deleteAllData();
        } catch (Exception ignored) {
        }
        deleteChildren(getCacheDir());
        deleteChildren(new File(getApplicationInfo().dataDir, "app_webview"));
        deleteChildren(new File(getApplicationInfo().dataDir, "databases"));
    }

    private void deleteChildren(File file) {
        if (file == null || !file.exists()) {
            return;
        }
        File[] children = file.listFiles();
        if (children == null) {
            return;
        }
        for (File child : children) {
            deleteRecursively(child);
        }
    }

    private void deleteRecursively(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        file.delete();
    }

    private void hideKeyboard() {
        InputMethodManager manager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (manager != null) {
            manager.hideSoftInputFromWindow(addressInput.getWindowToken(), 0);
        }
    }

    private String homeHtml() {
        return "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#030814;color:#f3eee7;font-family:system-ui,-apple-system,Segoe UI,sans-serif;overflow-x:hidden}"
            + ".page{position:relative;min-height:100vh;display:grid;align-content:center;padding:32px 22px;background:radial-gradient(circle at 50% 30%,rgba(255,126,45,.16),transparent 32%),radial-gradient(ellipse at 50% 76%,rgba(255,138,66,.08),transparent 42%),linear-gradient(180deg,#050b18 0%,#020610 100%);overflow:hidden}"
            + ".page:before{content:'';position:absolute;left:50%;top:12%;width:300px;height:520px;transform:translateX(-50%);background:radial-gradient(ellipse at 50% 16%,rgba(255,181,77,.24) 0%,rgba(255,122,47,.16) 16%,rgba(255,122,47,.06) 33%,transparent 58%);filter:blur(12px);opacity:.78;pointer-events:none}.page:after{content:'';position:absolute;inset:auto -25% -18% -25%;height:38%;background:radial-gradient(ellipse at 50% 100%,rgba(255,117,38,.12),transparent 62%);pointer-events:none}"
            + ".hero{position:relative;z-index:1;width:min(100%,560px);margin:auto;display:grid;gap:20px;text-align:center}.mark{width:86px;height:86px;margin:auto;border-radius:27px;display:grid;place-items:center;background:linear-gradient(180deg,rgba(255,138,66,.16),rgba(255,138,66,.045));border:1px solid rgba(255,138,66,.26);box-shadow:0 24px 76px rgba(0,0,0,.38),0 0 44px rgba(255,116,44,.13)}.match{position:relative;width:42px;height:68px}.match i{position:absolute;left:10px;top:0;width:23px;height:34px;border-radius:64% 64% 54% 54%;background:linear-gradient(180deg,#ffc24a 0%,#ff7a2f 55%,#281311 100%);box-shadow:0 0 26px rgba(255,138,66,.45)}.match b{position:absolute;left:15px;top:23px;width:12px;height:41px;border-radius:999px;background:linear-gradient(90deg,#ffe0a5,#eca764 58%,#b45d2b);box-shadow:0 8px 20px rgba(255,138,66,.2)}.match span{position:absolute;left:13px;top:26px;width:16px;height:13px;border-radius:50%;background:#251816}"
            + ".brand{font-family:Georgia,serif;font-size:48px;line-height:1;color:#ff8a42;margin:0;letter-spacing:.08em;text-shadow:0 0 26px rgba(255,138,66,.18)}.copy{margin:0;color:#d3c7bd;font-size:16px}"
            + "form{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:4px;background:rgba(11,18,32,.92);border:1px solid #263247;border-radius:14px;padding:7px;box-shadow:0 24px 70px rgba(0,0,0,.34)}input{min-width:0;height:42px;background:transparent;border:0;outline:0;color:#f3eee7;font-size:15px;padding:0 11px}input::placeholder{color:#778296}button,.github{border:1px solid rgba(255,138,66,.38);border-radius:11px;background:rgba(255,138,66,.13);color:#ffd0ad;padding:0 16px;font-weight:800;text-decoration:none}"
            + ".state{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:2px}.state span{min-height:48px;display:grid;place-items:center;border:1px solid rgba(184,199,222,.12);border-radius:12px;background:rgba(6,12,24,.58);color:#a7b0c0;font-size:12px}"
            + ".cards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.card{border:1px solid rgba(184,199,222,.12);border-radius:14px;padding:13px;text-align:left;background:rgba(6,12,24,.5)}.card small{color:#ff8a42;font-weight:800}.card b{display:block;margin:7px 0 4px}.card span{color:#8f98a8;font-size:12px;line-height:1.35}.github{display:grid;place-items:center;min-height:44px;margin-top:2px}.note{color:rgba(211,199,189,.3);font-size:11px;margin:0}@media(max-width:390px){.cards{grid-template-columns:1fr}.brand{font-size:42px}.state{grid-template-columns:1fr}}</style></head>"
            + "<body><main class='page'><section class='hero'><div class='mark'><div class='match'><i></i><b></b><span></span></div></div><h1 class='brand'>ITERA</h1><p class='copy'>Every launch begins again.</p>"
            + "<form onsubmit=\"event.preventDefault();const v=q.value.trim();if(!v)return;if(/^(https?:|about:)/i.test(v)){location.href=v}else if(v.includes('.')&&!v.includes(' ')){location.href='https://'+v}else{location.href='https://duckduckgo.com/?q='+encodeURIComponent(v)}\"><input id='q' placeholder='Search or enter address'><button>Begin</button></form>"
            + "<div class='state'><span>Born now</span><span>Identity alive</span><span>No past</span></div>"
            + "<section class='cards'><div class='card'><small>01</small><b>Fresh profile</b><span>Created for this launch.</span></div><div class='card'><small>02</small><b>No continuity</b><span>No saved browser state.</span></div><div class='card'><small>03</small><b>Tabs</b><span>Inside one identity.</span></div><div class='card'><small>04</small><b>Cleanup</b><span>Session dies on close.</span></div></section>"
            + "<a class='github' href='" + PROJECT_URL + "'>Itera on GitHub</a><p class='note'>Please put a star on my project (*^‿^*)</p></section></main></body></html>";
    }

    private String errorHtml(String failedUrl) {
        return "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;min-height:100vh;background:#030814;color:#f3eee7;font-family:system-ui;display:grid;place-items:center;padding:28px;box-sizing:border-box}"
            + "main{width:min(100%,560px);border:1px solid rgba(184,199,222,.14);border-radius:8px;background:rgba(6,12,24,.72);padding:24px}.k{color:#ff8a42;font-size:12px;font-weight:800}h1{margin:14px 0 0;font-size:30px}p{color:#9aa3b2;line-height:1.5}.url{word-break:break-all;color:#5d6879;font-size:13px}button{border:1px solid rgba(255,138,66,.38);border-radius:7px;background:rgba(255,138,66,.12);color:#ffd0ad;padding:11px 15px;font-weight:700}</style></head>"
            + "<body><main><span class='k'>Connection failed</span><h1>Page did not load.</h1><p>The site could not be reached from this disposable session.</p><p class='url'>"
            + escapeHtml(failedUrl)
            + "</p><button onclick='location.reload()'>Try again</button></main></body></html>";
    }

    private String escapeHtml(String value) {
        return String.valueOf(value)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private int getStatusBarHeight() {
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            return getResources().getDimensionPixelSize(resourceId);
        }
        return dp(24);
    }

    private int color(String hex) {
        return Color.parseColor(hex);
    }

    private GradientDrawable rounded(String fillHex, String strokeHex, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color(fillHex));
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), color(strokeHex));
        return drawable;
    }

    private static class Tab {
        int id;
        String title;
        String mobileUrl;
        TextView button;
        WebView webView;
    }
}
