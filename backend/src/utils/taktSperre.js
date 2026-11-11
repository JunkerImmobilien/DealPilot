'use strict';
/* utils/taktSperre.js — v3311 · SPERRE GEGEN DOPPELLAUF DER HINTERGRUND-TAKTE
 *
 * Befund 11.11.2026 (Dateien/Architektur/Skalierung-und-Makler-Hub-2026-11-11.md): jeder Takt läuft über
 * setInterval im Backend-Prozess. Mit einer zweiten Instanz liefe jeder doppelt — doppelte Mails, doppelte
 * ImmoMetrica-Abrufe, doppelte Löschläufe. Abhilfe: je Takt eine Postgres-Beratungssperre
 * (pg_try_advisory_lock). Wer sie nicht bekommt, setzt diese Runde aus.
 *
 * ── Wie ───────────────────────────────────────────────────────────────────
 * Eine Verbindung wird aus dem Pool genommen und bis zum Ende des Laufs gehalten — die Sperre hängt an der
 * SITZUNG, nicht an der Abfrage. Freigabe im finally (pg_advisory_unlock); scheitert die, wird die
 * Verbindung verworfen (release(true)), und Postgres gibt die Sperre mit der Sitzung frei. Bricht der
 * Prozess ab, fällt die Sperre mit der Verbindung — es bleibt nichts hängen.
 *
 * Auch im selben Prozess schützt sie: überholt ein Takt sich selbst (Lauf länger als der Abstand), bekommt
 * der zweite eine andere Sitzung und setzt aus.
 *
 * ── Schlüssel ────────────────────────────────────────────────────────────
 * Zwei-Zahlen-Form pg_try_advisory_lock(NAMENSRAUM, nr): NAMENSRAUM 0x44505431 („DPT1“) hält die Takte
 * getrennt von jeder anderen Beratungssperre. Die Nummern stehen FEST hier, nie aus dem Namen gerechnet
 * (ein umbenannter Takt behielte sonst nicht seinen Schlüssel). Ein unbekannter Name wirft.
 * Das Marktbericht-Backend hat seine eigene Datenbank und seine eigene Datei
 * (marktbericht/backend/src/lib/taktSperre.js) — anderes Image, ESM.
 */
const NAMENSRAUM = 0x44505431;
const SCHLUESSEL = Object.freeze({
  lifecycle: 1,          // Abo-Lifecycle (index.js, täglich)
  retention: 2,          // Kundenbindung Auslauf/Inaktiv/Testphase (Mails, täglich)
  mieterhoehung: 3,      // Erinnerung vor möglicher Mieterhöhung (Mails, täglich)
  sicherheitLoeschen: 4, // Löschkonzept security_events, IP-Anonymisierung (täglich)
  bauzins: 5,            // Bundesbank-Reihen (Start + täglich 18:00)
  immometricaFlow: 6,    // Flow Investor ImmoMetrica-Abruf (alle N h, Schalter)
  plansSync: 7           // Stripe-Preis-IDs gegen lookup_keys (einmal beim Start)
});

function _log(t) { console.log('[takt-sperre] ' + t); }

/**
 * fn nur ausführen, wenn keine andere Sitzung diesen Takt gerade hält.
 * @returns {Promise<{lief: boolean, ergebnis?: any}>}  wirft, wenn fn wirft (nach Freigabe)
 * @param {{ pool?: object }} [opt] pool zum Testen austauschbar
 */
async function mitSperre(name, fn, opt) {
  const nr = SCHLUESSEL[name];
  if (nr == null) throw new Error('taktSperre: unbekannter Takt "' + name + '"');
  const pool = (opt && opt.pool) || require('../db/pool').pool;
  const client = await pool.connect();
  let gehalten = false, kaputt = false;
  const t0 = Date.now();
  try {
    const r = await client.query('SELECT pg_try_advisory_lock($1::int, $2::int) AS ok', [NAMENSRAUM, nr]);
    if (!(r.rows[0] && r.rows[0].ok)) {
      _log(name + ': läuft schon in einer anderen Sitzung/Instanz - diese Runde übersprungen');
      return { lief: false };
    }
    gehalten = true;
    _log(name + ': Sperre ' + nr + ' gehalten');
    const ergebnis = await fn();
    return { lief: true, ergebnis };
  } finally {
    if (gehalten) {
      try { await client.query('SELECT pg_advisory_unlock($1::int, $2::int)', [NAMENSRAUM, nr]); }
      catch (e) { kaputt = true; _log(name + ': Freigabe fehlgeschlagen, Verbindung wird verworfen (' + e.message + ')'); }
      _log(name + ': fertig nach ' + Math.round((Date.now() - t0) / 1000) + ' s, Sperre frei');
    }
    client.release(kaputt || undefined);
  }
}

/** Für setInterval/setTimeout: eine Funktion, die nie wirft (sonst unbehandelte Zurückweisung im Takt). */
function takt(name, fn, opt) {
  return function () {
    return mitSperre(name, fn, opt).catch(function (e) { console.error('[takt-sperre] ' + name + ': ' + (e && e.message)); return { lief: false, fehler: e && e.message }; });
  };
}

module.exports = { mitSperre, takt, SCHLUESSEL, NAMENSRAUM };
