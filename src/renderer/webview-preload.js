'use strict';

// Runs inside every page ITERA loads. Removes DuckDuckGo's "use our browser"
// nags (and similar first-party promos). Their CSS classes are randomized
// hashes that change between builds, so we match by content and remove the
// whole promo card. Node removal isn't subject to the page's CSP.

(function () {
  // Stable, class-based promos (the hamburger-menu promo, react wrapper).
  const SELECTORS = [
    '.nav-menu__promo',
    '.js-side-menu-promo',
    '#react-browser-update-info',
    '.badge-link--download',
  ];

  // The floating card has hashed classes but stable copy. Match it by text.
  function isPromo(t) {
    return (
      /duckduckgo/i.test(t) &&
      /(браузер|browser)/i.test(t) &&
      /(попроб|переход|перейд|скач|download|try|get the|switch|install|загруз)/i.test(t)
    );
  }

  function sweep() {
    try {
      for (const sel of SELECTORS) {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      }
      const els = document.querySelectorAll('aside, section, div, li, article');
      for (const el of els) {
        if (!el.isConnected) continue;
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length === 0 || t.length > 220 || !isPromo(t)) continue;
        // climb up to the whole floating card, but stop before swallowing
        // unrelated page content.
        let card = el;
        let p = el;
        for (let i = 0; i < 6 && p.parentElement && p.parentElement !== document.body; i++) {
          const pt = (p.parentElement.textContent || '').trim();
          if (pt.length > 240) break;
          p = p.parentElement;
          card = p;
        }
        card.remove();
      }
    } catch {
      /* never break the page */
    }
  }

  function start() {
    sweep();
    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; sweep(); }, 150);
    });
    if (document.documentElement) {
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
    // the promo is injected late and after SPA navigations
    [400, 1000, 2200, 4000].forEach((d) => setTimeout(sweep, d));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
