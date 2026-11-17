/* ══ v3670 · ZUSAETZLICHE EINNAHMEN AUFTEILEN (Reiter Miete) ═══════════════════════════════
   Marcel 17.11.2026: „Wir haben im Tab Miete ein Feld dafuer, das heisst zusaetzliche
   Einnahmen. Dort haben wir Kueche und Stellplatz als Summe … Alternativ koennten wir
   darunter zum Ausklappen auch trennen, aber nur wenn erforderlich."

   - `ze` bleibt die SUMME (€/Monat). Alle Rechnungen (calc.js, Score, Rendite, DSCR,
     Steuer, Flow, Telegram) lesen weiter nur `ze`.
   - Darunter „aufteilen" mit drei Feldern: ze_stp_monat (Stellplatz/Garage),
     ze_kueche_monat (Kueche/Moeblierung), ze_sonst_monat (Sonstiges).
   - Ist mindestens ein Teil eingetragen, ist `ze` gesperrt und = Summe der Teile.
     Ist nichts eingetragen, gilt `ze` als Ganzes (Altbestand unveraendert).
   - Wer aufteilt, findet den bisherigen Betrag im Feld Stellplatz/Garage vor (Regelfall,
     so liest ihn auch der Marktbericht ohne Aufteilung). Nichts verschwindet, nichts doppelt.
   - Schreibt ein Skript (Import) `ze` direkt, waehrend aufgeteilt ist, gilt der neue Betrag
     als Ganzes und die Aufteilung wird aufgehoben (sonst stuende eine Summe neben Teilen,
     die nicht zu ihr passen).
   Der Marktbericht liest die Teile: Stellplatz + Sonstiges kapitalisiert (Rohertrag),
   Kueche als sonstiger Ertrag mit eigener Dauer (marktbericht lib/zusatz_einnahmen.js). */
(function () {
  'use strict';
  var TEILE = ['ze_stp_monat', 'ze_kueche_monat', 'ze_sonst_monat'];
  function el(id) { return document.getElementById(id); }
  function zahl(v) {
    var t = String(v == null ? '' : v).trim().replace(/[^\d.,-]/g, '');
    if (!t) return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    var n = parseFloat(t);
    return isFinite(n) ? n : null;
  }
  function de(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
  function aufgeteilt() { return TEILE.some(function (id) { var e = el(id); return e && String(e.value || '').trim() !== ''; }); }
  function summe() { return TEILE.reduce(function (a, id) { var e = el(id); return a + (e ? (zahl(e.value) || 0) : 0); }, 0); }

  var _selbst = false, _leeren = false, _imSetzen = false, _warAufgeteilt = false;   /* eigene Schreibvorgaenge auf ze nicht als Import deuten */
  function zeSchreiben(wert) {
    var z = el('ze'); if (!z) return;
    var neu = wert > 0 ? de(wert) : '';
    if (String(z.value) === neu) return;
    z.value = neu;
    _selbst = true;
    try { z.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}   /* calc() + Speichern */
    _selbst = false;
  }
  /** Zustand zeichnen: Sperre von ze, Aufklapper offen, Hinweis. Schreibt keine Werte. */
  function zeichnen() {
    var z = el('ze'), d = el('ze-auft'); if (!z) return;
    var auf = aufgeteilt();
    _warAufgeteilt = auf;
    z.readOnly = auf;
    z.classList.toggle('ze-gesperrt', auf);
    z.title = auf ? 'Summe aus der Aufteilung darunter' : '';
    if (d && auf && !d.open) d.open = true;
    var h = el('ze-auft-stand');
    if (h) h.textContent = auf ? 'Summe aus der Aufteilung: ' + de(summe()) + ' €' : '';
  }
  /** Aufklappen: der bisherige Betrag steht im Feld Stellplatz/Garage (Regelfall). */
  function beimOeffnen() {
    var d = el('ze-auft'), z = el('ze');
    if (!d || !d.open || !z || aufgeteilt()) return;
    var v = zahl(z.value);
    var s = el('ze_stp_monat');
    if (v > 0 && s) { s.value = de(v); zeichnen(); }
  }
  /* Uebergang ungeteilt -> geteilt durch ein Skript (Import schreibt einen Teil): der bisherige
     Betrag geht nicht verloren, sein Rest steht unter Sonstiges. Wer selbst aufklappt, hat den
     Betrag schon im Feld Stellplatz/Garage (beimOeffnen) und kommt hier nicht hin. */
  function teilGeaendert() {
    if (!_warAufgeteilt && !_imSetzen) {
      var z = el('ze'), v = z ? (zahl(z.value) || 0) : 0, s = summe(), so = el('ze_sonst_monat');
      if (so && v - s > 0.005) so.value = de((zahl(so.value) || 0) + v - s);
    }
    zeSchreiben(summe()); zeichnen();
  }
  /** Ein Skript hat ze geschrieben, waehrend aufgeteilt ist: der neue Betrag gilt als Ganzes. */
  function zeGeaendert() {
    if (_selbst || !aufgeteilt()) return;
    var z = el('ze'); if (!z) return;
    if (Math.abs((zahl(z.value) || 0) - summe()) < 0.005) return;
    _leeren = true;
    try { TEILE.forEach(function (id) { var e = el(id); if (e && e.value !== '') { e.value = ''; try { e.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {} } }); }
    finally { _leeren = false; }
    zeichnen();
  }
  /** Teile von aussen setzen (Importe): { stp, kueche, sonst } in €/Monat, fehlend = unveraendert.
      Ohne Aufteilung bisher wird ein bisheriger Betrag NICHT still dazugezaehlt: was der Import
      nennt, ersetzt die Summe (die Uebernahme zeigt beide Werte zum Abgleich an). */
  function setzen(t) {
    t = t || {};
    var map = { stp: 'ze_stp_monat', kueche: 'ze_kueche_monat', sonst: 'ze_sonst_monat' };
    var neu = !aufgeteilt();
    Object.keys(map).forEach(function (k) {
      var e = el(map[k]); if (!e) return;
      if (t[k] != null && t[k] !== '') e.value = zahl(t[k]) > 0 ? de(zahl(t[k])) : '';
      else if (neu) e.value = '';
    });
    _imSetzen = true;
    try { teilGeaendert(); } finally { _imSetzen = false; }
    TEILE.forEach(function (id) { var e = el(id); if (e) { _leeren = true; try { e.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {} finally { _leeren = false; } } });   /* Speichern */
    return summe();
  }

  document.addEventListener('input', function (e) {
    var id = e.target && e.target.id;
    if (TEILE.indexOf(id) >= 0) { if (!_leeren) teilGeaendert(); }
    else if (id === 'ze') zeGeaendert();
  }, true);
  document.addEventListener('toggle', function (e) { if (e.target && e.target.id === 'ze-auft') beimOeffnen(); }, true);

  /* Nach dem Laden eines Objekts nur zeichnen (gespeicherte Werte bleiben, wie sie sind). */
  if (typeof window.loadData === 'function' && !window.loadData._zeAuft) {
    var _orig = window.loadData;
    window.loadData = function () { var r = _orig.apply(this, arguments); try { zeichnen(); } catch (e) {} return r; };
    window.loadData._zeAuft = true;
  }
  function stil() {
    if (el('ze-auft-stil')) return;
    var s = document.createElement('style'); s.id = 'ze-auft-stil';
    s.textContent = '.ze-auft{margin-top:6px}'
      + '.ze-auft>summary{cursor:pointer;font-size:12px;color:var(--wl-c9a84c, #C9A84C);list-style:none;display:inline-block;padding:2px 0}'
      + '.ze-auft>summary::-webkit-details-marker{display:none}'
      + '.ze-auft>summary::before{content:"\\25B8  "}.ze-auft[open]>summary::before{content:"\\25BE  "}'
      + '.ze-auft-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:6px}'
      + '.ze-auft-grid .f{margin:0}.ze-auft-grid label{font-size:11px}'
      + 'input.ze-gesperrt{opacity:.75;cursor:not-allowed}'
      + '@media (max-width:640px){.ze-auft-grid{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function start() { stil(); zeichnen(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.DpZeAufteilung = { TEILE: TEILE, aufgeteilt: aufgeteilt, summe: summe, setzen: setzen, zeichnen: zeichnen };
})();
