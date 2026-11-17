/* =====================================================================
   XOLVE HERO: "from chaos to a Xolution"

   A few thousand particles fly in from random positions and assemble
   into the Xolve mark (the X plus its green bar).
     - Move the mouse over it and the particles part around the cursor,
       swirl a little, glow green and then settle back into place.
     - Click or tap to blow a hole in the mark; it reassembles itself.
     - Scroll down and the mark breaks apart into the page.
   Pauses when off-screen. With "reduce motion" on, it simply shows the
   finished mark without animating.
   ===================================================================== */
(() => {
  const canvas = document.getElementById("hxCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The Xolve mark, from the logo kit (its drawing area runs from x 16 to 86 and y 12 to 86).
  const X_PATHS = [
    new Path2D("M86 12 L72 12 L54.74 30.5 L58.31 32.57 L59.77 34.48 Z M16 72 L41.02 50.55 L38.77 47.6 Z"),
    new Path2D("M16 12 L55.95 35.25 L84 72 L44.05 48.75 Z"),
  ];
  const BAR = { x: 32, y: 80, w: 36, h: 6, r: 3 };
  const MARK_W = 70, MARK_H = 74, MAX_PARTICLES = 2600;

  let w = 0, h = 0, dpr = 1, parts = [], dust = [], visible = true, raf = 0, t0 = performance.now();
  const ptr = { x: -9999, y: -9999, on: false };
  const root = document.documentElement;
  // on the home page's first visit, wait for the intro to finish before assembling
  let started = !root.classList.contains("intro-wait");
  let barBox = null, glowNow = 0;

  /* the bar "switches on" like a light once the X has formed: off, on, off, on, dim, on */
  function barLight(now) {
    if (reduceMotion) return 1;
    const a = (now - t0) / 1000 - 1.45;
    if (a < 0) return 0;
    if (a < 0.07) return 1;
    if (a < 0.13) return 0;
    if (a < 0.21) return 1;
    if (a < 0.27) return 0.35;
    return 1;
  }

  /* ---------- turn the logo into a list of points ---------- */
  function sampleMark(markH) {
    const scale = markH / MARK_H;
    const mw = Math.ceil(MARK_W * scale), mh = Math.ceil(MARK_H * scale);
    const off = document.createElement("canvas");
    off.width = mw; off.height = mh;
    const o = off.getContext("2d");
    o.setTransform(scale, 0, 0, scale, -16 * scale, -12 * scale);
    o.fillStyle = "#f00"; X_PATHS.forEach((p) => o.fill(p));
    o.fillStyle = "#0f0";
    o.beginPath(); o.roundRect ? o.roundRect(BAR.x, BAR.y, BAR.w, BAR.h, BAR.r) : o.rect(BAR.x, BAR.y, BAR.w, BAR.h); o.fill();
    const data = o.getImageData(0, 0, mw, mh).data;

    // choose a spacing that keeps the particle count sensible for this size
    let gap = Math.max(4, Math.round(markH / 95));
    let pts = [];
    for (;;) {
      pts = [];
      for (let y = 0; y < mh; y += gap) {
        for (let x = 0; x < mw; x += gap) {
          const i = (y * mw + x) * 4;
          if (data[i + 3] > 128) pts.push({ x, y, bar: data[i + 1] > data[i] });
        }
      }
      if (pts.length <= MAX_PARTICLES) break;
      gap += 1;
    }
    return { pts, mw, mh, gap };
  }

  /* ---------- build particles for the current screen size ---------- */
  function build() {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wide = w > 860;
    const markH = wide ? Math.min(h * 0.64, w * 0.4) : Math.min(h * 0.3, w * 0.55);
    const cx = wide ? w * 0.73 : w * 0.5;
    const cy = wide ? h * 0.47 : h * 0.25;
    const { pts, mw, mh, gap } = sampleMark(markH);
    const ox = cx - mw / 2, oy = cy - mh / 2;
    const size = Math.max(1.4, Math.min(2.4, gap * 0.38));

    const old = parts;
    parts = pts.map((p, i) => {
      const prev = old[i];
      const a = Math.random() * Math.PI * 2;
      return {
        hx: ox + p.x, hy: oy + p.y, bar: p.bar, size: p.bar ? size + 0.5 : size,
        // first build: start scattered across the screen; later builds keep where they were
        x: prev ? prev.x : Math.random() * w, y: prev ? prev.y : Math.random() * h,
        vx: 0, vy: 0, dx: Math.cos(a), dy: Math.sin(a), ph: Math.random() * Math.PI * 2,
        far: 200 + Math.random() * 500,
      };
    });

    const bp = parts.filter((p) => p.bar);
    if (bp.length) {
      const xs = bp.map((p) => p.hx), ys = bp.map((p) => p.hy);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      barBox = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 };
    }

    dust = Array.from({ length: Math.round(Math.min(90, (w * h) / 16000)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, z: 0.3 + Math.random() * 0.7, s: Math.random() * 1.2 + 0.4,
    }));

    if (reduceMotion) { parts.forEach((p) => { p.x = p.hx; p.y = p.hy; }); draw(0, 0); }
  }

  /* ---------- one frame ---------- */
  function step(now) {
    const r = canvas.getBoundingClientRect();
    const scroll = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    const age = (now - t0) / 1000;
    const k = Math.min(0.05, 0.008 + age * 0.03); // springs strengthen during the intro, so the mark assembles smoothly
    const R = Math.max(90, Math.min(140, w * 0.09)), R2 = R * R;
    const burst = scroll * scroll * 1.0;

    for (const p of parts) {
      const wob = Math.sin(now * 0.0016 + p.ph) * 0.7;
      const tx = p.hx + p.dx * p.far * burst + wob;
      const ty = p.hy + p.dy * p.far * burst + Math.cos(now * 0.0013 + p.ph) * 0.7;
      p.vx += (tx - p.x) * k;
      p.vy += (ty - p.y) * k;

      if (ptr.on) {
        const ddx = p.x - ptr.x, ddy = p.y - ptr.y, d2 = ddx * ddx + ddy * ddy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2), f = (1 - d / R) * 2.6;
          p.vx += (ddx / d) * f - (ddy / d) * f * 0.45; // push away, with a little swirl
          p.vy += (ddy / d) * f + (ddx / d) * f * 0.45;
        }
      }
      p.vx *= 0.84; p.vy *= 0.84;
      p.x += p.vx; p.y += p.vy;
    }
    draw(now, scroll);
  }

  function draw(now, scroll) {
    ctx.clearRect(0, 0, w, h);

    // background dust drifts slowly and shifts a little with the mouse (depth)
    const mx = ptr.on ? (ptr.x / w - 0.5) : 0, my = ptr.on ? (ptr.y / h - 0.5) : 0;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (const d of dust) {
      if (!reduceMotion) { d.y -= 0.08 * d.z; if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; } }
      ctx.fillRect(d.x - mx * 18 * d.z, d.y - my * 18 * d.z, d.s, d.s);
    }

    const fade = 1 - scroll * 0.75;
    const lit = barLight(now);

    // soft glow behind the bar once it's on; brighter while a "Xolve it" button is lit
    const target = lit >= 1 ? (root.classList.contains("bulb-hover") ? 1.8 : 1) : 0;
    glowNow = reduceMotion ? target : glowNow + (target - glowNow) * (target > glowNow ? 0.25 : 0.08);
    if (barBox && glowNow > 0.01) {
      ctx.save();
      ctx.translate(barBox.cx, barBox.cy);
      ctx.scale(1, 0.32);
      const r = barBox.w * 0.9;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(0,240,122,${Math.min(0.6, 0.3 * glowNow) * fade})`);
      g.addColorStop(1, "rgba(0,240,122,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // white particles that are home; green ones that are displaced (or are the bar)
    ctx.fillStyle = `rgba(255,255,255,${0.88 * fade})`;
    for (const p of parts) {
      if (p.bar) continue;
      const off = Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy);
      if (off > 16 && scroll < 0.05) continue;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.fillStyle = `rgba(0,240,122,${0.95 * fade})`;
    for (const p of parts) {
      if (p.bar) continue;
      const off = Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy);
      if (off > 16 && scroll < 0.05) ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    // the bar: grey ("off") until it switches on, then green
    ctx.fillStyle = lit > 0.5 ? `rgba(0,240,122,${0.95 * fade})` : `rgba(110,116,124,${0.85 * fade})`;
    for (const p of parts) if (p.bar) ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  /* ---------- loop, only while the hero is on screen ---------- */
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || !started) return;
    step(now);
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && !reduceMotion && started) raf = requestAnimationFrame(frame); };
  if (!started) window.addEventListener("xolve:lit", () => { started = true; t0 = performance.now(); kick(); }, { once: true });

  /* ---------- input ---------- */
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientY >= r.top && e.clientY <= r.bottom };
  }
  window.addEventListener("pointermove", (e) => {
    const p = local(e);
    ptr.on = p.inside; ptr.x = p.x; ptr.y = p.y;
  }, { passive: true });
  window.addEventListener("pointerdown", (e) => {
    const p = local(e);
    if (!p.inside || e.target.closest("a, button")) return;
    for (const q of parts) { // a burst that pushes nearby particles outward
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < 220) { const f = (1 - d / 220) * 26; q.vx += (dx / d) * f; q.vy += (dy / d) * f; }
    }
  }, { passive: true });
  window.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") ptr.on = false; }, { passive: true });
  document.addEventListener("pointerleave", () => (ptr.on = false));

  build();
  if ("ResizeObserver" in window) {
    let lastW = w, lastH = h;
    new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      // phones change height as the address bar shows/hides; ignore small height-only changes
      if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 120) return;
      lastW = r.width; lastH = r.height; build();
    }).observe(canvas);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; kick(); }).observe(canvas);
  }
  document.addEventListener("visibilitychange", kick);
  kick();
})();
