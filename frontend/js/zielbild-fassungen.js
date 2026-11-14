/* ══════════════════════════════════════════════════════════════════════
 * zielbild-fassungen.js — v3361 · Zielbild-Fassungen über die Zeit
 *
 * Marcel 14.11.2026: „Im Bestand die Mieten jedes Jahr anpassen und neue
 * Zielbilder definieren, nicht nur einmal." Bis hierher gab es genau EIN
 * Zielbild je Objekt (beim MFH eines je Wohnung). „Zielbild leeren" löschte
 * es nach einer Rückfrage, und ein überschriebenes Zielbild war weg.
 *
 * Bericht Dateien/Fehler/zielbild-jahresverlauf-2026-11-14.md, Paket 2
 * (Entscheidungen E3: ein neues Zielbild gilt ab einem gewählten Datum,
 * Vorgabe heute; frühere Jahre messen weiter gegen die alte Fassung).
 *
 * ── DATEN (im Objekt-JSON, keine Tabelle, E8) ────────────────────────
 *
 *   _zielbilder     [ Fassung ]   abgelegte Fassungen, älteste zuerst
 *   _zielbild_aktiv { gueltig_ab, titel, angelegt_am }   Kopf des aktiven
 *
 *   Fassung = { id, titel, angelegt_am, gueltig_ab, abgeloest_am, zieljahr,
 *     status: 'abgeloest' | 'erreicht' | 'verworfen', grund, notiz, version,
 *     felder: { zb_*: … }, einheiten: [{ i, nr, ziel_qm, … }], haus_massnahmen,
 *     ergebnis: { miete_m_bestand, miete_m_ziel, ziel_nkm, kosten, plus,
 *                 ertragswert_bestand, ertragswert_ziel, rnd_ziel, ziel_auto } }
 *
 * Das AKTIVE Zielbild bleibt in den heutigen Feldern (zb_*, _dpMfh.einheiten,
 * haus_massnahmen). Kein Rechenweg ändert sich, potenzial.js modell() liest
 * weiter dort. Beide Felder reisen über _currentObjData mit (storage.js
 * collectData übernimmt jedes Feld des geladenen Objekts, das die Whitelist
 * nicht erzeugt) und gehören zum Bestand, nicht zum Ankauf (ankauf.js).
 *
 * ── WAS HIER NICHT PASSIERT ─────────────────────────────────────────
 *
 * Eine Fassung wird NIE nachgerechnet. `ergebnis` ist die Zahl von damals
 * (Modell und Ertragswert-Lauf zum Zeitpunkt des Ablegens) - dieselbe Regel
 * wie im Kopf von ankauf.js. Nichts wird beim Laden geschrieben.
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpZielbildFassungen) return;
  var VERSION = 'v3361';
  var FELDER = ['zb_soll_qm', 'zb_soll_ab', 'zb_vgl_qm', 'zb_ziel_qm', 'zb_ziel_wann', 'zb_fertig_jahr', 'zb_massnahmen',
    'zb_markt_qm', 'zb_ziel_bremse', 'zb_bremse_ausnahme'];
  var EINHEIT_FELDER = ['nr', 'lage', 'wfl', 'ist', 'status', 'ziel_qm', 'ziel_wann', 'soll', 'soll_ab', 'vgl_qm', 'massnahmen', 'ziel_bremse', 'bremse_ausnahme'];
  var STATUS = [['abgeloest', 'abgelöst'], ['erreicht', 'erreicht'], ['verworfen', 'verworfen']];
  var MAX = 40;

  function doc() { return global.document || null; }
  function el(id) { var d = doc(); return d && d.getElementById ? d.getElementById(id) : null; }
  function wert(id) { var e = el(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function r0(x) { return istZahl(x) ? Math.round(x) : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function heuteIso(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function datumDe(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function monatDe(iso) { var m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? m[2] + '/' + m[1] : ''; }
  function istDatum(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function kopie(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }
  function D() { return global._currentObjData || null; }

  /* ── Rein (testbar, tools/zielbild-fassungen-pruefen.mjs) ─────────── */
  function leer(v) { return v == null || v === '' || (Array.isArray(v) && !v.length) || v === '[]'; }
  /** Trägt ein Schnappschuss eigene Angaben? Der Vorschlag „Maximum bei Neuvermietung"
      (ziel_auto, v3343) zählt nicht - der steht ohne Eingabe immer da. */
  function hatInhalt(s) {
    if (!s) return false;
    var f = s.felder || {};
    if (FELDER.some(function (k) { return !leer(f[k]); })) return true;
    if ((s.einheiten || []).some(function (e) { return e && (!leer(e.ziel_qm) || !leer(e.soll) || !leer(e.massnahmen) || !leer(e.ziel_wann)); })) return true;
    return !leer(s.haus_massnahmen);
  }
  function titelAus(zieljahr) { return 'Zielbild ' + (zieljahr ? zieljahr : 'ohne Zieljahr'); }
  /** Welche Fassung galt an einem Tag? aktiv gilt ab aktiv.gueltig_ab (ohne Datum: immer, soweit
      keine Fassung den Tag deckt). Fassung gilt [gueltig_ab, abgeloest_am). */
  function gueltigAm(liste, aktiv, iso) {
    liste = Array.isArray(liste) ? liste : [];
    aktiv = aktiv || {};
    if (istDatum(aktiv.gueltig_ab) && iso >= aktiv.gueltig_ab) return { aktiv: true, titel: aktiv.titel || null, gueltig_ab: aktiv.gueltig_ab };
    for (var i = liste.length - 1; i >= 0; i--) {
      var f = liste[i]; if (!f) continue;
      var ab = istDatum(f.gueltig_ab) ? f.gueltig_ab : '0000-00-00';
      var bis = istDatum(f.abgeloest_am) ? f.abgeloest_am : '9999-12-31';
      if (iso >= ab && iso < bis) return { aktiv: false, fassung: f, titel: f.titel, gueltig_ab: f.gueltig_ab || null };
    }
    if (!istDatum(aktiv.gueltig_ab)) return { aktiv: true, titel: aktiv.titel || null, gueltig_ab: null };
    return null;
  }
  /** Ziel-Miete (€/Monat) einer Gültigkeit: Fassung = Zahl von damals, aktiv = heutiges Modell (zielAktiv). */
  function zielNkm(g, zielAktiv) {
    if (!g) return null;
    if (g.aktiv) return istZahl(zielAktiv) ? zielAktiv : null;
    var e = g.fassung && g.fassung.ergebnis;
    return e && istZahl(e.ziel_nkm) ? e.ziel_nkm : (e && istZahl(e.miete_m_ziel) ? e.miete_m_ziel : null);
  }
  /** Rein: legt eine Fassung ab. Gibt { liste, aktiv } zurück (neue Objekte). */
  function einordnen(liste, aktivAlt, snap, o) {
    o = o || {};
    var datum = istDatum(o.datum) ? o.datum : heuteIso();
    var f = Object.assign({}, snap, {
      id: 'zb-' + datum.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 7),
      titel: (aktivAlt && aktivAlt.titel) || titelAus(snap.zieljahr),
      angelegt_am: (aktivAlt && aktivAlt.angelegt_am) || null,
      gueltig_ab: (aktivAlt && istDatum(aktivAlt.gueltig_ab)) ? aktivAlt.gueltig_ab : (istDatum(o.seit) ? o.seit : null),
      abgeloest_am: datum, status: o.status || 'abgeloest', grund: o.grund || null, notiz: o.notiz || null,
      abgelegt_am: new Date().toISOString()
    });
    var neu = (Array.isArray(liste) ? liste.slice() : []).concat([f]).slice(-MAX);
    var aktiv = { gueltig_ab: datum, titel: o.titelNeu || null, angelegt_am: new Date().toISOString() };
    return { liste: neu, aktiv: aktiv, fassung: f };
  }

  /* ── Aus der laufenden App ─────────────────────────────────────── */
  function rechenstand() { try { var J = global.DpJahresstaende; var r = J && J.rechenstand ? J.rechenstand() : null; return r ? r.version : null; } catch (e) { return null; } }
  function ergebnisJetzt() {
    var P = global.DpPotenzial, out = {};
    try {
      var m = P.modell(), kz = P.kennzahlen ? P.kennzahlen(m) : null, r = P.ergebnis ? P.ergebnis() : null, h = (r && r.haus) || {};
      out.miete_m_bestand = r0(m.stufen.bestand.miete_m);
      out.miete_m_mh = m.stufen.mieterhoehung ? r0(m.stufen.mieterhoehung.miete_m) : null;
      out.miete_m_ziel = m.stufen.zielbild ? r0(m.stufen.zielbild.miete_m) : null;
      out.ziel_nkm = kz && kz.zielbild && istZahl(kz.zielbild.miete_j) ? r0(kz.zielbild.miete_j / 12) : null;
      out.kosten = m.stufen.zielbild ? r0(m.stufen.zielbild.kosten) : 0;
      out.plus = m.stufen.zielbild ? (m.stufen.zielbild.plus || 0) : 0;
      out.ziel_auto = (m.wohnungen || []).some(function (w) { return w && w.ziel_auto; });
      out.wohnungen = (m.wohnungen || []).length;
      out.ertragswert_bestand = h.bestand && istZahl(h.bestand.wert) ? r0(h.bestand.wert) : null;
      out.ertragswert_ziel = h.zielbild && istZahl(h.zielbild.wert) ? r0(h.zielbild.wert) : null;
      out.rnd_ziel = h.zielbild && h.zielbild.rnd != null ? h.zielbild.rnd : null;
      out.ertragswert_stand = r ? heuteIso() : null;
    } catch (e) {}
    return out;
  }
  function schnappschuss() {
    var felder = {};
    FELDER.forEach(function (k) { felder[k] = wert(k); });
    var M = global._dpMfh, mitE = !!(global.DpMfhEinheiten && global.DpMfhEinheiten.artMitEinheiten && global.DpMfhEinheiten.artMitEinheiten()) && M && Array.isArray(M.einheiten) && M.einheiten.length;
    var einheiten = mitE ? M.einheiten.map(function (e, i) {
      var o = { i: i }; if (!e) return o;
      EINHEIT_FELDER.forEach(function (k) { if (e[k] !== undefined) o[k] = kopie(e[k]); });
      return o;
    }) : [];
    var zj = parseInt(felder.zb_fertig_jahr, 10);
    return { zieljahr: zj >= 1990 && zj <= 2100 ? zj : null, felder: felder, einheiten: einheiten,
      haus_massnahmen: mitE ? kopie(M.haus_massnahmen || []) : [], ergebnis: ergebnisJetzt(), version: rechenstand() };
  }
  function liste() { var d = D(); return d && Array.isArray(d._zielbilder) ? d._zielbilder : []; }
  function aktiv() { var d = D(); return d && d._zielbild_aktiv && typeof d._zielbild_aktiv === 'object' ? d._zielbild_aktiv : {}; }
  function aktivTitel() { return aktiv().titel || titelAus(parseInt(wert('zb_fertig_jahr'), 10) || null); }
  function sollAnsicht() { try { var AA = global.DealPilotAnkaufAnsicht; return !!(AA && AA.aktiv && AA.aktiv()); } catch (e) { return false; } }
  function speichern() { try { if (typeof global.saveObj === 'function') return global.saveObj({ silent: true }); } catch (e) {} return null; }
  /** Legt das aktive Zielbild als Fassung ab. o: { datum, grund, status, titelNeu, notiz, ohneSpeichern }.
      Ohne eigene Angaben gibt es nichts abzulegen (false). */
  function ablegen(o) {
    o = o || {};
    if (sollAnsicht()) return false;
    var d = D(); if (!d) return false;
    var s = schnappschuss();
    if (!hatInhalt(s)) return false;
    var seit = null;
    try { var A = global.DealPilotAnkauf, st = A && A.stand ? A.stand() : null; seit = st && st.stichtag ? st.stichtag : null; } catch (e) {}
    var r = einordnen(liste(), aktiv(), s, Object.assign({ seit: seit }, o));
    d._zielbilder = r.liste;
    d._zielbild_aktiv = r.aktiv;
    if (!o.ohneSpeichern) speichern();
    try { global.dispatchEvent(new CustomEvent('dp:zielbild-fassung', { detail: { fassung: r.fassung } })); } catch (e) {}
    return r.fassung;
  }
  function statusSetzen(id, status) {
    if (!STATUS.some(function (s) { return s[0] === status; })) return false;
    var f = liste().filter(function (x) { return x && x.id === id; })[0];
    if (!f) return false;
    f.status = status; f.status_am = heuteIso();
    speichern(); mount();
    return true;
  }
  /** Für Jahresstände und Jahresbuch: was galt an diesem Tag (heute = aktiv). */
  function gueltig(iso) { return gueltigAm(liste(), aktiv(), iso || heuteIso()); }
  function wechselSatz() {
    var a = aktiv(), l = liste();
    if (!l.length) return '';
    var vor = l[l.length - 1];
    return 'Ziel seit ' + (monatDe(a.gueltig_ab) || '–') + ': ' + aktivTitel() + ' (vorher ' + (vor.titel || 'Zielbild') + ').';
  }

  /* ── Anzeige: Zielbild-Karte (Reiter Investition) ──────────────── */
  function stil() {
    var d = doc(); if (!d || d.getElementById('dp-zbf-stil') || !d.head) return;
    var s = d.createElement('style'); s.id = 'dp-zbf-stil';
    s.textContent = [
      '.dp-zbf{font:400 12.5px/1.5 Inter,system-ui,sans-serif;margin:0 0 12px;padding:8px 10px;border:1px solid rgba(128,128,128,.25);border-radius:8px}',
      '.dp-zbf-kopf{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}',
      '.dp-zbf-kopf .btn{margin-left:auto}',
      '.dp-zbf-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0 4px}',
      '.dp-zbf-form label{display:flex;flex-direction:column;font-size:11.5px;gap:2px}',
      '.dp-zbf-form input{font:inherit;padding:5px 7px;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:transparent;color:inherit;min-width:0}',
      '.dp-zbf-z{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:6px 0;border-top:1px solid rgba(128,128,128,.18)}',
      '.dp-zbf-z small{grid-column:1 / -1;color:#6B645A;font-size:11.5px}',
      '.dp-zbf-z select{font:inherit;font-size:11.5px}',
      '.dp-zbf summary{cursor:pointer;margin-top:6px;min-height:28px;display:flex;align-items:center}',
      '.dp-zbf-st-erreicht{color:#3FA56C;font-weight:600}.dp-zbf-st-verworfen{color:#B8625C}',
      '.dp-zbf-leiste{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:0 0 10px;font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '.dp-zbf-leiste select{font:inherit;padding:4px 6px;max-width:100%}',
      '.dp-zbf-tafel{width:100%;border-collapse:collapse;margin-top:6px;font-size:12.5px}',
      '.dp-zbf-tafel th,.dp-zbf-tafel td{padding:5px 8px;border-top:1px solid rgba(128,128,128,.18);text-align:right}',
      '.dp-zbf-tafel th:first-child,.dp-zbf-tafel td:first-child{text-align:left}'
    ].join('\n');
    d.head.appendChild(s);
  }
  function zeileHtml(f) {
    var e = f.ergebnis || {};
    var st = STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (f.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('');
    return '<div class="dp-zbf-z" data-zbf-id="' + esc(f.id) + '"><span><b>' + esc(f.titel || 'Zielbild') + '</b> · gültig '
      + (f.gueltig_ab ? 'ab ' + datumDe(f.gueltig_ab) + ' ' : '') + 'bis ' + datumDe(f.abgeloest_am) + '</span>'
      + '<select data-zbf-status="' + esc(f.id) + '" aria-label="Status der Fassung">' + st + '</select>'
      + '<small>Zielmiete ' + eur(e.miete_m_ziel) + ' je Monat' + (e.ziel_auto ? ' (teils Maximum bei Neuvermietung)' : '')
      + (e.kosten ? ' · Maßnahmen ' + eur(e.kosten) : '') + (e.ertragswert_ziel != null ? ' · Ertragswert ' + eur(e.ertragswert_ziel) : '')
      + (f.zieljahr ? ' · Zieljahr ' + f.zieljahr : '') + (f.grund ? ' · ' + esc(f.grund) : '') + (f.notiz ? ' · ' + esc(f.notiz) : '') + '</small></div>';
  }
  var _formOffen = false;
  function karteHtml() {
    var a = aktiv(), l = liste();
    var kopf = '<div class="dp-zbf-kopf"><span><b>Aktives Zielbild:</b> ' + esc(aktivTitel())
      + (a.gueltig_ab ? ' · gültig seit ' + datumDe(a.gueltig_ab) : '') + '</span>'
      + '<button type="button" class="btn btn-sm" data-zbf="neu" title="Das jetzige Zielbild als Fassung ablegen und ein neues festlegen">Neues Zielbild</button></div>';
    var form = !_formOffen ? '' : '<div class="dp-zbf-form-box"><p class="sec-desc" style="margin:8px 0 0;font-size:12px">Das jetzige Zielbild wird als Fassung abgelegt und bleibt lesbar. '
      + 'Die Felder bleiben stehen, du änderst sie für das neue Zielbild. Frühere Jahre messen weiter gegen die alte Fassung.</p>'
      + '<div class="dp-zbf-form"><label>Neues Zielbild gilt ab<input type="date" data-zbf-feld="datum" value="' + heuteIso() + '" max="' + heuteIso() + '"></label>'
      + '<label>Name des neuen Zielbilds<input type="text" data-zbf-feld="titel" placeholder="z. B. Zielbild 2029"></label>'
      + '<label>Notiz zur alten Fassung<input type="text" data-zbf-feld="notiz" placeholder="z. B. Umbau verschoben"></label></div>'
      + '<button type="button" class="btn btn-sm" data-zbf="ablegen">Ablegen und neues Zielbild beginnen</button> '
      + '<button type="button" class="btn btn-outline btn-sm" data-zbf="abbrechen">Abbrechen</button></div>';
    var fr = l.length ? '<details' + (l.length <= 2 ? ' open' : '') + '><summary>Frühere Fassungen (' + l.length + ')</summary>'
      + l.slice().reverse().map(zeileHtml).join('') + '</details>' : '';
    return kopf + form + fr;
  }
  function mount() {
    var karte = el('zb-karte'); if (!karte) return;
    var host = el('zb-fassungen-host');
    if (sollAnsicht()) { if (host) host.style.display = 'none'; return; }
    stil();
    if (!host) {
      host = doc().createElement('div'); host.id = 'zb-fassungen-host'; host.className = 'dp-zbf';
      var row = karte.querySelector('.ct-row');
      if (row && row.parentNode === karte) karte.insertBefore(host, row.nextSibling); else karte.insertBefore(host, karte.firstChild);
      host.addEventListener('click', klick);
      host.addEventListener('change', function (ev) {
        var s = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-zbf-status') : null;
        if (s) statusSetzen(s, ev.target.value);
      });
    }
    host.style.display = '';
    host.innerHTML = karteHtml();
  }
  function feld(host, k) { var i = host.querySelector('[data-zbf-feld="' + k + '"]'); return i ? String(i.value || '').trim() : ''; }
  function klick(ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-zbf]') : null; if (!b) return;
    ev.preventDefault();
    var host = el('zb-fassungen-host'), was = b.getAttribute('data-zbf');
    if (was === 'neu') { _formOffen = true; mount(); return; }
    if (was === 'abbrechen') { _formOffen = false; mount(); return; }
    if (was === 'ablegen') {
      var datum = feld(host, 'datum');
      if (!istDatum(datum) || datum > heuteIso()) datum = heuteIso();
      var f = ablegen({ datum: datum, titelNeu: feld(host, 'titel') || null, notiz: feld(host, 'notiz') || null, grund: 'neues Zielbild' });
      _formOffen = false;
      if (!f) {
        /* nichts abzulegen: nur den Kopf des neuen Zielbilds setzen */
        var d = D(); if (d) { d._zielbild_aktiv = { gueltig_ab: datum, titel: feld(host, 'titel') || null, angelegt_am: new Date().toISOString() }; speichern(); }
        if (typeof global.toast === 'function') global.toast('ℹ Noch kein eigenes Zielbild eingetragen. Das neue gilt ab ' + datumDe(datum) + '.');
      } else if (typeof global.toast === 'function') global.toast('✓ ' + f.titel + ' als Fassung abgelegt. Das neue Zielbild gilt ab ' + datumDe(datum) + '.');
      mount();
    }
  }

  /* ── Anzeige: Auswahl in der Pilot-Analyse (Ankauf · Bestand · Zielbild) ── */
  function leisteHtml() {
    var l = liste(); if (!l.length || sollAnsicht()) return '';
    stil();
    var opt = '<option value="">' + esc(aktivTitel()) + ' · aktiv</option>' + l.slice().reverse().map(function (f) {
      return '<option value="' + esc(f.id) + '">' + esc(f.titel || 'Zielbild') + ' · ' + esc((STATUS.filter(function (s) { return s[0] === f.status; })[0] || ['', f.status])[1]) + ' ' + monatDe(f.abgeloest_am) + '</option>';
    }).join('');
    return '<div class="dp-pa-card" data-dp-zbf-pilot="1" style="margin-bottom:12px"><div class="dp-zbf-leiste"><b>Zielbild</b>'
      + '<select data-dp-zbf-wahl="1" aria-label="Fassung des Zielbilds">' + opt + '</select>'
      + '<span style="color:#6B645A">' + esc(wechselSatz()) + '</span></div><div data-dp-zbf-vergleich="1"></div></div>';
  }
  function vergleichHtml(id) {
    var f = liste().filter(function (x) { return x && x.id === id; })[0];
    if (!f) return '';
    var e = f.ergebnis || {}, j = ergebnisJetzt();
    var z = function (w, a, b) { return '<tr><td>' + w + '</td><td>' + a + '</td><td>' + b + '</td></tr>'; };
    return '<p class="sec-desc" style="margin:4px 0 0;font-size:12px">Frühere Fassungen werden nur gelesen. Ihre Zahlen stammen vom Tag des Ablegens und werden nicht nachgerechnet.</p>'
      + '<table class="dp-zbf-tafel"><thead><tr><th></th><th>' + esc(f.titel || 'Fassung') + '<br><small>bis ' + datumDe(f.abgeloest_am) + '</small></th><th>' + esc(aktivTitel()) + '<br><small>aktiv</small></th></tr></thead><tbody>'
      + z('Kaltmiete heute je Monat', eur(e.miete_m_bestand), eur(j.miete_m_bestand))
      + z('Zielmiete je Monat', eur(e.miete_m_ziel), eur(j.miete_m_ziel))
      + z('Maßnahmen', eur(e.kosten), eur(j.kosten))
      + z('Ertragswert Zielbild', eur(e.ertragswert_ziel), eur(j.ertragswert_ziel))
      + z('Zieljahr', f.zieljahr || 'offen', wert('zb_fertig_jahr') || 'offen')
      + '</tbody></table>';
  }
  if (doc() && doc().addEventListener) {
    doc().addEventListener('change', function (ev) {
      var s = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-dp-zbf-wahl');
      if (!s) return;
      var box = ev.target.closest('[data-dp-zbf-pilot]'), v = box && box.querySelector('[data-dp-zbf-vergleich]');
      if (v) v.innerHTML = ev.target.value ? vergleichHtml(ev.target.value) : '';
    });
  }
  if (global.addEventListener) {
    global.addEventListener('dp:object-ready', function () { _formOffen = false; setTimeout(mount, 600); });
    global.addEventListener('dp:potenzial', function () { setTimeout(mount, 100); });
  }

  global.DpZielbildFassungen = {
    VERSION: VERSION, FELDER: FELDER, STATUS: STATUS,
    hatInhalt: hatInhalt, gueltigAm: gueltigAm, zielNkm: zielNkm, einordnen: einordnen, titelAus: titelAus,
    schnappschuss: schnappschuss, ergebnisJetzt: ergebnisJetzt, liste: liste, aktiv: aktiv, aktivTitel: aktivTitel,
    ablegen: ablegen, statusSetzen: statusSetzen, gueltig: gueltig, wechselSatz: wechselSatz,
    mount: mount, karteHtml: karteHtml, leisteHtml: leisteHtml, vergleichHtml: vergleichHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
