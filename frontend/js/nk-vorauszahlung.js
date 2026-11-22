'use strict';
/* ═══ js/nk-vorauszahlung.js — v3950 · NEBENKOSTEN-VORAUSZAHLUNG JE MIETVERHAELTNIS ═════════════════
 *
 * Marcel 22.11.2026: neues Feld „Nebenkosten-Vorauszahlung“ je Mietverhaeltnis bzw. Einheit, sichtbar ab
 * Detailgrad Fortgeschritten. Bei ViVi heisst es monthly_utility_costs und ist beim Anlegen eines
 * Mietverhaeltnisses Pflicht. Vorbelegt mit den umlagefaehigen Kosten / 12, je Einheit nach Wohnflaeche,
 * aber aenderbar. Es ist der monatliche ABSCHLAG des Mieters (§ 556 Abs. 2 BGB) und darf von den
 * tatsaechlichen umlagefaehigen Kosten abweichen.
 *
 * GEMESSEN vor dem Bau (22.11.2026):
 *   · Die umlagefaehigen Kosten stehen im Reiter Bewirtschaftung als JAHRESWERTE hg_ul + grundsteuer +
 *     ul_sonst + kp1..kp4 (calc.js Zeile „ul = …“) und gespiegelt als MONATSWERT #umlagef im Reiter Miete
 *     (main.js V187, beidseitiger Abgleich). Dieselben Posten nimmt dieser Vorschlag.
 *   · Je MFH-Wohnung gibt es das Feld schon: _mfh.einheiten[].nk_vorauszahlung (mfh-einheiten.js, Wohnungs-
 *     fenster, gefuellt auch vom Unterlagen-Import). Auf Objektebene (ETW, EFH) fehlte es: #nk_vorauszahlung
 *     in der Karte Mietvertrag, gleicher Name.
 *
 * KEIN RECHENKERN liest dieses Feld. Cashflow, DSCR und KPI rechnen weiter mit den umlagefaehigen Kosten.
 * Leer heisst: es gilt der Vorschlag (Platzhalter im Feld, Hinweis darunter, Knopf „übernehmen“).
 * Dieselbe Rechnung steht im Backend in services/vivi/viviMapping.js nkVorschlag(); tools/vivi-pruefen.mjs
 * haelt beide an denselben Faellen gleich.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpNkVorauszahlung) return;
  var UL_FELDER = ['hg_ul', 'grundsteuer', 'ul_sonst', 'kp1', 'kp2', 'kp3', 'kp4'];
  var ARTEN_MIT_EINHEITEN = { MFH: 1, ZFH: 1, GESCH: 1, BUERO: 1, HOTEL: 1, GEW: 1 };

  /* wie DpDarlehenWeitere.zahl(): "50.000" -> 50000, "3,1" -> 3.1, "3.5" -> 3.5, leer -> null */
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/\s|€|%/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function ulJahr(d) {
    var s = 0, hat = false;
    UL_FELDER.forEach(function (k) { var n = zahl(d && d[k]); if (n != null) { s += n; hat = true; } });
    if (hat && s > 0) return s;
    var m = zahl(d && d.umlagef);
    return m != null && m > 0 ? m * 12 : 0;
  }
  function liste(d) {
    if (!ARTEN_MIT_EINHEITEN[String((d && d.objart) || '').toUpperCase()]) return [];
    var m = d && d._mfh;
    if (!m || !Array.isArray(m.einheiten)) return [];
    var aus = [];
    m.einheiten.forEach(function (e, i) {
      if (!e || typeof e !== 'object') return;
      if ((zahl(e.wfl) || 0) > 0 || (zahl(e.ist) || 0) > 0 || String(e.lage || '').trim()) aus.push({ e: e, index: i });
    });
    return aus;
  }
  /** Vorschlag in Euro je Monat (ganze Euro) oder null. index = Position in _mfh.einheiten, null = ganzes Objekt. */
  function vorschlag(d, index) {
    var jahr = ulJahr(d);
    if (!(jahr > 0)) return null;
    var L = liste(d);
    if (index == null || !L.length) return Math.round(jahr / 12);
    var ziel = null;
    L.forEach(function (x) { if (x.index === index) ziel = x; });
    if (!ziel) return null;
    var summe = L.reduce(function (a, x) { return a + (zahl(x.e.wfl) || 0); }, 0);
    var anteil = summe > 0 ? (zahl(ziel.e.wfl) || 0) / summe : 1 / L.length;
    return Math.round(jahr / 12 * anteil);
  }

  /* ── Formular ─────────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  /* Die Werte aus dem Formular als Datensatz, wie ihn vorschlag() erwartet. einheiten: Arbeitsstand des Fensters. */
  function ausFormular(einheiten) {
    var d = {};
    UL_FELDER.concat(['umlagef', 'objart']).forEach(function (k) { var e = $(k); if (e) d[k] = e.value; });
    var m = einheiten ? { einheiten: einheiten } : window._dpMfh;
    if (m && Array.isArray(m.einheiten)) d._mfh = { einheiten: m.einheiten };
    return d;
  }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function text(n) { return 'Vorschlag aus den umlagefähigen Kosten: ' + eur(n) + ' im Monat. Leer gilt dieser Wert.'; }

  function objektFeld() {
    var inp = $('nk_vorauszahlung'), h = $('nk-vz-hinweis');
    if (!inp) return;
    var v = vorschlag(ausFormular(), null);
    var ph = v != null ? String(v) : '';
    if (inp.placeholder !== ph) inp.placeholder = ph;
    if (!h) return;
    var leer = !String(inp.value || '').trim();
    var soll = v == null ? '' : (leer ? text(v) : 'Vorschlag ' + eur(v) + ' im Monat.');
    if (h.getAttribute('data-nkvz') !== soll) {
      h.setAttribute('data-nkvz', soll);
      h.textContent = soll;
      if (v != null && leer && !inp.readOnly) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn btn-sm btn-ghost'; b.id = 'nk-vz-uebernehmen';
        b.style.cssText = 'margin-left:6px;padding:1px 8px;font-size:11px';
        b.textContent = 'übernehmen';
        b.addEventListener('click', function () { inp.value = String(v); try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} objektFeld(); });
        h.appendChild(b);
      }
    }
  }
  /* MFH: im Wohnungsfenster (mfh-einheiten.js) den Vorschlag als Platzhalter. einheiten = Arbeitsstand. */
  function platzhalterEinheit(einheiten, i) {
    var v = vorschlag(ausFormular(einheiten), i);
    return v != null ? 'Vorschlag ' + v : '';
  }

  var _t = null;
  function spaeter() { clearTimeout(_t); _t = setTimeout(objektFeld, 120); }
  document.addEventListener('input', function (ev) {
    var id = ev.target && ev.target.id;
    if (id && (UL_FELDER.indexOf(id) >= 0 || id === 'umlagef' || id === 'nk_vorauszahlung')) spaeter();
  }, true);
  window.addEventListener('dp:object-ready', function () { setTimeout(objektFeld, 400); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(objektFeld, 300); }); else setTimeout(objektFeld, 300);

  window.DpNkVorauszahlung = { vorschlag: vorschlag, ulJahr: ulJahr, ausFormular: ausFormular, platzhalterEinheit: platzhalterEinheit, aktualisieren: objektFeld, UL_FELDER: UL_FELDER };
})();
