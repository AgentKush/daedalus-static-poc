const mods = require("../../public/data/mods.json");

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Tag rules: keyword → tag. Order doesn't matter (a mod can match multiple).
// Each rule is { tag, pattern (RegExp source) }. Matched against `${name} ${description}`.
const RULES = [
  // SPEED — only obviously-speed phrasing. Dropping the bare `x\d+` pattern
  // because that catches stack-size mods like "x100" / "x500" which aren't speed.
  { tag: "speed",          re: /\b(faster|increased[\s-]+speed|production[\s-]+speed|extraction[\s-]+speed|taming[\s-]+speed|smelting[\s-]+speed|crafting[\s-]+speed|processing[\s-]+speed|harvest[\s-]+speed|speed[\s-]+up|x\d+[\s-]*(faster|speed|quicker))\b/i },
  // NO-DECAY — explicit "no decay" / "prevent decay" wording
  { tag: "no-decay",       re: /\b(no[\s-]*decay|prevents?[\s-]+decay|stop(s)?[\s-]+decay|reduces?[\s-]+decay)\b/i },
  // INDESTRUCTIBLE
  { tag: "indestructible", re: /\b(indestructible|unbreakable|infinite[\s-]?dur(ability)?|max(?:imum)?[\s-]?durability)\b/i },
  // TALENTS — talent tree / talents
  { tag: "talents",        re: /\btalent(s|[\s-]?tree)?\b/i },
  // WORKSHOP
  { tag: "workshop",       re: /\bworkshop\b/i },
  // QOL
  { tag: "qol",            re: /\b(qol|quality[\s-]of[\s-]life)\b/i },
  // STACK — must say stack/stacks/stackable, not just "x100"
  { tag: "stack",          re: /\b(stack[s]?\b|stack[\s-]?size|stackable|stack[\s-]?of)\b/i },
  // WEIGHT — weight-of-items / carry / encumbrance / backpack
  { tag: "weight",         re: /\b(carry[\s-]?weight|reduce(d|s)?[\s-]?weight|encumb(er|rance)|backpack[s]?|hercules)\b/i },
  // AMMO
  { tag: "ammo",           re: /\b(ammo|ammunition)\b/i },
  // WEAPONS — specific weapon types only, no bare "axe" (overlaps with pickaxe)
  { tag: "weapons",        re: /\b(crossbow|compound[\s-]?bow|recurve[\s-]?bow|long[\s-]?bow|pistol|rifle|shotgun|sniper|sword|spear|javelin|grenade|hk[\s-]?417|sks|firearm)\b/i },
  // TOOLS — specific tool nouns rather than the bare word "tool"
  { tag: "tools",          re: /\b(pickaxe|sledgehammer|sickle|woodaxe|extractor|fishing[\s-]?rod|build[\s-]?tool|map[\s-]?tool|build[\s-]?tools)\b/i },
  // ARMOR — armor sets / attachments / suits, not bare "armor" (overlaps with weapons reskins)
  { tag: "armor",          re: /\b(armou?r[\s-]?set|armou?r[\s-]?attachment|armou?r[\s-]?expansion|envir(?:o|on(?:mental)?)[\s-]?suit)\b/i },
  // CREATURES — animals only. Dropped "dropship" (that's a vehicle, not a creature).
  { tag: "creatures",      re: /\b(creature[s]?|wolf|bear[\s-]?(?:cub|mount|pet)?|moose|deer|chicken|cow[s]?\b|fishing|fishery|fishable|wildlife|spawn[\s-]?zone|spawn[\s-]?rate|tame|taming|wolf[\s-]?pack|honey[\s-]?bee|raccoon|rabbit)\b/i },
  // MOUNTS
  { tag: "mounts",         re: /\b(mount[s]?|saddle|riding|cavalry|moa[\s-]?upgrade|bear[\s-]?mount|horse[\s-]?cart)\b/i },
  // FOOD
  { tag: "food",           re: /\b(cooking[\s-]?bench|food[\s-]?stack|food[\s-]?spoil|hunger|nutrition|cook(?:ing|ed)|drink|honey|milk\b|coconut)\b/i },
  // FARMING
  { tag: "farming",        re: /\b(farm(?:ing)?|crop[s]?\b|seed[s]?|plant(?:ing)?|garden|crop[\s-]?plot|bee[s\s-]|coconut|soy)\b/i },
  // MINING
  { tag: "mining",         re: /\b(mining|ore[s]?|extract(?:or|ion)?|prospect|exotic|deep[\s-]?ore|smelting|furnace[s]?)\b/i },
  // BUILDING
  { tag: "building",       re: /\b(building|construct(?:ion|ed)?|deco|furniture|bench|wall[s]?|foundation|roof|door[s]?|deployable)\b/i },
  // WEATHER
  { tag: "weather",        re: /\b(weather|storm|temperature|cold|heat|rain|snow|tornado|blizzard|atmospheric)\b/i },
  // MULTIPLAYER
  { tag: "multiplayer",    re: /\b(multi[\s-]?player|coop|co[\s-]?op|dedicated[\s-]?server)\b/i },
  // BALANCE
  { tag: "balance",        re: /\b(balance[d]?|overhaul|rework|rebalance|tuning|tweak[s]?)\b/i },
  // VEHICLES — new tag. Includes dropship.
  { tag: "vehicles",       re: /\b(speeder|dropship|drop[\s-]?ship|truck|vehicle|chassis|rover|glider|hover[\s-]?craft|skiff|cart\b)\b/i },
  // STARTER
  { tag: "starter",        re: /\b(starter[\s-]?kit|starter[\s-]?pack|new[\s-]?game|new[\s-]?player|fresh[\s-]?start)\b/i }
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

// Build tag index
const tagToMods = new Map();
for (const m of mods) {
  const tags = tagsFor(m);
  for (const t of tags) {
    const arr = tagToMods.get(t) || [];
    arr.push(m);
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
    author_slug: m.id?.split("--")[0] || slug(m.author),
    slug: m.id?.split("--")[1] || slug(m.name),
    file_types: Object.keys(m.files || {}).filter(k => m.files[k])
  }))
}));
