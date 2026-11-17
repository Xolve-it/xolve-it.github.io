/* =====================================================================
   XOLVE "LIGHT SWITCH" (styles in css/bulb.css)
     1. Xolve it buttons glow on (with a flicker) when you point at or
        tab to them, and fade off when you leave
     2. the green bar under the header logo switches on once the page
        is ready (after the intro on the home page) and glows again
        when you point at the logo
     3. green bars on labels, cards and numbers switch on as they
        scroll into view
   While a button is lit, <html> gets the class "bulb-hover", which the
   hero animation uses to make its own green bar glow brighter.
   ===================================================================== */
(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BTN = ".btn--neon, .fmi-btn-primary";

  const turnOn = (el) => { el.classList.remove("is-off"); el.classList.add("is-on"); };
  const turnOff = (el) => {
    if (!el.classList.contains("is-on")) return;
    el.classList.remove("is-on"); el.classList.add("is-off");
  };

  /* ---------- 1. buttons (delegated, so buttons drawn later by the finance form work too) ---------- */
  const btnOn = (b) => { b.classList.add("bulb-btn"); turnOn(b); root.classList.add("bulb-hover"); };
  const btnOff = (b) => { turnOff(b); root.classList.remove("bulb-hover"); };
  document.addEventListener("pointerover", (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (b && !b.contains(e.relatedTarget)) btnOn(b);
  });
  document.addEventListener("pointerout", (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (b && !b.contains(e.relatedTarget)) btnOff(b);
  });
  document.addEventListener("focusin", (e) => { const b = e.target.closest && e.target.closest(BTN); if (b) btnOn(b); });
  document.addEventListener("focusout", (e) => { const b = e.target.closest && e.target.closest(BTN); if (b) btnOff(b); });

  /* ---------- 2. the header logo's bar ---------- */
  const bulbs = [];
  document.querySelectorAll("a.top__logo, a.fmi-brand").forEach((a) => {
    if (!a.querySelector('img[src*="wordmark-reversed"]')) return;
    const s = document.createElement("span");
    s.className = "logo-bulb";
    s.setAttribute("aria-hidden", "true");
    a.classList.add("has-bulb");
    a.appendChild(s);
    a.addEventListener("pointerenter", () => turnOn(s));
    a.addEventListener("pointerleave", () => turnOff(s));
    bulbs.push(s);
  });
  const lightLogo = () => bulbs.forEach((s) => s.classList.add("is-lit"));
  if (root.classList.contains("intro-wait")) window.addEventListener("xolve:lit", lightLogo, { once: true });
  else setTimeout(lightLogo, reduceMotion ? 0 : 350);

  /* ---------- 3. bars switch on as they come into view ---------- */
  const bars = document.querySelectorAll(".kicker, .num, .xol, .scard, .founder");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    bars.forEach((el) => el.classList.add("is-lit"));
  } else {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target;
      const go = () => setTimeout(() => el.classList.add("is-lit"), 150 + Math.random() * 250);
      // on the home page, wait for the intro to finish before lighting anything in the hero
      if (root.classList.contains("intro-wait")) window.addEventListener("xolve:lit", go, { once: true }); else go();
    }), { rootMargin: "0px 0px -12% 0px" });
    bars.forEach((el) => io.observe(el));
  }
})();
