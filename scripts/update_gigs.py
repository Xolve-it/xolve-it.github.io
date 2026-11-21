"""Xolve AI Gigs updater.

Reads scripts/gig-sources.json, fetches each platform's public job board,
and writes gigs/gigs.json for the AI Gigs page. Runs every 8 hours from
.github/workflows/update-gigs.yml; you can also run it by hand:

    python scripts/update_gigs.py

Standard library only. Curated listings (for example gigs you want to
promote with a referral link) can be added to scripts/gigs-manual.json;
they are merged in and kept at the top.
"""
import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "scripts" / "gig-sources.json"
MANUAL = ROOT / "scripts" / "gigs-manual.json"
OUT = ROOT / "gigs" / "gigs.json"
MAX_LISTINGS = 900
REFRESH_HOURS = 8

# a role counts as a "gig" when it is contract / part-time / hourly, or when its title names
# AI-training work (annotator, evaluator, tutor, red teamer...) and is not a staff role
CONTRACT_WORDS = re.compile(r"\b(contract|contractor|freelance|part[- ]?time|hourly|gig)\b", re.I)
EXPERT_WORDS = re.compile(r"\b(annotators?|evaluators?|raters?|tutors?|ai trainers?|trainers?|red ?teamers?|domain experts?|experts?)\b", re.I)
STAFF_WORDS = re.compile(r"\b(manager|director|head|lead|engineer|engineering|scientist|staff|recruit\w*|sales|account|operations|coordinator|counsel|analyst|designer|product)\b", re.I)
GIG_TYPES = {"contract", "parttime", "part-time", "temporary", "freelance"}

# ---------- where a role is open ----------
# Each listing gets "countries" (ISO 3166 two-letter codes it is open to; empty = anywhere when remote)
# and "exclude" (codes it is closed to). The AI Gigs page matches these against the visitor's country.
COUNTRIES = json.loads((ROOT / "scripts" / "countries.json").read_text(encoding="utf-8"))  # ISO3 -> [ISO2, name]
ISO2 = {k: v[0] for k, v in COUNTRIES.items()}
EUROPE = set("AL AD AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA XK".split())
US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC"
_names = {v[1].lower(): v[0] for v in COUNTRIES.values()}
_names.update({n.lower().replace(" sar", ""): c for n, c in list(_names.items()) if n.endswith(" sar")})
_names.update({
    "usa": "US", "us": "US", "u.s.": "US", "america": "US", "uk": "GB", "england": "GB", "scotland": "GB", "wales": "GB",
    "britain": "GB", "great britain": "GB", "uae": "AE", "turkey": "TR", "south korea": "KR", "korea": "KR", "vietnam": "VN",
    "ivory coast": "CI", "czech republic": "CZ", "russia": "RU", "mx": "MX",
    # cities and states that appear on the boards
    "san francisco": "US", "bay area": "US", "new york": "US", "nyc": "US", "washington, dc": "US", "seattle": "US",
    "palo alto": "US", "los angeles": "US", "miami": "US", "nashville": "US", "detroit": "US", "fremont": "US",
    "california": "US", "texas": "US", "london": "GB", "bengaluru": "IN", "bangalore": "IN", "sofia": "BG",
    "kuwait city": "KW", "toronto": "CA", "berlin": "DE", "paris": "FR", "são paulo": "BR", "sao paulo": "BR",
})
_name_re = re.compile(r"(?<![\w.])(" + "|".join(sorted(map(re.escape, _names), key=len, reverse=True)) + r")(?![\w])", re.I)
_state_re = re.compile(r",\s*(" + US_STATES.replace(" ", "|") + r")\b")


def countries_from_text(text):
    """Best-effort country codes from a free-text location ("San Francisco, CA; London, UK" -> US, GB)."""
    text = (text or "").replace("�", " ")
    low = text.lower()
    # "preferred" / "worldwide" / "global" mean anyone can apply
    if re.search(r"\b(prefer\w*|worldwide|global|anywhere)\b", low):
        return []
    found = {_names[m.group(1).lower()] for m in _name_re.finditer(text)}
    if _state_re.search(text):
        found.add("US")
    if re.search(r"\beurope\b", low):
        found |= EUROPE
    return sorted(found)


def countries_for(location, title):
    """Location first; if it names no country, a bracketed country in the title ("English Expert (Nigeria)")."""
    found = countries_from_text(location)
    if found or re.search(r"\b(prefer\w*|worldwide|global|anywhere)\b", (location or "").lower()):
        return found
    return sorted({c for part in re.findall(r"\(([^)]*)\)", title or "") for c in countries_from_text(part)})


def iso2_list(codes):
    return sorted({ISO2[c] for c in (codes or []) if c in ISO2})


def get_json(url, extra=None):
    headers = {"User-Agent": "xolve-gigs-updater/1.0", "Accept": "application/json"}
    if extra:
        headers.update(extra)
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def kind_of(title, emp_type):
    title = title or ""
    if (emp_type or "").replace(" ", "").lower() in GIG_TYPES or CONTRACT_WORDS.search(title):
        return "gig"
    if EXPERT_WORDS.search(title) and not STAFF_WORDS.search(title):
        return "gig"
    if (emp_type or "").lower() == "intern":
        return "internship"
    return "job"


def from_ashby(board, platform):
    data = get_json(f"https://api.ashbyhq.com/posting-api/job-board/{board}")
    out = []
    for j in data.get("jobs", []):
        if j.get("isListed") is False:
            continue
        loc = j.get("location") or ""
        remote = bool(j.get("isRemote")) or (j.get("workplaceType") or "").lower() == "remote" or "remote" in loc.lower()
        out.append({
            "id": f"{platform}-{j.get('id')}",
            "platform": platform,
            "title": (j.get("title") or "").strip(),
            "team": j.get("department") or j.get("team") or "",
            "location": loc,
            "remote": remote,
            "type": kind_of(j.get("title"), j.get("employmentType")),
            "posted": (j.get("publishedAt") or "")[:10],
            "url": j.get("jobUrl") or j.get("applyUrl") or "",
        })
    return out


def from_greenhouse(board, platform):
    data = get_json(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs")
    out = []
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name") or ""
        out.append({
            "id": f"{platform}-{j.get('id')}",
            "platform": platform,
            "title": (j.get("title") or "").strip(),
            "team": "",
            "location": loc,
            "remote": "remote" in loc.lower(),
            "type": kind_of(j.get("title"), ""),
            "posted": (j.get("first_published") or j.get("updated_at") or "")[:10],
            "url": j.get("absolute_url") or "",
        })
    return out


def from_lever(board, platform):
    data = get_json(f"https://api.lever.co/v0/postings/{board}?mode=json")
    out = []
    for j in data:
        cat = j.get("categories") or {}
        loc = cat.get("location") or ""
        created = j.get("createdAt")
        posted = dt.datetime.fromtimestamp(created / 1000, dt.timezone.utc).strftime("%Y-%m-%d") if created else ""
        out.append({
            "id": f"{platform}-{j.get('id')}",
            "platform": platform,
            "title": (j.get("text") or "").strip(),
            "team": cat.get("team") or "",
            "location": loc,
            "remote": (j.get("workplaceType") or "").lower() == "remote" or "remote" in loc.lower(),
            "type": kind_of(j.get("text"), cat.get("commitment")),
            "posted": posted,
            "url": j.get("hostedUrl") or "",
        })
    return out


def money(lo, hi, unit="hr"):
    try:
        lo = float(lo) if lo not in (None, "") else None
        hi = float(hi) if hi not in (None, "") else None
    except (TypeError, ValueError):
        return ""
    if lo is None and hi is None:
        return ""
    f = lambda v: f"${v:,.0f}"
    if lo is not None and hi is not None and lo != hi:
        return f"{f(lo)}–{f(hi)}/{unit}"
    return f"{f(lo if lo is not None else hi)}/{unit}"


def from_mercor_market(code, platform):
    """Mercor's public marketplace listings; each link carries the referral code."""
    data = get_json("https://aws.api.mercor.com/work/listings-explore-page")
    out = []
    for j in data.get("listings", []):
        if j.get("status") != "active" or j.get("isPrivate") or j.get("disableApplications"):
            continue
        lid = j.get("listingId")
        unit = {"hourly": "hr", "weekly": "wk", "monthly": "mo", "yearly": "yr"}.get((j.get("payRateFrequency") or "hourly").lower(), "hr")
        url = f"https://work.mercor.com/explore?listingId={lid}"
        if code:
            url += f"&referralCode={code}&utm_source=referral&utm_medium=direct&utm_campaign=platform"
        # Mercor publishes who may apply: residence rules first, then work-location rules, then the text
        allowed = iso2_list(j.get("eligibleResidenceLocation")) or iso2_list(j.get("eligibleLocation")) \
            or countries_for(j.get("location"), j.get("title"))
        blocked = sorted(set(iso2_list(j.get("ineligibleResidenceLocation")) + iso2_list(j.get("ineligibleLocation"))) - set(allowed))
        out.append({
            "countries": allowed,
            "exclude": blocked,
            "id": f"{platform}-{lid}",
            "platform": platform,
            "title": (j.get("title") or "").strip(),
            "team": j.get("listingDomain") or "",
            "location": j.get("location") or "",
            "remote": (j.get("workArrangement") or "").lower() == "remote" or "remote" in (j.get("location") or "").lower(),
            "type": "gig",
            "posted": (j.get("postedAt") or j.get("createdAt") or "")[:10],
            "pay": money(j.get("rateMin"), j.get("rateMax"), unit),
            "url": url,
        })
    return out


def from_micro1_referral(code, platform):
    """micro1's public referral job board; its apply links already carry the referral code."""
    out, page, total = [], 1, None
    while page <= 20:
        # micro1 refuses requests from some cloud networks (e.g. GitHub's); when it does, main()
        # keeps the last good micro1 listings. Running this script from a normal connection refreshes them.
        data = get_json(f"https://prod-api.micro1.ai/api/v1/job/portal/referral/{code}/jobs?page={page}&limit=100")
        jobs = data.get("data") or []
        total = total or int(data.get("total") or 0)
        for j in jobs:
            rate = j.get("ideal_hourly_rate") or {}
            out.append({
                "id": f"{platform}-{j.get('job_id')}",
                "platform": platform,
                "title": (j.get("job_name") or "").strip(),
                "team": (j.get("domain_slug") or j.get("role_type") or "").replace("-", " ").title(),
                "location": (j.get("location_type") or "Remote").replace("_", " ").title(),
                "remote": (j.get("location_type") or "remote").lower() in ("remote", "", "global"),
                "type": "gig",
                "posted": (j.get("date_posted") or "")[:10],
                "pay": money(rate.get("min"), rate.get("max")) if isinstance(rate, dict) else "",
                "url": j.get("apply_url") or "",
            })
        if not jobs or len(out) >= total:
            break
        page += 1
    return out


def from_feed(feed, platform):
    t = feed["type"]
    if t == "mercor_market":
        return from_mercor_market(feed.get("code", ""), platform)
    if t == "micro1_referral":
        return from_micro1_referral(feed["code"], platform)
    return READERS[t](feed["board"], platform)


READERS = {"ashby": from_ashby, "greenhouse": from_greenhouse, "lever": from_lever}


def main():
    src = json.loads(SOURCES.read_text(encoding="utf-8"))
    gigs, errors, failed = [], [], set()
    for p in src["platforms"]:
        for feed in p.get("feeds", []):
            try:
                gigs += from_feed(feed, p["id"])
            except Exception as e:  # one broken board must not stop the rest
                errors.append(f"{p['name']} ({feed['type']}:{feed.get('board') or 'referral'}): {e}")
                failed.add((p["id"], feed["type"]))

    # if a feed refused us this time, keep its listings from the last good run instead of dropping them
    if failed and OUT.exists():
        try:
            prev = json.loads(OUT.read_text(encoding="utf-8")).get("gigs", [])
            fresh_ids = {g["id"] for g in gigs}
            failed_platforms = {pid for pid, _ in failed}
            kept = [g for g in prev if g.get("platform") in failed_platforms and g["id"] not in fresh_ids and not g.get("featured")]
            gigs += kept
            if kept:
                errors.append(f"kept {len(kept)} listings from the last good run for: {', '.join(sorted(failed_platforms))}")
        except Exception as e:
            errors.append(f"could not reuse previous listings: {e}")

    manual = []
    if MANUAL.exists():
        try:
            manual = json.loads(MANUAL.read_text(encoding="utf-8"))
            for m in manual:
                m.setdefault("type", "gig"); m["featured"] = True
        except Exception as e:
            errors.append(f"gigs-manual.json: {e}")

    seen, unique = set(), []
    for g in gigs + manual:
        if "countries" not in g:
            g["countries"] = countries_for(g.get("location"), g.get("title"))
        g.setdefault("exclude", [])
    for g in gigs:
        if g["id"] in seen or not g["url"] or not g["title"]:
            continue
        seen.add(g["id"]); unique.append(g)
    # gigs first, then newest first
    unique.sort(key=lambda g: (g["type"] != "gig", g["posted"] == "", "".join(chr(255 - ord(c)) for c in g["posted"])))
    listings = manual + unique[:MAX_LISTINGS]

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    out = {
        "updated": now.isoformat().replace("+00:00", "Z"),
        "next": (now + dt.timedelta(hours=REFRESH_HOURS)).isoformat().replace("+00:00", "Z"),
        "socials": src.get("socials", {}),
        "platforms": [{k: p.get(k, "") for k in ("id", "name", "site", "referral", "about")} for p in src["platforms"]],
        "gigs": listings,
        "errors": errors,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {}
    for g in listings:
        counts[g["type"]] = counts.get(g["type"], 0) + 1
    print(f"Wrote {len(listings)} listings {counts}; errors: {len(errors)}")
    for e in errors:
        print("  !", e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
