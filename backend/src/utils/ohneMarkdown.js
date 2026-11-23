'use strict';
/* utils/ohneMarkdown.js — v4230 · Marcel 23.11.2026: „In der Pilot-Analyse möchte ich keine Antworten
   mit ** haben, das ist unprofessionell.“ Das Modell schreibt trotz Anweisung gelegentlich Markdown.

   rein(text)   Fließtext ohne Auszeichnung: **fett**, ***fett kursiv***, __fett__ → Inhalt,
                Überschriften (# …) → Zeile ohne #, Codezäune ``` weg, Aufzählung „* “ / „• “ → „- “,
                übrig gebliebene ** weg. Nummerierte Listen („1. “) und „- “-Zeilen bleiben als Zeilen
                stehen, das Frontend (js/ki-text.js) macht daraus echte Listen.
                Bewusst NICHT angefasst: einzelne _ und * (snake_case, Fußnoten-Sternchen, „5 * 3“).
   tief(wert)   dasselbe für jeden String in einem Objekt/Array (KI-JSON der Pilot-Analyse).
   antwort(t)   Co-Pilot-Antwort: rein() nur AUSSERHALB des Feldblocks <<<FELDER … FELDER>>>
                (copilot-aenderungen.js liest ihn wörtlich).
   Prüfer: tools/ohne-markdown-pruefen.mjs */

function rein(s) {
  if (typeof s !== 'string' || !s) return s;
  if (s.indexOf('*') < 0 && s.indexOf('__') < 0 && s.indexOf('#') < 0 && s.indexOf('```') < 0 && s.indexOf('•') < 0) return s;
  return s
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^([ \t]*)[*•][ \t]+/gm, '$1- ')
    .replace(/\*\*/g, '');
}

function tief(w, tiefe) {
  tiefe = tiefe || 0;
  if (tiefe > 12 || w == null) return w;
  if (typeof w === 'string') return rein(w);
  if (Array.isArray(w)) return w.map(function (x) { return tief(x, tiefe + 1); });
  if (typeof w === 'object') {
    Object.keys(w).forEach(function (k) { w[k] = tief(w[k], tiefe + 1); });
    return w;
  }
  return w;
}

function antwort(t) {
  if (typeof t !== 'string' || !t) return t;
  var m = t.match(/<<<FELDER[\s\S]*?FELDER>>>/);
  if (!m) return rein(t);
  var i = t.indexOf(m[0]);
  return rein(t.slice(0, i)) + m[0] + rein(t.slice(i + m[0].length));
}

module.exports = { rein: rein, tief: tief, antwort: antwort };
