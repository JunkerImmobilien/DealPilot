'use strict';
/* pruef-telegram-bewertung.js — v2960 / v2960a
 *
 * Prueft OHNE Datenbank, ohne Modell und ohne einen einzigen Abruf:
 *
 *   A  Hilfe: der Spiegel ist da, die Suche findet die richtigen Abschnitte,
 *      und „wie funktioniert …" geht nicht mehr an die feste Befehlsliste
 *   B  Pflicht je Stufe: dieselbe Liste wie pflichtFuer() im Reiter Objekt
 *   C  Nutzlast: der Bot schickt dem Bericht dieselben Felder wie der Browser
 *   D  Geldweg: Stufe nur aus dem Angebot, fehlende Angaben = kein Angebot,
 *      kein zweiter Abruf aus einem Angebot, Bestaetigungssatz mit Bestand
 *   E  Ergebnis: die Zahlen werden unter `data` gefunden, `data` geht nicht
 *      roh ans Modell
 *
 * Datenbank und Abrufdienst sind durch Spione ersetzt — gemessen wird, WAS
 * gerechnet WUERDE, nicht ob es bezahlt wird.
 *
 * Aufruf lokal:      node tools/agent-pruefung/pruef-telegram-bewertung.js
 * im Container:      BACKEND=/app node /tmp/pruef-telegram-bewertung.js
 * mit echtem Bericht: BERICHT=/pfad/bericht.json (die Antwort von
 *                    /reports/from-dealpilot bzw. { data: payload })
 */
const path = require('path');
const fs = require('fs');
const B = process.env.BACKEND || path.join(__dirname, '..', '..', 'backend');
const req = (p) => require(path.join(B, p));

let proben = 0, fehler = 0;
const pruef = (txt, ok, dazu) => {
  proben++; if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok     ' : 'FALSCH ') + txt + (dazu && !ok ? '\n         ' + dazu : ''));
};

/* ── Spione VOR dem Laden der Werkzeuge ─────────────────────────────── */
const dialog = req('src/services/telegramDialogService');
const markt = req('src/services/telegramMarktService');
const OBJEKTE = {
  etw_voll: { str: 'Hermannstr.', hnr: '9', plz: '32609', ort: 'Hüllhorst', objart: 'ETW', wfl: 78,
    baujahr: 1968, kp: 150000, nkm: 600, ds2_zustand: 'gut', ds2_energie: 'D', standardstufe: '3',
    zimmer: 3, etage: '1', nutzungsart: 'wohnen', gsfl: 950, brw: 90, bgf: 120, mea: '7.06',
    erbpacht: false, einheiten: 6, garagen: '' },
  etw_ohne_bgf: { str: 'Hermannstr.', hnr: '9', plz: '32609', ort: 'Hüllhorst', objart: 'ETW', wfl: 78,
    baujahr: 1968, kp: 150000, nkm: 600, ds2_zustand: 'gut', ds2_energie: 'D', standardstufe: '3',
    zimmer: 3, etage: '1', nutzungsart: 'wohnen', gsfl: 950, brw: 90, mea: '7.06' },
  mfh: { str: 'Löhner Str.', hnr: '278', plz: '32120', ort: 'Hiddenhausen', objart: 'MFH', wfl: 233,
    baujahr: 1964, zimmer: 9, mea: '50', gsfl: 800,
    _mfh: { einheiten: [{ nr: '1', wfl: 80, ist: 500, mv_mieter: 'Frau Muster', bilder: ['x'] }] } }
};
dialog.objektKontext = async (uid, id) => OBJEKTE[id]
  ? { objekt_id: id, daten: OBJEKTE[id], geaendert: null } : null;
dialog.objekteListe = async () => Object.keys(OBJEKTE).map((id) => ({ id, adresse: OBJEKTE[id].str }));
let bestand = 3, bezahlt = false;
markt.voranschlag = async (uid, id, s) => ({
  moeglich: true, stufe: s, art: markt.STUFEN[s].art, name: markt.STUFEN[s].name,
  was_drin_ist: markt.STUFEN[s].was, verbraucht_einen_abruf: !bezahlt, bestand: bestand,
  so_sagen: 'x' });
let abrufe = [];
let antwort = null;
markt.abrufen = async (uid, o, s) => { abrufe.push({ id: o.objekt_id, stufe: s, nutzlast: markt.objektNutzlast(o) }); return antwort || { report_id: 4711 }; };

const W = req('src/services/agentWerkzeuge');
const absicht = req('src/services/telegramAbsichtService');
const hilfe = req('src/services/hilfeWissen');
const konst = req('src/generated/frontend-konstanten.json');

function ctxMit(over) {
  const spur = { angebot: null, verbraucht: 0 };
  const c = Object.assign({
    userId: 'u-1', letzteListe: null, letztesObjekt: null, protokoll: [], nummerErfunden: true,
    angebotObjekt: null, angebotStufe: null,
    merkeObjekt(id) { this.letztesObjekt = id; },
    merkeListe(ids) { this.letzteListe = ids; },
    async merkeAngebot(id, adr, st) { spur.angebot = { objekt_id: id, adresse: adr, stufe: st || null }; },
    async angebotVerbraucht() { spur.verbraucht++; spur.angebot = null; }
  }, over || {});
  return { c, spur };
}

(async function () {
  /* ══ A · Hilfe ═════════════════════════════════════════════════════ */
  console.log('\n=== A · Hilfe ===');
  pruef('Spiegel traegt die Hilfe (>= 100 Abschnitte)', hilfe.anzahlAbschnitte() >= 100,
    'gefunden: ' + hilfe.anzahlAbschnitte());
  const fall = [
    ['Wie funktioniert der Quick-Check?', /Quick-Check/],
    ['Was bedeutet DSCR?', /DSCR/],
    ['Wie exportiere ich ein Bank-PDF?', /PDF|Bank/],
    ['Warum sehe ich keinen Investor Deal Score?', /Investor Deal Score/]
  ];
  for (const [f, re] of fall) {
    const t = hilfe.suchen(f, 3);
    pruef('„' + f + '" -> ' + (t[0] ? t[0].thema + ' › ' + t[0].ueberschrift : 'nichts'),
      t.length && re.test(t[0].thema + ' ' + t[0].ueberschrift));
  }
  const hs = await W.finde('hilfe_suchen').fn({}, { frage: 'Was ist der Prozess-Atlas?' });
  pruef('Werkzeug hilfe_suchen liefert Abschnitte woertlich', hs.treffer > 0
    && /Netzplan/.test(hs.abschnitte[0].text));
  const leer = await W.finde('hilfe_suchen').fn({}, { frage: 'xyzzy qwrtz' });
  pruef('kein Treffer -> ehrliche Leere, kein Abschnitt', leer.treffer === 0 && !leer.abschnitte);
  pruef('„wie funktioniert der Quick-Check?" ist KEIN Schnellmuster mehr',
    absicht.erkenne('wie funktioniert der Quick-Check?').art !== 'hilfe');
  pruef('„/hilfe" bleibt die Befehlsliste', absicht.erkenne('/hilfe').art === 'hilfe');
  pruef('„was kannst du?" bleibt die Befehlsliste', absicht.erkenne('was kannst du?').art === 'hilfe');
  pruef('„Hilfe" bleibt die Befehlsliste', absicht.erkenne('Hilfe').art === 'hilfe');

  /* ══ B · Pflicht je Stufe ═════════════════════════════════════════ */
  console.log('\n=== B · Pflicht je Stufe (aus pflichtFuer) ===');
  const P = konst.daten.bewertung.pflicht;
  pruef('ETW Stufe 3 verlangt MEA und BGF', P.ETW['3'].indexOf('mea') >= 0 && P.ETW['3'].indexOf('bgf') >= 0);
  pruef('EFH Stufe 3 verlangt den NHK-Typ', P.EFH['3'].indexOf('nhk_haus') >= 0);
  pruef('Stufe 1 verlangt keinen Kaufpreis', P.ETW['1'].indexOf('kp') < 0);
  pruef('voll erfasste ETW: Stufe 3 abrufbar', markt.fehlendeAngaben(OBJEKTE.etw_voll, 3).length === 0,
    JSON.stringify(markt.fehlendeAngaben(OBJEKTE.etw_voll, 3)));
  const f3 = markt.fehlendeAngaben(OBJEKTE.etw_ohne_bgf, 3);
  pruef('ETW ohne BGF: Stufe 3 nennt genau die BGF', f3.length === 1 && f3[0].id === 'bgf',
    JSON.stringify(f3));
  pruef('... mit Formularbeschriftung', f3[0] && /Bruttogrundfl/.test(f3[0].name));
  pruef('ETW ohne BGF: Stufe 2 trotzdem abrufbar', markt.fehlendeAngaben(OBJEKTE.etw_ohne_bgf, 2).length === 0);
  const gar = Object.assign({}, OBJEKTE.etw_voll, { garagen: '1' });
  pruef('mit Garage verlangt Stufe 3 die Garagen-BGF',
    markt.fehlendeAngaben(gar, 3).some((f) => f.id === 'garagen_bgf_qm'));

  /* ══ C · Nutzlast wie im Browser ══════════════════════════════════ */
  console.log('\n=== C · Nutzlast ===');
  const n = markt.objektNutzlast({ objekt_id: 'etw_voll', daten: OBJEKTE.etw_voll });
  pruef('Zustand, Standardstufe, BRW, BGF reisen mit',
    n.ds2_zustand === 'gut' && n.standardstufe === '3' && n.brw === 90 && n.bgf === 120);
  pruef('nicht gesetztes Haekchen (erbpacht=false) reist NICHT mit', !('erbpacht' in n));
  pruef('Einheiten passen nicht zur ETW und reisen nicht mit', !('einheiten' in n));
  pruef('leeres Feld (garagen) reist nicht mit', !('garagen' in n));
  const m = markt.objektNutzlast({ objekt_id: 'mfh', daten: OBJEKTE.mfh });
  pruef('MFH: MEA passt nicht und reist nicht mit', !('mea' in m));
  pruef('MFH: Einheiten schlank, ohne Mietername und Bild',
    Array.isArray(m._mfh_einheiten) && m._mfh_einheiten[0].wfl === 80
    && !('mv_mieter' in m._mfh_einheiten[0]) && !('bilder' in m._mfh_einheiten[0])
    && m._mfh_einheiten[0].art === 'wohnen');
  pruef('mehr als die alten zwoelf Felder', Object.keys(n).length > 12, Object.keys(n).join(','));

  /* ══ D · Geldweg ═══════════════════════════════════════════════════ */
  console.log('\n=== D · Geldweg ===');
  let x = ctxMit({ letztesObjekt: 'etw_ohne_bgf' });
  let r = await W.finde('marktbericht_preis').fn(x.c, { stufe: 3 });
  pruef('fehlende Pflicht: kein Angebot, keine Bestaetigung',
    r.abrufbar === false && !x.spur.angebot && !x.c.bestaetigung, JSON.stringify(r).slice(0, 200));
  pruef('... und die fehlende Angabe wird genannt', (r.fehlende_angaben || []).some((t) => /Bruttogrund/.test(t)));

  x = ctxMit({ letztesObjekt: 'etw_voll' });
  r = await W.finde('marktbericht_preis').fn(x.c, { stufe: 3 });
  pruef('vollstaendig: Angebot MIT Stufe 3', x.spur.angebot && x.spur.angebot.stufe === 3);
  pruef('Bestaetigung nennt Stufe, Verbrauch und Bestand',
    /Wertermittlung/.test(x.c.bestaetigung || '') && /noch 3 frei/.test(x.c.bestaetigung || '')
    && /Ja\*? oder \*?Nein/.test(x.c.bestaetigung || ''), x.c.bestaetigung);

  bestand = 0;
  x = ctxMit({ letztesObjekt: 'etw_voll' });
  r = await W.finde('marktbericht_preis').fn(x.c, { stufe: 2 });
  pruef('Kontingent 0: kein Angebot', r.kontingent_leer === true && !x.spur.angebot);
  bestand = 3;

  x = ctxMit({ letztesObjekt: 'etw_voll' });
  r = await W.finde('marktbericht_preis').fn(x.c, {});
  pruef('ohne Stufe: Uebersicht ueber drei Stufen, keine Bestaetigung',
    Array.isArray(r.stufen) && r.stufen.length === 3 && !x.c.bestaetigung);
  pruef('... Angebot ohne Stufe', x.spur.angebot && !x.spur.angebot.stufe);

  abrufe = [];
  x = ctxMit({ angebotObjekt: 'etw_voll', angebotStufe: null });
  r = await W.finde('marktbericht_abrufen').fn(x.c, { stufe: 3 });
  pruef('Angebot ohne Stufe: KEIN Abruf, auch wenn das Modell Stufe 3 will', abrufe.length === 0);

  abrufe = [];
  x = ctxMit({ angebotObjekt: 'etw_voll', angebotStufe: 1 });
  r = await W.finde('marktbericht_abrufen').fn(x.c, { stufe: 3, id: 'mfh' });
  pruef('Modell will Stufe 3 bei Objekt mfh: gerechnet wird Angebot (etw_voll, Stufe 1)',
    abrufe.length === 1 && abrufe[0].id === 'etw_voll' && abrufe[0].stufe === 1, JSON.stringify(abrufe.map((a) => [a.id, a.stufe])));
  pruef('... und die Abweichung wird gemeldet', Boolean(r.stufe_abweichung_gemeldet));
  pruef('... der Bericht schickt die volle Nutzlast', abrufe[0] && abrufe[0].nutzlast.standardstufe === '3');
  pruef('PDF-Link zum Bericht steht bereit', /report=4711&autopdf=1/.test(x.c.berichtPdfLink || ''), x.c.berichtPdfLink);
  const r2 = await W.finde('marktbericht_abrufen').fn(x.c, { stufe: 1 });
  pruef('ein Angebot traegt genau EINEN Abruf', abrufe.length === 1 && r2.ok === false);

  abrufe = [];
  OBJEKTE.etw_aendert = Object.assign({}, OBJEKTE.etw_ohne_bgf);
  x = ctxMit({ angebotObjekt: 'etw_aendert', angebotStufe: 3 });
  r = await W.finde('marktbericht_abrufen').fn(x.c, {});
  pruef('Pflicht wird am Abruf noch einmal geprueft', abrufe.length === 0 && r.abrufbar === false);

  /* ══ E · Ergebnis ═════════════════════════════════════════════════ */
  console.log('\n=== E · Ergebnis ===');
  let echt = null;
  if (process.env.BERICHT && fs.existsSync(process.env.BERICHT)) {
    echt = JSON.parse(fs.readFileSync(process.env.BERICHT, 'utf8'));
    if (!echt.data && echt.payload) echt = { report_id: echt.id, data: echt.payload, report_md: echt.report_md };
  }
  antwort = echt || { report_id: 1, report_md: '# Bericht', trace: ['x'],
    data: { valuation: { market_value: { estimated: 171000, low: 134000, high: 246000 } },
      rent: { median_per_sqm: 10 }, cross_check: { ertragswert: { available: true, value_eur: 81000 },
        sachwert: { available: false, grund: 'BGF fehlt' }, bodenwert: { wert: 42840 },
        quellen_nachweis: [{ vermerk: 'Gutachterausschuss X' }] }, gross: 'y'.repeat(60000) } };
  x = ctxMit({ angebotObjekt: 'etw_voll', angebotStufe: 3 });
  r = await W.finde('marktbericht_abrufen').fn(x.c, {});
  pruef('Marktwert wird gefunden' + (echt ? ' (echter Bericht ' + antwort.report_id + ')' : ''),
    r.zahlen && r.zahlen.marktwert_eur, JSON.stringify(r.zahlen));
  pruef('Ertragswert wird gefunden', r.zahlen && r.zahlen.ertragswert_eur);
  pruef('Quellen werden mitgegeben', r.zahlen && Array.isArray(r.zahlen.quellen) && r.zahlen.quellen.length > 0);
  pruef('`data` und `trace` gehen nicht roh ans Modell', !('data' in r.rumpf) && !('trace' in r.rumpf));
  const laenge = JSON.stringify(r).length;
  pruef('Werkzeugergebnis passt unter die 24.000-Zeichen-Kappe', laenge < 24000, 'Laenge ' + laenge);
  if (echt) console.log('         zahlen: ' + JSON.stringify(r.zahlen).slice(0, 400));

  /* ══ F · v2961 PDF-Auftrag (ohne Dienst, ohne Browser) ══════════════ */
  console.log('\n=== F · PDF-Auftrag ===');
  const W2 = W.finde('pdf_erstellen');
  const altGeheim = process.env.PDF_DIENST_SECRET;
  delete process.env.PDF_DIENST_SECRET;
  x = ctxMit({ letztesObjekt: 'etw_voll' });
  r = await W2.fn(x.c, { art: 'bank' });
  pruef('ohne Dienst: ehrliche Absage, kein Auftrag', r.kein_dienst === true && !x.c.pdfAuftrag);
  process.env.PDF_DIENST_SECRET = 'probe';
  x = ctxMit({ letztesObjekt: 'etw_voll' });
  r = await W2.fn(x.c, { art: 'bank_kurz' });
  pruef('mit Dienst: Auftrag fuer das Objekt, Datei geht NICHT durchs Modell',
    x.c.pdfAuftrag && x.c.pdfAuftrag.art === 'bank_kurz' && x.c.pdfAuftrag.objekt_id === 'etw_voll' && !('pdf' in r));
  x = ctxMit({});
  r = await W2.fn(x.c, { art: 'bankexport' });
  pruef('Bankexport braucht kein Objekt', x.c.pdfAuftrag && x.c.pdfAuftrag.art === 'bankexport');
  markt.berichte = async () => ({ ok: true, berichte: [] });
  x = ctxMit({ letztesObjekt: 'etw_voll' });
  r = await W2.fn(x.c, { art: 'marktbericht' });
  pruef('Marktbericht ohne Bericht: kein Auftrag, kein erfundener Bericht', r.kein_bericht === true && !x.c.pdfAuftrag);
  markt.berichte = async () => ({ ok: true, berichte: [{ report_id: 349 }, { report_id: 350 }] });
  x = ctxMit({ letztesObjekt: 'etw_voll' });
  r = await W2.fn(x.c, { art: 'marktbericht' });
  pruef('Marktbericht: der LETZTE Bericht wird geholt', x.c.pdfAuftrag && x.c.pdfAuftrag.report_id === 350);
  r = await W2.fn(ctxMit({}).c, { art: 'gutachten' });
  pruef('unbekannte Art wird abgewiesen', r.ok === false);
  x = ctxMit({ angebotObjekt: 'etw_voll', angebotStufe: 2 });
  antwort = { report_id: 77, data: {} };
  r = await W.finde('marktbericht_abrufen').fn(x.c, {});
  pruef('nach dem Abruf kommt der Bericht als Datei, nicht als Link',
    x.c.pdfAuftrag && x.c.pdfAuftrag.report_id === 77 && !x.c.berichtPdfLink);
  if (altGeheim) process.env.PDF_DIENST_SECRET = altGeheim; else delete process.env.PDF_DIENST_SECRET;

  console.log('\n──────────────────────────────────────────────');
  console.log('DECKUNG: ' + proben + ' Proben, ' + fehler + ' fehlgeschlagen.');
  console.log('KEIN Abruf, keine Datenbank, kein Modell.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH: ' + (e && e.stack || e)); process.exit(2); });
