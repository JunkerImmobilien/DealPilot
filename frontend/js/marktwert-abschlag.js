'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   marktwert-abschlag.js · v2237 — Abschlag auf Angebotspreise

   Marcel 14.10.2026: „Die Abschläge kann man im Set angeben unter
   Einstellungen, und wir recherchieren immer den aktuellen Durchschnitt.
   Dann können wir unsere Bewertung auch anpassen und das mit in die
   Bewertung reinnehmen."

   - Der SATZ steht im Investmentprofil (`angebot_abschlag_pct`), vorbelegt
     mit dem recherchierten Marktdurchschnitt aus `DealPilotConfig.
     angebotAbschlagMarkt` (Quelle, Stand, Link). Wer nichts einstellt,
     rechnet mit dem Durchschnitt; wer einen eigenen Wert setzt, mit seinem.
   - `anwenden(card)` mindert die Marktwert-Spanne einer DealPilot-
     Marktbewertungskarte (mapCard in dealpilot-mb.js UND dealpilot-mb-qc.js)
     und merkt sich die Angebotswerte in `card.abschlag.roh`. Die MIETE
     bleibt: die Recherche gilt für Kaufpreise.
   - `hinweis()` hängt unter die DealPilot-Karte eine Zeile mit Satz und
     Quelle (avm-section.js ist „nicht anfassen" - Aufsatz wie avsec-spanne).
   Läuft in der Haupt-App und im Quick-Check-iframe (Profil dann aus dem
   Elternfenster).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  if (global.DealPilotAbschlag) return;

  function eltern() { try { return global.parent && global.parent !== global ? global.parent : null; } catch (e) { return null; } }
  function cfg() { var w = eltern(); return global.DealPilotConfig || (w && w.DealPilotConfig) || null; }
  function profil() { var w = eltern(); return global.DealPilotInvestmentProfile || (w && w.DealPilotInvestmentProfile) || null; }

  /** recherchierter Marktdurchschnitt { pct, stand, quelle, url } */
  function markt() { var c = cfg(); return (c && c.angebotAbschlagMarkt) || { pct: 5.8, stand: 'Dezember 2025', quelle: 'ImmoScout24-Marktanalyse' }; }

  /** gültiger Satz in Prozent - eigener Wert, sonst Marktdurchschnitt */
  function satz() {
    var P = profil(), v = null;
    try { v = P && P.get ? P.get('angebot_abschlag_pct') : null; } catch (e) {}
    var n = (v == null || v === '') ? NaN : Number(String(v).replace(',', '.'));
    return (isFinite(n) && n >= 0 && n < 50) ? n : markt().pct;
  }
  /** woher der Satz kommt - für Hinweise und den Urteilstext */
  function quelle() {
    var m = markt(), s = satz();
    return Math.abs(s - m.pct) < 1e-9
      ? 'Marktdurchschnitt ' + m.quelle + ', ' + m.stand
      : 'dein Wert aus den Einstellungen; Marktdurchschnitt ' + String(m.pct).replace('.', ',') + ' %';
  }

  function anwenden(card) {
    if (!card || !card.mw || card.abschlag) return card;
    var s = satz(), f = 1 - s / 100;
    var roh = { low: card.mw.low, med: card.mw.med, high: card.mw.high };
    ['low', 'med', 'high'].forEach(function (k) { if (card.mw[k] != null && isFinite(card.mw[k])) card.mw[k] = Math.round(card.mw[k] * f / 1000) * 1000; });   /* auf volle 1.000 € - eine Schätzung ist nicht eurogenau */
    if (card.area && card.mw.med) card.mw.sqm = Math.round(card.mw.med / card.area).toLocaleString('de-DE') + ' €/m²';
    card.abschlag = { pct: s, roh: roh, quelle: quelle() };
    return card;
  }

  /* ── Hinweis unter der DealPilot-Karte ── */
  function hinweisSetzen() {
    var host = document.getElementById('avsec'); if (!host) return;
    var karte = host.querySelector('.mc.dp'); if (!karte) return;
    var st = null; try { var el = document.getElementById('_mb_state'); st = el && el.value ? JSON.parse(el.value) : null; } catch (e) {}
    var c = st && st.card, a = c && c.abschlag;
    var alt = karte.querySelector('.dp-abschlag');
    if (!a) { if (alt) alt.remove(); return; }
    var txt = 'Nach ' + String(a.pct).replace('.', ',') + ' % Abschlag auf Angebotspreise (' + a.quelle + ')'
      + (a.roh && a.roh.med ? ' · Angebotsniveau Ø ' + Math.round(a.roh.med).toLocaleString('de-DE') + ' €' : '');
    if (alt && alt.textContent === txt) return;
    if (!alt) { alt = document.createElement('div'); alt.className = 'dp-abschlag';
      /* v2237c · als eigene Zeile der Karte VOR dem Fuß - gemessen: in .mbody
         (Raster) wurde sie 1.115 px breit in einer 1.078-px-Spalte und rechts
         abgeschnitten */
      alt.style.cssText = 'display:block;font-size:11.5px;line-height:1.45;opacity:.8;padding:4px 16px 2px;white-space:normal;min-width:0';
      var fuss = karte.querySelector('.mfoot');
      if (fuss) karte.insertBefore(alt, fuss); else karte.appendChild(alt); }
    alt.textContent = txt;
  }
  if (typeof MutationObserver === 'function') {
    var _t = null;
    new MutationObserver(function () { if (_t) return; _t = setTimeout(function () { _t = null; hinweisSetzen(); }, 120); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  global.DealPilotAbschlag = { satz: satz, markt: markt, quelle: quelle, anwenden: anwenden };
})(window);
