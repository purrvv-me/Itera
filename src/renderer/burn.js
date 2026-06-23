'use strict';

/*
 * ITERA "burn the session" animation.
 *
 * Ported from the Claude Design component (ITERA Burn.dc.html) to vanilla JS.
 * The whole browser chrome is eaten away by a fire edge that spreads from
 * wherever the user clicked (Kill session / Close), throwing off embers, smoke
 * and charred ash. When the window is fully consumed we invoke the supplied
 * callback — which fires the *real* wipe (visible cleanup terminal) and quits.
 *
 * Everything visual is drawn on a single <canvas>: the opaque charred fill, the
 * glowing fire edge AND the particles. Earlier versions painted the char/ember
 * front onto CSS DOM layers (a radial-gradient rewritten every frame), but
 * Chromium does not reliably re-rasterize a gradient background layer per frame
 * — on some machines the front jumped straight to full size and the user saw a
 * single flash instead of a spreading burn. The canvas, by contrast, is
 * cleared and redrawn every frame, so the spread animates identically on every
 * GPU.
 */
window.IteraBurn = (function () {
  const BURN_DURATION_SEC = 3.2;
  const EMBER_INTENSITY = 1;

  let running = false;

  function el(id) { return document.getElementById(id); }

  // Build a radial gradient on the canvas context from stops given in *pixel*
  // radii. Offsets are clamped to [0,1] and forced monotonic so early frames
  // (where r is tiny and inner radii go negative) stay valid.
  function radial(ctx, cx, cy, outer, stops) {
    const o = Math.max(outer, 1);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o);
    let prev = 0;
    for (let i = 0; i < stops.length; i++) {
      let off = stops[i][0] / o;
      if (off < 0) off = 0; else if (off > 1) off = 1;
      if (off < prev) off = prev;
      g.addColorStop(off, stops[i][1]);
      prev = off;
    }
    return g;
  }

  // Opaque charred fill that consumes the screen from the ignition point
  // outward: solid blackened interior -> brown char at the burning edge ->
  // transparent just beyond the front. Being opaque it reads on any page
  // (bright or dark) without relying on masking the window away.
  function charStops(r) {
    return [
      [0, '#080705'],
      [r - 24, '#080705'],
      [r - 12, '#0c0907'],
      [r - 6, '#2a1408'],
      [r, '#5a2a0e'],
      [r + 14, 'rgba(60,29,10,0.4)'],
      [r + 28, 'rgba(40,20,8,0)'],
    ];
  }
  // Glowing fire edge, drawn additively ('lighter') over the char fill.
  function emberStops(r) {
    return [
      [0, 'rgba(255,80,0,0)'],
      [r - 30, 'rgba(255,80,0,0)'],
      [r - 13, '#ff3b00'],
      [r - 4, '#ff9a2e'],
      [r, '#ffeec0'],
      [r + 9, 'rgba(255,150,40,0.55)'],
      [r + 24, 'rgba(255,90,0,0)'],
    ];
  }

  function trigger(originEl, onComplete) {
    if (running) return;
    running = true;

    const screen = el('screen');
    const win = el('win');
    const ignite = el('burn-ignite');
    const cv = el('burn-canvas');

    // bring the (normally display:none) burn layers into the compositor
    for (const n of [ignite, cv]) n.style.display = 'block';
    // .burning darkens #view and hides any live webview so the page can't flash
    // white in the area the fire hasn't reached yet.
    if (win) win.classList.add('burning');

    // Robust dimensions: fall back to the viewport if layout isn't measured yet,
    // so the fire front always has the right size to sweep across (a zero rect
    // would otherwise leave the effect stuck as sparks at the origin).
    const rect = screen.getBoundingClientRect();
    const W = Math.max(rect.width || window.innerWidth || 1200, 320);
    const H = Math.max(rect.height || window.innerHeight || 800, 240);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ignition origin = the button that was clicked (fallback: top-right)
    let cx = W * 0.92, cy = 70;
    if (originEl) {
      const b = originEl.getBoundingClientRect();
      if (b.width) { cx = b.left + b.width / 2 - rect.left; cy = b.top + b.height / 2 - rect.top; }
    }
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 90;

    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    // ignition flash at the click point
    ignite.style.left = cx + 'px';
    ignite.style.top = cy + 'px';
    ignite.style.transition = 'none';
    ignite.style.opacity = '1';
    ignite.style.transform = 'translate(-50%,-50%) scale(0.2)';
    requestAnimationFrame(() => {
      ignite.style.transition = 'opacity .6s ease, transform .6s ease';
      ignite.style.transform = 'translate(-50%,-50%) scale(1.6)';
      ignite.style.opacity = '0';
    });

    const dur = BURN_DURATION_SEC * 1000;
    const dens = EMBER_INTENSITY;
    // Anchor the clock to the FIRST rAF timestamp, not performance.now(). The
    // value passed to a rAF callback and performance.now() are meant to share a
    // time origin, but in some Electron builds they intermittently don't — when
    // they diverge, (now - t0) is already > the whole duration on frame one, so
    // the burn "finished" in a single frame and the user saw an instant flash
    // instead of an animation. Deriving both t0 and dt from the rAF clock keeps
    // the first frame at t=0 every single time.
    let t0 = null;
    let last = 0;

    const embers = [], smoke = [], ash = [];
    const ease = (t) => Math.pow(t, 1.22);

    const spawn = (r) => {
      const n = Math.round((4 + Math.random() * 5) * dens);
      for (let i = 0; i < n; i++) {
        const a = (50 + Math.random() * 165) * Math.PI / 180;
        const rr = r - Math.random() * 18;
        const x = cx + rr * Math.cos(a);
        const y = cy + rr * Math.sin(a);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        embers.push({
          x, y, vx: (Math.random() - 0.5) * 46, vy: -(40 + Math.random() * 120),
          life: 0.7 + Math.random() * 0.9, max: 1.6,
          size: 1 + Math.random() * 2.4, ph: Math.random() * 6.28
        });
      }
      if (Math.random() < 0.55 * dens) {
        const a = (60 + Math.random() * 140) * Math.PI / 180;
        const x = cx + (r - 30) * Math.cos(a);
        const y = cy + (r - 30) * Math.sin(a);
        if (x > -40 && x < W + 40 && y > -40 && y < H + 40) {
          smoke.push({
            x, y, vx: (Math.random() - 0.5) * 20, vy: -(18 + Math.random() * 26),
            life: 1.6 + Math.random() * 1.4, max: 3, size: 26 + Math.random() * 34
          });
        }
      }
      const an = Math.round((1 + Math.random() * 2) * dens);
      for (let i = 0; i < an; i++) {
        const a = (55 + Math.random() * 160) * Math.PI / 180;
        const rr = r - 8 - Math.random() * 46;
        const x = cx + rr * Math.cos(a);
        const y = cy + rr * Math.sin(a);
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
        ash.push({
          x, y, vx: (Math.random() - 0.5) * 34, vy: -(8 + Math.random() * 30),
          g: 34 + Math.random() * 34, life: 1.4 + Math.random() * 1.8, max: 3.2,
          size: 2 + Math.random() * 4.5, rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 6, ph: Math.random() * 6.28,
          warm: Math.random() < 0.3
        });
      }
    };

    let raf = null;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { ctx.clearRect(0, 0, W, H); } catch (_) {}
      if (win) win.style.opacity = '0';
      if (typeof onComplete === 'function') onComplete();
    };
    const step = (now) => {
     try {
      if (t0 === null) { t0 = now; last = now; }
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const tRaw = (now - t0) / dur;
      const t = Math.min(tRaw, 1);
      const r = ease(t) * maxR;
      // optional, production-inert instrumentation: the crash-test harness sets
      // window.__burnFrame to record per-frame progress (never set in the app).
      if (typeof window.__burnFrame === 'function') { try { window.__burnFrame(t, r, maxR); } catch (_) {} }

      if (tRaw < 1) spawn(r);

      ctx.clearRect(0, 0, W, H);

      // 1) opaque charred fill — grows from the ignition point every frame.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = radial(ctx, cx, cy, r + 28, charStops(r));
      ctx.fillRect(0, 0, W, H);

      // 2) glowing fire edge, added on top.
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = radial(ctx, cx, cy, r + 24, emberStops(r));
      ctx.fillRect(0, 0, W, H);

      // 3) smoke (soft dark puffs rising off the front).
      ctx.globalCompositeOperation = 'source-over';
      for (let i = smoke.length - 1; i >= 0; i--) {
        const p = smoke[i];
        p.life -= dt; if (p.life <= 0) { smoke.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.size += 22 * dt; p.vy *= 0.99;
        const lr = p.life / p.max;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, 'rgba(40,36,32,' + (0.16 * lr) + ')');
        g.addColorStop(1, 'rgba(20,18,16,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
      }
      // 4) ash flakes (tumbling charred bits).
      for (let i = ash.length - 1; i >= 0; i--) {
        const p = ash[i];
        p.life -= dt; if (p.life <= 0) { ash.splice(i, 1); continue; }
        p.vy += p.g * dt; p.ph += dt * 4;
        p.x += (p.vx + Math.sin(p.ph) * 20) * dt;
        p.y += p.vy * dt; p.rot += p.vr * dt;
        const lr = Math.max(p.life / p.max, 0);
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(lr * 0.7, 0.7);
        ctx.fillStyle = p.warm ? '#5a2a0e' : '#16110d';
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.68);
        ctx.restore();
      }
      // 5) embers (bright sparks, added).
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = embers.length - 1; i >= 0; i--) {
        const p = embers[i];
        p.life -= dt; if (p.life <= 0) { embers.splice(i, 1); continue; }
        p.ph += dt * 14;
        p.x += (p.vx + Math.sin(p.ph) * 14) * dt;
        p.y += p.vy * dt; p.vy += 6 * dt;
        const lr = Math.max(p.life / p.max, 0);
        const fl = 0.6 + 0.4 * Math.sin(p.ph * 1.7);
        const s = p.size * (0.5 + lr * 0.9);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 3);
        g.addColorStop(0, 'rgba(255,246,210,' + (lr * fl) + ')');
        g.addColorStop(0.4, 'rgba(255,140,20,' + (lr * fl * 0.8) + ')');
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 3, 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Finish as soon as the fire front has covered the whole screen. The
      // screen is fully charred (opaque black) by now, so lingering particles
      // add nothing visible — waiting for them to drain made the finish time
      // (and thus the exit) drift unpredictably between ~3.4s and ~6s.
      const done = tRaw >= 1.05;
      if (!done) {
        raf = requestAnimationFrame(step);
      } else {
        finish();
      }
     } catch (_) {
      // never leave a half-drawn frame frozen on screen — just complete.
      finish();
     }
    };
    raf = requestAnimationFrame(step);
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return { trigger, reducedMotion };
})();
