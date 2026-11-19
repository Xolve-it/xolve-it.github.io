/* =====================================================================
   XOLVE BRIEF FORMS (shared by the Website and Ledger Terminal briefs)

   Works from the page's markup, so a new brief needs no new code:
     <form class="bform" data-brief data-key="xolve-website-v1"
           data-title="WEBSITE XOLUTION BRIEF" data-subject="Website Xolution request">
       <fieldset> <legend>…</legend>
         <label class="field">Question <input name="…"></label>
         <div class="chips" data-q="Question" data-required> <label class="chipbox"><input type="checkbox" …></label> … </div>
       </fieldset> …
     </form>
   - answers are saved in this browser as you type
   - required fields ([required]) and required chip groups ([data-required]) are checked
   - on submit it builds a plain-text brief, opens an email to Xolve,
     and offers Copy / Download as a fallback
   ===================================================================== */
(() => {
  const EMAIL = "get.xolutions@gmail.com";
  const form = document.querySelector("form[data-brief]");
  if (!form) return;
  const KEY = form.dataset.key || "xolve-brief";
  const TITLE = form.dataset.title || "XOLVE BRIEF";
  const SUBJECT = form.dataset.subject || "Xolution request";
  const err = document.getElementById("briefError");
  const saved = document.getElementById("briefSaved");
  const done = document.getElementById("briefDone");
  const preview = document.getElementById("briefPreview");
  const mailBtn = document.getElementById("briefMail");

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } },
  };

  /* ---------- save / restore every control by name ---------- */
  const snap = () => {
    const o = {};
    [...form.elements].forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox" || el.type === "radio") { if (el.checked) (o[el.name] = o[el.name] || []).push(el.value); }
      else o[el.name] = el.value;
    });
    return o;
  };
  const restore = (o) => {
    if (!o) return;
    [...form.elements].forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox" || el.type === "radio") el.checked = (o[el.name] || []).includes(el.value);
      else if (o[el.name] != null) el.value = o[el.name];
    });
  };
  restore(store.get());
  let t;
  form.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { if (store.set(snap()) && saved) saved.textContent = "Saved in this browser"; }, 400);
  });
  form.addEventListener("change", () => store.set(snap()));

  /* ---------- turn the form into readable text, section by section ---------- */
  const labelText = (label) => {
    const clone = label.cloneNode(true);
    clone.querySelectorAll("input, select, textarea, .req, .opt, .help").forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  };
  const toText = () => {
    const out = [TITLE, "=".repeat(TITLE.length), ""];
    form.querySelectorAll("fieldset").forEach((fs) => {
      const lines = [];
      fs.querySelectorAll("[data-q], label.field").forEach((node) => {
        if (node.matches("[data-q]")) {
          const vals = [...node.querySelectorAll("input:checked")].map((i) => i.value);
          if (vals.length) lines.push(`${node.dataset.q}: ${vals.join(", ")}`);
        } else {
          const c = node.querySelector("input, select, textarea");
          const v = c && c.value.trim();
          if (v) lines.push(c.tagName === "TEXTAREA" && v.length > 60 ? `${labelText(node)}:\n${v}` : `${labelText(node)}: ${v}`);
        }
      });
      if (!lines.length) return;
      const legend = fs.querySelector("legend");
      out.push((legend ? legend.textContent.replace(/^\s*\d+\s*/, "").replace(/\*/g, "").trim() : "").toUpperCase(), ...lines, "");
    });
    out.push(`Sent from the Xolve website on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
    return out.join("\n");
  };

  /* ---------- validation ---------- */
  const validate = () => {
    const problems = [];
    form.querySelectorAll("[required]").forEach((el) => {
      const v = el.value.trim();
      const bad = !v || (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      el.setAttribute("aria-invalid", String(bad));
      if (bad) problems.push({ el, msg: el.dataset.msg || (el.type === "email" ? "a valid email" : labelText(el.closest("label") || el).toLowerCase()) });
    });
    form.querySelectorAll("[data-q][data-required]").forEach((g) => {
      const bad = !g.querySelector("input:checked");
      g.classList.toggle("is-invalid", bad);
      if (bad) problems.push({ el: g.querySelector("input"), msg: g.dataset.msg || g.dataset.q.toLowerCase() });
    });
    return problems;
  };

  /* ---------- submit ---------- */
  let lastText = "";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const problems = validate();
    if (problems.length) {
      const msgs = problems.map((p) => p.msg);
      const list = msgs.length > 1 ? `${msgs.slice(0, -1).join(", ")} and ${msgs[msgs.length - 1]}` : msgs[0];
      err.textContent = `Please add ${list}.`;
      err.hidden = false;
      problems[0].el.focus();
      return;
    }
    err.hidden = true;
    store.set(snap());
    lastText = toText();
    const f = form.elements;
    const who = (f.org && f.org.value.trim()) || (f.name && f.name.value.trim()) || "";
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(`${SUBJECT}${who ? " — " + who : ""}`)}&body=${encodeURIComponent(lastText)}`;
    mailBtn.href = href;
    preview.textContent = lastText;
    form.hidden = true;
    done.hidden = false;
    done.focus();
    window.scrollTo({ top: done.offsetTop - 90, behavior: "smooth" });
    window.location.href = href;
  });

  /* ---------- after submit ---------- */
  document.getElementById("briefEdit").addEventListener("click", () => { done.hidden = true; form.hidden = false; form.querySelector("input, textarea").focus(); });
  document.getElementById("briefCopy").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(lastText); btn.textContent = "Copied ✓"; }
    catch {
      const r = document.createRange(); r.selectNodeContents(preview);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      btn.textContent = "Selected: press Ctrl+C";
    }
    setTimeout(() => (btn.textContent = "Copy brief"), 2500);
  });
  document.getElementById("briefDownload").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lastText], { type: "text/plain" }));
    a.download = `${KEY.replace(/-v\d+$/, "")}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  document.getElementById("briefReset").addEventListener("click", () => {
    if (!confirm("Clear all your answers and start again?")) return;
    form.reset(); store.clear();
    if (saved) saved.textContent = "";
    err.hidden = true;
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  });

  // pre-select a choice from the link that brought the visitor here, e.g. ?care=1 or ?type=portfolio
  const params = new URLSearchParams(location.search);
  params.forEach((v, k) => {
    form.querySelectorAll(`input[name="${CSS.escape(k)}"]`).forEach((i) => { if (i.value === v || (v === "1" && i.dataset.preset === k)) i.checked = true; });
  });
})();
