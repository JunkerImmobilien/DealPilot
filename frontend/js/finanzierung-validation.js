/* V269-02: Soft-Validation für d1_auszahl */
(function() {
  'use strict';

  var HINT_ID = 'v269-d1auszahl-hint';

  function ensureHintElement(input) {
    var existing = document.getElementById(HINT_ID);
    if (existing) return existing;
    var hint = document.createElement('div');
    hint.id = HINT_ID;
    hint.style.cssText = 'margin-top:4px;font-size:11px;line-height:1.3;color:var(--muted,#7A7370);min-height:14px';
    var parent = input.parentElement;
    if (parent) parent.appendChild(hint);
    return hint;
  }

  function update() {
    if (typeof window.DealPilotAnteilig !== 'object') return;
    if (typeof window.DealPilotAnteilig.validateFinanzierungDate !== 'function') return;
    var input = document.getElementById('d1_auszahl');
    if (!input) return;
    var hint = ensureHintElement(input);
    var result;
    try { result = window.DealPilotAnteilig.validateFinanzierungDate(); }
    catch(e) { return; }
    if (!result || !result.msg) {
      hint.textContent = '';
      return;
    }
    hint.textContent = result.msg;
    var color = 'var(--muted,#7A7370)';
    if (result.level === 'warn')  color = 'var(--gold-d,#8B7000)';
    if (result.level === 'error') color = '#C9302C';
    hint.style.color = color;
  }

  function attach() {
    var input = document.getElementById('d1_auszahl');
    if (!input) return false;
    if (input.dataset.v269Hint) return true;
    input.dataset.v269Hint = '1';
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    var kd = document.getElementById('kaufdat');
    if (kd && !kd.dataset.v269HintHook) {
      kd.dataset.v269HintHook = '1';
      kd.addEventListener('change', update);
    }
    update();
    return true;
  }

  var tries = 0;
  function init() {
    if (attach()) return;
    if (++tries < 30) setTimeout(init, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DealPilotFinanzValidation = { update: update, _meta: 'V269-02' };
})();
