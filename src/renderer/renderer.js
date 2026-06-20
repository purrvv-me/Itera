'use strict';

(async function () {
  const cfg = await window.itera.getConfig();

  // --- elements -----------------------------------------------------------
  const startScreen = document.getElementById('start');
  const beginForm = document.getElementById('begin-form');
  const beginInput = document.getElementById('begin-input');

  const chrome = document.getElementById('chrome');
  const viewHost = document.getElementById('view');
  const addressForm = document.getElementById('address-form');
  const address = document.getElementById('address');
  const backBtn = document.getElementById('back');
  const forwardBtn = document.getElementById('forward');
  const reloadBtn = document.getElementById('reload');

  document.getElementById('min-btn').addEventListener('click', () => window.itera.minimize());
  document.getElementById('close-btn').addEventListener('click', () => window.itera.close());
  document.getElementById('kill-session').addEventListener('click', () => window.itera.killSession());

  let webview = null;

  // --- turn a query into a URL -------------------------------------------
  function toURL(raw) {
    const q = raw.trim();
    if (!q) return null;
    if (/^[a-z]+:\/\//i.test(q)) return q;                 // already has a scheme
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(q)) return 'http://' + q;
    // looks like a domain (has a dot, no spaces)
    if (/^[^\s]+\.[^\s]{2,}([\/?#].*)?$/.test(q) && !q.includes(' ')) return 'https://' + q;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(q);
  }

  // --- create the webview on first navigation ----------------------------
  function ensureWebview() {
    if (webview) return webview;
    webview = document.createElement('webview');
    webview.setAttribute('partition', cfg.partition);
    webview.setAttribute('useragent', cfg.userAgent);
    webview.setAttribute('allowpopups', 'true');
    viewHost.appendChild(webview);

    const sync = () => {
      backBtn.disabled = !webview.canGoBack();
      forwardBtn.disabled = !webview.canGoForward();
    };

    webview.addEventListener('did-navigate', (e) => { address.value = e.url; sync(); });
    webview.addEventListener('did-navigate-in-page', (e) => { address.value = e.url; sync(); });
    webview.addEventListener('did-start-loading', () => { reloadBtn.textContent = '✕'; });
    webview.addEventListener('did-stop-loading', () => { reloadBtn.textContent = '↻'; sync(); });
    webview.addEventListener('page-title-updated', (e) => { document.title = e.title + ' — ITERA'; });

    backBtn.addEventListener('click', () => webview.canGoBack() && webview.goBack());
    forwardBtn.addEventListener('click', () => webview.canGoForward() && webview.goForward());
    reloadBtn.addEventListener('click', () => {
      if (reloadBtn.textContent === '✕') webview.stop();
      else webview.reload();
    });
    return webview;
  }

  function navigate(raw) {
    const url = toURL(raw);
    if (!url) return;
    ensureWebview();
    address.value = url;
    webview.src = url;
  }

  // --- start screen -> browser -------------------------------------------
  beginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = toURL(beginInput.value);
    if (!url) return;
    startScreen.classList.add('hidden');
    chrome.classList.remove('hidden');
    navigate(beginInput.value);
  });

  // --- address bar --------------------------------------------------------
  addressForm.addEventListener('submit', (e) => {
    e.preventDefault();
    navigate(address.value);
    address.blur();
  });
  address.addEventListener('focus', () => address.select());

  beginInput.focus();
})();
