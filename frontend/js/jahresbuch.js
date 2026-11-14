/* ══════════════════════════════════════════════════════════════════════
 * jahresbuch.js — v3363 · Jahr für Jahr: Plan gegen Ist (Bestand)
 *
 * Marcel 14.11.2026: „Steuern und Miete für jedes Jahr eintragen und den
 * Verlauf sehen." Bis hier gab es je Jahr nur die Steuerzellen der Anlage V
 * (`_tax_overrides`) und die Jahresstände (Abzug des Formulars beim
 * Speichern). Eine Ist-Miete je Jahr außerhalb der Steuer fehlte ganz.
 *
 * Bericht Dateien/Fehler/zielbild-jahresverlauf-2026-11-14.md, Paket 4
 * (E2 Name „Jahre", E6 Bescheid sperrt nicht, E7 keine stille Angleichung,
 * E8 Objekt-JSON statt eigener Tabelle).
 *
 * ── DATEN ────────────────────────────────────────────────────────────
 *
 *   _jahre: { "2025": { nkm_j, einheiten: { "0": { miete_m, leer_monate } },
 *             leer_monate, rs_ist, steuer_status, notiz, geaendert_am } }
 *
 *   steuer_status: geplant | erklaert | bescheid  (fehlt = geplant)
 *
 * ── EIN FELD, EINE STELLE ───────────────────────────────────────────
 *
 *   Einnahmen und Werbungskosten bleiben in der Anlage V (tax.js). Das
 *   Jahresbuch zeigt sie und schlägt bei leerer Zelle die Ist-Miete als
 *   Mieteinnahme vor (Knopf, nie still). Weichen beide ab, steht ein Hinweis
 *   da - die Anlage V bleibt für die Steuer maßgeblich.
 *
 * ── WAS HIER NICHT PASSIERT ─────────────────────────────────────────
 *
 *   Kein neuer Rechenkern. Die Projektion (calc.js) rechnet weiter wie bisher,
 *   auch für vergangene Jahre (Paket 5 des Berichts, wartet auf E4). Hier
 *   stehen Plan (eingefroren beim Ankauf, `_ankauf.plan`), Ist (eingetragen)
 *   und die Differenz. Nichts wird beim Laden geschrieben; vorbelegt wird nur
 *   auf Klick.
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpJahresbuch) return;
  var VERSION = 'v3363';
  var STATUS = [['geplant', 'geplant'], ['erklaert', 'erklärt'], ['bescheid', 'Bescheid']];

  function doc() { return global.document || null; }
  function el(id) { var d = doc(); return d && d.getElementById ? d.getElementById(id) : null; }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim();
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s); return isFinite(n) ? n : null;
  }
  function r0(x) { return istZahl(x) ? Math.round(x) : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function eurVz(x) { return istZahl(x) ? (x > 0 ? '+' : (x < 0 ? '−' : '')) + Math.abs(Math.round(x)).toLocaleString('de-DE') + ' €' : '–'; }
  function heuteJahr() { return new Date().getFullYear(); }
  function heuteIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function D() { return global._currentObjData || null; }
  function statusWort(s) { var t = STATUS.filter(function (x) { return x[0] === s; })[0]; return t ? t[1] : 'geplant'; }

  /* ── Rein (testbar, tools/jahresbuch-pruefen.mjs Abschnitt J) ───── */
  /** Jahre vom Kauf bis heute, jüngstes zuerst. */
  function jahreVon(start, bis) {
    var a = parseInt(start, 10), b = parseInt(bis, 10), out = [];
    if (!(a >= 1990 && a <= 2100) || !(b >= a)) return out;
    for (var y = b; y >= a && out.length < 40; y--) out.push(y);
    return out;
  }
  /** Summe der Wohnungen: Monatsmiete am 31.12. × (12 − Leerstandsmonate). Nur ein Vorschlag. */
  function summeEinheiten(einheiten) {
    var keys = Object.keys(einheiten || {}), s = 0, n = 0;
    keys.forEach(function (k) {
      var e = einheiten[k] || {}, m = zahl(e.miete_m), l = zahl(e.leer_monate) || 0;
      if (istZahl(m)) { s += m * Math.max(0, 12 - Math.min(12, l)); n++; }
    });
    return n ? Math.round(s) : null;
  }
  /** Eine Zeile aus den Quellen. q = { jahr, plan, proj, ist, av: {wert, eigen}|null, steuer: {ergebnis, refund}|null,
      ziel_nkm, stand, erhoehungen: [], mb } */
  function zeile(q) {
    var ist = q.ist || {}, plan = q.plan || {}, z = { jahr: q.jahr };
    z.miete_plan = istZahl(plan.nkm_y) ? plan.nkm_y : null;
    z.miete_proj = q.proj && istZahl(q.proj.nkm_y) ? r0(q.proj.nkm_y) : null;
    z.miete_ist = istZahl(zahl(ist.nkm_j)) ? zahl(ist.nkm_j) : null;
    z.miete_einheiten = summeEinheiten(ist.einheiten);
    z.miete_abw = istZahl(z.miete_ist) && istZahl(z.miete_plan) ? z.miete_ist - z.miete_plan : null;
    z.cf_plan = istZahl(plan.cfop_y) ? plan.cfop_y : null;
    z.cf_stand = q.stand && q.stand.kz && istZahl(zahl(q.stand.kz._kpis_cf_vs)) ? zahl(q.stand.kz._kpis_cf_vs) : null;
    z.rs_plan = istZahl(plan.rs) ? plan.rs : null;
    z.rs_ist = istZahl(zahl(ist.rs_ist)) ? zahl(ist.rs_ist) : null;
    z.rs_abw = istZahl(z.rs_ist) && istZahl(z.rs_plan) ? z.rs_ist - z.rs_plan : null;
    z.av = q.av || null;
    z.steuer = q.steuer || null;
    z.status = ist.steuer_status || 'geplant';
    z.ziel_nkm = istZahl(q.ziel_nkm) ? q.ziel_nkm : null;
    z.erhoehungen = q.erhoehungen || [];
    z.mb = q.mb || null;
    z.notiz = ist.notiz || '';
    /* E7 · Abgleich Ist-Miete gegen die Mieteinnahmen der Anlage V */
    z.abgleich = null;
    if (istZahl(z.miete_ist) && z.av) {
      if (!z.av.eigen) z.abgleich = { art: 'vorschlag', text: 'In der Anlage V steht für ' + q.jahr + ' noch der Vorschlag (' + eur(z.av.wert) + '). Ist-Miete als Mieteinnahme übernehmen?' };
      else if (Math.abs(z.av.wert - z.miete_ist) > 1) z.abgleich = { art: 'abweichung', text: 'Anlage V ' + eur(z.av.wert) + ', Ist-Miete ' + eur(z.miete_ist) + '. Die Anlage V bleibt für die Steuer maßgeblich.' };
      else z.abgleich = { art: 'gleich', text: 'Ist-Miete und Anlage V stimmen überein.' };
    }
    /* Status „erreicht" nur als Vorschlag, nie automatisch */
    z.ziel_erreicht = istZahl(z.miete_ist) && istZahl(z.ziel_nkm) && z.ziel_nkm > 0 && z.miete_ist / 12 >= z.ziel_nkm - 0.5;
    return z;
  }
  /** Rein: einen Eintrag ändern (neues Objekt), leere Werte fallen raus. */
  function setzen(jahre, jahr, feld, wert) {
    var out = JSON.parse(JSON.stringify(jahre || {})), k = String(jahr);
    var e = out[k] || {};
    if (wert === '' || wert == null) delete e[feld]; else e[feld] = wert;
    e.geaendert_am = new Date().toISOString();
    var inhalt = Object.keys(e).filter(function (x) { return x !== 'geaendert_am'; });
    if (inhalt.length) out[k] = e; else delete out[k];
    return out;
  }
  /** E6 · Ein Bescheid sperrt nicht. Bei „erklärt" und „Bescheid" wird nachgefragt. */
  function nachfragen(status) { return status === 'erklaert' || status === 'bescheid'; }

  /* ── Aus der laufenden App ─────────────────────────────────────── */
  function jahreDaten() { var d = D(); return d && d._jahre && typeof d._jahre === 'object' ? d._jahre : {}; }
  function ankauf() { try { var A = global.DealPilotAnkauf; return A && A.vorhanden && A.vorhanden() ? A.stand() : null; } catch (e) { return null; } }
  function sollAnsicht() { try { var AA = global.DealPilotAnkaufAnsicht; return !!(AA && AA.aktiv && AA.aktiv()); } catch (e) { return false; } }
  function verfuegbar() { return !!ankauf() && !sollAnsicht(); }
  function startJahr() {
    var a = ankauf(), s = a && a.stichtag ? String(a.stichtag) : String((el('kaufdat') || {}).value || '');
    return /^\d{4}/.test(s) ? +s.slice(0, 4) : null;
  }
  function status(jahr) { var e = jahreDaten()[String(jahr)]; return (e && e.steuer_status) || 'geplant'; }
  function speichern() { try { if (typeof global.saveObj === 'function') global.saveObj({ silent: true }); } catch (e) {} }
  function schreiben(jahr, feld, wert, ohneSpeichern) {
    var d = D(); if (!d) return;
    d._jahre = setzen(d._jahre, jahr, feld, wert);
    if (!ohneSpeichern) speichern();
  }
  function statusSetzen(jahr, s) {
    if (!STATUS.some(function (x) { return x[0] === s; })) return false;
    schreiben(jahr, 'steuer_status', s === 'geplant' ? '' : s);
    mountAll();
    return true;
  }
  /** Für tax.js updateTaxOverride: darf die Zelle dieses Jahres geändert werden? Fragt bei erklärt/Bescheid nach. */
  function aenderungErlaubt(jahr) {
    var s = status(jahr);
    if (!nachfragen(s) || typeof global.confirm !== 'function') return true;
    return global.confirm('Für ' + jahr + ' ist die Steuer als „' + statusWort(s) + '“ gekennzeichnet. Wert trotzdem ändern?');
  }
  function steuerJahr(jahr) {
    var out = { av: null, steuer: null };
    try { if (typeof global.dpSteuerWert === 'function') out.av = global.dpSteuerWert(jahr, 'einnahmen_km'); } catch (e) {}
    try {
      var sj = typeof global._v269_getStartYear === 'function' ? global._v269_getStartYear() : null;
      var rows = (global.State && global.State.cfRows) || [];
      if (sj != null && typeof global._computeYearTotal === 'function' && jahr - sj >= 0 && jahr - sj < rows.length) {
        var t = global._computeYearTotal(jahr, jahr - sj);
        if (t) out.steuer = { ergebnis: r0(t.ergebnis), refund: r0(t.refund) };
      }
    } catch (e) {}
    return out;
  }
  function zielFuer(jahr) {
    try {
      var F = global.DpZielbildFassungen, J = global.DpJahresstaende;
      var iso = jahr === heuteJahr() ? heuteIso() : jahr + '-12-31';
      var aktivZiel = J && J.zielJetzt ? J.zielJetzt().nkm : null;
      if (!F) return { nkm: aktivZiel, titel: null };
      var g = F.gueltig(iso);
      return { nkm: F.zielNkm(g, aktivZiel), titel: g ? (g.aktiv ? F.aktivTitel() : g.titel) : null, fassung: g && !g.aktiv ? g.fassung : null };
    } catch (e) { return { nkm: null, titel: null }; }
  }
  var _mb = { key: null, liste: null, laedt: null };
  function mbLaden() {
    var k = global._currentObjKey;
    if (!k || !global.Auth || typeof global.Auth.apiCall !== 'function') return Promise.resolve([]);
    if (_mb.key === k && _mb.liste) return Promise.resolve(_mb.liste);
    if (_mb.key === k && _mb.laedt) return _mb.laedt;
    _mb.key = k; _mb.liste = null;
    _mb.laedt = global.Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + k), { method: 'GET' }).then(function (j) {
      if (global._currentObjKey !== k) return [];
      _mb.liste = ((j && j.history) || []).filter(function (h) { return h && h.market_value != null && h.created_at; })
        .map(function (h) { return { wert: Number(h.market_value), am: String(h.created_at).slice(0, 10) }; });
      _mb.laedt = null; return _mb.liste;
    }, function () { _mb.laedt = null; _mb.liste = []; return []; });
    return _mb.laedt;
  }
  function mbImJahr(jahr) {
    var l = (_mb.key === global._currentObjKey && _mb.liste) || [];
    var im = l.filter(function (x) { return x.am.slice(0, 4) === String(jahr); }).sort(function (a, b) { return a.am < b.am ? -1 : 1; });
    return im.length ? im[im.length - 1] : null;
  }
  /** Alle Zeilen, jüngstes Jahr zuerst. */
  function zeilen() {
    var a = ankauf(); if (!a) return [];
    var plan = Array.isArray(a.plan) ? a.plan : [], rows = (global.State && global.State.cfRows) || [];
    var J = global.DpJahresstaende, staende = J && J.liste ? J.liste() : [];
    var E = global.DpErhoehungen, erh = E && E.alle ? E.alle() : [];
    var ist = jahreDaten();
    return jahreVon(startJahr(), heuteJahr()).map(function (y) {
      var st = steuerJahr(y), zl = zielFuer(y);
      var z = zeile({ jahr: y, plan: plan.filter(function (p) { return p && p.cal === y; })[0] || null,
        proj: rows.filter(function (r) { return r && r.cal === y; })[0] || null, ist: ist[String(y)] || null,
        av: st.av, steuer: st.steuer, ziel_nkm: zl.nkm, stand: staende.filter(function (s) { return s && s.jahr === y; })[0] || null,
        erhoehungen: erh.filter(function (x) { return String(x.datum).slice(0, 4) === String(y); }), mb: mbImJahr(y) });
      z.ziel_titel = zl.titel; z.ziel_fassung = zl.fassung || null;
      return z;
    });
  }

  /* ── Anzeige ───────────────────────────────────────────────────── */
  function stil() {
    var d = doc(); if (!d || d.getElementById('dp-jb-stil') || !d.head) return;
    var s = d.createElement('style'); s.id = 'dp-jb-stil';
    s.textContent = [
      '.dp-jb{font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '.dp-jb-satz{color:#6B645A;margin:0 0 10px;font-size:12px}',
      '.dp-jb-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '.dp-jb-tafel{width:100%;border-collapse:collapse;min-width:640px;font-variant-numeric:tabular-nums}',
      '.dp-jb-tafel th{font:600 10.5px/1.3 "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.04em;color:#6B645A;text-align:right;padding:6px 8px;border-bottom:1px solid rgba(128,128,128,.3)}',
      '.dp-jb-tafel td{padding:7px 8px;border-top:1px solid rgba(128,128,128,.15);text-align:right;vertical-align:top}',
      '.dp-jb-tafel th:first-child,.dp-jb-tafel td:first-child{text-align:left}',
      '.dp-jb-tafel td small{display:block;color:#6B645A;font-size:11px}',
      '.dp-jb-gut{color:#3FA56C}.dp-jb-schlecht{color:#B8625C}',
      '.dp-jb-st{display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;border:1px solid rgba(128,128,128,.4)}',
      '.dp-jb-st-erklaert{border-color:var(--wl-c9a84c, #C9A84C)}.dp-jb-st-bescheid{border-color:#3FA56C;color:#3FA56C}',
      '.dp-jb-knopf{background:none;border:1px solid rgba(128,128,128,.4);border-radius:6px;padding:4px 9px;font:inherit;font-size:12px;cursor:pointer;color:inherit;min-height:30px}',
      '.dp-jb-edit td{background:rgba(127,127,127,.05);text-align:left}',
      '.dp-jb-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:4px 0 8px}',
      '.dp-jb-f label{display:flex;flex-direction:column;font-size:11.5px;gap:2px}',
      '.dp-jb-f input,.dp-jb-f select{font:inherit;padding:5px 7px;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:transparent;color:inherit;min-width:0}',
      '.dp-jb-h{margin:4px 0;padding:6px 9px;border-left:3px solid var(--wl-c9a84c, #C9A84C);background:rgba(127,127,127,.06);font-size:12px}',
      '.dp-jb-h.dp-jb-ok{border-left-color:#3FA56C}',
      '.dp-jb-ov{position:fixed;inset:0;background:rgba(42,39,39,.6);z-index:99990;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}',
      '.dp-jb-karte{background:var(--surface, #FDFCFA);color:var(--text, #2A2727);border-radius:12px;max-width:1100px;width:100%;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.35)}',
      '.dp-jb-kopf{display:flex;align-items:center;gap:10px;margin-bottom:8px}.dp-jb-kopf b{font:600 16px "Space Grotesk",Inter,sans-serif}',
      '.dp-jb-kopf button{margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;color:inherit;min-width:36px;min-height:36px}',
      '.dp-jb-einstieg{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:0 0 12px;padding:8px 12px;border:1px dashed rgba(128,128,128,.4);border-radius:8px;font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '@media (max-width:640px){.dp-jb-karte{padding:12px}.dp-jb-tafel{min-width:560px}}'
    ].join('\n');
    d.head.appendChild(s);
  }
  var _offen = null;   /* aufgeklapptes Jahr */
  function zelleMiete(z) {
    var t = istZahl(z.miete_ist) ? '<b>' + eur(z.miete_ist) + '</b>' : '<span style="color:#6B645A">–</span>';
    if (istZahl(z.miete_abw)) t += '<small class="' + (z.miete_abw >= 0 ? 'dp-jb-gut' : 'dp-jb-schlecht') + '">' + eurVz(z.miete_abw) + ' zum Plan</small>';
    else if (!istZahl(z.miete_ist) && istZahl(z.av && z.av.wert) && z.av.eigen) t += '<small>Anlage V ' + eur(z.av.wert) + '</small>';
    return t;
  }
  function editHtml(z, mfh) {
    var e = jahreDaten()[String(z.jahr)] || {};
    var f = function (feld, lbl, ph, typ) { return '<label>' + lbl + '<input data-jb-feld="' + feld + '" inputmode="' + (typ || 'decimal') + '" value="' + esc(e[feld] == null ? '' : String(e[feld]).replace('.', ',')) + '" placeholder="' + esc(ph || '') + '"></label>'; };
    var ph = istZahl(z.miete_einheiten) ? String(z.miete_einheiten) : (istZahl(z.miete_proj) ? String(z.miete_proj) : '');
    var ein = '';
    if (mfh && mfh.length) {
      ein = '<div style="margin:6px 0 2px;font-weight:600">Je Wohnung (Monatsmiete am 31.12., Leerstand in Monaten)</div><div class="dp-jb-f">'
        + mfh.map(function (w, i) {
          if (!w) return '';
          var x = (e.einheiten || {})[String(i)] || {};
          return '<label>' + esc('Wohnung ' + (w.nr || (i + 1)) + (w.lage ? ' · ' + w.lage : '')) + '<span style="display:flex;gap:4px">'
            + '<input data-jb-einheit="' + i + '" data-jb-k="miete_m" inputmode="decimal" style="flex:2" value="' + esc(x.miete_m == null ? '' : String(x.miete_m).replace('.', ',')) + '" placeholder="' + esc(String(w.ist || '')) + '">'
            + '<input data-jb-einheit="' + i + '" data-jb-k="leer_monate" inputmode="numeric" style="flex:1" value="' + esc(x.leer_monate == null ? '' : x.leer_monate) + '" placeholder="0"></span></label>';
        }).join('') + '</div>'
        + (istZahl(z.miete_einheiten) ? '<div class="dp-jb-h">Aus den Wohnungen ergibt sich ' + eur(z.miete_einheiten) + ' im Jahr. <button type="button" class="dp-jb-knopf" data-jb-aktion="summe" data-jb-jahr="' + z.jahr + '">als Ist-Miete des Jahres</button></div>' : '');
    }
    var st = STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (z.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('');
    var erh = z.erhoehungen.length ? z.erhoehungen.map(function (x) {
      return (x.einheit != null ? 'Wohnung ' + esc(x.nr) + ': ' : '') + esc(x.datum.split('-').reverse().join('.')) + ' auf ' + eur(zahl(x.auf));
    }).join(' · ') : 'keine eingetragen';
    return '<tr class="dp-jb-edit" data-jb-edit="' + z.jahr + '"><td colspan="8">'
      + '<div class="dp-jb-f">'
      + f('nkm_j', 'Ist-Kaltmiete ' + z.jahr + ' (Summe des Jahres, €)', ph ? 'Vorschlag ' + ph : '')
      + (mfh && mfh.length ? '' : f('leer_monate', 'Leerstand (Monate)', '0', 'numeric'))
      + f('rs_ist', 'Restschuld am 31.12. laut Kontoauszug (€)', istZahl(z.rs_plan) ? 'Plan ' + z.rs_plan : '')
      + '<label>Steuer ' + z.jahr + '<select data-jb-feld="steuer_status">' + st + '</select></label>'
      + f('notiz', 'Notiz', 'z. B. Mieterwechsel im Mai', 'text')
      + '</div>' + ein
      + '<div class="dp-jb-h">Mieterhöhungen ' + z.jahr + ': ' + erh + '. Eintragen im Reiter Miete (Karte Mietvertrag) oder je Wohnung unter Einheiten erfassen.</div>'
      + '<button type="button" class="dp-jb-knopf" data-jb-aktion="zu">Fertig</button>'
      + '</td></tr>';
  }
  function tafelHtml(Z, mfh) {
    var kopf = '<tr><th>Jahr</th><th>Kaltmiete Plan</th><th>Kaltmiete Ist</th><th>Cashflow v. St. Plan</th><th>Restschuld Plan · Ist</th><th>Steuer V+V</th><th>Ziel · Wert</th><th></th></tr>';
    var body = Z.map(function (z) {
      var hin = '';
      if (z.abgleich && z.abgleich.art !== 'gleich') hin += '<div class="dp-jb-h">' + esc(z.abgleich.text) + (z.abgleich.art === 'vorschlag' ? ' <button type="button" class="dp-jb-knopf" data-jb-aktion="av" data-jb-jahr="' + z.jahr + '">übernehmen</button>' : '') + '</div>';
      if (z.ziel_erreicht && z.ziel_fassung && z.ziel_fassung.status !== 'erreicht') hin += '<div class="dp-jb-h dp-jb-ok">Die Ist-Miete ' + z.jahr + ' erreicht das Ziel von ' + esc(z.ziel_titel || 'Zielbild') + '. <button type="button" class="dp-jb-knopf" data-jb-aktion="erreicht" data-jb-fassung="' + esc(z.ziel_fassung.id) + '">als erreicht kennzeichnen</button></div>';
      else if (z.ziel_erreicht && !z.ziel_fassung) hin += '<div class="dp-jb-h dp-jb-ok">Die Ist-Miete ' + z.jahr + ' erreicht das Ziel des aktiven Zielbilds. Ein neues Zielbild legst du im Reiter Investition an.</div>';
      var zeile = '<tr data-jb-jahr-zeile="' + z.jahr + '"><td><b>' + z.jahr + '</b>' + (z.jahr === heuteJahr() ? '<small>laufend</small>' : '') + '</td>'
        + '<td>' + eur(z.miete_plan) + '</td>'
        + '<td>' + zelleMiete(z) + '</td>'
        + '<td>' + eur(z.cf_plan) + (istZahl(z.cf_stand) ? '<small>Stand ' + eur(z.cf_stand) + '</small>' : '') + '</td>'
        + '<td>' + eur(z.rs_plan) + (istZahl(z.rs_ist) ? '<small class="' + (z.rs_abw <= 0 ? 'dp-jb-gut' : 'dp-jb-schlecht') + '">Ist ' + eur(z.rs_ist) + '</small>' : '') + '</td>'
        + '<td>' + (z.steuer ? eurVz(z.steuer.ergebnis) : '–') + '<small><span class="dp-jb-st dp-jb-st-' + z.status + '">' + statusWort(z.status) + '</span></small></td>'
        + '<td>' + (istZahl(z.ziel_nkm) ? eur(z.ziel_nkm) + '/Monat' : '–') + (z.ziel_titel ? '<small>' + esc(z.ziel_titel) + '</small>' : '') + (z.mb ? '<small>Wert ' + eur(z.mb.wert) + '</small>' : '') + '</td>'
        + '<td><button type="button" class="dp-jb-knopf" data-jb-aktion="auf" data-jb-jahr="' + z.jahr + '" aria-expanded="' + (_offen === z.jahr) + '">' + (_offen === z.jahr ? 'zu' : 'eintragen') + '</button></td></tr>';
      return zeile + (hin ? '<tr><td colspan="8">' + hin + '</td></tr>' : '') + (_offen === z.jahr ? editHtml(z, mfh) : '');
    }).join('');
    return '<div class="dp-jb-wrap"><table class="dp-jb-tafel"><thead>' + kopf + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function html() {
    if (!verfuegbar()) return '';
    stil();
    var Z = zeilen();
    if (!Z.length) return '<div class="dp-jb"><p class="dp-jb-satz">Ohne Kaufdatum gibt es noch keine Jahre.</p></div>';
    var M = global._dpMfh, mfh = global.DpMfhEinheiten && global.DpMfhEinheiten.artMitEinheiten && global.DpMfhEinheiten.artMitEinheiten() && M && Array.isArray(M.einheiten) ? M.einheiten : null;
    var leer = !Object.keys(jahreDaten()).length;
    var vorb = leer && vorbelegbar() ? '<div class="dp-jb-h">Es liegen schon Angaben vor (Mieteinnahmen der Anlage V, letzte Erhöhungen). <button type="button" class="dp-jb-knopf" data-jb-aktion="vorbelegen">Aus vorhandenen Daten vorbelegen</button></div>' : '';
    return '<div class="dp-jb" data-dp-jb="1">'
      + '<div class="dp-pa-sec"><span>JAHR FÜR JAHR: PLAN GEGEN IST</span></div>'
      + '<p class="dp-jb-satz">Plan ist die Rechnung vom Ankauf, eingefroren. Ist trägst du je Jahr ein. Steuerwerte kommen aus der Anlage V im Reiter Steuer. Vergangene Jahre der Projektion rechnen weiter mit der heutigen Miete, die Ist-Spalte zeigt, was wirklich war.</p>'
      + '<div data-dp-jb-grafik="1"></div>'
      + vorb + tafelHtml(Z, mfh) + '</div>';
  }
  /* Vorbelegung (nur auf Klick, Bericht 3.7) */
  function vorbelegbar() {
    var Z = zeilen();
    if (Z.some(function (z) { return z.av && z.av.eigen && z.jahr <= heuteJahr(); })) return true;
    var E = global.DpErhoehungen;
    return !!(E && !E.objektListe().length && /^\d{4}-\d{2}-\d{2}$/.test(String((el('mv_letzte_erhoehung') || {}).value || '')));
  }
  function vorbelegen() {
    var d = D(); if (!d) return 0;
    var n = 0, j = d._jahre || {};
    zeilen().forEach(function (z) {
      if (z.av && z.av.eigen && !(j[String(z.jahr)] && j[String(z.jahr)].nkm_j != null)) { j = setzen(j, z.jahr, 'nkm_j', Math.round(z.av.wert)); n++; }
    });
    d._jahre = j;
    var E = global.DpErhoehungen;
    if (E && !E.objektListe().length) {
      var e0 = E.ausVertrag((el('mv_letzte_erhoehung') || {}).value, (el('mv_letzte_erhoehung_betrag') || {}).value, (el('nkm') || {}).value);
      if (e0) { d._erhoehungen = [e0]; n++; try { E.objektMount(); } catch (x) {} }
    }
    try {
      var F = global.DpZielbildFassungen, a = ankauf();
      if (F && !(d._zielbild_aktiv && d._zielbild_aktiv.gueltig_ab) && a && a.stichtag) d._zielbild_aktiv = Object.assign({}, d._zielbild_aktiv || {}, { gueltig_ab: a.stichtag });
    } catch (x) {}
    speichern();
    return n;
  }

  /* ── Hosts, Klicks, Fenster ────────────────────────────────────── */
  function mountAll() {
    var d = doc(); if (!d || !d.querySelectorAll) return;
    var hs = d.querySelectorAll('[data-dp-jb-host]');
    for (var i = 0; i < hs.length; i++) { try { hs[i].innerHTML = html(); binden(hs[i]); } catch (e) { hs[i].innerHTML = ''; console.warn('[jahresbuch]', e); } }
    if (hs.length) mbLaden().then(function (l) { if (l && l.length && !mountAll._mbFertig) { mountAll._mbFertig = global._currentObjKey; mountAll(); } });
    try { if (global.DpJahresbuchGrafik) global.DpJahresbuchGrafik.mountAll(); } catch (e) {}
    einstiege();
  }
  function binden(host) {
    if (host._dpJb) return; host._dpJb = true;
    host.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-jb-aktion]') : null; if (!b) return;
      ev.preventDefault();
      var a = b.getAttribute('data-jb-aktion'), y = parseInt(b.getAttribute('data-jb-jahr'), 10);
      if (a === 'auf') { _offen = _offen === y ? null : y; mountAll(); return; }
      if (a === 'zu') { _offen = null; speichern(); mountAll(); return; }
      if (a === 'vorbelegen') { var n = vorbelegen(); if (typeof global.toast === 'function') global.toast('✓ ' + n + ' Angaben vorbelegt'); mountAll(); return; }
      if (a === 'av') {
        var z = zeilen().filter(function (x) { return x.jahr === y; })[0];
        if (z && istZahl(z.miete_ist) && typeof global.dpSteuerSetzen === 'function' && aenderungErlaubt(y)) global.dpSteuerSetzen(y, 'einnahmen_km', z.miete_ist);
        setTimeout(mountAll, 200); return;
      }
      if (a === 'summe') { var z2 = zeilen().filter(function (x) { return x.jahr === y; })[0]; if (z2 && istZahl(z2.miete_einheiten)) schreiben(y, 'nkm_j', z2.miete_einheiten); mountAll(); return; }
      if (a === 'erreicht') { var F = global.DpZielbildFassungen; if (F) F.statusSetzen(b.getAttribute('data-jb-fassung'), 'erreicht'); mountAll(); }
    });
    host.addEventListener('change', function (ev) {
      var t = ev.target; if (!t || !t.getAttribute) return;
      var y = _offen; if (y == null) return;
      var feld = t.getAttribute('data-jb-feld'), ei = t.getAttribute('data-jb-einheit');
      if (feld === 'steuer_status') { statusSetzen(y, t.value); return; }
      if (feld) { schreiben(y, feld, feld === 'notiz' ? String(t.value || '').trim() : zahl(t.value), true); mountAll(); return; }
      if (ei != null) {
        var e = Object.assign({}, (jahreDaten()[String(y)] || {}).einheiten || {}), k = t.getAttribute('data-jb-k');
        var x = Object.assign({}, e[ei] || {}); var v = zahl(t.value);
        if (v == null) delete x[k]; else x[k] = v;
        if (Object.keys(x).length) e[ei] = x; else delete e[ei];
        schreiben(y, 'einheiten', Object.keys(e).length ? e : '', true); mountAll();
      }
    });
  }
  function oeffnen(jahr) {
    var d = doc(); if (!d || !verfuegbar()) { if (typeof global.toast === 'function') global.toast('ℹ Das Jahresbuch gibt es im Bestand (gewonnen, mit Ankauf-Stand).'); return; }
    schliessen();
    stil();
    if (jahr) _offen = +jahr;
    var ov = d.createElement('div'); ov.className = 'dp-jb-ov'; ov.id = 'dp-jb-ov';
    ov.innerHTML = '<div class="dp-jb-karte" role="dialog" aria-modal="true" aria-label="Jahre"><div class="dp-jb-kopf"><b>Jahre</b><button type="button" data-jb-schliessen="1" aria-label="Schließen">✕</button></div><div data-dp-jb-host="1"></div></div>';
    d.body.appendChild(ov);
    ov.addEventListener('click', function (ev) { if (ev.target === ov || (ev.target.closest && ev.target.closest('[data-jb-schliessen]'))) schliessen(); });
    ov.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') schliessen(); });
    mountAll();
  }
  function schliessen() {
    var ov = el('dp-jb-ov');
    if (ov && ov.parentNode) { ov.parentNode.removeChild(ov); speichern(); mountAll(); }
  }
  /* Einstieg im Reiter Miete (eine Zeile oben), nur im Bestand */
  function einstiege() {
    var s2 = el('s2'); if (!s2) return;
    var h = el('dp-jb-einstieg-miete');
    if (!verfuegbar()) { if (h) h.style.display = 'none'; return; }
    stil();
    if (!h) {
      h = doc().createElement('div'); h.id = 'dp-jb-einstieg-miete'; h.className = 'dp-jb-einstieg';
      h.innerHTML = '<span><b>Ist-Mieten je Jahr</b> · trag ein, was in jedem Jahr wirklich eingenommen wurde, und vergleiche mit dem Plan vom Ankauf.</span>'
        + '<button type="button" class="btn btn-outline btn-sm" onclick="DpJahresbuch.oeffnen()">Jahre öffnen</button>';
      s2.insertBefore(h, s2.firstChild);
    }
    h.style.display = '';
  }
  if (global.addEventListener) {
    global.addEventListener('dp:object-ready', function () { _offen = null; mountAll._mbFertig = null; setTimeout(mountAll, 900); });
    global.addEventListener('dp:erhoehungen', function () { setTimeout(mountAll, 100); });
    global.addEventListener('dp:zielbild-fassung', function () { setTimeout(mountAll, 100); });
  }

  global.DpJahresbuch = {
    VERSION: VERSION, STATUS: STATUS,
    jahreVon: jahreVon, summeEinheiten: summeEinheiten, zeile: zeile, setzen: setzen, nachfragen: nachfragen,
    verfuegbar: verfuegbar, zeilen: zeilen, status: status, statusSetzen: statusSetzen, statusWort: statusWort, aenderungErlaubt: aenderungErlaubt,
    html: html, mountAll: mountAll, oeffnen: oeffnen, schliessen: schliessen, vorbelegen: vorbelegen, mbLaden: mbLaden
  };
})(typeof window !== 'undefined' ? window : globalThis);
