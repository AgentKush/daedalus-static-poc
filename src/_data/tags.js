const mods = require("../../public/data/mods.json");
const nexusMods = require("../../public/data/nexus_mods.json");

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Tag rules: keyword → tag. Order doesn't matter (a mod can match multiple).
// Each rule is { tag, pattern (RegExp source) }. Matched against `${name} ${description}`.
const RULES = [
  // SPEED
  { tag: "speed",          re: /\b(faster|increased[\s-]+speed|production[\s-]+speed|extraction[\s-]+speed|taming[\s-]+speed|smelting[\s-]+speed|crafting[\s-]+speed|processing[\s-]+speed|harvest[\s-]+speed|speed[\s-]+up|x\d+[\s-]*(faster|speed|quicker)|crafting[\s-]+and[\s-]+processing|halves[\s-]+crafting)\b/i },
  // NO-DECAY — also match "no spoilage" / "extends decay timers" / "prevents spoil"
  { tag: "no-decay",       re: /\b(no[\s-]*(decay|spoil(age)?)|prevent(s|ing|ed)?[\s-]+(decay|spoil(age)?)|stop(s|ping|ped)?[\s-]+(decay|spoil(age)?)|reduce(s|d)?[\s-]+(decay|spoil(age)?)|extend(s|ed)?[\s-]+(decay|spoil(age)?)[\s-]*(timer|time)?|decay[\s-]+timer)\b/i },
  // INDESTRUCTIBLE
  { tag: "indestructible", re: /\b(indestructible|unbreakable|infinite[\s-]?dur(ability)?|max(imum)?[\s-]?durability|never[\s-]+break)\b/i },
  // TALENTS
  { tag: "talents",        re: /\btalent(s|[\s-]?tree)?\b/i },
  // WORKSHOP
  { tag: "workshop",       re: /\bworkshop\b/i },
  // QOL
  { tag: "qol",            re: /\b(qol|quality[\s-]of[\s-]life)\b/i },
  // STACK
  { tag: "stack",          re: /\b(stack[s]?\b|stack[\s-]?size[s]?|stackable|stack[\s-]?of)\b/i },
  // WEIGHT
  { tag: "weight",         re: /\b(carry[\s-]?weight|reduce(d|s)?[\s-]?weight|encumb(er|rance)|backpack[s]?|hercules)\b/i },
  // AMMO
  { tag: "ammo",           re: /\b(ammo|ammunition|arrow[s]?\b|bullet[s]?\b)\b/i },
  // WEAPONS
  { tag: "weapons",        re: /\b(crossbow[s]?|compound[\s-]?bow[s]?|recurve[\s-]?bow[s]?|long[\s-]?bow[s]?|pistol[s]?|rifle[s]?|shotgun[s]?|sniper[s]?|sword[s]?|spear[s]?|javelin[s]?|grenade[s]?|hk[\s-]?417|sks|firearm[s]?|turret[s]?)\b/i },
  // TOOLS — accept plural and tool-kit phrasing
  { tag: "tools",          re: /\b(pickaxe[s]?|sledgehammer[s]?|sickle[s]?|woodaxe[s]?|extractor[s]?|fishing[\s-]?rod[s]?|build[\s-]?tool[s]?|map[\s-]?tool[s]?|dev[\s-]?tool[s]?|tool[\s-]?kit[s]?)\b/i },
  // ARMOR — accept plurals on attachment/piece/kit
  { tag: "armor",          re: /\b(armou?r[\s-]?set[s]?|armou?r[\s-]?attachment[s]?|armou?r[\s-]?expansion|armou?r[\s-]?piece[s]?|armou?r[\s-]?kit[s]?|envir(?:o|on(?:mental)?)[\s-]?suit[s]?|attachment[s]?[\s-]+slot)\b/i },
  // CREATURES
  { tag: "creatures",      re: /\b(creature[s]?|wolf|wolves|bear[\s-]?(cub|mount|pet)?|moose|deer|chicken[s]?|cow[s]?\b|fishing|fishery|fishable|wildlife|spawn[\s-]?zone[s]?|spawn[\s-]?rate|tame|taming|wolf[\s-]?pack|honey[\s-]?bee[s]?|raccoon[s]?|rabbit[s]?|sulfur[\s-]?worm|sulfur[\s-]?vesper|cave[\s-]?worm|vesper[s]?)\b/i },
  // MOUNTS
  { tag: "mounts",         re: /\b(mount[s]?|saddle[s]?|riding|cavalry|moa[\s-]?upgrade|bear[\s-]?mount|horse[\s-]?cart)\b/i },
  // FOOD — much wider: spoilage, spoil, recipe, food-buff, composter, culinary, hunger, nutrition
  { tag: "food",           re: /\b(cooking[\s-]?bench|food[\s-]?(stack|spoil(age)?|buff|recipe|item|boost)?|spoil(age)?\b|hunger|nutrition|cook(ing|ed)|drink|honey|milk\b|coconut|composter|culinary|meal[s]?|edible)\b/i },
  // FARMING
  { tag: "farming",        re: /\b(farm(ing)?|crop[s]?\b|seed[s]?|plant(ing)?|garden|crop[\s-]?plot[s]?|bee[s\s-]|coconut|soy|cultivation[s]?|harvest)\b/i },
  // MINING
  { tag: "mining",         re: /\b(mining|ore[s]?|extract(or[s]?|ion)?|prospect|exotic|deep[\s-]?ore|smelting|furnace[s]?|drill[s]?\b)\b/i },
  // BUILDING — building/construct/wall/etc, plus "building pieces" specifically
  { tag: "building",       re: /\b(building[\s-]?piece[s]?|building|construct(ion|ed)?|deco|furniture|bench|wall[s]?|foundation[s]?|roof|door[s]?|deployable[s]?|build[\s-]?tool[s]?)\b/i },
  // WEATHER
  { tag: "weather",        re: /\b(weather|storm|temperature|cold|heat|rain|snow|tornado|blizzard|atmospheric)\b/i },
  // MULTIPLAYER
  { tag: "multiplayer",    re: /\b(multi[\s-]?player|coop|co[\s-]?op|dedicated[\s-]?server)\b/i },
  // BALANCE
  { tag: "balance",        re: /\b(balance[d]?|overhaul|rework|rebalance|tuning|tweak[s]?)\b/i },
  // VEHICLES
  { tag: "vehicles",       re: /\b(speeder|dropship|drop[\s-]?ship|truck|vehicle[s]?|chassis|rover|glider|hover[\s-]?craft|skiff|cart\b)\b/i },
  // STARTER
  { tag: "starter",        re: /\b(starter[\s-]?kit[s]?|starter[\s-]?pack|new[\s-]?game|new[\s-]?player|fresh[\s-]?start)\b/i },
  // PERFORMANCE — new tag for FPS / optimization mods
  { tag: "performance",    re: /\b(fps|performance|optimi[sz]ation|optimi[sz]er|lod|foliage[\s-]?reduction)\b/i },
  // COSMETIC — new tag for skins, eye colours, paint, etc.
  { tag: "cosmetic",       re: /\b(re[\s-]?skin|skin[\s-]?pack|skin[\s-]?kit|eye[\s-]?colou?r[s]?|paint[\s-]?job[s]?|cosmetic[s]?|texture[\s-]?pack|camo)\b/i }
];

function tagsFor(mod) {
  // Tag against the "primary purpose" zone — the mod name plus the first 120
  // characters of the description. This avoids tagging on incidental mentions
  // in v2.0 changelogs ('Added no-decay, reduced weight') deep in the description
  // when the mod's actual purpose is something else entirely.
  const name = mod.name || "";
  const description = (mod.description || "").slice(0, 120);
  const text = `${name} ${description}`;
  const out = new Set();
  for (const { tag, re } of RULES) if (re.test(text)) out.add(tag);
  // File-type tags
  for (const t of Object.keys(mod.files || {})) if (mod.files[t]) out.add(`type-${t}`);
  return [...out];
}

// Build tag index — curated mods first (so they win on dedupe), then Nexus.
const tagToMods = new Map();
const seenKeys = new Set();
function _key(m) { return `${slug(m.author)}--${slug(m.name)}`; }
for (const m of mods) {
  seenKeys.add(_key(m));
  const tags = tagsFor(m);
  for (const t of tags) {
    const arr = tagToMods.get(t) || [];
    arr.push({ ...m, _source: "curated" });
    tagToMods.set(t, arr);
  }
}
for (const m of nexusMods) {
  if (seenKeys.has(_key(m))) continue; // curated already covered it
  const tags = tagsFor(m);
  for (const t of tags) {
    const arr = tagToMods.get(t) || [];
    arr.push({ ...m, _source: "nexus" });
    tagToMods.set(t, arr);
  }
}

const sortedTags = [...tagToMods.entries()]
  .sort((a, b) => b[1].length - a[1].length); // most-used first

module.exports = sortedTags.map(([tag, list]) => ({
  tag,
  slug: slug(tag),
  count: list.length,
  mods: list.sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(m => ({
    name: m.name,
    description: m.description,
    version: m.version,
    compatibility: m.compatibility,
    author: m.author,
    source: m._source || "curated",
    mod_page_url: m.mod_page_url || (m.nexus_id ? `https://www.nexusmods.com/icarus/mods/${m.nexus_id}` : null),
    // Only use the id-derived split if id actually has the "--" form.
    // Nexus mods have numeric ids like "138" with no "--", so falling through
    // to slug(author)+slug(name) is correct for them.
    author_slug: (m.id && m.id.includes("--")) ? m.id.split("--")[0] : slug(m.author),
    slug: (m.id && m.id.includes("--")) ? m.id.split("--")[1] : slug(m.name),
    file_types: Object.keys(m.files || {}).filter(k => m.files[k])
  }))
}));
