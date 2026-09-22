const CACHE_NAME = "naija-devkit-shell-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./sw.js",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) {
        event.waitUntil(updateCache(request));
        return cached;
      }

      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          const copy = fresh.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, copy);
        }
        return fresh;
      } catch (error) {
        if (request.mode === "navigate") {
          const shell = await caches.match("./index.html") || await caches.match("./");
          if (shell) return shell;
        }
        return new Response("Naija DevKit is offline and this file is not cached yet.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })()
  );
});

async function updateCache(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, fresh.clone());
    }
  } catch (_error) {
    /* stay on cache when the network is gone */
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
