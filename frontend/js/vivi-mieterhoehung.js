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
  var VERSION = 'v4120';
  function doc() { return global.document || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* Zahl aus Modell oder Eingabe: Zahlen bleiben Zahlen (806.17 ist kein Tausender), Text deutsch oder englisch */
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var t = String(v).trim().replace(/\s|€/g, '');
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    var n = parseFloat(t); return isFinite(n) ? n : null;
  }
  /* Termine im Modell sind JJJJ-MM, ViVi braucht einen Tag: der Erste des Monats */
  function tag(x) { var t = String(x || ''); if (/^\d{4}-\d{2}$/.test(t)) return t + '-01'; return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null; }
  function zahlEin(v) { return zahl(v); }
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
  /* DpVorschau.frei ist asynchron (Promise, immer truthy). istFrei ist synchron: false = gesperrt, null = noch nicht
     geladen (dann trägt der ViVi-Stand, den das Backend nur bei freier Funktion liefert). Gemessen im Quertest v4037f. */
  var _frei = null;   /* Ergebnis von DpVorschau.frei('vivi'), einmal geladen */
  try { if (global.DpVorschau && typeof global.DpVorschau.frei === 'function') global.DpVorschau.frei('vivi').then(function (v) { _frei = !!v; }).catch(function () { _frei = false; }); } catch (e) {}
  function vorschauFrei() { try { if (_frei === false) return false; var V = global.DpVorschau; return !(V && typeof V.istFrei === 'function' && V.istFrei('vivi') === false); } catch (e) { return false; } }
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
        /* Spielraum nach § 558 nur ohne Index- oder Staffelvertrag (dort gilt der Vertrag, § 557a/b) */
        soll: !so.vertrag && so.miete != null && so.miete > ist + 0.5 ? Math.round(so.miete * 100) / 100 : null, soll_ab: tag(t.wirksam_ab || so.ab), verlangbar_ab: tag(t.verlangbar_ab),
        ab_text: so.ab_text || '', vertrag: so.vertrag || null, vertrag_miete: so.vertrag && zahl(so.vertrag_monat) > ist + 0.5 ? zahl(so.vertrag_monat) : null,
        index_miete: ix ? zahl(ix.miete_neu) : null, index_ab: ix ? tag(ix.wirksam) : null });
    });
    return { mfh: !!(m && m.art === 'mfh'), liste: out };
  }

  /* v4042 · Marcel 23.11.2026: „Mieterhöhung in ViVi“ stand im Häuschen, obwohl darüber „kein Spielraum“ stand. EINE Regel
     für alle Knöpfe (Reiter Miete, Liste der Mieterhöhungen, Pilot-Analyse › ViVi): Spielraum nur, wenn DealPilot eine
     zulässige Miete (§ 558), die nächste Indexanpassung oder die nächste Staffel ÜBER der heutigen Miete sieht. vergleich =
     Miete laut ViVi, wenn bekannt: dann muss das Mögliche auch darüber liegen. einheit = Index der Wohnung, null = Objekt. */
  function spielraum(einheit, vergleich) {
    /* v4060 · EINE Stelle für die maximale Miete (js/miete-max.js): Spielraum im laufenden Vertrag = Bestand (§ 558, Staffel, Index) über heute */
    var M = global.DpMieteMax;
    if (M && M.einheit) {
      var e = null; try { e = M.einheit(einheit == null || einheit === 'objekt' ? null : einheit); } catch (x0) { e = null; }
      if (e) return !e.leer && e.bestand.mehr && e.bestand.monat > Math.max(e.heute || 0, zahl(vergleich) || 0) + 0.5;
    }
    var W = wohnungen(), x = null;
    W.liste.forEach(function (w) { if (einheit == null || einheit === 'objekt' ? !x : String(w.i) === String(einheit)) x = x || w; });
    if (!x) return false;
    var basis = Math.max(x.ist || 0, zahl(vergleich) || 0) + 0.5;
    return [x.soll, x.index_miete, x.vertrag_miete].some(function (m) { return m != null && m > basis; });
  }
  function stil() {
    var d = doc(); if (!d || d.getElementById('dp-vmh-stil')) return;
    var s = d.createElement('style'); s.id = 'dp-vmh-stil';
    s.textContent = [
      /* v4120 · Rahmen wie „Belege einlesen“ (.oabi-ov, Marke und Gold-Kopf aus modal-boarding-skin.js), hier nur der Inhalt */
      '#dp-vmh-ov{z-index:100500}',
      '#dp-vmh-ov .oabi-modal.dp-vmh-modal{width:min(600px,100%);max-height:92vh}',
      '#dp-vmh{color:#2A2727;font:400 13px/1.55 Inter,system-ui,sans-serif;padding:14px 22px 6px}',
      '#dp-vmh-foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
      '#dp-vmh .vmh-wahl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 10px}',
      '#dp-vmh .vmh-wahl label{flex-direction:row;align-items:flex-start;gap:8px;border:1px solid #E6DCC2;border-radius:10px;padding:9px 11px;background:#fff;cursor:pointer;color:#2A2727;font-size:12.5px}',
      '#dp-vmh .vmh-wahl label.an{border-color:var(--wl-c9a84c, #C9A84C);box-shadow:0 0 0 1px var(--wl-c9a84c, #C9A84C) inset;background:var(--gold-bg, rgba(201,168,76,.08))}',
      '#dp-vmh .vmh-wahl input{margin-top:2px;accent-color:var(--wl-c9a84c, #C9A84C)}',
      '#dp-vmh .vmh-wahl small{display:block;color:#6B645A;font-size:11.5px;margin-top:1px}',
      '#dp-vmh .vmh-vgl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}',
      '#dp-vmh .vmh-vgl>div{border:1px solid #EFE8D6;border-radius:9px;padding:8px 11px;background:#fff}',
      '#dp-vmh .vmh-vgl span{display:block;font:600 10px/1.3 "JetBrains Mono",monospace;letter-spacing:1.2px;text-transform:uppercase;color:#7A7370}',
      '#dp-vmh .vmh-vgl b{font:600 17px/1.3 "Space Grotesk",Inter,sans-serif}',
      '#dp-vmh label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#6B645A}',
      '#dp-vmh input,#dp-vmh select{font:inherit;color:#2A2727;padding:7px 8px;border:1px solid #E6DCC2;border-radius:7px;background:#fff;min-width:0}',
      '#dp-vmh .vmh-g{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}',
      '#dp-vmh .vmh-g .vmh-voll{grid-column:1 / -1}',
      '#dp-vmh .vmh-box{border:1px solid #EFE8D6;border-radius:9px;padding:9px 11px;margin:8px 0;background:#fff}',
      '#dp-vmh .vmh-warn{border-color:#D8564C;background:rgba(216,86,76,.06)}',
      '#dp-vmh .vmh-warn label{flex-direction:row;align-items:flex-start;gap:7px;color:#2A2727;margin-top:6px}',
      '#dp-vmh .vmh-ok{border-color:#3FA56C;background:rgba(63,165,108,.07)}',
      '#dp-vmh .vmh-hin{color:#6B645A;font-size:12px}',
      '#dp-vmh .vmh-fehler{color:#B8625C;margin-top:6px}',
      '@media (max-width:560px){#dp-vmh .vmh-g,#dp-vmh .vmh-wahl,#dp-vmh .vmh-vgl{grid-template-columns:1fr}#dp-vmh{padding:12px 14px 4px}#dp-vmh-ov .oabi-modal.dp-vmh-modal{max-height:100vh;height:100%;border-radius:0}#dp-vmh-ov{padding:0}}'
    ].join('\n');
    d.head.appendChild(s);
  }

  /* v4120 · Marcel 23.11.2026: „nicht im passenden Design“. Beide ViVi-Fenster (Mieterhöhung, Nebenkosten) im Rahmen der
     Einlese-Fenster: .oabi-ov > .oabi-modal mit Kopf, Unterzeile, Inhalt und Fuß. modal-boarding-skin.js legt Marke, Gold-Kopf
     und Kreuz darüber (das Kreuz klickt den ersten Fußknopf ohne primary, also Abbrechen). Gezeichnet wird nur Inhalt und Fuß. */
  function rahmen(titel, sub) {
    var d = doc(); if (!d) return null;
    stil();
    var alt = d.getElementById('dp-vmh-ov'); if (alt && alt.parentNode) alt.parentNode.removeChild(alt);
    var ov = d.createElement('div'); ov.className = 'oabi-ov dp-vmh-ov'; ov.id = 'dp-vmh-ov';
    ov.innerHTML = '<div class="oabi-modal dp-vmh-modal" role="dialog" aria-modal="true" aria-label="' + esc(titel) + '">'
      + '<div class="oabi-head"><h3>' + esc(titel) + '</h3></div><div class="oabi-sub">' + esc(sub) + '</div>'
      + '<div class="oabi-body" id="dp-vmh"></div><div class="oabi-foot" id="dp-vmh-foot"></div></div>';
    d.body.appendChild(ov);
    return ov;
  }
  function fuss(html) { var d = doc(), f = d && d.getElementById('dp-vmh-foot'); if (f) f.innerHTML = html; }
  /** Fußknopf im Stil der Einlese-Fenster. art: 'zu' | 'neben' | 'haupt' */
  function fk(attr, wert, text, art, an, titel) {
    return '<button type="button" class="oabi-btn' + (art === 'haupt' ? ' primary' : '') + '" data-' + attr + '="' + wert + '"' + (an === false ? ' disabled' : '') + (titel ? ' title="' + esc(titel) + '"' : '') + '>' + text + '</button>';
  }
  /* Esc schließt das offene ViVi-Fenster wie das Kreuz */
  try { doc().addEventListener('keydown', function (ev) { if (ev.key !== 'Escape') return; var o = doc().getElementById('dp-vmh-ov'); if (!o) return; var c = o.querySelector('.oabi-foot .oabi-btn:not(.primary)'); if (c) { ev.preventDefault(); c.click(); } }); } catch (e) {}

  var _z = null;   /* Zustand des offenen Fensters */
  function schliessen() { var o = doc() && doc().getElementById('dp-vmh-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); _z = null; }

  function gewaehlt() { return _z && _z.W.liste[_z.sel] || null; }
  function moeglich(w, art) {
    if (!w) return null;
    if (art === 'index') return w.index_miete != null && w.index_miete > w.ist ? { miete: w.index_miete, ab: w.index_ab, text: 'nächste Indexanpassung laut Vertrag' } : null;
    if (art === '559') return null;   /* Modernisierung: DealPilot rechnet die Umlage hier nicht vor */
    if (art === 'staffel') return w.vertrag_miete != null ? { miete: w.vertrag_miete, ab: null, text: 'nächste Staffel laut deiner Angabe zum Vertrag' } : null;
    return w.soll != null ? { miete: w.soll, ab: w.soll_ab, text: w.ab_text || 'Vergleichsmiete und Kappungsgrenze' } : null;
  }

  function artFuer(w, gewuenscht) { if (gewuenscht) return gewuenscht; return w && (w.vertrag === 'index' || w.vertrag === 'staffel') ? w.vertrag : '558'; }
  function zeichnen() {
    var d = doc(), host = d && d.getElementById('dp-vmh'); if (!host || !_z) return;
    var W = _z.W, w = gewaehlt(), art = _z.art, mg = moeglich(w, art);
    if (_z.neu == null && w) _z.neu = mg ? mg.miete : null;
    if (!_z.datum && w) _z.datum = mg && mg.ab ? mg.ab : ersterNaechster(null);
    var neu = _z.neu, ueber = !!(w && neu != null && (mg ? neu > mg.miete + 0.5 : (art !== '559' && neu > w.ist)));
    var opts = W.liste.map(function (x, k) { return '<option value="' + k + '"' + (k === _z.sel ? ' selected' : '') + '>' + esc(x.name) + ', heute ' + esc(eur2(x.ist)) + '</option>'; }).join('');
    var artOpt = [['558', 'Vergleichsmiete (§ 558 BGB)'], ['index', 'Indexmiete (§ 557b BGB)'], ['staffel', 'Staffelmiete (§ 557a BGB)'], ['559', 'Modernisierung (§ 559 BGB)']]
      .map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === art ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('');
    var h = '';
    if (!W.liste.length) {
      host.innerHTML = '<div class="vmh-box vmh-warn">Für dieses Objekt gibt es keine vermietete Wohnung mit Miete. Eine Mieterhöhung braucht ein laufendes Mietverhältnis.</div>';
      fuss(fk('vmh', 'zu', 'Schließen', 'zu')); return;
    }
    h += '<div class="vmh-g">'
      + (W.mfh ? '<label class="vmh-voll">Wohnung<select data-vmh-f="sel">' + opts + '</select></label>' : '<div class="vmh-voll vmh-hin">' + esc(w.name) + ', Miete heute <b>' + esc(eur2(w.ist)) + '</b> kalt im Monat</div>')
      + '<label class="vmh-voll">Art<select data-vmh-f="art">' + artOpt + '</select></label>'
      + '<label>Neue Kaltmiete (€ im Monat)<input inputmode="decimal" data-vmh-f="neu" value="' + (neu != null ? esc(String(neu).replace('.', ',')) : '') + '"></label>'
      + '<label>Wirksam ab<input type="date" data-vmh-f="datum" value="' + esc(_z.datum || '') + '"></label></div>';
    h += '<div class="vmh-box">' + (mg ? 'DealPilot hält <b>' + esc(eur2(mg.miete)) + '</b> für möglich' + (mg.ab ? ', wirksam ab ' + esc(datumDe(mg.ab)) : '') + '. ' + esc(mg.text) + '.'
      : (art === '559' ? 'Die Umlage einer Modernisierung rechnet DealPilot hier nicht vor. Trag die neue Miete aus deiner Modernisierungsankündigung ein.'
        : (art === 'index' ? 'Für eine Indexanpassung fehlt im Mietvertrag die Indexvereinbarung oder der Index.'
          : (art === 'staffel' ? 'Für diese Wohnung ist keine nächste Staffel eingetragen. Trag sie aus dem Mietvertrag ein.'
            : (w && w.vertrag === 'gewerbe' ? 'Bei Gewerbe gilt § 558 nicht. Die Erhöhung richtet sich nach dem Mietvertrag (Index, Staffel oder Vereinbarung). Trag die vereinbarte Miete ein.'
              : (w && w.vertrag ? 'Bei einem ' + (w.vertrag === 'index' ? 'Index' : 'Staffel') + 'mietvertrag gibt es keine Erhöhung nach § 558. Wähl die Art des Vertrags.' : 'Nach § 558 sieht DealPilot heute keinen Spielraum (Kappungsgrenze, Vergleichsmiete oder Sperrfrist).'))))))
      + (w && neu != null && w.wfl > 0 ? ' <span class="vmh-hin">Neu ' + esc((neu / w.wfl).toLocaleString('de-DE', { maximumFractionDigits: 2 })) + ' €/m².</span>' : '') + '</div>';
    if (ueber) h += '<div class="vmh-box vmh-warn"><b>Mehr als DealPilot für zulässig hält.</b> Eine Mieterhöhung über der Kappungsgrenze oder der Vergleichsmiete ist im laufenden Vertrag nicht durchsetzbar.'
      + '<label><input type="checkbox" data-vmh-f="trotzdem"' + (_z.trotzdem ? ' checked' : '') + '> Ich habe es geprüft, die Miete ist so vereinbart oder zulässig.</label></div>';
    h += '<p class="vmh-hin">Eine höhere Miete bei Neuvermietung (zum Beispiel ein Ziel in €/m²) ist keine Mieterhöhung im laufenden Vertrag. Sie gilt erst mit dem nächsten Mieter und wird in ViVi mit dem neuen Mietverhältnis angelegt.</p>';
    if (_z.vorschau) h += '<div class="vmh-box vmh-ok">' + _z.vorschau + '</div>';
    if (_z.fehler) h += '<div class="vmh-fehler">' + esc(_z.fehler) + '</div>';
    var darf = w && neu != null && neu > w.ist && _z.datum && (!ueber || _z.trotzdem) && !_z.laeuft;
    host.innerHTML = h;
    fuss(fk('vmh', 'zu', 'Abbrechen', 'zu') + fk('vmh', 'vorschau', _z.laeuft ? 'ViVi rechnet …' : 'ViVi rechnen lassen', 'neben', !!darf)
      + fk('vmh', 'anlegen', 'In ViVi anlegen', 'haupt', !!(darf && _z.vorschauOk), 'Erst ViVi rechnen lassen'));
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
    schliessen();
    var W = wohnungen(), sel = 0;
    if (o.einheit != null) W.liste.forEach(function (x, k) { if (String(x.i) === String(o.einheit)) sel = k; });
    _z = { W: W, sel: sel, art: artFuer(W.liste[sel], o.art), neu: null, datum: null, trotzdem: false, vorschau: '', vorschauOk: false, fehler: '', laeuft: false, quelle: o.quelle || '' };
    var ov = rahmen('Mieterhöhung in ViVi anlegen', 'DealPilot legt die neue Miete als Mietänderung in ViVi an. Den Brief an den Mieter schickst du wie gewohnt, zustimmen muss er bei § 558 selbst.');
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) { schliessen(); return; }
      var b = ev.target.closest && ev.target.closest('[data-vmh]'); if (!b || b.disabled) return;
      ev.preventDefault();
      var a = b.getAttribute('data-vmh');
      if (a === 'zu') schliessen(); else if (a === 'vorschau') senden(true); else if (a === 'anlegen') senden(false);
    });
    ov.addEventListener('change', function (ev) {
      var f = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-vmh-f'); if (!f || !_z) return;
      var v = ev.target.value;
      if (f === 'sel') { _z.sel = +v; _z.neu = null; _z.datum = null; _z.art = artFuer(gewaehlt(), null); }
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

  global.DpViviMieterhoehung = { VERSION: VERSION, verfuegbar: verfuegbar, oeffnen: oeffnen, schliessen: schliessen, stil: stil /* v4042 · auch fuer DpViviNkAnpassung */, rahmen: rahmen, fuss: fuss, fk: fk /* v4120 */, spielraum: spielraum, wohnungen: wohnungen, _ersterNaechster: ersterNaechster };
})(typeof window !== 'undefined' ? window : globalThis);
