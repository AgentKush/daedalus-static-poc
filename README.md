# Daedalus static POC

Proof-of-concept rebuild of [Project Daedalus](https://projectdaedalus.app) as a static site on GitHub Pages.

The goal is to evaluate whether the Rails app's mods directory could be served as a static site that reads from the existing Firestore project, eliminating the Rails server entirely.

## Live site

**https://agentkush.github.io/daedalus-static-poc/**

## What's in the build

### Pages

| URL | Purpose |
|-----|---------|
| `/` | Mods listing — search, author filter, source filter, pagination |
| `/tools.html` | Community modding tools |
| `/info.html` | Discord + Upvote page link cards |
| `/mods/<author>/<slug>/` | Mod detail page with full README, version + week badges, multiple download buttons (5 sample mods pre-rendered) |

### Data

- **490 real mods** bundled in `public/data/mods.json` — the entire catalog from projectdaedalus.app at the time of build.
- **4 community tools** in `public/data/tools.json`.
- **5 sample mod detail pages** with full READMEs in `public/data/mod_details.json`.
- All data is replaceable at runtime by the Firebase Web SDK — see "Going live" below.

### UI / styling parity with the merged-PR view of production

- Real `daedalus-logo.png` in the gradient header (left)
- Real `bg-topography-dark.svg` / `bg-topography-light.svg` set as the page background via `bg-topo-light dark:bg-topo-dark` Tailwind utilities — matches production's class names exactly
- Inter font, icarus-500 gold palette, paper card layout, gradient header from slate-600 to slate-200
- **Theme toggle** in the header (moon/sun emoji), persisted via `localStorage`, defaults to OS preference
- **Pagination**: 20 mods per page, 25 pages, "« Prev | 1 | 2 | … | 25 | Next »" navigator, "Showing X to Y of N mods" counter, deep-linkable via `#page=N` URL hash (matches production exactly)
- **Search debounce** at 200 ms (matches the merged search-debounce-timing PR)
- **NEXUS badge** + "View on Nexus ↗" link on Nexus-source rows (matches the merged PR #119 design — currently dormant since no Nexus mods are in the bundled data, but the JS path is wired)
- Source-filter dropdown (Curated / Nexus / All) for when Nexus data is in
- Download buttons stop click propagation so they don't trigger row navigation
- Mod detail pages with the gold-restyle look from PR #112 (image, version + week badges, multiple download buttons, prose-styled README)
- Tool cards with the layout pattern from PR #112's `tool-card` styles
- Info page link cards with the layout pattern from production's `/info`

### Real-time data path

- Firebase Web SDK with `onSnapshot` listeners pre-wired in `public/assets/firebase-loader.js`
- `subscribe(collection, fallbackUrl, transform, callback)` API used by both the mods page and the tools page
- Bundled-JSON fallback runs automatically when Firebase isn't configured, so the site keeps working through the switchover
- Status badge in the bottom-right shows `○ Bundled snapshot` vs `● LIVE Firestore`

## Stack

- [Eleventy 3](https://www.11ty.dev/) — static site generator (per-page templates, build-time pagination of mod detail pages)
- [Tailwind CSS](https://tailwindcss.com/) via the CDN script (no build step) — same approach as the existing Daedalus prototypes
- Firebase Web SDK v10 (loaded from gstatic CDN as ES modules at runtime, not bundled at build time)
- Plain ES modules for the client-side data and rendering layers
- GitHub Pages + Actions for hosting and auto-deploy

## Local dev

```
npm install
npm run serve   # http://localhost:8080
npm run build   # outputs to _site/
```

## Going live with Firestore real-time reads

The site currently runs against bundled JSON. To switch to live Firestore reads with real-time updates (changes propagate to open browser tabs within ~1 second, no reload required):

### 1. Drop in the Firebase Web SDK config

In Firebase Console for the `project-daedalus` project: Settings → General → Your apps → Web app → copy the `firebaseConfig` object.

Paste it into `public/assets/firebase-config.js`, replacing the `null` default. The config (apiKey, projectId, etc.) is **public-safe by design** — Firebase's security model relies on Firestore Security Rules, not on hiding the apiKey. It's expected to ship in client-side code. See https://firebase.google.com/docs/projects/api-keys.

### 2. Allow public reads on the relevant collections

In Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /mods/{doc}         { allow read: if true; }
    match /tools/{doc}        { allow read: if true; }
    match /nexus_mods/{doc}   { allow read: if true; }
    match /info_content/{doc} { allow read: if true; }

    match /{document=**} { allow read, write: if false; }
  }
}
```

Mod data is already public via the Rails site, so no privacy is lost. If abuse becomes a concern, [Firebase App Check](https://firebase.google.com/docs/app-check) can rate-limit reads from non-allowlisted origins.

### 3. Push

Commit `public/assets/firebase-config.js` with the real config and push. Pages auto-deploys, browser tabs swap to live data within seconds, status badge flips to `● LIVE Firestore`.

## Tradeoffs vs the Rails app

| | Rails (today) | Static POC |
|---|---|---|
| Hosting cost | Container host | $0, GitHub Pages |
| Server maintenance | Yes | None |
| Page load | SSR + 5-min Rails cache | Static HTML + client Firestore fetch |
| Search | Server-side via Turbo Frame | Client-side over fetched JSON |
| Pagination | Server-rendered per page | Client-side over the same fetched array |
| Issue #25 (info page editable without redeploy) | Limited by 5-min Rails cache | Trivial — edits propagate to open tabs in ~1s |
| Real-time updates | No (5-min cache window) | Yes via `onSnapshot` |
| SSR for SEO | Yes | Pre-rendered HTML at build, dynamic data hydrates after (Google crawlers handle JS) |
| Anonymous mod ratings | Server-handled | Browser writes directly, security rules enforce |
| Effort to get here | Multi-week | This repo |

## What's representative vs. what's not

- The 490 mods are real, but bundled — they reflect the catalog at the time of the last build. Once Firestore is wired in, this becomes a live set that updates automatically.
- 5 mod detail pages are pre-rendered with full READMEs as samples. The other ~485 mods don't have detail pages in this build because pre-rendering all of them at build time isn't tested at scale here. Two paths forward when / if needed:
  - Eleventy build-time pagination over the full mod set, fetched from Firestore at build via the Admin SDK in a GitHub Action.
  - Or render mod detail dynamically in the browser by reading the doc by ID from Firestore on page load (no build step, real-time, but no SEO).
- The merged-PR templates referenced in this repo come from a local merge of all 7 open PRs at `DonovanMods/project_daedalus` (#111–#117 + the in-flight #119). None of those have merged on upstream yet, so this is a *preview* of what the production site would look like with all of them in.
