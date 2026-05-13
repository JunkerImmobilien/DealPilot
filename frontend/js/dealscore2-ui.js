'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V36 — DealScore 2.0 Bridge & Render
   Verbindet Calc-State mit DealScore2.compute() und rendert die Karte
   direkt unter dem bestehenden DealScore.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Baut aus den aktuellen Eingabe-Feldern und State.kpis ein deal-Objekt für DealScore2.
 * Tolerant: alle Felder optional.
 */
function _buildDeal2FromState() {
  var k = (window.State && State.kpis) ? State.kpis : {};
  var deal = {};

  // V41-Fix: korrekte Keys aus State.kpis (nmy nicht nmr, ekr für Cash-on-Cash)
  // Rendite
  deal.bruttorendite = k.bmy;             // %
  deal.nettorendite  = k.nmy;             // %  (war fälschlich .nmr)
  deal.cashflowMonatlich = (k.cf_m != null) ? k.cf_m : (k.cf_ns != null ? k.cf_ns / 12 : null);

  // Cash-on-Cash = EK-Rendite p.a. (= jährlicher CF / EK × 100)
  // V108 BUG-FIX: Bei 0 € Eigenkapital ist Cash-on-Cash mathematisch undefiniert (Division durch 0).
  // Vorher wurde es als 0 % bewertet → ergab 0/100 Punkte (falsch — Vollfinanzierung mit positivem
  // CF ist Hebel-Optimum, nicht 0).
  // Jetzt: bei EK ≤ 0 explizit auf ein "unendlich gut/schlecht"-Marker setzen, der vom
  // Engine-Interpolator korrekt verarbeitet wird.
  var jahresCfV108 = k.cf_ns != null ? k.cf_ns
                    : (deal.cashflowMonatlich != null ? deal.cashflowMonatlich * 12 : null);
  // Eigenkapital aus State berechnen (= GI - Darlehen)
  var ekV108 = null;
  if (window.State && State.gi) {
    var d1V108 = v('d1');
    var d2V108 = v('d2');
    var darlV108 = d1V108 + d2V108;
    ekV108 = State.gi - darlV108;   // kann auch negativ werden (Über-Finanzierung)
  }

  if (ekV108 != null && ekV108 <= 0) {
    // Vollfinanzierung (oder darüber hinaus): Hebel maximal
    if (jahresCfV108 != null && jahresCfV108 > 0) {
      // Positiver Cashflow ohne EK = Hebel-Optimum → maximaler Cash-on-Cash-Score
      deal.cashOnCash = 999;        // wird vom Interpolator auf den höchsten Punkt-Wert gemappt (100)
      deal._cocReason = 'vollfinanzierung_positiv';
    } else if (jahresCfV108 != null && jahresCfV108 < 0) {
      // Negativer Cashflow ohne EK = Verlust ohne Eigenkapital-Einsatz → niedriger Score
      deal.cashOnCash = -50;        // klarer negativer Wert → wird auf niedrige Punkte gemappt
      deal._cocReason = 'vollfinanzierung_negativ';
    } else {
      // CF ≈ 0: neutral
      deal.cashOnCash = 0;
      deal._cocReason = 'vollfinanzierung_neutral';
    }
  } else if (k.ekr != null && isFinite(k.ekr) && ekV108 > 0) {
    // Normalfall: aus State.kpis.ekr (= cf_ns / ek * 100)
    deal.cashOnCash = k.ekr;
  } else {
    // Fallback: aus CF und EK selbst rechnen
    if (jahresCfV108 != null && ekV108 != null && ekV108 > 0) {
      deal.cashOnCash = (jahresCfV108 / ekV108) * 100;
    }
  }
  // Eigenkapital für andere Berechnungen (Eigenkapitalquote in Finanzierung)
  // V108: bei EK ≤ 0 kann die Quote auch 0 oder negativ sein — das ist ok, Interpolator handhabt's
  var ek2 = (ekV108 != null) ? ekV108 : null;

  // Finanzierung
  deal.dscr     = k.dscr;
  deal.ltv      = k.ltv;       // bereits in %
  deal.zinsSatz = v('d1z');    // wir nehmen den Zins der Hauptfinanzierung
  deal.tilgung  = v('d1t');
  deal.eigenkapitalQuote = (ek2 != null && State.gi > 0) ? (ek2 / State.gi) * 100 : null;

  // Risiko
  // V36: Diese Felder existieren teilweise schon (leerstand, instandhaltung) und teilweise neu
  // V63.3: Korrekte Field-ID 'leerstand' (vorher 'leer' — das gab's nicht)
  deal.leerstandPct        = v('leerstand');
  // V63.3: Instandhaltung-KPI berechnen aus echten Bewirtschaftungs-Feldern.
  // Vorher las der Code 'bewk_h' das es nicht gibt → KPI wurde nie als ausgefüllt erkannt.
  // Echte Felder (Tab Bewirtschaftung):
  //   - weg_r        = WEG-Rücklage / Jahr (Hausgeld-Anteil für Rücklagen)
  //   - eigen_r      = Eigene Instandhaltungsrücklage / Jahr
  //   - hg_nul       = Hausgeld nicht-umlagefähig / Jahr (enthält i.d.R. Verwaltung + Rücklage)
  // Wir nehmen WEG-Rücklage + eigene Rücklage als jährliche Instandhaltungsbasis.
  // Wenn beides leer aber Hausgeld nicht-umlagefähig vorhanden: Schätzung 35% davon (typisch).
  var nkm     = v('nkm');
  var wegR    = v('weg_r');
  var eigenR  = v('eigen_r');
  var hgNul   = v('hg_nul');
  var instJahr = (wegR > 0 ? wegR : 0) + (eigenR > 0 ? eigenR : 0);
  if (instJahr === 0 && hgNul > 0) {
    // Fallback: ca. 35% des nicht-umlagefähigen Hausgelds sind typischerweise Rücklage
    instJahr = hgNul * 0.35;
  }
  if (nkm > 0 && instJahr > 0) {
    deal.instandhaltungPctNkm = (instJahr / (nkm * 12)) * 100;
  }
  deal.zustand              = g('ds2_zustand') || null;
  // V37: Sterne-Bewertung Q&Z dominiert das Zustand-Dropdown wenn Werte da sind.
  // Durchschnitt aus 4 Sternen (Küche/Bad/Boden/Fenster) → kategoriales Mapping.
  // V42: Zusätzlich als eigener KPI deal.qualitaetSterne (1-5) für die Risiko-Kategorie
  if (window.StarRating && typeof StarRating.getAverage === 'function') {
    var avgInfo = StarRating.getAverage();
    if (avgInfo && avgInfo.count > 0) {
      var a = avgInfo.avg;
      deal.qualitaetSterne = a;            // V42: 1-5 für DS2 KPI "Qualität & Zustand"
      deal.zustand =
        a >= 4.5 ? 'neubau' :
        a >= 3.5 ? 'gut' :
        a >= 2.5 ? 'normal' :
        a >= 1.5 ? 'renovierungsbeduerftig' :
                   'stark_sanierungsbeduerftig';
      deal._sternebewertung = avgInfo;
    }
  }
  deal.energieKlasse        = g('ds2_energie') || null;
  deal.mietausfallRisiko    = g('ds2_mietausfall') || null;

  // Lage
  var wfl = v('wfl');
  if (nkm > 0 && wfl > 0) deal.istMieteEurQm = nkm / wfl;
  deal.marktmieteEurQm      = v('ds2_marktmiete') || null;
  deal.mietwachstumPct      = v('mietstg');
  deal.bevoelkerung         = g('ds2_bevoelkerung') || null;
  deal.nachfrage            = g('ds2_nachfrage') || null;
  // V38: mikrolage liest das ALTE Feld (deutsche Strings) und mappt auf DS2-Enum
  // Werte alt: "Sehr schwach"/"Schwach"/"Durchschnittlich"/"Gut"/"Sehr gut"
  // Nach V38-Refactor sind die value-Attribute schon enums: sehr_schwach/schwach/durchschnittlich/gut/sehr_gut
  // Mapping auf DS2-Enums:
  var mlRaw = g('mikrolage');
  var mlMap = {
    'sehr_gut': 'sehr_gut',
    'gut': 'gut',
    'durchschnittlich': 'mittel',
    'schwach': 'einfach',
    'sehr_schwach': 'problematisch',
    // Falls ein alter Datensatz noch deutsche Labels hat (vor V38)
    'Sehr gut': 'sehr_gut', 'Gut': 'gut',
    'Durchschnittlich': 'mittel', 'Schwach': 'einfach', 'Sehr schwach': 'problematisch'
  };
  deal.mikrolage = mlMap[mlRaw] || null;

  // Upside
  // Eigener Faktor = Kaufpreis / Jahreskaltmiete
  var kp = v('kp');
  if (kp > 0 && nkm > 0) deal.eigenerFaktor = kp / (nkm * 12);
  deal.marktFaktor          = v('ds2_marktfaktor') || null;
  deal.wertsteigerung       = g('ds2_wertsteigerung') || null;
  deal.entwicklungsmoeglichkeiten = g('ds2_entwicklung') || null;

  return deal;
}

function renderDealScore2() {
  var box = document.getElementById('dealscore2-box');
  if (!box) return;
  if (!window.DealScore2) return;

  // V57: Wenn keine Basisdaten (KP + NKM) → "Keine Daten" zeigen statt Phantom-Score
  function _v(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
  }
  var _kp = _v('kp');
  var _nkm = _v('nkm');
  if (!_kp || !_nkm) {
    box.innerHTML =
      '<div style="text-align:center;color:rgba(255,255,255,0.55);padding:50px 20px">' +
        '<div style="font-size:36px;margin-bottom:12px;opacity:0.6">📊</div>' +
        '<div style="font-size:16px;font-weight:600;margin-bottom:6px">Noch keine Daten</div>' +
        '<div style="font-size:12.5px;line-height:1.5;max-width:400px;margin:0 auto">Trag im Quick-Check oder im Tab <strong>Investition</strong> einen Kaufpreis und im Tab <strong>Miete</strong> die Nettokaltmiete ein — dann erscheint hier dein Investor Deal Score.</div>' +
      '</div>';
    if (typeof window._updateDs2CollapseSummary === 'function') {
      window._updateDs2CollapseSummary(null, null);
    }
    return;
  }

  var deal, result;
  try {
    deal = _buildDeal2FromState();
    result = window.DealScore2.compute(deal);
  } catch (err) {
    // V43: Defensiv — wenn compute crasht (z.B. wegen ungültiger Energieklasse), Fallback statt Crash
    console.warn('[ds2] compute fehlgeschlagen:', err.message);
    box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px">' +
      '<div style="font-size:28px;margin-bottom:8px">⚠</div>' +
      '<div>Score konnte nicht berechnet werden.</div>' +
      '<div style="font-size:11px;margin-top:6px;opacity:0.65">' + (err.message || 'Unbekannter Fehler') + '</div>' +
      '</div>';
    if (typeof window._updateDs2CollapseSummary === 'function') {
      window._updateDs2CollapseSummary(null, null);
    }
    return;
  }

  // V63.1: Investor Deal Score (DS2) wird ERST ab 70% KPI-Vollständigkeit angezeigt.
  // Die KPI-Vollständigkeit (24 KPIs) zählt jetzt zentral via DealScore2.getKpiCompleteness.
  var MIN_COMPLETENESS = 0.70;     // V63.1: hochgesetzt 50% → 70% wie vom User gewünscht
  // (User-Settings-Slider bleibt bestehen für Backwards-Compat, aber Standard ist 0.70)
  try {
    var _userSettings = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    if (typeof _userSettings.completeness_threshold === 'number' &&
        _userSettings.completeness_threshold >= 0.5 && _userSettings.completeness_threshold <= 1) {
      MIN_COMPLETENESS = _userSettings.completeness_threshold;
    }
  } catch(e) {}

  // V63.1: KPI-Vollständigkeit über getKpiCompleteness (24 KPIs)
  var kpiCompPct = 0;
  if (typeof window.DealScore2.getKpiCompleteness === 'function') {
    try {
      var kpiCompResult = window.DealScore2.getKpiCompleteness(deal);
      kpiCompPct = kpiCompResult.percent / 100;
    } catch(e) {}
  }
  // Fallback auf altes Feld wenn neue API nicht verfügbar
  if (!kpiCompPct && result.dataCompleteness != null) {
    kpiCompPct = result.dataCompleteness;
  }

  if (kpiCompPct < MIN_COMPLETENESS) {
    var pct = Math.round(kpiCompPct * 100);
    var pctNeeded = Math.round(MIN_COMPLETENESS * 100);

    // V203: Free-Plan-Demo-Banner zusätzlich anzeigen (Marcels Wunsch:
    // "Free = voller Funktionsumfang als Demo, Beschränkung nur 1 Objekt + Watermark")
    var demoBanner = '';
    try {
      if (window.DealPilotConfig && DealPilotConfig.pricing) {
        var mode = DealPilotConfig.pricing.featureMode &&
                   DealPilotConfig.pricing.featureMode('deal_score_v2');
        if (mode === 'demo') {
          demoBanner =
            '<div style="margin-bottom:14px;padding:10px 14px;background:linear-gradient(90deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.35);border-radius:8px;color:#C9A84C;font-size:12.5px;line-height:1.5">' +
              '<strong>🎯 Demo-Modus (Free):</strong> Der vollständige Investor Deal Score ist im Free-Plan als Demo verfügbar. ' +
              'Upgrade auf <strong>Investor</strong> für unbegrenzte Nutzung ohne Wasserzeichen.' +
            '</div>';
        }
      }
    } catch(e) {}

    // V63.2: Einfacher Banner — KEINE inline-KPI-Liste mehr (war unlesbar weiß-auf-weiß).
    // Stattdessen Button "Welche KPIs fehlen?" der das bewährte Modal öffnet.
    box.innerHTML = demoBanner +
      '<div class="ds2-threshold-card">' +
        '<div class="ds2-threshold-icon">📋</div>' +
        '<div class="ds2-threshold-headline">Bitte mindestens ' + pctNeeded + ' % der Kennzahlen ausfüllen</div>' +
        '<div class="ds2-threshold-sub">' +
          'um einen belastbaren <strong>Investor Deal Score</strong> zu erhalten. ' +
          'Aktuell befüllt: <strong>' + pct + ' %</strong> der 24 KPIs.' +
        '</div>' +
        '<div class="ds2-threshold-bar">' +
          '<div class="ds2-threshold-bar-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="ds2-threshold-actions">' +
          '<button class="btn btn-outline btn-sm" type="button" onclick="showDs2KpiBreakdown()">' +
            '📋 Welche KPIs fehlen noch?' +
          '</button>' +
        '</div>' +
        '<div class="ds2-threshold-hint">' +
          'Trag in den Tabs <strong>Objekt</strong> (Lage, Energieklasse, Zustand), ' +
          '<strong>Bewirtschaftung</strong> und <strong>Steuer</strong> die fehlenden Werte ein.' +
        '</div>' +
      '</div>';
    if (typeof window._updateDs2CollapseSummary === 'function') {
      window._updateDs2CollapseSummary(null, 'Daten unvollständig (' + pct + '%)');
    }
    return;
  }

  // Donut-Farbe
  var ringColor = result.color === 'green-strong' ? '#10A65C' :
                  result.color === 'green' ? '#2FBE6E' :
                  result.color === 'gold'  ? '#E5BD53' :
                  '#D55B5B';

  var circ = 327;
  var dashOffset = circ - (result.score / 100) * circ;

  // V43: Summary-Zeile in Collapse-Header updaten
  if (typeof window._updateDs2CollapseSummary === 'function') {
    window._updateDs2CollapseSummary(Math.round(result.score), result.label);
  }

  // Kategorie-Icons (Lucide) — wir nutzen die bereits vorhandenen Icons
  var catIcons = {
    rendite:      window.Icons && Icons.trendingUp ? Icons.trendingUp({ size: 20 }) : '',
    finanzierung: window.Icons && Icons.bank       ? Icons.bank({ size: 20 })       : '',
    risiko:       window.Icons && Icons.shield     ? Icons.shield({ size: 20 })     : '',
    lage:         window.Icons && Icons.map        ? Icons.map({ size: 20 })        : '',
    upside:       window.Icons && Icons.trendingUp ? Icons.trendingUp({ size: 20 }) : ''
  };
  var catLabels = {
    rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Risiko',
    lage: 'Lage & Markt', upside: 'Upside / Potenzial'
  };

  var catBars = ['rendite', 'finanzierung', 'risiko', 'lage', 'upside'].map(function(k) {
    var c = result.categories[k];
    var sc = Math.round(c.score);
    var barColor = sc >= 85 ? '#10A65C' : sc >= 70 ? '#2FBE6E' : sc >= 50 ? '#E5BD53' : '#D55B5B';
    var availTxt = c.totalKpis > 0 ? c.availableKpis + '/' + c.totalKpis + ' KPIs' : '';
    var w = result.configUsed.weights[k] || 0;
    return '<div class="ds2-metric">' +
      '<div class="ds2-metric-icon" style="color:' + barColor + ';border-color:' + barColor + '40">' + catIcons[k] + '</div>' +
      '<div class="ds2-metric-body">' +
        '<div class="ds2-metric-head">' +
          '<span class="ds2-metric-label">' + catLabels[k] +
            ' <span class="ds2-metric-weight">(' + w + '%)</span></span>' +
          '<span class="ds2-metric-score">' + sc + ' / 100</span>' +
        '</div>' +
        '<div class="ds2-metric-bar"><div class="ds2-metric-bar-fill" style="width:' + sc + '%;background:' + barColor + '"></div></div>' +
        '<div class="ds2-metric-input">' + availTxt + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  var posHtml = result.positives.length > 0
    ? result.positives.map(function(p) { return '<li>' + _escDs2(p.name) + ' (' + Math.round(p.points) + '/100)</li>'; }).join('')
    : '<li class="ds2-empty-li">Noch keine ausgeprägten Stärken bewertbar.</li>';
  var negHtml = result.negatives.length > 0
    ? result.negatives.map(function(p) { return '<li>' + _escDs2(p.name) + ' (' + Math.round(p.points) + '/100)</li>'; }).join('')
    : '<li class="ds2-empty-li">Keine kritischen Schwächen.</li>';

  // V37: Banner wenn Sterne-Bewertung den Zustand-Score liefert
  var sternBannerHtml = '';
  if (deal._sternebewertung && deal._sternebewertung.count > 0) {
    var sb = deal._sternebewertung;
    sternBannerHtml =
      '<div class="ds2-stern-banner">' +
        '<span class="ds2-stern-icon">★</span>' +
        '<span><strong>Sterne-Bewertung Q&amp;Z aktiv:</strong> ' +
        sb.avg.toFixed(1).replace('.', ',') + ' / 5,0 aus ' + sb.count + ' Bereichen → wird im Risiko-Score (Baujahr/Zustand) verwendet.</span>' +
      '</div>';
  }

  box.innerHTML =
    '<div class="ds-mockup ds2-mockup">' +
      '<div class="ds-top">' +
        '<div class="ds-brand">' +
          '<div class="ds-brand-name">Investor <span class="ds-brand-accent">Deal Score</span></div>' +
        '</div>' +
        '<div class="ds-top-deal ds2-explanation">' +
          '<div class="ds-top-deal-icon">' + (window.Icons && Icons.brain ? Icons.brain({ size: 22 }) : '') + '</div>' +
          '<div class="ds-top-deal-text">' +
            '<div class="ds-top-deal-label" style="color:' + ringColor + '">' + result.label.toUpperCase() + '</div>' +
            '<div class="ds-top-deal-desc">' + _escDs2(result.explanation) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ds-middle">' +
        '<div class="ds-donut-wrap">' +
          '<svg class="ds-donut" viewBox="0 0 120 120">' +
            '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>' +
            '<circle cx="60" cy="60" r="52" fill="none" stroke="' + ringColor + '" stroke-width="8" ' +
              'stroke-dasharray="' + circ + '" stroke-dashoffset="' + dashOffset + '" stroke-linecap="round" ' +
              'transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)"/>' +
          '</svg>' +
          '<div class="ds-donut-text">' +
            '<div class="ds-donut-score">' + Math.round(result.score) + '</div>' +
            '<div class="ds-donut-max">/ 100</div>' +
          '</div>' +
          '<div class="ds-donut-pill" style="color:' + ringColor + ';border-color:' + ringColor + '">' +
            result.label +
          '</div>' +
        '</div>' +
        '<div class="ds-metrics ds2-metrics">' + catBars + '</div>' +
      '</div>' +

      '<div class="ds2-pn-grid">' +
        '<div class="ds2-pn-col ds2-pn-pos"><h5>Positive Faktoren</h5><ul>' + posHtml + '</ul></div>' +
        '<div class="ds2-pn-col ds2-pn-neg"><h5>Negative Faktoren</h5><ul>' + negHtml + '</ul></div>' +
      '</div>' +

      sternBannerHtml +

      // V40: Buttons-Reihe — KPI-Übersicht öffnet Modal mit verfügbaren/fehlenden KPIs.
      // Settings-Button NICHT mehr hier — wandert in Settings-Modal.
      '<div class="ds2-actions-row">' +
        '<button class="btn btn-outline btn-sm" type="button" onclick="showDs2KpiBreakdown()">' +
          '<span style="font-size:14px">📋</span> KPIs anzeigen — verfügbar &amp; fehlend' +
        '</button>' +
      '</div>' +
    '</div>';
}

function _escDs2(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.renderDealScore2 = renderDealScore2;

// V46: Wrap renderDealScore2 — bei jedem Aufruf auch Read-only-Block updaten
(function() {
  var orig = window.renderDealScore2;
  window.renderDealScore2 = function() {
    var r = orig.apply(this, arguments);
    if (typeof window.renderDs2Readonly === 'function') {
      try { window.renderDs2Readonly(); } catch(e) { console.warn('[V46] renderDs2Readonly:', e.message); }
    }
    return r;
  };
})();

/* ═══════════════════════════════════════════════════════════════
   DealScore 2.0 — Settings-Modal
═══════════════════════════════════════════════════════════════ */

function showDealScore2Settings() {
  var ov = document.getElementById('ds2-settings-overlay');
  if (!ov) {
    ov = _ds2BuildSettingsOverlay();
    document.body.appendChild(ov);
  }
  _ds2FillSettingsForm();
  ov.style.display = 'flex';
}

function closeDS2Settings() {
  var ov = document.getElementById('ds2-settings-overlay');
  if (ov) ov.style.display = 'none';
}

function _ds2BuildSettingsOverlay() {
  var ov = document.createElement('div');
  ov.id = 'ds2-settings-overlay';
  ov.className = 'ds2-settings-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(20,18,18,0.72);backdrop-filter:blur(6px);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px';
  ov.onclick = function(e) { if (e.target === ov) closeDS2Settings(); };
  ov.innerHTML =
    '<div class="ds2-settings-modal" role="dialog">' +
      '<div class="ds2-settings-header">' +
        '<div>' +
          '<h3>Investor Deal Score — Konfiguration</h3>' +
          '<div class="ds2-settings-sub">Hauptgewichtungen, Sub-Gewichtungen und Schwellen anpassen</div>' +
        '</div>' +
        '<button class="bmf-close" onclick="closeDS2Settings()" type="button" aria-label="Schließen">×</button>' +
      '</div>' +
      '<div class="ds2-settings-body" id="ds2-settings-body"></div>' +
      '<div class="ds2-settings-footer">' +
        '<button class="btn btn-ghost" onclick="ds2ResetConfig()">Auf Defaults zurücksetzen</button>' +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-ghost" onclick="closeDS2Settings()">Abbrechen</button>' +
        '<button class="btn btn-gold" onclick="ds2SaveConfig()">Speichern</button>' +
      '</div>' +
    '</div>';
  return ov;
}

function _ds2FillSettingsForm() {
  var cfg = window.DealScore2.loadConfig();
  // V63.21: Wenn Inline-Container im Settings-Modal existiert, diesen befüllen.
  // Sonst (Legacy-Path) den ursprünglichen ds2-settings-body im DS2-Modal befüllen.
  var body = document.getElementById('ds2-settings-body-inline') ||
             document.getElementById('ds2-settings-body');
  if (!body) return;

  var html = '';

  // V107: Preset-Auswahl ganz oben — drei vorgefertigte Profile + "Custom"
  var presets = window.DealScore2.getPresets();
  var activePreset = window.DealScore2.getActivePreset();
  html += '<div class="ds2-set-section ds2-preset-section">';
  html += '<h4>Bewertungsprofil</h4>';
  html += '<p class="ds2-set-hint" style="margin-bottom:12px">Wähle ein vorgefertigtes Profil oder passe die Gewichtungen unten manuell an. Beim manuellen Anpassen wechselt das Profil automatisch auf <strong>Benutzerdefiniert</strong>.</p>';
  html += '<div class="ds2-preset-grid">';
  presets.forEach(function(p) {
    var isActive = (activePreset === p.key);
    html += '<button type="button" class="ds2-preset-card' + (isActive ? ' ds2-preset-active' : '') + '" ' +
              'onclick="ds2SetPreset(\'' + p.key + '\')" data-preset="' + p.key + '">' +
              '<div class="ds2-preset-icon">' + p.icon + '</div>' +
              '<div class="ds2-preset-label">' + p.label + '</div>' +
              '<div class="ds2-preset-desc">' + p.description + '</div>' +
            '</button>';
  });
  // Custom-Karte (nur sichtbar wenn der User manuell editiert hat)
  if (activePreset === 'custom') {
    html += '<button type="button" class="ds2-preset-card ds2-preset-active" data-preset="custom">' +
              '<div class="ds2-preset-icon">✎</div>' +
              '<div class="ds2-preset-label">Benutzerdefiniert</div>' +
              '<div class="ds2-preset-desc">Manuell angepasste Werte. Klick auf eines der Profile oben, um es zu überschreiben.</div>' +
            '</button>';
  }
  html += '</div></div>';

  // Hauptgewichtungen
  html += '<div class="ds2-set-section"><h4>Hauptgewichtungen (Summe sollte 100 ergeben)</h4>';
  html += '<div class="ds2-set-grid">';
  ['rendite','finanzierung','risiko','lage','upside'].forEach(function(k) {
    html += _renderWeightField('weights.' + k, _ds2Label(k), cfg.weights[k]);
  });
  html += '</div></div>';

  // Sub-Gewichtungen pro Kategorie
  Object.keys(cfg.subWeights).forEach(function(catKey) {
    html += '<div class="ds2-set-section"><h4>Untergewichtungen — ' + _ds2Label(catKey) + '</h4>';
    html += '<div class="ds2-set-grid">';
    Object.keys(cfg.subWeights[catKey]).forEach(function(subKey) {
      html += _renderWeightField('subWeights.' + catKey + '.' + subKey, _ds2Label(subKey), cfg.subWeights[catKey][subKey]);
    });
    html += '</div></div>';
  });

  // Schwellenwerte (interpolation points only — buckets bleiben unangetastet weil komplexer)
  html += '<div class="ds2-set-section"><h4>Grenzwerte (Punkte je Wert)</h4>';
  html += '<p class="ds2-set-hint">Format: <code>Wert:Punkte</code> Paare durch Komma getrennt. Z.B. <code>4:20, 5:50, 7:80, 9:100</code></p>';
  var thresholdKeys = ['bruttorendite','nettorendite','cashflow','cashOnCash','dscr','zins',
                       'eigenkapitalbedarf','leerstand','instandhaltung','marktVsIst',
                       'mietwachstum','mietsteigerung','kaufpreisFaktor'];
  html += '<div class="ds2-set-grid ds2-set-grid-wide">';
  thresholdKeys.forEach(function(k) {
    var pts = cfg.thresholds[k] || [];
    var asString = pts.map(function(p) { return p[0] + ':' + p[1]; }).join(', ');
    html += '<div class="ds2-set-row ds2-set-row-wide">' +
      '<label>' + _ds2Label(k) + '</label>' +
      '<input type="text" data-cfg-key="thresholds.' + k + '" value="' + asString + '">' +
    '</div>';
  });
  html += '</div></div>';

  body.innerHTML = html;
}

function _renderWeightField(key, label, value) {
  return '<div class="ds2-set-row">' +
    '<label>' + label + '</label>' +
    '<input type="text" inputmode="decimal" data-cfg-key="' + key + '" value="' + (value != null ? value : '') + '" style="width:80px">' +
    '<span class="ds2-set-unit">%</span>' +
  '</div>';
}

function _ds2Label(k) {
  var L = {
    rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Risiko', lage: 'Lage & Markt',
    upside: 'Upside / Potenzial',
    bruttorendite: 'Bruttorendite', nettorendite: 'Nettorendite', cashflow: 'Cashflow',
    cashOnCash: 'Cash-on-Cash', dscr: 'DSCR', ltv: 'LTV', zins: 'Zinssatz', tilgung: 'Tilgung',
    eigenkapitalbedarf: 'EK-Bedarf', leerstand: 'Leerstand', instandhaltung: 'Instandhaltung',
    baujahr: 'Baujahr/Zustand', energie: 'Energie', mietausfall: 'Mietausfall',
    marktVsIst: 'Markt vs. Ist', mietwachstum: 'Mietwachstum', bevoelkerung: 'Bevölkerung',
    nachfrage: 'Nachfrage', mikrolage: 'Mikrolage', mietsteigerung: 'Mietsteigerung',
    kaufpreisFaktor: 'KP-Faktor', wertsteigerung: 'Wertsteigerung', entwicklungs: 'Entwicklung'
  };
  return L[k] || k;
}

function ds2SaveConfig() {
  var cfg = window.DealScore2.loadConfig();
  // V63.21: Inputs aus Inline-Container ODER Modal-Body
  var inputs = document.querySelectorAll('#ds2-settings-body-inline [data-cfg-key], #ds2-settings-body [data-cfg-key]');
  inputs.forEach(function(inp) {
    var key = inp.getAttribute('data-cfg-key');
    var val = inp.value.trim();
    var path = key.split('.');
    if (key.indexOf('thresholds.') === 0) {
      // Threshold-Strings → Array<[v,p]>
      var parts = val.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
      var arr = [];
      var ok = true;
      parts.forEach(function(p) {
        var pv = p.split(':');
        if (pv.length !== 2) { ok = false; return; }
        var v = parseDe(pv[0]), pts = parseDe(pv[1]);
        if (isNaN(v) || isNaN(pts)) { ok = false; return; }
        arr.push([v, pts]);
      });
      if (!ok || arr.length < 2) {
        if (typeof toast === 'function') toast('⚠ Ungültiges Schwellen-Format bei ' + key.split('.')[1]);
        return;
      }
      arr.sort(function(a, b) { return a[0] - b[0]; });
      _setNested(cfg, path, arr);
    } else {
      var n = parseDe(val);
      _setNested(cfg, path, n);
    }
  });
  window.DealScore2.saveConfig(cfg);
  if (typeof toast === 'function') toast('✓ DealScore 2.0 Konfiguration gespeichert');
  closeDS2Settings();
  if (typeof renderDealScore2 === 'function') renderDealScore2();
}

function ds2ResetConfig() {
  if (!confirm('DealScore 2.0 Einstellungen auf Defaults zurücksetzen?')) return;
  window.DealScore2.resetConfig();
  _ds2FillSettingsForm();
  if (typeof toast === 'function') toast('✓ Auf Defaults zurückgesetzt');
  if (typeof renderDealScore2 === 'function') renderDealScore2();
}

function _setNested(obj, path, val) {
  var cur = obj;
  for (var i = 0; i < path.length - 1; i++) {
    if (!cur[path[i]]) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = val;
}

window.showDealScore2Settings = showDealScore2Settings;
// V63.21: für Inline-Render im Settings-Modal
window._ds2FillSettingsForm = _ds2FillSettingsForm;
window.closeDS2Settings = closeDS2Settings;
window.ds2SaveConfig = ds2SaveConfig;
window.ds2ResetConfig = ds2ResetConfig;

// V107: Preset auswählen — speichert Preset-Wahl, lädt zugehörige Config in die Form,
//       triggert Re-Render der Settings + Score (wenn Tab Kennzahlen offen)
// V108: Score-Cache invalidieren + dpUpdateAll() für ALLE Renderer (DS1, DS2, Header, Sidebar)
window.ds2SetPreset = function(presetKey) {
  if (!window.DealScore2 || typeof window.DealScore2.setActivePreset !== 'function') return;
  var ok = window.DealScore2.setActivePreset(presetKey);
  if (!ok) return;

  // V108 BUG-FIX: DS2-Cache invalidieren — sonst zeigen Header und Sidebar weiter alte Werte
  window._dpLastDS2Result = null;

  // Form neu rendern (zeigt aktuelle Config-Werte aus dem Preset)
  if (typeof _ds2FillSettingsForm === 'function') {
    _ds2FillSettingsForm();
  }

  // V108: Zentral alles neu rechnen — dpUpdateAll() macht den Cache neu, ruft alle Renderer auf
  //       (Header, DS1, DS2, Read-only-Block, Sidebar). DealScore V1 ist seit V108 ebenfalls
  //       preset-aware → reagiert auch auf den neuen Wert in localStorage.
  if (typeof window.dpUpdateAll === 'function') {
    try { window.dpUpdateAll(); } catch(e) { console.warn('[V108] dpUpdateAll fail:', e); }
  } else {
    // Fallback wenn dpUpdateAll nicht da ist (Legacy)
    if (typeof window.renderDealScore2 === 'function') {
      try { window.renderDealScore2(); } catch(e) {}
    }
    if (typeof window.updHeaderBadges === 'function') {
      try { window.updHeaderBadges(); } catch(e) {}
    }
    if (typeof window.renderDealScore === 'function') {
      try { window.renderDealScore(); } catch(e) {}
    }
  }

  // V108: Sidebar-Karten neu rendern damit der Tier-Color-Schimmer auf die aktive Karte reagiert
  if (typeof renderSaved === 'function') {
    try { renderSaved({_immediate: true, forceFresh: true}); } catch(e) {}
  }

  if (typeof toast === 'function') {
    var presets = window.DealScore2.getPresets();
    var p = presets.find(function(x) { return x.key === presetKey; });
    toast('✓ Profil ' + (p ? p.label : presetKey) + ' aktiviert');
  }
};

// V40: Export für Header-Badges
window._buildDeal2FromState = _buildDeal2FromState;

/* ═══════════════════════════════════════════════════════════════
   V40: KPI-Breakdown Modal
   Zeigt welche KPIs in den Score eingeflossen sind (mit Wert) und welche fehlen.
═══════════════════════════════════════════════════════════════ */
function showDs2KpiBreakdown() {
  if (!window.DealScore2 || typeof window._buildDeal2FromState !== 'function') return;

  var deal, result;
  try {
    deal = window._buildDeal2FromState();
    result = window.DealScore2.compute(deal);
  } catch(e) {
    if (typeof toast === 'function') toast('⚠ Fehler bei der Berechnung: ' + e.message);
    return;
  }

  var cats = result.categories || {};
  // V108: SVG-Icons aus dem Sprite statt Emoji (die "hässlichen KI-Icons")
  // Gleiche Symbole wie in der Score-Pill-Card: i-trend, i-coins, i-shield, i-pin, i-rocket
  var catNames = {
    rendite:      { label: 'Rendite',          icon: '<svg width="18" height="18"><use href="#i-trend"/></svg>' },
    finanzierung: { label: 'Finanzierung',     icon: '<svg width="18" height="18"><use href="#i-coins"/></svg>' },
    risiko:       { label: 'Risiko',           icon: '<svg width="18" height="18"><use href="#i-shield"/></svg>' },
    lage:         { label: 'Lage & Markt',     icon: '<svg width="18" height="18"><use href="#i-pin"/></svg>' },
    upside:       { label: 'Upside-Potenzial', icon: '<svg width="18" height="18"><use href="#i-rocket"/></svg>' }
  };

  var totalAvailable = 0, totalKpis = 0;
  var sectionsHtml = '';

  Object.keys(catNames).forEach(function(catKey) {
    var cat = cats[catKey];
    if (!cat) return;
    var catInfo = catNames[catKey];
    var available = 0, missing = 0;
    var rowsAvail = '', rowsMiss = '';

    // V51: KPI-Key → Tab-Index Mapping (für Klick-zu-springen)
    var kpiTab = {
      // Rendite-Kategorie
      bruttorendite: 3, nettorendite: 3, cashflow: 6, cashOnCash: 5,
      // Finanzierung
      dscr: 5, ltv: 5, zins: 5, tilgung: 5, eigenkapitalbedarf: 5,
      // Risiko
      leerstand: 3, instandhaltung: 6, baujahr: 1, energie: 1,
      mietausfall: 3, qualitaet: 1,
      // Lage
      marktVsIst: 3, mietwachstum: 3, bevoelkerung: 1, nachfrage: 1,
      mikrolage: 1, makrolage: 1,
      // Upside
      mietsteigerung: 3, kaufpreisFaktor: 2, wertsteigerung: 1, entwicklungs: 1
    };

    (cat.breakdown || []).forEach(function(b) {
      var label = _escDs2(b.name || b.key);
      var weight = Math.round((b.weight || 0) * 100);
      var jumpIdx = kpiTab[b.key];
      var jumpAttr = jumpIdx != null
        ? ' onclick="_dpKpiJump(' + jumpIdx + ')" title="Zum Tab \'' + ['Quick','Objekt','Investition','Miete','Steuer','Finanzierung','BWK','KI','Kennzahlen'][jumpIdx] + '\' springen"'
        : '';
      var jumpBtn = jumpIdx != null
        ? '<button type="button" class="ds2-kpi-jump-btn" onclick="event.stopPropagation();_dpKpiJump(' + jumpIdx + ')" title="Zum Tab springen">→</button>'
        : '';
      if (b.applied) {
        available++;
        var pts = Math.round(b.points || 0);
        var ptsCls = pts >= 75 ? 'ds2-kpi-green' : pts >= 50 ? 'ds2-kpi-gold' : 'ds2-kpi-red';
        var valStr = b.value != null ? _formatKpiValue(b.value) : '—';
        rowsAvail += '<div class="ds2-kpi-row ds2-kpi-row-applied"' + jumpAttr + '>' +
          '<div class="ds2-kpi-label">' + label + '</div>' +
          '<div class="ds2-kpi-value">' + _escDs2(valStr) + '</div>' +
          '<div class="ds2-kpi-points ' + ptsCls + '">' + pts + '/100</div>' +
          '<div class="ds2-kpi-weight">' + weight + '% ' + jumpBtn + '</div>' +
        '</div>';
      } else {
        missing++;
        rowsMiss += '<div class="ds2-kpi-row ds2-kpi-row-missing"' + jumpAttr + '>' +
          '<div class="ds2-kpi-label">' + label + '</div>' +
          '<div class="ds2-kpi-value ds2-kpi-empty">— nicht vorhanden</div>' +
          '<div class="ds2-kpi-points">—</div>' +
          '<div class="ds2-kpi-weight">' + weight + '% ' + jumpBtn + '</div>' +
        '</div>';
      }
    });

    totalAvailable += available;
    totalKpis += (cat.breakdown || []).length;

    var catScore = Math.round(cat.score || 0);
    var catScoreCls = catScore >= 75 ? 'ds2-kpi-green' : catScore >= 50 ? 'ds2-kpi-gold' : 'ds2-kpi-red';

    sectionsHtml +=
      '<div class="ds2-kpi-section">' +
        '<div class="ds2-kpi-section-head">' +
          '<span class="ds2-kpi-section-icon">' + catInfo.icon + '</span>' +
          '<span class="ds2-kpi-section-name">' + _escDs2(catInfo.label) + '</span>' +
          '<span class="ds2-kpi-section-stats">' + available + ' / ' + (cat.breakdown || []).length + ' KPIs</span>' +
          '<span class="ds2-kpi-section-score ' + catScoreCls + '">' + catScore + '/100</span>' +
        '</div>' +
        (rowsAvail ? '<div class="ds2-kpi-group ds2-kpi-group-avail"><div class="ds2-kpi-group-l">✓ Eingeflossen</div>' + rowsAvail + '</div>' : '') +
        (rowsMiss  ? '<div class="ds2-kpi-group ds2-kpi-group-miss"><div class="ds2-kpi-group-l">○ Fehlt</div>' + rowsMiss + '</div>' : '') +
      '</div>';
  });

  var coverPct = totalKpis > 0 ? Math.round(totalAvailable / totalKpis * 100) : 0;

  var existing = document.getElementById('ds2-kpi-modal');
  if (existing) existing.remove();

  var ov = document.createElement('div');
  ov.id = 'ds2-kpi-modal';
  ov.className = 'ds2-kpi-overlay';
  ov.innerHTML =
    '<div class="ds2-kpi-modal" role="dialog" aria-labelledby="ds2-kpi-title">' +
      '<div class="ds2-kpi-header">' +
        '<div>' +
          '<h3 id="ds2-kpi-title"><svg width="20" height="20" style="vertical-align:-3px;margin-right:6px;color:var(--gold)"><use href="#i-file"/></svg>KPI-Übersicht — DealScore 2.0</h3>' +
          '<div class="ds2-kpi-summary">' +
            'Datenbasis: <strong>' + totalAvailable + ' / ' + totalKpis + '</strong> KPIs vorhanden (' + coverPct + '%) · ' +
            'Score: <strong>' + Math.round(result.score) + '/100</strong>' +
          '</div>' +
        '</div>' +
        '<button class="bmf-close" onclick="document.getElementById(\'ds2-kpi-modal\').remove()" type="button">×</button>' +
      '</div>' +
      '<div class="ds2-kpi-body">' +
        '<p class="hint" style="margin-bottom:14px">Hier siehst du pro Kategorie welche KPIs in den Score einfließen (Wert + Punktzahl) und welche noch fehlen. Fehlende KPIs senken die Aussagekraft des Scores — nicht den Score selbst.</p>' +
        sectionsHtml +
      '</div>' +
      '<div class="ds2-kpi-footer">' +
        '<button class="btn btn-ghost" onclick="document.getElementById(\'ds2-kpi-modal\').remove()" type="button">Schließen</button>' +
      '</div>' +
    '</div>';

  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

/**
 * V40: Wert eines KPIs für die Anzeige formatieren.
 */
function _formatKpiValue(v) {
  if (typeof v === 'number') {
    // Heuristik: kleine Zahlen mit Komma, große ohne
    if (Math.abs(v) < 100) return v.toFixed(2).replace('.', ',');
    return Math.round(v).toLocaleString('de-DE');
  }
  return String(v);
}

window.showDs2KpiBreakdown = showDs2KpiBreakdown;

/* ═══════════════════════════════════════════════════════════════
   V43: DealScore 2.0 Card kollabierbar (Standard: minimiert)
═══════════════════════════════════════════════════════════════ */
function toggleDs2Collapse() {
  var card = document.getElementById('dealscore2-card');
  if (!card) return;
  var collapsed = card.classList.toggle('ds2-card-collapsed');
  var btn = card.querySelector('.ds2-collapse-toggle');
  if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  try { localStorage.setItem('dp_ds2_collapsed', collapsed ? '1' : '0'); } catch(e) {}
}

/**
 * V43: Beim Render auch die Summary-Zeile updaten wenn Card collapsed ist.
 * Wird aufgerufen vom existierenden renderDealScore2 (siehe Patch unten).
 */
function _updateDs2CollapseSummary(score, tag) {
  var el = document.getElementById('ds2-collapse-summary');
  if (!el) return;
  if (score == null) {
    el.textContent = 'Klicken zum Anzeigen';
    el.className = 'ds2-collapse-summary';
    return;
  }
  var cls = score >= 80 ? 'ds2-coll-green-strong' :
            score >= 65 ? 'ds2-coll-green' :
            score >= 50 ? 'ds2-coll-gold' : 'ds2-coll-red';
  el.className = 'ds2-collapse-summary ' + cls;
  el.innerHTML = '<strong>' + score + '/100</strong> · ' + (tag || '');
}

window.toggleDs2Collapse = toggleDs2Collapse;
window._updateDs2CollapseSummary = _updateDs2CollapseSummary;

// Beim Laden Collapse-State aus localStorage wiederherstellen
(function() {
  function init() {
    var card = document.getElementById('dealscore2-card');
    if (!card) return;

    // V46: DS2 ist jetzt IMMER offen (kein Toggle mehr im HTML).
    // Stelle sicher dass die Collapsed-Klasse abgewählt wird falls jemand eine alte Version hat.
    card.classList.remove('ds2-card-collapsed');
    var btn = card.querySelector('.ds2-collapse-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }
})();

/* V51: KPI-Modal → Tab-Sprung */
function _dpKpiJump(tabIdx) {
  var modal = document.getElementById('ds2-kpi-modal');
  if (modal) modal.remove();
  if (typeof switchTab === 'function') switchTab(tabIdx);
}
window._dpKpiJump = _dpKpiJump;
