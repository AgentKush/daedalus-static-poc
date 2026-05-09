import { subscribe, attachStatusBadge } from "./firebase-loader.js";

function escape(s) { return (s || "").toString().replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function transformTool(d) {
  return {
    id: d.id || `${(d.author||"").toLowerCase().replace(/\W+/g,"-")}-${(d.name||"").toLowerCase().replace(/\W+/g,"-")}`,
    name: d.name,
    author: d.author,
    version: d.version,
    url: d.url || d.fileURL,
    filename: d.filename,
    body_html: d.body_html || d.description,
    updated_string: d.updated_string || (d.updated_at ? `Last Updated on ${d.updated_at}` : "")
  };
}

function slug(s) { return (s||"").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function renderTool(t) {
  const detailHref = `./tools/${slug(t.author)}/${slug(t.name)}/`;
  return `<div class="flex flex-col p-6 border-2 tool-card rounded-xl border-icarus-500 bg-gradient-to-b from-slate-100 to-white dark:from-slate-800 dark:to-slate-900">
    <div class="flex items-start justify-between mb-4 gap-3">
      <div class="flex-1 min-w-0">
        <a href="${detailHref}" class="no-underline">
          <h2 class="text-xl font-bold md:text-2xl text-icarus-500 hover:text-icarus-400">${escape(t.name)}</h2>
        </a>
        <p class="text-sm text-blue-400">by ${escape(t.author)}</p>
      </div>
      <div class="flex flex-col items-end flex-shrink-0">
        <a href="${escape(t.url)}" download="${escape(t.filename)}" class="inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-icarus-500 hover:bg-icarus-600">Download</a>
        <span class="mt-1 text-xs text-slate-500">v${escape(t.version)}</span>
      </div>
    </div>
    <div class="flex-1 prose dark:prose-invert text-slate-700 dark:text-slate-300">${t.body_html || ""}</div>
    <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
      <a href="${detailHref}" class="text-sm font-medium text-icarus-500 hover:text-icarus-400 no-underline">View details &amp; release history →</a>
      <p class="text-xs text-slate-500">${escape(t.updated_string)}</p>
    </div>
  </div>`;
}

const setStatus = attachStatusBadge();
subscribe("tools", "./data/tools.json", transformTool, (tools, status) => {
  setStatus(status);
  document.getElementById("tools-grid").innerHTML = tools.map(renderTool).join("");
});
