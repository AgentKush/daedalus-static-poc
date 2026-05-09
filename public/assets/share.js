// Share + QR widget for the mod-detail page.
// Looks for #share-widget on the page and renders into it.
(function () {
  const widget = document.getElementById("share-widget");
  if (!widget) return;
  const url = window.location.href;
  const title = (document.querySelector("h1")?.textContent || document.title).trim();

  const btn = (label, icon, onclick, title) => `
    <button type="button" data-share-action="${onclick}" title="${title}"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-icarus-500 hover:text-icarus-500 transition-colors">
      ${icon}<span class="hidden sm:inline">${label}</span>
    </button>`;

  widget.innerHTML = `
    <div class="flex items-center flex-wrap gap-2 mb-4">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Share:</span>
      ${btn("Copy link", "🔗", "copy", "Copy link to clipboard")}
      ${btn("X / Twitter", "𝕏", "twitter", "Share on X/Twitter")}
      ${btn("Bluesky", "🦋", "bluesky", "Share on Bluesky")}
      ${btn("Discord", "💬", "discord", "Copy Discord-formatted link")}
      ${btn("QR code", "📱", "qr", "Show a QR code to scan onto another device")}
    </div>
    <div id="share-feedback" class="text-xs text-emerald-500 mb-2" aria-live="polite"></div>
  `;

  const text = `${title} — Project Daedalus`;
  const handlers = {
    copy: async () => {
      try { await navigator.clipboard.writeText(url); flash("Link copied"); } catch { flash("Couldn't copy", true); }
    },
    twitter: () => {
      const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(u, "_blank", "noopener");
    },
    bluesky: () => {
      const u = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`;
      window.open(u, "_blank", "noopener");
    },
    discord: async () => {
      try { await navigator.clipboard.writeText(`**${title}** — Project Daedalus\n${url}`); flash("Discord-formatted link copied"); } catch { flash("Couldn't copy", true); }
    },
    qr: () => showQR(url)
  };
  function flash(msg, err = false) {
    const fb = document.getElementById("share-feedback");
    fb.textContent = msg;
    fb.className = err ? "text-xs text-red-400 mb-2" : "text-xs text-emerald-500 mb-2";
    setTimeout(() => { fb.textContent = ""; }, 2500);
  }
  widget.addEventListener("click", e => {
    const t = e.target.closest("[data-share-action]");
    if (t) handlers[t.dataset.shareAction]?.();
  });

  function showQR(targetUrl) {
    if (document.getElementById("qr-overlay")) return;
    // Built with DOM API only — no innerHTML interpolation of DOM-derived strings.
    // `title` (h1 text) and `targetUrl` (location.href) are both untrusted in our
    // threat model since mod names come from external modder repos, so we never
    // assemble them into HTML strings. CodeQL js/xss + js/xss-through-dom alerts.
    const overlay = document.createElement("div");
    overlay.id = "qr-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.85);z-index:9998;display:flex;align-items:center;justify-content:center;padding:1rem;";

    const card = document.createElement("div");
    card.style.cssText = "background:#0f172a;border:1px solid #334155;border-radius:0.75rem;padding:1.25rem;text-align:center;max-width:18rem;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;";

    const caption = document.createElement("p");
    caption.style.cssText = "margin:0 0 0.75rem 0;font-size:0.875rem;color:#94a3b8;";
    caption.textContent = "Scan to open this mod on another device";

    const img = document.createElement("img");
    img.width = 240;
    img.height = 240;
    img.style.cssText = "border-radius:0.5rem;";
    img.alt = `QR code for ${title}`; // attribute write, NOT HTML — automatically escaped by setAttribute equivalent
    const qrApi = new URL("https://api.qrserver.com/v1/create-qr-code/");
    qrApi.searchParams.set("size", "240x240");
    qrApi.searchParams.set("data", targetUrl);
    qrApi.searchParams.set("bgcolor", "0f172a");
    qrApi.searchParams.set("color", "f1ad1c");
    img.src = qrApi.toString();

    const urlText = document.createElement("p");
    urlText.style.cssText = "margin:0.75rem 0 0 0;font-size:0.75rem;color:#64748b;word-break:break-all;";
    urlText.textContent = targetUrl; // text node, not HTML — safe even if URL has HTML-special chars

    const close = document.createElement("button");
    close.type = "button";
    close.id = "qr-close";
    close.textContent = "Close";
    close.style.cssText = "margin-top:0.75rem;padding:0.4rem 1rem;background:#f1ad1c;color:#0f172a;border:none;border-radius:0.375rem;font-weight:600;cursor:pointer;";

    card.appendChild(caption);
    card.appendChild(img);
    card.appendChild(urlText);
    card.appendChild(close);
    overlay.appendChild(card);

    overlay.addEventListener("click", e => { if (e.target === overlay || e.target.id === "qr-close") overlay.remove(); });
    document.body.appendChild(overlay);
  }
})();

