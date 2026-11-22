/* hausverlauf.js — v3323 · PILOT-ANALYSE: REITER „HAUSVERLAUF"
   ───────────────────────────────────────────────────────────────────────────
   Marcel 12.11.2026: „wenn ich WEG-Protokoll hochgeladen habe, dass da vielleicht der Verlauf mit drinne
   steht, was passiert ist … und dann können wir Unterlagen WEG vielleicht Dokumente hochladen."

   GEMESSEN (Staging, Lindenallee 14, 12.11.2026): die Auswertung der Unterlagen (#_dok_auswertung,
   unterlagen.js) trägt weg.kernpunkte nur mit JAHR („2025: Dachsanierung für 92.000 € beschlossen …"),
   weg.sanierungen mit Jahr und Status, weg.sonderumlagen als Text; Datum der Versammlung steht nur an
   den Dokumenten (dokumente[].datum). Die Sonderumlagen mit Fälligkeit und Raten liegen in #weg_su
   (sonderumlage.js). Seit v3323 verlangt die Auswertung zusätzlich weg.chronik – je Ereignis Datum, Art,
   Betrag, Status und Quelle (backend openaiService.js dokumenteAuswerten). Ältere Auswertungen ohne
   chronik werden aus kernpunkte, sanierungen und den Dokumentdaten zusammengesetzt – nichts erfunden.

     ereignisse(ausw, su, doks)  reine Funktion (Prüfer tools/hausverlauf-pruefen.mjs): Liste, älteste zuerst
     html()                      Inhalt des Unterreiters (leer → Einstieg zum Hochladen)
     kurz()                      { zahl, unter } für die Wegweiser-Karte der Übersicht
     wegJahre(ausw, su, doks)    v3430 · das Haus je Jahr (Hausgeld Plan/Ist, Rücklage, Sonderumlagen, Beschlüsse, Unterlagen)
     html()                      v3430 · Urteil, Kennzahlleiste, Grafik Hausgeld/Rücklage, Tabelle je Jahr, dann die Zeitleiste
   Neue Unterlagen: derselbe Weg wie „Unterlagen nachreichen" (DpUnterlagen.nachreichen → Import, ergänzen). */
(function (g) {
  'use strict';
  if (g.DpHausverlauf) return;

  var ARTEN = {
    versammlung: ['Versammlung', '#2A2727'],
    beschluss: ['Beschluss', '#2A2727'],
    sonderumlage: ['Sonderumlage', '#B8625C'],
    instandhaltung: ['Instandhaltung', 'var(--wl-b8932f,#b8932f)'],
    schaden: ['Schaden', '#B8625C'],
    verwaltung: ['Verwaltung', '#5a7fd4'],
    ruecklage: ['Rücklage', '#3FA56C'],
    hausgeld: ['Hausgeld', '#3FA56C'],
    rechtsstreit: ['Rechtsstreit', '#B8625C'],
    sonstiges: ['Sonstiges', '#7A7370']
  };
  var WEG_TYPEN = /^(weg_protokoll|hausgeld|teilungserklaerung|wirtschaftsplan|jahresabrechnung)$/;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(v) { if (v == null || v === '') return null; var n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function eur(v) { return Math.round(v).toLocaleString('de-DE') + ' €'; }
  /** "18.06.2025" | "2025-06-18" → { iso, jahr, text } */
  function datumAus(s) {
    s = String(s == null ? '' : s).trim();
    var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return { iso: m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2), jahr: +m[3], text: ('0' + m[1]).slice(-2) + '.' + ('0' + m[2]).slice(-2) + '.' + m[3] };
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { iso: m[1] + '-' + m[2] + '-' + m[3], jahr: +m[1], text: m[3] + '.' + m[2] + '.' + m[1] };
    return null;
  }
  /** Art aus dem Text, wenn die Auswertung keine nennt */
  function artAus(t) {
    t = String(t || '').toLowerCase();
    if (/sonderumlage/.test(t)) return 'sonderumlage';
    if (/verwalter|verwaltung/.test(t)) return 'verwaltung';
    if (/r(ü|ue)cklage/.test(t)) return 'ruecklage';
    if (/hausgeld|wirtschaftsplan|jahresabrechnung/.test(t)) return 'hausgeld';
    if (/klage|gericht|rechtsstreit|anfechtung/.test(t)) return 'rechtsstreit';
    if (/schaden|feucht|riss|leck|mangel|m(ä|ae)ngel|defekt/.test(t)) return 'schaden';
    if (/sanierung|erneuer|reparatur|instand|anstrich|dach|fassade|heizung|fenster|aufzug|modernis/.test(t)) return 'instandhaltung';
    if (/beschl/.test(t)) return 'beschluss';
    return 'sonstiges';
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim(); }

  /** Die Ereignisse, älteste zuerst. Jedes: { iso|null, jahr|null, datum (Text), art, titel, text, betrag, status, quelle, herkunft } */
  function ereignisse(ausw, su, doks) {
    var a = ausw && typeof ausw === 'object' ? ausw : {}, w = a.weg && typeof a.weg === 'object' ? a.weg : null, out = [];
    var push = function (e) {
      if (!e || !(e.titel || e.text)) return;
      e.art = ARTEN[e.art] ? e.art : artAus((e.titel || '') + ' ' + (e.text || ''));
      out.push(e);
    };
    /* 1 · Versammlungen aus den Dokumenten (Datum steht dort) */
    (Array.isArray(doks) ? doks : []).forEach(function (d) {
      if (!d || d.typ !== 'weg_protokoll') return;
      var dt = datumAus(d.datum); if (!dt) return;
      push({ iso: dt.iso, jahr: dt.jahr, datum: dt.text, art: 'versammlung', titel: 'Eigentümerversammlung', text: 'Protokoll liegt vor.', betrag: null, status: null, quelle: d.label || 'WEG-Protokoll', herkunft: 'dokument' });
    });
    /* 2 · die Chronik der Auswertung (seit v3323) – sonst die Kernpunkte mit Jahr */
    var chronik = w && Array.isArray(w.chronik) ? w.chronik.filter(function (x) { return x && typeof x === 'object'; }) : [];
    if (chronik.length) {
      chronik.forEach(function (c) {
        var dt = datumAus(c.datum), j = dt ? dt.jahr : (zahl(c.jahr) || null);
        push({ iso: dt ? dt.iso : null, jahr: j, datum: dt ? dt.text : (j ? String(j) : ''), art: String(c.art || '').toLowerCase(), titel: c.titel || '', text: c.text || '',
          betrag: zahl(c.betrag_eur), status: c.status || null, quelle: c.quelle || '', herkunft: 'chronik' });
      });
    } else if (w && Array.isArray(w.kernpunkte)) {
      w.kernpunkte.forEach(function (k) {
        var m = String(k || '').match(/^\s*((?:19|20)\d\d)(?:\s*[\/–-]\s*(?:19|20)?\d\d)?\s*[:–-]\s*([\s\S]*)$/);
        var j = m ? +m[1] : null, t = m ? m[2].trim() : String(k || '').trim();
        push({ iso: null, jahr: j, datum: j ? String(j) : '', art: '', titel: '', text: t, betrag: null, status: null, quelle: 'Auswertung der Unterlagen', herkunft: 'kernpunkt' });
      });
    }
    /* 3 · Maßnahmen mit Status (nur, wenn die Chronik sie nicht schon nennt) */
    if (w && Array.isArray(w.sanierungen)) w.sanierungen.forEach(function (s) {
      if (!s || !s.massnahme) return;
      var schon = out.some(function (e) { return e.herkunft === 'chronik' && norm(e.titel + ' ' + e.text).indexOf(norm(s.massnahme).split(' ')[0]) >= 0 && (!s.jahr || e.jahr === s.jahr); });
      if (schon) return;
      push({ iso: null, jahr: zahl(s.jahr), datum: s.jahr ? String(s.jahr) : '', art: 'instandhaltung', titel: s.massnahme, text: '', betrag: zahl(s.kosten_eur), status: s.status || null, quelle: 'Maßnahmen der Gemeinschaft', herkunft: 'massnahme' });
    });
    /* 4 · Sonderumlagen mit Fälligkeit (#weg_su) – Anteil dieses Objekts */
    (Array.isArray(su) ? su : []).forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      var dt = datumAus(s.faellig), j = dt ? dt.jahr : zahl(s.jahr), b = zahl(s.betrag);
      push({ iso: dt ? dt.iso : null, jahr: j, datum: dt ? dt.text : (j ? String(j) : ''), art: 'sonderumlage', titel: 'Sonderumlage' + (s.zweck ? ': ' + s.zweck : ''),
        text: b != null ? 'Anteil dieses Objekts ' + eur(b) + (dt ? ', fällig am ' + dt.text : '') + '.' : '', betrag: b, status: s.status || 'beschlossen', quelle: s.quelle || 'Sonderumlagen (Reiter Bewirtschaftung)', herkunft: 'sonderumlage', anteil: true });
    });
    /* sortieren: Jahr, dann Datum; ohne Datum innerhalb des Jahres hinter den datierten in Eingangsreihenfolge */
    out.forEach(function (e, i) { e._i = i; });
    out.sort(function (x, y) {
      var jx = x.jahr || 9999, jy = y.jahr || 9999;
      if (jx !== jy) return jx - jy;
      if (x.iso && y.iso) return x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : x._i - y._i;
      if (x.iso && !y.iso) return -1;
      if (!x.iso && y.iso) return 1;
      return x._i - y._i;
    });
    out.forEach(function (e) { delete e._i; });
    return out;
  }

  /* ── v3430 · DAS HAUS JE JAHR ─────────────────────────────────────────
     Marcel 15.11.2026: „die Auswertung der WEG-Protokolle und Wirtschaftspläne, das ist ja auch jedes Jahr
     Bestandteil". GEMESSEN vor v3430: die Auswertung kannte Hausgeld und Rücklage nur als Fließtext
     (weg.hausgeld, weg.ruecklage), die gespeicherte Dokumentliste trug bei Wirtschaftsplan/Abrechnung (Art
     „hausgeld") weder Jahr noch Art - der Jahresabgleich fand deshalb nie eine Abrechnung. Seit v3430:
       weg.jahre[]  (Backend dokumenteAuswerten) je Kalenderjahr Hausgeld laut Wirtschaftsplan und laut
                    Abrechnung, Rücklage, Sonderumlagen, Beschlüsse, Verwalter, welche Unterlagen vorliegen
       dokumente[]  art + jahr bei Wirtschaftsplan/Abrechnung (object-actions.js, beim Übernehmen)
     Ältere Auswertungen ohne weg.jahre: zusammengesetzt aus Dokumentdaten, Chronik und #weg_su - nichts erfunden.

     wegJahre(ausw, su, doks, opt) reine Funktion (Prüfer tools/jahresabgleich-pruefen.mjs, Abschnitt W):
       [{ jahr, versammlung, protokoll, wirtschaftsplan, abrechnung, hausgeld_plan_monat, hausgeld_ist_jahr,
          abrechnungsergebnis, ruecklage_stand, ruecklage_zufuehrung, ruecklage_anteil, su_gesamt, su_anteil,
          beschluesse: [], verwalter, quellen: [], erledigt }]  älteste zuerst
     „erledigt" = Protokoll des Jahres und (Jahresabrechnung oder Wirtschaftsplan) des Jahres. */
  function jahrAus(s) { var m = String(s == null ? '' : s).match(/(?:^|\D)((?:19|20)\d\d)(?:\D|$)/); return m ? +m[1] : null; }
  function artDok(d) {
    var a = String((d && (d.art || '')) || '').toLowerCase(), t = String((d && d.typ) || ''), lb = String((d && d.label) || '').toLowerCase();
    if (/abrechnung/.test(a) || t === 'jahresabrechnung') return 'abrechnung';
    if (/wirtschaftsplan/.test(a) || t === 'wirtschaftsplan') return 'wirtschaftsplan';
    if (t === 'weg_protokoll') return /einladung/.test(a) ? null : 'protokoll';   /* Art Abrechnung/Wirtschaftsplan oben schon erkannt */
    if (t === 'hausgeld') {   /* Bezeichnung „Wirtschaftsplan / Hausgeldabrechnung" nennt beides - nur eindeutige zählen */
      var wp = /wirtschaftsplan/.test(lb), ab = /abrechnung/.test(lb);
      return wp && !ab ? 'wirtschaftsplan' : (ab && !wp ? 'abrechnung' : null);
    }
    return null;
  }
  function wegJahre(ausw, su, doks, opt) {
    opt = opt || {};
    var a = ausw && typeof ausw === 'object' ? ausw : {}, w = a.weg && typeof a.weg === 'object' ? a.weg : {}, map = {};
    var get = function (j) {
      j = zahl(j); if (!j || j < 1950 || j > 2100) return null;
      return map[j] || (map[j] = { jahr: j, versammlung: null, protokoll: false, wirtschaftsplan: false, abrechnung: false, hausgeld_plan_monat: null, hausgeld_ist_jahr: null,
        abrechnungsergebnis: null, ruecklage_stand: null, ruecklage_zufuehrung: null, ruecklage_anteil: null, su_gesamt: null, su_anteil: null, beschluesse: [], verwalter: null, quellen: [] });
    };
    var plusQ = function (z, q) { if (z && q && z.quellen.indexOf(q) < 0) z.quellen.push(q); };
    var plusB = function (z, t) { t = String(t || '').trim(); if (z && t && !z.beschluesse.some(function (x) { return norm(x) === norm(t); })) z.beschluesse.push(t); };
    /* v3977 · F1 Gesamt-Flow 22.11.2026: die KI ordnete Hausgeld, Abrechnung und Beschlüsse einer Versammlung dem
       VORJAHR zu (Zeile 2023 mit Versammlung 18.04.2024 und Quelle „Hausgeldabrechnung 2024.pdf"), der Jahresabgleich
       stand nach dem Ergänzen um ein Jahr verschoben. Die Dokumente selbst tragen das richtige Jahr - sie entscheiden:
         · Ist/Ergebnis gehen in das Jahr der zitierten Abrechnung, der Plan in das Jahr des zitierten Wirtschaftsplans
         · widerspricht die Zeile sich selbst (Versammlung in einem anderen Jahr als „jahr"), gehen Versammlung,
           Beschlüsse und - ohne zitierten Wirtschaftsplan - der Plan in das Jahr der Versammlung
         · Rücklage und Sonderumlage bleiben (sie tragen ihren Stichtag)
         · Werte, die beim Übernehmen am Dokument selbst gespeichert wurden (d.werte), gehen allem vor
       Ein Wert aus einer Zeile, die sich nicht widerspricht, schlägt einen verschobenen. */
    var dokListe = (Array.isArray(doks) ? doks : []).filter(function (d) { return d && d.datei; });
    var zitiert = function (q) {
      var t = String(q || '').toLowerCase(); if (!t) return [];
      return dokListe.filter(function (d) { var n = String(d.datei).toLowerCase(); return n.length > 4 && t.indexOf(n) >= 0; });
    };
    var einJahr = function (liste) {
      var js = []; liste.forEach(function (j) { if (j && js.indexOf(j) < 0) js.push(j); });
      return js.length === 1 ? js[0] : null;
    };
    var setze = function (z, k, v, direkt) {
      if (!z || v == null) return;
      z._q = z._q || {};
      if (z[k] == null || (direkt && z._q[k] !== 'direkt' && z._q[k] !== 'dok')) { z[k] = v; z._q[k] = direkt ? 'direkt' : 'verschoben'; }
    };
    /* 1 · weg.jahre (seit v3430) */
    (Array.isArray(w.jahre) ? w.jahre : []).forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var J = zahl(x.jahr), z = get(J); if (!z) return;
      var dt = datumAus(x.versammlung), V = dt ? dt.jahr : null;
      var zit = zitiert(x.quelle);
      var jAb = einJahr(zit.filter(function (d) { return artDok(d) === 'abrechnung'; }).map(function (d) { return zahl(d.jahr); }));
      var jWp = einJahr(zit.filter(function (d) { return artDok(d) === 'wirtschaftsplan'; }).map(function (d) { return zahl(d.jahr); }));
      var jV = V || J, jI = jAb || J, jP = jWp || (V && V !== J ? V : J);
      var zV = get(jV) || z, zI = get(jI) || z, zP = get(jP) || z;
      if (dt) { zV.versammlung = zV.versammlung || dt.text; zV.protokoll = true; }
      if (x.protokoll === true) zV.protokoll = true;
      if (x.wirtschaftsplan === true) zP.wirtschaftsplan = true;
      if (x.jahresabrechnung === true) zI.abrechnung = true;
      setze(zP, 'hausgeld_plan_monat', zahl(x.hausgeld_plan_monat_eur), zP === z);
      setze(zI, 'hausgeld_ist_jahr', zahl(x.hausgeld_ist_jahr_eur), zI === z);
      setze(zI, 'abrechnungsergebnis', zahl(x.abrechnungsergebnis_eur), zI === z);
      ['ruecklage_stand', 'ruecklage_zufuehrung'].forEach(function (k) {
        var v = zahl(x[k + '_eur']); if (v != null) z[k] = v;
      });
      var sg = zahl(x.sonderumlagen_gesamt_eur), sa = zahl(x.sonderumlagen_anteil_eur);
      if (sg != null) z.su_gesamt = sg; if (sa != null) z.su_anteil = sa;
      if (zP.hausgeld_plan_monat != null) zP.wirtschaftsplan = true;
      if (zI.hausgeld_ist_jahr != null || zI.abrechnungsergebnis != null) zI.abrechnung = true;
      (Array.isArray(x.beschluesse) ? x.beschluesse : []).forEach(function (b) { plusB(zV, b); });
      if (zV.beschluesse.length) zV._bJ = true;
      if (x.verwalter && String(x.verwalter).trim()) { var vw = String(x.verwalter).trim(); z.verwalter = z.verwalter || vw; zV.verwalter = zV.verwalter || vw; }
      plusQ(z, x.quelle); if (zV !== z) plusQ(zV, x.quelle);
      if (zI !== z && zI !== zV) plusQ(zI, x.quelle); if (zP !== z && zP !== zV && zP !== zI) plusQ(zP, x.quelle);
    });
    /* 2 · die Dokumente selbst */
    (Array.isArray(doks) ? doks : []).forEach(function (d) {
      if (!d) return;
      var art = artDok(d); if (!art) return;
      var dt = datumAus(d.datum), j = zahl(d.jahr) || jahrAus(d.label) || (dt ? dt.jahr : null);
      if (art === 'protokoll') j = dt ? dt.jahr : j;
      var z = get(j); if (!z) return;
      if (art === 'protokoll') { z.protokoll = true; if (dt && !z.versammlung) z.versammlung = dt.text; }
      if (art === 'wirtschaftsplan') z.wirtschaftsplan = true;
      if (art === 'abrechnung') z.abrechnung = true;
      /* v3977 · Werte am Dokument (object-actions.js „merken") gehen vor - sie stammen aus genau diesem Dokument */
      var wv = d.werte && typeof d.werte === 'object' ? d.werte : null;
      if (wv) {
        z._q = z._q || {};
        var hg = zahl(wv.hausgeld_monat), ist = zahl(wv.kosten_jahr), erg = zahl(wv.ergebnis), rl = zahl(wv.ruecklage_stand);
        if (art === 'wirtschaftsplan' && hg != null) { z.hausgeld_plan_monat = hg; z._q.hausgeld_plan_monat = 'dok'; }
        if (art === 'abrechnung' && ist != null) { z.hausgeld_ist_jahr = ist; z._q.hausgeld_ist_jahr = 'dok'; }
        if (art === 'abrechnung' && erg != null) { z.abrechnungsergebnis = erg; z._q.abrechnungsergebnis = 'dok'; }
        if (rl != null && z.ruecklage_stand == null) z.ruecklage_stand = rl;
      }
      plusQ(z, (d.label || '') + (d.datum ? ' ' + d.datum : (d.jahr ? ' ' + d.jahr : '')));
    });
    /* 3 · Chronik: Beschlüsse, Verwalter, Sonderumlagen der Gemeinschaft */
    (Array.isArray(w.chronik) ? w.chronik : []).forEach(function (c) {
      if (!c || typeof c !== 'object') return;
      var dt = datumAus(c.datum), z = get(dt ? dt.jahr : c.jahr); if (!z) return;
      var art = String(c.art || '').toLowerCase();
      /* Beschlüsse der Chronik nur, wenn weg.jahre für das Jahr keine nennt (sonst zweimal derselbe Beschluss in anderen Worten) */
      if ((art === 'beschluss' || (c.status === 'beschlossen' && art !== 'sonderumlage')) && !z._bJ) plusB(z, c.titel || c.text);
      if (art === 'verwaltung' && !z.verwalter) z.verwalter = String(c.titel || c.text || '').trim() || null;
      if (art === 'sonderumlage' && zahl(c.betrag_eur) != null && z.su_gesamt == null && c.status !== 'abgelehnt' && c.status !== 'vertagt') z.su_gesamt = zahl(c.betrag_eur);
    });
    /* 4 · Sonderumlagen des Objekts (#weg_su, Anteil) - gehen vor, sie sind übernommen und bestätigt */
    var suJ = {};
    (Array.isArray(su) ? su : []).forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      var dt = datumAus(s.faellig), j = zahl(s.jahr) || (dt ? dt.jahr : null), b = zahl(s.betrag);
      if (!j || !(b > 0)) return; suJ[j] = (suJ[j] || 0) + b;
    });
    Object.keys(suJ).forEach(function (j) { var z = get(j); if (z) z.su_anteil = Math.round(suJ[j]); });
    var mea = zahl(opt.mea_pct);
    var aus = Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) { return x.jahr - y.jahr; });
    aus.forEach(function (z) {
      if (z.ruecklage_stand != null) z.ruecklage_anteil = opt.etw ? (mea > 0 ? Math.round(z.ruecklage_stand * mea / 100) : null) : z.ruecklage_stand;
      if (z.su_anteil == null && z.su_gesamt != null && !opt.etw) z.su_anteil = z.su_gesamt;
      if (z.su_anteil == null && z.su_gesamt != null && opt.etw && mea > 0) z.su_anteil = Math.round(z.su_gesamt * mea / 100);
      z.erledigt = !!(z.protokoll && (z.abrechnung || z.wirtschaftsplan));
      delete z._bJ; delete z._q;
    });
    return aus;
  }
  /** Urteil über das Haus aus den Jahreswerten (Regel, keine KI): { wort, satz } oder null */
  function urteil(J, ev, seit) {
    if (!J || !J.length) return null;
    var ab = zahl(seit) || J[0].jahr, nach = J.filter(function (z) { return z.jahr >= ab; });
    var su = nach.filter(function (z) { return (z.su_anteil || 0) > 0 || (z.su_gesamt || 0) > 0; });
    var rl = J.filter(function (z) { return z.ruecklage_stand != null; });
    var trend = rl.length >= 2 ? rl[rl.length - 1].ruecklage_stand - rl[0].ruecklage_stand : null;
    var hg = J.filter(function (z) { return z.hausgeld_plan_monat != null; });
    var hgPct = hg.length >= 2 && hg[0].hausgeld_plan_monat > 0 ? (hg[hg.length - 1].hausgeld_plan_monat / hg[0].hausgeld_plan_monat - 1) * 100 : null;
    var streit = (ev || []).filter(function (e) { return e.art === 'rechtsstreit' && String(e.status || '').toLowerCase() !== 'erledigt'; }).length;
    var jahreN = Math.max(1, (J[J.length - 1].jahr - ab) + 1);
    var wort = streit || su.length >= 2 ? 'Unruhiges Haus.' : (su.length || (trend != null && trend < 0) ? 'Haus mit Baustellen.' : 'Ruhiges Haus.');
    var t = [];
    t.push(su.length ? (su.length === 1 ? 'Eine Sonderumlage' : su.length + ' Sonderumlagen') + ' in ' + jahreN + (jahreN === 1 ? ' Jahr' : ' Jahren') + ' (' + su.map(function (z) { return z.jahr; }).join(', ') + ').'
      : 'Keine Sonderumlage in ' + jahreN + (jahreN === 1 ? ' Jahr' : ' Jahren') + ' der Unterlagen.');
    if (trend != null) t.push('Die Rücklage ' + (trend > 0 ? 'steigt' : trend < 0 ? 'sinkt' : 'bleibt gleich') + ' (' + rl[0].jahr + ': ' + eur(rl[0].ruecklage_stand) + ', ' + rl[rl.length - 1].jahr + ': ' + eur(rl[rl.length - 1].ruecklage_stand) + ').');
    if (hgPct != null && Math.abs(hgPct) >= 0.5) t.push('Hausgeld ' + (hgPct > 0 ? '+' : '−') + Math.abs(hgPct).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' % seit ' + hg[0].jahr + '.');
    if (streit) t.push(streit === 1 ? 'Ein Rechtsstreit ist offen.' : streit + ' Rechtsstreite sind offen.');
    return { wort: wort, satz: t.join(' ') };
  }

  /* ── Browser ───────────────────────────────────────────────────────── */
  function el(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }
  function wert(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
  function istEtw() { return /ETW/i.test(wert('objart')); }
  function lesen() {
    var d = null, su = [];
    try { var f = el('_dok_auswertung'); d = f && f.value ? JSON.parse(f.value) : null; } catch (e) { d = null; }
    try { su = g.DpSonderumlage && g.DpSonderumlage.liste ? g.DpSonderumlage.liste() : []; } catch (e) { su = []; }
    var doks = d && Array.isArray(d.dokumente) ? d.dokumente : [];
    var hatWeg = !!(d && d.auswertung && d.auswertung.weg) || doks.some(function (x) { return x && WEG_TYPEN.test(String(x.typ || '')); }) || su.length > 0;
    var jahre = [];
    try { jahre = wegJahre(d && d.auswertung, su, doks, { etw: istEtw(), mea_pct: wert('mea') }); } catch (e) { jahre = []; }
    return { d: d, su: su, doks: doks, hatWeg: hatWeg, liste: ereignisse(d && d.auswertung, su, doks), jahre: jahre };
  }
  /** Ein Jahr für den Jahresabgleich (jahresabgleich.js) */
  function jahrDaten(j, L) {
    L = L || lesen();
    return (L.jahre || []).filter(function (z) { return z.jahr === j; })[0] || null;
  }
  function kaufJahr() {
    try { var A = g.DealPilotAnkauf, s = A && A.vorhanden && A.vorhanden() ? A.stand() : null; if (s && s.stichtag) return +String(s.stichtag).slice(0, 4); } catch (e) {}
    return jahrAus(wert('kaufdat'));
  }
  function kurz() {
    var L = lesen(); if (!L.hatWeg || !L.liste.length) return null;
    var j = L.liste.map(function (e) { return e.jahr; }).filter(Boolean);
    return { zahl: L.liste.length + ' Ereignisse', unter: j.length ? 'aus WEG-Unterlagen ' + Math.min.apply(null, j) + '–' + Math.max.apply(null, j) : 'aus WEG-Unterlagen' };
  }
  function stil() {
    if (document.getElementById('dp-hv-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-hv-stil';
    s.textContent = [
      '.dp-hv-erg{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;padding:2px 0 14px;border-bottom:1px solid #EFE8D6;margin-bottom:14px}',
      '.dp-hv-erg .satz{font:500 17px/1.4 "Space Grotesk",Inter,sans-serif;color:#2A2727;max-width:720px}',
      '.dp-hv-erg .satz b{font-weight:700}',
      '.dp-hv-erg .q{display:block;font:400 12.5px/1.55 Inter,sans-serif;color:#6B645A;margin-top:6px}',
      '.dp-hv-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #EFE8D6;border-radius:10px;overflow:hidden;background:#fff}',
      '.dp-hv-kpi{padding:11px 14px;border-right:1px solid #EFE8D6;min-width:0}.dp-hv-kpi:last-child{border-right:none}',
      '.dp-hv-kpi small{display:block;font:500 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A}',
      '.dp-hv-kpi b{display:block;font:600 19px "Space Grotesk",Inter,sans-serif;color:#2A2727;margin-top:2px;overflow-wrap:anywhere}',
      '.dp-hv-kpi b.txt{font:600 14.5px/1.3 Inter,sans-serif}',
      '.dp-hv-kpi span{display:block;font:400 11.5px Inter,sans-serif;color:#7A7370;margin-top:1px}',
      '.dp-hv-abs{display:flex;align-items:baseline;gap:12px;margin:22px 0 8px}',
      '.dp-hv-abs h4{margin:0;font:600 14.5px "Space Grotesk",Inter,sans-serif;color:#2A2727}',
      '.dp-hv-abs span{margin-left:auto;font:500 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#9A9285}',
      '.dp-hv-tab{overflow-x:auto;border:1px solid #EFE8D6;border-radius:10px;background:#fff}',
      '.dp-hv-tab table{width:100%;border-collapse:collapse;font:400 12.5px Inter,sans-serif;color:#2A2727;min-width:640px}',
      '.dp-hv-tab th,.dp-hv-tab td{text-align:right;padding:8px 10px;border-bottom:1px solid #F1EBDD;font-variant-numeric:tabular-nums;white-space:nowrap;vertical-align:top}',
      '.dp-hv-tab tr:last-child td{border-bottom:none}',
      '.dp-hv-tab th:first-child,.dp-hv-tab td:first-child{text-align:left}',
      '.dp-hv-tab td.txt,.dp-hv-tab th.txt{text-align:left;white-space:normal;min-width:200px}',
      '.dp-hv-tab th{font:500 10px "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B645A;border-bottom:1px solid #E6DCC2;vertical-align:bottom}',
      '.dp-hv-tab td small{display:block;color:#9A9285;font-size:11px}',
      '.dp-hv-tab .rot{color:#B8625C}',
      '.dp-hv-u{display:inline-flex;gap:3px}.dp-hv-u i{font:600 9.5px "JetBrains Mono",monospace;font-style:normal;width:16px;height:16px;border-radius:4px;display:inline-grid;place-items:center;background:rgba(42,39,39,.06);color:#9A9285}',
      '.dp-hv-u i.da{background:rgba(63,165,108,.14);color:#2f7d52}',
      '.dp-hv-lage{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:0 0 12px}',
      '.dp-hv-k{border:1px solid #E6DCC2;border-radius:12px;background:#fff;padding:11px 13px;display:grid;gap:3px;align-content:start;min-width:0}',
      '.dp-hv-k small{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A}',
      '.dp-pa-wrap .dp-hv-k p{margin:0;font:400 12.5px/1.55 Inter,sans-serif;color:#2A2727;text-align:left !important;hyphens:auto}',
      '.dp-hv-filter{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
      '.dp-pa-wrap .dp-hv-filter button{border:1px solid #E6DCC2 !important;background:#fff !important;border-radius:999px !important;padding:3px 10px !important;font:500 11.5px Inter,sans-serif !important;cursor:pointer;color:#2A2727 !important;box-shadow:none !important;min-height:0 !important}',
      '.dp-pa-wrap .dp-hv-filter button[aria-pressed="false"]{opacity:.45}',
      '.dp-hv-filter i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:0}',
      '.dp-hv-zeit{position:relative;margin:4px 0 0;padding:0 0 0 22px}',
      '.dp-hv-zeit::before{content:"";position:absolute;left:6px;top:4px;bottom:4px;width:2px;background:#E6DCC2}',
      '.dp-hv-jahr{font:700 15px "Space Grotesk",Inter,sans-serif;color:#2A2727;margin:14px 0 6px -22px;padding-left:0}',
      '.dp-hv-jahr:first-child{margin-top:0}',
      '.dp-hv-e{position:relative;border:1px solid #EFE8D6;border-radius:10px;background:#fff;padding:9px 12px;margin:0 0 8px;display:grid;gap:3px}',
      '.dp-hv-e::before{content:"";position:absolute;left:-21px;top:13px;width:10px;height:10px;border-radius:50%;background:var(--c,#2A2727);border:2px solid #fff;box-shadow:0 0 0 1px #E6DCC2}',
      '.dp-hv-kopf{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}',
      '.dp-hv-kopf .d{font:600 11px "JetBrains Mono",monospace;color:#7A7370}',
      '.dp-hv-kopf .a{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--c,#2A2727)}',
      '.dp-hv-kopf b{font:600 13.5px Inter,sans-serif;color:#2A2727}',
      '.dp-hv-kopf .betrag{margin-left:auto;font:700 13px "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums}',
      '.dp-hv-e p{margin:0;font:400 12.5px/1.55 Inter,sans-serif;color:#4A4542;text-align:justify;hyphens:auto}',
      '.dp-hv-e .q{font:400 11px Inter,sans-serif;color:#9A9285}',
      '.dp-hv-st{display:inline-block;font:600 10.5px Inter,sans-serif;padding:1px 8px;border-radius:999px;background:rgba(42,39,39,.07);color:#4A4542}',
      '.dp-hv-st.beschlossen{background:rgba(184,98,92,.13);color:#B8625C}.dp-hv-st.erledigt{background:rgba(63,165,108,.14);color:#2f7d52}',
      '.dp-hv-st.geplant,.dp-hv-st.angekuendigt{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent);color:#8a6d1f}',
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-hv-e.leise{display:none}',
      '@media (max-width:720px){.dp-hv-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-hv-kpi:nth-child(2n){border-right:none}.dp-hv-kpi:nth-child(-n+2){border-bottom:1px solid #EFE8D6}.dp-hv-erg .satz{font-size:15.5px}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function knoepfe() {
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
      + '<button type="button" class="btn-clean dp-pa4-btn" onclick="try{if(window.DpUnterlagen&&DpUnterlagen.nachreichen)DpUnterlagen.nachreichen();else if(window.DpEingang)DpEingang.oeffnen();}catch(e){}">WEG-Unterlagen hochladen</button>'
      + '<button type="button" class="btn-clean dp-pa4-btn leise" data-dp-pa4-geh="unterlagen">Zu Unterlagen &amp; WEG</button></div>';
  }
  function eurO(v) { return v != null ? eur(v) : '–'; }
  function kennzahlen(L, w) {
    var J = L.jahre || [], k = [];
    var hg = J.filter(function (z) { return z.hausgeld_plan_monat != null; }), hgL = hg[hg.length - 1];
    var hgI = J.filter(function (z) { return z.hausgeld_ist_jahr != null; }), hgIL = hgI[hgI.length - 1];
    var ul = zahl(wert('hg_ul')), nul = zahl(wert('hg_nul'));
    if (hgL) k.push(['Hausgeld im Monat', eur(hgL.hausgeld_plan_monat), 'Wirtschaftsplan ' + hgL.jahr + (hg.length > 1 ? ', ' + hg[0].jahr + ': ' + eur(hg[0].hausgeld_plan_monat) : '')]);
    else if (hgIL) k.push(['Hausgeld im Monat', eur(hgIL.hausgeld_ist_jahr / 12), 'laut Abrechnung ' + hgIL.jahr]);
    else if ((ul || 0) + (nul || 0) > 0) k.push(['Hausgeld im Monat', eur(((ul || 0) + (nul || 0)) / 12), 'aus dem Reiter Bewirtschaftung' + (nul ? ', nicht umlegbar ' + eur(nul / 12) : '')]);
    else k.push(['Hausgeld im Monat', '–', 'kein Wirtschaftsplan eingelesen']);
    var rl = J.filter(function (z) { return z.ruecklage_stand != null; }), rlL = rl[rl.length - 1];
    k.push(['Rücklage der Gemeinschaft', rlL ? eur(rlL.ruecklage_stand) : '–', rlL ? (rlL.jahr + (rlL.ruecklage_anteil != null && rlL.ruecklage_anteil !== rlL.ruecklage_stand ? ' · Anteil ' + eur(rlL.ruecklage_anteil) : '') + (rl.length > 1 ? ' · ' + rl[0].jahr + ': ' + eur(rl[0].ruecklage_stand) : '')) : (w.ruecklage ? String(w.ruecklage).slice(0, 70) : 'nicht genannt')]);
    var kj = kaufJahr(), suS = 0, suN = 0;
    J.forEach(function (z) { if ((!kj || z.jahr >= kj) && (z.su_anteil || 0) > 0) { suS += z.su_anteil; suN++; } });
    k.push(['Sonderumlagen', suN ? eur(suS) : 'keine', (kj ? 'seit dem Kauf ' + kj : 'in den Unterlagen') + (suN ? ' · in ' + suN + (suN === 1 ? ' Jahr' : ' Jahren') + (istEtw() ? ', dein Anteil' : '') : '')]);
    var vw = J.filter(function (z) { return z.verwalter; }), vwL = vw[vw.length - 1];
    var wechsel = (L.liste || []).filter(function (e) { return e.art === 'verwaltung' && /wechsel|neu bestellt|neue verwaltung|neuer verwalter/i.test((e.titel || '') + ' ' + (e.text || '')); });
    k.push(['Verwaltung', vwL ? esc(String(vwL.verwalter).slice(0, 40)) : (w.verwaltung ? esc(String(w.verwaltung).split(/[.;]/)[0].slice(0, 40)) : '–'), wechsel.length ? 'Wechsel ' + (wechsel[wechsel.length - 1].jahr || '') : (vw.length > 1 ? 'seit ' + vw[0].jahr + ' genannt' : 'kein Wechsel genannt'), true]);
    return '<div class="dp-hv-kpis">' + k.map(function (x) { return '<div class="dp-hv-kpi"><small>' + esc(x[0]) + '</small><b' + (x[3] ? ' class="txt"' : '') + '>' + x[1] + '</b><span>' + esc(x[2]) + '</span></div>'; }).join('') + '</div>';
  }
  function tabelle(J) {
    if (!J.length) return '';
    var u = function (z) { return '<span class="dp-hv-u" title="Protokoll · Wirtschaftsplan · Abrechnung">'
      + '<i class="' + (z.protokoll ? 'da' : '') + '">P</i><i class="' + (z.wirtschaftsplan ? 'da' : '') + '">W</i><i class="' + (z.abrechnung ? 'da' : '') + '">A</i></span>'; };
    return '<div class="dp-hv-tab"><table><thead><tr><th>Jahr</th><th class="txt">Versammlung und Beschlüsse</th><th>Hausgeld<br>Plan · Monat</th><th>Hausgeld<br>Abrechnung · Jahr</th><th>Sonder&shy;umlage</th><th>Rücklage</th><th>Unterlagen</th></tr></thead><tbody>'
      + J.slice().reverse().map(function (z) {
        var b = z.beschluesse.slice(0, 3).map(esc).join(' · ');
        return '<tr data-dp-hv-jahr="' + z.jahr + '"><td><b>' + z.jahr + '</b></td>'
          + '<td class="txt">' + (z.versammlung ? z.versammlung.slice(0, 6) + (b ? ' · ' : '') : '') + (b || (z.versammlung ? 'Versammlung' : '<span style="color:#9A9285">kein Protokoll</span>')) + '</td>'
          + '<td>' + eurO(z.hausgeld_plan_monat) + '</td>'
          + '<td>' + eurO(z.hausgeld_ist_jahr) + (z.abrechnungsergebnis != null ? '<small>' + (z.abrechnungsergebnis > 0 ? 'Nachzahlung ' : 'Guthaben ') + eur(Math.abs(z.abrechnungsergebnis)) + '</small>' : '') + '</td>'
          + '<td' + ((z.su_anteil || z.su_gesamt) ? ' class="rot"' : '') + '>' + (z.su_anteil != null ? eur(z.su_anteil) : (z.su_gesamt != null ? eur(z.su_gesamt) + '<small>Gemeinschaft</small>' : '–')) + '</td>'
          + '<td>' + eurO(z.ruecklage_stand) + (z.ruecklage_anteil != null && z.ruecklage_anteil !== z.ruecklage_stand ? '<small>Anteil ' + eur(z.ruecklage_anteil) + '</small>' : '') + '</td>'
          + '<td>' + u(z) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  /** Spec der Grafik Hausgeld + Rücklage (jahresbuch-grafik.js), null ohne zwei Jahre mit Zahl */
  function grafikSpec(J) {
    var mit = J.filter(function (z) { return z.hausgeld_plan_monat != null || z.hausgeld_ist_jahr != null || z.ruecklage_stand != null; });
    if (mit.length < 2) return null;
    var G = g.DpJahresbuchGrafik || {}, a = mit[0].jahr, b = mit[mit.length - 1].jahr, jahre = [];
    for (var y = a; y <= b; y++) jahre.push(y);
    var wp = {}, ab = {}, rl = {}, marken = [];
    J.forEach(function (z) {
      if (z.hausgeld_plan_monat != null) wp[z.jahr] = Math.round(z.hausgeld_plan_monat * 12);
      if (z.hausgeld_ist_jahr != null) ab[z.jahr] = z.hausgeld_ist_jahr;
      if (z.ruecklage_stand != null) rl[z.jahr] = z.ruecklage_stand;
      var su = z.su_anteil != null ? z.su_anteil : z.su_gesamt;
      if (su > 0) marken.push({ jahr: z.jahr, text: 'Sonderumlage ' + z.jahr + ': ' + eur(su) + (z.su_anteil != null ? (istEtw() ? ' (dein Anteil)' : '') : ' (Gemeinschaft)'), farbe: G.ROT || '#B8625C', art: 'Sonderumlage', legende: 'Sonderumlage' });
    });
    var panels = [];
    if (Object.keys(wp).length || Object.keys(ab).length) panels.push({ titel: 'Hausgeld je Jahr' + (istEtw() ? ', deine Wohnung' : ''), kurz: 'Hausgeld', art: 'balken', hoehe: 130, marken: marken, serien: [
      { name: 'Wirtschaftsplan (Plan)', typ: 'balken', farbe: G.GRAU || '#8A8278', deckkraft: 0.45, werte: wp },
      { name: 'Jahresabrechnung (Ist)', typ: 'balken', farbe: G.GOLD, werte: ab }] });
    if (Object.keys(rl).length >= 2) panels.push({ titel: 'Erhaltungsrücklage der Gemeinschaft, Stand', kurz: 'Rücklage', art: 'linie', hoehe: 110, marken: panels.length ? [] : marken, serien: [
      { name: 'Rücklage', typ: 'linie', strich: 'ist', farbe: G.TINTE || '#5B544C', werte: rl, ende: false }] });
    return panels.length ? { jahre: jahre, heute: new Date().getFullYear(), panels: panels, titel: 'Hausgeld und Rücklage je Jahr' } : null;
  }
  function abschnitt(t, eti) { return '<div class="dp-hv-abs"><h4>' + t + '</h4>' + (eti ? '<span>' + esc(eti) + '</span>' : '') + '</div>'; }
  function html() {
    if (typeof document === 'undefined') return '';
    stil();
    var L = lesen();
    var leer = '<div class="dp-pa-card"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Hausverlauf</span><span class="dp-pa-rule"></span></div>'
      + '<p class="dp-pa-p">Hier steht, wie sich das Haus verhält – Hausgeld laut Wirtschaftsplan und Abrechnung, Rücklage, Sonderumlagen, Beschlüsse und Verwalter, Jahr für Jahr. '
      + 'Die Grundlage sind die WEG-Unterlagen dieses Objekts: Protokolle der Eigentümerversammlung, Wirtschaftspläne und Jahresabrechnungen. Sie gehören jedes Jahr in den Jahresabgleich.</p>'
      + '<p class="dp-pa-p">Noch ist keine WEG-Unterlage eingelesen. Lade ein Protokoll hoch – nichts wird ohne deine Bestätigung ins Objekt übernommen.</p>' + knoepfe() + '</div>';
    /* ohne WEG-Unterlagen nur bei Wohnungseigentum (dort gibt es eine Gemeinschaft) - ein ganzes Haus ohne WEG bekommt keinen leeren Reiter */
    if (!L.hatWeg || (!L.liste.length && !L.jahre.length)) return istEtw() ? leer : '';
    var w = (L.d && L.d.auswertung && L.d.auswertung.weg) || {}, J = L.jahre || [];
    var u = urteil(J, L.liste, kaufJahr());
    var h = '<div class="dp-pa-card" data-dp-hv="1">';
    h += '<div class="dp-hv-erg"><div class="satz">' + (u ? '<b>' + esc(u.wort) + '</b> ' + esc(u.satz) : '<b>Das Haus in den Unterlagen.</b>')
      + (w.fazit ? '<span class="q">' + esc(w.fazit) + '</span>' : '') + '</div>'
      + '<button type="button" class="btn-clean dp-pa4-btn" onclick="try{if(window.DpUnterlagen&&DpUnterlagen.nachreichen)DpUnterlagen.nachreichen();else if(window.DpEingang)DpEingang.oeffnen();}catch(e){}">Unterlagen hochladen</button></div>';
    h += kennzahlen(L, w);
    var sp = grafikSpec(J);
    if (sp) h += abschnitt('Hausgeld und Rücklage', 'je Jahr · aus Wirtschaftsplänen und Abrechnungen') + '<div data-dp-hv-grafik="1"></div>';
    if (J.length) h += abschnitt('Jahr für Jahr', 'aus Protokollen, Wirtschaftsplänen, Abrechnungen') + tabelle(J)
      + '<p class="dp-pa-fuss" style="margin-top:6px">P Protokoll · W Wirtschaftsplan · A Jahresabrechnung. Ein Jahr ist im Jahresabgleich erledigt, wenn das Protokoll und der Wirtschaftsplan oder die Abrechnung des Jahres vorliegen.'
      + (!(w.jahre && w.jahre.length) ? ' Diese Auswertung ist älter als die Jahreswerte (v3430): Hausgeld und Rücklage je Jahr stehen hier, sobald du Unterlagen nachreichst.' : '') + '</p>';
    h += '</div>';
    /* die Zeitleiste, nach Jahren */
    var arten = []; L.liste.forEach(function (e) { if (arten.indexOf(e.art) < 0) arten.push(e.art); });
    var filter = arten.length > 1 ? '<div class="dp-hv-filter" role="group" aria-label="Nach Art filtern">' + arten.map(function (a) {
      return '<button type="button" class="btn-clean" aria-pressed="true" data-dp-hv-art="' + a + '"><i style="background:' + ARTEN[a][1] + '"></i>' + ARTEN[a][0] + '</button>';
    }).join('') + '</div>' : '';
    var zeit = '', jahr = null;
    L.liste.forEach(function (e) {
      var j = e.jahr || 'ohne Jahr';
      if (j !== jahr) { zeit += '<div class="dp-hv-jahr">' + esc(j) + '</div>'; jahr = j; }
      var A = ARTEN[e.art] || ARTEN.sonstiges, st = String(e.status || '').toLowerCase();
      /* Einfach: reine Versammlungsmarken ohne Inhalt treten zurück */
      zeit += '<div class="dp-hv-e' + (e.art === 'versammlung' ? ' leise' : '') + '" data-dp-hv-e="' + e.art + '" style="--c:' + A[1] + '"><div class="dp-hv-kopf">'
        + (e.datum && e.datum !== String(e.jahr) ? '<span class="d">' + esc(e.datum) + '</span>' : '')
        + '<span class="a">' + A[0] + '</span>' + (e.titel ? '<b>' + esc(e.titel) + '</b>' : '')
        + (st ? '<span class="dp-hv-st ' + esc(st.replace(/[^a-zäöü]/g, '')) + '">' + esc(e.status) + '</span>' : '')
        + (e.betrag != null ? '<span class="betrag">' + eur(e.betrag) + (e.anteil ? ' <small style="font:400 10.5px Inter;color:#7A7370">Anteil</small>' : '') + '</span>' : '') + '</div>'
        + (e.text ? '<p>' + esc(e.text) + '</p>' : '') + (e.quelle ? '<span class="q dp-pa-d">Quelle: ' + esc(e.quelle) + '</span>' : '') + '</div>';
    });
    if (L.liste.length) h += '<div class="dp-pa-card dp-pa4-mt"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Was passiert ist</span><span class="dp-pa-rule"></span></div>'
      + filter + '<div class="dp-hv-zeit">' + zeit + '</div>'
      + (L.liste.some(function (e) { return e.herkunft === 'kernpunkt'; }) ? '<p class="dp-pa-fuss">Diese Auswertung nennt die Ereignisse nur mit Jahr. Beim nächsten Einlesen von Unterlagen steht jedes mit seinem Datum und seiner Quelle hier.</p>' : '')
      + '</div>';
    h += '<div class="dp-pa-card dp-pa4-mt"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Weitere WEG-Unterlagen</span><span class="dp-pa-rule"></span></div>'
      + '<p class="dp-pa-p">Jedes Jahr ein neues Protokoll, den Wirtschaftsplan und die Jahresabrechnung hochladen: die Auswertung wird mit den bisherigen Unterlagen zusammengeführt, die Jahreswerte ergänzt. Nichts wird ohne deine Bestätigung ins Objekt übernommen.</p>'
      + '<p class="dp-pa-p" style="font-size:12px;color:#7A7370">Eingelesen: ' + (L.doks.filter(function (x) { return x && WEG_TYPEN.test(String(x.typ || '')); }).map(function (x) { return esc(x.label + (x.datum ? ' ' + x.datum : (x.jahr ? ' ' + x.jahr : ''))); }).join(' · ') || '–') + '</p>'
      + knoepfe() + '</div>';
    /* die Grafik zeichnet nach dem Einhängen (der Host ist erst dann im Dokument) */
    if (sp) setTimeout(mountGrafik, 0);
    return h;
  }
  function mountGrafik() {
    var G = g.DpJahresbuchGrafik; if (!G || !G.malen || typeof document === 'undefined') return;
    var hs = document.querySelectorAll('[data-dp-hv-grafik]'); if (!hs.length) return;
    var sp = null; try { sp = grafikSpec(lesen().jahre || []); } catch (e) { sp = null; }
    for (var i = 0; i < hs.length; i++) { try { if (sp) G.malen(hs[i], sp); else hs[i].innerHTML = ''; } catch (e) { hs[i].innerHTML = ''; } }
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-dp-hv-art]') : null; if (!b) return;
    var an = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(an));
    var card = b.closest('.dp-pa-card'), art = b.getAttribute('data-dp-hv-art');
    if (card) Array.prototype.forEach.call(card.querySelectorAll('[data-dp-hv-e="' + art + '"]'), function (e) { e.style.display = an ? '' : 'none'; });
  });

  g.DpHausverlauf = { VERSION: 'v3977', ereignisse: ereignisse, wegJahre: wegJahre, urteil: urteil, artDok: artDok, html: html, kurz: kurz, lesen: lesen, jahrDaten: jahrDaten, grafikSpec: grafikSpec, mountGrafik: mountGrafik, ARTEN: ARTEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.DpHausverlauf;
})(typeof window !== 'undefined' ? window : globalThis);
