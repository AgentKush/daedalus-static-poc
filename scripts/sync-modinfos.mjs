#!/usr/bin/env node
// Aggregates mod listings from each modder's modinfo.json on GitHub.
//
// Source of truth: production's registry at
//   firestore.googleapis.com/v1/projects/projectdaedalus-fb09f/databases/(default)/documents/meta/repos
// which is a public-readable Firestore document with a list of GitHub repo URLs.
//
// For each repo, we probe https://raw.githubusercontent.com/{owner}/{repo}/{branch}/modinfo.json
// across common branches (main, master, EXMODZ, Icarus) until one returns a valid modinfo.
//
// data/modders.json is a cached snapshot of the registry, regenerated on every run.

import fs from "node:fs";

const REGISTRY_URL = "https://firestore.googleapis.com/v1/projects/projectdaedalus-fb09f/databases/(default)/documents/meta/repos";
const BRANCHES = ["main", "master", "EXMODZ", "Icarus"];
const OUT_PATH = "public/data/mods.json";
const REGISTRY_OUT = "data/modders.json";

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function getRepoList() {
  // Try live registry first; fall back to cached snapshot if unreachable
  try {
    const data = await fetchJson(REGISTRY_URL);
    return (data.fields?.list?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean);
  } catch (e) {
    console.warn(`[sync] couldn't reach live registry: ${e.message} — using cached data/modders.json`);
    const cached = JSON.parse(fs.readFileSync(REGISTRY_OUT, "utf-8"));
    return cached.repos || [];
  }
}

function repoToOwnerName(repoUrl) {
  // Accepts e.g. https://github.com/Owner/Repo or https://github.com/Owner/Repo/
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : null;
}

async function findInfoForRepo(repoUrl) {
  const parts = repoToOwnerName(repoUrl);
  if (!parts) return { mods: [], tools: [], branch: null };
  // Probe each candidate file across branches; a single repo can have both
  // modinfo.json (mod listings) and toolinfo.json (modding tools).
  const result = { mods: [], tools: [], branch: null, sources: [] };
  for (const branch of BRANCHES) {
    for (const filename of ["modinfo.json", "toolinfo.json"]) {
      const url = `https://raw.githubusercontent.com/${parts.owner}/${parts.repo}/${branch}/${filename}`;
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const data = await r.json();
        if (Array.isArray(data?.mods)) result.mods.push(...data.mods);
        if (Array.isArray(data?.tools)) result.tools.push(...data.tools);
        result.branch = result.branch || branch;
        result.sources.push(`${branch}/${filename}`);
      } catch {}
    }
    if (result.sources.length) break; // first branch with a hit wins
  }
  return result;
}

function normalizeTool(t, fallbackAuthor) {
  const author = t.author || fallbackAuthor;
  const fileUrl = (t.files && Object.values(t.files)[0]) || t.fileURL || t.url || "";
  const filename = fileUrl ? fileUrl.split("/").pop().split("?")[0] : "";
  return {
    id: `${slug(author)}-${slug(t.name)}`,
    name: t.name,
    author,
    version: t.version || "",
    url: fileUrl,
    filename,
    body_html: t.description || t.body_html || "",
    updated_string: t.updated_string || (t.updated_at ? `Last Updated on ${t.updated_at}` : "")
  };
}

function normalizeMod(m, fallbackAuthor) {
  const author = m.author || fallbackAuthor;
  return {
    id: `${slug(author)}--${slug(m.name)}`,
    name: m.name,
    author,
    version: m.version || "",
    compatibility: m.compatibility && m.compatibility.toLowerCase() !== "all" ? m.compatibility : null,
    description: (m.description || "").trim(),
    image_url: m.imageURL || null,
    readme_url: m.readmeURL || null,
    files: m.files || {},
    week: m.week || null
  };
}

async function main() {
  const repos = await getRepoList();
  console.log(`[sync] ${repos.length} repos in registry`);

  // Cache the registry snapshot for offline use
  fs.writeFileSync(REGISTRY_OUT, JSON.stringify({
    _comment: "Mirrored from production's meta/repos Firestore document. Each entry is a GitHub repo URL — sync probes main/master/EXMODZ/Icarus branches for modinfo.json at sync time. Regenerated on every run.",
    _source: REGISTRY_URL,
    repos
  }, null, 2));

  const allMods = [];
  const allTools = [];
  const failures = [];
  let i = 0;
  for (const repoUrl of repos) {
    i++;
    const found = await findInfoForRepo(repoUrl);
    const repoLabel = repoUrl.replace("https://github.com/", "");
    const fallbackAuthor = repoUrl.split("/")[3];
    if (!found.mods.length && !found.tools.length) {
      failures.push(repoUrl);
      console.warn(`[sync] [${i}/${repos.length}] ${repoLabel}: no modinfo.json or toolinfo.json`);
      continue;
    }
    for (const m of found.mods) {
      if (m.name) allMods.push(normalizeMod(m, fallbackAuthor));
    }
    for (const t of found.tools) {
      if (t.name) allTools.push(normalizeTool(t, fallbackAuthor));
    }
    const parts = [];
    if (found.mods.length)  parts.push(`${found.mods.length} mod(s)`);
    if (found.tools.length) parts.push(`${found.tools.length} tool(s)`);
    console.log(`[sync] [${i}/${repos.length}] ${repoLabel} (${found.branch}): ${parts.join(", ")}`);
  }

  // Dedup by id (keep first), sort alphabetically
  const seen = new Map();
  for (const m of allMods) if (!seen.has(m.id)) seen.set(m.id, m);
  const merged = [...seen.values()].sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));

  // Safety: if more than half the repos failed, abort
  const successRatio = (repos.length - failures.length) / repos.length;
  if (successRatio < 0.5) {
    console.error(`[sync] only ${(successRatio*100).toFixed(0)}% of repos returned modinfo.json — aborting to protect existing data`);
    process.exit(1);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(merged));

  // Dedup tools by id, keep first
  const toolsSeen = new Map();
  for (const t of allTools) if (!toolsSeen.has(t.id)) toolsSeen.set(t.id, t);
  const tools = [...toolsSeen.values()].sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));
  fs.writeFileSync("public/data/tools.json", JSON.stringify(tools));

  console.log(`[sync] wrote ${merged.length} mods + ${tools.length} tools from ${repos.length - failures.length}/${repos.length} working repos`);
  if (failures.length) {
    console.log(`[sync] ${failures.length} repos with no findable modinfo.json:`);
    for (const r of failures) console.log(`  - ${r}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
