/* =====================================================================
   XOLVE HOME: scroll and hover interactions
     1. header turns solid after the hero; a green bar shows scroll progress
     2. headings with data-split rise in word by word
     3. the statement's words light up as you scroll through it
     4. the ticker loops seamlessly (and pauses on hover)
     5. cards with data-spot get a glow that follows the mouse
     6. the process steps light up one at a time; the counter follows
     7. the work showcase: arrows, drag to scroll, progress bar, gentle autoplay
     8. numbers count up when they come into view
   Everything degrades to a normal, readable page without JavaScript
   or with "reduce motion" turned on.
   ===================================================================== */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const hasIO = "IntersectionObserver" in window;

  /* ---------- helpers: wrap each word of an element, keeping inner tags like <span class="hl"> ---------- */
  function wrapWords(root, make) {
    let n = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else frag.appendChild(make(part, n++));
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(root);
    return n;
  }

  /* ---------- 0. the intro can be skipped with a click, tap or key ---------- */
  const intro = $("#intro");
  if (intro && window.xolveSkipIntro) {
    intro.addEventListener("pointerdown", () => window.xolveSkipIntro());
    window.addEventListener("keydown", () => window.xolveSkipIntro(), { once: true });
  }

  /* ---------- 1. header state + scroll progress ---------- */
  const top = $(".top");
  const hero = $(".hx");
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (top) {
      top.classList.toggle("is-solid", y > 40);
      top.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
    }
    scrub();
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  /* ---------- 2. word-by-word headings ---------- */
  const splits = $$("[data-split]");
  if (!reduceMotion) {
    splits.forEach((el) => wrapWords(el, (word, i) => {
      const w = document.createElement("span");
      w.className = "w";
      const inner = document.createElement("i");
      inner.style.setProperty("--i", i);
      inner.textContent = word;
      w.appendChild(inner);
      return w;
    }));
    if (hasIO) {
      const root = document.documentElement;
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const show = () => en.target.classList.add("is-in");
        // the hero headline waits for the intro to finish
        if (root.classList.contains("intro-wait")) window.addEventListener("xolve:lit", show, { once: true }); else show();
      }), { rootMargin: "0px 0px -10% 0px" });
      splits.forEach((el) => io.observe(el));
    } else {
      splits.forEach((el) => el.classList.add("is-in"));
    }
  }

  /* ---------- 3. statement lit by scroll ---------- */
  const stmt = $("[data-scrub]");
  let words = [];
  if (stmt && !reduceMotion) {
    const KEY = new Set(["numbers", "technology"]);
    wrapWords(stmt, (word) => {
      const s = document.createElement("span");
      s.className = "sw" + (KEY.has(word.replace(/[^a-z]/gi, "").toLowerCase()) ? " key" : "");
      s.textContent = word;
      return s;
    });
    words = $$(".sw", stmt);
  }
  function scrub() {
    if (!words.length) return;
    const r = stmt.getBoundingClientRect(), vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.35 + r.height)));
    const lit = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < lit));
  }

  /* ---------- 4. ticker: duplicate each track so the loop has no gap ---------- */
  $$(".tick__track").forEach((track) => {
    const copy = track.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    track.after(copy);
  });
  // on touch screens a tap pauses the strip and the next tap starts it again
  const tick = $(".tick");
  if (tick) {
    tick.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      tick.classList.toggle("is-paused");
    });
  }

  /* ---------- 5. spotlight follows the mouse ---------- */
  $$("[data-spot]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------- 6. process steps ---------- */
  const steps = $$(".pstep");
  const procNow = $("#procNow"), procBar = $("#procBar");
  function setStep(n) {
    steps.forEach((s) => s.classList.toggle("is-active", Number(s.dataset.step) === n));
    if (procNow) procNow.textContent = String(n).padStart(2, "0");
    if (procBar) procBar.style.setProperty("--p", n / steps.length);
  }
  if (steps.length) {
    setStep(1);
    if (hasIO) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) setStep(Number(en.target.dataset.step));
      }), { rootMargin: "-45% 0px -45% 0px" });
      steps.forEach((s) => io.observe(s));
    }
  }

  /* ---------- 7. work showcase ---------- */
  const track = $("#showTrack");
  if (track) {
    const prev = $("#showPrev"), next = $("#showNext"), bar = $("#showBar");
    const stepSize = () => {
      const card = track.querySelector(".scard");
      return card ? card.getBoundingClientRect().width + 20 : track.clientWidth * 0.8;
    };
    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const vis = track.clientWidth / track.scrollWidth;
      const p = max > 0 ? vis + (1 - vis) * (track.scrollLeft / max) : 1;
      if (bar) bar.style.setProperty("--p", p.toFixed(3));
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = atEnd();
    };
    const go = (dir) => track.scrollBy({ left: dir * stepSize(), behavior: reduceMotion ? "auto" : "smooth" });
    prev && prev.addEventListener("click", () => { go(-1); hold(); });
    next && next.addEventListener("click", () => { go(1); hold(); });
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); hold(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); hold(); }
    });
    update();

    // drag to scroll with a mouse (touch already scrolls natively)
    let down = null, moved = false;
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = { x: e.clientX, left: track.scrollLeft }; moved = false;
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add("is-drag"); }
      if (moved) track.scrollLeft = down.left - dx;
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = null;
      if (moved) {
        track.classList.remove("is-drag");
        const s = stepSize(); // snap to the nearest card
        track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: "smooth" });
        hold();
      }
    });
    track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);

    // gentle autoplay: only while visible, and paused while you hover, focus or have just used it
    let pausedUntil = 0, hovering = false, inView = false;
    function hold() { pausedUntil = performance.now() + 9000; }
    track.addEventListener("pointerenter", () => (hovering = true));
    track.addEventListener("pointerleave", () => (hovering = false));
    track.addEventListener("focusin", hold);
    track.addEventListener("touchstart", hold, { passive: true });
    if (hasIO) new IntersectionObserver(([en]) => (inView = en.isIntersecting), { threshold: 0.4 }).observe(track);
    if (!reduceMotion) {
      setInterval(() => {
        if (!inView || hovering || document.hidden || performance.now() < pausedUntil) return;
        if (atEnd()) track.scrollTo({ left: 0, behavior: "smooth" }); else go(1);
      }, 4500);
    }
  }

  /* ---------- 8. counters ---------- */
  const counters = $$("[data-count]");
  const fmt = (n) => n.toLocaleString("en-US");
  if (!reduceMotion && hasIO) {
    counters.forEach((el) => (el.textContent = "0"));
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, target = Number(el.dataset.count), t0 = performance.now(), dur = 1600;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: 0.6 });
    counters.forEach((el) => io.observe(el));
  }

  onScroll();
})();
