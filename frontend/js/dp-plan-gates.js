/* ============================================================================
   DealPilot v1084 – dp-plan-gates.js   (war v874)
   Plan-Schranken im Aktionen-Menue SICHTBAR machen statt verstecken.

   ─── WAS VORHER STAND (und warum es weg musste) ───────────────────────────
   Die alte Fassung suchte den Eintrag "Export" ueber einen TEXTVERGLEICH
   (textContent === 'Export') und setzte dann display:none. Drei Probleme:

     1. Verstecken. Der Backlog will das Gegenteil: "Plan-Schranken sichtbar
        markieren statt verstecken". Wer nicht sieht, was es gaebe, fragt auch
        nicht danach — und wer den Eintrag von frueher kennt, haelt die App
        fuer kaputt.
     2. Textvergleich auf sichtbarem Nutztext. Jede Umbenennung, jede
        Uebersetzung, jedes zusaetzliche "Export"-Element haette die Regel
        entweder ins Leere laufen lassen oder das Falsche getroffen.
        Die data-feature-Marker standen die ganze Zeit im Markup daneben.
     3. Nur "Export". track_record_pdf und bank_pdf_a3 trugen ihren Marker,
        wurden aber nie ausgewertet.

   ─── DIE FALLE, DIE HIER LAUERT ───────────────────────────────────────────
   CLAUDE.md: "Unbekannter Feature-Schluessel ist fuer JEDEN false, auch fuer
   Pro." hasFeature() liefert bei einem Tippfehler im Marker also false — und
   wuerde den Eintrag fuer alle sperren, auch fuer zahlende Kunden.
   Deshalb wird hier NUR gesperrt, wenn der Schluessel nachweislich EXISTIERT:
   er muss in den Features irgendeines bekannten Plans vorkommen. Ist er
   nirgends bekannt, bleibt der Eintrag OFFEN. Lieber einmal zu viel offen als
   einem Kunden grundlos etwas wegnehmen.
   ============================================================================ */
(function () {
  'use strict';

  /* Sammelt alle Feature-Schluessel, die in irgendeinem Plan vorkommen.
     Das ist der Beweis, dass ein Marker echt ist und kein Tippfehler. */
  function bekannteSchluessel() {
    var set = {};
    try {
      var plans = window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.plans;
      if (plans) {
        Object.keys(plans).forEach(function (k) {
          var f = plans[k] && plans[k].features;
          if (f) Object.keys(f).forEach(function (fk) { set[fk] = true; });
        });
      }
    } catch (e) {}
    return set;
  }

  function hatFeature(key) {
    try {
      var p = window.DealPilotConfig && DealPilotConfig.pricing;
      if (p && typeof p.hasFeature === 'function') return !!p.hasFeature(key);
    } catch (e) {}
    return true;   /* im Zweifel offen lassen */
  }

  function sperren(row, key) {
    if (row.getAttribute('data-gate') === 'locked') return;
    row.setAttribute('data-gate', 'locked');
    row.setAttribute('data-gate-feature', key);
    row.classList.add('sb-act-locked');
    /* Der Eintrag bleibt bedienbar — der Klick fuehrt zum Plan, statt ins
       Leere zu laufen. Das ist der Unterschied zwischen "gesperrt" und
       "kaputt". Das urspruengliche onclick wird dafuer beiseitegelegt. */
    if (!row.hasAttribute('data-gate-onclick')) {
      row.setAttribute('data-gate-onclick', row.getAttribute('onclick') || '');
      row.removeAttribute('onclick');
    }
    if (!row.querySelector('.sb-act-lock')) {
      var s = document.createElement('span');
      s.className = 'sb-act-lock';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = '●';           /* wird per CSS zum Schloss-Glyph */
      row.appendChild(s);
    }
    row.setAttribute('title', 'In deinem Plan nicht enthalten — hier tippen zeigt die Pläne');
  }

  function entsperren(row) {
    if (row.getAttribute('data-gate') !== 'locked') return;
    row.removeAttribute('data-gate');
    row.removeAttribute('data-gate-feature');
    row.classList.remove('sb-act-locked');
    var alt = row.getAttribute('data-gate-onclick');
    if (alt) row.setAttribute('onclick', alt);
    row.removeAttribute('data-gate-onclick');
    var l = row.querySelector('.sb-act-lock');
    if (l) l.remove();
    row.removeAttribute('title');
  }

  function apply() {
    try {
      var acc = document.getElementById('sb-actions-accordion');
      if (!acc) return;
      var bekannt = bekannteSchluessel();
      var rows = acc.querySelectorAll('.sb-act-item[data-feature]');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var key = row.getAttribute('data-feature') || '';
        /* Unbekannter Schluessel -> offen lassen. Siehe Kopf. */
        if (!key || !bekannt[key]) { entsperren(row); continue; }
        if (hatFeature(key)) entsperren(row); else sperren(row, key);
      }
    } catch (e) {}
  }

  /* Klick auf einen gesperrten Eintrag: Plaene zeigen. */
  document.addEventListener('click', function (ev) {
    var row = ev.target && ev.target.closest ? ev.target.closest('.sb-act-item[data-gate="locked"]') : null;
    if (!row) return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      if (typeof window.openPricingModal === 'function') return window.openPricingModal();
      if (window.DealPilotPricing && typeof DealPilotPricing.open === 'function') return DealPilotPricing.open();
      var b = document.querySelector('.st-tab[data-tab="plan"]');
      if (b) { b.click(); return; }
      if (typeof window.toast === 'function') window.toast('Diese Funktion gehört zu einem höheren Plan.');
    } catch (e) {}
  }, true);

  function boot() {
    apply();
    /* Der Plan steht beim Laden noch nicht fest. dp:plan-ready statt Timer
       oder Polling (CLAUDE.md). Der Observer bleibt als zweites Netz, falls
       das Menue nachtraeglich neu gerendert wird. */
    try { window.addEventListener('dp:plan-ready', apply); } catch (e) {}
    try {
      var acc = document.getElementById('sb-actions-accordion');
      if (acc) new MutationObserver(function () { apply(); }).observe(acc, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.DealPilotPlanGates = { apply: apply };
})();
