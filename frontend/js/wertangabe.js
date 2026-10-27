'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   wertangabe.js — v3003a · EINE Wertangabe: Marktwert/Verkehrswert + Herkunft

   Marcel, 27.10.2026: „Brauchen wir das Feld Bankbewertung überhaupt noch,
   wenn es die Herkunft gibt?" — Nein. Seit v2996 trägt `svw_herkunft` die
   Option „Bankbewertung". Das Feld `bankval` wird nicht mehr angezeigt.

   GEMESSEN vorher: ~40 Leser von `bankval` in 13 Dateien, mit ZWEI
   Rangfolgen — calc.js nahm den Verkehrswert vor der Bank, storage.js
   (Portfolio-Marktwert), track-record.js und ds2-ai.js die Bank vor dem
   Verkehrswert. Dasselbe Objekt hatte so im Reiter und im Portfolio einen
   anderen Marktwert.

   Hier steht die EINE Regel, die alle Leser nehmen (aufloesen):
     · bankval leer (oder schon übernommen)  → svwert mit seiner Herkunft
     · svwert leer                            → bankval, Herkunft Bankbewertung
     · beide gleich                           → svwert, Herkunft wie gewählt, sonst Bank
     · verschieden, Herkunft Gutachten/Bank   → svwert bleibt, der andere Betrag als Hinweis
     · verschieden, sonst                     → svwert bleibt (v3003b), die Bankbewertung
                                                als Hinweis mit Knopf „übernehmen“ - der
                                                Nutzer entscheidet; nie ein Betrag still weg
   `bankval` bleibt gespeichert und wird NIE gelöscht. Beim Laden überträgt
   `uebernehmen()` die Regel EINMAL ins Formular (svwert, svw_herkunft) und
   setzt `bankval_migriert` — sonst überschriebe ein alter Bankwert jede
   spätere Änderung des Nutzers wieder. Geschrieben wird erst beim Speichern
   durch den Nutzer.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  if (global.DpWertangabe) return;
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
    var s = String(v).trim(); if (!s) return null;
    var n = (typeof global.parseDe === 'function') ? global.parseDe(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return (n != null && isFinite(n) && n > 0) ? n : null;
  }
  /** d: Objektdaten (gespeicherter Blob oder Formular). → { wert, herkunft, anders, aus } */
  function aufloesen(d) {
    d = d || {};
    var sv = num(d.svwert), bv = num(d.bankval), h = String(d.svw_herkunft || '');
    var mig = String(d.bankval_migriert || '') === '1';
    if (mig || !bv) return { wert: sv, herkunft: sv ? (h || null) : null, anders: (mig && bv && sv && Math.abs(bv - sv) >= 1) ? bv : null, aus: 'svwert' };
    if (!sv) return { wert: bv, herkunft: 'bank', anders: null, aus: 'bankval' };
    if (Math.abs(sv - bv) < 1) return { wert: sv, herkunft: h || 'bank', anders: null, aus: 'svwert' };
    if (h === 'gutachten' || h === 'bank') return { wert: sv, herkunft: h, anders: bv, aus: 'svwert' };
    /* v3003b · bis v3003a gewann hier die Bank und der Verkehrswert stand nur bis zum Speichern
       als Hinweis da - danach war er weg. Jetzt bleibt svwert, die Bank wartet auf den Nutzer. */
    return { wert: sv, herkunft: h || null, anders: bv, aus: 'svwert', bankWahl: true };
  }
  /** Marktwert für Summen (Portfolio, Track Record, KI): dieselbe Grenze wie calc.js wert_basis —
      eine Marktpreisindikation aus Angebotspreisen ist kein Wert-Anker, dann der Kaufpreis. */
  function marktwert(d, kp) {
    var r = aufloesen(d);
    if (r.wert && r.herkunft !== 'indikation') return r.wert;
    return num(kp != null ? kp : (d && d.kp)) || 0;
  }
  function el(id) { return document.getElementById(id); }
  function ausFormular() {
    var g = function (id) { var e = el(id); return e ? e.value : ''; };
    return { svwert: g('svwert'), bankval: g('bankval'), svw_herkunft: g('svw_herkunft'), bankval_migriert: g('bankval_migriert'), kp: g('kp') };
  }
  function fmt(n) { try { return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n) + ' €'; } catch (e) { return String(n); } }
  function hinweis(r) {
    var sv = el('svwert'); var f = sv && sv.closest ? sv.closest('.f') : null; if (!f) return;
    var h = el('wa-hinweis');
    if (r && r.anders) {
      if (!h) { h = document.createElement('div'); h.id = 'wa-hinweis'; h.className = 'cf-hint'; h.style.marginTop = '4px'; f.appendChild(h); }
      h.textContent = 'Zusätzlich erfasst: Bankbewertung ' + fmt(r.anders) + ' — bitte prüfen, welcher Betrag gilt. ';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline'; b.style.cssText = 'margin-left:6px;padding:2px 8px;font-size:11.5px';
      b.textContent = 'Bankbewertung übernehmen';
      b.onclick = function () {
        var sv = el('svwert'), hs = el('svw_herkunft');
        if (sv) sv.value = String(Math.round(r.anders));
        if (hs) hs.value = 'bank';
        try { if (typeof global.calc === 'function') global.calc(); } catch (e) {}
        h.textContent = 'Bankbewertung übernommen. Der bisherige Wert stand bei ' + fmt(r.vorher) + '.';
      };
      r.vorher = num(el('svwert') && el('svwert').value);
      h.appendChild(b);
    } else if (h) h.remove();
  }
  /** Einmal je Objekt: die Regel ins Formular übertragen. Schreibt nichts in die Datenbank. */
  function uebernehmen() {
    var F = ausFormular(), r = aufloesen(F);
    var bv = num(F.bankval);
    if (bv && String(F.bankval_migriert) !== '1') {
      var sv = el('svwert'), hs = el('svw_herkunft'), m = el('bankval_migriert');
      if (sv && r.wert && num(sv.value) !== r.wert) sv.value = String(Math.round(r.wert));
      if (hs && r.herkunft && hs.value !== r.herkunft) hs.value = r.herkunft;
      if (m) m.value = '1';
      try { if (typeof global.calc === 'function') global.calc(); } catch (e) {}
    }
    hinweis(r);
    return r;
  }
  global.addEventListener('dp:object-ready', function () { setTimeout(uebernehmen, 200); });
  global.DpWertangabe = { aufloesen: aufloesen, marktwert: marktwert, ausFormular: ausFormular, uebernehmen: uebernehmen, num: num };
})(window);
