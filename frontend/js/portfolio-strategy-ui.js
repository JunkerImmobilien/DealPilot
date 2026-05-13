'use strict';
/* ═══════════════════════════════════════════════════════════════════
   DEALPILOT – portfolio-strategy-ui.js                       (V135)
   UI-Schicht für das Portfolio-Strategie-Modul.

   V135 NEU:
   – Anlage-Ziel-Selektor (6 Ziele) + Horizont-Slider
   – Kauf-Präferenz (ETW/MFH/WGH/Gemischt) + Zielenheiten/J
     + KP-Korridor + Sparquote + Marktzins-Anker
   – Zukauf-Plan-Karte: EK-Bedarf, Annuitäten, Bonitäts-Diagnose
   – Strategie M (Altersvorsorge) im Engine

   Vorherige Versionen:
   – V134: Lage- & Markt-Diagnose-Karte, 5 zusätzliche Strategien
   – V133: GmbH-Tier-Visualisierung mit "DU BIST HIER"-Markierung
   – V132: Strategie-PDF + Bank-Verhandlungs-PDF
═══════════════════════════════════════════════════════════════════ */

(function() {

  // ── HIDDEN-GATE (V130) ──────────────────────────────────────────
  // Aktivierung über:
  //   1. Settings → Info-Tab → kleiner roter Button "Strategie-Modus"
  //   2. URL-Parameter:  ?ps_unlock=DPSTRAT  (Backup für direkten Aufruf)
  //   3. Konsole:        localStorage.setItem('dp_ps_unlocked', 'true')
  // Deaktivieren: localStorage.removeItem('dp_ps_unlocked')
  var UNLOCK_KEYWORD = 'DPSTRAT';

  function isUnlocked() {
    try {
      var url = (typeof window !== 'undefined' && window.location)
        ? new URL(window.location.href) : null;
      if (url && url.searchParams && url.searchParams.get('ps_unlock') === UNLOCK_KEYWORD) {
        localStorage.setItem('dp_ps_unlocked', 'true');
        url.searchParams.delete('ps_unlock');
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + (url.hash || ''));
        }
      }
      return localStorage.getItem('dp_ps_unlocked') === 'true';
    } catch (e) { return false; }
  }

  // V130: Globaler Trigger für den Settings-Button.
  // Der Settings-Button setzt das Flag und öffnet das Modul direkt.
  window.psUnlockAndOpen = function() {
    try {
      localStorage.setItem('dp_ps_unlocked', 'true');
    } catch (e) {}
    // Settings-Modal schließen (falls offen)
    try {
      var settings = document.querySelector('.settings-modal');
      if (settings && typeof window.closeSettings === 'function') {
        window.closeSettings();
      } else if (settings) {
        settings.style.display = 'none';
      }
    } catch (e) {}
    // Modul öffnen
    if (typeof showPortfolioStrategyView === 'function') {
      showPortfolioStrategyView();
    }
  };

  // ── HELPER ──────────────────────────────────────────────────────
  function fE(v, dp) {
    if (!isFinite(v)) v = 0;
    var s = Math.round(v * (dp ? Math.pow(10, dp) : 1)) / (dp ? Math.pow(10, dp) : 1);
    return s.toLocaleString('de-DE', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }) + ' €';
  }
  function fEs(v) {
    var sign = v >= 0 ? '+' : '';
    return sign + fE(v);
  }
  function fP(v, dp) {
    if (!isFinite(v)) v = 0;
    return v.toFixed(dp || 1).replace('.', ',') + ' %';
  }
  function fN(v, dp) {
    if (!isFinite(v)) v = 0;
    return v.toFixed(dp || 2).replace('.', ',');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // V137: Strategie-Visualisierung als SVG
  // Zeigt drei Schichten: Bestand → EK-Quellen → Zukauf/GmbH-Strategie
  function _renderStrategySvg(port, inp) {
    var w = 720, h = 320;
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" preserveAspectRatio="xMidYMid meet" class="ps-vis-svg">';

    // Hintergrund
    svg += '<rect width="' + w + '" height="' + h + '" fill="#FAF8F3"/>';

    // Layer 1: Bestand (links)
    var anzahl = port.count || 0;
    var vw = port.vw_total || port.gi || 0;
    var ltvPct = Math.round(((port.ltv_aktuell || port.ltv) || 0) * 100);
    svg += '<g transform="translate(20,30)">';
    svg += '<rect x="0" y="0" width="200" height="260" rx="8" fill="#2A2727"/>';
    svg += '<text x="100" y="26" text-anchor="middle" fill="#C9A84C" font-family="Arial" font-size="11" font-weight="700">BESTAND</text>';
    svg += '<text x="100" y="60" text-anchor="middle" fill="#fff" font-family="Georgia" font-size="36" font-weight="600">' + anzahl + '</text>';
    svg += '<text x="100" y="80" text-anchor="middle" fill="#aaa" font-family="Arial" font-size="11">Objekte</text>';
    svg += '<line x1="20" y1="100" x2="180" y2="100" stroke="#444" stroke-width="1"/>';
    svg += '<text x="20" y="125" fill="#bbb" font-family="Arial" font-size="11">Verkehrswert</text>';
    svg += '<text x="180" y="125" text-anchor="end" fill="#fff" font-family="Arial" font-size="11" font-weight="600">' + (vw > 0 ? Math.round(vw / 1000).toLocaleString('de-DE') + 'k' : '–') + '</text>';
    svg += '<text x="20" y="148" fill="#bbb" font-family="Arial" font-size="11">LTV aktuell</text>';
    svg += '<text x="180" y="148" text-anchor="end" fill="#fff" font-family="Arial" font-size="11" font-weight="600">' + ltvPct + ' %</text>';
    svg += '<text x="20" y="171" fill="#bbb" font-family="Arial" font-size="11">V+V/J</text>';
    svg += '<text x="180" y="171" text-anchor="end" fill="#fff" font-family="Arial" font-size="11" font-weight="600">' + Math.round((port.vuv_y || 0) / 1000) + 'k</text>';
    if (port.bewertung) {
      svg += '<text x="20" y="200" fill="#C9A84C" font-family="Arial" font-size="10" font-weight="700">SCORE</text>';
      svg += '<text x="180" y="200" text-anchor="end" fill="#fff" font-family="Arial" font-size="14" font-weight="600">' + port.bewertung.score + '/100</text>';
      svg += '<text x="180" y="216" text-anchor="end" fill="#aaa" font-family="Arial" font-size="10">' + esc(port.bewertung.einstufung) + '</text>';
    }
    svg += '</g>';

    // Layer 2: EK-Quellen (Mitte)
    var sparquote = port.zukaufPlan ? port.zukaufPlan.sparquote_abs : 0;
    var beleihPa = port.zukaufPlan ? port.zukaufPlan.beleihreserve_pa : 0;
    var gesamt = port.zukaufPlan ? port.zukaufPlan.ek_zufluss_y : 0;
    svg += '<g transform="translate(260,30)">';
    svg += '<rect x="0" y="0" width="200" height="260" rx="8" fill="#fff" stroke="#C9A84C" stroke-width="2"/>';
    svg += '<text x="100" y="26" text-anchor="middle" fill="#C9A84C" font-family="Arial" font-size="11" font-weight="700">EK-QUELLEN/JAHR</text>';
    svg += '<text x="100" y="62" text-anchor="middle" fill="#2A2727" font-family="Georgia" font-size="32" font-weight="600">' + Math.round(gesamt / 1000) + 'k</text>';
    svg += '<text x="100" y="82" text-anchor="middle" fill="#888" font-family="Arial" font-size="11">€/Jahr Zufluss</text>';
    // Stacked bar
    var totalH = 80;
    var sQH = gesamt > 0 ? totalH * sparquote / gesamt : 0;
    var bRH = gesamt > 0 ? totalH * beleihPa / gesamt : 0;
    svg += '<rect x="40" y="105" width="120" height="' + sQH + '" fill="#C9A84C"/>';
    svg += '<rect x="40" y="' + (105 + sQH) + '" width="120" height="' + bRH + '" fill="#8c4843"/>';
    svg += '<text x="170" y="' + (105 + sQH/2 + 3) + '" fill="#2A2727" font-family="Arial" font-size="10">Sparquote ' + Math.round(sparquote/1000) + 'k</text>';
    svg += '<text x="170" y="' + (105 + sQH + bRH/2 + 3) + '" fill="#2A2727" font-family="Arial" font-size="10">Beleihung ' + Math.round(beleihPa/1000) + 'k</text>';
    svg += '<text x="100" y="240" text-anchor="middle" fill="#888" font-family="Arial" font-size="10">+ Beleihungs-Reserve gesamt</text>';
    svg += '<text x="100" y="256" text-anchor="middle" fill="#2A2727" font-family="Arial" font-size="13" font-weight="700">' + Math.round((port.beleihungs_reserve || 0) / 1000) + 'k €</text>';
    svg += '</g>';

    // Layer 3: Strategie-Outcome (rechts)
    var ziel = (port.ziel || {}).label || 'Wachstum';
    var modelle = port.zukaufPlan ? port.zukaufPlan.modelle : null;
    var aktivesM = modelle ? modelle.filter(function(m) { return m.empfohlen_fuer_aktives_ziel; })[0] : null;
    var p5 = port.zukaufPlan ? port.zukaufPlan.prognose5j : null;
    svg += '<g transform="translate(500,30)">';
    svg += '<rect x="0" y="0" width="200" height="260" rx="8" fill="#FAF6E8" stroke="#C9A84C" stroke-width="2"/>';
    svg += '<text x="100" y="26" text-anchor="middle" fill="#C9A84C" font-family="Arial" font-size="11" font-weight="700">ZIEL: ' + esc(ziel.toUpperCase()) + '</text>';
    if (aktivesM) {
      svg += '<text x="100" y="56" text-anchor="middle" fill="#2A2727" font-family="Georgia" font-size="14" font-weight="600">' + esc(aktivesM.label) + '</text>';
      svg += '<text x="20" y="84" fill="#888" font-family="Arial" font-size="11">EK pro Kauf</text>';
      svg += '<text x="180" y="84" text-anchor="end" fill="#2A2727" font-family="Arial" font-size="11" font-weight="600">' + Math.round(aktivesM.ek_eur / 1000) + 'k</text>';
      svg += '<text x="20" y="106" fill="#888" font-family="Arial" font-size="11">Annuität/J</text>';
      svg += '<text x="180" y="106" text-anchor="end" fill="#2A2727" font-family="Arial" font-size="11" font-weight="600">' + Math.round(aktivesM.annuitaet_y / 1000) + 'k</text>';
    }
    if (p5) {
      svg += '<line x1="20" y1="130" x2="180" y2="130" stroke="#C9A84C" stroke-width="1"/>';
      svg += '<text x="100" y="148" text-anchor="middle" fill="#C9A84C" font-family="Arial" font-size="9" font-weight="700">IN 5 JAHREN</text>';
      svg += '<text x="20" y="172" fill="#888" font-family="Arial" font-size="11">Objekte</text>';
      svg += '<text x="180" y="172" text-anchor="end" fill="#2A2727" font-family="Arial" font-size="14" font-weight="700">' + p5.bestand_neu_count + '</text>';
      svg += '<text x="20" y="194" fill="#888" font-family="Arial" font-size="11">WE</text>';
      svg += '<text x="180" y="194" text-anchor="end" fill="#2A2727" font-family="Arial" font-size="14" font-weight="700">' + p5.bestand_neu_einheiten + '</text>';
      svg += '<text x="20" y="216" fill="#888" font-family="Arial" font-size="11">Mieten/J</text>';
      svg += '<text x="180" y="216" text-anchor="end" fill="#2A2727" font-family="Arial" font-size="11" font-weight="600">' + Math.round(p5.neue_mieten_y / 1000) + 'k</text>';
    }
    if (port.gmbhVerkauf && port.gmbhVerkauf.summe_grest_ersparnis > 0) {
      svg += '<text x="20" y="244" fill="#2A9A5A" font-family="Arial" font-size="10" font-weight="700">+ GrESt-Bonus 7%</text>';
      svg += '<text x="180" y="244" text-anchor="end" fill="#2A9A5A" font-family="Arial" font-size="11" font-weight="700">' + Math.round(port.gmbhVerkauf.summe_grest_ersparnis / 1000) + 'k €</text>';
    }
    svg += '</g>';

    // Pfeile
    svg += '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#C9A84C"/></marker></defs>';
    svg += '<line x1="225" y1="160" x2="255" y2="160" stroke="#C9A84C" stroke-width="2" marker-end="url(#arrow)"/>';
    svg += '<line x1="465" y1="160" x2="495" y2="160" stroke="#C9A84C" stroke-width="2" marker-end="url(#arrow)"/>';

    svg += '</svg>';
    return svg;
  }

  // ── HAUPT-RENDER ────────────────────────────────────────────────
  async function showPortfolioStrategyView() {
    // V127: Hidden-Gate erzwingen
    if (!isUnlocked()) {
      _hideSidebarEntry();
      console.warn('PortfolioStrategy: gesperrt. Aktivierung: localStorage.setItem("dp_ps_unlocked","true") oder ?ps_unlock=' + UNLOCK_KEYWORD);
      return;
    }
    // Hide tabs and other views (gleicher Pattern wie all-objects)
    var tabs    = document.querySelector('.tabs');
    var wfBar   = document.querySelector('.tabs-workflow-bar');
    var aoMain  = document.getElementById('all-objects-main');
    var sections= document.querySelectorAll('.sec:not(.sec-hidden)');
    var psMain  = document.getElementById('portfolio-strategy-main');

    if (!psMain) {
      psMain = document.createElement('div');
      psMain.id = 'portfolio-strategy-main';
      psMain.className = 'ps-main';
      psMain.style.display = 'none';
      // Direkt nach all-objects-main einhängen, damit das Layout stimmt
      var anchor = document.getElementById('all-objects-main');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(psMain, anchor.nextSibling);
      } else {
        document.body.appendChild(psMain);
      }
    }

    if (tabs)   tabs.style.display = 'none';
    if (wfBar)  wfBar.style.display = 'none';
    if (aoMain) aoMain.style.display = 'none';
    sections.forEach(function(s) { s.style.display = 'none'; });
    psMain.style.display = 'block';

    psMain.innerHTML = '<div class="ps-loading">Portfolio wird analysiert …</div>';

    // Daten ziehen + rechnen
    try {
      var res = await window.PortfolioStrategy.loadAndAnalyze();
      _renderFull(psMain, res);
    } catch (e) {
      console.error('PortfolioStrategy failed:', e);
      psMain.innerHTML = '<div class="ps-empty">Fehler bei der Portfolio-Analyse: ' + esc(e.message || String(e)) + '</div>';
    }
  }

  function _renderFull(root, res) {
    var port = res.portfolio;
    var sc   = res.scenarios;
    var best = res.bestByScore || res.bestByNPV;
    var inp  = window.PortfolioStrategy.getState().inputs;
    var cfg  = window.PortfolioStrategy.getState().config;
    var profiles = window.PortfolioStrategy.PROFILES;

    if (port.count === 0) {
      root.innerHTML =
        '<div class="ps-toolbar"><h2>Portfolio-Strategie</h2></div>' +
        '<div class="ps-empty">Keine Objekte gefunden. Lege zuerst Objekte mit Kaufpreis und Miete an.</div>';
      return;
    }

    var html = '';
    html += '<div class="ps-toolbar">';
    html += '  <div><h2>Portfolio-Strategie</h2><div class="ps-sub">Szenarien-Vergleich für ' + port.count + ' Objekte · Stand ' + new Date().toLocaleDateString('de-DE') + '</div></div>';
    html += '  <div class="ps-actions">';
    html += '    <button class="btn btn-gold" onclick="psExportStrategyPDF()" type="button" title="Komplette Strategie-Analyse als PDF (Cover, alle 7 Strategien, Peer-Vergleich, Disclaimer)">📄 Strategie-PDF</button>';
    html += '    <button class="btn btn-outline" onclick="psExportBankPDF()" type="button" title="Bank-Verhandlungs-Profil pro Objekt mit Beleihungs-Reserve">🏦 Bank-PDF</button>';
    html += '    <button class="btn btn-ghost" onclick="psExportJSON()" type="button">JSON</button>';
    html += '    <button class="btn btn-ghost" onclick="psPrint()" type="button">Drucken</button>';
    html += '  </div>';
    html += '</div>';

    // V143: Prominenter Disclaimer-Banner direkt oben
    html += '<div class="ps-disclaimer-banner" style="margin:14px 0 18px 0;background:#FAF6E8;border-left:4px solid #C9A84C;border-radius:4px;padding:12px 18px;font-size:13px;line-height:1.55;color:#2A2727">';
    html += '  <strong style="color:#8c6e2c;font-size:11px;letter-spacing:0.8px;text-transform:uppercase">⚠ Hinweis</strong><br>';
    html += '  Diese Analyse ist eine <strong>Modellrechnung</strong> auf Basis deiner eigenen Eingaben — <strong>keine Steuer-, Rechts- oder Finanzberatung</strong> im Sinne des §6 StBerG / §3 RDG / §34c GewO. ';
    html += '  Für die konkrete Umsetzung jeder steuerlichen oder rechtlichen Maßnahme (Eigenheim-Schaukel, GmbH-Strukturen, Stiftungs-Lösungen, RND-Gutachten, KP-Aufteilung etc.) ist <strong>zwingend ein Steuerberater + ggf. Notar/Anwalt</strong> hinzuzuziehen. ';
    html += '  Die berechneten Hebel sind Schätzwerte ohne Gewähr.';
    html += '</div>';

    // ─── Investorprofil-Selektor (V126) ──────────────────────────
    html += '<div class="ps-card ps-profile-card">';
    html += '  <h3>Investorprofil</h3>';
    html += '  <div class="ps-sub" style="margin-bottom:14px">Bestimmt die Gewichtung der Szenarien und welche Empfehlungen pro Objekt ausgesprochen werden.</div>';
    html += '  <div class="ps-profiles">';
    Object.keys(profiles).forEach(function(k) {
      var p = profiles[k];
      var active = (k === inp.profile) ? ' ps-profile-active' : '';
      html += '<button class="ps-profile-btn' + active + '" onclick="psSetProfile(\'' + k + '\')" type="button">';
      html += '  <div class="ps-profile-l">' + esc(p.label) + '</div>';
      html += '  <div class="ps-profile-d">' + esc(p.desc) + '</div>';
      html += '  <div class="ps-profile-meta">LTV-Ziel ' + Math.round(p.ltv_target * 100) + '%, max ' + Math.round(p.ltv_max * 100) + '%</div>';
      html += '</button>';
    });
    html += '  </div>';
    html += '</div>';

    // ─── V135: Anlage-Ziel-Selektor ───────────────────────────
    if (window.PortfolioStrategy && window.PortfolioStrategy.ZIELE) {
      var ziele = window.PortfolioStrategy.ZIELE;
      var aktZiel = inp.ziel || 'wachstum';
      html += '<div class="ps-card ps-ziel-card">';
      html += '  <h3>Anlage-Ziel</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Wohin soll das Portfolio in ' + (inp.ziel_horizon_jahre || 15) + ' Jahren? Das Ziel beeinflusst die Strategie-Reihenfolge und EK-Empfehlungen — unabhängig vom Investorprofil oben.</div>';
      html += '  <div class="ps-ziele-grid">';
      Object.keys(ziele).forEach(function(k) {
        var z = ziele[k];
        var active = (k === aktZiel) ? ' ps-ziel-active' : '';
        html += '<button class="ps-ziel-btn' + active + '" onclick="psSetZiel(\'' + k + '\')" type="button">';
        html += '  <div class="ps-ziel-label">' + esc(z.label) + '</div>';
        html += '  <div class="ps-ziel-kurz">' + esc(z.kurz) + '</div>';
        html += '</button>';
      });
      html += '  </div>';
      // Beschreibung des aktiven Ziels
      var aktZielObj = ziele[aktZiel];
      if (aktZielObj) {
        html += '  <div class="ps-ziel-detail">';
        html += '    <div class="ps-ziel-detail-title">' + esc(aktZielObj.label) + '</div>';
        html += '    <div class="ps-ziel-detail-body">' + esc(aktZielObj.beschreibung) + '</div>';
        html += '  </div>';
      }
      // Horizont-Slider
      html += '  <div class="ps-ziel-horizon">';
      html += '    <label>Ziel-Horizont:</label>';
      html += '    <input type="number" id="ps-ziel-horizon" value="' + (inp.ziel_horizon_jahre || 15) + '" min="3" max="40" style="width:60px"> Jahre';
      html += '  </div>';
      html += '</div>';
    }

    // ─── V135: Kauf-Präferenz + Zukauf-Plan ───────────────────
    if (window.PortfolioStrategy && window.PortfolioStrategy.OBJEKT_TYP_LABELS) {
      var typLabels = window.PortfolioStrategy.OBJEKT_TYP_LABELS;
      var aktTyp = inp.praeferenz_typ || 'egal';
      html += '<div class="ps-card ps-kauf-card">';
      html += '  <h3>Was du kaufen möchtest</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Welcher Objekttyp passt zu dir? Bei "egal" wird die Empfehlung aus dem Ziel abgeleitet.</div>';
      html += '  <div class="ps-typ-grid">';
      Object.keys(typLabels).forEach(function(k) {
        var active = (k === aktTyp) ? ' ps-typ-active' : '';
        html += '<button class="ps-typ-btn' + active + '" onclick="psSetTyp(\'' + k + '\')" type="button">';
        html += esc(typLabels[k]);
        html += '</button>';
      });
      html += '  </div>';

      html += '  <div class="ps-grid3" style="margin-top:14px">';
      html += _inputRow('Objekte (Käufe) pro Jahr', 'ps-objekte-pa', inp.ziel_objekte_pa, 'Wie viele EINZELNE OBJEKTE kaufst du pro Jahr? 1 ETW = 1 Objekt. 1 MFH mit 6 Wohnungen = 1 Objekt (6 WE). 0 = nichts geplant.');
      html += _inputRow('Wohneinheiten pro Objekt', 'ps-we-pro-obj', inp.we_pro_objekt, 'Wie viele Wohnungen hat ein typisches Objekt? 1 für ETW, 4-8 für MFH, 10+ für größeres MFH.');
      html += _inputRow('Kaufpreis-Korridor MIN (€)', 'ps-kp-min', inp.kp_min_geplant, 'Untergrenze für Zukäufe. Beeinflusst die EK-Bedarfs-Rechnung.');
      html += _inputRow('Kaufpreis-Korridor MAX (€)', 'ps-kp-max', inp.kp_max_geplant, 'Obergrenze für Zukäufe.');
      html += '  </div>';

      html += '  <div class="ps-grid3" style="margin-top:8px">';
      html += _inputRow('Sparquote (% vom Netto)', 'ps-sparquote', inp.sparquote_pct, 'Anteil des Netto-Einkommens, der monatlich ins Portfolio fließt. Default 15 %.');
      html += _inputRow('Aktueller Marktzins (%)', 'ps-marktzins', inp.marktzins_pct, 'Anker für Zukauf-Annuität. Stand 05/2026: 3,5-4 % bei 10-J-Bindung. Quelle: Interhyp, Dr. Klein.');
      html += _inputRow('Mietsteigerung p.a. (%)', 'ps-mietst', (inp.growth_rent_pa * 100).toFixed(1), 'Erwartete jährliche Mieten-Wachstumsrate. Default 1,5 %.');
      html += '  </div>';
      html += '</div>';
    }

    // ─── Setup: 3 klare Bereiche (V129 Vereinfachung) ────────────
    html += '<div class="ps-card ps-setup">';
    html += '  <h3>Was du heute hast</h3>';
    html += '  <div class="ps-grid3">';
    html += _inputRow('Dein zvE pro Jahr (€)', 'ps-base-zve', inp.base_income_zve, 'Zu versteuerndes Einkommen aus Lohn/Selbstständigkeit ohne Immo-Effekt.');
    html += _inputRow('Verfügbares freies EK (€)', 'ps-free-ek', inp.free_ek, 'Was du HEUTE auf dem Konto hast. Notgroschen ziehen wir gleich ab.');
    html += _inputRow('Notgroschen (€)', 'ps-notgroschen', inp.notgroschen, 'Reserve, die du NICHT investieren willst. Wird vom freien EK abgezogen.');
    html += '  </div>';
    html += '  <div class="ps-grid3" style="margin-top:14px">';
    html += _selectRow('Bestehende Struktur', 'ps-hat-struktur', [
      { v: 'keine',      l: 'Alles privat — keine GmbH' },
      { v: 'vv_gmbh',    l: 'Habe schon eine VV-GmbH' },
      { v: 'holding_vv', l: 'Holding + VV-GmbH(s)' },
      { v: 'konzern',    l: 'Konzern (Holding + VV + Op)' }
    ], inp.hat_struktur);
    html += _selectRow('Bundesland (GrESt)', 'ps-land', [
      { v: 'NW', l: 'NRW — 6,5 %' },
      { v: 'BY', l: 'Bayern — 3,5 %' },
      { v: 'BE', l: 'Berlin — 6,0 %' },
      { v: 'BW', l: 'BW — 5,0 %' },
      { v: 'HE', l: 'Hessen — 6,0 %' },
      { v: 'NI', l: 'Niedersachsen — 5,0 %' },
      { v: 'SH', l: 'SH — 6,5 %' },
      { v: 'HH', l: 'Hamburg — 5,5 %' },
      { v: 'SN', l: 'Sachsen — 5,5 %' }
    ], inp.bundesland);
    html += _selectRow('Kirchensteuer', 'ps-kist', [
      { v: 'false', l: 'Nein' },
      { v: 'true',  l: 'Ja (9 %)' }
    ], String(inp.church_tax));
    html += '  </div>';

    html += '  <h3 style="margin-top:28px">Was du erreichen willst</h3>';
    html += '  <div class="ps-grid3">';
    html += _inputRow('Bereit zu investieren (€)', 'ps-ek-bereit', inp.ek_invest_bereit, 'Inkl. EK-Freisetzung aus Beleihung. Treibt die Wachstums-Strategie.');
    html += _selectRow('Familienstand', 'ps-married', [
      { v: 'false', l: 'Ledig' },
      { v: 'true',  l: 'Verheiratet (Splitting noch nicht berechnet)' }
    ], String(inp.married));
    html += '  </div>';
    html += '  <div class="ps-sub" style="margin-top:8px">Die Anzahl geplanter Zukäufe gibst du oben in der "Was du kaufen möchtest"-Karte ein (Objekte/Jahr × Wohneinheiten/Objekt). Daraus berechnet die Zukauf-Plan-Karte konkret EK-Bedarf, Annuitäten und Bonität.</div>';

    // Erweiterte Annahmen — ausklappbar, weil selten geändert
    html += '  <details class="ps-advanced" style="margin-top:24px">';
    html += '    <summary>Erweiterte Annahmen <span class="ps-muted">(selten ändern)</span></summary>';
    html += '    <div class="ps-grid4" style="margin-top:14px">';
    html += _inputRow('GewSt-Hebesatz Sitz GmbH (%)', 'ps-gewst-hebe', cfg.gewst_hebesatz, 'Default 400 % (NRW-Mittel). Bei erweiterter Kürzung irrelevant.');
    html += _inputRow('Mietsteigerung p.a. (%)', 'ps-growth-rent', _round2(inp.growth_rent_pa * 100), 'Erwartete Steigerung der Kaltmiete.');
    html += _inputRow('Wertsteigerung p.a. (%)', 'ps-growth-value', _round2(inp.growth_value_pa * 100), 'Für Endwert-Schätzung im NPV.');
    html += _inputRow('Diskontsatz NPV (%)', 'ps-disc', _round2(cfg.discount_rate * 100), 'Kapitalkosten / Mindestrendite.');
    html += '    </div>';
    html += '  </details>';

    html += '  <div class="ps-setup-foot">';
    html += '    <button class="btn btn-gold" onclick="psApplyInputs()" type="button">Eingaben anwenden &amp; neu rechnen</button>';
    html += '  </div>';
    html += '</div>';

    // ─── Portfolio-Snapshot ───────────────────────────────────────
    html += '<div class="ps-card">';
    html += '  <h3>Portfolio-Snapshot</h3>';
    html += '  <div class="ps-kpis">';
    html += _kpi('Objekte', port.count);
    html += _kpi('Gesamt-KP', fE(port.kp));
    html += _kpi('Gesamt-Investition', fE(port.gi));
    html += _kpi('Eigenkapital gebunden', fE(port.ek));
    html += _kpi('Restschuld', fE(port.d_total));
    html += _kpi('LTV', fP(port.ltv * 100));
    html += _kpi('Kaltmiete p.a.', fE(port.nkm_y));
    html += _kpi('Ø Bruttomietrendite', fP(port.bmy * 100, 2));
    html += _kpi('CF (vor St., p.a.)', fEs(port.cf_vor_y));
    html += _kpi('Ø DSCR', fN(port.dscr));
    html += _kpi('AfA p.a.', fE(port.afa_y));
    html += _kpi('V+V-Überschuss p.a.', fEs(port.vuv_y));
    html += _kpi('Beleihungs-Reserve', fE(port.beleihungs_reserve));
    if (port.lageAvg != null) {
      html += _kpi('Ø Lage-Score', port.lageAvg + '/100', port.lageAvg >= 70 ? 'green' : (port.lageAvg >= 50 ? 'gold' : 'red'));
    }
    if (port.upsideAvg != null) {
      html += _kpi('Ø Upside-Score', port.upsideAvg + '/100', port.upsideAvg >= 70 ? 'green' : (port.upsideAvg >= 50 ? 'gold' : 'red'));
    }
    html += '  </div>';
    html += '</div>';

    // ─── Strategische Gesamtempfehlung (V128: NEU, prominent oben) ──
    if (res.narrative) {
      var nr = res.narrative;
      html += '<div class="ps-card ps-narrative">';
      html += '  <h3>Strategische Empfehlung für dein Portfolio</h3>';
      html += '  <div class="ps-narr-headline">' + esc(nr.headline) + '</div>';
      html += '  <div class="ps-narr-situation">' + esc(nr.situation) + '</div>';

      if (nr.naechste_schritte && nr.naechste_schritte.length > 0) {
        html += '  <h4 class="ps-narr-h4">Nächste Schritte (priorisiert)</h4>';
        html += '  <div class="ps-narr-steps">';
        nr.naechste_schritte.forEach(function(st, i) {
          var katCls = st.kategorie === 'Sofort-Hebel' ? 'ps-step-sofort'
                     : st.kategorie === 'Steuer-Hebel' ? 'ps-step-steuer'
                     : 'ps-step-wachstum';
          html += '<div class="ps-narr-step ' + katCls + '">';
          html += '  <div class="ps-narr-step-num">' + (i+1) + '</div>';
          html += '  <div class="ps-narr-step-body">';
          html += '    <div class="ps-narr-step-head">';
          html += '      <span class="ps-narr-step-kat">' + esc(st.kategorie) + '</span>';
          html += '      <span class="ps-narr-step-titel">' + esc(st.titel) + '</span>';
          if (st.impact_eur) html += '      <span class="ps-narr-step-impact">~' + fE(st.impact_eur) + '</span>';
          html += '    </div>';
          html += '    <div class="ps-narr-step-detail">' + esc(st.detail) + '</div>';

          // V144: Transparente Berechnungs-Aufschlüsselung für RND-Steps
          if (st.titel && /RND-Gutachten/i.test(st.titel) && st.objekte && st.objekte.length > 0) {
            html += _renderRndHebelBreakdown(res, st);
          }

          if (st.objekte && st.objekte.length > 0) {
            html += '    <div class="ps-narr-step-objs">Betroffen: ' + st.objekte.map(function(k) { return '<span class="ps-narr-obj-chip">' + esc(k) + '</span>'; }).join('') + '</div>';
          }
          html += '  </div>';
          html += '</div>';
        });
        html += '  </div>';
      }

      // Struktur-Empfehlung: 3-Spalten-Roadmap
      if (nr.struktur_empfehlung) {
        html += '  <h4 class="ps-narr-h4">Struktur-Roadmap</h4>';
        html += '  <div class="ps-narr-roadmap">';
        html += '    <div class="ps-narr-rm-col"><div class="ps-narr-rm-h">Jetzt</div><div class="ps-narr-rm-b">' + esc(nr.struktur_empfehlung.jetzt) + '</div></div>';
        html += '    <div class="ps-narr-rm-col"><div class="ps-narr-rm-h">In 2-3 Jahren</div><div class="ps-narr-rm-b">' + esc(nr.struktur_empfehlung.in_2_3_jahren) + '</div></div>';
        html += '    <div class="ps-narr-rm-col"><div class="ps-narr-rm-h">Langfristig</div><div class="ps-narr-rm-b">' + esc(nr.struktur_empfehlung.langfristig) + '</div></div>';
        html += '  </div>';
      }

      // Warnings
      if (nr.warnings && nr.warnings.length > 0) {
        html += '  <h4 class="ps-narr-h4">Achtung</h4>';
        html += '  <div class="ps-narr-warnings">';
        nr.warnings.forEach(function(w) {
          html += '<div class="ps-narr-warn">';
          html += '  <strong>[' + esc(w.kategorie) + '] ' + esc(w.titel) + '</strong>';
          html += '  <div>' + esc(w.detail) + '</div>';
          html += '</div>';
        });
        html += '  </div>';
      }
      html += '</div>';
    }

    // ─── Multi-Strategien (V129: NEU) ────────────────────────────
    // ─── V135: ZUKAUF-PLAN-KARTE ──────────────────────────────
    // Aus den V135-Inputs (Ziel, KP-Korridor, Sparquote, Marktzins) konkrete
    // Plausibilitäts-Rechnung. Zeigt EK-Bedarf, Annuitäten-Last, Tragfähigkeit.
    if (port.zukaufPlan && (inp.zielenheiten_pa > 0 || inp.ziel === 'wachstum' || inp.ziel === 'cashflow_jetzt' || inp.ziel === 'vermoegen_aufbauen')) {
      var zp = port.zukaufPlan;
      html += '<div class="ps-card ps-zukauf-card">';
      html += '  <h3>Zukauf-Plan — was kostet dich das wirklich?</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Konkrete Plausibilitäts-Rechnung auf Basis: ' + (zp.zielenheiten_pa || 1) + ' Einheit(en)/J, KP-Korridor ' + fE(zp.kp_korridor[0]) + '-' + fE(zp.kp_korridor[1]) + ', Marktzins ' + zp.marktzins_pct.toFixed(1).replace('.', ',') + ' % (Stand ' + esc(zp.marktzins_stand) + ', Quelle: Interhyp/Dr. Klein).</div>';

      // Zwei Spalten: EK-Bedarf links, Tragfähigkeit rechts
      html += '  <div class="ps-zukauf-cols">';

      // SPALTE 1: EK-Bedarf pro Zukauf
      html += '    <div class="ps-zukauf-col">';
      html += '      <div class="ps-zukauf-col-title">EK-BEDARF PRO ZUKAUF</div>';
      html += '      <div class="ps-zukauf-detail">Bei einem Durchschnitts-Kaufpreis von <strong>' + fE(zp.kp_avg) + '</strong>:</div>';
      html += '      <table class="ps-zukauf-table">';
      html += '        <tr><td>Kaufnebenkosten gesamt</td><td>' + Math.round(zp.nebenkosten_pct).toFixed(1).replace('.', ',') + ' %</td><td><strong>' + fE(zp.nebenkosten_eur) + '</strong></td></tr>';
      html += '        <tr><td>davon GrESt (' + esc(zp.bundesland) + ')</td><td>' + zp.grest_pct.toFixed(1).replace('.', ',') + ' %</td><td>' + fE(zp.kp_avg * zp.grest_pct / 100) + '</td></tr>';
      html += '        <tr><td>Notar + Grundbuch</td><td>1,5 %</td><td>' + fE(zp.kp_avg * 0.015) + '</td></tr>';
      html += '        <tr><td>Makler (typisch geteilt)</td><td>3,57 %</td><td>' + fE(zp.kp_avg * 0.0357) + '</td></tr>';
      html += '        <tr class="ps-zukauf-spacer"><td colspan="3"></td></tr>';
      html += '        <tr><td>Min EK (nur Nebenkosten ohne Makler)</td><td></td><td>' + fE(zp.ek_bedarf_min) + '</td></tr>';
      html += '        <tr class="ps-zukauf-highlight"><td>Solider EK-Anteil (NK + 10 %)</td><td></td><td><strong>' + fE(zp.ek_bedarf_solid) + '</strong></td></tr>';
      html += '        <tr><td>Sicher (NK + 20 %)</td><td></td><td>' + fE(zp.ek_bedarf_sicher) + '</td></tr>';
      html += '      </table>';
      html += '    </div>';

      // SPALTE 2: Annuitäten + Sparquote
      html += '    <div class="ps-zukauf-col">';
      html += '      <div class="ps-zukauf-col-title">ANNUITÄT + SPARQUOTE</div>';
      html += '      <div class="ps-zukauf-detail">Bei Marktzins ' + zp.marktzins_pct.toFixed(1).replace('.', ',') + ' % + 2 % Tilgung:</div>';
      html += '      <table class="ps-zukauf-table">';
      html += '        <tr><td>Darlehen 80 % LTV</td><td>' + fE(zp.darlehen_solid) + '</td><td>' + fE(zp.annuitaet_solid) + '/J</td></tr>';
      html += '        <tr><td>Darlehen 100 % LTV</td><td>' + fE(zp.darlehen_aggressiv) + '</td><td>' + fE(zp.annuitaet_aggressiv) + '/J</td></tr>';
      html += '        <tr class="ps-zukauf-spacer"><td colspan="3"></td></tr>';
      html += '        <tr><td>Sparquote ' + (inp.sparquote_pct || 15) + ' % vom Netto</td><td></td><td>' + fE(zp.sparquote_abs) + '/J</td></tr>';
      html += '        <tr><td>+ Beleihungs-Reserve / 5J</td><td></td><td>' + fE(zp.beleihreserve_pa) + '/J</td></tr>';
      html += '        <tr class="ps-zukauf-highlight"><td>= EK-Zufluss/Jahr</td><td></td><td><strong>' + fE(zp.ek_zufluss_y) + '</strong></td></tr>';
      html += '      </table>';
      html += '    </div>';
      html += '  </div>';

      // Diagnose-Box mit Status
      var sparStatus = zp.sparquote_status;
      var belStatus = zp.belastung_status;
      var sparColor = sparStatus === 'ausreichend' ? 'green' : sparStatus === 'knapp' ? 'gold' : 'red';
      var belColor = belStatus === 'gut' ? 'green' : belStatus === 'akzeptabel' ? 'gold' : belStatus === 'kritisch' ? 'red' : 'gold';

      html += '  <div class="ps-zukauf-diagnose">';
      html += '    <div class="ps-zukauf-diagnose-title">DIAGNOSE</div>';

      // Sparquote-Status
      html += '    <div class="ps-zukauf-status ps-zukauf-' + sparColor + '">';
      html += '      <div class="ps-zukauf-status-label">Sparquote</div>';
      if (sparStatus === 'ausreichend') {
        html += '      <div class="ps-zukauf-status-text"><strong>Trägt deinen Plan.</strong> EK-Zufluss ' + fE(zp.ek_zufluss_y) + '/J deckt den Bedarf von ' + fE(zp.ek_bedarf_pa) + '/J für ' + zp.zielenheiten_pa + ' Einheit(en)/J.</div>';
      } else if (sparStatus === 'knapp') {
        html += '      <div class="ps-zukauf-status-text"><strong>Knapp.</strong> Bei ' + (inp.sparquote_pct || 15) + ' % Sparquote dauert es ~' + (zp.jahre_bis_naechster_kauf ? zp.jahre_bis_naechster_kauf.toFixed(1).replace('.', ',') : '–') + ' J. bis zum nächsten Zukauf. <strong>Empfehlung: Sparquote auf ' + zp.sparquote_empfohlen + ' % anheben</strong>, oder Plan auf ' + Math.round((inp.zielenheiten_pa || 1) * zp.deckungsquote * 10) / 10 + ' Einheit(en)/J reduzieren.</div>';
      } else {
        html += '      <div class="ps-zukauf-status-text"><strong>Reicht nicht.</strong> Bei aktueller Sparquote ' + (inp.sparquote_pct || 15) + ' % nur ' + Math.round(zp.deckungsquote * 100) + ' % gedeckt. <strong>Sparquote muss auf mindestens ' + zp.sparquote_empfohlen + ' % steigen</strong>, oder Zukauf-Frequenz reduzieren auf ' + Math.max(0, Math.round((inp.zielenheiten_pa || 1) * zp.deckungsquote * 10) / 10) + ' Einheit(en)/J.</div>';
      }
      html += '    </div>';

      // Belastungsquote-Status
      html += '    <div class="ps-zukauf-status ps-zukauf-' + belColor + '">';
      html += '      <div class="ps-zukauf-status-label">Annuitäten-Belastung</div>';
      var belPct = zp.belastungsquote != null ? Math.round(zp.belastungsquote * 100) : null;
      if (belStatus === 'gut') {
        html += '      <div class="ps-zukauf-status-text">Inkl. neuer Annuitäten ' + (belPct || '–') + ' % vom Netto — gut tragbar (Banken-Faustregel: bis 35 %).</div>';
      } else if (belStatus === 'akzeptabel') {
        html += '      <div class="ps-zukauf-status-text">Inkl. neuer Annuitäten ' + (belPct || '–') + ' % vom Netto — akzeptabel, aber wenig Puffer für Lebenshaltung.</div>';
      } else if (belStatus === 'kritisch') {
        html += '      <div class="ps-zukauf-status-text"><strong>⚠ Bonität problematisch.</strong> Inkl. neuer Annuitäten ' + (belPct || '–') + ' % vom Netto — über Banken-Faustregel von 35 %. Bank wird wahrscheinlich keine weitere Finanzierung gewähren. <strong>Empfehlung: Bestand­tilgung beschleunigen ODER Zukauf-Plan reduzieren.</strong></div>';
      }
      html += '    </div>';

      html += '  </div>';

      // Zinssatz-Hinweis
      html += '  <div class="ps-zukauf-zins-hint">';
      html += '    <strong>Zinssatz-Anker:</strong> Aktueller 10-J-Sollzins liegt zwischen 3,5 und 4 %. ';
      html += 'Eine 20-jährige Zinsbindung kostet 0,3-0,5 Pp Aufschlag — bei deinem Ziel "<em>' + esc((port.ziel || {}).label || '') + '</em>" oft sinnvoll, weil Zinserhöhungs-Risiko ausgeschlossen wird. ';
      html += '(Quelle: Interhyp Mai 2026, Dr. Klein, baufi24)';
      html += '  </div>';

      html += '</div>';
    }

    // ─── V136: MODELLVERGLEICH (3 Finanzierungsmodelle) ────────
    if (port.zukaufPlan && port.zukaufPlan.modelle && port.zukaufPlan.ziel_objekte_pa > 0) {
      var zp = port.zukaufPlan;
      html += '<div class="ps-card ps-modelle-card">';
      html += '  <h3>Modellrechnung — wie finanzierst du den Zukauf?</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Drei Finanzierungs-Modelle für einen typischen Zukauf bei ' + fE(zp.kp_avg) + ' Kaufpreis. Das zu deinem Ziel "<em>' + esc((port.ziel || {}).label || '–') + '</em>" passende Modell ist gold markiert.</div>';
      html += '  <div class="ps-modelle-grid">';
      zp.modelle.forEach(function(m) {
        var aktiv = m.empfohlen_fuer_aktives_ziel ? ' ps-modell-aktiv' : '';
        html += '<div class="ps-modell' + aktiv + '">';
        if (m.empfohlen_fuer_aktives_ziel) {
          html += '<div class="ps-modell-badge">FÜR DEIN ZIEL</div>';
        }
        html += '  <div class="ps-modell-label">' + esc(m.label) + '</div>';
        html += '  <div class="ps-modell-kurz">' + esc(m.kurz) + '</div>';
        html += '  <table class="ps-modell-tab">';
        html += '    <tr><td>EK-Einsatz</td><td><strong>' + fE(m.ek_eur) + '</strong></td></tr>';
        html += '    <tr><td>Darlehen</td><td>' + fE(m.darlehen) + '</td></tr>';
        html += '    <tr><td>Zins / Bindung</td><td>' + (m.zinssatz * 100).toFixed(2).replace('.', ',') + ' % / ' + m.zinsbindung_jahre + ' J.</td></tr>';
        html += '    <tr><td>Annuität/J</td><td>' + fE(m.annuitaet_y) + '</td></tr>';
        html += '    <tr><td>Restschuld nach 10 J.</td><td>' + fE(m.restschuld_10j) + '</td></tr>';
        html += '  </table>';
        html += '  <div class="ps-modell-desc">' + esc(m.beschreibung) + '</div>';
        html += '</div>';
      });
      html += '  </div>';

      // 5-Jahres-Prognose
      var p5 = zp.prognose5j;
      html += '  <div class="ps-prognose-block">';
      html += '    <div class="ps-prognose-title">DEIN PORTFOLIO IN 5 JAHREN (wenn der Plan durchläuft)</div>';
      html += '    <div class="ps-prognose-grid">';
      html += '      <div class="ps-prog-cell"><div class="ps-prog-label">Objekte gesamt</div><div class="ps-prog-val">' + p5.bestand_neu_count + '</div><div class="ps-prog-meta">heute ' + (port.count || 0) + ' + ' + p5.neue_objekte + ' neu</div></div>';
      html += '      <div class="ps-prog-cell"><div class="ps-prog-label">Wohneinheiten</div><div class="ps-prog-val">' + p5.bestand_neu_einheiten + '</div><div class="ps-prog-meta">+' + p5.neue_einheiten + ' neu</div></div>';
      html += '      <div class="ps-prog-cell"><div class="ps-prog-label">Investitions-Volumen</div><div class="ps-prog-val">' + fE(p5.gesamt_kp_zukauf) + '</div><div class="ps-prog-meta">Kaufpreis-Summe Zukauf</div></div>';
      html += '      <div class="ps-prog-cell"><div class="ps-prog-label">EK-Einsatz gesamt</div><div class="ps-prog-val">' + fE(p5.gesamt_ek_einsatz_solid) + '</div><div class="ps-prog-meta">solides Modell</div></div>';
      html += '      <div class="ps-prog-cell"><div class="ps-prog-label">Neue Mieten/J</div><div class="ps-prog-val">' + fE(p5.neue_mieten_y) + '</div><div class="ps-prog-meta">grobe Schätzung Faktor 22</div></div>';
      html += '      <div class="ps-prog-cell"><div class="ps-prog-label">Neue Annuität/J</div><div class="ps-prog-val">' + fE(p5.gesamt_neue_annuitaet) + '</div><div class="ps-prog-meta">5 × Annuität pro Kauf</div></div>';
      html += '    </div>';
      html += '  </div>';

      html += '</div>';
    }

    // ─── V136: STEUER-HEBEL-KARTE ────────────────────────────
    if (port.zukaufPlan && port.zukaufPlan.steuerhebel && port.zukaufPlan.ziel_objekte_pa > 0) {
      var sh = port.zukaufPlan.steuerhebel;
      var zp2 = port.zukaufPlan;
      html += '<div class="ps-card ps-steuer-card">';
      html += '  <h3>Steuer-Hebel — was die Zukäufe an Steuern sparen</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Pro Zukauf reduziert die AfA das zu versteuernde Einkommen. Bei deinem Grenzsteuersatz von ' + Math.round(sh.grenzsteuersatz * 100) + ' % wird das zu konkretem Cash.</div>';

      html += '  <div class="ps-steuer-cols">';

      // Linke Spalte: Standard-AfA
      html += '    <div class="ps-steuer-col">';
      html += '      <div class="ps-steuer-col-title">STANDARD-AfA (2 %)</div>';
      html += '      <div class="ps-steuer-detail">§7 Abs. 4 EStG. Gilt für Objekte ab Baujahr 1925. Gebäudeanteil 75 % vom KP.</div>';
      html += '      <table class="ps-steuer-tab">';
      html += '        <tr><td>AfA pro Objekt/J</td><td>' + fE(sh.afa_pa_pro_obj) + '</td></tr>';
      html += '        <tr><td>Steuer-Ersparnis pro Objekt/J</td><td><strong>' + fE(sh.steuer_ersparnis_pa_pro_obj) + '</strong></td></tr>';
      html += '        <tr class="ps-steuer-spacer"><td colspan="2"></td></tr>';
      html += '        <tr><td>Über 5 J. mit ' + zp2.ziel_objekte_pa + ' Käufen/J</td><td><strong>' + fE(sh.steuer_ersparnis_5j_solid) + '</strong></td></tr>';
      html += '      </table>';
      html += '    </div>';

      // Rechte Spalte: RND-AfA
      html += '    <div class="ps-steuer-col ps-steuer-col-highlight">';
      html += '      <div class="ps-steuer-col-title">MIT RND-GUTACHTEN (~3,5 %)</div>';
      html += '      <div class="ps-steuer-detail">§7 Abs. 4 Satz 2 EStG. Bei Bestandsobjekten >40 J. mit Sachverständigen-Gutachten.</div>';
      html += '      <table class="ps-steuer-tab">';
      html += '        <tr><td>AfA pro Objekt/J</td><td>' + fE(sh.afa_pa_pro_obj_rnd) + '</td></tr>';
      html += '        <tr><td>Steuer-Ersparnis pro Objekt/J</td><td><strong>' + fE(sh.steuer_ersparnis_pa_pro_obj_rnd) + '</strong></td></tr>';
      html += '        <tr class="ps-steuer-spacer"><td colspan="2"></td></tr>';
      html += '        <tr><td>Über 5 J. mit ' + zp2.ziel_objekte_pa + ' Käufen/J</td><td><strong>' + fE(sh.steuer_ersparnis_5j_rnd) + '</strong></td></tr>';
      html += '        <tr><td><strong>Mehrwert RND vs. Standard</strong></td><td><strong>+' + fE(sh.steuer_ersparnis_5j_rnd - sh.steuer_ersparnis_5j_solid) + '</strong></td></tr>';
      html += '      </table>';
      html += '    </div>';

      html += '  </div>';

      // Zusätzliche Steuer-Hebel
      html += '  <div class="ps-steuer-hebel-list">';
      html += '    <div class="ps-steuer-hebel-title">WEITERE HEBEL JE NACH OBJEKT</div>';
      html += '    <ul>';
      html += '      <li><strong>§35c EStG (Energetisch):</strong> 20 % der Sanierungs­kosten als Steuer-Ermäßigung über 3 J. Beispiel: 50k Sanierung → 10k direkt von der Steuer­schuld abziehbar.</li>';
      html += '      <li><strong>§82b EStDV (3-Jahres-Verteilung):</strong> Erhaltungs­aufwand >10k kann auf 2-5 Jahre verteilt werden — glättet hohe Steuer­spitzen.</li>';
      html += '      <li><strong>§6 Abs. 1 Nr. 1a EStG (15 %-Regel):</strong> Sanierungen über 15 % vom Anschaffungs-KP innerhalb 3 J. werden ZWANGSWEISE in die AfA-Bemessungs­grundlage gerechnet — manchmal Vorteil, manchmal Falle. Bei Käufen unterhalb der 15 %-Grenze halten ODER strategisch überschreiten.</li>';
      html += '      <li><strong>§7h/§7i EStG (Sanierungs­gebiet/Denkmal):</strong> 9 % AfA über 8 J. + 7 % über weitere 4 J. = 100 % der Sanierungs­kosten in 12 J. abgeschrieben. Riesiger Hebel bei passenden Objekten.</li>';
      html += '      <li><strong>§23 EStG (Spekulationsfrist):</strong> Verkauf nach 10 J. einkommen­steuer­frei. Strategischer Hebel beim Portfolio-Umbau.</li>';
      html += '      <li><strong>§6b EStG (Reinvestitions­rücklage):</strong> Bei Verkauf eines Objekts kann die stille Reserve in ein neues Objekt übertragen werden — 100 % Steuer-Stundung beim Standort­wechsel (in der GmbH).</li>';
      html += '    </ul>';
      html += '  </div>';

      html += '  <div class="ps-zukauf-zins-hint">';
      html += '    <strong>Wichtig:</strong> Die hier gezeigten Beträge sind Modell­rechnungen. Bei Splitting-Tarif (Verheiratete) verschieben sich die Grenzsteuersätze. Bei sehr hohem zvE >278k schlägt der Reichensteuersatz 45 % an — dort wird der GmbH-Hebel besonders attraktiv. Steuerberater-Letzt-Check zwingend.';
      html += '  </div>';

      html += '</div>';
    }

    // ─── V137: PORTFOLIO-BESCHREIBUNG & BEWERTUNG ──────────────
    if (port.bewertung && port.count > 0) {
      var bw = port.bewertung;
      var einstColor = bw.score >= 80 ? 'green'
                     : bw.score >= 65 ? 'gold'
                     : bw.score >= 35 ? 'gold' : 'red';
      html += '<div class="ps-card ps-bewertung-card">';
      html += '  <h3>Portfolio-Bewertung</h3>';
      html += '  <div class="ps-bewertung-row">';
      html += '    <div class="ps-bewertung-score ps-bewertung-' + einstColor + '">';
      html += '      <div class="ps-bewertung-score-value">' + bw.score + '</div>';
      html += '      <div class="ps-bewertung-score-label">' + esc(bw.einstufung) + '</div>';
      html += '    </div>';
      html += '    <div class="ps-bewertung-charakter">' + esc(bw.charakter) + '</div>';
      html += '  </div>';
      html += '  <div class="ps-bewertung-cols">';
      html += '    <div class="ps-bewertung-col">';
      html += '      <div class="ps-bewertung-h ps-bewertung-h-green">Stärken</div>';
      if (bw.staerken.length === 0) {
        html += '      <div class="ps-bewertung-empty">– keine spezifischen Stärken erkannt</div>';
      } else {
        html += '      <ul>';
        bw.staerken.forEach(function(s) { html += '<li>' + esc(s) + '</li>'; });
        html += '      </ul>';
      }
      html += '    </div>';
      html += '    <div class="ps-bewertung-col">';
      html += '      <div class="ps-bewertung-h ps-bewertung-h-red">Schwächen</div>';
      if (bw.schwaechen.length === 0) {
        html += '      <div class="ps-bewertung-empty">– keine kritischen Schwächen</div>';
      } else {
        html += '      <ul>';
        bw.schwaechen.forEach(function(s) { html += '<li>' + esc(s) + '</li>'; });
        html += '      </ul>';
      }
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
    }

    // ─── V137: OBJEKT-AUSWAHL-KARTE ──────────────────────────
    var allRows = (window.PortfolioStrategy.getState() || {}).allRows || [];
    if (allRows.length > 1) {
      var sel = inp.ausgewaehlte_objekte;
      var allCount = allRows.length;
      var inclCount = Array.isArray(sel) ? sel.length : allCount;
      html += '<div class="ps-card ps-auswahl-card">';
      html += '  <h3>Objekt-Auswahl für die Strategie</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:12px">Wähle, welche Objekte in die Strategie einbezogen werden. Aktuell <strong>' + inclCount + ' von ' + allCount + '</strong>.';
      html += '    &nbsp;<button class="ps-mini-btn" type="button" onclick="psSetObjektAuswahl(\'\')">Alle einbeziehen</button>';
      html += '  </div>';
      html += '  <div class="ps-auswahl-grid">';
      allRows.forEach(function(r) {
        var aktiv = !Array.isArray(sel) || sel.indexOf(r.id) >= 0;
        html += '<button class="ps-auswahl-chip' + (aktiv ? ' ps-auswahl-aktiv' : '') + '" type="button" onclick="psToggleObjekt(\'' + esc(r.id) + '\')">';
        html += '  <span class="ps-auswahl-cb">' + (aktiv ? '✓' : '') + '</span>';
        html += '  <span class="ps-auswahl-label">' + esc(r.kuerzel || r.id) + '</span>';
        html += '  <span class="ps-auswahl-meta">' + fE(r.kp || 0) + ' KP</span>';
        html += '</button>';
      });
      html += '  </div>';
      html += '</div>';
    }

    // ─── V137: BELEIHUNGSWERT-KONFIGURATION ──────────────────
    html += '<div class="ps-card ps-bw-card">';
    html += '  <h3>Beleihungswert-Konfiguration</h3>';
    html += '  <div class="ps-sub" style="margin-bottom:12px">Banken setzen den Beleihungswert mit einem Sicherheits-Abschlag vom Verkehrswert an (typisch 15-25 %). Anschließend wird der zulässige Auslauf festgelegt (Standard 75-85 %). Beide Parameter beeinflussen die nutzbare Beleihungs-Reserve und damit die Nachbeleihungs-Strategie.</div>';
    html += '  <div class="ps-bw-grid">';
    html += '    <div class="ps-bw-col">';
    html += '      <label class="ps-bw-label">Beleihungswert-Abschlag vom Verkehrswert (%)</label>';
    html += '      <input id="ps-bw-abschlag" type="number" min="5" max="30" step="1" value="' + (inp.beleihungswert_abschlag_pct || 10) + '" class="ps-bw-input">';
    html += '      <div class="ps-bw-hint">Standard 10 % (manche Banken 15-25 %)</div>';
    html += '    </div>';
    html += '    <div class="ps-bw-col">';
    html += '      <label class="ps-bw-label">Beleihungs-Auslauf (%)</label>';
    html += '      <input id="ps-bw-auslauf" type="number" min="60" max="90" step="1" value="' + (inp.beleihungs_auslauf_pct || 80) + '" class="ps-bw-input">';
    html += '      <div class="ps-bw-hint">Standard 80 %, bei guter Bonität bis 85 %</div>';
    html += '    </div>';
    html += '    <div class="ps-bw-col ps-bw-result">';
    html += '      <div class="ps-bw-result-label">EFFEKTIV NUTZBAR</div>';
    html += '      <div class="ps-bw-result-value">' + Math.round((100 - (inp.beleihungswert_abschlag_pct || 10)) * (inp.beleihungs_auslauf_pct || 80) / 100) + ' %</div>';
    html += '      <div class="ps-bw-hint">vom Verkehrswert</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <button class="ps-cta" type="button" onclick="psSetBeleihungParams()">Beleihung neu berechnen</button>';
    html += '  <div class="ps-zukauf-zins-hint" style="margin-top:14px">';
    html += '    <strong>Aktuelle Beleihungs-Reserve gesamt:</strong> ' + fE(port.beleihungs_reserve || 0) + ' — als EK für Zukäufe einsetzbar (siehe Strategie B).';
    html += '  </div>';
    html += '</div>';

    // ─── V137: RND-BEWERTUNG PRO OBJEKT ──────────────────────
    var rndCandidates = ((window.PortfolioStrategy.getState() || {}).allRows || [])
      .filter(function(r) { return r.rndGutachten && r.rndGutachten.valid; });
    if (rndCandidates.length > 0) {
      html += '<div class="ps-card ps-rnd-card">';
      html += '  <h3>Restnutzungsdauer-Gutachten — Bewertung pro Objekt</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Ein RND-Gutachten nach §7 Abs. 4 Satz 2 EStG erhöht die AfA — höhere AfA bedeutet niedrigere Steuer. Je nach Objekt-Alter und Sanstand unterschiedlich starker Hebel. Gutachter-Kosten typisch 1.000-1.500 €.</div>';
      html += '  <table class="ps-rnd-tab">';
      html += '    <thead><tr>';
      html += '      <th>Objekt</th><th>BJ</th><th>Standard-AfA</th><th>RND-AfA</th><th>Steigerung</th><th>Mehr Steuer/J</th><th>Kosten</th><th>Amortisation</th><th>Empfehlung</th>';
      html += '    </tr></thead><tbody>';
      rndCandidates.forEach(function(r) {
        var rg = r.rndGutachten;
        var ampelCls = rg.ampel === 'gruen' ? 'ps-rnd-green'
                     : rg.ampel === 'gelb' ? 'ps-rnd-gold' : 'ps-rnd-red';
        var amort = rg.amortisation_jahre ? rg.amortisation_jahre.toFixed(1).replace('.', ',') + ' J.' : '–';
        var steigung = rg.afa_steigerung_pct != null ? '+' + rg.afa_steigerung_pct.toFixed(0) + ' %' : '–';
        var empf = rg.ampel === 'gruen' ? 'Beauftragen'
                 : rg.ampel === 'gelb' ? 'Prüfen' : 'Nicht lohnend';
        html += '<tr class="' + ampelCls + '">';
        html += '<td><strong>' + esc(r.kuerzel) + '</strong></td>';
        html += '<td>' + (r.baujahr || '–') + '</td>';
        html += '<td>' + rg.afa_standard.satz_pct.toFixed(2).replace('.', ',') + ' %</td>';
        html += '<td>' + rg.afa_kurz.satz_pct.toFixed(2).replace('.', ',') + ' %</td>';
        html += '<td><strong>' + steigung + '</strong></td>';
        html += '<td>' + fE(rg.steuerersparnis_jahr) + '</td>';
        html += '<td>' + fE(rg.gutachterkosten) + '</td>';
        html += '<td><strong>' + amort + '</strong></td>';
        html += '<td>' + esc(empf) + '</td>';
        html += '</tr>';
      });
      html += '  </tbody></table>';
      html += '  <div class="ps-zukauf-zins-hint" style="margin-top:12px">';
      html += '    <strong>So liest du die Tabelle:</strong> "Steigerung" = AfA-Erhöhung in % (bei einer Verdopplung steht +100 %). "Mehr Steuer/J" = jährliche Steuer-Ersparnis bei deinem Grenzsteuersatz. "Amortisation" = wie viele Jahre, bis die Gutachter-Kosten durch die Ersparnis hereinkommen. Unter 1 Jahr ist Top.';
      html += '  </div>';
      html += '</div>';
    }

    // ─── V137: GMBH-VERKAUF-KARTE (verdeckte Einlage / 7-%-Methode) ──
    if (port.gmbhVerkauf) {
      var gv = port.gmbhVerkauf;
      html += '<div class="ps-card ps-gmbh-verkauf-card">';
      html += '  <h3>Verkauf an eigene GmbH (verdeckte Einlage / 7-%-Methode)</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Bei Objekten >10 J. (§23 EStG-frei) kann ein Verkauf an die eigene GmbH zu einem reduzierten KP erfolgen. Die Differenz wird als <strong>verdeckte Einlage</strong> behandelt: Aktiva mit Verkehrswert (§6 Abs. 1 Nr. 5 EStG), Passiva mit dem KP. GrESt fällt nur auf den KP an. BFH-Untergrenze: 4-5 % vom Buchwert, Sicherheits-Puffer 7-15 % vom Verkehrswert.</div>';

      html += '  <div class="ps-gv-config">';
      html += '    <label class="ps-bw-label">Kaufpreis-Anteil vom Verkehrswert (%)</label>';
      html += '    <input id="ps-gmbh-verkauf-pct" type="number" min="4" max="15" step="0.5" value="' + (inp.gmbh_verkauf_pct || 7) + '" class="ps-bw-input">';
      html += '    <button class="ps-cta" type="button" onclick="psSetGmbhVerkaufPct()">Anwenden</button>';
      html += '    <div class="ps-bw-hint">Aktuell: <strong>' + gv.pct_verwendet.toFixed(1).replace('.', ',') + ' %</strong> vom Verkehrswert. Erlaubt: 4-15 %. Bei <4 %: §8 Abs. 2 Nr. 1 GrEStG → Grundbesitzwert als Bemessungsgrundlage.</div>';
      html += '  </div>';

      if (gv.kandidaten && gv.kandidaten.length > 0) {
        html += '  <div class="ps-gv-summary">';
        html += '    <div class="ps-gv-stat">';
        html += '      <div class="ps-gv-stat-label">GEEIGNETE OBJEKTE</div>';
        html += '      <div class="ps-gv-stat-value">' + gv.anzahl_kandidaten + '</div>';
        html += '    </div>';
        html += '    <div class="ps-gv-stat">';
        html += '      <div class="ps-gv-stat-label">GrESt-ERSPARNIS GESAMT</div>';
        html += '      <div class="ps-gv-stat-value">' + fE(gv.summe_grest_ersparnis) + '</div>';
        html += '    </div>';
        html += '    <div class="ps-gv-stat">';
        html += '      <div class="ps-gv-stat-label">VERDECKTE EINLAGE GESAMT</div>';
        html += '      <div class="ps-gv-stat-value">' + fE(gv.summe_verdeckte_einlage) + '</div>';
        html += '    </div>';
        html += '  </div>';

        html += '  <table class="ps-gv-tab">';
        html += '    <thead><tr><th>Objekt</th><th>Verkehrswert</th><th>KP an GmbH</th><th>GrESt Standard</th><th>GrESt 7%</th><th>Ersparnis</th><th>Verdeckte Einlage</th><th>Halte­dauer</th></tr></thead><tbody>';
        gv.kandidaten.forEach(function(k) {
          html += '<tr>';
          html += '<td><strong>' + esc(k.kuerzel) + '</strong></td>';
          html += '<td>' + fE(k.verkehrswert) + '</td>';
          html += '<td>' + fE(k.kp_an_gmbh) + '</td>';
          html += '<td>' + fE(k.grest_standard) + '</td>';
          html += '<td>' + fE(k.grest_7pct) + '</td>';
          html += '<td class="ps-gv-save"><strong>' + fE(k.grest_ersparnis) + '</strong></td>';
          html += '<td>' + fE(k.verdeckte_einlage) + '</td>';
          html += '<td>' + k.halte_dauer_jahre + ' J.</td>';
          html += '</tr>';
        });
        html += '  </tbody></table>';

        html += '  <div class="ps-gv-construct">';
        html += '    <div class="ps-gv-construct-title">SO WIRKT DAS KONSTRUKT</div>';
        html += '    <div class="ps-gv-construct-grid">';
        html += '      <div class="ps-gv-construct-side">';
        html += '        <div class="ps-gv-side-title">AKTIVA (GmbH-Bilanz)</div>';
        html += '        <div class="ps-gv-side-amount">' + fE(gv.kandidaten.reduce(function(s, k) { return s + k.verkehrswert; }, 0)) + '</div>';
        html += '        <div class="ps-gv-side-detail">Teilwert (= Verkehrswert) gemäß §6 Abs. 1 Nr. 5 EStG i.V.m. §8 Abs. 1 KStG</div>';
        html += '      </div>';
        html += '      <div class="ps-gv-construct-arrow">=</div>';
        html += '      <div class="ps-gv-construct-side">';
        html += '        <div class="ps-gv-side-title">PASSIVA</div>';
        html += '        <div class="ps-gv-side-amount">' + fE(gv.kandidaten.reduce(function(s, k) { return s + k.kp_an_gmbh; }, 0)) + ' Verbindlichkeit</div>';
        html += '        <div class="ps-gv-side-detail">+ ' + fE(gv.summe_kapitalruecklage) + ' Kapitalrücklage (§27 KStG-Einlagekonto)</div>';
        html += '      </div>';
        html += '    </div>';
        html += '  </div>';
      }
      if (gv.nicht_geeignet && gv.nicht_geeignet.length > 0) {
        html += '  <div class="ps-zukauf-zins-hint" style="margin-top:12px">';
        html += '    <strong>Nicht aktivierbar:</strong> ' + gv.nicht_geeignet.length + ' Objekt(e) noch in §23-Spekfrist. ';
        html += gv.nicht_geeignet.map(function(n) { return esc(n.kuerzel) + ' (' + n.spekfrist_rest + ' J. Rest)'; }).join(', ');
        html += '  </div>';
      }
      if (gv.kandidaten.length === 0 && gv.nicht_geeignet.length === 0) {
        html += '  <div class="ps-zukauf-zins-hint">Keine Bestandsobjekte für die 7-%-Methode verfügbar. Sobald ein Objekt >10 J. gehalten ist, wird es hier automatisch als Kandidat angezeigt.</div>';
      }
      html += '</div>';
    }

    // ─── V138: KP-AUFTEILUNG GRUND/BODEN VS. GEBÄUDE ─────────
    if (port.kpAufteilung && port.kpAufteilung.anwendbar && port.zukaufPlan && port.zukaufPlan.ziel_objekte_pa > 0) {
      var kpa = port.kpAufteilung;
      html += '<div class="ps-card ps-kpa-card">';
      html += '  <h3>Kaufpreis-Aufteilung — Hebel im Notarvertrag</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Nur der Gebäudeanteil ist abschreibbar. Standard ist oft 75 %, mit Bodenrichtwert-Argumentation oder Sachverständigen-Gutachten sind 85 %+ möglich. Höherer Gebäudeanteil = mehr AfA = weniger Steuer über die ganze Halte­dauer.</div>';
      html += '  <div class="ps-kpa-grid">';
      html += '    <div class="ps-kpa-col">';
      html += '      <label class="ps-bw-label">Aktueller Gebäudeanteil (%)</label>';
      html += '      <input id="ps-kpa-aktuell" type="number" min="50" max="95" step="1" value="' + kpa.kp_aufteilung_aktuell_pct + '" class="ps-bw-input">';
      html += '      <div class="ps-bw-hint">Standard 75 % (Schätzung Finanzamt)</div>';
      html += '    </div>';
      html += '    <div class="ps-kpa-col">';
      html += '      <label class="ps-bw-label">Optimierter Anteil (%)</label>';
      html += '      <input id="ps-kpa-optimiert" type="number" min="50" max="95" step="1" value="' + kpa.kp_aufteilung_optimiert_pct + '" class="ps-bw-input">';
      html += '      <div class="ps-bw-hint">Mit Argumentation typisch 80-87 %</div>';
      html += '    </div>';
      html += '    <div class="ps-kpa-col ps-bw-result">';
      html += '      <div class="ps-bw-result-label">DIFFERENZ</div>';
      html += '      <div class="ps-bw-result-value">+' + kpa.diff_pct + ' %</div>';
      html += '      <div class="ps-bw-hint">Punkte mehr</div>';
      html += '    </div>';
      html += '  </div>';
      html += '  <button class="ps-cta" type="button" onclick="psSetKpAufteilung()">Hebel berechnen</button>';
      html += '  <div class="ps-kpa-stats" style="margin-top:14px">';
      html += '    <div class="ps-kpa-stat"><div class="ps-kpa-stat-label">MEHR AfA-BASIS PRO OBJEKT</div><div class="ps-kpa-stat-value">' + fE(kpa.mehr_afa_basis_pro_objekt) + '</div></div>';
      html += '    <div class="ps-kpa-stat"><div class="ps-kpa-stat-label">MEHR STEUER/J PRO OBJEKT</div><div class="ps-kpa-stat-value">' + fE(kpa.mehr_steuer_pa_pro_objekt) + '</div></div>';
      html += '    <div class="ps-kpa-stat"><div class="ps-kpa-stat-label">ÜBER 50 J. PRO OBJEKT</div><div class="ps-kpa-stat-value">' + fE(kpa.mehr_steuer_50j_pro_objekt) + '</div></div>';
      if (kpa.objekte_pa > 0) {
        html += '    <div class="ps-kpa-stat ps-kpa-highlight"><div class="ps-kpa-stat-label">5J HEBEL (' + kpa.objekte_pa + ' Käufe/J)</div><div class="ps-kpa-stat-value">' + fE(kpa.hebel_5j_alle_kaufe) + '</div></div>';
      }
      html += '  </div>';
      html += '  <div class="ps-zukauf-zins-hint" style="margin-top:14px">';
      html += '    <strong>Praxis-Tipp:</strong> Bei jedem Notarvertrag explizit eine Aufteilung vereinbaren. Bei guter Lage mit hohem Bodenrichtwert ist 80 % Geb-Anteil realistisch, bei B-/C-Lagen oft 85-87 %. BMF-Aufteilungs-Hilfe als Vergleichs-Anker nutzen. §6 Abs. 1 Nr. 1a EStG-Risiko (15-%-Regel) bei nachträglichen Sanierungen separat prüfen.';
      html += '  </div>';
      html += '</div>';
    }

    // ─── V138: EIGENHEIMSCHAUKEL ─────────────────────────────
    var ehs = port.eigenheimSchaukel;
    html += '<div class="ps-card ps-ehs-card">';
    html += '  <h3>Eigenheimschaukel — Vermögen steuerfrei zwischen Ehegatten</h3>';
    html += '  <div class="ps-sub" style="margin-bottom:14px">Das selbstgenutzte Familienheim kann zwischen Ehegatten in unbegrenzter Höhe schenkungsteuerfrei übertragen werden (§13 Abs. 1 Nr. 4a ErbStG). Über Hin- und Rückübertragung lässt sich Vermögen in Höhe des Verkehrswerts steuerfrei transferieren — ohne den 500k-Freibetrag (§16 ErbStG) anzutasten.</div>';
    html += '  <div class="ps-ehs-config">';
    html += '    <div class="ps-ehs-row">';
    html += '      <label class="ps-bw-label">Gibt es ein selbstgenutztes Familienheim?</label>';
    html += '      <select id="ps-ehs-hat" class="ps-bw-input">';
    html += '        <option value="false"' + (!inp.hat_familienheim ? ' selected' : '') + '>Nein</option>';
    html += '        <option value="true"' + (inp.hat_familienheim ? ' selected' : '') + '>Ja</option>';
    html += '      </select>';
    html += '    </div>';
    html += '    <div class="ps-ehs-row">';
    html += '      <label class="ps-bw-label">Verkehrswert Familienheim (€)</label>';
    html += '      <input id="ps-ehs-wert" type="number" min="0" step="10000" value="' + (inp.familienheim_wert || 0) + '" class="ps-bw-input">';
    html += '    </div>';
    html += '    <div class="ps-ehs-row">';
    html += '      <label class="ps-bw-label">Ehe / Lebenspartnerschaft?</label>';
    html += '      <select id="ps-ehs-partner" class="ps-bw-input">';
    html += '        <option value="false"' + (!inp.familienheim_partner ? ' selected' : '') + '>Nein</option>';
    html += '        <option value="true"' + (inp.familienheim_partner ? ' selected' : '') + '>Ja</option>';
    html += '      </select>';
    html += '    </div>';
    html += '    <button class="ps-cta" type="button" onclick="psSetEhsParams()" style="margin-top:8px">Anwenden</button>';
    html += '  </div>';

    if (ehs && ehs.anwendbar) {
      html += '  <div class="ps-ehs-result">';
      html += '    <div class="ps-ehs-stat"><div class="ps-kpa-stat-label">TRANSFERIERBARES VERMÖGEN</div><div class="ps-kpa-stat-value">' + fE(ehs.transferbarer_betrag) + '</div></div>';
      html += '    <div class="ps-ehs-stat"><div class="ps-kpa-stat-label">ALT-STEUER (SCHENKUNG)</div><div class="ps-kpa-stat-value">' + fE(ehs.alt_steuer_schenkung) + '</div></div>';
      html += '    <div class="ps-ehs-stat"><div class="ps-kpa-stat-label">GrESt-ERSPARNIS (' + esc(ehs.bundesland) + ')</div><div class="ps-kpa-stat-value">' + fE(ehs.grest_ersparnis) + '</div></div>';
      html += '    <div class="ps-ehs-stat ps-kpa-highlight"><div class="ps-kpa-stat-label">GESAMT-HEBEL</div><div class="ps-kpa-stat-value">' + fE(ehs.gesamt_hebel) + '</div></div>';
      html += '  </div>';
      html += '  <div class="ps-zukauf-zins-hint" style="margin-top:14px">';
      html += '    <strong>Konstruktion in 3 Schritten:</strong> 1. A schenkt Familienheim an B (steuerfrei §13 Abs. 1 Nr. 4a ErbStG). 2. ' + ehs.schamfrist_monate + '+ Monate Schamfrist abwarten (§42 AO-Schutz). 3. B verkauft an A zum Verkehrswert zurück (kein GrESt §3 Nr. 4 GrEStG, keine Spekulationssteuer §23 Abs. 1 Nr. 1 S. 3 EStG). Wiederholbar — kein Objektverbrauch, Freibetrag bleibt.';
      html += '  </div>';
    } else {
      html += '  <div class="ps-zukauf-zins-hint">';
      html += '    <strong>Aktuell nicht aktivierbar:</strong> ' + esc((ehs && ehs.grund) || 'Voraussetzungen prüfen') + '.';
      html += '  </div>';
    }
    html += '</div>';

    // ─── V138: FAMILIENSTIFTUNG VS. HOLDING ──────────────────
    if (port.stiftungVergleich && port.stiftungVergleich.empfohlen) {
      var sv = port.stiftungVergleich;
      html += '<div class="ps-card ps-stiftung-card">';
      html += '  <h3>Familienstiftung vs. Holding — Generationen-Plan</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Bei Portfolio-Volumen ' + fE(sv.portfolio_volumen) + ' lohnt sich der Vergleich zur Familienstiftung. Beide Strukturen versteuern laufende Erträge ähnlich, unterscheiden sich aber massiv in Errichtung, Nachfolge und Schutz.</div>';
      html += '  <div class="ps-vgl-cols">';
      html += '    <div class="ps-vgl-col">';
      html += '      <div class="ps-vgl-h">HOLDING-GMBH</div>';
      html += '      <table class="ps-vgl-tab">';
      html += '        <tr><td>Setup-Kosten</td><td>' + fE(sv.holding.setup_kosten) + '</td></tr>';
      html += '        <tr><td>Steuer/J auf Erträge</td><td>' + fE(sv.holding.steuer_pa) + '</td></tr>';
      html += '        <tr><td>Verwaltung/J</td><td>' + fE(sv.holding.laufend_pa) + '</td></tr>';
      html += '        <tr class="ps-vgl-total"><td><strong>Gesamt 30 J.</strong></td><td><strong>' + fE(sv.holding.gesamt_30j) + '</strong></td></tr>';
      html += '      </table>';
      html += '      <div class="ps-vgl-pro"><strong>Vorteil:</strong> ' + esc(sv.holding.vorteil) + '</div>';
      html += '      <div class="ps-vgl-con"><strong>Nachteil:</strong> ' + esc(sv.holding.nachteil) + '</div>';
      html += '    </div>';
      html += '    <div class="ps-vgl-col ps-vgl-col-highlight">';
      html += '      <div class="ps-vgl-h">FAMILIENSTIFTUNG</div>';
      html += '      <table class="ps-vgl-tab">';
      html += '        <tr><td>Errichtungs-Schenkungssteuer</td><td>' + fE(sv.stiftung.setup_steuer) + '</td></tr>';
      html += '        <tr><td>Setup-Kosten</td><td>' + fE(sv.stiftung.setup_kosten) + '</td></tr>';
      html += '        <tr><td>Steuer/J auf Erträge</td><td>' + fE(sv.stiftung.steuer_pa) + '</td></tr>';
      html += '        <tr><td>Verwaltung/J</td><td>' + fE(sv.stiftung.laufend_pa) + '</td></tr>';
      html += '        <tr><td>Ersatz-ErbSt nach 30 J.</td><td>' + fE(sv.stiftung.ersatz_erbst_30j) + '</td></tr>';
      html += '        <tr class="ps-vgl-total"><td><strong>Gesamt 30 J.</strong></td><td><strong>' + fE(sv.stiftung.gesamt_30j) + '</strong></td></tr>';
      html += '      </table>';
      html += '      <div class="ps-vgl-pro"><strong>Vorteil:</strong> ' + esc(sv.stiftung.vorteil) + '</div>';
      html += '      <div class="ps-vgl-con"><strong>Nachteil:</strong> ' + esc(sv.stiftung.nachteil) + '</div>';
      html += '    </div>';
      html += '  </div>';
      html += '  <div class="ps-vgl-empfehlung"><strong>Empfehlung:</strong> ' + esc(sv.empfehlung) + '</div>';
      html += '</div>';
    }

    // ─── V137: VISUELLE STRATEGIE-ÜBERSICHT (SVG) ────────────
    html += '<div class="ps-card ps-vis-card">';
    html += '  <h3>Strategie-Aufbau visuell</h3>';
    html += '  <div class="ps-sub" style="margin-bottom:14px">Wo das Geld ist, woher EK kommt, was die nächste Phase trägt.</div>';
    html += '  <div class="ps-vis-svg-wrap">';
    html += _renderStrategySvg(port, inp);
    html += '  </div>';
    html += '</div>';

    // ─── V134: Lage- & Markt-Lage-Karte ────────────────────────
    // Zeigt die wichtigsten KPIs aus den DealScore-Aggregationen
    // prominent vor den Strategien. Dadurch wird klar: warum welche
    // Strategie greift.
    if (port.lageAvg != null || port.mietluecke_total_y != null || port.hotspot_objects != null) {
      html += '<div class="ps-card ps-market-card">';
      html += '  <h3>Lage- & Markt-Diagnose</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Die KPIs aus dem DealScore zeigen, wo dein Portfolio steht. Diese treiben die Strategie-Empfehlungen unten — z. B. wird Mietkonvergenz bei großer Mietlücke priorisiert, Diversifikation bei Klumpen-Risiko.</div>';
      html += '  <div class="ps-market-grid">';

      // Lage-Score
      if (port.lageAvg != null) {
        var lageColor = port.lageAvg >= 70 ? 'green' : port.lageAvg >= 50 ? 'gold' : 'red';
        html += '    <div class="ps-market-tile ps-market-' + lageColor + '">';
        html += '      <div class="ps-market-label">Ø LAGE-SCORE</div>';
        html += '      <div class="ps-market-value">' + Math.round(port.lageAvg) + '<span class="ps-market-unit">/100</span></div>';
        html += '      <div class="ps-market-meta">' + (port.topLageObjects && port.topLageObjects.length > 0 ? 'Top: ' + port.topLageObjects.slice(0, 2).map(function(o) { return esc(o.kuerzel); }).join(', ') : 'Top: –') + '</div>';
        html += '    </div>';
      }

      // Upside-Score
      if (port.upsideAvg != null) {
        var upColor = port.upsideAvg >= 70 ? 'green' : port.upsideAvg >= 50 ? 'gold' : 'red';
        html += '    <div class="ps-market-tile ps-market-' + upColor + '">';
        html += '      <div class="ps-market-label">Ø UPSIDE-POTENZIAL</div>';
        html += '      <div class="ps-market-value">' + Math.round(port.upsideAvg) + '<span class="ps-market-unit">/100</span></div>';
        html += '      <div class="ps-market-meta">Wachstum, Mietsteigerung, Faktor</div>';
        html += '    </div>';
      }

      // Mietlücke
      var mlColor = port.mietluecke_total_y > 5000 ? 'red' : port.mietluecke_total_y > 1500 ? 'gold' : 'green';
      html += '    <div class="ps-market-tile ps-market-' + mlColor + '">';
      html += '      <div class="ps-market-label">MIETLÜCKE GESAMT</div>';
      html += '      <div class="ps-market-value">' + fE(port.mietluecke_total_y || 0) + '<span class="ps-market-unit">/Jahr</span></div>';
      html += '      <div class="ps-market-meta">' + ((port.mietluecke_objects || []).length) + ' Objekt(e) mit Lücke >1k</div>';
      html += '    </div>';

      // Klumpen-Risiko
      var klColor = port.klumpen_max >= 4 ? 'red' : port.klumpen_max >= 3 ? 'gold' : 'green';
      html += '    <div class="ps-market-tile ps-market-' + klColor + '">';
      html += '      <div class="ps-market-label">KLUMPEN-RISIKO</div>';
      html += '      <div class="ps-market-value">' + (port.klumpen_max || 1) + '<span class="ps-market-unit">Obj.</span></div>';
      html += '      <div class="ps-market-meta">' + (port.klumpen_orte && port.klumpen_orte[0] ? 'Max in: ' + esc(port.klumpen_orte[0].ort) : 'Gut gestreut') + '</div>';
      html += '    </div>';

      // Hotspot-Quote
      var hotCount = (port.hotspot_objects || []).length;
      var hotColor = hotCount > 0 ? 'green' : 'gold';
      html += '    <div class="ps-market-tile ps-market-' + hotColor + '">';
      html += '      <div class="ps-market-label">WACHSTUMS-HOTSPOTS</div>';
      html += '      <div class="ps-market-value">' + hotCount + '<span class="ps-market-unit">Obj.</span></div>';
      html += '      <div class="ps-market-meta">Bevölk.+Nachfrage stark</div>';
      html += '    </div>';

      // Energie-Risiko
      var enCount = (port.energie_risiko_objects || []).length;
      var enColor = enCount > 0 ? 'red' : 'green';
      html += '    <div class="ps-market-tile ps-market-' + enColor + '">';
      html += '      <div class="ps-market-label">ENERGIE-RISIKO</div>';
      html += '      <div class="ps-market-value">' + enCount + '<span class="ps-market-unit">Obj.</span></div>';
      html += '      <div class="ps-market-meta">Klassen F/G/H</div>';
      html += '    </div>';

      html += '  </div>';

      // Zusammenfassende Erkenntnisse
      var insights = [];
      if (port.mietluecke_total_y > 5000) insights.push('<strong>Größter Hebel: Mietkonvergenz.</strong> Allein durch §558/§559-BGB-Anpassungen lassen sich über 5 J. ~' + fE(port.mietluecke_total_y * 0.6 * 5) + ' zusätzlicher Cashflow heben.');
      if (port.klumpen_max >= 3) insights.push('<strong>Strukturelles Risiko: Klumpen.</strong> ' + port.klumpen_max + ' Objekte in ' + esc(port.klumpen_orte[0].ort) + ' — beim nächsten Zukauf andere Region wählen.');
      if (port.energie_risiko_objects && port.energie_risiko_objects.length > 0) insights.push('<strong>Regulatorisches Risiko: GEG.</strong> ' + port.energie_risiko_objects.length + ' Objekt(e) mit Klasse F/G/H — Sanierung mit §35c+BEG-Förderung priorisieren.');
      if (port.ueberteuert_count > 0) insights.push('<strong>Faktor-Arbitrage-Chance:</strong> ' + port.ueberteuert_count + ' Objekt(e) mit hohem Faktor in schwacher Lage — Verkauf nach §23-Frist erwägen.');
      if (insights.length > 0) {
        html += '  <div class="ps-market-insights">';
        html += '    <div class="ps-market-insights-title">Was die KPIs sagen</div>';
        html += '    <ul>';
        insights.forEach(function(i) { html += '<li>' + i + '</li>'; });
        html += '    </ul>';
        html += '  </div>';
      }

      html += '</div>';
    }

    // ─── V133: GmbH-Tier-Visualisierung ────────────────────────
    // Zeigt das 5-Stufen-Schema mit "DU BIST HIER"-Markierung.
    // Datenquelle: Strategie D hat in V133 ein gmbh_tier-Objekt.
    var gmbhStrat = (res.strategien || []).filter(function(s) { return s.key === 'gmbh_aufbau'; })[0];
    if (gmbhStrat && gmbhStrat.gmbh_tier && window.PortfolioStrategy && window.PortfolioStrategy.GMBH_TIERS) {
      var tierInfo = gmbhStrat.gmbh_tier;
      var tiers = window.PortfolioStrategy.GMBH_TIERS;
      var aktKey = tierInfo.aktuell;

      html += '<div class="ps-card ps-tier-card">';
      html += '  <h3>GmbH-Stufenmodell — wo stehst du, wo geht es hin?</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:18px">Die Frage „lohnt sich eine VV-GmbH" hat keine pauschale Antwort. Das Stufenmodell zeigt fünf Bereiche basierend auf dem laufenden V+V-Überschuss pro Jahr — und welche Empfehlung jeweils sinnvoll ist. Quellen: qonto.com, ride.capital, immoprentice.de (recherchiert 02/2026).</div>';

      // Aktuelle Position anzeigen
      html += '  <div class="ps-tier-current">';
      html += '    <div class="ps-tier-current-label">DEINE AKTUELLE POSITION</div>';
      html += '    <div class="ps-tier-current-vuv">' + fEs(tierInfo.vuv_y) + ' V+V-Überschuss/Jahr</div>';
      html += '    <div class="ps-tier-current-meta">Grenzsteuersatz ' + Math.round(tierInfo.grenzsteuersatz * 100) + ' %  ·  Brutto-Vorteil GmbH ' + fE(tierInfo.vorteil_brutto_y) + '/J  ·  Netto nach Strukturkosten ' + (tierInfo.vorteil_netto_y >= 0 ? fE(tierInfo.vorteil_netto_y) : fEs(tierInfo.vorteil_netto_y)) + '/J</div>';
      html += '  </div>';

      // Tier-Treppe
      html += '  <div class="ps-tier-stairs">';
      tiers.forEach(function(t, i) {
        var isActive = (t.key === aktKey);
        var cls = 'ps-tier-step ps-tier-' + t.key + (isActive ? ' ps-tier-active' : '');
        html += '<div class="' + cls + '">';
        if (isActive) {
          html += '  <div class="ps-tier-here">▼ DU BIST HIER</div>';
        }
        html += '  <div class="ps-tier-num">' + i + '</div>';
        html += '  <div class="ps-tier-name">' + esc(t.name.replace(/Tier \d+ — /, '')) + '</div>';
        html += '  <div class="ps-tier-vuv">' + esc(t.vuv_label) + '</div>';
        html += '  <div class="ps-tier-headline">' + esc(t.headline) + '</div>';
        html += '  <div class="ps-tier-kurz">' + esc(t.kurz) + '</div>';
        html += '</div>';
      });
      html += '  </div>';

      // Detail des aktuellen Tiers
      var aktTier = tiers.filter(function(t) { return t.key === aktKey; })[0];
      if (aktTier) {
        html += '  <div class="ps-tier-detail">';
        html += '    <div class="ps-tier-detail-title">' + esc(aktTier.name) + ' — was bedeutet das?</div>';
        html += '    <div class="ps-tier-detail-body">' + esc(aktTier.detail) + '</div>';
        if (aktTier.braucht && aktTier.braucht.length > 0) {
          html += '    <div class="ps-tier-detail-braucht"><strong>Was du dafür brauchst:</strong><ul>';
          aktTier.braucht.forEach(function(b) { html += '<li>' + esc(b) + '</li>'; });
          html += '    </ul></div>';
        }
        html += '  </div>';
      }
      html += '</div>';
    }

    // ─── V133: GMBH-TIER-SCHEMA ──────────────────────────────────
    if (res.gmbhTier && res.gmbhTiers) {
      var tCur = res.gmbhTier.effective;
      var tBase = res.gmbhTier.base;
      var hint = res.gmbhTier.hint;
      var vuv = port.vuv_y || 0;
      html += '<div class="ps-card ps-tier-card">';
      html += '  <h3>GmbH-Tier-System — Wo stehst du?</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">5 Stufen, abgeleitet aus dem laufenden V+V-Überschuss. Aktuell: <strong>' + Math.round(vuv).toLocaleString('de-DE') + ' €/J</strong>. Quellenlage: qonto.com setzt 75k an (konservativ), ride.capital ~3.000 €/J Strukturkosten als Untergrenze, immoprentice rechnet anhand Beispielen vor (ETW vs. MFH). Wir arbeiten mit einer Mittelweg-Schwelle ab 12k (bei vorhandener GmbH) bzw. 25k (Neugründung).</div>';
      html += '  <div class="ps-tier-row">';
      res.gmbhTiers.forEach(function(t) {
        var isCurrent = (t.key === tCur.key);
        var isBase = (t.key === tBase.key) && !isCurrent;
        var cls = 'ps-tier-step' + (isCurrent ? ' ps-tier-current' : '') + (isBase ? ' ps-tier-base' : '');
        html += '<div class="' + cls + '">';
        html += '  <div class="ps-tier-num">T' + t.tier + '</div>';
        html += '  <div class="ps-tier-range">' + (t.vuv_max == null ? '>' + (t.vuv_min/1000) + 'k' : (t.vuv_min/1000) + '–' + (t.vuv_max/1000) + 'k') + '</div>';
        html += '  <div class="ps-tier-label">' + esc(t.label) + '</div>';
        html += '  <div class="ps-tier-kurz">' + esc(t.kurz) + '</div>';
        if (isCurrent) html += '<div class="ps-tier-marker">DU BIST HIER</div>';
        html += '</div>';
      });
      html += '  </div>';

      // Empfehlungs-Detail-Box
      html += '  <div class="ps-tier-detail">';
      html += '    <div class="ps-tier-detail-h">' + esc(tCur.name) + ' — ' + esc(tCur.label) + '</div>';
      html += '    <div class="ps-tier-detail-body">' + esc(tCur.detail || '') + ' ' + esc(tCur.empfehlung) + '</div>';
      if (hint) {
        html += '    <div class="ps-tier-hint">⚡ ' + esc(hint) + '</div>';
      }
      html += '    <div class="ps-tier-grid">';
      html += '      <div class="ps-tier-block ps-tier-pros"><div class="ps-tier-block-h">Vorteile in diesem Tier</div><ul>';
      (tCur.vorteile || []).forEach(function(p) { html += '<li>' + esc(p) + '</li>'; });
      html += '      </ul></div>';
      html += '      <div class="ps-tier-block ps-tier-cons"><div class="ps-tier-block-h">Nachteile in diesem Tier</div><ul>';
      (tCur.nachteile || []).forEach(function(p) { html += '<li>' + esc(p) + '</li>'; });
      html += '      </ul></div>';
      html += '    </div>';
      html += '  </div>';
      html += '  <div class="ps-tier-source">Quellen: <a href="https://qonto.com/de/blog/unternehmensgruendung/gmbh/vermoegensverwaltende-gmbh" target="_blank">qonto.com</a> · <a href="https://www.ride.capital/faq/lohnt-sich-eine-vermögensverwaltende-gmbh-für-immobilien" target="_blank">ride.capital</a> · <a href="https://immoprentice.de/vermoegensverwaltende-gmbh-fuer-immobilien-lohnt-sich-das/" target="_blank">immoprentice.de</a> · <a href="https://meine-renditeimmobilie.de/vermoegensverwaltende-gmbh/" target="_blank">meine-renditeimmobilie.de</a></div>';
      html += '</div>';
    }

    if (res.strategien && res.strategien.length > 0) {
      html += '<div class="ps-card ps-multi">';
      html += '  <h3>' + (res.strategien.length === 7 ? 'Sieben' : res.strategien.length) + ' Strategien zur Wahl</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:18px">Verschiedene Wege, dein Portfolio zu führen — jede mit Vor- und Nachteilen, konkreten Schritten und §-Verweisen ins Glossar unten. Keine ist „richtig" — sie passen zu unterschiedlichen Lebenssituationen, Zielen und Beständen.</div>';
      html += '  <div class="ps-multi-grid">';
      res.strategien.forEach(function(s) {
        var passt = s.passt_zu.indexOf(res.profile.key) >= 0;
        html += '<div class="ps-strat-card' + (passt ? ' ps-strat-passt' : '') + '">';
        html += '  <div class="ps-strat-head">';
        html += '    <div class="ps-strat-name">' + esc(s.name) + '</div>';
        if (passt) html += '    <span class="ps-strat-badge">passt zu deinem Profil</span>';
        html += '  </div>';
        html += '  <div class="ps-strat-ziel">' + esc(s.ziel) + '</div>';
        html += '  <div class="ps-strat-ansatz">' + esc(s.ansatz) + '</div>';
        if (s.impact_5j > 0) {
          html += '  <div class="ps-strat-impact">Geschätzter 5-Jahres-Effekt: <strong>~' + fE(s.impact_5j) + '</strong></div>';
        }
        // Konkrete Schritte
        html += '  <div class="ps-strat-h">Konkrete Schritte</div>';
        html += '  <ol class="ps-strat-steps">';
        s.konkrete_schritte.forEach(function(k) {
          html += '<li><strong>' + esc(k.titel) + '</strong>';
          if (k.zeitrahmen) html += ' <span class="ps-strat-zeit">[' + esc(k.zeitrahmen) + ']</span>';
          html += '<div class="ps-strat-step-detail">' + esc(k.detail) + '</div>';
          if (k.impact) html += '<div class="ps-strat-step-impact">Impact ~' + fE(k.impact) + '</div>';
          html += '</li>';
        });
        html += '  </ol>';
        // V131: §-Chips wenn paragraphs gesetzt
        if (s.paragraphs && s.paragraphs.length > 0 && window.PortfolioStrategy && window.PortfolioStrategy.GLOSSARY) {
          html += '  <div class="ps-strat-paras">';
          html += '    <div class="ps-strat-h">Relevante Paragraphen</div>';
          html += '    <div class="ps-para-chips">';
          s.paragraphs.forEach(function(pk) {
            var entry = window.PortfolioStrategy.GLOSSARY[pk];
            if (entry) {
              html += '<a class="ps-para-chip" href="#ps-glossary-' + esc(pk) + '" onclick="document.getElementById(\'ps-glossary-' + esc(pk) + '\').open=true; return true;">' + esc(entry.titel.split('—')[0].trim()) + '</a>';
            }
          });
          html += '    </div>';
          html += '  </div>';
        }
        // Pros / Cons
        html += '  <div class="ps-strat-procon">';
        html += '    <div class="ps-strat-pros"><div class="ps-strat-h c-green">Vorteile</div><ul>';
        s.pros.forEach(function(p) { html += '<li>' + esc(p) + '</li>'; });
        html += '    </ul></div>';
        html += '    <div class="ps-strat-cons"><div class="ps-strat-h c-red">Nachteile</div><ul>';
        s.cons.forEach(function(p) { html += '<li>' + esc(p) + '</li>'; });
        html += '    </ul></div>';
        html += '  </div>';
        // Was musst du einbringen?
        html += '  <div class="ps-strat-braucht">';
        html += '    <div class="ps-strat-h">Was du dafür einbringen musst</div>';
        html += '    <ul>';
        s.braucht.forEach(function(p) { html += '<li>' + esc(p) + '</li>'; });
        html += '    </ul>';
        html += '  </div>';
        html += '</div>';
      });
      html += '  </div>';
      html += '</div>';
    }

    // ─── Peer-Vergleich (V129: NEU) ──────────────────────────────
    if (res.peers && res.peers.length > 0) {
      html += '<div class="ps-card">';
      html += '  <h3>So machen es andere Investoren</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:18px">Drei archetypische Investoren-Profile und wie sie mit deinem Bestand vorgehen würden — als Inspiration für eine bewusste eigene Entscheidung.</div>';
      html += '  <div class="ps-peer-grid">';
      res.peers.forEach(function(p) {
        html += '<div class="ps-peer-card">';
        html += '  <div class="ps-peer-typ">' + esc(p.typ) + '</div>';
        html += '  <div class="ps-peer-kontext"><em>' + esc(p.kontext) + '</em></div>';
        html += '  <div class="ps-peer-h">Vorgehen</div>';
        html += '  <div class="ps-peer-text">' + esc(p.vorgehen) + '</div>';
        html += '  <div class="ps-peer-h">Anders als du</div>';
        html += '  <div class="ps-peer-text">' + esc(p.andersAlsDu) + '</div>';
        html += '</div>';
      });
      html += '  </div>';
      html += '</div>';
    }

    // ─── Top-Empfehlungen (V126) ──────────────────────────────────
    if (res.topVerdicts && res.topVerdicts.length > 0) {
      html += '<div class="ps-card">';
      html += '  <h3>Top-Empfehlungen für dieses Portfolio</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:14px">Aggregiert über alle Objekte · gewichtet nach Profil "<strong>' + esc(res.profile.label) + '</strong>"</div>';
      html += '  <div class="ps-verdict-list">';
      res.topVerdicts.slice(0, 8).forEach(function(v) {
        var icon = v.severity === 'opportunity' ? '✓' : (v.severity === 'warning' ? '!' : 'i');
        html += '<div class="ps-verdict ps-v-' + v.severity + '">';
        html += '  <div class="ps-v-icon">' + icon + '</div>';
        html += '  <div class="ps-v-body">';
        html += '    <div class="ps-v-label">' + esc(v.label) + '</div>';
        html += '    <div class="ps-v-meta">' + v.count + ' Objekt(e)';
        if (v.total_impact) html += ' · Impact ~' + fE(v.total_impact);
        html += ' · ' + v.objects.map(function(o) { return esc(o.kuerzel); }).join(', ');
        html += '</div>';
        html += '  </div>';
        html += '</div>';
      });
      html += '  </div>';
      html += '</div>';
    }

    // ─── Pro-Objekt-Tabelle mit RND + Verdikten (V126) ────────────
    html += '<div class="ps-card">';
    html += '  <h3>Pro-Objekt-Analyse</h3>';
    html += '  <div class="ps-sub" style="margin-bottom:14px">Restnutzungsdauer, §23-Frist und individuelle Empfehlungen</div>';
    html += '  <div class="ps-table-wrap">';
    html += '    <table class="ps-table ps-obj-table">';
    html += '      <thead><tr>';
    html += '        <th>Objekt</th>';
    html += '        <th class="r">Bj.</th>';
    html += '        <th class="r">RND</th>';
    html += '        <th class="r">San.</th>';
    html += '        <th class="r">§23-Rest</th>';
    html += '        <th class="r">LTV</th>';
    html += '        <th class="r">Miete €/m²</th>';
    html += '        <th class="r">Bel.-Reserve</th>';
    html += '        <th class="r">V+V/J.</th>';
    html += '        <th>Empfehlungen</th>';
    html += '      </tr></thead>';
    html += '      <tbody>';
    res.verdicts.forEach(function(item) {
      var r = item.object;
      html += '<tr>';
      html += '  <td><strong>' + esc(r.kuerzel) + '</strong><div class="ps-row-sub">' + esc(r.adresse || '–') + '</div></td>';
      html += '  <td class="r">' + (r.baujahr || '–') + '</td>';
      html += '  <td class="r">' + (r.rnd ? r.rnd.rnd_jahre + ' J' : '<span class="ps-muted">–</span>') + '</td>';
      html += '  <td class="r">' + _sanstandBadge(r.sanstand) + '</td>';
      html += '  <td class="r">' + (r.spekfrist_rest != null
        ? (r.spekfrist_rest === 0 ? '<span class="c-green">abgelaufen</span>' : r.spekfrist_rest + ' J')
        : '<span class="ps-muted">–</span>') + '</td>';
      html += '  <td class="r ' + _ltvClass(r.ltv_aktuell || r.ltv) + '">' + fP((r.ltv_aktuell || r.ltv) * 100, 0) + '</td>';
      // V128: Miete-Spalte
      var mieteCell = '<span class="ps-muted">–</span>';
      if (r.ist_miete_qm > 0) {
        mieteCell = fN(r.ist_miete_qm, 2);
        if (r.miete_luecke_y > 1500) {
          mieteCell += ' <span class="c-warn" title="Mietlücke ' + Math.round(r.miete_luecke_y).toLocaleString('de-DE') + ' €/J">(↑' + Math.round(r.marktmiete_qm * 100) / 100 + ')</span>';
        }
      }
      html += '  <td class="r">' + mieteCell + '</td>';
      html += '  <td class="r ' + (r.beleihungs_reserve > 30000 ? 'c-green' : 'ps-muted') + '">' + (r.beleihungs_reserve > 0 ? fE(r.beleihungs_reserve) : '<span class="ps-muted">–</span>') + '</td>';
      html += '  <td class="r ' + (r.vuv_y >= 0 ? '' : 'c-green') + '">' + fEs(r.vuv_y) + '</td>';
      html += '  <td><div class="ps-chip-row">';
      if (item.verdicts.length === 0) {
        html += '<span class="ps-muted">keine</span>';
      } else {
        item.verdicts.slice(0, 4).forEach(function(v) {
          html += '<span class="ps-chip ps-chip-' + v.severity + '" title="' + esc(v.detail) + '">' + esc(v.label) + '</span>';
        });
      }
      html += '</div></td>';
      html += '</tr>';
    });
    html += '      </tbody>';
    html += '    </table>';
    html += '  </div>';
    html += '  <div class="ps-hint">Hover auf eine Empfehlung zeigt die Details. Sanstand-Skala 1 (saniert/neu) bis 5 (stark sanierungsbedürftig).</div>';
    html += '</div>';
    html += '<div class="ps-card">';
    html += '  <h3>Szenarien-Vergleich</h3>';
    html += '  <div class="ps-table-wrap">';
    html += '    <table class="ps-table">';
    html += '      <thead><tr>';
    html += '        <th>Strategie</th>';
    html += '        <th class="r">Einmalkosten</th>';
    html += '        <th class="r">Steuer Jahr 1</th>';
    html += '        <th class="r">CF n. St. Jahr 1</th>';
    html += '        <th class="r">Steuer kumuliert (' + cfg.horizon_years + 'J.)</th>';
    html += '        <th class="r">CF kumuliert</th>';
    html += '        <th class="r">NPV</th>';
    html += '        <th class="r">Score</th>';
    html += '      </tr></thead>';
    html += '      <tbody>';
    sc.forEach(function(s) {
      var bestCls = (s.key === best.key) ? ' ps-row-best' : '';
      html += '<tr class="ps-row' + bestCls + '" onclick="psShowDetail(\'' + s.key + '\')">';
      html += '  <td><strong>' + esc(s.label) + '</strong>'
            + (s.key === best.key ? ' <span class="ps-best-badge">empfohlen</span>' : '')
            + '<div class="ps-row-sub">' + esc(s.struktur) + '</div></td>';
      html += '  <td class="r">' + fE(s.einmalkosten.summe) + '</td>';
      // Steuer J1: positiver Delta = Mehrbelastung (rot), negativer = Erstattung (grün).
      // Anzeige: "Belastung +X €" oder "Erstattung +X €"
      var stCell = s.jahr1.steuer >= 0
        ? '<span class="c-red">−' + fE(s.jahr1.steuer) + '</span>'
        : '<span class="c-green">+' + fE(Math.abs(s.jahr1.steuer)) + '</span>';
      html += '  <td class="r">' + stCell + '</td>';
      html += '  <td class="r ' + (s.jahr1.cf_n_st >= 0 ? 'c-green' : 'c-red') + '">' + fEs(s.jahr1.cf_n_st) + '</td>';
      html += '  <td class="r">' + fE(s.horizon.steuer_kum) + '</td>';
      html += '  <td class="r ' + (s.horizon.cf_kum >= 0 ? 'c-green' : 'c-red') + '">' + fEs(s.horizon.cf_kum) + '</td>';
      html += '  <td class="r"><strong>' + fEs(s.horizon.npv) + '</strong></td>';
      html += '  <td class="r"><div class="ps-score"><div class="ps-score-bar" style="width:' + s.score + '%"></div><span>' + s.score + '</span></div></td>';
      html += '</tr>';
    });
    html += '      </tbody>';
    html += '    </table>';
    html += '  </div>';
    html += '  <div class="ps-hint">Klick auf eine Zeile öffnet die Detail-Analyse mit Stärken/Schwächen.</div>';
    html += '</div>';

    // ─── Detail-Container (initial mit erstem Szenario) ──────────
    html += '<div class="ps-card" id="ps-detail">' + _renderDetail(best) + '</div>';

    // ─── Empfehlung ──────────────────────────────────────────────
    html += '<div class="ps-card ps-reco">';
    html += '  <h3>Empfehlung für Profil "' + esc(res.profile.label) + '"</h3>';
    html += '  <div class="ps-reco-body">';
    html += '    <div class="ps-reco-title">' + esc(best.label) + '</div>';
    html += '    <div class="ps-reco-desc">' + esc(best.struktur) + '</div>';
    html += '    <div class="ps-reco-num">NPV ' + cfg.horizon_years + ' Jahre: <strong>' + fEs(best.horizon.npv) + '</strong> · Score: <strong>' + best.score + '/100</strong> · CF kumuliert: ' + fEs(best.horizon.cf_kum) + '</div>';
    html += '    <div class="ps-reco-note">' + esc(best.note) + '</div>';
    html += '  </div>';
    html += '</div>';

    // ─── §-Glossar (V131: NEU) ─────────────────────────────────
    if (window.PortfolioStrategy && window.PortfolioStrategy.GLOSSARY) {
      var gl = window.PortfolioStrategy.GLOSSARY;
      html += '<div class="ps-card ps-glossary">';
      html += '  <h3>Steuer-Glossar — Paragraphen ausführlich erklärt</h3>';
      html += '  <div class="ps-sub" style="margin-bottom:18px">Jeder §-Verweis aus den Strategien hier ausführlich. Klick einen Eintrag in den Strategien an — er springt direkt zum passenden Glossar-Punkt. Alle Hinweise sind dokumentierte legale Gestaltungen — Steuerberater-Letzt-Check trotzdem zwingend.</div>';
      Object.keys(gl).forEach(function(k) {
        var e = gl[k];
        html += '<details class="ps-gloss-item" id="ps-glossary-' + esc(k) + '">';
        html += '  <summary>';
        html += '    <span class="ps-gloss-titel">' + esc(e.titel) + '</span>';
        html += '    <span class="ps-gloss-kurz">' + esc(e.kurz) + '</span>';
        html += '  </summary>';
        html += '  <div class="ps-gloss-body">';
        html += '    <div class="ps-gloss-section"><strong>Worum geht es:</strong> ' + esc(e.lang) + '</div>';
        html += '    <div class="ps-gloss-section"><strong>Wann/wie anwenden:</strong> ' + esc(e.anwendung) + '</div>';
        if (e.risiko) html += '    <div class="ps-gloss-section ps-gloss-risk"><strong>Risiken &amp; Voraussetzungen:</strong> ' + esc(e.risiko) + '</div>';
        html += '  </div>';
        html += '</details>';
      });
      html += '</div>';
    }

    // ─── Disclaimer (§6 StBerG) ───────────────────────────────────
    html += '<div class="ps-card ps-legal">';
    html += '  <h4>Wichtiger Hinweis</h4>';
    html += '  <p>Diese Analyse ist eine <strong>Modellrechnung</strong> und keine Steuer- oder Rechtsberatung im Sinne des §6 StBerG / §3 RDG. ';
    html += '  Sämtliche Berechnungen basieren auf vereinfachten Annahmen und stützen sich auf die Daten, die du im Modul hinterlegt hast. ';
    html += '  Bei §-Verweisen handelt es sich um Hinweise auf bekannte legale Gestaltungs­möglichkeiten — die Anwendbarkeit hängt von Einzelfall­umständen ab, ';
    html += '  die ein Steuerberater prüfen muss. Vor JEDER Strukturentscheidung (VV-GmbH-Einbringung, Holding-Aufbau, RND-Gutachten-Antrag, Sanierungs­gebiet/Denkmal-AfA, ';
    html += '  §6b-Rücklage, Reinvestitions­modelle) ist der Steuerberater­-Letzt-Check zwingend.</p>';
    html += '  <p><strong>Was nicht modelliert ist:</strong> §6a UmwStG, §3 UmwStG, Sperrfristen §6 Abs. 5 EStG, ';
    html += '  konkrete Tilgungsverläufe (Annuität), Sondertilgungen, Anschluss­finanzierung, Umsatzsteuer-Optionen (§9 UStG), gewerblicher Grundstückshandel (3-Objekt-Grenze §15 EStG), ';
    html += '  Schenkungs-/Erbschafts­steuer-Folgen (§13a/§13b ErbStG).</p>';
    html += '  <p style="font-size:11px;color:var(--muted);margin-top:10px"><em>Stand: V130 / 08.05.2026. Gesetzes­änderungen können Empfehlungen entkräften — bei Unsicherheit immer aktuelle Rechtslage prüfen.</em></p>';
    html += '</div>';

    root.innerHTML = html;
  }

  function _renderDetail(s) {
    var html = '';
    html += '<h3>Detail: ' + esc(s.label) + '</h3>';
    html += '<div class="ps-detail-grid">';

    html += '  <div class="ps-detail-block">';
    html += '    <h4>Struktur</h4>';
    html += '    <p>' + esc(s.struktur) + '</p>';
    html += '    <div class="ps-detail-stueck">';
    html += '      <span>Privat: <strong>' + s.stueck.privat + '</strong></span>';
    html += '      <span>VV-GmbH: <strong>' + s.stueck.gmbh + '</strong></span>';
    html += '      <span>Holding: <strong>' + s.stueck.holding + '</strong></span>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div class="ps-detail-block">';
    html += '    <h4>Wirtschaftliche Bewertung</h4>';
    html += '    <table class="ps-mini-table">';
    html += '      <tr><td>Einmalkosten gesamt</td><td class="r">' + fE(s.einmalkosten.summe) + '</td></tr>';
    html += '      <tr><td>&nbsp;&nbsp;davon GrESt</td><td class="r">' + fE(s.einmalkosten.grest) + '</td></tr>';
    html += '      <tr><td>&nbsp;&nbsp;davon Notar/Gründung</td><td class="r">' + fE(s.einmalkosten.notar) + '</td></tr>';
    html += '      <tr><td>Miete Jahr 1</td><td class="r">' + fE(s.jahr1.miete) + '</td></tr>';
    html += '      <tr><td>Steuerlicher Überschuss J1</td><td class="r ' + (s.jahr1.ueberschuss >= 0 ? '' : 'c-green') + '">' + fEs(s.jahr1.ueberschuss) + '</td></tr>';
    var stRowJ1 = s.jahr1.steuer >= 0
      ? '<span class="c-red">−' + fE(s.jahr1.steuer) + '</span> (Belastung)'
      : '<span class="c-green">+' + fE(Math.abs(s.jahr1.steuer)) + '</span> (Erstattung)';
    html += '      <tr><td>Steuer Jahr 1</td><td class="r">' + stRowJ1 + '</td></tr>';
    html += '      <tr><td>Effektive Belastung Jahr 1</td><td class="r">' + fP(s.jahr1.grenz * 100, 1) + '</td></tr>';
    html += '      <tr><td>CF nach Steuer Jahr 1</td><td class="r"><strong>' + fEs(s.jahr1.cf_n_st) + '</strong></td></tr>';
    html += '      <tr><td>NPV (' + s.horizon.jahre + ' Jahre)</td><td class="r"><strong>' + fEs(s.horizon.npv) + '</strong></td></tr>';
    html += '      <tr><td>Eigenkapital-Endwert</td><td class="r">' + fE(s.horizon.ek_endwert) + '</td></tr>';
    html += '    </table>';
    html += '  </div>';

    html += '  <div class="ps-detail-block">';
    html += '    <h4 class="c-green">Stärken</h4>';
    html += '    <ul class="ps-list">';
    s.pros.forEach(function(p) { html += '<li>' + esc(p) + '</li>'; });
    html += '    </ul>';
    html += '  </div>';

    html += '  <div class="ps-detail-block">';
    html += '    <h4 class="c-red">Schwächen / Risiken</h4>';
    html += '    <ul class="ps-list">';
    s.cons.forEach(function(p) { html += '<li>' + esc(p) + '</li>'; });
    html += '    </ul>';
    html += '  </div>';

    html += '</div>';
    if (s.note) {
      html += '<div class="ps-detail-note"><strong>Hinweis:</strong> ' + esc(s.note) + '</div>';
    }
    return html;
  }

  // ── Setup-Helfer ────────────────────────────────────────────────
  function _kpi(label, val, tone) {
    var cls = 'ps-kpi' + (tone ? ' ps-kpi-' + tone : '');
    return '<div class="' + cls + '"><div class="ps-kpi-l">' + esc(label) + '</div><div class="ps-kpi-v">' + esc(val) + '</div></div>';
  }
  function _inputRow(label, id, val, hint) {
    return '<div class="ps-inp-row">'
         + '<label>' + esc(label) + '</label>'
         + '<input type="text" id="' + id + '" value="' + esc(String(val).replace('.', ',')) + '">'
         + (hint ? '<div class="ps-inp-hint">' + esc(hint) + '</div>' : '')
         + '</div>';
  }
  function _selectRow(label, id, options, selected) {
    var opts = options.map(function(o) {
      return '<option value="' + esc(o.v) + '"' + (o.v === selected ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');
    return '<div class="ps-inp-row"><label>' + esc(label) + '</label><select id="' + id + '">' + opts + '</select></div>';
  }

  function _parseDe(s) {
    if (typeof s !== 'string') return parseFloat(s) || 0;
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  function _round2(v) { return Math.round(v * 100) / 100; }

  function _sanstandBadge(s) {
    if (!s) return '<span class="ps-muted">–</span>';
    var labels = { 1: 'saniert', 2: 'gepflegt', 3: 'mittel', 4: 'bedürftig', 5: 'unsaniert' };
    var cls = s <= 2 ? 'c-green' : (s === 3 ? 'c-warn' : 'c-red');
    return '<span class="' + cls + '">' + s + '/5 ' + (labels[s] || '') + '</span>';
  }

  function _ltvClass(ltv) {
    // V128: Profil-bezogene Schwellen — kein hartes 85% mehr
    var inp = window.PortfolioStrategy.getState().inputs;
    var p = window.PortfolioStrategy.PROFILES[inp.profile] || window.PortfolioStrategy.PROFILES.cashflow;
    if (ltv > p.ltv_max) return 'c-red';
    if (ltv > p.ltv_target) return 'c-warn';
    return 'c-green';
  }

  // ── PROFIL-SETTER (V126) ────────────────────────────────────────
  async function psSetProfile(key) {
    window.PortfolioStrategy.setInputs({ profile: key });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">Profil "' + esc(key) + '" anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // ── V135: Anlage-Ziel-Setter ────────────────────────────────────
  async function psSetZiel(key) {
    window.PortfolioStrategy.setInputs({ ziel: key });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">Anlage-Ziel "' + esc(key) + '" anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // ── V135: Kauf-Präferenz-Setter ─────────────────────────────────
  async function psSetTyp(key) {
    window.PortfolioStrategy.setInputs({ praeferenz_typ: key });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">Präferenz "' + esc(key) + '" anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // ── V137: Objekt-Auswahl-Setter ─────────────────────────────────
  async function psSetObjektAuswahl(idsCsv) {
    var arr = idsCsv ? idsCsv.split(',').filter(Boolean) : null;
    window.PortfolioStrategy.setInputs({ ausgewaehlte_objekte: arr });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">Objekt-Auswahl anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // V137: Toggle einzelnes Objekt in der Auswahl
  async function psToggleObjekt(id) {
    var s = window.PortfolioStrategy.getState();
    var current = (s.inputs && s.inputs.ausgewaehlte_objekte) || null;
    var allIds = (s.allRows || []).map(function(r) { return r.id; });
    if (!Array.isArray(current)) {
      // Aktuell "alle" — erstelle Liste mit allen außer dem getoggelten
      current = allIds.filter(function(x) { return x !== id; });
    } else {
      var idx = current.indexOf(id);
      if (idx >= 0) current = current.filter(function(x) { return x !== id; });
      else current = current.concat([id]);
    }
    // Wenn alle: zurück zu null
    if (current.length === allIds.length) current = null;
    window.PortfolioStrategy.setInputs({ ausgewaehlte_objekte: current });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // V137: Beleihungswert-Konfig-Setter
  async function psSetBeleihungParams() {
    var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    window.PortfolioStrategy.setInputs({
      beleihungswert_abschlag_pct: parseFloat(v('ps-bw-abschlag').replace(',', '.')) || 10,
      beleihungs_auslauf_pct: parseFloat(v('ps-bw-auslauf').replace(',', '.')) || 80
    });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">Beleihungs-Parameter anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // V137: GmbH-Verkauf-Prozent-Setter
  async function psSetGmbhVerkaufPct() {
    var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var pct = parseFloat(v('ps-gmbh-verkauf-pct').replace(',', '.')) || 7;
    if (pct < 4) pct = 4;
    if (pct > 15) pct = 15;
    window.PortfolioStrategy.setInputs({ gmbh_verkauf_pct: pct });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">GmbH-Verkauf-Konfiguration anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // V138: Eigenheimschaukel-Setter
  async function psSetEhsParams() {
    var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    window.PortfolioStrategy.setInputs({
      hat_familienheim: v('ps-ehs-hat') === 'true',
      familienheim_partner: v('ps-ehs-partner') === 'true',
      familienheim_wert: parseFloat(v('ps-ehs-wert').replace(',', '.')) || 0
    });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">Eigenheimschaukel-Parameter anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // V138: KP-Aufteilung-Setter
  async function psSetKpAufteilung() {
    var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var akt = parseFloat(v('ps-kpa-aktuell').replace(',', '.')) || 75;
    var opt = parseFloat(v('ps-kpa-optimiert').replace(',', '.')) || 85;
    window.PortfolioStrategy.setInputs({
      kp_aufteilung_geb_pct: akt,
      kp_aufteilung_geb_pct_optimiert: opt
    });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    root.innerHTML = '<div class="ps-loading">Kaufpreis-Aufteilung anwenden …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // V138: Stiftung-Erwägung-Setter
  async function psToggleStiftungErwaegung() {
    var s = window.PortfolioStrategy.getState();
    var current = s.inputs && s.inputs.stiftung_erwaegung;
    window.PortfolioStrategy.setInputs({ stiftung_erwaegung: !current });
    var root = document.getElementById('portfolio-strategy-main');
    if (!root) return;
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // ── INPUT-APPLY ─────────────────────────────────────────────────
  async function psApplyInputs() {
    var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var land = v('ps-land');
    var grestMap = {
      'NW': 6.5, 'BY': 3.5, 'BE': 6.0, 'BW': 5.0, 'HE': 6.0,
      'NI': 5.0, 'SH': 6.5, 'HH': 5.5, 'SN': 5.5
    };
    window.PortfolioStrategy.setInputs({
      // IST-ZUSTAND
      base_income_zve: _parseDe(v('ps-base-zve')),
      free_ek:         _parseDe(v('ps-free-ek')),
      notgroschen:     _parseDe(v('ps-notgroschen')),
      married:         v('ps-married') === 'true',
      church_tax:      v('ps-kist') === 'true',
      bundesland:      land,
      hat_struktur:    v('ps-hat-struktur') || 'keine',
      // ZIEL
      ek_invest_bereit:     _parseDe(v('ps-ek-bereit')),
      // V136: Klare Trennung Objekte vs. Wohneinheiten
      ziel_objekte_pa:      parseInt(v('ps-objekte-pa'), 10) || 0,
      we_pro_objekt:        parseInt(v('ps-we-pro-obj'), 10) || 1,
      // V135-Kompat: zielenheiten_pa = ziel_objekte_pa (eine Position pro Kauf)
      zielenheiten_pa:      parseInt(v('ps-objekte-pa'), 10) || 0,
      // V135: Anlage-Ziel + Kauf-Präferenz + Sparquote
      ziel_horizon_jahre:   parseInt(v('ps-ziel-horizon'), 10) || 15,
      kp_min_geplant:       _parseDe(v('ps-kp-min')) || 150000,
      kp_max_geplant:       _parseDe(v('ps-kp-max')) || 500000,
      sparquote_pct:        _parseDe(v('ps-sparquote')) || 15,
      marktzins_pct:        _parseDe(v('ps-marktzins')) || 3.9,
      // ANNAHMEN
      growth_rent_pa:  (_parseDe(v('ps-mietst')) || _parseDe(v('ps-growth-rent'))) / 100,
      growth_value_pa: _parseDe(v('ps-growth-value')) / 100
    });
    window.PortfolioStrategy.setConfig({
      gewst_hebesatz: _parseDe(v('ps-gewst-hebe')),
      grest_satz_pct: grestMap[land] != null ? grestMap[land] : window.PortfolioStrategy.DEFAULTS.grest_satz_pct,
      discount_rate:  _parseDe(v('ps-disc')) / 100
    });
    var root = document.getElementById('portfolio-strategy-main');
    root.innerHTML = '<div class="ps-loading">Neu berechnen …</div>';
    var res = await window.PortfolioStrategy.loadAndAnalyze();
    _renderFull(root, res);
  }

  // ── DETAIL-WECHSEL ──────────────────────────────────────────────
  function psShowDetail(key) {
    var st = window.PortfolioStrategy.getState();
    if (!st.results) return;
    var s = st.results.scenarios.filter(function(x) { return x.key === key; })[0];
    if (!s) return;
    var det = document.getElementById('ps-detail');
    if (det) {
      det.innerHTML = _renderDetail(s);
      det.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── EXPORT JSON ─────────────────────────────────────────────────
  function psExportJSON() {
    var st = window.PortfolioStrategy.getState();
    if (!st.results) return;
    var blob = new Blob([JSON.stringify(st.results, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'DealPilot_Portfolio_Strategie_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function psPrint() { window.print(); }

  // V132: PDF-Export-Handler (Strategie-PDF + Bank-PDF)
  function psExportStrategyPDF() {
    if (typeof window.exportPortfolioStrategyPDF !== 'function') {
      if (typeof toast === 'function') toast('PDF-Modul nicht geladen');
      return;
    }
    window.exportPortfolioStrategyPDF();
  }
  function psExportBankPDF() {
    if (typeof window.exportBankNegotiationPDF !== 'function') {
      if (typeof toast === 'function') toast('PDF-Modul nicht geladen');
      return;
    }
    window.exportBankNegotiationPDF();
  }

  // ── EXPORT WINDOW ───────────────────────────────────────────────
  // V144: Transparente Berechnungs-Aufschlüsselung für "Hebel über RND-Gutachten"
  // Zeigt für jedes relevante Objekt die exakten Zahlen + Anteil am Gesamthebel.
  function _renderRndHebelBreakdown(res, step) {
    // Finde alle Objekte aus dem Step, die ein gültiges RND-Gutachten haben
    var rows = (res.rows || []).filter(function(r) {
      return step.objekte.indexOf(r.kuerzel) >= 0
          && r.rndGutachten
          && r.rndGutachten.valid;
    });
    if (rows.length === 0) return '';

    // Gesamtsumme für %-Berechnung
    var totalImpact = rows.reduce(function(sum, r) {
      return sum + (r.rndGutachten.netto_vorteil || 0);
    }, 0);

    var html = '';
    html += '<div class="ps-rnd-breakdown" style="margin-top:12px;background:#FAF6E8;border-left:3px solid #C9A84C;border-radius:4px;padding:12px 14px;font-size:12px">';
    html += '  <div style="font-weight:700;color:#8c6e2c;letter-spacing:0.6px;text-transform:uppercase;font-size:10px;margin-bottom:8px">So setzt sich der Hebel zusammen</div>';
    html += '  <table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '    <thead><tr style="border-bottom:1px solid #E5DEB8;text-align:left">';
    html += '      <th style="padding:4px 6px">Objekt</th>';
    html += '      <th style="padding:4px 6px;text-align:right">Geb.-Anteil</th>';
    html += '      <th style="padding:4px 6px;text-align:right">AfA alt</th>';
    html += '      <th style="padding:4px 6px;text-align:right">AfA neu</th>';
    html += '      <th style="padding:4px 6px;text-align:right">+Steuer/J</th>';
    html += '      <th style="padding:4px 6px;text-align:right">Gutachter</th>';
    html += '      <th style="padding:4px 6px;text-align:right">Netto über RND</th>';
    html += '      <th style="padding:4px 6px;text-align:right">% Anteil</th>';
    html += '    </tr></thead><tbody>';

    rows.forEach(function(r) {
      var rg = r.rndGutachten;
      var anteil_pct = totalImpact > 0 ? (rg.netto_vorteil / totalImpact * 100) : 0;
      html += '<tr style="border-bottom:1px dashed #E5DEB8">';
      html += '  <td style="padding:5px 6px"><strong>' + esc(r.kuerzel) + '</strong></td>';
      html += '  <td style="padding:5px 6px;text-align:right">' + fE(r.geb_anteil_eur || 0) + '</td>';
      html += '  <td style="padding:5px 6px;text-align:right">' + rg.afa_standard.satz_pct.toFixed(2).replace('.', ',') + ' %</td>';
      html += '  <td style="padding:5px 6px;text-align:right"><strong>' + rg.afa_kurz.satz_pct.toFixed(2).replace('.', ',') + ' %</strong></td>';
      html += '  <td style="padding:5px 6px;text-align:right;color:#3FA56C">' + fE(rg.steuerersparnis_jahr) + '</td>';
      html += '  <td style="padding:5px 6px;text-align:right">−' + fE(rg.gutachterkosten) + '</td>';
      html += '  <td style="padding:5px 6px;text-align:right"><strong>' + fE(rg.netto_vorteil) + '</strong></td>';
      html += '  <td style="padding:5px 6px;text-align:right"><strong>' + anteil_pct.toFixed(0) + ' %</strong></td>';
      html += '</tr>';
    });

    // Summen-Zeile
    var sumSteuer = rows.reduce(function(s,r){ return s + (r.rndGutachten.steuerersparnis_jahr || 0); }, 0);
    var sumKosten = rows.reduce(function(s,r){ return s + (r.rndGutachten.gutachterkosten || 0); }, 0);
    html += '<tr style="border-top:2px solid #8c6e2c;font-weight:700">';
    html += '  <td style="padding:6px" colspan="4">Summe</td>';
    html += '  <td style="padding:6px;text-align:right;color:#3FA56C">' + fE(sumSteuer) + '/J</td>';
    html += '  <td style="padding:6px;text-align:right">−' + fE(sumKosten) + '</td>';
    html += '  <td style="padding:6px;text-align:right">' + fE(totalImpact) + '</td>';
    html += '  <td style="padding:6px;text-align:right">100 %</td>';
    html += '</tr>';
    html += '  </tbody></table>';
    html += '  <div style="margin-top:8px;font-size:11px;color:#7A7370;line-height:1.5">';
    html += '    <strong>Berechnung:</strong> "AfA neu" = 100 / Restnutzungsdauer in Jahren · "Mehr Steuer/J" = (AfA neu − AfA alt) × Gebäude-Anteil × Grenzsteuersatz · "Netto über RND" = Mehr-Steuer × RND-Jahre − Gutachter-Kosten · Beträge nach §7 Abs. 4 Satz 2 EStG, BFH IX R 25/19.';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  window.showPortfolioStrategyView = showPortfolioStrategyView;
  window.psApplyInputs              = psApplyInputs;
  window.psShowDetail               = psShowDetail;
  window.psExportJSON               = psExportJSON;
  window.psPrint                    = psPrint;
  window.psSetProfile               = psSetProfile;
  window.psSetZiel                  = psSetZiel;
  window.psSetTyp                   = psSetTyp;
  window.psSetObjektAuswahl         = psSetObjektAuswahl;
  window.psToggleObjekt             = psToggleObjekt;
  window.psSetBeleihungParams       = psSetBeleihungParams;
  window.psSetGmbhVerkaufPct        = psSetGmbhVerkaufPct;
  window.psSetEhsParams             = psSetEhsParams;
  window.psSetKpAufteilung          = psSetKpAufteilung;
  window.psToggleStiftungErwaegung  = psToggleStiftungErwaegung;
  window.psExportStrategyPDF        = psExportStrategyPDF;
  window.psExportBankPDF            = psExportBankPDF;

})();
