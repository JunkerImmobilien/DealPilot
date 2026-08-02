/* wertermittlung.js — Zielfrage, Stufenfelder, Pflichtfeld-Ampel.
 * ────────────────────────────────────────────────────────────────────────────
 * Aufbau nach Konzept: EINE Frage am Anfang statt Checkboxen mittendrin.
 *
 *   Stufe 1  Schnelle Einschätzung     was schon da ist
 *   Stufe 2  Genaue Preisindikation    + Baustatus, Zustand, Qualität, Energie
 *   Stufe 3  Wertermittlung            + Bodenwert, Ertragswert, ggf. Sachwert
 *
 * Jederzeit hochschaltbar, ohne neu anzufangen — Eingetragenes bleibt stehen.
 *
 * HARTE REGEL: kein Verfahren rechnet halb. Entweder alle Pflichtangaben liegen
 * vor und es läuft, oder es erscheint gar nicht im Bericht. Kein stillschweigend
 * eingesetzter Standardwert. Genau dieser Fehler — ein unbemerkter Nullwert bei
 * den Bewirtschaftungskosten — hat im Test den Ertragswert um 13 % verschoben.
 *
 * Empfohlene Felder dürfen einen Annahmewert haben, aber nur sichtbar
 * gekennzeichnet. Pflichtfelder nie.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STUFE_KEY = 'dp_mb_stufe';

  /* ── Feldkatalog ───────────────────────────────────────────────────────── */
  /* pflicht: ohne das rechnet das Verfahren nicht.
     empfohlen: es rechnet, aber die Belastbarkeit sinkt. */
  var FELDER = {
    /* v1017 · Der Baustatus steht jetzt in STUFE 1.
     * Gemessen (Leipzig, 12 Monate, gleiche Flaeche): Erstbezug 14,47 EUR/m2
     * gegen 10,28 im vergleichbaren Bestand — 41 Prozent Unterschied. Kein
     * Feld aus Stufe 2 bewegt den Wert annaehernd so stark, und es kostet
     * einen Klick. In der Feinjustierung war es falsch aufgehoben. */
    stufe1: [
      { id: 'baustatus', label: 'Baustatus', typ: 'select', pflicht: true, hilfe: 'baustatus',
        opt: [['bestand', 'Bestand'],
              ['bestand_erstbezug_saniert', 'Bestand \u2013 Erstbezug nach Sanierung'],
              ['neubau_erstbezug', 'Neubau \u2013 Erstbezug'],
              ['neubau_im_bau', 'Neubau \u2013 im Bau'],
              ['geplant', 'Geplant / Bautr\u00e4ger']] },
    ],

    stufe2: [
      { id: 'sanierungsjahr', label: 'Sanierungsjahr', typ: 'number', empfohlen: true,
        wenn: function () { return /saniert/.test(wert('baustatus')) || /saniert/.test(wert('cond')); } },
    ],
    /* v1016 · Nur fragen, was wir NICHT selbst herausfinden.
     * Liegenschaftszins kommt aus der Parametertabelle, der Bodenrichtwert
     * ueber BORIS. Beides braucht den Nutzer nur, wenn der Abruf nichts
     * liefert. Anpassung und Begruendung sind Feinjustierung fuer den
     * Sachverstaendigen. Die Stellplatzmiete ist ohne Stellplaetze sinnlos. */
    stufe3: [
      { id: 'plot', label: 'Grundst\u00fccksfl\u00e4che (m\u00b2)', typ: 'number', pflicht: true, hilfe: 'plot',
        vorhanden: true },
      { id: 'mea', label: 'Miteigentumsanteil (%)', typ: 'number', hilfe: 'mea',
        pflichtWenn: function () { return istWohnung(); },
        wenn: function () { return istWohnung(); } },
      { id: 'units', label: 'Anzahl Wohneinheiten', typ: 'number', pflicht: true, vorhanden: true },
      /* v1040 · Ohne Einschraenkung. Vorher nur bei Haeusern sichtbar — wer
       * eine Wohnung bewertete, fand das Feld nicht und konnte nicht wissen,
       * dass es es gibt. Die Hilfe erklaert, wofuer es gilt. */
      { id: 'bgf', label: 'Bruttogrundfl\u00e4che (m\u00b2)', typ: 'number', hilfe: 'bgf',
        platzhalter: 'nur f\u00fcr den Sachwert bei H\u00e4usern' },
      { id: 'spMiete', label: 'Stellplatzmiete (\u20ac/Monat)', typ: 'number',
        wenn: function () { return (parseFloat(wert('garages')) || 0) + (parseFloat(wert('outdoor')) || 0) > 0; } },

      /* v1047-WFELD-1 · Ohne Standardstufe kein Sachwert. Vorher wurde
       * stillschweigend Stufe 3 gerechnet — 42.000 EUR Unterschied bei
       * einer 165-m2-Wohnung, ausgewiesen als waere er ermittelt. Die
       * Sperre ohne dieses Feld waere eine Sackgasse gewesen. */
      /* v1057-WSON-5 · Kueche, Moeblierung, Werbeflaeche, Antennenanlage. */
      { id: 'sonstEinnahmen', label: 'Sonstige Einnahmen (\u20ac/Jahr)', typ: 'number' },

      { id: 'standardstufe', label: 'Standardstufe (NHK 2010)', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['3', '3 \u00b7 Standard'],
                   ['4', '4 \u00b7 gehoben'],
                   ['5', '5 \u00b7 stark gehoben']],
        hilfe: 'standardstufe' },

      /* Korrekturfaktor aus Anlage 4, Fussnote 5 — lag fertig im Rechenkern
       * und hatte nie ein Feld. Die Beschriftung erklaert ihn, statt nur
       * den Fachbegriff hinzustellen. */
      { id: 'grundriss', label: 'Grundrissart', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['einspaenner', 'Einsp\u00e4nner \u00b7 1 Wohnung je Treppenhaus (\u00d7 1,05)'],
                   ['zweispaenner', 'Zweisp\u00e4nner \u00b7 2 Wohnungen (\u00d7 1,00)'],
                   ['dreispaenner', 'Dreisp\u00e4nner \u00b7 3 Wohnungen (\u00d7 0,97)'],
                   ['vierspaenner', 'Viersp\u00e4nner \u00b7 4 Wohnungen (\u00d7 0,95)']],
        hilfe: 'grundriss',
        wenn: function () { return istWohnung() || (parseFloat(wert('units')) || 0) > 2; } },

      /* Anlage 2 laesst ausdruecklich beide Wege zu: Punktevergabe je
       * Bauteil ODER sachverstaendige Einschaetzung des Grades. Der zweite
       * ist im Formular zumutbar, der erste waere ein eigener Dialog.
       * Die Zahlen sind die Mitten der Baender aus Tabelle 2. */
      { id: 'modGrad', label: 'Modernisierungsgrad (Anlage 2)', typ: 'select',
        opt: [['', '\u2013 keine Angabe, wird gesch\u00e4tzt \u2013'],
                   ['0', 'nicht modernisiert'],
                   ['4', 'kleine Modernisierungen im Rahmen der Instandhaltung'],
                   ['8', 'mittlerer Modernisierungsgrad'],
                   ['14', '\u00fcberwiegend modernisiert'],
                   ['19', 'umfassend modernisiert']],
        hilfe: 'modGrad' },
    ],

    /* Nur fuer den Ausnahmefall — eingeklappt, klar beschriftet. */
    experte: [
      { id: 'brwManuell', label: 'Bodenrichtwert (\u20ac/m\u00b2)', typ: 'number', hilfe: 'brwManuell',
        platzhalter: 'leer = amtlicher Abruf' },
      { id: 'brwStichtag', label: 'Stichtag des Bodenrichtwerts', typ: 'text',
        platzhalter: 'z. B. 2024-01-01',
        pflichtWenn: function () { return !!wert('brwManuell'); } },
      { id: 'lzs', label: 'Liegenschaftszinssatz (%)', typ: 'number', hilfe: 'lzs',
        platzhalter: 'leer = amtlicher bzw. gesetzlicher Wert' },
      { id: 'sachwertfaktor', label: 'Sachwertfaktor', typ: 'number', hilfe: 'sachwertfaktor',
        platzhalter: 'leer = aus der Parametertabelle',
        wenn: function () { return !istWohnung(); } },
      { id: 'brwAnp', label: 'Bodenwert-Anpassung (%)', typ: 'number', hilfe: 'brwAnp' },
      { id: 'brwAnpGrund', label: 'Begr\u00fcndung der Anpassung', typ: 'text',
        pflichtWenn: function () { return !!wert('brwAnp'); } },
    ],
  };

  /* Welche Angaben welches Verfahren braucht. */
  var VERFAHREN = [
    { key: 'markt', name: 'Marktpreisindikation', ab: 1,
      /* v1014b · 'living' gibt es nicht — das Feld heisst 'area'. Deshalb stand
       * in der Ampel dauerhaft "fehlt: living", obwohl die Wohnflaeche da war. */
      /* v1017 · Baujahr ist Pflicht, nicht Kuer: ohne Baujahr faellt in der
       * Segmentierungs-Kaskade das komplette Baujahrsband weg, dann liegen
       * Altbauten von 1900 im selben Topf wie Neubauten. */
      pflicht: ['ptype', 'area', 'year', 'baustatus'], empfohlen: ['cond', 'quality'] },
    /* v1018 · "ab Stufe 3" war irrefuehrend: der Quercheck rechnet den
     * Ertragswert immer, nur mit Pauschalen. Ab Stufe 3 rechnet derselbe
     * Kern mit echten Parametern. */
    { key: 'ertrag', name: 'Ertragswert', ab: 1, genauerAb: 3,
      pflicht: ['plot', 'units'], empfohlen: ['lzs', 'baustatus'] },
    { key: 'sach', name: 'Sachwert', ab: 1, genauerAb: 3,
      pflicht: ['plot', 'year'], empfohlen: ['quality'],
      nichtWenn: function () { return istWohnung(); },
      nichtGrund: 'bei Eigentumswohnung nicht anwendbar' },
  ];

  function wert(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function istWohnung() { return /wohnung|etw/i.test(wert('ptype')); }
  function stufe() {
    try { return parseInt(localStorage.getItem(STUFE_KEY), 10) || 1; } catch (e) { return 1; }
  }
  function setStufe(n) {
    try { localStorage.setItem(STUFE_KEY, String(n)); } catch (e) {}
    zeichnen(); stufenAnwenden(true); ampel();
  }

  /* ── Aufbau ────────────────────────────────────────────────────────────── */
  function stil() {
    if ($('wm-css')) return;
    var s = document.createElement('style');
    s.id = 'wm-css';
    s.textContent =
      '.wm-ziel{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,168,76,.25);' +
      'border-radius:8px;background:rgba(201,168,76,.04)}' +
      '.wm-ziel h4{margin:0 0 10px;font-size:13px;color:var(--wl-e8cc7a,#E8CC7A);font-weight:600}' +
      '.wm-opt{display:block;padding:7px 9px;margin:3px 0;border-radius:5px;cursor:pointer;font-size:12.5px;line-height:1.5}' +
      '.wm-opt:hover{background:rgba(201,168,76,.07)}' +
      '.wm-opt.an{background:rgba(201,168,76,.13);border-left:2px solid var(--wl-c9a84c,#C9A84C)}' +
      '.wm-opt{position:relative}' +
      '.wm-kero{position:absolute;right:9px;top:7px;font-size:11px;font-weight:600;' +
        'color:var(--wl-c9a84c,#C9A84C);opacity:.85}' +
      '.wm-opt small{display:block;color:#8a8a93;font-size:11px;margin-top:2px}' +
      '.wm-block{margin:14px 0;padding:12px 14px;border:1px solid rgba(128,128,128,.22);border-radius:7px}' +
      '.wm-block h4{margin:0 0 10px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:.65}' +
      '.wm-f{margin-bottom:9px}' +
      '.wm-f label{display:block;font-size:11.5px;margin-bottom:3px;opacity:.85}' +
      /* v1014b · KEINE eigenen Feldfarben. Vorher standen hier
       * border:rgba(255,255,255,.12) und ein fast durchsichtiger weisser
       * Hintergrund — geschrieben fuers dunkle Cockpit. Der Marktbericht ist
       * aber HELL (steht so in der Projektanweisung). Auf weissem Grund war
       * beides unsichtbar: Label und Platzhalter sichtbar, Feld nicht.
       * Jetzt erben die Felder die Formatierung der App wie alle anderen. */
      '.wm-f.fehlt input,.wm-f.fehlt select{outline:2px solid var(--wl-b8625c,#B8625C);outline-offset:1px}' +
      '.wm-pf{color:var(--wl-b8625c,#B8625C);margin-left:3px}' +
      '.wm-ampel{margin:14px 0;padding:12px 14px;border:1px solid rgba(128,128,128,.22);border-radius:7px;font-size:12.5px}' +
      '.wm-z{display:flex;gap:8px;padding:5px 0;line-height:1.5;cursor:pointer}' +
      '.wm-z:hover{opacity:.8}' +
      '.wm-i{width:15px;flex:0 0 15px;text-align:center}' +
      '.wm-ok{color:#3FA56C}.wm-warn{color:#E8B84F}.wm-nein{color:#8a8a93}' +
      '.wm-z b{font-weight:600}.wm-z span{color:#8a8a93}';
    document.head.appendChild(s);
  }

  function zielfrage(wo) {
    if ($('wm-ziel')) return;
    var d = document.createElement('div');
    d.className = 'wm-ziel'; d.id = 'wm-ziel';
    d.innerHTML =
      '<h4>Was soll der Bericht leisten?</h4>' +
      opt(1, 'Schnelle Einschätzung', 'Lage und Marktpreisindikation. Wenige Angaben.') +
      opt(2, 'Genaue Preisindikation', 'Zusätzlich Baustatus, Zustand und Qualität. Deutlich engere Spanne.') +
      opt(3, 'Wertermittlung', 'Zusätzlich Bodenwert und Ertragswert nach ImmoWertV, mit Rechenweg im PDF.') +
      '<div style="margin-top:8px;font-size:11px;color:#7a7a84">Du kannst jederzeit hochschalten — Eingetragenes bleibt erhalten.</div>';
    wo.insertBefore(d, wo.firstChild);
    d.querySelectorAll('.wm-opt').forEach(function (o) {
      o.addEventListener('click', function () { setStufe(parseInt(o.getAttribute('data-s'), 10)); });
    });
  }

  /* v1027 · Der Preis steht an der Wahl, nicht irgendwo im Kopf. */
  var KEROSIN = { 1: 2, 2: 5, 3: 12 };

  function opt(n, titel, text) {
    return '<div class="wm-opt' + (stufe() === n ? ' an' : '') + '" data-s="' + n + '">' +
      '<b>' + titel + '</b><span class="wm-kero">' + KEROSIN[n] + ' L</span>' +
      '<small>' + text + '</small></div>';
  }

  function feld(f) {
    var pflicht = f.pflicht || (f.pflichtWenn && f.pflichtWenn());
    var h = '<div class="wm-f" id="wm-w-' + f.id + '">' +
      '<label>' + f.label + (pflicht ? '<span class="wm-pf">*</span>' : '') +
      (f.hilfe ? ' <span class="fh" data-fh="' + f.hilfe + '">&#9432;</span>' : '') + '</label>';
    if (f.typ === 'select') {
      h += '<select id="' + f.id + '">';
      f.opt.forEach(function (o) { h += '<option value="' + o[0] + '">' + o[1] + '</option>'; });
      h += '</select>';
    } else {
      h += '<input id="' + f.id + '" type="' + (f.typ === 'number' ? 'number' : 'text') + '"' +
        (f.platzhalter ? ' placeholder="' + f.platzhalter + '"' : '') + '>';
    }
    return h + '</div>';
  }

  function block(id, titel, liste) {
    var alt = $(id);
    if (alt) alt.remove();
    var sichtbar = liste.filter(function (f) {
      return !f.vorhanden && (!f.wenn || f.wenn());
    });
    if (!sichtbar.length) return null;
    var d = document.createElement('div');
    d.className = 'wm-block'; d.id = id;
    d.innerHTML = '<h4>' + titel + '</h4>' + sichtbar.map(feld).join('');
    return d;
  }

  function zeichnen() {
    var wo = $('wm-ziel') ? $('wm-ziel').parentNode : null;
    if (!wo) return;
    var s = stufe();
    document.querySelectorAll('.wm-opt').forEach(function (o) {
      o.classList.toggle('an', parseInt(o.getAttribute('data-s'), 10) === s);
    });

    var alt = {};
    ['wm-b1', 'wm-b2', 'wm-b3'].forEach(function (id) {
      var b = $(id);
      if (b) { b.querySelectorAll('input,select').forEach(function (e) { alt[e.id] = e.value; }); b.remove(); }
    });

    var anker = $('wm-ampel') || null;
    /* v1017 · Stufe-1-Block: gilt fuer JEDE Stufe, deshalb ohne Bedingung. */
    var b1 = block('wm-b1', 'Baustatus', FELDER.stufe1);
    if (b1) {
      /* v1018 · Direkt hinter die Grundfelder, nicht ans Kartenende. Vorher
       * landete der Block hinter den Knoepfen, weil die Ampel dort haengt. */
      var vor1 = $('precHead');
      wo.insertBefore(b1, (vor1 && vor1.parentNode === wo) ? vor1 : anker);
    }
    if (s >= 2) {
      var b2 = block('wm-b2', 'Genauere Angaben', FELDER.stufe2);
      if (b2) wo.insertBefore(b2, anker);
    }
    if (s >= 3) {
      var b3 = block('wm-b3', 'Wertermittlung', FELDER.stufe3);
      if (b3) {
        /* Was automatisch passiert — damit niemand raetselt, warum nach
         * Grundstueck und Miteigentumsanteil nichts mehr kommt. */
        var au = document.createElement('div');
        au.className = 'fh-box';
        au.innerHTML = '<b>Wird automatisch ermittelt</b><br>'
          + 'Bodenrichtwert \u00fcber BORIS \u00b7 Liegenschaftszinssatz aus dem amtlichen '
          + 'Datenbestand, sonst nach \u00a7 256 BewG. Beides steht mit Herkunft im PDF.';
        b3.appendChild(au);

        /* Expertenfelder eingeklappt. */
        var det = document.createElement('div');
        det.style.cssText = 'margin-top:10px';
        det.innerHTML = '<div id="wm-exp-head" style="cursor:pointer;font-size:11.5px;'
          + 'color:var(--wl-c9a84c,#C9A84C)">\u25b8 Werte selbst setzen</div>'
          + '<div id="wm-exp-box" style="display:none;margin-top:8px">'
          + FELDER.experte.map(feld).join('')
          + '<div style="font-size:11px;opacity:.7;margin-top:4px">'
          + 'Nur n\u00f6tig, wenn der amtliche Abruf nichts liefert oder du eigene '
          + 'Werte aus dem Grundst\u00fccksmarktbericht hast.</div></div>';
        b3.appendChild(det);
        var h = det.querySelector('#wm-exp-head'), bx = det.querySelector('#wm-exp-box');
        h.addEventListener('click', function () {
          var auf = bx.style.display === 'none';
          bx.style.display = auf ? 'block' : 'none';
          h.textContent = (auf ? '\u25be' : '\u25b8') + ' Werte selbst setzen';
        });
        wo.insertBefore(b3, anker);
      }
    }
    /* Eingetragenes zurückschreiben — Hochschalten darf nichts verlieren. */
    Object.keys(alt).forEach(function (k) { if ($(k) && alt[k]) $(k).value = alt[k]; });

    ['baustatus', 'mea', 'lzs', 'brwAnp', 'brwAnpGrund', 'sanierungsjahr', 'spMiete', 'brwManuell', 'brwStichtag', 'bgf', 'sachwertfaktor'].forEach(function (id) {
      var e = $(id);
      if (e && !e._wm) { e._wm = 1; e.addEventListener('change', function () { zeichnen(); ampel(); }); }
    });
    if (window.Feldhilfe && window.Feldhilfe.neuLaden) window.Feldhilfe.neuLaden();
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * STUFENSTEUERUNG — das eigentliche Versprechen der Frage oben.
   * ───────────────────────────────────────────────────────────────────────
   * Bisher blendete die Stufenwahl nur ZUSAETZLICHE Felder ein; die
   * Grundfelder standen immer alle da. Damit war nicht erkennbar, was die
   * Auswahl ueberhaupt bewirkt.
   *
   * Das Formular hat bereits einen Aufklapper "Erweiterte Angaben"
   * (#precHead / #precBox) mit Zustand, Qualitaet, Energie und den Gewerken.
   * Wir muessen also nichts zerlegen, sondern nur steuern, was offen ist:
   *
   *   Stufe 1  Grundfelder. Aufklapper ausgeblendet.
   *   Stufe 2  + Aufklapper sichtbar und aufgeklappt.
   *   Stufe 3  + Wertermittlungsblock.
   *
   * Aufgeklappt wird nur beim Hochschalten, nicht bei jedem Neuzeichnen —
   * wer den Block zuklappt, soll das duerfen.
   * ═══════════════════════════════════════════════════════════════════════ */
  function stufenAnwenden(gewechselt) {
    var s = stufe();
    var kopf = $('precHead'), box = $('precBox'), caret = $('precCaret');
    if (kopf && box) {
      if (s === 1) {
        kopf.style.display = 'none';
        box.style.display = 'none';
        if (caret) caret.textContent = '\u25b8';
      } else {
        kopf.style.display = '';
        if (gewechselt) {
          box.style.display = '';
          if (caret) caret.textContent = '\u25be';
        }
      }
    }

    var id = 'wm-stufe-info';
    var alt = $(id);
    if (alt) alt.remove();
    var texte = {
      1: 'Es gen\u00fcgen Adresse, Objektart, Wohnfl\u00e4che und Zimmer.',
      2: 'Zus\u00e4tzlich Zustand, Qualit\u00e4t, Energieklasse und Ausstattung \u2014 der Block \u201eErweiterte Angaben\u201c ist daf\u00fcr aufgeklappt.',
      3: 'Zus\u00e4tzlich Grundst\u00fcck, Miteigentumsanteil und Bodenrichtwert im Block \u201eWertermittlung\u201c.'
    };
    var z = $('wm-ziel');
    if (z) {
      var d = document.createElement('div');
      d.id = id;
      d.style.cssText = 'margin-top:9px;padding:7px 9px;border-radius:5px;'
        + 'background:rgba(201,168,76,.10);font-size:11.5px;line-height:1.5';
      d.textContent = texte[s] || '';
      z.appendChild(d);
    }
  }

  /* ── Pflichtfeld-Ampel ─────────────────────────────────────────────────── */
  function pruefe(v) {
    if (stufe() < v.ab) return { zeichen: '·', klasse: 'wm-nein', text: 'ab Stufe ' + v.ab };
    /* v1018 · Zwischenstufe: es gibt das Verfahren, nur ungenauer. */
    if (v.genauerAb && stufe() < v.genauerAb) {
      return { zeichen: '○', klasse: 'wm-warn',
        text: 'indikativ mit Pauschalwerten — genau ab Stufe ' + v.genauerAb };
    }
    if (v.nichtWenn && v.nichtWenn()) return { zeichen: '\u2715', klasse: 'wm-nein', text: v.nichtGrund };
    var fehlt = v.pflicht.filter(function (id) { return !wert(id); });
    if (fehlt.length) {
      return { zeichen: '\u26a0', klasse: 'wm-warn', fehlt: fehlt,
        text: 'fehlt: ' + fehlt.map(bez).join(', ') };
    }
    var offen = (v.empfohlen || []).filter(function (id) { return !wert(id); });
    if (offen.length) {
      return { zeichen: '\u2713', klasse: 'wm-ok', fehlt: offen,
        text: 'rechnet — genauer mit: ' + offen.map(bez).join(', ') };
    }
    return { zeichen: '\u2713', klasse: 'wm-ok', text: 'vollständig' };
  }

  function bez(id) {
    var e = $('wm-w-' + id);
    if (e) return e.querySelector('label').textContent.replace('*', '').replace('\u24d8', '').trim();
    var l = $(id) && $(id).parentNode ? $(id).parentNode.querySelector('label') : null;
    return l ? l.textContent.trim() : id;
  }

  /* v1027 · Kein Bericht mit Luecken.
   * Bisher konnte man auf Stufe 3 ohne Miteigentumsanteil erzeugen — und
   * bekam einen Bodenwert ueber das ganze Grundstueck. Der Knopf bleibt
   * jetzt gesperrt, solange ein Pflichtfeld des gewaehlten Umfangs fehlt,
   * und sagt welches. */
  /* v1029 · Der Knopftext wird NICHT mehr ueberschrieben.
   * Vorher stand dauerhaft "Es fehlt: ..." im Knopf, auch wenn alles
   * ausgefuellt war. Ursache: die Anwendung setzt den Knopftext selbst
   * ("erstelle…" mit Spinner). Mein _wmAlt hat je nach Zeitpunkt diesen
   * Zwischenstand als Original gemerkt und danach nie mehr sauber
   * zurueckgeschrieben — zwei Schreiber auf demselben Element.
   *
   * Jetzt: nur disabled setzen, der Hinweis steht in einem eigenen Feld
   * darueber. Ein Element, ein Schreiber. */
  function knopfFinden() {
    return document.querySelector('#btn-report, #createReport, [data-mb-create]')
      || Array.prototype.find.call(document.querySelectorAll('button'), function (b) {
        return /marktbericht erstellen/i.test(b.textContent || '');
      });
  }

  function knopfSperren() {
    var knopf = knopfFinden();
    if (!knopf) return;

    var fehlt = [];
    VERFAHREN.forEach(function (v) {
      if (stufe() < v.ab) return;
      if (v.nichtWenn && v.nichtWenn()) return;
      v.pflicht.forEach(function (id) { if (!wert(id) && fehlt.indexOf(id) < 0) fehlt.push(id); });
    });
    if (stufe() >= 3 && istWohnung() && !wert('mea') && fehlt.indexOf('mea') < 0) fehlt.push('mea');

    var id = 'wm-fehlt';
    var box = document.getElementById(id);
    if (!fehlt.length) {
      knopf.disabled = false;
      knopf.style.opacity = '';
      knopf.title = '';
      if (box) box.remove();
      return;
    }

    knopf.disabled = true;
    knopf.style.opacity = '.55';
    var text = 'Es fehlt noch: ' + fehlt.map(bez).join(' \u00b7 ');
    knopf.title = text;
    if (!box) {
      box = document.createElement('div');
      box.id = id;
      box.style.cssText = 'margin:8px 0;padding:8px 10px;border-radius:6px;font-size:11.5px;'
        + 'line-height:1.5;background:rgba(184,98,92,.10);'
        + 'border-left:2px solid var(--wl-b8625c,#B8625C)';
      if (knopf.parentNode) knopf.parentNode.insertBefore(box, knopf);
    }
    box.textContent = text;
  }

  function ampel() {
    var wo = $('wm-ziel') ? $('wm-ziel').parentNode : null;
    if (!wo) return;
    var d = $('wm-ampel');
    if (!d) {
      d = document.createElement('div');
      d.className = 'wm-ampel'; d.id = 'wm-ampel';
      wo.appendChild(d);
    }
    var h = '<h4 style="margin:0 0 8px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#8a8a93">Was der Bericht enthalten wird</h4>';
    VERFAHREN.forEach(function (v) {
      var r = pruefe(v);
      h += '<div class="wm-z" data-ziel="' + ((r.fehlt && r.fehlt[0]) || '') + '">' +
        '<span class="wm-i ' + r.klasse + '">' + r.zeichen + '</span>' +
        '<span style="flex:1"><b style="color:#c8c8d0">' + v.name + '</b> &nbsp;<span>' + r.text + '</span></span></div>';
    });
    d.innerHTML = h;
    knopfSperren();
    d.querySelectorAll('.wm-z').forEach(function (z) {
      z.addEventListener('click', function () {
        var t = z.getAttribute('data-ziel');
        if (t && $(t)) { $(t).scrollIntoView({ behavior: 'smooth', block: 'center' }); $(t).focus(); }
      });
    });
  }

  /* ── Payload ───────────────────────────────────────────────────────────── */
  function payload() {
    var z = parseFloat(wert('mea'));
    return {
      wert_stufe: stufe(),
      baustatus: wert('baustatus') || 'bestand',
      first_time_use: /neubau_erstbezug|neubau_im_bau/.test(wert('baustatus')) || wert('cond') === 'erstbezug',
      refurbished: /saniert/.test(wert('baustatus')) || /saniert/.test(wert('cond')),
      reconstruction_year: parseInt(wert('sanierungsjahr'), 10) || null,
      mea_pct: isFinite(z) && z > 0 ? z : null,
      lzs_pct: parseFloat(wert('lzs')) || null,
      land_value_manual: parseFloat(wert('brwManuell')) || null,
      land_value_stichtag: wert('brwStichtag') || null,
      brw_anpassung_pct: parseFloat(wert('brwAnp')) || null,
      brw_anpassung_grund: wert('brwAnpGrund') || null,
      bgf: parseFloat(wert('bgf')) || null,
      sachwertfaktor: parseFloat(wert('sachwertfaktor')) || null,
      stellplatz_miete_monat: parseFloat(wert('spMiete')) || null,
      /* v1055-WFELD-1 · Seit v1047 stehen diese drei im Formular und wurden
       * nie mitgeschickt. app.js sammelt den Block nicht selbst ein, sondern
       * uebernimmt payload() als Ganzes — wer hier fehlt, existiert fuer den
       * Bericht nicht. */
      /* v1057-WSON-4 · Kueche, Moeblierung, Werbeflaeche. Getrennt von der
       * Kaltmiete, weil die Vergleichsmiete aus reinen Wohnungsangeboten
       * stammt — und getrennt kapitalisiert, weil sie nicht am Gebaeude
       * haengt. */
      sonstige_jahr: parseFloat(wert('sonstEinnahmen')) || null,
      standardstufe: parseFloat(wert('standardstufe')) || null,
      grundriss: wert('grundriss') || null,
      mod_punkte: wert('modGrad') !== '' ? parseFloat(wert('modGrad')) : null,
      bwk_modus: stufe() >= 3 ? 'normiert' : null,
    };
  }

  /* ── Start ─────────────────────────────────────────────────────────────── */
  function start() {
    /* v1012 · Die Zielfrage sass mitten im Formular zwischen Balkon und Garten,
     * weil ich sie an das Grundstuecksfeld gehaengt habe. Sie gehoert an den
     * Anfang: erst die Frage, was der Bericht leisten soll, dann die Felder.
     * Anker ist deshalb das ERSTE Feld des Formulars (Adresse), und die
     * Zielfrage wird davor gesetzt. */
    var erst = $('address') || $('ptype') || $('area');
    if (!erst) return;
    var wo = null, k = erst;
    for (var i = 0; i < 6 && k; i++) {
      k = k.parentNode;
      if (k && (k.tagName === 'FORM' || (k.className && /card|panel|form|box/i.test(String(k.className))))) { wo = k; break; }
    }
    if (!wo) wo = erst.parentNode ? erst.parentNode.parentNode : null;
    if (!wo) return;
    stil();
    zielfrage(wo);
    zeichnen();
    stufenAnwenden(false);
    ampel();
    /* v1029 · 'living' gibt es nicht — das Feld heisst 'area'. Und geprueft
     * wird auch bei Eingabe, nicht erst beim Verlassen des Feldes. */
    ['ptype', 'area', 'year', 'cond', 'quality', 'plot', 'units', 'mea'].forEach(function (id) {
      var e = $(id);
      if (e && !e._wm) {
        e._wm = 1;
        e.addEventListener('change', ampel);
        e.addEventListener('input', ampel);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Wertermittlung = { payload: payload, stufe: stufe, setStufe: setStufe, neuZeichnen: zeichnen };
})();
