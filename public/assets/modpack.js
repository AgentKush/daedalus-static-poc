// Multi-select mods on the listing → export a pack manifest + Discord-ready text.
//
// Activation: a "Build pack" toggle in the listing toolbar enters selection mode.
// While active:
//   - Each row gets a prominent checkbox
//   - The row's normal navigation is suppressed; clicking anywhere on the row
//     toggles the checkbox
//   - A floating bar at the bottom shows the count and Export / Clear / Close
const STATE = { active: false, selected: new Set(), modsById: new Map() };

function ensureUI() {
  let bar = document.getElementById("modpack-bar");
  if (bar) return bar;
  bar = document.createElement("div");
  bar.id = "modpack-bar";
  bar.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#0f172a;border:1px solid #f1ad1c;border-radius:0.75rem;padding:0.6rem 1rem;color:#e2e8f0;z-index:9990;font-family:Inter,system-ui,sans-serif;font-size:0.875rem;display:none;align-items:center;gap:0.75rem;box-shadow:0 12px 24px rgba(0,0,0,.4);";
  bar.innerHTML = `
    <span id="modpack-count" style="font-weight:600;color:#f1ad1c;">0 selected</span>
    <button type="button" id="modpack-clear" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid #334155;border-radius:0.375rem;color:#94a3b8;cursor:pointer;font-size:0.75rem;">Clear</button>
    <button type="button" id="modpack-export" style="padding:0.4rem 0.9rem;background:#f1ad1c;border:none;border-radius:0.375rem;color:#0f172a;font-weight:600;cursor:pointer;font-size:0.875rem;">Export</button>
    <button type="button" id="modpack-close" title="Exit selection mode" style="padding:0;width:1.5rem;height:1.5rem;background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:1.25rem;line-height:1;">×</button>
  `;
  document.body.appendChild(bar);
  document.getElementById("modpack-close").addEventListener("click", deactivate);
  document.getElementById("modpack-clear").addEventListener("click", () => { STATE.selected.clear(); render(); });
  document.getElementById("modpack-export").addEventListener("click", exportPack);
  return bar;
}

function ensureBanner() {
  let b = document.getElementById("modpack-banner");
  if (b) return b;
  b = document.createElement("div");
  b.id = "modpack-banner";
  b.style.cssText = "background:rgba(241,173,28,.12);border:1px solid #f1ad1c;color:#f1ad1c;padding:0.6rem 1rem;border-radius:0.5rem;font-size:0.875rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;";
  b.innerHTML = `📦 <strong>Pack-build mode</strong> &mdash; click any row to add it to your pack. The Export button at the bottom builds a manifest you can share.`;
  return b;
}

function activate(allMods) {
  STATE.active = true;
  STATE.selected.clear();
  STATE.modsById.clear();
  for (const m of allMods) STATE.modsById.set(m.id || `${slug(m.author)}--${slug(m.name)}`, m);
  ensureUI().style.display = "flex";
  // Show banner above the rows
  const rowsTable = document.getElementById("rows")?.closest("table");
  const anchor = rowsTable || document.getElementById("rows");
  if (anchor && !document.getElementById("modpack-banner")) {
    anchor.parentElement?.insertBefore(ensureBanner(), anchor);
  }
  document.body.classList.add("modpack-active");
  render();
}

function deactivate() {
  STATE.active = false;
  STATE.selected.clear();
  const bar = document.getElementById("modpack-bar"); if (bar) bar.style.display = "none";
  const banner = document.getElementById("modpack-banner"); if (banner) banner.remove();
  document.body.classList.remove("modpack-active");
  // Restore rows: remove checkboxes, restore onclick attribute
  document.querySelectorAll("tr[data-modpack-row]").forEach(tr => {
    const orig = tr.dataset.modpackOriginalOnclick;
    if (orig) tr.setAttribute("onclick", orig); else tr.removeAttribute("onclick");
    tr.removeAttribute("data-modpack-row");
    tr.removeAttribute("data-modpack-original-onclick");
    tr.querySelectorAll("[data-modpack-checkbox]").forEach(el => el.remove());
    tr.style.cursor = "";
    tr.style.background = "";
  });
}

function slug(s) { return (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function toggleRow(modId) {
  if (STATE.selected.has(modId)) STATE.selected.delete(modId); else STATE.selected.add(modId);
  render();
}

function render() {
  if (!STATE.active) return;
  const count = STATE.selected.size;
  const c = document.getElementById("modpack-count"); if (c) c.textContent = `${count} selected`;
  document.querySelectorAll("#rows tr").forEach((tr, i) => {
    let modId = tr.dataset.modpackRow;
    if (!modId) {
      const click = tr.getAttribute("onclick") || "";
      const m = click.match(/mods\/([^/']+)\/([^/']+)\//);
      if (!m) return; // skip rows that don't link to a curated mod (e.g. Nexus)
      modId = `${m[1]}--${m[2]}`;
      tr.dataset.modpackRow = modId;
      tr.dataset.modpackOriginalOnclick = click;
      // Suppress original navigation while in pack mode
      tr.setAttribute("onclick", `window.daedalusModpack && window.daedalusModpack.handleRowClick('${modId}')`);
      tr.style.cursor = "pointer";
      // Insert prominent checkbox in the first cell
      const firstTd = tr.querySelector("td");
      if (firstTd && !firstTd.querySelector("[data-modpack-checkbox]")) {
        const wrap = document.createElement("span");
        wrap.dataset.modpackCheckbox = "true";
        wrap.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:0.25rem;border:2px solid #475569;background:transparent;margin-right:0.5rem;vertical-align:middle;flex-shrink:0;";
        wrap.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:0.875rem;height:0.875rem;display:none;"><polyline points="3 8.5 6.5 12 13 4"/></svg>`;
        firstTd.prepend(wrap);
      }
    }
    // Sync visual state with STATE.selected
    const wrap = tr.querySelector("[data-modpack-checkbox]");
    if (wrap) {
      const checked = STATE.selected.has(modId);
      wrap.style.background = checked ? "#f1ad1c" : "transparent";
      wrap.style.borderColor = checked ? "#f1ad1c" : "#475569";
      const tick = wrap.querySelector("svg");
      if (tick) tick.style.display = checked ? "block" : "none";
      tr.style.background = checked ? "rgba(241,173,28,0.08)" : "";
    }
  });
}

let _jszipPromise = null;
function loadJSZip() {
  if (_jszipPromise) return _jszipPromise;
  _jszipPromise = new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    tag.onload = () => resolve(window.JSZip);
    tag.onerror = () => reject(new Error("Failed to load JSZip from CDN"));
    document.head.appendChild(tag);
  });
  return _jszipPromise;
}

function pickPrimaryUrl(files) {
  // Prefer exmodz, then pak, then anything else
  if (!files) return null;
  const order = ["exmodz", "exmod", "pak", "zip"];
  for (const k of order) if (files[k]) return { url: files[k], type: k };
  for (const [k, v] of Object.entries(files)) if (v) return { url: v, type: k };
  return null;
}

async function exportPack() {
  if (STATE.selected.size === 0) {
    flash("Select at least one mod first by clicking its row.");
    return;
  }
  const items = [...STATE.selected].map(id => STATE.modsById.get(id)).filter(Boolean);
  const exportBtn = document.getElementById("modpack-export");
  const status = document.getElementById("modpack-count");
  if (exportBtn) exportBtn.disabled = true;
  const restoreBtn = () => { if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = "Export"; } };

  try {
    if (exportBtn) exportBtn.textContent = "Loading…";
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const skipped = [];
    let done = 0;
    for (const m of items) {
      const primary = pickPrimaryUrl(m.files);
      done++;
      if (status) status.textContent = `Fetching ${done}/${items.length}: ${m.name}`;
      if (!primary) { skipped.push({ name: m.name, reason: "no download URL" }); continue; }
      try {
        const r = await fetch(primary.url);
        if (!r.ok) { skipped.push({ name: m.name, reason: `HTTP ${r.status}` }); continue; }
        const blob = await r.blob();
        const filename = primary.url.split("/").pop().split("?")[0];
        const folder = (m.author || "unknown").replace(/[\\/:*?"<>|]/g, "_");
        zip.file(`${folder}/${filename}`, blob);
      } catch (e) {
        skipped.push({ name: m.name, reason: (e.message || "fetch failed (CORS or offline?)") });
      }
    }
    if (skipped.length) {
      zip.file("SKIPPED.txt",
        "These mods couldn't be bundled into the zip and need to be downloaded manually:\n\n" +
        skipped.map(s => `- ${s.name}: ${s.reason}`).join("\n"));
    }
    if (status) status.textContent = "Compressing…";
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const sizeMb = (blob.size / 1024 / 1024).toFixed(1);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daedalus-modpack-${items.length}mods.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (status) {
      const tail = skipped.length ? ` · ${skipped.length} skipped (see SKIPPED.txt)` : "";
      status.textContent = `Downloaded ${sizeMb} MB${tail}`;
      setTimeout(() => { if (status) status.textContent = `${STATE.selected.size} selected`; }, 5000);
    }
    restoreBtn();
  } catch (e) {
    if (status) {
      status.textContent = `Error: ${e.message}`;
      setTimeout(() => { if (status) status.textContent = `${STATE.selected.size} selected`; }, 4000);
    }
    restoreBtn();
  }
}

function flash(msg) {
  const bar = document.getElementById("modpack-bar");
  if (!bar) { alert(msg); return; }
  const orig = document.getElementById("modpack-count").textContent;
  document.getElementById("modpack-count").textContent = msg;
  document.getElementById("modpack-count").style.color = "#fbbf24";
  setTimeout(() => {
    document.getElementById("modpack-count").textContent = `${STATE.selected.size} selected`;
    document.getElementById("modpack-count").style.color = "#f1ad1c";
  }, 2200);
}

function escape(s){return (s||"").replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}

window.daedalusModpack = {
  toggle(allMods) { STATE.active ? deactivate() : activate(allMods); },
  isActive() { return STATE.active; },
  redraw: render,
  handleRowClick(modId) { toggleRow(modId); }
};
