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
  if (istEfh) pct = BEWG_256.basis.efh;
  else if (istEtw) pct = BEWG_256.basis.etw;
  else if (k === 'mfh' || k === 'haus') {
    pct = (Number(anzahlWe) > 6) ? BEWG_256.basis.mfh_ueber6 : BEWG_256.basis.mfh_bis6;
  } else pct = BEWG_256.default;

  let hinweis = 'Gesetzlicher Auffangwert nach § 256 BewG — nicht marktabgeleitet. '
    + 'Er liegt in der Regel unter dem oertlichen Liegenschaftszinssatz und fuehrt '
    + 'damit zu einem eher hohen Ertragswert.';

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
 */
export function abzinsungsfaktor(zinsPct, rndJahre) {
  const p = Number(zinsPct), n = Number(rndJahre);
  if (!Number.isFinite(p) || !Number.isFinite(n) || n <= 0) return null;
  return round2(1 / Math.pow(1 + p / 100, n));
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
  // Untergrenze 30 % der GND, sobald das Gebaeude weiter genutzt wird (uebliche
  // Konvention bei modernisiertem Bestand). Ohne Modernisierungsnachweis greift
  // sie erst, wenn die lineare Rechnung darunter faellt.
  const linear = Math.max(0, G - alter);
  const untergrenze = Math.round(G * 0.3);
  const jahre = Math.max(linear, linear > 0 ? 0 : 0);
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
