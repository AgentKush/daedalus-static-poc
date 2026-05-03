#!/usr/bin/env node
// Fetches every modder's modinfo.json listed in data/modders.json,
// aggregates into public/data/mods.json. Mirrors the production pipeline
// where Donovan's local cron does the same against Firestore.

import fs from "node:fs";
import path from "node:path";

const SOURCES_PATH = "data/modders.json";
const OUT_PATH = "public/data/mods.json";

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function normalize(mod, sourceAuthor) {
  const author = mod.author || sourceAuthor;
  return {
    id: `${slug(author)}--${slug(mod.name)}`,
    name: mod.name,
    author,
    version: mod.version || "",
    compatibility: mod.compatibility && mod.compatibility !== "all" ? mod.compatibility : null,
    description: (mod.description || "").trim(),
    image_url: mod.imageURL || null,
    readme_url: mod.readmeURL || null,
    files: mod.files || {},
    week: mod.week || null
  };
}

async function main() {
  const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf-8")).sources;
  console.log(`[sync] fetching ${sources.length} modder feeds`);

  const all = [];
  const failures = [];
  for (const src of sources) {
    try {
      const data = await fetchJson(src.url);
      const mods = Array.isArray(data) ? data : (data.mods || []);
      for (const m of mods) {
        if (!m.name) continue;
        all.push(normalize(m, src.author));
      }
      console.log(`[sync] ${src.author}: ${mods.length} mod(s)`);
    } catch (e) {
      console.warn(`[sync] ${src.author}: FAILED ${e.message}`);
      failures.push({ source: src, error: e.message });
    }
  }

  // Dedup by id (keep first), sort by name
  const seen = new Map();
  for (const m of all) if (!seen.has(m.id)) seen.set(m.id, m);
  const merged = [...seen.values()].sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));

  // If we got fewer than half the source feeds successfully, abort to avoid clobbering good data
  const successCount = sources.length - failures.length;
  if (successCount < sources.length / 2) {
    console.error(`[sync] only ${successCount}/${sources.length} feeds succeeded — aborting to protect existing data`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged));

  console.log(`[sync] wrote ${OUT_PATH} with ${merged.length} unique mods from ${successCount}/${sources.length} sources`);
  if (failures.length) {
    console.log(`[sync] ${failures.length} failure(s):`);
    for (const f of failures) console.log(`  - ${f.source.author}: ${f.error}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
