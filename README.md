# Daedalus static POC

[![Live site](https://img.shields.io/badge/Live%20site-agentkush.github.io%2Fdaedalus--static--poc-f1ad1c?style=flat-square)](https://agentkush.github.io/daedalus-static-poc/)
[![Mod count](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fagentkush.github.io%2Fdaedalus-static-poc%2Fdata%2Fmods.json&query=%24.length&label=mods&color=f1ad1c&style=flat-square)](https://agentkush.github.io/daedalus-static-poc/)
[![Sync workflow](https://img.shields.io/github/actions/workflow/status/AgentKush/daedalus-static-poc/sync-mods.yml?label=hourly%20sync&style=flat-square)](https://github.com/AgentKush/daedalus-static-poc/actions/workflows/sync-mods.yml)
[![Pages deploy](https://img.shields.io/github/actions/workflow/status/AgentKush/daedalus-static-poc/deploy.yml?label=pages%20deploy&style=flat-square)](https://github.com/AgentKush/daedalus-static-poc/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

Static-site rebuild of [Project Daedalus](https://projectdaedalus.app) on GitHub Pages. Same look, same data, no Rails server.

The goal is to evaluate whether the Rails app's mods directory could be served as a static site that pulls from each modder's `modinfo.json` (same source production uses) without a backend.

## Live site

**https://agentkush.github.io/daedalus-static-poc/**

## What's in the build

### Pages

| URL | Purpose |
|-----|---------|
| `/home/` | Production-style landing page (hero + 3 feature cards + Discord CTA) |
| `/` | Mods listing — search, author filter, source filter, 25-page pagination |
| `/tools.html` | Community modding tools |
| `/info.html` | Dynamic info page — Discord, Mod Requests, Mod Manager + GPortal install PDFs (rendered from `info_content.json` with Firestore-subscription path) |
| `/requests.html` | Mod Requests board powered by GitHub Discussions Ideas category, reactions = upvotes |
| `/mods/<author>/<slug>/` | Mod detail page for every mod — full PR #112 restyle layout, ratings, analytics, GitHub-stats card, comments |

### Data

- **484 real curated mods** in `public/data/mods.json` — refreshed hourly from 38 modder `modinfo.json` feeds (see "How mod data gets in" below)
- **133 real Nexus mods** in `public/data/nexus_mods.json` — bootstrap-walked from Nexus mod IDs
- **4 community tools** in `public/data/tools.json`
- **4 info cards** (Discord, Mod Requests, IMM Setup PDF, GPortal Install PDF) in `public/data/info_content.json`
- **5 sample mod-detail READMEs** (full prose) in `public/data/mod_details.json` — the other ~480 detail pages render the listing description plus a small italic note that the full README will load dynamically once Firestore is wired
- 2 PDF guides shipped under `public/assets/guides/` and surfaced as info cards
- All five JSON files are replaceable at runtime by Firebase Web SDK live subscriptions (see "Going live")

### How mod data gets in: the modinfo.json sync pipeline

The 484 mods on the site come from the same mechanism production uses: **each modder hosts a `modinfo.json` file on their GitHub repo, and a scheduled job aggregates them all**. Production runs this on Donovan's machine via local cron every hour; this static rebuild mirrors that pipeline using **GitHub Actions cron** (also hourly).

```
modders' GitHub repos                     ← they edit modinfo.json on their own time
    ↓ (each hosts modinfo.json)
data/modders.json                          ← list of 38 known modder feed URLs
    ↓ (every hour)
.github/workflows/sync-mods.yml           ← Actions cron
    ↓ (runs scripts/sync-modinfos.mjs)
public/data/mods.json                      ← regenerated, only committed if changed
    ↓ (push triggers)
GitHub Pages auto-deploy
    ↓
agentkush.github.io/daedalus-static-poc/
```

`modinfo.json` schema (per modder):
```json
{
  "mods": [
    {
      "name": "Mod Name",
      "author": "Author",
      "version": "1.4",
      "week": "171",
      "compatibility": "w171",
      "description": "...",
      "imageURL": "https://...",
      "readmeURL": "https://...",
      "files": { "exmodz": "https://..." }
    }
  ]
}
```

If fewer than half the source feeds return successfully on a given run, the script aborts rather than clobber `mods.json` — network blips don't wipe the catalog.

To add yourself, see [CONTRIBUTING.md](CONTRIBUTING.md).

### UI / styling parity with the merged-PR view of production

- Real `daedalus-logo.png` in the gradient header, links to `/home/`
- Real `bg-topography-dark.svg` / `bg-topography-light.svg` page backgrounds (`bg-topo-light dark:bg-topo-dark` Tailwind utilities, matches production class names)
- Inter font, icarus-500 gold palette, paper card body
- **Theme toggle** (moon/sun emoji), persisted via `localStorage`, defaults to OS preference
- **Pagination** (20 mods per page, 25 pages), `« Prev | 1 | 2 | … | last | Next »` navigator, "Showing X to Y of N mods" counter, deep-linkable via `#page=N`
  - Mobile-aware wrap, no forced scroll-to-top on Next/Prev
- **Floating back-to-top button** (gold circle, lower-right) once you've scrolled past 400 px
- **Search debounce 400 ms** (matches the merged search-debounce-timing PR)
- **Author filter** with all distinct authors in case-insensitive alphabetical order
- **Source filter** (Curated / Nexus / All) — Curated wins on name+author duplicates
- **NEXUS badge** + "View on Nexus ↗" link on Nexus rows (PR #119)
- **Feedback links** in 3 places (top of listing hidden-on-mobile, bottom of listing, info card) all pointing at our `/requests.html`
- Full OG meta block including `og:image` per mod via `eleventyComputed`

### Mod detail page (PR #112 restyle, faithfully)

Every mod has a pre-rendered detail page at `/mods/<author-slug>/<name-slug>/` matching PR #112's `app/views/mods/show.html.erb`:

- File-type badges (`exmodz` = gold, `pak` = green, others = slate) in the header
- One `DOWNLOAD <TYPE>` button per file type
- Author + version on a single flex row
- EXMODZ install note for mods that ship as EXMOD/EXMODZ
- Compatibility pill
- Image floats right inside the prose at `md:` and up
- "Other mods by &lt;author&gt;" grid (up to 6 cards) below the readme
- Prev / Back to List / Next navigation, pre-computed at build time

Plus three things the static rebuild adds:

- **Collapsible "Analytics for Mod Authors" panel** — file types, compatibility, author stats (total mods + file-type counts), mod status, Your Activity (views/downloads tracked in localStorage), and a **lazy-loaded GitHub Stats card** that fetches `api.github.com/repos/{owner}/{repo}` when you open the panel and caches per repo for 1 hour
- **Anonymous mod ratings** — 5-star widget; per-browser fingerprint UUID prevents ballot-stuffing. localStorage now, Firestore aggregate when configured
- **Comments via GitHub login** — Giscus widget per mod, threads stored in this repo's GitHub Discussions

### Real-time data path

- Firebase Web SDK with `onSnapshot` listeners pre-wired in `public/assets/firebase-loader.js`
- `subscribe(collection, fallbackUrl, transform, callback)` API used by mods, tools, info, and ratings
- Bundled-JSON fallback runs automatically when Firebase isn't configured
- Status badge in the bottom-right shows `○ Bundled snapshot` vs `● LIVE Firestore` per page

## Stack

- [Eleventy 3](https://www.11ty.dev/) — static site generator (per-page templates, build-time pagination of all mod detail pages)
- [Tailwind CSS](https://tailwindcss.com/) via the CDN script (no build step)
- Firebase Web SDK v10 (loaded from gstatic CDN as ES modules at runtime)
- Plain ES modules for the client-side data and rendering layers
- Giscus for comments + Mod Requests board (GitHub Discussions backed)
- GitHub Pages + Actions for hosting, auto-deploy, and the hourly modinfo sync

## Local dev

```sh
npm install
npm run serve   # http://localhost:8080
npm run build   # outputs to _site/
```

## Going live with Firestore real-time reads

The site currently runs against bundled JSON. To switch to live Firestore reads with real-time updates (changes propagate to open browser tabs within ~1 second, no reload required):

### 1. Drop in the Firebase Web SDK config

In Firebase Console for the `project-daedalus` project: Settings → General → Your apps → Web app → copy the `firebaseConfig` object. Paste into `public/assets/firebase-config.js`, replacing `null`.

The config (apiKey, projectId, etc.) is **public-safe by design** — Firebase's security model relies on Firestore Security Rules, not on hiding the apiKey.

### 2. Set Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /mods/{doc}         { allow read: if true; }
    match /tools/{doc}        { allow read: if true; }
    match /nexus_mods/{doc}   { allow read: if true; }
    match /info_content/{doc} { allow read: if true; }

    // Anonymous mod ratings — public read, validated 1-5 write
    match /ratings/{modId}/raters/{fingerprint} {
      allow read: if true;
      allow write: if request.resource.data.rating is int
                    && request.resource.data.rating >= 1
                    && request.resource.data.rating <= 5;
      allow delete: if true;
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```

### 3. Push

Commit `firebase-config.js` and push. Pages auto-deploys, browser tabs swap to live data within seconds, status badge flips to `● LIVE Firestore`.

## Going live with Giscus comments

The Discussion section on every mod page (and the Mod Requests board) uses Giscus. The repo + category IDs are already filled in for `AgentKush/daedalus-static-poc`. The one-time setup step a maintainer needs to do:

1. Visit https://github.com/apps/giscus
2. Click **Configure** → choose **Only select repositories** → tick **daedalus-static-poc**
3. Click **Install**

Until that's done, the Giscus widget shows a "giscus is not installed on this repository" notice. After install, all 484 per-mod threads + the Mod Requests board are live.

## Tradeoffs vs the Rails app

| | Rails (today) | Static POC |
|---|---|---|
| Hosting cost | Container host | $0, GitHub Pages |
| Server maintenance | Yes | None |
| Mod data refresh | Cron on Donovan's local machine | GitHub Actions cron, hourly |
| Mod data latency | Up to 5 min after sync (Rails cache) | Up to ~1 hour (next sync) |
| Page load | SSR + 5-min Rails cache | Static HTML + client Firestore fetch |
| Search | Server-side via Turbo Frame | Client-side over fetched JSON |
| Pagination | Server-rendered per page | Client-side over the same fetched array |
| Real-time updates | No (5-min cache window) | Yes via `onSnapshot` |
| Anonymous mod ratings | Server-handled | Browser writes directly, security rules enforce |
| Comments | Not on production | GitHub Discussions via Giscus |
| Mod Requests | External Canny.io | GitHub Discussions Ideas category |
| Effort to get here | Multi-week | This repo |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most useful contribution for most people is adding a `modinfo.json` URL to [`data/modders.json`](data/modders.json) so the modder's mods sync to the site automatically.

## License

MIT — see [LICENSE](LICENSE).
