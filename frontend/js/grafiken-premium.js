/* ═══════════════════════════════════════════════════════════════════════════
   v4160 · PILOT-ANALYSE IM PREMIUM-STIL (Vorschau-Funktion „grafiken_neu“)

   Marcel 23.11.2026: „Ich hätte das gerne schon in der Pilotanalyse, die ganzen
   Grafiken … komplett mit den Tabs, mit allen Reitern, wo wir zusätzlich noch
   diesen Score und Fingerabdruck haben … in den DealPilot-Farben.“ Besonders:
   Heatmap Anschlusszins × Miete („total cool“), die Einordnung, der Verlauf und
   der Fahrplan. Vorlage: Dateien/Demos/pilot-analyse-premium-2026-11-23.html.

   Baut auf grafiken-neu.js (v4140) auf: dieselbe Vorschau-Sperre, dieselbe
   Platz-/Zeichen-Logik (DpGrafikenNeu._h). Ohne Freigabe passiert hier nichts.

   Wo was steht (nur mit Freigabe):
     Übersicht              Fahrplan mit Meilensteinen (v4310: sonst nur Texte)
     Ankauf·Bestand·Zielbild Einordnung mit Ankauf-Marke, Score-Fingerabdruck, Zielerreichung (v4310)
     Steuer (v4310)          dazu Wohin die Miete geht
     Wert & Lage            Vermögen in 500 Zukünften (Monte-Carlo-Fächer)
     Steuer                 Verlauf mit Steuern (Cashflow vor und nach Steuer)
     Haus & Unterlagen      Hausgeld je Jahr (nur mit Hausverlauf)
     Potenzial & Exit       Heatmap Anschlusszins × Miete, Hebel-Diagramm, Rendite je Verkaufsjahr

   Rechnet KEINEN Kern nach. Gelesen wird State.cfRows (Projektion der App),
   State.kpis, DealScore.compute(), DpMieteMax, DealPilotDashboard.portfolioPayload(),
   DealPilotInvestmentProfile. Die Modellrechnungen (Szenarien, Monte-Carlo,
   IRR, Hebel, Heatmap) sind eigene, benannte Hilfen in MODELL: innerhalb der
   App-Jahre rechnen sie nur die ABWEICHUNG zur App (Basisfall = App, Prüfer
   tools/grafiken-neu-pruefen.mjs), danach mit den Raten der App weiter.
   Jede Modellgrafik trägt die Marke „Modell“ und ihre Annahmen.

   Öffentlich (für andere Reiter, z. B. Bewertung): window.DpGrafiken
     .heatmap(host, {zeilen, spalten, werte, basis:{z,s}, zeilenText, spaltenText, zelleText}, opt)
     .bullets(host, [{name, wert, ziel, zielText, port, ankauf, lo, hi, fmt, hoch}], opt)
     .verlauf(host, {x, reihen:[{name, werte, farbe, dick, gestrichelt}], band:{lo, hi}, heute, marken}, opt)
     .fahrplan(host, {von, bis, heute, linie:[{j, v}], linieText, marken:[{j, n, d, art}]}, opt)
     .karte(host, {eyebrow, titel, unter, chips, fuss})  → Element für den Inhalt
   Alle zeichnen in das übergebene Element (Breite = clientWidth) und geben es zurück.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpGrafikenPremium) return;

  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function zahl(v) { return v != null && v !== '' && isFinite(Number(v)) ? Number(v) : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(v) { return v == null || !isFinite(v) ? 'keine Angabe' : (v < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function eurV(v) { return v == null || !isFinite(v) ? 'keine Angabe' : (v > 0.5 ? '+' : v < -0.5 ? '−' : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function tsd(v) { return v == null ? '' : (v < 0 ? '−' : '') + (Math.abs(v) >= 1e6 ? nf2.format(Math.abs(v) / 1e6) + ' Mio €' : nf0.format(Math.abs(Math.round(v / 1000))) + ' T€'); }
  function pct(v, d) { return v == null || !isFinite(v) ? 'keine Angabe' : (v < 0 ? '−' : '') + (d === 2 ? nf2 : nf1).format(Math.abs(v)) + ' %'; }
  function f1(v) { return Math.round(v * 10) / 10; }
  function heuteJahr() { return new Date().getFullYear(); }
  function wert(id) { var e = document.getElementById(id); if (!e) return null; var s = String(e.value || '').trim(); if (!s) return null; if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); return zahl(s); }
  function ticks(min, max, n) {
    if (min === max) max = min + 1;
    var roh = (max - min) / (n || 4), p = Math.pow(10, Math.floor(Math.log10(roh))), q = roh / p;
    var st = (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * p, a = Math.floor(min / st) * st, b = Math.ceil(max / st) * st, out = [];
    for (var t = a; t <= b + st / 2; t += st) out.push(Math.round(t * 1e6) / 1e6);
    return out;
  }
  function kurz(v) { var a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e6) return s + nf1.format(a / 1e6) + ' Mio'; if (a >= 1e4) return s + nf0.format(Math.round(a / 1000)) + ' T'; return s + nf0.format(Math.round(a)); }
  function reduziert() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  /* Farben auf der dunklen Premium-Karte. Gold nur über Whitelabel-Token (style, nie Attribut), Status fest. */
  /* v4160 · Marcel: „farblich besser an DealPilot angleichen … kein Fremdblau“. Gemessen an der App (getComputedStyle 23.11.2026):
     Kopfleiste Obsidian #0E0D0B mit Creme #E9E3D6, Trennlinie #26231E, Kennzahl-Karte #FBF6E9 mit Rand #EAD9B0, Gold #C9A84C,
     Goldgrund #FAF5E8. Abstufungen nur aus Gold und Creme (color-mix), Grün und Rot nur für gut und schlecht. */
  /* v4250 · Marcel 23.11.2026: „die Grafiken einmal in hell darstellen, jetzt sind die alle dunkel“. Die Farben sind jetzt
     Theme-Variablen (--gx-*), gesetzt in stil(): hell als Standard (wie die Karten im Reiter Bewertung: weiß, Gold-Etikett,
     Obsidian-Text), dunkel per html[data-gx-stil="dunkel"]. Gold weiter nur über Whitelabel-Token, Grün und Rot fest. */
  var F = { tinte: 'var(--gx-tinte)', tinte2: 'var(--gx-tinte2)', tinte3: 'var(--gx-tinte3)', linie: 'var(--gx-linie)', linie2: 'var(--gx-linie2)', flaeche: 'var(--gx-flaeche)', karte: 'var(--gx-karte)',
    gold: 'var(--wl-c9a84c,#C9A84C)', goldH: 'var(--wl-e8cc7a,#E8CC7A)', goldD: 'var(--wl-b8932f,#b8932f)',
    gruen: '#3FA56C', rot: '#B8625C', neutral: 'var(--gx-neutral)', gruenW: 'var(--gx-gruen-w)', rotW: 'var(--gx-rot-w)',
    creme: 'var(--gx-kontrast)', gold2: 'color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 55%,var(--gx-karte))', gold3: 'color-mix(in srgb,var(--wl-b8932f,#b8932f) 60%,#0E0D0B)' };
  F.blau = F.creme; F.violett = F.gold3;

  /* ── Stil ──────────────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dp-gx-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-gx-stil';
    s.textContent = [
      /* v4250 · Theme: hell Standard, dunkel per html[data-gx-stil=dunkel] (Einstellungen › Anzeige-Optionen › Grafiken) */
      /* v4280 · Marcel 23.11.2026: alle Grafiken im Farbschema der Karten im Reiter Bewertung (Einordnung, Schuldendienstdeckung,
         Beleihung). Gemessen dort (getComputedStyle): Karte --surface #F8F6F1, Text #2A2727, Netz und Rand #2A2727 10 %, Achsen und
         Untertitel #2A2727 62 %, kein Schatten, Radius 14, Innenabstand 18/20/16, Titel Space Grotesk 600 18 px, Kopfzahl Space
         Grotesk 600 28 px, Achsen JetBrains Mono 11 px. Grün #3FA56C und Rot #B8625C, Flächen davon 30 % (Bänder) bzw. 7 % (Zonen).
         EINE Quelle für alle: diese Variablen (DpGrafiken.farben), grafiken-bewertung.js und grafiken-portfolio.js lesen dieselben. */
      '.dp-gx,.dp-pa-wrap .dp-gn.dp-gn-karte,.dp-gb,.dp-gp{--gx-bg:var(--surface,#F8F6F1);--gx-karte:var(--surface,#F8F6F1);--gx-tinte:#2A2727;--gx-tinte2:color-mix(in srgb,#2A2727 62%,transparent);--gx-tinte3:color-mix(in srgb,#2A2727 50%,transparent);--gx-linie:color-mix(in srgb,#2A2727 10%,transparent);--gx-linie2:color-mix(in srgb,#2A2727 16%,transparent);--gx-flaeche:color-mix(in srgb,#2A2727 5%,transparent);--gx-neutral:color-mix(in srgb,#2A2727 7%,transparent);--gx-kontrast:#2A2727;--gx-rand:color-mix(in srgb,#2A2727 10%,transparent);--gx-schatten:none;--gx-tip-bg:#050505;--gx-tip-fg:#FDFCFA;--gx-gruen-w:color-mix(in srgb,#3FA56C 30%,transparent);--gx-rot-w:color-mix(in srgb,#B8625C 30%,transparent)}',
      'html[data-gx-stil="dunkel"] .dp-gx,html[data-gx-stil="dunkel"] .dp-pa-wrap .dp-gn.dp-gn-karte,html[data-gx-stil="dunkel"] .dp-gb,html[data-gx-stil="dunkel"] .dp-gp{--gx-bg:linear-gradient(180deg,#16140F,#0E0D0B);--gx-karte:#0E0D0B;--gx-tinte:#E9E3D6;--gx-tinte2:#B9B2A3;--gx-tinte3:#8A8374;--gx-linie:#26231E;--gx-linie2:#3A352D;--gx-flaeche:#1B1915;--gx-neutral:#6F685C;--gx-kontrast:#E9E3D6;--gx-rand:#26231E;--gx-schatten:0 1px 0 rgba(255,255,255,.03) inset,0 10px 30px rgba(5,5,5,.18);--gx-tip-bg:#F3EEE4;--gx-tip-fg:#0B0A09}',
      /* Premium-Karte: Obsidian, Creme-Schrift, Gold als Akzent. Gilt auch für die Karten aus v4140 in der Pilot-Analyse. */
      '.dp-pa-wrap .dp-gn.dp-gn-karte,.dp-pa-wrap .dp-gn.dp-gx,.dp-gx-frei.dp-gx,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-gn.dp-gn-karte,.dp-pa-wrap[data-dp-pa-v4] .dp-pa-content .dp-gn.dp-gx{background:var(--gx-bg)!important;color:' + F.tinte + '!important;border:1px solid var(--gx-rand)!important;border-radius:14px!important;padding:18px 20px 16px!important;box-shadow:var(--gx-schatten)!important;--gn-card:' + F.karte + ';--gn-grau:color-mix(in srgb,' + F.tinte + ' 28%,transparent);--gn-netz:color-mix(in srgb,' + F.tinte + ' 9%,transparent);--gn-tinte:' + F.tinte + ';--gn-leise:' + F.tinte2 + ';--gn-rot:' + F.rot + '}',
      '.dp-pa-wrap .dp-gn.dp-gn-karte .dp-gn-k-t,.dp-gx .gx-t{font:600 18px/1.25 "Space Grotesk",Inter,sans-serif!important;letter-spacing:-.01em;color:' + F.tinte + '!important;margin:4px 0 3px!important;text-wrap:balance}',
      '.dp-pa-wrap .dp-gn.dp-gn-karte .dp-gn-k-s,.dp-gx .gx-s{font:400 12.5px/1.45 Inter,sans-serif!important;color:' + F.tinte2 + '!important;margin:0 0 12px!important}',
      '.dp-pa-wrap .dp-gn.dp-gn-karte .gn-tip,.dp-gx .gx-tip{background:var(--gx-tip-bg)!important;color:var(--gx-tip-fg)!important}',
      '.dp-pa-wrap .dp-gn.dp-gn-karte .gn-tip .gn-tip-j{color:' + F.goldD + '!important}',
      '.dp-pa-wrap .dp-gn .dp-gn-seg{border:1px solid ' + F.linie2 + '!important;border-radius:9px!important;background:' + F.flaeche + '!important}',
      '.dp-pa-wrap .dp-gn .dp-gn-seg button{background:transparent!important;color:' + F.tinte2 + '!important;border:0!important;box-shadow:none!important;padding:7px 13px!important;border-radius:0!important;font:600 11.5px Inter,sans-serif!important;min-height:0!important;height:auto!important}',
      '.dp-pa-wrap .dp-gn .dp-gn-seg button[aria-pressed=true]{background:color-mix(in srgb,' + F.gold + ' 26%,transparent)!important;color:' + F.tinte + '!important}',
      '.dp-gx .gx-kopf{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      '.dp-gx .gx-eye{font:600 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:' + F.gold + '}',
      '.dp-gx .gx-chips{display:flex;gap:6px;flex-wrap:wrap}',
      '.dp-gx .gx-chip{font:500 10px/1 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;border:1px solid ' + F.linie2 + ';color:' + F.tinte2 + ';padding:5px 8px;border-radius:999px;white-space:nowrap}',
      '.dp-gx .gx-chip.modell{border-color:' + F.gold + ';color:' + F.gold + '}',
      '.dp-gx .gx-chip.bsp{border-color:' + F.violett + ';color:' + F.violett + '}',
      '.dp-gx .gx-fuss{font:400 11.5px/1.5 Inter,sans-serif;color:' + F.tinte3 + ';border-top:1px dashed ' + F.linie + ';padding-top:8px;margin-top:10px;display:flex;gap:4px 16px;flex-wrap:wrap}',
      '.dp-gx .gx-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 0 0;font:400 11.5px Inter,sans-serif;color:' + F.tinte2 + '}',
      '.dp-gx .gx-mb{display:flex;flex-direction:column;gap:8px;margin:4px 0 0}.dp-gx .gx-mb-z{display:grid;grid-template-columns:62px minmax(0,1fr);gap:10px;align-items:center}',
      '.dp-gx .gx-mb-l{display:flex;flex-direction:column;gap:2px}.dp-gx .gx-mb-l b{font:600 13px/1.1 "Space Grotesk",Inter,sans-serif;color:' + F.tinte + '}.dp-gx .gx-mb-l small{font:500 10.5px/1.1 "JetBrains Mono",monospace;color:' + F.tinte2 + '}'
      + '.dp-gx .gx-mb-seg{box-shadow:inset 0 0 0 1px color-mix(in srgb,' + F.tinte + ' 8%,transparent)}.dp-gx .gx-mb-bahn{display:flex;gap:2px;height:46px;border-radius:8px;overflow:hidden}',
      '.dp-gx .gx-mb-seg{min-width:3px;display:flex;flex-direction:column;justify-content:center;padding:0 9px;overflow:hidden;color:#FDFCFA;transform-origin:0 50%}',
      '.dp-gx .gx-mb-seg span{font:500 10.5px/1.2 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.92}.dp-gx .gx-mb-seg b{font:600 12px/1.2 "JetBrains Mono",monospace;white-space:nowrap}',
      '@media (max-width:640px){.dp-gx .gx-mb-z{grid-template-columns:minmax(0,1fr)}.dp-gx .gx-mb-l{flex-direction:row;gap:8px;align-items:baseline}.dp-gx .gx-mb-bahn{height:38px}.dp-gx .gx-mb-seg span{display:none}}',
      '.dp-gx .gx-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
      /* v4280 · Marcel: „Gesamtbewertung, Einordnung, Investmentbewertung, DealPilot Insight und was jetzt zu tun ist, passend formatiert
         wie der Rest“. Nur mit Vorschau (body.dp-gn-an): dieselbe Karte wie die Grafiken (Fläche, Rand 10 %, Radius 14, Abstände), Überschrift
         wie der Kartentitel, Unterpunkte als Etikett. Der Text selbst bleibt unverändert. */
      'body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei{gap:16px!important;margin:0 0 16px!important}',
      'body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei>div{background:var(--surface,#F8F6F1);border:1px solid color-mix(in srgb,#2A2727 10%,transparent);border-radius:14px;padding:18px 20px 16px;color:#2A2727}',
      'body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei .dp-pa5-ab{margin:0 0 8px!important}',
      'body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei .dp-pa5-ab h3{font:600 18px/1.25 "Space Grotesk",Inter,sans-serif!important;letter-spacing:-.01em;color:#2A2727!important}',
      'body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei .dp-pa4-a{border-left:0!important;padding:10px 0 0!important;border-top:1px solid color-mix(in srgb,#2A2727 10%,transparent)}',
      'body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei .dp-pa4-a h4{font:600 10.5px/1 "JetBrains Mono",ui-monospace,monospace!important;letter-spacing:.12em!important;text-transform:uppercase;color:var(--wl-b8932f,#b8932f)!important;margin:0 0 4px!important}',
      'body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei p,body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei li{font:400 13px/1.55 Inter,sans-serif;color:#2A2727}',
      'html[data-gx-stil="dunkel"] body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei p,html[data-gx-stil="dunkel"] body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei li,html[data-gx-stil="dunkel"] body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei .dp-pa5-ab h3{color:#E9E3D6!important}',
      'html[data-gx-stil="dunkel"] body.dp-gn-an #dp-pa-uebersicht .dp-pa5-zwei>div{background:linear-gradient(180deg,#16140F,#0E0D0B);border-color:#26231E;color:#E9E3D6}',
      /* v4280 · Einordnung wie im Reiter Bewertung */
      '.dp-gx .gx-bul{display:flex;flex-direction:column;gap:10px;margin:2px 0 0}.dp-gx .gx-bz{display:grid;grid-template-columns:minmax(120px,210px) minmax(0,1fr) 96px;gap:6px 14px;align-items:center}',
      '.dp-gx .gx-bz .n{font:600 13px/1.3 Inter,sans-serif;color:' + F.tinte + '}.dp-gx .gx-bz .n small{display:block;font:400 11px/1.3 Inter,sans-serif;color:' + F.tinte2 + '}',
      '.dp-gx .gx-bz .w{font:600 13px "JetBrains Mono",monospace;text-align:right}.dp-gx .gx-bz .w small{display:block;font:600 10.5px Inter,sans-serif;letter-spacing:.02em}',
      '.dp-gx .gx-bz .bahn{position:relative;height:18px;border-radius:4px;display:flex;gap:2px}.dp-gx .gx-bz .bahn i{display:block;height:100%;border-radius:3px}',
      '.dp-gx .gx-bz .mark{position:absolute;top:-3px;bottom:-3px;width:4px;margin-left:-2px;border-radius:2px;box-shadow:0 0 0 2px var(--gx-karte)}',
      '.dp-gx .gx-bz .ziel{position:absolute;top:2px;bottom:2px;width:2px;margin-left:-1px;background:' + F.gold + '}',
      '.dp-gx .gx-bz .ank{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid ' + F.tinte + ';background:var(--gx-karte)}',
      '.dp-gx .gx-bz .zb{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;transform:rotate(45deg);background:' + F.goldD + ';box-shadow:0 0 0 2px var(--gx-karte)}',
      '.dp-gx .gx-bz .port{position:absolute;bottom:-6px;width:0;height:0;margin-left:-5px;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:6px solid ' + F.tinte3 + '}',
      '@media (max-width:640px){.dp-gx .gx-bz{grid-template-columns:minmax(0,1fr) auto}.dp-gx .gx-bz .bahn{grid-column:1/-1;order:3}}',
      '.dp-gx svg{display:block;width:100%;height:auto;overflow:visible}',
      '.dp-gx .gx-ax{font:400 11px "JetBrains Mono",ui-monospace,monospace;fill:' + F.tinte3 + '}',
      '.dp-gx .gx-ax2{font:400 11.5px Inter,sans-serif;fill:' + F.tinte2 + '}',
      '.dp-gx .gx-w{font:600 11px "JetBrains Mono",monospace;fill:' + F.tinte + '}',
      '.dp-gx .gx-zahl{font:600 26px "Space Grotesk",Inter,sans-serif;letter-spacing:-.02em;fill:' + F.tinte + '}',
      '.dp-gx .gx-netz{stroke:' + F.linie + ';stroke-width:1}',
      '.dp-gx [data-gx-tip]{cursor:default}',
      '.dp-gx .gx-tip{position:absolute;pointer-events:none;z-index:6;font:500 12px/1.45 Inter,sans-serif;padding:8px 11px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:280px;display:none}',
      '.dp-gx .gx-tip b{font-family:"JetBrains Mono",monospace;font-weight:600}',
      '.dp-gx .gx-tip .t{font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:' + F.goldD + ';margin-bottom:3px}',
      '.dp-gx .gx-seite{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0 0}',
      '@media (max-width:700px){.dp-gx .gx-seite{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '.dp-gx .gx-seite>div{border:1px solid ' + F.linie + ';border-radius:10px;padding:10px 12px;min-width:0}',
      '.dp-gx .gx-seite span{display:block;font:500 9.5px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:' + F.tinte3 + '}',
      '.dp-gx .gx-seite b{display:block;font:600 24px/1.15 "Space Grotesk",Inter,sans-serif;letter-spacing:-.02em;color:' + F.tinte + ';margin:4px 0 2px}',
      '.dp-gx .gx-seite small{display:block;font:400 11px/1.35 Inter,sans-serif;color:' + F.tinte2 + '}',
      '.dp-gx-reihe{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px;margin:0 0 16px}',
      '.dp-gx-reihe>.dp-gx{margin:0!important}',
      '@media (max-width:900px){.dp-gx-reihe{grid-template-columns:minmax(0,1fr)}}',
      '.dp-gx{position:relative;margin:0 0 16px;min-width:0}',
      '.dp-pa-wrap .dp-gn.dp-gx:empty{padding:0!important;border:0!important;box-shadow:none!important;margin:0!important;min-height:0!important;background:none!important}',   /* leere Karte (keine Daten) nimmt keinen Platz, behält aber ihre Breite für das Neuzeichnen */
      '.dp-gx .gx-fade{animation:gxFade .6s ease-out both}',
      '.dp-gx .gx-zieh{stroke-dasharray:var(--gx-len);stroke-dashoffset:var(--gx-len);animation:gxZieh 1.2s ease-out .1s forwards}',
      '.dp-gx .gx-wx{transform-box:fill-box;animation:gxWx .7s cubic-bezier(.2,.7,.2,1) both}',
      '.dp-gx .gx-wy{transform-box:fill-box;transform-origin:50% 100%;animation:gxWy .7s cubic-bezier(.2,.7,.2,1) both}',
      '@keyframes gxFade{from{opacity:0}to{opacity:1}}',
      '@keyframes gxZieh{to{stroke-dashoffset:0}}',
      '@keyframes gxWx{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
      '@keyframes gxWy{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
      '.dp-gx.gx-still *{animation:none!important;stroke-dasharray:none!important}',
      '@media (prefers-reduced-motion:reduce){.dp-gx *{animation:none!important;stroke-dasharray:none!important}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── Karte und Tooltip ─────────────────────────────────────────────── */
  function karte(host, o) {
    o = o || {}; stil();
    if (!host.classList.contains('dp-gx')) host.classList.add('dp-gx');
    if (!host.closest('.dp-pa-wrap')) host.classList.add('dp-gx-frei');
    var chips = (o.chips || []).map(function (c) { return '<span class="gx-chip ' + (c === 'Modell' ? 'modell' : c === 'Beispiel' ? 'bsp' : '') + '">' + esc(c) + '</span>'; }).join('');
    host.innerHTML = '<div class="gx-kopf"><div class="gx-eye">' + esc(o.eyebrow || '') + '</div>' + (chips ? '<div class="gx-chips">' + chips + '</div>' : '') + '</div>'
      + '<div class="gx-t">' + esc(o.titel || '') + '</div>' + (o.unter ? '<div class="gx-s">' + esc(o.unter) + '</div>' : '')
      + '<div class="gx-inhalt"></div>' + (o.fuss && o.fuss.length ? '<div class="gx-fuss">' + o.fuss.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' : '');
    tipBinden(host);
    return host.querySelector('.gx-inhalt');
  }
  function breiteVon(el) {
    var w = el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 600;
    return Math.max(260, Math.round(w));
  }
  function tipBinden(k) {
    if (k._gxTip) return; k._gxTip = true;
    var tip = document.createElement('div'); tip.className = 'gx-tip'; k.appendChild(tip);
    k.addEventListener('mousemove', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-gx-tip]') : null;
      if (!t || !k.contains(t)) { tip.style.display = 'none'; return; }
      tip.innerHTML = t.getAttribute('data-gx-tip'); tip.style.display = 'block';
      var b = k.getBoundingClientRect(), w = tip.offsetWidth, x = ev.clientX - b.left + 14;
      if (x + w > b.width - 4) x = Math.max(4, ev.clientX - b.left - w - 14);
      tip.style.left = x + 'px'; tip.style.top = Math.max(4, ev.clientY - b.top - tip.offsetHeight - 10) + 'px';
    });
    k.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }
  function tipA(html) { return ' data-gx-tip="' + esc(html) + '"'; }
  function legende(L) { return '<div class="gx-leg">' + L.map(function (e) { return '<span><i style="background:' + e.f + (e.rand ? ';border:1px solid ' + F.linie2 : '') + '"></i>' + esc(e.n) + '</span>'; }).join('') + '</div>'; }
  function ziehen(root) { try { root.querySelectorAll('.gx-zieh').forEach(function (p) { p.style.setProperty('--gx-len', Math.ceil(p.getTotalLength ? p.getTotalLength() : 2000)); }); } catch (e) {} }
  function mix(c1, c2, t) { var h = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }; var a = h(c1), b = h(c2); return '#' + a.map(function (v, i) { return ('0' + Math.round(v + (b[i] - v) * t).toString(16)).slice(-2); }).join(''); }

  /* ══ ZEICHNER (öffentlich) ═════════════════════════════════════════ */

  /* Heatmap: zeilen × spalten, werte[zeile][spalte]; Farbe divergierend um 0 (Grün/Rot fest) */
  function heatmap(host, d, o) {
    o = o || {}; var W = o.breite || breiteVon(host);
    var Z = d.spalten, M = d.zeilen, G = d.werte, kompakt = !!o.kompakt;
    var lw = W < 420 ? 44 : 56, top = 24, cw = (W - lw - 4) / Z.length, ch = kompakt ? Math.max(22, Math.min(28, cw * 0.7)) : Math.max(26, Math.min(36, cw * 0.85)), H = top + M.length * ch + 30;
    var alle = []; G.forEach(function (r) { r.forEach(function (v) { if (v != null && isFinite(v)) alle.push(Math.abs(v)); }); });
    var maxAbs = Math.max.apply(null, alle.concat([1]));
    var farbe = function (v) { var t = Math.round(12 + Math.min(1, Math.abs(v) / maxAbs) * 78); return 'color-mix(in srgb,' + (v >= 0 ? F.gruen : F.rot) + ' ' + t + '%,transparent)'; };   /* v4280 · wie die Zinsrisiko-Heatmap im Reiter Bewertung */   /* v4250 · color-mix statt mix(): F sind jetzt var() */
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Heatmap') + '">'];
    out.push('<text class="gx-ax" x="' + lw + '" y="12">' + esc(d.spaltenTitel || '') + ' →</text>');
    var jede = cw < 34 ? 2 : 1;
    Z.forEach(function (z, c) { if (c % jede) return; out.push('<text class="gx-ax" x="' + f1(lw + c * cw + cw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(d.spaltenText ? d.spaltenText(z, cw) : z) + '</text>'); });
    M.forEach(function (m, r) {
      out.push('<text class="gx-ax" x="' + (lw - 8) + '" y="' + f1(top + r * ch + ch / 2 + 4) + '" text-anchor="end">' + esc(d.zeilenText ? d.zeilenText(m) : m) + '</text>');
      Z.forEach(function (z, c) {
        var v = G[r][c]; if (v == null) return;
        out.push('<rect class="gx-fade" x="' + f1(lw + c * cw + 1) + '" y="' + f1(top + r * ch + 1) + '" width="' + f1(cw - 2) + '" height="' + f1(ch - 2) + '" rx="3" style="fill:' + farbe(v) + ';animation-delay:' + ((r * Z.length + c) * 5) + 'ms"' + tipA(d.zelleText ? d.zelleText(m, z, v) : String(v)) + '/>');
        if (cw >= 40 && !kompakt) out.push('<text x="' + f1(lw + c * cw + cw / 2) + '" y="' + f1(top + r * ch + ch / 2 + 4) + '" text-anchor="middle" style="font:500 10.5px JetBrains Mono,monospace;pointer-events:none;fill:' + (Math.abs(v) / maxAbs > 0.55 ? '#FFFFFF' : F.tinte2) + '">' + nf0.format(Math.round(v)) + '</text>');
      });
    });
    if (d.basis) { var bz = d.basis.s, br = d.basis.z; if (bz >= 0 && br >= 0) out.push('<rect x="' + f1(lw + bz * cw) + '" y="' + f1(top + br * ch) + '" width="' + f1(cw) + '" height="' + f1(ch) + '" rx="4" style="fill:none;stroke:' + F.gold + ';stroke-width:2.2"/>'); }
    out.push('</svg>');
    host.innerHTML = out.join('') + legende([{ n: eurV(-maxAbs) + (d.einheit || ''), f: F.rot }, { n: '0 €', f: F.flaeche, rand: true }, { n: eurV(maxAbs) + (d.einheit || ''), f: F.gruen }, { n: 'Rahmen: dein Basisfall', f: 'transparent', rand: true }]);
    return host;
  }

  /* Bullets: je Kennzahl Balken, Strich = Ziel/Schwelle, Raute = Portfolio, Kreis = Ankauf */
  /* v4280 · Einordnung im Stil der Karte „Einordnung“ im Reiter Bewertung (grafiken-bewertung.js bullet): je Kennzahl eine Bahn mit
     blassen Bändern (rot unter, grün über der Schwelle), dunkle Marke = Wert heute, goldener Strich = Schwelle, Kreis = Ankauf,
     Raute gold = Zielbild, Dreieck = Portfolio-Schnitt. Rechts Wert und Wort. Marcel: „gleiches Farbschema wie Einordnung“. */
  function bullets(host, B, o) {
    o = o || {};
    var zeilen = B.map(function (b, i) {
      var span = b.hi - b.lo, pos = function (v) { return Math.max(0, Math.min(100, (v - b.lo) / span * 100)); };
      var gut = b.ziel == null ? null : (b.hoch ? b.wert >= b.ziel : b.wert <= b.ziel);
      var fc = gut == null ? F.tinte : (gut ? F.gruen : F.rot), wort = gut == null ? '' : (gut ? '✓ erfüllt' : '✕ unter Schwelle');
      if (gut === false && !b.hoch) wort = '✕ über Schwelle';
      if (b.farbe) fc = b.farbe; if (b.wort != null) wort = b.wort;   /* v4310 · Zielerreichung: eigene Farbe und eigenes Wort je Zeile */
      var baender = b.ziel == null ? '<i style="width:100%;background:' + F.neutral + '"></i>'
        : (b.hoch ? '<i style="width:' + pos(b.ziel).toFixed(2) + '%;background:' + F.rotW + '"></i><i style="width:' + (100 - pos(b.ziel)).toFixed(2) + '%;background:' + F.gruenW + '"></i>'
          : '<i style="width:' + pos(b.ziel).toFixed(2) + '%;background:' + F.gruenW + '"></i><i style="width:' + (100 - pos(b.ziel)).toFixed(2) + '%;background:' + F.rotW + '"></i>');
      var tip = '<div class="t">' + esc(b.name) + '</div>' + (o.objektWort || 'heute') + ' <b>' + esc(b.fmt(b.wert)) + '</b>' + (b.ankauf != null ? '<br>beim Ankauf <b>' + esc(b.fmt(b.ankauf)) + '</b>' : '') + (b.zielbild != null ? '<br>im Zielbild <b>' + esc(b.fmt(b.zielbild)) + '</b>' : '') + (b.ziel != null ? '<br>' + esc(b.zielText || 'Schwelle') + ' <b>' + esc(b.fmt(b.ziel)) + '</b>' : '') + (b.port != null ? '<br>Portfolio-Schnitt <b>' + esc(b.fmt(b.port)) + '</b>' : '');
      var unter = [b.ankauf != null ? 'Ankauf ' + b.fmt(b.ankauf) : '', b.zielbild != null ? 'Zielbild ' + b.fmt(b.zielbild) : '', b.ziel != null ? (b.zielText || 'Schwelle') + ' ' + b.fmt(b.ziel) : '', b.port != null ? 'Portfolio ' + b.fmt(b.port) : '', b.notiz || ''].filter(Boolean).join(' · ');
      return '<div class="gx-bz"><div class="n">' + esc(b.name) + (unter ? '<small>' + esc(unter) + '</small>' : '') + '</div>'
        + '<div class="bahn"' + tipA(tip) + '>' + baender
        + (b.ziel != null ? '<span class="ziel" style="left:' + pos(b.ziel).toFixed(2) + '%"></span>' : '')
        + (b.port != null ? '<span class="port" style="left:' + pos(b.port).toFixed(2) + '%"></span>' : '')
        + (b.ankauf != null ? '<span class="ank" style="left:' + pos(b.ankauf).toFixed(2) + '%"></span>' : '')
        + (b.zielbild != null ? '<span class="zb" style="left:' + pos(b.zielbild).toFixed(2) + '%"></span>' : '')
        + '<span class="mark gx-fade" style="left:' + pos(b.wert).toFixed(2) + '%;background:' + fc + ';animation-delay:' + (i * 90) + 'ms"></span></div>'
        + '<div class="w" style="color:' + fc + '">' + esc(b.fmt(b.wert)) + (wort ? '<small>' + wort + '</small>' : '') + '</div></div>';
    });
    var leg = [{ n: o.objektWort || 'heute', f: F.tinte }, { n: o.zielName || 'deine Schwelle', f: F.gold }];
    if (B.some(function (b) { return b.ankauf != null; })) leg.push({ n: 'beim Ankauf', f: 'transparent', rand: true });
    if (B.some(function (b) { return b.zielbild != null; })) leg.push({ n: 'im Zielbild', f: F.goldD });
    if (B.some(function (b) { return b.port != null; })) leg.push({ n: 'Portfolio-Schnitt', f: F.tinte3 });
    host.innerHTML = '<div class="gx-bul">' + zeilen.join('') + '</div>' + legende(leg);
    return host;
  }

  /* Verlauf: Linien mit optionalem Band (lo/hi), Heute-Linie, Marken */
  function verlauf(host, d, o) {
    o = o || {}; var W = o.breite || breiteVon(host), H = o.hoehe || Math.round(Math.min(330, Math.max(210, W * 0.4))), m = { l: 56, r: 14, t: 16, b: 26 };
    var X = d.x, n = X.length; if (n < 2) { host.innerHTML = ''; return host; }
    var alle = []; d.reihen.forEach(function (r) { r.werte.forEach(function (v) { if (v != null && isFinite(v)) alle.push(v); }); });
    var BAENDER = d.baender || (d.band ? [d.band] : []);   /* v4310 · mehrere Bänder, je mit eigener Farbe (band.farbe) */
    BAENDER.forEach(function (bd) { bd.lo.concat(bd.hi).forEach(function (v) { if (v != null && isFinite(v)) alle.push(v); }); });
    (d.streu || []).forEach(function (q) { if (q.v != null && isFinite(q.v)) alle.push(q.v); });
    var tk = ticks(Math.min(0, Math.min.apply(null, alle)), Math.max(0, Math.max.apply(null, alle)), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    var xs = function (j) { return m.l + (j - X[0]) / (X[n - 1] - X[0]) * (W - m.l - m.r); }, ys = function (v) { return m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b); };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Verlauf') + '">'];
    tk.forEach(function (v) { out.push('<line class="gx-netz" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(ys(v)) + '" y2="' + f1(ys(v)) + '"/><text class="gx-ax" x="' + (m.l - 8) + '" y="' + f1(ys(v) + 4) + '" text-anchor="end">' + kurz(v) + '</text>'); });
    if (y0 < 0) out.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(ys(0)) + '" y2="' + f1(ys(0)) + '" style="stroke:' + F.linie2 + ';stroke-width:1.2"/>');
    var schritt = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - m.l - m.r) / 52))));
    X.forEach(function (j, i) { if (i % schritt === 0 || (i === n - 1 && (n - 1) % schritt >= schritt / 2)) out.push('<text class="gx-ax" x="' + f1(xs(j)) + '" y="' + (H - 6) + '" text-anchor="middle"' + (j === d.heute ? ' style="fill:' + F.goldH + '"' : '') + '>' + j + '</text>'); });
    BAENDER.forEach(function (bd) {
      var pts = X.map(function (j, i) { return bd.hi[i] == null ? null : f1(xs(j)) + ',' + f1(ys(bd.hi[i])); }).filter(Boolean)
        .concat(X.slice().reverse().map(function (j, k) { var i = n - 1 - k; return bd.lo[i] == null ? null : f1(xs(j)) + ',' + f1(ys(bd.lo[i])); }).filter(Boolean));
      if (pts.length < 4) return;
      out.push('<polygon class="gx-fade" points="' + pts.join(' ') + '" style="fill:' + (bd.farbe || 'color-mix(in srgb,' + F.gold + ' 15%,transparent)') + '"/>');
      if (!bd.ohneRand) [bd.lo, bd.hi].forEach(function (a) { out.push('<polyline points="' + X.map(function (j, i) { return a[i] == null ? '' : f1(xs(j)) + ',' + f1(ys(a[i])); }).filter(Boolean).join(' ') + '" style="fill:none;stroke:' + F.gold + ';stroke-width:1;stroke-dasharray:3 4;opacity:.7"/>'); });
    });
    if (d.heute != null && d.heute >= X[0] && d.heute <= X[n - 1]) out.push('<line x1="' + f1(xs(d.heute)) + '" x2="' + f1(xs(d.heute)) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" style="stroke:' + F.linie2 + ';stroke-dasharray:2 3"/><text class="gx-ax" x="' + f1(xs(d.heute) + 6) + '" y="' + (m.t + 10) + '" style="fill:' + F.tinte2 + '">HEUTE</text>');
    d.reihen.forEach(function (r) {
      var p = ''; r.werte.forEach(function (v, i) { if (v == null || !isFinite(v)) return; p += (p ? ' L' : 'M') + f1(xs(X[i])) + ',' + f1(ys(v)); });
      out.push('<path class="' + (r.gestrichelt ? '' : 'gx-zieh') + '" d="' + p + '" style="fill:none;stroke:' + r.farbe + ';stroke-width:' + (r.dick || 2.2) + ';stroke-linejoin:round;stroke-linecap:round' + (r.gestrichelt ? ';stroke-dasharray:5 4' : '') + '"/>');
      if (r.punkte) r.werte.forEach(function (v, i) { if (v == null) return; out.push('<circle cx="' + f1(xs(X[i])) + '" cy="' + f1(ys(v)) + '" r="3.5" style="fill:' + r.farbe + ';stroke:' + F.karte + ';stroke-width:2"/>'); });
    });
    (d.streu || []).forEach(function (q) { if (q.v == null || q.j < X[0] || q.j > X[n - 1]) return; var form = q.raute ? '<path d="M' + f1(xs(q.j)) + ',' + f1(ys(q.v) - 7) + ' L' + f1(xs(q.j) + 7) + ',' + f1(ys(q.v)) + ' L' + f1(xs(q.j)) + ',' + f1(ys(q.v) + 7) + ' L' + f1(xs(q.j) - 7) + ',' + f1(ys(q.v)) + ' Z"' : '<circle cx="' + f1(xs(q.j)) + '" cy="' + f1(ys(q.v)) + '" r="' + (q.r || 6) + '"';
      out.push(form + ' class="gx-fade" style="' + (q.hohl ? 'fill:' + F.karte + ';stroke:' + (q.farbe || F.gold) + ';stroke-width:2' : 'fill:' + (q.farbe || F.gold) + ';stroke:' + F.karte + ';stroke-width:2') + '"/>'); });
    (d.marken || []).forEach(function (mk) { if (mk.j < X[0] || mk.j > X[n - 1]) return; var x = xs(mk.j); out.push('<line x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" style="stroke:' + (mk.farbe || F.gold) + ';stroke-dasharray:3 3;opacity:.8"/><text class="gx-ax" x="' + f1(Math.min(x + 5, W - m.r - 4)) + '" y="' + (m.t + 22 + (mk.zeile || 0) * 14) + '" text-anchor="' + (x > W - 140 ? 'end' : 'start') + '" style="fill:' + (mk.farbe || F.goldH) + '">' + esc(mk.text) + '</text>'); });
    /* Treffer je Jahr */
    var dx = (W - m.l - m.r) / Math.max(1, n - 1);
    X.forEach(function (j, i) { if (!d.tip) return; out.push('<rect x="' + f1(xs(j) - dx / 2) + '" y="' + m.t + '" width="' + f1(dx) + '" height="' + (H - m.t - m.b) + '" style="fill:transparent"' + tipA(d.tip(i, j)) + '/>'); });
    (d.streu || []).forEach(function (q) { if (q.v == null || !q.tip || q.j < X[0] || q.j > X[n - 1]) return; out.push('<circle cx="' + f1(xs(q.j)) + '" cy="' + f1(ys(q.v)) + '" r="12" style="fill:transparent"' + tipA(q.tip) + '/>'); });
    out.push('</svg>');
    host.innerHTML = out.join('') + (d.legende ? legende(d.legende) : '');
    ziehen(host);
    return host;
  }

  /* Fahrplan: Beleihung oben als Fläche, darunter Zeitachse mit Meilensteinen */
  function fahrplan(host, d, o) {
    o = o || {}; var W = o.breite || breiteVon(host), schmal = W < 640, m = { l: 16, r: 16 };
    var x = function (j) { return m.l + (j - d.von) / (d.bis + 1 - d.von) * (W - m.l - m.r); };
    var yT = 10, hT = 70, y = function (v) { return yT + (1 - Math.max(0, Math.min(110, v)) / 110) * hT; };
    var out = [], yA = yT + hT + 28;
    if (d.linie && d.linie.length > 1) {
      var pts = d.linie.map(function (p) { return [x(p.j + 0.5), y(p.v)]; });
      out.push('<path class="gx-fade" d="M' + pts.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' L') + ' L' + f1(pts[pts.length - 1][0]) + ',' + (yT + hT) + ' L' + f1(pts[0][0]) + ',' + (yT + hT) + ' Z" style="fill:color-mix(in srgb,' + F.gold + ' 14%,transparent)"/>');
      out.push('<path class="gx-zieh" d="M' + pts.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' L') + '" style="fill:none;stroke:' + F.gold + ';stroke-width:2"/>');
      [100, 60].forEach(function (v) { out.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(y(v)) + '" y2="' + f1(y(v)) + '" style="stroke:' + F.linie2 + ';stroke-dasharray:2 4"/><text class="gx-ax" x="' + (W - m.r) + '" y="' + f1(y(v) - 3) + '" text-anchor="end">' + esc((d.linieText || 'LTV') + ' ' + v + ' %') + '</text>'); });
      var dxl = (W - m.l - m.r) / (d.bis + 1 - d.von);
      d.linie.forEach(function (p) { if (p.tip) out.push('<rect x="' + f1(x(p.j)) + '" y="' + yT + '" width="' + f1(dxl) + '" height="' + hT + '" style="fill:transparent"' + tipA(p.tip) + '/>'); });
    }
    out.push('<line x1="' + f1(x(d.von)) + '" x2="' + f1(x(d.bis + 1)) + '" y1="' + yA + '" y2="' + yA + '" style="stroke:' + F.linie2 + ';stroke-width:2"/>');
    if (d.heute != null) out.push('<line x1="' + f1(x(d.von)) + '" x2="' + f1(x(d.heute + 0.9)) + '" y1="' + yA + '" y2="' + yA + '" style="stroke:' + F.tinte + ';stroke-width:2"/>');
    var tj = []; for (var j = d.von; j <= d.bis; j++) if ((j - d.von) % (schmal ? 10 : 5) === 0 || j === d.bis) tj.push(j);
    tj.forEach(function (j) { out.push('<line x1="' + f1(x(j)) + '" x2="' + f1(x(j)) + '" y1="' + (yA - 4) + '" y2="' + (yA + 4) + '" style="stroke:' + F.tinte3 + '"/><text class="gx-ax" x="' + f1(x(j)) + '" y="' + (yA - 8) + '" text-anchor="middle">' + j + '</text>'); });
    if (d.heute != null) out.push('<circle cx="' + f1(x(d.heute + 0.9)) + '" cy="' + yA + '" r="5" style="fill:' + F.karte + ';stroke:' + F.gold + ';stroke-width:2"/>');
    var farbe = { gem: F.tinte, info: F.tinte3, gut: F.gruen, risiko: F.rot };
    var M = (d.marken || []).filter(function (mk) { return mk.j != null; }).sort(function (a, b) { return a.j - b.j; });
    var jt = function (mk) { return mk.jahrText || (mk.j > d.bis + 0.5 ? 'nach ' + d.bis : String(Math.floor(mk.j))); };
    var H;
    if (schmal) {
      M.forEach(function (mk, i) {
        var xx = Math.min(x(d.bis + 1), x(mk.j)); out.push('<circle cx="' + f1(xx) + '" cy="' + yA + '" r="4" style="fill:' + farbe[mk.art] + ';stroke:' + F.karte + ';stroke-width:2"/>');
        var yy = yA + 30 + i * 24;
        out.push('<g class="gx-fade" style="animation-delay:' + (150 + i * 70) + 'ms"><circle cx="' + (m.l + 5) + '" cy="' + (yy - 4) + '" r="4" style="fill:' + farbe[mk.art] + '"/><text class="gx-ax" x="' + (m.l + 16) + '" y="' + yy + '" style="fill:' + F.tinte2 + '">' + esc(jt(mk)) + '</text><text x="' + (m.l + 62) + '" y="' + yy + '" style="font:600 12px Inter,sans-serif;fill:' + F.tinte + '">' + esc(mk.n) + '</text><rect x="' + m.l + '" y="' + (yy - 14) + '" width="' + (W - m.l - m.r) + '" height="22" style="fill:transparent"' + tipA('<div class="t">' + esc(mk.n) + '</div>' + esc(mk.d || '')) + '/></g>');
      });
      H = yA + 30 + M.length * 24;
    } else {
      var slot = (W - m.l - m.r) / Math.max(1, M.length);
      M.forEach(function (mk, i) {
        var xx = Math.min(x(d.bis + 1) - 2, x(mk.j)), sx = m.l + slot * (i + 0.5), row = i % 2, yy = yA + 48 + row * 46;
        out.push('<g class="gx-fade" style="animation-delay:' + (200 + i * 100) + 'ms"><path d="M' + f1(xx) + ',' + yA + ' L' + f1(xx) + ',' + (yA + 14 + row * 8) + ' L' + f1(sx) + ',' + (yy - 20) + ' L' + f1(sx) + ',' + (yy - 14) + '" style="fill:none;stroke:' + farbe[mk.art] + ';stroke-width:1;opacity:.55"/>'
          + '<circle cx="' + f1(xx) + '" cy="' + yA + '" r="4.5" style="fill:' + farbe[mk.art] + ';stroke:' + F.karte + ';stroke-width:2"/>'
          + '<text class="gx-ax" x="' + f1(sx) + '" y="' + (yy - 2) + '" text-anchor="middle" style="fill:' + farbe[mk.art] + '">' + esc(jt(mk)) + '</text>'
          + '<text x="' + f1(sx) + '" y="' + (yy + 13) + '" text-anchor="middle" style="font:600 11.5px Inter,sans-serif;fill:' + F.tinte + '">' + esc(mk.n) + '</text>'
          + '<rect x="' + f1(sx - slot / 2) + '" y="' + (yy - 14) + '" width="' + f1(slot) + '" height="34" style="fill:transparent"' + tipA('<div class="t">' + esc(mk.n) + '</div>' + esc(mk.d || '')) + '/></g>');
      });
      H = yA + 48 + 46 + 24;
    }
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Fahrplan') + '">' + out.join('') + '</svg>'
      + legende([{ n: 'gemessen', f: F.tinte }, { n: 'gut für dich', f: F.gruen }, { n: 'Risiko, vorbereiten', f: F.rot }, { n: 'Hinweis', f: F.tinte3 }]);
    ziehen(host);
    return host;
  }

  /* Punktreihen: je Zeile ein Wert auf gemeinsamer Skala, senkrechte Bezugslinie (z. B. Plan-Wert) */
  function punktreihen(host, d, o) {
    o = o || {}; var W = o.breite || breiteVon(host), Z = d.zeilen.filter(function (z) { return z.v != null && isFinite(z.v); }); if (!Z.length) { host.innerHTML = ''; return host; }
    var lw = W < 440 ? 118 : 170, rw = 86, rowH = 30, H = Z.length * rowH + 26;
    var vs = Z.map(function (z) { return z.v; }).concat(d.bezug != null ? [d.bezug] : []), mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs), pad = Math.max(1, (mx - mn) * 0.12);
    var tk = ticks(Math.max(0, mn - pad), mx + pad, W < 440 ? 3 : 4), a = tk[0], b = tk[tk.length - 1], x = function (v) { return lw + (v - a) / (b - a) * (W - lw - rw); };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Einordnung') + '">'];
    tk.forEach(function (t) { out.push('<line class="gx-netz" x1="' + f1(x(t)) + '" x2="' + f1(x(t)) + '" y1="4" y2="' + (H - 20) + '"/><text class="gx-ax" x="' + f1(x(t)) + '" y="' + (H - 6) + '" text-anchor="middle">' + kurz(t) + '</text>'); });
    if (d.bezug != null) out.push('<line x1="' + f1(x(d.bezug)) + '" x2="' + f1(x(d.bezug)) + '" y1="2" y2="' + (H - 20) + '" style="stroke:' + F.gold + ';stroke-width:1.5;stroke-dasharray:4 3"/>');
    Z.forEach(function (z, i) {
      var y = 4 + i * rowH + rowH / 2, fc = z.farbe || F.creme;
      out.push('<text x="' + (lw - 10) + '" y="' + f1(y + 4) + '" text-anchor="end" style="font:500 12px Inter,sans-serif;fill:' + F.tinte2 + '">' + esc(z.n) + '</text>');
      out.push('<line x1="' + lw + '" x2="' + f1(x(z.v)) + '" y1="' + f1(y) + '" y2="' + f1(y) + '" class="gx-wx" style="stroke:' + fc + ';stroke-width:2;opacity:.35;transform-origin:left;animation-delay:' + (i * 70) + 'ms"/>');
      out.push('<circle cx="' + f1(x(z.v)) + '" cy="' + f1(y) + '" r="' + (z.gross ? 7 : 5.5) + '" class="gx-fade" style="fill:' + (z.hohl ? F.karte : fc) + ';stroke:' + fc + ';stroke-width:2;animation-delay:' + (i * 70) + 'ms"' + tipA('<div class="t">' + esc(z.n) + '</div><b>' + eur(z.v) + '</b>' + (z.tip ? '<br>' + esc(z.tip) : '') + (d.bezug != null && z.v !== d.bezug ? '<br>gegen ' + esc(d.bezugText || 'Bezug') + ' <b>' + eurV(z.v - d.bezug) + '</b>' : '')) + '/>');
      out.push('<text x="' + (W - 2) + '" y="' + f1(y + 4) + '" text-anchor="end" style="font:600 11.5px JetBrains Mono,monospace;fill:' + F.tinte + '">' + esc(kurz(z.v)) + ' €</text>');
    });
    out.push('</svg>');
    host.innerHTML = out.join('');
    return host;
  }

  /* Fingerabdruck: Radar, Objekt gegen Portfolio, Zahl in der Mitte */
  function fingerabdruck(host, d, o) {
    o = o || {}; var W = o.breite || breiteVon(host), H = Math.min(340, Math.max(270, W * 0.78)), cx = W / 2, cy = H / 2 + 4, R = Math.min(W * 0.3, H * 0.34);
    var A = d.achsen, n = A.length;
    var norm = function (a, v) { return v == null ? null : Math.max(0, Math.min(100, (v - a.lo) / (a.hi - a.lo) * 100)); };
    var pt = function (i, v) { var w = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(w) * R * v / 100, cy + Math.sin(w) * R * v / 100]; };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Fingerabdruck') + '">'];
    [25, 50, 75, 100].forEach(function (v) { out.push('<polygon points="' + A.map(function (_, i) { return pt(i, v).map(f1).join(','); }).join(' ') + '" style="fill:none;stroke:' + F.linie + '"/>'); });
    A.forEach(function (a, i) { var p = pt(i, 100), q = pt(i, 124); out.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + f1(p[0]) + '" y2="' + f1(p[1]) + '" style="stroke:' + F.linie + '"/><text class="gx-ax2" x="' + f1(q[0]) + '" y="' + f1(q[1] + 4) + '" text-anchor="' + (Math.abs(q[0] - cx) < 8 ? 'middle' : q[0] < cx ? 'end' : 'start') + '">' + esc(a.n) + '</text>'); });
    var poly = function (key) { return A.map(function (a, i) { var v = norm(a, a[key]); return pt(i, v == null ? 0 : v).map(f1).join(','); }).join(' '); };
    if (A.some(function (a) { return a.p != null; })) out.push('<polygon class="gx-fade" points="' + poly('p') + '" style="fill:' + F.blau + ';fill-opacity:.16;stroke:' + F.blau + ';stroke-width:1.5;stroke-opacity:.75"/>');
    out.push('<polygon class="gx-zieh" points="' + poly('o') + '" style="fill:color-mix(in srgb,' + F.gold + ' 14%,transparent);stroke:' + F.gold + ';stroke-width:2.2;stroke-linejoin:round"/>');
    A.forEach(function (a, i) { var v = norm(a, a.o); if (v == null) return; var p = pt(i, v); out.push('<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="4.5" style="fill:' + F.gold + ';stroke:' + F.karte + ';stroke-width:2"/><circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="14" style="fill:transparent"' + tipA('<div class="t">' + esc(a.n) + '</div>Dieses Objekt <b>' + esc(a.f(a.o)) + '</b>' + (a.p != null ? '<br>Portfolio-Schnitt <b>' + esc(a.f(a.p)) + '</b>' : '') + '<br>Skala ' + esc(a.f(a.lo)) + ' bis ' + esc(a.f(a.hi))) + '/>'); });
    if (d.mitte == null && d.mitteText) out.push('<text class="gx-ax" x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" style="fill:' + F.tinte2 + '">' + esc(d.mitteText) + '</text>');   /* v4350 · unter der Schwelle nur das Wort */
    if (d.mitte != null) out.push('<text class="gx-zahl" x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle">' + esc(d.mitte) + '</text>' + (d.mitteText ? '<text class="gx-ax" x="' + cx + '" y="' + (cy + 22) + '" text-anchor="middle" style="fill:' + F.tinte2 + '">' + esc(d.mitteText) + '</text>' : ''));
    out.push('</svg>');
    host.innerHTML = out.join('') + legende([{ n: 'dieses Objekt', f: F.gold }].concat(A.some(function (a) { return a.p != null; }) ? [{ n: 'Portfolio-Schnitt' + (d.n ? ' (' + d.n + ' Objekte)' : ''), f: F.blau }] : []));
    ziehen(host);
    return host;
  }

  /* Sankey: links Zuflüsse, rechts Abflüsse, Ströme anteilig */
  function sankey(host, d, o) {
    o = o || {}; var W = o.breite || breiteVon(host), schmal = W < 560, H = 300, gap = 10, nw = 10, m = 8;
    var ein = d.ein.filter(function (a) { return a.v > 0.5; }), aus = d.aus.filter(function (a) { return a.v > 0.5; });
    var sE = ein.reduce(function (s, a) { return s + a.v; }, 0), sA = aus.reduce(function (s, a) { return s + a.v; }, 0);
    if (!(sE > 0)) { host.innerHTML = ''; return host; }
    var xL = schmal ? 6 : 156, xR = schmal ? W - 16 : W - 176, sk = (H - 2 * m - gap * Math.max(ein.length, aus.length)) / Math.max(sE, sA);
    var lage = function (arr, x) { var y = m; return arr.map(function (a) { var h = a.v * sk, q = { n: a.n, v: a.v, f: a.f, x: x, y: y, h: h }; y += h + gap; return q; }); };
    var L = lage(ein, xL), R = lage(aus, xR), ly = L.map(function (q) { return q.y; }), ry = R.map(function (q) { return q.y; });
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Fluss') + '">'];
    L.forEach(function (a, i) { R.forEach(function (b, k) {
      var v = a.v * b.v / sA, h = v * sk, y0 = ly[i], y1 = ry[k]; ly[i] += h; ry[k] += h;
      var x0 = a.x + nw, x1 = b.x, c = (x0 + x1) / 2;
      out.push('<path class="gx-fade" d="M' + f1(x0) + ',' + f1(y0) + ' C' + f1(c) + ',' + f1(y0) + ' ' + f1(c) + ',' + f1(y1) + ' ' + f1(x1) + ',' + f1(y1) + ' L' + f1(x1) + ',' + f1(y1 + h) + ' C' + f1(c) + ',' + f1(y1 + h) + ' ' + f1(c) + ',' + f1(y0 + h) + ' ' + f1(x0) + ',' + f1(y0 + h) + ' Z" style="fill:' + a.f + ';fill-opacity:.32"' + tipA('<div class="t">' + esc(a.n) + ' → ' + esc(b.n) + '</div><b>' + eur(v) + '</b> im Jahr · ' + eur(v / 12) + ' im Monat') + '/>');
    }); });
    var spreize = function (arr) { var last = -1e9; arr.forEach(function (q) { q.ly = Math.max(q.y + Math.min(q.h, 40) / 2, last + 30); last = q.ly; }); var over = arr.length ? arr[arr.length - 1].ly - (H - 14) : 0; if (over > 0) arr.forEach(function (q) { q.ly -= over; }); };
    spreize(L); spreize(R);
    var knoten = function (q, links) {
      out.push('<rect x="' + f1(q.x) + '" y="' + f1(q.y) + '" width="' + nw + '" height="' + f1(Math.max(2, q.h)) + '" rx="2" style="fill:' + q.f + '"/>');
      if (schmal) { /* am Handy keine Beschriftung im Bild, die Liste darunter trägt Namen und Beträge */ }
      else if (false) out.push('<text x="' + f1(links ? q.x + nw + 6 : q.x - 6) + '" y="' + f1(q.ly + 4) + '" text-anchor="' + (links ? 'start' : 'end') + '" style="font:500 11.5px Inter,sans-serif;fill:' + F.tinte + ';paint-order:stroke;stroke:' + F.karte + ';stroke-width:4;stroke-linejoin:round">' + esc(q.n + ' ' + eur(q.v)) + '</text>');
      else out.push('<text x="' + f1(links ? q.x - 8 : q.x + nw + 8) + '" y="' + f1(q.ly - 2) + '" text-anchor="' + (links ? 'end' : 'start') + '" style="font:500 12.5px Inter,sans-serif;fill:' + F.tinte + '">' + esc(q.n) + '</text><text class="gx-ax" x="' + f1(links ? q.x - 8 : q.x + nw + 8) + '" y="' + f1(q.ly + 13) + '" text-anchor="' + (links ? 'end' : 'start') + '">' + esc(eur(q.v) + ' · ' + nf0.format(q.v / sE * 100) + ' %') + '</text>');
    };
    L.forEach(function (q) { knoten(q, true); }); R.forEach(function (q) { knoten(q, false); });
    out.push('</svg>');
    var liste = !schmal ? '' : '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-top:10px;font:500 11.5px/1.35 Inter,sans-serif">'
      + [['Woher', L], ['Wohin', R]].map(function (sp) { return '<div><div class="gx-eye" style="margin-bottom:4px">' + sp[0] + '</div>' + sp[1].map(function (q) { return '<div style="display:flex;gap:6px;align-items:baseline"><i style="flex:0 0 8px;height:8px;border-radius:2px;background:' + q.f + '"></i><span style="flex:1;color:' + F.tinte2 + '">' + esc(q.n) + '</span><b style="font:600 11px JetBrains Mono,monospace;color:' + F.tinte + '">' + esc(kurz(q.v)) + '</b></div>'; }).join('') + '</div>'; }).join('') + '</div>';
    host.innerHTML = out.join('') + liste;
    return { host: host, sE: sE, sA: sA };
  }

  /* Tornado: je Hebel ungünstig (rot) / günstig (grün) um die Basis */
  function tornado(host, d, o) {
    o = o || {}; var W = o.breite || breiteVon(host), T = d.T, schmal = W < 520, lw = schmal ? 0 : 200, rowH = schmal ? 46 : 34, H = T.length * rowH + 30;
    var lo = Math.min.apply(null, T.map(function (t) { return Math.min(t.lo, t.hi, d.basis); })), hi = Math.max.apply(null, T.map(function (t) { return Math.max(t.lo, t.hi, d.basis); }));
    var pad = (hi - lo) * 0.14 || 1, a = lo - pad, b = hi + pad, x = function (v) { return lw + 14 + (v - a) / (b - a) * (W - lw - 28); };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Hebel') + '">'];
    out.push('<line x1="' + f1(x(d.basis)) + '" x2="' + f1(x(d.basis)) + '" y1="4" y2="' + (H - 22) + '" style="stroke:' + F.tinte2 + ';stroke-width:1.2"/><text class="gx-ax" x="' + f1(x(d.basis)) + '" y="' + (H - 6) + '" text-anchor="middle" style="fill:' + F.tinte + '">Basis ' + esc(d.fmt(d.basis)) + '</text>');
    T.forEach(function (t, i) {
      var yb = i * rowH + (schmal ? 20 : 8), h = schmal ? 16 : 18, neg = Math.min(t.lo, t.hi), pos = Math.max(t.lo, t.hi);
      out.push(schmal ? '<text x="14" y="' + (yb - 5) + '" style="font:500 11.5px Inter,sans-serif;fill:' + F.tinte2 + '">' + esc(t.n) + '</text>' : '<text x="' + lw + '" y="' + (yb + h / 2 + 4) + '" text-anchor="end" style="font:500 12px Inter,sans-serif;fill:' + F.tinte2 + '">' + esc(t.n) + '</text>');
      var tip = tipA('<div class="t">' + esc(t.n) + '</div>ungünstig <b>' + esc(d.fmt(neg)) + '</b> · günstig <b>' + esc(d.fmt(pos)) + '</b><br>Spanne <b>' + nf1.format(pos - neg) + ' Punkte</b>');
      out.push('<rect class="gx-wx" x="' + f1(x(neg)) + '" y="' + yb + '" width="' + f1(Math.max(1, x(d.basis) - x(neg))) + '" height="' + h + '" rx="3" style="fill:' + F.rot + ';transform-origin:right;animation-delay:' + (i * 60) + 'ms"' + tip + '/>');
      out.push('<rect class="gx-wx" x="' + f1(x(d.basis)) + '" y="' + yb + '" width="' + f1(Math.max(1, x(pos) - x(d.basis))) + '" height="' + h + '" rx="3" style="fill:' + F.gruen + ';transform-origin:left;animation-delay:' + (i * 60) + 'ms"' + tip + '/>');
      out.push('<text class="gx-ax" x="' + f1(x(neg) - 4) + '" y="' + (yb + h / 2 + 4) + '" text-anchor="end">' + nf1.format(neg) + '</text><text class="gx-ax" x="' + f1(x(pos) + 4) + '" y="' + (yb + h / 2 + 4) + '">' + nf1.format(pos) + '</text>');
    });
    out.push('</svg>');
    host.innerHTML = out.join('') + legende([{ n: 'ungünstig', f: F.rot }, { n: 'günstig', f: F.gruen }]);
    return host;
  }

  /* Rendite je Verkaufsjahr mit steuerpflichtigem Feld */
  function ausstieg(host, d, o) {
    o = o || {}; var D = d.punkte.filter(function (p) { return p.irr != null; }); if (D.length < 2) { host.innerHTML = ''; return host; }
    var W = o.breite || breiteVon(host), H = Math.round(Math.min(300, Math.max(210, W * 0.4))), m = { l: 46, r: 14, t: 18, b: 26 };
    var j0 = D[0].j, j1 = D[D.length - 1].j, vals = D.map(function (p) { return p.irr; }), tk = ticks(Math.min(0, Math.min.apply(null, vals)), Math.max.apply(null, vals), 4), lo = tk[0], hi = tk[tk.length - 1];
    var x = function (j) { return m.l + (j - j0) / Math.max(1, j1 - j0) * (W - m.l - m.r); }, y = function (v) { return m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b); };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Rendite je Verkaufsjahr">'];
    if (d.freiAb != null && d.freiAb > j0) { var xf = x(Math.min(j1, d.freiAb - 0.5)); out.push('<rect x="' + f1(m.l - 4) + '" y="' + m.t + '" width="' + f1(Math.max(0, xf - m.l + 4)) + '" height="' + (H - m.t - m.b) + '" style="fill:' + F.rot + ';opacity:.08"/><text class="gx-ax" x="' + m.l + '" y="' + (m.t + 10) + '" style="fill:' + F.rot + '">STEUERPFLICHTIG</text>'); if (d.freiAb <= j1) out.push('<text class="gx-ax" x="' + f1(xf + 6) + '" y="' + (m.t + 10) + '" style="fill:' + F.gruen + '">' + esc(d.freiText || 'STEUERFREI') + '</text>'); }
    tk.forEach(function (v) { out.push('<line class="gx-netz" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(y(v)) + '" y2="' + f1(y(v)) + '"/><text class="gx-ax" x="' + (m.l - 8) + '" y="' + f1(y(v) + 4) + '" text-anchor="end">' + nf0.format(v) + ' %</text>'); });
    var st = Math.max(1, Math.ceil(D.length / Math.max(2, Math.floor((W - m.l - m.r) / 52))));
    D.forEach(function (p, i) { if (i % st === 0 || (i === D.length - 1 && (D.length - 1) % st >= st / 2)) out.push('<text class="gx-ax" x="' + f1(x(p.j)) + '" y="' + (H - 6) + '" text-anchor="middle">' + p.j + '</text>'); });
    out.push('<path class="gx-zieh" d="M' + D.map(function (p) { return f1(x(p.j)) + ',' + f1(y(p.irr)); }).join(' L') + '" style="fill:none;stroke:' + F.gold + ';stroke-width:2.2;stroke-linejoin:round"/>');
    var best = D.reduce(function (a, b) { return b.irr > a.irr ? b : a; });
    out.push('<circle cx="' + f1(x(best.j)) + '" cy="' + f1(y(best.irr)) + '" r="5" style="fill:' + F.gold + ';stroke:' + F.karte + ';stroke-width:2"/><text x="' + f1(x(best.j)) + '" y="' + f1(y(best.irr) - 10) + '" text-anchor="' + (x(best.j) > W - 120 ? 'end' : 'middle') + '" style="font:600 11px JetBrains Mono,monospace;fill:' + F.tinte + '">bestes Jahr ' + best.j + ' · ' + esc(pct(best.irr)) + '</text>');
    var dx = (W - m.l - m.r) / Math.max(1, j1 - j0);
    D.forEach(function (p) { out.push('<rect x="' + f1(x(p.j) - dx / 2) + '" y="' + m.t + '" width="' + f1(dx) + '" height="' + (H - m.t - m.b) + '" style="fill:transparent"' + tipA('<div class="t">Verkauf Ende ' + p.j + '</div>Eigenkapitalrendite <b>' + pct(p.irr) + '</b> im Jahr<br>Rückfluss das <b>' + nf1.format(p.mult) + '-fache</b> des Eigenkapitals<br>' + (p.frei ? 'Verkauf steuerfrei' : 'Gewinn steuerpflichtig')) + '/>'); });
    out.push('</svg>');
    host.innerHTML = out.join('');
    ziehen(host);
    return best;
  }

  /* ══ MODELL (benannte Hilfen, keine Kernrechnung) ═══════════════════ */
  var MODELL = (function () {
    /* Grundlage aus der App lesen */
    function basis() {
      var R = (window.State && Array.isArray(window.State.cfRows)) ? window.State.cfRows : [];
      var J = R.map(function (r) {
        return { j: +r.cal, nkm: zahl(r.nkm_y) || 0, bwk: zahl(r.bwk_cf_y) || 0, zins: zahl(r.zy) || 0, tilg: zahl(r.ty) || 0, cfop: zahl(r.cfop_y), cfns: zahl(r.cfns_y),
          rs: zahl(r.rs) || 0, wert: zahl(r.wert_y), steuer: zahl(r.tax_y) || 0, afa: zahl(r.afa_y) || 0, vuv: zahl(r.zve_y) || 0 };
      }).filter(function (r) { return r.j > 1900 && r.cfop != null && r.cfns != null && r.wert != null; });
      if (J.length < 3) return null;
      var S = window.State || {}, kd = String((document.getElementById('kaufdat') || {}).value || (document.getElementById('purchase_date') || {}).value || S._afa_year1_relDate || ''),   /* Kaufdatum aus dem Feld: _afa_year1_relDate ist der AfA-Beginn und kann heute sein (gemessen Westerfeldstr.) */ mm = /^(\d{4})-(\d{2})/.exec(kd);
      var kaufJ = mm ? +mm[1] : J[0].j, kaufM = mm ? +mm[2] : 1;
      var g = function (k) { var a = J[J.length - 2][k], b = J[J.length - 1][k]; return a > 0 && b > 0 ? Math.max(-0.05, Math.min(0.08, b / a - 1)) : 0; };
      var halter = (document.getElementById('halter') || {}).value || 'privat';
      var gi = zahl(S.gi) || wert('kp') || 0, ek = wert('ek'), bindEnde = kaufJ + (zahl(S.bindj) || 10);
      /* Anschlusszins und -tilgung, mit denen die App WIRKLICH rechnet: aus dem ersten vollen Jahr nach der Zinsbindung
         (Zins / Restschuld am Jahresanfang). State.az ist die Eingabe, die App kann einen anderen Satz ansetzen
         (gemessen Demostraße: State.az 5 %, gerechnet 3,763 %). */
      var az = zahl(S.az) != null && S.az > 0 ? S.az : 0.04, at = zahl(S.at) != null && S.at > 0 ? S.at : 0.02, azQ = 'Eingabe';
      var rB = J.filter(function (r) { return r.j === bindEnde; })[0], rN = J.filter(function (r) { return r.j === bindEnde + 1; })[0];
      if (rB && rN && rB.rs > 0 && rN.zins > 0) { az = rN.zins / rB.rs; at = Math.max(0, rN.tilg / rB.rs); azQ = 'App'; }
      return { J: J, kaufJ: kaufJ, kaufM: kaufM, bindEnde: bindEnde, bindMon: kaufM, azQuelle: azQ,
        az: az, at: at,
        gi: gi, ek: ek != null ? ek : Math.max(0, gi - (J[0].rs + J[0].tilg)), kp: wert('kp') || gi, grenz: (wert('grenz') || 42) / 100,
        mstg: g('nkm'), kstg: g('bwk'), wstg: g('wert'), privat: !/gmbh|ug|gesellschaft|kg|ag/i.test(halter) && halter !== 'gesellschaft',
        heute: heuteJahr(), bis: heuteJahr() + 30 };
    }
    /* Szenario rechnen. Innerhalb der App-Jahre nur die Abweichung zur App, danach mit den Raten der App weiter. */
    function rechne(P, opt) {
      var o = { mFak: 1, kFak: 1, wDelta: 0, mDelta: 0, zA: null, leer: 0, kpFak: 1, bis: P.bis, pfad: null };
      for (var k in opt || {}) o[k] = opt[k];
      var byJ = {}; P.J.forEach(function (r) { byJ[r.j] = r; });
      var L = P.J[P.J.length - 1], rows = [], fN = 1, fK = 1, fW = 1, rs = null, ann = null, bN = 0, bK = 0, bW = 0, afaL = L.afa;
      var dAfa = (o.kpFak - 1) * (L.afa || 0);
      for (var j = P.J[0].j; j <= o.bis; j++) {
        var a = byJ[j], p = o.pfad && o.pfad[j];
        bN = a ? a.nkm : bN * (1 + P.mstg); bK = a ? a.bwk : bK * (1 + P.kstg); bW = a ? a.wert : bW * (1 + P.wstg);
        if (a && j <= P.heute) { rows.push({ j: j, nkm: a.nkm, bwk: a.bwk, zins: a.zins, tilg: a.tilg, cfop: a.cfop, cfns: a.cfns, rs: a.rs, wert: a.wert, steuer: a.steuer, afa: a.afa, vuv: a.vuv, quelle: 'app' }); rs = a.rs; continue; }
        if (rs == null) rs = a ? a.rs + a.tilg : L.rs;
        fN *= (1 + (p ? p.m : P.mstg + o.mDelta)) / (1 + P.mstg);
        fK *= (1 + (p ? p.k : P.kstg)) / (1 + P.kstg);
        fW *= (1 + (p ? p.w : P.wstg + o.wDelta)) / (1 + P.wstg);
        var n = bN * fN * o.mFak * (1 - o.leer - (p ? p.leer : 0)), b = bK * fK * o.kFak, w = bW * fW, zins, tilg;
        if (a && (o.zA == null || j < P.bindEnde)) { zins = a.zins; tilg = a.tilg; }
        else if (j < P.bindEnde) { zins = L.zins; tilg = L.tilg; }
        else if (a && j === P.bindEnde) {
          /* Wechseljahr: die App wechselt unterjährig. Nur der Zinsunterschied für die Monate nach dem Wechsel, Tilgung wie die App. */
          var anteil = (12 - (P.bindMon - 1)) / 12; zins = a.zins + (o.zA - P.az) * rs * anteil; tilg = a.tilg;
        }
        else {
          var zA = o.zA != null ? o.zA : P.az;
          if (ann == null) { var prev = rows[rows.length - 1]; ann = (o.zA == null && prev && prev.j > P.bindEnde) ? prev.zins + prev.tilg : rs * (zA + P.at); }
          zins = rs * zA; tilg = Math.max(0, Math.min(rs, ann - zins));
        }
        var rsNeu = Math.max(0, rs - tilg), r;
        if (a) {
          var dN = n - a.nkm, dB = b - a.bwk, dZ = zins - a.zins, dT = tilg - a.tilg, vuv = a.vuv + dN - dB - dZ - dAfa, steuer = a.steuer + (vuv - a.vuv) * P.grenz, cfop = a.cfop + dN - dB - dZ - dT;
          r = { j: j, nkm: n, bwk: b, zins: zins, tilg: tilg, cfop: cfop, cfns: a.cfns + (cfop - a.cfop) - (steuer - a.steuer), rs: (o.zA == null && !o.pfad) ? a.rs : rsNeu, wert: w, steuer: steuer, afa: a.afa + dAfa, vuv: vuv, quelle: (n === a.nkm && b === a.bwk && dZ === 0) ? 'app' : 'modell' };
          if (o.zA == null && !o.pfad) rsNeu = a.rs;
        } else {
          var afa = afaL + dAfa, vuv2 = n - b - zins - afa, st2 = vuv2 * P.grenz, cf2 = n - b - zins - tilg;
          r = { j: j, nkm: n, bwk: b, zins: zins, tilg: tilg, cfop: cf2, cfns: cf2 - st2, rs: rsNeu, wert: w, steuer: st2, afa: afa, vuv: vuv2, quelle: 'modell' };
        }
        rs = rsNeu; rows.push(r);
      }
      return { rows: rows, ekEins: P.ek + (o.kpFak - 1) * P.gi, gi: P.gi * o.kpFak };
    }
    /* Eigenkapitalrendite (IRR) bei Verkauf Ende exitJ: −EK im ersten Jahr, Cashflows nach Steuer, Erlös minus Restschuld,
       Verkaufskosten 3 % (Beispiel), privat vor Ablauf von zehn Jahren Steuer auf den Gewinn (§ 23 EStG). */
    function irr(P, sz, exitJ, vk) {
      vk = vk == null ? 0.03 : vk; if (!(sz.ekEins > 0)) return null;
      var R = sz.rows.filter(function (r) { return r.j <= exitJ; }); if (!R.length) return null;
      var fl = [-sz.ekEins], afaSum = 0, frei = !P.privat ? false : exitJ >= P.kaufJ + 10;
      R.forEach(function (r) { afaSum += r.afa || 0; });
      R.forEach(function (r) { var f = r.cfns; if (r.j === exitJ) { var erl = r.wert * (1 - vk), st = 0; if (!frei) { var gew = erl - (sz.gi - afaSum); st = Math.max(0, gew) * P.grenz; } f += erl - r.rs - st; } fl.push(f); });
      var npv = function (q) { return fl.reduce(function (s, f, t) { return s + f / Math.pow(1 + q, t); }, 0); };
      var lo = -0.99, hi = 1.5; if (npv(lo) * npv(hi) > 0) return null;
      for (var i = 0; i < 120; i++) { var mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
      return { irr: (lo + hi) / 2 * 100, mult: fl.slice(1).reduce(function (s, f) { return s + f; }, 0) / sz.ekEins, frei: frei };
    }
    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function normal(r) { var u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    /* Monte-Carlo: Miete, Kosten, Wert (mit Marktzyklus), Leerstand, Anschlusszins je Pfad. Fester Startwert. */
    function monteCarlo(P, N) {
      N = N || 500; var r = mulberry(20261123), jahre = [], verm = [], pos = [], zinsen = [];
      for (var j = P.heute; j <= P.bis; j++) { jahre.push(j); verm.push([]); pos.push(0); }
      for (var k = 0; k < N; k++) {
        var pfad = {}, wk = 0;
        for (var jj = P.heute + 1; jj <= P.bis; jj++) { wk = 0.55 * wk + 0.045 * normal(r); pfad[jj] = { m: P.mstg + 0.01 * normal(r), k: P.kstg + 0.006 * normal(r), w: P.wstg + wk * 0.6, leer: r() < 0.04 ? 2 / 12 : 0 }; }
        var zA = Math.min(0.08, Math.max(0.015, P.az + 0.011 * normal(r))); zinsen.push(zA);
        var sz = rechne(P, { pfad: pfad, zA: zA }), kum = 0;
        sz.rows.forEach(function (row) { kum += row.cfns; var i = row.j - P.heute; if (i >= 0 && i < jahre.length) { verm[i].push(row.wert - row.rs + kum); if (row.cfns > 0) pos[i]++; } });
      }
      var q = function (a, p) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
      return { N: N, jahre: jahre, p10: verm.map(function (a) { return q(a, 0.1); }), p50: verm.map(function (a) { return q(a, 0.5); }), p90: verm.map(function (a) { return q(a, 0.9); }), pPos: pos.map(function (c) { return c / N * 100; }), zP10: q(zinsen, 0.1), zP90: q(zinsen, 0.9) };
    }
    /* Hebel: Eigenkapitalrendite bei Verkauf exitJ, je Hebel ungünstig/günstig */
    function hebel(P, exitJ) {
      var B = irr(P, rechne(P, {}), exitJ); if (!B) return null;
      var T = [
        ['Miete ab ' + (P.heute + 1) + ' ± 10 %', { mFak: 0.9 }, { mFak: 1.1 }],
        ['Anschlusszins ± 1 Punkt', { zA: P.az + 0.01 }, { zA: Math.max(0.005, P.az - 0.01) }],
        ['Wertsteigerung ± 1 Punkt im Jahr', { wDelta: -0.01 }, { wDelta: 0.01 }],
        P.kaufJ >= P.heute ? ['Kaufpreis ± 10 %', { kpFak: 1.1 }, { kpFak: 0.9 }] : null,   /* im Bestand ist der Kaufpreis kein Hebel mehr */
        ['Nicht umlegbare Kosten ± 25 %', { kFak: 1.25 }, { kFak: 0.75 }],
        ['Leerstand 1 Monat im Jahr', { leer: 1 / 12 }, { leer: 0 }]
      ].filter(Boolean).map(function (t) { var a = irr(P, rechne(P, t[1]), exitJ), b = irr(P, rechne(P, t[2]), exitJ); return a && b ? { n: t[0], lo: a.irr, hi: b.irr, span: Math.abs(b.irr - a.irr) } : null; })
        .filter(Boolean).sort(function (x, y) { return y.span - x.span; });
      return { basis: B.irr, T: T, exitJ: exitJ };
    }
    /* Heatmap: Cashflow nach Steuer im Monat im Jahr nach der Zinsbindung, Anschlusszins × Miete */
    function heat(P) {
      var jahr = Math.max(P.bindEnde + 1, P.heute + 1); if (jahr > P.bis) return null;
      var mitte = Math.round(P.az * 100 * 2) / 2, Z = []; for (var z = Math.max(0.5, mitte - 3); z <= mitte + 3 + 1e-9; z += 0.5) Z.push(Math.round(z * 10) / 10);
      var M = [15, 10, 5, 0, -5, -10];
      var G = M.map(function (mm) { return Z.map(function (zz) { var r = rechne(P, { zA: zz / 100, mFak: 1 + mm / 100 }).rows.filter(function (x) { return x.j === jahr; })[0]; return r ? r.cfns / 12 : null; }); });
      var ci = -1, best = 9; Z.forEach(function (zz, i) { var d = Math.abs(zz - P.az * 100); if (d < best) { best = d; ci = i; } });
      return { jahr: jahr, Z: Z, M: M, G: G, ci: ci, ri: M.indexOf(0) };
    }
    function meilensteine(P, sz) {
      var R = sz.rows, f = function (pred) { var r = R.filter(pred)[0]; return r ? r.j : null; };
      var nach = function (r) { return r.j > P.heute; };
      var ltv60 = f(function (r) { return nach(r) && r.wert > 0 && r.rs / r.wert < 0.6; }), cfop = f(function (r) { return nach(r) && r.cfop > 0; }), cfns = f(function (r) { return nach(r) && r.cfns > 0; }), frei = f(function (r) { return nach(r) && r.rs <= 1; });
      var rsBind = (R.filter(function (r) { return r.j === P.bindEnde - 1; })[0] || {}).rs;
      var M = [{ j: P.kaufJ + (P.kaufM - 1) / 12, n: 'Kauf', d: String(P.kaufM).padStart(2, '0') + '/' + P.kaufJ + ' · ' + eur(P.kp), art: 'gem' }];
      var mh = null; try { var A = window.DpMieteMax && window.DpMieteMax.alle ? window.DpMieteMax.alle() : null; (A && A.W || []).forEach(function (w) { var ab = w.bestand && w.bestand.ab; var m2 = /(\d{4})-(\d{2})/.exec(String(ab || '')) || /(\d{2})\.(\d{4})/.exec(String(ab || '')); if (m2) { var jj = m2[1].length === 4 ? +m2[1] + (+m2[2] - 1) / 12 : +m2[2] + (+m2[1] - 1) / 12; if (mh == null || jj < mh.j) mh = { j: jj, d: String(ab) }; } }); } catch (e) {}
      if (mh) M.push({ j: mh.j, n: 'Mieterhöhung möglich', d: 'ab ' + mh.d + ' nach § 558 BGB', art: 'gut' });
      /* v4280 · Marcel: „im Fahrplan fehlt das Zielbild“. Jahr und Miete aus DpWertZielbild.daten().zielbild (Reiter Miete › Zielbild). */
      try { var WZ = window.DpWertZielbild && window.DpWertZielbild.daten ? window.DpWertZielbild.daten() : null, ZB = WZ && WZ.zielbild, zs = ZB && ZB.stufen && ZB.stufen.zielbild;
        if (zs) { var zj = ZB.jahre && zahl(ZB.jahre.zielbild), mm = zahl(zs.miete_monat) != null ? zs.miete_monat : (zahl(zs.miete_jahr) != null ? zs.miete_jahr / 12 : null);
          M.push({ j: zj != null ? zj + 0.5 : P.heute + 1, jahrText: zj != null ? null : 'Jahr offen', n: 'Zielbild', d: (mm != null ? 'Miete ' + eur(mm) + ' im Monat' : 'Zielbild eingetragen') + (zahl(zs.kosten) ? ', Maßnahmen ' + eur(zs.kosten) : '') + (zj != null ? '' : '. Das Jahr trägst du im Reiter Miete beim Zielbild ein.'), art: 'gut' }); } } catch (e) {}
      if (cfop) M.push({ j: cfop, n: 'Cashflow vor Steuer positiv', d: String(cfop), art: 'gut' });
      if (P.bindEnde > P.heute && P.bindEnde <= P.bis) M.push({ j: P.bindEnde + (P.bindMon - 1) / 12, n: 'Zinsbindung endet', d: String(P.bindMon).padStart(2, '0') + '/' + P.bindEnde + (rsBind != null ? ' · Restschuld etwa ' + eur(rsBind) : ''), art: 'risiko' });
      if (P.privat && P.kaufJ + 10 > P.heute) M.push({ j: P.kaufJ + 10 + (P.kaufM - 1) / 12, n: 'Verkauf steuerfrei', d: 'ab ' + String(P.kaufM).padStart(2, '0') + '/' + (P.kaufJ + 10) + ' · zehn Jahre gehalten (§ 23 EStG)', art: 'gut' });
      if (cfns && cfns !== cfop) M.push({ j: cfns, n: 'Cashflow nach Steuer positiv', d: String(cfns), art: 'gut' });
      if (ltv60) M.push({ j: ltv60, n: 'Beleihung unter 60 %', d: String(ltv60), art: 'gut' });
      M.push(frei ? { j: frei, n: 'Schuldenfrei', d: String(frei), art: 'gut' } : { j: P.bis + 0.9, n: 'Schuldenfrei nach ' + P.bis, d: 'Restschuld ' + P.bis + ' etwa ' + eur(R[R.length - 1].rs), art: 'info' });
      return M;
    }
    return { basis: basis, rechne: rechne, irr: irr, monteCarlo: monteCarlo, hebel: hebel, heat: heat, meilensteine: meilensteine };
  })();

  /* ── Daten der App für Einordnung und Fingerabdruck ────────────────── */
  var _ptMemo = null;
  function portfolioSchnitt() {
    if (_ptMemo && Date.now() - _ptMemo.t < 5000) return _ptMemo.v;   /* portfolioPayload ist teuer, zwei Karten lesen ihn */
    var v = portfolioSchnittRoh(); _ptMemo = { t: Date.now(), v: v }; return v;
  }
  function portfolioSchnittRoh() {
    var O = []; try { var P = window.DealPilotDashboard && window.DealPilotDashboard.portfolioPayload ? window.DealPilotDashboard.portfolioPayload() : null; O = P && Array.isArray(P.objekte) ? P.objekte : []; } catch (e) { O = []; }
    var mw = function (f) { var a = O.map(f).filter(function (v) { return v != null && isFinite(v); }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; };
    return { n: O.length, bmy: mw(function (o) { return zahl(o.bruttomietrendite_prozent); }), dscr: mw(function (o) { return zahl(o.dscr); }), ltv: mw(function (o) { return zahl(o.ltv_prozent); }),
      cfm: mw(function (o) { var v = zahl(o.cashflow_vor_steuer_eur_jahr); return v == null ? null : v / 12; }), score: mw(function (o) { return zahl(o.dealpilot_score); }),
      ids: mw(function (o) { return zahl(o.investor_deal_score); }) };   /* v4350 · Schnitt des Investor Deal Score (nur belastbar gespeicherte) */
  }
  function profil(k) { try { var v = window.DealPilotInvestmentProfile ? window.DealPilotInvestmentProfile.get(k) : null; return zahl(v); } catch (e) { return null; } }
  function einordnungDaten(mitAnkauf) {
    var K = (window.State && window.State.kpis) || {}, Pt = portfolioSchnitt(), ak = {};
    if (mitAnkauf) { try { var AK = window.DealPilotAnkauf; var ab = AK && AK.vorhanden && AK.vorhanden() ? AK.abweichung() : null; (ab && ab.zeilen || []).forEach(function (z) { ak[z.schluessel] = zahl(z.ankauf); }); } catch (e) {} }
    var cfAk = ak._kpis_cf_vs != null ? ak._kpis_cf_vs / 12 : null;
    /* v4280 · Marcel: „Ankauf, Bestand, Zielbild, dass wir da auch wirklich alles drin haben“. Zielbild aus DpPotenzial.kennzahlen
       (dieselbe Quelle wie die Tafel Ankauf · Bestand · Zielbild), nur lesen. Beleihung im Zielbild führt die App nicht. */
    var zb = {}; if (mitAnkauf) { try { var PZ = window.DpPotenzial, mo = PZ && PZ.modell ? PZ.modell() : null; if (mo && mo.aktiv && mo.stufen && mo.stufen.zielbild) zb = (PZ.kennzahlen(mo) || {}).zielbild || {}; } catch (e) { zb = {}; } }
    var B = [
      { name: 'Bruttomietrendite', wert: zahl(K.bmy), ziel: null, port: mitAnkauf ? null : Pt.bmy, ankauf: ak._kpis_bmy, zielbild: zahl(zb.bmy), lo: 0, hi: 9, fmt: function (v) { return pct(v, 2); }, hoch: true },
      { name: 'DSCR', wert: zahl(K.dscr), ziel: profil('min_dscr'), zielText: 'dein Mindest-DSCR', port: mitAnkauf ? null : Pt.dscr, ankauf: ak._kpis_dscr, zielbild: zahl(zb.dscr), lo: 0, hi: 1.8, fmt: function (v) { return nf2.format(v); }, hoch: true },
      { name: 'Beleihung (LTV)', wert: zahl(K.ltv), ziel: profil('max_ltv'), zielText: 'dein maximaler LTV', port: mitAnkauf ? null : Pt.ltv, ankauf: ak._kpis_ltv, lo: 0, hi: 120, fmt: function (v) { return pct(v); }, hoch: false },
      { name: 'Cashflow vor Steuer im Monat', wert: zahl(K.cf_m), ziel: profil('min_cashflow_vor_st'), zielText: 'dein Mindest-Cashflow', port: mitAnkauf ? null : Pt.cfm, ankauf: cfAk, zielbild: zahl(zb.cf_m), lo: -400, hi: 400, fmt: function (v) { return eurV(v); }, hoch: true }
    ].filter(function (b) { return b.wert != null; });
    /* v4310d · Marcel 24.11.2026 (über Fork AB): Kaufpreis gegen den maßgebenden Objektwert. NICHT neu gerechnet: State.wert_basis
       und State.wert_basis_text setzt calc.js (v4300, Einstellung dp_wert_anker: maßgebendes Verfahren oder Marktpreisindikation
       mit bzw. ohne Abschlag). Nur wenn der Wert nicht der Kaufpreis selbst ist. */
    if (mitAnkauf) { try {
      /* v4310e · gemessen Demostraße 5: State.wert_basis ist der auf den Projektionsbeginn zurückgerechnete Wert (126.186 € für 2024),
         der Bericht sagt 130.000 € (2026). Mit Bericht gilt dessen Wert zu seinem Jahr (State.wert_anker), sonst wert_basis. */
      var S0 = window.State || {}, kp0 = wert('kp'), A0 = S0.wert_anker && zahl(S0.wert_anker.wert) > 0 ? S0.wert_anker : null, ow = A0 ? Number(A0.wert) : zahl(S0.wert_basis);
      var artText = A0 ? ({ ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert', vergleichswert_m: 'Vergleichswert aus Angeboten', mpi_mit: 'Marktpreisindikation nach Abschlag', mpi_ohne: 'Marktpreisindikation ohne Abschlag' }[A0.art] || 'Objektwert') + ' laut Marktbericht' : null;
      if (kp0 > 0 && ow > 0 && S0.wert_basis_quelle && S0.wert_basis_quelle !== 'kaufpreis') {
        var d0 = ow - kp0;
        B.unshift({ name: 'Objektwert' + (A0 && A0.jahr ? ' ' + A0.jahr : ''), notiz: artText || S0.wert_basis_text || 'Objektwert', wert: ow, ziel: kp0, zielText: 'Kaufpreis', hoch: true, ohneSchwelle: true,
          lo: Math.min(ow, kp0) * 0.85, hi: Math.max(ow, kp0) * 1.15, fmt: function (v) { return eur(v); },
          wort: (d0 >= 0 ? '✓ ' : '✕ ') + eur(Math.abs(d0)) + (d0 >= 0 ? ' über' : ' unter') + ' Kaufpreis' });
      }
    } catch (e) {} }
    return { B: B, Pt: Pt };
  }

  /* ── Einbau in die Pilot-Analyse ───────────────────────────────────── */
  var _c = { sig: null };
  function cache(P, sig) { if (_c.sig !== sig) _c = { sig: sig }; return _c; }
  function zeitSatz(P) { return 'Bis ' + P.heute + ' Werte der App, danach Modell mit den Raten der App (Miete ' + pct(P.mstg * 100) + ', Kosten ' + pct(P.kstg * 100) + ', Wert ' + pct(P.wstg * 100) + ' im Jahr).'; }

  function karteEinordnung(k, w, mitAnkauf) {
    var D = einordnungDaten(mitAnkauf); if (!D.B.length) { k.innerHTML = ''; return; }
    var schlecht = D.B.filter(function (b) { return b.ziel != null && !b.ohneSchwelle && !(b.hoch ? b.wert >= b.ziel : b.wert <= b.ziel); }).map(function (b) { return b.name.replace(' im Monat', ''); });
    var titel = schlecht.length ? (schlecht.length === 1 ? schlecht[0] + ' unter deiner Schwelle' : schlecht.length + ' Kennzahlen unter deinen Schwellen: ' + schlecht.join(', ')) : 'Alle Kennzahlen innerhalb deiner Schwellen';
    var mitZb = D.B.some(function (b) { return b.zielbild != null; });
    var i = karte(k, { eyebrow: mitAnkauf ? 'Einordnung · Ankauf, heute' + (mitZb ? ', Zielbild' : '') : 'Einordnung', titel: titel, unter: 'Marke heute, goldener Strich deine Schwelle aus dem Investmentprofil' + (mitAnkauf ? ', Kreis beim Ankauf' + (mitZb ? ', Raute im Zielbild' : '') : (D.Pt.n ? ', Dreieck der Schnitt deiner ' + D.Pt.n + ' Objekte' : '')) + '.', chips: ['gemessen'] });
    bullets(i, D.B, { breite: w - 2 });
  }
  /* v4310 · Marcel 24.11.2026: „die Zielerreichung genauso anlegen wie oben die Einordnung Ankauf, heute, Zielbild,
     auch das Farbschema“. Daten aus DpJahresstaende.zielerreichung() (jahresstaende.js rechnet, hier nur Darstellung):
     je Hebel Ankauf (Kreis), heute (Marke), Ziel (goldener Strich), Band rot bis zum Ziel, grün dahinter.
     Marke grün = Ziel erreicht, Tinte = mindestens halb, rot = unter der Hälfte. Ersetzt die blauen Balken (.dp-pa5-ziel). */
  function zielDaten() {
    var z = null; try { z = window.DpJahresstaende && window.DpJahresstaende.zielerreichung ? window.DpJahresstaende.zielerreichung() : null; } catch (e) { z = null; }
    if (!z || !Array.isArray(z.hebel)) return null;
    var B = z.hebel.filter(function (h) { return zahl(h.pct) != null && zahl(h.heute) != null && zahl(h.ziel) != null; }).map(function (h) {
      var a = zahl(h.ankauf), hh = Number(h.heute), zi = Number(h.ziel), hoch = a == null ? true : zi >= a;
      var vals = [hh, zi].concat(a != null ? [a] : []), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var pad = (hi - lo) * 0.14 || Math.abs(hi) * 0.1 || 1, p = Math.round(Number(h.pct)), erreicht = hoch ? hh >= zi : hh <= zi;
      var fmt = h.einheit === 'eur_m' ? function (v) { return eur(v) + ' im Monat'; } : h.einheit === 'pct' ? function (v) { return pct(v, 2); } : function (v) { return eur(v); };
      return { name: String(h.wort || '').replace(/ \(Cashflow v\. St\. (\d{4})?\)/, ' (Cashflow vor Steuer)'), wert: hh, ankauf: a, ziel: zi, zielText: 'Ziel', hoch: hoch, lo: lo - pad, hi: hi + pad, fmt: fmt,
        farbe: erreicht ? F.gruen : (p >= 50 ? F.tinte : F.rot), wort: erreicht ? '✓ erreicht' : Math.max(0, p) + ' % erreicht', notiz: h.zaehlt === false ? 'nicht in der Gesamtzahl' : '' };
    });
    return B.length ? { B: B, gesamt: zahl(z.gesamt), ampel: z.ampel && z.ampel.wort ? z.ampel.wort : '', woraus: z.woraus || [] } : null;
  }
  function karteZiel(k, w) {
    var D = zielDaten(); if (!D) { k.innerHTML = ''; return; }
    var offen = D.B.filter(function (b) { return !/erreicht$/.test(b.wort) || /%/.test(b.wort); });
    var titel = D.gesamt != null ? 'Gesamt ' + Math.round(D.gesamt) + ' % deiner Ziele erreicht' + (D.woraus.length ? ', aus ' + D.woraus.length + (D.woraus.length === 1 ? ' Hebel' : ' Hebeln') : '') : (offen.length ? offen.length + ' von ' + D.B.length + ' Zielen noch offen' : 'Alle Ziele erreicht');
    var i = karte(k, { eyebrow: 'Zielerreichung · Ankauf, heute, Ziel', titel: titel, unter: 'Marke heute, Kreis beim Ankauf, goldener Strich dein Ziel. Rot bis zum Ziel, grün dahinter. Die Prozentzahl sagt, wie viel vom Weg zwischen Ankauf und Ziel geschafft ist.', chips: ['gemessen'] });
    bullets(i, D.B, { breite: w - 2, zielName: 'Ziel' });
  }
  /* v4350 · der Score, den die Bewertung zeigt (dpsh-score-hero.js realRenderAll): Investor Deal Score, wenn der Plan ihn
     voll führt UND die Datentiefe die Schwelle erreicht; voller Plan unter der Schwelle: „noch nicht belastbar“ (v4320);
     sonst der DealPilot Score. Vorher stand in der Mitte immer der DealPilot Score (Demostraße 29), die Seitenleiste 61. */
  function gewaehlterScore() {
    var dp = null; try { dp = window.DealScore && window.DealScore.compute ? window.DealScore.compute() : null; } catch (e) { dp = null; }
    var klassisch = dp && dp.score != null ? { score: zahl(dp.score), name: 'DealScore', art: 'dp' } : null;
    var voll = false; try { voll = !!(window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.hasFullFeature && DealPilotConfig.pricing.hasFullFeature('deal_score_v2')); } catch (e) { voll = false; }
    if (!voll || !window.DealScore2 || typeof window.DealScore2.compute !== 'function' || typeof window._buildDeal2FromState !== 'function') return klassisch;
    var r2 = null, comp = null;
    try { var deal = window._buildDeal2FromState(); r2 = window.DealScore2.compute(deal); comp = window.DealScore2.getKpiCompleteness ? window.DealScore2.getKpiCompleteness(deal) : null; } catch (e) { r2 = null; }
    if (!r2 || r2.score == null) return klassisch;
    var schw = 0.70; try { if (typeof window._dpDs2Schwelle === 'function') schw = window._dpDs2Schwelle(); } catch (e) {}
    if (!comp || !(comp.percent >= schw * 100)) return { score: null, name: 'Investor Deal Score', art: 'ids', unterSchwelle: true, ist: comp ? comp.percent : null, soll: Math.round(schw * 100) };
    return { score: zahl(r2.score), name: 'Investor Deal Score', art: 'ids' };
  }
  function karteFingerabdruck(k, w) {
    var sc = gewaehlterScore();
    var K = (window.State && window.State.kpis) || {}, Pt = portfolioSchnitt();
    var A = [
      { n: 'Bruttorendite', o: zahl(K.bmy), p: Pt.bmy, lo: 3, hi: 8, f: function (v) { return pct(v, 2); } },
      { n: 'DSCR', o: zahl(K.dscr), p: Pt.dscr, lo: 0.6, hi: 1.6, f: function (v) { return nf2.format(v); } },
      { n: 'Beleihung', o: zahl(K.ltv), p: Pt.ltv, lo: 110, hi: 50, f: function (v) { return pct(v); } },
      { n: 'Cashflow', o: zahl(K.cf_m), p: Pt.cfm, lo: -300, hi: 300, f: function (v) { return eurV(v) + ' im Monat'; } },
      { n: sc && sc.art === 'ids' ? 'Investor Score' : 'DealScore', o: sc && sc.score != null ? sc.score : null, p: sc && sc.art === 'ids' ? Pt.ids : Pt.score, lo: 0, hi: 100, f: function (v) { return nf0.format(v); } }
    ].filter(function (a) { return a.o != null; });
    if (A.length < 3) { k.innerHTML = ''; return; }
    var wort = ''; try { wort = sc && sc.unterSchwelle ? 'noch nicht belastbar' : (window.ScoreTier && sc && sc.score != null ? window.ScoreTier.stufe(sc.score).wort : ''); } catch (e) { wort = ''; }
    var besser = A.filter(function (a) { if (a.p == null) return false; return a.hi > a.lo ? a.o > a.p : a.o < a.p; }).length, mitP = A.filter(function (a) { return a.p != null; }).length;
    var i = karte(k, { eyebrow: 'Score-Fingerabdruck', titel: mitP ? 'In ' + besser + ' von ' + mitP + ' Achsen besser als dein Portfolio-Schnitt' : 'Das Profil dieses Objekts', unter: 'Weiter außen ist besser. Gold dieses Objekt, Creme der Schnitt deiner Objekte.', chips: ['gemessen'] });
    fingerabdruck(i, { achsen: A, mitte: sc && sc.score != null ? nf0.format(sc.score) : null, mitteText: wort ? String(wort).toUpperCase() : '', n: Pt.n }, { breite: w - 2 });
  }
  function karteHeat(k, w, P, C, kompakt) {
    C.heat = C.heat || MODELL.heat(P); var Hm = C.heat; if (!Hm) { k.innerHTML = ''; return; }
    var basisV = Hm.G[Hm.ri][Hm.ci], kipp = null; Hm.Z.forEach(function (z, c) { if (kipp == null && Hm.G[Hm.ri][c] != null && Hm.G[Hm.ri][c] < 0) kipp = z; });
    var titel = basisV < 0 ? 'Nach der Zinsbindung fehlen im Basisfall ' + eur(-basisV) + ' im Monat' : (kipp != null ? 'Ab ' + pct(kipp) + ' Anschlusszins wird der Cashflow ' + Hm.jahr + ' negativ' : 'Der Cashflow ' + Hm.jahr + ' bleibt in allen Zinsfällen positiv');
    var i = karte(k, { eyebrow: 'Anschlussfinanzierung · Zins × Miete', titel: titel, unter: 'Cashflow nach Steuer im Monat ' + Hm.jahr + ', dem ersten vollen Jahr nach der Zinsbindung. Spalten Anschlusszins, Zeilen Miete gegen die Projektion.', chips: ['Modell'],
      fuss: ['Rahmen: Basisfall mit ' + pct(P.az * 100, 2) + ' Anschlusszins und ' + pct(P.at * 100, 2) + ' Tilgung' + (P.azQuelle === 'App' ? ', so wie die App nach der Zinsbindung rechnet.' : ' aus deiner Eingabe.'), 'Steuer mit deinem Grenzsteuersatz ' + pct(P.grenz * 100) + '.', 'Modell, keine Zusage einer Bank.'] });
    heatmap(i, { spalten: Hm.Z, zeilen: Hm.M, werte: Hm.G, basis: { z: Hm.ri, s: Hm.ci }, spaltenTitel: 'Anschlusszins', einheit: ' im Monat',
      spaltenText: function (z, cw) { return nf1.format(z) + (cw < 46 ? '' : ' %'); }, zeilenText: function (m) { return (m > 0 ? '+' : m < 0 ? '−' : '±') + Math.abs(m) + ' %'; },
      zelleText: function (m, z, v) { return '<div class="t">Zins ' + pct(z) + ' · Miete ' + (m > 0 ? '+' : m < 0 ? '−' : '±') + Math.abs(m) + ' %</div>Cashflow nach Steuer ' + Hm.jahr + ' <b>' + eurV(v) + '</b> im Monat'; } }, { breite: w - 2, kompakt: kompakt });
  }
  /* Mieteuro des laufenden Jahres: Zufluss = Abfluss (Rest als Sonstiges, Prüfer) */
  function mieteuro(P) {
    var r = P.J.filter(function (x) { return x.j === P.heute; })[0] || P.J[0];
    var erst = r.steuer < 0 ? -r.steuer : 0, zahlt = r.steuer > 0 ? r.steuer : 0, tasche = r.cfns < 0 ? -r.cfns : 0, frei = r.cfns > 0 ? r.cfns : 0;
    /* v4310 · Marcel 24.11.2026: Farbschema wie Bewertung. Kräftig = Tinte, Grün, Rot (weiße Schrift); blass = 30 % davon (dunkle Schrift) */
    var ein = [{ n: 'Kaltmiete', v: r.nkm, f: F.tinte }, { n: 'Steuererstattung', v: erst, f: F.gruenW, hell: true }, { n: 'Aus eigener Tasche', v: tasche, f: F.rot }];
    var aus = [{ n: 'Zins an die Bank', v: r.zins, f: 'color-mix(in srgb,' + F.tinte + ' 16%,transparent)', hell: true }, { n: 'Tilgung = Vermögen', v: r.tilg, f: F.gruen }, { n: 'Nicht umlegbare Kosten', v: r.bwk, f: F.rotW, hell: true }, { n: 'Steuer', v: zahlt, f: F.rot }, { n: 'Bleibt dir', v: frei, f: F.gruenW, hell: true }];
    var sE = ein.reduce(function (s, a) { return s + a.v; }, 0), sA = aus.reduce(function (s, a) { return s + a.v; }, 0), rest = sE - sA;
    if (rest >= 1) aus.push({ n: 'Sonstiges', v: rest, f: F.neutral, hell: true }); else if (rest <= -1) ein.push({ n: 'Sonstiges', v: -rest, f: F.neutral, hell: true });
    return { r: r, ein: ein, aus: aus, tasche: tasche, frei: frei };
  }
  /* v4250 · Marcel 23.11.2026: „den Fluss des Mieteuros vielleicht anders angeben“. Statt Sankey zwei gleich lange Balken
     (woher, wohin) auf derselben Skala, darunter „Von 100 € Miete gehen …“. Dieselben Zahlen wie mieteuro() (Rechnung der App). */
  function karteMieteuro(k, w, P) {
    var D = mieteuro(P), r = D.r, nkm = r.nkm || 0;
    var ein = D.ein.filter(function (a) { return a.v > 0.5; }), aus = D.aus.filter(function (a) { return a.v > 0.5; });
    var sE = ein.reduce(function (s2, a) { return s2 + a.v; }, 0), sA = aus.reduce(function (s2, a) { return s2 + a.v; }, 0), sum = Math.max(sE, sA) || 1;
    var titel = D.tasche > 0.5 ? r.j + ': ' + eur(D.tasche) + ' legst du selbst dazu, ' + eur(r.tilg) + ' davon werden Vermögen' : r.j + ': ' + eur(D.frei) + ' bleiben dir nach Steuer, ' + eur(r.tilg) + ' werden Vermögen';
    var i = karte(k, { eyebrow: 'Wohin die Miete ' + r.j + ' geht', titel: titel, unter: 'Oben woher das Geld kommt, unten wohin es fließt. Beide Balken sind gleich lang, € im Jahr aus der Rechnung der App.', chips: ['gemessen'] });
    var bahn = function (L) {
      return '<div class="gx-mb-bahn">' + L.map(function (a, q) {
        var pr = a.v / sum * 100, je100 = nkm > 0 ? Math.round(a.v / nkm * 100) : null;
        return '<div class="gx-mb-seg gx-wx" style="width:' + pr.toFixed(2) + '%;background:' + a.f + ';color:' + (a.hell ? F.tinte : '#FDFCFA') + ';animation-delay:' + (q * 80) + 'ms"' + tipA('<div class="t">' + esc(a.n) + '</div><b>' + eur(a.v) + '</b> im Jahr' + (je100 != null ? '<br>' + je100 + ' € je 100 € Miete' : '')) + '>'
          + (pr >= 9 ? '<span>' + esc(a.n) + '</span><b>' + eur(a.v) + '</b>' : (pr >= 4 ? '<b>' + eur(a.v) + '</b>' : '')) + '</div>';
      }).join('') + '</div>';
    };
    var wort = function (n) { return { 'Zins an die Bank': 'Zinsen', 'Tilgung = Vermögen': 'die Tilgung', 'Nicht umlegbare Kosten': 'nicht umlegbare Kosten', 'Steuer': 'die Steuer' }[n] || n; };
    var satz = nkm > 0 ? 'Von 100 € Miete gehen ' + D.aus.filter(function (a) { return a.v > 0.5 && a.n !== 'Bleibt dir'; }).map(function (a) { return Math.round(a.v / nkm * 100) + ' € an ' + wort(a.n); }).join(', ') + '.'
      + (D.frei > 0.5 ? ' Dir bleiben ' + Math.round(D.frei / nkm * 100) + ' €.' : '') + (D.tasche > 0.5 ? ' Dazu legst du ' + Math.round(D.tasche / nkm * 100) + ' € je 100 € Miete selbst drauf.' : '') : '';
    i.innerHTML = '<div class="gx-mb"><div class="gx-mb-z"><div class="gx-mb-l"><b>Woher</b><small>' + eur(sE) + '</small></div>' + bahn(ein) + '</div><div class="gx-mb-z"><div class="gx-mb-l"><b>Wohin</b><small>' + eur(sA) + '</small></div>' + bahn(aus) + '</div></div>'
      + legende(ein.concat(aus).map(function (a) { return { n: a.n + ' ' + eur(a.v), f: a.f }; }))
      + (satz ? '<div class="gx-s" style="margin:10px 0 0!important">' + esc(satz) + '</div>' : '');
    return i;
  }
  function karteSankey(k, w, P) {
    var D = mieteuro(P), r = D.r, ein = D.ein, aus = D.aus, tasche = D.tasche, frei = D.frei;
    var titel = tasche > 0.5 ? r.j + ': ' + eur(tasche) + ' legst du selbst dazu, ' + eur(r.tilg) + ' davon werden Vermögen' : r.j + ': ' + eur(frei) + ' bleiben dir nach Steuer, ' + eur(r.tilg) + ' werden Vermögen';
    var i = karte(k, { eyebrow: 'Fluss des Mieteuros ' + r.j, titel: titel, unter: 'Woher das Geld kommt und wohin es fließt, € im Jahr aus der Rechnung der App.', chips: ['gemessen'] });
    return sankey(i, { ein: ein, aus: aus }, { breite: w - 2 });
  }
  function karteFahrplan(k, w, P, C) {
    C.basis = C.basis || MODELL.rechne(P, {}); var sz = C.basis;
    var M = MODELL.meilensteine(P, sz);
    var i = karte(k, { eyebrow: 'Fahrplan ' + P.J[0].j + ' bis ' + P.bis, titel: 'Was bis ' + P.bis + ' auf dich zukommt', unter: 'Oben die Beleihung (Restschuld durch Wert), unten die Meilensteine bis zum Ende der Zinsbindung und darüber hinaus. Fahr über einen Punkt für Einzelheiten.', chips: ['Modell'], fuss: [zeitSatz(P)] });
    var ziel = document.createElement('div'); i.appendChild(ziel);
    fahrplan(ziel, { von: P.J[0].j, bis: P.bis, heute: P.heute, linieText: 'LTV',
      linie: sz.rows.filter(function (r) { return r.wert > 0; }).map(function (r) { return { j: r.j, v: r.rs / r.wert * 100, tip: '<div class="t">' + r.j + (r.quelle === 'modell' ? ' · Modell' : '') + '</div>Beleihung <b>' + pct(r.rs / r.wert * 100) + '</b><br>Restschuld <b>' + eur(r.rs) + '</b> · Wert <b>' + eur(r.wert) + '</b>' }; }),
      marken: M }, { breite: w - 2 });
    /* v4280 · Werte von … bis …: heute, Ende Zinsbindung, Ende Horizont */
    var an = function (j) { return sz.rows.filter(function (r) { return r.j === j; })[0]; };
    var zelle = function (r, t) { return r && r.wert > 0 ? '<div><span>' + esc(t) + '</span><b>' + pct(r.rs / r.wert * 100) + '</b><small>Restschuld ' + tsd(r.rs) + ', Wert ' + tsd(r.wert) + '</small></div>' : ''; };
    var sx = document.createElement('div'); sx.className = 'gx-seite';
    sx.innerHTML = zelle(an(P.heute), 'Heute ' + P.heute) + (P.bindEnde > P.heute ? zelle(an(P.bindEnde - 1), 'Ende Zinsbindung ' + P.bindEnde) : '') + zelle(an(P.bis), 'Ende ' + P.bis);
    i.appendChild(sx);
  }
  function karteFaecher(k, w, P, C) {
    C.mc = C.mc || MODELL.monteCarlo(P, 500); var MC = C.mc;
    C.basis = C.basis || MODELL.rechne(P, {});
    var ist = [], kum = 0; C.basis.rows.forEach(function (r) { kum += r.cfns; if (r.j <= P.heute) ist.push({ j: r.j, v: r.wert - r.rs + kum }); });
    var X = []; for (var j = P.J[0].j; j <= P.bis; j++) X.push(j);
    var idx = function (jj) { return jj - P.heute; };
    var L = MC.jahre.length - 1, ersteJ = null; MC.jahre.forEach(function (jj, i) { if (ersteJ == null && jj > P.heute && MC.pPos[i] >= 50) ersteJ = jj; });
    /* v4280 · Marcel: „Vermögen in 500 Zukünften verstehe ich nicht“. Klartext und zwei Zeitpunkte: Ende der Zinsbindung und Ende des Horizonts. */
    var iB = P.bindEnde - 1 - P.heute, hatB = iB > 0 && iB < L;
    var i = karte(k, { eyebrow: 'Spanne möglicher Verläufe', titel: (hatB ? 'Bei Ende der Zinsbindung ' + P.bindEnde + ' zwischen ' + tsd(MC.p10[iB]) + ' und ' + tsd(MC.p90[iB]) + ', ' : '') + P.bis + ' zwischen ' + tsd(MC.p10[L]) + ' und ' + tsd(MC.p90[L]) + ', mittlerer Verlauf ' + tsd(MC.p50[L]),
      unter: 'DealPilot spielt ' + MC.N + ' mögliche Entwicklungen von Miete, Kosten, Wert und Anschlusszins durch. Das Band zeigt, wo 8 von 10 davon landen, die Linie den mittleren Verlauf, die Punkte die Jahre bis heute. Vermögen heißt Wert minus Restschuld plus aufsummierter Cashflow nach Steuer.', chips: ['Modell'],
      fuss: ['Je Jahr: Miete ' + pct(P.mstg * 100) + ' ± 1,0, Kosten ' + pct(P.kstg * 100) + ' ± 0,6, Wert ' + pct(P.wstg * 100) + ' mit Marktzyklen, in 4 % der Jahre zwei Monate Leerstand.', 'Anschlusszins im Mittel ' + pct(P.az * 100, 2) + ', 80 % zwischen ' + pct(MC.zP10 * 100, 2) + ' und ' + pct(MC.zP90 * 100, 2) + '.', MC.N + ' Pfade, fester Startwert. Modell, keine Prognose und keine Zusage.'] });
    var ziel = document.createElement('div'); i.appendChild(ziel);
    verlauf(ziel, { x: X, heute: P.heute,
      band: { farbe: 'color-mix(in srgb,' + F.gruen + ' 16%,transparent)', lo: X.map(function (jj) { var q = idx(jj); return q >= 0 ? MC.p10[q] : null; }), hi: X.map(function (jj) { var q = idx(jj); return q >= 0 ? MC.p90[q] : null; }) },   /* v4310 · Band grün wie die Eigenkapital-Fläche im Reiter Bewertung */
      marken: hatB ? [{ j: P.bindEnde, text: 'Ende Zinsbindung', farbe: F.goldD }] : [],
      reihen: [{ name: 'Mitte', werte: X.map(function (jj) { var q = idx(jj); return q >= 0 ? MC.p50[q] : null; }), farbe: F.gold, dick: 2.4 }, { name: 'bisher', werte: X.map(function (jj) { var p = ist.filter(function (x) { return x.j === jj; })[0]; return p ? p.v : null; }), farbe: F.tinte, dick: 2, punkte: true }],
      tip: function (q, jj) { var m = idx(jj); var p = ist.filter(function (x) { return x.j === jj; })[0]; return p && jj <= P.heute && m < 1 ? '<div class="t">' + jj + ' · App</div>Vermögen aus dem Objekt <b>' + eur(p.v) + '</b>' : (m >= 0 ? '<div class="t">' + jj + ' · Modell</div>Mitte <b>' + eur(MC.p50[m]) + '</b><br>80 % zwischen <b>' + eur(MC.p10[m]) + '</b> und <b>' + eur(MC.p90[m]) + '</b><br>Cashflow positiv in <b>' + nf0.format(MC.pPos[m]) + ' %</b> der Fälle' : '<div class="t">' + jj + '</div>' + (p ? 'Vermögen <b>' + eur(p.v) + '</b>' : '')); },
      legende: [{ n: 'mittlerer Verlauf', f: F.gold }, { n: '8 von 10 Verläufen', f: 'color-mix(in srgb,' + F.gruen + ' 16%,transparent)' }, { n: 'bis heute', f: F.tinte }] }, { breite: w - 2, aria: 'Spanne möglicher Verläufe des Vermögens' });
    var s = document.createElement('div'); s.className = 'gx-seite';
    var i10 = Math.min(L, 10);
    s.innerHTML = (hatB ? '<div><span>Ende Zinsbindung ' + P.bindEnde + '</span><b>' + tsd(MC.p50[iB]) + '</b><small>mittlerer Verlauf, Spanne ' + tsd(MC.p10[iB]) + ' bis ' + tsd(MC.p90[iB]) + '</small></div>' : '')
      + '<div><span>Ende ' + P.bis + '</span><b>' + tsd(MC.p50[L]) + '</b><small>mittlerer Verlauf, Spanne ' + tsd(MC.p10[L]) + ' bis ' + tsd(MC.p90[L]) + '</small></div>'
      + '<div><span>Cashflow im Plus</span><b>' + (ersteJ || 'nach ' + P.bis) + '</b><small>ab hier in mehr als der Hälfte der Verläufe, nach Steuer</small></div>'
      + '<div><span>Eingesetzt</span><b>' + tsd(P.ek) + '</b><small>Eigenkapital beim Kauf</small></div>';
    i.appendChild(s);
  }
  function karteHebel(k, w, P, C) {
    var exitJ = Math.min(P.bis, Math.max(P.heute + 5, P.kaufJ + 20));
    C.hebel = C.hebel || MODELL.hebel(P, exitJ); var T = C.hebel;
    if (!T || !T.T.length) { var i0 = karte(k, { eyebrow: 'Hebel', titel: 'Ohne Eigenkapital gibt es keine Eigenkapitalrendite', unter: 'Trag das Eigenkapital im Reiter Finanzierung ein, dann zeigt DealPilot, welcher Hebel die Rendite bewegt.' }); i0.innerHTML = ''; return; }
    var i = karte(k, { eyebrow: 'Hebel · Verkauf Ende ' + T.exitJ, titel: T.T[0].n.replace(/ ±.*| 1 Monat.*/, '') + ' bewegt deine Rendite am stärksten: ' + nf1.format(T.T[0].span) + ' Punkte Spanne', unter: 'Eigenkapitalrendite (IRR) im Jahr, wenn sich ein Hebel ändert und alles andere bleibt.', chips: ['Modell'], fuss: ['Basis ' + pct(T.basis) + ' bei Verkauf Ende ' + T.exitJ + ', Verkaufskosten 3 % (Beispiel).', zeitSatz(P)] });
    tornado(i, { basis: T.basis, T: T.T, fmt: function (v) { return pct(v); } }, { breite: w - 2 });
  }
  function karteAusstieg(k, w, P, C) {
    C.basis = C.basis || MODELL.rechne(P, {});
    if (!C.aus) { var D = []; for (var j = Math.max(P.heute + 1, P.kaufJ + 1); j <= P.bis; j++) { var r = MODELL.irr(P, C.basis, j); D.push({ j: j, irr: r ? r.irr : null, mult: r ? r.mult : null, frei: r ? r.frei : false }); } C.aus = D; }
    var D2 = C.aus.filter(function (d) { return d.irr != null; }); if (D2.length < 2) { k.innerHTML = ''; return; }
    var fa = P.privat ? P.kaufJ + 10 : null, vor = fa ? D2.filter(function (d) { return d.j === fa - 1; })[0] : null, nach = fa ? D2.filter(function (d) { return d.j === fa; })[0] : null;
    var best = D2.reduce(function (a, b) { return b.irr > a.irr ? b : a; });
    var titel = vor && nach && nach.irr > vor.irr ? 'Ein Jahr Geduld lohnt: Verkauf ' + fa + ' statt ' + (fa - 1) + ' hebt die Rendite von ' + pct(vor.irr) + ' auf ' + pct(nach.irr) : 'Bestes Verkaufsjahr im Modell: ' + best.j + ' mit ' + pct(best.irr) + ' im Jahr';
    var i = karte(k, { eyebrow: 'Rendite je Verkaufsjahr', titel: titel, unter: 'Eigenkapitalrendite (IRR) im Jahr bei Verkauf am Jahresende' + (fa ? ', bis ' + String(P.kaufM).padStart(2, '0') + '/' + fa + ' ist der Gewinn steuerpflichtig' : '') + '.', chips: ['Modell'], fuss: ['Verkaufspreis = Wert der Projektion, Verkaufskosten 3 % (Beispiel).', P.privat ? 'Steuer auf den Gewinn vor Ablauf von zehn Jahren mit deinem Grenzsteuersatz.' : 'Gesellschaft: kein steuerfreier Verkauf nach zehn Jahren.', 'Modell, keine Zusage.'] });
    ausstieg(i, { punkte: D2, freiAb: fa, freiText: fa ? 'STEUERFREI AB ' + String(P.kaufM).padStart(2, '0') + '/' + fa : '' }, { breite: w - 2 });
  }
  /* v4280 · Marcel: „Break-even einzeichnen, wann wir tatsächlich Steuern bezahlen müssen“. Gelesen aus der App: das erste Jahr ab
     heute, in dem die Steuer der Zeile (tax_y) über null liegt, weil das Ergebnis aus Vermietung (zve_y) positiv wird. Die App
     verrechnet einen Verlust im selben Jahr mit dem übrigen Einkommen (kein Verlustvortrag), deshalb genau dieses Jahr.
     Dazu Marken Ende der Zinsbindung und Ende der Projektion mit den Werten an beiden. */
  function steuerBreakEven(P) {
    var J = P.J, r = J.filter(function (x) { return x.j >= P.heute && x.steuer > 0.5 && x.vuv > 0; })[0];
    return r ? { j: r.j, vuv: r.vuv, steuer: r.steuer } : null;
  }
  function karteVerlaufSteuer(k, w, P) {
    var J = P.J, X = J.map(function (r) { return r.j; }), nach = J.filter(function (r) { return r.j > P.heute && r.cfns > 0; })[0], vor = J.filter(function (r) { return r.j > P.heute && r.cfop > 0; })[0];
    var be = steuerBreakEven(P), ende = J[J.length - 1], zb = J.filter(function (r) { return r.j === P.bindEnde; })[0];
    var titel = be ? 'Ab ' + be.j + ' zahlst du Steuer auf das Objekt' + (nach ? ', nach Steuer im Plus ab ' + nach.j : '') : (nach ? 'Nach Steuer im Plus ab ' + nach.j + (vor && vor.j !== nach.j ? ', vor Steuer ab ' + vor.j : '') : 'In den nächsten Jahren hilft die Steuer, den Cashflow zu tragen');
    var unter = (be ? 'Bis ' + (be.j - 1) + ' ist das Ergebnis aus Vermietung negativ und senkt deine Steuer auf das übrige Einkommen. ' + be.j + ' wird es positiv (' + eurV(be.vuv) + '), darauf fallen ' + eur(be.steuer) + ' Steuer an. ' : '')
      + 'Cashflow im Jahr vor und nach Steuer, die Lücke dazwischen ist deine Steuerwirkung. Rechts von ' + P.heute + ' Projektion der App.';
    var i = karte(k, { eyebrow: 'Verlauf mit Steuern', titel: titel, unter: unter, chips: ['gemessen'] });
    var ziel = document.createElement('div'); i.appendChild(ziel);
    var marken = [];
    if (be) marken.push({ j: be.j, text: 'ab hier Steuer', farbe: F.rot, zeile: 0 });
    if (nach && (!be || nach.j !== be.j)) marken.push({ j: nach.j, text: 'nach Steuer im Plus', farbe: F.gruen, zeile: 1 });
    if (zb && P.bindEnde > P.heute) marken.push({ j: P.bindEnde, text: 'Ende Zinsbindung', farbe: F.goldD, zeile: 2 });
    verlauf(ziel, { x: X, heute: P.heute,
      /* v4310 · Marcel 24.11.2026: Farbschema wie Bewertung. Steuerwirkung grün, wo die Steuer Geld bringt, rot, wo sie Geld kostet */
      baender: [{ ohneRand: true, farbe: 'color-mix(in srgb,' + F.gruen + ' 16%,transparent)', lo: J.map(function (r) { return r.cfns >= r.cfop ? r.cfop : null; }), hi: J.map(function (r) { return r.cfns >= r.cfop ? r.cfns : null; }) },
        { ohneRand: true, farbe: 'color-mix(in srgb,' + F.rot + ' 18%,transparent)', lo: J.map(function (r) { return r.cfns < r.cfop ? r.cfns : null; }), hi: J.map(function (r) { return r.cfns < r.cfop ? r.cfop : null; }) }],
      reihen: [{ name: 'vor Steuer', werte: J.map(function (r) { return r.cfop; }), farbe: F.tinte3, dick: 2, gestrichelt: true }, { name: 'nach Steuer', werte: J.map(function (r) { return r.cfns; }), farbe: F.tinte, dick: 2.6, punkte: true }],
      marken: marken,
      tip: function (q, j) { var r = J[q]; return '<div class="t">' + j + (j > P.heute ? ' · Projektion' : '') + '</div>Ergebnis aus Vermietung <b>' + eurV(r.vuv) + '</b><br>vor Steuer <b>' + eurV(r.cfop) + '</b><br>Steuer <b>' + eurV(r.cfns - r.cfop) + '</b><br>nach Steuer <b>' + eurV(r.cfns) + '</b>'; },
      legende: [{ n: 'vor Steuer', f: F.tinte3 }, { n: 'nach Steuer', f: F.tinte }, { n: 'Steuer bringt Geld', f: 'color-mix(in srgb,' + F.gruen + ' 16%,transparent)' }, { n: 'Steuer kostet Geld', f: 'color-mix(in srgb,' + F.rot + ' 18%,transparent)' }].concat(be ? [{ n: 'ab hier Steuer', f: F.rot }] : []) }, { breite: w - 2, aria: 'Cashflow vor und nach Steuer' });
    /* Werte an Ende Zinsbindung und Ende der Projektion */
    var zelle = function (r, t) { return r ? '<div><span>' + esc(t) + '</span><b>' + eurV(r.cfns) + '</b><small>nach Steuer, vor Steuer ' + eurV(r.cfop) + '</small></div>' : ''; };
    var sx = document.createElement('div'); sx.className = 'gx-seite';
    sx.innerHTML = (be ? '<div><span>Steuer ab</span><b>' + be.j + '</b><small>Ergebnis aus Vermietung ' + eurV(be.vuv) + '</small></div>' : '')
      + zelle(J.filter(function (r) { return r.j === P.heute; })[0], 'Heute ' + P.heute)
      + (zb && P.bindEnde > P.heute ? zelle(zb, 'Ende Zinsbindung ' + P.bindEnde) : '')
      + zelle(ende, 'Ende ' + ende.j);
    i.appendChild(sx);
  }
  function karteHausgeld(k, w, P) {
    var Hv = window.DpHausverlauf; if (!Hv || !Hv.lesen || !Hv.jahrDaten) { k.innerHTML = ''; return; }
    var L = null; try { L = Hv.lesen(); } catch (e) { L = null; } if (!L) { k.innerHTML = ''; return; }
    var X = [], ist = [], plan = [], rl = [];
    for (var j = P.kaufJ; j <= P.heute; j++) { var d = null; try { d = Hv.jahrDaten(j, L); } catch (e) { d = null; } if (!d) continue; var a = zahl(d.hausgeld_ist_jahr), p = zahl(d.hausgeld_plan_monat); if (a == null && p == null) continue; X.push(j); ist.push(a); plan.push(p != null ? p * 12 : null); rl.push(zahl(d.ruecklage_stand)); }
    if (X.length < 2) { k.innerHTML = ''; return 'leer'; }
    var i = karte(k, { eyebrow: 'Hausgeld je Jahr', titel: 'Hausgeld ' + X[0] + ' bis ' + X[X.length - 1] + ': Abrechnung gegen Wirtschaftsplan', unter: 'Aus deinen Hausunterlagen. Maßgeblich ist die Abrechnung, der Wirtschaftsplan dient zur Plausibilität.', chips: ['gemessen'] });
    var ziel = document.createElement('div'); i.appendChild(ziel);
    verlauf(ziel, { x: X, reihen: [{ name: 'Abrechnung', werte: ist, farbe: F.tinte, dick: 2.4, punkte: true }, { name: 'Wirtschaftsplan', werte: plan, farbe: F.tinte3, gestrichelt: true }].concat(rl.some(function (v) { return v != null; }) ? [{ name: 'Rücklage', werte: rl, farbe: F.gruen, dick: 1.8 }] : []),   /* v4310 · Tinte und Grün wie Bewertung */
      tip: function (q, j) { return '<div class="t">' + j + '</div>Abrechnung <b>' + eur(ist[q]) + '</b><br>Wirtschaftsplan <b>' + eur(plan[q]) + '</b>' + (rl[q] != null ? '<br>Rücklage <b>' + eur(rl[q]) + '</b>' : ''); },
      legende: [{ n: 'Abrechnung', f: F.tinte }, { n: 'Wirtschaftsplan', f: F.tinte3 }].concat(rl.some(function (v) { return v != null; }) ? [{ n: 'Rücklage', f: F.gruen }] : []) }, { breite: w - 2, hoehe: 220 });
  }

  /* ── Wert & Lage: Berichte aus dem Wertverlauf der Pilot-Analyse (DpPilotV4.wertverlauf(hist)) ── */
  var _hist = [];
  function haken() {
    var V = window.DpPilotV4; if (!V || typeof V.wertverlauf !== 'function' || V.wertverlauf._gp) return;
    var orig = V.wertverlauf;
    V.wertverlauf = function () {
      try { _hist = Array.isArray(arguments[0]) ? arguments[0] : []; } catch (e) {}
      var r = orig.apply(this, arguments);
      try { if (window.DpGrafikenNeu && window.DpGrafikenNeu.an()) setTimeout(function () { window.DpGrafikenNeu.neu(); }, 60); } catch (e) {}
      return r;
    };
    V.wertverlauf._gp = true;
  }
  haken();
  function nachAbschlag(h) { return zahl(h.mpi_nach_abschlag) != null ? Number(h.mpi_nach_abschlag) : (zahl(h.market_value) != null ? Number(h.market_value) : null); }
  function berichtJahr(h) { var d = new Date(h.created_at); return isNaN(d) ? null : d.getFullYear(); }
  function datumDe(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('de-DE'); }
  function karteWertverlauf(k, w, P) {
    var H0 = _hist || [], R = P.J, bj = H0.map(berichtJahr).filter(Boolean), bisJ = Math.max(P.heute + 5, bj.length ? Math.max.apply(null, bj) : P.heute);
    var J = R.filter(function (r) { return r.j <= bisJ; }); if (J.length < 2) { k.innerHTML = ''; return; }
    var X = J.map(function (r) { return r.j; }), heuteR = R.filter(function (r) { return r.j === P.heute; })[0] || R[0];
    var streu = [];
    H0.forEach(function (h) {
      var j = berichtJahr(h), v = nachAbschlag(h); if (j == null || v == null) return;
      streu.push({ j: j, v: v, farbe: F.gold, r: 6.5, tip: '<div class="t">Marktbericht ' + datumDe(h.created_at) + '</div>Marktpreis Ø <b>' + eur(v) + '</b>'
        + (zahl(h.mpi_ohne_abschlag) && Number(h.mpi_ohne_abschlag) !== v ? '<br>ohne Abschlag <b>' + eur(h.mpi_ohne_abschlag) + '</b>' : '')
        + (zahl(h.ertragswert_eur) ? '<br>Ertragswert <b>' + eur(h.ertragswert_eur) + '</b>' : '') });
    });
    if (P.kaufJ >= X[0] && P.kaufJ <= X[X.length - 1]) streu.push({ j: P.kaufJ, v: P.kp, farbe: F.creme, raute: true, tip: '<div class="t">Kauf ' + String(P.kaufM).padStart(2, '0') + '/' + P.kaufJ + '</div>Kaufpreis <b>' + eur(P.kp) + '</b>' });
    var letzt = H0.length ? H0[H0.length - 1] : null, lw = letzt ? nachAbschlag(letzt) : null, lj = letzt ? berichtJahr(letzt) : null, pl = lj ? (R.filter(function (r) { return r.j === lj; })[0] || {}).wert : null;
    var titel = lw != null && pl ? 'Marktbericht ' + datumDe(letzt.created_at) + ': ' + eur(lw) + ', ' + eur(Math.abs(lw - pl)) + (lw >= pl ? ' über' : ' unter') + ' deinem Plan-Wert'
      : 'Plan-Wert ' + P.heute + ' ' + eur(heuteR.wert) + ', davon gehören dir ' + eur(heuteR.wert - heuteR.rs);
    var i = karte(k, { eyebrow: 'Wertverlauf', titel: titel, unter: 'Plan-Wert (Kaufpreis mit deiner Wertsteigerung) über der Restschuld, die grüne Fläche ist dein Eigenkapital im Objekt. Punkte: Marktberichte, Raute: Kaufpreis.',
      chips: [lw != null ? 'gemessen' : 'Plan'], fuss: lw == null ? ['Noch kein Marktbericht. Mit einem Bericht im Jahr steht hier der Marktpreis gegen deinen Plan.'] : [] });
    var ziel = document.createElement('div'); i.appendChild(ziel);
    verlauf(ziel, { x: X, heute: P.heute, /* v4310b · gemessen Demostraße 5: Restschuld 2024 über dem Plan-Wert, die Fläche war trotzdem grün. Jetzt grün, wo dir etwas gehört, rot, wo die Restschuld den Wert übersteigt */
      baender: [{ ohneRand: true, farbe: 'color-mix(in srgb,' + F.gruen + ' 16%,transparent)', lo: J.map(function (r) { return r.wert >= r.rs ? r.rs : null; }), hi: J.map(function (r) { return r.wert >= r.rs ? r.wert : null; }) },
        { ohneRand: true, farbe: 'color-mix(in srgb,' + F.rot + ' 18%,transparent)', lo: J.map(function (r) { return r.wert < r.rs ? r.wert : null; }), hi: J.map(function (r) { return r.wert < r.rs ? r.rs : null; }) }],   /* v4310 · Eigenkapital grün wie Vermögensaufbau im Reiter Bewertung */
      reihen: [{ name: 'Plan-Wert', werte: J.map(function (r) { return r.wert; }), farbe: F.gold, dick: 2.4 }, { name: 'Restschuld', werte: J.map(function (r) { return r.rs; }), farbe: F.tinte2, dick: 2 }],
      streu: streu,
      tip: function (q, j) { var r = J[q]; return '<div class="t">' + j + (j > P.heute ? ' · Projektion' : '') + '</div>Plan-Wert <b>' + eur(r.wert) + '</b><br>Restschuld <b>' + eur(r.rs) + '</b><br>dein Eigenkapital <b>' + eur(r.wert - r.rs) + '</b>'; },
      legende: [{ n: 'Plan-Wert', f: F.gold }, { n: 'Restschuld', f: F.tinte2 }, { n: 'Eigenkapital', f: 'color-mix(in srgb,' + F.gruen + ' 16%,transparent)' }].concat(J.some(function (r) { return r.wert < r.rs; }) ? [{ n: 'Restschuld über Wert', f: 'color-mix(in srgb,' + F.rot + ' 18%,transparent)' }] : []).concat([{ n: 'Kaufpreis', f: F.creme }]).concat(lw != null ? [{ n: 'Marktbericht', f: F.goldH }] : []) }, { breite: w - 2, aria: 'Wertverlauf' });
  }
  function karteMarkt(k, w, P) {
    var H0 = _hist || [], h = H0.length ? H0[H0.length - 1] : null, R = P.J, r = R.filter(function (x) { return x.j === P.heute; })[0] || R[0];
    var Z = [{ n: 'Kaufpreis', v: P.kp, farbe: F.creme, hohl: true }, { n: 'Plan-Wert ' + P.heute, v: r.wert, farbe: F.gold, gross: true, tip: 'Kaufpreis mit deiner Wertsteigerung' }];
    var mv = null;
    if (h) {
      mv = nachAbschlag(h); if (mv != null) Z.push({ n: 'Marktpreis Ø', v: mv, farbe: F.goldH, tip: 'aktueller Marktdurchschnitt mit Abschlag, Bericht ' + datumDe(h.created_at) });
      if (zahl(h.mpi_ohne_abschlag) && Number(h.mpi_ohne_abschlag) !== mv) Z.push({ n: 'ohne Abschlag', v: Number(h.mpi_ohne_abschlag), farbe: F.goldH, hohl: true, tip: 'Angebotsniveau ohne Abschlag' });
      if (zahl(h.ertragswert_eur)) Z.push({ n: 'Ertragswert', v: Number(h.ertragswert_eur), farbe: F.gold2 });
    }
    Z.push({ n: 'Restschuld ' + P.heute, v: r.rs, farbe: F.tinte3 });
    var titel = mv != null ? (mv >= r.wert ? 'Der Markt liegt ' + eur(mv - r.wert) + ' über deinem Plan-Wert' : 'Der Markt liegt ' + eur(r.wert - mv) + ' unter deinem Plan-Wert') : 'Plan-Wert ' + eur(r.wert - P.kp) + ' über dem Kaufpreis';
    var i = karte(k, { eyebrow: 'Wo dein Objekt steht', titel: titel, unter: 'Alle Werte auf einer Skala, gestrichelt dein Plan-Wert.', chips: [h ? 'gemessen' : 'Plan'], fuss: h ? [] : ['Mit einem Marktbericht kommen Marktpreis und Ertragswert dazu.'] });
    punktreihen(i, { zeilen: Z, bezug: r.wert, bezugText: 'Plan-Wert' }, { breite: w - 2, aria: 'Wo dein Objekt steht' });
  }
  function karteLage(k, w) {
    var H0 = (_hist || []).filter(function (h) { return zahl(h.micro_score) != null || zahl(h.macro_score) != null; });
    if (!H0.length) { k.innerHTML = ''; return; }
    var a = H0[0], b = H0[H0.length - 1], zwei = H0.length > 1;
    var B = [{ name: 'Mikrolage', wert: zahl(b.micro_score), ankauf: zwei ? zahl(a.micro_score) : null, lo: 0, hi: 100, fmt: function (v) { return nf0.format(v) + ' von 100'; }, hoch: true },
      { name: 'Makrolage', wert: zahl(b.macro_score), ankauf: zwei ? zahl(a.macro_score) : null, lo: 0, hi: 100, fmt: function (v) { return nf0.format(v) + ' von 100'; }, hoch: true }].filter(function (x) { return x.wert != null; });
    var d = zwei && zahl(b.micro_score) != null && zahl(a.micro_score) != null ? b.micro_score - a.micro_score : null;
    var titel = d != null ? (Math.abs(d) < 1 ? 'Die Lage ist seit ' + datumDe(a.created_at) + ' gleich geblieben' : 'Die Mikrolage hat sich seit ' + datumDe(a.created_at) + ' um ' + nf0.format(Math.abs(d)) + ' Punkte ' + (d > 0 ? 'verbessert' : 'verschlechtert')) : 'Lage laut Marktbericht ' + datumDe(b.created_at);
    var i = karte(k, { eyebrow: 'Lage', titel: titel, unter: 'Punkte von 0 bis 100 aus dem Marktbericht' + (zwei ? ', Kreis der erste Bericht' : '') + '.', chips: ['gemessen'] });
    bullets(i, B, { breite: w - 2, objektWort: 'heute', aria: 'Lage' });
  }

  /* Zeichnen über die Hilfen aus grafiken-neu.js (Platz, nur bei Änderung, nur sichtbar) */
  function zeichneMit(h, k, sig, fn) {
    h.zeichnen(k, sig, function (el, w) { fn(el, w); if (reduziert()) el.classList.add('gx-still'); });
  }
  function reihe(container, schluessel, vor) {
    var r = container.querySelector('[data-dp-gx-reihe="' + schluessel + '"]');
    if (r) return r;
    r = document.createElement('div'); r.setAttribute('data-dp-gx-reihe', schluessel); r.setAttribute('data-dp-gn', 'gx-' + schluessel); r.className = 'dp-gx-reihe';
    if (vor && vor.parentNode) vor.parentNode.insertBefore(r, vor); else container.insertBefore(r, container.firstChild);
    return r;
  }
  function kind(reiheEl, schluessel) {
    var k = reiheEl.querySelector('[data-dp-gn="' + schluessel + '"]');
    if (!k) { k = document.createElement('div'); k.setAttribute('data-dp-gn', schluessel); k.className = 'dp-gn dp-gx'; reiheEl.appendChild(k); }
    return k;
  }
  function pilotAnalyse(h) {
    var wr = document.querySelector('.dp-pa-wrap'); if (!wr) return;
    var P = MODELL.basis(); if (!P) return;
    var sig = h.sigJ(P.J.map(function (r) { return { j: r.j, cfop: r.cfop, cfns: r.cfns, rs: r.rs, wert: r.wert, vuv: r.vuv }; })) + '|' + [P.az, P.at, P.grenz, P.ek, P.gi, P.bindEnde].join(',');
    var C = cache(P, sig);
    var kpSig = ''; try { var K = window.State.kpis; kpSig = [K.bmy, K.dscr, K.ltv, K.cf_m].map(function (v) { return Math.round((v || 0) * 100); }).join(','); } catch (e) {}

    /* Übersicht: Einordnung + Fingerabdruck oben, dann (v4140) Vermögen + Brücke, dann Heatmap kompakt, Mieteuro, Fahrplan */
    var ue = document.getElementById('dp-pa-uebersicht');
    if (ue) {
      /* v4280 · Marcel: „Fahrplan in der Übersicht ganz oben, danach die Einordnung, danach Gesamtbewertung … und was jetzt zu tun ist“ */
      var vorText = ue.querySelector(':scope > .dp-pa5-zwei');
      var kfp = h.platz(ue, 'gx-fahrplan', vorText || ue.firstChild, 'dp-gx'); zeichneMit(h, kfp, sig + 'fp', function (k, w) { karteFahrplan(k, w, P, C); });
      /* v4310 · Marcel 24.11.2026: „die Einordnung mit den zwei Kennzahlen unter deiner Schwelle haben wir schon in Ankauf, Bestand
         und Zielbild … gehört das alles in die Übersicht?“ Die Übersicht trägt jetzt nur Fahrplan, Einordnung in Worten, Gesamtbewertung
         und was jetzt zu tun ist. Einordnung (Bullets) steht nur noch in Ankauf · Bestand · Zielbild, der Score-Fingerabdruck daneben
         (beides vergleicht das Objekt mit Maßstäben). „Wohin die Miete geht“ steht im Reiter Steuer neben dem Verlauf mit Steuern
         (es ist der Cashflow dieses Jahres samt Steuer). „Dein Anteil am Objekt wächst“ und „nach Zins und Tilgung“ (grafiken-neu.js)
         sind raus: dasselbe zeigen der Wertverlauf (Wert & Lage) und „Wohin die Miete geht“. */
      ['gx-heat-ue', 'gx-sankey', 'gx-ue-oben', 'gx-mieteuro', 'gx-einordnung', 'gx-finger'].forEach(function (q) { var alt = ue.querySelector('[data-dp-gn="' + q + '"]'); if (alt && alt.parentNode) alt.parentNode.removeChild(alt); });
    }
    /* Ankauf · Bestand · Zielbild: Einordnung mit Ankauf-Marke */
    var si = document.getElementById('dp-pa-si');
    if (si) {
      var rsi = reihe(si, 'si-oben', si.firstChild);   /* v4310 · Einordnung und Score-Fingerabdruck nebeneinander */
      var altSi = si.querySelector(':scope > [data-dp-gn="gx-einordnung-si"]'); if (altSi && altSi.parentNode) altSi.parentNode.removeChild(altSi);
      var ksi = kind(rsi, 'gx-einordnung-si'); var zbSig = ''; try { zbSig = JSON.stringify((window.DpPotenzial.kennzahlen(window.DpPotenzial.modell()) || {}).zielbild || ''); } catch (e) {} zeichneMit(h, ksi, sig + kpSig + 'a' + zbSig, function (k, w) { karteEinordnung(k, w, true); });
      zeichneMit(h, kind(rsi, 'gx-finger'), sig + kpSig, function (k, w) { karteFingerabdruck(k, w); });
      /* v4310 · Zielerreichung als Karte statt der blauen Balken */
      var zAlt = si.querySelector('.dp-pa5-ziel:not(.dp-gn-weg)') || si.querySelector('.dp-pa5-ziel');
      var kzAlt = si.querySelector('[data-dp-gn="gx-ziel"]');
      if (zAlt) {
        var zKopf = zAlt.previousElementSibling && zAlt.previousElementSibling.classList.contains('dp-pa5-ab') ? zAlt.previousElementSibling : null;
        var kz = kzAlt || h.platz(si, 'gx-ziel', zKopf || zAlt, 'dp-gx');
        var zSig = ''; try { zSig = JSON.stringify((zielDaten() || {}).B || '').length + '|' + JSON.stringify(zielDaten()); } catch (e) {}
        zeichneMit(h, kz, sig + zSig, function (k, w) { karteZiel(k, w); });
        h.weg(zAlt); if (zKopf) h.weg(zKopf);
      } else if (kzAlt && kzAlt.parentNode) kzAlt.parentNode.removeChild(kzAlt);
      var altFs = si.querySelector('[data-dp-gn="gx-fahrplan-si"]'); if (altFs && altFs.parentNode) altFs.parentNode.removeChild(altFs); }   /* v4280 · Fahrplan wieder in die Übersicht, ganz oben */
    /* Wert & Lage: Wertverlauf (statt „Wert gegen Plan“), Wo dein Objekt steht und Lage, Monte-Carlo-Fächer */
    var we = document.getElementById('dp-pa-wert');
    if (we) {
      haken();
      var altW = we.querySelector('[data-dp-pa-wertverlauf]');
      var hSig = (_hist || []).map(function (x) { return [x.created_at, nachAbschlag(x), x.micro_score].join('/'); }).join(';');
      var kwv = h.platz(we, 'gx-wertverlauf', altW || we.firstChild, 'dp-gx'); zeichneMit(h, kwv, sig + hSig, function (k, w) { karteWertverlauf(k, w, P); });
      if (altW) h.weg(altW);
      var r3 = reihe(we, 'wert-mitte', kwv.nextSibling);
      zeichneMit(h, kind(r3, 'gx-markt'), sig + hSig, function (k, w) { karteMarkt(k, w, P); });
      var kl = kind(r3, 'gx-lage'); zeichneMit(h, kl, hSig || 'ohne', function (k, w) { karteLage(k, w); });
      var lageDa = !!(_hist || []).some(function (x) { return zahl(x.micro_score) != null || zahl(x.macro_score) != null; });
      kl.style.display = lageDa ? '' : 'none'; r3.style.gridTemplateColumns = lageDa ? '' : 'minmax(0,1fr)';
      var kw = h.platz(we, 'gx-faecher', r3.nextSibling, 'dp-gx'); zeichneMit(h, kw, sig, function (k, w) { karteFaecher(k, w, P, C); });
    }
    /* Steuer: Verlauf mit Steuern nach dem Ergebnis aus Vermietung (v4140) */
    var st = document.getElementById('dp-pa-steuer');
    if (st) { var vuv = st.querySelector('[data-dp-gn="vuv"]'); var kst = h.platz(st, 'gx-steuerverlauf', vuv ? vuv.nextSibling : st.firstChild, 'dp-gx'); zeichneMit(h, kst, sig, function (k, w) { karteVerlaufSteuer(k, w, P); });
      /* v4310 · „Wohin die Miete geht“ aus der Übersicht hierher: der Cashflow dieses Jahres mit der Steuer */
      var kme = h.platz(st, 'gx-mieteuro', kst.nextSibling, 'dp-gx'); zeichneMit(h, kme, sig, function (k, w) { karteMieteuro(k, w, P); }); }
    /* Haus & Unterlagen: Hausgeld je Jahr */
    var ha = document.getElementById('dp-pa-haus');
    if (ha) { var khs = h.platz(ha, 'gx-hausgeld', ha.firstChild, 'dp-gx'); var hvSig = ''; try { hvSig = JSON.stringify(window.DpHausverlauf.lesen().jahre || '').length; } catch (e) {} zeichneMit(h, khs, sig + hvSig, function (k, w) { karteHausgeld(k, w, P); }); }
    /* Potenzial & Exit: Heatmap groß, Hebel und Ausstieg */
    var px = document.getElementById('dp-pa-potx');
    if (px) {
      var sp = px.querySelector('[data-dp-gn="sp"]');
      var khx = h.platz(px, 'gx-heat', sp ? sp.nextSibling : px.firstChild, 'dp-gx'); zeichneMit(h, khx, sig, function (k, w) { karteHeat(k, w, P, C, false); });
      var r2 = reihe(px, 'px-exit', khx.nextSibling);
      zeichneMit(h, kind(r2, 'gx-hebel'), sig, function (k, w) { karteHebel(k, w, P, C); });
      zeichneMit(h, kind(r2, 'gx-ausstieg'), sig, function (k, w) { karteAusstieg(k, w, P, C); });
    }
  }

  /* Vorschau-Sperre: nur mit DpVorschau.frei('grafiken_neu') (zusätzlich zur Sperre in grafiken-neu.js, tools/vorschau-pruefen.mjs) */
  var FREI = false;
  function freigabe() { try { if (window.DpVorschau) window.DpVorschau.frei('grafiken_neu').then(function (an) { FREI = !!an; }); } catch (e) {} }
  /* v4250 · Grafiken hell oder dunkel. Merker dp_grafik_stil: 'hell' (Standard), 'dunkel', 'app' (dunkel nur, wenn die
     Fläche hinter der Pilot-Analyse dunkel ist). Gesetzt wird html[data-gx-stil], die Farben hängen an --gx-* (stil()). */
  function appDunkel() {
    try {
      var e = document.querySelector('.dp-pa-wrap') || document.querySelector('.sec.active') || document.body, c = null;
      while (e && e.nodeType === 1) { c = getComputedStyle(e).backgroundColor; var m = c && c.match(/[0-9.]+/g); if (m && !(m.length === 4 && Number(m[3]) === 0)) { var l = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; return l < 0.35; } e = e.parentElement; }
    } catch (x) {}
    return false;
  }
  function stilWahl() { var v = 'hell'; try { v = localStorage.getItem('dp_grafik_stil') || 'hell'; } catch (e) {} return v === 'dunkel' || v === 'app' ? v : 'hell'; }
  function stilAnwenden() { var w = stilWahl(), r = w === 'dunkel' ? 'dunkel' : (w === 'app' && appDunkel() ? 'dunkel' : 'hell'); try { document.documentElement.setAttribute('data-gx-stil', r); } catch (e) {} return r; }
  function stilSetzen(v) {
    try { localStorage.setItem('dp_grafik_stil', v === 'dunkel' || v === 'app' ? v : 'hell'); } catch (e) {}
    var r = stilAnwenden();
    try { if (window.DpGrafikenNeu && window.DpGrafikenNeu.neu) window.DpGrafikenNeu.neu(); } catch (e) {}
    try { if (window.DpGrafikenBewertung && window.DpGrafikenBewertung.zeichnen) window.DpGrafikenBewertung.zeichnen(); } catch (e) {}
    return r;
  }
  stilAnwenden();
  freigabe(); window.addEventListener('dp:vorschau', freigabe); window.addEventListener('dp:plan-ready', function () { setTimeout(freigabe, 300); });
  window.DpGrafikenPremium = { lauf: function (h) { if (!FREI) { freigabe(); return; } stil(); try { pilotAnalyse(h); } catch (e) { try { console.warn('[grafiken-premium]', e); } catch (x) {} } }, MODELL: MODELL, _mieteuro: mieteuro, _zielDaten: zielDaten, _steuerBreakEven: steuerBreakEven, _einordnungDaten: einordnungDaten, stil: stilSetzen, stilWahl: stilWahl, stilAnwenden: stilAnwenden, _einordnung: einordnungDaten, _portfolio: portfolioSchnitt };
  /* v4370 · für die PDFs (grafiken-pdf.js): dieselben Karten, offscreen gezeichnet, ohne Vorschau-Bedingung */
  window.DpGrafikenPremium._pdf = { karten: { fahrplan: karteFahrplan, einordnung: karteEinordnung, ziel: karteZiel, finger: karteFingerabdruck, heat: karteHeat, mieteuro: karteMieteuro,
    faecher: karteFaecher, hebel: karteHebel, ausstieg: karteAusstieg, steuer: karteVerlaufSteuer, hausgeld: karteHausgeld, wertverlauf: karteWertverlauf, markt: karteMarkt, lage: karteLage },
    cache: cache, stil: stil, hist: function (h) { if (Array.isArray(h)) _hist = h; return _hist; } };
  window.DpGrafiken = { heatmap: heatmap, bullets: bullets, verlauf: verlauf, punktreihen: punktreihen, fahrplan: fahrplan, fingerabdruck: fingerabdruck, sankey: sankey, tornado: tornado, ausstieg: ausstieg, karte: karte, farben: F, modell: MODELL };
})();
