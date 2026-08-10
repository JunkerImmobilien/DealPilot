/* ============================================================================
   DealPilot v1123 — textfarben-karten.js
   Backlog: "Textfarben-Regler fuer Score-Karte und KPI-Karten bauen."
   Marcels Entscheidungen vom 2026-08-10:
     - Weg B fuer den Partner (still korrigieren), Weg C fuer den einzelnen
       Nutzer (frei, aber sichtbar warnen)
     - ZWEI Regler: Score-Karten-Text und KPI-Karten-Text
     - Nebentoene --uv-sc-mut und --uv-sc-ok bleiben ABGELEITET
     - Zuruecksetzen bekommt einen eigenen Knopf

   ── DIE SCHWELLE: an der Schriftgroesse, nicht an einer Namensliste ────────
   Mein eigener Backlog-Vorschlag lautete "Score-Zahl 3,0, Labels 4,5" und
   war damit richtig gedacht, aber ungenau. WCAG 2.2 (1.4.3 Contrast Minimum)
   sagt es praeziser: 4,5:1 fuer normalen Text, 3:1 nur fuer GROSSEN Text,
   und gross heisst >= 18 pt (24 px) oder >= 14 pt fett (18,5 px).

   Im Browser nachgemessen, Score-Karte:
     Score-Zahl        21 px / 800  -> gross   -> 3,0
     .sc-pill-v  x5    22 px / 800  -> gross   -> 3,0
     .sc-v             16 px / 700  -> NORMAL  -> 4,5   (16 < 18,5!)
     .sc-l           10,5 px / 800  -> normal  -> 4,5
     .sc-sub, .sc-grade, Pillen-Labels, .sc-pill-sub  -> normal -> 4,5

   Eine Namensliste haette .sc-v falsch eingestuft. Deshalb setzt dieser
   Baustein aus EINER Nutzerfarbe ZWEI korrigierte Toene: einen fuer die
   grossen Werte (3,0) und einen fuer die kleinen (4,5). Der Nutzer waehlt
   eine Farbe, die App wendet sie so grosszuegig an, wie die Norm es
   zulaesst — das ist Marcels "relativ breit", nur ohne Raten.

   ── DER GRUND, gegen den gerechnet wird ────────────────────────────────────
   Score-Karte: die MARKENFLAECHE. tonAufMarke() zieht gegen alle drei
   Verlaufsstopps — bei Gold hell, bei Partner-Rot dunkel (v1113).
   KPI-Pillen:  WEISS. Steht so in ui-varianten.css:2175 — "Die beiden
   Pillen-Toene stehen auf WEISS, nicht auf der Marke".

   ── EIN RECHENWEG, EIN SCHALTER ────────────────────────────────────────────
   Weg B und Weg C sind NICHT zwei Bauwerke. Derselbe Wert, derselbe
   Rechenweg; in der Mandanten-Ansicht wird still korrigiert, in der eigenen
   nur gewarnt. Genau wie v1122 es schon macht.
   ============================================================================ */
(function () {
  'use strict';
  if (window.DealPilotKartenText) return;

  var K_HERO = 'dp_herotext_ui';
  var K_KPI  = 'dp_kpitext_ui';
  /* Zwei Tokens je Regler: -lg fuer grossen Text (3,0), -sm fuer kleinen (4,5) */
  var T_HERO_LG = '--dp-hero-text-lg', T_HERO_SM = '--dp-hero-text-sm';
  var T_KPI_LG  = '--dp-kpi-text-lg',  T_KPI_SM  = '--dp-kpi-text-sm';

  var MIN_GROSS  = 3.0;   /* WCAG 1.4.3, large text */
  var MIN_NORMAL = 4.5;   /* WCAG 1.4.3, normal text */

  function LS(k, v) {
    try { if (v === undefined) return localStorage.getItem(k);
          if (v === null) { localStorage.removeItem(k); return null; }
          localStorage.setItem(k, v); return v; } catch (e) { return null; }
  }
  function akzent() {
    try {
      var a = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
      return /^#[0-9a-fA-F]{6}$/.test(a) ? a : '#C9A84C';
    } catch (e) { return '#C9A84C'; }
  }
  /* v1123d · GEGEN WELCHEN GRUND gerechnet wird, entscheidet der Skin.
     Erst falsch gebaut, dann gemessen: ich hatte immer gegen die
     MARKENFLAECHE gerechnet. Die Score-Karte ist aber nur unter einer
     HELLEN Vorlage eine Markenflaeche (body.dp-chrome-hell) — sonst sitzt
     sie auf dem dunklen Chrome. Folge: Gold auf dunklem Grund traegt
     (k ueber 8), meine Warnung rechnete es aber gegen Gold und meldete
     trotzdem nichts, weil tonAufMarke den Startwert unveraendert
     zurueckgab. Zwei Fehler, die sich gegenseitig verdeckt haben.

     Dieselbe Zweiteilung macht v1113 selbst: Hell-Skin-Regeln gegen die
     Marke, Gegenrichtungs-Regeln gegen #1A1D22 (_GRUND_DUNKEL). */
  var GRUND_DUNKEL = '#1A1D22';
  function hellSkin() {
    try { return !!(document.body && document.body.classList.contains('dp-chrome-hell')); }
    catch (e) { return false; }
  }
  function tonAufMarke(farbe, min) {
    try {
      if (window.DPC && DPC.branding) {
        if (hellSkin() && DPC.branding.tonAufMarke)
          return DPC.branding.tonAufMarke(akzent(), farbe, min);
        if (DPC.branding.tonFuerGrund)
          return DPC.branding.tonFuerGrund(farbe, GRUND_DUNKEL, min);
      }
    } catch (e) {}
    return farbe;
  }
  function tonAufWeiss(farbe, min) {
    try {
      if (window.DPC && DPC.branding && DPC.branding.tonFuerGrund)
        return DPC.branding.tonFuerGrund(farbe, '#ffffff', min);
    } catch (e) {}
    return farbe;
  }

  /* Mandanten-Ansicht? Dann Weg B — still korrigieren. Sonst Weg C. */
  function fuerMandanten() {
    try { return typeof window._dpResTarget === 'function' && window._dpResTarget() === 'mandanten'; }
    catch (e) { return false; }
  }

  /* Kennzeichen am body: die KPI-Regeln greifen NUR, wenn eine Farbe
     gesetzt ist. Ohne das haette ein var()-Rueckfall den Normalzustand
     angefasst, um einen Sonderfall zu bedienen — .sc-pill-v hat in
     ui-varianten.css gar keine eigene Regel. */
  function kennzeichen(name, an) {
    try {
      if (an) document.body.setAttribute(name, '1');
      else document.body.removeAttribute(name);
    } catch (e) {}
  }

  function setzen(tokenLg, tokenSm, farbe, aufMarke) {
    var r = document.documentElement.style;
    var marke = (tokenLg === T_KPI_LG) ? 'data-dp-kpitext' : 'data-dp-herotext';
    if (!farbe) {
      r.removeProperty(tokenLg); r.removeProperty(tokenSm);
      kennzeichen(marke, false);
      return null;
    }
    kennzeichen(marke, true);
    var f = aufMarke ? tonAufMarke : tonAufWeiss;
    /* Weg B: der korrigierte Wert wandert ins Token.
       Weg C: der Rohwert wandert ins Token, die Korrektur dient nur der Warnung. */
    var lg = f(farbe, MIN_GROSS);
    var sm = f(farbe, MIN_NORMAL);
    if (fuerMandanten()) { r.setProperty(tokenLg, lg); r.setProperty(tokenSm, sm); }
    else { r.setProperty(tokenLg, farbe); r.setProperty(tokenSm, farbe); }
    return { lg: lg, sm: sm, roh: farbe,
             traegtGross: lg.toLowerCase() === farbe.toLowerCase(),
             traegtKlein: sm.toLowerCase() === farbe.toLowerCase() };
  }

  function warnen(id, erg) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!erg) { el.textContent = ''; el.style.display = 'none'; return; }
    if (fuerMandanten()) {
      el.style.display = 'block';
      el.style.color = '#8a8473';
      el.textContent = (erg.traegtGross && erg.traegtKlein)
        ? 'Trägt. Wird unverändert an deine Mandanten gegeben.'
        : 'Für deine Mandanten nachgezogen auf ' + erg.sm.toUpperCase() +
          ' (kleine Texte) — dein Farbton bleibt, nur die Helligkeit wandert.';
      return;
    }
    if (erg.traegtGross && erg.traegtKlein) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = 'block';
    el.style.color = '#B8625C';
    el.textContent = erg.traegtKlein
      ? 'Große Werte tragen nicht — lesbar wäre ' + erg.lg.toUpperCase() + '.'
      : 'Kleine Beschriftungen tragen nicht — lesbar wäre ' + erg.sm.toUpperCase() + '.';
  }

  window._dpDispHeroText = function (h) {
    LS(K_HERO, h);
    warnen('dp-ktext-warn-hero', setzen(T_HERO_LG, T_HERO_SM, h, true));
  };
  window._dpDispKpiText = function (h) {
    LS(K_KPI, h);
    warnen('dp-ktext-warn-kpi', setzen(T_KPI_LG, T_KPI_SM, h, false));
  };

  /* Zuruecksetzen stellt auf die ABLEITUNG zurueck (tonAufMarke aus v1113),
     nicht auf einen festen Wert — sonst friert der Knopf eine Farbe ein, die
     sich mit der Marke aendern soll. Technisch heisst das: Tokens loeschen,
     dann greift wieder var(--uv-sc-*) aus der Kaskade. */
  window._dpDispKartenTextReset = function () {
    LS(K_HERO, null); LS(K_KPI, null);
    setzen(T_HERO_LG, T_HERO_SM, null, true);
    setzen(T_KPI_LG, T_KPI_SM, null, false);
    warnen('dp-ktext-warn-hero', null);
    warnen('dp-ktext-warn-kpi', null);
    try { if (window._dpDispRefresh) window._dpDispRefresh(); } catch (e) {}
    try { if (typeof toast === 'function') toast('Kartentexte zurück auf abgeleitet'); } catch (e) {}
  };

  /* ── Panel-Anbau, Muster aus v938-textcolors ─────────────────────────── */
  function feld(fn, key, label, warnId) {
    var v = LS(key) || '';
    return '<label class="dp-tb-row"><span>' + label + '</span>' +
      '<input type="color" value="' + (v || '#1A1A1A') + '" oninput="' + fn + '(this.value)"></label>' +
      '<div id="' + warnId + '" style="display:none;font-size:10.5px;line-height:1.45;margin:2px 0 6px"></div>';
  }
  var _altLogo = window._dpLogoBlock;
  window._dpLogoBlock = function () {
    var block = '<div class="dp-tb-sec"><b>Text auf Karten</b>' +
      feld('_dpDispHeroText', K_HERO, 'Score-Karte', 'dp-ktext-warn-hero') +
      feld('_dpDispKpiText',  K_KPI,  'KPI-Karten',  'dp-ktext-warn-kpi') +
      '<button class="btn btn-sm" style="width:100%;margin-top:4px" ' +
        'onclick="_dpDispKartenTextReset()">Zurück auf abgeleitet</button>' +
      '<div style="font-size:10.5px;color:#8a8473;margin-top:6px;line-height:1.5">' +
      'Ohne eigene Farbe leitet DealPilot den Ton aus der Marke ab. ' +
      'Unterzeile und Bewertungsstufe bleiben immer abgeleitet.</div></div>';
    return block + (_altLogo ? _altLogo() : '');
  };

  /* ── Boot ───────────────────────────────────────────────────────────────
     Nach dem Laden anwenden, was gespeichert ist. Die Warnung braucht das
     Panel und wird erst beim Oeffnen gezeichnet — deshalb hier nur setzen. */
  function boot() {
    var h = LS(K_HERO), k = LS(K_KPI);
    if (h) setzen(T_HERO_LG, T_HERO_SM, h, true);
    if (k) setzen(T_KPI_LG, T_KPI_SM, k, false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  /* Die Marke steht erst nach dem Plan fest — dann neu rechnen. */
  window.addEventListener('dp:plan-ready', boot);

  window.DealPilotKartenText = {
    apply: boot, reset: window._dpDispKartenTextReset,
    _tokens: { heroLg: T_HERO_LG, heroSm: T_HERO_SM, kpiLg: T_KPI_LG, kpiSm: T_KPI_SM },
    _schwellen: { gross: MIN_GROSS, normal: MIN_NORMAL }
  };
})();
