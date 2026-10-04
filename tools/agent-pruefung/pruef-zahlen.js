'use strict';
/* Der Cent-Fehler trat nur GELEGENTLICH auf — eine einzelne Probe beweist
 * also nichts. Dieser Laeufer stellt dieselbe Frage mehrfach und prueft
 * die Antwort gegen den WAHREN Wert aus dem Spiegel.
 *
 *   > Ein Fehler, der jedes dritte Mal auftritt, besteht jeden Einzeltest. */
const { query } = require('/app/src/db/pool');
const agent = require('/app/src/services/agentLauf');

const RUNDEN = 4;

(async function () {
  const u = await query(
    `SELECT user_id FROM telegram_links WHERE bestaetigt_am IS NOT NULL LIMIT 1`);
  const uid = u.rows[0].user_id;

  const sp = await query(`SELECT payload FROM portfolio_spiegel WHERE user_id = $1`, [uid]);
  const bil = sp.rows[0].payload.vermoegensbilanz;
  const SOLL = {
    verbindlichkeiten: bil.verbindlichkeiten_eur,
    tilgung: bil.tilgung_eur_jahr,
    gesamtinvestition: bil.gesamtinvestition_eur
  };
  console.log('WAHRE WERTE aus dem Spiegel:');
  Object.entries(SOLL).forEach(([k, v]) =>
    console.log('  ' + k.padEnd(20) + Number(v).toLocaleString('de-DE') + ' EUR'));
  console.log('');

  const PROBEN = [
    { f: 'Wie hoch sind meine aktuellen Verbindlichkeiten?', soll: SOLL.verbindlichkeiten },
    { f: 'Wie hoch ist die Gesamttilgung aller Objekte?',    soll: SOLL.tilgung },
    { f: 'Was ist meine Gesamtinvestition?',                 soll: SOLL.gesamtinvestition }
  ];

  /* Eine Zahl gilt als getroffen, wenn ihre Ziffernfolge im Text steht —
     egal mit welchen Trennzeichen. Ein Komma an falscher Stelle aendert
     die Ziffernfolge nicht, deshalb wird ZUSAETZLICH geprueft, ob eine
     um Faktor 10/100 verschobene Fassung dasteht. */
  function trifft(text, soll) {
    const ziffern = String(Math.round(soll));
    const norm = String(text).replace(/[.\s]/g, '');
    if (norm.indexOf(ziffern) >= 0 && !new RegExp(ziffern.slice(0, -2) + ',' ).test(norm)) {
      /* Ziffernfolge da und NICHT als x,yz geschrieben */
      const alsCent = ziffern.slice(0, -2) + ',' + ziffern.slice(-2);
      if (String(text).replace(/\./g, '').indexOf(alsCent) >= 0) return { ok: false, grund: 'als Cent geschrieben' };
      return { ok: true };
    }
    if (norm.indexOf(ziffern) >= 0) return { ok: true };
    return { ok: false, grund: 'Ziffernfolge ' + ziffern + ' nicht gefunden' };
  }

  let fehler = 0, gesamt = 0;
  for (const p of PROBEN) {
    console.log('FRAGE: ' + p.f + '   (soll: ' + Number(p.soll).toLocaleString('de-DE') + ')');
    for (let i = 0; i < RUNDEN; i++) {
      const ctx = { userId: uid, letzteListe: null, letztesObjekt: null, protokoll: [],
        merkeObjekt() {}, merkeListe() {} };
      let r;
      try { r = await agent.laufen(p.f, ctx, { verlauf: [], darfKosten: false }); }
      catch (e) { console.log('  ' + (i + 1) + ' AUSNAHME: ' + e.message); fehler++; gesamt++; continue; }
      const t = trifft(r.text, p.soll);
      gesamt++;
      if (!t.ok) fehler++;
      const einzeiler = String(r.text).replace(/\s+/g, ' ').slice(0, 110);
      console.log('  ' + (i + 1) + ' ' + (t.ok ? 'ok     ' : 'FALSCH (' + t.grund + ') ') + einzeiler);
    }
    console.log('');
  }
  console.log('DECKUNG: ' + gesamt + ' Antworten geprueft, ' + fehler + ' falsch.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('AUSNAHME: ' + e.message); process.exit(2); });
