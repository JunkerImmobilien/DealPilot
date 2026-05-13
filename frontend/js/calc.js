'use strict';
/**
 * V36: Deutsche Zahlen-Eingabe robust parsen.
 * Akzeptiert: "3,5" / "3.5" / "1.250,50" / "1,250.50" / "1.250" / "1250" / leer.
 * Heuristik: das LETZTE Trennzeichen ist der Dezimaltrenner (DE-Konvention "1.250,50"
 * und US-Konvention "1,250.50" werden beide korrekt erkannt). Reine Tausender-Strings
 * mit ungerader Stellung werden als ganze Zahl interpretiert.
 */
function parseDe(s) {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return isFinite(s) ? s : 0;
  s = String(s).trim();
  if (!s) return 0;
  // Währungssymbole, Whitespace, NBSP entfernen
  s = s.replace(/[€$\s\u00A0%]/g, '');
  // Vorzeichen behandeln
  var neg = false;
  if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
  else if (s.charAt(0) === '+') { s = s.slice(1); }
  if (!s) return 0;
  var lastComma = s.lastIndexOf(',');
  var lastDot   = s.lastIndexOf('.');
  var n;
  if (lastComma === -1 && lastDot === -1) {
    n = parseFloat(s);
  } else if (lastComma > lastDot) {
    // DE: Komma ist Dezimaltrenner, alle Punkte sind Tausender
    n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  } else if (lastDot > lastComma) {
    // Punkt steht nach Komma → US-Stil mit Komma als Tausender, Punkt als Dezimal
    if (lastComma >= 0) {
      n = parseFloat(s.replace(/,/g, ''));
    } else {
      // Nur Punkt(e), keine Kommas. DE-Heuristik:
      // - genau 1 Punkt mit exakt 3 Folgeziffern → Tausender (1.250 → 1250)
      // - mehrere Punkte → Tausender (1.250.000 → 1250000)
      // - sonst Dezimal (3.5 → 3.5)
      var dotCount = (s.match(/\./g) || []).length;
      var afterDot = s.length - lastDot - 1;
      if (dotCount > 1 || (dotCount === 1 && afterDot === 3)) {
        n = parseFloat(s.replace(/\./g, ''));
      } else {
        n = parseFloat(s);
      }
    }
  } else {
    n = parseFloat(s);
  }
  if (!isFinite(n) || isNaN(n)) return 0;
  return neg ? -n : n;
}

function fE(n,d,sgn){d=d||0;sgn=sgn||false;if(n===null||n===undefined||isNaN(n)||!isFinite(n))return'—';var a=Math.abs(n);var s=a.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d})+' €';if(sgn)return(n>=0?'+':'–')+s;return s;}
function fP(n,d){d=(d===undefined)?2:d;if(isNaN(n)||!isFinite(n))return'—';return n.toFixed(d).replace('.',',')+' %';}
function fX(n,d){d=(d===undefined)?1:d;if(isNaN(n)||!isFinite(n))return'—';return n.toFixed(d).replace('.',',')+' x';}
function fN(n,d){d=(d===undefined)?1:d;if(isNaN(n))return'—';return n.toFixed(d).replace('.',',');}
function el(id){return document.getElementById(id);}
// V36: v() nutzt parseDe — akzeptiert deutsche und amerikanische Zahlenformate.
function v(id){var e=el(id);if(!e)return 0;return parseDe(e.value);}
function g(id){var e=el(id);if(!e)return'';return e.value||'';}
function sv(id,val){var e=el(id);if(e)e.value=val;}
function st(id,txt){var e=el(id);if(e)e.textContent=txt;}
var State={cfRows:[],kpis:{},gi:0,bwk:0,rs:0,bindj:10,d1_rate_monthly:0,d1z:0,az:0,at:0};
function updHeader(){
  var parts=[g('str'),g('hnr')].filter(Boolean);
  var ort = g('ort');
  var addr = parts.join(' ');
  var hdr = document.getElementById('hdr-obj');
  if (!hdr) return;
  // V62: Objektnummer in separates #hdr-obj-num Element schreiben (nicht doppelt im hdr-obj)
  var seq = window._currentObjSeq || '';
  var numEl = document.getElementById('hdr-obj-num');
  var sepEl = document.querySelector('.hdr-sep');
  if (numEl) {
    if (seq) {
      numEl.style.display = 'inline-flex';
      numEl.textContent = seq + (window._objSeqIsPreview ? ' ✎' : '');
      numEl.style.cursor = 'pointer';
      numEl.onclick = function() { if (typeof editObjId === 'function') editObjId(); };
      numEl.title = 'ID bearbeiten';
      if (sepEl) sepEl.style.display = '';
    } else {
      numEl.style.display = 'none';
      if (sepEl) sepEl.style.display = 'none';
    }
  }
  // hdr-obj zeigt nur die Adresse oder "Neues Objekt" — keine eigene Nummer-Pill mehr
  var addrFull = [addr, ort].filter(Boolean).join(', ');
  if (!addrFull) {
    hdr.textContent = 'Neues Objekt';
  } else {
    hdr.textContent = addrFull;
  }
}

// V40: Header zeigt jetzt den DealScore 2.0 + die 5 Kategorie-Bars
// V48: nutzt _dpLastDS2Result wenn da, sonst self-compute (Backwards-compat)
// V61: Komplett neues Layout mit Score-Donut (links) + 5 KPI-Pills mit Trend-Indikatoren
function updHeaderBadges() {
  var box = document.getElementById('hdr-badges');
  if (!box) return;

  // V62.3: body-Klasse für Sticky-Top-Anpassung (Tabs müssen sich anpassen)
  function _setHdrEmpty(empty) {
    if (empty) document.body.classList.add('hdr-no-score');
    else document.body.classList.remove('hdr-no-score');
    // V64.0: Pure-Obsidian Score-Header — Klasse aufs Header-Element setzen.
    // V64.9: Marcel will dass der Header IMMER im Pure-Obsidian-Look ist, auch
    // bei "Neues Objekt" (= empty). Daher: Klasse einmal setzen, nicht mehr entfernen.
    var _hdrEl = document.querySelector('header.hdr');
    if (_hdrEl) {
      _hdrEl.classList.add('has-v64-score');
    }
  }
  // V64.9: Beim Initial-Load die Klasse direkt setzen (wenn die App geladen wird ohne Score).
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      var _h = document.querySelector('header.hdr');
      if (_h) _h.classList.add('has-v64-score');
    }, 50);
  });

  // V63.97: Plan-Audit-Korrektur — DS2-Header zeigt im Free-Plan wieder Demo-Werte.
  // Free-Plan hat deal_score_v2: 'demo' (Absicht!) → soll DS2 als Demo sehen.
  // V63.96 hatte hasFullFeature verwendet, was Free komplett ausschloss — falsch.
  // Jetzt wieder hasFeature(), zusätzlich aber: Demo-Badge im Header.
  var canShowDs2 = false;
  var ds2Mode = 'none';
  if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.hasFeature === 'function') {
    canShowDs2 = DealPilotConfig.pricing.hasFeature('deal_score_v2');
    if (typeof DealPilotConfig.pricing.featureMode === 'function') {
      ds2Mode = DealPilotConfig.pricing.featureMode('deal_score_v2') || 'none';
    }
  }
  if (!canShowDs2) {
    box.innerHTML = '';
    _setHdrEmpty(true);
    document.body.classList.remove('hdr-banner-only');
    var gEl0a = document.getElementById('hdr-completeness');
    if (gEl0a) gEl0a.style.display = 'none';
    return;
  }

  function _hbV(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
  }
  if (!_hbV('kp') || !_hbV('nkm')) {
    box.innerHTML = '';
    _setHdrEmpty(true);
    // Globale Vollständigkeits-Anzeige zurücksetzen
    var gEl0 = document.getElementById('hdr-completeness');
    if (gEl0) gEl0.style.display = 'none';
    return;
  }

  var result = window._dpLastDS2Result;
  var deal = null;
  if (typeof window._buildDeal2FromState === 'function') {
    try { deal = window._buildDeal2FromState(); } catch(e) {}
  }
  if (!result) {
    if (!window.DealScore2 || !deal) {
      box.innerHTML = '';
      return;
    }
    try { result = window.DealScore2.compute(deal); } catch(e) { box.innerHTML = ''; return; }
  }

  // V63: KPI-Vollständigkeit pro Kategorie + global
  var kpiComp = null;
  if (window.DealScore2 && typeof window.DealScore2.getKpiCompleteness === 'function' && deal) {
    try { kpiComp = window.DealScore2.getKpiCompleteness(deal); } catch(e) {}
  }
  if (!kpiComp) {
    kpiComp = { byCategory: {}, total: 24, filled: 0, percent: 0 };
  }

  // Globale Anzeige in Reihe 1: "X / Y Felder ausgefüllt · Z %"
  var globalEl = document.getElementById('hdr-completeness');
  if (globalEl) {
    var pctClass = kpiComp.percent >= 70 ? 'good' : kpiComp.percent >= 40 ? 'warn' : 'low';
    globalEl.className = 'hdr-completeness ' + pctClass;
    globalEl.style.display = 'inline-flex';
    globalEl.innerHTML =
      '<span class="hdr-comp-text">' + kpiComp.filled + ' / ' + kpiComp.total + ' Felder · ' + kpiComp.percent + ' %</span>' +
      '<span class="hdr-comp-bar"><span class="hdr-comp-fill" style="width:' + kpiComp.percent + '%"></span></span>';
  }

  // V63: Score erst ab 70% Vollständigkeit zeigen (gilt für Header)
  var MIN_COMP_FOR_SCORE = 0.70;
  if (kpiComp.percent / 100 < MIN_COMP_FOR_SCORE) {
    var pct70 = Math.round(MIN_COMP_FOR_SCORE * 100);
    // V64.0: Banner mit SVG-Icon (kein Emoji mehr)
    box.innerHTML =
      '<div class="hdr-incomplete-banner" title="DealScore wird ab 70% Datenvollständigkeit angezeigt">' +
        '<span class="hdr-incomplete-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>' +
        '<span class="hdr-incomplete-text">' +
          '<strong>Bitte mindestens ' + pct70 + ' % der Kennzahlen ausfüllen</strong>, ' +
          'um einen belastbaren Deal Score zu erhalten. ' +
          'Aktuell: <strong>' + kpiComp.filled + ' / ' + kpiComp.total + ' Felder · ' + kpiComp.percent + ' %</strong>' +
        '</span>' +
      '</div>';
    document.body.classList.add('hdr-banner-only');
    document.body.classList.remove('hdr-no-score');
    // V64.0: Header auch im Banner-Modus dunkel
    var _hdrElB = document.querySelector('header.hdr');
    if (_hdrElB) _hdrElB.classList.add('has-v64-score');
    if (typeof _updateHdrHeight === 'function') _updateHdrHeight();
    return;
  }
  document.body.classList.remove('hdr-banner-only');

  var score = Math.round(result.score || 0);
  if (!score || isNaN(score)) {
    box.innerHTML = '';
    _setHdrEmpty(true);
    if (typeof _updateHdrHeight === "function") _updateHdrHeight();
    return;
  }

  // Tier-Klassifikation für Score-Karte
  var tier;
  if (score >= 70) tier = 'green';
  else if (score >= 50) tier = 'gold';
  else tier = 'red';

  var donutDash = (score / 100 * 176).toFixed(1);
  var donutColor = tier === 'green' ? '#5ED99E' : tier === 'gold' ? '#C9A84C' : '#f08080';

  var verdict, headline;
  if (score >= 85)      { headline = 'Solide Investition'; verdict = 'Sehr gut'; }
  else if (score >= 70) { headline = 'Gute Bewertung';     verdict = 'Gut'; }
  else if (score >= 50) { headline = 'Verhandeln';         verdict = 'Okay'; }
  else                  { headline = 'Schwacher Deal';     verdict = 'Schwach'; }

  var strengthsText = '';
  if (result.positives && result.positives.length > 0) {
    var topPos = result.positives.slice(0, 3).map(function(p) { return p.kategorie || p.name; });
    var nameMap = { rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Substanz', lage: 'Lage', upside: 'Upside' };
    var unique = [];
    topPos.forEach(function(k) {
      var n = nameMap[k] || k;
      if (unique.indexOf(n) < 0) unique.push(n);
    });
    strengthsText = unique.slice(0, 3).join(' · ');
  }
  if (!strengthsText) strengthsText = 'Substanz · Lage · Cashflow';

  var rec = score >= 70 ? 'Kauf erwägen' :
            score >= 50 ? 'Verhandlung empfohlen' :
            'Eher Pass';

  // V64.0: Pure-Obsidian-Score-Header
  // Investor-Badge nur bei vollem Plan-Feature; Demo-Badge bei Free-Plan (deal_score_v2: 'demo')
  var _headerHasDs2 = false;
  if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.hasFullFeature === 'function') {
    _headerHasDs2 = DealPilotConfig.pricing.hasFullFeature('deal_score_v2');
  }
  var _isDemoMode = (ds2Mode === 'demo');

  // V64.3: Pin-Brosche zurück — Marcel will im Investor-Modus den Stern+"INVESTOR"-Pin
  // oben auf der animierten Goldborder UND zusätzlich das "INVESTOR DEAL SCORE"-Label
  // im Info-Bereich (das hatten wir schon).
  var _scInvestorBadge = '';
  if (_headerHasDs2) {
    _scInvestorBadge = '<span class="sc-investor-badge"><span class="ic"><svg><use href="#i-star"/></svg></span>Investor</span>';
  } else if (_isDemoMode) {
    _scInvestorBadge = '<span class="sc-investor-badge sc-demo-badge" title="Demo-Anzeige · Voller Funktionsumfang ab Investor-Plan">Demo</span>';
  }

  var _scoreTitle = _headerHasDs2 ? 'Investor Deal Score (DS2)' :
                    _isDemoMode   ? 'DealPilot Score (Demo · Investor-Plan freischalten)' :
                                    'DealPilot Score';

  // V64.0: Donut-Färbung — grün-2 bei top, gold bei gut, rot bei schwach (Pure-Obsidian-Palette)
  var donutFillVar  = tier === 'green' ? '#5ed992' : tier === 'gold' ? '#E8C964' : '#B8625C';
  var donutGlow     = tier === 'green' ? 'rgba(94,217,146,0.45)' :
                      tier === 'gold'  ? 'rgba(232,201,100,0.45)' :
                                         'rgba(184,98,92,0.40)';
  var gradeBg       = tier === 'green' ? 'rgba(63,165,108,0.18)' :
                      tier === 'gold'  ? 'rgba(201,168,76,0.16)' :
                                         'rgba(184,98,92,0.16)';
  var gradeColor    = tier === 'green' ? '#5ed992' :
                      tier === 'gold'  ? '#E8C964' :
                                         '#e8a09a';
  var gradeBorder   = tier === 'green' ? 'rgba(63,165,108,0.40)' :
                      tier === 'gold'  ? 'rgba(201,168,76,0.40)' :
                                         'rgba(184,98,92,0.40)';

  // Donut als conic-gradient — kein SVG mehr, ist sauberer mit der CSS-Animation
  var donutStyle = 'background:conic-gradient(' + donutFillVar + ' 0% ' + score + '%,rgba(255,255,255,0.10) ' + score + '% 100%);' +
                   'box-shadow:0 0 22px ' + donutGlow;
  var gradeStyle = 'background:' + gradeBg + ';color:' + gradeColor + ';border:1px solid ' + gradeBorder;

  // V64.0: Score-Hauptkarte mit goldener animierter Border
  // V107: tier-Klasse auf sc-main damit CSS Hintergrund/Border in Tier-Farbe schimmern lassen kann
  var html =
    '<div class="scores tier-' + tier + '" title="' + _scoreTitle + '">' +
      '<div class="sc-main sc-tier-' + tier + (_isDemoMode ? ' sc-main-demo' : '') + '">' +
        _scInvestorBadge +
        '<div class="si">' +
          '<div class="sc-donut-wrap">' +
            '<div class="sc-donut" style="' + donutStyle + '"><span>' + score + '</span></div>' +
            '<span class="sc-grade" style="' + gradeStyle + '">' + verdict + '</span>' +
          '</div>' +
          '<div class="sc-info">' +
            (function() {
              var labelText = _headerHasDs2 ? 'Investor Deal Score' : _isDemoMode ? 'DealPilot Score · Demo' : 'DealPilot Score';
              var labelIcon = _headerHasDs2 ? '<span class="ic sc-l-star"><svg><use href="#i-star"/></svg></span>' : '';
              return '<div class="sc-l">' + labelIcon + '<span>' + labelText + '</span></div>';
            })() +
            '<div class="sc-v">' + headline + '</div>' +
            '<div class="sc-sub">' + strengthsText + '</div>' +
            '<div class="sc-tip"><span class="ic"><svg><use href="#i-spark"/></svg></span>KI rät: ' + rec + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

  // V64.0: 5 KPI-Pills (.sc-pill) mit Lucide-Icons aus Sprite
  var cats = result.categories || {};
  var kpiDefs = [
    { key: 'rendite',      label: 'Rendite',  icon: 'i-trend' },
    { key: 'finanzierung', label: 'Finanz.',  icon: 'i-coins' },
    { key: 'risiko',       label: 'Risiko',   icon: 'i-shield' },
    { key: 'lage',         label: 'Lage',     icon: 'i-pin' },
    { key: 'upside',       label: 'Upside',   icon: 'i-rocket' }
  ];

  kpiDefs.forEach(function(d) {
    var c = cats[d.key];
    var compInfo = (kpiComp.byCategory && kpiComp.byCategory[d.key]) || { total: 0, filled: 0 };
    if (!c) {
      html += '<div class="sc-pill sc-pill-empty">' +
                '<div class="sc-pill-l"><span>' + d.label.toUpperCase() + '</span><span class="ic"><svg><use href="#' + d.icon + '"/></svg></span></div>' +
                '<div class="sc-pill-v">—</div>' +
                '<div class="sc-pill-sub">' + compInfo.filled + ' / ' + compInfo.total + ' KPIs</div>' +
              '</div>';
      return;
    }
    var pct = Math.round(c.score || 0);
    var pillTier = pct >= 75 ? 'green' : pct >= 50 ? 'gold' : 'red';
    html +=
      '<div class="sc-pill tier-' + pillTier + '" title="' + d.label + ' (' + pct + '/100) — ' + compInfo.filled + ' von ' + compInfo.total + ' KPIs ausgefüllt">' +
        '<div class="sc-pill-l"><span>' + d.label.toUpperCase() + '</span><span class="ic"><svg><use href="#' + d.icon + '"/></svg></span></div>' +
        '<div class="sc-pill-v">' + pct + ' %</div>' +
        '<div class="sc-pill-sub">' + compInfo.filled + ' / ' + compInfo.total + ' KPIs</div>' +
        '<div class="sc-bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>';
  });

  html += '</div>';  // /.scores

  window._prevDS2Result = JSON.parse(JSON.stringify(result));

  box.innerHTML = html;
  _setHdrEmpty(false);
  // V63.4: Header-Höhe nachmessen damit Tabs richtig anschließen
  _updateHdrHeight();
  // V63.4: Toggle-Button-Sichtbarkeit aktualisieren
  if (typeof _updateHdrToggleVisibility === 'function') _updateHdrToggleVisibility();
}

/**
 * V63.4: Misst die echte Header-Höhe (kann variieren je nach Modus —
 * mit/ohne Score, mit/ohne Banner) und setzt CSS-Variable --hdr-h.
 * Damit kleben die Tabs IMMER bündig direkt unter dem Header — egal wie hoch er ist.
 */
function _updateHdrHeight() {
  var hdr = document.querySelector('.main-col > header.hdr') || document.querySelector('header.hdr');
  if (!hdr) return;
  var tabs = document.querySelector('.main-col > nav.tabs') || document.querySelector('nav.tabs') || document.querySelector('.tabs');
  // Mit kleinem Delay damit Browser den Layout-Reflow abgeschlossen hat
  setTimeout(function() {
    var h = hdr.offsetHeight;
    if (h > 0) {
      document.documentElement.style.setProperty('--hdr-h', h + 'px');
    }
    if (tabs) {
      var tabH = tabs.offsetHeight;
      if (tabH > 0) {
        document.documentElement.style.setProperty('--hdr-h-tabs', tabH + 'px');
      }
    }
  }, 50);
}
window._updateHdrHeight = _updateHdrHeight;

// V63.4: Bei Window-Resize Header-Höhe neu messen
window.addEventListener('resize', function() {
  if (typeof _updateHdrHeight === 'function') _updateHdrHeight();
});
// V63.4: Bei DOMContentLoaded einmal initial messen
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(_updateHdrHeight, 100);
  setTimeout(_updateHdrHeight, 500);   // nochmals nach Layout-Stabilisierung
});

function _escHtml(s){return ('' + (s == null ? '' : s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// V29: Debounce-Wrapper über calc() — verhindert dass beim Schnelltippen
// 30 calc-Läufe hintereinander stattfinden. Bei wirklich erstem Aufruf
// (z.B. nach dem Laden eines Objekts) sofort ausführen.

// ═══════════════════════════════════════════════════════════════════
// V63.54 — Bausparvertrag-Berechnungsmodul
// ═══════════════════════════════════════════════════════════════════
// Modelliert den vollen Lebenszyklus eines kombinierten Tilgungsaussetzungs-
// darlehens mit Bausparvertrag:
//   1. Sparphase: Hauptdarlehen läuft mit reinen Zinsen, BSV wird angespart
//   2. Zuteilung: Sobald Mindestguthaben (% der Bausparsumme) erreicht
//      → Sparguthaben + Bauspardarlehen lösen Hauptdarlehen ab
//   3. Bauspardarlehen-Phase: Festes Darlehen mit Bauspar-Konditionen
// ═══════════════════════════════════════════════════════════════════
function _computeBsvLifecycle() {
  var v = function(id) { var e = document.getElementById(id); if (!e) return 0;
    var s = String(e.value).replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isFinite(n) ? n : 0; };
  var g = function(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };

  var isAussetzung = (g('d1_type') === 'tilgungsaussetzung');
  if (!isAussetzung) return null;

  var d1 = v('d1');                    // Hauptdarlehen
  var bspar_sum = v('bspar_sum');      // Bausparsumme
  var bspar_rate_m = v('bspar_rate');  // Sparrate / Monat
  var bspar_zins = v('bspar_zins') / 100;        // Guthabenzins p.a.
  var bspar_quote = v('bspar_quote_min') / 100;  // Mindestquote (Default 40%)
  var dar_z = v('bspar_dar_z') / 100;            // Bauspardarlehen-Zins
  var dar_t = v('bspar_dar_t') / 100;            // Bauspardarlehen-Tilgung
  var bindj = v('d1_bindj') || 10;

  // Sanity-Defaults wenn User Felder nicht ausgefüllt hat
  if (bspar_quote === 0) bspar_quote = 0.40;
  if (dar_z === 0) dar_z = 0.025;
  if (dar_t === 0) dar_t = 0.06;

  // Auszahlungsdatum als Startpunkt (MM.YYYY) — falls nicht gesetzt, aktuelles Jahr
  var auszahl_str = g('d1_auszahl');
  var startMonth = (new Date()).getMonth() + 1, startYear = (new Date()).getFullYear();
  if (auszahl_str && /^\d{2}\.\d{4}$/.test(auszahl_str)) {
    var parts = auszahl_str.split('.');
    startMonth = parseInt(parts[0]);
    startYear = parseInt(parts[1]);
  }

  // Mindestguthaben für Zuteilung
  var ziel_guthaben = bspar_sum * bspar_quote;

  // Zuteilung-Berechnung: Wann erreichen wir das Mindestguthaben?
  // Future-Value-Formel: FV = PMT × [((1+r)^n − 1) / r], mit r = monatlich
  var rMon = bspar_zins / 12;
  var monateBisZuteilung = -1;  // -1 = nie erreicht
  var jahreBisZuteilung = -1;
  var guthaben_bei_zuteilung = 0;

  if (bspar_rate_m > 0 && bspar_sum > 0) {
    // Iterativ: Suche kleinstes n mit FV(n) >= ziel_guthaben
    // Cap auf 50 Jahre (= 600 Monate)
    var maxIter = 600;
    var fv = 0;
    for (var n = 1; n <= maxIter; n++) {
      // Aufzinsung: fv = fv * (1+r) + bspar_rate
      fv = fv * (1 + rMon) + bspar_rate_m;
      if (fv >= ziel_guthaben) {
        monateBisZuteilung = n;
        jahreBisZuteilung = Math.ceil(n / 12);  // Volle Jahre
        guthaben_bei_zuteilung = fv;
        break;
      }
    }
  }

  // Status der Zuteilung relativ zur Zinsbindung
  var zuteil_status;  // 'before_ezb' | 'at_ezb' | 'after_ezb' | 'never'
  if (monateBisZuteilung < 0) {
    zuteil_status = 'never';
  } else if (jahreBisZuteilung < bindj) {
    zuteil_status = 'before_ezb';
  } else if (jahreBisZuteilung === bindj) {
    zuteil_status = 'at_ezb';
  } else {
    zuteil_status = 'after_ezb';
  }

  // Empfohlene Sparrate für Zuteilung exakt zum Bindungsende
  // FV = PMT × [((1+r)^n − 1) / r] → PMT = FV × r / ((1+r)^n − 1)
  var n_ezb = bindj * 12;
  var empfohleneSparrate = 0;
  if (n_ezb > 0) {
    if (rMon > 0) {
      empfohleneSparrate = ziel_guthaben * rMon / (Math.pow(1 + rMon, n_ezb) - 1);
    } else {
      empfohleneSparrate = ziel_guthaben / n_ezb;
    }
  }

  // Bauspardarlehen = Bausparsumme − tatsächliches Sparguthaben bei Zuteilung
  var bauspardarlehen = (monateBisZuteilung > 0) ? Math.max(0, bspar_sum - guthaben_bei_zuteilung) : 0;

  // Ablösung Hauptdarlehen
  // Nach Zuteilung: Sparguthaben + Bauspardarlehen sind verfügbar
  // Hauptdarlehen-Restschuld = d1 (kein Tilg in Sparphase) → lösbar mit (Guthaben + Bauspardarlehen)
  // Wenn Summe < d1: Lücke bleibt → Anschlussfinanzierung nötig
  var ablose_summe = guthaben_bei_zuteilung + bauspardarlehen;  // = bspar_sum effektiv
  var hauptdarlehen_rest_nach_abloese = Math.max(0, d1 - ablose_summe);
  var luecke_anschluss = hauptdarlehen_rest_nach_abloese;

  // Rate Bauspardarlehen
  var dar_rate_m = (bauspardarlehen * (dar_z + dar_t)) / 12;

  // Volltilgung Bauspardarlehen (in Monaten ab Zuteilung)
  var dar_volltilg_monate = -1;
  if (bauspardarlehen > 0 && dar_z > 0 && dar_t > 0) {
    // Annuität: n = -ln(1 - r/q) / ln(1+r/12), mit r = dar_z/12, q = monatl. Rate / Darlehen
    var rDarMon = dar_z / 12;
    var qMon = dar_rate_m / bauspardarlehen;
    if (qMon > rDarMon) {
      dar_volltilg_monate = -Math.log(1 - rDarMon / qMon) / Math.log(1 + rDarMon);
      dar_volltilg_monate = Math.ceil(dar_volltilg_monate);
    }
  }

  // Berechne Datum der Zuteilung absolut
  var zuteil_date = null;
  if (monateBisZuteilung > 0) {
    var zuteil_m = startMonth + monateBisZuteilung - 1;
    var zuteil_y = startYear + Math.floor(zuteil_m / 12);
    zuteil_m = (zuteil_m % 12) + 1;
    zuteil_date = String(zuteil_m).padStart(2, '0') + '.' + zuteil_y;
  }

  return {
    // Eingaben
    d1: d1,
    bsparSum: bspar_sum,
    bsparRateM: bspar_rate_m,
    bsparZins: bspar_zins,
    bsparQuote: bspar_quote,
    darZ: dar_z,
    darT: dar_t,
    bindj: bindj,
    // Zuteilung
    zielGuthaben: ziel_guthaben,
    monateBisZuteilung: monateBisZuteilung,
    jahreBisZuteilung: jahreBisZuteilung,
    guthabenBeiZuteilung: guthaben_bei_zuteilung,
    zuteilStatus: zuteil_status,
    zuteilDate: zuteil_date,
    // Empfehlung
    empfohleneSparrate: empfohleneSparrate,
    sparrateOk: (bspar_rate_m >= empfohleneSparrate * 0.95),  // 5% Toleranz
    // Bauspardarlehen
    bauspardarlehen: bauspardarlehen,
    abloseSumme: ablose_summe,
    luecke: luecke_anschluss,
    darRateM: dar_rate_m,
    darVolltilgMonate: dar_volltilg_monate,
    darVolltilgJahre: dar_volltilg_monate > 0 ? Math.ceil(dar_volltilg_monate / 12) : -1
  };
}

// 30 calc-Läufe hintereinander stattfinden. Bei wirklich erstem Aufruf
// (z.B. nach dem Laden eines Objekts) sofort ausführen.
var _calcDebounceTimer = null;
var _calcLastImmediate = 0;
function calc() {
  // Wenn länger als 1.5s nichts mehr getriggert wurde → sofort rechnen
  // (gefühlt direktes Feedback bei normalem Tipp-Verhalten)
  var now = Date.now();
  var sinceLast = now - _calcLastImmediate;
  if (sinceLast > 1500) {
    _calcLastImmediate = now;
    if (_calcDebounceTimer) { clearTimeout(_calcDebounceTimer); _calcDebounceTimer = null; }
    _calcImmediate();
    return;
  }
  // Sonst debounced — sammelt schnelle Tipper
  if (_calcDebounceTimer) clearTimeout(_calcDebounceTimer);
  _calcDebounceTimer = setTimeout(function() {
    _calcLastImmediate = Date.now();
    _calcImmediate();
    _calcDebounceTimer = null;
  }, 300);
}

// V35: Kostenfelder-Sync — Euro-Felder sind editable Inputs
// _setCostEur: setzt das €-Feld nur wenn der User es nicht grade fokussiert
//              (sonst überschreibt es seinen Tipp-Stand bei jedem calc())
function _setCostEur(id, val) {
  var e = el(id);
  if (!e) return;
  if (document.activeElement === e) return;  // User tippt grade — nicht überschreiben
  // Auf ganze Euro runden, ohne führende Nullen
  var rounded = Math.round(val);
  if (rounded === 0) e.value = '';
  else e.value = rounded;
}

// User hat Prozent geändert — Euro folgt automatisch (über _calcImmediate)
// V63.8: User hat Prozent geändert — Euro-Feld dynamisch nachziehen
function syncCostPct(prefix) {
  var kp = v('kp');
  var eFld = el(prefix + '_e');
  var pFld = el(prefix + '_p');
  if (eFld && pFld && kp > 0) {
    var pct = parseDe(pFld.value) || 0;
    var eur = (kp * pct) / 100;
    eFld.value = Math.round(eur);
  }
  calc();
}

// User hat Euro geändert — Prozent neu berechnen aus Kaufpreis
function syncCostEur(prefix) {
  var kp = v('kp');
  var eFld = el(prefix + '_e');
  var pFld = el(prefix + '_p');
  if (!eFld || !pFld) return;
  var eur = parseDe(eFld.value) || 0;
  if (kp > 0) {
    var pct = (eur / kp) * 100;
    pFld.value = pct.toFixed(2);
  }
  calc();
}

// V29: Sofort-Variante für Stellen die direktes Ergebnis brauchen
// (z.B. updateAllValues, Initial-Load nach loadObject).
function calcNow() {
  if (_calcDebounceTimer) { clearTimeout(_calcDebounceTimer); _calcDebounceTimer = null; }
  _calcLastImmediate = Date.now();
  _calcImmediate();
}

function _calcImmediate(){
  updHeader();
  var kp=v('kp');
  var m_e=kp*v('makler_p')/100,n_e=kp*v('notar_p')/100,g_e=kp*v('gba_p')/100,ge_e=kp*v('gest_p')/100,ji_e=kp*v('ji_p')/100;
  var nk=m_e+n_e+g_e+ge_e+ji_e;
  var gi=kp+nk+v('san')+v('moebl');
  State.gi=gi;
  // V35: Euro-Felder sind editable Inputs — value statt textContent setzen,
  //      und nur wenn das Feld nicht aktuell fokussiert ist (User tippt grade).
  _setCostEur('makler_e', m_e);
  _setCostEur('notar_e',  n_e);
  _setCostEur('gba_e',    g_e);
  _setCostEur('gest_e',   ge_e);
  _setCostEur('ji_e',     ji_e);
  st('nk_sum',fE(nk)+(kp>0?' ('+fP(nk/kp*100,1)+')':''));
  st('gi_val','€ '+gi.toLocaleString('de-DE',{maximumFractionDigits:0}));
  // V36: Quadratmeterpreise
  var wfl_qm = v('wfl');
  if (wfl_qm > 0) {
    st('qm_kp', kp > 0 ? fE(kp / wfl_qm, 0) + ' / m²' : '—');
    st('qm_gi', gi > 0 ? fE(gi / wfl_qm, 0) + ' / m²' : '—');
  } else {
    st('qm_kp', '— (Wohnfläche fehlt)');
    st('qm_gi', '— (Wohnfläche fehlt)');
  }

  // V44 Bug-Fix: Markt-Faktor = Kaufpreis / Markt-Jahresmiete (nicht / Ist-Jahresmiete!)
  // Voraussetzung: ds2_marktmiete (€/qm Markt) ist gesetzt + Wohnfläche da
  // Sonst → KPI fällt im Upside-Score raus (kein falsch-positiver Wert mehr)
  var marktMieteQm = parseDe((document.getElementById('ds2_marktmiete') || {}).value) || 0;
  var wflM = parseDe((document.getElementById('wfl') || {}).value) || 0;
  var marktJahr = marktMieteQm * wflM * 12;
  if (kp > 0 && marktJahr > 0) {
    var marktfaktor = kp / marktJahr;
    st('qm_marktfaktor', marktfaktor.toFixed(1).replace('.', ',') + 'x · vs. Marktmiete');
    var hidden = document.getElementById('ds2_marktfaktor');
    if (hidden) hidden.value = marktfaktor.toFixed(1).replace('.', ',');
    if (typeof renderDealScore2 === 'function') {
      try { renderDealScore2(); } catch(e) {}
    }
  } else if (kp > 0 && (parseDe((document.getElementById('nkm') || {}).value) || 0) > 0) {
    // Fallback: zumindest Kaufpreis-Faktor zur IST-Miete anzeigen (Info, nicht Score-relevant)
    var nkmJ = (parseDe((document.getElementById('nkm') || {}).value) || 0) * 12;
    var ef = kp / nkmJ;
    st('qm_marktfaktor', ef.toFixed(1).replace('.', ',') + 'x · zur IST-Miete (für Marktvergleich → Marktmiete eintragen)');
    // Hidden-Field nicht setzen — sonst zählt's falsch im Score
    var hidden3 = document.getElementById('ds2_marktfaktor');
    if (hidden3) hidden3.value = '';
  } else {
    st('qm_marktfaktor', '— (Kaufpreis + Marktmiete erforderlich)');
    var hidden2 = document.getElementById('ds2_marktfaktor');
    if (hidden2) hidden2.value = '';
  }

  // V63.99: 15%-Grenze für anschaffungsnahe Herstellkosten (§ 6 Abs. 1 Nr. 1a EStG)
  // Marcels Beispiel-Mathematik:
  //   Kaufpreis gesamt (inkl. Küche):     500.000 €
  //   Gebäudeanteil 80% (Standard):       400.000 € (= KP × geb_ant)
  //   Küche (im KP enthalten):             20.000 €
  //   Gebäude ohne Küche:                 380.000 € (= 400.000 − 20.000)
  //   Gesamtsumme ohne Küche:             480.000 € (= 500.000 − 20.000)
  //   Gebäudequote ohne Küche:              79,17 % (= 380.000 / 480.000)
  //   Nebenkosten anteilig Gebäude:        NK × Gebäudequote
  //   Gebäude-AHK = (Gebäude o.K.) + (NK × Gebäudequote o.K.)
  //   15%-Grenze = Gebäude-AHK × 0,15
  //
  // Wenn keine Küche aktiv: Standard-Berechnung Gebäudeanteil × KP + Gebäudeanteil × NK
  // (mathematisch identisch zu kp × geb_ant × 0,15 wenn man nur den KP betrachtet, aber
  //  korrekter mit anteiligen Nebenkosten als Marcels alte Vereinfachung).
  var gebAnt = v('geb_ant')/100 || 0.80;
  var kuecheCheckEl = document.getElementById('kueche_im_kp');
  var kuecheActive = !!(kuecheCheckEl && kuecheCheckEl.checked);
  var kuecheVal = kuecheActive ? Math.max(0, v('kp_kueche') || 0) : 0;
  // Sicherheit: Küche kann nicht > Gebäudeanteil sein
  var gebBruttoMax = kp * gebAnt;
  if (kuecheVal > gebBruttoMax) kuecheVal = gebBruttoMax;

  var gebOhneK = gebBruttoMax - kuecheVal;
  var kpOhneK  = kp - kuecheVal;
  var gebQuoteOhneK = kpOhneK > 0 ? (gebOhneK / kpOhneK) : gebAnt;
  var nkGesamt = nk; // Summe aller Nebenkosten aus Z.610 (m_e+n_e+g_e+ge_e+ji_e)
  var nkGebAnteil = nkGesamt * gebQuoteOhneK;
  var gebAHK = gebOhneK + nkGebAnteil;
  var sanLimit = gebAHK * 0.15;

  var sanIst = v('san');
  st('san_limit_max', fE(sanLimit, 0));
  st('san_limit_actual', fE(sanIst, 0));
  var sanPct = sanLimit > 0 ? (sanIst / sanLimit * 100) : 0;
  var sanStatusEl = el('san_limit_status');
  if (sanStatusEl) {
    if (sanIst === 0) {
      sanStatusEl.innerHTML = '<span class="badge badge-muted">Keine Sanierung</span>';
    } else if (sanIst <= sanLimit) {
      sanStatusEl.innerHTML = '<span class="badge badge-green">✓ Unter Grenze ('+sanPct.toFixed(1)+'%) – voll abzugsfähig</span>';
    } else {
      sanStatusEl.innerHTML = '<span class="badge badge-red">⚠ Über 15% ('+sanPct.toFixed(1)+'%) – anschaffungsnahe HK (50 Jahre AfA)</span>';
    }
  }
  var hint = el('san_limit_hint');
  if (hint) hint.textContent = 'Max. ' + fE(sanLimit, 0) + ' in 3 Jahren (15%-Grenze)';

  // V63.99: Aufschlüsselung der AHK-Berechnung in der Info-Box
  var ahkDetailBlock = el('ahk_detail_block');
  if (ahkDetailBlock) {
    // Detail-Block immer zeigen wenn Sanierung > 0 oder Küche aktiv (Marcel will Transparenz)
    if (sanIst > 0 || kuecheActive) {
      ahkDetailBlock.style.display = '';
      st('ahk_geb_anteil', (gebAnt * 100).toFixed(0) + ' %');
      st('ahk_geb_brutto', fE(gebBruttoMax, 0));
      var labelEl = el('ahk_geb_label');
      if (labelEl) labelEl.textContent = kuecheActive ? 'Gebäude (vor Küchen-Abzug)' : 'Gebäude (' + (gebAnt*100).toFixed(0) + ' % von Kaufpreis)';
      var kuecheRow = el('ahk_kueche_row');
      var gebNettoRow = el('ahk_geb_netto_row');
      if (kuecheActive && kuecheVal > 0) {
        if (kuecheRow) kuecheRow.style.display = '';
        if (gebNettoRow) gebNettoRow.style.display = '';
        st('ahk_kueche_val', '−' + fE(kuecheVal, 0));
        st('ahk_geb_netto', fE(gebOhneK, 0));
      } else {
        if (kuecheRow) kuecheRow.style.display = 'none';
        if (gebNettoRow) gebNettoRow.style.display = 'none';
      }
      st('ahk_nk_anteil', fE(nkGebAnteil, 0) + ' (= ' + (gebQuoteOhneK*100).toFixed(1).replace('.', ',') + ' % der NK)');
      st('ahk_basis', fE(gebAHK, 0));
      st('ahk_15pct', fE(sanLimit, 0));
    } else {
      ahkDetailBlock.style.display = 'none';
    }
  }

  // V63.99: Werte für tax.js bereitstellen — Küche als separates Wirtschaftsgut
  if (window.State) {
    State._ahk = {
      gebAhk:        gebAHK,
      sanLimit:      sanLimit,
      kuecheVal:     kuecheVal,
      kuecheActive:  kuecheActive,
      gebQuoteOhneK: gebQuoteOhneK
    };
  }
  var svw=v('svwert'),wp=svw>0?svw-kp:0;
  var wpBox=el('wert-puffer');if(wpBox)wpBox.style.display=wp>0?'flex':'none';
  st('wert-puffer-val',wp>0?fE(wp,0,true):'');
  // V63.65: Startwert für Wertsteigerung — Reihenfolge:
  //   1. Verkehrswert (svw, §194 BauGB) wenn > 0
  //   2. Bankbewertung (bankval) wenn > Kaufpreis
  //   3. Kaufpreis (kp) als Fallback
  var _bankval = v('bankval') || 0;
  var wert_basis;
  if (svw > 0) {
    wert_basis = svw;
  } else if (_bankval > kp) {
    wert_basis = _bankval;
  } else {
    wert_basis = kp;
  }
  State.wert_basis = wert_basis;
  var gs_a=v('gsfl')*(v('mea')/100);
  st('gs_ant',gs_a.toFixed(2)+' m²');st('bodenwert',fE(gs_a*v('brw')));
  var nkm=v('nkm'),ze=v('ze'),uf=v('umlagef');
  var wm_m=nkm+ze+uf,wm_j=wm_m*12,nkm_j=(nkm+ze)*12;
  st('wm_m',fE(wm_m,2));st('wm_j',fE(wm_j,2));st('nkm_j_out',fE(nkm_j));
  var afa_r=parseDe((el('afa_satz')||{}).value||2);
  // V63.99: AfA-Berechnung mit Küchen-Korrektur.
  // Wenn Küche im KP enthalten ist, wird sie als separates Wirtschaftsgut behandelt:
  //  - Gebäude-AfA = (Gebäude ohne Küche + anteilige Nebenkosten) × afa_satz
  //  - Küche-AfA   = Küchenwert / 10 Jahre (linear, § 7 EStG für Wirtschaftsgüter unter 10 Jahre Nutzungsdauer)
  // Wenn keine Küche: Standard-Berechnung KP × Gebäudeanteil × afa_satz (Backward-Compat)
  // V113: Wenn kueche_im_kp aktiv ist, läuft der Küchenwert per UI-Sync (syncKuecheToMoebl)
  //       in das Möblierung-Feld → tax.js verarbeitet ihn dort über moeblPerYear mit der
  //       User-konfigurierbaren Laufzeit. afa_kueche bleibt 0 damit keine Doppelung in Feld 6.
  var afa_geb, afa_kueche = 0;
  if (window.State && State._ahk && State._ahk.kuecheActive && State._ahk.kuecheVal > 0) {
    // Marcels Logik: AfA-Basis = Gebäude-AHK (= Gebäude ohne Küche + anteilige Nebenkosten)
    afa_geb = State._ahk.gebAhk * (afa_r/100);
    // V113: KEIN afa_kueche mehr hier — läuft jetzt über das Möblierung-Feld (Sync in ui.js).
    //       Damit nutzt der User die Laufzeit-Auswahl (5/8/10/15 Jahre) und der Wert erscheint
    //       sauber in Feld 6 "Bewegliche Wirtschaftsgüter" — ohne Doppelung.
    afa_kueche = 0;
  } else {
    // Standard ohne Küche
    afa_geb = kp * (v('geb_ant')/100) * (afa_r/100);
  }
  var afa = afa_geb + afa_kueche;
  // V63.99: Anzeige — bei aktiver Küche Aufteilung sichtbar machen
  if (afa_kueche > 0) {
    st('afa_kalk', fE(afa, 2) + ' (Gebäude: ' + fE(afa_geb, 0) + ' + Küche 10J: ' + fE(afa_kueche, 0) + ')');
  } else {
    st('afa_kalk', fE(afa, 2));
  }
  // V63.99: Küchen-AfA in State für Steuer-Modul + Anzeige bereitstellen
  if (window.State) {
    State._afaBreakdown = {
      gebaeude: afa_geb,
      kueche:   afa_kueche,
      gesamt:   afa
    };
  }
  // BWK: Entweder detailliert ODER als % der NKM
  var bwkMode = window._bwkMode || 'detail';
  var ul, nul, bwk;
  if (bwkMode === 'percent') {
    var pctSubMode = window._bwkPctMode || 'nkm';
    if (pctSubMode === 'kp') {
      // BWK als % vom Kaufpreis
      var kpPct = v('bwk_kp_pct') / 100 || 0;
      bwk = kp * kpPct;
      // Aufteilung 50/50 bei KP-Modus (nur für Anzeige, da BWK-Gesamt zählt)
      ul = bwk * 0.5;
      nul = bwk * 0.5;
      st('bwk_pct_nkm', fE(nkm * 12));
      st('bwk_pct_ul', fE(ul) + ' (geschätzt 50%)');
      st('bwk_pct_nul', fE(nul) + ' (geschätzt 50%)');
      st('bwk_pct_total', fE(bwk));
      st('bwk_total_pct', fP(kpPct * 100, 2) + ' vom KP');
    } else {
      var ulPct = v('bwk_ul_pct') / 100 || 0;
      var nulPct = v('bwk_nul_pct') / 100 || 0;
      ul = (nkm * 12) * ulPct;
      nul = (nkm * 12) * nulPct;
      bwk = ul + nul;
      st('bwk_pct_nkm', fE(nkm * 12));
      st('bwk_pct_ul', fE(ul));
      st('bwk_pct_nul', fE(nul));
      st('bwk_pct_total', fE(bwk));
      st('bwk_total_pct', fP((ulPct + nulPct) * 100, 1));
    }
  } else {
    ul = v('hg_ul')+v('grundsteuer')+v('ul_sonst')+v('kp1')+v('kp2')+v('kp3')+v('kp4');
    nul = v('hg_nul')+v('eigen_r')+v('mietausfall')+v('nul_sonst');
    // WEG-Rücklage: nur Info-Anzeige, NICHT summieren (ist bereits Teil des Hausgeldes)
    bwk = ul + nul;
  }
  State.bwk=bwk;
  st('ul_sum',fE(ul));st('nul_sum',fE(nul));st('r-ul',fE(ul));st('r-nul',fE(nul));
  st('r-bwk',fE(bwk));st('r-bwk-pct',nkm_j>0?fP(bwk/nkm_j*100,1):'—');st('r-hg-ges',fE(v('hg_ul')+v('hg_nul')));
  var d1=v('d1'),d1z=v('d1z')/100;
  // V63.49: Bei Tilgungsaussetzung wird Tilgung als 0 angesetzt — parallel läuft
  // ein Bausparvertrag der die Restschuld am Zuteilungsdatum ablöst.
  // Die Bausparrate fließt als Liquiditätsabfluss in den Cashflow.
  var _d1IsAussetzung = (g('d1_type') === 'tilgungsaussetzung');
  var d1t = _d1IsAussetzung ? 0 : (v('d1t') / 100);
  var d1_rate_m=(d1*(d1z+d1t))/12;
  var d1_zm=d1*d1z/12,d1_tm=d1_rate_m-d1_zm;
  // V63.49: Bauspar-Sparrate (nur relevant bei Aussetzung)
  var bsparRate_m = _d1IsAussetzung ? v('bspar_rate') : 0;
  State.bsparRate_m = bsparRate_m;
  State.d1IsAussetzung = _d1IsAussetzung;
  State.d1z=d1z;State.d1_rate_monthly=d1_rate_m;
  // V63.54: Vollständigen BSV-Lebenszyklus berechnen
  State.bsvLifecycle = _computeBsvLifecycle();
  st('d1_rate',fE(d1_rate_m,2));st('d1_zm',fE(d1_zm,2));st('d1_tm',_d1IsAussetzung ? '— (BSV)' : fE(d1_tm,2));

  // ═════ Darlehen II (optional) ═════
  var d2_enabled = el('d2_enable') && el('d2_enable').checked;
  var d2 = 0, d2z = 0, d2t = 0, d2_rate_m = 0, d2_zm = 0, d2_tm = 0;
  var d2_type = g('d2_type') || 'annuitaet';

  if (d2_enabled) {
    d2 = v('d2');
    d2z = v('d2z') / 100;
    d2t = v('d2t') / 100;
    if (d2_type === 'tilgungsaussetzung') {
      // Nur Zinsen, keine Tilgung während Laufzeit
      d2t = 0;
      d2_zm = d2 * d2z / 12;
      d2_tm = 0;
      d2_rate_m = d2_zm;
      sv('d2t', '0');
    } else {
      // Annuität oder KfW (meist auch Annuität)
      d2_rate_m = (d2 * (d2z + d2t)) / 12;
      d2_zm = d2 * d2z / 12;
      d2_tm = d2_rate_m - d2_zm;
    }
    st('d2_rate', fE(d2_rate_m, 2));

    // Hinweise ein-/ausblenden
    var kfwBox = el('d2_kfw_box');
    var tadBox = el('d2_tad_box');
    if (kfwBox) kfwBox.style.display = d2_type === 'kfw' ? '' : 'none';
    if (tadBox) tadBox.style.display = d2_type === 'tilgungsaussetzung' ? '' : 'none';

    // Hint für d2t
    var d2tHint = el('d2t_hint');
    if (d2tHint) {
      d2tHint.textContent = d2_type === 'tilgungsaussetzung'
        ? 'Keine Tilgung während Laufzeit (nur Zinsen)'
        : 'Anfängliche Tilgung in % p.a.';
    }
  }
  State.d2 = d2; State.d2z = d2z; State.d2t = d2t;
  State.d2_rate_m = d2_rate_m; State.d2_enabled = d2_enabled; State.d2_type = d2_type;

  // ═════ Gesamtfinanzierung: gewichtete Zinsen/Tilgung ═════
  var d_total = d1 + d2;
  var d1z_effective = d1z;  // Wird weiter unten für Zinsberechnung genutzt
  var d1_rate_total = d1_rate_m + d2_rate_m;
  var d_zm_total = d1_zm + d2_zm;
  var d_tm_total = d1_tm + d2_tm;
  // V63.36: LTV-Bezugsgröße in 3 Stufen
  //   Standard (Bankenpraxis): LTV gegen Beleihungswert ≈ Sachverständigen-Wert (SVW).
  //                            Wenn kein SVW eingegeben → Fallback Kaufpreis.
  //   Checkbox "ek_inkl_nk":   LTV gegen Gesamtinvestition (KP + KNK + San + Möbl) — strenger.
  // Das deckt sich mit ImmoKalk-Excel: LTV = Darlehen / Immobilienwert (Sachwert).
  var _ekInklNkLtv = (el('ek_inkl_nk') && el('ek_inkl_nk').checked);
  var ltv_basis, ltv_basis_label;
  if (_ekInklNkLtv) {
    ltv_basis = gi;
    ltv_basis_label = 'Gesamtinvestition (KP + KNK)';
  } else if (svw > 0) {
    ltv_basis = svw;
    ltv_basis_label = 'Verkehrswert (§194 BauGB)';
  } else if (_bankval > kp) {
    // V63.65: Wenn Bankbewertung höher als Kaufpreis und kein Verkehrswert eingegeben
    ltv_basis = _bankval;
    ltv_basis_label = 'Bankbewertung';
  } else {
    ltv_basis = kp;
    ltv_basis_label = 'Kaufpreis';
  }
  State.ltv_basis = ltv_basis;
  State.ltv_basis_label = ltv_basis_label;
  var ltv = ltv_basis > 0 ? d_total / ltv_basis * 100 : 0;
  var ek_p=100-ltv;
  var bar=el('ek-bar');if(bar)bar.style.width=Math.max(2,Math.min(98,ek_p)).toFixed(1)+'%';
  st('ek-pct',ek_p.toFixed(0)+'%');st('fk-pct',ltv.toFixed(0)+'%');
  var bindj=v('d1_bindj')||10;State.bindj=bindj;
  var rs=d1, rs2=d2;
  for(var y=0;y<bindj;y++){
    var z=rs*d1z, t=d1_rate_m*12-z;
    rs=Math.max(0,rs-t);
    // Tilgung d2 nur wenn Annuität (nicht bei Tilgungsaussetzung)
    if(d2_enabled && d2_type !== 'tilgungsaussetzung'){
      var z2=rs2*d2z, t2=d2_rate_m*12-z2;
      rs2=Math.max(0,rs2-t2);
    }
  }
  var rs_total = rs + rs2;
  State.rs=rs_total; State.rs1=rs; State.rs2=rs2;
  st('restschuld',fE(rs_total,0));
  var be=new Date();be.setFullYear(be.getFullYear()+bindj);
  st('bindend',be.toLocaleDateString('de-DE',{month:'2-digit',year:'numeric'}));
  var vtJ=d1_tm>0?Math.ceil(Math.log(d1_rate_m/d1_tm)/Math.log(1+d1z/12)/12):99;
  st('volltilg',(new Date().getFullYear()+vtJ).toString());
  var az=v('anschl_z')/100,at=v('anschl_t')/100;State.az=az;State.at=at;
  // Zinsänderungsrisiko auto = Anschluss - Aktuell
  var zaer_auto=Math.max(0,v('anschl_z')-v('d1z'));
  // zaer wird nur angezeigt
  var ar=rs*(az+at)/12;st('anschl_rate',fE(ar,2));
  // Auto-calc zaer = difference between anschl and current
  var zaer_pct=Math.max(0,v('anschl_z')-v('d1z'));
  var zaer_m=rs*(zaer_pct/100)/12;
  // zaer wird nur angezeigt, kein Input mehr
  var zd=document.getElementById('zaer_display');
  if(zd)zd.textContent='+'+fP(zaer_pct,2)+' p.a. (Anschluss '+fP(v('anschl_z'),2)+' − Aktuell '+fP(v('d1z'),2)+')';
  st('zaer_m',fE(zaer_m,0)+'/Mon.');
  st('r-darl', fE(d_total) + (d2_enabled && d2 > 0 ? ' (D1: ' + fE(d1, 0) + ' + D2: ' + fE(d2, 0) + ')' : ''));
  st('r-ek',fE(v('ek')));st('r-ltv',fP(ltv,1));
  // V63.8 + V63.36: LTV-Erklärung live aktualisieren — dynamisch je nach Bezug
  var kpVal = v('kp') || 0;
  var ekVal = v('ek') || 0;
  var darlVal = d_total || 0;
  st('ltv-exp-darl', fE(darlVal));
  st('ltv-exp-kp',   fE(ltv_basis));
  st('ltv-exp-ltv',  fP(ltv, 1));
  st('ltv-exp-ek',   fE(ekVal));
  st('ltv-exp-d',    fE(darlVal));
  st('ltv-exp-kp2',  fE(kpVal));
  st('ltv-exp-basislabel', ltv_basis_label);
  var ltvHint;
  if (_ekInklNkLtv) {
    ltvHint = 'Konservative GI-Sicht: Beleihungsbasis = KP + Erwerbsnebenkosten ('+fE(gi)+'). EK '+fE(ekVal)+' | Darlehen '+fE(darlVal)+' | GI '+fE(gi);
  } else if (svw > 0) {
    ltvHint = 'Bankenpraxis: Beleihungsbasis = Verkehrswert §194 BauGB ('+fE(svw)+'). EK '+fE(ekVal)+' | Darlehen '+fE(darlVal)+' | Verkehrswert '+fE(svw);
  } else {
    ltvHint = 'Standard ohne Verkehrswert: Beleihungsbasis = Kaufpreis. EK '+fE(ekVal)+' | Darlehen '+fE(darlVal)+' | KP '+fE(kpVal);
  }
  var hintEl = el('ltv-exp-hint');
  if (hintEl) hintEl.innerHTML = ltvHint;
  st('r-rate',fE(d1_rate_total,2) + (d2_enabled && d2 > 0 ? ' gesamt' : ''));
  // Zins: Bei zwei Darlehen → effektiver Mischzins
  var zinsDisplay;
  if (d2_enabled && d2 > 0 && d_total > 0) {
    var mischzins = (d1 * d1z + d2 * d2z) / d_total * 100;
    zinsDisplay = fP(mischzins, 2) + ' (Mischzins)';
  } else {
    zinsDisplay = fP(d1z * 100, 2);
  }
  st('r-zins', zinsDisplay);
  st('r-bindend',be.toLocaleDateString('de-DE',{month:'2-digit',year:'numeric'}));
  st('r-rs',fE(State.rs,0));st('r-anschl',fE(ar,2));
  var grenz=v('grenz')/100;
  var zins_j=(d1_zm+d2_zm)*12, tilg_j=(d1_tm+d2_tm)*12;
  // V63.49: Bei Tilgungsaussetzung läuft parallel eine Bausparrate als Sparbeitrag.
  // Der ist KEIN steuerlich abziehbarer Aufwand, aber ein Liquiditätsabfluss —
  // ähnlich wie Tilgung. Wir behandeln ihn analog zur Tilgung im CF.
  var bspar_y = (State.bsparRate_m || 0) * 12;
  // V63.35: Excel-Logik strikt — umlagef. BWK ist durchlaufender Posten.
  // CF rechnet auf NKM+ZE (nkm_j) gegen NUR den nicht-umlagef. Anteil der BWK.
  // bwk = ul + nul bleibt für NMR-Anzeige & Bewirt-Quote erhalten.
  var bwk_cf = nul;
  // V63.40: User-Wunsch — CF v.St. ist IMMER nach Tilgung (Banker-Sicht).
  // cf_operativ wird intern für Steuerbemessung gebraucht (Tilgung steuerlich nicht abziehbar).
  var cf_operativ = nkm_j - bwk_cf - zins_j;          // intern: vor Tilg, für Steuer
  var zve_immo = cf_operativ - afa;
  var steuer   = zve_immo * grenz;
  // Öffentliche Werte: alle nach Tilgung (Banker) und nach BSV-Sparrate
  var cf_op = cf_operativ - tilg_j - bspar_y;          // CF v.St. NACH Tilgung & BSV
  var cf_ns = cf_op - steuer;                          // CF n.St. NACH Tilgung & BSV
  var cf_m  = cf_op / 12;
  var cf_ns_m = cf_ns / 12;
  st('zve_cf',fE(zve_immo,0,true));
  st('steuer_j',fE(-steuer,0)+(steuer<0?' (Erstattung)':' (Belastung)'));
  // DSCR = Mieteinnahmen (NKM+ZE) / Kapitaldienst (Zins+Tilgung)
  // V63.57: Bei Tilgungsaussetzung wird die BSV-Sparrate als wirtschaftlicher
  // Tilgungsersatz mit eingerechnet (so wie es Banken in der Praxis tun)
  var noi_dscr=(nkm+ze)*12; // Nettomieteinnahmen (ohne Betriebskosten)
  var bsv_in_kd = _d1IsAussetzung ? bspar_y : 0;  // BSV-Sparrate als wirtschaftl. Tilgungsersatz
  var kd_dscr=zins_j+tilg_j+bsv_in_kd;
  var dscr=kd_dscr>0?noi_dscr/kd_dscr:0;
  var dscr_netto=kd_dscr>0?(nkm_j-bwk_cf)/kd_dscr:0; // V63.35: NOI = NKM − NUL (Excel-Logik)
  // Einheitliche DSCR-Schwellen: <1.0 kritisch · 1.0–1.2 ausreichend · ≥1.2 standard
  var dscrLabel = dscr >= 1.2 ? '✓ Standard (≥1,2)' : dscr >= 1.0 ? '⚠ Ausreichend (1,0–1,2)' : '✗ Kritisch (<1,0)';
  var dscrCls   = dscr >= 1.2 ? 'dscr-good' : dscr >= 1.0 ? 'dscr-warn' : 'dscr-bad';
  var dscrEl=document.getElementById('bank-dscr-t');
  if(dscrEl)dscrEl.innerHTML='DSCR: <span class="dscr-badge '+dscrCls+'">'+dscr.toFixed(2)+'</span> '+dscrLabel;
  var bankItem2=dscrEl&&dscrEl.closest('.bank-item');
  if(bankItem2)bankItem2.className='bank-item '+(dscr>=1.2?'ok':dscr>=1.0?'warn':'bad');
  // Detail-Text: bei BSV explizit anzeigen
  var dscrDetail = 'Mieteinnahmen '+fE(noi_dscr)+' / Kapitaldienst '+fE(kd_dscr)+' p.a.';
  if (bsv_in_kd > 0) dscrDetail += ' (Zins '+fE(zins_j,0)+' + BSV-Sparrate '+fE(bsv_in_kd,0)+')';
  dscrDetail += ' | Netto-DSCR: '+fN(dscr_netto,2);
  st('bank-dscr-d', dscrDetail);
  st('bank-zaer-d','Anschluss kalkuliert bei '+fP(v('anschl_z'),1)+' → '+fE(ar,0)+'/Mon. (Risiko: '+fE(zaer_m,0)+'/Mon.)');
  // LTV bank item coloring
  var bi_ltv=document.getElementById('bi-ltv');
  var _ekValEarly = v('ek') || 0;
  if(bi_ltv){
    var ltv_ok=ltv<=80,ltv_warn=ltv<=90;
    bi_ltv.className='bank-item '+(ltv_ok?'ok':ltv_warn?'warn':'bad');
    st('bank-ltv-t','LTV: '+fP(ltv,1)+' – '+(ltv_ok?'✓ Sehr gut (≤80%)':ltv_warn?'⚠ Ausreichend (≤90%)':'✗ Hoch (>90%)'));
    // V63.37: Detail-Text richtet sich nach LTV-Bezugsgröße
    st('bank-ltv-d','Darlehen '+fE(d_total)+' / '+ltv_basis_label+' '+fE(ltv_basis)+' · Eigenkapital '+fE(_ekValEarly));
  }
  // Zaer bank item coloring
  var bi_zaer=document.getElementById('bi-zaer');
  if(bi_zaer){bi_zaer.className='bank-item '+(zaer_pct<=1.5?'ok':zaer_pct<=3?'warn':'bad');}
  // Vermstand coloring
  var bi_verm=document.getElementById('bi-verm');
  var vmst=g('vermstand');
  if(bi_verm){
    var vok=vmst==='Vollvermietet';
    bi_verm.className='bank-item '+(vok?'ok':'warn');
    st('bi-verm-t',vmst==='Vollvermietet'?'✓ Vollständig vermietet':vmst);
    st('bi-verm-d',vok?'Nachgewiesene Mieterträge als stabile Einnahmebasis':'Leerstand erhöht das Risiko – Vermietung empfohlen');
  }
  // V63.35: NMR auf Eigentümer-Sicht — NKM minus nicht-umlagef. (UL ist neutral, durchlaufend)
  var bmy=kp>0?nkm_j/kp*100:0,nmy=gi>0?(nkm_j-bwk_cf)/gi*100:0;
  var fak=nkm_j>0?kp/nkm_j:0;
  var ekvBase = v('ek');
  // V63.35.1: Die Checkbox "ek_inkl_nk" steuert ab jetzt NUR noch den LTV-Bezug
  // (oben verwendet als _ekInklNkLtv → ltv_basis). Die EK-Rendite und Equity Multiple
  // basieren konsequent auf dem tatsächlich eingesetzten Eigenkapital (Mieter-Sicht).
  // Vorher erhöhte die Checkbox ekv um die KNK, was die EK-Rendite künstlich verzerrt hat.
  var ekv = ekvBase;
  // Erwerbsnebenkosten = gi - kp (alles außer Kaufpreis selbst) — für Anzeigezwecke
  var nk_total = Math.max(0, gi - kp);
  var wp_kpi=svw>0?svw-kp:0;
  var btj=parseInt(g('btj')||'20');
  var mstg=v('mietstg')/100,wstg=v('wertstg')/100,kstg=v('kostenstg')/100;
  // V109 BUG-FIX: State.wstg + Co. waren nie gesetzt — bank-charts.js (und andere Module die
  // window.State lesen) bekamen `undefined` und nutzten Fallback 0.015 (1,5%). Folge: bei
  // Wertsteigerung 2 % zeigte der Vermögensaufbau-Chart 220k × 1.015^btj statt 220k × 1.02^btj —
  // also etwa 255k statt 268k bei 10 Jahren.
  State.wstg = wstg;
  State.mstg = mstg;
  State.kstg = kstg;
  State.btj  = btj;
  var exit_r=(v('exit_bmy')||5)/100;
  // V23: Mietsteigerung — Detail-Modus nutzt Treppe statt Compound %.
  // Toggle berücksichtigt: NKM wächst immer, zE wächst nur wenn Toggle "appliesToZE" gesetzt.
  var _mFac = (window.MietEntwicklung && typeof MietEntwicklung.factor === 'function')
              ? function(y){ return MietEntwicklung.factor(y); }
              : function(y){ return Math.pow(1+mstg, y); };
  var _meIncludesZE = (window.MietEntwicklung && typeof MietEntwicklung.appliesToZE === 'function')
                      ? MietEntwicklung.appliesToZE() : false;
  // Jährliche Werte — NKM und zE getrennt wachsen lassen
  function _nkmJYear(y) {
    return nkm * 12 * _mFac(y) + ze * 12 * (_meIncludesZE ? _mFac(y) : 1.0);
  }
  function _wmJYear(y) {
    // Warmmiete = NKM-Anteil-wachsend + zE-Anteil + umlagef × kostenstg
    return _nkmJYear(y) + uf * 12 * Math.pow(1+kstg, y);
  }
  var nkm_exit = _nkmJYear(btj);
  var exit_vkp=exit_r>0?nkm_exit/exit_r:0;
  // V63.41: Sauberer Annuitäten-Loop für die Vermögenszuwachs-Berechnung.
  // Start mit Initial-Darlehen d1, läuft bis btj. Während Bindung mit d1z, danach mit az_eff.
  // V63.58: Bei Tilgungsaussetzung mit BSV muss die Sparrate als CF-Abfluss UND
  //   das aufgebaute Sparguthaben als eigene Vermögensposition berücksichtigt werden.
  // V63.60: Anschluss-Logik korrigiert — bei 'after_ezb'/'never' bleibt RS voll
  //   (Sparguthaben bleibt im Vertrag gebunden, wird NICHT Sondertilgung), Sparrate läuft weiter.
  var rs_loop = d1, cfkum = 0;
  var az_eff_v = az > 0 ? az : d1z;       // Anschluss-Zins, Fallback aktueller Zins
  var at_eff_v = at > 0 ? at : d1t;       // Anschluss-Tilgung
  if (_d1IsAussetzung && at_eff_v === 0) at_eff_v = 0.01; // Default 1% Anschluss-Tilgung bei Aussetzung
  // V121: rate_anschl_v wird erst NACH der Bindungsphase auf Basis der Restschuld am EZB
  //   gesetzt (= konsistent zur zweiten Schleife in cfRows-Build, die State.rs * (az+at) nutzt).
  //   Vorher war hier d1 * (az+at) — das führte bei Bäckerstr.7 zu 22.500 €/J Anschluss-Annuität
  //   statt 10.065 €/J → Tilgung 217k statt 144k → Vermögenszuwachs-Box zeigte 217k oben,
  //   Aufschlüsselung darunter aber 144k. Marcels gefundener Bug.
  var rate_anschl_v = 0;  // wird unten gesetzt
  // V63.58: BSV-Tracking für Vermögenszuwachs
  var bspar_kum = 0;                      // Summe Sparbeiträge
  var bspar_guth = 0;                     // Sparguthaben mit Verzinsung
  var _lc_vz = State.bsvLifecycle;
  var _useBSV_vz = _d1IsAussetzung && _lc_vz && _lc_vz.bsparRateM > 0;
  // V63.60: BSV-Zuteilstatus bestimmt das Verhalten in der Anschlussphase
  var _bsvStatus = _useBSV_vz ? _lc_vz.zuteilStatus : null;
  var _bsvAblostInAnschluss = (_bsvStatus === 'before_ezb' || _bsvStatus === 'at_ezb');
  // V63.39: Aufschlüsselung des kumulierten CF-Überschusses (für Erklärung)
  var miete_kum = 0, bwk_kum = 0, zins_kum = 0, tax_kum = 0;
  for(var y=1;y<=btj;y++){
    // V63.35: Excel-Logik — CF auf NKM gegen NUL-Bewirt; UL ist durchlaufend
    // V63.61: Off-by-One — Jahr 1 ist HEUTE, also _mFac(0)=1.0 (keine Steigerung)
    var nkm_y=_nkmJYear(y-1),bwk_cf_y=bwk_cf*Math.pow(1+kstg,y-1);
    // V121: rate_anschl_v am Übergang Bindung→Anschluss auf rs am EZB setzen
    if (y === bindj + 1 && rate_anschl_v === 0) {
      rate_anschl_v = rs_loop * (az_eff_v + at_eff_v);
    }
    var zy, ty, bspar_y_loop = 0;
    if (_useBSV_vz) {
      var _zuteilJ = (_lc_vz.jahreBisZuteilung > 0) ? _lc_vz.jahreBisZuteilung : 9999;
      if (y <= bindj && y < _zuteilJ) {
        // Sparphase während Zinsbindung: nur Zinsen auf voller RS, keine Tilgung
        zy = rs_loop * d1z;
        ty = 0;
        bspar_y_loop = _lc_vz.bsparRateM * 12;
        bspar_guth = (bspar_guth + bspar_y_loop) * (1 + _lc_vz.bsparZins);
      } else if (rs_loop > 0) {
        // Anschluss-Phase
        if (_bsvAblostInAnschluss && y === bindj + 1 && bspar_guth > 0) {
          // Variante A: BSV wird zugeteilt → Sparguthaben löst Hauptdarlehen ab,
          // Bauspardarlehen läuft weiter (vereinfacht: Lücke ggf. als klassische Anschlussfin.)
          rs_loop = Math.max(0, rs_loop - bspar_guth);
          rate_anschl_v = rs_loop * (az_eff_v + at_eff_v);
          bspar_guth = 0;
          bspar_y_loop = 0;
          zy = rs_loop * az_eff_v;
          ty = Math.min(rs_loop, Math.max(0, rate_anschl_v - zy));
        } else if (_bsvStatus === 'after_ezb' || _bsvStatus === 'never') {
          // Variante B: BSV-Quote nicht erreicht → Sparrate läuft WEITER, RS voll
          zy = rs_loop * az_eff_v;
          ty = Math.min(rs_loop, Math.max(0, rate_anschl_v - zy));
          bspar_y_loop = _lc_vz.bsparRateM * 12;
          bspar_guth = (bspar_guth + bspar_y_loop) * (1 + _lc_vz.bsparZins);
        } else {
          // Fallback: klassische Anschlussfin. ohne BSV
          zy = rs_loop * az_eff_v;
          ty = Math.min(rs_loop, Math.max(0, rate_anschl_v - zy));
        }
      } else {
        zy = 0; ty = 0;
      }
    } else {
      // Klassische Annuität
      if (y <= bindj) {
        zy = rs_loop * d1z;
        ty = Math.min(rs_loop, d1_rate_m * 12 - zy);
      } else if (rs_loop > 0) {
        zy = rs_loop * az_eff_v;
        ty = Math.min(rs_loop, Math.max(0, rate_anschl_v - zy));
      } else {
        zy = 0; ty = 0;
      }
    }
    var cf_y_op=nkm_y-bwk_cf_y-zy;
    var tax_y_loop = (cf_y_op-afa)*grenz;
    // V63.58: BSV-Sparrate ist CF-Abfluss (gebundenes Geld), gehört in CF-Berechnung
    var cf_y_ns=cf_y_op-tax_y_loop-bspar_y_loop;
    cfkum+=cf_y_ns;
    bspar_kum += bspar_y_loop;
    rs_loop=Math.max(0,rs_loop-ty);
    miete_kum += nkm_y;
    bwk_kum   += bwk_cf_y;
    zins_kum  += zy;
    tax_kum   += tax_y_loop;
  }
  // Tilgung kumuliert nach btj Jahren = Differenz Anfangsdarlehen zu rs_loop
  var tilgung_kum_btj = d1 - rs_loop;
  // V63.41: Wertsteigerung Excel-konform — IMMER über die Wertsteigerungsannahme (wstg).
  // V63.65: Endwert basiert auf wert_basis (svw > bankval > kp), Wertsteigerung relativ dazu.
  var wert_endjahr  = wert_basis * Math.pow(1+wstg, btj);
  var wertsteig_kum = wert_endjahr - wert_basis;
  var net_exit=exit_vkp-Math.max(0,rs); // (für PE-EM-Alternative — nicht in Card verwendet)
  var tilgung_kum = Math.max(0, tilgung_kum_btj);
  // V63.53: Vermögenszuwachs korrekt berechnen.
  // Vorher: tilgung_kum + max(0, cfkum) + max(0, wertsteig_kum)
  //   → Bug: bei negativem cfkum wurde Eigenanteil ignoriert
  // Korrekt: Wenn CF negativ, schießt der Investor Geld zu (Eigenanteil zur Tilgung).
  // Netto-Vermögenszuwachs = Tilgung (vom Mieter) + max(0, CF-Überschuss) + Wertsteigerung
  // V63.58: Bei BSV mit Tilgungsaussetzung ist tilgung_kum ≈ 0 (über Bindj keine Tilgung).
  //         Stattdessen wurde Sparguthaben aufgebaut (bspar_kum). Das ist auch Vermögensbildung!
  //         Wir behandeln Sparguthaben separat (statt es in tilgung_kum zu mischen) — dadurch
  //         bleibt die Aufstellung transparent.
  // Tilgung gesamt = Tilgung vom Mieter + Eigenanteil
  // Eigenanteil entspricht dem |cfkum| wenn cfkum < 0 (gedeckelt auf tilgung_kum + bspar_kum)
  var _vermBuilt = tilgung_kum + bspar_kum;  // Was wurde insgesamt an "Schuldenabbau-Ersatz" aufgebaut
  var tilg_eigenanteil   = (cfkum < 0) ? Math.min(-cfkum, _vermBuilt) : 0;
  var tilg_durch_einnahmen = Math.max(0, tilgung_kum - tilg_eigenanteil);
  // Sparguthaben: was übrig bleibt vom Eigenanteil-Anteil zieht von bspar_kum ab
  var bspar_eigenanteil_rest = Math.max(0, tilg_eigenanteil - tilgung_kum);
  var bspar_durch_einnahmen = Math.max(0, bspar_kum - bspar_eigenanteil_rest);
  var cf_ueberschuss     = Math.max(0, cfkum);
  // Netto-Vermögenszuwachs: Tilgung-vom-Mieter + Sparguthaben-vom-Mieter + CF-Überschuss + Wertsteigerung
  var verm_zuwachs = tilg_durch_einnahmen + bspar_durch_einnahmen + cf_ueberschuss + Math.max(0, wertsteig_kum);
  var em = ekv > 0 ? verm_zuwachs / ekv : 0;
  // PE-Definition als Alternative behalten für Vergleich:
  var em_pe = ekv > 0 ? (Math.max(0,cfkum)+Math.max(0,net_exit))/ekv : 0;
  var ekr=ekv>0?cf_ns/ekv*100:0;
  // EZB = Ende der Zinsbindung — V63.61: Werte AM Ende der Zinsbindung (nach `bindj` vollen
  // Jahren), nicht im letzten Bindungsjahr (bindj-1). Das war ein Off-by-One-Fehler:
  // - Tabelle 'Cashflow-Projektion' zeigt Zeile bindj mit den 'EZB'-Werten
  // - 'Heute'-Karte zeigt Werte JAHR 0 (Anfang)
  // - 'EZB'-Karte muss demnach Werte JAHR bindj zeigen
  // Excel-Logik: Mietsteigerung über `bindj` Jahre, BWK-Steigerung über `bindj` Jahre.
  var wm_ezb=_wmJYear(bindj),bwk_ezb=bwk*Math.pow(1+kstg,bindj);
  var nkm_ezb=_nkmJYear(bindj),bwk_cf_ezb=bwk_cf*Math.pow(1+kstg,bindj);
  // V63.52: Bei Tilgungsaussetzung läuft die Restschuld konstant (kein Tilg-Abbau)
  // Bei Annuität: Restschuld bei Ende Zinsbindung
  var rs_at_bindj = State.rs;  // Restschuld bei Ende Zinsbindung
  var zins_ezb, tilg_ezb;
  if (_d1IsAussetzung) {
    // Tilgungsaussetzung: Zinsen konstant auf voller Darlehenssumme, keine Tilgung
    zins_ezb = d1 * d1z;
    tilg_ezb = 0;
  } else {
    // Annuität: Durchschnittszins über Bindungszeit
    var zins_ezb_avg = (d1 * d1z + rs_at_bindj * d1z) / 2;
    zins_ezb = zins_ezb_avg;
    tilg_ezb = d1_rate_m * 12 - zins_ezb;
  }
  // V63.52: Bei Aussetzung Bauspar-Rate als Liquiditätsabfluss
  var bspar_y_ezb = _d1IsAussetzung ? bspar_y : 0;
  // V63.40: CF v.St. = nach Tilgung (Banker-Sicht)
  var cf_op_ezb_operativ = nkm_ezb - bwk_cf_ezb - zins_ezb;     // intern für Steuer
  var ster_ezb = (cf_op_ezb_operativ - afa) * grenz;
  var cf_op_ezb = cf_op_ezb_operativ - tilg_ezb - bspar_y_ezb;  // V63.52: nach Tilg & BSV
  var cf_ns_ezb = cf_op_ezb - ster_ezb;                          // Banker-CF n.St.
  var cf_ezb = cf_ns_ezb;

  // === ANSCHLUSS-PHASE (Jahr bindj+1) ===
  // V63.52/53/54: Bei Tilgungsaussetzung mit Bausparvertrag wird die Anschluss-Phase
  // davon abhängig was bis zum Bindungs-Ende mit dem BSV passiert ist:
  //   1. Zuteilung VOR Bindungs-Ende: BSV hat Hauptdarlehen abgelöst, Bauspardarlehen läuft
  //   2. Zuteilung AT/NACH Bindungs-Ende: Hauptdarlehen läuft mit Anschlussfin. weiter,
  //      BSV-Sparrate läuft auch weiter, ggf. später Ablösung durch BSV-Zuteilung
  var wm_an = _wmJYear(bindj);
  var bwk_an = bwk * Math.pow(1+kstg, bindj);
  var nkm_an = _nkmJYear(bindj);
  var bwk_cf_an = bwk_cf * Math.pow(1+kstg, bindj);
  var zins_an, tilg_an, rate_an_m;
  var bspar_y_an = 0;
  // V63.38: Fallback wenn anschl_z/anschl_t = 0 — nehme aktuelle Konditionen
  var az_an = az > 0 ? az : d1z;
  var at_an = at > 0 ? at : d1t;

  if (_d1IsAussetzung && State.bsvLifecycle && State.bsvLifecycle.zuteilStatus === 'before_ezb') {
    // V63.54: Zuteilung VOR Bindungsende — Bauspardarlehen läuft schon
    var lc_an = State.bsvLifecycle;
    // Im Jahr bindj+1: Bauspardarlehen-Restschuld geschätzt (vereinfacht volle Summe minus 1J. Tilgung)
    // — für die Karten-Anzeige "Anschluss" reicht das.
    var jahre_seit_zuteil = bindj - lc_an.jahreBisZuteilung + 1;
    var rs_dar = lc_an.bauspardarlehen;
    // Annuität-Verlauf: vereinfachte Approximation
    for (var k = 0; k < jahre_seit_zuteil; k++) {
      var z_k = rs_dar * lc_an.darZ;
      var t_k = lc_an.darRateM * 12 - z_k;
      rs_dar = Math.max(0, rs_dar - t_k);
      if (rs_dar === 0) break;
    }
    zins_an = rs_dar > 0 ? rs_dar * lc_an.darZ : 0;
    tilg_an = rs_dar > 0 ? Math.min(rs_dar, lc_an.darRateM * 12 - zins_an) : 0;
    rate_an_m = rs_dar > 0 ? lc_an.darRateM : 0;
    // Lücken-Anschlussfin. wenn vorhanden
    if (lc_an.luecke > 0) {
      zins_an += lc_an.luecke * az_an;
      tilg_an += lc_an.luecke * at_an;
      rate_an_m = (zins_an + tilg_an) / 12;
    }
  } else if (_d1IsAussetzung && State.bsvLifecycle &&
             State.bsvLifecycle.zuteilStatus === 'at_ezb') {
    // V63.55: Zuteilung exakt zum Bindungsende — Hauptdarlehen wird abgelöst, Bauspardarlehen startet
    var lc_an2 = State.bsvLifecycle;
    var rs_dar2 = lc_an2.bauspardarlehen;
    zins_an = rs_dar2 * lc_an2.darZ;
    tilg_an = Math.min(rs_dar2, lc_an2.darRateM * 12 - zins_an);
    rate_an_m = lc_an2.darRateM;
    // Lücke (falls Bausparsumme < Hauptdarlehen)
    if (lc_an2.luecke > 0) {
      zins_an += lc_an2.luecke * az_an;
      tilg_an += lc_an2.luecke * at_an;
      rate_an_m = (zins_an + tilg_an) / 12;
    }
    bspar_y_an = 0;  // BSV-Vertrag ist erfüllt
  } else {
    // Klassische Anschlussfinanzierung — auch bei BSV mit Zuteilung NACH/NIE
    // V63.60 KONZEPTIONELLER FIX: Bei einem Tilgungsaussetzungsdarlehen mit BSV ist das
    //   Sparguthaben ZWANGSWEISE an den Bausparvertrag gebunden (Mindestquote noch nicht
    //   erreicht — sonst wäre der Status 'before_ezb' oder 'at_ezb' gewesen). Es kann
    //   NICHT als Sondertilgung eingesetzt werden, sondern dient erst zur Ablösung
    //   wenn die Quote erreicht ist (= später, in der Anschluss-Phase).
    //
    //   Korrekte Logik für 'after_ezb' / 'never':
    //   • Hauptdarlehen läuft VOLL als Anschlussfinanzierung weiter (RS = d1)
    //   • BSV-Sparrate läuft WEITER (User muss sie weiterzahlen bis Zuteilung)
    //   • Sparguthaben bleibt im Vertrag — wird separat als Vermögen ausgewiesen
    //
    //   V63.55/58 hatte das fälschlich kombiniert (RS reduziert UND/ODER Sparrate gestoppt) —
    //   das verschönert den CF, entspricht aber nicht der Realität: Im Anschluss zahlt
    //   der User Bank-Rate (auf volle RS!) PLUS Sparrate gleichzeitig.
    var rs_for_anschl;
    if (_d1IsAussetzung && State.bsvLifecycle &&
        (State.bsvLifecycle.zuteilStatus === 'after_ezb' ||
         State.bsvLifecycle.zuteilStatus === 'never')) {
      // RS bleibt voll — Sparguthaben ist gebunden, nicht für Sondertilgung verfügbar
      rs_for_anschl = d1;
      // Sparrate läuft weiter bis tatsächliche Zuteilung (oder Ende Sparphase)
      bspar_y_an = bspar_y;
    } else if (_d1IsAussetzung) {
      rs_for_anschl = d1;
    } else {
      rs_for_anschl = rs_at_bindj;
    }
    // Bei Aussetzung: at_an darf nicht 0 sein (sonst keine Tilgung in Anschluss) — Default 1%
    if (_d1IsAussetzung && at_an === 0) at_an = 0.01;
    zins_an = rs_for_anschl * az_an;
    tilg_an = rs_for_anschl * at_an;
    rate_an_m = (zins_an + tilg_an) / 12;
  }
  // V63.40: CF v.St. = nach Tilgung
  var cf_op_an_operativ = nkm_an - bwk_cf_an - zins_an;          // intern für Steuer
  var ster_an = (cf_op_an_operativ - afa) * grenz;
  var cf_op_an = cf_op_an_operativ - tilg_an - bspar_y_an;       // V63.52
  var cf_ns_an = cf_op_an - ster_an;                             // Banker-CF n.St.
  // KPI color coding
  function setKpiColor(id, val, good, warn){
    var e=document.getElementById(id);if(!e)return;
    e.className='kpi-val '+(val>=good?'gn':val>=warn?'':'rd');
  }
  st('kpi-bmy',fP(bmy));setKpiColor('kpi-bmy',bmy,5,3.5);
  st('kpi-nmy',fP(nmy));setKpiColor('kpi-nmy',nmy,3,2);
  st('kpi-cfm',fE(cf_m,0,true));
  st('kpi-cfvst-heute',fE(cf_op/12,0,true));
  st('kpi-cfvst-ezb',fE(cf_op_ezb/12,0,true));
  st('kpi-cfvst-an',fE(cf_op_an/12,0,true));
  st('sc-an',fE(cf_ns_an,0,true));setKpiColor('kpi-cfm',cf_m,0,-200);
  st('kpi-ltv',fP(ltv,1));setKpiColor('kpi-ltv',100-ltv,15,0);  // <85% green, 85-100 gold, >100 red
  st('kpi-dscr',fN(dscr,2));setKpiColor('kpi-dscr',dscr,1.2,1.0);  // ≥1.2 green, 1.0-1.2 gold, <1.0 red
  st('kpi-fak',fN(fak,1));
  // V63.62: Equity Multiple zeigt ∞ wenn kein EK eingesetzt (Vollfinanzierung)
  st('kpi-em', (ekv <= 100) ? '∞' : fX(em));
  st('sc-today',fE(cf_ns,0,true));st('sc-ezb',fE(cf_ezb,0,true));
  st('sc-exit',fE(exit_vkp-Math.max(0,rs),0,true));
  // V63.35: Initial-Setter für Cashflow-Box (renderCFCalc überschreibt mit Phase-Werten)
  st('cr-wm',fE(wm_j));st('cr-bwk-ul','–'+fE(ul));st('cr-bwk-nul','–'+fE(nul));st('cr-zins','–'+fE(zins_j));
  st('cr-cfop',fE(cf_op,0,true));
  // V63.51: Bei Tilgungsaussetzung "Tilgung" durch Bauspar-Rate ersetzen
  if (_d1IsAussetzung) {
    st('cr-tilg','–'+fE(bspar_y || 0));
    document.querySelectorAll('[data-cr-tilg-label]').forEach(function(elem) { elem.textContent = '– Bausparrate / Jahr'; });
  } else {
    st('cr-tilg','–'+fE(tilg_j));
    document.querySelectorAll('[data-cr-tilg-label]').forEach(function(elem) { elem.textContent = '– Tilgung / Jahr'; });
  }
  st('cr-st',(steuer<0?'+':'–')+fE(Math.abs(steuer)));
  st('cr-cfns',fE(cf_ns,0,true));st('cr-afa',fE(afa));st('cr-zve',fE(zve_immo,0,true));
  st('r-bmy',fP(bmy));st('r-nmy',fP(nmy));st('r-fak',fN(fak,1));
  // V63.62: Bei kein EK eingesetzt → ∞ statt 0/Fehlertext
  st('r-ekr', (ekv <= 100) ? '∞ (kein EK eingesetzt)' : fP(ekr, 1));
  st('r-em',  (ekv <= 100) ? '∞' : fX(em));
  st('r-dscr2',fN(dscr,2));
  st('r-dscr-netto',fN(dscr_netto,2));
  st('r-ltv2',fP(ltv,1));
  st('r-wpuff',wp_kpi!==0?fE(wp_kpi,0,true):'Kein Verkehrswert');st('r-zaer-kpi',fE(zaer_m,0)+'/Mon.');
  // V63.36: Vermögenszuwachs-Aufschlüsselung
  // Mieter-Anteil: Anteil der Tilgung der durch Mieteinnahmen finanziert wurde
  var tilg_durch_einnahmen = Math.min(tilgung_kum, Math.max(0, cfkum + tilgung_kum));
  var tilg_eigenanteil = Math.max(0, tilgung_kum - tilg_durch_einnahmen);
  st('vz-jahre', btj.toString());
  st('vz-jahre2', btj.toString());
  st('vz-jahre3', btj.toString());
  st('vz-jahre4', btj.toString());
  st('vz-jahre5', btj.toString());
  st('vz-info-jahre-pow', btj.toString());
  st('vz-tilgung', fE(tilgung_kum, 0, true));
  st('vz-eigen', fE(tilg_eigenanteil, 0, true));
  st('vz-mieter', fE(tilg_durch_einnahmen, 0, true));
  // V63.88: Tab Kennzahlen Vermögenszuwachs zeigt jetzt die 4 Komponenten konsistent zu Charts:
  //   - Tilgung-vom-Mieter (statt nur tilgung_kum)
  //   - CF-Überschuss Konto (Math.max(0, cfns_y) summiert, NACH Tilgung & Steuer = 16.317)
  //   - Steuervorteil (separater Block)
  //   - Wertsteigerung
  // Σ = verm_zuwachs_v88 → Tab und Charts identisch.
  // V118: _cf_konto_pre SIGNED — bei dauerhaft negativem CF wird Verlust angezeigt
  //       (Marcels Bäckerstr.7-Bug überall durchziehen).
  var _cf_konto_pre = 0, _tax_pre = 0;
  if (State.cfRows && State.cfRows.length) {
    State.cfRows.forEach(function(r){
      _cf_konto_pre += (r.cfns_y || 0);  // V118 signed
      _tax_pre += (r.tax_y || 0);
    });
  }
  var _stv_pre_signed = -_tax_pre;
  // V118: vz-cf-Hauptzeile signed Anzeige
  var _vzCfEl = document.getElementById('vz-cf');
  if (_vzCfEl) {
    if (_cf_konto_pre >= 0) {
      _vzCfEl.textContent = fE(_cf_konto_pre, 0, true);
      _vzCfEl.classList.remove('c-red');
      _vzCfEl.classList.add('c-green');
    } else {
      _vzCfEl.textContent = '– ' + fE(Math.abs(_cf_konto_pre), 0);
      _vzCfEl.classList.remove('c-green');
      _vzCfEl.classList.add('c-red');
    }
    // Label dynamisch ("+ Cashflow-Überschuss" ↔ "− Cashflow-Verlust")
    var _vzCfLabel = _vzCfEl.parentElement && _vzCfEl.parentElement.querySelector('span');
    if (_vzCfLabel) {
      if (_cf_konto_pre >= 0) {
        _vzCfLabel.innerHTML = '+ Cashflow-Überschuss <span class="cf-hint">(was nach Tilgung &amp; Steuer auf Konto bleibt)</span>';
      } else {
        _vzCfLabel.innerHTML = '− Cashflow-Verlust <span class="cf-hint">(Eigenmittel müssen über die Laufzeit zugeschossen werden)</span>';
      }
    }
  }
  // V118: vz-steuer signed Anzeige
  var _vzStvElPre = document.getElementById('vz-steuer');
  if (_vzStvElPre) {
    if (_stv_pre_signed >= 0) {
      _vzStvElPre.textContent = fE(_stv_pre_signed, 0, true);
      _vzStvElPre.classList.remove('c-red');
      _vzStvElPre.classList.add('c-green');
    } else {
      _vzStvElPre.textContent = '– ' + fE(Math.abs(_stv_pre_signed), 0);
      _vzStvElPre.classList.remove('c-green');
      _vzStvElPre.classList.add('c-red');
    }
  }
  // V63.58: Sparguthaben-Zeile nur einblenden wenn BSV aktiv
  var _vzBsparRow = document.getElementById('vz-bspar-row');
  if (_vzBsparRow) {
    if (bspar_kum > 0) {
      _vzBsparRow.style.display = '';
      st('vz-bspar', fE(bspar_kum, 0, true));
    } else {
      _vzBsparRow.style.display = 'none';
    }
  }
  st('vz-wert', fE(Math.max(0, wertsteig_kum), 0, true));
  // V118: vz-gesamt wird unten mit verm_zuwachs_v88 (signed!) inkl. Farbe gesetzt — hier nicht mehr nötig
  st('vz-em', ekv > 0 ? fX(em) : '—');
  // V63.86: Werte auf State exposen damit Charts (Wasserfall, Equity-Build) sie nutzen können.
  // Single-Source-of-Truth — die Charts dürfen NIE eigene Werte rechnen.
  // V63.88: Komponenten klarer benannt. Marcels Wunsch: beide Charts zeigen
  // die EXAKT GLEICHEN 4 Bausteine deren Summe = verm_zuwachs.
  //
  // Die 4 Komponenten sind:
  //   1. tilg_durch_einnahmen  (Tilgung-vom-Mieter, = formal tilgung_kum bei pos cfkum)
  //   2. cf_ueberschuss_konto  (was nach Tilgung+Steuer auf Konto bleibt — V118: SIGNED!
  //                             kann negativ sein wenn der CF dauerhaft Verlust macht)
  //   3. steuervorteil         (V118: SIGNED — positiv = Erstattung, negativ = Belastung)
  //   4. wertsteig_kum         (Marktwert-Steigerung)
  //
  // V118 Marcels Bäckerstr.7-Fix erweitert: _cf_konto_kum darf NICHT mehr Math.max(0, …)
  // pro Jahr filtern — bei durchgängig negativem CF (Bäckerstr.7) gab das fälschlich 0 €
  // im Vermögenszuwachs, obwohl die App eindeutig Verlust ausweist.
  var _cf_konto_kum = 0;
  var _tax_kum_signed = 0;
  if (State.cfRows && State.cfRows.length) {
    State.cfRows.forEach(function(r){
      // V118: SIGNED — alle Jahre einbeziehen (positive UND negative)
      _cf_konto_kum += (r.cfns_y || 0);
      _tax_kum_signed += (r.tax_y || 0);
    });
  }
  // Steuer-Komponente: V118 signed (nicht mehr mit Math.max(0, ...) abgeschnitten).
  // Negativer Steuervorteil-Wert = Belastung kumuliert → mindert verm_zuwachs.
  var _steuervorteil_signed = -_tax_kum_signed;
  // Legacy-Variable für Backward-Kompat in Charts/PDF (positiv-only)
  var _steuervorteil = Math.max(0, _steuervorteil_signed);

  // V118: Vermögenszuwachs kann jetzt KLEINER werden wenn CF dauerhaft negativ.
  //   Das ist ehrlicher — wenn der User kumuliert Geld zuschießen muss, ist das
  //   keine Vermögensbildung mehr.
  var verm_zuwachs_v88 = tilg_durch_einnahmen + bspar_durch_einnahmen + _cf_konto_kum + _steuervorteil_signed + Math.max(0, wertsteig_kum);

  State._vz = {
    // Komponente 1
    tilg_durch_einnahmen: tilg_durch_einnahmen,
    bspar_durch_einnahmen: bspar_durch_einnahmen,
    tilgung_kum:        tilgung_kum,
    tilg_eigenanteil:   tilg_eigenanteil,
    bspar_kum:          bspar_kum,
    // Komponente 2
    cf_ueberschuss_konto: _cf_konto_kum,
    cf_ueberschuss:     cf_ueberschuss,           // legacy: Math.max(0, cfkum) - vor Tilgung
    cfkum:              cfkum,                     // raw, kann negativ sein
    // Komponente 3
    steuervorteil:      _steuervorteil,
    tax_kum:            _tax_kum_signed,
    // Komponente 4
    wertsteig_kum:      Math.max(0, wertsteig_kum),
    // Total — V63.88: NEU berechnet aus den 4 Komponenten
    verm_zuwachs:       verm_zuwachs_v88,
    // Misc
    em:                 ekv > 0 ? verm_zuwachs_v88 / ekv : 0,
    btj:                btj
  };
  // V118: vz-gesamt zeigt verm_zuwachs_v88 — kann jetzt negativ sein (Marcels Bäckerstr.7)
  //   Bei Verlust → rot mit Minus + Label-Wechsel.
  var _vzGesElInit = document.getElementById('vz-gesamt');
  if (_vzGesElInit) {
    if (verm_zuwachs_v88 >= 0) {
      _vzGesElInit.textContent = fE(verm_zuwachs_v88, 0, true);
      _vzGesElInit.classList.remove('c-red');
      _vzGesElInit.classList.add('c-gold');
    } else {
      _vzGesElInit.textContent = '– ' + fE(Math.abs(verm_zuwachs_v88), 0);
      _vzGesElInit.classList.remove('c-gold', 'c-green');
      _vzGesElInit.classList.add('c-red');
    }
  }
  // V63.52: BSV-Summary-Card (nur bei Tilgungsaussetzung)
  var bsvCard = el('bsv-summary-card');
  if (bsvCard) {
    var lc = State.bsvLifecycle;
    if (_d1IsAussetzung && lc && lc.bsparSum > 0) {
      bsvCard.style.display = '';
      st('bsv-ziel', fE(lc.bsparSum, 0));
      st('bsv-rate-m', fE(lc.bsparRateM, 0));
      st('bsv-rate-j', fE(lc.bsparRateM * 12, 0));
      // V63.54: "Jahre bis Zuteilung" + "Mindestguthaben"
      st('bsv-jahre', lc.jahreBisZuteilung > 0 ? String(lc.jahreBisZuteilung) : '—');
      st('bsv-zins-pct', (lc.bsparZins * 100).toFixed(2).replace('.', ','));
      // Eingezahlt bis Zuteilung (ohne Verzinsung) vs. Guthaben (mit Verzinsung)
      var eingezahlt_total = lc.monateBisZuteilung > 0 ? lc.monateBisZuteilung * lc.bsparRateM : 0;
      st('bsv-eingez-ezb', fE(eingezahlt_total, 0));
      st('bsv-guth-ezb', fE(lc.guthabenBeiZuteilung, 0));
      st('bsv-rs-ezb', fE(lc.d1, 0));
      // Save für PDF
      // V66: deckungPct = min(100, abloseSumme / d1 * 100) — Restschuld d1 = lc.d1
      var _deckPctV66 = (lc.d1 > 0)
        ? Math.min(100, (lc.guthabenBeiZuteilung + lc.bauspardarlehen) / lc.d1 * 100)
        : 0;
      State.bsvSummary = {
        zielsumme: lc.bsparSum,
        rateMon: lc.bsparRateM,
        rateJahr: lc.bsparRateM * 12,
        jahre: lc.jahreBisZuteilung,
        zinsPct: lc.bsparZins,
        eingezahlt: eingezahlt_total,
        guthaben: lc.guthabenBeiZuteilung,
        bauspardarlehen: lc.bauspardarlehen,
        abloseSumme: lc.abloseSumme,
        restschuld: lc.d1,
        luecke: lc.luecke,
        zuteilStatus: lc.zuteilStatus,
        zuteilDate: lc.zuteilDate,
        darRateM: lc.darRateM,
        darVolltilgJ: lc.darVolltilgJahre,
        darZ: lc.darZ,
        darT: lc.darT,
        deckungPct: _deckPctV66
      };
      // Deckung-Label dynamisch
      var deckEl = el('bsv-deckung');
      if (deckEl) {
        if (lc.zuteilStatus === 'never') {
          deckEl.textContent = '⚠ Zuteilung mit aktueller Sparrate nicht erreichbar';
          deckEl.className = 'kv-v c-red';
        } else if (lc.luecke > 0) {
          deckEl.textContent = '⚡ Lücke ' + fE(lc.luecke, 0) + ' — Anschlussfinanzierung erforderlich';
          deckEl.className = 'kv-v c-gold';
        } else {
          var statusTxt;
          if (lc.zuteilStatus === 'before_ezb') statusTxt = '✓ Voll gedeckt — Zuteilung vor Bindungsende';
          else if (lc.zuteilStatus === 'at_ezb') statusTxt = '✓ Voll gedeckt — Zuteilung exakt zum Bindungsende';
          else statusTxt = '⚡ Voll gedeckt — Zuteilung nach Bindungsende';
          deckEl.textContent = statusTxt;
          deckEl.className = 'kv-v ' + (lc.zuteilStatus === 'after_ezb' ? 'c-gold' : 'c-green');
        }
      }
    } else {
      bsvCard.style.display = 'none';
      State.bsvSummary = null;
    }
  }
  // V63.39: CF-Erklärungs-Aufstellung
  // V63.90: Tilgung mit ausweisen, damit Endsumme zur Hauptzeile "+ Cashflow-Überschuss"
  //         (= cf_ueberschuss_konto = NACH Tilgung & Steuer auf Konto) passt.
  st('vz-info-miete', fE(miete_kum, 0));
  st('vz-info-bwk', '–' + fE(bwk_kum, 0));
  st('vz-info-zins', '–' + fE(zins_kum, 0));
  // V63.90: tilgung_kum (= d1 - rs_loop, Brutto-Tilgung über die Laufzeit)
  st('vz-info-tilg', '–' + fE(Math.max(0, tilgung_kum), 0));
  // Bauspar-Sparbeiträge (gebunden) nur wenn vorhanden
  var _vzInfoBsparEl = document.getElementById('vz-info-bspar-row');
  if (_vzInfoBsparEl) {
    if (bspar_kum > 0) {
      _vzInfoBsparEl.style.display = '';
      st('vz-info-bspar', '–' + fE(bspar_kum, 0));
    } else {
      _vzInfoBsparEl.style.display = 'none';
    }
  }
  st('vz-info-tax', (tax_kum < 0 ? '+' : '–') + fE(Math.abs(tax_kum), 0));
  // V117 — Summe ist die ECHTE arithmetische Summe der Posten oben.
  //   Vorher: Σ max(0, cfns_y) → bei durchgängig negativen Jahren (Marcels Bäckerstr.7
  //   Minden, alle 15 Jahre cfns_y < 0) wurde das zu 0 € — inkonsistent mit den
  //   einzelnen Posten oben (-110k mathematisch sichtbar). User las "0 € Überschuss"
  //   obwohl die Aufschlüsselung klar Verlust zeigte.
  //
  //   Neu: Summe = miete - bwk - zins - tilg - bspar - tax_kum (signed).
  //   Bei Verlust → rot + Label-Wechsel auf "= Kumulierter CF-Verlust (Eigenmittel zuschießen)".
  //   Bei Überschuss → gold/grün + "= Kumulierter CF-Überschuss (Konto-Reserve)".
  var _vzSummeEcht =
    (miete_kum || 0) -
    (bwk_kum || 0) -
    (zins_kum || 0) -
    Math.max(0, tilgung_kum || 0) -
    (bspar_kum || 0) -
    (tax_kum || 0);
  var _vzSummeEl = document.getElementById('vz-info-summe');
  if (_vzSummeEl) {
    if (_vzSummeEcht >= 0) {
      _vzSummeEl.textContent = fE(_vzSummeEcht, 0, true);
      _vzSummeEl.classList.remove('c-red');
      _vzSummeEl.classList.add('c-gold');
    } else {
      _vzSummeEl.textContent = '– ' + fE(Math.abs(_vzSummeEcht), 0);
      _vzSummeEl.classList.remove('c-gold', 'c-green');
      _vzSummeEl.classList.add('c-red');
    }
    // Label-Text in der Result-Zeile dynamisch anpassen
    var _vzSummeLabelEl = _vzSummeEl.parentElement && _vzSummeEl.parentElement.querySelector('span');
    if (_vzSummeLabelEl) {
      if (_vzSummeEcht >= 0) {
        _vzSummeLabelEl.innerHTML = '<b>= Kumulierter CF-Überschuss <span class="cf-hint">(Konto-Reserve nach Tilgung &amp; Steuer)</span></b>';
      } else {
        _vzSummeLabelEl.innerHTML = '<b>= Kumulierter CF-Verlust <span class="cf-hint">(Eigenmittel müssen über die Laufzeit zugeschossen werden)</span></b>';
      }
    }
  }
  // V63.41: Wertsteigerungs-Erklärungs-Aufstellung
  // V63.69: Anker konsistent mit Charts/Phasentabelle: wert_basis (svw > bankval > kp)
  var wstg_pct = wstg * 100;
  var wstg_factor = Math.pow(1 + wstg, btj);
  st('vz-info-kp', fE(wert_basis, 0));
  st('vz-info-wstg', wstg_pct.toFixed(2).replace('.', ',') + ' %');
  st('vz-info-faktor', wstg_factor.toFixed(4).replace('.', ','));
  st('vz-info-endwert', fE(wert_endjahr, 0));
  st('vz-info-kp2', '–' + fE(wert_basis, 0));
  st('vz-info-wstgkum', fE(wertsteig_kum, 0, true));
  // V63.42: Plausi-Check Mieten + Annahmen sichtbar machen
  var mstg_pct = mstg * 100;
  var kstg_pct = kstg * 100;
  st('vz-info-mstg-pct', mstg_pct.toFixed(1).replace('.', ','));
  st('vz-info-kstg-pct', kstg_pct.toFixed(1).replace('.', ','));
  st('vz-plausi-nkm', fE(nkm_j, 0));
  st('vz-plausi-jahre', btj.toString());
  st('vz-plausi-statisch', fE(nkm_j * btj, 0));
  st('vz-plausi-mstg', mstg_pct.toFixed(1).replace('.', ','));
  st('vz-plausi-mit', fE(miete_kum, 0));
  State.kpis={bmy:bmy,nmy:nmy,fak:fak,em:em,ekr:ekr,dscr:dscr,dscr_netto:dscr_netto,noi_dscr:noi_dscr,kd_dscr:kd_dscr,ltv:ltv,cf_op:cf_op,cf_ns:cf_ns,cf_m:cf_m,cf_ezb:cf_ezb,cf_op_ezb:cf_op_ezb,cf_ns_ezb:cf_ns_ezb,zins_ezb:zins_ezb,tilg_ezb:tilg_ezb,bspar_ezb:bspar_y_ezb,bwk_ezb:bwk_ezb,wm_ezb:wm_ezb,nkm_ezb:nkm_ezb,bwk_cf_ezb:bwk_cf_ezb,ster_ezb:ster_ezb,afa_ezb:afa,cf_op_an:cf_op_an,cf_ns_an:cf_ns_an,zins_an:zins_an,tilg_an:tilg_an,bspar_an:bspar_y_an,wm_an:wm_an,bwk_an:bwk_an,nkm_an:nkm_an,bwk_cf_an:bwk_cf_an,rate_an_m:rate_an_m,ster_an:ster_an,exit_vkp:exit_vkp,wm_j:wm_j,nkm_j:nkm_j,bwk:bwk,bwk_cf:bwk_cf,zins_j:zins_j,tilg_j:tilg_j,bspar_j:bspar_y,steuer:steuer,afa:afa,zve_immo:zve_immo,zaer_m:zaer_m,zaer_pct:zaer_pct,wp_kpi:wp_kpi,d1:d1,ek:ekv,gi:gi,kp:kp,bwk_ul:ul,bwk_nul:nul,d1z_pct:d1z*100,d1t_pct:d1t*100,d1IsAussetzung:_d1IsAussetzung};
  State.cfRows=[];var rs3=d1;
  st('proj-lbl','('+btj+' Jahre · '+new Date().getFullYear()+'–'+(new Date().getFullYear()+btj-1)+')');
  // V63.58: Hinweis wenn Mietsteigerung 0 — User merkt sonst nicht, dass NKM konstant bleibt
  var _mstgHint = document.getElementById('proj-mstg-hint');
  if (_mstgHint) {
    _mstgHint.textContent = mstg > 0
      ? '· Mietsteigerung ' + (mstg*100).toFixed(1).replace('.', ',') + ' % p.a. wirkt'
      : '· ⚠ Mietsteigerung 0 % — NKM bleibt konstant (siehe Tab Miete)';
    _mstgHint.style.color = mstg > 0 ? 'var(--muted)' : 'var(--gold-d)';
  }
  st('chart-lbl',btj+' Jahre');
  // V63.38: Anschluss-Konditionen mit Fallback auf aktuelle Werte (falls anschl_z=0)
  var az_eff = az > 0 ? az : d1z;       // Anschluss-Zins, Fallback = aktueller Zins
  var at_eff = at > 0 ? at : d1t;       // Anschluss-Tilgung, Fallback = aktuelle Tilgung
  var anschl_rate_eff = az_eff + at_eff;
  // V63.54: Bei Tilgungsaussetzung mit BSV — Lifecycle-aware
  var lc_proj = State.bsvLifecycle;
  // Tracking-Vars für BSV-Phasen
  var rs_dar_proj = 0;       // Bauspardarlehen-Restschuld (nach Zuteilung)
  var rs_luecke_proj = 0;    // Anschlussfin.-Lücke wenn vorhanden
  var bsv_zuteil_jahr = (lc_proj && lc_proj.jahreBisZuteilung > 0) ? lc_proj.jahreBisZuteilung : 999;
  // V63.64: kumuliertes Sparguthaben pro Jahr — für Bank-Charts (Equity-Aufbau, Waterfall)
  var bspar_kum_proj = 0;

  for(var y=1;y<=btj;y++){
    var cal=new Date().getFullYear()+y-1;
    // V63.35: Excel-Logik — CF auf NKM gegen NUL (UL durchlaufend)
    // V63.61 BUGFIX: Off-by-One in Mietsteigerung. Jahr 1 (= heute, aktuelles Kalenderjahr)
    // soll mit den AKTUELLEN Mieten arbeiten, nicht schon mit 1 Jahr Steigerung.
    // _mFac(0) = 1.0 → keine Steigerung im ersten Jahr; Jahr 2 hat dann _mFac(1) etc.
    // Vorher: y=1 → _mFac(1) → schon +1 Jahr Steigerung → CF v.St. höher als 'Heute'-Karte
    var nkm_y2=nkm_j*_mFac(y-1),wm_y2=wm_j*_mFac(y-1),bwk_y2=bwk*Math.pow(1+kstg,y-1);
    var bwk_cf_y2=bwk_cf*Math.pow(1+kstg,y-1);

    var zy2, ty2, bspar_y2;

    if (_d1IsAussetzung && lc_proj) {
      // V63.54/55: Tilgungsaussetzung mit BSV-Lifecycle
      // V63.60 KONZEPTIONELLER FIX: Bei 'after_ezb'/'never' darf das Sparguthaben
      // NICHT als Sondertilgung herangezogen werden — es ist im Bausparvertrag gebunden,
      // bis die Mindestsparquote erreicht ist. RS bleibt voll, Sparrate läuft weiter.
      var _isLockedBSV = (lc_proj.zuteilStatus === 'after_ezb' || lc_proj.zuteilStatus === 'never');
      var anschluss_started = (y > bindj && lc_proj.zuteilStatus !== 'before_ezb' && lc_proj.zuteilStatus !== 'at_ezb');
      if (anschluss_started && rs3 === d1 && !_isLockedBSV) {
        // V63.55: Wechsel zur Anschlussfinanzierung — Sparguthaben mindert RS nur wenn
        // BSV bereits zugeteilt ist (was bei after_ezb/never gerade NICHT der Fall ist)
        var rMon_loop = lc_proj.bsparZins / 12;
        var nMon_loop = bindj * 12;
        var sparguth_ezb_loop = rMon_loop > 0
          ? lc_proj.bsparRateM * (Math.pow(1 + rMon_loop, nMon_loop) - 1) / rMon_loop
          : lc_proj.bsparRateM * nMon_loop;
        rs3 = Math.max(0, d1 - sparguth_ezb_loop);
      }

      if (y < bsv_zuteil_jahr && y <= bindj) {
        // Sparphase während Zinsbindung: Hauptdarlehen läuft mit reinen Zinsen, BSV wird angespart
        zy2 = rs3 * d1z;          // Zinsen auf voller Restschuld
        ty2 = 0;                   // Keine Tilgung
        bspar_y2 = lc_proj.bsparRateM * 12;  // BSV-Sparrate fließt ab
        // rs3 bleibt unverändert
      } else if (y === bsv_zuteil_jahr) {
        // ZUTEILUNGSJAHR: Sparphase noch teilweise + Ablösung im Laufe des Jahres
        // Vereinfacht: ganzes Jahr Spar+Zinsen + zum Jahresende Ablösung
        if (y <= bindj) {
          zy2 = rs3 * d1z;
          ty2 = 0;
          bspar_y2 = lc_proj.bsparRateM * 12;
        } else {
          // Anschlussfinanzierung war schon aktiv, jetzt kommt BSV-Zuteilung
          zy2 = rs3 * az_eff;
          var rate_anschl_zuteil = rs3 * (az_eff + at_eff);
          ty2 = Math.max(0, rate_anschl_zuteil - zy2);
          bspar_y2 = lc_proj.bsparRateM * 12;
        }
        // Hauptdarlehen wird abgelöst, Bauspardarlehen startet, ggf. Lücke
        rs_dar_proj = lc_proj.bauspardarlehen;
        rs_luecke_proj = Math.max(0, rs3 - lc_proj.guthabenBeiZuteilung - lc_proj.bauspardarlehen);
        rs3 = rs_dar_proj + rs_luecke_proj;
      } else if (y > bsv_zuteil_jahr) {
        // Bauspardarlehens-Phase: Bauspar-Annuität + ggf. Anschluss-Lücke
        var z_dar = rs_dar_proj > 0 ? rs_dar_proj * lc_proj.darZ : 0;
        var t_dar = rs_dar_proj > 0 ? Math.min(rs_dar_proj, lc_proj.darRateM * 12 - z_dar) : 0;
        rs_dar_proj = Math.max(0, rs_dar_proj - t_dar);
        // Lücke (Anschluss-Konditionen)
        var z_luc = rs_luecke_proj > 0 ? rs_luecke_proj * az_eff : 0;
        var t_luc = 0;
        if (rs_luecke_proj > 0) {
          var rate_luecke = rs_luecke_proj * (az_eff + at_eff);
          t_luc = Math.max(0, Math.min(rs_luecke_proj, rate_luecke - z_luc));
          rs_luecke_proj = Math.max(0, rs_luecke_proj - t_luc);
        }
        zy2 = z_dar + z_luc;
        ty2 = t_dar + t_luc;
        bspar_y2 = 0;  // Sparrate weg, ist jetzt Bauspardarlehens-Rate (in zy2+ty2)
        rs3 = rs_dar_proj + rs_luecke_proj;
      } else {
        // y > bindj UND y < bsv_zuteil_jahr (after_ezb): klassische Anschlussfinanzierung
        // mit reduzierter Restschuld. BSV-Sparrate läuft weiter bis tatsächl. Zuteilung.
        zy2 = rs3 * az_eff;
        var rate_anschl_after = rs3 * (az_eff + at_eff);
        ty2 = Math.max(0, rate_anschl_after - zy2);
        if (ty2 > rs3) ty2 = rs3;
        bspar_y2 = lc_proj.bsparRateM * 12;
        rs3 = Math.max(0, rs3 - ty2);
      }
    } else {
      // V63.38: Klassische Annuität (auch ohne BSV) - V63.51: bspar_y2 bleibt 0
      bspar_y2 = 0;
      if (y <= bindj) {
        zy2 = rs3 * d1z;
        ty2 = d1_rate_m * 12 - zy2;
      } else if (rs3 > 0) {
        // Anschluss-Phase: Annuität bleibt konstant
        zy2 = rs3 * az_eff;
        var rate_anschl = State.rs * anschl_rate_eff;  // konstante Jahresannuität
        ty2 = Math.max(0, rate_anschl - zy2);
        if (ty2 > rs3) { ty2 = rs3; }
      } else {
        zy2 = 0; ty2 = 0;
      }
      rs3 = Math.max(0, rs3 - ty2);
    }

    var cfop_y_operativ = nkm_y2 - bwk_cf_y2 - zy2;       // intern: für Steuerbemessung
    var cfop_y = cfop_y_operativ - ty2 - bspar_y2;         // V63.40/51/54: CF v.St. = nach Tilgung & BSV
    // V63.83: KONSISTENZ-FIX
    // Cashflow-Projektion zeigt jetzt EINHEITLICH die Quick-Methode (Steuer auf V+V-Ergebnis nach AfA),
    // konsistent zur Cashflow-Vergleich-Heute-Box. Das Steuermodul kann mit Yearly-Overrides arbeiten,
    // beeinflusst aber NICHT mehr die Cashflow-Projektion-Tabelle.
    // Begründung: Vorher griff in der Projektion das Yearly-Total mit potenziell anderen Schuldzinsen
    // (z.B. nach Anschluss-Phase) oder unfertigen cfRows-Daten → produzierte inkonsistente Werte.
    // Nun ist Frontend Cashflow-Vergleich-Heute, Cashflow-Projektion und PDF überall identisch.
    var taxEffect_y = (cfop_y_operativ - afa) * grenz;
    var cfns_y = cfop_y - taxEffect_y;                     // V63.40: nach Tilgung, BSV & Steuer
    // V63.65: Wertsteigerung ausgehend vom besten Wert-Anker (svw > bankval > kp)
    // V63.83 KOMMENTAR: wert_y zeigt Stand ANFANG Jahr y → Jahr 1 = heute = ^0
    //   Endwert (Stand nach btj Jahren) wird in der Equity-Build-Box separat als
    //   wert_basis × (1+wstg)^btj berechnet. PDF muss konsistent dazu rechnen.
    var wert_y=wert_basis*Math.pow(1+wstg,y-1),eq_y=wert_y-rs3,ltv_y=wert_y>0?rs3/wert_y*100:0;
    // V63.64: Kumuliertes Sparguthaben tracken (für Bank-Charts: Equity-Aufbau, Waterfall)
    bspar_kum_proj += (bspar_y2 || 0);
    // Effektive Restschuld = formal aufgenommen MINUS bereits angespartes BSV-Guthaben.
    // Sinn: User sieht in Charts die "wirtschaftliche" Schuld, die ihn am Ende noch belastet.
    // Bei Standard-Annuität ohne BSV ist eff_rs == rs.
    var eff_rs = Math.max(0, rs3 - bspar_kum_proj);
    State.cfRows.push({y:y,cal:cal,nkm_m:nkm_y2/12,wm_m:wm_y2/12,nkm_y:nkm_y2,bwk_y:bwk_y2,bwk_cf_y:bwk_cf_y2,zy:zy2,ty:ty2,bspar_y:bspar_y2,bspar_kum:bspar_kum_proj,eff_rs:eff_rs,cfop_y:cfop_y,cfns_y:cfns_y,wm_y:wm_y2,rs:rs3,wert_y:wert_y,eq_y:eq_y,ltv_y:ltv_y,tax_y:taxEffect_y});
  }
  // V111 STEUER-KONSISTENZ-FIX (V113 erweitert): Cashflow-Tabelle, CF-Projektion, Steuerverlauf,
  //   Vermögenszuwachs-Aufschlüsselung und CF-Vergleich-Heute/EZB/Anschluss müssen identische
  //   Steuer-Werte zeigen. Single Source of Truth: _computeYearTotal() (= das was auch
  //   Steuerverlauf und Steuerformular nutzen).
  //
  //   Quick-Methode `(cfop_y_operativ - afa) * grenz` ignoriert Sanierung, Möblierung,
  //   umlagefähige NK, Verwaltungs-Splits, Kontoführung etc. Daher die Abweichungen die
  //   Marcel beobachtete (CF-Tabelle 84 € vs Steuerverlauf andere Werte; Vermögenszuwachs
  //   "Steuerbelastung -3.317" vs Steuerverlauf "+781 Erstattung über 10 Jahre").
  if (typeof _computeYearTotal === 'function' && typeof Tax !== 'undefined') {
    try {
      // (1) cfRows.tax_y und cfRows.cfns_y überschreiben
      // V119: Während wir cfRows neu rechnen, summieren wir auch die einzelnen
      //   Komponenten (Miete/BWK/Zins/Tilg/BSpar) konsistent aus cfRows. Damit ist
      //   die Aufschlüsselung exakt = Hauptzeile (= Σ cfns_y). Vorher kam die
      //   Aufschlüsselung aus der ersten Schleife mit Quick-Methode, deshalb wich
      //   sie ~62k von der Hauptzeile ab (Marcels Bäckerstr.7-Bug).
      var _taxKumNew = 0;
      var _mieteKumNew = 0, _bwkKumNew = 0, _zinsKumNew = 0;
      var _tilgKumNew  = 0, _bsparKumNew = 0;
      State.cfRows.forEach(function(r, idx) {
        var totals = _computeYearTotal(r.cal, idx);
        if (totals && typeof totals.taxDelta === 'number' && !isNaN(totals.taxDelta)) {
          r.tax_y = totals.taxDelta;
          r.cfns_y = r.cfop_y - r.tax_y;
        }
        _taxKumNew += (r.tax_y || 0);
        // V119: Komponenten konsistent zu cfns_y akkumulieren
        _mieteKumNew += (r.nkm_y || 0);
        _bwkKumNew   += (r.bwk_cf_y || r.bwk_y || 0);
        _zinsKumNew  += (r.zy || 0);
        _tilgKumNew  += (r.ty || 0);
        _bsparKumNew += (r.bspar_y || 0);
      });

      // (2) State.kpis.steuer (Year 1) und cf_ns für CF-Vergleich-Heute
      if (State.kpis && State.cfRows[0]) {
        State.kpis.steuer = State.cfRows[0].tax_y;
        State.kpis.cf_ns  = State.cfRows[0].cfns_y;
        State.kpis.cf_m   = (State.cfRows[0].cfop_y || 0) / 12;  // unverändert
      }

      // (3) State.kpis.ster_ezb (Year bindj) für CF-Vergleich-Ende-Zinsbindung
      if (State.kpis && State.bindj) {
        var ezbIdx = Math.min((State.bindj || 1) - 1, State.cfRows.length - 1);
        if (State.cfRows[ezbIdx]) {
          State.kpis.ster_ezb  = State.cfRows[ezbIdx].tax_y;
          State.kpis.cf_ns_ezb = State.cfRows[ezbIdx].cfns_y;
        }
      }

      // (4) State.kpis.ster_an (Year bindj+1) für CF-Vergleich-Anschluss
      if (State.kpis && State.bindj) {
        var anIdx = Math.min(State.bindj || 1, State.cfRows.length - 1);
        if (State.cfRows[anIdx]) {
          State.kpis.ster_an  = State.cfRows[anIdx].tax_y;
          State.kpis.cf_ns_an = State.cfRows[anIdx].cfns_y;
        }
      }

      // (5) Vermögenszuwachs-Anzeigen aus _taxKumNew nachziehen
      //     vz-info-tax: V116 — signed Anzeige + Farbe.
      //                  Negativ (= Erstattung) → "+ N €" grün
      //                  Positiv (= Belastung)  → "− N €" rot
      //                  Vorher fehlte die Farbe komplett (Marcels Beobachtung).
      //     vz-steuer:   V116 — signed Anzeige. Bei Erstattung grün "+", bei Belastung rot "−".
      //                  Vorher zeigte das Feld "0" wenn die Summe eine Belastung war (Marcels Bug).
      var _vzTaxEl = document.getElementById('vz-info-tax');
      if (_vzTaxEl) {
        if (_taxKumNew < 0) {
          // Erstattung kumuliert
          _vzTaxEl.textContent = '+ ' + fE(Math.abs(_taxKumNew), 0);
          _vzTaxEl.classList.remove('c-red');
          _vzTaxEl.classList.add('c-green');
        } else if (_taxKumNew > 0) {
          // Belastung kumuliert
          _vzTaxEl.textContent = '− ' + fE(Math.abs(_taxKumNew), 0);
          _vzTaxEl.classList.remove('c-green');
          _vzTaxEl.classList.add('c-red');
        } else {
          _vzTaxEl.textContent = fE(0, 0);
          _vzTaxEl.classList.remove('c-red', 'c-green');
        }
      }
      // V116: vz-steuer-Hauptzeile + Label dynamisch
      var _vzStvEl = document.getElementById('vz-steuer');
      if (_vzStvEl) {
        if (_taxKumNew < 0) {
          // Erstattung → grün, +
          _vzStvEl.textContent = '+ ' + fE(Math.abs(_taxKumNew), 0);
          _vzStvEl.classList.remove('c-red');
          _vzStvEl.classList.add('c-green');
        } else if (_taxKumNew > 0) {
          // Belastung → rot, −
          _vzStvEl.textContent = '– ' + fE(Math.abs(_taxKumNew), 0);
          _vzStvEl.classList.remove('c-green');
          _vzStvEl.classList.add('c-red');
        } else {
          _vzStvEl.textContent = fE(0, 0, true);
          _vzStvEl.classList.remove('c-red');
          _vzStvEl.classList.add('c-green');
        }
        // Label-Text neben dem Wert ("+ Steuervorteil" ↔ "− Steuerbelastung")
        var _vzStvLabel = _vzStvEl.parentElement && _vzStvEl.parentElement.querySelector('span');
        if (_vzStvLabel) {
          if (_taxKumNew > 0) {
            _vzStvLabel.innerHTML = '− Steuerbelastung <span class="cf-hint">(kumulierte Mehrsteuer über die Laufzeit)</span>';
          } else {
            _vzStvLabel.innerHTML = '+ Steuervorteil <span class="cf-hint">(kumulierte Erstattung aus V+V-Verlusten)</span>';
          }
        }
      }
      // V117: vz-info-summe (echte Aufschlüsselungs-Summe) mit _taxKumNew nachziehen.
      //   Sonst greift hier der Quick-Methode-Wert tax_kum aus der ersten Schleife.
      // V119: Marcels Bäckerstr.7-Bug — Hauptzeile zeigte -156k, Aufschlüsselung -218k.
      //   Ursache: Komponenten kamen aus der ersten Schleife (Quick), Hauptzeile aus cfRows.
      //   Fix: Komponenten alle aus cfRows nehmen (oben akkumuliert), Summe zwangsläufig
      //   identisch zur Hauptzeile.
      // Die DOM-Felder vz-info-miete/bwk/zins/tilg/bspar mit Pass-Werten aktualisieren
      st('vz-info-miete', fE(_mieteKumNew, 0));
      st('vz-info-bwk',   '–' + fE(_bwkKumNew, 0));
      st('vz-info-zins',  '–' + fE(_zinsKumNew, 0));
      st('vz-info-tilg',  '–' + fE(Math.max(0, _tilgKumNew), 0));
      // BSpar-Zeile sichtbar nur wenn BSV aktiv
      var _vzInfoBsparElPass = document.getElementById('vz-info-bspar-row');
      if (_vzInfoBsparElPass) {
        if (_bsparKumNew > 0) {
          _vzInfoBsparElPass.style.display = '';
          st('vz-info-bspar', '–' + fE(_bsparKumNew, 0));
        } else {
          _vzInfoBsparElPass.style.display = 'none';
        }
      }
      var _vzSummeEl2 = document.getElementById('vz-info-summe');
      if (_vzSummeEl2) {
        // V119: Summe = arithmetische Summe der cfRows-Komponenten = exakt _cfKontoSigned
        var _vzSummeEchtNew =
          _mieteKumNew -
          _bwkKumNew -
          _zinsKumNew -
          Math.max(0, _tilgKumNew) -
          _bsparKumNew -
          _taxKumNew;
        if (_vzSummeEchtNew >= 0) {
          _vzSummeEl2.textContent = fE(_vzSummeEchtNew, 0, true);
          _vzSummeEl2.classList.remove('c-red');
          _vzSummeEl2.classList.add('c-gold');
        } else {
          _vzSummeEl2.textContent = '– ' + fE(Math.abs(_vzSummeEchtNew), 0);
          _vzSummeEl2.classList.remove('c-gold', 'c-green');
          _vzSummeEl2.classList.add('c-red');
        }
        var _vzSummeLabelEl2 = _vzSummeEl2.parentElement && _vzSummeEl2.parentElement.querySelector('span');
        if (_vzSummeLabelEl2) {
          if (_vzSummeEchtNew >= 0) {
            _vzSummeLabelEl2.innerHTML = '<b>= Kumulierter CF-Überschuss <span class="cf-hint">(Konto-Reserve nach Tilgung &amp; Steuer)</span></b>';
          } else {
            _vzSummeLabelEl2.innerHTML = '<b>= Kumulierter CF-Verlust <span class="cf-hint">(Eigenmittel müssen über die Laufzeit zugeschossen werden)</span></b>';
          }
        }
      }

      // (6) State._vz mit korrigierten Werten — Charts und Bank-Cockpit lesen daraus.
      //     V116: steuervorteil ist jetzt SIGNED (negativ = Belastung). Damit greift
      //     der Effekt sauber im Vermögenszuwachs durch — Belastung mindert das Plus.
      //     V118: cf_ueberschuss_konto auch SIGNED — bei dauerhaftem Verlust mindert das den
      //     Vermögenszuwachs, statt durch Math.max(0, …) auf 0 abgeschnitten zu werden.
      if (State._vz) {
        // V118: cf_ueberschuss_konto aus cfRows neu summieren — SIGNED, ohne Math.max(0,…)
        var _cfKontoSigned = 0;
        var _tilgKumFromCfRows = 0;  // V121
        State.cfRows.forEach(function(r){
          _cfKontoSigned += (r.cfns_y || 0);
          _tilgKumFromCfRows += (r.ty || 0);
        });
        State._vz.cf_ueberschuss_konto = _cfKontoSigned;
        State._vz.tilgung_kum   = _tilgKumFromCfRows;  // V121: Single Source of Truth
        State._vz.tax_kum       = _taxKumNew;
        State._vz.steuervorteil = -_taxKumNew;  // V116 signed
        State._vz.cfkum         = _cfKontoSigned;  // V118 raw, kann negativ sein

        // V120: tilg_durch_einnahmen / tilg_eigenanteil mit echtem cfkum neu rechnen
        //   Marcels Bug-Bericht: Chart-Footer "Tilgung-vom-Mieter +211.980 €" bei Bäckerstr.7
        //   passte zu KEINER Definition. Ursache: tilg_durch_einnahmen wurde NUR oben mit der
        //   Quick-Methode-cfkum berechnet und nie korrigiert wenn cfkum signed neu kam.
        //   Jetzt: Pass rechnet beide Komponenten konsistent zum signed cfkum neu.
        // V121: _tilgKumState aus cfRows summieren (statt aus State._vz das aus der ersten
        //   Schleife kommt) — sonst Inkonsistenz.
        var _tilgKumState = _tilgKumFromCfRows;
        var _bsparKumState = State._vz.bspar_kum || 0;
        var _vermBuilt = _tilgKumState + _bsparKumState;
        // tilg_eigenanteil = der Betrag den der User aus Eigenmitteln für Tilgung+BSV
        // zugeschossen hat; gedeckelt auf _vermBuilt damit es nicht über die echte Tilgung hinaus geht.
        var _tilgEigenanteilNew = (_cfKontoSigned < 0) ? Math.min(-_cfKontoSigned, _vermBuilt) : 0;
        var _tilgVomMieterNew = Math.max(0, _tilgKumState - _tilgEigenanteilNew);
        var _bsparVomMieterNew = Math.max(0, _bsparKumState - Math.max(0, _tilgEigenanteilNew - _tilgKumState));
        State._vz.tilg_eigenanteil = _tilgEigenanteilNew;
        State._vz.tilg_durch_einnahmen = _tilgVomMieterNew;
        State._vz.bspar_durch_einnahmen = _bsparVomMieterNew;

        // Vermögenszuwachs neu kalkulieren — alle Komponenten signed
        var _newVz =
          _tilgVomMieterNew +
          _bsparVomMieterNew +
          _cfKontoSigned +              // V118 signed
          State._vz.steuervorteil +     // V116 signed
          Math.max(0, State._vz.wertsteig_kum || 0);
        State._vz.verm_zuwachs = _newVz;
        // V118: vz-gesamt mit Farbe und Label-Wechsel
        var _vzGesEl = document.getElementById('vz-gesamt');
        if (_vzGesEl) {
          if (_newVz >= 0) {
            _vzGesEl.textContent = fE(_newVz, 0, true);
            _vzGesEl.classList.remove('c-red');
            _vzGesEl.classList.add('c-gold');
          } else {
            _vzGesEl.textContent = '– ' + fE(Math.abs(_newVz), 0);
            _vzGesEl.classList.remove('c-gold', 'c-green');
            _vzGesEl.classList.add('c-red');
          }
        }
        // V120: Tab-Tabelle vz-mieter / vz-eigen mit korrigierten Werten nachziehen
        // V121: vz-tilgung auch nachziehen — basierend auf cfRows (Single Source of Truth).
        var _vzTilgEl = document.getElementById('vz-tilgung');
        if (_vzTilgEl) _vzTilgEl.textContent = fE(_tilgKumFromCfRows, 0, true);
        var _vzMieterEl = document.getElementById('vz-mieter');
        if (_vzMieterEl) _vzMieterEl.textContent = fE(_tilgVomMieterNew, 0, true);
        var _vzEigenEl = document.getElementById('vz-eigen');
        if (_vzEigenEl) _vzEigenEl.textContent = fE(_tilgEigenanteilNew, 0, true);
        // V118: vz-cf-Hauptzeile auch im Pass nachziehen — _cfKontoSigned ist jetzt der echte Wert
        var _vzCfElPass = document.getElementById('vz-cf');
        if (_vzCfElPass) {
          if (_cfKontoSigned >= 0) {
            _vzCfElPass.textContent = fE(_cfKontoSigned, 0, true);
            _vzCfElPass.classList.remove('c-red');
            _vzCfElPass.classList.add('c-green');
          } else {
            _vzCfElPass.textContent = '– ' + fE(Math.abs(_cfKontoSigned), 0);
            _vzCfElPass.classList.remove('c-green');
            _vzCfElPass.classList.add('c-red');
          }
          var _vzCfLabelPass = _vzCfElPass.parentElement && _vzCfElPass.parentElement.querySelector('span');
          if (_vzCfLabelPass) {
            if (_cfKontoSigned >= 0) {
              _vzCfLabelPass.innerHTML = '+ Cashflow-Überschuss <span class="cf-hint">(was nach Tilgung &amp; Steuer auf Konto bleibt)</span>';
            } else {
              _vzCfLabelPass.innerHTML = '− Cashflow-Verlust <span class="cf-hint">(Eigenmittel müssen über die Laufzeit zugeschossen werden)</span>';
            }
          }
        }
      }

      // (7) renderCFCalc neu rufen mit aktualisierten kpis
      if (typeof renderCFCalc === 'function') {
        try { renderCFCalc(window._cfMode || 'heute'); } catch (e) {}
      }
    } catch (e) { /* fallback: Quick-Methode-Werte bleiben drin */ }
  }
  renderProjTable();
  renderCFCalc(window._cfMode || 'heute');
  if(typeof renderBankTable==='function')renderBankTable();
  if(typeof renderPhaseTable==='function')renderPhaseTable();
  if(typeof renderTaxModule==='function')renderTaxModule();
  if(typeof renderDealScore==='function')renderDealScore();
  // V63.17: updateSidebarPortfolio darf NICHT bei jedem calc() laufen — das produziert
  // bei jeder Tastatur-Eingabe einen API-Call → Endlos-Spam wenn Token abgelaufen.
  // Stattdessen: max 1× pro 5 Sekunden (debounce).
  if (typeof updateSidebarPortfolio === 'function') {
    var now = Date.now();
    if (!window._lastSidebarUpdate || (now - window._lastSidebarUpdate) > 5000) {
      window._lastSidebarUpdate = now;
      setTimeout(updateSidebarPortfolio, 200);
    }
  }
  // V63.25: Karten-Liste aktualisieren (für Live-Score/KP/CF-Anzeige in der aktiven Karte).
  // Debounced max 1× pro 3 Sekunden um den /objects-Endpoint nicht zu spammen.
  if (typeof renderSaved === 'function' && window._currentObjKey) {
    var nowR = Date.now();
    if (!window._lastRenderSavedUpdate || (nowR - window._lastRenderSavedUpdate) > 3000) {
      window._lastRenderSavedUpdate = nowR;
      setTimeout(function() { try { renderSaved(); } catch(e) {} }, 250);
    }
  }

  // Mietpreis-Analyse + Annahmen-Mirror in Miete-Tab
  // V63.59: parseFloat() durch v() (parseDe) ersetzt — versteht deutsches Komma
  var wfl = v('wfl');
  if (wfl > 0) {
    var nkm_m_val = v('nkm');
    var ze_m_val = v('ze');
    var nk_m_val = v('umlagef') || v('nk');
    var pqm = (nkm_m_val + ze_m_val) / wfl;
    var pqmw = (nkm_m_val + ze_m_val + nk_m_val) / wfl;
    if (el('miete_qm')) el('miete_qm').textContent = pqm.toFixed(2).replace('.', ',') + ' €/m²';
    if (el('miete_qm_warm')) el('miete_qm_warm').textContent = pqmw.toFixed(2).replace('.', ',') + ' €/m²';
    var ms = v('mietspiegel');
    if (ms > 0 && el('mietspiegel_diff')) {
      var diff = pqm - ms;
      var pct = ms > 0 ? (diff / ms * 100) : 0;
      var sign = diff >= 0 ? '+' : '';
      var color = diff >= 0 ? 'var(--green)' : 'var(--red)';
      el('mietspiegel_diff').innerHTML = '<span style="color:' + color + '">' + sign + diff.toFixed(2).replace('.', ',') + ' €/m² (' + sign + pct.toFixed(1).replace('.', ',') + ' %)</span>';
    }
  }
  // Read-only mirrors of investment assumptions
  if (el('mtg_view')) el('mtg_view').textContent = v('mietstg').toFixed(1).replace('.', ',') + ' %';
  if (el('kstg_view')) el('kstg_view').textContent = v('kostenstg').toFixed(1).replace('.', ',') + ' %';
  if (el('wstg_view')) el('wstg_view').textContent = v('wertstg').toFixed(1).replace('.', ',') + ' %';

  if(el('s6')&&el('s6').classList.contains('active')){if(typeof buildCharts==='function')setTimeout(buildCharts,30);}
  // V22: Mietentwicklungs-Tabelle (Detail-Modus) nach jedem calc() neu rendern
  if (window.MietEntwicklung && typeof MietEntwicklung.refresh === 'function') {
    try { MietEntwicklung.refresh(); } catch(e) {}
  }
  // V36: Header-Badges aktualisieren (DSCR/CF/BMR)
  updHeaderBadges();

  // V48: DS2 zentral cachen + alle Anzeigen synchronisieren (verhindert Score-Mismatch)
  if (typeof window._dpComputeDS2Cached === 'function') {
    window._dpComputeDS2Cached();
  }
  // Header neu mit gecachtem Wert
  if (typeof updHeaderBadges === 'function') {
    try { updHeaderBadges(); } catch(e) {}
  }
  // V48: Aktive Karte links neu rendern damit Score live mit Header übereinstimmt
  // (entkoppelt via setTimeout damit calc() nicht durch DOM-Render verzögert wird)
  if (typeof renderSaved === 'function') {
    setTimeout(function() { try { renderSaved(); } catch(e) {} }, 0);
  }
  // V63.17: setTimeout(qcCalc) entfernt — das verursachte zusammen mit V63.11 calc() in qcCalc Endlos-Loop.
  // Quick-Check rechnet seinen eigenen Score auf User-Eingabe (über `oninput="qcCalc()"`),
  // er muss nicht zusätzlich aus calc() heraus getriggert werden.
}
function renderProjTable(){
  var tbody=el('proj-body');if(!tbody)return;
  var bj=State.bindj;
  // V63.51: Tilgungs-Spaltenüberschrift dynamisch — bei Aussetzung "BSV/J."
  var hasBspar = State.cfRows.some(function(r){ return (r.bspar_y||0) > 0; });
  var thTilg = document.querySelector('#s8 .cft thead th:nth-child(6)') || document.querySelector('.cft thead th:nth-child(6)');
  if (thTilg) {
    if (hasBspar) {
      thTilg.textContent = 'BSV-Rate/J.';
      thTilg.title = 'Bauspar-Sparrate (statt Tilgung — bei Tilgungsaussetzung)';
    } else {
      thTilg.textContent = 'Tilgung/J.';
      thTilg.title = '';
    }
  }
  // V63.39: Excel-Logik strikt — Anzeige zeigt NKM und NUL-Bewirt.
  //   CF v.St./J = NKM − NUL − Zins − Tilg  (Banker-CF, was am Konto bleibt)
  //   CF n.St./J = NKM − NUL − Zins ± Steuer  (operativ, vor Tilgung — Excel)
  tbody.innerHTML=State.cfRows.map(function(r){
    var cf_vst_j = r.cfop_y;              // V63.40: cfop_y ist bereits nach Tilgung (Banker)
    var cf_vst_m = cf_vst_j / 12;
    var cfns_m   = r.cfns_y / 12;
    // V63.51: Bei Aussetzung statt Tilgung die Bauspar-Rate anzeigen
    var tilgOrBspar = hasBspar ? (r.bspar_y || 0) : r.ty;
    return'<tr class="'+(r.y===bj?'ezb':'')+'">'+
      '<td class="tal">'+r.cal+'</td>'+
      '<td>'+fE(r.nkm_m)+'</td><td>'+fE(r.wm_m)+'</td>'+
      '<td class="neg">–'+fE(r.bwk_cf_y || r.bwk_y)+'</td>'+
      '<td class="neg">–'+fE(r.zy)+'</td>'+
      '<td class="neg">–'+fE(tilgOrBspar)+'</td>'+
      '<td class="'+(cf_vst_j>=0?'pos':'neg')+'">'+fE(cf_vst_j,0,true)+'</td>'+
      '<td class="'+(cf_vst_m>=0?'pos':'neg')+'">'+fE(cf_vst_m,0,true)+'</td>'+
      '<td class="'+(r.tax_y>=0?'neg':'pos')+'">'+fE(-(r.tax_y||0),0,true)+'</td>'+
      '<td class="'+(r.cfns_y>=0?'pos':'neg')+'">'+fE(r.cfns_y,0,true)+'</td>'+
      '<td class="'+(cfns_m>=0?'pos':'neg')+'">'+fE(cfns_m,0,true)+'</td>'+
      '<td>'+fE(r.rs,0)+'</td><td>'+fE(r.wert_y,0)+'</td>'+
      '<td class="pos">'+fE(r.eq_y,0)+'</td>'+
      (function(){
        var ltv_cls = r.ltv_y < 85 ? 'pos' : (r.ltv_y > 100 ? 'neg' : 'ltv-warn');
        return '<td class="'+ltv_cls+'">'+r.ltv_y.toFixed(0)+'%</td></tr>';
      })();
  }).join('');

  // V63.81: Summen-Zeile am Ende — kumulierte Werte über die gesamte Laufzeit
  if (State.cfRows.length > 0) {
    var sumNkmM = 0, sumWmM = 0, sumBwk = 0, sumZins = 0, sumTilg = 0;
    var sumCfVst = 0, sumTax = 0, sumCfNs = 0;
    State.cfRows.forEach(function(r) {
      sumNkmM += r.nkm_m;
      sumWmM  += r.wm_m;
      sumBwk  += (r.bwk_cf_y || r.bwk_y);
      sumZins += r.zy;
      sumTilg += hasBspar ? (r.bspar_y || 0) : r.ty;
      sumCfVst += r.cfop_y;
      sumTax  += -(r.tax_y || 0);
      sumCfNs += r.cfns_y;
    });
    var n = State.cfRows.length;
    var avgNkmM = sumNkmM / n;
    var avgWmM  = sumWmM / n;
    var avgCfVstM = sumCfVst / n / 12;
    var avgCfNsM  = sumCfNs / n / 12;
    var lastRow = State.cfRows[n - 1];
    var avgLtv = State.cfRows.reduce(function(a, r) { return a + r.ltv_y; }, 0) / n;

    var sumRow = '<tr class="proj-sum-row">' +
      '<td class="tal"><strong>Σ / ⌀</strong></td>' +
      '<td>⌀ ' + fE(avgNkmM) + '</td>' +
      '<td>⌀ ' + fE(avgWmM) + '</td>' +
      '<td class="neg"><strong>–' + fE(sumBwk) + '</strong></td>' +
      '<td class="neg"><strong>–' + fE(sumZins) + '</strong></td>' +
      '<td class="neg"><strong>–' + fE(sumTilg) + '</strong></td>' +
      '<td class="' + (sumCfVst>=0?'pos':'neg') + '"><strong>' + fE(sumCfVst, 0, true) + '</strong></td>' +
      '<td class="' + (avgCfVstM>=0?'pos':'neg') + '">⌀ ' + fE(avgCfVstM, 0, true) + '</td>' +
      '<td class="' + (sumTax>=0?'pos':'neg') + '"><strong>' + fE(sumTax, 0, true) + '</strong></td>' +
      '<td class="' + (sumCfNs>=0?'pos':'neg') + '"><strong>' + fE(sumCfNs, 0, true) + '</strong></td>' +
      '<td class="' + (avgCfNsM>=0?'pos':'neg') + '">⌀ ' + fE(avgCfNsM, 0, true) + '</td>' +
      '<td>' + fE(lastRow.rs, 0) + '</td>' +
      '<td>' + fE(lastRow.wert_y, 0) + '</td>' +
      '<td class="pos">' + fE(lastRow.eq_y, 0) + '</td>' +
      '<td>⌀ ' + avgLtv.toFixed(0) + '%</td>' +
      '</tr>';
    tbody.innerHTML += sumRow;
  }
}

// Cashflow-Rechnung für Heute oder EZB rendern
function renderCFCalc(mode){
  mode = mode || 'heute';
  var K = State.kpis;
  if(!K || !K.kp) return;
  var data;
  if(mode === 'heute'){
    data = {
      wm: K.wm_j, bwk: K.bwk, nkm: K.nkm_j, bwk_cf: K.bwk_cf,
      zins: K.zins_j, tilg: K.tilg_j,
      cf_op: K.cf_op, steuer: K.steuer, cf_ns: K.cf_ns, cf_m: K.cf_ns/12,
      afa: K.afa, zve: K.zve_immo
    };
  } else if(mode === 'ezb'){
    data = {
      wm: K.wm_ezb, bwk: K.bwk_ezb, nkm: K.nkm_ezb, bwk_cf: K.bwk_cf_ezb,
      zins: K.zins_ezb, tilg: K.tilg_ezb,
      cf_op: K.cf_op_ezb, steuer: K.ster_ezb, cf_ns: K.cf_ns_ezb, cf_m: K.cf_ns_ezb/12,
      afa: K.afa_ezb, zve: K.cf_op_ezb - K.afa_ezb
    };
  } else if(mode === 'anschluss'){
    data = {
      wm: K.wm_an, bwk: K.bwk_an, nkm: K.nkm_an, bwk_cf: K.bwk_cf_an,
      zins: K.zins_an, tilg: K.tilg_an,
      cf_op: K.cf_op_an, steuer: K.ster_an, cf_ns: K.cf_ns_an, cf_m: K.cf_ns_an/12,
      afa: K.afa_ezb, zve: K.cf_op_an - K.afa_ezb
    };
  }
  // V63.35.1: Anzeige — echte Warmmiete (NKM + UL-Erstattung) oben,
  // UL als durchlaufender Posten abziehen → Kaltmiete = NKM.
  // Mathematisch identisch zur Excel-Logik (NKM − NUL).
  var bwk_ul = K.bwk_ul || 0;
  var bwk_nul = K.bwk_nul || 0;
  // Skaliere die ul/nul-Aufteilung mit der Gesamt-BWK der Phase
  var bwk_total_now = bwk_ul + bwk_nul;
  var bwk_phase = data.bwk;
  var ratio_ul = bwk_total_now > 0 ? bwk_ul / bwk_total_now : 0;
  var phase_bwk_ul = bwk_phase * ratio_ul;
  var phase_bwk_nul = bwk_phase * (1 - ratio_ul);

  // Warmmiete = NKM + UL (UL ist Erstattung vom Mieter; durchläuft 1:1 zur Verwaltung)
  var nkm_phase = data.nkm || (data.wm - phase_bwk_ul);
  var warmmiete_phase = nkm_phase + phase_bwk_ul;
  var kaltmiete_phase = warmmiete_phase - phase_bwk_ul;  // = nkm_phase
  var noi = kaltmiete_phase - phase_bwk_nul;
  var cf_nach_zinsen = noi - data.zins;
  var cf_vst = cf_nach_zinsen - data.tilg;

  st('cr-wm', fE(warmmiete_phase));                  // Warmmiete (inkl. umlagef. Erstattung)
  st('cr-bwk-ul', '–' + fE(phase_bwk_ul));            // UL durchlaufend (an Verwaltung)
  st('cr-kaltmiete', fE(kaltmiete_phase, 0, true));   // = NKM + ZE
  st('cr-bwk-nul', '–' + fE(phase_bwk_nul));
  st('cr-noi', fE(noi, 0, true));
  st('cr-zins', '–' + fE(data.zins));
  st('cr-cfop', fE(cf_nach_zinsen, 0, true));
  // V63.51/55: Bei Tilgungsaussetzung Phase-abhängig:
  //   Heute / EZB: BSV-Rate aktiv (während Sparphase)
  //   Anschluss: hängt vom Zuteilungs-Status ab:
  //     - 'before_ezb' / 'at_ezb' → BSV abgewickelt → normale Tilgung anzeigen
  //     - 'after_ezb' / 'never'    → BSV läuft weiter
  var _isAussetzungCF = (g('d1_type') === 'tilgungsaussetzung');
  var lc_cf = State.bsvLifecycle;
  var _showBsparInPhase = false;
  if (_isAussetzungCF && lc_cf) {
    if (mode === 'heute' || mode === 'ezb') {
      _showBsparInPhase = true;
    } else if (mode === 'anschluss') {
      // Im Anschluss nur dann BSV anzeigen, wenn Zuteilung noch nicht erfolgt
      _showBsparInPhase = (lc_cf.zuteilStatus === 'after_ezb' || lc_cf.zuteilStatus === 'never');
    }
  }
  var _bsparPhase = _showBsparInPhase ? (v('bspar_rate') * 12) : 0;
  if (_showBsparInPhase) {
    st('cr-tilg', '–' + fE(_bsparPhase));
    document.querySelectorAll('[data-cr-tilg-label]').forEach(function(elem) { elem.textContent = '– Bausparrate / Jahr'; });
    cf_vst = cf_nach_zinsen - _bsparPhase;
  } else {
    st('cr-tilg', '–' + fE(data.tilg));
    document.querySelectorAll('[data-cr-tilg-label]').forEach(function(elem) {
      elem.textContent = (_isAussetzungCF && mode === 'anschluss') ? '– Tilgung Bauspardarlehen / Jahr' : '– Tilgung / Jahr';
    });
  }
  st('cr-cfvst', fE(cf_vst, 0, true));
  st('cr-st', (data.steuer < 0 ? '+' : '–') + fE(Math.abs(data.steuer)));
  // V118: cr-cfns mit Farbklasse — rot bei Verlust, gold bei Überschuss
  var _crCfnsEl = document.getElementById('cr-cfns');
  if (_crCfnsEl) {
    _crCfnsEl.textContent = fE(data.cf_ns, 0, true);
    _crCfnsEl.classList.remove('c-gold', 'c-green', 'c-red');
    _crCfnsEl.classList.add(data.cf_ns >= 0 ? 'c-gold' : 'c-red');
  }
  st('cr-afa', fE(data.afa));
  st('cr-zve', fE(data.zve, 0, true));
  var cfm = document.getElementById('cr-cfm');
  if(cfm) {
    cfm.textContent = fE(data.cf_m, 0, true);
    cfm.classList.remove('c-gold', 'c-green', 'c-red');
    cfm.classList.add(data.cf_m >= 0 ? 'c-gold' : 'c-red');
  }

  // V63.36/57: DSCR doppelt — Brutto (NKM/Schulden) und Netto (NOI/Schulden)
  // V63.57: Bei Tilgungsaussetzung wird die BSV-Sparrate als wirtschaftlicher
  // Tilgungsersatz mit in den Schuldendienst eingerechnet (so wie es Banken
  // auch in der Praxis handhaben) — sofern die Sparphase noch läuft.
  // _showBsparInPhase wurde oben in der Phase-Logik gesetzt
  var bsv_in_dscr = (_showBsparInPhase ? _bsparPhase : 0);
  var schuldendienst = data.zins + data.tilg + bsv_in_dscr;
  var dscrBrutto = schuldendienst > 0 ? nkm_phase / schuldendienst : 0;
  var dscrNetto  = schuldendienst > 0 ? noi / schuldendienst : 0;
  var dscrFormula = document.getElementById('cr-dscr-formula');
  var dscrVal = document.getElementById('cr-dscr-val');
  var dscrSubVal = document.getElementById('cr-dscr-netto-val');
  if (dscrFormula) {
    var formula = Math.round(nkm_phase).toLocaleString('de-DE') + ' € / ' +
                  Math.round(schuldendienst).toLocaleString('de-DE') + ' €';
    if (bsv_in_dscr > 0) {
      formula += ' (inkl. BSV-Sparrate)';
    }
    formula += ' =';
    dscrFormula.textContent = formula;
  }
  if (dscrVal) {
    dscrVal.textContent = dscrBrutto > 0 ? dscrBrutto.toFixed(2).replace('.', ',') : '—';
    dscrVal.classList.remove('warn', 'bad');
    if (dscrBrutto < 1) dscrVal.classList.add('bad');
    else if (dscrBrutto < 1.2) dscrVal.classList.add('warn');
  }
  if (dscrSubVal) {
    dscrSubVal.textContent = dscrNetto > 0 ? dscrNetto.toFixed(2).replace('.', ',') : '—';
  }
  var dscr = dscrBrutto;
}

function switchCFMode(mode){
  window._cfMode = mode;
  document.querySelectorAll('.cf-mode-btn').forEach(function(b){b.classList.toggle('active', b.getAttribute('data-mode')===mode);});
  var title = document.getElementById('cr-title');
  if(title) {
    var titles = { 'heute': 'Cashflow – Heute', 'ezb': 'Cashflow – Ende Zinsbindung', 'anschluss': 'Cashflow – Anschlussfinanzierung' };
    title.textContent = titles[mode] || titles.heute;
  }
  renderCFCalc(mode);
}



// ═════════════════════════════════════════════════════
// UI Toggle-Funktionen
// ═════════════════════════════════════════════════════
function toggleD2() {
  var cb = el('d2_enable');
  var content = el('d2_content');
  if (content) content.style.display = cb.checked ? '' : 'none';
  calc();
}

function switchBwkMode(mode) {
  window._bwkMode = mode;
  document.querySelectorAll('.bwk-mode-btns .mode-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
  var detail = el('bwk-detail-mode');
  var pct = el('bwk-percent-mode');
  if (detail) detail.style.display = mode === 'detail' ? '' : 'none';
  if (pct) pct.style.display = mode === 'percent' ? '' : 'none';
  calc();
}


function switchBwkPctMode(mode) {
  window._bwkPctMode = mode;
  document.querySelectorAll('.bwk-mode-btns .mode-btn[data-pmode]').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-pmode') === mode);
  });
  var nkmBlock = el('bwk-pct-nkm-block');
  var kpBlock = el('bwk-pct-kp-block');
  if (nkmBlock) nkmBlock.style.display = mode === 'nkm' ? '' : 'none';
  if (kpBlock) kpBlock.style.display = mode === 'kp' ? '' : 'none';
  calc();
}


// ═══════════════════════════════════════════════════
// FESH (Fenster/Elektrik/Sanitär/Heizung) Sanierungsbereiche
// + KfW-Empfehlungs-Engine
// V117: State.fesh wird IMMER gesetzt (auch bei leerer Auswahl) — sonst blieben
//       alte Werte aus vorherigen Objekten stecken und applyFESHToSanierung
//       schrieb plötzlich z.B. 12.000 € in ein leeres Objekt (Marcels Bug).
// ═══════════════════════════════════════════════════
function updateFESH() {
  var areas = ['f', 'e', 's', 'h', 'd', 'b', 'k', 'o'];
  var labels = {
    f: 'Fenster', e: 'Elektrik', s: 'Sanitär', h: 'Heizung',
    d: 'Dach/Fassade', b: 'Bäder', k: 'Küche', o: 'Sonstiges'
  };
  var total = 0;
  var selected = [];
  areas.forEach(function(a) {
    var cb = el('fesh_' + a);
    var cost = v('fesh_' + a + '_cost') || 0;
    var tile = cb && cb.closest('.fesh-tile');
    if (cb && cb.checked) {
      total += cost;
      selected.push({ area: a, label: labels[a], cost: cost });
      if (tile) tile.classList.add('active');
    } else {
      if (tile) tile.classList.remove('active');
    }
  });
  st('fesh_total', fE(total, 0));

  // V117: State IMMER setzen — auch bei leerer Auswahl (sonst alte Werte sticky)
  State.fesh = { selected: selected, total: total, recommendations: [] };

  // KfW-Empfehlungs-Engine
  var kfwBox = el('fesh_kfw_recommendation');
  var kfwText = el('fesh_kfw_text');
  if (!kfwBox || !kfwText) return;

  if (selected.length === 0) {
    kfwBox.style.display = 'none';
    return;
  }

  var recommendations = [];
  var hasEnergyMaßnahme = selected.some(function(s) { return ['f', 'h', 'd'].indexOf(s.area) >= 0; });
  var hasHeating = selected.some(function(s) { return s.area === 'h'; });
  var hasFenster = selected.some(function(s) { return s.area === 'f'; });
  var hasDachFassade = selected.some(function(s) { return s.area === 'd'; });

  // KfW 261 - Wohngebäude-Kredit (für energetische Sanierung)
  if (hasEnergyMaßnahme) {
    recommendations.push({
      program: 'KfW 261 – Wohngebäude-Kredit (Bestand)',
      amount: 'bis 150.000 €/Wohneinheit',
      benefit: 'Bis zu 45% Tilgungszuschuss bei Effizienzhaus-Standard',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Wohngebäude-Kredit-(261)/',
      reason: 'Du hast ' + (hasFenster ? 'Fenster' : '') +
              (hasFenster && hasHeating ? ', ' : '') +
              (hasHeating ? 'Heizung' : '') +
              (hasDachFassade ? (hasFenster || hasHeating ? ', ' : '') + 'Dach/Fassade' : '') +
              ' ausgewählt → energetische Sanierung'
    });
  }

  // KfW 458 - Heizungsförderung (BEG EM)
  if (hasHeating) {
    recommendations.push({
      program: 'KfW 458 – Heizungsförderung (BEG)',
      amount: 'Zuschuss bis 70% (max. 23.500 €)',
      benefit: 'Förderung für Wärmepumpe, Solarthermie, Biomasseheizung',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Heizungsförderung-für-Privatpersonen-(458)/',
      reason: 'Heizungs-Sanierung ausgewählt'
    });
  }

  // KfW 159 - Altersgerecht Umbauen (oft passend bei Bädern)
  var hasBader = selected.some(function(s) { return s.area === 'b'; });
  if (hasBader) {
    recommendations.push({
      program: 'KfW 159 – Altersgerecht Umbauen',
      amount: 'bis 50.000 €/Wohneinheit',
      benefit: 'Günstiger Kredit für barrierefreie Umbauten (Bad, Türen, Aufzug)',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Altersgerecht-Umbauen-Kredit-(159)/',
      reason: 'Bäder-Sanierung könnte barrierefrei ausgeführt werden'
    });
  }

  // BAFA für Einzelmaßnahmen
  if (hasEnergyMaßnahme && total < 60000) {
    recommendations.push({
      program: 'BAFA-Zuschuss (Einzelmaßnahmen)',
      amount: 'Zuschuss bis 20%',
      benefit: 'Direktzuschuss ohne Kredit – Auszahlung nach Maßnahme',
      url: 'https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/Sanierung_Wohngebaeude/sanierung_wohngebaeude_node.html',
      reason: 'Bei kleineren Sanierungsmaßnahmen oft attraktiver als Kredit'
    });
  }

  if (recommendations.length === 0) {
    kfwBox.style.display = 'none';
    return;
  }

  kfwBox.style.display = '';
  kfwText.innerHTML =
    '<p style="margin-bottom:8px">Basierend auf deinen Sanierungsbereichen kommen folgende Förderungen in Frage:</p>' +
    recommendations.map(function(r) {
      return '<div class="kfw-rec">' +
        '<div class="kfw-rec-head"><b>' + r.program + '</b></div>' +
        '<div class="kfw-rec-row"><span class="kfw-label">Volumen:</span> ' + r.amount + '</div>' +
        '<div class="kfw-rec-row"><span class="kfw-label">Vorteil:</span> ' + r.benefit + '</div>' +
        '<div class="kfw-rec-row" style="font-style:italic;color:#888"><span class="kfw-label">→ Warum:</span> ' + r.reason + '</div>' +
        '<a href="' + r.url + '" target="_blank" rel="noopener" class="kfw-rec-link">Zur KfW-Seite →</a>' +
      '</div>';
    }).join('');

  // State for KI prompt
  State.fesh = { selected: selected, total: total, recommendations: recommendations };
}

function applyFESHToSanierung() {
  // V117: Direkt aus DOM rechnen — State.fesh kann veraltet sein wenn der User
  //   Checkboxen toggelte ohne dass updateFESH durchlief (z.B. nach Objekt-Wechsel).
  //   Source of Truth = die Checkboxen + Cost-Inputs im DOM.
  var areas = ['f', 'e', 's', 'h', 'd', 'b', 'k', 'o'];
  var total = 0;
  areas.forEach(function(a) {
    var cb = el('fesh_' + a);
    var cost = v('fesh_' + a + '_cost') || 0;
    if (cb && cb.checked) total += cost;
  });

  if (total === 0) {
    toast('⚠ Bitte erst Sanierungsbereiche auswählen (Häkchen setzen)');
    return;
  }

  var sanInput = el('san');
  if (sanInput) {
    sanInput.value = total;
    // V117: Steuer-Werbungskosten-Checkbox automatisch toggeln
    //   - wenn Sanierung > 0 → einschalten
    //   - wenn 0 → ausschalten (Marcels Wunsch)
    var sanTax = el('san_tax_active');
    if (sanTax) sanTax.checked = (total > 0);
    sanInput.dispatchEvent(new Event('input'));
    if (typeof calc === 'function') calc();
    toast('✓ ' + fE(total, 0) + ' € als Sanierungskosten übernommen');
  }
}

/**
 * V117: Wenn der User das Sanierung-Feld (#san) manuell auf 0 setzt oder leert,
 *   soll auch die Steuer-Werbungskosten-Checkbox automatisch raus.
 *   Triggered durch oninput auf #san.
 */
function syncSanTaxOnSanInput() {
  var sanInput = el('san');
  if (!sanInput) return;
  var val = parseDe(sanInput.value) || 0;
  var sanTax = el('san_tax_active');
  if (sanTax && val === 0) sanTax.checked = false;
}
if (typeof window !== 'undefined') {
  window.syncSanTaxOnSanInput = syncSanTaxOnSanInput;
}


// ═══════════════════════════════════════════════════
// BANKEXPORT - Tabelle für Bankgespräche
// ═══════════════════════════════════════════════════
function renderBankTable() {
  var tbody = el('bank-tbody');
  if (!tbody) return;

  var K = State.kpis;
  if (!K || !K.kp) {
    tbody.innerHTML = '<tr><td colspan="24" style="text-align:center;color:var(--muted);padding:30px">Bitte ein Objekt eingeben und alle Felder ausfüllen.</td></tr>';
    return;
  }

  var datum = new Date().toLocaleDateString('de-DE');
  var nkm_m = K.nkm_j / 12;
  var nkm_per_qm = v('wfl') > 0 ? nkm_m / v('wfl') : 0;
  var nebenkosten_m = K.bwk / 12;
  var bank = g('bank_inst') || '-';
  var bindj = parseInt(g('d1_bindj') || 10);
  var fin_datum = g('kaufdat') ? new Date(g('kaufdat')).toLocaleDateString('de-DE') : '-';
  var bind_end = new Date();
  if (g('kaufdat')) {
    bind_end = new Date(g('kaufdat'));
    bind_end.setFullYear(bind_end.getFullYear() + bindj);
  }

  var rows = [];

  // Row 1: Darlehen I (Annuitätendarlehen oder Tilgungsaussetzung)
  // V63.51: Darlehensart dynamisch aus d1_type
  var _d1Art = (g('d1_type') === 'tilgungsaussetzung') ? 'Tilgungsaussetzungsdarlehen' : 'Annuitätendarlehen';
  rows.push({
    nr: 1,
    plz: g('plz') || '-',
    ort: g('ort') || '-',
    str: g('str') || '-',
    hn: g('hnr') || '-',
    bez: g('objart') || 'ETW',
    qm: v('wfl').toFixed(2).replace('.', ','),
    nkm: fE(nkm_m, 2),
    qmpreis: fE(nkm_per_qm, 2),
    nk: fE(nebenkosten_m, 2),
    bank: bank,
    art: _d1Art + ' 1',
    fin_datum: fin_datum,
    vertrag: g('d1_vertrag') || '-',
    summe: fE(v('d1'), 0),
    zins: fP(v('d1z'), 2),
    tilg: (g('d1_type') === 'tilgungsaussetzung') ? '— (BSV)' : fP(v('d1t'), 2),
    rate: fE(State.d1_rate_monthly * 12, 0) + ' /J',
    bindung: bindj + ' J.',
    restschuld_akt: fE(State.rs1 || State.rs, 0),
    laufzeit: bind_end.toLocaleDateString('de-DE'),
    restschuld_ende: fE(State.rs1 || State.rs, 0),
    volltilg: g('volltilg') || '-'
  });

  // Row 2: Darlehen II (if active)
  if (State.d2_enabled && State.d2 > 0) {
    var d2type = State.d2_type === 'tilgungsaussetzung' ? 'Tilgungsaussetzungsdarlehen' :
                 State.d2_type === 'kfw' ? 'KfW-Darlehen' : 'Annuitätendarlehen 2';
    rows.push({
      nr: 2,
      plz: g('plz') || '-',
      ort: g('ort') || '-',
      str: g('str') || '-',
      hn: g('hnr') || '-',
      bez: g('objart') || 'ETW',
      qm: v('wfl').toFixed(2).replace('.', ','),
      nkm: fE(nkm_m, 2),
      qmpreis: fE(nkm_per_qm, 2),
      nk: fE(nebenkosten_m, 2),
      bank: g('d2_inst') || '-',
      art: d2type,
      fin_datum: fin_datum,
      vertrag: g('d2_vertrag') || '-',
      summe: fE(State.d2, 0),
      zins: fP(State.d2z * 100, 2),
      tilg: fP(State.d2t * 100, 2),
      rate: fE(State.d2_rate_m * 12, 0) + ' /J',
      bindung: (g('d2_bindj') || '-') + ' J.',
      restschuld_akt: fE(State.rs2 || 0, 0),
      laufzeit: '-',
      restschuld_ende: fE(State.rs2 || 0, 0),
      volltilg: '-'
    });
  }

  // Row 3: Bausparvertrag (if filled in)
  if (g('d2_bspar')) {
    rows.push({
      nr: rows.length + 1,
      plz: g('plz') || '-',
      ort: g('ort') || '-',
      str: g('str') || '-',
      hn: g('hnr') || '-',
      bez: g('objart') || 'ETW',
      qm: v('wfl').toFixed(2).replace('.', ','),
      nkm: fE(nkm_m, 2),
      qmpreis: fE(nkm_per_qm, 2),
      nk: fE(nebenkosten_m, 2),
      bank: g('d2_inst') || '-',
      art: 'Bausparvertrag',
      fin_datum: fin_datum,
      vertrag: g('d2_bspar'),
      summe: '-',
      zins: '-',
      tilg: '-',
      rate: '-',
      bindung: '-',
      restschuld_akt: '-',
      laufzeit: '-',
      restschuld_ende: '-',
      volltilg: '-'
    });
  }

  tbody.innerHTML = rows.map(function(r) {
    return '<tr>' +
      '<td>' + datum + '</td>' +
      '<td class="center">' + r.nr + '</td>' +
      '<td>' + r.plz + '</td>' +
      '<td>' + r.ort + '</td>' +
      '<td>' + r.str + '</td>' +
      '<td class="center">' + r.hn + '</td>' +
      '<td>' + r.bez + '</td>' +
      '<td class="num">' + r.qm + '</td>' +
      '<td class="num">' + r.nkm + '</td>' +
      '<td class="num">' + r.qmpreis + '</td>' +
      '<td class="num">' + r.nk + '</td>' +
      '<td>' + r.bank + '</td>' +
      '<td>' + r.art + '</td>' +
      '<td class="center">' + r.fin_datum + '</td>' +
      '<td>' + r.vertrag + '</td>' +
      '<td class="num">' + r.summe + '</td>' +
      '<td class="num">' + r.zins + '</td>' +
      '<td class="num">' + r.tilg + '</td>' +
      '<td class="num">' + r.rate + '</td>' +
      '<td class="center">' + r.bindung + '</td>' +
      '<td class="num">' + r.restschuld_akt + '</td>' +
      '<td class="center">' + r.laufzeit + '</td>' +
      '<td class="num">' + r.restschuld_ende + '</td>' +
      '<td class="center">' + r.volltilg + '</td>' +
    '</tr>';
  }).join('');
}

function exportBankCSV() {
  var rows = document.querySelectorAll('#bank-table tr');
  if (rows.length < 2) { toast('⚠ Keine Daten zum Exportieren'); return; }
  var csv = [];
  rows.forEach(function(row) {
    var cells = row.querySelectorAll('th, td');
    csv.push(Array.from(cells).map(function(c) {
      var t = c.textContent.trim().replace(/"/g, '""');
      return '"' + t + '"';
    }).join(';'));
  });
  var blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Junker_Bankexport_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  toast('✓ Bankexport-CSV gespeichert');
}

function exportBankPDF() {
  // Use existing PDF infrastructure - but generate a special bank export PDF
  toast('Bank-PDF wird über den normalen PDF-Export mit ausgegeben (Kapitel "Bankexport")');
}


// ═══════════════════════════════════════════════════
// 3-PHASEN-KENNZAHLEN-VERGLEICH (Heute / EZB / Anschluss)
// ═══════════════════════════════════════════════════
function renderPhaseTable() {
  if (!State.kpis) return;
  var K = State.kpis;
  var bindj = parseInt(g('d1_bindj') || 10);
  var mstg = v('mietstg') / 100;
  var kp = K.kp;
  // V63.67: Wert-Anker für Wertsteigerung — siehe State.wert_basis (svw > bankval > kp)
  var wert_basis_ph = State.wert_basis || kp;
  var wstg_ph = v('wertstg') / 100;

  // V63.35: Excel-Logik — wm/bwk in den Phase-Werten zeigen NKM/NUL für Anzeige-Konsistenz
  // Heute
  var nowVals = {
    wm: K.nkm_j, bwk: K.bwk_cf, zins: K.zins_j, tilg: K.tilg_j,
    cfvst: K.cf_op, ster: K.steuer, cfns: K.cf_ns,
    bmy: K.bmy, nmy: K.nmy,
    // V63.57: dscr inkl. BSV-Sparrate (wirtschaftlicher Tilgungsersatz)
    dscr: K.nkm_j / Math.max(1, (K.zins_j + K.tilg_j + (K.bspar_j || 0))),
    ltv: K.ltv,
    // V63.67: Heute-Wert ist wert_basis (Verkehrswert / Bankbewertung / Kaufpreis)
    rs: K.d1, wert: wert_basis_ph, eq: wert_basis_ph - K.d1
  };

  // V63.57: BSV-Sparrate je Phase als wirtschaftlicher Tilgungsersatz im DSCR
  var _bspY = (K.bspar_j || 0);          // Heute: BSV läuft
  var _bspY_ezb = (K.bspar_ezb || 0);    // EZB: BSV läuft (während Bindung)
  var _bspY_an  = (K.bspar_an || 0);     // Anschluss: nur wenn after_ezb/never

  // Ende Zinsbindung
  var ezbVals = {
    wm: K.nkm_ezb, bwk: K.bwk_cf_ezb, zins: K.zins_ezb, tilg: K.tilg_ezb,
    cfvst: K.cf_op_ezb, ster: K.ster_ezb, cfns: K.cf_ns_ezb,
    bmy: K.nkm_ezb / kp * 100,
    // V63.35: NMR/DSCR auf Excel-Logik (NKM − NUL, UL durchlaufend)
    nmy: (K.nkm_ezb - K.bwk_cf_ezb) / K.gi * 100,
    dscr: K.nkm_ezb / Math.max(1, (K.zins_ezb + K.tilg_ezb + _bspY_ezb)),
    rs: State.rs,
    // V63.67: EZB-Wert basiert auf wert_basis, nach `bindj` Jahren Wertsteigerung
    wert: wert_basis_ph * Math.pow(1 + wstg_ph, bindj),
    ltv: 0, eq: 0
  };
  ezbVals.ltv = ezbVals.wert > 0 ? (ezbVals.rs / ezbVals.wert * 100) : 0;
  ezbVals.eq = ezbVals.wert - ezbVals.rs;

  // Anschluss (Jahr nach Zinsbindung)
  // V63.55: Bei Tilgungsaussetzung mit BSV — Restschuld in Anschluss anpassen je nach Zuteilungs-Status:
  //   - 'before_ezb' / 'at_ezb': Hauptdarlehen wurde abgelöst → Restschuld = Bauspardarlehen + ggf. Lücke
  //   - 'after_ezb' / 'never': Hauptdarlehen läuft als Anschlussfin., Sparguthaben hat ggf. EK gemindert
  //                            → Restschuld in Anschluss = Hauptdarlehen − Sparguthaben (= Anschluss-Bedarf)
  // V63.56: BUGFIX — `_d1IsAussetzung` ist nur im Scope von calc(), nicht hier!
  // Stattdessen K.d1IsAussetzung (aus State.kpis) verwenden.
  var _isAussetzungPh_inner = K.d1IsAussetzung || (g('d1_type') === 'tilgungsaussetzung');
  var lc_ph = State.bsvLifecycle;
  var rs_anschluss = State.rs;  // Default: klassische Restschuld bei EZB
  if (_isAussetzungPh_inner && lc_ph) {
    if (lc_ph.zuteilStatus === 'before_ezb' || lc_ph.zuteilStatus === 'at_ezb') {
      // BSV hat das Hauptdarlehen abgelöst, Bauspardarlehen läuft (+ ggf. Lücke)
      rs_anschluss = lc_ph.bauspardarlehen + lc_ph.luecke;
    } else if (lc_ph.zuteilStatus === 'after_ezb' || lc_ph.zuteilStatus === 'never') {
      // Bis Bindungsende ist nur das Sparguthaben aufgebaut. Anschluss-Bedarf =
      // Hauptdarlehen − bis dahin angesparter Sparguthaben (Sparphase reduziert nicht die
      // Restschuld direkt, ABER der User KÖNNTE das Sparguthaben einsetzen um den Anschluss
      // zu reduzieren). Wir zeigen das als optimistische Annahme.
      // FV nach bindj Jahren:
      var rMon_ph = lc_ph.bsparZins / 12;
      var nMon_ph = bindj * 12;
      var sparguth_ezb = rMon_ph > 0
        ? lc_ph.bsparRateM * (Math.pow(1 + rMon_ph, nMon_ph) - 1) / rMon_ph
        : lc_ph.bsparRateM * nMon_ph;
      rs_anschluss = Math.max(0, (lc_ph.d1 || K.d1) - sparguth_ezb);
    }
  }

  var anVals = {
    wm: K.nkm_an, bwk: K.bwk_cf_an, zins: K.zins_an, tilg: K.tilg_an,
    cfvst: K.cf_op_an, ster: K.ster_an, cfns: K.cf_ns_an,
    bmy: K.nkm_an / kp * 100,
    nmy: (K.nkm_an - K.bwk_cf_an) / K.gi * 100,
    // V63.57: BSV-Sparrate nur wenn sie in dieser Phase noch läuft (after_ezb/never)
    dscr: K.nkm_an / Math.max(1, (K.zins_an + K.tilg_an + _bspY_an)),
    rs: rs_anschluss,  // V63.55: angepasst je nach BSV-Status
    // V63.67: Anschluss-Wert basiert auf wert_basis, nach `bindj+1` Jahren
    wert: wert_basis_ph * Math.pow(1 + wstg_ph, bindj + 1),
    ltv: 0, eq: 0
  };
  anVals.ltv = anVals.wert > 0 ? (anVals.rs / anVals.wert * 100) : 0;
  anVals.eq = anVals.wert - anVals.rs;

  function setF(id, val, asMon) {
    var elt = el(id); if (!elt) return;
    elt.textContent = fE(val, 0, true);
  }
  function setP(id, val) {
    var elt = el(id); if (!elt) return;
    elt.textContent = (val).toFixed(2).replace('.', ',') + ' %';
  }
  function setN(id, val) {
    var elt = el(id); if (!elt) return;
    elt.textContent = (val).toFixed(2).replace('.', ',');
  }

  // V63.35: Excel-Logik — Anzeige zeigt NKM und nur NUL-Bewirt (UL durchlaufend).
  // Damit Spaltensumme: NKM − NUL − Zins − Tilg = CF v.St. korrekt aufgeht.
  // V63.52/53: Bei Tilgungsaussetzung wird die Tilgungs-Zeile zur "Bausparrate"-Zeile
  // — ABER NUR während der Zinsbindung (Heute, EZB). Im Anschluss läuft normale
  // Annuitätsfinanzierung mit Tilgung — siehe Bug in V63.52 (Anschluss zeigte 0).
  var _isAussetzungPh = (K.d1IsAussetzung || g('d1_type') === 'tilgungsaussetzung');
  var _tilgOrBsparNow = _isAussetzungPh ? (K.bspar_j || 0) : nowVals.tilg;
  var _tilgOrBsparEzb = _isAussetzungPh ? (K.bspar_ezb || 0) : ezbVals.tilg;
  // Anschluss: IMMER Tilgung anzeigen (Anschluss-Annuität auf voller Restschuld)
  var _tilgOrBsparAn  = anVals.tilg;

  // V63.62: Helper für Prozentwerte mit ∞/—-Behandlung wenn Bezugsgröße ≤ 0
  function setP_safe(id, val, denom) {
    var elt = el(id); if (!elt) return;
    if (denom == null || denom <= 0) {
      elt.textContent = '—';
    } else {
      elt.textContent = (val).toFixed(2).replace('.', ',') + ' %';
    }
  }

  // Heute column
  setF('ph-wm-now', K.nkm_j);
  setF('ph-bwk-now', -K.bwk_cf);
  setF('ph-zins-now', -nowVals.zins);
  setF('ph-tilg-now', -_tilgOrBsparNow);
  setF('ph-cfvst-now', nowVals.cfvst);
  setF('ph-cfvstm-now', nowVals.cfvst / 12);
  setF('ph-st-now', -nowVals.ster);
  setF('ph-cfns-now', nowVals.cfns);
  setF('ph-cfnsm-now', nowVals.cfns / 12);
  setP('ph-bmr-now', nowVals.bmy);
  // V63.58: NMR ersetzt durch phasenabhängige CF-Rendite und EK-Rendite
  setP('ph-cfy-now', nowVals.wert > 0 ? (nowVals.cfns / nowVals.wert * 100) : 0);
  setP_safe('ph-ekr-now', nowVals.eq > 0 ? (nowVals.cfns / nowVals.eq * 100) : 0, nowVals.eq);
  setN('ph-dscr-now', nowVals.dscr);
  setP('ph-ltv-now', nowVals.ltv);
  setF('ph-rs-now', nowVals.rs);
  setF('ph-wert-now', nowVals.wert);
  setF('ph-eq-now', nowVals.eq);

  // EZB column
  setF('ph-wm-ezb', K.nkm_ezb);
  setF('ph-bwk-ezb', -K.bwk_cf_ezb);
  setF('ph-zins-ezb', -ezbVals.zins);
  setF('ph-tilg-ezb', -_tilgOrBsparEzb);
  setF('ph-cfvst-ezb', ezbVals.cfvst);
  setF('ph-cfvstm-ezb', ezbVals.cfvst / 12);
  setF('ph-st-ezb', -ezbVals.ster);
  setF('ph-cfns-ezb', ezbVals.cfns);
  setF('ph-cfnsm-ezb', ezbVals.cfns / 12);
  setP('ph-bmr-ezb', ezbVals.bmy);
  setP('ph-cfy-ezb', ezbVals.wert > 0 ? (ezbVals.cfns / ezbVals.wert * 100) : 0);
  setP_safe('ph-ekr-ezb', ezbVals.eq > 0 ? (ezbVals.cfns / ezbVals.eq * 100) : 0, ezbVals.eq);
  setN('ph-dscr-ezb', ezbVals.dscr);
  setP('ph-ltv-ezb', ezbVals.ltv);
  setF('ph-rs-ezb', ezbVals.rs);
  setF('ph-wert-ezb', ezbVals.wert);
  setF('ph-eq-ezb', ezbVals.eq);

  // Anschluss column
  setF('ph-wm-an', K.nkm_an);
  setF('ph-bwk-an', -K.bwk_cf_an);
  setF('ph-zins-an', -anVals.zins);
  setF('ph-tilg-an', -anVals.tilg);
  setF('ph-cfvst-an', anVals.cfvst);
  setF('ph-cfvstm-an', anVals.cfvst / 12);
  setF('ph-st-an', -anVals.ster);
  setF('ph-cfns-an', anVals.cfns);
  setF('ph-cfnsm-an', anVals.cfns / 12);
  setP('ph-bmr-an', anVals.bmy);
  setP('ph-cfy-an', anVals.wert > 0 ? (anVals.cfns / anVals.wert * 100) : 0);
  setP_safe('ph-ekr-an', anVals.eq > 0 ? (anVals.cfns / anVals.eq * 100) : 0, anVals.eq);
  setN('ph-dscr-an', anVals.dscr);
  setP('ph-ltv-an', anVals.ltv);
  setF('ph-rs-an', anVals.rs);
  setF('ph-wert-an', anVals.wert);
  setF('ph-eq-an', anVals.eq);

  // V63.51: Bei Tilgungsaussetzung Label-Text der Tilgungs-Zeile dynamisch anpassen
  document.querySelectorAll('[data-phase-tilg-label]').forEach(function(elem) {
    elem.textContent = _isAussetzungPh ? 'Bausparrate / Jahr' : 'Tilgung / Jahr';
  });

  // Cache for PDF
  // Update prominent CF phase cards (Punkt 12 - Cashflow-Werte werden angezeigt)
  function _setCfCard(id, val) {
    var elt = el(id); if (!elt) return;
    var v = val / 12;  // monatlich
    elt.textContent = (v >= 0 ? '+' : '') + fE(v, 0);
    elt.classList.toggle('positive', v >= 0);
    elt.classList.toggle('negative', v < 0);
  }
  _setCfCard('cf-vst-now', nowVals.cfvst);
  _setCfCard('cf-vst-ezb', ezbVals.cfvst);
  _setCfCard('cf-vst-an', anVals.cfvst);
  _setCfCard('cf-nst-now', nowVals.cfns);
  _setCfCard('cf-nst-ezb', ezbVals.cfns);
  _setCfCard('cf-nst-an', anVals.cfns);

  State.phaseTable = { now: nowVals, ezb: ezbVals, an: anVals };

  // ZAER-Card: Zinssatz / Rate / CF / DSCR / ΔRate für 3 Phasen
  function _setF(id, val) { var e = el(id); if (e) e.textContent = fE(val, 0, true); }
  function _setP(id, val) { var e = el(id); if (e) e.textContent = (val).toFixed(2).replace('.', ',') + ' %'; }
  function _setN(id, val) { var e = el(id); if (e) e.textContent = (val).toFixed(2).replace('.', ','); }

  // Zinssätze: heute = aktueller Mischzins, EZB = noch aktueller, Anschluss = anschl_z
  // V63.59 BUGFIX: parseFloat() schneidet bei deutschem Komma ab — "3,8" wurde zu 3,
  // dadurch zeigte die Detail-Tabelle "3,00 %" statt "3,80 %". Jetzt v() (mit parseDe).
  var d1z_pct = v('d1z');
  var d2_on = State.d2_enabled && State.d2 > 0;
  var d2z_pct = d2_on ? (State.d2z * 100) : 0;
  var dT = v('d1') + (d2_on ? State.d2 : 0);
  var mischzins = dT > 0 ? ((v('d1') * d1z_pct + (d2_on ? State.d2 * d2z_pct : 0)) / dT) : d1z_pct;
  var anZins = v('anschl_z');
  _setP('zaer-zins-now', mischzins);
  _setP('zaer-zins-ezb', mischzins);
  _setP('zaer-zins-an',  anZins);

  // Raten / CF
  var rateNow = v('d1_rate'); // monthly text-stripped fallback
  // Cleaner: take K.zins_j/12 + K.tilg_j/12 for current; later phases von phaseTable
  var rateNow2 = (K.zins_j + K.tilg_j) / 12;
  var rateEzb2 = (K.zins_ezb + K.tilg_ezb) / 12;
  var rateAn2  = (K.zins_an  + K.tilg_an)  / 12;
  _setF('zaer-rate-now', rateNow2);
  _setF('zaer-rate-ezb', rateEzb2);
  _setF('zaer-rate-an',  rateAn2);

  // V63.60: BSV-Sparrate als eigene Zeile + Liquiditätsbelastung gesamt
  var _bsparNow_m = (K.bspar_j   || 0) / 12;
  var _bsparEzb_m = (K.bspar_ezb || 0) / 12;
  var _bsparAn_m  = (K.bspar_an  || 0) / 12;
  var _hasAnyBspar = (_bsparNow_m + _bsparEzb_m + _bsparAn_m) > 0;
  var _bsparRow = el('zaer-bspar-row');
  var _totalRow = el('zaer-total-row');
  if (_bsparRow) _bsparRow.style.display = _hasAnyBspar ? '' : 'none';
  if (_totalRow) _totalRow.style.display = _hasAnyBspar ? '' : 'none';
  if (_hasAnyBspar) {
    _setF('zaer-bspar-now', _bsparNow_m);
    _setF('zaer-bspar-ezb', _bsparEzb_m);
    _setF('zaer-bspar-an',  _bsparAn_m);
    _setF('zaer-total-now', rateNow2 + _bsparNow_m);
    _setF('zaer-total-ezb', rateEzb2 + _bsparEzb_m);
    _setF('zaer-total-an',  rateAn2  + _bsparAn_m);
  }

  // V63.40: cf_op ist bereits nach Tilgung — direkt verwenden
  _setF('zaer-cfvst-now', K.cf_op    / 12);
  _setF('zaer-cfvst-ezb', K.cf_op_ezb / 12);
  _setF('zaer-cfvst-an',  K.cf_op_an  / 12);

  _setF('zaer-cf-now', K.cf_ns / 12);
  _setF('zaer-cf-ezb', K.cf_ns_ezb / 12);
  _setF('zaer-cf-an',  K.cf_ns_an / 12);

  _setN('zaer-dscr-now', nowVals.dscr);
  _setN('zaer-dscr-ezb', ezbVals.dscr);
  _setN('zaer-dscr-an',  anVals.dscr);

  // V63.60: Δ Rate vergleicht jetzt die ECHTE Liquiditätsbelastung (Bank + BSV)
  var _totNow = rateNow2 + _bsparNow_m;
  var _totEzb = rateEzb2 + _bsparEzb_m;
  var _totAn  = rateAn2  + _bsparAn_m;
  _setF('zaer-drate-ezb', _totEzb - _totNow);
  _setF('zaer-drate-an',  _totAn  - _totNow);
}


// ═══════════════════════════════════════════════════
// UPDATE ALL - Manueller Neuberechnungs-Trigger (Punkt 11)
// ═══════════════════════════════════════════════════
function updateAllValues() {
  try {
    // V29: calcNow statt calc — sofort, kein Debounce
    if (typeof calcNow === 'function') calcNow();
    if (typeof renderTaxModule === 'function') renderTaxModule();
    if (typeof renderPhaseTable === 'function') renderPhaseTable();
    if (typeof renderBankTable === 'function') renderBankTable();
    if (typeof updateSidebarPortfolio === 'function') updateSidebarPortfolio();
    if (typeof buildCharts === 'function' && el('s6') && el('s6').classList.contains('active')) {
      setTimeout(buildCharts, 50);
    }
  } catch (e) {
    console.error('updateAllValues failed:', e);
    if (typeof toast === 'function') toast('⚠ Fehler beim Aktualisieren - siehe Konsole');
  }
}

// Expose globally
window.updateAllValues = updateAllValues;
window.calcNow = calcNow;
window.calc = calc;

/* ═══════════════════════════════════════════════════════════════
   V48: Zentrale dpUpdateAll() — synchronisiert ALLE Score-Anzeigen
   in fester Reihenfolge damit alle den GLEICHEN Wert zeigen.

   Reihenfolge:
   1. calc() → State.kpis ist konsistent
   2. _dpComputeDS2Cached() → einmal Score rechnen, cachen
   3. updHeaderBadges() → liest gecachten Score
   4. renderDealScore() → alter DS, ersetzt durch DS2-Wert
   5. renderDealScore2() → DS2 (= Quelle der Wahrheit)
   6. renderDs2Readonly() → Read-only-Block
   7. renderSaved() → aktive Karte links
═══════════════════════════════════════════════════════════════ */
window._dpLastDS2Result = null;

function _dpComputeDS2Cached() {
  if (typeof window._buildDeal2FromState !== 'function' || !window.DealScore2) {
    window._dpLastDS2Result = null;
    return null;
  }
  try {
    var deal = window._buildDeal2FromState();
    var result = window.DealScore2.compute(deal);
    window._dpLastDS2Result = result;
    return result;
  } catch (e) {
    console.warn('[V48] DS2 compute fail:', e.message);
    window._dpLastDS2Result = null;
    return null;
  }
}

function dpUpdateAll() {
  // 1. State neu konsolidieren (Calc-Kette läuft synchron)
  if (typeof calcNow === 'function') {
    try { calcNow(); } catch(e) { console.warn('[V48] calcNow fail:', e); }
  }
  // 2. DS2 zentral rechnen — alle Anzeigen lesen aus _dpLastDS2Result
  _dpComputeDS2Cached();
  // 3. Header
  if (typeof updHeader === 'function') { try { updHeader(); } catch(e) {} }
  // 4. Alter DealScore (zeigt jetzt DS2-Wert)
  if (typeof renderDealScore === 'function') { try { renderDealScore(); } catch(e) {} }
  // 5. Investor Deal Score (DS2)
  if (typeof renderDealScore2 === 'function') { try { renderDealScore2(); } catch(e) {} }
  // 6. Read-only-Block
  if (typeof renderDs2Readonly === 'function') { try { renderDs2Readonly(); } catch(e) {} }
  // 7. Sidebar-Karten
  if (typeof renderSaved === 'function') { try { renderSaved(); } catch(e) {} }
}

window._dpComputeDS2Cached = _dpComputeDS2Cached;
window.dpUpdateAll = dpUpdateAll;

// ═══════════════════════════════════════════════════════════════
// V63.4: Toggle für Investor Deal Score im Header (minimierbar)
// ═══════════════════════════════════════════════════════════════
function toggleHdrScore() {
  var collapsed = document.body.classList.toggle('hdr-collapsed');
  try { localStorage.setItem('dp_hdr_collapsed', collapsed ? '1' : '0'); } catch(e) {}
  // V63.20: Kein Label mehr, Chevron-Rotation rein über CSS (body.hdr-collapsed)
  // Header-Höhe neu messen damit Tabs korrekt anschließen
  if (typeof _updateHdrHeight === 'function') _updateHdrHeight();
}
window.toggleHdrScore = toggleHdrScore;

// V63.7: Beim Laden den Toggle-Zustand wiederherstellen.
// DEFAULT = COLLAPSED (kompakt) — nur expandiert wenn User es explizit anders will.
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    try {
      var saved = localStorage.getItem('dp_hdr_collapsed');
      // V63.22: Default-State = EXPANDED (User-Wunsch). Nur collapse wenn explizit '1' im Storage.
      var shouldCollapse = (saved === '1');
      if (shouldCollapse) {
        document.body.classList.add('hdr-collapsed');
      } else {
        document.body.classList.remove('hdr-collapsed');
      }
    } catch(e) {}
  }, 100);
});

// V63.4: Toggle-Button nur anzeigen wenn Score wirklich vorhanden ist
function _updateHdrToggleVisibility() {
  var btn = document.getElementById('hdr-toggle-btn');
  var box = document.getElementById('hdr-badges');
  if (!btn || !box) return;
  // Sichtbar wenn Score-Card oder KPI-Pills im Box drin sind (nicht Banner oder leer)
  var hasScore = !!box.querySelector('.hdr-score-card');
  btn.style.display = hasScore ? '' : 'none';
}
window._updateHdrToggleVisibility = _updateHdrToggleVisibility;

// V63.45: Misst Header-Höhe und setzt --tabs-top + --wf-top — pixelgenau.
// Reagiert auf:
//   - Resize
//   - Header-Toggle (DealScore eingeklappt) via MutationObserver
//   - Tab-Wechsel
function _updateWfTop() {
  var hdr  = document.querySelector('header.hdr');
  var tabs = document.querySelector('nav.tabs') || document.querySelector('.tabs');
  if (!hdr || !tabs) return;

  // V63.45: Header-Höhe direkt messen (eingeklappt: nur Reihe 1, sonst Reihe 1+2)
  var hdrRect = hdr.getBoundingClientRect();
  var hdrBottom = Math.max(0, Math.round(hdrRect.bottom));
  document.documentElement.style.setProperty('--tabs-top', hdrBottom + 'px');

  // Workflow-Bar muss direkt unter Tab-Bar kleben
  var tabsRect = tabs.getBoundingClientRect();
  var bottom = Math.round(tabsRect.bottom) - 6;
  if (bottom > 0 && bottom < window.innerHeight) {
    document.documentElement.style.setProperty('--wf-top', bottom + 'px');
  }
}
window._updateWfTop = _updateWfTop;
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(_updateWfTop, 100);
  setTimeout(_updateWfTop, 500);
  setTimeout(_updateWfTop, 1500);

  // V63.45: MutationObserver auf body class — fängt hdr-collapsed/expanded ab
  if (window.MutationObserver) {
    var obs = new MutationObserver(function() {
      // Mehrfach-Updates: direkt + nach Transition (180ms)
      _updateWfTop();
      setTimeout(_updateWfTop, 50);
      setTimeout(_updateWfTop, 220);
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
});
window.addEventListener('resize', _updateWfTop);
// V63.29: Scroll-Listener IMMER ausführen — vorher nur scrollY<50 (limitierte
// Updates wenn User schnell rauf/runter scrollt). Throttled via requestAnimationFrame.
var _wfScrollPending = false;
window.addEventListener('scroll', function() {
  if (!_wfScrollPending) {
    _wfScrollPending = true;
    requestAnimationFrame(function() {
      _updateWfTop();
      _wfScrollPending = false;
    });
  }
}, { passive: true });
// ResizeObserver für die Tab-Bar
if (typeof ResizeObserver !== 'undefined') {
  setTimeout(function() {
    var tabs = document.querySelector('nav.tabs') || document.querySelector('.tabs');
    if (tabs) {
      var ro = new ResizeObserver(_updateWfTop);
      ro.observe(tabs);
    }
    var hdr = document.getElementById('hdr-badges') || document.querySelector('header');
    if (hdr) {
      var ro2 = new ResizeObserver(_updateWfTop);
      ro2.observe(hdr);
    }
  }, 200);
}
