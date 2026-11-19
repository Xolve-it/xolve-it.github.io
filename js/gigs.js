/* AI Gigs by Xolve: reads /gigs/gigs.json (written every 8 hours by
   scripts/update_gigs.py) and shows it with search and filters. */
(() => {
  const $ = (s) => document.querySelector(s);
  const list = $("#glList"), count = $("#glCount"), more = $("#glMore"), meta = $("#gxMeta");
  const PAGE = 30;
  let data = null, kind = "gig", plat = "all", remoteOnly = false, q = "", shown = PAGE;

  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https:\/\//i.test(u || "") ? u : "#");
  const ago = (iso) => {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso + "T00:00:00Z")) / 864e5);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    const m = Math.round(days / 30);
    return m <= 1 ? "a month ago" : `${m} months ago`;
  };
  const when = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const KIND_LABEL = { gig: "Gig / contract", job: "Full-time", internship: "Internship" };

  function platName(id) { const p = data.platforms.find((x) => x.id === id); return p ? p.name : id; }

  function filtered() {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return data.gigs.filter((g) =>
      (kind === "all" || g.type === kind) &&
      (plat === "all" || g.platform === plat) &&
      (!remoteOnly || g.remote) &&
      words.every((w) => `${g.title} ${g.team} ${g.location} ${platName(g.platform)} ${g.remote ? "remote" : ""}`.toLowerCase().includes(w)));
  }

  function render() {
    const rows = filtered();
    count.textContent = rows.length
      ? `${rows.length} ${rows.length === 1 ? "role" : "roles"}${kind === "gig" ? " (gigs & contract)" : ""}`
      : "";
    list.innerHTML = rows.slice(0, shown).map((g) => `
      <li class="gc${g.featured ? " gc--featured" : ""}">
        <div class="gc__main">
          <p class="gc__plat">${esc(platName(g.platform))}${g.featured ? ' <span class="gc__pick">Xolve pick</span>' : ""}</p>
          <h3 class="gc__title">${esc(g.title)}</h3>
          <p class="gc__meta">
            <span class="gc__tag gc__tag--${esc(g.type)}">${esc(KIND_LABEL[g.type] || g.type)}</span>
            ${g.remote ? '<span class="gc__tag">Remote</span>' : ""}
            ${g.location ? `<span>${esc(g.location)}</span>` : ""}
            ${g.posted ? `<span>Posted ${esc(ago(g.posted))}</span>` : ""}
          </p>
        </div>
        <a class="btn btn--ink btn--sm gc__go" href="${esc(safeUrl(g.url))}" target="_blank" rel="noopener nofollow">View &amp; apply <span aria-hidden="true">→</span></a>
      </li>`).join("");
    if (!rows.length) {
      list.innerHTML = `<li class="gl__empty">${kind === "gig"
        ? 'No gig or contract roles match right now. Try <button type="button" class="linkbtn" data-show-all>all roles</button>, or check the platforms below.'
        : "No roles match your search. Try fewer words."}</li>`;
    }
    more.hidden = rows.length <= shown;
  }

  function buildPlatforms() {
    const counts = {};
    data.gigs.forEach((g) => (counts[g.platform] = (counts[g.platform] || 0) + 1));
    $("#glPlats").innerHTML = [`<button type="button" class="pchip is-on" data-plat="all">All platforms</button>`]
      .concat(data.platforms.filter((p) => counts[p.id]).map((p) => `<button type="button" class="pchip" data-plat="${esc(p.id)}">${esc(p.name)} <i>${counts[p.id]}</i></button>`))
      .join("");
    $("#gpGrid").innerHTML = data.platforms.map((p) => {
      const href = safeUrl(p.referral || p.site);
      return `<li class="pcard" data-spot>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.about)}</p>
        <a class="link" href="${esc(href)}" target="_blank" rel="noopener${p.referral ? "" : " nofollow"}">${p.referral ? "Join with our link" : "Visit"} ${esc(p.name)} ↗</a>
      </li>`;
    }).join("");
  }

  function buildSocials() {
    const LABELS = { x: "X", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", whatsapp: "WhatsApp channel", telegram: "Telegram" };
    const items = Object.entries(data.socials || {}).filter(([, url]) => /^https:\/\//.test(url || ""));
    if (!items.length) return;
    const box = $("#gxSocial");
    box.insertAdjacentHTML("beforeend", items.map(([k, url]) => `<a class="btn btn--ghost btn--sm" href="${esc(url)}" target="_blank" rel="noopener">${esc(LABELS[k] || k)}</a>`).join(""));
    box.hidden = false;
  }

  /* ---------- controls ---------- */
  document.addEventListener("click", (e) => {
    const seg = e.target.closest(".seg__b");
    if (seg) {
      kind = seg.dataset.kind; shown = PAGE;
      document.querySelectorAll(".seg__b").forEach((b) => { b.classList.toggle("is-on", b === seg); b.setAttribute("aria-pressed", String(b === seg)); });
      render(); return;
    }
    const pc = e.target.closest(".pchip");
    if (pc) {
      plat = pc.dataset.plat; shown = PAGE;
      document.querySelectorAll(".pchip").forEach((b) => b.classList.toggle("is-on", b === pc));
      render(); return;
    }
    if (e.target.closest("[data-show-all]")) document.querySelector('.seg__b[data-kind="all"]').click();
  });
  let t;
  $("#glSearch").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; shown = PAGE; render(); }, 150); });
  $("#glRemote").addEventListener("change", (e) => { remoteOnly = e.target.checked; shown = PAGE; render(); });
  more.addEventListener("click", () => { shown += PAGE; render(); });

  /* ---------- load ---------- */
  fetch("/gigs/gigs.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      data = d;
      const gigs = d.gigs.filter((g) => g.type === "gig").length;
      meta.textContent = `${d.gigs.length} roles from ${new Set(d.gigs.map((g) => g.platform)).size} platforms · ${gigs} gigs & contract · updated ${when(d.updated)} · next check around ${when(d.next)}`;
      if (!gigs) { kind = "all"; document.querySelector('.seg__b[data-kind="all"]').classList.add("is-on"); document.querySelector('.seg__b[data-kind="gig"]').classList.remove("is-on"); }
      buildPlatforms(); buildSocials(); render();
    })
    .catch(() => {
      meta.textContent = "We couldn't load the latest roles just now. The platforms below are always open.";
      $("#gpGrid").innerHTML = "";
    });
})();
