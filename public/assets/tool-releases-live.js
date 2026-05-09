// Fetches the GitHub Releases for a tool's repo and renders them as a
// version-history list with markdown-rendered changelog bodies.
// Looks for [data-tool-releases] elements with data-owner / data-repo attrs.
// Caches per (owner, repo) for 1 hour in localStorage to stay polite under
// GitHub's 60/hr unauthenticated limit.

const CACHE_TTL_MS = 60 * 60 * 1000;

function escape(s) {
  return (s || "").toString().replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function fetchReleases(owner, repo) {
  const cacheKey = `daedalus.releases.${owner}/${repo}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) return cached.data;
  } catch {}
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`;
  const r = await fetch(url, { headers: { "Accept": "application/vnd.github+json" } });
  if (!r.ok) {
    if (r.status === 403) throw new Error("rate-limited (60/hr unauthenticated). Try again later.");
    if (r.status === 404) throw new Error("No releases (or repo not found).");
    throw new Error(`HTTP ${r.status}`);
  }
  const data = await r.json();
  try { localStorage.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), data })); } catch {}
  return data;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function timeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "d ago";
  if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + "mo ago";
  return Math.floor(s / (86400 * 365)) + "y ago";
}

// Tiny markdown-ish formatter for release bodies. Handles headings, bullets,
// code, links — without pulling in marked. Adequate for typical release notes.
function formatBody(md) {
  if (!md) return "<p class='text-slate-500 italic'>No release notes provided.</p>";
  let html = escape(md);
  // headings ###/##/#
  html = html.replace(/^### (.+)$/gm, "<h4 class='font-semibold text-icarus-500 mt-3'>$1</h4>");
  html = html.replace(/^## (.+)$/gm, "<h3 class='font-semibold text-icarus-500 mt-3 text-base'>$1</h3>");
  html = html.replace(/^# (.+)$/gm, "<h3 class='font-bold text-icarus-500 mt-3 text-lg'>$1</h3>");
  // bullets — group consecutive
  html = html.replace(/(?:^|\n)((?:[-*] [^\n]+\n?)+)/g, (_, group) => {
    const items = group.trim().split(/\n/).map(l => l.replace(/^[-*] /, "")).map(l => `<li>${l}</li>`).join("");
    return `\n<ul class="list-disc pl-5 my-2 space-y-1">${items}</ul>\n`;
  });
  // code (inline + fenced)
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre class="p-2 my-2 rounded bg-slate-200 dark:bg-slate-800 overflow-x-auto text-xs"><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, "<code class='px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-xs'>$1</code>");
  // links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-icarus-500 hover:underline">$1</a>');
  // bold / italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<![*])\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  // double newlines → paragraph break
  html = html.split(/\n\n+/).map(p => p.trim()).filter(Boolean).map(p => p.match(/^<(h\d|ul|pre)/) ? p : `<p>${p.replace(/\n/g, " ")}</p>`).join("\n");
  return html;
}

function renderRelease(rel) {
  const title = escape(rel.name || rel.tag_name || "(unnamed release)");
  const tag = escape(rel.tag_name || "");
  const date = rel.published_at;
  const assetCount = (rel.assets || []).length;
  const bodyHtml = formatBody(rel.body);
  const assetsHtml = assetCount === 0 ? "" : `
    <details class="mt-3">
      <summary class="cursor-pointer text-xs text-slate-500 hover:text-icarus-500">${assetCount} download${assetCount===1?"":"s"}</summary>
      <ul class="mt-2 space-y-1 text-xs">
        ${rel.assets.map(a => `<li><a href="${escape(a.browser_download_url)}" download class="text-icarus-500 hover:underline">${escape(a.name)}</a> <span class="text-slate-500">(${(a.size/1024).toFixed(0)} KB · ${a.download_count} downloads)</span></li>`).join("")}
      </ul>
    </details>`;
  return `<article class="p-4 mb-3 border rounded-lg border-slate-300/50 dark:border-slate-600/50 bg-white dark:bg-slate-800/40">
    <header class="flex items-start justify-between flex-wrap gap-2 mb-2">
      <div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">${title}</h3>
        ${tag && tag !== title ? `<div class="text-xs text-slate-500 mt-0.5">tag <code class="text-xs">${tag}</code></div>` : ""}
      </div>
      <div class="text-xs text-right text-slate-500">
        <div>${fmtDate(date)}</div>
        <div class="text-slate-400">${timeAgo(date)}</div>
      </div>
    </header>
    <div class="text-sm text-slate-700 dark:text-slate-300">${bodyHtml}</div>
    ${assetsHtml}
  </article>`;
}

document.querySelectorAll("[data-tool-releases]").forEach(async el => {
  const owner = el.dataset.owner, repo = el.dataset.repo;
  const keyword = (el.dataset.releaseKeyword || "").toLowerCase();
  const toolName = el.dataset.toolName || "";
  if (!owner || !repo) { el.textContent = "(no repo configured)"; return; }
  try {
    const releases = await fetchReleases(owner, repo);
    if (!releases.length) {
      el.innerHTML = `<p class="text-sm text-slate-500">No GitHub releases yet for <code>${escape(owner)}/${escape(repo)}</code>. Check the repo for source / commit history.</p>`;
      return;
    }
    // If a keyword was passed, filter releases whose name OR tag mentions it.
    // This handles the common case where multiple tools share a repo and the
    // release feed is dominated by one of them. Without filtering, the wrong
    // tool's release notes would be shown.
    let filtered = releases;
    let filteredOut = 0;
    if (keyword) {
      filtered = releases.filter(r =>
        ((r.name || "") + " " + (r.tag_name || "")).toLowerCase().includes(keyword)
      );
      filteredOut = releases.length - filtered.length;
    }
    if (filtered.length === 0) {
      // None of the releases mention this tool by keyword — likely they're all
      // for a sibling tool in the same repo. Tell the user honestly instead of
      // dumping unrelated releases.
      el.innerHTML = `<p class="text-sm text-slate-500">
        No releases tagged for <strong>${escape(toolName || keyword)}</strong> in
        <a href="https://github.com/${escape(owner)}/${escape(repo)}/releases" target="_blank" rel="noopener" class="text-icarus-500 hover:underline">${escape(owner)}/${escape(repo)}</a>'s
        release feed (the repo's ${releases.length} release${releases.length===1?"":"s"} appear${releases.length===1?"s":""} to be for a sibling tool). The download button above always points at the latest version listed in the catalog.
      </p>`;
      return;
    }
    const note = filteredOut > 0
      ? `<p class="text-xs text-slate-500 mb-2">Showing ${filtered.length} of ${releases.length} repo releases — filtered to entries mentioning <code>${escape(keyword)}</code>.</p>`
      : "";
    el.innerHTML = note + filtered.map(renderRelease).join("");
  } catch (e) {
    el.innerHTML = `<p class="text-sm text-slate-500">Couldn't load releases: ${escape(e.message)}</p>`;
  }
});
