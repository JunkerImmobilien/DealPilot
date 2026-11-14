'use strict';
/**
 * partnerKunden.js · v3357 — Partner und Kunden (Konzept Dateien/Mandantenkonzept/Mandantenkonzept-Partner-2026-11-13.md)
 *
 * Zwei Zugangsarten je Verbindung (reseller_clients.platz_art):
 *   'platz'  der Partner zahlt einen Platz, bestimmt Stufe, Rechte, Kontingent, Marke, Netzwerk
 *   'eigen'  der Kunde zahlt selbst und ist nur verbunden, der Partner bestimmt nichts an seinem Konto
 *
 * Grundsaetze:
 *   - Eine Verbindung entsteht NUR durch die Bestaetigung des Kunden (partner_anfragen, Einladung oder Code).
 *   - Der Partner sieht NUR, was der Kunde sendet: Senden legt eine KOPIE beim Partner an (objects.kunden_freigabe_id).
 *     Erneut senden ersetzt die Kopie (stand_nr + 1), Zurueckziehen loescht sie.
 *   - Plan-Schutz liegt in resellerService.assignSeat / unassignSeat.
 *   - Platz entziehen: 30 Tage Frist (lesend), danach Verbindungen trennen und Konto loeschen - ausser der Kunde hat
 *     in der Frist ein eigenes Abo abgeschlossen (dann wird er zu 'eigen').
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const reseller = require('./resellerService');
const objectService = require('./objectService');
const planService = require('./planService');

function fehler(code, status, detail) { const e = new Error(code); e.status = status || 400; if (detail) e.detail = detail; return e; }

const STUFEN = { 1: 'Einsteiger', 2: 'Fortgeschritten', 3: 'Experte' };
/* Rechte je Partnerplatz. Vorgabe = an (Investor), ausser Partnernetzwerk. Unbekannte Schluessel gelten als an. */
const RECHTE = ['pdf', 'bankpdf', 'markt', 'ki', 'schluessel', 'telegram', 'senden', 'e_steuer', 'e_finanz', 'e_darstellung'];
const RECHTE_VORGABE = { pdf: true, bankpdf: true, markt: true, ki: true, schluessel: true, telegram: true, senden: true, e_steuer: true, e_finanz: true, e_darstellung: true };
const ENTZUG_FRIST_TAGE = 30;
const CODE_ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   /* ohne 0 O 1 I L */
const CODE_STUNDEN = 24;
const CODE_FEHLVERSUCHE_JE_STUNDE = 5;

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function codeNorm(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function rechteAus(c) {
  const r = Object.assign({}, RECHTE_VORGABE);
  if (c && c.platz_art === 'platz' && c.rechte && typeof c.rechte === 'object') {
    Object.keys(c.rechte).forEach((k) => { if (k in r) r[k] = c.rechte[k] !== false; });
  }
  return r;
}

async function meldung(resellerId, clientId, art, text, extra) {
  try {
    await query(`INSERT INTO partner_meldungen (reseller_id, client_id, art, text, share_id, aufgabe_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [resellerId, clientId || null, art, text || null, (extra && extra.share_id) || null, (extra && extra.aufgabe_id) || null]);
  } catch (e) { /* Meldung ist best-effort */ }
}

async function partnerName(resellerId) {
  const r = await query(`SELECT COALESCE(NULLIF(brand_name,''), name) AS n, owner_user_id FROM resellers WHERE id = $1`, [resellerId]);
  return r.rows[0] || { n: 'Partner', owner_user_id: null };
}

/* Die aktive Verbindung eines Kunden (genau eine, LIMIT 1 wie getMyReseller) */
async function aktiveVerbindung(userId) {
  const r = await query(
    `SELECT c.*, COALESCE(NULLIF(rs.brand_name,''), rs.name) AS partner_name, rs.whitelabel_enabled, rs.owner_user_id AS partner_owner,
            rs.brand_logo_b64, rs.brand_accent,
            EXISTS (SELECT 1 FROM licenses l WHERE l.client_id = c.id AND l.status = 'zugewiesen') AS hat_platz
       FROM reseller_clients c JOIN resellers rs ON rs.id = c.reseller_id
      WHERE c.user_id = $1 AND c.getrennt_am IS NULL
      ORDER BY c.created_at ASC LIMIT 1`, [userId]);
  return r.rows[0] || null;
}

// ═══ PARTNERSEITE ═══════════════════════════════════════════════════════════

async function cockpit(rs) {
  const pool = await reseller.getPool(rs.id).catch(() => null);
  const kunden = (await query(
    `SELECT c.id, c.user_id, c.display_name, c.platz_art, c.stufe, c.rechte, c.kontingent, c.marke, c.netzwerk, c.herkunft,
            c.verbunden_am, c.getrennt_am, c.getrennt_von, c.entzug_am, c.entzug_frist_bis, c.notiz, c.created_at,
            u.email,
            EXISTS (SELECT 1 FROM licenses l WHERE l.client_id = c.id AND l.status = 'zugewiesen') AS hat_platz,
            (SELECT COUNT(*) FROM object_shares s WHERE s.client_id = c.id AND s.kopie_object_id IS NOT NULL AND s.status <> 'widerrufen')::int AS sendungen,
            (SELECT MAX(s.stand_am) FROM object_shares s WHERE s.client_id = c.id AND s.status <> 'widerrufen') AS letzte_sendung,
            (SELECT COUNT(*) FROM object_shares s WHERE s.client_id = c.id AND s.kopie_object_id IS NOT NULL AND s.status <> 'widerrufen' AND s.gelesen_am IS NULL)::int AS neu
       FROM reseller_clients c JOIN users u ON u.id = c.user_id
      WHERE c.reseller_id = $1
      ORDER BY (c.getrennt_am IS NULL) DESC, c.display_name ASC`, [rs.id])).rows;
  kunden.forEach((k) => { k.rechte_wirksam = rechteAus(k); k.stufe_text = STUFEN[k.stufe] || null; });
  const anfragen = (await query(
    `SELECT a.id, a.quelle, a.platz_mitgeben, a.anzeige_name, a.status, a.erstellt_am, u.email
       FROM partner_anfragen a JOIN users u ON u.id = a.user_id
      WHERE a.reseller_id = $1 AND a.status = 'offen' ORDER BY a.erstellt_am DESC`, [rs.id])).rows;
  const einladungen = await reseller.listInvites(rs.id).catch(() => []);
  const ungelesen = (await query(`SELECT COUNT(*)::int AS n FROM partner_meldungen WHERE reseller_id = $1 AND gelesen_am IS NULL`, [rs.id])).rows[0].n;
  return { partner: { id: rs.id, name: rs.brand_name || rs.name, whitelabel: !!rs.whitelabel_enabled }, pool, kunden, anfragen, einladungen, meldungen_ungelesen: ungelesen,
    stufen: STUFEN, rechte_liste: RECHTE };
}

async function kundeLaden(rs, clientId) {
  const r = await query(`SELECT * FROM reseller_clients WHERE id = $1 AND reseller_id = $2`, [clientId, rs.id]);
  if (!r.rowCount) throw fehler('kunde_nicht_gefunden', 404);
  return r.rows[0];
}

/** Stufe, Rechte, Kontingent, Marke, Netzwerk, Notiz. Bei 'eigen' nur Notiz (das Konto gehoert dem Kunden). */
async function kundeEinstellen(rs, clientId, b) {
  const c = await kundeLaden(rs, clientId);
  b = b || {};
  if (c.platz_art !== 'platz') {
    if (b.notiz !== undefined) await query(`UPDATE reseller_clients SET notiz = $2 WHERE id = $1`, [clientId, String(b.notiz || '').slice(0, 2000)]);
    if (['stufe', 'rechte', 'kontingent', 'marke', 'netzwerk'].some((k) => b[k] !== undefined)) throw fehler('eigener_plan', 409, 'Der Kunde hat einen eigenen Plan, Stufe und Rechte bestimmt er selbst.');
    return kundeLaden(rs, clientId);
  }
  const sets = [], p = [clientId];
  const setze = (sp, v) => { p.push(v); sets.push(sp + ' = $' + p.length); };
  if (b.stufe !== undefined) { const s = parseInt(b.stufe, 10); if (!STUFEN[s]) throw fehler('stufe_ungueltig'); setze('stufe', s); }
  if (b.rechte !== undefined) {
    const r = {}; RECHTE.forEach((k) => { if (b.rechte && b.rechte[k] !== undefined) r[k] = b.rechte[k] !== false; });
    setze('rechte', JSON.stringify(r));
  }
  if (b.kontingent !== undefined) {
    const k = {}; const mb = parseInt(b.kontingent && b.kontingent.marktbericht, 10);
    if (isFinite(mb) && mb >= 0) k.marktbericht = Math.min(mb, 10);
    setze('kontingent', JSON.stringify(k));
  }
  if (b.marke !== undefined) setze('marke', b.marke === 'dealpilot' ? 'dealpilot' : 'partner');
  if (b.netzwerk !== undefined) setze('netzwerk', !!b.netzwerk);
  if (b.notiz !== undefined) setze('notiz', String(b.notiz || '').slice(0, 2000));
  if (b.display_name !== undefined && String(b.display_name).trim()) setze('display_name', String(b.display_name).trim().slice(0, 120));
  if (sets.length) await query(`UPDATE reseller_clients SET ${sets.join(', ')} WHERE id = $1`, p);
  return kundeLaden(rs, clientId);
}

/** Einladung: neue Adresse -> Einladungs-Mail (alter Weg); bestehendes Konto -> Anfrage, die der Kunde bestaetigt. */
async function einladen(rs, actor, b) {
  const email = String(b && b.email || '').trim().toLowerCase();
  const name = String(b && b.name || '').trim();
  const platz = b && b.platz_mitgeben !== false;
  if (!email || !name) throw fehler('email_und_name');
  const u = (await query(`SELECT id, role FROM users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`, [email])).rows[0];
  if (u) {
    const anfrage = await anfrageAnlegen(rs, u.id, { quelle: 'einladung', platz_mitgeben: platz, name, actor });
    /* Antwort verraet nicht, ob es das Konto gibt: beide Wege sagen „Einladung gesendet“ */
    return { ok: true, art: 'anfrage', anfrage_id: anfrage.id };
  }
  const inv = await reseller.createInvite(rs.id, { email, displayName: name, invitedBy: actor });
  try { await query(`UPDATE reseller_invites SET art = 'neu', platz_mitgeben = $2 WHERE id = $1`, [inv.id, platz]); } catch (e) {}
  return { ok: true, art: 'einladung', invite: inv };
}

async function anfrageAnlegen(rs, userId, o) {
  const pn = await partnerName(rs.id);
  if (pn.owner_user_id === userId) throw fehler('eigenes_konto', 409, 'Das ist dein eigenes Konto.');
  const partnerKonto = await query(`SELECT 1 FROM resellers WHERE owner_user_id = $1 UNION SELECT 1 FROM reseller_members WHERE user_id = $1 LIMIT 1`, [userId]);
  if (partnerKonto.rowCount) throw fehler('partnerkonto', 409, 'Dieses Konto ist selbst ein Partnerkonto.');
  const v = await aktiveVerbindung(userId);
  if (v && v.reseller_id !== rs.id) throw fehler('anderer_partner', 409, 'Der Kunde ist schon mit einem anderen Partner verbunden.');
  if (v && v.reseller_id === rs.id) throw fehler('schon_verbunden', 409, 'Der Kunde ist schon mit dir verbunden.');
  const ex = await query(`SELECT * FROM partner_anfragen WHERE reseller_id = $1 AND user_id = $2 AND status = 'offen'`, [rs.id, userId]);
  if (ex.rowCount) return ex.rows[0];
  const r = await query(
    `INSERT INTO partner_anfragen (reseller_id, user_id, quelle, platz_mitgeben, anzeige_name, erstellt_von) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [rs.id, userId, o.quelle, !!o.platz_mitgeben, o.name || null, o.actor || null]);
  return r.rows[0];
}

/** Verbindungscode einloesen (Partner). 5 Fehlversuche je Partner und Stunde. */
async function codeEinloesen(rs, actor, b) {
  const n = (await query(`SELECT COUNT(*)::int AS n FROM verbindungs_code_versuche WHERE reseller_id = $1 AND erstellt_am > now() - interval '1 hour'`, [rs.id])).rows[0].n;
  if (n >= CODE_FEHLVERSUCHE_JE_STUNDE) throw fehler('zu_viele_versuche', 429, 'Zu viele falsche Codes. Bitte in einer Stunde erneut versuchen.');
  const code = codeNorm(b && b.code);
  const z = code.length === 8 ? (await query(
    `SELECT * FROM verbindungs_codes WHERE code_hash = $1 AND eingeloest_am IS NULL AND widerrufen_am IS NULL AND gueltig_bis > now()`, [sha(code)])).rows[0] : null;
  if (!z) {
    await query(`INSERT INTO verbindungs_code_versuche (reseller_id) VALUES ($1)`, [rs.id]);
    throw fehler('code_ungueltig', 404, 'Der Code ist falsch oder abgelaufen.');
  }
  const anfrage = await anfrageAnlegen(rs, z.user_id, { quelle: 'code', platz_mitgeben: b && b.platz_mitgeben !== false, name: b && b.name, actor });
  await query(`UPDATE verbindungs_codes SET eingeloest_von = $2, eingeloest_am = now() WHERE id = $1`, [z.id, rs.id]);
  return { ok: true, anfrage_id: anfrage.id };
}

async function anfrageZurueckziehen(rs, id) {
  const r = await query(`UPDATE partner_anfragen SET status = 'zurueckgezogen', beantwortet_am = now() WHERE id = $1 AND reseller_id = $2 AND status = 'offen' RETURNING id`, [id, rs.id]);
  return { ok: r.rowCount > 0 };
}

/** Kundenstaende beim Partner, je Kunde */
async function kundenstaende(rs) {
  const r = await query(
    `SELECT s.id AS share_id, s.client_id, s.kopie_object_id, s.stand_nr, s.stand_am, s.ueber_bestand, s.gelesen_am, s.status,
            c.display_name AS kunde, c.getrennt_am,
            o.name, o.seq_no, o.ort, o.kaufpreis, o.dscr, o.cf_ns, o.bmy,
            COALESCE((o.data::jsonb->>'_deal_won')::boolean, false) AS deal_won,
            (o.data::jsonb->>'_dealpilot_score')::int AS score
       FROM object_shares s
       JOIN reseller_clients c ON c.id = s.client_id
       JOIN objects o ON o.id = s.kopie_object_id
      WHERE s.reseller_id = $1 AND s.kopie_object_id IS NOT NULL AND s.status <> 'widerrufen'
      ORDER BY c.display_name, s.stand_am DESC`, [rs.id]);
  return r.rows;
}

async function kundenstandGeoeffnet(rs, actor, shareId) {
  const r = await query(`UPDATE object_shares SET gelesen_am = COALESCE(gelesen_am, now()) WHERE id = $1 AND reseller_id = $2 RETURNING id`, [shareId, rs.id]);
  if (r.rowCount) { try { await query(`INSERT INTO share_audit (share_id, actor_user_id, action) VALUES ($1,$2,'geoeffnet')`, [shareId, actor]); } catch (e) {} }
  return { ok: r.rowCount > 0 };
}

/** Kundenstand als eigenes Objekt uebernehmen (bleibt beim Partner, auch wenn der Kunde zurueckzieht) */
async function kundenstandUebernehmen(rs, actor, shareId) {
  const s = (await query(`SELECT * FROM object_shares WHERE id = $1 AND reseller_id = $2 AND kopie_object_id IS NOT NULL AND status <> 'widerrufen'`, [shareId, rs.id])).rows[0];
  if (!s) throw fehler('kundenstand_nicht_gefunden', 404);
  const pn = await partnerName(rs.id);
  const orig = await objectService.getById(pn.owner_user_id, s.kopie_object_id);
  if (!orig) throw fehler('kundenstand_nicht_gefunden', 404);
  const d = typeof orig.data === 'string' ? JSON.parse(orig.data) : (orig.data || {});
  const daten = JSON.parse(JSON.stringify(d)); delete daten._obj_seq; delete daten._kundenstand;
  daten._von_kunde = { share_id: shareId, stand_nr: s.stand_nr, am: new Date().toISOString() };
  let fotos = orig.photos; if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
  const neu = await objectService.create(pn.owner_user_id, { data: daten, aiAnalysis: orig.ai_analysis || null, photos: Array.isArray(fotos) ? fotos : [] });
  try { await query(`INSERT INTO share_audit (share_id, actor_user_id, action) VALUES ($1,$2,'uebernommen')`, [shareId, actor]); } catch (e) {}
  return { ok: true, object_id: neu.id, seq_no: neu.seq_no };
}

/** Platz entziehen: Frist 30 Tage, Platz sofort frei, Kunde behaelt in der Frist lesend Investor. */
async function platzEntziehen(rs, actor, clientId, b) {
  const c = await kundeLaden(rs, clientId);
  if (c.platz_art !== 'platz') throw fehler('kein_platz', 409, 'Der Kunde hat einen eigenen Plan, er kann nur getrennt werden.');
  if (c.entzug_am) throw fehler('schon_entzogen', 409);
  if (String(b && b.bestaetigung || '').trim().toLowerCase() !== String(c.display_name).trim().toLowerCase())
    throw fehler('bestaetigung_falsch', 400, 'Zur Bestätigung den Namen des Kunden genau eintippen.');
  await query(`UPDATE licenses SET client_id = NULL, status = 'pool', assigned_at = NULL WHERE reseller_id = $1 AND client_id = $2 AND status = 'zugewiesen'`, [rs.id, clientId]);
  await query(`UPDATE reseller_clients SET entzug_am = now(), entzug_frist_bis = now() + ($2 || ' days')::interval WHERE id = $1`, [clientId, String(ENTZUG_FRIST_TAGE)]);
  if (!(await reseller.hatBezahltesAbo(c.user_id))) { try { await planService.setUserPlanManual(c.user_id, 'investor', 'monthly', ENTZUG_FRIST_TAGE); } catch (e) {} }
  await meldung(rs.id, clientId, 'frist_laeuft', 'Platz entzogen, Frist bis ' + new Date(Date.now() + ENTZUG_FRIST_TAGE * 864e5).toLocaleDateString('de-DE'));
  return { ok: true, frist_tage: ENTZUG_FRIST_TAGE };
}

/** Verbindung trennen (Partner oder Kunde). Beim Platz: Platz frei, Plan zurueck (Plan-Schutz). Kopien bleiben markiert. */
async function trennen(resellerId, clientId, von) {
  const c = (await query(`SELECT * FROM reseller_clients WHERE id = $1 AND reseller_id = $2`, [clientId, resellerId])).rows[0];
  if (!c) throw fehler('kunde_nicht_gefunden', 404);
  if (c.getrennt_am) return { ok: true };
  try { await reseller.unassignSeat(resellerId, clientId); } catch (e) {}
  await query(`UPDATE reseller_clients SET getrennt_am = now(), getrennt_von = $2 WHERE id = $1`, [clientId, von]);
  await meldung(resellerId, clientId, 'getrennt', (von === 'kunde' ? 'Der Kunde hat die Verbindung getrennt' : 'Verbindung getrennt'));
  return { ok: true };
}

/** Takt: abgelaufene Fristen. Eigenes Abo -> wird 'eigen'. Sonst Verbindungen trennen, Konto loeschen. */
async function fristenAbarbeiten(opts) {
  const dry = !!(opts && opts.dryRun);
  const r = await query(
    `SELECT c.*, u.email, u.role FROM reseller_clients c JOIN users u ON u.id = c.user_id
      WHERE c.entzug_frist_bis IS NOT NULL AND c.entzug_frist_bis < now() AND c.entzug_erledigt_am IS NULL`);
  const out = [];
  for (const c of r.rows) {
    if (await reseller.hatBezahltesAbo(c.user_id)) {
      if (!dry) await query(`UPDATE reseller_clients SET platz_art = 'eigen', entzug_erledigt_am = now(), entzug_am = NULL, entzug_frist_bis = NULL, rechte = NULL WHERE id = $1`, [c.id]);
      out.push({ client: c.id, weg: 'eigenes_abo' }); continue;
    }
    if (c.role === 'admin') { out.push({ client: c.id, weg: 'admin_ausgenommen' }); continue; }
    out.push({ client: c.id, weg: 'loeschen' });
    if (dry) continue;
    for (const sql of [
      `UPDATE api_keys SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      `DELETE FROM provider_credentials WHERE user_id = $1`,
      `DELETE FROM telegram_links WHERE user_id = $1`,
      `UPDATE hub_verbindungen SET widerrufen_am = now() WHERE user_id = $1 AND widerrufen_am IS NULL`]) {
      try { await query(sql, [c.user_id]); } catch (e) { /* Tabelle/Spalte fehlt in alten Staenden - weiter */ }
    }
    await query(`UPDATE reseller_clients SET entzug_erledigt_am = now(), getrennt_am = COALESCE(getrennt_am, now()), getrennt_von = 'entzug' WHERE id = $1`, [c.id]);
    await meldung(c.reseller_id, c.id, 'getrennt', 'Frist abgelaufen, Konto des Kunden gelöscht');
    try { await require('./userService').deleteUser(c.user_id); } catch (e) { console.error('[partner-kunden] Loeschen fehlgeschlagen:', e.message); }
  }
  return out;
}

// ── Aufgaben ────────────────────────────────────────────────────────────────
async function aufgabenListe(rs) {
  const a = (await query(`SELECT * FROM partner_aufgaben WHERE reseller_id = $1 ORDER BY erstellt_am DESC`, [rs.id])).rows;
  const k = (await query(
    `SELECT ak.*, c.display_name FROM partner_aufgaben_kunden ak JOIN reseller_clients c ON c.id = ak.client_id
      JOIN partner_aufgaben a ON a.id = ak.aufgabe_id WHERE a.reseller_id = $1`, [rs.id])).rows;
  a.forEach((x) => { x.kunden = k.filter((y) => y.aufgabe_id === x.id); });
  return a;
}

async function aufgabeAnlegen(rs, actor, b) {
  b = b || {};
  const titel = String(b.titel || '').trim(); if (!titel) throw fehler('titel_fehlt');
  const art = ['steuerjahr', 'bestand_senden', 'frei'].indexOf(b.art) >= 0 ? b.art : 'frei';
  const filt = ['alle', 'bestand', 'ankauf'].indexOf(b.objektfilter) >= 0 ? b.objektfilter : 'alle';
  const sj = art === 'steuerjahr' ? (parseInt(b.steuerjahr, 10) || (new Date().getFullYear() - 1)) : null;
  const a = (await query(
    `INSERT INTO partner_aufgaben (reseller_id, titel, text, art, steuerjahr, objektfilter, faellig_am, erstellt_von)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [rs.id, titel.slice(0, 200), String(b.text || '').slice(0, 4000) || null, art, sj, filt, b.faellig_am || null, actor])).rows[0];
  let ids = Array.isArray(b.kunden) ? b.kunden : null;
  if (!ids || b.kunden === 'alle') ids = (await query(`SELECT id FROM reseller_clients WHERE reseller_id = $1 AND getrennt_am IS NULL`, [rs.id])).rows.map((x) => x.id);
  let n = 0;
  for (const id of ids) {
    const ok = await query(`SELECT 1 FROM reseller_clients WHERE id = $1 AND reseller_id = $2 AND getrennt_am IS NULL`, [id, rs.id]);
    if (!ok.rowCount) continue;
    await query(`INSERT INTO partner_aufgaben_kunden (aufgabe_id, client_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [a.id, id]); n++;
  }
  return Object.assign(a, { kunden_anzahl: n });
}

async function aufgabeErinnern(rs, aufgabeId, clientId) {
  const r = await query(
    `UPDATE partner_aufgaben_kunden ak SET letzte_erinnerung_am = now()
       FROM partner_aufgaben a WHERE a.id = ak.aufgabe_id AND a.reseller_id = $1 AND ak.aufgabe_id = $2
        AND ak.status NOT IN ('erledigt','abgelehnt') AND ($3::uuid IS NULL OR ak.client_id = $3::uuid)
        AND (ak.letzte_erinnerung_am IS NULL OR ak.letzte_erinnerung_am < now() - interval '1 day')
     RETURNING ak.client_id`, [rs.id, aufgabeId, clientId || null]);
  return { ok: true, erinnert: r.rowCount };
}

async function aufgabeAbschliessen(rs, aufgabeId) {
  await query(`UPDATE partner_aufgaben SET status = 'abgeschlossen' WHERE id = $1 AND reseller_id = $2`, [aufgabeId, rs.id]);
  return { ok: true };
}

async function meldungen(rs, limit) {
  return (await query(
    `SELECT m.*, c.display_name AS kunde FROM partner_meldungen m LEFT JOIN reseller_clients c ON c.id = m.client_id
      WHERE m.reseller_id = $1 ORDER BY m.erstellt_am DESC LIMIT $2`, [rs.id, Math.min(parseInt(limit, 10) || 50, 200)])).rows;
}
async function meldungenGelesen(rs) {
  await query(`UPDATE partner_meldungen SET gelesen_am = now() WHERE reseller_id = $1 AND gelesen_am IS NULL`, [rs.id]);
  return { ok: true };
}

// ═══ KUNDENSEITE ════════════════════════════════════════════════════════════

async function meinPartner(userId) {
  const v = await aktiveVerbindung(userId);
  const anfragen = (await query(
    `SELECT a.id, a.quelle, a.platz_mitgeben, a.erstellt_am, COALESCE(NULLIF(rs.brand_name,''), rs.name) AS partner_name, rs.role AS partner_rolle
       FROM partner_anfragen a JOIN resellers rs ON rs.id = a.reseller_id
      WHERE a.user_id = $1 AND a.status = 'offen' ORDER BY a.erstellt_am DESC`, [userId])).rows;
  const bezahlt = await reseller.hatBezahltesAbo(userId);
  anfragen.forEach((a) => { a.zugang = (a.platz_mitgeben && !bezahlt) ? 'platz' : 'eigen'; });
  const code = (await query(`SELECT gueltig_bis FROM verbindungs_codes WHERE user_id = $1 AND eingeloest_am IS NULL AND widerrufen_am IS NULL AND gueltig_bis > now() ORDER BY erstellt_am DESC LIMIT 1`, [userId])).rows[0] || null;
  if (!v) return { verbunden: null, anfragen, code_gueltig_bis: code ? code.gueltig_bis : null };
  const sendungen = (await query(
    `SELECT s.id, s.object_id, s.stand_nr, s.stand_am, s.ueber_bestand, s.status, s.gelesen_am, o.name, o.seq_no, o.updated_at AS objekt_geaendert
       FROM object_shares s JOIN objects o ON o.id = s.object_id
      WHERE s.client_id = $1 AND s.kopie_object_id IS NOT NULL AND s.status <> 'widerrufen' ORDER BY s.stand_am DESC`, [v.id])).rows;
  sendungen.forEach((s) => { s.seitdem_geaendert = s.objekt_geaendert && s.stand_am && new Date(s.objekt_geaendert) > new Date(s.stand_am); });
  const aufgaben = (await query(
    `SELECT a.id, a.titel, a.text, a.art, a.steuerjahr, a.objektfilter, a.faellig_am, a.erstellt_am, ak.status, ak.erledigt_am, ak.abgelehnt_grund, ak.letzte_erinnerung_am
       FROM partner_aufgaben_kunden ak JOIN partner_aufgaben a ON a.id = ak.aufgabe_id
      WHERE ak.client_id = $1 AND a.status = 'aktiv' ORDER BY a.faellig_am NULLS LAST, a.erstellt_am DESC`, [v.id])).rows;
  return {
    verbunden: {
      client_id: v.id, partner_name: v.partner_name, partner_logo: v.whitelabel_enabled ? v.brand_logo_b64 : null, platz_art: v.platz_art,
      hat_platz: v.hat_platz, stufe: v.platz_art === 'platz' ? (v.stufe || null) : null, stufe_text: v.platz_art === 'platz' ? (STUFEN[v.stufe] || null) : null,
      rechte: v.platz_art === 'platz' ? rechteAus(v) : null, kontingent: v.platz_art === 'platz' ? (v.kontingent || null) : null,
      marke: v.marke, netzwerk: v.platz_art === 'platz' ? !!v.netzwerk : true,
      verbunden_am: v.verbunden_am, entzug_frist_bis: v.entzug_frist_bis, bezahltes_abo: bezahlt
    },
    anfragen, sendungen, aufgaben, code_gueltig_bis: code ? code.gueltig_bis : null
  };
}

/** Kunde nimmt eine Anfrage an oder lehnt ab */
async function anfrageBeantworten(user, anfrageId, annehmen) {
  const a = (await query(`SELECT * FROM partner_anfragen WHERE id = $1 AND user_id = $2 AND status = 'offen'`, [anfrageId, user.id])).rows[0];
  if (!a) throw fehler('anfrage_nicht_gefunden', 404);
  const pn = await partnerName(a.reseller_id);
  if (!annehmen) {
    await query(`UPDATE partner_anfragen SET status = 'abgelehnt', beantwortet_am = now() WHERE id = $1`, [a.id]);
    await meldung(a.reseller_id, null, 'verbindung_abgelehnt', (a.anzeige_name || 'Ein Kunde') + ' hat die Verbindung abgelehnt');
    return { ok: true, angenommen: false };
  }
  const v = await aktiveVerbindung(user.id);
  if (v && v.reseller_id !== a.reseller_id) throw fehler('anderer_partner', 409, 'Du bist schon mit ' + v.partner_name + ' verbunden. Trenne zuerst diese Verbindung.');
  const bezahlt = await reseller.hatBezahltesAbo(user.id);
  const art = (a.platz_mitgeben && !bezahlt) ? 'platz' : 'eigen';
  let c = (await query(`SELECT * FROM reseller_clients WHERE reseller_id = $1 AND user_id = $2`, [a.reseller_id, user.id])).rows[0];
  if (!c) c = await reseller.createClient(a.reseller_id, { userId: user.id, displayName: a.anzeige_name || user.name || user.email });
  await query(
    `UPDATE reseller_clients SET platz_art = $2, herkunft = $3, verbunden_am = now(), getrennt_am = NULL, getrennt_von = NULL,
            entzug_am = NULL, entzug_frist_bis = NULL, entzug_erledigt_am = NULL, stufe = COALESCE(stufe, 2),
            marke = CASE WHEN $2 = 'eigen' THEN 'dealpilot' ELSE marke END WHERE id = $1`,
    [c.id, art, a.quelle]);
  let platz = false;
  if (art === 'platz') { try { await reseller.assignSeat(a.reseller_id, c.id); platz = true; } catch (e) { /* kein freier Platz: Partner weist spaeter zu */ } }
  await query(`UPDATE partner_anfragen SET status = 'angenommen', beantwortet_am = now() WHERE id = $1`, [a.id]);
  await meldung(a.reseller_id, c.id, 'verbindung_angenommen', (a.anzeige_name || user.name || 'Kunde') + ' hat die Verbindung bestätigt' + (art === 'eigen' ? ' (eigener Plan)' : platz ? ' (Partnerplatz)' : ' (Platz noch zuweisen)'));
  return { ok: true, angenommen: true, partner_name: pn.n, platz_art: art, platz_zugewiesen: platz };
}

/** Kunde erzeugt einen Verbindungscode (Klartext nur in dieser Antwort) */
async function codeErzeugen(userId) {
  await query(`UPDATE verbindungs_codes SET widerrufen_am = now() WHERE user_id = $1 AND eingeloest_am IS NULL AND widerrufen_am IS NULL`, [userId]);
  let code = '';
  const b = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) code += CODE_ZEICHEN[b[i] % CODE_ZEICHEN.length];
  const bis = new Date(Date.now() + CODE_STUNDEN * 3600e3);
  await query(`INSERT INTO verbindungs_codes (user_id, code_hash, gueltig_bis) VALUES ($1,$2,$3)`, [userId, sha(code), bis]);
  return { code: code.slice(0, 4) + '-' + code.slice(4), gueltig_bis: bis };
}
async function codeWiderrufen(userId) {
  await query(`UPDATE verbindungs_codes SET widerrufen_am = now() WHERE user_id = $1 AND eingeloest_am IS NULL AND widerrufen_am IS NULL`, [userId]);
  return { ok: true };
}

const NICHT_IN_KOPIE = ['_obj_seq', 'halter', '_kundenstand', '_uebergabe'];

/** Senden als Kopie: objectIds oder bestand=true. Erneut senden ersetzt die Kopie. */
async function senden(user, b) {
  const v = await aktiveVerbindung(user.id);
  if (!v) throw fehler('nicht_verbunden', 409, 'Du bist mit keinem Partner verbunden.');
  if (v.platz_art === 'platz' && rechteAus(v).senden === false) throw fehler('recht_senden_aus', 403, 'Dein Partner hat das Senden ausgeschaltet.');
  if (v.entzug_am) throw fehler('frist_laeuft', 409, 'Während der Frist kann nichts gesendet werden.');
  let ids = Array.isArray(b && b.object_ids) ? b.object_ids.slice(0, 200) : [];
  const bestand = !!(b && b.bestand);
  if (bestand) ids = (await query(`SELECT id FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL ORDER BY updated_at DESC LIMIT 200`, [user.id])).rows.map((x) => x.id);
  if (!ids.length) throw fehler('keine_objekte');
  const pn = await partnerName(v.reseller_id);
  if (!pn.owner_user_id) throw fehler('partner_ohne_inhaber', 409);
  const ergebnis = [];
  for (const oid of ids) {
    const orig = await objectService.getById(user.id, oid);
    if (!orig) { ergebnis.push({ object_id: oid, ok: false, grund: 'nicht_gefunden' }); continue; }
    let s = (await query(`SELECT * FROM object_shares WHERE object_id = $1 AND reseller_id = $2`, [oid, v.reseller_id])).rows[0];
    if (!s) s = (await query(
      `INSERT INTO object_shares (object_id, client_id, reseller_id, status, submitted_at) VALUES ($1,$2,$3,'eingereicht', now()) RETURNING *`,
      [oid, v.id, v.reseller_id])).rows[0];
    const standNr = (s.status === 'widerrufen' ? 0 : (s.stand_nr || 0)) + 1;
    const d = typeof orig.data === 'string' ? JSON.parse(orig.data) : JSON.parse(JSON.stringify(orig.data || {}));
    NICHT_IN_KOPIE.forEach((k) => { delete d[k]; });
    d._obj_seq = 'K-' + String(s.id).slice(0, 8) + '-' + standNr;   /* eigene Kennung: belegt keine Nummer des Partners, kollidiert nicht beim erneuten Senden */
    d._kundenstand = { share_id: s.id, client_id: v.id, kunde: v.display_name, stand_nr: standNr, stand_am: new Date().toISOString(), seq_kunde: orig.data && orig.data._obj_seq || null };
    let fotos = orig.photos; if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
    const kopie = await objectService.create(pn.owner_user_id, { data: d, aiAnalysis: orig.ai_analysis || null, photos: Array.isArray(fotos) ? fotos : [] });
    await query(`UPDATE objects SET kunden_freigabe_id = $2 WHERE id = $1`, [kopie.id, s.id]);
    const alt = s.status !== 'widerrufen' ? s.kopie_object_id : null;
    await query(
      `UPDATE object_shares SET kopie_object_id = $2, stand_nr = $3, stand_am = now(), ueber_bestand = $4, status = 'eingereicht',
              submitted_at = now(), revoked_at = NULL, gelesen_am = NULL, updated_at = now(), aufgabe_id = COALESCE($5, aufgabe_id), client_id = $6 WHERE id = $1`,
      [s.id, kopie.id, standNr, bestand, (b && b.aufgabe_id) || null, v.id]);
    if (alt) { try { await query(`DELETE FROM objects WHERE id = $1 AND kunden_freigabe_id = $2`, [alt, s.id]); } catch (e) {} }
    try { await query(`INSERT INTO share_audit (share_id, actor_user_id, action, meta) VALUES ($1,$2,'gesendet',$3::jsonb)`, [s.id, user.id, JSON.stringify({ stand_nr: standNr })]); } catch (e) {}
    ergebnis.push({ object_id: oid, ok: true, share_id: s.id, stand_nr: standNr });
  }
  const n = ergebnis.filter((x) => x.ok).length;
  if (n) await meldung(v.reseller_id, v.id, bestand ? 'bestand' : (ergebnis.some((x) => x.stand_nr > 1) ? 'neuer_stand' : 'gesendet'),
    v.display_name + (bestand ? ' hat den Bestand gesendet (' + n + ' Objekte)' : ' hat ' + n + (n === 1 ? ' Objekt' : ' Objekte') + ' gesendet'));
  if (b && b.aufgabe_id) await aufgabeKunde(user, b.aufgabe_id, 'erledigt');
  return { ok: true, gesendet: n, ergebnis };
}

async function zurueckziehen(user, shareId) {
  const v = await aktiveVerbindung(user.id);
  const s = (await query(`SELECT s.* FROM object_shares s JOIN reseller_clients c ON c.id = s.client_id WHERE s.id = $1 AND c.user_id = $2`, [shareId, user.id])).rows[0];
  if (!s) throw fehler('sendung_nicht_gefunden', 404);
  if (s.kopie_object_id) { try { await query(`DELETE FROM objects WHERE id = $1 AND kunden_freigabe_id = $2`, [s.kopie_object_id, s.id]); } catch (e) {} }
  await query(`UPDATE object_shares SET status = 'widerrufen', revoked_at = now(), kopie_object_id = NULL, updated_at = now() WHERE id = $1`, [s.id]);
  try { await query(`INSERT INTO share_audit (share_id, actor_user_id, action) VALUES ($1,$2,'zurueckgezogen')`, [s.id, user.id]); } catch (e) {}
  await meldung(s.reseller_id, s.client_id, 'zurueckgezogen', ((v && v.display_name) || 'Ein Kunde') + ' hat ein Objekt zurückgezogen', { share_id: s.id });
  return { ok: true };
}

async function aufgabeKunde(user, aufgabeId, status, grund) {
  const ok = ['gesehen', 'in_arbeit', 'erledigt', 'abgelehnt'];
  if (ok.indexOf(status) < 0) throw fehler('status_ungueltig');
  const r = (await query(
    `SELECT ak.*, a.reseller_id, a.titel, c.display_name FROM partner_aufgaben_kunden ak
       JOIN partner_aufgaben a ON a.id = ak.aufgabe_id JOIN reseller_clients c ON c.id = ak.client_id
      WHERE ak.aufgabe_id = $1 AND c.user_id = $2`, [aufgabeId, user.id])).rows[0];
  if (!r) throw fehler('aufgabe_nicht_gefunden', 404);
  if (status === 'gesehen' && r.status !== 'offen') return { ok: true };
  await query(
    `UPDATE partner_aufgaben_kunden SET status = $3, gesehen_am = COALESCE(gesehen_am, now()),
            erledigt_am = CASE WHEN $3 = 'erledigt' THEN now() ELSE erledigt_am END,
            abgelehnt_grund = CASE WHEN $3 = 'abgelehnt' THEN $4 ELSE abgelehnt_grund END
      WHERE aufgabe_id = $1 AND client_id = $2`, [aufgabeId, r.client_id, status, grund ? String(grund).slice(0, 500) : null]);
  if (status === 'erledigt' || status === 'abgelehnt')
    await meldung(r.reseller_id, r.client_id, status === 'erledigt' ? 'aufgabe_erledigt' : 'aufgabe_abgelehnt',
      r.display_name + (status === 'erledigt' ? ' hat erledigt: ' : ' hat abgelehnt: ') + r.titel + (grund ? ' (' + String(grund).slice(0, 120) + ')' : ''), { aufgabe_id: aufgabeId });
  return { ok: true };
}

/** Bei eigenem Plan waehlt der Kunde, ob die App in der Marke des Partners erscheint */
async function markeWaehlen(user, marke) {
  const v = await aktiveVerbindung(user.id);
  if (!v) throw fehler('nicht_verbunden', 409);
  if (v.platz_art !== 'eigen') throw fehler('partner_bestimmt', 409, 'Beim Partnerplatz wählt der Partner die Marke.');
  await query(`UPDATE reseller_clients SET marke = $2 WHERE id = $1`, [v.id, marke === 'partner' ? 'partner' : 'dealpilot']);
  return { ok: true };
}

async function kundeTrennt(user) {
  const v = await aktiveVerbindung(user.id);
  if (!v) return { ok: true };
  return trennen(v.reseller_id, v.id, 'kunde');
}

/** Rechte des eingeloggten Kunden fuer Backend-Pruefungen (Kostenstellen). null = keine Einschraenkung. */
async function rechteFuer(userId) {
  try {
    const v = await aktiveVerbindung(userId);
    if (!v || v.platz_art !== 'platz') return null;
    return { rechte: rechteAus(v), kontingent: v.kontingent || null, netzwerk: !!v.netzwerk, entzug: !!v.entzug_am };
  } catch (e) { return null; }
}

/** Ende des Partner-Abos: jeder Kunde mit Platz geht in die Frist (ohne Namensbestaetigung) */
async function aboEnde(resellerId) {
  const r = await query(`SELECT id, display_name FROM reseller_clients WHERE reseller_id = $1 AND platz_art = 'platz' AND getrennt_am IS NULL AND entzug_am IS NULL`, [resellerId]);
  let n = 0;
  for (const c of r.rows) {
    try { await platzEntziehen({ id: resellerId }, null, c.id, { bestaetigung: c.display_name }); n++; } catch (e) {}
  }
  if (n) await meldung(resellerId, null, 'frist_laeuft', 'Partner-Abo beendet, ' + n + ' Kundenplätze laufen in die Frist');
  return { kunden: n };
}

/** Kostenstelle Marktbericht (Backend): Recht und Monatskontingent des Partnerplatzes */
async function marktberichtErlaubt(userId) {
  const r = await rechteFuer(userId);
  if (!r) return { ok: true };
  if (r.entzug) return { ok: false, message: 'Während der Frist nach dem Platzentzug sind keine neuen Abrufe möglich.' };
  if (r.rechte.markt === false) return { ok: false, message: 'Dein Partner hat Marktberichte für dein Konto ausgeschaltet.' };
  const cap = r.kontingent && Number.isFinite(Number(r.kontingent.marktbericht)) ? Number(r.kontingent.marktbericht) : null;
  if (cap != null) {
    try {
      const st = await require('./aiCreditsService').getStatus(userId);
      const used = ['mpi', 'mpi_plus', 'wev'].reduce((a, k) => a + ((st.arten && st.arten[k] && st.arten[k].used) || 0), 0);
      if (used >= cap) return { ok: false, message: 'Dein Partner hat ' + cap + ' Marktberichte im Monat freigegeben, sie sind verbraucht.' };
    } catch (e) { /* Zaehlung gestoert -> nicht sperren */ }
  }
  return { ok: true };
}
/** Kostenstelle KI (Backend) */
async function kiErlaubt(userId) {
  const r = await rechteFuer(userId);
  if (!r) return { ok: true };
  if (r.rechte.ki === false) return { ok: false, message: 'Dein Partner hat die KI-Funktionen für dein Konto ausgeschaltet.' };
  return { ok: true };
}

module.exports = {
  marktberichtErlaubt, kiErlaubt, aboEnde,
  STUFEN, RECHTE, RECHTE_VORGABE, ENTZUG_FRIST_TAGE, rechteAus, aktiveVerbindung,
  cockpit, kundeEinstellen, einladen, anfrageAnlegen, codeEinloesen, anfrageZurueckziehen,
  kundenstaende, kundenstandGeoeffnet, kundenstandUebernehmen, platzEntziehen, trennen, fristenAbarbeiten,
  aufgabenListe, aufgabeAnlegen, aufgabeErinnern, aufgabeAbschliessen, meldungen, meldungenGelesen,
  meinPartner, anfrageBeantworten, codeErzeugen, codeWiderrufen, senden, zurueckziehen, aufgabeKunde, kundeTrennt, markeWaehlen, rechteFuer,
  _codeNorm: codeNorm, _sha: sha, CODE_ZEICHEN
};
