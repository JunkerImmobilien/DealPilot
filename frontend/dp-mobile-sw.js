/* DealPilot Mobile PWA Service Worker - Scope /mobile-demo.html (kontrolliert NUR die Mobile-App). */
var CACHE = 'dp-mobile-v1';
var SHELL = ['/mobile-demo.html'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                 // POST/PUT etc. -> Browser-Default (API unberuehrt)
  if (req.mode === 'navigate' || /\/mobile-demo\.html/.test(req.url)) {
    // App-Shell: network-first, Cache als Offline-Fallback
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('/mobile-demo.html', copy); });
        return res;
      }).catch(function () { return caches.match('/mobile-demo.html'); })
    );
    return;
  }
  // Alles andere (JS/Assets/API): durchreichen, kein Caching.
});
