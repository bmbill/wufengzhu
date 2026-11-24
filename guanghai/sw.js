// 廣海明月學習單 service worker：離線也能開。頁面、程式、講次資料先連網拿最新版，連不上就用快取；字型用快取。
const CACHE = "gh-v8";
const CORE = ["./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-180.png", "./lessons/index.json"];
self.addEventListener("install", e => {
  // 連同每一講的資料一起存，手機離線也能開沒看過的講
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE);
    try {
      const idx = await (await fetch("./lessons/index.json", { cache: "no-cache" })).json();
      await c.addAll(idx.lessons.map(x => `./lessons/${x.id}.json`));
    } catch (e) {}
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("gh-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const put = (req, r) => { if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; };
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (same && (req.mode === "navigate" || /(\/|\.html|\.js|\.css|\.json|\.webmanifest)$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => put(req, r))
      .catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
    return;
  }
  const font = (url.host === "fonts.gstatic.com" && url.pathname.startsWith("/s/")) || (url.host === "fonts.googleapis.com" && url.pathname === "/css2");
  if (same || font) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(req, r))));
  }
});
