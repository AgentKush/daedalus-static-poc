// Daedalus static POC — client-side mods list.
//
// Currently fetches from a bundled JSON file. To swap in real data:
//   1. In Donovan's Firebase project, allow public reads on the `mods`
//      collection in Firestore Security Rules (mods are already public data).
//   2. Replace `loadMods()` below with the Firebase Web SDK call shown in
//      the commented-out block.
//   3. Drop in his Firebase project config (apiKey/projectId/etc — these
//      are public-safe by design; security comes from the rules).

async function loadMods() {
  // --- MOCK DATA PATH (current) ---
  const res = await fetch("./data/mods.json");
  if (!res.ok) throw new Error(`failed to load mods: ${res.status}`);
  return await res.json();

  // --- REAL FIRESTORE PATH (uncomment when ready) ---
  // import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
  // import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
  //
  // const app = initializeApp({
  //   apiKey: "...",
  //   authDomain: "project-daedalus.firebaseapp.com",
  //   projectId: "project-daedalus",
  // });
  // const db = getFirestore(app);
  //
  // const [modsSnap, nexusSnap] = await Promise.all([
  //   getDocs(collection(db, "mods")),
  //   getDocs(collection(db, "nexus_mods"))
  // ]);
  // const curated = modsSnap.docs.map(d => ({ id: d.id, source: "curated", ...d.data() }));
  // const nexus = nexusSnap.docs.map(d => ({ id: d.id, source: "nexus", ...d.data() }));
  // // Dedup curated wins, like the Rails ModsController#combined_mods does.
  // const seen = new Set(curated.map(m => `${(m.name||"").toLowerCase()}::${slug(m.author||"unknown")}`));
  // const merged = [...curated, ...nexus.filter(m => !seen.has(`${(m.name||"").toLowerCase()}::${slug(m.author||"unknown")}`))];
  // return merged.sort((a, b) => (a.name||"").localeCompare(b.name||""));
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

function renderRow(mod) {
  const isNexus = mod.source === "nexus";
  const action = isNexus
    ? `<a href="${escape(mod.mod_page_url)}" target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-white rounded-md shadow-sm bg-icarus-500 hover:bg-icarus-600">
          <span class="hidden sm:inline">View on </span>Nexus &nearr;
        </a>`
    : (() => {
        const type = preferredType(mod);
        if (!type) return `<span class="text-xs text-slate-500">&mdash;</span>`;
        return `<a href="${escape(mod.files[type])}"
                  class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-white rounded-md shadow-sm bg-icarus-500 hover:bg-icarus-600">
                  <span class="hidden sm:inline">Download </span>${type.toUpperCase()}
                </a>`;
      })();

  const compat = mod.compatibility
    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-icarus-500/20 text-icarus-500">${escape(mod.compatibility.toLowerCase())}</span>`
    : `<span class="text-xs text-slate-500">&mdash;</span>`;

  const badge = isNexus ? `<span class="source-badge" title="Synced from Nexus Mods">NEXUS</span>` : "";
  const desc = (mod.description || "").length > 120 ? mod.description.slice(0, 120) + "…" : (mod.description || "");

  return `
    <tr class="row-lift border-t border-slate-700">
      <td class="p-2 sm:p-3 font-medium text-slate-200">${escape(mod.name)}${badge}</td>
      <td class="p-2 sm:p-3 whitespace-nowrap">${action}</td>
      <td class="hidden p-3 text-sm sm:table-cell text-slate-400">${escape(mod.author || "unknown")}</td>
      <td class="hidden p-3 text-sm text-right md:table-cell text-slate-400">${escape(mod.version || "")}</td>
      <td class="hidden p-3 text-sm text-center xl:table-cell">${compat}</td>
      <td class="hidden p-3 text-sm xl:table-cell text-slate-400 max-w-md truncate" title="${escape(mod.description || "")}">${escape(desc)}</td>
    </tr>`;
}

function renderEmpty() {
  return `<tr><td colspan="6" class="p-6 text-center text-icarus-500">No mods match your filters</td></tr>`;
}

const state = { all: [], filtered: [] };

function applyFilters() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const author = document.getElementById("author-filter").value;
  const source = document.getElementById("source-filter").value;

  state.filtered = state.all.filter(mod => {
    if (source && mod.source !== source) return false;
    if (author && slug(mod.author) !== author) return false;
    if (q) {
      const hay = `${mod.name||""} ${mod.author||""} ${mod.description||""} ${mod.compatibility||""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const rows = document.getElementById("rows");
  rows.innerHTML = state.filtered.length ? state.filtered.map(renderRow).join("") : renderEmpty();
  document.getElementById("count").textContent = `${state.filtered.length} mod${state.filtered.length === 1 ? "" : "s"}`;
}

function populateAuthorFilter(mods) {
  const sel = document.getElementById("author-filter");
  const authors = [...new Set(mods.map(m => m.author).filter(Boolean))].sort();
  for (const a of authors) {
    const opt = document.createElement("option");
    opt.value = slug(a);
    opt.textContent = a;
    sel.appendChild(opt);
  }
}

(async () => {
  const status = document.getElementById("status");
  try {
    state.all = await loadMods();
    populateAuthorFilter(state.all);
    applyFilters();
  } catch (err) {
    status.classList.remove("hidden");
    status.textContent = `Failed to load mods: ${err.message}`;
    console.error(err);
  }
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

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
