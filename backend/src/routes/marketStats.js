'use strict';
/* routes/marketStats.js — v3172 · N121 Marktstatistik je Kreis (Portfolio-Modul, 04.11.2026)
 * Mount: /api/v1/market-stats. Oeffentlich wie /market-rates/bauzins (amtliche Daten unter dl-de/by-2-0).
 * Liest beim Marktbericht-Dienst, der die Werte in mb.baustatistik vorhaelt (monatlicher Abgleich) -
 * kein Live-Abruf bei der Regionaldatenbank je Anfrage. */
const express = require('express');
const router = express.Router();
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

async function weiter(pfad, res) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(MB_BASE + pfad, { signal: ctrl.signal });
    const text = await r.text();
    res.status(r.status).type('application/json').set('Cache-Control', 'public, max-age=3600').send(text);
  } catch (e) {
    res.status(502).json({ error: 'Marktstatistik nicht erreichbar', detail: String(e.message).slice(0, 120) });
  } finally { clearTimeout(t); }
}
router.get('/baukosten', (req, res) => {
  const ags = req.query.ags ? String(req.query.ags).replace(/[^0-9]/g, '') : '';
  weiter('/market-stats/baukosten' + (ags ? '?ags=' + encodeURIComponent(ags) : ''), res);
});
router.get('/index', (req, res) => weiter('/market-stats/index', res));

/* ═══ landing-dealcheck-2 · v3324 · Schnellcheck Lage & Markt (Marcel 12.11.2026) ═══════════════════
   GET /api/v1/market-stats/schnellcheck?plz=32049[&ort=Herford] — oeffentlich, fuer den Deal-Check der Landing.
   Kostet uns je Abruf 0 € — es werden NUR Endpunkte des mb-Backends gefragt, die aus eigenen Tabellen lesen:
     /lage/gemessen OHNE adresse  -> mb.makro_werte (Regionaldatenbank), mb.zensus_werte (Leerstand Zensus 2022);
                                    ohne Adresse KEIN Geocoding, KEIN Umfeld-Abruf, KEINE Angebotsdaten (Vermarktungsdauer)
     /zensus/fortgeschrieben      -> Zensus-Bestandsmiete der Gemeinde, fortgeschrieben mit dem Nettokaltmieten-Index (Datei)
     /mietspiegel?ags=            -> Mietspiegel-Verzeichnis (Datei, Naeherung nur mit baujahr/wfl - hier nicht gefragt)
   Die PLZ -> Gemeinde-Aufloesung liest mb.plz_orte (90 Tage); nur eine neue PLZ fragt einmal die freie OpenPLZ-API.
   Steht ein Kreis nicht in mb.makro_werte, faellt das mb-Backend auf die Regionaldatenbank zurueck (frei, langsam) -
   der Abruf hier wartet hoechstens 8 s.
   Bewusst NICHT: Bodenrichtwert (BORIS braucht Koordinaten = Geocoding mit Kontingent), Umfeld/Mikrolage
   (Geoapify), Vermarktungsdauer/Angebotsmieten (Angebotsdaten mit Kontingent), KI-Texte (OpenAI).
   Schutz: je IP 30 Abrufe in 10 Minuten (zusaetzlich zu 60/min am Mount), Ergebnis 24 h im Speicher je PLZ+Ort. */
const rateLimit = require('express-rate-limit');
const schnellLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'zu_viele_abrufe', hinweis: 'Bitte in ein paar Minuten noch einmal.' } });
const SCHNELL_TTL = 24 * 3600 * 1000;
const schnellSpeicher = new Map();
async function mbJson(pfad, ms) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(MB_BASE + pfad, { signal: ctrl.signal }); return r.ok ? await r.json() : null; }
  catch (e) { return null; } finally { clearTimeout(t); }
}
function kachelAusFeld(f) {
  if (!f || f.wert == null || !Number.isFinite(Number(f.wert))) return null;
  return { wert: Number(f.wert), einheit: f.einheit || null, wort: f.wort || null, ton: f.ton || null,
    stand: f.stand == null ? null : (typeof f.stand === 'object' ? (f.stand.bevoelkerung || null) : f.stand), ebene: f.ebene || null };
}
function vglAus(ms, bj, wfl) {
  if (!ms) return null;
  const objekt = { baujahr: bj || 1975, wfl: wfl || 70, norm: !bj || !wfl };
  const w = ms.werte;
  if (w && Number(w.mittel) > 0) return { qm: Number(w.mittel), unten: Number(w.unten) || null, oben: Number(w.oben) || null,
    quelle: 'mietspiegel', art: ms.art || w.art || null, gemeinde: w.gemeinde || ms.gemeinde || null, stand: w.stand || ms.stand || null, zelle: w.zelle || null, objekt };
  const n = ms.naeherung;
  if (n && Number(n.qm) > 0) return { qm: Number(n.qm), unten: null, oben: null, quelle: 'naeherung', abweichung_pct: n.mape_pct || null, objekt };
  return null;
}
/* v5130 · KK6 · GET /api/v1/market-stats/umfeld?lat=&lon=  oder  ?adresse=  — oeffentlich fuer den Eigennutzer-Check
   (Marcel 26.11.2026: „was so in der Naehe ist, also wie Supermarkt etc.“). Quelle OpenStreetMap (Overpass, im mb-Backend
   30 Tage gespeichert). Mit adresse einmal Geocoding ueber das mb-Backend (Kontingent) - deshalb eng begrenzt:
   je IP 10 Abrufe in 10 Minuten. Ergebnis 7 Tage hier im Speicher je gerundeter Koordinate. */
const umfeldLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'zu_viele_abrufe', hinweis: 'Bitte in ein paar Minuten noch einmal.' } });
const umfeldSpeicher = new Map();
router.get('/umfeld', umfeldLimit, async (req, res) => {
  let lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  const adr = String(req.query.adresse || '').replace(/[<>"]/g, '').trim().slice(0, 140);
  if ((!isFinite(lat) || !isFinite(lon)) && adr.length >= 6) {
    const g = await mbJson('/geocode?address=' + encodeURIComponent(adr), 8000);
    if (g && isFinite(Number(g.lat)) && isFinite(Number(g.lon))) { lat = Number(g.lat); lon = Number(g.lon); }
  }
  if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: 'ort_fehlt', hinweis: 'Adresse mit Straße, PLZ und Ort angeben.' });
  const key = lat.toFixed(3) + '|' + lon.toFixed(3), c = umfeldSpeicher.get(key);
  if (c && Date.now() - c.t < 7 * 24 * 3600 * 1000) return res.json(c.d);
  const d = await mbJson('/umfeld?lat=' + lat + '&lon=' + lon, 25000);
  if (!d || !d.ok) return res.status(502).json({ error: 'umfeld_nicht_verfuegbar' });
  umfeldSpeicher.set(key, { t: Date.now(), d });
  if (umfeldSpeicher.size > 5000) umfeldSpeicher.delete(umfeldSpeicher.keys().next().value);
  res.json(d);
});

router.get('/schnellcheck', schnellLimit, async (req, res) => {
  const plz = String(req.query.plz || '').trim();
  if (!/^\d{5}$/.test(plz)) return res.status(400).json({ error: 'plz_fehlt' });
  const ort = String(req.query.ort || '').replace(/[^A-Za-zÄÖÜäöüß .\-]/g, '').trim().slice(0, 60);
  /* landing-dealcheck-6 · Vergleichsmiete: Baujahr und Wohnflaeche des Objekts (optional). Ohne Angabe die Normwohnung
     Baujahr 1975 / 70 m^2 (an ihr ist die DealPilot-Naeherung gemessen, 85 % innerhalb +-10 %) - die Antwort sagt, welche. */
  const bjIn = parseInt(String(req.query.baujahr || ''), 10), wflIn = parseFloat(String(req.query.wfl || '').replace(',', '.'));
  const bj = bjIn >= 1800 && bjIn <= 2030 ? bjIn : null, wfl = wflIn >= 15 && wflIn <= 400 ? Math.round(wflIn) : null;
  /* v5080 · wie der Proxy (routes/marktbericht.js v3260): ausserhalb von Staging nur freie Mietspiegel-Werte, gesperrte
     (Rechtevorbehalt) rechnen dort nie, dann rechnet die DealPilot-Naeherung. */
  const _staging = /staging|localhost|127\.0\.0\.1/i.test(String(process.env.APP_URL || '') + ' ' + String(process.env.APP_DOMAIN || ''));
  const msQ = '&baujahr=' + (bj || 1975) + '&wfl=' + (wfl || 70) + (_staging ? '' : '&nur_frei=1');
  const key = plz + '|' + ort.toLowerCase() + '|' + (bj || '') + '|' + (wfl || '');
  const alt = schnellSpeicher.get(key);
  if (alt && Date.now() - alt.t < SCHNELL_TTL) return res.set('Cache-Control', 'public, max-age=3600').json(alt.d);
  const q = '?plz=' + plz + (ort ? '&ort=' + encodeURIComponent(ort) : '');
  const [lage, miete] = await Promise.all([mbJson('/lage/gemessen' + q, 8000), mbJson('/zensus/fortgeschrieben' + q, 6000)]);
  const gem = lage && lage.gebiet && lage.gebiet.gemeinde_ags;
  /* landing-dealcheck-5: Einwohnerzahl, Kappungsgrenze, Mietpreisbremse (mb /schnell/ort, nur eigene Daten) */
  /* nn6 · laufende Wohnnebenkosten je Gemeinde (mb /nebenkosten, eigene Datei, ohne Heizung) für den Haus-Check */
  const [ms, ort2, nk] = gem ? await Promise.all([mbJson('/mietspiegel?ags=' + encodeURIComponent(gem) + msQ, 4000),
    mbJson('/schnell/ort?ags=' + encodeURIComponent(gem), 4000),
    mbJson('/nebenkosten?ags=' + encodeURIComponent(gem) + (wfl ? '&wfl=' + wfl : ''), 3000)]) : [null, null, null];
  const fe = (lage && lage.felder) || {};
  const d = {
    plz, gebiet: (miete && miete.available && miete.gebiet) || null, gemeinde_eindeutig: !!gem,
    makrolage: kachelAusFeld(fe.makrolage),
    bevoelkerung: kachelAusFeld(fe.ds2_bevoelkerung),
    leerstand: kachelAusFeld(fe.ds2_mietausfall),
    miete: miete && miete.available && miete.qm > 0 ? { qm: miete.qm, ebene: miete.ebene || null, monat: miete.fortgeschrieben_auf || null } : null,
    vergleichsmiete: vglAus(ms, bj, wfl),
    einwohner: ort2 && ort2.einwohner ? ort2.einwohner : null,
    nebenkosten: nk && nk.summe_qm > 0 ? { qm: nk.summe_qm, ortsgenau: (nk.posten || []).filter((p) => p.herkunft === 'gemeinde').map((p) => p.id), posten: (nk.posten || []).map((p) => ({ id: p.id, name: p.name, qm: p.qm_monat, herkunft: p.herkunft })) } : null,
    kappung: ort2 && ort2.kappung ? { pct: ort2.kappung.pct, verordnung: ort2.kappung.herkunft === 'verordnung', pruefen: ort2.kappung.pruefen, text: ort2.kappung.text } : null,
    mietpreisbremse: ort2 && ort2.mietpreisbremse ? { gilt: ort2.mietpreisbremse.gilt, bis: ort2.mietpreisbremse.bis, pruefen: ort2.mietpreisbremse.pruefen, text: ort2.mietpreisbremse.text } : null,
    mietspiegel: ms && ms.art ? { art: ms.art, gemeinde: ms.gemeinde || null, stand: ms.stand || null } : (ms ? { art: null } : null),
    quellen: 'Amtliche Daten: Regionaldatenbank der Statistischen Ämter, Zensus 2022, Destatis-Nettokaltmietenindex, Mietspiegel der Gemeinde',
    lizenz: 'dl-de/by-2-0'
  };
  const leer = !d.makrolage && !d.bevoelkerung && !d.leerstand && !d.miete;
  if (!leer) {
    if (schnellSpeicher.size > 3000) schnellSpeicher.clear();
    schnellSpeicher.set(key, { t: Date.now(), d });
  }
  res.set('Cache-Control', leer ? 'no-store' : 'public, max-age=3600').json(d);
});

module.exports = router;
