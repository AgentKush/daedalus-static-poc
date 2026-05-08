// Recently viewed mods — localStorage-backed, last 10 unique entries.
// Records on mod-detail pages; renders a centered strip on the home page.
const KEY = "daedalus.recentlyViewed";
const MAX = 10;

function read() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function write(list) { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); }

export function record(entry) {
  if (!entry || !entry.slug || !entry.author_slug) return;
  const list = read().filter(e => e.slug !== entry.slug || e.author_slug !== entry.author_slug);
  list.unshift({ ...entry, seen_at: Date.now() });
  write(list);
}

export function renderStripInto(container, rootPath = "./") {
  const list = read();
  if (!list.length) return;
  container.innerHTML = `
    <div class="text-center mb-3">
      <span class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Continue browsing</span>
    </div>
    <div class="flex flex-wrap justify-center gap-2">
      ${list.map(e => `
        <a href="${rootPath}mods/${e.author_slug}/${e.slug}/"
           class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-icarus-500 hover:text-icarus-500 no-underline transition-colors">
          <span class="font-medium">${escape(e.name)}</span>
          <span class="text-slate-400 dark:text-slate-500">·</span>
          <span class="text-slate-500 dark:text-slate-400">${escape(e.author)}</span>
        </a>
      `).join("")}
    </div>
  `;
}
function escape(s){return (s||"").toString().replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
