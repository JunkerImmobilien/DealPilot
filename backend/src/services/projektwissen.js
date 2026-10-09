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

/* ══ v2019 · DIE ERGÄNZUNGEN DES BETREIBERS ══════════════════════

   Marcel: „ist das irgendwo zugänglich, diese Datei? Dass man da
   auch was noch zuschreiben könnte."

   Bis v2019: nein. `bot-wissen.md` liegt im Repo und im Image —
   ändern hieß committen, ausrollen, neu starten. Der Kopf der Datei
   behauptet „Marcel kann sie selbst ändern"; das stimmt nur mit
   Repo-Zugang.

   Jetzt kommt ein ZWEITER Block dazu, den er in den Einstellungen
   pflegt. **Getrennt überschrieben**, nicht eingemischt: der erste
   Block trägt die Zusage „die EINZIGE Quelle für Aussagen über das
   Produkt", und jeder Satz darin ist am Code belegt. Freien Text
   unbesehen dazwischenzumischen hieße, diese Zusage auf etwas
   auszudehnen, das niemand gegengelesen hat.

   Die Warnung des Dateikopfs gilt für die Ergänzung genauso und
   steht deshalb im Block: keine Zahlen, die sich ändern. */
const ERGAENZUNG_KOPF =
  'ERGÄNZUNGEN DES BETREIBERS. Das Folgende hat Marcel selbst ergänzt — es gilt zusätzlich zum Projektwissen oben. Widerspricht es dem Block darüber, gilt der Block darüber, und du sagst, dass sich beides widerspricht. Enthält es eine Zahl, die sich ändern kann (Preis, Kontingent, Kennzahl), nennst du sie NICHT aus diesem Text, sondern holst sie über das zuständige Werkzeug.';

/* v2019b - DER ZUSATZ WIRD HIER GELESEN, NICHT DREIMAL.

   Alle drei Piloten brauchen dieselbe Abfrage. Sie steht deshalb
   einmal hier. Kurzer Zwischenspeicher (60 s), weil der
   Telegram-Agent sie je Runde braucht und eine Wissensdatei sich
   nicht im Sekundentakt aendert.

   Faellt die Abfrage aus, gibt es den Zusatz eben nicht - der
   Basisblock steht trotzdem. Ein Pilot ohne Ergaenzung ist besser
   als ein Pilot ohne Wissen. */
const _zCache = new Map();
const Z_TTL_MS = 60 * 1000;
async function zusatzFuer(userId) {
  if (!userId) return '';
  const t = _zCache.get(String(userId));
  if (t && (Date.now() - t.zeit) < Z_TTL_MS) return t.text;
  let text = '';
  try {
    const { query } = require('../db/pool');
    const r = await query(
      'SELECT wert FROM user_settings WHERE user_id = $1 AND schluessel = $2',
      [userId, 'eigenes_wissen']
    );
    const w = r.rowCount ? r.rows[0].wert : null;
    if (w && typeof w.text === 'string') text = w.text.trim().slice(0, 20000);
  } catch (e) { try { console.warn('[projektwissen] Zusatz nicht lesbar: ' + e.message); } catch (_) {} }
  _zCache.set(String(userId), { text, zeit: Date.now() });
  return text;
}
/** Der fertige Block inkl. Ergaenzung des Nutzers. */
async function blockFuer(userId) { return blockMit(await zusatzFuer(userId)); }

/** Der vollständige Wissensblock inkl. Ergänzung. `zusatz` ist der
 *  freie Text aus den Einstellungen (oder null). */
function blockMit(zusatz) {
  const basis = block();
  const z = (typeof zusatz === 'string') ? zusatz.trim() : '';
  if (!z) return basis;
  const erg = ERGAENZUNG_KOPF + '\n\n' + z;
  return basis ? (basis + '\n\n' + erg) : erg;
}

module.exports = { wissen, block, blockMit, blockFuer, zusatzFuer, vorhanden,
                   EINLEITUNG, ERGAENZUNG_KOPF, WISSEN_PFAD, _neuLaden };
