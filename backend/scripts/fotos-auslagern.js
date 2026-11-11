'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * scripts/fotos-auslagern.js — v3310 · Altbestand: base64-Fotos aus objects.photos in die Ablage
 *
 * Läuft IM Backend-Container (braucht DATEI_SCHLUESSEL und das Laufwerk backend_uploads):
 *
 *   docker exec dealpilot-backend node scripts/fotos-auslagern.js                 Trockenlauf (Standard)
 *   docker exec dealpilot-backend node scripts/fotos-auslagern.js --ausfuehren    umziehen
 *   docker exec dealpilot-backend node scripts/fotos-auslagern.js --ausfuehren --vacuum
 *
 * Von außen: node tools/fotos-auslagern.mjs (fragt den Server, verweigert --ausfuehren auf Produktion).
 *
 * Dieselbe Funktion wie beim Speichern (services/objektFotos.zumSpeichern) — keine zweite Rechnung.
 * Das erste Foto bleibt in der Zeile, wenn das Objekt kein Vorschaubild (data._thumb) hat, sonst
 * verlöre die Objektliste ihr Titelbild.
 *
 * updated_at bleibt stehen (der Trigger wird in EINER Transaktion abgeschaltet und wieder an), sonst
 * sortierte sich die Objektliste jedes Kunden um. version bleibt stehen: ein offener Tab speichert
 * danach weiter ohne Konflikt und landet über die Prüfsumme bei denselben Dateien.
 * Geschrieben wird nur, wenn photos sich seit dem Lesen nicht geändert hat (WHERE photos = alt).
 *
 * --vacuum: VACUUM FULL objects danach — erst dann wird die Tabelle auf der Platte kleiner
 * (sperrt die Tabelle für Sekunden; nur auf Staging gedacht).
 * ═══════════════════════════════════════════════════════════════════════════ */
const { pool, query } = require('../src/db/pool');
const objektFotos = require('../src/services/objektFotos');
const ablage = require('../src/services/dateiAblage');

const AUSFUEHREN = process.argv.includes('--ausfuehren');
const VACUUM = process.argv.includes('--vacuum');

async function groessen() {
  const r = await query(`SELECT pg_total_relation_size('objects')::bigint AS tabelle,
      COALESCE(SUM(pg_column_size(photos)), 0)::bigint AS photos_spalte,
      COUNT(*)::int AS objekte,
      COUNT(*) FILTER (WHERE photos::text LIKE '%data:image%')::int AS mit_inline,
      (SELECT COUNT(*) FROM dateien WHERE quelle = 'objektfoto' AND deleted_at IS NULL)::int AS fotodateien,
      (SELECT COALESCE(SUM(groesse),0) FROM dateien WHERE quelle = 'objektfoto' AND deleted_at IS NULL)::bigint AS fotodateien_bytes
    FROM objects`);
  return r.rows[0];
}
const mb = (b) => (Number(b) / 1048576).toFixed(2) + ' MB';

(async () => {
  const vorher = await groessen();
  console.log('[fotos-auslagern] ' + (AUSFUEHREN ? 'AUSFÜHREN' : 'TROCKENLAUF') + ' · Ablage bereit: ' + ablage.bereit());
  console.log('  vorher: Tabelle objects ' + mb(vorher.tabelle) + ' · Spalte photos ' + mb(vorher.photos_spalte)
    + ' · Objekte ' + vorher.objekte + ' · mit Inline-Foto ' + vorher.mit_inline + ' · Fotodateien ' + vorher.fotodateien + ' (' + mb(vorher.fotodateien_bytes) + ')');
  if (!ablage.bereit()) { console.log('  Ablage nicht eingerichtet (DATEI_SCHLUESSEL fehlt) - nichts zu tun'); await pool.end(); process.exit(AUSFUEHREN ? 1 : 0); }

  const r = await query(`SELECT id, user_id, photos, (data::jsonb->>'_thumb') IS NOT NULL AS hat_thumb
                           FROM objects WHERE photos::text LIKE '%data:image%' ORDER BY updated_at`);
  let objekte = 0, fotos = 0, bleiben = 0, bytes = 0;
  const neu = [];
  for (const o of r.rows) {
    const liste = Array.isArray(o.photos) ? o.photos : [];
    const inline = liste.filter((p) => typeof p === 'string' && p.indexOf('data:image') === 0);
    const erstesBleibt = !o.hat_thumb && typeof liste[0] === 'string' && liste[0].indexOf('data:image') === 0;
    const wandern = inline.length - (erstesBleibt ? 1 : 0);
    bleiben += erstesBleibt ? 1 : 0;
    if (wandern <= 0) continue;
    objekte++; fotos += wandern;
    bytes += inline.slice(erstesBleibt ? 1 : 0).reduce((s, p) => s + p.length, 0);
    if (AUSFUEHREN) {
      const aus = await objektFotos.zumSpeichern(o.user_id, o.id, liste, { _thumb: o.hat_thumb ? 'x' : '' });
      if (JSON.stringify(aus) !== JSON.stringify(liste)) neu.push({ id: o.id, alt: liste, aus });
    }
  }
  console.log('  zu verschieben: ' + fotos + ' Fotos in ' + objekte + ' Objekten (' + mb(bytes) + ' base64) · bleiben inline (Titelbild ohne _thumb): ' + bleiben);

  if (AUSFUEHREN && neu.length) {
    const c = await pool.connect();
    let geschrieben = 0, geaendert = 0;
    try {
      await c.query('BEGIN');
      await c.query('ALTER TABLE objects DISABLE TRIGGER objects_updated_at');
      for (const n of neu) {
        const u = await c.query('UPDATE objects SET photos = $1::jsonb WHERE id = $2 AND photos = $3::jsonb', [JSON.stringify(n.aus), n.id, JSON.stringify(n.alt)]);
        if (u.rowCount) geschrieben++; else geaendert++;
      }
      await c.query('ALTER TABLE objects ENABLE TRIGGER objects_updated_at');
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    console.log('  geschrieben: ' + geschrieben + ' Objekte · inzwischen geändert (übersprungen, beim nächsten Speichern): ' + geaendert);
    /* Dateien, die für übersprungene Objekte entstanden sind, räumt das nächste Speichern auf (Nachfrist) */
    if (VACUUM) { await query('VACUUM FULL objects'); console.log('  VACUUM FULL objects fertig'); }
    const nachher = await groessen();
    console.log('  nachher: Tabelle objects ' + mb(nachher.tabelle) + ' · Spalte photos ' + mb(nachher.photos_spalte)
      + ' · mit Inline-Foto ' + nachher.mit_inline + ' · Fotodateien ' + nachher.fotodateien + ' (' + mb(nachher.fotodateien_bytes) + ')');
  }
  await pool.end();
})().catch(async (e) => { console.error('[fotos-auslagern] FEHLER:', e.message); try { await pool.end(); } catch (_) {} process.exit(1); });
