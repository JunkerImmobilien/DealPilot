/* js/ki-text.js — v4230 · KI-Text ohne Markdown anzeigen
   Marcel 23.11.2026: „In der Pilot-Analyse möchte ich keine Antworten mit ** haben, das ist unprofessionell.“
   Gemessen: der Co-Pilot (copilot.js addMsg) zeigte die Antwort mit esc() + <br>, also ** und „1. “-Listen roh.
   Der Server säubert neue Antworten (backend/src/utils/ohneMarkdown.js), dieser Helfer fängt alles ab, was
   schon gespeichert ist oder doch durchrutscht.

   DpKiText.rein(text)  reiner Text ohne Auszeichnung (für Stellen, die nur Text können)
   DpKiText.html(text)  sicheres HTML: erst escapen, dann **fett** → <b>, „- “/„• “/„* “-Zeilen → <ul>,
                        „1. “-Zeilen → <ol>, Überschriften (# …) → fette Zeile, Rest mit <br>.
   Prüfer: tools/ohne-markdown-pruefen.mjs (lädt diese Datei echt). */
(function (global) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function rein(s) {
    if (s == null) return '';
    return String(s)
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/__([^_\n]+)__/g, '$1')
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      .replace(/^([ \t]*)[*•][ \t]+/gm, '$1- ')
      .replace(/\*\*/g, '');
  }

  /* Inline: auf bereits ESCAPTEM Text, nur ** → <b>, Reste weg */
  function inline(e) {
    return e
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<b>$1</b>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/__([^_\n]+)__/g, '<b>$1</b>')
      .replace(/`([^`\n]+)`/g, '$1')
      .replace(/\*\*/g, '');
  }

  function html(s) {
    if (s == null || s === '') return '';
    var zeilen = String(s).replace(/\r\n?/g, '\n').replace(/```[a-zA-Z]*\n?/g, '').split('\n');
    var out = [], liste = null, absatz = [];
    function absatzZu() { if (absatz.length) { out.push(absatz.join('<br>')); absatz = []; } }
    function listeZu() { if (liste) { out.push('<' + liste.art + ' class="dp-ki-liste">' + liste.p.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</' + liste.art + '>'); liste = null; } }
    zeilen.forEach(function (z) {
      var t = z.trim(), m;
      if (!t) { listeZu(); absatzZu(); return; }
      if ((m = t.match(/^#{1,6}\s+(.*)$/))) { listeZu(); absatzZu(); out.push('<b>' + inline(esc(m[1])) + '</b>'); return; }
      if ((m = t.match(/^[-*•]\s+(.*)$/))) { absatzZu(); if (!liste || liste.art !== 'ul') { listeZu(); liste = { art: 'ul', p: [] }; } liste.p.push(inline(esc(m[1]))); return; }
      if ((m = t.match(/^(\d{1,2})[.)]\s+(.*)$/))) { absatzZu(); if (!liste || liste.art !== 'ol') { listeZu(); liste = { art: 'ol', p: [] }; } liste.p.push(inline(esc(m[2]))); return; }
      listeZu(); absatz.push(inline(esc(t)));
    });
    listeZu(); absatzZu();
    return out.join('<br>').replace(/<br>(<[uo]l)/g, '$1').replace(/(<\/[uo]l>)<br>/g, '$1');
  }

  function stil() {
    try {
      if (!global.document || document.getElementById('dp-ki-text-stil')) return;
      var st = document.createElement('style'); st.id = 'dp-ki-text-stil';
      st.textContent = '.dp-ki-liste{margin:4px 0 4px 18px;padding:0}.dp-ki-liste li{margin:2px 0}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }
  stil();
  global.DpKiText = { rein: rein, html: html, VERSION: 'v4230' };
})(typeof window !== 'undefined' ? window : globalThis);
