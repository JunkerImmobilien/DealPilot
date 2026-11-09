'use strict';
/* ════════════════════════════════════════════════════════════════════
   mietpotenzial-kern.js · v3075 / v3244 / v3246 — DIE ZULÄSSIGE MIETE, OHNE DOM
   ════════════════════════════════════════════════════════════════════
   Marcel 02.11.2026 (P1.1–P1.3, „setz das alles um"): der Quick-Check soll
   die rechtlich zulässige Miete nach drei Jahren zeigen — Kappungsgrenze,
   Vergleichsmiete, Sperrfrist — und darauf einen zweistufigen Zielkaufpreis.

   Die Regeln standen bis v3074 nur in js/potenzial.js (kappung(), mhTermine(),
   sollFuer(), vertragGrenzen(), umlage559()). Die Datei liest DOM, fetch und
   window._dpMfh und ist im Quick-Check-iframe nicht geladen. Statt einer
   zweiten Rechnung im iframe liegen die reinen Teile JETZT HIER, und
   potenzial.js ruft sie auf — EINE Rechnung für Objekt und Quick-Check
   (Benchmark design/Vorschläge/score-benchmark-p1.md, Abschnitt 4 Nr. 2).

   KEIN DOM, KEIN fetch, KEIN localStorage, KEINE Einstellung. Was die Rechnung
   braucht, kommt als Parameter: die Liste der Landesverordnungen (Daten aus
   js/data/kappungsgrenzen.json, geladen vom AUFRUFER), das heutige Datum, die
   Maßnahmenliste. Ohne `heute` gilt die Uhr - wie bisher in potenzial.js.

   Angebotsmiete und zulässige Bestandsmiete sind ZWEI Zahlen und werden nie
   gleichgesetzt: zulaessig() kennt nur Ist, Vergleichsmiete und Kappung;
   neuvermietung() rechnet die Marktmiete getrennt, gedeckelt durch die
   Mietpreisbremse, wo sie gilt.

   Prüfer: tools/mietpotenzial-pruefen.mjs, tools/mieterhoehung-termine-pruefen.mjs.
   ════════════════════════════════════════════════════════════════════ */
(function (g) {
  if (g.DpMietpotenzial) return;

  var PRAEFIX = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
                  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };

  /* dieselbe Lesart wie potenzial.js bis v3074 (parseDe, wo es ihn gibt) */
  function zahl(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim(); if (!s) return 0;
    var n = (typeof g.parseDe === 'function') ? g.parseDe(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function heuteYm() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function heuteIso() { return new Date().toISOString().slice(0, 10); }
  function deDatum(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('.') : ''; }
  function plusMonate(iso, n) {
    var m = /^(\d{4})-(\d{2})/.exec(iso || ''); if (!m) return null;
    var j = +m[1], mo = +m[2] - 1 + n; j += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    return j + '-' + String(mo + 1).padStart(2, '0');
  }
  function mmjj(ym) { return /^\d{4}-\d{2}/.test(ym || '') ? ym.slice(5, 7) + '/' + ym.slice(0, 4) : ''; }
  function eur2(n) { return (n == null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

  /* ── Gemeinde in der Liste der Landesverordnungen ────────────────────
     Vorrang hat die AGS (Objekt, über den Marktbericht-Dienst). Der Quick-Check
     kennt keine AGS - er sucht über Land (aus der PLZ) und Ortsnamen; das steht
     im Ergebnis (`zuordnung: 'ortsname'`), damit es im Text gesagt wird. */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  /* v3083 · der Ortsname ohne Lage-Zusatz (im/i/am/a/an/ob/bei/in/vor/v d … und Klammern sind in norm() schon weg) */
  function stamm(n) {
    var w = String(n || '').split(' '), out = [];
    for (var i = 0; i < w.length; i++) { if (i > 0 && /^(im|i|am|a|an|ob|bei|in|vor|v|d|der|dem|den|o|ostfriesland|westf|westfalen|oldb|oldenburg|schwarzwald|wald|harz|thueringen|holstein|hessen|pfalz|breisgau|br|main|m|oder|saale|lahn|neckar|rhein|donau|elbe|weser|ruhr|sieg|mosel|nahe|kreis|stadt|st)$/.test(w[i])) break; out.push(w[i]); }
    return out.join(' ');
  }
  function gemeindeFinden(daten, ort) {
    ort = ort || {};
    var a = String(ort.ags || '').replace(/\D/g, '');
    var out = { land: null, L: null, g: null, zuordnung: null, fehlt: null };
    if (!daten || !daten.laender) { out.fehlt = 'liste'; return out; }
    if (a.length === 8) {
      out.land = PRAEFIX[a.slice(0, 2)] || null; out.L = out.land ? daten.laender[out.land] : null;
      if (!out.L) { out.fehlt = 'land'; return out; }
      out.g = (Array.isArray(out.L.gemeinden) ? out.L.gemeinden : []).filter(function (x) { return x && x.ags === a; })[0] || null;
      out.zuordnung = 'ags';
      return out;
    }
    var land = String(ort.land || '').toUpperCase(), name = norm(ort.ort);
    if (!land || !name) { out.fehlt = 'gemeinde'; return out; }
    out.land = land; out.L = daten.laender[land] || null;
    if (!out.L) { out.fehlt = 'land'; return out; }
    var liste = Array.isArray(out.L.gemeinden) ? out.L.gemeinden : [];
    var gleich = liste.filter(function (x) { return x && norm(x.name) === name; });
    if (!gleich.length) gleich = liste.filter(function (x) { return x && norm(x.name).indexOf(name + ' ') === 0; });
    /* v3083 · Namensstamm: „Freiburg im Breisgau“ gegen „Freiburg i. Br.“, „Frankfurt am Main“ gegen
       „Frankfurt a.M.“, „Halle“ gegen „Halle (Saale)“. Gemessen 02.11.2026: 59 von 821 Gemeinden der
       Verordnungen tragen einen Zusatz; Freiburg fiel über den Ortsnamen auf „20 %, keine Bremse“. Nur
       eindeutig je Land, sonst mehrdeutig (bitte prüfen). */
    if (!gleich.length) { var st = stamm(name); if (st) gleich = liste.filter(function (x) { return x && stamm(norm(x.name)) === st; }); }
    out.g = gleich.length === 1 ? gleich[0] : null;
    out.mehrdeutig = gleich.length > 1;
    out.zuordnung = 'ortsname';
    return out;
  }
  function voKurz(voll) {
    voll = String(voll || ''); var kl = /\(([^)]+)\)/.exec(voll);
    if (kl && /^\s*(§|\d)/.test(kl[1])) kl = null;   /* v3084b: „(§ 1)“ ist kein Kurzname (NI Mietpreisbremse) */
    return kl ? kl[1].split(/\s[–—-]\s/)[0] : voll.split(' vom ')[0];
  }

  /* ── Kappungsgrenze (§ 558 Abs. 3 BGB) ──────────────────────────────
     Bis v3074 potenzial.js kappung(ags); Texte wörtlich übernommen.
     opt: { eigen_pct: 15|20, heute: 'JJJJ-MM-TT' } */
  function kappungAus(daten, ort, opt) {
    opt = opt || {};
    var eigen = zahl(opt.eigen_pct);
    if (eigen === 15 || eigen === 20) return { pct: eigen, herkunft: 'eigen', pruefen: false, text: 'Kappungsgrenze ' + eigen + ' % in 3 Jahren (eigene Angabe).' };
    var std = function (warum) {
      return { pct: 20, herkunft: 'auffang', pruefen: true,
        text: 'Kappungsgrenze 20 % in 3 Jahren (§ 558 Abs. 3 BGB) — ' + warum + ', bitte prüfen.' };
    };
    var f = gemeindeFinden(daten, ort);
    if (f.fehlt === 'liste') return std('die Liste der Landesverordnungen liegt nicht vor');
    if (f.fehlt === 'gemeinde') return std('Gemeinde noch nicht ermittelt');
    if (f.fehlt === 'land') return std('Land nicht in der Liste');
    var L = f.L, g2 = f.g;
    var heute = /^\d{4}-\d{2}-\d{2}$/.test(opt.heute || '') ? opt.heute : heuteIso();
    var std2 = Number(daten.standard_kappung_pct) || 20;
    var vo = voKurz(L.verordnung);
    var pruef = L.unsicher ? ' — Landesliste unsicher, bitte prüfen.' : '.';
    var perName = f.zuordnung === 'ortsname' ? ' (Zuordnung über den Ortsnamen)' : '';
    /* `zuordnung` nur beim Ortsnamen - per AGS bleibt das Ergebnis Byte fuer Byte wie bis v3074 */
    var mit = function (r) { if (f.zuordnung === 'ortsname') r.zuordnung = 'ortsname'; return r; };
    /* Die Liste vereinigt Kappung und Mietpreisbremse: ein Eintrag mit
       kappung15 = false ist KEINE 15-%-Gemeinde. */
    if (g2 && g2.kappung15) {
      var bis = g2.kappung_gueltig_bis || L.gueltig_bis || null;
      if (bis && bis < heute) {
        return mit({ pct: std2, herkunft: 'ausgelaufen', pruefen: true, url: L.url || null,
          text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren: die Verordnung (' + vo + ') ist am ' + deDatum(bis) + ' ausgelaufen, bitte prüfen.' });
      }
      return mit({ pct: 15, herkunft: 'verordnung', pruefen: !!L.unsicher, url: L.url || null, verordnung: vo,
        text: 'Kappungsgrenze 15 % in 3 Jahren: ' + (g2.name || 'die Gemeinde') + ' steht in der ' + vo
          + (L.fundstelle ? ' (' + L.fundstelle + (bis ? ', gültig bis ' + deDatum(bis) : '') + ')' : '') + perName + pruef });
    }
    if (f.mehrdeutig) {
      return mit({ pct: std2, herkunft: 'gesetz', pruefen: true,
        text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren: der Ortsname passt auf mehrere Gemeinden der Landesverordnung — bitte prüfen oder eigene Angabe.' });
    }
    /* v3081 · Marcel 02.11.2026: „warum, und keine Quelle“. Die 20 % setzt nicht DealPilot,
       sondern das Gesetz (§ 558 Abs. 3 Satz 1 BGB) - die Verordnung, in der die Gemeinde
       NICHT steht, wird mit Link genannt. */
    return mit({ pct: std2, herkunft: 'gesetz', pruefen: !!L.unsicher, url: L.url || null, verordnung: vo,
      text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren (gesetzliche Grenze, § 558 Abs. 3 Satz 1 BGB): die Gemeinde steht nicht in der ' + vo + perName
        + (L.unsicher ? ' — Landesliste unsicher, bitte prüfen.' : '. Eigene Angabe möglich.') });
  }

  /* ── Mietpreisbremse (§ 556d Abs. 1 BGB) ────────────────────────────
     Bis v3074 potenzial.js mietpreisbremse(ags); Texte wörtlich übernommen. */
  function mietpreisbremseAus(daten, ort, opt) {
    opt = opt || {};
    var leer = function (warum) { return { gilt: null, pruefen: true, text: 'Mietpreisbremse: ' + warum + ', bitte prüfen.' }; };
    var f = gemeindeFinden(daten, ort);
    if (f.fehlt === 'liste') return leer('die Liste der Landesverordnungen liegt nicht vor');
    if (f.fehlt === 'gemeinde') return leer('Gemeinde noch nicht ermittelt');
    if (f.fehlt === 'land') return leer('Land nicht in der Liste');
    var L = f.L, g2 = f.g;
    var heute = /^\d{4}-\d{2}-\d{2}$/.test(opt.heute || '') ? opt.heute : heuteIso();
    var V = L.mietpreisbremse_verordnung || {};
    var vo = voKurz(V.verordnung || L.verordnung);
    if (g2 && g2.mietpreisbremse) {
      var bis = g2.mietpreisbremse_gueltig_bis || V.gueltig_bis || L.gueltig_bis || null;
      if (bis && bis < heute) return { gilt: null, pruefen: true, bis: bis, herkunft: 'ausgelaufen',
        text: 'Mietpreisbremse: die Verordnung (' + vo + ') ist am ' + deDatum(bis) + ' ausgelaufen, bitte prüfen.' };
      return { gilt: true, pruefen: !!L.unsicher, bis: bis, verordnung: vo, url: V.url || L.url || null, name: g2.name || '',
        text: 'Mietpreisbremse gilt' + (bis ? ' bis ' + deDatum(bis) : '') + ' (' + vo + ')' + (L.unsicher ? ' — Landesliste unsicher, bitte prüfen.' : '.') };
    }
    if (f.mehrdeutig) return leer('der Ortsname passt auf mehrere Gemeinden der Landesverordnung');
    return { gilt: false, pruefen: !!L.unsicher, url: V.url || L.url || null, verordnung: vo,   /* v3081: Quelle mitgeben */
      text: 'Keine Mietpreisbremse: die Gemeinde steht nicht in der ' + vo + (L.unsicher ? ' — Landesliste unsicher, bitte prüfen.' : '.') };
  }

  /* ── v3028 · TERMINE EINER MIETERHÖHUNG: verlangbar ab · wirksam ab ────
     Wörtlich aus potenzial.js (dort steht die Herleitung mit Gesetzeswortlaut).
       § 558 Abs. 1 S. 2 · § 558b Abs. 1 · § 559b Abs. 2 · § 557b Abs. 3 BGB */
  var TERMIN_REGEL = {
    '558':  { plus: 3, warte: 12, norm: '§ 558b Abs. 1 BGB', warte_norm: '§ 558 Abs. 1 Satz 2 BGB' },
    '559':  { plus: 3, warte: 0,  norm: '§ 559b Abs. 2 BGB', warte_norm: null },
    '557b': { plus: 2, warte: 10, norm: '§ 557b Abs. 3 BGB', warte_norm: '§ 557b Abs. 2 BGB' }
  };
  /** Erster Tag, ab dem die Erhöhung geschuldet ist, bei Zugang am Tag `zugang` ('JJJJ-MM-TT'). */
  function wirksamNachZugang(zugang, art) {
    var R = TERMIN_REGEL[art] || TERMIN_REGEL['558'];
    var ym = plusMonate(String(zugang || ''), R.plus);
    return ym ? ym + '-01' : null;
  }
  function mhTermine(o) {
    o = o || {};
    var art = TERMIN_REGEL[o.art] ? o.art : '558', R = TERMIN_REGEL[art];
    var heute = /^\d{4}-\d{2}/.test(o.heute || '') ? String(o.heute).slice(0, 7) : heuteYm();
    var letzte = /^\d{4}-\d{2}/.test(o.letzte || '') ? String(o.letzte).slice(0, 7) : null;
    var frueh = letzte && R.warte ? plusMonate(letzte, R.warte) : heute;
    var verl = frueh > heute ? frueh : heute;
    var sofort = verl <= heute;
    var wirk = plusMonate(verl, R.plus);
    var eigen = /^\d{4}-\d{2}/.test(o.wirksam_eigen || '') ? String(o.wirksam_eigen).slice(0, 7) : null;
    var hinweis = null;
    if (eigen) {
      if (eigen < heute) eigen = heute;
      if (eigen < wirk) hinweis = 'dein Termin ' + mmjj(eigen) + ' liegt vor dem frühesten Wirksamwerden (' + mmjj(wirk) + ', ' + R.norm + ') – er gilt nur, wenn das Schreiben schon zugegangen ist';
      wirk = eigen;
    }
    var r = { art: art, verlangbar_ab: verl, verlangbar_sofort: sofort, wirksam_ab: wirk, norm: R.norm,
      zugang_angenommen: sofort && !eigen, letzte_fehlt: !letzte && !!R.warte, eigene_angabe: !!eigen, hinweis: hinweis };
    r.text = 'verlangbar ab ' + (sofort ? 'sofort' : mmjj(verl)) + ' · wirksam ab ' + mmjj(wirk);
    r.grund = eigen ? 'eigene Angabe' : (sofort ? 'Zugang heute angenommen, ' : 'bei Zugang im ' + mmjj(verl) + ', ') + R.norm;
    r.sperre = r.letzte_fehlt ? 'letzte Erhöhung nicht eingetragen, Sperrfrist (' + R.warte_norm + ') nicht geprüft' : null;
    r.text_lang = r.text + ' (' + r.grund + ')' + (r.sperre ? ' – ' + r.sperre : '');
    return r;
  }
  function umlage559(liste, istM, wfl) {
    /* v3001 · § 559 Abs. 2 BGB: Erhaltungsanteil (`erh`, %) nicht umlagefähig; Renovierung nie.
       v3064 · ohne eingetragenen Erhaltungsanteil 0 % abgezogen - gezählt, damit es gesagt wird. */
    var k = (liste || []).filter(function (m) { return m.bewohnt && m.id !== 'renovierung'; }).reduce(function (a, m) {
      var e = Math.min(100, Math.max(0, zahl(m.erh))); return a + zahl(m.k) * (1 - e / 100); }, 0);
    if (!(k > 0) || !(wfl > 0)) return { monat: 0, kosten: 0 };
    var roh = k * 0.08 / 12;
    var kappeQm = (istM > 0 && istM / wfl < 7) ? 2 : 3;
    var deckel = kappeQm * wfl;
    var ohneErh = (liste || []).filter(function (m) { return m.bewohnt && m.id !== 'renovierung' && (m.erh == null || String(m.erh).trim() === ''); }).length;
    return { monat: Math.min(roh, deckel), kosten: k, gedeckelt: roh > deckel, kappe_qm: kappeQm, ohne_erh: ohneErh };
  }
  /* v3016t · Staffel- und Indexmiete, Gewerbe: §§ 558/559 nicht anwendbar (Herleitung in potenzial.js). */
  function vertragGrenzen(e) {
    var art = String((e && e.mv_art) || '').toLowerCase();
    if (art === 'staffel') return { art: art, s558: false, s559: false, text: 'Staffelmiete: Erhöhungen nach §§ 558 bis 559b BGB sind während der Staffel ausgeschlossen (§ 557a Abs. 2 BGB) – die Miete steigt nur nach den vereinbarten Staffeln. Die nächste Staffel trägst du als Soll-Miete ein.' };
    if (art === 'index') return { art: art, s558: false, s559: false, text: 'Indexmiete: keine Erhöhung bis zur Vergleichsmiete (§ 557b Abs. 2 BGB); eine Modernisierungsumlage nur für Maßnahmen, die der Vermieter nicht zu vertreten hat (z. B. gesetzliche Pflicht) – deshalb hier nicht eingerechnet. Die Indexanpassung trägst du als Soll-Miete ein.' };
    if (art === 'gewerbe' || (e && e.art === 'gewerbe')) return { art: 'gewerbe', s558: false, s559: false, text: 'Gewerbemiete: §§ 558 und 559 BGB gelten nur für Wohnraum – Erhöhungen richten sich nach dem Vertrag. Eine vereinbarte Anpassung trägst du als Soll-Miete ein.' };
    return { art: art, s558: true, s559: true, text: '' };
  }

  /**
   * Soll-Miete einer Wohnung (€/Monat) samt Herkunft — die nächste Erhöhung.
   * e:   { ist, wfl, status, soll, soll_ab, vgl_qm, mv_art, mv_letzte_erhoehung, mv_letzte_erhoehung_betrag, massnahmen }
   * ctx: { kapp: {pct,text}, vgl_qm, vgl_herkunft, heute: 'JJJJ-MM', massnahmenVon: function(e) -> [] }
   * Wörtlich aus potenzial.js sollFuer() (bis v3074); neu sind nur ctx.heute und
   * ctx.massnahmenVon (potenzial.js gibt seine Katalog-Auflösung herein).
   */
  function sollFuer(e, ctx) {
    ctx = ctx || {};
    var mVon = typeof ctx.massnahmenVon === 'function' ? ctx.massnahmenVon
      : function (x) { return x && Array.isArray(x.massnahmen) ? x.massnahmen : []; };
    var heuteM = /^\d{4}-\d{2}/.test(ctx.heute || '') ? String(ctx.heute).slice(0, 7) : null;
    var ist = zahl(e.ist), wfl = zahl(e.wfl);
    var r = { miete: null, herkunft: null, grenze: null, ab: null, ab_text: '', hinweise: [] };
    if (e.status === 'leer' || !(ist > 0)) { r.grund = 'leer'; return r; }
    var vg = vertragGrenzen(e);
    var u = vg.s559 ? umlage559(mVon(e), ist, wfl) : { monat: 0, kosten: 0 };
    if (!vg.s559 && mVon(e).some(function (m) { return m.bewohnt; })) r.hinweise.push('Umlage nicht eingerechnet – ' + vg.text);
    if (!vg.s558) {
      var eig = zahl(e.soll);
      /* v3244 · die eigene Soll-Angabe ist hier die VERTRAGLICHE Erhöhung (Staffel, Index, Gewerbe),
         keine nach § 558 BGB. miete bleibt die Gesamt-Soll-Miete (Zielbild, Summen); der § 558-Anteil
         ist Ist. teil558() und teilVertrag() trennen beides an EINER Stelle für alle Aufrufer. */
      if (eig > 0) { r.miete = eig; r.herkunft = 'eigene Angabe (' + (VERTRAG_NORM[vg.art] || 'Vertrag') + ')'; r.vertrag = vg.art; r.vertrag_monat = eig; r.vertrag_text = vg.text; return r; }
      r.grund = vg.text; r.vertrag = vg.art; return r;
    }
    var letzte = String(e.mv_letzte_erhoehung || '');
    var eigAb = /^\d{4}-\d{2}/.test(e.soll_ab || '') ? String(e.soll_ab).slice(0, 7) : null;
    function termineSetzen(art) {
      var t = mhTermine({ art: art, letzte: letzte, wirksam_eigen: eigAb, heute: heuteM });
      r.termine = t; r.ab = t.wirksam_ab; r.verlangbar_ab = t.verlangbar_ab;
      r.ab_text = t.text;
      r.ab_herkunft = (eigAb ? 'wirksam ab: eigene Angabe' : t.grund)
        + (art === '558' && letzte ? '; verlangbar frühestens ein Jahr nach der letzten Erhöhung (§ 558 Abs. 1 Satz 2 BGB)' : '')
        + (t.sperre ? '; ' + t.sperre : '');
      if (t.hinweis && r.hinweise.indexOf(t.hinweis) < 0) r.hinweise.push(t.hinweis);
    }
    termineSetzen('558');
    var ab = r.ab;
    /* v2545 · DREI-JAHRES-ANRECHNUNG (§ 558 Abs. 3 BGB): die Kappungsgrenze gilt auf die
       Miete drei Jahre vor dem Wirksamwerden; eine Erhöhung in diesem Fenster wird abgezogen. */
    var basisK = ist;
    var betragL = zahl(e.mv_letzte_erhoehung_betrag);
    var imFenster = /^\d{4}-\d{2}/.test(letzte) && letzte.slice(0, 7) > plusMonate(ab || heuteM || heuteYm(), -36);
    if (imFenster && betragL > 0 && betragL < ist) {
      basisK = ist - betragL; r.kapp_basis = basisK; r.kapp_angerechnet = betragL;
    } else if (imFenster && !(betragL > 0)) {
      r.hinweise.push('die letzte Erhöhung liegt in den drei Jahren der Kappungsgrenze — ihre Höhe eintragen, sonst ist der Spielraum zu groß gerechnet');
    }
    var eigen = zahl(e.soll);
    if (eigen > 0) {
      r.miete = eigen; r.herkunft = 'eigene Angabe';
      var kc = ctx.kapp && ctx.kapp.pct ? basisK * (1 + ctx.kapp.pct / 100) + u.monat : null;
      /* v3246 · Marcel 09.11.2026: die eigene Soll-Miete bei normalem Vertrag ist als § 558-Wert auf die
         Kappungsgrenze BEGRENZT (bis v3245 nur ein Hinweis, gerechnet wurde mit der vollen Angabe).
         Der Teil darüber ist keine Erhöhung nach § 558 - er steht als ueber_kappung an der Einheit. */
      if (kc && eigen > kc + 0.5) {
        var kcR = Math.max(ist, Math.round(kc * 100) / 100);
        r.miete = kcR; r.herkunft = 'eigene Angabe, auf die Kappungsgrenze begrenzt';
        r.eigen_soll = eigen; r.ueber_kappung = Math.round((eigen - kcR) * 100) / 100;
        r.grenze = 'Kappungsgrenze ' + ctx.kapp.pct + ' %' + (r.kapp_angerechnet ? ' (letzte Erhöhung angerechnet)' : '');
        if (u.monat > 0) r.umlage559 = u;
        r.hinweise.push('eigene Soll-Miete ' + eur2(eigen) + ' liegt über der Kappungsgrenze (' + ctx.kapp.pct + ' % in 3 Jahren) — als Erhöhung nach § 558 BGB höchstens '
          + eur2(kcR) + '; der Teil darüber (' + eur2(r.ueber_kappung) + '/Monat) ist keine Erhöhung nach § 558');
      }
      /* v3249 · § 558 endet an der ortsüblichen Vergleichsmiete. Liegt eine BELEGTE Vergleichsmiete vor (eigene
         Angabe, Mietspiegel, amtliche Mietpreisübersicht), ist auch die eigene Soll-Miete darauf begrenzt
         (gemessen Staging 09.11.: Bismarckstr. Whg 1 eigene Soll 1.010 € über Mietspiegel × Fläche).
         Bei der Schätzung aus Angebotsmieten nur ein Hinweis - die eigene Angabe kann genauer sein. */
      var vglE = zahl(e.vgl_qm) || zahl(ctx.vgl_qm);
      var artE = zahl(e.vgl_qm) ? 'eigen' : (ctx.vgl_art || '');
      if (vglE > 0 && wfl > 0 && r.miete > Math.max(ist, vglE * wfl + u.monat) + 0.5) {
        var vgR = Math.round(Math.max(ist, vglE * wfl + u.monat) * 100) / 100;
        if (artE && artE !== 'angebot_abschlag' && artE !== 'marktmiete') {
          if (r.eigen_soll == null) r.eigen_soll = eigen;
          r.ueber_vergleichsmiete = Math.round((r.miete - vgR) * 100) / 100;
          r.miete = vgR; r.herkunft = 'eigene Angabe, auf die Vergleichsmiete begrenzt'; r.grenze = 'Vergleichsmiete';
          if (u.monat > 0) r.umlage559 = u;
          r.hinweise.push('eigene Soll-Miete ' + eur2(eigen) + ' liegt über der ortsüblichen Vergleichsmiete ('
            + eur2(vglE) + '/m²) — als Erhöhung nach § 558 BGB höchstens ' + eur2(vgR) + '; darüber nur mit Gutachten oder drei Vergleichswohnungen');
        } else if (artE === 'angebot_abschlag' || artE === 'marktmiete') {   /* ohne Art (alte Aufrufer): unverändert */
          r.hinweise.push('eigene Soll-Miete liegt über der geschätzten Vergleichsmiete (' + eur2(vglE) + '/m², aus Angebotsmieten) — mit Mietspiegel, Vergleichswohnungen oder Gutachten belegen');
        }
      }
      return r;
    }
    var vgl = zahl(e.vgl_qm) || zahl(ctx.vgl_qm);
    var m558 = ist, kappe;
    if (vgl > 0 && wfl > 0) {
      var ziel = vgl * wfl;
      kappe = basisK * (1 + ((ctx.kapp && ctx.kapp.pct) || 20) / 100);
      m558 = Math.max(ist, Math.min(ziel, kappe));
      r.grenze = (kappe < ziel) ? 'Kappungsgrenze ' + ((ctx.kapp && ctx.kapp.pct) || 20) + ' %' + (r.kapp_angerechnet ? ' (letzte Erhöhung angerechnet)' : '') : 'Vergleichsmiete';
      r.vgl_qm = vgl; r.vgl_herkunft = zahl(e.vgl_qm) ? 'eigene Angabe' : (ctx.vgl_herkunft || 'am Objekt');
      /* v3246 · Art der Quelle und ihre Hinweise (Mietspiegel-Spanne, Vermutungswirkung, Schätzung aus
         Angebotsmieten) - nur gesetzt, wenn der Aufrufer sie kennt; die Prüfsumme der übrigen bleibt */
      if (zahl(e.vgl_qm)) r.vgl_quelle_art = 'eigen';
      else {
        if (ctx.vgl_art) r.vgl_quelle_art = ctx.vgl_art;
        if (ctx.vgl_hinweise && ctx.vgl_hinweise.length) r.vgl_hinweise = ctx.vgl_hinweise.slice();
        if (ctx.vgl_ms) r.ms = ctx.vgl_ms;
      }
    }
    if (m558 <= ist + 0.01 && !(u.monat > 0)) {
      r.grund = !(vgl > 0) ? 'Keine Vergleichsmiete eingetragen.'
        : (kappe <= ist + 0.01 && vgl * wfl > ist + 0.01) ? 'Die Kappungsgrenze ist durch die letzte Erhöhung ausgeschöpft.'
        : 'Die Miete liegt schon an der Vergleichsmiete.';
      return r;
    }
    r.miete = Math.round((m558 + u.monat) * 100) / 100;
    r.herkunft = u.monat > 0 ? (m558 > ist ? 'gerechnet (§ 558 und § 559)' : 'gerechnet (§ 559)') : 'gerechnet (§ 558)';
    if (u.monat > 0) r.umlage559 = u;
    /* v3028 · nur Modernisierungsumlage: keine Jahressperre, wirksam nach § 559b Abs. 2 */
    if (u.monat > 0 && !(m558 > ist)) termineSetzen('559');
    return r;
  }

  /* v3244 · DIE SOLL-MIETE IN IHRE TEILE (Prüfer-Befund 09.11.2026: soll558 beachtete die Vertragsart
     nicht - Gohliser Str. 42 Whg 2, 3, 7, 8, 12 und Parkstr. 9 Whg 1 wiesen eine Staffel-/Index-
     erhöhung als § 558 aus, obwohl § 557a Abs. 2 / § 557b Abs. 2 BGB ihn ausschließen).
     s = Ergebnis von sollFuer(), ist = Ist-Miete €/Monat.
     teil558:     Miete nach § 558 BGB ohne Umlage § 559 - bei Staffel/Index/Gewerbe IMMER Ist.
     teilVertrag: die vertragliche Erhöhung (eigene Soll-Angabe) als eigener Posten; null ohne Vertragsart. */
  function teil558(s, ist) {
    ist = zahl(ist);
    if (!s || s.miete == null || s.vertrag) return ist;
    var u = s.umlage559 && s.umlage559.monat > 0 ? s.umlage559.monat : 0;
    return Math.max(ist, s.miete - u);
  }
  var VERTRAG_NORM = { staffel: 'Staffelmiete, § 557a BGB', index: 'Indexmiete, § 557b BGB', gewerbe: 'Gewerbemietvertrag' };
  function teilVertrag(s, ist) {
    if (!s || !s.vertrag) return null;
    var m = zahl(s.vertrag_monat);
    return { art: s.vertrag, monat: m > 0 ? m : null, plus: m > zahl(ist) ? Math.round((m - zahl(ist)) * 100) / 100 : 0,
      norm: VERTRAG_NORM[s.vertrag] || 'Mietvertrag', text: s.vertrag_text || s.grund || vertragGrenzen({ mv_art: s.vertrag }).text };
  }

  /**
   * v3075 · ZULÄSSIGE BESTANDSMIETE NACH DREI JAHREN (P1.1/P1.2).
   * p: { ist: €/Monat, wfl: m², vgl_qm: €/m² (ortsübliche Vergleichsmiete, leer = unbekannt),
   *      kappung_pct: 15|20, letzte: 'JJJJ-MM' (letzte Erhöhung), letzte_betrag: €/Monat,
   *      mv_art: ''|'staffel'|'index'|'gewerbe', heute: 'JJJJ-MM' }
   * Regel (§ 558 BGB): höchstens die Vergleichsmiete und höchstens Ist × (1 + Kappung),
   * nie unter Ist. Am Ende der drei Jahre liegt das Drei-Jahres-Fenster der Kappung ganz in
   * der Zukunft - Grundlage ist deshalb die HEUTIGE Miete; eine frühere Erhöhung verschiebt
   * nur den Termin (Sperrfrist § 558 Abs. 1), nicht die Höhe. Ohne Vergleichsmiete rechnet
   * nur die Kappung - mit dem Satz, dass die echte Grenze darunter liegen kann.
   * Gibt auch die NÄCHSTE Erhöhung (sollFuer) mit ihren Terminen zurück.
   */
  function zulaessig(p) {
    p = p || {};
    var ist = zahl(p.ist), wfl = zahl(p.wfl), vgl = zahl(p.vgl_qm);
    var k = zahl(p.kappung_pct); if (k !== 15 && k !== 20) k = 20;
    var heute = /^\d{4}-\d{2}/.test(p.heute || '') ? String(p.heute).slice(0, 7) : heuteYm();
    var r = { ist_monat: ist, ist_jahr: ist * 12, kappung_pct: k, vgl_qm: vgl > 0 ? vgl : null,
      miete_monat: ist, miete_jahr: ist * 12, plus_pct: 0, grund: null, grund_text: '', hinweise: [], bis: plusMonate(heute, 36) };
    if (!(ist > 0)) { r.grund = 'keine_miete'; r.grund_text = 'Keine Ist-Miete eingetragen.'; return r; }
    var vg = vertragGrenzen({ mv_art: p.mv_art });
    if (!vg.s558) { r.grund = 'vertrag'; r.grund_text = vg.text; return r; }
    var kappe = ist * (1 + k / 100);
    var ziel = (vgl > 0 && wfl > 0) ? vgl * wfl : null;
    var m;
    if (ziel == null) {
      m = kappe; r.grund = 'kappung'; r.vgl_fehlt = true;
      r.grund_text = 'Kappungsgrenze ' + k + ' % in 3 Jahren (§ 558 Abs. 3 BGB). Die ortsübliche Vergleichsmiete ist nicht eingetragen — gerechnet unter der Annahme, dass sie mindestens so hoch liegt; liegt sie darunter, ist sie die Grenze.';
    } else if (ziel <= ist + 0.01) {
      m = ist; r.grund = 'vergleichsmiete_erreicht';
      r.grund_text = 'Die Miete liegt schon an oder über der ortsüblichen Vergleichsmiete (' + eur2(vgl) + '/m²) — keine Erhöhung nach § 558 BGB.';
    } else if (kappe < ziel) {
      m = kappe; r.grund = 'kappung';
      r.grund_text = 'Kappungsgrenze ' + k + ' % in 3 Jahren (§ 558 Abs. 3 BGB) — die Vergleichsmiete (' + eur2(vgl) + '/m²) läge höher.';
    } else {
      m = ziel; r.grund = 'vergleichsmiete';
      r.grund_text = 'Ortsübliche Vergleichsmiete ' + eur2(vgl) + '/m² (§ 558 Abs. 1 BGB) — die Kappungsgrenze ' + k + ' % läge höher.';
    }
    r.miete_monat = Math.round(m * 100) / 100;
    r.miete_jahr = Math.round(m * 12 * 100) / 100;
    r.plus_pct = (m / ist - 1) * 100;
    /* Termin der ersten Erhöhung: Sperrfrist § 558 Abs. 1 Satz 2, Wirksamkeit § 558b Abs. 1 */
    var t = mhTermine({ art: '558', letzte: p.letzte, heute: heute });
    r.termine = t;
    if (m > ist + 0.01) {
      r.sperrfrist = !t.verlangbar_sofort;
      r.termin_text = 'Erste Erhöhung ' + t.text + (r.sperrfrist ? ' (Sperrfrist ' + TERMIN_REGEL['558'].warte_norm + ')' : '');
      if (t.sperre) r.hinweise.push(t.sperre);
    }
    r.naechste = sollFuer({ ist: ist, wfl: wfl, status: 'vermietet', vgl_qm: vgl > 0 ? vgl : '', mv_art: p.mv_art || '',
      mv_letzte_erhoehung: p.letzte || '', mv_letzte_erhoehung_betrag: p.letzte_betrag || '' },
      { kapp: { pct: k }, heute: heute });
    return r;
  }

  /**
   * v3075 · NEUVERMIETUNG — eine EIGENE Zeile, nie die Bestandsmiete.
   * p: { markt_qm: €/m² (Angebots-/Marktmiete), wfl, vgl_qm, bremse: Ergebnis von mietpreisbremseAus() }
   * Gilt die Mietpreisbremse, höchstens Vergleichsmiete + 10 % (§ 556d Abs. 1 BGB).
   */
  function neuvermietung(p) {
    p = p || {};
    var mq = zahl(p.markt_qm), wfl = zahl(p.wfl), vgl = zahl(p.vgl_qm), br = p.bremse || null;
    if (!(mq > 0) || !(wfl > 0)) return null;
    var r = { markt_qm: mq, qm: mq, gedeckelt: false, bremse_gilt: br ? br.gilt : null, obergrenze_qm: null, text: '' };
    if (br && br.gilt === true) {
      if (vgl > 0) {
        r.obergrenze_qm = Math.round(vgl * 1.1 * 100) / 100;
        if (mq > r.obergrenze_qm) { r.qm = r.obergrenze_qm; r.gedeckelt = true; }
        r.text = 'Mietpreisbremse: höchstens ' + eur2(r.obergrenze_qm) + '/m² (Vergleichsmiete + 10 %, § 556d BGB)' + (r.gedeckelt ? ' — die Marktmiete liegt darüber' : '');
      } else {
        r.text = 'Mietpreisbremse gilt: höchstens Vergleichsmiete + 10 % (§ 556d BGB) — Vergleichsmiete eintragen, dann rechnet DealPilot die Obergrenze';
        r.ungeprueft = true;
      }
    } else if (br && br.gilt === false) {
      r.text = 'Keine Mietpreisbremse in der Gemeinde';
    } else {
      r.text = 'Mietpreisbremse nicht geprüft — wo sie gilt, höchstens Vergleichsmiete + 10 % (§ 556d BGB)';
      r.ungeprueft = true;
    }
    r.monat = Math.round(r.qm * wfl * 100) / 100;
    r.jahr = Math.round(r.qm * wfl * 12 * 100) / 100;
    return r;
  }

  /**
   * v3130 · N115 · ZIELMIETE NACH SANIERUNG — NUR EIN VORSCHLAG (Marcel 03.11.2026)
   * Je Wohnung: Marktmiete für den sanierten Zustand (Grundlage wählt der AUFRUFER und
   * nennt ihre Herkunft), gedeckelt durch die Mietpreisbremse bei Neuvermietung - die
   * Deckelung rechnet neuvermietung(), hier wird nichts zweites gerechnet.
   * p: { wfl, basis_qm, art ('wohnen'|'gewerbe'), vermietet (bool), bremse, vgl_qm }
   * Ergebnis: null (Gewerbe/ohne Fläche) · { fehlt: 'marktmiete' } · { qm, monat, basis_qm,
   *   gedeckelt, obergrenze_qm, bremse_gilt, ungeprueft, text, bestand }
   * Der Vorschlag wird NIE selbst übernommen - das tut der Nutzer je Wohnung.
   */
  function zielmieteVorschlag(p) {
    p = p || {};
    var wfl = zahl(p.wfl), bq = zahl(p.basis_qm);
    if (p.art === 'gewerbe' || !(wfl > 0)) return null;
    if (!(bq > 0)) return { fehlt: 'marktmiete' };
    var nv = neuvermietung({ markt_qm: bq, wfl: wfl, vgl_qm: p.vgl_qm, bremse: p.bremse });
    var qm = Math.round(nv.qm * 100) / 100;
    return {
      qm: qm, monat: Math.round(qm * wfl * 100) / 100, basis_qm: bq,
      gedeckelt: nv.gedeckelt, obergrenze_qm: nv.obergrenze_qm, bremse_gilt: nv.bremse_gilt, ungeprueft: !!nv.ungeprueft,
      text: nv.text,
      /* laufender Mietvertrag: die Zielmiete ist erst bei Neuvermietung erreichbar */
      bestand: p.vermietet
        ? 'Mieter wohnt: bis zur Neuvermietung gilt die zulässige Miete (Kappungsgrenze, § 558 BGB); mehr nur über die Modernisierungsumlage (§ 559 BGB).'
        : 'Leer: die Zielmiete gilt ab der Neuvermietung.'
    };
  }

  /* ══ v3246 · MIETSPIEGEL UND SCHÄTZUNG DER VERGLEICHSMIETE (Marcel 09.11.2026, § 558 BGB) ══════════
     Rangfolge der Vergleichsmiete (potenzial.js objektVgl): eigene belegte Vergleichsmiete -> Mietspiegel
     (Eingabe am Objekt, später dieselben Felder aus dem Register) -> amtliche Mietpreisübersicht ->
     Schätzung aus Angebotsmieten minus Abschlag. Hier stehen nur die reinen Regeln; Zahlen und Felder
     reicht der Aufrufer herein. */
  var MS_ART = { qualifiziert: 'qualifizierter Mietspiegel (§ 558d BGB)', einfach: 'einfacher Mietspiegel (§ 558c BGB)' };
  var MS_WAHL = { oben: 'oberer Spannenwert', mittel: 'Mittelwert', unten: 'unterer Spannenwert' };
  var MS_FOLGE = { oben: ['oben', 'mittel', 'unten'], mittel: ['mittel', 'unten', 'oben'], unten: ['unten', 'mittel', 'oben'] };
  var MS_EINGABE = 'Mietspiegel (eigene Eingabe aus dem Mietspiegel der Stadt)';
  var MS_REGISTER = 'Mietspiegel der Gemeinde (DealPilot-Verzeichnis)';
  var HW_MS = {
    oben: 'oberer Spannenwert — trägt nur, wenn Ausstattung und Merkmale der Wohnung ihn rechtfertigen, sonst Mittelwert',
    veraltet: 'veraltet — nur noch Indiz: der qualifizierte Mietspiegel ist älter als zwei Jahre, die Vermutungswirkung (§ 558d Abs. 2 und 3 BGB) entfällt',
    qualifiziert: 'qualifizierter Mietspiegel: nach oben abweichen nur mit Gutachten oder Vergleichswohnungen; die Mietspiegelwerte sind im Erhöhungsverlangen zu nennen (§ 558a Abs. 3 BGB)',
    einfach: 'einfacher Mietspiegel — mit drei Vergleichswohnungen absichern (§ 558a Abs. 2 Nr. 4 BGB)',
    ohne_stand: 'Stand des Mietspiegels fehlt — ob die Vermutungswirkung noch gilt (zwei Jahre, § 558d Abs. 2 BGB), ist nicht geprüft',
    ohne_art: 'Art des Mietspiegels nicht angegeben — gewertet wie ein einfacher Mietspiegel'
  };
  /** 'JJJJ-MM' aus 'JJJJ-MM', 'JJJJ-MM-TT', 'MM/JJJJ', 'MM.JJJJ' oder 'JJJJ' (dann Januar), sonst null */
  function ymAus(v) {
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = /^(\d{4})-(\d{2})/.exec(s))) return m[1] + '-' + m[2];
    if ((m = /^(\d{1,2})[./](\d{4})$/.exec(s))) return m[2] + '-' + String(+m[1]).padStart(2, '0');
    if ((m = /^(\d{4})$/.exec(s))) return m[1] + '-01';
    return null;
  }
  function msArt(a) { a = String(a || '').toLowerCase(); return /qualif/.test(a) ? 'qualifiziert' : /einfach/.test(a) ? 'einfach' : /kein/.test(a) ? 'keiner' : ''; }
  function msZahl(o, k) { var n = zahl(o && o[k]); return n > 0 ? Math.round(n * 100) / 100 : null; }
  /**
   * Mietspiegel des Objekts als EINE Struktur, gleich ob aus dem Register oder aus der Eingabe am Objekt:
   *   { art: 'qualifiziert'|'einfach', unten, mittel, oben (€/m² oder null), stand: 'JJJJ-MM'|null,
   *     gueltig_bis: 'JJJJ-MM'|null, url, herkunft, quelle: 'eingabe'|'register', art_fehlt }
   * register: Eintrag des Mietspiegel-Verzeichnisses { art, stand, vermutung_bis, url, (unten, mittel, oben) };
   * eingabe:  Felder am Objekt { art, unten, mittel, oben, stand, url }. Die Eingabe geht vor (sie trägt die
   * Werte); Art, Stand und Link füllt das Register auf. Ohne einen einzigen Wert: null.
   */
  function mietspiegelAus(register, eingabe) {
    var R = register || {}, E = eingabe || {};
    var hat = function (o) { return !!(msZahl(o, 'unten') || msZahl(o, 'mittel') || msZahl(o, 'oben')); };
    var vonE = hat(E), vonR = !vonE && hat(R) && msArt(R.art) !== 'keiner';
    if (!vonE && !vonR) return null;
    var Q = vonE ? E : R, A = vonE ? R : {};
    var artQ = msArt(Q.art), artA = msArt(A.art);
    var art = artQ && artQ !== 'keiner' ? artQ : (artA && artA !== 'keiner' ? artA : '');
    var stand = ymAus(Q.stand) || ymAus(A.stand);
    /* die Vermutungsfrist des Registers gilt nur für DENSELBEN Mietspiegel (gleicher Stand oder keiner eingetragen) */
    var regBis = ymAus(R.vermutung_bis);
    var gleicherMs = !vonE || !ymAus(E.stand) || ymAus(E.stand) === ymAus(R.stand);
    var bis = art === 'qualifiziert' ? ((regBis && gleicherMs) ? regBis : (stand ? plusMonate(stand, 24) : null)) : null;
    return { art: art || 'einfach', unten: msZahl(Q, 'unten'), mittel: msZahl(Q, 'mittel'), oben: msZahl(Q, 'oben'),
      stand: stand, gueltig_bis: bis, url: String(Q.url || A.url || '').trim() || null,
      herkunft: vonE ? MS_EINGABE : MS_REGISTER, quelle: vonE ? 'eingabe' : 'register', art_fehlt: !art };
  }
  /**
   * Der Wert, mit dem § 558 rechnet. wahl: 'oben' (Standard, Marcel 09.11.2026) | 'mittel' | 'unten'.
   * Fehlt der gewählte Wert, der nächste in MS_FOLGE (gesagt in den Hinweisen). heute: 'JJJJ-MM'.
   * { qm, wahl, genutzt, wahl_text, art, qualifiziert (mit Vermutungswirkung), veraltet, stand, gueltig_bis,
   *   url, herkunft, hinweise[] }
   */
  function mietspiegelWert(ms, wahl, heute) {
    if (!ms) return null;
    wahl = MS_WAHL[wahl] ? wahl : 'oben';
    var genutzt = null;
    MS_FOLGE[wahl].some(function (k) { if (ms[k] > 0) { genutzt = k; return true; } return false; });
    if (!genutzt) return null;
    var hm = /^\d{4}-\d{2}/.test(heute || '') ? String(heute).slice(0, 7) : heuteYm();
    var h = [];
    var spanne = !!(ms.unten > 0 || (genutzt !== 'mittel' && ms.mittel > 0));
    if (genutzt === 'oben' && spanne) h.push(HW_MS.oben);
    if (genutzt !== wahl) h.push('gewählt ist der ' + MS_WAHL[wahl] + ', eingetragen nur der ' + MS_WAHL[genutzt]);
    if (ms.art_fehlt) h.push(HW_MS.ohne_art);
    var veraltet = false;
    if (ms.art === 'qualifiziert') {
      if (!ms.stand) h.push(HW_MS.ohne_stand);
      else if (ms.gueltig_bis && hm > ms.gueltig_bis) { veraltet = true; h.push('Stand ' + mmjj(ms.stand) + ': ' + HW_MS.veraltet); }
      else h.push(HW_MS.qualifiziert);
    } else h.push(HW_MS.einfach);
    return { qm: ms[genutzt], wahl: wahl, genutzt: genutzt, wahl_text: MS_WAHL[genutzt], art: ms.art,
      qualifiziert: ms.art === 'qualifiziert' && !veraltet && !!ms.stand, veraltet: veraltet,
      stand: ms.stand || null, gueltig_bis: ms.gueltig_bis || null, url: ms.url || null, quelle: ms.quelle,
      unten: ms.unten, mittel: ms.mittel, oben: ms.oben,
      herkunft: ms.herkunft + ' — ' + (ms.art === 'qualifiziert' ? 'qualifiziert (§ 558d BGB)' : 'einfach (§ 558c BGB)')
        + ', ' + MS_WAHL[genutzt] + (ms.stand ? ', Stand ' + mmjj(ms.stand) : '') + (veraltet ? ', veraltet' : ''),
      hinweise: h };
  }
  /* ══ v3250 · SATZ DES MIETSPIEGEL-VERZEICHNISSES ALS ANZEIGE ═══════════════════════════════════════
     satz = Antwort der Route /marktbericht/mietspiegel?ags= (marktbericht/backend/src/lib/mietspiegel/verzeichnis.json):
     { art: 'qualifiziert'|'einfach'|'keiner'|'unklar'|null, stand, gueltig_bis, vermutung_bis, vermutung_bis_herleitung,
       url, zugang, preis, gefunden }. Phase 1 führt KEINE Werte - die Zeile sagt nur, ob und welcher Mietspiegel gilt
       und wo er steht. heute: 'JJJJ-MM-TT' (Parameter; ohne: Uhr). */
  var MS_REG = {
    keiner: 'kein Mietspiegel — die Vergleichsmiete mit drei Vergleichswohnungen oder einem Gutachten belegen (§ 558a Abs. 2 BGB) oder mit dem Mietspiegel einer vergleichbaren Gemeinde (§ 558a Abs. 4 BGB)',
    unklar: 'nicht belegt — ob ein Mietspiegel gilt, ist nicht belegt — bei der Stadt nachfragen',
    fehlt: 'nicht im Verzeichnis — Pflicht ist ein Mietspiegel erst ab 50.000 Einwohnern (§ 558c Abs. 4 BGB), kleinere Gemeinden haben oft keinen — bei der Stadt nachfragen',
    werte: 'Werte aus dem Mietspiegel eintragen — sonst rechnet DealPilot mit der Schätzung aus Angebotsmieten'
  };
  /** 'JJJJ-MM-TT' -> 'TT.MM.JJJJ', 'JJJJ-MM' -> 'MM/JJJJ', 'JJJJ' -> 'JJJJ' */
  function msDatum(v) {
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return m[3] + '.' + m[2] + '.' + m[1];
    if ((m = /^(\d{4})-(\d{2})$/.exec(s))) return m[2] + '/' + m[1];
    return /^\d{4}$/.test(s) ? s : '';
  }
  /** letzter Tag des genannten Zeitraums (JJJJ -> 31.12., JJJJ-MM -> Monatsende), wie der Verzeichnis-Prüfer */
  function msBisTag(v) {
    var s = String(v == null ? '' : v).trim(), m;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if ((m = /^(\d{4})-(\d{2})$/.exec(s))) return new Date(Date.UTC(+m[1], +m[2], 0)).toISOString().slice(0, 10);
    return /^\d{4}$/.test(s) ? s + '-12-31' : null;
  }
  /**
   * { status: 'qualifiziert'|'einfach'|'veraltet'|'keiner'|'unklar'|'fehlt', art, vorhanden (ein Mietspiegel ist
   *   bekannt, auch veraltet), veraltet, stand, bis, url, text (ohne Link), werte_hinweis }  - oder null ohne Satz.
   */
  function mietspiegelRegister(satz, heute) {
    if (!satz || typeof satz !== 'object') return null;
    var h = /^\d{4}-\d{2}-\d{2}/.test(heute || '') ? String(heute).slice(0, 10)
      : (/^\d{4}-\d{2}$/.test(heute || '') ? heute + '-01' : new Date().toISOString().slice(0, 10));
    var roh = String(satz.art == null ? '' : satz.art).toLowerCase(), art = msArt(roh);
    var r = { status: null, art: null, vorhanden: false, veraltet: false, stand: satz.stand || null, bis: null,
      url: String(satz.url || '').trim() || null, text: '', werte_hinweis: MS_REG.werte };
    if (!roh) r.status = 'fehlt';
    else if (art === 'keiner') r.status = 'keiner';
    else if (art !== 'qualifiziert' && art !== 'einfach') r.status = 'unklar';
    if (r.status) { r.text = 'Mietspiegel der Gemeinde: ' + MS_REG[r.status]; return r; }
    r.art = art; r.vorhanden = true;
    var q = art === 'qualifiziert';
    var bis = q ? (satz.vermutung_bis || satz.gueltig_bis || null) : (satz.gueltig_bis || null);
    var bisTag = msBisTag(bis);
    r.bis = bis; r.veraltet = !!(bisTag && bisTag < h);
    var t = [q ? 'qualifiziert (§ 558d BGB)' : 'einfach (§ 558c BGB)'];
    if (msDatum(r.stand)) t.push('Stand ' + msDatum(r.stand));
    if (r.veraltet) t.push(q ? 'veraltet seit ' + msDatum(bis) + ' — Vermutungswirkung (§ 558d Abs. 2 und 3 BGB) entfällt, nur noch Indiz; neuere Fassung bei der Stadt prüfen'
      : 'abgelaufen am ' + msDatum(bis) + ' — neuere Fassung bei der Stadt prüfen');
    else if (bisTag) t.push('gilt bis ' + (q && /^abgeleitet/.test(satz.vermutung_bis_herleitung || '') ? 'voraussichtlich ' : '') + msDatum(bis));
    if (satz.zugang === 'kostenpflichtig') t.push('kostenpflichtig' + (satz.preis ? ' (' + satz.preis + ')' : ''));
    else if (satz.zugang === 'online_rechner') t.push('nur als Online-Rechner');
    else if (satz.zugang === 'auf_anfrage') t.push('auf Anfrage bei der Stadt');
    r.status = r.veraltet ? 'veraltet' : art;
    r.text = 'Mietspiegel der Gemeinde: ' + t.join(' · ');
    return r;
  }
  /**
   * Stufe des Abschlags Angebotsmiete -> Vergleichsmiete. cfg = DealPilotConfig.mieteAngebotAbschlag
   * (Zahlen stehen NUR dort). lage: { bremse_gilt: true|false|null, kapp_pct, ags, einwohner }.
   * angespannt: Mietpreisbremse gilt oder Kappung 15 %; entspannt: nur bei BEKANNTER Einwohnerzahl unter
   * der Schwelle; sonst mittel. Berlin: Warnung. Ergebnis { pct, stufe, warnung, grund } oder null ohne cfg.
   */
  function abschlagStufe(cfg, lage) {
    var S = cfg && cfg.stufen; if (!S) return null;
    lage = lage || {};
    var ew = Number(lage.einwohner), unter = Number(cfg.entspannt_unter_einwohner);
    var stufe, grund;
    if (lage.bremse_gilt === true || Number(lage.kapp_pct) === 15) {
      stufe = 'angespannt'; grund = lage.bremse_gilt === true ? 'Mietpreisbremse gilt' : 'Kappungsgrenze 15 %';
    } else if (lage.einwohner != null && lage.einwohner !== '' && isFinite(ew) && ew > 0 && isFinite(unter) && ew < unter && S.entspannt != null) {
      stufe = 'entspannt'; grund = 'Gemeinde unter ' + unter.toLocaleString('de-DE') + ' Einwohnern';
    } else {
      stufe = 'mittel'; grund = 'weder Mietpreisbremse noch Kappungsgrenze 15 %';
    }
    var pct = Number(S[stufe]);
    if (!isFinite(pct)) return null;
    var berlin = cfg.berlin_ags && String(lage.ags || '').replace(/\D/g, '') === String(cfg.berlin_ags);
    return { pct: pct, stufe: stufe, grund: grund, warnung: berlin ? (cfg.berlin_warnung || null) : null, stand: cfg.stand || null };
  }
  /**
   * Vergleichsmiete geschätzt aus der Angebots-/Marktmiete. ab = Ergebnis von abschlagStufe() (oder { pct }).
   * Ohne Satz: die Marktmiete unverändert, ausdrücklich „Abschlag nicht bekannt“.
   */
  function vglAusAngebot(markt_qm, ab) {
    var mq = zahl(markt_qm); if (!(mq > 0)) return null;
    var p = ab && ab.pct != null && ab.pct !== '' ? Number(ab.pct) : NaN;
    var ok = isFinite(p) && p >= 0 && p < 60;
    var pT = ok ? String(Math.round(p * 10) / 10).replace('.', ',') : null;
    var beleg = ' — für das Erhöhungsverlangen mit Mietspiegel, drei Vergleichswohnungen oder Gutachten belegen';
    var r = { qm: ok ? Math.round(mq * (1 - p / 100) * 100) / 100 : mq, markt_qm: mq, pct: ok ? p : null,
      stufe: ok && ab.stufe ? ab.stufe : null, ohne_abschlag: !ok, warnung: (ab && ab.warnung) || null,
      text: ok ? 'Schätzung aus Angebotsmieten abzüglich ' + pT + ' % (DealPilot-Ansatz nach Marktlage, nicht amtlich)' + beleg
        : 'Schätzung aus Angebotsmieten, Abschlag nicht bekannt (DealPilot-Ansatz, nicht amtlich)' + beleg };
    r.hinweise = [r.text].concat(r.warnung ? [r.warnung] : []);
    return r;
  }

  g.DpMietpotenzial = {
    MS_ART: MS_ART, MS_WAHL: MS_WAHL, HW_MS: HW_MS,   /* v3246 */
    ymAus: ymAus, mietspiegelAus: mietspiegelAus, mietspiegelWert: mietspiegelWert, abschlagStufe: abschlagStufe, vglAusAngebot: vglAusAngebot,   /* v3246 */
    MS_REG: MS_REG, mietspiegelRegister: mietspiegelRegister,   /* v3250 */
    PRAEFIX: PRAEFIX, TERMIN_REGEL: TERMIN_REGEL,
    zahl: zahl, plusMonate: plusMonate, mmjj: mmjj, deDatum: deDatum,
    gemeindeFinden: gemeindeFinden, kappungAus: kappungAus, mietpreisbremseAus: mietpreisbremseAus,
    wirksamNachZugang: wirksamNachZugang, mhTermine: mhTermine, umlage559: umlage559, vertragGrenzen: vertragGrenzen,
    sollFuer: sollFuer, zulaessig: zulaessig, neuvermietung: neuvermietung,
    teil558: teil558, teilVertrag: teilVertrag,   /* v3244 */
    zielmieteVorschlag: zielmieteVorschlag   /* v3130 · N115 */
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.DpMietpotenzial;
})(typeof window !== 'undefined' ? window : globalThis);
