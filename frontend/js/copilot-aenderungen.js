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

  /* ═══ v1767 · HIER LAG DAS MUSTER, UND ES IST WEG ═══════════════════

     Entfernt: `ANSAGE` (ein Regex über 14 Verbformen),
     `istAenderungsansage()` und `hinweisWennKnapp()`.

     Das Muster verlangte eine ZAHL im Satz und scheiterte damit an
     Marcels „Zustand auf stark renovierungsbedürftig". Der Hinweis
     erklärte dem Nutzer eine Formulierungsregel, die das Modell nicht
     braucht. Beides lief dem Modell VOR und gewann, wo es traf.

     > Zwei Instanzen, die dieselbe Frage beantworten, sind eine mehr als
     > nötig. Die schwächere gewinnt immer dann, wenn sie zuerst dran ist.

     Wer hier wieder ein Muster einhängt, baut den zweiten Weg zurück,
     der v1760 bis v1764 gekostet hat. */

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

  /* ═══ v1767b · DREI FEHLER IM VERGLEICH, ALLE GEMESSEN ═════════════

     Geprüft mit Marcels Satz „Kannst du in der Musterstraße 12 in
     Leipzig den Innenausbau auf über 20 Jahren setzen?" gegen 17 echte
     Objekte:

       2026-999  · Musterstraße 12 Leipzig       2 Punkte (musterstraße, leipzig)
       2026-1052 · Gohliser Str. 42 Leipzig      2 Punkte (str, leipzig)

     **Gleichstand — und damit wurde am falschen Objekt geändert.** Drei
     Ursachen:

     1 `indexOf` findet TEILWÖRTER. „str" steckt in „Musterstraße", also
       bekam die Gohliser Straße einen Punkt für ein Wort, das im Satz
       gar nicht vorkommt. Jetzt zählt nur die Wortgrenze.

     2 `length > 2` warf die HAUSNUMMER weg — „12", „9", „42". Genau die
       Zahl, die zwei Objekte in derselben Stadt trennt, war die einzige,
       die nicht zählte.

     3 Straßenwörter sind keine Merkmale. `str`, `weg`, `platz`, `allee`
       stehen in jedem zweiten Namen; sie heben niemanden heraus, aber
       sie erzeugen Gleichstände.

     > Ein Vergleich, der ein gemeinsames Wort wie ein Merkmal zählt,
     > findet Ähnlichkeit, wo keine ist. Und ein Gleichstand ist keine
     > Entscheidung — er sieht nur so aus, wenn man den ersten nimmt.

     Normalisiert wird beidseitig (`ß`→`ss`, `straße`/`strasse`/`str.`
     → `str`), damit „Parkstr. 9" und „Parkstraße 9" dasselbe sind. */
  var GENERISCH = {
    str: 1, weg: 1, platz: 1, allee: 1, ring: 1, gasse: 1, hof: 1, berg: 1,
    am: 1, an: 1, auf: 1, der: 1, den: 1, zum: 1, zur: 1, bei: 1, und: 1
  };

  function normStr(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/stra(ss)?e\b/g, 'str')
      .replace(/str\./g, 'str');
  }

  function wortDrin(text, wort) {
    try {
      var e = wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(^|[^0-9a-zäöü])' + e + '([^0-9a-zäöü]|$)').test(text);
    } catch (ex) { return false; }
  }

  function treffer(text, tip) {
    var t = normStr(text);
    var punkte = 0;
    normStr(tip).split(/[\s,·]+/).forEach(function (w) {
      var sauber = w.replace(/[^0-9a-zäöü-]/g, '');
      if (!sauber) return;
      if (GENERISCH[sauber]) return;
      var zahl = /^\d+$/.test(sauber);
      /* Zahlen zählen ab EINER Stelle — die Hausnummer trennt am
         schärfsten. Wörter erst ab vier Zeichen: „der", „bei", „ost"
         tragen nichts und erzeugen nur Gleichstände. */
      if (!zahl && sauber.length < 4) return;
      if (wortDrin(t, sauber)) punkte += zahl ? 3 : 1;
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

     v1767 · HIER FING BIS HEUTE NOCH EIN MUSTER DEN SENDEN-KLICK AB.

     **Ich nehme eine Aussage im Journal ausdrücklich zurück.** Zu v1764
     steht dort: „Das Abfangen des Senden-Klicks ist ersatzlos weg." Das
     war falsch — `istAenderungsansage()` hing weiter am Klick und am
     Enter, und wer es traf, landete in `/ai/extract-text` statt beim
     Modell. Zwei Wege zum selben Ziel, und der schwächere war zuerst
     dran.

     > Zwei Instanzen, die dieselbe Frage beantworten, sind eine mehr als
     > nötig. Genau das hatte ich zu v1764 selbst aufgeschrieben — und im
     > Portfolio-Piloten stehen lassen.

     Jetzt bleibt hier nur noch das Mikrofon. Der Feldkatalog reist mit
     der Nachricht ans Modell (copilot.js), das Modell entscheidet, und
     `ausAntwort()` nimmt den Block entgegen. Ein Weg. */
  function einhaengen() {
    var inp = el('dp-cp-in');
    if (!inp || inp.getAttribute('data-' + MARKE)) return false;
    inp.setAttribute('data-' + MARKE, '1');
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

  /* ── Der Portfolio-Pilot ───────────────────────────────────────────
     v1767 · Auch hier nur noch das Mikrofon. Welches Objekt gemeint ist,
     entscheidet `objektZuordnen()` — und zwar erst, wenn das Modell
     wirklich eine Änderung vorgeschlagen hat. Vorher wurde das Objekt
     schon beim Senden geöffnet, auf Verdacht eines Musters hin. */
  function einhaengenPortfolio() {
    var inp = el('dp-pp-in');
    if (!inp || inp.getAttribute('data-' + MARKE)) return false;
    inp.setAttribute('data-' + MARKE, '1');
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

  /* ═══ v1767 · DIE SCHABLONE HEILEN ═════════════════════════════════

     Gemessen am laufenden System mit Marcels Satz „änder bei der
     Musterstraße 12 mal die Zimmeranzahl auf fünf":

       {"feld_id":"zimmer","anderes_feld":"5"}

     Das Modell hat die Platzhalter meines Formatbeispiels für feste
     Schlüssel gehalten. Die Ursache sitzt im Prompt und ist dort
     behoben (echtes Beispiel aus dem Katalog) — aber ein Prompt ist eine
     Bitte, kein Vertrag.

     > Wo ein Modell die Form bestimmt, gehört ein Heiler an die
     > Gegenstelle. Sonst hängt eine Funktion daran, dass ein Satz gut
     > formuliert war.

     Geheilt werden drei Formen, alle mit genau DIESER Bedeutung:
       {"feld_id":"zimmer","anderes_feld":"5"}   -> {"zimmer":"5"}
       {"feld_id":"zimmer","wert":"5"}           -> {"zimmer":"5"}
       [{"feld_id":"zimmer","wert":"5"}, ...]    -> {"zimmer":"5", ...}

     Entscheidend ist die Prüfung „ist der WERT eine bekannte Feld-Id?" —
     nicht der Schlüsselname. Ein Feld namens `wert` gibt es nicht, aber
     darauf zu bauen wäre dieselbe Wette nochmal. */
  var SCHLUESSEL_ID = ['feld_id', 'feld', 'field', 'field_id', 'id', 'name'];
  var SCHLUESSEL_WERT = ['wert', 'value', 'neuer_wert', 'new_value', 'anderes_feld', 'inhalt'];

  function _paarform(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    var k = Object.keys(o);
    if (k.length !== 2) return null;
    var idK = null, wertK = null;
    k.forEach(function (x) {
      var lx = x.toLowerCase();
      if (SCHLUESSEL_ID.indexOf(lx) >= 0) idK = x;
      else if (SCHLUESSEL_WERT.indexOf(lx) >= 0) wertK = x;
    });
    if (!idK || !wertK) return null;
    /* Der Beweis: der genannte Wert MUSS ein Feld sein, das es gibt. */
    var ziel = String(o[idK] || '').trim();
    if (!ziel || !el(ziel)) return null;
    var r = {}; r[ziel] = o[wertK];
    return r;
  }

  function heileSchablone(f) {
    if (Array.isArray(f)) {
      var zus = {}, getroffen = 0;
      f.forEach(function (x) {
        var p = _paarform(x);
        if (p) { Object.keys(p).forEach(function (k) { zus[k] = p[k]; }); getroffen++; }
        else if (x && typeof x === 'object') {
          Object.keys(x).forEach(function (k) { if (el(k)) zus[k] = x[k]; });
        }
      });
      return Object.keys(zus).length ? zus : null;
    }
    var p2 = _paarform(f);
    return p2 || f;
  }

  /* ═══ v1767 · IM PORTFOLIO ENTSCHEIDET DER SATZ, WELCHES OBJEKT ═════

     Marcel nennt die Adresse: „änder bei der Musterstraße 12 …". Ohne
     diese Zuordnung schreibt der Portfolio-Pilot in das Objekt, das
     gerade geladen ist — also womöglich in ein anderes als das genannte.

     > Eine Änderung am falschen Objekt ist schlimmer als keine. Sie sieht
     > aus wie Erfolg.

     v1767b · GENAU DAS IST PASSIERT. Mein erster Entwurf schrieb bei
     allem außer `art:'eins'` ein `fertig(true)` — „kein klarer Hinweis,
     dann beim geladenen bleiben". Gemessen an Marcels Satz: der Vergleich
     ergab einen Gleichstand (siehe `treffer()`), also `art:'mehrere'`,
     also `true`, also Änderung an der Bismarckstraße statt an der
     Musterstraße. Ohne einen Hinweis darauf.

     > „Im Zweifel weitermachen" ist bei einer Zuordnung keine
     > Milde, sondern eine Wette auf Kosten des Nutzers.

     Jetzt gilt: nur ein EINDEUTIGER Treffer darf durch. Gleichstand und
     „kein Objekt genannt" werden GEFRAGT, und ohne Antwort passiert
     nichts. */
  function objektZuordnen(nutzerText, addMsg) {
    return new Promise(function (fertig) {
      var geladen = window._currentObjKey;
      var fund = nutzerText ? objektFinden(nutzerText) : { art: 'keins' };

      /* Eindeutig und schon offen: nichts zu tun. */
      if (fund.art === 'eins' && fund.objekt.key === geladen) { fertig(true); return; }

      /* Eindeutig und ein anderes: öffnen. */
      if (fund.art === 'eins') {
        var hin = addMsg('assistant', '');
        if (hin) hin.innerHTML = 'Das betrifft <b>' + esc(fund.objekt.tip) + '</b> — ich öffne es …';
        objektLaden(fund.objekt.key).then(function (ok) {
          if (hin) {
            hin.innerHTML = ok
              ? 'Objekt: <b>' + esc(fund.objekt.tip) + '</b>'
              : '⚠ <b>' + esc(fund.objekt.tip) + '</b> ließ sich nicht öffnen — ich ändere nichts.';
          }
          fertig(ok);
        });
        return;
      }

      /* Mehrdeutig oder gar nicht genannt: FRAGEN. Bei Gleichstand nur
         die Kandidaten, sonst das geladene Objekt plus die Liste. */
      var wahl = (fund.art === 'mehrere') ? fund.kandidaten : null;
      if (!wahl) {
        var alle = objekte();
        if (!alle.length) { fertig(false); return; }
        /* Ist ein Objekt offen, ist es der naheliegendste Kandidat — aber
           es wird bestätigt, nicht unterstellt. */
        wahl = alle.filter(function (o) { return o.key === geladen; })
          .concat(alle.filter(function (o) { return o.key !== geladen; }))
          .slice(0, 6);
      }

      var box = addMsg('assistant', '');
      if (!box) { fertig(false); return; }
      box.innerHTML = '<b>' + (fund.art === 'mehrere'
          ? 'Das passt auf mehrere Objekte — welches meinst du?'
          : 'An welchem Objekt soll ich das ändern?')
        + '</b><div class="' + MARKE + '-konflikte">'
        + wahl.map(function (o) {
            return '<button type="button" class="' + MARKE + '-w" data-key="' + esc(o.key) + '">'
              + esc(o.tip) + (o.key === geladen ? ' (offen)' : '') + '</button>';
          }).join('')
        + '</div><div class="' + MARKE + '-kosten">Ohne Auswahl ändere ich nichts.</div>';

      box.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('[data-key]') : null;
        if (!b) return;
        var key = b.getAttribute('data-key');
        var tip = (b.textContent || '').replace(/\s*\(offen\)$/, '').trim();
        box.innerHTML = 'Objekt: <b>' + esc(tip) + '</b> — wird geöffnet …';
        if (key === geladen) { box.innerHTML = 'Objekt: <b>' + esc(tip) + '</b>'; fertig(true); return; }
        objektLaden(key).then(function (ok) {
          box.innerHTML = ok
            ? 'Objekt: <b>' + esc(tip) + '</b>'
            : '⚠ <b>' + esc(tip) + '</b> ließ sich nicht öffnen — ich ändere nichts.';
          fertig(ok);
        });
      });
    });
  }

  function ausAntwort(text, addMsg, nutzerText) {
    if (!text) return text;
    var m = String(text).match(BLOCK);
    if (!m) return text;

    var rest = String(text).replace(BLOCK, '').trim();
    var f = null;
    try { f = JSON.parse(m[1]); } catch (e) {}
    f = heileSchablone(f);
    if (!f || typeof f !== 'object') return rest || text;

    /* Nennt der Satz ein anderes Objekt, wird es ERST geöffnet. */
    if (nutzerText && objekte().length > 1) {
      if (rest) addMsg('assistant', rest);
      objektZuordnen(nutzerText, addMsg).then(function (ok) {
        if (ok) anwenden(f, addMsg);
      });
      return '';
    }
    return anwenden(f, addMsg, rest);
  }

  function anwenden(f, addMsg, rest) {

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
    /* v1767b · DER WRAPPER HAT DEN DRITTEN PARAMETER VERSCHLUCKT.
       Hier stand `function (text, addMsg)` — zwei Parameter. Der
       `nutzerText`, den copilot.js und portfolio-pilot.js übergeben, kam
       damit nie an, und `objektZuordnen()` lief in keinem einzigen Fall.
       Gemessen: das Objekt wechselte nicht, obwohl der Satz die Adresse
       nannte.

       > Eine Weiterleitung, die einen Parameter nicht kennt, wirft ihn
       > weg, ohne sich zu beschweren. Der Aufrufer sieht nichts, der
       > Empfänger auch nicht — nur die Funktion fehlt. */
    ausAntwort: function (text, addMsg, nutzerText) {
      /* Erst Abrufe, dann Felder — ein Satz kann beides nicht sein, und
         so steht die Reihenfolge fest statt vom Zufall abzuhängen. */
      var t = abrufAusAntwort(text, addMsg);
      if (t === '') return '';
      return ausAntwort(t, addMsg, nutzerText);
    },
    abrufe: abrufeFuerPrompt,
    standHolen: standHolen,
    stand: function () { return _stand; },
    /* Für die Prüfstrecke: ein Prüfer, der die Zuordnung nicht selbst
       aufrufen kann, misst sich am Ende nur selbst. */
    _pruef: { treffer: treffer, objektFinden: objektFinden,
              heileSchablone: heileSchablone, objekte: objekte }
  };

  /* Einmal beim Laden, damit die erste Frage den Stand schon kennt. */
  setTimeout(standHolen, 1500);
})();
