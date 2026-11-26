// UmfeldService.js · v5130 · KK6 · „Was ist in der Nähe?“ für den Eigennutzer-Check (Marcel 26.11.2026:
// „und was so in der Nähe ist also wie Supermarkt etc.“).
// Quelle: OpenStreetMap über Overpass (ODbL, Namensnennung „© OpenStreetMap-Mitwirkende“ ist Pflicht und im
// Kundentext ausdrücklich erlaubt). EINE Abfrage je Ort für alle Kategorien (statt je Kategorie eine), Ergebnis
// 30 Tage im Speicher, Koordinaten auf ~100 m gerundet → kein Massenabruf. Endpunkt aus cfg.overpass.endpoint
// (OVERPASS_ENDPOINT), damit ein eigener Overpass/Geofabrik-Extrakt ohne Codeänderung einsetzbar ist.
// Entfernung: Luftlinie und geschätzter Fußweg (Luftlinie × 1,3 bei 80 m/min). Keine Routenberechnung.
import { cfg } from '../lib/config.js';
import { haversineMeters } from '../lib/stats.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { GeoapifyConnector } from '../connectors/GeoapifyConnector.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RADIUS = 2000;          // Nahversorgung, Schulen, ÖPNV
const RADIUS_FERN = 10000;    // Bahnhof, Autobahnauffahrt
/* v5130a · gemessen 26.11.2026: overpass-api.de antwortete „at capacity“ (502), der Spiegel kumi.systems zeitweise in
   0,4 s, zeitweise gar nicht. Deshalb: zwei Overpass-Endpunkte mit je 12 s, danach Rückfall Geoapify (dieselben
   OSM-Daten, Kontingent, je Kategorie ein Abruf, 30 Tage gespeichert). Dauerhaft sauber nur mit eigenem Overpass. */
const ENDPUNKTE = [cfg.overpass.endpoint, process.env.OVERPASS_ENDPOINT_2 || 'https://overpass.kumi.systems/api/interpreter'].filter((x, i, a) => x && a.indexOf(x) === i);
const GEO_KAT = { supermarkt: 'commercial.supermarket', baecker: 'commercial.food_and_drink.bakery', apotheke: 'healthcare.pharmacy',
  arzt: 'healthcare.clinic_or_praxis', kita: 'childcare.kindergarten', schule: 'education.school', haltestelle: 'public_transport.bus,public_transport.tram',
  bahnhof: 'public_transport.train', park: 'leisure.park' };

/* Kategorie → Overpass-Filter (nwr = Knoten, Wege, Relationen; Flächen liefern ihren Mittelpunkt) */
const KAT = [
  { k: 'supermarkt', label: 'Supermarkt', f: ['["shop"="supermarket"]'], r: RADIUS },
  { k: 'baecker', label: 'Bäcker', f: ['["shop"="bakery"]'], r: RADIUS },
  { k: 'apotheke', label: 'Apotheke', f: ['["amenity"="pharmacy"]'], r: RADIUS },
  { k: 'arzt', label: 'Arztpraxis', f: ['["amenity"="doctors"]', '["healthcare"="doctor"]'], r: RADIUS },
  { k: 'kita', label: 'Kita', f: ['["amenity"="kindergarten"]'], r: RADIUS },
  { k: 'schule', label: 'Schule', f: ['["amenity"="school"]'], r: RADIUS },
  { k: 'haltestelle', label: 'Bus und Bahn', f: ['["highway"="bus_stop"]', '["railway"="tram_stop"]'], r: 1200, node: true },
  { k: 'bahnhof', label: 'Bahnhof', f: ['["railway"~"^(station|halt)$"]'], r: RADIUS_FERN, node: true },
  { k: 'park', label: 'Park oder Grünfläche', f: ['["leisure"="park"]'], r: RADIUS },
  { k: 'autobahn', label: 'Autobahnauffahrt', f: ['["highway"="motorway_junction"]'], r: RADIUS_FERN, node: true },
];
const GRUNDSCHULE = /grundschule|primarschule|volksschule/i;
const WEITERF = /gymnasium|realschule|gesamtschule|sekundarschule|hauptschule|oberschule|stadtteilschule|gemeinschaftsschule|berufskolleg|berufsschule/i;

function passt(tags, f) {
  // f wie '["shop"="supermarket"]' oder '["railway"~"^(station|halt)$"]["usage"!~…]' → nur die erste Bedingung zählt hier
  const m = /^\["([^"]+)"(=|~)"([^"]+)"\]/.exec(f); if (!m) return false;
  const v = tags[m[1]]; if (v == null) return false;
  return m[2] === '=' ? v === m[3] : new RegExp(m[3]).test(v);
}

export const UmfeldService = {
  async analyze(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) return { ok: false, grund: 'koordinaten' };
    const ck = 'umfeld|' + lat.toFixed(3) + '|' + lon.toFixed(3);
    const c = cacheGet(ck); if (c) return { ...c, cached: true };
    const teile = KAT.flatMap((x) => x.f.map((f) => (x.node ? 'node' : 'nwr') + f + '(around:' + x.r + ',' + lat + ',' + lon + ');')).join('');
    const ql = '[out:json][timeout:12];(' + teile + ');out tags center 600;';
    let els = null, quelle = null;
    for (const ep of ENDPUNKTE) {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch(ep, { method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DealPilot-Umfeld/1.0 (Eigennutzer-Check; Junker Solution)' },
          body: 'data=' + encodeURIComponent(ql) });
        clearTimeout(t);
        if (res.ok) { const j = await res.json(); if (j && Array.isArray(j.elements)) { els = j.elements; quelle = 'overpass'; break; } }
      } catch (e) { clearTimeout(t); }
    }
    if (!els && GeoapifyConnector.available()) {
      els = []; quelle = 'geoapify';
      const KEY = { supermarkt: ['shop', 'supermarket'], baecker: ['shop', 'bakery'], apotheke: ['amenity', 'pharmacy'], arzt: ['amenity', 'doctors'],
        kita: ['amenity', 'kindergarten'], schule: ['amenity', 'school'], haltestelle: ['highway', 'bus_stop'], bahnhof: ['railway', 'station'], park: ['leisure', 'park'] };
      await Promise.all(Object.keys(GEO_KAT).map(async (k) => {
        const r = (KAT.find((x) => x.k === k) || {}).r || RADIUS;
        const arr = await GeoapifyConnector.places(GEO_KAT[k], lat, lon, r, k === 'schule' ? 40 : 10);   /* Schulen: Grundschule und weiterfuehrende erst ueber den Namen getrennt */
        for (const p of arr) { const tags = { name: p.name }; tags[KEY[k][0]] = KEY[k][1]; els.push({ lat: p.lat, lon: p.lon, tags }); }
      }));
    }
    if (!els) return { ok: false, grund: 'umfeld_quelle_nicht_erreichbar' };

    const orte = els.map((e) => {
      const la = typeof e.lat === 'number' ? e.lat : (e.center && e.center.lat);
      const lo = typeof e.lon === 'number' ? e.lon : (e.center && e.center.lon);
      return { tags: e.tags || {}, lat: la, lon: lo };
    }).filter((o) => typeof o.lat === 'number' && typeof o.lon === 'number')
      .map((o) => ({ ...o, m: Math.round(haversineMeters(lat, lon, o.lat, o.lon)) }));

    const kategorien = [];
    for (const x of KAT) {
      let treffer = orte.filter((o) => x.f.some((f) => passt(o.tags, f)) && o.m <= x.r);
      const eintrag = (k, label, liste) => {
        liste.sort((a, b) => a.m - b.m);
        const n = liste[0];
        kategorien.push({ k, label, anzahl: liste.length,
          naechster: n ? { name: n.tags.name || null, luftlinie_m: n.m, fuss_min: Math.max(1, Math.round(n.m * 1.3 / 80)) } : null });
      };
      if (x.k === 'schule') {
        eintrag('grundschule', 'Grundschule', treffer.filter((o) => GRUNDSCHULE.test(o.tags.name || '')));
        eintrag('weiterfuehrend', 'Weiterführende Schule', treffer.filter((o) => WEITERF.test(o.tags.name || '')));
      } else if (x.k === 'autobahn' && quelle === 'geoapify') {
        kategorien.push({ k: x.k, label: x.label, anzahl: null, naechster: null, nicht_ermittelt: true });
      } else eintrag(x.k, x.label, treffer);
    }
    const out = { ok: true, lat, lon, kategorien, quelle, vermerk: quelle === 'geoapify' ? '© OpenStreetMap-Mitwirkende, Geoapify' : '© OpenStreetMap-Mitwirkende', stand: new Date().toISOString().slice(0, 10),
      hinweis: 'Entfernungen in Luftlinie, Fußweg geschätzt.' };
    if (orte.length) cacheSet(ck, out, TTL_MS);
    return out;
  },
};
