/* ============================================================================
   DealPilot v1127 — mb-wizard.js
   „Aus 4.608 px Scroll werden Reiter." (Marcels Entscheidung 2026-08-11,
   Entwurf: design/Vorschlaege/marktbericht-wizard.html)

   ── DIE REITER SIND DIE MEILENSTEINE ──────────────────────────────────────
   Drei Reiter, nicht fuenf. Der Entwurf zeigte fuenf Schritte; beim Bauen
   hat die Struktur eine bessere Antwort gegeben: die vorhandenen Bloecke
   fallen genau auf die drei Stufen, und damit entspricht jeder Reiter einem
   Meilenstein aus v1126. Eine Gliederung, zwei Darstellungen — statt zweier
   Gliederungen, die auseinanderlaufen.

     1 Objekt            -> Einschaetzung          (Adresse, Eckdaten, Einlesen)
     2 Zustand & Markt   -> Marktpreisindikation   (Baustatus, Genauigkeit)
     3 Wertermittlung    -> Wertermittlung         (Grundstueck, NHK, Feinjust.)

   ── ES WIRD UMGEHAENGT, NICHT NEU GEBAUT ──────────────────────────────────
   Die Felder bleiben DIESELBEN DOM-Knoten. Sie werden nur in andere
   Behaelter verschoben. Damit gilt weiter:
     - payload() liest dieselben Elemente ueber dieselben Ids
     - jeder vorhandene Listener bleibt haengen
     - kein zweiter Feldkatalog, keine zweite Wahrheit
   Ein Neubau der Felder haette genau das zerstoert.

   ── WARUM EIN BEOBACHTER NOETIG IST ───────────────────────────────────────
   wertermittlung.js `zeichnen()` entfernt wm-b1/b2/b3 und setzt sie neu in
   die Panel-Spalte — bei jedem Stufenwechsel. Ohne Nachfuehrung lagen die
   Bloecke danach wieder ausserhalb der Reiter. Deshalb ein
   MutationObserver, der die bekannten Bloecke zurueckholt. Dasselbe Muster
   wie karten-kompakt.js und modal-boarding-skin.js.

   KEIN requestAnimationFrame: feuert im verborgenen Tab nicht (gemessen,
   dp-band-fix.js v1092b).
   ============================================================================ */
(function () {
  'use strict';
  if (window.DealPilotMbWizard) return;

  /* ── v1129 · Mehr, kleinere Reiter ───────────────────────────────────────
     Marcels Befund: „Zustand und Markt ist sehr gross mit vielen Angaben."
     Gemessen: der Reiter trug 24 Felder — mehr als die anderen beiden
     zusammen. `precBox` besteht aber aus ZEHN sauberen `.row`-Zeilen, die
     sich thematisch trennen lassen. Und der Expertenblock (Liegenschafts-
     zins, Sachwertfaktor, Bodenrichtwert) ist ein eigener Behaelter — er
     bekommt einen eigenen Reiter, wie gewuenscht.

     Aus drei Reitern werden sechs. Die Meilensteine bleiben drei: mehrere
     Reiter koennen auf dieselbe Stufe einzahlen (`stufe`). */
  /* v1130 · Die Uebersicht wird der erste Reiter.
     Marcels Vorgabe: „wichtig ist, dass man weiterhin die Objekte auch
     einlesen kann, es die Tabelle gibt mit den Marktberichten und dass man
     auch direkt ein angelegtes Objekt auswaehlen kann. Das ist ja quasi
     die Uebersicht."
     Alle drei Wege standen verstreut — die Tabelle als weisser Balken ueber
     allem, Objektwahl und Einlesen mitten im Objekt-Reiter. Sie stehen
     jetzt zusammen am Anfang. */
  var SCHRITTE = [
    { id: 1, t: 'Übersicht',     stufe: 0, kurz: 'Vorhandene Berichte, Objekt wählen oder einlesen' },
    { id: 2, t: 'Objekt',        stufe: 1, kurz: 'Adresse und Eckdaten' },
    { id: 3, t: 'Zustand',       stufe: 2, kurz: 'Baustatus, Zustand, Qualität, Modernisierung' },
    { id: 4, t: 'Ausstattung',   stufe: 2, kurz: 'Energie, Heizung, Bad, Böden, Aufzug' },
    { id: 5, t: 'Gebäude & Außen', stufe: 2, kurz: 'Dach, Wände, Balkon, Grundstück, Stellplätze' },
    { id: 6, t: 'Wertermittlung', stufe: 3, kurz: 'Bodenwert, NHK, Feinjustierung' },
    { id: 7, t: 'Zusatzwerte',   stufe: 3, kurz: 'Liegenschaftszins, Sachwertfaktor, Bodenrichtwert' }
  ];

  /* Was in welchen Reiter gehoert. Zwei Schreibweisen:
       '#id' / '.klasse'  — das Element selbst
       'zeile:feldId'     — die `.row`, die dieses Feld enthaelt
     Ids und Klassen sind die vorhandenen — nichts ist neu erfunden. */
  var ZUORDNUNG = {
    1: ['#mbReportsPanel', '#mbow-host', '#dpktDrop', '.mbw-sichern', '.sep'],
    2: ['.mbw-h1', '.mbw-adresse', '#address', 'zeile:ptype', 'zeile:area', 'zeile:year', 'zeile:rent'],
    3: ['#wm-b1', 'zeile:cond', 'zeile:quality', 'zeile:modyear'],
    4: ['zeile:eq_energie', 'zeile:eq_floor', 'zeile:eq_guest_wc', '.mbw-aufzug'],
    5: ['zeile:eq_walls', 'zeile:balcony', 'zeile:garages'],
    6: ['#wm-b3'],
    7: ['.mbw-experte']
  };
  /* Diese bleiben UNTEN und gehoeren keinem Reiter — sie gelten immer.
     .mbw-aktionen ist die Zeile "Letzte Ausgabe / Teilbares Angebot";
     sie hat weder Id noch Klasse und wird in markieren() ausgezeichnet. */
  var FUSS = ['#precMeter', '#wm-fehlt', '#goBtn', '#replayBtn', '#errBox', '#genProgress',
              '#srcChips', '#costNote', '#loadSignal', '.mbw-aktionen'];

  var _aktiv = 1;
  var _klappWahl = false;   /* v1153: wurde der Schritt AUS DER LISTE gewaehlt? */
  var _panel = null;
  var _plan = null;

  function $(s) { return document.querySelector(s); }
  function id(s) { return document.getElementById(s); }

  /* ── Aufbau ─────────────────────────────────────────────────────────── */
  function stil() {
    if (id('mbw-css')) return;
    var s = document.createElement('style');
    s.id = 'mbw-css';
    s.textContent = [
      /* v1127c · UMBRECHEN, NICHT ABSCHNEIDEN. Gemessen: die Spalte ist
         338 px breit, die drei Reiter brauchen zusammen rund 372 px — mit
         `overflow-x:auto` war der dritte angeschnitten und nur durch
         seitliches Scrollen erreichbar. Ein Reiter, den man nicht sieht,
         ist kein Reiter. Mit flex-wrap rutscht er in die zweite Zeile. */
      '.mbw-reiter{display:flex;flex-wrap:wrap;gap:0 2px;',
        'border-bottom:2px solid rgba(128,128,128,.22);margin:0 0 14px}',
      '.mbw-r{flex:0 0 auto;padding:9px 11px;font:inherit;font-size:12.5px;cursor:pointer;',
        'background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-2px;',
        'color:inherit;opacity:.55;white-space:nowrap;transition:.15s}',
      '.mbw-r:hover{opacity:.85}',
      '.mbw-r.an{opacity:1;font-weight:600;border-bottom-color:var(--wl-c9a84c,#C9A84C)}',
      '.mbw-r .n{font-family:"JetBrains Mono",monospace;font-size:10.5px;opacity:.6;margin-right:5px}',
      '.mbw-r.fertig .n::after{content:" ✓";color:#4caf7d;opacity:1}',
      '.mbw-blatt{display:none}',
      /* === v1348 - EIN AUSSEHEN FUER ALLES ZURUECKGESTELLTE ==========
         Marcel: "achte darauf das alles gleich aussieht alle ausgeblendeten
         sachen werte felder. das sieht irgendwie manchmal nicht einheitlich
         aus." Er hat recht - es waren vier verschiedene Muster nebeneinander
         gewachsen: der Reiter-Hinweis (v1196), der Stufen-Vorhang (v1344),
         die minimierten Bloecke (v1347) und die Fehlt-Markierung.

         Ab hier gilt EIN Satz Regeln, und die anderen Dateien greifen
         darauf zu: dieselbe Schrift, dieselbe Farbe, derselbe Knopf. */
      '.mbw-r.mbw-spaeter{display:none}',
      '.mbw-spaeter-fuss{font-family:"Inter",system-ui,sans-serif;font-size:11px;',
        'color:var(--muted,#8a8a93);margin:-8px 0 12px;line-height:1.45;',
        'max-width:960px}',
      /* Der gemeinsame Hinweiskasten. mb-quellen.js und mb-karten.js
         benutzen dieselben Klassen. */
      '.mb-zurueck{margin:10px 0 14px;padding:13px 15px;border-radius:10px;',
        'font-family:"Inter",system-ui,sans-serif;font-size:12.5px;line-height:1.55;',
        'color:var(--muted,#9a9aa3);',
        'border:1px solid color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 26%, transparent);',
        'background:color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 5%, transparent)}',
      '.mb-zurueck b{color:var(--wl-b8932f,#b8932f);font-weight:600}',
      'html[data-mb-theme="light"] .mb-zurueck{background:#fffdf7;color:#5b564d}',
      'html[data-mb-theme="light"] .mb-zurueck b{color:#9a7f33}',
      /* Der gemeinsame Knopf zum Einblenden. */
      '.mb-auf{appearance:none;border:1px solid var(--wl-c9a84c,#C9A84C);',
        'background:transparent;color:var(--wl-c9a84c,#C9A84C);cursor:pointer;',
        'border-radius:999px;padding:7px 15px;margin-top:10px;',
        'font-family:"Inter",system-ui,sans-serif;font-size:12px;font-weight:600}',
      '.mb-auf:hover{background:color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 14%, transparent)}',
      'html[data-mb-theme="light"] .mb-auf{border-color:#9a7f33;color:#9a7f33}',
      '.mbw-blatt.an{display:block;animation:mbwRein .22s ease}',
      '@keyframes mbwRein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
      '.mbw-kurz{font-size:11px;opacity:.6;margin:-6px 0 12px}',
      /* v1196 · Hinweis in einem Reiter, dessen Angaben noch nicht dran sind. */
      /* v1348c: der Leer-Hinweis traegt .mb-zurueck / .mb-auf und
         bekommt sein Aussehen von dort. Die eigenen Werte hier
         standen im Widerspruch dazu (Radius 8 statt 10, grauer
         Rahmen, gefuellter Goldknopf statt Umriss) - GEMESSEN als
         zwei verschiedene Kasten-Stile nebeneinander. */
      '.mbw-nav{display:flex;gap:8px;align-items:center;margin:14px 0 10px;flex-wrap:wrap}',
      '.mbw-nav button{appearance:none;border:1px solid rgba(128,128,128,.35);background:transparent;',
        'color:inherit;border-radius:999px;padding:8px 15px;font:inherit;font-size:12.5px;cursor:pointer}',
      '.mbw-nav button:disabled{opacity:.35;cursor:not-allowed}',
      '.mbw-nav button.weiter{border-color:var(--wl-c9a84c,#C9A84C);color:var(--wl-c9a84c,#C9A84C);font-weight:600}',
      '.mbw-fuss{border-top:1px solid rgba(128,128,128,.18);padding-top:12px;margin-top:6px}',

      /* ── v1128 · BREIT-MODUS ────────────────────────────────────────────
         Marcels Befund: „das ist voll klein und gedrueckt — ich dachte, wir
         bauen einen grossen Wizard." Er hat recht, und es war mein Fehler:
         ich habe die Reiter in die LINKE SPALTE gequetscht.

         Gemessen: `.grid` steht auf `380px 898px`. Die Formularspalte ist
         fest 380 px breit, waehrend daneben 898 px leer stehen, solange
         kein Bericht da ist. Mein eigener Entwurf zeigte den Wizard ueber
         die volle Breite — umgesetzt hatte ich ihn im alten Korsett.

         Solange kein Ergebnis vorliegt, bekommt der Wizard die ganze
         Flaeche. Der Inhalt bleibt dabei auf 760 px zentriert: eine
         Formularzeile ueber 1.278 px waere unlesbar. Sobald das Ergebnis
         da ist, kommt die zweispaltige Ansicht zurueck — „am Schluss das
         Ergebnis wie jetzt". */
      'html.mb-breit .grid{grid-template-columns:1fr !important}',
      'html.mb-breit #resultPanel{display:none !important}',
      'html.mb-breit .panel{max-width:none}',
      /* v1172-BREITE · Marcels Befund am Bild `markztbericht.png`: die
         Schrittleiste ist breit, alles darüber und darunter schmal — „das
         muss optisch zusammenpassen."

         Die Ursache ist mein eigener Eingriff aus v1151. Dort habe ich der
         Reiterleiste eine eigene Grenze von 960 px gegeben, weil die sieben
         Marken 902 px brauchen und bei 760 px in zwei Zeilen umbrachen. Die
         Begründung stimmt technisch — die Leiste ist Navigation, keine
         Formularzeile. Nur entsteht dadurch eine ZWEITE Kante auf derselben
         Seite, und genau die sieht man.

         Jetzt eine gemeinsame Breite: 960 px für beides. Die 760 px kamen aus
         v1128 mit dem Argument, eine Formularzeile über 1.278 px sei unlesbar
         — 960 liegt deutlich darunter, das Argument bleibt gewahrt. Was es
         nicht mehr gibt, ist der sichtbare Versatz.

         `.mbw-reiter` behält seine eigene Regel weiter unten; sie steht jetzt
         auf demselben Maß und dient als Ankerpunkt, falls die Leiste später
         doch wieder mehr Platz braucht als der Inhalt. */
      'html.mb-breit #wm-ziel,html.mb-breit .mbw-blatt,',
        'html.mb-breit .mbw-nav,html.mb-breit .mbw-fuss,html.mb-breit #wm-ampel{',
        'max-width:960px;margin-left:auto;margin-right:auto}',
      /* v1151-LEISTE · Marcels Befund: „Die Punkte 1–7 sollten schon
         nebeneinander passen." Gemessen bei 1024, 1280 und 1920 px: die
         sieben Marken brauchen zusammen 902 px, ihr Behälter stand aber bei
         JEDER Fensterbreite auf 760 px — auch bei 1920, wo `.panel` 1300 px
         breit ist. Der Platz war da, die Leiste begrenzte sich selbst und
         brach in zwei Zeilen um (Oberkanten 374 und 421).

         Ursache war der Sammelselektor darüber: die 760 px sind für
         Formularzeilen und Text richtig gedacht („eine Formularzeile über
         1.278 px wäre unlesbar", v1128) — die Reiterleiste ist aber keine
         Formularzeile, sondern Navigation. Ein Selektor, der beides gleich
         behandelt, gibt einem von beiden das falsche Maß.

         Deshalb eine eigene Grenze: 960 px, also 58 px Luft über dem
         gemessenen Bedarf für längere Beschriftungen und andere
         Schriftgrößen. Zentriert wie zuvor, damit sie über dem 760er-Inhalt
         ausgerichtet bleibt. `flex-wrap:wrap` bleibt der Rückfall — bei
         390 px MUSS sie umbrechen, dort ist Nebeneinander unmöglich. */
      'html.mb-breit .mbw-reiter{max-width:960px;margin-left:auto;margin-right:auto}',
      'html.mb-breit .mbw-r{font-size:14px;padding:13px 20px}',
      'html.mb-breit .mbw-kurz{max-width:960px;margin-left:auto;margin-right:auto;font-size:12px}',
      'html.mb-breit input:not([type=checkbox]):not([type=radio]),html.mb-breit select{',
        'font-size:15px;padding:11px 12px}',
      'html.mb-breit label{font-size:13px}',
      /* Der Weiter-Knopf traegt den Weg — er darf gross sein. */
      'html.mb-breit .mbw-nav{display:flex;gap:10px;padding-top:6px}',
      'html.mb-breit .mbw-nav button{padding:12px 26px;font-size:14px}',
      'html.mb-breit .mbw-nav button.weiter{background:linear-gradient(110deg,',
        'var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));',
        'color:#2c2410;border-color:transparent}',
      'html.mb-breit #goBtn{width:100%;padding:15px 20px;font-size:15px}',
      /* Der Ladebalken bekommt die Buehne, statt unten zu kleben. */
      'html.mb-breit #genProgress{max-width:960px;margin:18px auto 0;padding:18px 20px}',
      'html.mb-erzeugt .mbw-reiter,html.mb-erzeugt .mbw-blatt,html.mb-erzeugt .mbw-nav{',
        'opacity:.35;pointer-events:none;transition:opacity .3s}',
      /* v1129c · Balken, Prozent und Schritte. */
      '.mbw-pkopf{display:flex;align-items:baseline;gap:10px;font-size:12.5px;font-weight:600;margin-bottom:7px}',
      '.mbw-pct{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:13px;',
        'font-weight:700;color:var(--wl-c9a84c,#C9A84C)}',
      '.mbw-pbahn{height:7px;border-radius:4px;background:rgba(128,128,128,.25);overflow:hidden;margin-bottom:9px}',
      '.mbw-pbahn i{display:block;height:100%;border-radius:4px;transition:width .45s ease;',
        'background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f))}',
      '#genProgSteps{font-size:12px;line-height:1.7}',
      'html.mb-breit #genProgress{font-size:13px}',

      /* ══ v1153-KLAPP · Zweite Darstellung fuer schmale Schirme ══════════
         Marcels Befund: „Es muss auf dem Handy funktionieren. Eine
         siebenteilige Schrittleiste nebeneinander und ein Handy schliessen
         sich aus — der Entwurf braucht ZWEI Darstellungen derselben
         Fuehrung, nicht eine gequetschte."

         Gemessen bei 390 px: die sieben Marken brauchen 902 px, im Behaelter
         stehen 305 px, also vier Zeilen und ~188 px, bevor eine einzige
         Angabe zu sehen ist. Nichts beschnitten, alles erreichbar — kein
         Defekt, eine Platzfrage.

         Von drei gezeigten Fassungen hat Marcel C gewaehlt (Demo:
         design/Vorschlaege/marktbericht-schrittleiste-handy.html): die
         Klappleiste. Zugeklappt ~50 px, aufgeklappt die volle Liste. Sie ist
         die einzige, die NICHTS wegnimmt — der direkte Sprung zu jedem
         Schritt bleibt. Dasselbe Muster wie die Kompakt-Karte der Sidebar
         (v1092/v1094): eine schmale Zeile zum Aufklappen.

         DIESELBEN KNOEPFE, andere Huelle. Kein zweiter Reiter-Satz — sonst
         gibt es zwei Listen, die auseinanderlaufen (die Lehre aus v1096b
         und v1112b). Unter 900 px wird `#mbw-reiter` zur senkrechten Liste,
         darueber bleibt alles wie es ist.

         Schwelle 900 px: dieselbe, an der die App auf den Drawer umschaltet.
         Damit gibt es zwei Fassungen und keine dritte Zwischenform. */
      '.mbw-klapp{display:none}',
      '@media (max-width:900px){',
        '.mbw-klapp{display:block;max-width:960px;margin:0 auto 8px}',
        '.mbw-klapp-kopf{display:flex;align-items:center;gap:10px;width:100%;',
          'min-height:46px;padding:9px 13px;border:1px solid var(--line,#e6e0d3);',
          'border-radius:10px;background:var(--panel,#faf8f2);color:inherit;',
          'font:inherit;text-align:left;cursor:pointer}',
        '.mbw-klapp-kopf .n{font-family:"JetBrains Mono",monospace;font-size:10.5px;',
          'letter-spacing:.6px;color:var(--muted,#8a857c);flex:0 0 auto}',
        '.mbw-klapp-kopf .t{font-family:"Space Grotesk",system-ui,sans-serif;font-size:15px;',
          'font-weight:600;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.mbw-klapp-kopf .pf{font-size:12px;color:var(--muted,#8a857c);flex:0 0 auto;',
          'transition:transform .18s ease}',
        'html:not(.mbw-zu) .mbw-klapp-kopf .pf{transform:rotate(90deg)}',
        '.mbw-klapp-bahn{height:3px;border-radius:3px;background:rgba(128,128,128,.22);',
          'overflow:hidden;margin:6px 2px 0}',
        '.mbw-klapp-bahn i{display:block;height:100%;border-radius:3px;transition:width .35s ease;',
          'background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f))}',
        /* Die Leiste selbst wird zur Liste — 44 px je Zeile, linksbuendig. */
        'html.mb-breit .mbw-reiter,.mbw-reiter{flex-direction:column;gap:4px;max-width:960px}',
        '.mbw-reiter .mbw-r{width:100%;min-height:44px;border-radius:9px;text-align:left;',
          'border-bottom:1px solid var(--line,#e6e0d3);box-shadow:none}',
        '.mbw-reiter .mbw-r.an{box-shadow:inset 0 0 0 1px var(--wl-c9a84c,#C9A84C)}',
        /* Zugeklappt: die Liste ist weg, die Kopfzeile traegt den Stand. */
        'html.mbw-zu .mbw-reiter{display:none}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── v1153-KLAPP · Kopfzeile bauen, Zustand merken ─────────────────────
     Der Merker haelt den Zustand ueber das Neuladen: zugeklappt bleibt
     zugeklappt, wie bei der Kompakt-Karte. Standard ist ZU — wer auf dem
     Handy ankommt, will Felder sehen, nicht ein Menue. */
  var MERKER = 'dp_mb_leiste_zu';
  function klappZu() { try { return localStorage.getItem(MERKER) !== '0'; } catch (e) { return true; } }
  function klappSetzen(zu) {
    document.documentElement.classList.toggle('mbw-zu', !!zu);
    try { localStorage.setItem(MERKER, zu ? '1' : '0'); } catch (e) {}
  }
  function schmal() {
    try { return window.matchMedia('(max-width:900px)').matches; } catch (e) { return false; }
  }
  function klappBauen(reiter) {
    if (id('mbw-klapp')) return true;
    /* v1153b · Ohne Referenzknoten im Dokument gibt es keine Kopfzeile —
       und dann darf `mbw-zu` NICHT gesetzt werden, sonst versteckt der
       Zustand die Liste, ohne einen Ersatz anzubieten. Laut melden statt
       still scheitern: ein stummes catch hat schon einmal eine Korrektur
       nie laufen lassen (config.js/DPC). */
    if (!reiter || !reiter.parentNode) {
      try { console.warn('[v1153b] Klappleiste nicht gebaut: Reiterleiste hängt nicht im Dokument. ' +
        'Die Leiste bleibt aufgeklappt — das ist der sichere Zustand.'); } catch (e) {}
      document.documentElement.classList.remove('mbw-zu');
      return false;
    }
    var k = document.createElement('div');
    k.className = 'mbw-klapp';
    k.id = 'mbw-klapp';
    k.innerHTML = '<button type="button" class="mbw-klapp-kopf" id="mbw-klapp-kopf" aria-expanded="false">'
      + '<span class="n"></span><span class="t"></span><span class="pf">▸</span></button>'
      + '<div class="mbw-klapp-bahn"><i style="width:0"></i></div>';
    reiter.parentNode.insertBefore(k, reiter);
    k.querySelector('#mbw-klapp-kopf').addEventListener('click', function () {
      klappSetzen(!document.documentElement.classList.contains('mbw-zu'));
      klappNachziehen();
    });
    klappSetzen(klappZu());
    klappNachziehen();
    return true;
  }
  /* Kopfzeile an den aktiven Schritt anpassen. Klappt NICHT von selbst auf —
     sonst springt das Layout bei jedem „Weiter". */
  function klappNachziehen() {
    var kopf = id('mbw-klapp-kopf');
    if (!kopf) return;
    var s = null;
    for (var i = 0; i < SCHRITTE.length; i++) if (SCHRITTE[i].id === _aktiv) s = SCHRITTE[i];
    if (!s) return;
    kopf.querySelector('.n').textContent = s.id + '/' + SCHRITTE.length;
    kopf.querySelector('.t').textContent = s.t;
    kopf.setAttribute('aria-expanded', document.documentElement.classList.contains('mbw-zu') ? 'false' : 'true');
    var bahn = document.querySelector('.mbw-klapp-bahn i');
    if (bahn) bahn.style.width = Math.round(s.id / SCHRITTE.length * 100) + '%';
  }

  /* Adresse und die Sichern-Knoepfe tragen keine Id — sie bekommen eine
     Klasse, damit die Zuordnung sie greifen kann. Einmalig, additiv. */
  function markieren() {
    var a = id('address');
    if (a) {
      var lab = a.previousElementSibling;
      if (lab && lab.tagName === 'LABEL' && !lab.classList.contains('mbw-adresse')) lab.classList.add('mbw-adresse');
    }
    var sv = id('saveFileBtn');
    if (sv && sv.parentElement && !sv.parentElement.classList.contains('mbw-sichern')) {
      sv.parentElement.classList.add('mbw-sichern');
    }
    /* Die Aktionszeile "Letzte Ausgabe / Teilbares Angebot" hat weder Id
       noch Klasse — erkennbar nur am versteckten Datei-Eingabefeld darin. */
    var lf = id('loadFileInput');
    if (lf && lf.parentElement && !lf.parentElement.classList.contains('mbw-aktionen')) {
      lf.parentElement.classList.add('mbw-aktionen');
    }
    /* Die Ueberschrift "Objekt eingeben" doppelt jetzt den Reiternamen —
       sie wandert mit hinein, statt darueber stehenzubleiben. */
    if (_panel) {
      var h = _panel.querySelector(':scope > h1');
      if (h && !h.classList.contains('mbw-h1')) h.classList.add('mbw-h1');
    }
    /* v1129 · Die Aufzug-Zeile ist als einzige keine `.row`. */
    var el = id('elevator');
    if (el) {
      var w = el.closest('div');
      if (w && !w.classList.contains('mbw-aufzug') && !w.classList.contains('row')) w.classList.add('mbw-aufzug');
    }
    /* v1129 · Der Expertenblock bekommt einen eigenen Reiter. Er wird von
       wertermittlung.js bei jedem zeichnen() NEU gebaut — deshalb wird er
       bei jedem Einraeumen frisch ausgezeichnet, nicht einmalig. */
    var eb = id('wm-exp-box');
    if (eb && eb.parentElement) eb.parentElement.classList.add('mbw-experte');
  }

  /* 'zeile:feldId' -> die `.row`, die dieses Feld enthaelt.
     Warum nicht `.row:has(#id)`: kuerzer, aber `:has()` faellt in aelteren
     Browsern still aus — und ein still ausgefallener Selektor laesst Felder
     unsichtbar im alten Behaelter zurueck. */
  function aufloesen(sel) {
    /* v1130: im ganzen Dokument suchen, nicht nur in der Formularspalte —
       `#mbReportsPanel` steht ausserhalb, als Geschwister der `.grid`.
       Die Selektoren sind samt und sonders eigene Ids und Klassen; ein
       Fehlgriff anderswo ist damit ausgeschlossen. */
    if (sel.indexOf('zeile:') !== 0) return document.querySelectorAll(sel);
    var f = id(sel.slice(6));
    if (!f) return [];
    var z = f.closest('.row') || f.closest('div');
    return z ? [z] : [];
  }

  function bauen() {
    _panel = id('wm-ziel') ? id('wm-ziel').parentNode : null;
    if (!_panel || id('mbw-reiter')) return !!_panel;
    stil();
    markieren();

    var reiter = document.createElement('div');
    reiter.className = 'mbw-reiter';
    reiter.id = 'mbw-reiter';
    reiter.innerHTML = SCHRITTE.map(function (s) {
      return '<button type="button" class="mbw-r" data-mbw="' + s.id + '">' +
        '<span class="n">' + s.id + '</span>' + s.t + '</button>';
    }).join('');

    var blaetter = document.createElement('div');
    blaetter.id = 'mbw-blaetter';
    blaetter.innerHTML = SCHRITTE.map(function (s) {
      return '<div class="mbw-blatt" id="mbw-b' + s.id + '">' +
        '<div class="mbw-kurz">' + s.kurz + '</div></div>';
    }).join('') +
      '<div class="mbw-nav" id="mbw-nav">' +
        '<button type="button" id="mbw-zur">← Zurück</button>' +
        '<button type="button" class="weiter" id="mbw-vor">Weiter →</button>' +
      '</div>' +
      '<div class="mbw-fuss" id="mbw-fuss"></div>';

    /* Direkt hinter die Meilensteinleiste — sie bleibt oben stehen und
       gilt fuer alle Reiter. */
    var nachher = id('wm-ziel');
    nachher.parentNode.insertBefore(reiter, nachher.nextSibling);
    /* v1153b · HIER, nicht früher. Der erste Anlauf rief klappBauen() auf,
       während `reiter` noch nicht im Dokument hing — `reiter.parentNode` war
       null, das insertBefore lief ins Leere, die Kopfzeile entstand nie.
       Gesetzt wurde `html.mbw-zu` trotzdem, und damit war unter 900 px
       ÜBERHAUPT keine Führung mehr sichtbar: die Liste versteckt, die
       Kopfzeile nicht vorhanden. Ein stiller Fehlschlag, der schlimmer war
       als der Zustand davor. */
    klappBauen(reiter);
    reiter.parentNode.insertBefore(blaetter, reiter.nextSibling);

    reiter.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mbw]');
      /* v1153-KLAPP · Eine Wahl AUS DER LISTE klappt sie danach zu; ein
         Wechsel über „Weiter/Zurück" nicht. Deshalb der Merker hier und
         nicht in zeige() selbst. */
      if (b) _klappWahl = true;
      if (b) zeige(parseInt(b.getAttribute('data-mbw'), 10));
    });
    /* v1348: ueber das Weggefallene springen, nicht durch. */
    id('mbw-vor').addEventListener('click', function () { var n = nachbar(1); if (n != null) zeige(n); });
    id('mbw-zur').addEventListener('click', function () { var n = nachbar(-1); if (n != null) zeige(n); });
    return true;
  }

  /* ── Umhaengen ──────────────────────────────────────────────────────── */
  /* v1129: sucht im GANZEN Teilbaum, nicht nur unter den direkten Kindern.
     Die Zeilen liegen verschachtelt in `precBox`, der Expertenblock in
     `wm-b3`. Ein Element, das schon im richtigen Blatt sitzt, wird nicht
     angefasst — sonst wanderte bei jedem Lauf der Fokus. */
  function verschieben(el, ziel) {
    if (!el || !ziel || el.parentElement === ziel) return;
    if (ziel.contains(el)) return;
    ziel.appendChild(el);
  }
  /* ── v1129b · DOPPELTE IDs, im Prueflauf gefunden ──────────────────────
     Der Expertenblock steckt in `wm-b3`, und wertermittlung.js baut `wm-b3`
     bei jedem zeichnen() NEU. Hatte ich den Block vorher nach Reiter 6
     verschoben, entstand daneben eine ZWEITE, leere Fassung — mit denselben
     Ids. `getElementById` nimmt die erste; payload() las damit die leere.
     Gemessen: lzs und sachwertfaktor waren zweimal da, der Wert stand in
     der einen, gelesen wurde die andere. Ergebnis: lzs_pct = null.

     Regel: Es darf immer nur EINE geben. Behalten wird die im Reiter — dort
     stehen die Eingaben des Nutzers; die frisch gebaute ist leer. Ein
     Wertabgleich ist nicht noetig, weil die neue nie Werte trug. */
  function expertenDubletten(ziel) {
    var alle = document.querySelectorAll('[id="wm-exp-box"]');
    if (alle.length < 2 || !ziel) return;
    var behalten = null;
    Array.prototype.forEach.call(alle, function (b) { if (ziel.contains(b)) behalten = b; });
    if (!behalten) behalten = alle[0];
    Array.prototype.forEach.call(alle, function (b) {
      if (b === behalten) return;
      var huelle = b.parentElement;
      if (huelle && huelle.parentElement) huelle.parentElement.removeChild(huelle);
      else if (b.parentElement) b.parentElement.removeChild(b);
    });
  }

  function einraeumen() {
    if (!_panel || !id('mbw-blaetter')) return;
    expertenDubletten(id('mbw-b' + SCHRITTE[SCHRITTE.length - 1].id));
    markieren();
    Object.keys(ZUORDNUNG).forEach(function (n) {
      var ziel = id('mbw-b' + n);
      if (!ziel) return;
      ZUORDNUNG[n].forEach(function (sel) {
        Array.prototype.slice.call(aufloesen(sel)).forEach(function (el) { verschieben(el, ziel); });
      });
    });
    var fuss = id('mbw-fuss');
    if (fuss) {
      FUSS.forEach(function (sel) {
        Array.prototype.slice.call(aufloesen(sel)).forEach(function (el) { verschieben(el, fuss); });
      });
    }
    /* precHead/precBox haben ausgedient: die Reiter uebernehmen das
       Auf- und Zuklappen. Der leere Behaelter bleibt stehen (app.js fasst
       ihn an), wird aber nicht mehr gezeigt. */
    ['precHead', 'precBox'].forEach(function (x) {
      var e = id(x); if (e) { e.style.display = 'none'; verschieben(e, fuss || _panel); }
    });
    /* v1196 · Nach jedem Einraeumen neu bewerten: ein Reiter kann durch eine
       Nutzereingabe gerade Felder bekommen haben — dann muss der Hinweis weg
       — oder immer noch keine haben, dann gehoert er hin. */
    SCHRITTE.forEach(function (s) { leerHinweis(s, id('mbw-b' + s.id)); });
  }

  /* ── v1196 · Ein leerer Reiter sah aus wie ein Defekt ────────────────────
     Gemessen am 01.09.2026 auf Staging, Objekt „Hölderlinstr. 1", erreichte
     Stufe 1: die Reiter 6 (Wertermittlung) und 7 (Zusatzwerte) waren
     **18 px hoch und trugen null Felder**. Sichtbar war nur ihre eigene
     Unterzeile — „Bodenwert, NHK, Feinjustierung". Kein Satz, warum da
     nichts steht, und kein Weg weiter.

     Kaputt war nichts: die Felder gehoeren zu Stufe 3 und werden
     eingeblendet, sobald man diese Tiefe ansteuert (die Ampel sagt
     „Eine Zeile tiefer klicken blendet die naechsten Angaben ein").
     Gemessen: nach einem Klick auf die Ampel-Zeile 3 fuellt sich Reiter 6
     mit 15 und Reiter 7 mit 6 Feldern.

     Aber wer den Reiter direkt anklickt, sieht das nicht — er sieht eine
     leere Seite. **Eine richtige Mechanik, die aussieht wie ein Fehler,
     ist ein Fehler.**

     DER TEXT KOMMT AUS DER AMPEL, NICHT AUS EINER ZWEITEN LISTE.
     Name der Stufe und das, was fehlt, werden aus der gerenderten
     Ampel-Zeile gelesen (`.mbst-ms[data-mbst-ziel]`), und der Knopf
     klickt genau diese Zeile. Damit gibt es hier keine Kopie, die
     auseinanderlaufen kann — die Falle, die im Marktbericht schon
     sechsmal zugeschlagen hat (v1126d, v1152, v1154, v1183, v1185,
     v1195). Ist die Ampel noch nicht da, erscheint gar kein Hinweis:
     lieber nichts sagen als etwas Erfundenes. */
  function leerHinweis(s, blatt) {
    if (!blatt || !s || !s.stufe) return;
    var alt = blatt.querySelector('.mbw-leer');
    /* Sobald echte Felder drin sind, hat der Hinweis seinen Zweck erfuellt. */
    if (blatt.querySelector('input,select,textarea')) {
      if (alt && alt.parentNode) alt.parentNode.removeChild(alt);
      return;
    }
    var zeile = document.querySelector('.mbst-ms[data-mbst-ziel="' + s.stufe + '"]');
    if (!zeile) return;
    var name = (zeile.querySelector('.mbst-name') || {}).textContent || '';
    var fehlt = (zeile.querySelector('.mbst-fehlt') || {}).textContent || '';
    if (!name) return;
    if (alt && alt.getAttribute('data-fuer') === name + '|' + fehlt) return;  /* unveraendert */
    if (alt && alt.parentNode) alt.parentNode.removeChild(alt);

    var box = document.createElement('div');
    box.className = 'mbw-leer mb-zurueck';
    box.setAttribute('data-fuer', name + '|' + fehlt);
    var p = document.createElement('div');
    p.innerHTML = '<b>Diese Angaben gehören zu: ' + name + '.</b><br>' +
      'Sie erscheinen hier, sobald du diese Tiefe ansteuerst.' +
      (fehlt ? ' Dafür ' + fehlt.replace(/^fehlt:/, 'fehlt noch:') + '.' : '');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mbw-leer-btn mb-auf';
    btn.textContent = 'Angaben einblenden';
    /* ── v1196b · Die Ampel-Zeile NICHT festhalten, sondern frisch suchen ──
       Der erste Anlauf schrieb `zeile.click()` mit der Referenz, die beim
       Bauen des Hinweises gegriffen wurde. Gemessen auf Staging: das
       funktioniert genau einmal nicht.

       `mb-stufen.zeichnen()` setzt bei JEDEM `melden()` das innerHTML von
       `#wm-ziel` neu — die Zeile ist danach ein anderes Element, die alte
       Referenz haengt losgeloest im Speicher. Und ein losgeloester Knoten
       hat keinen Weg mehr zum `document`, an dem der Meilenstein-Handler
       als delegierter Listener haengt (`mb-stufen.js:358`). Der Klick geht
       also ins Leere, ohne Fehler, ohne Wirkung.

       Beweis: derselbe Klick auf die FRISCH gesuchte Zeile blendet 12
       Felder ein und raeumt den Hinweis ab; die Gegenprobe
       `querySelector(...) === alteReferenz` ergab „neues Element".

       Deshalb wird hier nur die STUFENZAHL festgehalten und das Element
       erst im Moment des Klicks gesucht. */
    btn.addEventListener('click', function () {
      var frisch = document.querySelector('.mbst-ms[data-mbst-ziel="' + s.stufe + '"]');
      if (frisch) frisch.click();
    });
    box.appendChild(p);
    box.appendChild(btn);
    blatt.appendChild(box);
  }

  /* === v1348 - GANZE SCHRITTE FALLEN WEG, NICHT NUR FELDER ===========
     Marcels Vorgabe: „ich wuerde aber vlt die bereiche dann oder den
     gesamten schritt ausblenden. die folge hat dann halt weniger tabs."

     Die Stufe steht seit v1129 in `SCHRITTE[].stufe` — 0, 1, 2, 2, 2, 3, 3.
     Hier wird KEINE zweite Liste gefuehrt; das waere die Doppelliste, an
     der der Marktbericht schon sechsmal gescheitert ist.

       Stufe 1  Uebersicht · Objekt
       Stufe 2  + Zustand · Ausstattung · Gebaeude & Aussen
       Stufe 3  + Wertermittlung · Zusatzwerte

     DREI DINGE MUESSEN ZUSAMMENPASSEN, sonst entsteht eine Sackgasse:
     der Reiter verschwindet, „Weiter" ueberspringt ihn, und wenn der
     GERADE OFFENE Schritt wegfaellt, wandert die Ansicht auf den letzten
     sichtbaren. Ohne das dritte stuende man vor einem leeren Blatt.

     Ein Schritt, in dem schon etwas ausgefuellt ist, bleibt IMMER stehen.
     Eingaben verschwinden nicht aus dem Blick — dieselbe Regel wie bei den
     Bloecken (v1347). */
  function gewaehlteStufe() {
    try {
      var st = window.DealPilotMbStufen;
      if (st && typeof st.gewaehlt === 'function') {
        var n = parseInt(st.gewaehlt(), 10);
        if (n >= 1 && n <= 3) return n;
      }
    } catch (e) {}
    return 3;
  }

  function schrittHatInhalt(sid) {
    var b = id('mbw-b' + sid);
    if (!b) return false;
    var f = b.querySelectorAll('input,select,textarea');
    for (var i = 0; i < f.length; i++) {
      var e = f[i];
      if (e.type === 'checkbox') { if (e.checked) return true; continue; }
      if (String(e.value == null ? '' : e.value).trim() !== '') return true;
    }
    return false;
  }

  /* Welche Schritte gelten gerade? Reihenfolge bleibt die von SCHRITTE. */
  function sichtbareSchritte() {
    var stufe = gewaehlteStufe();
    return SCHRITTE.filter(function (s) {
      if (!s.stufe) return true;               /* Uebersicht: immer */
      if (s.stufe <= stufe) return true;
      return schrittHatInhalt(s.id);           /* was gefuellt ist, bleibt */
    });
  }

  function schritteFiltern() {
    var sicht = sichtbareSchritte();
    var erlaubt = {};
    sicht.forEach(function (s) { erlaubt[s.id] = 1; });
    var weg = 0;
    SCHRITTE.forEach(function (s) {
      var r = document.querySelector('.mbw-r[data-mbw="' + s.id + '"]');
      var b = id('mbw-b' + s.id);
      var aus = !erlaubt[s.id];
      if (aus) weg++;
      if (r) r.classList.toggle('mbw-spaeter', aus);
      if (b && aus) b.classList.remove('an');
    });

    /* Die Fusszeile sagt, was fehlt — sonst wirkt es wie ein Verlust. */
    var leiste = id('mbw-reiter');
    var alt = document.querySelector('.mbw-spaeter-fuss');
    if (leiste && weg > 0) {
      if (!alt) {
        alt = document.createElement('div');
        alt.className = 'mbw-spaeter-fuss';
        if (leiste.parentNode) leiste.parentNode.insertBefore(alt, leiste.nextSibling);
      }
      alt.textContent = weg + (weg === 1 ? ' weiterer Schritt erscheint' : ' weitere Schritte erscheinen')
        + ', wenn du eine gr\u00f6\u00dfere Tiefe w\u00e4hlst.';
    } else if (alt && alt.parentNode) {
      alt.parentNode.removeChild(alt);
    }

    /* Steht die Ansicht auf einem weggefallenen Schritt, wandert sie. */
    if (!erlaubt[_aktiv] && sicht.length) {
      var ziel = sicht[sicht.length - 1];
      for (var i = 0; i < sicht.length; i++) { if (sicht[i].id > _aktiv) { ziel = sicht[i]; break; } }
      if (ziel && ziel.id !== _aktiv) { zeige(ziel.id); return true; }
    }
    return false;
  }

  /* „Weiter" und „Zurueck" springen ueber das Weggefallene. */
  function nachbar(richtung) {
    var sicht = sichtbareSchritte();
    var pos = -1;
    for (var i = 0; i < sicht.length; i++) { if (sicht[i].id === _aktiv) { pos = i; break; } }
    if (pos < 0) return sicht.length ? sicht[0].id : 1;
    var n = pos + richtung;
    if (n < 0 || n >= sicht.length) return null;
    return sicht[n].id;
  }

  function zeige(n) {

    _aktiv = n;
    SCHRITTE.forEach(function (s) {
      var b = id('mbw-b' + s.id);
      if (b) b.classList.toggle('an', s.id === n);
      leerHinweis(s, b);                                   /* v1196 */
      var r = document.querySelector('.mbw-r[data-mbw="' + s.id + '"]');
      if (r) {
        r.classList.toggle('an', s.id === n);
        var erreicht = 0;
        try { erreicht = window.DealPilotMbStufen ? window.DealPilotMbStufen.erreicht() : 0; } catch (e) {}
        r.classList.toggle('fertig', s.id <= erreicht);
      }
    });
    var z = id('mbw-zur'), v = id('mbw-vor');
    /* v1348: nicht mehr gegen die GESAMTZAHL, sondern gegen das, was
       gerade gilt. Sonst zeigt „Weiter" auf einen Schritt, den es nicht
       mehr gibt. */
    if (z) z.disabled = (nachbar(-1) == null);
    if (v) v.disabled = (nachbar(1) == null);

    /* v1153-KLAPP · Kopfzeile mitziehen, und auf schmalen Schirmen nach der
       Wahl zuklappen: die Liste hat ihren Zweck erfuellt und gaebe sonst
       die Flaeche nicht frei. Ein Wechsel ueber „Weiter" laesst sie zu, wie
       sie ist — er oeffnet sie nicht und schliesst sie nicht. */
    if (schmal() && _klappWahl) { klappSetzen(true); _klappWahl = false; }
    klappNachziehen();
    try { var w = id('mbw-reiter'); if (w) w.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }

  function angestossen() {
    if (_plan) clearTimeout(_plan);
    _plan = setTimeout(function () {
      einraeumen();
      /* v1348: erst filtern, dann zeigen. `schritteFiltern` kann die
         Ansicht selbst umsetzen (wenn der offene Schritt wegfaellt)
         und meldet das - dann waere ein zweites `zeige` nur ein
         ueberfluessiger Neuaufbau. */
      var gewandert = false;
      try { gewandert = schritteFiltern(); } catch (e) {}
      if (!gewandert) zeige(_aktiv);
    }, 120);
  }

  /* ── v1128 · Breit, solange kein Ergebnis da ist ──────────────────────
     Erkennung am vorhandenen Zustand, nicht an einem eigenen Merker:
     `#resultBody` traegt die Klasse `hide`, solange kein Bericht vorliegt
     (app.js). Das ist die Wahrheit der App — ein zweiter Merker waere eine
     zweite Wahrheit. */
  function ergebnisDa() {
    var rb = id('resultBody');
    return !!(rb && !rb.classList.contains('hide'));
  }
  function erzeugtGerade() {
    var p = id('genProgress');
    return !!(p && !p.classList.contains('hide'));
  }
  function breiteSetzen() {
    var w = document.documentElement;
    w.classList.toggle('mb-breit', !ergebnisDa());
    w.classList.toggle('mb-erzeugt', erzeugtGerade() && !ergebnisDa());
    prozent();
  }

  /* ── v1129 · Prozentzahl am Ladebalken ────────────────────────────────
     Marcels Wunsch: „am besten mit Prozentangabe". Der Balken selbst gibt
     es schon (app.js setzt `#genProgBar.style.width` in Prozent) — die Zahl
     wird daraus GELESEN, nicht zweitgerechnet. Ein eigener Zaehler wuerde
     vom Balken abweichen, sobald app.js seine Kurve aendert. */
  /* v1129c · DER LADEBALKEN HAT NIE EXISTIERT.
     Gemessen: `#genProgress` ist im HTML ein LEERES div. app.js sucht darin
     `#genProgBar` (Z. 283) und `#genProgSteps` (Z. 289) — beide gibt es
     nicht. Folge: der Balken-Code lief ins Leere, und die Schritte wurden
     mit `prog.innerHTML = …` direkt in den Kasten geschrieben. Es gab also
     immer nur eine Schrittliste, nie einen Balken.

     Hier wird das Geruest gebaut, das der vorhandene Code erwartet — dann
     fuellt app.js beides von selbst, und nichts wird mehr ueberschrieben:
       Kopfzeile  Beschriftung + Prozent
       #genProgBar  der Balken
       #genProgSteps  die Schritte (wie bisher) */
  var _pctBeob = null;
  function geruest() {
    var kopf = id('genProgress');
    if (!kopf || id('genProgBar')) return;
    kopf.innerHTML =
      '<div class="mbw-pkopf"><span>Bericht wird erstellt</span>' +
        '<span class="mbw-pct" id="mbw-pct">0 %</span></div>' +
      '<div class="mbw-pbahn"><i id="genProgBar" style="width:0%"></i></div>' +
      '<div id="genProgSteps"></div>';
  }
  function prozent() {
    geruest();
    var bar = id('genProgBar'), lbl = id('mbw-pct');
    if (!bar || !lbl) return;
    var w = Math.round(parseFloat(bar.style.width) || 0);
    lbl.textContent = w + ' %';
    if (!_pctBeob) {
      try {
        _pctBeob = new MutationObserver(function () { prozent(); });
        _pctBeob.observe(bar, { attributes: true, attributeFilter: ['style'] });
      } catch (e) {}
    }
  }

  function start() {
    if (!id('wm-ziel')) { setTimeout(start, 400); return; }
    if (!bauen()) { setTimeout(start, 400); return; }
    einraeumen();
    zeige(1);
    breiteSetzen();
    /* zeichnen() setzt wm-b1/b3 neu in die Panel-Spalte — zurueckholen. */
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].target === _panel && muts[i].addedNodes.length) { angestossen(); return; }
        }
      }).observe(_panel, { childList: true });
    } catch (e) {}
    /* Ergebnis und Ladebalken beobachten — beide schalten die Breite. */
    try {
      var beob = new MutationObserver(function () { breiteSetzen(); });
      var rb = id('resultBody'), gp = id('genProgress');
      if (rb) beob.observe(rb, { attributes: true, attributeFilter: ['class'] });
      if (gp) beob.observe(gp, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
    /* Die Reiter-Haken folgen der erreichten Stufe. */
    document.addEventListener('change', function () { setTimeout(function () { zeige(_aktiv); }, 250); }, true);
  }

  /* === v1336b - GLEICHE LABELHOEHE, DAMIT DIE FELDER FLUCHTEN =========
     Marcel: "Die Formatierung der Felder passt oft nicht Eingabefelder zu
     Textfeldern fluchten nicht."

     Gemessen in der Zeile Balkon / Garten / Grundstueck / Wohneinheiten:
     die ersten beiden Labels sind 19 px hoch, die letzten beiden 58 -
     ihre Erklaerung braucht drei Zeilen. Damit stehen die Eingabefelder
     derselben Zeile 133 px versetzt.

     Eine CSS-Regel kann das nicht loesen: welche Felder nebeneinander
     landen, entscheidet erst der Umbruch, und der haengt an der
     Fensterbreite. Deshalb wird nach dem Umbruch gemessen - Zellen mit
     derselben Oberkante bilden eine Rasterzeile, und deren Labels
     bekommen die groesste vorkommende Hoehe.

     `min-height` statt `height`: ein Label darf wachsen, wenn der Text
     laenger wird, es soll nur nicht kuerzer sein als seine Nachbarn. */
  function labelsAngleichen() {
    var zeilen = document.querySelectorAll('.panel .row');
    for (var i = 0; i < zeilen.length; i++) {
      var r = zeilen[i];
      var zellen = Array.prototype.slice.call(r.children);
      if (zellen.length < 2) continue;
      var labs = [];
      for (var j = 0; j < zellen.length; j++) {
        var l = null;
        for (var k = 0; k < zellen[j].children.length; k++) {
          if (zellen[j].children[k].tagName === 'LABEL') { l = zellen[j].children[k]; break; }
        }
        if (l) { l.style.minHeight = ''; labs.push({ zelle: zellen[j], lab: l }); }
      }
      if (labs.length < 2) continue;
      /* Erst nach dem Zuruecksetzen messen - sonst misst man die eigene
         Vorgabe vom letzten Lauf (dieselbe Falle wie beim Skin). */
      var gruppen = {};
      for (var m = 0; m < labs.length; m++) {
        var oben = Math.round(labs[m].zelle.getBoundingClientRect().top);
        (gruppen[oben] = gruppen[oben] || []).push(labs[m].lab);
      }
      Object.keys(gruppen).forEach(function (oben) {
        var g = gruppen[oben];
        if (g.length < 2) return;
        var hoch = 0;
        for (var n = 0; n < g.length; n++) hoch = Math.max(hoch, g[n].getBoundingClientRect().height);
        if (hoch <= 0) return;
        for (var p = 0; p < g.length; p++) g[p].style.minHeight = hoch + 'px';
      });
    }
  }
  window.MbLabelsAngleichen = labelsAngleichen;

  var _angZeit = null;
  function angleichenBald() {
    if (_angZeit) clearTimeout(_angZeit);
    _angZeit = setTimeout(function () { _angZeit = null; try { labelsAngleichen(); } catch (e) {} }, 120);
  }
  function angleichenStarten() {
    angleichenBald();
    window.addEventListener('resize', angleichenBald);
    /* Reiterwechsel, neue Felder, ein eingehaengter Ankertext - alles
       aendert die Labelhoehe. Gedrosselt, sonst misst der Beobachter
       seine eigene Aenderung. */
    try {
      new MutationObserver(function () { angleichenBald(); })
        .observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', angleichenStarten);
  else angleichenStarten();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotMbWizard = {
    zeige: zeige, einraeumen: einraeumen,
    _stand: function () {
      return { aktiv: _aktiv, blaetter: SCHRITTE.map(function (s) {
        var b = id('mbw-b' + s.id);
        return s.t + ': ' + (b ? b.querySelectorAll('input,select,textarea').length : '?') + ' Felder';
      }) };
    }
  };
})();
