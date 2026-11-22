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
   Kueche als sonstiger Ertrag mit eigener Dauer (marktbericht lib/zusatz_einnahmen.js).

   v3800 · Marcel 19.11.2026 nach dem Termin bei der Kanzlei: „Einnahmen aus Garagen … unter dem Tab
   zusaetzliche Einnahmen die Gesamtsumme wieder reinschreiben, aber darunter aufklappen … um diese
   Sondersachen abzubilden." Zwei Teile dazu: ze_werb_monat (Werbeflaeche) und ze_funk_monat
   (Antenne / Mobilfunk / Dachflaeche). Jeder Teil nennt seine Stelle in der Anlage V (ohne Nummer -
   die steht je Jahr in js/anlage-v-<Jahr>.js): Stellplatz/Garage, Werbeflaeche, Antenne -> sonstige
   Einnahmen „Garagen, Werbeflaechen, Grund und Boden"; Kueche und Sonstiges -> Mieteinnahmen der Wohnung.
   tax.js liest den Anteil ueber teile(). Der Marktbericht kennt die neuen Teile nicht und nimmt sie wie
   bisher ueber den Rest (ze - Stellplatz - Kueche) unter Sonstiges: kapitalisiert, wie es sein soll. */
(function () {
  'use strict';
  var TEILE = ['ze_stp_monat', 'ze_kueche_monat', 'ze_werb_monat', 'ze_funk_monat', 'ze_sonst_monat'];   /* v3800: + Werbeflaeche, Antenne */
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
  /* Ein Import schreibt mehrere Teile nacheinander (Mietvertrag: Stellplatz, dann Kueche). Der Rest unter
     Sonstiges wird deshalb gegen den Betrag VOR dem ersten Teil (_basis) nachgefuehrt, solange niemand
     Sonstiges selbst geaendert hat - sonst zaehlte ein Kuechenanteil, der schon in ze steckte, doppelt. */
  var _basis = null;
  function teilGeaendert(id) {
    var so = el('ze_sonst_monat');
    if (!_warAufgeteilt && !_imSetzen) {
      var z = el('ze'), v = z ? (zahl(z.value) || 0) : 0;
      _basis = v > 0 && id !== 'ze_sonst_monat' ? v : null;
    } else if (id === 'ze_sonst_monat' || _imSetzen) _basis = null;
    if (_basis != null && so) {
      var stp = zahl((el('ze_stp_monat') || {}).value) || 0, kue = zahl((el('ze_kueche_monat') || {}).value) || 0;
      var wer = zahl((el('ze_werb_monat') || {}).value) || 0, fun = zahl((el('ze_funk_monat') || {}).value) || 0;   /* v3800 */
      var rest = Math.round((_basis - stp - kue - wer - fun) * 100) / 100;
      so.value = rest > 0.005 ? de(rest) : '';
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
    var map = { stp: 'ze_stp_monat', kueche: 'ze_kueche_monat', werb: 'ze_werb_monat', funk: 'ze_funk_monat', sonst: 'ze_sonst_monat' };
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
    /* eine echte Eingabe (isTrusted) beendet die Nachfuehrung des Rests: wer selbst tippt, bestimmt die Summe */
    if (TEILE.indexOf(id) >= 0) { if (e.isTrusted) _basis = null; if (!_leeren) teilGeaendert(id); }
    else if (id === 'ze') zeGeaendert();
  }, true);
  document.addEventListener('toggle', function (e) { if (e.target && e.target.id === 'ze-auft') beimOeffnen(); }, true);

  /* Nach dem Laden eines Objekts nur zeichnen (gespeicherte Werte bleiben, wie sie sind). */
  if (typeof window.loadData === 'function' && !window.loadData._zeAuft) {
    var _orig = window.loadData;
    window.loadData = function () { var r = _orig.apply(this, arguments); _basis = null; try { zeichnen(); } catch (e) {} return r; };
    window.loadData._zeAuft = true;
  }
  /* neues Objekt: _newObjLeeren (storage.js) leert die Felder ohne Ereignis - die Sperre von ze muss mit */
  if (typeof window._newObjLeeren === 'function' && !window._newObjLeeren._zeAuft) {
    var _origN = window._newObjLeeren;
    window._newObjLeeren = function () { var r = _origN.apply(this, arguments); _basis = null; try { zeichnen(); } catch (e) {} return r; };
    window._newObjLeeren._zeAuft = true;
  }
  function stil() {
    if (el('ze-auft-stil')) return;
    var s = document.createElement('style'); s.id = 'ze-auft-stil';
    s.textContent = '.ze-auft{margin-top:6px}'
      + '.ze-auft>summary{cursor:pointer;font-size:12px;color:var(--wl-7a5d18, #7a5d18);list-style:none;display:inline-block;padding:2px 0}'
      + '.ze-auft>summary::-webkit-details-marker{display:none}'
      + '.ze-auft>summary::before{content:"\\25B8  "}.ze-auft[open]>summary::before{content:"\\25BE  "}'
      + '.ze-auft-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:6px}'
      + '.ze-auft-grid .f{margin:0}.ze-auft-grid label{font-size:11px}'
      + '.ze-auft-grid .ze-av{display:block;font-size:10px;line-height:1.3;color:var(--muted, #7a7370);margin-top:2px}'
      + 'input.ze-gesperrt{opacity:.75;cursor:not-allowed}'
      + '@media (max-width:640px){.ze-auft-grid{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function start() { stil(); zeichnen(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /** v3800 · Teile je Monat (Zahlen, fehlend 0) - fuer die Anlage V (tax.js av_garagen). */
  function teile() {
    var w = function (id) { var e = el(id); return e ? (zahl(e.value) || 0) : 0; };
    return { stp: w('ze_stp_monat'), kueche: w('ze_kueche_monat'), werb: w('ze_werb_monat'), funk: w('ze_funk_monat'), sonst: w('ze_sonst_monat') };
  }
  window.DpZeAufteilung = { TEILE: TEILE, aufgeteilt: aufgeteilt, summe: summe, setzen: setzen, zeichnen: zeichnen, teile: teile };
})();
