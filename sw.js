const CACHE_NAME = "chichi-ads-pages-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./chichi.css",
  "./chichi-app.js",
  "./chichi-auth.js",
  "./chichi-config.js",
  "./manifest.webmanifest",
  "./logo.svg"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
  ));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
