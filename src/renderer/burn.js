'use strict';

/*
 * ITERA "burn the session" animation.
 *
 * Ported from the Claude Design component (ITERA Burn.dc.html) to vanilla JS.
 * The whole browser chrome (#win) is eaten away by a ragged fire edge that
 * spreads from wherever the user clicked (Kill session / Close), throwing off
 * embers, smoke and charred ash. When the window is fully consumed we invoke
 * the supplied callback — which fires the *real* wipe (visible cleanup
 * terminal) and quits.
 */
window.IteraBurn = (function () {
  const BURN_DURATION_SEC = 3.2;
  const EMBER_INTENSITY = 1;

  let running = false;

  function el(id) { return document.getElementById(id); }

  // Gradient/mask string builders. We write the *full* string with literal
  // pixel values every frame rather than relying on a CSS custom property
  // (Chromium does not reliably repaint a mask-image/background gradient when
  // only a var() inside it changes), so the front animates on every machine.
  const px = (n) => n.toFixed(1) + 'px';
  // Opaque charred fill that consumes the window from the ignition point
  // outward. Solid blackened interior -> brown char at the burning edge ->
  // transparent just beyond the front. Being opaque, it reads on any page
  // (bright or dark) without relying on masking the window away.
  function charBgStr(cx, cy, r) {
    return 'radial-gradient(circle at ' + px(cx) + ' ' + px(cy) + ',' +
      ' #080705 0px,' +
      ' #080705 ' + px(r - 24) + ',' +
      ' #0c0907 ' + px(r - 12) + ',' +
      ' #2a1408 ' + px(r - 6) + ',' +
      ' #5a2a0e ' + px(r) + ',' +
      ' rgba(60,29,10,0.4) ' + px(r + 14) + ',' +
      ' rgba(40,20,8,0) ' + px(r + 28) + ',' +
      ' transparent 260vmax)';
  }
  function emberBgStr(cx, cy, r) {
    return 'radial-gradient(circle at ' + px(cx) + ' ' + px(cy) + ',' +
      ' transparent ' + px(r - 42) + ', rgba(255,80,0,0) ' + px(r - 30) + ', #ff3b00 ' + px(r - 13) +
      ', #ff9a2e ' + px(r - 4) + ', #ffeec0 ' + px(r) + ', rgba(255,150,40,0.55) ' + px(r + 9) +
      ', rgba(255,90,0,0) ' + px(r + 24) + ', transparent 260vmax)';
  }

  // Set the static layer properties once at the start of a burn. We avoid SVG
  // filters (animated feTurbulence rendered as sparkly noise and was flaky
  // across GPU frames) and CSS masks (unreliable over a webview) entirely:
  // the burn is just an opaque charred fill + a soft glowing ember edge +
  // canvas particles, which renders identically every time.
  function prime() {
    const char = el('burn-char');
    char.style.filter = 'blur(1.5px)';
    char.style.mixBlendMode = 'normal';

    const ember = el('burn-ember');
    ember.style.filter = 'blur(2px)';
    ember.style.mixBlendMode = 'screen';
  }

  function trigger(originEl, onComplete) {
    if (running) return;
    running = true;
    prime();

    const screen = el('screen');
    const win = el('win');
    const ember = el('burn-ember');
    const char = el('burn-char');
    const ignite = el('burn-ignite');
    const cv = el('burn-canvas');

    // bring the (normally display:none) burn layers into the compositor
    for (const n of [char, ember, ignite, cv]) n.style.display = 'block';
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

    ember.style.opacity = '1';
    char.style.opacity = '1';

    // char/ember fill the whole screen (inset:0), so the origin is screen-space.
    const paint = (r) => {
      char.style.background = charBgStr(cx, cy, r);
      ember.style.background = emberBgStr(cx, cy, r);
    };
    paint(0);

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
    const t0 = performance.now();
    let last = t0;

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
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const tRaw = (now - t0) / dur;
      const t = Math.min(tRaw, 1);
      const r = ease(t) * maxR;
      paint(r);

      if (tRaw < 1) spawn(r);

      ctx.clearRect(0, 0, W, H);
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

      const done = tRaw >= 1.05 && embers.length < 4 && smoke.length < 2;
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
