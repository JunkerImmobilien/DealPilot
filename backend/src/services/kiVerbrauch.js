'use strict';
/* ══ v3318 · KI-VERBRAUCH UND MONATSDECKEL ═══════════════════════════════════
 *
 * Marcel 12.11.2026: „ja das sollten wir machen und auch die abrufe begrenzen, dass wir nicht
 * auf die hohen maximalen KI-Kosten kommen koennen ... passende grenzen, dass man max 3-4 euro
 * hat pro monat." Grundlage: Dateien/Architektur/KI-Kosten-je-Kunde-2026-11-12.md.
 *
 * EINE Stelle fuer
 *   - die Preise (USD je Mio Token, Minutenpreise, Websuche) - vorher nur in
 *     voiceExtractService.js (v1259); der Dienst liest sie jetzt von hier,
 *   - das Erfassen je Aufruf (Tabelle ki_verbrauch, Migration 103),
 *   - die Pruefung VOR einem Aufruf (Monatsdeckel in Euro, Monatsgrenzen je Funktion),
 *   - den Co-Pilot-Tageszaehler (ki_tageszaehler, ueberlebt Deploys).
 *
 * WER ZAHLT, WER ZAEHLT: die Anfrage traegt ihren Nutzer. Ein Express-Middleware (index.js, direkt
 * nach express.json) legt je Anfrage einen VORGANG in einen AsyncLocalStorage; die Aufrufstellen
 * (callOpenAI, Vision, Agent, Sprache, Realtime) muessen den Nutzer deshalb nicht durchreichen.
 * Wege ohne req.user (Telegram, WebSocket) setzen ihn mit setzeKontext()/mitKontext().
 *
 * FAIL-SOFT IN EINE RICHTUNG: ein Fehler beim PROTOKOLLIEREN bricht nie den Aufruf (das Insert
 * laeuft entkoppelt, jeder Fehler wird geschluckt). Ein Fehler beim PRUEFEN (DB weg) laesst den
 * Aufruf durch - ein Deckel, der bei einer DB-Stoerung die ganze KI abschaltet, waere teurer als
 * die paar Cent, die er schuetzt.
 * ════════════════════════════════════════════════════════════════════════════ */

const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
const config = require('../config');

let _query = null;
function query(text, params) {
  if (!_query) _query = require('../db/pool').query;
  return _query(text, params);
}
/* nur fuer tools/ki-deckel-pruefen.mjs: eine nachgebaute Datenbank einsetzen */
function _setzeQuery(fn) { _query = fn; _planCache.clear(); }

/* ── Preise ────────────────────────────────────────────────────────────────
   USD je 1 Mio Token. einCached = wiederverwendeter Prompt-Praefix, einAudio = Audio-Eingabe.
   min = USD je Audio-Minute (Transkription ohne Token-Angabe, Realtime).
   Quelle: developers.openai.com/api/docs/pricing, abgerufen 12.11.2026 (KI-Kosten-Bericht Abschnitt 2);
   die Eintraege bis gpt-4o-mini-transcribe stammen aus v1259/v1329 (08.09.2026, je zwei Quellen). */
const PREISE_FEST = {
  'gpt-5.6-luna':           { ein: 0.20, einCached: 0.02,  aus: 1.20 },
  'gpt-5.6-terra':          { ein: 2.00, einCached: 0.20,  aus: 12.00 },
  'gpt-5.5':                { ein: 5.00, einCached: 0.50,  aus: 30.00 },
  'gpt-5.4-mini':           { ein: 0.75, einCached: 0.075, aus: 4.50 },
  'gpt-4.1':                { ein: 2.00, einCached: 0.50,  aus: 8.00 },
  'gpt-4.1-mini':           { ein: 0.40, einCached: 0.10,  aus: 1.60 },
  'gpt-4o-mini':            { ein: 0.15, einCached: 0.075, aus: 0.60 },
  'gpt-4o-transcribe':      { ein: 2.50, einAudio: 6.00, aus: 10.00, min: 0.006 },
  'gpt-4o-mini-transcribe': { ein: 1.25, einAudio: 3.00, aus: 5.00,  min: 0.003 },
  'gpt-realtime-whisper':   { min: 0.017 },
  'whisper-1':              { min: 0.006 }
};
/* Ein Modell OHNE Preis wird zum teuersten Satz gerechnet und als bepreist:false markiert.
   Ein Preis von 0 waere ein Loch im Deckel: der Aufruf saehe gratis aus. */
const PREIS_UNBEKANNT = { ein: 5.00, einCached: 5.00, einAudio: 6.00, aus: 30.00, min: 0.017 };
/* Websuche (web_search_preview) je Suche: Denkmodelle 10 $/1.000, andere 25 $/1.000. */
const WEBSUCHE_USD = { denk: 0.010, standard: 0.025 };

function _istDenkmodell(m) { return /^(gpt-5|o[1-9])/i.test(String(m || '')); }

function preisFuer(modell) {
  let extra = {};
  try { extra = JSON.parse(process.env.OPENAI_PREISE || '{}'); } catch (e) { extra = {}; }
  const m = String(modell || '');
  if (extra[m] || PREISE_FEST[m]) return extra[m] || PREISE_FEST[m];
  /* Datums-Schnappschuss (gpt-4.1-2025-04-14) auf den Grundnamen */
  const grund = m.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  return extra[grund] || PREISE_FEST[grund] || null;
}

function kurs() { return Number((config.ki && config.ki.usdEur) || 0.92); }

/* Zerlegt die Antwort einer OpenAI-Anfrage (Responses, Chat Completions, Transkription) in
   einen Kostenposten. Reine Rechnung, keine Seiteneffekte - der Pruefer rechnet daran nach. */
function postenAus(modell, data, extra) {
  const x = extra || {};
  const u = (data && data.usage) || null;
  const det = (u && (u.input_token_details || u.input_tokens_details || u.prompt_tokens_details)) || {};
  const odet = (u && (u.output_tokens_details || u.completion_tokens_details)) || {};
  const ein = u ? (Number(u.input_tokens != null ? u.input_tokens : (u.prompt_tokens || 0)) || 0) : 0;
  const aus = u ? (Number(u.output_tokens != null ? u.output_tokens : (u.completion_tokens || 0)) || 0) : 0;
  const einAudio = Number(det.audio_tokens || 0) || 0;
  const einCached = Number(det.cached_tokens || 0) || 0;
  const denk = Number(odet.reasoning_tokens || 0) || 0;
  const einText = Math.max(0, ein - einAudio - einCached);
  let sekunden = Number(x.audioSekunden || 0) || 0;
  if (u && u.type === 'duration') sekunden = Number(u.seconds) || sekunden;
  let websuchen = Number(x.websuchen || 0) || 0;
  if (!websuchen && data && Array.isArray(data.output)) {
    websuchen = data.output.filter(function (it) { return it && it.type === 'web_search_call'; }).length;
  }
  const p0 = preisFuer(modell);
  const p = p0 || PREIS_UNBEKANNT;
  let usd = 0;
  if (ein || aus) {
    const satzAudio = (p.einAudio != null) ? p.einAudio : (p.ein || 0);
    /* Kein Cache-Preis hinterlegt: zum vollen Satz - lieber zu hoch als eine Ersparnis behaupten. */
    const satzCached = (p.einCached != null) ? p.einCached : (p.ein || 0);
    usd += (einText * (p.ein || 0) + einAudio * satzAudio + einCached * satzCached + aus * (p.aus || 0)) / 1e6;
  } else if (sekunden > 0) {
    usd += (sekunden / 60) * (p.min != null ? p.min : PREIS_UNBEKANNT.min);
  }
  usd += websuchen * (_istDenkmodell(modell) ? WEBSUCHE_USD.denk : WEBSUCHE_USD.standard);
  const k = kurs();
  const abgeschnitten = !!(data && data.status === 'incomplete' &&
    data.incomplete_details && data.incomplete_details.reason === 'max_output_tokens') ||
    !!(data && Array.isArray(data.choices) && data.choices[0] && data.choices[0].finish_reason === 'length');
  return {
    modell: String(modell || ''), ein, ein_cached: einCached, ein_audio: einAudio, aus, denk,
    websuchen, audio_sek: Math.round(sekunden * 100) / 100,
    usd: Math.round(usd * 1e6) / 1e6, eur: Math.round(usd * k * 1e6) / 1e6, kurs: k,
    bepreist: !!p0, ohne_usage: !u && !sekunden, abgeschnitten
  };
}

/* ── Vorgang (eine Anfrage) ───────────────────────────────────────────────── */
const als = new AsyncLocalStorage();

function neuerVorgang(x) {
  const o = x || {};
  return { vorgang: crypto.randomUUID(), req: o.req || null, userId: o.userId || null,
    endpunkt: o.endpunkt || null, geprueft: false, reserviertFuer: null };
}
function _store() { return als.getStore() || null; }
function userIdAus(s) { return (s && (s.userId || (s.req && s.req.user && s.req.user.id))) || null; }
function endpunktAus(s) {
  if (!s) return null;
  if (s.endpunkt) return s.endpunkt;
  const r = s.req;
  if (!r) return null;
  const pfad = (r.route && typeof r.route.path === 'string') ? r.route.path : (r.path || '');
  return String((r.baseUrl || '') + pfad).replace(/^\/api\/v1\//, '').replace(/^\//, '') || null;
}

/* Express: je Anfrage ein Vorgang. Direkt NACH express.json() einhaengen - der Koerper-Parser
   liest den Strom ueber Ereignisse, die den Kontext sonst verlieren. */
function middleware(req, res, next) {
  const s = neuerVorgang({ req: req });
  const fertig = function () { _freigeben(s); };
  try { res.on('finish', fertig); res.on('close', fertig); } catch (e) {}
  als.run(s, next);
}
/* Setzt Nutzer/Weg im LAUFENDEN Vorgang (Telegram: der Nutzer steht erst nach der Verknuepfung fest). */
function setzeKontext(ctx) {
  const c = ctx || {};
  const s = _store();
  if (!s) { als.enterWith(neuerVorgang(c)); return; }
  if (c.userId) s.userId = c.userId;
  if (c.req && !s.req) s.req = c.req;
  if (c.endpunkt) s.endpunkt = c.endpunkt;
}
/* Eigener Vorgang fuer einen Ablauf ausserhalb einer Anfrage (WebSocket, Hintergrund). */
function mitKontext(ctx, fn) { return als.run(neuerVorgang(ctx), fn); }
function vorgangAktuell() { const s = _store(); return s ? { vorgang: s.vorgang, userId: userIdAus(s), endpunkt: endpunktAus(s) } : null; }

/* ── Einordnung ───────────────────────────────────────────────────────────── */
const GRUPPEN = {
  analyse:   [/^ai\/analyze$/, /offerte/],
  recherche: [/^ai\/(lage|ds2-suggest|qc-suggest|bodenrichtwert|bmf-gaa|enrich-market-fields|quickcheck-analyse)$/, /^unterlagen\//],
  dokument:  [/^ai\/(extract-(expose|paket|dokument|rndg|market-data|beleg)|seiten-lesen|dokumente-auswerten)$/]
};
const GRUPPEN_NAME = { analyse: 'Deal-Analysen', recherche: 'KI-Recherchen', dokument: 'Dokument-Auswertungen' };
function gruppeAus(endpunkt) {
  const e = String(endpunkt || '');
  for (const g of Object.keys(GRUPPEN)) if (GRUPPEN[g].some(function (re) { return re.test(e); })) return g;
  return null;
}
/* Ausserhalb des Deckels: der KI-Marktbericht (eigenes Kontingent, Nachkauf wird bezahlt) und die
   Support-Einstufung (unsere Arbeit, nicht die des Kunden). Erfasst werden beide trotzdem. */
function imDeckel(endpunkt, funktion) {
  const e = String(endpunkt || ''), f = String(funktion || '');
  if (/verlauf-text/.test(e) || /verlauf-text/.test(f)) return true;   /* Begleittext, im Plan, kein Kontingent */
  if (/^marktbericht/.test(e) || /^marktbericht/.test(f)) return false;
  if (/support-einstufung/.test(f)) return false;
  return true;
}

/* ── Erfassen ─────────────────────────────────────────────────────────────── */
let _letzterFehler = null;
function erfassen(p) {
  const o = p || {};
  let posten = null;
  try {
    const s = _store();
    posten = postenAus(o.modell, o.data, o);
    const uid = o.userId !== undefined ? o.userId : userIdAus(s);
    const ep = o.endpunkt || endpunktAus(s);
    const funktion = o.funktion || null;
    const zeile = Object.assign({}, posten, {
      user_id: uid || null, endpunkt: ep, funktion: funktion, gruppe: gruppeAus(ep),
      vorgang: o.vorgang || (s && s.vorgang) || null,
      im_deckel: o.imDeckel != null ? !!o.imDeckel : imDeckel(ep, funktion),
      eigener_schluessel: !!o.eigenerSchluessel, quelle: o.quelle || 'haupt', meta: o.meta || null
    });
    posten.zeile = zeile;
    posten._db = Promise.resolve().then(function () {
      return query(
        'INSERT INTO ki_verbrauch (user_id, endpunkt, funktion, gruppe, vorgang, modell, ein, ein_cached, ein_audio, aus, denk,' +
        ' websuchen, audio_sek, usd, eur, kurs, bepreist, im_deckel, eigener_schluessel, abgeschnitten, quelle, meta)' +
        ' VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)',
        [zeile.user_id, zeile.endpunkt, zeile.funktion, zeile.gruppe, zeile.vorgang, zeile.modell, zeile.ein, zeile.ein_cached,
         zeile.ein_audio, zeile.aus, zeile.denk, zeile.websuchen, zeile.audio_sek, zeile.usd, zeile.eur, zeile.kurs,
         zeile.bepreist, zeile.im_deckel, zeile.eigener_schluessel, zeile.abgeschnitten, zeile.quelle,
         zeile.meta ? JSON.stringify(zeile.meta) : null]);
    }).then(function () { return true; }).catch(function (e) {
      _letzterFehler = e && e.message;
      try { console.warn('[kiVerbrauch] Protokoll fehlgeschlagen:', e && e.message); } catch (x) {}
      return false;
    });
  } catch (e) {
    _letzterFehler = e && e.message;
  }
  return posten;
}

/* Posten, die der mb-Dienst meldet ({ modell, usage, finish }) - gerechnet mit DIESER Preisliste.
   Gibt die Summe in Euro zurueck (fuer marktbericht_cost_log.openai_eur). */
function erfasseFremdPosten(liste, o) {
  const x = o || {};
  let eur = 0;
  (Array.isArray(liste) ? liste : []).forEach(function (p) {
    if (!p) return;
    const pz = erfassen({ funktion: x.funktion || 'marktbericht', modell: p.modell, quelle: 'mb',
      data: { usage: p.usage || null, choices: [{ finish_reason: p.finish || null }] },
      userId: x.userId, endpunkt: x.endpunkt });
    if (pz) eur += pz.eur;
  });
  return Math.round(eur * 1e6) / 1e6;
}

/* ── Plan, Deckel, Stand ──────────────────────────────────────────────────── */
const _planCache = new Map();   /* uid -> { t, art, plan } · 60 s */
async function _kontoArt(uid) {
  const c = _planCache.get(uid);
  if (c && Date.now() - c.t < 60000) return c;
  let art = 'kunde', plan = 'free';
  const u = await query('SELECT role, is_test_user FROM users WHERE id = $1', [uid]);
  const row = u.rows && u.rows[0];
  if (row && row.role === 'admin') art = 'admin';
  else if (row && row.is_test_user) art = 'test';
  try {
    const ep = await require('./subscriptionService').getEffectivePlan(uid);
    if (ep && ep.plan_id) plan = String(ep.plan_id);
    if (ep && ep.trial && art === 'kunde') art = 'testphase';
  } catch (e) { /* im Zweifel free */ }
  const r = { t: Date.now(), art: art, plan: plan };
  _planCache.set(uid, r);
  if (_planCache.size > 5000) _planCache.clear();
  return r;
}
function _deckelFuer(k) {
  const d = (config.ki && config.ki.deckelEur) || {};
  const schluessel = (k.art === 'kunde') ? k.plan : k.art;
  if (Object.prototype.hasOwnProperty.call(d, schluessel)) return d[schluessel];
  return Object.prototype.hasOwnProperty.call(d, k.plan) ? d[k.plan] : d.free;
}
function _grenzenFuer(k) {
  if (k.art === 'admin' || k.art === 'test') return null;
  const g = (config.ki && config.ki.monatsgrenzen) || {};
  return g[k.art === 'testphase' ? 'testphase' : k.plan] || g.free || null;
}
const MONAT_SQL = "(date_trunc('month', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')";

function naechsterMonatText() {
  const jetzt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const n = new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 1);
  return '1. ' + n.toLocaleDateString('de-DE', { month: 'long' });
}
function naechsterMonatIso() {
  const jetzt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const n = new Date(Date.UTC(jetzt.getFullYear(), jetzt.getMonth() + 1, 1));
  return n.toISOString().slice(0, 10);
}

/* Laufende, bereits gepruefte Vorgaenge je Nutzer (dieser Prozess). */
const _offen = new Map();
function _reservieren(s, uid) {
  if (!s || s.reserviertFuer) return;
  s.reserviertFuer = uid;
  _offen.set(uid, (_offen.get(uid) || 0) + 1);
}
function _freigeben(s) {
  if (!s || !s.reserviertFuer) return;
  const uid = s.reserviertFuer; s.reserviertFuer = null;
  const n = (_offen.get(uid) || 1) - 1;
  if (n > 0) _offen.set(uid, n); else _offen.delete(uid);
}

async function stand(uid, opts) {
  const o = opts || {};
  const k = await _kontoArt(uid);
  const deckel = _deckelFuer(k);
  const r = await query(
    'SELECT COALESCE(SUM(eur),0) AS eur FROM ki_verbrauch WHERE user_id = $1 AND im_deckel AND NOT eigener_schluessel AND ts >= ' + MONAT_SQL,
    [uid]);
  const verbraucht = Number((r.rows[0] || {}).eur) || 0;
  const offen = o.ohneOffen ? 0 : (_offen.get(uid) || 0);
  const reserve = offen * Number((config.ki && config.ki.reserveEur) || 0);
  const out = {
    art: k.art, plan: k.plan, deckel_eur: deckel, verbraucht_eur: Math.round(verbraucht * 1e4) / 1e4,
    offen: offen, ausgenommen: deckel == null,
    anteil_pct: deckel == null ? null : (deckel > 0 ? Math.min(100, Math.round(verbraucht / deckel * 1000) / 10) : 100),
    zurueck_am: naechsterMonatIso(), gesperrt: false, grund: null
  };
  if (deckel != null && verbraucht + reserve >= deckel) { out.gesperrt = true; out.grund = 'deckel'; return out; }
  const gruppe = o.endpunkt ? gruppeAus(o.endpunkt) : null;
  const grenzen = _grenzenFuer(k);
  if (gruppe && grenzen && grenzen[gruppe] != null) {
    const g = await query(
      'SELECT COUNT(DISTINCT vorgang) AS n FROM ki_verbrauch WHERE user_id = $1 AND gruppe = $2 AND NOT eigener_schluessel' +
      ' AND ts >= ' + MONAT_SQL + (o.ohneVorgang ? ' AND vorgang IS DISTINCT FROM $3' : ''),
      o.ohneVorgang ? [uid, gruppe, o.ohneVorgang] : [uid, gruppe]);
    const n = Number((g.rows[0] || {}).n) || 0;
    out.gruppe = gruppe; out.gruppe_anzahl = n; out.gruppe_limit = grenzen[gruppe];
    if (n >= grenzen[gruppe]) { out.gesperrt = true; out.grund = 'gruppe'; }
  }
  return out;
}

function kontingentFehler(st) {
  const ab = naechsterMonatText();
  const msg = st.grund === 'gruppe'
    ? 'Deine ' + (GRUPPEN_NAME[st.gruppe] || 'KI-Aufrufe') + ' für diesen Monat sind aufgebraucht (' + st.gruppe_anzahl + ' von ' +
      st.gruppe_limit + '). Ab dem ' + ab + ' wieder verfügbar.'
    : 'Dein KI-Kontingent für diesen Monat ist aufgebraucht. Ab dem ' + ab + ' ist es wieder verfügbar.';
  const e = new Error(msg);
  e.code = 'KI_KONTINGENT';
  e.status = 429; e.statusCode = 429;
  e.kiStand = st;
  return e;
}

/* VOR jedem Aufruf. Wirft KI_KONTINGENT (429). Je Vorgang nur einmal: eine Agent-Runde oder ein
   Reparaturlauf mitten in einer Antwort wird nicht abgeschnitten, nur die naechste Anfrage. */
async function vorAufruf(opts) {
  const o = opts || {};
  if (o.eigenerSchluessel) return null;
  const s = _store();
  const uid = o.userId || userIdAus(s);
  if (!uid) return null;
  const ep = o.endpunkt || endpunktAus(s);
  if (!imDeckel(ep, o.funktion)) return null;
  if (s && s.geprueft) return null;
  let st;
  try { st = await stand(uid, { endpunkt: ep, ohneVorgang: s && s.vorgang }); }
  catch (e) { try { console.warn('[kiVerbrauch] Pruefung nicht moeglich, Aufruf laeuft:', e.message); } catch (x) {} return null; }
  if (st.gesperrt) throw kontingentFehler(st);
  if (s) { s.geprueft = true; _reservieren(s, uid); }
  return st;
}

/* Fuer Routen: dieselbe Pruefung als Antwort statt als Ausnahme. */
function antwortBeiSperre(res, e) {
  if (!e || e.code !== 'KI_KONTINGENT') return false;
  res.status(429).json({ error: e.message, message: e.message, code: 'KI_KONTINGENT',
    ki_monat: e.kiStand ? { anteil_pct: e.kiStand.anteil_pct, zurueck_am: e.kiStand.zurueck_am, grund: e.kiStand.grund } : null });
  return true;
}

/* Anzeige fuer den Nutzer: nur der Anteil, kein Euro-Betrag. */
async function monatAnzeige(uid) {
  try {
    const st = await stand(uid, { ohneOffen: true });
    return { anteil_pct: st.anteil_pct, ausgenommen: st.ausgenommen, gesperrt: st.gesperrt, zurueck_am: st.zurueck_am };
  } catch (e) { return null; }
}

/* ── Co-Pilot-Tageszaehler (persistent) ─────────────────────────────────────
   Berliner Kalendertag. Ersetzt die Map _cpDaily in routes/ai.js. */
const TAG_SQL = "(now() AT TIME ZONE 'Europe/Berlin')::date";
async function tagStand(uid) {
  const r = await query('SELECT copilot, sprache_s FROM ki_tageszaehler WHERE user_id = $1 AND tag = ' + TAG_SQL, [uid]);
  const z = r.rows[0] || {};
  return { copilot: Number(z.copilot) || 0, sprache_s: Number(z.sprache_s) || 0 };
}
async function tagErhoehen(uid, fragen, sekunden) {
  await query(
    'INSERT INTO ki_tageszaehler (user_id, tag, copilot, sprache_s) VALUES ($1, ' + TAG_SQL + ', $2, $3)' +
    ' ON CONFLICT (user_id, tag) DO UPDATE SET copilot = ki_tageszaehler.copilot + EXCLUDED.copilot,' +
    ' sprache_s = ki_tageszaehler.sprache_s + EXCLUDED.sprache_s, updated_at = now()',
    [uid, Math.max(0, fragen | 0), Math.max(0, sekunden | 0)]);
}
/* Fragen und Zaehlen in EINEM Schritt (Telegram, Flow): nur wenn noch Platz ist. */
async function tagVerbrauchen(uid, limit) {
  await query('INSERT INTO ki_tageszaehler (user_id, tag) VALUES ($1, ' + TAG_SQL + ') ON CONFLICT (user_id, tag) DO NOTHING', [uid]);
  const r = await query(
    'UPDATE ki_tageszaehler SET copilot = copilot + 1, updated_at = now() WHERE user_id = $1 AND tag = ' + TAG_SQL +
    ' AND copilot < $2 RETURNING copilot', [uid, limit]);
  if (r.rows && r.rows.length) return { ok: true, benutzt: Number(r.rows[0].copilot) };
  const st = await tagStand(uid);
  return { ok: false, benutzt: st.copilot };
}

module.exports = {
  PREISE_FEST, WEBSUCHE_USD, PREIS_UNBEKANNT, preisFuer, postenAus, kurs,
  middleware, setzeKontext, mitKontext, vorgangAktuell, neuerVorgang,
  gruppeAus, imDeckel, erfassen, erfasseFremdPosten, vorAufruf, stand, monatAnzeige, antwortBeiSperre, kontingentFehler,
  tagStand, tagErhoehen, tagVerbrauchen,
  _setzeQuery, _letzterFehler: function () { return _letzterFehler; }, _offen
};
