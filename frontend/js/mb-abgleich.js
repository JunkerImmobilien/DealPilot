'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   mb-abgleich.js — v3002 · Abgleich mit dem Marktbericht (Reiter Objekt und Miete)

   Marcel, 27.10.2026: „Im Tab Objekt Lage und Einschätzung, Marktmiete
   abrufen und gegenüberstellen – auch mit dem Marktbericht Stufe 3. Was ist
   gleich, was ist nicht gleich, erklären, woher wir das bekommen ... auch im
   Tab Miete: Abrufparameter, wirklich vollumfänglich."

   GEMESSEN vorher (Inventur 27.10.2026): die Reiter holen Lage (gemessen und
   KI), Bodenrichtwert, Liegenschaftszins und Marktmiete je auf eigenem Weg; der
   Marktbericht Stufe 3 trägt dieselben Kennzahlen mit Herkunft — und nirgends
   standen beide nebeneinander. Die Ø Miete des Zinssatzes, die Zensus-
   Bestandsmiete, der Anker der Marktüblichkeit und die im Ertragswert
   angesetzte Miete waren im Reiter gar nicht sichtbar.

   Dieses Modul RECHNET NICHTS NEU. Es liest:
     · den Bericht: /marktbericht/objects/history (Stufe seit v3002) und
       /marktbericht/reports/one (voller Bericht, ein GET, kein Kontingent)
     · die freien Abrufe: /marktbericht/lage/gemessen OHNE Adresse (nur
       Tabellen, keine Umfeld-Messung) und /marktbericht/zensus/objekt
     · was die Reiter ohnehin geholt haben: Automatik-Leiste
       (window._dpZinsAbruf, objekt-reiter.js), Lage-Messung und KI
       (window._lastLageMessung / _lastKiLageData, ki-lage.js), Pilot-
       Mietpreis-Analyse (window._lastKiMiete, ki-miete.js)
   Kein Abruf verbraucht Kontingent. Der Knopf „Marktbericht Stufe 3
   erstellen" geht den vorhandenen Weg (DealPilotObjektReiter.stufeAbrufen)
   und startet erst auf Klick.

   Quellen nach außen neutral (CLAUDE.md): Angebotsmieten heißen „aktueller
   Marktdurchschnitt", nie der Anbieter. Amtliche Quellen (Gutachterausschuss,
   Zensus, Regionaldatenbank) werden genannt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpMbAbgleich) return;
  var VERSION = 'v3002';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return null;
    try { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(n); } catch (e) { return String(n); }
  }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim(); if (!s) return null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return (n != null && isFinite(n)) ? n : null;
  }
  function fv(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function datum(iso) { try { return iso ? new Date(iso).toLocaleDateString('de-DE') : ''; } catch (e) { return ''; } }
  function qm(n) { var f = fmt(n, 2); return f == null ? null : f + ' €/m²'; }
  function eur(n) { var f = fmt(Math.round(n), 0); return f == null ? null : f + ' €'; }
  function key() { return (typeof window._currentObjKey === 'string' && window._currentObjKey) ? window._currentObjKey : null; }
  function api(pfad) {
    if (!window.Auth || typeof Auth.apiCall !== 'function') return Promise.resolve(null);
    return Auth.apiCall(pfad, { method: 'GET' }).then(function (r) { return r || null; }, function () { return null; });
  }

  /* ── Zustand je Objekt ─────────────────────────────────────────────── */
  var S = { key: null, laedt: null, fertig: false, bericht: null, zeile: null, stufe: null, anzahl: 0, nurIndikation: false,
            lage: null, zensus: null, fehler: null };
  /* Sitzungsreste eines anderen Objekts: ki-lage.js setzt seine Ergebnisse nicht
     beim Objektwechsel zurück. Was beim Wechsel schon da war, gehört zum alten Objekt. */
  var _alt = { m: null, k: null };
  function messungFrisch() { var m = window._lastLageMessung; return (m && m !== _alt.m) ? m : null; }
  function kiLageFrisch() { var k = window._lastKiLageData; return (k && k !== _alt.k) ? k : null; }
  function kiMiete() { var x = window._lastKiMiete; return (x && x.key && x.key === key()) ? x : null; }
  function zinsAbruf() { var x = window._dpZinsAbruf; return (x && x.key === key() && x.r) ? x.r : null; }

  function laden(erzwingen) {
    var k = key();
    if (!k) return Promise.resolve(null);
    if (!erzwingen && S.key === k && (S.fertig || S.laedt)) return S.laedt || Promise.resolve(S);
    S = { key: k, laedt: null, fertig: false, bericht: null, zeile: null, stufe: null, anzahl: 0, nurIndikation: false, lage: null, zensus: null, fehler: null };
    var plz = fv('plz'), ort = fv('ort');
    var wflJe = (function () { var w = zahl(fv('wfl')), e = zahl(fv('einheiten')); return w ? (e && e > 1 ? Math.round(w / e) : Math.round(w)) : ''; })();
    var hist = api('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + k)).then(function (j) {
      var h = (j && j.history) || [];
      return h.length ? h : api('/marktbericht/objects/history?ref=' + encodeURIComponent(k)).then(function (j2) { return (j2 && j2.history) || []; });
    });
    var lage = /^\d{5}$/.test(plz)
      ? api('/marktbericht/lage/gemessen?plz=' + plz + '&ort=' + encodeURIComponent(ort) + '&objektart=' + encodeURIComponent(fv('objart')))
      : Promise.resolve(null);
    var zen = /^\d{5}$/.test(plz)
      ? api('/marktbericht/zensus/objekt?plz=' + plz + '&ort=' + encodeURIComponent(ort) + '&baujahr=' + encodeURIComponent(fv('baujahr')) + '&wfl=' + encodeURIComponent(wflJe))
      : Promise.resolve(null);
    var lauf = S;
    S.laedt = Promise.all([hist, lage, zen]).then(function (r) {
      if (S !== lauf) return null;
      S.lage = r[1] && r[1].felder ? r[1] : null;
      S.zensus = r[2] && r[2].available ? r[2] : null;
      var rows = (r[0] || []).filter(function (x) { return x && x.report_id != null; })
        .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      S.anzahl = rows.length;
      if (!rows.length) return null;
      var mitStufe = rows.some(function (x) { return x.wert_stufe != null; });
      var drei = rows.filter(function (x) { return String(x.wert_stufe) === '3'; })[0] || null;
      /* Ohne die Spalte (Bericht-Dienst vor v3002) die drei neuesten Berichte ansehen */
      var kand = drei ? [drei] : (mitStufe ? [rows[0]] : rows.slice(0, 3));
      return Promise.all(kand.map(function (x) { return api('/marktbericht/reports/one?id=' + encodeURIComponent(x.report_id)); })).then(function (ones) {
        if (S !== lauf) return null;
        var wahl = -1;
        ones.forEach(function (o, i) { if (wahl < 0 && o && o.data && o.data.ref && Number(o.data.ref.wert_stufe) === 3) wahl = i; });
        if (wahl < 0) { wahl = ones[0] && ones[0].data ? 0 : -1; S.nurIndikation = true; }
        if (wahl >= 0) {
          S.bericht = ones[wahl].data; S.zeile = kand[wahl];
          S.stufe = Number(S.bericht.ref && S.bericht.ref.wert_stufe) || null;
        }
        return null;
      });
    }).then(function () { if (S === lauf) { S.fertig = true; S.laedt = null; } zeichnen(); return S; },
            function (e) { if (S === lauf) { S.fertig = true; S.laedt = null; S.fehler = String(e && e.message || e); } zeichnen(); return S; });
    zeichnen();
    return S.laedt;
  }

  /* ── Vergleich ─────────────────────────────────────────────────────── */
  var SKALEN = {
    makrolage: ['sehr_gut', 'gut', 'durchschnittlich', 'schwach', 'sehr_schwach'],
    mikrolage: ['sehr_gut', 'gut', 'durchschnittlich', 'schwach', 'sehr_schwach'],
    ds2_bevoelkerung: ['stark_wachsend', 'wachsend', 'stabil', 'leicht_fallend', 'stark_fallend'],
    ds2_nachfrage: ['sehr_stark', 'stark', 'mittel', 'schwach', 'sehr_schwach'],
    ds2_wertsteigerung: ['sehr_hoch', 'hoch', 'mittel', 'niedrig', 'keines'],
    ds2_mietausfall: ['sehr_niedrig', 'niedrig', 'mittel', 'erhoeht', 'hoch']
  };
  function wortVon(id, v) {
    if (!v) return '';
    var e = $(id), o = e && e.querySelector ? e.querySelector('option[value="' + String(v).replace(/"/g, '') + '"]') : null;
    return o ? o.textContent.replace(/\s*\(.*\)\s*$/, '') : String(v).replace(/_/g, ' ');
  }
  function norm(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, '_').replace('ö', 'oe'); }
  /* Ampel: Bezug ist der Marktbericht. Verglichen wird die eigene Angabe, ohne sie der Abruf im Reiter. */
  function ampelZahl(cmp, ber, tolPct, einheit) {
    if (ber == null) return { cls: 'fehlt', txt: 'fehlt im Bericht' };
    if (cmp == null) return { cls: 'fehlt', txt: 'fehlt im Reiter' };
    if (einheit === 'pp') {
      var d = cmp - ber;
      if (Math.abs(d) <= 0.05) return { cls: 'ok', txt: 'gleich' };
      return { cls: Math.abs(d) <= 0.5 ? 'ab' : 'stark', txt: 'weicht ab (' + (d > 0 ? '+' : '−') + fmt(Math.abs(d), 2) + ' Pp.)', d: d };
    }
    if (!(Math.abs(ber) > 0)) return { cls: 'fehlt', txt: 'nicht vergleichbar' };
    var p = (cmp / ber - 1) * 100;
    if (Math.abs(p) <= (tolPct == null ? 5 : tolPct)) return { cls: 'ok', txt: 'gleich' + (Math.abs(p) >= 0.5 ? ' (' + (p > 0 ? '+' : '−') + fmt(Math.abs(p), 0) + ' %)' : ''), p: p };
    return { cls: Math.abs(p) <= 15 ? 'ab' : 'stark', txt: 'weicht ab (' + (p > 0 ? '+' : '−') + fmt(Math.abs(p), 0) + ' %)', p: p };
  }
  function ampelStufe(id, cmp, ber) {
    if (!ber) return { cls: 'fehlt', txt: 'fehlt im Bericht' };
    if (!cmp) return { cls: 'fehlt', txt: 'fehlt im Reiter' };
    var sk = SKALEN[id] || [], a = sk.indexOf(norm(cmp)), b = sk.indexOf(norm(ber));
    if (a < 0 || b < 0) return norm(cmp) === norm(ber) ? { cls: 'ok', txt: 'gleich' } : { cls: 'ab', txt: 'weicht ab' };
    var d = a - b;
    if (!d) return { cls: 'ok', txt: 'gleich' };
    return { cls: Math.abs(d) >= 2 ? 'stark' : 'ab', txt: 'weicht ab (' + Math.abs(d) + (Math.abs(d) === 1 ? ' Stufe ' : ' Stufen ') + (d < 0 ? 'besser' : 'schlechter') + ')', d: d };
  }

  /* Herkunft eines Lage-Felds im Formular (ki-lage.js, #_lage_herkunft) */
  function lageHerkunft(id) {
    try {
      var h = window.DpLageHerkunft ? DpLageHerkunft.lesen() : {};
      var x = h[id];
      if (x && String(x.wert) === fv(id)) return x.art === 'gemessen' ? 'aus der Messung übernommen' : x.art === 'ki' ? 'aus der KI übernommen' : 'eigene Angabe';
    } catch (e) {}
    return fv(id) ? 'eigene Angabe' : '';
  }

  /* ── Zeilen: Reiter Objekt ─────────────────────────────────────────── */
  var LAGE_BASIS = {
    makrolage: 'Regionaldatenbank der Statistischen Ämter (Bevölkerung, Kaufkraft, Arbeitslosigkeit, Wanderung)',
    mikrolage: 'Umfeld-Analyse im Umkreis von 2 km (Einkaufen, ÖPNV, Gesundheit, Freizeit, Bildung, Gastronomie)',
    ds2_bevoelkerung: 'Regionaldatenbank, Bevölkerungsstand, Trend je Jahr',
    ds2_nachfrage: 'Vermarktungsdauer der Kaufangebote (Median der letzten 12 Monate)',
    ds2_wertsteigerung: 'Entwicklung der Angebotspreise je Jahr',
    ds2_mietausfall: 'marktaktiver Leerstand laut Zensus 2022 (Stichtag 15.05.2022)'
  };
  function lageZeile(titel, id, bKey, opt) {
    opt = opt || {};
    var B = S.bericht || {}, st = (B.assessment_stufen || {})[bKey] || null;
    var eig = fv(id), eigH = lageHerkunft(id);
    var abr = null, abrW = '';
    var m = (S.lage && S.lage.felder && S.lage.felder[id]) || null;
    var mf = messungFrisch(); if (!m && mf && mf.felder && mf.felder[id]) m = mf.felder[id];
    if (m) { abr = m.stufe; abrW = (m.wert != null ? String(m.wert).replace('.', ',') + ' ' + (m.einheit || '') : '') + ' · gemessen'; }
    var kl = kiLageFrisch();
    if (!abr && kl && opt.ki && kl[opt.ki] && kl[opt.ki].value) { abr = kl[opt.ki].value; abrW = 'Pilot-Einschätzung (KI)'; }
    var ber = st ? st.stufe : null;
    var cmp = eig || abr;
    var a = ampelStufe(id, cmp, ber);
    var erkl = '';
    if (a.cls !== 'ok' && a.cls !== 'fehlt') {
      erkl = (eig ? 'Deine Angabe' : 'Der Abruf im Reiter') + ' weicht vom Bericht ab. Der Bericht misst: ' + (st.basis || LAGE_BASIS[id] || '') + ' — Wert ' + String(st.wert).replace('.', ',') + ' ' + (st.einheit || '') + '. '
        + (eig && eigH === 'eigene Angabe' ? 'Eine Einschätzung vor Ort darf abweichen (z. B. Lärm, Straßenbild) — sie geht so in den Deal Score ein. ' : '')
        + (m && eig && norm(m.stufe) === norm(ber) ? 'Messung im Reiter und Bericht stimmen überein.' : '');
    } else if (a.cls === 'fehlt' && !ber) {
      erkl = opt.ohneBericht || '';
    } else if (a.cls === 'fehlt' && !cmp && id === 'mikrolage') {
      erkl = 'Die Mikrolage misst der Reiter nur mit der Adresse (Knopf „Komplette Lage analysieren").';
    }
    var schwelle = st && st.schwelle ? 'Schwelle (Modellannahme): ' + st.schwelle : (m && m.schwelle ? 'Schwelle (Modellannahme): ' + m.schwelle : '');
    return {
      k: titel,
      eig: eig ? { w: wortVon(id, eig), h: eigH } : null,
      abr: abr ? { w: wortVon(id, abr), h: abrW } : (id === 'mikrolage' ? { leer: 'nur mit Adresse' } : null),
      ber: st ? { w: st.wort || wortVon(id, st.stufe), h: String(st.wert).replace('.', ',') + ' ' + (st.einheit || '') } : null,
      a: a, woher: LAGE_BASIS[id] + (schwelle ? ' · ' + schwelle : ''), erkl: erkl,
      uebernehmen: (st && st.stufe && norm(eig) !== norm(st.stufe) && SKALEN[id] && SKALEN[id].indexOf(norm(st.stufe)) >= 0) ? { id: id, wert: norm(st.stufe), wort: st.wort } : null
    };
  }

  function zeilenObjekt() {
    var B = S.bericht || {}, cc = B.cross_check || {}, ass = cc.assumptions || {}, z = [];
    z.push({ gruppe: 'Lage und Einschätzung' });
    z.push(lageZeile('Makrolage', 'makrolage', 'makrolage', { ki: 'makro' }));
    z.push(lageZeile('Mikrolage', 'mikrolage', 'mikrolage', { ki: 'mikro' }));
    z.push(lageZeile('Bevölkerung', 'ds2_bevoelkerung', 'bevoelkerung', { ki: 'bevoelkerung' }));
    z.push(lageZeile('Nachfrage', 'ds2_nachfrage', 'nachfrage', { ki: 'nachfrage' }));
    z.push(lageZeile('Wertsteigerung', 'ds2_wertsteigerung', 'wertsteigerung', { ki: 'wertsteigerung' }));
    (function () {
      var eig = fv('ds2_entwicklung'), kl = kiLageFrisch(), abr = kl && kl.entwicklung && kl.entwicklung.value;
      var ber = (B.assessment || {}).entwicklung || null;
      z.push({ k: 'Entwicklung', eig: eig ? { w: wortVon('ds2_entwicklung', eig), h: lageHerkunft('ds2_entwicklung') } : null,
        abr: abr ? { w: wortVon('ds2_entwicklung', abr), h: 'Pilot-Einschätzung (KI)' } : null,
        ber: ber ? { w: ber, h: 'Marktentwicklung' } : null,
        a: ber ? { cls: 'info', txt: 'anderer Maßstab' } : { cls: 'fehlt', txt: 'fehlt im Bericht' },
        woher: 'Feld: Entwicklungsmöglichkeiten des Objekts (Ausbau, Teilung, Nachverdichtung). Bericht: Entwicklung des Marktes aus Angebotspreisen und Bevölkerung.',
        erkl: ber ? 'Zwei verschiedene Fragen: das Feld fragt nach Möglichkeiten am Objekt, der Bericht beschreibt den Markt. Sie werden deshalb nicht gegeneinander gewertet.' : '' });
    })();

    z.push({ gruppe: 'Boden und Wertparameter' });
    /* Bodenrichtwert */
    (function () {
      var lv = B.land_value || {}, raw = lv.properties_raw || {};
      var eig = zahl(fv('brw_manuell')), abr = zahl(fv('brw'));
      var ber = (lv.available && zahl(lv.value_sqm) != null) ? zahl(lv.value_sqm) : null;
      var aus = raw['Bezeichnung des Gutachterausschusses'] || '';
      var a = ampelZahl(eig != null ? eig : abr, ber, 1);
      var bwH = [lv.zone ? 'Zone ' + lv.zone : '', lv.stichtag ? 'Stichtag ' + datum(lv.stichtag) : '', lv.nutzung ? 'Nutzung ' + lv.nutzung : ''].filter(Boolean).join(' · ');
      z.push({ k: 'Bodenrichtwert', eig: eig != null ? { w: qm(eig), h: 'manueller Ansatz (Wertermittlung)' } : null,
        abr: abr != null ? { w: qm(abr), h: 'Feld Bodenrichtwert' + (fv('brw_stichtag') ? ' · Stichtag ' + fv('brw_stichtag') : '') } : null,
        ber: ber != null ? { w: qm(ber), h: bwH } : null, a: a,
        woher: 'amtlich: Bodenrichtwert des Gutachterausschusses' + (aus ? ' (' + aus + ')' : '') + ', Bodenrichtwertinformationssystem des Landes (Open Data)' + (lv.quellenvermerk ? ' · ' + lv.quellenvermerk : ''),
        erkl: (a.cls === 'ab' || a.cls === 'stark') ? 'Unterschiedliche Bodenrichtwerte entstehen meist durch einen anderen Stichtag (Jahrgang) oder eine andere Zone — der Bericht sucht die Zone an der Adresse, ohne Straße fällt der Abruf auf den Ortsmittelpunkt.' : '' });
      var bw = cc.bodenwert || {};
      if (zahl(bw.wert) != null) {
        var sch = (bw.schritte || []).map(function (x) { return x.detail || x.pos; }).filter(Boolean).join(' · ');
        z.push({ k: 'Bodenwert (angesetzt)', eig: null, abr: null, ber: { w: eur(zahl(bw.wert)), h: sch }, a: { cls: 'info', txt: 'nur im Bericht' },
          woher: 'Bodenrichtwert × Fläche, angepasst an die Grundstücksgröße (§ 40 ImmoWertV), soweit der Ausschuss einen Koeffizienten führt' + ((bw.hinweise || []).length ? ' · ' + bw.hinweise.join(' ') : ''), erkl: '' });
      }
    })();
    /* Liegenschaftszins */
    (function () {
      var r = zinsAbruf();
      var eig = zahl(fv('lzs_pct')), abr = r && r.verfuegbar ? zahl(r.wert_pct) : null;
      var ber = zahl(ass.liegenschaftszins_pct_effektiv);
      var a = ampelZahl(eig != null ? eig : abr, ber, null, 'pp');
      var bh = [ass.liegenschaftszins_stufe ? 'Stufe ' + ass.liegenschaftszins_stufe : '', ass.liegenschaftszins_berichtsjahr ? 'Jahrgang ' + ass.liegenschaftszins_berichtsjahr : '', ass.liegenschaftszins_zweig ? 'Zweig ' + ass.liegenschaftszins_zweig : ''].filter(Boolean).join(' · ');
      var erkl = '';
      if (a.cls === 'ab' || a.cls === 'stark') {
        erkl = eig != null ? 'Dein eigener Ansatz ersetzt im nächsten Bericht den amtlichen Satz.'
          : 'Automatik und Bericht unterscheiden sich — meist, weil sich Objektangaben (Objektart → Zweig, Baujahr, Modernisierungspunkte → Restnutzungsdauer) seit dem Bericht geändert haben oder ein neuer Jahrgang im Register liegt.';
      }
      z.push({ k: 'Liegenschaftszins', eig: eig != null ? { w: fmt(eig, 2) + ' %', h: 'eigener Ansatz' } : null,
        abr: abr != null ? { w: fmt(abr, 2) + ' %', h: 'Automatik · Stufe ' + (r.stufe || '?') + (r.berichtsjahr ? ' · ' + r.berichtsjahr : '') } : (r ? { leer: 'kein Wert' } : null),
        ber: ber != null ? { w: fmt(ber, 2) + ' %', h: bh } : null, a: a,
        woher: 'amtlich (Stufe A): Liegenschaftszinssatz des Gutachterausschusses (§ 21 Abs. 2 ImmoWertV); B/C übergeordnet oder Nachbargemeinde; N DealPilot-Formel; D gesetzlicher Auffangwert § 256 BewG'
          + (r && (r.ausschuss || r.quelle) ? ' · Automatik: ' + String(r.quelle || r.ausschuss).split(',')[0] : ''),
        erkl: erkl });
    })();
    /* Sachwertfaktor */
    (function () {
      var sw = cc.sachwert || {}, r = zinsAbruf();
      var eig = zahl(fv('sachwertfaktor'));
      var ber = typeof sw.sachwertfaktor === 'number' ? sw.sachwertfaktor : (sw.sachwertfaktor && zahl(sw.sachwertfaktor.wert));
      var sq = r && r.sachwertfaktor_quelle;
      var stf = sw.sachwertfaktor && sw.sachwertfaktor.stufe ? 'Stufe ' + sw.sachwertfaktor.stufe : (sw.sachwertfaktor_stufe ? 'Stufe ' + sw.sachwertfaktor_stufe : '');
      z.push({ k: 'Sachwertfaktor', eig: eig != null ? { w: fmt(eig, 2), h: 'eigener Ansatz' } : null,
        abr: sq ? { w: sq.verfuegbar ? 'Tabelle vorhanden' : 'keine Tabelle', h: String(sq.ausschuss || '').split(',')[0] } : null,
        ber: ber != null ? { w: fmt(ber, 2), h: [stf, sw.marktangepasst === false ? 'nicht marktangepasst' : ''].filter(Boolean).join(' · ') } : (sw.available === false || sw.vorlaeufig ? { leer: 'kein Faktor' } : null),
        a: eig != null ? ampelZahl(eig, ber, 2) : (ber != null ? { cls: 'info', txt: 'Zahl nur im Bericht' } : { cls: 'fehlt', txt: 'fehlt im Bericht' }),
        woher: 'amtlich: Sachwertfaktor des Gutachterausschusses (§ 21 Abs. 3 ImmoWertV), im Bericht aus dem vorläufigen Sachwert abgelesen — vorher gibt es keine Zahl' + (sw.sachwertfaktor_grund ? ' · ' + sw.sachwertfaktor_grund : ''),
        erkl: '' });
    })();
    /* GND / RND */
    (function () {
      var r = zinsAbruf(), sw = cc.sachwert || {}, ew = cc.ertragswert || {};
      var abr = r && r.rnd_jahre != null ? Math.round(Number(r.rnd_jahre)) : null;
      var berR = zahl(sw.restnutzungsdauer_jahre != null ? sw.restnutzungsdauer_jahre : ew.restnutzungsdauer_jahre);
      var berG = zahl(ass.gnd_jahre);
      var a = ampelZahl(abr, berR != null ? Math.round(berR) : null, 0);
      if (a.cls === 'ab' || a.cls === 'stark') a.txt = 'weicht ab (' + (abr - Math.round(berR) > 0 ? '+' : '−') + Math.abs(abr - Math.round(berR)) + ' J.)';
      z.push({ k: 'Restnutzungsdauer', eig: null,
        abr: abr != null ? { w: abr + ' Jahre', h: 'GND ' + (r.gnd_jahre || '?') + (r.rnd_quelle === 'anlage2' ? ' · Anlage 2' : r.rnd_quelle === 'geschaetzt' ? ' · geschätzt' : '') } : null,
        ber: berR != null ? { w: Math.round(berR) + ' Jahre', h: berG ? 'GND ' + berG : '' } : null, a: a,
        woher: 'Anlage 1/2 ImmoWertV: Gesamtnutzungsdauer aus dem Modell des Ausschusses, Restnutzungsdauer aus Baujahr und Modernisierungspunkten',
        erkl: (a.cls === 'ab' || a.cls === 'stark') ? 'Meist haben sich Baujahr oder Modernisierungspunkte seit dem Bericht geändert — die Abrufparameter unten zeigen, womit der Bericht gerechnet hat.' : '' });
    })();
    /* Verkehrswert */
    (function () {
      var vf = cc.verfahrenswahl || {}, fu = String(vf.verfahren || '');
      var W = { ertragswert: zahl((cc.ertragswert || {}).value_eur), sachwert: zahl((cc.sachwert || {}).value_eur), vergleichswert: zahl((cc.comparison || {}).vergleichswert_eur) };
      var mv = ((B.valuation || {}).market_value || {}).estimated;
      var ber = W[fu] != null ? W[fu] : null;
      var eig = zahl(fv('svwert'));
      var namen = { ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert' };
      var alle = Object.keys(W).filter(function (x) { return W[x] != null; }).map(function (x) { return namen[x] + ' ' + eur(W[x]) + (x === fu ? ' (führend)' : ''); });
      if (zahl(mv) != null) alle.push('Marktpreisindikation ' + eur(zahl(mv)) + ' (Angebotspreise)');
      var a = ampelZahl(eig, ber, 5);
      var her = { gutachten: 'Gutachten', bank: 'Bankbewertung', marktbericht: 'aus dem Marktbericht', indikation: 'Angebotsniveau', eigene: 'eigene Schätzung' }[fv('svw_herkunft')] || 'eigene Angabe';
      z.push({ k: 'Verkehrswert / Marktwert', eig: eig != null ? { w: eur(eig), h: her } : null, abr: null,
        ber: ber != null ? { w: eur(ber), h: namen[fu] + ' (führend)' } : null, a: a,
        woher: 'Bericht: ' + (alle.join(' · ') || '—') + (vf.grund ? ' · führend: ' + vf.grund + (vf.quelle ? ' (' + vf.quelle + ')' : '') : ''),
        erkl: (a.cls === 'ab' || a.cls === 'stark') ? 'Ein Verkehrswert nach § 194 BauGB entsteht nur durch ein Gutachten; der Bericht ist eine Wertermittlung nach ImmoWertV mit Herkunftsstufen. Weicht dein Wert ab, lohnt der Blick auf das führende Verfahren und seine Parameter (Zins, Miete, Bodenwert).' : '' });
    })();
    return z;
  }

  /* ── Zeilen: Reiter Miete ──────────────────────────────────────────── */
  function zeilenMiete() {
    var B = S.bericht || {}, cc = B.cross_check || {}, ew = cc.ertragswert || {}, ref = B.ref || {}, rent = B.rent || {}, z = [];
    var band = ew.miete_band || cc.miete_band || null, ms = ew.miete_stufe || null, am = cc.amtliche_miete || null;
    var km = kiMiete(), bel = km && km.belege;
    var wfl = zahl(fv('wfl')), nkm = zahl(fv('nkm'));
    var istF = (wfl && nkm) ? Math.round(nkm / wfl * 100) / 100 : null;
    var istB = (zahl(ref.monthly_net_rent) && zahl(ref.living_area)) ? Math.round(zahl(ref.monthly_net_rent) / zahl(ref.living_area) * 100) / 100 : null;

    z.push({ gruppe: 'Miete' });
    (function () {
      var a = ampelZahl(istF, istB, 1);
      z.push({ k: 'Ist-Miete (kalt)', eig: istF != null ? { w: qm(istF), h: eur(nkm) + ' / ' + fmt(wfl, 0) + ' m²' } : null, abr: null,
        ber: istB != null ? { w: qm(istB), h: eur(zahl(ref.monthly_net_rent)) + ' / ' + fmt(zahl(ref.living_area), 0) + ' m²' } : null, a: a,
        woher: 'eigene Angabe: Nettokaltmiete durch Wohnfläche. Der Bericht rechnet mit dem Stand zum Berichtsdatum.',
        erkl: (a.cls === 'ab' || a.cls === 'stark') ? 'Miete oder Wohnfläche haben sich seit dem Bericht geändert — der Bericht rechnet mit dem alten Stand. Für einen aktuellen Abgleich einen neuen Bericht erstellen.' : '' });
    })();
    (function () {
      var eig = zahl(fv('ds2_marktmiete')), abr = km ? km.markt_qm : null;
      var ber = ms ? zahl(ms.qm) : (band ? zahl(band.anker_qm) : null);
      var cmp = eig != null ? eig : abr;
      var a = ampelZahl(cmp, ber, 5);
      var et = ms ? ms.etikett : (band ? band.anker_etikett : '');
      var erkl = '';
      if (a.p != null && a.p > 5) erkl = (eig != null ? 'Deine Marktmiete' : 'Die Pilot-Recherche') + ' liegt über dem Anker des Berichts. Angebotsmieten liegen typisch über Bestandsmieten; der Bericht setzt die marktüblich erzielbare Miete an (§ 31 Abs. 2 ImmoWertV) und misst sie an der ' + et + ' — der Liegenschaftszins gilt nur mit der Miete, aus der er abgeleitet ist (§ 10 ImmoWertV).';
      else if (a.p != null && a.p < -5) erkl = (eig != null ? 'Deine Marktmiete' : 'Die Pilot-Recherche') + ' liegt unter dem Anker des Berichts (' + et + '). Wer niedriger ansetzt, rechnet vorsichtiger; der Ertragswert nimmt die Ist-Miete, solange sie im Band liegt.';
      z.push({ k: 'Marktmiete', eig: eig != null ? { w: qm(eig), h: 'Feld Marktmiete (Deal Score)' } : null,
        abr: abr != null ? { w: qm(abr), h: 'Pilot-Recherche (KI mit Websuche)' } : { leer: 'Recherche nicht gelaufen' },
        ber: ber != null ? { w: qm(ber), h: 'Anker: ' + et } : null, a: a,
        woher: 'Bericht: Anker der Marktüblichkeit in dieser Rangfolge — amtliche Miete des Gutachterausschusses, Ø Miete des Liegenschaftszinssatzes, Bestandsmiete Zensus 2022 (fortgeschrieben), zuletzt der aktuelle Marktdurchschnitt' + (ms && ms.quelle ? ' · hier: ' + ms.quelle : ''),
        erkl: erkl, uebernehmen: (ber != null && eig !== ber) ? { id: 'ds2_marktmiete', wert: fmt(ber, 2), wort: qm(ber) } : null });
    })();
    (function () {
      var ber = am && am.verfuegbar ? zahl(am.miete_qm) : null;
      var abr = bel && bel.amtlich && !bel.amtlich.fehlt ? zahl(bel.amtlich.wert_qm) : null;
      var st = am && am.staffel ? am.staffel.map(function (x) { return x.pos + (x.wert != null ? ' ' + String(x.wert).replace('.', ',') : '') + (x.faktor != null ? ' ' + String(x.faktor).replace('.', ',') : ''); }).join(' · ') : '';
      z.push({ k: 'Amtliche Vergleichsmiete', eig: null,
        abr: abr != null ? { w: qm(abr), h: 'Beleg der Pilot-Recherche' } : null,
        ber: ber != null ? { w: qm(ber), h: (am.ausschuss || '').replace(/^Der /, '') } : { leer: am ? 'liegt nicht vor' : '—' },
        a: abr != null ? ampelZahl(abr, ber, 1) : (ber != null ? { cls: 'info', txt: 'nur im Bericht' } : { cls: 'fehlt', txt: 'fehlt' }),
        woher: 'amtlich: Mietpreisübersicht des Gutachterausschusses' + (am && am.quelle ? ' — ' + am.quelle : '') + (st ? ' · Rechenweg: ' + st : ''),
        erkl: ber == null ? 'Wo der Ausschuss keine Mietpreisübersicht veröffentlicht, steht der Weg dorthin: qualifizierter Mietspiegel der Gemeinde oder Grundstücksmarktbericht des Ausschusses — dort nachsehen und als Marktmiete eintragen.' : '' });
    })();
    (function () {
      var ber = band ? zahl(band.satz_qm) : null;
      var lz = (cc.assumptions || {});
      z.push({ k: 'Ø Miete des Liegenschaftszinssatzes', eig: null, abr: null,
        ber: ber != null ? { w: qm(ber), h: lz.liegenschaftszins_berichtsjahr ? 'Jahrgang ' + lz.liegenschaftszins_berichtsjahr : '' } : { leer: 'Satz führt keine Miete' },
        a: ber != null ? { cls: 'info', txt: 'nur im Bericht' } : { cls: 'fehlt', txt: 'fehlt' },
        woher: 'amtlich: Ø Miete der Kauffälle, aus denen der Ausschuss den Liegenschaftszins abgeleitet hat (Modellansatz des Satzes)', erkl: '' });
    })();
    (function () {
      var zb = B.zensus || {}, g = zb.gemeinde || null, kr = zb.kreis || null;
      var berE = (g && zahl(g.nettokaltmiete_qm) != null) ? g : kr;
      var ber = berE ? zahl(berE.nettokaltmiete_qm) : null;
      var ZA = S.zensus || {}, ga = ZA.gemeinde || null, ka = ZA.kreis || null;
      var abrE = (ga && zahl(ga.nettokaltmiete_qm) != null) ? ga : ka;
      var abr = abrE ? zahl(abrE.nettokaltmiete_qm) : (zahl(ZA.nettokaltmiete_qm));
      function kl(E) { if (!E) return ''; var t = []; if (E.miete_baujahr && E.miete_baujahr.wert != null) t.push(E.miete_baujahr.klasse + ' ' + qm(E.miete_baujahr.wert)); if (E.miete_flaeche && E.miete_flaeche.wert != null) t.push(E.miete_flaeche.klasse + ' ' + qm(E.miete_flaeche.wert)); return t.join(' · '); }
      var fort = ms && ms.code === 'zensus' ? zahl(ms.qm) : null;
      z.push({ k: 'Bestandsmiete Zensus 2022', eig: null,
        abr: abr != null ? { w: qm(abr), h: (abrE && abrE.name ? abrE.name + ' · ' : '') + kl(abrE) } : null,
        ber: ber != null ? { w: qm(ber), h: (berE.name ? berE.name + ' · ' : '') + kl(berE) + (fort != null ? ' · fortgeschrieben ' + qm(fort) : '') } : null,
        a: ampelZahl(abr, ber, 1),
        woher: 'Zensus 2022 (Stichtag 15.05.2022), Gemeinde vor Kreis, © Statistische Ämter des Bundes und der Länder, dl-de/by-2-0. Bestandsmieten laufender Verträge — ' + (fort != null ? 'im Bericht mit dem Nettokaltmietenindex auf den Stichtag fortgeschrieben.' : 'hier der Stand 2022, nicht fortgeschrieben.'),
        erkl: '' });
    })();
    (function () {
      var ber = zahl(rent.median_per_sqm), abr = bel && bel.markt && !bel.markt.fehlt ? zahl(bel.markt.wert_qm) : null;
      var demo = !!rent.enthaelt_demodaten;
      var h = [];
      if (zahl(rent.q25_per_sqm) != null && zahl(rent.q75_per_sqm) != null) h.push('mittlere Hälfte ' + fmt(rent.q25_per_sqm, 2) + '–' + fmt(rent.q75_per_sqm, 2));
      if (rent.sample_size) h.push(rent.sample_size + ' Angebote');
      if (zahl(rent.used_radius_m)) h.push(fmt(rent.used_radius_m / 1000, 1) + ' km');
      var a = abr != null ? ampelZahl(abr, ber, 2) : (istF != null ? ampelZahl(istF, ber, 5) : { cls: ber != null ? 'info' : 'fehlt', txt: ber != null ? 'nur im Bericht' : 'fehlt' });
      var erkl = (ber != null && istF != null && ber > istF * 1.05) ? 'Die Angebotsmiete liegt ' + fmt((ber / istF - 1) * 100, 0) + ' % über deiner Ist-Miete. Inserate sind Angebote, keine Abschlüsse, und zeigen Neuvermietung — Bestandsmieten liegen typisch darunter. Ein Abschlag für Mieten ist nicht gemessen; der Bericht nimmt die Angebotsmiete nur, wenn alles andere fehlt.' : '';
      if (abr != null) a.txt = a.txt.replace('weicht ab', 'Beleg weicht ab');
      z.push({ k: 'Angebotsmiete', eig: null,
        abr: abr != null ? { w: qm(abr), h: 'Beleg der Pilot-Recherche' } : null,
        ber: ber != null && !demo ? { w: qm(ber), h: h.join(' · ') } : null, a: a,
        woher: 'aktueller Marktdurchschnitt der Angebotsmieten im Umkreis (Median)' + (zahl(B.rent_trend_pct) != null ? ' · Entwicklung ' + fmt(B.rent_trend_pct, 1) + ' %/Jahr' : ''),
        erkl: erkl + (abr == null ? '' : ' Verglichen ist hier der Beleg mit dem Bericht (Ampel); daneben deine Ist-Miete.') });
    })();
    (function () {
      if (!band || zahl(band.unten_qm) == null) return;
      var u = zahl(band.unten_qm), o = zahl(band.oben_qm);
      var a = istF == null ? { cls: 'fehlt', txt: 'Ist-Miete fehlt' } : (istF >= u && istF <= o ? { cls: 'ok', txt: 'Ist-Miete im Band' } : { cls: 'ab', txt: 'Ist-Miete ' + (istF > o ? 'über' : 'unter') + ' dem Band' });
      z.push({ k: 'Band der Marktüblichkeit', eig: istF != null ? { w: qm(istF), h: 'deine Ist-Miete' } : null, abr: null,
        ber: { w: fmt(u, 2) + '–' + fmt(o, 2) + ' €/m²', h: band.regel || '' }, a: a,
        woher: 'Bericht: Anker ± ' + (band.band_pct || 20) + ' % — DealPilot-Analyseparameter, keine gesetzliche Grenze. Ist-Miete im Band gilt als marktüblich (§ 31 Abs. 2 ImmoWertV), geprüft je Wohnung.',
        erkl: a.cls === 'ab' ? 'Außerhalb des Bandes setzt der Ertragswert die Bandkante bzw. den Anker an; die Über- oder Untervermietung ist ein besonderes objektspezifisches Merkmal (§ 8 Abs. 3 ImmoWertV), nur für die gesicherte Restlaufzeit des Vertrags.' : '' });
    })();
    (function () {
      var mh = ew.miete_herkunft || {}, ber = zahl(mh.angesetzt_qm != null ? mh.angesetzt_qm : ew.miete_qm);
      if (ber == null) return;
      var a = ampelZahl(istF, ber, 5);
      z.push({ k: 'Im Ertragswert angesetzt', eig: istF != null ? { w: qm(istF), h: 'deine Ist-Miete' } : null, abr: null,
        ber: { w: qm(ber), h: mh.n_oben ? mh.n_oben + ' Whg. über dem Band' : (mh.n_unten ? mh.n_unten + ' Whg. unter dem Band' : '') }, a: a,
        woher: 'Bericht: ' + (ew.miete_quelle || 'Miete des Ertragswerts'),
        erkl: (a.cls === 'ab' || a.cls === 'stark') ? 'Der Ertragswert kapitalisiert die marktüblich erzielbare Miete, nicht die Ist-Miete um jeden Preis: liegt sie außerhalb des Bandes, gilt die Bandkante bzw. der Anker (§ 31 Abs. 2, § 10 ImmoWertV).' : '' });
    })();
    z.push({ gruppe: 'Mietausfall und Leerstand' });
    z.push(lageZeile('Mietausfallrisiko', 'ds2_mietausfall', 'mietausfallrisiko', { ki: 'mietausfall' }));
    (function () {
      var zb = B.zensus || {}, g = zb.gemeinde && zahl(zb.gemeinde.leerstandsquote_marktaktiv) != null ? zb.gemeinde : zb.kreis;
      var ber = g ? zahl(g.leerstandsquote_marktaktiv) : null;
      var ZA = S.zensus || {}, ga = ZA.gemeinde && zahl(ZA.gemeinde.leerstandsquote_marktaktiv) != null ? ZA.gemeinde : ZA.kreis;
      var abr = ga ? zahl(ga.leerstandsquote_marktaktiv) : null;
      z.push({ k: 'Leerstand (marktaktiv)', eig: null,
        abr: abr != null ? { w: fmt(abr, 1) + ' %', h: ga.name || '' } : null,
        ber: ber != null ? { w: fmt(ber, 1) + ' %', h: g.name || '' } : null,
        a: ampelZahl(abr, ber, 1),
        woher: 'Zensus 2022 (Stichtag 15.05.2022), marktaktiver Leerstand (ohne Dauerleerstand über 12 Monate), Gemeinde vor Kreis', erkl: '' });
    })();
    return z;
  }

  /* ── Abrufparameter ────────────────────────────────────────────────── */
  function parameter(art) {
    var B = S.bericht || {}, ref = B.ref || {};
    var mp = null; try { mp = window.DealPilotObjektReiter && DealPilotObjektReiter.modPunkte ? DealPilotObjektReiter.modPunkte() : null; } catch (e) {}
    var P = [
      ['Adresse', [fv('str'), fv('hnr')].join(' ').trim() + ', ' + [fv('plz'), fv('ort')].join(' ').trim(), ref.address || B.address && B.address.formatted || null, 'text'],
      ['Objektart', fv('objart'), ref.property_type || null, 'art'],
      ['Baujahr', zahl(fv('baujahr')), zahl(ref.build_year), 'zahl0'],
      ['Wohnfläche (m²)', zahl(fv('wfl')), zahl(ref.living_area), 'zahl'],
      ['Einheiten', zahl(fv('einheiten')), zahl(ref.units), 'zahl0'],
      ['Grundstück (m²)', zahl(fv('gsfl')), zahl(ref.plot_area), 'zahl0'],
      ['Nettokaltmiete / Monat (€)', zahl(fv('nkm')), zahl(ref.monthly_net_rent), 'zahl0'],
      ['Kaufpreis (€)', zahl(fv('kp')), zahl(ref.purchase_price), 'zahl0'],
      ['Modernisierungspunkte', mp ? mp.total : null, zahl(ref.mod_punkte), 'zahl0'],
      ['Ausstattung', fv('ausst'), ref.quality || null, 'text'],
      ['Zustand', fv('ds2_zustand'), ref.condition || null, 'text'],
      ['Standardstufe', zahl(fv('standardstufe')), zahl(ref.standardstufe), 'zahl'],
      ['Bodenrichtwert manuell (€/m²)', zahl(fv('brw_manuell')), zahl(ref.land_value_manual), 'zahl'],
      ['Liegenschaftszins eigen (%)', zahl(fv('lzs_pct')), zahl(ref.lzs_pct), 'zahl'],
      ['Sachwertfaktor eigen', zahl(fv('sachwertfaktor')), zahl(ref.sachwertfaktor), 'zahl']
    ];
    var anders = 0;
    var rows = P.map(function (p) {
      var a = p[1], b = p[2], t = p[3];
      var aT = (a == null || a === '') ? '—' : (t === 'zahl0' ? fmt(a, 0) : t === 'zahl' ? fmt(a, 2).replace(/,00$/, '') : String(a));
      var bT = (b == null || b === '') ? '—' : (t === 'zahl0' ? fmt(b, 0) : t === 'zahl' ? fmt(b, 2).replace(/,00$/, '') : String(b));
      var diff = false;
      if (S.bericht) {
        if (t === 'zahl' || t === 'zahl0') diff = (a != null || b != null) && !(a != null && b != null && Math.abs(a - b) < 0.01);
        else if (t === 'art') diff = !!(a && b && norm(a).slice(0, 3) !== norm(b).slice(0, 3) && !(/etw|wohn/.test(norm(a)) && /wohn|etw/.test(norm(b))));
        else if (p[0] === 'Adresse') diff = !!(a && b && norm(b).indexOf(norm(fv('plz'))) < 0);
        else diff = !!(a && b && norm(a) !== norm(b));
        if (a == null || a === '') diff = diff && b != null && b !== '' && t !== 'text';
      }
      if (diff) anders++;
      return '<tr' + (diff ? ' class="mba-p-diff"' : '') + '><td>' + esc(p[0]) + '</td><td>' + esc(aT) + '</td><td>' + esc(bT) + (diff ? ' <span class="mba-pill mba-ab">geändert</span>' : '') + '</td></tr>';
    }).join('');
    var plz = fv('plz'), ort = fv('ort');
    var abrufe = [
      ['Lage gemessen', 'PLZ ' + (plz || '—') + ', Ort ' + (ort || '—') + ', Objektart ' + (fv('objart') || '—') + ' — ohne Adresse, also ohne Umfeld-Messung (frei). Die Mikrolage misst „Komplette Lage analysieren“ mit der Adresse.', S.lage ? 'ok' : 'leer'],
      ['Zensus 2022', 'PLZ, Ort, Baujahr ' + (fv('baujahr') || '—') + ', Wohnfläche je Wohnung — Gemeinde vor Kreis (frei)', S.zensus ? 'ok' : 'leer'],
      ['Liegenschaftszins (Automatik)', 'PLZ, Ort, Objektart, Baujahr, Einheiten, Nutzungsart, Wohnfläche, Modernisierungspunkte — Register der Gutachterausschüsse (frei)', zinsAbruf() ? 'ok' : 'leer'],
      ['Bodenrichtwert', 'Adresse → Koordinate → Bodenrichtwertzone des Landes (Open Data, frei), Knopf am Feld', fv('brw') ? 'ok' : 'leer'],
      ['Pilot-Mietpreis-Analyse', 'Adresse, Wohnfläche, Nettokaltmiete — KI mit Websuche plus Belege aus Bericht und Zensus (Kontingent)', kiMiete() ? 'ok' : 'leer'],
      ['Marktbericht', S.zeile ? 'Bericht vom ' + datum(S.zeile.created_at) + ', Stufe ' + (S.stufe || '?') + ' — ' + S.anzahl + ' Bericht(e) im Verlauf' : 'kein Bericht', S.bericht ? 'ok' : 'leer']
    ].map(function (x) { return '<li><b>' + esc(x[0]) + '</b> <span class="mba-pill mba-' + (x[2] === 'ok' ? 'ok">abgerufen' : 'fehlt">nicht abgerufen') + '</span><br><span class="mba-h">' + esc(x[1]) + '</span></li>'; }).join('');
    void art;
    return '<details class="mba-param"><summary>Abrufparameter — womit der Reiter fragt und der Bericht gerechnet hat'
      + (anders ? ' <span class="mba-pill mba-ab">' + anders + ' seit dem Bericht geändert</span>' : '') + '</summary>'
      + '<div class="mba-scroll"><table class="mba-ptab"><thead><tr><th>Parameter</th><th>im Reiter jetzt</th><th>im Bericht verwendet</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<ul class="mba-abrufe">' + abrufe + '</ul></details>';
  }

  /* ── Zeichnen ──────────────────────────────────────────────────────── */
  function zelle(x, titel) {
    if (!x) return '<div class="mba-c" data-t="' + titel + '"><span class="mba-leer">—</span></div>';
    if (x.leer) return '<div class="mba-c" data-t="' + titel + '"><span class="mba-leer">' + esc(x.leer) + '</span></div>';
    return '<div class="mba-c" data-t="' + titel + '"><b>' + esc(x.w) + '</b>' + (x.h ? '<span class="mba-h">' + esc(x.h) + '</span>' : '') + '</div>';
  }
  function zeileHtml(r, i) {
    if (r.gruppe) return '<div class="mba-gruppe">' + esc(r.gruppe) + '</div>';
    return '<div class="mba-z">'
      + '<div class="mba-c mba-k">' + esc(r.k) + '</div>'
      + zelle(r.eig, 'Deine Angabe') + zelle(r.abr, 'Abruf im Reiter') + zelle(r.ber, 'Marktbericht')
      + '<div class="mba-c mba-amp" data-t="Abgleich"><span class="mba-pill mba-' + r.a.cls + '">' + esc(r.a.txt) + '</span>'
      + (r.uebernehmen ? '<button type="button" class="mba-btn" data-mba-ueb="' + esc(r.uebernehmen.id) + '" data-mba-wert="' + esc(r.uebernehmen.wert) + '" title="Wert des Berichts ins Feld übernehmen">übernehmen</button>' : '') + '</div>'
      + '<div class="mba-woher"><span class="mba-wl">Woher</span> ' + esc(r.woher || '') + (r.erkl ? '<div class="mba-erkl">' + esc(r.erkl) + '</div>' : '') + '</div>'
      + '</div>';
  }
  function kopf(art) {
    var t = art === 'objekt' ? 'Abgleich mit dem Marktbericht · Lage und Wertparameter' : 'Abgleich mit dem Marktbericht · Miete';
    return '<div class="ct ct-pro"><span class="ct-ico"><svg width="22" height="22"><use href="#i-bar"/></svg></span>' + t + '</div>';
  }
  function knopfStufe3(txt) {
    return '<button type="button" class="btn btn-gold btn-sm mba-stufe3">' + esc(txt || 'Marktbericht Stufe 3 erstellen') + '</button>';
  }
  function inhalt(art) {
    if (!key()) return kopf(art) + '<p class="hint">Objekt speichern oder laden — dann stellt DealPilot die Abrufe dem Marktbericht gegenüber.</p>';
    if (!S.fertig) return kopf(art) + '<p class="hint">Marktbericht und Abrufe werden gelesen …</p>';
    var info = '';
    if (!S.bericht) {
      info = '<div class="mba-hinweis"><b>Noch kein Marktbericht zu diesem Objekt.</b> Die Spalte „Marktbericht“ bleibt leer, bis einer vorliegt. Stufe 3 (Wertermittlung nach ImmoWertV) bringt amtliche Miete, Ø Miete des Zinssatzes, Band der Marktüblichkeit, Bodenwert und Ertrags-/Sachwert. Der Abruf verbraucht ein Kontingent — erst mit dem Klick. '
        + knopfStufe3() + '</div>';
    } else {
      var d = datum(S.zeile && S.zeile.created_at);
      info = '<div class="mba-quelle">Bezug: <b>Marktbericht ' + (S.stufe === 3 ? 'Stufe 3 (Wertermittlung)' : 'Stufe ' + (S.stufe || '?') + ' (Indikation)') + ' vom ' + esc(d) + '</b>'
        + (S.anzahl > 1 ? ' · ' + S.anzahl + ' Berichte im Verlauf, verglichen wird ' + (S.nurIndikation ? 'der neueste' : 'der neueste der Stufe 3') : '')
        + ' · Ampel: <span class="mba-pill mba-ok">gleich</span> bis ± 5 % (Zins ± 0,05 Pp.), <span class="mba-pill mba-ab">weicht ab</span> bis ± 15 % bzw. eine Stufe, <span class="mba-pill mba-stark">weicht ab</span> darüber. Bezug ist der Bericht; verglichen wird deine Angabe, ohne sie der Abruf im Reiter.</div>'
        + (S.nurIndikation ? '<div class="mba-hinweis">Zu diesem Objekt gibt es nur eine Marktpreisindikation (Stufe 1/2) — amtliche Miete, Band und Wertparameter fehlen darin. ' + knopfStufe3() + '</div>' : '');
    }
    var Z = art === 'objekt' ? zeilenObjekt() : zeilenMiete();
    return kopf(art) + info
      + '<div class="mba-tab"><div class="mba-z mba-z-kopf"><div class="mba-c">Kennzahl</div><div class="mba-c">Deine Angabe</div><div class="mba-c">Abruf im Reiter</div><div class="mba-c">Marktbericht</div><div class="mba-c">Abgleich</div></div>'
      + Z.map(zeileHtml).join('') + '</div>' + parameter(art);
  }
  function host(art) {
    var id = art === 'objekt' ? 'mba-objekt' : 'mba-miete';
    var h = $(id); if (h) return h;
    var nach = $(art === 'objekt' ? 'ki-lage-box' : 'ki-miete-box'); if (!nach || !nach.parentNode) return null;
    h = document.createElement('div'); h.id = id; h.className = 'card mba-card'; h.setAttribute('data-mba', art);
    nach.parentNode.insertBefore(h, nach.nextSibling);
    return h;
  }
  function sichtbar(el) { return !!(el && el.offsetParent !== null); }
  var _zt = null;
  function zeichnen() {
    stil();
    ['objekt', 'miete'].forEach(function (art) {
      var h = host(art); if (!h) return;
      try { h.innerHTML = inhalt(art); } catch (e) { h.innerHTML = kopf(art) + '<p class="hint">Abgleich nicht darstellbar: ' + esc(e.message) + '</p>'; try { console.warn('[mb-abgleich]', e); } catch (x) {} }
    });
  }
  function spaeter() { clearTimeout(_zt); _zt = setTimeout(zeichnen, 250); }
  function anstossen() {
    var a = host('objekt'), b = host('miete');
    if (sichtbar(a) || sichtbar(b)) laden(false); else zeichnen();
  }

  /* ── Klicks ────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!t || !t.closest) return;
    var b3 = t.closest('.mba-stufe3');
    if (b3) {
      ev.preventDefault();
      try { if (b3.closest('#mba-miete') && typeof window.switchTab === 'function') window.switchTab(0); } catch (e) {}
      if (window.DealPilotObjektReiter && typeof DealPilotObjektReiter.stufeAbrufen === 'function') {
        try { DealPilotObjektReiter.zielSetzen && DealPilotObjektReiter.zielSetzen(3); } catch (e) {}
        DealPilotObjektReiter.stufeAbrufen(3);
      }
      return;
    }
    var u = t.closest('[data-mba-ueb]');
    if (u) {
      ev.preventDefault();
      var id = u.getAttribute('data-mba-ueb'), w = u.getAttribute('data-mba-wert'), f = $(id);
      if (!f) return;
      f.value = w;
      try { if (window.DpLageHerkunft && DpLageHerkunft.IDS.indexOf(id) >= 0) DpLageHerkunft.setze(id, 'gemessen'); } catch (e) {}
      try { f.dispatchEvent(new Event('change', { bubbles: true })); f.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      try { if (typeof window.dpUpdateAll === 'function') window.dpUpdateAll(); else if (typeof window.renderDealScore2 === 'function') window.renderDealScore2(); } catch (e) {}
      if (typeof window.toast === 'function') toast('✓ Wert aus dem Marktbericht übernommen');
      zeichnen();
    }
  });
  var FELDER = /^(makrolage|mikrolage|ds2_\w+|brw|brw_manuell|brw_stichtag|lzs_pct|sachwertfaktor|svwert|svw_herkunft|nkm|wfl|kp|baujahr|einheiten|gsfl|objart|ausst|standardstufe|plz|ort|str|hnr)$/;
  document.addEventListener('input', function (ev) { if (ev.target && FELDER.test(ev.target.id || '')) spaeter(); }, true);
  document.addEventListener('change', function (ev) { if (ev.target && FELDER.test(ev.target.id || '')) spaeter(); }, true);

  window.addEventListener('dp:object-ready', function () {
    _alt = { m: window._lastLageMessung || null, k: window._lastKiLageData || null };
    S = { key: null, laedt: null, fertig: false, bericht: null, zeile: null, stufe: null, anzahl: 0, nurIndikation: false, lage: null, zensus: null, fehler: null };
    setTimeout(anstossen, 400);
  });
  window.addEventListener('dp:mb-ready', function () { setTimeout(function () { laden(true); }, 1500); });
  window.addEventListener('dp:zins-abruf', spaeter);
  window.addEventListener('dp:ki-miete', spaeter);
  /* Erst laden, wenn einer der beiden Blöcke sichtbar wird (Reiterwechsel) */
  try {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && (!S.fertig || S.key !== key())) laden(false); }); });
    var beob = function () { ['objekt', 'miete'].forEach(function (a) { var h = host(a); if (h && !h._mbaIo) { h._mbaIo = true; io.observe(h); } }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { beob(); zeichnen(); }); else { beob(); zeichnen(); }
  } catch (e) {}

  /* ── Stil: an .card / .ct der Reiter angelehnt, Farben über currentColor,
     damit helle und dunkle Darstellung tragen. Gold nur als Token. ─────── */
  function stil() {
    if ($('mba-stil')) return;
    var s = document.createElement('style'); s.id = 'mba-stil';
    s.textContent = [
      '.mba-card{margin-top:14px}',
      '.mba-quelle,.mba-hinweis{font:400 12px/1.5 Inter,system-ui,sans-serif;margin:0 0 10px}',
      '.mba-hinweis{padding:10px 12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);border-radius:8px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 8%, transparent)}',
      '.mba-hinweis .btn{margin-top:8px;display:inline-flex}',
      '.mba-tab{display:block;font:400 12.5px/1.45 Inter,system-ui,sans-serif}',
      '.mba-z{display:grid;grid-template-columns:minmax(120px,1.05fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.15fr) minmax(118px,auto);gap:4px 12px;padding:8px 0;border-bottom:1px solid color-mix(in srgb, currentColor 12%, transparent);align-items:start}',
      '.mba-z-kopf{font:600 10px/1.3 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;opacity:.65;padding:4px 0}',
      '.mba-k{font-weight:600}',
      '.mba-c b{display:block;font-weight:600;white-space:nowrap}',
      '.mba-h{display:block;font-size:11px;opacity:.68;overflow-wrap:anywhere}',
      '.mba-leer{opacity:.5;font-style:italic}',
      '.mba-woher{grid-column:1/-1;font-size:11.5px;opacity:.82;overflow-wrap:anywhere}',
      '.mba-wl{font:600 9.5px/1 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-right:4px}',
      '.mba-erkl{margin-top:3px;padding-left:8px;border-left:2px solid var(--wl-c9a84c, #C9A84C);opacity:1}',
      '.mba-gruppe{font:600 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--wl-b8932f, #b8932f);padding:12px 0 2px}',
      '.mba-pill{display:inline-block;padding:2px 8px;border-radius:999px;font:600 10px/1.4 "JetBrains Mono",monospace;letter-spacing:.03em;border:1px solid currentColor;white-space:nowrap}',
      '.mba-pill.mba-ok{color:#3FA56C}.mba-pill.mba-stark{color:#B8625C}.mba-pill.mba-ab{color:var(--wl-b8932f, #b8932f)}',
      '.mba-pill.mba-fehlt,.mba-pill.mba-info{opacity:.6}',
      '.mba-btn{display:block;margin-top:5px;background:none;border:1px solid color-mix(in srgb, currentColor 30%, transparent);border-radius:6px;padding:2px 8px;font:500 11px/1.4 Inter,system-ui,sans-serif;color:inherit;cursor:pointer}',
      '.mba-btn:hover{border-color:var(--wl-c9a84c, #C9A84C)}',
      '.mba-param{margin-top:12px;font:400 12px/1.45 Inter,system-ui,sans-serif}',
      '.mba-param summary{cursor:pointer;font-weight:600}',
      '.mba-scroll{overflow-x:auto;margin-top:8px}',
      '.mba-ptab{width:100%;border-collapse:collapse;font-size:12px}',
      '.mba-ptab th{text-align:left;font:600 10px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.65;padding:4px 6px;border-bottom:1px solid color-mix(in srgb, currentColor 18%, transparent)}',
      '.mba-ptab td{padding:5px 6px;border-bottom:1px solid color-mix(in srgb, currentColor 10%, transparent);vertical-align:top}',
      '.mba-p-diff td{font-weight:600}',
      '.mba-abrufe{margin:10px 0 0;padding-left:18px}.mba-abrufe li{margin:0 0 6px}',
      '@media (max-width:760px){',
      '.mba-z{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 10px}',
      '.mba-z-kopf{display:none}',
      '.mba-k{grid-column:1/-1}',
      '.mba-amp{grid-column:1/-1}',
      '.mba-c[data-t]::before{content:attr(data-t);display:block;font:600 9px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.55}',
      '.mba-c b{white-space:normal}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  window.DpMbAbgleich = { VERSION: VERSION, laden: laden, zeichnen: zeichnen, zustand: function () { return S; } };
})();
