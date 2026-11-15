# Xolve website

**Every problem has a xolution.**

Static site (HTML, CSS, JavaScript) hosted on GitHub Pages at https://xolve-it.github.io.

| Path | What it is |
| --- | --- |
| `index.html` | Home page: hero, xolutions, how we xolve it, work, about (founder link), contact |
| `start/finance/` | Financial Modelling Xolution brief: the multi-step intake form |
| `start/cloud/` | Cloud Xolution brief: one-page form that emails the brief to Xolve |
| `css/style.css` | Site styles (brand colours at the top) |
| `css/brief.css` | Extra styles for the Cloud brief page |
| `js/main.js` | Mobile menu, scroll effects and the "Xolve something else" email form |
| `js/cloud-brief.js` | Cloud brief: saves answers, checks them and composes the email |
| `assets/brand/` | Logo files from the Xolve logo kit |
| root `favicon*`, `*.png`, `site.webmanifest` | Browser-tab and home-screen icons, link-preview image |

## Common edits

- **Contact email:** search for `get.xolutions@gmail.com` (in `index.html`, both brief pages and both JS files).
- **Founder link:** the "About me" button in the About section points to https://jaegarp.github.io.
- **Receiving finance briefs automatically:** set `endpoint` in the `window.FMI_CONFIG` block near the top of
  `start/finance/index.html` to a form service or webhook. While it is `""`, clients download their answers
  and email them to you.

## Custom domain (later)

1. Buy the domain.
2. In this repo: **Settings → Pages → Custom domain**, enter it and save (this adds a `CNAME` file).
3. At your registrar, add the DNS records GitHub shows (four `A` records for the bare domain, or a `CNAME`
   to `xolve-it.github.io` for `www`).
4. Update the `og:url` / `og:image` addresses in the page heads.
