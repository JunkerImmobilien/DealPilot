/* ════════════════════════════════════════════════════════════════════
   MFH-KONFIGURATOR — EINHEITEN, IST/SOLL, ZUSTAND JE EINHEIT
   ════════════════════════════════════════════════════════════════════
   Backlog v22 Punkt 6, design/Vorschlaege/mfh-ist-soll-konfigurator.md.

   v1448 Stufe 1: Einheitenliste, Summen ins Objekt (Flaeche, Einheiten,
                  Ist-Kaltmiete der vermieteten Einheiten).
   v1451 Stufe 2: Massnahme + Kosten je Einheit (Summe nur auf Haken in die
                  Sanierung), Kennzahlen Ist gegen Soll im Ergebnis.
   v1454 Stufe 3: VIER SCHRITTE und Bewertung je Einheit nach den Kriterien
                  des Restnutzungsdauergutachtens (Anlage 2 ImmoWertV).
                  Marcel 20.09.2026: „nach den Kriterien vom
                  Restnutzungsdauergutachten … ausser das, was man vom
                  Haupthaus erbt, also Dach oder Heizung".

   Schritt 1 Gebaeude   die vier gemeinsamen Gewerke (Dach, Aussenwand,
                        Leitungen, Heizung) und die Vorgabe fuer die vier
                        wohnungsbezogenen — sie gilt fuer JEDE Einheit,
                        bis eine Einheit widerspricht (Vererbung).
   Schritt 2 Einheiten  die Liste wie bisher.
   Schritt 3 Zustand    je Einheit Fenster, Baeder, Innenausbau, Grundriss;
                        Vorgabe ist „wie Gebaeude".
   Schritt 4 Ergebnis   Punkte und Restnutzungsdauer je Einheit, flaechen-
                        gewichtet aufs Gebaeude, Uebernahme ins Objekt.

   KEIN eigener Rechenkern: Punkte und RND kommen aus DealPilotRND
   (rnd-calc.js, calcAll) und der GND-Tabelle (rnd-gnd-table.js) — dieselben
   Zahlen wie im RND-Assistenten.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ARTEN_MIT_EINHEITEN = { MFH: 1, ZFH: 1, GESCH: 1, BUERO: 1, HOTEL: 1 };
  var ZUSTAND = [['', '–'], ['5', 'neuwertig'], ['4', 'modernisiert'], ['3', 'gepflegt'], ['2', 'renovierungsbed.'], ['1', 'sanierungsbed.']];
  /* Anlage 2 ImmoWertV, aufgeteilt nach dem, was am Gebaeude haengt, und dem,
     was in der einzelnen Wohnung steckt. Punkte je Gewerk aus DealPilotRND. */
  var GEB_IDS = ['dach', 'aussenwand', 'leitungen', 'heizung'];
  var WE_IDS = ['fenster', 'baeder', 'innenausbau', 'grundriss'];
  var STUFEN = [['0', 'nicht modernisiert'], ['h', 'teilweise erneuert'], ['v', 'erneuert / modern']];
  var SCHRITTE = ['Gebäude', 'Einheiten', 'Zustand je Einheit', 'Ergebnis'];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(v) { if (v == null || String(v).trim() === '') return 0; var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function daten() { var d = window._dpMfh; if (!d || !Array.isArray(d.einheiten)) return { einheiten: [], gebaeude: {} }; if (!d.gebaeude) d.gebaeude = {}; return d; }

  /* ── Anlage-2-Punkte ─────────────────────────────────────────────── */
  function modListe() { return (window.DealPilotRND && window.DealPilotRND.MOD_ELEMENTS) || []; }
  function maxPunkte(id) { var e = modListe().filter(function (x) { return x.id === id; })[0]; return e ? e.max : 2; }
  function labelVon(id) { var e = modListe().filter(function (x) { return x.id === id; })[0]; return e ? e.label : id; }
  function punkteVon(id, stufe) { var m = maxPunkte(id); return stufe === 'v' ? m : (stufe === 'h' ? Math.ceil(m / 2) : 0); }
  /* Punkte einer Einheit = gemeinsame Gewerke (geerbt) + eigene Gewerke.
     Wo die Einheit nichts sagt, gilt die Vorgabe des Gebaeudes. */
  function punkteEinheit(e, geb) {
    var p = 0, geerbt = 0;
    GEB_IDS.forEach(function (id) { p += punkteVon(id, geb[id] || '0'); });
    WE_IDS.forEach(function (id) {
      var eigen = (e.mod && e.mod[id]) || '';
      if (!eigen) geerbt++;
      p += punkteVon(id, eigen || geb[id] || '0');
    });
    return { punkte: Math.min(20, p), geerbt: geerbt };
  }
  function gnd() {
    var d = daten();
    if (d.gnd) return zahl(d.gnd);
    var T = window.DealPilotRND_GND;
    var art = (el('objart') && el('objart').value) || 'MFH';
    var k = (art === 'GESCH' || art === 'BUERO') ? 'geschaeft' : 'mfh';
    try { return (T && typeof T.getDefault === 'function' ? T.getDefault(k) : 80) || 80; } catch (x) { return 80; }
  }
  function rndFuer(punkte) {
    var bj = zahl(el('baujahr') && el('baujahr').value);
    if (!bj || !window.DealPilotRND || !window.DealPilotRND.calcAll) return null;
    try {
      var r = window.DealPilotRND.calcAll({ baujahr: bj, stichtag: new Date().toISOString().slice(0, 10), gnd: gnd(), modPoints: punkte });
      return (r && r.methods && r.methods.punktraster) ? r.methods.punktraster.restnutzungsdauer : (r ? r.final_rnd : null);
    } catch (x) { return null; }
  }

  function summe(list) {
    var s = { anzahl: list.length, wohnen: 0, flaeche: 0, flaecheGew: 0, ist: 0, soll: 0, leer: 0, leerFl: 0, kosten: 0, hatSoll: false };
    list.forEach(function (e) {
      var fl = zahl(e.wfl);
      s.flaeche += fl;
      if (e.art === 'gewerbe') s.flaecheGew += fl; else s.wohnen++;
      if (e.status === 'leer') { s.leer++; s.leerFl += fl; } else s.ist += zahl(e.ist);
      s.soll += zahl(e.soll) || zahl(e.ist);
      if (zahl(e.soll) > 0) s.hatSoll = true;
      s.kosten += zahl(e.kosten);
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
    el('mfh-oeffnen').onclick = function () { oeffnen(0); };
  }

  /* ── Modal mit vier Schritten ───────────────────────────────────── */
  var _arbeit = [], _geb = {}, _schritt = 0;

  function selHtml(attrs, wert, opts) {
    return '<select ' + attrs + ' style="padding:6px;border:1px solid #E6E0D3;border-radius:6px;font:13px Inter,sans-serif;max-width:100%">'
      + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(wert || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  }

  /* Schritt 1 — Gebaeude */
  function schritt1() {
    function zeile(id, fuerWohnung) {
      return '<tr><td style="padding:5px 10px 5px 0">' + esc(labelVon(id)) + '<div style="font-size:11px;color:#8A8272">max ' + maxPunkte(id) + ' P.'
        + (fuerWohnung ? ' · gilt für jede Einheit, bis sie widerspricht' : ' · gilt für das ganze Haus') + '</div></td>'
        + '<td style="padding:5px 0;text-align:right">' + selHtml('data-geb="' + id + '"', _geb[id], STUFEN) + '</td></tr>';
    }
    var bj = (el('baujahr') && el('baujahr').value) || '—';
    return '<div style="font-size:12.5px;color:#6B6356;margin-bottom:10px">Baujahr ' + esc(bj) + ' · Gesamtnutzungsdauer ' + gnd() + ' Jahre. '
      + 'Die Kriterien sind die der Anlage 2 ImmoWertV — dieselben wie im Restnutzungsdauer-Assistenten.</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>'
      + '<tr><td colspan="2" style="padding:8px 0 4px;font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A8272">Gemeinsam — vom Haus geerbt</td></tr>'
      + GEB_IDS.map(function (id) { return zeile(id, false); }).join('')
      + '<tr><td colspan="2" style="padding:12px 0 4px;font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A8272">Vorgabe für die Wohnungen</td></tr>'
      + WE_IDS.map(function (id) { return zeile(id, true); }).join('')
      + '</tbody></table>'
      + '<div class="cf-hint" style="margin-top:8px">Gebäudepunkte: <b id="mfh-geb-p">—</b> von 20 (Anlage 2). Dach, Außenwand, Leitungen und Heizung kann eine einzelne Wohnung nicht abweichend haben.</div>';
  }

  /* Schritt 2 — Einheitenliste */
  function zeileHtml(e, i) {
    function inp(k, w, ph, typ) { return '<input data-i="' + i + '" data-k="' + k + '" value="' + esc(e[k] || '') + '" placeholder="' + (ph || '') + '" inputmode="' + (typ || 'text') + '" style="width:' + w + 'px;padding:6px 7px;border:1px solid #E6E0D3;border-radius:6px;font:13px Inter,sans-serif">'; }
    function sel(k, opts) { return selHtml('data-i="' + i + '" data-k="' + k + '"', e[k], opts); }
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
  function schritt2() {
    return '<div style="font-size:12.5px;color:#6B6356;margin-bottom:10px">Ähnliche Wohnungen mit ⧉ duplizieren. Übernommen werden Fläche, Einheitenzahl und Ist-Kaltmiete der vermieteten Einheiten.</div>'
      + '<div style="overflow:auto"><table style="border-collapse:collapse;font-size:12px;min-width:1080px"><thead><tr style="text-align:left;color:#8A8272">'
      + '<th>Nr.</th><th>Lage</th><th>Art</th><th>m²</th><th>Zi.</th><th>Ist-Miete</th><th>Soll-Miete</th><th>Status</th><th>Qualität</th><th>Maßnahme</th><th>Kosten</th><th></th></tr></thead>'
      + '<tbody id="mfh-zeilen">' + _arbeit.map(zeileHtml).join('') + '</tbody></table></div>'
      + '<div style="margin-top:8px"><button type="button" id="mfh-neu" class="btn btn-outline btn-sm">+ Einheit</button></div>';
  }

  /* Schritt 3 — Zustand je Einheit (Vererbung) */
  function schritt3() {
    if (!_arbeit.length) return '<div class="cf-hint">Erst im Schritt „Einheiten" mindestens eine Wohnung anlegen.</div>';
    var kopf = '<tr style="text-align:left;color:#8A8272"><th style="min-width:140px">Einheit</th>'
      + WE_IDS.map(function (id) { return '<th>' + esc(labelVon(id).replace(/^Modernisierung /, '').replace(/ \(.*/, '').replace(/^Verbesserung /, '')) + '</th>'; }).join('') + '<th style="text-align:right">Punkte</th></tr>';
    var zeilen = _arbeit.map(function (e, i) {
      var opts = [['', 'wie Gebäude']].concat(STUFEN);
      return '<tr><td style="padding:6px 8px 6px 0">' + esc((e.nr ? 'Nr. ' + e.nr : '#' + (i + 1)) + (e.lage ? ' · ' + e.lage : '')) + '</td>'
        + WE_IDS.map(function (id) { return '<td style="padding:4px 6px 4px 0">' + selHtml('data-mi="' + i + '" data-mk="' + id + '"', (e.mod && e.mod[id]) || '', opts) + '</td>'; }).join('')
        + '<td style="padding:4px 0;text-align:right;font-weight:600" data-punkte="' + i + '">—</td></tr>';
    }).join('');
    return '<div style="font-size:12.5px;color:#6B6356;margin-bottom:10px">Vorgabe ist „wie Gebäude" — nur abweichende Wohnungen anfassen. Dach, Außenwand, Leitungen und Heizung kommen immer vom Haus.</div>'
      + '<div style="overflow:auto"><table style="border-collapse:collapse;font-size:12.5px;min-width:760px"><thead>' + kopf + '</thead><tbody>' + zeilen + '</tbody></table></div>';
  }

  /* Schritt 4 — Ergebnis */
  /* v1458 · dieselbe Auswertung fuer das Modal (Arbeitsstand) und fuer den
     Bankbericht (gespeicherter Stand) — eine Rechnung, zwei Aufrufer. */
  function auswerten(list, geb) {
    var s = summe(list), gp = 0;
    GEB_IDS.concat(WE_IDS).forEach(function (id) { gp += punkteVon(id, geb[id] || '0'); });
    var zeilen = list.map(function (e) {
      var p = punkteEinheit(e, geb), fl = zahl(e.wfl);
      return { e: e, fl: fl, punkte: p.punkte, geerbt: p.geerbt, rnd: rndFuer(p.punkte) };
    });
    var flSum = zeilen.reduce(function (a, z) { return a + z.fl; }, 0);
    var pGew = flSum > 0 ? zeilen.reduce(function (a, z) { return a + z.punkte * z.fl; }, 0) / flSum
      : (zeilen.length ? zeilen.reduce(function (a, z) { return a + z.punkte; }, 0) / zeilen.length : 0);
    var rGew = flSum > 0 ? zeilen.reduce(function (a, z) { return a + (z.rnd || 0) * z.fl; }, 0) / flSum : 0;
    return { s: s, gebPunkte: Math.min(20, gp), zeilen: zeilen, punkteGew: pGew, rndGew: rGew };
  }
  function ergebnisDaten() { return auswerten(_arbeit, _geb); }
  /* Fuer Bankunterlagen und PDF: aus dem GESPEICHERTEN Stand. */
  function berichtDaten() {
    var d = daten(), list = d.einheiten || [];
    if (!list.length) return null;
    var r = auswerten(list, d.gebaeude || {});
    r.sollAbJahr = d.sollAbJahr || null;
    r.geerbteGewerke = GEB_IDS.concat(WE_IDS).map(function (id) { return { id: id, label: labelVon(id), stufe: (d.gebaeude || {})[id] || '0', punkte: punkteVon(id, (d.gebaeude || {})[id] || '0') }; });
    return r;
  }
  function optionFuer(p) { var o = [0, 4, 8, 14, 19], b = o[0]; o.forEach(function (x) { if (Math.abs(x - p) < Math.abs(b - p)) b = x; }); return b; }
  function schritt4() {
    if (!_arbeit.length) return '<div class="cf-hint">Noch keine Einheit erfasst.</div>';
    var d = ergebnisDaten();
    var rows = d.zeilen.map(function (z) {
      return '<tr><td style="padding:5px 8px 5px 0">' + esc((z.e.nr ? 'Nr. ' + z.e.nr : '') + (z.e.lage ? ' · ' + z.e.lage : '')) + '</td>'
        + '<td style="text-align:right;padding:5px 8px">' + (z.fl ? Math.round(z.fl) + ' m²' : '—') + '</td>'
        + '<td style="text-align:right;padding:5px 8px">' + z.punkte + ' P.<span style="color:#8A8272;font-size:11px">' + (z.geerbt === WE_IDS.length ? ' · ganz geerbt' : (z.geerbt ? ' · ' + z.geerbt + ' geerbt' : ' · eigen')) + '</span></td>'
        + '<td style="text-align:right;padding:5px 0;font-weight:600">' + (z.rnd != null ? Math.round(z.rnd) + ' J.' : '—') + '</td></tr>';
    }).join('');
    var opt = optionFuer(d.punkteGew), r = Math.round(d.rndGew);
    return '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#8A8272;font-size:11px"><th>Einheit</th><th style="text-align:right">Fläche</th><th style="text-align:right">Anlage 2</th><th style="text-align:right">Restnutzungsdauer</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div style="margin-top:12px;padding:10px 12px;border:1px solid #E6E0D3;border-radius:8px;background:#FBFAF7;font-size:13px">'
      + '<b>Gebäude gesamt:</b> ' + d.punkteGew.toFixed(1).replace('.', ',') + ' Punkte flächengewichtet'
      + (r > 0 ? ' · Restnutzungsdauer ' + r + ' Jahre' : '')
      + (d.s.hatSoll ? '<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">Soll-Miete wirkt ab Jahr '
        + '<input id="mfh-soll-jahr" type="text" inputmode="numeric" value="' + esc(String(daten().sollAbJahr || '')) + '" placeholder="z. B. 3" style="width:64px;padding:5px 7px;border:1px solid #E6E0D3;border-radius:6px;font:13px Inter,sans-serif">'
        + '<span style="font-size:12px;color:#6B6356">der Mietentwicklung (leer = kein Sprung)</span></div>' : '')
      + '<div style="margin-top:8px;display:grid;gap:6px">'
      + '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mfh-uep" checked> Modernisierungsgrad ins Objekt übernehmen (<b>' + opt + ' Punkte</b>)</label>'
      + (r > 0 ? '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mfh-uer"> Restnutzungsdauer <b>' + r + ' Jahre</b> in die AfA übernehmen (eigener Satz ' + (100 / r).toFixed(2).replace('.', ',') + ' %)</label>' : '')
      + '</div></div>'
      + '<div class="cf-hint" style="margin-top:6px">Gerechnet mit dem Punktraster der Anlage 2 aus dem RND-Kern (DealPilotRND ' + ((window.DealPilotRND && window.DealPilotRND.VERSION) || '') + '). Die Zahl ist indikativ — den Nachweis fürs Finanzamt liefert ein Gutachten.</div>';
  }

  function koerper() { return [schritt1, schritt2, schritt3, schritt4][_schritt](); }
  function zeichnen() {
    var b = el('mfh-body'); if (!b) return;
    b.innerHTML = koerper();
    el('mfh-schritte').innerHTML = SCHRITTE.map(function (t, i) {
      return '<button type="button" data-s="' + i + '" style="border:none;background:none;cursor:pointer;font:' + (i === _schritt ? '600' : '400') + ' 12.5px Inter,sans-serif;color:' + (i === _schritt ? '#1A1714' : '#8A8272') + ';padding:6px 2px;border-bottom:2px solid ' + (i === _schritt ? 'var(--wl-c9a84c, #C9A84C)' : 'transparent') + '">' + (i + 1) + '. ' + t + '</button>';
    }).join('<span style="color:#D8D2C6">›</span>');
    el('mfh-zurueck').style.visibility = _schritt === 0 ? 'hidden' : 'visible';
    el('mfh-weiter').textContent = _schritt === SCHRITTE.length - 1 ? 'Übernehmen' : 'Weiter ›';
    zeichnenSumme(); punkteZeigen();
    var neu = el('mfh-neu'); if (neu) neu.onclick = function () { _arbeit.push({ nr: String(_arbeit.length + 1), art: 'wohnen', status: 'vermietet' }); zeichnen(); };
  }
  function punkteZeigen() {
    var g = el('mfh-geb-p');
    if (g) { var p = 0; GEB_IDS.concat(WE_IDS).forEach(function (id) { p += punkteVon(id, _geb[id] || '0'); }); g.textContent = Math.min(20, p); }
    _arbeit.forEach(function (e, i) { var t = document.querySelector('[data-punkte="' + i + '"]'); if (t) t.textContent = punkteEinheit(e, _geb).punkte + ' P.'; });
  }

  function oeffnen(schritt) {
    schliessen();
    var d = daten();
    _arbeit = JSON.parse(JSON.stringify(d.einheiten || []));
    _geb = JSON.parse(JSON.stringify(d.gebaeude || {}));
    _schritt = schritt || 0;
    if (!_arbeit.length) _arbeit.push({ nr: '1', art: 'wohnen', status: 'vermietet' });
    var m = document.createElement('div'); m.id = 'mfh-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(42,39,39,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:12px';
    m.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:1080px;width:100%;max-height:92vh;display:flex;flex-direction:column;border:1px solid #E6E0D3;color:#2A2727;font-family:Inter,sans-serif">' +
      '<div style="padding:18px 20px 6px"><div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33)">Mehrfamilienhaus</div>' +
      '<h3 style="margin:6px 0 8px;font:600 20px/1.3 \'Space Grotesk\',sans-serif">Einheiten und Zustand erfassen</h3>' +
      '<div id="mfh-schritte" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"></div></div>' +
      '<div style="overflow:auto;padding:12px 20px;flex:1 1 auto" id="mfh-body"></div>' +
      '<div style="padding:10px 20px;border-top:1px solid #EFEBE3;font-size:13px" id="mfh-summe"></div>' +
      '<label id="mfh-san-zeile" style="display:none;gap:8px;align-items:center;padding:0 20px 10px;font-size:13px"><input type="checkbox" id="mfh-san"> <span id="mfh-san-text"></span></label>' +
      '<div style="padding:0 20px 16px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" id="mfh-zurueck" class="btn btn-outline btn-sm">‹ Zurück</button>' +
      '<button type="button" id="mfh-zu" class="btn btn-outline btn-sm" style="margin-left:auto">Abbrechen</button>' +
      '<button type="button" id="mfh-ok" class="btn btn-outline btn-sm">Speichern</button>' +
      '<button type="button" id="mfh-weiter" class="btn btn-sm" style="background:#2A2727;color:#fff;border:none">Weiter ›</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('input', function (ev) { var t = ev.target; if (t.dataset && t.dataset.k) { _arbeit[+t.dataset.i][t.dataset.k] = t.value; zeichnenSumme(); punkteZeigen(); } });
    m.addEventListener('change', function (ev) {
      var t = ev.target; if (t.tagName !== 'SELECT') return;
      if (t.dataset.k) { _arbeit[+t.dataset.i][t.dataset.k] = t.value; zeichnenSumme(); }
      if (t.dataset.geb) { _geb[t.dataset.geb] = t.value; }
      if (t.dataset.mk) { var e = _arbeit[+t.dataset.mi]; e.mod = e.mod || {}; e.mod[t.dataset.mk] = t.value; }
      punkteZeigen();
    });
    m.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === m) schliessen();
      if (t.dataset && t.dataset.s != null) { _schritt = +t.dataset.s; zeichnen(); }
      if (t.dataset && t.dataset.dup != null) { var i = +t.dataset.dup, c = JSON.parse(JSON.stringify(_arbeit[i])); c.nr = String(_arbeit.length + 1); c.lage = ''; _arbeit.splice(i + 1, 0, c); zeichnen(); }
      if (t.dataset && t.dataset.del != null) { _arbeit.splice(+t.dataset.del, 1); zeichnen(); }
    });
    el('mfh-zu').onclick = schliessen;
    el('mfh-ok').onclick = uebernehmen;
    el('mfh-zurueck').onclick = function () { if (_schritt > 0) { _schritt--; zeichnen(); } };
    el('mfh-weiter').onclick = function () { if (_schritt < SCHRITTE.length - 1) { _schritt++; zeichnen(); } else uebernehmen(); };
    zeichnen();
  }
  /* Beim Tippen nur die Summenzeile neu — die Tabelle bleibt stehen, damit
     der Cursor im Feld bleibt. */
  function zeichnenSumme() {
    var host = el('mfh-summe'); if (!host) return;
    var s = summe(_arbeit);
    host.innerHTML = s.anzahl
      ? '<b>' + s.anzahl + ' Einheiten</b> (' + s.wohnen + ' Wohnen' + (s.anzahl - s.wohnen ? ', ' + (s.anzahl - s.wohnen) + ' Gewerbe' : '') + ') · '
        + Math.round(s.flaeche).toLocaleString('de-DE') + ' m²' + (s.flaecheGew ? ' (davon Gewerbe ' + Math.round(s.flaecheGew) + ' m²)' : '') + ' · '
        + 'Ist ' + eur(s.ist) + '/Monat · Soll ' + eur(s.soll) + '/Monat'
        + (s.leer ? ' · <span style="color:#B8625C">Leerstand ' + s.leer + ' WE / ' + Math.round(s.leerFl) + ' m²</span>' : '')
        + (s.kosten ? ' · Maßnahmen ' + eur(s.kosten) : '')
      : 'Noch keine Einheit — „+ Einheit" legt die erste an.';
    sanZeile();
  }
  /* Massnahmenkosten -> Sanierung nur auf ausdruecklichen Haken.
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
    var d = ergebnisDaten();
    var jahrFeld = el('mfh-soll-jahr');
    var sollAb = jahrFeld ? Math.round(zahl(jahrFeld.value)) : Math.round(zahl(daten().sollAbJahr));
    window._dpMfh = { einheiten: list, gebaeude: _geb, gnd: gnd(), sollAbJahr: sollAb > 0 ? sollAb : null, stand: new Date().toISOString().slice(0, 10) };
    var s = summe(list), meldung = list.length + ' Einheiten übernommen';
    if (list.length) {
      if (s.flaeche > 0) setzen('wfl', s.flaeche);
      setzen('einheiten', s.wohnen);
      if (s.ist > 0) setzen('nkm', s.ist);
      if (s.kosten > 0 && el('mfh-san') && el('mfh-san').checked) { setzen('san', s.kosten); if (typeof window.syncSanTaxOnSanInput === 'function') try { window.syncSanTaxOnSanInput(); } catch (x) {} }
      /* Zustand und RND nur uebernehmen, wenn der Nutzer im Ergebnis
         zugestimmt hat — nie still. */
      if (el('mfh-uep') && el('mfh-uep').checked && el('mod_punkte')) {
        el('mod_punkte').value = String(optionFuer(d.punkteGew));
        try { el('mod_punkte').dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {}
        meldung += ' · Modernisierungsgrad ' + optionFuer(d.punkteGew) + ' P.';
      }
      if (el('mfh-uer') && el('mfh-uer').checked && d.rndGew > 0) {
        var r = Math.round(d.rndGew), sel = el('afa_satz'), feld = el('afa_rnd_jahre');
        if (!feld && sel && window.DpAfaEigen) { sel.value = 'eigen'; try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {} feld = el('afa_rnd_jahre'); }
        if (feld) {
          var g = el('afa_eigen_grundlage'); if (g && !g.value) g.value = 'Einheitenbewertung MFH (Anlage 2, indikativ)';
          feld.value = String(r); try { feld.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {}
          meldung += ' · AfA aus RND ' + r + ' Jahre';
        }
      }
    }
    if (typeof window.calc === 'function') window.calc();
    schliessen(); knopf();
    if (typeof window.toast === 'function') window.toast('✓ ' + meldung);
  }

  /* ── Kennzahlen Ist gegen Soll (Stufe 2) ─────────────────────────── */
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
      '</table><div class="cf-hint" style="margin-top:4px">Soll = vereinbarte Soll-Mieten aller Einheiten nach den Maßnahmen, gleiche Finanzierung und Kosten. '
      + (d.sollAbJahr > 0 ? 'Ab Jahr ' + d.sollAbJahr + ' rechnet die Mietentwicklung mit der Soll-Miete.' : 'Die Rechnung oben bleibt beim Ist — ein Jahr für den Sprung steht im Konfigurator, Schritt 4.') + '</div>';
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
  window.DpMfhEinheiten = { oeffnen: oeffnen, knopf: knopf, istSoll: istSoll, berichtDaten: berichtDaten, _summe: summe, _punkte: punkteEinheit, _ergebnis: ergebnisDaten };
})();
