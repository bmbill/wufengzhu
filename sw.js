// 燈燈相續 service worker：離線也能開啟。頁面與程式先連網拿最新版；語音、圖片、字型用快取。
const CACHE = "dd-v11";
const CORE = ["./", "./index.html", "./lectures.js", "./lectures_vip.js", "./segments.js", "./lamrim.js", "./hearing.js", "./vip_guide.js", "./chars/files.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png", "./voice/map.js", "./voice/silence.mp3"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const put = (req, r) => { if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; };
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  const fresh = req.mode === "navigate" || (same && /(\/|\.html|\.js|\.webmanifest)$/.test(url.pathname));
  if (fresh) {
    e.respondWith(fetch(req).then(r => put(req, r)).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
    return;
  }
  const cacheable = same || /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.host);
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(req, r))));
});
