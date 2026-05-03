// Live-fills the "Mod Age" / "Freshness" cards and "Most Recently Updated"
// on the analytics panel using Firestore data. Looks up the current page's
// mod in the live mods collection by (author-slug, name-slug) match.

import { subscribe } from "./firebase-loader.js";

function slug(s) {
  return (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function timeAgo(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 86400 * 30) return Math.floor(s / 86400) + " day" + (Math.floor(s / 86400) === 1 ? "" : "s");
  if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + " month" + (Math.floor(s / (86400 * 30)) === 1 ? "" : "s");
  const years = Math.floor(s / (86400 * 365));
  return years + " year" + (years === 1 ? "" : "s");
}

function freshnessLabel(daysSinceUpdate) {
  if (daysSinceUpdate == null) return { label: "Unknown", css: "text-slate-400" };
  if (daysSinceUpdate < 14)  return { label: "Fresh",     css: "text-emerald-500" };
  if (daysSinceUpdate < 60)  return { label: "Recent",    css: "text-icarus-500" };
  if (daysSinceUpdate < 180) return { label: "Aging",     css: "text-yellow-500" };
  return                            { label: "Stale",     css: "text-red-400" };
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

(function init() {
  const det = document.querySelector("details[data-mod-id]");
  if (!det) return;
  const modId = det.dataset.modId;
  // modId is "<author-slug>--<name-slug>"
  const [authorSlug, nameSlug] = modId.split("--");
  if (!authorSlug || !nameSlug) return;

  // Subscribe to all mods (same call the listing makes — browser caches it)
  subscribe("mods", "./../../../data/mods.json", d => d, (mods, status) => {
    if (status.source !== "rest" && status.source !== "websdk") return; // need live timestamps

    // Find this mod by (author, name) slug match
    const me = mods.find(m =>
      slug(m.author) === authorSlug && slug(m.name) === nameSlug
    );
    if (!me) return;

    const created = me._createTime;
    const updated = me._updateTime;

    // Mod Age card
    const ageEl = document.querySelector('[data-analytics="mod-age"]');
    if (ageEl) {
      if (created) {
        ageEl.innerHTML = `${timeAgo(created)} old <div class="text-xs text-slate-500 dark:text-slate-400">Since ${fmtDate(created)}</div>`;
      } else {
        ageEl.innerHTML = `<span class="text-slate-400">Unknown</span>`;
      }
    }

    // Freshness card
    const freshEl = document.querySelector('[data-analytics="freshness"]');
    if (freshEl && updated) {
      const daysSince = Math.floor((Date.now() - new Date(updated).getTime()) / 86400000);
      const ind = freshnessLabel(daysSince);
      freshEl.innerHTML =
        `<div class="text-sm font-semibold ${ind.css}">${ind.label}</div>` +
        `<div class="text-xs text-slate-500 dark:text-slate-400">Updated ${daysSince} day${daysSince === 1 ? "" : "s"} ago</div>`;
    }

    // Author Stats: Most Recently Updated mod by this author
    const authorMods = mods.filter(m => slug(m.author) === authorSlug);
    if (authorMods.length) {
      authorMods.sort((a, b) => (b._updateTime || "").localeCompare(a._updateTime || ""));
      const newest = authorMods[0];
      const newestEl = document.querySelector('[data-analytics="newest-by-author"]');
      if (newestEl && newest && newest._updateTime) {
        const newestSlug = `${slug(newest.author)}/${slug(newest.name)}`;
        newestEl.innerHTML =
          `<a href="../../../mods/${newestSlug}/" class="text-sm font-medium text-icarus-400 hover:text-icarus-500 no-underline">${newest.name}</a>` +
          `<div class="text-xs text-slate-500 dark:text-slate-400">Most Recently Updated · ${fmtDate(newest._updateTime)}</div>`;
      }
    }
  });
})();
