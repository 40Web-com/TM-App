const CACHE_NAME = "tm-app-pages-v152";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./auth.css",
  "./main.js",
  "./pay-menu.js",
  "./manifest.webmanifest",
  "./logo.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./aliyankee-pay.html",
  "./aliyankee-pay.css",
  "./aliyankee-pay.js",
  "./gamehub.html",
  "./gamehub.css",
  "./gamehub.js",
  "./discover.css",
  "./google-auth.css",
  "./virtual-battle.html",
  "./virtual-battle.css",
  "./virtual-battle.js"
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
