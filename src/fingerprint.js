'use strict';

/*
 * Anti-fingerprint shim for ITERA's disposable sessions.
 *
 * Runs in each <webview> guest's MAIN world (the webview is created with
 * contextIsolation=no) BEFORE the page's own scripts, so the values a site
 * fingerprints are consistent within a session but freshly randomized on every
 * launch — matching ITERA's "new identity each launch" model.
 *
 * The per-session profile (seed + spoofed values) comes from the main process
 * so it's coherent with the randomized user agent. Every patch is wrapped in
 * try/catch: a failure must never break the page.
 */
(function () {
  let fp;
  try { fp = require('electron').ipcRenderer.sendSync('itera:fingerprint'); } catch (_) {}
  if (!fp) return;

  // seeded PRNG (mulberry32) → noise is stable across reads in one session
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- navigator props (align with the spoofed UA) ---
  try {
    const defs = {
      hardwareConcurrency: fp.hardwareConcurrency,
      deviceMemory: fp.deviceMemory,
      platform: fp.platform,
      languages: Object.freeze(fp.languages.slice()),
    };
    Object.keys(defs).forEach((k) => {
      try { Object.defineProperty(navigator, k, { get: () => defs[k], configurable: true }); } catch (_) {}
    });
    try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); } catch (_) {}
  } catch (_) {}

  // --- canvas: subtle, session-stable noise on pixel readback / export ---
  try {
    const noise = makeRng((fp.seed ^ 0x9e3779b9) >>> 0);
    const tbl = new Int8Array(97);                      // small per-session offset table
    for (let i = 0; i < tbl.length; i++) tbl[i] = ((noise() * 3) | 0) - 1; // -1..+1

    const perturb = (data) => {
      for (let i = 0; i < data.length; i += 4) {
        const o = tbl[((i >> 2) % tbl.length + tbl.length) % tbl.length];
        if (o) {
          data[i]     = data[i]     + o < 0 ? 0 : data[i]     + o > 255 ? 255 : data[i]     + o;
          data[i + 1] = data[i + 1] + o < 0 ? 0 : data[i + 1] + o > 255 ? 255 : data[i + 1] + o;
          data[i + 2] = data[i + 2] + o < 0 ? 0 : data[i + 2] + o > 255 ? 255 : data[i + 2] + o;
        }
      }
    };

    const CtxProto = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    const origGetImageData = CtxProto && CtxProto.getImageData;
    if (origGetImageData) {
      CtxProto.getImageData = function () {
        const img = origGetImageData.apply(this, arguments);
        try { perturb(img.data); } catch (_) {}
        return img;
      };
    }

    const cvProto = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype;
    if (cvProto && cvProto.toDataURL && origGetImageData) {
      const origToDataURL = cvProto.toDataURL;
      cvProto.toDataURL = function () {
        try {
          const w = this.width, h = this.height;
          if (w && h && w * h < 8e6) {
            const c2 = document.createElement('canvas');
            c2.width = w; c2.height = h;
            const cx = c2.getContext('2d');
            cx.drawImage(this, 0, 0);
            const id = origGetImageData.call(cx, 0, 0, w, h);
            perturb(id.data);
            cx.putImageData(id, 0, 0);
            return origToDataURL.apply(c2, arguments);
          }
        } catch (_) {}
        return origToDataURL.apply(this, arguments);
      };
    }
  } catch (_) {}

  // --- WebGL: spoof the GPU vendor/renderer strings to common values ---
  try {
    const patchGL = (proto) => {
      if (!proto || !proto.getParameter) return;
      const gp = proto.getParameter;
      proto.getParameter = function (p) {
        if (p === 37445) return fp.webglVendor;    // UNMASKED_VENDOR_WEBGL
        if (p === 37446) return fp.webglRenderer;  // UNMASKED_RENDERER_WEBGL
        return gp.call(this, p);
      };
    };
    patchGL(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
    patchGL(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
  } catch (_) {}

  // --- AudioContext: inaudible session-stable noise on the fingerprintable reads ---
  try {
    const an = makeRng((fp.seed ^ 0x85ebca6b) >>> 0);
    const ABuf = window.AudioBuffer && window.AudioBuffer.prototype;
    if (ABuf && ABuf.getChannelData) {
      const gcd = ABuf.getChannelData;
      ABuf.getChannelData = function () {
        const d = gcd.apply(this, arguments);
        try { for (let i = 0; i < d.length; i += 167) d[i] += (an() - 0.5) * 1e-7; } catch (_) {}
        return d;
      };
    }
    const Analyser = window.AnalyserNode && window.AnalyserNode.prototype;
    if (Analyser && Analyser.getFloatFrequencyData) {
      const gff = Analyser.getFloatFrequencyData;
      Analyser.getFloatFrequencyData = function (arr) {
        gff.apply(this, arguments);
        try { for (let i = 0; i < arr.length; i += 53) arr[i] += (an() - 0.5) * 1e-4; } catch (_) {}
      };
    }
  } catch (_) {}
})();
