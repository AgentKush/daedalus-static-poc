async function loadMods() {
  const res = await fetch("./data/mods.json");
  return res.ok ? await res.json() : [];
}

function slug(s) { return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function escape(s) { return (s || "").toString().replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function preferredType(mod) {
  const f = mod.files || {};
  if (f.pak) return "pak";
  if (f.zip) return "zip";
  if (f.exmodz) return "exmodz";
  if (f.exmod) return "exmod";
  return null;
}
function isNexus(mod) { return mod.source === "nexus" || (!mod.files && mod.mod_page_url); }

const DETAIL_PAGES = new Set(["agentkush--absolute-chaos-core","agentkush--agents-individual-item-kits","jimk72--bear-mount","waldo--a-wzg-balance-overhaul","cryorus--cry-s-lvl-120-cap-100"]);

function detailHref(mod) {
  if (isNexus(mod)) return mod.mod_page_url;
  if (DETAIL_PAGES.has(mod.id)) {
    const a = slug(mod.author), s = slug(mod.name);
    return `./mods/${a}/${s}/`;
  }
  return null;
}

function renderRow(mod) {
  const nx = isNexus(mod);
  const href = detailHref(mod);
  const action = nx
    ? `<a href="${escape(mod.mod_page_url)}" target="_blank" rel="noopener noreferrer"
          onclick="event.stopPropagation()"
          class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-white rounded-md shadow-sm bg-icarus-500 hover:bg-icarus-600">
          <span class="hidden sm:inline">View on </span>Nexus &nearr;
        </a>`
    : (() => {
        const type = preferredType(mod);
        if (!type) return `<span class="text-xs text-slate-500">&mdash;</span>`;
        return `<a href="${escape(mod.files[type])}" download
                  onclick="event.stopPropagation()"
                  class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-white rounded-md shadow-sm bg-icarus-500 hover:bg-icarus-600">
                  <span class="hidden sm:inline">Download </span>${type.toUpperCase()}
                </a>`;
      })();

  const compat = mod.compatibility
    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-icarus-500/20 text-icarus-500">${escape(mod.compatibility.toLowerCase())}</span>`
    : `<span class="text-xs text-slate-500">&mdash;</span>`;

  const badge = nx ? `<span class="source-badge" title="Synced from Nexus Mods">NEXUS</span>` : "";
  const desc = (mod.description || "").length > 120 ? mod.description.slice(0, 120) + "…" : (mod.description || "");
  const cls = (href ? "cursor-pointer " : "") + "row-lift border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70";
  const onclick = href ? ` onclick="window.location.href='${href}'${nx ? ',event.preventDefault()' : ''}"` : "";

  return `<tr class="${cls}"${onclick}>
    <td class="p-2 sm:p-3 font-medium text-slate-800 dark:text-slate-200">${escape(mod.name)}${badge}</td>
    <td class="p-2 sm:p-3 whitespace-nowrap">${action}</td>
    <td class="hidden p-3 text-sm sm:table-cell text-slate-600 dark:text-slate-400">${escape(mod.author || "unknown")}</td>
    <td class="hidden p-3 text-sm text-right md:table-cell text-slate-600 dark:text-slate-400">${escape(mod.version || "")}</td>
    <td class="hidden p-3 text-sm text-center xl:table-cell">${compat}</td>
    <td class="hidden p-3 text-sm xl:table-cell text-slate-600 dark:text-slate-400 max-w-md truncate" title="${escape(mod.description || "")}">${escape(desc)}</td>
  </tr>`;
}

const state = { all: [], filtered: [] };

function applyFilters() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const author = document.getElementById("author-filter").value;
  const source = document.getElementById("source-filter").value;
  state.filtered = state.all.filter(mod => {
    const isNx = isNexus(mod);
    if (source === "nexus" && !isNx) return false;
    if (source === "curated" && isNx) return false;
    if (author && slug(mod.author) !== author) return false;
    if (q) {
      const hay = `${mod.name||""} ${mod.author||""} ${mod.description||""} ${mod.compatibility||""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  document.getElementById("rows").innerHTML = state.filtered.length
    ? state.filtered.map(renderRow).join("")
    : `<tr><td colspan="6" class="p-6 text-center text-icarus-500">No mods match your filters</td></tr>`;
  document.getElementById("count").textContent = `${state.filtered.length} mod${state.filtered.length === 1 ? "" : "s"}`;
}

function populateAuthorFilter(mods) {
  const sel = document.getElementById("author-filter");
  const authors = [...new Set(mods.map(m => m.author).filter(Boolean))].sort();
  for (const a of authors) {
    const opt = document.createElement("option");
    opt.value = slug(a); opt.textContent = a;
    sel.appendChild(opt);
  }
}

(async () => {
  state.all = await loadMods();
  populateAuthorFilter(state.all);
  applyFilters();
})();

document.getElementById("search").addEventListener("input", debounce(applyFilters, 200));
document.getElementById("author-filter").addEventListener("change", applyFilters);
document.getElementById("source-filter").addEventListener("change", applyFilters);
document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("search").value = "";
  document.getElementById("author-filter").value = "";
  document.getElementById("source-filter").value = "";
  applyFilters();
});
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
