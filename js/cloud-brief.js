/* Cloud Xolution brief: saves answers in this browser, checks the required
   ones, then builds a plain-text brief and opens an email to Xolve.
   No server needed. To send briefs to a form service instead, post
   collect() to it inside the submit handler. */
(() => {
  const EMAIL = "get.xolutions@gmail.com";
  const KEY = "xolve-cloud-brief-v1";
  const form = document.getElementById("cloudForm");
  const err = document.getElementById("cloudError");
  const saved = document.getElementById("cloudSaved");
  const done = document.getElementById("cloudDone");
  const preview = document.getElementById("donePreview");
  const needsSet = document.getElementById("needsSet");

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } },
  };

  /* ---------- read / write the form ---------- */
  const collect = () => {
    const f = form.elements;
    const val = (n) => (f[n] && f[n].value ? f[n].value.trim() : "");
    const radio = (n) => (form.querySelector(`input[name="${n}"]:checked`) || {}).value || "";
    return {
      name: val("name"), email: val("email"), company: val("company"), phone: val("phone"),
      country: val("country"), website: val("website"),
      needs: [...form.querySelectorAll('input[name="needs"]:checked')].map((c) => c.value),
      current: radio("current"), domain: radio("domain"), setup: val("setup"),
      problem: val("problem"), success: val("success"),
      timeline: val("timeline"), budget: val("budget"),
    };
  };

  const restore = (d) => {
    if (!d) return;
    Object.entries(d).forEach(([k, v]) => {
      if (k === "needs") {
        form.querySelectorAll('input[name="needs"]').forEach((c) => (c.checked = v.includes(c.value)));
      } else if (k === "current" || k === "domain") {
        form.querySelectorAll(`input[name="${k}"]`).forEach((r) => (r.checked = r.value === v));
      } else if (form.elements[k]) {
        form.elements[k].value = v;
      }
    });
  };

  restore(store.get());

  let t;
  form.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { if (store.set(collect())) saved.textContent = "Saved in this browser"; }, 400);
  });

  /* ---------- plain-text brief ---------- */
  const line = (label, v) => (v ? `${label}: ${v}` : null);
  const toText = (d) => [
    "CLOUD XOLUTION BRIEF",
    "====================",
    "",
    "ABOUT YOU",
    line("Name", d.name), line("Email", d.email), line("Company / project", d.company),
    line("Phone / WhatsApp", d.phone), line("Country", d.country), line("Website", d.website),
    "",
    "WHAT YOU NEED",
    ...d.needs.map((n) => `- ${n}`),
    "",
    "WHERE YOU ARE NOW",
    line("Runs on", d.current), line("Has a domain", d.domain), line("Current setup", d.setup),
    "",
    "THE PROBLEM",
    d.problem,
    d.success ? `\nSuccess looks like: ${d.success}` : null,
    "",
    "TIMING AND BUDGET",
    line("Timeline", d.timeline), line("Budget", d.budget),
    "",
    `Sent from the Xolve website on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
  ].filter((x) => x !== null).join("\n");

  const mailHref = (d, text) =>
    `mailto:${EMAIL}?subject=${encodeURIComponent(`Cloud Xolution request — ${d.company || d.name}`)}&body=${encodeURIComponent(text)}`;

  /* ---------- validation ---------- */
  const validate = (d) => {
    const problems = [];
    const mark = (el, bad) => el.setAttribute("aria-invalid", String(bad));
    const f = form.elements;
    mark(f.name, !d.name); if (!d.name) problems.push({ el: f.name, msg: "your name" });
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email);
    mark(f.email, !emailOk); if (!emailOk) problems.push({ el: f.email, msg: "a valid email" });
    needsSet.classList.toggle("is-invalid", !d.needs.length);
    if (!d.needs.length) problems.push({ el: needsSet.querySelector("input"), msg: "at least one thing you need" });
    mark(f.problem, !d.problem); if (!d.problem) problems.push({ el: f.problem, msg: "the problem you want solved" });
    return problems;
  };

  /* ---------- submit ---------- */
  let lastText = "";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = collect();
    const problems = validate(d);
    if (problems.length) {
      const msgs = problems.map((p) => p.msg);
      const list = msgs.length > 1 ? `${msgs.slice(0, -1).join(", ")} and ${msgs[msgs.length - 1]}` : msgs[0];
      err.textContent = `Please add ${list}.`;
      err.hidden = false;
      problems[0].el.focus();
      return;
    }
    err.hidden = true;
    store.set(d);
    lastText = toText(d);
    const href = mailHref(d, lastText);
    document.getElementById("doneMail").href = href;
    preview.textContent = lastText;
    form.hidden = true;
    done.hidden = false;
    done.focus();
    window.scrollTo({ top: done.offsetTop - 90, behavior: "smooth" });
    window.location.href = href;
  });

  /* ---------- after submit ---------- */
  document.getElementById("doneEdit").addEventListener("click", () => {
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });

  document.getElementById("doneCopy").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(lastText);
      btn.textContent = "Copied ✓";
    } catch {
      const r = document.createRange(); r.selectNodeContents(preview);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      btn.textContent = "Selected: press Ctrl+C";
    }
    setTimeout(() => (btn.textContent = "Copy brief"), 2500);
  });

  document.getElementById("doneDownload").addEventListener("click", () => {
    const blob = new Blob([lastText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "xolve-cloud-brief.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  document.getElementById("cloudReset").addEventListener("click", () => {
    if (!confirm("Clear all your answers and start again?")) return;
    form.reset();
    store.clear();
    saved.textContent = "";
    err.hidden = true;
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    needsSet.classList.remove("is-invalid");
  });
})();
