# Daedalus static POC

Proof-of-concept rebuild of [Project Daedalus](https://projectdaedalus.app) as a static site on GitHub Pages.

The goal is to evaluate whether the Rails app's mods directory could be served as a static site that reads from the existing Firestore project, eliminating the Rails server entirely.

## Live site

**https://agentkush.github.io/daedalus-static-poc/**

## What's in the build

### Pages

| URL | Purpose |
|-----|---------|
| `/` | Mods listing — search, author filter, source filter, 25-page pagination |
| `/tools.html` | Community modding tools (Daedalus Loader, Mod Editor, IMET, Mod Manager 2) |
| `/info.html` | Discord + Upvote page link cards |
| `/mods/<author>/<slug>/` | **Mod detail page for every one of the 490 curated mods** — full PR #112 restyle layout |

### Data

- **490 real curated mods** in `public/data/mods.json` — the entire production catalog as of build.
- **133 real Nexus mods** in `public/data/nexus_mods.json` — bootstrap-walked from Nexus mod IDs 1..200 (filtering removed/hidden entries), 56 unique authors, endorsement range 0–546.
- **4 community tools** in `public/data/tools.json`.
- **5 sample mod detail pages with full READMEs** in `public/data/mod_details.json` — the other 485 detail pages render the listing description plus a small italic note that the full README will load dynamically once Firestore is wired.
- All data is replaceable at runtime by the Firebase Web SDK — see "Going live" below.

### UI / styling parity with the merged-PR view of production

- Real `daedalus-logo.png` in the gradient header (left)
- Real `bg-topography-dark.svg` / `bg-topography-light.svg` set as the page background via `bg-topo-light dark:bg-topo-dark` Tailwind utilities — matches production class names exactly
- Inter font, icarus-500 gold palette, paper card body, gradient header from slate-600 to slate-200
- **Theme toggle** in the header (moon/sun emoji), persisted via `localStorage`, defaults to OS preference
- **Pagination**: 20 mods per page, "Showing X to Y of N mods" counter, "« Prev | 1 | 2 | … | last | Next »" navigator, deep-linkable via `#page=N` URL hash
  - **Mobile-aware**: pagination wraps onto multiple rows on narrow viewports, page-info and nav stack vertically below `sm:`, button padding/margins tighten so more buttons fit before wrap
  - **No forced scroll-to-top** when navigating pages — the rows update in place, you stay where you were
- **Floating back-to-top button** (gold circle, lower-right) — appears once you've scrolled past 400 px, smooth-scrolls to top on click. Lives in the layout so it works on every page.
- **Search debounce** at 200 ms (matches the merged search-debounce-timing PR)
- **Author filter** with **all 99 distinct authors** in true alphabetical order (case-insensitive `localeCompare` so lowercase names like `darkhyn`, `globeadue`, `jimk72` sort alongside `Donovan` and `Hazer` instead of getting pushed to the end)
- **Source filter** dropdown (Curated / Nexus / All) — Curated wins on any name+author duplicates, mirroring the Rails `combined_mods` dedup logic from PR #119
- **NEXUS badge** + **"View on Nexus ↗"** link on Nexus rows (from PR #119), opens nexusmods.com in a new tab
- **Feedback links** (top hidden-on-mobile, bottom always-visible) pointing at `feedback.projectdaedalus.app` — same wording and layout as production
- Download buttons stop click propagation so they don't trigger row navigation
- Whitespace fix on `Download <TYPE>` and `View on Nexus` buttons (`&nbsp;` instead of trailing space inside the visible-on-sm `<span>` so browsers don't collapse it at the inline-element boundary)

### Mod detail page (PR #112 restyle, faithfully)

Every mod in the catalog has a pre-rendered detail page at `/mods/<author-slug>/<name-slug>/`. The layout matches PR #112's `app/views/mods/show.html.erb`:

- Header row with mod name + colored file-type badges (`exmodz` = gold, `pak` = green, others = slate) + one `DOWNLOAD <TYPE>` button per file type
- Author + version on a single flex row
- EXMODZ install note for mods that include an EXMOD/EXMODZ file ("This Mod includes an EXMOD formatted file, which doesn't need updates each week. We recommend you use a Mod Manager to install this mod")
- Compatibility pill (when present)
- Image floats right inside the prose at `md:` and up
- Full README in prose styling (mods we have full READMEs for) or the truncated description (the rest)
- **"Other mods by &lt;author&gt;"** grid — up to 6 cards linking to other mods by the same author, with file-type badges
- **Prev / Back to List / Next** navigation at the bottom — all pre-computed at build time from the alphabetical mod order, so the site has full bidirectional navigation through every detail page

### Real-time data path

- Firebase Web SDK with `onSnapshot` listeners pre-wired in `public/assets/firebase-loader.js`
- `subscribe(collection, fallbackUrl, transform, callback)` API used by both the mods listing and the tools page
- Bundled-JSON fallback runs automatically when Firebase isn't configured, so the site keeps working through the switchover
- Status badge in the bottom-right shows `○ Bundled snapshot` vs `● LIVE Firestore`

## Stack

- [Eleventy 3](https://www.11ty.dev/) — static site generator (per-page templates, build-time pagination of the 490 mod detail pages)
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
| Issue #25 (info page editable without redeploy) | Limited by 5-min Rails cache | Trivial — edits propagate to open tabs in ~1 s |
| Real-time updates | No (5-min cache window) | Yes via `onSnapshot` |
| SSR for SEO | Yes | Pre-rendered HTML at build, dynamic data hydrates after (Google crawlers handle JS) |
| Anonymous mod ratings | Server-handled | Browser writes directly, security rules enforce |
| Effort to get here | Multi-week | This repo |

## What's representative vs what's not

- The 490 curated mods are real but bundled — they reflect the catalog at the time of the last build. Once Firestore is wired in, this becomes a live set that updates automatically.
- The 133 Nexus mods are real, pulled live from `api.nexusmods.com` via the same bootstrap-walk approach NexusSync.bootstrap implements in PR #119's rake task. Snapshot is current as of build; once Donovan's cron starts populating the live Firestore `nexus_mods` collection, this file becomes the offline fallback.
- 5 of 490 mod detail pages are pre-rendered with full READMEs as samples. The other 485 render the listing description plus version, downloads, prev/next, "other by author", and a small note that the full README loads dynamically once Firestore is wired. Two paths to closing this when needed:
  - Eleventy build-time pagination over the full mod set fetched from Firestore at build via the Admin SDK in a GitHub Action.
  - Or render the README dynamically in the browser by reading the mod doc by ID from Firestore on page load (no build step, real-time, but no SEO).
- The merged-PR templates referenced in this repo come from a local merge of all 7 open PRs at `DonovanMods/project_daedalus` (#111–#117 + the in-flight #119). None of those have merged on upstream yet, so this is a *preview* of what the production site would look like with all of them in.
