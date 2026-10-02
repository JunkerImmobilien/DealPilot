'use strict';
/* Prueft den Agenten gegen Marcels EIGENE Fragen, im Container, mit
 * echten Daten — und OHNE eine Telegram-Nachricht zu senden.
 *
 * Der Laeufer protokolliert, WELCHE WERKZEUGE gewaehlt wurden. Ohne das
 * waere "die Antwort klang gut" kein Befund. */
const { query } = require('/app/src/db/pool');
const agent = require('/app/src/services/agentLauf');

const FRAGEN = [
  { f: 'Wie hoch ist die Gesamttilgung aller Objekte?',            erwartet: 'portfolio_lesen' },
  { f: 'Wie hoch sind meine aktuellen Verbindlichkeiten über das gesamte Portfolio?', erwartet: 'portfolio_lesen' },
  { f: 'Welche Objekte haben aktuell den höchsten Finanzierungsbedarf?', erwartet: 'portfolio_lesen' },
  { f: 'Zeig mir die Vermögensbilanz.',                            erwartet: 'portfolio_lesen' },
  { f: 'Wie hoch ist der aktuelle Gesamtwert meines Portfolios?',   erwartet: 'portfolio_lesen' }
];

(async function () {
  const u = await query(
    `SELECT user_id FROM telegram_links WHERE bestaetigt_am IS NOT NULL LIMIT 1`);
  const uid = u.rows[0].user_id;

  const liste = await query(
    `SELECT id FROM objects WHERE user_id = $1 ORDER BY updated_at DESC`, [uid]);
  const ids = liste.rows.map((r) => r.id);
  console.log('Nutzer hat ' + ids.length + ' Objekte.\n');

  let fehler = 0;
  for (const p of FRAGEN) {
    const protokoll = [];
    const ctx = { userId: uid, letzteListe: ids, letztesObjekt: null, protokoll,
      merkeObjekt() {}, merkeListe() {} };
    const t0 = Date.now();
    let r;
    try {
      r = await agent.laufen(p.f, ctx, { verlauf: [], darfKosten: false });
    } catch (e) {
      console.log('FRAGE: ' + p.f);
      console.log('  AUSNAHME: ' + e.message + '\n');
      fehler++; continue;
    }
    const benutzt = protokoll.map((x) => x.werkzeug);
    const ok = benutzt.indexOf(p.erwartet) >= 0;
    if (!ok) fehler++;
    console.log('FRAGE: ' + p.f);
    console.log('  Werkzeuge: ' + (benutzt.join(', ') || 'KEINE')
      + (ok ? '   ok' : '   FEHLT: ' + p.erwartet));
    console.log('  Runden: ' + r.runden + ', ' + Math.round((Date.now() - t0) / 100) / 10 + ' s');
    console.log('  Antwort:');
    String(r.text || '').split('\n').forEach((z) => console.log('    ' + z));
    console.log('');
  }

  console.log('DECKUNG: ' + FRAGEN.length + ' Fragen, ' + fehler + ' ohne das erwartete Werkzeug.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('AUSNAHME: ' + e.message); process.exit(2); });
