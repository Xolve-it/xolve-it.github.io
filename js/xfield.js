/* =====================================================================
   XOLVE "CIRCUIT LATTICE": the interactive background on black areas.

   A grid of small "+" marks sits quietly behind the content. When the
   mouse moves over a black area:
     - the marks near it twist into an "x" (the Xolve mark), grow, get
       pulled towards the cursor and turn neon green;
     - the nearest marks are wired to the cursor with right-angled
       circuit traces;
     - the marks fade back slowly, leaving a short wake behind the cursor.
   Clicking or tapping sends out a square ripple that flips the marks it
   passes.

   To use it, add data-xfield to any black element:
     data-xfield          normal (sections, footer)
     data-xfield="hero"   bigger and drifts on its own while the mouse is away
     data-xfield="compact" tighter grid for thin bars like the header
   It respects "reduce motion" (shows a still grid) and pauses off-screen.
   ===================================================================== */
(() => {
  const hosts = [...document.querySelectorAll("[data-xfield]")];
  if (!hosts.length) return;

  const NEON = [0, 240, 122];
  const WHITE = [255, 255, 255];
  const PRESETS = {
    hero:    { gap: 34, radius: 190, links: 5, idle: true,  base: 0.10 },
    default: { gap: 32, radius: 160, links: 4, idle: false, base: 0.08 },
    compact: { gap: 22, radius: 120, links: 3, idle: false, base: 0.07 },
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;

  const fields = hosts.map((host) => {
    const opt = PRESETS[host.dataset.xfield] || PRESETS.default;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.isolation = "isolate";
    const canvas = document.createElement("canvas");
    canvas.className = "xfield";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    return {
      host, canvas, opt, ctx: canvas.getContext("2d"),
      w: 0, h: 0, marks: [], ripples: [], visible: false,
      ptr: { x: 0, y: 0, tx: 0, ty: 0, on: false, last: 0 },
    };
  });

  /* ---------- layout ---------- */
  function build(f) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = f.host.clientWidth, h = f.host.clientHeight;
    if (w === f.w && h === f.h && f.marks.length) return;
    f.w = w; f.h = h; f.quiet = false;
    f.canvas.width = Math.round(w * dpr);
    f.canvas.height = Math.round(h * dpr);
    f.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = f.opt.gap;
    const cols = Math.ceil(w / g) + 1, rows = Math.ceil(h / g) + 1;
    const ox = (w - (cols - 1) * g) / 2, oy = (h - (rows - 1) * g) / 2;
    f.marks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // every other row is nudged half a step, so the grid reads as woven, not square
        f.marks.push({ x: ox + c * g + (r % 2 ? g / 2 : 0), y: oy + r * g, a: 0, dx: 0, dy: 0 });
      }
    }
    if (reduceMotion) draw(f, 0);
  }

  /* ---------- pointer ---------- */
  function onMove(e) {
    for (const f of fields) {
      if (!f.visible) continue;
      const r = f.host.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      if (inside) {
        if (!f.ptr.on) { f.ptr.x = x; f.ptr.y = y; }
        f.ptr.tx = x; f.ptr.ty = y; f.ptr.on = true; f.ptr.last = performance.now();
      } else {
        f.ptr.on = false;
      }
    }
  }
  function onDown(e) {
    for (const f of fields) {
      const r = f.host.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x >= 0 && y >= 0 && x <= r.width && y <= r.height) {
        f.ripples.push({ x, y, t0: performance.now() });
        if (f.ripples.length > 4) f.ripples.shift();
      }
    }
  }
  function onLeave() { fields.forEach((f) => (f.ptr.on = false)); }
  // a finger lifting off the screen should let the marks settle
  function onUp(e) { if (e.pointerType !== "mouse") onLeave(); }

  /* ---------- drawing ---------- */
  const mix = (a, b, k) => `${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)}`;
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  function draw(f, now) {
    const { ctx, w, h, opt, ptr, marks } = f;
    // nothing moving and already drawn at rest: skip the frame
    if (f.quiet && !ptr.on && !f.ripples.length && !opt.idle) return;
    ctx.clearRect(0, 0, w, h);

    // where the "focus" is: the eased cursor, or a slow drift when idle (hero only)
    let fx = null, fy = null, strength = 1;
    if (!reduceMotion) {
      if (ptr.on) {
        ptr.x += (ptr.tx - ptr.x) * 0.18;
        ptr.y += (ptr.ty - ptr.y) * 0.18;
        fx = ptr.x; fy = ptr.y;
      } else if (opt.idle && (noHover || now - ptr.last > 2500)) {
        fx = w * (0.62 + 0.3 * Math.sin(now * 0.00021));
        fy = h * (0.5 + 0.36 * Math.sin(now * 0.00033 + 1.3));
        strength = 0.55;
      }
    }

    // ripples: square rings that grow outward from a click
    const maxR = Math.hypot(w, h);
    f.ripples = f.ripples.filter((rp) => (now - rp.t0) * 0.7 < maxR);

    const R = opt.radius;
    const near = [];
    ctx.lineCap = "round";

    // quiet marks are batched into a single path for speed
    ctx.beginPath();
    for (const m of marks) {
      let target = 0;
      if (fx !== null) {
        const d = Math.hypot(m.x - fx, m.y - fy);
        if (d < R) {
          target = Math.pow(1 - d / R, 1.4) * strength;
          if (d > R * 0.28 && d < R * 0.85) near.push({ m, d, ang: Math.atan2(m.y - fy, m.x - fx) });
        }
      }
      for (const rp of f.ripples) {
        const rr = (now - rp.t0) * 0.7;
        const cd = Math.max(Math.abs(m.x - rp.x), Math.abs(m.y - rp.y)); // square distance
        target = Math.max(target, Math.exp(-(((cd - rr) / 20) ** 2)) * (1 - rr / maxR));
      }
      // rise quickly, fade slowly: that leaves a wake behind the cursor
      m.a += (target - m.a) * (target > m.a ? 0.2 : 0.045);
      if (m.a < 0.004) m.a = 0;

      // pulled a little towards the focus
      const pull = m.a * 7;
      const px = fx !== null && m.a ? (fx - m.x) : 0, py = fx !== null && m.a ? (fy - m.y) : 0;
      const pl = Math.hypot(px, py) || 1;
      m.dx = (px / pl) * pull; m.dy = (py / pl) * pull;

      if (m.a === 0) {
        ctx.moveTo(m.x - 2.5, m.y); ctx.lineTo(m.x + 2.5, m.y);
        ctx.moveTo(m.x, m.y - 2.5); ctx.lineTo(m.x, m.y + 2.5);
      }
    }
    ctx.strokeStyle = `rgba(255,255,255,${opt.base})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // active marks: twist from "+" to "x", grow and go green
    for (const m of marks) {
      if (!m.a) continue;
      const a = Math.min(1, m.a);
      const th = (Math.PI / 4) * smooth(0, 0.7, a);
      const L = 2.5 + a * 4.5;
      const c = Math.cos(th) * L, s = Math.sin(th) * L;
      const x = m.x + m.dx, y = m.y + m.dy;
      ctx.beginPath();
      ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s);
      ctx.moveTo(x + s, y - c); ctx.lineTo(x - s, y + c);
      ctx.strokeStyle = `rgba(${mix(WHITE, NEON, smooth(0.35, 0.85, a))},${opt.base + a * 0.8})`;
      ctx.lineWidth = 1.2 + a * 0.9;
      ctx.stroke();
    }

    // circuit traces from the cursor to the nearest marks
    if (fx !== null && near.length) {
      // one trace per direction (like spokes), each to the mark closest to a middle distance,
      // so the traces fan out around the cursor instead of bunching up
      const sector = (Math.PI * 2) / opt.links, ideal = R * 0.55, best = [];
      for (const n of near) {
        const k = Math.floor(((n.ang + Math.PI + sector / 2) % (Math.PI * 2)) / sector);
        if (!best[k] || Math.abs(n.d - ideal) < Math.abs(best[k].d - ideal)) best[k] = n;
      }
      const picks = best.filter(Boolean);
      picks.forEach(({ m, d }) => {
        const k = (1 - d / (R * 0.85)) * strength;
        const x = m.x + m.dx, y = m.y + m.dy;
        // run along the longer direction first, then turn (mirror-symmetric, never a pinwheel)
        const horizFirst = Math.abs(x - fx) >= Math.abs(y - fy);
        const ex = horizFirst ? x : fx, ey = horizFirst ? fy : y;
        ctx.beginPath();
        ctx.moveTo(fx, fy); ctx.lineTo(ex, ey); ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(0,240,122,${0.12 + k * 0.55})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.fillStyle = `rgba(0,240,122,${0.25 + k * 0.6})`;
        ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3); // solder point at the elbow
      });
      // the cursor's own node: a small square with a short green bar under it, like the logo
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * strength})`;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(fx - 4, fy - 4, 8, 8);
      ctx.fillStyle = `rgba(0,240,122,${0.9 * strength})`;
      ctx.fillRect(fx - 6, fy + 8, 12, 2.5);
    }
    f.quiet = fx === null && !f.ripples.length && marks.every((m) => !m.a);
  }

  /* ---------- loop: only fields on screen are drawn ---------- */
  let raf = 0;
  function frame(now) {
    raf = 0;
    let any = false;
    for (const f of fields) if (f.visible) { draw(f, now); any = true; }
    if (any && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && !reduceMotion) raf = requestAnimationFrame(frame); };

  fields.forEach(build);

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const f = fields.find((x) => x.host === en.target);
        if (f) f.visible = en.isIntersecting;
      });
      kick();
    });
    fields.forEach((f) => io.observe(f.host));
  } else {
    fields.forEach((f) => (f.visible = true));
    kick();
  }

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((en) => {
      const f = fields.find((x) => x.host === en.target);
      if (f) build(f);
    }));
    fields.forEach((f) => ro.observe(f.host));
  } else {
    window.addEventListener("resize", () => fields.forEach(build));
  }

  if (!reduceMotion) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onLeave, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", kick);
  }
})();
