"""Refresh AI Gigs from this computer and publish the result.

Some boards (micro1) refuse GitHub's servers, so the GitHub Action alone can't
keep every platform fresh. The Windows scheduled task "Xolve AI Gigs refresh"
runs this script from a dedicated copy of the site
(Documents\\Cl C\\xolve-gigs-refresh; not under AppData, which the Claude
app's packaged processes see redirected): it syncs that copy with GitHub, runs
update_gigs.py for every platform, and pushes gigs/gigs.json if anything changed.
Cloudflare Pages then republishes the site.

The copy is reset to GitHub's main branch on every run, so the script refuses to
run anywhere without the .gigs-bot marker file (never in a working checkout).
A log is kept next to the copy in refresh.log.
"""
import datetime as dt
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT.parent / "refresh.log"
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
FILES = ["gigs/gigs.json", "scripts/posted-dates.json"]


def log(msg):
    line = f"{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    try:
        old = LOG.read_text(encoding="utf-8").splitlines()[-400:] if LOG.exists() else []
        LOG.write_text("\n".join(old + [line]) + "\n", encoding="utf-8")
    except OSError:
        pass


def run(*args, check=True):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", creationflags=NO_WINDOW)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(args[:3])} failed: {(r.stderr or r.stdout).strip()[-400:]}")
    return r


def main():
    if not (ROOT / ".gigs-bot").exists():
        log(f"refused: {ROOT} is not the gigs bot copy (no .gigs-bot file)")
        return 2
    for attempt in range(1, 4):
        try:
            run("git", "fetch", "-q", "origin", "main")
            run("git", "reset", "-q", "--hard", "origin/main")
            out = run(sys.executable, "scripts/update_gigs.py").stdout.strip()
            run("git", "add", *FILES)
            if run("git", "diff", "--cached", "--quiet", check=False).returncode == 0:
                log(f"no change. {out.splitlines()[0] if out else ''}")
                return 0
            run("git", "commit", "-q", "-m", "Update AI gigs (all platforms, local refresh)")
            push = run("git", "push", "-q", "origin", "HEAD:main", check=False)
            if push.returncode == 0:
                log(f"published. {' | '.join(out.splitlines())}")
                return 0
            log(f"push rejected (attempt {attempt}), retrying: {push.stderr.strip()[-200:]}")
        except Exception as e:  # keep going on the next attempt / next scheduled run
            log(f"error (attempt {attempt}): {e}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
