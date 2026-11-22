'use strict';
/* services/vivi/viviClient.js — v3950 · HTTP gegen die ViVi-API v1 (Spezifikation v1.5.0)
 *
 * Quelle der Pfade und Felder: Dateien/Architektur/vivi/vivi-openapi-v1.json (aus dem eingeloggten Konto
 * gesichert am 22.11.2026). Basis https://app.vivi-immo.de/api/v1, Anmeldung Bearer.
 *
 * ── MARCELS REGEL, TECHNISCH ──────────────────────────────────────────────
 * Ein Objekt wird genau EINMAL angelegt, danach wird nur gelesen. Dieser Client kennt deshalb genau zwei
 * Methoden: get() und post(). post() nimmt nur Pfade, die auf ANLEGEN_PFADE passen. PUT, PATCH und DELETE
 * gibt es hier nicht, auch nicht als Parameter: die Methode steht fest im Code der beiden Funktionen.
 * tools/vivi-pruefen.mjs wird rot, sobald in services/vivi/ oder routes/vivi.js eine andere Methode auftaucht.
 *
 * ── ANFRAGEBREMSE ─────────────────────────────────────────────────────────
 * ViVi erlaubt 60 Anfragen je Minute. Wir bleiben bei hoechstens 50 je Token (gleitendes Fenster von 60 s,
 * im Arbeitsspeicher, Schluessel ist ein Hash des Tokens, nie der Token selbst). Ist das Fenster voll, wartet
 * der Client bis zu opt.maxWarten ms auf einen freien Platz, sonst bricht er mit code 'bremse_lokal' ab.
 * Antwortet ViVi mit 429, bricht er SOFORT ab (code 'bremse_429'), ohne Wiederholung. Der Aufrufer beendet
 * dann die Runde.
 *
 * Der Token erscheint in keiner Fehlermeldung und in keinem Protokoll.
 */
const crypto = require('crypto');

const BASIS = 'https://app.vivi-immo.de/api/v1';
const MAX_JE_MINUTE = 50;
const FENSTER_MS = 60 * 1000;
const ZEIT_MS = 20 * 1000;

/* Die einzigen Pfade, an die DealPilot etwas schickt: Anlegen von Objekt, Einheit, Mietverhaeltnis, Darlehen. */
const ANLEGEN_PFADE = Object.freeze([
  /^\/projects$/,
  /^\/projects\/[A-Za-z0-9_-]+\/units$/,
  /^\/projects\/[A-Za-z0-9_-]+\/rental-units$/,
  /^\/projects\/[A-Za-z0-9_-]+\/financings$/
]);

const _fenster = new Map();   // tokenHash -> [Zeitpunkte]

function _hash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16); }
function _schlafen(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function fehler(code, text, extra) {
  const e = new Error(text);
  e.code = code;
  if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
  return e;
}

/**
 * Ein Client je Token und Lauf. opt (nur zum Pruefen): fetch, basis, jetzt, schlafen, maxWarten.
 * zaehler.anfragen zaehlt jede Anfrage dieses Clients, zaehler.bremse429 wird bei 429 gesetzt.
 */
function erzeugen(token, opt) {
  if (!token || typeof token !== 'string') throw fehler('kein_token', 'Kein ViVi-Token hinterlegt');
  opt = opt || {};
  const holen = opt.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!holen) throw fehler('kein_fetch', 'fetch fehlt in dieser Laufzeit');
  const basis = opt.basis || BASIS;
  const jetzt = opt.jetzt || Date.now;
  const schlafen = opt.schlafen || _schlafen;
  const maxWarten = opt.maxWarten == null ? 15000 : opt.maxWarten;
  const schluessel = _hash(token);
  const zaehler = { anfragen: 0, bremse429: false };

  async function platz() {
    let gewartet = 0;
    for (;;) {
      const t = jetzt();
      const liste = (_fenster.get(schluessel) || []).filter(function (x) { return t - x < FENSTER_MS; });
      if (liste.length < MAX_JE_MINUTE) { liste.push(t); _fenster.set(schluessel, liste); return; }
      const warte = FENSTER_MS - (t - liste[0]) + 5;
      if (gewartet + warte > maxWarten) {
        _fenster.set(schluessel, liste);
        throw fehler('bremse_lokal', 'Anfragebremse: mehr als ' + MAX_JE_MINUTE + ' Anfragen je Minute. Bitte kurz warten.');
      }
      gewartet += warte;
      await schlafen(warte);
    }
  }

  function url(pfad, abfrage) {
    let u = basis + pfad;
    const q = [];
    Object.keys(abfrage || {}).forEach(function (k) {
      const v = abfrage[k];
      if (v !== undefined && v !== null && v !== '') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    if (q.length) u += (u.indexOf('?') >= 0 ? '&' : '?') + q.join('&');
    return u;
  }

  async function senden(methode, pfad, abfrage, rumpf) {
    if (zaehler.bremse429) throw fehler('bremse_429', 'ViVi hat die Anfragebremse gemeldet (429). Diese Runde ist beendet.');
    await platz();
    zaehler.anfragen++;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const uhr = ctl ? setTimeout(function () { ctl.abort(); }, ZEIT_MS) : null;
    let r;
    try {
      r = await holen(url(pfad, abfrage), {
        method: methode,
        headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' },
          rumpf ? { 'Content-Type': 'application/json' } : {}),
        body: rumpf ? JSON.stringify(rumpf) : undefined,
        signal: ctl ? ctl.signal : undefined
      });
    } catch (e) {
      throw fehler('netz', 'ViVi nicht erreichbar (' + (e && e.name === 'AbortError' ? 'Zeitüberschreitung' : 'Netzwerk') + ')');
    } finally { if (uhr) clearTimeout(uhr); }
    let daten = null;
    try { daten = await r.json(); } catch (e) { daten = null; }
    if (r.status === 429) { zaehler.bremse429 = true; throw fehler('bremse_429', 'ViVi hat die Anfragebremse gemeldet (429). Diese Runde ist beendet.', { status: 429 }); }
    if (r.status === 401 || r.status === 403) throw fehler('nicht_berechtigt', r.status === 401 ? 'ViVi lehnt den Token ab (401).' : 'Der Token darf das nicht (403). Schreibrecht zum Anlegen bei ViVi anfragen.', { status: r.status });
    if (r.status === 404) throw fehler('nicht_gefunden', 'ViVi kennt diesen Eintrag nicht (404).', { status: 404 });
    if (r.status === 422) throw fehler('ungueltig', 'ViVi hat die Angaben abgelehnt (422).', { status: 422, details: daten && (daten.errors || daten.message) || null });
    if (r.status < 200 || r.status >= 300) throw fehler('vivi_fehler', 'ViVi antwortet mit ' + r.status + '.', { status: r.status });
    return daten;
  }

  /** Nur lesen. pfad z. B. '/projects', abfrage z. B. { account_id }. */
  function get(pfad, abfrage) { return senden('GET', pfad, abfrage, null); }

  /** Nur anlegen, nur an die Pfade aus ANLEGEN_PFADE. */
  function post(pfad, rumpf, abfrage) {
    if (!ANLEGEN_PFADE.some(function (re) { return re.test(pfad); })) {
      return Promise.reject(fehler('pfad_gesperrt', 'Dieser ViVi-Pfad ist zum Senden nicht freigegeben: ' + pfad));
    }
    return senden('POST', pfad, abfrage, rumpf || {});
  }

  return { get: get, post: post, zaehler: zaehler };
}

/** nur fuer tools/vivi-pruefen.mjs */
function _fensterLeeren() { _fenster.clear(); }

module.exports = { erzeugen, fehler, ANLEGEN_PFADE, BASIS, MAX_JE_MINUTE, FENSTER_MS, _fensterLeeren };
