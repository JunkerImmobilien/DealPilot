/* DealPilot v1118 — Selbstabmeldung des Mobile-Service-Workers.
 *
 * Die MA-Fassung ist ausgebaut; die normale Ansicht traegt das Handy allein.
 * Diese Datei ersetzt den alten Shell-Cache-Worker (Geltungsbereich
 * /mobile-demo.html) und tut nur noch eines: sich selbst und seinen Cache
 * abraeumen und offene Fenster auf die normale App schicken.
 *
 * WARUM NICHT EINFACH LOESCHEN: Ein registrierter Service Worker liegt auf
 * dem GERAET, nicht auf dem Server. Der alte Worker beantwortete jede
 * Navigation aus dem Cache, wenn das Netz die Huelle nicht hergab. Waere die
 * Datei ersatzlos verschwunden, haetten installierte Handy-Apps dauerhaft auf
 * einer Fassung gestanden, die es nicht mehr gibt — und kein Rollout haette
 * diese Geraete je wieder erreicht.
 *
 * Diese Fassung muss deshalb stehen bleiben, bis mit hinreichender Sicherheit
 * jedes Geraet sie einmal gesehen hat. KEIN fetch-Handler: ab sofort geht
 * jede Anfrage am Worker vorbei ans Netz.
 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (cs) {
        cs.forEach(function (c) { try { c.navigate('/'); } catch (err) {} });
      })
      .catch(function () {})
  );
});
