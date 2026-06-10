// cache.js — einfacher In-Memory-TTL-Cache (Map).
// Zweck: gleiche Objekt-Parameter sollen reproduzierbare Werte liefern (GeoMap liefert
// laut Doku leicht schwankende, nicht-deterministische Ergebnisse) UND Credits sparen.
// Hinweis: nicht persistent (bei Backend-Neustart leer) – fuer einen Container ausreichend.

const store = new Map(); // key -> { value, expires }

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) { store.delete(key); return undefined; }
  return hit.value;
}

export function cacheSet(key, value, ttlMs) {
  store.set(key, { value, expires: Date.now() + ttlMs });
  // einfache Groessenbegrenzung
  if (store.size > 5000) {
    const firstKey = store.keys().next().value;
    store.delete(firstKey);
  }
  return value;
}

export function cacheStats() {
  return { entries: store.size };
}
