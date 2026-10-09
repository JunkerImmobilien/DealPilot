/* projektwissen.js — EIN Lader für `bot-wissen.md`, für alle drei Piloten.
 *
 * ══ WARUM ES DIESE DATEI GIBT ════════════════════════════════════════
 *
 * `bot-wissen.md` (186 Zeilen, handgepflegt) beschreibt das Produkt:
 * die beiden Scores, die Begriffe der App, was ein Abruf kostet, wie
 * DealPilot rechnet. Gemessen am 08.10.2026 hatte die Datei **genau
 * einen Leser**: `agentLauf.js`, also den Telegram-Agenten.
 *
 *   Pilot-Analyse   (/ai/analyze)  sah sie NICHT.
 *   Portfolio-Pilot (/ai/copilot)  sah sie NICHT.
 *
 * Folge: der Bot erklärt „Investor Deal Score" aus der gepflegten Datei,
 * die beiden Piloten im Browser aus hartkodierten Prompt-Absätzen. Drei
 * Münder, zwei Quellen — und wer die Datei pflegt, erreicht nur einen.
 *
 *   > Marcel: „Ziel ist, dass der Telegram-Bot auf alle Daten und Felder
 *   > zugreifen kann und auch das gesamte Wissen vom Pilot und
 *   > Cockpit-Analyse bekommt." Das gilt in beide Richtungen: dann muss
 *   > auch das Produktwissen des Bots bei den Piloten ankommen.
 *
 * ══ EIN ORT, KEINE KOPIE ═════════════════════════════════════════════
 *
 * Der Lader stand wörtlich in `agentLauf.js`. Er ist hierher gezogen und
 * wird dort jetzt von hier geholt — nicht abgeschrieben. Eine zweite
 * Fassung desselben Laders wäre genau die Stelle, an der morgen zwei
 * Wissensstände stehen, von denen keiner falsch aussieht.
 *
 * Fehlt die Datei, gibt der Lader den leeren String zurück. Die Regel,
 * die mit dem Block ausgeliefert wird, verbietet dann jede
 * Produktaussage: lieber ein Pilot, der „weiss ich nicht" sagt, als
 * einer, der rät.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/* Im Image liegt die Datei neben dem Code als /app/bot-wissen.md
   (Dockerfile:32), lokal als backend/bot-wissen.md — derselbe relative
   Weg von hier aus. */
const WISSEN_PFAD = path.join(__dirname, '..', '..', 'bot-wissen.md');

let _wissen = null;

/** Der Text des Projektwissens, ohne den Pflegekopf. '' wenn nicht lesbar. */
function wissen() {
  if (_wissen !== null) return _wissen;
  try {
    const t = fs.readFileSync(WISSEN_PFAD, 'utf8');
    /* Der Kopf der Datei richtet sich an Marcel, nicht an das Modell —
       alles bis zum ersten `---` ist Anleitung zum Pflegen. */
    const i = t.indexOf('\n---\n');
    _wissen = (i > 0 ? t.slice(i + 5) : t).trim();
  } catch (e) {
    _wissen = '';
    try { console.warn('[projektwissen] nicht lesbar: ' + WISSEN_PFAD); } catch (_) {}
  }
  return _wissen;
}

/* Die Einleitung steht hier und nicht bei den Aufrufern: sie ist die
   Bedingung, unter der der Block gilt, und die muss überall dieselbe
   sein. */
const EINLEITUNG =
  'PROJEKTWISSEN DEALPILOT. Das Folgende ist die EINZIGE Quelle für '
  + 'Aussagen über das Produkt, seine Begriffe und seine Kennzahlen. '
  + 'Steht eine Antwort hier nicht drin und liefert sie auch kein '
  + 'Werkzeug, sagst du das — du erfindest KEINE Erklärung für einen '
  + 'DealPilot-Begriff.';

/** Fertiger Prompt-Block inkl. Einleitung. '' wenn kein Wissen da ist. */
function block() {
  const w = wissen();
  return w ? (EINLEITUNG + '\n\n' + w) : '';
}

/** Für Prüfwerkzeuge: ist das Wissen überhaupt ladbar? */
function vorhanden() { return wissen().length > 0; }

/** Nur für Tests — den Zwischenspeicher verwerfen. */
function _neuLaden() { _wissen = null; return wissen(); }

module.exports = { wissen, block, vorhanden, EINLEITUNG, WISSEN_PFAD, _neuLaden };
