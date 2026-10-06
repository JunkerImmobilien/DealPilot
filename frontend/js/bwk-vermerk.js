'use strict';
/* ════════════════════════════════════════════════════════════════════
   bwk-vermerk.js — v1895
   „Text hinter, wenn pauschal" (Marcel, 06.10.2026)

   Jeder Bewirtschaftungsposten, den DealPilot geschaetzt hat, traegt am
   Formular einen Satz, den ein Kunde versteht. Vorher stand dort eine
   Zahl wie jede andere — der Nutzer konnte nicht unterscheiden, was von
   ihm stammt und was das System angesetzt hat.

   WOHER DIE HERKUNFT KOMMT: der Sprechlauf schreibt sie beim Abschluss
   nach `_dp_herkunft` (voice-import.js `_herkunftMerken`, Feld in
   storage.js FIELDS). Von dort geht sie auch in die Pilot-Analyse
   (ui.js:783). Dieses Modul LIEST nur — es setzt keine Werte und rechnet
   nichts. Die Zahlen stehen in den Feldern und werden von calc.js
   gerechnet; eine zweite Rechnung hier waere eine Kopie des Rechenkerns.

   EIGENES CSS, EIGENE DATEI: `frontend/css/style.css` gehoert in dieser
   Sitzung einem anderen Strang. Die Regeln stehen deshalb hier inline und
   tragen alle den Praefix `dpbv-`.

   KEIN `||`-FALLBACK AUF FORMATIERTE WERTE: ein `_euro(null)` ergaebe
   „–" und waere truthy. Hier wird ausschliesslich auf ABWESENHEIT
   geprueft (`== null`, Leerstring), nie auf Falsiness.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotBwkVermerk) return;

  var MARKE = 'dpbv-v1895';

  /* Die sieben Posten des Detail-Modus, in der Reihenfolge des Formulars.
     Pfadbasiert: die IDs stehen in index.html:2911-2921 und sind dieselben,
     die voice-import.js `BWK_POSTEN` fuehrt. */
  var IDS = ['hg_ul', 'grundsteuer', 'ul_sonst',
             'hg_nul', 'eigen_r', 'mietausfall', 'nul_sonst'];

  function stil() {
    if (document.getElementById('dpbv-stil')) return;
    var s = document.createElement('style');
    s.id = 'dpbv-stil';
    /* Gold als `var(--wl-<hex>, #<hex>)` — Whitelabel-Pflicht. Das Grau
       der Schrift ist keine Statusfarbe und keine Marke, es bleibt hart. */
    /* ── Warum `color:inherit` und nicht ein fester Grauton ──────────────
       GEMESSEN am 06.10.2026 auf Staging: ein fester `#8A837E` ergab auf
       dem weissen Formulargrund einen Kontrast von **3,73** — bei 10,5 px
       zu wenig (AA verlangt 4,5). Ein Vermerk, den man nicht liest, ist
       kein Vermerk.

       Ein einfach dunklerer Hexwert waere aber die naechste Falle: er
       gilt nur zu SEINEM Grund. Im Obsidian-Skin ist der Grund dunkel,
       und derselbe Ton waere dort unlesbar — `--ch=#2A2727` darf laut
       CLAUDE.md nie auf Obsidian. Deshalb erbt der Vermerk die Textfarbe
       seines Umfelds (`.f` traegt hier `rgb(42,39,39)`, Kontrast 14,81)
       und tritt nur ueber die Deckkraft zurueck: 14,81 x 0,72 = **5,95**
       auf hell, und auf dunkel folgt er automatisch mit.

       Derselbe Grund fuer den Chip: eine GOLDENE Schrift kam auf dem
       cremefarbenen Chip-Grund nur auf 2,93. Gold traegt jetzt den Rahmen
       und den Grund — also die Marke —, die Schrift bleibt lesbar. */
    s.textContent =
      '.dpbv{display:block;margin:4px 0 0;font:400 10.5px/1.45 Inter,system-ui,sans-serif;' +
        'color:inherit;opacity:.72;font-style:normal}' +
      '.dpbv-k{display:inline-block;margin-right:5px;padding:1px 5px;border-radius:3px;' +
        'font:600 9px/1.5 "JetBrains Mono",monospace;letter-spacing:.04em;text-transform:uppercase;' +
        'color:inherit;opacity:1;border:1px solid var(--wl-c9a84c, #C9A84C);' +
        /* KEIN `rgba(201,168,76,…)` — das ist Gold in RGB-Notation und damit
           hartes Gold, das sich beim Mandanten nicht umfaerbt (gold-audit.py
           sucht genau dieses Muster, Regel RGBA). `--gold-bg` setzt
           DealPilotWhitelabel.apply(); ohne Whitelabel traegt der Rahmen
           die Marke und der Grund bleibt neutral. */
        'background:var(--gold-bg, rgba(255,255,255,.04))}' +
      '.dpbv-sum{display:block;margin:6px 0 0;font:400 10.5px/1.45 Inter,system-ui,sans-serif;' +
        'color:inherit;opacity:.72}';
    (document.head || document.documentElement).appendChild(s);
  }

  function herkunft() {
    try {
      var el = document.getElementById('_dp_herkunft');
      if (!el || !el.value) return {};
      var o = JSON.parse(el.value);
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }

  /* Der Platz fuer den Vermerk: das `.f`-Kaestchen, in dem das Feld sitzt.
     Gemessen an index.html:2911 — `<div class="f"><label>…</label><div class="iw">…`.
     Gibt es es nicht, haengt der Vermerk direkt hinter das Eingabefeld;
     ein Anker, den es nicht gibt, soll nicht still ins Leere greifen. */
  function behaelter(el) {
    var p = el;
    for (var i = 0; i < 4 && p; i++) {
      p = p.parentNode;
      if (p && p.classList && p.classList.contains('f')) return p;
    }
    return el.parentNode || null;
  }

  function weg(wurzel) {
    var alt = (wurzel || document).querySelectorAll('.dpbv,[data-dpbv]');
    for (var i = 0; i < alt.length; i++) {
      if (alt[i].parentNode) alt[i].parentNode.removeChild(alt[i]);
    }
  }

  /* Ein Posten gilt als geschaetzt, wenn (1) eine Herkunft dazu vermerkt
     ist UND (2) im Feld wirklich etwas steht. Eine Herkunft ohne Wert
     waere eine Behauptung ueber ein leeres Feld — dieselbe Regel, die
     `_herkunftMerken` schon beim Schreiben anwendet. */
  function geschaetzt(id, hk) {
    var txt = hk[id];
    if (txt == null || String(txt).trim() === '') return null;
    var el = document.getElementById(id);
    if (!el) return null;
    var v = String(el.value == null ? '' : el.value).trim();
    if (v === '') return null;
    /* Nur SCHAETZUNGEN tragen den Hinweis. Eine amtliche Herkunft
       („Bodenrichtwert aus BORIS") ist das Gegenteil einer Schaetzung und
       bekaeme hier sonst denselben Warnton. */
    if (!/geschätzt|geschaetzt|angesetzt|pauschal|Einstellungen|angenommen/i.test(String(txt))) return null;
    return String(txt);
  }

  function zeichnen() {
    try {
      stil();
      weg(document);
      var hk = herkunft();
      var n = 0, summeUl = 0, summeNul = 0;
      IDS.forEach(function (id) {
        var txt = geschaetzt(id, hk);
        if (!txt) return;
        var el = document.getElementById(id);
        var b = behaelter(el);
        if (!b) return;
        var s = document.createElement('span');
        s.className = 'dpbv';
        s.setAttribute('data-dpbv', MARKE);
        s.innerHTML = '<span class="dpbv-k">geschätzt</span>';
        s.appendChild(document.createTextNode(txt));
        b.appendChild(s);
        n++;
        if (id === 'hg_ul' || id === 'grundsteuer' || id === 'ul_sonst') summeUl++;
        else summeNul++;
      });
      /* Die Summenzeilen sagen, WIE VIELE Posten darin geschaetzt sind —
         wer nur auf die Summe sieht, soll es dort auch erfahren. */
      if (summeUl)  anSumme('ul_sum', summeUl);
      if (summeNul) anSumme('nul_sum', summeNul);
      return n;
    } catch (e) { return 0; }
  }

  function anSumme(id, anz) {
    var el = document.getElementById(id);
    if (!el) return;
    var b = behaelter(el);
    if (!b) return;
    var s = document.createElement('span');
    s.className = 'dpbv-sum';
    s.setAttribute('data-dpbv', MARKE);
    s.textContent = 'Darin ' + (anz === 1 ? 'ist ein Posten' : 'sind ' + anz + ' Posten') +
      ' von DealPilot geschätzt — die Summe ändert sich, sobald du deine eigenen Zahlen einträgst.';
    b.appendChild(s);
  }

  /* Neu zeichnen, wenn sich die Herkunft aendert (der Sprechlauf feuert
     `input` darauf) oder wenn ein BWK-Feld angefasst wird: wer seinen
     eigenen Wert eintraegt, soll den Hinweis sofort los sein. */
  function binden() {
    var hkEl = document.getElementById('_dp_herkunft');
    if (hkEl) {
      ['input', 'change'].forEach(function (ev) {
        hkEl.addEventListener(ev, function () { setTimeout(zeichnen, 0); });
      });
    }
    IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        /* Wer selbst tippt, hat gesagt. Die Herkunft wird mitgeloescht,
           sonst behauptete sie weiter eine Schaetzung an einer Zahl, die
           vom Nutzer stammt — und zoege mit in die Pilot-Analyse. */
        try {
          var h = herkunft();
          if (h[id] != null) {
            delete h[id];
            var e2 = document.getElementById('_dp_herkunft');
            if (e2) e2.value = JSON.stringify(h);
          }
        } catch (e) {}
        setTimeout(zeichnen, 0);
      });
    });
  }

  function start() {
    binden();
    zeichnen();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { setTimeout(start, 0); }

  window.DealPilotBwkVermerk = {
    zeichnen: zeichnen,
    /* Prueffenster: von aussen messbar, welche Posten als geschaetzt
       gelten und was ihr Vermerk sagt. */
    _stand: function () {
      var hk = herkunft(), raus = [];
      IDS.forEach(function (id) {
        var t = geschaetzt(id, hk);
        var el = document.getElementById(id);
        raus.push({ id: id, wert: el ? String(el.value || '') : null,
                    geschaetzt: !!t, vermerk: t || null });
      });
      return raus;
    },
    _marke: MARKE
  };
})();
