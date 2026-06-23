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
  const BURN_DURATION_SEC = 3.4;
  const EMBER_INTENSITY = 1;

  let running = false;

  function el(id) { return document.getElementById(id); }

  // Build the radial masks/gradients once, parameterised by --cx/--cy/--r.
  function prime() {
    const win = el('win');
    const winMask =
      'radial-gradient(circle at var(--cx,95%) var(--cy,6%),' +
      ' transparent 0,' +
      ' transparent calc(var(--r,0px) - 42px),' +
      ' #000 calc(var(--r,0px) + 26px),' +
      ' #000 260vmax)';
    win.style.setProperty('--r', '0px');
    win.style.willChange = 'mask';
    win.style.webkitMaskImage = winMask;
    win.style.maskImage = winMask;
    win.style.webkitMaskRepeat = 'no-repeat';
    win.style.maskRepeat = 'no-repeat';

    // the paper bookmark tabs burn away on the same front (screen-space)
    const tabstrip = el('tabstrip');
    if (tabstrip) {
      tabstrip.style.setProperty('--r', '0px');
      tabstrip.style.willChange = 'mask';
      tabstrip.style.webkitMaskImage = winMask;
      tabstrip.style.maskImage = winMask;
      tabstrip.style.webkitMaskRepeat = 'no-repeat';
      tabstrip.style.maskRepeat = 'no-repeat';
    }

    const char = el('burn-char');
    char.style.setProperty('--r', '0px');
    char.style.background =
      'radial-gradient(circle at var(--cx,95%) var(--cy,6%),' +
      ' #060504 calc(var(--r,0px) - 120px),' +
      ' #0a0807 calc(var(--r,0px) - 44px),' +
      ' #190d06 calc(var(--r,0px) - 12px),' +
      ' #3c1d0a calc(var(--r,0px) + 6px),' +
      ' #281507 calc(var(--r,0px) + 38px),' +
      ' #161009 calc(var(--r,0px) + 60px))';
    const charMask =
      'radial-gradient(circle at var(--cx,95%) var(--cy,6%),' +
      ' transparent 0,' +
      ' transparent calc(var(--r,0px) - 150px),' +
      ' rgba(0,0,0,0.85) calc(var(--r,0px) - 118px),' +
      ' #000 calc(var(--r,0px) - 60px),' +
      ' #000 calc(var(--r,0px) - 12px),' +
      ' rgba(0,0,0,0.6) calc(var(--r,0px) + 6px),' +
      ' rgba(0,0,0,0.26) calc(var(--r,0px) + 36px),' +
      ' transparent calc(var(--r,0px) + 62px),' +
      ' transparent 260vmax)';
    char.style.webkitMaskImage = charMask;
    char.style.maskImage = charMask;
    char.style.webkitMaskRepeat = 'no-repeat';
    char.style.maskRepeat = 'no-repeat';
    char.style.filter = 'url(#tear)';
    char.style.mixBlendMode = 'multiply';

    const ember = el('burn-ember');
    ember.style.setProperty('--r', '0px');
    ember.style.background =
      'radial-gradient(circle at var(--cx,95%) var(--cy,6%),' +
      ' transparent calc(var(--r,0px) - 42px),' +
      ' rgba(255,80,0,0) calc(var(--r,0px) - 30px),' +
      ' #ff3b00 calc(var(--r,0px) - 13px),' +
      ' #ff9a2e calc(var(--r,0px) - 4px),' +
      ' #ffeec0 var(--r,0px),' +
      ' rgba(255,150,40,0.55) calc(var(--r,0px) + 9px),' +
      ' rgba(255,90,0,0) calc(var(--r,0px) + 24px),' +
      ' transparent 260vmax)';
    ember.style.filter = 'url(#tear) blur(0.5px)';
    ember.style.mixBlendMode = 'screen';
  }

  function trigger(originEl, onComplete) {
    if (running) return;
    running = true;
    prime();

    const screen = el('screen');
    const win = el('win');
    const tabstrip = el('tabstrip');
    const ember = el('burn-ember');
    const char = el('burn-char');
    const ignite = el('burn-ignite');
    const cv = el('burn-canvas');

    // bring the (normally display:none) burn layers into the compositor
    for (const n of [char, ember, ignite, cv]) n.style.display = 'block';
    win.classList.add('burning');

    const rect = screen.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ignition origin = the button that was clicked (fallback: top-right)
    let cx = W * 0.95, cy = 70;
    if (originEl) {
      const b = originEl.getBoundingClientRect();
      cx = b.left + b.width / 2 - rect.left;
      cy = b.top + b.height / 2 - rect.top;
    }
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 90;
    const centerDist = Math.hypot(cx - W / 2, cy - H / 2);

    // full-screen layers (ember/char) share the screen origin; #win and the
    // tab strip are inset, so shift each mask origin by the element's own
    // top-left to keep one continuous fire front across all three.
    for (const node of [ember, char]) {
      node.style.setProperty('--cx', cx + 'px');
      node.style.setProperty('--cy', cy + 'px');
    }
    const setOrigin = (node) => {
      if (!node) return;
      const b = node.getBoundingClientRect();
      node.style.setProperty('--cx', (cx - (b.left - rect.left)) + 'px');
      node.style.setProperty('--cy', (cy - (b.top - rect.top)) + 'px');
    };
    setOrigin(win);
    setOrigin(tabstrip);
    ember.style.opacity = '1';
    char.style.opacity = '1';

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
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const tRaw = (now - t0) / dur;
      const t = Math.min(tRaw, 1);
      const r = ease(t) * maxR;
      win.style.setProperty('--r', r + 'px');
      ember.style.setProperty('--r', r + 'px');
      char.style.setProperty('--r', r + 'px');
      if (tabstrip) tabstrip.style.setProperty('--r', r + 'px');

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
        ctx.clearRect(0, 0, W, H);
        win.style.opacity = '0';
        if (typeof onComplete === 'function') onComplete();
      }
    };
    raf = requestAnimationFrame(step);
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return { trigger, reducedMotion };
})();
