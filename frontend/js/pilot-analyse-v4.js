/* pilot-analyse-v4.js — v3099 · PILOT-ANALYSE FASSUNG 4 IN DER APP
   ───────────────────────────────────────────────────────────────────────────
   Marcel 03.11.2026: „Pilotanalyse auf Staging einbauen und umsetzen. Grafiken
   und Verläufe einheitlich, so ähnlich wie im Tab Steuern … Risikobewertung und
   alles abgleichen mit dem jetzigen Pilot-Analyse-Tab, dass wir im Detail auch
   normalen Text dazu bekommen, und beim Ankauf eine Gesamtbewertung, ein
   Gesamtstatement mit allem ausführlich – einmal einfach, einmal im Detail."
   Vorlage: design/Vorschläge/pilot-analyse-neu.html (Fassung 4).

   Was hier liegt (ui.js _renderAIServerAnalysis ruft es, ohne diese Datei bleibt
   der Reiter wie bisher):
     huelle()          Kopfzeile (Phase, Stand, Neu abrufen, PDF), Reiterleiste mit Einfach | Detail (v3259), Inhalt
     uebersicht()      Briefing + Kennzahlen + Worauf es ankommt (Einfach)
                       Gesamtstatement in Abschnitten (Detail)
     risiko()          Stärken, Risiken, Risikoanalyse, Worst · Plan · Best
     steuer()          Steuerverlauf (steuer-verlauf.js) + Tabelle nach den Gruppen
                       des Reiters Steuer (tax.js _computeYearTotal) im Detail
     wertverlauf()     Wert gegen Plan als SVG im Stil des Steuerverlaufs
     linien()          dieselbe Bauart für den Index-Verlauf der Marktberichte

   RECHNET NICHTS NEU. Kennzahlen aus State.kpis, Jahre aus State.cfRows
   (wert_y, rs), Steuer aus _computeYearTotal, Marktwerte aus den Berichten
   (DpWertZielbild, /objects/history). Texte aus der Pilot-Analyse; wo ein Feld
   fehlt, fehlt der Abschnitt – nichts wird ergänzt.
   Grafikfarben wie Fassung 4, geprüft (validate_palette): Blau #2f6db5,
   Gold #a6812a; Gold der Marke nur als var(--wl-…). */
(function () {
  'use strict';
  var MERKER = 'dp_pa_modus';
  /* v3151 · Marcel 03.11.2026: „die Grafiken schöner darstellen, farblich ähnlich wie im Tab Steuern, und
     Zahlen dran". Farben wie steuer-verlauf.js: Gold der Marke (Balken, Fläche), Anthrazit als Linie mit
     weißen Punkten, Grün für Gutes, Rot für Negatives, Gold dunkel gestrichelt für Plan/Marken. Gold nur
     als var(--wl-…) und deshalb nur in style="…" (var() wirkt nicht in SVG-Attributen). */
  var C = { c1: '#2A2727', c2: 'var(--wl-c9a84c, #C9A84C)', plan: 'var(--wl-b8932f, #b8932f)', linie: '#2A2727', gut: '#3FA56C', rot: '#B8625C', blau: '#2f6db5', aqua: '#1baf7a',
            gold: 'var(--wl-c9a84c, #C9A84C)', goldHell: 'var(--wl-e8cc7a, #E8CC7A)' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function txt(s) { try { if (typeof window._escClean === 'function') return window._escClean(s); } catch (e) {} return esc(s); }
  function has(x) { return x != null && x !== '' && !(Array.isArray(x) && !x.length); }
  function zahl(v) { return v != null && v !== '' && isFinite(Number(v)); }
  function eur(v) { return (v < 0 ? '− ' : '') + Math.round(Math.abs(v)).toLocaleString('de-DE') + ' €'; }
  function sEur(v) { var r = Math.round(v); return (r > 0 ? '+ ' : r < 0 ? '− ' : '') + Math.abs(r).toLocaleString('de-DE') + ' €'; }
  function de(v, n) { return Number(v).toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n }); }
  function te(v) { return Math.round(v / 1000).toLocaleString('de-DE') + ' T€'; }
  function nice(span) { var r = span / 5, p = Math.pow(10, Math.floor(Math.log(r) / Math.LN10)), f = r / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  /** die ersten n Sätze eines Textes (für Einfach) */
  function saetze(t, n) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    /* nur an einem Satzende trennen, auf das ein Großbuchstabe, eine Ziffer am Satzanfang oder ein Anführungszeichen folgt -
       nie im Tausenderpunkt (2.002 €) oder in Abkürzungen mit Kleinbuchstaben danach (z. B., ca. 5 %) */
    var teile = t.split(/(?<=[.!?])(?<!(?:^|[\s(])(?:z|B|u|a|d|h|v|o|ca|bzw|ggf|inkl|etc|Nr|Str|evtl|max|min|rd|sog|vgl|Mio|Mrd|Tsd|Abs|S|Dr|St|zzgl|abzgl)\.)\s+(?=[A-ZÄÖÜ„"(])/), out = teile.slice(0, n);
    return out.join(' ');
  }

  /* v3987 · F15 Gesamt-Flow 22.11.2026: Gesamtbewertung, Begründung, Investmentbewertung und Insight wiederholten dieselben
     Sätze (die KI schreibt sie in mehrere Felder). Ein Satz steht nur in der ERSTEN Rubrik, in der er vorkommt; was danach
     leer bleibt, entfällt. Gleich heißt: gleicher Wortlaut ohne Satzzeichen und Groß-/Kleinschreibung. */
  function ohneDoppel(texte) {
    var gesehen = {};
    var schl = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9äöüß%€]+/g, ' ').trim(); };
    return texte.map(function (t) {
      var teile = saetze(t, 999); if (!teile) return t;
      var alle = String(teile).split(/(?<=[.!?])(?<!(?:^|[\s(])(?:z|B|u|a|d|h|v|o|ca|bzw|ggf|inkl|etc|Nr|Str|evtl|max|min|rd|sog|vgl|Mio|Mrd|Tsd|Abs|S|Dr|St|zzgl|abzgl)\.)\s+(?=[A-ZÄÖÜ„"(])/);
      var rest = alle.filter(function (s) { var k = schl(s); if (!k || k.length < 12) return true; if (gesehen[k]) return false; gesehen[k] = 1; return true; });
      return rest.join(' ');
    });
  }

  /* ── Modus Einfach | Detail ──────────────────────────────────────────── */
  function modus() { try { return localStorage.getItem(MERKER) === 'detail' ? 'detail' : 'einfach'; } catch (e) { return 'einfach'; } }
  function setzeModus(m) {
    m = m === 'detail' ? 'detail' : 'einfach';
    try { localStorage.setItem(MERKER, m); } catch (e) {}
    /* Ankauf · Bestand · Zielbild hat seinen eigenen Umschalter (wert-zielbild.js,
       Einfach | Genau) – er folgt diesem, damit es einen Schalter gibt. */
    try { localStorage.setItem('dp_pa_si_ansicht', m === 'detail' ? 'genau' : 'einfach'); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('.dp-pa-wrap[data-dp-pa-v4]'), function (w) {
      w.setAttribute('data-dp-pa-modus', m);
      Array.prototype.forEach.call(w.querySelectorAll('[data-dp-pa-modus-knopf]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-dp-pa-modus-knopf') === m)); });
      Array.prototype.forEach.call(w.querySelectorAll('.dp-si'), function (s) { s.setAttribute('data-dp-si-modus', m === 'detail' ? 'genau' : 'einfach'); });
      /* v3099e · Unterlagen & WEG hat einen eigenen Einfach|Genau-Schalter (unterlagen.js) - er folgt */
      try {
        var ub = w.querySelector('.dpu-umschalter button[data-art="' + (m === 'detail' ? 'genau' : 'einfach') + '"]');
        if (ub && window.DpUnterlagen && window.DpUnterlagen.ansicht) window.DpUnterlagen.ansicht(ub, m === 'detail' ? 'genau' : 'einfach');
      } catch (e) {}
    });
    try { localStorage.setItem('dp_unterlagen_ansicht', m === 'detail' ? 'genau' : 'einfach'); } catch (e) {}
    neuZeichnen();
  }
  function neuZeichnen() {
    try { if (window.DpSteuerVerlauf) window.DpSteuerVerlauf.mountAll(); } catch (e) {}
    try { if (_letzteHist) wertverlauf(_letzteHist); } catch (e) {}
    try { steuerTabelleAlle(); } catch (e) {}
    try { minisZeichnen(); } catch (e) {}
    try { siZeichnen(); } catch (e) {}
    try { wertKopfAlle(); lageAlle(); } catch (e) {}
    try { Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa5-steuerkopf]'), function (h) { var c = window._dpBegriff ? window._dpBegriff().corp : false; h.innerHTML = steuerKopf(h.getAttribute('data-dp-pa5-steuerkopf') === 'b', c); }); } catch (e) {}
  }

  /* ══ v3440 · GESTALTUNG WIE DIE DEMO (design/Vorschläge/pilot-analyse-demo.html, Fassung 2) ══════════
     Marcel 15.11.2026: „die Demo ist super, gerne noch professionelle Grafiken rein … setz alles um, was geht".
     Gemessen vorher (Staging v3420): jede Teilfläche war eine eigene .dp-pa-card (weiß, Rahmen, Schatten) im
     weißen Panel - Kasten in Kasten; Überschriften mit goldenem Balken; im Detail eine goldene Randlinie.
     Kaskade: .dp-pa-card steht EINMAL in style.css (Z. 33279, ohne !important) und .abw-tafel-host (Z. 40369/
     40487) - beides wird hier unter .dp-pa-wrap[data-dp-pa-v4] .dp-pa-content (0,3,0 + Klasse) flach gelegt.
     Knöpfe tragen .btn-clean: „.sec button:not(…)" (0,9,1 !important) nimmt sie aus.
     Jetzt: EIN Rahmen um den Inhalt, je Reiter oben ein Ergebnissatz (Space Grotesk 19 px) mit einem
     Hauptknopf, Kennzahlleisten mit Trennlinien, Tabellen mit Gruppenzeilen, Zahlen rechtsbündig in fester
     Ziffernbreite, Köpfe in JetBrains Mono, Gold nur am aktiven Reiter, am Hauptknopf und am gewählten
     Unterschalter. Grün und Rot nur für Abweichungen. */
  var GB = 'color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, #fff)';
  var STIL5 = [
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-leiste{margin:0;border-radius:14px 14px 0 0;border-bottom-color:#EFEAE0}',
    '.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-content{border:1px solid #E6DCC2;border-top:0;border-radius:0 0 14px 14px;background:#fff;padding:22px 22px 26px;box-sizing:border-box;max-width:100%}',
    '@media (max-width:640px){.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-content{padding:16px 12px 20px}}',
    /* ein Rahmen statt Kasten in Kasten */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-card,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .abw-tafel-host{background:transparent !important;border:0 !important;border-radius:0 !important;box-shadow:none !important;padding:0 !important;margin:0 0 26px !important}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-cols > .dp-pa-card{margin:0 !important}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-cols{gap:28px;margin:0 0 26px}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-sec{margin:0 0 10px;gap:10px}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-sec .dp-pa-bar,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-sec .dp-pa-sq{display:none}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-lbl{font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.09em;color:#6B645A}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-sec.good .dp-pa-lbl{color:#2E7D50}.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-sec.bad .dp-pa-lbl{color:#B8625C}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-rule{background:#EFEAE0}',
    '.dp-pa-wrap[data-dp-pa-v4] .abw-kopf h4{font:600 15px "Space Grotesk",Inter,sans-serif;color:#2A2727}',
    /* Gold zurücknehmen: Textabschnitte, Hinweissätze, Wegweiser */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-a{border-left:2px solid #EFEAE0}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-a h4{color:#6B645A}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-satz,.dp-pa-wrap[data-dp-pa-v4] .dp-stv-satz{background:#FAF8F3;border-left:2px solid #D9D2C3}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-wk i{color:#9A9285}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-link{color:#2A2727 !important}',
    '.dp-pa-wrap[data-dp-pa-v4] .abw-bewegt{background:#FAF8F3}',
    '.dp-pa-wrap[data-dp-pa-v4] .abw-tafel tr.abw-gruppe td{color:#6B645A;border-bottom-color:#EFEAE0}',
    /* Hauptknopf und leiser Knopf */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-btn,.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-knopf{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--wl-c9a84c, #C9A84C) !important;background:' + GB + ' !important;color:#2A2727 !important;border-radius:8px !important;padding:7px 13px !important;font:600 13px Inter,system-ui,sans-serif !important;cursor:pointer;box-shadow:none !important;min-height:0 !important;white-space:nowrap}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-btn.leise,.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-knopf.leise{border-color:#E6DCC2 !important;background:#fff !important;font-weight:500 !important}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-btn:hover,.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-knopf:hover{border-color:var(--wl-b8932f, #b8932f) !important}',
    /* Ergebnissatz je Reiter */
    '.dp-pa5-erg{display:flex;gap:14px 18px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;padding:0 0 16px;border-bottom:1px solid #EFEAE0;margin:0 0 18px}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content p.dp-pa5-satz{flex:1 1 380px;margin:0;font:500 19px/1.38 "Space Grotesk",Inter,sans-serif;letter-spacing:-.005em;color:#2A2727;max-width:760px;text-align:left !important;-webkit-hyphens:manual;hyphens:manual}',
    '.dp-pa5-satz b{font-weight:600}',
    '.dp-pa5-rechts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:0 0 auto}',
    '@media (max-width:640px){.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content p.dp-pa5-satz{font-size:17px;flex-basis:100%}}',
    /* Score rechts im Ergebnis (Übersicht) - Klassen dp-pa4-urteil/.z/.u bleiben (Messe-Drehbuch Modul 11) */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-erg .dp-pa4-urteil{display:flex;align-items:center;gap:10px;min-width:0;border:1px solid #EFEAE0;border-radius:10px;padding:8px 12px;background:#fff}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-erg .dp-pa4-urteil .z{font:600 26px/1 "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-erg .dp-pa4-urteil .u{display:grid;font:500 11.5px/1.35 Inter,sans-serif;color:#6B645A}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-erg .dp-pa4-urteil .u b{font:600 13px Inter,sans-serif;color:#2A2727}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-erg .dp-pa-empf{padding:5px 12px;font-size:12.5px}',
    /* Kennzahlleiste mit Trennlinien (ersetzt die Kacheln mit farbiger Oberkante) */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-zahlen{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0;border:1px solid #EFEAE0;border-radius:10px;overflow:hidden;margin:0 0 20px}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-zahlen.l4{grid-template-columns:repeat(4,minmax(0,1fr))}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z{border:0;border-right:1px solid #EFEAE0;padding:12px 14px;gap:2px;min-width:0}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z:last-child{border-right:0}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z span{font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.07em;color:#6B645A}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z b{font:600 20px/1.25 "Space Grotesk",Inter,sans-serif;margin-top:2px}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z em{font-size:12px;color:#6B645A}',
    '@media (max-width:640px){.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-zahlen,.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-zahlen.l4{grid-template-columns:repeat(2,minmax(0,1fr))}'
      + '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z:nth-child(2n){border-right:0}.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z:nth-child(n+3){border-top:1px solid #EFEAE0}'
      + '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-z b{font-size:17px}}',
    /* Steuerverlauf (steuer-verlauf.js) in der Pilot-Analyse: dieselbe Leiste, Raster als Haarlinie */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-stv-zahlen{gap:0;border:1px solid #EFEAE0;border-radius:10px;overflow:hidden}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-stv-z{border:0;border-right:1px solid #EFEAE0;padding:12px 14px}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-stv-z:last-child{border-right:0}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-stv-z span{font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.07em}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-stv-z b{font-weight:600}',
    '@media (max-width:640px){.dp-pa-wrap[data-dp-pa-v4] .dp-stv-z:nth-child(2n){border-right:0}.dp-pa-wrap[data-dp-pa-v4] .dp-stv-z:nth-child(n+3){border-top:1px solid #EFEAE0}}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-stv-ch .gl{stroke:#F1ECE1}.dp-pa-wrap[data-dp-pa-v4] .dp-stv-ch .nl{stroke:#9A9285;stroke-width:1}',
    /* Abschnittsköpfe */
    '.dp-pa5-ab{display:flex;align-items:baseline;gap:6px 12px;margin:26px 0 10px;flex-wrap:wrap}',
    '.dp-pa5-ab:first-child{margin-top:0}',
    '.dp-pa5-ab h3{margin:0;font:600 15px/1.3 "Space Grotesk",Inter,sans-serif;color:#2A2727}',
    '.dp-pa5-eti{margin-left:auto;font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#9A9285}',
    '@media (max-width:640px){.dp-pa5-eti{margin-left:0;flex-basis:100%}}',
    /* Tabellen */
    '.dp-pa5-tab{overflow-x:auto;border:1px solid #EFEAE0;border-radius:10px;max-width:100%;--dpm-schiene:1}',
    '.dp-pa5-tab table{width:100%;border-collapse:collapse;font:400 13px/1.45 Inter,system-ui,sans-serif;color:#2A2727}',
    '.dp-pa5-tab th,.dp-pa5-tab td{text-align:right;padding:8px 10px;border-bottom:1px solid #EFEAE0;font-variant-numeric:tabular-nums;white-space:nowrap;vertical-align:top}',
    '.dp-pa5-tab th:first-child,.dp-pa5-tab td:first-child{text-align:left;white-space:normal;min-width:140px}',
    '.dp-pa5-tab thead th{font:500 10.5px/1.35 "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B645A;border-bottom-color:#E6DCC2;vertical-align:bottom;background:#fff}',
    '.dp-pa5-tab thead th small{display:block;text-transform:none;letter-spacing:0;font:400 11px Inter,sans-serif;color:#9A9285}',
    '.dp-pa5-tab td small{display:block;color:#9A9285;font-size:11px;font-weight:400;white-space:normal;min-width:96px}',
    '@media (min-width:900px){.dp-pa5-tab th:first-child,.dp-pa5-tab td:first-child{min-width:190px}}',
    /* v3442 · gemessen bei 390 px: Kennzahl-Spalte 140 px plus Werte mit Unterzeile ohne Umbruch - nur die erste Wertspalte war zu sehen */
    '@media (max-width:640px){.dp-pa5-tab table{font-size:12.5px}.dp-pa5-tab th,.dp-pa5-tab td{padding:7px 7px}.dp-pa5-tab th:first-child,.dp-pa5-tab td:first-child{min-width:0;max-width:128px}.dp-pa5-tab td small{min-width:0}.dp-pa5-tab thead th{font-size:9.5px;letter-spacing:.04em}}',
    '.dp-pa5-tab tr.gr td{font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B645A;padding-top:14px;background:none}',
    '.dp-pa5-tab tr.su td{font-weight:600;border-top:1px solid #E6DCC2}',
    '.dp-pa5-tab tbody tr:not(.gr):hover td{background:#FAF8F3}',
    '.dp-pa5-tab tbody tr:last-child td{border-bottom:0}',
    '.dp-pa5-tab .hebel{background:#FCFBF7}',
    '.dp-pa5-tab .gut{color:#2E7D50}.dp-pa5-tab .schlecht{color:#B8625C}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa5-hin{margin:8px 0 0;font:400 12.5px/1.55 Inter,system-ui,sans-serif;color:#6B645A;text-align:left !important;max-width:90ch}',
    /* Tabellen anderer Module in denselben Ton (Kopf in Mono, feste Ziffernbreite) */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content :is(.abw-tafel,.dp-pot table,.dp-pa4-tab table,.dp-pap-tab table,.dp-wz-t) th{font-family:"JetBrains Mono",monospace;font-weight:500;letter-spacing:.07em;color:#6B645A;background:#fff}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content :is(.abw-tafel,.dp-pot table,.dp-pa4-tab table,.dp-pap-tab table,.dp-wz-t) td{font-variant-numeric:tabular-nums}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-tab{border-color:#EFEAE0;border-radius:10px}.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-tab tr.gr td{background:none}',
    /* Unterumschalter Potenzial · Risiken · Anschluss · Exit */
    '.dp-pa5-unter{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-unter button{border:1px solid #E6DCC2 !important;background:#fff !important;color:#4A4542 !important;border-radius:8px !important;padding:6px 13px !important;font:500 13px Inter,system-ui,sans-serif !important;cursor:pointer;box-shadow:none !important;min-height:0 !important}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-unter button[aria-pressed="true"]{border-color:var(--wl-c9a84c, #C9A84C) !important;background:' + GB + ' !important;color:#050505 !important;font-weight:600 !important}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa5-zu{display:none !important}',
    '.dp-pa-wrap[data-dp-pa-v4] [data-dp-pa5-teil]{margin-top:0 !important}',
    /* zwei Spalten (Übersicht) */
    '.dp-pa5-zwei{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:12px 28px;margin:0 0 6px}',
    '@media (max-width:720px){.dp-pa5-zwei{grid-template-columns:1fr}}',
    /* v3442 · im Detail stehen links die ganzen Texte - eine Spalte, sonst wird die schmale Spalte lang (gemessen 1.715 px) */
    '.dp-pa-wrap[data-dp-pa-modus="detail"] .dp-pa5-zwei{grid-template-columns:1fr}',
    '.dp-pa5-zwei > div{min-width:0}',
    /* Zielerreichung */
    '.dp-pa5-ziel{display:grid;grid-template-columns:minmax(96px,170px) minmax(0,1fr) 52px;gap:4px 12px;align-items:center}',
    '.dp-pa5-ziel > span{font:400 13px Inter,sans-serif;color:#4A4542}',
    '.dp-pa5-ziel .bahn{height:8px;border-radius:4px;background:#F1ECE1;position:relative;overflow:hidden}',
    '.dp-pa5-ziel .bahn i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:#2f6db5}',
    '.dp-pa5-ziel > b{text-align:right;font:600 13px Inter,sans-serif;font-variant-numeric:tabular-nums;color:#2A2727}',
    '.dp-pa5-ziel > small{grid-column:2 / -1;margin:-2px 0 6px;font:400 11.5px/1.4 Inter,sans-serif;color:#9A9285}',
    /* Szenarien flach, Statusfarbe nur als Oberkante */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-szk{border:1px solid #EFEAE0;border-top:3px solid var(--c,#2A2727);border-radius:10px;background:#fff}',
    /* Detail-Hülle der DpPotenzial-Karte: ihre eigene Kennzahlen-Tafel ist durch die Kennzahlen-Tabelle ersetzt */
    '.dp-pa-wrap[data-dp-pa-v4] [data-dp-pa5-pot] .dp-pot > .dp-pot-scroll:not([style]){display:none}',
    '.dp-pa-wrap[data-dp-pa-v4] [data-dp-pa5-pot] .dp-pa-sec{display:none}',
    '.dp-pa5-mehr{margin:26px 0 0;border-top:1px solid #EFEAE0;padding-top:12px}',
    '.dp-pa5-mehr > summary{cursor:pointer;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;font:600 15px/1.3 "Space Grotesk",Inter,sans-serif;color:#2A2727;list-style:none}',
    '.dp-pa5-mehr > summary::-webkit-details-marker{display:none}',
    '.dp-pa5-mehr > summary::before{content:"+";font:500 15px "JetBrains Mono",monospace;color:#9A9285;width:12px}',
    '.dp-pa5-mehr[open] > summary::before{content:"–"}',
    '.dp-pa5-mehr[open] > summary{margin-bottom:12px}',
    /* Grafiken: Raster als Haarlinie, Werte in Textfarbe (dataviz: Text trägt nie die Reihenfarbe) */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-ch .gl{stroke:#F1ECE1}.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-ch .nl{stroke:#9A9285;stroke-width:1}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-ch .wz,.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-ch .wz-l{fill:#2A2727}',
    '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-leg{font:500 10.5px "JetBrains Mono",monospace;gap:8px 16px}',
    /* Wert je Verfahren (wertvergleich.js): Erklärtexte nur im Detail, Zwischenköpfe in Textfarbe */
    '.dp-pa-wrap[data-dp-pa-v4] .dp-wv .dp-wv-h{color:#2A2727}',
    '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-wv > .dp-wv-h,.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-wv > p.dp-pa-p{display:none !important}'
  ];

  /* ── Bausteine der Fassung 5 (v3440) ─────────────────────────────────── */
  function ergebnis(satz, rechts) { return '<div class="dp-pa5-erg"><p class="dp-pa5-satz">' + satz + '</p>' + (rechts ? '<div class="dp-pa5-rechts">' + rechts + '</div>' : '') + '</div>'; }
  function knopf(text, onclick, leise, extra) { return '<button type="button" class="btn-clean dp-pa5-knopf' + (leise ? ' leise' : '') + '"' + (onclick ? ' onclick="' + onclick + '"' : '') + (extra || '') + '>' + text + '</button>'; }
  function abKopf(titel, eti) { return '<div class="dp-pa5-ab"><h3>' + esc(titel) + '</h3>' + (eti ? '<span class="dp-pa5-eti">' + esc(eti) + '</span>' : '') + '</div>'; }
  function hinweis(t, kl) { return t ? '<p class="dp-pa5-hin' + (kl ? ' ' + kl : '') + '">' + t + '</p>' : ''; }
  /* Tabelle: kopf = [Text|{t,u,kl}], zeilen = [{gr:'…'} | {z:[…], kl:'…', d:true (nur Detail)}] */
  function tabelle(kopf, zeilen, attr) {
    var n = kopf.length;
    var th = kopf.map(function (k) { k = typeof k === 'string' ? { t: k } : k; return '<th' + (k.kl ? ' class="' + k.kl + '"' : '') + '>' + k.t + (k.u ? '<small>' + k.u + '</small>' : '') + '</th>'; }).join('');
    var tb = zeilen.map(function (z) {
      if (!z) return '';
      if (z.gr) return '<tr class="gr' + (z.d ? ' dp-pa-d' : '') + '"><td colspan="' + n + '">' + z.gr + '</td></tr>';
      var kl = [z.kl || '', z.d ? 'dp-pa-d' : ''].join(' ').trim();
      return '<tr' + (kl ? ' class="' + kl + '"' : '') + '>' + z.z.map(function (c, i) {
        c = (c == null || c === '') ? '–' : c;
        var ck = z.zk && z.zk[i] ? z.zk[i] : (kopf[i] && kopf[i].kl ? kopf[i].kl : '');
        return '<td' + (ck ? ' class="' + ck + '"' : '') + '>' + c + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="dp-pa5-tab"' + (attr || '') + '><table><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table></div>';
  }
  function pct(v, n) { return de(v, n == null ? 2 : n) + ' %'; }
  function feldWert(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
  function feldZahl(id) { var t = feldWert(id); if (!t) return null; if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.'); var n = parseFloat(t); return isFinite(n) ? n : null; }
  function datumDe(iso) { var s = String(iso || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('.') : ''; }

  /* ── Stil ────────────────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dp-pa4-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-pa4-stil';
    s.textContent = [
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-pa-d,.dp-pa-wrap[data-dp-pa-modus="detail"] .dp-pa-e{display:none !important}',
      /* wert-zielbild hat einen eigenen Einfach|Genau-Schalter - in Fassung 4 steuert der Kopf */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-si-um{display:none !important}',
      /* Hülle: Fassung 4 hat die Unterreiter waagrecht oben (die bisherige Hülle ist ein Raster mit senkrechter Leiste) */
      '.dp-pa-wrap[data-dp-pa-v4]{display:block !important}',
      /* v3259 · Marcel 09.11.2026: „man sieht überhaupt nicht die Reiter … darüber steht einfach zu viel".
         Gemessen vorher (Westerfeldstr. 140, Bestand, 1568 px): Stand-Kasten 58 px, „Analyse neu abrufen" 30 px,
         Phase/Info/PDF/Einfach|Detail 36 px, Kurzfassung-Zeile 20 px - die Reiter begannen 182 px unter dem
         Panelanfang, grau (#7A7370) auf weiß, aktive Marke 2 px. Jetzt: EINE Kopfzeile (Phase · Stand einzeilig ·
         Neu abrufen · PDF), darunter die Reiterleiste als eigene Fläche mit Einfach|Detail rechts. */
      '#s5:has(.dp-pa-wrap[data-dp-pa-v4]) > .sec-desc{display:none !important}',
      '.dp-pa4-kopf{display:flex;align-items:center;gap:8px;margin:0 0 8px;min-width:0}',
      '.dp-pa4-kopf > .dp-pa4-phase{flex:0 0 auto}',
      '.dp-pa4-stand-host{flex:1 1 auto;min-width:0;display:flex}',
      /* der Stand-Kasten (ui.js, Klassen setzt ui.js nachträglich neu - deshalb über den Host gestaltet) einzeilig, Tipp öffnet ihn */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-stand-host > .dp-pa-stand{margin:0 !important;padding:5px 30px 5px 10px !important;width:100%;min-width:0;box-sizing:border-box;font-size:12px !important;line-height:1.45 !important;border-radius:8px !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;position:relative}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-stand-host > .dp-pa-stand::after{content:"▾";position:absolute;right:10px;top:5px;font-size:11px;opacity:.8}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-stand-host.auf > .dp-pa-stand{white-space:normal}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-stand-host.auf > .dp-pa-stand::after{content:"▴"}',
      '.dp-pa4-aktionen{display:flex;gap:6px;align-items:center;flex:0 0 auto}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-akt{display:inline-flex !important;align-items:center;gap:6px;border:1px solid #E6DCC2 !important;background:#fff !important;color:#2A2727 !important;border-radius:9px !important;padding:6px 11px !important;font:600 12.5px "Space Grotesk",Inter,sans-serif !important;cursor:pointer;box-shadow:none !important;min-height:0 !important;white-space:nowrap}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-akt:hover{border-color:var(--wl-c9a84c,#C9A84C) !important}',
      '.dp-pa4-akt svg{width:14px;height:14px;flex:0 0 auto}',
      /* Reiterleiste: eigene Fläche, Schrift und Kontrast wie die Hauptreiter, aktive Marke Gold 3 px */
      '.dp-pa4-leiste{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:0 8px 0 0;background:#fff;border:1px solid #E6DCC2;border-radius:12px;position:relative;min-width:0}',
      '.dp-pa4-rail-box{position:relative;flex:1 1 auto;min-width:0;display:flex}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-rail-box > .dp-pa-rail{flex:1 1 auto;display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;gap:0 !important;overflow-x:auto !important;overflow-y:hidden !important;border:0 !important;margin:0 !important;padding:0 4px !important;position:static !important;width:auto !important;min-width:0 !important;height:auto !important;background:transparent !important;box-shadow:none !important;scrollbar-width:none;scroll-behavior:smooth}',
      '.dp-pa4-rail-box > .dp-pa-rail::-webkit-scrollbar{display:none}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-rail-box > .dp-pa-rail .dp-pa-tab{flex:0 0 auto !important;width:auto !important;min-width:0 !important;border:0 !important;border-bottom:3px solid transparent !important;border-radius:0 !important;background:transparent !important;box-shadow:none !important;padding:12px 13px 10px !important;margin:0 !important;font:600 14px "Space Grotesk",Inter,sans-serif !important;color:#4A4542 !important;white-space:nowrap !important;text-align:center !important;min-height:0 !important}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-rail-box > .dp-pa-rail .dp-pa-tab:hover{color:#050505 !important;background:#FBF6E9 !important}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-rail-box > .dp-pa-rail .dp-pa-tab.active{color:#050505 !important;border-bottom-color:var(--wl-c9a84c,#C9A84C) !important;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 10%, transparent) !important}',
      /* Hinweis auf weitere Reiter: Verlauf an der Kante plus Pfeilknopf, nur wenn dort wirklich mehr liegt (leisteMessen) */
      '.dp-pa4-mehr-r,.dp-pa4-mehr-l{display:none;position:absolute;top:0;bottom:0;width:38px;border:0 !important;padding:0 !important;margin:0 !important;cursor:pointer;font:700 18px/1 "Space Grotesk",Inter,sans-serif !important;color:#2A2727 !important;box-shadow:none !important;min-height:0 !important;z-index:2}',
      '.dp-pa4-mehr-r{right:0;justify-content:flex-end;padding-right:4px !important;background:linear-gradient(90deg,rgba(255,255,255,0),#fff 60%) !important}',
      '.dp-pa4-mehr-l{left:0;justify-content:flex-start;padding-left:4px !important;background:linear-gradient(270deg,rgba(255,255,255,0),#fff 60%) !important}',
      '.dp-pa4-rail-box[data-mehr-r="1"] > .dp-pa4-mehr-r,.dp-pa4-rail-box[data-mehr-l="1"] > .dp-pa4-mehr-l{display:flex;align-items:center}',
      '.dp-pa4-leiste > .dp-pa4-seg{flex:0 0 auto}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-kopf > .dp-pa4-seg{display:none !important}',
      '@media (max-width:640px){'
        + '.dp-pa4-kopf{flex-wrap:wrap}'
        + '.dp-pa4-stand-host{order:5;flex-basis:100%}'
                + '.dp-pa4-akt .dp-pa4-akt-t{display:none}'
        + '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-akt{padding:7px 9px !important}'
        + '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-kopf > .dp-pa4-seg{display:inline-flex !important;margin-left:auto}'
        + '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-leiste > .dp-pa4-seg{display:none !important}'
        + '.dp-pa4-leiste{padding:0}'
        + '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-rail-box > .dp-pa-rail .dp-pa-tab{padding:12px 11px 10px !important;font-size:13.5px !important}'
        + '.dp-pa4-phase small{display:none}'
      + '}',
      '.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-content{width:auto !important;min-width:0 !important}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-mt{margin-top:12px}',
      /* gemessen bei 390 px: die Tafel der Zielerreichung (jahresstaende.js) stand 78 px über den Rand - quer scrollen wie die übrigen Tafeln */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-ziel{overflow-x:auto;max-width:100%}',
      '.dp-pa4-reihe{display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-width:0}',
      '.dp-pa4-phase{font:600 12px "Space Grotesk",Inter,sans-serif;padding:6px 11px;border-radius:8px;background:#FBF6E9;color:#2A2727;white-space:nowrap;cursor:default}',
      '.dp-pa4-phase small{font:400 11px Inter,sans-serif;color:#7A7370;margin-left:6px}',
      '.dp-pa4-info{font:400 12px Inter,system-ui,sans-serif;color:#7A7370}',
      /* v3099e/g · Marcel: „man sieht nicht, wo man ist" - gemessen: der gedrückte Knopf hatte background none;
         die Regel .sec button:not(…)×8 (style.css, Spezifität 0,9,1) nimmt .btn-clean aus - alle Knöpfe hier tragen sie.
         (eine ältere Knopf-Regel gewinnt). Jetzt mit !important und höherer Spezifität, dazu die Zeile darunter. */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-seg{display:inline-flex !important;border:1px solid #E6DCC2 !important;border-radius:10px !important;padding:3px !important;background:#fff !important;gap:2px}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-seg button{border:0 !important;background:transparent !important;color:#7A7370 !important;font:600 12.5px "Space Grotesk",Inter,sans-serif !important;padding:6px 14px !important;border-radius:7px !important;cursor:pointer;box-shadow:none !important;min-height:0 !important}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-seg button[aria-pressed="true"]{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f)) !important;color:#050505 !important}',
      /* v3259 · die Zeile „Kurzfassung … / Ausführlich …" ist gefallen - der Text steht als Tooltip am Umschalter */
      /* v3440 · hier stand die goldene Randlinie im Detail - Gold nur noch am aktiven Reiter und an offenen Aufgaben (Demo Fassung 2) */
      /* „Pilot-Analyse starten" stand über allem - jetzt „Neu abrufen" unter der Stand-Zeile; PDF-Bausteine auf Knopfdruck */
      '#s5 .ai-box:has(#ai-content .dp-pa-wrap[data-dp-pa-v4]) > #ai-btn{display:none !important}',
      '#s5 .ai-box:has(#ai-content .dp-pa-wrap[data-dp-pa-v4]):not(.dp-pa4-pdf-offen) > .ai-pdf-toggle{display:none !important}',
      /* eigene Schalter anderer Module folgen dem Kopf */
      '.dp-pa-wrap[data-dp-pa-v4] .dpu-umschalter{display:none !important}',
      /* v4007 · im Reiter Haus & Unterlagen: Nachreichen-Knopf und Ampel stehen oben im Hausverlauf */
      '#dp-pa-haus:has(#dp-pa-hausv [data-dp-hv]) .dpu-nach,#dp-pa-haus:has(.dp-hv-ampel) .dpu-wrap .dpu-ampel{display:none !important}',
      /* v3440 · „Wert je Verfahren" (#dp-pa-wert-body) steht jetzt in beiden Ansichten */
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-stv-fuss{display:none !important}',
      /* Mini-Grafiken (Einfach) und Beleg-Stand */
      '.dp-pa4-mini{margin:0 0 12px}',
      '.dp-pa4-mini h5{margin:0 0 6px;font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A}',
      '.dp-pa4-hb{display:grid;grid-template-columns:110px minmax(0,1fr) 64px;gap:6px 10px;align-items:center;font:500 12px Inter,sans-serif;color:#2A2727}',
      '.dp-pa4-hb i{display:block;height:12px;border-radius:0 4px 4px 0;background:var(--c,#2f6db5)}',
      '.dp-pa4-hb .bahn{background:#F1ECE1;border-radius:0 4px 4px 0}',
      '.dp-pa4-hb b{text-align:right;font:600 12.5px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.dp-pa4-belege{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}',
      '.dp-pa4-bj{display:inline-flex;align-items:center;gap:6px;font:500 12px Inter,sans-serif;padding:4px 10px;border-radius:999px;background:#F1ECE1;color:#4A4542}',
      '.dp-pa4-bj.ok{background:#E6F3EB;color:#2E7D50}.dp-pa4-bj.fehlt{background:#F8EFD6;color:#8a6d1f}',
      '.dp-pa4-bj::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}',
      '.dp-pa4-btn{border:1px solid var(--wl-b8932f,#b8932f);background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#050505;border-radius:9px;padding:7px 13px;font:600 12.5px "Space Grotesk",Inter,sans-serif;cursor:pointer}',
      '.dp-pa4-btn.leise{background:#fff;border-color:#E6DCC2;color:#2A2727}',
      '.dp-pa4-pdf{border:1px solid #E6DCC2;background:#fff;color:#2A2727;border-radius:9px;padding:7px 12px;font:600 12.5px "Space Grotesk",Inter,sans-serif;cursor:pointer}',
      /* Briefing */
      '.dp-pa4-brief{background:#050505;color:#F1EDE5;border-radius:12px;padding:16px 18px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 22px;align-items:start;margin:0 0 12px}',
      '.dp-pa4-urteil{min-width:150px;display:grid;gap:6px;align-content:start}',
      '.dp-pa4-urteil small{font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;color:#A49D92;text-transform:uppercase}',
      '.dp-pa4-urteil .z{font:700 30px/1 "Space Grotesk",Inter,sans-serif;color:var(--wl-e8cc7a,#E8CC7A)}',
      '.dp-pa4-urteil .u{font:500 11.5px Inter,sans-serif;color:#A49D92}',
      '.dp-pa4-brief p{margin:0;font:400 13.5px/1.55 Inter,system-ui,sans-serif;color:#F1EDE5}',
      '.dp-pa4-brief p+p{margin-top:6px}',
      '@media (max-width:620px){.dp-pa4-brief{grid-template-columns:1fr}}',
      /* Kennzahl-Karten (wie die Zahlen des Steuerverlaufs) */
      '.dp-pa4-zahlen{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 12px}',
      '.dp-pa4-z{border-top:3px solid var(--c,#E6DCC2);padding-top:6px;display:grid;gap:1px;min-width:0}',
      '.dp-pa4-z span{font:500 10px Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#6B645A}',
      '.dp-pa4-z b{font:700 19px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums;color:#2A2727;overflow-wrap:anywhere}',
      '.dp-pa4-z em{font-style:normal;font-size:11px;color:#8A8272}',
      '.dp-pa4-satz{margin:0 0 12px;padding:9px 12px;background:#FBF6E9;border-left:3px solid var(--wl-c9a84c,#C9A84C);font:400 13px/1.5 Inter,sans-serif;color:#2A2727;max-width:90ch}',
      /* Abschnitte des Gesamtstatements */
      '.dp-pa4-ta{display:grid;gap:12px}',
      '.dp-pa4-a{border-left:3px solid var(--wl-c9a84c,#C9A84C);padding:2px 0 2px 14px;display:grid;gap:4px}',
      '.dp-pa4-a h4{margin:0;font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-b8932f,#8a6d1f)}',
      '.dp-pa4-a p,.dp-pa4-a li{margin:0;font:400 13.5px/1.6 Inter,system-ui,sans-serif;color:#2A2727}',
      '.dp-pa4-a ul{margin:0;padding-left:18px;display:grid;gap:3px}',
      '.dp-pa4-a dl{margin:0;display:grid;gap:4px}.dp-pa4-a dt{font:600 12.5px Inter,sans-serif;color:#2A2727}.dp-pa4-a dd{margin:0 0 4px;font:400 13.5px/1.6 Inter,sans-serif;color:#2A2727}',
      /* Worauf es ankommt */
      '.dp-pa4-zwei{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
      '@media (max-width:620px){.dp-pa4-zwei{grid-template-columns:1fr}}',
      '.dp-pa4-liste{margin:6px 0 0;padding-left:18px;display:grid;gap:4px;font:400 13px/1.5 Inter,sans-serif;color:#2A2727}',
      '.dp-pa4-mehr{margin-top:10px;border:1px solid #E6DCC2;background:#fff;border-radius:9px;padding:7px 12px;font:600 12.5px "Space Grotesk",Inter,sans-serif;cursor:pointer;color:#2A2727}',
      /* Szenarien */
      '.dp-pa4-sz{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
      '@media (max-width:760px){.dp-pa4-sz{grid-template-columns:1fr}}',
      '.dp-pa4-szk{border:1px solid #E6DCC2;border-top:4px solid var(--c,#2A2727);border-radius:12px;padding:12px 14px;background:#fff;display:grid;gap:5px;align-content:start;min-width:0}',
      '.dp-pa4-szk h4{margin:0;font:600 14px "Space Grotesk",Inter,sans-serif;color:#2A2727}',
      '.dp-pa4-szk .an{font:500 11.5px Inter,sans-serif;color:#7A7370}',
      '.dp-pa4-szk p{margin:0;font:400 12.5px/1.5 Inter,sans-serif;color:#2A2727}',
      '.dp-pa4-szk dl{display:grid;grid-template-columns:1fr auto;gap:3px 10px;margin:2px 0 0;font:400 12.5px Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.dp-pa4-szk dt{color:#7A7370}.dp-pa4-szk dd{margin:0;text-align:right;font-weight:600}',
      '.dp-pa4-vor{display:inline-block;font:600 9.5px "JetBrains Mono",monospace;letter-spacing:.05em;text-transform:uppercase;padding:2px 6px;border-radius:5px;border:1px solid #B8AFA0;color:#7A7370;margin-left:6px;vertical-align:1px}',
      /* erklärender Text im Detail */
      '.dp-pa4-erkl{margin:10px 0 0;font:400 12.5px/1.6 Inter,sans-serif;color:#4A4542}',
      '.dp-pa4-erkl b{color:#2A2727}',
      /* Tabelle Steuer nach Gruppen */
      '.dp-pa4-tab{overflow-x:auto;border:1px solid #E6DCC2;border-radius:12px;margin-top:12px}',
      '.dp-pa4-tab table{border-collapse:collapse;width:100%;min-width:520px;font:400 12.5px Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.dp-pa4-tab th{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#7A7370;text-align:right;padding:8px 10px;border-bottom:1px solid #E6DCC2;background:#FBF6E9;white-space:nowrap}',
      '.dp-pa4-tab th:first-child,.dp-pa4-tab td:first-child{text-align:left}',
      '.dp-pa4-tab td{padding:6px 10px;border-bottom:1px solid #F1ECE1;text-align:right;white-space:nowrap;color:#2A2727}',
      '.dp-pa4-tab tr.gr td{background:#FBF6E9;font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#7A7370;text-align:left}',
      '.dp-pa4-tab tr.su td{font-weight:600;border-top:1.5px solid #2A2727}',
      '.dp-pa4-tab tr.ein td:first-child{padding-left:20px}',
      '.dp-pa4-tab td.gut{color:#2E7D50}.dp-pa4-tab td.schlecht{color:#B8625C}',
      /* Wertverlauf (Bauart Steuerverlauf) */
      '.dp-pa4-ch{position:relative;overflow-x:auto}',
      '.dp-pa4-ch svg{display:block;width:100%;height:auto;min-width:540px}',
      '.dp-pa4-ch .ax{font:500 10px "JetBrains Mono",monospace;fill:#8A8272}',
      '.dp-pa4-ch .gl{stroke:#EFEAE0}.dp-pa4-ch .nl{stroke:#2A2727;stroke-width:1.2}',
      '.dp-pa4-ch .wz{font:600 10.5px "JetBrains Mono",monospace;fill:#2A2727;paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round}',
      '.dp-pa4-ch .wz-l{fill:var(--wl-b8932f, #b8932f)}',
      '.dp-pa4-leg i.b{width:10px;height:12px;border-radius:2px}',
      '.dp-pa4-ch .hit{fill:transparent;cursor:crosshair}',
      '.dp-pa4-ch .kreuz{stroke:#8A8272;stroke-dasharray:2 3;opacity:0;pointer-events:none}',
      '.dp-pa4-tip{position:absolute;pointer-events:none;background:#fff;border:1px solid #E6DCC2;border-radius:8px;padding:7px 10px;font:400 12px Inter,sans-serif;color:#2A2727;box-shadow:0 6px 18px rgba(0,0,0,.12);min-width:210px;display:none;font-variant-numeric:tabular-nums;z-index:3}',
      '.dp-pa4-tip b{display:block;font:700 13px "Space Grotesk",Inter,sans-serif;margin-bottom:3px}',
      '.dp-pa4-tip div{display:flex;justify-content:space-between;gap:12px}',
      '.dp-pa4-tip i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;vertical-align:0}',
      '.dp-pa4-leg{display:flex;flex-wrap:wrap;gap:12px;font:500 10.5px "JetBrains Mono",monospace;color:#6B645A;margin:0 0 6px}',
      '.dp-pa4-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
      '.dp-pa4-leg i.l{height:0;width:16px;border-top:2.5px solid currentColor;border-radius:0;vertical-align:3px}',
      '.dp-pa4-leg i.d{height:0;width:16px;border-top:2px dashed currentColor;border-radius:0;vertical-align:3px}',
      '.dp-pa4-leg i.r{width:8px;height:8px;transform:rotate(45deg)}',
      '.dp-pa4-leg i.p{width:9px;height:9px;border-radius:50%}',
      '.dp-pa4-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}',
      '.dp-pa4-chips button{border:1px solid #E6DCC2;background:#fff;border-radius:999px;padding:3px 10px;font:500 11.5px Inter,sans-serif;cursor:pointer;color:#2A2727;opacity:.5}',
      '.dp-pa4-chips button.an{opacity:1}',
      '.dp-pa4-chips button i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:0}',
      /* v3323 · Marcel 12.11.2026: Texte „bis zum Ende ausgeschrieben … in Blocksatz“ - Blocksatz mit Silbentrennung (html lang=de), volle Breite */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content p,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content li,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content dd,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-kv{text-align:justify;-webkit-hyphens:auto;hyphens:auto;overflow-wrap:break-word}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-pa-p{max-width:none !important}',
      /* schmale Karten (Strategie, Fit, Wegweiser, Szenarien, Mini-Grafiken) linksbündig - Blocksatz reißt dort Löcher */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-strat *,.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-wk *,.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-szk p,.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-mini p,.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-liste li{text-align:left !important}',
      '@media (max-width:480px){.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content p,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content li{text-align:left !important}}',
      /* v3323 · Wert & Verlauf: im Einfach ohne die Tafel der Absolutwerte (der Verlauf selbst steht jetzt in beiden) */
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dpv-card:has(.dpv-tbl){display:none !important}',
      '.dp-pa4-bt{display:block;font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#A49D92;margin:0 0 4px}',
      /* Strategie neben der Bestandsstrategie */
      '.dp-pa4-strat-reihe{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:14px;align-items:start}',
      '@media (max-width:700px){.dp-pa4-strat-reihe{grid-template-columns:1fr}}',
      '.dp-pa4-strat{border:1px solid #E6DCC2;border-radius:12px;padding:10px 12px;background:#FBF6E9;display:grid;gap:2px;align-content:start}',
      '.dp-pa4-strat small{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A;margin-bottom:2px}',
      '.dp-pa4-strat b{font:700 14px "Space Grotesk",Inter,sans-serif;color:#2A2727}',
      '.dp-pa4-strat em{font-style:normal;font:400 11px Inter,sans-serif;color:#7A7370;margin-bottom:4px}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-link{justify-self:start;border:0 !important;background:transparent !important;padding:2px 0 !important;font:600 12px Inter,sans-serif !important;color:var(--wl-b8932f,#8a6d1f) !important;text-decoration:underline;cursor:pointer;box-shadow:none !important;min-height:0 !important}',
      /* Investor-Fit kompakt */
      '.dp-pa4-fit{display:grid;gap:8px}',
      '.dp-pa4-fit > div{display:grid;grid-template-columns:180px auto minmax(0,1fr);gap:4px 10px;align-items:baseline}',
      '.dp-pa4-fit .l{font:600 12.5px Inter,sans-serif;color:#2A2727}',
      '.dp-pa4-fit p{margin:0 !important}',
      '@media (max-width:620px){.dp-pa4-fit > div{grid-template-columns:1fr auto}.dp-pa4-fit p{grid-column:1/-1}}',
      '.dp-pa4-fitp{display:inline-block;font:600 11px Inter,sans-serif;color:#fff;border-radius:999px;padding:2px 9px}',
      /* Wegweiser in die Reiter */
      '.dp-pa4-weg{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:14px 0 0}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-wk{position:relative;display:grid !important;gap:2px;text-align:left !important;border:1px solid #E6DCC2 !important;background:#fff !important;border-radius:12px !important;padding:11px 28px 11px 13px !important;cursor:pointer;box-shadow:none !important;min-height:0 !important;color:#2A2727 !important}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-wk:hover{border-color:var(--wl-c9a84c,#C9A84C) !important;background:#FBF6E9 !important}',
      '.dp-pa4-wk small{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A}',
      '.dp-pa4-wk b{font:700 15px "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums}',
      '.dp-pa4-wk em{font-style:normal;font:400 11.5px Inter,sans-serif;color:#7A7370}',
      '.dp-pa4-wk i{position:absolute;right:11px;top:50%;transform:translateY(-50%);font:700 18px/1 "Space Grotesk",sans-serif;font-style:normal;color:var(--wl-b8932f,#b8932f)}'
    ].concat(STIL5).join('\n');
    document.head.appendChild(s);
  }

  /* ── Bausteine ───────────────────────────────────────────────────────── */
  function kpis() { try { return (window.State && window.State.kpis) || {}; } catch (e) { return {}; } }
  function investorScore() {
    try {
      if (window.DealScore2 && typeof window._buildDeal2FromState === 'function') {
        var d = window.DealScore2.compute(window._buildDeal2FromState());
        if (d && isFinite(d.score)) return Math.round(d.score);
      }
    } catch (e) {}
    return null;
  }
  /* v3323 · Marcel 12.11.2026: „den Deal Score haben wir ja gar nicht mehr eingeblendet, wenn wir den
     passenden Plan haben … deswegen können wir uns darauf nicht mehr beziehen". Welcher Score im Plan
     sichtbar ist, sagt dieselbe Weiche wie calc.js (deal_score_v2): voll → Investor Deal Score, 'demo'
     (Free) → beide, sonst (Starter) → DealPilot-Score. Unter 70 % der KPIs zeigt die App gar keinen. */
  function scoreSicht() {
    try {
      var P = window.DealPilotConfig && window.DealPilotConfig.pricing;
      if (!P) return 'investor';
      if (typeof P.hasFullFeature === 'function' && P.hasFullFeature('deal_score_v2')) return 'investor';
      if (typeof P.featureMode === 'function' && P.featureMode('deal_score_v2') === 'demo') return 'beide';
      return 'dealpilot';
    } catch (e) { return 'investor'; }
  }
  function sichtbarerScore() {
    try { var vq = window.dpScoreVollstaendigkeit ? window.dpScoreVollstaendigkeit() : null; if (vq && !vq.belastbar) return null; } catch (e) {}
    if (scoreSicht() === 'dealpilot') {
      try { var d1 = window.DealScore.computeFromKpis(window.State.kpis); d1 = d1 && typeof d1 === 'object' ? d1.score : d1; if (isFinite(d1)) return { wert: Math.round(d1), name: 'DealPilot-Score' }; } catch (e) {}
      return null;
    }
    var s = investorScore();
    return s == null ? null : { wert: s, name: 'Investor Deal Score' };
  }
  function wertDaten() {
    try { var d = window.DpWertZielbild && window.DpWertZielbild.daten ? window.DpWertZielbild.daten() : null; return d && d.wert ? d.wert : null; } catch (e) { return null; }
  }
  /* v4040 · Marcel 23.11.2026: „Wie kann mein Grenzsteuersatz bei 47 Prozent liegen? Es gibt ja nur 42.“ Über 42 % (45 %)
     liegt der Satz, weil der Soli in seiner Übergangszone 11,9 % je weiterem Euro Einkommensteuer nimmt. Abgeleitet aus
     tax.js (Tax.soli, Tax.calcGrenzsteuersatz), keine feste Zahl. Nur ein Satz unter der Kachel. */
  function grenzErklaerung(gs) {
    /* gemessen 2026-1183: das Feld „grenz“ steht auf 47,00, das zvE-Feld auf „68.000“. Der Satz wird deshalb aus dem
       Satz selbst zerlegt, nicht aus dem zvE: Einkommensteuer g (42 oder 45 %) mal (1 + Soli-Grenzsatz). Den Soli-Grenzsatz
       liefert tax.js (Tax.soli) an einer Einkommensteuer knapp über der Freigrenze bzw. weit darüber. */
    var T = window.Tax; if (!T || !T.soli || !(gs > 42.5)) return null;
    var jahr = new Date().getFullYear(), fg = 0;
    for (var e = 10000; e < 60000; e += 50) { if (T.soli(e, jahr, false) > 0) { fg = e; break; } }
    if (!fg) return null;
    var sZone = (T.soli(fg + 1000, jahr, false) - T.soli(fg, jahr, false)) / 1000, sVoll = (T.soli(200000, jahr, false) - T.soli(199000, jahr, false)) / 1000;
    var pr = function (x) { return (Math.round(x * 10) / 10).toLocaleString('de-DE'); };
    var zerlegt = null;
    [42, 45].forEach(function (g) {
      if (zerlegt) return;
      if (Math.abs(gs - g * (1 + sZone)) < 0.15) zerlegt = g + ' % Einkommensteuer. Der Soli steht in seiner Übergangszone und nimmt ' + pr(sZone * 100) + ' % auf jeden weiteren Euro Steuer, zusammen ' + pr(g * (1 + sZone)) + ' %. Danach sind es ' + pr(g * (1 + sVoll)) + ' %.';
      else if (Math.abs(gs - g * (1 + sVoll)) < 0.15) zerlegt = g + ' % Einkommensteuer plus ' + pr(sVoll * 100) + ' % Soli darauf, zusammen ' + pr(g * (1 + sVoll)) + ' %.';
    });
    return zerlegt;
  }
  function zahlKachel(lbl, wert, unter, farbe) {
    return '<div class="dp-pa4-z" style="--c:' + (farbe || '#E6DCC2') + '"><span>' + esc(lbl) + '</span><b>' + wert + '</b>' + (unter ? '<em>' + unter + '</em>' : '') + '</div>';
  }
  function abschnitt(titel, inhalt) { return inhalt ? '<div class="dp-pa4-a"><h4>' + esc(titel) + '</h4>' + inhalt + '</div>' : ''; }
  function absatz(t) { return has(t) ? '<p>' + txt(t) + '</p>' : ''; }
  function liste(arr) { return Array.isArray(arr) && arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + txt(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function erkl(html) { return '<p class="dp-pa4-erkl dp-pa-d">' + html + '</p>'; }
  function karte(inner, kl) { return '<div class="dp-pa-card' + (kl ? ' ' + kl : '') + '">' + inner + '</div>'; }
  function kopfzeile(lbl) { return '<div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">' + esc(lbl) + '</span><span class="dp-pa-rule"></span></div>'; }

  /** Kennzahlen des Objekts, wie sie heute gerechnet sind (State.kpis, Marktbericht) */
  /* v3440 · vier: Kennzahlleiste der Übersicht (vier Werte, der Score steht rechts im Ergebnis) */
  function kennzahlen(bestand, vier) {
    var k = kpis(), w = wertDaten(), z = [];
    if (zahl(k.kp) && k.kp > 0) z.push(zahlKachel(bestand ? 'Kaufpreis (Ankauf)' : 'Kaufpreis', eur(k.kp), zahl(k.bmy) ? 'Bruttorendite ' + de(k.bmy, 2) + ' %' : '', '#E6DCC2'));
    if (zahl(k.cf_m)) z.push(zahlKachel('Cashflow vor Steuer · volles Jahr', sEur(k.cf_m) + ' / Monat', zahl(k.cf_ns) ? 'nach Steuer ' + sEur(k.cf_ns / 12) + ' / Monat (volles Jahr)' : '', k.cf_m >= 0 ? C.gut : C.rot));
    if (zahl(k.dscr) && k.dscr > 0) z.push(zahlKachel('DSCR', de(k.dscr, 2), k.dscr >= 1.2 ? 'Bank: trägt sich' : k.dscr >= 1 ? 'knapp über 1' : 'unter 1: Zuschuss nötig', k.dscr >= 1 ? C.gut : C.rot));
    if (w && w.marktpreisindikation && zahl(w.marktpreisindikation.mitte)) {
      var oh = w.ohne_abschlag && zahl(w.ohne_abschlag.mitte) ? 'ohne Abschlag ' + eur(w.ohne_abschlag.mitte) : '';
      z.push(zahlKachel('Marktpreis Ø', eur(w.marktpreisindikation.mitte), oh, 'var(--wl-c9a84c,#C9A84C)'));
    }
    if (w && w.ertragswert && zahl(w.ertragswert.wert)) z.push(zahlKachel('Ertragswert', eur(w.ertragswert.wert), w.ertragswert.vorlaeufig ? 'vorläufig' : (zahl(w.ertragswert.lzs_pct) ? 'LZS ' + de(w.ertragswert.lzs_pct, 2) + ' %' : ''), C.c1));
    var sc = vier ? null : sichtbarerScore();
    if (sc) z.push(zahlKachel(sc.name, String(sc.wert), (window.ScoreTier && window.ScoreTier.stufe ? window.ScoreTier.stufe(sc.wert).wort : ''), '#2A2727'));
    if (vier) z = z.slice(0, 4);
    return '<div class="dp-pa4-zahlen' + (vier && z.length === 4 ? ' l4' : '') + '" data-dp-pa4-kz="' + (bestand ? 'b' : 'a') + (vier ? '4' : '') + '"' + (z.length ? '' : ' style="display:none"') + '>' + z.join('') + '</div>';
  }
  /* Der Marktbericht (DpWertZielbild) lädt oft erst nach dem Zeichnen - dann die Kacheln neu */
  function kzNeu() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa4-kz]'), function (h) {
      try { var a = h.getAttribute('data-dp-pa4-kz') || '', t = document.createElement('div'); t.innerHTML = kennzahlen(a.charAt(0) === 'b', a.indexOf('4') > 0); if (t.firstChild) h.parentNode.replaceChild(t.firstChild, h); } catch (e) {}
    });
  }

  /* ══ v3323 · ÜBERSICHT SCHLANK ═══════════════════════════════════════════════════════════════
     Marcel 12.11.2026: „wirklich Übersicht, einmal Gesamtbewertung, die Einordnung, Investmentbewertung …
     für die Strategie, die man fährt, die Bestandsstrategie daneben … Risiko und sowas muss da nicht rein,
     weil das haben wir in einem anderen Tab, genauso wie Lage und Markt. Abgleich mit dem Marktbericht
     brauchen wir nicht." Abgeglichen (gemessen an Westerfeldstr. 140, 12.11.2026) – was hier wegfällt,
     steht dort vollständig:
       Stärken, Risiken, Risikoanalyse, Szenarien, Optischer Eindruck   → Risiken & Szenarien (risiko())
       Makro-, Mikrolage, Kaufpreisniveau, Mietspiegel, Abgleich        → Lage & Markt (ui.js pL)
       Was im Haus steckt (potenzial_text)                              → Potenzialanalyse (DpPaPotenzial)
       Steuer (steuer_zusammenfassung)                                  → Steuer (steuer())
       Kaufpreis/Verhandlung, Bank, Anschluss (Ankauf)                  → Kaufpreis & Offerte, Finanzierung & Bank, Risiken
     Score-Vergleich nur, wo der Plan BEIDE Scores zeigt (scoreSicht() 'beide'); Investor-Fit nur im Ankauf
     (er fragt, zu welchem Anleger ein Kauf passt). Die Gesamtbewertung steht EINMAL (oben im Briefing). */
  function strategie() {
    var ex = '', pr = '';
    try { var e = document.getElementById('exitstr'); ex = e ? String(e.value || '').trim() : ''; } catch (x) {}
    try { var ip = window.DealPilotInvestmentProfile; if (ip && typeof ip.get === 'function') pr = String(ip.get('ai_strat') || '').trim(); } catch (x) {}
    return { exit: ex, profil: pr };
  }
  function strategieKasten() {
    var s = strategie();
    if (!s.exit && !s.profil) return '';
    return '<div class="dp-pa4-strat"><small>Deine Strategie</small>'
      + (s.exit ? '<b>' + esc(s.exit) + '</b><em>Exitstrategie im Reiter Objekt</em>' : '')
      + (s.profil ? '<b>' + esc(s.profil) + '</b><em>Strategie im Investmentprofil</em>' : '')
      + '<button type="button" class="btn-clean dp-pa4-link" onclick="try{switchTab(0);setTimeout(function(){var e=document.getElementById(\'exitstr\');if(e){e.scrollIntoView({block:\'center\'});e.focus();}},300)}catch(e){}">ändern</button></div>';
  }
  function fitBlock(a) {
    var f = a.investor_fit && typeof a.investor_fit === 'object' ? a.investor_fit : null;
    if (!f) return '';
    var pill = function (v) {
      var s = String(v || '').toLowerCase().trim();
      var k = s.indexOf('ja') === 0 ? ['Ja', C.gut] : s.indexOf('nein') === 0 ? ['Nein', C.rot] : ['Teilweise', 'var(--wl-b8932f,#b8932f)'];
      return '<span class="dp-pa4-fitp" style="background:' + k[1] + '">' + k[0] + '</span>';
    };
    var grund = function (v) { return String(v || '').replace(/^\s*(ja|nein|teilweise)\b[\s,.:–—-]*/i, ''); };
    var z = [['Cashflow-Investor', f.cashflow_investor], ['Wertsteigerungs-Investor', f.wertsteigerungs_investor], ['Sicherheitsorientiert', f.sicherheitsorientiert]]
      .filter(function (r) { return has(r[1]); });
    if (!z.length) return '';
    return abschnitt('Zu welchem Anleger der Kauf passt', '<div class="dp-pa4-fit">' + z.map(function (r) {
      return '<div><span class="l">' + r[0] + '</span>' + pill(r[1]) + '<p class="dp-pa-d">' + txt(grund(r[1])) + '</p></div>';
    }).join('') + '</div>');
  }

  /** Das Gesamtstatement (Detail): Einordnung, Investmentbewertung, Strategie, Insight – die Gesamtbewertung steht oben. */
  function gesamtstatement(a, bestand) {
    var t = [];
    var _od = ohneDoppel([a.gesamtbewertung || a.fazit_kurz, a.empfehlung_begruendung, a.investmentbewertung, a.dealpilot_insight]);   /* v3987 · F15 */
    a = Object.assign({}, a, { empfehlung_begruendung: _od[1], investmentbewertung: _od[2], dealpilot_insight: _od[3] });
    t.push(abschnitt(bestand ? 'Einordnung' : 'Begründung des Urteils', absatz(a.empfehlung_begruendung)));
    t.push(abschnitt('Investmentbewertung', absatz(a.investmentbewertung)));
    if (bestand && a.bestand_modus && has(a.verhandlungsempfehlung))
      t.push('<div class="dp-pa4-strat-reihe">' + abschnitt('Bestandsstrategie · was du jetzt tun kannst', absatz(a.verhandlungsempfehlung)) + strategieKasten() + '</div>');
    else if (bestand) t.push(strategieKasten());
    if (!bestand) t.push(fitBlock(a));
    t.push(abschnitt('DealPilot-Insight', absatz(a.dealpilot_insight)));
    var h = t.filter(Boolean).join('');
    return h ? '<div class="dp-pa4-ta">' + h + '</div>' : '';
  }

  /** v3323 · Karten „Mehr in den Reitern": je Reiter eine Zahl statt eines Absatzes (Einfach und Detail) */
  function wegweiser(a, bestand) {
    var k = [];
    var nS = Array.isArray(a.staerken) ? a.staerken.length : 0, nR = Array.isArray(a.risiken) ? a.risiken.length : 0;
    if (nS || nR) k.push(['risk', 'Risiken & Szenarien', nS + ' Stärken · ' + nR + ' Risiken', 'Worst, Plan und Best Case']);
    var lg = null; try { var st = JSON.parse((document.getElementById('_mb_state') || {}).value || 'null'); lg = st && st.card; } catch (e) { lg = null; }
    if (lg && (zahl(lg.microRaw) || zahl(lg.macroRaw))) k.push(['loc', 'Lage & Markt', (zahl(lg.microRaw) ? 'Mikro ' + Math.round(lg.microRaw) : '') + (zahl(lg.microRaw) && zahl(lg.macroRaw) ? ' · ' : '') + (zahl(lg.macroRaw) ? 'Makro ' + Math.round(lg.macroRaw) : ''), 'von 100, laut Marktbewertung']);
    else if (has(a.makrolage_recherche) || has(a.mikrolage_recherche)) k.push(['loc', 'Lage & Markt', 'Makro- und Mikrolage', 'mit Quellen']);
    try {
      var pk = window.DpPaPotenzial && window.DpPaPotenzial.kurz ? window.DpPaPotenzial.kurz() : null;
      if (pk) k.push(['pot', 'Potenzialanalyse', pk.zahl, pk.unter]);
    } catch (e) {}
    try {
      var hv = window.DpHausverlauf && window.DpHausverlauf.kurz ? window.DpHausverlauf.kurz() : null;
      if (hv) k.push(['haus', 'Hausverlauf', hv.zahl, hv.unter]);
    } catch (e) {}
    if (!k.length) return '';
    return '<div class="dp-pa4-weg">' + k.map(function (x) {
      return '<button type="button" class="btn-clean dp-pa4-wk" data-dp-pa4-geh="' + x[0] + '"><small>' + esc(x[1]) + '</small><b>' + esc(x[2]) + '</b><em>' + esc(x[3]) + '</em><i aria-hidden="true">›</i></button>';
    }).join('') + '</div>';
  }

  /** Unterreiter Übersicht. extra = Karten aus ui.js (Score-Vergleich, Hinweise). */
  /** kurz(t): der erste GANZE Satz (v3323: nie mitten im Satz abschneiden – Marcel: „bis zum Ende ausgeschrieben") */
  function kurz(t) { return saetze(t, 1); }

  function uebersicht(a, bestand, extra) {
    extra = extra || {};
    window._dpPaLetzte = a;
    var st = window._dpEmpfStufe ? window._dpEmpfStufe(a.empfehlung || a.fazit_kurz) : { label: a.empfehlung || '—', farbe: 'var(--wl-c9a84c,#C9A84C)' };
    var sc = sichtbarerScore();
    var gb = a.gesamtbewertung || a.fazit_kurz;
    /* v3440 · Demo Fassung 2: oben EIN Ergebnissatz, rechts Urteil (nur Ankauf, v3099e: im Bestand kein „Halten")
       und Score. Der Satz ist der erste ganze Satz der Gesamtbewertung - nichts wird dazugeschrieben. */
    var satz = saetze(gb, 1) || saetze(a.empfehlung_begruendung, 1);
    var stufe = sc && window.ScoreTier && window.ScoreTier.stufe ? window.ScoreTier.stufe(sc.wert).wort : '';
    var rechts = (!bestand || sc) ? '<div class="dp-pa4-urteil">' + (bestand ? '' : '<span class="dp-pa-empf" style="background:' + st.farbe + '">' + esc(st.label) + '</span>')
      + (sc ? '<span class="z">' + sc.wert + '</span><span class="u">' + (stufe ? '<b>' + esc(stufe) + '</b>' : '') + esc(sc.name) + '</span>' : '') + '</div>' : '';
    var h = (extra.hinweis || '') + ergebnis(satz ? txt(satz) : (bestand ? 'Stand heute' : 'Urteil zum Ankauf'), rechts) + kennzahlen(bestand, true);
    /* Einordnung | Was jetzt zu tun ist (Bestand) bzw. Zu welchem Anleger der Kauf passt (Ankauf) */
    var links = abKopf(bestand ? 'Einordnung' : 'Begründung')
      + '<div class="dp-pa-e">' + absatz(saetze(a.empfehlung_begruendung || gb, 2)) + '</div>'
      + '<div class="dp-pa-d"><div class="dp-pa4-ta">'
      + (function () { var od = ohneDoppel([gb, a.empfehlung_begruendung, a.investmentbewertung, a.dealpilot_insight]);   /* v3987 · F15 */
        return abschnitt('Gesamtbewertung', absatz(od[0])) + abschnitt(bestand ? 'Einordnung' : 'Begründung des Urteils', absatz(od[1]))
          + abschnitt('Investmentbewertung', absatz(od[2])) + abschnitt('DealPilot-Insight', absatz(od[3])); })() + '</div></div>';
    var re = '';
    if (bestand) {
      var tun = a.bestand_modus && has(a.verhandlungsempfehlung) ? a.verhandlungsempfehlung : '';
      re = abKopf('Was jetzt zu tun ist') + (tun ? '<div class="dp-pa-e">' + absatz(saetze(tun, 2)) + '</div><div class="dp-pa-d">' + absatz(tun) + '</div>' : '') + strategieKasten();
      if (!tun && !strategieKasten()) re = '';
    } else {
      re = fitBlock(a);
      if (re) re = abKopf('Zu welchem Anleger der Kauf passt') + re.replace(/^<div class="dp-pa4-a"><h4>[^<]*<\/h4>/, '<div class="dp-pa4-a" style="border-left:0;padding-left:0">');
    }
    h += '<div class="dp-pa5-zwei"><div>' + links + '</div>' + (re ? '<div>' + re + '</div>' : '') + '</div>';
    /* Einfach: die Tendenz als kleine Grafik (Vermögen im Objekt über die Jahre) */
    h += '<div class="dp-pa-e dp-pa4-mini dp-pa4-mt" style="margin-top:22px" data-dp-pa4-mini="vermoegen"></div>';
    if (extra.score && scoreSicht() === 'beide') h += '<div class="dp-pa-d dp-pa4-mt">' + extra.score + '</div>';
    h += '<div data-dp-pa4-weg="1">' + wegweiser(a, bestand) + '</div>';
    return h;
  }
  /* Die Wegweiser lesen Potenzial und Hausverlauf, die oft erst nach dem Zeichnen da sind */
  function wegNeu() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa4-weg]'), function (hst) {
      try { var a = window._dpPaLetzte || {}; hst.innerHTML = wegweiser(a, !!(hst.closest('.dp-pa-bestand'))); } catch (e) {}
    });
  }

  /** Unterreiter Risiken & Szenarien */
  function risiko(a, bestand, extra) {
    extra = extra || {};
    var ra = a.risikoanalyse && typeof a.risikoanalyse === 'object' ? a.risikoanalyse : null, sz = a.szenarien && typeof a.szenarien === 'object' ? a.szenarien : {};
    /* v3099e · Einfach: drei Punkte mit je einem Satz; Detail: alle, ganz */
    var lst = function (arr) { return Array.isArray(arr) && arr.length ? '<ul class="dp-pa4-liste">' + arr.map(function (x, i) { return (i < 3 ? '<li class="dp-pa-e">' + txt(kurz(x, 140)) + '</li>' : '') + '<li class="dp-pa-d">' + txt(x) + '</li>'; }).join('') + '</ul>' : '<em class="dp-pa-empty">—</em>'; };
    /* v3441 · Ergebnissatz des Abschnitts (Demo Fassung 2): Zahl der Stärken und Risiken, das erste Risiko in einem Satz */
    var nR = Array.isArray(a.risiken) ? a.risiken.length : 0, nS = Array.isArray(a.staerken) ? a.staerken.length : 0;
    var h = (nR || nS) ? ergebnis('<b>' + nS + (nS === 1 ? ' Stärke' : ' Stärken') + ', ' + nR + (nR === 1 ? ' Risiko' : ' Risiken') + '.</b>' + (nR ? ' Zuerst: ' + txt(saetze(a.risiken[0], 1)) : '')) : '';
    h += '<div class="dp-pa-cols">'
      + karte('<div class="dp-pa-sec good"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">STÄRKEN</span><span class="dp-pa-rule"></span></div>' + lst(a.staerken))
      + karte('<div class="dp-pa-sec bad"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">RISIKEN</span><span class="dp-pa-rule"></span></div>' + lst(a.risiken))
      + '</div>';
    /* Risikobewertung: Einfach die ersten Sätze, Detail ganz */
    if (ra && (has(ra.finanzierungsrisiko) || has(ra.cashflow_stabilitaet) || has(ra.annahmen_abhaengigkeit))) {
      var zeile = function (lbl, t) { return has(t) ? '<div class="dp-pa-kv"><strong>' + lbl + ':</strong> <span class="dp-pa-e">' + txt(saetze(t, 1)) + '</span><span class="dp-pa-d">' + txt(t) + '</span></div>' : ''; };
      h += '<div class="dp-pa-d">' + karte(kopfzeile('Risikoanalyse') + zeile('Finanzierungsrisiko (LTV + DSCR)', ra.finanzierungsrisiko) + zeile('Cashflow-Stabilität', ra.cashflow_stabilitaet) + zeile('Abhängigkeit von Annahmen', ra.annahmen_abhaengigkeit)
        + erkl('<b>Finanzierungsrisiko</b> fragt, ob Beleihung (LTV) und Schuldendienstdeckung (DSCR) einer Bank genügen. <b>Cashflow-Stabilität</b> fragt, wie viel Mietausfall oder Kostensteigerung der Monatsüberschuss verträgt. <b>Abhängigkeit von Annahmen</b> zeigt, welche deiner Eingaben (Mietsteigerung, Zins nach der Bindung, Wertsteigerung) das Ergebnis am stärksten tragen.'), 'dp-pa4-mt') + '</div>';
    }
    /* Worst · Plan · Best */
    var k = kpis();
    var plan = '<dl>' + (zahl(k.cf_m) ? '<dt>Cashflow vor Steuer (volles Jahr)</dt><dd>' + sEur(k.cf_m) + ' / Monat</dd>' : '')
      + (zahl(k.cf_ns) ? '<dt>nach Steuer (volles Jahr)</dt><dd>' + sEur(k.cf_ns / 12) + ' / Monat</dd>' : '')
      + (zahl(k.dscr) && k.dscr > 0 ? '<dt>DSCR</dt><dd>' + de(k.dscr, 2) + '</dd>' : '')
      + (zahl(k.bmy) && k.bmy > 0 ? '<dt>Bruttorendite</dt><dd>' + de(k.bmy, 2) + ' %</dd>' : '') + '</dl>';
    var szk = function (titel, an, farbe, t, inner, vor) {
      return '<div class="dp-pa4-szk" style="--c:' + farbe + '"><h4>' + titel + (vor ? '<span class="dp-pa4-vor">Vorschlag</span>' : '') + '</h4><span class="an">' + an + '</span>'
        + (inner || '') + (has(t) ? '<p class="dp-pa-e">' + txt(kurz(t, 160)) + '</p><p class="dp-pa-d">' + txt(t) + '</p>' : (inner ? '' : '<p><em class="dp-pa-empty">—</em></p>')) + '</div>';
    };
    h += karte(kopfzeile('Szenarien · Worst · Plan · Best') + '<div class="dp-pa4-sz">'
      + szk('Worst Case', 'Miete −10 %, Zins +1 Prozentpunkt', C.rot, sz.worst_case)
      + szk('Plan', 'deine Eingaben, heute gerechnet', '#2A2727', '', plan, true)
      + szk('Best Case', 'Miete +5 %, höhere Wertsteigerung', C.gut, sz.best_case)
      + '</div>'
      + erkl('Worst und Best Case hat der Pilot mit den genannten Annahmen beschrieben. <b>Plan</b> ist kein Text des Piloten, sondern deine heutige Rechnung (Reiter Kennzahlen) – er steht dazwischen, damit man die beiden Fälle gegen etwas lesen kann. '
        + 'Eigene Annahmen durchspielen kannst du im Reiter Kennzahlen bei den Szenarien.'), 'dp-pa4-mt');
    if (extra.optisch) h += '<div class="dp-pa-d">' + extra.optisch + '</div>';
    if (extra.anschluss) h += '<div class="dp-pa-d">' + extra.anschluss + '</div>';
    return h;
  }

  /* ── Steuer nach den Gruppen des Reiters Steuer ─────────────────────── */
  var GRUPPEN = [
    ['Finanzierung', ['schuldzinsen', 'kontofuehrung', 'bereitstellung', 'notar_grundschuld', 'vermittlung', 'finanz_sonst']],
    ['Betriebskosten', ['nk_umlf', 'nk_n_umlf', 'betr_sonst']],
    ['Verwaltung', ['hausverwaltung', 'steuerber', 'porto', 'verw_sonst']],
    ['Sonstiges', ['fahrtkosten', 'verpflegung', 'hotel', 'inserat', 'gericht', 'telefon', 'sonst_kosten', 'sonst_bewegl_wg']],
    ['AfA', ['afa']],
    ['Erhaltung und anschaffungsnah', ['anschaffungsnah', 'erhaltungsaufwand']]
  ];
  function steuerTabelle() {
    var S = window.State;
    if (!S || !Array.isArray(S.cfRows) || !S.cfRows.length || typeof window._computeYearTotal !== 'function') return '';
    var R = [];
    try { S.cfRows.forEach(function (r, i) { var t = window._computeYearTotal(r.cal, i) || {}; R.push({ jahr: r.cal, t: t }); }); } catch (e) { return ''; }
    if (!R.length) return '';
    /* die ersten fünf Jahre, dazu der Wendepunkt (wie im Steuerverlauf), höchstens sieben Spalten */
    var A = null; try { A = window.DpSteuerVerlauf ? window.DpSteuerVerlauf.auswerten(R.map(function (x) { return { jahr: x.jahr, erg: Number(x.t.ergebnis) || 0, steuer: Number(x.t.refund) || 0 }; })) : null; } catch (e) { A = null; }
    var idx = []; for (var i = 0; i < Math.min(5, R.length); i++) idx.push(i);
    if (A && A.wende > 4) idx.push(A.wende);
    if (R.length - 1 > idx[idx.length - 1] && idx.length < 7) idx.push(R.length - 1);
    var sp = idx.map(function (j) { return R[j]; });
    var g = function (t, felder) { var v = t.values || {}; return felder.reduce(function (s, f) { return s + (Number(v[f]) || 0); }, 0); };
    var zelle = function (v, farbig) { return '<td' + (farbig ? ' class="' + (v >= 0 ? 'gut' : 'schlecht') + '"' : '') + '>' + (v === 0 ? '–' : (farbig ? sEur(v) : eur(v))) + '</td>'; };
    var h = '<table><thead><tr><th>Jahr</th>' + sp.map(function (x) { return '<th>' + x.jahr + (A && A.jahr === x.jahr ? '<br><span style="text-transform:none;letter-spacing:0">Wendepunkt</span>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>'
      + '<tr class="gr"><td colspan="' + (sp.length + 1) + '">Einnahmen</td></tr>'
      + '<tr class="ein"><td>Kaltmiete</td>' + sp.map(function (x) { return zelle(Number((x.t.values || {}).einnahmen_km) || 0); }).join('') + '</tr>'
      + '<tr class="ein"><td>umgelegte Nebenkosten</td>' + sp.map(function (x) { return zelle(Number((x.t.values || {}).einnahmen_nk) || 0); }).join('') + '</tr>'
      + '<tr class="gr"><td colspan="' + (sp.length + 1) + '">Werbungskosten</td></tr>'
      + GRUPPEN.map(function (gr) { return '<tr class="ein"><td>' + gr[0] + '</td>' + sp.map(function (x) { return zelle(g(x.t, gr[1])); }).join('') + '</tr>'; }).join('')
      + '<tr class="su"><td>Ergebnis Anlage V</td>' + sp.map(function (x) { return zelle(Number(x.t.ergebnis) || 0, true); }).join('') + '</tr>'
      + '<tr><td>Steuerwirkung</td>' + sp.map(function (x) { return zelle(Number(x.t.refund) || 0, true); }).join('') + '</tr>'
      + '</tbody></table>';
    return h;
  }
  function steuerTabelleAlle() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa4-steuertab]'), function (host) {
      var wrap = host.closest('.dp-pa-wrap');
      if (wrap && wrap.getAttribute('data-dp-pa-modus') !== 'detail') return;
      var t = steuerTabelle(); host.innerHTML = t; host.style.display = t ? '' : 'none';
    });
  }
  /* ── v3099e · Belege je Steuerjahr (Marcel 03.11.2026: „mit den Belegen … dass wir da irgendwas
     machen können, habe ich nicht gefunden"). Fassung 4 zeigte je Jahr „erklärt" oder „Belege fehlen".
     GEMESSEN: Belege einlesen gibt es seit v1406 (beleg-import.js, Modus 'wk'), aber nur im Reiter
     Steuer. Eine Herkunftsmarke „aus Beleg" speichert dpWkUebernehmen NICHT - Belege und Eingaben von
     Hand landen in denselben Jahreswerten (_taxYearlyOverrides). Ehrlich unterscheidbar ist deshalb
     nur: eigene Angaben für das Jahr ja/nein. Mehr wird hier nicht behauptet. */
  function belegeHtml(bestand) {
    var S = window.State, R = S && Array.isArray(S.cfRows) ? S.cfRows : [];
    var heute = new Date().getFullYear(), O = window._taxYearlyOverrides || {};
    var jahre = R.map(function (r) { return r.cal; }).filter(function (j) { return j <= heute; });
    var chips = '';
    /* v3120 · seit dem gemeinsamen Eingang (unterlagen-eingang.js) trägt jeder übernommene Posten seine
       Herkunft: „durch Unterlagen belegt" = der Wert stammt noch aus Wirtschaftsplan, Abrechnung oder Beleg */
    if (bestand && jahre.length) chips = '<div class="dp-pa4-belege">' + jahre.map(function (j) {
      var st = window.DpEingang ? window.DpEingang.jahrStand(j) : null;
      var e = O['y' + j] || {}, n = Object.keys(e).filter(function (k) { return zahl(e[k]); }).length;
      if (st && st.belegt) return '<span class="dp-pa4-bj ok" title="' + st.belegt + ' Posten aus Unterlagen oder Belegen' + (st.eigen ? ', ' + st.eigen + ' von Hand' : '') + '">' + j + ' · durch Unterlagen belegt (' + st.belegt + ')' + (st.eigen ? ' + ' + st.eigen + ' von Hand' : '') + '</span>';
      return n ? '<span class="dp-pa4-bj ok" title="' + n + ' Posten mit eigenen Angaben (von Hand oder vor v3120 eingelesen)">' + j + ' · eigene Angaben (' + n + ')</span>'
        : '<span class="dp-pa4-bj' + (j < heute ? ' fehlt' : '') + '" title="Nur der Vorschlag der App aus deinen Eingaben">' + j + ' · ' + (j < heute ? 'Belege fehlen' : 'laufendes Jahr') + '</span>';
    }).join('') + '</div>';
    var satz = bestand
      ? 'Je Jahr: hast du eigene Angaben gemacht (Belege eingelesen oder von Hand), oder rechnet die App nur mit ihrem Vorschlag? Für abgelaufene Jahre ohne eigene Angaben fehlen die Belege.'
      : 'Im Ankauf ist die Steuer ein Plan aus deinen Eingaben. Belege kommen nach dem Kauf – Hausgeld- und Nebenkostenabrechnungen, Grundsteuer, Handwerker- und Versicherungsrechnungen.';
    return karte(kopfzeile('Belege') + chips + '<p class="dp-pa-p" style="margin:0 0 10px">' + satz + '</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + '<button type="button" class="btn-clean dp-pa4-btn" onclick="if(window.DpEingang)DpEingang.oeffnen();else if(window.DealPilotBelegImport)DealPilotBelegImport.open(\'wk\')">Belege, Unterlagen &amp; Rechnungen einlesen</button>'
      + '<button type="button" class="btn-clean dp-pa4-btn leise" onclick="try{var t=document.querySelector(\'.tab[data-target-sec]\');var b=[].filter.call(document.querySelectorAll(\'.tab\'),function(x){return /Steuer/.test(x.textContent||\'\')})[0];if(b)b.click();}catch(e){}">Zum Reiter Steuer</button></div>'
      + erkl('Ein Eingang für alles: Wirtschaftsplan und Abrechnung gehen mit Jahr in die Werbungskosten, Rechnungen über den Beleg-Leser, Mietverträge in die passende Einheit, Protokolle in die WEG-Auswertung. Nichts wird ohne deine Bestätigung übernommen.'), 'dp-pa4-mt');
  }

  /* v3440 · Ergebnissatz und Kennzahlleiste des Reiters Steuer. RECHNET NICHTS: Jahre aus DpSteuerVerlauf.reihe()
     (= _computeYearTotal, dieselbe Quelle wie Reiter Steuer und Steuerverlauf), AfA aus den Jahreswerten,
     Gebäudeanteil, AfA-Satz und Grenzsteuersatz aus den Feldern, die Frist wie steuer-verlauf.js (§ 23 EStG). */
  function steuerKopf(bestand, corp) {
    var SV = window.DpSteuerVerlauf, R = null, A = null;
    try { R = SV && SV.reihe ? SV.reihe() : null; A = R && R.length ? SV.auswerten(R) : null; } catch (e) { R = null; }
    var heute = new Date().getFullYear(), satz = '', offen = [];
    if (A && R && R.length) {
      if (A.wende === 0) satz = 'Das Objekt ist <b>vom ersten Jahr an steuerlich positiv</b>.';
      else if (A.jahr) satz = 'Das Objekt wird <b>' + (A.jahr <= heute ? 'seit ' : 'ab ') + A.jahr + ' dauerhaft steuerlich positiv</b>' + (A.erstattung > 0 ? ', bis dahin ' + sEur(A.netto) + ' Steuerwirkung' : '') + '.';
      else satz = 'Das Objekt bleibt bis ' + R[R.length - 1].jahr + ' <b>steuerlich negativ</b>, es senkt deine Steuer in jedem Jahr.';
      if (!bestand) { var r0 = R[0]; satz = 'Im ersten Jahr (' + r0.jahr + ') <b>' + sEur(r0.erg) + ' Ergebnis ' + (corp ? 'des Objekts' : 'V+V') + '</b>, ' + (r0.steuer >= 0 ? 'rund ' + eur(r0.steuer) + ' Erstattung' : 'rund ' + eur(-r0.steuer) + ' Steuer') + '. ' + satz; }
    }
    if (bestand) {
      var O = window._taxYearlyOverrides || {};
      (window.State && Array.isArray(window.State.cfRows) ? window.State.cfRows : []).forEach(function (r) {
        if (r.cal >= heute) return;
        var stj = null; try { stj = window.DpEingang ? window.DpEingang.jahrStand(r.cal) : null; } catch (e) {}
        var e = O['y' + r.cal] || {}, n = Object.keys(e).filter(function (k) { return zahl(e[k]); }).length;
        if (!(stj && stj.belegt) && !n) offen.push(r.cal);
      });
      if (offen.length) satz += ' Für ' + (offen.length > 2 ? offen.slice(0, -1).join(', ') + ' und ' + offen[offen.length - 1] : offen.join(' und ')) + ' fehlen noch Belege.';
    }
    if (!satz) satz = 'Der Steuerverlauf erscheint, sobald das Objekt gerechnet ist.';
    var kn = offen.length
      ? knopf('Belege einlesen', 'if(window.DpEingang)DpEingang.oeffnen();else if(window.DealPilotBelegImport)DealPilotBelegImport.open(\'wk\')')
      : knopf('Zum Reiter Steuer', 'try{var b=[].filter.call(document.querySelectorAll(\'.tab\'),function(x){return /Steuer/.test(x.textContent||\'\')})[0];if(b)b.click();}catch(e){}', true);
    /* Kennzahlleiste */
    var z = [];
    try {
      var S = window.State, idx = 0;
      if (S && Array.isArray(S.cfRows)) S.cfRows.forEach(function (r, i) { if (bestand && r.cal === heute) idx = i; });
      var t = S && S.cfRows && S.cfRows[idx] && typeof window._computeYearTotal === 'function' ? window._computeYearTotal(S.cfRows[idx].cal, idx) : null;
      var afa = t && t.values && zahl(t.values.afa) ? Math.abs(Number(t.values.afa)) : null, satzA = feldZahl('afa_satz');
      if (afa != null && afa > 0) z.push(zahlKachel('AfA im Jahr', eur(afa), (satzA != null ? de(satzA, 2) + ' % · ' : '') + S.cfRows[idx].cal));
    } catch (e) {}
    var ga = feldZahl('geb_ant');
    if (ga != null && ga > 0) z.push(zahlKachel('Gebäudeanteil', de(ga, 1) + ' %', 'Basis der AfA'));
    if (corp) z.push(zahlKachel('Zehnjahresfrist', 'keine', 'in der GmbH/UG ist ein Verkauf steuerpflichtig'));
    else {
      var kd = feldWert('kaufdat').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(kd)) {
        var fr = new Date(Date.UTC(+kd.slice(0, 4) + 10, +kd.slice(5, 7) - 1, +kd.slice(8, 10) + 1));
        var mon = Math.round((fr - Date.now()) / (30.44 * 864e5));
        z.push(zahlKachel('Zehnjahresfrist', ('0' + (fr.getUTCMonth() + 1)).slice(-2) + '/' + fr.getUTCFullYear(), mon <= 0 ? 'abgelaufen, Verkauf steuerfrei' : 'steuerfrei ab ' + ('0' + fr.getUTCDate()).slice(-2) + '.' + ('0' + (fr.getUTCMonth() + 1)).slice(-2) + '.' + fr.getUTCFullYear() + (mon >= 12 ? ', noch ' + Math.floor(mon / 12) + ' J.' : ', noch ' + mon + ' Mon.')));
      }
    }
    var gs = feldZahl('grenz');
    if (gs != null && gs > 0) { var gsU = 'aus deinen Steuerangaben'; try { gsU = grenzErklaerung(gs) || gsU; } catch (eG) {} z.push(zahlKachel('Grenzsteuersatz', de(gs, 2) + ' %', gsU)); }
    return ergebnis(satz, kn) + (z.length ? '<div class="dp-pa4-zahlen' + (z.length === 4 ? ' l4' : '') + '">' + z.join('') + '</div>' : '');
  }
  /** Unterreiter Steuer: Verlauf wie im Reiter Steuer, Text, im Detail die Tabelle */
  function steuer(a, bestand) {
    /* v3268 · Halter GmbH/UG: Betriebsausgaben statt Werbungskosten, und KEIN steuerfreier Verkauf nach zehn Jahren */
    var _bg = (window._dpBegriff ? window._dpBegriff() : { corp: false, wort: 'Werbungskosten' });
    /* v3270 · Gesellschaftsobjekt unter Detailgrad Experte: wem es gehört, und dass die Einzelheiten ab Experte stehen */
    var _gesH = ''; try { _gesH = (window.DealPilotMandanten && DealPilotMandanten.hinweisHtml) ? DealPilotMandanten.hinweisHtml(null, 'pilot') : ''; } catch (e) { _gesH = ''; }
    var h = _gesH + '<div data-dp-pa5-steuerkopf="' + (bestand ? 'b' : 'a') + '">' + steuerKopf(bestand, _bg.corp) + '</div>' + karte(kopfzeile('Steuerverlauf · wann das Objekt steuerlich positiv wird') + '<div data-dp-steuerverlauf="1"></div>'
      + erkl(_bg.corp
        ? '<b>So liest du die Grafik:</b> Die Balken zeigen je Jahr das Ergebnis des Objekts in der Gesellschaft (Betriebseinnahmen minus Betriebsausgaben). '
          + 'Die Linie ist der Cashflow nach Steuern. Eine Zehnjahresfrist gibt es in der GmbH/UG nicht: ' + ((window.DealPilotUeberfuehrungKern && DealPilotUeberfuehrungKern.HINWEIS_VERKAUF_GES) || 'ein Veräußerungsgewinn ist immer steuerpflichtig.') + ' Es ist dieselbe Rechnung wie im Reiter Steuer.'
        : '<b>So liest du die Grafik:</b> Die Balken zeigen je Jahr das Ergebnis der Anlage V (Einnahmen minus Werbungskosten). Grün ist ein Verlust, der deine Steuer senkt, Gold ein Gewinn, auf den Steuer fällig wird. '
        + 'Die Linie ist der Cashflow nach Steuern. Markiert sind der Wendepunkt, das Ende der Zinsbindung und das Datum, ab dem ein Verkauf nach § 23 EStG steuerfrei ist. Es ist dieselbe Rechnung wie im Reiter Steuer.'));
    h += karte(kopfzeile('Steuerliche Zusammenfassung')
      + (has(a.steuer_zusammenfassung)
        ? '<p class="dp-pa-p dp-pa-e">' + txt(kurz(a.steuer_zusammenfassung, 220)) + '</p><p class="dp-pa-p dp-pa-d">' + txt(a.steuer_zusammenfassung) + '</p>'
        : '<div class="dp-pa-fuss" style="margin-top:0">Diese Analyse wurde vor der steuerlichen Zusammenfassung erstellt. Beim nächsten Abruf steht sie hier.</div>')
      + '<div class="dp-pa-fuss dp-pa-d">Eine Einordnung aus deinen Eingaben im Reiter Steuer – keine Steuerberatung. Lass sie von deinem Steuerberater bestätigen.</div>', 'dp-pa4-mt');
    /* v3323 · Marcel 12.11.2026: „steuerlich Ankauf gegen heute … die Steuersachen zu Steuern“ - stand bis hier unter Ankauf · Bestand · Zielbild */
    /* v3440 · „Steuerlich: Ankauf gegen heute" (a.soll_ist_steuer) steht jetzt in Ankauf · Bestand · Zielbild unter der Kennzahlen-Tabelle */
    h += belegeHtml(bestand);
    h += '<div class="dp-pa-d">' + karte(kopfzeile((_bg.corp ? 'Betriebseinnahmen und Betriebsausgaben' : 'Einnahmen und Werbungskosten') + ' nach Gruppen') + '<div class="dp-pa4-tab" data-dp-pa4-steuertab="1"></div>'
      + erkl('Die Gruppen sind die des Reiters Steuer: <b>Finanzierung</b> (Zinsen und Finanzierungskosten), <b>Betriebskosten</b> (umgelegt und nicht umlagefähig), <b>Verwaltung</b>, <b>Sonstiges</b>, <b>AfA</b> sowie <b>Erhaltung und anschaffungsnaher Aufwand</b>. '
        + 'Umgelegte Nebenkosten stehen bei den Einnahmen und bei den Betriebskosten, sie heben sich auf. Die Zuführung zur Erhaltungsrücklage ist nicht abziehbar und fehlt deshalb. Steuerwirkung ist der Unterschied der Steuer mit und ohne dieses Objekt (Plus = Erstattung).'), 'dp-pa4-mt') + '</div>';
    try { setTimeout(steuerTabelleAlle, 0); } catch (e) {}
    return h;
  }

  /* ── Grafik-Werkzeug (Bauart Steuerverlauf) ──────────────────────────
     cfg: { x: [Beschriftung], reihen: [{ name, farbe, werte:[Zahl|null], art:'linie'|'gestrichelt'|'punkt'|'raute', aus:Bool }],
            fmt(v) für Achse/Tooltip, tip(i) optional zusätzliche Tooltip-Zeilen, aria } */
  /* v3151 · art 'balken' (abgerundet, vom Nullpunkt, Farbe je Vorzeichen über farbeNeg), flaeche:true
     (Verlauf unter der Linie), Zahlen an den Werten (cfg.kurz, ausgedünnt, damit nichts überlappt;
     r.zahlen === false schaltet eine Reihe aus). */
  var _gid = 0;
  /* v3440 · Säule mit 4 px Rundung am Datenende, eckig an der Grundlinie (dataviz, Marks) */
  function saeule(x, y0, y1, w) {
    var h = Math.abs(y1 - y0), r = Math.min(4, w / 2, h), top = Math.min(y0, y1), unten = Math.max(y0, y1);
    if (h < 1.5) return 'M' + x.toFixed(1) + ',' + (y0 - 0.75).toFixed(1) + 'h' + w.toFixed(1) + 'v1.5h-' + w.toFixed(1) + 'z';
    if (y1 <= y0) return 'M' + x.toFixed(1) + ',' + unten.toFixed(1) + 'V' + (top + r).toFixed(1) + 'Q' + x.toFixed(1) + ',' + top.toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + top.toFixed(1)
      + 'H' + (x + w - r).toFixed(1) + 'Q' + (x + w).toFixed(1) + ',' + top.toFixed(1) + ' ' + (x + w).toFixed(1) + ',' + (top + r).toFixed(1) + 'V' + unten.toFixed(1) + 'Z';
    return 'M' + x.toFixed(1) + ',' + top.toFixed(1) + 'V' + (unten - r).toFixed(1) + 'Q' + x.toFixed(1) + ',' + unten.toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + unten.toFixed(1)
      + 'H' + (x + w - r).toFixed(1) + 'Q' + (x + w).toFixed(1) + ',' + unten.toFixed(1) + ' ' + (x + w).toFixed(1) + ',' + (unten - r).toFixed(1) + 'V' + top.toFixed(1) + 'Z';
  }
  function linien(host, cfg) {
    if (!host) return;
    stil();
    var W = 900, H = cfg.hoehe || 300, L = 70, Rr = 16, T = 26, U = 34, n = cfg.x.length;
    var vs = [];
    cfg.reihen.forEach(function (r) { if (r.aus) return; r.werte.forEach(function (v) { if (zahl(v)) vs.push(Number(v)); }); });
    if (!vs.length || n < 1) { host.innerHTML = ''; return; }
    var hatBalken = cfg.reihen.some(function (r) { return !r.aus && r.art === 'balken'; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    if (cfg.null || hatBalken) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    if (cfg.zahlen !== false && hi > 0) hi += (hi - lo) * 0.09;   /* v3151 · Platz fuer die Zahl am hoechsten Wert */
    if (hi === lo) { hi = hi + Math.abs(hi || 1) * 0.1; lo = lo - Math.abs(lo || 1) * 0.1; }
    var st = nice(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    var y = function (v) { return T + (H - T - U) * (1 - (v - lo) / (hi - lo)); };
    var gap = (W - L - Rr) / n, x = function (i) { return L + i * gap + gap / 2; };
    var fmt = cfg.fmt || function (v) { return String(v); };
    var kurz = cfg.kurz || cfg.achse || fmt;
    var schritt = n <= 8 ? 1 : Math.ceil(n / 7);
    /* v3440 · dataviz: sparsam beschriften - Linien am letzten Wert, Balken am ersten, letzten und an den Extremen;
       der Rest steht im Tooltip und in den Tabellen. Bis v3439 trug jede zweite Stelle eine Zahl (schritt). */
    var zeigen = function (i) { return cfg.nurLetzte ? i === n - 1 : (cfg.dicht ? (i % schritt === 0 || i === n - 1) : i === n - 1); };
    var extrem = function (werte, i) { var v = werte.filter(zahl).map(Number); if (!v.length || !zahl(werte[i])) return false; var w = Number(werte[i]); return w === Math.max.apply(null, v) || w === Math.min.apply(null, v); };
    var erstLetzt = function (werte, i) { var idx = []; werte.forEach(function (w, j) { if (zahl(w)) idx.push(j); }); return i === idx[0] || i === idx[idx.length - 1]; };   /* nurLetzte: viele Reihen (Index) */
    var s = '', lab = '', gid = 'dpPa4g' + (++_gid);
    s += '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--wl-c9a84c, #C9A84C);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--wl-c9a84c, #C9A84C);stop-opacity:.02"/></linearGradient></defs>';
    for (var v = lo; v <= hi + st / 2; v += st) s += '<line class="gl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="ax" x="' + (L - 7) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(cfg.achse ? cfg.achse(v) : fmt(v)) + '</text>';
    if (lo < 0 && hi > 0) s += '<line class="nl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    cfg.x.forEach(function (lbl, i) { if (i % (n > 14 ? 2 : 1) === 0 || i === n - 1) s += '<text class="ax" x="' + x(i).toFixed(1) + '" y="' + (H - U + 16) + '" text-anchor="middle">' + esc(lbl) + '</text>'; });
    /* Balken zuerst (hinten), Linien und Punkte darüber */
    var bR = cfg.reihen.filter(function (r) { return !r.aus && r.art === 'balken'; }), kB = bR.length;
    var bw = kB ? Math.min(30, gap * 0.62 / kB) : 0;
    bR.forEach(function (r, j) {
      r.werte.forEach(function (w, i) {
        if (!zahl(w)) return;
        w = Number(w);
        var xx = x(i) - (kB * bw + (kB - 1) * 3) / 2 + j * (bw + 3), y1 = y(w), y0 = y(0), hh = Math.max(1.5, Math.abs(y1 - y0));
        var f = (w < 0 && r.farbeNeg) ? r.farbeNeg : r.farbe;
        s += '<path d="' + saeule(xx, y0, y1, bw) + '" style="fill:' + f + '"/>';
        if (cfg.zahlen !== false && r.zahlen !== false && (cfg.dicht ? zeigen(i) : (erstLetzt(r.werte, i) || extrem(r.werte, i)))) {
          var ty = w >= 0 ? y1 - 5 : y1 + 13;
          lab += '<text class="wz" x="' + (xx + bw / 2).toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="middle">' + esc(kurz(w)) + '</text>';
        }
      });
    });
    cfg.reihen.forEach(function (r) {
      if (r.aus || r.art === 'balken') return;
      var pk = []; r.werte.forEach(function (w, i) { if (zahl(w)) pk.push([x(i), y(Number(w)), Number(w), i]); });
      var pts = pk.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      if (r.art === 'linie' || r.art === 'gestrichelt') {
        if (r.flaeche && pk.length > 1) {
          var yb = y(Math.max(lo, Math.min(0, hi)));
          s += '<polygon points="' + pk[0][0].toFixed(1) + ',' + yb.toFixed(1) + ' ' + pts + ' ' + pk[pk.length - 1][0].toFixed(1) + ',' + yb.toFixed(1) + '" style="fill:' + r.farbe + ';fill-opacity:.10"/>';
        }
        if (pk.length > 1) s += '<polyline fill="none" style="stroke:' + r.farbe + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + (r.art === 'gestrichelt' ? ' stroke-dasharray="6 4"' : '') + ' points="' + pts + '"/>';
        if (r.art === 'linie' && pk.length) { var pe = pk[pk.length - 1]; s += '<circle cx="' + pe[0].toFixed(1) + '" cy="' + pe[1].toFixed(1) + '" r="4" style="fill:' + r.farbe + '" stroke="#fff" stroke-width="2"/>'; }
      } else if (r.art === 'raute') {
        pk.forEach(function (p) { s += '<rect x="' + (p[0] - 5).toFixed(1) + '" y="' + (p[1] - 5).toFixed(1) + '" width="10" height="10" transform="rotate(45 ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')" style="fill:' + r.farbe + '" stroke="#fff" stroke-width="2"/>'; });
      } else {
        pk.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5" style="fill:' + (r.hohl ? '#fff' : r.farbe) + ';stroke:' + (r.hohl ? r.farbe : '#fff') + '" stroke-width="2"/>'; });
      }
      /* Zahlen: Linien ausgedünnt, Punkte (Berichte) immer; über dem Wert, bei 'unten' darunter */
      if (cfg.zahlen !== false && r.zahlen !== false) pk.forEach(function (p) {
        var allein = r.art === 'punkt' || r.art === 'raute';
        if (!allein && !zeigen(p[3])) return;
        var ty = r.unten ? p[1] + 17 : p[1] - 9;
        lab += '<text class="wz' + (r.art === 'gestrichelt' ? ' wz-l' : '') + '" x="' + p[0].toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="middle">' + esc(kurz(p[2])) + '</text>';
      });
    });
    s += lab;
    s += '<line class="kreuz" x1="0" x2="0" y1="' + T + '" y2="' + (H - U) + '"/>';
    for (var i = 0; i < n; i++) s += '<rect class="hit" data-i="' + i + '" x="' + (L + i * gap).toFixed(1) + '" y="' + T + '" width="' + gap.toFixed(1) + '" height="' + (H - U - T) + '" tabindex="-1"/>';
    /* v3442 · Legende nur für Reihen mit Werten (gemessen: „Marktpreis Ø laut Bericht“ stand ohne einen einzigen Bericht da) */
    var leg = '<div class="dp-pa4-leg">' + cfg.reihen.filter(function (r) { return cfg.chips || r.werte.some(zahl); }).map(function (r) {
      var cl = r.art === 'linie' ? 'l' : r.art === 'gestrichelt' ? 'd' : r.art === 'raute' ? 'r' : r.art === 'balken' ? 'b' : 'p';
      return '<span style="color:' + r.farbe + '"><i class="' + cl + '" style="' + (cl === 'r' || cl === 'p' || cl === 'b' ? 'background:' + (r.hohl ? '#fff;border:2px solid ' + r.farbe : r.farbe) : '') + '"></i><span style="color:#6B645A">' + esc(r.name) + '</span></span>'
        + (cl === 'b' && r.farbeNeg ? '<span><i class="b" style="background:' + r.farbeNeg + '"></i><span style="color:#6B645A">' + esc(r.nameNeg || 'negativ') + '</span></span>' : '');
    }).join('') + '</div>';
    host.innerHTML = (cfg.chips ? '' : leg) + '<div class="dp-pa4-ch"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || '') + '">' + s + '</svg><div class="dp-pa4-tip"></div></div>';
    var ch = host.querySelector('.dp-pa4-ch'), tip = host.querySelector('.dp-pa4-tip'), kreuz = host.querySelector('.kreuz'), svg = host.querySelector('svg');
    Array.prototype.forEach.call(host.querySelectorAll('.hit'), function (h) {
      h.addEventListener('mousemove', function (ev) {
        var i = +h.getAttribute('data-i'), b = ch.getBoundingClientRect();
        var z = cfg.reihen.filter(function (r) { return !r.aus && zahl(r.werte[i]); }).map(function (r) {
          return '<div><span><i style="background:' + r.farbe + '"></i>' + esc(r.name) + '</span><span>' + esc(fmt(Number(r.werte[i]))) + '</span></div>';
        }).join('') + (cfg.tip ? cfg.tip(i) : '');
        if (!z) { tip.style.display = 'none'; return; }
        tip.innerHTML = '<b>' + esc(cfg.x[i]) + '</b>' + z;
        tip.style.display = 'block';
        var sk = svg.getBoundingClientRect().width / W, xx = x(i);
        kreuz.setAttribute('x1', xx); kreuz.setAttribute('x2', xx); kreuz.style.opacity = 1;
        var px = xx * sk - ch.scrollLeft, w = tip.offsetWidth || 220;
        tip.style.left = Math.max(4, Math.min(px + 14, ch.clientWidth - w - 4)) + 'px';
        tip.style.top = Math.max(4, ev.clientY - b.top - 20) + 'px';
      });
      h.addEventListener('mouseleave', function () { tip.style.display = 'none'; kreuz.style.opacity = 0; });
    });
  }

  /* ── Wert gegen Plan (Wert & Verlauf) ───────────────────────────────── */
  var _letzteHist = null;
  function wertverlauf(hist) {
    _letzteHist = hist || null;
    try { kzNeu(); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa-wertverlauf]'), function (host) {
      try { wertverlaufIn(host, hist || []); } catch (e) { host.innerHTML = ''; }
    });
  }
  /* v3443 · Alle Berichte zu diesem Objekt, neueste zuerst, mit PDF (DealActionBoarding.downloadReport) - am Ende von Wert & Lage */
  function berichteHtml(hist) {
    hist = hist || [];
    if (!hist.length) return '';
    var S = window.State, R = S && Array.isArray(S.cfRows) ? S.cfRows : [];
    var planJahr = function (j) { var r = R.filter(function (x) { return x.cal === j; })[0]; return r && zahl(r.wert_y) ? Number(r.wert_y) : null; };
    var nachW = function (h) { return zahl(h.mpi_nach_abschlag) ? Number(h.mpi_nach_abschlag) : (zahl(h.market_value) ? Number(h.market_value) : null); };
    var pdfDa = !!(window.DealActionBoarding && typeof window.DealActionBoarding.downloadReport === 'function');
    var zeilen = hist.slice().reverse().map(function (h) {
      var d = new Date(h.created_at), j = isNaN(d) ? null : d.getFullYear(), p = j ? planJahr(j) : null, w = nachW(h);
      var ab = p && w != null ? (w - p) / p * 100 : null;
      var ohne = zahl(h.mpi_ohne_abschlag) && Number(h.mpi_ohne_abschlag) !== w ? '<small>ohne Abschlag ' + eur(h.mpi_ohne_abschlag) + '</small>' : '';
      var lg = [zahl(h.micro_score) ? 'Mikro ' + Math.round(h.micro_score) : '', zahl(h.macro_score) ? 'Makro ' + Math.round(h.macro_score) : ''].filter(Boolean).join(' · ');
      var rid = parseInt(h.report_id, 10);
      /* v3444 · der PDF-Knopf steht in der Datumszelle: am Handy macht tabellen-karten.js ab der 5. Spalte „aufklappen" -
         als 7. Spalte war er dort versteckt (gemessen 390 px) */
      var pdf = pdfDa && rid > 0 ? ' <button type="button" class="btn-clean dp-pa4-btn" style="padding:2px 9px;font-size:11.5px;margin-left:6px" title="Bericht als PDF" onclick="try{DealActionBoarding.downloadReport(' + rid + ')}catch(e){}">PDF</button>' : '';
      return { z: [(isNaN(d) ? '–' : d.toLocaleDateString('de-DE')) + pdf, p != null ? eur(p) : '', w != null ? eur(w) + ohne : '',
          ab == null ? '' : (ab > 0 ? '+' : ab < 0 ? '−' : '±') + de(Math.abs(ab), 1) + ' %', zahl(h.ertragswert_eur) ? eur(h.ertragswert_eur) : '', lg],
        zk: [null, null, null, ab == null ? null : (ab >= 0 ? 'gut' : 'schlecht')] };
    });
    return abKopf('Alle Berichte zu diesem Objekt', zeilen.length + (zeilen.length === 1 ? ' Bericht' : ' Berichte') + ' · gegen deinen Plan-Wert')
      + tabelle(['Datum', 'Plan-Wert', 'Marktpreis Ø', 'gegen Plan', 'Ertragswert', 'Lage'], zeilen);
  }
  function berichteAlle(hist) {
    var h = ''; try { h = berichteHtml(hist); } catch (e) { h = ''; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa5-berichte]'), function (x) { x.innerHTML = h; });
  }
  function wertverlaufIn(host, hist) {
    var S = window.State, R = S && Array.isArray(S.cfRows) ? S.cfRows : [];
    stil();
    var heute = new Date().getFullYear();
    var nachW = function (h) { return zahl(h.mpi_nach_abschlag) ? Number(h.mpi_nach_abschlag) : (zahl(h.market_value) ? Number(h.market_value) : null); };
    var planJahr = function (j) { var r = R.filter(function (x) { return x.cal === j; })[0]; return r && zahl(r.wert_y) ? Number(r.wert_y) : null; };
    /* v3440 · Ergebnissatz oben im Reiter (ersetzt die Kacheln Plan-Wert und Restschuld - die Restschuld steht im
       Jahresabgleich und im Exit) und die Lage beim Kauf gegen heute */
    wertKopfAlle(hist);
    lageAlle(hist);
    berichteAlle(hist);
    if (R.length < 2) { host.innerHTML = ''; return; }
    var bj = hist.map(function (h) { var d = new Date(h.created_at); return isNaN(d) ? null : d.getFullYear(); }).filter(Boolean);
    var bis = Math.max(heute + 3, bj.length ? Math.max.apply(null, bj) : heute);
    var R2 = R.filter(function (r) { return r.cal <= bis; }).slice(0, 16);
    if (R2.length < 2) R2 = R.slice(0, Math.min(R.length, 10));
    var jahre = R2.map(function (r) { return r.cal; });
    var plan = R2.map(function (r) { return zahl(r.wert_y) ? Number(r.wert_y) : null; });
    var rs = R2.map(function (r) { return zahl(r.rs) ? Number(r.rs) : null; });
    var mpi = jahre.map(function () { return null; }), mpo = jahre.map(function () { return null; }), proJahr = {};
    hist.forEach(function (h) {
      var d = new Date(h.created_at); if (isNaN(d)) return;
      var j = jahre.indexOf(d.getFullYear()); if (j < 0) return;
      var nach = nachW(h);
      var ohne = zahl(h.mpi_ohne_abschlag) ? Number(h.mpi_ohne_abschlag) : null;
      if (nach != null) mpi[j] = nach;   /* der jüngste Bericht des Jahres gewinnt (hist ist aufsteigend) */
      if (ohne != null && ohne !== nach) mpo[j] = ohne;
      (proJahr[j] = proJahr[j] || []).push(d.toLocaleDateString('de-DE') + (nach != null ? ': ' + eur(nach) : ''));
    });
    var kj = parseInt(feldWert('kaufdat').slice(0, 4), 10), k = kpis();
    var kpR = jahre.map(function (j) { return (j === kj && zahl(k.kp)) ? Number(k.kp) : null; });
    /* v3440 · Farben nach dem Skill dataviz, geprüft mit validate_palette (hell, Fläche #fcfcfb): Blau #2f6db5,
       Gold dunkel #b8932f, Aqua #1baf7a - CVD-Abstand mindestens 8,5; den Kontrast-Hinweis fangen Tooltip und
       die Tabelle der Berichte darunter auf. Gold der Marke nur als var(--wl-…). */
    var reihen = [
      { name: 'Plan-Wert (deine Wertsteigerung)', farbe: C.plan, werte: plan, art: 'gestrichelt' },
      { name: 'Restschuld', farbe: C.blau, werte: rs, art: 'linie', flaeche: true, unten: true },
      { name: 'Marktpreis Ø laut Bericht', farbe: C.aqua, werte: mpi, art: 'punkt' }
    ];
    if (mpo.some(zahl)) reihen.push({ name: 'ohne Abschlag', farbe: C.aqua, werte: mpo, art: 'punkt', hohl: true, zahlen: false });
    if (kpR.some(zahl)) reihen.push({ name: 'Kaufpreis', farbe: '#2A2727', werte: kpR, art: 'raute' });
    /* Alle Berichte gegen den Plan-Wert, neueste zuerst */
    var zeilen = hist.slice().reverse().map(function (h) {
      var d = new Date(h.created_at), j = isNaN(d) ? null : d.getFullYear(), p = j ? planJahr(j) : null, w = nachW(h);
      var ab = p && w != null ? (w - p) / p * 100 : null;
      var ohne = zahl(h.mpi_ohne_abschlag) && Number(h.mpi_ohne_abschlag) !== w ? '<small>ohne Abschlag ' + eur(h.mpi_ohne_abschlag) + '</small>' : '';
      var lg = [zahl(h.micro_score) ? 'Mikro ' + Math.round(h.micro_score) : '', zahl(h.macro_score) ? 'Makro ' + Math.round(h.macro_score) : ''].filter(Boolean).join(' · ');
      return { z: [isNaN(d) ? '–' : d.toLocaleDateString('de-DE'), p != null ? eur(p) : '', w != null ? eur(w) + ohne : '',
          ab == null ? '' : (ab > 0 ? '+' : ab < 0 ? '−' : '±') + de(Math.abs(ab), 1) + ' %', zahl(h.ertragswert_eur) ? eur(h.ertragswert_eur) : '', lg],
        zk: [null, null, null, ab == null ? null : (ab >= 0 ? 'gut' : 'schlecht')] };
    });
    host.innerHTML = abKopf('Wert gegen Plan', 'Plan-Wert · Restschuld · Berichte') + '<div data-dp-pa4-g></div>'
      + erkl('<b>So liest du die Grafik:</b> Die gestrichelte Linie ist dein <b>Plan-Wert</b> – der Kaufpreis, fortgeschrieben mit der Wertsteigerung aus deinen Eingaben. Die blaue Linie mit der Fläche ist die <b>Restschuld</b> deiner Darlehen; der Abstand zwischen beiden ist das Eigenkapital im Objekt nach Plan. '
        + 'Die Punkte sind die <b>Marktpreisindikationen</b> deiner Marktberichte: gefüllt mit dem Abschlag auf Angebotspreise (aktueller Marktdurchschnitt), hohl ohne Abschlag.')
;
    linien(host.querySelector('[data-dp-pa4-g]'), {
      x: jahre.map(String), reihen: reihen, fmt: eur, achse: te, hoehe: 300, aria: 'Wert gegen Plan von ' + jahre[0] + ' bis ' + jahre[jahre.length - 1],
      tip: function (i) {
        var t = '';
        if (zahl(plan[i]) && zahl(rs[i])) t += '<div><span>Eigenkapital (Plan)</span><span>' + eur(plan[i] - rs[i]) + '</span></div>';
        if (proJahr[i]) t += '<div style="display:block;color:#7A7370;margin-top:3px">Bericht ' + esc(proJahr[i].join(' · ')) + '</div>';
        return t;
      }
    });
  }

  /* v3440 · Ergebnissatz des Reiters Wert & Lage mit dem Hauptknopf (DpJahresabgleich.mbAbrufen) */
  function wertKopf(bestand, hist) {
    hist = hist || [];
    var heute = new Date().getFullYear(), R = window.State && Array.isArray(window.State.cfRows) ? window.State.cfRows : [];
    var letzter = null; hist.forEach(function (h) { var n = zahl(h.mpi_nach_abschlag) ? Number(h.mpi_nach_abschlag) : (zahl(h.market_value) ? Number(h.market_value) : null); if (n != null) letzter = { h: h, wert: n }; });
    var rH = R.filter(function (r) { return r.cal === heute; })[0], pHeute = rH && zahl(rH.wert_y) ? Number(rH.wert_y) : null;
    var satz = '', alt = null;
    if (letzter) {
      var d = new Date(letzter.h.created_at); alt = isNaN(d) ? null : Math.round((Date.now() - d) / (30.44 * 864e5));
      if (bestand && pHeute) {
        var ab = (letzter.wert - pHeute) / pHeute * 100;
        satz = 'Der letzte Marktbericht vom ' + d.toLocaleDateString('de-DE') + ' sieht den Marktpreis bei <b>' + eur(letzter.wert) + '</b>, '
          + (Math.abs(ab) < 1 ? 'praktisch auf deinem Plan-Wert.' : '<b>' + de(Math.abs(ab), 1) + ' % ' + (ab > 0 ? 'über' : 'unter') + '</b> deinem Plan-Wert für ' + heute + ' (' + eur(pHeute) + ').')
          + (alt != null && alt >= 12 ? ' Der Bericht ist ' + alt + ' Monate alt.' : '');
      } else {
        var kp = zahl(kpis().kp) ? Number(kpis().kp) : null, dk = kp ? (kp - letzter.wert) / letzter.wert * 100 : null;
        satz = 'Marktpreis laut Bericht vom ' + d.toLocaleDateString('de-DE') + ' <b>' + eur(letzter.wert) + '</b>'
          + (dk != null ? ', der Kaufpreis liegt <b>' + (Math.abs(dk) < 0.5 ? 'gleichauf' : de(Math.abs(dk), 1) + ' % ' + (dk < 0 ? 'darunter' : 'darüber')) + '</b>.' : '.');
      }
    } else satz = bestand ? 'Noch kein Marktbericht zu diesem Objekt. Ein Bericht im Jahr reicht für den Jahresabgleich; jeder bleibt gespeichert und steht hier gegen deinen Plan-Wert.'
      : 'Noch keine Bewertung. Der Marktbericht bewertet das Objekt aus amtlichen Daten (Bodenrichtwert, Liegenschaftszins, Sachwertfaktor) und den Mieten und Angeboten vor Ort.';
    var dringend = !letzter || (bestand && alt != null && alt >= 12);
    return ergebnis(satz, knopf(bestand ? 'Neuen Marktbericht abrufen' : 'Objekt mit KI bewerten', 'try{if(window.DpJahresabgleich)DpJahresabgleich.mbAbrufen()}catch(e){}', !dringend));
  }
  var _wertHist = null, _wertKey = null;
  /* die Berichte gehören zu EINEM Objekt - nach einem Objektwechsel gelten sie nicht mehr */
  function histJetzt() { return _wertKey && _wertKey === window._currentObjKey ? _wertHist : null; }
  function wertKopfAlle(hist) {
    if (hist) { _wertHist = hist; _wertKey = window._currentObjKey; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa5-wertkopf]'), function (h) { try { h.innerHTML = wertKopf(h.getAttribute('data-dp-pa5-wertkopf') === 'b', histJetzt()); } catch (e) {} });
  }
  /* v3440 · Lage beim Kauf gegen heute: der Bericht zum Ankauf-Stichtag (sonst der erste) gegen den letzten. Mit nur
     einem Bericht oder im Ankauf: nur heute, aus dem letzten Bericht oder der Marktbewertung (#_mb_state). Gerechnet
     wird nur die Veränderung zwischen zwei angezeigten Zahlen. */
  function lageHtml(bestand, hist) {
    hist = (hist || []).filter(function (h) { return h && !isNaN(new Date(h.created_at)); });
    var M = [['Mikrolage', 'micro_score', function (v) { return Math.round(v) + ' / 100'; }, 'pkt'],
             ['Makrolage', 'macro_score', function (v) { return Math.round(v) + ' / 100'; }, 'pkt'],
             ['Marktpreis Ø ohne Abschlag', 'mpi_ohne_abschlag', eur, 'pct'],
             ['Bruttomietrendite laut Bericht', 'gross_yield_pct', function (v) { return pct(v, 1); }, 'pp'],
             ['Faktor laut Bericht', 'rent_multiplier', function (v) { return de(v, 1) + '×'; }, 'pct'],
             ['Wertentwicklung im Markt', 'price_cagr_pct', function (v) { return pct(v, 1) + ' p. a.'; }, 'pp']];
    var letzt = hist.length ? hist[hist.length - 1] : null;
    if (bestand && hist.length >= 2) {
      var sd = ''; try { var st = window.DealPilotAnkauf && DealPilotAnkauf.stand ? DealPilotAnkauf.stand() : null; sd = st && st.stichtag ? String(st.stichtag).slice(0, 10) : ''; } catch (e) {}
      var basis = hist[0];
      if (sd) hist.forEach(function (h) { if (String(h.created_at).slice(0, 10) <= sd) basis = h; });
      if (basis === letzt) basis = hist[0];
      if (basis !== letzt) {
        var z = M.filter(function (m) { return zahl(basis[m[1]]) || zahl(letzt[m[1]]); }).map(function (m) {
          var a = zahl(basis[m[1]]) ? Number(basis[m[1]]) : null, b = zahl(letzt[m[1]]) ? Number(letzt[m[1]]) : null, v = '';
          if (a != null && b != null) v = m[3] === 'pct' ? (a ? (b >= a ? '+' : '−') + de(Math.abs((b - a) / a * 100), 1) + ' %' : '') : (m[3] === 'pp' ? (b >= a ? '+' : '−') + de(Math.abs(b - a), 1) + ' %-Pkt.' : (b - a > 0 ? '+' : (b - a < 0 ? '−' : '±')) + Math.abs(Math.round(b - a)));
          var ton = a != null && b != null && b !== a && (m[1] === 'micro_score' || m[1] === 'macro_score' || m[1] === 'mpi_ohne_abschlag') ? (b > a ? 'gut' : 'schlecht') : null;
          return { z: [m[0], a != null ? m[2](a) : '', b != null ? m[2](b) : '', v], zk: [null, null, null, ton] };
        });
        if (z.length) return abKopf('Lage und Markt', 'beim Kauf gegen heute') + tabelle(['Kennzahl', { t: 'beim Kauf', u: new Date(basis.created_at).toLocaleDateString('de-DE') }, { t: 'heute', u: new Date(letzt.created_at).toLocaleDateString('de-DE') }, 'Veränderung'], z);
      }
    }
    var c = null; try { var ms = JSON.parse((document.getElementById('_mb_state') || {}).value || 'null'); c = ms && ms.card; } catch (e) { c = null; }
    var zz = [];
    if (letzt) M.forEach(function (m) { if (zahl(letzt[m[1]])) zz.push({ z: [m[0], m[2](Number(letzt[m[1]]))] }); });
    else if (c) {
      if (zahl(c.microRaw)) zz.push({ z: ['Mikrolage', Math.round(c.microRaw) + ' / 100'] });
      if (zahl(c.macroRaw)) zz.push({ z: ['Makrolage', Math.round(c.macroRaw) + ' / 100'] });
      if (zahl(c.trendRaw)) zz.push({ z: ['Preistrend', (c.trendRaw > 0 ? '+' : '') + de(c.trendRaw, 1) + ' %'], zk: [null, c.trendRaw >= 0 ? 'gut' : 'schlecht'] });
    }
    if (!zz.length) return '';
    return abKopf('Lage und Markt', letzt ? 'laut Bericht vom ' + new Date(letzt.created_at).toLocaleDateString('de-DE') : 'laut Marktbewertung') + tabelle(['Kennzahl', 'heute'], zz);
  }
  function lageAlle(hist) {
    if (hist) { _wertHist = hist; _wertKey = window._currentObjKey; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa5-lage]'), function (h) { try { h.innerHTML = lageHtml(h.getAttribute('data-dp-pa5-lage') === 'b', histJetzt()); } catch (e) { h.innerHTML = ''; } });
  }

  /** Index-Verlauf der Marktberichte (ersetzt das Chart.js-Bild, gleiche Bauart) */
  function indexVerlauf(box, hist, mets, an) {
    if (!box) return;
    stil();
    var basis = function (m) { var b = hist.filter(function (h) { return zahl(h[m.key]); })[0]; return b ? Number(b[m.key]) : NaN; };
    var reihen = mets.map(function (m, i) {
      var b = basis(m);
      return { name: m.label, farbe: m.color, art: 'linie', aus: !an[i], key: m.key, fmtAbs: m.fmt,
        werte: hist.map(function (h) { return zahl(h[m.key]) && b ? Math.round(Number(h[m.key]) / b * 1000) / 10 : null; }) };
    });
    linien(box, { x: hist.map(function (h, i) { return (i + 1) + '. ' + new Date(h.created_at).toLocaleDateString('de-DE'); }), reihen: reihen, chips: true, nurLetzte: true,
      fmt: function (v) { return 'Index ' + de(v, 1); }, achse: function (v) { return de(v, 0); }, aria: 'Entwicklung der Marktberichte, Index erster Bericht = 100',
      tip: function (i) {
        return '<div style="display:block;color:#7A7370;margin-top:3px">' + reihen.filter(function (r) { return !r.aus && zahl(hist[i][r.key]); }).map(function (r) { return esc(r.name) + ': ' + esc(r.fmtAbs(Number(hist[i][r.key]))); }).join('<br>') + '</div>';
      } });
  }

  /* ── v3099e · Kleine Grafiken für Einfach (Marcel: „wohin tendiert das Ganze") ──────────────
     vermoegen  Eigenkapital im Objekt nach Plan (wert_y − rs) und Cashflow nach Steuer aufsummiert,
                beide € über die Jahre (State.cfRows) – eine Achse
     abz        Kaltmiete und Cashflow je Monat: Ankauf · Bestand · Soll · Zielbild (DpWertZielbild)
     lage       Mikro- und Makrolage (0–100) und Preistrend laut Marktbewertung (#_mb_state) */
  function balkenGruppen(host, cfg) {
    stil();
    var W = 900, H = cfg.hoehe || 220, L = 70, Rr = 16, T = 24, U = 30, n = cfg.x.length, vs = [0];
    cfg.reihen.forEach(function (r) { r.werte.forEach(function (v) { if (zahl(v)) vs.push(Number(v)); }); });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi === lo) hi = lo + 1; if (hi > 0) hi += (hi - lo) * 0.12;   /* v3151 · Platz fuer die Zahl */
    var st = nice(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    var y = function (v) { return T + (H - T - U) * (1 - (v - lo) / (hi - lo)); };
    var gap = (W - L - Rr) / n, k = cfg.reihen.length, bw = Math.min(34, gap * 0.7 / k), s = '';
    for (var v = lo; v <= hi + st / 2; v += st) s += '<line class="gl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="ax" x="' + (L - 7) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(cfg.achse ? cfg.achse(v) : String(v)) + '</text>';
    s += '<line class="nl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    cfg.x.forEach(function (lbl, i) {
      var x0 = L + i * gap + (gap - k * bw - (k - 1) * 2) / 2;
      cfg.reihen.forEach(function (r, j) {
        var w = r.werte[i]; if (!zahl(w)) return;
        var y1 = y(Number(w)), y0 = y(0), hh = Math.max(1.5, Math.abs(y1 - y0));
        s += '<path d="' + saeule(x0 + j * (bw + 2), y0, y1, bw) + '" style="fill:' + ((Number(w) < 0 && r.farbeNeg) ? r.farbeNeg : r.farbe) + '"/>'
          /* v3151 · die Zahl am Balken */
          + '<text class="wz" x="' + (x0 + j * (bw + 2) + bw / 2).toFixed(1) + '" y="' + (Number(w) >= 0 ? y1 - 5 : y1 + 13).toFixed(1) + '" text-anchor="middle">' + esc(Math.round(Number(w)).toLocaleString('de-DE') + ' €') + '</text>';
      });
      s += '<text class="ax" x="' + (L + i * gap + gap / 2).toFixed(1) + '" y="' + (H - U + 16) + '" text-anchor="middle">' + esc(lbl) + '</text>';
    });
    for (var i = 0; i < n; i++) s += '<rect class="hit" data-i="' + i + '" x="' + (L + i * gap).toFixed(1) + '" y="' + T + '" width="' + gap.toFixed(1) + '" height="' + (H - U - T) + '"/>';
    host.innerHTML = (cfg.titel ? '<h5>' + esc(cfg.titel) + '</h5>' : '') + '<div class="dp-pa4-leg">' + cfg.reihen.map(function (r) { return '<span><i style="background:' + r.farbe + '"></i>' + esc(r.name) + '</span>'; }).join('') + '</div>'
      + '<div class="dp-pa4-ch"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.titel || '') + '">' + s + '</svg><div class="dp-pa4-tip"></div></div>';
    var ch = host.querySelector('.dp-pa4-ch'), tip = host.querySelector('.dp-pa4-tip');
    Array.prototype.forEach.call(host.querySelectorAll('.hit'), function (h) {
      h.addEventListener('mousemove', function (ev) {
        var i = +h.getAttribute('data-i'), b = ch.getBoundingClientRect();
        tip.innerHTML = '<b>' + esc(cfg.x[i]) + '</b>' + cfg.reihen.filter(function (r) { return zahl(r.werte[i]); }).map(function (r) { return '<div><span><i style="background:' + r.farbe + '"></i>' + esc(r.name) + '</span><span>' + esc((cfg.fmt || sEur)(Number(r.werte[i]))) + '</span></div>'; }).join('');
        tip.style.display = 'block';
        tip.style.left = Math.max(4, Math.min(ev.clientX - b.left + ch.scrollLeft + 14, ch.clientWidth - 230)) + 'px';
        tip.style.top = Math.max(4, ev.clientY - b.top - 20) + 'px';
      });
      h.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    });
  }
  function miniVermoegen(host) {
    var R = (window.State && Array.isArray(window.State.cfRows)) ? window.State.cfRows.slice(0, 15) : [];
    if (R.length < 2) { host.innerHTML = ''; return; }
    var kum = 0, eq = [], cf = [];
    R.forEach(function (r) {
      eq.push(zahl(r.wert_y) && zahl(r.rs) ? Number(r.wert_y) - Number(r.rs) : null);
      if (zahl(r.cfns_y)) kum += Number(r.cfns_y);
      cf.push(zahl(r.cfns_y) ? kum : null);
    });
    /* v3099j · Die Kurve summiert KALENDERJAHRE (cfRows.cfns_y = cfop_y − tax_y, Steuer aus dem Reiter
       Steuer), die Kachel oben zeigt ein VOLLES eingeschwungenes Jahr (State.kpis.cf_ns, calc.js „V351
       Volljahr"). Gemessen an Lindenhof 14 (Übergang 01.02.2027): Kachel −870 €/Monat nach Steuer, Kurve
       steigt, weil 2027 die Erstattung 47.378 € beträgt (Ergebnis Anlage V −125.911 €). Beides stimmt - der
       Satz unter der Grafik nennt das erste Jahr mit seinen Zahlen, der Tooltip je Jahr vor Steuer, Steuer
       und nach Steuer. Gerechnet wird nichts neu. */
    var r0 = R[0], satz = '';
    if (zahl(r0.cfop_y) && zahl(r0.tax_y) && zahl(r0.cfns_y)) {
      var k = kpis(), ue = String((document.getElementById('wirtschaftlicher_uebergang') || document.getElementById('kaufdat') || {}).value || '');
      var ueT = /^\d{4}-\d{2}-\d{2}/.test(ue) ? ue.slice(8, 10) + '.' + ue.slice(5, 7) + '.' : '';
      satz = '<p class="dp-pa4-erkl" style="margin-top:4px">Die Linie summiert den Cashflow nach Steuer <b>je Kalenderjahr</b> – mit den Erstattungen aus dem Reiter Steuer. '
        + r0.cal + (ueT ? ' (ab ' + ueT + ')' : '') + ': vor Steuer ' + sEur(r0.cfop_y) + ', ' + (r0.tax_y <= 0 ? 'Erstattung ' + sEur(-r0.tax_y) : 'Steuer ' + eur(r0.tax_y)) + ', nach Steuer <b>' + sEur(r0.cfns_y) + '</b>.'
        + (zahl(k.cf_ns) ? ' Die Kachel „Cashflow“ oben rechnet dagegen ein volles, eingeschwungenes Jahr (' + sEur(k.cf_ns / 12) + ' / Monat nach Steuer).' : '') + '</p>';
    }
    host.innerHTML = '<h5>Wohin es läuft · Vermögen aus dem Objekt</h5><div></div>' + satz;
    linien(host.querySelector('div'), { x: R.map(function (r) { return String(r.cal); }), hoehe: 260, null: true, fmt: eur, achse: te, aria: 'Eigenkapital im Objekt und aufsummierter Cashflow nach Steuer je Kalenderjahr',
      reihen: [{ name: 'Eigenkapital im Objekt (Plan-Wert − Restschuld)', farbe: C.gold, farbeNeg: C.rot, nameNeg: 'Eigenkapital negativ', werte: eq, art: 'balken' },
               { name: 'Cashflow nach Steuer inkl. Erstattungen, je Kalenderjahr aufsummiert', farbe: C.blau, werte: cf, art: 'linie' }],
      tip: function (i) {
        var r = R[i]; if (!r) return '';
        return '<div style="display:block;color:#7A7370;margin-top:3px;border-top:1px solid #F1ECE1;padding-top:3px">Jahr ' + r.cal + ': vor Steuer ' + esc(sEur(r.cfop_y || 0))
          + ' · ' + (r.tax_y <= 0 ? 'Erstattung ' + esc(sEur(-(r.tax_y || 0))) : 'Steuer ' + esc(eur(r.tax_y))) + ' · nach Steuer ' + esc(sEur(r.cfns_y || 0)) + '</div>';
      } });
  }
  function miniAbz(host) {
    var d = null; try { d = window.DpWertZielbild && window.DpWertZielbild.daten ? window.DpWertZielbild.daten() : null; } catch (e) { d = null; }
    var x = [], miete = [], cfm = [];
    if (d && d.ankauf && Array.isArray(d.ankauf.kern)) {
      var jm = d.ankauf.kern.filter(function (z) { return z.wort === 'Jahresmiete'; })[0], cv = d.ankauf.kern.filter(function (z) { return z.wort === 'Cashflow v. Steuer'; })[0];
      if (jm && zahl(jm.ankauf)) { x.push('Ankauf'); miete.push(jm.ankauf / 12); cfm.push(cv && zahl(cv.ankauf) ? cv.ankauf / 12 : null); }
    }
    var zb = d && d.zielbild, nam = { bestand: 'Bestand', mieterhoehung: 'Soll (Mieterhöhung)', zielbild: 'Zielbild' };
    if (zb && zb.stufen) ['bestand', 'mieterhoehung', 'zielbild'].forEach(function (k) {
      var s = zb.stufen[k]; if (!s) return;
      x.push(nam[k]); miete.push(zahl(s.miete_monat) ? s.miete_monat : null); cfm.push(zahl(s.cf_monat) ? s.cf_monat : null);
    });
    if (x.length < 2) { host.innerHTML = ''; return; }
    balkenGruppen(host, { titel: 'Wohin es läuft · Miete und Cashflow je Monat', x: x, hoehe: 210, achse: function (v) { return Math.round(v).toLocaleString('de-DE'); },
      reihen: [{ name: 'Kaltmiete / Monat', farbe: C.gold, werte: miete }, { name: 'Cashflow vor Steuer / Monat', farbe: C.gut, farbeNeg: C.rot, werte: cfm }] });
  }
  function miniLage(host) {
    var c = null; try { var st = JSON.parse((document.getElementById('_mb_state') || {}).value || 'null'); c = st && st.card; } catch (e) { c = null; }
    if (!c || (!zahl(c.microRaw) && !zahl(c.macroRaw))) { host.innerHTML = ''; return; }
    var bar = function (lbl, v, farbe) { return zahl(v) ? '<span>' + lbl + '</span><span class="bahn"><i style="width:' + Math.max(2, Math.min(100, v)) + '%;--c:' + farbe + '"></i></span><b>' + Math.round(v) + ' / 100</b>' : ''; };
    var tr = zahl(c.trendRaw) ? Number(c.trendRaw) : null;
    host.innerHTML = '<h5>Wohin es läuft · Lage laut Marktbewertung</h5><div class="dp-pa4-hb">'
      + bar('Mikrolage', c.microRaw, C.gold) + bar('Makrolage', c.macroRaw, C.gold)
      + (tr != null ? '<span>Preistrend</span><span style="font:500 12px Inter,sans-serif;color:' + (tr >= 0 ? '#2E7D50' : '#B8625C') + '">' + (tr >= 0 ? '▲ steigend' : '▼ fallend') + '</span><b>' + (tr > 0 ? '+' : '') + de(tr, 1) + ' %</b>' : '')
      + '</div>';
  }
  function minisZeichnen() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa4-mini]'), function (h) {
      try {
        var a = h.getAttribute('data-dp-pa4-mini');
        if (a === 'vermoegen') miniVermoegen(h); else if (a === 'abz') miniAbz(h); else if (a === 'lage') miniLage(h);
      } catch (e) { h.innerHTML = ''; }
    });
  }

  /* ── v3099e · Kürzen für Einfach in Reitern, deren Inhalt aus anderen Modulen kommt
     (Kaufpreis & Offerte, Bank, Lage, Anschluss & Exit, Unterlagen). Gemessen: Anschluss & Exit war in
     Einfach und Detail gleich lang (5.887 Zeichen) - „Einfach und Detail funktioniert nicht immer".
     Lange Absätze: Einfach erster Satz, Detail ganz; Listen: Einfach drei Punkte; Fußnoten nur Detail. */
  function kuerzen(html) {
    if (!html) return html;
    var box = document.createElement('div'); box.innerHTML = html;
    var frei = function (el) { return !el.closest('.dp-pa-e,.dp-pa-d,.dp-pa4-szk,[data-dp-bestand],table'); };
    Array.prototype.forEach.call(box.querySelectorAll('p.dp-pa-p'), function (p) {
      if (!frei(p) || (p.textContent || '').length < 170) return;
      var e = document.createElement('p'); e.className = 'dp-pa-p dp-pa-e'; e.textContent = kurz(p.textContent, 170);
      p.classList.add('dp-pa-d'); p.parentNode.insertBefore(e, p);
    });
    Array.prototype.forEach.call(box.querySelectorAll('.dp-pa-kv'), function (k) {
      if (!frei(k) || (k.textContent || '').length < 170) return;
      var st = k.querySelector('strong'), lbl = st ? st.textContent : '', rest = (k.textContent || '').slice(lbl.length).trim();
      var e = document.createElement('div'); e.className = 'dp-pa-kv dp-pa-e'; e.innerHTML = (lbl ? '<strong>' + esc(lbl) + '</strong> ' : '') + esc(kurz(rest, 170));
      k.classList.add('dp-pa-d'); k.parentNode.insertBefore(e, k);
    });
    Array.prototype.forEach.call(box.querySelectorAll('ul,ol'), function (l) {
      if (!frei(l)) return;
      Array.prototype.forEach.call(l.children, function (li, i) { if (i >= 3) li.classList.add('dp-pa-d'); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.dp-pa-fuss,.dp-pa-offmail'), function (f) { if (frei(f)) f.classList.add('dp-pa-d'); });
    /* Fragen und Antworten des Piloten: Einfach nur die erste */
    Array.prototype.forEach.call(box.querySelectorAll('.dp-pa-qa'), function (q) {
      var kids = Array.prototype.slice.call(q.children), n = 0;
      kids.forEach(function (c) { if (c.classList.contains('dp-pa-kv') && !c.classList.contains('dp-pa-e')) n++; if (n > 1) c.classList.add('dp-pa-d'); });
    });
    return box.innerHTML;
  }

  /* v3099e · Unterlagen & WEG steht immer da (Fassung 4): ohne Auswertung mit dem Einstieg zum Hochladen */
  /* v3099e/v3120 · Unterlagen & WEG steht immer da. v3120: EIN Eingang (unterlagen-eingang.js) für Wirtschaftspläne,
     Protokolle, Mietverträge, Abrechnungen, Rechnungen - und der Verlauf, was wann eingelesen und übernommen wurde. */
  function unterlagenPanel(html, opt) {
    opt = opt || {};   /* v4007 · ohneEingang: Knopf steht oben im Hausverlauf; ohneVerlauf: Verlauf setzt der Aufrufer ans Ende */
    var knoepfe = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' + '<button type="button" class="btn-clean dp-pa4-btn" onclick="if(window.DpEingang)DpEingang.oeffnen();else if(window.DealPilotBelegImport)DealPilotBelegImport.open(\'wk\')">Belege, Unterlagen &amp; Rechnungen einlesen</button>' + '</div>';
    var verlauf = '';
    try { verlauf = opt.ohneVerlauf ? '' : eingangVerlauf(); } catch (e) { verlauf = ''; }
    var erklaerung = '<p class="dp-pa-p">Wirtschaftsplan und Jahresabrechnung → Werbungskosten mit Jahr · Protokolle → Beschlüsse und Sonderumlagen · Mietverträge → passende Einheit und Mieter · Rechnungen → Werbungskosten. Nichts wird ohne deine Bestätigung übernommen.</p>';
    if (html) return kuerzen(html) + verlauf + (opt.ohneEingang ? '' : karte(kopfzeile('Neue Unterlagen') + erklaerung + knoepfe, 'dp-pa4-mt'));
    if (opt.ohneEingang) return verlauf;   /* v4007 · ohne Auswertung und mit Hausverlauf: dessen Knopf trägt das Hochladen */
    return karte(kopfzeile('Unterlagen & WEG') + '<p class="dp-pa-p">Noch keine Unterlagen ausgewertet.</p>' + erklaerung + knoepfe) + verlauf;
  }
  function eingangVerlauf() {
    var vh = window.DpEingang ? window.DpEingang.verlaufHtml() : '';
    return vh ? karte(kopfzeile('Eingelesen und übernommen') + vh, 'dp-pa4-mt') : '';
  }

  /* ══ v3440 · ANKAUF · BESTAND · ZIELBILD ALS EINE KENNZAHLEN-TABELLE ═════════════════════════════════
     Marcel 15.11.2026 (Demo Fassung 2): „die Kennzahlentabelle ist super, könnte man dort die Aufteilung mit
     integrieren?" Bis v3439 standen hier drei Fassungen derselben Zahlen: die Einfach-Kacheln (wert-zielbild.js
     kernaussagen), die Tafel aus DpPotenzial (tafelHtml, „Ankauf · Bestand · Zielbild") und die Jahresstände.
     Jetzt EINE Tabelle, Spalten Ankauf · Heute · nach Mieterhöhung · Zielbild · Aufteilung (Ankauf-Phase ohne
     „Heute", dort ist der heutige Stand der Ankauf), Gruppen Miete und Rendite · Wert · Finanzierung und Steuer.
     RECHNET NICHTS NEU - gelesen wird:
       Heute, Mieterhöhung, Zielbild  DpWertZielbild.daten().zielbild (dieselbe Quelle wie Bewertung und PDFs:
                                      DpPotenzial.modell/kennzahlen/stufenWerte), Wertzuwachs = mehrUndZuwachs()
       Ankauf (Bestand)               DealPilotAnkauf.abweichung().zeilen (eingefrorener Stand, wie „Ankauf gegen
                                      Bestand"), Cashflow/Monat = Cashflow v. Steuer ÷ 12 wie potenzial.js ankaufKurz
       Aufteilung                     DpPotenzial.aufteilungKurz() (Aufteilerwert des Marktbericht-Dienstes, nur MFH)
       Restschuld heute               State.cfRows (rs des laufenden Jahres)
     Zielerreichung aus DpJahresstaende.zielerreichung() (Daten, nicht deren Tafel). */
  function siDaten(bestand) {
    var D = null; try { D = window.DpWertZielbild && window.DpWertZielbild.daten ? window.DpWertZielbild.daten() : null; } catch (e) { D = null; }
    var Z = D && D.zielbild ? D.zielbild : null, ab = null, zA = {}, auf = null;
    try { var AK = window.DealPilotAnkauf; ab = bestand && AK && AK.vorhanden && AK.vorhanden() ? AK.abweichung() : null; } catch (e) { ab = null; }
    (ab && Array.isArray(ab.zeilen) ? ab.zeilen : []).forEach(function (z) { zA[z.schluessel] = z; });
    try { var PZ = window.DpPotenzial; if (PZ && PZ.aufteilungKurz) auf = PZ.aufteilungKurz(PZ.ergebnis(), PZ.modell()); } catch (e) { auf = null; }
    var mfh = false; try { mfh = !!(window.DpMfhEinheiten && window.DpMfhEinheiten.artMitEinheiten && window.DpMfhEinheiten.artMitEinheiten()); } catch (e) {}
    return { D: D, Z: Z, ab: ab, zA: zA, auf: auf, mfh: mfh };
  }
  function siTabelle(bestand) {
    var d = siDaten(bestand), Z = d.Z, zA = d.zA, S = Z ? Z.stufen : {}, J = (Z && Z.jahre) || {};
    var hatAnkauf = bestand && Object.keys(zA).length > 0;
    if (!Z && !hatAnkauf) return null;
    var T = d.auf && d.auf.aufteiler && d.auf.aufteiler.bestand ? d.auf.aufteiler.bestand : null;
    var mitAuf = !!(T || (d.auf && d.auf.gesperrt));
    var sp = [];
    if (hatAnkauf) sp.push({ k: 'ankauf', t: 'Ankauf', u: datumDe(d.ab.stichtag) });
    if (Z || hatAnkauf) sp.push({ k: 'bestand', t: bestand ? 'Heute' : 'Ankauf', u: bestand ? String(new Date().getFullYear()) : 'heute gerechnet' });
    if (S.mieterhoehung) sp.push({ k: 'mieterhoehung', t: 'nach Mieterhöhung', u: J.mieterhoehung ? 'ab ' + J.mieterhoehung : 'Mieter bleibt', kl: 'hebel' });
    if (S.zielbild) sp.push({ k: 'zielbild', t: 'Zielbild', u: J.zielbild ? String(J.zielbild) : 'Jahr offen', kl: 'hebel' });
    if (mitAuf) sp.push({ k: 'aufteilung', t: 'Aufteilung', u: d.auf.je_wohnung && d.auf.je_wohnung.length ? d.auf.je_wohnung.filter(function (w) { return w.art !== 'gewerbe'; }).length + ' Wohnungen einzeln' : 'in Eigentumswohnungen', kl: 'hebel' });
    var A = function (s) { var z = zA[s]; return z && zahl(z.ankauf) ? Number(z.ankauf) : null; };
    var H = function (s) { var z = zA[s]; return z && zahl(z.bestand) ? Number(z.bestand) : null; };
    /* Wert einer Kennzahl je Spalte; die Spalte Heute nimmt die Stufe Bestand, ohne Zielbild-Modell den Abgleich */
    var w = function (feld, k) {
      if (k === 'aufteilung') return null;
      if (k === 'ankauf') return { miete_jahr: A('_kpis_miete_j') != null ? A('_kpis_miete_j') : (A('nkm') != null ? A('nkm') * 12 : null), miete_qm: A('_nkm_qm'), bmy: A('_kpis_bmy'), cf_monat: A('_kpis_cf_vs') != null ? A('_kpis_cf_vs') / 12 : null, dscr: A('_kpis_dscr') }[feld];
      var st = S[k];
      if (st && st[feld] != null) return st[feld];
      if (k === 'bestand' && hatAnkauf) return { miete_jahr: H('_kpis_miete_j') != null ? H('_kpis_miete_j') : (H('nkm') != null ? H('nkm') * 12 : null), miete_qm: H('_nkm_qm'), bmy: H('_kpis_bmy'), cf_monat: H('_kpis_cf_vs') != null ? H('_kpis_cf_vs') / 12 : null, dscr: H('_kpis_dscr') }[feld];
      return null;
    };
    var kopf = [{ t: 'Kennzahl' }].concat(sp.map(function (c) { return { t: c.t, u: c.u, kl: c.kl }; }));
    var zeile = function (titel, f, opt) {
      opt = opt || {};
      var zz = sp.map(function (c) { var v = null; try { v = f(c.k); } catch (e) { v = null; } return v; });
      if (!zz.some(function (v) { return v != null && v !== ''; })) return null;
      return { z: [titel + (opt.u ? '<small>' + opt.u + '</small>' : '')].concat(zz.map(function (v) { return v == null ? '' : (typeof v === 'object' ? v.h : v); })), kl: opt.kl, d: opt.d,
        zk: [null].concat(sp.map(function (c, i) { var v = zz[i]; return [c.kl || '', v && typeof v === 'object' && v.kl ? v.kl : ''].join(' ').trim() || null; })) };
    };
    var sub = function (h, s) { return s ? h + '<small>' + s + '</small>' : h; };
    var ewGesperrt = !!(Z && Z.ertragswert_gesperrt);
    var zeilen = [{ gr: 'Miete und Rendite' },
      zeile('Kaltmiete im Jahr', function (k) { var v = w('miete_jahr', k); return v == null ? null : sub(eur(v), w('miete_qm', k) != null ? de(w('miete_qm', k), 2) + ' €/m² im Monat' : ''); }),
      zeile('Bruttomietrendite', function (k) { var v = w('bmy', k); return v == null ? null : pct(v); }, { u: 'auf Kaufpreis und Maßnahmen' }),
      zeile('Cashflow vor Steuer im Monat', function (k) { var v = w('cf_monat', k); return v == null ? null : { h: sEur(v), kl: v < 0 ? 'schlecht' : '' }; }),
      zeile('DSCR', function (k) { var v = w('dscr', k); return v == null ? null : { h: de(v, 2), kl: v < 1 ? 'schlecht' : '' }; }, { d: true }),
      { gr: 'Wert' },
      zeile('Maßnahmenkosten', function (k) { if (k === 'aufteilung') return d.auf && d.auf.kosten > 0 ? sub(eur(d.auf.kosten), 'Kosten der Aufteilung') : null; if (k === 'ankauf' || k === 'bestand') return null; var st = S[k]; return st ? eur(st.kosten || 0) : null; }),
      ewGesperrt ? zeile('Ertragswert', function (k) { return k === 'bestand' ? 'mit Stufe 3' : null; }) :
      zeile('Ertragswert', function (k) { var st = S[k]; return st && st.ertragswert != null ? sub('<b>' + eur(st.ertragswert) + '</b>', st.rnd != null ? 'RND ' + de(st.rnd, 0) + ' J.' : '') : null; },
        { u: Z && Z.lzs && Z.lzs.pct != null ? 'Liegenschaftszins ' + de(Z.lzs.pct, 2) + ' %' + (Z.lzs.stufe ? ' · Stufe ' + esc(Z.lzs.stufe) : '') : '' }),
      ewGesperrt ? null : zeile('Marktpreisindikation', function (k) { var st = S[k]; return st && st.marktpreisindikation != null ? sub(eur(st.marktpreisindikation), st.mpi_ohne_abschlag != null ? 'ohne Abschlag ' + eur(st.mpi_ohne_abschlag) : '') : null; },
        { d: true, u: S.bestand && S.bestand.mpi_abschlag_pct > 0 ? 'Angebote am Ort, nach ' + de(S.bestand.mpi_abschlag_pct, 1) + ' % Abschlag' : 'Angebote am Ort' }),
      T ? zeile('Wert nach Aufteilung', function (k) { return k === 'aufteilung' ? sub('<b>' + eur(T.wert) + (T.vollstaendig ? '' : '*') + '</b>', esc(T.bezeichnung || 'Vergleichswert') + ' führend') : null; }, { u: 'Wohnungen einzeln, nach Aufteilungskosten' }) : null,
      ewGesperrt ? null : zeile('Wertzuwachs nach Kosten', function (k) {
        if (k === 'aufteilung') return T && zahl(T.potenzial) ? (T.potenzial < 0 ? { h: 'kein Potenzial', kl: 'schlecht' } : { h: '+' + eur(T.potenzial), kl: 'gut' }) : null;
        var v = Z && Z.wertzuwachs_nach_kosten ? Z.wertzuwachs_nach_kosten[k] : null; return v == null ? null : { h: sEur(v), kl: v >= 0 ? 'gut' : 'schlecht' }; },
        { kl: 'su', u: 'Ertragswert der Stufe − heute − Maßnahmen' })];
    /* Finanzierung und Steuer: Ankauf gegen heute (die Stufen ändern Finanzierung und Steuer nicht) */
    var R = window.State && Array.isArray(window.State.cfRows) ? window.State.cfRows : [], heute = new Date().getFullYear();
    var rsH = (R.filter(function (r) { return r.cal === heute; })[0] || {}).rs;
    var kp = kpis();
    var fz = [
      zeile('Restschuld', function (k) { return k === 'bestand' && zahl(rsH) ? sub(eur(rsH), 'Projektion ' + heute) : null; }),
      zeile('Cashflow nach Steuer im Jahr', function (k) { var v = k === 'ankauf' ? A('_kpis_cf_ns') : (k === 'bestand' ? (hatAnkauf ? H('_kpis_cf_ns') : (zahl(kp.cf_ns) ? Number(kp.cf_ns) : null)) : null); return v == null ? null : { h: sEur(v), kl: v < 0 ? 'schlecht' : '' }; }),
      zeile('Beleihungsauslauf (LTV)', function (k) { var v = k === 'ankauf' ? A('_kpis_ltv') : (k === 'bestand' ? (hatAnkauf ? H('_kpis_ltv') : (zahl(kp.ltv) ? Number(kp.ltv) : null)) : null); return v == null ? null : pct(v, 1); }),
      zeile('Zinssatz', function (k) { var v = k === 'ankauf' ? A('d1z') : (k === 'bestand' ? H('d1z') : null); return v == null ? null : pct(v); }),
      zeile('Steuerwirkung im Jahr', function (k) { var v = k === 'ankauf' ? A('_steuerwirkung') : (k === 'bestand' ? H('_steuerwirkung') : null); return v == null ? null : sEur(v); }, { u: 'Plus = Erstattung' })
    ].filter(Boolean);
    if (fz.length) { zeilen.push({ gr: 'Finanzierung und Steuer', d: true }); fz.forEach(function (z) { z.d = true; zeilen.push(z); }); }
    var satz = [];
    var mA = w('miete_jahr', 'ankauf'), mH = w('miete_jahr', 'bestand');
    if (bestand && mA != null && mH != null && Math.round(mH - mA) !== 0) satz.push('Seit dem Kauf <b>' + sEur(mH - mA) + ' Miete im Jahr</b>');
    var mehr = Z && Z.mehrertrag_jahr ? Z.mehrertrag_jahr.mieterhoehung : null;
    if (zahl(mehr) && mehr > 0) satz.push((satz.length ? 'mit der nächsten Mieterhöhung kommen ' : 'Mit der Mieterhöhung kommen ') + '<b>' + sEur(mehr) + '</b> im Jahr dazu');
    var zw = Z && Z.wertzuwachs_nach_kosten ? Z.wertzuwachs_nach_kosten.zielbild : null;
    var zk = (S.zielbild && S.zielbild.kosten) || 0;
    if (zahl(zw) && !ewGesperrt) satz.push((satz.length ? 'das Zielbild bringt ' : 'Das Zielbild bringt ') + (zk > 0 ? 'nach ' + eur(zk) + ' Kosten ' : 'ohne Maßnahmenkosten ') + '<b>' + sEur(zw) + ' Wert</b>');
    if (T && zahl(T.potenzial) && T.potenzial > 0) satz.push((satz.length ? 'die Aufteilung ' : 'Die Aufteilung bringt ') + '<b>+' + eur(T.potenzial) + '</b>' + (satz.length ? '' : ' Wert'));
    var s = satz.length ? satz.join(', ').replace(/^(.)/, function (c) { return c.toUpperCase(); }) + '.' : (hatAnkauf ? 'Der Ankauf-Stand vom ' + datumDe(d.ab.stichtag) + ' gegen heute, Kennzahl für Kennzahl.' : 'Was in dem Objekt steckt: heute, nach Mieterhöhung und im Zielbild.');
    var hin = [];
    if (!mitAuf) hin.push(d.mfh ? 'Aufteilung: der Aufteilerwert erscheint, sobald die Ertragswerte gerechnet sind und das Haus aufgeteilt werden kann.' : 'Aufteilung: nur beim Haus mit mehreren Wohnungen, deshalb hier keine Spalte.');
    else if (!T && d.auf.gesperrt) hin.push('Aufteilung: ' + esc(d.auf.gesperrt));
    if (S.mieterhoehung) hin.push('Mieterhöhung nach § 558 BGB' + (J.mieterhoehung ? ' ab ' + J.mieterhoehung : '') + ', Mieter bleibt.');
    if (Z && Z.kurz_ausblick) hin.push(esc(Z.kurz_ausblick));
    return { satz: s, html: tabelle(kopf, zeilen.filter(Boolean)), hinweis: hin.join(' '), Z: Z, hatAnkauf: hatAnkauf };
  }
  function zielBalken() {
    var J = window.DpJahresstaende, z = null;
    try { z = J && J.zielerreichung ? J.zielerreichung() : null; } catch (e) { z = null; }
    if (!z || !Array.isArray(z.hebel) || !z.hebel.length) return '';
    var zeilen = z.hebel.filter(function (h) { return zahl(h.pct); });
    if (!zeilen.length) return '';
    return abKopf('Zielerreichung', 'Ankauf → heute → Ziel' + (zahl(z.gesamt) ? ' · gesamt ' + Math.round(z.gesamt) + ' %' : ''))
      + '<div class="dp-pa5-ziel">' + zeilen.map(function (h) {
        var p = Math.max(0, Math.min(100, Number(h.pct)));
        return '<span>' + esc(h.wort) + '</span><div class="bahn" title="' + esc(h.text || '') + '"><i style="width:' + p.toFixed(1) + '%"></i></div><b>' + Math.round(Number(h.pct)) + ' %</b>'
          + (h.zaehlt === false ? '<small>nicht in der Gesamtzahl</small>' : '');
      }).join('') + '</div>';
  }
  function siInhalt(bestand, teile) {
    var t = null; try { t = siTabelle(bestand); } catch (e) { try { console.warn('[pilot-analyse v3440] Kennzahlen', e); } catch (x) {} t = null; }
    var h = '';
    if (t) {
      var Z = t.Z;
      h += ergebnis(t.satz, Z && Z.ertragswert_hinweis ? '<button type="button" class="btn-clean dp-pa5-knopf" data-dp-pot-rechnen="1">Ertragswerte rechnen</button>' : '');
      if (Z && Z.ertragswert_hinweis) h += hinweis(esc(Z.ertragswert_hinweis));
      h += abKopf('Kennzahlen', bestand ? 'Ankauf eingefroren · heute aus den Reitern · Hebel aus Bewertung' : 'Hebel aus dem Reiter Bewertung') + t.html + hinweis(t.hinweis);
      if (bestand && teile.steuerText) h += '<div class="dp-pa-d">' + hinweis('<b>Steuerlich, Ankauf gegen heute:</b> ' + txt(teile.steuerText)) + '</div>';
    } else if (teile.leer) h += teile.leer;
    if (bestand) h += zielBalken();
    return h;
  }
  function siZeichnen() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa5-si]'), function (host) {
      try { var a = host.getAttribute('data-dp-pa5-si'); host.innerHTML = siInhalt(a === 'b', _siTeile[a] || {}); } catch (e) {}
    });
  }
  /* Der Reiter: oben die Tabelle (neu gezeichnet, sobald Marktbericht, Ertragswerte oder Abrufe da sind), darunter
     „Kauf gegen heute, alle Kennzahlen" mit „Pilot beim Ankauf" und im Detail die Rechenwege der DpPotenzial-Karte. */
  function siReiter(bestand, teile, analyse) {
    teile = teile || {};
    _siTeile[bestand ? 'b' : 'a'] = { leer: teile.leer || '', steuerText: analyse && has(analyse.soll_ist_steuer) ? analyse.soll_ist_steuer : '' };
    var h = (teile.zbf || '') + '<div data-dp-pa5-si="' + (bestand ? 'b' : 'a') + '">' + siInhalt(bestand, _siTeile[bestand ? 'b' : 'a']) + '</div>';
    /* v3441 · gemessen v3440 (Bestands-MFH, 1280 px): mit „Kauf gegen heute“ und „Pilot beim Ankauf“ auch im Einfach war der
       Reiter 2.302 px lang (v3420: 938). Einfach zeigt den Weg dorthin, Detail die ganze Tafel. */
    if (teile.sollIst) h += '<div class="dp-pa-e">' + abKopf('Kauf gegen heute, alle Kennzahlen', 'im Detail') + hinweis('Alle Kennzahlen des Ankauf-Stands gegen heute, mit Abweichung, und was der Pilot beim Kauf gesagt hat. '
        + '<button type="button" class="btn-clean dp-pa4-link" data-dp-pa-modus-setzen="detail">Im Detail zeigen</button>') + '</div>'
      + '<div class="dp-pa-d">' + abKopf('Kauf gegen heute, alle Kennzahlen', 'Ertrag · Kosten · Finanzierung · Steuer') + teile.sollIst + '</div>';
    /* v3442 · gemessen v3441: mit der offenen DpPotenzial-Karte war das Detail 3.691 px lang (v3420: 3.156) - jetzt zugeklappt */
    if (teile.pot) h += '<details class="dp-pa-d dp-pa5-mehr" data-dp-pa5-pot="1"><summary>Rechenweg, Marktpreise und Aufteilung<span class="dp-pa5-eti">aus dem Reiter Bewertung</span></summary>' + teile.pot + '</details>';
    return h;
  }
  var _siTeile = {};
  var _siT = null;
  function siBald() { clearTimeout(_siT); _siT = setTimeout(siZeichnen, 60); }
  ['dp:potenzial', 'dp:potenzial-markt', 'dp:mb-ready'].forEach(function (ev) { window.addEventListener(ev, siBald); });

  /* ══ v3440 · UNTERUMSCHALTER in Potenzial & Exit / Potenzial & Risiken ═══════════════════════════════
     Gemessen v3420: der Reiter war 2.693 px (Einfach) bzw. 5.470 px (Detail) lang, alles in einem Stück. Jetzt ist
     immer EIN Abschnitt sichtbar. Die Abschnitte behalten ihre Kennungen (#dp-pa-pot, #dp-pa-risk, #dp-pa-anschluss,
     neu #dp-pa-exit) - pa-potenzial.js neuZeichnen, Wegweiser-Alias und Messe-Drehbuch finden sie weiter.
     unterZeigen(id) schaltet; ein Wegweiser auf einen Abschnitt schaltet mit. */
  var UNTER_NAME = { pot: 'Potenzial', risk: 'Risiken', anschluss: 'Anschluss', exit: 'Exit' };
  function unterLeiste(teile, bestand) {
    if (teile.length < 2) return '';
    return '<div class="dp-pa5-unter" role="group" aria-label="Abschnitt">' + teile.map(function (t, i) {
      return '<button type="button" class="btn-clean" data-dp-pa5-unter="' + t + '" aria-pressed="' + (i === 0) + '">' + (t === 'risk' && !bestand ? 'Risiken und Szenarien' : UNTER_NAME[t]) + '</button>';
    }).join('') + '</div>';
  }
  function unterZeigen(wr, id) {
    if (!wr) return false;
    var leiste = wr.querySelector('.dp-pa5-unter'); if (!leiste) return false;
    var hat = false;
    Array.prototype.forEach.call(leiste.querySelectorAll('[data-dp-pa5-unter]'), function (b) { var an = b.getAttribute('data-dp-pa5-unter') === id; if (an) hat = true; b.setAttribute('aria-pressed', String(an)); });
    if (!hat) return false;
    Array.prototype.forEach.call(wr.querySelectorAll('[data-dp-pa5-teil]'), function (t) { t.classList.toggle('dp-pa5-zu', t.getAttribute('data-dp-pa5-teil') !== id); });
    try { neuZeichnen(); } catch (e) {}
    return true;
  }

  /* ── Hülle ───────────────────────────────────────────────────────────── */
  function huelle(o) {
    stil();
    var m = modus(), bestand = !!o.bestand;
    var tab = function (id, lbl, aktiv, extra) { return '<button type="button" class="btn-clean dp-pa-tab' + (aktiv ? ' active' : '') + '"' + (extra || '') + ' onclick="_dpPaTab(\'' + id + '\',this)">' + lbl + '</button>'; };
    var panel = function (id, inner, aktiv, extra) { return '<section class="dp-pa-panel' + (aktiv ? ' active' : '') + '" id="dp-pa-' + id + '"' + (extra || '') + '>' + inner + '</section>'; };
    var reiter = [], inhalt = [];
    var add = function (id, lbl, inner, opt) { opt = opt || {}; if (!inner && !opt.leer) return; reiter.push(tab(id, lbl, !reiter.length, opt.tabExtra)); inhalt.push(panel(id, inner, inhalt.length === 0)); };
    /* v3420 · Marcel 15.11.2026 („ja Jahresabgleich zuerst"): im Bestand 7 statt 11 Unterreiter, der Jahresabgleich
       vorn; im Ankauf 8 statt 10. Zusammengelegt wird nur die Hülle: jeder bisherige Teil steht mit seiner alten
       Kennung (#dp-pa-loc, #dp-pa-pot, #dp-pa-risk …) als Abschnitt im neuen Reiter, damit pa-potenzial.js,
       ui.js (_dpVerlaufLocLine) und Wegweiser-Karten ihn weiter finden. Vorlage: design/Vorschläge/pilot-analyse-demo.html */
    /* v3440 · Abschnitte mit Unterumschalter: immer nur einer sichtbar */
    var unterReiter = function (paare, b) {
      var da = paare.filter(function (x) { return x[1]; });
      if (!da.length) return '';
      return unterLeiste(da.map(function (x) { return x[0]; }), b) + da.map(function (x, i) {
        return '<div id="dp-pa-' + x[0] + '" data-dp-pa5-teil="' + x[0] + '"' + (i ? ' class="dp-pa5-zu"' : '') + '>' + x[1] + '</div>'; }).join('');
    };
    var teil = function (id, inner, erst) { return inner ? '<div id="dp-pa-' + id + '"' + (erst ? '' : ' class="dp-pa4-mt" style="margin-top:18px"') + '>' + inner + '</div>' : ''; };
    if (bestand && o.jahre) {
      add('jahr', 'Jahresabgleich', '<div data-dp-ja-host="1"></div><div style="margin-top:18px"></div>' + o.jahre);
      try { setTimeout(function () { if (window.DpJahresabgleich) window.DpJahresabgleich.mountAll(); if (window.DpJahresbuch) window.DpJahresbuch.mountAll(); }, 0); } catch (eJ) {}
    }
    /* v4040 · Marcel 23.11.2026: eigener Reiter „ViVi“ im Bestand, nur bei verknüpftem Objekt und nicht für Einsteiger (vivi-reiter.js) */
    if (bestand && window.DpViviReiter && window.DpViviReiter.sichtbar()) {
      add('vivi', 'ViVi', '<div data-dp-vivi-host="1"></div>', { tabExtra: ' id="dp-pa-tab-vivi"' });
      try { setTimeout(function () { window.DpViviReiter.mountAll(); }, 0); } catch (eV) {}
    }
    add('uebersicht', 'Übersicht', o.uebersicht);
    /* v3440 · o.si ist ein Objekt mit den Teilen (ui.js); als Text (ältere Aufrufer) wie bis v3439 */
    if (o.si && typeof o.si === 'object') { if (o.si.pot || o.si.sollIst || o.si.leer) add('si', bestand ? 'Ankauf · Bestand · Zielbild' : 'Ankauf · Soll · Zielbild', siReiter(bestand, o.si, o.analyse)); }
    else add('si', bestand ? 'Ankauf · Bestand · Zielbild' : 'Ankauf · Soll · Zielbild', o.si ? '<div class="dp-pa-e dp-pa4-mini" data-dp-pa4-mini="abz"></div>' + o.si : o.si);
    /* Wert & Lage ist immer da (v3420): ohne Bericht mit dem Weg zur KI-Bewertung, darunter Lage & Markt */
    /* v3440 · oben der Ergebnissatz mit dem Hauptknopf (ersetzt die Karte „Wert im Jahresabgleich“ und die Kacheln
       Plan-Wert/Restschuld), dann Wert je Verfahren, Wert gegen Plan mit allen Berichten, Lage beim Kauf gegen heute */
    var mbWeg = '<div data-dp-pa5-wertkopf="' + (bestand ? 'b' : 'a') + '">' + wertKopf(bestand, histJetzt()) + '</div>';
    reiter.push('<button type="button" class="btn-clean dp-pa-tab" id="dp-pa-tab-wert" data-dp-pa-immer="1" onclick="_dpPaTab(\'wert\',this)">Wert &amp; Lage</button>');
    inhalt.push(panel('wert', mbWeg + (o.wert || '') + teil('loc', '<div data-dp-pa5-lage="' + (bestand ? 'b' : 'a') + '">' + lageHtml(bestand, histJetzt()) + '</div>' + (o.lage ? '<div style="margin-top:22px"></div>' + kuerzen(o.lage) : ''))
      /* v3443 · Marcel 15.11.2026: „unter Wert & Lage sollten auch die Berichte aufgelistet sein, unten" - die Liste aller
         Berichte (mit PDF) und der Verlauf der Abrufe stehen jetzt am Ende des Reiters, nach Lage & Markt */
      + '<div id="dp-pa-berichte" style="margin-top:26px"><div data-dp-pa5-berichte="1"></div>'
      + '<div id="dp-pa-verlauf-wrap" style="display:none;margin-top:16px"><div class="dp-pa-card" id="dp-pa-verlauf-body"></div></div></div>', false));
    /* v3323 · Potenzialanalyse (pa-potenzial.js) und Hausverlauf (hausverlauf.js) */
    var potH = ''; try { potH = window.DpPaPotenzial ? window.DpPaPotenzial.html(o.analyse || {}, bestand) : ''; } catch (eP) { potH = ''; }
    var hausH = '', zeitH = '', egH = ''; try { hausH = window.DpHausverlauf ? window.DpHausverlauf.html({ ohneVerlauf: true }) : ''; } catch (eH) { hausH = ''; }
    /* v4007 · Marcel 23.11.2026: oben EIN Knopf zum Hochladen (Hausverlauf), darunter Grafik mit Risiken je Jahr, Jahr für
       Jahr, Karten hoch/mittel/niedrig, dann die Auswertung der Unterlagen (Einfach/Detail schaltet sie), am Ende der Verlauf:
       „Was passiert ist“ und „Eingelesen und übernommen“. Doppelt waren „Weitere WEG-Unterlagen“, „+ Unterlagen nachreichen“
       und „Belege, Unterlagen & Rechnungen einlesen“ (alle drei öffnen den Import), sie fallen, wo der Hausverlauf steht. */
    try { zeitH = hausH && window.DpHausverlauf.zeitleisteHtml ? window.DpHausverlauf.zeitleisteHtml() : ''; } catch (eZ) { zeitH = ''; }
    try { egH = eingangVerlauf(); } catch (eE) { egH = ''; }
    var hausUl = teil('hausv', hausH, true) + teil('unterlagen', unterlagenPanel(o.unterlagen, { ohneEingang: !!hausH, ohneVerlauf: true }), !hausH)
      + (zeitH ? '<div id="dp-pa-hausv-zeit">' + zeitH + '</div>' : '') + (egH ? '<div id="dp-pa-eingang-verlauf">' + egH + '</div>' : '');
    if (bestand) {
      add('steuer', 'Steuer', o.steuer);
      add('haus', 'Haus &amp; Unterlagen', hausUl);
      add('potx', 'Potenzial &amp; Exit', unterReiter([['pot', potH], ['risk', o.risiko], ['anschluss', o.anschluss != null ? kuerzen(o.anschluss) : kuerzen(o.anschlussExit)], ['exit', o.exit != null ? kuerzen(o.exit) : '']], true));
    } else {
      add('verh', 'Kaufpreis &amp; Offerte', kuerzen(o.verhandlung));
      add('bank', 'Finanzierung &amp; Bank', kuerzen(o.bank));
      add('steuer', 'Steuer', o.steuer);
      add('haus', 'Haus &amp; Unterlagen', hausUl);
      add('potx', 'Potenzial &amp; Risiken', unterReiter([['pot', potH], ['risk', o.risiko]], false));
    }
    var phase = bestand ? 'Bestand' : 'Ankauf', info = '', seit = '';
    try {
      var AK = window.DealPilotAnkauf, st = AK && AK.stand ? AK.stand() : null;
      if (bestand && st && st.stichtag) { seit = String(st.stichtag).split('-').reverse().join('.'); info = 'Ankauf-Stand vom ' + seit + ' · Fragen und Reiter für das Halten'; }
      else info = bestand ? 'Fragen und Reiter für das Halten' : 'Fragen und Reiter für die Kaufentscheidung';
    } catch (e) {}
    /* v3259 · EINE Kopfzeile. Wo vorher was stand (Bericht v3259):
       Stand-Kasten (ui.js)          eigener Kasten, 2-3 Zeilen  -> einzeilig in der Kopfzeile, Tipp klappt ihn auf
       „↻ Analyse neu abrufen"       eigene Zeile                -> Knopf „Neu abrufen" rechts (runAI, unverändert)
       Phase + Info                  Pille + grauer Satz         -> Pille, Ankauf-Stand klein darin, Satz als Tooltip
       „PDF zusammenstellen"         rechts in Zeile 3           -> Knopf „PDF" rechts (data-dp-pa4-pdf, unverändert)
       Einfach | Detail              rechts in Zeile 3           -> rechts in der Reiterleiste (am Handy in der Kopfzeile)
       Kurzfassung-/Ausführlich-Zeile eigene Zeile               -> Tooltip am Umschalter */
    var seg = function () {
      return '<div class="dp-pa4-seg" role="group" aria-label="Darstellung">'
        + '<button type="button" class="btn-clean" data-dp-pa-modus-knopf="einfach" aria-pressed="' + (m === 'einfach') + '" title="Kurzfassung: das Wichtigste mit kleinen Grafiken">Einfach</button>'
        + '<button type="button" class="btn-clean" data-dp-pa-modus-knopf="detail" aria-pressed="' + (m === 'detail') + '" title="Ausführlich: alle Zahlen, Tafeln und Texte der Analyse">Detail</button></div>';
    };
    var IC_NEU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
    var IC_PDF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 15h6"/></svg>';
    var kopf = '<div class="dp-pa4-kopf">'
      + '<span class="dp-pa4-phase" title="' + esc(info) + '">' + phase + (seit ? '<small>Ankauf ' + esc(seit) + '</small>' : '') + '</span>'
      + (o.kopf ? '<div class="dp-pa4-stand-host" title="Antippen: ganzen Hinweis zeigen">' + o.kopf + '</div>' : '<span class="dp-pa4-stand-host"></span>')
      + seg()
      + '<div class="dp-pa4-aktionen">'
      /* v3099e · Marcel: „Pilot-Analyse starten“ oben drüber gefällt nicht - als „Neu abrufen“ in den Kopf */
      + '<button type="button" class="btn-clean dp-pa4-akt dp-pa4-neu" title="Analyse neu abrufen - beschreibt den heutigen Stand dieses Objekts" aria-label="Analyse neu abrufen" onclick="if(typeof runAI===\'function\')runAI()">' + IC_NEU + '<span class="dp-pa4-akt-t">Neu abrufen</span></button>'
      + '<button type="button" class="btn-clean dp-pa4-akt dp-pa4-pdf" data-dp-pa4-pdf="1" aria-controls="ai-pdf-sections" title="PDF zusammenstellen: Bausteine wählen" aria-label="PDF zusammenstellen">' + IC_PDF + '<span class="dp-pa4-akt-t">PDF</span></button>'
      + '</div></div>';
    var leiste = '<div class="dp-pa4-leiste"><div class="dp-pa4-rail-box">'
      + '<button type="button" class="btn-clean dp-pa4-mehr-l" data-dp-pa4-blaettern="-1" aria-label="Vorherige Reiter" tabindex="-1">‹</button>'
      + '<nav class="dp-pa-rail" aria-label="Reiter der Pilot-Analyse">' + reiter.join('') + '</nav>'
      + '<button type="button" class="btn-clean dp-pa4-mehr-r" data-dp-pa4-blaettern="1" aria-label="Weitere Reiter" tabindex="-1">›</button>'
      + '</div>' + seg() + '</div>';
    try { localStorage.setItem('dp_pa_si_ansicht', m === 'detail' ? 'genau' : 'einfach'); } catch (e) {}
    try { setTimeout(function () { leisteMessen(); minisZeichnen(); if (window.DpWertZielbild && window.DpWertZielbild.laden) window.DpWertZielbild.laden().then(function () { kzNeu(); minisZeichnen(); wegNeu(); siZeichnen(); }, function () {}); }, 0); } catch (e) {}
    return '<div class="dp-pa-wrap' + (bestand ? ' dp-pa-bestand' : '') + '" data-dp-pa-v4="1" data-dp-pa-modus="' + m + '" data-dp-pa-ansicht="' + (bestand ? 'bestand' : 'ankauf') + '">'
      + kopf + leiste
      + '<div class="dp-pa-content">' + inhalt.join('') + '</div></div>';
  }

  /* v3259 · Reiterleiste: zeigt Verlauf + Pfeil nur dort, wo wirklich weitere Reiter liegen */
  function leisteMessen() {
    Array.prototype.forEach.call(document.querySelectorAll('.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-rail-box'), function (box) {
      var r = box.querySelector('.dp-pa-rail'); if (!r) return;
      var rest = r.scrollWidth - r.clientWidth - r.scrollLeft;
      box.setAttribute('data-mehr-r', rest > 4 ? '1' : '0');
      box.setAttribute('data-mehr-l', r.scrollLeft > 4 ? '1' : '0');
      if (window.ResizeObserver && !box._dpRo) { try { box._dpRo = new ResizeObserver(function () { leisteMessen(); }); box._dpRo.observe(r);
        /* „Wert & Verlauf" wird erst später sichtbar (ui.js _dpLoadVerlauf) - die Leiste wird dann breiter als ihr Kasten */
        Array.prototype.forEach.call(r.children, function (b) { box._dpRo.observe(b); }); } catch (e) {} }
    });
  }
  document.addEventListener('scroll', function (ev) {
    var t = ev.target; if (t && t.classList && t.classList.contains('dp-pa-rail') && t.closest('.dp-pa4-rail-box')) leisteMessen();
  }, true);
  window.addEventListener('resize', function () { try { leisteMessen(); } catch (e) {} });

  /* Klicks: Modus, „Ausführlich lesen", PDF (eine Stelle für alle Hüllen) */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var k = t.closest('[data-dp-pa-modus-knopf]') || t.closest('[data-dp-pa-modus-setzen]');
    if (k && k.closest('.dp-pa-wrap[data-dp-pa-v4]')) { ev.preventDefault(); setzeModus(k.getAttribute('data-dp-pa-modus-knopf') || k.getAttribute('data-dp-pa-modus-setzen')); return; }
    /* v3099g · „Alle Zahlen zeigen (Genau)" in Ankauf · Bestand · Zielbild (wert-zielbild.js) schaltet den ganzen Reiter */
    var sk = t.closest('[data-dp-si-knopf]');
    if (sk && sk.closest('.dp-pa-wrap[data-dp-pa-v4]')) { var mm = sk.getAttribute('data-dp-si-knopf') === 'genau' ? 'detail' : 'einfach'; setTimeout(function () { setzeModus(mm); }, 0); }
    /* v3259 · Kopfzeile und Reiterleiste */
    var sh = t.closest('.dp-pa4-stand-host');
    if (sh && sh.closest('.dp-pa-wrap[data-dp-pa-v4]') && !t.closest('a,button')) { sh.classList.toggle('auf'); return; }
    var bl = t.closest('[data-dp-pa4-blaettern]');
    if (bl) {
      ev.preventDefault();
      var rl = bl.parentNode && bl.parentNode.querySelector('.dp-pa-rail');
      if (rl) { var w = Math.max(120, rl.clientWidth * 0.7) * Number(bl.getAttribute('data-dp-pa4-blaettern')); try { rl.scrollBy({ left: w, behavior: 'smooth' }); } catch (e) { rl.scrollLeft += w; } }
      return;
    }
    /* v3323 · Wegweiser-Karten der Übersicht öffnen ihren Reiter */
    var gh = t.closest('[data-dp-pa4-geh]');
    if (gh) {
      ev.preventDefault();
      var wr = gh.closest('.dp-pa-wrap'), id = gh.getAttribute('data-dp-pa4-geh');
      var such = function (k) { return wr && [].filter.call(wr.querySelectorAll('.dp-pa-rail .dp-pa-tab'), function (b) { return (b.getAttribute('onclick') || '').indexOf("'" + k + "'") >= 0; })[0]; };
      /* v3420 · zusammengelegte Reiter: alte Kennung → neuer Reiter, danach zum Abschnitt rollen */
      var ALIAS = { loc: 'wert', unterlagen: 'haus', hausv: 'haus', pot: 'potx', risk: 'potx', anschluss: 'potx', exit: 'potx', jahre: 'jahr' };
      var tb = such(id), ab = null;
      if (!tb && ALIAS[id]) { tb = such(ALIAS[id]); ab = id; }
      if (tb && ab) setTimeout(function () { var pn = wr.querySelector('.dp-pa-panel.active'); if (pn && pn.querySelector('[data-dp-pa5-teil="' + ab + '"]')) { unterZeigen(pn, ab); return; } var z = wr.querySelector('.dp-pa-panel.active #dp-pa-' + ab); if (z) try { z.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 60);
      if (tb) { tb.click(); try { tb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); wr.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
      return;
    }
    var un = t.closest('[data-dp-pa5-unter]');
    if (un && un.closest('.dp-pa-wrap[data-dp-pa-v4]')) { ev.preventDefault(); unterZeigen(un.closest('.dp-pa-panel') || un.closest('.dp-pa-wrap'), un.getAttribute('data-dp-pa5-unter')); return; }
    var rt = t.closest('.dp-pa4-rail-box .dp-pa-tab');
    if (rt) { setTimeout(function () { try { rt.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (e) {} leisteMessen(); }, 0); }
    var p = t.closest('[data-dp-pa4-pdf]');
    if (p) {
      ev.preventDefault();
      var ab = document.querySelector('#s5 .ai-box'), d = document.querySelector('.ai-pdf-details');
      var offen = ab ? ab.classList.toggle('dp-pa4-pdf-offen') : true;
      p.setAttribute('aria-expanded', String(offen));
      if (offen && d) { d.open = true; var box = d.closest('.ai-pdf-toggle') || d; try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { box.scrollIntoView(); } }
    }
  });

  window.DpPilotV4 = { VERSION: 'v3444', unterZeigen: unterZeigen, siZeichnen: siZeichnen, siTabelle: siTabelle, wegNeu: wegNeu, scoreSicht: scoreSicht, sichtbarerScore: sichtbarerScore, leisteMessen: leisteMessen, huelle: huelle, uebersicht: uebersicht, risiko: risiko, steuer: steuer, gesamtstatement: gesamtstatement,
    wertverlauf: wertverlauf, indexVerlauf: indexVerlauf, linien: linien, modus: modus, setzeModus: setzeModus, neuZeichnen: neuZeichnen, saetze: saetze, steuerTabelle: steuerTabelle };
})();
