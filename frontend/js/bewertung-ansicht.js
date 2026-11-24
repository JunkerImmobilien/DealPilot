/* ═══ v4320 · REITER BEWERTUNG: ERKLÄRUNG BEIM DARÜBERFAHREN UND ANSICHT ANPASSEN ═══════════════
   Marcel 24.11.2026: „wenn wir über die Karten fahren, brauchen wir natürlich auch mit der Maus eine
   Einordnung … was ist der IRR zum Beispiel, der Break-even, warum elf Jahre … kurze Erklärung, wie die
   sich zusammensetzen“ und „welche Sachen wir überhaupt sehen wollen, dass wir gewisse Sachen ausschalten
   können“.

   1 · Erklärung: jede Kachel in .bw-kz (und die zwei Cashflow-Zeilen) bekommt beim Darüberfahren eine
       Karte mit Aussage und Rechenweg aus den Zahlen DIESES Objekts. Gelesen wird zur Zeit des Hovers aus
       State.kpis, State._irrReihe (calc.js v1260b) und den Zeilen der Karte „Cashflow, korrekte Berechnung“
       (cr-*), also genau aus dem, was die App anzeigt. Gerechnet wird hier nichts Neues.
   2 · Ansicht: Blöcke des Reiters ein- und ausblenden, mit Grundsetup (Muster: grafiken-portfolio.js
       cockpit_ansicht). Gespeichert in user_settings bewertung_ansicht, Spiegel im Browser dp_bw_ansicht.
       Nur hinter der Vorschau grafiken_neu, bis Marcel freigibt. Score und Kennzahlen bleiben immer.
   Kundentext ohne Gedankenstrich und ohne Semikolon. */
(function () {
  'use strict';

  /* ── Zahlen ───────────────────────────────────────────────────────────── */
  function eur(n, mitVz) {
    if (n == null || !isFinite(n)) return '';
    var s = Math.round(Math.abs(n)).toLocaleString('de-DE') + ' €';
    if (n < 0) return '-' + s;
    return (mitVz && n > 0 ? '+' : '') + s;
  }
  function pct(n, st) { return (n == null || !isFinite(n)) ? '' : n.toLocaleString('de-DE', { minimumFractionDigits: st == null ? 1 : st, maximumFractionDigits: st == null ? 1 : st }) + ' %'; }
  function zahl(n, st) { return (n == null || !isFinite(n)) ? '' : n.toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st }); }
  function domZahl(id) {
    var e = document.getElementById(id); if (!e) return null;
    var t = String(e.textContent || '').replace(/\s| |€|%/g, '').replace(/[–−]/g, '-');
    if (!/\d/.test(t)) return null;
    var n = Number(t.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function domText(id) { var e = document.getElementById(id); return e ? String(e.textContent || '').trim() : ''; }
  function K() { return (window.State && State.kpis) || {}; }
  function R() { return (window.State && State._irrReihe) || null; }
  function kalJahr(n) {
    try { var r = State.cfRows && State.cfRows[n - 1]; if (r && r.cal) return r.cal; } catch (e) {}
    return null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── Texte je Kennzahl: { t: Titel, a: Aussage, r: Rechenweg (Zeilen), h: Einordnung } ───────── */
  var ERKL = {
    'cf-vst': function () {
      var k = K(), modus = (document.querySelector('#s6 .cf-mode-btn.active') || {}).getAttribute ? document.querySelector('#s6 .cf-mode-btn.active').getAttribute('data-mode') : 'heute';
      var r = [];
      if (modus === 'heute' && domZahl('cr-cfvst') != null) {
        r.push(['Kaltmiete im Jahr', eur(domZahl('cr-kaltmiete'))]);
        r.push(['minus nicht umlagefähige Kosten', eur(Math.abs(domZahl('cr-bwk-nul') || 0))]);
        r.push(['minus Zinsen', eur(Math.abs(domZahl('cr-zins') || 0))]);
        r.push(['minus Tilgung', eur(Math.abs(domZahl('cr-tilg') || 0))]);
        r.push(['= Cashflow vor Steuern im Jahr', eur(domZahl('cr-cfvst'), true), 1]);
        r.push(['im Monat', eur(domZahl('cr-cfvst') / 12, true), 1]);
      }
      var an = k.rate_an_m, kd = k.kd_dscr;
      return { t: 'Cashflow vor Steuern',
        a: 'Was nach Bewirtschaftung, Zins und Tilgung im Monat übrig bleibt, bevor die Steuer wirkt. Die Tilgung ist dabei kein verlorenes Geld, sie baut deine Schulden ab.',
        r: r,
        h: (an && kd) ? ('Ende Zinsbindung ' + domText('cf-vst-ezb') + ' im Monat, weil die Miete steigt und der Zinsanteil sinkt. Im Anschluss ' + domText('cf-vst-an') + ', dann mit einer Rate von ' + eur(an) + ' statt heute ' + eur(kd / 12) + ' im Monat.') : '' };
    },
    'cf-nst': function () {
      var r = [], st = domZahl('cr-st');
      if (domZahl('cr-cfns') != null) {
        r.push(['Cashflow vor Steuern im Jahr', eur(domZahl('cr-cfvst'), true)]);
        r.push([st >= 0 ? 'plus Steuererstattung' : 'minus Steuer', eur(Math.abs(st || 0))]);
        r.push(['= Cashflow nach Steuern im Jahr', eur(domZahl('cr-cfns'), true), 1]);
        r.push(['im Monat', domText('cr-cfm'), 1]);
      }
      return { t: 'Cashflow nach Steuern',
        a: 'Was wirklich auf deinem Konto ankommt. Ein steuerlicher Verlust aus der Vermietung senkt deine Steuer auf das übrige Einkommen, das ist die Erstattung.',
        r: r,
        h: (domText('cr-st-jahr').replace(/[()]/g, '') || '') + (st > 0 ? '. Die Erstattung kommt vor allem aus Abschreibung und Zinsen.' : st < 0 ? '. Ist das Ergebnis aus Vermietung positiv, zahlst du darauf Steuern.' : '') };
    },
    'kpi-ekr': function () {
      var k = K(); if (!(k.ek > 100) || k.ekr == null) return null;
      var basis = k.ekr * k.ek / 100;
      return { t: 'Eigenkapitalrendite',
        a: 'Wie sich dein eingesetztes Eigenkapital jedes Jahr laufend verzinst, vor Steuern und ohne Wertsteigerung.',
        r: [['Cashflow vor Steuern im Jahr', eur(basis, true)], ['geteilt durch Eigenkapital', eur(k.ek)], ['= Eigenkapitalrendite', pct(k.ekr), 1]],
        h: 'Gerechnet für ein volles Jahr nach den heutigen Eingaben, so rechnen auch Score, Bank und PDF. ' + (k.heute && k.heute.jahr ? 'Der Cashflow links zeigt dagegen das laufende Jahr ' + k.heute.jahr + '.' : '') + ' Ab 8 % gilt sie als gut, unter 4 % als schwach. Die Tilgung zählt hier als Ausgabe, im IRR dagegen als Vermögen.' };
    },
    'kpi-bmy': function () {
      var k = K(); if (!k.kp) return null;
      return { t: 'Bruttomietrendite', a: 'Jahreskaltmiete im Verhältnis zum Kaufpreis. Die schnelle Orientierung ohne Kosten.',
        r: [['Jahreskaltmiete', eur(k.nkm_j)], ['geteilt durch Kaufpreis', eur(k.kp)], ['= Bruttomietrendite', pct(k.bmy, 2), 1]],
        h: 'Ab 5 % gut, unter 3,5 % schwach. Kaufnebenkosten und laufende Kosten fehlen hier noch, dazu dient die Nettomietrendite.' };
    },
    'kpi-nmy': function () {
      var k = K(); if (!k.gi) return null;
      return { t: 'Nettomietrendite', a: 'Was die Miete nach den Kosten, die du selbst trägst, auf die gesamte Investition bringt.',
        r: [['Jahreskaltmiete', eur(k.nkm_j)], ['minus nicht umlagefähige Kosten', eur(k.bwk_cf)], ['geteilt durch Gesamtinvestition', eur(k.gi)], ['= Nettomietrendite', pct(k.nmy, 2), 1]],
        h: 'Gesamtinvestition ist Kaufpreis plus Nebenkosten. Ab 3 % gut, unter 2 % schwach.' };
    },
    'kpi-irr': function () {
      var x = R(), k = K(); if (!x || !x.cf || x.irr == null) return null;
      var summe = x.cf.reduce(function (a, b) { return a + b; }, 0), n = x.cf.length;
      var r = [['Einsatz Eigenkapital', eur(-x.ek)], ['laufende Cashflows in ' + n + ' Jahren', eur(summe, true)],
        ['Verkauf zum Wert', eur(x.exit_vkp)], ['minus Restschuld', eur(x.rs_ende)], ['= Erlös am Ende', eur(x.exit, true)], ['= IRR im Jahr', pct(x.irr), 1]];
      var traeger = (x.exit > Math.abs(summe) * 2) ? ' Den größten Teil trägt der Erlös am Ende. Die Annahme zur Wertsteigerung ist also die wichtigste Stellschraube.' : '';
      return { t: 'IRR, die Verzinsung über die ganze Haltedauer',
        a: 'Der Zinssatz, zu dem sich dein Eigenkapital über ' + n + ' Jahre verzinst. Er rechnet jede Zahlung zu ihrem Zeitpunkt ein, also Einsatz, jeden Jahres-Cashflow nach Steuern und den Erlös beim Verkauf.',
        r: r, h: 'Ab 8 % gut, unter 4 % schwach.' + traeger };
    },
    'kpi-em': function () {
      var k = K(); if (!(k.ek > 100) || k.em == null) return null;
      var j = (window.State && State.btj) || '';
      return { t: 'Equity Multiple', a: 'Wie oft dein Eigenkapital als Vermögenszuwachs zurückkommt.',
        r: [['Netto-Vermögenszuwachs nach ' + j + ' Jahren', eur(k.em * k.ek)], ['geteilt durch Eigenkapital', eur(k.ek)], ['= Equity Multiple', zahl(k.em, 1) + ' x', 1]],
        h: 'Bei 2,0 hast du deinen Einsatz verdoppelt. Woraus der Zuwachs besteht, zeigt die Karte Vermögenszuwachs weiter unten.' };
    },
    'kpi-dscr': function () {
      var k = K(); if (!k.kd_dscr) return null;
      return { t: 'DSCR, trägt die Miete die Rate?', a: 'Wie oft der Reinertrag den Kapitaldienst deckt. Banken schauen darauf zuerst.',
        r: [['Reinertrag (Miete minus eigene Kosten)', eur(k.noi_dscr)], ['geteilt durch Zins und Tilgung im Jahr', eur(k.kd_dscr)], ['= DSCR', zahl(k.dscr, 2), 1]],
        h: (k.dscr < 1 ? 'Unter 1,0 trägt die Miete die Rate nicht ganz, du zahlst zu. ' : '') + 'Banken erwarten meist 1,1 bis 1,2. Gerechnet für ein volles Jahr nach den heutigen Eingaben, so rechnen auch Score, Bank und PDF. ' + (k.heute && k.heute.jahr ? 'Die Karte Cashflow, korrekte Berechnung zeigt den DSCR ' + k.heute.jahr + ', also das laufende Jahr.' : '') };
    },
    'kpi-ltv': function () {
      var k = K(); if (!k.ltv || !k.d_total) return null;
      var basis = k.d_total / (k.ltv / 100);
      return { t: 'LTV, Beleihungsauslauf', a: 'Wie viel vom Wert der Immobilie finanziert ist.',
        r: [['Darlehen', eur(k.d_total)], ['geteilt durch Wert', eur(basis)], ['= LTV', pct(k.ltv), 1]],
        h: 'Unter 85 % gut, bis 100 % üblich, darüber ist mehr finanziert, als das Objekt wert ist. Mit jeder Tilgung sinkt der LTV.' };
    },
    'kpi-be': function () {
      var k = K(), x = R(); if (!x || !x.cf) return null;
      var be = k.be_cf, kum = k.be_kum, neg = 0, max = 0;
      x.cf.forEach(function (v, i) { if (be == null || i < be - 1) { if (v < 0) { neg += v; if (v < max) max = v; } } });
      if (be == null) return { t: 'Break-even', a: 'In ' + x.cf.length + ' Jahren wird der jährliche Cashflow nicht positiv.', r: [['Zuzahlung zusammen', eur(Math.abs(neg))]], h: 'Mehr Eigenkapital, eine niedrigere Rate oder eine höhere Miete verschieben das.' };
      var j = kalJahr(be), r = [['Zuzahlung bis dahin zusammen', eur(Math.abs(neg))], ['höchste Zuzahlung in einem Jahr', eur(Math.abs(max))]];
      if (x.cf[be - 1] != null) r.push(['Cashflow im Jahr ' + be, eur(x.cf[be - 1], true), 1]);
      var sprung = '';
      var vor = x.cf[be - 2], nach = x.cf[be - 1];
      if (vor != null && nach != null && nach - vor > Math.max(300, Math.abs(vor))) {
        sprung = ' Der Sprung kommt mit der Anschlussfinanzierung nach der Zinsbindung' + ((k.rate_an_m && k.kd_dscr) ? ': die Rate sinkt von ' + eur(k.kd_dscr / 12) + ' auf ' + eur(k.rate_an_m) + ' im Monat.' : '.');
      }
      return { t: 'Break-even, warum Jahr ' + be,
        a: 'Ab Jahr ' + be + (j ? ' (' + j + ')' : '') + ' bleibt nach Zins, Tilgung und Steuer Geld übrig. Bis dahin zahlst du jedes Jahr zu, weil Miete und Rate noch nicht zueinander passen.' + sprung,
        r: r,
        h: kum != null ? ('Unterm Strich ist alles Zugezahlte ab Jahr ' + kum + (kalJahr(kum) ? ' (' + kalJahr(kum) + ')' : '') + ' wieder eingespielt.') : 'Das Zugezahlte ist in der Haltedauer noch nicht wieder eingespielt.' };
    },
    'kpi-fak': function () {
      var k = K(); if (!k.nkm_j) return null;
      return { t: 'Kaufpreisfaktor', a: 'Wie viele Jahreskaltmieten du für das Objekt zahlst.',
        r: [['Kaufpreis', eur(k.kp)], ['geteilt durch Jahreskaltmiete', eur(k.nkm_j)], ['= Faktor', zahl(k.fak, 1), 1]],
        h: 'Unter 20 günstig, 20 bis 25 üblich, über 25 teuer. Der Faktor ist der Kehrwert der Bruttomietrendite.' };
    }
  };

  /* ── Erklärkarte ──────────────────────────────────────────────────────── */
  var pop = null, aktiv = null;
  function stil() {
    if (document.getElementById('bwa-stil')) return;
    var s = document.createElement('style'); s.id = 'bwa-stil';
    s.textContent = [
      '.bwa-pop{position:fixed;z-index:9000;max-width:340px;background:#FFFFFF;color:#2A2727;border:1px solid #E6E0D3;border-radius:12px;box-shadow:0 12px 32px rgba(20,16,8,.16);padding:12px 14px;font:400 12.5px/1.45 Inter,sans-serif;pointer-events:none;opacity:0;transition:opacity .12s}',
      '.bwa-pop.an{opacity:1}',
      '.bwa-pop b.t{display:block;font:600 13px/1.3 "Space Grotesk",Inter,sans-serif;margin-bottom:4px}',
      '.bwa-pop p{margin:0 0 8px}',
      '.bwa-pop table{width:100%;border-collapse:collapse;margin:2px 0 8px;font-variant-numeric:tabular-nums}',
      '.bwa-pop td{padding:2px 0;border-bottom:1px solid #F0EBDF}',
      '.bwa-pop td:last-child{text-align:right;white-space:nowrap;padding-left:10px}',
      '.bwa-pop tr.s td{font-weight:600;border-bottom:none}',
      '.bwa-pop .h{color:#6B6356;font-size:12px}',
      '#s6 [data-bwe]{cursor:help}',
      '#s6 .bw-kz .kpi[data-bwe]:hover,#s6 .bw-cf-row[data-bwe]:hover{border-color:#C9B98F !important}',
      /* Ansicht */
      'body.bwa-an #s6 .bwa-aus{display:none !important}',
      'body.bwa-an #s6 > .col2.bwa-eins{grid-template-columns:minmax(0,1fr) !important}',
      '#s6 .bwa-leiste{display:flex;justify-content:flex-end;margin:-4px 0 8px}',
      '#s6 .bwa-knopf{font:600 12px Inter,sans-serif;color:#2A2727;background:#FFFFFF;border:1px solid #E6E0D3;border-radius:999px;padding:6px 12px;cursor:pointer}',
      '#s6 .bwa-knopf:hover{border-color:#C9B98F}',
      '#s6 .bwa-panel{background:#FFFFFF;color:#2A2727;border:1px solid #E6E0D3;border-radius:14px;padding:14px 16px;margin:0 0 14px;font:400 13px/1.4 Inter,sans-serif}',
      '#s6 .bwa-panel .k{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
      '#s6 .bwa-panel .k b{font:600 14px "Space Grotesk",Inter,sans-serif}',
      '#s6 .bwa-panel .hd{font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6356;margin:10px 0 4px}',
      '#s6 .bwa-panel .g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px}',
      '@media (max-width:640px){#s6 .bwa-panel .g{grid-template-columns:1fr}}',
      '#s6 .bwa-panel label{display:flex;gap:8px;align-items:flex-start;padding:5px 0;cursor:pointer}',
      '#s6 .bwa-panel label.fest{opacity:.6;cursor:default}',
      '#s6 .bwa-panel label small{display:block;color:#6B6356;font-size:11.5px}',
      '#s6 .bwa-panel .f{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function zeige(el) {
    var key = el.getAttribute('data-bwe'), f = ERKL[key]; if (!f) return;
    var d = null; try { d = f(); } catch (e) { d = null; }
    if (!d) return;
    if (!pop) { pop = document.createElement('div'); pop.className = 'bwa-pop'; pop.setAttribute('role', 'tooltip'); document.body.appendChild(pop); }
    pop.innerHTML = '<b class="t">' + esc(d.t) + '</b><p>' + esc(d.a) + '</p>' +
      (d.r && d.r.length ? '<table>' + d.r.filter(function (z) { return z[1]; }).map(function (z) { return '<tr' + (z[2] ? ' class="s"' : '') + '><td>' + esc(z[0]) + '</td><td>' + esc(z[1]) + '</td></tr>'; }).join('') + '</table>' : '') +
      (d.h ? '<div class="h">' + esc(d.h) + '</div>' : '');
    var r = el.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
    pop.style.maxWidth = w + 'px';
    pop.style.left = '0px'; pop.style.top = '0px'; pop.classList.add('an');
    var ph = pop.offsetHeight, pw = pop.offsetWidth;
    var left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
    var top = r.bottom + 8; if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    aktiv = el;
  }
  function weg() { if (pop) pop.classList.remove('an'); aktiv = null; }

  function markieren() {
    var s6 = document.getElementById('s6'); if (!s6) return;
    ['kpi-ekr', 'kpi-bmy', 'kpi-nmy', 'kpi-irr', 'kpi-em', 'kpi-dscr', 'kpi-ltv', 'kpi-be', 'kpi-fak'].forEach(function (id) {
      var v = document.getElementById(id), kach = v && v.closest('.kpi');
      if (kach && !kach.hasAttribute('data-bwe')) { kach.setAttribute('data-bwe', id); kach.setAttribute('tabindex', '0'); }
    });
    var rows = s6.querySelectorAll('.bw-cf-row');
    if (rows[0] && !rows[0].hasAttribute('data-bwe')) { rows[0].setAttribute('data-bwe', 'cf-vst'); rows[0].setAttribute('tabindex', '0'); }
    if (rows[1] && !rows[1].hasAttribute('data-bwe')) { rows[1].setAttribute('data-bwe', 'cf-nst'); rows[1].setAttribute('tabindex', '0'); }
  }
  function erklaerungStart() {
    stil(); markieren();
    var s6 = document.getElementById('s6'); if (!s6 || s6.__bwe) return; s6.__bwe = true;
    s6.addEventListener('mouseover', function (e) { var el = e.target.closest && e.target.closest('[data-bwe]'); if (el && el !== aktiv) zeige(el); });
    s6.addEventListener('mouseout', function (e) { var el = e.target.closest && e.target.closest('[data-bwe]'); if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) weg(); });
    s6.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('[data-bwe]'); if (el) zeige(el); });
    s6.addEventListener('focusout', weg);
    window.addEventListener('scroll', weg, true);
  }

  /* ── Ansicht anpassen ─────────────────────────────────────────────────── */
  var ANSICHT = [
    { k: 'score', t: 'Gesamturteil und Deal Score', g: 'an', fest: true, w: 'Der Score, den du in den Einstellungen gewählt hast.' },
    { k: 'wichtig', t: 'Das Wichtigste', g: 'an', w: 'Drei bis fünf Stichpunkte aus der Pilot-Analyse, mit Ampel.' },
    { k: 'kz', t: 'Kennzahlen auf einen Blick', g: 'an', fest: true, w: 'Cashflow, Rendite, Finanzierung, Risiko und Preis mit Erklärung beim Darüberfahren.' },
    { k: 'rechnung', t: 'Cashflow, korrekte Berechnung', g: 'an', w: 'Von der Warmmiete bis zum Cashflow nach Steuern, je Phase.' },
    { k: 'wert', t: 'Wert und Zielbild', g: 'an', w: 'Was das Objekt nach jedem Verfahren wert ist und wohin es geht.' },
    { k: 'vz', t: 'Vermögenszuwachs', g: 'an', w: 'Woraus dein Zuwachs besteht: Tilgung, Überschuss, Steuer, Wert.' },
    { k: 'verm', t: 'Vermögensaufbau als Grafik', g: 'an', w: 'Die Schere zwischen Wert und Restschuld über die Jahre.' },
    { k: 'bank', t: 'Einordnung für die Bank', g: 'an', w: 'DSCR, Beleihungsauslauf und Zinsrisiko gegen die Bankschwellen.' },
    { k: 'proj', t: 'Cashflow-Projektion', g: 'an', w: 'Jahr für Jahr Miete, Kosten, Rate und Steuer.' },
    { k: 'bewertung', t: 'Kennzahlen-Bewertung als Tabelle', g: 'aus', w: 'Jede Kennzahl mit Ampel und Hinweis. Steckt jetzt in den Kacheln.' },
    { k: 'alle', t: 'Alle Kennzahlen als Liste', g: 'aus', w: 'Dieselben Werte wie die Kacheln, dazu DSCR brutto und Wertpuffer.' },
    { k: 'phasen', t: 'Kennzahlen-Vergleich je Phase', g: 'aus', w: 'Heute, Ende Zinsbindung, Anschluss nebeneinander.' },
    { k: 'zaer', t: 'Zinsänderungsrisiko im Detail', g: 'aus', w: 'Steckt als Heatmap in der Einordnung.' }
  ];
  function ziele() {
    var q = function (s) { return document.querySelector(s); };
    var c2 = q('#s6 > .col2');
    return {
      rechnung: c2 && c2.children[0], alle: c2 && c2.children[1],
      wert: q('#card-wert-zielbild'), vz: q('#card-vermoegen-zuwachs'), verm: q('#dp-gb-verm'), bank: q('#dp-gb-bank'),
      wichtig: q('#bwa-wichtig'), proj: q('#card-cashflow-projektion'), bewertung: q('#kpi-eval-card'), phasen: q('#s6 > .phase-compare-card'), zaer: q('#s6 > .zaer-card')
    };
  }
  var _ans = null, _server = false, _frei = false, _offen = false;
  function laden() {
    if (_ans) return _ans;
    _ans = {}; try { _ans = JSON.parse(localStorage.getItem('dp_bw_ansicht') || '{}') || {}; } catch (e) { _ans = {}; }
    if (!_server) {
      _server = true;
      try { if (window.Auth && Auth.apiCall) Auth.apiCall('/user-settings/bewertung_ansicht').then(function (r) {
        var w = r && r.wert && r.wert.an; if (!w || typeof w !== 'object') return;
        _ans = w; try { localStorage.setItem('dp_bw_ansicht', JSON.stringify(w)); } catch (e) {}
        anwenden();
      }).catch(function () {}); } catch (e) {}
    }
    return _ans;
  }
  function speichern() {
    try { localStorage.setItem('dp_bw_ansicht', JSON.stringify(_ans || {})); } catch (e) {}
    try { if (window.Auth && Auth.apiCall) Auth.apiCall('/user-settings/bewertung_ansicht', { method: 'PUT', body: { wert: { v: 1, an: _ans || {} } } }).catch(function () {}); } catch (e) {}
  }
  function sichtbar(k) {
    var a = ANSICHT.filter(function (x) { return x.k === k; })[0]; if (!a || a.fest) return true;
    var A = laden(); return Object.prototype.hasOwnProperty.call(A, k) ? !!A[k] : a.g !== 'aus';
  }
  function anwenden() {
    if (!_frei) return;
    document.body.classList.add('bwa-an');
    var Z = ziele();
    Object.keys(Z).forEach(function (k) { if (Z[k]) Z[k].classList.toggle('bwa-aus', !sichtbar(k)); });
    var c2 = document.querySelector('#s6 > .col2');
    if (c2) c2.classList.toggle('bwa-eins', !sichtbar('rechnung') !== !sichtbar('alle'));
    if (c2) c2.classList.toggle('bwa-aus', !sichtbar('rechnung') && !sichtbar('alle'));
    var bh = document.querySelector('#s6 > .bc-section-header');
    if (bh) bh.classList.toggle('bwa-aus', !sichtbar('verm') && !sichtbar('bank'));
  }
  function panelHtml() {
    var z = function (a) {
      var an = sichtbar(a.k);
      return '<label class="' + (a.fest ? 'fest' : '') + '"><input type="checkbox" data-bwa="' + a.k + '"' + (an ? ' checked' : '') + (a.fest ? ' disabled' : '') + '>' +
        '<span><b>' + esc(a.t) + '</b>' + (a.fest ? ' <i>immer</i>' : '') + '<small>' + esc(a.w) + '</small></span></label>';
    };
    return '<div class="k"><b>Ansicht anpassen</b><button type="button" class="bwa-knopf" data-bwa-a="zu" aria-label="Schließen">Fertig</button></div>' +
      '<div class="hd">Grundsetup</div><div class="g">' + ANSICHT.filter(function (a) { return a.g !== 'aus'; }).map(z).join('') + '</div>' +
      '<div class="hd">Optional</div><div class="g">' + ANSICHT.filter(function (a) { return a.g === 'aus'; }).map(z).join('') + '</div>' +
      '<div class="f"><button type="button" class="bwa-knopf" data-bwa-a="grund">Grundsetup wiederherstellen</button></div>';
  }
  function leiste() {
    var s6 = document.getElementById('s6'); if (!s6 || !_frei) return;
    var l = s6.querySelector(':scope > .bwa-leiste');
    if (!l) {
      l = document.createElement('div'); l.className = 'bwa-leiste';
      l.innerHTML = '<button type="button" class="bwa-knopf" data-bwa-a="auf">Ansicht anpassen</button>';
      var d = s6.querySelector(':scope > .sec-desc'); if (d && d.nextSibling) s6.insertBefore(l, d.nextSibling); else s6.insertBefore(l, s6.firstChild);
      s6.addEventListener('click', klick);
      s6.addEventListener('change', function (e) {
        var k = e.target && e.target.getAttribute && e.target.getAttribute('data-bwa'); if (!k) return;
        laden(); _ans[k] = !!e.target.checked; speichern(); anwenden();
      });
    }
    var p = s6.querySelector(':scope > .bwa-panel');
    if (_offen) {
      if (!p) { p = document.createElement('div'); p.className = 'bwa-panel'; l.parentNode.insertBefore(p, l.nextSibling); }
      p.innerHTML = panelHtml(); l.style.display = 'none';
    } else { if (p) p.parentNode.removeChild(p); l.style.display = ''; }
  }
  function klick(e) {
    var b = e.target.closest && e.target.closest('[data-bwa-a]'); if (!b) return;
    var a = b.getAttribute('data-bwa-a');
    if (a === 'auf') _offen = true;
    else if (a === 'zu') _offen = false;
    else if (a === 'grund') { _ans = {}; speichern(); }
    leiste(); anwenden();
  }
  window._dpBewertungAnsicht = function () {
    try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (e) {}
    try { if (window.DealPilotDashboard && DealPilotDashboard.close) DealPilotDashboard.close(); } catch (e) {}
    try { var t = document.querySelector('.tab[data-target-sec="s6"]'); if (t) t.click(); } catch (e) {}
    _offen = true; setTimeout(function () { leiste(); anwenden(); var p = document.querySelector('#s6 > .bwa-panel'); if (p) try { p.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} }, 300);
  };

  /* v4450a · Marcel: „auch Bewertung-Tab mit Bullet Points“. Oben „Das Wichtigste“: die Stichpunkte der Einordnung aus der
     gespeicherten Pilot-Analyse (window._aiAnalysis.kernpunkte, dieselben wie dort), keine zweite KI-Abfrage. Ohne
     Stichpunkte ein Hinweis mit dem Weg zur Pilot-Analyse. */
  function wichtigesHtml() {
    var a = window._aiAnalysis, k = a && a.kernpunkte && typeof a.kernpunkte === 'object' ? a.kernpunkte : null;
    var norm = function (x, ton) { var t = typeof x === 'string' ? x : (x && (x.t || x.text)) || ''; t = String(t).replace(/\s+[–—]\s+/g, ', ').replace(/\s*;\s*/g, ', ').replace(/\*\*/g, '').trim();
      var o = x && typeof x === 'object' ? String(x.ton || '').toLowerCase() : ''; return { t: t, ton: ton || (o === 'gut' || o === 'schlecht' ? o : 'neutral') }; };
    var p = [];
    if (k && Array.isArray(k.einordnung)) p = k.einordnung.map(function (x) { return norm(x); });
    if (k && p.length < 3 && Array.isArray(k.risiken)) p = p.concat(k.risiken.map(function (x) { return norm(x, 'schlecht'); }));
    p = p.filter(function (x) { return x.t && !/^\.\.\./.test(x.t); }).slice(0, 5);
    var link = '<button type="button" class="bwa-knopf" onclick="var t=document.querySelector(\'.tab[data-target-sec]\');Array.prototype.forEach.call(document.querySelectorAll(\'nav.tabs .tab\'),function(b){if(/Pilot-Analyse/.test(b.textContent))t=b;});if(t)t.click();">Zur Pilot-Analyse</button>';
    if (!p.length) return '<div class="bwa-w-k"><b>Das Wichtigste</b>' + link + '</div><p class="bwa-w-hin">' + (a ? 'Mit der nächsten Pilot-Analyse steht hier das Wichtigste in Stichpunkten.' : 'Sobald eine Pilot-Analyse vorliegt, steht hier das Wichtigste in Stichpunkten.') + '</p>';
    return '<div class="bwa-w-k"><b>Das Wichtigste</b>' + link + '</div><ul class="bwa-w">' + p.map(function (x) { return '<li class="' + x.ton + '">' + esc(x.t) + '</li>'; }).join('') + '</ul>';
  }
  function wichtigesZeigen() {
    var s6 = document.getElementById('s6'); if (!s6) return;
    var c = document.getElementById('bwa-wichtig');
    if (!c) {
      c = document.createElement('div'); c.id = 'bwa-wichtig'; c.className = 'card bwa-wichtig';
      var m = document.getElementById('dpsh-mount');
      if (m && m.parentNode === s6) s6.insertBefore(c, m.nextSibling); else { var d = s6.querySelector(':scope > .sec-desc'); s6.insertBefore(c, d ? d.nextSibling : s6.firstChild); }
    }
    c.innerHTML = wichtigesHtml();
    if (_frei) c.classList.toggle('bwa-aus', !sichtbar('wichtig'));
  }
  function wichtigStil() {
    if (document.getElementById('bwa-wichtig-stil')) return;
    var st = document.createElement('style'); st.id = 'bwa-wichtig-stil';
    st.textContent = '#bwa-wichtig{padding:14px 18px;margin:12px 0;background:#F8F6F1;border:1px solid #E4DED2;border-radius:12px}'
      + '#bwa-wichtig .bwa-w-k{display:flex;align-items:center;justify-content:space-between;gap:10px}'
      + '#bwa-wichtig .bwa-w-k b{font:600 15px/1.3 "Space Grotesk",Inter,sans-serif;color:#2A2727}'
      + '#bwa-wichtig .bwa-w{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:7px;font:400 13.5px/1.45 Inter,system-ui,sans-serif;color:#2A2727}'
      + '#bwa-wichtig .bwa-w li{position:relative;padding-left:18px}'
      + '#bwa-wichtig .bwa-w li::before{content:"";position:absolute;left:2px;top:.5em;width:8px;height:8px;border-radius:50%;background:#A39E95}'
      + '#bwa-wichtig .bwa-w li.gut::before{background:#3FA56C}#bwa-wichtig .bwa-w li.schlecht::before{background:#B8625C}'
      + '#bwa-wichtig .bwa-w-hin{margin:6px 0 0;font:400 12.5px/1.5 Inter,system-ui,sans-serif;color:#6B645A}';
    document.head.appendChild(st);
  }

  function start() {
    wichtigStil();
    document.addEventListener('dp:object-ready', function () { setTimeout(wichtigesZeigen, 300); });
    erklaerungStart();
    try {
      if (window.DpVorschau) window.DpVorschau.frei('grafiken_neu').then(function (an) {
        if (!an) return; _frei = true; laden(); leiste(); anwenden();
      });
    } catch (e) {}
    /* Reiter werden nachgerendert (dp-gb-*, Wert & Zielbild): beim Öffnen des Reiters erneut anwenden */
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.tab[data-target-sec="s6"]');
      if (t) setTimeout(function () { markieren(); anwenden(); wichtigesZeigen(); }, 400);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.DpBewertungAnsicht = { erkl: ERKL, sichtbar: sichtbar, anwenden: anwenden };
})();
