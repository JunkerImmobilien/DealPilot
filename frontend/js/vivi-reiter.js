/* ═══ js/vivi-reiter.js — v4040 · REITER „ViVi“ IN DER PILOT-ANALYSE ══════════════════════════════════════════════
 *
 * Marcel 23.11.2026: „Vielleicht machen wir dann in der Pilotanalyse einen Extra-Reiter ViVi … den Abgleich für alle Jahre
 * fahren … gegenüberstellen mit unseren Ist-Werten … Mietpotenziale … für alle Wohnungen … auslösen … woraus wir was
 * übernehmen und welche Belege dahinter stecken … möglichst einfach, wenig Text, ein einfacher Flow, eine Gegenüberstellung“
 * und „wieder so ein Häuschen abbilden“.
 *
 * Rechnet NICHTS selbst. Es zeigt nur zusammen, was die vorhandenen Kerne schon liefern:
 *   · Steuerjahr gegen ViVi ............ DpViviSteuer.abgleich(jahr) / .uebernehmen(jahr, zeilen) (vivi-steuer-abgleich.js)
 *   · Miete im Jahr (Reiter Miete) ..... DpJahresbuch.zeilen() gegen DpJahresabgleich.viviJahr(jahr)
 *   · Festschreiben .................... DpJahresbuch.festSetzen(jahr, ['miete','steuer'], true)
 *   · Belege in DealPilot .............. DpEingang.lesen().buchungen, öffnen über DpEingang.jahresAnsicht(jahr)
 *   · Wohnungen und Potenzial .......... DpMieteDemo.daten() (dasselbe Modell wie der Reiter Miete)
 *   · Mieterhöhung nach ViVi ........... DpViviMieterhoehung.oeffnen() (eine Funktion für alle Stellen)
 *   · Ist heute, eigene Angaben ........ DpViviFelder.lesen() / .viviUebernehmen(id)
 * Sichtbar nur bei einem mit ViVi verknüpften Objekt und nicht für Einsteiger. Kundentext nur mit Punkt und Komma.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var VERSION = 'v4040h';
  if (!global.document || global.DpViviReiter) return;
  var doc = global.document;
  var _jahr = null, _offen = {};

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function zahl(v) { if (istZahl(v)) return v; if (v == null || v === '') return null; var t = String(v).trim(); if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.'); var n = parseFloat(t); return isFinite(n) ? n : null; }
  function eur(v) { if (!istZahl(v)) return '–'; var c = Math.abs(v - Math.round(v)) >= 0.005; return v.toLocaleString('de-DE', { minimumFractionDigits: c ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
  function vz(v) { return istZahl(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + eur(Math.abs(v)) : ''; }
  function datumText(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function heuteJahr() { return new Date().getFullYear(); }
  function meldung(t) { try { if (global.toast) global.toast(t); } catch (e) {} }
  function einsteiger() { try { return !!(global.DpDetailgrad && global.DpDetailgrad.stufe() === 1); } catch (e) { return false; } }
  function felder() { try { return global.DpViviFelder && global.DpViviFelder.lesen ? global.DpViviFelder.lesen() : null; } catch (e) { return null; } }
  function vstand() { try { return global.DpVivi && global.DpVivi.stand ? global.DpVivi.stand() : null; } catch (e) { return null; } }
  function speichern() { try { if (global.DpSpeichernFolge) global.DpSpeichernFolge(); else if (typeof global.saveObj === 'function') global.saveObj({ silent: true }); } catch (e) {} }

  /* Vorschau-Funktion 'vivi' (claude/vorschau-funktionen.md): wie vivi-mieterhoehung.js einmal geladen, synchron gelesen */
  var _frei = null;
  try { if (global.DpVorschau && typeof global.DpVorschau.frei === 'function') global.DpVorschau.frei('vivi').then(function (v) { _frei = !!v; }).catch(function () { _frei = false; }); } catch (e) {}
  function vorschauFrei() { try { if (_frei === false) return false; var V = global.DpVorschau; return !(V && typeof V.istFrei === 'function' && V.istFrei('vivi') === false); } catch (e) { return false; } }
  /** Reiter zeigen? Verknüpft (gespeicherter Stand im Objekt), Vorschau frei und nicht Einsteiger. */
  function sichtbar() { var v = felder(); return !!(v && v.verknuepft) && vorschauFrei() && !einsteiger(); }

  /* ── Jahre ──────────────────────────────────────────────────────── */
  function startJahr() {
    try { var A = global.DealPilotAnkauf, a = A && A.vorhanden && A.vorhanden() ? A.stand() : null, m = a && /^(\d{4})/.exec(String(a.stichtag || '')); if (m) return +m[1]; } catch (e) {}
    var u = ($('wirtschaftlicher_uebergang') || {}).value || ($('kaufdat') || {}).value || '';
    var m2 = /(\d{4})/.exec(u); return m2 ? +m2[1] : heuteJahr();
  }
  function jahre() {
    var J = [], s = startJahr(), h = heuteJahr();
    for (var j = Math.max(2000, s); j <= h; j++) J.push(j);
    try { (global.DpViviSteuer && global.DpViviSteuer.jahre ? global.DpViviSteuer.jahre() : []).forEach(function (j) { if (J.indexOf(j) < 0) J.push(j); }); } catch (e) {}
    return J.sort();
  }

  /* ── Belege einer Zeile: ViVi und DealPilot nebeneinander ───────── */
  function gleicherPosten(p, b) {
    var K = global.DpViviSteuer && global.DpViviSteuer.kern;
    return K && K.gleicherPosten ? K.gleicherPosten(p, b) : false;
  }
  function belege(jahr, z) {
    var st = vstand(), w = st && st.steuer && st.steuer[jahr] ? st.steuer[jahr][z.spalte] : null;
    var posten = w && Array.isArray(w.posten) ? w.posten : [];
    var E = null; try { E = global.DpEingang && global.DpEingang.lesen ? global.DpEingang.lesen() : null; } catch (e) { E = null; }
    var dp = ((E && E.buchungen) || []).filter(function (b) { return b && +b.jahr === +jahr && b.feld === z.spalte; });
    var out = [], frei = dp.slice();
    posten.forEach(function (p) {
      var i = -1; frei.some(function (b, k) { if (gleicherPosten(p, b)) { i = k; return true; } return false; });
      out.push({ art: i >= 0 ? 'beide' : 'vivi', datum: p.datum, betrag: p.betrag, text: p.text || 'Beleg' });
      if (i >= 0) frei.splice(i, 1);
    });
    frei.forEach(function (b) {
      if (String(b.quelle || '') === 'ViVi') return;   /* aus ViVi übernommen, steht oben schon */
      out.push({ art: 'dp', datum: String(b.datum || '').slice(0, 10), betrag: Math.abs(zahl(b.betrag) || 0), text: b.position || b.kategorie || b.datei || 'Beleg', datei: b.datei || '', aussteller: b.aussteller || '' });
    });
    return out;
  }
  var ART = { beide: ['in beiden', 'vr-t-ok'], vivi: ['nur in ViVi', 'vr-t-vi'], dp: ['nur in DealPilot', 'vr-t-dp'] };
  function belegeHtml(jahr, L) {
    if (!L.length) return '';
    var nurDp = L.filter(function (x) { return x.art === 'dp'; }).length;
    return '<ul class="vr-belege">' + L.map(function (x) {
      return '<li><span class="vr-tag ' + ART[x.art][1] + '">' + ART[x.art][0] + '</span><span class="vr-bt">' + (datumText(x.datum) ? esc(datumText(x.datum)) + ' · ' : '') + esc(x.text) + (x.aussteller ? ' · ' + esc(x.aussteller) : '') + '</span><b>' + eur(x.betrag) + '</b>'
        + (x.art === 'dp' ? '<button type="button" class="btn-clean vr-link" data-vr="beleg" data-vr-jahr="' + jahr + '">öffnen</button>' : '') + '</li>';
    }).join('') + '</ul>' + (nurDp ? '<p class="vr-klein">Belege nur in DealPilot stehen schon im Steuerjahr. In ViVi bitte nachbuchen, die Schnittstelle kann keine Belege anlegen.</p>' : '');
  }

  /* ── Abgleich eines Jahres ──────────────────────────────────────── */
  function zinsAmpel(z) {
    if (!istZahl(z.vivi) || !istZahl(z.dp) || !(z.vivi > 0)) return '';
    var q = Math.abs(z.vivi - z.dp) / z.vivi;
    var c = q < 0.01 ? 'gr' : q < 0.05 ? 'ge' : 'ro';
    return '<i class="vr-ampel vr-' + c + '" title="' + (q < 0.01 ? 'unter 1 % Abweichung' : q < 0.05 ? 'unter 5 % Abweichung' : 'mehr als 5 % Abweichung') + '"></i>';
  }
  function statusHtml(z) {
    if (z.aktion === 'gleich') return '<span class="vr-ok">✓ gleich</span>';
    if (z.aktion === 'laufend') return '<span class="vr-grau">' + (istZahl(z.abwBisHeute) ? vz(z.abwBisHeute) + ' bis heute' : 'läuft') + '</span>';
    if (z.aktion === 'zusatz') return '<span class="vr-grau">' + vz(z.abw) + '</span>';
    if (z.aktion === 'vergleich') return '<span class="vr-grau">' + vz(z.abw) + '</span>';
    if (z.aktion === 'ausserhalb' || z.aktion === 'ohne_posten') return '<span class="vr-grau">' + (istZahl(z.abw) ? vz(z.abw) : 'offen') + '</span>';
    /* Belegzeilen: ViVi-Belege kommen DAZU (Kern: addieren), die Zahl ist die Summe der neuen Belege, nicht die Differenz */
    if (z.modus === 'addieren') return '<span class="vr-ab">' + z.neu.length + ' neu</span><small>' + vz(z.abw) + (z.ersetztSchaetzung ? ', ersetzt die Schätzung' : '') + '</small>';
    return '<span class="vr-ab">' + vz(z.abw) + '</span>';
  }
  function mieteZeile(jahr) {
    var JB = global.DpJahresbuch, JA = global.DpJahresabgleich;
    if (!JB || !JB.zeilen || !JA || !JA.viviJahr) return '';
    var z = null; try { z = JB.zeilen().filter(function (x) { return +x.jahr === +jahr; })[0] || null; } catch (e) { z = null; }
    var vd = null; try { vd = viviDaten(); } catch (e) { vd = null; }
    var vj = vd ? JA.viviJahr(jahr, vd) : null;
    if (!z || !vj || !istZahl(vj.miete)) return '';
    var d = istZahl(z.miete_ist) ? z.miete_ist - vj.miete : null;
    var st = d == null ? '<span class="vr-grau">kein Ist</span>' : Math.abs(d) < 1 ? '<span class="vr-ok">✓ gleich</span>' : '<span class="vr-ab">' + vz(-d) + '</span>';
    var her = JB.istHerkunft ? ({ eigen: 'eingetragen', vivi: 'aus ViVi' })[JB.istHerkunft(jahr)] || 'gerechnet' : '';
    return '<tr><td><b>Miete im Jahr</b><small>Reiter Miete' + (her ? ', ' + esc(her) : '') + '</small></td><td>' + eur(z.miete_ist) + '</td><td>' + eur(vj.miete) + '</td><td>' + st + '</td><td></td></tr>';
  }
  function viviDaten() {
    /* dieselbe Quelle wie der Jahresabgleich (jahresabgleich.js viviDaten), dort nicht exportiert: hier nachgebildet über
       die exportierten Bausteine, damit der Reiter nicht von der Reihenfolge des Jahresabgleichs abhängt */
    var F = global.DpViviFelder, v = felder(); if (!v || !v.verknuepft || !v.felder) return null;
    var st = vstand(), E = global.DpErhoehungen, M = global._dpMfh, quellen = [];
    var nurVivi = function (l) { return (Array.isArray(l) ? l : []).filter(function (x) { return x && /^vivi-/.test(String(x.id || '')); }); };
    if (M && Array.isArray(M.einheiten) && M.einheiten.length) {
      M.einheiten.forEach(function (e, i) { var id = F.einheitFeld ? F.einheitFeld(i, 'ist') : null, h = id ? zahl(v.felder[id]) : null; if (h != null) quellen.push({ liste: nurVivi(e && e.erhoehungen), heute: h }); });
    } else if (zahl(v.felder.nkm) != null) quellen.push({ liste: nurVivi(E && E.objektListe ? E.objektListe() : []), heute: zahl(v.felder.nkm) });
    return { stand: v.stand || (st && st.letzter_abruf) || null, quellen: quellen, info: (st && st.info) || null };
  }
  function restschuldZeile(jahr) {
    if (jahr !== heuteJahr()) return '';
    var st = vstand(), rs = st && st.info && st.info.restschuld_heute;
    if (!rs || !istZahl(zahl(rs.wert))) return '';
    var z = null; try { z = global.DpJahresbuch.zeilen().filter(function (x) { return +x.jahr === +jahr; })[0]; } catch (e) { z = null; }
    var dp = z && istZahl(z.rs_proj) ? z.rs_proj : null, d = dp == null ? null : dp - zahl(rs.wert);
    return '<tr><td><b>Restschuld heute</b><small>Projektion gegen Tilgungsplan in ViVi</small></td><td>' + eur(dp) + '</td><td>' + eur(zahl(rs.wert)) + '</td><td>'
      + (d == null ? '' : Math.abs(d) < 50 ? '<span class="vr-ok">✓ gleich</span>' : '<span class="vr-ab">' + vz(-d) + '</span>') + '</td><td></td></tr>';
  }
  var _letzte = {};
  function abgleichJahr(jahr) {
    var S = global.DpViviSteuer, a = S && S.abgleich ? S.abgleich(jahr) : { zeilen: [], offen: 0 };
    /* Mieteinnahmen: ViVi kennt nicht alle Zusatzeinnahmen (Stellplatz, Garage, Sonstiges aus dem Reiter Miete). Ist die
       Abweichung genau ein Vielfaches davon, wäre „übernehmen“ falsch (gemessen 2026-1052: 12 × 90 €). Dann kein Knopf. */
    var ze = zahl(($('ze') || {}).value) || 0;
    a.zeilen.forEach(function (z) {
      if (z.spalte !== 'einnahmen_km' || z.aktion !== 'uebernehmen' || !(ze > 0) || !istZahl(z.abw)) return;
      for (var m = 1; m <= 12; m++) if (Math.abs(z.abw + ze * m) < 1) { z.aktion = 'zusatz'; z.grund = 'Der Unterschied sind ' + m + ' × ' + eur(ze) + ' Zusatzeinnahmen aus dem Reiter Miete, die ViVi nicht führt. DealPilot bleibt.'; a.offen = Math.max(0, a.offen - 1); break; }
    });
    return a;
  }
  function jahrHtml(jahr) {
    var a = abgleichJahr(jahr);
    _letzte[jahr] = a;
    var rows = mieteZeile(jahr);
    a.zeilen.forEach(function (z, i) {
      if (z.spalte === 'afa') return;   /* AfA rechnet DealPilot selbst, steht im Jahresabgleich zum Vergleich */
      var L = belege(jahr, z), key = jahr + '|' + z.spalte, auf = !!_offen[key];
      var kn = z.aktion === 'uebernehmen' && !a.gesperrt ? '<button type="button" class="btn-clean vr-k" data-vr="eins" data-vr-jahr="' + jahr + '" data-vr-i="' + i + '">übernehmen</button>' : '';
      var unter = (z.aktion === 'laufend' || z.aktion === 'ausserhalb' || z.aktion === 'ohne_posten' || z.aktion === 'zusatz') && z.grund ? '<small>' + esc(z.grund) + '</small>' : '';
      if (z.unvollstaendig) unter += '<small>' + esc(z.unvollstaendig) + '</small>';
      rows += '<tr class="vr-z' + (L.length ? ' vr-auf' : '') + '"' + (L.length ? ' data-vr="belege" data-vr-key="' + esc(key) + '"' : '') + '><td><b>' + esc(z.label) + '</b>'
        + (z.spalte === 'schuldzinsen' ? zinsAmpel(z) : '') + (L.length ? '<span class="vr-n">' + L.length + ' Beleg' + (L.length === 1 ? '' : 'e') + (auf ? ' ▴' : ' ▾') + '</span>' : '') + unter + '</td>'
        + '<td>' + (istZahl(z.dp) ? eur(z.dp) + (z.dpEigen ? '' : '<small>gerechnet</small>') : '–') + '</td><td>' + eur(z.vivi) + '</td><td>' + statusHtml(z) + '</td><td>' + kn + '</td></tr>';
      if (L.length && auf) rows += '<tr class="vr-bz"><td colspan="5">' + belegeHtml(jahr, L) + '</td></tr>';
    });
    rows += restschuldZeile(jahr);
    var JB = global.DpJahresbuch, fest = JB && JB.fest ? JB.fest(jahr) : {}, istFest = !!(fest.miete && fest.steuer);
    var fuss = '<div class="vr-fuss">';
    if (a.offen > 0 && !a.gesperrt) fuss += '<button type="button" class="btn-clean vr-k gold" data-vr="alle" data-vr-jahr="' + jahr + '">Alles übernehmen (' + a.offen + ')</button>';
    if (jahr < heuteJahr()) fuss += istFest ? '<span class="vr-fest">' + jahr + ' festgeschrieben</span>' : '<button type="button" class="btn-clean vr-k" data-vr="fest" data-vr-jahr="' + jahr + '">Jahr ' + jahr + ' festschreiben</button>';
    fuss += '</div>';
    var satz = a.gesperrt ? 'Das Steuerjahr ' + jahr + ' ist festgeschrieben oder erklärt. Abweichungen werden nur gezeigt.'
      : jahr >= heuteJahr() ? 'Das Jahr läuft. ViVi zeigt die Buchungen bis heute, übernommen wird nach dem Jahresende.'
      : a.offen ? a.offen + ' Wert' + (a.offen === 1 ? '' : 'e') + ' aus ViVi noch nicht in DealPilot.' : 'Alles passt zu ViVi.';
    return '<p class="vr-satz">' + esc(satz) + '</p>'
      + (rows ? '<div class="vr-tab-w"><table class="vr-tab"><thead><tr><th>Posten</th><th>DealPilot</th><th>ViVi</th><th>Abgleich</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="vr-klein">Für ' + jahr + ' liegen aus ViVi noch keine Werte vor. „Jetzt abgleichen“ holt sie.</p>') + fuss;
  }

  /* ── Wohnungen als Häuschen ─────────────────────────────────────── */
  function wohnungen() {
    var D = null; try { D = global.DpMieteDemo && global.DpMieteDemo.daten ? global.DpMieteDemo.daten() : null; } catch (e) { D = null; }
    if (!D || !D.W || !D.W.length) return null;
    var F = global.DpViviFelder, v = felder() || {}, eigen = v.eigen || {};
    D.W.forEach(function (w) {
      var id = D.mfh ? (F && F.einheitFeld ? F.einheitFeld(w.i, 'ist') : null) : 'nkm';
      w.viviId = id;
      w.vivi = id && v.felder ? zahl(v.felder[id]) : null;
      w.eigen = !!(id && Object.prototype.hasOwnProperty.call(eigen, id));
      w.abw = istZahl(w.vivi) ? Math.round((w.ist - w.vivi) * 100) / 100 : null;
      w.pot = w.soll >= w.ist + 1 ? Math.round(w.soll - w.ist) : 0;
    });
    return D;
  }
  function hausHtml() {
    var D = wohnungen(); if (!D) return '';
    var V = global.DpViviMieterhoehung, mh = !!(V && V.verfuegbar && V.verfuegbar());
    /* Geschosse wie das Haus im Reiter Miete (DpMieteDemo.geschoss): oben DG, unten Keller, ohne Geschoss zu dritt unten */
    var E = (global._dpMfh && Array.isArray(global._dpMfh.einheiten)) ? global._dpMfh.einheiten : [], G = global.DpMieteDemo && global.DpMieteDemo.geschoss;
    var gruppen = {}, ohne = [], reihen = [];
    D.W.forEach(function (x) { var e = E[x.i] || {}, g = G ? G(String(e.etage || '') + ' ' + String(x.lage || '')) : null; if (!g) ohne.push(x); else (gruppen[g.r] = gruppen[g.r] || { r: g.r, L: [] }).L.push(x); });
    Object.keys(gruppen).map(function (k) { return gruppen[k]; }).sort(function (a, b) { return b.r - a.r; }).forEach(function (g) { for (var i = 0; i < g.L.length; i += 4) reihen.push(g.L.slice(i, i + 4)); });
    for (var j = 0; j < ohne.length; j += 3) reihen.push(ohne.slice(j, j + 3));
    var kachel = function (w) {
      var abw = istZahl(w.abw) && Math.abs(w.abw) >= 1;
      var leer = !(w.ist > 0) && !(w.vivi > 0);
      var cls = abw ? 'vr-w-ab' : leer ? 'vr-w-leer' : w.pot ? 'vr-w-pot' : 'vr-w-ok';
      var marke = abw ? 'ABWEICHUNG' : leer ? 'LEER' : w.pot ? 'POTENZIAL' : 'PASST';
      return '<div class="vr-w ' + cls + '"><span class="vr-wm">' + marke + '</span><b>' + (D.mfh ? 'Wohnung ' + esc(w.nr) : 'Wohnung') + '</b>'
        + '<div class="vr-wz"><span>DealPilot</span><span>' + (w.ist ? eur(w.ist) : 'leer') + '</span></div>'
        + '<div class="vr-wz"><span>ViVi</span><span>' + (istZahl(w.vivi) ? eur(w.vivi) : '–') + '</span></div>'
        + (w.pot ? '<div class="vr-wz vr-wp"><span>möglich</span><span>' + eur(w.soll) + ' (+' + eur(w.pot) + ')</span></div>' : '')
        + '<div class="vr-wk">' + (abw && w.eigen ? '<button type="button" class="btn-clean vr-k" data-vr="w-vivi" data-vr-id="' + esc(w.viviId) + '">ViVi übernehmen</button>' : '')
        + (mh && w.ist > 0 ? '<button type="button" class="btn-clean vr-k' + (w.pot ? ' gold' : '') + '" data-vr="w-mh" data-vr-e="' + (D.mfh ? w.i : 'objekt') + '">Mieterhöhung in ViVi</button>' : '') + '</div></div>';
    };
    var pot = D.W.reduce(function (s, w) { return s + w.pot; }, 0), nAb = D.W.filter(function (w) { return istZahl(w.abw) && Math.abs(w.abw) >= 1; }).length;
    return '<h4 class="vr-h">' + (D.mfh ? 'Wohnungen' : 'Die Wohnung') + '</h4><p class="vr-satz">'
      + (nAb ? nAb + (nAb === 1 ? ' Wohnung weicht' : ' Wohnungen weichen') + ' von ViVi ab. ' : 'Mieten wie in ViVi. ')
      + (pot ? 'Mögliche Mieterhöhung zusammen ' + eur(pot) + ' im Monat.' : 'Kein Spielraum für eine Mieterhöhung.') + '</p>'
      + '<div class="vr-haus"><div class="vr-dach"></div>' + reihen.map(function (r) { return '<div class="vr-etage" style="grid-template-columns:repeat(' + r.length + ',minmax(0,1fr))">' + r.map(kachel).join('') + '</div>'; }).join('') + '<div class="vr-boden"></div></div>';
  }

  /* ── Ist heute: eigene Angaben gegen ViVi ───────────────────────── */
  function feldName(id) {
    var el = $(id), f = el && el.closest ? el.closest('.f') : null, l = f ? f.querySelector('label') : null;
    var t = l ? l.childNodes[0] && l.childNodes[0].nodeType === 3 ? l.childNodes[0].textContent : l.textContent : id;
    return String(t || id).replace(/\s+/g, ' ').trim();
  }
  function istHeuteHtml() {
    var v = felder(); if (!v || !v.felder) return '';
    var F = global.DpViviFelder, ids = Object.keys(v.felder).filter(function (id) { return !/^einheit\./.test(id) && !/^_/.test(id); });
    var eigen = v.eigen || {}, ab = [];
    ids.forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(eigen, id)) return;
      if (F && F.gleichDok && F.gleichDok(v.felder[id], eigen[id])) return;
      ab.push(id);
    });
    var bw = ['hg_ul', 'hg_nul', 'grundsteuer'].filter(function (id) { return v.felder[id] != null; });
    var st = vstand(), q = function (id) { var x = st && st.felder && st.felder[id]; return x && x.quelle ? String(x.quelle).replace('tax-overview', 'Steuerjahr') : ''; };
    var out = '<h4 class="vr-h">Ist heute</h4><p class="vr-satz">' + ids.length + ' Werte kommen aus ViVi und gelten im Ist heute in allen Reitern'
      + (ab.length ? ', ' + ab.length + ' davon legst du selbst anders fest.' : '.') + '</p>';
    if (bw.length) out += '<div class="vr-bw">' + bw.map(function (id) {
      return '<div><span>' + esc(feldName(id)) + '</span><b>' + eur(zahl(v.felder[id])) + '</b><small>' + esc(q(id) || 'aus ViVi') + (Object.prototype.hasOwnProperty.call(eigen, id) ? ', eigene Angabe ' + eur(zahl(eigen[id])) : '') + '</small></div>';
    }).join('') + '</div>';
    if (ab.length) out += '<div class="vr-tab-w"><table class="vr-tab"><thead><tr><th>Feld</th><th>DealPilot</th><th>ViVi</th><th></th></tr></thead><tbody>' + ab.map(function (id) {
      return '<tr><td><b>' + esc(feldName(id)) + '</b></td><td>' + esc(String(eigen[id])) + '</td><td>' + esc(String(v.felder[id])) + '</td><td><button type="button" class="btn-clean vr-k" data-vr="f-vivi" data-vr-id="' + esc(id) + '">ViVi übernehmen</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    return out;
  }

  /* ── Ganzer Reiter ──────────────────────────────────────────────── */
  function html() {
    if (!sichtbar()) return '';
    var st = vstand();
    var J = jahre(), h = heuteJahr();
    if (_jahr == null || J.indexOf(_jahr) < 0) _jahr = J.indexOf(h - 1) >= 0 ? h - 1 : J[J.length - 1];
    var S = global.DpViviSteuer;
    var pills = J.map(function (j) {
      var n = 0; try { n = abgleichJahr(j).offen; } catch (e) { n = 0; }
      return '<button type="button" class="btn-clean" data-vr="jahr" data-vr-jahr="' + j + '" aria-pressed="' + (j === _jahr) + '">' + j + (n ? '<i>' + n + '</i>' : '') + '</button>';
    }).join('');
    var kopf = '<div class="vr-kopf"><span class="vr-marke">ViVi</span><b>Abgleich mit ViVi</b><span class="vr-stand">' + (st && st.letzter_abruf ? 'Stand ' + esc(datumText(String(st.letzter_abruf).slice(0, 10))) : (st ? '' : 'lädt…')) + '</span>'
      + '<button type="button" class="btn-clean vr-k" data-vr="abgleichen">Jetzt abgleichen</button></div>';
    if (!st) return '<div class="vr">' + kopf + '<p class="vr-klein">Der Stand aus ViVi wird geladen.</p></div>';
    return '<div class="vr">' + kopf
      + '<div class="vr-jahre" role="group" aria-label="Jahr">' + pills + '</div>'
      + jahrHtml(_jahr)
      + hausHtml()
      + istHeuteHtml()
      + '</div>';
  }
  function mountAll() {
    stil();
    Array.prototype.forEach.call(doc.querySelectorAll('[data-dp-vivi-host]'), function (h) { try { h.innerHTML = html(); } catch (e) { try { console.warn('[vivi-reiter]', e); } catch (x) {} } });
  }

  /** Von der Deal-Aktion und der ViVi-Leiste: Pilot-Analyse › ViVi, sonst als Fenster. */
  function oeffnen() {
    var b = $('dp-pa-tab-vivi') || doc.querySelector('.dp-pa-tab[onclick*="\'vivi\'"]');
    var p = $('dp-pa-vivi');
    if (b && p) {
      var t = Array.prototype.filter.call(doc.querySelectorAll('nav.tabs .tab'), function (x) { return /Pilot/.test(x.textContent || ''); })[0];
      if (t) t.click();
      setTimeout(function () { try { global._dpPaTab('vivi', b); p.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} }, 120);
      return true;
    }
    stil();
    var alt = $('vr-fenster'); if (alt) alt.remove();
    var ov = doc.createElement('div'); ov.id = 'vr-fenster';
    ov.innerHTML = '<div class="vr-ov-box"><button type="button" class="btn-clean vr-ov-zu" data-vr="zu" aria-label="Schließen">×</button><div data-dp-vivi-host="1"></div></div>';
    doc.body.appendChild(ov);
    mountAll();
    return true;
  }

  /* ── Klicks ─────────────────────────────────────────────────────── */
  doc.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-vr]') : null;
    if (!b || !b.closest('[data-dp-vivi-host], #vr-fenster')) return;
    var was = b.getAttribute('data-vr'), j = Number(b.getAttribute('data-vr-jahr'));
    if (was === 'belege' && ev.target.closest('button')) return;
    ev.preventDefault();
    if (was === 'zu') { var o = $('vr-fenster'); if (o) o.remove(); return; }
    if (was === 'jahr') { _jahr = j; mountAll(); return; }
    if (was === 'belege') { var k = b.getAttribute('data-vr-key'); _offen[k] = !_offen[k]; mountAll(); return; }
    if (was === 'abgleichen') { try { global.DpVivi.abgleichen(false); } catch (e) {} return; }
    if (was === 'beleg') { try { global.DpEingang.jahresAnsicht(j); } catch (e) {} return; }
    var S = global.DpViviSteuer;
    if (was === 'eins' || was === 'alle') {
      var a = _letzte[j] || abgleichJahr(j); if (!a || !S) return;
      var zeilen = was === 'alle' ? a.zeilen.filter(function (z) { return z.spalte !== 'afa'; }) : [a.zeilen[Number(b.getAttribute('data-vr-i'))]];
      var n = S.uebernehmen(j, zeilen, false);
      if (n) meldung(n + ' Wert' + (n === 1 ? '' : 'e') + ' aus ViVi in das Steuerjahr ' + j + ' übernommen');
      setTimeout(mountAll, 150);
      return;
    }
    if (was === 'fest') {
      var JB = global.DpJahresbuch; if (!JB || !JB.festSetzen) return;
      if (!global.confirm('Miete und Steuer ' + j + ' festschreiben? Danach ändert ViVi dieses Jahr nicht mehr. Freigeben geht im Jahresabgleich.')) return;
      if (JB.festSetzen(j, ['miete', 'steuer'], true)) { meldung(j + ' festgeschrieben'); speichern(); }
      setTimeout(mountAll, 150);
      return;
    }
    if (was === 'w-vivi' || was === 'f-vivi') {
      var F = global.DpViviFelder, id = b.getAttribute('data-vr-id');
      if (F && F.viviUebernehmen && F.viviUebernehmen(id)) { meldung('Wert aus ViVi übernommen'); speichern(); }
      setTimeout(mountAll, 150);
      return;
    }
    if (was === 'w-mh') {
      var e = b.getAttribute('data-vr-e');
      try { global.DpViviMieterhoehung.oeffnen({ einheit: e === 'objekt' ? null : e, quelle: 'Pilot-Analyse ViVi' }); } catch (x) {}
    }
  });
  global.addEventListener('dp:vivi-stand', function () { setTimeout(mountAll, 700); });
  global.addEventListener('dp:object-ready', function () { _jahr = null; _offen = {}; _letzte = {}; var o = $('vr-fenster'); if (o) o.remove(); });

  /* ── Stil ───────────────────────────────────────────────────────── */
  function stil() {
    if ($('vr-stil')) return;
    var s = doc.createElement('style'); s.id = 'vr-stil';
    s.textContent = [
      '.vr{font:400 12.5px/1.45 Inter,system-ui,sans-serif;color:#2A2727}',
      '.vr-kopf{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:0 0 10px}.vr-kopf b{font:600 16px/1.3 "Space Grotesk",Inter,sans-serif}.vr-kopf .vr-k{margin-left:auto}',
      '.vr-marke{font:600 10px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border:1px solid var(--wl-c9a84c,#C9A84C);border-radius:4px;color:var(--wl-b8932f,#b8932f)}',
      '.vr-stand{font:500 10.5px "JetBrains Mono",ui-monospace,monospace;color:#7A7370}',
      '.vr-jahre{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.vr-jahre button{border:1px solid rgba(42,39,39,.18)!important;background:#fff!important;border-radius:14px;padding:4px 12px;font:500 12px Inter,sans-serif;cursor:pointer;color:inherit;min-height:30px}',
      '.vr-jahre button[aria-pressed="true"]{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f))!important;border-color:transparent!important;color:#1a1712;font-weight:600}',
      '.vr-jahre button i{font-style:normal;color:#B8625C;margin-left:5px;font-weight:700}',
      '.vr-satz{color:#5E5856;margin:0 0 8px}.vr-klein{color:#7A7370;font-size:11.5px;margin:6px 0}',
      '.vr-h{font:600 14px "Space Grotesk",Inter,sans-serif;margin:20px 0 4px}',
      '.vr-tab-w{overflow-x:auto}.vr-tab{width:100%;border-collapse:collapse;background:#fff}',
      '.vr-tab th{font:600 9.5px/1.2 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370;text-align:right;padding:6px;border-bottom:1px solid rgba(42,39,39,.12)}',
      '.vr-tab th:first-child,.vr-tab td:first-child{text-align:left}',
      '.vr-tab td{padding:7px 6px;border-bottom:1px solid rgba(42,39,39,.07);text-align:right;vertical-align:top;font-variant-numeric:tabular-nums}',
      '.vr-tab td small{display:block;color:#7A7370;font-size:11px;text-align:inherit}',
      '.vr-auf{cursor:pointer}.vr-auf:hover td{background:#FBF6E9}',
      '.vr-n{font:500 10.5px Inter,sans-serif;color:var(--wl-b8932f,#b8932f);margin-left:6px;white-space:nowrap}',
      '.vr-ok{color:#3FA56C;font-weight:600}.vr-ab{color:#B8625C;font-weight:600}.vr-grau{color:#7A7370}',
      '.vr-ampel{display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:6px;vertical-align:0}.vr-gr{background:#3FA56C}.vr-ge{background:var(--wl-c9a84c,#C9A84C)}.vr-ro{background:#B8625C}',
      '.vr-bz td{background:#FDFCFA;text-align:left}',
      '.vr-belege{list-style:none;margin:0;padding:0}.vr-belege li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:3px 0;font-size:12px}',
      '.vr-belege .vr-bt{flex:1 1 200px;color:#5E5856}.vr-belege b{font-variant-numeric:tabular-nums}',
      '.vr-tag{font:600 9px/1.4 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:4px;white-space:nowrap}',
      '.vr-t-ok{background:rgba(63,165,108,.12);color:#2f7d52}.vr-t-vi{background:rgba(201,168,76,.16);color:var(--wl-b8932f,#b8932f)}.vr-t-dp{background:rgba(42,39,39,.08);color:#2A2727}',
      '.vr-link{border:0!important;background:none!important;color:var(--wl-b8932f,#b8932f);text-decoration:underline;cursor:pointer;font:inherit;padding:0}',
      '.vr-k{font:600 11.5px/1.2 Inter,sans-serif;padding:6px 10px;min-height:32px;border-radius:7px;border:1px solid var(--wl-c9a84c,#C9A84C)!important;background:#fff!important;color:#2A2727!important;cursor:pointer;white-space:nowrap}',
      '.vr-k.gold{background:var(--wl-c9a84c,#C9A84C)!important;color:#050505!important}',
      '.vr-fuss{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.vr-fest{font:600 11px "JetBrains Mono",monospace;color:#3FA56C;letter-spacing:.04em}',
      '.vr-haus{display:grid;gap:6px;margin-top:6px;max-width:720px}',
      '.vr-dach{height:28px;background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));clip-path:polygon(6% 100%,50% 0,94% 100%);opacity:.9}',
      '.vr-etage{display:grid;gap:6px}.vr-boden{height:7px;border-radius:4px;background:#E6E0D3}',
      '.vr-w{border:1.5px solid #E6E0D3;background:#fff;border-radius:3px;padding:8px 9px;min-width:0}',
      '.vr-w b{display:block;font:600 12.5px "Space Grotesk",sans-serif;margin:2px 0 4px}',
      '.vr-wm{display:inline-block;font:700 8.5px "JetBrains Mono",monospace;letter-spacing:.08em;padding:2px 6px;border-radius:2px}',
      '.vr-wz{display:flex;justify-content:space-between;gap:6px;font-size:11.5px;color:#5E5856}.vr-wz span:last-child{font-variant-numeric:tabular-nums;color:#2A2727;font-weight:600}',
      '.vr-wp span:last-child{color:#3FA56C}',
      '.vr-wk{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.vr-wk .vr-k{padding:5px 8px;font-size:11px}',
      '.vr-w-ok{box-shadow:inset 3px 0 0 #3FA56C}.vr-w-ok .vr-wm{background:rgba(63,165,108,.14);color:#2f7d52}',
      '.vr-w-pot{border-color:#3FA56C;box-shadow:inset 3px 0 0 #3FA56C}.vr-w-pot .vr-wm{background:#3FA56C;color:#fff}',
      '.vr-w-leer{background:#FBF9F4}.vr-w-leer .vr-wm{background:rgba(42,39,39,.08);color:#6B645A}',
      '.vr-w-ab{border-color:#B8625C;box-shadow:inset 3px 0 0 #B8625C}.vr-w-ab .vr-wm{background:#B8625C;color:#fff}',
      '.vr-bw{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:6px 0 10px}',
      '.vr-bw>div{background:#FBF6E9;border:1px solid color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 18%,transparent);border-radius:2px;padding:8px 10px}',
      '.vr-bw span{display:block;font:700 9.5px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B645A}.vr-bw b{display:block;font:600 17px "Space Grotesk",sans-serif}.vr-bw small{color:#7A7370;font-size:11px}',
      '#vr-fenster{position:fixed;inset:0;z-index:100050;background:rgba(5,5,5,.6);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}',
      '#vr-fenster .vr-ov-box{background:#FDFCFA;border-radius:12px;max-width:980px;width:100%;padding:18px 16px;position:relative}',
      '#vr-fenster .vr-ov-zu{position:absolute;top:8px;right:10px;border:0;background:none;font-size:24px;cursor:pointer;color:#5E5856;min-width:36px;min-height:36px}',
      '@media (max-width:640px){.vr-tab td,.vr-tab th{padding:6px 3px}.vr-tab{font-size:11.5px}.vr-etage{grid-template-columns:minmax(0,1fr)!important}.vr-kopf .vr-k{margin-left:0}}'
    ].join('');
    doc.head.appendChild(s);
  }

  global.DpViviReiter = { VERSION: VERSION, sichtbar: sichtbar, html: html, mountAll: mountAll, oeffnen: oeffnen, jahre: jahre };
})(typeof window !== 'undefined' ? window : globalThis);
