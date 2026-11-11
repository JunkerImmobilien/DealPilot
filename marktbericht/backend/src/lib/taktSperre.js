// lib/taktSperre.js — v3311 · Sperre gegen Doppellauf der Takte im Marktbericht-Backend
//
// Gegenstück zu backend/src/utils/taktSperre.js (anderes Image, eigene Datenbank, ESM) — dieselbe Bauart:
// pg_try_advisory_lock(NAMENSRAUM, nr) auf einer Verbindung, die bis zum Ende des Laufs gehalten wird,
// Freigabe im finally, bei kaputter Freigabe wird die Verbindung verworfen (Sitzungsende gibt frei).
// Wer die Sperre nicht bekommt, setzt diese Runde aus. Feste Nummern, nie aus dem Namen gerechnet.
// db.js wird erst beim ersten echten Lauf geladen - so prüft tools/takt-sperre-pruefen.mjs die echte Datei ohne pg.

export const NAMENSRAUM = 0x4d425431; // „MBT1“
export const SCHLUESSEL = Object.freeze({
  harvest: 1,        // lib/harvestScheduler.js, alle 6 h
  baustatistik: 2,   // services/BaustatistikService.js, alle 12 h (monatlicher Abgleich)
  jahreswerte: 3,    // services/JahreswerteService.js
  makro: 4,          // services/MakroImportService.js (Makro + Gemeinden)
});

const log = (t) => console.log('[takt-sperre] ' + t);

export async function mitSperre(name, fn, opt) {
  const nr = SCHLUESSEL[name];
  if (nr == null) throw new Error('taktSperre: unbekannter Takt "' + name + '"');
  const pool = (opt && opt.pool) || (await import('./db.js')).pool;
  const client = await pool.connect();
  let gehalten = false, kaputt = false;
  const t0 = Date.now();
  try {
    const r = await client.query('SELECT pg_try_advisory_lock($1::int, $2::int) AS ok', [NAMENSRAUM, nr]);
    if (!(r.rows[0] && r.rows[0].ok)) { log(name + ': läuft schon in einer anderen Sitzung/Instanz - diese Runde übersprungen'); return { lief: false }; }
    gehalten = true;
    log(name + ': Sperre ' + nr + ' gehalten');
    const ergebnis = await fn();
    return { lief: true, ergebnis };
  } finally {
    if (gehalten) {
      try { await client.query('SELECT pg_advisory_unlock($1::int, $2::int)', [NAMENSRAUM, nr]); }
      catch (e) { kaputt = true; log(name + ': Freigabe fehlgeschlagen, Verbindung wird verworfen (' + e.message + ')'); }
      log(name + ': fertig nach ' + Math.round((Date.now() - t0) / 1000) + ' s, Sperre frei');
    }
    client.release(kaputt || undefined);
  }
}

export function takt(name, fn, opt) {
  return () => mitSperre(name, fn, opt).catch((e) => { console.error('[takt-sperre] ' + name + ': ' + (e && e.message)); return { lief: false, fehler: e && e.message }; });
}
