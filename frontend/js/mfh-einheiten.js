/* ════════════════════════════════════════════════════════════════════
   v1448 · MEHRFAMILIENHAUS: EINHEITENLISTE (Stufe 1 des Konzepts)
   ════════════════════════════════════════════════════════════════════

   Backlog v22, Punkt 6 — Marcel: „was wuerdest du machen?" Umgesetzt ist
   v1451 Stufe 2: Massnahme + Kosten je Einheit (Summe -> Sanierung nur auf
   Haken), Kennzahlen Ist gegen Soll im Ergebnis unter der Finanzierung.
   Stufe 1 aus design/Vorschlaege/mfh-ist-soll-konfigurator.md:
     · optionaler Einstieg unter der Wohnflaeche (nur Arten mit Einheiten)
     · Liste der Einheiten: Nr., Lage, Art, Flaeche, Zimmer, Ist-Miete,
       Soll-Miete, Status, Zustand — Zeilen duplizieren
     · „Uebernehmen" schreibt die SUMMEN in die bestehenden Felder:
         wfl       = Summe Flaeche aller Einheiten
         einheiten = Anzahl Einheiten der Art „Wohnen"
         nkm       = Summe Ist-Kaltmiete der VERMIETETEN Einheiten
       calc.js rechnet unveraendert weiter — keine zweite Rechnung.
     · Soll-Miete und Zustand werden gespeichert und in der Summe gezeigt
       (Stufe 2 fuehrt sie in die Kennzahlen Ist gegen Soll).
   Die Liste haengt als JSON am Objekt (Feld _mfh, storage.js).
   Der einfache Weg bleibt: wer die Liste nie oeffnet, arbeitet wie bisher.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ARTEN_MIT_EINHEITEN = { MFH: 1, ZFH: 1, GESCH: 1, BUERO: 1, HOTEL: 1 };
  var ZUSTAND = [['', '–'], ['5', 'neuwertig'], ['4', 'modernisiert'], ['3', 'gepflegt'], ['2', 'renovierungsbed.'], ['1', 'sanierungsbed.']];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(v) { if (v == null || String(v).trim() === '') return 0; var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function daten() { return (window._dpMfh && Array.isArray(window._dpMfh.einheiten)) ? window._dpMfh : { einheiten: [] }; }

  function summe(list) {
    var s = { anzahl: list.length, wohnen: 0, flaeche: 0, flaecheGew: 0, ist: 0, soll: 0, leer: 0, leerFl: 0, kosten: 0, hatSoll: false };
    list.forEach(function (e) {
      var fl = zahl(e.wfl);
      s.flaeche += fl;
      if (e.art === 'gewerbe') s.flaecheGew += fl; else s.wohnen++;
      if (e.status === 'leer') { s.leer++; s.leerFl += fl; } else s.ist += zahl(e.ist);
      s.soll += zahl(e.soll) || zahl(e.ist);
      if (zahl(e.soll) > 0) s.hatSoll = true;
      s.kosten += zahl(e.kosten); /* v1451 */
    });
    return s;
  }

  /* ── Einstieg unter der Wohnflaeche ─────────────────────────────── */
  function knopf() {
    var art = (el('objart') && el('objart').value) || '';
    var wfl = el('wfl'); var f = wfl && wfl.closest ? wfl.closest('.f') : null;
    var k = el('mfh-einstieg');
    if (!f) return;
    if (!k) {
      k = document.createElement('div'); k.id = 'mfh-einstieg'; k.style.cssText = 'margin-top:6px';
      f.appendChild(k);
    }
    if (!ARTEN_MIT_EINHEITEN[art]) { k.innerHTML = ''; k.style.display = 'none'; return; }
    var d = daten(), n = d.einheiten.length;
    k.style.display = '';
    k.innerHTML = '<button type="button" class="btn btn-outline btn-sm" id="mfh-oeffnen">▸ Einheiten erfassen'
      + (n ? ' (' + n + ' erfasst)' : ' — optional') + '</button>'
      + (n ? '<div class="cf-hint" style="margin-top:4px">Fläche, Einheiten und Ist-Kaltmiete aus ' + n + ' Einheiten übernommen.</div>' : '');
    el('mfh-oeffnen').onclick = oeffnen;
  }

  /* ── Modal ─────────────────────────────────────────────────────── */
  var _arbeit = [];
  function zeileHtml(e, i) {
    function inp(k, w, ph, typ) { return '<input data-i="' + i + '" data-k="' + k + '" value="' + esc(e[k] || '') + '" placeholder="' + (ph || '') + '" inputmode="' + (typ || 'text') + '" style="width:' + w + 'px;padding:6px 7px;border:1px solid #E6E0D3;border-radius:6px;font:13px Inter,sans-serif">'; }
    function sel(k, opts) { return '<select data-i="' + i + '" data-k="' + k + '" style="padding:6px;border:1px solid #E6E0D3;border-radius:6px;font:13px Inter,sans-serif">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(e[k] || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
    return '<tr>' +
      '<td>' + inp('nr', 44, String(i + 1)) + '</td>' +
      '<td>' + inp('lage', 86, 'EG links') + '</td>' +
      '<td>' + sel('art', [['wohnen', 'Wohnen'], ['gewerbe', 'Gewerbe']]) + '</td>' +
      '<td>' + inp('wfl', 60, 'm²', 'decimal') + '</td>' +
      '<td>' + inp('zimmer', 44, '', 'decimal') + '</td>' +
      '<td>' + inp('ist', 72, '€/Mon', 'decimal') + '</td>' +
      '<td>' + inp('soll', 72, '€/Mon', 'decimal') + '</td>' +
      '<td>' + sel('status', [['vermietet', 'vermietet'], ['leer', 'leer']]) + '</td>' +
      '<td>' + sel('zustand', ZUSTAND) + '</td>' +
      '<td>' + inp('massnahme', 110, 'z. B. Bad neu') + '</td>' +
      '<td>' + inp('kosten', 70, '€', 'decimal') + '</td>' +
      '<td style="white-space:nowrap"><button type="button" data-dup="' + i + '" title="Zeile duplizieren" style="border:1px solid #E6E0D3;background:#fff;border-radius:6px;padding:5px 8px;cursor:pointer">⧉</button> ' +
      '<button type="button" data-del="' + i + '" title="Zeile löschen" style="border:1px solid #E6E0D3;background:#fff;border-radius:6px;padding:5px 8px;cursor:pointer;color:#B8625C">✕</button></td>' +
      '</tr>';
  }
  function zeichnen() {
    var tb = el('mfh-zeilen'); if (!tb) return;
    tb.innerHTML = _arbeit.map(zeileHtml).join('');
    el('mfh-summe').innerHTML = summeText(summe(_arbeit));
  }
  function summeText(s) {
    return s.anzahl
      ? '<b>' + s.anzahl + ' Einheiten</b> (' + s.wohnen + ' Wohnen' + (s.anzahl - s.wohnen ? ', ' + (s.anzahl - s.wohnen) + ' Gewerbe' : '') + ') · '
        + Math.round(s.flaeche).toLocaleString('de-DE') + ' m²' + (s.flaecheGew ? ' (davon Gewerbe ' + Math.round(s.flaecheGew) + ' m²)' : '') + ' · '
        + 'Ist ' + eur(s.ist) + '/Monat · Soll ' + eur(s.soll) + '/Monat'
        + (s.leer ? ' · <span style="color:#B8625C">Leerstand ' + s.leer + ' WE / ' + Math.round(s.leerFl) + ' m²</span>' : '')
        + (s.kosten ? ' · Maßnahmen ' + eur(s.kosten) : '')
      : 'Noch keine Einheit — „+ Einheit" legt die erste an.';
  }
  function oeffnen() {
    _arbeit = JSON.parse(JSON.stringify(daten().einheiten || []));
    if (!_arbeit.length) _arbeit.push({ nr: '1', art: 'wohnen', status: 'vermietet' });
    var m = document.createElement('div'); m.id = 'mfh-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(42,39,39,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:12px';
    m.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:1040px;width:100%;max-height:92vh;display:flex;flex-direction:column;border:1px solid #E6E0D3;color:#2A2727;font-family:Inter,sans-serif">' +
      '<div style="padding:18px 20px 8px"><div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33)">Mehrfamilienhaus</div>' +
      '<h3 style="margin:6px 0 2px;font:600 20px/1.3 \'Space Grotesk\',sans-serif">Einheiten erfassen</h3>' +
      '<div style="font-size:12.5px;color:#6B6356">Ähnliche Wohnungen mit ⧉ duplizieren. „Übernehmen" schreibt Fläche, Einheitenzahl und Ist-Kaltmiete (vermietete Einheiten) ins Objekt.</div></div>' +
      '<div style="overflow:auto;padding:0 20px;flex:1 1 auto"><table style="border-collapse:collapse;font-size:12px;min-width:1080px"><thead><tr style="text-align:left;color:#8A8272">' +
      '<th>Nr.</th><th>Lage</th><th>Art</th><th>m²</th><th>Zi.</th><th>Ist-Miete</th><th>Soll-Miete</th><th>Status</th><th>Zustand</th><th>Maßnahme</th><th>Kosten</th><th></th></tr></thead><tbody id="mfh-zeilen"></tbody></table></div>' +
      '<div style="padding:10px 20px;border-top:1px solid #EFEBE3;font-size:13px" id="mfh-summe"></div>' +
      '<label id="mfh-san-zeile" style="display:none;gap:8px;align-items:center;padding:0 20px 10px;font-size:13px"><input type="checkbox" id="mfh-san"> <span id="mfh-san-text"></span></label>' +
      '<div style="padding:0 20px 16px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" id="mfh-neu" class="btn btn-outline btn-sm">+ Einheit</button>' +
      '<button type="button" id="mfh-zu" class="btn btn-outline btn-sm" style="margin-left:auto">Abbrechen</button>' +
      '<button type="button" id="mfh-ok" class="btn btn-sm" style="background:#2A2727;color:#fff;border:none">Übernehmen</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('input', function (ev) { var t = ev.target; if (t.dataset && t.dataset.k) { _arbeit[+t.dataset.i][t.dataset.k] = t.value; zeichnenSumme(); } });
    m.addEventListener('change', function (ev) { var t = ev.target; if (t.tagName === 'SELECT' && t.dataset.k) { _arbeit[+t.dataset.i][t.dataset.k] = t.value; zeichnenSumme(); } });
    m.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === m) schliessen();
      if (t.dataset && t.dataset.dup != null) { var i = +t.dataset.dup, c = JSON.parse(JSON.stringify(_arbeit[i])); c.nr = String(_arbeit.length + 1); c.lage = ''; _arbeit.splice(i + 1, 0, c); zeichnen(); }
      if (t.dataset && t.dataset.del != null) { _arbeit.splice(+t.dataset.del, 1); zeichnen(); }
    });
    el('mfh-neu').onclick = function () { _arbeit.push({ nr: String(_arbeit.length + 1), art: 'wohnen', status: 'vermietet' }); zeichnen(); };
    el('mfh-zu').onclick = schliessen;
    el('mfh-ok').onclick = uebernehmen;
    zeichnen(); sanZeile();
  }
  /* Beim Tippen nur die Summenzeile neu — die Tabelle bleibt stehen, damit
     der Cursor im Feld bleibt. */
  function zeichnenSumme() {
    var host = el('mfh-summe'); if (!host) return;
    host.innerHTML = summeText(summe(_arbeit));
    sanZeile();
  }
  /* v1451: Massnahmenkosten -> Sanierung nur auf ausdruecklichen Haken.
     Ein vorhandener Sanierungsbetrag wird nie still ueberschrieben. */
  function sanZeile() {
    var z = el('mfh-san-zeile'); if (!z) return;
    var k = summe(_arbeit).kosten, alt = zahl(el('san') && el('san').value);
    z.style.display = k > 0 ? 'flex' : 'none';
    el('mfh-san-text').textContent = 'Maßnahmenkosten ' + eur(k) + ' als Sanierung übernehmen' + (alt > 0 && Math.round(alt) !== Math.round(k) ? ' (ersetzt ' + eur(alt) + ')' : '');
    if (!z._init) { z._init = true; el('mfh-san').checked = !(alt > 0) || Math.round(alt) === Math.round(k); }
  }
  function schliessen() { var m = el('mfh-modal'); if (m) m.remove(); }
  function setzen(id, wert) { var e = el(id); if (!e) return; e.value = String(Math.round(wert * 100) / 100).replace('.', ','); try { e.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {} }
  function uebernehmen() {
    var list = _arbeit.filter(function (e) { return zahl(e.wfl) > 0 || zahl(e.ist) > 0 || String(e.lage || '').trim(); });
    window._dpMfh = { einheiten: list, stand: new Date().toISOString().slice(0, 10) };
    var s = summe(list);
    if (list.length) {
      if (s.flaeche > 0) setzen('wfl', s.flaeche);
      setzen('einheiten', s.wohnen);
      if (s.ist > 0) setzen('nkm', s.ist);
      if (s.kosten > 0 && el('mfh-san') && el('mfh-san').checked) { setzen('san', s.kosten); if (typeof window.syncSanTaxOnSanInput === 'function') try { window.syncSanTaxOnSanInput(); } catch (x) {} }
    }
    if (typeof window.calc === 'function') window.calc();
    schliessen(); knopf();
    if (typeof window.toast === 'function') window.toast('✓ ' + list.length + ' Einheiten übernommen — Fläche, Einheiten und Ist-Miete gesetzt');
  }

  /* ── v1451 · Kennzahlen Ist gegen Soll (Konzept Abschnitt 4) ─────────
     Nur wenn mindestens eine Einheit eine Soll-Miete traegt. Rechnet NICHT
     neu: Ist kommt aus State.kpis, der Soll-DSCR aus Dscr.compute() mit
     derselben Finanzierung und denselben Kosten, nur der Soll-Kaltmiete.
     Soll-Bruttorendite auf die Gesamtinvestition (Punkt 5: nach Sanierung). */
  function istSoll() {
    var host = el('mfh-istsoll');
    if (!host) { var a = el('r-sanfin'); if (!a) return; host = document.createElement('div'); host.id = 'mfh-istsoll'; host.style.cssText = 'margin-top:10px'; a.parentNode.insertBefore(host, a.nextSibling); }
    var d = daten(), s = summe(d.einheiten || []), K = (window.State && window.State.kpis) || {};
    if (!ARTEN_MIT_EINHEITEN[(el('objart') && el('objart').value) || ''] || !s.hatSoll || !(K.kp > 0)) { host.style.display = 'none'; return; }
    var ist_j = (K.nkm_j || 0), ze_j = zahl(el('ze') && el('ze').value) * 12, soll_j = s.soll * 12 + ze_j;
    var dscrSoll = null;
    if (window.Dscr && window.Dscr.compute) dscrSoll = window.Dscr.compute({ nkm_j: s.soll * 12, ze_j: ze_j, zins_j: K.zins_j, tilg_j: K.tilg_j, bsv_j: K.d1IsAussetzung ? (K.bspar_j || 0) : 0, bwk_cf: K.bwk_cf }).brutto;
    function p(n) { return (n == null || !isFinite(n)) ? '—' : n.toFixed(2).replace('.', ',') + ' %'; }
    function f(n) { return (n == null || !isFinite(n)) ? '—' : n.toFixed(2).replace('.', ','); }
    function z(l, a, b) { return '<tr><td style="padding:4px 0;color:var(--muted,#6B6356)">' + l + '</td><td style="text-align:right;padding:4px 8px">' + a + '</td><td style="text-align:right;padding:4px 0;font-weight:600">' + b + '</td></tr>'; }
    host.style.display = '';
    host.innerHTML = '<hr class="dvd"><div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Ist gegen Soll · ' + d.einheiten.length + ' Einheiten</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="font-size:11px;color:var(--muted,#8A8272)"><td></td><td style="text-align:right;padding:0 8px">Ist (heute)</td><td style="text-align:right">Soll</td></tr>' +
      z('Kaltmiete p. a.', eur(ist_j), eur(soll_j)) +
      z('Bruttomietrendite', p(K.bmy) + '<div style="font-size:10.5px;color:var(--muted,#8A8272)">auf Kaufpreis</div>', p(K.gi > 0 ? soll_j / K.gi * 100 : null) + '<div style="font-size:10.5px;font-weight:400;color:var(--muted,#8A8272)">auf Gesamtinvestition</div>') +
      z('DSCR', f(K.dscr), f(dscrSoll)) +
      z('Leerstand', s.leer ? s.leer + ' WE' : '—', '—') +
      (s.kosten ? z('Maßnahmen', '', eur(s.kosten)) : '') +
      '</table><div class="cf-hint" style="margin-top:4px">Soll = vereinbarte Soll-Mieten aller Einheiten nach den Maßnahmen, gleiche Finanzierung und Kosten. Die Rechnung oben bleibt beim Ist.</div>';
  }
  function anhaengen() {
    if (typeof window.calc !== 'function') return false;
    if (window.calc._dpMfhHook) return true;
    var alt = window.calc;
    var neu = function () { var r = alt.apply(this, arguments); try { setTimeout(istSoll, 380); } catch (e) {} return r; };
    for (var k in alt) { if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k]; }
    neu._dpMfhHook = true; window.calc = neu; return true;
  }
  var _n = 0;
  function haken() { if (!anhaengen() && ++_n < 12) setTimeout(haken, 400); }

  function start() {
    haken();
    var a = el('objart'); if (a && !a._mfhBound) { a._mfhBound = true; a.addEventListener('change', knopf); }
    knopf();
  }
  window.addEventListener('dp:object-ready', function () { setTimeout(knopf, 250); setTimeout(istSoll, 700); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.DpMfhEinheiten = { oeffnen: oeffnen, knopf: knopf, istSoll: istSoll, _summe: summe };
})();
