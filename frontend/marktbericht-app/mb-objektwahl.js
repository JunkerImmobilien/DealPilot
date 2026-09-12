'use strict';
/* ═══════════════════════════════════════════════════════════════
   v567 — Bestandsobjekt-Auswahl im Marktbericht (additiv)
   Fix ggü v566:
   - Dropdown wird jetzt sicher befuellt (expliziter Bearer-Token aus localStorage).
   - Label = "<seq_no> · <Adresse komplett>".
   - Felder-Mapping gegen die ECHTEN kurzen data-Keys (str/hnr/plz/ort/nkm/ze/kp/wfl/
     zimmer/baujahr/etage/gsfl/garagen/objart/ausst/modernis/ek).
   - Detail wird per /objects/{id} geladen (data-Objekt).

   v1138-MBREF: Kommt der Aufruf mit ?ref aus der App, waehlt das Dropdown
   das Objekt selbst vor und faehrt denselben Uebernahmeweg — vorher blieben
   acht gepflegte Angaben leer, weil die App nur fuenf Werte an die URL haengt.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  function $(id) { return document.getElementById(id); }
  var OBJ_API = '/api/v1/objects';

  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function authHeaders() { var t = token(); return t ? { 'Authorization': 'Bearer ' + t } : {}; }

  /* ===================================================================
     v1333 - WAS DER NUTZER GETIPPT HAT, WIRD NICHT UEBERSCHRIEBEN
     ===================================================================
     Marcels Befund, woertlich: "beim ersten mal habe ich eine andere
     adresse eingegeben und alle werte angegeben und dann hat er einfach
     das letzte objekt genommen ... erst beim 2 mal aendern hat er die
     neue Adresse uebernommen."

     GEMESSEN am 12.09.2026 im Staging-iframe, Objekt 2026-1033:

       load     @128 ms
       getippt  @129 ms   "Meine Teststrasse 1, 38300 Wolfenbuettel"
       @605 ms  ->        "32120 Hiddenhausen"

     Die eigene Eingabe stand 476 ms, dann war sie weg. Kein Fehler, keine
     Meldung - das Feld sah danach aus, als haette man nie getippt.

     URSACHE, nicht Symptom: zwischen dem Laden des Formulars und
     `fillFromData()` liegen ZWEI Netzrunden - erst die Objektliste
     (`buildDropdown`), dann das Detail (`loadDetail`). Der Auto-Select aus
     `?ref` feuert also erst eine halbe Sekunde nach dem Laden, und
     `setVal()` schrieb bis dahin bedingungslos. Wer schnell tippt, tippt
     gegen einen Fetch an - und beim zweiten Versuch ist der Fetch durch,
     deshalb hielt es dann. Genau das hat Marcel beschrieben.

     Die Regel gilt ab jetzt in dieser ganzen Datei:
     EIN FELD, DAS DER NUTZER SELBST ANGEFASST HAT, GEHOERT IHM.

     Gemerkt wird nur, was aus einem ECHTEN Ereignis kommt (`isTrusted`) -
     die Fuellwege loesen selbst `input` aus, die duerfen sich nicht
     gegenseitig aussperren. Waehlt der Nutzer im Dropdown von Hand ein
     Objekt, ist das eine ausdrueckliche Ansage: dann wird das Register
     geleert und wirklich alles uebernommen. Nur der stille Weg ueber
     `?ref` muss sich zurueckhalten. */
  /* === v1333b - EIGENER FEHLER, ZURUECKGENOMMEN =====================
     Die Regel oben haengt allein an `isTrusted`. Das ist richtig gegen
     die Fuellwege, aber es ist die falsche EINZIGE Sicherung: sie merkt
     nur, was ueber ein Tastaturereignis kam. Beim Nachmessen des Fixes
     fiel es auf - der Testaufbau setzte `el.value` und feuerte `input`,
     das Ereignis war synthetisch, das Register blieb leer, und der Wert
     wurde wieder ueberschrieben. Die Messung war rot, obwohl die Regel
     griff; sie haette umgekehrt genauso gut gruen sein koennen.

     Deshalb gibt es eine zweite, ereignisfreie Sicherung: WAS IM FELD
     STEHT, WIRD MIT DEM VERGLICHEN, WAS ZULETZT VON HIER HINEINGESCHRIEBEN
     WURDE. Weicht es ab, hat es jemand anderes geaendert - egal wie.

     Der Ausgangsstand wird beim Laden des Moduls genommen; die harten
     Vorgabewerte aus index.html (Adresse, 80 m2, 3 Zimmer) und das
     `prefill()` aus der URL stehen zu dem Zeitpunkt schon da und gelten
     damit als ueberschreibbar - so wie es sein muss.

     Felder, die erst spaeter entstehen (wertermittlung.js baut sie je
     Stufe), haben keinen Ausgangsstand; fuer sie gilt der Wert beim
     ersten Zugriff. */
  var _stand = Object.create(null);
  /* === v1333c - DER STAND MUSS VOR DEM NUTZER DA SEIN ===============
     Zweiter eigener Fehler an derselben Stelle, wieder beim Nachmessen
     gefunden. Der Stand wurde LAZY erfasst - beim ersten `setVal` fuer
     ein Feld. Das ist genau zu spaet: der erste `setVal` ist der Aufruf,
     gegen den die Sperre schuetzen soll. Er hat den bereits getippten
     Wert als "Ausgangsstand" eingetragen, mit sich selbst verglichen und
     sich durchgewinkt.

     Gemessen ueber einen Setter auf #address:
       "32120 Hiddenhausen" << setVal (mb-objektwahl.js:151)
                            << fillFromData << uebernehmen
     Die neue Fassung war geladen, die Sperre lief trotzdem ins Leere.

     Jetzt wird der Stand genommen, sobald das Modul laeuft - da steht
     das Formular (die Skripte haengen am Ende von index.html) und noch
     keine Nutzereingabe. Felder, die wertermittlung.js erst je Stufe
     baut, werden beim Entstehen erfasst; ein Beobachter ist hier kein
     Luxus, sondern die einzige Stelle, an der ihr Ausgangswert ueberhaupt
     einmal sichtbar ist. */
  function _standErfassen(wurzel) {
    var n = 0;
    try {
      var els = (wurzel || document).querySelectorAll('input[id], select[id], textarea[id]');
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        if (e.id in _stand) continue;
        _stand[e.id] = String(e.value == null ? '' : e.value);
        n++;
      }
    } catch (e) {}
    return n;
  }
  _standErfassen(document);
  try {
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var add = ms[i].addedNodes;
        for (var j = 0; j < add.length; j++) {
          if (add[j] && add[j].nodeType === 1) _standErfassen(add[j].parentNode || add[j]);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  window._mbStand = function (id) { return id ? _stand[id] : _stand; };

  /* v1333d: Was uebersprungen wurde, muss der Nutzer erfahren. Eine
     Uebernahme, die "fertig" meldet und dabei fuenf Felder ausgelassen
     hat, ist schlimmer als eine, die nichts tut - sie erzeugt Vertrauen,
     das nicht gedeckt ist. */
  var _uebersprungen = [];
  var _bezugGeloest = false;


  var _angefasst = Object.create(null);

  function _merken(ev) {
    if (!ev || !ev.isTrusted) return;
    var t = ev.target;
    if (!t || !t.id) return;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName || '')) return;
    _angefasst[t.id] = 1;
    if (t.id === 'address') _adresseGeaendert();
  }
  document.addEventListener('input', _merken, true);
  document.addEventListener('change', _merken, true);
  window._mbAngefasst = function (id) {
    return id ? !!_angefasst[id] : Object.keys(_angefasst);
  };

  /* === v1333 - Der Objektbezug folgt der Adresse =====================
     Zweiter Teil desselben Befunds, und der teurere. `window._mbwRef`
     wird beim Dropdown-Klick gesetzt (unten) und NIE wieder geloest. Wer
     danach eine andere Adresse eintraegt, bekommt einen Bericht, der

       - unter dem ALTEN Objekt abgelegt wird (external_ref, app.js:398),
       - das ALTE Label traegt (object_label, app.js:399),
       - und den Preis des alten Objekts bekommt - samt "ist bereits
         bezahlt" fuer eine Adresse, fuer die nie jemand gezahlt hat
         (mb-stufen.js:206 ff.).

     Deshalb: aendert sich die Adresse und passt sie nicht mehr zur
     geladenen, ist der Bezug weg. Sichtbar, nicht still - ein Bericht,
     der beim falschen Objekt landet, faellt sonst erst Wochen spaeter
     auf. */
  var _refAdresse = null;
  function _norm(x) { return String(x || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function _adresseGeaendert() {
    var el = $('address'); if (!el) return;
    if (!window._mbwRef || !_refAdresse) return;
    if (_norm(el.value) === _refAdresse) return;
    window._mbwRef = null;
    window._mbwLabel = null;
    _refAdresse = null;
    _bezugGeloest = true;   /* v1333d */
    var sel = $('mbow-select'); if (sel) { try { sel.selectedIndex = 0; } catch (e) {} }
    var note = $('mbow-note');
    if (note) {
      note.innerHTML = 'Andere Adresse \u2014 der Bericht wird <b>keinem</b> Bestandsobjekt '
        + 'zugeordnet. W\u00e4hl oben ein Objekt, wenn er dorthin geh\u00f6ren soll.';
      note.style.color = 'var(--wl-c9a84c, #C9A84C)';
    }
    try { window.dispatchEvent(new CustomEvent('mb:object-picked', { detail: { ref: null } })); } catch (e) {}
    try {
      if (window.DealPilotMbStufen && window.DealPilotMbStufen.preisHolen) window.DealPilotMbStufen.preisHolen();
    } catch (e) {}
  }


  function setVal(id, v) {
    var el = $(id); if (!el || v == null || v === '') return;
    /* v1333: Nutzereingabe schlaegt Objektdaten. Siehe Block oben. */
    if (_angefasst[id]) {
      try { console.info('[v1333] ' + id + ' bleibt stehen - vom Nutzer gesetzt.'); } catch (e) {}
      if (_uebersprungen.indexOf(id) < 0) _uebersprungen.push(id);
      return;
    }
    /* v1333b: dieselbe Regel ohne Ereignis - der Wert selbst verraet es.
       `data-mbst-auto` markiert einen Wert, den die Stufenleiste selbst
       vorbelegt hat (Wohneinheiten bei ETW/EFH/DHH/RH); der gilt nicht als
       Nutzereingabe und darf von echten Objektdaten abgeloest werden. */
    var _auto = false;
    try { _auto = !!(el.getAttribute && el.getAttribute('data-mbst-auto')); } catch (e) {}
    if (!(id in _stand)) _stand[id] = '';   /* v1333c: nie den aktuellen Wert - siehe oben */
    if (!_auto && String(el.value == null ? '' : el.value) !== _stand[id]) {
      try { console.info('[v1333b] ' + id + ' bleibt stehen - wurde seit dem Laden geaendert.'); } catch (e) {}
      if (_uebersprungen.indexOf(id) < 0) _uebersprungen.push(id);
      return;
    }

    el.value = v;
    _stand[id] = String(el.value == null ? '' : el.value);   /* v1333b */
    /* v1135-WMBACK-2 · Ein Auswahlfeld nimmt einen unbekannten Wert nicht
     * an — es bleibt STILL leer. Beim Messen selbst hereingefallen: die
     * Werte standen im Objekt, das Feld war trotzdem leer, und nichts
     * sagte warum. Passiert echt, wenn eine Optionsliste sich zwischen
     * zwei Fassungen aendert. Kein Verhalten geaendert, nur sichtbar
     * gemacht. */
    /* v1136d-WMTAB-1 · Dieselbe stille Ablehnung bei Zahlenfeldern. Ein
     * <input type="number"> nimmt "7,06" NICHT an und bleibt leer — das
     * Hauptprogramm speichert aber deutsche Schreibweise, so wie der
     * Nutzer sie tippt. Auf Produktion gemessen: Objekt Dealstreet 999
     * fuehrt mea = "7,06", das Berichtsfeld blieb leer, und ohne
     * Miteigentumsanteil erreicht eine Wohnung Stufe 3 nicht.
     *
     * Nur der eindeutige Fall wird umgeschrieben: ist ein Komma da, ist es
     * das Dezimaltrennzeichen und ein Punkt der Tausendertrenner. Ein
     * Punkt ALLEIN bleibt unangetastet — "1.15" ist ein Sachwertfaktor,
     * "1.570" waeren 1570 m2, und das laesst sich nicht unterscheiden,
     * ohne zu raten. Der Fall steht als Rest im Backlog.
     *
     * Erst nach dem Fehlschlag, damit sich an funktionierenden Werten
     * nichts aendert. */
    if (el.tagName === 'INPUT' && el.type === 'number' && el.value === '' && /,/.test(String(v))) {
      el.value = String(v).trim().replace(/\./g, '').replace(',', '.');
    }
    if (el.tagName === 'INPUT' && el.type === 'number' && el.value === '') {
      try {
        console.warn('[mbow] ' + id + ': gespeicherter Wert "' + v +
          '" ist keine gueltige Zahl -> Feld bleibt leer.');
      } catch (e) {}
    }
    if (el.tagName === 'SELECT' && String(el.value) !== String(v)) {
      try {
        console.warn('[mbow] ' + id + ': gespeicherter Wert "' + v +
          '" ist keine gueltige Option -> Feld bleibt leer. Optionen: ' +
          [].slice.call(el.options).map(function (o) { return o.value; }).join('|'));
      } catch (e) {}
    }
    try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }
  function num(v) { if (v == null || v === '') return 0; return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0; }

  function mapPtype(raw) {
    if (!raw) return null;
    var s = String(raw).toLowerCase();
    if (/doppelhaus|dhh/.test(s)) return 'DHH';
    if (/reihenhaus|reihen|\brh\b/.test(s)) return 'RH';
    if (/eigentumswohnung|etw|wohnung|whg|apartment/.test(s)) return 'ETW';
    if (/einfamilien|efh/.test(s)) return 'EFH';
    if (/mehrfamilien|mfh/.test(s)) return 'MFH';
    if (/buero|b\u00fcro/.test(s)) return 'BUERO';
    if (/geschaeft|gesch\u00e4ft|gesch/.test(s)) return 'GESCH';
    if (/hotel/.test(s)) return 'HOTEL';
    if (/gewerbe|industrie|gew/.test(s)) return 'GEW';
    if (/garage|stellplatz|gar/.test(s)) return 'GAR';
    if (/haus/.test(s)) return 'EFH';
    return null;
  }
  /* v1229b · EINE Zuordnung, nicht zwei. `fillInputsFromDpkt()` in app.js
     schrieb bis hierher 'haus' bzw. 'wohnung' in dasselbe Auswahlfeld —
     Werte, die es dort nicht gibt. Gemessen im Browser: der Zuweisung folgt
     `selectedIndex = -1` und `value = ''`, die Objektart blieb also beim
     .dpkt-Import IMMER leer. Statt die Tabelle ein zweites Mal zu tippen,
     steht sie hier und wird dort geholt. */
  window._mbMapPtype = mapPtype;
  /* v1136c-WMTAB-1 · Zwei gemessene Fehler in dieser Zuordnung.
   *
   * Die Haupt-App fuehrt fuenf Zustaende (ds2_zustand in index.html:991):
   * neubau, gut, normal, renovierungsbeduerftig, stark_sanierungsbeduerftig.
   * Das Berichtsfeld cond fuehrt sechs andere: neuwertig, saniert,
   * modernisiert, gepflegt, normal, renovierungsbeduerftig.
   *
   * 1. `gut` traf keine einzige Regel und ergab null — das Feld blieb leer.
   *    Zustand ist Pflicht fuer die Marktpreisindikation, und ohne Stufe 2
   *    ist Stufe 3 unerreichbar: der haeufigste Zustandswert ueberhaupt
   *    sperrte den Bericht. Im Browser gemessen an Hermannstr. 9
   *    (ds2_zustand='gut'): cond leer, Stufe 2 "fehlt: Zustand",
   *    Stufe 3 nicht erreichbar.
   *
   * 2. `stark_sanierungsbeduerftig` wurde zu `saniert`. Die alte
   *    Schleife verglich fuenf Anfangsbuchstaben, und "sanie" steckt in
   *    "sanierungsbeduerftig". Der schlechteste Zustand kam als
   *    instandgesetzt an — ein Fehler mit falschem Vorzeichen, der den
   *    Wert hebt statt ihn zu senken.
   *
   * Deshalb jetzt eine ausdrueckliche Tabelle statt einer Heuristik. Die
   * beiden Zuordnungen, die eine fachliche Entscheidung sind:
   *   gut                        -> gepflegt   (die Liste kennt kein "gut";
   *                                 gepflegt ist der Nachbar unter neuwertig)
   *   stark_sanierungsbeduerftig -> renovierungsbeduerftig (schlechteste
   *                                 Stufe, die das Berichtsfeld anbietet)
   * Der unscharfe Weg bleibt fuer Freitext aus Altbestaenden erhalten —
   * aber erst NACH der Tabelle, und "sanierungsbeduerftig" wird vorher
   * abgefangen. */
  var COND_MAP = {
    'neubau': 'neuwertig', 'kernsaniert': 'neuwertig', 'neuwertig': 'neuwertig',
    'gut': 'gepflegt', 'gepflegt': 'gepflegt',
    'normal': 'normal',
    'saniert': 'saniert', 'modernisiert': 'modernisiert',
    'renovierungsbeduerftig': 'renovierungsbeduerftig',
    'stark_sanierungsbeduerftig': 'renovierungsbeduerftig',
    'sanierungsbeduerftig': 'renovierungsbeduerftig'
  };
  function mapCond(raw) {
    if (!raw) return null;
    var s = String(raw).toLowerCase().trim();
    if (COND_MAP[s]) return COND_MAP[s];
    /* Freitext: bedarf zuerst — sonst gewinnt wieder "sanie" aus
     * "sanierungsbeduerftig" gegen "saniert". */
    if (/bed(ue|ü)rftig/.test(s)) return 'renovierungsbeduerftig';
    if (/neubau|kernsaniert|neuwertig/.test(s)) return 'neuwertig';
    var opts = ['modernisiert', 'gepflegt', 'saniert', 'normal'];
    for (var i = 0; i < opts.length; i++) { if (s.indexOf(opts[i].slice(0, 5)) > -1) return opts[i]; }
    return null;
  }

  // Befuellt die mb-Eingabefelder aus dem data-Objekt eines DealPilot-Objekts.
  function fillFromData(d) {
    if (!d || typeof d !== 'object') return;
    // Adresse
    var addr = [
      [d.str, d.hnr].filter(Boolean).join(' '),
      [d.plz, d.ort].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ');
    if (addr) setVal('address', addr);
    /* v1333: merken, WELCHE Adresse zum geladenen Objekt gehoert - und
       sofort pruefen. Hat der Nutzer laengst eine andere getippt, hat
       `setVal` sie oben stehen lassen; dann darf auch der Objektbezug
       nicht bleiben. */
    if (addr) { _refAdresse = _norm(addr); _adresseGeaendert(); }

    // Typ
    var pt = mapPtype(d.objart); if (pt) setVal('ptype', pt);
    // Flaeche / Zimmer / Baujahr / Etage
    setVal('area', d.wfl);
    setVal('rooms', d.zimmer);
    setVal('year', d.baujahr);
    setVal('floor', d.etage);
    // Kaufpreis
    setVal('price', d.kp);
    // Kaltmiete gesamt = nkm + ze
    var rent = num(d.nkm) + num(d.ze);
    if (rent > 0) setVal('rent', rent);
    // Grundstueck
    setVal('plot', d.gsfl);
    // Garagen -> garages, Aussenstellplaetze -> outdoor (separate Felder)
    if (num(d.garagen) > 0) setVal('garages', d.garagen);
    var aus = d.stellpl_aussen || d.aussenstellplaetze;
    if (num(aus) > 0) setVal('outdoor', aus);
    // Badezimmer
    setVal('baths', d.bad_anz);
    // Balkon/Terrasse -> balcony
    setVal('balcony', d.balkon_flae);
    // Garten -> garden (falls vorhanden)
    setVal('garden', d.garten_flae || d.garten);
    // Modernisierungsjahr
    setVal('modyear', d.modernis);
    // Energieklasse: ds2_energie zuerst (ek ist oft 0/leer). 'A+' -> 'A'.
    var en = d.ds2_energie || d.energieklasse || d.ek;
    if (en && String(en) !== '0') setVal('energy', String(en).toUpperCase().trim()[0]);
    // Zustand: ds2_zustand zuerst; 'neubau'/'kernsaniert' -> neuwertig
    var zu = mapCond(d.ds2_zustand || d.zustand); if (zu) setVal('cond', zu);
    // Ausstattung
    var au = d.ausst; if (au) { var a = String(au).toLowerCase(); var amap = { 'einfach': 'einfach', 'normal': 'normal', 'gehoben': 'gehoben', 'luxus': 'luxurioes', 'luxuriös': 'luxurioes', 'stark gehoben': 'luxurioes' }; if (amap[a]) setVal('quality', amap[a]); }
    // Wohneinheiten (MFH)
    setVal('units', d.me_anz || d.einheiten);

    /* v1135-WMBACK-1 \u00b7 Die Wertermittlungsangaben zurueck ins Formular.
     *
     * Bis hierher war die Objektwahl eine Einbahnstrasse in die andere
     * Richtung: _mbBuildObjData() schreibt 38 Wertermittlungsfelder ins
     * Objekt (v1072/v1074/v1121), v1134 sorgt dafuer, dass sie dort
     * stehen bleiben \u2014 aber gelesen hat sie nie jemand. Wer sein Objekt
     * hier waehlte, bekam 15 Grundfelder und musste Hinterland, NHK, die
     * neun Gewerke und die fuenf Bauteile jedes Mal neu tippen.
     *
     * Zwei Namen las die Objektwahl ausserdem falsch: _mbBuildObjData()
     * schreibt `baeder` und `ausstattung`, gelesen wurde `bad_anz` und
     * `ausst`. Beide jetzt als Rueckfalle mit drin. */
    setVal('baths', d.bad_anz || d.baeder);
    if (!$('quality') || !$('quality').value) {
      var au2 = d.ausst || d.ausstattung;
      if (au2) {
        var a2 = String(au2).toLowerCase();
        var am2 = { 'einfach': 'einfach', 'normal': 'normal', 'gehoben': 'gehoben',
                    'luxus': 'luxurioes', 'luxuri\u00f6s': 'luxurioes', 'stark gehoben': 'luxurioes' };
        if (am2[a2]) setVal('quality', am2[a2]);
      }
    }
    var offen = fuelleWertermittlung(d);
    if (offen.length) beobachteFormular(d, offen);

    /* === v1333d - Die Schlussmeldung sagt die Wahrheit ================
       Sie meldete bisher immer dasselbe: "Objektdaten uebernommen". Seit
       v1333 kann die Uebernahme Felder AUSLASSEN - naemlich die, die der
       Nutzer selbst gefuellt hat. Eine Erfolgsmeldung, die das
       verschweigt, ist genau die Sorte Meldung, die man spaeter teuer
       bezahlt. */
    var note = $('mbow-note');
    if (note) {
      var _t = '\u2713 Objektdaten \u00fcbernommen';
      var _farbe = '#3FA56C';
      if (_uebersprungen.length) {
        var _namen = _uebersprungen.map(function (id) {
          var l = null;
          try {
            var el2 = $(id);
            var lab = el2 && el2.closest ? el2.closest('div') : null;
            var lb = lab ? lab.querySelector('label') : null;
            if (lb) l = String(lb.textContent || '').split('\u2014')[0].trim();
          } catch (e) {}
          return l || id;
        });
        _t += ' \u2014 <b>' + _namen.join(', ') + '</b> '
            + (_namen.length === 1 ? 'blieb' : 'blieben')
            + ' stehen, weil du das selbst eingetragen hast.';
        _farbe = 'var(--wl-c9a84c, #C9A84C)';
      } else {
        _t += ' \u2014 pr\u00fcfen und \u201eMarktbericht erstellen\u201c klicken.';
      }
      if (_bezugGeloest) {
        _t += '<br>Die Adresse geh\u00f6rt nicht zu diesem Objekt \u2014 der Bericht wird '
            + '<b>keinem</b> Bestandsobjekt zugeordnet.';
        _farbe = 'var(--wl-c9a84c, #C9A84C)';
      }
      note.innerHTML = _t;
      note.style.color = _farbe;
    }
    _uebersprungen = [];
    _bezugGeloest = false;

  }

  /* Speicherschluessel -> Formular-Id. Die Namen stammen 1:1 aus
   * _mbBuildObjData() in marktbericht-app/app.js; nichts ist neu benannt. */
  var WM_MAP = [
    ['mea_pct', 'mea'], ['lzs_pct', 'lzs'], ['baustatus', 'baustatus'],
    ['bgf', 'bgf'], ['sonstige_jahr', 'sonstEinnahmen'],
    ['stellplatz_miete_monat', 'spMiete'], ['sanierungsjahr', 'sanierungsjahr'],
    ['nutzung', 'usage'], ['modernis_grad', 'modern'],
    ['standardstufe', 'standardstufe'], ['grundriss', 'grundriss'], ['mod_punkte', 'modGrad'],
    ['nhk_haus', 'nhkHaus'], ['nhk_geschosse', 'nhkGeschosse'], ['nhk_dach', 'nhkDach'],
    ['hinterland_qm', 'hinterlandFlaeche'], ['hinterland_eur_qm', 'hinterlandWert'],
    ['hinterland_rentierlich', 'hinterlandRent'],
    ['garagen_bgf_qm', 'garagenBgf'], ['garagen_stufe', 'garagenStufe'],
    ['aussenanlagen_pct', 'aussenPct'], ['aussenanlagen', 'aussenanlagen'],
    ['bes_bauteile', 'besBauteile'], ['sachwertfaktor', 'sachwertfaktor'],
    ['ausst_aussenwaende', 'ausstAussenwaende'], ['ausst_dach', 'ausstDach'],
    ['ausst_fenster', 'ausstFenster'], ['ausst_innenwaende', 'ausstInnenwaende'],
    ['ausst_decken', 'ausstDecken'], ['ausst_fussboeden', 'ausstFussboeden'],
    ['ausst_sanitaer', 'ausstSanitaer'], ['ausst_heizung', 'ausstHeizung'],
    ['ausst_technik', 'ausstTechnik'],
    ['btl_gauben', 'btlGauben'], ['btl_balkone', 'btlBalkone'], ['btl_vordach', 'btlVordach'],
    ['btl_terrassen', 'btlTerrassen'], ['btl_sonstige', 'btlSonstige'],
    ['brw_manuell', 'brwManuell'], ['brw_stichtag', 'brwStichtag'],
    ['brw_anpassung_pct', 'brwAnp'], ['brw_anpassung_grund', 'brwAnpGrund'],
    ['eq_roof', 'eq_roof'], ['eq_walls', 'eq_walls'], ['eq_windows', 'eq_windows'],
    ['eq_heating', 'eq_heating'], ['eq_bath', 'eq_bath'], ['eq_floor', 'eq_floor'],
    ['eq_guest_wc', 'eq_guest_wc'], ['eq_store_room', 'eq_store_room']
  ];

  /* Setzt alles, was JETZT schon im DOM steht. Zurueck kommt, was noch fehlt. */
  function fuelleWertermittlung(d) {
    /* v1136b-WMTAB-1 · Der Miteigentumsanteil steht an zwei Schluesseln: das
     * Hauptprogramm fuehrt ihn seit jeher als `mea`, der Marktbericht
     * schreibt ihn als `mea_pct` zurueck. Wer ihn im Objekt-Reiter gepflegt
     * hat und nie einen Bericht erzeugte, hatte hier ein leeres Feld — und
     * ohne Miteigentumsanteil erreicht eine Wohnung Stufe 3 gar nicht
     * erst, der ganze Wertermittlungsblock erscheint dann nicht.
     *
     * Der Rueckfall steht am DATENSATZ, nicht in der Schleife unten. In
     * v1136 stand er dort — gemessen im Browser blieb das Feld trotzdem
     * leer: derselbe `d` geht an beobachteFormular(), und der Beobachter
     * liest d[p[0]] erneut. Ein Rueckfall nur in der Schleife verfehlt also
     * genau die Felder, die noch nicht im DOM stehen, und das sind vor dem
     * Sprung auf Stufe 3 alle. Der Originalname behaelt Vorrang. */
    if ((d.mea_pct == null || d.mea_pct === '') && d.mea != null && d.mea !== '') {
      d.mea_pct = d.mea;
    }
    var offen = [];
    _vorrat = {};
    WM_MAP.forEach(function (p) {
      var v = d[p[0]];
      if (v == null || v === '') return;
      if ($(p[1])) setVal(p[1], v);
      else { offen.push(p); _vorrat[p[1]] = v; }
    });
    return offen;
  }

  /* ── v1139-VORRAT · Was bekannt ist, aber noch nicht im DOM steht ────────
   * Im zweiten Pruefdurchgang gemessen: die Stufenleiste meldete "fehlt:
   * Miteigentumsanteil", obwohl der Wert im Objekt gepflegt war. Sie liest
   * das Formularfeld — und `mea` liegt im Block wm-b3, den es vor Stufe 3
   * gar nicht gibt. Ein Feld, das noch nicht existiert, ist dort nicht von
   * einem leeren zu unterscheiden.
   *
   * Deshalb ist die offene Liste jetzt ABFRAGBAR. Sie sagt nur "der Wert
   * liegt vor"; ob eine Stufe erreicht ist, entscheidet weiter allein das
   * ausgefuellte Formular — sonst spraenge der Bericht ungefragt auf eine
   * teurere Stufe, und Kerosin wird nie ohne Zutun ausgegeben. */
  var _vorrat = {};
  window._mbVorrat = function (id) {
    return Object.prototype.hasOwnProperty.call(_vorrat, id) ? _vorrat[id] : null;
  };

  /* Die Wertermittlungsfelder liegen im Block wm-b3 und existieren erst,
   * wenn der Nutzer so weit ist. Ein einmaliges Befuellen verpufft also
   * still. Deshalb ein Beobachter, der nachtraegt, sobald die Felder
   * entstehen \u2014 kein requestAnimationFrame, das feuert im verborgenen
   * Tab nie. Er trennt sich selbst, sobald nichts mehr offen ist. */
  var _wmObs = null;
  function beobachteFormular(d, offen) {
    if (_wmObs) { try { _wmObs.disconnect(); } catch (e) {} _wmObs = null; }
    var ziel = document.getElementById('wm-form') || document.body;
    _wmObs = new MutationObserver(function () {
      offen = offen.filter(function (p) {
        if (!$(p[1])) return true;
        setVal(p[1], d[p[0]]);
        delete _vorrat[p[1]];   /* v1139-VORRAT: jetzt steht es im Feld */
        return false;
      });
      if (!offen.length) { try { _wmObs.disconnect(); } catch (e) {} _wmObs = null; }
    });
    try { _wmObs.observe(ziel, { childList: true, subtree: true }); } catch (e) { _wmObs = null; }
  }

  async function loadDetail(id) {
    try {
      var r = await fetch(OBJ_API + '/' + encodeURIComponent(id), { headers: authHeaders() });
      if (r.ok) { var d = await r.json(); var o = d.item || d.object || d; return o && o.data ? o.data : o; }
    } catch (e) {}
    return null;
  }

  async function buildDropdown() {
    var sel = $('mbow-select'), host = $('mbow-host');
    if (!sel || !host) return;
    try { sel.innerHTML = '<option>\u2026 lade Objekte \u2026</option>'; host.style.display = ''; } catch(e) {} /* v570-dropfast: sofort sichtbar */
    try {
      var r = await fetch(OBJ_API + '?limit=100', { headers: authHeaders() });
      if (!r.ok) { host.style.display = 'none'; return; }
      var resp = await r.json();
      var items = resp.items || resp.objects || [];
      if (!items.length) { host.style.display = 'none'; return; }
      var opts = ['<option value="">\u2014 Objekt aus Bestand w\u00e4hlen \u2014</option>'];
      items.forEach(function (it) {
        var id = it.id || it.key || it.object_key;
        var seq = it.seq_no || it.obj_seq || (it.data && it.data._obj_seq) || '';
        var name = it.name || (it.data && it.data._name) || id;
        var label = (seq ? (seq + ' \u00b7 ') : '') + name;
        opts.push('<option value="' + String(id).replace(/"/g, '&quot;') + '">' + String(label).replace(/</g, '&lt;') + '</option>');
      });
      sel.innerHTML = opts.join('');
      host.style.display = '';  /* v570-dropfast: sichtbar sobald Liste da */
      sel.addEventListener('change', uebernehmen);
      /* v1138-MBREF · Der Aufruf aus der App fuellte den Bericht nur halb.
       *
       * Gemessen am Testobjekt PRUEF_1 (Aktionen -> Marktbericht bei
       * GELADENEM Objekt): im Formular standen genau sechs Werte — Adresse,
       * Objektart, Wohnflaeche, Zimmer, Baujahr, Kaufpreis. Leer blieben
       * Etage, Kaltmiete, Grundstuecksflaeche, Wohneinheiten, Zustand,
       * Qualitaet, Energieklasse und der Miteigentumsanteil, obwohl alle
       * acht im Objekt gepflegt sind. Der Bericht meldete daraufhin
       * "fehlt: Zustand, Qualitaet" und "fehlt: Grundstuecksflaeche,
       * Wohneinheiten, Miteigentumsanteil" — der Nutzer sieht eine Stufe
       * zu wenig und keinen Grund dafuer.
       *
       * URSACHE, nicht Symptom: es gab ZWEI Wege in dasselbe Formular.
       * marktbericht-view.js:62 (currentObjAsQuery) haengt fuenf Werte an
       * die iframe-URL; die vollstaendige Uebernahme steht in
       * fillFromData() und hing ausschliesslich am change-Handler dieses
       * Dropdowns. Wer sein Objekt in der App offen hatte, musste es hier
       * ein zweites Mal auswaehlen, um seine eigenen Daten zu bekommen.
       *
       * Jetzt gibt es EINEN Weg: steht ein ?ref in der URL und liegt das
       * Objekt in der Liste, waehlt das Dropdown es vor und laeuft durch
       * denselben Handler. Kein zweiter Fuellpfad, der auseinanderlaufen
       * kann. Ohne ?ref (Direktaufruf, geladener Bericht) aendert sich
       * nichts. */
      try {
        var _ref = new URLSearchParams(location.search).get('ref') || '';
        if (_ref) {
          for (var _i = 1; _i < sel.options.length; _i++) {
            if (sel.options[_i].value === _ref) {
              sel.selectedIndex = _i;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      } catch (e) {}
    } catch (e) { host.style.display = 'none'; }

    async function uebernehmen(ev) {
      var id = sel.value;
      /* v1333: Ein Klick des Nutzers ist eine Ansage - dann darf alles
         ueberschrieben werden. Der stille Auto-Select aus ?ref nicht. */
      if (ev && ev.isTrusted) { _angefasst = Object.create(null); _stand = Object.create(null); }

      /* v942-publish
         * BUG bis v941: die id wurde nur zum Nachladen der Daten benutzt und
         * dann WEGGEWORFEN. app.js las external_ref ausschliesslich aus
         * location.search -> ein ueber dieses Dropdown erzeugter Bericht hatte
         * gar keinen Objektbezug und konnte in der Deal-Aktion nie auftauchen.
       * Jetzt merken wir sie: app.js liest _mbwRef zuerst. */
      window._mbwRef = id || null;
      window._mbwLabel = (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text) || null;
      try { window.dispatchEvent(new CustomEvent('mb:object-picked', { detail: { ref: id || null } })); } catch (e) {}
      if (!id) return;
      var note = $('mbow-note'); if (note) { note.textContent = 'Lade Objektdaten \u2026'; note.style.color = '#8a8a93'; }
      var data = await loadDetail(id);
      if (data) {
        fillFromData(data);
        /* v1333b: Die Objektart kam gerade erst an - erst jetzt kann die
           Stufenleiste sagen, ob die Wohneinheiten sich von selbst
           beantworten. Ein setVal() loest kein change aus, sonst haette
           sie es selbst gemerkt. */
        try {
          if (window.DealPilotMbStufen && window.DealPilotMbStufen.einheitenVorbelegen) {
            window.DealPilotMbStufen.einheitenVorbelegen();
          }
        } catch (e) {}
      }

      else if (note) { note.textContent = '\u2717 Konnte Objektdaten nicht laden.'; note.style.color = '#B8625C'; }
    }
  }

  function mount() {
    if ($('mbow-host')) { buildDropdown(); return true; }
    var addr = $('address'); if (!addr) return false;
    var panel = (addr.closest && addr.closest('.panel')) || addr.parentElement;
    if (!panel) return false;
    var box = document.createElement('div');
    box.id = 'mbow-host';
    box.style.cssText = 'margin:0 0 16px;padding:12px 14px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);border-radius:12px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 5%, transparent);';
    box.innerHTML =
      '<label style="display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C);margin-bottom:7px;font-weight:600;">Objekt aus Bestand laden</label>' +
      '<select id="mbow-select" style="width:100%;padding:9px 11px;border-radius:9px;background:#0f0f13;color:#e8e8ea;border:1px solid #26262c;font-size:13px;"><option>\u2026</option></select>' +
      '<div id="mbow-note" style="font-size:11.5px;color:#8a8a93;margin-top:7px;"></div>';
    panel.insertBefore(box, panel.firstChild);
    buildDropdown();
    return true;
  }

  var tries = 0;
  (function autoInit() {
    if (mount()) return;
    if (tries++ < 40) setTimeout(autoInit, 250);
  })();
})();
