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
      lang: 'Wo laeuft als Naechstes eine Zinsbindung aus, und welche Restschuld haengt jeweils daran? '
          + 'Sag mir, worauf ich mich einstellen muss. Steht bei einem Objekt keine Zinsbindung in den Daten, sag das.' },
    { kurz: 'Eigenkapital in 10 Jahren',
      lang: 'Wie entwickelt sich mein Eigenkapital ueber die naechsten zehn Jahre? '
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
    var ziel = host.querySelector('#dp-stage') || host;

    var box = document.createElement('section');
    box.id = 'dp-pp';
    box.className = 'dp-pp';
    box.innerHTML =
      '<div class="dp-pp-head">' +
        '<span class="dp-pp-ic">' + PLANE + '</span>' +
        '<div class="dp-pp-tt">' +
          '<span class="dp-pp-t">Portfolio-Pilot</span>' +
          '<span class="dp-pp-s">Analyse ueber alle Objekte — und Fragen zu jedem einzelnen</span>' +
        '</div>' +
        '<label class="dp-pp-web" title="Erlaubt dem Portfolio-Piloten, fuer aktuelle Marktdaten im Web zu recherchieren">' +
          '<input type="checkbox" id="dp-pp-web"><span>Web-Recherche</span></label>' +
        '<button type="button" class="dp-pp-go" id="dp-pp-go">Portfolio-Analyse starten</button>' +
      '</div>' +
      '<div class="dp-pp-log" id="dp-pp-log">' +
        '<div class="dp-pp-hint">Ich kenne deine Vermoegensbilanz — Gesamtinvestition, Eigenkapital, Restschuld, ' +
        'Cashflow und die Entwicklung der naechsten zehn Jahre — und jedes einzelne Objekt darin. ' +
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

    var w = el('dp-pp-web');
    if (w) w.addEventListener('change', function () { allowWeb = this.checked; });
    var g = el('dp-pp-go');
    if (g) g.addEventListener('click', analyse);
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
    d.innerHTML = esc(text).replace(/\n/g, '<br>');
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
  function senden(nachricht, sichtbar) {
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
    var gknopf = el('dp-pp-go'), sknopf = el('dp-pp-send');
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

    Auth.apiCall('/ai/copilot', { method: 'POST', body: body }).then(function (data) {
      if (denkt && denkt.parentNode) denkt.parentNode.removeChild(denkt);
      var reply = (data && data.reply) ? data.reply : 'Keine Antwort erhalten.';
      addMsg('assistant', reply);
      history.push({ role: 'assistant', content: reply });
    }).catch(function (err) {
      if (denkt && denkt.parentNode) denkt.parentNode.removeChild(denkt);
      var m = (err && err.data && (err.data.message || err.data.error)) || (err && err.message) || 'Fehler';
      if (err && err.status === 429) m = 'Tageslimit erreicht. Morgen wieder verfuegbar.';
      if (err && err.status === 503) m = 'KI ist gerade nicht verfuegbar (kein Server-Key).';
      addMsg('assistant', '⚠ ' + m);
    }).then(function () {
      laeuft = false;
      var a = el('dp-pp-go'), b = el('dp-pp-send');
      if (a) a.disabled = false;
      if (b) b.disabled = false;
    });
  }

  /* ── Die Analyse ─────────────────────────────────────────────────── */
  var ANALYSE_AUFTRAG = [
    'Analysiere mein GESAMTES Portfolio. Gliedere so:',
    '',
    '1. Vermoegensbilanz heute - was steckt drin, was gehoert mir davon, was ist Fremdkapital.',
    '2. Ertragslage - Mieteinnahmen, Cashflow vor und nach Steuer, Renditen, Kapitaldienstdeckung.',
    '3. Die einzelnen Objekte - welche tragen, welche belasten. Nenne sie beim Namen und mit Zahl.',
    '4. Klumpenrisiken - Lage, Objektart, Finanzierung, auslaufende Zinsbindungen.',
    '5. Entwicklung - was die Projektion ueber Restschuld und Eigenkapital sagt.',
    '6. Was ich als Naechstes tun sollte - drei konkrete Schritte, priorisiert.',
    '',
    'Rechne mit den gegebenen Zahlen. Erfinde nichts. Fehlt etwas, sag es.'
  ].join('\n');

  function analyse() {
    history = [];
    var log = el('dp-pp-log');
    if (log) log.innerHTML = '';
    senden(ANALYSE_AUFTRAG, 'Portfolio-Analyse starten');
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

  window.DealPilotPortfolioPilot = { mount: mount, analyse: analyse, _kontext: kontext };
})();
