'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   services/vorschau.js — v3600
   VORSCHAU-FUNKTIONEN: auf Prod nur fuer uns sichtbar, fuer alle anderen gesperrt

   Marcel 17.11.2026: „Funktionen, die noch nicht fertig sind, dürfen beim nächsten
   Prod-Rollout nicht für Kunden sichtbar werden.“ Ausblenden allein reicht nicht -
   die Routen antworten 403.

   Die EINE Liste steht in services/vorschau-funktionen.json. Frei ist eine Funktion, wenn
     · sie im Admin › Vorschau „für alle“ freigegeben ist (Tabelle vorschau_freigaben, Migration 111), oder
     · das Konto zu einer Gruppe aus frei_fuer gehoert:
         'admin'           users.role = 'admin'
         'vorschau'        Zusatz 'vorschau' aktiv (Freigabeliste im Admin › Vorschau)
         'zusatz:<name>'   ein anderer Zusatz aktiv (z. B. entwicklungspartner)
   Unbekannter Schluessel = gesperrt (wie bei den Plan-Merkmalen).

   STAGING = PROD (bewusst, v3600): dieselbe Regel auf beiden Servern. Was Staging einem
   Nicht-Admin zeigt, zeigt Prod ihm auch - nur so ist die Sperre auf Staging nachmessbar.
   Testkonten der Agenten bekommen den Zusatz 'vorschau' von ihrem Werkzeug
   (tools/gutachterpartner-testkonto.js), Marcels Konto ist admin.

   Benutzt von: routes/vorschau.js (GET /api/v1/vorschau fuer js/vorschau.js),
   routes/gutachterpartner.js, routes/wuensche.js (router.use(vorschau.sperre(...))),
   services/telegramPdfService.js (dok_vermoegen), routes/adminVorschau.js, tools/vorschau-pruefen.mjs.
   ═══════════════════════════════════════════════════════════════════════ */
const LISTE = require('./vorschau-funktionen.json').funktionen;

const ZUSATZ = 'vorschau';

function eintrag(schluessel) {
  return LISTE.find((e) => e.schluessel === schluessel) || null;
}

/** Reine Entscheidung - ohne Datenbank, damit der Pruefer sie am echten Code misst.
 *  ktx = { role, zusaetze: Set<string> aktiver Zusaetze, fuerAlle: Set<string> Schluessel } */
function entscheiden(schluessel, ktx) {
  const e = eintrag(schluessel);
  if (!e) return { frei: false, grund: 'unbekannt' };
  const k = ktx || {};
  const zus = k.zusaetze || new Set();
  if (k.fuerAlle && k.fuerAlle.has(schluessel)) return { frei: true, grund: 'fuer_alle' };
  for (const g of e.frei_fuer || []) {
    if (g === 'admin' && k.role === 'admin') return { frei: true, grund: 'admin' };
    if (g === 'vorschau' && zus.has(ZUSATZ)) return { frei: true, grund: 'vorschau' };
    if (g.indexOf('zusatz:') === 0 && zus.has(g.slice(7))) return { frei: true, grund: g };
  }
  return { frei: false, grund: 'vorschau_gesperrt' };
}

/* „für alle“-Schalter, 30 s im Speicher. Ohne Tabelle (Migration 111 fehlt): niemand „für alle“. */
let _fa = { zeit: 0, set: new Set() };
async function fuerAlle() {
  if (Date.now() - _fa.zeit < 30000) return _fa.set;
  try {
    const { query } = require('../db/pool');
    const r = await query('SELECT schluessel FROM vorschau_freigaben WHERE fuer_alle = true');
    _fa = { zeit: Date.now(), set: new Set(r.rows.map((x) => x.schluessel)) };
  } catch (e) { _fa = { zeit: Date.now(), set: new Set() }; }
  return _fa.set;
}
function cacheLeeren() { _fa = { zeit: 0, set: new Set() }; }

async function kontext(user) {
  const ktx = { role: user && user.role, zusaetze: new Set(), fuerAlle: await fuerAlle() };
  if (!user || !user.id) return ktx;
  try {
    const { query } = require('../db/pool');
    const r = await query('SELECT zusatz FROM user_zusaetze WHERE user_id = $1 AND aktiv = true', [user.id]);
    r.rows.forEach((x) => ktx.zusaetze.add(x.zusatz));
    /* role steht in req.user; Aufrufer ohne Rolle (Telegram, PDF-Dienst) lesen sie nach */
    if (ktx.role == null) {
      const u = await query('SELECT role FROM users WHERE id = $1', [user.id]);
      ktx.role = u.rows[0] ? u.rows[0].role : null;
    }
  } catch (e) { /* im Zweifel gesperrt */ }
  return ktx;
}

/** Darf dieses Konto die Funktion sehen und benutzen? user = { id, role? } */
async function darf(user, schluessel) {
  return entscheiden(schluessel, await kontext(user)).frei;
}

/** Alle Eintraege fuer dieses Konto: { schluessel: true|false } */
async function fuerKonto(user) {
  const ktx = await kontext(user);
  const out = {};
  LISTE.forEach((e) => { out[e.schluessel] = entscheiden(e.schluessel, ktx).frei; });
  return out;
}

/** Middleware NACH authenticate: 403, solange die Funktion fuer dieses Konto Vorschau ist. */
function sperre(schluessel) {
  if (!eintrag(schluessel)) throw new Error('vorschau.sperre: unbekannter Schluessel ' + schluessel);
  return async function vorschauSperre(req, res, next) {
    try {
      if (await darf(req.user, schluessel)) return next();
    } catch (e) { /* gesperrt */ }
    res.status(403).json({ error: 'Diese Funktion ist noch nicht freigegeben.', code: 'vorschau', funktion: schluessel });
  };
}

async function fuerAlleSetzen(schluessel, an, von) {
  if (!eintrag(schluessel)) throw new Error('unbekannte Vorschau-Funktion: ' + schluessel);
  const { query } = require('../db/pool');
  await query('INSERT INTO vorschau_freigaben (schluessel, fuer_alle, geaendert_von, geaendert_am) VALUES ($1,$2,$3,NOW()) '
    + 'ON CONFLICT (schluessel) DO UPDATE SET fuer_alle = $2, geaendert_von = $3, geaendert_am = NOW()', [schluessel, !!an, von || null]);
  cacheLeeren();
}

module.exports = { LISTE, ZUSATZ, eintrag, entscheiden, kontext, darf, fuerKonto, sperre, fuerAlle, fuerAlleSetzen, cacheLeeren };
