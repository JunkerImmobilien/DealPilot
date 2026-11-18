'use strict';
/**
 * partnerSteuerprofil.js · v3700 — Steuerprofil des Kunden beim Partner (Paket P2, Konzept
 * Dateien/Mandantenkonzept/Anfordern-und-Freigeben-2026-11-18.md, Abschnitte 2.2, 5.1 und P2)
 *
 * Marcel 18.11.2026 (verbindlich):
 *   - Die Steuerdaten des Kunden gehen nur mit Freigabe (Bereich steuerdaten aus P1) mit, der Steuerverlauf wird
 *     mitgespeichert. Sie werden NIE mit den Daten des Partners vermischt: eigene Tabelle partner_steuerprofile,
 *     Fassungen je Uebermittlung mit Datum und Freigabe-Fassung, nie in tax_periods, Einstellungen oder Mandanten des
 *     Partners.
 *   - Das Profil enthaelt ALLE Jahre mit Steuerzeitraum des Kunden. Veranlagung und Kirchensteuer gehen als echte Werte
 *     mit, auch wenn sie beim Kunden nur im Investmentprofil im Browser liegen (der Browser des Kunden sammelt sie beim
 *     Senden ein, frontend/js/steuer-kontext.js einsammeln()).
 *
 * Gebaut wird das Profil im Browser des Kunden mit genau den Funktionen, die dort rechnen. Der Server prueft hier nur
 * Form und Grenzen (profilSauber) und legt es ab. Die Ueberfuehrungen liest der Server selbst aus den Objekten des
 * Kunden (ueberfuehrungenAus), sie sind Objektdaten und keine Rechnung.
 *
 * In jede Kopie (Kundenstand) kommt _steuerbasis = { v, profil_id, fassung, stand_am, orig_id, halter, profil }.
 * Der Browser des Partners rechnet damit (DpSteuerKontext), ohne zu laden und ohne etwas des Partners zu lesen.
 */
const crypto = require('crypto');
const { query } = require('../db/pool');

const GRENZEN = { zeitraeume: 80, mandanten: 40, bestand: 400, jahre: 80, bytes: 1500000 };
const RECHTSFORMEN = ['privat', 'gmbh', 'ug', 'gbr', 'kg', 'ohg', 'ek', 'sonst'];
const MANDANT_FELDER = ['id', 'name', 'rechtsform', 'regime', 'bh', 'kosten', 'quote', 'gesellschafter', 'uew_plan', 'ident', '_locked'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fehler(code, status, detail) { const e = new Error(code); e.status = status || 400; if (detail) e.detail = detail; return e; }
function zahl(x) { if (x === null || x === undefined || x === '') return null; const n = Number(x); return isFinite(n) ? n : null; }
function text(x, max) { return x == null ? null : String(x).slice(0, max || 200); }
function iso(x) { const s = String(x == null ? '' : x).slice(0, 10); return ISO.test(s) ? s : null; }
function kist(x) { const n = Number(x); return n === 8 || n === 9 ? n : (n === 0 ? 0 : null); }
function janein(x) { return x === true || x === false ? x : null; }
function kopie(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }

/** Eingabe aus dem Browser des Kunden in die feste Form. Wirft 400 bei unbrauchbarer Form oder zu gross. */
function profilSauber(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw fehler('steuerprofil_ungueltig', 400, 'Das Steuerprofil hat keine gültige Form.');
  if (Buffer.byteLength(JSON.stringify(roh), 'utf8') > GRENZEN.bytes) throw fehler('steuerprofil_zu_gross', 413, 'Das Steuerprofil ist zu groß.');
  const zr = Array.isArray(roh.zeitraeume) ? roh.zeitraeume.slice(0, GRENZEN.zeitraeume) : [];
  const zeitraeume = zr.map((z) => ({
    valid_from: iso(z && z.valid_from), valid_to: iso(z && z.valid_to),
    zve: zahl(z && z.zve), splitting: janein(z && z.splitting), kirchensteuer: kist(z && z.kirchensteuer),
    label: text(z && (z.label || z.bezeichnung), 120)
  })).filter((z) => z.valid_from && z.zve != null && z.zve >= 0)
    .sort((a, b) => (a.valid_from < b.valid_from ? -1 : a.valid_from > b.valid_from ? 1 : 0));
  const a = roh.angaben && typeof roh.angaben === 'object' ? roh.angaben : {};
  const angaben = { splitting: a.splitting === true, kirchensteuer: kist(a.kirchensteuer) || 0 };
  const ml = Array.isArray(roh.mandanten) ? roh.mandanten.slice(0, GRENZEN.mandanten) : [];
  const mandanten = ml.filter((m) => m && typeof m === 'object' && m.id && String(m.id).length <= 60).map((m) => {
    const r = {};
    MANDANT_FELDER.forEach((k) => { if (m[k] !== undefined) r[k] = kopie(m[k]); });
    r.id = String(m.id); r.name = text(m.name, 120) || (r.id === 'privat' ? 'Privat' : 'Gesellschaft');
    r.rechtsform = RECHTSFORMEN.indexOf(m.rechtsform) >= 0 ? m.rechtsform : (r.id === 'privat' ? 'privat' : 'sonst');
    return r;
  });
  if (!mandanten.some((m) => m.id === 'privat')) mandanten.unshift({ id: 'privat', name: 'Privat', rechtsform: 'privat', regime: {}, bh: {}, _locked: true });
  const bl = Array.isArray(roh.bestand) ? roh.bestand.slice(0, GRENZEN.bestand) : [];
  const bestand = bl.filter((o) => o && UUID.test(String(o.id || ''))).map((o, i) => {
    const wk = {};
    const w = o.wk_per_year && typeof o.wk_per_year === 'object' ? o.wk_per_year : {};
    Object.keys(w).slice(0, GRENZEN.jahre).forEach((y) => { const n = zahl(w[y]); if (/^\d{4}$/.test(y) && n != null) wk[y] = n; });
    return { id: String(o.id), address: text(o.address, 200) || '', purchase_date: iso(o.purchase_date), wk_per_year: wk,
      halter: text(o.halter, 60) || 'privat', rang: Number.isInteger(o.rang) ? o.rang : i };
  });
  return { v: 1, erzeugt_am: (roh.erzeugt_am && !isNaN(Date.parse(roh.erzeugt_am))) ? new Date(roh.erzeugt_am).toISOString() : null,
    zeitraeume, angaben, mandanten, bestand, pro: roh.pro === true };
}

/** Ueberfuehrungen aus den Objekten des Kunden (Gesellschaftsseite). Rein, d = Objekt-JSON je Zeile. */
function ueberfuehrungenAus(zeilen) {
  const l = [];
  (zeilen || []).forEach((z) => {
    const d = z && (typeof z.data === 'string' ? (() => { try { return JSON.parse(z.data); } catch (e) { return {}; } })() : (z.data || {}));
    if (!d || String(d.obj_herkunft || '') !== 'ueberfuehrung') return;
    let ud = null; try { ud = d.ueberf_daten ? JSON.parse(d.ueberf_daten) : null; } catch (e) { ud = null; }
    l.push({
      objekt_id: z.id, adresse: [[d.str, d.hnr].filter(Boolean).join(' '), [d.plz, d.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || z.name || 'Objekt',
      halter: text(d.halter, 60) || null,
      stichtag: iso(d.halter_seit) || iso(ud && ud.stichtag) || iso(d.kaufdat),
      art: (ud && ud.art) || null,
      verkehrswert: zahl(d.verkehrswert_ueberf) != null ? zahl(d.verkehrswert_ueberf) : zahl(ud && ud.vw),
      kaufpreis: zahl(d.ueberf_preis) != null ? zahl(d.ueberf_preis) : zahl(ud && ud.kaufpreis),
      gesellschafterdarlehen: zahl(d.gesellschafterdarlehen) != null ? zahl(d.gesellschafterdarlehen) : zahl(ud && ud.gd && ud.gd.betrag),
      privat_id: UUID.test(String(d._ueberf_link || '')) ? d._ueberf_link : null
    });
  });
  return l.sort((a, b) => String(a.stichtag || '').localeCompare(String(b.stichtag || '')));
}

/** Pruefsumme des Inhalts ohne Erzeugungszeit: gleicher Inhalt = keine neue Fassung */
function inhaltHash(p) {
  const o = Object.assign({}, p); delete o.erzeugt_am;
  return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

/** _steuerbasis fuer die Kopie eines Objekts */
function basisFuer(row, origId, halter) {
  if (!row) return null;
  const t = row.zuletzt_am || row.empfangen_am;
  return { v: 1, profil_id: row.id, fassung: row.fassung, stand_am: t ? new Date(t).toISOString() : new Date().toISOString(),
    erzeugt_am: row.profil && row.profil.erzeugt_am || null, orig_id: origId || null, halter: halter || 'privat', profil: row.profil };
}

/** Ablegen: neue Fassung bei geaendertem Inhalt, sonst zuletzt_am nachziehen. Gibt die geltende Zeile zurueck. */
async function speichern(clientId, resellerId, profil, fg, q) {
  const qq = q || query;
  const h = inhaltHash(profil);
  const alt = (await qq(`SELECT * FROM partner_steuerprofile WHERE client_id = $1 AND ersetzt_am IS NULL ORDER BY fassung DESC LIMIT 1`, [clientId])).rows[0];
  if (alt && alt.inhalt_hash === h && String(alt.freigabe_id || '') === String((fg && fg.id) || '')) {
    const r = await qq(`UPDATE partner_steuerprofile SET zuletzt_am = now() WHERE id = $1 RETURNING *`, [alt.id]);
    return Object.assign(r.rows[0] || alt, { neu: false });
  }
  const max = (await qq(`SELECT COALESCE(MAX(fassung), 0)::int AS m FROM partner_steuerprofile WHERE client_id = $1`, [clientId])).rows[0];
  if (alt) await qq(`UPDATE partner_steuerprofile SET ersetzt_am = now() WHERE id = $1`, [alt.id]);
  const r = await qq(
    `INSERT INTO partner_steuerprofile (client_id, reseller_id, fassung, profil, inhalt_hash, freigabe_id, freigabe_art, erzeugt_am)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8) RETURNING *`,
    [clientId, resellerId, ((max && max.m) || 0) + 1, JSON.stringify(profil), h, (fg && fg.id) || null, (fg && fg.art) || null, profil.erzeugt_am || null]);
  return Object.assign(r.rows[0], { neu: true });
}

/** Lesen fuer den Partner: geltende Fassung mit Inhalt und Liste aller Fassungen (ohne Inhalt) */
async function lesen(clientId) {
  const l = (await query(
    `SELECT p.id, p.fassung, p.freigabe_id, p.freigabe_art, p.erzeugt_am, p.empfangen_am, p.zuletzt_am, p.ersetzt_am,
            f.art AS freigabe_art_jetzt, f.erteilt_am AS freigabe_erteilt_am
       FROM partner_steuerprofile p LEFT JOIN partner_freigaben f ON f.id = p.freigabe_id
      WHERE p.client_id = $1 ORDER BY p.fassung DESC LIMIT 50`, [clientId])).rows;
  const akt = l.filter((x) => !x.ersetzt_am)[0] || null;
  const voll = akt ? (await query(`SELECT profil FROM partner_steuerprofile WHERE id = $1`, [akt.id])).rows[0] : null;
  return { aktuell: akt ? Object.assign({}, akt, { profil: voll && voll.profil }) : null, fassungen: l };
}
async function fassung(clientId, nr) {
  const r = (await query(`SELECT * FROM partner_steuerprofile WHERE client_id = $1 AND fassung = $2`, [clientId, parseInt(nr, 10) || 0])).rows[0];
  return r || null;
}
/** Widerruf mit „auch zurueckziehen“: die uebermittelten Profile gehen mit */
async function entfernen(clientId) {
  const r = await query(`DELETE FROM partner_steuerprofile WHERE client_id = $1`, [clientId]);
  return r.rowCount || 0;
}

module.exports = { GRENZEN, profilSauber, ueberfuehrungenAus, inhaltHash, basisFuer, speichern, lesen, fassung, entfernen };
