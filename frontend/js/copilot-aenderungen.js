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

  /* v1764b · WERTE IN KLARTEXT, NICHT ALS SCHLÜSSEL.

     Gemessen: die Rückfrage zeigte „neu: stark_sanierungsbeduerftig".
     Das ist der interne Wert der Auswahl; auf dem Bildschirm steht an
     dieser Stelle „Stark sanierungsbedürftig".

     > Wer einen Schlüssel liest, wo ein Wort steht, muss übersetzen —
     > und genau an der Stelle, an der er entscheiden soll, ob er
     > zustimmt. */
  function wertText(id, wert) {
    var e = el(id);
    if (!e) return String(wert);
    if (e.type === 'checkbox') {
      var w = String(wert).toLowerCase();
      return (w === 'true' || w === 'ja' || w === '1') ? 'ja' : 'nein';
    }
    if (e.tagName === 'SELECT') {
      for (var i = 0; i < e.options.length; i++) {
        if (String(e.options[i].value) === String(wert)) {
          var t = (e.options[i].textContent || '').trim();
          if (t) return t;
        }
      }
    }
    return String(wert);
  }

  /* Der aktuelle Wert eines Feldes, ebenfalls in Klartext. */
  function istText(id) {
    var e = el(id);
    if (!e) return '';
    if (e.type === 'checkbox') return e.checked ? 'ja' : 'nein';
    if (e.tagName === 'SELECT' && e.selectedIndex >= 0) {
      var t = (e.options[e.selectedIndex].textContent || '').trim();
      if (t) return t;
    }
    return String(e.value || '');
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1763 · DIE ABSICHT WIRD ÖRTLICH ERKANNT, NICHT ERFRAGT
     ═══════════════════════════════════════════════════════════════════

     Marcel am 01.10.2026: „Der braucht jetzt relativ lange. Er möchte
     halt immer nur gucken, ob es Änderungen gibt, der Co-Pilot. Der soll
     ja eigentlich Fragen beantworten zum Objekt … Also er soll schon den
     Funktionsumfang von vorher noch kennen."

     Er hat recht, und der Fehler war meiner. v1760 fing JEDE Nachricht ab
     und fragte erst den Server, ob Felder darin stecken. Damit lief jede
     ganz normale Frage — „Wie sieht es mit der Mietentwicklung aus?" —
     durch einen zusätzlichen Netzwerkweg, bevor sie überhaupt beim
     Co-Pilot ankam.

     > Eine Erweiterung, die den Hauptzweck verlangsamt, ist keine
     > Erweiterung, sondern eine Verlagerung. Der Co-Pilot beantwortet
     > Fragen; Felder zu ändern ist der Sonderfall und muss sich
     > entsprechend verhalten.

     Jetzt entscheidet eine ÖRTLICHE Prüfung, die nichts kostet. Sie ist
     bewusst eng: im Zweifel Frage. Lieber eine Änderung, die als Frage
     durchrutscht — die wiederholt man mit „ändere …" — als eine Frage,
     die auf eine Feldzuordnung wartet. */

  /* Verben und Wendungen, die eine Änderung ANSAGEN. Nur damit wird der
     teure Weg betreten. */
  var ANSAGE = new RegExp(
    '(' +
    'ändere|ändern|änder\\b|abändern|' +
    'setze|setz\\b|setzen\\s+auf|' +
    'trag(e|en)?\\s+(bitte\\s+)?(\\w+\\s+){0,3}ein|eintragen|' +
    'korrigier(e|en)?|aktualisier(e|en)?|' +
    'pass(e|en)?\\s+(\\w+\\s+){0,3}an|anpassen|' +
    'überschreib(e|en)?|ersetz(e|en)?|' +
    'übernimm|übernehmen\\s+(als|für)|' +
    'stell(e|en)?\\s+(\\w+\\s+){0,3}auf|' +
    'mach(e|en)?\\s+(\\w+\\s+){0,3}(zu|auf)\\s|' +
    /* „ist die Miete jetzt 850" — zwischen Verb und „jetzt" stehen
       Wörter. Ohne die Lücke verpasst das Muster genau die Form, in der
       Marcel seine Beispiele formuliert hat. */
    'ist\\s+(\\w+\\s+){0,3}(jetzt|nun|neu\\b)|sind\\s+(\\w+\\s+){0,3}(jetzt|nun|neu\\b)|' +
    'liegt\\s+(\\w+\\s+){0,2}(jetzt|nun)\\s+bei|beträgt\\s+(\\w+\\s+){0,2}(jetzt|nun)|' +
    'soll\\s+(\\w+\\s+){0,4}(sein|betragen|werden)|' +
    'neuer?\\s+(wert|miete|kaufpreis|baujahr)' +
    ')', 'i');

  /* v1763b · DIE MELDUNG MUSS DEN ECHTEN GRUND NENNEN.

     Gemessen: der Änderungsweg meldete „Konnte den Text nicht auswerten —
     bitte nochmal". Die wahre Ursache war HTTP 429, das Stundenlimit.
     „Bitte nochmal" ist dann genau der falsche Rat: Nochmal versuchen
     verschlimmert es.

     > Eine Fehlermeldung, die rät statt zu sagen, kostet mehr Zeit als
     > gar keine — man sucht den Fehler an der falschen Stelle. */
  function _fehlertext(err) {
    var s = err && err.status;
    if (s === 429) {
      var m = err && err.data && (err.data.message || err.data.error);
      return m ? String(m) : 'Zu viele Anfragen in kurzer Zeit — das Stundenlimit ist '
        + 'erreicht. In den Einstellungen lässt sich ein eigener Schlüssel hinterlegen.';
    }
    if (s === 401) return 'Die Sitzung ist abgelaufen — bitte neu anmelden.';
    if (s === 503) return 'Die KI ist gerade nicht erreichbar.';
    if (s) return 'Der Server hat mit ' + s + ' geantwortet.';
    return 'Keine Verbindung zum Server — der Text ist noch im Feld.';
  }

  /* Eine Zahl muss dabei sein — „ändere mal was" ist keine Änderung. */
  function istAenderungsansage(text) {
    if (!text || text.length < 6) return false;
    if (!/\d/.test(text)) return false;
    return ANSAGE.test(text);
  }

  /* Für den Portfolio-Piloten zusätzlich: ein erkennbarer Objektbezug.
     Ohne ihn ist selbst „ändere die Miete auf 850" dort mehrdeutig. */
  function hinweisWennKnapp(text, addMsg) {
    /* Wer eine Zahl nennt, aber kein Änderungswort, bekommt EINMAL den
       Hinweis — statt dass er rät, warum nichts passiert ist. */
    try {
      if (window.__dpCpaHinweisGezeigt) return;
      if (!/\d/.test(text)) return;
      if (istAenderungsansage(text)) return;
      window.__dpCpaHinweisGezeigt = true;
      setTimeout(function () {
        addMsg('assistant', 'Übrigens: wenn ich etwas am Objekt ändern soll, '
          + 'sag es als Anweisung — zum Beispiel „ändere die Miete auf 850" '
          + 'oder „die Miete ist jetzt 850". Dann trage ich es ein und frage '
          + 'nach, falls dort schon etwas steht.');
      }, 400);
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1762 · DER PORTFOLIO-PILOT MUSS ERST WISSEN, WELCHES OBJEKT
     ═══════════════════════════════════════════════════════════════════

     Im Cockpit ist kein Objekt geladen. „Die Miete ist jetzt 850" hat
     dort keinen Adressaten — erst muss klar sein, WOFÜR.

     > Ein Satz ohne Adressat ist im Portfolio keine Änderung, sondern
     > eine Mehrdeutigkeit. Sie aufzulösen, indem man das zuletzt
     > geöffnete Objekt nimmt, wäre der schlimmste Weg: es ginge meistens
     > gut und irgendwann ins falsche Objekt.

     Die Zuordnung läuft über die Karten der Seitenliste. Jede trägt
     `data-key` und `data-tip` („2026-999 · Musterstraße 12, Leipzig").
     Erkannt wird über die ZAHLEN und die Wortanfänge — eine Hausnummer
     unterscheidet zwei Objekte derselben Straße, ein Straßenname zwei
     Objekte derselben Stadt.

     Bleibt es mehrdeutig, wird GEFRAGT statt geraten. */
  function objekte() {
    var liste = [];
    try {
      document.querySelectorAll('.sb-card[data-key]').forEach(function (c) {
        var tip = c.getAttribute('data-tip') || '';
        if (!tip) return;
        liste.push({ key: c.getAttribute('data-key'), tip: tip, el: c });
      });
    } catch (e) {}
    return liste;
  }

  /* Wie gut passt `text` auf `tip`? Zahlen zählen doppelt — eine
     Objektnummer oder Hausnummer trennt schärfer als ein Wort. */
  function treffer(text, tip) {
    var t = text.toLowerCase();
    var punkte = 0;
    var teile = tip.toLowerCase().split(/[\s,·]+/).filter(function (w) { return w.length > 2; });
    teile.forEach(function (w) {
      var sauber = w.replace(/[^\wäöüß-]/g, '');
      if (!sauber || sauber.length < 3) return;
      if (t.indexOf(sauber) >= 0) punkte += /^\d/.test(sauber) ? 2 : 1;
    });
    return punkte;
  }

  function objektFinden(text) {
    var liste = objekte();
    if (!liste.length) return { art: 'keine' };
    var bewertet = liste.map(function (o) {
      return { key: o.key, tip: o.tip, punkte: treffer(text, o.tip) };
    }).filter(function (o) { return o.punkte > 0; })
      .sort(function (a, b) { return b.punkte - a.punkte; });

    if (!bewertet.length) return { art: 'keins' };
    /* Eindeutig ist es nur, wenn der Beste ECHT besser ist. Gleichstand
       heisst mehrdeutig, nicht „nimm den ersten". */
    if (bewertet.length === 1 || bewertet[0].punkte > bewertet[1].punkte) {
      return { art: 'eins', objekt: bewertet[0] };
    }
    return { art: 'mehrere', kandidaten: bewertet.filter(function (o) {
      return o.punkte === bewertet[0].punkte; }).slice(0, 5) };
  }

  function objektLaden(key) {
    return new Promise(function (fertig) {
      try {
        if (typeof window.loadSaved === 'function') {
          Promise.resolve(window.loadSaved(key)).then(function () {
            setTimeout(function () { fertig(window._currentObjKey === key); }, 900);
          }).catch(function () { fertig(false); });
          return;
        }
        var k = document.querySelector('.sb-card[data-key="' + key + '"]');
        if (k) {
          k.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          setTimeout(function () { fertig(window._currentObjKey === key); }, 1400);
          return;
        }
      } catch (e) {}
      fertig(false);
    });
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
            return '<li>' + esc(anzeige(x.id)) + ': <b>' + esc(wertText(x.id, x.wert)) + '</b></li>';
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
              +   'bleibt: <b>' + esc(istText(x.id) || String(x.alt)) + '</b></button>'
              + '<button type="button" class="' + MARKE + '-w an" data-i="' + i + '" data-nimm="neu">'
              +   'neu: <b>' + esc(wertText(x.id, x.neu)) + '</b></button>'
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

      /* v1763 · DER SCHNELLE WEG IST DER NORMALFALL.
         Ohne klare Änderungsansage wird NICHTS abgefangen: die Nachricht
         geht unberührt an den Co-Pilot, ohne zusätzlichen Netzwerkweg.
         Vorher lief hier jede Frage erst durch extract-text. */
      if (!istAenderungsansage(txt)) {
        try { hinweisWennKnapp(txt, window.__dpCpAddMsg); } catch (e) {}
        return;
      }

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
      }).catch(function (err) {
        if (warte && warte.parentNode) warte.parentNode.removeChild(warte);
        addMsg('assistant', '⚠ ' + _fehlertext(err));
        inp.value = merk;
      });
    }

    snd.addEventListener('click', pruefen, true);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        var txt = (inp.value || '').trim();
        /* Dieselbe Bedingung wie beim Klick — sonst verhielte sich Enter
           anders als der Knopf, und genau das sucht später niemand. */
        if (txt && window._currentObjKey && istAenderungsansage(txt)) {
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
      '.' + MARKE + '-kosten{margin:6px 0 2px;font-size:12.5px;opacity:.85}',
      '.' + MARKE + '-akt{display:flex;gap:7px;margin-top:8px}',
      '.' + MARKE + '-ok{padding:6px 14px;border-radius:6px;border:0;cursor:pointer;'
        + 'background:var(--wl-c9a84c,#C9A84C);color:#0A0A09;font-weight:600}',
      '.' + MARKE + '-nein{padding:6px 14px;border-radius:6px;cursor:pointer;'
        + 'border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Der Portfolio-Pilot: dieselbe Mechanik, ein Schritt davor ─────── */
  function einhaengenPortfolio() {
    var snd = el('dp-pp-send');
    var inp = el('dp-pp-in');
    if (!snd || !inp || snd.getAttribute('data-' + MARKE)) return false;
    snd.setAttribute('data-' + MARKE, '1');

    function weiter(text, addMsg) {
      /* Ab hier ist ein Objekt geladen — der Rest ist derselbe Weg wie
         beim Co-Pilot. */
      var kat = katalog();
      if (!kat.length) { addMsg('assistant', 'Die Felder sind noch nicht geladen — bitte nochmal.'); return; }
      var warte = addMsg('assistant', 'Ich sehe nach, was sich ändert …');
      window.Auth.apiCall('/ai/extract-text', {
        method: 'POST', body: { text: text.slice(0, 3800), catalog: kat }
      }).then(function (r) {
        if (warte && warte.parentNode) warte.parentNode.removeChild(warte);
        var f = (r && r.fields) || {};
        var neu = [], konflikte = [];
        Object.keys(f).forEach(function (id) {
          var wert = f[id];
          if (wert == null || String(wert).trim() === '') return;
          var e = el(id); if (!e) return;
          if (istLeer(e)) { neu.push({ id: id, wert: wert }); return; }
          var alt = (e.type === 'checkbox') ? (e.checked ? 'ja' : 'nein') : String(e.value);
          if (String(alt).trim() === String(wert).trim()) return;
          konflikte.push({ id: id, alt: alt, neu: wert });
        });
        if (!neu.length && !konflikte.length) {
          addMsg('assistant', 'Darin habe ich keine Objektangaben erkannt.');
          return;
        }
        zeigeVorschlag(neu, konflikte, addMsg);
      }).catch(function (err) {
        if (warte && warte.parentNode) warte.parentNode.removeChild(warte);
        addMsg('assistant', '⚠ ' + _fehlertext(err));
      });
    }

    function pruefen(ev) {
      var txt = (inp.value || '').trim();
      if (!txt || txt.length < 6) return;
      var addMsg = window.__dpPpAddMsg;
      if (typeof addMsg !== 'function') return;

      /* v1763 · Zwei Bedingungen, beide örtlich und kostenlos: eine klare
         Änderungsansage UND ein erkennbares Objekt. Fehlt eines, geht die
         Nachricht unberührt an den Portfolio-Piloten — er beantwortet
         Fragen zum ganzen Bestand, und das muss schnell bleiben. */
      if (!istAenderungsansage(txt)) {
        try { hinweisWennKnapp(txt, addMsg); } catch (e) {}
        return;
      }
      var fund = objektFinden(txt);
      if (fund.art === 'keins' || fund.art === 'keine') {
        /* Änderung gewollt, aber kein Objekt erkannt — das gehört gesagt,
           sonst wundert sich der Nutzer, warum nichts passiert. */
        addMsg('assistant', 'Das klingt nach einer Änderung — ich weiß nur nicht, '
          + 'an welchem Objekt. Nenn die Adresse oder die Objektnummer dazu, '
          + 'zum Beispiel „bei der Bismarckstr. 27 ist die Miete jetzt 1450".');
        inp.value = '';
        ev.stopImmediatePropagation(); ev.preventDefault();
        return;
      }

      ev.stopImmediatePropagation(); ev.preventDefault();
      var merk = txt;
      inp.value = '';
      addMsg('user', merk);

      if (fund.art === 'mehrere') {
        var box = addMsg('assistant', '');
        box.innerHTML = '<b>Welches Objekt meinst du?</b><div class="' + MARKE + '-konflikte">'
          + fund.kandidaten.map(function (o) {
              return '<button type="button" class="' + MARKE + '-w" data-key="' + esc(o.key) + '">'
                + esc(o.tip) + '</button>';
            }).join('') + '</div>';
        box.addEventListener('click', function (e2) {
          var b = e2.target.closest ? e2.target.closest('[data-key]') : null;
          if (!b) return;
          var tip = b.textContent.trim();
          box.innerHTML = 'Objekt: <b>' + esc(tip) + '</b> — wird geöffnet …';
          objektLaden(b.getAttribute('data-key')).then(function (ok) {
            if (!ok) { box.innerHTML = '⚠ Objekt ließ sich nicht öffnen.'; return; }
            box.innerHTML = 'Objekt: <b>' + esc(tip) + '</b>';
            weiter(merk, addMsg);
          });
        });
        return;
      }

      var o = fund.objekt;
      var hin = addMsg('assistant', 'Das betrifft <b>' + esc(o.tip) + '</b> — ich öffne es …');
      if (hin) hin.innerHTML = 'Das betrifft <b>' + esc(o.tip) + '</b> — ich öffne es …';
      objektLaden(o.key).then(function (ok) {
        if (!ok) {
          if (hin) hin.innerHTML = '⚠ <b>' + esc(o.tip) + '</b> ließ sich nicht öffnen.';
          return;
        }
        if (hin) hin.innerHTML = 'Objekt: <b>' + esc(o.tip) + '</b>';
        weiter(merk, addMsg);
      });
    }

    snd.addEventListener('click', pruefen, true);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        var txt = (inp.value || '').trim();
        if (txt && istAenderungsansage(txt)) {
          e.stopImmediatePropagation(); e.preventDefault();
          pruefen({ stopImmediatePropagation: function () {}, preventDefault: function () {} });
        }
      }
    }, true);

    try {
      if (window.DealPilotDiktat && typeof window.DealPilotDiktat.knopfAn === 'function') {
        window.DealPilotDiktat.knopfAn('dp-pp-in', { neben: 'dp-pp-send' });
      }
    } catch (e) {}
    return true;
  }

  /* v1764 · Das Abfangen des Senden-Klicks ist WEG.

     `einhaengen()` und `einhaengenPortfolio()` bleiben als Funktionen
     stehen — sie tragen die Objektzuordnung des Portfolio-Piloten, die
     weiterhin gebraucht wird. Aber der Klick wird nicht mehr abgefangen:
     die Nachricht geht immer direkt an den Co-Pilot, der Katalog reist
     mit, und das Modell entscheidet.

     > Zwei Instanzen, die dieselbe Frage beantworten — hier ein Muster,
     > dort ein Modell — sind eine mehr als nötig. Die schwächere gewinnt
     > immer dann, wenn sie zuerst dran ist. */
  function start() {
    stil();
    /* Nur noch das Mikrofon anhängen, kein Abfangen mehr. */
    var fertig = false;
    function mikrofone() {
      var a = el('dp-cp-in'), b = el('dp-pp-in');
      try {
        if (window.DealPilotDiktat) {
          if (a) window.DealPilotDiktat.knopfAn('dp-cp-in', { neben: 'dp-cp-send' });
          if (b) window.DealPilotDiktat.knopfAn('dp-pp-in', { neben: 'dp-pp-send' });
        }
      } catch (e) {}
      return !!(a && b);
    }
    fertig = mikrofone();
    if (fertig) return;
    var mo = new MutationObserver(function () {
      if (mikrofone()) { try { mo.disconnect(); } catch (e) {} }
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* ═══════════════════════════════════════════════════════════════════
     v1764 · DAS MODELL ENTSCHEIDET, NICHT EIN MUSTER
     ═══════════════════════════════════════════════════════════════════

     Marcel hat es an einem echten Satz vorgeführt:

       „Kannst du den Zustand der Wohnung auf stark
        renovierungsbedürftig ändern?"

     Mein Muster verlangte eine ZAHL — „stark renovierungsbedürftig" ist
     aber ein Auswahlwert. Also rutschte die Anweisung als Frage durch,
     und das Modell antwortete, es könne „keine Werte erfinden".

     > Ein Muster kann zählen, aber nicht verstehen. Jede Lücke, die ich
     > darin schließe, öffnet die nächste — „mach die Heizung neu", „der
     > Keller ist jetzt ausgebaut", „Zustand: saniert".

     Deshalb geht der Feldkatalog jetzt mit der Frage ans Modell, und das
     entscheidet selbst. Kommt eine Anweisung zurück, hängt es einen Block
     an; den löst diese Funktion heraus und zeigt dieselbe Rückfrage wie
     vorher. Ein Aufruf statt zwei — und der Co-Pilot bleibt in erster
     Linie der, der Fragen beantwortet. */
  var BLOCK = /<<<FELDER\s*([\s\S]*?)\s*FELDER>>>/;

  function ausAntwort(text, addMsg) {
    if (!text) return text;
    var m = String(text).match(BLOCK);
    if (!m) return text;

    var rest = String(text).replace(BLOCK, '').trim();
    var f = null;
    try { f = JSON.parse(m[1]); } catch (e) {}
    if (!f || typeof f !== 'object') return rest || text;

    /* Erst den Satz des Modells zeigen, dann die Rückfrage darunter —
       sonst steht die Begründung unter ihrer eigenen Folge. */
    if (rest) addMsg('assistant', rest);

    var neu = [], konflikte = [], unbekannt = [], gleich = [];
    Object.keys(f).forEach(function (id) {
      var wert = f[id];
      if (wert == null || String(wert).trim() === '') return;
      var e = el(id);
      /* v1764b · Eine Id, die es nicht gibt, ist etwas ANDERES als ein
         Wert, der schon stimmt. Vorher fielen beide in dieselbe Meldung
         („steht schon so") — und bei Marcels erstem Satz war genau das
         der Fall: das Modell hatte eine Option genannt, die es im Feld
         nicht gibt. Die Meldung schickte ihn damit in die falsche
         Richtung. */
      if (!e) { unbekannt.push(id); return; }
      /* Bei einer Auswahl zählt nur, was dort auch wählbar ist. */
      if (e.tagName === 'SELECT') {
        var kennt = false;
        for (var i = 0; i < e.options.length; i++) {
          if (String(e.options[i].value) === String(wert)) { kennt = true; break; }
        }
        if (!kennt) {
          var moeglich = [];
          for (var j = 0; j < e.options.length; j++) {
            var t = (e.options[j].textContent || '').trim();
            if (e.options[j].value !== '' && t) moeglich.push(t);
          }
          addMsg('assistant', 'Für „' + esc(anzeige(id)) + '" gibt es den Wert „'
            + esc(String(wert)) + '" nicht. Zur Auswahl stehen: '
            + esc(moeglich.join(' · ')) + '.');
          return;
        }
      }
      if (istLeer(e)) { neu.push({ id: id, wert: wert }); return; }
      var alt = (e.type === 'checkbox') ? (e.checked ? 'ja' : 'nein') : String(e.value);
      if (String(alt).trim() === String(wert).trim()) { gleich.push(id); return; }
      konflikte.push({ id: id, alt: alt, neu: wert });
    });

    if (!neu.length && !konflikte.length) {
      if (unbekannt.length) {
        addMsg('assistant', 'Die genannten Angaben passen zu keinem Feld, das ich kenne ('
          + esc(unbekannt.join(', ')) + ').');
      } else if (gleich.length) {
        addMsg('assistant', 'Das steht schon so im Objekt — nichts zu ändern.');
      }
      return '';
    }
    zeigeVorschlag(neu, konflikte, addMsg);
    return '';
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1766 · ABRUFE AUSLÖSEN, MIT KOSTENANSAGE (V4 / V5)
     ═══════════════════════════════════════════════════════════════════

     Marcel: „auch Marktberichte oder Wertermittlungen dort ausführen …
     Er sagt dann was es kostet und wie viel Kontingent wir noch haben."

     GEMESSEN: jeder Abruf kostet GENAU 1 — `cost` ist in
     `ai_credits_log` immer 1. Verschieden sind nicht die Preise, sondern
     die Guthabenarten:

       mpi        Marktpreis-Indikation       (Stufe 1)
       mpi_plus   erweiterte Indikation       (Stufe 2)
       wev        Wertermittlung / Bericht    (Stufe 3)

     Der Bestand kommt aus `GET /ai/credits` und wird dem Modell
     MITGEGEBEN. Es rechnet ihn nicht aus und schätzt ihn nicht.

     > Bei Geld wird nicht geschätzt. Lieber keine Zahl als eine
     > erfundene — das gilt für einen Kontostand genauso wie für einen
     > Liegenschaftszinssatz. */
  var _stand = null;          /* letzter bekannter Guthabenstand */

  var ABRUFE = [
    { name: 'marktpreis', art: 'mpi',
      titel: 'Marktpreis-Indikation von einem unabhängigen Bewertungspartner',
      tun: function () {
        /* Derselbe Weg wie der Knopf oben im Co-Pilot — kein zweiter. */
        var b = el('dp-cp-mp');
        if (b) { b.click(); return true; }
        return false;
      } },
    { name: 'marktbericht', art: 'wev',
      titel: 'DealPilot-Marktbericht zum Objekt',
      tun: function () {
        try {
          if (window.DealPilotMB && typeof window.DealPilotMB.run === 'function') {
            window.DealPilotMB.run(); return true;
          }
        } catch (e) {}
        return false;
      } }
  ];

  /* Der Stand wird EINMAL je Nachricht geholt und mitgegeben. Ihn bei
     jeder Antwort erneut zu ziehen wäre ein zusätzlicher Weg für eine
     Zahl, die sich nur beim Abruf ändert. */
  function standHolen() {
    return new Promise(function (fertig) {
      try {
        window.Auth.apiCall('/ai/credits').then(function (r) {
          _stand = r || null; fertig(_stand);
        }).catch(function () { fertig(_stand); });
      } catch (e) { fertig(_stand); }
    });
  }

  function abrufeFuerPrompt() {
    var arten = (_stand && _stand.arten) || {};
    return ABRUFE.map(function (a) {
      var k = arten[a.art];
      return { name: a.name, titel: a.titel, art: a.art,
               rest: (k && typeof k.rest === 'number') ? k.rest : null };
    });
  }

  var ABLOCK = /<<<ABRUF\s*([\s\S]*?)\s*ABRUF>>>/;

  function abrufAusAntwort(text, addMsg) {
    if (!text) return text;
    var m = String(text).match(ABLOCK);
    if (!m) return text;
    var rest = String(text).replace(ABLOCK, '').trim();
    var j = null;
    try { j = JSON.parse(m[1]); } catch (e) {}
    var a = j && ABRUFE.filter(function (x) { return x.name === j.name; })[0];
    if (!a) return rest || text;

    if (rest) addMsg('assistant', rest);

    var arten = (_stand && _stand.arten) || {};
    var frei = (arten[a.art] && typeof arten[a.art].rest === 'number') ? arten[a.art].rest : null;

    if (frei === 0) {
      addMsg('assistant', 'Dafür ist gerade kein Guthaben mehr da.');
      return '';
    }

    var box = addMsg('assistant', '');
    box.classList.add(MARKE + '-box');
    box.innerHTML = '<b>' + esc(a.titel) + '</b>'
      + '<div class="' + MARKE + '-kosten">Kostet <b>1 Abruf</b>'
      + (frei == null ? '' : ' · danach noch <b>' + frei + '</b> frei') + '</div>'
      + '<div class="' + MARKE + '-akt">'
      + '<button type="button" class="' + MARKE + '-ok" data-los="1">Abrufen</button>'
      + '<button type="button" class="' + MARKE + '-nein" data-nein="1">Doch nicht</button>'
      + '</div>';

    box.addEventListener('click', function (ev) {
      if (ev.target.getAttribute('data-los')) {
        var ok = false;
        try { ok = a.tun(); } catch (e) {}
        box.innerHTML = ok
          ? '<b>' + esc(a.titel) + '</b> wird abgerufen …'
          : '⚠ Der Abruf ließ sich nicht starten.';
        if (ok) setTimeout(standHolen, 4000);
        return;
      }
      if (ev.target.getAttribute('data-nein')) {
        box.innerHTML = 'Nicht abgerufen — es wurde nichts verbraucht.';
      }
    });
    return '';
  }

  window.DealPilotCopilotAenderungen = {
    katalog: katalog,
    einhaengen: einhaengen,
    ausAntwort: function (text, addMsg) {
      /* Erst Abrufe, dann Felder — ein Satz kann beides nicht sein, und
         so steht die Reihenfolge fest statt vom Zufall abzuhängen. */
      var t = abrufAusAntwort(text, addMsg);
      if (t === '') return '';
      return ausAntwort(t, addMsg);
    },
    abrufe: abrufeFuerPrompt,
    standHolen: standHolen,
    stand: function () { return _stand; }
  };

  /* Einmal beim Laden, damit die erste Frage den Stand schon kennt. */
  setTimeout(standHolen, 1500);
})();
