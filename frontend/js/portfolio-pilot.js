/* ═══════════════════════════════════════════════════════════════════════
   PORTFOLIO-PILOT · v1704
   ═══════════════════════════════════════════════════════════════════════
   Marcels Auftrag vom 29.09.2026:

     „im Portfolio Cockpit auch einen Piloten ... eine Pilot Analyse die
      das gesamte Portfolio analysiert und wo ich auch fragen stellen
      kann. das ist quasi der allwissende der mir zu jeder immobilie aber
      auch zur Vermoegensbilanz des gesamten Portfolios fragen beantworten
      kann. auch hier wieder mit und ohne web Recherche."

   DREI ENTSCHEIDUNGEN, DIE ERKLAERT GEHOEREN
   ──────────────────────────────────────────

   1 · ER RECHNET NICHTS NACH.
       Die Zahlen kommen aus `DealPilotDashboard.portfolioPayload()`, und
       das liest `aggStats()`, `projectAll()` und `aggregateScore()` - die
       Stellen, an denen das Cockpit sie ohnehin ausrechnet.

       > Eine zweite Aggregation waere eine zweite Wahrheit. Das Cockpit
       > hat davon schon drei, und sie laufen bereits auseinander.

   2 · DIE ANALYSE IST FLIESSTEXT, KEIN JSON.
       Die Einzelobjekt-Analyse fordert ein JSON mit rund dreissig
       Feldern - und ist genau daran heute reihenweise gescheitert
       (v1701: das Modell fragte zurueck, statt zu antworten). Ein
       Portfolio-Prompt ist laenger, nicht kuerzer.

       > Ein Format, das scheitern kann, wird gewaehlt, wenn es etwas
       > bringt. Hier bringt es nichts: der Text wird gelesen, nicht
       > weiterverrechnet.

       Deshalb laeuft beides - Analyse und Rueckfragen - ueber
       `/ai/copilot`. Der Endpunkt ist nicht ans Einzelobjekt gebunden
       (`routes/ai.js:1545` schlaegt kein Objekt nach); `help.js` faehrt
       dort seit Langem einen voellig anderen Kontext.

   3 · DIE ANALYSE IST DER ERSTE ZUG DES GESPRAECHS.
       Sie landet in derselben `history` wie jede Frage danach. Wer
       anschliessend „und welches Objekt zieht den Schnitt runter?"
       fragt, fragt weiter - nicht neu.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__dpPortfolioPilot) return;
  window.__dpPortfolioPilot = true;

  var HOST = 'dashboard-main';
  var laeuft = false;
  var allowWeb = false;
  var history = [];

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var PLANE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.7.7 0 0 0-.7 1.1l5.2 4.3-2.6 2.6-2.3-.5a.6.6 0 0 0-.6 1l2 2.3 2.3 2a.6.6 0 0 0 1-.6l-.5-2.3 2.6-2.6 4.3 5.2a.7.7 0 0 0 1.1-.7Z"/></svg>';

  /* ── v1705d · Schnellfragen ────────────────────────────────────────
     Vier Fragen, die das Portfolio wirklich beantworten KANN - die
     Daten dafuer stehen im Payload (Cashflow je Objekt, Zinsbindung,
     Projektion, Kennzahlen je Objekt).

     > Eine Schnellfrage, deren Antwort nicht in den Daten steht, ist
     > eine Einladung zum Erfinden. Deshalb steht hier nichts zu
     > Marktpreisen oder Standorten - dafuer braucht es die
     > Web-Recherche, und die schaltet der Nutzer selbst ein. */
  var FRAGEN = [
    { kurz: 'Wer belastet den Cashflow?',
      lang: 'Welche meiner Objekte belasten den Cashflow, welche tragen ihn? '
          + 'Nenne sie mit Namen und Zahl, sortiert vom schlechtesten zum besten.' },
    { kurz: 'Zinsbindungen',
      lang: 'Wo läuft als Nächstes eine Zinsbindung aus, und welche Restschuld hängt jeweils daran? '
          + 'Sag mir, worauf ich mich einstellen muss. Steht bei einem Objekt keine Zinsbindung in den Daten, sag das.' },
    { kurz: 'Eigenkapital in 10 Jahren',
      lang: 'Wie entwickelt sich mein Eigenkapital über die nächsten zehn Jahre? '
          + 'Nimm die Projektion und sag klar dazu, welche Annahmen darin stecken.' },
    { kurz: 'Klumpenrisiken',
      lang: 'Welche Klumpenrisiken habe ich - Lage, Objektart, Finanzierung, einzelne Objekte mit zu viel Gewicht? '
          + 'Miss das an meiner Gesamtinvestition und nenne Prozentwerte.' }
  ];

  /* ── Aufbau ──────────────────────────────────────────────────────── */
  function mount() {
    var host = el(HOST);
    if (!host || el('dp-pp')) return;
    /* Das Cockpit-Markup baut `ensureMarkup()`; erst danach gibt es
       `#dp-stage`. Ohne die Buehne haengen wir an den Behaelter selbst -
       dann steht der Pilot zwar unten, aber er steht. */
    /* v2951 · Marcel: „dort, wo die Auswertung steht, den Portfolio-Piloten
       hinpacken" - das Cockpit legt dafuer #dp-pp-slot hinter Bestand & Zielbild an. */
    var ziel = host.querySelector('#dp-pp-slot') || host.querySelector('#dp-stage') || host;

    var box = document.createElement('section');
    box.id = 'dp-pp';
    box.className = 'dp-pp';
    box.innerHTML =
      '<div class="dp-pp-head">' +
        '<span class="dp-pp-ic">' + PLANE + '</span>' +
        '<div class="dp-pp-tt">' +
          '<span class="dp-pp-t">Portfolio-Pilot</span>' +
          '<span class="dp-pp-s">Analyse über alle Objekte — und Fragen zu jedem einzelnen</span>' +
        '</div>' +
        '<label class="dp-pp-web" title="Erlaubt dem Portfolio-Piloten, für aktuelle Marktdaten im Web zu recherchieren">' +
          '<input type="checkbox" id="dp-pp-web"><span>Web-Recherche</span></label>' +
        '<button type="button" class="dp-pp-go dp-pp-zb" id="dp-pp-zb">Bestand &amp; Zielbild erklären</button>' +
        '<button type="button" class="dp-pp-go" id="dp-pp-go">Portfolio-Analyse starten</button>' +
      '</div>' +
      /* v2951 · was ein Lauf kostet, VOR dem Klick: /ai/copilot zieht kein Kontingent,
         zaehlt aber zum Tageslimit des Co-Piloten (routes/ai.js COPILOT_PLAN_LIMITS). */
      '<div class="dp-pp-kosten">KI-Text · kostet <b>kein Kontingent</b>, zählt zum Tageslimit des Co-Piloten (je nach Tarif 10 bis 300 Antworten am Tag). Der Pilot rechnet nicht selbst – er erklärt die Zahlen des Cockpits; jede Betrags- und Prozentangabe wird danach gegen diese Zahlen geprüft.</div>' +
      /* v2018 - der Stand der letzten Analyse. Wird nach dem Aufbau
         gefuellt (standZeigen); leer ist er unsichtbar. */
      '<div class="dp-pp-stand" id="dp-pp-stand" style="display:none"></div>' +
      '<div class="dp-pp-log" id="dp-pp-log">' +
        '<div class="dp-pp-hint">Ich kenne deine Vermögensbilanz — Gesamtinvestition, Eigenkapital, Restschuld, ' +
        'Cashflow und die Entwicklung der nächsten zehn Jahre — und jedes einzelne Objekt darin. ' +
        'Starte die Analyse oder frag direkt.</div>' +
      '</div>' +
      /* v1705d: Schnellfragen. Ein leeres Eingabefeld ist eine Huerde -
         wer nicht weiss, was das Werkzeug kann, fragt es nicht. Die vier
         Fragen sind die, die das Portfolio wirklich beantworten kann,
         weil die Daten dafuer im Payload stehen: Cashflow je Objekt,
         Zinsbindung, Projektion, Klumpen. */
      '<div class="dp-pp-chips" id="dp-pp-chips">' +
        FRAGEN.map(function (f, i) {
          return '<button type="button" class="dp-pp-chip" data-frage="' + i + '">' + esc(f.kurz) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="dp-pp-bar">' +
        '<textarea id="dp-pp-in" class="dp-pp-in" rows="1" placeholder="Frage zum Portfolio oder zu einem Objekt…"></textarea>' +
        '<button id="dp-pp-send" class="dp-pp-send" type="button">Senden</button>' +
      '</div>';
    ziel.appendChild(box);
    /* v2018 - die Standzeile fuellen, sobald das Markup steht. */
    try { standZeigen(); } catch (e) {}

    var w = el('dp-pp-web');
    if (w) w.addEventListener('change', function () { allowWeb = this.checked; });
    var g = el('dp-pp-go');
    if (g) g.addEventListener('click', analyse);
    var zb = el('dp-pp-zb');
    if (zb) zb.addEventListener('click', zielbildErklaeren);   /* v2951 */
    /* Ein Horcher am Behaelter statt vier an den Knoepfen - die Chips
       werden nie neu gebaut, aber ein Horcher je Knopf waere trotzdem
       vier Stellen, an denen man einen vergessen kann. */
    var ch = el('dp-pp-chips');
    if (ch) ch.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dp-pp-chip') : null;
      if (!b) return;
      var f = FRAGEN[+b.getAttribute('data-frage')];
      if (f) senden(f.lang, f.kurz);
    });
    var s = el('dp-pp-send');
    if (s) s.addEventListener('click', function () { frage(); });
    var i = el('dp-pp-in');
    if (i) i.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); frage(); }
    });
  }

  function addMsg(role, text) {
    var log = el('dp-pp-log');
    if (!log) return null;
    var hint = log.querySelector('.dp-pp-hint');
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    var d = document.createElement('div');
    d.className = 'dp-pp-msg dp-pp-' + (role === 'assistant' ? 'a' : 'u');
    /* v2304 · die Antwort kommt mit **fett** - gemessen im Video (Modul 21) standen die Sternchen roh da.
       Erst escapen, dann nur dieses eine Muster wandeln. */
    d.innerHTML = esc(text).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  /* v1762: copilot-aenderungen.js schreibt in denselben Verlauf. Es faengt
     Saetze ab, die eine Aenderung an EINEM Objekt beschreiben, sucht das
     Objekt in der Seitenliste, oeffnet es und zeigt die Rueckfrage hier.
     Nur diese eine Funktion geht nach aussen; senden() bleibt intern. */
  window.__dpPpAddMsg = addMsg;

  /* ── Der Kontext ─────────────────────────────────────────────────── */
  function kontext() {
    try {
      if (window.DealPilotDashboard && typeof window.DealPilotDashboard.portfolioPayload === 'function') {
        return window.DealPilotDashboard.portfolioPayload();
      }
    } catch (e) {}
    return null;
  }

  function userKeyExtra() {
    var extra = {};
    try {
      if (typeof Settings !== 'undefined') {
        var s = Settings.get();
        if (s && s.openai_api_key && s.openai_api_key.indexOf('sk-') === 0) extra.userApiKey = s.openai_api_key.trim();
      }
    } catch (e) {}
    return extra;
  }

  /* ── Der gemeinsame Weg ──────────────────────────────────────────── */
  /* v2012 - `istAnalyse`: nur die ANALYSE wird abgelegt, nicht jede
     Rueckfrage. Eine Rueckfrage beantwortet einen Ausschnitt, und ein
     Ausschnitt, der spaeter als "die Analyse" gelesen wird, ist
     schlimmer als keine. */
  /* v2170: erst die Objekte frisch laden (DealPilotDashboard.frisch), dann
     senden - sonst rechnet der Pilot mit dem Stand vom Seitenaufruf. */
  function senden(nachricht, sichtbar, istAnalyse, opts) {
    if (laeuft) return;
    var D = window.DealPilotDashboard;
    var p = (D && typeof D.frisch === 'function') ? D.frisch() : null;
    Promise.resolve(p).catch(function () {}).then(function () { _senden(nachricht, sichtbar, istAnalyse, opts); });
  }
  function _senden(nachricht, sichtbar, istAnalyse, opts) {
    if (laeuft) return;
    var ctx = kontext();

    /* Ohne Daten keine Analyse. Ein Pilot, der ueber ein leeres Portfolio
       spricht, erfindet - und das faellt erst auf, wenn jemand die Zahlen
       nachschlaegt. */
    if (!ctx || !ctx.anzahl_objekte) {
      addMsg('assistant', 'Ich sehe noch keine abgeschlossenen Objekte in deinem Portfolio. '
        + 'Der Portfolio-Pilot arbeitet mit den Objekten, die als gewonnen markiert sind — '
        + 'sobald dort eines steht, kann ich rechnen.');
      return;
    }

    laeuft = true;
    var gknopf = el('dp-pp-go'), sknopf = el('dp-pp-send'), zknopf = el('dp-pp-zb');
    if (zknopf) zknopf.disabled = true;
    if (gknopf) gknopf.disabled = true;
    if (sknopf) sknopf.disabled = true;

    if (sichtbar) { addMsg('user', sichtbar); }
    var denkt = addMsg('assistant', '…');
    if (denkt) denkt.classList.add('dp-pp-think');

    var body = Object.assign({
      message: nachricht,
      history: history.slice(-12),
      context: ctx,
      /* v1704: der Diskriminator. `copilotChat` beschriftet den Kontext
         danach - ohne ihn stuende „AKTUELLES OBJEKT" ueber einer
         Vermoegensbilanz, und das Modell antwortet auf die Ueberschrift. */
      kontextArt: 'portfolio',
      allowWeb: allowWeb
    }, userKeyExtra());

    history.push({ role: 'user', content: sichtbar || nachricht });

    /* v1767: DER KATALOG GEHT IMMER MIT.

       Bis v1766 stand hier „nur, wenn ein Objekt offen ist" — mit der
       Begruendung, es gaebe sonst kein Ziel. Das war falsch gedacht:
       `window.FIELDS` ist STATISCH, die Feld-Ids sind bei jedem Objekt
       dieselben. Verschieden sind nur die Werte. Und welches Objekt
       gemeint ist, sagt Marcels Satz („aender bei der Musterstr. 12 ...")
       — `objektZuordnen()` oeffnet es, bevor etwas gesetzt wird.

       > Eine Bedingung, die eine Faehigkeit abschaltet, muss den Grund
       > messen. „Es gaebe kein Ziel" war eine Annahme, und sie hat den
       > Portfolio-Piloten im haeufigsten Fall stumm gemacht. */
    try {
      if (window.DealPilotCopilotAenderungen
          && typeof window.DealPilotCopilotAenderungen.katalog === 'function') {
        body.felder = window.DealPilotCopilotAenderungen.katalog();
        if (typeof window.DealPilotCopilotAenderungen.abrufe === 'function') {
          body.abrufe = window.DealPilotCopilotAenderungen.abrufe();
        }
      }
    } catch (e) {}

    /* v1769 · DIE MARKTBERICHTE DES GANZEN BESTANDS REISEN MIT (V6).
       EIN Abruf fuer alle Objekte (/objects/history ohne ref), je Objekt
       der juengste Bericht. Aus dem Zwischenspeicher. */
    try {
      if (window.DealPilotPilotBerichte
          && typeof window.DealPilotPilotBerichte.standBestand === 'function') {
        var _mbb = window.DealPilotPilotBerichte.standBestand();
        if (_mbb) body.marktberichte = _mbb;
      }
    } catch (e) {}

    Auth.apiCall('/ai/copilot', { method: 'POST', body: body }).then(function (data) {
      if (denkt && denkt.parentNode) denkt.parentNode.removeChild(denkt);
      var reply = (data && data.reply) ? data.reply : 'Keine Antwort erhalten.';
      try {
        if (window.DealPilotCopilotAenderungen
            && typeof window.DealPilotCopilotAenderungen.ausAntwort === 'function') {
          /* v1767: der Nutzersatz entscheidet, WELCHES Objekt gemeint ist. */
          reply = window.DealPilotCopilotAenderungen.ausAntwort(
            reply, addMsg, sichtbar || nachricht);
        }
      } catch (e) {}
      if (reply) addMsg('assistant', reply);
      history.push({ role: 'assistant', content: reply });
      /* v2951 · Zahlenpruefung gegen die mitgegebenen Zahlen (Vorbild lib/ki_text_pruefung.js) */
      if (opts && opts.pruefen && reply) { try { var pr = zahlenPruefen(reply, ctx); window.__dpPpPruefung = pr; pruefungZeigen(pr); } catch (e) {} }
      /* v2012 - die ANALYSE (nicht jede Rueckfrage) wird abgelegt,
         damit der Telegram-Bot sie abrufen kann. Marcel: "Das Abrufen
         der Co-Pilot-Analyse muss aus Telegram moeglich sein."
         Still wie der Portfolio-Spiegel: ein Fehler hier darf dem
         Nutzer nichts anzeigen, die Analyse steht ja vor ihm. */
      if (istAnalyse) {
        try { analyseAblegen(reply, ctx); } catch (e) {}
        /* v2018 - die Standzeile zeigt sonst noch den alten Lauf. */
        setTimeout(function () { try { standZeigen(); } catch (e) {} }, 1200);
      }
    }).catch(function (err) {
      if (denkt && denkt.parentNode) denkt.parentNode.removeChild(denkt);
      var m = (err && err.data && (err.data.message || err.data.error)) || (err && err.message) || 'Fehler';
      if (err && err.status === 429) m = 'Tageslimit erreicht. Morgen wieder verfügbar.';
      if (err && err.status === 503) m = 'KI ist gerade nicht verfügbar (kein Server-Key).';
      addMsg('assistant', '⚠ ' + m);
    }).then(function () {
      laeuft = false;
      var a = el('dp-pp-go'), b = el('dp-pp-send'), zb2 = el('dp-pp-zb');
      if (zb2) zb2.disabled = false;
      if (a) a.disabled = false;
      if (b) b.disabled = false;
    });
  }

  /* ── Die Analyse ─────────────────────────────────────────────────── */
  var ANALYSE_AUFTRAG = [
    'Analysiere mein GESAMTES Portfolio. Gliedere so:',
    '',
    '1. Vermögensbilanz heute - was steckt drin, was gehört mir davon, was ist Fremdkapital.',
    '2. Ertragslage - Mieteinnahmen, Cashflow vor und nach Steuer, Renditen, Kapitaldienstdeckung.',
    '3. Die einzelnen Objekte - welche tragen, welche belasten. Nenne sie beim Namen und mit Zahl.',
    '4. Klumpenrisiken - Lage, Objektart, Finanzierung, auslaufende Zinsbindungen.',
    '5. Entwicklung - was die Projektion über Restschuld und Eigenkapital sagt.',
    '6. Was ich als Nächstes tun sollte - drei konkrete Schritte, priorisiert.',
    '',
    'Rechne mit den gegebenen Zahlen. Erfinde nichts. Fehlt etwas, sag es.'
  ].join('\n');

  /* v2012 - ABLAGE DER COCKPIT-ANALYSE ───────────────────────────

     Gespeichert wird nur die ANALYSE, nicht jede Rueckfrage: eine
     Rueckfrage beantwortet einen Ausschnitt, und ein Ausschnitt, der
     spaeter als "die Analyse" gelesen wird, ist schlimmer als keine.

     Mitgegeben wird der STAND und woraus sie entstand - sonst steht
     beim Abrufen ein Text ohne Datum und ohne Umfang da. */
  var ANALYSE_MAX = 60000;
  function analyseAblegen(text, ctx) {
    if (!text || typeof text !== 'string') return;
    var t = text.length > ANALYSE_MAX ? (text.slice(0, ANALYSE_MAX) + "\n[gekuerzt]") : text;
    var wert = {
      text: t,
      stand: new Date().toISOString(),
      anzahl_objekte: (ctx && ctx.anzahl_objekte) != null ? ctx.anzahl_objekte : null,
      objekte_im_payload: (ctx && ctx.objekte_im_payload) != null ? ctx.objekte_im_payload : null,
      portfolio_score: (ctx && ctx.portfolio_score) != null ? ctx.portfolio_score : null,
      stand_der_zahlen: (ctx && ctx.stand) || null
    };
    Auth.apiCall('/user-settings/portfolio_analyse', { method: 'PUT', body: { wert: wert } })
      .then(function () { try { console.debug('[pp] Analyse abgelegt'); } catch (e) {} })
      .catch(function () { /* still - die Analyse steht ja vor dem Nutzer */ });
  }

  /* ══ v2018 · WANN LIEF DIE LETZTE ANALYSE, UND GILT SIE NOCH ═════

     Beim Portfolio ist nicht die ZEIT der Massstab, sondern ob sich
     der BESTAND geaendert hat. Drei Wochen ohne Zukauf sind
     belanglos; ein Zukauf von gestern macht jede Aussage ueber
     Klumpenrisiken ungueltig.

     Dieselbe Haltung wie bei der Pilot-Analyse (v2017): gemessen
     wird, woran die Aussage haengt - nicht das naechstliegende
     Datum. */
  function standZeigen() {
    var host = el('dp-pp-stand'); if (!host) return;
    Auth.apiCall('/user-settings/portfolio_analyse').then(function (r) {
      var w = r && r.wert;
      if (!w || !w.text) { host.style.display = 'none'; return; }
      var d = new Date(w.stand || r.updated_at);
      if (isNaN(d)) { host.style.display = 'none'; return; }
      var tage = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
      var wann = tage === 0 ? 'heute' : (tage === 1 ? 'gestern' : 'vor ' + tage + ' Tagen');
      var jetzt = null;
      try { var c = kontext(); jetzt = c && c.anzahl_objekte != null ? c.anzahl_objekte : null; } catch (e) {}
      var damals = w.anzahl_objekte != null ? w.anzahl_objekte : null;
      var txt = 'Letzte Portfolio-Analyse: <b>' + d.toLocaleDateString('de-DE') + '</b> (' + wann + ')'
              + (damals != null ? ', ' + damals + ' Objekte' : '');
      var klasse = 'ok';
      if (damals != null && jetzt != null && damals !== jetzt) {
        klasse = 'alt';
        txt += ' \u2014 inzwischen sind es <b>' + jetzt + '</b>. Die Aussagen zu Klumpenrisiken '
             + 'und Bilanz k\u00f6nnen \u00fcberholt sein \u2014 neu starten.';
      }
      host.className = 'dp-pp-stand dp-pp-stand-' + klasse;
      host.innerHTML = txt;
      host.style.display = '';
    }).catch(function () { host.style.display = 'none'; });
  }

  /* ── v2951 · BESTAND & ZIELBILD ERKLAEREN ───────────────────────────
     Marcel 25.10.2026: „dass der die Auswertung für Bestand und Zielbild neu
     macht, aber auch eine ausführliche Beschreibung dazu". Die Zahlen stehen
     fertig im Kontext (context.bestand_zielbild, DealPilotDashboard
     ._zbPayload) - der Pilot erklaert, er rechnet nicht. */
  var AUFTRAG_ZB = [
    'Erkläre mir die Auswertung BESTAND & ZIELBILD meines Portfolios ausführlich und verständlich.',
    'Grundlage ist ausschließlich context.bestand_zielbild (inklusive gesamtbewertung). Alle Summen, Differenzen und Prozente stehen dort FERTIG - übernimm sie wörtlich, rechne NICHT selbst und runde nicht anders.',
    'Gliedere so:',
    '1. Was verglichen wird - Bestand, Mieterhöhung, Zielbild, und über wie viele Objekte (mit/ohne Zielbild, ohne Angaben). Nenne jedes nicht enthaltene Objekt mit seinem Grund.',
    '2. Die Miete - von Bestand über Mieterhöhung zum Zielbild, mit den Beträgen und dem Prozentwert; warum die Miete laut Objektdaten (kaltmiete_laut_objektdaten_derselben_objekte) davon abweicht.',
    '3. Maßnahmen und Rendite - Kosten der Maßnahmen und die Bruttomietrendite vorher/nachher.',
    '4. Der Wert - Ertragswert Bestand, Zielbild, nach Kosten, Wertzuwachs nach Kosten; und wie sich der Ertragswert Bestand zu den Kaufpreisen DERSELBEN Objekte verhält.',
    '5. Die Objekte einzeln - welches trägt am meisten bei, wo kosten die Maßnahmen mehr, als sie an Wert bringen (mit Namen und Zahlen aus je_objekt).',
    '6. Wie das zur Gesamtinvestition und zur Vermögensbilanz passt - Kaufpreise, Nebenkosten, Gesamtinvestition, Objektwerte, Restschuld, Eigenkapital (gesamtbewertung) - und warum die Mengen verschieden sind.',
    '7. Was ich tun sollte - welche Läufe veraltet sind (laeufe_stand), welche Objekte ergänzt werden sollten, und wie neu gerechnet wird (neu_rechnen).',
    'Schließe mit dem Satz aus kennzeichnung. Keine Markdown-Überschriften, Zwischenzeilen mit Nummer sind gut.'
  ].join('\n');
  function zielbildErklaeren() {
    history = [];
    var log = el('dp-pp-log');
    if (log) log.innerHTML = '';
    senden(AUFTRAG_ZB, 'Bestand & Zielbild erklären', false, { pruefen: true });
  }

  /* Zahlenpruefung: jede Betrags- (€, Mio) und Prozentangabe im Text muss
     einer Zahl im mitgegebenen Kontext entsprechen (Rundung: 0,6 % bzw. 1 €,
     Prozent 0,1 Punkte). Was nicht passt, wird genannt - nicht gestrichen. */
  function _zahlenAus(o, out) {
    if (o == null) return out;
    if (typeof o === 'number' && isFinite(o)) { out.push(o); return out; }
    if (Array.isArray(o)) { o.forEach(function (x) { _zahlenAus(x, out); }); return out; }
    if (typeof o === 'object') { Object.keys(o).forEach(function (k) { _zahlenAus(o[k], out); }); }
    return out;
  }
  function zahlenPruefen(text, ctx) {
    var bekannt = _zahlenAus(ctx, []);
    var re = /([+\u2212\-]?\s?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+\u2212\-]?\s?\d+(?:,\d+)?)\s?(Mio\.?\s?(?:€|Euro)|€|Euro|%|Prozent)/g;
    var m, gepr = [], fehl = [];
    while ((m = re.exec(text))) {
      var roh = m[1].replace(/\s/g, '').replace('\u2212', '-');
      var v = parseFloat(roh.replace(/\./g, '').replace(',', '.'));
      if (!isFinite(v)) continue;
      var einh = m[2];
      var istP = /%|Prozent/.test(einh);
      if (/Mio/.test(einh)) v = v * 1e6;
      var a = Math.abs(v);
      var ok = bekannt.some(function (c) {
        var b = Math.abs(c);
        if (istP) return Math.abs(a - b) <= 0.1 + 1e-9;
        return Math.abs(a - b) <= Math.max(1, b * (/Mio/.test(einh) ? 0.006 : 0.0005));
      });
      if (!istP && a < 100) ok = true;   /* Kleinbeträge (€/m²) nicht werten */
      gepr.push(m[0]);
      if (!ok) fehl.push(m[0].trim());
    }
    return { geprueft: gepr.length, gefunden: gepr.length - fehl.length, nicht_gefunden: fehl };
  }
  function pruefungZeigen(pr) {
    var log = el('dp-pp-log'); if (!log || !pr) return;
    var d = document.createElement('div');
    d.className = 'dp-pp-pruef' + (pr.nicht_gefunden.length ? ' dp-pp-pruef-warn' : '');
    d.innerHTML = '<b>Zahlenprüfung:</b> ' + pr.gefunden + ' von ' + pr.geprueft + ' Beträgen und Prozenten stehen so in den Zahlen des Cockpits.'
      + (pr.nicht_gefunden.length ? ' Nicht gefunden: ' + esc(pr.nicht_gefunden.slice(0, 8).join(' · ')) + ' – diese Angaben bitte gegen die Tabellen oben prüfen.' : '');
    log.appendChild(d);
  }

  function analyse() {
    history = [];
    var log = el('dp-pp-log');
    if (log) log.innerHTML = '';
    senden(ANALYSE_AUFTRAG, 'Portfolio-Analyse starten', true);   /* v2012 */
  }

  function frage() {
    var i = el('dp-pp-in');
    var t = (i && i.value || '').trim();
    if (!t) return;
    if (i) i.value = '';
    senden(t, t);
  }

  /* ── Einhaengen ──────────────────────────────────────────────────── */
  /* Das Cockpit baut sein Markup erst beim Oeffnen (`ensureMarkup`), und
     es gibt kein Ereignis dafuer. Ein Beobachter auf den Behaelter ist
     hier ehrlicher als ein Timer: er feuert, wenn die Buehne wirklich
     dasteht, und nicht, wenn wir raten, dass sie es tut. */
  function beobachten() {
    var host = el(HOST);
    if (!host) return;
    if (host.getAttribute('data-dp-built') === '1') mount();
    if (!window.MutationObserver) return;
    new MutationObserver(function () {
      if (host.getAttribute('data-dp-built') === '1') mount();
    }).observe(host, { attributes: true, attributeFilter: ['data-dp-built'], childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachten);
  else beobachten();

  window.DealPilotPortfolioPilot = { mount: mount, analyse: analyse, _kontext: kontext,
    zielbildErklaeren: zielbildErklaeren, _zahlenPruefen: zahlenPruefen };   /* v2951 */
})();
