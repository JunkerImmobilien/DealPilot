'use strict';
/* services/dateiAblage.js — v3162 · UNTERLAGEN AUF DEM EIGENEN SERVER
 *
 * Marcel 03.11.2026: „können wir auch auf unserem Server speichern um erstmal weiter zu machen … Struktur
 * Ordner mit Unterordnern möglich?“ Grenzen je Plan (Vorschlag übernommen): Free 100 MB · Starter 500 MB ·
 * Investor 2 GB · Pro 10 GB · Partner 25 GB; eine Datei höchstens 25 MB.
 *
 * ── Wo die Dateien liegen ────────────────────────────────────────────────
 * Laufwerk backend_uploads (/app/uploads, übersteht den Neubau des Containers), darunter
 * dateien/<user_id>/<datei_id>. Jede Datei ist mit AES-256-GCM verschlüsselt; der Schlüssel steht in der
 * .env (DATEI_SCHLUESSEL, 64 Hex-Zeichen). Ohne Schlüssel wird NICHT gespeichert (fail closed) — eine
 * unverschlüsselte Ablage von Mietverträgen soll es nicht still geben.
 *
 * ── Später: eigener Speicher ─────────────────────────────────────────────
 * Alles Lesen/Schreiben läuft über _schreiben/_lesen/_entfernen. Ein Umzug auf einen S3-Speicher ersetzt
 * nur diese drei Funktionen; Tabelle, Aufrufe und App bleiben.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../db/pool');

const BASIS = process.env.DATEI_ABLAGE_DIR || path.join(__dirname, '..', '..', 'uploads', 'dateien');
const MAX_DATEI = 25 * 1024 * 1024;
const MB = 1024 * 1024;
const GRENZE_JE_PLAN = { free: 100 * MB, starter: 500 * MB, investor: 2048 * MB, pro: 10240 * MB, partner: 25600 * MB };

function _schluessel() {
  const k = String(process.env.DATEI_SCHLUESSEL || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(k)) return null;
  return Buffer.from(k, 'hex');
}
function bereit() { return !!_schluessel(); }

/* Ordnerpfad säubern: keine „..“, keine führenden/doppelten Schrägstriche, höchstens 8 Ebenen */
function ordnerSauber(o) {
  return String(o || '').replace(/\\/g, '/').split('/').map((t) => t.trim().replace(/[\u0000-\u001f<>:"|?*]/g, '').slice(0, 80))
    .filter((t) => t && t !== '.' && t !== '..').slice(0, 8).join('/');
}
function nameSauber(n) {
  const s = String(n || 'Datei').replace(/[\\/]/g, '_').replace(/[\u0000-\u001f<>:"|?*]/g, '').trim().slice(0, 180);
  return s || 'Datei';
}

/* ── Laufwerk (austauschbar) ── */
function _pfad(userId, schluessel) { return path.join(BASIS, String(userId), String(schluessel)); }
async function _schreiben(userId, schluessel, puffer) {
  const k = _schluessel(); if (!k) throw new Error('Ablage nicht eingerichtet (DATEI_SCHLUESSEL fehlt)');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const verschl = Buffer.concat([c.update(puffer), c.final()]);
  const tag = c.getAuthTag();
  await fs.promises.mkdir(path.join(BASIS, String(userId)), { recursive: true });
  await fs.promises.writeFile(_pfad(userId, schluessel), Buffer.concat([Buffer.from('DPA1'), iv, tag, verschl]));
}
async function _lesen(userId, schluessel) {
  const k = _schluessel(); if (!k) throw new Error('Ablage nicht eingerichtet (DATEI_SCHLUESSEL fehlt)');
  const b = await fs.promises.readFile(_pfad(userId, schluessel));
  if (b.slice(0, 4).toString() !== 'DPA1') throw new Error('Dateiformat unbekannt');
  const iv = b.slice(4, 16), tag = b.slice(16, 32), daten = b.slice(32);
  const d = crypto.createDecipheriv('aes-256-gcm', k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(daten), d.final()]);
}
async function _entfernen(userId, schluessel) {
  try { await fs.promises.unlink(_pfad(userId, schluessel)); } catch (e) { /* schon weg */ }
}

/* ── Grenzen ── */
async function stand(userId) {
  let plan = 'free';
  try { const eff = await require('./subscriptionService').getEffectivePlan(userId); if (eff && eff.plan_id) plan = String(eff.plan_id); } catch (e) {}
  const grenze = GRENZE_JE_PLAN[plan] != null ? GRENZE_JE_PLAN[plan] : GRENZE_JE_PLAN.free;
  const r = await query('SELECT COALESCE(SUM(groesse), 0)::bigint AS belegt, COUNT(*)::int AS anzahl FROM dateien WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
  const belegt = Number(r.rows[0].belegt) || 0;
  return { plan, grenze_bytes: grenze, belegt_bytes: belegt, frei_bytes: Math.max(0, grenze - belegt), anzahl: r.rows[0].anzahl, max_datei_bytes: MAX_DATEI, bereit: bereit() };
}

async function _objektGehoert(userId, objectId) {
  if (!objectId) return true;
  const r = await query('SELECT 1 FROM objects WHERE id = $1 AND user_id = $2', [objectId, userId]);
  return r.rowCount > 0;
}

/** Datei ablegen. Gibt die Zeile zurück oder wirft mit .status (400/403/413/507). */
async function ablegen(userId, opts) {
  const puffer = opts.puffer;
  const fehler = (s, t) => { const e = new Error(t); e.status = s; return e; };
  if (!bereit()) throw fehler(503, 'Die Ablage ist auf diesem Server noch nicht eingerichtet.');
  if (!Buffer.isBuffer(puffer) || !puffer.length) throw fehler(400, 'Leere Datei.');
  if (puffer.length > MAX_DATEI) throw fehler(413, 'Datei größer als 25 MB.');
  if (!(await _objektGehoert(userId, opts.objectId))) throw fehler(403, 'Objekt gehört nicht zu diesem Konto.');
  const sha = crypto.createHash('sha256').update(puffer).digest('hex');
  /* dieselbe Datei im selben Ordner desselben Objekts nicht doppelt ablegen */
  const ordner = ordnerSauber(opts.ordner);
  const dup = await query('SELECT id, user_id, object_id, ordner, name, mime, groesse, sha256, quelle, meta, created_at FROM dateien WHERE user_id = $1 AND sha256 = $2 AND ordner = $3 AND object_id IS NOT DISTINCT FROM $4 AND deleted_at IS NULL LIMIT 1',
    [userId, sha, ordner, opts.objectId || null]);
  if (dup.rowCount) return Object.assign({ doppelt: true }, dup.rows[0]);
  const s = await stand(userId);
  if (puffer.length > s.frei_bytes) throw fehler(507, 'Speicher voll: ' + Math.round(s.belegt_bytes / MB) + ' von ' + Math.round(s.grenze_bytes / MB) + ' MB belegt (Plan ' + s.plan + ').');
  const schluessel = crypto.randomBytes(16).toString('hex');
  await _schreiben(userId, schluessel, puffer);
  try {
    const r = await query(
      'INSERT INTO dateien (user_id, object_id, ordner, name, mime, groesse, sha256, ablage_schluessel, quelle, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) '
      + 'RETURNING id, user_id, object_id, ordner, name, mime, groesse, sha256, quelle, meta, created_at',
      [userId, opts.objectId || null, ordner, nameSauber(opts.name), String(opts.mime || 'application/octet-stream').slice(0, 120), puffer.length, sha, schluessel,
        String(opts.quelle || 'upload').slice(0, 20), JSON.stringify(opts.meta || {})]);
    return r.rows[0];
  } catch (e) { await _entfernen(userId, schluessel); throw e; }
}

async function liste(userId, objectId) {
  const args = [userId];
  let w = 'user_id = $1 AND deleted_at IS NULL';
  if (objectId === null) w += ' AND object_id IS NULL';
  else if (objectId) { args.push(objectId); w += ' AND object_id = $2'; }
  const r = await query('SELECT id, object_id, ordner, name, mime, groesse, sha256, quelle, meta, created_at, updated_at FROM dateien WHERE ' + w + ' ORDER BY ordner, name', args);
  return r.rows;
}

async function holen(userId, id) {
  const r = await query('SELECT * FROM dateien WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId]);
  if (!r.rowCount) return null;
  const z = r.rows[0];
  const puffer = await _lesen(userId, z.ablage_schluessel);
  return { zeile: z, puffer };
}

async function aendern(userId, id, opts) {
  const sets = [], args = [id, userId];
  if (opts.ordner !== undefined) { args.push(ordnerSauber(opts.ordner)); sets.push('ordner = $' + args.length); }
  if (opts.name !== undefined) { args.push(nameSauber(opts.name)); sets.push('name = $' + args.length); }
  if (opts.objectId !== undefined) {
    if (!(await _objektGehoert(userId, opts.objectId))) { const e = new Error('Objekt gehört nicht zu diesem Konto.'); e.status = 403; throw e; }
    args.push(opts.objectId || null); sets.push('object_id = $' + args.length);
  }
  if (!sets.length) return null;
  const r = await query('UPDATE dateien SET ' + sets.join(', ') + ', updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id, object_id, ordner, name, mime, groesse, quelle, updated_at', args);
  return r.rows[0] || null;
}

async function loeschen(userId, id) {
  const r = await query('UPDATE dateien SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING ablage_schluessel', [id, userId]);
  if (!r.rowCount) return false;
  await _entfernen(userId, r.rows[0].ablage_schluessel);
  return true;
}

/** Konto gelöscht: alle Dateien vom Laufwerk (die Zeilen löscht die Kaskade). */
async function kontoLeeren(userId) {
  try { await fs.promises.rm(path.join(BASIS, String(userId)), { recursive: true, force: true }); return true; } catch (e) { return false; }
}

module.exports = { ablegen, liste, holen, aendern, loeschen, stand, kontoLeeren, bereit, ordnerSauber, nameSauber, GRENZE_JE_PLAN, MAX_DATEI, _lesen, _schreiben };
