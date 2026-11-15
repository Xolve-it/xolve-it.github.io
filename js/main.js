/* Xolve — small page behaviours: mobile menu, active nav link,
   reveal-on-scroll, footer year and the "Xolve something else" email form. */
(() => {
  document.documentElement.classList.add("js");
  const EMAIL = "get.xolutions@gmail.com";

  /* ---------- footer year ---------- */
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- mobile menu ---------- */
  const menuBtn = document.querySelector(".top__menu");
  const nav = document.getElementById("nav");
  if (menuBtn && nav) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    menuBtn.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------- highlight the nav link for the section in view ---------- */
  const links = nav ? [...nav.querySelectorAll('a[href^="#"]')] : [];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
      }),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".xol, .xol-custom, .step, .work__card, .values li, .founder, .qform");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  /* ---------- "Xolve something else": compose an email ---------- */
  const form = document.getElementById("quickForm");
  if (form) {
    const err = document.getElementById("quickError");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = form.elements;
      const missing = [];
      [f.name, f.email, f.problem].forEach((el) => {
        const bad = !el.value.trim() || (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()));
        el.setAttribute("aria-invalid", String(bad));
        if (bad) missing.push(el);
      });
      if (missing.length) {
        err.textContent = "Please add your name, a valid email and a few lines about the problem.";
        err.hidden = false;
        missing[0].focus();
        return;
      }
      err.hidden = true;
      const subject = `Custom Xolution request from ${f.name.value.trim()}`;
      const body = [
        f.problem.value.trim(),
        "",
        "—",
        `Name: ${f.name.value.trim()}`,
        `Email: ${f.email.value.trim()}`,
        "Sent from the Xolve website",
      ].join("\n");
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }
})();
