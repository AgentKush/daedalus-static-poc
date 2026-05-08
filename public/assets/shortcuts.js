// Global keyboard shortcuts. Inspired by GitHub's bindings.
//   /         focus the search box (or open /search/ if not on listing)
//   Esc       blur active input / close modal
//   g h       go home
//   g m       go to mods listing
//   g s       go to search
//   g a       go to API
//   g i       go to info
//   g r       go to mod requests
//   .         random mod
//   ?         toggle the cheat-sheet modal
const ORIGIN = window.location.origin;
const REL = (path) => {
  // Determine root path from current document depth
  const d = window.location.pathname.replace(/\/$/, "").split("/").length - 1;
  return "../".repeat(Math.max(0, d - 1)) + path;
};

let waitingForG = false;
let gTimer = null;

function isTypingTarget(t) {
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

function go(path) { window.location.href = path; }

function pickRandomMod() {
  fetch(REL("data/mods.json"))
    .then(r => r.ok ? r.json() : null)
    .then(mods => {
      if (!mods || !mods.length) return;
      const m = mods[Math.floor(Math.random() * mods.length)];
      const slug = (s) => (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      window.location.href = REL(`mods/${slug(m.author)}/${slug(m.name)}/`);
    })
    .catch(() => {});
}

function showHelp() {
  if (document.getElementById("kb-cheatsheet")) {
    document.getElementById("kb-cheatsheet").remove();
    return;
  }
  const overlay = document.createElement("div");
  overlay.id = "kb-cheatsheet";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:9998;display:flex;align-items:center;justify-content:center;padding:1rem;";
  overlay.innerHTML = `
    <div style="background:#0f172a;border:1px solid #334155;border-radius:0.75rem;padding:1.5rem 2rem;max-width:32rem;width:100%;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;">
      <h3 style="color:#f1ad1c;font-weight:700;font-size:1.125rem;margin:0 0 1rem 0;">Keyboard shortcuts</h3>
      <div style="display:grid;grid-template-columns:1fr auto;gap:.5rem 1.5rem;font-size:.875rem;">
        <span>Focus search</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">/</kbd>
        <span>Cheat sheet</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">?</kbd>
        <span>Random mod</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">.</kbd>
        <span>Go home</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">g h</kbd>
        <span>Go to mods</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">g m</kbd>
        <span>Go to search</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">g s</kbd>
        <span>Go to tools</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">g t</kbd>
        <span>Go to info</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">g i</kbd>
        <span>Go to requests</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">g r</kbd>
        <span>Go to API docs</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">g a</kbd>
        <span>Close / blur</span><kbd style="font-family:monospace;background:#1e293b;padding:.1rem .4rem;border-radius:.25rem;">Esc</kbd>
      </div>
      <p style="margin-top:1rem;font-size:.75rem;color:#94a3b8;">Click anywhere outside this box to close.</p>
    </div>
  `;
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

document.addEventListener("keydown", (e) => {
  // Esc always works
  if (e.key === "Escape") {
    const cs = document.getElementById("kb-cheatsheet"); if (cs) { cs.remove(); return; }
    if (document.activeElement && isTypingTarget(document.activeElement)) document.activeElement.blur();
    return;
  }
  if (isTypingTarget(e.target)) return;

  // Single-key bindings
  if (!waitingForG && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (e.key === "/") {
      const search = document.getElementById("search");
      if (search) { e.preventDefault(); search.focus(); return; }
      go(REL("search/"));
      e.preventDefault();
      return;
    }
    if (e.key === "?") { showHelp(); e.preventDefault(); return; }
    if (e.key === ".") { pickRandomMod(); e.preventDefault(); return; }
    if (e.key === "g") {
      waitingForG = true;
      clearTimeout(gTimer);
      gTimer = setTimeout(() => { waitingForG = false; }, 1500);
      return;
    }
  }

  // Two-key g+letter bindings
  if (waitingForG) {
    waitingForG = false;
    clearTimeout(gTimer);
    const map = { h: "home/", m: "", s: "search/", t: "tools.html", i: "info.html", r: "requests.html", a: "api/" };
    if (map[e.key] !== undefined) {
      go(REL(map[e.key]));
      e.preventDefault();
    }
  }
});
