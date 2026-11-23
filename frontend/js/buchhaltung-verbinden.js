'use strict';
/* ═══ js/buchhaltung-verbinden.js — v3967 · BUCHHALTUNG VERBINDEN (Anbieterliste, heute nur ViVi) ═══════════════
 *
 * Marcel 22.11.2026: „[Der Knopf] muss an der richtigen Stelle, erst nach Gewonnen irgendwo sein und auch nur, wenn
 * API-Key drin ist. Dieser Knopf oder diese Meldung kann später auch mit anderen Buchungsprogrammen genutzt werden.“
 *
 * GEMESSEN vor dem Bau: Der Übergang in den Bestand passiert im Reiter Deal-Aktion unter der Status-Tafel
 * („Gewonnen · im Bestand“, deal-action-boarding.js), dort klappt #da-ankauf-frage auf (ankauf.js frageZeigen(),
 * gerufen von deal-action.js bei jedem Statuswechsel und nach dem Laden). Direkt darunter steht dieses Angebot.
 *
 * Regeln:
 *   · nur bei Status gewonnen bzw. Bestand (DealPilotDealAction.isWon(), #_deal_won_state, DpBestand.istBestand())
 *   · nur, wenn bei einem Anbieter ein Schlüssel hinterlegt ist. Sonst steht hier NICHTS, auch kein toter Knopf
 *   · neutral: „In deine Objektverwaltung übernehmen · ViVi“. Der Anbieter bringt Name, Status und Anlegen selbst mit
 *
 * Anbieter melden sich mit DpBuchhaltung.anbieter({ id, name, frei(), verbunden(), status(key), uebernehmen() }) an.
 * status(key) -> Promise<{ verknuepft: bool, laeuft: bool, text: string }>. js/vivi.js meldet ViVi an.
 * Kundentexte ohne Gedankenstrich und Semikolon.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpBuchhaltung) return;
  var _anbieter = [];
  var _lauf = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** Gewonnen oder Bestand. Dieselben Quellen wie ankauf.js (isWon) und bestand-analyse.js. */
  function istGewonnen() {
    try { if (window.DealPilotDealAction && typeof window.DealPilotDealAction.isWon === 'function' && window.DealPilotDealAction.isWon()) return true; } catch (e) {}
    var w = $('_deal_won_state'); if (w && w.value === 'true') return true;
    var d = window._currentObjData; if (d && (d._deal_won === true || d._deal_won === 'true')) return true;
    try { return !!(window.DpBestand && window.DpBestand.istBestand()); } catch (e) { return false; }
  }

  function stil() {
    if ($('buha-stil')) return;
    var s = document.createElement('style'); s.id = 'buha-stil';
    s.textContent = [
      '#da-buchhaltung:empty{display:none}',
      '#da-buchhaltung .buha-zeile{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0 0;padding:10px 12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:10px;font:400 12.5px/1.45 Inter,system-ui,sans-serif}',
      '#da-buchhaltung .buha-txt{flex:1 1 240px;min-width:0}',
      '#da-buchhaltung .buha-marke{font:600 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.75;margin-right:6px}'
    ].join('');
    document.head.appendChild(s);
  }

  function host() {
    var h = $('da-buchhaltung');
    if (h) return h;
    var anker = $('da-ankauf-frage');
    if (!anker || !anker.parentNode) return null;
    h = document.createElement('div'); h.id = 'da-buchhaltung';
    anker.parentNode.insertBefore(h, anker.nextSibling);
    return h;
  }

  /** Zeichnet das Angebot neu. status: 'won' | 'lost' | 'open' | undefined (dann selbst bestimmen). */
  function zeigen(status) {
    var h = host(); if (!h) return;
    var key = window._currentObjKey || null;
    var gewonnen = status ? status === 'won' : istGewonnen();
    var lauf = ++_lauf;
    if (!key || !gewonnen || !_anbieter.length) { h.innerHTML = ''; return; }
    Promise.all(_anbieter.map(function (a) {
      return Promise.resolve().then(function () { return a.frei ? a.frei() : true; }).then(function (f) {
        if (!f) return null;
        return Promise.resolve(a.verbunden()).then(function (v) {
          if (!v) return null;
          return Promise.resolve(a.status(key)).then(function (st) { return { a: a, st: st || {} }; });
        });
      }).catch(function () { return null; });
    })).then(function (L) {
      if (lauf !== _lauf || window._currentObjKey !== key) return;
      L = L.filter(Boolean);
      if (!L.length) { h.innerHTML = ''; return; }
      stil();
      h.innerHTML = L.map(function (x) {
        var st = x.st, a = x.a;
        /* v4040 · verknüpft: Knopf zum Abgleich (Pilot-Analyse › ViVi), wenn der Anbieter ihn anbietet */
        if (st.verknuepft) return '<div class="buha-zeile"><span class="buha-txt"><span class="buha-marke">' + esc(a.name) + '</span>' + esc(st.text || 'In deiner Objektverwaltung. Die Werte kommen von dort, siehe Reiter Objekt.') + '</span>'
          + (typeof a.abgleich === 'function' ? '<button type="button" class="btn btn-sm btn-gold" data-buha-abgleich="' + esc(a.id) + '">Abgleich mit ' + esc(a.name) + '</button>' : '') + '</div>';
        if (st.laeuft) return '<div class="buha-zeile"><span class="buha-txt"><span class="buha-marke">' + esc(a.name) + '</span>' + esc(st.text || 'Die Übernahme läuft.') + '</span></div>';
        return '<div class="buha-zeile"><span class="buha-txt"><b>In deine Objektverwaltung übernehmen</b><br>Das Objekt wird einmal angelegt, mit Einheiten, Mietverhältnissen und Darlehen. Danach liest DealPilot nur noch.</span>' +
          '<button type="button" class="btn btn-sm btn-gold" data-buha="' + esc(a.id) + '">In deine Objektverwaltung übernehmen · ' + esc(a.name) + '</button></div>';
      }).join('');
    });
  }

  function anbieter(a) {
    if (!a || !a.id || typeof a.verbunden !== 'function' || typeof a.status !== 'function' || typeof a.uebernehmen !== 'function') return;
    _anbieter = _anbieter.filter(function (x) { return x.id !== a.id; }).concat([a]);
    zeigen();
  }

  document.addEventListener('click', function (ev) {
    var g = ev.target && ev.target.closest ? ev.target.closest('#da-buchhaltung [data-buha-abgleich]') : null;   /* v4040 */
    if (g) { ev.preventDefault(); var ga = _anbieter.filter(function (x) { return x.id === g.getAttribute('data-buha-abgleich'); })[0]; if (ga && ga.abgleich) ga.abgleich(); return; }
    var b = ev.target && ev.target.closest ? ev.target.closest('#da-buchhaltung [data-buha]') : null;
    if (!b) return;
    ev.preventDefault();
    var a = _anbieter.filter(function (x) { return x.id === b.getAttribute('data-buha'); })[0];
    if (a) a.uebernehmen();
  });

  /* Statuswechsel und Laden: ankauf.js frageZeigen(status) ist die gemessene Stelle, an der beides ankommt */
  function einhaken() {
    var AK = window.DealPilotAnkauf;
    if (!AK || typeof AK.frageZeigen !== 'function' || AK.frageZeigen._buha) return false;
    var orig = AK.frageZeigen;
    var neu = function (status) { var r = orig.apply(this, arguments); try { zeigen(status); } catch (e) {} try { window.dispatchEvent(new CustomEvent('dp:buchhaltung-status', { detail: { status: status } })); } catch (e) {} return r; };
    neu._buha = true;
    AK.frageZeigen = neu;
    return true;
  }
  if (!einhaken()) document.addEventListener('DOMContentLoaded', einhaken);
  window.addEventListener('dp:object-ready', function () { einhaken(); setTimeout(function () { zeigen(); }, 900); });

  window.DpBuchhaltung = { anbieter: anbieter, zeigen: zeigen, istGewonnen: istGewonnen };
})();
