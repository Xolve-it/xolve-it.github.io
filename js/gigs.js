/* AI Gigs by Xolve: reads /gigs/gigs.json (written every 8 hours by
   scripts/update_gigs.py) and shows it with search and filters.
   "For you" matches each listing's countries/exclude lists against the visitor's
   country, which Cloudflare reports at /cdn-cgi/trace (no third-party lookup). */
(() => {
  const $ = (s) => document.querySelector(s);
  const list = $("#glList"), count = $("#glCount"), more = $("#glMore"), meta = $("#gxMeta");
  const PAGE = 30, FOR_PAGE = 8;
  let data = null, kind = "gig", plat = "all", remoteOnly = false, q = "", shown = PAGE;
  let cc = "", forScope = "all", forShown = FOR_PAGE;

  const CODES = [...new Set(("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW").split(" "))];
  let regionNames = null;
  try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { /* older browsers: show codes */ }
  const cname = (c) => { try { return (regionNames && regionNames.of(c)) || c; } catch (e) { return c; } };
  const flag = (c, cls = "flag") => `<img class="${cls}" src="/assets/flags/${c.toLowerCase()}.svg" alt="" width="20" height="15" loading="lazy" decoding="async">`;
  const GLOBE = '<svg class="flag flag--globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 12h19M12 2.5c3 3.2 3 15.8 0 19M12 2.5c-3 3.2-3 15.8 0 19" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

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

  /* ---------- where a listing is open ---------- */
  const countriesOf = (g) => (Array.isArray(g.countries) ? g.countries : []);
  const worldwide = (g) => !countriesOf(g).length && g.remote;
  const openTo = (g, c) => !!c && !(g.exclude || []).includes(c) && (countriesOf(g).includes(c) || worldwide(g));
  const specificTo = (g, c) => !!c && countriesOf(g).includes(c);

  function whereTag(g) {
    const cs = countriesOf(g);
    if (!cs.length) return g.remote ? `<span class="gc__tag gc__where" title="Remote, open to applicants anywhere">${GLOBE} Open worldwide</span>` : "";
    // the visitor's own country goes first, so it is always visible
    const ordered = cc && cs.includes(cc) ? [cc].concat(cs.filter((c) => c !== cc)) : cs;
    const names = ordered.map(cname);
    if (ordered.length === 1) {
      const mine = ordered[0] === cc;
      return `<span class="gc__tag gc__where${mine ? " gc__where--mine" : ""}" title="Open to applicants in ${esc(names[0])}">${flag(ordered[0])} ${esc(names[0])}${mine ? " · for you" : ""}</span>`;
    }
    const lead = ordered.slice(0, 3), rest = ordered.length - lead.length;
    const mine = cs.includes(cc);
    return `<span class="gc__tag gc__where${mine ? " gc__where--mine" : ""}" title="Open to applicants in: ${esc(names.join(", "))}">${lead.map((c) => flag(c)).join("")}${rest > 0 ? ` +${rest}` : ""} ${mine ? "· for you" : `${ordered.length} countries`}</span>`;
  }

  function card(g) {
    return `
      <li class="gc${g.featured ? " gc--featured" : ""}">
        <div class="gc__main">
          <p class="gc__plat">${esc(platName(g.platform))}${g.featured ? ' <span class="gc__pick">Xolve pick</span>' : ""}</p>
          <h3 class="gc__title">${esc(g.title)}</h3>
          <p class="gc__meta">
            <span class="gc__tag gc__tag--${esc(g.type)}">${esc(KIND_LABEL[g.type] || g.type)}</span>
            ${g.pay ? `<span class="gc__tag gc__tag--pay">${esc(g.pay)}</span>` : ""}
            ${whereTag(g)}
            ${g.team ? `<span>${esc(g.team)}</span>` : ""}
            ${g.remote ? '<span class="gc__tag">Remote</span>' : ""}
            ${g.location && !(g.remote && /^remote$/i.test(g.location.trim())) ? `<span>${esc(g.location)}</span>` : ""}
            ${g.posted ? `<span>Posted ${esc(ago(g.posted))}</span>` : ""}
          </p>
        </div>
        <a class="btn btn--ink btn--sm gc__go" href="${esc(safeUrl(g.url))}" target="_blank" rel="noopener nofollow">View &amp; apply <span aria-hidden="true">→</span></a>
      </li>`;
  }

  /* ---------- all roles ---------- */
  function filtered() {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return data.gigs.filter((g) =>
      (kind === "all" || g.type === kind) &&
      (plat === "all" || g.platform === plat) &&
      (!remoteOnly || g.remote) &&
      words.every((w) => `${g.title} ${g.team} ${g.location} ${platName(g.platform)} ${g.remote ? "remote" : ""} ${countriesOf(g).map(cname).join(" ")}`.toLowerCase().includes(w)));
  }

  function render() {
    const rows = filtered();
    count.textContent = rows.length
      ? `${rows.length} ${rows.length === 1 ? "role" : "roles"}${kind === "gig" ? " (gigs & contract)" : ""}`
      : "";
    list.innerHTML = rows.slice(0, shown).map(card).join("");
    if (!rows.length) {
      list.innerHTML = `<li class="gl__empty">${kind === "gig"
        ? 'No gig or contract roles match right now. Try <button type="button" class="linkbtn" data-show-all>all roles</button>, or check the platforms below.'
        : "No roles match your search. Try fewer words."}</li>`;
    }
    more.hidden = rows.length <= shown;
  }

  /* ---------- for you ---------- */
  function renderForYou() {
    const box = $("#gf");
    if (!cc) { box.hidden = true; return; }
    const name = cname(cc);
    const open = data.gigs.filter((g) => openTo(g, cc));
    const only = open.filter((g) => specificTo(g, cc));
    // openings named for this country first, then the ones open worldwide
    const rows = forScope === "only" ? only : only.concat(open.filter((g) => !specificTo(g, cc)));
    const f = $("#gfFlag");
    f.src = `/assets/flags/${cc.toLowerCase()}.svg`; f.alt = `Flag of ${name}`; f.hidden = false;
    $("#gfHeading").textContent = `Openings for you in ${name}`;
    $("#gfLead").textContent = only.length
      ? `${only.length} ${only.length === 1 ? "opening names" : "openings name"} ${name}, plus ${open.length - only.length} remote roles open worldwide.`
      : `No openings are limited to ${name} right now, but ${open.length} remote roles are open to applicants worldwide.`;
    $("#gfAllN").textContent = open.length;
    $("#gfOnlyLabel").textContent = `Only for ${name}`;
    $("#gfOnlyN").textContent = only.length;
    $("#gfList").innerHTML = rows.length
      ? rows.slice(0, forShown).map(card).join("")
      : `<li class="gl__empty">No openings are limited to ${esc(name)} today. <button type="button" class="linkbtn" data-scope-all>See everything open to you</button>.</li>`;
    $("#gfMore").hidden = rows.length <= forShown;
    $("#gfCountry").value = cc;
    box.hidden = false;
  }

  function setCountry(c, remember) {
    cc = CODES.includes(c) ? c : "";
    forShown = FOR_PAGE;
    if (remember) { try { localStorage.setItem("xolve.gigs.cc", cc); } catch (e) { /* private mode */ } }
    renderForYou(); render();
  }

  function buildCountryPicker() {
    $("#gfCountry").innerHTML = CODES.map((c) => [c, cname(c)]).sort((a, b) => a[1].localeCompare(b[1]))
      .map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
  }

  async function detectCountry() {
    const valid = (c) => (c && CODES.includes(c.toUpperCase()) ? c.toUpperCase() : "");
    const fromUrl = valid(new URLSearchParams(location.search).get("country"));
    if (fromUrl) return fromUrl;
    try { const saved = valid(localStorage.getItem("xolve.gigs.cc")); if (saved) return saved; } catch (e) { /* no storage */ }
    try {
      const r = await fetch("/cdn-cgi/trace", { cache: "no-store" });
      if (r.ok) { const m = /^loc=([A-Z]{2})$/m.exec(await r.text()); if (valid(m && m[1])) return m[1]; }
    } catch (e) { /* not on Cloudflare (e.g. local preview) */ }
    for (const l of navigator.languages || [navigator.language]) {
      const m = /-([A-Za-z]{2})$/.exec(l || "");
      if (valid(m && m[1])) return m[1].toUpperCase();
    }
    return "";
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
  function setScope(s) {
    forScope = s; forShown = FOR_PAGE;
    document.querySelectorAll(".gfseg").forEach((b) => { const on = b.dataset.scope === s; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    renderForYou();
  }
  document.addEventListener("click", (e) => {
    const fs = e.target.closest(".gfseg");
    if (fs) { setScope(fs.dataset.scope); return; }
    if (e.target.closest("[data-scope-all]")) { setScope("all"); return; }
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
  $("#gfMore").addEventListener("click", () => { forShown += FOR_PAGE * 2; renderForYou(); });
  $("#gfCountry").addEventListener("change", (e) => setCountry(e.target.value, true));

  /* ---------- load ---------- */
  const country = detectCountry();
  fetch("/gigs/gigs.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(async (d) => {
      data = d;
      const gigs = d.gigs.filter((g) => g.type === "gig").length;
      meta.textContent = `${d.gigs.length} roles from ${new Set(d.gigs.map((g) => g.platform)).size} platforms · ${gigs} gigs & contract · updated ${when(d.updated)} · next check around ${when(d.next)}`;
      if (!gigs) { kind = "all"; document.querySelector('.seg__b[data-kind="all"]').classList.add("is-on"); document.querySelector('.seg__b[data-kind="gig"]').classList.remove("is-on"); }
      buildPlatforms(); buildSocials(); buildCountryPicker();
      setCountry(await country, false);
    })
    .catch(() => {
      meta.textContent = "We couldn't load the latest roles just now. The platforms below are always open.";
      $("#gpGrid").innerHTML = "";
    });
})();
