/* ═══ v3261 · REITER FINANZIERUNG: ECKDATEN JE DARLEHEN + EINGEKLAPPTE GRUPPEN ═══
 *
 * Marcel 09.11.2026: „Der Tab Darlehen I ist auch irgendwie unübersichtlich.
 * Können wir das übersichtlicher gestalten?"
 *
 * Vorher (v3238/v3256): Darlehen I als eine lange Karte - Bankdaten, Art,
 * Eigenkapital, Konditionen, Kapitaldeckung, Verlauf, Werkzeuge und der
 * Anschluss-Kasten untereinander, alles offen. Darlehen II genauso, ohne
 * Werkzeuge.
 *
 * Jetzt je Darlehen (index.html .fz-gruppen):
 *   Kopf      fünf Kacheln: Darlehenssumme · Zins · Tilgung (bei Aussetzung
 *             „Sparrate BSV" bzw. „ausgesetzt") · Zinsbindung · Rate
 *   Gruppen   <details> Konditionen bearbeiten · Anschlussfinanzierung ·
 *             Bankdaten · Werkzeuge, im Kopf der Gruppe ihr Stand in einer Zeile
 *
 * DIESE DATEI RECHNET NICHTS. Die Kacheln lesen die Formularfelder und die
 * Ausgaben, die calc.js schon geschrieben hat (#d1_rate, #bindend, #restschuld,
 * #d2_rate, #d2_anschl_ab, #r-ltv, State.bsparRate_m). Ausgelöst wird sie von
 * einem MutationObserver auf genau diesen Ausgaben - calc() ist entprellt, ein
 * Haken an calc() käme vor den neuen Werten.
 *
 * Kein Feld wurde verschoben, das eine ID ändert: die Knoten sind in die
 * Gruppen umgehängt. „Konditionen bearbeiten" ist offen, solange keine
 * Darlehenssumme steht (neues Objekt), sonst zu - ein Klick auf eine Kachel
 * öffnet sie und setzt den Cursor ins passende Feld.
 * ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function wert(id) { var e = el(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function zahl(id) {
    var s = wert(id); if (!s) return 0;
    if (typeof window.parseDe === 'function') return window.parseDe(s);
    var n = parseFloat(s.replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0;
  }
  function text(id) { var e = el(id); var t = e ? String(e.textContent || '').trim() : ''; return (t && t !== '—' && t !== '–') ? t : ''; }
  function eur(n) { return n > 0 ? Math.round(n).toLocaleString('de-DE') + ' €' : '—'; }
  function pz(n) { return (n > 0 || n === 0) ? n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %' : '—'; }
  function setze(id, t) { var e = el(id); if (e && e.textContent !== t) e.textContent = t; }
  function an(id) { var e = el(id); return !!(e && e.checked); }

  var ART = { annuitaet: 'Annuitätendarlehen', tilgungsaussetzung: 'Tilgungsaussetzung', kfw: 'KfW-Darlehen' };

  function d1Fuellen() {
    if (!el('d1_kopf')) return;
    var aus = wert('d1_type') === 'tilgungsaussetzung';
    var ltv = text('r-ltv');
    setze('d1_k_summe', eur(zahl('d1')));
    setze('d1_k_summe_u', ltv ? 'LTV ' + ltv.replace(/\s*\(.*$/, '') : '');
    setze('d1_k_zins', zahl('d1') > 0 || wert('d1z') ? pz(zahl('d1z')) : '—');
    if (aus) {
      /* Wortwahl wie im Reiter (financing.js _wortwahl, v3256): keine Tilgung, Sparrate in den Bausparvertrag */
      var sr = (window.State && window.State.bsparRate_m) || 0;
      setze('d1_k_tilg_lbl', 'Sparrate BSV');
      setze('d1_k_tilg', sr > 0 ? eur(sr) : '—');
      setze('d1_k_tilg_u', sr > 0 ? 'je Monat · Tilgung ausgesetzt' : 'Tilgung ausgesetzt');
    } else {
      setze('d1_k_tilg_lbl', 'Tilgung');
      setze('d1_k_tilg', pz(zahl('d1t')));
      setze('d1_k_tilg_u', 'anfänglich p. a.');
    }
    var bj = zahl('d1_bindj') || 10;
    setze('d1_k_bind', bj.toLocaleString('de-DE') + ' Jahre');
    setze('d1_k_bind_u', text('bindend') ? 'bis ' + text('bindend') : '');
    setze('d1_k_rate', text('d1_rate') || '—');
    setze('d1_k_rate_u', aus
      ? 'nur Zinsen' + ((window.State && window.State.bsparRate_m > 0) ? ' · Sparrate extra' : '')
      : (text('d1_zm') ? 'Zinsen ' + text('d1_zm') : ''));

    /* Stand je Gruppe in einer Zeile */
    var rs = text('restschuld');
    setze('d1_grp_kond_stand', (aus ? 'Tilgungsaussetzung' : 'Annuitätendarlehen')
      + (rs ? ' · Restschuld nach ' + bj.toLocaleString('de-DE') + ' J. ' + rs : ''));
    setze('d1_grp_anschl_stand', an('d1_anschl_enable')
      ? pz(zahl('anschl_z')) + ' Zins · ' + pz(zahl('anschl_t')) + ' Tilgung' + (text('anschl_ab') ? ' · ab ' + text('anschl_ab').replace(/^ab\s+/, '') : '')
      : 'nicht angesetzt · Rate läuft weiter');
    var inst = wert('bank_inst'), vn = wert('d1_vertrag');
    setze('d1_grp_bank_stand', (inst || vn) ? [inst, vn ? 'Nr. ' + vn : ''].filter(Boolean).join(' · ') : 'optional · geht in keine Rechnung ein');
    setze('d1_grp_werkz_stand', (aus ? 'Zinsplan' : 'Tilgungsplan') + ' · Bank-PDF');
  }

  function d2Fuellen() {
    if (!el('d2_kopf')) return;
    var typ = wert('d2_type') || 'annuitaet', aus = typ === 'tilgungsaussetzung';
    setze('d2_k_summe', eur(zahl('d2')));
    setze('d2_k_summe_u', ART[typ] || '');
    setze('d2_k_zins', pz(zahl('d2z')));
    if (aus) {
      /* wie Darlehen I und die weiteren Darlehen: Tilgung ausgesetzt, nur Zinsen */
      setze('d2_k_tilg_lbl', 'Tilgung');
      setze('d2_k_tilg', 'ausgesetzt');
      setze('d2_k_tilg_u', 'nur Zinsen');
    } else {
      setze('d2_k_tilg_lbl', 'Tilgung');
      setze('d2_k_tilg', pz(zahl('d2t')));
      setze('d2_k_tilg_u', 'anfänglich p. a.');
    }
    var bj = zahl('d2_bindj') || 10;
    setze('d2_k_bind', bj.toLocaleString('de-DE') + ' Jahre');
    var ende = text('d2_anschl_ab').replace(/^ab\s+/, '');
    setze('d2_k_bind_u', ende ? 'bis ' + ende : '');
    setze('d2_k_rate', text('d2_rate') || '—');
    setze('d2_k_rate_u', aus ? 'nur Zinsen' : '');

    setze('d2_grp_kond_stand', (ART[typ] || 'Annuitätendarlehen')
      + (wert('d2_auszahl') ? ' · Auszahlung ' + wert('d2_auszahl') : ''));
    setze('d2_grp_anschl_stand', an('d2_anschl_enable')
      ? pz(zahl('d2_az')) + ' Zins · ' + pz(zahl('d2_at')) + ' Tilgung' + (ende ? ' · ab ' + ende : '')
      : 'nicht angesetzt · Rate läuft weiter');
    var inst = wert('d2_inst'), vn = wert('d2_vertrag');
    setze('d2_grp_bank_stand', (inst || vn) ? [inst, vn ? 'Nr. ' + vn : ''].filter(Boolean).join(' · ') : 'optional · geht in keine Rechnung ein');
    setze('d2_grp_werkz_stand', (aus ? 'Zinsplan' : 'Tilgungsplan') + ' · Bank-PDF');
    setze('d2_tilg_btn_lbl', aus ? 'Zinsplan' : 'Tilgungsplan');
  }

  var _t = null;
  function fuellen() {
    if (_t) return;
    _t = setTimeout(function () {
      _t = null;
      try { d1Fuellen(); } catch (e) {}
      try { d2Fuellen(); } catch (e) {}
    }, 30);
  }

  /* v3264 · Marcel 09.11.2026: „dann öffnen“ - Konditionen beim Laden immer offen (vorher zu, sobald eine Summe stand) */
  function vorgabe(p) {
    var d = el(p + '_grp_kond'); if (!d) return;
    d.open = true;
  }
  function vorgabeAlle() { vorgabe('d1'); vorgabe('d2'); fuellen(); }

  /* Öffnet die Gruppe(n) um ein Element - für Kachel-Klick, Tour und Messe-Drehbuch */
  window.dpFzOeffnen = function (node) {
    for (var e = node; e && e.nodeType === 1; e = e.parentElement) {
      if (e.tagName === 'DETAILS' && e.classList.contains('fz-gruppe') && !e.open) e.open = true;
    }
    return node;
  };

  function kachel(k) {
    var id = k.getAttribute('data-fz-feld'), f = el(id);
    /* die Gruppe „Konditionen" neben dem Kopf - Darlehen I, II und jedes weitere Darlehen */
    var kopf = k.closest('.fz-kopf'), huelle = kopf && kopf.parentElement;
    var g = huelle && [].filter.call(huelle.children, function (c) { return c.matches('details.fz-gruppe[data-fz-gruppe="kond"]'); })[0];
    if (g) g.open = true;
    /* Tilgung bei Aussetzung gesperrt: ins erste offene Feld der Gruppe */
    if ((!f || f.disabled) && kopf.getAttribute('data-fz-darlehen')) f = el(kopf.getAttribute('data-fz-darlehen'));
    if ((!f || f.disabled) && g) f = g.querySelector('input:not([type="hidden"]):not([disabled]), select');
    if (f) {
      window.dpFzOeffnen(f);
      try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (_) {} }
      try { (f.closest('.f') || f).scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }
  }
  document.addEventListener('click', function (ev) {
    var k = ev.target && ev.target.closest ? ev.target.closest('.fz-kopf > .fz-kachel') : null;
    if (k) kachel(k);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var k = ev.target && ev.target.closest ? ev.target.closest('.fz-kopf > .fz-kachel') : null;
    if (k) { ev.preventDefault(); kachel(k); }
  });

  /* Eingaben im Reiter und die Ausgaben von calc.js */
  document.addEventListener('input', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('#d1_gruppen, #d2_gruppen, #bspar_card')) fuellen(); });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.closest) return;
    if (t.id === 'd2_enable' && t.checked) vorgabe('d2');
    if (t.closest('#d1_gruppen, #d2_gruppen, #bspar_card') || t.id === 'd2_enable') fuellen();
  });
  function beobachten() {
    if (typeof MutationObserver !== 'function') return;
    var mo = new MutationObserver(fuellen);
    ['d1_rate', 'd1_zm', 'restschuld', 'bindend', 'anschl_ab', 'd2_rate', 'd2_anschl_ab', 'r-ltv'].forEach(function (id) {
      var e = el(id); if (e) mo.observe(e, { childList: true, characterData: true, subtree: true });
    });
  }

  window.dpFzKopf = fuellen;
  window.addEventListener('dp:object-ready', function () { setTimeout(vorgabeAlle, 450); });
  function start() { beobachten(); setTimeout(vorgabeAlle, 600); }
  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
