/* ═══════════════════════════════════════════════════════════════════════
   objektkarten-stil.js · v1715 — die Entwürfe unter „Darstellung"

   Marcel am 30.09.2026, zweiter Durchgang:
     „bitte arbeite unter Darstellung auch den wechsel der Karten ein.
      Bau alle ein außer Status und Cockpit. Nehme die information
      Investor aus der Design Optik bei allen raus außer bei unserem
      standard Obsidian look. Das Fenster kannst du dann wieder
      entfernen."

   Drei Änderungen gegenüber v1714:

   1. Das schwebende Fenster ist WEG. Es war zum Ausprobieren gebaut
      („erst mal auf dem bildschirm zum umswitchen") und hat seinen
      Zweck erfüllt. Die Wahl steht jetzt dort, wo sie hingehört:
      Einstellungen → Darstellung → Aussehen.

      > Ein Werkzeug, das zum Ausprobieren gebaut wurde, wird nach dem
      > Ausprobieren abgebaut. Sonst steht es irgendwann in der
      > Auslieferung und niemand weiß mehr, warum.

   2. Status und Cockpit sind raus — Marcels Auswahl.

   3. Die INVESTOR-Lasche erscheint nur noch im Standard (Aktenreiter).
      In den anderen Entwürfen wäre sie ein Fremdkörper: sie gehört zur
      Aktenmetapher, nicht zu einer Datenzeile oder einer Ampel. Das
      steht in der CSS (layout-varianten.css, v1715).

   ── DAS ATTRIBUT ─────────────────────────────────────────────────────
   `data-dp-objkarte` am `<html>`, vorher gegrept: frei. Ohne Wahl bleibt
   der Aktenreiter — das leere Attribut ist der Istzustand und trägt
   keine Regel.

   ── NUR IN DEN LAYOUTS ───────────────────────────────────────────────
   Die Entwürfe formen die Karte in der Layout-SCHIENE. Ohne Layout gibt
   es sie nicht, also wird das Attribut dort auch nicht gesetzt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__dpObjkarte) return;
  window.__dpObjkarte = true;

  var LS = 'dp_objkarte_stil';
  var ATTR = 'data-dp-objkarte';
  var HOST = 'dp-objkarte-wahl-host';

  /* v1724: die Wahl steht jetzt an ZWEI Orten - in den Einstellungen
     (ID, wie bisher) und im Darstellungs-Panel (Klasse). Marcel:
     "wenn wir das auch mit unter Darstellung oeffnen anbieten".

     Eine zweite ID waere ein Duplikat und der Browser nimmt dann still
     die erste - deshalb traegt der zweite Ort eine KLASSE. `hosts()`
     liefert beide, und jede Funktion arbeitet ueber die Liste statt
     ueber ein einzelnes Element. */
  function hosts() {
    return Array.prototype.slice.call(document.querySelectorAll('#' + HOST + ', .' + HOST));
  }

  /* v3235 · Marcel 09.11.2026: „Bei Objektkarten fällt Aktenreiter, Ampel, Minimal und
     Kennzahlen raus.“ Hier standen zusaetzlich:
       ''          Aktenreiter  · Lasche mit Objektnummer
       ampel       Ampel        · Ein Punkt sagt die Stufe
       kennzahlen  Kennzahlen   · Preis, Rendite, Cashflow (v2178)
       minimal     Minimal      · Nur Adresse und Ring
     Ihre CSS-Regeln bleiben liegen - ohne Eintrag hier wird das Attribut nie gesetzt. Wer einen
     davon gemerkt hatte, faellt in start() auf den Rueckfall (Bordkarte), der Merker wird geraeumt. */
  var STILE = {
    bordkarte:   { name: 'Bordkarte',   sub: 'Abriss links, Nummer hochkant · Standard' },
    kante:       { name: 'Score-Kante', sub: 'Farbiger Strich statt Ring' },
    datenzeile:  { name: 'Datenzeile',  sub: 'Mono, eine Zeile, bündig' }
  };
  var RUECKFALL = 'bordkarte';   /* v3235 */
  function bekannt(s) { return !!(s && Object.prototype.hasOwnProperty.call(STILE, s)); }

  var aktuell = '';

  /* ══ v1949 · DIE WAHL GILT JETZT AUCH IN DER ANSICHT DEALPILOT ═══════
     Marcel am 07.10.2026: "wenn ich die Objektkarten umstelle, das geht
     in der Ansicht Heute … das greift gar nicht. Also man kann das
     umstellen, aber es bleibt weiterhin bei diesen Objektkarteien, die
     wir standardmaessig haben."

     GEMESSEN am 07.10.2026 in der Messkabine, alle sieben Stile ueber den
     Panel-Bedienweg durchgeklickt: data-dp-objkarte blieb jedes Mal null,
     die Karte jedes Mal 344x211. Die Ursache stand eine Zeile weiter
     unten in setze():

         if (aktuell && layoutAktiv()) h.setAttribute(ATTR, aktuell);

     v1940 hat 49 CSS-Regeln auf html:not([data-dp-layout])
     [data-dp-objkarte="…"] geklont - fuer einen Zustand, den dieses JS
     sich weigerte herzustellen. Die Regeln sind richtig und waren nie
     erreichbar. Ein Stil, der an einem Attribut haengt, ist nur so weit
     gebaut wie der Schreiber dieses Attributs.

     > WARUM DIE BEDINGUNG DOCH NICHT EINFACH WEGFAELLT: ohne eigene Wahl
     > gilt seit v1915 die Bordkarte (Marcels Entscheidung vom 06.10. fuer
     > die Aktenmappe). Haette ich layoutAktiv() nur gestrichen, bekaeme
     > JEDER, der nie etwas gewaehlt hat, ploetzlich Bordkarten in der
     > DealPilot-Ansicht - ein Umbau, den niemand bestellt hat. Deshalb
     > sind EIGENE WAHL und RUECKFALL ab hier zwei verschiedene Dinge:
     >
     >   eigene Wahl  ->  gilt ueberall, auch ohne Layout
     >   Rueckfall    ->  Bordkarte nur in den Mappen, sonst Aktenreiter

     gewaehlt === null heisst "hat sich nie entschieden". Geprueft wird
     auf ABWESENHEIT, nicht auf den Wahrheitswert - wer sich bewusst fuer
     den Aktenreiter entscheidet, speichert die leere Zeichenkette, und
     das ist eine Wahl.
     ══════════════════════════════════════════════════════════════════ */
  var gewaehlt = null;

  function layoutAktiv() {
    return document.documentElement.hasAttribute('data-dp-layout');
  }

  /* Was gilt gerade — aus eigener Wahl oder Rueckfall. */
  /* ── v2083a · DER RUECKFALL IST JETZT DIE DATENZEILE ──────────────────
   *
   * HIER STAND `'bordkarte'`. Das war Marcels Entscheidung vom
   * 06.10.2026 (v1915: „die Aktenmappe würde ich erst mal standardmäßig
   * mit der Bordkarte anzeigen").
   *
   * Am 10.10.2026 hat er sie ersetzt: „Ich würde gerne, dass wir das
   * Standard-Design … auf die Aktenmappe legen" — mit der Objektkarte
   * als **Datenzeile**. Das Onboarding setzt sie seit `v2083`; dieser
   * Rückfall gilt für alle, die das Onboarding nie durchlaufen haben
   * oder ihren Merker gelöscht haben.
   *
   * > Zwei Entscheidungen zur selben Frage, vier Tage auseinander. Wer
   * > nur die eine umsetzt, baut einen Unterschied zwischen dem, was
   * > neue Nutzer sehen, und dem, was Bestandsnutzer sehen — und beide
   * > halten ihren Stand für den Standard.
   *
   * Die Bedingung `layoutAktiv()` bleibt: in der DealPilot-Ansicht ('')
   * gibt es keine Schiene, dort darf kein Kartenstil hängen (v1949). */
  function effektiv() {
    if (gewaehlt !== null) return gewaehlt;
    /* v2178: ohne Layout (DealPilot) ist der Standard die Kennzahlen-Karte -
       Marcel am 13.10.2026; ihre CSS ohne Layout steht seit v2114. */
    /* v2216c · Marcel 14.10.2026: „unter Anzeige … ist der Auslieferungszustand
       immer Aktenmappe mit Boardkarte." Damit gilt wieder v1915 statt v2083a
       (Datenzeile). Das Onboarding setzt dasselbe (onboarding.js). */
    /* v3235: die Kennzahlen-Karte ist raus - ohne eigene Wahl gilt ueberall die Bordkarte. */
    return RUECKFALL;
  }

  /* Eine eigene Wahl. Sie wird gemerkt UND angewandt.
     v3235: ein unbekannter Stil (auch '' = Aktenreiter, ampel, kennzahlen, minimal) ist keine
     Wahl mehr - der Merker wird geraeumt, und es gilt der Rueckfall. */
  function setze(stil) {
    if (bekannt(stil)) {
      gewaehlt = stil;
      try { localStorage.setItem(LS, gewaehlt); } catch (e) {}
    } else {
      gewaehlt = null;
      try { localStorage.removeItem(LS); } catch (e) {}
    }
    anwenden();
  }

  /* ── v2083a · SETZEN OHNE ZU MERKEN ──────────────────────────────────
   *
   * Fuer eine Vorschau (Backlog N60.21 Teil 2). `setze()` schreibt immer
   * in den Speicher — und ein iframe teilt den Speicher mit der
   * Hauptseite, weil er dieselbe Herkunft hat. Eine Vorschau ueber
   * `setze()` wuerde also die echte Einstellung des Nutzers
   * ueberschreiben, und zwar genau dann, wenn er nur schauen wollte.
   *
   * `zeige()` setzt das Attribut und laesst den Speicher in Ruhe;
   * `zurueck()` stellt den gemerkten Stand wieder her. */
  function zeige(stil) {
    var s = bekannt(stil) ? stil : RUECKFALL;   /* v3235: war '' (Aktenreiter) */
    var h = document.documentElement;
    if (s) h.setAttribute(ATTR, s); else h.removeAttribute(ATTR);
    aktuell = s;
  }
  function zurueck() { anwenden(); }

  /* Das Attribut ans <html> — ohne Layout-Bedingung (v1949). */
  function anwenden() {
    aktuell = effektiv();
    var h = document.documentElement;
    if (aktuell) h.setAttribute(ATTR, aktuell);
    else h.removeAttribute(ATTR);
    wahlNachziehen();
  }

  /* ── Die Wahl in den Einstellungen ─────────────────────────────────
     Gebaut wird in `#dp-objkarte-wahl-host`, den `settings.js` im
     Abschnitt „Aussehen" anlegt — genau wie bei der Layout-Wahl (v1697).
     Die Farben stehen im CSS, nicht hier: eine Marke, die im JS klebt,
     färbt sich beim Mandanten nicht um. */
  function baueWahl() {
    hosts().forEach(function (host) {
    if (!host || host.getAttribute('data-gebaut') === '1') return;
    host.setAttribute('data-gebaut', '1');
    host.innerHTML =
      '<div class="dp-okw-box">' +
        '<div class="dp-okw-kopf">Objektkarten in der Liste</div>' +
        '<div class="dp-okw-gitter">' +
          Object.keys(STILE).map(function (k) {
            return '<button type="button" class="dp-okw" data-ok="' + k + '">' +
                     '<span class="dp-okw-n">' + STILE[k].name + '</span>' +
                     '<span class="dp-okw-s">' + STILE[k].sub + '</span>' +
                   '</button>';
          }).join('') +
        '</div>' +
        /* v1949: der Fusstext sagte "Wirkt in der Aktenmappe - die
           normale Ansicht bleibt, wie sie ist." Das stimmte, war aber
           genau der Defekt. Ein Hinweis, der einen Fehler beschreibt,
           laesst ihn wie eine Absicht aussehen. */
        /* v3235: hier stand „Ohne eigene Wahl zeigt die Ansicht DealPilot die
           Kennzahlen-Karte.“ - beide gibt es nicht mehr. */
        '<div class="dp-okw-fuss">Wirkt in allen Ansichten. Ohne eigene ' +
        'Wahl gilt die Bordkarte.' +
        '</div>' +
      '</div>';
    host.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dp-okw') : null;
      if (!b) return;
      setze(b.getAttribute('data-ok'));
    });
    });
    wahlNachziehen();
  }

  function wahlNachziehen() {
    hosts().forEach(function (host) {
      host.querySelectorAll('.dp-okw').forEach(function (b) {
        b.classList.toggle('an', b.getAttribute('data-ok') === aktuell);
      });
    });
  }

  /* Der Abschnitt „Aussehen" wird erst beim Öffnen der Einstellungen
     gebaut. Ein Beobachter hängt die Wahl ein, sobald der Host da ist -
     ein Timer würde raten, wann das ist. */
  function hostBeobachten() {
    if (hosts().length) baueWahl();
    if (!window.MutationObserver) return;
    new MutationObserver(function () {
      if (hosts().length) baueWahl();
    }).observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    var p = new URLSearchParams(location.search);
    var ausUrl = p.get('objkarte');
    var gemerkt = '';
    try { gemerkt = localStorage.getItem(LS) || ''; } catch (e) {}

    /* ── v1915 · OHNE EIGENE WAHL GILT DIE BORDKARTE ──────────────────────
       Marcel am 06.10.2026: „die Aktenmappe würde ich erst mal standardmäßig
       mit der Bordkarte anzeigen.“

       Der Ruecfall war '' (Aktenreiter). Geprueft wird auf ABWESENHEIT des
       Schluessels, nicht auf seinen Wahrheitswert: wer sich bewusst fuer den
       Aktenreiter entscheidet, speichert '' — und `gemerkt || 'bordkarte'`
       haette ihm die Bordkarte zurueckgegeben, Wahl hin oder her.

       Das Attribut wird ohnehin nur bei aktivem Layout gesetzt (siehe `setze`),
       die normale Ansicht „Heute“ bleibt also unberuehrt. */
    var hatMerker = false;
    try { hatMerker = localStorage.getItem(LS) !== null; } catch (e) {}

    /* v1949: ohne Merker wird NICHTS gewaehlt - gewaehlt bleibt null, und
       effektiv() entscheidet je Ansicht. Vorher stand hier
       setze("bordkarte"), was den Rueckfall sofort als eigene Wahl in den
       Speicher schrieb; danach war er nicht mehr von einer echten
       Entscheidung zu unterscheiden. */
    /* v3235: ein gemerkter Stil, den es nicht mehr gibt ('' Aktenreiter, ampel, kennzahlen,
       minimal), wird geraeumt - dann gilt der Rueckfall Bordkarte. */
    if (ausUrl !== null) setze(ausUrl === 'aus' ? '' : ausUrl);
    else if (hatMerker && bekannt(gemerkt)) { gewaehlt = gemerkt; anwenden(); }
    else {
      if (hatMerker) { try { localStorage.removeItem(LS); } catch (e) {} }
      anwenden();
    }

    /* v1715: der Merker des alten Schwebefensters wird abgeräumt. Wer ihn
       noch trägt, bekäme sonst nie etwas zu sehen und wüsste nicht,
       warum - das Fenster gibt es nicht mehr. */
    try { localStorage.removeItem('dp_objkarte_schalter'); } catch (e) {}
    try {
      var alt = document.getElementById('dp-ok-schalter');
      if (alt) alt.remove();
    } catch (e) {}

    hostBeobachten();

    /* Wechselt das Layout, wird neu entschieden: ohne Layout keine
       Schiene, und dann darf das Attribut nicht stehen bleiben. */
    if (window.MutationObserver) {
      new MutationObserver(function () { anwenden(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-dp-layout'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotObjektkarte = {
    setze: setze,
    stile: STILE,
    aktuell: function () { return aktuell; },
    /* v1949: ein Pruefer soll die ECHTE Entscheidung lesen koennen,
       nicht nur das Ergebnis. */
    gewaehlt: function () { return gewaehlt; },
    anwenden: anwenden,
    /* v2083a: fuer eine Vorschau, die den Speicher nicht anfasst. */
    zeige: zeige,
    zurueck: zurueck
  };
})();
