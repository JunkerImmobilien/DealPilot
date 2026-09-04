/* ============================================================================
   DealPilot v1126 — mb-stufen.js
   „Die drei Stufen sollen vereint werden, nicht vorher abgefragt."
   (Marcels Entscheidung 2026-08-11, Entwurf: design/Vorschlaege/marktbericht-wizard.html)

   WAS SICH AENDERT
   Die Zielfrage („Schnelle Einschaetzung / Genaue Preisindikation /
   Wertermittlung") verschwindet als FRAGE. An ihre Stelle tritt eine
   Meilensteinleiste: man fuellt aus, und die Stufe ERGIBT sich. Am Knopf
   steht, was der Bericht auf der erreichten Stufe kostet.

   WAS BLEIBT
   Alles darunter. `stufe()` und `setStufe()` aus wertermittlung.js sind
   weiter die einzige Wahrheit ueber die Stufe — dieser Baustein RECHNET sie
   nur aus und meldet sie dorthin. Damit folgen Bloecke (precBox, wm-b3),
   Ampel und payload() unveraendert. Kein zweites Stufenmodell.

   DER PREIS KOMMT VOM SERVER
   GET /marktbericht/stufenpreis?ref=… liefert die schon bezahlte Stufe und
   den faelligen Betrag je Stufe. Der Browser rechnet die Ermaessigung NICHT
   selbst aus — er kennt die bezahlte Stufe nicht und soll sie nicht kennen
   (v1125: sie kommt aus dem Kerosin-Log, nie aus dem Browser).
   Antwortet der Server nicht, stehen die vollen Preise da: lieber zu viel
   angekuendigt als eine Ermaessigung versprochen, die es nicht gibt.
   ============================================================================ */
(function () {
  'use strict';
  if (window.DealPilotMbStufen) return;

  /* ── v1193 · Die Waehrung ist weg, die Stufen sind geblieben ────────────
     v1183 hat Kerosin abgeschafft: gezaehlt wird je Leistungsart, eine
     Bewertung je Stufe.

     `var VOLLPREIS = { 1: 2, 2: 5, 3: 12 }` STAND HIER und ist entfernt.
     Es waren die Kerosin-Literpreise, und nach dem Umbau las sie niemand
     mehr — gegengeprueft mit `grep -rn VOLLPREIS frontend/ backend/`:
     genau ein Treffer, diese Zeile. Eine tote Preistabelle ist keine
     harmlose Leiche: der naechste Leser haelt sie fuer die Wahrheit.

     ART_KURZ und ART_NAME sind KEINE zweite Liste, sondern die Uebersetzung der
     Artschluessel, die der Server schickt. Dieselben Woerter stehen in
     `frontend/js/ai-credits.js:32` — dort fuellt `kurz` die Kontingent-Box
     des Nutzers. Deshalb steht in der Ampel das Kuerzel und nicht der
     ausgeschriebene Name: der Name steht in derselben Zeile schon links,
     und das Kuerzel zeigt auf genau den Zaehler, den der Nutzer in seiner
     Box wiederfindet. Am Knopf, wo links kein Name steht, wird
     ausgeschrieben — Wort fuer Wort wie im Bestaetigungsdialog (v1187). */
  var ART_JE_STUFE = { 1: 'mpi', 2: 'mpi_plus', 3: 'wev' };
  var ART_KURZ = { mpi: 'MPI', mpi_plus: 'MPI+', wev: 'WEV' };
  var ART_NAME = {
    mpi:      'Marktpreisindikation',
    mpi_plus: 'Erweiterte Marktpreisindikation',
    wev:      'Wertermittlung nach ImmoWertV'
  };
  /* ── v1177 · Die Namen, die auch auf der Preisseite stehen ──────────────
     Marcels Korrektur vom 30.08.: die erste Stufe IST schon eine
     Marktpreisindikation — „Einschätzung" sagte nichts und verschenkte den
     Begriff an Stufe 2.

     Stufe 2 heisst bewusst NICHT „erweiterte Wertermittlung": sie fuehrt
     kein Verfahren nach ImmoWertV aus, sondern verengt die Spanne. Wer
     „Wertermittlung" liest, erwartet einen Verkehrswert — den gibt es erst
     auf Stufe 3. */
  var NAMEN = {
    1: 'Marktpreisindikation',
    2: 'Erweiterte Marktpreisindikation',
    3: 'Wertermittlung nach ImmoWertV'
  };
  var WAS = {
    1: 'Lage und Preisspanne aus den Daten des zuständigen Gutachterausschusses.',
    2: 'Zusätzlich Zustand und Qualität — deutlich engere Spanne, mit Dossier zum Objekt.',
    3: 'Zusätzlich Boden-, Ertrags- und Sachwert nach ImmoWertV, mit Rechenweg im PDF. Ersetzt kein Gutachten eines Sachverständigen.'
  };
  /* v1126d: Der fruehere FEHLT_TEXT ist raus. Er war eine zweite, von Hand
     gepflegte Liste derselben Pflichtangaben — und lief prompt auseinander.
     Was fehlt, sagt jetzt fehlend() aus BEDARF, also aus einer Quelle. */

  var _faellig = null;      /* vom Server, je Stufe — ALTES Liter-Feld, v1193 nur noch Beifang */
  var _kosten = null;       /* v1193 · vom Server: { 1..3: {anzahl, art} } */
  var _bezahlt = 0;
  var _letzte = 0;
  /* ── v1126c · Das Henne-Ei-Problem, im Durchgang gefunden ───────────────
     Stufe 3 verlangt `plot` und — je nach Objektart — `mea` bzw.
     `standardstufe`/`nhkHaus`. Die liegen aber ALLE im Block `wm-b3`, und
     den baut wertermittlung.js erst `if (s >= 3)`. Die Felder, die
     hochstufen, gibt es vor dem Hochstufen also gar nicht: **Stufe 3 war
     rein rechnerisch unerreichbar.**

     Aufloesung ohne Frage vorweg: der Meilenstein ist ANKLICKBAR. Ein Klick
     ist kein Fragebogen, sondern „ich will tiefer" — dasselbe „Vertiefen"
     wie in der Uebersicht des Entwurfs. Danach entscheiden wieder die
     Felder, ob die Stufe wirklich vollstaendig ist.
     _angestrebt ist deshalb eine UNTERGRENZE, nie eine Behauptung. */
  var _angestrebt = 0;

  function $(id) { return document.getElementById(id); }
  function wert(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function istWohnung() { return /wohnung|etw/i.test(wert('ptype')); }

  /* ── Was jede Stufe WIRKLICH braucht ───────────────────────────────────
     v1126d · EIGENER FEHLER, ZURUECKGENOMMEN. Ich hatte behauptet, hier
     staenden „dieselben Bedingungen wie die Verfahrensampel". Das stimmte
     nicht: geprueft wurden nur address, ptype und area. Folge — die Leiste
     meldete „Wertermittlung erreicht" bei einem halb leeren Formular, ohne
     Baujahr. Genau das ist Marcel aufgefallen.

     Jetzt aus VERFAHREN in wertermittlung.js abgeschrieben:
       markt   pflicht ptype, area, year, baustatus · empfohlen cond, quality
       ertrag  pflicht plot, units
       sach    pflicht plot, year (bei ETW nicht anwendbar)

     Eine Leiste, die mehr behauptet als da ist, ist schlimmer als keine. */
  /* ── v1229 · `baustatus` steht bei Stufe 1, nicht bei Stufe 2 ────────────
     Er war hier auf Stufe 2 gesetzt, `VERFAHREN.markt.pflicht` in
     wertermittlung.js führt ihn aber auf Stufe 1 — und der Erzeugen-Knopf
     prüft gegen VERFAHREN. Solange `baustatus` nie leer sein konnte (er war
     ein <select> ohne leere erste Option, siehe v1229 dort), fiel der
     Widerspruch nicht auf: das Feld war immer gefüllt, also forderte ihn
     keine der beiden Listen jemals ein.

     Mit der leeren Option WÜRDE er auffallen — und zwar genau als Marcels
     Befund aus v1152: die Ampel meldet „Marktpreisindikation erreicht",
     der Knopf bleibt gesperrt und nennt ein Feld, das die Ampel nicht
     verlangt hat. Deshalb wandert er hier mit hoch. */
  var BEDARF = {
    1: [['address', 'Adresse'], ['ptype', 'Objektart'], ['area', 'Wohnfläche'], ['year', 'Baujahr'], ['baustatus', 'Baustatus']],
    2: [['cond', 'Zustand'], ['quality', 'Qualität']],
    3: [['plot', 'Grundstücksfläche'], ['units', 'Wohneinheiten']]
  };
  /* ── v1201 · Der Miteigentumsanteil ist bei einer ETW ab Stufe 1 Pflicht ──
     Marcels Entscheidung vom 02.09.2026. Vorher stand er nur in bedarf3(),
     also erst bei der Wertermittlung — und der Ertragswert, der ihn braucht,
     wird schon ab Stufe 1 ausgewiesen.

     Er steht bewusst NICHT fest in BEDARF[1]: bei einem Haus gibt es keinen
     Miteigentumsanteil, und eine Ampel, die etwas Unmoegliches fordert, ist
     schlimmer als keine (v1126d). Deshalb dieselbe Bauweise wie bedarf3().

     Das Feld wird seit v1201 auch schon im ersten Block gezeichnet
     (wertermittlung.js, FELDER.stufe1) — sonst waere die Pflicht eine
     Sackgasse. */
  function bedarf1() {
    var l = BEDARF[1].slice();
    if (istWohnung()) l.push(['mea', 'Miteigentumsanteil']);
    return l;
  }
  /* Die objektartabhaengigen Pflichtangaben der Wertermittlung.
     v1201: `mea` ist hier RAUS — er wird jetzt schon in bedarf1() verlangt,
     und zweimal dieselbe Forderung in zwei Stufen zu fuehren waere genau die
     Doppelliste, an der der Marktbericht schon sechsmal gescheitert ist. */
  function bedarf3() {
    var l = BEDARF[3].slice();
    if (!istWohnung()) { l.push(['standardstufe', 'Standardstufe']); l.push(['nhkHaus', 'Hausform (NHK)']); }
    return l;
  }
  /* v1201 · EINE Stelle, die sagt was eine Stufe braucht. Vorher stand der
     Ausdruck `(n === 3) ? bedarf3() : BEDARF[n]` dreimal wortgleich im Haus —
     in fehlend(), in offenGeteilt() und in feldMarken(). Mit bedarf1() waeren
     daraus drei Stellen geworden, die man einzeln haette nachziehen muessen.
     Genau so entstehen Doppellisten. */
  function bedarfFuer(n) {
    if (n === 1) return bedarf1();
    if (n === 3) return bedarf3();
    return BEDARF[n];
  }
  function fehlend(n) {
    var l = bedarfFuer(n);
    return l.filter(function (f) { return !wert(f[0]); }).map(function (f) { return f[1]; });
  }

  /* ── v1139-VORRAT · "fehlt" hiess auch, was laengst bekannt war ──────────
     Im zweiten Pruefdurchgang gemessen: nach der Objektuebernahme stand hier
     weiter "fehlt: Miteigentumsanteil", obwohl der Wert im Objekt gepflegt
     ist. Ursache ist wert() selbst — es liest das Formularfeld, und `mea`
     liegt im Block wm-b3, den wertermittlung.js erst `if (s >= 3)` baut. Ein
     Feld, das es noch nicht gibt, liefert '' wie ein leeres.

     mb-objektwahl.js haelt genau diese Werte schon vor (window._mbVorrat).
     Die Leiste fragt sie jetzt — aber NUR fuer die Beschriftung.
     erreicht() bleibt unveraendert am ausgefuellten Formular: sonst spraenge
     die Stufe von allein auf 3 und der Knopf forderte 12 L statt 5 L, ohne
     dass jemand geklickt hat. Kerosin nie ohne Zutun. */
  function ausObjekt(id) {
    if ($(id)) return '';          /* steht im DOM -> wert() ist die Wahrheit */
    var v = null;
    try { if (typeof window._mbVorrat === 'function') v = window._mbVorrat(id); } catch (e) {}
    return (v == null) ? '' : String(v).trim();
  }
  /* Trennt das wirklich Fehlende von dem, was ein Klick einblendet. */
  function offenGeteilt(n) {
    var l = bedarfFuer(n);
    var echt = [], liegtVor = [];
    l.forEach(function (f) {
      if (wert(f[0])) return;
      if (ausObjekt(f[0])) liegtVor.push(f[1]); else echt.push(f[1]);
    });
    return { echt: echt, vor: liegtVor };
  }
  function erreicht() {
    if (fehlend(1).length) return 0;
    if (fehlend(2).length) return 1;
    if (fehlend(3).length) return 2;
    return 3;
  }

  function ref() {
    try {
      if (typeof window._mbRef === 'function') { var r = window._mbRef(); if (r) return String(r); }
    } catch (e) {}
    try { if (window._mbwRef) return String(window._mbwRef); } catch (e) {}
    return null;
  }

  function preisHolen() {
    var r = ref();
    var url = '/api/v1/marktbericht/stufenpreis' + (r ? ('?ref=' + encodeURIComponent(r)) : '');
    var tok = null; try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    return fetch(url, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} })
      .then(function (x) { return x.json(); })
      .then(function (d) {
        if (d && d.kosten) { _kosten = d.kosten; }              /* v1193 */
        if (d && d.faellig) { _faellig = d.faellig; }
        if (d) { _bezahlt = parseInt(d.bezahlte_stufe, 10) || 0; }
        zeichnen();
      })
      .catch(function () { _kosten = null; _faellig = null; zeichnen(); });
  }

  /* ── v1193 · Was die Stufe WIRKLICH kostet ──────────────────────────────
     Der Server liefert seit v1183 das Feld `kosten` — je Stufe entweder
     nichts oder genau EINE Bewertung der zugehoerigen Art. Ueber `faellig`
     kamen bis hierher noch Kerosin-Liter; die Datei war, wie der Server es
     in `routes/marktbericht.js:277` nennt, „der letzte alte Aufrufer".

     Faellt `kosten` aus (alter Server, Netzfehler), wird der VOLLE Preis
     angekuendigt — dieselbe Regel wie bisher: lieber zu viel ankuendigen
     als eine Ermaessigung versprechen, die es nicht gibt. */
  function kostenFuer(s) {
    if (_kosten && _kosten[s]) {
      var k = _kosten[s];
      return { anzahl: parseInt(k.anzahl, 10) || 0, art: k.art || ART_JE_STUFE[s] };
    }
    return { anzahl: 1, art: ART_JE_STUFE[s] };
  }

  /* Kurzform fuer die Ampel (der Name steht links daneben) und Langform
     fuer den Knopf, wo links nichts steht. Dieselben Woerter wie im
     Bestaetigungsdialog aus v1187 — der Nutzer soll an beiden Stellen
     dasselbe lesen. */
  function preisText(k) {
    if (!k || k.anzahl === 0) return 'bezahlt';
    return k.anzahl + ' × ' + (ART_KURZ[k.art] || k.art);
  }
  function preisTextLang(k) {
    if (!k || k.anzahl === 0) return 'ohne Aufpreis';
    return k.anzahl + ' ' + (ART_NAME[k.art] || k.art);
  }

  /* ── Die Leiste ────────────────────────────────────────────────────────── */
  function stil() {
    if ($('mbst-css')) return;
    var s = document.createElement('style');
    s.id = 'mbst-css';
    /* v1126d · WAAGERECHT PASST NICHT. Gemessen: die Spalte ist 338 px
       breit, drei Beschriftungen brauchten je 120 px — sie klebten
       aneinander, "Marktpreisindikation" beruehrte die Nachbarn. Deshalb
       eine LISTE statt einer Bahn. Sie hat denselben Inhalt, liest sich in
       der schmalen Spalte aber ruhig und hat Platz fuer das Wichtigste:
       was der jeweiligen Stufe noch fehlt. */
    s.textContent = [
      '.mbst{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,168,76,.25);',
        'border-radius:8px;background:rgba(201,168,76,.04)}',
      '.mbst h4{margin:0 0 4px;font-size:13px;color:var(--wl-e8cc7a,#E8CC7A);font-weight:600}',
      '.mbst-sub{font-size:11px;opacity:.65;margin-bottom:11px;line-height:1.45}',
      '.mbst-ms{display:flex;gap:10px;align-items:flex-start;padding:8px 9px;margin:4px 0;',
        'border-radius:6px;cursor:pointer;transition:background .15s}',
      '.mbst-ms:hover{background:rgba(201,168,76,.09)}',
      '.mbst-ms.an{background:rgba(201,168,76,.13)}',
      '.mbst-pkt{flex:0 0 auto;width:20px;height:20px;border-radius:50%;background:rgba(128,128,128,.28);',
        'display:flex;align-items:center;justify-content:center;font-size:10.5px;margin-top:1px;transition:.25s}',
      '.mbst-ms.an .mbst-pkt{background:var(--wl-c9a84c,#C9A84C);color:#2c2410;font-weight:700}',
      '.mbst-txt{flex:1 1 auto;min-width:0}',
      '.mbst-zeile{display:flex;gap:8px;align-items:baseline}',
      '.mbst-name{font-size:12.5px;font-weight:600;opacity:.7}',
      '.mbst-ms.an .mbst-name{opacity:1}',
      '.mbst-kero{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:11px;',
        'font-weight:600;color:var(--wl-c9a84c,#C9A84C);white-space:nowrap}',
      '.mbst-was{font-size:10.5px;line-height:1.45;opacity:.6;margin-top:2px}',
      '.mbst-fehlt{font-size:10.5px;line-height:1.45;margin-top:2px;color:var(--wl-b8625c,#B8625C)}',
      /* v1139-VORRAT: kein Rot — das ist kein Mangel, sondern ein Klick. */
      '.mbst-vor{font-size:10.5px;line-height:1.45;margin-top:2px;color:var(--wl-c9a84c,#C9A84C)}',
      '.mbst-info{margin-top:9px;padding:8px 10px;border-radius:6px;background:rgba(201,168,76,.10);',
        'font-size:11.5px;line-height:1.5}',
      '.mbst-info b{color:var(--wl-e8cc7a,#E8CC7A)}',
      /* ── v1202 · Die GEWÄHLTE Zeile muss man sehen, ohne sie zu suchen ────
         `.an` (erreicht) traegt bereits rgba(201,168,76,.13) — die Wahl
         braucht also etwas anderes als noch mehr Gold-Flaeche, sonst sind
         „fertig" und „gewaehlt" nicht zu unterscheiden. Deshalb ein
         durchgezogener Rand plus gefuellter Punkt.
         Bewusst nicht Gruen: Gruen heisst hier „erreicht", und gewaehlt ist
         etwas anderes als fertig. */
      '.mbst-ms{border:1px solid transparent}',
      '.mbst-ms.gewaehlt{border-color:var(--wl-c9a84c,#C9A84C);background:rgba(201,168,76,.16)}',
      '.mbst-ms.gewaehlt .mbst-name{font-weight:700}',
      '.mbst-ms.gewaehlt .mbst-pkt{background:var(--wl-c9a84c,#C9A84C);',
        'border-color:var(--wl-c9a84c,#C9A84C);color:#221a06;font-weight:700}',
      /* ── v1199 · Variante B aus design/Vorschlaege/marktbericht-fehlende-felder.html
         Marcels Wahl: goldener Merkstreifen statt rotem Rahmen. Ein leeres
         Feld ist KEIN Fehler — und Rot ist in dieser Leiste schon fuer
         „fehlt" vergeben (.mbst-fehlt). Zweimal dieselbe Farbe fuer zwei
         Dringlichkeiten macht beide stumpf.

         Der Streifen sitzt am BEHAELTER, nicht am Feld: sonst kaempft er
         mit dem Rahmen des Eingabefelds. `input,select` setzt ihn mit
         Spezifitaet (0,0,1) — `.mbst-fehltfeld input` ist (0,1,1) und
         gewinnt ohne !important. Im Browser nachgemessen, nicht geraten. */
      '.mbst-fehltfeld{border-left:3px solid var(--wl-c9a84c,#C9A84C);padding-left:10px}',
      '.mbst-fehltfeld input,.mbst-fehltfeld select{border-color:var(--wl-c9a84c,#C9A84C)}',
      '.mbst-fehltfeld-solo{border-color:var(--wl-c9a84c,#C9A84C)}',
      '.mbst-fuer{display:block;font-family:"JetBrains Mono",monospace;font-size:10.5px;',
        'line-height:1.4;font-weight:500;letter-spacing:.02em;margin-top:4px;',
        'color:var(--wl-b8932f,#b8932f)}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── v1199 · Die fehlenden Angaben stehen jetzt AM FELD ─────────────────
     Bis hierher nannte nur die Ampel sie — ganz oben, ausserhalb des
     Reiters. Wer in Reiter 2 „Objekt" arbeitete, sah neun gleich
     aussehende Felder und konnte nicht erkennen, welche vier die Stufe
     ueberhaupt erst freischalten. Gemessen am 01.09.2026: von den
     Pflichtangaben der Stufen 1-3 trug in den Reitern 2-5 KEINE einen
     Marker; nur `baustatus` hatte einen, weil es zufaellig ueber
     wertermittlung.js gerendert wird.

     Marcels Wahl aus design/Vorschlaege/marktbericht-fehlende-felder.html
     ist Variante B: goldener Merkstreifen plus eine Zeile, die sagt WOFUER
     das Feld fehlt.

     ZWEI ENTSCHEIDUNGEN, DIE HIER FESTGEHALTEN GEHOEREN:

     1 · NUR DIE NAECHSTE STUFE. Wer auf Stufe 1 steht, bekommt die Felder
         fuer Stufe 2 markiert — nicht zusaetzlich die fuer Stufe 3. Sonst
         steht die Maske voll und die Markierung sagt wieder nichts.

     2 · KEINE ZWEITE LISTE. Feld-IDs und Klarnamen kommen aus `BEDARF` /
         `bedarf3()`, der Stufenname aus `NAMEN` — dieselben Quellen, aus
         denen die Ampel und der Knopf ihre Woerter nehmen. Im Marktbericht
         sind schon sechs Fehler daraus entstanden, dass dieselbe Sache
         zweimal im Haus stand.

     Felder, die noch gar nicht im DOM sind (der Stufe-3-Block wird erst
     aufgeklappt gebaut), werden uebersprungen — dort greift der Hinweis
     aus v1196, der den leeren Reiter erklaert. */
  function feldMarkeAbraeumen() {
    var alt = document.querySelectorAll('.mbst-fehltfeld,.mbst-fehltfeld-solo');
    Array.prototype.forEach.call(alt, function (e) {
      e.classList.remove('mbst-fehltfeld');
      e.classList.remove('mbst-fehltfeld-solo');
    });
    var txt = document.querySelectorAll('.mbst-fuer');
    Array.prototype.forEach.call(txt, function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
  }

  /* v1202 · Markiert wird jetzt fuer die GEWAEHLTE Tiefe — und zwar alles,
     was ihr noch fehlt, ueber ALLE Stufen bis dahin. Stufe 3 braucht auch
     die Angaben von 1 und 2; sie nur fuer die „naechste" Stufe zu markieren
     (so bis v1201) haette bei gewaehlter Stufe 3 die Luecken in Stufe 1
     stumm gelassen. Jede Marke nennt die Stufe, zu der ihr Feld gehoert. */
  function feldMarken(ziel) {
    feldMarkeAbraeumen();
    ziel = ziel || 1;
    for (var n = 1; n <= ziel; n++) markiereStufe(n);
  }

  function markiereStufe(n) {
    var liste = bedarfFuer(n);
    if (!liste) return;
    var name = NAMEN[n];
    liste.forEach(function (f) {
      if (wert(f[0])) return;                 /* ausgefuellt */
      var el = $(f[0]);
      if (!el) return;                        /* Feld noch nicht gebaut */

      /* Der Behaelter ist je nach Reiter ein anderer: die Wertermittlung
         baut `.wm-f`, die uebrigen Reiter ein nacktes <div> mit Label und
         Feld. `#address` haengt sogar direkt im Reiter, ohne Huelle —
         dafuer der Solo-Fall. Alles im Browser ausgelesen. */
      var box = el.closest ? el.closest('.wm-f') : null;
      if (!box) {
        var p = el.parentElement;
        if (p && p.querySelector('label') && !/mbw-blatt/.test(String(p.className || ''))) box = p;
      }
      var zeile = document.createElement('span');
      zeile.className = 'mbst-fuer';
      zeile.textContent = 'fehlt für ' + name;
      if (box) {
        box.classList.add('mbst-fehltfeld');
        box.appendChild(zeile);
      } else {
        el.classList.add('mbst-fehltfeld-solo');
        if (el.parentNode) el.parentNode.insertBefore(zeile, el.nextSibling);
      }
    });
  }

  /* ── v1202 · Die Stufe wird wieder GEWÄHLT, nicht erraten ────────────────
     Marcels Entscheidung vom 02.09.2026: „dann lass uns doch wieder die drei
     Stufen zum Auswählen machen und dann für die jeweilige Stufe die
     Pflichtfelder anzeigen."

     Das kehrt v1193 um („kein Vorab-Klick, die Stufe ergibt sich aus den
     Angaben"), und zwar aus einem gemessenen Grund: seit v1201 der
     Miteigentumsanteil sichtbar wurde, war bei einer vollstaendig gepflegten
     Eigentumswohnung Stufe 3 sofort erreicht — und der Knopf forderte
     ungefragt eine Wertermittlung (3,90 €) statt einer erweiterten
     Marktpreisindikation (1,90 €). Bei Haeusern war das laengst so, es fiel
     nur nie auf.

     WAS SICH DAMIT UMDREHT:
       vorher  Preis und Tiefe = erreicht()   -> die Daten bestimmen die Kosten
       jetzt   Preis und Tiefe = gewaehlt()   -> der Nutzer bestimmt die Kosten

     `erreicht()` bleibt unveraendert und behaelt seine Aufgabe: es sagt, ob
     die gewaehlte Tiefe VOLLSTAENDIG ist. Es entscheidet nur nicht mehr,
     was sie kostet.

     Die Wahl liegt in localStorage (`dp_mb_stufe`, ueber
     Wertermittlung.setStufe) und steht ohne Zutun auf 1 — der guenstigsten.
     Teurer wird es nur durch einen Klick. */
  function gewaehlt() {
    var g = 1;
    try {
      if (window.Wertermittlung && window.Wertermittlung.stufe) g = window.Wertermittlung.stufe();
    } catch (e) {}
    g = parseInt(g, 10) || 1;
    return (g >= 1 && g <= 3) ? g : 1;
  }

  /* Was fuer die GEWAEHLTE Tiefe noch fehlt — alle Stufen bis dahin, denn
     Stufe 3 braucht auch die Angaben von 1 und 2. Nach aussen gegeben,
     damit app.js den Knopf sperren kann, ohne die Listen zu kennen. */
  function offenFuer(ziel) {
    ziel = ziel || gewaehlt();
    var raus = [];
    for (var n = 1; n <= ziel; n++) {
      bedarfFuer(n).forEach(function (f) { if (!wert(f[0])) raus.push(f[1]); });
    }
    return raus;
  }

  function zeichnen() {
    var wo = $('wm-ziel');
    if (!wo) return;
    stil();
    wo.className = 'mbst';
    var s = erreicht();
    var g = gewaehlt();

    var ms = [1, 2, 3].map(function (n) {
      var fertig = s >= n;
      var dieseWahl = (n === g);
      var k = kostenFuer(n);
      var o = offenGeteilt(n);
      var unten = '';
      if (fertig) unten = '<div class="mbst-was">' + WAS[n] + '</div>';
      else {
        if (o.echt.length) unten += '<div class="mbst-fehlt">fehlt: ' + o.echt.join(', ') + '</div>';
        if (o.vor.length) unten += '<div class="mbst-vor">liegt im Objekt vor: ' + o.vor.join(', ') +
          ' — hier klicken zum Übernehmen</div>';
      }
      return '<div class="mbst-ms' + (fertig ? ' an' : '') + (dieseWahl ? ' gewaehlt' : '') +
          '" data-mbst-ziel="' + n + '" ' +
          'title="' + (dieseWahl ? NAMEN[n] + ' ist gewählt' : NAMEN[n] + ' wählen') + '">' +
        '<div class="mbst-pkt">' + (dieseWahl ? '●' : (fertig ? '✓' : n)) + '</div>' +
        '<div class="mbst-txt">' +
          '<div class="mbst-zeile"><span class="mbst-name">' + NAMEN[n] + '</span>' +
            '<span class="mbst-kero">' + preisText(k) + '</span></div>' +
          unten +
        '</div></div>';
    }).join('');

    var offen = offenFuer(g);
    var info;
    if (offen.length) {
      info = '<b>' + NAMEN[g] + '</b> ist gewählt. Dafür fehlt noch: <b>' + offen.join(', ') + '</b>.';
    } else {
      info = '<b>' + NAMEN[g] + '</b> ist gewählt und vollständig.';
    }
    /* v1193 · Kein Differenz-Versprechen — der Server loest es nicht ein. */
    if (_bezahlt > 0) {
      info += '<br>Für dieses Objekt ist <b>' + NAMEN[_bezahlt] + '</b> bereits bezahlt — ' +
              'diese Tiefe kostet dich nichts mehr. Eine höhere Stufe wird voll berechnet.';
    }

    wo.innerHTML =
      '<h4>Was soll der Bericht leisten?</h4>' +
      '<div class="mbst-sub">Tiefe wählen — der Preis richtet sich danach, nicht nach den Angaben.</div>' +
      ms +
      '<div class="mbst-info">' + info + '</div>';

    knopf(g);                                   /* v1202: der Preis folgt der WAHL */
    feldMarken(g);                              /* v1199, seit v1202 fuer die Wahl */
  }
  /* Der Preis wandert an den Erzeugen-Knopf — dort wird er ausgegeben. */
  function knopf(s) {
    var b = $('goBtn');
    if (!b) return;
    /* NICHT auf `disabled` pruefen — gemessen ist der Knopf auch im
       Normalzustand deaktiviert, solange Pflichtangaben fehlen, und dann
       waere der Preis nie zu sehen. Ueberschrieben werden darf nur der
       LAUFENDE Abruf: app.js setzt dort ein <span class="spin"> hinein. */
    if (b.querySelector('.spin')) return;
    b.textContent = s >= 1
      ? ('Marktbericht erstellen · ' + preisTextLang(kostenFuer(s)))
      : 'Marktbericht erstellen';
  }

  /* ── Die Stufe an wertermittlung.js melden ─────────────────────────────
     NUR bei echter Aenderung: setStufe() zeichnet die Bloecke neu, das bei
     jedem Tastendruck zu tun waere teuer und wuerde den Fokus kosten. */
  /* ── v1202 · Nur noch die Wahl bestimmt die Tiefe ────────────────────────
     Hier stand `Math.max(1, erreicht(), _angestrebt)`. Damit hob JEDE
     vollstaendige Angabe die gezeigte Tiefe an — und mit ihr den Preis am
     Knopf. Das war der Selbstsprung, den Marcel abgestellt haben wollte.

     `_angestrebt` ist damit ueberfluessig geworden: die Wahl liegt jetzt
     dauerhaft in `dp_mb_stufe` und wird beim Klick auf eine Zeile gesetzt.
     Die Variable bleibt als Feld im _stand() erhalten, damit ein alter
     Aufrufer nicht ins Leere greift. */
  function melden() {
    var ziel = gewaehlt();
    if (ziel !== _letzte) {
      _letzte = ziel;
      try {
        if (window.Wertermittlung && window.Wertermittlung.setStufe) window.Wertermittlung.setStufe(ziel);
      } catch (e) {}
    }
    zeichnen();
  }

  var _plan = null;
  function angestossen() {
    if (_plan) clearTimeout(_plan);
    /* setTimeout, nicht requestAnimationFrame: rAF feuert im verborgenen
       oder gedrosselten Tab nicht (gemessen, dp-band-fix.js v1092b). */
    _plan = setTimeout(melden, 180);
  }

  function start() {
    if (!$('wm-ziel')) { setTimeout(start, 400); return; }
    document.addEventListener('input', angestossen, true);
    document.addEventListener('change', angestossen, true);
    /* v1202 · Ein Klick auf eine Zeile WAEHLT diese Tiefe. Vorher setzte er
       nur eine Untergrenze, die erreicht() jederzeit ueberholen konnte. */
    document.addEventListener('click', function (ev) {
      var m = ev.target && ev.target.closest ? ev.target.closest('[data-mbst-ziel]') : null;
      if (!m) return;
      var n = parseInt(m.getAttribute('data-mbst-ziel'), 10);
      if (!(n >= 1 && n <= 3)) return;
      _angestrebt = n;                          /* nur noch fuer _stand() */
      try {
        if (window.Wertermittlung && window.Wertermittlung.setStufe) window.Wertermittlung.setStufe(n);
      } catch (e) {}
      _letzte = -1;                             /* Neuzeichnen erzwingen */
      melden();
    }, true);
    _letzte = 0;
    melden();
    preisHolen();
    /* Objektwechsel im Dropdown -> neuer Preis. */
    var sel = document.querySelector('#mbow-host select');
    if (sel) sel.addEventListener('change', function () { setTimeout(preisHolen, 300); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotMbStufen = {
    erreicht: erreicht, zeichnen: zeichnen, preisHolen: preisHolen,
    gewaehlt: gewaehlt, offenFuer: offenFuer,          /* v1202 */
    _stand: function () { return { erreicht: erreicht(), gewaehlt: gewaehlt(), offen: offenFuer(), bezahlt: _bezahlt, kosten: _kosten, faellig: _faellig }; }
  };
})();
