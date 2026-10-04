'use strict';
/* services/telegramAbsichtService.js — was will der Nutzer? (v1798)
 *
 * Marcel am 02.10.2026: "ich moechte einfach sachen sagen wie gib mir ne
 * liste der objekte aus. sag mir was Objekt 17 davon an Kerndaten hat.
 * Also das muss schlau sein. (...) Das muss halt ein lockerer flow sein."
 *
 * ── WARUM NICHT EINFACH DAS MODELL FRAGEN ───────────────────────────────
 *
 * Man koennte jede Nachricht an das Modell geben und es entscheiden
 * lassen. Das waere langsam (zwei Sekunden fuer "liste"), teuer (jede
 * Nachricht zaehlt gegen das Tageslimit) und bei den haeufigsten Faellen
 * unnoetig: "liste", "was kann ich", "neues objekt" sind eindeutig.
 *
 *   > Ein Modell fuer eine Frage zu rufen, die ein Wort beantwortet,
 *   > macht den Bot nicht schlauer, sondern langsamer.
 *
 * Deshalb zwei Stufen:
 *   1. SICHER   — klare Formulierungen, sofort erkannt, kostenlos
 *   2. OFFEN    — alles andere geht an den Co-Piloten, der ohnehin den
 *                 ganzen Kontext bekommt
 *
 * Stufe 1 ist bewusst knapp gehalten. Jedes Muster hier ist eines, das
 * das Modell NICHT mehr sieht — wer zu viel abfaengt, nimmt dem Bot genau
 * die Schlaeue, um die es geht.
 *
 * ── DIE BEZUGNAHME IST DER EIGENTLICHE PUNKT ────────────────────────────
 *
 * "Objekt 17 davon" ist ohne die Liste davor sinnlos. Diese Datei loest
 * solche Bezuege auf, BEVOR irgendetwas anderes passiert — gegen die
 * zuletzt gezeigte Liste aus `telegram_dialog.letzte_liste`.
 */

/* ── Was ist gemeint? ────────────────────────────────────────────────────
 *
 * Gibt { art, ... } zurueck. `art` ist eine von:
 *   liste · portfolio · anlegen · marktpreis · score · hilfe · stop
 *   abbrechen · bezug · frei
 */

const MUSTER = [
  /* Reihenfolge zaehlt: das erste Muster, das passt, gewinnt. Deshalb
     stehen die engeren Formulierungen oben. */
  { art: 'abbrechen', re: /^\/abbrechen|^(abbrechen|abbruch|vergiss es|lass gut sein)\b/i },
  { art: 'stop',      re: /^\/stop\b/i },
  { art: 'hilfe',     re: /^\/(hilfe|help|start)\b|^(was kannst du|hilfe|wie funktioniert)\b/i },

  { art: 'liste',     re: /^\/objekte\b/i },
  { art: 'liste',     re: /\b(liste|auflisten|auflistung|uebersicht|übersicht|zeig( mir)? (alle|meine)|welche objekte|alle objekte)\b/i },

  { art: 'portfolio', re: /^\/portfolio\b/i },
  { art: 'portfolio', re: /\b(portfolio|verm(ö|oe)gensbilanz|verm(ö|oe)gen|gesamtbilanz|alle zusammen|insgesamt|in (f(ü|ue)nf|zehn|5|10) jahren)\b/i },

  { art: 'anlegen',   re: /^\/neu\b/i },
  { art: 'anlegen',   re: /\b(leg( mir)?|lege|anlegen|erfassen|aufnehmen|neues objekt|neue immobilie)\b.*\b(objekt|immobilie|wohnung|haus)\b/i },
  { art: 'anlegen',   re: /\b(neues objekt|objekt anlegen|objekt erfassen)\b/i },

  { art: 'marktpreis',re: /^\/marktpreis\b/i },
  { art: 'marktpreis',re: /\b(marktpreis|marktwert|wertindikation|indikation|was ist (es|das|die wohnung|das haus) wert|wieviel ist .* wert)\b/i },

  { art: 'score',     re: /^\/score\b/i },
  { art: 'score',     re: /\b(deal ?score|investor ?deal ?score|ids|bewertung des deals|wie gut ist (der deal|das objekt))\b/i }
];

function erkenne(text) {
  const t = String(text || '').trim();
  if (!t) return { art: 'frei' };
  for (const m of MUSTER) if (m.re.test(t)) return { art: m.art };
  return { art: 'frei' };
}

/* ── Bezug auf die letzte Liste ──────────────────────────────────────────
 *
 * "Objekt 17", "die 3", "nummer 5", "das erste", "das letzte".
 *
 * WICHTIG, und hier liegt die Falle: eine Zahl im Satz ist nicht
 * automatisch eine Listenposition. "wie ist der DSCR bei der Musterstr.
 * 12" enthaelt eine 12, meint aber eine HAUSNUMMER.
 *
 *   > Eine Zahl ohne Bezugswort ist eine Zahl, keine Position. Wer das
 *   > verwechselt, beantwortet die Frage zum falschen Objekt — und merkt
 *   > es nie, weil die Antwort plausibel aussieht.
 *
 * Deshalb zaehlt nur eine Zahl, die ein Bezugswort bei sich hat
 * (objekt/nummer/nr/position/eintrag/das/die) ODER die ganz allein steht
 * ("17").
 */
function bezug(text, liste) {
  if (!liste || !liste.length) return null;
  const t = String(text || '').trim();

  /* nur eine Zahl, sonst nichts */
  const allein = /^\s*(\d{1,3})\s*[.)]?\s*$/.exec(t);
  if (allein) return pos(Number(allein[1]), liste);

  /* Zahl mit Bezugswort davor */
  const mitWort = /\b(objekt|nummer|nr\.?|position|eintrag|punkt)\s*(\d{1,3})\b/i.exec(t);
  if (mitWort) return pos(Number(mitWort[2]), liste);

  /* "die 3", "das 17" — Artikel genuegt als Bezugswort */
  const artikel = /\b(?:das|die|der)\s+(\d{1,3})\b/i.exec(t);
  if (artikel) return pos(Number(artikel[1]), liste);

  /* "das erste", "das letzte", "das zweite" */
  if (/\b(erste|ersten|erstes)\b/i.test(t)) return pos(1, liste);
  if (/\b(letzte|letzten|letztes)\b/i.test(t)) return pos(liste.length, liste);
  const ORD = { zweite: 2, dritte: 3, vierte: 4, fuenfte: 5, 'fünfte': 5,
                sechste: 6, siebte: 7, achte: 8, neunte: 9, zehnte: 10 };
  for (const [w, n] of Object.entries(ORD)) {
    if (new RegExp('\\b' + w + '[nsr]?\\b', 'i').test(t)) return pos(n, liste);
  }
  return null;
}

function pos(n, liste) {
  if (!Number.isFinite(n) || n < 1 || n > liste.length) {
    return { fehler: 'ausserhalb', genannt: n, laenge: liste.length };
  }
  return { id: liste[n - 1], position: n };
}

/* ── Bezieht sich der Satz auf das zuletzt besprochene Objekt? ───────────
 *
 * "und die Miete?", "wie siehts da mit dem Cashflow aus", "davon".
 * Erkennbar daran, dass GAR KEIN Objekt genannt wird und der Satz kurz
 * ist oder mit einem Rueckverweis beginnt. */
/* Ein Satz, der selbst eine Adresse nennt, knuepft nicht an — er wechselt
   das Thema. GEMESSEN beim ersten Entwurf: "was ist mit der parkstr 9"
   galt als Anknuepfung, weil es kurz ist und mit "was" beginnt. Es nennt
   aber ein anderes Objekt.

   > Kurz und fragend heisst nicht "dasselbe Objekt". Wer eine Adresse
   > nennt, meint sie auch.

   Und beim zweiten Anlauf gleich die naechste Falle: `\b(str\.?|...)`
   traf "parkstr" NICHT, weil vor dem "str" keine Wortgrenze steht — es
   klebt am "park". Dieselbe Teilwortfalle wie bei der Objektzuordnung,
   nur andersherum: dort traf `indexOf` zu viel, hier traf `\b` zu wenig.

   Jetzt zwei Faelle: das Strassenwort steht allein ("die Strasse") oder
   es haengt an einem Namen ("parkstr", "Hauptstrasse"). */
const STRASSE_ALLEIN = /\b(str\.|stra(ß|ss)e|weg|allee|platz|gasse|ring|damm|ufer|chaussee)\b/i;
const STRASSE_ANGEHAENGT = /[a-zäöüß]{2,}(str\.?|stra(ß|ss)e|weg|allee|platz|gasse|ring|damm)\b/i;
function STRASSE_IM_SATZ_test(t) {
  return STRASSE_ALLEIN.test(t) || STRASSE_ANGEHAENGT.test(t);
}
const STRASSE_IM_SATZ = { test: STRASSE_IM_SATZ_test };

function knuepftAn(text) {
  const t = String(text || '').trim();
  if (STRASSE_IM_SATZ.test(t)) return false;
  if (/^(und|dazu|davon|dort|da |dabei|auch noch|wie siehts|wie sieht)\b/i.test(t)) return true;
  /* sehr kurze Fragen ohne eigenes Subjekt */
  if (t.length < 30 && /^(was|wie|wann|wieviel|wie viel|welche)\b/i.test(t)) return true;
  return false;
}

module.exports = { erkenne, bezug, knuepftAn };
