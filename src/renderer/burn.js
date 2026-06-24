'use strict';

/*
 * ITERA "burn the session" animation.
 *
 * Ported from the Claude Design component (Burning Paper.dc.html) to vanilla JS
 * and wired into the app.
 *
 * How it reads as *paper burning* (not a growing black disc): every frame the
 * whole screen is filled with charred ash, then the cream "session paper" is
 * laid on top but CLIPPED to the un-burnt region — everything OUTSIDE a ragged,
 * noise-modulated fire front. As the front spreads from the clicked button the
 * paper is eaten away and the char behind is revealed, with a glowing ember
 * cut, cooling-ember bands, flickering flame, smoke and ash.
 *
 * Reliability notes (hard-won): everything is drawn on ONE <canvas>, cleared
 * and redrawn each frame — no CSS masks, no animated SVG filters (both render
 * flakily over a live webview). The clock is anchored to the first rAF
 * timestamp (never performance.now()), so the first frame is always t=0 and the
 * burn can't "finish in one frame" as a flash. onComplete fires deterministically
 * the moment the front has covered the whole screen.
 */
window.IteraBurn = (function () {
  const BURN_DURATION_SEC = 2.6;   // spread time after the ignition beat
  const IGN_MS = 440;              // the "lighter touches the UI" beat
  const EMBER_DENSITY = 1;

  let running = false;

  function el(id) { return document.getElementById(id); }

  // Build the charred-ash texture that the burnt region is filled with. The
  // "paper" being burned is the app's own UI itself (the live DOM showing
  // through the transparent, un-burnt part of the canvas), so we don't draw a
  // synthetic sheet — only the char that's left behind where the fire passed.
  function buildChar(W, H, dpr) {
    const ch = document.createElement('canvas');
    ch.width = Math.round(W * dpr); ch.height = Math.round(H * dpr);
    const k = ch.getContext('2d');
    k.setTransform(dpr, 0, 0, dpr, 0, 0);
    k.fillStyle = '#160e09'; k.fillRect(0, 0, W, H);
    const blobs = Math.min(1100, Math.round(W * H / 1100));
    for (let i = 0; i < blobs; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 8 + Math.random() * 52;
      const roll = Math.random();
      let col;
      if (roll < 0.5) col = '6,4,3';          // deep black soot
      else if (roll < 0.84) col = '46,26,12';  // brown char
      else col = '92,50,20';                    // lighter scorch flecks
      const rg = k.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(' + col + ',' + (0.55 * Math.random()) + ')');
      rg.addColorStop(1, 'rgba(' + col + ',0)');
      k.fillStyle = rg; k.beginPath(); k.arc(x, y, r, 0, 6.2832); k.fill();
    }
    for (let i = 0; i < blobs * 0.5; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      k.fillStyle = 'rgba(126,118,108,' + (0.04 + Math.random() * 0.08) + ')';
      k.fillRect(x, y, 1.6, 1.6);
    }
    return ch;
  }

  function trigger(originEl, onComplete) {
    if (running) return;
    running = true;

    const screen = el('screen');
    const win = el('win');
    const cv = el('burn-canvas');

    cv.style.display = 'block';
    // .burning hides the live <webview> (a GPU surface that could otherwise
    // paint over the canvas); the page area falls back to #view's dark bg while
    // the rest of the real chrome stays visible and burns.
    if (win) win.classList.add('burning');

    // Robust dimensions: fall back to the viewport if layout isn't measured yet.
    const rect = screen.getBoundingClientRect();
    const W = Math.max(rect.width || window.innerWidth || 1200, 320);
    const H = Math.max(rect.height || window.innerHeight || 800, 240);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ignition origin = the clicked button (fallback: top-right)
    let ox = W * 0.84, oy = H * 0.16;
    if (originEl) {
      const b = originEl.getBoundingClientRect();
      if (b.width) { ox = b.left + b.width / 2 - rect.left; oy = b.top + b.height / 2 - rect.top; }
    }

    // angular noise for the ragged front: integer harmonics → seamless over 2π.
    const harmonics = [
      { f: 3,  a: 0.20,  p: Math.random() * 6.28, d: 0.45 },
      { f: 6,  a: 0.10,  p: Math.random() * 6.28, d: -0.7 },
      { f: 11, a: 0.055, p: Math.random() * 6.28, d: 0.95 },
      { f: 19, a: 0.032, p: Math.random() * 6.28, d: -1.2 },
      { f: 34, a: 0.018, p: Math.random() * 6.28, d: 1.5 },
    ];
    // Raggedness scale: full for most of the burn, faded to 0 over the last
    // stretch so the front resolves to a clean circle of radius maxR at the
    // end. Without this the negative "bays" of the noise can leave a wedge of
    // un-burnt paper in a far corner when the front in that direction never
    // reaches the corner (intermittent, since the noise phases are random).
    let curRag = 1;
    const radiusAt = (a, rFront, time) => {
      let s = 0;
      for (let i = 0; i < harmonics.length; i++) {
        const h = harmonics[i];
        s += h.a * Math.sin(h.f * a + h.p + time * h.d);
      }
      return rFront * (1 + curRag * s);
    };
    const addFront = (ctx, rFront, time) => {
      const N = 280;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const r = radiusAt(a, rFront, time);
        const x = ox + r * Math.cos(a), y = oy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    const frontPath = (ctx, rFront, time) => { ctx.beginPath(); addFront(ctx, rFront, time); };

    const char = buildChar(W, H, dpr);

    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');

    const maxR = Math.max(
      Math.hypot(ox, oy), Math.hypot(W - ox, oy),
      Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy)
    ) + 28;

    const durMs = BURN_DURATION_SEC * 1000;
    const dens = EMBER_DENSITY;

    const sparks = [], smoke = [], ash = [];
    let t0 = null, last = null;

    let completed = false;
    let endT = 0;
    const complete = (ts) => {
      if (completed) return;
      completed = true;
      endT = ts || performance.now();
      if (typeof onComplete === 'function') onComplete();
    };

    let raf = null;
    const frame = (ts) => {
     try {
      if (t0 == null) t0 = ts;
      const elapsed = ts - t0;
      const time = elapsed / 1000;
      const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
      last = ts;

      // ignition beat, then the spreading burn
      let igniting = false, ignK = 0, tRaw, rFront;
      if (elapsed < IGN_MS) {
        igniting = true;
        ignK = elapsed / IGN_MS;
        tRaw = 0;
        rFront = 3 + ignK * ignK * 16;
      } else {
        tRaw = (elapsed - IGN_MS) / durMs;
        const ease = 1 - Math.pow(1 - Math.min(tRaw, 1), 1.7); // energetic start
        rFront = 18 + ease * (maxR - 18);
      }
      // taper the ragged edge to a clean circle over the last ~18% → the whole
      // sheet is always fully consumed, no un-burnt corner left behind.
      curRag = tRaw > 0.82 ? Math.max(0, 1 - (tRaw - 0.82) / 0.18) : 1;
      // optional, production-inert instrumentation for the crash-test harness.
      if (typeof window.__burnFrame === 'function') { try { window.__burnFrame(tRaw, rFront, maxR); } catch (_) {} }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Start fully transparent: the app's own UI (the live DOM beneath the
      // canvas) shows through the un-burnt region. We only paint char + fire
      // *inside* the front, so the fire eats the real interface — no synthetic
      // paper sheet is drawn over it.
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineJoin = 'round';

      // charred ash fills only the BURNT region (inside the ragged front)
      ctx.save();
      frontPath(ctx, rFront, time);
      ctx.clip();
      ctx.fillStyle = '#0a0807';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(char, 0, 0, W, H);
      ctx.restore();

      // scorch / browning of the UI just AHEAD of the flame (un-burnt side),
      // clipped so it darkens the interface that hasn't caught yet, not the char
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      addFront(ctx, rFront, time);
      ctx.clip('evenodd');
      frontPath(ctx, rFront, time);
      ctx.lineWidth = 60; ctx.strokeStyle = 'rgba(120,72,28,0.22)'; ctx.stroke();
      frontPath(ctx, rFront, time);
      ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(74,40,14,0.34)'; ctx.stroke();
      frontPath(ctx, rFront, time);
      ctx.lineWidth = 11; ctx.strokeStyle = 'rgba(28,14,6,0.55)'; ctx.stroke();
      ctx.restore();

      // cooling-ember band: freshly burnt paper glows, fading inward over the char
      ctx.globalCompositeOperation = 'lighter';
      const band = (off, w, col) => {
        if (rFront - off < 5) return;
        frontPath(ctx, rFront - off, time);
        ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
      };
      band(64, 70, 'rgba(150,36,2,0.10)');
      band(30, 46, 'rgba(200,58,4,0.16)');
      band(12, 24, 'rgba(255,92,8,0.30)');
      band(4, 11, 'rgba(255,150,30,0.40)');

      // glowing embers smoldering in the fresh char
      const emb = igniting ? 8 : Math.min(120, Math.round(rFront * 0.4));
      for (let i = 0; i < emb; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = radiusAt(a, rFront, time) - (6 + Math.random() * 70);
        if (r < 2) continue;
        const x = ox + r * Math.cos(a), y = oy + r * Math.sin(a);
        const fl = Math.random();
        const s = 1.5 + Math.random() * 3.5;
        const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2.4);
        g.addColorStop(0, 'rgba(255,150,30,' + (0.5 * fl) + ')');
        g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, s * 2.4, 0, 6.2832); ctx.fill();
      }

      // living, flickering flame edge — hot blobs riding the front
      const segs = igniting ? 26 : Math.min(220, Math.round(rFront * 0.6 + 30));
      for (let i = 0; i < segs; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = radiusAt(a, rFront, time) - Math.random() * 8;
        const x = ox + r * Math.cos(a), y = oy + r * Math.sin(a);
        if (x < -16 || x > W + 16 || y < -16 || y > H + 16) continue;
        const fl = 0.45 + 0.55 * Math.random();
        const s = 3.5 + Math.random() * 9;
        const g = ctx.createRadialGradient(x, y, 0, x, y - s * 0.4, s);
        g.addColorStop(0, 'rgba(255,236,170,' + (0.55 * fl) + ')');
        g.addColorStop(0.45, 'rgba(255,120,12,' + (0.4 * fl) + ')');
        g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
      }

      // bright crisp ember line on the very cut
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      frontPath(ctx, rFront, time);
      ctx.lineWidth = 2.6; ctx.strokeStyle = '#ff6a00';
      ctx.shadowColor = 'rgba(255,120,0,0.95)'; ctx.shadowBlur = 16; ctx.stroke();
      frontPath(ctx, rFront, time);
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff2c8';
      ctx.shadowColor = 'rgba(255,220,140,0.95)'; ctx.shadowBlur = 9; ctx.stroke();
      ctx.restore();

      // ignition spark — the lighter touching the sheet
      if (igniting) {
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.6 + 0.4 * Math.sin(elapsed * 0.05);
        const sr = 16 + ignK * 26;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, sr);
        g.addColorStop(0, 'rgba(255,245,205,' + (0.9 * pulse) + ')');
        g.addColorStop(0.4, 'rgba(255,140,20,' + (0.6 * pulse) + ')');
        g.addColorStop(1, 'rgba(255,50,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ox, oy, sr, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      // spawn particles along the live front
      if (tRaw < 1) {
        const n = Math.round((5 + Math.random() * 5) * dens);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = radiusAt(a, rFront, time);
          const x = ox + r * Math.cos(a), y = oy + r * Math.sin(a);
          if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
          sparks.push({ x, y, vx: (Math.random() - 0.5) * 42, vy: -(28 + Math.random() * 92),
            life: 0.5 + Math.random() * 0.8, max: 1.3, size: 0.8 + Math.random() * 1.9, ph: Math.random() * 6.28 });
        }
        if (Math.random() < 0.6 * dens) {
          const a = Math.random() * Math.PI * 2;
          const r = radiusAt(a, rFront, time) - 12;
          smoke.push({ x: ox + r * Math.cos(a), y: oy + r * Math.sin(a),
            vx: (Math.random() - 0.5) * 16, vy: -(14 + Math.random() * 22),
            life: 1.4 + Math.random() * 1.2, max: 2.6, size: 18 + Math.random() * 26 });
        }
        const an = Math.round((1 + Math.random() * 2) * dens);
        for (let i = 0; i < an; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = radiusAt(a, rFront, time) - 6;
          ash.push({ x: ox + r * Math.cos(a), y: oy + r * Math.sin(a),
            vx: (Math.random() - 0.5) * 30, vy: -(6 + Math.random() * 22), g: 28 + Math.random() * 30,
            life: 1.2 + Math.random() * 1.4, max: 2.6, size: 2 + Math.random() * 4.2,
            rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 5, ph: Math.random() * 6.28, warm: Math.random() < 0.3 });
        }
      }

      // smoke
      ctx.globalCompositeOperation = 'source-over';
      for (let i = smoke.length - 1; i >= 0; i--) {
        const p = smoke[i];
        p.life -= dt; if (p.life <= 0) { smoke.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.size += 20 * dt; p.vy *= 0.99;
        const lr = p.life / p.max;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, 'rgba(44,38,33,' + (0.15 * lr) + ')');
        g.addColorStop(1, 'rgba(22,18,15,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
      }
      // ash flakes
      for (let i = ash.length - 1; i >= 0; i--) {
        const p = ash[i];
        p.life -= dt; if (p.life <= 0) { ash.splice(i, 1); continue; }
        p.vy += p.g * dt; p.ph += dt * 4;
        p.x += (p.vx + Math.sin(p.ph) * 18) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const lr = Math.max(p.life / p.max, 0);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(lr * 0.75, 0.75);
        ctx.fillStyle = p.warm ? '#5a2a0e' : '#16110d';
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.66);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // sparks / embers
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= dt; if (p.life <= 0) { sparks.splice(i, 1); continue; }
        p.ph += dt * 14;
        p.x += (p.vx + Math.sin(p.ph) * 13) * dt; p.y += p.vy * dt; p.vy += 7 * dt;
        const lr = Math.max(p.life / p.max, 0);
        const fl = 0.6 + 0.4 * Math.sin(p.ph * 1.7);
        const s = p.size * (0.6 + lr);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 3);
        g.addColorStop(0, 'rgba(255,246,210,' + (lr * fl) + ')');
        g.addColorStop(0.4, 'rgba(255,140,20,' + (lr * fl * 0.8) + ')');
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 3, 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // deterministic completion the moment the front covers the screen.
      if (tRaw >= 1) complete(ts);

      // after completion, let particles fade for a capped window (1.6s) and
      // then stop — never drain indefinitely. The screen is full char by now,
      // so a lingering tail adds nothing and just burns CPU before the quit.
      const left = sparks.length + smoke.length + ash.length;
      const fading = completed && (ts - endT) < 1600 && left > 0;
      if (!completed || fading) {
        raf = requestAnimationFrame(frame);
      }
      // else: stop. The last frame is full char — the sheet is gone.
     } catch (_) {
      // never leave a half-drawn frame frozen on screen — just complete.
      complete();
     }
    };
    raf = requestAnimationFrame(frame);
  }

  return { trigger };
})();
