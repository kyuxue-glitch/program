/* ══════════════════════════════════════════════════════════════════
   sw.js —— 可选的离线缓存
   HTML 用网络优先（保证内容是最新的），静态资源用缓存优先。
   如果不想要 Service Worker，删掉这个文件即可，
   app.js 里的注册失败不会影响站点。
   ══════════════════════════════════════════════════════════════════ */
const VERSION = "hoshino-v2.0.4";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./js/art.js",
  "./js/store.js",
  "./js/particles.js",
  "./js/mousefx.js",
  "./js/player.js",
  "./js/views.js",
  "./js/assistant.js",
  "./js/games.js",
  "./assets/hero.svg",
  "./assets/favicon.svg",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  const url = new URL(req.url);
  const isCode = /\.(?:css|js|html)$/.test(url.pathname) || isHTML;

  // 页面与代码：网络优先（保证部署后立刻生效），断网时回退到缓存
  if (isCode) {
    event.respondWith(
      fetch(new Request(req, { cache: "no-cache" }))
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // 其他静态资源（图片 / 字体 / manifest）：缓存优先
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
