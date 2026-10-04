'use strict';
/* Marcels Kernbeschwerde: "hat die Haelfte ignoriert".
 *
 * Diese Probe prueft NICHT die Antwort, sondern was WIRKLICH im Datensatz
 * steht. Eine Antwort, die zwei Felder aufzaehlt, kann trotzdem sieben
 * gespeichert haben — und umgekehrt. */
const { query } = require('/app/src/db/pool');
const agent = require('/app/src/services/agentLauf');

const SATZ = 'Leg mir eine Eigentumswohnung in der Musterstraße 12 in Hannover an. '
  + 'Die Wohnung hat 85 m², vier Zimmer, liegt im zweiten Obergeschoss und ist aktuell vermietet.';

/* Was Marcel genannt hat, Feld fuer Feld. */
const ERWARTET = {
  objart: 'ETW',       str: 'Musterstraße',  hnr: '12',
  ort: 'Hannover',     wfl: '85',            zimmer: '4',
  etage: '2'
};

(async function () {
  const u = await query(
    `SELECT user_id FROM telegram_links WHERE bestaetigt_am IS NOT NULL LIMIT 1`);
  const uid = u.rows[0].user_id;

  const protokoll = [];
  const ctx = { userId: uid, letzteListe: null, letztesObjekt: null, protokoll,
    merkeObjekt(id) { this.letztesObjekt = id; }, merkeListe() {} };

  console.log('SATZ: ' + SATZ + '\n');
  const r = await agent.laufen(SATZ, ctx, { verlauf: [], darfKosten: false });
  console.log('Werkzeuge: ' + protokoll.map((p) => p.werkzeug).join(', '));
  console.log('Antwort: ' + String(r.text).replace(/\s+/g, ' ').slice(0, 300) + '\n');

  if (!ctx.letztesObjekt) { console.log('KEIN Objekt angelegt — FEHLER'); process.exit(1); }

  const o = await query(`SELECT data FROM objects WHERE id = $1`, [ctx.letztesObjekt]);
  const d = o.rows[0].data || {};

  console.log('WAS WIRKLICH IM DATENSATZ STEHT:');
  let fehlt = 0;
  Object.entries(ERWARTET).forEach(([id, soll]) => {
    const ist = d[id];
    const da = ist != null && String(ist).toLowerCase().indexOf(String(soll).toLowerCase()) >= 0;
    if (!da) fehlt++;
    console.log('  ' + (da ? 'ok     ' : 'FEHLT  ') + id.padEnd(8)
      + ' soll ~ "' + soll + '"   ist: ' + (ist == null ? '(leer)' : '"' + ist + '"'));
  });

  const weitere = Object.keys(d).filter((k) => k.indexOf('_') !== 0 && !(k in ERWARTET));
  if (weitere.length) console.log('\n  zusaetzlich erkannt: ' + weitere.map((k) => k + '=' + d[k]).join(', '));

  await query(`DELETE FROM objects WHERE id = $1`, [ctx.letztesObjekt]);
  console.log('\n(Testobjekt entfernt.)');
  console.log('DECKUNG: ' + Object.keys(ERWARTET).length + ' genannte Angaben, '
    + fehlt + ' nicht uebernommen.');
  process.exit(fehlt ? 1 : 0);
})().catch((e) => { console.error('AUSNAHME: ' + e.message); process.exit(2); });
