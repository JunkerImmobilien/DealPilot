'use strict';
/* v1813 · Die vier Auskunftswerkzeuge — objekt_kennzahlen,
 * objekte_rangliste, objekt_felder_liste, cashflow_hebel.
 *
 * Der Lauf hat zwei Teile:
 *
 *   TEIL A  ohne Modell. Jede Probe rechnet ihren Sollwert SELBST aus der
 *           Datenbank bzw. dem Spiegel und SUBTRAHIERT. Zwei Zahlen
 *           nebeneinander zu drucken ist keine Pruefung — das hat
 *           `register-saat` schon einmal gruen gemeldet (2566 gegen 2561).
 *
 *   TEIL B  mit Modell, mit Marcels eigenen Saetzen. Geprueft wird, WELCHES
 *           Werkzeug der Agent waehlt — eine schoene Antwort aus der
 *           falschen Quelle liest sich besser als eine richtige.
 *
 * UND EIN GEGENTEST. Teil A beweist nicht nur, dass die Zuordnung jetzt
 * stimmt, sondern dass sie VORHER falsch war: die Nummer der Chat-Liste
 * und die Nummer des Spiegels zeigen auf verschiedene Haeuser. Ohne diesen
 * Nachweis koennte der Fix genauso gut nichts geaendert haben.
 */
const { query } = require('/app/src/db/pool');
const W = require('/app/src/services/agentWerkzeuge');
const agent = require('/app/src/services/agentLauf');

function ruf(name, ctx, args) {
  const w = W.finde(name);
  if (!w) throw new Error('kein Werkzeug ' + name);
  return w.fn(ctx, args || {});
}
function zahl(s) {
  const t = String(s == null ? '' : s).replace(/[^\d,\-]/g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

(async function () {
  const u = await query(
    `SELECT user_id FROM telegram_links WHERE bestaetigt_am IS NOT NULL LIMIT 1`);
  if (!u.rows.length) { console.log('Kein bestaetigter Telegram-Link — Abbruch.'); process.exit(1); }
  const uid = u.rows[0].user_id;

  let proben = 0, fehler = 0;
  const pruef = (txt, ok, dazu) => {
    proben++; if (!ok) fehler++;
    console.log('  ' + (ok ? 'ok     ' : 'FALSCH ') + txt + (dazu ? '\n         ' + dazu : ''));
  };

  const ctx = { userId: uid, letzteListe: null, letztesObjekt: null, protokoll: [],
    merkeObjekt(id) { this.letztesObjekt = id; },
    merkeListe(i) { this.letzteListe = i; } };

  const spRow = await query(`SELECT payload FROM portfolio_spiegel WHERE user_id = $1`, [uid]);
  const spiegel = spRow.rows.length ? spRow.rows[0].payload : null;
  if (!spiegel) { console.log('Kein Portfolio-Spiegel — Abbruch.'); process.exit(1); }
  const spObj = Array.isArray(spiegel.objekte) ? spiegel.objekte : [];
  const mitId = spObj.filter((o) => o.id).length;
  console.log('DECKUNG: ' + spObj.length + ' Objekte im Spiegel, davon ' + mitId
    + ' mit ID. Spiegel-Stand: ' + (spiegel.stand || '?'));
  if (!mitId) {
    console.log('\n!! Der Spiegel traegt noch keine IDs (v1813 im Browser noch nicht gelaufen).');
    console.log('   Teil A prueft dann den ALTEN Weg mit — das ist kein Fehlschlag des Codes,');
    console.log('   sondern ein fehlender Spiegel-Neuschrieb. App einmal oeffnen.\n');
  }

  const liste = await ruf('objekte_liste', ctx);
  ctx.letzteListe = liste.objekte.map((o) => o.id);

  /* ══ TEIL A1 · Der Gegentest: stimmten die Nummern ueberhaupt nicht? ══ */
  console.log('\n=== A1 · GEGENTEST auf den gefundenen Fehler ===');
  let abweichungen = 0;
  for (let i = 0; i < Math.min(liste.objekte.length, spObj.length); i++) {
    const chat = liste.objekte[i].adresse || '';
    const sp = spObj[i].name || '';
    const gleich = chat.toLowerCase().indexOf(String(sp).toLowerCase().split(' ')[0].toLowerCase()) >= 0;
    if (!gleich) abweichungen++;
  }
  pruef('Chat-Nummer und Spiegel-Position zeigen auf verschiedene Objekte '
    + '(' + abweichungen + ' von ' + Math.min(liste.objekte.length, spObj.length) + ' Positionen)',
    abweichungen > 0,
    abweichungen === 0 ? 'Keine Abweichung gefunden — dann war der Befund falsch '
      + 'oder dieser Nutzer hat nur gewonnene Objekte in derselben Reihenfolge.' : null);

  const pl = await ruf('portfolio_lesen', ctx);
  pruef('portfolio_lesen zeigt dem Modell KEINE Nummer mehr',
    (pl.daten.objekte || []).every((o) => o.nr === undefined));

  /* ══ TEIL A2 · objekt_kennzahlen ══════════════════════════════════════ */
  console.log('\n=== A2 · objekt_kennzahlen ===');
  /* Ein Objekt waehlen, das WIRKLICH im Spiegel steht — sonst prueft die
     Probe nur den Luecken-Zweig. */
  let nrImChat = null, sollEintrag = null;
  for (let i = 0; i < ctx.letzteListe.length; i++) {
    const e = spObj.find((o) => o.id && String(o.id) === String(ctx.letzteListe[i]));
    if (e && Number.isFinite(Number(e.cashflow_nach_steuer_eur_jahr))) {
      nrImChat = i + 1; sollEintrag = e; break;
    }
  }
  if (!nrImChat && spObj.length) {
    /* Spiegel ohne IDs: ueber den Namen, wie das Werkzeug es auch tut. */
    for (let i = 0; i < ctx.letzteListe.length; i++) {
      const adr = (liste.objekte[i].adresse || '').split(',')[0].toLowerCase();
      const tr = spObj.filter((o) => String(o.name || '').toLowerCase().indexOf(adr) >= 0);
      if (tr.length === 1 && Number.isFinite(Number(tr[0].cashflow_nach_steuer_eur_jahr))) {
        nrImChat = i + 1; sollEintrag = tr[0]; break;
      }
    }
  }

  if (!nrImChat) {
    pruef('Ein Objekt gefunden, das im Spiegel steht', false,
      'Kein einziges Chat-Objekt liess sich dem Spiegel zuordnen.');
  } else {
    const k = await ruf('objekt_kennzahlen', ctx, { nummer: nrImChat });
    pruef('Nummer ' + nrImChat + ' -> ' + (k.adresse || '?') + ' (ID stimmt mit der Liste)',
      k.gefunden === true && String(k.id) === String(ctx.letzteListe[nrImChat - 1]));

    const sollCf = Math.round(Number(sollEintrag.cashflow_nach_steuer_eur_jahr));
    const istCf = k.kennzahlen ? zahl(k.kennzahlen['Cashflow nach Steuer']) : null;
    pruef('Cashflow stimmt mit dem Spiegel-Eintrag DIESES Objekts',
      istCf != null && Math.abs(istCf - sollCf) <= 1,
      'soll ' + sollCf + ' · ist ' + istCf + ' · Differenz '
        + (istCf == null ? 'kein Wert' : (istCf - sollCf)));

    const sollM = Math.round(sollCf / 12);
    const istM = k.kennzahlen ? zahl(k.kennzahlen['Cashflow nach Steuer je Monat']) : null;
    pruef('Monatswert ist derselbe Wert geteilt, keine zweite Quelle',
      istM != null && Math.abs(istM - sollM) <= 1,
      'Differenz ' + (istM == null ? 'kein Wert' : (istM - sollM)));

    /* Der Investor Deal Score darf nur dastehen, wenn er gerechnet ist. */
    const o = await query(`SELECT data FROM objects WHERE id = $1`, [k.id]);
    const d = o.rows[0].data || {};
    const gerechnet = d._ds2_computed === true;
    pruef('Investor Deal Score nur bei _ds2_computed===true (hier: ' + gerechnet + ')',
      gerechnet ? k.investor_deal_score != null : k.investor_deal_score == null);
  }

  /* Ein Objekt, das NICHT im Spiegel steht: keine erfundene Zahl. */
  const draussen = ctx.letzteListe.find((id) =>
    !spObj.some((o) => o.id && String(o.id) === String(id)));
  if (draussen && mitId) {
    const k2 = await ruf('objekt_kennzahlen', ctx, { id: draussen });
    pruef('Objekt ohne Spiegel-Eintrag: keine Kennzahlen, aber ein Hinweis',
      k2.gefunden === true && !k2.kennzahlen && typeof k2.kennzahlen_hinweis === 'string',
      k2.kennzahlen_hinweis ? k2.kennzahlen_hinweis.slice(0, 90) + '…' : 'kein Hinweis');
  }

  /* ══ TEIL A3 · objekte_rangliste ══════════════════════════════════════ */
  console.log('\n=== A3 · objekte_rangliste ===');
  const r1 = await ruf('objekte_rangliste', ctx, {});
  pruef('ohne Kennzahl: sortiert nach "' + r1.sortiert_nach + '"',
    r1.vorhanden === true && r1.sortiert_nach === 'Investor Deal Score');
  const werte = r1.rangliste.map((z) => zahl(z['Investor Deal Score']));
  const mitWert = werte.filter((v) => v != null);
  let monoton = true;
  for (let i = 1; i < mitWert.length; i++) if (mitWert[i] > mitWert[i - 1]) monoton = false;
  pruef('absteigend sortiert (' + mitWert.join(' > ') + ')', monoton);
  /* Ohne Wert gehoert nach hinten — sonst steht ein ungerechnetes Objekt
     vor einem guten und sieht aus wie das schlechteste. */
  const ersterOhne = werte.findIndex((v) => v == null);
  pruef('Objekte ohne Wert stehen am Ende',
    ersterOhne < 0 || werte.slice(ersterOhne).every((v) => v == null));
  pruef('jede Zeile traegt auch Cashflow und Rendite',
    r1.rangliste.every((z) => z['Cashflow nach Steuer'] && z['Bruttomietrendite']));

  const r2 = await ruf('objekte_rangliste', ctx, { objektart: 'Wohnung' });
  const nurEtw = (r2.rangliste || []).every((z) => z.objektart === 'ETW');
  pruef('"Wohnung" wird zu ETW aufgeloest (' + (r2.anzahl || 0) + ' Treffer)',
    r2.gefiltert_auf === 'ETW' && nurEtw && (r2.anzahl || 0) > 0);

  const r3 = await ruf('objekte_rangliste', ctx, { kennzahl: 'ltv' });
  const ltvs = (r3.rangliste || []).map((z) => zahl(z['LTV'])).filter((v) => v != null);
  let aufsteigend = true;
  for (let i = 1; i < ltvs.length; i++) if (ltvs[i] < ltvs[i - 1]) aufsteigend = false;
  pruef('LTV: niedriger ist besser, also aufsteigend (' + ltvs.slice(0, 4).join(' < ') + ' …)',
    aufsteigend && r3.bessere_richtung === 'niedriger ist besser');

  const r4 = await ruf('objekte_rangliste', ctx, { objektart: 'Schloss' });
  pruef('unbekannte Objektart: nennt den Bestand statt zu scheitern',
    r4.anzahl === 0 && r4.objektarten_im_bestand
      && Object.keys(r4.objektarten_im_bestand).length > 0,
    r4.objektarten_im_bestand ? JSON.stringify(r4.objektarten_im_bestand) : null);

  /* ══ TEIL A4 · objekt_felder_liste ════════════════════════════════════ */
  console.log('\n=== A4 · objekt_felder_liste ===');
  const fl = await ruf('objekt_felder_liste', ctx, { nummer: 3 });
  const alleZeilen = Object.values(fl.felder_nach_bereich || {}).flat();
  pruef('Nummer 3 -> ' + (fl.adresse || '?') + ': ' + fl.gefuellte_felder
    + ' gefuellt, ' + fl.leere_felder + ' leer',
    fl.gefunden === true && fl.gefuellte_felder > 0);
  pruef('Summe der Bereiche = gefuellte Felder',
    alleZeilen.length === fl.gefuellte_felder,
    alleZeilen.length + ' gegen ' + fl.gefuellte_felder);
  pruef('jede Zeile traegt eine Bezeichnung, nicht nur die Feld-Id',
    alleZeilen.every((z) => z.bezeichnung && z.bezeichnung !== z.feld));

  const bj = alleZeilen.find((z) => z.feld === 'baujahr');
  if (bj) pruef('Baujahr ohne Tausendertrennung: "' + bj.wert + '"', !/[.,]/.test(String(bj.wert)));
  const kpZ = alleZeilen.find((z) => z.feld === 'kp');
  if (kpZ) pruef('Kaufpreis als Euro formatiert: "' + kpZ.wert + '"', /EUR$/.test(String(kpZ.wert)));

  const flEng = await ruf('objekt_felder_liste', ctx, { nummer: 3, bereich: 'miete' });
  const engZeilen = Object.values(flEng.felder_nach_bereich || {}).flat();
  pruef('mit bereich="miete" bleiben nur Mietfelder (' + engZeilen.length + ')',
    engZeilen.length > 0 && engZeilen.length < alleZeilen.length
      && engZeilen.every((z) => /miete|miet/i.test(z.feld + ' ' + z.bezeichnung)));

  /* ══ TEIL A5 · cashflow_hebel ═════════════════════════════════════════ */
  console.log('\n=== A5 · cashflow_hebel ===');
  const hb = await ruf('cashflow_hebel', ctx, { nummer: nrImChat || 1 });
  pruef('Objekt-Hebel: ' + (hb.hebel || []).length + ' Hebel zu ' + (hb.adresse || '?'),
    hb.gefunden === true && (hb.hebel || []).length > 0);
  pruef('jeder Hebel nennt den Istzustand',
    (hb.hebel || []).every((h) => h.jetzt && h.wirkung));

  /* Die Tilgungswirkung selbst nachrechnen und SUBTRAHIEREN. */
  const oid = hb.id;
  const dq = await query(`SELECT data FROM objects WHERE id = $1`, [oid]);
  const dd = dq.rows[0].data || {};
  const zz = (v) => { const n = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const d1 = zz(dd.d1), d2 = zz(dd.d2), t1 = zz(dd.d1t), t2 = zz(dd.d2t);
  const sollWirkung = Math.round(
    (d1 * t1 / 100 + d2 * t2 / 100) - (d1 * Math.min(t1, 1) / 100 + d2 * Math.min(t2, 1) / 100));
  const tilgHebel = (hb.hebel || []).find((h) => /Tilgungssatz/.test(h.hebel));
  if (tilgHebel && sollWirkung > 0) {
    const istWirkung = zahl(tilgHebel.wirkung);
    pruef('Tilgungswirkung nachgerechnet (Darlehen x Satz / 100)',
      istWirkung != null && Math.abs(istWirkung - sollWirkung) <= 1,
      'soll ' + sollWirkung + ' · ist ' + istWirkung + ' · Differenz '
        + (istWirkung == null ? 'kein Wert' : (istWirkung - sollWirkung)));
    pruef('und nennt den Nachteil im selben Eintrag',
      typeof tilgHebel.aber === 'string' && /Restschuld|verschoben/.test(tilgHebel.aber));
  } else {
    pruef('Tilgungshebel: kein Spielraum, und das Werkzeug sagt es',
      Boolean(tilgHebel), 'Tilgung ' + t1 + '/' + t2 + ' %');
  }

  /* Fehlende Marktmiete darf nicht als "kein Spielraum" erscheinen. */
  const ohneMm = !zz(dd.ds2_marktmiete) && !zz(dd.me_soll);
  if (ohneMm) {
    const l = hb.dafuer_fehlt_eine_angabe || [];
    pruef('ohne Marktmiete: Luecke gemeldet, NICHT "kein Spielraum"',
      l.some((x) => /Mietspielraum/.test(x.hebel))
        && !(hb.hebel || []).some((h) => /Marktniveau/.test(h.hebel) && /kein Spielraum/.test(h.wirkung || '')));
  }

  const hp = await ruf('cashflow_hebel', ctx, { bereich: 'portfolio' });
  const sollPf = Math.round(Number(spiegel.vermoegensbilanz.cashflow_nach_steuer_eur_jahr));
  const istPf = zahl(hp.cashflow_nach_steuer);
  pruef('Portfolio-Hebel: Cashflow stimmt mit dem Spiegel',
    istPf != null && Math.abs(istPf - sollPf) <= 1,
    'soll ' + sollPf + ' · ist ' + istPf + ' · Differenz '
      + (istPf == null ? 'kein Wert' : (istPf - sollPf)));
  pruef('und nennt Stellschrauben', (hp.stellschrauben || []).length > 0);

  /* ══ TEIL B · mit Modell, Marcels Saetze ══════════════════════════════ */
  console.log('\n=== B · Marcels eigene Fragen, mit Modell ===');
  const SAETZE = [
    { f: 'was sind meine besten Wohnungen?', will: 'objekte_rangliste' },
    { f: 'wie ist der Cashflow bei der Musterstraße?', will: 'objekt_kennzahlen' },
    { f: 'wie ist der Investor Deal Score von Nummer 3?', will: 'objekt_kennzahlen' },
    { f: 'gib mir die Felder von Nummer 3', will: 'objekt_felder_liste' },
    { f: 'wie kann ich meinen Cashflow steigern?', will: 'cashflow_hebel' }
  ];

  for (const s of SAETZE) {
    const c2 = { userId: uid, letzteListe: ctx.letzteListe, letztesObjekt: null, protokoll: [],
      merkeObjekt(id) { this.letztesObjekt = id; },
      merkeListe(i) { this.letzteListe = i; } };
    const t0 = Date.now();
    let erg;
    try { erg = await agent.laufen(s.f, c2, { darfKosten: false }); }
    catch (e) { erg = { text: 'FEHLER: ' + e.message, protokoll: c2.protokoll }; }
    const benutzt = (c2.protokoll || []).map((p) => p.werkzeug);
    const sek = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('\n  » ' + s.f);
    console.log('    Werkzeuge: ' + (benutzt.join(' + ') || 'KEINE') + '  (' + sek + ' s)');
    console.log('    ' + String(erg.text || '').replace(/\n/g, '\n    ').slice(0, 700));
    pruef('nimmt ' + s.will, benutzt.indexOf(s.will) >= 0);
    pruef('antwortet ohne Rueckfrage und ohne Fehler',
      String(erg.text || '').length > 30 && !/^FEHLER/.test(String(erg.text)));

    /* Die Nummernfrage ist der eigentliche Punkt: steht die RICHTIGE
       Adresse in der Antwort? */
    if (/Nummer 3/.test(s.f)) {
      const soll = (liste.objekte[2].adresse || '').split(',')[0];
      const teil = soll.split(' ')[0];
      pruef('nennt Objekt 3 (' + soll + ')',
        teil.length > 3 && String(erg.text).toLowerCase().indexOf(teil.toLowerCase()) >= 0);
    }
    if (/besten Wohnungen/.test(s.f)) {
      pruef('nennt die Messgroesse (Score / Cashflow / Rendite)',
        /score|cashflow|rendite/i.test(String(erg.text)));
    }
  }

  console.log('\n──────────────────────────────────────────────');
  console.log('DECKUNG: ' + proben + ' Proben, ' + fehler + ' fehlgeschlagen.');
  console.log(fehler ? 'NICHT BESTANDEN.' : 'Alle Proben bestanden.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH: ' + (e && e.stack || e)); process.exit(2); });
