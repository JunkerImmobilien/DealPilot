/* ══════════════════════════════════════════════════════════════════════
 * vivi-nk-anpassung.js — v4042 · Nebenkosten-Vorauszahlung aus DealPilot in ViVi anpassen
 *
 * Marcel 23.11.2026: „setz alles um“ (Vorschlag aus v4037: NK-Vorauszahlung nach ViVi über utility_adjustment).
 *
 * GEMESSEN in der OpenAPI (Dateien/Architektur/vivi/vivi-openapi-v1.json): eine Anpassung der Vorauszahlung ist
 * dieselbe Mietänderung wie die Mieterhöhung, POST …/rental-units/{r}/rent-changes(/preview) mit
 * adjustment_type 'utility_adjustment' und new_utility_costs (Euro je Monat). Kein neuer Schreibpfad im Client.
 *
 * Soll je Wohnung: die eigene Angabe im Feld NK-Vorauszahlung, sonst der Vorschlag aus den umlagefähigen Kosten
 * (DpNkVorauszahlung.vorschlag, dieselbe Rechnung wie viviMapping.nkVorschlag). Ist: monthly_utility_costs aus ViVi
 * (DpViviFelder, Feld nk_vorauszahlung). Weicht beides um mindestens 1 € ab, gibt es den Knopf.
 *
 * EINE Funktion für alle Stellen: DpViviNkAnpassung.oeffnen({ einheit, quelle }).
 *   Aufrufer: Reiter Miete (Karten je Wohnung bzw. „Die Wohnung“, miete-demo.js), Pilot-Analyse › ViVi (Häuschen).
 * Ablauf wie bei der Mieterhöhung: „ViVi rechnen lassen“ (Vorschau, nichts gespeichert), danach „In ViVi anlegen“
 * (POST /vivi/objekt/:id/nk-anpassung, bestaetigt). Danach liest DealPilot ViVi neu.
 * Kundentext nur mit Punkt und Komma.
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var VERSION = 'v4042';
  if (!global.document || global.DpViviNkAnpassung) return;
  var doc = global.document;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var t = String(v).trim().replace(/\s|€/g, '');
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    var n = parseFloat(t); return isFinite(n) ? n : null;
  }
  function eur2(n) { return n == null ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; }
  function datumDe(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function ersterNaechster() { var V = global.DpViviMieterhoehung; if (V && V._ersterNaechster) return V._ersterNaechster(null); var d = new Date(), y = d.getFullYear(), m = d.getMonth() + 2; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0') + '-01'; }
  /* Vorschau-Funktion 'vivi' (claude/vorschau-funktionen.md): wie vivi-mieterhoehung.js einmal geladen, synchron gelesen */
  var _frei = null;
  try { if (global.DpVorschau && typeof global.DpVorschau.frei === 'function') global.DpVorschau.frei('vivi').then(function (v) { _frei = !!v; }).catch(function () { _frei = false; }); } catch (e) {}
  function vorschauFrei() { try { if (_frei === false) return false; var V = global.DpVorschau; return !(V && typeof V.istFrei === 'function' && V.istFrei('vivi') === false); } catch (e) { return false; } }
  function verfuegbar() { var V = global.DpViviMieterhoehung; return vorschauFrei() && !!(V && V.verfuegbar && V.verfuegbar()); }

  /** Je vermieteter Wohnung (mit Vorauszahlung in ViVi): { i, name, vivi, ziel, quelle, abw }. i = null beim Einzelobjekt. */
  function liste() {
    var F = global.DpViviFelder, N = global.DpNkVorauszahlung, v = null;
    try { v = F && F.lesen ? F.lesen() : null; } catch (e) { v = null; }
    if (!v || !v.felder || !N) return [];
    var eigen = v.eigen || {}, d = N.ausFormular ? N.ausFormular() : {}, out = [];
    var E = (global._dpMfh && Array.isArray(global._dpMfh.einheiten)) ? global._dpMfh.einheiten : [];
    var eintrag = function (i, id, name) {
      var vivi = zahl(v.felder[id]); if (vivi == null) return;
      var hatEigen = Object.prototype.hasOwnProperty.call(eigen, id) && zahl(eigen[id]) != null;
      var ziel = hatEigen ? zahl(eigen[id]) : N.vorschlag(d, i);
      if (ziel == null) return;
      out.push({ i: i, name: name, vivi: vivi, ziel: ziel, quelle: hatEigen ? 'eigen' : 'vorschlag', abw: Math.round((ziel - vivi) * 100) / 100 });
    };
    var mitE = false;
    if (F.einheitFeld) E.forEach(function (e, i) {
      var id = F.einheitFeld(i, 'nk_vorauszahlung');
      if (id && Object.prototype.hasOwnProperty.call(v.felder, id)) { mitE = true; eintrag(i, id, 'Wohnung ' + ((e && e.nr) || (i + 1)) + (e && e.lage ? ', ' + e.lage : '')); }
    });
    if (!mitE) eintrag(null, 'nk_vorauszahlung', 'Wohnung');
    return out;
  }
  /** Abweichung einer Wohnung (i oder null) oder null, wenn sie passt oder nichts bekannt ist. */
  function abweichung(i) {
    var L = liste(), x = null;
    L.forEach(function (w) { if (String(w.i) === String(i == null ? null : i)) x = w; });
    return x && Math.abs(x.abw) >= 1 ? x : null;
  }

  var _z = null;
  function schliessen() { var o = $('dp-vmh-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); _z = null; }
  function gewaehlt() { return _z && _z.L[_z.sel] || null; }
  function zeichnen() {
    var host = $('dp-vmh'); if (!host || !_z) return;
    var w = gewaehlt(), neu = _z.neu;
    var h = '<h3>Nebenkosten-Vorauszahlung in ViVi anpassen</h3><p class="vmh-sub">DealPilot legt die neue Vorauszahlung als Anpassung in ViVi an. Die Erklärung an den Mieter schickst du in Textform wie gewohnt.</p>';
    if (!_z.L.length) {
      h += '<div class="vmh-box vmh-warn">In ViVi gibt es für dieses Objekt kein laufendes Mietverhältnis mit Vorauszahlung.</div><div class="vmh-kn"><button type="button" class="btn btn-outline btn-sm" data-vnk="zu">Schließen</button></div>';
      host.innerHTML = h; return;
    }
    var opts = _z.L.map(function (x, k) { return '<option value="' + k + '"' + (k === _z.sel ? ' selected' : '') + '>' + esc(x.name) + ', heute ' + esc(eur2(x.vivi)) + '</option>'; }).join('');
    h += '<div class="vmh-g">'
      + (_z.L.length > 1 || _z.L[0].i != null ? '<label class="vmh-voll">Wohnung<select data-vnk-f="sel">' + opts + '</select></label>' : '<div class="vmh-voll vmh-hin">' + esc(w.name) + ', Vorauszahlung heute <b>' + esc(eur2(w.vivi)) + '</b> im Monat</div>')
      + '<label>Neue Vorauszahlung (€ im Monat)<input inputmode="decimal" data-vnk-f="neu" value="' + (neu != null ? esc(String(neu).replace('.', ',')) : '') + '"></label>'
      + '<label>Wirksam ab<input type="date" data-vnk-f="datum" value="' + esc(_z.datum || '') + '"></label></div>';
    h += '<div class="vmh-box">' + (w.quelle === 'eigen' ? 'Bei dir eingetragen: <b>' + esc(eur2(w.ziel)) + '</b> im Monat.' : 'Aus den umlagefähigen Kosten ergeben sich <b>' + esc(eur2(w.ziel)) + '</b> im Monat, nach Wohnfläche verteilt.')
      + ' ViVi führt heute ' + esc(eur2(w.vivi)) + '.</div>';
    h += '<p class="vmh-hin">Nach § 560 Abs. 4 BGB darf jede Seite die Vorauszahlung nach einer Betriebskostenabrechnung auf eine angemessene Höhe anpassen. Sie gilt ab der nächsten Fälligkeit nach Zugang der Erklärung.</p>';
    if (_z.vorschau) h += '<div class="vmh-box vmh-ok">' + _z.vorschau + '</div>';
    if (_z.fehler) h += '<div class="vmh-fehler">' + esc(_z.fehler) + '</div>';
    var darf = w && neu != null && neu >= 0 && Math.abs(neu - w.vivi) >= 0.5 && _z.datum && !_z.laeuft;
    h += '<div class="vmh-kn"><button type="button" class="btn btn-outline btn-sm" data-vnk="zu">Abbrechen</button>'
      + '<button type="button" class="btn btn-outline btn-sm" data-vnk="vorschau"' + (darf ? '' : ' disabled') + '>ViVi rechnen lassen</button>'
      + '<button type="button" class="btn btn-sm" data-vnk="anlegen"' + (darf && _z.vorschauOk ? '' : ' disabled') + ' title="Erst ViVi rechnen lassen">In ViVi anlegen</button></div>';
    host.innerHTML = h;
  }
  function rumpf(vorschau) {
    var w = gewaehlt();
    return { einheit: w && w.i != null ? w.i : null, datum: _z.datum, neue_nk: _z.neu,
      grund: 'Anpassung der Nebenkosten-Vorauszahlung aus DealPilot' + (_z.quelle ? ' (' + _z.quelle + ')' : ''), vorschau: !!vorschau, bestaetigt: !vorschau };
  }
  function vorschauText(r) {
    var v = r && r.vivi || {}, n = r.rumpf || {};
    var t = ['ViVi hat die Änderung geprüft: Vorauszahlung ' + eur2(r.nk_bisher) + ' auf <b>' + eur2(n.new_utility_costs) + '</b> ab ' + datumDe(v.effective_date || n.effective_date) + '.'];
    var betroffen = v.affected_payments || v.payments || v.affected_months || null;
    if (Array.isArray(betroffen) && betroffen.length) t.push(betroffen.length + ' Sollstellungen ändern sich.');
    if (v.message) t.push(esc(v.message));
    t.push('Noch ist nichts gespeichert.');
    return t.join(' ');
  }
  function senden(vorschau) {
    if (!_z || _z.laeuft) return;
    var key = global._currentObjKey; if (!key || !global.Auth || !global.Auth.apiCall) return;
    _z.laeuft = true; _z.fehler = ''; zeichnen();
    global.Auth.apiCall('/vivi/objekt/' + encodeURIComponent(key) + '/nk-anpassung', { method: 'POST', body: rumpf(vorschau) })
      .then(function (r) {
        if (!_z) return;
        _z.laeuft = false;
        if (vorschau) { _z.vorschau = vorschauText(r); _z.vorschauOk = true; zeichnen(); return; }
        var w = gewaehlt(), ab = _z.datum;
        schliessen();
        try { if (global.DpVivi && global.DpVivi.objektGeladen) global.DpVivi.objektGeladen(key); } catch (e) {}
        try { if (typeof global.toast === 'function') global.toast('✓ Vorauszahlung in ViVi angepasst: ' + (w ? w.name + ', ' : '') + eur2(r.rumpf && r.rumpf.new_utility_costs) + ' ab ' + datumDe(ab) + '.'); } catch (e) {}
      })
      .catch(function (e) {
        if (!_z) return;
        _z.laeuft = false; if (vorschau) _z.vorschauOk = false;
        _z.fehler = (e && (e.message || (e.data && e.data.error))) || 'ViVi hat die Anpassung nicht angenommen.';
        zeichnen();
      });
  }
  function oeffnen(o) {
    o = o || {};
    if (!verfuegbar()) { try { if (typeof global.toast === 'function') global.toast('ℹ Anpassungen nach ViVi gehen nur bei einem mit ViVi verknüpften Objekt.'); } catch (e) {} return false; }
    var V = global.DpViviMieterhoehung; if (V && V.stil) V.stil();
    schliessen(); try { if (V && V.schliessen) V.schliessen(); } catch (e) {}
    var L = liste(), sel = 0;
    L.forEach(function (x, k) { if (String(x.i) === String(o.einheit == null ? null : o.einheit)) sel = k; });
    _z = { L: L, sel: sel, neu: L[sel] ? L[sel].ziel : null, datum: ersterNaechster(), vorschau: '', vorschauOk: false, fehler: '', laeuft: false, quelle: o.quelle || '' };
    var ov = doc.createElement('div'); ov.id = 'dp-vmh-ov';
    ov.innerHTML = '<div id="dp-vmh" role="dialog" aria-modal="true" aria-label="Nebenkosten-Vorauszahlung in ViVi anpassen"></div>';
    doc.body.appendChild(ov);
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) { schliessen(); return; }
      var b = ev.target.closest && ev.target.closest('[data-vnk]'); if (!b) return;
      ev.preventDefault();
      var a = b.getAttribute('data-vnk');
      if (a === 'zu') schliessen(); else if (a === 'vorschau') senden(true); else if (a === 'anlegen') senden(false);
    });
    ov.addEventListener('change', function (ev) {
      var f = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-vnk-f'); if (!f || !_z) return;
      var v = ev.target.value;
      if (f === 'sel') { _z.sel = +v; _z.neu = gewaehlt() ? gewaehlt().ziel : null; }
      else if (f === 'neu') _z.neu = zahl(v);
      else if (f === 'datum') _z.datum = v || null;
      _z.vorschau = ''; _z.vorschauOk = false; _z.fehler = '';
      zeichnen();
    });
    zeichnen();
    return true;
  }

  global.DpViviNkAnpassung = { VERSION: VERSION, verfuegbar: verfuegbar, liste: liste, abweichung: abweichung, oeffnen: oeffnen, schliessen: schliessen };
})(typeof window !== 'undefined' ? window : globalThis);
