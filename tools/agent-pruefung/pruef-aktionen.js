'use strict';
/* Prueft A-3 (Objektbezug), A-4 (Auswahlfelder) und A-5 (Aktionen) direkt
 * an den WERKZEUGEN — ohne Modell, damit die Logik fuer sich steht.
 *
 * Es wird NICHTS dauerhaft geaendert: alle Schreibproben laufen gegen ein
 * eigens angelegtes Testobjekt, das am Ende wieder verschwindet. */
const { query } = require('/app/src/db/pool');
const W = require('/app/src/services/agentWerkzeuge');

function ruf(name, ctx, args) {
  const w = W.finde(name);
  if (!w) throw new Error('kein Werkzeug ' + name);
  return w.fn(ctx, args || {});
}

(async function () {
  const u = await query(
    `SELECT user_id FROM telegram_links WHERE bestaetigt_am IS NOT NULL LIMIT 1`);
  const uid = u.rows[0].user_id;
  let fehler = 0;
  const pruef = (txt, ok) => { if (!ok) fehler++; console.log('  ' + (ok ? 'ok    ' : 'FALSCH ') + txt); };

  const ctx = { userId: uid, letzteListe: null, letztesObjekt: null, protokoll: [],
    merkeObjekt(id) { this.letztesObjekt = id; }, merkeListe(i) { this.letzteListe = i; } };

  /* ── A-3 · Objektbezug ───────────────────────────────────────────── */
  console.log('\n=== A-3 · Objekte flexibel ansprechen ===');
  const liste = await ruf('objekte_liste', ctx);
  ctx.letzteListe = liste.objekte.map((o) => o.id);
  pruef('objekte_liste: ' + liste.anzahl + ' Objekte, nummeriert ab 1',
    liste.anzahl > 0 && liste.objekte[0].nummer === 1);
  pruef('Scores in der Liste', liste.objekte.some((o) => o.dealscore != null));

  const perNr = await ruf('objekt_lesen', ctx, { nummer: 3 });
  pruef('per NUMMER 3 -> ' + (perNr.adresse || '?'), perNr.gefunden === true);

  const perId = await ruf('objekt_lesen', ctx, { id: ctx.letzteListe[0] });
  pruef('per UUID -> ' + (perId.adresse || '?'), perId.gefunden === true);

  /* v1810 · Diese Probe war zu lasch: sie prueft jetzt WELCHES Objekt
     kommt. Vorher genuegte 'gefunden === true' - und der alte Code gab bei
     einem Fehlschlag stillschweigend das zuletzt besprochene zurueck.
     Die Probe war gruen, waehrend das falsche Objekt kam. */
  const perAdr = await ruf('objekt_lesen', ctx, { adresse: 'Musterstr' });
  pruef('per ADRESSE "Musterstr" -> ' + (perAdr.adresse || '?'),
    perAdr.gefunden === true && /musterstr/i.test(perAdr.adresse || ''));

  const ausserhalb = await ruf('objekt_lesen', ctx, { nummer: 999 });
  pruef('Nummer 999 meldet "nicht gefunden" statt zu raten', ausserhalb.gefunden === false);

  /* ── A-4 · Auswahlfelder ─────────────────────────────────────────── */
  console.log('\n=== A-4 · Auswahlfelder ===');
  const kat = await ruf('feld_katalog', ctx, { suche: 'zustand' });
  const zust = kat.felder.find((f) => f.kind === 'select' && f.options && f.options.length);
  pruef('feld_katalog findet ein Auswahlfeld zu "zustand"' + (zust ? ' (' + zust.id + ')' : ''),
    Boolean(zust));
  if (zust) console.log('        Werte: ' + zust.options.join(' · '));

  /* Testobjekt anlegen */
  const neu = await ruf('objekt_anlegen', ctx, { felder: {
    str: 'Teststr.', hnr: '1', plz: '12345', ort: 'Pruefstadt',
    objart: 'ETW', wfl: '70', zimmer: '3' } });
  pruef('objekt_anlegen mit sieben Feldern', neu.ok === true);
  const testId = neu.id;

  if (testId && zust) {
    const quatsch = await ruf('felder_aendern', ctx,
      { id: testId, felder: { [zust.id]: 'voellig wirr xyz' } });
    pruef('ungueltiger Auswahlwert wird NICHT gespeichert, sondern erfragt',
      quatsch.ok === false && quatsch.rueckfrage === true);
    if (quatsch.auswahl_unklar) {
      console.log('        Rueckfrage nennt ' + quatsch.auswahl_unklar[0].moeglich.length + ' Moeglichkeiten');
    }

    const gut = await ruf('felder_aendern', ctx,
      { id: testId, felder: { [zust.id]: zust.options[0] } });
    pruef('gueltiger Auswahlwert "' + zust.options[0] + '" wird gespeichert', gut.ok === true);
  }

  if (testId) {
    /* belegtes Feld: zimmer steht auf 3 */
    const belegt = await ruf('felder_aendern', ctx, { id: testId, felder: { zimmer: '5' } });
    pruef('belegtes Feld wird NICHT still ueberschrieben',
      belegt.ok === false && belegt.rueckfrage === true);
    if (belegt.bereits_belegt) {
      const b = belegt.bereits_belegt[0];
      pruef('Rueckfrage nennt ALTEN (' + b.steht_auf + ') und NEUEN (' + b.soll_werden + ') Wert',
        b.steht_auf != null && b.soll_werden != null);
    }
    const bestaetigt = await ruf('felder_aendern', ctx,
      { id: testId, felder: { zimmer: '5' }, bestaetigt: true });
    pruef('nach Bestaetigung wird geaendert', bestaetigt.ok === true);

    const leer = await ruf('felder_aendern', ctx, { id: testId, felder: { baujahr: '1990' } });
    pruef('LEERES Feld wird ohne Rueckfrage gefuellt', leer.ok === true);

    const unbek = await ruf('felder_aendern', ctx,
      { id: testId, felder: { gibtsnicht_xyz: '1', etagen_ges: '3' } });
    pruef('unbekanntes Feld wird GENANNT, nicht still verworfen',
      unbek.ok === true && Array.isArray(unbek.unbekannte_felder)
      && unbek.unbekannte_felder.indexOf('gibtsnicht_xyz') >= 0);
  }

  /* ── A-5 · Was fehlt noch? ───────────────────────────────────────── */
  console.log('\n=== A-5/A-6 · Luecken ===');
  /* OHNE objart — sonst faellt das einzige Auswahlfeld der ersten Bloecke
     aus der Luecken-Liste, weil es schon gefuellt ist. Der erste Entwurf
     dieses Pruefers hatte genau das uebersehen und den CODE beschuldigt. */
  const l = await ruf('anlage_luecken', ctx, { felder: {
    str: 'Teststr.', hnr: '1', plz: '12345', ort: 'Pruefstadt' } });
  pruef('anlage_luecken nennt offene Bloecke: ' + l.fortschritt.offen + ' von ' + l.fortschritt.bloecke,
    l.fortschritt.offen > 0 && l.offene_bloecke.length > 0);
  if (l.offene_bloecke[0]) {
    console.log('        naechste: ' + l.offene_bloecke[0].frage.slice(0, 70));
    const mitAuswahl = l.offene_bloecke.find((b) => b.felder.some((f) => f.auswahl));
    pruef('Auswahlwerte reisen bei den Luecken mit', Boolean(mitAuswahl));
  }

  /* ── Marktbericht: Preis kostet nichts ───────────────────────────── */
  console.log('\n=== A-8 · Preisansage ===');
  /* v1811c · Die Rueckgabe hat sich geaendert: marktbericht_preis liefert
     jetzt IMMER alle drei Stufen, damit das Modell keine fuer den Nutzer
     waehlen kann. Der Pruefer hatte noch die alte Form erwartet und meldete
     deshalb FALSCH - er war veraltet, nicht der Code. */
  const preis = await ruf('marktbericht_preis', ctx, { nummer: 1 });
  const dreiStufen = Array.isArray(preis.stufen) && preis.stufen.length === 3;
  pruef('marktbericht_preis liefert ALLE DREI Stufen'
    + (dreiStufen ? ' (' + preis.stufen.map(function(x){return x.name;}).join(' / ') + ')' : ''),
    dreiStufen);
  if (dreiStufen) {
    pruef('jede Stufe nennt ihren fertigen Satz',
      preis.stufen.every(function(x){ return typeof x.so_sagen === 'string' && x.so_sagen.length > 10; }));
    pruef('keine Stufe behauptet "kostet nichts", wenn sie verbraucht',
      preis.stufen.every(function(x){
        return !x.verbraucht_einen_abruf || !/kostet nichts/i.test(x.so_sagen); }));
  }

  /* ── Aufraeumen ──────────────────────────────────────────────────── */
  if (testId) {
    await query(`DELETE FROM objects WHERE id = $1 AND user_id = $2`, [testId, uid]);
    console.log('\n(Testobjekt wieder entfernt.)');
  }

  console.log('\nDECKUNG: ' + (fehler === 0 ? 'alle Proben bestanden' : fehler + ' Proben FALSCH'));
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('AUSNAHME: ' + e.message + '\n' + e.stack); process.exit(2); });
