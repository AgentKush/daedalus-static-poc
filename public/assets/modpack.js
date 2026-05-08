// Multi-select mods on the listing → export a pack manifest + Discord-ready text.
//
// Activation: a "Build mod pack" button in the listing toolbar toggles
// selection mode. While active, each row gets a checkbox; the toolbar shows
// a counter and an "Export" button.

const STATE = { active: false, selected: new Set(), modsById: new Map() };

function ensureUI() {
  const existing = document.getElementById("modpack-bar");
  if (existing) return existing;
  const bar = document.createElement("div");
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

function activate(allMods) {
  STATE.active = true;
  STATE.selected.clear();
  STATE.modsById.clear();
  for (const m of allMods) STATE.modsById.set(m.id || `${slug(m.author)}--${slug(m.name)}`, m);
  ensureUI().style.display = "flex";
  render();
}
function deactivate() {
  STATE.active = false;
  STATE.selected.clear();
  const bar = document.getElementById("modpack-bar"); if (bar) bar.style.display = "none";
  // Strip checkboxes off rows
  document.querySelectorAll("[data-modpack-checkbox]").forEach(el => el.remove());
  document.querySelectorAll("tr[data-modpack-row]").forEach(tr => tr.removeAttribute("data-modpack-row"));
}
function slug(s) { return (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function render() {
  const count = STATE.selected.size;
  const c = document.getElementById("modpack-count"); if (c) c.textContent = `${count} selected`;
  // Decorate rows currently in DOM
  document.querySelectorAll("#rows tr").forEach((tr, i) => {
    if (tr.dataset.modpackRow) return;
    // Determine which mod this row is for via the onclick href
    const click = tr.getAttribute("onclick") || "";
    const m = click.match(/mods\/([^/']+)\/([^/']+)\//);
    if (!m) return;
    const modId = `${m[1]}--${m[2]}`;
    tr.dataset.modpackRow = modId;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.modpackCheckbox = "true";
    cb.style.cssText = "margin-right:0.5rem;accent-color:#f1ad1c;cursor:pointer;";
    cb.checked = STATE.selected.has(modId);
    cb.addEventListener("click", e => {
      e.stopPropagation();
      if (cb.checked) STATE.selected.add(modId); else STATE.selected.delete(modId);
      render();
    });
    const firstTd = tr.querySelector("td");
    if (firstTd) firstTd.prepend(cb);
  });
}

function exportPack() {
  if (STATE.selected.size === 0) { alert("Select at least one mod first."); return; }
  const items = [...STATE.selected].map(id => STATE.modsById.get(id)).filter(Boolean).map(m => ({
    id: m.id, name: m.name, author: m.author, version: m.version,
    compatibility: m.compatibility, files: m.files,
    detail_url: `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}/mods/${slug(m.author)}/${slug(m.name)}/`,
    description: m.description
  }));
  const manifest = {
    name: "My Project Daedalus mod pack",
    generated_at: new Date().toISOString(),
    site: "https://projectdaedalus.app",
    count: items.length,
    mods: items
  };
  const json = JSON.stringify(manifest, null, 2);
  const discord = items.map(m => `• **${m.name}** by ${m.author || "unknown"} — ${m.detail_url}`).join("\n");

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;";
  overlay.innerHTML = `
    <div style="background:#0f172a;border:1px solid #334155;border-radius:0.75rem;padding:1.5rem;max-width:48rem;width:100%;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;max-height:90vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1rem;">
        <div>
          <h3 style="color:#f1ad1c;font-weight:700;font-size:1.125rem;margin:0;">Mod pack export</h3>
          <p style="margin:0.25rem 0 0 0;color:#94a3b8;font-size:0.875rem;">${items.length} mod${items.length===1?"":"s"} selected</p>
        </div>
        <button id="mp-x" style="background:transparent;border:none;color:#94a3b8;font-size:1.5rem;line-height:1;cursor:pointer;padding:0;">×</button>
      </div>

      <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
        <button id="mp-dl" style="padding:0.5rem 1rem;background:#f1ad1c;color:#0f172a;border:none;border-radius:0.375rem;font-weight:600;cursor:pointer;">⬇ Download manifest.json</button>
        <button id="mp-discord" style="padding:0.5rem 1rem;background:#5865f2;color:white;border:none;border-radius:0.375rem;font-weight:600;cursor:pointer;">📋 Copy Discord-formatted</button>
      </div>

      <div style="overflow:auto;flex:1;">
        <h4 style="margin:0 0 0.5rem 0;font-size:0.75rem;text-transform:uppercase;color:#94a3b8;">JSON manifest</h4>
        <pre style="background:#1e293b;padding:0.75rem;border-radius:0.375rem;font-size:0.75rem;overflow:auto;color:#cbd5e1;">${escape(json)}</pre>
      </div>
    </div>
  `;
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById("mp-x").addEventListener("click", () => overlay.remove());
  document.getElementById("mp-dl").addEventListener("click", () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "modpack.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById("mp-discord").addEventListener("click", () => {
    navigator.clipboard.writeText(discord).then(() => {
      document.getElementById("mp-discord").textContent = "✓ Copied!";
    }).catch(()=>{});
  });
}

function escape(s){return (s||"").replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}

// Public: hook for the listing
window.daedalusModpack = {
  toggle(allMods) { STATE.active ? deactivate() : activate(allMods); },
  isActive() { return STATE.active; },
  redraw: render
};
