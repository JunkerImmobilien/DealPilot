/* ═══════════════════════════════════════════════════════════════════════
   erststart.js · v1638 — „Du bist neu hier"

   Marcel am 26.09.2026: „wenn ein Kunde sich das erste Mal anmeldet, wird
   ihm ja die Tour angeboten. Wir sollten ihm im gleichen Zuge auch sagen,
   welche Einstellung man setzen muss … Finanzierungsdaten, Mietausfall …
   woher zieht er seine Zinsen, wie viel Beleihung, wie viel wir tilgen."

   ── ERST NACHGESEHEN, DANN GEBAUT ────────────────────────────────────
   Bevor hier irgendetwas entstand, habe ich geprüft, ob es die genannten
   Einstellungen überhaupt gibt. **Es gibt sie alle** — in
   `DealPilotInvestmentProfile`, gemessen am laufenden Stand:

     tilgung_default        1      %     Tilgung
     ek_quote_default      20      %     Eigenkapital (also die Beleihung)
     zins_margin      'standard'         woher der Zins kommt
     mietausfall_pct        2      %     Mietausfallwagnis
     bwk_ul_pct_default    17      %     nicht umlagefähige Kosten
     leerstand_pct          2      %
     min_dscr             1,2

   Der Zins selbst kommt aus `DealPilotConfig.marketRates` — ECB-Presse­
   mitteilung und Bundesbank-MFI-Statistik, Stand 02/2026, plus Marge.
   Gemessen ergibt das heute **4,27 %**.

   > **Diese Karte legt deshalb KEINE neue Einstellung an.** Sie erklärt
   > die vorhandenen und führt mit einem Klick dorthin. Eine zweite
   > Vorgabeliste wäre der sechste Fall von „zwei Listen für dieselbe
   > Sache" in diesem Projekt.

   ── WANN SIE ERSCHEINT ───────────────────────────────────────────────
   Einmal je Browser, und nur, wenn beides gilt: noch nie gesehen UND die
   Tour noch nicht abgeschlossen. Wer die Tour schon kennt, ist nicht neu.
   Sie blockiert nichts — man kann sie wegklicken und über
   „Rundgang starten" jederzeit zurückholen.

   ── WARUM NEBEN DER TOUR, NICHT IN IHR ───────────────────────────────
   Die Tour zeigt, WO etwas ist. Diese Karte sagt, WAS vorher einmal
   eingestellt gehört, damit der erste Quick-Check nicht mit fremden
   Zahlen rechnet. Das sind zwei verschiedene Fragen, und eine Tour, die
   beides beantwortet, beantwortet keines von beiden gut.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotErststart) return;

  var GESEHEN = 'dp_erststart_gesehen';
  var TOUR_FERTIG = 'dp_tour_completed_v1';

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /** Die echten Werte, nicht erfundene. Fehlt das Modul, fehlt die Zeile —
   *  eine Vorgabe zu behaupten, die nicht gilt, wäre schlimmer als sie
   *  wegzulassen. */
  function werte() {
    var p = {};
    try {
      if (window.DealPilotInvestmentProfile && DealPilotInvestmentProfile.load) DealPilotInvestmentProfile.load();
      p = (window.DealPilotConfig && window.DealPilotConfig.investmentProfileDefaults) || {};
      var eigen = JSON.parse(ls('dp_investment_profile') || '{}');
      Object.keys(eigen).forEach(function (k) { if (eigen[k] != null) p[k] = eigen[k]; });
    } catch (e) {}

    var zins = null;
    try { if (window.DealPilotInvestmentProfile && DealPilotInvestmentProfile.getZins) zins = DealPilotInvestmentProfile.getZins(); } catch (e) {}

    var q = '';
    try {
      var mr = window.DealPilotConfig && window.DealPilotConfig.marketRates;
      if (mr && mr.sourceLabel) q = mr.sourceLabel + (mr.asOf ? ' · Stand ' + mr.asOf : '');
    } catch (e) {}

    function z(v, e) { return (v == null || v === '') ? '—' : (String(v).replace('.', ',') + (e || '')); }

    return [
      { t: 'Zinssatz', v: z(zins, ' %'),
        u: q || 'Aus dem Markt, plus deiner Marge', i: '%' },
      { t: 'Eigenkapital', v: z(p.ek_quote_default, ' %'),
        u: 'Bestimmt zugleich die Beleihung', i: '◧' },
      { t: 'Tilgung', v: z(p.tilgung_default, ' %'),
        u: 'Anfängliche Tilgung im ersten Jahr', i: '↓' },
      { t: 'Mietausfallwagnis', v: z(p.mietausfall_pct, ' %'),
        u: 'Zusammen mit Leerstand ' + z(p.leerstand_pct, ' %'), i: '⚠' },
      { t: 'Nicht umlagefähige Kosten', v: z(p.bwk_ul_pct_default, ' %'),
        u: 'Verwaltung, Instandhaltung, Rücklage', i: '▦' }
    ];
  }

  function zeige() {
    if (document.getElementById('dp-erststart')) return;
    var w = werte();

    var ov = document.createElement('div');
    ov.id = 'dp-erststart';
    ov.className = 'dpes-ov';
    ov.innerHTML =
      '<div class="dpes-k" role="dialog" aria-modal="true" aria-label="Willkommen bei DealPilot">'
      + '<div class="dpes-kopf">'
      +   '<div class="dpes-marke"><span class="dpes-wm">Deal<i>Pilot</i></span>'
      +     '<span class="dpes-bp">Boarding</span></div>'
      +   '<button type="button" class="dpes-x" aria-label="Schließen">×</button>'
      + '</div>'
      + '<h2>Willkommen an Bord.</h2>'
      + '<p class="dpes-vor">Eine Sache lohnt sich vor dem ersten Objekt: <b>deine '
      +   'Standardwerte</b>. Sie gelten für jeden Quick-Check und jedes neue Objekt — '
      +   'einmal gesetzt, rechnet DealPilot ab dann mit <i>deinen</i> Zahlen statt mit '
      +   'unseren Vorgaben.</p>'
      + '<div class="dpes-liste">'
      +   w.map(function (x) {
            return '<div class="dpes-z"><span class="dpes-i">' + x.i + '</span>'
              + '<span class="dpes-t"><b>' + x.t + '</b><small>' + x.u + '</small></span>'
              + '<span class="dpes-v">' + x.v + '</span></div>';
          }).join('')
      + '</div>'
      + '<p class="dpes-fuss">Das sind die Werte, mit denen gerade gerechnet wird. '
      +   'Passen sie, musst du nichts tun.</p>'
      + '<div class="dpes-knoepfe">'
      +   '<button type="button" class="dpes-b dpes-haupt" id="dpes-set">Standardwerte prüfen</button>'
      +   '<button type="button" class="dpes-b" id="dpes-tour">Rundgang starten</button>'
      +   '<button type="button" class="dpes-b dpes-leise" id="dpes-spaeter">Später</button>'
      + '</div></div>';

    document.body.appendChild(ov);

    function zu() { lsSet(GESEHEN, '1'); ov.remove(); }
    ov.querySelector('.dpes-x').addEventListener('click', zu);
    ov.querySelector('#dpes-spaeter').addEventListener('click', zu);
    ov.addEventListener('click', function (e) { if (e.target === ov) zu(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && document.getElementById('dp-erststart')) {
        zu(); document.removeEventListener('keydown', esc);
      }
    });

    ov.querySelector('#dpes-set').addEventListener('click', function () {
      zu();
      /* Der vorhandene Weg, nicht ein zweiter: `showSettings` baut die
         Seite „Standardwerte" und ruft dort selbst
         `DealPilotInvestmentProfile.renderPaneHtml()` auf. */
      try { if (typeof window.showSettings === 'function') window.showSettings('standardwerte'); } catch (e) {}
    });
    ov.querySelector('#dpes-tour').addEventListener('click', function () {
      zu();
      try {
        if (typeof window.startTour === 'function') window.startTour();
        else if (typeof window.startTourFromSidebar === 'function') window.startTourFromSidebar();
      } catch (e) {}
    });
  }

  function faellig() {
    if (ls(GESEHEN)) return false;
    if (ls(TOUR_FERTIG)) return false;   /* wer die Tour kennt, ist nicht neu */
    return true;
  }

  function start() {
    /* Erst nach einem Moment: die Anmeldung, das Plan-Ereignis und die
       Objektliste laufen beim Start noch. Eine Karte, die mitten in den
       Aufbau springt, wirkt wie ein Fehler. */
    if (!faellig()) return;
    setTimeout(function () { if (faellig()) zeige(); }, 2600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotErststart = {
    zeige: zeige,
    vergessen: function () { try { localStorage.removeItem(GESEHEN); } catch (e) {} },
    werte: werte
  };
})();
