'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v1367 · SICHERHEITSEREIGNISSE — BEOBACHTEN, NICHT URTEILEN

   Punkt B3 aus Marcels Schutz-Lastenheft: "unabhängig vom verwendeten
   Werkzeug erkennen, ob ein Account versucht, die Anwendung
   automatisiert, systematisch oder in ungewöhnlichem Umfang auszulesen."

   Dieser Dienst macht die erste Hälfte davon: er schreibt Beobachtungen
   fort und beantwortet Fragen darüber. Die zweite Hälfte - was daraus
   folgt - ist ausdrücklich NICHT hier. Marcels Auflage:

     "Eine technische Auffälligkeit oder ein automatisch erzeugter
      Risikoscore darf NICHT automatisch als rechtlich bewiesener
      Vertragsverstoß behandelt werden."

   DESHALB GIBT ES HIER KEINE SPERRE UND KEINEN SCORE. Es gibt eine
   Chronik und zwei Kennzahlen, die ein Mensch lesen kann.

   ────────────────────────────────────────────────────────────────────
   DIE ZWEI KENNZAHLEN, UND WARUM GERADE DIESE

   Gemessen am 13.09.2026 an echter Nutzung (Seitenstart plus drei
   geöffnete Objekte, 57 Anfragen in 24 Sekunden):

     Vielfalt         12 verschiedene Endpunktgruppen
     Unregelmäßigkeit Variationskoeffizient der Abstände: 5,13

   Ein Auslese-Skript trifft ein bis zwei Gruppen bei einer Streuung nahe
   null. VIELFALT UND UNREGELMÄSSIGKEIT UNTERSCHEIDEN BESSER ALS REINE
   FREQUENZ - ein Mensch klickt stoßweise und löst dabei ein Dutzend
   verschiedene Dinge aus, ein Skript zieht gleichmäßig eine Sache ab.

   Das trifft genau B18: "Fehlalarmschutz: Nutzungshistorie und
   Accounttyp berücksichtigen, Eskalation statt Sofortsperre." Wer nur
   nach Tempo geht, sperrt den fleißigsten Kunden zuerst.
   ══════════════════════════════════════════════════════════════════════ */

const { query } = require('../db/pool');

/* Nur diese Arten werden geschrieben. Eine feste Liste, damit nicht mit
   der Zeit vierzig Sorten entstehen, die niemand mehr auswerten kann. */
const ARTEN = {
  RATE_LIMIT: 'rate_limit',      // Kontingent überschritten
  AUTH_FAIL:  'auth_fail',       // Anmeldung gescheitert
  MUSTER:     'muster'           // auffälliges Zugriffsmuster (aus pruefeMuster)
};

const STUFEN = { HINWEIS: 'hinweis', AUFFAELLIG: 'auffaellig', ERNST: 'ernst' };

/* ──────────────────────────────────────────────────────────────────────
   Schreiben. Wirft nie - ein Protokoll, das die Anwendung umbringt, ist
   schlimmer als kein Protokoll.
   ────────────────────────────────────────────────────────────────────── */
async function schreibe({ userId, ipKey, art, stufe, pfad, methode, detail }) {
  try {
    if (!art) return null;
    const r = await query(
      `INSERT INTO security_events (user_id, ip_key, art, stufe, pfad, methode, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, created_at`,
      [
        userId || null,
        userId ? null : (ipKey || null),   // bei bekanntem Konto keine IP
        String(art).slice(0, 40),
        STUFEN[String(stufe || '').toUpperCase()] || stufe || STUFEN.HINWEIS,
        pfad ? String(pfad).split('?')[0].slice(0, 200) : null,
        methode ? String(methode).slice(0, 10) : null,
        JSON.stringify(detail || {})
      ]
    );
    return r.rows[0] || null;
  } catch (e) {
    console.warn('[sec] Ereignis nicht gespeichert:', e.message);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Die Chronik eines Kontos. Für die Fallakte aus B19 - chronologisch,
   ohne Bewertung.
   ────────────────────────────────────────────────────────────────────── */
async function chronik(userId, { seit, limit } = {}) {
  const r = await query(
    `SELECT id, art, stufe, pfad, methode, detail, created_at
       FROM security_events
      WHERE user_id = $1
        AND created_at >= COALESCE($2::timestamptz, NOW() - INTERVAL '30 days')
      ORDER BY created_at DESC
      LIMIT $3`,
    [userId, seit || null, Math.min(parseInt(limit, 10) || 200, 1000)]
  );
  return r.rows;
}

/* ──────────────────────────────────────────────────────────────────────
   Die Auswertung. Gibt ZAHLEN zurück, kein Urteil.

   `vielfalt`       wie viele verschiedene Endpunktgruppen getroffen wurden
   `streuung`       Variationskoeffizient der Abstände zwischen Ereignissen
                    (Standardabweichung geteilt durch Mittelwert)

   Zur Einordnung dienen die gemessenen Vergleichswerte oben - sie stehen
   als `vergleich` mit in der Antwort, damit niemand die Zahlen ohne
   Maßstab liest.

   WARUM DIE STREUUNG NUR AB FÜNF EREIGNISSEN: bei drei Abständen ist ein
   Variationskoeffizient Rauschen. Darunter wird `null` zurückgegeben -
   und `null` heißt "weiß ich nicht", nicht "unauffällig".
   ────────────────────────────────────────────────────────────────────── */
async function muster(userId, { fensterMinuten } = {}) {
  const fenster = Math.min(Math.max(parseInt(fensterMinuten, 10) || 60, 1), 1440);
  const r = await query(
    `SELECT pfad, created_at
       FROM security_events
      WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' minutes')::interval
      ORDER BY created_at ASC`,
    [userId, String(fenster)]
  );
  const zeilen = r.rows || [];

  const gruppen = new Set();
  zeilen.forEach((z) => {
    if (!z.pfad) return;
    const g = String(z.pfad).replace(/^\/+/, '').split('/')[0];
    if (g) gruppen.add(g);
  });

  let streuung = null;
  if (zeilen.length >= 5) {
    const luecken = [];
    for (let i = 1; i < zeilen.length; i++) {
      luecken.push(new Date(zeilen[i].created_at) - new Date(zeilen[i - 1].created_at));
    }
    const mittel = luecken.reduce((a, b) => a + b, 0) / luecken.length;
    if (mittel > 0) {
      const varianz = luecken.reduce((a, b) => a + Math.pow(b - mittel, 2), 0) / luecken.length;
      streuung = Math.round((Math.sqrt(varianz) / mittel) * 100) / 100;
    }
  }

  return {
    fenster_minuten: fenster,
    ereignisse: zeilen.length,
    vielfalt: gruppen.size,
    streuung,
    /* Der Maßstab gehört zur Zahl - sonst liest jemand "3" und weiß
       nicht, ob das viel ist. */
    vergleich: {
      normalnutzung_vielfalt: 12,
      normalnutzung_streuung: 5.13,
      gemessen_am: '2026-09-13',
      hinweis: 'Ein Skript trifft ein bis zwei Gruppen bei Streuung nahe null. '
             + 'Diese Zahlen sind eine Beobachtung, kein Urteil.'
    }
  };
}

module.exports = { schreibe, chronik, muster, ARTEN, STUFEN };
