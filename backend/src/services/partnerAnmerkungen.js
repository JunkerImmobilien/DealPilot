'use strict';
/**
 * services/partnerAnmerkungen.js · v3450 — Anmerkungen des Partners an einem Kundenstand und Rueckmeldung an den Kunden
 *
 * Marcel 15.11.2026: Partner schaut ein freigegebenes Objekt an, markiert Felder oder schreibt freie Anmerkungen und
 * gibt sie dem Kunden zurueck. Der Kunde sieht sie an SEINEM Original-Objekt, erledigt oder beantwortet sie.
 *
 * Kein zweiter Kanal: „Zurueck an Kunden“ legt eine Aufgabe (partner_aufgaben, art 'rueckmeldung') nur fuer diesen
 * Kunden an, mit share_id, objekt_id (Original) und stand_nr. Alles erledigt -> Aufgabe erledigt -> Meldung beim Partner
 * (aufgabeKunde, derselbe Weg wie jede Aufgabe).
 *
 * Rechte: Partner nur am eigenen Kundenstand (object_shares.reseller_id), nur verbundener Kunde, nur gesendetes Objekt
 * (kopie vorhanden, nicht widerrufen), Entwurf aendern/loeschen nur solange nicht zurueckgegeben.
 * Kunde nur an Anmerkungen, deren Kunde er ist (reseller_clients.user_id), nie an Entwuerfen.
 * Fremde Objekte werden nur gelesen (Name/Anschrift fuer den Titel).
 */
const { query } = require('../db/pool');
const pk = require('./partnerKunden');

const ARTEN = ['hinweis', 'pruefen', 'nachreichen'];
const ART_TEXT = { hinweis: 'Hinweis', pruefen: 'Bitte prüfen', nachreichen: 'Bitte nachreichen' };

function fehler(code, status, detail) { const e = new Error(code); e.status = status || 400; if (detail) e.detail = detail; return e; }
function kurz(v, n) { if (v == null) return null; const s = String(v).trim(); return s ? s.slice(0, n) : null; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function idPruefen(id) { if (!UUID.test(String(id || ''))) throw fehler('nicht_gefunden', 404); }

function sauber(b) {
  b = b || {};
  return {
    art: ARTEN.indexOf(b.art) >= 0 ? b.art : 'hinweis',
    text: kurz(b.text, 2000),
    sec: kurz(b.sec, 40), reiter: kurz(b.reiter, 80), feld_id: kurz(b.feld_id, 120), selektor: kurz(b.selektor, 400),
    feld_label: kurz(b.feld_label, 200), wert_damals: kurz(b.wert_damals, 500), vorschlag: kurz(b.vorschlag, 500)
  };
}

/** Kundenstand des Partners: eigener Partner, Kunde verbunden, Kopie vorhanden, nicht widerrufen */
async function kundenstand(rs, shareId, auchGetrennt) {
  idPruefen(shareId);
  const s = (await query(
    `SELECT s.*, c.getrennt_am, c.display_name AS kunde
       FROM object_shares s JOIN reseller_clients c ON c.id = s.client_id AND c.reseller_id = s.reseller_id
      WHERE s.id = $1 AND s.reseller_id = $2`, [shareId, rs.id])).rows[0];
  if (!s || s.status === 'widerrufen' || !s.kopie_object_id) throw fehler('kundenstand_nicht_gefunden', 404, 'Diesen Kundenstand gibt es nicht mehr.');
  if (s.getrennt_am && !auchGetrennt) throw fehler('kunde_getrennt', 409, 'Der Kunde ist nicht mehr verbunden.');
  return s;
}

async function liste(rs, shareId) {
  await kundenstand(rs, shareId, true);
  return (await query(`SELECT * FROM partner_anmerkungen WHERE share_id = $1 AND reseller_id = $2 ORDER BY nr`, [shareId, rs.id])).rows;
}

async function anlegen(rs, actor, shareId, b) {
  const s = await kundenstand(rs, shareId);
  const x = sauber(b);
  if (!x.text) throw fehler('text_fehlt', 400, 'Bitte einen Text eintragen.');
  const nr = (await query(`SELECT COALESCE(MAX(nr), 0) + 1 AS n FROM partner_anmerkungen WHERE share_id = $1`, [s.id])).rows[0].n;
  return (await query(
    `INSERT INTO partner_anmerkungen (reseller_id, client_id, share_id, objekt_id, stand_nr, nr, art, text, sec, reiter, feld_id, selektor, feld_label, wert_damals, vorschlag, erstellt_von)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [rs.id, s.client_id, s.id, s.object_id, s.stand_nr, nr, x.art, x.text, x.sec, x.reiter, x.feld_id, x.selektor, x.feld_label, x.wert_damals, x.vorschlag, actor])).rows[0];
}

async function entwurf(rs, id) {
  idPruefen(id);
  const a = (await query(`SELECT * FROM partner_anmerkungen WHERE id = $1 AND reseller_id = $2`, [id, rs.id])).rows[0];
  if (!a) throw fehler('anmerkung_nicht_gefunden', 404);
  if (a.status !== 'entwurf') throw fehler('schon_zurueckgegeben', 409, 'Die Anmerkung ist schon beim Kunden.');
  return a;
}
async function aendern(rs, id, b) {
  const a = await entwurf(rs, id);
  const x = sauber(Object.assign({}, a, b || {}));
  if (!x.text) throw fehler('text_fehlt', 400, 'Bitte einen Text eintragen.');
  return (await query(`UPDATE partner_anmerkungen SET art = $2, text = $3, vorschlag = $4 WHERE id = $1 RETURNING *`, [a.id, x.art, x.text, x.vorschlag])).rows[0];
}
async function loeschen(rs, id) {
  const a = await entwurf(rs, id);
  await query(`DELETE FROM partner_anmerkungen WHERE id = $1`, [a.id]);
  return { ok: true };
}

/** „Zurueck an Kunden“: alle Entwuerfe dieses Kundenstands als EINE Aufgabe an genau diesen Kunden */
async function zurueckgeben(rs, actor, shareId, b) {
  const s = await kundenstand(rs, shareId);
  const e = (await query(`SELECT id FROM partner_anmerkungen WHERE share_id = $1 AND status = 'entwurf' ORDER BY nr`, [s.id])).rows;
  if (!e.length) throw fehler('keine_anmerkungen', 409, 'Erst eine Anmerkung anlegen.');
  const o = (await query(`SELECT name, data::jsonb->>'str' AS str, data::jsonb->>'hnr' AS hnr, data::jsonb->>'ort' AS ort FROM objects WHERE id = $1`, [s.kopie_object_id])).rows[0] || {};
  const objName = [[o.str, o.hnr].filter(Boolean).join(' '), o.ort].filter(Boolean).join(', ') || o.name || 'dein Objekt';
  const begleit = kurz(b && b.text, 2000);
  const a = (await query(
    `INSERT INTO partner_aufgaben (reseller_id, titel, text, art, objektfilter, erstellt_von, share_id, objekt_id, stand_nr)
     VALUES ($1,$2,$3,'rueckmeldung','alle',$4,$5,$6,$7) RETURNING *`,
    [rs.id, ('Rückmeldung zu ' + objName).slice(0, 200), begleit, actor, s.id, s.object_id, s.stand_nr])).rows[0];
  await query(`INSERT INTO partner_aufgaben_kunden (aufgabe_id, client_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [a.id, s.client_id]);
  await query(`UPDATE partner_anmerkungen SET aufgabe_id = $2, status = 'offen' WHERE id = ANY($1::uuid[])`, [e.map((x) => x.id), a.id]);
  try { await query(`INSERT INTO share_audit (share_id, actor_user_id, action, meta) VALUES ($1,$2,'rueckmeldung',$3::jsonb)`, [s.id, actor, JSON.stringify({ aufgabe_id: a.id, anzahl: e.length })]); } catch (x) {}
  return { ok: true, aufgabe_id: a.id, anzahl: e.length, titel: a.titel };
}

// ── Kundenseite ────────────────────────────────────────────────────────────

async function kundeListe(user, aufgabeId) {
  idPruefen(aufgabeId);
  const a = (await query(
    `SELECT a.id, a.titel, a.text, a.share_id, a.objekt_id, a.stand_nr, ak.status, (o.user_id = $2) AS objekt_eigen
       FROM partner_aufgaben a JOIN partner_aufgaben_kunden ak ON ak.aufgabe_id = a.id
       JOIN reseller_clients c ON c.id = ak.client_id LEFT JOIN objects o ON o.id = a.objekt_id
      WHERE a.id = $1 AND c.user_id = $2 AND a.art = 'rueckmeldung'`, [aufgabeId, user.id])).rows[0];
  if (!a) throw fehler('aufgabe_nicht_gefunden', 404);
  const l = (await query(
    `SELECT n.id, n.nr, n.art, n.text, n.sec, n.reiter, n.feld_id, n.selektor, n.feld_label, n.wert_damals, n.vorschlag, n.status, n.antwort, n.antwort_am, n.erledigt_am, n.stand_nr
       FROM partner_anmerkungen n JOIN reseller_clients c ON c.id = n.client_id
      WHERE n.aufgabe_id = $1 AND c.user_id = $2 AND n.status <> 'entwurf' ORDER BY n.nr`, [aufgabeId, user.id])).rows;
  return { aufgabe: Object.assign(a, { objekt_id: a.objekt_eigen ? a.objekt_id : null }), anmerkungen: l };
}

async function kundeSetzen(user, id, b) {
  idPruefen(id);
  const n = (await query(
    `SELECT n.*, c.display_name, a.titel FROM partner_anmerkungen n JOIN reseller_clients c ON c.id = n.client_id
       JOIN partner_aufgaben a ON a.id = n.aufgabe_id WHERE n.id = $1 AND c.user_id = $2 AND n.status <> 'entwurf'`, [id, user.id])).rows[0];
  if (!n) throw fehler('anmerkung_nicht_gefunden', 404);
  const status = b && b.status === 'offen' ? 'offen' : (b && b.status === 'erledigt' ? 'erledigt' : n.status);
  const antwort = b && b.antwort != null ? kurz(b.antwort, 2000) : n.antwort;
  await query(
    `UPDATE partner_anmerkungen SET status = $2, antwort = $3, antwort_am = CASE WHEN $3 IS DISTINCT FROM antwort THEN now() ELSE antwort_am END,
            erledigt_am = CASE WHEN $2 = 'erledigt' THEN COALESCE(erledigt_am, now()) ELSE NULL END WHERE id = $1`, [n.id, status, antwort]);
  if (antwort && antwort !== n.antwort) await pk._meldung(n.reseller_id, n.client_id, 'anmerkung_antwort', n.display_name + ' hat auf Anmerkung ' + n.nr + ' geantwortet: ' + antwort.slice(0, 120), { aufgabe_id: n.aufgabe_id, share_id: n.share_id });
  const rest = (await query(`SELECT count(*)::int AS n FROM partner_anmerkungen WHERE aufgabe_id = $1 AND status = 'offen'`, [n.aufgabe_id])).rows[0].n;
  const ak = (await query(`SELECT status FROM partner_aufgaben_kunden WHERE aufgabe_id = $1 AND client_id = $2`, [n.aufgabe_id, n.client_id])).rows[0] || {};
  if (!rest && ak.status !== 'erledigt') await pk.aufgabeKunde(user, n.aufgabe_id, 'erledigt');
  else if (rest && ak.status === 'erledigt') await query(`UPDATE partner_aufgaben_kunden SET status = 'in_arbeit', erledigt_am = NULL WHERE aufgabe_id = $1 AND client_id = $2`, [n.aufgabe_id, n.client_id]);
  else if (rest && (ak.status === 'offen' || ak.status === 'gesehen')) await pk.aufgabeKunde(user, n.aufgabe_id, 'in_arbeit');
  return { ok: true, offen: rest, alle_erledigt: !rest };
}

module.exports = { ARTEN, ART_TEXT, liste, anlegen, aendern, loeschen, zurueckgeben, kundeListe, kundeSetzen, _sauber: sauber };
