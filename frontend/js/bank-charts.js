'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V25 — bank-charts.js
   Bank-taugliche SVG-Charts (4 Stück), ersetzt Chart.js-Defaults:
   1. Equity-Build (Immobilienschere neu gedacht)
   2. Bank-Cockpit (DSCR + LTV mit Trends)
   3. Vermögenszuwachs-Waterfall
   4. Stress-Test-Matrix (DSCR bei Zins/Mietausfall-Szenarien)

   API: window.BankCharts.renderAll(state, kpis)
   API: window.BankCharts.buildBankPdfPayload() → Datenobjekt für PDF
═══════════════════════════════════════════════════════════════ */

(function() {

  // ───────────── Format-Helpers ─────────────
  function _fmtEUR(v, signed) {
    var n = Math.round(v || 0);
    var s = Math.abs(n).toLocaleString('de-DE');
    if (signed && n > 0) return '+' + s + ' €';
    if (n < 0) return '−' + s + ' €';
    return s + ' €';
  }
  function _fmtK(v, signed) {
    var n = v || 0;
    var sign = signed ? (n > 0 ? '+' : (n < 0 ? '−' : '')) : (n < 0 ? '−' : '');
    var abs = Math.abs(n);
    if (abs >= 1000) return sign + (abs/1000).toFixed(0) + 'k €';
    return sign + Math.round(abs) + ' €';
  }
  function _fmtPct(v, decimals) {
    var d = decimals == null ? 1 : decimals;
    return (v || 0).toFixed(d).replace('.', ',') + ' %';
  }
  function _fmtNum(v, decimals) {
    var d = decimals == null ? 2 : decimals;
    return (v || 0).toFixed(d).replace('.', ',');
  }

  // ───────────── DSCR pro Jahr ─────────────
  // DSCR = Nettomieteinnahmen / Kapitaldienst (Zinsen + Tilgung)
  function _dscrPerYear(cfRows, ze) {
    ze = ze || 0;
    return cfRows.map(function(r) {
      var noi = (r.nkm_m + ze) * 12;
      // V63.68: Bei Tilgungsaussetzung mit Bausparvertrag muss die Sparrate
      // (bspar_y) als wirtschaftlicher Tilgungsersatz im Kapitaldienst berücksichtigt
      // werden — sonst ist DSCR künstlich überhöht (Zinsen-only-Vergleich).
      // Konsistent zur Phasentabelle (calc.js V63.57: nowVals.dscr inkl. K.bspar_j).
      var bspar = r.bspar_y || 0;
      var kd = r.zy + r.ty + bspar;
      return kd > 0 ? noi / kd : 0;
    });
  }

  // ───────────── DSCR-Klassifizierung ─────────────
  function _dscrCls(dscr) {
    if (dscr >= 1.2) return 'good';
    if (dscr >= 1.0) return 'warn';
    if (dscr >= 0.8) return 'bad';
    return 'critical';
  }
  function _dscrLabel(dscr) {
    if (dscr >= 1.5) return 'sehr solide';
    if (dscr >= 1.2) return 'solide';
    if (dscr >= 1.0) return 'knapp';
    if (dscr >= 0.8) return 'kritisch';
    return 'Stress';
  }
  function _ltvCls(ltv) {
    // V63.65: Einheitlich zu DealScore und System-Definition: <85% grün, 85-100% gold, >100% rot
    if (ltv <= 60) return 'good';
    if (ltv <= 85) return 'ok';
    if (ltv <= 100) return 'warn';
    return 'bad';
  }
  function _ltvLabel(ltv) {
    if (ltv <= 60) return 'sehr sicher';
    if (ltv <= 85) return 'solide';
    if (ltv <= 100) return 'erhöht';
    return 'kritisch';
  }

  // ───────────── SVG-Helper ─────────────
  function _esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function(c) { return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]; }); }

  // ═══════════════════════════════════════════════════════════════
  //  CHART 1 — EQUITY-BUILD
  // ═══════════════════════════════════════════════════════════════
  function _renderEquityBuild(host, state) {
    if (!host) return;
    var cfRows = state.cfRows;
    if (!cfRows || cfRows.length < 2) {
      host.innerHTML = '<div class="bc-empty">Equity-Chart wird berechnet sobald Werte eingegeben sind…</div>';
      return;
    }
    var bindj = state.bindj || 10;
    // V109: kp0 entfernt — war ungenutzter Dead Code aus alter Iteration
    var startWert = cfRows[0].wert_y;
    // V63.64: Wenn BSV vorhanden, nutze "effektive Restschuld" (= rs minus angespartes Bausparguthaben)
    var _hasBspar = cfRows.some(function(r){ return (r.bspar_kum || 0) > 0; });
    var endRow = cfRows[cfRows.length - 1];
    // V63.85: endWert konsistent mit Frontend-Equity-Build-Box: wert_basis × (1+wstg)^btj
    var _wstg = (state.wstg != null) ? state.wstg : 0.015;
    var endWert = startWert * Math.pow(1 + _wstg, cfRows.length);
    var endRs   = (endRow.eff_rs != null ? endRow.eff_rs : endRow.rs);
    // V116 EQUITY-FIX: Marcels Definition — Equity-Klammer = Wertsteigerung + Tilgung kumuliert
    //   (KEIN eingesetztes EK enthalten!).
    //   Vorher: equityGain = (endWert - endRs) - (startWert - startRs)
    //           startRs aus cfRows[0].eff_rs = Stand ENDE Jahr 1 (nicht Anfang!)
    //           → tilg_kum systematisch um Tilgung Jahr 1 unterschätzt; bei BSV-Aktivierung
    //             zusätzlich Verzerrung weil bspar_kum am Jahr-Ende-1 schon positiv ist.
    //
    // V119 — Marcels neue Definition: "Equity = Marktwert minus Restschuld" (= das, was
    //   zwischen den beiden Linien im Chart steht). Das ist die End-Equity, nicht der
    //   Equity-Aufbau. Bei Bäckerstr.7 (Vollfinanzierung 250k auf 195k KP, 4% Tilgung):
    //   - endWert ≈ 305k
    //   - endRs   ≈ 0 (Volltilgung in 15J durch 11% Annuität)
    //   - End-Equity = 305k
    //   Vorher zeigte das Chart equityGain = 335k (Wertsteig 85k + Tilg 250k) — irreführend.
    var wertsteig_kum = endWert - startWert;
    var initialeRs    = (state.kpis && state.kpis.d1) || cfRows[0].rs + (cfRows[0].ty || 0);
    var tilgung_kum_brutto = Math.max(0, initialeRs - (endRow.rs || 0));   // Schuld-Reduktion (formale Rs)
    var bspar_kum_end      = (endRow.bspar_kum || 0);                       // angespartes BSV-Guthaben
    // Bei BSV-Lifecycle wirkt das Guthaben wirtschaftlich wie Tilgung
    var tilgung_kum_eff    = tilgung_kum_brutto + bspar_kum_end;
    // V119: Equity = Marktwert minus Restschuld am Ende (Marcels Definition).
    //   Bei BSV: eff_rs ist schon "Restschuld minus Bauspar-Guthaben" → richtig.
    var equityGain = endWert - endRs;
    // Equity-Endwert = Anfangs-EK + Equity-Aufbau (für Multiple-Berechnung weiterhin nötig)
    var equity     = endWert - endRs;
    var startEq    = startWert - initialeRs;

    // V111 BUG-FIX: Mein V110-Fix hatte einen virtuellen Endpunkt eingeführt, dessen rs/eff_rs
    //   identisch zum letzten cfRows-Eintrag waren → rote Linie wurde auf der letzten Periode FLACH.
    //   Marcels Beobachtung: "die Linien knicken am Ende".
    //
    //   Wurzel des Problems: cfRows[i] hat einen Daten-Mismatch innerhalb einer Zeile —
    //   wert_y nutzt ^(y-1) (Stand ANFANG Jahr y), während rs3 schon "nach Tilgung Jahr y" ist
    //   (Stand ENDE Jahr y). Wenn man die letzten cfRows-Werte 1:1 als Endpunkt nimmt, hat
    //   rs den richtigen Wert (Ende Jahr btj) aber wert_y ist eine Periode zu früh.
    //
    //   Saubere Lösung: KEIN virtueller Endpunkt. Stattdessen die wert_y Werte für die Linie
    //   selbst um eine Periode "vorrücken" — jeder Punkt zeigt Stand ENDE Jahr y (= Anfang
    //   Jahr y+1). Damit endet die grüne Linie bei endWert (= ^btj) und die rote Linie folgt
    //   ihrem natürlichen Annuitäten-Verlauf bis endRs (= cfRows[n-1].rs nach btj Tilgungen).
    //
    //   Beides linear/glatt — kein Knick, keine Lücke.
    var chartRows = cfRows.map(function(r, i) {
      // wert_y so umrechnen dass es Stand "Ende Jahr y" zeigt (= ^y statt ^(y-1)).
      // Damit ist der letzte Eintrag (i = n-1, also y = btj) exakt endWert = wert_basis × (1+wstg)^btj.
      var wertEndJahr = startWert * Math.pow(1 + _wstg, i + 1);
      return {
        wert_y: wertEndJahr,
        rs:     r.rs,            // Restschuld ist schon "Ende Jahr y" — passt
        eff_rs: r.eff_rs,
        cal:    r.cal,
        cfns_y: r.cfns_y,
        bspar_kum: r.bspar_kum
      };
    });

    // V63.85 / V118: Kumulierter CF-Pfad signed.
    //   Vorher: nur positive Jahre summiert (Math.max). Bei dauerhaft negativem CF blieb
    //   die Linie auf Restschuld-Niveau — visuell falsch, weil der User dann ja Eigenmittel
    //   nachschießen muss (= Vermögens-MINDERUNG, nicht null). V118 zeigt das ehrlich:
    //   Linie geht UNTER die Restschuld-Linie wenn der CF dauerhaft Verlust macht.
    var cumOverflow = 0;
    var cfArr = cfRows.map(function(r){
      cumOverflow += (r.cfns_y || 0);  // V118 signed
      return cumOverflow;
    });
    var endCfCum = cfArr[cfArr.length - 1] || 0;

    // Footer-KPIs
    var ek0 = (state.kpis && state.kpis.ek) || 0;
    // V63.63: ∞ statt 0× bei Vollfinanzierung (kein EK eingesetzt)
    var multipleX = ek0 > 100 ? (equity / ek0) : null;
    var multipleStr = multipleX != null ? _fmtNum(multipleX, 1) + '×' : '∞';
    var ekLabelStr = ek0 > 100 ? ('bei ' + _fmtEUR(ek0) + ' EK') : 'kein EK eingesetzt';
    var wsGain = endWert - startWert;
    // V116: tilgGain für Footer-Fallback — Marcels Definition (Wertsteigerung+Tilgung)
    //   = tilgung_kum_eff (oben berechnet, inkl. BSV-Guthaben falls aktiv).
    var tilgGain = tilgung_kum_eff;
    // V116: Datenpunkt-Anfang der roten Linie konsistent zum ersten chartRows-Eintrag
    //   (= Ende Jahr 1, ist auch der Startpunkt des Pfades).
    var startRsDot = chartRows[0].eff_rs != null ? chartRows[0].eff_rs : chartRows[0].rs;

    // Y-Bereich: alle Werte rein (auch Original-rs damit Skala bei BSV passt)
    // V110: chartRows statt cfRows damit der virtuelle Endpunkt mit erfasst wird
    var allVals = [];
    chartRows.forEach(function(r) {
      allVals.push(r.rs);
      allVals.push(r.eff_rs != null ? r.eff_rs : r.rs);
      allVals.push(r.wert_y);
    });
    var yMin = Math.min.apply(null, allVals) * 0.95;
    var yMax = Math.max.apply(null, allVals) * 1.05;
    var yRange = yMax - yMin || 1;

    var n = chartRows.length;
    // Plot-Bereich: x 80→1080, y 50→320 (viewBox 1200x380)
    function px(i) { return 80 + (i / (n - 1)) * 1000; }
    function py(v) { return 50 + (1 - (v - yMin) / yRange) * 270; }

    // Path-Strings — V63.64: rsPath nutzt eff_rs (wirtschaftliche Schuld)
    // V110: chartRows enthält n cfRows + 1 virtueller Endpunkt → Linien gehen jetzt
    //       sauber zum Marker-Endpunkt (vorher Lücke zwischen Linien-Ende und Marker)
    var wertPath = chartRows.map(function(r, i) { return (i === 0 ? 'M ' : 'L ') + px(i).toFixed(1) + ' ' + py(r.wert_y).toFixed(1); }).join(' ');
    var rsPath = chartRows.map(function(r, i) { var v = r.eff_rs != null ? r.eff_rs : r.rs; return (i === 0 ? 'M ' : 'L ') + px(i).toFixed(1) + ' ' + py(v).toFixed(1); }).join(' ');
    // V63.64: Bei BSV zusätzlich gestrichelte Linie der "formalen" Restschuld (Bank-Schuld)
    var rsRawPath = _hasBspar
      ? chartRows.map(function(r, i) { return (i === 0 ? 'M ' : 'L ') + px(i).toFixed(1) + ' ' + py(r.rs).toFixed(1); }).join(' ')
      : null;
    // Equity-Fläche zwischen den Linien (eff_rs gegen wert_y)
    var eqAreaPath = chartRows.map(function(r, i) { return (i === 0 ? 'M ' : 'L ') + px(i).toFixed(1) + ' ' + py(r.wert_y).toFixed(1); }).join(' ')
      + ' ' + chartRows.slice().reverse().map(function(r, i) { var idx = n - 1 - i; var v = r.eff_rs != null ? r.eff_rs : r.rs; return 'L ' + px(idx).toFixed(1) + ' ' + py(v).toFixed(1); }).join(' ') + ' Z';

    // Y-Achsen-Labels (5 Werte)
    var yLabels = [];
    for (var i = 0; i <= 4; i++) {
      var v = yMax - (yRange / 4) * i;
      yLabels.push({y: 50 + (i / 4) * 270, label: _fmtK(v).replace(' €', 'k').replace(/k.*$/, 'k €')});
    }
    // X-Achsen-Labels (jedes 2. Jahr) — chartRows hat n Einträge, jeder zeigt "Ende Jahr y"
    // V111: Da chartRows jetzt 1:1 zu cfRows ist, normale Iteration. Label = cal+1 weil
    //   jeder Datenpunkt jetzt "Ende Jahr y = Anfang Jahr y+1" zeigt.
    var xLabels = [];
    chartRows.forEach(function(r, i) {
      if (i % 2 === 0 || i === n - 1) {
        xLabels.push({x: px(i), label: String((r.cal || new Date().getFullYear()) + 1)});
      }
    });

    // EZB-Marker-Position (bindj=10 Jahre → Ende Jahr bindj = Index bindj-1)
    var ezbIdx = Math.min(bindj - 1, n - 1);
    var ezbX = ezbIdx > 0 ? px(ezbIdx) : null;

    // V63.88: Werte konsistent zur Tab-Kennzahlen-Tabelle aus _vz lesen.
    // Marcels Bild 2: "Vermögen baut sich auf 100.839" Headline aber Footer-Werte
    // (98k EK, 16k CF, 21k Tilgungsanteil) addieren sich nicht dazu — verwirrend.
    // Lösung: Footer = exakt die 4 Bausteine die Charts zeigen.
    var _vzE = state._vz || (window.State && window.State._vz);
    var totalGain = _vzE ? _vzE.verm_zuwachs : (equityGain + endCfCum);

    // Footer-Werte aus _vz (= konsistent zu Wasserfall + Tab-Tabelle)
    // V123: fTilg ist jetzt die GESAMT-Tilgung (Schulden abgebaut, brutto) — nicht die
    //   Mieter-Anteils-Aufteilung. Marcels Wunsch: in der Grafik immer den vollen
    //   Tilgungswert sehen (= 144.725 € bei Bäckerstr.7), nicht 0 € weil der Mieter
    //   bei massiv negativem CF gar nichts zur Tilgung beiträgt.
    //   Die Mieter/Eigenanteil-Aufteilung steht weiterhin in der Vermögenszuwachs-Tabelle
    //   im Tab Kennzahlen — dort ergänzend.
    var fTilg = _vzE ? (_vzE.tilgung_kum || (_vzE.tilg_durch_einnahmen + _vzE.bspar_durch_einnahmen) || 0) : tilgGain;
    var fCfKonto = _vzE ? _vzE.cf_ueberschuss_konto : endCfCum;
    var fSteuer = _vzE ? _vzE.steuervorteil : 0;
    var fWert = _vzE ? _vzE.wertsteig_kum : wsGain;
    var head = (totalGain >= 0
      ? 'Vermögen baut sich auf <span class="accent">' + _fmtEUR(totalGain, true) + '</span>'
      : 'Vermögens-Erosion <span class="accent">' + _fmtEUR(totalGain) + '</span>');

    var html =
      '<div class="bc-card">' +
        '<div class="bc-head">' +
          '<div class="bc-head-left">' +
            '<div class="bc-head-eyebrow">Vermögensaufbau · ' + n + ' Jahre</div>' +
            '<h3 class="bc-head-title">' + head + '</h3>' +
            '<p class="bc-head-sub">Während die Restschuld durch die Tilgung sinkt, steigt der Marktwert. Die Schere zwischen beiden Linien ist Ihr aufgebautes Vermögen.</p>' +
          '</div>' +
          '<div class="bc-head-right">' +
            '<div class="bc-headline-kpi-label">Equity Multiple</div>' +
            '<div class="bc-headline-kpi">' + multipleStr + '</div>' +
            '<span class="bc-headline-kpi-trend">' +
              '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8l4-4 4 4"/></svg>' +
              ' ' + ekLabelStr +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="bc-body">' +
          '<div class="bc-svg-wrap">' +
            '<svg viewBox="0 0 1200 380" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
              '<defs>' +
                '<linearGradient id="bc-eq-grad" x1="0" y1="0" x2="0" y2="1">' +
                  '<stop offset="0%" stop-color="#3FA56C" stop-opacity="0.30"/>' +
                  '<stop offset="100%" stop-color="#3FA56C" stop-opacity="0.04"/>' +
                '</linearGradient>' +
              '</defs>' +
              // Grid
              '<g opacity="0.18" stroke="#2A2727" stroke-width="0.5">' +
                yLabels.map(function(l) { return '<line x1="80" y1="' + l.y + '" x2="1080" y2="' + l.y + '" stroke-dasharray="2 4"/>'; }).join('') +
              '</g>' +
              // Y-Labels
              '<g font-family="DM Sans" font-size="11" fill="#7A7370" font-weight="500" text-anchor="end">' +
                yLabels.map(function(l) { return '<text x="68" y="' + (l.y + 4) + '">' + l.label + '</text>'; }).join('') +
              '</g>' +
              // X-Labels
              '<g font-family="DM Sans" font-size="10.5" fill="#9C9590" font-weight="500" text-anchor="middle">' +
                xLabels.map(function(l) { return '<text x="' + l.x.toFixed(1) + '" y="345">' + l.label + '</text>'; }).join('') +
              '</g>' +
              // Equity-Fläche
              '<path d="' + eqAreaPath + '" fill="url(#bc-eq-grad)"/>' +
              // EZB-Marker (gestrichelte Linie + Label)
              (ezbX ? '<g>' +
                '<line x1="' + ezbX.toFixed(1) + '" y1="50" x2="' + ezbX.toFixed(1) + '" y2="320" stroke="#C9A84C" stroke-width="1" stroke-dasharray="2 4" opacity="0.55"/>' +
                '<rect x="' + (ezbX - 38).toFixed(1) + '" y="35" width="76" height="18" rx="3" fill="#C9A84C" opacity="0.95"/>' +
                '<text x="' + ezbX.toFixed(1) + '" y="48" font-family="DM Sans" font-size="9.5" fill="#1A1414" font-weight="700" text-anchor="middle" letter-spacing="0.10em">EZB · ' + ((cfRows[ezbIdx] && cfRows[ezbIdx].cal ? cfRows[ezbIdx].cal : new Date().getFullYear()) + 1) + '</text>' +
              '</g>' : '') +
              // Equity-Label IN der Fläche
              '<text x="' + ((px(0) + px(n-1)) / 2).toFixed(1) + '" y="200" font-family="Cormorant Garamond" font-size="42" fill="#3FA56C" font-weight="700" text-anchor="middle" opacity="0.18">EQUITY</text>' +
              // Marktwert-Linie (grün, oben)
              '<path d="' + wertPath + '" stroke="#3FA56C" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
              // V63.64: Bei BSV — gestrichelte Linie der formalen Bank-Schuld (sichtbar weniger sinkend)
              (rsRawPath ? '<path d="' + rsRawPath + '" stroke="#B8625C" stroke-width="1.5" stroke-dasharray="6 4" fill="none" stroke-linecap="round" opacity="0.55"/>' : '') +
              // Restschuld-Linie (rot, unten) — V63.64 effektive Schuld (rs minus Sparguthaben)
              '<path d="' + rsPath + '" stroke="#B8625C" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
              // Datenpunkte
              '<circle cx="' + px(0) + '" cy="' + py(startWert).toFixed(1) + '" r="5" fill="#3FA56C" stroke="#FAFAF7" stroke-width="2"/>' +
              '<circle cx="' + px(0) + '" cy="' + py(startRsDot).toFixed(1) + '" r="5" fill="#B8625C" stroke="#FAFAF7" stroke-width="2"/>' +
              '<circle cx="' + px(n-1) + '" cy="' + py(endWert).toFixed(1) + '" r="6" fill="#3FA56C" stroke="#FAFAF7" stroke-width="2"/>' +
              '<circle cx="' + px(n-1) + '" cy="' + py(endRs).toFixed(1) + '" r="6" fill="#B8625C" stroke="#FAFAF7" stroke-width="2"/>' +
              // End-Annotationen RECHTS (versetzt nach LINKS damit Datenpunkt sichtbar bleibt)
              '<g>' +
                '<rect x="' + (px(n-1) - 165).toFixed(1) + '" y="' + (py(endWert) - 20).toFixed(1) + '" width="60" height="36" rx="6" fill="#FAFAF7" stroke="#3FA56C" stroke-width="1.5" opacity="0.95"/>' +
                '<text x="' + (px(n-1) - 135).toFixed(1) + '" y="' + (py(endWert) - 6).toFixed(1) + '" font-family="DM Sans" font-size="13" fill="#3FA56C" font-weight="700" text-anchor="middle">' + _fmtK(endWert) + '</text>' +
                '<text x="' + (px(n-1) - 135).toFixed(1) + '" y="' + (py(endWert) + 8).toFixed(1) + '" font-family="DM Sans" font-size="9" fill="#3FA56C" font-weight="500" text-anchor="middle" letter-spacing="0.05em">MARKTWERT</text>' +
              '</g>' +
              '<g>' +
                '<rect x="' + (px(n-1) - 165).toFixed(1) + '" y="' + (py(endRs) - 16).toFixed(1) + '" width="60" height="36" rx="6" fill="#FAFAF7" stroke="#B8625C" stroke-width="1.5" opacity="0.95"/>' +
                '<text x="' + (px(n-1) - 135).toFixed(1) + '" y="' + (py(endRs) - 2).toFixed(1) + '" font-family="DM Sans" font-size="13" fill="#B8625C" font-weight="700" text-anchor="middle">' + _fmtK(endRs) + '</text>' +
                '<text x="' + (px(n-1) - 135).toFixed(1) + '" y="' + (py(endRs) + 12).toFixed(1) + '" font-family="DM Sans" font-size="9" fill="#B8625C" font-weight="500" text-anchor="middle" letter-spacing="0.05em">RESTSCHULD</text>' +
              '</g>' +
              // Equity-Klammer rechts (zwischen den Endpunkten)
              '<g>' +
                '<line x1="' + (px(n-1) - 35).toFixed(1) + '" y1="' + py(endWert).toFixed(1) + '" x2="' + (px(n-1) - 35).toFixed(1) + '" y2="' + py(endRs).toFixed(1) + '" stroke="#C9A84C" stroke-width="1.5" stroke-dasharray="3 3"/>' +
                '<line x1="' + (px(n-1) - 40).toFixed(1) + '" y1="' + py(endWert).toFixed(1) + '" x2="' + (px(n-1) - 30).toFixed(1) + '" y2="' + py(endWert).toFixed(1) + '" stroke="#C9A84C" stroke-width="1.5"/>' +
                '<line x1="' + (px(n-1) - 40).toFixed(1) + '" y1="' + py(endRs).toFixed(1) + '" x2="' + (px(n-1) - 30).toFixed(1) + '" y2="' + py(endRs).toFixed(1) + '" stroke="#C9A84C" stroke-width="1.5"/>' +
                '<rect x="' + (px(n-1) - 75).toFixed(1) + '" y="' + ((py(endWert) + py(endRs)) / 2 - 17).toFixed(1) + '" width="80" height="34" rx="6" fill="#C9A84C"/>' +
                '<text x="' + (px(n-1) - 35).toFixed(1) + '" y="' + ((py(endWert) + py(endRs)) / 2 - 3).toFixed(1) + '" font-family="DM Sans" font-size="13" fill="#1A1414" font-weight="800" text-anchor="middle">' + _fmtK(equityGain, true) + '</text>' +
                '<text x="' + (px(n-1) - 35).toFixed(1) + '" y="' + ((py(endWert) + py(endRs)) / 2 + 11).toFixed(1) + '" font-family="DM Sans" font-size="9" fill="#1A1414" font-weight="600" text-anchor="middle" letter-spacing="0.10em">EQUITY</text>' +
              '</g>' +
            '</svg>' +
          '</div>' +
          // Legend
          '<div class="bc-legend">' +
            '<div class="bc-legend-item"><span class="bc-legend-dot" style="background:#3FA56C"></span>Marktwert (Wertsteigerung)</div>' +
            '<div class="bc-legend-item"><span class="bc-legend-dot" style="background:#B8625C"></span>' + (_hasBspar ? 'Effektive Schuld (Bank − Bausparguthaben)' : 'Restschuld (Tilgung)') + '</div>' +
            (_hasBspar ? '<div class="bc-legend-item"><span class="bc-legend-dot" style="background:repeating-linear-gradient(90deg,#B8625C,#B8625C 4px,transparent 4px,transparent 8px);opacity:0.55"></span>Formale Bank-Schuld</div>' : '') +
            '<div class="bc-legend-item"><span class="bc-legend-dot" style="background:#3FA56C; opacity:0.30"></span>Equity-Aufbau</div>' +
          '</div>' +
        '</div>' +
        // Footer-KPIs — V63.88: Die 4 Bausteine die zusammen verm_zuwachs ergeben
        '<div class="bc-footer-grid bc-footer-5">' +
          '<div class="bc-footer-cell">' +
            '<span class="bc-footer-label">Eingesetztes EK</span>' +
            '<span class="bc-footer-value">' + _fmtEUR(ek0) + '</span>' +
            '<span class="bc-footer-sub">Anfang ' + cfRows[0].cal + '</span>' +
          '</div>' +
          '<div class="bc-footer-cell">' +
            '<span class="bc-footer-label">Tilgung</span>' +
            '<span class="bc-footer-value gold">' + _fmtEUR(fTilg, true) + '</span>' +
            '<span class="bc-footer-sub">Schulden abgebaut</span>' +
          '</div>' +
          // V118: CF-Cell signed — bei Verlust rot mit "−", Label-Wechsel
          (function(){
            var cfLabel, cfClass, cfSub, cfVal;
            if (fCfKonto >= 0) {
              cfLabel = 'CF-Überschuss';
              cfSub   = 'Konto-Reserve';
              cfClass = fCfKonto > 0 ? 'green' : '';
              cfVal   = _fmtEUR(fCfKonto, true);
            } else {
              cfLabel = 'CF-Verlust';
              cfSub   = 'Eigenmittel zugeschossen';
              cfClass = 'red';
              cfVal   = '− ' + _fmtEUR(Math.abs(fCfKonto));
            }
            return '<div class="bc-footer-cell">' +
              '<span class="bc-footer-label">' + cfLabel + '</span>' +
              '<span class="bc-footer-value ' + cfClass + '">' + cfVal + '</span>' +
              '<span class="bc-footer-sub">' + cfSub + '</span>' +
            '</div>';
          })() +
          // V116: Steuervorteil-Cell signed — bei Belastung rot mit "−", Label-Wechsel
          (function(){
            var stvLabel, stvClass, stvSub, stvVal;
            if (fSteuer > 0) {
              stvLabel = 'Steuervorteil';
              stvSub   = 'Erstattung kum.';
              stvClass = 'green';
              stvVal   = '+ ' + _fmtEUR(Math.abs(fSteuer));
            } else if (fSteuer < 0) {
              stvLabel = 'Steuerbelastung';
              stvSub   = 'Mehrsteuer kum.';
              stvClass = 'red';
              stvVal   = '− ' + _fmtEUR(Math.abs(fSteuer));
            } else {
              stvLabel = 'Steuervorteil';
              stvSub   = 'Erstattung kum.';
              stvClass = '';
              stvVal   = _fmtEUR(0, true);
            }
            return '<div class="bc-footer-cell">' +
              '<span class="bc-footer-label">' + stvLabel + '</span>' +
              '<span class="bc-footer-value ' + stvClass + '">' + stvVal + '</span>' +
              '<span class="bc-footer-sub">' + stvSub + '</span>' +
            '</div>';
          })() +
          '<div class="bc-footer-cell">' +
            '<span class="bc-footer-label">Wertsteigerung</span>' +
            '<span class="bc-footer-value green">' + _fmtEUR(fWert, true) + '</span>' +
            '<span class="bc-footer-sub">' + _fmtPct((state.wstg || 0.015) * 100, 1) + ' p.a.</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    host.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CHART 2 — BANK-COCKPIT (DSCR + LTV mit Trends)
  // ═══════════════════════════════════════════════════════════════
  function _renderBankCockpit(host, state) {
    if (!host) return;
    var cfRows = state.cfRows;
    if (!cfRows || cfRows.length < 2) {
      host.innerHTML = '<div class="bc-empty">Cockpit wird berechnet sobald Werte eingegeben sind…</div>';
      return;
    }
    var bindj = state.bindj || 10;
    var ze = (state.ze || 0);
    var dscrArr = _dscrPerYear(cfRows, ze);
    // V63.64: Bei BSV-Aussetzung — LTV auf wirtschaftlicher Schuld (eff_rs) berechnen
    // Bei Standard-Annuität ist eff_rs == rs → identisches Ergebnis
    var ltvArr = cfRows.map(function(r) {
      var schuld = (r.eff_rs != null) ? r.eff_rs : r.rs;
      return r.wert_y > 0 ? (schuld / r.wert_y * 100) : 0;
    });

    var dscrToday = dscrArr[0];
    var dscrEzb = dscrArr[Math.min(bindj - 1, dscrArr.length - 1)] || dscrArr[dscrArr.length - 1];
    // V63.83 BUG-FIX: dscrEnd MUSS Anschluss-Phase sein (nicht letztes Jahr in Zinsbindung).
    // Vorher: dscrArr[dscrArr.length-1] = Jahr 10 = noch in Zinsbindung → identisch zu dscrEzb.
    // Frontend Bild 7 zeigt Anschluss DSCR 1,22 (mit kalk. 5 % Anschlusszins), PDF zeigte 1,43.
    var dscrEnd;
    if (state.kpis && typeof state.kpis.cf_op_an === 'number' &&
        typeof state.kpis.zins_an === 'number' && typeof state.kpis.tilg_an === 'number') {
      var nkmAn = state.kpis.nkm_an + (state.ze || 0);   // NKM + zus. Einnahmen
      var sdAn  = state.kpis.zins_an + state.kpis.tilg_an + (state.kpis.bspar_an || 0);
      dscrEnd = sdAn > 0 ? nkmAn / sdAn : dscrArr[dscrArr.length - 1];
    } else {
      dscrEnd = dscrArr[dscrArr.length - 1];   // Fallback
    }
    // V63.83: ltvToday wie Frontend — = kpis.ltv (vor 1. Tilgung), nicht ltvArr[0] (nach 1. Tilgung)
    // Frontend Bild zeigt 84,4 %, PDF zeigte 83,5 % — durch Tilgung im 1. Jahr.
    var ltvToday = (state.kpis && typeof state.kpis.ltv === 'number') ? state.kpis.ltv : ltvArr[0];
    var ltvEzb = ltvArr[Math.min(bindj - 1, ltvArr.length - 1)] || ltvArr[ltvArr.length - 1];
    var ltvEnd = ltvArr[ltvArr.length - 1];

    // V63.73: Cockpit-Daten global verfügbar für PDF-Direkt-Render
    try {
      window.BankCharts._lastCockpitData = {
        dscrArr: dscrArr,
        ltvArr: ltvArr,
        dscrToday: dscrToday, dscrEzb: dscrEzb, dscrEnd: dscrEnd,
        ltvToday: ltvToday, ltvEzb: ltvEzb, ltvEnd: ltvEnd,
        bindj: bindj,
        years: cfRows.map(function(r) { return r.cal; })
      };
    } catch(e) {}

    // Mini-Trend-SVG-Generator
    function _miniTrend(values, options) {
      options = options || {};
      var color = options.color || '#3FA56C';
      var thresholdLine = options.thresholdLine; // {y, color, label}
      var thresholdLine2 = options.thresholdLine2;
      var n = values.length;
      var min = Math.min.apply(null, values);
      var max = Math.max.apply(null, values);
      var range = max - min || 1;
      // SVG-Box: 540 x 100
      function px(i) { return (i / (n - 1)) * 540; }
      function py(v) { return 95 - ((v - min) / range) * 90; }

      var path = values.map(function(v, i) { return (i === 0 ? 'M ' : 'L ') + px(i).toFixed(1) + ' ' + py(v).toFixed(1); }).join(' ');
      var areaPath = path + ' L ' + px(n-1).toFixed(1) + ' 100 L 0 100 Z';

      // EZB-Marker
      var ezbX = bindj < n ? px(bindj - 1) : null;

      // Threshold-Berechnung
      var thY = null, thY2 = null;
      if (thresholdLine && thresholdLine.value >= min && thresholdLine.value <= max) {
        thY = py(thresholdLine.value);
      }
      if (thresholdLine2 && thresholdLine2.value >= min && thresholdLine2.value <= max) {
        thY2 = py(thresholdLine2.value);
      }

      var gradId = 'bc-mini-grad-' + Math.random().toString(36).substr(2, 6);

      return '<svg class="bc-mini-trend-svg" viewBox="0 0 540 100" preserveAspectRatio="none">' +
        '<defs>' +
          '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.30"/>' +
            '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        // Threshold-Lines
        (thY != null ? '<line x1="0" y1="' + thY.toFixed(1) + '" x2="540" y2="' + thY.toFixed(1) + '" stroke="' + thresholdLine.color + '" stroke-width="1" stroke-dasharray="3 3" opacity="0.40"/>' +
          '<text x="535" y="' + (thY - 3).toFixed(1) + '" font-family="DM Sans" font-size="9" fill="' + thresholdLine.color + '" text-anchor="end" font-weight="600">' + _esc(thresholdLine.label) + '</text>' : '') +
        (thY2 != null ? '<line x1="0" y1="' + thY2.toFixed(1) + '" x2="540" y2="' + thY2.toFixed(1) + '" stroke="' + thresholdLine2.color + '" stroke-width="1" stroke-dasharray="3 3" opacity="0.40"/>' +
          '<text x="535" y="' + (thY2 - 3).toFixed(1) + '" font-family="DM Sans" font-size="9" fill="' + thresholdLine2.color + '" text-anchor="end" font-weight="600">' + _esc(thresholdLine2.label) + '</text>' : '') +
        '<path d="' + areaPath + '" fill="url(#' + gradId + ')"/>' +
        '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        (ezbX != null ? '<line x1="' + ezbX.toFixed(1) + '" y1="0" x2="' + ezbX.toFixed(1) + '" y2="100" stroke="#C9A84C" stroke-width="1" stroke-dasharray="2 4" opacity="0.55"/>' : '') +
        '<circle cx="0" cy="' + py(values[0]).toFixed(1) + '" r="3.5" fill="' + color + '" stroke="#FAFAF7" stroke-width="2"/>' +
        '<circle cx="540" cy="' + py(values[n-1]).toFixed(1) + '" r="4" fill="' + color + '" stroke="#FAFAF7" stroke-width="2"/>' +
      '</svg>';
    }

    // DSCR-Track-Marker-Position (0 → 0%, 2.0+ → 100%)
    var dscrTrackPct = Math.min(100, Math.max(0, (Math.min(dscrToday, 2.0) / 2.0) * 100));
    var ltvTrackPct = Math.min(100, Math.max(0, ltvToday));

    // DSCR-Status
    var dscrCls = _dscrCls(dscrToday);
    var dscrLab = _dscrLabel(dscrToday);
    var ltvCls = _ltvCls(ltvToday);
    var ltvLab = _ltvLabel(ltvToday);

    // V63.65: DSCR-Quote-Text und -Farbe konsistent mit Status (vorher: Quote war grün auch bei knappem DSCR)
    var dscrAbove12Year = -1;
    for (var i = 0; i < dscrArr.length; i++) {
      if (dscrArr[i] >= 1.2) { dscrAbove12Year = i; break; }
    }
    var dscrQuoteText, dscrQuoteCls;
    if (dscrToday < 1.0) {
      dscrQuoteText = '<strong>Bank-Achtung:</strong> DSCR heute unter 1,0 — Bedienung kritisch. Eigenanteil oder strukturelle Anpassungen nötig.';
      dscrQuoteCls = 'bc-bank-tag-warn';
    } else if (dscrToday < 1.2) {
      if (dscrAbove12Year > 0) {
        dscrQuoteText = '<strong>Knapp heute:</strong> DSCR ' + _fmtNum(dscrToday, 2) + ' (zwischen 1,0 und 1,2). Steigt ab Jahr ' + (dscrAbove12Year + 1) + ' über 1,2 — danach klar bedient.';
      } else {
        dscrQuoteText = '<strong>Knapp:</strong> DSCR ' + _fmtNum(dscrToday, 2) + ' liegt im Verlauf nicht über 1,2 — wenig Spielraum bei Mietausfall oder Zinsanstieg.';
      }
      dscrQuoteCls = 'bc-bank-tag-warn';  // gold/orange — passt zum Status
    } else {
      dscrQuoteText = '<strong>Bank-OK:</strong> DSCR ' + _fmtNum(dscrToday, 2) + ' von Anfang an über 1,2 — Bedienung klar gewährleistet.';
      dscrQuoteCls = 'bc-bank-tag-good';
    }

    var ltvDelta = ltvToday - ltvEnd;
    var ltvQuoteText;
    // V63.65: Schwellen einheitlich zu DealScore (≤60 sehr sicher, ≤85 solide, ≤100 erhöht, >100 kritisch)
    if (ltvToday > 100) {
      ltvQuoteText = '<strong>Übersichert (' + _fmtPct(ltvToday, 0) + '):</strong> Restschuld höher als Wert — kritisch. Sinkt durch Tilgung &amp; Wertsteigerung in ' + bindj + ' Jahren auf ' + _fmtPct(ltvEzb, 0) + '.';
    } else if (ltvToday > 85) {
      ltvQuoteText = '<strong>Erhöhter Start-LTV (' + _fmtPct(ltvToday, 0) + '):</strong> Über 85% Beleihung — Zinsaufschläge wahrscheinlich. Sinkt in ' + bindj + ' Jahren auf ' + _fmtPct(ltvEzb, 0) + '.';
    } else if (ltvToday > 60) {
      ltvQuoteText = '<strong>Solider Start-LTV (' + _fmtPct(ltvToday, 0) + '):</strong> Klassische Bank-Finanzierung — verhandelbare Konditionen.';
    } else {
      ltvQuoteText = '<strong>Sehr sicher (' + _fmtPct(ltvToday, 0) + '):</strong> Hoher EK-Anteil — beste Konditionen, niedriges Risiko.';
    }
    var ltvQuoteCls = ltvToday > 100 ? 'bc-bank-tag-warn' : (ltvToday > 85 ? 'bc-bank-tag-warn' : '');

    var html =
      '<div class="bc-card">' +
        '<div class="bc-head">' +
          '<div class="bc-head-left">' +
            '<div class="bc-head-eyebrow">Bank-Cockpit · Risiko-Kennzahlen</div>' +
            '<h3 class="bc-head-title">DSCR <span class="accent">&amp;</span> LTV im Verlauf</h3>' +
            '<p class="bc-head-sub">Die zwei wichtigsten Kennzahlen für die Bank: Wie gut deckt der Cashflow den Schuldendienst (DSCR) und wie hoch ist der Hebel (LTV).</p>' +
          '</div>' +
        '</div>' +
        '<div class="bc-body bc-body-2col">' +

          // DSCR-SIDE
          '<div class="bc-side">' +
            '<div class="bc-kpi-label">DSCR · Schuldendienstdeckung</div>' +
            '<div class="bc-kpi-headline">' +
              '<span class="bc-kpi-headline-num ' + (dscrCls === 'good' ? 'green' : dscrCls === 'warn' ? 'gold' : 'red') + '">' + _fmtNum(dscrToday, 2) + '</span>' +
              '<span class="bc-kpi-status bc-kpi-status-' + dscrCls + '">' + dscrLab + '</span>' +
            '</div>' +
            '<div class="bc-kpi-track">' +
              '<div class="bc-kpi-track-bar bc-kpi-track-bar-dscr"></div>' +
              '<div class="bc-kpi-track-marker" data-val="' + _fmtNum(dscrToday, 2) + '" style="left: ' + dscrTrackPct.toFixed(1) + '%;"></div>' +
              '<div class="bc-kpi-track-scale"><span>0</span><span>1,0</span><span>1,5</span><span>2,0+</span></div>' +
            '</div>' +
            '<div class="bc-kpi-trend">' +
              '<div class="bc-kpi-trend-head">' +
                '<span class="bc-kpi-trend-label">' + cfRows.length + '-Jahres-Verlauf</span>' +
                '<span class="bc-kpi-trend-direction ' + (dscrEnd > dscrToday ? 'up' : 'down') + '">' +
                  (dscrEnd > dscrToday ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8l4-4 4 4"/></svg> steigend' : '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l4 4 4-4"/></svg> sinkend') +
                  ' (' + (dscrToday > 0 ? (dscrEnd > dscrToday ? '+' : '') + Math.round((dscrEnd / dscrToday - 1) * 100) + '%' : '—') + ')' +
                '</span>' +
              '</div>' +
              _miniTrend(dscrArr, {
                color: '#3FA56C',
                thresholdLine: { value: 1.0, color: '#B8625C', label: 'DSCR 1,0' },
                thresholdLine2: { value: 1.2, color: '#C9A84C', label: 'DSCR 1,2' }
              }) +
              '<div class="bc-kpi-trend-bench">' +
                '<div class="bc-kpi-trend-bench-cell"><span class="bc-kpi-trend-bench-label">Heute</span><span class="bc-kpi-trend-bench-val">' + _fmtNum(dscrToday, 2) + '</span></div>' +
                '<div class="bc-kpi-trend-bench-cell"><span class="bc-kpi-trend-bench-label">Ende EZB</span><span class="bc-kpi-trend-bench-val">' + _fmtNum(dscrEzb, 2) + '</span></div>' +
                '<div class="bc-kpi-trend-bench-cell"><span class="bc-kpi-trend-bench-label">Anschluss</span><span class="bc-kpi-trend-bench-val end">' + _fmtNum(dscrEnd, 2) + '</span></div>' +
              '</div>' +
            '</div>' +
            '<div class="bc-bank-tag ' + dscrQuoteCls + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>' +
              '<span>' + dscrQuoteText + '</span>' +
            '</div>' +
          '</div>' +

          // LTV-SIDE
          '<div class="bc-side">' +
            '<div class="bc-kpi-label">LTV · Beleihungsauslauf</div>' +
            '<div class="bc-kpi-headline">' +
              '<span class="bc-kpi-headline-num ' + (ltvCls === 'good' ? 'green' : ltvCls === 'ok' ? 'green' : ltvCls === 'warn' ? 'gold' : 'red') + '">' + _fmtPct(ltvToday, 0) + '</span>' +
              '<span class="bc-kpi-status bc-kpi-status-' + (ltvCls === 'ok' ? 'good' : ltvCls === 'warn' ? 'warn' : ltvCls === 'bad' ? 'bad' : 'good') + '">' + ltvLab + '</span>' +
            '</div>' +
            '<div class="bc-kpi-track">' +
              '<div class="bc-kpi-track-bar bc-kpi-track-bar-ltv"></div>' +
              '<div class="bc-kpi-track-marker" data-val="' + _fmtPct(ltvToday, 0) + '" style="left: ' + ltvTrackPct.toFixed(1) + '%;"></div>' +
              '<div class="bc-kpi-track-scale"><span>0%</span><span>60%</span><span>85%</span><span>100%+</span></div>' +
            '</div>' +
            '<div class="bc-kpi-trend">' +
              '<div class="bc-kpi-trend-head">' +
                '<span class="bc-kpi-trend-label">' + cfRows.length + '-Jahres-Verlauf</span>' +
                '<span class="bc-kpi-trend-direction up">' +
                  '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l4 4 4-4"/></svg>' +
                  ' sinkend (−' + Math.round(ltvDelta) + 'pp)' +
                '</span>' +
              '</div>' +
              _miniTrend(ltvArr, {
                color: '#A68A36',
                thresholdLine: { value: 85, color: '#B8625C', label: 'LTV 85%' },
                thresholdLine2: { value: 60, color: '#C9A84C', label: 'LTV 60%' }
              }) +
              '<div class="bc-kpi-trend-bench">' +
                '<div class="bc-kpi-trend-bench-cell"><span class="bc-kpi-trend-bench-label">Heute</span><span class="bc-kpi-trend-bench-val ' + (ltvToday > 100 ? 'red' : '') + '">' + _fmtPct(ltvToday, 0) + '</span></div>' +
                '<div class="bc-kpi-trend-bench-cell"><span class="bc-kpi-trend-bench-label">Ende EZB</span><span class="bc-kpi-trend-bench-val">' + _fmtPct(ltvEzb, 0) + '</span></div>' +
                '<div class="bc-kpi-trend-bench-cell"><span class="bc-kpi-trend-bench-label">Anschluss</span><span class="bc-kpi-trend-bench-val end">' + _fmtPct(ltvEnd, 0) + '</span></div>' +
              '</div>' +
            '</div>' +
            '<div class="bc-bank-tag ' + ltvQuoteCls + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>' +
              '<span>' + ltvQuoteText + '</span>' +
            '</div>' +
          '</div>' +

        '</div>' +
      '</div>';

    host.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CHART 3 — VERMÖGENSZUWACHS-WATERFALL
  // ═══════════════════════════════════════════════════════════════
  function _renderWaterfall(host, state) {
    if (!host) return;
    var cfRows = state.cfRows;
    if (!cfRows || cfRows.length < 2) {
      host.innerHTML = '<div class="bc-empty">Waterfall wird berechnet sobald Werte eingegeben sind…</div>';
      return;
    }

    // V63.86 BUG #3: Werte aus calc.js / State._vz statt eigener Berechnung.
    // Marcels Beobachtung Bild 2 vs Bild 5: Wasserfall zeigte 14k/2k/34k/72k,
    // Tab Kennzahlen-Tabelle zeigte 39k/2k/38k/100k. Beide müssen identisch sein.
    // → Tab Kennzahlen ist die Source of Truth (= calc.js _vz).
    var _vz = state._vz || window.State && window.State._vz;
    if (!_vz) {
      host.innerHTML = '<div class="bc-empty">Werte werden noch berechnet…</div>';
      return;
    }

    // V63.88: Komplett auf Source-of-Truth aus calc.js _vz umgestellt.
    // 4 Bars + Total-Bar. Bars summieren EXAKT zur Total. Marcels Bug:
    // 23+14+2+38 = 77 ≠ 101 weil Bars verschiedene Definitionen mischten.
    var tilgEffektiv = _vz.tilg_durch_einnahmen + _vz.bspar_durch_einnahmen;  // Bar 1
    var cfVstSum     = _vz.cf_ueberschuss_konto;                              // Bar 2 (Konto-Reserve, NACH Tilgung & Steuer)
    var taxBar       = _vz.steuervorteil;                                     // Bar 3 (separater Steuer-Vorteil)
    var ws           = _vz.wertsteig_kum;                                     // Bar 4
    var total        = _vz.verm_zuwachs;                                      // Total = Σ aller 4

    var eigenanteil = _vz.tilg_eigenanteil;
    // V63.90 BUG-FIX: endRow war undefiniert — JS-ReferenceError ließ den Waterfall
    // crashen, sodass im PDF "Chart konnte nicht gerendert werden" erschien.
    var endRow = cfRows[cfRows.length - 1];
    var bsparKumEnd = (endRow && endRow.bspar_kum != null) ? endRow.bspar_kum : 0;
    var hasBsparW = bsparKumEnd > 0;

    if (total <= 0) {
      host.innerHTML = '<div class="bc-empty">Vermögenszuwachs ist nicht positiv — kein Waterfall darstellbar.</div>';
      return;
    }
    var ek0 = (state.kpis && state.kpis.ek) || 0;
    // V63.63: ∞ statt 0× bei Vollfinanzierung
    var multipleX = ek0 > 100 ? (total / ek0) : null;
    var multipleStr = multipleX != null ? _fmtNum(multipleX, 1) + '×' : '∞';

    // Bar-Skalierung — V63.65: 5 Bars statt 4
    var chartH = 250;
    function yFromVal(v) { return 50 + (1 - (v / total)) * 250; }

    var n = cfRows.length;
    var bar1Top = yFromVal(tilgEffektiv);
    var bar2Top = yFromVal(tilgEffektiv + cfVstSum);
    var bar3Top = yFromVal(tilgEffektiv + cfVstSum + Math.max(0, taxBar));
    var bar4Top = yFromVal(tilgEffektiv + cfVstSum + Math.max(0, taxBar) + ws);

    var bar1H = 300 - bar1Top;
    var bar2H = bar1Top - bar2Top;
    var bar3H = bar2Top - bar3Top;
    // V63.85 BUG #3: Steuer-Bar Mindesthöhe 22px (sichtbar selbst bei winziger Steuer)
    // Wenn der echte bar3H zu klein ist, "leihen" wir Höhe vom Bar-3-Top → Bar wird zentral
    // gerendert auf der Wachstums-Linie, der Label kommt drüber.
    var bar3MinH = 22;
    var bar3HRender = Math.max(bar3MinH, bar3H);
    var bar3TopRender = bar3Top - (bar3HRender - bar3H) / 2;  // Bar zentriert über logischer Position
    var bar4H = bar3Top - bar4Top;
    var bar5Top = bar4Top;
    var bar5H = 300 - bar5Top;

    // Bar-X-Positions — 5 Bars, Plot-Bereich x=80..1080 (Breite 1000)
    // Layout: 5 schmalere Bars + breitere Total-Bar rechts
    var barW = 95, barW5 = 130;
    var bar1X = 130, bar2X = 290, bar3X = 450, bar4X = 610, bar5X = 870;

    var html =
      '<div class="bc-card">' +
        '<div class="bc-head">' +
          '<div class="bc-head-left">' +
            '<div class="bc-head-eyebrow">Vermögenszuwachs · ' + n + ' Jahre nach Kauf</div>' +
            '<h3 class="bc-head-title">Aus ' + _fmtEUR(ek0) + ' werden <span class="accent">' + _fmtEUR(total + ek0) + '</span></h3>' +
            '<p class="bc-head-sub">' + (hasBsparW
              ? 'Drei Quellen treiben den Vermögenszuwachs: Tilgung &amp; Bausparguthaben bauen die Schuld ab (bzw. das wirtschaftliche Äquivalent), der Cashflow-Überschuss landet im Konto, und die Wertsteigerung erhöht den Marktwert.'
              : 'Drei Quellen treiben den Vermögenszuwachs: die Tilgung baut die Schuld ab, der Cashflow-Überschuss landet im Konto, und die Wertsteigerung erhöht den Marktwert.') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="bc-body bc-body-pad">' +
          '<div class="bc-svg-wrap" style="height: 380px;">' +
            '<svg viewBox="0 0 1100 380" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
              '<defs>' +
                '<linearGradient id="bc-wf-bar1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E2C97E"/><stop offset="100%" stop-color="#C9A84C"/></linearGradient>' +
                '<linearGradient id="bc-wf-bar2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5BC089"/><stop offset="100%" stop-color="#3FA56C"/></linearGradient>' +
                '<linearGradient id="bc-wf-bar3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#79CDA0"/><stop offset="100%" stop-color="#3FA56C"/></linearGradient>' +
                '<linearGradient id="bc-wf-total" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#A68A36"/><stop offset="100%" stop-color="#7A6628"/></linearGradient>' +
                '<filter id="bc-wf-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.15"/></filter>' +
              '</defs>' +
              // Y-Grid (4 Linien)
              '<g opacity="0.15" stroke="#2A2727" stroke-width="0.5">' +
                '<line x1="80" y1="50" x2="1080" y2="50" stroke-dasharray="2 4"/>' +
                '<line x1="80" y1="115" x2="1080" y2="115" stroke-dasharray="2 4"/>' +
                '<line x1="80" y1="180" x2="1080" y2="180" stroke-dasharray="2 4"/>' +
                '<line x1="80" y1="245" x2="1080" y2="245" stroke-dasharray="2 4"/>' +
              '</g>' +
              // Y-Labels
              '<g font-family="DM Sans" font-size="10.5" fill="#7A7370" font-weight="500" text-anchor="end">' +
                '<text x="68" y="54">' + _fmtK(total) + '</text>' +
                '<text x="68" y="119">' + _fmtK(total * 0.75) + '</text>' +
                '<text x="68" y="184">' + _fmtK(total * 0.5) + '</text>' +
                '<text x="68" y="249">' + _fmtK(total * 0.25) + '</text>' +
                '<text x="68" y="304">0 €</text>' +
              '</g>' +
              // Baseline
              '<line x1="80" y1="300" x2="1080" y2="300" stroke="#2A2727" stroke-width="1" opacity="0.30"/>' +
              // Bar 1: Tilgung + BSV
              '<g filter="url(#bc-wf-shadow)">' +
                '<rect x="' + bar1X + '" y="' + bar1Top.toFixed(1) + '" width="' + barW + '" height="' + bar1H.toFixed(1) + '" rx="6" fill="url(#bc-wf-bar1)"/>' +
                '<rect x="' + bar1X + '" y="' + bar1Top.toFixed(1) + '" width="' + barW + '" height="3" rx="6" fill="#FFE9A0" opacity="0.7"/>' +
              '</g>' +
              '<line x1="' + (bar1X + barW) + '" y1="' + bar1Top.toFixed(1) + '" x2="' + bar2X + '" y2="' + bar1Top.toFixed(1) + '" stroke="#2A2727" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.40"/>' +
              // Bar 2: CF vor Steuern (Banker-CF)
              (bar2H > 0 ?
                '<g filter="url(#bc-wf-shadow)">' +
                  '<rect x="' + bar2X + '" y="' + bar2Top.toFixed(1) + '" width="' + barW + '" height="' + bar2H.toFixed(1) + '" rx="6" fill="url(#bc-wf-bar2)"/>' +
                  '<rect x="' + bar2X + '" y="' + bar2Top.toFixed(1) + '" width="' + barW + '" height="3" rx="6" fill="#A0F0BE" opacity="0.7"/>' +
                '</g>'
                : '<text x="' + (bar2X + barW/2) + '" y="295" font-family="DM Sans" font-size="10" fill="#9C9590" text-anchor="middle">– 0 € –</text>') +
              '<line x1="' + (bar2X + barW) + '" y1="' + bar2Top.toFixed(1) + '" x2="' + bar3X + '" y2="' + bar2Top.toFixed(1) + '" stroke="#2A2727" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.40"/>' +
              // Bar 3: Steuervorteil (oder -last)
              // V63.85 BUG #3: Mindesthöhe + Label IMMER sichtbar
              (Math.abs(taxBar) > 50 ?
                (taxBar > 0 ?
                  // Steuervorteil (Erstattung) — kleiner grüner Bar
                  '<g filter="url(#bc-wf-shadow)">' +
                    '<rect x="' + bar3X + '" y="' + bar3TopRender.toFixed(1) + '" width="' + barW + '" height="' + bar3HRender.toFixed(1) + '" rx="6" fill="#3FA56C" opacity="0.85"/>' +
                    '<rect x="' + bar3X + '" y="' + bar3TopRender.toFixed(1) + '" width="' + barW + '" height="3" rx="6" fill="#A0F0BE" opacity="0.7"/>' +
                  '</g>'
                  :
                  // Steuerlast — orangener Bar nach unten (negativer Beitrag)
                  '<g filter="url(#bc-wf-shadow)">' +
                    '<rect x="' + bar3X + '" y="' + bar3Top.toFixed(1) + '" width="' + barW + '" height="' + Math.max(bar3MinH, Math.abs(taxBar) / total * chartH).toFixed(1) + '" rx="6" fill="#B8625C" opacity="0.65"/>' +
                  '</g>')
                : '<text x="' + (bar3X + barW/2) + '" y="295" font-family="DM Sans" font-size="10" fill="#9C9590" text-anchor="middle">– 0 € –</text>') +
              '<line x1="' + (bar3X + barW) + '" y1="' + bar3Top.toFixed(1) + '" x2="' + bar4X + '" y2="' + bar3Top.toFixed(1) + '" stroke="#2A2727" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.40"/>' +
              // Bar 4: Wertsteigerung
              '<g filter="url(#bc-wf-shadow)">' +
                '<rect x="' + bar4X + '" y="' + bar4Top.toFixed(1) + '" width="' + barW + '" height="' + bar4H.toFixed(1) + '" rx="6" fill="url(#bc-wf-bar3)"/>' +
                '<rect x="' + bar4X + '" y="' + bar4Top.toFixed(1) + '" width="' + barW + '" height="3" rx="6" fill="#A0F0BE" opacity="0.7"/>' +
              '</g>' +
              '<line x1="' + (bar4X + barW) + '" y1="' + bar4Top.toFixed(1) + '" x2="' + bar5X + '" y2="' + bar4Top.toFixed(1) + '" stroke="#C9A84C" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>' +
              // Bar 5: Total
              '<g filter="url(#bc-wf-shadow)">' +
                '<rect x="' + bar5X + '" y="' + bar5Top.toFixed(1) + '" width="' + barW5 + '" height="' + bar5H.toFixed(1) + '" rx="6" fill="url(#bc-wf-total)"/>' +
                '<rect x="' + bar5X + '" y="' + bar5Top.toFixed(1) + '" width="' + barW5 + '" height="3" rx="6" fill="#FFE9A0" opacity="0.85"/>' +
                '<g transform="translate(' + (bar5X + barW5/2 - 10) + ', ' + (bar5Top + bar5H/2 + 25) + ')">' +
                  '<circle cx="10" cy="10" r="14" fill="rgba(255,255,255,0.10)"/>' +
                  '<path d="M 10 0 L 13 7 L 20 8 L 15 13 L 16 20 L 10 17 L 4 20 L 5 13 L 0 8 L 7 7 Z" fill="#FFE9A0" opacity="0.85"/>' +
                '</g>' +
              '</g>' +
              // X-Labels
              '<g font-family="DM Sans" font-size="10.5" fill="#2A2727" font-weight="600" text-anchor="middle">' +
                '<text x="' + (bar1X + barW/2) + '" y="325">' + (hasBsparW ? 'Tilgung + Bausparen' : 'Tilgung') + '</text>' +
                '<text x="' + (bar1X + barW/2) + '" y="340" font-size="9" fill="#9C9590" font-weight="500" letter-spacing="0.05em">' + (hasBsparW ? 'SCHULDENABBAU' : 'SCHULD ABGEBAUT') + '</text>' +
                '<text x="' + (bar2X + barW/2) + '" y="325">CF-Überschuss</text>' +
                '<text x="' + (bar2X + barW/2) + '" y="340" font-size="9" fill="#9C9590" font-weight="500" letter-spacing="0.05em">KONTO-RESERVE · ' + n + 'J</text>' +
                '<text x="' + (bar3X + barW/2) + '" y="325">' + (taxBar >= 0 ? 'Steuervorteil' : 'Steuerlast') + '</text>' +
                '<text x="' + (bar3X + barW/2) + '" y="340" font-size="9" fill="#9C9590" font-weight="500" letter-spacing="0.05em">' + (taxBar >= 0 ? 'ERSTATTUNG · ' : 'ZAHLUNG · ') + n + 'J</text>' +
                '<text x="' + (bar4X + barW/2) + '" y="325">Wertsteigerung</text>' +
                '<text x="' + (bar4X + barW/2) + '" y="340" font-size="9" fill="#9C9590" font-weight="500" letter-spacing="0.05em">MARKTWERT − ANKER</text>' +
                '<text x="' + (bar5X + barW5/2) + '" y="325" font-weight="700" fill="#A68A36">Gesamt</text>' +
                '<text x="' + (bar5X + barW5/2) + '" y="340" font-size="9" fill="#A68A36" font-weight="600" letter-spacing="0.05em">VERMÖGENSZUWACHS</text>' +
              '</g>' +
              // Werte AUF den Bars
              '<g font-family="DM Sans" font-weight="700" text-anchor="middle">' +
                '<text x="' + (bar1X + barW/2) + '" y="' + (bar1Top + Math.min(30, bar1H/2 + 5)).toFixed(1) + '" font-size="14" fill="#1A1414">' + _fmtK(tilgEffektiv, true) + '</text>' +
                (bar2H > 18 ? '<text x="' + (bar2X + barW/2) + '" y="' + (bar2Top + Math.min(30, bar2H/2 + 5)).toFixed(1) + '" font-size="14" fill="#FAFAF7">' + _fmtK(cfVstSum, true) + '</text>' : '') +
                // V63.85 BUG #3: Steuer-Wert IMMER zeigen — Label ÜBER dem Bar (nicht in ihm)
                (Math.abs(taxBar) > 50 ? '<text x="' + (bar3X + barW/2) + '" y="' + (bar3TopRender - 6).toFixed(1) + '" font-size="13" fill="#1A1414" font-weight="700">' + _fmtK(taxBar, true) + '</text>' : '') +
                '<text x="' + (bar4X + barW/2) + '" y="' + (bar4Top + Math.min(30, bar4H/2 + 5)).toFixed(1) + '" font-size="14" fill="#FAFAF7">' + _fmtK(ws, true) + '</text>' +
                '<text x="' + (bar5X + barW5/2) + '" y="' + (bar5Top + bar5H/2 - 5).toFixed(1) + '" font-size="20" fill="#FAFAF7" font-family="Cormorant Garamond">' + _fmtK(total, true) + '</text>' +
                '<text x="' + (bar5X + barW5/2) + '" y="' + (bar5Top + bar5H/2 + 55).toFixed(1) + '" font-size="11" fill="#FFE9A0" font-weight="500">Multiple ' + multipleStr + '</text>' +
              '</g>' +
            '</svg>' +
          '</div>' +
        '</div>' +
        '<div class="bc-footer-grid bc-footer-3">' +
          '<div class="bc-footer-cell bc-footer-wide">' +
            '<span class="bc-footer-label">Vom eingesetzten EK ausgehend</span>' +
            '<span class="bc-footer-value gold">' + multipleStr + ' Multiple</span>' +
            '<span class="bc-footer-sub">' + (ek0 > 100 ? (_fmtEUR(ek0) + ' werden zu ' + _fmtEUR(total + ek0)) : 'Ohne eingesetztes EK aufgebaut') + ' — primär durch Tilgung &amp; Cashflow finanziert vom Mieter.</span>' +
          '</div>' +
          '<div class="bc-footer-cell">' +
            '<span class="bc-footer-label">' + (hasBsparW ? 'Tilgung + Bausparguthaben (netto)' : 'Anteil vom Mieter') + '</span>' +
            '<span class="bc-footer-value green">' + _fmtEUR(tilgEffektiv) + '</span>' +
            '<span class="bc-footer-sub">' + (hasBsparW
              ? ('Brutto ' + _fmtEUR(tilgEffektivBrutto) + ' (Tilgung + BSV-Guthaben), abzüglich Eigenanteil ' + _fmtEUR(eigenanteil) + ' = echter Schuldenabbau aus Mietüberschuss.')
              : (eigenanteil > 0
                  ? ('Tilgung ' + _fmtEUR(tilgEffektivBrutto) + ' brutto, abzüglich ' + _fmtEUR(eigenanteil) + ' Eigenanteil — netto ' + _fmtEUR(tilgEffektiv) + ' aus Miete.')
                  : 'Tilgungsanteil — durch Mieten abbezahlt.')) + '</span>' +
          '</div>' +
          '<div class="bc-footer-cell bc-footer-cell-highlight">' +
            (eigenanteil > 0
              ? '<span class="bc-footer-label">Anteil eigene Tasche</span>' +
                '<span class="bc-footer-value red">' + _fmtEUR(eigenanteil) + '</span>' +
                '<span class="bc-footer-sub">Über ' + n + ' Jahre aus eigener Tasche zugeschossen (negativer monatl. CF). Bereits vom Vermögenszuwachs abgezogen.</span>'
              : '<span class="bc-footer-label">Anteil eigene Tasche</span>' +
                '<span class="bc-footer-value">0 €</span>' +
                '<span class="bc-footer-sub">Kein zusätzliches Eigenkapital nötig — alles aus dem Cashflow.</span>') +
          '</div>' +
        '</div>' +
      '</div>';

    host.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CHART 4 — STRESS-TEST-MATRIX
  // ═══════════════════════════════════════════════════════════════
  function _renderStressMatrix(host, state) {
    if (!host) return;
    var cfRows = state.cfRows;
    if (!cfRows || cfRows.length < 2) {
      host.innerHTML = '<div class="bc-empty">Stress-Test wird berechnet sobald Werte eingegeben sind…</div>';
      return;
    }
    // Base-Case: heutiger DSCR
    var ze = (state.ze || 0);
    var r0 = cfRows[0];
    var noiBase = (r0.nkm_m + ze) * 12;
    var zinsBase = r0.zy;
    var tilgBase = r0.ty;
    // V63.68: BSV-Sparrate als wirtschaftlicher Tilgungsersatz (siehe _dscrPerYear)
    var bsparBase = r0.bspar_y || 0;
    var kdBase = zinsBase + tilgBase + bsparBase;
    var dscrBase = kdBase > 0 ? noiBase / kdBase : 0;

    // Restschuld für Zins-Stress
    var rs0 = r0.rs;

    // V63.65: Stress-Test erweitert. Zins jetzt bis +5pp und -2pp,
    // Mietsteigerung bis +20% (für realistische Aufwertungs-Szenarien).
    var zinsSzen = [5.0, 3.0, 1.0, 0.0, -2.0]; // pp
    var mietSzen = [-20, -10, 0, 10, 20];      // %

    var matrix = [];
    zinsSzen.forEach(function(zinsPp) {
      var row = [];
      var neuZins = zinsBase + rs0 * (zinsPp / 100);
      // V63.68: BSV-Sparrate bleibt fix unabhängig von Zinsänderung
      var neuKd = neuZins + tilgBase + bsparBase;
      mietSzen.forEach(function(mietPct) {
        var neuNoi = noiBase * (1 + mietPct / 100);
        var dscr = neuKd > 0 ? neuNoi / neuKd : 0;
        row.push(dscr);
      });
      matrix.push(row);
    });

    // V63.71: Matrix-Daten global verfügbar für PDF-Direkt-Render
    // (Stress-Test ist HTML-Grid, lässt sich nicht via SVG→PNG capturen)
    try {
      window.BankCharts._lastStressData = {
        matrix: matrix,
        zinsSzen: zinsSzen,
        mietSzen: mietSzen,
        baseRow: 3,
        baseCol: 2
      };
    } catch(e) {}

    function _cellCls(d) {
      if (d >= 1.2) return 's-good';
      if (d >= 1.0) return 's-ok';
      if (d >= 0.8) return 's-warn';
      if (d >= 0.6) return 's-bad';
      return 's-critical';
    }

    // V63.65: Base-Case-Indizes — Zins ±0 = Zeile 3, Miete ±0 = Spalte 2
    var baseRow = 3, baseCol = 2;

    // Bewertung: Wir prüfen Resilienz gegen +1pp Zins und -10% Miete (realistischer Stress)
    var assessment;
    var dscrBase_check = matrix[baseRow][baseCol];
    var dscrMietMinus10 = matrix[baseRow][1];   // Miete -10%
    var dscrZinsPlus1   = matrix[2][baseCol];   // Zins +1pp
    var dscrBoth        = matrix[2][1];         // -10% Miete + 1pp Zins

    if (dscrBoth >= 1.0) {
      assessment = '<strong>Sehr widerstandsfähig:</strong> Auch bei 10% Mietausfall UND 1pp Zinssteigerung bleibt DSCR über 1,0 — Bank-tauglicher Stress-Test bestanden.';
    } else if (dscrMietMinus10 >= 1.0 && dscrZinsPlus1 >= 1.0) {
      assessment = '<strong>Robust gegen einzelne Stressfaktoren:</strong> 10% Mietausfall ODER 1pp Zinssteigerung wird verkraftet. Bei beidem gleichzeitig wird es eng — 3-Mon. Liquiditätsreserve einplanen.';
    } else if (dscrBase_check >= 1.0) {
      assessment = '<strong>Stress-Anfällig:</strong> Schon kleine Verschlechterungen drücken DSCR unter 1,0 — Liquiditätsreserve oder höherer Eigenanteil empfohlen.';
    } else {
      assessment = '<strong>Hohe Sensitivität:</strong> Bereits im Base-Case ist die Schuldendeckung knapp — strukturelle Anpassungen empfohlen (mehr EK, längere Tilgung, höhere Miete).';
    }

    var matrixHtml = '';
    zinsSzen.forEach(function(zinsPp, ri) {
      matrixHtml += '<div class="bc-matrix-row">';
      mietSzen.forEach(function(mietPct, ci) {
        var d = matrix[ri][ci];
        var isBase = (ri === baseRow && ci === baseCol);
        matrixHtml += '<div class="bc-matrix-cell ' + _cellCls(d) + (isBase ? ' is-base' : '') + '" title="Zins ' + (zinsPp >= 0 ? '+' : '') + zinsPp + 'pp · Miete ' + (mietPct >= 0 ? '+' : '') + mietPct + '%">' +
          '<div class="bc-matrix-cell-val">' + _fmtNum(d, 2) + '</div>' +
          '<div class="bc-matrix-cell-label">DSCR</div>' +
        '</div>';
      });
      matrixHtml += '</div>';
    });

    // Y-Achse Labels
    var yLabels = ['+5,0 pp', '+3,0 pp', '+1,0 pp', '±0 pp', '−2,0 pp'];
    var yDeltas = ['Krise', 'Stress', 'Mittel', 'Heute', 'Erholung'];
    var yClasses = ['bad', 'bad', 'warn', 'good', 'good'];

    var yAxisHtml = '<div class="bc-matrix-axis-y-label">Zinsänderung →</div>';
    yLabels.forEach(function(l, i) {
      yAxisHtml += '<div class="bc-matrix-axis-y-row ' + yClasses[i] + '">' + l + '<span class="bc-delta">' + yDeltas[i] + '</span></div>';
    });

    // X-Achse Labels — V63.65: -20%/-10%/0/+10%/+20%
    var xLabels = ['−20%', '−10%', '±0%', '+10%', '+20%'];
    var xDeltas = ['Krise', 'Hoher Ausfall', 'Voll vermietet', 'Aufwertung', 'Wachstum'];
    var xClasses = ['bad', 'bad', 'good', 'good', 'good'];
    var xAxisHtml = '';
    xLabels.forEach(function(l, i) {
      xAxisHtml += '<div class="bc-matrix-axis-x-cell ' + xClasses[i] + '">' + l + '<span class="bc-delta">' + xDeltas[i] + '</span></div>';
    });

    var html =
      '<div class="bc-card">' +
        '<div class="bc-head">' +
          '<div class="bc-head-left">' +
            '<div class="bc-head-eyebrow">Stress-Test · DSCR-Resilienz</div>' +
            '<h3 class="bc-head-title">Wie reagiert der Deal bei <span class="accent">Mietausfall &amp; Zinssteigerung?</span></h3>' +
            '<p class="bc-head-sub">Matrix zeigt den DSCR-Wert für 25 Szenarien. Grüne Felder = Bank-OK, gelbe = Achtung, rote = Stresszone. Der Base-Case ist heute bei voller Vermietung.</p>' +
          '</div>' +
        '</div>' +
        '<div class="bc-body bc-body-pad">' +
          '<div class="bc-matrix-wrap">' +
            '<div class="bc-matrix-axis-y">' + yAxisHtml + '</div>' +
            '<div class="bc-matrix-grid">' +
              '<div class="bc-matrix-axis-x-label">Mietausfall →</div>' +
              matrixHtml +
              '<div class="bc-matrix-axis-x">' + xAxisHtml + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="bc-stress-footer">' +
            '<div class="bc-legend-scale">' +
              '<div class="bc-legend-chip"><span class="bc-legend-chip-dot" style="background: rgba(63,165,108,0.30); border-color: rgba(63,165,108,0.40)"></span>DSCR ≥ 1,2 (gut)</div>' +
              '<div class="bc-legend-chip"><span class="bc-legend-chip-dot" style="background: rgba(63,165,108,0.15); border-color: rgba(63,165,108,0.25)"></span>DSCR 1,0–1,2 (knapp)</div>' +
              '<div class="bc-legend-chip"><span class="bc-legend-chip-dot" style="background: rgba(201,168,76,0.18); border-color: rgba(201,168,76,0.30)"></span>DSCR 0,8–1,0 (warn)</div>' +
              '<div class="bc-legend-chip"><span class="bc-legend-chip-dot" style="background: rgba(184,98,92,0.18); border-color: rgba(184,98,92,0.30)"></span>DSCR &lt; 0,8 (Stress)</div>' +
            '</div>' +
            '<div class="bc-bank-tag">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>' +
              '<span><strong>Bewertung:</strong> ' + assessment.replace(/^<strong>[^<]+<\/strong>:?\s*/, '') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    host.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════
  //  RENDER-ALL — Hauptfunktion (aufgerufen von buildCharts)
  // ═══════════════════════════════════════════════════════════════
  function _renderAll(state) {
    state = state || window.State;
    if (!state || !state.cfRows) return;

    // Hosts in der Reihenfolge: Equity → Cockpit → Waterfall → Stress
    var h1 = document.getElementById('bc-equity');
    var h2 = document.getElementById('bc-cockpit');
    var h3 = document.getElementById('bc-waterfall');
    var h4 = document.getElementById('bc-stress');

    if (h1) _renderEquityBuild(h1, state);
    if (h2) _renderBankCockpit(h2, state);
    if (h3) _renderWaterfall(h3, state);
    if (h4) _renderStressMatrix(h4, state);
  }

  // ═══════════════════════════════════════════════════════════════
  // Modul-Export
  // ═══════════════════════════════════════════════════════════════
  window.BankCharts = window.BankCharts || {};
  window.BankCharts._helpers = {
    fmtEUR: _fmtEUR, fmtK: _fmtK, fmtPct: _fmtPct, fmtNum: _fmtNum,
    dscrPerYear: _dscrPerYear, dscrCls: _dscrCls, dscrLabel: _dscrLabel,
    ltvCls: _ltvCls, ltvLabel: _ltvLabel
  };
  window.BankCharts.renderEquityBuild = _renderEquityBuild;
  window.BankCharts.renderBankCockpit = _renderBankCockpit;
  window.BankCharts.renderWaterfall = _renderWaterfall;
  window.BankCharts.renderStressMatrix = _renderStressMatrix;
  window.BankCharts.renderAll = _renderAll;

})();
