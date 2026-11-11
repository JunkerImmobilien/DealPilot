'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/immometricaFlow.js — v3298 · Flow Investor, Punkt 4
 * ImmoMetrica-Staende speichern, Preissenkungen und Zielpreise melden.
 *
 *   · stand(raw) / erkennen(alt, neu, opt)  rein - die Erkennung (neu, preis_gesenkt,
 *     unter_zielpreis, offline, wieder_online), geprueft von tools/immometrica-flow-pruefen.mjs
 *   · lauf(userId)  ein Abruf je Suche des Nutzers: beim ersten Mal nur Grundstand (keine
 *     Ereignisse, sonst waere jeder Treffer „neu"), danach inkrementell ueber die Filter, die
 *     der Support empfiehlt (offer_id_gt, last_modified_after, offline_date_after, reactivated_after).
 *     Kontingent: gezaehlt wird jedes EINDEUTIGE Objekt je Monat und Land; erneut abgerufene kosten
 *     nichts (immometricaService.js v3168).
 *   · Ereignisse -> Tabelle immometrica_ereignisse und Webhook an den Hub (maklerHubService.ereignis,
 *     HMAC wie verbindung.getrennt); GET /immometrica/ereignisse?seit= zum Nachholen.
 *   · Ist der Treffer ein DealPilot-Objekt (data._immometrica_id), wird verknuepft (objekt_id) und der
 *     Preis am Objekt bekommt eine Preishistorie (data._preishistorie).
 *
 * DER REGELMAESSIGE JOB IST AUS: starten() tut nur etwas mit FLOW_IMMOMETRICA_JOB=an
 * (Auftrag 11.11.2026: erst Kontingentbelastung messen, dann freigeben).
 * Keine Kontaktdaten: gespeichert werden Id, Preis, Flaeche, Titel, Link, Online-Status.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { query } = require('../db/pool');

function _zahl(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

/** Der Stand eines Treffers - nur die Felder, die gemeldet werden. */
function stand(raw) {
  const r = raw || {};
  const pl = Array.isArray(r.platforms) ? r.platforms : [];
  const link = (pl.find((p) => p && p.url && p.active !== false) || pl.find((p) => p && p.url) || {}).url || null;
  const online = !r.offline_since && (pl.length ? pl.some((p) => p && p.active !== false) : true);
  return {
    offer_id: r.id != null ? String(r.id) : null,
    preis: _zahl(r.buying_price), flaeche: _zahl(r.living_space),
    titel: r.title ? String(r.title).slice(0, 200) : null, link: link, online: online
  };
}

/**
 * erkennen(alt, neu, opt) — rein. alt: gespeicherter Stand oder null, neu: stand(raw).
 * opt.alarme { preissenkung_pct, unter_zielpreis }, opt.zielpreis (Zahl oder null), opt.grundstand (erster Lauf)
 * -> [{ art, preis_alt, preis_neu, senkung_pct, zielpreis }]
 */
function erkennen(alt, neu, opt) {
  opt = opt || {};
  const a = opt.alarme || {};
  const aus = [];
  if (!neu || !neu.offer_id) return aus;
  if (!alt) {
    if (opt.grundstand) return aus;
    aus.push({ art: 'neu', preis_alt: null, preis_neu: neu.preis });
  } else {
    if (alt.online && !neu.online) aus.push({ art: 'offline', preis_alt: alt.preis, preis_neu: neu.preis });
    if (!alt.online && neu.online) aus.push({ art: 'wieder_online', preis_alt: alt.preis, preis_neu: neu.preis });
    if (alt.preis > 0 && neu.preis > 0 && neu.preis < alt.preis) {
      const pct = Math.round((1 - neu.preis / alt.preis) * 10000) / 100;
      const schwelle = _zahl(a.preissenkung_pct);
      if (schwelle == null || pct >= schwelle) aus.push({ art: 'preis_gesenkt', preis_alt: alt.preis, preis_neu: neu.preis, senkung_pct: pct });
    }
  }
  const z = _zahl(opt.zielpreis);
  if (a.unter_zielpreis === true && z > 0 && neu.preis > 0 && neu.preis <= z && !(alt && alt.preis > 0 && alt.preis <= z)) {
    aus.push({ art: 'unter_zielpreis', preis_alt: alt ? alt.preis : null, preis_neu: neu.preis, zielpreis: z });
  }
  return aus;
}

/* ── Datenbank und Lauf ─────────────────────────────────────────────── */
async function _zielpreisFuer(userId, offerId, profil) {
  const r = await query("SELECT id, data->'_flow_berechnung'->'quickcheck'->>'zielpreis' AS zp FROM objects WHERE user_id=$1 AND data->>'_immometrica_id' = $2 LIMIT 1", [userId, String(offerId)]);
  const objektId = r.rowCount ? r.rows[0].id : null;
  let zp = r.rowCount ? _zahl(r.rows[0].zp) : null;
  if (zp == null && profil && profil.ziele && profil.ziele.max_kaufpreis > 0) zp = profil.ziele.max_kaufpreis;
  return { objektId, zielpreis: zp };
}

async function _preishistorie(userId, objektId, preis, alt) {
  if (!objektId || !(preis > 0)) return;
  const eintrag = JSON.stringify([{ am: new Date().toISOString(), preis: preis, vorher: alt || null, quelle: 'immometrica' }]);
  await query(
    `UPDATE objects SET data = jsonb_set(COALESCE(data,'{}'::jsonb), '{_preishistorie}', COALESCE(data->'_preishistorie','[]'::jsonb) || $3::jsonb, true),
            version = version + 1, updated_at = NOW()
      WHERE id = $1 AND user_id = $2`, [objektId, userId, eintrag]);
}

async function _ereignisSpeichern(userId, sucheId, s, e, objektId) {
  const r = await query(
    `INSERT INTO immometrica_ereignisse (user_id, art, suche_id, offer_id, objekt_id, titel, link, preis_alt, preis_neu, senkung_pct, zielpreis)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, at`,
    [userId, e.art, sucheId, s.offer_id, objektId, s.titel, s.link, e.preis_alt, e.preis_neu, e.senkung_pct || null, e.zielpreis || null]);
  const daten = { art: e.art, suche_id: sucheId, offer_id: s.offer_id, objekt_id: objektId, titel: s.titel, link: s.link,
    preis_alt: e.preis_alt, preis_neu: e.preis_neu, senkung_pct: e.senkung_pct || null, zielpreis: e.zielpreis || null,
    at: new Date(r.rows[0].at).toISOString(), ereignis_id: r.rows[0].id };
  try { require('./maklerHubService').ereignis(userId, 'immometrica.' + e.art, daten); } catch (x) {}
  return daten;
}

/** Verarbeitet eine Liste roher Treffer einer Suche (rein bis auf die DB). */
async function verarbeiten(userId, sucheId, items, opt) {
  opt = opt || {};
  const ereignisse = [];
  for (const it of items) {
    const s = stand(it.raw || it);
    if (!s.offer_id) continue;
    const r = await query('SELECT preis, online, objekt_id FROM immometrica_staende WHERE user_id=$1 AND suche_id=$2 AND offer_id=$3', [userId, sucheId, s.offer_id]);
    const alt = r.rowCount ? { preis: _zahl(r.rows[0].preis), online: r.rows[0].online } : null;
    const zp = await _zielpreisFuer(userId, s.offer_id, opt.profil);
    const ev = erkennen(alt, s, { alarme: opt.profil && opt.profil.alarme, zielpreis: zp.zielpreis, grundstand: opt.grundstand });
    await query(
      `INSERT INTO immometrica_staende (user_id, suche_id, offer_id, preis, flaeche, titel, link, online, objekt_id, preis_geaendert_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NULL)
       ON CONFLICT (user_id, suche_id, offer_id) DO UPDATE SET
         preis_geaendert_at = CASE WHEN immometrica_staende.preis IS DISTINCT FROM EXCLUDED.preis THEN NOW() ELSE immometrica_staende.preis_geaendert_at END,
         preis = EXCLUDED.preis, flaeche = EXCLUDED.flaeche, titel = EXCLUDED.titel, link = EXCLUDED.link,
         online = EXCLUDED.online, objekt_id = COALESCE(EXCLUDED.objekt_id, immometrica_staende.objekt_id), zuletzt_at = NOW()`,
      [userId, sucheId, s.offer_id, s.preis, s.flaeche, s.titel, s.link, s.online, zp.objektId]);
    if (alt && alt.preis !== s.preis && zp.objektId) { try { await _preishistorie(userId, zp.objektId, s.preis, alt.preis); } catch (x) {} }
    for (const e of ev) ereignisse.push(await _ereignisSpeichern(userId, sucheId, s, e, zp.objektId));
  }
  return ereignisse;
}

/** Ein Lauf fuer einen Nutzer. Gibt Zahlen und das Kontingent (Header X-Limit) zurueck. */
async function lauf(userId) {
  const imo = require('./immometricaService');
  const creds = require('./providerCredentialsService');
  const token = await creds.getSecret(userId, 'immometrica');
  if (!token) return { ok: false, grund: 'kein ImmoMetrica-Zugang' };
  const profil = await require('./flowProfil').lesen(userId);
  const suchen = await imo.getSearches(token);
  const bericht = { ok: true, suchen: suchen.length, treffer: 0, ereignisse: 0, kontingent: null };
  for (const su of suchen) {
    const sid = String(su.id);
    const zust = await query('SELECT letzter_lauf_at, hoechste_offer_id FROM immometrica_abruf WHERE user_id=$1 AND suche_id=$2', [userId, sid]);
    const start = new Date().toISOString();
    let items = [], hoechste = zust.rowCount ? zust.rows[0].hoechste_offer_id : null, grundstand = !zust.rowCount;
    if (grundstand) {
      let seite = 1, mehr = true;
      while (mehr && seite <= 20) { const r = await imo.getResults(token, sid, seite > 1 ? seite : null); bericht.kontingent = r.kontingent || bericht.kontingent; items = items.concat(r.items || []); mehr = !!r.next; seite++; }
    } else {
      const seit = zust.rows[0].letzter_lauf_at ? new Date(zust.rows[0].letzter_lauf_at).toISOString() : null;
      const teile = [];
      if (hoechste) teile.push(await imo.getAenderungen(token, sid, 'neu', hoechste));
      if (seit) for (const art of ['geaendert', 'offline', 'wieder_online']) teile.push(await imo.getAenderungen(token, sid, art, seit));
      const gesehen = new Set();
      teile.forEach((t) => { bericht.kontingent = t.kontingent || bericht.kontingent; (t.items || []).forEach((it) => { const id = it.raw && it.raw.id; if (id != null && gesehen.has(id)) return; if (id != null) gesehen.add(id); items.push(it); }); });
    }
    items.forEach((it) => { const id = it.raw && it.raw.id; if (id != null && (hoechste == null || Number(id) > Number(hoechste))) hoechste = String(id); });
    const ev = await verarbeiten(userId, sid, items, { profil: profil, grundstand: grundstand });
    await query(
      `INSERT INTO immometrica_abruf (user_id, suche_id, letzter_lauf_at, hoechste_offer_id, kontingent) VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (user_id, suche_id) DO UPDATE SET letzter_lauf_at=EXCLUDED.letzter_lauf_at, hoechste_offer_id=EXCLUDED.hoechste_offer_id, kontingent=EXCLUDED.kontingent`,
      [userId, sid, start, hoechste, JSON.stringify(bericht.kontingent || null)]);
    bericht.treffer += items.length; bericht.ereignisse += ev.length;
  }
  return bericht;
}

/** GET /immometrica/ereignisse?seit= (ISO-Zeit oder Ereignis-Id) */
async function ereignisse(userId, seit) {
  let r;
  if (seit != null && /^\d+$/.test(String(seit))) {
    r = await query('SELECT * FROM immometrica_ereignisse WHERE user_id=$1 AND id > $2 ORDER BY id LIMIT 500', [userId, Number(seit)]);
  } else {
    const t = seit ? new Date(seit) : new Date(Date.now() - 7 * 86400000);
    if (isNaN(t)) { const e = new Error('seit ungueltig (ISO-Zeit oder Ereignis-Id)'); e.statusCode = 400; throw e; }
    r = await query('SELECT * FROM immometrica_ereignisse WHERE user_id=$1 AND at > $2 ORDER BY id LIMIT 500', [userId, t.toISOString()]);
  }
  return r.rows.map((z) => ({ id: Number(z.id), art: z.art, suche_id: z.suche_id, offer_id: z.offer_id, objekt_id: z.objekt_id,
    titel: z.titel, link: z.link, preis_alt: _zahl(z.preis_alt), preis_neu: _zahl(z.preis_neu), senkung_pct: _zahl(z.senkung_pct),
    zielpreis: _zahl(z.zielpreis), at: new Date(z.at).toISOString() }));
}

/** Der regelmaessige Job - AUS, solange FLOW_IMMOMETRICA_JOB nicht „an" ist. */
function eingeschaltet() { return String(process.env.FLOW_IMMOMETRICA_JOB || '').toLowerCase() === 'an'; }
function starten() {
  if (!eingeschaltet()) { console.log('[immometrica-flow] Job AUS (FLOW_IMMOMETRICA_JOB != an)'); return false; }
  const stunden = Math.max(1, Number(process.env.FLOW_IMMOMETRICA_STUNDEN) || 6);
  const runde = async () => {
    try {
      const r = await query("SELECT DISTINCT z.user_id FROM user_zusaetze z JOIN user_provider_credentials c ON c.user_id = z.user_id AND c.provider = 'immometrica' WHERE z.zusatz='flow' AND z.aktiv AND z.linien ? 'investor'");
      for (const u of r.rows) { try { const b = await lauf(u.user_id); console.log('[immometrica-flow] ' + u.user_id + ' ' + JSON.stringify(b)); } catch (e) { console.warn('[immometrica-flow] ' + u.user_id + ': ' + e.message); } }
    } catch (e) { console.warn('[immometrica-flow] Runde: ' + e.message); }
  };
  setInterval(runde, stunden * 3600 * 1000);
  console.log('[immometrica-flow] Job AN, alle ' + stunden + ' h');
  return true;
}

module.exports = { stand, erkennen, verarbeiten, lauf, ereignisse, starten, eingeschaltet };
