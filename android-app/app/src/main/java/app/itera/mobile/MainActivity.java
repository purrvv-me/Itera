package app.itera.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;
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
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(color("#030814"));
        setContentView(root);

        LinearLayout chrome = new LinearLayout(this);
        chrome.setOrientation(LinearLayout.VERTICAL);
        chrome.setPadding(dp(10), dp(6), dp(10), dp(8));
        chrome.setBackgroundColor(color("#171922"));
        root.addView(chrome, new LinearLayout.LayoutParams(-1, -2));

        HorizontalScrollView tabScroll = new HorizontalScrollView(this);
        tabScroll.setHorizontalScrollBarEnabled(false);
        tabStrip = new LinearLayout(this);
        tabStrip.setOrientation(LinearLayout.HORIZONTAL);
        tabScroll.addView(tabStrip, new HorizontalScrollView.LayoutParams(-2, dp(42)));
        chrome.addView(tabScroll, new LinearLayout.LayoutParams(-1, dp(42)));

        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        chrome.addView(controls, new LinearLayout.LayoutParams(-1, dp(48)));

        controls.addView(tool("‹", v -> goBack()));
        controls.addView(tool("›", v -> goForward()));
        controls.addView(tool("↻", v -> reload()));
        controls.addView(tool("⌂", v -> openHome()));

        addressInput = new EditText(this);
        addressInput.setSingleLine(true);
        addressInput.setHint("Search or enter address");
        addressInput.setHintTextColor(color("#707B8D"));
        addressInput.setTextColor(color("#F3EEE7"));
        addressInput.setTextSize(15);
        addressInput.setPadding(dp(14), 0, dp(14), 0);
        addressInput.setBackgroundColor(color("#20232C"));
        addressInput.setOnEditorActionListener((v, actionId, event) -> {
            navigate(addressInput.getText().toString());
            hideKeyboard();
            return true;
        });
        controls.addView(addressInput, new LinearLayout.LayoutParams(0, dp(40), 1));

        controls.addView(tool("+", v -> createTab(HOME_URL, true)));
        controls.addView(tool("×", v -> destroySession()));

        webContainer = new FrameLayout(this);
        root.addView(webContainer, new LinearLayout.LayoutParams(-1, 0, 1));
    }

    private TextView tool(String label, View.OnClickListener listener) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setTextColor(color("#9AA3B2"));
        view.setTextSize(24);
        view.setGravity(Gravity.CENTER);
        view.setOnClickListener(listener);
        view.setBackgroundColor(Color.TRANSPARENT);
        view.setLayoutParams(new LinearLayout.LayoutParams(dp(38), dp(40)));
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
            public void onReceivedTitle(WebView view, String title) {
                if (title != null && !title.trim().isEmpty() && !HOME_URL.equals(view.getUrl())) {
                    tab.title = title.trim();
                    renderTabs();
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (HOME_URL.equals(url)) {
                    tab.title = "New identity";
                }
                updateAddress();
                renderTabs();
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
        button.setTextSize(14);
        button.setGravity(Gravity.CENTER_VERTICAL);
        button.setPadding(dp(12), 0, dp(10), 0);
        button.setOnClickListener(v -> activateTab(tabs.indexOf(tab)));
        button.setOnLongClickListener(v -> {
            closeTab(tabs.indexOf(tab));
            return true;
        });
        button.setLayoutParams(new LinearLayout.LayoutParams(dp(156), dp(38)));
        return button;
    }

    private void renderTabs() {
        for (int i = 0; i < tabs.size(); i++) {
            Tab tab = tabs.get(i);
            boolean active = i == activeIndex;
            tab.button.setText("▏ " + tab.title + "  ×");
            tab.button.setBackgroundColor(active ? color("#252936") : color("#171922"));
            tab.button.setAlpha(active ? 1f : 0.82f);
        }
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
            tab.webView.loadDataWithBaseURL(HOME_URL, homeHtml(), "text/html", "UTF-8", null);
            return;
        }
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

    private void updateAddress() {
        WebView active = getActiveWebView();
        if (active == null) {
            addressInput.setText("");
            return;
        }
        String url = active.getUrl();
        addressInput.setText(HOME_URL.equals(url) ? "" : url);
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
            + "<style>body{margin:0;min-height:100vh;background:#030814;color:#f3eee7;font-family:system-ui;display:grid;place-items:center;padding:28px;box-sizing:border-box;}"
            + "main{width:min(100%,680px);display:grid;gap:22px;text-align:center}.cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}.card{border:1px solid rgba(184,199,222,.14);border-radius:8px;padding:14px;text-align:left;background:rgba(6,12,24,.62)}"
            + ".n{color:#ff8a42;font-size:12px}.card b{display:block;margin:8px 0 5px}.card span{color:#9aa3b2;font-size:13px}.match{font-size:48px;color:#ff8a42}.brand{font-family:Georgia,serif;font-size:56px;color:#ff8a42;margin:0}.copy{color:#d3c7bd;margin:0}"
            + "form{display:grid;grid-template-columns:1fr auto;gap:8px;background:#0b1220;border:1px solid #202b3d;border-radius:8px;padding:7px}input{min-width:0;background:transparent;border:0;outline:0;color:#f3eee7;font-size:16px;padding:0 10px}button,.github{border:1px solid rgba(255,138,66,.38);border-radius:7px;background:rgba(255,138,66,.12);color:#ffd0ad;padding:11px 15px;font-weight:700;text-decoration:none}.note{color:rgba(211,199,189,.34);font-size:12px;margin:0}@media(max-width:560px){.cards{grid-template-columns:1fr}.brand{font-size:44px}}</style></head>"
            + "<body><main><section class='cards'><div class='card'><span class='n'>01</span><b>Fresh profile</b><span>Born for this launch only</span></div><div class='card'><span class='n'>02</span><b>No continuity</b><span>No account, sync, or saved state</span></div><div class='card'><span class='n'>03</span><b>Temporary storage</b><span>Session data dies with the window</span></div><div class='card'><span class='n'>04</span><b>Silent cleanup</b><span>No past survives after close</span></div></section>"
            + "<div class='match'>▌</div><h1 class='brand'>ITERA</h1><p class='copy'>Every launch begins again.</p><form onsubmit=\"event.preventDefault();const v=q.value.trim();if(!v)return;if(v.includes('.')&&!v.includes(' ')){location.href='https://'+v}else{location.href='https://duckduckgo.com/?q='+encodeURIComponent(v)}\"><input id='q' placeholder='Search or enter address'><button>Begin</button></form>"
            + "<a class='github' href='" + PROJECT_URL + "'>Itera on GitHub</a><p class='note'>Please put a star on my project (*^‿^*)</p></main></body></html>";
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private int color(String hex) {
        return Color.parseColor(hex);
    }

    private static class Tab {
        int id;
        String title;
        TextView button;
        WebView webView;
    }
}
