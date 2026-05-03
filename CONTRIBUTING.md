# Contributing to daedalus-static-poc

Thanks for wanting to help out!

## Adding yourself as a modder

The site builds its mod list from each modder's `modinfo.json` file on GitHub. To get your mods in:

1. Make sure your GitHub repo has a `modinfo.json` at a stable URL with this shape:
   ```json
   {
     "mods": [
       {
         "name": "Mod Name",
         "author": "Your Name",
         "version": "1.0",
         "week": "171",
         "compatibility": "w171",
         "description": "What the mod does, in plain English",
         "imageURL": "https://...",
         "readmeURL": "https://...",
         "files": { "exmodz": "https://..." }
       }
     ]
   }
   ```
2. Open a PR adding your entry to [`data/modders.json`](data/modders.json):
   ```json
   { "author": "Your Name", "url": "https://raw.githubusercontent.com/you/your-mods-repo/main/modinfo.json" }
   ```
3. Once merged, the next hourly cron run picks you up. To see it sooner, a maintainer can manually trigger the **Sync mods from modinfo.json sources** workflow on the [Actions tab](https://github.com/AgentKush/daedalus-static-poc/actions).

## Reporting issues with a mod listing

Open a [GitHub Discussion](https://github.com/AgentKush/daedalus-static-poc/discussions) under the General category, or comment directly on the mod's detail page (the comment box at the bottom is backed by Discussions).

## Requesting a new mod

Open a thread on the [Mod Requests board](https://agentkush.github.io/daedalus-static-poc/requests.html) (or directly in the Ideas Discussion category). Other visitors upvote with 👍 reactions; mod authors sort by reaction count to find what's wanted.

## Code changes

This is a static-site proof of concept built on Eleventy + Tailwind CDN. To work on it locally:

```sh
git clone https://github.com/AgentKush/daedalus-static-poc.git
cd daedalus-static-poc
npm install
npm run serve   # http://localhost:8080
npm run build   # outputs to _site/
```

PRs welcome for:
- New pages or features that mirror what production has
- Bug fixes (broken styles on mobile, etc.)
- New modder feed URLs (see "Adding yourself as a modder" above)
- Doc fixes

PRs less likely to land:
- Breaking changes to the data shape — would also need to be coordinated with the production Rails app and other consumers of `modinfo.json`
- Adding heavyweight dependencies (the goal is "static, no backend")

## Commit conventions

- Verified commits only (this repo enforces it for `main` via ruleset). The deploy workflow handles this for normal pushes; for direct pushes use a GPG/SSH-signed commit or push via the GitHub web UI / CLI which signs automatically.
- No `Co-Authored-By: Claude` trailers — preference of the maintainer.

## Code of Conduct

Be respectful to other contributors and modders. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the full text.
