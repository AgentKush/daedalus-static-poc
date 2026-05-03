# Daedalus static POC

Proof-of-concept rebuild of [Project Daedalus](https://projectdaedalus.app) as a static site on GitHub Pages.

The goal is to evaluate whether the Rails app's mods directory could be served as a static site that reads from the existing Firestore project, eliminating the Rails server entirely.

## Live site

https://agentkush.github.io/daedalus-static-poc/

## What this demonstrates

- 11ty-generated static HTML with the existing Daedalus gold theme
- Client-side mods table with search, author filter, and source filter
- Pluggable data source: bundled mock JSON today, Firestore Web SDK tomorrow
- Auto-deploy to GitHub Pages via Actions on every push to `main`
- A `NEXUS` badge and "View on Nexus ↗" action that mirrors the design from project_daedalus PR #119

## What this does NOT do (yet)

- Read real Firestore data — `src/assets/app.js` has the swap-in code in a comment block. Activating it requires Donovan to:
  1. Allow public reads on the `mods` collection in Firestore Security Rules.
  2. Share the public Firebase Web config (apiKey/projectId/etc — these are public-safe by design).
- Pre-render mod detail pages (only the index is implemented).
- Anonymous mod ratings, dynamic info page, theme toggle, pagination — all skipped to keep the POC small.

## Stack

- [Eleventy 3](https://www.11ty.dev/) — static site generator
- [Tailwind CSS](https://tailwindcss.com/) via the CDN script (no build step) — same approach as the existing Daedalus mockups
- Plain ES modules for the client-side data layer
- GitHub Pages + Actions for hosting

## Local dev

```
npm install
npm run serve   # http://localhost:8080
npm run build   # outputs to _site/
```

## Swap-in path to real Firestore

In `src/assets/app.js`, replace the mock `loadMods()` body with the Firestore block below it, fill in Donovan's Firebase project config, and redeploy. No other code changes needed — the renderer doesn't care where the mods come from.

## Tradeoffs vs the Rails app

| | Rails (today) | Static POC |
|-|-|-|
| Hosting cost | Container host | $0, GitHub Pages |
| Server maintenance | Yes | None |
| Page load | SSR + 5-min cache | Static HTML + client fetch |
| Search | Server-side via Turbo Frame | Client-side over fetched JSON |
| Issue #25 (info page editable without redeploy) | Limited by Rails cache | Trivial — just edit Firestore, browser refetches |
| SSR for SEO | Yes | Pre-rendered HTML at build, dynamic data hydrates after |
| Anonymous mod ratings | Server-handled | Browser writes directly with tightened security rules |
| Effort to get here | Multi-week | This repo |
