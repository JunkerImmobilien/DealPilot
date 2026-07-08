/* ===========================================================================
   dpsh-score-hero.js  (dpsh4)  —  DealPilot Score-Hero, Tab Bewertung (#s6)
   Marker-Namespace: dpsh-
   Aenderungen ggue dpsh3:
   - Chip dynamisch nach Tier: CLEARED (gruen) / BOARDING (gold) / GROUNDED (rot),
     Band-Punkt tier-farbig.
   - "Alle KPIs" oeffnet EIGENES Boarding-Modal (Obsidian-Brandbar + Gold-Hero +
     weisser Body) mit Kategorie-Icons, Gewicht, Score-Balken, ALLEN KPIs
     (echte Eingabewerte, nicht erfasste ausgegraut), Staerken/Abzuege + Gewichts-Summe.
   - #ds2-readonly-card ("Investor-Score Zusatzangaben") ausgeblendet.
   - Score-Logik UNVERAENDERT (liest nur DealScore.compute / DealScore2.compute).
   =========================================================================== */
(function () {
  'use strict';
  if (window.__dpshLoaded) return;
  window.__dpshLoaded = true;

  var STUB_DEFAULT = false;

  var IC = {
    trend:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16.5l5.5-5.5 3.5 3.5L21 7"/><path d="M21 11.5V7h-4.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
    list:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/></svg>',
    sliders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>'
  };
  var CATIC = {
    rendite:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16.5l5.5-5.5 3.5 3.5L21 7"/><path d="M21 11.5V7h-4.5"/></svg>',
    finanzierung: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V10"/><path d="M19 21V10"/><path d="M3 10l9-6 9 6"/><path d="M9 21v-6h6v6"/></svg>',
    risiko:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
    lage:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    upside:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16V8"/><path d="M8.5 11.5L12 8l3.5 3.5"/></svg>'
  };

  function tierKey(v) {
    if (window.ScoreTier && typeof window.ScoreTier.classify === 'function') return window.ScoreTier.classify(v);
    return v >= 85 ? 'top' : v >= 70 ? 'green' : v >= 50 ? 'gold' : 'red';
  }
  function tierCls(v) { var k = tierKey(v); return (k === 'top' || k === 'green') ? 'g' : (k === 'gold' ? 'o' : 'r'); }
  function tierCol(t) { return t === 'g' ? '#3FA56C' : t === 'o' ? '#C9A84C' : '#B86250'; }
  function chipText(t) { return t === 'g' ? 'Cleared' : t === 'o' ? 'Boarding' : 'Grounded'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function today() { var d = new Date(); function p(n){return (n<10?'0':'')+n;} return p(d.getDate()) + '.' + p(d.getMonth()+1) + '.' + d.getFullYear(); }
  function listDe(arr) {
    arr = (arr || []).filter(Boolean);
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + ' und ' + arr[1];
    return arr.slice(0, -1).join(', ') + ' und ' + arr[arr.length - 1];
  }
  function fmtVal(v, unit) {
    if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '\u2014';
    var s = v;
    if (typeof v === 'number') s = (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('de-DE') : (Math.round(v * 100) / 100).toLocaleString('de-DE'));
    return s + (unit ? ('\u00a0' + unit) : '');
  }

  /* KPI-Name -> Eingabefeld (Tab wird live aus field.closest('.sec') abgeleitet;
     's' = Fallback-Tab wenn kein/berechnetes Feld). Quelle: _buildDeal2FromState. */
  function normName(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  var KPIMAP = {};
  [
    ['Bruttorendite', '', 's1'], ['Nettorendite', '', 's1'], ['Cashflow / Mon.', '', 's1'], ['Cash-on-Cash', '', 's1'],
    ['DSCR', '', 's3'], ['LTV', '', 's3'], ['Zinssatz', 'd1z', 's3'], ['Tilgung', 'd1t', 's3'], ['EK-Bedarf', 'd1', 's3'],
    ['Leerstand', 'leerstand', 's4'], ['Instandhaltung', 'weg_r', 's4'], ['Baujahr / Zustand', 'ds2_zustand', 's0'],
    ['Energieklasse', 'ds2_energie', 's0'], ['Mietausfall-Risiko', 'ds2_mietausfall', 's0'], ['Qualit\u00e4t & Zustand', 'qz-stars-toggle', 's0'],
    ['Ist-/Marktmiete', 'ds2_marktmiete', 's0'], ['Mietwachstum p.a.', 'mietstg', 's1'], ['Bev\u00f6lkerung', 'ds2_bevoelkerung', 's0'],
    ['Nachfrage', 'ds2_nachfrage', 's0'], ['Mikrolage', 'mikrolage', 's0'], ['Mietsteigerung-Potenzial', 'ds2_marktmiete', 's0'],
    ['Faktor vs. Markt', 'ds2_marktfaktor', 's0'], ['Wertsteigerung', 'ds2_wertsteigerung', 's0'], ['Entwicklungsm\u00f6glichkeiten', 'ds2_entwicklung', 's0']
  ].forEach(function (r) { KPIMAP[normName(r[0])] = { f: r[1], s: r[2] }; });

  function jumpToField(fieldId, fallbackSec) {
    closeKpiModal();
    var el = fieldId ? document.getElementById(fieldId) : null;
    var sec = fallbackSec || 's6';
    if (el) { var secEl = el.closest ? el.closest('.sec') : null; if (secEl && secEl.id) sec = secEl.id; }
    var tab = document.querySelector('.tab[data-target-sec="' + sec + '"]');
    if (tab) { try { tab.click(); } catch (e) {} }
    if (el) {
      var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
      raf(function () {
        setTimeout(function () {
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (el.focus && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { try { el.focus({ preventScroll: true }); } catch (e2) { try { el.focus(); } catch (e3) {} } }
            el.classList.add('dpsh-flash');
            setTimeout(function () { el.classList.remove('dpsh-flash'); }, 1500);
          } catch (e) {}
        }, 150);
      });
    }
  }

  /* Berechnete KPIs ohne eigenes Feld -> Auswahl der beteiligten Felder + Formel. */
  var TABLBL = { s0: 'Objekt', s1: 'Investition', s2: 'Miete', s3: 'Finanzierung', s4: 'Bewirtschaftung', 's3-tax': 'Steuer', s5: 'Pilot-Analyse', s6: 'Bewertung', s8: 'Deal-Aktion' };
  function tabLabel(s) { return TABLBL[s] || s; }
  var PARTS = {};
  [
    ['Bruttorendite', 'Jahres-Kaltmiete \u00f7 Kaufpreis \u00d7 100',
      [['Kaufpreis', 'kp', 's1'], ['Nettokaltmiete', 'nkm', 's2'], ['Zusatzeinnahmen', 'ze', 's2']]],
    ['Nettorendite', '(Jahres-Kaltmiete \u2212 nicht-uml. Kosten) \u00f7 Gesamtinvestition \u00d7 100',
      [['Kaufpreis', 'kp', 's1'], ['Nettokaltmiete', 'nkm', 's2'], ['Zusatzeinnahmen', 'ze', 's2'], ['Bewirtschaftungskosten', '', 's4'], ['Nebenkosten / Investition', '', 's1']]],
    ['Cashflow / Mon.', 'Miete \u2212 Bewirtschaftung \u2212 Kapitaldienst (Zins + Tilgung)',
      [['Nettokaltmiete', 'nkm', 's2'], ['Zusatzeinnahmen', 'ze', 's2'], ['Bewirtschaftungskosten', '', 's4'], ['Zinssatz', 'd1z', 's3'], ['Tilgung', 'd1t', 's3']]],
    ['Cash-on-Cash', 'Jahres-Cashflow \u00f7 eingesetztes Eigenkapital \u00d7 100',
      [['Kaufpreis', 'kp', 's1'], ['Nebenkosten / Investition', '', 's1'], ['Darlehen 1', 'd1', 's3'], ['Darlehen 2', 'd2', 's3'], ['Zinssatz', 'd1z', 's3'], ['Tilgung', 'd1t', 's3']]],
    ['DSCR', 'Nettomietertrag (NOI) \u00f7 Kapitaldienst',
      [['Nettokaltmiete', 'nkm', 's2'], ['Zusatzeinnahmen', 'ze', 's2'], ['Bewirtschaftungskosten', '', 's4'], ['Zinssatz', 'd1z', 's3'], ['Tilgung', 'd1t', 's3']]],
    ['LTV', 'Darlehenssumme \u00f7 Kaufpreis \u00d7 100',
      [['Darlehen 1', 'd1', 's3'], ['Darlehen 2', 'd2', 's3'], ['Kaufpreis', 'kp', 's1']]],
    ['EK-Bedarf', 'Eigenkapital \u00f7 Gesamtinvestition \u00d7 100',
      [['Kaufpreis', 'kp', 's1'], ['Nebenkosten / Investition', '', 's1'], ['Darlehen 1', 'd1', 's3'], ['Darlehen 2', 'd2', 's3']]]
  ].forEach(function (r) { PARTS[normName(r[0])] = { title: r[0], formula: r[1], items: r[2].map(function (i) { return { label: i[0], f: i[1], s: i[2] }; }) }; });

  var _partsItems = [];
  function openParts(nn) {
    var p = PARTS[nn]; if (!p) return;
    closeParts();
    _partsItems = p.items;
    var items = p.items.map(function (it, idx) {
      return '<button class="dpshp-item" type="button" onclick="DealPilotScoreHero._jp(' + idx + ')">' +
        '<span class="dpshp-item-l">' + esc(it.label) + '</span>' +
        '<span class="dpshp-item-tab">' + esc(tabLabel(it.s)) + (it.f ? '' : ' \u00b7 Tab') + '</span>' +
        '<span class="dpshp-item-go">\u2192</span></button>';
    }).join('');
    var html = '<div class="dpshp-overlay" id="dpsh-parts-overlay">' +
      '<div class="dpshp-modal" role="dialog" aria-modal="true">' +
        '<div class="dpshp-head"><div><div class="dpshp-eye">Beteiligte Felder</div>' +
          '<div class="dpshp-title">' + esc(p.title) + '</div></div>' +
          '<button class="dpshp-x" type="button" aria-label="Schliessen" onclick="DealPilotScoreHero.closeParts()">\u00d7</button></div>' +
        '<div class="dpshp-formula"><span>Formel</span>' + esc(p.formula) + '</div>' +
        '<div class="dpshp-items">' + items + '</div>' +
        '<div class="dpshp-note">Diese Kennzahl wird berechnet \u2014 w\u00e4hle ein Feld, um es zu bearbeiten.</div>' +
      '</div></div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var node = wrap.firstChild;
    node.addEventListener('click', function (ev) { if (ev.target === node) closeParts(); });
    document.body.appendChild(node);
  }
  function closeParts() {
    var o = document.getElementById('dpsh-parts-overlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }
  function jumpFromParts(idx) {
    var it = _partsItems[idx]; if (!it) return;
    closeParts();
    jumpToField(it.f, it.s);
  }

  /* Leer-Erkennung: ohne Kaufpreis UND ohne Miete ist ein Score nicht aussagekraeftig. */
  function numField(id) {
    try {
      var pd = window.parseDe || function (x) { return parseFloat(String(x).replace(/\./g, '').replace(',', '.')) || 0; };
      var el = document.getElementById(id);
      return el ? (pd(el.value) || 0) : 0;
    } catch (e) { return 0; }
  }
  function isEmptyObject() { return numField('kp') <= 0 && numField('nkm') <= 0; }
  function emptyData(kind) {
    if (kind === 'classic') return { empty: true, kind: 'classic', logo: 'DealPilot <b>Score</b>', eyebrow: 'Pre-Flight \u00b7 DealPilot Score', emptyName: 'DealPilot Score', stub: ['Deal-Pass', 'DEAL-PASS', 'Bereit'], seed: 73 };
    return { empty: true, kind: 'investor', logo: 'Investor <b>Deal Score</b>', eyebrow: 'Pre-Flight \u00b7 Investor Deal Score', emptyName: 'Investor Deal Score', stub: ['Investor-Pass', 'IDS-PASS', 'Bereit'], seed: 70 };
  }

  /* Fachliche Bewertungs-Hinweise je KPI (Kontext, NICHT die Punkte). Schwellen an App angelehnt. */
  var HINTS = {};
  [
    ['Bruttorendite', 'Jahresmiete im Verh\u00e4ltnis zum Kaufpreis \u2014 grobe Orientierung ab ~5\u20136 % p.a.'],
    ['Nettorendite', 'Nach laufenden Kosten \u2014 solide ab ~3\u20134 % p.a.'],
    ['Cashflow / Mon.', 'Positiv = tr\u00e4gt sich selbst; je gr\u00f6\u00dfer der Puffer, desto sicherer.'],
    ['Cash-on-Cash', 'Verzinsung des eingesetzten Eigenkapitals \u2014 je h\u00f6her, desto besser der Hebel.'],
    ['DSCR', 'Tr\u00e4gt die Miete den Kapitaldienst? Bankf\u00e4hig meist \u2265 1,1\u20131,2.'],
    ['LTV', 'Fremdkapitalquote \u2014 < 85 % komfortabel, > 100 % kritisch.'],
    ['EK-Bedarf', 'Eigenkapitalquote \u2014 mehr EK senkt Risiko, mindert aber den Hebel.'],
    ['Zinssatz', 'Niedriger ist besser \u2014 mit aktuellem Marktzins vergleichen.'],
    ['Tilgung', 'H\u00f6here Tilgung = schnellere Entschuldung, weniger Cashflow.'],
    ['Leerstand', 'Geringer ist besser \u2014 realistisch kalkulieren (oft 2\u20135 %).'],
    ['Instandhaltung', 'R\u00fccklage f\u00fcr Erhalt \u2014 zu niedrig = Risiko bei Reparaturen.'],
    ['Baujahr / Zustand', 'Besserer Zustand = geringeres Sanierungsrisiko.'],
    ['Energieklasse', 'Bessere Klasse = niedrigere Nebenkosten, wertstabiler.'],
    ['Mietausfall-Risiko', 'Geringer ist besser \u2014 abh\u00e4ngig von Lage & Mieterstruktur.'],
    ['Qualit\u00e4t & Zustand', 'H\u00f6here Bewertung = bessere Vermietbarkeit & Werthaltigkeit.'],
    ['Ist-/Marktmiete', 'Liegt die Ist-Miete unter Markt? Dann Aufholpotenzial.'],
    ['Mietwachstum p.a.', 'Erwartete Steigerung \u2014 realistisch ~1\u20132 % p.a.'],
    ['Bev\u00f6lkerung', 'Wachsende Region st\u00fctzt Nachfrage und Wert.'],
    ['Nachfrage', 'Hohe Nachfrage = geringeres Vermietungsrisiko.'],
    ['Mikrolage', 'Direkte Umgebung \u2014 bessere Lage = stabilerer Wert.'],
    ['Mietsteigerung-Potenzial', 'Abstand Ist- zu Marktmiete als Hebel.'],
    ['Faktor vs. Markt', 'Kaufpreis-Faktor unter Markt = g\u00fcnstigerer Einstieg.'],
    ['Wertsteigerung', 'Erwartete Wertentwicklung der Lage.'],
    ['Entwicklungsm\u00f6glichkeiten', 'Ausbau, Teilung oder Aufstockung als Zusatz-Upside.']
  ].forEach(function (r) { HINTS[normName(r[0])] = r[1]; });

  function kaufpreisTxt() {
    try {
      var pd = window.parseDe || function (x) { return parseFloat(String(x).replace(/\./g, '').replace(',', '.')) || 0; };
      var el = document.getElementById('kp') || document.getElementById('kaufpreis');
      var v = el ? pd(el.value) : 0;
      if (v > 0) return Math.round(v).toLocaleString('de-DE') + '\u00a0\u20ac';
    } catch (e) {}
    return '\u2014';
  }

  function investorNarrative(r2) {
    var score = Math.round(r2.score), t = tierCls(score);
    var pos = (r2.positives || []).slice(0, 3).map(function (p) { return p.name; });
    var neg = (r2.negatives || []).slice(0, 3).map(function (p) { return p.name; });
    var s1;
    if (t === 'g' && score >= 85) s1 = 'Ausgezeichneter Deal mit ' + score + '/100 \u2014 die Kennzahlen tragen \u00fcber alle Bereiche.';
    else if (t === 'g') s1 = 'Insgesamt ein guter Deal mit ' + score + '/100 \u2014 klare St\u00e4rken, nur einzelne Baustellen.';
    else if (t === 'o') s1 = 'Solider Deal mit ' + score + '/100 \u2014 tragf\u00e4hig, aber mit sp\u00fcrbarem Optimierungsbedarf.';
    else s1 = 'Kritischer Deal mit ' + score + '/100 \u2014 mehrere Kennzahlen liegen im schwachen Bereich.';
    var s2 = pos.length ? 'Am st\u00e4rksten \u00fcberzeugt der Deal bei ' + listDe(pos) + '.' : 'Ausgepr\u00e4gte St\u00e4rken sind noch nicht erkennbar \u2014 dazu fehlen Eingaben.';
    var s3 = neg.length ? 'Genauer hinschauen solltest du bei ' + listDe(neg) + ' \u2014 hier liegt das Verhandlungs- und Optimierungspotenzial.' : 'Kritische Schw\u00e4chen gibt es keine \u2014 jetzt nur noch die Konditionen final gegenchecken.';
    return s1 + ' ' + s2 + ' ' + s3;
  }

  function ringHtml(score, depth, size) {
    var sw = 10, r = (size - sw - 6) / 2, c = 2 * Math.PI * r, t = tierCls(score), off = c * (1 - score / 100);
    var s = '<div class="dpsh-ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="' + sw + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + tierCol(t) + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" style="filter:drop-shadow(0 0 6px ' + tierCol(t) + '99)"/>';
    var hasDepth = (depth != null && !isNaN(depth));
    if (hasDepth) {
      var r2 = r - 14, c2 = 2 * Math.PI * r2, off2 = c2 * (1 - depth / 100);
      s += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r2 + '" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="4.5"/>' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r2 + '" fill="none" stroke="#C9A84C" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="' + c2 + '" stroke-dashoffset="' + off2 + '" style="filter:drop-shadow(0 0 4px rgba(201,168,76,.6))"/>';
    }
    s += '</svg><div class="dpsh-rov"><div class="dpsh-n" style="font-size:' + (size * (hasDepth ? 0.28 : 0.32)) + 'px">' + score + '</div><div class="dpsh-d">/ 100</div>' +
      (hasDepth ? '<div class="dpsh-sub">Datentiefe ' + depth + '%</div>' : '') + '</div></div>';
    return s;
  }

  function qrSVG(seed, px) {
    px = px || 96; var n = 25, cell = px / n, st = 0;
    function rnd() { st = (st * 1103515245 + 12345 + seed * 7919) & 0x7fffffff; return (st >>> 8) / 0x7fffff; }
    var dark = '#0c0b09', svg = '<svg width="' + px + '" height="' + px + '" viewBox="0 0 ' + px + ' ' + px + '" xmlns="http://www.w3.org/2000/svg"><rect width="' + px + '" height="' + px + '" fill="#fff"/>';
    function f(ox, oy) { svg += '<rect x="' + (ox * cell) + '" y="' + (oy * cell) + '" width="' + (7 * cell) + '" height="' + (7 * cell) + '" fill="' + dark + '"/><rect x="' + ((ox + 1) * cell) + '" y="' + ((oy + 1) * cell) + '" width="' + (5 * cell) + '" height="' + (5 * cell) + '" fill="#fff"/><rect x="' + ((ox + 2) * cell) + '" y="' + ((oy + 2) * cell) + '" width="' + (3 * cell) + '" height="' + (3 * cell) + '" fill="' + dark + '"/>'; }
    function inF(x, y) { return (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16); }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { if (inF(x, y)) continue; if (rnd() > 0.52) svg += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="' + cell + '" height="' + cell + '" fill="' + dark + '"/>'; }
    f(0, 0); f(18, 0); f(0, 18); return svg + '</svg>';
  }

  function classicData(depthPct) {
    if (isEmptyObject()) return emptyData('classic');
    if (!window.DealScore || typeof window.DealScore.compute !== 'function') return null;
    var r; try { r = window.DealScore.compute(); } catch (e) { return null; }
    if (!r || !r.breakdown || !r.breakdown.length) return null;
    var cats = r.breakdown.map(function (b) { return { name: b.label, k: (b.weight) + '%', v: Math.round(b.score), s: b.input }; });
    function inp(key) { var f = r.breakdown.filter(function (b) { return b.key === key; })[0]; return f ? f.input : '\u2014'; }
    var stats = [['Kaufpreis', kaufpreisTxt()], ['Cashflow', inp('cashflow')], ['DSCR', String(inp('risiko')).replace('DSCR ', '')]];
    return {
      kind: 'classic', logo: 'DealPilot <b>Score</b>', eyebrow: 'Pre-Flight \u00b7 DealPilot Score',
      icon: IC.trend, action: { label: 'Gewichtung', icon: IC.sliders },
      score: r.score, depth: depthPct, label: r.label, detail: r.interpretation || '',
      cats: cats, stats: stats, stub: ['Deal-Pass', 'DEAL-PASS', 'Stand ' + today()], seed: 73
    };
  }

  function investorData(deal, comp) {
    if (isEmptyObject()) return emptyData('investor');
    if (!window.DealScore2 || typeof window.DealScore2.compute !== 'function') return null;
    var r2; try { r2 = window.DealScore2.compute(deal); } catch (e) { return null; }
    if (!r2 || !r2.categories) return null;
    var keys = ['rendite', 'finanzierung', 'risiko', 'lage', 'upside'];
    var labels = { rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Risiko', lage: 'Lage & Markt', upside: 'Upside / Potenzial' };
    var w = (r2.configUsed && r2.configUsed.weights) || {};
    var cats = keys.map(function (k) {
      var c = r2.categories[k] || {};
      var av = (c.totalKpis > 0) ? (c.availableKpis + '/' + c.totalKpis + ' KPIs') : '';
      return { name: labels[k], k: (w[k] || 0) + '%', v: Math.round(c.score || 0), s: av };
    });
    var stats = [['Kaufpreis', kaufpreisTxt()], ['KPIs', comp ? (comp.filled + '/' + comp.total) : '\u2014'], ['Datentiefe', comp ? (comp.percent + '\u00a0%') : '\u2014']];
    return {
      kind: 'investor', logo: 'Investor <b>Deal Score</b>', eyebrow: 'Pre-Flight \u00b7 Investor Deal Score',
      icon: IC.shield, action: { label: 'Alle KPIs', icon: IC.list },
      score: r2.score, depth: comp ? comp.percent : null, label: r2.label, detail: investorNarrative(r2),
      cats: cats, stats: stats, stub: ['Investor-Pass', 'IDS-PASS', 'Stand ' + today()], seed: 70
    };
  }

  function stubHtml(d) {
    return '<div class="dpsh-perf"></div><div class="dpsh-stub"><span class="dpsh-notch t"></span><span class="dpsh-notch b"></span><div class="dpsh-stublabel">' + esc(d.stub[0]) + '</div><div class="dpsh-qr">' + qrSVG(d.seed, 96) + '</div><div class="dpsh-stubmeta"><div class="m1">' + esc(d.stub[1]) + '</div><div class="m2">' + esc(d.stub[2]) + '</div></div></div>';
  }

  function emptyHero(d) {
    return '<div class="dpsh-pass"><div class="dpsh-main"><div class="dpsh-star"></div>' +
      '<div class="dpsh-band"><div class="dpsh-band-l"><span class="dpsh-dot" style="background:#8a8378"></span><span class="dpsh-eyebrow">' + esc(d.eyebrow) + '</span></div><span class="dpsh-chip t-idle">Standby</span></div>' +
      '<div class="dpsh-body">' +
        '<div class="dpsh-headrow"><div class="dpsh-logo"><span class="t">' + d.logo + '</span></div></div>' +
        '<div class="dpsh-empty"><div class="dpsh-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></svg></div>' +
          '<div class="dpsh-empty-t">Noch nicht genug Daten</div>' +
          '<div class="dpsh-empty-s">Gib Kaufpreis und Miete ein \u2014 dann berechne ich den ' + esc(d.emptyName) + '.</div>' +
          '<button class="dpsh-empty-btn" type="button" onclick="DealPilotScoreHero.jump(\'kp\',\'s1\')">Daten eingeben</button>' +
        '</div>' +
      '</div></div>' + stubHtml(d) +
    '</div>';
  }

  function heroHtml(d) {
    if (d.empty) return emptyHero(d);
    var t = tierCls(d.score);
    var bars = d.cats.map(function (c) {
      var ct = tierCls(c.v);
      return '<div class="dpsh-cbar"><div class="dpsh-cbar-top"><span class="dpsh-cbar-name">' + esc(c.name) +
        '<span class="dpsh-kpi">' + esc(c.k) + '</span></span><span class="dpsh-cbar-score">' + c.v + ' <span class="o">/100</span></span></div>' +
        '<div class="dpsh-cbar-track"><div class="dpsh-cbar-fill dpsh-fill-' + ct + '" data-w="' + c.v + '"></div></div>' +
        (c.s ? '<div class="dpsh-cbar-sub">' + esc(c.s) + '</div>' : '') + '</div>';
    }).join('');
    var stats = '<div class="dpsh-statstrip">' + d.stats.map(function (s) {
      return '<div class="dpsh-st"><div class="dpsh-sl">' + esc(s[0]) + '</div><div class="dpsh-sv">' + s[1] + '</div></div>';
    }).join('') + '</div>';
    var verdict = '<div class="dpsh-verdict t-' + t + '"><div class="dpsh-vico">' + d.icon + '</div>' +
      '<div><div class="dpsh-vt">Bewertung \u00b7 ' + esc(d.label) + '</div><div class="dpsh-vlead">' + esc(d.detail) + '</div></div></div>';
    return '<div class="dpsh-pass"><div class="dpsh-main"><div class="dpsh-star"></div>' +
      '<div class="dpsh-band"><div class="dpsh-band-l"><span class="dpsh-dot" style="background:' + tierCol(t) + ';box-shadow:0 0 8px ' + tierCol(t) + '"></span><span class="dpsh-eyebrow">' + esc(d.eyebrow) + '</span></div><span class="dpsh-chip t-' + t + '">' + chipText(t) + '</span></div>' +
      '<div class="dpsh-body">' +
        '<div class="dpsh-headrow"><div class="dpsh-logo"><span class="t">' + d.logo + '</span></div>' +
          '<button class="dpsh-actbtn" type="button" onclick="DealPilotScoreHero.action(\'' + d.kind + '\')">' + d.action.icon + d.action.label + '</button></div>' +
        '<div class="dpsh-mainrow"><div class="dpsh-colring">' + ringHtml(d.score, d.depth, 140) +
          '<span class="dpsh-badge ' + t + '">' + d.icon + ' ' + esc(d.label) + '</span>' + stats + '</div>' +
          '<div class="dpsh-colcats"><div class="dpsh-sectitle">So setzt sich der Score zusammen</div><div class="dpsh-cbars">' + bars + '</div></div></div>' +
        '<div class="dpsh-verdictbar">' + verdict + '</div>' +
      '</div></div>' +
      '<div class="dpsh-perf"></div><div class="dpsh-stub"><span class="dpsh-notch t"></span><span class="dpsh-notch b"></span><div class="dpsh-stublabel">' + esc(d.stub[0]) + '</div><div class="dpsh-qr">' + qrSVG(d.seed, 96) + '</div><div class="dpsh-stubmeta"><div class="m1">' + esc(d.stub[1]) + '</div><div class="m2">' + esc(d.stub[2]) + '</div></div></div>' +
    '</div>';
  }

  /* ---------- Boarding-KPI-Modal (eigenes, isoliert) ---------- */
  function buildKpiModal(deal, r2, comp) {
    var keys = ['rendite', 'finanzierung', 'risiko', 'lage', 'upside'];
    var labels = { rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Risiko', lage: 'Lage & Markt', upside: 'Upside / Potenzial' };
    var w = (r2.configUsed && r2.configUsed.weights) || {};
    var score = Math.round(r2.score);
    var wsum = 0; keys.forEach(function (k) { wsum += (w[k] || 0); });

    var posChips = (r2.positives || []).slice(0, 4).map(function (p) {
      return '<span class="dpshm-chip pos">' + esc(p.name) + ' <b>' + Math.round(p.points) + '</b></span>';
    }).join('') || '<span class="dpshm-chip empty">\u2014</span>';
    var negChips = (r2.negatives || []).slice(0, 4).map(function (p) {
      return '<span class="dpshm-chip neg">' + esc(p.name) + ' <b>' + Math.round(p.points) + '</b></span>';
    }).join('') || '<span class="dpshm-chip empty">\u2014</span>';

    var cats = keys.map(function (k) {
      var c = r2.categories[k] || {};
      var ct = tierCls(Math.round(c.score || 0));
      var bd = c.breakdown || [];
      var rows = bd.map(function (b) {
        var applied = !!b.applied;
        var pt = Math.round(b.points || 0);
        var ptc = applied ? tierCls(pt) : 'x';
        var nn = normName(b.name);
        var hasParts = !!PARTS[nn];
        var hint = HINTS[nn] || '';
        var map = KPIMAP[nn] || null;
        var clickable = hasParts || !!map;
        var onclick = hasParts
          ? (' onclick="DealPilotScoreHero.parts(\'' + nn + '\')"')
          : (map ? (' onclick="DealPilotScoreHero.jump(\'' + (map.f || '') + '\',\'' + map.s + '\')"') : '');
        return '<div class="dpshm-kpi' + (applied ? '' : ' off') + (clickable ? ' link' : '') + '"' + onclick + '>' +
          '<span class="dpshm-kpi-name"><span class="dpshm-kpi-nm">' + esc(b.name) + (hasParts ? '<i class="dpshm-fx">f(x)</i>' : '') + '</span>' +
            (hint ? '<span class="dpshm-kpi-hint">' + esc(hint) + '</span>' : '') + '</span>' +
          '<span class="dpshm-kpi-val">' + (applied ? fmtVal(b.value, b.unit) : 'nicht erfasst') + '</span>' +
          '<span class="dpshm-kpi-pts ' + ptc + '">' + (applied ? (pt + '<i>/100</i>') : '\u2014') + '</span>' +
          '<span class="dpshm-kpi-go">' + (clickable ? '\u2192' : '') + '</span>' +
        '</div>';
      }).join('');
      return '<div class="dpshm-cat">' +
        '<div class="dpshm-cat-head"><span class="dpshm-cat-ico ' + ct + '">' + (CATIC[k] || '') + '</span>' +
          '<span class="dpshm-cat-name">' + labels[k] + '</span>' +
          '<span class="dpshm-cat-w">Gewicht ' + (w[k] || 0) + '%</span>' +
          '<span class="dpshm-cat-score ' + ct + '">' + Math.round(c.score || 0) + '<i>/100</i></span></div>' +
        '<div class="dpshm-cat-bar"><i class="b-' + ct + '" style="width:' + Math.round(c.score || 0) + '%"></i></div>' +
        '<div class="dpshm-kpis">' + (rows || '<div class="dpshm-kpi off"><span class="dpshm-kpi-name">Keine KPIs</span></div>') + '</div>' +
      '</div>';
    }).join('');

    var wsOk = Math.abs(wsum - 100) <= 0.5;

    return '<div class="dpshm-overlay" id="dpsh-kpi-overlay">' +
      '<div class="dpshm-modal" role="dialog" aria-modal="true">' +
        '<div class="dpshm-brandbar"><span class="dpshm-brand">Investor <b>Deal Score</b></span>' +
          '<button class="dpshm-x" type="button" aria-label="Schliessen" onclick="DealPilotScoreHero.closeKpi()">\u00d7</button></div>' +
        '<div class="dpshm-hero">' +
          '<div><div class="dpshm-hero-eye">Alle KPIs</div>' +
            '<div class="dpshm-hero-title">' + score + '<span>/100</span> \u00b7 ' + esc(r2.label) + '</div></div>' +
          '<div class="dpshm-hero-meta">' + (comp ? (comp.filled + '/' + comp.total + ' KPIs<br>' + comp.percent + '% Datentiefe') : '') + '</div>' +
        '</div>' +
        '<div class="dpshm-body">' +
          '<div class="dpshm-sw">' +
            '<div class="dpshm-sw-col"><div class="dpshm-sw-h pos">St\u00e4rken</div>' + posChips + '</div>' +
            '<div class="dpshm-sw-col"><div class="dpshm-sw-h neg">Abz\u00fcge</div>' + negChips + '</div>' +
          '</div>' +
          cats +
        '</div>' +
        '<div class="dpshm-foot">' +
          '<span class="dpshm-wsum ' + (wsOk ? 'ok' : 'bad') + '">Gewichtung gesamt: ' + wsum + '%' + (wsOk ? '' : ' \u26a0') + '</span>' +
          '<button class="dpshm-cta" type="button" onclick="DealPilotScoreHero.closeKpi()">Schlie\u00dfen</button>' +
        '</div>' +
      '</div></div>';
  }

  function openKpiModal() {
    closeKpiModal();
    var deal = null, comp = null, r2 = null;
    try { if (typeof window._buildDeal2FromState === 'function') deal = window._buildDeal2FromState(); } catch (e) {}
    if (!window.DealScore2 || typeof window.DealScore2.compute !== 'function') return;
    try { r2 = window.DealScore2.compute(deal); } catch (e) { return; }
    if (!r2 || !r2.categories) return;
    try { if (typeof window.DealScore2.getKpiCompleteness === 'function') comp = window.DealScore2.getKpiCompleteness(deal); } catch (e) {}
    var wrap = document.createElement('div');
    wrap.innerHTML = buildKpiModal(deal, r2, comp);
    var node = wrap.firstChild;
    node.addEventListener('click', function (ev) { if (ev.target === node) closeKpiModal(); });
    document.body.appendChild(node);
    document.addEventListener('keydown', _escClose);
  }
  function _escClose(ev) { if (ev.key !== 'Escape') return; if (document.getElementById('dpsh-parts-overlay')) closeParts(); else closeKpiModal(); }
  function closeKpiModal() {
    var o = document.getElementById('dpsh-kpi-overlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
    document.removeEventListener('keydown', _escClose);
  }

  function ensureMount() {
    var s6 = document.getElementById('s6');
    if (!s6) return null;
    var m = document.getElementById('dpsh-mount');
    if (!m) {
      m = document.createElement('div'); m.id = 'dpsh-mount';
      var anchor = document.getElementById('dealscore-card');
      if (anchor && anchor.parentNode === s6) s6.insertBefore(m, anchor);
      else s6.insertBefore(m, s6.children[1] || null);
    }
    return m;
  }

  function animate(root) {
    var fills = root.querySelectorAll('.dpsh-cbar-fill[data-w]');
    for (var i = 0; i < fills.length; i++) {
      (function (e) { e.style.width = '0'; setTimeout(function () { e.style.width = e.getAttribute('data-w') + '%'; }, 40); })(fills[i]);
    }
  }

  function realRenderAll() {
    var m = ensureMount(); if (!m) return;
    var deal = null, comp = null;
    try { if (typeof window._buildDeal2FromState === 'function') deal = window._buildDeal2FromState(); } catch (e) {}
    try { if (deal && window.DealScore2 && typeof window.DealScore2.getKpiCompleteness === 'function') comp = window.DealScore2.getKpiCompleteness(deal); } catch (e) {}
    var depthPct = comp ? comp.percent : null;
    var html = '';
    var c = classicData(depthPct); if (c) html += heroHtml(c);
    var i = investorData(deal, comp); if (i) html += heroHtml(i);
    m.innerHTML = html;
    if (html) animate(m);
  }

  var _pending = false;
  function renderAll() {
    if (_pending) return; _pending = true;
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf(function () { try { realRenderAll(); } catch (e) {} _pending = false; }); /* v893g-loop: _pending erst NACH dem Render frei */
  }

  function injectCss() {
    if (document.getElementById('dpsh-style')) return;
    var st = document.createElement('style'); st.id = 'dpsh-style'; st.textContent = CSS;
    document.head.appendChild(st);
    document.body.classList.add('dpsh-on');
    if (STUB_DEFAULT) document.body.classList.add('dpsh-stub');
  }

  function wrap(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__dpshWrapped) return;
    var w = function () { var r = orig.apply(this, arguments); try { renderAll(); } catch (e) {} return r; };
    w.__dpshWrapped = true; window[name] = w;
  }

  function clickOriginal(sel, textIncludes) {
    var host = document.querySelector(sel); if (!host) return false;
    var btns = host.querySelectorAll('button,a,[role="button"],.btn');
    for (var i = 0; i < btns.length; i++) {
      if ((btns[i].textContent || '').indexOf(textIncludes) >= 0) { try { btns[i].click(); return true; } catch (e) {} }
    }
    return false;
  }

  function setupKpiEvalCollapse() {
    var card = document.getElementById('kpi-eval-card');
    if (!card || card.getAttribute('data-dpsh-coll') === '1') return;
    var header = card.querySelector('.kpi-eval-header');
    if (!header) return;
    card.setAttribute('data-dpsh-coll', '1');
    try { if (localStorage.getItem('dp_dpsh_min') === '1') card.classList.add('dpsh-collapsed'); } catch (e) {}
    var chev = document.createElement('span');
    chev.className = 'dpsh-coll-chev';
    chev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    header.appendChild(chev);
    header.classList.add('dpsh-coll-head');
    header.addEventListener('click', function (ev) {
      var tgt = ev.target;
      if (tgt && tgt.closest && tgt.closest('.dp-tip,button:not(.dpsh-coll-chev),a')) return;
      card.classList.toggle('dpsh-collapsed');
    });
  }

  function boot() {
    injectCss();
    /* v875: Nutzer-Praeferenz — Leiste kompakt starten */
    try { if (localStorage.getItem('dp_dpsh_min') === '1') document.body.classList.add('dpsh-stub'); } catch (e) {}
    wrap('renderDealScore'); wrap('renderDealScore2');
    realRenderAll();
    setupKpiEvalCollapse();
    var tries = 0;
    var iv = setInterval(function () { wrap('renderDealScore'); wrap('renderDealScore2'); setupKpiEvalCollapse(); if (++tries >= 5) clearInterval(iv); }, 800);
  }

  window.DealPilotScoreHero = {
    render: renderAll,
    setStub: function (on) { document.body.classList.toggle('dpsh-stub', !!on); },
    openKpi: openKpiModal,
    closeKpi: closeKpiModal,
    jump: function (f, s) { jumpToField(f, s); },
    parts: function (nn) { openParts(nn); },
    closeParts: function () { closeParts(); },
    _jp: function (idx) { jumpFromParts(idx); },
    action: function (kind) {
      if (kind === 'investor') { openKpiModal(); return; }
      if (typeof window.showSettings === 'function') { try { window.showSettings('dealscore'); return; } catch (e) {} }
      if (clickOriginal('#dealscore-box', 'Gewicht')) return;
      if (clickOriginal('#dealscore-card', 'Gewicht')) return;
    },
    _debug: { classicData: classicData, investorData: investorData }
  };

  /* ===================== CSS ===================== */
  var CSS = [
'body.dpsh-on #dealscore-card,body.dpsh-on #dealscore2-card,body.dpsh-on #ds2-readonly-card{display:none!important}',
'#dpsh-mount{display:flex;flex-direction:column;gap:16px;margin-bottom:18px}',
'#dpsh-mount *{box-sizing:border-box}',
'.dpsh-pass{display:flex;border-radius:18px;overflow:hidden;position:relative;background:#1b1815;box-shadow:0 22px 60px -30px rgba(20,15,5,.5)}',
'.dpsh-main{flex:1;position:relative;background:radial-gradient(120% 150% at 78% -10%,#0d0c09,#050505 62%);min-width:0}',
'.dpsh-star{position:absolute;inset:0;opacity:.38;pointer-events:none;background-image:radial-gradient(1px 1px at 22% 28%,rgba(201,168,76,.45),transparent),radial-gradient(1px 1px at 72% 16%,rgba(255,255,255,.22),transparent),radial-gradient(1px 1px at 88% 60%,rgba(201,168,76,.35),transparent),radial-gradient(1px 1px at 42% 84%,rgba(255,255,255,.18),transparent)}',
'.dpsh-band{position:relative;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);padding:9px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;overflow:hidden}',
'.dpsh-band::after{content:"";position:absolute;inset:0;opacity:.5;background:repeating-linear-gradient(90deg,rgba(0,0,0,.05) 0 2px,transparent 2px 8px)}',
'.dpsh-band-l{position:relative;z-index:1;display:flex;align-items:center;gap:9px}',
'.dpsh-dot{width:8px;height:8px;border-radius:50%;background:#3FA56C}',
'.dpsh-eyebrow{font-family:"JetBrains Mono",monospace;font-size:10.5px;font-weight:700;letter-spacing:2px;color:#2c2410;text-transform:uppercase}',
'.dpsh-chip{position:relative;z-index:1;font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;letter-spacing:1px;padding:4px 12px;border-radius:20px;background:#231b08;text-transform:uppercase}',
'.dpsh-chip.t-g{color:#5ec98a}.dpsh-chip.t-o{color:#E8CC7A}.dpsh-chip.t-r{color:#e0897a}',
'.dpsh-chip.t-idle{color:#b3ada2}',
'.dpsh-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:9px;padding:30px 20px 26px}',
'.dpsh-empty-ic{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#8a8378;background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}',
'.dpsh-empty-ic svg{width:24px;height:24px}',
'.dpsh-empty-t{font-family:"Space Grotesk",sans-serif;font-size:17px;font-weight:700;color:#f2ede4}',
'.dpsh-empty-s{font-family:"Inter",sans-serif;font-size:13px;color:#8a8378;max-width:340px;line-height:1.5}',
'.dpsh-empty-btn{margin-top:5px;font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:9px 18px;border-radius:9px;border:none;cursor:pointer;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#231b08}',
'.dpsh-empty-btn:hover{filter:brightness(1.06)}',
'.dpsh-coll-head{cursor:pointer;position:relative;padding-right:30px}',
'.dpsh-coll-chev{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:#9a9488;display:inline-flex;align-items:center;transition:transform .2s}',
'.dpsh-coll-chev svg{width:18px;height:18px}',
'#kpi-eval-card.dpsh-collapsed .dpsh-coll-chev{transform:translateY(-50%) rotate(-90deg)}',
'#kpi-eval-card.dpsh-collapsed #kpi-eval-body{display:none}',
'.dpsh-body{position:relative;z-index:1;padding:16px 24px 18px}',
'.dpsh-headrow{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}',
'.dpsh-logo{display:inline-flex;align-items:center;padding:8px 14px;border-radius:11px;background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(201,168,76,.02));box-shadow:inset 0 0 0 1px rgba(201,168,76,.3)}',
'.dpsh-logo .t{font-family:"Space Grotesk",sans-serif;font-size:18px;font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap}',
'.dpsh-logo .t b{color:#C9A84C;font-weight:700}',
'#dpsh-mount .dpsh-actbtn{display:inline-flex!important;align-items:center;gap:6px;padding:6px 11px!important;border-radius:8px!important;background:transparent!important;color:#7d766a!important;border:1px solid rgba(201,168,76,.18)!important;font-family:"JetBrains Mono",monospace!important;font-size:10px!important;font-weight:600!important;letter-spacing:.5px!important;line-height:1.4!important;text-transform:none!important;cursor:pointer;transition:.15s;white-space:nowrap;box-shadow:none!important;min-width:0!important;width:auto!important;height:auto!important}',
'#dpsh-mount .dpsh-actbtn:hover{color:#C9A84C!important;border-color:rgba(201,168,76,.45)!important;background:rgba(201,168,76,.06)!important}',
'#dpsh-mount .dpsh-actbtn svg{width:13px;height:13px;flex:0 0 auto;stroke:currentColor}',
'.dpsh-mainrow{display:flex;gap:28px;align-items:center}',
'.dpsh-colring{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:10px}',
'.dpsh-colcats{flex:1;min-width:0}',
'.dpsh-badge{font-family:"JetBrains Mono",monospace;font-size:10.5px;font-weight:700;letter-spacing:1px;padding:5px 14px;border-radius:20px;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px}',
'.dpsh-badge svg{width:12px;height:12px}',
'.dpsh-badge.g{background:rgba(63,165,108,.16);color:#3FA56C;box-shadow:0 0 0 1px rgba(63,165,108,.35),0 0 14px -3px rgba(63,165,108,.5)}',
'.dpsh-badge.o{background:rgba(201,168,76,.16);color:#C9A84C;box-shadow:0 0 0 1px rgba(201,168,76,.4),0 0 14px -3px rgba(201,168,76,.5)}',
'.dpsh-badge.r{background:rgba(184,98,80,.16);color:#B86250;box-shadow:0 0 0 1px rgba(184,98,80,.4)}',
'.dpsh-ring{position:relative;display:inline-block}',
'.dpsh-rov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}',
'.dpsh-n{font-family:"Space Grotesk",sans-serif;font-weight:700;color:#fff;line-height:1;letter-spacing:-1px}',
'.dpsh-d{font-size:10px;color:#8a8378;margin-top:2px}',
'.dpsh-sub{font-family:"JetBrains Mono",monospace;font-size:8px;color:#C9A84C;letter-spacing:.4px;margin-top:4px;text-transform:uppercase}',
'.dpsh-statstrip{display:flex;gap:0;margin-top:4px}',
'.dpsh-st{padding:0 13px;border-left:1px solid rgba(255,255,255,.08);text-align:center}',
'.dpsh-st:first-child{border-left:none;padding-left:0}',
'.dpsh-sl{font-family:"JetBrains Mono",monospace;font-size:8.5px;letter-spacing:1px;color:#8a8378;text-transform:uppercase}',
'.dpsh-sv{font-family:"Space Grotesk",sans-serif;font-size:14px;font-weight:700;color:#fff;margin-top:2px;white-space:nowrap}',
'.dpsh-sectitle{font-family:"DM Sans",sans-serif;font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#C9A84C;margin-bottom:12px;position:relative;padding-right:14px;display:inline-block}',
'.dpsh-sectitle::after{content:"";position:absolute;right:-6px;top:50%;width:80px;height:1px;transform:translateY(-50%);background:linear-gradient(90deg,#C9A84C,transparent)}',
'.dpsh-cbars{display:flex;flex-direction:column;gap:10px}',
'.dpsh-cbar-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}',
'.dpsh-cbar-name{font-family:"Space Grotesk",sans-serif;font-size:13px;font-weight:600;color:#f2ede4}',
'.dpsh-cbar-name .dpsh-kpi{font-family:"JetBrains Mono",monospace;font-size:10px;color:#8a8378;margin-left:8px;font-weight:400}',
'.dpsh-cbar-score{font-family:"JetBrains Mono",monospace;font-size:13.5px;font-weight:700;color:#fff}',
'.dpsh-cbar-score .o{font-size:9.5px;color:#8a8378;font-weight:400}',
'.dpsh-cbar-track{height:6px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden}',
'.dpsh-cbar-fill{height:100%;border-radius:5px;width:0;transition:width 1s cubic-bezier(.2,.8,.2,1)}',
'.dpsh-fill-g{background:linear-gradient(90deg,#2f8f5b,#3FA56C)}.dpsh-fill-o{background:linear-gradient(90deg,#b8932f,#E8CC7A)}.dpsh-fill-r{background:linear-gradient(90deg,#9c4f40,#B86250)}',
'.dpsh-cbar-sub{font-family:"JetBrains Mono",monospace;font-size:10px;color:#8a8378;margin-top:3px}',
'.dpsh-verdictbar{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}',
'.dpsh-verdict{display:flex;align-items:center;gap:12px;padding:12px 15px;border-radius:12px;background:rgba(255,255,255,.02);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}',
'.dpsh-verdict.t-g{background:linear-gradient(120deg,rgba(63,165,108,.10),transparent);box-shadow:inset 0 0 0 1px rgba(63,165,108,.25)}',
'.dpsh-verdict.t-o{background:linear-gradient(120deg,rgba(201,168,76,.12),transparent);box-shadow:inset 0 0 0 1px rgba(201,168,76,.28)}',
'.dpsh-verdict.t-r{background:linear-gradient(120deg,rgba(184,98,80,.12),transparent);box-shadow:inset 0 0 0 1px rgba(184,98,80,.28)}',
'.dpsh-vico{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}',
'.dpsh-verdict.t-g .dpsh-vico{background:rgba(63,165,108,.15);color:#3FA56C;box-shadow:inset 0 0 0 1px rgba(63,165,108,.4)}',
'.dpsh-verdict.t-o .dpsh-vico{background:rgba(201,168,76,.15);color:#C9A84C;box-shadow:inset 0 0 0 1px rgba(201,168,76,.4)}',
'.dpsh-verdict.t-r .dpsh-vico{background:rgba(184,98,80,.15);color:#B86250;box-shadow:inset 0 0 0 1px rgba(184,98,80,.4)}',
'.dpsh-vico svg{width:20px;height:20px}',
'.dpsh-vt{font-family:"JetBrains Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:3px}',
'.dpsh-verdict.t-g .dpsh-vt{color:#3FA56C}.dpsh-verdict.t-o .dpsh-vt{color:#C9A84C}.dpsh-verdict.t-r .dpsh-vt{color:#B86250}',
'.dpsh-vlead{font-family:"Space Grotesk",sans-serif;font-size:14px;font-weight:600;color:#fff;line-height:1.4}',
'.dpsh-perf{width:2px;background:repeating-linear-gradient(180deg,rgba(201,168,76,.55) 0 7px,transparent 7px 14px);flex:0 0 2px;display:none}',
'.dpsh-stub{flex:0 0 184px;position:relative;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:18px 16px;background:#FDFCFA}',
'.dpsh-notch{position:absolute;width:20px;height:20px;border-radius:50%;background:#0d0c09;left:-11px;z-index:2}',
'.dpsh-notch.t{top:-10px}.dpsh-notch.b{bottom:-10px}',
'.dpsh-stublabel{font-family:"JetBrains Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b8932f}',
'.dpsh-qr{padding:8px;border-radius:10px;background:#fff;box-shadow:0 4px 16px -8px rgba(0,0,0,.3)}',
'.dpsh-qr svg{display:block}',
'.dpsh-stubmeta{text-align:center;line-height:1.5}',
'.dpsh-stubmeta .m1{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:12px;color:#2a251f}',
'.dpsh-stubmeta .m2{font-size:10.5px;color:#8a8378}',
'body.dpsh-stub .dpsh-perf{display:block}',
'body.dpsh-stub .dpsh-stub{display:flex}',
'@keyframes dpshFlash{0%{box-shadow:0 0 0 0 rgba(201,168,76,.55)}100%{box-shadow:0 0 0 9px rgba(201,168,76,0)}}',
'.dpsh-flash{outline:2px solid #C9A84C!important;outline-offset:2px;border-radius:6px;animation:dpshFlash 1.2s ease 2}',
'.dpshm-overlay{position:fixed;inset:0;z-index:99999;background:rgba(8,6,3,.66);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Inter",system-ui,sans-serif}',
'.dpshm-modal{width:100%;max-width:760px;max-height:88vh;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:#FDFCFA;box-shadow:0 40px 100px -30px rgba(0,0,0,.7)}',
'.dpshm-brandbar{background:#070707;padding:10px 18px;display:flex;align-items:center;justify-content:space-between}',
'.dpshm-brand{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:15px;color:#fff;letter-spacing:.5px}',
'.dpshm-brand b{color:#C9A84C;font-weight:700}',
'.dpshm-x{background:transparent;border:none;color:#9a9488;font-size:24px;line-height:1;cursor:pointer;padding:0 4px}',
'.dpshm-x:hover{color:#fff}',
'.dpshm-hero{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
'.dpshm-hero-eye{font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2c2410;margin-bottom:3px}',
'.dpshm-hero-title{font-family:"Space Grotesk",sans-serif;font-size:22px;font-weight:700;color:#1b1408}',
'.dpshm-hero-title span{font-size:13px;color:#5a4a18;font-weight:600}',
'.dpshm-hero-meta{font-family:"JetBrains Mono",monospace;font-size:10px;color:#3a2f12;text-align:right;line-height:1.5}',
'.dpshm-body{padding:18px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}',
'.dpshm-sw{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-bottom:6px}',
'.dpshm-sw-h{font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px}',
'.dpshm-sw-h.pos{color:#2f8f5b}.dpshm-sw-h.neg{color:#B86250}',
'.dpshm-chip{display:inline-block;font-size:11.5px;color:#3a342c;background:#f2efe7;border-radius:7px;padding:5px 9px;margin:0 5px 5px 0}',
'.dpshm-chip b{font-family:"JetBrains Mono",monospace;font-weight:700}',
'.dpshm-chip.pos{box-shadow:inset 0 0 0 1px rgba(47,143,91,.3)}.dpshm-chip.pos b{color:#2f8f5b}',
'.dpshm-chip.neg{box-shadow:inset 0 0 0 1px rgba(184,98,80,.3)}.dpshm-chip.neg b{color:#B86250}',
'.dpshm-chip.empty{color:#9a9488}',
'.dpshm-cat{border:1px solid rgba(0,0,0,.07);border-radius:13px;padding:13px 14px;background:#fff}',
'.dpshm-cat-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
'.dpshm-cat-ico{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;background:rgba(201,168,76,.1);color:#b8932f;box-shadow:inset 0 0 0 1px rgba(201,168,76,.25)}',
'.dpshm-cat-ico svg{width:17px;height:17px}',
'.dpshm-cat-ico.g{color:#2f8f5b;background:rgba(47,143,91,.1);box-shadow:inset 0 0 0 1px rgba(47,143,91,.25)}',
'.dpshm-cat-ico.r{color:#B86250;background:rgba(184,98,80,.1);box-shadow:inset 0 0 0 1px rgba(184,98,80,.25)}',
'.dpshm-cat-name{font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:700;color:#241f19;flex:1}',
'.dpshm-cat-w{font-family:"JetBrains Mono",monospace;font-size:10.5px;color:#9a9488}',
'.dpshm-cat-score{font-family:"JetBrains Mono",monospace;font-size:15px;font-weight:700;margin-left:12px}',
'.dpshm-cat-score i{font-size:10px;color:#9a9488;font-style:normal}',
'.dpshm-cat-score.g{color:#2f8f5b}.dpshm-cat-score.o{color:#b8932f}.dpshm-cat-score.r{color:#B86250}',
'.dpshm-cat-bar{height:6px;border-radius:5px;background:#eceae3;overflow:hidden;margin-bottom:11px}',
'.dpshm-cat-bar i{display:block;height:100%;border-radius:5px}',
'.dpshm-cat-bar .b-g{background:linear-gradient(90deg,#2f8f5b,#46b97e)}.dpshm-cat-bar .b-o{background:linear-gradient(90deg,#b8932f,#E8CC7A)}.dpshm-cat-bar .b-r{background:linear-gradient(90deg,#9c4f40,#B86250)}',
'.dpshm-kpis{display:flex;flex-direction:column}',
'.dpshm-kpi{display:grid;grid-template-columns:1fr auto 50px 16px;gap:10px;align-items:center;padding:7px 6px;margin:0 -6px;border-top:1px solid rgba(0,0,0,.05)}',
'.dpshm-kpi:first-child{border-top:none}',
'.dpshm-kpi.link{cursor:pointer;border-radius:7px}',
'.dpshm-kpi.link:hover{background:rgba(201,168,76,.08)}',
'.dpshm-kpi-go{font-family:"JetBrains Mono",monospace;font-size:14px;font-weight:700;color:#cab089;text-align:right}',
'.dpshm-kpi.link:hover .dpshm-kpi-go{color:#b8932f}',
'.dpshm-kpi-name{display:flex;flex-direction:column;gap:2px}',
'.dpshm-kpi-nm{font-size:12.5px;color:#3a342c;font-weight:600}',
'.dpshm-kpi-hint{font-size:10.5px;color:#9a9488;line-height:1.35;max-width:380px}',
'.dpshm-kpi-val{font-family:"JetBrains Mono",monospace;font-size:11.5px;color:#6c655a;text-align:right}',
'.dpshm-kpi-pts{font-family:"JetBrains Mono",monospace;font-size:12.5px;font-weight:700;text-align:right}',
'.dpshm-kpi-pts i{font-size:9px;color:#b3ada2;font-style:normal;font-weight:400}',
'.dpshm-kpi-pts.g{color:#2f8f5b}.dpshm-kpi-pts.o{color:#b8932f}.dpshm-kpi-pts.r{color:#B86250}.dpshm-kpi-pts.x{color:#b3ada2}',
'.dpshm-kpi.off .dpshm-kpi-nm{color:#a8a299}.dpshm-kpi.off .dpshm-kpi-val{color:#b3ada2;font-style:italic}',
'.dpshm-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:#070707}',
'.dpshm-wsum{font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:600}',
'.dpshm-wsum.ok{color:#5ec98a}.dpshm-wsum.bad{color:#e0897a}',
'.dpshm-cta{font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 18px;border-radius:9px;border:none;cursor:pointer;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#231b08}',
'.dpshm-cta:hover{filter:brightness(1.06)}',
'.dpshm-fx{font-family:"JetBrains Mono",monospace;font-size:9px;font-style:normal;font-weight:700;color:#b8932f;background:rgba(201,168,76,.12);border-radius:4px;padding:1px 5px;margin-left:7px;vertical-align:middle}',
'.dpshp-overlay{position:fixed;inset:0;z-index:100000;background:rgba(8,6,3,.5);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Inter",system-ui,sans-serif}',
'.dpshp-modal{width:100%;max-width:420px;border-radius:16px;overflow:hidden;background:#FDFCFA;box-shadow:0 30px 80px -24px rgba(0,0,0,.7)}',
'.dpshp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 18px 12px;background:#070707}',
'.dpshp-eye{font-family:"JetBrains Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#C9A84C;margin-bottom:4px}',
'.dpshp-title{font-family:"Space Grotesk",sans-serif;font-size:18px;font-weight:700;color:#fff}',
'.dpshp-x{background:transparent;border:none;color:#8a8378;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}',
'.dpshp-x:hover{color:#fff}',
'.dpshp-formula{font-family:"JetBrains Mono",monospace;font-size:11.5px;color:#5a5247;line-height:1.5;padding:11px 18px;background:rgba(201,168,76,.07);border-bottom:1px solid rgba(0,0,0,.05)}',
'.dpshp-formula span{display:block;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#b8932f;margin-bottom:3px}',
'.dpshp-items{padding:8px 12px}',
'.dpshp-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:transparent;border:none;border-radius:9px;padding:11px 10px;cursor:pointer;transition:.13s}',
'.dpshp-item:hover{background:rgba(201,168,76,.1)}',
'.dpshp-item-l{flex:1;font-family:"Space Grotesk",sans-serif;font-size:14px;font-weight:600;color:#2a251f}',
'.dpshp-item-tab{font-family:"JetBrains Mono",monospace;font-size:10px;color:#9a9488;text-transform:uppercase;letter-spacing:.5px}',
'.dpshp-item-go{font-family:"JetBrains Mono",monospace;font-size:14px;font-weight:700;color:#cab089}',
'.dpshp-item:hover .dpshp-item-go{color:#b8932f}',
'.dpshp-note{padding:4px 18px 15px;font-size:11px;color:#9a9488;line-height:1.4}',
'@media(max-width:780px){.dpsh-mainrow{flex-direction:column;gap:18px}.dpsh-headrow{flex-wrap:wrap}.dpsh-stub{flex-basis:150px}.dpshm-sw{grid-template-columns:1fr}}'
  ].join('\n');

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
