/* ══════════════════════════════════════════════════════════════════════
 * vivi-mieterhoehung.js — v4037 · Mieterhöhung aus DealPilot in ViVi anlegen
 *
 * Marcel 23.11.2026: „Wenn DealPilot Potenzial sieht und sagt, hier können wir Mieterhöhungen machen, haben wir
 * die Möglichkeit, das in ViVi direkt anzusteuern und einen Absprung zu machen … dass wir das hier im DealPiloten
 * anpassen können und es in ViVi hinterlegt wird. Das muss für alle Typen funktionieren.“
 *
 * EINE Funktion für alle Stellen: DpViviMieterhoehung.oeffnen({ einheit, quelle }).
 *   Aufrufer: Reiter Miete (Liste Mieterhöhungen am Objekt und je Wohnung, mieterhoehungen.js), Karte „Die Wohnung“
 *   bzw. „Das Haus“ (miete-demo.js), Pilot-Analyse › Jahresabgleich › Mieterhöhung (jahresabgleich.js).
 *
 * Ablauf: Wohnung wählen (beim MFH), Art (§ 558 Vergleichsmiete, Index, § 559 Modernisierung), neue Miete und Datum
 * vorbelegt mit dem, was DealPilot rechtlich für möglich hält (DpPotenzial.modell: Kappung, Vergleichsmiete,
 * Sperrfrist, frühester Termin). Änderbar. Über dem Möglichen steht eine Warnung, angelegt wird dann nur mit Haken.
 * „ViVi rechnen lassen“ fragt die Vorschau von ViVi (nichts wird gespeichert), „In ViVi anlegen“ legt die
 * Mietänderung an (POST /vivi/objekt/:id/mieterhoehung, bestaetigt). Danach liest DealPilot ViVi neu, die Erhöhung
 * steht dann in der Liste (wirksam) bzw. als „geplant“.
 *
 * Neuvermietung (z. B. „für 9 €/m² vermieten“) ist KEINE Mieterhöhung im laufenden Vertrag. Dafür gibt es keinen
 * Absprung, das Fenster erklärt es.
 *
 * Sichtbar nur, wenn das Objekt mit ViVi verknüpft ist, die Vorschau-Funktion ViVi frei ist und die Stufe nicht
 * Einsteiger ist.
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var VERSION = 'v4037';
  function doc() { return global.document || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zahl(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function zahlEin(v) { if (v == null || v === '') return null; var t = String(v).trim(); if (/,/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); var n = parseFloat(t); return isFinite(n) ? n : null; }
  function eur(n) { return n == null ? '–' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function eur2(n) { return n == null ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; }
  function datumDe(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function ersterNaechster(iso) {
    var d = iso ? new Date(iso + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var y = d.getFullYear(), m = d.getMonth() + 1;
    if (d.getDate() !== 1 || !iso) { m++; if (m > 12) { m = 1; y++; } }
    return y + '-' + String(m).padStart(2, '0') + '-01';
  }

  function stand() { try { return global.DpVivi && global.DpVivi.stand ? global.DpVivi.stand() : null; } catch (e) { return null; } }
  function einsteiger() { try { return !!(global.DpDetailgrad && global.DpDetailgrad.stufe && global.DpDetailgrad.stufe() === 1); } catch (e) { return false; } }
  function vorschauFrei() { try { return !global.DpVorschau || !global.DpVorschau.frei || global.DpVorschau.frei('vivi'); } catch (e) { return false; } }
  function verfuegbar() { var s = stand(); return !!(s && s.verknuepft && s.status === 'fertig') && !einsteiger() && vorschauFrei(); }

  /** Die vermieteten Wohnungen mit dem, was DealPilot für möglich hält (Modell der Potenzialanalyse). */
  function wohnungen() {
    var P = global.DpPotenzial, m = null;
    try { m = P && P.modell ? P.modell() : null; } catch (e) { m = null; }
    var out = [];
    if (m && Array.isArray(m.wohnungen)) m.wohnungen.forEach(function (w, j) {
      var ist = zahl(w.ist); if (!(ist > 0) || w.status === 'leer') return;
      var so = w.soll || {}, t = so.termine || {}, ix = w.index && w.index.ok && w.index.naechste ? w.index.naechste : null;
      out.push({ j: j, i: w.i == null ? null : w.i, nr: w.nr, name: m.art === 'mfh' ? 'Wohnung ' + (w.nr || (j + 1)) + (w.lage ? ', ' + w.lage : '') : 'Wohnung', wfl: zahl(w.wfl), ist: ist,
        soll: so.miete != null && so.miete > ist + 0.5 ? Math.round(so.miete * 100) / 100 : null, soll_ab: t.wirksam_ab || so.ab || null, verlangbar_ab: t.verlangbar_ab || null,
        ab_text: so.ab_text || '', vertrag: !!so.vertrag,
        index_miete: ix ? zahl(ix.miete_neu) : null, index_ab: ix ? ix.wirksam || null : null });
    });
    return { mfh: !!(m && m.art === 'mfh'), liste: out };
  }

  function stil() {
    var d = doc(); if (!d || d.getElementById('dp-vmh-stil')) return;
    var s = d.createElement('style'); s.id = 'dp-vmh-stil';
    s.textContent = [
      '#dp-vmh-ov{position:fixed;inset:0;z-index:100500;background:rgba(5,5,5,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 16px}',
      '#dp-vmh{background:#FDFCFA;color:#2A2727;border-radius:12px;max-width:560px;width:100%;padding:20px 22px;font:400 13px/1.55 Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.25)}',
      '#dp-vmh h3{margin:0 0 4px;font:600 18px/1.3 "Space Grotesk",Inter,sans-serif}',
      '#dp-vmh .vmh-sub{color:#6B645A;margin:0 0 12px}',
      '#dp-vmh label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#6B645A}',
      '#dp-vmh input,#dp-vmh select{font:inherit;color:#2A2727;padding:7px 8px;border:1px solid #E6DCC2;border-radius:7px;background:#fff;min-width:0}',
      '#dp-vmh .vmh-g{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}',
      '#dp-vmh .vmh-g .vmh-voll{grid-column:1 / -1}',
      '#dp-vmh .vmh-box{border:1px solid #EFE8D6;border-radius:9px;padding:9px 11px;margin:8px 0;background:#fff}',
      '#dp-vmh .vmh-warn{border-color:#D8564C;background:rgba(216,86,76,.06)}',
      '#dp-vmh .vmh-warn label{flex-direction:row;align-items:flex-start;gap:7px;color:#2A2727;margin-top:6px}',
      '#dp-vmh .vmh-ok{border-color:#3FA56C;background:rgba(63,165,108,.07)}',
      '#dp-vmh .vmh-hin{color:#6B645A;font-size:12px}',
      '#dp-vmh .vmh-kn{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}',
      '#dp-vmh .vmh-fehler{color:#B8625C;margin-top:6px}',
      '@media (max-width:560px){#dp-vmh .vmh-g{grid-template-columns:1fr}#dp-vmh-ov{padding:12px}}'
    ].join('\n');
    d.head.appendChild(s);
  }

  var _z = null;   /* Zustand des offenen Fensters */
  function schliessen() { var o = doc() && doc().getElementById('dp-vmh-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); _z = null; }

  function gewaehlt() { return _z && _z.W.liste[_z.sel] || null; }
  function moeglich(w, art) {
    if (!w) return null;
    if (art === 'index') return w.index_miete != null && w.index_miete > w.ist ? { miete: w.index_miete, ab: w.index_ab, text: 'nächste Indexanpassung laut Vertrag' } : null;
    if (art === '559') return null;   /* Modernisierung: DealPilot rechnet die Umlage hier nicht vor */
    return w.soll != null ? { miete: w.soll, ab: w.soll_ab, text: w.ab_text || 'Vergleichsmiete und Kappungsgrenze' } : null;
  }

  function zeichnen() {
    var d = doc(), host = d && d.getElementById('dp-vmh'); if (!host || !_z) return;
    var W = _z.W, w = gewaehlt(), art = _z.art, mg = moeglich(w, art);
    if (_z.neu == null && w) _z.neu = mg ? mg.miete : null;
    if (!_z.datum && w) _z.datum = mg && mg.ab ? mg.ab : ersterNaechster(null);
    var neu = _z.neu, ueber = !!(w && neu != null && (mg ? neu > mg.miete + 0.5 : (art !== '559' && neu > w.ist)));
    var opts = W.liste.map(function (x, k) { return '<option value="' + k + '"' + (k === _z.sel ? ' selected' : '') + '>' + esc(x.name) + ', heute ' + esc(eur2(x.ist)) + '</option>'; }).join('');
    var artOpt = [['558', 'Vergleichsmiete (§ 558 BGB)'], ['index', 'Indexmiete (§ 557b BGB)'], ['559', 'Modernisierung (§ 559 BGB)']]
      .map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === art ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('');
    var h = '<h3>Mieterhöhung in ViVi anlegen</h3><p class="vmh-sub">DealPilot legt die neue Miete als Mietänderung in ViVi an. Den Brief an den Mieter schickst du wie gewohnt, zustimmen muss er bei § 558 selbst.</p>';
    if (!W.liste.length) {
      h += '<div class="vmh-box vmh-warn">Für dieses Objekt gibt es keine vermietete Wohnung mit Miete. Eine Mieterhöhung braucht ein laufendes Mietverhältnis.</div><div class="vmh-kn"><button type="button" class="btn btn-outline btn-sm" data-vmh="zu">Schließen</button></div>';
      host.innerHTML = h; return;
    }
    h += '<div class="vmh-g">'
      + (W.mfh ? '<label class="vmh-voll">Wohnung<select data-vmh-f="sel">' + opts + '</select></label>' : '<div class="vmh-voll vmh-hin">' + esc(w.name) + ', Miete heute <b>' + esc(eur2(w.ist)) + '</b> kalt im Monat</div>')
      + '<label class="vmh-voll">Art<select data-vmh-f="art">' + artOpt + '</select></label>'
      + '<label>Neue Kaltmiete (€ im Monat)<input inputmode="decimal" data-vmh-f="neu" value="' + (neu != null ? esc(String(neu).replace('.', ',')) : '') + '"></label>'
      + '<label>Wirksam ab<input type="date" data-vmh-f="datum" value="' + esc(_z.datum || '') + '"></label></div>';
    h += '<div class="vmh-box">' + (mg ? 'DealPilot hält <b>' + esc(eur2(mg.miete)) + '</b> für möglich' + (mg.ab ? ', wirksam ab ' + esc(datumDe(mg.ab)) : '') + '. ' + esc(mg.text) + '.'
      : (art === '559' ? 'Die Umlage einer Modernisierung rechnet DealPilot hier nicht vor. Trag die neue Miete aus deiner Modernisierungsankündigung ein.'
        : (art === 'index' ? 'Für eine Indexanpassung fehlt im Mietvertrag die Indexvereinbarung oder der Index.' : 'Nach § 558 sieht DealPilot heute keinen Spielraum (Kappungsgrenze, Vergleichsmiete oder Sperrfrist).')))
      + (w && neu != null && w.wfl > 0 ? ' <span class="vmh-hin">Neu ' + esc((neu / w.wfl).toLocaleString('de-DE', { maximumFractionDigits: 2 })) + ' €/m².</span>' : '') + '</div>';
    if (ueber) h += '<div class="vmh-box vmh-warn"><b>Mehr als DealPilot für zulässig hält.</b> Eine Mieterhöhung über der Kappungsgrenze oder der Vergleichsmiete ist im laufenden Vertrag nicht durchsetzbar.'
      + '<label><input type="checkbox" data-vmh-f="trotzdem"' + (_z.trotzdem ? ' checked' : '') + '> Ich habe es geprüft, die Miete ist so vereinbart oder zulässig.</label></div>';
    h += '<p class="vmh-hin">Eine höhere Miete bei Neuvermietung (zum Beispiel ein Ziel in €/m²) ist keine Mieterhöhung im laufenden Vertrag. Sie gilt erst mit dem nächsten Mieter und wird in ViVi mit dem neuen Mietverhältnis angelegt.</p>';
    if (_z.vorschau) h += '<div class="vmh-box vmh-ok">' + _z.vorschau + '</div>';
    if (_z.fehler) h += '<div class="vmh-fehler">' + esc(_z.fehler) + '</div>';
    var darf = w && neu != null && neu > w.ist && _z.datum && (!ueber || _z.trotzdem) && !_z.laeuft;
    h += '<div class="vmh-kn"><button type="button" class="btn btn-outline btn-sm" data-vmh="zu">Abbrechen</button>'
      + '<button type="button" class="btn btn-outline btn-sm" data-vmh="vorschau"' + (darf ? '' : ' disabled') + '>ViVi rechnen lassen</button>'
      + '<button type="button" class="btn btn-sm" data-vmh="anlegen"' + (darf && _z.vorschauOk ? '' : ' disabled') + ' title="Erst ViVi rechnen lassen">In ViVi anlegen</button></div>';
    host.innerHTML = h;
  }

  function rumpf(vorschau) {
    var w = gewaehlt();
    return { einheit: _z.W.mfh && w && w.i != null ? w.i : null, datum: _z.datum, neue_miete: _z.neu, art: _z.art,
      grund: 'Mieterhöhung aus DealPilot' + (_z.quelle ? ' (' + _z.quelle + ')' : ''), vorschau: !!vorschau, bestaetigt: !vorschau };
  }
  function vorschauText(r) {
    var v = r && r.vivi || {}, n = r.rumpf || {};
    var teile = ['ViVi hat die Änderung geprüft: ' + eur2(r.miete_bisher) + ' auf <b>' + eur2(n.new_rent) + '</b> kalt ab ' + datumDe(v.effective_date || n.effective_date) + '.'];
    var betroffen = v.affected_payments || v.payments || v.affected_months || null;
    if (Array.isArray(betroffen) && betroffen.length) teile.push(betroffen.length + ' Sollstellungen ändern sich.');
    if (v.message) teile.push(esc(v.message));
    teile.push('Noch ist nichts gespeichert.');
    return teile.join(' ');
  }
  function senden(vorschau) {
    if (!_z || _z.laeuft) return;
    var key = global._currentObjKey; if (!key || !global.Auth || !global.Auth.apiCall) return;
    _z.laeuft = true; _z.fehler = ''; zeichnen();
    global.Auth.apiCall('/vivi/objekt/' + encodeURIComponent(key) + '/mieterhoehung', { method: 'POST', body: rumpf(vorschau) })
      .then(function (r) {
        if (!_z) return;
        _z.laeuft = false;
        if (vorschau) { _z.vorschau = vorschauText(r); _z.vorschauOk = true; zeichnen(); return; }
        var w = gewaehlt(), ab = _z.datum;
        schliessen();
        try { if (global.DpVivi && global.DpVivi.objektGeladen) global.DpVivi.objektGeladen(key); } catch (e) {}
        var t = 'Mieterhöhung in ViVi angelegt: ' + (w ? w.name + ', ' : '') + eur2(r.rumpf && r.rumpf.new_rent) + ' ab ' + datumDe(ab) + '.';
        try { if (typeof global.toast === 'function') global.toast('✓ ' + t); } catch (e) {}
      })
      .catch(function (e) {
        if (!_z) return;
        _z.laeuft = false; _z.vorschauOk = vorschau ? false : _z.vorschauOk;
        _z.fehler = (e && (e.message || (e.data && e.data.error))) || 'ViVi hat die Mietänderung nicht angenommen.';
        zeichnen();
      });
  }

  function oeffnen(o) {
    o = o || {};
    if (!verfuegbar()) { try { if (typeof global.toast === 'function') global.toast('ℹ Mieterhöhungen nach ViVi gehen nur bei einem mit ViVi verknüpften Objekt.'); } catch (e) {} return false; }
    var d = doc(); if (!d) return false;
    stil(); schliessen();
    var W = wohnungen(), sel = 0;
    if (o.einheit != null) W.liste.forEach(function (x, k) { if (String(x.i) === String(o.einheit)) sel = k; });
    _z = { W: W, sel: sel, art: o.art || '558', neu: null, datum: null, trotzdem: false, vorschau: '', vorschauOk: false, fehler: '', laeuft: false, quelle: o.quelle || '' };
    var ov = d.createElement('div'); ov.id = 'dp-vmh-ov';
    ov.innerHTML = '<div id="dp-vmh" role="dialog" aria-modal="true" aria-label="Mieterhöhung in ViVi anlegen"></div>';
    d.body.appendChild(ov);
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) { schliessen(); return; }
      var b = ev.target.closest && ev.target.closest('[data-vmh]'); if (!b) return;
      ev.preventDefault();
      var a = b.getAttribute('data-vmh');
      if (a === 'zu') schliessen(); else if (a === 'vorschau') senden(true); else if (a === 'anlegen') senden(false);
    });
    ov.addEventListener('change', function (ev) {
      var f = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-vmh-f'); if (!f || !_z) return;
      var v = ev.target.value;
      if (f === 'sel') { _z.sel = +v; _z.neu = null; _z.datum = null; }
      else if (f === 'art') { _z.art = v; _z.neu = null; _z.datum = null; }
      else if (f === 'neu') _z.neu = zahlEin(v);
      else if (f === 'datum') _z.datum = v || null;
      else if (f === 'trotzdem') _z.trotzdem = !!ev.target.checked;
      if (f !== 'trotzdem') { _z.vorschau = ''; _z.vorschauOk = false; }
      _z.fehler = '';
      zeichnen();
    });
    zeichnen();
    return true;
  }

  global.DpViviMieterhoehung = { VERSION: VERSION, verfuegbar: verfuegbar, oeffnen: oeffnen, schliessen: schliessen, wohnungen: wohnungen, _ersterNaechster: ersterNaechster };
})(typeof window !== 'undefined' ? window : globalThis);
