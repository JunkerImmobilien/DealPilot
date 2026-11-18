/* sprung.js — v3682 · Absprung von außen an eine Stelle der App (Marcel 18.11.2026:
   „Absprünge reinmachen in die App, dass wir direkt dorthin springen an die Stellen“,
   zuerst für den Fahrplan der Steuerkanzlei).

   Adresse:  https://<App>/?zu=1&obj=<Objekt>&reiter=<Reiter>&feld=<Element-ID>
             https://<App>/?zu=einstellungen&tab=mandanten

   obj     UUID, Objektnummer (2026-003) oder ein Teil der Anschrift/des Namens
           („Bismarck“). Mehrdeutig → das zuletzt geänderte, mit Hinweis.
   reiter  objekt · investition · miete · finanzierung · bewirtschaftung · steuer ·
           pilot · bewertung · deal (oder die Abschnitts-ID s0 … s8, s3-tax)
   feld    ID eines Elements im Reiter. Es wird hingescrollt und kurz markiert.
           Unbekannt → nur der Reiter, mit Hinweis (nie still).
   zu=einstellungen&tab=<data-tab> öffnet die Einstellungen auf dem Reiter
           (z. B. mandanten = Gesellschaften).

   Ablauf: die Parameter werden beim Laden in sessionStorage gemerkt und aus der
   Adresse genommen (überleben so auch die Anmeldung). Ausgeführt wird nach
   dp:plan-ready, also wenn Konto und Objektliste stehen. Der Sprung lädt
   Objekte nur über loadSaved, die App rechnet wie bei einem Klick. */
(function () {
  'use strict';
  var KEY = 'dp_sprung';
  var REITER = { objekt: 's0', investition: 's1', miete: 's2', finanzierung: 's3', bewirtschaftung: 's4',
    steuer: 's3-tax', steuern: 's3-tax', pilot: 's5', 'pilot-analyse': 's5', bewertung: 's6', deal: 's8', 'deal-aktion': 's8' };

  function hinweis(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.replace(/ß/g, 'ss').replace(/str(asse|\.)/g, 'str').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* 1 · beim Laden merken und die Adresse aufräumen */
  try {
    var q = new URLSearchParams(location.search);
    if (q.has('zu')) {
      var s = {};
      ['zu', 'obj', 'reiter', 'feld', 'tab'].forEach(function (k) { if (q.has(k)) { s[k] = q.get(k); q.delete(k); } });
      sessionStorage.setItem(KEY, JSON.stringify(s));
      var rest = q.toString();
      history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    }
  } catch (e) {}

  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function objektFinden(wert) {
    var resp = await window.Auth.apiCall('/objects?limit=500');
    var l = (resp && (resp.objects || resp.items || resp)) || [];
    if (!Array.isArray(l)) l = [];
    var w = String(wert).trim();
    var genau = l.filter(function (o) { return o.id === w || String(o.seq_no || '') === w; });
    if (genau.length) return { o: genau[0], n: 1 };
    var n = norm(w);
    var treffer = l.filter(function (o) { return norm(o.name || '').indexOf(n) >= 0; });
    treffer.sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); });
    return { o: treffer[0] || null, n: treffer.length };
  }

  function feldZeigen(id) {
    var el = document.getElementById(id);
    if (!el) { hinweis('Die Stelle „' + id + '“ gibt es hier nicht, du bist im richtigen Reiter.'); return false; }
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') {
      /* gemessen 18.11.: Detailstufe 1 blendet ganze Karten aus (z. B. AfA im Reiter Steuer) - nie still ins Leere */
      var dg = (document.body.className.match(/dp-dg-(\d)/) || [])[1];
      hinweis(dg && +dg < 3 ? 'Die Stelle ist in deiner Detailstufe ausgeblendet. Oben im Reiter Objekt auf „Experte“ stellen, dann ist sie sichtbar.'
        : 'Die Stelle ist in dieser Ansicht gerade ausgeblendet.');
      return false;
    }
    /* eingeklappte Karten auf dem Weg öffnen */
    for (var p = el.parentElement; p; p = p.parentElement) { if (p.tagName === 'DETAILS' && !p.open) p.open = true; }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    var alt = el.style.boxShadow, altT = el.style.transition;
    el.style.transition = 'box-shadow .3s';
    el.style.boxShadow = '0 0 0 3px var(--wl-c9a84c, #C9A84C)';
    setTimeout(function () { el.style.boxShadow = alt; el.style.transition = altT; }, 2800);
    return true;
  }

  async function ausfuehren() {
    var s; try { s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s) return;
    sessionStorage.removeItem(KEY);
    try {
      if (s.zu === 'einstellungen') {
        if (typeof window.showSettings === 'function') window.showSettings(s.tab || undefined);
        return;
      }
      if (s.obj) {
        var f = await objektFinden(s.obj);
        if (!f.o) { hinweis('Kein Objekt zu „' + s.obj + '“ gefunden.'); return; }
        if (f.n > 1) hinweis(f.n + ' Objekte passen zu „' + s.obj + '“, geöffnet ist ' + (f.o.name || f.o.seq_no) + '.');
        if (typeof window.setMainView === 'function') { try { window.setMainView('single'); } catch (e) {} }
        await window.loadSaved(f.o.id);
        await warte(600);
      }
      if (s.reiter) {
        var sec = REITER[norm(s.reiter).replace(/ /g, '-')] || s.reiter;
        if (typeof window._dpReiterZu !== 'function' || !window._dpReiterZu(sec)) hinweis('Den Reiter „' + s.reiter + '“ gibt es nicht.');
        await warte(500);
      }
      if (s.feld) feldZeigen(s.feld);
    } catch (e) { console.warn('[sprung]', e); hinweis('Der Absprung hat nicht geklappt: ' + (e && e.message || e)); }
  }

  var los = false;
  function start() { if (los) return; los = true; setTimeout(ausfuehren, 800); }
  window.addEventListener('dp:plan-ready', start);
  /* Fallback, falls dp:plan-ready vor diesem Skript feuerte: einmal nachsehen, ob Konto und loadSaved stehen */
  window.addEventListener('load', function () {
    setTimeout(function () { if (!los && window.Auth && window.Auth.getSession && window.Auth.getSession() && typeof window.loadSaved === 'function') start(); }, 4000);
  });
  window.DpSprung = { ausfuehren: ausfuehren, objektFinden: objektFinden };
})();
