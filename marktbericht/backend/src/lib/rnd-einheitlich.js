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

  const mp = _num(ref.mod_punkte);
  if (mp == null) {
    return erg('geschaetzt', 'kein_modernisierungsgrad', fallback,
      SCHAETZUNG_TEXT + ' Es wurde kein Modernisierungsgrad erfasst. Mit '
      + 'Modernisierungspunkten fällt die Restnutzungsdauer regelmäßig höher '
      + 'aus, und mit ihr der Gebäudesachwert.');
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
  return erg('anlage2', null, a2.rnd,
    'Restnutzungsdauer nach Anlage 2 ImmoWertV bei einer Gesamtnutzungsdauer von '
    + GND + ' Jahren, aus ' + mp + ' Modernisierungspunkten'
    + (kern ? ' (Kernsanierung)' : '') + '.');
}

export default { restnutzungsdauerEinheitlich, schaetzung, GND_JAHRE_STANDARD, RND_MIN };
