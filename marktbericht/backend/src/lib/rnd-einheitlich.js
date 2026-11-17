/* lib/rnd-einheitlich.js — v1816 · EINE RESTNUTZUNGSDAUER FÜR ALLE VERFAHREN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CLAUDE.md führt diesen Satz als Doktrin: „Eine Restnutzungsdauer für alle
 * Verfahren." Bis v1815 stand die Ableitung als Closure INNERHALB von
 * `CrossCheckService.compute()` — von außen nicht erreichbar.
 *
 * Das wurde zum Problem, als die amtlichen Liegenschaftszinssätze
 * angeschlossen wurden: die Gutachterausschüsse staffeln sie nach
 * Restnutzungsdauer (Dresden führt `efh_frei_rnd36_55`, Leipzig
 * `etw_altbau_rnd20_34`), und der Zinssatz wird im Bericht VOR dem
 * Sachwert geholt. Die Zahl lag also noch nicht vor.
 *
 * Der bequeme Weg wäre gewesen, sie am zweiten Ort noch einmal
 * abzuleiten.
 *
 *   > Zwei Ableitungen derselben Zahl laufen auseinander. Nicht heute,
 *   > nicht absichtlich — aber sie laufen auseinander, und dann steht in
 *   > einem Gutachten an zwei Stellen eine andere Restnutzungsdauer.
 *
 * Deshalb liegt sie jetzt hier, und beide fragen dieselbe Funktion.
 * Gerechnet wird NICHTS NEU: beide Zweige sind Zeile für Zeile aus
 * `CrossCheckService` übernommen (Schätzung ab Z. 118, Anlage 2 ab Z. 203
 * im Stand v1815).
 */
import { stichtagJahr } from './stichtag.js';   /* v3010 */
import { restnutzungsdauer as anlage2Rnd } from './anlage2.js';
import { createRequire } from 'node:module';
/* v3660 · Rangfolge der Modernisierungspunkte - woertliche Kopie von
   frontend/js/modernisierung-herkunft.js (tools/rechenkerne-spiegeln.mjs). */
const DpModernisierung = createRequire(import.meta.url)('./generated/modernisierung-herkunft.cjs');

export const GND_JAHRE_STANDARD = 80;   /* Wohngebäude, Anlage 1 ImmoWertV */
export const RND_MIN = 10;

const _num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Die Schätzung: Gesamtnutzungsdauer minus Alter, Modernisierung verlängert.
 * Sie ist der Rückfall, NICHT das Verfahren — wer sie bekommt, bekommt den
 * Hinweis dazu.
 */
export function schaetzung(ref = {}, gnd = GND_JAHRE_STANDARD) {
  const buildYear = _num(ref.build_year);
  if (!buildYear) return null;
  const G = Number(gnd) > 0 ? Number(gnd) : GND_JAHRE_STANDARD;
  const nowYear = stichtagJahr(ref);   /* v3010 · Alter zum Wertermittlungsstichtag */
  const alter = Math.max(0, nowYear - buildYear);
  let rnd = G - alter;
  const mod = String(ref.modernization || '').toLowerCase();
  const modYear = _num(ref.modernization_year);
  let bonus = 0;
  if (mod.includes('kern') || mod.includes('umfassend')) bonus = 20;
  else if (mod.includes('teil') || (modYear && nowYear - modYear <= 35)) bonus = 10;
  return Math.min(G - 10, Math.max(rnd + bonus, RND_MIN));
}

const SCHAETZUNG_TEXT = 'Restnutzungsdauer geschätzt (Gesamtnutzungsdauer '
  + 'minus Alter) — Anlage 2 ImmoWertV wurde nicht angewandt.';

/**
 * Die Restnutzungsdauer mit ihrer HERKUNFT.
 *
 * @param {object} ref   build_year, mod_punkte, modernization,
 *                       modernization_year
 * @param {number} gnd   Gesamtnutzungsdauer des Modells (§ 21 Abs. 3:
 *                       der Sachwertfaktor gilt nur mit dem Modell, aus
 *                       dem er abgeleitet wurde)
 * @returns {{rnd:number|null, quelle:'anlage2'|'geschaetzt'|null,
 *            grund:string|null, gnd_jahre:number, hinweis:string|null}}
 */
export function restnutzungsdauerEinheitlich(ref = {}, gnd = GND_JAHRE_STANDARD) {
  const GND = Number(gnd) > 0 ? Number(gnd) : GND_JAHRE_STANDARD;
  const fallback = schaetzung(ref, GND);
  let _modErg = null;   /* v3660 · Herkunft der Punkte reist am Ergebnis mit */
  const erg = (quelle, grund, rnd, hinweis) =>
    ({ rnd, quelle, grund, gnd_jahre: GND, hinweis, modernisierung: _modErg });

  /* ══ v1973 · DREI FAELLE, NICHT EINER ════════════════════════════════

     Hier stand `_num(ref.mod_punkte)`, und `_num` verlangt `> 0`. Damit
     landete JEDE Null im Zweig „kein Modernisierungsgrad erfasst" — auch
     die Null, die aus acht Antworten „Keine/Nie" entsteht.

     Die drei Faelle sind unterschiedlich und bekommen jetzt
     unterschiedliche Auskunft:

       Punkte da (auch 0) und Antworten da
         -> Anlage 2 gilt. Die Verordnung sagt „zugrunde zu legen",
            nicht „kann", und 0 Punkte sind der Modellwert fuer
            „nicht modernisiert".

       keine Punkte, aber Antworten da
         -> `punkte_nicht_berechnet`. Gemessen am 08.10.2026: 10 von 21
            Objekten. Ursache war, dass der gerechnete Wert nie
            gespeichert wurde (v1973 im Frontend behoben) — der Bericht
            sagt es jetzt, statt still zu schaetzen.

       nichts da
         -> `kein_modernisierungsgrad`, wie bisher.

     > `_num` bleibt unveraendert: andere Felder (Baujahr,
     > Sanierungsjahr) duerfen zu Recht keine Null sein. Fuer die Punkte
     > gilt eine eigene Pruefung — eine Punktzahl darf 0 sein. */
  const _mpRoh = Number(ref.mod_punkte);
  const _mpAngabe = Number.isFinite(_mpRoh) && _mpRoh >= 0 && !(ref.mod_punkte === null || ref.mod_punkte === undefined || ref.mod_punkte === '') ? _mpRoh : null;
  const _angaben = Number(ref.mod_angaben) || 0;
  /* ══ v2541 · OHNE PUNKTE: ANLAGE 2 MIT 0 PUNKTEN (Marcel 20.10.2026) ════
     Bis v2540 rechneten die Faelle „kein Modernisierungsgrad" und „Punkte
     nicht berechnet" die RND LINEAR (GND - Alter). Das Wertpotenzial rechnete
     im Zielbild dagegen nach Anlage 2 mit 0 + Massnahmenpunkten - ein Teil des
     Potenzials entstand nur aus dem Methodenwechsel (gemessen Demo-MFH, Baujahr
     1962: Bestand 16 J. linear, Anlage 2 mit 0 Punkten 18 J., +20.000 EUR
     scheinbares Potenzial; „Ist ueber Band" +45.000 EUR).
     Anlage 2 ImmoWertV fuehrt 0 Punkte ausdruecklich als „nicht modernisiert";
     die Liegenschaftszinssaetze (Bielefeld MFH: RND der Stichprobe 24 +- 11 J.)
     sind mit der nach Anlage 2 bestimmten RND abgeleitet - § 10 Modellkonformitaet.
     Entscheidung: ohne Angabe gilt Anlage 2 mit 0 Punkten, in JEDER Stufe und
     jedem Verfahren, mit Hinweis, dass Punkte die RND erhoehen koennen. */
  /* v3660 · Eine 0 mit der Kennung „eigene Angabe" (Auswahlfeld „nicht modernisiert") ist eine
     Antwort; ohne Kennung und ohne beantwortete Gewerke ist sie die alte Vorbelegung. */
  const _herk = String(ref.mod_punkte_herkunft || '');
  const _nullEigen = _mpAngabe === 0 && /^(eigene_angabe|gewerke|mfh)$/.test(_herk);
  const _ohnePunkte = _mpAngabe == null || (_angaben === 0 && _mpAngabe === 0 && !_nullEigen);
  /* ══ v3660 · OHNE PUNKTE: DIE RANGFOLGE STATT 0 (Marcel 17.11.2026) ═══════
     v2541 setzte ohne Angabe 0 Punkte („nicht modernisiert"). Gemessen am
     17.11.2026 an einem Paket aus Haeusern der 1950er mit WDVS, Dachdaemmung
     und Brennwertheizung im Exposé: RND 12 bis 14 Jahre, Ertragswert 4,87 statt
     rund 7,05 Mio. EUR - und der Hamburger Liegenschaftszins gilt erst ab RND 30.
     Jetzt: Zustand (eigene Angabe) > Ableitung aus Exposé-Text und Bildern >
     Rueckfall (mittel = 8 Punkte ab 30 Jahren, abgestuft nach Energieklasse).
     Der Grund aus v2541 bleibt erfuellt: es ist weiter Anlage 2 in JEDER Stufe
     und jedem Verfahren, und das Wertpotenzial baut auf derselben Zahl auf
     (PotenzialService fragt modernisierungFuerRnd()). Die Faelle „Gewerke
     beantwortet, Punkte fehlen" behalten 0 - dort liegt eine Antwort vor. */
  const _mod = _ohnePunkte && !(_mpAngabe == null && _angaben > 0) ? modernisierungFuerRnd(ref) : null;
  const mp = _ohnePunkte ? (_mod ? _mod.punkte : 0) : _mpAngabe;
  const _ohneText = !_ohnePunkte ? ''
    : (_mpAngabe == null && _angaben > 0
      ? ' Für ' + _angaben + ' der acht Bauteile liegt eine Angabe vor, die Modernisierungspunkte sind aber nicht hinterlegt (Objekt im Reiter Objekt öffnen und speichern); angesetzt sind 0 Punkte („nicht modernisiert").'
      : (_mod ? ' ' + _mod.satz : ' Es wurde kein Modernisierungsgrad erfasst; angesetzt sind 0 Punkte („nicht modernisiert").'));
  _modErg = _mod || null;
  const kern = /kernsaniert/i.test(String(ref.modernization || '')) && mp >= 18 && !_mod;
  const bj = kern && _num(ref.modernization_year) > 1500
    ? _num(ref.modernization_year) : _num(ref.build_year);
  if (!(bj > 1500)) {
    return erg('geschaetzt', 'kein_baujahr', fallback,
      SCHAETZUNG_TEXT + ' Es liegt kein verwertbares Baujahr vor.');
  }
  const a2 = anlage2Rnd({ gnd: GND, alter: Math.max(0, stichtagJahr(ref) - bj),   /* v3010 */
                          punkte: mp, kernsaniert: kern });
  /* v1966: den ECHTEN Grund weitergeben. Hier stand pauschal „lieferte
     kein Ergebnis" — seit anlage2.js hinter dem Scheitel absichtlich
     verweigert (Alter >= GND), ist das der haeufigste Fall, und der
     Leser des Berichts hat ein Recht auf die Begruendung. */
  if (!(a2 && a2.rnd != null)) {
    const _g = (a2 && a2.grund) || (_ohnePunkte ? 'kein_modernisierungsgrad' : 'anlage2_ohne_ergebnis');
    const _h = (a2 && a2.hinweis)
      ? SCHAETZUNG_TEXT + ' ' + a2.hinweis
      : SCHAETZUNG_TEXT + ' Die Berechnung nach Anlage 2 lieferte kein Ergebnis.';
    return erg('geschaetzt', _g, fallback, _h);
  }
  /* ══ v1969 · DIE UNTERGRENZE GILT DURCHGEHEND ════════════════════════

     Marcels Entscheidung vom 08.10.2026: „die RND-Untergrenze lassen wir
     auf 10." Die Alternative waeren die 30 Prozent aus Paragraf 185
     Abs. 3 Satz 6 BewG gewesen (bei GND 80 also 24 Jahre) — Steuerrecht,
     fuer den Verkehrswert nicht bindend und die unvorsichtigere Zahl.

     HIER WAR SIE KEINE UNTERGRENZE. `RND_MIN` wirkte nur im
     Schaetzungs-Zweig (`schaetzung()`), nicht im Anlage-2-Zweig. Gemessen
     am 08.10.2026 ergab das einen SPRUNG NACH OBEN mit zunehmendem Alter:

       GND 50, 1 Punkt, Alter 46  ->   8,4 Jahre   (Anlage 2, ohne Boden)
       GND 50, 1 Punkt, Alter 51  ->  10,0 Jahre   (Rueckfall, mit Boden)

     Das aeltere Gebaeude bekam mehr — derselbe Fehlertyp, der in v1966
     hinter dem Scheitel der Parabel behoben wurde, nur eine Ebene hoeher.
     Gefunden hat ihn tools/rnd-kerne-pruefen.mjs beim Pruefen des
     Standalone-Moduls.

     WIE VIEL ES AENDERT, nachgemessen am echten anlage2.js ueber 7.455
     Faelle (Alter 1 bis GND-1, alle 21 Punktzahlen, GND 50/60/70/80/100):

       24 Faelle liegen unter 10 Jahren — 0,32 Prozent
       nur bei GND 60 (ab Alter 56) und GND 50 (ab Alter 43),
       also bei 93 bzw. 86 Prozent der Gesamtnutzungsdauer
       bei GND 70, 80 und 100 NIE

     Es trifft also ausschliesslich den aeussersten Rand, unmittelbar
     bevor das Modell ohnehin abgeschaltet wird, und hebt dort um
     hoechstens 0,9 Jahre.

     > WARUM DER BODEN HIER UND NICHT IN anlage2.js STEHT: anlage2.js ist
     > das MODELL der Verordnung und soll es bleiben — es rechnet, was die
     > Anlage 2 sagt, und verweigert, wo sie nicht gilt. Die Untergrenze
     > ist dagegen eine HAUSENTSCHEIDUNG. Sie gehoert in die Schicht, die
     > schon RND_MIN besitzt und die alle Verfahren fragen. So gibt es
     > weiter EINE Untergrenze an EINER Stelle.

     > Die Klammer nach oben (GND minus RND_MIN) gilt mit: bei einer
     > Gesamtnutzungsdauer von 20 Jahren waeren 10 Jahre Restnutzung die
     > Haelfte, was fuer ein Gebaeude an seiner Altersgrenze unsinnig
     > ist. Dieselbe Klammer fuehrt `schaetzung()`. */
  const _mitBoden = Math.min(GND - RND_MIN, Math.max(a2.rnd, RND_MIN));
  const _gebodet = Math.abs(_mitBoden - a2.rnd) > 1e-9;
  return erg('anlage2', _ohnePunkte ? (_mod ? 'modernisierung_' + _mod.herkunft : 'ohne_punkte_null') : null, _mitBoden,
    'Restnutzungsdauer nach Anlage 2 ImmoWertV bei einer Gesamtnutzungsdauer von '
    + GND + ' Jahren, aus ' + mp + ' Modernisierungspunkten'
    + (kern ? ' (Kernsanierung)' : '') + '.' + _ohneText
    + (_gebodet ? ' Das Modell ergibt ' + a2.rnd + ' Jahre; angesetzt ist die '
        + 'Untergrenze von ' + RND_MIN + ' Jahren.' : ''));
}

/**
 * v3660 · Die Modernisierungspunkte, mit denen die RND rechnet, wenn KEINE Punkte
 * eingetragen sind - mit Herkunft und Satz fuer den Bericht. Liegen Punkte vor,
 * null (dann gilt die Angabe). Felder am ref: mod_zustand (+ mod_zustand_quelle),
 * mod_ableitung (Ergebnis von DpModernisierung.kombinieren), energy_class, build_year.
 */
export function modernisierungFuerRnd(ref = {}) {
  const _r = ref.mod_punkte, _n = Number(_r);
  const _da = !(_r === null || _r === undefined || _r === '') && Number.isFinite(_n) && _n >= 0;
  if (_da && (_n > 0 || /^(eigene_angabe|gewerke|mfh)$/.test(String(ref.mod_punkte_herkunft || '')))) return null;
  if ((Number(ref.mod_angaben) || 0) > 0) return null;   /* Gewerke beantwortet: dort gilt die Antwort */
  let ab = ref.mod_ableitung;
  if (typeof ab === 'string') { try { ab = ab ? JSON.parse(ab) : null; } catch (e) { ab = null; } }
  try {
    return DpModernisierung.bestimmen({
      zustand: ref.mod_zustand || ref.condition || null, zustand_quelle: ref.mod_zustand_quelle || 'eigene',
      ableitung: ab, baujahr: ref.build_year, stichtag_jahr: stichtagJahr(ref),
      energieklasse: ref.energy_class || null });
  } catch (e) { return null; }
}

export default { restnutzungsdauerEinheitlich, modernisierungFuerRnd, schaetzung, GND_JAHRE_STANDARD, RND_MIN };
