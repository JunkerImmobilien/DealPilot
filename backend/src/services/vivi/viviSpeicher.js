'use strict';
/* services/vivi/viviSpeicher.js — v3950 · Datenbank der ViVi-Anbindung (Migration 125)
 *
 * Alle SQL-Zugriffe an EINER Stelle, damit tools/vivi-pruefen.mjs sie durch einen Speicher im Arbeitsspeicher
 * ersetzen kann (gleiche Methoden, gleiche Bedeutung). Der Token liegt NICHT hier, sondern in
 * user_provider_credentials (providerCredentialsService, Anbieter 'vivi').
 */
function q(t, p) { return require('../../db/pool').query(t, p); }

const ABGEBROCHEN_NACH_MIN = 10;   /* eine 'laeuft'-Zeile ohne Bewegung gilt danach als abgebrochen */

async function objektHolen(userId, objectId) {
  const r = await q('SELECT id, data FROM objects WHERE id = $1 AND user_id = $2', [objectId, userId]);
  return r.rows[0] || null;
}

async function verknuepfung(userId, objectId) {
  const r = await q('SELECT * FROM vivi_verknuepfung WHERE object_id = $1 AND user_id = $2', [objectId, userId]);
  return r.rows[0] || null;
}

/**
 * Beansprucht das Objekt fuer EIN Anlegen. Gibt die Zeile zurueck oder null, wenn schon angelegt bzw. ein
 * anderer Lauf gerade anlegt. Atomar: INSERT ... ON CONFLICT DO NOTHING, Fortsetzen nur aus 'abgebrochen'
 * oder aus einem 'laeuft', das seit ABGEBROCHEN_NACH_MIN Minuten still steht.
 */
async function beanspruchen(userId, objectId, accountId) {
  const neu = await q(
    `INSERT INTO vivi_verknuepfung (object_id, user_id, vivi_account_id, herkunft, anlage_status)
     VALUES ($1, $2, $3, 'angelegt', 'laeuft')
     ON CONFLICT (object_id) DO NOTHING RETURNING *`, [objectId, userId, accountId || null]);
  if (neu.rows[0]) return { zeile: neu.rows[0], fortsetzen: false };
  const weiter = await q(
    `UPDATE vivi_verknuepfung SET anlage_status = 'laeuft', aktualisiert_am = now(), letzter_fehler = NULL
      WHERE object_id = $1 AND user_id = $2 AND herkunft = 'angelegt'
        AND (anlage_status = 'abgebrochen'
             OR (anlage_status = 'laeuft' AND aktualisiert_am < now() - ($3::text || ' minutes')::interval))
      RETURNING *`, [objectId, userId, String(ABGEBROCHEN_NACH_MIN)]);
  if (weiter.rows[0]) return { zeile: weiter.rows[0], fortsetzen: true };
  return null;
}

async function idsSpeichern(objectId, viviIds, viviObjektId) {
  await q(`UPDATE vivi_verknuepfung SET vivi_ids = $2::jsonb, vivi_objekt_id = COALESCE($3, vivi_objekt_id), aktualisiert_am = now()
            WHERE object_id = $1`, [objectId, JSON.stringify(viviIds || {}), viviObjektId || null]);
}

async function statusSetzen(objectId, status, fehlerText) {
  await q(`UPDATE vivi_verknuepfung SET anlage_status = $2, letzter_fehler = $3, aktualisiert_am = now() WHERE object_id = $1`,
    [objectId, status, fehlerText ? String(fehlerText).slice(0, 500) : null]);
}

/* Ein vorhandenes ViVi-Objekt verknuepfen (nichts wird an ViVi gesendet). null, wenn schon verknuepft. */
async function zuordnen(userId, objectId, viviObjektId, accountId) {
  const r = await q(
    `INSERT INTO vivi_verknuepfung (object_id, user_id, vivi_objekt_id, vivi_account_id, herkunft, anlage_status)
     VALUES ($1, $2, $3, $4, 'zugeordnet', 'fertig')
     ON CONFLICT (object_id) DO NOTHING RETURNING *`, [objectId, userId, String(viviObjektId), accountId || null]);
  return r.rows[0] || null;
}

/* v4050 · Import: das DealPilot-Objekt entsteht aus einem ViVi-Objekt. Die Verknuepfung ist sofort fertig (nichts wird
   in ViVi angelegt). null, wenn dieses ViVi-Objekt beim Nutzer schon verknuepft ist (UNIQUE user_id, vivi_objekt_id). */
async function importVerknuepfen(userId, objectId, viviObjektId, accountId, viviIds) {
  const r = await q(
    `INSERT INTO vivi_verknuepfung (object_id, user_id, vivi_objekt_id, vivi_account_id, vivi_ids, herkunft, anlage_status)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'importiert', 'fertig')
     ON CONFLICT DO NOTHING RETURNING *`, [objectId, userId, String(viviObjektId), accountId || null, JSON.stringify(viviIds || {})]);
  return r.rows[0] || null;
}
/* v4050 · alle ViVi-Objekt-IDs, die der Nutzer schon verknuepft hat (auch Kundenstaende, damit nichts doppelt kommt) */
async function verknuepfteViviIds(userId) {
  const r = await q('SELECT vivi_objekt_id FROM vivi_verknuepfung WHERE user_id = $1 AND vivi_objekt_id IS NOT NULL', [userId]);
  return r.rows.map(function (x) { return String(x.vivi_objekt_id); });
}
/* v4050 · Felder am Objekt ergaenzen (oberste Ebene, jsonb ||). Nur fuer den Import: Bewirtschaftung zum Kaufdatum. */
async function objektDatenErgaenzen(userId, objectId, patch) {
  if (!patch || !Object.keys(patch).length) return;
  await q('UPDATE objects SET data = data || $3::jsonb, version = version + 1, updated_at = now() WHERE id = $1 AND user_id = $2', [objectId, userId, JSON.stringify(patch)]);
}

/* Loest NUR die DealPilot-Seite. In ViVi bleibt alles, wie es ist. */
async function loesen(userId, objectId) {
  const r = await q('DELETE FROM vivi_verknuepfung WHERE object_id = $1 AND user_id = $2 RETURNING object_id', [objectId, userId]);
  return r.rowCount > 0;
}

async function werteSchreiben(objectId, felder, info) {
  /* ersetzt den Stand: was ViVi nicht mehr liefert, faellt weg */
  await q('DELETE FROM vivi_werte WHERE object_id = $1 AND jahr = 0', [objectId]);
  const eintraege = Object.keys(felder || {}).map(function (k) { return [k, felder[k]]; });
  /* Zusatzangaben ohne eigenes Eingabefeld (Restschuld als Gegenprobe, Zuordnung der Einheiten, weitere Darlehen) */
  Object.keys(info || {}).forEach(function (k) { if (info[k] != null) eintraege.push(['_info.' + k, { wert: info[k], quelle: k === 'restschuld_heute' ? 'financing-schedule' : null }]); });
  for (const [feld, w] of eintraege) {
    await q(`INSERT INTO vivi_werte (object_id, feld, jahr, wert, vivi_quelle, gelesen_am) VALUES ($1, $2, 0, $3::jsonb, $4, now())
             ON CONFLICT (object_id, feld, jahr) DO UPDATE SET wert = EXCLUDED.wert, vivi_quelle = EXCLUDED.vivi_quelle, gelesen_am = now()`,
      [objectId, feld, JSON.stringify(w.wert), w.quelle || null]);
  }
  await q('UPDATE vivi_verknuepfung SET letzter_abruf = now(), letzter_fehler = NULL WHERE object_id = $1', [objectId]);
}

/* v4040 · einzelne Felder (jahr = 0) ergaenzen, ohne den Stand zu ersetzen (Bewirtschaftung aus dem Steuerjahr) */
async function werteErgaenzen(objectId, felder) {
  for (const feld of Object.keys(felder || {})) {
    const w = felder[feld];
    await q(`INSERT INTO vivi_werte (object_id, feld, jahr, wert, vivi_quelle, gelesen_am) VALUES ($1, $2, 0, $3::jsonb, $4, now())
             ON CONFLICT (object_id, feld, jahr) DO UPDATE SET wert = EXCLUDED.wert, vivi_quelle = EXCLUDED.vivi_quelle, gelesen_am = now()`,
      [objectId, feld, JSON.stringify(w.wert), w.quelle || null]);
  }
}

/* v4020 · Paket V4: Steuerjahre (jahr > 0). Ersetzt nur die gelesenen Jahre, aeltere Jahre bleiben stehen. */
async function steuerSchreiben(objectId, jahre, felder) {
  const J = (jahre || []).map(Number).filter(function (j) { return j > 0; });
  if (!J.length) return;
  await q("DELETE FROM vivi_werte WHERE object_id = $1 AND jahr = ANY($2::int[]) AND feld LIKE 'steuer.%'", [objectId, J]);
  for (const feld of Object.keys(felder || {})) {
    const m = /^steuer\.(\d{4})\./.exec(feld); if (!m || J.indexOf(+m[1]) < 0) continue;
    await q(`INSERT INTO vivi_werte (object_id, feld, jahr, wert, vivi_quelle, gelesen_am) VALUES ($1, $2, $3, $4::jsonb, 'tax-overview', now())
             ON CONFLICT (object_id, feld, jahr) DO UPDATE SET wert = EXCLUDED.wert, vivi_quelle = EXCLUDED.vivi_quelle, gelesen_am = now()`,
      [objectId, feld, +m[1], JSON.stringify(felder[feld])]);
  }
}

/* v4020 · Einstellung „Steuerjahre aus ViVi“ je Nutzer im allgemeinen Einstellungsspeicher (user_settings, Migration 074) */
const EINSTELLUNG = 'vivi_steuer';
async function einstellungLesen(userId) {
  const r = await q('SELECT wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = $2', [userId, EINSTELLUNG]);
  return r.rows[0] ? r.rows[0].wert : null;
}
async function einstellungSchreiben(userId, wert) {
  await q(`INSERT INTO user_settings (user_id, schluessel, wert, updated_at) VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = $3::jsonb, updated_at = NOW()`, [userId, EINSTELLUNG, JSON.stringify(wert || {})]);
}

async function abrufFehler(objectId, text) {
  await q('UPDATE vivi_verknuepfung SET letzter_fehler = $2 WHERE object_id = $1', [objectId, String(text || '').slice(0, 500)]);
}

async function werteLesen(objectId) {
  const r = await q('SELECT feld, jahr, wert, vivi_quelle, gelesen_am FROM vivi_werte WHERE object_id = $1 ORDER BY feld', [objectId]);
  return r.rows;
}

async function verknuepfteObjekte(userId) {
  const r = await q(`SELECT v.object_id, v.vivi_objekt_id, v.anlage_status, v.herkunft, v.letzter_abruf, v.letzter_fehler,
                            o.data->>'str' AS str, o.data->>'hnr' AS hnr, o.data->>'ort' AS ort
                       FROM vivi_verknuepfung v JOIN objects o ON o.id = v.object_id
                      WHERE v.user_id = $1 AND o.kunden_freigabe_id IS NULL ORDER BY v.angelegt_am`, [userId]);   /* Kundenstaende (Partnerkopien) nie in der ViVi-Liste */
  return r.rows;
}

/* Fuer den Takt: verknuepfte, fertige Objekte, deren letzter Abruf aelter als stunden ist. */
async function faelligeAbrufe(stunden, grenze) {
  const r = await q(`SELECT object_id, user_id FROM vivi_verknuepfung
                      WHERE anlage_status = 'fertig' AND vivi_objekt_id IS NOT NULL
                        AND (letzter_abruf IS NULL OR letzter_abruf < now() - ($1::text || ' hours')::interval)
                      ORDER BY user_id, letzter_abruf NULLS FIRST LIMIT $2`, [String(stunden), grenze]);
  return r.rows;
}

async function protokoll(eintrag) {
  try {
    await q(`INSERT INTO vivi_protokoll (user_id, object_id, art, anfragen, bremse_429, ok, fehler, dauer_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [eintrag.user_id || null, eintrag.object_id || null, eintrag.art, eintrag.anfragen || 0, !!eintrag.bremse_429,
        eintrag.ok !== false, eintrag.fehler ? String(eintrag.fehler).slice(0, 500) : null, eintrag.dauer_ms || null]);
  } catch (e) { console.error('[vivi] Protokoll nicht geschrieben:', e.message); }
}

module.exports = {
  importVerknuepfen, verknuepfteViviIds, objektDatenErgaenzen,
  objektHolen, verknuepfung, beanspruchen, idsSpeichern, statusSetzen, zuordnen, loesen,
  werteSchreiben, werteErgaenzen, steuerSchreiben, einstellungLesen, einstellungSchreiben, abrufFehler, werteLesen, verknuepfteObjekte, faelligeAbrufe, protokoll, ABGEBROCHEN_NACH_MIN
};
