// Recently viewed mods — localStorage-backed, last 10 unique entries.
// Records on mod-detail pages; renders a strip on the home page.
const KEY = "daedalus.recentlyViewed";
const MAX = 10;

function read() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function write(list) { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); }

export function record(entry) {
  // entry = { name, author, author_slug, slug, image_url? }
  if (!entry || !entry.slug || !entry.author_slug) return;
  const list = read().filter(e => e.slug !== entry.slug || e.author_slug !== entry.author_slug);
  list.unshift({ ...entry, seen_at: Date.now() });
  write(list);
}

export function renderStripInto(container, rootPath = "./") {
  const list = read();
  if (!list.length) return;
  container.innerHTML = `
    <div class="mb-2 text-xs uppercase tracking-wide text-icarus-500 font-medium">Recently viewed</div>
    <div class="flex gap-2 overflow-x-auto pb-2">
      ${list.map(e => `
        <a href="${rootPath}mods/${e.author_slug}/${e.slug}/"
           class="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-icarus-500 no-underline transition-colors">
          <span class="font-medium">${escape(e.name)}</span>
          <span class="text-slate-500">${escape(e.author)}</span>
        </a>
      `).join("")}
    </div>
  `;
}
function escape(s){return (s||"").toString().replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
