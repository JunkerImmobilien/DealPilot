// immowertv.js — Tabellen und Grundrechenarten der Wertermittlung nach ImmoWertV 2021.
//
// GRUNDSATZ: Zahlenwerte stehen HIER, nicht verstreut im Code. Jede Tabelle traegt
// eine Fassung (`fassung`) und ein Pruefkennzeichen (`geprueft`). Was nicht gegen den
// Verordnungstext geprueft ist, steht auf geprueft:false und wird im Ergebnis als
// ungeprueft ausgewiesen — lieber ein sichtbarer Hinweis als eine stille Falschzahl.
//
// Modellversionen: 'immowertv2021' ab Stichtag 01.01.2022, davor 'vor2022'.
// Ein Sachwertfaktor oder Liegenschaftszinssatz gilt nur zusammen mit dem Modell,
// in dem er abgeleitet wurde — deshalb wandert die Modellversion durch alle Ergebnisse.

export const MODELL = {
  IMMOWERTV_2021: 'immowertv2021',
  VOR_2022: 'vor2022',
};

/* ────────────────────────────────────────────────────────────────────────────
 * Anlage 1 ImmoWertV — Gesamtnutzungsdauer (GND) in Jahren, nach Gebaeudeart.
 * ACHTUNG: gegen den Verordnungstext zu verifizieren, bevor das PDF Kunden erreicht.
 * Die Wohnnutzungen (80 Jahre) sind belastbar, die Gewerbezeilen sind Arbeitsstand.
 * ──────────────────────────────────────────────────────────────────────────── */
export const GND_TABELLE = {
  fassung: 'ImmoWertV 2021, Anlage 1',
  geprueft: false,
  werte: {
    efh: 80, zfh: 80, dhh: 80, rh: 80,
    mfh: 80, etw: 80, wohnung: 80,
    wohn_misch: 70,
    buero: 60, geschaeft: 60,
    hotel: 40, lager: 40, werkstatt: 40, parkhaus: 40,
    kaufhaus: 50,
  },
  default: 80,
};

/* v2382 · Die Tabelle als Ganzes ist nicht gegen den Verordnungstext abgenommen (geprueft:
   false) - einzelne Zeilen sind es: Anlage 1 ImmoWertV 2021 nennt fuer Ein-/Zweifamilien-,
   Doppel- und Reihenhaeuser sowie Mehrfamilienhaeuser 80 Jahre, Buero/Geschaeftshaeuser 60,
   Kauf-/Warenhaeuser 50, Beherbergung, Lager, Werkstaetten, Hoch-/Tiefgaragen 40. Fuer
   diese Arten erscheint die Warnung „nicht verifiziert" nicht mehr. `wohn_misch` (70)
   bleibt offen. */
const GND_ANLAGE1_BELEGT = { efh: 80, zfh: 80, dhh: 80, rh: 80, mfh: 80, etw: 80, wohnung: 80, haus: 80,
  buero: 60, geschaeft: 60, kaufhaus: 50, hotel: 40, lager: 40, werkstatt: 40, parkhaus: 40 };
export function gndNachAnlage1Belegt(objektart) {
  const k = String(objektart ?? '').toLowerCase().trim();
  return GND_ANLAGE1_BELEGT[k] != null && GND_ANLAGE1_BELEGT[k] === gnd(k);
}

export function gnd(objektart) {
  const k = String(objektart ?? '').toLowerCase().trim();
  return GND_TABELLE.werte[k] ?? GND_TABELLE.default;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Anlage 3 ImmoWertV — Bewirtschaftungskosten.
 * UNGEPRUEFT. Die Betraege sind indexgebunden; Basisjahr und Indexreihe muessen
 * aus dem Verordnungstext uebernommen werden. Bis dahin liefert der Service ein
 * Ergebnis MIT Warnung, nie ohne.
 * ──────────────────────────────────────────────────────────────────────────── */
export const BWK_TABELLE = {
  fassung: 'ImmoWertV 2021, Anlage 3',
  geprueft: false,
  basisjahr: 2010,
  verwaltung_je_we_eur: 230,
  /* v1047-WBWK-1 · Anlage 3 I.1 nennt zwei verschiedene Betraege: 230 EUR
   * je Wohnung bzw. je Wohngebaeude bei Ein- und Zweifamilienhaeusern,
   * aber 275 EUR je EIGENTUMSWOHNUNG (Basiswerte; fuer 2021 gelten 298
   * bzw. 357 EUR). Wir haben immer 230 gerechnet, auch bei Wohnungs-
   * eigentum — der falsche der beiden Modellansaetze. */
  verwaltung_je_etw_eur: 275,
  verwaltung_je_stellplatz_eur: 30,
  instandhaltung_je_qm_wfl_eur: 9.0,
  instandhaltung_je_stellplatz_eur: 68,
  mietausfall_wohnen_pct: 2.0,
  mietausfall_gewerbe_pct: 4.0,
};
/* ────────────────────────────────────────────────────────────────────────────
 * v2186 · DIE FORTGESCHRIEBENEN ANSAETZE JE STICHTAGSJAHR.
 *
 * Marcel am 13.10.2026: „sollten wir dann im Marktbericht auch anpassen fuer
 * den Ertragswert, das soll schon passen. Bekommen wir auch immer die
 * aktuellen Werte je nach Objektart?"
 *
 * GEMESSEN vorher: der Ertragswert nahm BWK_TABELLE oben UNfortgeschrieben
 * (230 EUR / 9,00 EUR/m2) - fuer 2026 rund 37 % zu niedrige Kosten, Ertragswert
 * zu hoch. Die Anlage-3-Betraege werden jaehrlich zum 1. Januar mit dem
 * Verbraucherpreisindex fortgeschrieben (Oktober Vorjahr gegen Oktober 2001,
 * kaufmaennisch auf volle Euro; Beispielrechnung HVBG Hessen: 230 EUR x Index
 * = 351,41 -> 351 EUR fuer 2024).
 *
 * Hier stehen die veroeffentlichten Werte je Jahr - je Objektart getrennt:
 *   verw_we      Verwaltung je Wohnung bzw. je Wohngebaeude bei EFH/ZFH
 *   verw_etw     Verwaltung je Eigentumswohnung
 *   verw_garage  Verwaltung je Garage oder Einstellplatz
 *   inst_qm      Instandhaltung je m2 Wohnflaeche (Schoenheitsreparaturen beim Mieter)
 *   inst_garage  Instandhaltung je Garage oder Einstellplatz
 * Quellen: Verordnungstext (2021), Fachveroeffentlichungen (2024-2026, je zwei
 * uebereinstimmend), Tabelle Brandenburg (2023, nur Teilwerte). KEIN amtliches
 * Schreiben gefunden - deshalb steht die Quelle an jedem Jahr.
 *
 * NEUES JAHR: jedes Jahr im Januar die Werte eintragen (Agent `datenwaechter`
 * prueft das). Fehlt ein Jahr oder ein Feld, nimmt bwkAnsaetze() das letzte
 * belegte Jahr DAVOR und sagt das - nie ein spaeteres, nie eine Schaetzung.
 * ──────────────────────────────────────────────────────────────────────────── */
/* v2195 · Die Jahre 2022-2026 aus EINER amtlichen Tabelle: Oberer Gutachterausschuss
   Brandenburg, „Bewirtschaftungskosten entsprechend Anlage 3 ImmoWertV und Nr. 4.2.3
   VV EW-SW fuer die Jahre 2022 bis 2026“ (Bewko_2026.pdf, 1 Seite, gelesen 13.10.2026).
   Vorher: 2022 fehlte, 2023 nur Teilwerte, 2024 ETW 420 aus einer Fachquelle (amtlich 421),
   und die Quelle 2025 nannte einen Anbieternamen - der Text steht im Kundenbericht.
   Gewerbe (gew_*): Verwaltung 3 % des marktueblichen gewerblichen Rohertrags,
   Instandhaltung als Anteil der Wohn-Instandhaltung (Lager/Logistik/Produktion 30 %,
   SB-Verbrauchermaerkte 50 %, Buero/Praxen/Geschaefte 100 %), Mietausfall Wohnen 2 %,
   Gewerbe 4 %. Neue Jahre traegt der Agent datenwaechter jaehrlich als Vorschlag ein. */
export const BWK_JAHRE = {
  2021: { verw_we: 298, verw_etw: 357, verw_garage: 39, inst_qm: 11.70, inst_garage: 88,
          quelle: 'ImmoWertV 2021, Anlage 3 (Verordnungstext, Stand 01.01.2021)' },
  2022: { verw_we: 312, verw_etw: 373, verw_garage: 41, inst_qm: 12.20, inst_garage: 92,
          gew_verw_pct: 3, quelle: 'Oberer Gutachterausschuss Brandenburg, Bewirtschaftungskosten nach Anlage 3 ImmoWertV (gutachterausschuss.brandenburg.de, Stand 2026)' },
  2023: { verw_we: 339, verw_etw: 405, verw_garage: 44, inst_qm: 13.20, inst_garage: 100,
          gew_verw_pct: 3, quelle: 'Oberer Gutachterausschuss Brandenburg, Bewirtschaftungskosten nach Anlage 3 ImmoWertV (gutachterausschuss.brandenburg.de, Stand 2026)' },
  2024: { verw_we: 351, verw_etw: 421, verw_garage: 46, inst_qm: 13.80, inst_garage: 104,
          gew_verw_pct: 3, quelle: 'Oberer Gutachterausschuss Brandenburg, Bewirtschaftungskosten nach Anlage 3 ImmoWertV (gutachterausschuss.brandenburg.de, Stand 2026)' },
  2025: { verw_we: 359, verw_etw: 429, verw_garage: 47, inst_qm: 14.00, inst_garage: 106,
          gew_verw_pct: 3, quelle: 'Oberer Gutachterausschuss Brandenburg, Bewirtschaftungskosten nach Anlage 3 ImmoWertV (gutachterausschuss.brandenburg.de, Stand 2026)' },
  2026: { verw_we: 367, verw_etw: 439, verw_garage: 48, inst_qm: 14.40, inst_garage: 108,
          gew_verw_pct: 3, quelle: 'Oberer Gutachterausschuss Brandenburg, Bewirtschaftungskosten nach Anlage 3 ImmoWertV (gutachterausschuss.brandenburg.de, Stand 2026)' },
};
export const BWK_MIETAUSFALL = { wohnen_pct: 2, gewerbe_pct: 4, quelle: 'Oberer Gutachterausschuss Brandenburg / Anlage 3 ImmoWertV' };
/* ══ v2790 · INSTANDHALTUNG GEWERBE EXAKT NACH ANLAGE 3 II.2 (Marcel 22.10.2026, Punkt 4) ══
   Anlage 3 II.2 ImmoWertV nennt fuer die gewerbliche Nutzung keinen Eurobetrag, sondern
   einen ANTEIL der Instandhaltungskosten fuer Wohnnutzung (jeweils „wenn der Vermieter
   Dach und Fach traegt"): Buero/Praxen/Geschaefte 100 %, SB-Verbrauchermaerkte 50 %,
   Lager/Logistik/Produktion 30 %. Gerechnet wird deshalb Wohn-Instandhaltung je m2 ZUM
   STICHTAG (inst_qm) x Anteil, UNGERUNDET (2026: 14,40 x 30 % = 4,32 EUR/m2).
   Bis v2789 standen hier je Jahr die Betraege der Tabelle des Oberen Gutachterausschusses
   Brandenburg (gew_inst_qm), die auf zehn Cent rundet: Lager 2022 3,70 (exakt 3,66),
   2023 4,00 (3,96), 2024 4,10 (4,14), 2025 4,20 (4,20), 2026 4,30 (4,32); SB-Markt und
   Buero waren exakt. Wirkung: 178 m2 Lager 2026 = 769 statt 765 EUR/Jahr. */
export const GEW_INST_PCT = Object.freeze({ buero: 100, sb_markt: 50, lager: 30 });
export function gewerbeInstandhaltungQm(nutzung, instQmWohnen) {
  const p = GEW_INST_PCT[nutzung], w = Number(instQmWohnen);
  if (p == null || !Number.isFinite(w) || w <= 0) return null;
  return Math.round(w * p / 100 * 10000) / 10000;
}

/* Ansaetze zum Stichtagsjahr. Je Feld das Jahr selbst, sonst das letzte
   belegte Jahr davor. `abweichend` nennt jedes Feld, das NICHT aus dem
   Stichtagsjahr kommt - der Bericht muss das sagen koennen. */
const BWK_NAMEN = { verw_we: 'Verwaltung je Wohnung', verw_etw: 'Verwaltung je Eigentumswohnung', verw_garage: 'Verwaltung je Garage', inst_qm: 'Instandhaltung je m²', inst_garage: 'Instandhaltung je Garage' };
export function bwkAnsaetze(stichtagJahr) {
  const ziel = Number(stichtagJahr) || new Date().getFullYear();
  const jahre = Object.keys(BWK_JAHRE).map(Number).sort((a, b) => a - b);
  const felder = ['verw_we', 'verw_etw', 'verw_garage', 'inst_qm', 'inst_garage'];
  const out = { stichtag_jahr: ziel, werte: {}, jahr_je_feld: {}, quellen: [], abweichend: [] };
  for (const f of felder) {
    const j = jahre.filter((x) => x <= ziel && BWK_JAHRE[x][f] != null).pop();
    if (j == null) continue;
    out.werte[f] = BWK_JAHRE[j][f];
    out.jahr_je_feld[f] = j;
    if (out.quellen.indexOf(BWK_JAHRE[j].quelle) < 0) out.quellen.push(BWK_JAHRE[j].quelle);
    if (j !== ziel) out.abweichend.push(BWK_NAMEN[f] + ' aus ' + j);
  }
  out.vollstaendig = felder.every((f) => out.werte[f] != null);
  return out;
}


/* ────────────────────────────────────────────────────────────────────────────
 * Anlage 2 ImmoWertV — Modernisierungspunkte. Summe 20.
 * Wird in Paket A nur VORBEREITET (Struktur + Ableitung aus Gewerken), die
 * modifizierte Restnutzungsdauer wird noch nicht darueber gerechnet.
 * ──────────────────────────────────────────────────────────────────────────── */
export const MOD_ELEMENTE = {
  fassung: 'ImmoWertV 2021, Anlage 2',
  geprueft: false,
  punkte: {
    dach_inkl_daemmung: 4,
    aussenwand_daemmung: 4,
    fenster_aussentueren: 2,
    leitungssysteme: 2,
    heizung: 2,
    baeder: 2,
    innenausbau: 2,
    grundriss: 2,
  },
  // Gewerke des Objektformulars -> Anlage-2-Element. 'grundriss' hat keine
  // Entsprechung und muss abgefragt werden.
  gewerk_mapping: {
    eq_roof: 'dach_inkl_daemmung',
    eq_walls: 'aussenwand_daemmung',
    eq_windows: 'fenster_aussentueren',
    eq_heating: 'heizung',
    eq_bath: 'baeder',
    eq_floor: 'innenausbau',
  },
};

/* ────────────────────────────────────────────────────────────────────────────
 * § 256 BewG — typisierte Liegenschaftszinssaetze.
 * GEPRUEFT. Das ist ein gesetzlicher Auffangwert fuer die Grundsteuer, KEIN
 * marktabgeleiteter Zinssatz. Er liegt systematisch unter dem Marktniveau und
 * erzeugt damit tendenziell zu hohe Ertragswerte — deshalb immer mit Warnung.
 * ──────────────────────────────────────────────────────────────────────────── */
/* v2002 · DER RAHMEN, DER UEBER DIE VERWENDBARKEIT ENTSCHEIDET.

   Marcels Unterscheidung, und sie ist die entscheidende: dieselbe Zahl
   ist je Zweck verbindlich, ein Auffangwert oder unzulaessig.

     § 256 BewG       Grundsteuer (Bundesmodell) - die Tabelle unten
     § 188 BewG       Erbschaft- und Schenkungsteuer: MFH 3,5 %,
                      EFH/ZFH und ETW regelmaessig Vergleichswertverfahren
     § 21 Abs. 2 IWV  Verkehrswertgutachten: § 256 ist dort KEIN
                      verbindlicher Auffangwert - anzusetzen ist der
                      marktgerechte Zinssatz des Gutachterausschusses

   Steht hier als Datenobjekt, nicht als Kommentar: der Hinweis unten
   wird daraus GEBAUT. Wer den Rahmen aendert, aendert den Text - eine
   `lzsNach188()` waere dagegen von nirgendwo gerufen und damit tot. */
export const BEWG_RAHMEN = {
  grundsteuer:  { norm: '§ 256 BewG', zweck: 'Grundsteuerbewertung (Bundesmodell)' },
  erbschaft:    { norm: '§ 188 BewG', zweck: 'Erbschaft- und Schenkungsteuer', mfh_pct: 3.5,
                  zusatz: 'Mehrfamilienhaeuser 3,5 %; Ein-/Zweifamilienhaeuser und '
                        + 'Eigentumswohnungen regelmaessig im Vergleichswertverfahren' },
  verkehrswert: { norm: '§ 21 Abs. 2 ImmoWertV', zweck: 'Verkehrswertgutachten',
                  zusatz: 'kein gesetzlicher Auffangwert - anzusetzen ist der '
                        + 'marktgerechte Liegenschaftszinssatz des Gutachterausschusses' },
};

export const BEWG_256 = {
  fassung: '§ 256 BewG',
  geprueft: true,
  basis: {
    efh: 2.5, zfh: 2.5, dhh: 2.5, rh: 2.5,
    etw: 3.0, wohnung: 3.0,
    mfh_bis6: 4.0,
    mfh_ueber6: 4.5,
  },
  default: 4.0,
};

/**
 * Typisierter Liegenschaftszinssatz nach § 256 BewG inkl. Bodenrichtwert-Degression.
 * Bei Ein-/Zweifamilienhaeusern sinkt der Satz um 0,1 Punkte je volle 100 EUR/m²
 * Bodenrichtwert oberhalb 500 EUR/m²; ab 1.500 EUR/m² gilt einheitlich 1,5 %.
 *
 * @param {string} objektart
 * @param {number|null} brwSqm Bodenrichtwert in EUR/m²
 * @param {number|null} anzahlWe Anzahl Wohneinheiten (entscheidet MFH bis/ueber 6)
 * @returns {{pct:number, quelle:string, hinweis:string}}
 */
export function lzsNach256(objektart, brwSqm = null, anzahlWe = null) {
  const k = String(objektart ?? '').toLowerCase().trim();
  const istEfh = ['efh', 'zfh', 'dhh', 'rh'].includes(k);
  const istEtw = ['etw', 'wohnung'].includes(k);

  let pct;
  /* v2993c · „haus" mit ein oder zwei Wohnungen ist ein Ein-/Zweifamilienhaus (§ 249 Abs. 2, 3 BewG)
     und faellt unter § 256 Abs. 1 Nr. 1 (2,5 %), nicht unter die Mietwohngrundstuecke (Nr. 3).
     Gemessen 27.10.2026: Loehner Str. 278 (ZFH, 2 WE) rechnete mit 4,0 %. */
  if (k === 'haus' && Number(anzahlWe) >= 1 && Number(anzahlWe) <= 2) pct = BEWG_256.basis.efh;
  else if (istEfh) pct = BEWG_256.basis.efh;
  else if (istEtw) pct = BEWG_256.basis.etw;
  else if (k === 'mfh' || k === 'haus') {
    pct = (Number(anzahlWe) > 6) ? BEWG_256.basis.mfh_ueber6 : BEWG_256.basis.mfh_bis6;
  } else pct = BEWG_256.default;

  /* v2002 · Hier stand nur, was der Wert NICHT ist ("nicht
     marktabgeleitet"). Was fehlte, war der Zweck - und damit die
     Antwort auf die Frage, die der Leser wirklich hat: darf ich ihn
     in MEINEM Gutachten verwenden? Nein, und das steht jetzt da. */
  const R = BEWG_RAHMEN;
  let hinweis = `Gesetzlicher Auffangwert nach ${R.grundsteuer.norm} — er gilt der `
    + `${R.grundsteuer.zweck} und ist NICHT marktabgeleitet. `
    + `Fuer ein ${R.verkehrswert.zweck} ist er ${R.verkehrswert.zusatz} `
    + `(${R.verkehrswert.norm}). `
    + `Fuer die ${R.erbschaft.zweck} gilt stattdessen ${R.erbschaft.norm}: `
    + `${R.erbschaft.zusatz}. `
    /* v2396 · Hier stand „Weil der Satz unter dem oertlichen
       Liegenschaftszinssatz liegt, faellt der Ertragswert mit ihm eher hoch
       aus." Gemessen am 19.10.2026 gegen die amtlichen Registersaetze liegt
       § 256 im Median 0,7 bis 0,9 Prozentpunkte DARUEBER — der Ertragswert
       faellt mit ihm also eher zu NIEDRIG aus. Der Satz behauptete die
       Richtung, die es nicht ist. */
    + 'Der Satz liegt in der Regel ueber dem oertlichen Liegenschaftszinssatz '
    + '(gemessen im Median 0,7 bis 0,9 Prozentpunkte), der Ertragswert faellt '
    + 'mit ihm deshalb eher zu niedrig aus.';

  const brw = Number(brwSqm);
  if (istEfh && Number.isFinite(brw) && brw > 500) {
    if (brw >= 1500) {
      pct = 1.5;
      hinweis += ' Bodenrichtwert ab 1.500 EUR/m²: einheitlich 1,5 %.';
    } else {
      const stufen = Math.floor((brw - 500) / 100);
      pct = Math.max(1.5, round2(pct - stufen * 0.1));
      hinweis += ` Degression: ${stufen} × 0,1 Punkte wegen Bodenrichtwert ${brw} EUR/m².`;
    }
  }
  return { pct, quelle: 'bewg_256', hinweis };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Rechenkerne
 * ──────────────────────────────────────────────────────────────────────────── */

export function round2(v) { return Math.round(v * 100) / 100; }
export function round0(v) { return Math.round(v); }

/**
 * Barwertfaktor (Vervielfaeltiger) fuer eine nachschuessige Rente,
 * § 34 i.V.m. Anlage 4 ImmoWertV:  V = (q^n − 1) / (q^n × (q − 1)),  q = 1 + p/100.
 *
 * @param {number} zinsPct Liegenschaftszinssatz in Prozent
 * @param {number} rndJahre Restnutzungsdauer in Jahren
 * @returns {number|null}
 */
export function barwertfaktor(zinsPct, rndJahre) {
  const p = Number(zinsPct), n = Number(rndJahre);
  if (!Number.isFinite(p) || !Number.isFinite(n) || n <= 0) return null;
  if (p <= 0) return round2(n); // Grenzfall: ohne Verzinsung schlicht die Jahre
  const q = 1 + p / 100;
  const qn = Math.pow(q, n);
  return round2((qn - 1) / (qn * (q - 1)));
}

/**
 * Abzinsungsfaktor fuer einen Einmalbetrag (vereinfachtes Ertragswertverfahren):
 * A = 1 / q^n
 *
 * v2580 · VIER Nachkommastellen, nicht zwei. Die amtlichen Beispiele fuehren
 * den Abzinsungsfaktor vierstellig (EW-RL Anl. 3: 0,0805 / 0,1512 / 0,5327;
 * VW-RL Anl. 5: 0,6768; ImmoWertA G.II.2.b: 0,5976). Mit round2 wurde aus
 * 0,0805 eine 0,08 - am Beispiel 1 der EW-RL 20.000 statt 20.125 EUR
 * abgezinster Bodenwert, bei langer RND bis 8 % daneben (0,0543 -> 0,05).
 * Gemessen mit tools/wertermittlung-pruefen.mjs (Ebene A, 11 Faktoren).
 * Die Funktion wurde bis hier nirgends gerufen; der Barwertfaktor bleibt
 * zweistellig wie in allen Beispielen (14,15 / 13,06 / 6,46).
 */
export function abzinsungsfaktor(zinsPct, rndJahre) {
  const p = Number(zinsPct), n = Number(rndJahre);
  if (!Number.isFinite(p) || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(1e4 / Math.pow(1 + p / 100, n)) / 1e4;
}

/* ══ v2600 · MIETABWEICHUNG ALS BESONDERES OBJEKTSPEZIFISCHES MERKMAL ══════
   ImmoWertA zu § 31 c): liegt der tatsaechliche Ertrag ausserhalb der
   Bandbreite des Marktueblichen, rechnet der vorlaeufige Ertragswert mit dem
   marktueblichen Ertrag, und „die Abweichung ist als besonderes objekt-
   spezifisches Grundstuecksmerkmal zu beruecksichtigen (§ 8 Absatz 3)".
   Ertragswertrichtlinie 2015 Nr. 11.1 + Anlage 3 Beispiel 1: der Mehrertrag
   jedes Jahres wird mit dem Liegenschaftszins abgezinst und aufsummiert
   (dort 254.977,54 €, gerundet 255.000 €). Keine Kapitalisierung ueber die
   ganze Restnutzungsdauer (Prompt-Regel 4) - nur ueber die Restlaufzeit der
   Abweichung, die der Aufrufer kennen muss.

   barwertAbweichungen([d1, d2, …], zins): Jahr t mit Abzinsungsfaktor 1/q^t
     (vierstellig wie das Dokument), Summe auf den Cent.
   barwertAbweichung(dJahr, zins, n): gleichbleibende Differenz ueber n Jahre
     = dJahr × Barwertfaktor (zweistellig wie das Dokument).
   Vorzeichen bleibt: Overrent positiv (Zuschlag), Underrent negativ (Abschlag). */
export function barwertAbweichungen(differenzen, zinsPct) {
  if (!Array.isArray(differenzen) || !differenzen.length) return null;
  const p = Number(zinsPct);
  if (!Number.isFinite(p)) return null;
  let s = 0;
  differenzen.forEach((d, i) => {
    const x = Number(d);
    if (Number.isFinite(x) && x !== 0) s += x * abzinsungsfaktor(p, i + 1);
  });
  return round2(s);
}
/* ══ v2790 · DIE ABWEICHUNG IST EINE REINERTRAGSDIFFERENZ (Marcel 22.10.2026, Punkt 2) ══
   EW-RL 2015 Anlage 3, Tabelle „Werteinfluss der boG fuer Beispielrechnung 1": je Jahr
   jaehrlicher Rohertrag (vertraglich) − jaehrliche Bewirtschaftungskosten = jaehrlicher
   Reinertrag; „Abweichung zum marktueblichen Reinertrag" = dieser Reinertrag − 205.200 €
   (= 240.000 − 34.800). Die Bewirtschaftungskosten stehen dort in JEDEM Jahr mit
   34.800 € - genau den Kosten des marktueblichen Ansatzes, auch das Mietausfallwagnis
   (12.000 €) waechst mit der Staffelmiete NICHT mit. Damit ist die Reinertragsdifferenz
   des Musters gleich der Rohertragsdifferenz (Jahr 2: 217.200 − 205.200 = 252.000 − 240.000
   = 12.000). Eine Kuerzung um mietabhaengige Kostenanteile (Mietausfall, prozentuale
   Verwaltung) sieht das Muster NICHT vor - sie wird hier deshalb auch nicht gerechnet.
   Gesonderte erhebliche Abweichungen der Bewirtschaftungskosten sind ein eigenes boG
   (EW-RL Nr. 6 Abs. 3), nicht Teil der Mietabweichung.
   reinertragsDifferenzen([Rohertrag Jahr 1, 2, …], Rohertrag marktueblich, BWK marktueblich)
   -> [Reinertrag_t − Reinertrag_marktueblich], BWK in beiden Spalten gleich. */
export function reinertragsDifferenzen(rohertraegeIst, rohertragMarkt, bwkMarkt) {
  const m = Number(rohertragMarkt), b = Number(bwkMarkt) || 0;
  if (!Array.isArray(rohertraegeIst) || !Number.isFinite(m)) return null;
  const reinMarkt = m - b;
  return rohertraegeIst.map((r) => Math.round(((Number(r) - b) - reinMarkt) * 100) / 100);
}
export function barwertAbweichung(differenzJahr, zinsPct, jahre) {
  const d = Number(differenzJahr), n = Number(jahre);
  if (!Number.isFinite(d) || !Number.isFinite(n) || n <= 0) return null;
  const v = barwertfaktor(zinsPct, n);
  return v == null ? null : round0(d * v);
}

/**
 * Restnutzungsdauer. Paket A: schlicht GND − Alter, mit Untergrenze.
 * Das Anlage-2-Modell ist vorbereitet (MOD_ELEMENTE), aber noch nicht scharf.
 *
 * @param {number} gndJahre
 * @param {number|null} baujahr
 * @param {string} baustatus
 * @param {number|null} stichtagJahr
 */
/* v1047 · Anlage 2 als eigenes Modul, damit die Verordnungstabellen an
 * einer Stelle stehen und einzeln pruefbar bleiben. */
import { restnutzungsdauer as _anlage2 } from './anlage2.js';

export function rnd(gndJahre, baujahr, baustatus = 'bestand', stichtagJahr = null, opt = null) {
  const G = Number(gndJahre) || GND_TABELLE.default;
  const jahr = Number(stichtagJahr) || new Date().getFullYear();

  /* v1047-WA2-1 · Liegt eine Modernisierungspunktzahl vor, gilt das Modell
   * der Anlage 2 — die Verordnung sagt "zugrunde zu legen", nicht "kann".
   * Ohne Punktzahl bleibt es bei der bisherigen Schaetzung; sie ist nicht
   * falsch, nur unschaerfer, und ohne Eingabe gibt es nichts Besseres. */
  if (opt && opt.mod_punkte != null && Number.isFinite(Number(opt.mod_punkte))) {
    const bjA2 = opt.kernsaniert && Number(opt.sanierungsjahr) > 1500
      ? Number(opt.sanierungsjahr)     // Anlage 2 II.1: Baujahr = Jahr der Sanierung
      : Number(baujahr);
    if (Number.isFinite(bjA2) && bjA2 > 1500) {
      const alterA2 = Math.max(0, jahr - bjA2);
      const a2 = _anlage2({ gnd: G, alter: alterA2,
                            punkte: Number(opt.mod_punkte), kernsaniert: !!opt.kernsaniert });
      if (a2) {
        return { jahre: a2.rnd, alter: alterA2, modell: 'anlage2',
                 punkte: a2.punkte, grad: a2.grad, weg: a2.weg,
                 hinweis: 'Restnutzungsdauer nach Anlage 2 ImmoWertV \u2014 ' + a2.grad
                   + ', ' + a2.punkte + ' von 20 Modernisierungspunkten. ' + a2.hinweis };
      }
    }
  }

  // Neubau: volle Nutzungsdauer, keine Alterswertminderung.
  if (istNeubau(baustatus)) {
    return { jahre: G, alter: 0, modell: 'neubau', hinweis: 'Neubau — Restnutzungsdauer entspricht der Gesamtnutzungsdauer.' };
  }

  const bj = Number(baujahr);
  if (!Number.isFinite(bj) || bj < 1500 || bj > jahr + 5) {
    return { jahre: null, alter: null, modell: 'unbekannt', hinweis: 'Ohne Baujahr keine Restnutzungsdauer.' };
  }
  const alter = Math.max(0, jahr - bj);
  /* ═══ v1332 · Die Untergrenze wird GEPRUEFT, nicht angewandt ═══════
     Hier stand:

       const jahre = Math.max(linear, linear > 0 ? 0 : 0);

     Das ist Math.max(linear, 0) - und `linear` ist schon mit Math.max(0, …)
     gebildet. Die Zeile tat also NICHTS. Sie sieht aus wie eine Absicht,
     die nie zu Ende gedacht wurde: die 30-Prozent-Untergrenze steht daneben
     und wurde nirgends angewandt.

     DAS VERHALTEN BLEIBT, und zwar bewusst. § 38 Abs. 1 ImmoWertV schreibt
     die LINEARE Alterswertminderung vor: Restnutzungsdauer zu
     Gesamtnutzungsdauer. Eine Untergrenze ohne Modernisierungsnachweis
     waere eine Verlaengerung, die niemand begruenden kann - und genau
     dafuer gibt es Anlage 2, die oben schon greift, sobald Punkte
     vorliegen.

     Was bleibt, ist der HINWEIS: faellt die lineare Rechnung unter 30 %
     der GND, steht im Bericht, dass eine Verlaengerung zu pruefen ist.
     Pruefen muss sie ein Mensch. */
  const linear = Math.max(0, G - alter);
  const untergrenze = Math.round(G * 0.3);
  const jahre = linear;
  return {
    jahre,
    alter,
    modell: 'linear',
    untergrenze_bei_modernisierung: untergrenze,
    hinweis: jahre < untergrenze
      ? `Rechnerische Restnutzungsdauer ${jahre} Jahre. Bei durchgefuehrten Modernisierungen ist eine Verlaengerung auf mindestens ${untergrenze} Jahre zu pruefen (Anlage 2 ImmoWertV).`
      : '',
  };
}

export function istNeubau(baustatus) {
  const s = String(baustatus ?? '').toLowerCase();
  return s === 'neubau_erstbezug' || s === 'neubau_im_bau' || s === 'neubau';
}

export function istErstbezugNachSanierung(baustatus) {
  return String(baustatus ?? '').toLowerCase() === 'bestand_erstbezug_saniert';
}

export const BAUSTATUS = {
  BESTAND: 'bestand',
  BESTAND_ERSTBEZUG_SANIERT: 'bestand_erstbezug_saniert',
  NEUBAU_ERSTBEZUG: 'neubau_erstbezug',
  NEUBAU_IM_BAU: 'neubau_im_bau',
  GEPLANT: 'geplant',
};

export const BAUSTATUS_LABEL = {
  bestand: 'Bestand',
  bestand_erstbezug_saniert: 'Bestand, Erstbezug nach Sanierung',
  neubau_erstbezug: 'Neubau, Erstbezug',
  neubau_im_bau: 'Neubau, im Bau',
  geplant: 'Geplant / Bauträger',
};
