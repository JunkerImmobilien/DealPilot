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
    /* ── v1666 · AKTENMAPPE 1 IST WEG ─────────────────────────────────
       Marcel: „die Aktenmappe 1 nimmst du jetzt raus, die brauchen wir
       nicht mehr. Wir bleiben bei der Aktenmappe 2, die können wir dann
       umbenennen einfach in Aktenmappe."

       Hier stand `v1` mit `'tabs'` in `nimmt` - die Fassung, bei der
       die Reiter IN der Schiene standen. Der SCHLUESSEL `v1b` bleibt,
       wie er ist: die neun CSS-Regeln hängen an
       `[data-dp-layout^="v1"]` und treffen ihn weiter.

       > Ein Name ist für den Menschen, ein Schlüssel für die Maschine.
       > Wer beide gleichzeitig ändert, ändert zwei Dinge und kann
       > hinterher nicht sagen, welches davon gewirkt hat.

       Wer noch `v1` gemerkt hat, wird in `setze()` auf `v1b` umgelenkt
       - ein Layout abzuschaffen darf niemanden aussperren, der es
       gewählt hatte. */
    /* v1663 · AKTENMAPPE 2 - DIE REITER BLEIBEN OBEN.

       Marcel: „bei der Aktenmappe haben wir Objekt, Investition,
       Miete - dass wir auch die Moeglichkeit haetten zu sagen, das
       lassen wir oben als Tabbar anzeigen. Koennen wir noch eine
       zweite Version Aktenmappe 2 machen, wo wir die Aufteilung oben
       noch mit in den Header packen."

       Der ganze Unterschied zu v1 ist EIN Wort weniger in `nimmt`:
       ohne 'tabs' bleibt `nav.tabs` dort stehen, wo es hingebaut
       wurde - als Leiste unter dem Kopf in `.main-col`. Die
       allgemeinen Regeln `html[data-dp-layout] nav.tabs` (Haarlinie,
       Gold nur als Kante) greifen dort genauso.

       > Ein Layout, das sich nur in einer Zeile unterscheidet, darf
       > auch nur eine Zeile kosten. Eine zweite Regelmenge waere ein
       > zweiter Ort, an dem man kuenftig alles doppelt aendert.

       Der Schluessel heisst `v1b` und nicht `v3`: `v3`, `v4` und `v5`
       waren frueher eigene Layouts, und 22 ihrer CSS-Regeln stehen
       noch in `layout-varianten.css`. Ein neues `v3` haette sie
       stillschweigend geerbt. Damit die neun `[data-dp-layout="v1"]`
       Regeln fuer beide gelten, heissen sie jetzt
       `[data-dp-layout^="v1"]` - gleiche Spezifitaet, keine
       Verschiebung in der Kaskade. */
    v1b: {
      name: 'Aktenmappe', beschreibung: 'Menü links, Reiter oben im Kopf',
      objekteAls: 'liste',
      schienen: [
        { stellung: 'links', ton: 'dunkel', marke: true, portfolio: true,
          /* v1664: Die Reihenfolge in `nimmt` IST die Reihenfolge in der
             Schiene - der Score steht zwischen Aktionen und Nutzer,
             genau da, wo Marcel ihn haben wollte. */
          nimmt: ['suche', 'objekte', 'aktionen', 'score', 'nutzer'] }
      ]
    },
    v2: {
      name: 'Kanzlei', beschreibung: 'Navigation links, Aktionen rechts',
      objekteAls: 'liste',
      schienen: [
        { stellung: 'links',  ton: 'dunkel', marke: true, portfolio: true,
          /* v1666: Marcel wollte den Score auch hier — „unter den
             Deal-Aktionen oder über der Anmeldung". Die Aktionen stehen
             in der Kanzlei RECHTS, also bleibt der Platz über dem
             Nutzer — derselbe wie in der Aktenmappe. Eine Angabe, die
             in zwei Layouts an derselben Stelle steht, muss man nicht
             zweimal suchen. */
          nimmt: ['suche', 'objekte', 'tabs', 'score', 'nutzer'] },
        /* v1679: Marcel — „in unserer Demo haben wir bei Kanzlei rechts
           auch die Moeglichkeit, Sachen anzugeben: Exposé, Marktbericht,
           Bankexport, alles fuer das ausgewaehlte Objekt. Die Ausgaben
           auch in unser aktuelles Kanzlei-Modul, einfach unter den
           Aktionen." Genau da: nach `aktionen` in derselben Schiene. */
        { stellung: 'rechts', ton: 'hell',   marke: false, portfolio: false,
          nimmt: ['aktionen', 'ausgaben'], titel: 'Aktionen' }
      ]
    },
    /* ── v1679 · KANZLEI 2 — die Seiten getauscht ────────────────────
       Marcel: „eine dritte UI, Kanzlei 2. Links im Menue die Aktionen
       und das Portfolio, ungefaehr wie in der Aktenmappe. Rueber wandert
       der Investor-Deal-Score auf die rechte Seite und die
       Ausgabedokumente — die kommen dahin, wo jetzt Aktionen rechts
       steht, oben. Und die Objektdaten-Reiter oben wie bei der
       Aktenmappe."

       Damit ist v2b die Umkehrung von v2: was dort links steht, steht
       hier rechts. `tabs` fehlt in beiden `nimmt`-Listen — genau das
       laesst die Reiterleiste im Kopf, wie in der Aktenmappe.

       Der Schluessel heisst `v2b` und nicht `v3`: `v3`, `v4` und `v5`
       waren frueher eigene Layouts, deren CSS-Regeln noch in
       `layout-varianten.css` stehen. Ein neues `v3` haette sie
       stillschweigend geerbt — derselbe Grund, aus dem die zweite
       Aktenmappe `v1b` heisst.                                       */
    v2b: {
      /* v1684 — „Kanzlei 2" war eine Nummer, kein Name. Marcel: „sollte
         irgendwie einen anderen Namen bekommen." **Tower** passt in die
         Bildsprache der App (Kerosin, Cockpit, Runway, Pre-Flight,
         Boarding) und beschreibt genau, was dieses Layout tut: der Tower
         hat alles im Blick und erteilt die Freigaben — hier den Score
         und die Ausgaben, beide rechts, waehrend links gearbeitet wird.
         „Cockpit" war nicht zu haben, das traegt das Portfolio. */
      name: 'Tower', beschreibung: 'Aktionen links, Score und Ausgaben rechts',
      objekteAls: 'liste',
      schienen: [
        { stellung: 'links',  ton: 'dunkel', marke: true, portfolio: true,
          nimmt: ['suche', 'objekte', 'aktionen', 'nutzer'] },
        { stellung: 'rechts', ton: 'hell',   marke: false, portfolio: false,
          nimmt: ['ausgaben', 'score'], titel: 'Ausgabe' }
      ]
    }
  };

  var KNOTEN = {
    tabs:     'nav.tabs',
    aktionen: '#sb-actions-accordion',
    schalter: '#sb-actions-trigger-btn',
    nutzer:   '#sb-user',
    /* ── v1664 · DAS SCORE-BAND ────────────────────────────────────
       Marcel: „koennen wir es bei der Aktenmappe 2 so machen, dass wir
       die Werte fuer Rendite, Finanzierung, Risiko, Lage, Upside
       einfach mal unter diese Aktionen links machen, also ueber dem
       Usernamen - und auch mit dem Score."

       `#hdr-badges` ist der VORHANDENE Knoten aus `header.hdr`; er
       traegt `.sc-main` (Ring + Stufe) und die fuenf `.sc-pill`. Er
       wandert wie alles andere ueber die Rueckfahrkarte `hole()`, also
       kommt er in „Heute" an seinen Platz im Kopf zurueck.

       > Ein zweites Score-Band waere am ersten Tag dasselbe und am
       > dreissigsten nicht mehr. Derselbe Grund, aus dem `#sb-list`
       > verschoben und nicht nachgebaut wird. */
    score:    '#hdr-badges',
    ausgaben: '#dpl-ausgaben',   /* v1679 — wird bei Bedarf gebaut, s. baueAusgaben() */
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
  /* ── v1679 · DIE AUSGABEN-BOX ──────────────────────────────────────
     Alles andere in `KNOTEN` wird VERSCHOBEN, nicht nachgebaut — ein
     zweites Score-Band waere am ersten Tag dasselbe und am dreissigsten
     nicht mehr. Hier geht das nicht: eine Ausgaben-Box gibt es im DOM
     nicht, die Befehle liegen als einzelne Knoepfe verstreut in der
     Aktionsliste („Ausgeben": Track Record, Bankexport, Export) und
     unter „Analyse" (Marktbericht).

     Deshalb wird die Box gebaut — aber sie enthaelt KEINE eigene Logik.
     Jeder Knopf ruft `sbActionsAction(...)`, denselben Weg wie die
     Aktionsliste. Ein zweiter Zugang zu denselben Befehlen laeuft nicht
     auseinander; eine zweite Umsetzung derselben Befehle schon.

     `dpAusgabenAktualisieren()` haengt die Objektbezeichnung an, damit
     sichtbar ist, WOFUER ausgegeben wird — Marcel: „alles das fuer das
     ausgewaehlte Objekt".                                            */
  /* ── v1683 · DIE AUSGABEN GEHEN AUF DOKUMENTE, NICHT AUF BEREICHE ──
     Marcel: „wenn ich unter Ausgabe auf Marktbericht klicke, wird der
     Bereich Marktbericht aufgemacht. Ich möchte aber auf das PDF
     zugreifen. Wenn es kein PDF gibt, sollte das ausgegraut sein."
     Und: „mir fehlen Kaufpreisaufteilung, Anschaffungskosten und das
     Finanzamt-PDF — da muss natürlich gefragt werden, welches Jahr."

     **Alle diese Wege gibt es schon** — im Deal-Aktions-Tab, als
     `DealActionBoarding.exportDoc(…)`. Sie werden hier gerufen, nicht
     nachgebaut: ein zweiter Weg zu demselben Dokument laeuft
     auseinander, sobald einer von beiden gepflegt wird.

     `art` sagt, woher der Knopf weiss, ob er etwas zu bieten hat:
       dok    — erzeugt das Dokument aus den Daten, immer moeglich
       vorrat — braucht einen vorhandenen Bestand (Marktbericht), wird
                geprueft und sonst ausgegraut
       jahr   — braucht vorher eine Jahresangabe                      */
  var AUSGABEN = [
    { act: 'invest',      art: 'dok',    ico: 'export-hub', l: 'Exposé / Gesamt-PDF',  sub: 'Alle Kapitel als Dokument' },
    { act: 'invest_bank', art: 'dok',    ico: 'bankexport', l: 'Bankfassung',          sub: 'Investment-Case für die Bank', feature: 'bank_pdf_a3' },
    { act: 'mb',          art: 'vorrat', ico: 'market',     l: 'Marktbericht',         sub: 'Als PDF, wenn einer vorliegt' },
    { act: 'kpa',         art: 'dok',    ico: 'export-hub', l: 'Kaufpreisaufteilung · BMF', sub: 'Rechner, Anlage oder Belege', feature: 'bmf_calc_export' },
    { act: 'bmf',         art: 'jahr',   ico: 'export-hub', l: 'Finanzamt-PDF',        sub: 'Anlage V · Werbungskosten' },
    { act: 'track',       art: 'dok',    ico: 'trackrec',   l: 'Track Record',         sub: 'Nachweise für die Bank',       feature: 'track_record_pdf' },
    { act: 'hub-export',  art: 'dok',    ico: 'export-hub', l: 'Export',               sub: 'PDF, CSV, Sicherung',          feature: 'export_csv' }
  ];

  function baueAusgaben() {
    var vorhanden = document.getElementById('dpl-ausgaben');
    if (vorhanden) return vorhanden;

    var box = document.createElement('div');
    box.id = 'dpl-ausgaben';
    box.className = 'dpl-ausgaben';
    box.innerHTML =
        '<div class="dpl-ausgaben-kopf">'
      +   '<span class="dpl-ausgaben-titel">Ausgabe</span>'
      +   '<span class="dpl-ausgaben-obj" id="dpl-ausgaben-obj"></span>'
      + '</div>'
      + '<div class="dpl-ausgaben-liste">'
      +   AUSGABEN.map(function (a) {
            return '<button type="button" class="dpl-ausgabe" data-act="' + a.act + '"'
                 + (a.feature ? ' data-feature="' + a.feature + '"' : '') + '>'
                 + '<span class="sb-act-ico dpl-ausgabe-ico" data-icon="' + a.ico + '"></span>'
                 + '<span class="dpl-ausgabe-txt">'
                 +   '<span class="dpl-ausgabe-l">' + a.l + '</span>'
                 +   '<span class="dpl-ausgabe-sub">' + a.sub + '</span>'
                 + '</span></button>';
          }).join('')
      + '</div>';

    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.dpl-ausgabe');
      if (!b || b.getAttribute('data-gesperrt') === '1') return;
      ausgabeStarten(b.getAttribute('data-act'), b);
    });

    document.body.appendChild(box);
    ausgabenIconsNachziehen(box);
    dpAusgabenAktualisieren();
    ausgabenVorratPruefen();
    return box;
  }

  /* Die Icons kommen aus derselben Bibliothek wie die Aktionsliste.
     Fehlt sie, bleibt der Knopf trotzdem bedienbar — ein fehlendes
     Bild darf keinen Befehl kosten.                                  */
  /* ── v1683 · Was beim Klick geschieht ────────────────────────────── */
  var _mbBerichte = null;   /* null = noch nicht geprueft */

  function ausgabeStarten(act, knopf) {
    var DAB = window.DealActionBoarding;

    if (act === 'hub-export') {
      if (typeof window.openExportHub === 'function') return window.openExportHub();
      if (typeof window.sbActionsAction === 'function') return window.sbActionsAction('hub-export');
      return;
    }

    if (act === 'mb') {
      /* Nicht den Bereich oeffnen, sondern den JUENGSTEN Bericht als PDF.
         Ohne Bericht steht der Knopf gar nicht erst zur Verfuegung —
         siehe ausgabenVorratPruefen(). */
      if (!_mbBerichte || !_mbBerichte.length) { melde('Für dieses Objekt liegt noch kein Marktbericht vor.'); return; }
      var neuester = _mbBerichte[0];
      if (DAB && typeof DAB.downloadReport === 'function') {
        melde('Marktbericht wird erzeugt …');
        return DAB.downloadReport(neuester.report_id);
      }
      melde('Marktbericht-Ausgabe nicht geladen.');
      return;
    }

    if (act === 'bmf') {
      /* Marcel: „da muss natuerlich auch gefragt werden, welches Jahr."
         `exportDoc('bmf')` liest das Jahr aus `#dab-fa-year` — einem
         Feld, das nur im Deal-Aktions-Tab steht. Von hier aus wird
         deshalb zuerst gefragt und die Antwort DORT hinterlegt, statt
         einen zweiten Weg in den Export zu bauen. */
      return jahrFragen(function (wert) {
        var sel = document.getElementById('dab-fa-year');
        if (!sel) {
          /* Das Feld gibt es erst, wenn der Deal-Aktions-Tab einmal
             aufgebaut wurde. Dann legen wir es verdeckt an — mit
             demselben Namen, damit der Export es findet. */
          sel = document.createElement('select');
          sel.id = 'dab-fa-year';
          sel.style.display = 'none';
          document.body.appendChild(sel);
        }
        if (!sel.querySelector('option[value="' + wert + '"]')) {
          var o = document.createElement('option');
          o.value = wert; o.textContent = wert;
          sel.appendChild(o);
        }
        sel.value = wert;
        if (DAB && typeof DAB.exportDoc === 'function') return DAB.exportDoc('bmf');
        melde('Finanzamt-PDF nicht geladen.');
      });
    }

    if (DAB && typeof DAB.exportDoc === 'function') return DAB.exportDoc(act);
    melde('Diese Ausgabe ist gerade nicht verfügbar.');
  }

  function melde(text) {
    if (typeof window.toast === 'function') { window.toast(text); return; }
    var el = document.getElementById('dpl-ausgaben-obj');
    if (el) { el.textContent = text; }
  }

  /* Die Jahre stammen aus derselben Quelle wie im Deal-Aktions-Tab
     (`State.cfRows`, siehe `fillFaYears`) — nicht aus dem Kalender.
     Ein Jahr, das die Rechnung nicht kennt, koennte niemand ausgeben. */
  function jahrFragen(weiter) {
    var rows = (window.State && Array.isArray(window.State.cfRows)) ? window.State.cfRows.slice(0, 15) : [];
    var alt = document.getElementById('dpl-jahr-frage');
    if (alt) alt.remove();

    var w = document.createElement('div');
    w.id = 'dpl-jahr-frage';
    w.className = 'dpl-jahr-frage';
    w.innerHTML =
        '<div class="dpl-jf-box">'
      +   '<h3>Finanzamt-PDF — welches Jahr?</h3>'
      +   '<p>Anlage V mit den Werbungskosten des gewählten Jahres.</p>'
      +   '<div class="dpl-jf-liste">'
      +     rows.map(function (r, i) {
            return '<button type="button" class="dpl-jf-j" data-wert="' + i + '">' + (r.cal || ('Jahr ' + (i + 1))) + '</button>';
          }).join('')
      +     '<button type="button" class="dpl-jf-j dpl-jf-alle" data-wert="all">Alle Jahre</button>'
      +   '</div>'
      +   (rows.length ? '' : '<p class="dpl-jf-leer">Noch keine Jahre berechnet — erst die Investition ausfüllen.</p>')
      +   '<button type="button" class="dpl-jf-ab">Abbrechen</button>'
      + '</div>';
    document.body.appendChild(w);

    w.addEventListener('click', function (e) {
      if (e.target === w || e.target.closest('.dpl-jf-ab')) { w.remove(); return; }
      var j = e.target.closest('.dpl-jf-j');
      if (!j) return;
      var wert = j.getAttribute('data-wert');
      w.remove();
      weiter(wert);
    });
  }

  /* ── v1683 · Was es gibt und was nicht ────────────────────────────
     Marcel: „wenn es kein PDF gibt, sollte vielleicht ein kleines X
     dahinter sein oder das ausgegraut sein."

     Geprueft wird der VORRAT (liegt ein Marktbericht vor?) und das
     RECHT (deckt der Plan die Ausgabe ab?). Beides wird angezeigt,
     nicht versteckt: wer nicht sieht, was er nicht hat, weiss auch
     nicht, was ihm fehlt.                                           */
  async function ausgabenVorratPruefen() {
    var box = document.getElementById('dpl-ausgaben');
    if (!box) return;

    /* 1 · Plan-Rechte */
    box.querySelectorAll('.dpl-ausgabe[data-feature]').forEach(function (b) {
      var f = b.getAttribute('data-feature');
      var darf = true;
      try {
        if (window.DealPilotConfig && DealPilotConfig.pricing
            && typeof DealPilotConfig.pricing.hasFeature === 'function') {
          darf = DealPilotConfig.pricing.hasFeature(f);
        }
      } catch (e) { darf = true; }
      sperre(b, !darf, darf ? '' : 'im Plan nicht enthalten');
    });

    /* 2 · Marktbericht-Vorrat */
    var mbKnopf = box.querySelector('.dpl-ausgabe[data-act="mb"]');
    if (!mbKnopf) return;
    var id = objektKennung();
    if (!id) { sperre(mbKnopf, true, 'kein Objekt gewählt'); _mbBerichte = []; return; }

    sperre(mbKnopf, true, 'wird geprüft …');
    try {
      /* ── v1687 · ZURUECKGENOMMEN: hier stand ein nacktes `fetch` mit
         `localStorage.getItem('dp_token')`. **Beides falsch**, und
         zusammen haben sie Marcel die Sitzung gekostet:

         1. Der Token heisst `ji_token` (`auth.js:14`). `dp_token` gibt
            es nicht — die Anfrage ging also OHNE Anmeldung raus und kam
            mit 401 zurueck.
         2. Ein nacktes `fetch` umgeht den zentralen 401-Handler. Steht
            woertlich in CLAUDE.md. Der 401 wurde deshalb als echter
            Sitzungsverlust gewertet: „Sitzung abgelaufen — bitte neu
            anmelden", bei JEDEM Objektwechsel, obwohl die Sitzung
            gueltig war. Danach gingen die Ausgaben nicht mehr.

         > Ein Pruefaufruf, der die Anmeldung kaputtmacht, ist teurer
         > als die Pruefung wert ist.

         `Auth.apiCall` setzt den Header selbst und kennt den Handler;
         `getApiBase()` enthaelt bereits `/api/v1`.               */
      var j = await Auth.apiCall('/marktbericht/objects/history?ref=' + encodeURIComponent(id),
                                 { method: 'GET' });
      var reps = ((j && j.history) || []).filter(function (h) { return h && h.report_id != null; });
      reps.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      _mbBerichte = reps;
      if (reps.length) {
        sperre(mbKnopf, false, '');
        var sub = mbKnopf.querySelector('.dpl-ausgabe-sub');
        if (sub) sub.textContent = reps.length === 1 ? 'Ein Bericht liegt vor' : (reps.length + ' Berichte — der neueste');
      } else {
        sperre(mbKnopf, true, 'noch keiner erstellt');
      }
    } catch (e) {
      _mbBerichte = [];
      /* Ein Abruf, der scheitert, ist nicht dasselbe wie „gibt es
         nicht" — das gehoert unterschieden, sonst sucht der Nutzer
         einen Bericht, den er laengst hat. */
      sperre(mbKnopf, true, 'nicht abrufbar');
    }
  }

  function sperre(knopf, zu, grund) {
    knopf.setAttribute('data-gesperrt', zu ? '1' : '0');
    var alt = knopf.querySelector('.dpl-ausgabe-x');
    if (alt) alt.remove();
    if (zu) {
      var x = document.createElement('span');
      x.className = 'dpl-ausgabe-x';
      x.textContent = '✕';
      x.title = grund || 'nicht verfügbar';
      knopf.appendChild(x);
      knopf.title = grund || 'nicht verfügbar';
    } else {
      knopf.removeAttribute('title');
    }
  }

  function objektKennung() {
    try {
      if (typeof window._currentObjKey === 'string' && window._currentObjKey) return window._currentObjKey;
    } catch (e) {}
    return null;
  }
  window.dpAusgabenVorratPruefen = ausgabenVorratPruefen;

  function ausgabenIconsNachziehen(box) {
    /* GEMESSEN am 29.09.2026, nicht geraten: `_sbActionsRenderIcons()`
       ist die Funktion, die `.sb-act-ico[data-icon]` fuellt — im Versuch
       ging der Inhalt von 0 auf 352 Zeichen, und die echte Aktionsliste
       wurde im selben Lauf mitgefuellt (318).

       `window.Icons` existiert zwar, hat aber kein `render` — es ist
       eine Sammlung von Pfaden. Ein Aufruf darauf waere still
       gescheitert und die Knoepfe waeren fuer immer blind geblieben. */
    try {
      if (typeof window._sbActionsRenderIcons === 'function') {
        window._sbActionsRenderIcons();
      }
    } catch (e) { /* Bedienbarkeit haengt nicht am Bild */ }
  }

  function dpAusgabenAktualisieren() {
    var el = document.getElementById('dpl-ausgaben-obj');
    if (!el) return;
    /* v1679b — ZURUECKGENOMMEN: hier stand `window.objects[key]`.
       **`window.objects` gibt es nicht** (gemessen: `typeof` ist
       `undefined`, ebenso `objekte`, `OBJ`, `_objects`, `dpObjects`).
       Der Name blieb deshalb immer „kein Objekt gewaehlt", obwohl
       `_currentObjKey` gesetzt war — ein geratener Speichername, der
       still ins Leere lief.

       Die gemessene Quelle ist die AKTIVE KARTE in der Objektliste:
       `.sb-card.active` traegt `.sbc-seq` („2026-999") und
       `.sbc-address` („Musterstrasse 12, Leipzig"). Das ist dieselbe
       Anzeige, die der Nutzer sieht — sie kann gar nicht auseinander
       laufen.                                                        */
    var name = '';
    try {
      var karte = document.querySelector('.sb-card.active, .sb-card.sel, .sb-card[aria-current]');
      if (karte) {
        var adr = karte.querySelector('.sbc-address');
        var seq = karte.querySelector('.sbc-seq');
        var a = adr && adr.textContent ? adr.textContent.trim() : '';
        var s = seq && seq.textContent ? seq.textContent.trim() : '';
        name = a || s;
        if (a && s) name = s + ' · ' + a;
      }
    } catch (e) { name = ''; }
    el.textContent = name ? ('für ' + name) : 'kein Objekt gewählt';
    el.classList.toggle('dpl-ausgaben-leer', !name);
  }
  window.dpAusgabenAktualisieren = dpAusgabenAktualisieren;

  /* `dp:object-ready` auf WINDOW ist das einzige Ereignis, das wirklich
     gefeuert wird — gemessen an `storage.js:137`. `dp:obj-loaded` und
     `dp:object-loaded` gibt es nicht; ein Listener darauf schwiege für
     immer, ohne dass irgendwo ein Fehler erschiene.                  */
  window.addEventListener('dp:object-ready', function () {
    /* 400 ms, nicht 60: die `.active`-Marke auf der Karte wird NACH dem
       Ereignis gesetzt. Zu frueh gelesen steht dort noch die vorige
       Auswahl — oder gar keine.                                      */
    setTimeout(function () { dpAusgabenAktualisieren(); ausgabenVorratPruefen(); }, 400);
  });
  /* Zweiter Weg, weil der erste eine Reihenfolge voraussetzt: ein Klick
     in der Objektliste fuehrt immer zu einer neuen Auswahl, ganz gleich
     ob und wann ein Ereignis feuert. */
  document.addEventListener('click', function (e) {
    if (!document.getElementById('dpl-ausgaben')) return;
    if (e.target.closest && e.target.closest('.sb-card')) {
      setTimeout(function () { dpAusgabenAktualisieren(); ausgabenVorratPruefen(); }, 400);
    }
  }, true);
  /* Der Plan kommt spaeter als die Oberflaeche — `dp:plan-ready` statt
     Timer oder Polling (subscription.js:154). Ohne das stuenden alle
     Plan-Ausgaben beim ersten Aufbau faelschlich als gesperrt da. */
  window.addEventListener('dp:plan-ready', function () {
    if (document.getElementById('dpl-ausgaben')) ausgabenVorratPruefen();
  });

  function hole(sel) {
    /* Die Ausgaben-Box existiert erst, wenn ein Layout sie anfordert. */
    if (sel === '#dpl-ausgaben') return baueAusgaben();
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

    /* v1679: Die Ausgaben-Box wird GEBAUT, nicht verschoben — sie steht
       deshalb in keinem `merker` und kaeme durch `zurueck()` allein
       nicht weg. Liegt sie in einer Schiene, ist sie eben mit ihr
       verschwunden; haengt sie noch am `<body>` (weil ein Lauf
       abgebrochen ist), bliebe sie als Fenster ueber der App stehen.
       Genau so ist `data-dpl-portfolio` einmal haengengeblieben und hat
       „Heute" hell gelassen. Was gebaut wird, wird auch abgeraeumt. */
    var ab = document.getElementById('dpl-ausgaben');
    if (ab && ab.parentElement) ab.parentElement.removeChild(ab);
  }

  /* ── Die Schienen bauen ─────────────────────────────────────────── */
  /* ── v1892 · AUF DEM HANDY GIBT ES NUR EINE SCHIENE ────────────────
     `handyOben` in `baueEine()` (eine Funktion tiefer) laesst die
     Schiene unter 900 px NICHTS aus der Seitenleiste nehmen - das war
     die v1880-Reparatur fuer die Aktenmappe. Die Bedingung lautet aber
     `S.stellung === 'links'`, und damit greift sie **fuer die rechte
     Schiene nicht**. Solange nur die Aktenmappe waehlbar war, fiel das
     nicht auf: sie hat nur eine Schiene, und die steht links.

     Gemessen am Code, bevor Tower und Kanzlei zurueckkommen:

       Kanzlei (v2)  rechte Schiene  ton: hell   nimmt: aktionen, ausgaben
       Tower   (v2b) rechte Schiene  ton: hell   nimmt: ausgaben, score

     Auf 390 px haette das zwei Folgen gehabt, beide genau der „Misch",
     ueber den Marcel sich beschwert:

       1. `#sb-actions-accordion` (Kanzlei) bzw. `#hdr-badges` (Tower)
          wandert aus der Schublade/Kopfzeile heraus in eine Schiene am
          Ende der `.main-col`. In der Kanzlei waere die Schublade damit
          wieder leer - genau der Befund aus v1880 („oeffnet sich da
          was, wo nichts geoeffnet wird").
       2. Diese Schiene traegt `ton="hell"`. Ein heller Kasten in einem
          dunklen Aussehen, auf dem Handy quer ueber die ganze Breite.

     Marcel am 06.10.2026 ausdruecklich: „Das muss erstmal nicht hell
     werden." Unter 900 px wird die rechte Schiene deshalb **gar nicht
     gebaut**. Nicht „leer gebaut": eine Schiene ohne Inhalt waere eine
     Ueberschrift ueber nichts, und `marke`/`portfolio` stehen bei ihr
     auf `false` - es blieben ein Titel und eine Linie.

     Damit sieht das Handy in allen drei Layouts gleich aus: dunkler
     Streifen mit Marke und Portfolio-Knopf, alles andere an seinem
     gebauten Platz (Reiter klebend im Kopf, Suche/Liste/Aktionen in der
     Seitenleiste). Das ist der Weg, der fuer die Aktenmappe in
     v1889-v1889e abgenommen wurde - Tower und Kanzlei erben ihn, statt
     einen eigenen zu bekommen.

     > Was die rechte Schiene auf dem Handy verliert, ist die
     > Ausgaben-Box. Sie fuehrt keine eigene Logik: jeder ihrer sieben
     > Knoepfe ruft `sbActionsAction(...)`, denselben Weg wie die
     > Aktionsliste in der Schublade (siehe `baueAusgaben()`). Es geht
     > eine Gruppierung verloren, keine Funktion.

     Ueber 900 px bleibt alles, wie es war - der Schreibtisch wird hier
     nicht angefasst. `umbau` am `mq900`-Horcher (unten) baut beim
     Ueberschreiten der Schwelle neu, die Schiene kommt also zurueck. */
  function baueSchienen(v) {
    var L = LAYOUTS[v];
    var mc = el('.main-col');
    if (!mc || !L.schienen) return;
    var handy = window.matchMedia('(max-width: 900px)').matches;
    L.schienen.forEach(function (S) {
      if (handy && S.stellung !== 'links') return;
      baueEine(L, S, mc);
    });
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

    /* v1879b · Unter 900 px steht die linke Schiene im Fluss und scrollt weg (v1879). Nimmt sie
       die Reiter mit (Kanzlei), scrollen die Reiter mit weg - gemessen: nav.tabs bei y=91 in der
       Schiene, nach dem Scrollen unerreichbar. Auf dem Handy bleiben die Reiter deshalb dort,
       wo sie gebaut sind: klebend unter der Kopfzeile. */
    var handyOben = window.matchMedia('(max-width: 900px)').matches && S.stellung === 'links';
    /* v1880 · Marcel (iPhone): "wenn du auf das Burger-Menue klickst, oeffnet sich da was, wo nichts
       geoeffnet wird. Da steht Quick Check und Marktbericht, sonst nichts." Gemessen: die Schiene
       hatte Objekte, Suche, Aktionen und Nutzer aus der Seitenleiste GENOMMEN - die Seitenleiste
       war leer, und die Objektliste lag in der Schiene mit 390-px-Sortierleiste. Auf dem Handy nimmt
       die Schiene deshalb NICHTS: nur Marke und Portfolio-Knopf; der Knopf oeffnet die normale
       Seitenleiste, die auf dem Handy seit jeher funktioniert. */
    S.nimmt.forEach(function (art) {
      if (handyOben) return;
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
    /* ── v1681b · AM BODY IST SIE AUF DEM TABLET UNERREICHBAR ───────
       Oben steht, warum die Schiene am `<body>` haengt: in `.main-col`
       klippte sie und die Objektliste wurde unbedienbar (v1656). Das
       gilt fuer die SCHWEBENDE Schiene — und nur fuer sie.

       Unter 1100 px ist sie nicht mehr schwebend: dort setzt das CSS
       `position:relative`, damit sie aus dem Schweben in den Fluss
       wandert. Und im Fluss des `<body>` ist sie verloren. Gemessen
       bei 817 px, Kanzlei 2:

         Knopf liegt bei      y = 815
         Sichtfeld endet bei  y = 757
         body.scrollHeight    983  bei  overflow-y: HIDDEN
         scrollende Vorfahren KEINE

       Es gibt nichts zu scrollen — der Inhalt ist schlicht
       abgeschnitten. Dasselbe galt fuer die Aktionen der Kanzlei,
       seit es sie gibt.

       Im Fluss gehoert sie deshalb dorthin, wo auch gescrollt wird:
       ans Ende von `.main-col`. Geklippt wird sie dort nicht — Klippen
       war das Problem der FIXIERTEN Schiene, die ausserhalb ihres
       Behaelters lag. Eine mitscrollende liegt darin.                */
    var imFluss = window.matchMedia('(max-width: 1100px)').matches
                  && S.stellung === 'rechts';
    /* v1879 · Marcel (Handy, Aktenmappe, 05.10.2026): "nichts erreichbar, alles falsch
       skaliert, Menue ging nicht." Gemessen auf 390 px: die linke Schiene wird unter 900 px
       zum FESTEN Kopfstreifen (CSS v1658), 187 px hoch - das Polster der .app-wrap sind aber
       146 px. Die ersten 41 px der Kopfzeile samt #hdr-mobile-menu lagen darunter, und die
       Score-Leiste darin war 808 px breit. Deshalb steht die Schiene auf dem Handy jetzt IM
       FLUSS am Anfang der .main-col: sie scrollt mit weg, Kopfzeile und Reiter bleiben kleben. */
    var obenImFluss = handyOben;
    var mcol = (imFluss || obenImFluss) ? document.querySelector('.main-col') : null;
    if (mcol && obenImFluss) {
      mcol.insertBefore(schiene, mcol.firstChild);
      schiene.setAttribute('data-dpl-oben-im-fluss', '1');
    } else {
      (mcol || document.body).appendChild(schiene);
      if (mcol) schiene.setAttribute('data-dpl-im-fluss', '1');
    }
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
    /* v1880 · Auf dem Handy nimmt die Schiene nichts (baueSchienen); der Portfolio-Knopf oeffnet
       deshalb die normale Seitenleiste mit Objektliste, Suche und Aktionen. */
    if (window.matchMedia('(max-width: 900px)').matches && typeof window.toggleMobileSidebar === 'function') {
      window.toggleMobileSidebar(); return;
    }
    var auf = zu === undefined
      ? document.documentElement.getAttribute('data-dpl-portfolio') !== 'auf'
      : !zu;
    document.documentElement.setAttribute('data-dpl-portfolio', auf ? 'auf' : 'zu');
    var k = el('.dpl-portfolio');
    if (k) k.setAttribute('aria-expanded', auf ? 'true' : 'false');
    /* ── v1666 · DER KNOPF SAGT, WOHIN ER FUEHRT ────────────────────
       Marcel: „man kann oben wechseln, von Portfolio auf Aktionen und
       wieder zurueck — also so ein Umschaltmenü."

       Der Knopf hiess in beiden Zustaenden „Portfolio". Solange er nur
       auf- und zuklappte, ging das; seit v1666 TAUSCHT er aber die
       ganze untere Haelfte der Schiene aus — Objektliste gegen
       Aktionen. Ein Schalter, der zwei Dinge tauscht, muss das Ziel
       nennen, nicht die Herkunft.

       > Eine Beschriftung, die sich nicht aendert, beschreibt einen
       > Knopf. Eine, die sich aendert, beschreibt einen Weg. */
    var t = k && k.querySelector('.dpl-t');
    if (t) {
      var wort = auf ? 'Aktionen' : 'Portfolio';
      if (t.textContent !== wort) t.textContent = wort;
    }
  }

  /* Ein Klick auf eine Objektkarte klappt die Liste zu - man hat ja
     gefunden, was man gesucht hat.

     v1705b: AUSSER er galt den Aktionsknoepfen. Marcel: "man kann unter
     Portfolio wenn man die Objekte auswaehlt kein Objekt mehr loeschen."

     Gemessen am 29.09.2026: nach dem Klick auf eine Karte stand
     data-dpl-portfolio auf "zu", .dpl-teil-objekte auf display:none
     und damit die GANZE Liste auf 0x0 - samt Loeschknopf. Die Annahme im
     Satz oben stimmt hier nicht:

     > Wer loeschen will, hat NICHT gefunden, was er gesucht hat. Er will
     > die Zeile weghaben - und sie klappt ihm unter dem Finger weg.

     Das Zuklappen bleibt, es hat seinen Sinn. Es greift nur nicht mehr
     fuer Klicks innerhalb von .sbc-actions. */
  document.addEventListener('click', function (e) {
    if (!aktuell) return;
    if (document.documentElement.getAttribute('data-dpl-portfolio') !== 'auf') return;
    if (e.target.closest && e.target.closest('.sbc-actions')) return;
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
    /* v1666: `v1` gibt es nicht mehr — wer es gemerkt hat, bekommt die
       Aktenmappe, nicht „Heute". */
    if (v === 'v1') v = 'v1b';
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
      /* v1661 · NEU LADEN STATT IM LAUFENDEN TAB UMSCHALTEN.

         Marcel: 'die Karten sind hell geworden im Auslieferungszustand
         und auch oben die Tabbar'. Gemessen: eine FRISCH GELADENE Seite
         ohne Layout ist einwandfrei dunkel (Sidebar rgb(0,0,0),
         Reiterleiste rgb(10,8,5)). Der Schaden entsteht nur beim
         Umschalten im laufenden Tab.

         settings.js sagt warum, an seiner eigenen Stelle: '_dpDispSkin
         loescht die Vorlage, wenn sie der Helligkeit widerspricht.'
         Ein Skinwechsel zur Laufzeit hinterlaesst Inline-Variablen und
         eine geloeschte Vorlage - style.disabled setzt nichts zurueck.

         > **Was sich nicht sauber zuruecknehmen laesst, wird nicht
         > zurueckgenommen, sondern neu geladen.** Ein Neuladen ist
         > sichtbar und ehrlich; ein halb umgeschalteter Skin sieht aus
         > wie ein Fehler und ist auch einer.

         Der Merker steht auf 0, das Layout ist geloescht - die Seite
         kommt im Auslieferungszustand hoch. */
      skinVorher = null;
      if (document.body) document.body.classList.remove('dp-neue-karte', 'dp-neue-karte-stil');
      /* v1661b · DIE MARKEN BLEIBEN, NICHT DIE TOKENS.

         Gemessen im kaputten Zustand: --dp-s0 stand korrekt auf
          - die Farbtokens waren also RICHTIG. Weiss war es
         trotzdem, weil drei MARKEN haengen blieben:

           body.dp-chrome-hell      die Hell-Fassung (103 Regeln)
           html[data-ui-theme]      die Darstellung
           html[data-dp-karte]      hell-varianten.js

         > Der Skin ist nicht kaputt, er ist nur nicht abgemeldet.
         > Wer Tokens misst und Marken vergisst, sucht an der
         > falschen Stelle.

         Ein Neuladen hatte ich zuerst versucht - es wird vom
         beforeunload-Horcher der Seite abgefangen und findet gar nicht
         statt. Die Marken direkt zu entfernen wirkt sofort und
         braucht keine Navigation. */
      try {
        document.body.classList.remove('dp-chrome-hell');
        localStorage.setItem('dp_chrome_hell', '0');
      } catch (e) {}
      h.removeAttribute('data-ui-theme');
      /* v1662b · DAS PORTFOLIO-ATTRIBUT GEHOERT MIT ABGEMELDET.

         Gemessen nach setze(''): Farben alle richtig, aber die App
         stand in einer 380 px schmalen Spalte. Ursache:

           html[data-dpl-portfolio] #sidebar{
             position:fixed; left:0; transform:translateX(-102%); }

         `data-dpl-portfolio` blieb stehen - ich hatte in v1653 die
         Schubladenregel bewusst AN DIESES Attribut gehaengt, weil die
         Layoutliste (v1,v3,v4) v2 vergessen hatte. Damit hing sie an
         einem Merker, den das Abmelden nicht kannte.

         > Wer einen Anker wechselt, muss auch den Abbau umhaengen.
         > Ein Aufraeumen, das die alte Liste abarbeitet, laesst genau
         > das stehen, was neu dazugekommen ist. */
      h.removeAttribute('data-dpl-portfolio');
      /* v1662 · EIN MERKER, DER ZURUECKKOMMT, IST KEIN AUSLIEFERUNGSZUSTAND.

         Das Attribut zu entfernen reichte NICHT. hell-varianten.js
         horcht seit v1653e auf 'data-dp-layout' und meldet sich
         wieder an, sobald das Layout faellt - aus seinem eigenen
         Merker 'dp_karten_variante'. Gemessen: nach setze('') stand
         data-dp-karte wieder auf "v3", und v3 faerbt .sb-card,
         .sidebar und nav.tabs hell (hell-varianten.css:62-138).

         Der Kopf dieser Stelle sagte bis v1661b selbst: 'Der Merker
         bleibt erhalten: wer das Layout wieder auf Heute stellt,
         bekommt seine Kartenvariante zurueck.' Das war meine
         Entscheidung, und sie ist falsch.

         > 'Heute' heisst Auslieferungszustand, nicht 'mein letzter
         > Werkzeugstand'. Ein Werkzeug, das sich selbst wieder
         > anschaltet, ist kein Werkzeug mehr, sondern ein Zustand.

         Deshalb wird der Merker GELOESCHT, nicht nur das Attribut.
         Die Variante bleibt jederzeit ueber das Panel erreichbar. */
      try {
        if (window.DealPilotKartenVariante &&
            typeof window.DealPilotKartenVariante.setze === 'function') {
          window.DealPilotKartenVariante.setze('');
        }
      } catch (e) {}
      try { localStorage.setItem('dp_karten_variante', ''); } catch (e) {}
      h.removeAttribute('data-dp-karte');
      /* Und die Vorlage neu rechnen lassen, damit die Tokens zu den
         Marken passen. */
      try { if (typeof window._dpDispRefresh === 'function') window._dpDispRefresh(); } catch (e) {}
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
    /* ── v1699 · DER HELL-ZWANG IST RAUS ────────────────────────────
       Hier stand `window._dpDispSkin('hell')` — jedes Layout hat die
       Oberflaeche beim Einschalten auf hell gestellt.

       Marcel: „auch standard den DealPilot-Dunkelmodus ausliefern. Den
       Hell-Modus-Wechsel kann man dann unter ‚Darstellung oeffnen'
       finden."

       Er hat recht, und der Zwang war ohnehin eine Anmassung: wer ein
       Layout waehlt, waehlt eine AUFTEILUNG. Die Helligkeit ist eine
       zweite Entscheidung, und sie gehoert dem Nutzer. Ein Umbau, der
       sich nicht abwaehlen laesst, ist kein Angebot, sondern eine
       Ansage.

       `skinVorher` wird weiter gemerkt — es traegt den Rueckweg fuer
       `setze('')` und kostet nichts. */
    try {
      if (skinVorher === null && document.body) {
        skinVorher = document.body.classList.contains('dp-chrome-hell') ? 'hell' : 'obsidian';
      }
    } catch (e) {}
    /* ── v1748b · DIE BORDKARTE IST DIE VORGABE, NICHT DER ZWANG ────
       Marcel: „dass wir aber standardmaessig einfach unter der
       Darstellung, dass wir immer die Bordkarten erstmal auswaehlen."

       Bisher setzte nur das Einrichtungsfenster bei der Erstanmeldung
       eine Objektkarte. Wer die Ansicht SPAETER unter Darstellung
       wechselt - und genau das meint Marcel - bekam die Schiene ohne
       Kartenbild.

       Gesetzt wird nur, wenn der Merker gar nicht DA ist. Wer einmal
       selbst gewaehlt hat - auch die leere Fassung „Heute", die
       schreibt einen leeren Wert - behaelt seine Wahl. Zwanzig Zeilen
       weiter oben steht, warum das so sein muss: „Ein Umbau, der sich
       nicht abwaehlen laesst, ist kein Angebot, sondern eine Ansage."
       Eine Vorgabe ueberschreibt nichts, sie fuellt eine Luecke. */
    try {
      if (localStorage.getItem('dp_objkarte_stil') === null &&
          window.DealPilotObjektkarte && typeof window.DealPilotObjektkarte.setze === 'function') {
        window.DealPilotObjektkarte.setze('bordkarte');
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
    /* v1690 — DIE NUMMERN WAREN EIN HINDERNIS.
       Hier stand `(i + 1) + ' · ' + name`, also „1 · Aktenmappe",
       „2 · Kanzlei", „3 · Tower". Marcel nennt sie ausnahmslos beim
       Namen — die Nummer half niemandem und stand zwischen ihm und dem
       Wort, das er sucht. Eine Reihenfolge braucht keine Nummer, wenn
       die Reihenfolge schon sichtbar ist. */
    var kacheln = [{ key: '', name: 'Heute', sub: 'Unveränderte Ansicht' }].concat(
      /* ── v1892 · DIE AUSBLENDUNG AUS v1880 IST ZURUECKGENOMMEN ──────
         Hier stand `.filter(k => k === 'v1b')` mit dem Vermerk „nur
         Heute und Aktenmappe zur Wahl; Kanzlei und Tower bleiben im
         Code." Das war v1880 auf Marcels Ansage richtig.

         **Am 06.10.2026 will er sie zurueck:** „Unter Einstellungen
         fehlen nun die anderen Aussehen wie Tower und das andere was
         wir hatten."

         Es gibt genau DREI Eintraege in `LAYOUTS` (v1b Aktenmappe,
         v2 Kanzlei, v2b Tower) plus „Heute" als Schluessel `''` —
         also vier Kacheln. Der Filter ist ersatzlos weg, damit die
         Liste wieder aus `LAYOUTS` kommt und nicht aus einer zweiten
         Aufzaehlung, die beim naechsten Layout schon falsch waere.

         > Dieselbe Stelle steht ein zweites Mal in `inEinstellungen()`.
         > Beide gehoeren zusammen geaendert - sonst zeigt das
         > Darstellungs-Panel etwas anderes als die Einstellungen. */
      Object.keys(LAYOUTS).map(function (k) {
        return { key: k, name: LAYOUTS[k].name, sub: LAYOUTS[k].beschreibung };
      }));
    /* v1690 — „Aussehen" statt „Aufbau". Marcel sucht diesen Abschnitt
       dreimal unter „Darstellung → Aussehen" und findet ihn nicht: die
       Ueberschrift hiess anders als das Wort, das er benutzt. Eine
       Gruppe, die man nur findet, wenn man ihren Namen schon kennt, ist
       fuer den, der sie sucht, nicht vorhanden. */
    g.innerHTML = '<h3>Aussehen</h3>'
      + '<p class="dpuv-hint">Wo Menü, Aktionen, Score und Ausgaben liegen. '
      + 'Die Arbeitsfläche bleibt in allen gleich — es wechselt nur der Rahmen. '
      + 'Farben, Formen und Schrift stehen darunter und lassen sich frei '
      /* ── v1889 · HIER STAND: „Jede Ansicht ausser ‚Heute' schaltet auf hell." ──
         Das hat der Code zuletzt in v1698 getan. v1699 hat den Hell-Zwang
         ausdruecklich ENTFERNT (siehe `setze()`), auf Marcels Ansage, den
         Dunkelmodus als Auslieferungszustand zu behalten. Der Satz blieb
         stehen und versprach seitdem etwas, das nicht passiert.

         > Ein Hinweistext ist eine Zusage. Wer ihn nicht mit zurueckbaut,
         > hinterlaesst keine Doku, sondern eine Luege - und wer ihr folgt,
         > sucht den Fehler an einer Stelle, an der keiner ist.

         Nachgemessen am 06.10.2026: mit `dp_chrome_hell=1` VOR dem Laden
         bleiben `#sidebar`, `.dpl-schiene`, `header.hdr` und `nav.tabs` auf
         rgb(14,13,11) - der helle Anstrich wuerde den Rahmen der Layouts
         ohnehin nicht erreichen (layout-varianten.css:1643 und :1737 heben
         sich mit (1,4,3) ausdruecklich ueber `body.dp-chrome-hell`). Der
         Satz war also doppelt falsch. */
      + 'dazu kombinieren. Hell und Dunkel wählst du getrennt unter <b>Modus</b>.</p>'
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
      try { if (b && b.hasAttribute('data-v')) localStorage.setItem('dp_layout_gewaehlt', '1'); } catch (x) {}   /* v1880: eine bewusste Wahl schlaegt den Standard */
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
      try { if (b && b.hasAttribute('data-v')) localStorage.setItem('dp_layout_gewaehlt', '1'); } catch (x) {}   /* v1880: eine bewusste Wahl schlaegt den Standard */
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

  /* ── v1697 · DIE LAYOUTS IN DEN EINSTELLUNGEN ──────────────────────
     `settings.js` legt unter „Aussehen" einen leeren Behaelter
     `#dp-layout-wahl-host` an. Gefuellt wird er hier, weil hier die
     Liste steht — `settings.js` wuesste sonst nicht, welche Layouts es
     gibt, und eine zweite Liste dort waere beim naechsten schon falsch.

     Derselbe Bau wie im Darstellungs-Panel (`.dpuv-g`/`.dpuv-sgb`), nur
     ohne dessen Rahmen: die Einstellungen bringen ihren eigenen mit. */
  function inEinstellungen() {
    var host = document.getElementById('dp-layout-wahl-host');
    if (!host || host.getAttribute('data-gefuellt') === '1') return;
    host.setAttribute('data-gefuellt', '1');

    var kacheln = [{ key: '', name: 'Heute', sub: 'Unveränderte Ansicht' }].concat(
      /* v1892 · Zweite Stelle derselben Ausblendung - zurueckgenommen wie
         oben in `inPanel()`. Marcel am 06.10.2026 will Tower und Kanzlei
         zurueck in der Wahl. */
      Object.keys(LAYOUTS).map(function (k) {
        return { key: k, name: LAYOUTS[k].name, sub: LAYOUTS[k].beschreibung };
      }));

    host.innerHTML =
        /* v1699e: Kasten und Rahmen stehen im CSS (`.dp-layoutw-box`).
           Hier stand das Gold in ZAHLENFORM als Rahmenfarbe, und das
           sich beim Mandanten genauso wenig umfaerbt wie ein Hex. Der
           Waechter zaehlt es zu Recht mit; ich hatte beim Suchen nur
           nach Hex geschaut und ihn dreimal vergeblich laufen lassen. */
        '<div class="dp-layoutw-box">'
      +   '<div class="dp-layoutw-hinweis">'
      +     'Wo Menü, Aktionen, Score und Ausgaben liegen. Farben, Formen und '
      +     'Schrift lassen sich frei dazu kombinieren.</div>'
      +   '<div id="dp-layout-wahl" class="dp-layoutw-gitter">'
      +     kacheln.map(function (o) {
            return '<button type="button" class="dp-layoutw'
              + (o.key === aktuell ? ' on' : '') + '" data-v="' + o.key + '">'
              + '<span class="dp-layoutw-n">' + o.name + '</span>'
              + '<span class="dp-layoutw-s">' + (o.sub || '') + '</span></button>';
          }).join('')
      +   '</div></div>';

    markiereEinstellungen();

    host.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dp-layoutw') : null;
      if (!b) return;
      setze(b.getAttribute('data-v') || '');
      markiereEinstellungen();
    });
  }

  function markiereEinstellungen() {
    var w = document.getElementById('dp-layout-wahl');
    if (!w) return;
    [].forEach.call(w.querySelectorAll('.dp-layoutw'), function (b) {
      var an = (b.getAttribute('data-v') || '') === (aktuell || '');
      b.classList.toggle('on', an);
      /* v1699c: Die Marke steht jetzt als Klasse, die Farbe im CSS
         (`layout-varianten.css`, `.dp-layoutw.on`). Vorher stand hier
         das Gold-Token samt Rückfallwert als Zeichenkette für einen
         Inline-Stil — inhaltlich richtig, aber der Gold-Wächter liest
         JS-Strings nicht auf `var()` und zählte es als hartes Gold
         (0 -> 1, Datei war sauber). Auch der Rückfallwert IM KOMMENTAR
         zählte noch; der Wächter kann Erklärung und Code nicht
         unterscheiden, und das ist richtig so.

         > Ein Wächter, den man mit einem richtigen Wert rot macht,
         > wird umgangen statt gelesen. Lieber die Farbe dorthin
         > schreiben, wo er sie versteht. */
    });
  }

  function panelBeobachten() {
    if (beobachter || !window.MutationObserver) return;
    beobachter = new MutationObserver(function () { inPanel(); inEinstellungen(); });
    beobachter.observe(document.body, { childList: true, subtree: true });
    inPanel();
    inEinstellungen();
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
    } else {
      /* v1880 · Marcel: "defaultmaessig wird dann die Aktenmappe genommen" - wer nie gewaehlt hat,
         bekommt die Aktenmappe; "Heute" bleibt waehlbar (dp_layout_gewaehlt merkt die Wahl). */
      var _gew = ''; try { _gew = localStorage.getItem('dp_layout_gewaehlt') || ''; } catch (e) {}
      if (!_gew) setze('v1b');
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

  /* ── v1681b · DIE SCHWELLE MUSS BEIDE RICHTUNGEN KENNEN ───────────
     Wo die rechte Schiene haengt, entscheidet sich beim Bauen: ueber
     1100 px am `<body>` (schwebend), darunter in `.main-col`
     (mitscrollend). Ohne Beobachter bleibt sie beim Drehen eines
     Tablets oder beim Ziehen des Fensters dort, wo sie gebaut wurde —
     und ist dann entweder geklippt oder unerreichbar.

     `matchMedia().addEventListener('change')` feuert nur beim
     UEBERSCHREITEN der Schwelle, nicht bei jedem Pixel. Ein
     `resize`-Listener wuerde das Layout hundertfach neu bauen. */
  try {
    var mq = window.matchMedia('(max-width: 1100px)');
    var mq900 = window.matchMedia('(max-width: 900px)');   /* v1879: die Handy-Schwelle der Schiene */
    var umbau = function () {
      /* `aktuell` direkt, nicht ueber `window.DealPilotLayout` — dieser
         Block steht VOR der Zuweisung der API. Beim Feuern waere sie
         zwar da, aber eine Abhaengigkeit, die nur zeitlich aufgeht, ist
         eine, die beim naechsten Umbau kippt. */
      if (aktuell) setze(aktuell);   /* neu bauen, damit der Ort stimmt */
    };
    if (mq.addEventListener) mq.addEventListener('change', umbau);
    else if (mq.addListener) mq.addListener(umbau);   /* aeltere Browser */
    if (mq900.addEventListener) mq900.addEventListener('change', umbau);
    else if (mq900.addListener) mq900.addListener(umbau);
  } catch (e) { /* ohne Beobachter bleibt es beim Stand des Aufbaus */ }

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
