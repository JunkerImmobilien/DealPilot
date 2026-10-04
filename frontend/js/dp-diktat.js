/* ═══════════════════════════════════════════════════════════════════════
   v1760 · DIKTAT FÜR TEXTFELDER
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 01.10.2026: „Arbeitest du an den anderen Backlog-Sachen auch?
   Also dem Sprechlauf beim Co-Pilot und Cockpit-Piloten?"

   Das ist etwas anderes als der Sprechlauf aus `voice-import.js`. Der
   füllt FORMULARFELDER — er hört zu, ordnet zu, fragt nach, wenn ein Feld
   schon belegt ist. Hier geht es um das Gegenteil: eine FRAGE diktieren,
   die dann an den Co-Pilot geht. Ein Feld, ein Text, kein Zuordnen.

   > Den großen Sprechlauf dafür zu öffnen wäre, als nähme man den Kran
   > für einen Blumentopf — und der Nutzer müsste sich durch eine
   > Feldzuordnung klicken, die hier keinen Sinn ergibt.

   NICHT nachgebaut wird die Transkription. Sie läuft über denselben
   Endpunkt wie der Sprechlauf: `POST /api/v1/ai/transcribe-chunk`,
   gemessen in `voice-import.js:1197`. Ein zweiter Transkriptionsweg
   liefe auseinander, sobald einer gepflegt wird.

   Benutzung:
     DealPilotDiktat.knopfAn('dp-cp-in', { neben: 'dp-cp-send' });

   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TOKEN_KEY = 'ji_token';
  var laeuft = null;          /* { feldId, rec, stream, chunks, mime, knopf } */

  function el(id) { return document.getElementById(id); }

  function toast(t) {
    try { if (typeof window.toast === 'function') return window.toast(t); } catch (e) {}
    console.log('[Diktat]', t);
  }

  function mime() {
    var kand = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for (var i = 0; i < kand.length; i++) {
      if (MediaRecorder.isTypeSupported(kand[i])) return kand[i];
    }
    return '';
  }

  function ico(an) {
    return an
      ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
      : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
        + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>'
        + '<path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>';
  }

  function stand(knopf, an, text) {
    if (!knopf) return;
    knopf.innerHTML = ico(an);
    knopf.classList.toggle('dp-dik-an', !!an);
    knopf.title = text || (an ? 'Aufnahme beenden und einsetzen' : 'Frage diktieren');
    knopf.setAttribute('aria-label', knopf.title);
  }

  function stoppen() {
    if (!laeuft) return;
    var l = laeuft;
    try { if (l.rec && l.rec.state !== 'inactive') l.rec.stop(); } catch (e) {}
    try { if (l.stream) l.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
  }

  /* Der Blob geht als base64 an denselben Endpunkt, den der Sprechlauf
     nutzt. Kein `Auth.apiCall`: der stringifiziert selbst und ist auf
     JSON-Nutzlasten zugeschnitten — hier wird derselbe Weg gegangen wie
     in voice-import.js, damit beide dasselbe Verhalten haben. */
  function schicken(blob, mimeTyp, feldId, knopf) {
    if (!blob || blob.size < 1200) {
      stand(knopf, false);
      toast('Zu kurz — nichts aufgenommen.');
      return;
    }
    stand(knopf, false, 'Wird ausgewertet …');
    knopf.classList.add('dp-dik-wartet');

    var r = new FileReader();
    r.onloadend = function () {
      var b64 = String(r.result || '').split(',')[1] || '';
      if (!b64) { knopf.classList.remove('dp-dik-wartet'); stand(knopf, false); return; }
      var tok = '';
      try { tok = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
      fetch('/api/v1/ai/transcribe-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ audio: b64, mime: mimeTyp || 'audio/webm' })
      }).then(function (res) { return res.json().catch(function () { return {}; }); })
        .then(function (data) {
          knopf.classList.remove('dp-dik-wartet');
          stand(knopf, false);
          var t = (data && data.text || '').trim();
          if (!t) { toast((data && data.warn) || 'Nichts verstanden — nochmal versuchen.'); return; }
          var feld = el(feldId);
          if (!feld) return;
          /* ANHÄNGEN, nicht ersetzen. Wer schon getippt hat und dann
             diktiert, will ergänzen — alles Vorherige wegzuwerfen wäre
             dieselbe stille Verwerfung, die wir dem Sprechlauf verbieten. */
          var alt = (feld.value || '').trim();
          feld.value = alt ? (alt + ' ' + t) : t;
          try {
            feld.dispatchEvent(new Event('input', { bubbles: true }));
            feld.focus();
            feld.selectionStart = feld.selectionEnd = feld.value.length;
          } catch (e) {}
        })
        .catch(function () {
          knopf.classList.remove('dp-dik-wartet');
          stand(knopf, false);
          toast('Auswertung fehlgeschlagen.');
        });
    };
    r.onerror = function () { knopf.classList.remove('dp-dik-wartet'); stand(knopf, false); };
    r.readAsDataURL(blob);
  }

  function starten(feldId, knopf) {
    if (laeuft) { stoppen(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      toast('Dieser Browser kann nicht aufnehmen.');
      return;
    }
    var m = mime();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var rec;
      try { rec = m ? new MediaRecorder(stream, { mimeType: m }) : new MediaRecorder(stream); }
      catch (e) { try { rec = new MediaRecorder(stream); } catch (e2) { toast('Aufnahme nicht möglich.'); return; } }

      laeuft = { feldId: feldId, rec: rec, stream: stream, chunks: [], mime: m, knopf: knopf };
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) laeuft.chunks.push(ev.data); };
      rec.onstop = function () {
        var l = laeuft; laeuft = null;
        var blob = null;
        try { blob = new Blob(l.chunks, { type: l.mime || 'audio/webm' }); } catch (e) {}
        schicken(blob, l.mime, l.feldId, l.knopf);
      };
      rec.start();
      stand(knopf, true);
      /* Eine Obergrenze, damit ein vergessener Knopf nicht endlos
         aufnimmt — zwei Minuten reichen für jede Frage. */
      setTimeout(function () { if (laeuft && laeuft.rec === rec) stoppen(); }, 120000);
    }).catch(function () {
      toast('Kein Zugriff aufs Mikrofon.');
    });
  }

  function stil() {
    if (el('dp-dik-stil')) return;
    var s = document.createElement('style');
    s.id = 'dp-dik-stil';
    s.textContent = [
      '.dp-dik{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;'
        + 'flex:0 0 auto;border:1px solid var(--wl-c9a84c,#C9A84C);border-radius:6px;'
        + 'background:transparent;color:var(--wl-c9a84c,#C9A84C);cursor:pointer;padding:0}',
      '.dp-dik:hover{background:var(--wl-c9a84c,#C9A84C);color:#0A0A09}',
      /* Rot ist hier Statusfarbe (Aufnahme laeuft) und bleibt deshalb in
         jeder Marke rot - Statusfarben werden nicht tokenisiert. */
      '.dp-dik.dp-dik-an{background:#D8564C;border-color:#D8564C;color:#fff;'
        + 'animation:dpDikPuls 1.4s ease-in-out infinite}',
      '.dp-dik.dp-dik-wartet{opacity:.5;cursor:default}',
      '@keyframes dpDikPuls{0%,100%{opacity:1}50%{opacity:.55}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* Hängt einen Mikrofonknopf an ein Textfeld. `neben` ist die Id des
     Elements, VOR dem der Knopf stehen soll; ohne sie landet er direkt
     hinter dem Feld. */
  function knopfAn(feldId, opt) {
    opt = opt || {};
    stil();
    var feld = el(feldId);
    if (!feld) return false;
    var id = 'dp-dik-' + feldId;
    if (el(id)) return true;

    var b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.className = 'dp-dik';
    stand(b, false);
    b.addEventListener('click', function () { starten(feldId, b); });

    var anker = opt.neben ? el(opt.neben) : null;
    if (anker && anker.parentNode) anker.parentNode.insertBefore(b, anker);
    else if (feld.parentNode) feld.parentNode.insertBefore(b, feld.nextSibling);
    else return false;
    return true;
  }

  window.DealPilotDiktat = {
    knopfAn: knopfAn,
    laeuft: function () { return !!laeuft; },
    stoppen: stoppen
  };
})();
