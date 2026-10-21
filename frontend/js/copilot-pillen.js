/* ============================================================================
   DealPilot v2082 — copilot-pillen.js  ·  Backlog N60.22

   Marcel am 10.10.2026: „In der Pilotanalyse unten, wo dann halt auch der
   Co-Pilot sitzt, vielleicht noch ein paar Pillen machen, wo man draufklicken
   kann mit gewissen Standards, wie Ist-Soll-Ist, habe ich die volle
   Datentiefe erreicht, welche Felder fehlen."

   ── ZWEI ARTEN VON PILLEN, UND DAS IST DER GANZE PUNKT ───────────────────

   Die Frage „welche Felder fehlen" kann die APP beantworten. Sie dafuer an
   die KI zu schicken waere dreifach falsch: es kostet Kontingent, es dauert,
   und die Antwort koennte daneben liegen — waehrend `pflichtFuer()` und der
   Readycheck die Wahrheit schon kennen.

     ANTWORT   beantwortet die App sofort, kostenlos, mit Sprung-Chips
     FRAGE     setzt den Text ins Eingabefeld; gesendet wird per Hand

   > Marcel: „dass der Kunde sich darueber auch helfen kann, dass man quasi
   > auch eine Hilfe da drin abbildet." Eine Hilfe, die erst Geld kostet und
   > dann vielleicht irrt, ist keine.

   Was lokal beantwortet wird, ist deshalb als „DealPilot" gekennzeichnet und
   nicht als Antwort der KI — sonst haelt der Nutzer eine gemessene Zahl fuer
   eine geschaetzte.

   ── WOHER DIE ZAHLEN KOMMEN ──────────────────────────────────────────────

   Aus `DealPilotReadyCheck.getData()` — demselben Zaehler, der unter
   Deal-Aktion „Bereit fuer die Bank?" rechnet, und damit seit v2079 auch aus
   `DealPilotObjektReiter.pflichtFuer(stufe)`. KEINE eigene Feldliste hier:
   die vierte Liste derselben Angaben war genau der Befund von N60.23.

   Additiv: `copilot.js` wird nicht angefasst. Die Leiste haengt sich an
   `#dp-cp` und ueberlebt dessen Neuaufbau (MutationObserver).
   ============================================================================ */
(function () {
  'use strict';
  if (window._dpCpPillenInit) return;
  window._dpCpPillenInit = true;

  var LOKAL = [
    { id: 'tiefe',  text: 'Datentiefe',        titel: 'Wie vollständig ist dieses Objekt?' },
    { id: 'fehlt',  text: 'Was fehlt?',        titel: 'Welche Felder sind noch leer?' }
  ];
  /* v2550 · Marcel 21.10.2026: „vlzt koennen wir das besser formulieren und
     paar mehr. mit Auswahlbox." Fuenf Pillen fuer die haeufigen Fragen, der
     Rest in einer Auswahl nach Thema. Auch dort wird nur EINGESETZT, gesendet
     wird per Hand - der Nutzer sieht, was Kontingent kostet. */
  var FRAGEN = [
    { id: 'kauf', text: 'Kaufen oder nicht?',
      frage: 'Würdest du dieses Objekt zu diesem Preis kaufen? Begründe es mit '
           + 'Cashflow, DSCR und Rendite und nenne die eine Zahl, die das Urteil kippen würde.' },
    { id: 'risiko', text: 'Größte Risiken',
      frage: 'Was sind die drei größten Risiken bei diesem Objekt, gemessen an den '
           + 'vorliegenden Zahlen — und wie kann ich jedes davon begrenzen?' },
    { id: 'bank', text: 'Bankgespräch',
      frage: 'Worauf schaut die Bank bei diesem Objekt zuerst? Welche Zahlen sollte '
           + 'ich vor dem Termin kennen, und welche Unterlagen wird sie verlangen?' },
    { id: 'sollist', text: 'Ankauf ↔ heute',
      frage: 'Vergleiche den Stand beim Ankauf mit dem heutigen Stand: Wo liegt das '
           + 'Objekt besser, wo schlechter, und was heißt das für Bank und Verkauf?' },
    { id: 'tiefer', text: 'Mehr Tiefe?',
      frage: 'Welche zusätzlichen Angaben würden die Analyse dieses Objekts belastbarer '
           + 'machen — und was ändert jede davon konkret am Ergebnis?' }
  ];
  var WEITERE = [
    { gruppe: 'Kaufpreis & Verhandlung', fragen: [
      'Bis zu welchem Kaufpreis trägt sich dieses Objekt noch? Nenne die Grenze in Euro und woran sie hängt.',
      'Mit welchen Argumenten aus den Zahlen kann ich beim Kaufpreis verhandeln, und wie viel ist realistisch?',
      'Wie weit liegt der Kaufpreis vom Marktwert entfernt, und was erklärt den Unterschied?' ] },
    { gruppe: 'Miete & Potenzial', fragen: [
      'Wie viel Mieterhöhung ist rechtlich und am Markt möglich (Soll-Miete), und ab wann?',
      'Lohnt sich das Zielbild? Stelle Aufwand, Mehrmiete und Wertzuwachs gegenüber.',
      'Ist die heutige Miete marktüblich, oder liegt sie deutlich darüber oder darunter?' ] },
    { gruppe: 'Finanzierung', fragen: [
      'Was passiert mit dem Cashflow, wenn der Zins nach der Zinsbindung um zwei Prozentpunkte steigt?',
      'Wie viel Eigenkapital brauche ich, damit der Cashflow nicht negativ wird?',
      'Ist die Tilgung sinnvoll gewählt, oder sollte ich sie für dieses Objekt anpassen?' ] },
    { gruppe: 'Steuer', fragen: [
      'Wie wirkt sich das Objekt steuerlich aus, und ab welchem Jahr kippt der Vorteil in eine Steuerlast?',
      'Lohnt sich ein Gutachten zur Restnutzungsdauer für eine höhere Abschreibung?',
      'Welchen Anteil des Kaufpreises sollte ich auf das Gebäude legen, und wie belege ich ihn?' ] },
    { gruppe: 'Bewirtschaftung & Verkauf', fragen: [
      'Welche Instandhaltung steht in den nächsten zehn Jahren an, und reicht die Rücklage dafür?',
      'Wie robust ist der Deal, wenn eine Wohnung sechs Monate leer steht?',
      'Wann wäre ein Verkauf am sinnvollsten, und was bleibt nach Steuern übrig?' ] }
  ];

  function css() {
    if (document.getElementById('dp-cpp-css')) return;
    var st = document.createElement('style'); st.id = 'dp-cpp-css';
    st.textContent =
      '.dp-cpp{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 2px;align-items:center}' +
      '.dp-cpp-lbl{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.12em;' +
        'color:#8a8279;text-transform:uppercase;margin-right:2px}' +
      '.dp-cpp-p{border:1px solid var(--wl-c9a84c, #C9A84C);background:transparent;' +
        'color:var(--wl-c9a84c, #C9A84C);border-radius:999px;padding:4px 11px;' +
        'font:600 11.5px/1.3 "Space Grotesk",sans-serif;cursor:pointer;' +
        'transition:background .15s,color .15s}' +
      '.dp-cpp-p:hover{background:var(--wl-c9a84c, #C9A84C);color:#0c0b09}' +
      /* Die lokalen tragen einen gefuellten Punkt - sie kosten nichts. */
      '.dp-cpp-p.dp-cpp-lokal::before{content:"\\25CF";font-size:8px;' +
        'vertical-align:middle;margin-right:5px;opacity:.65}' +
      '.dp-cpp-q{color:#6b6660;border-color:rgba(138,130,121,.45)}' +
      '.dp-cpp-q:hover{background:rgba(138,130,121,.15);color:#2A2727}' +
      '.dp-cpp-spr{display:inline-block;margin:3px 4px 0 0;padding:2px 8px;' +
        'border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent);border-radius:999px;background:transparent;' +
        'color:var(--wl-c9a84c, #C9A84C);font:11px/1.4 "Space Grotesk",sans-serif;cursor:pointer}' +
      '.dp-cpp-spr:hover{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 15%, transparent)}' +
      '.dp-cpp-sel{border:1px solid rgba(138,130,121,.45);background:transparent;color:#6b6660;' +
        'border-radius:999px;padding:4px 10px;font:600 11.5px/1.3 "Space Grotesk",sans-serif;' +
        'cursor:pointer;max-width:100%}' +
      '.dp-cpp-sel option,.dp-cpp-sel optgroup{color:#2A2727;background:#FDFCFA;font-weight:400}' +
      '.dp-cpp-sel optgroup{font-weight:700}' +
      '@media(max-width:560px){.dp-cpp{padding:7px 10px 2px}.dp-cpp-lbl{display:none}.dp-cpp-sel{flex:1 1 100%}}';
    document.head.appendChild(st);
  }

  /* ── Die Auskunft, die die App selbst geben kann ──────────────────────── */
  function daten() {
    var RC = window.DealPilotReadyCheck;
    if (!RC || typeof RC.getData !== 'function') return null;
    try { return RC.getData(); } catch (e) { return null; }
  }

  function antwortTiefe() {
    var d = daten();
    if (!d) return 'Die Vollständigkeit kann ich gerade nicht messen — '
      + 'der Zähler aus dem Reiter Deal-Aktion ist nicht erreichbar.';
    var t = [];
    t.push(d.filled + ' von ' + d.total + ' Feldern sind gefüllt (' + d.percent + ' %).');
    if (d.stufe) {
      t.push('Eingabetiefe ' + d.stufe + ' ist gewählt; davon kommen '
        + d.stufe_felder + ' Pflichtfelder der Wertermittlung dazu.');
    }
    if (!d.missing.length) {
      t.push('Es fehlt nichts — alle Felder dieser Stufe und alle '
        + 'Investor-Deal-Score-Felder sind ausgefüllt.');
    } else {
      t.push('Offen sind noch ' + d.missing.length + '.');
      if (d.stufe && d.stufe < 3) {
        t.push('Für eine Wertermittlung nach ImmoWertV braucht es Eingabetiefe 3 — '
          + 'die Pille dafür steht oben im Reiter Objekt.');
      }
    }
    return t.join(' ');
  }

  function antwortFehlt() {
    var d = daten();
    if (!d) return { text: 'Ich kann die fehlenden Felder gerade nicht lesen.', chips: [] };
    if (!d.missing.length) {
      return { text: 'Nichts fehlt. ' + d.filled + ' von ' + d.total
        + ' Feldern sind gefüllt.', chips: [] };
    }
    /* Nach Herkunft trennen - das sagt dem Nutzer, WOFUER es fehlt. */
    var stufe = d.missing.filter(function (m) { return m.stufe; });
    var art   = d.missing.filter(function (m) { return m.art; });
    var score = d.missing.filter(function (m) { return !m.stufe && !m.art; });
    var t = ['Es fehlen ' + d.missing.length + ' Angaben:'];
    if (score.length) t.push('• ' + score.length + ' für den Investor-Deal-Score');
    if (stufe.length) t.push('• ' + stufe.length + ' für die Wertermittlung (Eingabetiefe '
      + (d.stufe || '?') + ')');
    if (art.length)   t.push('• ' + art.length + ' Pflichtfelder der Objektart');
    t.push('Klick auf eine Angabe, dann springe ich hin.');
    return { text: t.join('\n'), chips: d.missing };
  }

  /* ── Bedienung ────────────────────────────────────────────────────────── */
  function sagen(text, chips) {
    var add = window.__dpCpAddMsg;
    if (typeof add !== 'function') return;
    var d = add('assistant', text);
    if (!d) return;
    /* Kennzeichnen: das war die App, nicht die KI. */
    var q = document.createElement('div');
    q.style.cssText = 'margin-top:6px;font:10px/1.4 "JetBrains Mono",monospace;'
      + 'letter-spacing:.08em;color:#8a8279;text-transform:uppercase';
    q.textContent = 'gemessen von DealPilot · kein Kontingent verbraucht';
    d.appendChild(q);
    if (chips && chips.length) {
      var w = document.createElement('div');
      w.style.marginTop = '6px';
      chips.forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'dp-cpp-spr'; b.textContent = m.name;
        b.addEventListener('click', function () {
          var RC = window.DealPilotReadyCheck;
          if (RC && typeof RC.jump === 'function') { try { RC.jump(m.key); } catch (e) {} }
        });
        w.appendChild(b);
      });
      d.appendChild(w);
    }
    var log = document.getElementById('dp-cp-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function fragenSetzen(text) {
    var inp = document.getElementById('dp-cp-in');
    if (!inp) return;
    inp.value = text;
    inp.focus();
    try { inp.setSelectionRange(text.length, text.length); } catch (e) {}
    /* Hoehe nachziehen, falls copilot.js das Feld wachsen laesst. */
    try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }

  function leiste() {
    var box = document.getElementById('dp-cp');
    if (!box) return false;
    if (box.querySelector('.dp-cpp')) return true;
    var bar = box.querySelector('.dp-cp-bar');
    if (!bar) return false;
    css();
    var w = document.createElement('div');
    w.className = 'dp-cpp';
    var lbl = document.createElement('span');
    lbl.className = 'dp-cpp-lbl'; lbl.textContent = 'Schnell';
    w.appendChild(lbl);

    LOKAL.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dp-cpp-p dp-cpp-lokal';
      b.textContent = p.text; b.title = p.titel + ' — beantwortet DealPilot selbst, ohne Kontingent';
      b.addEventListener('click', function () {
        if (p.id === 'tiefe') sagen(antwortTiefe(), []);
        else { var a = antwortFehlt(); sagen(a.text, a.chips); }
      });
      w.appendChild(b);
    });
    FRAGEN.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dp-cpp-p dp-cpp-q';
      b.textContent = p.text; b.title = p.frage;
      b.addEventListener('click', function () { fragenSetzen(p.frage); });
      w.appendChild(b);
    });

    /* v2550 · Auswahlbox: setzt die Frage ein und springt zurueck auf den Platzhalter */
    var sel = document.createElement('select');
    sel.className = 'dp-cpp-sel'; sel.setAttribute('aria-label', 'Weitere Fragen an den Co-Pilot');
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Weitere Fragen …';
    sel.appendChild(o0);
    WEITERE.forEach(function (g) {
      var og = document.createElement('optgroup'); og.label = g.gruppe;
      g.fragen.forEach(function (f) { var o = document.createElement('option'); o.value = f; o.textContent = f; og.appendChild(o); });
      sel.appendChild(og);
    });
    sel.addEventListener('change', function () { var f = sel.value; sel.selectedIndex = 0; if (f) fragenSetzen(f); });
    w.appendChild(sel);

    bar.parentNode.insertBefore(w, bar);
    return true;
  }

  /* `copilot.js` baut `#dp-cp` erst beim Oeffnen des Reiters und kann es
     neu aufbauen. Deshalb beobachten statt einmal versuchen. */
  function start() {
    if (leiste()) return;
    var mo = new MutationObserver(function () { if (leiste()) { /* bleibt aktiv */ } });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else start();

  window.DealPilotCoPilotPillen = { leiste: leiste, tiefe: antwortTiefe, fehlt: antwortFehlt };
})();
