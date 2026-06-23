'use strict';

(async function () {
  const cfg = await window.itera.getConfig();

  // Hide DuckDuckGo's first-party "use our browser" promos via a user stylesheet
  // (insertCSS bypasses page CSP and never mutates the DOM, so React stays intact).
  const BLOCK_CSS = `
    [data-testid="serp-popover-promo"],
    .nav-menu__promo,
    .js-side-menu-promo,
    #react-browser-update-info { display: none !important; }
  `;

  // --- elements -----------------------------------------------------------
  const titlebar = document.getElementById('titlebar');
  const tabsEl = document.getElementById('tabs');
  const newTabBtn = document.getElementById('new-tab');

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
  titlebar.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.wctrls, .newtab')) window.itera.toggleMaximize();
  });
  // Kill session / close: burn the whole window away from the clicked button,
  // then fire the real wipe (visible cleanup terminal) + quit.
  let ending = false;
  function endSession(originEl, action) {
    if (ending) return;
    ending = true;
    if (window.IteraBurn && !window.IteraBurn.reducedMotion()) {
      window.IteraBurn.trigger(originEl, action);
    } else {
      action();
    }
  }
  const closeBtn = document.getElementById('close-btn');
  const killBtn = document.getElementById('kill-session');
  closeBtn.addEventListener('click', () => endSession(closeBtn, () => window.itera.close()));
  killBtn.addEventListener('click', () => endSession(killBtn, () => window.itera.killSession()));

  // --- omnibox focus styling ----------------------------------------------
  address.addEventListener('focus', () => { addressForm.classList.add('focus'); address.select(); });
  address.addEventListener('blur', () => addressForm.classList.remove('focus'));

  // --- turn a query into a URL -------------------------------------------
  function toURL(raw) {
    const q = (raw || '').trim();
    if (!q) return null;
    if (/^[a-z]+:\/\//i.test(q)) return q;
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(q)) return 'http://' + q;
    if (/^[^\s]+\.[^\s]{2,}([\/?#].*)?$/.test(q) && !q.includes(' ')) return 'https://' + q;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(q);
  }

  // ======================================================================
  //  Tabs
  // ======================================================================
  const tabs = new Map(); // id -> { id, btn, titleEl, favEl, webview, blank, url, title }
  let activeId = null;
  let seq = 0;

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
      t.btn.classList.toggle('idle', !on);
      if (t.webview) t.webview.classList.toggle('active', on && !t.blank);
    }
    const t = tabs.get(id);
    document.title = (t.title || 'ITERA') + ' — ITERA';
    if (t.blank) {
      newtab.classList.remove('hidden');
      address.value = '';
      backBtn.disabled = true;
      forwardBtn.disabled = true;
      setTimeout(() => newtabInput.focus(), 0);
    } else {
      newtab.classList.add('hidden');
      address.value = t.url || '';
      syncNav();
    }
  }

  function setTitle(t, val) {
    t.title = (val && val.trim()) || t.url || 'New tab';
    t.titleEl.textContent = t.title;
    t.btn.title = t.title;
    if (activeId === t.id) document.title = t.title + ' — ITERA';
  }

  function makeTabButton(t) {
    const btn = document.createElement('div');
    btn.className = 'tab idle';
    btn.dataset.id = String(t.id);

    const fav = document.createElement('span');
    fav.className = 'fav';

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = t.title;

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.title = 'Close tab';
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

    btn.append(fav, title, close);
    btn.addEventListener('mousedown', (e) => { if (e.target.closest('.tab-close')) return; if (e.button === 0) setActive(t.id); });
    btn.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(t.id); }); // middle-click closes
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(t.id); });

    t.btn = btn;
    t.titleEl = title;
    t.favEl = fav;
    tabsEl.appendChild(btn);
  }

  function createWebview(t, url) {
    const wv = document.createElement('webview');
    wv.className = 'tabview';
    wv.setAttribute('partition', cfg.partition);
    wv.setAttribute('useragent', cfg.userAgent);
    wv.setAttribute('allowpopups', 'true');
    viewHost.appendChild(wv);
    t.webview = wv;

    wv.addEventListener('dom-ready', () => { wv.insertCSS(BLOCK_CSS).catch(() => {}); });
    wv.addEventListener('page-title-updated', (e) => setTitle(t, e.title));
    wv.addEventListener('page-favicon-updated', (e) => {
      const ic = e.favicons && e.favicons[0];
      if (ic) t.favEl.style.backgroundImage = `url("${ic}")`;
    });
    const onNav = (e) => {
      if (e.url) {
        t.url = e.url;
        if (activeId === t.id) address.value = e.url;
      }
      if (activeId === t.id) syncNav();
    };
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    wv.addEventListener('did-start-loading', () => { if (activeId === t.id) reloadBtn.classList.add('loading'); });
    wv.addEventListener('did-stop-loading', () => {
      if (activeId === t.id) { reloadBtn.classList.remove('loading'); syncNav(); }
    });
    wv.src = url;
    return wv;
  }

  function createTab(opts = {}) {
    const id = ++seq;
    const t = { id, btn: null, titleEl: null, favEl: null, webview: null, blank: true, url: '', title: 'New tab' };
    tabs.set(id, t);
    makeTabButton(t);
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
      if (remaining.length) setActive(remaining[remaining.length - 1]);
      else createTab(); // always keep at least one (blank) tab
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

  addressForm.addEventListener('submit', (e) => {
    e.preventDefault();
    navigateActive(address.value);
    address.blur();
  });

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
    if (reloadBtn.classList.contains('loading')) t.webview.stop();
    else t.webview.reload();
  });

  // links that try to open a new window become new tabs
  window.itera.onNewTab((payload) => {
    const url = payload && payload.url;
    if (!url) return;
    createTab({ url, activate: !(payload && payload.background) });
  });

  // open with one fresh home tab
  createTab();
})();
