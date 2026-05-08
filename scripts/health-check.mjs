// HEAD every mod's download URL, flag non-200 responses.
// Writes public/data/health.json with a per-mod status entry.

import fs from "node:fs";

const SITE_MODS = "public/data/mods.json";
const OUT = "public/data/health.json";

const mods = JSON.parse(fs.readFileSync(SITE_MODS, "utf8"));
const results = [];
const concurrency = 8;

async function probe(url) {
  if (!url) return { status: 0, error: "no-url" };
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow" });
    return { status: r.status, ok: r.ok };
  } catch (e) {
    return { status: 0, error: e.message.slice(0, 100) };
  }
}

async function worker(queue) {
  while (queue.length) {
    const m = queue.shift();
    const urls = Object.values(m.files || {}).filter(Boolean);
    if (!urls.length) continue;
    const checks = await Promise.all(urls.map(probe));
    const broken = checks.filter(c => !c.ok);
    if (broken.length) {
      results.push({
        id: m.id,
        name: m.name,
        author: m.author,
        broken_urls: urls.filter((_, i) => !checks[i].ok).map((u, i) => ({ url: u, status: broken[i].status, error: broken[i].error || null }))
      });
    }
  }
}

const queue = [...mods];
const workers = Array.from({ length: concurrency }, () => worker(queue));
await Promise.all(workers);

const out = {
  checked_at: new Date().toISOString(),
  total_mods: mods.length,
  total_broken: results.length,
  broken: results.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`[health] checked ${mods.length} mods, ${results.length} broken`);
