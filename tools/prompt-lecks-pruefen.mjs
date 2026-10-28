#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * prompt-lecks-pruefen.mjs — v2139, erweitert in v2140 und v2140b
 *
 * KOMMT AN, WAS GESENDET WIRD?
 *
 * Marcel (N60.4): „Auf welche Daten wird zugegriffen und wo ist das
 * Wissen? Haben wir auf alles Zugriff oder koennen wir was besser
 * machen?"
 *
 * `v2009` fand vier Felder, die das Frontend seit Jahren mitschickte und
 * die `buildPrompt()` nie las. Am 12.10.2026 fanden sich SIEBEN weitere.
 * Beide Male war die Ursache dieselbe: ein Feld dazugeben kostet eine
 * Zeile in `ui.js`, ein Feld LESEN kostet eine zweite an einer anderen
 * Stelle - und niemand merkt, wenn die zweite fehlt.
 *
 *   > Ein Feld, das gesendet und nicht gelesen wird, verschwindet
 *   > lautlos. Der Prompt ist vollstaendig, die Antwort plausibel, und
 *   > die Angabe des Nutzers war umsonst.
 *
 * Der schlimmste gemessene Fall war nicht ein stummes Feld, sondern das
 * Gegenteil: der Block „MIETVERTRAEGE JE EINHEIT" erklaerte dem Modell
 * auf 16 Zeilen, wie es `vertragsart`, `naechste_anpassung`,
 * `letzte_erhoehung` und `befristet_bis` lesen soll - und die Werte
 * standen nirgends. Seine Bedingung prueft `e.vertragsart`, er erschien
 * also GENAU DANN, wenn die Daten vorlagen.
 *
 * ── WIE DIESER PRUEFER ARBEITET ──────────────────────────────────────
 *
 * Er ruft die ECHTE `buildPrompt()` aus `openaiService.js` mit einem
 * Auftrag, in dem JEDES Feld belegt ist - mit einem unverwechselbaren
 * Wert. Dann sucht er jeden dieser Werte im erzeugten Text.
 *
 * Nicht `grep` auf den Quelltext: ein `payload.zustand.bauteile` kann
 * gelesen und trotzdem nicht gedruckt werden (etwa in einer Bedingung,
 * die nie wahr wird). Nur der Text selbst beweist, dass es ankommt.
 *
 * Nicht erfundene Feldnamen: die Liste unten ist an `frontend/js/ui.js`
 * ausgelesen, Zeile fuer Zeile - siehe `QUELLE` je Eintrag.
 *
 * RC = 0, wenn jedes belegte Feld im Prompt vorkommt.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';

const WURZEL = process.cwd();
const require_ = createRequire(path.join(WURZEL, 'backend', 'src', 'x.js'));

/* ── Die Umgebung, VOR dem require ─────────────────────────────────────
   `config.js` laedt `dotenv`, und das liegt lokal nicht in
   `node_modules`. Ersetzt wird genau DAS - nicht `config` selbst:

   > Ein nachgebautes `config` ist eine Nachbildung, und ein Pruefer, der
   > gegen eine Nachbildung laeuft, misst seine eigene Annahme. Mit dem
   > Haken auf dem Lader kommt die ECHTE `config.js` zum Einsatz, und
   > nur die eine fehlende Abhaengigkeit wird gestellt.

   `require_.resolve('dotenv')` geht hier NICHT: was nicht installiert
   ist, laesst sich nicht aufloesen, und der Cache-Eintrag landete
   nirgends. Also der Haken auf `Module._load`.

   Er steht hier oben, VOR dem `require` von `openaiService`. Am
   12.10.2026 hat genau diese Reihenfolge in einem anderen Pruefer vier
   Punkte falsch GRUEN gemacht: der Ersatz kam nach dem `require`, wurde
   ignoriert, und die vorige Probe antwortete weiter. */
const ERSATZ = {
  dotenv: { config: function () { return { parsed: {} }; } }
};
const _echtesLoad = Module._load;
let ersetzt = 0;
Module._load = function (anfrage, eltern, istHaupt) {
  if (Object.prototype.hasOwnProperty.call(ERSATZ, anfrage)) {
    try { return _echtesLoad.apply(this, arguments); }
    catch (e) { ersetzt++; return ERSATZ[anfrage]; }
  }
  return _echtesLoad.apply(this, arguments);
};
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let openai;
try {
  openai = require_('./services/openaiService.js');
} catch (e) {
  console.error('Konnte openaiService nicht laden: ' + e.message);
  process.exit(2);
}
if (typeof openai.buildPrompt !== 'function') {
  console.error('buildPrompt() ist nicht exportiert.');
  process.exit(2);
}

/* ══ DER AUFTRAG — jedes Feld mit einem unverwechselbaren Wert ════════
 *
 * Die Werte sind so gewaehlt, dass sie im Prompt nicht zufaellig
 * entstehen koennen: fuenfstellige Zahlen mit ungewoehnlichen Ziffern,
 * Texte mit einem Praefix. Eine `4` als Zimmerzahl waere nutzlos - sie
 * steht in jedem zweiten Satz.
 *
 * Zahlen laufen durch `_z()` (`toLocaleString('de-DE')`, also mit
 * Tausenderpunkt) oder `_p()` (`toFixed(1)` mit Komma und ' %'). Der
 * Pruefer sucht deshalb die FORMATIERTE Form, nicht die rohe. */
const auftrag = {
  objekt: {
    str: 'Pruefstrasse', hnr: '9', plz: '32609', ort: 'Pruefort',
    /* v2157 · die vier Lage-Felder und die Lageklasse (N62.4) */
    lageklasse: 'PRUEF-B', bevoelkerung: 'PRUEF-WACHSEND', nachfrage: 'PRUEF-STARK',
    wertsteigerung: 'PRUEF-HOCH', entwicklung: 'PRUEF-BEGRENZT',
    objektart: 'mfh', wfl: 23456, baujahr: 1968, zimmer: 5,
    kaufpreis: 345678,
    einheiten: {
      anzahl: 2,
      /* v2139a: `flaeche_summe` ABSICHTLICH abweichend von `wfl`
         (23456) — so wird der neue Abgleich mitgeprueft. */
      flaeche_summe: 23400,
      aufgeteilt: true,
      gnd: 77,
      stand: '2026-10-12',
      /* Ein OBJEKT, so wie `mfh-einheiten.js` es fuehrt (Gewerk ->
         Stufe) — nicht ein String. Mein erster Auftrag schickte einen
         String, und genau daran fiel die Typfalle im Leser auf. */
      /* v2156: `_buildAIPayload()` uebersetzt die Rohcodes jetzt VOR dem
         Senden (ui.js, STUFE_ZU_OBJEKT). Der Auftrag traegt deshalb die
         uebersetzte Form — so, wie der echte Sender sie schickt. Die
         frueheren Werte („PRUEFSTUFE-4") waren erfunden und haetten den
         Rohcode-Befund nie gezeigt. */
      modernisierung: { dach: '< 5 Jahre', heizung: '10 - 20 Jahre' },
      je_einheit: [{
        nr: 1, wfl: 8123, miete: 91234, art: 'wohnen', status: 'vermietet',
        lage: 'PRUEFLAGE-EINS',
        /* v2156 · die neun Felder, die bis v2155 im Sender haengenblieben */
        soll_miete: 97531,
        mietvertrag_seit: '2018-03-01',
        kuendigungsverzicht_bis: '2029-06-30',
        erhoehung_art: 'PRUEF-STAFFEL',
        erhoehung_wert: 43,
        erhoehung_rhythmus_jahre: 2,
        stufen_offen: 3,
        massnahme: 'PRUEF-BAD-ERNEUERN',
        massnahme_kosten: 28456,
        /* Die sieben, die bis v2139 ungelesen mitreisten (ui.js:813-826) */
        etage: 'PRUEFETAGE', zimmer: 7,
        vertragsart: 'PRUEF-STAFFELMIETE',
        letzte_erhoehung: '2019-07-13',
        naechste_anpassung: '2027-04-19',
        befristet_bis: '2031-11-23',
        zustand: 'PRUEFZUSTAND-EINHEIT'
      }, {
        nr: 2, wfl: 8124, miete: 91235, art: 'gewerbe', status: 'leer',
        vertragsart: 'PRUEF-INDEXMIETE'
      }]
    }
  },
  kennzahlen: { bmy: 6.7, nmy: 5.3, cf_m: 234, dscr: 1.23, ltv: 67.8, em: 3.7, ekr: 8.4 },   /* v2832: em/ekr */
  finanzierung: { ek: 56789, d1: 234567, d1z: 3.9, d1t: 2.1 },

  /* ── STEUER: vier Angaben hatten bis v2139 keinen Leser ──────────── */
  steuer: {
    zve: 87654,                               /* QUELLE ui.js:895 */
    grenzsteuersatz_pct: 41.7,                /* ui.js:895 */
    afa_satz_pct: 2.7,                        /* ui.js:896 */
    afa_rnd_jahre: 43,                        /* ui.js:896 */
    gebaeudeanteil_pct: 73.9,                 /* ui.js:897 */
    afa_eigen_pct: 3.3,                       /* ui.js:897  — war stumm */
    sanierung: {                              /* ui.js:899-906 — war stumm */
      kosten_eur: 47119,
      betrag_ist: 'PRUEF-netto',
      steuerlich_angesetzt: true,
      verteilung_jahre: '4'
    },
    sonder_afa_7b: true,                      /* ui.js:908 — war stumm */
    erbbaurecht: { ja: true, erbbauzins_eur_jahr: 19876 },  /* ui.js:909-911 */
    /* v2166: Werbungskosten, Wende, Jahresverlauf */
    werbungskosten_jahr1: { schuldzinsen_eur: 13579, afa_eur: 8642, bewirtschaftung_steuerlich_eur: 2468, summe_eur: 24689, mieteinnahmen_eur: 21357 },
    wende: { erstes_jahr_steuerlich_positiv: 2034, steuerwirkung_bis_dahin_eur: -11223, steuerlast_danach_bis_jahr15_eur: 9988, gerechnet_ueber_jahre: 30 },
    verlauf: [{ jahr: 2027, miete_eur: 21357, zinsen_eur: 13579, afa_eur: 8642, bwk_steuerlich_eur: 2468, ergebnis_vuv_eur: -3332, steuer_eur: -1389, cashflow_nach_steuer_eur: 777 }]
  },

  bewirtschaftung: {
    hausgeld_umlagefaehig: 31234, hausgeld_nicht_umlagefaehig: 21345,
    grundsteuer: 1456, weg_ruecklage: 2567, eigene_ruecklage: 3678,
    mietausfall_pct: 1.9
  },

  /* ── MIETENTWICKLUNG: `umlagefaehig` hatte keinen Leser ──────────── */
  mietentwicklung: {
    herkunft: 'PRUEF-HERKUNFT', modus: 'einheiten',
    einheiten_gesamt: 2, einheiten_mit_plan: 2, einheiten_index: 1,
    soll_eur_qm: 11.7, schritte: 3, intervall_jahre: 2, schritt_pct: 4.3,
    mietspiegel_eur_qm: 9.8, leerstand_pct: 2.7,
    umlagefaehig: false                       /* ui.js:936 — war stumm */
  },

  /* v2139a: ebenfalls aus `ui.js:974-978` ausgelesen. */
  wohnung: {
    zimmer: 3, baeder: 2, etage: 'PRUEF-OG', etagen_gesamt: 4,
    garagen: 3, stellplaetze_aussen: 2, balkon_qm: 17, grundriss: 'PRUEF-GRUNDRISS'
  },

  boden: {
    bodenrichtwert_eur_qm: 219, grundstueck_qm: 9876,
    /* v2156: der Objekt-Zins ist mit ABSICHT anders als der des
       Berichts (2,56 %). So wird der Abweichungszweig im
       Wertermittlungsblock mitgeprueft — zwei Zahlen, die gleich heissen
       und verschieden sind, waren genau der Befund. */
    sachwertfaktor: 1.07, liegenschaftszins_pct: 3.40
  },

  /* v2139a: die Namen aus `ui.js:987-991` ausgelesen, nicht geraten. */
  halter: {
    name: 'PRUEF-HALTER-GMBH', seit: '2019-05-02', kaufdatum: '2019-04-11',
    wirtschaftlicher_uebergang: '2019-06-01', vermietungsstand: 'PRUEF-VOLL'
  },

  /* ── ZUSTAND: Bauteile und gerechnete RND hatten keinen Leser ────── */
  zustand: {
    ds2_zustand: 'PRUEF-GEPFLEGT',
    energieklasse: 'PRUEF-KLASSE-D',
    modernisierung: 'PRUEF-TEILMODERNISIERT',
    modernisierungspunkte: 13,
    bauteile: {                               /* ui.js:1031-1037 — war stumm */
      Dach: 'PRUEFJAHR-2011', Fenster: 'PRUEFJAHR-2013',
      Heizung: 'PRUEFJAHR-2017', Baeder: 'PRUEFJAHR-2009'
    },
    restnutzungsdauer_berechnet: {            /* ui.js:1053-1061 — war stumm */
      jahre: 51, gesamtnutzungsdauer: 79, alter_jahre: 58,
      verfahren: 'PRUEF-ANLAGE-2', stand: 'PRUEF-STAND-RND'
    }
  },

  /* ── ANKAUF: Kennzahlen von damals und das Datum ─────────────────── */
  ankauf: {
    stichtag: '2024-03-17',
    festgeschrieben_am: '2024-09-29',         /* ui.js:969 — war stumm */
    korrekturen: 2,
    kennzahlen_damals: 'PRUEF-KENNZAHLEN-DAMALS',   /* ui.js:967 — war stumm */
    abweichung: null                          /* GENAU der Fall: kein Vergleich */
  },

  /* ── v2985 · BESTAND: Anschlussfinanzierung und Exit (bestand-analyse.js payload()) ── */
  bestand: {
    darlehen: [{ name: 'PRUEF-DARLEHEN-1', zinsbindung_ende: '2031-04-01', monate_bis_ende: 53, restschuld_ende: 187654,
      rate_heute_m: 1234.56, fehlt: ['PRUEF-FEHLT-DARLEHEN'], hinweis: 'PRUEF-HINWEIS-AUSSETZUNG',
      anschluss: [{ zins_pct: 4.37, rate_m: 1111.11, mehr_m: -123.45, cf_m: 321.98, dscr: 1.43, label: 'PRUEF-MARKTZINS' }] }],
    cf_heute_m: 198.53, dscr_heute: 1.29,
    kaufdatum: '2019-06-14', steuerfrei_ab: '2029-06-14', monate_bis_steuerfrei: 31,
    marktwert: 456789, marktwert_stand: '2026-10-20', kaufpreis: 398765, gesamtinvestition: 431234,
    restschuld_heute: 276543, restschuld_jahr: 2026, netto_erloes_vor_steuer: 180246, wertzuwachs: 25555,
    beleihungsreserve_80: 88888, fehlt: ['PRUEF-FEHLT-EXIT']
  },

  /* ── v2140 · DAS INVESTMENTPROFIL ────────────────────────────────
     Sieben von 23 Schluesseln (ui.js:1197-1205). Die uebrigen sind
     Formular-Vorbelegungen und stehen schon als Objektwert im Auftrag -
     siehe die Vorrangregel in ui.js. */
  investor_profil: {
    min_dscr: 1.37,
    min_cashflow_vor_st: 173,
    max_ltv: 81,
    strategie: 'PRUEF-BUY-AND-HOLD',
    risikoneigung: 'PRUEF-KONSERVATIV',
    verkaeufer_druck: 'PRUEF-HOCH',
    marktlage: 'PRUEF-SEITWAERTS',
    /* v2140b: welche davon hat der Nutzer SELBST gesetzt? Hier drei von
       sieben - so wird die Kennzeichnung in BEIDEN Richtungen geprueft. */
    _selbst_gesetzt: ['min_dscr', 'max_ltv', 'strategie']
  },

  /* ── v2988 · Zielbild: Massnahmen im Zielbild getrennt von den Sanierungskosten der Investition ── */
  potenzial: {
    art: 'mfh', kennzeichnung: 'PRUEF-KENNZEICHNUNG', kappung: { pct: 20, text: 'PRUEF-KAPPUNG' },
    stufen: { bestand: { kaltmiete_monat: 3195, kaltmiete_jahr: 38340, kosten: 0, punkte_plus: 0, ertragswert: 425000, rnd: 32 },
              zielbild: { kaltmiete_monat: 3794, kaltmiete_jahr: 45528, kosten: 136543, punkte_plus: 1.1, ertragswert: 436000, rnd: 34.4 } },
    ertragswert_gerechnet: true,
    massnahmen_herkunft: { text: 'PRUEF-ZIELBILD-AUS-5-WOHNUNGEN', summe: 136543, n_wohnungen: 5, haus: 0,
      sanierungskosten_investition: 137321, unterschied: 'PRUEF-UNTERSCHIED' },
    miete_nach_modernisierung: { satz: 'PRUEF-MIETE-NACH-MODERNISIERUNG', weg: 'amtlich_nach_modernisierung', wirkt: false },
    sanierung_regel: 'PRUEF-SANIERUNG-REGEL',
    /* v3028 · Termine je Wohnung: verlangbar ab · wirksam ab (potenzial.js mhTermine) */
    wohnungen: [{ nr: '1', lage: 'EG', wfl: 60, ist: 500, soll: 560, soll_ab: 'PRUEF-VERLANGBAR-SOFORT-WIRKSAM-01/2027' },
                { nr: '2', lage: 'OG', wfl: 70, ist: 600, soll: 650, soll_ab: 'PRUEF-VERLANGBAR-03/2027-WIRKSAM-06/2027' }]
  },
  /* ── v3026 · Indexmiete (potenzial.js indexmieteDaten) ── */
  indexmiete: {
    zeile: 'PRUEF-INDEXMIETE-ZEILE', vpi_stand: { bis: '2026-09' }, annahme: 'PRUEF-INDEX-ANNAHME',
    wohnungen: [
      { nr: '3', lage: 'PRUEF-LAGE-IDX', ok: true, miete_heute: 800, basis: { monat: '2024-03', wert: 118.6, herkunft: 'letzte Erhöhung' },
        schritte: [{ jahr: 2026, wirksam_ab: '2026-12', erklaerung_bis: '2026-10', indexmonat: '2026-09', index: 126.6, annahme: false, miete_neu: 853.96, plus_monat: 53.96, plus_jahr: 647.52 },
                   { jahr: 2027, wirksam_ab: '2027-12', erklaerung_bis: '2027-10', indexmonat: '2027-09', index: 129.1, annahme: true, miete_neu: 870.82, plus_monat: 16.86, plus_jahr: 202.32 }] },
      { nr: '4', ok: false, fehlt: ['PRUEF-FEHLT-DATUM'] }
    ]
  },
  verhandlung: { inseriert_seit: '2026-01-13', tage_online: 263 },
  investor_score: { total: 71, rendite: 67, finanzierung: 73, risiko: 61, lage: 79 },
  dealscore: { total: 68 },
  herkunft: 'PRUEF-HERKUNFT-OBJEKT',

  /* ══ v2150 · DER MARKTBERICHT, SO WIE ai.js IHN BAUT ═════════════════
   *
   * Die Form ist NICHT erfunden: `_mbHistoryFor()` in
   * `backend/src/routes/ai.js:38` gibt `{ anzahl, aktuell, verlauf }`,
   * wobei `aktuell` die ganze Zeile aus `/objects/history` ist. Die
   * Feldnamen stehen in der SELECT-Liste von
   * `marktbericht/backend/src/routes/api.js:524` — `sachwert_eur`,
   * `ertragswert_eur`, `fuehrend`, `fuehrend_grund`, `fuehrend_quelle`.
   *
   * > Ein Pruefauftrag mit erfundenen Feldnamen misst nichts. Genau
   * > dieser Fehler hat beim Objekt-Mapper 46 Testwerte gekostet.
   *
   * Die Zahlen sind so gewaehlt, dass der Abstand Ertrags- zu Sachwert
   * ueber 25 % liegt (291.837 -> 367.419 = +25,9 %) — damit wird auch
   * der DEUTUNGS-Zweig mitgeprueft, nicht nur die Ausgabe der Zahlen.
   * Der Zeitabstand im Verlauf ist mit Absicht groesser als 30 Tage,
   * sonst greift der Riegel und die Entwicklungszeilen fallen weg. */
  marktbericht: {
    anzahl: 2,
    aktuell: {
      created_at: '2026-10-10T09:15:00.000Z',
      address: 'PRUEFADRESSE-BERICHT 9',
      market_value: 352000, market_value_low: 318000, market_value_high: 389000,
      median_sqm: 2714, confidence_pct: 71,
      micro_score: 63, macro_score: 58,
      gross_yield_pct: 6.4, rent_multiplier: 15.6, deal_score: 67,
      /* die Stufe-3-Felder, die bis v2149 niemand gelesen hat */
      sachwert_eur: 291837,
      ertragswert_eur: 367419,
      fuehrend: 'ertragswert',
      fuehrend_grund: 'PRUEFGRUND-RENDITEOBJEKT',
      fuehrend_quelle: 'PRUEFQUELLE-PARAGRAF-6',
      hat_crosscheck: true,
      /* ══ v2156 · DER ZINS, DER DEN ERTRAGSWERT ERZEUGT ═══════════════
         Die Feldnamen stammen aus der erweiterten SELECT-Liste von
         `/objects/history` (marktbericht api.js), nicht aus meinem Kopf:
         lzs_pct, lzs_stufe, lzs_zweig, lzs_berichtsjahr,
         lzs_aus_register, gnd_jahre, bwk_quote.
         Der Zins ist mit ABSICHT anders als der im Objekt (3,40 %) —
         so wird der Abweichungszweig mitgeprueft. */
      lzs_pct: 2.56,
      lzs_stufe: 'PRUEF-A',
      lzs_zweig: 'PRUEF-ZWEIG-WOHNEN',
      lzs_berichtsjahr: 2025,
      lzs_aus_register: true,
      gnd_jahre: 70,
      bwk_quote: 0.22,
      /* v2157 · die Lage, zweimal erhoben, und der Zensus. Mikrolage mit
         Absicht abweichend, damit die Abweichungsmarke mitgeprueft wird. */
      lage_bericht: { makrolage: 'PRUEF-MAKRO-GLEICH', mikrolage: 'PRUEF-MIKRO-BERICHT', nachfrage: 'PRUEF-NACHFRAGE-BERICHT' },
      lage_nutzer:  { makrolage: 'PRUEF-MAKRO-GLEICH', mikrolage: 'PRUEF-MIKRO-NUTZER' },
      bevoelkerung_trend_pct: 0.2976,
      zensus: { available: true, leerstandsquote: 3.7, eigentuemerquote: 51.2, nettokaltmiete_qm: 6.41, kreis_name: 'PRUEFKREIS',
        gemeinde: { name: 'PRUEFGEMEINDE', nettokaltmiete_qm: 5.87, leerstandsquote: 4.4, leerstandsquote_marktaktiv: 1.3,
          miete_baujahr: { klasse: 'PRUEF-BJ-KLASSE', wert: 5.11 }, miete_flaeche: null,
          leerstandsdauer: [{ text: 'PRUEF-DAUER', anteil_pct: 61.7 }] },
        kreis: { name: 'PRUEFKREIS', miete_flaeche: { klasse: 'PRUEF-FL-KLASSE', wert: 4.22 } } },
      data: { rent: { median_sqm: 7.31 } }
    },
    verlauf: [
      { datum: '2026-06-02T08:00:00.000Z', marktwert: 338000, deal_score: 61,
        sachwert: 280111, ertragswert: 349222, fuehrend: 'ertragswert' },
      { datum: '2026-10-10T09:15:00.000Z', marktwert: 352000, deal_score: 67,
        sachwert: 291837, ertragswert: 367419, fuehrend: 'ertragswert' }
    ]
  }
};

/* ══ DIE ERWARTUNGEN ═════════════════════════════════════════════════
 * Je Eintrag: wo das Feld herkommt, und welcher Text im Prompt stehen
 * MUSS. `_z()` setzt Tausenderpunkte, `_p()` Komma und ' %'. */
const z = (n) => Math.round(n).toLocaleString('de-DE');
const p = (n) => n.toFixed(1).replace('.', ',') + ' %';

const ERWARTET = [
  /* ── die vier aus v2009, als Rueckfallprobe ───────────────────────── */
  ['verhandlung.tage_online', 'ui.js:1128', '263'],
  ['investor_score.rendite', 'ui.js:1183', '67'],

  /* ── die sieben Einheitenfelder (v2139) ───────────────────────────── */
  ['einheit.etage', 'ui.js:813', 'PRUEFETAGE'],
  ['einheit.zimmer', 'ui.js:814', '7 Zi.'],
  ['einheit.vertragsart', 'ui.js:815', 'PRUEF-STAFFELMIETE'],
  ['einheit.vertragsart (zweite)', 'ui.js:815', 'PRUEF-INDEXMIETE'],
  ['einheit.letzte_erhoehung', 'ui.js:816', '2019-07-13'],
  ['einheit.naechste_anpassung', 'ui.js:817', '2027-04-19'],
  ['einheit.befristet_bis', 'ui.js:818', '2031-11-23'],
  ['einheit.zustand', 'ui.js:825', 'PRUEFZUSTAND-EINHEIT'],

  /* ── Steuer (v2139) ───────────────────────────────────────────────── */
  ['steuer.afa_eigen_pct', 'ui.js:897', p(3.3)],
  ['steuer.sanierung.kosten_eur', 'ui.js:901', z(47119)],
  ['steuer.sanierung.betrag_ist', 'ui.js:902', 'PRUEF-netto'],
  ['steuer.sanierung.verteilung_jahre', 'ui.js:904', '4 Jahre'],
  ['steuer.sonder_afa_7b', 'ui.js:908', '§ 7b'],
  ['steuer.erbbaurecht.erbbauzins', 'ui.js:910', z(19876)],

  /* ── Mietentwicklung (v2139) ──────────────────────────────────────── */
  ['mietentwicklung.umlagefaehig', 'ui.js:936', 'Kaltmiete'],

  /* ── Zustand (v2139) ──────────────────────────────────────────────── */
  ['zustand.bauteile Dach', 'ui.js:1031', 'PRUEFJAHR-2011'],
  ['zustand.bauteile Heizung', 'ui.js:1032', 'PRUEFJAHR-2017'],
  ['zustand.rnd.jahre', 'ui.js:1055', '51 Jahre'],
  ['zustand.rnd.gesamtnutzungsdauer', 'ui.js:1056', 'von 79'],
  ['zustand.rnd.verfahren', 'ui.js:1057', 'PRUEF-ANLAGE-2'],

  /* ── Ankauf (v2139) ───────────────────────────────────────────────── */
  ['ankauf.kennzahlen_damals', 'ui.js:967', 'PRUEF-KENNZAHLEN-DAMALS'],
  ['ankauf.festgeschrieben_am', 'ui.js:969', '2024-09-29'],

  /* ── v2985 · Bestand: Anschlussfinanzierung und Exit ─────────────── */
  ['bestand.darlehen.name', 'bestand-analyse.js payload()', 'PRUEF-DARLEHEN-1'],
  ['bestand.darlehen.zinsbindung_ende', 'bestand-analyse.js payload()', '2031-04-01'],
  ['bestand.darlehen.monate_bis_ende', 'bestand-analyse.js payload()', 'in 53 Monaten'],
  ['bestand.darlehen.restschuld_ende', 'bestand-analyse.js payload()', z(187654)],
  ['bestand.darlehen.rate_heute_m', 'bestand-analyse.js payload()', z(1234.56) + ' €/Monat'],
  ['bestand.darlehen.fehlt', 'bestand-analyse.js payload()', 'PRUEF-FEHLT-DARLEHEN'],
  ['bestand.darlehen.hinweis', 'bestand-analyse.js payload()', 'PRUEF-HINWEIS-AUSSETZUNG'],
  ['bestand.anschluss.zins_pct', 'bestand-analyse.js payload()', '4,37 %'],
  ['bestand.anschluss.label', 'bestand-analyse.js payload()', 'PRUEF-MARKTZINS'],
  ['bestand.anschluss.rate_m', 'bestand-analyse.js payload()', 'Rate ' + z(1111.11)],
  ['bestand.anschluss.mehr_m', 'bestand-analyse.js payload()', '-123 €'],
  ['bestand.anschluss.cf_m', 'bestand-analyse.js payload()', z(321.98) + ' €/Monat, DSCR'],
  ['bestand.anschluss.dscr', 'bestand-analyse.js payload()', 'DSCR 1,43'],
  ['bestand.cf_heute_m', 'bestand-analyse.js payload()', z(198.53) + ' €/Monat, DSCR 1,29'],
  ['bestand.kaufdatum', 'bestand-analyse.js payload()', '2019-06-14'],
  ['bestand.steuerfrei_ab', 'bestand-analyse.js payload()', '2029-06-14'],
  ['bestand.monate_bis_steuerfrei', 'bestand-analyse.js payload()', 'noch 31 Monate'],
  ['bestand.marktwert', 'bestand-analyse.js payload()', z(456789)],
  ['bestand.marktwert_stand', 'bestand-analyse.js payload()', 'vom 2026-10-20'],
  ['bestand.kaufpreis', 'bestand-analyse.js payload()', z(398765)],
  ['bestand.gesamtinvestition', 'bestand-analyse.js payload()', z(431234)],
  ['bestand.wertzuwachs', 'bestand-analyse.js payload()', z(25555)],
  ['bestand.restschuld_heute', 'bestand-analyse.js payload()', z(276543)],
  ['bestand.restschuld_jahr', 'bestand-analyse.js payload()', 'Ende 2026'],
  ['bestand.netto_erloes_vor_steuer', 'bestand-analyse.js payload()', z(180246)],
  ['bestand.beleihungsreserve_80', 'bestand-analyse.js payload()', z(88888)],
  ['bestand.fehlt', 'bestand-analyse.js payload()', 'PRUEF-FEHLT-EXIT'],
  ['bestand: Antwortfeld exit_strategien', 'v2985', '"exit_strategien"'],
  ['bestand: Q&A-Form anschlussfinanzierung', 'v2985', '"anschlussfinanzierung": [{ "frage"'],

  /* ── v2988 · Zielbild-Massnahmen und Sanierungskosten getrennt ─────── */
  ['potenzial.massnahmen_herkunft.text', 'potenzial.js zusammenfassung()', 'PRUEF-ZIELBILD-AUS-5-WOHNUNGEN'],
  ['potenzial.massnahmen_herkunft.summe', 'potenzial.js zusammenfassung()', 'Summe ' + z(136543)],
  ['potenzial.massnahmen_herkunft.sanierungskosten_investition', 'potenzial.js zusammenfassung()', 'eigene Angabe): ' + z(137321)],
  ['potenzial: Spaltenname Massnahmen im Zielbild', 'v2988', 'Massnahmen im Zielbild (Kosten)'],
  ['potenzial.miete_nach_modernisierung.satz', 'potenzial.js zusammenfassung()', 'PRUEF-MIETE-NACH-MODERNISIERUNG'],
  ['potenzial.sanierung_regel', 'potenzial.js zusammenfassung()', 'PRUEF-SANIERUNG-REGEL'],
  /* ── v3028 · Mieterhöhung: verlangbar ab und wirksam ab getrennt ─ */
  ['potenzial.wohnungen[0].soll_ab', 'potenzial.js zusammenfassung()', 'PRUEF-VERLANGBAR-SOFORT-WIRKSAM-01/2027'],
  ['potenzial.wohnungen[1].soll_ab', 'potenzial.js zusammenfassung()', 'PRUEF-VERLANGBAR-03/2027-WIRKSAM-06/2027'],
  ['potenzial: Spalte verlangbar/wirksam', 'v3028', 'Soll/Monat (verlangbar ab · wirksam ab)'],
  ['potenzial: Regel sofort nur fuers Verlangen', 'v3028', 'Das Wort "sofort" nur fuer das Verlangen'],
  ['potenzial: Regel Jahr ab wirksam', 'v3028', 'zaehlt nur ab "wirksam ab"'],
  /* ── v3026 · Indexmiete ─ */
  ['indexmiete.zeile', 'potenzial.js indexmieteDaten()', 'PRUEF-INDEXMIETE-ZEILE'],
  ['indexmiete.annahme', 'potenzial.js indexmieteDaten()', 'PRUEF-INDEX-ANNAHME'],
  ['indexmiete.wohnungen[0].lage', 'potenzial.js indexmieteDaten()', 'PRUEF-LAGE-IDX'],
  ['indexmiete.schritte[0].miete_neu', 'potenzial.js indexmieteDaten()', '853,96 EUR'],
  ['indexmiete.schritte[1] Annahme gekennzeichnet', 'v3026', '(09/2027, ANNAHME)'],
  ['indexmiete.wohnungen[1].fehlt', 'potenzial.js indexmieteDaten()', 'PRUEF-FEHLT-DATUM'],
  ['indexmiete: Anweisung zitieren statt rechnen', 'v3026', 'Rechne diese Zahlen NICHT selbst nach'],

  /* ── die, die vorher schon ankamen: Gegenprobe gegen einen Rueckbau ─ */
  ['steuer.zve', 'ui.js:895', z(87654)],
  ['bewirtschaftung.weg_ruecklage', 'ui.js:917', z(2567)],
  ['boden.bodenrichtwert_eur_qm', 'ui.js:980', '219'],
  /* ⚠ ZURUECKGENOMMEN (v2139a) — hier standen vier Erwartungen, und
     ZWEI davon waren MEIN Fehler, nicht der des Codes:

       ['halter.halter',      'PRUEF-HALTER-GMBH']
       ['wohnung.stellplatz', 'PRUEF-TG']

     Das Feld heisst `halter.name` (ui.js:988), nicht `halter.halter`;
     und Stellplaetze stehen als `garagen` und `stellplaetze_aussen`
     (ui.js:976), ein Feld `stellplatz` gibt es nicht. Beide werden
     gelesen - `openaiService.js:481-486` und `:463-469`.

     > Ein Pruefer, der einen Feldnamen erfindet, meldet ein Leck, das
     > es nicht gibt - und schickt den naechsten Leser in die falsche
     > Datei. Die Namen unten sind jetzt an `ui.js` ausgelesen.

     Die dritte Erwartung war ebenfalls meine: `modernisierung` ist ein
     OBJEKT (Gewerk -> Stufe), kein String. Dass der Leser einen String
     trotzdem annimmt und in Buchstaben zerlegt, ist der eigentliche
     Fund - abgesichert in v2139a.

     Nur `einheiten.stand` war ein echtes Leck. */
  ['halter.name', 'ui.js:988', 'PRUEF-HALTER-GMBH'],
  ['wohnung.garagen', 'ui.js:976', '3'],
  ['objekt.einheiten.stand', 'ui.js:837', '2026-10-12'],
  /* v2156: hier stand `Dach=PRUEFSTUFE-4` — ein erfundener Stufenwert.
     Er hat zwar bewiesen, dass das FELD ankommt, aber nie gezeigt, dass
     dort ein unverstaendlicher ROHCODE stand (`dach=v`). Ein erfundener
     Testwert prueft die Leitung und nicht den Inhalt. Die Erwartung
     steht jetzt unter „Stufen: Klartext statt Code" mit dem echten
     uebersetzten Wert. */
  ['objekt.einheiten.modernisierung', 'ui.js:838', 'dach=< 5 Jahre'],
  ['objekt.einheiten.flaeche_summe', 'ui.js:788', 'ABWEICHUNG Flaeche'],

  /* ── v2140 · das Investmentprofil ──────────────────────────────── */
  ['profil.min_dscr', 'ui.js:1198', '1,37'],
  ['profil.min_cashflow', 'ui.js:1199', '173 EUR/Monat vor Steuer'],
  ['profil.max_ltv', 'ui.js:1200', '81,0 %'],
  ['profil.strategie', 'ui.js:1201', 'PRUEF-BUY-AND-HOLD'],
  ['profil.risikoneigung', 'ui.js:1202', 'PRUEF-KONSERVATIV'],
  ['profil.verkaeufer_druck', 'ui.js:1203', 'PRUEF-HOCH'],
  ['profil.marktlage', 'ui.js:1204', 'PRUEF-SEITWAERTS'],
  /* Die ORDNUNG ist der eigentliche Inhalt des Blocks: ohne sie stehen
     zwei Schwellen zur selben Groesse im Prompt und das Modell waehlt. */
  ['profil: Score bleibt unberuehrt', 'v2140', 'Rechne keinen'],
  ['profil: beide Zahlen nennen', 'v2140', 'Mische sie nicht'],
  ['profil: Aufgabe 5 verweist darauf', 'v2140', 'DIESER INVESTOR'],

  /* ── v2140b · Vorgabe oder Entscheidung? ────────────────────────────
     Im Browser gemessen: `get()` gibt immer einen Wert, notfalls die
     Vorgabe aus `config.js`. Ein Block "Einstellungen des Nutzers"
     behauptet dann eine Entscheidung, die niemand getroffen hat. */
  ['kennzeichnung: selbst gesetzt', 'v2140b', '1,37  (selbst gesetzt)'],
  ['kennzeichnung: Vorgabe', 'v2140b', 'vor Steuer  (Vorgabe, nicht gesetzt)'],
  ['kennzeichnung: Strategie gesetzt', 'v2140b', 'PRUEF-BUY-AND-HOLD  (selbst gesetzt)'],
  ['kennzeichnung: Marktlage Vorgabe', 'v2140b', 'PRUEF-SEITWAERTS  (Vorgabe, nicht gesetzt)'],
  ['Ordnung: Vorgabe ist keine Aussage', 'v2140b', 'KEINE Aussage des Nutzers'],

  /* ══ v2150 · DIE STUFE-3-WERTE DES MARKTBERICHTS ═════════════════════
     Marcel am 12.10.2026: „auch wenn Stufe 3 gerechnet wurde sollte auf
     jedenfall auch der Verkehrswert mit einfliessen und die
     Gesamtbewertung einfliessen."

     GEMESSEN: `/objects/history` liefert `sachwert_eur`,
     `ertragswert_eur`, `fuehrend` + Grund + Quelle seit v1963/v1965.
     `buildPrompt()` las davon kein einziges Feld — es endete beim
     Deal-Score. Die Werte reisten bis in den Prompt-Bauer und wurden
     dort fallen gelassen. */
  ['Stufe 3: Sachwert',            'v2150', '291.837'],
  ['Stufe 3: Ertragswert',         'v2150', '367.419'],
  ['Stufe 3: Abstand gerechnet',   'v2150', '+25,9 %'],
  ['Stufe 3: Abstand gedeutet',    'v2150', 'WEIT auseinander'],
  ['Stufe 3: fuehrendes Verfahren', 'v2150', 'Ertragswertverfahren'],
  ['Stufe 3: Grund der Wahl',      'v2150', 'PRUEFGRUND-RENDITEOBJEKT'],
  ['Stufe 3: Rechtsgrundlage',     'v2150', 'PRUEFQUELLE-PARAGRAF-6'],
  ['Stufe 3: der tragende Wert',   'v2150', 'Der TRAGENDE Wert'],
  /* Die EINORDNUNG ist kein Beiwerk: ohne sie wird aus einem
     Quercheck ein Verkehrswert. Sie wird genauso geprueft wie die Zahl. */
  ['Stufe 3: kein Gutachten',      'v2150', 'KEIN Gutachten nach Paragraf 194 BauGB'],
  ['Stufe 3: nie "Verkehrswert"',  'v2150', 'nie als "Verkehrswert"'],
  /* Entwicklung ueber mehrere Berichte (Marcels „aussagen ueber die
     entwicklung treffen") */
  ['Verlauf: Verfahrenswerte',     'v2150', 'Entwicklung der Verfahrenswerte ueber 2 Berichte'],
  ['Verlauf: aelterer Sachwert',   'v2150', '280.111'],
  /* Der Recherche-Auftrag muss den Bericht kennen */
  ['Recherche: Bericht hat Vorrang', 'v2150', 'LIEGT EIN MARKTBERICHT VOR'],
  ['Recherche: nie ohne Hinweis',  'v2150', 'NIE eine recherchierte Zahl ohne Hinweis'],
  /* Aufgabe 14 und ihr Zielfeld — ohne Feld faellt die Arbeit auf den
     Boden, das ist die Lehre aus v2139 */
  ['Aufgabe 14 steht da',          'v2150', '14. Abgleich mit dem Marktbericht'],
  ['Zielfeld berichts_abgleich',   'v2150', '"berichts_abgleich"'],
  ['Zielfeld mietspiegel_herkunft', 'v2150', '"mietspiegel_herkunft"'],
  ['Mietspiegel: Bericht zuerst',  'v2150', 'VORRANG: der Wert aus dem DealPilot-Marktbericht'],

  /* ══ v2156 · ALLES MUSS EINFLIESSEN (N62.3) ══════════════════════════
     Marcel am 12.10.2026: „ob generell alle Daten, also auch aus den
     Mehrfamilienhaeusern, aus dem Konfigurator … auch Finanzierung und
     Liegenschaftszinsen und Wertgutachten, dass auch wirklich alles
     damit einfliesst."

     GEMESSEN vorher: von 36 Feldern je Einheit reisten 13 mit, die
     Modernisierungsstufen kamen als ROHCODES (`dach=v`), und der
     Liegenschaftszins stand ohne Auftrag und fehlte im
     Wertermittlungsblock ganz. */
  ['MFH: Soll-Kaltmiete',          'v2156', 'Soll-Kaltmiete 97531'],
  ['MFH: Vertrag seit',            'v2156', 'Vertrag seit 2018-03-01'],
  ['MFH: Kuendigungsverzicht',     'v2156', 'KUENDIGUNGSVERZICHT bis 2029-06-30'],
  ['MFH: Erhoehungsart',           'v2156', 'Erhoehung: PRUEF-STAFFEL'],
  ['MFH: Erhoehungswert',          'v2156', '(43)'],
  ['MFH: Rhythmus',                'v2156', 'alle 2 Jahre'],
  ['MFH: offene Stufen',           'v2156', '3 Stufe(n) offen'],
  ['MFH: Massnahme',               'v2156', 'MASSNAHME: PRUEF-BAD-ERNEUERN'],
  ['MFH: Massnahmekosten',         'v2156', '28.456'],
  /* Die Rohcodes: VORHER stand im Prompt `dach=v`. Jetzt der Klartext —
     und der Rohcode darf NICHT mehr vorkommen. */
  ['Stufen: Klartext statt Code',  'v2156', 'dach=< 5 Jahre'],
  ['Stufen: zweites Gewerk',       'v2156', 'heizung=10 - 20 Jahre'],
  /* Liegenschaftszins: Auftrag am Objektfeld */
  ['LZS: Auftrag am Objektfeld',   'v2156', 'AUFTRAG zum Liegenschaftszins'],
  ['LZS: der Hebel genannt',       'v2156', 'um gut ein\n  Fuenftel'],
  /* Liegenschaftszins: im Wertermittlungsblock, mit Herkunft */
  ['LZS: im Wertermittlungsblock', 'v2156', 'Liegenschaftszinssatz der Rechnung: 2,56 %'],
  ['LZS: Stufe als Herkunft',      'v2156', 'Stufe PRUEF-A'],
  ['LZS: Zweig',                   'v2156', 'PRUEF-ZWEIG-WOHNEN'],
  ['LZS: Jahrgang',                'v2156', 'Jahrgang 2025'],
  ['LZS: aus dem Register',        'v2156', 'aus dem amtlichen Register'],
  ['LZS: Abweichung gemeldet',     'v2156', 'ABWEICHUNG: im Objekt ist 3,40 %'],
  ['GND der Rechnung',             'v2156', 'Gesamtnutzungsdauer der Rechnung: 70 Jahre'],
  ['BWK-Quote der Rechnung',       'v2156', 'Bewirtschaftungskostenquote der Rechnung: 22,0 %'],
  /* Staerken und Risiken: echte Vorgabe je Eintrag */
  ['Staerken: Satzvorgabe',        'v2156', 'je Eintrag 3-4 Sätze MIT der Zahl'],
  ['Risiken: Folge verlangt',      'v2156', 'mit der Folge für den Investor'],
  /* v2157 · N62.4 */
  ['objekt.lageklasse',            'ui.js v2157', 'PRUEF-B-Lage'],
  ['objekt.bevoelkerung',          'ui.js v2157', 'PRUEF-WACHSEND'],
  ['objekt.nachfrage',             'ui.js v2157', 'PRUEF-STARK'],
  ['objekt.wertsteigerung',        'ui.js v2157', 'PRUEF-HOCH'],
  ['objekt.entwicklung',           'ui.js v2157', 'PRUEF-BEGRENZT'],
  ['Lage: Bericht-Seite',          'v2157', 'Bericht PRUEF-NACHFRAGE-BERICHT'],
  ['Lage: Abweichung markiert',    'v2157', 'Bericht PRUEF-MIKRO-BERICHT | Objektfeld PRUEF-MIKRO-NUTZER  <- WEICHT AB'],
  ['Lage: Gleichstand ohne Marke', 'v2157', 'Bericht PRUEF-MAKRO-GLEICH | Objektfeld PRUEF-MAKRO-GLEICH\n'],
  ['Bevoelkerungstrend',           'v2157', '+0,30 % pro Jahr'],
  ['Zensus: Leerstand',            'v2157', 'Leerstandsquote 3,7 %'],
  ['Zensus: Kreis + Stichtag',     'v2157', 'Stichtag 15.05.2022, KREIS PRUEFKREIS'],
  ['Zensus: Gemeinde',             'v2162', 'Gemeinde PRUEFGEMEINDE: Nettokaltmiete 5,87'],
  ['Zensus: Baujahr aus Gemeinde',  'v2162', 'PRUEF-BJ-KLASSE (Gemeinde): 5,11'],
  ['Zensus: Groesse aus Kreis',     'v2162', 'PRUEF-FL-KLASSE (Kreis): 4,22'],
  ['Zensus: Leerstandsdauer',       'v2162', 'PRUEF-DAUER 61,7 %'],
  ['Zensus: Bestandsmiete-Hinweis', 'v2162', 'BESTANDSMIETE aller laufenden Vertraege'],
  ['Aufgabe 15 + Zielfeld',        'v2157', '"lage_gegenueberstellung": ['],
  ['Steuer: Werbungskosten Jahr 1', 'v2166', 'Werbungskosten gesamt 24.689 EUR = Schuldzinsen 13.579 + AfA 8.642'],
  ['Steuer: Jahr der Wende',        'v2166', 'DAUERHAFT positiv (davor koennen Gewinn- und Verlustjahre wechseln, siehe Jahresverlauf): 2034'],
  ['Steuer: Steuerlast danach',     'v2166', 'Steuerlast danach bis Jahr 15: 9.988 EUR'],
  ['Steuer: Jahresverlauf',         'v2166', '2027 | 21357 | 13579 | 8642 | 2468 | -3332 | -1389 | 777'],
  ['Aufgabe 16 Steuer',             'v2160', '16. Steuerliche Zusammenfassung'],
  ['Zielfeld steuer_zusammenfassung', 'v2160', '"steuer_zusammenfassung":'],
  ['Zielfeld soll_ist_steuer (Ankauf)', 'v2160', '"soll_ist_steuer":']
];

/* ══ LAUF ════════════════════════════════════════════════════════════ */
let prompt;
try {
  prompt = openai.buildPrompt(auftrag, {});
} catch (e) {
  console.error('buildPrompt() ist geworfen: ' + e.message);
  console.error(e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(2);
}

let rot = 0, gruen = 0;
console.log('=== Kommt an, was gesendet wird? ===');
console.log('    Prompt: ' + prompt.length + ' Zeichen, '
  + prompt.split('\n').length + ' Zeilen\n');

ERWARTET.forEach(function (e) {
  const feld = e[0], quelle = e[1], suche = e[2];
  const da = prompt.indexOf(suche) >= 0;
  if (da) { gruen++; } else { rot++; }
  console.log('  ' + (da ? 'ok  ' : 'ROT ') + feld.padEnd(38)
    + quelle.padEnd(14) + (da ? '' : 'nicht im Prompt: "' + suche + '"'));
});

/* ══ DIE GEGENPROBE: findet dieser Pruefer ein Leck ueberhaupt? ══════
 *
 * Ein Pruefer, der nur bestaetigt, ist kein Pruefer. Also wird ein Feld
 * ABSICHTLICH entfernt - kommt es dann noch im Prompt an, sucht der
 * Pruefer an der falschen Stelle (etwa einen Wert, der auch woanders
 * entsteht), und der gruene Punkt darueber war nichts wert.
 *
 * > Siehe die eigene Notiz: ein Pruefer muss seine DECKUNG nennen, und
 * > jeder Erkenner braucht eine Gegenprobe. */
console.log('\n=== Gegenprobe: erkennt der Pruefer ein Leck? ===');
const proben = [
  ['einheit.vertragsart', 'PRUEF-STAFFELMIETE', function (a) {
    a.objekt.einheiten.je_einheit.forEach(function (x) { delete x.vertragsart; }); }],
  ['zustand.bauteile', 'PRUEFJAHR-2011', function (a) { delete a.zustand.bauteile; }],
  ['steuer.sanierung', '47.119', function (a) { delete a.steuer.sanierung; }],
  ['ankauf.kennzahlen_damals', 'PRUEF-KENNZAHLEN-DAMALS', function (a) {
    delete a.ankauf.kennzahlen_damals; }],
  ['investor_profil', 'DIESER INVESTOR', function (a) { delete a.investor_profil; }],
  /* ══ v2150 · OHNE BERICHT DARF NICHTS DAVON STEHEN ═══════════════════
     Das ist die wichtigere Haelfte. Ein Auftrag „gleiche mit dem
     Marktbericht ab", wenn gar keiner vorliegt, erzeugt eine erfundene
     Antwort — und zwar eine, die wie eine gemessene aussieht.
     Jede der vier Proben nimmt den Bericht weg und prueft eine andere
     Stelle, die er eingefuegt hatte. */
  ['marktbericht: Sachwert',    '291.837',                      function (a) { delete a.marktbericht; }],
  ['marktbericht: Aufgabe 14',  '14. Abgleich mit dem Marktbericht', function (a) { delete a.marktbericht; }],
  ['marktbericht: Recherche-Vorrang', 'LIEGT EIN MARKTBERICHT VOR', function (a) { delete a.marktbericht; }],
  /* Und der Sonderfall, der zwischen „kein Bericht" und „Bericht ohne
     Stufe 3" liegt: ein Bericht, bei dem nur die Marktpreisindikation
     gerechnet wurde. Dann darf der Block ueberhaupt nicht erscheinen,
     obwohl der Bericht selbst da ist. */
  ['Bericht ohne Stufe 3',      'WERTERMITTLUNG IM BERICHT',    function (a) {
    delete a.marktbericht.aktuell.sachwert_eur;
    delete a.marktbericht.aktuell.ertragswert_eur;
    delete a.marktbericht.aktuell.fuehrend;
    delete a.marktbericht.aktuell.fuehrend_grund;
    a.marktbericht.verlauf.forEach(function (v) { delete v.sachwert; delete v.ertragswert; });
  }]
];

/* ── Die Typprobe (v2139a) ─────────────────────────────────────────────
   Ein String in `modernisierung` zerfiel bis v2139a in Einzelbuchstaben
   (`0=D, 1=a, ...`). Die Probe prueft, dass das NICHT mehr passiert -
   und dass der Text stattdessen als Text ankommt. */
const typProben = [
  ['modernisierung als String', function (a) {
      a.objekt.einheiten.modernisierung = 'Dach 2011, Heizung 2017'; },
    'Dach 2011, Heizung 2017', '0=D'],
  ['modernisierung als Array', function (a) {
      a.objekt.einheiten.modernisierung = ['Dach', 'Heizung']; },
    null, '0=Dach']
];
let blind = 0;
proben.forEach(function (pr) {
  const kopie = JSON.parse(JSON.stringify(auftrag));
  pr[2](kopie);
  let txt = '';
  try { txt = openai.buildPrompt(kopie, {}); } catch (e) { txt = 'FEHLER ' + e.message; }
  const weg = txt.indexOf(pr[1]) < 0;
  if (!weg) blind++;
  console.log('  ' + (weg ? 'ok  ' : 'ROT ') + 'ohne ' + pr[0].padEnd(30)
    + (weg ? 'verschwindet der Wert' : 'Wert ist TROTZDEM da — der Pruefer ist blind'));
});

console.log('\n=== Typproben: zerfaellt ein String in Buchstaben? ===');
let typRot = 0;
typProben.forEach(function (tp) {
  const kopie = JSON.parse(JSON.stringify(auftrag));
  tp[1](kopie);
  let txt = '';
  try { txt = openai.buildPrompt(kopie, {}); } catch (e) { txt = 'FEHLER ' + e.message; }
  const schlechtDa = txt.indexOf(tp[3]) >= 0;
  const gutDa = tp[2] == null ? true : txt.indexOf(tp[2]) >= 0;
  const ok = !schlechtDa && gutDa;
  if (!ok) typRot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + tp[0].padEnd(30)
    + (schlechtDa ? 'ZERFALLEN ("' + tp[3] + '" im Prompt)'
       : (gutDa ? 'sauber' : 'Text kommt NICHT an')));
});

/* ══ ALLES VORGABE: merkt der Prompt es? (v2140b) ════════════════════
 *
 * Der haeufigste Fall in der Praxis - gemessen an Marcels eigenem
 * Staging-Konto: EIN Schluessel im Speicher, sieben Werte aus `get()`.
 * Dann darf das Modell nicht gegen "seine" Schwellen urteilen. */
console.log('\n=== Alles Vorgabe: merkt der Prompt es? ===');
let vorgabeRot = 0;
(function () {
  const kopie = JSON.parse(JSON.stringify(auftrag));
  kopie.investor_profil._selbst_gesetzt = [];
  let txt = '';
  try { txt = openai.buildPrompt(kopie, {}); } catch (e) { txt = 'FEHLER ' + e.message; }
  const proben = [
    ['Block ist noch da', txt.indexOf('DIESER INVESTOR') >= 0],
    /* v2140b: NICHT nach '(selbst gesetzt)' im ganzen Prompt suchen -
       die ERKLAERUNG des Blocks zitiert den Ausdruck in
       Anfuehrungszeichen und loest dann falsch aus. Gesucht wird die
       markierte ZEILE: zwei Leerzeichen davor, kein Anfuehrungszeichen.

       > Ein Pruefer, der einen Ausdruck sucht, der auch in der Regel
       > ueber ihn vorkommt, misst die Regel statt die Daten. Vierter
       > Fall dieser Falle - siehe [[pruefer-findet-eigenes-zitat]]. */
    ['keine Zeile als gesetzt', !/[^"]\(selbst gesetzt\)/.test(txt)],
    ['der Hinweis steht da', txt.indexOf('KEINE dieser Angaben selbst gesetzt') >= 0],
    ['und nennt den Weg', txt.indexOf('Einstellungen -> Standardwerte') >= 0]
  ];
  proben.forEach(function (pr) {
    if (!pr[1]) vorgabeRot++;
    console.log('  ' + (pr[1] ? 'ok  ' : 'ROT ') + pr[0]);
  });
})();

/* ══ OHNE PROFIL: sagt der Prompt es, oder schweigt er? (v2140) ══════
 *
 * Ein fehlendes Profil darf nicht dazu fuehren, dass Aufgabe 5
 * stillschweigend nach fremdem Mass urteilt. Der Prompt muss sagen,
 * dass keins vorliegt - sonst sieht die Antwort genauso aus wie eine,
 * die das Profil kannte.
 *
 *   > Dasselbe Muster wie bei einer Regel ohne Daten, nur umgekehrt:
 *   > hier fehlen die Daten, und die Regel muss das AUSSPRECHEN. */
console.log('\n=== Ohne Profil: wird das gesagt? ===');
let ohneRot = 0;
(function () {
  const kopie = JSON.parse(JSON.stringify(auftrag));
  delete kopie.investor_profil;
  let txt = '';
  try { txt = openai.buildPrompt(kopie, {}); } catch (e) { txt = 'FEHLER ' + e.message; }
  const proben = [
    ['Block ist weg', txt.indexOf('DIESER INVESTOR') < 0],
    ['Aufgabe 5 sagt es', txt.indexOf('Investmentprofil liegt nicht vor') >= 0],
    ['und nennt den Ersatz', txt.indexOf('DealPilot-Schwellen') >= 0]
  ];
  proben.forEach(function (pr) {
    if (!pr[1]) ohneRot++;
    console.log('  ' + (pr[1] ? 'ok  ' : 'ROT ') + pr[0]);
  });
})();

/* ══ REGELN OHNE DATEN ═══════════════════════════════════════════════
 *
 * Der eigentliche Befund von v2139 war kein stummes Feld, sondern ein
 * Regelblock, der Felder erklaerte, die nicht im Prompt standen. Das
 * faellt mit der Pruefung oben nicht auf: der Block IST ja da.
 *
 * Also eine zweite Frage: nennt ein Block einen Feldnamen in
 * Anfuehrungszeichen, steht dann auch ein Wert dazu? */
console.log('\n=== Regeln ohne Daten ===');
const regelFelder = [
  ['"vertragsart"', 'PRUEF-STAFFELMIETE'],
  ['"naechste_anpassung"', '2027-04-19'],
  ['"letzte_erhoehung"', '2019-07-13'],
  ['"befristet_bis"', '2031-11-23']
];
let ohneDaten = 0;
regelFelder.forEach(function (r) {
  const regelDa = prompt.indexOf(r[0]) >= 0;
  const wertDa = prompt.indexOf(r[1]) >= 0;
  const ok = !regelDa || wertDa;
  if (!ok) ohneDaten++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + r[0].padEnd(24)
    + (regelDa ? 'Regel da' : 'keine Regel').padEnd(14)
    + (wertDa ? 'Wert da' : 'WERT FEHLT')
    + (ok ? '' : '   <- Regel ohne Daten'));
});

/* ══ v2500 · PILOT-MIETPREIS-ANALYSE (buildDs2Prompt) ════════════════
 * Die belegten Vergleichswerte (mietBelegeService.js) muessen im Prompt
 * ankommen, und die Regeln zu "vergleich_text"/"stuetzt_sich_auf" duerfen
 * NUR mit ihnen dastehen (Regel ohne Daten). Echte Funktion, unver-
 * wechselbare Werte, Gegenprobe ohne Belege. */
console.log('\n=== Pilot-Mietpreis-Analyse (buildDs2Prompt) ===');
let ds2Rot = 0;
if (typeof openai.buildDs2Prompt !== 'function') {
  console.log('  ROT buildDs2Prompt() ist nicht exportiert');
  ds2Rot++;
} else {
  const ds2Basis = {
    fields: ['ds2_marktmiete', 'ds2_mietausfall'],
    fieldSpecs: { ds2_marktmiete: { type: 'number', label: 'Marktmiete' }, ds2_mietausfall: { label: 'Mietausfall', values: ['niedrig', 'mittel'] } },
    context: { adresse: 'Pruefweg 1, 32609 Pruefstadt', ort: 'Pruefstadt', plz: '32609', wohnflaeche: 82, nettokaltmiete: 500 },
    mietbelege: {
      bericht: { datum: '2026-10-19', stufe: 3 },
      amtlich: { wert_qm: 4.37, quelle: 'PRUEF-GMB-2025' },
      markt: { wert_qm: 8.13, q25_qm: 7.17, q75_qm: 9.19, anzahl: 23, umkreis_km: 4.5, stand: '2026-10-19', trend_pct_pa: 2.7 },
      band: { unten_qm: 3.07, oben_qm: 11.93, lage: 'im' },
      ertrag: { wert_qm: 6.11, quelle: 'PRUEF-ERTRAGSMIETE' },
      ist_qm: 6.09,
      leerstand: { ebene: 'Gemeinde', name: 'PRUEF-GEMEINDE', marktaktiv_pct: 1.3, gesamt_pct: 3.9, dauerleer_anteil_pct: 61.7, anhalt: { wert: 'sehr_niedrig', wort: 'Sehr niedrig' } },
      bevoelkerung: { trend_pct_pa: 0.37, stand: 2025 },
      haushalte: { fehlt: true }, angebotsdauer_miete: { fehlt: true }
    }
  };
  let ds2Txt = '';
  try { ds2Txt = openai.buildDs2Prompt(JSON.parse(JSON.stringify(ds2Basis))); } catch (e) { ds2Txt = 'FEHLER ' + e.message; }
  [
    ['amtliche Vergleichsmiete', '4,37'], ['amtliche Quelle', 'PRUEF-GMB-2025'],
    ['Marktdurchschnitt Median', '8,13'], ['Marktdurchschnitt Q25', '7,17'], ['Marktdurchschnitt Anzahl', '23 Angebote'],
    ['Marktdurchschnitt Umkreis', '4,5 km'], ['Mietentwicklung', '2,7 %'],
    ['Band unten', '3,07'], ['Band oben', '11,93'], ['Ertragsmiete', 'PRUEF-ERTRAGSMIETE'], ['Ist-Miete', '6,09'],
    ['Zensus Gemeinde', 'PRUEF-GEMEINDE'], ['Zensus marktaktiv', '1,3 %'], ['Zensus gesamt', '3,9 %'], ['Zensus Dauerleerstand', '61,7 %'],
    ['Zensus Stichtag', '15.05.2022'], ['Bevoelkerung', '0,37 %'], ['Antwortfeld vergleich_text', '"vergleich_text"'],
    ['Antwortfeld stuetzt_sich_auf', '"stuetzt_sich_auf"'], ['Schluessel leerstand_zensus', '[leerstand_zensus]']
  ].forEach(function (p) {
    const ok = ds2Txt.indexOf(p[1]) >= 0;
    if (!ok) ds2Rot++;
    console.log('  ' + (ok ? 'ok  ' : 'ROT ') + p[0].padEnd(30) + p[1]);
  });
  /* Gegenprobe: ohne Belege duerfen weder Werte noch die Regeln dastehen */
  const ohne = JSON.parse(JSON.stringify(ds2Basis)); delete ohne.mietbelege;
  let ohneTxt = '';
  try { ohneTxt = openai.buildDs2Prompt(ohne); } catch (e) { ohneTxt = 'FEHLER ' + e.message; }
  [['Wert ohne Belege', '8,13'], ['Regel ohne Belege', '"stuetzt_sich_auf"'], ['Regel ohne Belege', '"vergleich_text"']].forEach(function (p) {
    const weg = ohneTxt.indexOf(p[1]) < 0 && ohneTxt.indexOf('FEHLER') !== 0;
    if (!weg) ds2Rot++;
    console.log('  ' + (weg ? 'ok  ' : 'ROT ') + ('Gegenprobe: ' + p[0]).padEnd(30) + p[1] + (weg ? ' verschwindet' : ' BLEIBT'));
  });
  /* fehlende Werte stehen ausdruecklich als fehlend da */
  const leer = JSON.parse(JSON.stringify(ds2Basis));
  leer.mietbelege.amtlich = { fehlt: true, grund: 'anderer_ausschuss' };
  leer.mietbelege.leerstand = { fehlt: true };
  let leerTxt = '';
  try { leerTxt = openai.buildDs2Prompt(leer); } catch (e) { leerTxt = 'FEHLER ' + e.message; }
  [['amtlich fehlt benannt', '[amtliche_vergleichsmiete] liegt NICHT vor'], ['Zensus fehlt benannt', '[leerstand_zensus] liegt NICHT vor']].forEach(function (p) {
    const ok = leerTxt.indexOf(p[1]) >= 0;
    if (!ok) ds2Rot++;
    console.log('  ' + (ok ? 'ok  ' : 'ROT ') + p[0].padEnd(30) + p[1]);
  });
}

/* ══ DECKUNG ═════════════════════════════════════════════════════════ */
const ui = fs.readFileSync(path.join(WURZEL, 'frontend', 'js', 'ui.js'), 'utf8');
const bauAnfang = ui.indexOf('function _buildAIPayload');
const bauEnde = ui.indexOf('\n  }', ui.indexOf('aiOptions', bauAnfang));
const bau = bauAnfang >= 0 ? ui.slice(bauAnfang, bauEnde > 0 ? bauEnde : bauAnfang + 60000) : '';

console.log('\n=== Deckung ===');
console.log('  Geprueft              : ' + ERWARTET.length + ' Felder, '
  + gruen + ' gruen, ' + rot + ' rot');
console.log('  Gegenproben           : ' + proben.length + ', davon blind: ' + blind);
console.log('  Regelbloecke          : ' + regelFelder.length + ', ohne Daten: ' + ohneDaten);
console.log('  Typproben             : ' + typProben.length + ', rot: ' + typRot);
console.log('  Ohne-Profil-Proben    : 3, rot: ' + ohneRot);
console.log('  Alles-Vorgabe-Proben  : 4, rot: ' + vorgabeRot);
console.log('  Mietpreis-Analyse     : 25 Stellen (20 Werte, 3 Gegenproben, 2 Fehlt-Proben), rot: ' + ds2Rot);
console.log('  buildPrompt           : die ECHTE Funktion aus openaiService.js');
console.log('  _buildAIPayload       : ' + (bau ? bau.split('\n').length + ' Zeilen gelesen'
  : 'NICHT GEFUNDEN — die Feldliste unten ist dann nicht abgeglichen'));

/* Wie viele Feldnamen sendet das Frontend ueberhaupt? Eine Zahl, die
   sagt, wie gross der ungeprueefte Rest ist - ein Pruefer, der seine
   Deckung nicht nennt, wird gruen und beweist nichts. */
const gesendet = new Set();
(bau.match(/^\s{4,}([a-z_][a-z0-9_]*)\s*:/gim) || []).forEach(function (m) {
  gesendet.add(m.trim().replace(/:$/, ''));
});
console.log('  Feldnamen im Sender   : ~' + gesendet.size
  + ' (geprueft werden ' + ERWARTET.length + ' Stellen gezielt, nicht alle)');

const rc = (rot > 0 || blind > 0 || ohneDaten > 0 || typRot > 0 || ohneRot > 0
  || vorgabeRot > 0 || ds2Rot > 0) ? 1 : 0;
console.log('\n' + (rc === 0
  ? 'SAUBER — jedes belegte Feld kommt im Prompt an.'
  : 'ROT — ' + rot + ' Feld(er) verschwinden, ' + blind + ' blinde Probe(n), '
    + ohneDaten + ' Regel(n) ohne Daten, ' + typRot + ' Typprobe(n) rot, '
    + (ohneRot + vorgabeRot) + ' Profil-Probe(n) rot, ' + ds2Rot + ' Mietpreis-Stelle(n) rot.'));
process.exit(rc);
