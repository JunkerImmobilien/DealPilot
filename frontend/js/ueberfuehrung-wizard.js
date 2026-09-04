/* ueberfuehrung-wizard.js — v816: Ueberfuehrungs-Wizard Privat -> GmbH.
 * Eigenstaendiges Modul (kein deal-action.js-Umbau). window.DealPilotUeberfuehrung.open().
 * Legt 2 getrennte Objekte an: Privat-Objekt friert ein (ueberf_ende), neues GmbH-Objekt
 * mit kopierten Werten + Fotos + KI. Gegenseitig verlinkt (_ueberf_link).
 * Look: dunkler Header + Gold-Hero (wie DealPilot-Mail). Marker: dpuew-*
 */
(function () {
  'use strict';
  if (window.DealPilotUeberfuehrung) return;

  var _cur = 1;
  var _ctx = null;  // { privatKey, privatBlob, privatImgs, privatAi, privatKuerzel }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function _de(n){ try { return Math.round(parseFloat(String(n).replace(/[^0-9.,-]/g,'').replace(/\./g,'').replace(',','.'))||0).toLocaleString('de-DE'); } catch(e){ return n; } }

  /* ---- GmbH-Mandanten verfuegbar? ---- */
  function _corpMandanten() {
    try {
      if (!window.DealPilotMandanten || !DealPilotMandanten.getList) return [];
      return DealPilotMandanten.getList().filter(function (m) {
        return m && DealPilotMandanten.isCorp && DealPilotMandanten.isCorp(m.rechtsform);
      });
    } catch (e) { return []; }
  }

  function open() {
    /* Vorbedingung: ein Objekt ist geladen */
    if (typeof _currentObjKey === 'undefined' || !window._currentObjKey && typeof _currentObjKey === 'undefined') { /* tolerant */ }
    var _ck = (typeof _currentObjKey !== 'undefined') ? _currentObjKey : (window._currentObjKey || null);
    if (!_ck) { if (typeof toast === 'function') toast('Bitte zuerst ein Objekt oeffnen, das ueberfuehrt werden soll.'); return; }

    var corps = _corpMandanten();
    if (!corps.length) {
      if (typeof toast === 'function') toast('Keine Gesellschaft (GmbH/UG) angelegt. Bitte zuerst in den Einstellungen einen Mandanten anlegen.');
      return;
    }

    /* ── v1234 · Vorpruefung: schon ueberfuehrt? ──────────────────────────
       Gemessen am 04.09.2026 an Marcels Staging-Daten, und es war real:
         2026-1002 (privat, eingefroren) -> 2026-1007 (GmbH)
         2026-1007 (GmbH!)               -> 2026-1008 (GmbH)
       Der Assistent hat ein GESELLSCHAFTS-Objekt ein zweites Mal ueberfuehrt.
       Ergebnis: eine Kette statt eines Paares, und zwischen 1007 und 1008 ein
       gegenseitiger Ring (_ueberf_link zeigt aufeinander).

       Er hat vorher NUR geprueft, ob ueberhaupt eine Gesellschaft existiert.
       Nicht, ob das offene Objekt dafuer in Frage kommt. Beide Faelle sind
       am Objekt selbst ablesbar und werden jetzt abgewiesen — mit dem Grund,
       nicht nur mit einem Nein. */
    var _herkEl = document.getElementById('obj_herkunft');
    if (_herkEl && _herkEl.value === 'ueberfuehrung') {
      if (typeof toast === 'function') toast('Dieses Objekt ist bereits das Ergebnis einer Überführung — es gehört schon einer Gesellschaft.');
      return;
    }
    var _endeEl0 = document.getElementById('ueberf_ende');
    if (_endeEl0 && (_endeEl0.value || '').trim()) {
      if (typeof toast === 'function') toast('Dieses Objekt ist bereits überführt und zum ' + _endeEl0.value.split('-').reverse().join('.') + ' eingefroren.');
      return;
    }
    var _haltEl0 = document.getElementById('halter');
    if (_haltEl0 && _haltEl0.value && _haltEl0.value !== 'privat') {
      var _mn = '';
      try { var _m = DealPilotMandanten.get(_haltEl0.value); if (_m && _m.id === _haltEl0.value) _mn = _m.name; } catch (e) {}
      if (typeof toast === 'function') toast('Dieses Objekt gehört bereits ' + (_mn || 'einer Gesellschaft') + '. Nur Privatobjekte lassen sich überführen.');
      return;
    }

    /* Kontext sichern */
    var _blob = (typeof collectData === 'function') ? collectData() : {};
    _ctx = {
      privatKey: _ck,
      privatBlob: _blob,
      privatImgs: (typeof imgs !== 'undefined' && imgs) ? imgs.slice() : [],
      privatAi: window._aiText || '',
      privatKuerzel: _blob.kuerzel || '',
      corps: corps
    };
    _cur = 1;
    _render();
  }

  function _overlay() {
    var ov = document.getElementById('dpuew-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'dpuew-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,10,.62);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto';
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    return ov;
  }

  function close() { var ov = document.getElementById('dpuew-overlay'); if (ov) ov.remove(); _ctx = null; }

  function _stichtagInfo(d) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    var y = parseInt(d.slice(0,4),10), m = parseInt(d.slice(5,7),10);
    var startY = null;
    try { if (window.DealPilotAnteilig && DealPilotAnteilig.getBaseYear) { var by = DealPilotAnteilig.getBaseYear(); if (by) startY = by; } } catch(e){}
    if (startY == null) startY = y;
    var full = Math.max(0, y - startY);
    var mon = ['','Jan','Feb','M&auml;r','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][m];
    return 'Privat-Objekt rechnet bis <b>' + mon + ' ' + y + '</b> (' + full + ' volle Jahre + ' + m + '/12), dann eingefroren.';
  }

  function _render() {
    var ov = _overlay();
    var c = _ctx;
    var corpOpts = c.corps.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>'; }).join('');
    var defVw = c.privatBlob.bankval || c.privatBlob.svwert || c.privatBlob.kp || '';
    var defRs = c.privatBlob.ueberf_restschuld || c.privatBlob.d1 || '';

    ov.innerHTML =
      '<div style="background:#FDFCFA;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);max-width:600px;width:100%;font-family:Inter,system-ui,sans-serif">' +
        /* dunkler Header-Balken (Mail-Look) */
        '<div style="background:#0a0a0a;padding:15px 22px;display:flex;align-items:center;justify-content:space-between">' +
          '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:19px;font-weight:700;color:#fff">Deal<span style="color:#E8CC7A">Pilot</span></div>' +
          '<div style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:4px;color:#C9A84C;text-transform:uppercase">DealPilot</div>' +
        '</div>' +
        /* Gold-Hero */
        '<div style="background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);padding:20px 22px">' +
          '<div style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:3px;text-transform:uppercase;color:#7a5e16;margin-bottom:8px">Boarding &middot; Privatbestand &rarr; Gesellschaft</div>' +
          '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:21px;color:#1b1408;font-weight:700">Objekt in GmbH &uuml;berf&uuml;hren</div>' +
        '</div>' +
        /* Steps */
        '<div style="display:flex;padding:12px 22px;background:#FAF9F4;border-bottom:1px solid #EDE7DA;font-size:11px;gap:4px">' +
          _stepHtml(1,'Stichtag') + _stepHtml(2,'Gesellschaft') + _stepHtml(3,'Best&auml;tigen') +
        '</div>' +
        /* Body */
        '<div style="padding:22px" id="dpuew-body">' + _paneHtml(corpOpts, defVw, defRs) + '</div>' +
        /* Footer */
        '<div style="display:flex;justify-content:space-between;gap:10px;padding:15px 22px;border-top:1px solid #EDE7DA;background:#FAF9F4">' +
          '<button id="dpuew-back" onclick="DealPilotUeberfuehrung._go(-1)" style="padding:9px 18px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #EDE7DA;background:#fff;color:#7A7370;font-family:inherit;visibility:' + (_cur===1?'hidden':'visible') + '">Zur&uuml;ck</button>' +
          '<button id="dpuew-next" onclick="DealPilotUeberfuehrung._go(1)" style="padding:9px 20px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1b1408;font-family:inherit">' + (_cur===3?'&#9992; &Uuml;berf&uuml;hren':'Weiter &rarr;') + '</button>' +
        '</div>' +
      '</div>';
    _bindStichtag();
  }

  function _stepHtml(n, label) {
    var done = _cur > n, active = _cur === n;
    var bg = active ? 'linear-gradient(110deg,#E8CC7A,#C9A84C)' : (done ? '#3FA56C' : '#e6dfce');
    var col = (active||done) ? (done?'#fff':'#1b1408') : '#7A7370';
    return '<div style="flex:1;text-align:center;font-weight:600;color:' + (active?'#b8932f':'#7A7370') + '">' +
      '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';color:' + col + ';display:flex;align-items:center;justify-content:center;margin:0 auto 5px;font-weight:700">' + (done?'&#10003;':n) + '</div>' + label + '</div>';
  }

  function _paneHtml(corpOpts, defVw, defRs) {
    var fld = 'margin-bottom:13px';
    var lab = 'display:block;font-size:12px;font-weight:600;margin-bottom:5px';
    var inp = 'width:100%;padding:9px 11px;border:1px solid #EDE7DA;border-radius:9px;font-size:14px;font-family:inherit;background:#fff;box-sizing:border-box';
    if (_cur === 1) {
      return '<h2 style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;margin:0 0 6px">Stichtag der &Uuml;berf&uuml;hrung</h2>' +
        '<p style="color:#7A7370;font-size:13px;margin:0 0 16px">Bis zu diesem Datum rechnet das Objekt privat (anteilig im Stichtagsmonat), danach in der Gesellschaft.</p>' +
        '<div style="' + fld + '"><label style="' + lab + '">Stichtag &middot; Privat &rarr; Gesellschaft</label>' +
        '<input type="date" id="dpuew-stichtag" style="' + inp + '"></div>' +
        '<div id="dpuew-cut-info" style="display:flex;align-items:center;gap:8px;background:rgba(184,98,80,.07);border:1px solid rgba(184,98,80,.25);border-radius:9px;padding:10px 12px;font-size:12.5px;color:#8a4a3c"></div>';
    }
    if (_cur === 2) {
      return '<h2 style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;margin:0 0 6px">In welche Gesellschaft?</h2>' +
        '<p style="color:#7A7370;font-size:13px;margin:0 0 16px">Adresse, Kaufpreis, Miete, Finanzierung, Fotos und KI-Analyse werden &uuml;bernommen.</p>' +
        '<div style="' + fld + '"><label style="' + lab + '">Halter / Gesellschaft</label><select id="dpuew-halter" style="' + inp + '">' + corpOpts + '</select></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><label style="' + lab + '">Verkehrswert (AfA-Basis)</label><input id="dpuew-vw" value="' + esc(_de(defVw)) + '" style="' + inp + '"></div>' +
          '<div><label style="' + lab + '">&Uuml;berf&uuml;hrungspreis (GrESt)</label><input id="dpuew-up" value="" style="' + inp + '"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px">' +
          '<div><label style="' + lab + '">&Uuml;bernommene Restschuld</label><input id="dpuew-rs" value="' + esc(_de(defRs)) + '" style="' + inp + '"></div>' +
          '<div><label style="' + lab + '">Zins &uuml;bernommen % p.a.</label><input id="dpuew-zins" value="" style="' + inp + '"></div>' +
        '</div>' +
        /* ── v1234 · Die Regeln, die an dieser Stelle gelten ────────────────
           Der Assistent sammelte Verkehrswert und Ueberfuehrungspreis, sagte
           aber mit keinem Wort, WOZU die beiden Zahlen dienen und was der
           Vorgang steuerlich ausloest. Nachgetragen, jeweils mit Paragraph:

           § 8 Abs. 1 GrEStG — Bemessungsgrundlage ist die GEGENLEISTUNG, also
             der Ueberfuehrungspreis, nicht der Verkehrswert. Der BFH hat 2023
             bestaetigt, dass ein Preis unter Verkehrswert als Gegenleistung
             anzuerkennen ist.
           Verdeckte Einlage — die Differenz Verkehrswert minus
             Ueberfuehrungspreis. Sie erhoeht den Buchwert in der Gesellschaft
             und damit die AfA-Bemessungsgrundlage. Genau deshalb stehen hier
             ZWEI Felder und nicht eins.
           § 42 AO — ein sehr niedriger Preis ist zulaessig, aber angreifbar.
           § 23 EStG — die Zehnjahresfrist. Sie wird GERECHNET, nicht nur
             erwaehnt: die App kennt Kaufdatum und Stichtag. Siehe _spekPruefen(). */
        '<div id="dpuew-regeln" style="margin-top:14px;padding:11px 13px;border-left:3px solid var(--wl-c9a84c,#C9A84C);background:#fbf8f0;border-radius:0 9px 9px 0;font-size:12px;line-height:1.55;color:#5f594f">' +
          '<div style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:1px;text-transform:uppercase;color:#8a8378;margin-bottom:6px">Was die beiden Zahlen ausl&ouml;sen</div>' +
          '<div style="margin-bottom:5px"><b>Grunderwerbsteuer</b> f&auml;llt auf den <b>&Uuml;berf&uuml;hrungspreis</b> an, nicht auf den Verkehrswert (&sect; 8 Abs. 1 GrEStG). Der Satz liegt je nach Bundesland bei 3,5 bis 6,5 %.</div>' +
          '<div style="margin-bottom:5px"><b>Verdeckte Einlage</b> ist die Differenz: <span id="dpuew-ve">&mdash;</span>. Sie erh&ouml;ht die AfA-Bemessungsgrundlage der Gesellschaft auf den Verkehrswert.</div>' +
          '<div id="dpuew-spek" style="margin-bottom:5px">&mdash;</div>' +
          '<div style="color:#8a8378">Ein Preis deutlich unter Verkehrswert ist zul&auml;ssig (BFH 2023), kann aber vom Finanzamt angegriffen werden (&sect; 42 AO). <b>Verbindliche Auskunft vorher</b> ist der sichere Weg. DealPilot rechnet, es ber&auml;t nicht.</div>' +
        '</div>';
    }
    /* Schritt 3 */
    return '<h2 style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;margin:0 0 6px">&Uuml;berf&uuml;hrung best&auml;tigen</h2>' +
      '<p style="color:#7A7370;font-size:13px;margin:0 0 16px">Beim Klick auf &bdquo;&Uuml;berf&uuml;hren&ldquo; passiert:</p>' +
      '<div style="display:flex;gap:10px;align-items:stretch">' +
        '<div style="flex:1;border:1px solid rgba(184,98,80,.4);background:rgba(184,98,80,.04);border-radius:11px;padding:13px">' +
          '<div style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:1px;text-transform:uppercase;color:#B86250;margin-bottom:8px">&#9656; Privat &middot; friert ein</div>' +
          '<div style="font-weight:600;font-size:13px;margin-bottom:3px">' + esc(_ctx.privatKuerzel || 'Privat-Objekt') + '</div>' +
          '<div style="font-size:11.5px;color:#5f594f" id="dpuew-sum-cut">Ende: ' + esc((document.getElementById('dpuew-stichtag')||{}).value||'') + '</div>' +
          '<div style="font-size:11.5px;color:#5f594f">&rarr; rechnet bis Stichtag</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;color:#b8932f;font-size:22px">&#8644;</div>' +
        '<div style="flex:1;border:1px solid rgba(63,165,108,.4);background:rgba(63,165,108,.05);border-radius:11px;padding:13px">' +
          '<div style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:1px;text-transform:uppercase;color:#3FA56C;margin-bottom:8px">&#9656; GmbH &middot; neu</div>' +
          '<div style="font-weight:600;font-size:13px;margin-bottom:3px">' + esc((_ctx.privatKuerzel||'') + ' VV') + '</div>' +
          '<div style="font-size:11.5px;color:#5f594f" id="dpuew-sum-halter"></div>' +
          '<div style="font-size:11.5px;color:#5f594f">&rarr; ab Stichtag, KSt-Regime</div>' +
        '</div>' +
      '</div>';
  }

  /* ── v1234 · Die Zehnjahresfrist wird gerechnet, nicht erwaehnt ───────────
     § 23 Abs. 1 Nr. 1 EStG: liegen zwischen Anschaffung und Veraeusserung
     nicht mehr als zehn Jahre, ist der Gewinn ein privates
     Veraeusserungsgeschaeft und einkommensteuerpflichtig. Eine Ueberfuehrung
     an die eigene Gesellschaft IST eine Veraeusserung — die Gesellschaft ist
     ein eigener Rechtstraeger.

     Die App kennt beide Daten: `kaufdat` des Privatobjekts und den Stichtag.
     Also wird gerechnet und beim Namen genannt, statt den Nutzer raten zu
     lassen. Fehlt das Kaufdatum, wird NICHTS behauptet — dann steht da, dass
     es fehlt. Das ist die Hausregel: wo die Quelle endet, endet die Rechnung. */
  function _spekPruefen(stichtag) {
    var kd = '';
    try { kd = (_ctx && _ctx.privatBlob && _ctx.privatBlob.kaufdat) || ''; } catch (e) {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(kd))) {
      return { art: 'unbekannt', text: '<b>Zehnjahresfrist (§ 23 EStG):</b> nicht prüfbar — im Privat-Objekt fehlt das Kaufdatum.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(stichtag || ''))) {
      return { art: 'unbekannt', text: '<b>Zehnjahresfrist (§ 23 EStG):</b> wird geprüft, sobald der Stichtag steht.' };
    }
    var a = new Date(kd + 'T00:00:00'), b = new Date(stichtag + 'T00:00:00');
    var frist = new Date(a.getFullYear() + 10, a.getMonth(), a.getDate());
    var de = function (d) { return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); };
    if (b > frist) {
      return { art: 'frei', text: '<b>Zehnjahresfrist (§ 23 EStG): abgelaufen.</b> Angeschafft am ' + de(a) + ', Frist endete am ' + de(frist) + '. Ein Gewinn aus der Überführung ist einkommensteuerfrei.' };
    }
    var tage = Math.ceil((frist - b) / 86400000);
    return { art: 'steuerpflichtig', text: '<b>Achtung, Zehnjahresfrist (§ 23 EStG) läuft noch.</b> Angeschafft am ' + de(a) + ', Frist endet am ' + de(frist) + ' — das sind noch <b>' + tage + ' Tage</b>. Die Überführung ist dann ein <b>privates Veräußerungsgeschäft</b>: der Gewinn (Überführungspreis minus fortgeführte Anschaffungskosten) ist einkommensteuerpflichtig.' };
  }

  function _regelnAktualisieren() {
    var vwEl = document.getElementById('dpuew-vw'), upEl = document.getElementById('dpuew-up');
    var veEl = document.getElementById('dpuew-ve'), spEl = document.getElementById('dpuew-spek');
    if (!veEl || !spEl) return;
    var num = function (el) { if (!el) return 0; var n = parseFloat(String(el.value || '').replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
    var upd = function () {
      var vw = num(vwEl), up = num(upEl), ve = vw - up;
      if (!vw && !up) { veEl.innerHTML = '&mdash;'; }
      else if (ve > 0) { veEl.innerHTML = '<b>' + _de(ve) + ' €</b>'; }
      else if (ve === 0) { veEl.innerHTML = '<b>0 €</b> — zum Verkehrswert überführt, keine verdeckte Einlage.'; }
      else { veEl.innerHTML = '<b style="color:#B8625C">keine</b> — der Überführungspreis liegt über dem Verkehrswert. Das wäre eine verdeckte Gewinnausschüttung, kein Einlagevorgang.'; }
      var s = _spekPruefen(_ctx && _ctx._stichtag);
      spEl.innerHTML = s.text;
      spEl.style.color = (s.art === 'steuerpflichtig') ? '#B8625C' : (s.art === 'frei' ? '#3FA56C' : '#8a8378');
    };
    if (vwEl && !vwEl._dpuewWired) { vwEl.addEventListener('input', upd); vwEl._dpuewWired = 1; }
    if (upEl && !upEl._dpuewWired) { upEl.addEventListener('input', upd); upEl._dpuewWired = 1; }
    upd();
  }

  function _bindStichtag() {
    if (_cur === 1) {
      var d = document.getElementById('dpuew-stichtag');
      if (d) {
        if (_ctx._stichtag) d.value = _ctx._stichtag;
        var upd = function () { _ctx._stichtag = d.value; var info = document.getElementById('dpuew-cut-info'); if (info) info.innerHTML = _stichtagInfo(d.value) || '<span style="color:#7A7370">Bitte Stichtag w&auml;hlen.</span>'; };
        d.addEventListener('change', upd); upd();
      }
    }
    if (_cur === 2) { _regelnAktualisieren(); }
    if (_cur === 3) {
      var halterSel = _ctx._halterName || '';
      var sh = document.getElementById('dpuew-sum-halter'); if (sh) sh.textContent = 'Halter: ' + halterSel;
      var sc = document.getElementById('dpuew-sum-cut'); if (sc) sc.textContent = 'Ende: ' + (_ctx._stichtag || '');
    }
  }

  function _collectStep() {
    if (_cur === 1) {
      var d = document.getElementById('dpuew-stichtag');
      if (!d || !d.value) { if (typeof toast === 'function') toast('Bitte einen Stichtag w&auml;hlen.'); return false; }
      _ctx._stichtag = d.value;
    }
    if (_cur === 2) {
      var h = document.getElementById('dpuew-halter');
      _ctx._halterId = h ? h.value : null;
      _ctx._halterName = h ? h.options[h.selectedIndex].text : '';
      _ctx._vw = (document.getElementById('dpuew-vw')||{}).value || '';
      _ctx._up = (document.getElementById('dpuew-up')||{}).value || '';
      _ctx._rs = (document.getElementById('dpuew-rs')||{}).value || '';
      _ctx._zins = (document.getElementById('dpuew-zins')||{}).value || '';
      if (!_ctx._halterId) { if (typeof toast === 'function') toast('Bitte eine Gesellschaft w&auml;hlen.'); return false; }
    }
    return true;
  }

  function _go(dir) {
    if (dir === 1 && !_collectStep()) return;
    if (dir === 1 && _cur === 3) { _execute(); return; }
    _cur = Math.max(1, Math.min(3, _cur + dir));
    _render();
  }

  /* ====== Die getestete Anlege-Sequenz ====== */
  /* v816b-guard: synchrones Lauf-Flag GANZ oben (vor jedem await), damit Doppelklick nicht
     zweimal die Sequenz startet. _running wird im finally zurueckgesetzt. */
  var _running = false;
  async function _execute() {
    if (_running) return;          /* v816b: Doppelklick-Sperre (synchron) */
    _running = true;
    var nx = document.getElementById('dpuew-next');
    if (nx) { nx.disabled = true; nx.textContent = 'Wird ausgef\u00fchrt\u2026'; }
    /* v816b: saveEmptyCard (newobj-fixes.js) + Auto-Save unterdruecken, solange der Wizard
       seine eigenen, kontrollierten Saves macht. Beide Flags SYNCHRON setzen, BEVOR newObj/saveObj
       laufen. saveEmptyCard prueft window._dpEmptyCardSaving; Auto-Save prueft window._dpUeberfActive. */
    window._dpEmptyCardSaving = true;     /* verhindert die leere Karte aus dem newObj-Wrapper */
    window._dpUeberfActive = true;        /* pausiert performSave (Auto-Save) */
    try {
      var c = _ctx;
      var _privatKey = c.privatKey;
      /* 1) Privat einfrieren — nur ueberf_ende; KEIN Ueberfuehrungs-Block im Privat-Objekt */
      var _ueEl = document.getElementById('ueberf_ende');
      if (_ueEl) _ueEl.value = c._stichtag;
      var _linkEl = document.getElementById('_ueberf_link'); if (_linkEl) _linkEl.value = '';
      if (typeof saveObj === 'function') await saveObj({ silent: true });

      /* 2) GmbH anlegen — Werte/Fotos/KI uebernehmen, Ueberfuehrungsfelder ins GmbH-Objekt */
      var _g = JSON.parse(JSON.stringify(c.privatBlob));
      _g.halter = c._halterId;
      _g.obj_herkunft = 'ueberfuehrung';
      _g.verkehrswert_ueberf = c._vw;
      _g.ueberf_preis = c._up;
      _g.halter_seit = c._stichtag;
      if (c._stichtag) { _g.kaufdat = c._stichtag; _g.wirtschaftlicher_uebergang = c._stichtag; }  /* v816g-wizard-wu: Kaufdatum + wirtsch. Uebergang aufs Stichtag */
      _g.ueberf_restschuld = c._rs;
      /* v816i-zins-format: Zins mit einer Nachkommastelle (1 -> 1,0). */
      (function(){ var _zsrc = c._zins; var _zn = parseFloat(String(_zsrc == null ? '' : _zsrc).replace(',', '.'));
        _g.ueberf_rest_zins = isFinite(_zn) ? _zn.toFixed(1).replace('.', ',') : _zsrc; })();
      _g.ueberf_ende = c._stichtag || '';   /* v816h-gmbh-ende: beide Objekte bekommen Stichtag */
      _g.kuerzel = (c.privatKuerzel ? c.privatKuerzel + ' VV' : '');
      _g._ueberf_link = _privatKey;
      if (typeof newObj === 'function') newObj();   /* _dpEmptyCardSaving=true -> keine leere Karte */
      if (typeof loadData === 'function') loadData(_g);
      if (typeof imgs !== 'undefined') { imgs = c.privatImgs.slice(); if (typeof renderImgs === 'function') renderImgs(); }
      window._aiText = c.privatAi;
      if (typeof saveObj === 'function') await saveObj({ silent: true });
      var _gmbhKey = (typeof _currentObjKey !== 'undefined') ? _currentObjKey : window._currentObjKey;

      /* 3) Rueck-Link am Privat-Objekt (per API-Patch, non-fatal) */
      try {
        /* ── v1236 · Der Rueck-Link darf NIE auf das Privat-Objekt zeigen ──
           Gemessen am 04.09.2026 an echten Daten: `2026-1004` trug in
           `_ueberf_link` seine eigene Id. `_gmbhKey` wird aus
           `_currentObjKey` gelesen, und wenn der nach dem Speichern des
           neuen Objekts noch nicht umgesprungen ist, steht dort der
           Privat-Schluessel.

           Die Folge war nicht kosmetisch: undoUeberfuehrungFromPrivat()
           schickt DELETE auf den Link — das Privat-Objekt haette sich
           selbst geloescht. Dort ist der Fall jetzt abgefangen, hier wird
           er verhindert.

           Lieber KEIN Rueck-Link als ein falscher: ohne Link taut das
           Privat-Objekt sauber auf, mit falschem Link zerstoert es sich. */
        var _linkOk = _gmbhKey && _privatKey && String(_gmbhKey) !== String(_privatKey);
        if (window.Auth && Auth.apiCall && _linkOk) {
          var _pObj = await Auth.apiCall('/objects/' + _privatKey);
          var _pData = _pObj.data || {};
          _pData._ueberf_link = _gmbhKey;
          await Auth.apiCall('/objects/' + _privatKey, { method: 'PUT', body: { data: _pData, aiAnalysis: _pObj.ai_analysis || null, photos: _pObj.photos || [] } });
        } else if (!_linkOk) {
          try { console.warn('[v1236] Rueck-Link nicht gesetzt: _gmbhKey=' + _gmbhKey + ' _privatKey=' + _privatKey); } catch (e) {}
        }
      } catch (e) { /* Rueck-Link non-fatal */ }

      close();
      if (typeof toast === 'function') toast('\u2713 \u00dcberf\u00fchrt \u2014 GmbH-Objekt angelegt, Privat-Objekt eingefroren.');
      if (typeof renderSaved === 'function') renderSaved({ _immediate: true });
      if (typeof calc === 'function') calc();
      if (typeof updateSidebarPortfolio === 'function') updateSidebarPortfolio();
    } catch (err) {
      if (typeof toast === 'function') toast('Fehler bei der \u00dcberf\u00fchrung: ' + (err && err.message || err));
      var nx2 = document.getElementById('dpuew-next'); if (nx2) { nx2.disabled = false; nx2.innerHTML = '&#9992; &Uuml;berf&uuml;hren'; }
    } finally {
      /* v816b: Flags IMMER zuruecksetzen (auch bei Fehler), Auto-Save wieder freigeben */
      window._dpEmptyCardSaving = false;
      window._dpUeberfActive = false;
      _running = false;
    }
  }

  window.DealPilotUeberfuehrung = { open: open, close: close, _go: _go };
})();
