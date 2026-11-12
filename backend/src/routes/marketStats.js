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
router.get('/schnellcheck', schnellLimit, async (req, res) => {
  const plz = String(req.query.plz || '').trim();
  if (!/^\d{5}$/.test(plz)) return res.status(400).json({ error: 'plz_fehlt' });
  const ort = String(req.query.ort || '').replace(/[^A-Za-zÄÖÜäöüß .\-]/g, '').trim().slice(0, 60);
  const key = plz + '|' + ort.toLowerCase();
  const alt = schnellSpeicher.get(key);
  if (alt && Date.now() - alt.t < SCHNELL_TTL) return res.set('Cache-Control', 'public, max-age=3600').json(alt.d);
  const q = '?plz=' + plz + (ort ? '&ort=' + encodeURIComponent(ort) : '');
  const [lage, miete] = await Promise.all([mbJson('/lage/gemessen' + q, 8000), mbJson('/zensus/fortgeschrieben' + q, 6000)]);
  const gem = lage && lage.gebiet && lage.gebiet.gemeinde_ags;
  const ms = gem ? await mbJson('/mietspiegel?ags=' + encodeURIComponent(gem), 4000) : null;
  const fe = (lage && lage.felder) || {};
  const d = {
    plz, gebiet: (miete && miete.available && miete.gebiet) || null, gemeinde_eindeutig: !!gem,
    makrolage: kachelAusFeld(fe.makrolage),
    bevoelkerung: kachelAusFeld(fe.ds2_bevoelkerung),
    leerstand: kachelAusFeld(fe.ds2_mietausfall),
    miete: miete && miete.available && miete.qm > 0 ? { qm: miete.qm, ebene: miete.ebene || null, monat: miete.fortgeschrieben_auf || null } : null,
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
