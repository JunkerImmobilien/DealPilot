/* ═══════════════════════════════════════════════════════════════════════
   layout-varianten.js · v1635
   ───────────────────────────────────────────────────────────────────────
   Marcel am 26.09.2026: „Kannst du mir diese Designs komplett umsetzen in
   Staging, dass ich zwischen den einzelnen UIs umschalten kann? Es müssen
   natürlich alle Funktionen da sein."

   ── DER ENTSCHEIDENDE SATZ: ES WIRD NICHTS NACHGEBAUT ─────────────────
   Diese Datei erzeugt KEINE zweite Oberfläche. Sie verschiebt die
   VORHANDENEN Knoten und lässt den Rest die CSS-Schicht machen.

   Warum das die einzige ehrliche Bauweise ist: ein nachgebautes Menü
   hätte am ersten Tag dieselben Einträge und am dreissigsten nicht mehr.
   Jeder neue Knopf müsste an zwei Stellen gepflegt werden, und die
   zweite vergisst man. Ein verschobener Knoten behält seinen
   Ereignishorcher, seinen Zustand und seine Beschriftung - für immer.

   > `appendChild` VERSCHIEBT, es kopiert nicht. Ereignishorcher,
   > Datensätze und laufende Zustände bleiben am Knoten hängen.

   ── WAS GEMESSEN WURDE, BEVOR ICH ANGEFANGEN HABE ─────────────────────
   Am laufenden Stand (v1634b, 1707x917):

     .app-wrap
       aside#sidebar            380 px   Logo · Neu · Suche · Objektkarten
         #sb-actions-accordion           12 Aktionen (zugeklappt)
         #sb-actions-trigger-btn         der Aufklapper
         #sb-user                 82 px  Name · Mail · Plan · Abmelden
       .main-col
         header.hdr              189 px
           .hdr-v61-row1          48 px  Objektnummer · Name · Fortschritt
             #hdr-score-mini             <- GIBT ES SCHON, ist nur leer
           .hdr-v61-row2         141 px
             .scores > .sc-main          <- der GROSSE Score
                     > .sc-pill x5       <- Rendite · Finanz · Risiko · Lage · Upside
         nav.tabs                 44 px  neun .tab-Knöpfe
         .body                           der Inhalt

   **Alles, was gebraucht wird, ist schon da** - auch Nutzer, Plan,
   Abmelden, Support und Rundgang. Es steht nur an der falschen Stelle.

   ── WIE DIE SCHIENE GESETZT WIRD, UND WARUM NICHT MIT GRID ────────────
   `.main-col` hat über sechzig Kinder, die meisten `<script>`. Ein
   `display:grid` darauf würde jedes sichtbare davon zu einem Gitterkind
   machen und an unvorhersehbarer Stelle einsortieren.

   Deshalb steht die Schiene bei den Seitenlayouts `position:fixed` -
   damit ist sie aus dem Fluss und kann mit niemandem kollidieren; der
   Platz entsteht über ein Polster am `.app-wrap`. Bei den waagerechten
   Layouts bleibt sie im Fluss und wird nur über `order` einsortiert.

   ── UMKEHRBARKEIT ─────────────────────────────────────────────────────
   Zu jedem verschobenen Knoten wird Elternteil UND nächstes Geschwister
   gemerkt. `zurueck()` stellt beides wieder her - `insertBefore(knoten,
   merker.naechstes)` trifft auch dann, wenn dazwischen etwas dazukam.
   Ohne den Merker landet ein Knoten am Ende und die Reihenfolge kippt
   still.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotLayout) return;

  var LS = 'dp_layout';

  /* ── DIE LAYOUTS ──────────────────────────────────────────────────
     v1653 · Marcel am 28.09.2026: „Ich bin auch der Meinung, dass wir
     uns jetzt komplett einmal auf die Aktenmappe und die Kanzlei
     konzentrieren. Werkbank, Dossier und das andere nehmen wir raus."

     **Werkbank, Dossier und Cockpit hell sind gestrichen.** Sie
     standen ohnehin auf 9 von 12 erreichbaren Aktionen (Journal vom
     26.09.), und drei halbfertige Layouts zu pflegen kostet mehr, als
     zwei fertige wert sind.

     > Ein gespeichertes `dp_layout=v3` landet sauber: `setze()` prüft
     > `LAYOUTS[v]` und fällt bei Unbekanntem auf „Heute" zurück.

     ── WARUM JETZT EIN ARRAY VON SCHIENEN ───────────────────────────
     Die Kanzlei braucht ZWEI. Der Entwurf
     (`entwurf-hell-bankfaehig.html`, „Entwurf 2 — Kanzlei") zeigt eine
     **dunkle Navigationsspalte links** mit Marke, Portfolio, Reitern
     und dem Nutzer im Fuss — und daneben rechts eine **helle
     Kontextschiene** mit den Ausgabe-Aktionen: „was man mit diesem
     Objekt tun kann, steht neben dem Objekt."

     Gebaut war es **genau andersherum**: Objektliste hell links,
     Aktionen dunkel rechts. Marcel: „auch da noch mal abgleichen mit
     unserer Demo. Das sieht auch nicht so aus, wie wir es besprochen
     haben."

     `ton` sagt jetzt die Farbe, nicht mehr die Stellung. Vorher hing
     die Färbung an `data-stellung="links|rechts"` - damit wäre die
     helle Kontextschiene der Kanzlei zwangsläufig dunkel geworden. */
  var LAYOUTS = {
    v1: {
      name: 'Aktenmappe', beschreibung: 'Menü links als Gliederung',
      objekteAls: 'liste',
      schienen: [
        { stellung: 'links', ton: 'dunkel', marke: true, portfolio: true,
          nimmt: ['suche', 'objekte', 'aktionen', 'tabs', 'nutzer'] }
      ]
    },
    v2: {
      name: 'Kanzlei', beschreibung: 'Navigation links, Aktionen rechts',
      objekteAls: 'liste',
      schienen: [
        { stellung: 'links',  ton: 'dunkel', marke: true, portfolio: true,
          nimmt: ['suche', 'objekte', 'tabs', 'nutzer'] },
        { stellung: 'rechts', ton: 'hell',   marke: false, portfolio: false,
          nimmt: ['aktionen'], titel: 'Aktionen' }
      ]
    }
  };

  var KNOTEN = {
    tabs:     'nav.tabs',
    aktionen: '#sb-actions-accordion',
    schalter: '#sb-actions-trigger-btn',
    nutzer:   '#sb-user',
    /* v1654: die Objektliste selbst. Marcel am 28.09.2026: „wenn ich
       auf Portfolio klicke, dann oeffnet sich komischerweise eine neue
       Ansicht mit Objekten und ich kann die nicht minimieren. Da waere
       es vielleicht besser, wenn wir dort eine Liste anzeigen, die
       aber auch einfach genau in diesem linken Menue dargestellt
       wird."

       Verschoben wird der VORHANDENE Knoten `#sb-list` - nicht eine
       Kopie. `storage.js` rendert weiterhin hinein, jede Karte behaelt
       ihren Klickhorcher und ihren Zustand. Eine nachgebaute Liste
       haette am ersten Tag dieselben Objekte und am dreissigsten
       nicht mehr. */
    objekte:  '#sb-list',
    /* Gemessen, bevor `#sidebar` aus den Layouts verschwindet - was
       darin steckt und sonst verloren ginge:

         .sb-header                     leer (49 px)
         .sb-neu-row                    Quick-Check · Marktbericht
         .sb-section-title-with-sort    „Portfolio" + SUCHE + SORTIERUNG
         #sb-list                       die Karten + „Neues Objekt"

       `Quick-Check` gibt es im Aktionsmenue NICHT (dort steht „Quick
       Boarding"), und Suche und Sortierung gibt es nirgends sonst.
       Beide wandern deshalb mit. Der leere `.sb-header` bleibt, wo er
       ist. */
    schnellstart: '.sb-neu-row',
    suche:        '.sb-section-title-with-sort'
  };

  var merker = [];       /* [{ knoten, eltern, naechstes }] */
  var schienen = [];     /* v1653: die Kanzlei hat zwei */
  var aktuell = '';
  var skinVorher = null;   /* v1660: der Skin VOR dem ersten Layout */

  function el(s) { return document.querySelector(s); }

  /* ── Verschieben mit Rückfahrkarte ──────────────────────────────── */
  function hole(sel) {
    var k = el(sel);
    if (!k) return null;
    merker.push({ knoten: k, eltern: k.parentElement, naechstes: k.nextElementSibling });
    return k;
  }
  function zurueck() {
    /* Rückwärts, damit die zuletzt herausgenommenen zuerst zurückgehen -
       sonst zeigt `naechstes` auf einen Knoten, der noch nicht da ist. */
    for (var i = merker.length - 1; i >= 0; i--) {
      var m = merker[i];
      try {
        if (m.naechstes && m.naechstes.parentElement === m.eltern) m.eltern.insertBefore(m.knoten, m.naechstes);
        else m.eltern.appendChild(m.knoten);
      } catch (e) {}
    }
    merker = [];
    /* Die Marke, die das Badge im Kopf trug, muss mit zurück - sonst
       trägt es in „Heute" eine Klasse, deren Regeln ins Leere zeigen. */
    var badge = el('#tabs-status-badge');
    if (badge) badge.classList.remove('dpl-badge-im-kopf');
    schienen.forEach(function (s) {
      if (s && s.parentElement) s.parentElement.removeChild(s);
    });
    schienen = [];
  }

  /* ── Die Schienen bauen ─────────────────────────────────────────── */
  function baueSchienen(v) {
    var L = LAYOUTS[v];
    var mc = el('.main-col');
    if (!mc || !L.schienen) return;
    L.schienen.forEach(function (S) { baueEine(L, S, mc); });
    badgeInDenKopf();
    zahlNachziehen();
  }

  /* ── „0 / 6 · 0 %" gehört in den Kopf ─────────────────────────────
     Marcel am 28.09.2026: „unter Deal-Aktion im Menübereich, dort haben
     wir diese null von sechs Bereichen vollständig. Das könnte an der
     Stelle vielleicht raus und gegebenenfalls oben mit in den Header
     neben Neues Objekt."

     `#tabs-status-badge` (149x29) steckt IN `nav.tabs` und wandert
     deshalb mit den Reitern in die Schiene - wo es unter dem letzten
     Reiter hängt, als wäre es ein zehnter. Es gehört zum OBJEKT, nicht
     zur Navigation.

     Verschoben wird über dieselbe Rückfahrkarte wie alles andere
     (`hole()`), damit „Heute" es wieder an seinen Platz in der
     Reiterleiste stellt. */
  /* ── v1657 · Die Plan-Pille in die Knopfzeile ─────────────────────
     Marcel: „vielleicht kriegen wir auch den aktuellen Plan und das
     Abmelden mit neben das Pro."

     Verschoben wird die ECHTE Pille (`.sb-user-plan-pill`), nicht eine
     nachgebaute. Ein `content:'PRO'` im Pseudoelement waere bei jedem
     anderen Plan eine Luege gewesen - und es gibt mehr als einen.

     Die Rueckfahrkarte laeuft ueber `hole()` wie bei allem anderen. */
  /* ── v1660 · ZURUECKGENOMMEN, UND EIN AUFRAEUMER ──────────────────
     Das Verschieben der Plan-Pille ist **raus**. Marcel: „unten links
     steht zudem 10 mal Pro. da ist richtig was kaputt gegangen."

     Der Mechanismus: die Abo-Schicht rendert `#sb-user` neu und baut
     dabei eine NEUE Pille in `.sb-user-text`. Meine verschobene lag
     weiter in der Knopfzeile - und der Beobachter, der das Verschieben
     nachzog, legte bei jedem Lauf einen weiteren Merker-Eintrag an.
     Beim Zurueckschalten stellte `zurueck()` sie alle wieder her.

     > **Wer einen Knoten verschiebt, den ein anderes Modul neu baut,
     > bekommt bei jedem Neubau eine Kopie dazu.** Das gilt fuer jeden
     > Knoten, der nicht mir gehoert - und der Nutzerblock gehoert der
     > Abo-Schicht.

     Marcels Wunsch (Plan neben Abmelden) ist damit offen. Er waere
     ueber CSS zu loesen, ohne den Knoten anzufassen - das gehoert
     gemessen und nicht schnell nachgeschoben. Steht im Backlog.

     Diese Funktion raeumt jetzt nur noch auf, was die alte Fassung
     hinterlassen hat: ueberzaehlige Pillen in bereits geladenen
     Browsern. */
  function planPillenAufraeumen() {
    var alle = document.querySelectorAll('#sb-user .sb-user-plan-pill');
    for (var i = 1; i < alle.length; i++) {
      if (alle[i].parentElement) alle[i].parentElement.removeChild(alle[i]);
    }
  }

  /* Der Nutzerblock wird von der Abo-Schicht nachgereicht - beim Aufbau
     der Schiene steht die Plan-Pille oft noch nicht da. Gemessen: nach
     `baueSchienen()` war sie in `.sb-user-text`, also ungerührt.

     > Ein einmaliger Aufruf trifft nur, was schon existiert. Was
     > nachgeliefert wird, braucht einen, der zusieht. */
  var nutzerWache = null;
  function nutzerBeobachten() {
    if (nutzerWache || !window.MutationObserver) return;
    var u = el('#sb-user');
    if (!u) return;
    nutzerWache = new MutationObserver(function () {
      planPillenAufraeumen();
    });
    nutzerWache.observe(u, { childList: true, subtree: true });
  }

  function badgeInDenKopf() {
    var badge = hole('#tabs-status-badge');
    if (!badge) return;
    var reihe = el('header.hdr .hdr-v61-row1');
    if (!reihe) { merker.pop(); return; }   /* nichts verschoben, nichts zu merken */
    badge.classList.add('dpl-badge-im-kopf');
    reihe.appendChild(badge);
  }

  /* ── v1657 · DIE SEITEN TAUSCHEN ──────────────────────────────────
     Marcel am 28.09.2026: „in dem Kanzlei-Look waere es cool, wenn wir
     auch die Moeglichkeit haetten, die Aktionen und auch das, was links
     ist beim Objekt, zu tauschen. Also das, was rechts ist, kommt nach
     links und andersrum."

     Getauscht wird nur die STELLUNG, nicht der Ton: die dunkle
     Navigation bleibt dunkel, auch wenn sie rechts steht, und die
     helle Kontextschiene bleibt hell. Sonst waere es kein Tausch,
     sondern ein zweites Layout.

     Der Merker gilt fuer beide Layouts - bei der Aktenmappe mit ihrer
     einzigen Schiene bedeutet er schlicht „Menue rechts". */
  var LS_SEITEN = 'dp_layout_seiten';
  function seitenGetauscht() {
    try { return localStorage.getItem(LS_SEITEN) === '1'; } catch (e) { return false; }
  }
  function seitenTauschen(an) {
    try { localStorage.setItem(LS_SEITEN, an ? '1' : '0'); } catch (e) {}
    if (aktuell) setze(aktuell);          /* neu aufbauen */
  }
  function kehre(stellung) {
    if (!seitenGetauscht()) return stellung;
    return stellung === 'links' ? 'rechts' : (stellung === 'rechts' ? 'links' : stellung);
  }

  function baueEine(L, S, mc) {
    var schiene = document.createElement('div');
    schiene.className = 'dpl-schiene';
    schiene.setAttribute('data-stellung', kehre(S.stellung));
    /* v1653: die FARBE haengt am Ton, nicht mehr an der Stellung.
       Die Kanzlei hat rechts eine HELLE Kontextschiene - mit der alten
       Regel `[data-stellung="rechts"]{background:#0E0D0B}` waere sie
       zwangslaeufig dunkel geworden. */
    schiene.setAttribute('data-ton', S.ton || 'dunkel');
    schiene.setAttribute('data-objekte', L.objekteAls);

    /* ── WESSEN MARKE HIER STEHT ──────────────────────────────────
       Bei einem Whitelabel-Mandanten SEINE, sonst unsere. Gefragt
       wird dieselbe Stelle, aus der auch die PDFs ihr Logo holen
       (`DealPilotConfig.branding.get().logo_b64`) - nicht ein
       zweiter Weg, der irgendwann auseinanderlaeuft. */
    if (S.marke) {
      var marke = document.createElement('div');
      marke.className = 'dpl-marke';
      var eigenes = '';
      try {
        var b = (window.DealPilotConfig && window.DealPilotConfig.branding
          && typeof window.DealPilotConfig.branding.get === 'function')
          ? (window.DealPilotConfig.branding.get() || {}) : {};
        if (b.logo_b64) eigenes = String(b.logo_b64);
      } catch (e) {}
      marke.innerHTML = eigenes
        ? '<img class="dpl-logo" alt="">'
        : '<span class="dpl-wm">Deal<i>Pilot</i></span>';
      if (eigenes) marke.querySelector('img').src = eigenes;
      schiene.appendChild(marke);
    }

    /* Eine Ueberschrift fuer die Kontextschiene - der Entwurf fuehrt
       dort „Ausgabe", und eine Spalte ohne Namen ist eine Spalte, die
       man erklaeren muss. */
    if (S.titel) {
      var t = document.createElement('div');
      t.className = 'dpl-schiene-titel';
      t.textContent = S.titel;
      schiene.appendChild(t);
    }

    /* Der Portfolio-Knopf bedient den VORHANDENEN Umschalter, statt
       einen zweiten Weg aufzumachen - zwei Wege zu demselben Zustand
       laufen auseinander. */
    if (S.portfolio) {
      var pb = document.createElement('button');
      pb.type = 'button';
      pb.className = 'dpl-portfolio';
      pb.innerHTML = '<span class="dpl-i">▣</span><span class="dpl-t">Portfolio</span>'
        + '<span class="dpl-n" id="dpl-obj-zahl"></span>';
      pb.addEventListener('click', function () { portfolio(); });
      schiene.appendChild(pb);
    }

    S.nimmt.forEach(function (art) {
      var k = hole(KNOTEN[art]);
      if (k) {
        var h = document.createElement('div');
        h.className = 'dpl-teil dpl-teil-' + art;
        h.appendChild(k);
        /* Der Aufklapper gehoert zum Aktionsblock und wandert mit. */
        if (art === 'aktionen') {
          var s = hole(KNOTEN.schalter);
          if (s) h.insertBefore(s, k);
        }
        schiene.appendChild(h);
      }
    });

    /* ── v1656 · DER ORT IST DOCH NICHT GLEICHGUELTIG ───────────────
       Hier stand: „Beide Stellungen stehen `position:fixed`; der Ort im
       Dokument ist deshalb gleichgueltig." **Das war falsch, und es hat
       die Objektliste unbedienbar gemacht.**

       Marcel am 28.09.2026: „wenn wir auf Portfolio klicken, dann kann
       ich kein Objekt auswaehlen. Es wird zwar was angezeigt, aber so
       richtig auswaehlen kann man das nicht."

       Gemessen: `document.elementFromPoint()` auf die Mitte einer Karte
       gibt **`HTML`** zurueck - an dieser Stelle ist fuer den Browser
       nichts Klickbares. Kein Ueberdecker, kein `pointer-events:none`,
       alle Vorfahren `auto`. Der Grund steht eine Ebene hoeher:

         .main-col   overflow: hidden auto
                     Box 208,0 1925x1050
         Karte       Box  10,270 bis 186,329   -> KOMPLETT AUSSERHALB

       Die Schiene hing im DOM in `.main-col` und ragte links aus ihm
       heraus. Sichtbar blieb sie, treffbar nicht.

       > **Ich habe mich auf `position:fixed` verlassen und den
       > klippenden Vorfahren nicht geprueft.** Und schlimmer: als die
       > Messung „VERDECKT von HTML" meldete, habe ich sie fuer ein
       > Artefakt gehalten und mit einem `dispatchEvent` gegengeprueft -
       > das die Trefferpruefung gerade UMGEHT. Ein simulierter Klick
       > beweist nichts ueber Klickbarkeit.

       Die Schiene haengt jetzt am `<body>`. Dort klippt sie niemand. */
    document.body.appendChild(schiene);
    schienen.push(schiene);
  }
  function zahlNachziehen() {
    var n = document.querySelectorAll('#sb-list .sb-card').length;
    var z = el('#dpl-obj-zahl');
    if (z) z.textContent = n ? String(n) : '';
  }

  /* ── Die Objektliste IM Menü ────────────────────────────────────────
     v1654 · Bis v1653 war dies eine Schublade: 380 px breit, über die
     Arbeitsfläche gelegt. Marcel am 28.09.2026: „dann öffnet sich
     komischerweise eine neue Ansicht mit Objekten und ich kann die
     nicht minimieren."

     > **„Nicht minimieren können" ist der eigentliche Befund.** Die
     > Schublade hatte keinen Schliessen-Knopf - nur Escape und ein
     > Klick auf eine Karte. Wer das nicht weiss, sitzt fest.

     Jetzt klappt derselbe Knopf eine Liste IN der Schiene auf und zu,
     wie ein Menüpunkt mit Unterpunkten. Dasselbe Attribut steuert es,
     nur die CSS dahinter ist eine andere - und der Knopf zeigt seinen
     Zustand an, statt ihn zu verstecken. */
  function portfolio(zu) {
    var auf = zu === undefined
      ? document.documentElement.getAttribute('data-dpl-portfolio') !== 'auf'
      : !zu;
    document.documentElement.setAttribute('data-dpl-portfolio', auf ? 'auf' : 'zu');
    var k = el('.dpl-portfolio');
    if (k) k.setAttribute('aria-expanded', auf ? 'true' : 'false');
  }

  /* Ein Klick auf eine Objektkarte klappt die Liste zu - man hat ja
     gefunden, was man gesucht hat. */
  document.addEventListener('click', function (e) {
    if (!aktuell) return;
    if (document.documentElement.getAttribute('data-dpl-portfolio') !== 'auf') return;
    var k = e.target.closest ? e.target.closest('.sb-card') : null;
    if (k) setTimeout(function () { portfolio(true); }, 60);
  }, true);

  /* Escape klappt sie zu. NICHT die Reiter oder etwas anderes - eine
     Taste, die mehr tut als eine Sache, überrascht. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.documentElement.getAttribute('data-dpl-portfolio') === 'auf') {
      portfolio(true);
    }
  });

  /* ── Setzen ─────────────────────────────────────────────────────── */
  function setze(v) {
    v = String(v || '');
    if (v && !LAYOUTS[v]) v = '';
    zurueck();
    aktuell = v;
    var h = document.documentElement;
    if (!v) {
      kopfOffenHalten(false);
      h.removeAttribute('data-dp-layout');
      h.removeAttribute('data-dpl-seiten');
      /* v1660: Den Hellmodus zuruecknehmen, den setze() eingeschaltet
         hat. Marcel: 'wenn ich auf heute zurueckschalte, sieht es nicht
         so aus wie heute, es ist hell.' Wer auf Heute stellt, will den
         Auslieferungszustand - und der ist Obsidian. */
      /* v1660b: HART auf Obsidian, nicht auf den gemerkten Vorzustand.
         Gemessen: der Merker las bereits 'hell', weil ein frueheres
         Layout den Skin eingeschaltet und im localStorage hinterlassen
         hatte - der 'Zustand vorher' war also schon verfaelscht.

         > Marcel: 'es soll aber obsidian sein wie vorher'. Der
         > Auslieferungszustand IST Obsidian; ein Merker, der von einer
         > frueheren Sitzung stammt, darf das nicht ueberschreiben. Wer
         > den Hellmodus WILL, waehlt ihn in den Einstellungen - dort
         > gehoert er hin, nicht als Nebenwirkung eines Layouts. */
      try { if (typeof window._dpDispSkin === 'function') window._dpDispSkin('obsidian'); } catch (e) {}
      skinVorher = null;
      if (document.body) document.body.classList.remove('dp-neue-karte', 'dp-neue-karte-stil');
      h.removeAttribute('data-dpl-portfolio');
      try { localStorage.removeItem(LS); } catch (e) {}
      schalterNachziehen();
      return;
    }
    h.setAttribute('data-dp-layout', v);
    h.setAttribute('data-dpl-portfolio', 'zu');
    /* v1657: die CSS braucht die Seitenwahl, das Polster am .app-wrap
       haengt daran. */
    if (seitenGetauscht()) h.setAttribute('data-dpl-seiten', 'getauscht');
    else h.removeAttribute('data-dpl-seiten');
    /* Der helle Grund kommt vom VORHANDENEN Skin, nicht von hier.
       `body.dp-chrome-hell` ist 103 geprüfte Regeln; eine zweite
       Hellfassung danebenzustellen hiesse, jede künftige Änderung an
       zwei Stellen zu pflegen - und die zweite vergisst man. Diese
       Datei ordnet den Raum, sie färbt ihn nicht. */
    try {
      if (typeof window._dpDispSkin === 'function') {
        if (skinVorher === null) {
          skinVorher = document.body.classList.contains('dp-chrome-hell') ? 'hell' : 'obsidian';
        }
        window._dpDispSkin('hell');
      }
    } catch (e) {}
    kopfOffenHalten(true);
    baueSchienen(v);
    try { localStorage.setItem(LS, v); } catch (e) {}
    schalterNachziehen();
    planPillenAufraeumen();
  }

  /* ── Der Umschalter ─────────────────────────────────────────────── */
  var leiste = null;
  function baueSchalter() {
    if (leiste) return;
    leiste = document.createElement('div');
    leiste.className = 'dpl-schalter';
    leiste.innerHTML = '<span class="dpl-schalter-k">Layout</span>';
    var mach = function (wert, text) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = text; b.dataset.wert = wert;
      b.addEventListener('click', function () { setze(wert); });
      leiste.appendChild(b);
    };
    mach('', 'Heute');
    Object.keys(LAYOUTS).forEach(function (k, i) { mach(k, (i + 1) + ' · ' + LAYOUTS[k].name); });
    var zu = document.createElement('button');
    zu.type = 'button'; zu.className = 'dpl-schalter-zu'; zu.textContent = '×';
    zu.title = 'Umschalter ausblenden (kommt mit ?layout= zurück)';
    zu.addEventListener('click', function () {
      leiste.remove(); leiste = null;
      try { localStorage.removeItem('dp_layout_schalter'); } catch (e) {}
    });
    leiste.appendChild(zu);
    document.body.appendChild(leiste);
  }
  function schalterNachziehen() {
    if (!leiste) return;
    [].forEach.call(leiste.querySelectorAll('button[data-wert]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.wert === aktuell));
    });
  }

  /* ── DIE MARKE FÜR DIE NEUE DATENAUFNAHME-ZEILE ──────────────────────
     Marcel am 26.09.2026: „ja binde die Zeile."

     Hintergrund: die umgebaute Karte (v1639) galt zunächst ÜBERALL —
     auch im Obsidian-Auslieferungszustand. Marcel hatte angenommen, der
     Standard sei unverändert; gemessen war er es nicht.

     > **Der Auslieferungszustand ist ein Versprechen.** Wer nicht
     >  umschaltet, bekommt die App so, wie er sie kennt. Ein Umbau, der
     >  sich nicht abwählen lässt, ist kein Angebot, sondern eine
     >  Ansage.

     Jetzt hängt die neue Zeile an EINER Marke am `<body>`, und die wird
     gesetzt, wenn eine der drei Bedingungen gilt:

       body.dp-chrome-hell     der helle Modus ist an
       html[data-dp-layout]    eines der fünf Layouts ist gewählt
       html.qc-app             das Quick-Check-Dokument (immer hell)

     Ohne eine davon steht die alte Bordkarte mit Streifen, Perforation
     und Strichcode — Zeichen für Zeichen wie vorher. Die 46 Regeln in
     `datenaufnahme.css` tragen dafür alle den Vorsatz
     `body.dp-neue-karte`.

     EINE Marke statt 46 Verzweigungen: wer eine Bedingung ändert, ändert
     sie hier und nirgends sonst. */
  /* ── DER KOPF KLAPPT IN DEN LAYOUTS NICHT EIN ─────────────────────
     Marcel: "die Ausgabe fehlt … Rendite, Finanzierung, Risiko sehe
     ich gar nicht."

     GEMESSEN: die Zeile steht im DOM mit allen Werten, hat aber Hoehe
     0 - "body.hdr-collapsed .hdr-v61-row2" blendet sie per
     display:none aus, und die Klasse bleibt gesetzt, auch wenn die
     Seite ganz oben steht.

     Eine CSS-Gegenregel hat NICHT gereicht: sie matchte mit hoeherer
     Spezifitaet und !important und verlor trotzdem. Statt ein
     Wettrennen zu fuehren, wird die Klasse hier entfernt - und wenn
     der Scroll-Mechanismus sie zurueckschreibt, sofort wieder.

     > Wo zwei Regeln um dieselbe Eigenschaft streiten, gewinnt die,
     > die den ZUSTAND setzt - nicht die, die ihn ueberschreibt.

     In den Layouts ist der Kopf mit 86 px ohnehin schmal; das
     Einklappen spart 37 px und kostet die wichtigste Zeile. */
  var kopfWache = null;
  function kopfOffenHalten(an) {
    var b = document.body;
    if (!b) return;
    if (kopfWache) { kopfWache.disconnect(); kopfWache = null; }
    if (!an) return;
    var frei = function () {
      if (b.classList.contains('hdr-collapsed')) b.classList.remove('hdr-collapsed');
      if (b.classList.contains('dp-hdr-compact')) b.classList.remove('dp-hdr-compact');
    };
    frei();
    if (window.MutationObserver) {
      kopfWache = new MutationObserver(frei);
      kopfWache.observe(b, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function karteMarke() {
    try {
      var h = document.documentElement, b = document.body;
      if (!b) return;
      var an = b.classList.contains('dp-chrome-hell')
        || h.hasAttribute('data-dp-layout')
        || h.classList.contains('qc-app')
        /* v1651: ein GEWAEHLTER Kartenstil setzt die Marke ebenfalls.
           Ohne diese Zeile waehlt jemand im Obsidian-Modus „Trichter",
           bekommt die Umordnung, aber keine der 46 Grundregeln - das
           sieht aus wie ein halb aufgetragener Anstrich. */
        || h.hasAttribute('data-dp-kartenstil');
      b.classList.toggle('dp-neue-karte', an);
    } catch (e) {}
  }

  /* Der Skin-Schalter setzt `dp-chrome-hell` am `<body>` - also dort
     zuhören, nicht auf einen eigenen Ereignisnamen hoffen. */
  function markeBeobachten() {
    karteMarke();
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(karteMarke).observe(document.body,
      { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(karteMarke).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-dp-layout', 'data-dp-kartenstil', 'class'] });
  }

  /* ── Der Platz in den Einstellungen ──────────────────────────────────
     Marcel: „ich hoffe, die haben wir in den Einstellungen irgendwo bei
     Anzeige oder Darstellung angegeben."

     Der Abschnitt wird in das VORHANDENE Darstellungs-Panel eingehängt
     (`#dpuv-panel` aus `ui-varianten.js`), mit dessen eigener
     Markup-Sprache: `.dpuv-g` für die Gruppe, `.dpuv-seg`/`.dpuv-sgb`
     für die Kacheln. Damit erbt er Aussehen, Abstände und jede künftige
     Änderung an diesem Panel automatisch.

     > `ui-varianten.js` hat 1.296 Zeilen und eine eigene Speicher- und
     > Anwendungsmechanik. Dort hineinzuschreiben hiesse, sie zu
     > verstehen UND zu riskieren. Ein Abschnitt, der sich von aussen
     > einhängt, kann sie nicht kaputtmachen.

     Eingehängt wird beim Öffnen - das Panel wird erst dann gebaut. */
  var beobachter = null;
  function inPanel() {
    var panel = document.getElementById('dpuv-b');
    if (!panel || document.getElementById('dpl-sek')) return;

    var g = document.createElement('div');
    g.className = 'dpuv-g';
    g.id = 'dpl-sek';
    var kacheln = [{ key: '', name: 'Heute', sub: 'Unverändert' }].concat(
      Object.keys(LAYOUTS).map(function (k, i) {
        return { key: k, name: (i + 1) + ' · ' + LAYOUTS[k].name, sub: LAYOUTS[k].beschreibung };
      }));
    g.innerHTML = '<h3>Aufbau</h3>'
      + '<p class="dpuv-hint">Wo Menü, Aktionen und Objektliste stehen. '
      + 'Die Arbeitsfläche bleibt in allen gleich — es wechselt nur der Rahmen. '
      + 'Ein Aufbau schaltet die Oberfläche auf <b>hell</b>.</p>'
      + '<div class="dpuv-seg" id="dpl-seg">'
      + kacheln.map(function (o) {
          return '<button type="button" class="dpuv-sgb' + (o.key === aktuell ? ' on' : '')
            + '" data-v="' + o.key + '"><b>' + o.name + '</b><small>'
            + (o.sub || '') + '</small></button>';
        }).join('')
      + '</div>';

    /* Vor die Modus-Gruppe: der Aufbau ist die gröbere Entscheidung,
       und grobe Entscheidungen gehören nach oben. */
    panel.insertBefore(g, panel.firstChild);

    g.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dpuv-sgb') : null;
      if (!b) return;
      setze(b.dataset.v);
      [].forEach.call(g.querySelectorAll('.dpuv-sgb'), function (x) {
        x.classList.toggle('on', x.dataset.v === aktuell);
      });
      seitenKachelnNachziehen();
    });

    /* ── v1657 · Seiten tauschen ────────────────────────────────────
       Marcel: „waere cool, wenn wir auch die Moeglichkeit haetten, die
       Aktionen und das, was links ist, zu tauschen."

       Eigene Gruppe statt eines sechsten Aufbau-Knopfes: es ist keine
       andere Anordnung, sondern dieselbe gespiegelt. Wer sie als
       siebtes Layout fuehrt, muss jede kuenftige Aenderung zweimal
       machen. */
    var gs = document.createElement('div');
    gs.className = 'dpuv-g';
    gs.id = 'dpl-seiten-sek';
    gs.innerHTML = '<h3>Seiten</h3>'
      + '<p class="dpuv-hint">Auf welcher Seite das Menü steht. In der Kanzlei '
      + 'tauschen Navigation und Aktionen dabei die Plätze.</p>'
      + '<div class="dpuv-seg" id="dpl-seiten-seg">'
      + '<button type="button" class="dpuv-sgb" data-s="0"><b>Menü links</b><small>Standard</small></button>'
      + '<button type="button" class="dpuv-sgb" data-s="1"><b>Menü rechts</b><small>Gespiegelt</small></button>'
      + '</div>';
    if (g.nextSibling) panel.insertBefore(gs, g.nextSibling); else panel.appendChild(gs);

    gs.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dpuv-sgb') : null;
      if (!b) return;
      seitenTauschen(b.dataset.s === '1');
      seitenKachelnNachziehen();
    });
    seitenKachelnNachziehen();
  }

  function seitenKachelnNachziehen() {
    var seg = document.getElementById('dpl-seiten-seg');
    if (!seg) return;
    var an = seitenGetauscht();
    [].forEach.call(seg.querySelectorAll('.dpuv-sgb'), function (x) {
      x.classList.toggle('on', (x.dataset.s === '1') === an);
    });
    /* Ohne Layout ist die Frage gegenstandslos - dann bleibt die
       Gruppe sichtbar, aber sichtbar wirkungslos. Das ist ehrlicher
       als sie zu verstecken: wer sie sucht, findet sie. */
    seg.parentElement.style.opacity = aktuell ? '' : '.45';
  }

  function panelBeobachten() {
    if (beobachter || !window.MutationObserver) return;
    beobachter = new MutationObserver(function () { inPanel(); });
    beobachter.observe(document.body, { childList: true });
    inPanel();
  }

  /* ── Start ──────────────────────────────────────────────────────── */
  function start() {
    var p = new URLSearchParams(location.search);
    var ausUrl = p.get('layout');
    var gemerkt = '';
    try { gemerkt = localStorage.getItem(LS) || ''; } catch (e) {}

    if (ausUrl !== null) {
      /* ?layout=3 und ?layout=v3 sind beide erlaubt - wer die Zahl aus
         dem Umschalter abliest, tippt keine v davor. */
      var v = /^[1-5]$/.test(ausUrl) ? 'v' + ausUrl : ausUrl;
      setze(v === 'aus' ? '' : v);
      try { localStorage.setItem('dp_layout_schalter', '1'); } catch (e) {}
    } else if (gemerkt) {
      setze(gemerkt);
    }

    var zeigen = false;
    try { zeigen = localStorage.getItem('dp_layout_schalter') === '1'; } catch (e) {}
    if (zeigen) { baueSchalter(); schalterNachziehen(); }
    panelBeobachten();
    markeBeobachten();

    /* Die Objektzahl ändert sich, wenn Karten nachgeladen werden. */
    var l = el('#sb-list');
    if (l && window.MutationObserver) {
      new MutationObserver(zahlNachziehen).observe(l, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotLayout = {
    setze: setze,
    layouts: LAYOUTS,
    aktuell: function () { return aktuell; },
    /* v1651: `karten-stil.js` braucht die Marke nach jedem Stilwechsel
       neu ausgerechnet. Nach aussen gegeben statt dort nachgebaut - ein
       zweiter Weg zu derselben Marke laeuft auseinander. */
    karteMarke: karteMarke,
    schalter: function () { baueSchalter(); schalterNachziehen();
      try { localStorage.setItem('dp_layout_schalter', '1'); } catch (e) {} }
  };
})();
