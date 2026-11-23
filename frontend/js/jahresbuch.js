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
 *   fest: { miete, steuer, wert, haus }  je Schritt das Datum (ISO) des Festschreibens (v4016,
 *         Marcel 23.11.2026: „ein Jahr bzw. einzelne Schritte festschreiben, mit wieder freigeben").
 *         Ein festgeschriebener Schritt gilt im Jahresabgleich als erledigt; Steuer und Miete des
 *         Jahres lassen sich dann nicht mehr ändern (aenderungErlaubt), bis er freigegeben ist.
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
  var VERSION = 'v4090a';
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
  /** v3840 · Summe der Wohnungen MIT Aufschlüsselung: je Wohnung die eingetragene Monatsmiete, sonst die heutige
      Miete der Wohnung (liste[i].ist, leer = 0) × (12 − Leerstandsmonate). Nur wenn mindestens eine Wohnung
      eingetragen ist, sonst null. Rein, Prüfer tools/miete-reiter-pruefen.mjs. */
  function summeWohnungen(einheiten, liste, jahr) {
    var e = einheiten || {}, L = Array.isArray(liste) ? liste : [];
    if (!Object.keys(e).some(function (k) { return istZahl(zahl((e[k] || {}).miete_m)); })) return null;
    var teile = [], s = 0, mon = monateImJahr(jahr);
    L.forEach(function (w, i) {
      if (!w || w.art === 'gewerbe' && !istZahl(zahl((e[String(i)] || {}).miete_m))) return;
      var x = e[String(i)] || {}, m = zahl(x.miete_m), eig = istZahl(m), l = zahl(x.leer_monate) || 0;
      if (!eig) m = w.status === 'leer' ? 0 : (jahr ? mieteWohnungImJahr(w, jahr) : (zahl(w.ist) || 0));
      var erh = eig ? erhoehungImJahr(x, w, jahr) : null;
      var j = jahresMiete(m, erh, mon, l);
      s += j; teile.push({ i: i, nr: w.nr || String(i + 1), miete_m: m, leer: l, monate: mon, erh: erh, jahr: j, eingetragen: eig });
    });
    return { summe: Math.round(s), teile: teile };
  }
  /* ── v4220 · B8 / B11 (Durchlauf Musterhof 8, 23.11.2026) ───────────────────────────────────────
     B8: im Kaufjahr zählte die Miete je Wohnung 12 Monate, Plan und AfA aber ab dem Übergang (11 bei 01.02.).
     Jetzt dieselben Monate wie dort (DealPilotAnteilig.getWuMonths: wirtschaftlicher Übergang, sonst Kaufdatum).
     B11: eine Erhöhung im Jahr ließ sich nur als Durchschnitt eintragen. Jetzt je Wohnung „ab Monat“ und „neue
     Miete“ (erh_ab, erh_auf). Ohne eigene Angabe gilt die Erhöhung aus der Liste der Wohnung (Reiter Miete), die
     im Jahr liegt. Der Platzhalter zeigt die Miete des Jahres (Liste), nicht die heutige. */
  function monateImJahr(jahr) {
    if (!jahr) return 12;
    try { var A = global.DealPilotAnteilig; if (A && typeof A.getWuMonths === 'function') { var n = Number(A.getWuMonths(+jahr)); if (isFinite(n)) return Math.max(0, Math.min(12, n)); } } catch (e) {}
    return 12;
  }
  function ersterMonat(mon) { return 13 - Math.max(1, mon || 12); }
  function quelleWohnung(w) { return { liste: w.erhoehungen, heute: zahl(w.ist), letzte: w.mv_letzte_erhoehung, betrag: w.mv_letzte_erhoehung_betrag }; }
  /** Monatsmiete der Wohnung im ersten Monat des Jahres (ab Übergang) laut Liste der Erhöhungen, sonst heute. */
  function mieteWohnungImJahr(w, jahr) {
    var E = global.DpErhoehungen, h = zahl(w && w.ist) || 0;
    if (!E || !E.mieteMonat || !jahr) return h;
    try { var m = E.mieteMonat(quelleWohnung(w), jahr + '-' + String(ersterMonat(monateImJahr(jahr))).padStart(2, '0') + '-01'); return istZahl(m) ? m : h; } catch (e) { return h; }
  }
  /** Erhöhung im Jahr: eigene Angabe (erh_ab 1 bis 12, erh_auf) oder die letzte Erhöhung der Liste in diesem Jahr. */
  function erhoehungImJahr(x, w, jahr) {
    var ab = zahl(x && x.erh_ab), auf = zahl(x && x.erh_auf);
    if (istZahl(ab) && ab >= 1 && ab <= 12 && istZahl(auf) && auf > 0) return { ab: Math.round(ab), auf: auf, quelle: 'eigen' };
    var E = global.DpErhoehungen;
    if (!jahr || !E || !E.imJahr || !w || !Array.isArray(w.erhoehungen)) return null;
    try {
      var l = E.imJahr(w.erhoehungen, jahr).filter(function (y) { return istZahl(zahl(y.auf)); });
      if (!l.length) return null;
      var d = String(l[l.length - 1].datum), mo = +d.slice(5, 7) + (+d.slice(8, 10) > 1 ? 1 : 0);
      return mo >= 1 && mo <= 12 ? { ab: mo, auf: zahl(l[l.length - 1].auf), quelle: 'liste' } : null;
    } catch (e) { return null; }
  }
  /** Rein: Jahresmiete aus Monatsmiete, Erhöhung im Jahr, verfügbaren Monaten (ab Übergang) und Monaten ohne Miete. */
  function jahresMiete(m, erh, mon, leer) {
    mon = mon == null ? 12 : Math.max(0, Math.min(12, mon));
    if (!mon) return 0;
    var von = ersterMonat(mon), sum = 0;
    for (var k = von; k <= 12; k++) sum += (erh && k >= erh.ab ? erh.auf : (m || 0));
    var l = Math.max(0, Math.min(mon, leer || 0));
    return Math.round(sum * (mon - l) / mon);
  }
  /** Summe der Wohnungen: Monatsmiete am 31.12. × (12 − Leerstandsmonate). Nur ein Vorschlag. */
  function summeEinheiten(einheiten, jahr) {
    var keys = Object.keys(einheiten || {}), s = 0, n = 0, mon = monateImJahr(jahr);
    keys.forEach(function (k) {
      var e = einheiten[k] || {}, m = zahl(e.miete_m), l = zahl(e.leer_monate) || 0;
      if (istZahl(m)) { s += jahresMiete(m, erhoehungImJahr(e, null, null), mon, l); n++; }   /* v4220 · B8/B11 */
    });
    return n ? Math.round(s) : null;
  }
  /** Eine Zeile aus den Quellen. q = { jahr, plan, proj, ist, av: {wert, eigen}|null, steuer: {ergebnis, refund}|null,
      ziel_nkm, stand, erhoehungen: [], mb } */
  function zeile(q) {
    var ist = q.ist || {}, plan = q.plan || {}, z = { jahr: q.jahr };
    z.miete_plan = istZahl(plan.nkm_y) ? plan.nkm_y : null;
    z.miete_proj = q.proj && istZahl(q.proj.nkm_y) ? r0(q.proj.nkm_y) : null;
    /* v3366 (E4): die Ist-Miete kommt aus dem Reiter Miete - die Projektion rechnet vergangene
       Jahre jetzt mit den eingetragenen Mieterhöhungen. Eine frühere eigene Jahressumme (bis v3365)
       bleibt sichtbar und geht vor. */
    z.miete_eigen = istZahl(zahl(ist.nkm_j));
    /* v4037 · Ist-Miete laut ViVi (nkm_j_vivi, aus dem Mietverlauf aller Mietverhaeltnisse) zaehlt, wenn keine eigene da ist */
    z.miete_vivi = !z.miete_eigen && istZahl(zahl(ist.nkm_j_vivi));
    z.miete_ist = z.miete_eigen ? zahl(ist.nkm_j) : (z.miete_vivi ? zahl(ist.nkm_j_vivi) : (q.jahr <= heuteJahr() ? z.miete_proj : null));
    z.miete_einheiten = summeEinheiten(ist.einheiten, q.jahr);
    /* Ohne eingefrorenen Plan (Ankauf-Stand vor v2989) steht die heutige Projektion da - gekennzeichnet, nie als Plan */
    z.ohne_plan = !q.plan;
    z.miete_basis = istZahl(z.miete_plan) ? z.miete_plan : z.miete_proj;
    z.miete_abw = istZahl(z.miete_ist) && istZahl(z.miete_basis) ? z.miete_ist - z.miete_basis : null;
    z.cf_plan = istZahl(plan.cfop_y) ? plan.cfop_y : null;
    z.cf_proj = q.proj && istZahl(q.proj.cfop_y) ? r0(q.proj.cfop_y) : null;
    z.rs_proj = q.proj && istZahl(q.proj.rs) ? r0(q.proj.rs) : null;
    z.cf_stand = q.stand && q.stand.kz && istZahl(zahl(q.stand.kz._kpis_cf_vs)) ? zahl(q.stand.kz._kpis_cf_vs) : null;
    z.rs_plan = istZahl(plan.rs) ? plan.rs : null;
    z.rs_ist = istZahl(zahl(ist.rs_ist)) ? zahl(ist.rs_ist) : null;
    z.rs_abw = istZahl(z.rs_ist) && istZahl(z.rs_plan != null ? z.rs_plan : z.rs_proj) ? z.rs_ist - (z.rs_plan != null ? z.rs_plan : z.rs_proj) : null;
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
  /* v3363b · SPEICHERN IN FOLGE. Gemessen 14.11.2026 an Westerfeldstr. 146 (Staging): drei schnelle
     saveObj-Aufrufe (Wert, Status, Schließen) liefen parallel, zwei PUT mit derselben Version - der
     zweite kam mit 409 zurück und das Objekt stand danach im Konflikt (_dpObjKonflikt), weitere
     Speicherungen wurden abgewiesen. Jetzt: läuft einer, folgt genau EIN weiterer danach. Dieselbe
     Folge für Zielbild-Fassungen, Mieterhöhungen und Jahresbuch (window.DpSpeichernFolge). */
  if (!global.DpSpeichernFolge) global.DpSpeichernFolge = (function () {
    var lauf = null, nochmal = false;
    function los() {
      if (lauf) { nochmal = true; return lauf; }
      var p = null;
      try { if (typeof global.saveObj === 'function') p = global.saveObj({ silent: true }); } catch (e) { p = null; }
      lauf = Promise.resolve(p).catch(function () {}).then(function () { lauf = null; if (nochmal) { nochmal = false; return los(); } });
      return lauf;
    }
    return los;
  })();
  function speichern() { return global.DpSpeichernFolge(); }
  /* v4090 · Marcel 23.11.2026: „wichtig ist auch, dass man an festgeschriebenen Jahren nicht einfach wieder was ändern
     kann." Jede Schreibstelle eines Jahres geht hier durch. Ein Feld gehört zu einem Schritt; ist der Schritt
     festgeschrieben, wird nicht geschrieben. Restschuld und Notiz gehören keinem Schritt, sie sperren mit dem ganzen Jahr.
     Lösen nur über „wieder freigeben" mit Rückfrage im Jahresabgleich, der Vorgang steht in _jahre[J].fest_protokoll. */
  var FELD_SCHRITT = { nkm_j: 'miete', nkm_j_vivi: 'miete', einheiten: 'miete', leer_monate: 'miete', steuer_status: 'steuer', rs_ist: '*', notiz: '*' };
  /** Rein: ist das Feld des Jahres gesperrt? f = festAus(eintrag) */
  function feldGesperrtRein(f, feld) {
    var k = FELD_SCHRITT[feld];
    if (!k) return false;
    if (k === '*') return FEST_SCHRITTE.every(function (x) { return !!f[x[0]]; });
    return !!f[k];
  }
  function feldGesperrt(jahr, feld) { return feldGesperrtRein(fest(jahr), feld); }
  /** Ist der Schritt (oder bei '*' das ganze Jahr) festgeschrieben? Ohne Hinweis. */
  function istFest(jahr, schritt) { var f = fest(jahr); return schritt === '*' ? FEST_SCHRITTE.every(function (x) { return !!f[x[0]]; }) : !!f[schritt || 'steuer']; }
  function sperrHinweis(jahr, schritt) {
    var w = schritt === '*' ? 'Das Jahr' : (FEST_SCHRITTE.filter(function (x) { return x[0] === schritt; })[0] || [schritt, schritt])[1];
    if (typeof global.toast === 'function') global.toast(w + ' ' + jahr + ' ist festgeschrieben. Ändern geht erst nach „wieder freigeben“ im Jahresabgleich.');
  }
  /** Rein: Liste der Mieterhöhungen gegen festgeschriebene Mietjahre schützen. Einträge eines gesperrten Jahres bleiben,
      wie sie waren (neu dazu fällt weg, gelöscht kommt zurück, geändert bleibt alt). festMiete(jahr) → true = gesperrt.
      Rückgabe { liste, abgewiesen } */
  function erhoehungenSchuetzenRein(alt, neu, festMiete) {
    alt = Array.isArray(alt) ? alt : []; neu = Array.isArray(neu) ? neu : [];
    var gesp = function (x) { var y = parseInt(String((x && x.datum) || '').slice(0, 4), 10); return y >= 1990 && !!festMiete(y); };
    var sig = function (x) { return JSON.stringify([x.id, x.datum, x.art, x.von, x.auf]); };
    var altG = alt.filter(gesp), neuG = neu.filter(gesp);
    var gleich = altG.length === neuG.length && altG.map(sig).sort().join('|') === neuG.map(sig).sort().join('|');
    if (gleich) return { liste: neu, abgewiesen: 0 };
    var erg = neu.filter(function (x) { return !gesp(x); }).concat(altG).sort(function (a, b) { return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0); });
    return { liste: erg, abgewiesen: Math.max(1, Math.abs(neuG.length - altG.length)) };
  }
  function erhoehungenSchuetzen(alt, neu) {
    var r = erhoehungenSchuetzenRein(alt, neu, function (y) { return istFest(y, 'miete'); });
    if (r.abgewiesen) { var y0 = null; (neu || []).concat(alt || []).some(function (x) { var y = parseInt(String((x && x.datum) || '').slice(0, 4), 10); if (istFest(y, 'miete')) { y0 = y; return true; } return false; }); sperrHinweis(y0 || '', 'miete'); }
    return r;
  }
  function schreiben(jahr, feld, wert, ohneSpeichern) {
    var d = D(); if (!d) return false;
    if (feldGesperrt(jahr, feld)) { sperrHinweis(jahr, FELD_SCHRITT[feld]); return false; }   /* v4090 */
    d._jahre = setzen(d._jahre, jahr, feld, wert);
    if (!ohneSpeichern) speichern();
    return true;
  }
  function statusSetzen(jahr, s) {
    if (!STATUS.some(function (x) { return x[0] === s; })) return false;
    if (festGesperrt(jahr, 'steuer')) { mountAll(); return false; }   /* v4016 */
    schreiben(jahr, 'steuer_status', s === 'geplant' ? '' : s);
    mountAll();
    return true;
  }
  /* ── v4016 · Festschreiben je Jahr und Schritt (_jahre[J].fest) ─────── */
  var FEST_SCHRITTE = [['miete', 'Miete'], ['steuer', 'Steuer'], ['wert', 'Wert'], ['haus', 'Haus']];
  /** Rein: die festgeschriebenen Schritte eines Jahreseintrags, nur bekannte Schlüssel mit Datum */
  function festAus(eintrag) {
    var f = eintrag && eintrag.fest && typeof eintrag.fest === 'object' ? eintrag.fest : {}, o = {};
    FEST_SCHRITTE.forEach(function (x) { if (f[x[0]]) o[x[0]] = String(f[x[0]]); });
    return o;
  }
  /** Rein: neuer fest-Stand. schritte: Liste der Schlüssel (leer/null = alle vier), an: true festschreiben, false freigeben */
  function festNeu(alt, schritte, an, heute) {
    var o = festAus({ fest: alt }), ks = (schritte && schritte.length ? schritte : FEST_SCHRITTE.map(function (x) { return x[0]; }));
    ks.forEach(function (k) { if (!FEST_SCHRITTE.some(function (x) { return x[0] === k; })) return; if (an) { if (!o[k]) o[k] = heute; } else delete o[k]; });
    return o;
  }
  function fest(jahr) { return festAus(jahreDaten()[String(jahr)]); }
  /** Schritte festschreiben oder freigeben (nur vergangene Jahre). Speichert. */
  function festSetzen(jahr, schritte, an) {
    var y = parseInt(jahr, 10);
    if (!verfuegbar() || !(y >= 1990) || (an && y >= heuteJahr())) return false;
    var alt = fest(y), n = festNeu(alt, schritte, !!an, heuteIso());
    var geaendert = FEST_SCHRITTE.map(function (x) { return x[0]; }).filter(function (k) { return !!alt[k] !== !!n[k]; });
    if (!geaendert.length) return true;
    /* v4090 · Protokoll: wer wann was festgeschrieben oder freigegeben hat (Freigeben nur nach Rückfrage, jahresabgleich.js) */
    var prot = ((jahreDaten()[String(y)] || {}).fest_protokoll || []).slice(-29);
    var wer = ''; try { var u = global.Auth && global.Auth.getSession ? global.Auth.getSession() : null; wer = (u && (u.name || u.email)) || ''; } catch (e) {}
    prot.push({ am: new Date().toISOString(), aktion: an ? 'festgeschrieben' : 'freigegeben', schritte: geaendert, wer: wer });
    var d = D(); if (d) d._jahre = setzen(d._jahre, y, 'fest_protokoll', prot);
    schreiben(y, 'fest', Object.keys(n).length ? n : '');
    mountAll();
    return true;
  }
  /** Ist der Schritt festgeschrieben? Dann Hinweis, kein Dialog. */
  function festGesperrt(jahr, schritt) {
    var f = fest(jahr), k = schritt || 'steuer';
    if (!f[k]) return false;
    var w = (FEST_SCHRITTE.filter(function (x) { return x[0] === k; })[0] || [k, k])[1];
    if (typeof global.toast === 'function') global.toast(w + ' ' + jahr + ' ist festgeschrieben. Freigeben im Jahresabgleich.');
    return true;
  }
  /** Für tax.js updateTaxOverride: darf die Zelle dieses Jahres geändert werden? Fragt bei erklärt/Bescheid nach.
      v4016 · schritt (Standard 'steuer'): ein festgeschriebener Schritt sperrt ohne Rückfrage. */
  function aenderungErlaubt(jahr, schritt) {
    if (festGesperrt(jahr, schritt || 'steuer')) return false;
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
  function vertragsErhoehungen(E) {
    if (!E || !E.ausVertrag) return [];
    var out = [], M = global._dpMfh;
    if (M && Array.isArray(M.einheiten) && M.einheiten.length) {
      M.einheiten.forEach(function (e, i) {
        if (!e || (Array.isArray(e.erhoehungen) && e.erhoehungen.length)) return;
        var x = E.ausVertrag(e.mv_letzte_erhoehung, e.mv_letzte_erhoehung_betrag, e.ist); if (x) out.push(Object.assign({ einheit: i, nr: e.nr || String(i + 1), ausVertrag: true }, x));
      });
      return out;
    }
    if (E.objektListe && E.objektListe().length) return [];
    var o = E.ausVertrag((el('mv_letzte_erhoehung') || {}).value, (el('mv_letzte_erhoehung_betrag') || {}).value, (el('nkm') || {}).value);
    return o ? [Object.assign({ einheit: null, ausVertrag: true }, o)] : [];
  }
  /** Alle Zeilen, jüngstes Jahr zuerst. */
  function zeilen() {
    var a = ankauf(); if (!a) return [];
    var plan = Array.isArray(a.plan) ? a.plan : [], rows = (global.State && global.State.cfRows) || [];
    var J = global.DpJahresstaende, staende = J && J.liste ? J.liste() : [];
    var E = global.DpErhoehungen, erh = E && E.alle ? E.alle() : [];
    /* v3981 · F18: ohne Liste der Mieterhöhungen zählt „Letzte Erhöhung" (z. B. aus ViVi) - sonst stand im Jahr der
       Erhöhung „Keine Erhöhung in diesem Jahr", obwohl die Miete gestiegen ist. Je Wohnung ebenso. */
    try { erh = erh.concat(vertragsErhoehungen(E)); } catch (e) {}
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
      '.dp-jb-inline{margin:10px 0 4px;padding:12px 14px;border:1px solid var(--wl-c9a84c, #C9A84C);border-radius:10px;background:var(--surface, #FDFCFA)}',
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
    if (istZahl(z.miete_abw)) t += '<small class="' + (z.miete_abw >= 0 ? 'dp-jb-gut' : 'dp-jb-schlecht') + '">' + eurVz(z.miete_abw) + (z.ohne_plan ? ' zur Projektion' : ' zum Plan') + '</small>';
    else if (!istZahl(z.miete_ist) && istZahl(z.av && z.av.wert) && z.av.eigen) t += '<small>Anlage V ' + eur(z.av.wert) + '</small>';
    return t;
  }
  function editHtml(z, mfh) {
    var e = jahreDaten()[String(z.jahr)] || {};
    var f = function (feld, lbl, ph, typ) { return '<label>' + lbl + '<input data-jb-feld="' + feld + '" inputmode="' + (typ || 'decimal') + '" value="' + esc(e[feld] == null ? '' : String(e[feld]).replace('.', ',')) + '" placeholder="' + esc(ph || '') + '"></label>'; };
    var ein = '', zus = '';
    /* v3840 · Marcel 19.11.2026: „zeigen, wie sich der Wert zusammensetzt. Kommt die Miete aus den Wohnungen, muss
       das Feld gesperrt sein mit Absprung". Beim MFH ist die Jahressumme die Summe der Wohnungen (wird beim Eintragen
       je Wohnung gesetzt), sonst ein eigenes Feld. */
    if (mfh && mfh.length) {
      var sw = summeWohnungen(e.einheiten, mfh, z.jahr);
      zus = '<div class="dp-jb-h"><b>Kaltmiete ' + z.jahr + ': ' + eur(z.miete_ist) + '</b>. '
        + (sw ? 'Das ist die Summe der Wohnungen: ' + sw.teile.map(function (t) { return 'Wohnung ' + esc(t.nr) + ' ' + eur(t.miete_m) + (t.erh ? ', ab Monat ' + t.erh.ab + ' ' + eur(t.erh.auf) : '') + ' × ' + Math.max(0, t.monate - Math.min(t.monate, t.leer)) + ' Monate' + (t.eingetragen ? '' : ' (laut Liste)'); }).join(', ') + '.' + (sw.teile.length && sw.teile[0].monate < 12 ? ' Im Kaufjahr zählen die Monate ab dem Übergang.' : '')
          : (z.miete_eigen ? 'Eingetragen als Jahressumme.' : 'Gerechnet aus der heutigen Miete der Wohnungen und den Mieterhöhungen.'))
        + ' Die Summe kommt aus den Wohnungen und lässt sich hier nicht frei ändern. Weicht ein Jahr ab, trag die Miete unten je Wohnung ein. Die heutige Miete änderst du in den Einheiten.'
        + ' <button type="button" class="dp-jb-knopf" data-jb-aktion="einheiten">In den Einheiten ändern</button></div>';
      ein = '<div style="margin:6px 0 2px;font-weight:600">Je Wohnung: Monatsmiete in ' + z.jahr + ', Monate ohne Miete und eine Erhöhung im Jahr (ab Monat, neue Miete)</div><div class="dp-jb-f">'
        + mfh.map(function (w, i) {
          if (!w) return '';
          var x = (e.einheiten || {})[String(i)] || {};
          return '<label>' + esc('Wohnung ' + (w.nr || (i + 1)) + (w.lage ? ' · ' + w.lage : '')) + '<span style="display:flex;gap:4px">'
            + '<input data-jb-einheit="' + i + '" data-jb-k="miete_m" inputmode="decimal" style="flex:2" title="Monatsmiete zu Jahresbeginn" value="' + esc(x.miete_m == null ? '' : String(x.miete_m).replace('.', ',')) + '" placeholder="' + esc(String(Math.round(mieteWohnungImJahr(w, z.jahr) * 100) / 100).replace('.', ',')) + '">'
            + '<input data-jb-einheit="' + i + '" data-jb-k="leer_monate" inputmode="numeric" style="flex:1" title="Monate ohne Miete" value="' + esc(x.leer_monate == null ? '' : x.leer_monate) + '" placeholder="0">'
            + (function () { var lp = erhoehungImJahr({}, w, z.jahr); return '<input data-jb-einheit="' + i + '" data-jb-k="erh_ab" inputmode="numeric" style="flex:1" title="Erhöhung ab Monat (1 bis 12)" value="' + esc(x.erh_ab == null ? '' : x.erh_ab) + '" placeholder="' + (lp ? lp.ab : 'ab Mon.') + '">'
              + '<input data-jb-einheit="' + i + '" data-jb-k="erh_auf" inputmode="decimal" style="flex:2" title="Neue Monatsmiete ab diesem Monat" value="' + esc(x.erh_auf == null ? '' : String(x.erh_auf).replace('.', ',')) + '" placeholder="' + (lp ? esc(String(lp.auf).replace('.', ',')) : 'neu €') + '">'; })()
            + '</span></label>';
        }).join('') + '</div>'
        ;
    } else {
      zus = '<div class="dp-jb-h"><b>Kaltmiete ' + z.jahr + ': ' + eur(z.miete_ist) + '</b>. '
        + (z.miete_eigen ? 'Du hast diese Summe eingetragen. Gerechnet wären es ' + eur(z.miete_proj) + '.'
          : z.miete_vivi ? 'Sie kommt aus dem ViVi-Mietverlauf. Weicht die echte Miete ab, zum Beispiel wegen Leerstand, trag sie hier ein.'   /* v4100 */
          : 'DealPilot rechnet sie aus der Miete im Reiter Miete und den Mieterhöhungen von ' + z.jahr + '. Weicht die echte Miete ab, zum Beispiel wegen Leerstand, trag sie hier ein.') + '</div>';
    }
    var st = STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (z.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('');
    var erh = z.erhoehungen.length ? z.erhoehungen.map(function (x) {
      return (x.einheit != null ? 'Wohnung ' + esc(x.nr) + ': ' : '') + esc(x.datum.split('-').reverse().join('.')) + ' auf ' + eur(zahl(x.auf));
    }).join(' · ') : 'keine eingetragen';
    /* v3840 · GEMESSEN 19.11.2026 (Westerfeldstr.-Kopie): die Eingabe je Wohnung (ein) wurde seit v3366 gebaut, aber nie
       ausgegeben. Beim MFH gab es damit keinen Weg, die Miete eines vergangenen Jahres einzutragen. */
    return sperrHtml(z.jahr, '<tr class="dp-jb-edit" data-jb-edit="' + z.jahr + '"><td colspan="8">' + zus + (z.jahr < heuteJahr() ? ein : '')
      + '<div class="dp-jb-f">'
      + ((mfh && mfh.length) ? '' : (z.jahr < heuteJahr() ? f('nkm_j', 'Kaltmiete ' + z.jahr + ', wirklich eingenommen (€ im Jahr)', istZahl(z.miete_proj) ? String(z.miete_proj) : '') : ''))
      + f('leer_monate', 'Leerstand (Monate)', '0', 'numeric')
      + f('rs_ist', 'Restschuld am 31.12. laut Kontoauszug (€)', istZahl(z.rs_plan) ? 'Plan ' + z.rs_plan : '')
      + '<label>Steuer ' + z.jahr + '<select data-jb-feld="steuer_status">' + st + '</select></label>'
      + f('notiz', 'Notiz', 'z. B. Mieterwechsel im Mai', 'text')
      + '</div>'
      + '<div class="dp-jb-h">Mieterhöhungen ' + z.jahr + ': ' + erh + '. Eine Erhöhung trägst du ' + ((mfh && mfh.length) ? 'bei der Wohnung in den Einheiten' : 'im Reiter Miete in der Karte Mietvertrag') + ' ein.</div>'
      + '<button type="button" class="dp-jb-knopf" data-jb-aktion="zu">Fertig</button>'
      + '</td></tr>');
  }
  /** v4090 · gesperrte Felder des Jahres deaktiviert zeigen, mit Satz dazu */
  function sperrHtml(jahr, h) {
    var gesperrt = [];
    h = h.replace(/<(input|select)([^>]*?)data-jb-(feld|einheit)="([^"]+)"/g, function (m, tag, vor, art, name) {
      var feld = art === 'einheit' ? 'einheiten' : name;
      if (!feldGesperrt(jahr, feld)) return m;
      gesperrt.push(feld);
      return '<' + tag + ' disabled title="festgeschrieben"' + vor + 'data-jb-' + art + '="' + name + '"';
    });
    if (!gesperrt.length) return h;
    return h.replace(/(<td colspan="8">)/, '$1<div class="dp-jb-h">' + (istFest(jahr, '*') ? 'Das Jahr ' + jahr + ' ist festgeschrieben.' : 'Festgeschriebene Schritte von ' + jahr + ' sind gesperrt.') + ' Ändern geht erst nach „wieder freigeben“ im Jahresabgleich.</div>');
  }
  /** v4090 · Marcel 23.11.2026: „warum öffnet sich noch dieses Modal?" Der Jahresabgleich zeigt die Eingabe eines Jahres
      direkt im Reiter (Ist-Miete, Leerstand, Restschuld, Steuerstand, Notiz). Dieselben Felder wie im Fenster „Jahre",
      dieselbe Speicherstelle (_jahre[J]). '' ohne Bestand oder bei unbekanntem Jahr. */
  function eingabeHtml(jahr) {
    if (!verfuegbar()) return '';
    stil();
    var y = +jahr, z = zeilen().filter(function (x) { return x.jahr === y; })[0]; if (!z) return '';
    _offen = y;
    var M = global._dpMfh, mfh = global.DpMfhEinheiten && global.DpMfhEinheiten.artMitEinheiten && global.DpMfhEinheiten.artMitEinheiten() && M && Array.isArray(M.einheiten) ? M.einheiten : null;
    var innen = editHtml(z, mfh).replace(/^<tr[^>]*><td colspan="8">/, '').replace(/<\/td><\/tr>$/, '');
    return '<div class="dp-jb dp-jb-inline" data-jb-inline="' + y + '">' + innen + '</div>';
  }
  /** v4090 · Eingaben und Knöpfe eines eingabeHtml-Blocks binden. fertig() nach „Fertig" (gespeichert). */
  function eingabeBinden(el, fertig) {
    if (!el || el._dpJbIn) return; el._dpJbIn = true;
    el.addEventListener('change', aendern);
    el.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-jb-aktion]') : null; if (!b) return;
      ev.preventDefault(); ev.stopPropagation();
      var a = b.getAttribute('data-jb-aktion');
      if (a === 'zu') { _offen = null; Promise.resolve(speichern()).then(function () { if (typeof fertig === 'function') fertig(); }); return; }
      aktion(a, parseInt(b.getAttribute('data-jb-jahr'), 10) || _offen, b.getAttribute('data-jb-fassung'));
    });
  }
  function tafelHtml(Z, mfh) {
    var kopf = '<tr><th>Jahr</th><th>Kaltmiete Plan</th><th>Kaltmiete Ist</th><th>Cashflow v. St. Plan</th><th>Restschuld Plan · Ist</th><th>Steuer V+V</th><th>Ziel · Wert</th><th></th></tr>';
    var body = Z.map(function (z) {
      var hin = '';
      if (z.abgleich && z.abgleich.art !== 'gleich') hin += '<div class="dp-jb-h">' + esc(z.abgleich.text) + (z.abgleich.art === 'vorschlag' ? ' <button type="button" class="dp-jb-knopf" data-jb-aktion="av" data-jb-jahr="' + z.jahr + '">übernehmen</button>' : '') + '</div>';
      if (z.ziel_erreicht && z.ziel_fassung && z.ziel_fassung.status !== 'erreicht') hin += '<div class="dp-jb-h dp-jb-ok">Die Ist-Miete ' + z.jahr + ' erreicht das Ziel von ' + esc(z.ziel_titel || 'Zielbild') + '. <button type="button" class="dp-jb-knopf" data-jb-aktion="erreicht" data-jb-fassung="' + esc(z.ziel_fassung.id) + '">als erreicht kennzeichnen</button></div>';
      else if (z.ziel_erreicht && !z.ziel_fassung) hin += '<div class="dp-jb-h dp-jb-ok">Die Ist-Miete ' + z.jahr + ' erreicht das Ziel des aktiven Zielbilds. Ein neues Zielbild legst du im Reiter Miete an (Karte Mieterhöhung und Zielbild).</div>';
      var oP = function (planW, projW) { return istZahl(planW) ? eur(planW) : (istZahl(projW) ? '<span style="color:#6B645A">' + eur(projW) + '</span><small>Projektion heute</small>' : '–'); };
      var zeile = '<tr data-jb-jahr-zeile="' + z.jahr + '"><td><b>' + z.jahr + '</b>' + (z.jahr === heuteJahr() ? '<small>laufend</small>' : '') + '</td>'
        + '<td>' + oP(z.miete_plan, z.miete_proj) + '</td>'
        + '<td>' + zelleMiete(z) + '</td>'
        + '<td>' + oP(z.cf_plan, z.cf_proj) + (istZahl(z.cf_stand) ? '<small>Stand ' + eur(z.cf_stand) + '</small>' : '') + '</td>'
        + '<td>' + oP(z.rs_plan, z.rs_proj) + (istZahl(z.rs_ist) ? '<small class="' + (z.rs_abw <= 0 ? 'dp-jb-gut' : 'dp-jb-schlecht') + '">Ist ' + eur(z.rs_ist) + '</small>' : '') + '</td>'
        + '<td>' + (z.steuer ? eurVz(z.steuer.ergebnis) : '–') + '<small><span class="dp-jb-st dp-jb-st-' + z.status + '">' + statusWort(z.status) + '</span></small></td>'
        + '<td>' + (istZahl(z.ziel_nkm) ? eur(z.ziel_nkm) + '/Monat' : '–') + (z.ziel_titel ? '<small>' + esc(z.ziel_titel) + '</small>' : '') + (z.mb ? '<small>Wert ' + eur(z.mb.wert) + '</small>' : '') + '</td>'
        + '<td><button type="button" class="dp-jb-knopf" data-jb-aktion="auf" data-jb-jahr="' + z.jahr + '" aria-expanded="' + (_offen === z.jahr) + '">' + (_offen === z.jahr ? 'Schließen' : 'Eintragen') + '</button></td></tr>';
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
    var vorb = leer && vorbelegbar() ? '<div class="dp-jb-h">Im Reiter Miete steht eine letzte Erhöhung, aber noch keine Liste. <button type="button" class="dp-jb-knopf" data-jb-aktion="vorbelegen">Als ersten Eintrag übernehmen</button></div>' : '';
    return '<div class="dp-jb" data-dp-jb="1">'
      + '<div class="dp-pa-sec"><span>JAHR FÜR JAHR: PLAN GEGEN IST</span></div>'
      + '<p class="dp-jb-satz">Plan ist die Rechnung vom Ankauf, eingefroren. Ist kommt aus den Reitern: die Miete aus dem Reiter Miete (Mieterhöhungen), die Steuer aus der Anlage V im Reiter Steuer, der Wert aus deinen Marktberichten.</p>'
      + '<div data-dp-jb-grafik="1"></div>'
      + (Z.some(function (z) { return z.ohne_plan; }) ? '<p class="dp-jb-satz">Dieser Ankauf-Stand ist älter als die eingefrorene Planrechnung. Grau steht deshalb die heutige Projektion, sie ist kein Plan vom Ankauf.</p>' : '')
      + vorb + tafelHtml(Z, mfh) + '</div>';
  }
  /* Vorbelegung (nur auf Klick, Bericht 3.7) */
  function vorbelegbar() {
    var Z = zeilen();
    /* v3366: keine Jahressumme mehr aus der Anlage V - die Miete kommt aus dem Reiter Miete */
    var E = global.DpErhoehungen;
    return !!(E && !E.objektListe().length && /^\d{4}-\d{2}-\d{2}$/.test(String((el('mv_letzte_erhoehung') || {}).value || '')));
  }
  function vorbelegen() {
    var d = D(); if (!d) return 0;
    var n = 0, j = d._jahre || {};
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
    for (var i = 0; i < hs.length; i++) {
      /* v3430 · im Reiter Jahresabgleich steht die Tabelle „Jahr für Jahr" von jahresabgleich.js (Jahresbuch, Jahresstände und
         „Kauf gegen heute" in einer). Die Eingabe (Steuerstatus, Restschuld, Notiz) bleibt hier, im Fenster „Jahre" (oeffnen). */
      var imJa = !(hs[i].closest && hs[i].closest('#dp-jb-ov')) && global.DpJahresabgleich && hs[i].parentNode && hs[i].parentNode.querySelector && hs[i].parentNode.querySelector('[data-dp-ja-host]');
      try { hs[i].innerHTML = imJa ? '' : html(); if (!imJa) binden(hs[i]); } catch (e) { hs[i].innerHTML = ''; console.warn('[jahresbuch]', e); }
    }
    if (hs.length) mbLaden().then(function (l) { if (l && l.length && !mountAll._mbFertig) { mountAll._mbFertig = global._currentObjKey; mountAll(); } });
    try { if (global.DpJahresbuchGrafik) global.DpJahresbuchGrafik.mountAll(); } catch (e) {}
    einstiege();
  }
  function binden(host) {
    if (host._dpJb) return; host._dpJb = true;
    host.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-jb-aktion]') : null; if (!b) return;
      ev.preventDefault();
      aktion(b.getAttribute('data-jb-aktion'), parseInt(b.getAttribute('data-jb-jahr'), 10), b.getAttribute('data-jb-fassung'));
    });
    host.addEventListener('change', aendern);
  }
  /** v3430 · die Knöpfe auch für den Jahresabgleich (jahresabgleich.js nutzt av und erreicht) */
  function aktion(a, y, fassung) {
      if (a === 'auf') { _offen = _offen === y ? null : y; mountAll(); return; }
      if (a === 'zu') { _offen = null; speichern(); mountAll(); return; }
      if (a === 'vorbelegen') { var n = vorbelegen(); if (typeof global.toast === 'function') global.toast('✓ ' + n + ' Angaben vorbelegt'); mountAll(); return; }
      if (a === 'av') {
        var z = zeilen().filter(function (x) { return x.jahr === y; })[0];
        if (z && istZahl(z.miete_ist) && typeof global.dpSteuerSetzen === 'function' && aenderungErlaubt(y)) global.dpSteuerSetzen(y, 'einnahmen_km', z.miete_ist);
        setTimeout(function () { mountAll(); try { if (global.DpJahresabgleich) global.DpJahresabgleich.mountAll(); } catch (x) {} }, 200); return;
      }
      if (a === 'einheiten') { schliessen(); try { if (global.DpMfhEinheiten && global.DpMfhEinheiten.oeffnen) global.DpMfhEinheiten.oeffnen(1); } catch (x) {} return; }
      if (a === 'summe') { var z2 = zeilen().filter(function (x) { return x.jahr === y; })[0]; if (z2 && istZahl(z2.miete_einheiten)) schreiben(y, 'nkm_j', z2.miete_einheiten); mountAll(); return; }
      if (a === 'erreicht') { var F = global.DpZielbildFassungen; if (F) F.statusSetzen(fassung, 'erreicht'); mountAll(); try { if (global.DpJahresabgleich) global.DpJahresabgleich.mountAll(); } catch (x) {} }
  }
  function aendern(ev) {
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
        schreiben(y, 'einheiten', Object.keys(e).length ? e : '', true);
        /* v3840 · die Jahressumme des MFH folgt den Wohnungen (gesperrt, kein freies Feld mehr) */
        var Mx = global._dpMfh, sw2 = summeWohnungen(Object.keys(e).length ? e : null, Mx && Array.isArray(Mx.einheiten) ? Mx.einheiten : [], y);
        if (y < heuteJahr() && aenderungErlaubt(y)) schreiben(y, 'nkm_j', sw2 ? sw2.summe : '', true);
        mountAll();
      }
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
    if (ov && ov.parentNode) { ov.parentNode.removeChild(ov); speichern(); mountAll(); try { if (global.DpJahresabgleich) global.DpJahresabgleich.mountAll(); } catch (x) {}
      try { global.dispatchEvent(new CustomEvent('dp:jahre-geaendert')); } catch (x) {} }   /* v3840d · Tabelle der Mietentwicklung neu */
  }
  /* v3710 · Marcel 18.11.2026: der Einstieg „Ist-Mieten je Jahr" oben im Reiter Miete ist weg. Die Ist-Miete
     vergangener Jahre steht jetzt als Eingabe in der Tabelle der Mietentwicklung (mietentwicklung.js
     _bestandTabelle -> istMieteSetzen, dasselbe Feld _jahre[J].nkm_j). Der Plan-Ist-Abgleich gehört in die
     Pilot-Analyse (DpJahresabgleich). Ein noch stehender Einstieg aus einer offenen Sitzung wird abgeräumt. */
  function einstiege() {
    var h = el('dp-jb-einstieg-miete');
    if (h && h.parentNode) h.parentNode.removeChild(h);
  }
  /** v3710 · Ist-Kaltmiete eines vergangenen Jahres (Tabelle der Mietentwicklung). EINE Stelle: _jahre[J].nkm_j,
      dasselbe Feld wie „Eigene Jahressumme" im Fenster Jahre. Leer löscht die eigene Angabe. Nur im Bestand und
      nur für Jahre vor dem laufenden. Fragt bei „erklärt"/„Bescheid" nach (E6). */
  function istMieteSetzen(jahr, wert) {
    var y = parseInt(jahr, 10);
    if (!verfuegbar() || !(y >= 1990) || y >= heuteJahr()) return false;
    var v = wert === '' || wert == null ? null : zahl(wert);
    if (v != null && !(v >= 0)) return false;
    var alt = (jahreDaten()[String(y)] || {}).nkm_j;
    if ((alt == null ? null : zahl(alt)) === v) return true;
    if (!aenderungErlaubt(y, 'miete')) return false;   /* v4016 · Miete festgeschrieben sperrt */
    schreiben(y, 'nkm_j', v == null ? '' : Math.round(v * 100) / 100);
    mountAll();
    try { if (global.DpJahresabgleich) global.DpJahresabgleich.mountAll(); } catch (x) {}
    return true;
  }
  /** v4037 · eigene Angabe vor ViVi. Ohne beides null (dann rechnet die Mietentwicklung aus den Mieterhoehungen). */
  function istMiete(jahr) {
    var e = jahreDaten()[String(jahr)]; if (!e) return null;
    var v = zahl(e.nkm_j); if (istZahl(v)) return v;
    var w = zahl(e.nkm_j_vivi); return istZahl(w) ? w : null;
  }
  function istHerkunft(jahr) {
    var e = jahreDaten()[String(jahr)]; if (!e) return null;
    if (istZahl(zahl(e.nkm_j))) return 'eigen';
    return istZahl(zahl(e.nkm_j_vivi)) ? 'vivi' : null;
  }
  /** v4037 · Ist-Kaltmiete je vergangenem Jahr aus ViVi uebernehmen (ohne Speichern, der Aufrufer speichert).
      werte = { 'JJJJ': { miete, ... } }. Ein festgeschriebener Mietschritt bleibt unberuehrt, die eigene Angabe bleibt
      stehen (sie gewinnt in istMiete). Rueckgabe: true, wenn sich etwas geaendert hat. */
  function viviIstSetzen(werte) {
    var d = D(); if (!d || !werte || typeof werte !== 'object' || !verfuegbar()) return false;
    var hj = heuteJahr(), g = false;
    Object.keys(werte).forEach(function (k) {
      var y = parseInt(k, 10), w = werte[k] && zahl(werte[k].miete);
      if (!(y >= 1990) || y >= hj) return;
      if (fest(y).miete) return;
      /* null = ViVi gilt fuer dieses Jahr nicht (mehr): einen frueheren ViVi-Wert entfernen */
      if (werte[k] === null) { if ((jahreDaten()[String(y)] || {}).nkm_j_vivi != null) { d._jahre = setzen(d._jahre, y, 'nkm_j_vivi', ''); g = true; } return; }
      if (!istZahl(w)) return;
      var alt = zahl((jahreDaten()[String(y)] || {}).nkm_j_vivi);
      if (alt === Math.round(w * 100) / 100) return;
      d._jahre = setzen(d._jahre, y, 'nkm_j_vivi', Math.round(w * 100) / 100); g = true;
    });
    return g;
  }
  /* v4090 · Alle Schreibstellen der Anlage V eines Jahres laufen über window.dpSteuerSetzen (tax.js): Belege einlesen
     (object-actions.js), Unterlagen-Eingang, Sonderumlage, ViVi-Steuerabgleich. Ist die Steuer des Jahres festgeschrieben,
     schreibt sie nicht (Rückgabe false wie „Jahr nicht in der Zeitleiste"). Die Eingabe im Reiter Steuer prüft selbst
     (updateTaxOverride → aenderungErlaubt). */
  function steuerSperreEinhaengen() {
    var f = global.dpSteuerSetzen;
    if (typeof f !== 'function' || f._dpFest) return;
    var g = function (year, field) {
      var y = parseInt(year, 10);
      if (y >= 1990 && istFest(y, 'steuer')) { sperrHinweis(y, 'steuer'); return false; }
      return f.apply(this, arguments);
    };
    g._dpFest = true;
    Object.keys(f).forEach(function (k) { if (!(k in g)) g[k] = f[k]; });
    global.dpSteuerSetzen = g;
  }
  steuerSperreEinhaengen();
  if (global.addEventListener) {
    global.addEventListener('DOMContentLoaded', steuerSperreEinhaengen);
    global.addEventListener('load', steuerSperreEinhaengen);
    global.addEventListener('dp:object-ready', steuerSperreEinhaengen);
  }
  if (global.addEventListener) {
    global.addEventListener('dp:object-ready', function () { _offen = null; mountAll._mbFertig = null; setTimeout(mountAll, 900); });
    global.addEventListener('dp:erhoehungen', function () { setTimeout(mountAll, 100); });
    global.addEventListener('dp:zielbild-fassung', function () { setTimeout(mountAll, 100); });
  }

  global.DpJahresbuch = {
    VERSION: VERSION, STATUS: STATUS,
    jahreVon: jahreVon, summeEinheiten: summeEinheiten, summeWohnungen: summeWohnungen, jahresMiete: jahresMiete, monateImJahr: monateImJahr,   /* v4220 */   /* v3840 */ zeile: zeile, setzen: setzen, nachfragen: nachfragen,
    verfuegbar: verfuegbar, zeilen: zeilen, status: status, statusSetzen: statusSetzen, statusWort: statusWort, aenderungErlaubt: aenderungErlaubt,
    istMieteSetzen: istMieteSetzen, istMiete: istMiete,   /* v3710 */ istHerkunft: istHerkunft, viviIstSetzen: viviIstSetzen,   /* v4037 */
    FEST_SCHRITTE: FEST_SCHRITTE, festAus: festAus, festNeu: festNeu, fest: fest, festSetzen: festSetzen, festGesperrt: festGesperrt,   /* v4016 */
    FELD_SCHRITT: FELD_SCHRITT, feldGesperrtRein: feldGesperrtRein, feldGesperrt: feldGesperrt, istFest: istFest, erhoehungenSchuetzenRein: erhoehungenSchuetzenRein, erhoehungenSchuetzen: erhoehungenSchuetzen, steuerSperreEinhaengen: steuerSperreEinhaengen,   /* v4090 */
    html: html, eingabeHtml: eingabeHtml, eingabeBinden: eingabeBinden,   /* v4090 */ mountAll: mountAll, oeffnen: oeffnen, schliessen: schliessen, vorbelegen: vorbelegen, mbLaden: mbLaden, aktion: aktion   /* v3430 */
  };
})(typeof window !== 'undefined' ? window : globalThis);
