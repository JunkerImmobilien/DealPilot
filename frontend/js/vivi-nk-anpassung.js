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
  var VERSION = 'v4120';
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
    /* v4120 · Marcel 23.11.2026: „wie kann ich einstellen, dass der Wert aus ViVi genommen wird?“ _vivi.vivi_gilt[id]: die
       Vorauszahlung laut ViVi gilt, DealPilot vergleicht nicht mehr mit dem Vorschlag aus den umlagefähigen Kosten. Eine
       eigene Angabe im Feld schlägt das weiter. _vivi.nk_angelegt[id] = { wert, ab }: in ViVi angelegt, wirksam erst ab
       Datum. Bis dahin führt ViVi noch den alten Betrag, das ist keine Abweichung mehr. Kein Rechenkern liest das Feld. */
    var gilt = v.vivi_gilt || {}, angelegt = v.nk_angelegt || {}, heute = new Date().toISOString().slice(0, 10);
    var eintrag = function (i, id, name) {
      var vivi = zahl(v.felder[id]); if (vivi == null) return;
      var hatEigen = Object.prototype.hasOwnProperty.call(eigen, id) && zahl(eigen[id]) != null;
      var viviGilt = !hatEigen && !!gilt[id];
      var ziel = hatEigen ? zahl(eigen[id]) : (viviGilt ? vivi : N.vorschlag(d, i));
      if (ziel == null) return;
      var an = angelegt[id] && zahl(angelegt[id].wert) != null ? angelegt[id] : null;
      var wartet = !!(an && Math.abs(zahl(an.wert) - ziel) < 0.5 && Math.abs(zahl(an.wert) - vivi) >= 0.5 && String(an.ab || '') > heute);
      out.push({ i: i, id: id, name: name, vivi: vivi, ziel: ziel, quelle: hatEigen ? 'eigen' : (viviGilt ? 'vivi' : 'vorschlag'),
        vorschlag: N.vorschlag(d, i), angelegt: wartet ? { wert: zahl(an.wert), ab: an.ab } : null,
        abw: wartet ? 0 : Math.round((ziel - vivi) * 100) / 100 });
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
  function V() { return global.DpViviMieterhoehung || {}; }
  function fuss(html) { if (V().fuss) V().fuss(html); }
  function fk(w, t, art, an, ti) { return V().fk ? V().fk('vnk', w, t, art, an, ti) : ''; }
  function zeichnen() {
    var host = $('dp-vmh'); if (!host || !_z) return;
    var w = gewaehlt(), neu = _z.neu;
    var h = '';
    if (!_z.L.length) {
      host.innerHTML = '<div class="vmh-box vmh-warn">In ViVi gibt es für dieses Objekt kein laufendes Mietverhältnis mit Vorauszahlung.</div>';
      fuss(fk('zu', 'Schließen', 'zu')); return;
    }
    /* v4120 · zwei Wege: DealPilot-Wert nach ViVi schreiben oder den ViVi-Wert in DealPilot gelten lassen */
    var opts0 = _z.L.map(function (x, k) { return '<option value="' + k + '"' + (k === _z.sel ? ' selected' : '') + '>' + esc(x.name) + ', heute ' + esc(eur2(x.vivi)) + '</option>'; }).join('');
    if (_z.L.length > 1 || _z.L[0].i != null) h += '<div class="vmh-g"><label class="vmh-voll">Wohnung<select data-vnk-f="sel">' + opts0 + '</select></label></div>';
    var dpText = w.quelle === 'eigen' ? 'bei dir eingetragen' : (w.quelle === 'vivi' ? 'es gilt der Wert aus ViVi' : 'aus den umlagefähigen Kosten' + (w.i != null ? ', nach Wohnfläche' : ''));
    var dpWert = w.quelle === 'vivi' ? w.vorschlag : w.ziel;
    h += '<div class="vmh-vgl"><div><span>Laut ViVi</span><b>' + esc(eur2(w.vivi)) + '</b><small class="vmh-hin"> im Monat</small></div>'
      + '<div><span>Laut DealPilot</span><b>' + esc(dpWert != null ? eur2(dpWert) : '–') + '</b><small class="vmh-hin"> ' + esc(dpText) + '</small></div></div>';
    if (w.angelegt) h += '<div class="vmh-box vmh-ok">In ViVi angelegt: ' + esc(eur2(w.angelegt.wert)) + ' ab ' + esc(datumDe(w.angelegt.ab)) + '. Bis dahin führt ViVi noch ' + esc(eur2(w.vivi)) + '.</div>';
    var weg = _z.weg || 'vivi-anpassen';
    h += '<div class="vmh-wahl" role="radiogroup" aria-label="Welcher Wert gilt?">'
      + '<label class="' + (weg === 'vivi-anpassen' ? 'an' : '') + '"><input type="radio" name="vnk-weg" data-vnk-f="weg" value="vivi-anpassen"' + (weg === 'vivi-anpassen' ? ' checked' : '') + '><span><b>In ViVi anpassen</b><small>DealPilot legt die neue Vorauszahlung als Anpassung in ViVi an.</small></span></label>'
      + '<label class="' + (weg === 'vivi-gilt' ? 'an' : '') + '"><input type="radio" name="vnk-weg" data-vnk-f="weg" value="vivi-gilt"' + (weg === 'vivi-gilt' ? ' checked' : '') + '><span><b>ViVi-Wert übernehmen</b><small>In DealPilot gilt ' + esc(eur2(w.vivi)) + ' laut ViVi. Der Vergleich entfällt.</small></span></label></div>';
    if (weg === 'vivi-gilt') {
      h += '<p class="vmh-hin">Die Vorauszahlung steht nur im Mietvertrag. Cashflow und Steuer rechnen weiter mit den umlagefähigen Kosten. Zurücknehmen geht im Reiter Pilot-Analyse unter ViVi.</p>';
      if (_z.fehler) h += '<div class="vmh-fehler">' + esc(_z.fehler) + '</div>';
      host.innerHTML = h;
      fuss(fk('zu', 'Abbrechen', 'zu') + fk('gilt', 'ViVi-Wert übernehmen', 'haupt', true));
      return;
    }
    h += '<div class="vmh-g">'
      + '<label>Neue Vorauszahlung (€ im Monat)<input inputmode="decimal" data-vnk-f="neu" value="' + (neu != null ? esc(String(neu).replace('.', ',')) : '') + '"></label>'
      + '<label>Wirksam ab<input type="date" data-vnk-f="datum" value="' + esc(_z.datum || '') + '"></label></div>';
    h += '<p class="vmh-hin">Nach § 560 Abs. 4 BGB darf jede Seite die Vorauszahlung nach einer Betriebskostenabrechnung auf eine angemessene Höhe anpassen. Sie gilt ab der nächsten Fälligkeit nach Zugang der Erklärung.</p>';
    if (_z.vorschau) h += '<div class="vmh-box vmh-ok">' + _z.vorschau + '</div>';
    if (_z.fehler) h += '<div class="vmh-fehler">' + esc(_z.fehler) + '</div>';
    var darf = w && neu != null && neu >= 0 && Math.abs(neu - w.vivi) >= 0.5 && _z.datum && !_z.laeuft;
    host.innerHTML = h;
    fuss(fk('zu', 'Abbrechen', 'zu') + fk('vorschau', _z.laeuft ? 'ViVi rechnet …' : 'ViVi rechnen lassen', 'neben', !!darf)
      + fk('anlegen', 'In ViVi anlegen', 'haupt', !!(darf && _z.vorschauOk), 'Erst ViVi rechnen lassen'));
  }
  /* v4120 · nach jeder Aktion: Haus im ViVi-Reiter und Reiter Miete neu zeichnen (beide hören auf dp:vivi-stand) */
  function neuZeichnen() {
    try { global.dispatchEvent(new CustomEvent('dp:vivi-stand', { detail: { key: global._currentObjKey, nk: true } })); } catch (e) {}
    try { if (global.DpViviReiter && global.DpViviReiter.mountAll) setTimeout(global.DpViviReiter.mountAll, 60); } catch (e) {}
  }
  function speichern() { try { if (global.DpSpeichernFolge) global.DpSpeichernFolge(); else if (typeof global.saveObj === 'function') global.saveObj({ silent: true }); } catch (e) {} }
  /** v4120 · ViVi-Wert gilt (an = true) oder DealPilot vergleicht wieder (an = false). Eine eigene Angabe wird dabei verworfen. */
  function viviGilt(id, an) {
    var F = global.DpViviFelder; if (!F || !F.merken || !id) return false;
    try { var v = F.lesen(); if (an && v.eigen && Object.prototype.hasOwnProperty.call(v.eigen, id) && F.viviUebernehmen) F.viviUebernehmen(id); } catch (e) {}
    var ok = F.merken('vivi_gilt', id, an ? true : null);
    if (ok) { speichern(); neuZeichnen(); }
    return ok;
  }
  function gelten() {
    var w = gewaehlt(); if (!w) return;
    if (!viviGilt(w.id, true)) { _z.fehler = 'Das ging nicht. Ist das Objekt noch mit ViVi verknüpft?'; zeichnen(); return; }
    schliessen();
    try { if (typeof global.toast === 'function') global.toast('✓ ' + (w.i != null ? w.name + ': ' : '') + 'Es gilt die Vorauszahlung laut ViVi, ' + eur2(w.vivi) + '.'); } catch (e) {}
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
        var w = gewaehlt(), ab = _z.datum, neuWert = r && r.rumpf && r.rumpf.new_utility_costs != null ? r.rumpf.new_utility_costs : _z.neu;
        schliessen();
        try { if (w && global.DpViviFelder && global.DpViviFelder.merken) { global.DpViviFelder.merken('nk_angelegt', w.id, { wert: neuWert, ab: ab, am: new Date().toISOString().slice(0, 10) }); speichern(); } } catch (e) {}
        neuZeichnen();
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
    var MV = global.DpViviMieterhoehung;
    schliessen(); try { if (MV && MV.schliessen) MV.schliessen(); } catch (e) {}
    var L = liste(), sel = 0;
    L.forEach(function (x, k) { if (String(x.i) === String(o.einheit == null ? null : o.einheit)) sel = k; });
    _z = { L: L, sel: sel, neu: L[sel] ? L[sel].ziel : null, datum: ersterNaechster(), vorschau: '', vorschauOk: false, fehler: '', laeuft: false, quelle: o.quelle || '', weg: o.weg || 'vivi-anpassen' };
    var ov = MV && MV.rahmen ? MV.rahmen('Nebenkosten-Vorauszahlung abgleichen', 'ViVi und DealPilot führen eine andere Vorauszahlung. Entscheide, welcher Wert gilt. Die Erklärung an den Mieter schickst du in Textform wie gewohnt.') : null;
    if (!ov) return false;
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) { schliessen(); return; }
      var b = ev.target.closest && ev.target.closest('[data-vnk]'); if (!b || b.disabled) return;
      ev.preventDefault();
      var a = b.getAttribute('data-vnk');
      if (a === 'zu') schliessen(); else if (a === 'vorschau') senden(true); else if (a === 'anlegen') senden(false); else if (a === 'gilt') gelten();
    });
    ov.addEventListener('change', function (ev) {
      var f = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-vnk-f'); if (!f || !_z) return;
      var v = ev.target.value;
      if (f === 'weg') { _z.weg = v; _z.fehler = ''; zeichnen(); return; }
      if (f === 'sel') { _z.sel = +v; _z.neu = gewaehlt() ? gewaehlt().ziel : null; }
      else if (f === 'neu') _z.neu = zahl(v);
      else if (f === 'datum') _z.datum = v || null;
      _z.vorschau = ''; _z.vorschauOk = false; _z.fehler = '';
      zeichnen();
    });
    zeichnen();
    return true;
  }

  global.DpViviNkAnpassung = { VERSION: VERSION, verfuegbar: verfuegbar, liste: liste, abweichung: abweichung, oeffnen: oeffnen, schliessen: schliessen, viviGilt: viviGilt /* v4120 */ };
})(typeof window !== 'undefined' ? window : globalThis);
