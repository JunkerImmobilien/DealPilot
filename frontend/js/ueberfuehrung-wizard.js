/* ueberfuehrung-wizard.js — v816: Ueberfuehrungs-Wizard Privat -> GmbH.
 * Eigenstaendiges Modul (kein deal-action.js-Umbau). window.DealPilotUeberfuehrung.open().
 * Legt 2 getrennte Objekte an: Privat-Objekt friert ein (ueberf_ende), neues GmbH-Objekt
 * mit kopierten Werten + Fotos + KI. Gegenseitig verlinkt (_ueberf_link).
 * Look: dunkler Header + Gold-Hero (wie DealPilot-Mail). Marker: dpuew-*
 *
 * v2984 · Steuerlich richtig statt nur kopiert (Pruefbericht 27.10.2026):
 *   - Art der Uebertragung waehlbar (Kauf · teilentgeltlich · verdeckte Einlage ·
 *     offene Sacheinlage; Sacheinlage bei der UG gesperrt, § 5a Abs. 2 S. 2 GmbHG)
 *   - GrESt der Ueberfuehrung: Gegenleistung bzw. Grundbesitzwert (§ 8 GrEStG)
 *   - § 23 EStG: Gewinn = Veraeusserungspreis/gemeiner Wert − fortgefuehrte AK,
 *     Freigrenze 1.000 €, indikative Steuer aus dem Steuerprofil
 *   - Gesellschaftsobjekt mit EIGENEN Anschaffungskosten (Ansatz + GrESt + Notar/
 *     Grundbuch, kein Makler), Boden/Gebaeude zum Stichtag, AfA nur linear § 7 Abs. 4,
 *     kein § 7b, keine degressive AfA, Sanierung des Privatobjekts NICHT uebernommen,
 *     Darlehen = Restschuld zum Stichtag, Zins ungerundet, ueberf_ende NICHT geerbt.
 * Gerechnet wird ausschliesslich im Kern ueberfuehrung-kern.js. */
(function () {
  'use strict';
  if (window.DealPilotUeberfuehrung) return;

  var _cur = 1;
  var _ctx = null;  // { privatKey, privatBlob, privatImgs, privatAi, privatKuerzel, ... }
  var K = function () { return window.DealPilotUeberfuehrungKern || null; };

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  /* Zahl aus deutscher Eingabe; leer -> null (nie 0, CLAUDE.md: Number(null) ist 0). */
  function _num(x) {
    if (x == null) return null;
    var s = String(x).trim(); if (!s) return null;
    s = s.replace(/[^0-9.,-]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   /* 145.000 = Tausender */
    var n = parseFloat(s); return isFinite(n) ? n : null;
  }
  function _eur(n) { return (n == null || !isFinite(n)) ? '—' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function _de0(n) { return (n == null || !isFinite(n)) ? '' : Math.round(n).toLocaleString('de-DE'); }
  function _pct(n, d) { return (n == null || !isFinite(n)) ? '' : (Math.round(n * Math.pow(10, d || 2)) / Math.pow(10, d || 2)).toString().replace('.', ','); }
  function _datDe(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : ''; }

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
    var _ck = (typeof _currentObjKey !== 'undefined') ? _currentObjKey : (window._currentObjKey || null);
    if (!_ck) { if (typeof toast === 'function') toast('Bitte zuerst ein Objekt öffnen, das ueberfuehrt werden soll.'); return; }
    if (!K()) { if (typeof toast === 'function') toast('Rechenkern der Überführung nicht geladen — bitte Seite neu laden.'); return; }

    var corps = _corpMandanten();
    if (!corps.length) {
      if (typeof toast === 'function') toast('Keine Gesellschaft (GmbH/UG) angelegt. Bitte zuerst in den Einstellungen einen Mandanten anlegen.');
      return;
    }

    /* ── v1234 · Vorpruefung: schon ueberfuehrt? ──────────────────────────
       Gemessen am 04.09.2026: der Assistent hat ein GESELLSCHAFTS-Objekt ein
       zweites Mal ueberfuehrt (2026-1007 -> 2026-1008). Beide Faelle sind am
       Objekt ablesbar und werden mit Grund abgewiesen. */
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

    var _blob = (typeof collectData === 'function') ? collectData() : {};
    _ctx = {
      privatKey: _ck,
      privatBlob: _blob,
      privatImgs: (typeof imgs !== 'undefined' && imgs) ? imgs.slice() : [],
      privatAi: window._aiText || '',
      privatKuerzel: _blob.kuerzel || '',
      corps: corps,
      /* Momentaufnahme des Privat-Rechenstands — vor dem Einfrieren */
      serie: (window.State && Array.isArray(State._afaSeries)) ? State._afaSeries.slice() : [],
      cfRows: (window.State && Array.isArray(State.cfRows)) ? State.cfRows.map(function (r) { return { cal: r.cal, rs: r.rs }; }) : [],
      w: {}   /* Eingaben Schritt 2 */
    };
    _vorbelegen();
    _cur = 1;
    _render();
  }

  /* ── Vorbelegung: nur aus vorhandenen Angaben, nie erfunden ───────────── */
  function _vorbelegen() {
    var b = _ctx.privatBlob, w = _ctx.w;
    var vw = _num(b.svwert), vwQ = 'Verkehrswert (Reiter Objekt)';
    if (vw == null) { vw = _num(b.bankval); vwQ = 'Bankbewertung'; }
    if (vw == null) vwQ = '';
    w.vw = vw; w.vwQuelle = vwQ;
    w.art = 'kauf';
    w.kp = null; w.gbw = null;
    var gr = null;
    try { if (window.DealPilotGrest && DealPilotGrest.forPlz && b.plz) gr = DealPilotGrest.forPlz(b.plz); } catch (e) {}
    w.grestSatz = (gr && gr.rate != null) ? gr.rate : _num(b.gest_p);
    w.grestQuelle = (gr && gr.rate != null) ? (gr.name + ' (aus PLZ ' + b.plz + ')') : 'Satz des Privatobjekts — bitte prüfen';
    w.notarPct = 2.0;
    var brw = _num(b.brw), gsfl = _num(b.gsfl), mea = _num(b.mea);
    if (brw != null && brw > 0 && gsfl != null && gsfl > 0) {
      w.boden = brw * gsfl * ((mea != null && mea > 0) ? mea : 100) / 100;
      w.bodenQuelle = 'Bodenrichtwert ' + _pct(brw, 2) + ' €/m²' + (b.brw_stichtag ? ' (Stand ' + esc(b.brw_stichtag) + ')' : '') + ' × ' + _pct(gsfl, 2) + ' m²' + ((mea != null && mea > 0 && mea < 100) ? ' × MEA ' + _pct(mea, 2) + ' %' : '');
    } else { w.boden = null; w.bodenQuelle = ''; }
    w.zins = (b.d1z != null && String(b.d1z).trim() !== '') ? String(b.d1z).trim() : '';
    w.rs = null; w.rsQuelle = '';
    w.gd = null; w.gdZins = null; w.quote = 100;
    w.weitere23 = null;
  }

  /* Restschuld zum Stichtag aus der Projektion des Privatobjekts (Vorschlag). */
  function _rsVorschlag(stichtag) {
    var rows = _ctx.cfRows || [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(stichtag || '')) || !rows.length) return null;
    var y = +stichtag.slice(0, 4), m = +stichtag.slice(5, 7);
    var vor = null, akt = null;
    rows.forEach(function (r) { if (r.cal === y - 1) vor = r.rs; if (r.cal === y) akt = r.rs; });
    var b = _ctx.privatBlob;
    var start = (_num(b.d1) || 0) + (b.d2_enable ? (_num(b.d2) || 0) : 0);
    if (vor == null) vor = (rows[0] && rows[0].cal === y) ? start : null;
    if (vor == null) return null;
    if (akt == null || m === 1) return vor;
    return vor + (akt - vor) * (m - 1) / 12;
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

  /* v2984 · Hier stand „rechnet bis <Monat> (… + m/12)" — und genau so
     rechnete die App: privat m/12 plus Gesellschaft (13 − m)/12 = 13/12, ein
     Monat doppelt. Jetzt endet privat mit (m − 1)/12. */
  function _stichtagInfo(d) {
    var a = K().stichtagAnteile(d);
    if (!a) return '';
    var mon = ['','Januar','Februar','M&auml;rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    var t = (a.privatMonate > 0)
      ? 'Privat rechnet im Jahr ' + a.jahr + ' noch <b>' + a.privatMonate + '/12</b> (bis Ende ' + mon[a.monat - 1] + '), die Gesellschaft ab <b>' + mon[a.monat] + ' ' + a.jahr + '</b> mit ' + a.gesellschaftMonate + '/12.'
      : 'Das ganze Jahr ' + a.jahr + ' gehört der Gesellschaft (12/12), privat endet mit dem 31.12.' + (a.jahr - 1) + '.';
    if (!a.monatsErster) t += '<br><b>Hinweis:</b> DealPilot rechnet monatsgenau — der Stichtagsmonat gehört ganz der Gesellschaft. Tagesgenau wären es ' + a.privatTage + ' Tage privat. Üblich und empfohlen ist der Übergang von Nutzen und Lasten zum <b>Monatsersten</b>.';
    return t;
  }

  function _rf() {
    var id = _ctx._halterId || (_ctx.corps[0] && _ctx.corps[0].id);
    var m = _ctx.corps.filter(function (x) { return x.id === id; })[0];
    return m ? m.rechtsform : 'gmbh';
  }

  function _render() {
    var ov = _overlay();
    var c = _ctx;
    var titel = 'Objekt in ' + (_rf() === 'ug' ? 'UG' : 'GmbH') + ' &uuml;berf&uuml;hren';
    ov.innerHTML =
      '<div style="background:#FDFCFA;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);max-width:640px;width:100%;font-family:Inter,system-ui,sans-serif">' +
        '<div style="background:#0a0a0a;padding:15px 22px;display:flex;align-items:center;justify-content:space-between">' +
          '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:19px;font-weight:700;color:#fff">Deal<span style="color:var(--wl-e8cc7a,#E8CC7A)">Pilot</span></div>' +
          '<div style="display:flex;align-items:center;gap:12px">' +
          '<div style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:4px;color:var(--wl-c9a84c,#C9A84C);text-transform:uppercase">DealPilot</div>' +
          /* v2572: ohne ESC und mit 16 px Rand kam man auf dem Handy kaum heraus */
          '<button type="button" class="dpuew-x" aria-label="Schließen" onclick="DealPilotUeberfuehrung.close()" style="width:36px;height:36px;border:1px solid #2a2724;border-radius:8px;background:transparent;color:#F2EDE3;font-size:20px;line-height:1;cursor:pointer">×</button>' +
          '</div>' +
        '</div>' +
        '<div style="background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));padding:20px 22px">' +
          '<div style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:3px;text-transform:uppercase;color:#7a5e16;margin-bottom:8px">Boarding &middot; Privatbestand &rarr; Gesellschaft</div>' +
          '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:21px;color:#1b1408;font-weight:700">' + titel + '</div>' +
        '</div>' +
        '<div style="display:flex;padding:12px 22px;background:#FAF9F4;border-bottom:1px solid #EDE7DA;font-size:11px;gap:4px">' +
          _stepHtml(1,'Stichtag') + _stepHtml(2,'Gesellschaft &amp; Werte') + _stepHtml(3,'Ergebnis') +
        '</div>' +
        '<div style="padding:22px" id="dpuew-body">' + _paneHtml() + '</div>' +
        '<div style="display:flex;justify-content:space-between;gap:10px;padding:15px 22px;border-top:1px solid #EDE7DA;background:#FAF9F4">' +
          '<button id="dpuew-back" onclick="DealPilotUeberfuehrung._go(-1)" style="padding:9px 18px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #EDE7DA;background:#fff;color:#7A7370;font-family:inherit;visibility:' + (_cur===1?'hidden':'visible') + '">Zur&uuml;ck</button>' +
          '<button id="dpuew-next" onclick="DealPilotUeberfuehrung._go(1)" style="padding:9px 20px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#1b1408;font-family:inherit">' + (_cur===3?'&#9992; &Uuml;berf&uuml;hren':'Weiter &rarr;') + '</button>' +
        '</div>' +
      '</div>';
    _bind();
  }

  function _stepHtml(n, label) {
    var done = _cur > n, active = _cur === n;
    var bg = active ? 'linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C))' : (done ? '#3FA56C' : '#e6dfce');
    var col = (active||done) ? (done?'#fff':'#1b1408') : '#7A7370';
    return '<div style="flex:1;text-align:center;font-weight:600;color:' + (active?'var(--wl-b8932f,#b8932f)':'#7A7370') + '">' +
      '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';color:' + col + ';display:flex;align-items:center;justify-content:center;margin:0 auto 5px;font-weight:700">' + (done?'&#10003;':n) + '</div>' + label + '</div>';
  }

  var LAB = 'display:block;font-size:12px;font-weight:600;margin-bottom:5px';
  var INP = 'width:100%;padding:9px 11px;border:1px solid #EDE7DA;border-radius:9px;font-size:14px;font-family:inherit;background:#fff;box-sizing:border-box';
  var HINT = 'font-size:11px;color:#8a8378;margin-top:3px;line-height:1.4';
  function _feld(id, label, val, hint, extra) {
    return '<div id="' + id + '-f"' + (extra || '') + '><label style="' + LAB + '" for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(val == null ? '' : val) + '" inputmode="decimal" style="' + INP + '">' + (hint ? '<div style="' + HINT + '" id="' + id + '-h">' + hint + '</div>' : '') + '</div>';
  }

  function _paneHtml() {
    var c = _ctx, w = c.w;
    if (_cur === 1) {
      return '<h2 style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;margin:0 0 6px">Stichtag der &Uuml;berf&uuml;hrung</h2>' +
        '<p style="color:#7A7370;font-size:13px;margin:0 0 16px">Tag des &Uuml;bergangs von Nutzen und Lasten. Ab diesem Tag geh&ouml;ren Mieten, Kosten und Abschreibung der Gesellschaft.</p>' +
        '<div style="margin-bottom:13px"><label style="' + LAB + '">Stichtag &middot; Privat &rarr; Gesellschaft</label>' +
        '<input type="date" id="dpuew-stichtag" style="' + INP + '"></div>' +
        '<div id="dpuew-cut-info" style="background:rgba(184,98,80,.07);border:1px solid rgba(184,98,80,.25);border-radius:9px;padding:10px 12px;font-size:12.5px;color:#8a4a3c;line-height:1.5"></div>';
    }
    if (_cur === 2) {
      var corpOpts = c.corps.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === c._halterId ? ' selected' : '') + '>' + esc(m.name) + ' (' + (m.rechtsform === 'ug' ? 'UG' : 'GmbH') + ')</option>'; }).join('');
      var ug = _rf() === 'ug';
      var artOpts = Object.keys(K().ARTEN).map(function (k) {
        var dis = (k === 'sacheinlage' && ug);
        return '<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:4px 0;cursor:' + (dis ? 'not-allowed' : 'pointer') + ';opacity:' + (dis ? '.5' : '1') + '"><input type="radio" name="dpuew-art" value="' + k + '"' + (w.art === k ? ' checked' : '') + (dis ? ' disabled' : '') + ' style="margin-top:2px"> ' + esc(K().ARTEN[k].t) + (dis ? ' <span style="font-size:11px;color:#B8625C">— bei der UG unzulässig (§ 5a Abs. 2 S. 2 GmbHG)</span>' : '') + '</label>';
      }).join('');
      var mitPreis = (w.art === 'kauf' || w.art === 'teilentgeltlich');
      var g2 = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px';
      return '<h2 style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;margin:0 0 10px">Gesellschaft, Art und Werte</h2>' +
        '<div style="margin-bottom:12px"><label style="' + LAB + '">Gesellschaft</label><select id="dpuew-halter" style="' + INP + '">' + corpOpts + '</select></div>' +
        '<div style="margin-bottom:6px"><label style="' + LAB + '">Art der &Uuml;bertragung</label>' + artOpts + '</div>' +
        '<div style="' + g2 + '">' +
          _feld('dpuew-vw', 'Verkehrswert zum Stichtag (gemeiner Wert) €', _de0(w.vw), w.vwQuelle ? 'Vorschlag: ' + esc(w.vwQuelle) : '<b style="color:#B8625C">Bitte eintragen</b> (Gutachten, Marktbericht)') +
          (mitPreis ? _feld('dpuew-kp', 'Kaufpreis laut Vertrag €', _de0(w.kp), 'Gegenleistung inkl. übernommener Schulden — Bemessung der GrESt') : _feld('dpuew-gbw', 'Grundbesitzwert (BewG) €', _de0(w.gbw), 'stellt das Finanzamt fest (§ 8 Abs. 2 GrEStG, §§ 151, 157 ff. BewG). Leer = GrESt vorläufig auf den Verkehrswert')) +
        '</div>' +
        '<div style="' + g2 + '">' +
          _feld('dpuew-grest', 'GrESt-Satz %', _pct(w.grestSatz, 2), esc(w.grestQuelle || '')) +
          _feld('dpuew-notar', 'Notar + Grundbuch %', _pct(w.notarPct, 2), 'Vorschlag 2 %, kein Makler') +
        '</div>' +
        '<div style="' + g2 + '">' +
          _feld('dpuew-boden', 'Bodenwert zum Stichtag €', _de0(w.boden), w.bodenQuelle ? 'Vorschlag: ' + w.bodenQuelle : '<b style="color:#B8625C">Bitte eintragen</b> — sonst wird der Gebäudeanteil des Privatobjekts übernommen') +
          '<div></div>' +
        '</div>' +
        '<div style="' + g2 + '">' +
          _feld('dpuew-rs', 'Restschuld zum Stichtag €', _de0(w.rs), esc(w.rsQuelle || '')) +
          _feld('dpuew-zins', 'Zins des Darlehens % p.a.', w.zins, 'ungerundet, wie im Vertrag') +
        '</div>' +
        '<div style="' + g2 + '">' +
          _feld('dpuew-gd', 'Gesellschafterdarlehen € (optional)', _de0(w.gd), 'z. B. gestundeter Kaufpreisrest') +
          _feld('dpuew-gdz', 'Zins Gesellschafterdarlehen %', _pct(w.gdZins, 3), 'fremdüblich, sonst vGA') +
        '</div>' +
        '<div style="' + g2 + '">' +
          _feld('dpuew-quote', 'Deine Beteiligung %', _pct(w.quote, 2), 'für § 32d Abs. 2 EStG') +
          _feld('dpuew-w23', 'Weitere § 23-Gewinne im Jahr €', _de0(w.weitere23), 'für die Freigrenze von 1.000 €') +
        '</div>' +
        '<div id="dpuew-live" style="margin-top:14px"></div>';
    }
    return '<h2 style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;margin:0 0 6px">Ergebnis &amp; best&auml;tigen</h2>' +
      '<div id="dpuew-ergebnis">' + _ergebnisHtml(_rechne()) + '</div>';
  }

  /* ── Alles rechnen (nur Kern) ─────────────────────────────────────────── */
  function _rechne() {
    var c = _ctx, w = c.w, b = c.privatBlob, k = K();
    var r = { fehlt: [], warn: [] };
    var zul = k.artZulaessig(w.art, _rf());
    if (!zul.ok) r.fehlt.push(zul.grund);
    var objart = String(b.objart || '').toLowerCase();
    var p = {
      art: w.art, kaufpreis: w.kp, verkehrswert: w.vw, grundbesitzwert: w.gbw,
      satzPct: w.grestSatz, notarPct: w.notarPct, bodenwert: w.boden,
      bodenQuelle: w.boden != null ? 'stichtag' : null,
      gebAntPct: _num(b.geb_ant), baujahr: _num(b.baujahr),
      wohnzwecke: !/gewerb|buero|büro|laden|praxis|lager|halle/.test(objart),
      stichtag: c._stichtag
    };
    r.ak = k.akGesellschaft(p);
    if (!r.ak.ok) r.fehlt = r.fehlt.concat(r.ak.fehlt || []);
    /* § 23 */
    var kp0 = _num(b.kp) || 0;
    var nkPct = ['makler_p', 'notar_p', 'gba_p', 'gest_p', 'ji_p'].reduce(function (s, f) { return s + (_num(b[f]) || 0); }, 0);
    var akPriv = kp0 > 0 ? kp0 * (1 + nkPct / 100) : null;
    var afaStart = b.wirtschaftlicher_uebergang || b.kaufdat;
    var afaBis = k.afaBisStichtag({ serie: c.serie, kaufdat: afaStart, stichtag: c._stichtag });
    r.p23 = k.paragraph23({ art: w.art, kaufpreis: w.kp, verkehrswert: w.vw, kaufdat: b.kaufdat, stichtag: c._stichtag,
                            akPrivat: akPriv, afaBisher: afaBis, weitereGewinne: w.weitere23 });
    if (r.p23.gewinn != null && r.p23.steuerpflichtig) {
      var jahr = +String(c._stichtag).slice(0, 4), zv = null, last = null;
      try { var zi = window._dpZveFuerJahr && window._dpZveFuerJahr(jahr); if (zi && zi.quelle !== 'ersatz' && zi.zve > 0) zv = zi.zve; } catch (e) {}
      try { if (window.Tax && typeof Tax.steuerLast === 'function') last = function (z) { return Tax.steuerLast(z, jahr).gesamt; }; } catch (e) {}
      r.st23 = k.steuer23(r.p23.gewinn, { zve: zv, steuerLast: last, grenzPct: _num(b.grenz) });
    }
    if ((_num(b.san) || 0) > 0) r.warn.push('Sanierungskosten des Privatobjekts (' + _eur(_num(b.san)) + ') sind im § 23-Gewinn nicht berücksichtigt (anschaffungsnahe Herstellungskosten erhöhen die AK, mindern sich aber um ihre AfA) und werden <b>nicht</b> ins Gesellschaftsobjekt übernommen.');
    if ((_num(b.makler_p) || 0) > 0) r.warn.push('Der private Makler (' + _pct(_num(b.makler_p), 2) + ' %) zählt zu den privaten AK, nicht zu denen der Gesellschaft.');
    if (b.afa_sonder7b_aktiv === true || /deg/.test(String(b.afa_satz || ''))) r.warn.push('Privat war degressive AfA oder § 7b gewählt. Für die Gesellschaft ausgeschlossen (§ 7 Abs. 5a, § 7b EStG: Anschaffung nur bis Ende des Fertigstellungsjahres) — sie schreibt linear ab.');
    if (r.ak.ok && r.ak.wert.vga > 0) r.warn.push('Der Kaufpreis liegt ' + _eur(r.ak.wert.vga) + ' über dem Verkehrswert: der Mehrbetrag ist eine <b>verdeckte Gewinnausschüttung</b> (§ 8 Abs. 3 S. 2 KStG) und beim Gesellschafter Kapitalertrag.');
    if (w.art === 'kauf' && r.ak.ok && r.ak.wert.verdeckteEinlage > 0) r.warn.push('Der Kaufpreis liegt unter dem Verkehrswert — das ist ein <b>teilentgeltlicher</b> Kauf: die Differenz (' + _eur(r.ak.wert.verdeckteEinlage) + ') ist verdeckte Einlage. Für § 23 zählt dann der gemeine Wert. Bitte „Teilentgeltlich“ wählen.');
    if (w.art === 'teilentgeltlich') r.warn.push('GrESt: gerechnet auf den vereinbarten Preis (Gegenleistung, § 8 Abs. 1 GrEStG; BFH II R 28/15 für Verträge zwischen Gesellschaft und Gesellschafter). Das Finanzamt kann bei einem deutlich zu niedrigen Preis den Grundbesitzwert ansetzen — verbindliche Auskunft empfohlen.');
    if (r.ak.ok && r.ak.bodenQuelle === 'uebernommen') r.warn.push('Kein Bodenwert zum Stichtag: der Gebäudeanteil des Privatobjekts (' + _pct(_num(b.geb_ant), 1) + ' %) wird übernommen. <b>Bitte ergänzen</b> — die Aufteilung gilt zum Erwerb durch die Gesellschaft.');
    if (r.ak.ok && r.ak.gebAntPct == null) r.fehlt.push('Bodenwert oder Gebäudeanteil');
    if (r.ak.ok && !r.ak.afaSicher) r.warn.push(r.ak.afaGrund);
    if (w.rs == null) r.warn.push('Restschuld zum Stichtag fehlt — die Gesellschaft rechnet dann ohne Bankdarlehen. Bitte mit dem Kontoauszug abgleichen.');
    if (w.zins === '' && w.rs > 0) r.fehlt.push('Zins des Darlehens');
    r.gd = k.gesellschafterdarlehen({ betrag: w.gd, zinsPct: w.gdZins, beteiligungPct: w.quote });
    if (_rf() === 'ug') r.warn.push('UG: 25 % des Jahresüberschusses (nach Verlustvortrag) gehen in die gesetzliche Rücklage, bis das Stammkapital auf 25.000 € erhöht ist (§ 5a Abs. 3 GmbHG).');
    r.warn.push('Die Bank muss der Übernahme des Darlehens zustimmen (§§ 414, 415 BGB). Prüfe außerdem die Drei-Objekt-Grenze (gewerblicher Grundstückshandel — die Übertragung zählt als Veräußerung) und bei Mitgesellschaftern die Schenkungsteuer (§ 7 Abs. 8 ErbStG).');
    return r;
  }

  function _zeile(l, v, stark) { return '<tr><td style="padding:4px 8px 4px 0;color:#5f594f">' + l + '</td><td style="padding:4px 0;text-align:right;white-space:nowrap' + (stark ? ';font-weight:700' : '') + '">' + v + '</td></tr>'; }
  function _ergebnisHtml(r) {
    var c = _ctx, w = c.w, h = '';
    var T = 'width:100%;border-collapse:collapse;font-size:12.5px;margin:4px 0 12px';
    var H = 'font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:1px;text-transform:uppercase;color:#8a8378;margin:12px 0 4px';
    if (r.fehlt.length) h += '<div style="padding:10px 12px;border:1px solid rgba(184,98,80,.4);background:rgba(184,98,80,.06);border-radius:9px;font-size:12.5px;color:#8a4a3c;margin-bottom:10px"><b>Es fehlt:</b> ' + r.fehlt.map(esc).join(' · ') + '</div>';
    if (r.ak.ok) {
      var a = r.ak, g = a.grest;
      h += '<div style="' + H + '">Gesellschaft &middot; Anschaffungskosten</div><table style="' + T + '">' +
        _zeile('Ansatz (' + (w.art === 'kauf' ? 'Kaufpreis' : 'Teilwert = Verkehrswert') + ')', _eur(a.wert.ansatz)) +
        (a.wert.verdeckteEinlage > 0 ? _zeile('davon verdeckte Einlage (Kapitalrücklage, § 27 KStG)', _eur(a.wert.verdeckteEinlage)) : '') +
        (a.wert.sacheinlage > 0 ? _zeile('davon Sacheinlage gegen Anteile', _eur(a.wert.sacheinlage)) : '') +
        _zeile('Grunderwerbsteuer ' + _pct(g.satzPct, 2) + ' % auf ' + _eur(g.basis) + ' (' + (g.quelle === 'gegenleistung' ? 'Gegenleistung, § 8 Abs. 1 GrEStG' : g.quelle === 'grundbesitzwert' ? 'Grundbesitzwert, § 8 Abs. 2 GrEStG' : '<b style="color:#B8625C">vorläufig auf den Verkehrswert</b> — Grundbesitzwert stellt das Finanzamt fest') + ')', _eur(g.betrag)) +
        _zeile('Notar + Grundbuch ' + _pct(a.notarPct, 2) + ' %', _eur(a.notar)) +
        _zeile('Anschaffungskosten der Gesellschaft', _eur(a.ak), true) +
        _zeile('Gebäudeanteil ' + _pct(a.gebAntPct, 1) + ' %' + (a.bodenQuelle === 'uebernommen' ? ' <b style="color:#B8625C">(übernommen)</b>' : ' (Bodenwert zum Stichtag)'), _eur(a.gebaeudeAK)) +
        _zeile('AfA ' + _pct(a.afaSatzPct, 1) + ' % linear (' + esc(a.afaGrund) + ')', _eur(a.afaJahr) + ' / Jahr') +
        _zeile('15-%-Grenze anschaffungsnahe HK (§ 6 Abs. 1 Nr. 1a) bis ' + _datDe(a.grenze15Bis), _eur(a.grenze15)) +
        '</table>';
    }
    var p = r.p23 || {};
    h += '<div style="' + H + '">Privat &middot; § 23 EStG</div>';
    if (p.steuerfrei) h += '<div style="font-size:12.5px;color:#3FA56C;margin-bottom:10px"><b>Steuerfrei</b> — Zehnjahresfrist abgelaufen (' + esc(p.frist.text) + ').</div>';
    else if (p.fehlt) h += '<div style="font-size:12.5px;color:#B8625C;margin-bottom:10px">Nicht berechenbar: ' + esc(p.fehlt.join(', ')) + '.</div>';
    else {
      h += '<table style="' + T + '">' +
        _zeile('Zehnjahresfrist läuft (' + esc(p.frist.text) + ', noch ' + p.frist.restTage + ' Tage)', '<span style="color:#B8625C">steuerbar</span>') +
        _zeile('Veräußerungspreis (' + esc(p.preisQuelle) + ')', _eur(p.veraeusserungspreis)) +
        _zeile('− Anschaffungskosten privat inkl. Nebenkosten', _eur(p.akPrivat)) +
        _zeile('+ abgezogene AfA bis Stichtag (§ 23 Abs. 3 S. 4)', _eur(p.afaBisher)) +
        _zeile('Veräußerungsgewinn', _eur(p.gewinn), true) +
        (p.unterFreigrenze ? _zeile('Gesamtgewinn im Jahr unter 1.000 € (Freigrenze § 23 Abs. 3 S. 5)', '<span style="color:#3FA56C">steuerfrei</span>') : '') +
        (r.st23 ? _zeile('Indikative Einkommensteuer (' + esc(r.st23.methode) + ')', r.st23.betrag != null ? _eur(r.st23.betrag) : '<b style="color:#B8625C">Grenzsteuersatz fehlt</b>', true) : '') +
        '</table>';
    }
    if (r.gd && w.gd > 0) h += '<div style="font-size:12px;color:#5f594f;margin-bottom:8px">Gesellschafterdarlehen ' + _eur(w.gd) + ' × ' + _pct(w.gdZins, 3) + ' % = Zins ' + _eur(r.gd.zins) + '/Jahr — Betriebsausgabe der Gesellschaft; bei dir: ' + esc(r.gd.regel) + '.</div>';
    if (r.warn.length) h += '<div style="' + H + '">Hinweise</div><ul style="margin:0 0 6px 16px;padding:0;font-size:12px;line-height:1.5;color:#5f594f">' + r.warn.map(function (x) { return '<li style="margin:3px 0">' + x + '</li>'; }).join('') + '</ul>';
    h += '<div style="font-size:11.5px;color:#8a8378;margin-top:8px">Verbindliche Auskunft (§ 89 Abs. 2 AO) vor dem Notartermin ist der sichere Weg. DealPilot rechnet, es berät nicht.</div>';
    return h;
  }

  function _lesen() {
    var w = _ctx.w, g = function (id) { var e = document.getElementById(id); return e ? e.value : null; };
    var h = document.getElementById('dpuew-halter');
    if (h) { _ctx._halterId = h.value; _ctx._halterName = h.options[h.selectedIndex] ? h.options[h.selectedIndex].text : ''; }
    var a = document.querySelector('input[name="dpuew-art"]:checked'); if (a) w.art = a.value;
    if (g('dpuew-vw') != null) w.vw = _num(g('dpuew-vw'));
    if (g('dpuew-kp') != null) w.kp = _num(g('dpuew-kp'));
    if (g('dpuew-gbw') != null) w.gbw = _num(g('dpuew-gbw'));
    if (g('dpuew-grest') != null) w.grestSatz = _num(g('dpuew-grest'));
    if (g('dpuew-notar') != null) w.notarPct = _num(g('dpuew-notar'));
    if (g('dpuew-boden') != null) w.boden = _num(g('dpuew-boden'));
    if (g('dpuew-rs') != null) w.rs = _num(g('dpuew-rs'));
    if (g('dpuew-zins') != null) w.zins = String(g('dpuew-zins') || '').trim();
    if (g('dpuew-gd') != null) w.gd = _num(g('dpuew-gd'));
    if (g('dpuew-gdz') != null) w.gdZins = _num(g('dpuew-gdz'));
    if (g('dpuew-quote') != null) w.quote = _num(g('dpuew-quote'));
    if (g('dpuew-w23') != null) w.weitere23 = _num(g('dpuew-w23'));
    if (w.art === 'sacheinlage' && _rf() === 'ug') w.art = 'verdeckt';
  }

  function _live() {
    var el = document.getElementById('dpuew-live'); if (!el) return;
    _lesen();
    el.innerHTML = _ergebnisHtml(_rechne());
  }

  function _bind() {
    if (_cur === 1) {
      var d = document.getElementById('dpuew-stichtag');
      if (d) {
        if (_ctx._stichtag) d.value = _ctx._stichtag;
        var upd = function () { _ctx._stichtag = d.value; var info = document.getElementById('dpuew-cut-info'); if (info) info.innerHTML = _stichtagInfo(d.value) || '<span style="color:#7A7370">Bitte Stichtag w&auml;hlen.</span>'; };
        d.addEventListener('change', upd); upd();
      }
    }
    if (_cur === 2) {
      var body = document.getElementById('dpuew-body');
      if (body) {
        body.addEventListener('input', _live);
        body.addEventListener('change', function (e) {
          var t = e.target;
          if (t && (t.name === 'dpuew-art' || t.id === 'dpuew-halter')) { _lesen(); _render(); return; }
          _live();
        });
      }
      _live();
    }
  }

  function _collectStep() {
    if (_cur === 1) {
      var d = document.getElementById('dpuew-stichtag');
      if (!d || !d.value) { if (typeof toast === 'function') toast('Bitte einen Stichtag wählen.'); return false; }
      _ctx._stichtag = d.value;
      if (_ctx.w.rs == null) { var v = _rsVorschlag(d.value); if (v != null) { _ctx.w.rs = v; _ctx.w.rsQuelle = 'Vorschlag aus der Finanzierung des Privatobjekts — bitte mit dem Kontoauszug abgleichen'; } }
      if (!_ctx._halterId && _ctx.corps[0]) { _ctx._halterId = _ctx.corps[0].id; _ctx._halterName = _ctx.corps[0].name; }
    }
    if (_cur === 2) {
      _lesen();
      if (!_ctx._halterId) { if (typeof toast === 'function') toast('Bitte eine Gesellschaft wählen.'); return false; }
    }
    if (_cur === 3) {
      var r = _rechne();
      if (r.fehlt.length) { if (typeof toast === 'function') toast('Es fehlt: ' + r.fehlt.join(' · ')); return false; }
      _ctx._erg = r;
    }
    return true;
  }

  function _go(dir) {
    if (dir === 1 && !_collectStep()) return;
    if (dir === 1 && _cur === 3) { _execute(); return; }
    if (dir === -1 && _cur === 2) _lesen();
    _cur = Math.max(1, Math.min(3, _cur + dir));
    _render();
  }

  /* Ergebnis fuer das Feld ueberf_daten (JSON). */
  function _daten(r, fuer) {
    var c = _ctx, w = c.w, a = r.ak, p = r.p23 || {};
    var o = { v: 2984, fuer: fuer, art: w.art, stichtag: c._stichtag, rechtsform: _rf(),
      vw: w.vw, kaufpreis: w.kp, grundbesitzwert: w.gbw };
    if (fuer === 'gesellschaft') {
      o.ak = { ansatz: a.wert.ansatz, verdeckteEinlage: a.wert.verdeckteEinlage, sacheinlage: a.wert.sacheinlage, vga: a.wert.vga,
        grest: a.grest.betrag, grestBasis: a.grest.basis, grestQuelle: a.grest.quelle, grestVorlaeufig: a.grest.vorlaeufig, grestSatzPct: a.grest.satzPct,
        notar: a.notar, notarPct: a.notarPct, ak: a.ak, gebAntPct: a.gebAntPct, bodenQuelle: a.bodenQuelle,
        afaSatzPct: a.afaSatzPct, grenze15Bis: a.grenze15Bis };
      o.gd = { betrag: w.gd, zinsPct: w.gdZins, beteiligungPct: w.quote };
    } else {
      o.p23 = { steuerfrei: !!p.steuerfrei, fehlt: p.fehlt || null, fristText: p.frist ? p.frist.text : '',
        veraeusserungspreis: p.veraeusserungspreis, preisQuelle: p.preisQuelle, akPrivat: p.akPrivat, afaBisher: p.afaBisher,
        fortgefuehrteAK: p.fortgefuehrteAK, gewinn: p.gewinn, unterFreigrenze: !!p.unterFreigrenze,
        steuer: r.st23 ? r.st23.betrag : (p.steuerfrei || p.unterFreigrenze ? 0 : null), steuerMethode: r.st23 ? r.st23.methode : '' };
    }
    return JSON.stringify(o);
  }

  /* ====== Die getestete Anlege-Sequenz ====== */
  /* v816b-guard: synchrones Lauf-Flag GANZ oben (vor jedem await), damit Doppelklick nicht
     zweimal die Sequenz startet. _running wird im finally zurueckgesetzt. */
  var _running = false;
  async function _execute() {
    if (_running) return;
    _running = true;
    var nx = document.getElementById('dpuew-next');
    if (nx) { nx.disabled = true; nx.textContent = 'Wird ausgeführt…'; }
    /* v816b: saveEmptyCard + Auto-Save unterdruecken, solange der Wizard eigene Saves macht. */
    window._dpEmptyCardSaving = true;
    window._dpUeberfActive = true;
    try {
      var c = _ctx, w = c.w, r = c._erg || _rechne(), a = r.ak;
      var _privatKey = c.privatKey;
      var _datPriv = _daten(r, 'privat');
      /* 1) Privat einfrieren — ueberf_ende + § 23-Ergebnis */
      var _ueEl = document.getElementById('ueberf_ende');
      if (_ueEl) _ueEl.value = c._stichtag;
      var _udEl = document.getElementById('ueberf_daten'); if (_udEl) _udEl.value = _datPriv;
      var _linkEl = document.getElementById('_ueberf_link'); if (_linkEl) _linkEl.value = '';
      if (typeof saveObj === 'function') await saveObj({ silent: true });

      /* 2) Gesellschaftsobjekt — eigene Anschaffungskosten statt Kopie der privaten */
      var _g = JSON.parse(JSON.stringify(c.privatBlob));
      var dez = function (n, d) { return (n == null || !isFinite(n)) ? '' : String(Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).replace('.', ','); };
      _g.halter = c._halterId;
      _g.obj_herkunft = 'ueberfuehrung';
      _g.verkehrswert_ueberf = _de0(w.vw);
      _g.ueberf_preis = (w.art === 'kauf' || w.art === 'teilentgeltlich') ? _de0(w.kp) : '0';
      _g.halter_seit = c._stichtag;
      _g.kaufdat = c._stichtag; _g.wirtschaftlicher_uebergang = c._stichtag;   /* v816g */
      /* Kaufpreis der Gesellschaft = Ansatz (Teilwert/VW), Nebenkosten neu */
      _g.kp = _de0(a.wert.ansatz);
      _g.makler_p = '0'; _g.ji_p = '0';
      _g.gest_p = dez(a.grestSatzEffektivPct, 4);          /* ergibt kp × Satz = GrESt der Ueberfuehrung */
      _g.gba_p = dez(Math.min(0.5, a.notarPct), 2);
      _g.notar_p = dez(Math.max(0, a.notarPct - 0.5), 2);
      if (a.gebAntPct != null) _g.geb_ant = dez(a.gebAntPct, 1);
      _g.afa_satz = a.afaSatzPct.toFixed(1);
      _g.afa_sonder7b_aktiv = false;
      /* Sanierung bleibt beim Privatobjekt (dort abgezogen); 15-%-Grenze beginnt neu */
      _g.san = '0'; _g.san_tax_active = false;
      /* Finanzierung: ein Darlehen in Hoehe der Restschuld, Rate bleibt */
      var rsN = w.rs;
      if (rsN != null && rsN > 0) {
        var d1a = _num(c.privatBlob.d1) || 0, z0 = _num(c.privatBlob.d1z) || 0, t0 = _num(c.privatBlob.d1t) || 0, zN = _num(w.zins);
        _g.d1 = _de0(rsN);
        _g.d1z = w.zins;
        if (d1a > 0 && zN != null && (z0 + t0) > 0) { var tN = d1a * (z0 + t0) / rsN - zN; if (isFinite(tN) && tN > 0) _g.d1t = dez(tN, 3); }
        var _sm = c._stichtag.slice(5, 7) + '.' + c._stichtag.slice(0, 4);
        _g.d1_auszahl = _sm;
      } else { _g.d1 = '0'; }
      _g.d2 = '0'; _g.d2_enable = false;
      _g.ueberf_restschuld = rsN != null ? _de0(rsN) : '';
      _g.ueberf_rest_zins = w.zins;                         /* v2984: ungerundet (war toFixed(1)) */
      _g.gesellschafterdarlehen = w.gd != null ? _de0(w.gd) : '';
      /* v2984 · ueberf_ende NICHT erben — beim Gesellschaftsobjekt ist der Stichtag der Beginn */
      _g.ueberf_ende = '';
      _g.ueberf_daten = _daten(r, 'gesellschaft');
      var _erwAktiv = false;
      try { var _sp = DealPilotMandanten.steuerParameter && DealPilotMandanten.steuerParameter(c._halterId); _erwAktiv = !!(_sp && _sp.erwKuerzung); } catch (e) {}
      _g.kuerzel = (c.privatKuerzel ? c.privatKuerzel + (_erwAktiv ? ' VV' : (_rf() === 'ug' ? ' UG' : ' GmbH')) : '');
      _g._ueberf_link = _privatKey;
      if (typeof newObj === 'function') newObj();
      if (typeof loadData === 'function') loadData(_g);
      if (typeof imgs !== 'undefined') { imgs = c.privatImgs.slice(); if (typeof renderImgs === 'function') renderImgs(); }
      window._aiText = c.privatAi;
      if (typeof saveObj === 'function') await saveObj({ silent: true });
      var _gmbhKey = (typeof _currentObjKey !== 'undefined') ? _currentObjKey : window._currentObjKey;

      /* 3) Rueck-Link am Privat-Objekt (per API-Patch, non-fatal).
         v1236: nie auf sich selbst. v2984: ueberf_ende und ueberf_daten werden
         MITgeschrieben — liest der GET noch den Stand vor dem Speichern aus
         Schritt 1, haette der PUT das Ende sonst wieder entfernt. */
      try {
        var _linkOk = _gmbhKey && _privatKey && String(_gmbhKey) !== String(_privatKey);
        if (window.Auth && Auth.apiCall && _linkOk) {
          var _pObj = await Auth.apiCall('/objects/' + _privatKey);
          var _pData = (_pObj && _pObj.data) || null;
          if (_pData && typeof _pData === 'object' && Object.keys(_pData).length > 3) {
            _pData._ueberf_link = _gmbhKey;
            _pData.ueberf_ende = c._stichtag;
            _pData.ueberf_daten = _datPriv;
            await Auth.apiCall('/objects/' + _privatKey, { method: 'PUT', body: { data: _pData, aiAnalysis: _pObj.ai_analysis || null, photos: _pObj.photos || [] } });
          } else { try { console.warn('[v2984] Rueck-Link nicht gesetzt: Privatdaten leer'); } catch (e) {} }
        } else if (!_linkOk) {
          try { console.warn('[v1236] Rueck-Link nicht gesetzt: _gmbhKey=' + _gmbhKey + ' _privatKey=' + _privatKey); } catch (e) {}
        }
      } catch (e) { /* Rueck-Link non-fatal */ }

      close();
      if (typeof toast === 'function') toast('✓ Überführt — Gesellschaftsobjekt angelegt, Privatobjekt eingefroren.');
      if (typeof renderSaved === 'function') renderSaved({ _immediate: true });
      if (typeof calc === 'function') calc();
      if (typeof updateSidebarPortfolio === 'function') updateSidebarPortfolio();
    } catch (err) {
      if (typeof toast === 'function') toast('Fehler bei der Überführung: ' + (err && err.message || err));
      var nx2 = document.getElementById('dpuew-next'); if (nx2) { nx2.disabled = false; nx2.innerHTML = '&#9992; &Uuml;berf&uuml;hren'; }
    } finally {
      window._dpEmptyCardSaving = false;
      window._dpUeberfActive = false;
      _running = false;
    }
  }

  window.DealPilotUeberfuehrung = { open: open, close: close, _go: _go,
    /* fuer tools/ueberfuehrung-pruefen.mjs */ _num: _num };
})();
