'use strict';
/* services/objektFotos.js — v3310 · FOTOS NICHT MEHR ALS BASE64 IN DER OBJEKTZEILE
 *
 * Befund 11.11.2026 (Dateien/Architektur/Skalierung-und-Makler-Hub-2026-11-11.md): von 32 MB der Tabelle
 * objects waren 24 MB Fotos als base64 in objects.photos. Jede Sicherung, jedes Laden eines Objekts trug
 * sie mit. Marcel hat am 11.11. freigegeben: neue Fotos in die Dateiablage, in der Zeile nur ein Verweis.
 *
 * ── Form in objects.photos ───────────────────────────────────────────────
 *   'dpfoto:<uuid>'          Verweis auf eine Zeile in `dateien` (quelle 'objektfoto'); Metadaten
 *                            (mime, groesse, sha256, object_id) stehen dort, die Datei verschlüsselt
 *                            im Laufwerk (dateiAblage._schreiben/_lesen).
 *   'data:image/…;base64,…'  Altbestand oder Rückfall (Ablage nicht eingerichtet, Fehler) — bleibt lesbar.
 *
 * ── Warum der Server die Verweise beim Lesen wieder auflöst ───────────────
 * Alle Leser (Objektkarte, Galerie, Exposé, PDF-Dienst, Freigabe an Partner, Pass, Export, Kopieren)
 * bekommen dieselbe Form wie bisher: data-URLs. Kein Leser musste umgebaut werden, und es gibt KEINE
 * eigene Foto-Adresse — ein Foto ist nur über GET /objects/:id erreichbar, also nur für den Eigentümer
 * oder einen Partner mit aktiver Freigabe (dieselbe Regel wie für das Objekt selbst). Nichts zu raten.
 *
 * ── Speichern ────────────────────────────────────────────────────────────
 * Das Frontend schickt beim Speichern die data-URLs zurück. Gleiche Prüfsumme am selben Objekt = dieselbe
 * Datei (kein Doppel). Ein Foto, das nicht mehr im Objekt steht, wird beim nächsten Speichern entfernt —
 * mit fünf Minuten Nachfrist, damit zwei gleichzeitige Speichervorgänge sich nicht gegenseitig die Datei
 * wegräumen.
 *
 * Fotos zählen NICHT in den Speicherplatz der Unterlagen-Ablage und erscheinen dort nicht in der Liste —
 * wer sie dort löschte, risse ein Loch ins Objekt.
 *
 * Ohne data._thumb (kleines Vorschaubild der Objektliste) bleibt das ERSTE Foto inline: die Listenabfrage
 * nimmt dann photos[0] als Titelbild und kann keinen Verweis auflösen.
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const ablage = require('./dateiAblage');

const PRAEFIX = 'dpfoto:';
const QUELLE = 'objektfoto';
const ORDNER = 'Objektfotos';
const NACHFRIST_MIN = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,/i;

function istVerweis(s) { return typeof s === 'string' && s.indexOf(PRAEFIX) === 0 && UUID.test(s.slice(PRAEFIX.length)); }
function verweisId(s) { return istVerweis(s) ? s.slice(PRAEFIX.length).toLowerCase() : null; }
function _alsListe(p) {
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { return []; } }
  return Array.isArray(p) ? p : [];
}

/** Ein Foto in die Ablage. Gibt den Verweis zurück oder null (dann bleibt es inline). */
async function _einFoto(userId, objectId, src, nr) {
  const m = DATA_URL.exec(src);
  if (!m) return null;
  const puffer = Buffer.from(src.slice(m[0].length), 'base64');
  if (!puffer.length || puffer.length > ablage.MAX_DATEI) return null;
  const sha = crypto.createHash('sha256').update(puffer).digest('hex');
  const alt = await query(
    'SELECT id FROM dateien WHERE user_id = $1 AND object_id = $2 AND quelle = $3 AND sha256 = $4 AND deleted_at IS NULL ORDER BY created_at LIMIT 1',
    [userId, objectId, QUELLE, sha]);
  if (alt.rowCount) return PRAEFIX + alt.rows[0].id;
  const schluessel = crypto.randomBytes(16).toString('hex');
  await ablage._schreiben(userId, schluessel, puffer);
  const endung = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg').slice(0, 8);
  try {
    const r = await query(
      'INSERT INTO dateien (user_id, object_id, ordner, name, mime, groesse, sha256, ablage_schluessel, quelle, meta) '
      + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [userId, objectId, ORDNER, 'foto-' + (nr + 1) + '.' + endung, m[1].toLowerCase(), puffer.length, sha, schluessel, QUELLE,
        JSON.stringify({ v: 3310 })]);
    return PRAEFIX + r.rows[0].id;
  } catch (e) { await ablage._entfernen(userId, schluessel); throw e; }
}

/**
 * Fotos eines Objekts für die Zeile vorbereiten: data-URLs → Verweise.
 * Gibt das Array zurück, das in objects.photos geschrieben wird. Wirft nie — im Zweifel bleibt ein Foto inline.
 * @param {object} [daten] data des Objekts (für die _thumb-Regel)
 */
async function zumSpeichern(userId, objectId, photos, daten) {
  const liste = _alsListe(photos);
  if (!liste.length || !objectId || !ablage.bereit()) return liste;
  const ohneVorschau = !(daten && typeof daten === 'object' && typeof daten._thumb === 'string' && daten._thumb);
  const aus = [];
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    if (typeof p !== 'string') continue;
    if (istVerweis(p)) {
      /* ein Verweis gilt nur, wenn die Datei diesem Konto gehört - fremde Verweise fallen weg */
      try {
        const r = await query('SELECT 1 FROM dateien WHERE id = $1 AND user_id = $2 AND quelle = $3 AND deleted_at IS NULL', [verweisId(p), userId, QUELLE]);
        if (r.rowCount) aus.push(p); else console.warn('[objekt-fotos] fremder oder fehlender Verweis verworfen:', p);
      } catch (e) { console.warn('[objekt-fotos] Verweis-Prüfung:', e.message); }
      continue;
    }
    if (i === 0 && ohneVorschau) { aus.push(p); continue; }
    try { aus.push((await _einFoto(userId, objectId, p, i)) || p); }
    catch (e) { console.warn('[objekt-fotos] Ablage fehlgeschlagen, Foto bleibt in der Zeile:', e.message); aus.push(p); }
  }
  return aus;
}

/** Nach dem Schreiben: Fotodateien des Objekts entfernen, die die Zeile nicht mehr nennt (mit Nachfrist). */
async function aufraeumen(userId, objectId) {
  try {
    const r = await query(
      `UPDATE dateien d SET deleted_at = NOW()
         FROM objects o
        WHERE d.object_id = $1 AND d.user_id = $2 AND d.quelle = $3 AND d.deleted_at IS NULL
          AND d.created_at < NOW() - make_interval(mins => $4::int)
          AND o.id = d.object_id
          AND NOT (o.photos @> to_jsonb($5::text || d.id::text))
        RETURNING d.ablage_schluessel`,
      [objectId, userId, QUELLE, NACHFRIST_MIN, PRAEFIX]);
    for (const z of r.rows) await ablage._entfernen(userId, z.ablage_schluessel);
    return r.rowCount;
  } catch (e) { console.warn('[objekt-fotos] Aufräumen:', e.message); return 0; }
}

/** Objekt wird gelöscht: alle seine Fotodateien vom Laufwerk (VOR dem DELETE rufen, die FK setzt sonst NULL). */
async function objektLeeren(userId, objectId) {
  try {
    const r = await query('UPDATE dateien SET deleted_at = NOW() WHERE object_id = $1 AND user_id = $2 AND quelle = $3 AND deleted_at IS NULL RETURNING ablage_schluessel',
      [objectId, userId, QUELLE]);
    for (const z of r.rows) await ablage._entfernen(userId, z.ablage_schluessel);
    return r.rowCount;
  } catch (e) { console.warn('[objekt-fotos] Objekt leeren:', e.message); return 0; }
}

/**
 * Lesen: Verweise → data-URLs. Altbestand (data-URL) bleibt, wie er ist. Ein Verweis wird nur mit der
 * user_id des EIGENTÜMERS aufgelöst (die Zeile in dateien muss ihm gehören). Fehlt eine Datei, fällt
 * das Foto weg (Warnung im Log) statt die ganze Antwort zu verderben.
 */
async function zumLesen(ownerId, photos) {
  const liste = _alsListe(photos);
  if (!liste.some(istVerweis)) return liste;
  const ids = liste.filter(istVerweis).map(verweisId);
  let zeilen = {};
  try {
    const r = await query('SELECT id, mime, ablage_schluessel FROM dateien WHERE id = ANY($1::uuid[]) AND user_id = $2 AND quelle = $3 AND deleted_at IS NULL',
      [ids, ownerId, QUELLE]);
    r.rows.forEach((z) => { zeilen[String(z.id).toLowerCase()] = z; });
  } catch (e) { console.warn('[objekt-fotos] Lesen:', e.message); }
  const aus = [];
  for (const p of liste) {
    if (!istVerweis(p)) { aus.push(p); continue; }
    const z = zeilen[verweisId(p)];
    if (!z) { console.warn('[objekt-fotos] Verweis ohne Datei:', p); continue; }
    try { aus.push('data:' + (z.mime || 'image/jpeg') + ';base64,' + (await ablage._lesen(ownerId, z.ablage_schluessel)).toString('base64')); }
    catch (e) { console.warn('[objekt-fotos] Datei nicht lesbar:', p, e.message); }
  }
  return aus;
}

module.exports = { zumSpeichern, zumLesen, aufraeumen, objektLeeren, istVerweis, verweisId, PRAEFIX, QUELLE, NACHFRIST_MIN };
