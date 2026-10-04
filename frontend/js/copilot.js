/* DealPilot Co-Pilot (v585) — leichter Chat-Agent im Pilot-Analyse-Tab.
   Arbeitet bevorzugt mit den Objektdaten (window._buildAIPayload). Web-Recherche
   nur wenn der Nutzer den Toggle aktiviert. KEIN Kerosin (server-seitig rate-limited). */
(function () {
  'use strict';
  if (window.__dpCopilot) return;
  window.__dpCopilot = true;

  var history = [];
  var allowWeb = false;
  var busy = false;

  var PLANE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>';

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  function mount() {
    var host = document.getElementById('s5');
    if (!host || document.getElementById('dp-cp')) return;
    var box = document.createElement('div');
    box.id = 'dp-cp';
    box.className = 'dp-cp';
    box.innerHTML =
      '<div class="dp-cp-head">' +
        '<span class="dp-cp-ic">' + PLANE + '</span>' +
        '<div class="dp-cp-tt"><span class="dp-cp-t">Co-Pilot</span><span class="dp-cp-s">KI-Assistent zu diesem Deal</span></div>' +
        /* v1178: die Pille sagt jetzt, was noch geht — Kerosin gibt es
           nicht mehr, und ein Kontingent, das man nicht sieht, ist genau
           die Blackbox, die der Testbericht bemaengelt. */
        '<span class="dp-cp-badge" id="dp-cp-rest">' + cpBadgeText() + '</span>' +
        '<label class="dp-cp-web" title="Erlaubt dem Co-Pilot, fuer aktuelle Marktdaten im Web zu recherchieren"><input type="checkbox" id="dp-cp-web"><span>Web-Recherche</span></label>' +
        /* v1703: Marcels Auftrag - „eine neue Anfrage an unsere
           Schnittstelle, wie denn so die gaengigen Marktpreise sind.
           Kann man ja vorher sagen, dass das einen Abruf kosten wuerde."
           Die Kostenansage steht im Knopf, nicht erst im Modal: wer
           klickt, soll vorher wissen, worauf er klickt. */
        /* v1848 · Marcel: „bei der Pilotanalyse haben wir jetzt dort
           Marktpreis, einen Abruf. Also das kann da wieder raus." Der
           Knopf ist weg; der Weg bleibt — ueber den Chat, mit Preisansage
           und Zustimmung (copilot-aenderungen.js, ABRUFE). */
      '</div>' +
      '<div class="dp-cp-log" id="dp-cp-log">' +
        '<div class="dp-cp-hint">Frag mich zu Lage, Verhandlung, Finanzierung oder Bank \u2014 ich arbeite mit den Daten dieses Objekts. Fuer aktuelle Marktdaten aus dem Web aktiviere oben die Web-Recherche.</div>' +
      '</div>' +
      '<div class="dp-cp-bar">' +
        '<textarea id="dp-cp-in" class="dp-cp-in" rows="1" placeholder="Frage zum Deal\u2026"></textarea>' +
        '<button id="dp-cp-send" class="dp-cp-send" type="button">Senden</button>' +
      '</div>';
    host.appendChild(box);

    var web = el('dp-cp-web');
    if (web) web.addEventListener('change', function () { allowWeb = this.checked; });
    /* v1848 · kein Knopf mehr, kein Listener (siehe oben) */
    /* v1848 · marktpreis() haengt jetzt am Chat-Weg (window.__dpCpMarktpreis) */
    var snd = el('dp-cp-send');
    if (snd) snd.addEventListener('click', send);
    var inp = el('dp-cp-in');
    if (inp) inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }

  function addMsg(role, text) {
    var log = el('dp-cp-log');
    if (!log) return null;
    var hint = log.querySelector('.dp-cp-hint');
    if (hint) hint.parentNode.removeChild(hint);
    var d = document.createElement('div');
    d.className = 'dp-cp-msg dp-cp-' + (role === 'assistant' ? 'a' : 'u');
    d.innerHTML = esc(text).replace(/\n/g, '<br>');
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  /* v1760: copilot-aenderungen.js schreibt in denselben Verlauf — es soll
     seine Rueckfrage dort zeigen, wo auch die Antworten stehen, und nicht
     in einem zweiten Fenster. Nur diese eine Funktion geht nach aussen;
     send() bleibt intern, der Einhaengepunkt dort ist der Klick. */
  window.__dpCpAddMsg = addMsg;
  /* v1848 · Der Marktpreis-Abruf geht nur noch ueber den Chat (ABRUFE in
     copilot-aenderungen.js). Dafuer braucht der die Funktion — exportiert
     wie addMsg, nach demselben Muster. Ohne Export wuerde das onclick der
     Preisansage ins Leere laufen (die Falle aus v1825). */
  window.__dpCpMarktpreis = marktpreis;

  function context() {
    var c = {};
    try { if (typeof _buildAIPayload === 'function') c = _buildAIPayload(); } catch (e) {}
    if (!c || !Object.keys(c).length) { try { if (window._buildAIPayload) c = window._buildAIPayload(); } catch (e) {} }
    c = c || {};
    /* v1703: eine abgerufene Indikation gehoert in JEDE Folgefrage. Sie
       nur einmal in den Chat zu schreiben hiesse, dass das Modell sie
       beim naechsten „und was heisst das fuer den Kaufpreis?" nicht mehr
       hat - obwohl der Nutzer dafuer bezahlt hat. */
    /* v1847 · Marcel: die Pilot-Analyse soll auch dem Co-Piloten zur
       Verfuegung stehen. GEMESSEN: context() schickte nur die EINGABEN
       (_buildAIPayload), nie das ERGEBNIS — obwohl es nach jeder Analyse
       in window._aiAnalysis liegt (ui.js:931) und beim Laden aus
       objects.ai_analysis zurueckkommt (storage.js:559). Der Chat fragte
       das Modell also zu einem Objekt, dessen fertige Einschaetzung
       daneben im Reiter stand. Gerechnet wird nichts — nur gelesen. */
    if (window._aiAnalysis && typeof window._aiAnalysis === 'object') {
      try { c.pilot_analyse = window._aiAnalysis; } catch (e) {}
    }
    if (_mpErgebnis) {
      try { c.marktpreis_indikation = _mpErgebnis; } catch (e) {}
    }
    return c;
  }

  /* ── v1703 · Marktpreis-Indikation aus dem Chat ────────────────────
     Der Abruf selbst liegt in `object-actions.js` (`avmFetch`), samt
     Pflichtfeldpruefung, Fehlertexten und Guthaben-Abzug. Hier steht nur
     die Tuer und das, was im Chat davon zu lesen ist.

     ANBIETER-NEUTRALITAET: CLAUDE.md sagt „Sprengnetter und PriceHubble
     nie namentlich nach aussen". Im Chat steht deshalb „unabhaengiger
     Bewertungspartner", nie `r.provider`. */
  var _mpErgebnis = null;
  var _mpLaeuft = false;

  function _zahl(n) {
    if (n == null || n === '' || !isFinite(Number(n))) return null;
    return Number(n);
  }
  function _eur(n) {
    var z = _zahl(n);
    return z == null ? null : z.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
  }
  function _eurQm(n) {
    var z = _zahl(n);
    return z == null ? null : z.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/m²';
  }

  function marktpreis() {
    if (_mpLaeuft) return;
    var oa = window.ObjectActions;
    if (!oa || typeof oa.marktpreisFuerCopilot !== 'function') {
      addMsg('assistant', '⚠ Der Marktpreis-Abruf steht hier gerade nicht bereit.');
      return;
    }
    _mpLaeuft = true;
    var btn = el('dp-cp-mp');
    if (btn) btn.disabled = true;

    oa.marktpreisFuerCopilot().then(function (r) {
      if (!r || !r.ok) {
        /* Abbruch ist kein Fehler - dann schreibt der Chat nichts. */
        if (r && r.grund !== 'abgebrochen') addMsg('assistant', '⚠ ' + (r.text || 'Der Abruf hat nicht geklappt.'));
        return;
      }
      var e = r.ergebnis || {};
      var zeilen = [];

      /* v1703b: die Einheiten stehen im Datensatz, sie werden nicht
         angenommen. `marktmieteCold` ist die MONATSMIETE in Euro - der
         Quadratmeterpreis hat ein eigenes Feld (`marktmieteEurSqm`,
         `eurPerSqm`), so liest es auch `avm-section.js:87/108`.

         > Gemessen stand hier zuerst „Marktmiete: 693,00 EUR/m2". Das
         > waren die 693 Euro Monatsmiete mit der falschen Einheit
         > dahinter - eine Zahl, die dreihundertfach daneben liegt und
         > trotzdem plausibel aussieht. */
      var mw = _eur(e.marktwert), lo = _eur(e.low), hi = _eur(e.high);
      if (mw) zeilen.push('Marktwert-Indikation: ' + mw
        + (lo && hi ? '  (Spanne ' + lo + ' – ' + hi + ')' : '')
        + (_eurQm(e.eurPerSqm) ? '  ·  ' + _eurQm(e.eurPerSqm) : ''));

      var mm = _eur(e.marktmieteCold), mlo = _eur(e.marktmieteLow), mhi = _eur(e.marktmieteHigh);
      if (mm) zeilen.push('Marktmiete (kalt): ' + mm + '/Monat'
        + (mlo && mhi ? '  (Spanne ' + mlo + ' – ' + mhi + ')' : '')
        + (_eurQm(e.marktmieteEurSqm) ? '  ·  ' + _eurQm(e.marktmieteEurSqm) : ''));

      if (!zeilen.length) {
        /* Eine Antwort ohne Zahl ist keine Indikation. Lieber sagen, dass
           nichts kam, als eine leere Ueberschrift hinstellen. */
        addMsg('assistant', 'Der Bewertungspartner hat zu diesem Objekt keine Indikation geliefert.');
        return;
      }

      _mpErgebnis = {
        quelle: 'unabhaengiger Bewertungspartner',
        demo: !!r.demo,
        marktwert_eur: _zahl(e.marktwert),
        marktwert_low_eur: _zahl(e.low), marktwert_high_eur: _zahl(e.high),
        marktwert_eur_qm: _zahl(e.eurPerSqm),
        marktmiete_kalt_eur_monat: _zahl(e.marktmieteCold),
        marktmiete_low_eur_monat: _zahl(e.marktmieteLow),
        marktmiete_high_eur_monat: _zahl(e.marktmieteHigh),
        marktmiete_eur_qm: _zahl(e.marktmieteEurSqm),
        stand: new Date().toISOString().slice(0, 10)
      };

      addMsg('assistant',
        'Marktpreis-Indikation (unabhängiger Bewertungspartner'
        + (r.demo ? ', Demo-Modus — kostenlos' : '') + '):\n\n'
        + zeilen.join('\n')
        + '\n\nDas ist eine Indikation, kein Verkehrswert. Sie liegt jetzt in meinen '
        + 'Daten — frag mich, was sie für deinen Kaufpreis, die Miete oder die '
        + 'Verhandlung bedeutet.');

      /* Damit das Modell sie auch wirklich kennt, wandert sie zusaetzlich
         als Gespraechszug in die Historie - `context` allein reicht dem
         Modell zwar, aber so steht sie auch dort, wo es zuletzt gelesen
         hat. */
      history.push({ role: 'assistant', content: 'Abgerufene Marktpreis-Indikation: ' + zeilen.join(' | ') });
    }).catch(function () {
      addMsg('assistant', '⚠ Der Marktpreis-Abruf ist fehlgeschlagen.');
    }).then(function () {
      _mpLaeuft = false;
      var b = el('dp-cp-mp');
      if (b) b.disabled = false;
    });
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

  /* ── v1178 · Der Co-Pilot bekommt eine Grenze, kein Schloss ─────────────
     BEFUND: bis hierher fragte diese Datei `hasFeature` an KEINER Stelle ab
     — der Co-Pilot war fuer Free genauso offen wie fuer Pro. Marcels Frage
     war „rausnehmen oder je Plan ausblenden".

     Weg d aus dem Konzept: sichtbar lassen, aber begrenzen. Ihn zu
     entfernen waere eine Wegnahme bei Leuten, die ihn heute benutzen; ein
     blosses Schloss verkauft nichts, ein fuenfmal benutztes Werkzeug schon.

     Der Zaehler steht bewusst im Frontend und ist damit umgehbar. Das ist
     hier vertretbar und wird nicht verschwiegen: der Endpunkt ist
     server-seitig ohnehin mengenbegrenzt, es fliesst kein Kerosin, und die
     harte Durchsetzung gehoert an denselben Ort wie die der anderen Gates.
     Ein Frontend-Zaehler, der ehrlich benannt ist, ist besser als gar
     keiner — aber er ist keine Abrechnungsgrenze. */
  var CP_FREI = 5;                       /* Fragen je Monat fuer free/starter */
  var CP_KEY  = 'dp_cp_verbrauch';

  function cpMonat() { var d = new Date(); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1); }
  function cpStand() {
    try {
      var r = JSON.parse(localStorage.getItem(CP_KEY) || '{}');
      return (r && r.m === cpMonat()) ? (r.n || 0) : 0;
    } catch (e) { return 0; }
  }
  function cpZaehlen() {
    try { localStorage.setItem(CP_KEY, JSON.stringify({ m: cpMonat(), n: cpStand() + 1 })); } catch (e) {}
  }
  /* Voll ab Investor. Unbekannter Plan = begrenzt, nicht offen — ein
     stiller Rueckfall auf „alles frei" waere die falsche Richtung. */
  function cpVoll() {
    try {
      var k = DealPilotConfig.pricing.currentKey();
      return k === 'investor' || k === 'pro' || k === 'partner';
    } catch (e) { return false; }
  }
  function cpRest() { return cpVoll() ? Infinity : Math.max(0, CP_FREI - cpStand()); }
  function cpBadgeText() {
    if (cpVoll()) return 'unbegrenzt';
    var r = cpRest();
    return r + ' von ' + CP_FREI + ' Fragen frei';
  }
  function cpBadgeZiehen() {
    var b = el('dp-cp-rest');
    if (b) b.textContent = cpBadgeText();
  }

  function send() {
    if (busy) return;
    var inp = el('dp-cp-in');
    var msg = (inp && inp.value || '').trim();
    if (!msg) return;
    if (cpRest() <= 0) {
      addMsg('assistant', 'Deine ' + CP_FREI + ' Co-Pilot-Fragen für diesen Monat sind aufgebraucht. '
        + 'Ab dem Investor-Plan fragst du so oft du willst — am 1. des nächsten Monats sind '
        + 'wieder ' + CP_FREI + ' frei.');
      try { if (typeof openPricingModal === 'function') setTimeout(openPricingModal, 900); } catch (e) {}
      return;
    }
    if (!cpVoll()) { cpZaehlen(); cpBadgeZiehen(); }
    if (inp) inp.value = '';
    addMsg('user', msg);
    history.push({ role: 'user', content: msg });

    busy = true;
    var sbtn = el('dp-cp-send');
    if (sbtn) sbtn.disabled = true;
    var thinking = addMsg('assistant', '\u2026');
    if (thinking) thinking.classList.add('dp-cp-think');

    var ctx = context();
    var body = Object.assign({
      message: msg,
      history: history.slice(0, -1),
      context: ctx,
      allowWeb: allowWeb
    }, userKeyExtra());

    /* v1764: der Feldkatalog geht MIT. Damit entscheidet das Modell selbst,
       ob eine Nachricht eine Frage oder eine Anweisung ist - in EINEM
       Aufruf. Vorher brauchte es dafuer einen zweiten Weg, und ein Muster
       im Frontend musste raten. */
    try {
      if (window._currentObjKey && window.DealPilotCopilotAenderungen
          && typeof window.DealPilotCopilotAenderungen.katalog === 'function') {
        body.felder = window.DealPilotCopilotAenderungen.katalog();
        /* v1766: der Guthabenstand reist mit, damit das Modell die Kosten
           nennen kann, ohne sie zu schaetzen. */
        if (typeof window.DealPilotCopilotAenderungen.abrufe === 'function') {
          body.abrufe = window.DealPilotCopilotAenderungen.abrufe();
        }
      }
    } catch (e) {}

    /* v1769 · DER MARKTBERICHT ZUM OBJEKT REIST MIT (Backlog V6).
       Aus dem Zwischenspeicher, nicht frisch geholt - der Abruf laeuft
       beim Objektwechsel, nicht vor jeder Frage. Ist nichts da, geht
       nichts mit, und das Modell behauptet auch nichts. */
    try {
      if (window.DealPilotPilotBerichte
          && typeof window.DealPilotPilotBerichte.standObjekt === 'function') {
        var _mb = window.DealPilotPilotBerichte.standObjekt();
        if (_mb) body.marktberichte = _mb;
      }
    } catch (e) {}

    Auth.apiCall('/ai/copilot', { method: 'POST', body: body }).then(function (data) {
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      var reply = (data && data.reply) ? data.reply : 'Keine Antwort erhalten.';
      /* Enthaelt die Antwort einen Feldblock, zeigt das Aenderungsmodul die
         Rueckfrage und gibt den Text OHNE Block zurueck. */
      try {
        if (window.DealPilotCopilotAenderungen
            && typeof window.DealPilotCopilotAenderungen.ausAntwort === 'function') {
          /* v1767: BEWUSST OHNE Nutzersatz. Der dritte Parameter loest im
             Portfolio-Piloten einen Objektwechsel aus - hier waere das
             falsch: im Co-Pilot ist immer das geladene Objekt gemeint, und
             eine nebenbei genannte andere Adresse duerfte es nicht
             wegschieben. */
          reply = window.DealPilotCopilotAenderungen.ausAntwort(reply, addMsg, null);
        }
      } catch (e) {}
      if (reply) addMsg('assistant', reply);
      history.push({ role: 'assistant', content: reply });
    }).catch(function (err) {
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      var m = (err && err.data && (err.data.message || err.data.error)) || (err && err.message) || 'Fehler';
      if (err && err.status === 429) m = 'Co-Pilot-Tageslimit erreicht. Morgen wieder verfügbar.';
      if (err && err.status === 503) m = 'KI ist gerade nicht verfuegbar (kein Server-Key).';
      addMsg('assistant', '\u26a0 ' + m);
    }).then(function () {
      busy = false;
      var b = el('dp-cp-send');
      if (b) b.disabled = false;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  window._dpCopilotMount = mount;
})();
