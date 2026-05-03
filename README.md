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
| `/home/` | Redirects to `/` (matches production logo link) |
| `/tools.html` | Community modding tools |
| `/info.html` | Dynamic info page — cards rendered from Firestore (or bundled JSON fallback) |
| `/mods/<author>/<slug>/` | Mod detail page for every one of the 490 curated mods — full PR #112 restyle layout, ratings widget, analytics panel |

### Data

- **490 real curated mods** in `public/data/mods.json` — the entire production catalog as of build.
- **133 real Nexus mods** in `public/data/nexus_mods.json` — bootstrap-walked from Nexus mod IDs 1..200, 56 unique authors.
- **4 community tools** in `public/data/tools.json`.
- **2 info cards** (Discord + Upvote page) in `public/data/info_content.json` — bundled fallback for the dynamic `/info.html`.
- **5 sample mod detail pages with full READMEs** in `public/data/mod_details.json` — the other 485 detail pages render the listing description plus a small italic note that the full README will load dynamically once Firestore is wired.
- All five JSON files are replaceable at runtime by Firebase Web SDK live subscriptions — see "Going live" below.

### UI / styling parity with the merged-PR view of production

- Real `daedalus-logo.png` in the gradient header
- Real `bg-topography-dark.svg` / `bg-topography-light.svg` set via `bg-topo-light dark:bg-topo-dark` Tailwind utilities
- Inter font, icarus-500 gold palette, paper card body, gradient header from slate-600 to slate-200
- **Theme toggle** (moon/sun emoji) in the header, persisted via `localStorage`, defaults to OS preference
- **Pagination**: 20 mods per page, "Showing X to Y of N mods" counter, `« Prev | 1 | 2 | … | last | Next »` navigator, deep-linkable via `#page=N` URL hash
  - **Mobile-aware**: pagination wraps onto multiple rows on narrow viewports, page-info and nav stack vertically below `sm:`, button padding/margins tighten so more buttons fit before wrap
  - **No forced scroll-to-top** on Next/Prev — rows update in place, scroll position stays put
- **Floating back-to-top button** (gold circle, lower-right) appears once you've scrolled past 400 px, smooth-scrolls to top. Lives in the layout so it's available on every page.
- **Search debounce at 400 ms** (matches the merged search-debounce-timing PR)
- **Author filter** with all 99 distinct authors in true alphabetical order (case-insensitive `localeCompare` so lowercase names mix in correctly)
- **Source filter** (Curated / Nexus / All) — Curated wins on any name+author duplicates, mirroring the Rails `combined_mods` dedup from PR #119
- **NEXUS badge** + **"View on Nexus ↗"** link on Nexus rows (PR #119), opens nexusmods.com in a new tab
- **Feedback links** (top hidden-on-mobile, bottom always-visible) pointing at `feedback.projectdaedalus.app`
- **Full OG meta block** (`og:title`, `og:description`, `og:type`, `og:site_name`, `og:image`) — mod detail pages emit `og:image` with the actual mod image URL via `eleventyComputed`
- Whitespace fix on Download / View on Nexus button labels (`&nbsp;` instead of trailing space inside the visible-on-sm `<span>`)

### Mod detail page (PR #112 restyle, faithfully)

Every mod has a pre-rendered detail page at `/mods/<author-slug>/<name-slug>/`. The layout matches PR #112's `app/views/mods/show.html.erb`:

- Header row with mod name + colored file-type badges (`exmodz` = gold, `pak` = green, others = slate) + one `DOWNLOAD <TYPE>` button per file type
- Author + version on a single flex row
- EXMODZ install note for mods that include an EXMOD/EXMODZ file
- **Anonymous mod rating widget** — 5-star clickable, see "Anonymous ratings" below
- Compatibility pill
- **Collapsible "Analytics for Mod Authors" panel** with: 4-card dashboard (File Types, Mod Age placeholder, Freshness placeholder, Your Activity tracking views/downloads in localStorage), Compatibility row with EXMOD-format note, Author Stats card (total mods + file-type counts computed at build time), Mod Status row defaulting to "All Clear"
- Image floats right inside the prose at `md:` and up
- Full README in prose styling (mods we have full READMEs for) or the truncated description (the rest)
- "Other mods by &lt;author&gt;" grid (up to 6 cards) below the readme
- Prev / Back to List / Next navigation at the bottom — pre-computed at build time

### Anonymous mod ratings (closed PR #99 idea, implemented)

Every mod detail page has a 5-star rating widget above the compatibility badge.

- A stable per-browser **fingerprint UUID** is generated and stored in localStorage so the same person can update their rating without ballot-stuffing across reloads.
- Click a star to rate, click the same star again to clear.
- **Without Firestore configured**: the rating is saved to localStorage. Summary reads "Your rating: ★★★ — visible only to you until live Firestore is configured".
- **With Firestore configured**: each rating writes to `ratings/{modId}/raters/{fingerprint}` with `{rating, timestamp}`. The page subscribes to the raters subcollection and shows a live aggregate: "★ 4.2 from 15 ratings · your rating: 5". Updates from other visitors propagate in ~1 second without reload.

### Dynamic info page (closed PR #104 idea, implemented)

`/info.html` is now a JS shell that subscribes to the `info_content` Firestore collection (with bundled JSON fallback). Each card document has `{id, order, icon, title, body, cta_label, url}`.

Once Firestore is wired, Donovan can add, edit, or reorder cards from the Firebase Console, and every open browser tab updates within ~1 second — no rebuild, no Pages redeploy. This is the issue #25 win — content edits without redeploy.

### Real-time data path

- Firebase Web SDK with `onSnapshot` listeners pre-wired in `public/assets/firebase-loader.js`
- `subscribe(collection, fallbackUrl, transform, callback)` API used by mods, tools, info, and ratings
- Bundled-JSON fallback runs automatically when Firebase isn't configured, so the site keeps working through the switchover
- Status badge in the bottom-right shows `○ Bundled snapshot` vs `● LIVE Firestore` per page

## Stack

- [Eleventy 3](https://www.11ty.dev/) — static site generator (per-page templates, build-time pagination of the 490 mod detail pages)
- [Tailwind CSS](https://tailwindcss.com/) via the CDN script (no build step)
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

The site currently runs against bundled JSON. To switch to live Firestore reads with real-time updates:

### 1. Drop in the Firebase Web SDK config

In Firebase Console for the `project-daedalus` project: Settings → General → Your apps → Web app → copy the `firebaseConfig` object. Paste into `public/assets/firebase-config.js`, replacing `null`.

The config (apiKey, projectId, etc.) is **public-safe by design** — Firebase's security model relies on Firestore Security Rules, not on hiding the apiKey. See https://firebase.google.com/docs/projects/api-keys.

### 2. Set Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    // Public reads on the public collections
    match /mods/{doc}         { allow read: if true; }
    match /tools/{doc}        { allow read: if true; }
    match /nexus_mods/{doc}   { allow read: if true; }
    match /info_content/{doc} { allow read: if true; }

    // Anonymous mod ratings — public read, validated write
    match /ratings/{modId}/raters/{fingerprint} {
      allow read: if true;
      allow write: if request.resource.data.rating is int
                    && request.resource.data.rating >= 1
                    && request.resource.data.rating <= 5;
      allow delete: if true;  // visitors can clear their own rating
    }

    // Default: deny everything else
    match /{document=**} { allow read, write: if false; }
  }
}
```

The validation on `ratings` writes prevents anyone storing arbitrary data under a fingerprint. If abuse becomes a concern, [Firebase App Check](https://firebase.google.com/docs/app-check) can rate-limit non-allowlisted origins.

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
| Anonymous mod ratings | Server-handled | Browser writes directly, validated by security rules |
| SSR for SEO | Yes | Pre-rendered HTML at build, dynamic data hydrates after |
| Effort to get here | Multi-week | This repo |

## What's representative vs what's not

- The 490 curated mods are real but bundled — they reflect the catalog at the time of the last build. Once Firestore is wired in, this becomes a live set that updates automatically.
- The 133 Nexus mods are real, pulled from `api.nexusmods.com` via the same bootstrap-walk approach NexusSync.bootstrap implements in PR #119's rake task. Snapshot is current as of build.
- 5 of 490 mod detail pages are pre-rendered with full READMEs as samples. The other 485 render the listing description plus the rest of the layout — version, downloads, prev/next, "other by author", analytics, ratings — and a small note that the full README loads dynamically once Firestore is wired.
- Anonymous ratings and dynamic info are wired client-side with localStorage + bundled JSON fallback today. They become fully live (cross-visitor aggregation, real-time content edits) when Firebase config is dropped in.
- The merged-PR templates referenced in this repo come from a local merge of all 7 open PRs at `DonovanMods/project_daedalus` (#111–#117 + the in-flight #119). None of those have merged on upstream yet, so this is a *preview* of what the production site would look like with all of them in.

### Things deliberately not implemented

- **GitHub Stats card on the analytics panel** (stars, forks, open issues, last push) — would need GitHub API calls per mod at build time, rate-limited and slow. The card is omitted from the analytics rather than shown empty.
- **Numeric Mod Age / Freshness** — most bundled mods don't have `created_at`/`updated_at` timestamps. The dashboard cards show "Available with live Firestore" placeholders.
- **"Most Recently Updated" line in Author Stats** — same reason as above.
