'use strict';
/* portfolioExport.js - v2043
 * ═════════════════════════════════════════════════════════════════════
 * DER PORTFOLIO-EXPORT: nicht nur die Daten, sondern das WISSEN.
 *
 * Marcel, 09.10.2026: „ich brauche dann ein Export ueber das gesamte
 * Portfolio. Wichtig ist, dass wir das gesamte Wissen mitgeben."
 *
 * ── WARUM DIE VORHANDENE SICHERUNG NICHT REICHT ─────────────────────
 *
 * `exportAllJSON()` im Frontend gibt es schon. Sie schreibt eine
 * `.dpkt`-Datei zum WIEDERHERSTELLEN: je Objekt der rohe Datensatz mit
 * rund 280 Schluesseln wie `kp`, `nkm`, `_kpis_dscr`, `ds2_marktfaktor`.
 *
 * Damit kann DealPilot etwas anfangen. Ein Mensch nicht, und eine
 * fremde Tabelle auch nicht.
 *
 *   > Ein Export, der nur Werte traegt, gibt Daten weiter. Wissen gibt
 *   > weiter, wer dazuschreibt, WAS die Werte bedeuten - sonst muss der
 *   > Empfaenger raten, und dann rechnet er mit `bmy` als Prozent,
 *   > obwohl dort ein Faktor steht.
 *
 * ── WAS MITGEHT ─────────────────────────────────────────────────────
 *
 *   lexikon.felder       225 Feld-Ids mit Beschriftung und Art
 *   lexikon.objektarten  welche Art welche Felder traegt
 *   lexikon.score_stufen die Schwellen und Woerter (85/70/50/35)
 *   lexikon.hinweise     die Einheiten-Fallen, die hier teuer waren
 *   wissen.projekt       `bot-wissen.md` - was die Piloten wissen
 *   wissen.eigenes       Marcels eigene Ergaenzung (einmal, nicht je Objekt)
 *   objekte[]            je Objekt: Datensatz, Analyse, Ankauf-Stand
 *
 * ── WAS NICHT MITGEHT, UND WARUM ────────────────────────────────────
 *
 * **Fotos.** Ein Objekt traegt bis zu sechs Bilder als base64; bei 21
 * Objekten waere die Datei dreistellig in Megabyte und in keiner
 * Tabelle zu oeffnen. Die Zahl steht drin, die Bilder auf Wunsch
 * (`?fotos=1`) - dann aber bewusst.
 *
 * **Nichts wird gerechnet.** Die Kennzahlen stehen als `_kpis_*` im
 * Datensatz, gerechnet von den echten Kernen zu ihrer Zeit. Sie hier
 * neu zu rechnen hiesse, alte Daten mit heutigen Regeln zu messen.
 * ═════════════════════════════════════════════════════════════════════
 */
const { query } = require('../db/pool');
const projektwissen = require('./projektwissen');

/* ═══ v2069 · DIE MARKTBERICHTE KOMMEN AUS IHRER EIGENEN DATENBANK ════
 *
 * Marcel, 10.10.2026: „Wir sollten schon die Datenbank darauf anpassen,
 * dass wenn wir einen Marktbericht machen … dann sollten wir ja auf
 * diese Felder zugreifen koennen … Dass man auch den Verlauf sieht, was
 * ueber die Jahre passiert ist. Ob das Objekt im Preis gestiegen ist."
 *
 * UND SEINE ANDERE HAELFTE, DIE GENAUSO WICHTIG IST: „Ich finde nicht,
 * dass es diese Felder dann bei uns nochmal extra geben muss."
 *
 * Also KEINE neuen Spalten in `objects`. Die Daten liegen laengst - nur
 * in einer anderen Datenbank:
 *
 *   mb.market_reports      160 Berichte, mit `payload` und `report_md`
 *   mb.valuation_results   373 Bewertungen
 *   mb.object_snapshots    160 Staende
 *
 * GEMESSEN am 10.10.2026: 139 der 160 Berichte tragen eine `user_id`
 * (UUID, passt zu `users.id`), alle 160 einen Text ueber 100 Zeichen.
 * Verbunden sind sie ueber `object_key = 'dp:' + objects.id`.
 *
 * Der Export fragte diese Datenbank NICHT. Er holte `objects` und war
 * fertig - der ganze Marktbericht-Teil fehlte, obwohl zwei fertige
 * Endpunkte dafuer existieren (v942).
 *
 *   > Ein Export, der „alles" verspricht, muss wissen, wo alles liegt.
 *   > Dieselbe Lektion wie bei der Portfolio-Analyse in v2047 - diesmal
 *   > eine ganze Datenbank weiter.
 *
 * Gefragt wird der Microservice, nicht die fremde Datenbank direkt:
 * `marktbericht.js` macht es seit jeher so, und eine zweite
 * Pool-Verbindung waere ein zweiter Ort, an dem Zugangsdaten stehen.
 */
const MB_BASE = (process.env.MB_BACKEND_URL
  || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

/* v3157 · ein Punkt des Marktbericht-Verlaufs mit allem, was die Wertermittlung traegt: Stufe, Verfahren,
   Herkunft A-E/N, indikativ, Quellen. Wunsch aus dem Modul Portfolio-Strategie (Protokoll 03.11.2026, P1).
   Zahlen kommen aus mb /objects/history - eine Stelle, keine zweite Rechnung. */
function _zahl(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function _verlaufPunkt(x) {
  const h = (x.herkunft && typeof x.herkunft === 'object') ? x.herkunft : null;
  const ew = _zahl(x.ertragswert_eur), sw = _zahl(x.sachwert_eur), vw = _zahl(x.vergleichswert_eur);
  return {
    datum: x.created_at, bericht_id: x.report_id,
    wert_stufe: x.wert_stufe != null ? Number(x.wert_stufe) : null,
    wertermittlungsstichtag: (function () { const w = x.wertermittlungsstichtag; if (!w) return null; try { const o = JSON.parse(w); return o && typeof o === 'object' ? (o.datum || null) : w; } catch (e) { return w; } })(),   /* v3157a: kam als JSON-Text */
    marktwert_eur: _zahl(x.market_value), marktwert_von: _zahl(x.market_value_low), marktwert_bis: _zahl(x.market_value_high),
    eur_pro_qm: _zahl(x.median_sqm), wohnflaeche: _zahl(x.living_area), baujahr: x.build_year || null,
    ertragswert: ew != null ? { eur: ew, von: _zahl(x.ertragswert_von_eur), bis: _zahl(x.ertragswert_bis_eur), bezeichnung: x.ertragswert_bezeichnung || null,
      miete_ist_qm: _zahl(x.ew_miete_ist_qm), miete_vergleich_qm: _zahl(x.ew_miete_vergleich_qm), miete_stufe: x.ew_miete_stufe || null } : null,
    sachwert: sw != null ? { eur: sw, gebaeude_eur: _zahl(x.sw_gebaeude_eur), faktor: _zahl(x.sw_faktor), faktor_stufe: x.swf_stufe || null,
      faktor_grund: x.sw_faktor_grund || null, marktangepasst: x.sw_marktangepasst === true, vorlaeufig: x.sachwert_vorlaeufig === true } : null,
    bodenwert_eur: _zahl(x.sw_bodenwert_eur),
    vergleichswert: (vw != null || _zahl(x.irw_vergleichswert_eur) != null) ? { eur: vw, amtlich: x.vergleichsfaktor_amtlich === true,   /* v3157a: boolean, nicht Zahl */
      irw_eur: _zahl(x.irw_vergleichswert_eur), ausschuss: x.vergleich_ausschuss || null, hinweis: x.vergleich_hinweis || null } : null,
    lzs: x.lzs_pct != null ? { pct: _zahl(x.lzs_pct), stufe: x.lzs_stufe || null, zweig: x.lzs_zweig || null, jahr: x.lzs_berichtsjahr || null, aus_register: x.lzs_aus_register === true } : null,
    rnd_jahre: _zahl(x.sw_rnd_jahre), gnd_jahre: _zahl(x.gnd_jahre),
    fuehrend: x.fuehrend ? { verfahren: x.fuehrend, grund: x.fuehrend_grund || null, quelle: x.fuehrend_quelle || null } : null,
    indikativ: h ? !!h.indikativ : null,
    herkunft: h ? { stufe: h.stufe || null, kurz: h.kurz || null, lang: h.lang || null, ebene: h.ebene || null, unter_a: h.unter_a,
      weg: h.weg || null, quelle: h.quelle || null, quelle_link: h.quelle_link || null } : null,
    herkunft_ebene: h ? (h.ebene || null) : null,
    quellen_nachweis: Array.isArray(x.quellen_nachweis) ? x.quellen_nachweis : [],
    quellen_nachweis_markt: Array.isArray(x.quellen_nachweis_markt) ? x.quellen_nachweis_markt : [],
    miete_vergleich_qm: _zahl(x.ew_miete_vergleich_qm),
    beleihungswert_eur: null   /* wird unten fuer den juengsten Stufe-3-Bericht gesetzt */
  };
}

/* v3157 · POST an den Marktbericht (Beleihungswert); gleicher Schutz wie mbHolen */
async function mbSenden(pfad, userId, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(MB_BASE + pfad + '?user_id=' + encodeURIComponent(userId), { method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ user_id: userId }, body || {})) });
    const text = await r.text();
    if (r.status >= 400) return { fehler: 'HTTP ' + r.status };
    try { return JSON.parse(text); } catch (e) { return { fehler: 'keine JSON-Antwort' }; }
  } catch (e) { return { fehler: String(e && e.message || e).slice(0, 120) }; } finally { clearTimeout(t); }
}

async function mbHolen(pfad, userId) {
  const url = MB_BASE + pfad + '?user_id=' + encodeURIComponent(userId);
  /* Der Export darf an einem langsamen Nachbarn nicht haengen bleiben.
     Faellt der Dienst aus, fehlt der Marktbericht-Block - und das steht
     dann auch drin, statt ihn stillschweigend wegzulassen. */
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const text = await r.text();
    if (r.status >= 400) return { fehler: 'HTTP ' + r.status };
    try { return JSON.parse(text); } catch (e) { return { fehler: 'keine JSON-Antwort' }; }
  } catch (e) {
    return { fehler: String(e && e.message || e).slice(0, 120) };
  } finally { clearTimeout(t); }
}

let _konst = null;
function konstanten() {
  if (_konst) return _konst;
  try {
    _konst = require('../generated/frontend-konstanten.json');
  } catch (e) {
    _konst = { daten: {} };
  }
  return _konst;
}

/* ══ v2102 · BUNDESLAND UND AMTLICHER GREST-SATZ AUS DER PLZ ═══════════
 *
 * Die Tabelle wird NICHT hier gefuehrt. Sie liegt im Frontend
 * (`grest-plz-lookup.js`) und ist seit `v1823` von
 * `tools/frontend-konstanten.mjs` nach `frontend-konstanten.json`
 * gespiegelt — mit einem Pruefhaken auf 16 Laender. Eine zweite Tabelle
 * hier waere die Bauart, gegen die dieses Werkzeug gebaut wurde.
 *
 * `plz_bereiche` ist `[von, bis, Kuerzel]`. Gemessen an zehn echten PLZ
 * (32609 NW, 10115 BE, 80331 BY, 20095 HH, 01067 SN, 60311 HE, 70173 BW,
 * 04109 SN, 99084 TH, 24103 SH) trifft die Tabelle jede.
 *
 * KEIN TREFFER HEISST KEIN LAND — nie das naechstgelegene. Dieselbe
 * Doktrin wie beim Register: wir erfinden keine Zahl. Dann steht in
 * `grest_herkunft`, WARUM nichts da ist, damit der Empfaenger es nicht
 * fuer einen Fehler haelt.
 */
function grestFuer(plz) {
  const leer = { kuerzel: null, name: null, satz: null, herkunft: null };
  const s = String(plz == null ? '' : plz).trim();
  if (!/^\d{5}$/.test(s)) {
    return Object.assign({}, leer, {
      herkunft: s ? 'plz "' + s.slice(0, 8) + '" ist keine fuenfstellige Postleitzahl'
                  : 'keine plz am Objekt'
    });
  }
  const g = (konstanten().daten || {}).grest;
  if (!g || !g.saetze || !Array.isArray(g.plz_bereiche)) {
    return Object.assign({}, leer, { herkunft: 'GrESt-Tabelle nicht gespiegelt' });
  }
  const n = parseInt(s, 10);
  let kuerzel = null;
  for (let i = 0; i < g.plz_bereiche.length; i++) {
    const b = g.plz_bereiche[i];
    if (!Array.isArray(b) || b.length < 3) continue;
    if (n >= Number(b[0]) && n <= Number(b[1])) { kuerzel = b[2]; break; }
  }
  if (!kuerzel) {
    return Object.assign({}, leer, {
      herkunft: 'plz ' + s + ' liegt in keinem der ' + g.plz_bereiche.length + ' PLZ-Bereiche'
    });
  }
  const satz = (g.saetze[kuerzel] != null) ? Number(g.saetze[kuerzel]) : null;
  return {
    kuerzel: kuerzel,
    name: (g.namen && g.namen[kuerzel]) || kuerzel,
    satz: satz,
    herkunft: satz != null
      ? 'abgeleitet aus plz ' + s + ' (' + kuerzel + ')'
      : 'Land ' + kuerzel + ' erkannt, aber kein Satz in der Tabelle'
  };
}

/* ══════════════════════════════════════════════════════════════════════
   v2103 · WEM GEHOERT DAS OBJEKT — Backlog N60.33 (4)

   Marcel am 11.10.2026: „Die Rechtsform der Gesellschaft. Dann auch die
   unter Mandanten in den Einstellungen unsere Steuersaetze ueber die
   Jahre."

   GEMESSEN, bevor hier etwas gebaut wurde:

     `halter` steht seit Langem an jedem Objekt (`storage.js:174`) und
     liegt WIRKLICH auf dem Server - am Staging-Bestand gezaehlt:
     22 Objekte tragen `halter='privat'`, 5 tragen keinen, 13 tragen
     zusaetzlich `halter_seit`.

     `portfolioExport.js` nannte `halter` bis hierher NULL MAL.

   > Das ist der eigentliche Befund: nicht die Rechtsform fehlte, sondern
   > der SCHLUESSEL. Eine Mandanten-Liste waere ohne ihn nicht
   > verknuepfbar gewesen - wir haetten Rechtsformen geliefert und keine
   > Zuordnung, welches Objekt zu welcher gehoert.

   ─────────────────────────────────────────────────────────────────────
   WARUM HIER KEINE STEUERSPHAERE AUSGERECHNET WIRD

   `mandanten.js` hat dafuer `sphaere()`, und die Funktion ist der
   ausdrueckliche EINZIGE Schiedsrichter (v1404, nach einem Befund von
   9,6 % zu viel ausgewiesener Entlastung). Sie liest die Rechtsform aus
   den Mandanten-Einstellungen.

   Die liegen im `localStorage` unter `dp_mandanten` - im Backend gibt es
   dafuer **null Treffer**. Der Server kennt also keine Rechtsform.

   Eine zweite Fassung von `sphaere()` hier waere genau die Doppelung,
   die v1404 aufgeraeumt hat, und sie wuerde raten, wo sie nichts weiss.
   Deshalb liefert der Export die TATSACHEN und sagt, was fehlt.

   `privat` ist die eine Ausnahme, und zwar ohne Nachschlagen: der
   Eintrag ist in `mandanten.js:52` fest verdrahtet (`rechtsform:
   'privat'`), und `sphaere()` gibt dafuer `'est'` zurueck, BEVOR sie
   irgendetwas liest. Das ist eine Konstante, keine Rechnung.
   ══════════════════════════════════════════════════════════════════════ */
function halterFuer(daten) {
  const roh = String((daten && daten.halter) != null ? daten.halter : '').trim();
  const seit = String((daten && daten.halter_seit) != null ? daten.halter_seit : '').trim();

  /* Kein Halter am Objekt heisst nicht „keine Angabe": die App zeigt
     dann „Privat", weil das <select> darauf vorbelegt ist. Das wird
     hier benannt, nicht stillschweigend gleichgesetzt. */
  if (!roh) {
    return {
      id: null,
      seit: seit || null,
      steuersphaere: 'est',
      rechtsform: 'privat',
      herkunft: 'kein halter am Objekt - die App zeigt dafuer die Vorbelegung "Privat"'
    };
  }
  if (roh === 'privat') {
    return {
      id: 'privat',
      seit: seit || null,
      steuersphaere: 'est',
      rechtsform: 'privat',
      herkunft: 'halter "privat" ist der feste Eintrag der App, keine Gesellschaft'
    };
  }
  return {
    id: roh,
    seit: seit || null,
    steuersphaere: null,
    rechtsform: null,
    herkunft: 'halter "' + roh.slice(0, 40) + '" ist eine Mandanten-ID. '
      + 'Rechtsform und Steuersaetze liegen im localStorage (dp_mandanten) '
      + 'und sind dem Server nicht bekannt - siehe Backlog N60.28'
  };
}

/* Die Score-Kette. Sie steht an EINER Stelle im Frontend
   (`score-tiers.js`); hier wird sie NICHT nachgebaut, sondern als Text
   mitgegeben - wer den Export liest, soll wissen, was "62" heisst. */
const SCORE_STUFEN = [
  { ab: 85, wort: 'Sehr gut', farbe: 'top' },
  { ab: 70, wort: 'Gut', farbe: 'green' },
  { ab: 50, wort: 'Solide', farbe: 'gold' },
  { ab: 35, wort: 'Schwach', farbe: 'red' },
  { ab: 0, wort: 'Kritisch', farbe: 'red' }
];

/* Die Fallen, die in diesem Projekt Geld gekostet haben. Sie gehoeren
   in den Export: wer damit weiterrechnet, laeuft sonst in dieselben. */
const HINWEISE = [
  'Alle Geldbetraege sind EURO, nicht Cent.',
  '`nkm` ist die NettokaltMIETE pro MONAT, nicht pro m2.',
  '`_kpis_cf_ns` ist der Cashflow nach Steuer pro JAHR, nicht pro Monat.',
  '`_kpis_bmy` / `_kpis_nmy` sind Renditen in PROZENT.',
  '`_kpis_dscr` ist ein Verhaeltnis ohne Einheit - eine Prozentangabe darauf ist irrefuehrend.',
  '`lageklasse` ist A, B, C oder D - A ist die beste.',
  '`_ankauf` ist der eingefrorene Stand beim Nutzen-/Lastenwechsel (das Soll). Der uebrige Datensatz ist der laufende Stand (das Ist).',
  'Soll-Miete und Ist-Miete sind etwas ANDERES: die beschreiben eine Miete, nicht zwei Zeitpunkte.',
  'Ein fehlender Wert ist fehlend, nicht null. `null` heisst "liegt nicht vor" und darf nicht als 0 gerechnet werden.',
  /* v2102 */
  '`gest_p` ist der vom Nutzer ANGESETZTE Grunderwerbsteuersatz, `grest_satz_amtlich` der des Bundeslandes. '
    + 'Sie DUERFEN abweichen: wer einen Kaufpreisanteil fuer Inventar herausrechnet, zahlt auf weniger Steuer. '
    + 'Woher das Land kommt, steht in `grest_herkunft` - ohne Treffer gibt es KEIN Land, nicht das naechstgelegene.',
  /* v2103 */
  '`halter` ist die Mandanten-ID, der das Objekt zugeordnet ist. "privat" ist der feste Eintrag der App, keine Gesellschaft. '
    + '`steuersphaere` ist "est" (Einkommensteuer des Nutzers, EIN Topf) oder die Halter-ID (eigene Koerperschaftsteuer). '
    + 'Sie ist NULL, wo der Server die Rechtsform nicht kennt: die Mandanten liegen nur im Browser. `halter_herkunft` sagt welcher Fall vorliegt. '
    + 'Eine fehlende Sphaere darf NICHT als "est" gerechnet werden - das steckt eine GmbH in die Progression des Nutzers.',
  'Die Pilot-Analyse traegt in `_fuer` einen Stempel: fuer welches Objekt und welchen Datenstand sie gilt. Eine Analyse ohne passenden Abdruck ist veraltet.'
];

/* ═══ v2066 · DIE STRUKTUREN MIT UNTERSTRICH ERKLAEREN ═══════════════
 *
 * Marcel, 10.10.2026: „Sind da auch alle Angaben von der Stufe 3 drin?
 * Also wirklich alle Felder, die wir auch im Tab Objekt und auch im
 * Wohnungskonfigurator fuer Mehrfamilienhaeuser haben, mit drinne? Also
 * auch Mietverhaeltnis und die einzelnen Angaben zu den Wohnungen."
 *
 * GEMESSEN am echten Export (22 Objekte): ja, alles drin. 286 Feldnamen
 * je Datensatz, davon 273-281 belegt. Die Wohnungen stehen unter `_mfh`
 * bei 10 von 22 Objekten, mit 2 bis 24 Einheiten.
 *
 * ABER: das Lexikon fuehrte 225 Felder - alle aus dem FORMULAR. Die
 * 35 internen Strukturen mit Unterstrich, die wirklich Inhalt tragen,
 * waren KEINE davon. Darunter ausgerechnet `_mfh`, `_ankauf` und saemtliche
 * `_kpis_*`.
 *
 *   > Der Kopf dieser Datei sagt: „Ein Export, der nur Werte traegt,
 *   > gibt Daten weiter. Wissen gibt weiter, wer dazuschreibt, WAS die
 *   > Werte bedeuten." Genau das galt fuer die Formularfelder und nicht
 *   > fuer die Strukturen, die am meisten Erklaerung brauchen.
 *
 * Wer `_mfh` liest, muss sonst raten, ob `ist` und `soll` Monats- oder
 * Jahresmieten sind und was `status` bedeutet. Beides steht jetzt dabei.
 */
const STRUKTUREN = {
  _mfh: {
    was: 'Der Wohnungskonfigurator fuer Mehrfamilienhaeuser - je Einheit eine Zeile.',
    gilt_fuer: 'objart MFH, ZFH, GESCH, BUERO, HOTEL',
    felder: {
      gnd: 'Gesamtnutzungsdauer in Jahren (Anlage 2 ImmoWertV)',
      stand: 'Datum der letzten Bearbeitung (JJJJ-MM-TT)',
      aufgeteilt: 'true = nach WEG aufgeteilt, jede Einheit einzeln verkaeuflich',
      sollAbJahr: 'ab welchem Jahr die Soll-Miete angesetzt wird',
      gebaeude: 'Zustand der GEMEINSAMEN Bauteile: dach, aussenwand, leitungen, heizung. '
              + 'Stufen: "0" nicht modernisiert, "h" teilweise erneuert, "v" erneuert/modern',
      einheiten: 'Liste der Wohnungen - siehe `einheit` unten'
    },
    einheit: {
      nr: 'laufende Nummer der Einheit',
      lage: 'Freitext, z. B. "Nr. 10 - EG links"',
      art: 'wohnen | gewerbe | stellplatz',
      wfl: 'Wohnflaeche in m2 (deutsche Schreibweise, Komma als Dezimaltrenner)',
      zimmer: 'Anzahl Zimmer',
      ist: 'IST-Kaltmiete pro MONAT in Euro - was heute gezahlt wird',
      soll: 'SOLL-Kaltmiete pro MONAT in Euro - was ab `sollAbJahr` angesetzt wird',
      status: 'das MIETVERHAELTNIS: vermietet | leer | eigennutzung | gekuendigt',
      zustand: 'Note 1-5: 5 neuwertig, 4 modernisiert, 3 gepflegt, 2 renovierungsbed., 1 sanierungsbed.',
      massnahme: 'geplante Massnahme als Freitext, z. B. "Bad modernisieren"',
      kosten: 'geschaetzte Kosten dieser Massnahme in Euro',
      /* v3157 · Schnittstellen-Pruefung 03.11.2026: die folgenden Felder gingen roh mit, standen aber hier nicht */
      etage: 'Geschoss als Freitext', balkon_qm: 'Balkon-/Terrassenflaeche in m2', keller: 'Kellerabteil vorhanden (true/false)',
      stellplatz: 'Stellplatz zugeordnet (true/false)', stellplatz_miete: 'Stellplatzmiete pro MONAT in Euro',
      mea_anteil: 'Miteigentumsanteil der Einheit (Zaehler, z. B. 125 von 1.000)', gew: 'Gewichtung/Anteil der Einheit an Hauskosten',
      nk_vorauszahlung: 'Nebenkostenvorauszahlung pro MONAT in Euro',
      mod: 'Modernisierungsstand der Einheit je Bauteil (Schluessel wie gebaeude; "0" nicht, "h" teilweise, "v" erneuert)',
      ziel_qm: 'Zielbild: Kaltmiete in Euro/m2 nach den Massnahmen', ziel_wann: 'Zielbild: ab wann (Jahr oder JJJJ-MM)',
      vgl_qm: 'ortsuebliche Vergleichsmiete der Einheit in Euro/m2 (Mietspiegel oder eigene Angabe)',
      markt_qm: 'Marktmiete der Einheit in Euro/m2 (aktueller Marktdurchschnitt)',
      kappung_pct: 'Kappungsgrenze in Prozent (15 oder 20) fuer diese Einheit, falls abweichend',
      leer_monate: 'erwarteter Leerstand in Monaten (bei Mieterwechsel/Massnahme)', leer_abzug: 'true = Leerstand im Ertrag abziehen',
      massnahmen: 'Liste der Massnahmen der Einheit - siehe massnahme_eintrag unten',
      mv_art: 'Vertragsart: unbefristet | staffel | index | zeitmiete | gewerbe | moebliert_kurz',
      mv_beginn: 'Mietbeginn (JJJJ-MM-TT)', mv_mieter: 'Name des Mieters (aus dem Vertrag gelesen ohne KI oder von Hand)',
      mv_kaution: 'Kaution in Euro', mv_letzte_erhoehung: 'Datum der letzten Mieterhoehung (JJJJ-MM-TT)',
      mv_letzte_erhoehung_betrag: 'Betrag der letzten Erhoehung in Euro pro Monat',
      mv_naechste_anpassung: 'naechste Staffel/Indexanpassung (JJJJ-MM-TT)', mv_erhoehung_art: 'Art der Anpassung (Staffel: betrag | prozent)',
      mv_erhoehung_wert: 'Hoehe je Anpassung (Euro oder Prozent, je nach mv_erhoehung_art)', mv_rhythmus_jahre: 'Abstand der Anpassungen in Jahren',
      mv_stufen_offen: 'Zahl der noch offenen Staffelstufen', mv_befristet_bis: 'Zeitmietvertrag befristet bis (JJJJ-MM-TT)',
      mv_kuendigungsverzicht_bis: 'Kuendigungsverzicht bis (JJJJ-MM-TT)', mv_abw_jahre: 'abweichende Laufzeit in Jahren',
      mv_in_mietentwicklung: 'true = Vertrag fliesst in die Mietentwicklung des Objekts ein', mv_notiz: 'Notiz zum Vertrag (Freitext)'
    },
    massnahme_eintrag: {
      id: 'Kennung der Massnahme im Katalog (Gewerk)', t: 'Bezeichnung', k: 'Kosten in Euro',
      bewohnt: 'true = im bewohnten Zustand, Umlage nach § 559 BGB moeglich', erh: 'davon Erhaltungsanteil in Prozent (nicht umlagefaehig)'
    },
    weitere: {
      haus_massnahmen: 'Massnahmen am gemeinsamen Eigentum, gleiche Felder wie massnahme_eintrag',
      aufteilungskosten: 'Kosten der Aufteilung nach WEG in Euro'
    }
  },
  _potenzial: {
    was: 'Ertragswert je Stufe (Bestand, Mieterhoehung § 558 BGB, Neuvermietung, Zielbild) - das letzte Ergebnis aus der App, nicht neu gerechnet',
    felder: {
      stand: 'Zeitpunkt der Rechnung', hash: 'Pruefwert der Eingaben - weicht er ab, sind die Daten seitdem geaendert',
      ags: 'Gemeindeschluessel', plz: 'Postleitzahl',
      ergebnis: 'volle Antwort des Rechenkerns (Stufen, Rechenweg, Herkunft je Parameter, Kappung, Neuvermietung)',
      zusammenfassung: 'Kurzfassung: Werte je Stufe, Kappungsgrenze, Kennzeichnung'
    },
    hinweis: 'Live neu rechnen: POST /api/v1/marktbericht/potenzial'
  },
  _tax_overrides: {
    was: 'Steuer-Jahreswerte der Anlage V, die vom Vorschlag der App abweichen (von Hand oder aus Belegen)',
    form: '{ "y2026": { "fahrtkosten": 64, "hotel": 141.2, ... } } - Euro je Jahr',
    hinweis: 'Felder ohne Eintrag rechnet die App selbst (Schaetzung); siehe /api/v1/tax-records fuer die fertige Jahresrechnung'
  },
  _dok_eingang: {
    was: 'Eingang fuer Belege, Unterlagen, Rechnungen (JSON als Text)',
    felder: {
      verlauf: 'je Import: am, quelle, dokumente[{name,typ}], uebernommen[], nicht_gelesen[], aenderungen[{t,vor,nach,...}], zurueck',
      herkunft: 'je Steuerjahr und Feld: aus welcher Unterlage/welchem Beleg der Wert stammt (quelle, dok, am, betrag)',
      einheiten_aenderungen: 'Mietvertraege, die Einheiten zugeordnet wurden (am, einheit, quelle, vorher)'
    }
  },
  _marktdaten: {
    was: 'v3158 · abgerufene Marktdaten am Objekt, je Teil mit Stand (JJJJ-MM-TT): was beim letzten Rechnen galt',
    felder: {
      kappung: 'Kappungsgrenze § 558 Abs. 3 BGB: pct (15/20), Gebiet/Verordnung, gilt bis, eigene Angabe ja/nein, ags',
      mietpreisbremse: 'Mietpreisbremse § 556d BGB: gilt (true/false/null = bitte pruefen), bis, Verordnung, Link, ags',
      marktmiete: 'Marktmiete in Euro/m2: qm (angesetzt), mitte_qm, art (eigen | markt), herkunft',
      zensus: 'Zensus-2022-Werte zur Lage (Gemeinde/Gitter): Mieten, Leerstand, Baualter - wie im Abgleich der App'
    }
  },
  _dok_auswertung: {
    was: 'Auswertung der Unterlagen (WEG-Protokolle, Wirtschaftsplan, Teilungserklaerung ...): Dokumentliste, Risiken, Beschluesse',
    hinweis: 'Die Dateien selbst liegen nicht auf dem Server'
  },
  _ankauf: {
    was: 'Der eingefrorene Stand beim Nutzen-/Lastenwechsel - das SOLL. '
       + 'Der uebrige Datensatz ist der laufende Stand, das IST.',
    felder: {
      stichtag: 'Datum des Einfrierens (JJJJ-MM-TT)',
      kennzahlen_damals: 'die neun Kennzahlen zum Stichtag',
      daten: 'der vollstaendige Datensatz zum Stichtag (ohne Vorschaubild)'
    }
  },
  _kpis_: {
    was: 'Kennzahlen, gerechnet von den echten Kernen zu ihrer Zeit. '
       + 'Sie werden hier NICHT neu gerechnet - alte Daten mit heutigen Regeln '
       + 'zu messen waere eine andere Zahl.',
    einheiten: {
      _kpis_bmy: 'Bruttomietrendite in PROZENT',
      _kpis_nmy: 'Nettomietrendite in PROZENT',
      _kpis_dscr: 'Schuldendienstdeckung - ein VERHAELTNIS ohne Einheit',
      _kpis_ltv: 'Beleihungsauslauf in PROZENT',
      _kpis_cf_vs: 'Cashflow VOR Steuer pro JAHR in Euro',
      _kpis_cf_ns: 'Cashflow NACH Steuer pro JAHR in Euro',
      _kpis_bwk_y: 'Bewirtschaftungskosten pro JAHR in Euro'
    }
  },
  _rnd: {
    was: 'Das Ergebnis des RND-Wizards nach Anlage 2 ImmoWertV - der VORSCHLAG '
       + 'aus den Bauteilen, nicht die Eingabe des Nutzers.',
    nicht_verwechseln_mit: '`afa_rnd_jahre` im Reiter Steuer: dort steht, was der '
       + 'Nutzer angesetzt hat (etwa aus einem Gutachten). Weichen beide ab, '
       + 'ist das ein Befund und kein Fehler.',
    felder: {
      rnd_jahre: 'Restnutzungsdauer in Jahren',
      gnd_jahre: 'Gesamtnutzungsdauer in Jahren (Anlage 1)',
      alter_jahre: 'Alter zum Stichtag',
      punkte: 'Modernisierungspunkte nach Anlage 2',
      verfahren: 'welches Verfahren gerechnet wurde',
      afa_vorteil_eur: 'Barwertvorteil der kuerzeren AfA gegenueber dem Standardsatz',
      stand: 'Datum der Berechnung'
    }
  },
  marktbericht: {
    was: 'Steht NEBEN `daten`, nicht darin: die Marktberichte liegen in einer '
       + 'eigenen Datenbank (mb.market_reports) und werden ueber '
       + '`object_key = "dp:" + id` zugeordnet.',
    stand: 'der heutige Stand: Adresse, Objektart, Wohnflaeche, Baujahr, '
         + 'Marktwert, Deal-Score, Zahl der Berichte, Datum des letzten',
    verlauf: 'EIN EINTRAG JE BERICHT, nach Datum sortiert - daran liest man ab, '
           + 'ob der Marktwert ueber die Jahre gestiegen oder gefallen ist. '
           + 'Je Punkt: datum, bericht_id, marktwert_eur, marktwert_von/bis '
           + '(die Spanne), eur_pro_qm, wohnflaeche, baujahr.',
    hinweis: 'Fehlt der Block ganz, hat das Objekt keinen Marktbericht. Steht im '
           + 'Kopf `marktbericht_fehler`, war der Dienst nicht erreichbar - dann '
           + 'ist das Fehlen KEINE Aussage ueber die Objekte.'
  },
  _ds2_: {
    was: 'Investor Deal Score 2.0 - Score, Kategorien und ob er gerechnet wurde.'
  },
  _deal_won: {
    was: 'true = Objekt gewonnen. `_deal_won_at` traegt das Datum, '
       + '`_deal_lost` das Gegenstueck.'
  }
};

/**
 * Baut das Export-Paket fuer einen Nutzer.
 * @param {string} userId
 * @param {{ fotos?: boolean }} opt
 */
/* v2043c - aus der Feld-LISTE ein Nachschlagewerk machen: Schluessel
   ist die Feld-Id, Wert sind Beschriftung und Art. Die Reihenfolge
   geht getrennt mit, falls sie jemand braucht. */
function felderAlsLexikon(liste) {
  if (!Array.isArray(liste)) return liste || null;
  const aus = {};
  liste.forEach(function (f) {
    if (!f || !f.id) return;
    const e = {};
    Object.keys(f).forEach(function (n) { if (n !== 'id') e[n] = f[n]; });
    aus[f.id] = e;
  });
  return aus;
}

async function bauen(userId, opt) {
  opt = opt || {};
  const mitFotos = !!opt.fotos;

  const r = await query(
    `SELECT id, name, kuerzel, ort, seq_no, version, created_at, updated_at,
            data, ai_analysis, photos
       FROM objects
      WHERE user_id = $1
      ORDER BY seq_no NULLS LAST, created_at`,
    [userId]
  );

  const k = konstanten().daten || {};

  const objekte = r.rows.map((o) => {
    let daten = o.data;
    if (typeof daten === 'string') { try { daten = JSON.parse(daten); } catch (e) { daten = {}; } }
    daten = daten || {};

    /* Die Analyse wird AUFGELOEST mitgegeben, nicht als Zeichenkette:
       sonst muesste der Empfaenger sie selbst auseinandernehmen. */
    let analyse = null;
    if (o.ai_analysis) {
      try { analyse = JSON.parse(o.ai_analysis); }
      catch (e) { analyse = { _roh: String(o.ai_analysis).slice(0, 20000) }; }
    }

    let fotos = o.photos;
    if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
    const fotoZahl = Array.isArray(fotos) ? fotos.length : 0;

    /* `_thumb` ist ein base64-Vorschaubild im Datensatz - es blaeht die
       Datei auf und traegt nichts bei. Raus, und zwar sichtbar. */
    const schlank = {};
    Object.keys(daten).forEach((key) => {
      if (key === '_thumb') return;
      if (key === '_photos' && !mitFotos) return;
      schlank[key] = daten[key];
    });

    /* v2102: einmal je Objekt, nicht viermal */
    const _gr = grestFuer(daten.plz);
    const _ha = halterFuer(daten);                        /* v2103 */

    return {
      id: o.id,
      nummer: o.seq_no || null,
      name: o.name || null,
      kuerzel: o.kuerzel || null,
      ort: o.ort || null,
      version: o.version,
      angelegt_am: o.created_at,
      geaendert_am: o.updated_at,
      lageklasse: daten.lageklasse || null,
      /* ── v2102 · DAS BUNDESLAND UND DER AMTLICHE GREST-SATZ ──────────
       * Marcel am 11.10.2026: „Wir haben ja Bonitaetswerte und auch das
       * Bundesland wissen wir ja fuer jedes Objekt. Daher wissen wir auch,
       * wie das aussieht mit der Grunderwerbsteuersatz."
       *
       * Er hat recht, und es war schon alles da — nur nicht zusammen:
       *
       *   `plz`     steht am Objekt (21 von 23 belegt, gemessen)
       *   `gest_p`  steht am Objekt, ist aber die EINGABE des Nutzers
       *   die Saetze liegen seit `v1823` im gespiegelten
       *   `frontend-konstanten.json` (16 Laender, 84 PLZ-Bereiche)
       *
       * Der Export hat die Konstanten geladen (`konstanten()`) und die
       * GrESt-Daten darin nie benutzt. Jetzt leitet er sie ab.
       *
       * ZWEI FELDER, NICHT EINS — und das ist der Punkt:
       *   `gest_p`               was der Nutzer angesetzt hat
       *   `grest_satz_amtlich`   was das Land vorschreibt
       * Sie DUERFEN abweichen: wer einen Kaufpreisanteil fuer Inventar
       * herausrechnet, zahlt auf weniger Steuer. Eine zusammengelegte
       * Zahl haette diesen Unterschied verschluckt — dieselbe Lehre wie
       * bei den zwei RND-Spalten in `v2086`.
       *
       * `grest_herkunft` sagt, woher das Land kommt. Ohne das waere der
       * Satz eine Behauptung: sechzehn Laender haben sechs verschiedene
       * Saetze, und eine PLZ ohne Treffer ergibt KEIN Land, nicht das
       * naechstgelegene. */
      bundesland: _gr.kuerzel,
      bundesland_name: _gr.name,
      grest_satz_amtlich: _gr.satz,
      grest_herkunft: _gr.herkunft,
      /* ── v2103 · WEM GEHOERT DAS OBJEKT · N60.33 (4) ─────────────────
       * Der Schluessel, ohne den eine Mandanten-Liste nichts nuetzt.
       * `halter` stand 22× im Bestand und 0× im Export. Die Rechtsform
       * bleibt `null`, wo der Server sie nicht kennt - siehe
       * `halterFuer()` oben, Abschnitt „warum hier keine Steuersphaere
       * ausgerechnet wird". */
      halter: _ha.id,
      halter_seit: _ha.seit,
      halter_rechtsform: _ha.rechtsform,
      steuersphaere: _ha.steuersphaere,
      halter_herkunft: _ha.herkunft,
      gewonnen: daten._deal_won === true || daten._deal_won === 'true',
      verloren: daten._deal_lost === true || daten._deal_lost === 'true',
      ankauf_stand: (daten._ankauf && daten._ankauf.stichtag) ? daten._ankauf.stichtag : null,
      daten: schlank,
      analyse: analyse,
      fotos_anzahl: fotoZahl,
      fotos: mitFotos && Array.isArray(fotos) ? fotos : undefined
    };
  });

  let eigenes = null;
  try { eigenes = await projektwissen.zusatzFuer(userId); } catch (e) { eigenes = null; }

  /* v2047 - was NICHT an den Objekten haengt.

     Marcel hat danach gefragt, und die ehrliche Antwort war: nur zur
     Haelfte drin. Die Objekt-Analysen kommen aus `objects`, die
     PORTFOLIO-Analyse liegt in `user_settings` unter
     `portfolio_analyse` (v2012) - mein Export fragte nur die
     Objekttabelle und hat sie nie gesehen.

     Ein Export, der "alles" verspricht, muss wissen, wo alles liegt.

     `updated_at` geht mit: eine Portfolio-Beurteilung ohne Datum ist
     bei einem Bestand, der sich jeden Monat aendert, eine Falle -
     dieselbe, gegen die der Stempel an der Objekt-Analyse gebaut
     wurde. */
  let einstellungen = {};
  try {
    const e = await query(
      'SELECT schluessel, wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = ANY($2)',
      [userId, ['portfolio_analyse', 'lage_profil', 'datenraum']]
    );
    e.rows.forEach((r) => {
      let w = r.wert;
      if (typeof w === 'string') { try { w = JSON.parse(w); } catch (x) { /* bleibt Text */ } }
      einstellungen[r.schluessel] = { wert: w, stand: r.updated_at };
    });
  } catch (e) { einstellungen = {}; }

  /* Wie viele Objekte tragen wirklich eine Analyse? Eine Datei, in
     der zwanzig von zweiundzwanzig fehlen, sieht vollstaendig aus. */
  const mitAnalyse = objekte.filter((o) => o.analyse).length;

  /* ── v2069 · Marktberichte und ihr Verlauf ───────────────────────── */
  let mbObjekte = [], mbVerlauf = [], mbFehler = null;
  try {
    const [a, b] = await Promise.all([
      mbHolen('/objects', userId),
      mbHolen('/objects/history', userId)
    ]);
    if (a && a.fehler) mbFehler = a.fehler;
    else mbObjekte = (a && (a.objects || a)) || [];
    if (!mbFehler && b && b.fehler) mbFehler = b.fehler;
    else if (!(b && b.fehler)) mbVerlauf = (b && (b.history || b)) || [];
    if (!Array.isArray(mbObjekte)) mbObjekte = [];
    if (!Array.isArray(mbVerlauf)) mbVerlauf = [];
  } catch (e) { mbFehler = String(e && e.message || e).slice(0, 120); }

  /* Je Objekt zuordnen. Der Schluessel ist `dp:<objects.id>` - so legt
     der Marktbericht ihn seit v942 an. */
  if (mbObjekte.length || mbVerlauf.length) {
    const nachKey = {};
    mbObjekte.forEach((m) => { if (m && m.object_key) nachKey[m.object_key] = m; });
    const verlaufNachKey = {};
    mbVerlauf.forEach((v) => {
      if (!v || !v.object_key) return;
      (verlaufNachKey[v.object_key] = verlaufNachKey[v.object_key] || []).push(v);
    });
    objekte.forEach((o) => {
      const key = 'dp:' + o.id;
      const m = nachKey[key];
      const v = verlaufNachKey[key];
      if (!m && !v) return;
      o.marktbericht = {
        /* Der heutige Stand … */
        stand: m ? {
          adresse: m.address || null, objektart: m.property_type || null,
          wohnflaeche: m.living_area || null, baujahr: m.build_year || null,
          marktwert_eur: m.market_value || null, deal_score: m.deal_score || null,
          berichte: m.snapshots || null, zuletzt: m.created_at || null
        } : null,
        /* … und was ueber die Zeit daraus wurde. Genau danach hat Marcel
           gefragt: „ob das Objekt im Preis gestiegen ist". */
        verlauf: v ? v.slice()
          .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
          .map((x) => _verlaufPunkt(x)) : []
      };
    });
  }

  /* v3157 · Beleihungswert (BelWertV, indikativ) je Objekt mit Ertrags- oder Sachwert - aus derselben Rechnung
     wie im Cockpit (mb POST /beleihungswert, neuester Stand je Objekt). */
  let belwFehler = null;
  try {
    const refs = objekte.filter((o) => o.marktbericht && (o.marktbericht.verlauf || []).some((v) => v.ertragswert || v.sachwert)).map((o) => String(o.id)).slice(0, 60);
    if (refs.length) {
      const bw = await mbSenden('/beleihungswert', userId, { refs: refs });
      if (bw && bw.fehler) belwFehler = bw.fehler;
      else if (bw && bw.objekte) objekte.forEach((o) => {
        const e = bw.objekte[String(o.id)];
        if (!e || !o.marktbericht) return;
        o.marktbericht.beleihungswert = e.verfuegbar ? { eur: e.beleihungswert || null, basis: e.basis || null, bericht_id: e.bericht && e.bericht.report_id,
          stand: bw.stand, indikativ: true, hinweis: 'indikativer Beleihungswert-Check nach BelWertV, kein Gutachten' } : { verfuegbar: false, grund: e.grund || null };
        const pkt = (o.marktbericht.verlauf || []).filter((v) => e.bericht && v.bericht_id === e.bericht.report_id)[0];
        if (pkt && e.verfuegbar) pkt.beleihungswert_eur = e.beleihungswert || null;
      });
    }
  } catch (e) { belwFehler = String(e && e.message || e).slice(0, 120); }

  /* v3157 · Bauzinsen als Tabelle Zinsbindung × Beleihungsauslauf, mit Stand und Methode */
  let bauzins = null;
  try { const bz = require('./bauzinsService'); bauzins = bz.matrix(await bz.getBauzins()); }
  catch (e) { bauzins = { fehler: String(e && e.message || e).slice(0, 120) }; }

  return {
    dealpilot_export: 'portfolio',
    format_version: 1,
    /* v3157 · Marktdaten fuer alle Objekte gleich */
    markt: { bauzins: bauzins },
    beleihungswert_fehler: belwFehler || undefined,
    erzeugt_am: new Date().toISOString(),
    anzahl_objekte: objekte.length,
    /* v2047 - die Deckung gehoert in den Kopf, nicht ins Kleingedruckte. */
    objekte_mit_pilot_analyse: mitAnalyse,
    /* v2069 - und die des Marktberichts. Faellt der Dienst aus, steht
       der Grund hier, statt dass der Block stillschweigend fehlt. */
    objekte_mit_marktbericht: objekte.filter((o) => o.marktbericht).length,
    marktbericht_verlaufspunkte: objekte.reduce(
      (s, o) => s + ((o.marktbericht && o.marktbericht.verlauf) || []).length, 0),
    marktbericht_fehler: mbFehler || undefined,
    fotos_enthalten: mitFotos,
    /* ── Das Lexikon: was die Schluessel bedeuten ──────────────────
       Ohne diesen Block ist der Export eine Liste aus 280 Kuerzeln.
       Mit ihm kann ein Mensch - oder ein fremdes Programm - damit
       rechnen, ohne zu raten. */
    lexikon: {
      /* v2043c - als NACHSCHLAGEWERK, nicht als Liste.

         Gemessen: k.felder ist ein ARRAY - im Export kamen die
         Schluessel 0, 1, 2 an, und lexikon.felder.kp ging ins Leere.
         Damit war das Lexikon zwar vorhanden, aber nicht benutzbar:
         wer wissen will, was kp bedeutet, schlaegt unter kp nach
         und nicht unter 37.

         Ein Lexikon, das man nicht nachschlagen kann, ist ein
         Inhaltsverzeichnis. */
      felder: felderAlsLexikon(k.felder),
      felder_reihenfolge: Array.isArray(k.felder) ? k.felder.map(function (f) { return f.id; }) : null,
      objektarten: k.objektarten || null,
      etappen: k.etappen || null,
      /* v2066 - die Strukturen mit Unterstrich. `felder` oben kennt nur
         die 225 Formularfelder; `_mfh`, `_ankauf` und die `_kpis_*`
         stehen in KEINEM Formular und brauchen die Erklaerung am
         dringendsten. */
      strukturen: STRUKTUREN,
      score_stufen: SCORE_STUFEN,
      hinweise: HINWEISE
    },
    /* ── Das Wissen, das die Piloten benutzen ──────────────────────
       Einmal, nicht je Objekt: es gilt fuer alle. */
    wissen: {
      projekt: projektwissen.wissen(),
      eigenes: eigenes || null,
      /* v2047 - die Beurteilung des PORTFOLIO-Piloten, mit Stand.
         Sie entsteht im Cockpit und haengt an keinem Objekt. */
      portfolio_analyse: einstellungen.portfolio_analyse || null,
      /* worauf bei Lagen geachtet wird, und wo die Unterlagen liegen -
         beides Wissen ueber das Portfolio, beides war bisher draussen. */
      lage_profil: einstellungen.lage_profil || null,
      datenraum: einstellungen.datenraum || null
    },
    objekte: objekte
  };
}

/* v2102: `grestFuer` ist mitexportiert, damit die Ableitung EINZELN
   pruefbar ist. Eine Funktion, die nur im Gesamtlauf sichtbar ist, laesst
   sich nicht von "findet nichts" unterscheiden - dieselbe Lehre wie bei
   `deklariertAbsichtlich` in der Messkabine. */
module.exports = { bauen, SCORE_STUFEN, HINWEISE, grestFuer, halterFuer };
