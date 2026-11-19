#!/usr/bin/env node
// Refreshes public/data/nexus_mods.json: every Icarus mod published on Nexus Mods.
//
// Source: the Nexus Mods v2 GraphQL API, which lists a game's mods a page at a time
// and answers without an API key, so no key is sent. A key could only make the result
// worse: Nexus leaves out the mods its owner has blocked, and a key that is over its
// request allowance, or cannot be sent as a header, would end the run.
//
// The first version asked the v1 REST API for mod ids 1..300 one at a time and treated
// every failed call as "no such mod". When all of those calls started to fail it saved
// an empty catalog, and it could never see a mod with an id above 300. This version
// only saves a result it can trust: an API error, an incomplete walk, or a list much
// smaller than the one already on disk ends the run with an error and leaves the file
// as it was.
//
// Each mod gets a game-week compatibility ("wNNN") from the date it was last updated.

import fs from "node:fs";

const OUT = "public/data/nexus_mods.json";
const ENDPOINT = "https://api.nexusmods.com/v2/graphql";
const GAME_DOMAIN = "icarus";
const PAGE_SIZE = 80;        // the API returns at most 80 mods a page, whatever count is asked for
const MAX_PAGES = 100;       // 8,000 mods; a walk that needs more means the game filter was not applied
const ATTEMPTS = 3;          // per page, for network errors, HTTP 429 and HTTP 5xx
const WALKS = 3;             // the walk starts again if the catalog changes while it is being read
const MIN_KEEP_RATIO = 0.8;  // a list under 80% of the saved one's size is treated as a fault

const ALLOW_SHRINK = process.env.NEXUS_ALLOW_SHRINK === "1";

// Game-week anchor: per Steam, Apr 24 2026 was Week 229 (Atmospheric Update).
// Derive every other week relative to that known point.
const REFERENCE_MS = Date.UTC(2026, 3, 24); // Apr 24, 2026 (month 0-indexed)
const REFERENCE_WEEK = 229;

function gameWeek(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const offsetDays = Math.floor((t - REFERENCE_MS) / (24 * 3600 * 1000));
  // floorDiv on negative numbers: JS Math.floor handles this correctly
  const weeksOffset = Math.floor(offsetDays / 7);
  const wn = REFERENCE_WEEK + weeksOffset;
  return wn >= 1 ? `w${wn}` : null;
}

// The catalog has always stored times as 2026-06-12T08:39:33.000+00:00; the v2 API
// sends 2026-06-12T08:39:33Z. Keep the stored format so nothing reading the file changes.
function stamp(iso) {
  const t = Date.parse(iso || "");
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().replace("Z", "+00:00");
}

const QUERY = `
  query IcarusMods($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
    mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
      totalCount
      nodes {
        modId name author version summary pictureUrl endorsements downloads createdAt updatedAt
        uploader { name }
      }
    }
  }`;
const FILTER = {
  gameDomainName: [{ value: GAME_DOMAIN, op: "EQUALS" }],
  status: [{ value: "published", op: "EQUALS" }]
};
// Oldest first, so a mod published while the walk is running lands on the last page
// instead of shifting the pages already read. The name breaks a tie between two mods
// created in the same second, so they cannot swap places between two page requests.
const SORT = [{ createdAt: { direction: "ASC" } }, { name: { direction: "ASC" } }];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function failure(message, retryable = false) {
  const e = new Error(message);
  e.retryable = retryable;
  return e;
}

// The catalog changed between two page requests: this walk cannot be trusted, a new one can.
function changed(message) {
  const e = failure(message);
  e.changed = true;
  return e;
}

async function post(body) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Application-Name": "ProjectDaedalus",
      "Application-Version": "1.0"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000)
  });
  return { status: r.status, text: await r.text() };
}

async function fetchPageOnce(offset) {
  const body = { query: QUERY, variables: { filter: FILTER, sort: SORT, offset, count: PAGE_SIZE } };
  let res;
  try {
    res = await post(body);
  } catch (e) {
    throw failure(`request failed: ${e.message}`, true);
  }
  const snippet = res.text.slice(0, 300).replace(/\s+/g, " ");
  if (res.status === 429 || res.status >= 500) throw failure(`HTTP ${res.status}: ${snippet}`, true);
  if (res.status !== 200) throw failure(`HTTP ${res.status}: ${snippet}`);

  let json;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw failure(`the reply was not JSON: ${snippet}`, true);
  }
  if (!json || typeof json !== "object") throw failure(`the reply was not a JSON object: ${snippet}`);
  if (json.errors) {
    const list = Array.isArray(json.errors) ? json.errors : [json.errors];
    if (list.length) {
      throw failure(`the API reported: ${list.map(x => (x && x.message) || JSON.stringify(x)).join("; ").slice(0, 300)}`);
    }
  }
  const mods = json.data && json.data.mods;
  if (!mods || !Number.isInteger(mods.totalCount) || !Array.isArray(mods.nodes)) {
    throw failure(`the reply had no mod list: ${snippet}`);
  }
  return mods;
}

async function fetchPage(offset) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchPageOnce(offset);
    } catch (e) {
      if (!e.retryable || attempt >= ATTEMPTS) throw e;
      console.warn(`[nexus] offset ${offset}, attempt ${attempt} of ${ATTEMPTS}: ${e.message}; trying again`);
      await sleep(attempt * 3000);
    }
  }
}

async function fetchAllMods() {
  for (let walk = 1; ; walk++) {
    try {
      return await walkOnce();
    } catch (e) {
      if (!e.changed || walk >= WALKS) throw e;
      console.warn(`[nexus] walk ${walk} of ${WALKS}: ${e.message}; starting again`);
      await sleep(walk * 5000);
    }
  }
}

async function walkOnce() {
  const byId = new Map();
  let total = null;
  for (let offset = 0, page = 1; ; page++) {
    const { totalCount, nodes } = await fetchPage(offset);
    // Pages are cut by position. If a mod was hidden or published since the first page,
    // every later page has moved and one mod would be skipped or read twice.
    if (total !== null && totalCount !== total) {
      throw changed(`the number of mods changed from ${total} to ${totalCount} during the walk`);
    }
    total = totalCount;
    if (total > MAX_PAGES * PAGE_SIZE) {
      throw failure(`the API reports ${total} mods for "${GAME_DOMAIN}", more than this script expects; the game filter may not have been applied`);
    }
    for (const n of nodes) {
      if (!n || !Number.isInteger(n.modId) || n.modId < 1) {
        throw failure(`a mod came back without an id: ${JSON.stringify(n).slice(0, 200)}`);
      }
      byId.set(n.modId, n);
    }
    offset += nodes.length;
    console.log(`[nexus] page ${page}: ${nodes.length} mods (${byId.size} of ${total})`);
    if (nodes.length === 0 || offset >= total) break;
    if (page >= MAX_PAGES) throw failure(`the walk did not finish within ${MAX_PAGES} pages`);
  }
  if (byId.size !== total) {
    throw changed(`the API reports ${total} mods but the walk collected ${byId.size}`);
  }
  return [...byId.values()];
}

function savedCount() {
  try {
    const saved = JSON.parse(fs.readFileSync(OUT, "utf-8"));
    return Array.isArray(saved) ? saved.length : 0;
  } catch {
    return 0;
  }
}

async function main() {
  console.log(`[nexus] listing published "${GAME_DOMAIN}" mods from the Nexus Mods v2 API`);
  const results = await fetchAllMods();

  const previous = savedCount();
  if (results.length === 0) {
    throw failure(`Nexus returned no mods; keeping the saved catalog (${previous} mods)`);
  }
  if (!ALLOW_SHRINK && results.length < previous * MIN_KEEP_RATIO) {
    throw failure(
      `Nexus returned ${results.length} mods but the saved catalog has ${previous}; keeping the saved catalog. ` +
      `If the drop is real, run the workflow by hand with "allow_shrink" ticked (or set NEXUS_ALLOW_SHRINK=1).`
    );
  }

  const mods = results.map(d => ({
    id: String(d.modId),
    nexus_id: d.modId,
    name: (d.name || "").trim() || `Nexus mod #${d.modId}`,
    author: d.author || (d.uploader && d.uploader.name) || "Unknown",
    version: d.version || "",
    compatibility: gameWeek(d.updatedAt || d.createdAt),
    description: ((d.summary || "").replace(/\n/g, " ").trim()).slice(0, 200),
    summary: d.summary || "",
    image_url: d.pictureUrl || undefined,
    mod_page_url: `https://www.nexusmods.com/${GAME_DOMAIN}/mods/${d.modId}`,
    endorsements: d.endorsements,
    downloads: d.downloads,
    uploaded_time: stamp(d.createdAt),
    updated_time: stamp(d.updatedAt),
    source: "nexus"
  })).sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));

  fs.writeFileSync(OUT, JSON.stringify(mods));
  console.log(`[nexus] wrote ${mods.length} mods to ${OUT} (was ${previous})`);
  const withWeek = mods.filter(m => m.compatibility).length;
  console.log(`[nexus] ${withWeek}/${mods.length} have a derived game week`);
}

main().catch(e => {
  console.error(`[nexus] ${e.message}`);
  process.exit(1);
});
