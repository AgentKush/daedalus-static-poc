function escape(s) { return (s || "").toString().replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function renderTool(t) {
  return `<div class="flex flex-col p-6 border-2 tool-card rounded-xl border-icarus-500 bg-gradient-to-b from-slate-100 to-white dark:from-slate-800 dark:to-slate-900">
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1">
        <h2 class="text-xl font-bold md:text-2xl text-icarus-500">${escape(t.name)}</h2>
        <p class="text-sm text-blue-400">by ${escape(t.author)}</p>
      </div>
      <div class="flex flex-col items-end flex-shrink-0 ml-4">
        <a href="${escape(t.url)}" download="${escape(t.filename)}" class="inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-icarus-500 hover:bg-icarus-600">Download</a>
        <span class="mt-1 text-xs text-slate-500">${escape(t.version)}</span>
      </div>
    </div>
    <div class="flex-1 prose dark:prose-invert text-slate-700 dark:text-slate-300">${t.body_html || ""}</div>
    <div class="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
      <p class="text-xs text-right text-slate-500">${escape(t.updated_string)}</p>
    </div>
  </div>`;
}

(async () => {
  const res = await fetch("./data/tools.json");
  const tools = await res.json();
  document.getElementById("tools-grid").innerHTML = tools.map(renderTool).join("");
})();
