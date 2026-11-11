'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/kostenFreigabe.js — v3296 · Flow Investor, Punkt 6: Freigabe fuer kostenpflichtige Stufen
 *
 *   1. POST /kosten/anfrage { art | stufe, objekt_id }  -> { preis, kontingent_rest, freigabe_noetig, token }
 *   2. freigabe_noetig: der Hub (Knopf) oder Telegram holt das Ja des Nutzers ->
 *      POST /kosten/freigeben { token }
 *   3. Bericht mit kosten_token (routes/marktbericht.js runReport). Ohne gueltigen Token 402.
 *
 * Regel aus profil.freigaben (flowProfil, Punkt 3; Marcel 11.11.2026 „automatische Kosten ja, aber
 * gezielt genehmigen"):
 *   auto   ohne Rueckfrage, solange die automatisch freigegebenen Betraege des Monats plus dieser
 *          die monatsgrenze_eur nicht uebersteigen - darueber wird gefragt
 *   frage  immer Rueckfrage (Voreinstellung)
 *   nie    gesperrt
 * Schon bezahlte Tiefe (Differenzregel des Marktberichts) kostet nichts und braucht keine Freigabe.
 * Ist das Kontingent der Art leer, hilft keine Freigabe: kontingent_leer, kein Token.
 *
 * Der Telegram-Bot geht denselben Weg: nach dem Ja des Nutzers legt marktbericht_abrufen eine Anfrage
 * an, gibt sie mit „telegram" frei und loest den Token beim Abruf ein. Steht das Profil auf „nie",
 * ruft auch der Bot nicht ab.
 *
 * Preise je Bewertung (EUR): Spiegel von frontend/js/config.js EINZELKAUF - tools/kosten-freigabe-pruefen.mjs
 * vergleicht beide. Sie sind der Massstab fuer die Monatsgrenze, abgebucht wird weiter das Kontingent.
 * ═══════════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const { query } = require('../db/pool');

const PREIS_EUR = { mpi: 0.90, mpi_plus: 1.90, wev: 3.90 };
const STUFE_ART = { 1: 'mpi', 2: 'mpi_plus', 3: 'wev' };
const ART_STUFE = { mpi: 1, mpi_plus: 2, wev: 3 };
const NAME = { mpi: 'Marktpreisindikation', mpi_plus: 'Erweiterte Marktpreisindikation', wev: 'Wertermittlung nach ImmoWertV' };
const GUELTIG_MIN = 60 * 24;   /* ein Token gilt 24 Stunden */

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function neuerToken() { return 'dpkt_' + crypto.randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

/**
 * entscheiden(e) — rein. e = { regel: auto|frage|nie, kostet, preis, monatSummeAuto, grenze, rest }
 * -> { status: frei|wartet|gesperrt|kontingent_leer, freigabe: auto|null, grund }
 */
function entscheiden(e) {
  if (!e.kostet) return { status: 'frei', freigabe: null, grund: 'Diese Tiefe ist für das Objekt schon bezahlt - es wird nichts verbraucht.' };
  if (e.regel === 'nie') return { status: 'gesperrt', freigabe: null, grund: 'Im Profil ist diese Stufe auf „nie“ gestellt.' };
  if (e.rest != null && e.rest < 1) return { status: 'kontingent_leer', freigabe: null, grund: 'Das Kontingent für diese Bewertung ist aufgebraucht.' };
  if (e.regel === 'auto') {
    const g = Number(e.grenze) || 0;
    if (g > 0 && (Number(e.monatSummeAuto) || 0) + (Number(e.preis) || 0) <= g + 1e-9) {
      return { status: 'frei', freigabe: 'auto', grund: 'Automatisch freigegeben (Monatsgrenze ' + g.toFixed(2).replace('.', ',') + ' €).' };
    }
    return { status: 'wartet', freigabe: null, grund: 'Die Monatsgrenze der automatischen Freigabe wäre überschritten - bitte bestätigen.' };
  }
  return { status: 'wartet', freigabe: null, grund: 'Kostenpflichtig - bitte bestätigen.' };
}

async function _monatSummeAuto(userId) {
  const r = await query(
    "SELECT COALESCE(SUM(preis_eur),0)::float AS s FROM kosten_freigaben WHERE user_id=$1 AND freigabe='auto' "
    + "AND status IN ('frei','verbraucht') AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'",
    [userId]);
  return r.rows[0].s || 0;
}

/** Was wuerde der Abruf kosten? Ueber dieselbe Route wie der Bot (telegramMarktService.voranschlag -> /marktbericht/stufenpreis). */
async function _voranschlag(userId, objektRef, stufe) {
  const markt = require('./telegramMarktService');
  if (objektRef) return markt.voranschlag(userId, objektRef, stufe);
  /* ohne Objekt: immer die volle Stufe, Bestand aus dem Kontingent */
  const st = await require('./aiCreditsService').getStatus(userId);
  const a = st && st.arten && st.arten[STUFE_ART[stufe]];
  return { moeglich: true, stufe: stufe, art: STUFE_ART[stufe], verbraucht_einen_abruf: true, bestand: a ? a.rest : null };
}

/**
 * anfrage(userId, { art|stufe, objekt_id, kanal }) -> Antwort von POST /kosten/anfrage
 * opts.voranschlag (nur Pruefer) ersetzt den Weg ueber die Route.
 */
async function anfrage(userId, b, opts) {
  b = b || {}; opts = opts || {};
  let stufe = parseInt(b.stufe, 10);
  if (!(stufe >= 1 && stufe <= 3)) stufe = ART_STUFE[b.art] || 0;
  if (!stufe) return { ok: false, status: 400, fehler: 'art muss mpi, mpi_plus oder wev sein (oder stufe 1-3).' };
  const art = STUFE_ART[stufe];
  const objektRef = b.objekt_id ? String(b.objekt_id) : null;
  if (objektRef) {
    const o = await query('SELECT 1 FROM objects WHERE id=$1 AND user_id=$2', [objektRef, userId]);
    if (!o.rowCount) return { ok: false, status: 404, fehler: 'Objekt nicht gefunden.' };
  }
  const v = opts.voranschlag ? await opts.voranschlag(userId, objektRef, stufe) : await _voranschlag(userId, objektRef, stufe);
  if (!v || !v.moeglich) return { ok: false, status: 502, fehler: 'Der Preis ließ sich gerade nicht ermitteln.' };
  const kostet = !!v.verbraucht_einen_abruf;
  const preis = kostet ? PREIS_EUR[art] : 0;
  const profil = await require('./flowProfil').lesen(userId);
  const regel = (profil.freigaben && profil.freigaben[art]) || 'frage';
  const e = entscheiden({ regel, kostet, preis, monatSummeAuto: regel === 'auto' ? await _monatSummeAuto(userId) : 0,
    grenze: profil.freigaben && profil.freigaben.monatsgrenze_eur, rest: v.bestand });
  const antwort = {
    ok: true, art: art, stufe: stufe, name: NAME[art], objekt_id: objektRef,
    preis: preis, preis_einheit: 'EUR je Bewertung (Einzelpreis; abgebucht wird 1 Bewertung aus dem Kontingent)',
    kostet: kostet, kontingent_rest: v.bestand != null ? v.bestand : null,
    regel: regel, freigabe_noetig: e.status === 'wartet', status: e.status, grund: e.grund, token: null
  };
  if (e.status === 'gesperrt' || e.status === 'kontingent_leer') return antwort;
  const token = neuerToken();
  await query(
    `INSERT INTO kosten_freigaben (user_id, token_hash, art, stufe, objekt_ref, preis_eur, kostet, freigabe, status, kanal, frei_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $9 = 'frei' THEN NOW() ELSE NULL END, NOW() + ($11 || ' minutes')::interval)`,
    [userId, sha256(token), art, stufe, objektRef, preis, kostet, e.freigabe, e.status, b.kanal || 'api', String(GUELTIG_MIN)]);
  antwort.token = token;
  antwort.gueltig_bis = new Date(Date.now() + GUELTIG_MIN * 60000).toISOString();
  return antwort;
}

/** Der Nutzer gibt frei (Knopf im Hub, Ja in Telegram). wartet -> frei. */
async function freigeben(userId, token, wie) {
  const r = await query(
    "UPDATE kosten_freigaben SET status='frei', freigabe=COALESCE(freigabe, $3), frei_at=NOW() "
    + "WHERE user_id=$1 AND token_hash=$2 AND status IN ('wartet','frei') AND expires_at > NOW() RETURNING art, stufe, objekt_ref, preis_eur",
    [userId, sha256(token || ''), wie || 'nutzer']);
  return r.rowCount ? { ok: true, status: 'frei', art: r.rows[0].art, stufe: r.rows[0].stufe, objekt_id: r.rows[0].objekt_ref }
    : { ok: false, fehler: 'Token unbekannt, abgelaufen oder schon verbraucht.' };
}
async function ablehnen(userId, token) {
  const r = await query("UPDATE kosten_freigaben SET status='abgelehnt' WHERE user_id=$1 AND token_hash=$2 AND status IN ('wartet','frei') RETURNING id",
    [userId, sha256(token || '')]);
  return { ok: r.rowCount > 0 };
}

/**
 * einloesen(userId, token, { stufe, objekt_ref }) — vor dem Abruf, atomar frei -> verbraucht.
 * Passt der Token nicht zu Stufe und Objekt, bleibt er unberuehrt.
 */
async function einloesen(userId, token, soll) {
  if (!token) return { ok: false, code: 'KOSTEN_TOKEN_FEHLT',
    meldung: 'Dieser Abruf kostet eine Bewertung aus dem Kontingent und braucht eine Freigabe: zuerst POST /api/v1/kosten/anfrage, '
      + 'bei freigabe_noetig die Freigabe des Nutzers (POST /api/v1/kosten/freigeben), dann den Bericht mit kosten_token aufrufen.' };
  const r = await query(
    "UPDATE kosten_freigaben SET status='verbraucht', verbraucht_at=NOW() WHERE user_id=$1 AND token_hash=$2 AND status='frei' "
    + "AND expires_at > NOW() AND stufe=$3 AND COALESCE(objekt_ref,'') = COALESCE($4,'') RETURNING id",
    [userId, sha256(token), soll.stufe, soll.objekt_ref ? String(soll.objekt_ref) : null]);
  if (r.rowCount) return { ok: true, id: r.rows[0].id };
  const w = await query('SELECT status, stufe, objekt_ref, expires_at > NOW() AS gilt FROM kosten_freigaben WHERE user_id=$1 AND token_hash=$2', [userId, sha256(token)]);
  if (!w.rowCount) return { ok: false, code: 'KOSTEN_TOKEN_UNGUELTIG', meldung: 'Der kosten_token ist unbekannt.' };
  const z = w.rows[0];
  if (z.status === 'wartet') return { ok: false, code: 'KOSTEN_FREIGABE_FEHLT', meldung: 'Die Freigabe des Nutzers fehlt noch (POST /api/v1/kosten/freigeben).' };
  if (z.status !== 'frei') return { ok: false, code: 'KOSTEN_TOKEN_VERBRAUCHT', meldung: 'Der kosten_token ist schon verbraucht oder abgelehnt.' };
  if (!z.gilt) return { ok: false, code: 'KOSTEN_TOKEN_ABGELAUFEN', meldung: 'Der kosten_token ist abgelaufen - bitte neu anfragen.' };
  return { ok: false, code: 'KOSTEN_TOKEN_PASST_NICHT', meldung: 'Der kosten_token gilt für Stufe ' + z.stufe + (z.objekt_ref ? ' und ein anderes Objekt' : '') + ', nicht für diesen Abruf.' };
}
/** Abruf gescheitert: Token wieder frei geben (es wurde nichts abgebucht). */
async function zurueck(id) {
  try { await query("UPDATE kosten_freigaben SET status='frei', verbraucht_at=NULL WHERE id=$1 AND status='verbraucht'", [id]); } catch (e) {}
}

/** Braucht dieser Aufruf einen Token? Schluessel mit Bereich flow immer, sonst nur, wer einen schickt. */
function tokenPflicht(req, token) {
  return !!(req && req.apiKey && /(^|\s|,)flow($|\s|,)/.test(String(req.apiKey.scopes || ''))) || !!token;
}

module.exports = { anfrage, freigeben, ablehnen, einloesen, zurueck, entscheiden, tokenPflicht, PREIS_EUR, STUFE_ART, NAME };
