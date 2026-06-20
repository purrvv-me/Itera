'use strict';

(async function () {
  const cfg = await window.itera.getConfig();
  const preloadUrl = new URL('webview-preload.js', location.href).href;

  // --- elements -----------------------------------------------------------
  const startScreen = document.getElementById('start');
  const beginForm = document.getElementById('begin-form');
  const beginInput = document.getElementById('begin-input');

  const tabstrip = document.getElementById('tabstrip');
  const tabsEl = document.getElementById('tabs');
  const newTabBtn = document.getElementById('new-tab');

  const chrome = document.getElementById('chrome');
  const viewHost = document.getElementById('view');
  const newtab = document.getElementById('newtab');
  const newtabForm = document.getElementById('newtab-form');
  const newtabInput = document.getElementById('newtab-input');

  const addressForm = document.getElementById('address-form');
  const address = document.getElementById('address');
  const backBtn = document.getElementById('back');
  const forwardBtn = document.getElementById('forward');
  const reloadBtn = document.getElementById('reload');

  // --- window controls ----------------------------------------------------
  document.getElementById('min-btn').addEventListener('click', () => window.itera.minimize());
  const maxBtn = document.getElementById('max-btn');
  maxBtn.addEventListener('click', () => window.itera.toggleMaximize());
  window.itera.onMaximizeChange((isMax) => {
    maxBtn.classList.toggle('is-max', isMax);
    maxBtn.title = isMax ? 'Restore' : 'Maximize';
  });
  document.getElementById('titlebar').addEventListener('dblclick', (e) => {
    if (!e.target.closest('.win-controls')) window.itera.toggleMaximize();
  });
  document.getElementById('close-btn').addEventListener('click', () => window.itera.close());
  document.getElementById('kill-session').addEventListener('click', () => window.itera.killSession());

  // --- turn a query into a URL -------------------------------------------
  function toURL(raw) {
    const q = (raw || '').trim();
    if (!q) return null;
    if (/^[a-z]+:\/\//i.test(q)) return q;                 // already has a scheme
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(q)) return 'http://' + q;
    // looks like a domain (has a dot, no spaces)
    if (/^[^\s]+\.[^\s]{2,}([\/?#].*)?$/.test(q) && !q.includes(' ')) return 'https://' + q;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(q);
  }

  // ======================================================================
  //  Tabs
  // ======================================================================
  const tabs = new Map(); // id -> { id, btn, titleEl, webview, blank, url, title }
  let activeId = null;
  let seq = 0;

  function showBrowserUI() {
    startScreen.classList.add('hidden');
    tabstrip.classList.remove('hidden');
    chrome.classList.remove('hidden');
  }

  function syncNav() {
    const t = tabs.get(activeId);
    const wv = t && t.webview;
    backBtn.disabled = !(wv && !t.blank && wv.canGoBack());
    forwardBtn.disabled = !(wv && !t.blank && wv.canGoForward());
  }

  function setActive(id) {
    if (!tabs.has(id)) return;
    activeId = id;
    for (const [tid, t] of tabs) {
      const on = tid === id;
      t.btn.classList.toggle('active', on);
      if (t.webview) t.webview.classList.toggle('active', on && !t.blank);
    }
    const t = tabs.get(id);
    document.title = (t.title || 'ITERA') + ' — ITERA';
    if (t.blank) {
      newtab.classList.remove('hidden');
      address.value = '';
      backBtn.disabled = true;
      forwardBtn.disabled = true;
      reloadBtn.textContent = '↻';
      setTimeout(() => newtabInput.focus(), 0);
    } else {
      newtab.classList.add('hidden');
      address.value = t.url || '';
      reloadBtn.textContent = '↻';
      syncNav();
    }
  }

  function setTitle(t, val) {
    t.title = val || t.url || 'New tab';
    t.titleEl.textContent = t.title;
    t.btn.title = t.title;
    if (activeId === t.id) document.title = t.title + ' — ITERA';
  }

  function makeTabButton(t) {
    const btn = document.createElement('div');
    btn.className = 'tab';
    btn.dataset.id = String(t.id);
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = t.title;
    const close = document.createElement('button');
    close.className = 'tab-close';
    close.title = 'Close tab';
    close.textContent = '✕';
    btn.append(title, close);
    btn.addEventListener('click', (e) => { if (e.target !== close) setActive(t.id); });
    btn.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(t.id); }); // middle-click
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(t.id); });
    t.btn = btn;
    t.titleEl = title;
    tabsEl.appendChild(btn);
  }

  function createWebview(t, url) {
    const wv = document.createElement('webview');
    wv.className = 'tabview';
    wv.setAttribute('partition', cfg.partition);
    wv.setAttribute('useragent', cfg.userAgent);
    wv.setAttribute('allowpopups', 'true');
    wv.setAttribute('preload', preloadUrl);
    viewHost.appendChild(wv);
    t.webview = wv;

    wv.addEventListener('page-title-updated', (e) => setTitle(t, e.title));
    const onNav = (e) => {
      if (e.url) {
        t.url = e.url;
        if (activeId === t.id) address.value = e.url;
      }
      if (activeId === t.id) syncNav();
    };
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    wv.addEventListener('did-start-loading', () => { if (activeId === t.id) reloadBtn.textContent = '✕'; });
    wv.addEventListener('did-stop-loading', () => {
      if (activeId === t.id) { reloadBtn.textContent = '↻'; syncNav(); }
    });
    wv.src = url;
    return wv;
  }

  function createTab(opts = {}) {
    const id = ++seq;
    const t = { id, btn: null, titleEl: null, webview: null, blank: true, url: '', title: 'New tab' };
    tabs.set(id, t);
    makeTabButton(t);
    showBrowserUI();
    if (opts.url) {
      t.blank = false;
      t.url = opts.url;
      setTitle(t, opts.url);
      createWebview(t, opts.url);
    }
    if (opts.activate !== false) setActive(id);
    return t;
  }

  function closeTab(id) {
    const t = tabs.get(id);
    if (!t) return;
    if (t.webview) t.webview.remove();
    t.btn.remove();
    tabs.delete(id);
    if (activeId === id) {
      const remaining = [...tabs.keys()];
      if (remaining.length) {
        setActive(remaining[remaining.length - 1]);
      } else {
        // no tabs left → back to the clean start screen
        activeId = null;
        tabstrip.classList.add('hidden');
        chrome.classList.add('hidden');
        newtab.classList.add('hidden');
        startScreen.classList.remove('hidden');
        beginInput.value = '';
        beginInput.focus();
      }
    }
  }

  // navigate the active tab (address bar + new-tab page)
  function navigateActive(raw) {
    const url = toURL(raw);
    if (!url) return;
    const t = tabs.get(activeId);
    if (!t) { createTab({ url }); return; }
    t.blank = false;
    t.url = url;
    setTitle(t, url);
    if (t.webview) t.webview.src = url;
    else createWebview(t, url);
    setActive(t.id);
  }

  // --- events -------------------------------------------------------------
  newTabBtn.addEventListener('click', () => createTab());
  newtabForm.addEventListener('submit', (e) => { e.preventDefault(); navigateActive(newtabInput.value); });

  beginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = toURL(beginInput.value);
    if (!url) return;
    createTab({ url });
  });

  addressForm.addEventListener('submit', (e) => {
    e.preventDefault();
    navigateActive(address.value);
    address.blur();
  });
  address.addEventListener('focus', () => address.select());

  backBtn.addEventListener('click', () => {
    const t = tabs.get(activeId);
    if (t && t.webview && t.webview.canGoBack()) t.webview.goBack();
  });
  forwardBtn.addEventListener('click', () => {
    const t = tabs.get(activeId);
    if (t && t.webview && t.webview.canGoForward()) t.webview.goForward();
  });
  reloadBtn.addEventListener('click', () => {
    const t = tabs.get(activeId);
    if (!t || !t.webview) return;
    if (reloadBtn.textContent === '✕') t.webview.stop();
    else t.webview.reload();
  });

  // links that try to open a new window become new tabs
  window.itera.onNewTab((payload) => {
    const url = payload && payload.url;
    if (!url) return;
    createTab({ url, activate: !(payload && payload.background) });
  });

  beginInput.focus();
})();
