'use strict';
/* v2217 · pruef-soll-ist.js — Ableger von pruef-agent.js fuer das Werkzeug soll_ist_lesen.
 * Prueft den Agenten gegen Marcels EIGENE Fragen, im Container, mit
 * echten Daten — und OHNE eine Telegram-Nachricht zu senden.
 *
 * Der Laeufer protokolliert, WELCHE WERKZEUGE gewaehlt wurden. Ohne das
 * waere "die Antwort klang gut" kein Befund. */
const { query } = require('/app/src/db/pool');
const agent = require('/app/src/services/agentLauf');

/* v2217 · Soll/Ist im Bot: waehlt der Agent soll_ist_lesen? */
const FRAGEN = [
  { f: 'Wie steht die Parkstraße gegen den Plan?',                       erwartet: 'soll_ist_lesen' },
  { f: 'Was hat sich bei der Ravensberger seit dem Kauf verändert?',     erwartet: 'soll_ist_lesen' },
  { f: 'Liegt die Bismarckstraße über oder unter Plan?',                 erwartet: 'soll_ist_lesen' }
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
    const ctx = { userId: uid, letzteListe: ids, letztesObjekt: null, protokoll, nummerErfunden: true,   /* wie im Webhook: der Nutzer nannte keine Nummer */
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
    /* v2217 · welche ARGUMENTE das Modell uebergab - ohne sie ist "nicht gefunden" kein Befund */
    console.log('  Aufrufe: ' + JSON.stringify(protokoll).slice(0, 600));
    /* v1813f · Alternativen zulassen — objekte_rangliste ist fuer eine
       Rangfrage der genauere Weg als portfolio_lesen. */
    const erlaubt = [].concat(p.erwartet);
    const ok = erlaubt.some((w) => benutzt.indexOf(w) >= 0);
    if (!ok) fehler++;
    console.log('FRAGE: ' + p.f);
    console.log('  Werkzeuge: ' + (benutzt.join(', ') || 'KEINE')
      + (ok ? '   ok' : '   FEHLT: ' + [].concat(p.erwartet).join(' oder ')));
    console.log('  Runden: ' + r.runden + ', ' + Math.round((Date.now() - t0) / 100) / 10 + ' s');
    console.log('  Antwort:');
    String(r.text || '').split('\n').forEach((z) => console.log('    ' + z));
    console.log('');
  }

  console.log('DECKUNG: ' + FRAGEN.length + ' Fragen, ' + fehler + ' ohne eines der erwarteten Werkzeuge.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('AUSNAHME: ' + e.message); process.exit(2); });
