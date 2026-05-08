const mods = require("../../public/data/mods.json");

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Tag rules: keyword → tag. Order doesn't matter (a mod can match multiple).
// Each rule is { tag, pattern (RegExp source) }. Matched against `${name} ${description}`.
const RULES = [
  { tag: "speed",          re: /\b(speed|fast(er)?|quick|swift|rapid|x\d+(\.\d+)?\b)/i },
  { tag: "no-decay",       re: /\bno[-\s]*decay\b/i },
  { tag: "indestructible", re: /\b(indestructible|unbreakable|infinite[-\s]?dur(ability)?)\b/i },
  { tag: "talents",        re: /\btalent(s|\s?tree)?\b/i },
  { tag: "workshop",       re: /\bworkshop\b/i },
  { tag: "qol",            re: /\b(qol|quality[-\s]of[-\s]life)\b/i },
  { tag: "stack",          re: /\bstack(s|\s?size)?\b/i },
  { tag: "weight",         re: /\b(weight|carry|encumber|encumbrance)\b/i },
  { tag: "ammo",           re: /\bammo\b/i },
  { tag: "weapons",        re: /\b(weapon|crossbow|bow|rifle|sword|axe|spear|javelin|knife)\b/i },
  { tag: "tools",          re: /\b(pickaxe|hammer|sickle|tool)\b/i },
  { tag: "armor",          re: /\b(armor|armour)\b/i },
  { tag: "creatures",      re: /\b(creature|wolf|bear|moose|deer|chicken|cow|fish|dropship|wildlife)\b/i },
  { tag: "mounts",         re: /\b(mount|saddle|riding)\b/i },
  { tag: "food",           re: /\b(food|cook|recipe|hunger|nutrition)\b/i },
  { tag: "farming",        re: /\b(farm|crop|seed|plant|garden|bee|honey)\b/i },
  { tag: "mining",         re: /\b(mining|ore|extract|prospect|exotic|deepore)\b/i },
  { tag: "building",       re: /\b(build|construct|deco|furniture|piece|bench)\b/i },
  { tag: "weather",        re: /\b(weather|storm|temperature|cold|heat)\b/i },
  { tag: "multiplayer",    re: /\b(multi[-\s]?player|coop|server|dedicated)\b/i },
  { tag: "balance",        re: /\b(balance|overhaul|rework|tuning)\b/i },
  { tag: "expansion",      re: /\b(expand|expansion|extend|bigger|larger|increase)\b/i },
  { tag: "vehicles",       re: /\b(speeder|truck|vehicle|chassis|nuclear[-\s]?reactor|rover)\b/i },
  { tag: "starter",        re: /\b(starter|starter[-\s]?kit|begin|new[-\s]?game|spawn)\b/i }
];

function tagsFor(mod) {
  const text = `${mod.name || ""} ${mod.description || ""}`;
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
