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
  var VERSION = 'v3002b';
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
      z.push({ k: 'Entwicklung', ref: true, eig: eig ? { w: wortVon('ds2_entwicklung', eig), h: lageHerkunft('ds2_entwicklung') } : null,
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
        z.push({ k: 'Bodenwert (angesetzt)', ref: true, eig: null, abr: null, ber: { w: eur(zahl(bw.wert)), h: sch }, a: { cls: 'info', txt: 'nur im Bericht' },
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
          : (r && r.berichtsjahr && ass.liegenschaftszins_berichtsjahr && String(r.berichtsjahr) !== String(ass.liegenschaftszins_berichtsjahr))
            ? 'Im Register liegt inzwischen ein neuer Jahrgang (' + r.berichtsjahr + ' statt ' + ass.liegenschaftszins_berichtsjahr + ' im Bericht). Ein neuer Bericht rechnet mit dem neuen Satz.'
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
        /* v3002 · kein Übernehmen-Knopf: das Feld Marktmiete trägt im Deal Score die erzielbare Neuvermietungsmiete (Upside),
           der Anker des Berichts die modellkonforme Bestandsmiete - welche dort hingehört, entscheidet Marcel */
        erkl: erkl });
    })();
    (function () {
      var ber = am && am.verfuegbar ? zahl(am.miete_qm) : null;
      var abr = bel && bel.amtlich && !bel.amtlich.fehlt ? zahl(bel.amtlich.wert_qm) : null;
      var st = am && am.staffel ? am.staffel.map(function (x) { return x.pos + (x.wert != null ? ' ' + String(x.wert).replace('.', ',') : '') + (x.faktor != null ? ' ' + String(x.faktor).replace('.', ',') : ''); }).join(' · ') : '';
      z.push({ k: 'Amtliche Vergleichsmiete', ref: true, eig: null,
        abr: abr != null ? { w: qm(abr), h: 'Beleg der Pilot-Recherche' } : null,
        ber: ber != null ? { w: qm(ber), h: (am.ausschuss || '').replace(/^Der /, '') } : { leer: am ? 'liegt nicht vor' : '—' },
        a: abr != null ? ampelZahl(abr, ber, 1) : (ber != null ? { cls: 'info', txt: 'nur im Bericht' } : { cls: 'fehlt', txt: 'fehlt' }),
        woher: 'amtlich: Mietpreisübersicht des Gutachterausschusses' + (am && am.quelle ? ' — ' + am.quelle : '') + (st ? ' · Rechenweg: ' + st : ''),
        erkl: ber == null ? 'Wo der Ausschuss keine Mietpreisübersicht veröffentlicht, steht der Weg dorthin: qualifizierter Mietspiegel der Gemeinde oder Grundstücksmarktbericht des Ausschusses — dort nachsehen und als Marktmiete eintragen.' : '' });
    })();
    (function () {
      var ber = band ? zahl(band.satz_qm) : null;
      var lz = (cc.assumptions || {});
      z.push({ k: 'Ø Miete des Liegenschaftszinssatzes', ref: true, eig: null, abr: null,
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
      z.push({ k: 'Angebotsmiete', ref: true, eig: null,
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
      z.push({ k: 'Im Ertragswert angesetzt', ref: true, eig: istF != null ? { w: qm(istF), h: 'deine Ist-Miete' } : null, abr: null,
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

  /* ── Zeichnen (v3002b) ─────────────────────────────────────────────
     Marcel 27.10.2026 zur ersten Fassung: „riesig, sehr viel Text,
     unübersichtlich, keine Ahnung, warum das da drin ist" — und als
     Leitfrage: „Liest das jemand? Braucht der Kunde es nicht, zeigen wir
     es nicht. Braucht er es, dann so, dass er es versteht."

     Deshalb zeigt der Block nur noch HINWEISE: eine echte Abweichung mit
     Folge, je ein Satz in Kundensprache. Passt alles, steht eine Zeile
     „passt zum Marktbericht". Ohne Bericht eine Zeile mit Knopf.
     Die vollständige Gegenüberstellung (zeilenObjekt/zeilenMiete) bleibt
     als Hintergrund im Modul (DpMbAbgleich.zeilen) — der Pilot und das PDF
     lesen dieselben Berichtswerte ohnehin über /objects/history. */
  function merkerKey(art) {
    var u = ''; try { var U = window.Auth && Auth.getUser ? Auth.getUser() : null; u = (U && (U.id || U.email)) || ''; } catch (e) {}
    return 'dp_mba_offen_' + art + '_' + u;
  }
  function istOffen(art) { try { return localStorage.getItem(merkerKey(art)) === '1'; } catch (e) { return false; } }
  function setzeOffen(art, an) { try { localStorage.setItem(merkerKey(art), an ? '1' : '0'); } catch (e) {} }
  function pct(a, b) { return Math.round(Math.abs(a / b - 1) * 100); }

  /* Geänderte Eingaben seit dem Bericht: der Bericht rechnet mit dem alten Stand */
  function paramHinweise(liste) {
    var ref = (S.bericht || {}).ref || {}, H = [];
    var mp = null; try { mp = window.DealPilotObjektReiter && DealPilotObjektReiter.modPunkte ? DealPilotObjektReiter.modPunkte() : null; } catch (e) {}
    var P = {
      wfl: ['Deine Wohnfläche', zahl(fv('wfl')), zahl(ref.living_area), ' m²', 0],
      baujahr: ['Dein Baujahr', zahl(fv('baujahr')), zahl(ref.build_year), '', 0],
      gsfl: ['Deine Grundstücksfläche', zahl(fv('gsfl')), zahl(ref.plot_area), ' m²', 0],
      einheiten: ['Die Zahl der Einheiten', zahl(fv('einheiten')), zahl(ref.units), '', 0],
      mod: ['Deine Modernisierungspunkte', mp ? mp.total : null, zahl(ref.mod_punkte), ' Punkten', 0],
      nkm: ['Deine Nettokaltmiete', zahl(fv('nkm')), zahl(ref.monthly_net_rent), ' € im Monat', 0]
    };
    liste.forEach(function (k) {
      var p = P[k]; if (!p || p[1] == null || p[2] == null) return;
      if (Math.abs(p[1] - p[2]) < 0.5) return;
      H.push({ satz: p[0] + ' hat sich seit dem Bericht geändert — der Bericht rechnet noch mit ' + (k === 'baujahr' ? p[2] : fmt(p[2], 0)) + p[3] + '. Ein neuer Bericht bringt die Werte auf den aktuellen Stand.', stufe3: true });
    });
    return H;
  }
  function stufenAbstand(id, a, b) { var sk = SKALEN[id] || [], i = sk.indexOf(norm(a)), j = sk.indexOf(norm(b)); return (i < 0 || j < 0) ? 0 : i - j; }

  function hinweiseObjekt() {
    var B = S.bericht || {}, cc = B.cross_check || {}, ass = cc.assumptions || {}, H = paramHinweise(['wfl', 'baujahr', 'gsfl', 'einheiten', 'mod']);
    var st = B.assessment_stufen || {};
    /* Lage: nur eine deutliche Abweichung (ab zwei Stufen) der EIGENEN Angabe — sie wirkt auf den Deal Score */
    [['makrolage', 'makrolage', 'Makrolage'], ['mikrolage', 'mikrolage', 'Mikrolage'], ['ds2_bevoelkerung', 'bevoelkerung', 'Bevölkerungsentwicklung'],
     ['ds2_nachfrage', 'nachfrage', 'Nachfrage'], ['ds2_wertsteigerung', 'wertsteigerung', 'Wertsteigerung']].forEach(function (x) {
      var eig = fv(x[0]), b = st[x[1]];
      if (!eig || !b || !b.stufe || lageHerkunft(x[0]) !== 'eigene Angabe') return;
      var d = stufenAbstand(x[0], eig, b.stufe); if (Math.abs(d) < 2) return;
      H.push({ satz: 'Deine Einschätzung der ' + x[2] + ' („' + wortVon(x[0], eig) + '") liegt deutlich ' + (d > 0 ? 'unter' : 'über') + ' der Messung im Bericht („' + (b.wort || wortVon(x[0], b.stufe)) + '") — das ' + (d > 0 ? 'senkt' : 'hebt') + ' deinen Deal Score; bitte prüfen.',
        ueb: { id: x[0], wert: norm(b.stufe), text: 'Messung übernehmen' } });
    });
    /* Bodenrichtwert */
    var lv = B.land_value || {}, bBrw = lv.available ? zahl(lv.value_sqm) : null, eBrw = zahl(fv('brw_manuell')) != null ? zahl(fv('brw_manuell')) : zahl(fv('brw'));
    if (bBrw && eBrw && pct(eBrw, bBrw) >= 5) H.push({ satz: 'Dein Bodenrichtwert (' + qm(eBrw) + ') weicht vom amtlichen Wert im Bericht ab (' + qm(bBrw) + (lv.stichtag ? ', Stand ' + datum(lv.stichtag) : '') + ') — bitte Stand und Lage prüfen.' });
    /* Liegenschaftszins: neuer Jahrgang oder eigener Ansatz */
    var r = zinsAbruf(), bZ = zahl(ass.liegenschaftszins_pct_effektiv), eZ = zahl(fv('lzs_pct'));
    if (eZ != null && bZ != null && Math.abs(eZ - bZ) >= 0.25) H.push({ satz: 'Dein eigener Liegenschaftszins (' + fmt(eZ, 2) + ' %) weicht vom Satz des Gutachterausschusses ab (' + fmt(bZ, 2) + ' %) — er verändert den Ertragswert spürbar.' });
    else if (eZ == null && r && r.verfuegbar && bZ != null && r.berichtsjahr && ass.liegenschaftszins_berichtsjahr && String(r.berichtsjahr) !== String(ass.liegenschaftszins_berichtsjahr) && Math.abs(zahl(r.wert_pct) - bZ) >= 0.05)
      H.push({ satz: 'Der Gutachterausschuss hat einen neuen Liegenschaftszins veröffentlicht (' + fmt(zahl(r.wert_pct), 2) + ' % statt ' + fmt(bZ, 2) + ' %) — ein neuer Bericht rechnet damit.', stufe3: true });
    /* Verkehrswert */
    var vf = cc.verfahrenswahl || {}, fu = String(vf.verfahren || ''), W = { ertragswert: zahl((cc.ertragswert || {}).value_eur), sachwert: zahl((cc.sachwert || {}).value_eur), vergleichswert: zahl((cc.comparison || {}).vergleichswert_eur) };
    var bW = W[fu], eW = zahl(fv('svwert'));
    var name = { ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert' }[fu];
    if (bW && eW && pct(eW, bW) >= 10) H.push({ satz: 'Dein Markt-/Verkehrswert liegt ' + pct(eW, bW) + ' % ' + (eW > bW ? 'über' : 'unter') + ' dem ' + name + ' des Berichts (' + eur(bW) + ') — Finanzierung und Wertpuffer rechnen mit deinem Wert.' });
    return H;
  }

  function hinweiseMiete() {
    var B = S.bericht || {}, cc = B.cross_check || {}, ew = cc.ertragswert || {}, H = paramHinweise(['nkm', 'wfl']);
    var band = ew.miete_band || cc.miete_band || null, ms = ew.miete_stufe || null;
    var wfl = zahl(fv('wfl')), nkm = zahl(fv('nkm')), ist = (wfl && nkm) ? nkm / wfl : null;
    var anker = ms ? zahl(ms.qm) : (band ? zahl(band.anker_qm) : null);
    var quelle = (ms && ms.code === 'amtlich') ? 'des Gutachterausschusses' : (ms && ms.code === 'zensus') ? 'laut Zensus' : 'im Bericht';
    if (ist != null && anker) {
      var oben = band ? zahl(band.oben_qm) : null, unten = band ? zahl(band.unten_qm) : null;
      if (unten != null && ist < unten) H.push({ satz: 'Deine Ist-Miete (' + qm(ist) + ') liegt ' + pct(ist, anker) + ' % unter der marktüblichen Miete ' + quelle + ' (' + qm(anker) + ') — Mieterhöhung prüfen.' });
      else if (oben != null && ist > oben) H.push({ satz: 'Deine Ist-Miete (' + qm(ist) + ') liegt über dem, was der Bericht als marktüblich ansieht (bis ' + qm(oben) + ') — bei einem Mieterwechsel ist diese Miete womöglich nicht wieder zu erzielen.' });
    }
    var mm = zahl(fv('ds2_marktmiete'));
    if (mm && anker && pct(mm, anker) >= 15) H.push({ satz: 'Deine Marktmiete (' + qm(mm) + ') liegt ' + pct(mm, anker) + ' % ' + (mm > anker ? 'über' : 'unter') + ' der marktüblichen Miete ' + quelle + ' (' + qm(anker) + ')' + (mm > anker ? ' — Angebotsmieten liegen meist über dem, was im Bestand gezahlt wird, und dein Deal Score rechnet damit ein höheres Mietpotenzial.' : '.') });
    var st = (B.assessment_stufen || {}).mietausfallrisiko, ea = fv('ds2_mietausfall');
    if (st && st.stufe && ea && lageHerkunft('ds2_mietausfall') === 'eigene Angabe') {
      var d = stufenAbstand('ds2_mietausfall', ea, st.stufe);
      if (Math.abs(d) >= 2) H.push({ satz: 'Dein Mietausfallrisiko („' + wortVon('ds2_mietausfall', ea) + '") weicht deutlich vom gemessenen Leerstand ab („' + (st.wort || st.stufe) + '", ' + String(st.wert).replace('.', ',') + ' % laut Zensus 2022) — bitte prüfen.',
        ueb: { id: 'ds2_mietausfall', wert: norm(st.stufe), text: 'Messung übernehmen' } });
    }
    return H;
  }

  function knopfStufe3(txt) {
    return '<button type="button" class="btn btn-gold btn-sm mba-stufe3">' + esc(txt || 'Marktbericht erstellen') + '</button>';
  }
  function inhalt(art) {
    if (!key()) return '';
    if (!S.fertig) return '<div class="mba-zeile mba-leise">Abgleich mit dem Marktbericht wird gelesen …</div>';
    if (!S.bericht || S.nurIndikation) {
      return '<div class="mba-zeile"><span>' + (S.bericht ? 'Bisher nur eine Marktpreisindikation — für den Abgleich mit amtlichen Werten fehlt ein Marktbericht Stufe 3.' : 'Noch kein Marktbericht zu diesem Objekt — mit ihm prüft DealPilot deine Angaben gegen amtliche Werte.')
        + '</span>' + knopfStufe3(S.bericht ? 'Marktbericht Stufe 3 erstellen' : 'Marktbericht erstellen') + '</div>';
    }
    var d = datum(S.zeile && S.zeile.created_at);
    var H = art === 'objekt' ? hinweiseObjekt() : hinweiseMiete();
    if (!H.length) return '<div class="mba-zeile mba-passt"><span class="mba-ok">✓</span> Passt zum Marktbericht vom ' + esc(d) + '.</div>';
    var offen = istOffen(art);
    var o = '<button type="button" class="mba-kopf" data-mba-auf="' + art + '" aria-expanded="' + offen + '">'
      + '<span class="mba-dot"></span><span class="mba-titel">' + H.length + (H.length === 1 ? ' Hinweis' : ' Hinweise') + ' aus dem Marktbericht vom ' + esc(d) + '</span>'
      + '<span class="mba-chev" aria-hidden="true">' + (offen ? '▾' : '▸') + '</span></button>';
    if (!offen) return o;
    var neu = H.some(function (h) { return h.stufe3; });
    return o + '<ul class="mba-liste">' + H.map(function (h) {
      return '<li>' + esc(h.satz) + (h.ueb ? ' <button type="button" class="btn btn-outline btn-sm mba-btn" data-mba-ueb="' + esc(h.ueb.id) + '" data-mba-wert="' + esc(h.ueb.wert) + '">' + esc(h.ueb.text) + '</button>' : '') + '</li>';
    }).join('') + '</ul>' + (neu ? '<div class="mba-fuss">' + knopfStufe3('Neuen Marktbericht erstellen') + '</div>' : '');
  }
  function host(art) {
    var id = art === 'objekt' ? 'mba-objekt' : 'mba-miete';
    var h = $(id); if (h) return h;
    var nach = $(art === 'objekt' ? 'ki-lage-box' : 'ki-miete-box'); if (!nach || !nach.parentNode) return null;
    h = document.createElement('div'); h.id = id; h.className = 'mba-card'; h.setAttribute('data-mba', art);
    nach.parentNode.insertBefore(h, nach.nextSibling);
    return h;
  }
  function sichtbar(el) { return !!(el && el.offsetParent !== null); }
  var _zt = null;
  function zeichnen() {
    stil();
    ['objekt', 'miete'].forEach(function (art) {
      var h = host(art); if (!h) return;
      var html = '';
      try { html = inhalt(art); } catch (e) { html = ''; try { console.warn('[mb-abgleich]', e); } catch (x) {} }
      h.innerHTML = html; h.style.display = html ? '' : 'none';
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
    var auf = t.closest('[data-mba-auf]');
    if (auf) { ev.preventDefault(); var art = auf.getAttribute('data-mba-auf'); setzeOffen(art, !istOffen(art)); zeichnen(); return; }
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
      '.mba-card{margin-top:10px;font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '.mba-zeile{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 12px;border:1px solid color-mix(in srgb, currentColor 14%, transparent);border-radius:8px}',
      '.mba-zeile>span{flex:1 1 220px;min-width:0}',
      '.mba-leise{opacity:.6}',
      '.mba-passt .mba-ok{color:#3FA56C;font-weight:700;flex:0 0 auto}',
      '.mba-kopf{display:flex;width:100%;align-items:center;gap:8px;padding:8px 12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent);border-radius:8px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 8%, transparent);color:inherit;font:600 12.5px/1.4 Inter,system-ui,sans-serif;text-align:left;cursor:pointer}',
      '.mba-kopf .mba-titel{flex:1 1 auto;min-width:0}',
      '.mba-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--wl-c9a84c, #C9A84C)}',
      '.mba-chev{flex:0 0 auto;opacity:.7}',
      '.mba-liste{margin:6px 0 0;padding:0 0 0 18px}',
      '.mba-liste li{margin:0 0 8px}',
      '.mba-liste .mba-btn{margin-left:6px;vertical-align:middle}',
      '.mba-fuss{margin-top:4px}'
    ].join('');
    document.head.appendChild(s);
  }

  window.DpMbAbgleich = { VERSION: VERSION, laden: laden, zeichnen: zeichnen, zustand: function () { return S; },
    /* Hintergrund: die volle Gegenüberstellung je Kennzahl, nicht angezeigt (v3002b) */
    zeilen: function () { return { objekt: zeilenObjekt(), miete: zeilenMiete() }; },
    hinweise: function () { return { objekt: hinweiseObjekt(), miete: hinweiseMiete() }; } };
})();
