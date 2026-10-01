/* ═══════════════════════════════════════════════════════════════════════
   v1760 · DER CO-PILOT VERSTEHT ÄNDERUNGEN
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 01.10.2026: „Ich will eigentlich nur unten in dieses
   Co-Pilot-Feld, dass ich dort einfach Änderungen reindiktieren kann und
   wenn ich auf Senden gehe, dass er dann einfach versteht: Ah, okay, du
   möchtest die und die Sachen umsetzen. Ich kann die in diesem Objekt
   hier reinschreiben — oder ich habe die Sachen schon dort drinne stehen,
   soll ich die ersetzen?"

   Ausdrücklich NICHT der Sprechlauf: „Du hast da wirklich den Sprechlauf
   genommen. Das meinte ich auch nicht." Kein eigenes Fenster, keine
   Feldführung — ein Satz ins Chatfeld, und der Co-Pilot erkennt selbst,
   dass es eine Änderung ist.

   ERST GEMESSEN, DANN GEBAUT. Wiederverwendet wird:

     POST /ai/extract-text   { text, catalog } -> { fields }
       derselbe Endpunkt, den der Sprechlauf für seine Rückfragen nutzt
       (voice-import.js:8259). Ein zweiter Zuordnungsweg daneben liefe
       auseinander, sobald einer gepflegt wird.

     window.FIELDS           221 Felder, davon 192 Eingabefelder
       der Katalog entsteht daraus, nicht aus einer gepflegten Liste.
       Ein neu angelegtes Feld steht damit von allein darin — genau das,
       was Marcel unter V7 verlangt hat.

   DIE REGEL BEI BELEGTEN FELDERN ist dieselbe wie überall sonst: nichts
   still überschreiben. Steht schon ein Wert, wird er GENANNT und einzeln
   bestätigt.

   > Eine Änderung, die der Nutzer nicht gesehen hat, ist keine Änderung,
   > sondern ein Verlust. Das gilt für eine generierte Tabelle über einem
   > Handeintrag genauso wie hier für ein einzelnes Feld.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MARKE = 'dp-cpa';
  var _vorschlag = null;      /* { werte: {id:wert}, konflikte: [...] } */

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  /* ── Der Feldkatalog, gebaut wie im Sprechlauf: aus window.FIELDS,
     nicht aus einer Pflegeliste. ─────────────────────────────────────── */
  function katalog() {
    var ids = (window.FIELDS && window.FIELDS.length) ? window.FIELDS : [];
    var cat = [], seen = {};
    ids.forEach(function (id) {
      if (seen[id]) return; seen[id] = 1;
      if (/^_/.test(id) || /^ai_/.test(id)) return;
      var e = el(id);
      if (!e) return;
      var tag = e.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
      if (e.type === 'hidden') return;
      var eintrag = { id: id, label: beschriftung(id, e) };
      if (e.type === 'checkbox') { eintrag.kind = 'bool'; }
      else if (tag === 'SELECT') {
        eintrag.kind = 'select';
        eintrag.options = [];
        for (var i = 0; i < e.options.length; i++) {
          var o = e.options[i];
          if (o.value !== '') eintrag.options.push(o.value);
        }
      } else { eintrag.kind = 'text'; }
      cat.push(eintrag);
    });
    return cat;
  }

  /* Die Beschriftung aus dem DOM lesen, nicht raten — sonst versteht das
     Modell nicht, worum es geht, und der Nutzer sieht in der Rückfrage
     einen Feldnamen, den es nirgends gibt.

     v1760b · Gemessen am Mietfeld: `nkm` hat KEIN `label[for]`, sein
     nächster Behälter `.iw` auch keins — mein erster Entwurf fiel deshalb
     auf den Platzhalter zurück und nannte das Feld „800". Das richtige
     Label („Nettokaltmiete / Monat") steht eine Ebene höher.

     > Ein Platzhalter ist ein BEISPIELWERT, keine Beschriftung. Ihn als
     > Feldnamen zu zeigen ist schlimmer als die nackte Id: die Id verrät
     > wenigstens, dass hier etwas fehlt.

     Deshalb: aufsteigen, bis ein Label da ist. Der Platzhalter bleibt der
     allerletzte Ausweg. */
  function beschriftung(id, e) {
    try {
      var l = document.querySelector('label[for="' + id + '"]');
      if (l) return (l.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);

      var x = e.parentElement, tiefe = 0;
      while (x && tiefe < 5) {
        var lab = x.querySelector('label');
        if (lab) {
          var t = (lab.textContent || '').replace(/\s+/g, ' ').trim();
          if (t) return t.slice(0, 60);
        }
        x = x.parentElement; tiefe++;
      }

      if (e.getAttribute('aria-label')) return String(e.getAttribute('aria-label')).slice(0, 60);
      if (e.getAttribute('title')) return String(e.getAttribute('title')).slice(0, 60);
      if (e.placeholder) return 'Feld ' + id + ' (z. B. ' + String(e.placeholder).slice(0, 20) + ')';
    } catch (ex) {}
    return id;
  }

  function anzeige(id) {
    var e = el(id);
    if (!e) return id;
    return beschriftung(id, e) || id;
  }

  function istLeer(e) {
    if (!e) return true;
    if (e.type === 'checkbox') return !e.checked;
    var v = (e.value == null) ? '' : String(e.value).trim();
    return v === '' || v === '0' || v === '--' || v === '– bitte wählen –';
  }

  /* ── Setzen. Kein eigener Rechenweg: calc() und autoSave() sind die
     vorhandenen Wege, und nur die werden gerufen. ───────────────────── */
  function setzen(werte) {
    var n = 0;
    Object.keys(werte).forEach(function (id) {
      var e = el(id);
      if (!e) return;
      try {
        if (e.type === 'checkbox') {
          var w = String(werte[id]).toLowerCase();
          e.checked = (w === 'true' || w === 'ja' || w === '1');
        } else {
          e.value = String(werte[id]);
        }
        e.dispatchEvent(new Event('input', { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
        n++;
      } catch (ex) {}
    });
    try { if (typeof window.calc === 'function') window.calc(); } catch (ex) {}
    try { if (typeof window.autoSave === 'function') window.autoSave(); } catch (ex) {}
    return n;
  }

  /* ── Die Rückfrage im Chat ─────────────────────────────────────────── */
  function zeigeVorschlag(neu, konflikte, addMsg) {
    _vorschlag = { werte: {}, konflikte: konflikte };
    var teile = [];

    if (neu.length) {
      teile.push('<b>Das trage ich ein:</b><ul class="' + MARKE + '-liste">'
        + neu.map(function (x) {
            _vorschlag.werte[x.id] = x.wert;
            return '<li>' + esc(anzeige(x.id)) + ': <b>' + esc(String(x.wert)) + '</b></li>';
          }).join('')
        + '</ul>');
    }

    if (konflikte.length) {
      teile.push('<b>Hier steht schon etwas — was soll gelten?</b>'
        + '<div class="' + MARKE + '-konflikte">'
        + konflikte.map(function (x, i) {
            return '<div class="' + MARKE + '-k" data-i="' + i + '">'
              + '<div class="' + MARKE + '-k-name">' + esc(anzeige(x.id)) + '</div>'
              + '<div class="' + MARKE + '-k-wahl">'
              + '<button type="button" class="' + MARKE + '-w" data-i="' + i + '" data-nimm="alt">'
              +   'bleibt: <b>' + esc(String(x.alt)) + '</b></button>'
              + '<button type="button" class="' + MARKE + '-w an" data-i="' + i + '" data-nimm="neu">'
              +   'neu: <b>' + esc(String(x.neu)) + '</b></button>'
              + '</div></div>';
          }).join('')
        + '</div>');
      /* Vorbelegt ist der NEUE Wert — der Nutzer hat ihn gerade gesagt.
         Aber er sieht beide und kann zurück. */
      konflikte.forEach(function (x) { _vorschlag.werte[x.id] = x.neu; });
    }

    teile.push('<div class="' + MARKE + '-akt">'
      + '<button type="button" class="' + MARKE + '-ok" id="' + MARKE + '-ok">Übernehmen</button>'
      + '<button type="button" class="' + MARKE + '-nein" id="' + MARKE + '-nein">Verwerfen</button>'
      + '</div>');

    var box = addMsg('assistant', '');
    if (!box) return;
    box.innerHTML = teile.join('');
    box.classList.add(MARKE + '-box');

    box.addEventListener('click', function (ev) {
      var w = ev.target.closest ? ev.target.closest('.' + MARKE + '-w') : null;
      if (w) {
        var i = parseInt(w.getAttribute('data-i'), 10);
        var k = _vorschlag.konflikte[i];
        _vorschlag.werte[k.id] = (w.getAttribute('data-nimm') === 'alt') ? k.alt : k.neu;
        [].forEach.call(box.querySelectorAll('.' + MARKE + '-w[data-i="' + i + '"]'),
          function (b) { b.classList.toggle('an', b === w); });
        return;
      }
      if (ev.target.id === MARKE + '-ok') {
        var n = setzen(_vorschlag.werte);
        box.innerHTML = '<b>Übernommen.</b> ' + n + ' Feld' + (n === 1 ? '' : 'er')
          + ' geändert, die Analyse rechnet mit den neuen Angaben.';
        _vorschlag = null;
        return;
      }
      if (ev.target.id === MARKE + '-nein') {
        box.innerHTML = 'Verworfen — nichts geändert.';
        _vorschlag = null;
      }
    });
  }

  /* ── Der Einhängepunkt ─────────────────────────────────────────────
     `send()` liegt in copilot.js im Modulabschluss und ist von aussen
     nicht erreichbar. Statt die Datei umzubauen, wird der Klick ABGEFANGEN
     und nur dann weitergereicht, wenn es KEINE Änderung ist. Das hält
     beide Dateien unabhaengig voneinander. */
  function einhaengen() {
    var snd = el('dp-cp-send');
    var inp = el('dp-cp-in');
    if (!snd || !inp || snd.getAttribute('data-' + MARKE)) return false;
    snd.setAttribute('data-' + MARKE, '1');

    function pruefen(ev) {
      var txt = (inp.value || '').trim();
      if (!txt) return;
      /* Ohne geladenes Objekt gibt es nichts zu ändern — dann ist es eine
         normale Frage. */
      if (!window._currentObjKey) return;
      if (txt.length < 6) return;

      var kat = katalog();
      if (!kat.length) return;

      ev.stopImmediatePropagation();
      ev.preventDefault();

      var merk = txt;
      inp.value = '';
      var addMsg = window.__dpCpAddMsg;
      if (typeof addMsg !== 'function') { inp.value = merk; return; }
      addMsg('user', merk);
      var warte = addMsg('assistant', 'Ich sehe nach, ob das Änderungen am Objekt sind …');

      window.Auth.apiCall('/ai/extract-text', {
        method: 'POST',
        body: { text: merk.slice(0, 3800), catalog: kat }
      }).then(function (r) {
        if (warte && warte.parentNode) warte.parentNode.removeChild(warte);
        var f = (r && r.fields) || {};
        var neu = [], konflikte = [];
        Object.keys(f).forEach(function (id) {
          var wert = f[id];
          if (wert == null || String(wert).trim() === '') return;
          var e = el(id);
          if (!e) return;
          if (istLeer(e)) { neu.push({ id: id, wert: wert }); return; }
          var alt = (e.type === 'checkbox') ? (e.checked ? 'ja' : 'nein') : String(e.value);
          /* Gleicher Wert ist kein Konflikt — und auch keine Änderung. */
          if (String(alt).trim() === String(wert).trim()) return;
          konflikte.push({ id: id, alt: alt, neu: wert });
        });

        if (!neu.length && !konflikte.length) {
          /* Keine Felder erkannt: es war doch eine Frage. Zurück in den
             normalen Weg — der Text steht wieder im Feld, ein Klick
             genuegt. Ihn still verschwinden zu lassen waere der
             schlimmere Fehler. */
          addMsg('assistant', 'Darin habe ich keine Objektangaben erkannt — '
            + 'ich schicke es als Frage weiter.');
          inp.value = merk;
          snd.removeAttribute('data-' + MARKE);
          snd.click();
          snd.setAttribute('data-' + MARKE, '1');
          return;
        }
        zeigeVorschlag(neu, konflikte, addMsg);
      }).catch(function () {
        if (warte && warte.parentNode) warte.parentNode.removeChild(warte);
        addMsg('assistant', '⚠ Konnte den Text nicht auswerten — bitte nochmal.');
        inp.value = merk;
      });
    }

    snd.addEventListener('click', pruefen, true);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        var txt = (inp.value || '').trim();
        if (txt && window._currentObjKey && txt.length >= 6) {
          e.stopImmediatePropagation();
          e.preventDefault();
          pruefen({ stopImmediatePropagation: function () {}, preventDefault: function () {} });
        }
      }
    }, true);

    /* v1760 · Das Mikrofon daneben — Marcel: „dass man da vielleicht neben
       dem Senden auch einfach ein Mikrofon-Symbol hat". */
    try {
      if (window.DealPilotDiktat && typeof window.DealPilotDiktat.knopfAn === 'function') {
        window.DealPilotDiktat.knopfAn('dp-cp-in', { neben: 'dp-cp-send' });
      }
    } catch (e) {}
    return true;
  }

  function stil() {
    if (el(MARKE + '-stil')) return;
    var s = document.createElement('style');
    s.id = MARKE + '-stil';
    s.textContent = [
      '.' + MARKE + '-box{line-height:1.55}',
      '.' + MARKE + '-liste{margin:6px 0 10px;padding-left:18px}',
      '.' + MARKE + '-liste li{margin:2px 0}',
      '.' + MARKE + '-konflikte{margin:6px 0 10px;display:grid;gap:7px}',
      '.' + MARKE + '-k{padding:7px 9px;border:1px solid rgba(201,168,76,.35);border-radius:7px}',
      '.' + MARKE + '-k-name{font-size:11.5px;opacity:.78;margin-bottom:5px}',
      '.' + MARKE + '-k-wahl{display:flex;gap:6px;flex-wrap:wrap}',
      '.' + MARKE + '-w{flex:1 1 auto;padding:5px 9px;border-radius:5px;cursor:pointer;'
        + 'border:1px solid rgba(201,168,76,.4);background:transparent;color:inherit;font-size:12px}',
      '.' + MARKE + '-w.an{background:var(--wl-c9a84c,#C9A84C);color:#0A0A09;'
        + 'border-color:var(--wl-c9a84c,#C9A84C)}',
      '.' + MARKE + '-akt{display:flex;gap:7px;margin-top:8px}',
      '.' + MARKE + '-ok{padding:6px 14px;border-radius:6px;border:0;cursor:pointer;'
        + 'background:var(--wl-c9a84c,#C9A84C);color:#0A0A09;font-weight:600}',
      '.' + MARKE + '-nein{padding:6px 14px;border-radius:6px;cursor:pointer;'
        + 'border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function start() {
    stil();
    if (einhaengen()) return;
    var mo = new MutationObserver(function () { if (einhaengen()) { try { mo.disconnect(); } catch (e) {} } });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotCopilotAenderungen = { katalog: katalog, einhaengen: einhaengen };
})();
