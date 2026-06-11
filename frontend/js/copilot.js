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
        '<span class="dp-cp-badge">kostet kein Kerosin</span>' +
        '<label class="dp-cp-web" title="Erlaubt dem Co-Pilot, fuer aktuelle Marktdaten im Web zu recherchieren"><input type="checkbox" id="dp-cp-web"><span>Web-Recherche</span></label>' +
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

  function context() {
    try { if (typeof _buildAIPayload === 'function') return _buildAIPayload(); } catch (e) {}
    try { if (window._buildAIPayload) return window._buildAIPayload(); } catch (e) {}
    return {};
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

  function send() {
    if (busy) return;
    var inp = el('dp-cp-in');
    var msg = (inp && inp.value || '').trim();
    if (!msg) return;
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

    Auth.apiCall('/ai/copilot', { method: 'POST', body: body }).then(function (data) {
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      var reply = (data && data.reply) ? data.reply : 'Keine Antwort erhalten.';
      addMsg('assistant', reply);
      history.push({ role: 'assistant', content: reply });
    }).catch(function (err) {
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      var m = (err && err.data && (err.data.message || err.data.error)) || (err && err.message) || 'Fehler';
      if (err && err.status === 429) m = 'Co-Pilot-Tageslimit erreicht. Morgen wieder verfuegbar.';
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
