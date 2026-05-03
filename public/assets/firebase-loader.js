// Real-time Firestore loader for the daedalus static POC.
// Falls back to bundled JSON in /data/ when Firebase isn't configured.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let app, db;
const subscriptions = new Map();

export function isLive() {
  return Boolean(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId);
}

function init() {
  if (!app && isLive()) {
    app = initializeApp(window.FIREBASE_CONFIG);
    db = getFirestore(app);
  }
  return Boolean(db);
}

// Subscribe to a collection. callback(docs) is called immediately with current data
// and re-invoked whenever Firestore updates the collection.
//
// `fallbackUrl` is fetched once if Firebase isn't configured (no real-time updates).
// `transform` maps a Firestore doc snapshot to your model shape — it's also applied
// to bundled JSON entries so both paths produce the same shape.
export function subscribe(collectionName, fallbackUrl, transform, callback) {
  if (init()) {
    if (subscriptions.has(collectionName)) subscriptions.get(collectionName)();
    const unsub = onSnapshot(collection(db, collectionName), snap => {
      const docs = snap.docs.map(d => transform({ id: d.id, ...d.data() }));
      callback(docs, { live: true });
    }, err => {
      console.warn(`[firebase] ${collectionName} snapshot failed, falling back:`, err.message);
      loadFallback(fallbackUrl, transform, callback);
    });
    subscriptions.set(collectionName, unsub);
  } else {
    loadFallback(fallbackUrl, transform, callback);
  }
}

async function loadFallback(url, transform, callback) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const items = Array.isArray(raw) ? raw : Object.entries(raw).map(([id, v]) => ({ id, ...v }));
    callback(items.map(transform), { live: false });
  } catch (err) {
    console.error("[fallback] failed:", err);
    callback([], { live: false, error: err.message });
  }
}

// Status indicator helper — adds a small badge to the page showing live vs cached
export function attachStatusBadge() {
  if (document.getElementById("data-status")) return;
  const badge = document.createElement("div");
  badge.id = "data-status";
  badge.style.cssText = "position:fixed;bottom:12px;right:12px;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;color:#fff;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.3);";
  badge.textContent = "…";
  document.body.appendChild(badge);
  return (status) => {
    if (status.live) {
      badge.style.background = "#16a34a";
      badge.textContent = "● LIVE Firestore";
    } else {
      badge.style.background = "#64748b";
      badge.textContent = "○ Bundled snapshot";
    }
  };
}
