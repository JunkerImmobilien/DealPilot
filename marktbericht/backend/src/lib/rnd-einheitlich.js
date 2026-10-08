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
import { restnutzungsdauer as anlage2Rnd } from './anlage2.js';

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
  const nowYear = new Date().getFullYear();
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
  const erg = (quelle, grund, rnd, hinweis) =>
    ({ rnd, quelle, grund, gnd_jahre: GND, hinweis });

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
  const mp = Number.isFinite(_mpRoh) && _mpRoh >= 0 ? _mpRoh : null;
  const _angaben = Number(ref.mod_angaben) || 0;
  if (mp == null) {
    if (_angaben > 0) {
      return erg('geschaetzt', 'punkte_nicht_berechnet', fallback,
        SCHAETZUNG_TEXT + ' Für ' + _angaben + ' der acht Bauteile liegt eine '
        + 'Angabe vor, die Modernisierungspunkte nach Anlage 2 sind dafür aber '
        + 'nicht hinterlegt. Das Objekt einmal im Reiter Objekt öffnen und '
        + 'speichern setzt sie; danach rechnet der Bericht nach Anlage 2.');
    }
    return erg('geschaetzt', 'kein_modernisierungsgrad', fallback,
      SCHAETZUNG_TEXT + ' Es wurde kein Modernisierungsgrad erfasst. Mit '
      + 'Modernisierungspunkten fällt die Restnutzungsdauer regelmäßig höher '
      + 'aus, und mit ihr der Gebäudesachwert.');
  }
  if (_angaben === 0 && mp === 0) {
    /* Punkte „0" ohne eine einzige Antwort ist kein Befund, sondern ein
       Vorgabewert — hier gilt weiter die Schaetzung. */
    return erg('geschaetzt', 'kein_modernisierungsgrad', fallback,
      SCHAETZUNG_TEXT + ' Es wurde kein Modernisierungsgrad erfasst (0 Punkte '
      + 'ohne Angabe zu den Bauteilen).');
  }
  const kern = /kernsaniert/i.test(String(ref.modernization || '')) && mp >= 18;
  const bj = kern && _num(ref.modernization_year) > 1500
    ? _num(ref.modernization_year) : _num(ref.build_year);
  if (!(bj > 1500)) {
    return erg('geschaetzt', 'kein_baujahr', fallback,
      SCHAETZUNG_TEXT + ' Es liegt kein verwertbares Baujahr vor.');
  }
  const a2 = anlage2Rnd({ gnd: GND, alter: Math.max(0, (new Date().getFullYear()) - bj),
                          punkte: mp, kernsaniert: kern });
  /* v1966: den ECHTEN Grund weitergeben. Hier stand pauschal „lieferte
     kein Ergebnis" — seit anlage2.js hinter dem Scheitel absichtlich
     verweigert (Alter >= GND), ist das der haeufigste Fall, und der
     Leser des Berichts hat ein Recht auf die Begruendung. */
  if (!(a2 && a2.rnd != null)) {
    const _g = (a2 && a2.grund) || 'anlage2_ohne_ergebnis';
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
  return erg('anlage2', null, _mitBoden,
    'Restnutzungsdauer nach Anlage 2 ImmoWertV bei einer Gesamtnutzungsdauer von '
    + GND + ' Jahren, aus ' + mp + ' Modernisierungspunkten'
    + (kern ? ' (Kernsanierung)' : '') + '.'
    + (_gebodet ? ' Das Modell ergibt ' + a2.rnd + ' Jahre; angesetzt ist die '
        + 'Untergrenze von ' + RND_MIN + ' Jahren.' : ''));
}

export default { restnutzungsdauerEinheitlich, schaetzung, GND_JAHRE_STANDARD, RND_MIN };
