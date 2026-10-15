const VERSION = "matshop-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const IMAGES = `${VERSION}-images`;
const OFFLINE = "/offline.html";
const PUBLIC_API = ["/api/listings", "/api/catalog", "/api/portfolios", "/api/vendors", "/api/site-settings", "/api/banners",
  "/api/ads", "/api/custom/config", "/api/meta", "/api/reviews/ref", "/api/files/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const put = (name, req, res) => { if (res && (res.ok || res.type === "opaque")) caches.open(name).then((c) => c.put(req, res)); };

const networkFirst = async (req, name) => {
  try {
    const res = await fetch(req);
    put(name, req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err;
  }
};

const staleWhileRevalidate = async (req) => {
  const hit = await caches.match(req);
  const net = fetch(req).then((res) => { put(IMAGES, req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.includes("hot-update") || url.pathname.startsWith("/sockjs-node") || url.pathname.startsWith("/ws")) return;

  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, PAGES).catch(async () => (await caches.match("/")) || caches.match(OFFLINE)));
    return;
  }
  if (req.destination === "image") {
    if (url.pathname.includes("/private/")) return;
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.includes("/private/") || !PUBLIC_API.some((p) => url.pathname.startsWith(p))) return;
    e.respondWith(networkFirst(req, ASSETS));
    return;
  }
  if (["script", "style", "font", "manifest"].includes(req.destination)) e.respondWith(networkFirst(req, ASSETS));
});
