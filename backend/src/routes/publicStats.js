/* ═══════════════════════════════════════════════════════════════════════
   publicStats.js · v1523 — oeffentliche Kennzahlen fuer die Landing
   ───────────────────────────────────────────────────────────────────────
   Marcel am 22.09.2026:
     "Zu dem Kundenzaehler: da ist es so, registrierte User, dass wir die
      zaehlen. Wir fangen aber jetzt bei 865 registrierten Usern an. Das ist
      also quasi unsere Nullzahl."

   Der Sockel steht bewusst in einer Umgebungsvariablen und nicht im Code:
   er ist eine GESCHAEFTSZAHL, keine Programmlogik, und wer ihn aendert,
   soll dafuer nicht die Anwendung neu bauen muessen.

   Was hier NICHT passiert: es wird nichts geschoent. Gezaehlt werden
   dieselben Nutzer wie im Admin-Dashboard - ohne Testkonten, ohne
   geloeschte. Dazu kommt der Sockel, und das Ergebnis wird gerundet
   ausgegeben, damit die Zahl nicht bei jedem Aufruf zappelt.

   Kein Token, keine personenbezogenen Daten, nur Summen. Eine Minute
   Zwischenspeicher, damit die Landing nicht bei jedem Aufruf die Datenbank
   beschaeftigt.
   ═══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();

const SOCKEL = parseInt(process.env.PUBLIC_STATS_SOCKEL || '865', 10);
const CACHE_MS = parseInt(process.env.PUBLIC_STATS_CACHE_MS || '60000', 10);

let speicher = { zeit: 0, wert: null };

/* v1523b · gemessen beim ersten Lauf: Sockel 865 + 1 Nutzer = 866, und das
   Abrunden auf Zehner machte daraus 860 - WENIGER als der Sockel. Eine Zahl,
   die nach dem ersten Kunden kleiner wird, ist schlimmer als gar keine.
   Gerundet wird deshalb erst, wo die Rundung kleiner ist als der Zuwachs:
   ab 2000 auf Fuenfziger. Darunter steht die echte Summe. */
function runden(n) {
  if (n < 2000) return n;
  return Math.floor(n / 50) * 50;
}

router.get('/', async (req, res) => {
  if (speicher.wert && Date.now() - speicher.zeit < CACHE_MS) {
    return res.json(speicher.wert);
  }

  const db = req.app.get('db');
  const zahlen = { nutzer: null, objekte: null, bewertungen: null };

  try {
    const u = await db.query(
      `SELECT COUNT(*)::int AS n FROM users
        WHERE deleted_at IS NULL AND is_test_user = false`
    );
    zahlen.nutzer = Number(u.rows[0] && u.rows[0].n) || 0;
  } catch (e) { zahlen.nutzer = 0; }

  try {
    const o = await db.query(`SELECT COUNT(*)::int AS n FROM objects`);
    zahlen.objekte = Number(o.rows[0] && o.rows[0].n) || 0;
  } catch (e) { zahlen.objekte = null; }   /* Tabelle anders benannt? Dann weglassen. */

  const gesamt = SOCKEL + zahlen.nutzer;

  const antwort = {
    ok: true,
    /* Was die Landing anzeigt */
    registrierte_nutzer: runden(gesamt),
    objekte_analysiert: zahlen.objekte != null ? runden(zahlen.objekte) : null,
    /* Damit im Admin nachvollziehbar bleibt, woraus die Zahl besteht */
    herkunft: { sockel: SOCKEL, gezaehlt: zahlen.nutzer, summe: gesamt },
    stand: new Date().toISOString().slice(0, 10),
  };

  speicher = { zeit: Date.now(), wert: antwort };
  res.set('Cache-Control', 'public, max-age=60');
  res.json(antwort);
});

module.exports = router;
