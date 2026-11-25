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
    /* v4780 · entfernte Unterlagen (Verlauf: Zurücknehmen/Löschen) zählen nicht mehr - ihre Protokolle, Jahre und Risiken fallen */
    var doks = d && Array.isArray(d.dokumente) ? d.dokumente.filter(function (x) { return x && !x.entfernt; }) : [];
    var hatWeg =!!(d && d.auswertung && d.auswertung.weg) || doks.some(function (x) { return x && WEG_TYPEN.test(String(x.typ || '')); }) || su.length > 0;
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
      /* v4007 */
      '.dp-hv-hoch{display:grid;gap:5px;justify-items:start;max-width:320px}.dp-hv-hoch span{font:400 11.5px/1.45 Inter,sans-serif;color:#7A7370}',
      '.dp-hv-eing{margin:-6px 0 12px !important}',
      '.dp-hv-risj{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:6px;margin:8px 0 4px}',
      '.dp-hv-risj>div{border:1px solid #EFE8D6;border-radius:8px;background:#fff;padding:7px 9px;display:grid;gap:2px;min-width:0}',
      '.dp-hv-risj small{font:600 10.5px "JetBrains Mono",monospace;color:#6B645A}',
      '.dp-hv-risj b{font:600 12px Inter,sans-serif}.dp-hv-risj b.k{color:#B8625C}.dp-hv-risj b.h{color:var(--wl-9a7f33,#9a7f33)}',
      '.dp-hv-risj span{font:400 11.5px Inter,sans-serif;color:#9A9285}',
      '.dp-hv-risj>.krit{border-color:rgba(184,98,92,.45);box-shadow:inset 3px 0 0 #B8625C}.dp-hv-risj>.hand{border-color:color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 45%,transparent);box-shadow:inset 3px 0 0 var(--wl-c9a84c,#C9A84C)}',
      '.dp-hv-ampel{margin:4px 0 0 !important}',
      /* v4780 · Jahreskacheln als Knöpfe mit Absprung, Risiken oben mit Jahresfilter, Tooltip ohne Browser-Titel */
      '.dp-pa-wrap .dp-hv-risj>button{position:relative;text-align:left;cursor:pointer;font:inherit;border:1px solid #EFE8D6 !important;border-radius:8px !important;background:#fff !important;padding:7px 9px !important;display:grid;gap:2px;min-width:0;color:inherit;transition:border-color .15s,box-shadow .15s}',
      '.dp-pa-wrap .dp-hv-risj>button:hover:not([disabled]),.dp-pa-wrap .dp-hv-risj>button:focus-visible{border-color:var(--wl-c9a84c,#C9A84C) !important}',
      '.dp-pa-wrap .dp-hv-risj>button[disabled]{cursor:default;opacity:.75}',
      '.dp-pa-wrap .dp-hv-risj>button.krit{border-color:rgba(184,98,92,.45) !important;box-shadow:inset 3px 0 0 #B8625C}',
      '.dp-pa-wrap .dp-hv-risj>button.hand{border-color:color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 45%,transparent) !important;box-shadow:inset 3px 0 0 var(--wl-c9a84c,#C9A84C)}',
      '.dp-hv-risj .hv-tt,.dp-hv-rk .hv-tt{display:none;position:absolute;z-index:30;left:0;top:calc(100% + 6px);width:max-content;max-width:min(340px,86vw);background:#2A2727;color:#FDFCFA;font:400 12px/1.5 Inter,sans-serif;font-style:normal;padding:9px 11px;border-radius:8px;box-shadow:0 8px 22px rgba(0,0,0,.18);text-align:left;white-space:normal}',
      '.dp-hv-risj .hv-tt i{color:#E8CC7A;font-style:normal}.dp-hv-rk .hv-tt small{display:block;margin-top:5px;color:#C9C2B6;font-size:11px}.dp-hv-rk .hv-tt strong{color:#E8CC7A}',
      '.dp-hv-risj>button:hover .hv-tt,.dp-hv-risj>button:focus-visible .hv-tt,.dp-hv-rk:hover .hv-tt,.dp-hv-rk:focus .hv-tt{display:block}',
      '.dp-hv-ris{margin:16px 0 4px}.dp-hv-ris .dp-hv-abs{margin-top:6px}',
      '.dp-hv-rf{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
      '.dp-pa-wrap .dp-hv-rf button{border:1px solid #E6DCC2 !important;background:#fff !important;border-radius:999px !important;padding:3px 11px !important;font:600 11.5px Inter,sans-serif !important;color:#4A4542 !important;cursor:pointer}',
      '.dp-pa-wrap .dp-hv-rf button i{font-style:normal;font-weight:500;color:#9A9285;margin-left:3px}',
      '.dp-pa-wrap .dp-hv-rf button.on{background:#2A2727 !important;border-color:#2A2727 !important;color:#FDFCFA !important}.dp-pa-wrap .dp-hv-rf button.on i{color:#E8CC7A}',
      '.dp-hv-rl{display:grid;gap:6px}',
      '.dp-hv-rk{position:relative;display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid #EFE8D6;border-radius:9px;background:#fff;padding:8px 12px;cursor:default;outline:none}',
      '.dp-hv-rk:focus-visible{border-color:var(--wl-c9a84c,#C9A84C)}',
      '.dp-hv-rk .hv-pt{width:9px;height:9px;border-radius:50%;background:#9A9285}.dp-hv-rk.hoch .hv-pt{background:#B8625C}.dp-hv-rk.mittel .hv-pt{background:var(--wl-c9a84c,#C9A84C)}.dp-hv-rk.niedrig .hv-pt{background:#3FA56C}',
      '.dp-hv-rk b{font:600 13px/1.35 Inter,sans-serif;color:#2A2727;min-width:0;overflow-wrap:anywhere}',
      '.dp-hv-rk .hv-m{font:600 11.5px "JetBrains Mono",monospace;color:#6B645A;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.dp-hv-rk.ueber{display:none}.dp-hv-ris:not([data-filter="alle"]) .dp-hv-rk.ueber{display:grid}',
      '.dp-hv-rk.aus,.dp-hv-rkk.aus{display:none !important}',
      '.dp-hv-rm{margin:4px 0 0;font:400 11.5px Inter,sans-serif;color:#7A7370}',
      '.dp-hv-rleer{margin:6px 0 0;font:400 12px Inter,sans-serif;color:#7A7370}',
      '.dp-hv-rd{display:grid;gap:8px}',
      '.dp-hv-rkk{border:1px solid #EFE8D6;border-left:3px solid #9A9285;border-radius:9px;background:#fff;padding:10px 13px;display:grid;gap:5px}',
      '.dp-hv-rkk.hoch{border-left-color:#B8625C}.dp-hv-rkk.mittel{border-left-color:var(--wl-c9a84c,#C9A84C)}.dp-hv-rkk.niedrig{border-left-color:#3FA56C}',
      '.dp-hv-rkk .hv-k{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}.dp-hv-rkk .hv-k b{font:600 13.5px/1.35 Inter,sans-serif;color:#2A2727}',
      '.dp-hv-rkk .hv-p{font:600 10px/1 Inter,sans-serif;padding:3px 8px;border-radius:999px;background:rgba(42,39,39,.07);color:#4A4542}',
      '.dp-hv-rkk .hv-p.hoch{background:rgba(184,98,92,.13);color:#B8625C}.dp-hv-rkk .hv-p.mittel{background:color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 18%,transparent);color:#8a6d1f}.dp-hv-rkk .hv-p.niedrig{background:rgba(63,165,108,.14);color:#2f7d52}',
      '.dp-hv-rkk .hv-m{font:600 11.5px "JetBrains Mono",monospace;color:#6B645A;font-variant-numeric:tabular-nums}',
      '.dp-pa-wrap .dp-hv-rkk p{margin:0;font:400 12.5px/1.55 Inter,sans-serif;color:#4A4542;text-align:left !important;hyphens:auto}',
      '.dp-pa-wrap .dp-hv-rkk .hv-f{display:flex !important;flex-direction:row !important;flex-wrap:wrap;align-items:center !important;justify-content:flex-start !important;gap:6px 12px;height:auto}.dp-pa-wrap .dp-hv-rkk .hv-f small{display:block;text-align:left;font:400 11px Inter,sans-serif;color:#9A9285;flex:1 1 220px;min-width:0}',
      '.dp-hv-rkk .hv-zu{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}',
      '.dp-pa-wrap .dp-hv-rkk .hv-zu button{border:1px solid color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 55%,transparent) !important;background:#fff !important;border-radius:999px !important;padding:3px 10px !important;font:600 11px Inter,sans-serif !important;color:var(--wl-9a7f33,#9a7f33) !important;cursor:pointer}',
      '.dp-hv-blink{animation:dpHvBlink 2.2s ease-out}',
      '@keyframes dpHvBlink{0%,30%{box-shadow:0 0 0 3px color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 55%,transparent)}100%{box-shadow:0 0 0 0 transparent}}',
      '.dp-hv-gx{margin:18px 0 6px}.dp-hv-gx-rl{margin-top:10px;padding-top:10px;border-top:1px solid #F1EBDD}',
      /* die Risiken stehen jetzt oben im Hausverlauf, der Teil Unterlagen darunter wiederholt sie nicht */
      '#dp-pa-haus:has([data-dp-hv-ris]) .dpu-risk{display:none !important}',
      '@media (max-width:720px){.dp-hv-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-hv-kpi:nth-child(2n){border-right:none}.dp-hv-kpi:nth-child(-n+2){border-bottom:1px solid #EFE8D6}.dp-hv-erg .satz{font-size:15.5px}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  /* v4007 · EIN Weg zum Hochladen im Reiter Haus & Unterlagen: der Eingang (unterlagen-eingang.js) liest
     WEG-Unterlagen, Belege und Rechnungen und ergaenzt eine vorhandene Auswertung (wie „nachreichen“). */
  var HOCH = "try{if(window.DpEingang&&DpEingang.oeffnen)DpEingang.oeffnen();else if(window.DpUnterlagen&&DpUnterlagen.nachreichen)DpUnterlagen.nachreichen();}catch(e){}";
  function knoepfe() {
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
      + '<button type="button" class="btn-clean dp-pa4-btn" onclick="' + HOCH + '">Unterlagen hochladen</button></div>';
  }
  /* v4007 · Risiken der Auswertung je Jahr: hoch = kritisch, mittel = Handlungsbedarf (niedrig zaehlt nicht).
     v4780 · liste = die noch geltenden Risiken (ohne die entfernter Unterlagen), sonst alle der Auswertung */
  function risikenJe(ausw, liste) {
    var r = Array.isArray(liste) ? liste : (ausw && Array.isArray(ausw.risiken) ? ausw.risiken : []), n = { hoch: 0, mittel: 0, niedrig: 0 }, j = {};
    r.forEach(function (x) {
      if (!x) return;
      var s = String(x.schwere || 'mittel').toLowerCase(); if (n[s] == null) s = 'mittel'; n[s]++;
      if (s === 'niedrig') return;
      var y = jahrAus(x.jahr) || 0;
      j[y] = j[y] || { hoch: 0, mittel: 0, titel: [] }; j[y][s]++; if (x.titel) j[y].titel.push(String(x.titel));
    });
    return { n: n, jahre: j, gesamt: r.length };
  }
  /* ── v4780 · Risiken hängen an ihrer Unterlage ────────────────────────────────────────────────────
     Marcel 25.11.2026: „wenn ich gewisse Unterlagen lösche, dann sollen diese Risiken natürlich auch verschwinden“.
     Jedes Risiko nennt seine Quelle mit Dateinamen (quelle: „07 Protokoll … 2025.pdf, TOP 3“). Ist jede genannte Datei
     entfernt (dokumente[].entfernt, gesetzt beim Zurücknehmen oder Löschen im Verlauf), fällt das Risiko. Risiken ohne
     erkennbare Datei bleiben stehen, sie kommen aus der Gesamtauswertung. */
  function risikenAktiv(dat) {
    var a = dat && dat.auswertung, r = a && Array.isArray(a.risiken) ? a.risiken.filter(function (x) { return x && typeof x === 'object'; }) : [];
    var D = dat && Array.isArray(dat.dokumente) ? dat.dokumente : [];
    var nm = function (d) { return String(d.datei || '').toLowerCase().trim(); };
    var weg = D.filter(function (d) { return d && d.entfernt && nm(d).length > 4; }).map(nm);
    if (!weg.length) return r;
    var da = D.filter(function (d) { return d && !d.entfernt && nm(d).length > 4; }).map(nm);
    return r.filter(function (x) {
      var q = String(x.quelle || x.fundstelle || '').toLowerCase();
      if (!q || !weg.some(function (n) { return q.indexOf(n) >= 0; })) return true;
      return da.some(function (n) { return q.indexOf(n) >= 0; });
    });
  }
  function risText(z) {
    var t = [];
    if (z.hoch) t.push(z.hoch + ' kritisch');
    if (z.mittel) t.push(z.mittel + ' Handlungsbedarf');
    return t.join(', ');
  }
  /** Kacheln unter der Grafik: je Jahr, was kritisch ist und wo Handlungsbedarf besteht. v4780 · ein Klick springt
      zu den Risiken dieses Jahres (Marcel: „wenn man da draufklickt … den Absprung dahin, wo Handlungsbedarf ist“). */
  function risLeiste(R, J) {
    var js = Object.keys(R.jahre).map(Number);
    if (!js.length) return '';
    var alle = (J || []).map(function (z) { return z.jahr; });
    js.forEach(function (y) { if (y && alle.indexOf(y) < 0) alle.push(y); });
    alle.sort(function (a, b) { return a - b; });
    if (R.jahre[0]) alle.push(0);
    return '<div class="dp-hv-risj" role="list" aria-label="Risiken je Jahr">' + alle.map(function (y) {
      var z = R.jahre[y];
      var prot = (J || []).some(function (q) { return q.jahr === y && q.protokoll; });
      var an = !!z || prot;
      var tip = z ? z.titel.slice(0, 4).join(' · ') : 'Keine offenen Punkte in den Unterlagen';
      return '<button type="button" role="listitem" class="btn-clean ' + (z ? (z.hoch ? 'krit' : 'hand') : 'ruhig') + '" data-dp-hv-sprung="' + y + '"'
        + (an ? '' : ' disabled') + ' aria-label="' + esc((y || 'ohne Jahr') + ': ' + (z ? risText(z) : 'nichts offen')) + '">'
        + '<small>' + (y ? y : 'ohne Jahr') + '</small>'
        + (z ? (z.hoch ? '<b class="k">' + z.hoch + ' kritisch</b>' : '') + (z.mittel ? '<b class="h">' + z.mittel + ' Handlungsbedarf</b>' : '') : '<span>nichts offen</span>')
        + (an ? '<em class="hv-tt" role="tooltip">' + esc(tip) + '<br><i>' + (z ? 'Klick zeigt die Punkte' : 'Klick zeigt das Protokoll') + '</i></em>' : '') + '</button>';
    }).join('') + '</div>';
  }
  /* v4780 · Wohin ein Risiko führt: Protokoll im Einzelnen, Belege des Jahres, Jahresabgleich (nur Bestand) */
  function risSprunge(x) {
    var q = String(x.quelle || x.fundstelle || ''), j = jahrAus(x.jahr), b = [], heute = new Date().getFullYear();
    if (/protokoll|versammlung/i.test(q)) b.push('<button type="button" class="btn-clean" data-dp-hv-zu="prot" data-dp-hv-q="' + esc(q.split(',')[0]) + '">Zum Protokoll</button>');
    if (j && j <= heute && typeof document !== 'undefined' && document.getElementById('dp-pa-tab-jahr')) b.push('<button type="button" class="btn-clean" data-dp-hv-zu="jahr" data-dp-hv-j="' + j + '">Jahresabgleich ' + j + '</button>');
    else if (j && j <= heute && /beleg|rechnung|abrechnung|hausgeld|wirtschaftsplan/i.test(q + ' ' + (x.titel || ''))) b.push('<button type="button" class="btn-clean" data-dp-hv-zu="belege" data-dp-hv-j="' + j + '">Belege ' + j + '</button>');
    return b.length ? '<span class="hv-zu">' + b.slice(0, 2).join('') + '</span>' : '';
  }
  /** v4780 · „Risiken aus den Unterlagen“ oben im Reiter, nach Jahren. Einfach: die wichtigsten Punkte je eine Zeile,
      die Erklärung beim Überfahren. Detail: jedes Risiko mit Beschreibung, Quelle und Absprung. */
  function risikenHtml(liste) {
    if (!liste.length) return '';
    var ORD = { hoch: 0, mittel: 1, niedrig: 2 };
    var sw = function (x) { var s = String(x.schwere || 'mittel').toLowerCase(); return ORD[s] == null ? 'mittel' : s; };
    var r = liste.slice().sort(function (a, b) { return ORD[sw(a)] - ORD[sw(b)] || (Number(b.kosten_eur) || 0) - (Number(a.kosten_eur) || 0); });
    var n = { hoch: 0, mittel: 0, niedrig: 0 }; r.forEach(function (x) { n[sw(x)]++; });
    var jahre = []; r.forEach(function (x) { var j = jahrAus(x.jahr) || 0; if (jahre.indexOf(j) < 0) jahre.push(j); });
    jahre.sort(function (a, b) { return (a || 9999) - (b || 9999); });
    var WORT = { hoch: 'kritisch', mittel: 'Handlungsbedarf', niedrig: 'beobachten' };
    var chips = '<div class="dp-hv-rf" role="group" aria-label="Risiken nach Jahr"><button type="button" class="btn-clean on" data-dp-hv-rj="alle" aria-pressed="true">Alle <i>' + r.length + '</i></button>'
      + jahre.map(function (j) {
        var c = r.filter(function (x) { return (jahrAus(x.jahr) || 0) === j; }).length;
        return '<button type="button" class="btn-clean" data-dp-hv-rj="' + j + '" aria-pressed="false">' + (j || 'ohne Jahr') + ' <i>' + c + '</i></button>';
      }).join('') + '</div>';
    var zeile = function (x) {
      var s = sw(x), j = jahrAus(x.jahr) || 0, kost = Number(x.kosten_eur) > 0 ? eur(Number(x.kosten_eur)) : '';
      var tt = '<strong>' + esc(WORT[s]) + '.</strong> ' + esc(String(x.beschreibung || '').slice(0, 280)) + (x.quelle ? '<small>Quelle: ' + esc(x.quelle) + '</small>' : '');
      return '<div class="dp-hv-rk ' + s + '" tabindex="0" data-j="' + j + '"><i class="hv-pt"></i><b>' + esc(x.titel || 'Risiko') + '</b>'
        + '<span class="hv-m">' + (j ? String(j) : '') + (kost ? (j ? ' · ' : '') + kost : '') + '</span>'
        + '<em class="hv-tt" role="tooltip">' + tt + '</em></div>';
    };
    var karte = function (x) {
      var s = sw(x), j = jahrAus(x.jahr) || 0, kost = Number(x.kosten_eur) > 0 ? eur(Number(x.kosten_eur)) : '';
      return '<div class="dp-hv-rkk ' + s + '" data-j="' + j + '"><div class="hv-k"><b>' + esc(x.titel || 'Risiko') + '</b><span class="hv-p ' + s + '">' + esc(WORT[s]) + '</span>'
        + (kost ? '<span class="hv-m">' + kost + '</span>' : '') + (j ? '<span class="hv-m">' + j + '</span>' : '') + '</div>'
        + (x.beschreibung ? '<p>' + esc(x.beschreibung) + '</p>' : '')
        + '<div class="hv-f">' + (x.quelle ? '<small>Quelle: ' + esc(x.quelle) + '</small>' : '<small>aus der Gesamtauswertung</small>') + risSprunge(x) + '</div></div>';
    };
    var einfach = r.filter(function (x) { return sw(x) !== 'niedrig'; });
    if (!einfach.length) einfach = r.slice();
    var kopf = [n.hoch ? n.hoch + ' kritisch' : '', n.mittel ? n.mittel + ' Handlungsbedarf' : '', n.niedrig ? n.niedrig + ' beobachten' : ''].filter(Boolean).join(' · ');
    return '<div class="dp-hv-ris" data-dp-hv-ris="1" data-filter="alle">'
      + abschnitt('Risiken aus den Unterlagen', kopf)
      + chips
      + '<div class="dp-pa-e dp-hv-rl">' + einfach.map(function (x, i) { return zeile(x).replace('class="dp-hv-rk ', 'class="dp-hv-rk' + (i >= 5 ? ' ueber' : '') + ' '); }).join('')
      + (einfach.length < r.length || einfach.length > 5 ? '<p class="dp-hv-rm">Alle ' + r.length + ' Punkte mit Beschreibung und Quelle unter Detail.</p>' : '') + '</div>'
      + '<div class="dp-pa-d dp-hv-rd">' + r.map(karte).join('') + '</div>'
      + '<p class="dp-hv-rleer" hidden>Für dieses Jahr nennen die Unterlagen kein Risiko.</p></div>';
  }
  /* v4780 · Filter und Absprünge (ein Horcher für alle Karten) */
  function risFilter(box, j) {
    if (!box) return;
    box.setAttribute('data-filter', String(j));
    var alle = String(j) === 'alle', n = 0;
    Array.prototype.forEach.call(box.querySelectorAll('[data-dp-hv-rj]'), function (b) { var an = b.getAttribute('data-dp-hv-rj') === String(j); b.classList.toggle('on', an); b.setAttribute('aria-pressed', String(an)); });
    Array.prototype.forEach.call(box.querySelectorAll('.dp-hv-rk,.dp-hv-rkk'), function (e) {
      var sicht = alle || e.getAttribute('data-j') === String(j);
      e.classList.toggle('aus', !sicht);
      if (sicht && e.offsetParent !== null) n++;
    });
    var leer = box.querySelector('.dp-hv-rleer'); if (leer) leer.hidden = n > 0;
    var m = box.querySelector('.dp-hv-rm'); if (m) m.hidden = !alle;
  }
  function markieren(e) {
    if (!e) return;
    try { e.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (x) { e.scrollIntoView(); }
    e.classList.remove('dp-hv-blink'); void e.offsetWidth; e.classList.add('dp-hv-blink');
    setTimeout(function () { e.classList.remove('dp-hv-blink'); }, 2400);
  }
  function protKarte(q) {
    q = String(q || '').toLowerCase().trim();
    var ks = document.querySelectorAll('.dp-hv-pk[data-datei]');
    for (var i = 0; i < ks.length; i++) { var d = String(ks[i].getAttribute('data-datei') || '').toLowerCase(); if (d && (q.indexOf(d) >= 0 || d.indexOf(q) >= 0)) return ks[i]; }
    return null;
  }
  function sprung(jahr) {
    var box = document.querySelector('[data-dp-hv-ris]');
    if (box && box.querySelector('[data-dp-hv-rj="' + jahr + '"]')) { risFilter(box, jahr); markieren(box); return; }
    /* kein Risiko im Jahr: das Protokoll des Jahres */
    var ks = document.querySelectorAll('.dp-hv-pk[data-jahr="' + jahr + '"]');
    if (ks.length) { markieren(ks[0]); return; }
    var row = document.querySelector('[data-dp-hv-jahr="' + jahr + '"]'); if (row) markieren(row);
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var f = t.closest('[data-dp-hv-rj]');
    if (f) { risFilter(f.closest('[data-dp-hv-ris]'), f.getAttribute('data-dp-hv-rj')); return; }
    var s = t.closest('[data-dp-hv-sprung]');
    if (s && !s.disabled) { sprung(s.getAttribute('data-dp-hv-sprung')); return; }
    var z = t.closest('[data-dp-hv-zu]'); if (!z) return;
    var art = z.getAttribute('data-dp-hv-zu'), j = +z.getAttribute('data-dp-hv-j') || null;
    if (art === 'prot') { var k = protKarte(z.getAttribute('data-dp-hv-q')); if (k) { var d = k.querySelector('details'); if (d) d.open = true; markieren(k); } return; }
    if (art === 'belege') { try { if (g.DpEingang && g.DpEingang.oeffnen) g.DpEingang.oeffnen({ reiter: 'jahre', jahr: j }); } catch (x) {} return; }
    if (art === 'jahr') { try { var tb = document.getElementById('dp-pa-tab-jahr'); if (tb) tb.click(); setTimeout(function () { var y = document.querySelector('[data-ja-jahr="' + j + '"],[data-jahr="' + j + '"]'); if (y && y.click) y.click(); }, 400); } catch (x) {} }
  });
  function risAmpel(R) {
    if (!R.gesamt) return '';
    try { if (g.DpUnterlagen && g.DpUnterlagen.stil) g.DpUnterlagen.stil(); } catch (e) {}
    return '<div class="dpu-ampel dp-hv-ampel"><div class="hoch"><b>' + R.n.hoch + '</b><span>hoch</span></div><div class="mittel"><b>' + R.n.mittel + '</b><span>mittel</span></div><div class="niedrig"><b>' + R.n.niedrig + '</b><span>niedrig</span></div></div>';
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
  function grafikSpec(J, opt) {
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
    /* v4007 · Risiken je Jahr als Marke an der Grundlinie (rot kritisch, Gold Handlungsbedarf), Text mit Anzahl */
    try {
      var R = risikenJe(opt && opt.ausw, opt && opt.liste);
      Object.keys(R.jahre).forEach(function (y) { var z = R.jahre[y]; y = +y; if (!y) return;
        marken.push({ jahr: y, text: y + ': ' + risText(z), farbe: z.hoch ? (G.ROT || '#B8625C') : (G.GOLD || 'var(--wl-c9a84c,#C9A84C)'), art: z.hoch ? 'kritisch' : 'hand', legende: z.hoch ? 'Risiko kritisch' : 'Handlungsbedarf' }); });
    } catch (eR) {}
    var panels = [];
    if (Object.keys(wp).length || Object.keys(ab).length) panels.push({ titel: 'Hausgeld je Jahr' + (istEtw() ? ', deine Wohnung' : ''), kurz: 'Hausgeld', art: 'balken', hoehe: 130, marken: marken, serien: [
      { name: 'Wirtschaftsplan (Plan)', typ: 'balken', farbe: G.GRAU || '#8A8278', deckkraft: 0.45, werte: wp },
      { name: 'Jahresabrechnung (Ist)', typ: 'balken', farbe: G.GOLD, werte: ab }] });
    if (Object.keys(rl).length >= 2) panels.push({ titel: 'Erhaltungsrücklage der Gemeinschaft, Stand', kurz: 'Rücklage', art: 'linie', hoehe: 110, marken: panels.length ? [] : marken, serien: [
      { name: 'Rücklage', typ: 'linie', strich: 'ist', farbe: G.TINTE || '#5B544C', werte: rl, ende: false }] });
    return panels.length ? { jahre: jahre, heute: new Date().getFullYear(), panels: panels, titel: 'Hausgeld und Rücklage je Jahr' } : null;
  }
  /* ── v4530f · WEG-Protokolle im Einzelnen ─────────────────────────────────────────────────────────────
     Marcel 24.11.2026: „WEG-Protokolle: beim Auslesen eine komplette Aufstellung (Beschlüsse, Sonderumlagen,
     Instandhaltungsrücklage, Maßnahmen, Streitpunkte mit Datum und Betrag) und die unter Haus & Unterlagen übersichtlich
     zeigen“. Je Protokoll eine Karte: Kacheln (Rücklage, Zuführung, Hausgeld, Sonderumlagen, Maßnahmen), die wichtigsten
     Punkte als Stichpunkte, die ganze Aufstellung aufklappbar. Quelle ist d.protokoll (object-actions.js
     _protokollAufstellung, gespeichert beim Übernehmen). Ältere Protokolle ohne diese Aufstellung zeigen, was die
     Gesamtauswertung für das Jahr der Versammlung nennt, mit dem Hinweis, dass Neueinlesen die volle Liste bringt. */
  function protCss() {
    if (typeof document === 'undefined' || document.getElementById('dp-hv-prot-css')) return;
    var s = document.createElement('style'); s.id = 'dp-hv-prot-css';
    var g = 'var(--wl-c9a84c, #C9A84C)';
    s.textContent = '.dp-hv-prots{display:grid;gap:10px;margin:6px 0 4px}'
      + '.dp-hv-pk{border:1px solid color-mix(in srgb,' + g + ' 24%,transparent);border-radius:10px;background:#fff;padding:12px 14px}'
      + '.dp-hv-pk-k{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin-bottom:8px}'
      + '.dp-hv-pk-k b{font:600 14px/1.3 "Space Grotesk",Inter,sans-serif;color:var(--ch,#2A2727)}'
      + '.dp-hv-pk-k .d{font:600 11.5px/1 "JetBrains Mono",ui-monospace,monospace;color:var(--wl-9a7f33,#9a7f33)}'
      + '.dp-hv-pk-k .v{font-size:11.5px;color:var(--muted,#7A7370)}'
      + '.dp-hv-pk-kz{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:6px;margin:0 0 8px}'
      + '.dp-hv-pk-kz div{border:1px solid rgba(42,39,39,.08);border-radius:8px;padding:6px 9px;background:#FDFCFA}'
      + '.dp-hv-pk-kz small{display:block;font:600 9.5px/1.2 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#7A7370)}'
      + '.dp-hv-pk-kz b{font:600 13.5px/1.35 Inter,sans-serif;font-variant-numeric:tabular-nums;color:var(--ch,#2A2727)}'
      + '.dp-hv-pk-kz div.rot b{color:#B8625C}'
      + '.dp-hv-pk ul.kurz{margin:0 0 6px;padding:0 0 0 16px;font-size:12.5px;line-height:1.5}'
      + '.dp-hv-pk details summary{cursor:pointer;font-size:12px;color:var(--wl-9a7f33,#9a7f33);font-weight:600;padding:4px 0;list-style:none}'
      + '.dp-hv-pk details summary::-webkit-details-marker{display:none}'
      + '.dp-hv-pk details summary::after{content:"";display:inline-block;width:5px;height:5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);margin:0 0 3px 8px}'
      + '.dp-hv-pk details[open] summary::after{transform:rotate(-135deg);margin-bottom:-1px}'
      + '.dp-hv-pk h5{margin:10px 0 4px;font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#7A7370)}'
      + '.dp-hv-pz{display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;gap:4px 10px;align-items:baseline;padding:5px 0;border-top:1px solid rgba(42,39,39,.06);font-size:12.5px}'
      + '.dp-hv-pz .t{font:500 10.5px/1.4 "JetBrains Mono",monospace;color:var(--muted,#7A7370)}'
      + '.dp-hv-pz .b{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}'
      + '.dp-hv-pz .b small{display:block;font-weight:400;color:var(--muted,#7A7370);font-size:10.5px}'
      + '.dp-hv-pz .s{font:600 10px/1 Inter,sans-serif;padding:3px 7px;border-radius:999px;border:1px solid rgba(42,39,39,.15);color:var(--muted,#7A7370);white-space:nowrap}'
      + '.dp-hv-pz .s.ja{border-color:rgba(63,165,108,.5);color:#2f7d52}.dp-hv-pz .s.nein{border-color:rgba(184,98,92,.5);color:#B8625C}'
      + '.dp-hv-pk ul.l{margin:0;padding:0 0 0 16px;font-size:12.5px;line-height:1.5}.dp-hv-pk ul.l.rot li{color:#B8625C}'
      + '.dp-hv-pk .alt{font-size:11.5px;color:var(--muted,#7A7370);margin:6px 0 0}'
      + '@media (max-width:640px){.dp-hv-pz{grid-template-columns:minmax(0,1fr) auto}.dp-hv-pz .t{grid-column:1/-1}.dp-hv-pz .s{grid-column:1;justify-self:start}}';
    document.head.appendChild(s);
  }
  function protokolle(L, w) {
    var doks = (L.doks || []).filter(function (d) { return d && artDok(d) === 'protokoll'; });
    if (!doks.length) return [];
    var J = L.jahre || [];
    return doks.map(function (d) {
      var dt = datumAus(d.datum), j = dt ? dt.jahr : (zahl(d.jahr) || jahrAus(d.label));
      var p = d.protokoll && typeof d.protokoll === 'object' ? d.protokoll : null;
      if (!p) {
        /* Rückfall: was die Gesamtauswertung für das Jahr der Versammlung führt */
        var z = J.filter(function (x) { return x.jahr === j; })[0] || null;
        var san = (Array.isArray(w.sanierungen) ? w.sanierungen : []).filter(function (s) { return s && zahl(s.jahr) === j; });
        var ev = (L.liste || []).filter(function (e) { return e.jahr === j; });
        p = { alt: true, datum: dt ? dt.text : '', verwalter: z && z.verwalter || '',
          ruecklage: z ? z.ruecklage_stand : null, zufuehrung: z ? z.ruecklage_zufuehrung : null, hausgeld_monat: z ? z.hausgeld_plan_monat : null,
          beschluesse: (z ? z.beschluesse : []).map(function (t) { return { titel: t }; }),
          sonderumlagen: z && z.su_gesamt ? [{ titel: 'Sonderumlage', betrag: z.su_gesamt, anteil: z.su_anteil, jahr: j }] : [],
          massnahmen: san.map(function (s) { return { titel: s.massnahme || s.gewerk || '', jahr: zahl(s.jahr), betrag: zahl(s.kosten_eur != null ? s.kosten_eur : s.kosten_geschaetzt_eur), status: s.status || '' }; }).filter(function (m) { return m.titel; }),
          maengel: ev.filter(function (e) { return e.art === 'mangel' || e.art === 'schaden'; }).map(function (e) { return e.titel + (e.text ? ': ' + e.text : ''); }),
          streit: ev.filter(function (e) { return e.art === 'rechtsstreit'; }).map(function (e) { return e.titel + (e.text ? ': ' + e.text : ''); }) };
      }
      return { iso: dt ? dt.iso : String(j || ''), jahr: j, datum: p.datum || (dt ? dt.text : (j || '')), datei: d.datei || d.label || '', p: p };
    }).sort(function (a, b) { return String(b.iso).localeCompare(String(a.iso)); });
  }
  function protokolleHtml(L, w) {
    var P = protokolle(L, w); if (!P.length) return '';
    protCss();
    var ergK = function (e) { e = String(e || '').toLowerCase(); return /angenommen|beschlossen/.test(e) ? 'ja' : /abgelehnt/.test(e) ? 'nein' : ''; };
    var eurN = function (v) { return v != null && isFinite(v) ? eur(v) : ''; };
    var karten = P.map(function (x, ix) {
      var p = x.p, L1 = function (a) { return Array.isArray(a) ? a : []; };
      var su = L1(p.sonderumlagen), ma = L1(p.massnahmen), be = L1(p.beschluesse), mg = L1(p.maengel), st = L1(p.streit);
      var suS = su.reduce(function (s, v) { return s + (zahl(v.betrag) || 0); }, 0), maS = ma.reduce(function (s, v) { return s + (zahl(v.betrag) || 0); }, 0);
      var kz = [];
      if (p.ruecklage != null) kz.push(['Rücklage', eur(p.ruecklage)]);
      if (p.zufuehrung != null) kz.push(['Zuführung im Jahr', eur(p.zufuehrung)]);
      if (p.hausgeld_monat != null) kz.push(['Hausgeld im Monat', eur(p.hausgeld_monat)]);
      if (su.length) kz.push(['Sonderumlagen', suS ? eur(suS) : su.length + '×', 'rot']);
      if (ma.length) kz.push(['Maßnahmen', maS ? eur(maS) : String(ma.length)]);
      if (be.length) kz.push(['Beschlüsse', String(be.length)]);
      if (st.length) kz.push(['Streitpunkte', String(st.length), 'rot']);
      /* die wichtigsten Punkte: Sonderumlagen, Streit, Beschlüsse mit Betrag, Rückstände */
      var kurz = [];
      su.slice(0, 2).forEach(function (s) { kurz.push('Sonderumlage ' + (s.titel || '') + (s.betrag ? ' ' + eur(s.betrag) : '') + (s.jahr ? ' (' + s.jahr + ')' : '') + (s.status ? ', ' + s.status : '')); });
      st.slice(0, 1).forEach(function (s) { kurz.push('Streit: ' + s); });
      be.filter(function (b) { return zahl(b.betrag); }).slice(0, 2).forEach(function (b) { kurz.push((b.titel || '') + ' ' + eur(zahl(b.betrag)) + (b.ergebnis ? ', ' + b.ergebnis : '')); });
      if (p.rueckstaende) kurz.push('Hausgeldrückstände: ' + p.rueckstaende);
      if (!kurz.length) be.slice(0, 3).forEach(function (b) { kurz.push(b.titel + (b.ergebnis ? ', ' + b.ergebnis : '')); });
      kurz = kurz.slice(0, 4);
      var zeile = function (top, titel, status, betrag, unter) {
        return '<div class="dp-hv-pz"><span class="t">' + esc(top || '') + '</span><span>' + esc(titel) + '</span>'
          + (status ? '<span class="s ' + ergK(status) + '">' + esc(status) + '</span>' : '<span></span>')
          + '<span class="b">' + esc(betrag || '') + (unter ? '<small>' + esc(unter) + '</small>' : '') + '</span></div>';
      };
      var voll = '';
      if (be.length) voll += '<h5>Beschlüsse</h5>' + be.map(function (b) { return zeile(b.top ? 'TOP ' + b.top : '', b.titel, b.ergebnis, eurN(zahl(b.betrag)), b.frist || ''); }).join('');
      if (su.length) voll += '<h5>Sonderumlagen</h5>' + su.map(function (s) { return zeile(s.jahr ? String(s.jahr) : '', s.titel || 'Sonderumlage', s.status, eurN(zahl(s.betrag)), (s.anteil ? 'Anteil ' + eur(s.anteil) : '') + (s.faellig ? (s.anteil ? ', ' : '') + 'fällig ' + s.faellig : '')); }).join('');
      if (ma.length) voll += '<h5>Maßnahmen</h5>' + ma.map(function (m) { return zeile(m.jahr ? String(m.jahr) : '', m.titel, m.status, eurN(zahl(m.betrag)), ''); }).join('');
      if (mg.length) voll += '<h5>Mängel und Schäden</h5><ul class="l">' + mg.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      if (st.length) voll += '<h5>Streitpunkte</h5><ul class="l rot">' + st.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      var sonst = [];
      if (p.rueckstaende) sonst.push('Hausgeldrückstände: ' + p.rueckstaende);
      if (p.verwalterwechsel) sonst.push('Verwaltung: ' + p.verwalterwechsel);
      if (sonst.length) voll += '<h5>Weiteres</h5><ul class="l">' + sonst.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      var nPunkte = be.length + su.length + ma.length + mg.length + st.length + sonst.length;
      return '<div class="dp-hv-pk" data-datei="' + esc(x.datei || '') + '" data-jahr="' + esc(x.jahr || '') + '"><div class="dp-hv-pk-k"><span class="d">' + esc(x.datum || 'ohne Datum') + '</span><b>Eigentümerversammlung</b>'
        + (p.verwalter ? '<span class="v">Verwaltung ' + esc(p.verwalter) + '</span>' : '') + '</div>'
        + (kz.length ? '<div class="dp-hv-pk-kz">' + kz.map(function (k) { return '<div' + (k[2] ? ' class="' + k[2] + '"' : '') + '><small>' + esc(k[0]) + '</small><b>' + esc(k[1]) + '</b></div>'; }).join('') + '</div>' : '')
        + (kurz.length ? '<ul class="kurz">' + kurz.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '')
        + (voll ? '<details' + (ix === 0 ? ' class="dp-hv-pk-neu"' : '') + '><summary>Ganze Aufstellung (' + nPunkte + (nPunkte === 1 ? ' Punkt' : ' Punkte') + ')</summary>' + voll + '</details>' : '')
        + (p.alt ? '<p class="alt">Aus der Gesamtauswertung für ' + esc(x.jahr || '') + '. Liest du das Protokoll neu ein, steht hier jeder Tagesordnungspunkt mit Ergebnis und Betrag.</p>' : '')
        + '</div>';
    });
    return abschnitt('Protokolle im Einzelnen', P.length + (P.length === 1 ? ' Versammlung' : ' Versammlungen') + ', die jüngste zuerst') + '<div class="dp-hv-prots">' + karten.join('') + '</div>';
  }
  function abschnitt(t, eti) { return '<div class="dp-hv-abs"><h4>' + t + '</h4>' + (eti ? '<span>' + esc(eti) + '</span>' : '') + '</div>'; }
  function html(opt) {
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
      + '<div class="dp-hv-hoch"><button type="button" class="btn-clean dp-pa4-btn" onclick="' + HOCH + '">Unterlagen hochladen</button>'
      + '<span>Protokoll, Wirtschaftsplan, Abrechnung, Belege oder Rechnungen. Art und Jahr erkennt DealPilot selbst, übernommen wird erst nach deiner Bestätigung.</span></div></div>';
    var eing = L.doks.filter(function (x) { return x && WEG_TYPEN.test(String(x.typ || '')); }).map(function (x) { return esc(x.label + (x.datum ? ' ' + x.datum : (x.jahr ? ' ' + x.jahr : ''))); });
    if (eing.length) h += '<p class="dp-pa-fuss dp-hv-eing">Eingelesen: ' + eing.join(' · ') + '</p>';
    h += kennzahlen(L, w);
    /* v4780 · Marcel 25.11.2026: „die Risiken aus den Unterlagen weiter oben, klar strukturiert, pro Jahr ansehbar“.
       Reihenfolge jetzt: Ergebnis, Kennzahlen, Risiken (Jahresfilter, Einfach kurz, Detail voll), Grafik im Stil der
       Pilot-Grafiken, Jahreskacheln mit Absprung, Jahr für Jahr, Protokolle. Die Ampel am Ende fällt. */
    var ausw = L.d && L.d.auswertung, RL = risikenAktiv(L.d), sp = grafikSpec(J, { ausw: ausw, liste: RL }), R = risikenJe(ausw, RL);
    h += risikenHtml(RL);
    if (sp) h += '<div class="dp-hv-gx" data-dp-hv-grafik="1"></div>';
    if (Object.keys(R.jahre).length) h += (sp ? '' : abschnitt('Jahre im Überblick', 'Klick springt zu den Punkten des Jahres')) + risLeiste(R, J);
    if (J.length) h += abschnitt('Jahr für Jahr', 'aus Protokollen, Wirtschaftsplänen, Abrechnungen') + tabelle(J)
      + '<p class="dp-pa-fuss" style="margin-top:6px">P Protokoll · W Wirtschaftsplan · A Jahresabrechnung. Ein Jahr ist im Jahresabgleich erledigt, wenn das Protokoll und der Wirtschaftsplan oder die Abrechnung des Jahres vorliegen.'
      + (!(w.jahre && w.jahre.length) ? ' Diese Auswertung ist älter als die Jahreswerte (v3430): Hausgeld und Rücklage je Jahr stehen hier, sobald du Unterlagen nachreichst.' : '') + '</p>';
    h += protokolleHtml(L, w);   /* v4530f */
    h += '</div>';
    if (sp) setTimeout(mountGrafik, 0);
    if (opt && opt.ohneVerlauf) return h;
    return h + zeitleisteHtml(L);
  }
  /** v4007 · „Was passiert ist“: eigene Karte, im Reiter Haus & Unterlagen ganz unten. Einfach zeigt die letzten 5 Ereignisse. */
  function zeitleisteHtml(L) {
    if (typeof document === 'undefined') return '';
    stil();
    L = L || lesen();
    if (!L.hatWeg || !L.liste.length) return '';
    var h = '';
    /* die Zeitleiste, nach Jahren */
    var arten = []; L.liste.forEach(function (e) { if (arten.indexOf(e.art) < 0) arten.push(e.art); });
    var filter = arten.length > 1 ? '<div class="dp-hv-filter" role="group" aria-label="Nach Art filtern">' + arten.map(function (a) {
      return '<button type="button" class="btn-clean" aria-pressed="true" data-dp-hv-art="' + a + '"><i style="background:' + ARTEN[a][1] + '"></i>' + ARTEN[a][0] + '</button>';
    }).join('') + '</div>' : '';
    var zeit = '', jahr = null, ab = Math.max(0, L.liste.length - 5);
    L.liste.forEach(function (e, ix) {
      var j = e.jahr || 'ohne Jahr', alt = ix < ab ? ' dp-pa-d' : '';
      if (j !== jahr) { zeit += '<div class="dp-hv-jahr' + alt + '">' + esc(j) + '</div>'; jahr = j; }
      var A = ARTEN[e.art] || ARTEN.sonstiges, st = String(e.status || '').toLowerCase();
      /* Einfach: reine Versammlungsmarken ohne Inhalt treten zurück, ältere als die letzten 5 auch (v4007) */
      zeit += '<div class="dp-hv-e' + (e.art === 'versammlung' ? ' leise' : '') + alt + '" data-dp-hv-e="' + e.art + '" style="--c:' + A[1] + '"><div class="dp-hv-kopf">'
        + (e.datum && e.datum !== String(e.jahr) ? '<span class="d">' + esc(e.datum) + '</span>' : '')
        + '<span class="a">' + A[0] + '</span>' + (e.titel ? '<b>' + esc(e.titel) + '</b>' : '')
        + (st ? '<span class="dp-hv-st ' + esc(st.replace(/[^a-zäöü]/g, '')) + '">' + esc(e.status) + '</span>' : '')
        + (e.betrag != null ? '<span class="betrag">' + eur(e.betrag) + (e.anteil ? ' <small style="font:400 10.5px Inter;color:#7A7370">Anteil</small>' : '') + '</span>' : '') + '</div>'
        + (e.text ? '<p>' + esc(e.text) + '</p>' : '') + (e.quelle ? '<span class="q dp-pa-d">Quelle: ' + esc(e.quelle) + '</span>' : '') + '</div>';
    });
    if (L.liste.length) h += '<div class="dp-pa-card dp-pa4-mt"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Was passiert ist</span><span class="dp-pa-rule"></span></div>'
      + (ab ? '<p class="dp-pa-fuss dp-pa-e" style="margin:0 0 8px">Die letzten 5 von ' + L.liste.length + ' Ereignissen. Alle unter Detail.</p>' : '')
      + filter + '<div class="dp-hv-zeit">' + zeit + '</div>'
      + (L.liste.some(function (e) { return e.herkunft === 'kernpunkt'; }) ? '<p class="dp-pa-fuss">Diese Auswertung nennt die Ereignisse nur mit Jahr. Beim nächsten Einlesen von Unterlagen steht jedes mit seinem Datum und seiner Quelle hier.</p>' : '')
      + '</div>';
    /* v4007 · die Karte „Weitere WEG-Unterlagen“ ist weg: derselbe Knopf steht oben (Unterlagen hochladen),
       die Liste „Eingelesen“ steht jetzt unter dem Ergebnissatz */
    return h;
  }
  /* v4780 · Marcel 25.11.2026: „die Grafik sieht nicht so aus … so anpassen wie bei der Pilot-Analyse unter Steuern“.
     Gezeichnet mit DpGrafiken (grafiken-premium.js): Karte mit Augenbraue, Titel als Satz, Unterzeile, Linien,
     Tooltip je Jahr, Marken für Sonderumlagen und kritische Jahre, dieselben Farben. Die Rücklage der Gemeinschaft
     hat eine andere Größenordnung als das Hausgeld und steht deshalb als zweite, flache Linie darunter. */
  function premiumKarte(host, J, RL) {
    var Gx = g.DpGrafiken, F = Gx.farben || {};
    var mit = J.filter(function (z) { return z.hausgeld_plan_monat != null || z.hausgeld_ist_jahr != null || z.ruecklage_stand != null || z.su_anteil != null || z.su_gesamt != null; });
    if (!mit.length) { host.innerHTML = ''; return false; }
    var a = mit[0].jahr, b = mit[mit.length - 1].jahr; if (a === b) { a = a - 1; }
    var X = []; for (var y = a; y <= b; y++) X.push(y);
    var by = {}; J.forEach(function (z) { by[z.jahr] = z; });
    var ist = X.map(function (j) { var z = by[j]; return z && z.hausgeld_ist_jahr != null ? z.hausgeld_ist_jahr : null; });
    var plan = X.map(function (j) { var z = by[j]; return z && z.hausgeld_plan_monat != null ? Math.round(z.hausgeld_plan_monat * 12) : null; });
    var rl = X.map(function (j) { var z = by[j]; return z && z.ruecklage_stand != null ? z.ruecklage_stand : null; });
    var su = X.map(function (j) { var z = by[j]; var v = z ? (z.su_anteil != null ? z.su_anteil : z.su_gesamt) : null; return v > 0 ? v : null; });
    var R = risikenJe(null, RL), hat = function (arr) { return arr.some(function (v) { return v != null; }); };
    var letzt = function (arr) { for (var i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return { j: X[i], v: arr[i] }; return null; };
    var lI = letzt(ist), lP = letzt(plan), suJ = X.filter(function (j, i) { return su[i] != null; });
    var wohn = istEtw() ? ' für deine Wohnung' : '';
    var titel = (lP ? 'Hausgeld' + wohn + ' zuletzt ' + eur(lP.v) + ' im Jahr (Plan ' + lP.j + ')' : (lI ? 'Hausgeld' + wohn + ' ' + eur(lI.v) + ' laut Abrechnung ' + lI.j : 'Geld der Gemeinschaft je Jahr'))
      + (suJ.length ? ', Sonderumlage ' + suJ.join(' und ') : ', keine Sonderumlage');
    var unter = 'Hausgeld aus Wirtschaftsplan (Plan) und Jahresabrechnung (Ist), dazu der Stand der Erhaltungsrücklage. Rote Marken: Sonderumlage oder kritisches Risiko im Jahr.';
    var i = Gx.karte(host, { eyebrow: 'Hausgeld und Rücklage', titel: titel, unter: unter, chips: ['aus deinen Unterlagen'] });
    var rlE = letzt(rl); if (rlE && rl.filter(function (v) { return v != null; }).length < 2) { var ft = document.createElement('div'); ft.className = 'gx-s'; ft.style.marginTop = '2px'; ft.textContent = 'Erhaltungsrücklage der Gemeinschaft: ' + eur(rlE.v) + ' (' + rlE.j + '), ein Stand. Mit weiteren Abrechnungen entsteht hier der Verlauf.'; i.parentNode.insertBefore(ft, i); }
    var ziel = document.createElement('div'); i.appendChild(ziel);
    var marken = [];
    X.forEach(function (j, q) {
      var z = R.jahre[j];
      if (su[q] != null) marken.push({ j: j, text: 'Sonderumlage', farbe: F.rot });
      else if (z && z.hoch) marken.push({ j: j, text: z.hoch + ' kritisch', farbe: F.rot });
    });
    var reihen = [];
    if (hat(ist)) reihen.push({ name: 'Abrechnung (Ist)', werte: ist, farbe: F.tinte, dick: 2.6, punkte: true });
    if (hat(plan)) reihen.push({ name: 'Wirtschaftsplan (Plan)', werte: plan, farbe: F.tinte3, dick: 2, gestrichelt: true, punkte: true });
    var streu = []; X.forEach(function (j, q) { if (su[q] != null) streu.push({ j: j, v: su[q], farbe: F.rot, tip: '<div class="t">Sonderumlage ' + j + '</div><b>' + eur(su[q]) + '</b>' + (istEtw() && by[j] && by[j].su_anteil != null ? ' dein Anteil' : ' Gemeinschaft') }); });
    var tipJ = function (q, j) {
      var z = by[j] || {}, rz = R.jahre[j];
      return '<div class="t">' + j + '</div>' + (ist[q] != null ? 'Abrechnung <b>' + eur(ist[q]) + '</b><br>' : '') + (plan[q] != null ? 'Wirtschaftsplan <b>' + eur(plan[q]) + '</b><br>' : '')
        + (su[q] != null ? 'Sonderumlage <b>' + eur(su[q]) + '</b><br>' : '') + (rl[q] != null ? 'Rücklage <b>' + eur(rl[q]) + '</b><br>' : '')
        + (rz ? '<span style="color:' + F.rot + '">' + esc(risText(rz)) + '</span>' : (z.protokoll ? 'Protokoll liegt vor' : ''));
    };
    var leg = reihen.map(function (r) { return { n: r.name, f: r.farbe }; }); if (streu.length) leg.push({ n: 'Sonderumlage', f: F.rot });
    var W = Math.max(260, (i.clientWidth || host.clientWidth || 640) - 2);
    if (reihen.length || streu.length) Gx.verlauf(ziel, { x: X, reihen: reihen.length ? reihen : [{ name: 'leer', werte: X.map(function () { return null; }), farbe: 'transparent' }], streu: streu, marken: marken, tip: tipJ, legende: leg }, { breite: W, hoehe: 210, aria: 'Hausgeld je Jahr' });
    if (rl.filter(function (v) { return v != null; }).length >= 2) {
      var zr = document.createElement('div'); zr.className = 'dp-hv-gx-rl'; i.appendChild(zr);
      var lr = letzt(rl), er = rl.filter(function (v) { return v != null; })[0];
      var kopf = document.createElement('div'); kopf.className = 'gx-s'; kopf.textContent = 'Erhaltungsrücklage der Gemeinschaft: ' + eur(lr.v) + ' (' + lr.j + ')' + (er !== lr.v ? ', vorher ' + eur(er) : '');
      zr.appendChild(kopf); var zr2 = document.createElement('div'); zr2.style.marginTop = '4px'; zr.appendChild(zr2);
      Gx.verlauf(zr2, { x: X, reihen: [{ name: 'Rücklage', werte: rl, farbe: F.gruen, dick: 2, punkte: true }], tip: function (q, j) { return '<div class="t">' + j + '</div>Rücklage <b>' + (rl[q] != null ? eur(rl[q]) : 'keine Angabe') + '</b>'; } }, { breite: W, hoehe: 130, aria: 'Erhaltungsrücklage je Jahr' });
    }
    return true;
  }
  var _hvSchiebe = 0, _hvRO = null;
  function schiebeGrafik() { if (_hvSchiebe > 60) return; _hvSchiebe++; setTimeout(mountGrafik, 350); }
  function mountGrafik() {
    if (typeof document === 'undefined') return;
    _hvSchiebe = Math.min(_hvSchiebe, 60);
    try {
      if (!_hvRO && typeof ResizeObserver !== 'undefined') _hvRO = new ResizeObserver(function () { clearTimeout(_hvRO._t); _hvRO._t = setTimeout(mountGrafik, 120); });
      if (_hvRO) Array.prototype.forEach.call(document.querySelectorAll('[data-dp-hv-grafik]'), function (h) { if (!h._hvBeob) { h._hvBeob = true; _hvRO.observe(h); } });
    } catch (e) {}
    var hs = document.querySelectorAll('[data-dp-hv-grafik]'); if (!hs.length) return;
    var L0 = null, sp = null; try { L0 = lesen(); sp = grafikSpec(L0.jahre || [], { ausw: L0.d && L0.d.auswertung, liste: risikenAktiv(L0.d) }); } catch (e) { sp = null; }
    var Gx = g.DpGrafiken, G = g.DpJahresbuchGrafik;
    for (var i = 0; i < hs.length; i++) {
      try {
        if (!sp) { hs[i].innerHTML = ''; continue; }
        if (Gx && Gx.karte && Gx.verlauf) {
          /* v4780a · gemessen: im verborgenen Reiter ist die Breite 0, das SVG wurde mit 640 gezeichnet und auf 870 px
             hochgezogen (Schrift 1,4fach). Gezeichnet wird erst, wenn der Reiter sichtbar ist, und neu bei anderer Breite. */
          var bw = hs[i].clientWidth;
          if (!bw) { schiebeGrafik(); continue; }
          if (hs[i]._hvW === bw && hs[i].querySelector('svg')) continue;
          hs[i]._hvW = bw;
          premiumKarte(hs[i], L0.jahre || [], risikenAktiv(L0.d)); continue;
        }
        if (G && G.malen) { G.malen(hs[i], sp); }
      } catch (e) { try { console.warn('[hausverlauf] Grafik', e); } catch (x) {} hs[i].innerHTML = ''; }
    }
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-dp-hv-art]') : null; if (!b) return;
    var an = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(an));
    var card = b.closest('.dp-pa-card'), art = b.getAttribute('data-dp-hv-art');
    if (card) Array.prototype.forEach.call(card.querySelectorAll('[data-dp-hv-e="' + art + '"]'), function (e) { e.style.display = an ? '' : 'none'; });
  });

  g.DpHausverlauf = { VERSION: 'v4780', risikenAktiv: risikenAktiv, risikenHtml: risikenHtml, sprung: sprung, protokolle: protokolle, ereignisse: ereignisse, wegJahre: wegJahre, urteil: urteil, artDok: artDok, html: html, zeitleisteHtml: zeitleisteHtml, risikenJe: risikenJe, kurz: kurz, lesen: lesen, jahrDaten: jahrDaten, grafikSpec: grafikSpec, mountGrafik: mountGrafik, ARTEN: ARTEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.DpHausverlauf;
})(typeof window !== 'undefined' ? window : globalThis);
