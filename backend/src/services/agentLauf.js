'use strict';
/* services/agentLauf.js — die Schleife (v1813)
 *
 * Marcels Kette (Spezifikation Punkt 9):
 *
 *   Eingabe -> Absicht -> Entitaeten -> Kontext laden -> vorhandene Daten
 *   -> fehlende bestimmen -> Berechnung/Aktion planen -> ausfuehren
 *   -> Ergebnis pruefen -> verstaendlich antworten
 *
 * Umgesetzt als Werkzeugschleife: das Modell bekommt die Frage und den
 * Werkzeugkasten, waehlt selbst, was es braucht, bekommt die Ergebnisse
 * und antwortet. Mehrere Runden, bis es fertig ist.
 *
 * ── WARUM KEIN DATENBANK-DUMP ────────────────────────────────────────────
 *
 * Man koennte dem Modell einfach alles mitgeben: 17 Objekte, jedes mit 200
 * Feldern. Marcel hat selbst geschrieben, warum das falsch ist:
 *
 *   > "Dabei sollte die KI nicht mit einem unnoetig grossen ungefilterten
 *   > Datenbank-Dump versorgt werden."
 *
 * Und der Grund ist nicht nur der Preis:
 *
 *   > Je mehr Unwichtiges im Kontext steht, desto oefter antwortet ein
 *   > Modell auf das Unwichtige. Ein Dump macht den Agenten nicht klueger,
 *   > sondern beliebiger.
 *
 * Deshalb holt das Modell sich, was es braucht — und nur das.
 *
 * ── DIE OBERGRENZE ───────────────────────────────────────────────────────
 *
 * Hoechstens RUNDEN_MAX Werkzeugrunden. Ein Modell, das sich im Kreis
 * dreht, dreht sich sonst auf Marcels Rechnung.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const werkzeuge = require('./agentWerkzeuge');

/* ── v1817 · DAS PROJEKTWISSEN ──────────────────────────────────────────
 *
 * GEMESSEN am 04.10.2026 mit fünf echten Wissensfragen: der Agent konnte
 * Fragen zu DATEN beantworten und erfand Antworten auf Fragen zum PRODUKT.
 *
 *   "Was ist QuickBoarding?"
 *   -> "ein kurzer und effizienter Prozess zur schnellen Einarbeitung
 *       neuer Nutzer oder Mitarbeiter"
 *
 * QuickBoarding ist das Teilen eines Objekts per Link und QR-Code. Drei von
 * fünf Antworten waren frei erfunden, und alle drei klangen plausibel.
 *
 *   > Eine erfundene Erklaerung klingt wie eine echte. Sie ist schwerer zu
 *   > entdecken als eine Luecke — der Nutzer glaubt sie und merkt nie,
 *   > dass er sie glaubt.
 *
 * Das Wissen steht in `backend/bot-wissen.md`, NICHT hier im Code: Marcel
 * soll es selbst pflegen koennen. Geaendert wird die Datei, neu gestartet
 * das Backend, fertig.
 *
 * ZAHLEN STEHEN NICHT DRIN. Preise und Kontingente kommen aus Werkzeugen,
 * die die echte Quelle lesen. Ein Preis in einer Wissensdatei waere die
 * fuenfte Stelle, an der ein Preis steht — und damit irgendwann die
 * falsche. (Gemessen: config.js, plans, Billing-Portal, .env.)
 */
/* Im Container ist __dirname /app/src/services, also liegt die Datei bei
   /app/bot-wissen.md. Lokal ist es backend/bot-wissen.md — derselbe
   relative Weg. EIN Ort, keine Kopie: eine handgepflegte Datei zweimal zu
   haben heisst, sie laeuft auseinander. */
/* v2010 - HIER STAND DER LADER. Er ist nach services/projektwissen.js
   gezogen, weil er jetzt DREI Leser hat: diesen Agenten, die
   Pilot-Analyse und den Portfolio-Piloten. Gemessen hatte
   bot-wissen.md bis v2010 genau EINEN - die beiden Piloten im
   Browser trugen ihr Produktwissen hartkodiert im Prompt.
   Abgeschrieben wird er nicht: zwei Lader heisst zwei
   Wissensstaende, von denen keiner falsch aussieht. */
const projektwissen = require('./projektwissen');
const wissen = projektwissen.wissen;

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const RUNDEN_MAX = 6;

/* ── v1813c · EINE FRIST AUF DEN RUNDEN IST KEINE FRIST AUF DEM GANZEN ──
 *
 * RUNDEN_MAX begrenzt die Runden, nicht die Aufrufe: in einer Runde darf
 * das Modell beliebig viele Werkzeuge rufen. GEMESSEN am 03.10.2026: auf
 * "wie kann ich meinen Cashflow steigern" rief es `cashflow_hebel`
 * ACHTZEHNMAL — innerhalb der sechs erlaubten Runden, also ohne dass
 * irgendeine Grenze ansprach.
 *
 *   > Eine Grenze auf jedem Einzelschritt ergibt keine Grenze auf dem
 *   > Ganzen. (Dieselbe Lehre wie bei den Fristen, zum zweiten Mal.)
 *
 * Ab AUFRUFE_MAX wird nichts mehr ausgefuehrt; das Modell bekommt statt
 * eines Ergebnisses die Ansage, mit dem zu antworten, was es hat. Lieber
 * eine Teilantwort als eine Schleife auf Marcels Rechnung. */
const AUFRUFE_MAX = 14;
const FRIST_MS = 90000;

const SYSTEM =
  'Du bist der DealPilot-Copilot: ein Agent fuer das Immobilienportfolio eines '
+ 'Investors. Du antwortest auf Deutsch, im Du, knapp und konkret.\n\n'
+ 'DEINE REGELN:\n'
+ '1. ZAHLEN ERFINDEST DU NIE. Jede Kennzahl kommt aus einem Werkzeug. Hast du '
+ 'sie nicht, sagst du das und nennst den Weg dorthin.\n'
+ '2. Summen und Ableitungen ueber das Portfolio bildest du NUR aus Zahlen, die '
+ 'ein Werkzeug geliefert hat — portfolio_lesen, objekte_rangliste oder '
+ 'objekt_kennzahlen. Rechne offen vor, wenn du addierst.\n'
+ '3. Du rechnest KEINE Scores, Renditen, Prognosen und keine '
+ 'Was-waere-wenn-Rechnungen selbst. Die kommen aus DealPilot und stehen in den '
+ 'Werkzeugergebnissen; fuer Hebel und ihre Wirkung gibt es cashflow_hebel.\n'
+ '4. Nennt eine Portfolio-Antwort Zahlen, nennst du IMMER den Stand dazu — er '
+ 'steht im Ergebnis von portfolio_lesen.\n'
+ '5. Bevor du etwas aenderst oder abrufst, das Geld kostet, fragst du. Bei '
+ 'Bewertungen immer zuerst marktbericht_preis, dann fragen, dann abrufen.\n'
+ '6. Was ein Werkzeug als "hinweis" zurueckgibt, befolgst du.\n'
+ '7. Du fragst hoechstens EINE Sache auf einmal.\n'
+ '7a. FRAGEN UEBER MEHRERE OBJEKTE ("welche Objekte haben ...", "wie viele '
+ 'sind ...", "bei welchen laeuft ...") beantwortest du mit EINEM Aufruf von '
+ 'objekte_felder — nie, indem du Objekte einzeln liest. Kennst du den '
+ 'Feldnamen nicht, frag zuerst feld_katalog mit einem Suchwort.\n'
+ '7b. Steht ein Feld bei vielen Objekten LEER, sagst du das — ein leeres '
+ 'Feld ist keine Antwort, sondern eine Luecke.\n'
+ '7c. Fragen nach GERECHNETEN Zahlen EINES Objekts (Cashflow, Score, DSCR, '
+ 'LTV, Rendite, Restschuld) beantwortest du mit objekt_kennzahlen — NICHT '
+ 'mit portfolio_lesen. Die Objekte dort tragen keine Nummer, und die '
+ 'Nummer aus der Chat-Liste gilt dort nicht.\n'
+ '7d. "Was sind meine besten ...", "welches laeuft am besten", "wo ist die '
+ 'Rendite am hoechsten" -> objekte_rangliste, OHNE vorher nach der Kennzahl '
+ 'zu fragen: das Werkzeug liefert Score, Cashflow und Rendite nebeneinander. '
+ 'Nenne in der Antwort IMMER, nach welcher Kennzahl du geordnet hast — '
+ '"beste" ist keine Kennzahl, und wer das weglaesst, laesst eine Entscheidung '
+ 'wie eine Tatsache aussehen.\n'
+ '7e. "Zeig mir die Felder", "was steht da alles drin" -> '
+ 'objekt_felder_liste. Gib Bezeichnungen, nie interne Feldnamen.\n'
+ '7f. "Wie kann ich meinen Cashflow steigern / optimieren" -> '
+ 'cashflow_hebel_portfolio (fuer den Bestand) oder cashflow_hebel (nur wenn '
+ 'der Nutzer EIN Objekt nennt). Du antwortest NIE aus allgemeinem Wissen: '
+ 'ohne dieses '
+ 'Werkzeug hast du keine Zahlen dazu, und allgemeine Ratschlaege ("Miete '
+ 'erhoehen, Kosten senken") helfen bei keinem Portfolio. Jeder Hebel kommt '
+ 'mit seiner Wirkung in Euro UND seiner Einschraenkung — nenne beide, nie '
+ 'nur die eine.\n'
+ '7h. Parameter, deren Wert du nicht hast, LAESST DU WEG. Erfinde keine '
+ 'Nummer, keine UUID und keine Adresse, um ein Feld zu fuellen — ein '
+ 'erfundener Objektbezug zeigt auf ein echtes, falsches Haus.\n'
+ '7g. Gilt eine Antwort EINEM Objekt, nennst du es beim Namen — Adresse '
+ 'oder Nummer. Eine Zahl ohne Objekt kann der Nutzer nicht nachpruefen, und '
+ 'genau daran ist schon eine Auskunft zum falschen Haus unbemerkt geblieben.\n'
+ '7j. "Ist das ein guter Deal", "was haeltst du davon", "lohnt sich das" und '
+ 'der Augenblick NACH dem Anlegen -> objekt_schnellblick. Er kostet nichts. '
+ 'Gib die Zahlen MIT Rechenweg weiter, sag ausdruecklich, dass es noch kein '
+ 'Score ist, und behaupte aus drei Kennzahlen KEINE Kaufempfehlung — sie '
+ 'reichen fuer eine Richtung, nicht fuer ein Urteil. Sagt das Ergebnis, dass '
+ 'keine Vorgaben hinterlegt sind, frag EINMAL nach Zinssatz, Tilgung und '
+ 'Eigenkapitalquote und lege sie mit vorgaben_setzen ab. Danach nie wieder. '
+ 'Zum Schluss biete die Marktpreisindikation an und sag, dass sie einen '
+ 'Abruf kostet.\n'
+ '7i. PRODUKTFRAGEN beantwortest du NUR aus dem Projektwissen, das dir als '
+ 'eigener Block mitgegeben wird. Fragen nach Preisen und Paketen gehen an '
+ 'pakete_und_preise — niemals aus dem Gedaechtnis, der Preis steht in der '
+ 'Datenbank. Steht die Antwort nirgends, sagst du das und nennst den Weg '
+ '(in der App nachsehen, Marcel fragen). Eine erfundene Erklaerung fuer '
+ 'einen DealPilot-Begriff klingt wie eine echte und ist damit schlimmer '
+ 'als eine Luecke.\n'
/* ══ v2016 · WAS IN EINER AUSKUNFT IMMER DRINSTEHT ══════════════════

   Marcels Vorgabe woertlich: "Wenn ich nach wichtigen Daten frage,
   moechte ich immer, wenn verfuegbar, DealScore und Investor DealScore
   sowie alle beteiligten KPIs haben und eine textuelle
   Gesamtbewertung. … Wenn moeglich auch immer den Stand nennen."

   Die Werkzeuge liefern beide Scores laengst - in den Regeln stand
   nirgends, dass sie auch GENANNT werden muessen. Derselbe Fehler wie
   bei den Fotos: die Daten reisen mit, und ohne Auftrag passiert
   nichts damit. In Marcels Telegram-Bildern sieht man es: auf "gib mir
   alle Daten zur Parkstr" kommt eine lange Feldliste und kein Score. */
+ '7k. BEI JEDER AUSKUNFT ZU EINEM OBJEKT ODER ZUM BESTAND gehoeren vier '
+ 'Dinge in die Antwort, sobald sie verfuegbar sind:\n'
+ '    (a) BEIDE Scores: DealScore und Investor Deal Score, jeweils mit '
+ 'ihrer Stufe. Fehlt einer, sage WARUM er fehlt (meist: Angaben fehlen) '
+ 'statt ihn wegzulassen.\n'
+ '    (b) Die Kennzahlen, die dazugehoeren: Bruttomietrendite, '
+ 'Kaufpreisfaktor, Cashflow, DSCR, LTV. Nicht alle auf einmal vorlesen - '
+ 'die, die zur Frage passen, und bei "alle Daten" alle.\n'
+ '    (c) EINE Gesamtbewertung in Worten. Zahlen allein sind keine '
+ 'Auskunft: sag in zwei bis drei Saetzen, was sie zusammen bedeuten.\n'
+ '    (d) Den STAND: woher die Zahl kommt und wann sie entstand. Eine '
+ 'Pilot-Analyse von vor sechs Wochen sieht genauso aus wie eine von '
+ 'heute - der Unterschied steht nur im Datum. Liefert ein Werkzeug ein '
+ 'Stand-Feld, nenne es.\n'
+ '    Das gilt fuer "gib mir alle Daten zu X" genauso wie fuer "wie '
+ 'laeuft mein Portfolio". Es gilt NICHT, wenn der Nutzer ausdruecklich '
+ 'nur EINE Zahl will ("wie hoch ist die Miete") - dann antworte kurz.\n'
+ '7l. Fragt jemand nach der EINSCHAETZUNG des Gesamtbestands, nach '
+ 'Klumpenrisiken oder "was soll ich als naechstes tun", hole die '
+ 'gespeicherte Cockpit-Analyse mit portfolio_analyse_lesen und NENNE '
+ 'IHREN STAND. Fuer reine Zahlen nimm portfolio_lesen. Liegt keine '
+ 'Analyse vor, sage das und erfinde keine eigene Gesamtbeurteilung.\n'
+ '8. Keine Floskeln, keine Wiederholung der Frage. Antworte direkt.\n'
+ '9. ALLE Geldbetraege sind GANZE EURO, niemals Cent. 4721579 ist '
+ '"4.721.579 EUR", nicht "47.215,79". Du verschiebst kein Komma und '
+ 'rechnest nicht um. Felder mit "_eur" sind Euro, "_prozent" sind Prozent.\n'
+ '10. Fragt jemand nach den HOECHSTEN oder NIEDRIGSTEN, sortierst du und '
+ 'nennst die Reihenfolge richtig.\n\n'
+ 'FORMAT: Telegram-Markdown. *fett* fuer Zahlen und Namen, _kursiv_ fuer '
+ 'Nebenbemerkungen. Keine Ueberschriften, keine Tabellen.';

async function _ruf(body, apiKey) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FRIST_MS);
  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const txt = await r.text();
      const e = new Error('OpenAI ' + r.status + ': ' + txt.slice(0, 300));
      e.status = r.status;
      throw e;
    }
    return await r.json();
  } finally { clearTimeout(t); }
}

/* Die Responses-API gibt Text und Funktionsaufrufe im selben `output`. */
function _zerlege(data) {
  let text = '';
  const aufrufe = [];
  if (Array.isArray(data.output)) {
    for (const it of data.output) {
      if (it.type === 'function_call') {
        aufrufe.push({ name: it.name, args: it.arguments, call_id: it.call_id, roh: it });
      } else if (it.type === 'message' && Array.isArray(it.content)) {
        for (const c of it.content) if (c.type === 'output_text' && c.text) text += c.text;
      }
    }
  }
  if (!text && data.output_text) text = data.output_text;
  return { text: String(text || '').trim(), aufrufe };
}

/* ── Der Lauf ────────────────────────────────────────────────────────────
 *
 * ctx traegt: userId, letzteListe, letztesObjekt, merkeObjekt(id),
 *             merkeListe(ids), protokoll (Array, wird gefuellt)
 */
async function laufen(frage, ctx, opts) {
  const o = opts || {};
  const apiKey = config.openai.apiKey || o.userApiKey;
  if (!apiKey) { const e = new Error('Kein OpenAI-Key verfuegbar.'); e.code = 'NO_API_KEY'; throw e; }

  /* ── v1927 · DER SCHLUESSEL GEHOERT IN DEN KONTEXT ───────────────────
   * Seit v1927 ruft ein Werkzeug selbst das Modell: `objekt_schnellblick`
   * holt die KI-Einordnung zur gerechneten Bewertung. Es muss denselben
   * Schluessel nehmen wie dieser Lauf — sonst laeuft die Einordnung ueber
   * den Server-Key, waehrend der Dialog ueber den persoenlichen Key
   * laeuft, und der Nutzer bezahlt die eine Haelfte seiner Antwort selbst
   * und die andere nicht. */
  if (o.userApiKey && !ctx.userApiKey) ctx.userApiKey = o.userApiKey;

  const eingabe = [];
  eingabe.push({ role: 'system', content: SYSTEM });

  /* v1817 · Das Projektwissen als eigener Block NACH den Regeln und VOR
     der Lage. Beide sind über alle Anfragen gleich, das ist für den
     Prompt-Cache die richtige Reihenfolge: stabil zuerst. */
  const _w = wissen();
  if (_w) {
    eingabe.push({ role: 'system', content:
      'PROJEKTWISSEN DEALPILOT. Das Folgende ist die EINZIGE Quelle für '
      + 'Aussagen über das Produkt, seine Begriffe und seine Kennzahlen. '
      + 'Steht eine Antwort hier nicht drin und liefert sie auch kein '
      + 'Werkzeug, sagst du das — du erfindest KEINE Erklärung für einen '
      + 'DealPilot-Begriff.\n\n' + _w });
  }

  /* Was der Agent ueber die Lage wissen muss, OHNE ein Werkzeug zu rufen —
     drei Zeilen, kein Dump. */
  const lage = [];
  if (ctx.letzteListe && ctx.letzteListe.length) {
    lage.push('Dem Nutzer wurde zuletzt eine nummerierte Liste mit '
      + ctx.letzteListe.length + ' Objekten gezeigt. "Nummer N" bezieht sich darauf.');
  }
  if (ctx.letztesObjekt) {
    lage.push('Zuletzt ging es um ein bestimmtes Objekt; ohne andere Angabe ist das gemeint.');
  }
  if (ctx.entwurf && Object.keys(ctx.entwurf).length) {
    lage.push('Es laeuft gerade eine Objektanlage. Bisher bekannt: '
      + JSON.stringify(ctx.entwurf) + '. Frage NICHTS davon erneut.');
  }
  if (lage.length) eingabe.push({ role: 'system', content: 'LAGE: ' + lage.join(' ') });

  (o.verlauf || []).slice(-10).forEach((e) => {
    eingabe.push({ role: e.rolle === 'user' ? 'user' : 'assistant', content: String(e.text || '') });
  });
  eingabe.push({ role: 'user', content: String(frage || '') });

  const tools = werkzeuge.fuerModell();
  let letzterText = '';

  for (let runde = 0; runde < RUNDEN_MAX; runde++) {
    const data = await _ruf({
      model: o.model || config.openai.defaultModel,
      input: eingabe,
      tools: tools,
      max_output_tokens: 4000
    }, apiKey);

    const { text, aufrufe } = _zerlege(data);
    if (text) letzterText = text;

    if (!aufrufe.length) {
      return { text: letzterText, runden: runde + 1, protokoll: ctx.protokoll };
    }

    /* Die Aufrufe des Modells muessen in die Eingabe zurueck, sonst
       versteht die naechste Runde die Ergebnisse nicht. */
    for (const a of aufrufe) eingabe.push(a.roh);

    for (const a of aufrufe) {
      const w = werkzeuge.finde(a.name);
      let ergebnis;
      const bisher = (ctx.protokoll || []).length;
      if (bisher >= AUFRUFE_MAX) {
        ergebnis = { ok: false, abgeschnitten: true,
          hinweis: 'Du hast in diesem Lauf schon ' + bisher + ' Werkzeuge gerufen. '
                 + 'Es wird nichts mehr ausgefuehrt. Antworte JETZT mit dem, was du '
                 + 'hast, und sag ehrlich, was du nicht pruefen konntest.' };
        if (ctx.protokoll) ctx.protokoll.push({ werkzeug: a.name, stufe: 'gesperrt' });
        eingabe.push({ type: 'function_call_output', call_id: a.call_id,
          output: JSON.stringify(ergebnis) });
        continue;
      }
      if (!w) {
        ergebnis = { fehler: 'Unbekanntes Werkzeug: ' + a.name };
      } else if (w.stufe === 'kostet' && !o.darfKosten) {
        /* DIE SPERRE SITZT HIER, NICHT IM PROMPT. Ein Modell, das man
           bittet vorher zu fragen, fragt meistens — und einmal nicht. */
        ergebnis = { ok: false, gesperrt: true,
          hinweis: 'Dieser Abruf kostet Guthaben und wurde NICHT ausgefuehrt. '
                 + 'Nenne dem Nutzer den Preis (marktbericht_preis) und frage, '
                 + 'ob er ihn abrufen soll.' };
      } else {
        try {
          const args = a.args ? JSON.parse(a.args) : {};
          ergebnis = await w.fn(ctx, args);
        } catch (e) {
          /* v1809 · Mehrdeutigkeit ist ein Ergebnis, kein Fehler. Die
             Kandidaten gehen ans Modell, damit es nachfragen kann — und
             die Liste ist bereits gemerkt, also funktioniert "die zweite"
             danach. */
          if (e && e.mehrdeutig) {
            ergebnis = { ok: false, rueckfrage: true, kandidaten: e.mehrdeutig,
              grund: e.grund || undefined,
              hinweis: 'Mehrere Objekte passen. Zeige dem Nutzer die nummerierte '
                     + 'Liste und frage, welches er meint. NICHTS ausfuehren.' };
          } else {
            ergebnis = { fehler: String(e.message || e) };
          }
        }
      }
      /* v1813c · MIT ARGUMENTEN. Als der Agent `cashflow_hebel` achtzehnmal
         rief, stand im Protokoll achtzehnmal derselbe Name — und nicht,
         WOMIT. Jede Ursachenvermutung war damit geraten.

           > Ein Protokoll, das nur das Werkzeug nennt, sagt nicht, was
           > getan wurde. */
      if (ctx.protokoll) {
        ctx.protokoll.push({ werkzeug: a.name, stufe: w ? w.stufe : '?',
          args: String(a.args || '').slice(0, 160) });
      }
      eingabe.push({
        type: 'function_call_output',
        call_id: a.call_id,
        output: JSON.stringify(ergebnis).slice(0, 24000)
      });
    }
  }

  /* Obergrenze erreicht: lieber eine ehrliche Teilantwort als eine
     Schleife, die auf Marcels Rechnung laeuft. */
  return {
    text: letzterText || 'Das war mir zu verwickelt — frag mich bitte etwas gezielter.',
    runden: RUNDEN_MAX, abgebrochen: true, protokoll: ctx.protokoll
  };
}

module.exports = { laufen, SYSTEM, RUNDEN_MAX };
