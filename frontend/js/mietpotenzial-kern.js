'use strict';
/* ════════════════════════════════════════════════════════════════════
   mietpotenzial-kern.js · v3075 — DIE ZULÄSSIGE MIETE, OHNE DOM
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
    out.g = gleich.length === 1 ? gleich[0] : null;
    out.mehrdeutig = gleich.length > 1;
    out.zuordnung = 'ortsname';
    return out;
  }
  function voKurz(voll) {
    voll = String(voll || ''); var kl = /\(([^)]+)\)/.exec(voll);
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
      if (eig > 0) { r.miete = eig; r.herkunft = 'eigene Angabe'; r.vertrag = vg.art; return r; }
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
      if (kc && eigen > kc + 0.5) r.hinweise.push('liegt über der Kappungsgrenze (' + ctx.kapp.pct + ' % in 3 Jahren)');
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

  g.DpMietpotenzial = {
    PRAEFIX: PRAEFIX, TERMIN_REGEL: TERMIN_REGEL,
    zahl: zahl, plusMonate: plusMonate, mmjj: mmjj, deDatum: deDatum,
    gemeindeFinden: gemeindeFinden, kappungAus: kappungAus, mietpreisbremseAus: mietpreisbremseAus,
    wirksamNachZugang: wirksamNachZugang, mhTermine: mhTermine, umlage559: umlage559, vertragGrenzen: vertragGrenzen,
    sollFuer: sollFuer, zulaessig: zulaessig, neuvermietung: neuvermietung
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.DpMietpotenzial;
})(typeof window !== 'undefined' ? window : globalThis);
