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
  var C = { c1: '#2f6db5', c2: '#a6812a', plan: '#9b958c', linie: '#2A2727', gut: '#3FA56C', rot: '#B8625C' };

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
    var teile = t.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [t], out = [];
    for (var i = 0; i < teile.length && out.length < n; i++) {
      var s = teile[i].trim();
      if (out.length && /^\d/.test(s)) { out[out.length - 1] += ' ' + s; continue; }   /* „3. OG" o. ä. nicht trennen */
      out.push(s);
    }
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
    });
    neuZeichnen();
  }
  function neuZeichnen() {
    try { if (window.DpSteuerVerlauf) window.DpSteuerVerlauf.mountAll(); } catch (e) {}
    try { if (_letzteHist) wertverlauf(_letzteHist); } catch (e) {}
    try { steuerTabelleAlle(); } catch (e) {}
  }

  /* ── Stil ────────────────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dp-pa4-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-pa4-stil';
    s.textContent = [
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-pa-d,.dp-pa-wrap[data-dp-pa-modus="detail"] .dp-pa-e{display:none !important}',
      /* wert-zielbild hat einen eigenen Einfach|Genau-Schalter - in Fassung 4 steuert der Kopf */
      '.dp-pa-wrap[data-dp-pa-v4] .dp-si-um{display:none !important}',
      '.dp-pa4-kopf{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}',
      '.dp-pa4-reihe{display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-width:0}',
      '.dp-pa4-phase{font:600 12px "Space Grotesk",Inter,sans-serif;padding:6px 12px;border-radius:8px;background:#FBF6E9;color:#2A2727;white-space:nowrap}',
      '.dp-pa4-info{font:400 12px Inter,system-ui,sans-serif;color:#7A7370}',
      '.dp-pa4-seg{display:inline-flex;border:1px solid #E6DCC2;border-radius:10px;padding:3px;background:#fff}',
      '.dp-pa4-seg button{border:0;background:transparent;color:#2A2727;font:600 12.5px "Space Grotesk",Inter,sans-serif;padding:6px 14px;border-radius:7px;cursor:pointer}',
      '.dp-pa4-seg button[aria-pressed="true"]{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#050505}',
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
      '.dp-pa4-ch .gl{stroke:#EFEAE0}',
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
    if (zahl(k.cf_m)) z.push(zahlKachel('Cashflow vor Steuer', sEur(k.cf_m) + ' / Monat', zahl(k.cf_ns) ? 'nach Steuer ' + sEur(k.cf_ns / 12) + ' / Monat' : '', k.cf_m >= 0 ? C.gut : C.rot));
    if (zahl(k.dscr) && k.dscr > 0) z.push(zahlKachel('DSCR', de(k.dscr, 2), k.dscr >= 1.2 ? 'Bank: trägt sich' : k.dscr >= 1 ? 'knapp über 1' : 'unter 1: Zuschuss nötig', k.dscr >= 1 ? C.gut : C.rot));
    if (w && w.marktpreisindikation && zahl(w.marktpreisindikation.mitte)) {
      var oh = w.ohne_abschlag && zahl(w.ohne_abschlag.mitte) ? 'ohne Abschlag ' + eur(w.ohne_abschlag.mitte) : '';
      z.push(zahlKachel('Marktpreis Ø', eur(w.marktpreisindikation.mitte), oh, 'var(--wl-c9a84c,#C9A84C)'));
    }
    if (w && w.ertragswert && zahl(w.ertragswert.wert)) z.push(zahlKachel('Ertragswert', eur(w.ertragswert.wert), w.ertragswert.vorlaeufig ? 'vorläufig' : (zahl(w.ertragswert.lzs_pct) ? 'LZS ' + de(w.ertragswert.lzs_pct, 2) + ' %' : ''), C.c1));
    var sc = investorScore();
    if (sc != null) z.push(zahlKachel('Investor Deal Score', String(sc), (window.ScoreTier && window.ScoreTier.stufe ? window.ScoreTier.stufe(sc).wort : ''), '#2A2727'));
    return z.length ? '<div class="dp-pa4-zahlen">' + z.join('') + '</div>' : '';
  }

  /** Das Gesamtstatement: alle Aussagen der Analyse in einer Lesefolge (Detail). */
  function gesamtstatement(a, bestand) {
    var t = [], ra = a.risikoanalyse && typeof a.risikoanalyse === 'object' ? a.risikoanalyse : null, sz = a.szenarien && typeof a.szenarien === 'object' ? a.szenarien : null;
    t.push(abschnitt('Gesamtbewertung', absatz(a.gesamtbewertung || a.fazit_kurz)));
    t.push(abschnitt('Begründung des Urteils', absatz(a.empfehlung_begruendung)));
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
  function uebersicht(a, bestand, extra) {
    extra = extra || {};
    var st = window._dpEmpfStufe ? window._dpEmpfStufe(a.empfehlung || a.fazit_kurz) : { label: a.empfehlung || '—', farbe: 'var(--wl-c9a84c,#C9A84C)' };
    var sc = investorScore();
    var kurz = saetze(a.gesamtbewertung || a.fazit_kurz, 3), grund = saetze(a.empfehlung_begruendung, 2);
    var brief = '<div class="dp-pa4-brief"><div class="dp-pa4-urteil"><small>' + (bestand ? 'Urteil im Bestand' : 'Urteil zum Ankauf') + '</small>'
      + '<span class="dp-pa-empf" style="background:' + st.farbe + ';justify-self:start">' + esc(st.label) + '</span>'
      + (sc != null ? '<span class="z">' + sc + '</span><span class="u">Investor Deal Score</span>' : '') + '</div>'
      + '<div><div class="dp-pa-e">' + (kurz ? '<p>' + txt(kurz) + '</p>' : '') + (grund ? '<p>' + txt(grund) + '</p>' : '') + '</div>'
      + '<div class="dp-pa-d">' + absatz(a.gesamtbewertung || a.fazit_kurz) + '</div></div></div>';
    var h = (extra.hinweis || '') + brief + kennzahlen(bestand);
    if (bestand && a.bestand_modus && has(a.verhandlungsempfehlung))
      h += '<div class="dp-pa-e">' + karte(kopfzeile('Was du jetzt tun kannst') + '<p class="dp-pa-p">' + txt(saetze(a.verhandlungsempfehlung, 3)) + '</p>') + '</div>';
    /* Einfach: worauf es ankommt */
    var st3 = (Array.isArray(a.staerken) ? a.staerken : []).slice(0, 3), ri3 = (Array.isArray(a.risiken) ? a.risiken : []).slice(0, 3);
    if (st3.length || ri3.length) h += '<div class="dp-pa-e">' + karte(kopfzeile('Worauf es ankommt') + '<div class="dp-pa4-zwei">'
      + '<div><b style="font:600 12px Inter,sans-serif;color:#2E7D50">Dafür</b><ul class="dp-pa4-liste">' + st3.map(function (x) { return '<li>' + txt(saetze(x, 1)) + '</li>'; }).join('') + '</ul></div>'
      + '<div><b style="font:600 12px Inter,sans-serif;color:#B8625C">Dagegen</b><ul class="dp-pa4-liste">' + ri3.map(function (x) { return '<li>' + txt(saetze(x, 1)) + '</li>'; }).join('') + '</ul></div></div>'
      + '<button type="button" class="dp-pa4-mehr" data-dp-pa-modus-setzen="detail">Ausführlich lesen (Detail)</button>') + '</div>';
    /* Detail: das ganze Statement */
    var gs = gesamtstatement(a, bestand);
    h += '<div class="dp-pa-d">' + karte(kopfzeile(bestand ? 'Gesamtstatement zum Bestand' : 'Gesamtstatement zum Ankauf') + gs
      + '<p class="dp-pa4-erkl">Das Statement fasst alle Teile der Pilot-Analyse in einer Lesefolge zusammen: erst das Urteil und seine Begründung, dann Stärken, Risiken und Szenarien, '
      + 'danach Lage, ' + (bestand ? 'Potenzial und Steuer' : 'Kaufpreis, Bank, Potenzial und Steuer') + '. Die Zahlen darin sind der Stand der Analyse; die Kacheln oben zeigen die heutige Rechnung.</p>')
      + (extra.score || '') + (extra.fit || '') + '</div>';
    return h;
  }

  /** Unterreiter Risiken & Szenarien */
  function risiko(a, bestand, extra) {
    extra = extra || {};
    var ra = a.risikoanalyse && typeof a.risikoanalyse === 'object' ? a.risikoanalyse : null, sz = a.szenarien && typeof a.szenarien === 'object' ? a.szenarien : {};
    var lst = function (arr, n) { return Array.isArray(arr) && arr.length ? '<ul class="dp-pa4-liste">' + arr.map(function (x) { return '<li>' + txt(x) + '</li>'; }).join('') + '</ul>' : '<em class="dp-pa-empty">—</em>'; };
    var h = '<div class="dp-pa-cols">'
      + karte('<div class="dp-pa-sec good"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">STÄRKEN</span><span class="dp-pa-rule"></span></div>' + lst(a.staerken))
      + karte('<div class="dp-pa-sec bad"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">RISIKEN</span><span class="dp-pa-rule"></span></div>' + lst(a.risiken))
      + '</div>';
    /* Risikobewertung: Einfach die ersten Sätze, Detail ganz */
    if (ra && (has(ra.finanzierungsrisiko) || has(ra.cashflow_stabilitaet) || has(ra.annahmen_abhaengigkeit))) {
      var zeile = function (lbl, t) { return has(t) ? '<div class="dp-pa-kv"><strong>' + lbl + ':</strong> <span class="dp-pa-e">' + txt(saetze(t, 1)) + '</span><span class="dp-pa-d">' + txt(t) + '</span></div>' : ''; };
      h += karte(kopfzeile('Risikoanalyse') + zeile('Finanzierungsrisiko (LTV + DSCR)', ra.finanzierungsrisiko) + zeile('Cashflow-Stabilität', ra.cashflow_stabilitaet) + zeile('Abhängigkeit von Annahmen', ra.annahmen_abhaengigkeit)
        + erkl('<b>Finanzierungsrisiko</b> fragt, ob Beleihung (LTV) und Schuldendienstdeckung (DSCR) einer Bank genügen. <b>Cashflow-Stabilität</b> fragt, wie viel Mietausfall oder Kostensteigerung der Monatsüberschuss verträgt. <b>Abhängigkeit von Annahmen</b> zeigt, welche deiner Eingaben (Mietsteigerung, Zins nach der Bindung, Wertsteigerung) das Ergebnis am stärksten tragen.'), 'dp-pa4-mt');
    }
    /* Worst · Plan · Best */
    var k = kpis();
    var plan = '<dl>' + (zahl(k.cf_m) ? '<dt>Cashflow vor Steuer</dt><dd>' + sEur(k.cf_m) + ' / Monat</dd>' : '')
      + (zahl(k.cf_ns) ? '<dt>nach Steuer</dt><dd>' + sEur(k.cf_ns / 12) + ' / Monat</dd>' : '')
      + (zahl(k.dscr) && k.dscr > 0 ? '<dt>DSCR</dt><dd>' + de(k.dscr, 2) + '</dd>' : '')
      + (zahl(k.bmy) && k.bmy > 0 ? '<dt>Bruttorendite</dt><dd>' + de(k.bmy, 2) + ' %</dd>' : '') + '</dl>';
    var szk = function (titel, an, farbe, t, inner, vor) {
      return '<div class="dp-pa4-szk" style="--c:' + farbe + '"><h4>' + titel + (vor ? '<span class="dp-pa4-vor">Vorschlag</span>' : '') + '</h4><span class="an">' + an + '</span>'
        + (inner || '') + (has(t) ? '<p class="dp-pa-e">' + txt(saetze(t, 2)) + '</p><p class="dp-pa-d">' + txt(t) + '</p>' : (inner ? '' : '<p><em class="dp-pa-empty">—</em></p>')) + '</div>';
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
  /** Unterreiter Steuer: Verlauf wie im Reiter Steuer, Text, im Detail die Tabelle */
  function steuer(a) {
    var h = karte(kopfzeile('Steuerverlauf · wann das Objekt steuerlich positiv wird') + '<div data-dp-steuerverlauf="1"></div>'
      + erkl('<b>So liest du die Grafik:</b> Die Balken zeigen je Jahr das Ergebnis der Anlage V (Einnahmen minus Werbungskosten). Grün ist ein Verlust, der deine Steuer senkt, Gold ein Gewinn, auf den Steuer fällig wird. '
        + 'Die Linie ist der Cashflow nach Steuern. Markiert sind der Wendepunkt, das Ende der Zinsbindung und das Datum, ab dem ein Verkauf nach § 23 EStG steuerfrei ist. Es ist dieselbe Rechnung wie im Reiter Steuer.'));
    h += karte(kopfzeile('Steuerliche Zusammenfassung')
      + (has(a.steuer_zusammenfassung)
        ? '<p class="dp-pa-p dp-pa-e">' + txt(saetze(a.steuer_zusammenfassung, 3)) + '</p><p class="dp-pa-p dp-pa-d">' + txt(a.steuer_zusammenfassung) + '</p>'
        : '<div class="dp-pa-fuss" style="margin-top:0">Diese Analyse wurde vor der steuerlichen Zusammenfassung erstellt. Beim nächsten Abruf steht sie hier.</div>')
      + '<div class="dp-pa-fuss">Eine Einordnung aus deinen Eingaben im Reiter Steuer – keine Steuerberatung. Lass sie von deinem Steuerberater bestätigen.</div>', 'dp-pa4-mt');
    h += '<div class="dp-pa-d">' + karte(kopfzeile('Einnahmen und Werbungskosten nach Gruppen') + '<div class="dp-pa4-tab" data-dp-pa4-steuertab="1"></div>'
      + erkl('Die Gruppen sind die des Reiters Steuer: <b>Finanzierung</b> (Zinsen und Finanzierungskosten), <b>Betriebskosten</b> (umgelegt und nicht umlagefähig), <b>Verwaltung</b>, <b>Sonstiges</b>, <b>AfA</b> sowie <b>Erhaltung und anschaffungsnaher Aufwand</b>. '
        + 'Umgelegte Nebenkosten stehen bei den Einnahmen und bei den Betriebskosten, sie heben sich auf. Die Zuführung zur Erhaltungsrücklage ist nicht abziehbar und fehlt deshalb. Steuerwirkung ist der Unterschied der Steuer mit und ohne dieses Objekt (Plus = Erstattung).'), 'dp-pa4-mt') + '</div>';
    try { setTimeout(steuerTabelleAlle, 0); } catch (e) {}
    return h;
  }

  /* ── Grafik-Werkzeug (Bauart Steuerverlauf) ──────────────────────────
     cfg: { x: [Beschriftung], reihen: [{ name, farbe, werte:[Zahl|null], art:'linie'|'gestrichelt'|'punkt'|'raute', aus:Bool }],
            fmt(v) für Achse/Tooltip, tip(i) optional zusätzliche Tooltip-Zeilen, aria } */
  function linien(host, cfg) {
    if (!host) return;
    stil();
    var W = 900, H = 300, L = 70, Rr = 16, T = 18, U = 34, n = cfg.x.length;
    var vs = [];
    cfg.reihen.forEach(function (r) { if (r.aus) return; r.werte.forEach(function (v) { if (zahl(v)) vs.push(Number(v)); }); });
    if (!vs.length || n < 1) { host.innerHTML = ''; return; }
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    if (cfg.null) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    if (hi === lo) { hi = hi + Math.abs(hi || 1) * 0.1; lo = lo - Math.abs(lo || 1) * 0.1; }
    var st = nice(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    var y = function (v) { return T + (H - T - U) * (1 - (v - lo) / (hi - lo)); };
    var gap = (W - L - Rr) / n, x = function (i) { return L + i * gap + gap / 2; };
    var fmt = cfg.fmt || function (v) { return String(v); };
    var s = '';
    for (var v = lo; v <= hi + st / 2; v += st) s += '<line class="gl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="ax" x="' + (L - 7) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(cfg.achse ? cfg.achse(v) : fmt(v)) + '</text>';
    cfg.x.forEach(function (lbl, i) { if (i % (n > 14 ? 2 : 1) === 0 || i === n - 1) s += '<text class="ax" x="' + x(i).toFixed(1) + '" y="' + (H - U + 16) + '" text-anchor="middle">' + esc(lbl) + '</text>'; });
    cfg.reihen.forEach(function (r) {
      if (r.aus) return;
      var pk = []; r.werte.forEach(function (w, i) { if (zahl(w)) pk.push([x(i), y(Number(w))]); });
      if (r.art === 'linie' || r.art === 'gestrichelt') {
        if (pk.length > 1) s += '<polyline fill="none" stroke="' + r.farbe + '" stroke-width="' + (r.art === 'linie' ? 2.2 : 1.8) + '"' + (r.art === 'gestrichelt' ? ' stroke-dasharray="5 4"' : '') + ' points="' + pk.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
        if (r.art === 'linie') pk.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#fff" stroke="' + r.farbe + '" stroke-width="1.5"/>'; });
      } else if (r.art === 'raute') {
        pk.forEach(function (p) { s += '<rect x="' + (p[0] - 5).toFixed(1) + '" y="' + (p[1] - 5).toFixed(1) + '" width="10" height="10" transform="rotate(45 ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')" fill="' + r.farbe + '" stroke="#fff" stroke-width="2"/>'; });
      } else {
        pk.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5.5" fill="' + (r.hohl ? '#fff' : r.farbe) + '" stroke="' + (r.hohl ? r.farbe : '#fff') + '" stroke-width="2"/>'; });
      }
    });
    s += '<line class="kreuz" x1="0" x2="0" y1="' + T + '" y2="' + (H - U) + '"/>';
    for (var i = 0; i < n; i++) s += '<rect class="hit" data-i="' + i + '" x="' + (L + i * gap).toFixed(1) + '" y="' + T + '" width="' + gap.toFixed(1) + '" height="' + (H - U - T) + '" tabindex="-1"/>';
    var leg = '<div class="dp-pa4-leg">' + cfg.reihen.map(function (r) {
      var cl = r.art === 'linie' ? 'l' : r.art === 'gestrichelt' ? 'd' : r.art === 'raute' ? 'r' : 'p';
      return '<span style="color:' + r.farbe + '"><i class="' + cl + '" style="' + (cl === 'r' || cl === 'p' ? 'background:' + (r.hohl ? '#fff;border:2px solid ' + r.farbe : r.farbe) : '') + '"></i><span style="color:#6B645A">' + esc(r.name) + '</span></span>';
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
      { name: 'Restschuld', farbe: C.c1, werte: rs, art: 'linie' },
      { name: 'Marktpreis Ø laut Bericht', farbe: C.c2, werte: mpi, art: 'punkt' }
    ];
    if (mpo.some(zahl)) reihen.push({ name: 'ohne Abschlag', farbe: C.c2, werte: mpo, art: 'punkt', hohl: true });
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
      + erkl('<b>So liest du die Grafik:</b> Die gestrichelte Linie ist dein <b>Plan-Wert</b> – der Kaufpreis, fortgeschrieben mit der Wertsteigerung aus deinen Eingaben. Die blaue Linie ist die <b>Restschuld</b> deiner Darlehen; der Abstand zwischen beiden ist das Eigenkapital im Objekt nach Plan. '
        + 'Die Punkte sind die <b>Marktpreisindikationen</b> deiner Marktberichte: gefüllt mit dem Abschlag auf Angebotspreise (aktueller Marktdurchschnitt), hohl ohne Abschlag. Der Ertragswert steht ohne Spanne in der Tafel darunter, weil er ein gerechneter Einzelwert ist.');
    linien(host.querySelector('[data-dp-pa4-g]'), {
      x: jahre.map(String), reihen: reihen, fmt: eur, achse: te, aria: 'Wert gegen Plan von ' + jahre[0] + ' bis ' + jahre[jahre.length - 1],
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
    linien(box, { x: hist.map(function (h, i) { return (i + 1) + '. ' + new Date(h.created_at).toLocaleDateString('de-DE'); }), reihen: reihen, chips: true,
      fmt: function (v) { return 'Index ' + de(v, 1); }, achse: function (v) { return de(v, 0); }, aria: 'Entwicklung der Marktberichte, Index erster Bericht = 100',
      tip: function (i) {
        return '<div style="display:block;color:#7A7370;margin-top:3px">' + reihen.filter(function (r) { return !r.aus && zahl(hist[i][r.key]); }).map(function (r) { return esc(r.name) + ': ' + esc(r.fmtAbs(Number(hist[i][r.key]))); }).join('<br>') + '</div>';
      } });
  }

  /* ── Hülle ───────────────────────────────────────────────────────────── */
  function huelle(o) {
    stil();
    var m = modus(), bestand = !!o.bestand;
    var tab = function (id, lbl, aktiv, extra) { return '<button type="button" class="dp-pa-tab' + (aktiv ? ' active' : '') + '"' + (extra || '') + ' onclick="_dpPaTab(\'' + id + '\',this)">' + lbl + '</button>'; };
    var panel = function (id, inner, aktiv, extra) { return '<section class="dp-pa-panel' + (aktiv ? ' active' : '') + '" id="dp-pa-' + id + '"' + (extra || '') + '>' + inner + '</section>'; };
    var reiter = [], inhalt = [];
    var add = function (id, lbl, inner, opt) { opt = opt || {}; if (!inner && !opt.leer) return; reiter.push(tab(id, lbl, !reiter.length, opt.tabExtra)); inhalt.push(panel(id, inner, inhalt.length === 0)); };
    add('uebersicht', 'Übersicht', o.uebersicht);
    add('si', bestand ? 'Ankauf · Bestand · Soll · Zielbild' : 'Ankauf · Soll · Zielbild', o.si);
    /* Wert & Verlauf erscheint wie bisher erst mit einem Bericht oder Abruf (_dpLoadVerlauf) */
    reiter.push('<button type="button" class="dp-pa-tab" id="dp-pa-tab-wert" style="display:none" onclick="_dpPaTab(\'wert\',this)">Wert &amp; Verlauf</button>');
    inhalt.push(panel('wert', o.wert, false));
    add('loc', 'Lage &amp; Markt', o.lage);
    if (bestand) {
      add('steuer', 'Steuer', o.steuer);
      add('risk', 'Risiken &amp; Szenarien', o.risiko);
      if (o.unterlagen) add('unterlagen', 'Unterlagen &amp; WEG', o.unterlagen);
      add('anschluss', 'Anschluss &amp; Exit', o.anschlussExit);
    } else {
      add('risk', 'Risiken &amp; Szenarien', o.risiko);
      add('verh', 'Kaufpreis &amp; Offerte', o.verhandlung);
      add('bank', 'Finanzierung &amp; Bank', o.bank);
      add('steuer', 'Steuer', o.steuer);
      if (o.unterlagen) add('unterlagen', 'Unterlagen &amp; WEG', o.unterlagen);
    }
    var phase = bestand ? 'Bestand' : 'Ankauf', info = '';
    try {
      var AK = window.DealPilotAnkauf, st = AK && AK.stand ? AK.stand() : null;
      if (bestand && st && st.stichtag) info = 'Ankauf-Stand vom ' + String(st.stichtag).split('-').reverse().join('.') + ' · Fragen und Reiter für das Halten';
      else info = bestand ? 'Fragen und Reiter für das Halten' : 'Fragen und Reiter für die Kaufentscheidung';
    } catch (e) {}
    var kopf = '<div class="dp-pa4-kopf"><div class="dp-pa4-reihe"><span class="dp-pa4-phase">' + phase + '</span><span class="dp-pa4-info">' + esc(info) + '</span></div>'
      + '<div class="dp-pa4-reihe"><button type="button" class="dp-pa4-pdf" data-dp-pa4-pdf="1" aria-controls="ai-pdf-sections">PDF zusammenstellen</button>'
      + '<div class="dp-pa4-seg" role="group" aria-label="Darstellung"><button type="button" data-dp-pa-modus-knopf="einfach" aria-pressed="' + (m === 'einfach') + '">Einfach</button>'
      + '<button type="button" data-dp-pa-modus-knopf="detail" aria-pressed="' + (m === 'detail') + '">Detail</button></div></div></div>';
    try { localStorage.setItem('dp_pa_si_ansicht', m === 'detail' ? 'genau' : 'einfach'); } catch (e) {}
    return '<div class="dp-pa-wrap' + (bestand ? ' dp-pa-bestand' : '') + '" data-dp-pa-v4="1" data-dp-pa-modus="' + m + '" data-dp-pa-ansicht="' + (bestand ? 'bestand' : 'ankauf') + '">'
      + (o.kopf || '') + kopf
      + '<nav class="dp-pa-rail">' + reiter.join('') + '</nav>'
      + '<div class="dp-pa-content">' + inhalt.join('') + '</div></div>';
  }

  /* Klicks: Modus, „Ausführlich lesen", PDF (eine Stelle für alle Hüllen) */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var k = t.closest('[data-dp-pa-modus-knopf]') || t.closest('[data-dp-pa-modus-setzen]');
    if (k && k.closest('.dp-pa-wrap[data-dp-pa-v4]')) { ev.preventDefault(); setzeModus(k.getAttribute('data-dp-pa-modus-knopf') || k.getAttribute('data-dp-pa-modus-setzen')); return; }
    var p = t.closest('[data-dp-pa4-pdf]');
    if (p) {
      ev.preventDefault();
      var d = document.querySelector('.ai-pdf-details');
      if (d) { d.open = true; var box = d.closest('.ai-pdf-toggle') || d; try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { box.scrollIntoView(); } }
    }
  });

  window.DpPilotV4 = { VERSION: 'v3099', huelle: huelle, uebersicht: uebersicht, risiko: risiko, steuer: steuer, gesamtstatement: gesamtstatement,
    wertverlauf: wertverlauf, indexVerlauf: indexVerlauf, linien: linien, modus: modus, setzeModus: setzeModus, neuZeichnen: neuZeichnen, saetze: saetze, steuerTabelle: steuerTabelle };
})();
