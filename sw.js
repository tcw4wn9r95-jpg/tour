// Offline support: app shell + map tiles + photos are cached as you use them,
// so a tour you've opened keeps working with a weak connection.
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const MAX_RUNTIME = 600;
// "/" when hosted at a domain root, "/tour/" on GitHub Pages.
const BASE = new URL(self.registration.scope).pathname;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon-192.png`]).catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME; i++) await cache.delete(keys[i]);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok || res.type === "opaque") {
        cache.put(request, res.clone()).then(() => trim(cache));
      }
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  // Pages read the tour id from the query string, so one copy per page is enough.
  const key = request.url.split(/[?#]/)[0];
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match(BASE)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith(`${BASE}api/`)) return;
    if (request.mode === "navigate") return event.respondWith(networkFirst(request));
    if (url.pathname.startsWith(`${BASE}_next/static/`) || url.pathname.startsWith(`${BASE}icons/`)) {
      return event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }
  if (url.hostname.endsWith("tile.openstreetmap.org") || url.pathname.match(/\/\d+\/\d+\/\d+(@2x)?\.(png|jpg|webp)$/) || url.hostname === "upload.wikimedia.org") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
