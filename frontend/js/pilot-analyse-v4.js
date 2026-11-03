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
     huelle()          Kopfzeile (Phase, PDF, Einfach | Detail), Unterreiter, Inhalt
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
  var C = { c1: '#2A2727', c2: 'var(--wl-c9a84c, #C9A84C)', plan: 'var(--wl-b8932f, #b8932f)', linie: '#2A2727', gut: '#3FA56C', rot: '#B8625C',
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
  }

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
      '.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-stand{margin:0 0 10px}',
      '.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-rail{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;gap:2px !important;overflow-x:auto !important;overflow-y:hidden !important;border:0 !important;border-bottom:1px solid #E6DCC2 !important;margin:0 0 14px !important;padding:0 !important;position:static !important;width:auto !important;height:auto !important;background:transparent !important;box-shadow:none !important;scrollbar-width:thin}',
      '.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-rail .dp-pa-tab{flex:0 0 auto !important;width:auto !important;min-width:0 !important;border:0 !important;border-bottom:2px solid transparent !important;border-radius:0 !important;background:transparent !important;box-shadow:none !important;padding:9px 11px !important;margin:0 0 -1px !important;font:600 13px "Space Grotesk",Inter,sans-serif !important;color:#7A7370 !important;white-space:nowrap !important;text-align:center !important}',
      '.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-rail .dp-pa-tab.active{color:#2A2727 !important;border-bottom-color:var(--wl-c9a84c,#C9A84C) !important}',
      '.dp-pa-wrap[data-dp-pa-v4] > .dp-pa-content{width:auto !important;min-width:0 !important}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-mt{margin-top:12px}',
      /* gemessen bei 390 px: die Tafel der Zielerreichung (jahresstaende.js) stand 78 px über den Rand - quer scrollen wie die übrigen Tafeln */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-ziel{overflow-x:auto;max-width:100%}',
      '.dp-pa4-kopf{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}',
      '.dp-pa4-reihe{display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-width:0}',
      '.dp-pa4-phase{font:600 12px "Space Grotesk",Inter,sans-serif;padding:6px 12px;border-radius:8px;background:#FBF6E9;color:#2A2727;white-space:nowrap}',
      '.dp-pa4-info{font:400 12px Inter,system-ui,sans-serif;color:#7A7370}',
      /* v3099e/g · Marcel: „man sieht nicht, wo man ist" - gemessen: der gedrückte Knopf hatte background none;
         die Regel .sec button:not(…)×8 (style.css, Spezifität 0,9,1) nimmt .btn-clean aus - alle Knöpfe hier tragen sie.
         (eine ältere Knopf-Regel gewinnt). Jetzt mit !important und höherer Spezifität, dazu die Zeile darunter. */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-seg{display:inline-flex !important;border:1px solid #E6DCC2 !important;border-radius:10px !important;padding:3px !important;background:#fff !important;gap:2px}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-seg button{border:0 !important;background:transparent !important;color:#7A7370 !important;font:600 12.5px "Space Grotesk",Inter,sans-serif !important;padding:6px 14px !important;border-radius:7px !important;cursor:pointer;box-shadow:none !important;min-height:0 !important}',
      '.dp-pa-wrap[data-dp-pa-v4] .dp-pa4-seg button[aria-pressed="true"]{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f)) !important;color:#050505 !important}',
      '.dp-pa4-modus-zeile{display:flex;align-items:center;gap:8px;margin:0 0 10px;font:500 12px Inter,sans-serif;color:#6B645A}',
      '.dp-pa4-modus-zeile b{font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#2A2727;color:#FDFCFA}',
      '.dp-pa-wrap[data-dp-pa-modus="detail"] .dp-pa4-modus-zeile b{background:var(--wl-c9a84c,#C9A84C);color:#050505}',
      '.dp-pa-wrap[data-dp-pa-v4][data-dp-pa-modus="detail"] > .dp-pa-content{border-left:3px solid var(--wl-c9a84c,#C9A84C);padding-left:12px}',
      /* „Pilot-Analyse starten" stand über allem - jetzt „Neu abrufen" unter der Stand-Zeile; PDF-Bausteine auf Knopfdruck */
      '#s5 .ai-box:has(#ai-content .dp-pa-wrap[data-dp-pa-v4]) > #ai-btn{display:none !important}',
      '#s5 .ai-box:has(#ai-content .dp-pa-wrap[data-dp-pa-v4]):not(.dp-pa4-pdf-offen) > .ai-pdf-toggle{display:none !important}',
      '.dp-pa4-neu{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:-4px 0 12px}',
      '.dp-pa4-neu button{border:1px solid #E6DCC2;background:#fff;color:#2A2727;border-radius:9px;padding:6px 12px;font:600 12.5px "Space Grotesk",Inter,sans-serif;cursor:pointer}',
      '.dp-pa4-neu span{font:400 11.5px Inter,sans-serif;color:#7A7370}',
      /* eigene Schalter anderer Module folgen dem Kopf */
      '.dp-pa-wrap[data-dp-pa-v4] .dpu-umschalter{display:none !important}',
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-stv-fuss,.dp-pa-wrap[data-dp-pa-modus="einfach"] #dp-pa-wert-body{display:none !important}',
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
      '.dp-pa4-brief p{margin:0;font:400 13.5px/1.55 Inter,system-ui,sans-serif;color:#F1EDE5;max-width:80ch}',
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
      '.dp-pa4-a p,.dp-pa4-a li{margin:0;font:400 13.5px/1.6 Inter,system-ui,sans-serif;color:#2A2727;max-width:84ch}',
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
      '.dp-pa4-erkl{margin:10px 0 0;font:400 12.5px/1.6 Inter,sans-serif;color:#4A4542;max-width:90ch}',
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
      '.dp-pa4-chips button i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:0}'
    ].join('\n');
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
  function wertDaten() {
    try { var d = window.DpWertZielbild && window.DpWertZielbild.daten ? window.DpWertZielbild.daten() : null; return d && d.wert ? d.wert : null; } catch (e) { return null; }
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
  function kennzahlen(bestand) {
    var k = kpis(), w = wertDaten(), z = [];
    if (zahl(k.kp) && k.kp > 0) z.push(zahlKachel(bestand ? 'Kaufpreis (Ankauf)' : 'Kaufpreis', eur(k.kp), zahl(k.bmy) ? 'Bruttorendite ' + de(k.bmy, 2) + ' %' : '', '#E6DCC2'));
    if (zahl(k.cf_m)) z.push(zahlKachel('Cashflow vor Steuer · volles Jahr', sEur(k.cf_m) + ' / Monat', zahl(k.cf_ns) ? 'nach Steuer ' + sEur(k.cf_ns / 12) + ' / Monat (volles Jahr)' : '', k.cf_m >= 0 ? C.gut : C.rot));
    if (zahl(k.dscr) && k.dscr > 0) z.push(zahlKachel('DSCR', de(k.dscr, 2), k.dscr >= 1.2 ? 'Bank: trägt sich' : k.dscr >= 1 ? 'knapp über 1' : 'unter 1: Zuschuss nötig', k.dscr >= 1 ? C.gut : C.rot));
    if (w && w.marktpreisindikation && zahl(w.marktpreisindikation.mitte)) {
      var oh = w.ohne_abschlag && zahl(w.ohne_abschlag.mitte) ? 'ohne Abschlag ' + eur(w.ohne_abschlag.mitte) : '';
      z.push(zahlKachel('Marktpreis Ø', eur(w.marktpreisindikation.mitte), oh, 'var(--wl-c9a84c,#C9A84C)'));
    }
    if (w && w.ertragswert && zahl(w.ertragswert.wert)) z.push(zahlKachel('Ertragswert', eur(w.ertragswert.wert), w.ertragswert.vorlaeufig ? 'vorläufig' : (zahl(w.ertragswert.lzs_pct) ? 'LZS ' + de(w.ertragswert.lzs_pct, 2) + ' %' : ''), C.c1));
    var sc = investorScore();
    if (sc != null) z.push(zahlKachel('Investor Deal Score', String(sc), (window.ScoreTier && window.ScoreTier.stufe ? window.ScoreTier.stufe(sc).wort : ''), '#2A2727'));
    return '<div class="dp-pa4-zahlen" data-dp-pa4-kz="' + (bestand ? 'b' : 'a') + '"' + (z.length ? '' : ' style="display:none"') + '>' + z.join('') + '</div>';
  }
  /* Der Marktbericht (DpWertZielbild) lädt oft erst nach dem Zeichnen - dann die Kacheln neu */
  function kzNeu() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa4-kz]'), function (h) {
      try { var t = document.createElement('div'); t.innerHTML = kennzahlen(h.getAttribute('data-dp-pa4-kz') === 'b'); if (t.firstChild) h.parentNode.replaceChild(t.firstChild, h); } catch (e) {}
    });
  }

  /** Das Gesamtstatement: alle Aussagen der Analyse in einer Lesefolge (Detail). */
  function gesamtstatement(a, bestand) {
    var t = [], ra = a.risikoanalyse && typeof a.risikoanalyse === 'object' ? a.risikoanalyse : null, sz = a.szenarien && typeof a.szenarien === 'object' ? a.szenarien : null;
    t.push(abschnitt('Gesamtbewertung', absatz(a.gesamtbewertung || a.fazit_kurz)));
    t.push(abschnitt(bestand ? 'Einordnung' : 'Begründung des Urteils', absatz(a.empfehlung_begruendung)));
    t.push(abschnitt('Investmentbewertung', absatz(a.investmentbewertung)));
    if (bestand && a.bestand_modus) t.push(abschnitt('Bestandsstrategie · was du jetzt tun kannst', absatz(a.verhandlungsempfehlung)));
    t.push(abschnitt('Stärken', liste(a.staerken)));
    t.push(abschnitt('Risiken', liste(a.risiken)));
    if (ra) t.push(abschnitt('Risikoanalyse', '<dl>'
      + (has(ra.finanzierungsrisiko) ? '<dt>Finanzierungsrisiko (LTV und DSCR)</dt><dd>' + txt(ra.finanzierungsrisiko) + '</dd>' : '')
      + (has(ra.cashflow_stabilitaet) ? '<dt>Cashflow-Stabilität</dt><dd>' + txt(ra.cashflow_stabilitaet) + '</dd>' : '')
      + (has(ra.annahmen_abhaengigkeit) ? '<dt>Abhängigkeit von Annahmen</dt><dd>' + txt(ra.annahmen_abhaengigkeit) + '</dd>' : '') + '</dl>'));
    if (sz && (has(sz.worst_case) || has(sz.best_case))) t.push(abschnitt('Szenarien', '<dl>'
      + (has(sz.worst_case) ? '<dt>Worst Case (Miete −10 %, Zins +1 %)</dt><dd>' + txt(sz.worst_case) + '</dd>' : '')
      + (has(sz.best_case) ? '<dt>Best Case (Miete +5 %, höhere Wertsteigerung)</dt><dd>' + txt(sz.best_case) + '</dd>' : '') + '</dl>'));
    if (has(a.makrolage_recherche) || has(a.mikrolage_recherche) || has(a.kaufpreisniveau)) t.push(abschnitt('Lage und Markt', '<dl>'
      + (has(a.makrolage_recherche) ? '<dt>Makrolage</dt><dd>' + txt(a.makrolage_recherche) + '</dd>' : '')
      + (has(a.mikrolage_recherche) ? '<dt>Mikrolage</dt><dd>' + txt(a.mikrolage_recherche) + '</dd>' : '')
      + (has(a.kaufpreisniveau) ? '<dt>Kaufpreisniveau</dt><dd>' + txt(a.kaufpreisniveau) + '</dd>' : '') + '</dl>'));
    if (has(a.berichts_abgleich)) t.push(abschnitt('Abgleich mit dem Marktbericht', absatz(a.berichts_abgleich)));
    if (!bestand) {
      var off = a.kaufpreis_offerte && typeof a.kaufpreis_offerte === 'object' ? a.kaufpreis_offerte : null;
      t.push(abschnitt('Kaufpreis und Verhandlung', absatz(a.verhandlungsempfehlung) + (off ? absatz(off.begruendung) : '')));
      t.push(abschnitt('Finanzierung und Bank', liste(a.bankargumente)));
      if (has(a.anschlussfinanzierung) && typeof a.anschlussfinanzierung === 'string') t.push(abschnitt('Anschlussfinanzierung', absatz(a.anschlussfinanzierung)));
    }
    t.push(abschnitt('Was im Haus steckt', absatz(a.potenzial_text)));
    t.push(abschnitt('Steuer', absatz(a.steuer_zusammenfassung)));
    t.push(abschnitt('Optischer Eindruck aus den Fotos', absatz(a.optischer_eindruck)));
    t.push(abschnitt('DealPilot-Insight', absatz(a.dealpilot_insight)));
    var h = t.filter(Boolean).join('');
    return h ? '<div class="dp-pa4-ta">' + h + '</div>' : '';
  }

  /** Unterreiter Übersicht. extra = Karten aus ui.js (Score-Vergleich, Investor-Fit, Hinweise). */
  /** kurz(t): erster Satz, höchstens n Zeichen (Einfach) */
  function kurz(t, n) { var s = saetze(t, 1); n = n || 150; return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s; }

  function uebersicht(a, bestand, extra) {
    extra = extra || {};
    var st = window._dpEmpfStufe ? window._dpEmpfStufe(a.empfehlung || a.fazit_kurz) : { label: a.empfehlung || '—', farbe: 'var(--wl-c9a84c,#C9A84C)' };
    var sc = investorScore();
    /* v3099e · Marcel: im Bestand KEIN Urteil wie „Halten" - „meistens haben wir eh Spekulationsfristen,
       wir können eh nicht verkaufen". Im Ankauf bleibt es. Einfach: zwei Sätze statt fünf. */
    var kurzT = saetze(a.gesamtbewertung || a.fazit_kurz, 2), grund = bestand ? '' : kurz(a.empfehlung_begruendung, 220);
    var brief = '<div class="dp-pa4-brief"><div class="dp-pa4-urteil"><small>' + (bestand ? 'Stand heute' : 'Urteil zum Ankauf') + '</small>'
      + (bestand ? '' : '<span class="dp-pa-empf" style="background:' + st.farbe + ';justify-self:start">' + esc(st.label) + '</span>')
      + (sc != null ? '<span class="z">' + sc + '</span><span class="u">Investor Deal Score</span>' : '') + '</div>'
      + '<div><div class="dp-pa-e">' + (kurzT ? '<p>' + txt(kurzT) + '</p>' : '') + (grund ? '<p>' + txt(grund) + '</p>' : '') + '</div>'
      + '<div class="dp-pa-d">' + absatz(a.gesamtbewertung || a.fazit_kurz) + '</div></div></div>';
    var h = (extra.hinweis || '') + brief + kennzahlen(bestand);
    /* Einfach: die Tendenz als kleine Grafik (Vermögen im Objekt über die Jahre) */
    h += '<div class="dp-pa-e dp-pa4-mini" data-dp-pa4-mini="vermoegen"></div>';
    if (bestand && a.bestand_modus && has(a.verhandlungsempfehlung))
      h += '<div class="dp-pa-e">' + karte(kopfzeile('Was du jetzt tun kannst') + '<p class="dp-pa-p">' + txt(kurz(a.verhandlungsempfehlung, 220)) + '</p>') + '</div>';
    /* Einfach: worauf es ankommt - je zwei, ein Satz */
    var st2 = (Array.isArray(a.staerken) ? a.staerken : []).slice(0, 2), ri2 = (Array.isArray(a.risiken) ? a.risiken : []).slice(0, 2);
    if (st2.length || ri2.length) h += '<div class="dp-pa-e">' + karte(kopfzeile('Worauf es ankommt') + '<div class="dp-pa4-zwei">'
      + '<div><b style="font:600 12px Inter,sans-serif;color:#2E7D50">Dafür</b><ul class="dp-pa4-liste">' + st2.map(function (x) { return '<li>' + txt(kurz(x, 130)) + '</li>'; }).join('') + '</ul></div>'
      + '<div><b style="font:600 12px Inter,sans-serif;color:#B8625C">Dagegen</b><ul class="dp-pa4-liste">' + ri2.map(function (x) { return '<li>' + txt(kurz(x, 130)) + '</li>'; }).join('') + '</ul></div></div>'
      + '<button type="button" class="btn-clean dp-pa4-mehr" data-dp-pa-modus-setzen="detail">Ausführlich lesen (Detail)</button>') + '</div>';
    /* Detail: das ganze Statement */
    var gs = gesamtstatement(a, bestand);
    h += '<div class="dp-pa-d">' + karte(kopfzeile(bestand ? 'Gesamtstatement zum Bestand' : 'Gesamtstatement zum Ankauf') + gs
      + '<p class="dp-pa4-erkl">Das Statement fasst alle Teile der Pilot-Analyse in einer Lesefolge zusammen: ' + (bestand ? 'erst die Einordnung' : 'erst das Urteil und seine Begründung') + ', dann Stärken, Risiken und Szenarien, '
      + 'danach Lage, ' + (bestand ? 'Potenzial und Steuer' : 'Kaufpreis, Bank, Potenzial und Steuer') + '. Die Zahlen darin sind der Stand der Analyse; die Kacheln oben zeigen die heutige Rechnung.</p>')
      + (extra.score || '') + (extra.fit || '') + '</div>';
    return h;
  }

  /** Unterreiter Risiken & Szenarien */
  function risiko(a, bestand, extra) {
    extra = extra || {};
    var ra = a.risikoanalyse && typeof a.risikoanalyse === 'object' ? a.risikoanalyse : null, sz = a.szenarien && typeof a.szenarien === 'object' ? a.szenarien : {};
    /* v3099e · Einfach: drei Punkte mit je einem Satz; Detail: alle, ganz */
    var lst = function (arr) { return Array.isArray(arr) && arr.length ? '<ul class="dp-pa4-liste">' + arr.map(function (x, i) { return (i < 3 ? '<li class="dp-pa-e">' + txt(kurz(x, 140)) + '</li>' : '') + '<li class="dp-pa-d">' + txt(x) + '</li>'; }).join('') + '</ul>' : '<em class="dp-pa-empty">—</em>'; };
    var h = '<div class="dp-pa-cols">'
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

  /** Unterreiter Steuer: Verlauf wie im Reiter Steuer, Text, im Detail die Tabelle */
  function steuer(a, bestand) {
    var h = karte(kopfzeile('Steuerverlauf · wann das Objekt steuerlich positiv wird') + '<div data-dp-steuerverlauf="1"></div>'
      + erkl('<b>So liest du die Grafik:</b> Die Balken zeigen je Jahr das Ergebnis der Anlage V (Einnahmen minus Werbungskosten). Grün ist ein Verlust, der deine Steuer senkt, Gold ein Gewinn, auf den Steuer fällig wird. '
        + 'Die Linie ist der Cashflow nach Steuern. Markiert sind der Wendepunkt, das Ende der Zinsbindung und das Datum, ab dem ein Verkauf nach § 23 EStG steuerfrei ist. Es ist dieselbe Rechnung wie im Reiter Steuer.'));
    h += karte(kopfzeile('Steuerliche Zusammenfassung')
      + (has(a.steuer_zusammenfassung)
        ? '<p class="dp-pa-p dp-pa-e">' + txt(kurz(a.steuer_zusammenfassung, 220)) + '</p><p class="dp-pa-p dp-pa-d">' + txt(a.steuer_zusammenfassung) + '</p>'
        : '<div class="dp-pa-fuss" style="margin-top:0">Diese Analyse wurde vor der steuerlichen Zusammenfassung erstellt. Beim nächsten Abruf steht sie hier.</div>')
      + '<div class="dp-pa-fuss dp-pa-d">Eine Einordnung aus deinen Eingaben im Reiter Steuer – keine Steuerberatung. Lass sie von deinem Steuerberater bestätigen.</div>', 'dp-pa4-mt');
    h += belegeHtml(bestand);
    h += '<div class="dp-pa-d">' + karte(kopfzeile('Einnahmen und Werbungskosten nach Gruppen') + '<div class="dp-pa4-tab" data-dp-pa4-steuertab="1"></div>'
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
    if (hi === lo) { hi = hi + Math.abs(hi || 1) * 0.1; lo = lo - Math.abs(lo || 1) * 0.1; }
    var st = nice(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    var y = function (v) { return T + (H - T - U) * (1 - (v - lo) / (hi - lo)); };
    var gap = (W - L - Rr) / n, x = function (i) { return L + i * gap + gap / 2; };
    var fmt = cfg.fmt || function (v) { return String(v); };
    var kurz = cfg.kurz || cfg.achse || fmt;
    var schritt = n <= 8 ? 1 : Math.ceil(n / 7);
    var zeigen = function (i) { return cfg.nurLetzte ? i === n - 1 : (i % schritt === 0 || i === n - 1); };   /* nurLetzte: viele Reihen (Index) */
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
        s += '<rect x="' + xx.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="3" style="fill:' + f + '"/>';
        if (cfg.zahlen !== false && r.zahlen !== false && zeigen(i)) {
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
          s += '<polygon points="' + pk[0][0].toFixed(1) + ',' + yb.toFixed(1) + ' ' + pts + ' ' + pk[pk.length - 1][0].toFixed(1) + ',' + yb.toFixed(1) + '" style="fill:url(#' + gid + ')"/>';
        }
        if (pk.length > 1) s += '<polyline fill="none" style="stroke:' + r.farbe + '" stroke-width="' + (r.art === 'linie' ? 2.4 : 2) + '" stroke-linejoin="round"' + (r.art === 'gestrichelt' ? ' stroke-dasharray="6 4"' : '') + ' points="' + pts + '"/>';
        if (r.art === 'linie') pk.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.4" fill="#fff" style="stroke:' + r.farbe + '" stroke-width="1.8"/>'; });
      } else if (r.art === 'raute') {
        pk.forEach(function (p) { s += '<rect x="' + (p[0] - 5).toFixed(1) + '" y="' + (p[1] - 5).toFixed(1) + '" width="10" height="10" transform="rotate(45 ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')" style="fill:' + r.farbe + '" stroke="#fff" stroke-width="2"/>'; });
      } else {
        pk.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="6" style="fill:' + (r.hohl ? '#fff' : r.farbe) + ';stroke:' + (r.hohl ? r.farbe : '#fff') + '" stroke-width="2"/>'; });
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
    var leg = '<div class="dp-pa4-leg">' + cfg.reihen.map(function (r) {
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
  function wertverlaufIn(host, hist) {
    var S = window.State, R = S && Array.isArray(S.cfRows) ? S.cfRows : [];
    if (R.length < 2) { host.innerHTML = ''; return; }
    stil();
    var heute = new Date().getFullYear();
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
      var nach = zahl(h.mpi_nach_abschlag) ? Number(h.mpi_nach_abschlag) : (zahl(h.market_value) ? Number(h.market_value) : null);
      var ohne = zahl(h.mpi_ohne_abschlag) ? Number(h.mpi_ohne_abschlag) : null;
      if (nach != null) mpi[j] = nach;   /* der jüngste Bericht des Jahres gewinnt (hist ist aufsteigend) */
      if (ohne != null && ohne !== nach) mpo[j] = ohne;
      (proJahr[j] = proJahr[j] || []).push(d.toLocaleDateString('de-DE') + (nach != null ? ': ' + eur(nach) : ''));
    });
    var kj = parseInt(String((document.getElementById('kaufdat') || {}).value || '').slice(0, 4), 10), k = kpis();
    var kpR = jahre.map(function (j) { return (j === kj && zahl(k.kp)) ? Number(k.kp) : null; });
    var reihen = [
      { name: 'Plan-Wert (deine Wertsteigerung)', farbe: C.plan, werte: plan, art: 'gestrichelt' },
      { name: 'Restschuld', farbe: C.linie, werte: rs, art: 'linie', flaeche: true, unten: true },
      { name: 'Marktpreis Ø laut Bericht', farbe: C.gut, werte: mpi, art: 'punkt' }
    ];
    if (mpo.some(zahl)) reihen.push({ name: 'ohne Abschlag', farbe: C.gut, werte: mpo, art: 'punkt', hohl: true, zahlen: false });
    if (kpR.some(zahl)) reihen.push({ name: 'Kaufpreis', farbe: '#2A2727', werte: kpR, art: 'raute' });
    /* Zahlen oben */
    var letzter = null; hist.forEach(function (h) { var nach = zahl(h.mpi_nach_abschlag) ? Number(h.mpi_nach_abschlag) : (zahl(h.market_value) ? Number(h.market_value) : null); if (nach != null) letzter = { h: h, wert: nach }; });
    var ih = jahre.indexOf(heute), pHeute = ih >= 0 ? plan[ih] : null, rHeute = ih >= 0 ? rs[ih] : null;
    var zahlen = [];
    if (letzter) zahlen.push(zahlKachel('Marktpreis Ø · letzter Bericht', eur(letzter.wert), (zahl(letzter.h.mpi_ohne_abschlag) && Number(letzter.h.mpi_ohne_abschlag) !== letzter.wert ? 'ohne Abschlag ' + eur(letzter.h.mpi_ohne_abschlag) + ' · ' : '') + new Date(letzter.h.created_at).toLocaleDateString('de-DE'), C.c2));
    if (pHeute != null) zahlen.push(zahlKachel('Plan-Wert ' + heute, eur(pHeute), 'Kaufpreis fortgeschrieben', C.plan));
    if (letzter && pHeute) { var ab = (letzter.wert - pHeute) / pHeute * 100; zahlen.push(zahlKachel('Bericht gegen Plan', (ab > 0 ? '+' : ab < 0 ? '−' : '') + de(Math.abs(ab), 1) + ' %', ab >= 0 ? 'über dem Plan' : 'unter dem Plan', ab >= 0 ? C.gut : C.rot)); }
    if (rHeute != null) zahlen.push(zahlKachel('Restschuld ' + heute, eur(rHeute), pHeute ? 'Eigenkapital im Objekt ' + eur(pHeute - rHeute) + ' (Plan)' : '', C.c1));
    var satz = '';
    if (letzter && pHeute) {
      var ab2 = (letzter.wert - pHeute) / pHeute * 100;
      satz = 'Der letzte Marktbericht vom ' + new Date(letzter.h.created_at).toLocaleDateString('de-DE') + ' sieht den Marktpreis bei <b>' + eur(letzter.wert) + '</b>, '
        + (Math.abs(ab2) < 1 ? 'praktisch auf deinem Plan-Wert.' : '<b>' + de(Math.abs(ab2), 1) + ' % ' + (ab2 > 0 ? 'über' : 'unter') + '</b> deinem Plan-Wert für ' + heute + ' (' + eur(pHeute) + ').');
    } else if (!hist.length) satz = 'Noch kein Marktbericht zu diesem Objekt – die Grafik zeigt deinen Plan-Wert und die Restschuld. Mit dem ersten Bericht erscheint der Marktpreis als Punkt.';
    var oben = (zahlen.length ? '<div class="dp-pa4-zahlen">' + zahlen.join('') + '</div>' : '') + (satz ? '<p class="dp-pa4-satz">' + satz + '</p>' : '');
    host.innerHTML = oben + '<div data-dp-pa4-g></div>'
      + erkl('<b>So liest du die Grafik:</b> Die gestrichelte Linie ist dein <b>Plan-Wert</b> – der Kaufpreis, fortgeschrieben mit der Wertsteigerung aus deinen Eingaben. Die dunkle Linie mit der Fläche ist die <b>Restschuld</b> deiner Darlehen; der Abstand zwischen beiden ist das Eigenkapital im Objekt nach Plan. '
        + 'Die Punkte sind die <b>Marktpreisindikationen</b> deiner Marktberichte: gefüllt mit dem Abschlag auf Angebotspreise (aktueller Marktdurchschnitt), hohl ohne Abschlag. Der Ertragswert steht ohne Spanne in der Tafel darunter, weil er ein gerechneter Einzelwert ist.');
    linien(host.querySelector('[data-dp-pa4-g]'), {
      x: jahre.map(String), reihen: reihen, fmt: eur, achse: te, hoehe: 320, aria: 'Wert gegen Plan von ' + jahre[0] + ' bis ' + jahre[jahre.length - 1],
      tip: function (i) {
        var t = '';
        if (zahl(plan[i]) && zahl(rs[i])) t += '<div><span>Eigenkapital (Plan)</span><span>' + eur(plan[i] - rs[i]) + '</span></div>';
        if (proJahr[i]) t += '<div style="display:block;color:#7A7370;margin-top:3px">Bericht ' + esc(proJahr[i].join(' · ')) + '</div>';
        return t;
      }
    });
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
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi === lo) hi = lo + 1;
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
        s += '<rect x="' + (x0 + j * (bw + 2)).toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="3" style="fill:' + ((Number(w) < 0 && r.farbeNeg) ? r.farbeNeg : r.farbe) + '"/>'
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
               { name: 'Cashflow nach Steuer inkl. Erstattungen, je Kalenderjahr aufsummiert', farbe: C.linie, werte: cf, art: 'linie' }],
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
  function unterlagenPanel(html) {
    var knoepfe = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' + '<button type="button" class="btn-clean dp-pa4-btn" onclick="if(window.DpEingang)DpEingang.oeffnen();else if(window.DealPilotBelegImport)DealPilotBelegImport.open(\'wk\')">Belege, Unterlagen &amp; Rechnungen einlesen</button>' + '</div>';
    var verlauf = '';
    try { var vh = window.DpEingang ? window.DpEingang.verlaufHtml() : ''; if (vh) verlauf = karte(kopfzeile('Verlauf · eingelesen und übernommen') + vh, 'dp-pa4-mt'); } catch (e) { verlauf = ''; }
    var erklaerung = '<p class="dp-pa-p">Wirtschaftsplan und Jahresabrechnung → Werbungskosten mit Jahr · Protokolle → Beschlüsse und Sonderumlagen · Mietverträge → passende Einheit und Mieter · Rechnungen → Werbungskosten. Nichts wird ohne deine Bestätigung übernommen.</p>';
    if (html) return kuerzen(html) + verlauf + karte(kopfzeile('Neue Unterlagen') + erklaerung + knoepfe, 'dp-pa4-mt');
    return karte(kopfzeile('Unterlagen & WEG') + '<p class="dp-pa-p">Noch keine Unterlagen ausgewertet.</p>' + erklaerung + knoepfe) + verlauf;
  }

  /* ── Hülle ───────────────────────────────────────────────────────────── */
  function huelle(o) {
    stil();
    var m = modus(), bestand = !!o.bestand;
    var tab = function (id, lbl, aktiv, extra) { return '<button type="button" class="btn-clean dp-pa-tab' + (aktiv ? ' active' : '') + '"' + (extra || '') + ' onclick="_dpPaTab(\'' + id + '\',this)">' + lbl + '</button>'; };
    var panel = function (id, inner, aktiv, extra) { return '<section class="dp-pa-panel' + (aktiv ? ' active' : '') + '" id="dp-pa-' + id + '"' + (extra || '') + '>' + inner + '</section>'; };
    var reiter = [], inhalt = [];
    var add = function (id, lbl, inner, opt) { opt = opt || {}; if (!inner && !opt.leer) return; reiter.push(tab(id, lbl, !reiter.length, opt.tabExtra)); inhalt.push(panel(id, inner, inhalt.length === 0)); };
    add('uebersicht', 'Übersicht', o.uebersicht);
    add('si', bestand ? 'Ankauf · Bestand · Soll · Zielbild' : 'Ankauf · Soll · Zielbild', o.si ? '<div class="dp-pa-e dp-pa4-mini" data-dp-pa4-mini="abz"></div>' + o.si : o.si);
    /* Wert & Verlauf erscheint wie bisher erst mit einem Bericht oder Abruf (_dpLoadVerlauf) */
    reiter.push('<button type="button" class="btn-clean dp-pa-tab" id="dp-pa-tab-wert" style="display:none" onclick="_dpPaTab(\'wert\',this)">Wert &amp; Verlauf</button>');
    inhalt.push(panel('wert', o.wert, false));
    add('loc', 'Lage &amp; Markt', o.lage ? '<div class="dp-pa-e dp-pa4-mini" data-dp-pa4-mini="lage"></div>' + kuerzen(o.lage) : o.lage);
    if (bestand) {
      add('steuer', 'Steuer', o.steuer);
      add('risk', 'Risiken &amp; Szenarien', o.risiko);
      add('unterlagen', 'Unterlagen &amp; WEG', unterlagenPanel(o.unterlagen));
      add('anschluss', 'Anschluss &amp; Exit', kuerzen(o.anschlussExit));
    } else {
      add('risk', 'Risiken &amp; Szenarien', o.risiko);
      add('verh', 'Kaufpreis &amp; Offerte', kuerzen(o.verhandlung));
      add('bank', 'Finanzierung &amp; Bank', kuerzen(o.bank));
      add('steuer', 'Steuer', o.steuer);
      add('unterlagen', 'Unterlagen &amp; WEG', unterlagenPanel(o.unterlagen));
    }
    var phase = bestand ? 'Bestand' : 'Ankauf', info = '';
    try {
      var AK = window.DealPilotAnkauf, st = AK && AK.stand ? AK.stand() : null;
      if (bestand && st && st.stichtag) info = 'Ankauf-Stand vom ' + String(st.stichtag).split('-').reverse().join('.') + ' · Fragen und Reiter für das Halten';
      else info = bestand ? 'Fragen und Reiter für das Halten' : 'Fragen und Reiter für die Kaufentscheidung';
    } catch (e) {}
    var kopf = '<div class="dp-pa4-kopf"><div class="dp-pa4-reihe"><span class="dp-pa4-phase">' + phase + '</span><span class="dp-pa4-info">' + esc(info) + '</span></div>'
      + '<div class="dp-pa4-reihe"><button type="button" class="btn-clean dp-pa4-pdf" data-dp-pa4-pdf="1" aria-controls="ai-pdf-sections">PDF zusammenstellen</button>'
      + '<div class="dp-pa4-seg" role="group" aria-label="Darstellung"><button type="button" class="btn-clean" data-dp-pa-modus-knopf="einfach" aria-pressed="' + (m === 'einfach') + '">Einfach</button>'
      + '<button type="button" class="btn-clean" data-dp-pa-modus-knopf="detail" aria-pressed="' + (m === 'detail') + '">Detail</button></div></div></div>';
    try { localStorage.setItem('dp_pa_si_ansicht', m === 'detail' ? 'genau' : 'einfach'); } catch (e) {}
    try { setTimeout(function () { minisZeichnen(); if (window.DpWertZielbild && window.DpWertZielbild.laden) window.DpWertZielbild.laden().then(function () { kzNeu(); minisZeichnen(); }, function () {}); }, 0); } catch (e) {}
    return '<div class="dp-pa-wrap' + (bestand ? ' dp-pa-bestand' : '') + '" data-dp-pa-v4="1" data-dp-pa-modus="' + m + '" data-dp-pa-ansicht="' + (bestand ? 'bestand' : 'ankauf') + '">'
      + (o.kopf || '')
      /* v3099e · Marcel: „Pilot-Analyse starten“ oben drüber gefällt nicht - als „Neu abrufen“ unter den Stand */
      + '<div class="dp-pa4-neu"><button type="button" class="btn-clean" onclick="if(typeof runAI===\'function\')runAI()">↻ Analyse neu abrufen</button><span>beschreibt den heutigen Stand dieses Objekts</span></div>'
      + kopf
      + '<div class="dp-pa4-modus-zeile"><b class="dp-pa-e">Kurzfassung</b><span class="dp-pa-e">Das Wichtigste mit kleinen Grafiken – „Detail“ zeigt alle Zahlen und Texte.</span>'
      + '<b class="dp-pa-d">Ausführlich</b><span class="dp-pa-d">Alle Zahlen, Tafeln und Texte der Analyse – „Einfach“ zeigt die Kurzfassung.</span></div>'
      + '<nav class="dp-pa-rail">' + reiter.join('') + '</nav>'
      + '<div class="dp-pa-content">' + inhalt.join('') + '</div></div>';
  }

  /* Klicks: Modus, „Ausführlich lesen", PDF (eine Stelle für alle Hüllen) */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var k = t.closest('[data-dp-pa-modus-knopf]') || t.closest('[data-dp-pa-modus-setzen]');
    if (k && k.closest('.dp-pa-wrap[data-dp-pa-v4]')) { ev.preventDefault(); setzeModus(k.getAttribute('data-dp-pa-modus-knopf') || k.getAttribute('data-dp-pa-modus-setzen')); return; }
    /* v3099g · „Alle Zahlen zeigen (Genau)" in Ankauf · Bestand · Zielbild (wert-zielbild.js) schaltet den ganzen Reiter */
    var sk = t.closest('[data-dp-si-knopf]');
    if (sk && sk.closest('.dp-pa-wrap[data-dp-pa-v4]')) { var mm = sk.getAttribute('data-dp-si-knopf') === 'genau' ? 'detail' : 'einfach'; setTimeout(function () { setzeModus(mm); }, 0); }
    var p = t.closest('[data-dp-pa4-pdf]');
    if (p) {
      ev.preventDefault();
      var ab = document.querySelector('#s5 .ai-box'), d = document.querySelector('.ai-pdf-details');
      var offen = ab ? ab.classList.toggle('dp-pa4-pdf-offen') : true;
      p.setAttribute('aria-expanded', String(offen));
      if (offen && d) { d.open = true; var box = d.closest('.ai-pdf-toggle') || d; try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { box.scrollIntoView(); } }
    }
  });

  window.DpPilotV4 = { VERSION: 'v3099', huelle: huelle, uebersicht: uebersicht, risiko: risiko, steuer: steuer, gesamtstatement: gesamtstatement,
    wertverlauf: wertverlauf, indexVerlauf: indexVerlauf, linien: linien, modus: modus, setzeModus: setzeModus, neuZeichnen: neuZeichnen, saetze: saetze, steuerTabelle: steuerTabelle };
})();
