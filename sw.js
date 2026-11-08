const CACHE_NAME = "tm-app-pages-v102";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./auth.css",
  "./main.js",
  "./pay-menu.js",
  "./manifest.webmanifest",
  "./logo.svg",
  "./aliyankee-pay.html",
  "./aliyankee-pay.css",
  "./aliyankee-pay.js"
];
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(error => {
        console.error("TM App cache install failed:", error);
        throw error;
      })
  );
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
