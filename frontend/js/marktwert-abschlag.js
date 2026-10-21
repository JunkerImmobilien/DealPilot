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
  /** woher der Satz kommt - für Hinweise und den Urteilstext.
      v2237d · Marcel: „bitte auch keine Quelle wie ImmobilienScout angeben" -
      nach außen steht nur, OB es der Marktdurchschnitt oder dein Wert ist;
      Quelle, Stand und Link bleiben intern in config.js. */
  function quelle() {
    var m = markt(), s = satz();
    return Math.abs(s - m.pct) < 1e-9 ? 'aktueller Marktdurchschnitt' : 'dein Wert aus den Einstellungen';
  }

  /* v2490 · der EIGENE Satz aus den Einstellungen, sonst null - EINE Stelle fuer
     beide Abrufe (Reiter Objekt: dealpilot-mb.js, Quick-Check-iframe:
     dealpilot-mb-qc.js). Bis v2489 schickte nur der Reiter Objekt ihn mit;
     der Quick-Check rechnete trotz eigenem Wert mit dem oertlichen Satz oder
     dem Marktdurchschnitt. */
  function eigen() {
    var P = profil(), v = null;
    try { v = P && P.get ? P.get('angebot_abschlag_pct') : null; } catch (e) {}
    var n = (v == null || v === '') ? NaN : Number(String(v).replace(',', '.'));
    return (isFinite(n) && n >= 0 && n < 50) ? n : null;
  }
  /* v2490 · Herkunft eines Kartensatzes in Kundensprache (card.abschlag.quelle
     kommt aus mapCard: 'dein Wert' | 'oertliche Kauffaelle' | 'Marktdurchschnitt').
     Nach aussen keine Datenquelle - nur, WOHER der Satz stammt. */
  function herkunftText(a) {
    var q = String((a && a.quelle) || '');
    if (/dein/i.test(q)) return 'dein Wert aus den Einstellungen';
    if (/rtlich/i.test(q)) return 'örtlich gemessen an den Kauffällen des Gutachterausschusses';
    return 'aktueller Marktdurchschnitt';
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
    if (!a || !(Number(a.pct) > 0)) { if (alt) alt.remove(); return; }
    /* v2490 · mit Herkunft - Marcel sah 15,9 % im Reiter Objekt (Bielefeld, oertlich
       gemessen) und 5,8 % im Quick-Check (Marktdurchschnitt) und konnte den
       Unterschied nirgends ablesen. */
    var txt = ' · inkl. ' + String(a.pct).replace('.', ',') + ' % Abschlag auf Angebotspreise ('
      + (/rtlich/i.test(String(a.quelle || '')) ? 'örtlich gemessen' : herkunftText(a)) + ')';
    if (alt && alt.textContent === txt) return;
    /* v2237d · Marcel: „Formatierung passt nicht". Der Hinweis hängt jetzt an
       der vorhandenen Fußzeile der Karte (.legal, „Marktpreisindikation — kein
       Gutachten …") und erbt deren Schrift - keine eigene Zeile mit eigenem Stil. */
    if (!alt) {
      var legal = karte.querySelector('.legal'); if (!legal) return;
      alt = document.createElement('span'); alt.className = 'dp-abschlag'; legal.appendChild(alt);
    }
    alt.textContent = txt;
  }
  if (typeof MutationObserver === 'function') {
    var _t = null;
    new MutationObserver(function () { if (_t) return; _t = setTimeout(function () { _t = null; hinweisSetzen(); }, 120); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  global.DealPilotAbschlag = { satz: satz, markt: markt, quelle: quelle, anwenden: anwenden, eigen: eigen, herkunftText: herkunftText };
})(window);
