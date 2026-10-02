'use strict';
/* services/agentLauf.js — die Schleife (v1801)
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
const config = require('../config');
const werkzeuge = require('./agentWerkzeuge');

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const RUNDEN_MAX = 6;
const FRIST_MS = 90000;

const SYSTEM =
  'Du bist der DealPilot-Copilot: ein Agent fuer das Immobilienportfolio eines '
+ 'Investors. Du antwortest auf Deutsch, im Du, knapp und konkret.\n\n'
+ 'DEINE REGELN:\n'
+ '1. ZAHLEN ERFINDEST DU NIE. Jede Kennzahl kommt aus einem Werkzeug. Hast du '
+ 'sie nicht, sagst du das und nennst den Weg dorthin.\n'
+ '2. Summen und Ableitungen ueber das Portfolio bildest du NUR aus den Zahlen, '
+ 'die portfolio_lesen geliefert hat. Rechne offen vor, wenn du addierst.\n'
+ '3. Du rechnest KEINE Scores, Renditen oder Prognosen selbst. Die kommen aus '
+ 'DealPilot und stehen in den Werkzeugergebnissen.\n'
+ '4. Nennt eine Portfolio-Antwort Zahlen, nennst du IMMER den Stand dazu — er '
+ 'steht im Ergebnis von portfolio_lesen.\n'
+ '5. Bevor du etwas aenderst oder abrufst, das Geld kostet, fragst du. Bei '
+ 'Bewertungen immer zuerst marktbericht_preis, dann fragen, dann abrufen.\n'
+ '6. Was ein Werkzeug als "hinweis" zurueckgibt, befolgst du.\n'
+ '7. Du fragst hoechstens EINE Sache auf einmal.\n'
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

  const eingabe = [];
  eingabe.push({ role: 'system', content: SYSTEM });

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
          ergebnis = { fehler: String(e.message || e) };
        }
      }
      if (ctx.protokoll) ctx.protokoll.push({ werkzeug: a.name, stufe: w ? w.stufe : '?' });
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
