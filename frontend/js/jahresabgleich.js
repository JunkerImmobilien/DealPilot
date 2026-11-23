/* ══════════════════════════════════════════════════════════════════════
 * jahresabgleich.js — v3430 · Jahresabgleich im Bestand (erster Unterreiter)
 *
 * Marcel 14./15.11.2026: „wie wir Plan gegen Ist jedes Jahr machen können …
 * Tab Miete, Mieterhöhung, Steuern, Marktbericht … WEG-Protokolle, wie
 * verhält sich das Haus" · „ja Jahresabgleich zuerst" · Punkt 2: „wie es am
 * meisten Sinn macht" → ein Jahr gilt von selbst als abgeglichen, wenn alle
 * vier Schritte erledigt sind (kein Knopf, nichts wird gesperrt).
 * v4016 · Marcel 23.11.2026: ein Jahr oder einzelne Schritte festschreiben (sperren) und wieder freigeben
 *   (_jahre[J].fest, jahresbuch.js festSetzen); festgeschrieben zählt als erledigt. Kopf und Reitermarke folgen
 *   dem gewählten Jahr, „2 von 4 Schritten erledigt (Miete, Haus)" statt „2 von 4".
 * v4017 · ViVi des Jahres (Kaltmiete laut ViVi-Mietverlauf, Restschuld heute, Sondertilgungen) mit Differenz.
 * v3430 · Marcel 15.11.2026 zur Demo Fassung 2: „die Demo ist super, gerne noch
 * professionelle Grafiken rein und die Auswertung der WEG-Protokolle und
 * Wirtschaftspläne … Setz alles um, was geht."
 * Konzept: Dateien/Fehler/jahresabgleich-konzept-2026-11-14.md
 * Vorlage: design/Vorschläge/pilot-analyse-demo.html (Reiter Jahresabgleich)
 *
 * AUFBAU (v3430): Ergebnissatz mit Jahresleiste · die vier Schritte als EINE
 * Leiste (Wert groß, Plan und Abweichung klein, Knopf) · Mieterhöhungs-
 * potenzial des Jahres · EINE Tabelle „Jahr für Jahr" (ersetzt die
 * Jahresbuch-Tafel, „Kauf gegen heute" je Jahr und die Jahresstände) ·
 * Verlaufsgrafik (jahresbuch-grafik.js).
 *
 * EINGEBEN IN DEN REITERN, ABLESEN HIER. Kein Eingabefeld, kein Rechenkern:
 *   Miete   DpJahresbuch.zeilen() (Ist aus dem Reiter Miete, seit v3366 E4)
 *   Steuer  DpJahresbuch.zeilen() (_computeYearTotal, Status je Jahr)
 *   Wert    DpJahresbuch.mbLaden() (Marktberichte des Objekts)
 *   Haus    DpHausverlauf.jahrDaten() (Protokoll, Wirtschaftsplan, Abrechnung,
 *           Hausgeld, Rücklage, Sonderumlagen je Jahr, v3430)
 *   Plan    _ankauf.plan (eingefrorene Projektionszeilen: nkm_y, cfop_y,
 *           zve_y, su_y, wert_y, rs)
 *   Stand   DpJahresstaende.standJahr() (DSCR, Score des Jahres)
 *   Mieterhöhung  mietpotenzial-kern.js sollFuer()/teil558() - DERSELBE Kern
 *           wie potenzial.js, nur mit dem Stichtag 01.01. des Jahres, der Miete
 *           an diesem Tag (DpErhoehungen.mieteMonat) und der letzten Erhöhung
 *           davor. Vergleichsmiete und Kappung sind die von heute (die damalige
 *           kennt DealPilot nicht - das steht dabei).
 *
 * „erledigt" je Schritt (nur vergangene Jahre zählen, das laufende Jahr läuft):
 *   Miete   Jahr vergangen
 *   Steuer  Status „Bescheid" = erledigt, „erklärt" = teilweise
 *   Wert    ein Marktbericht in diesem Jahr
 *   Haus    WEG: Protokoll des Jahres UND (Jahresabrechnung ODER Wirtschafts-
 *           plan) des Jahres; eins davon = teilweise. Ohne WEG folgt der
 *           Schritt der Steuer (Kosten des Hauses stehen in der Anlage V)
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpJahresabgleich) return;
  var VERSION = 'v4017a';
  var GOLD = 'var(--wl-c9a84c, #C9A84C)';
  var SCHRITTE = [['miete', 'Miete'], ['steuer', 'Steuer'], ['wert', 'Wert'], ['haus', 'Haus']];
  var WORT = { ok: 'erledigt', teil: 'teilweise', offen: 'offen', laufend: 'läuft' };
  var _gewaehlt = null, _gewaehltKey = null;

  function doc() { return global.document || null; }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function zahl(v) { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; var n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function vz(x) { return istZahl(x) ? (x > 0 ? '+' : (x < 0 ? '−' : '±')) + Math.abs(Math.round(x)).toLocaleString('de-DE') + ' €' : '–'; }
  function z2(x) { return istZahl(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'; }
  function heuteJahr() { return new Date().getFullYear(); }
  function datumText(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(iso || ''); }
  function mmjj(ym) { return /^\d{4}-\d{2}/.test(ym || '') ? String(ym).slice(5, 7) + '/' + String(ym).slice(0, 4) : ''; }
  function JB() { return global.DpJahresbuch || null; }
  function verfuegbar() { var j = JB(); return !!(j && j.verfuegbar && j.verfuegbar()); }
  function planZeile(jahr) {
    try {
      var A = global.DealPilotAnkauf, a = A && A.vorhanden && A.vorhanden() ? A.stand() : null;
      var p = a && Array.isArray(a.plan) ? a.plan : [];
      return p.filter(function (x) { return x && x.cal === jahr; })[0] || null;
    } catch (e) { return null; }
  }
  function projZeile(jahr) { var r = (global.State && global.State.cfRows) || []; return r.filter(function (x) { return x && x.cal === jahr; })[0] || null; }
  function mitWeg() {
    try { if (/ETW/i.test(String((doc().getElementById('objart') || {}).value || ''))) return true; } catch (e) {}
    try { var H = global.DpHausverlauf; return !!(H && H.lesen && H.lesen().hatWeg); } catch (e) { return false; }
  }

  /* ── Haus im Jahr (v3430: aus DpHausverlauf.wegJahre) ──────────────── */
  function hausJahr(jahr, L) {
    var out = { protokoll: null, abrechnung: false, wirtschaftsplan: false, su: 0, suDa: false, ereignisse: [], hg_plan_m: null, hg_ist_j: null, ruecklage: null, beschluesse: [], verwalter: null, ergebnis: null };
    var H = global.DpHausverlauf; if (!H || !H.lesen) return out;
    try { L = L || H.lesen(); } catch (e) { return out; }
    var j = H.jahrDaten ? H.jahrDaten(jahr, L) : null;
    if (j) {
      out.protokoll = j.protokoll ? (j.versammlung || String(jahr)) : null;
      out.abrechnung = !!j.abrechnung; out.wirtschaftsplan = !!j.wirtschaftsplan;
      out.hg_plan_m = j.hausgeld_plan_monat; out.hg_ist_j = j.hausgeld_ist_jahr; out.ergebnis = j.abrechnungsergebnis;
      out.ruecklage = j.ruecklage_stand; out.beschluesse = j.beschluesse || []; out.verwalter = j.verwalter;
      var su = j.su_anteil != null ? j.su_anteil : null;
      if (su != null) { out.su = su; out.suDa = true; }
    }
    (L.liste || []).forEach(function (e) { if (e && e.jahr === jahr && e.art !== 'versammlung') out.ereignisse.push(e); });
    return out;
  }
  function steuerStand(s) { return s === 'bescheid' ? 'ok' : (s === 'erklaert' ? 'teil' : 'offen'); }
  /** Rein: Stand des Hausschritts aus den Jahreswerten */
  function hausStand(h, lauf) {
    var da = !!h.protokoll, papier = !!(h.abrechnung || h.wirtschaftsplan);
    return da && papier ? 'ok' : (da || papier ? 'teil' : (lauf ? 'laufend' : 'offen'));
  }
  /** Stand je Schritt für ein Jahr (z = Zeile aus DpJahresbuch.zeilen()) */
  function stand(z, weg, L) {
    if (!z) return null;
    var lauf = z.jahr >= heuteJahr(), h = hausJahr(z.jahr, L), s = {};
    /* v4037 · Marcel 23.11.2026: „für jedes Jahr tatsächlich die Werte reinschreiben … sicherstellen“. Ein vergangenes
       Jahr ist bei der Miete erst erledigt, wenn die Ist-Miete da ist (eingetragen oder aus ViVi) oder der Schritt
       festgeschrieben ist. Bis v4036 galt jedes vergangene Jahr als erledigt, auch nur mit gerechneter Miete. */
    s.miete = lauf ? 'laufend' : ((z.miete_eigen || z.miete_vivi) ? 'ok' : 'offen');
    s.steuer = lauf ? 'laufend' : steuerStand(z.status);
    s.wert = z.mb ? 'ok' : (lauf ? 'laufend' : 'offen');
    s.haus = weg ? hausStand(h, lauf) : (lauf ? 'laufend' : steuerStand(z.status));
    s._haus = h;
    /* v4016 · festgeschrieben gilt als erledigt (nur vergangene Jahre) */
    s.fest = {};
    var f = festJahr(z.jahr);
    if (!lauf) SCHRITTE.forEach(function (x) { if (f[x[0]]) { s.fest[x[0]] = f[x[0]]; s[x[0]] = 'ok'; } });
    s.nFest = Object.keys(s.fest).length;
    s.n = SCHRITTE.filter(function (x) { return s[x[0]] === 'ok'; }).length;
    s.fertig = !lauf && s.n === 4;
    s.erledigt = SCHRITTE.filter(function (x) { return s[x[0]] === 'ok'; }).map(function (x) { return x[1]; });
    s.offen = SCHRITTE.filter(function (x) { return s[x[0]] !== 'ok'; }).map(function (x) { return x[1]; });
    return s;
  }
  function festJahr(jahr) { try { var j = JB(); return j && j.fest ? j.fest(jahr) : {}; } catch (e) { return {}; } }
  /** v4016 · „2 von 4 Schritten erledigt (Miete, Haus)" statt „2 von 4" */
  function standText(s, jahr) {
    if (!s) return '';
    if (jahr >= heuteJahr()) return jahr + ' läuft noch';
    if (s.nFest === 4) return jahr + ' festgeschrieben';
    if (s.fertig) return jahr + ' abgeglichen, alle 4 Schritte erledigt';
    return jahr + ': ' + s.n + ' von 4 Schritten erledigt' + (s.erledigt.length ? ' (' + s.erledigt.join(', ') + ')' : '');
  }
  /** Erinnerung: ab Februar das Vorjahr, solange nicht alle vier erledigt sind */
  function erinnerung() {
    if (!verfuegbar()) return null;
    var vj = heuteJahr() - 1, z = JB().zeilen().filter(function (x) { return x.jahr === vj; })[0];
    if (!z || new Date().getMonth() < 1) return null;
    var s = stand(z, mitWeg());
    return s && !s.fertig ? { jahr: vj, n: s.n, offen: SCHRITTE.filter(function (x) { return s[x[0]] !== 'ok'; }).map(function (x) { return x[1]; }) } : null;
  }

  /* ── Mieterhöhungspotenzial je Jahr (v3430) ────────────────────────────
     Rein, ohne DOM: K = DpMietpotenzial (Kern), E = DpErhoehungen.
     quellen: [{ nr, liste, heute, letzte, betrag, wfl, mv_art, art, vgl_qm, vgl_art, vgl_eigen }]
     ctx: { kapp: { pct } }
     Je Wohnung: Miete am 01.01. (mieteMonat), letzte Erhöhung VOR dem Tag (ableiten der Liste bis dahin,
     ohne Liste die Felder des Reiters Miete, wenn sie davor liegen), dann sollFuer() mit heute = JJJJ-01.
     Ungenutzt im Jahr: ab dem Wirksamwerden je Monat zulässig minus tatsächlich (nie negativ). */
  function mpRein(quellen, jahr, ctx, K, E) {
    var iso = jahr + '-01-01', ym = jahr + '-01';
    var r = { jahr: jahr, stichtag: iso, ist: 0, zul: 0, plus: 0, ungenutzt_jahr: 0, verlangbar_ab: null, wirksam_ab: null, genutzt: [], wohnungen: [], ohne_vgl: false, sperre: false, n: 0 };
    if (!K || !E || !K.sollFuer) return r;
    (quellen || []).forEach(function (q) {
      if (!q || !(zahl(q.heute) > 0)) return;
      var L = E.sortiert ? E.sortiert(q.liste) : (q.liste || []);
      var ist0 = E.mieteMonat({ liste: L, heute: q.heute, letzte: q.letzte, betrag: q.betrag }, iso);
      if (!(ist0 > 0)) return;
      var letzte = null, betrag = null;
      if (L.length) {
        var bis = L.filter(function (x) { return x.datum < iso; });
        var ab = E.ableiten(bis, iso); letzte = ab.letzte; betrag = ab.betrag;
        if (!letzte && /^\d{4}-\d{2}-\d{2}$/.test(String(q.letzte || '')) && q.letzte < iso && q.letzte < L[0].datum) { letzte = q.letzte; betrag = zahl(q.betrag); }
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.letzte || '')) && q.letzte < iso) { letzte = q.letzte; betrag = zahl(q.betrag); }
      var s = K.sollFuer({ ist: ist0, wfl: q.wfl, status: 'vermietet', vgl_qm: q.vgl_eigen || '', mv_art: q.mv_art || '', art: q.art || 'wohnen',
        mv_letzte_erhoehung: letzte || '', mv_letzte_erhoehung_betrag: betrag != null ? betrag : '', massnahmen: [] },
        { kapp: ctx && ctx.kapp, vgl_qm: q.vgl_qm, vgl_art: q.vgl_art || null, heute: ym });
      var zul = s.miete != null ? K.teil558(s, ist0) : ist0;
      var w = { nr: q.nr || '', ist: Math.round(ist0 * 100) / 100, zul: Math.round(zul * 100) / 100, plus: Math.max(0, Math.round((zul - ist0) * 100) / 100),
        verlangbar_ab: s.miete != null && zul > ist0 + 0.5 ? s.verlangbar_ab || null : null, wirksam_ab: s.miete != null && zul > ist0 + 0.5 ? s.ab || null : null,
        grenze: s.grenze || null, grund: s.grund || null, sperre: !!(s.termine && s.termine.letzte_fehlt && zul > ist0 + 0.5), ungenutzt_jahr: 0, genutzt: [] };
      if (w.wirksam_ab) for (var m = 1; m <= 12; m++) {
        var ymm = jahr + '-' + String(m).padStart(2, '0'); if (ymm < w.wirksam_ab) continue;
        var tats = E.mieteMonat({ liste: L, heute: q.heute, letzte: q.letzte, betrag: q.betrag }, ymm + '-01');
        if (istZahl(tats)) w.ungenutzt_jahr += Math.max(0, zul - tats);
      }
      w.ungenutzt_jahr = Math.round(w.ungenutzt_jahr);
      L.filter(function (x) { return String(x.datum).slice(0, 4) === String(jahr) && x.art !== 'neuvermietung'; }).forEach(function (x) { w.genutzt.push({ datum: x.datum, auf: zahl(x.auf), nr: q.nr || '' }); });
      if (s.grund === 'Keine Vergleichsmiete eingetragen.') r.ohne_vgl = true;
      if (w.sperre) r.sperre = true;
      r.ist += w.ist; r.zul += w.zul; r.plus += w.plus; r.ungenutzt_jahr += w.ungenutzt_jahr; r.n++;
      r.genutzt = r.genutzt.concat(w.genutzt);
      if (w.verlangbar_ab && (!r.verlangbar_ab || w.verlangbar_ab < r.verlangbar_ab)) r.verlangbar_ab = w.verlangbar_ab;
      if (w.wirksam_ab && (!r.wirksam_ab || w.wirksam_ab < r.wirksam_ab)) r.wirksam_ab = w.wirksam_ab;
      r.wohnungen.push(w);
    });
    r.ist = Math.round(r.ist * 100) / 100; r.zul = Math.round(r.zul * 100) / 100; r.plus = Math.round(r.plus * 100) / 100;
    return r;
  }
  /** Die Quellen des offenen Objekts aus dem Modell von potenzial.js (Vergleichsmiete und Kappung, wie dort) */
  function mpQuellen() {
    var P = global.DpPotenzial, E = global.DpErhoehungen; if (!P || !P.modell || !E) return null;
    var m; try { m = P.modell({ ohneVorschlag: true }); } catch (e) { return null; }
    if (!m || !m.wohnungen || !m.wohnungen.length) return null;
    var M = global._dpMfh, einh = M && Array.isArray(M.einheiten) ? M.einheiten : [], d = doc();
    var feld = function (id) { var e = d && d.getElementById(id); return e ? String(e.value || '').trim() : ''; };
    var vgO = m.vgl && m.vgl.qm > 0 ? m.vgl.qm : null;
    var q = m.wohnungen.filter(function (w) { return w && w.status !== 'leer' && w.ist > 0; }).map(function (w) {
      var mfh = m.art === 'mfh', e = mfh ? (einh[w.i] || {}) : null;
      return { nr: mfh ? String(w.nr || w.i + 1) : '', liste: mfh ? (e.erhoehungen || []) : E.objektListe(), heute: w.ist,
        letzte: mfh ? e.mv_letzte_erhoehung : feld('mv_letzte_erhoehung'), betrag: mfh ? e.mv_letzte_erhoehung_betrag : feld('mv_letzte_erhoehung_betrag'),
        wfl: w.wfl, mv_art: w.mv_art || '', art: w.art || 'wohnen', vgl_qm: (w.soll && w.soll.vgl_qm) || vgO, vgl_art: (w.soll && w.soll.vgl_quelle_art) || (m.vgl && m.vgl.quelle_art) || null,
        vgl_eigen: mfh ? (e.vgl_qm || '') : '' };
    });
    return { quellen: q, ctx: { kapp: m.kappung }, mfh: m.art === 'mfh', vgl: m.vgl || null };
  }
  var _mp = { key: null, q: null, jahre: {} };
  function mpJahr(jahr) {
    var k = global._currentObjKey + '|' + (global._dpMfh ? JSON.stringify((global._dpMfh.einheiten || []).map(function (e) { return e && [e.ist, e.erhoehungen && e.erhoehungen.length]; })) : '') + '|' + ((global.DpErhoehungen && global.DpErhoehungen.objektListe) ? global.DpErhoehungen.objektListe().length : '');
    if (_mp.key !== k) { _mp = { key: k, q: mpQuellen(), jahre: {} }; }
    if (!_mp.q) return null;
    if (!_mp.jahre[jahr]) _mp.jahre[jahr] = mpRein(_mp.q.quellen, jahr, _mp.q.ctx, global.DpMietpotenzial, global.DpErhoehungen);
    return _mp.jahre[jahr];
  }

  /* ── ViVi je Jahr (v4017) ─────────────────────────────────────────────
     Marcel 23.11.2026: „bei ViVi-Verknüpfung die ViVi-Daten des Jahres zeigen und Differenzen je Jahr sichtbar
     machen, einfach." Gelesen wird nur, was schon im Objekt liegt: _vivi.felder (Miete heute laut ViVi, je Wohnung
     einheit.<n>.ist) und der Mietverlauf aus ViVi in der Liste der Mieterhöhungen (Einträge mit id vivi-…), dazu
     aus DpVivi.stand() die Restschuld heute und die Sondertilgungen. Kein Abruf, kein Schreiben.
     Kaltmiete im Jahr laut ViVi = je Monat ab dem Übergang (Kaufjahr) die Miete laut ViVi-Mietverlauf, summiert -
     dieselbe Zählung wie die Ist-Miete des Jahresbuchs, damit die Differenz nur echte Abweichungen zeigt. */
  /** Rein: Kaltmiete eines Jahres aus Quellen [{ liste, heute }] mit E.mieteMonat, ab Monat abM (1-12) */
  function viviMieteRein(quellen, jahr, abM, E) {
    if (!quellen || !quellen.length || !E || !E.mieteMonat) return null;
    var sum = 0;
    for (var m = Math.max(1, abM || 1); m <= 12; m++) {
      var iso = jahr + '-' + String(m).padStart(2, '0') + '-01';
      quellen.forEach(function (q) { var v = E.mieteMonat({ liste: q.liste, heute: q.heute }, iso); if (istZahl(v)) sum += v; });
    }
    return Math.round(sum * 100) / 100;
  }
  function viviDaten() {
    var F = global.DpViviFelder, v = null;
    try { v = F && F.lesen ? F.lesen() : null; } catch (e) { v = null; }
    if (!v || !v.verknuepft || !v.felder) return null;
    var st = null; try { st = global.DpVivi && global.DpVivi.stand ? global.DpVivi.stand() : null; } catch (e) { st = null; }
    var E = global.DpErhoehungen, M = global._dpMfh, quellen = [];
    var nurVivi = function (l) { return (Array.isArray(l) ? l : []).filter(function (x) { return x && /^vivi-/.test(String(x.id || '')); }); };
    if (M && Array.isArray(M.einheiten) && M.einheiten.length) {
      M.einheiten.forEach(function (e, i) {
        var id = null; try { id = F.einheitFeld ? F.einheitFeld(i, 'ist') : null; } catch (x) {}
        var h = id ? zahl(v.felder[id]) : null;
        if (h != null) quellen.push({ liste: nurVivi(e && e.erhoehungen), heute: h });
      });
    } else if (zahl(v.felder.nkm) != null) quellen.push({ liste: nurVivi(E && E.objektListe ? E.objektListe() : []), heute: zahl(v.felder.nkm) });
    return { stand: v.stand || (st && st.letzter_abruf) || null, quellen: quellen, info: (st && st.info) || null };
  }
  function viviJahr(jahr, vd) {
    if (!vd) return null;
    var ab = 1;
    try { var A = global.DealPilotAnkauf, a = A && A.vorhanden && A.vorhanden() ? A.stand() : null, m = a && /^(\d{4})-(\d{2})/.exec(String(a.stichtag || '')); if (m && +m[1] === jahr) ab = +m[2]; } catch (e) {}
    var out = { miete: viviMieteRein(vd.quellen, jahr, ab, global.DpErhoehungen), st: [], rs: null };
    var info = vd.info || {};
    /* v4037 · Kaltmiete laut ViVi aus dem Mietverlauf ALLER Mietverhältnisse (mit Leerstand), sonst wie bisher */
    var ij = info.ist_jahre || null;
    if (ij && ij.summe && ij.summe[String(jahr)] && istZahl(zahl(ij.summe[String(jahr)].miete))) out.miete = zahl(ij.summe[String(jahr)].miete);
    out.gezahlt = ij && ij.gezahlt && istZahl(zahl(ij.gezahlt[String(jahr)])) ? zahl(ij.gezahlt[String(jahr)]) : null;
    out.soll_warm = ij && ij.soll_warm && istZahl(zahl(ij.soll_warm[String(jahr)])) ? zahl(ij.soll_warm[String(jahr)]) : null;
    (info.sondertilgungen || []).forEach(function (x) { if (x && String(x.datum || '').slice(0, 4) === String(jahr)) out.st.push(x); });
    if (jahr === heuteJahr() && info.restschuld_heute && istZahl(info.restschuld_heute.wert)) out.rs = info.restschuld_heute;
    return out;
  }
  function viviHtml(z, vd) {
    var vj = viviJahr(z.jahr, vd); if (!vj) return '';
    var zeilen = [];
    if (istZahl(vj.miete)) {
      var dI = istZahl(z.miete_ist) ? z.miete_ist - vj.miete : null;
      zeilen.push('<div class="dp-ja-vz"><span>Kaltmiete ' + z.jahr + '</span><b>' + eur(vj.miete) + '</b><span>' + (dI == null ? 'kein Ist in DealPilot'
        : Math.abs(dI) < 1 ? '<span class="dp-ja-gut">stimmt mit DealPilot überein</span>' : 'DealPilot ' + eur(z.miete_ist) + ', <span class="dp-ja-schlecht">Differenz ' + vz(dI) + '</span>') + '</span></div>');
    }
    /* v4037 · gezahlt laut ViVi (warm) gegen das Soll warm: deutlich darunter = Hinweis */
    if (vj.gezahlt != null && vj.soll_warm != null && vj.soll_warm > 0) {
      var q = vj.gezahlt / vj.soll_warm;
      zeilen.push('<div class="dp-ja-vz"><span>Gezahlt ' + z.jahr + ' (warm)</span><b>' + eur(vj.gezahlt) + '</b><span>' + (q >= 0.97 ? '<span class="dp-ja-gut">wie vereinbart</span>'
        : 'vereinbart ' + eur(vj.soll_warm) + ', <span class="dp-ja-schlecht">' + Math.round((1 - q) * 100) + ' % weniger eingegangen</span>. Mietrückstand oder Leerstand prüfen.') + '</span></div>');
    }
    if (vj.rs) {
      var rsD = istZahl(z.rs_proj) ? z.rs_proj - vj.rs.wert : null;
      zeilen.push('<div class="dp-ja-vz"><span>Restschuld heute</span><b>' + eur(vj.rs.wert) + '</b><span>' + (rsD == null ? '' : Math.abs(rsD) < 50 ? '<span class="dp-ja-gut">wie die Projektion</span>'
        : 'Projektion ' + eur(z.rs_proj) + ', Differenz ' + vz(rsD)) + (vj.rs.sondertilgung ? ' (nach Sondertilgung ' + eur(vj.rs.sondertilgung) + ')' : '') + '</span></div>');
    }
    if (vj.st.length) zeilen.push('<div class="dp-ja-vz"><span>Sondertilgung</span><b>' + eur(vj.st.reduce(function (a, x) { return a + (zahl(x.betrag) || 0); }, 0)) + '</b><span>' + esc(vj.st.map(function (x) { return datumText(x.datum); }).join(', ')) + ', in DealPilot nicht eingerechnet</span></div>');
    if (!zeilen.length) return '';
    var stT = ''; try { var d = vd.stand ? new Date(vd.stand) : null; if (d && !isNaN(d.getTime())) stT = 'Stand ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); } catch (e) {}
    return '<div class="dp-ja-vivi" data-ja-vivi="' + z.jahr + '"><div class="dp-ja-eti">Laut ViVi' + (stT ? ' · ' + stT : '') + '</div>' + zeilen.join('') + '</div>';
  }

  /* ── Anzeige ───────────────────────────────────────────────────── */
  function stil() {
    var d = doc(); if (!d || d.getElementById('dp-ja-stil') || !d.head) return;
    var s = d.createElement('style'); s.id = 'dp-ja-stil';
    var T = '#2A2727', M = '#6B645A', LE = '#9A9285', LI = '#EFE8D6', RA = '#E6DCC2';
    s.textContent = [
      '.dp-ja{display:block;color:' + T + ';font:400 13px/1.55 Inter,system-ui,sans-serif}',
      '.dp-ja-erg{display:flex;gap:10px 12px;align-items:center;flex-wrap:wrap;padding:2px 0 14px;border-bottom:1px solid ' + LI + ';margin-bottom:14px}',
      '.dp-ja-erg .dp-ja-satz{flex:1 1 100%}',
      '.dp-ja-satz{font:500 18px/1.38 "Space Grotesk",Inter,sans-serif;letter-spacing:-.005em;max-width:680px;color:' + T + '}',
      '.dp-ja-satz b{font-weight:700}',
      '.dp-ja-jahre{display:flex;gap:6px;flex-wrap:wrap}',
      '.dp-pa-wrap .dp-ja-jahre button{border:1px solid ' + RA + ' !important;background:#fff !important;border-radius:8px !important;padding:5px 11px !important;font:500 12.5px Inter,sans-serif !important;color:' + T + ' !important;display:inline-flex;align-items:center;gap:7px;cursor:pointer;box-shadow:none !important;min-height:0 !important}',
      '.dp-pa-wrap .dp-ja-jahre button[aria-pressed="true"]{border-color:' + GOLD + ' !important;background:color-mix(in srgb, ' + GOLD + ' 12%, #fff) !important;font-weight:600 !important}',
      '.dp-ja-pkt{width:7px;height:7px;border-radius:50%;display:inline-block;flex:0 0 auto}',
      /* v4016 · je Jahr vier Kästchen (Miete, Steuer, Wert, Haus), Schritt-Nummer, Stand-Pille, Festschreiben */
      '.dp-ja-mini{display:inline-flex;gap:2px}.dp-ja-mini i{width:6px;height:10px;border-radius:2px;display:inline-block}',
      '.dp-ja-jahre small,.dp-ja-tab td small.dp-ja-l{font:500 10.5px Inter,sans-serif;color:' + M + '}',
      '.dp-ja-schl{display:inline-flex;color:#2f7d52}',
      '.dp-ja-nr{width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;flex:0 0 auto;font:600 10.5px Inter,sans-serif;background:rgba(42,39,39,.07);color:' + T + '}',
      '.dp-ja-kk .st{border-radius:9px;padding:0 7px;line-height:17px;border:1px solid transparent}',
      '.dp-ja-kk .st.dp-ja-st-ok{color:#2f7d52;border-color:rgba(63,165,108,.35)}.dp-ja-kk .st.dp-ja-st-teil{color:#8a6d1f;border-color:rgba(201,154,46,.45)}',
      '.dp-ja-kk .st.dp-ja-st-offen{color:#B8625C;border-color:rgba(184,98,92,.4)}.dp-ja-kk .st.dp-ja-st-fest{color:#fff;background:#3FA56C;border-color:#3FA56C}',
      '.dp-ja-schritt.fest{background:color-mix(in srgb, #3FA56C 5%, #fff)}',
      '.dp-pa-wrap .dp-ja button.dp-ja-fest{display:inline-flex;align-items:center;gap:5px;font:500 11.5px Inter,sans-serif !important;padding:3px 9px !important;min-height:0 !important;height:auto !important;border:1px dashed ' + RA + ' !important;background:#fff !important;box-shadow:none !important;color:' + M + ' !important;border-radius:8px !important;cursor:pointer;white-space:nowrap !important}',
      '.dp-pa-wrap .dp-ja button.dp-ja-fest.an{border-style:solid !important;border-color:rgba(63,165,108,.45) !important;color:#2f7d52 !important}',
      '.dp-pa-wrap .dp-ja-erg button.dp-ja-fest{margin-left:auto}',
      '.dp-pa-wrap .dp-ja-schritt button.dp-ja-fest{margin-top:2px}',
      '.dp-ja-vivi{border:1px solid ' + LI + ';border-radius:10px;padding:10px 16px;margin-top:12px;background:#fff;display:flex;flex-direction:column;gap:4px}',
      '.dp-ja-vz{display:grid;grid-template-columns:150px auto minmax(0,1fr);gap:4px 14px;align-items:baseline;font-size:12.5px;color:' + M + '}',
      '.dp-ja-vz b{font:600 14px "Space Grotesk",Inter,sans-serif;color:' + T + ';font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dp-ja-ok{background:#3FA56C}.dp-ja-teil{background:#C99A2E}.dp-ja-offen{background:#B8625C}.dp-ja-laufend{background:#D9D1BF}',
      '.dp-ja-erinnerung{border-left:2px solid ' + GOLD + ';background:color-mix(in srgb, ' + GOLD + ' 9%, #fff);border-radius:0 8px 8px 0;padding:8px 12px;font:500 13px Inter,sans-serif;color:' + T + ';margin:0 0 14px}',
      '.dp-ja-schritte{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid ' + LI + ';border-radius:10px;overflow:hidden;background:#fff}',
      '.dp-ja-schritt{padding:14px 16px;border-right:1px solid ' + LI + ';display:flex;flex-direction:column;gap:7px;min-width:0}',
      '.dp-ja-schritt:last-child{border-right:none}',
      '.dp-ja-kk{display:flex;align-items:center;gap:8px}.dp-ja-kk b{font:600 13.5px Inter,sans-serif}',
      '.dp-ja-kk .st{margin-left:auto;font:400 11.5px Inter,sans-serif;color:' + M + '}',
      '.dp-ja-w{font:600 19px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums;color:' + T + ';overflow-wrap:anywhere}',
      '.dp-ja-vgl{font:400 12px Inter,sans-serif;color:' + M + ';font-variant-numeric:tabular-nums}',
      '.dp-pa-wrap .dp-ja-schritt p{margin:0;font:400 12.5px/1.5 Inter,sans-serif;color:' + M + ';text-align:left !important}',
      '.dp-pa-wrap .dp-ja-schritt button{align-self:flex-start;margin-top:auto;max-width:100%;white-space:normal !important;text-align:left;height:auto !important}',
      '.dp-pa-wrap .dp-ja-schritt button + button{margin-top:0}',
      '.dp-pa-wrap .dp-ja button.dp-ja-gold{border-color:' + GOLD + ' !important;background:color-mix(in srgb, ' + GOLD + ' 12%, #fff) !important;font-weight:600 !important}',
      '.dp-ja .dp-ja-gut{color:#2f7d52 !important}.dp-ja .dp-ja-schlecht{color:#B8625C !important}',
      '.dp-ja-pot{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:center;border:1px solid ' + LI + ';border-radius:10px;padding:14px 16px;margin-top:12px;background:#fff}',
      '.dp-ja-eti{font:500 10px "JetBrains Mono",monospace;letter-spacing:.09em;text-transform:uppercase;color:' + M + '}',
      '.dp-ja-pot .dp-ja-w{font-size:21px;white-space:nowrap}',
      '.dp-ja-balken{height:8px;border-radius:4px;background:rgba(42,39,39,.08);position:relative;overflow:hidden}',
      '.dp-ja-balken i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:' + T + ';opacity:.72}',
      '.dp-ja-balken i.z{background:' + GOLD + ';opacity:1}',
      '.dp-pa-wrap .dp-ja-pot p{margin:6px 0 0;font:400 12.5px/1.5 Inter,sans-serif;color:' + M + ';text-align:left !important}',
      '.dp-ja-pot p b{color:' + T + ';font-variant-numeric:tabular-nums}',
      '.dp-pa-wrap .dp-ja p.dp-ja-hin{margin:8px 0 0;font:400 12px/1.5 Inter,sans-serif;color:' + LE + ';text-align:left !important}',
      '.dp-ja-abs{display:flex;align-items:baseline;gap:12px;margin:26px 0 10px;flex-wrap:wrap}',
      '.dp-ja-abs h4{margin:0;font:600 15px "Space Grotesk",Inter,sans-serif;color:' + T + '}',
      '.dp-ja-abs .dp-ja-eti{margin-left:auto;color:' + LE + '}',
      '.dp-ja-tab{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid ' + LI + ';border-radius:10px;background:#fff}',
      '.dp-ja-tab table{width:100%;border-collapse:collapse;font:400 12.5px Inter,sans-serif;color:' + T + ';min-width:780px}',
      '.dp-ja-tab th,.dp-ja-tab td{text-align:right;padding:8px 7px;border-bottom:1px solid #F1EBDD;font-variant-numeric:tabular-nums;white-space:nowrap;vertical-align:top}',
      '.dp-ja-tab tbody tr:last-child td{border-bottom:none}',
      '.dp-ja-tab th:first-child,.dp-ja-tab td:first-child{text-align:left}',
      '.dp-ja-tab th{font:500 10px/1.35 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:' + M + ';border-bottom:1px solid ' + RA + ';vertical-align:bottom}',
      '.dp-ja-tab td small{display:block;color:' + LE + ';font-size:11px;font-weight:400}',
      '.dp-ja-tab tbody tr{cursor:pointer}',
      '.dp-ja-tab tbody tr:hover td{background:color-mix(in srgb, ' + GOLD + ' 6%, #fff)}',
      '.dp-ja-tab tbody tr.an td{background:color-mix(in srgb, ' + GOLD + ' 11%, #fff)}',
      '.dp-ja-tab .dp-ja-stp{display:inline-block;margin-top:2px;padding:0 6px;border-radius:9px;font-size:10.5px;border:1px solid rgba(128,128,128,.35);color:' + M + '}',
      '.dp-ja-tab .dp-ja-stp.erklaert{border-color:' + GOLD + '}.dp-ja-tab .dp-ja-stp.bescheid{border-color:#3FA56C;color:#2f7d52}',
      '.dp-pa-wrap .dp-ja-tab button.dp-ja-ein{display:block;margin-top:3px;font:500 11px Inter,sans-serif !important;padding:0 !important;min-height:0 !important;border:none !important;background:none !important;box-shadow:none !important;color:#8a6d1f !important;text-decoration:underline;text-underline-offset:2px;cursor:pointer}',
      '.dp-ja-notiz{border-left:2px solid ' + GOLD + ';padding:8px 12px;background:color-mix(in srgb, ' + GOLD + ' 8%, #fff);font-size:12.5px;margin:10px 0 0;border-radius:0 8px 8px 0}',
      '.dp-ja-notiz.ok{border-left-color:#3FA56C}',
      '.dp-ja-fuss{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:12px;color:' + LE + '}',
      '@media (max-width:760px){.dp-ja-schritte{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-ja-schritt:nth-child(2n){border-right:none}.dp-ja-schritt:nth-child(-n+2){border-bottom:1px solid ' + LI + '}'
        + '.dp-ja-pot{grid-template-columns:1fr}.dp-ja-satz{font-size:15px}.dp-ja-schritt{padding:11px 10px;gap:5px}.dp-ja-w{font-size:17px}'
        + '.dp-pa-wrap .dp-ja-schritt p{font-size:11.5px}.dp-ja-kk{flex-wrap:wrap;gap:5px}.dp-ja-kk .st{margin-left:0}'
        + '.dp-pa-wrap .dp-ja-schritt button{font-size:12px !important;padding:5px 8px !important}'
        + '.dp-pa-wrap .dp-ja-jahre button{padding:4px 8px !important;gap:5px}.dp-pa-wrap .dp-ja-schritt p{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}'
        + '.dp-pa-wrap .dp-ja-erg button.dp-ja-fest{margin-left:0}.dp-ja-vivi{padding:10px 12px}.dp-ja-vz{grid-template-columns:auto auto;gap:0 10px}.dp-ja-vz>span:last-child{grid-column:1/-1;margin-bottom:4px}}'
    ].join('\n');
    d.head.appendChild(s);
  }
  function knopf(aktion, text, gold, jahr) { return '<button type="button" class="btn-clean dp-pa4-btn' + (gold ? ' dp-ja-gold' : '') + '" data-ja-aktion="' + aktion + '"' + (jahr != null ? ' data-ja-j="' + jahr + '"' : '') + '>' + text + '</button>'; }
  function abw(p, i, hoeherGut) {
    if (!istZahl(p) || !istZahl(i)) return '';
    var d = i - p, kl = Math.abs(d) < 0.5 ? '' : ((hoeherGut ? d > 0 : d < 0) ? 'dp-ja-gut' : 'dp-ja-schlecht');
    return '<span class="' + kl + '">' + vz(d) + '</span>';
  }
  function pktKlasse(sx, lauf) { return lauf ? 'laufend' : (sx.n === 4 ? 'ok' : (sx.n >= 2 ? 'teil' : 'offen')); }
  var SCHLOSS = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  /* v4016 · Schritt mit Nummer, Stand als Pille, festschreiben / wieder freigeben (nur vergangene Jahre) */
  function schritt(k, titel, s, wert, vgl, text, kn, jahr) {
    var nr = SCHRITTE.map(function (x) { return x[0]; }).indexOf(k) + 1, fest = s.fest && s.fest[k], lauf = jahr >= heuteJahr();
    var stW = fest ? 'festgeschrieben' : WORT[s[k]];
    var festKn = lauf ? '' : (fest
      ? '<button type="button" class="btn-clean dp-ja-fest an" data-ja-aktion="freigeben" data-ja-schritt-k="' + k + '" title="Festgeschrieben am ' + esc(datumText(fest)) + '. Wieder freigeben, um ' + titel + ' ' + jahr + ' zu ändern.">' + SCHLOSS + ' wieder freigeben</button>'
      : '<button type="button" class="btn-clean dp-ja-fest" data-ja-aktion="festschreiben" data-ja-schritt-k="' + k + '" title="' + titel + ' ' + jahr + ' abschließen. Danach lässt sich der Schritt nicht mehr ändern, bis er freigegeben ist.">' + SCHLOSS + ' festschreiben</button>');
    return '<div class="dp-ja-schritt' + (fest ? ' fest' : '') + '" data-ja-schritt="' + k + '"><div class="dp-ja-kk"><span class="dp-ja-nr">' + nr + '</span><b>' + titel + '</b><span class="st dp-ja-st-' + (fest ? 'fest' : s[k]) + '">' + stW + '</span></div>'
      + '<div class="dp-ja-w">' + wert + '</div><div class="dp-ja-vgl">' + vgl + '</div><p>' + text + '</p>' + (fest ? '' : kn) + festKn + '</div>';
  }
  function abschnitt(t, eti) { return '<div class="dp-ja-abs"><h4>' + t + '</h4>' + (eti ? '<span class="dp-ja-eti">' + eti + '</span>' : '') + '</div>'; }

  function potenzialHtml(z, lauf) {
    var mp = mpJahr(z.jahr);
    if (!mp || !mp.n) return '';
    var ungenutzt = Math.max(0, Math.round(mp.zul - mp.ist)), quote = mp.zul > 0 ? Math.min(100, Math.round(mp.ist / mp.zul * 100)) : 100;
    var gen = mp.genutzt.filter(function (x) { return istZahl(x.auf); });
    var genT = gen.length ? ' ' + (gen.length === 1 ? 'Erhöhung' : 'Erhöhungen') + ' ' + gen.map(function (x) { return (x.nr ? 'Whg. ' + esc(x.nr) + ' ' : '') + 'auf ' + eur(x.auf) + ' ab ' + mmjj(x.datum); }).join(', ') + ' eingetragen.' : '';
    var t = 'Zum 01.01.' + z.jahr + ' zulässig nach § 558 BGB: <b>' + eur(mp.zul) + '</b> im Monat, eingetragen <b>' + eur(mp.ist) + '</b>'
      + (ungenutzt > 0 && mp.verlangbar_ab ? ', verlangbar ab ' + mmjj(mp.verlangbar_ab) + ', wirksam ab ' + mmjj(mp.wirksam_ab) : '') + '.'
      + (mp.wohnungen.length > 1 ? ' Summe aus ' + mp.wohnungen.length + ' Wohnungen' + (mp.wohnungen.filter(function (w) { return w.plus > 0.5; }).length ? ', Luft in ' + mp.wohnungen.filter(function (w) { return w.plus > 0.5; }).map(function (w) { return 'Whg. ' + esc(w.nr); }).join(', ') : '') + '.' : '')
      + genT
      + (ungenutzt > 0 && mp.ungenutzt_jahr > 0 && !lauf ? ' Nicht genutzt im Jahr: <b>' + eur(mp.ungenutzt_jahr) + '</b>.' : '')
      + (ungenutzt > 0 && mp.ungenutzt_jahr > 0 && lauf ? ' Bis Jahresende ohne Erhöhung: ' + eur(mp.ungenutzt_jahr) + ' weniger.' : '')
      + (mp.ohne_vgl ? ' Für ' + (mp.wohnungen.length > 1 ? 'einen Teil der Wohnungen' : 'die Wohnung') + ' ist keine Vergleichsmiete bekannt, dort rechnet § 558 nicht (Mietspiegel im Reiter Miete eintragen).' : '')
      + (mp.sperre ? ' Die Erhöhung davor ist nicht eingetragen, die Sperrfrist ist nicht geprüft.' : '')
      + (ungenutzt <= 0 && !gen.length ? ' ' + esc((mp.wohnungen[0] && mp.wohnungen[0].grund) || 'Die Miete liegt an der zulässigen Grenze.') : '');
    /* im Jahr genutzt: die Erhöhung ist eingetragen und es blieb (fast) nichts liegen */
    var genutzt = !lauf && ungenutzt > 0 && gen.length && mp.ungenutzt_jahr <= Math.max(5, ungenutzt * 1.2);
    var wort = genutzt ? 'genutzt' : (ungenutzt > 0 ? vz(ungenutzt) + ' / Monat' : 'ausgeschöpft');
    if (genutzt) ungenutzt = 0;
    return '<div class="dp-ja-pot" data-ja-pot="' + z.jahr + '"><div><div class="dp-ja-eti">Mieterhöhung ' + z.jahr + '</div><div class="dp-ja-w' + (ungenutzt > 0 ? '' : ' dp-ja-gut') + '">' + wort + '</div>'
      + (genutzt ? '<div class="dp-ja-vgl">' + vz(Math.round(mp.zul - mp.ist)) + ' / Monat ab ' + mmjj(gen[0].datum) + '</div>' : '') + '</div>'
      + '<div><div class="dp-ja-balken" role="img" aria-label="eingetragen ' + quote + ' % der zulässigen Miete"><i style="width:' + quote + '%"></i></div><p>' + t + '</p></div>'
      + (ungenutzt > 0 ? '<span>' + knopf('mieterhoehung', 'Mieterhöhung vorbereiten', true)
        + (global.DpViviMieterhoehung && global.DpViviMieterhoehung.verfuegbar() ? ' ' + knopf('vivi-mh', 'In ViVi anlegen', false) : '') + '</span>' : '<span></span>') + '</div>'
      + '<p class="dp-ja-hin">Gerechnet wie die Potenzialanalyse (Kappung, Sperrfrist, Vergleichsmiete). Frühere Jahre mit der heutigen Vergleichsmiete, den damaligen Mietspiegel kennt DealPilot nicht.</p>';
  }

  function tabelleHtml(Z, weg, L, vd) {
    var J = global.DpJahresstaende;
    var kopf = '<tr><th>Jahr</th><th>Kaltmiete<br>Plan</th><th>Kaltmiete<br>Ist</th>' + (vd ? '<th>Kaltmiete<br>laut ViVi</th>' : '') + '<th>zulässig<br>§ 558</th><th>Cashflow v. St.<br>Plan · Ist</th><th>Ergebnis<br>V+V</th><th>Wert</th><th>Rest&shy;schuld</th><th>DSCR</th><th>Score</th><th>Abgleich</th></tr>';
    var body = Z.map(function (z) {
      var sx = stand(z, weg, L), lauf = z.jahr >= heuteJahr(), pl = planZeile(z.jahr), mp = mpJahr(z.jahr);
      var st = J && J.standJahr ? J.standJahr(z.jahr) : null, kz = (st && st.kz) || {};
      var dscr = zahl(kz._kpis_dscr), score = zahl(kz._ds2_score);
      var planM = istZahl(z.miete_plan) ? eur(z.miete_plan) : (istZahl(z.miete_proj) ? '<span style="color:#9A9285">' + eur(z.miete_proj) + '</span><small>Projektion</small>' : '–');
      var gen = mp && mp.n && !lauf && mp.genutzt.length && mp.zul > mp.ist + 0.5 && mp.ungenutzt_jahr <= Math.max(5, (mp.zul - mp.ist) * 1.2);
      var ung = mp && mp.n ? (gen ? '<small class="dp-ja-gut">genutzt</small>' : mp.ungenutzt_jahr > 0 ? '<small class="dp-ja-schlecht">' + vz(-mp.ungenutzt_jahr) + ' ungenutzt</small>' : (mp.zul > mp.ist + 0.5 ? '<small>ab ' + mmjj(mp.wirksam_ab) + '</small>' : '<small class="dp-ja-gut">ausgeschöpft</small>')) : '';
      var cfP = istZahl(z.cf_plan) ? z.cf_plan : z.cf_proj, cfI = istZahl(z.cf_stand) ? z.cf_stand : null;
      var rs = istZahl(z.rs_ist) ? z.rs_ist : z.rs_proj;
      return '<tr data-ja-jahr="' + z.jahr + '" class="' + (z.jahr === _gewaehlt ? 'an' : '') + '" title="Jahr ' + z.jahr + ' wählen">'
        + '<td><b>' + z.jahr + '</b>' + (lauf ? '<small>läuft</small>' : '') + '<button type="button" class="btn-clean dp-ja-ein" data-ja-aktion="eintragen" data-ja-j="' + z.jahr + '" title="Steuerstand, Restschuld laut Kontoauszug, Leerstand und Notiz für ' + z.jahr + '">eintragen</button></td>'
        + '<td>' + planM + '</td>'
        + '<td>' + (istZahl(z.miete_ist) ? eur(z.miete_ist) : '–') + '<small>' + (lauf ? 'Projektion' : abw(z.miete_basis, z.miete_ist, true)) + '</small></td>'
        + (vd ? (function () { var vj = viviJahr(z.jahr, vd), m = vj && vj.miete, d = istZahl(m) && istZahl(z.miete_ist) ? z.miete_ist - m : null;
            return '<td>' + (istZahl(m) ? eur(m) : '–') + '<small' + (d != null && Math.abs(d) >= 1 ? ' class="dp-ja-schlecht">Δ ' + vz(d) : (d != null ? ' class="dp-ja-gut">gleich' : '>')) + '</small></td>'; })() : '')
        + '<td>' + (mp && mp.n ? eur(mp.zul * 12) + ung : '–') + '</td>'
        + '<td>' + eur(cfP) + '<small>' + (cfI != null ? 'Ist ' + eur(cfI) : (lauf ? 'läuft' : 'kein Stand')) + '</small></td>'
        + '<td>' + (z.steuer && istZahl(z.steuer.ergebnis) ? vz(z.steuer.ergebnis) : '–') + '<small>' + (pl && istZahl(pl.zve_y) ? 'Plan ' + vz(pl.zve_y) : '') + '</small><span class="dp-ja-stp ' + esc(z.status) + '">' + esc(JB().statusWort(z.status)) + '</span></td>'
        + '<td>' + (z.mb ? eur(z.mb.wert) : '<span style="color:#9A9285">–</span>') + '<small>' + (pl && istZahl(pl.wert_y) ? 'Plan ' + eur(pl.wert_y) : '') + '</small></td>'
        + '<td>' + eur(rs) + '<small>' + (istZahl(z.rs_ist) ? 'Kontoauszug' : 'Projektion') + '</small></td>'
        + '<td>' + (dscr != null ? z2(dscr) : '–') + '</td>'
        + '<td>' + (score != null ? String(Math.round(score)) : '–') + '</td>'
        + '<td title="' + esc(standText(sx, z.jahr)) + '">' + (lauf ? '<small>läuft</small>' : sx.nFest === 4 ? '<span class="dp-ja-schl">' + SCHLOSS + '</span>'
          : '<span class="dp-ja-mini">' + SCHRITTE.map(function (y) { return '<i class="dp-ja-' + (sx[y[0]] === 'ok' ? 'ok' : sx[y[0]]) + '"></i>'; }).join('') + '</span>') + '</td></tr>';
    }).join('');
    return '<div class="dp-ja-tab"><table><thead>' + kopf + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function html() {
    if (!verfuegbar()) return '';
    stil();
    _mp.key = null;   /* je Zeichnen neu: Vergleichsmiete und Kappung laden nach (Mietspiegel-Register, Kappungsliste) */
    var Z = JB().zeilen().slice().sort(function (a, b) { return b.jahr - a.jahr; });
    if (!Z.length) return '';
    var weg = mitWeg(), key = global._currentObjKey, L = null;
    try { L = global.DpHausverlauf && global.DpHausverlauf.lesen ? global.DpHausverlauf.lesen() : null; } catch (e) { L = null; }
    if (_gewaehltKey !== key) { _gewaehlt = null; _gewaehltKey = key; }
    var jahre = Z.map(function (z) { return z.jahr; });
    if (_gewaehlt == null || jahre.indexOf(_gewaehlt) < 0) _gewaehlt = jahre.indexOf(heuteJahr() - 1) >= 0 ? heuteJahr() - 1 : jahre[0];
    var z = Z.filter(function (x) { return x.jahr === _gewaehlt; })[0], s = stand(z, weg, L), h = s._haus;
    var pl = planZeile(z.jahr), pr = projZeile(z.jahr), lauf = z.jahr >= heuteJahr();

    var out = '<div class="dp-ja" data-dp-ja="1">';
    /* v4016 · Die Erinnerung „Jahresabgleich 2025: 2 von 4" stand oben über JEDEM gewählten Jahr (Marcel 23.11.2026:
       „bleibt beim Wechsel der Jahre stehen"). Jetzt sagt der Kopf nur das gewählte Jahr; offene Jahre zeigt die
       Jahresleiste mit Punkt und Zahl. */

    /* Jahresleiste oben, darunter der Ergebnissatz des gewählten Jahres */
    var dm = istZahl(z.miete_ist) && istZahl(z.miete_basis) ? z.miete_ist - z.miete_basis : null;
    var cfPlan = pl && istZahl(pl.cfop_y) ? pl.cfop_y : null, cfIst = pr && istZahl(pr.cfop_y) ? pr.cfop_y : null;
    var satz = '<b>' + esc(standText(s, z.jahr)) + '.</b> '
      + (!lauf && s.offen.length && s.nFest < 4 ? 'Offen: ' + esc(s.offen.join(', ')) + '. ' : '')
      + (dm != null ? (Math.abs(dm) < 0.5 ? 'Miete wie ' + (z.ohne_plan ? 'die Projektion' : 'im Plan vom Kauf') : 'Miete ' + vz(dm) + (dm > 0 ? ' über' : ' unter') + (z.ohne_plan ? ' der Projektion' : ' dem Plan vom Kauf')) : 'Für dieses Jahr gibt es keinen Plan vom Kauf')
      + (cfPlan != null && cfIst != null ? ', Cashflow ' + vz(cfIst - cfPlan) : '') + '.'
      + (lauf ? ' Abgleich ab Februar ' + (z.jahr + 1) + ', wenn Steuer, Abrechnung und Protokoll da sind.' : '');
    var jahrKn = lauf ? '' : (s.nFest === 4
      ? '<button type="button" class="btn-clean dp-ja-fest an" data-ja-aktion="freigeben" title="Alle vier Schritte von ' + z.jahr + ' wieder freigeben.">' + SCHLOSS + ' Jahr ' + z.jahr + ' wieder freigeben</button>'
      : '<button type="button" class="btn-clean dp-ja-fest" data-ja-aktion="festschreiben" title="Alle vier Schritte von ' + z.jahr + ' festschreiben und das Jahr abschließen. Wieder freigeben geht jederzeit.">' + SCHLOSS + ' Jahr ' + z.jahr + ' festschreiben</button>');
    out += '<div class="dp-ja-erg"><div class="dp-ja-jahre" role="group" aria-label="Jahr wählen">' + Z.slice().reverse().map(function (x) {
        var sx = stand(x, weg, L), xl = x.jahr >= heuteJahr();
        var tt = standText(sx, x.jahr) + (!xl && sx.offen.length ? '. Offen: ' + sx.offen.join(', ') : '');
        /* je Schritt ein Kästchen in der Reihenfolge Miete, Steuer, Wert, Haus: grün erledigt, gelb teilweise, rot offen */
        return '<button type="button" class="btn-clean" data-ja-jahr="' + x.jahr + '" aria-pressed="' + (x.jahr === _gewaehlt) + '" title="' + esc(tt) + '" aria-label="' + esc(tt) + '">' + x.jahr
          + (xl ? '<small>läuft</small>' : sx.nFest === 4 ? '<small class="dp-ja-schl">' + SCHLOSS + '</small>'
            : '<span class="dp-ja-mini">' + SCHRITTE.map(function (y) { return '<i class="dp-ja-' + (sx[y[0]] === 'ok' ? 'ok' : sx[y[0]]) + '"></i>'; }).join('') + '</span>') + '</button>';
      }).join('') + '</div>' + jahrKn + '<div class="dp-ja-satz">' + satz + '</div></div>';

    /* die vier Schritte als eine Leiste */
    var erh = (z.erhoehungen || []).map(function (e) { return datumText(e.datum) + (e.nr ? ' (Whg. ' + e.nr + ')' : '') + (istZahl(zahl(e.auf)) ? ' auf ' + eur(zahl(e.auf)) : ''); });
    var listeLeer = false; try { var E = global.DpErhoehungen; listeLeer = !!(E && E.alle && !E.alle().length); } catch (e) {}
    var mPlan = z.miete_plan != null ? z.miete_plan : z.miete_proj;
    var sch = '';
    sch += schritt('miete', 'Miete', s, eur(z.miete_ist), (z.miete_plan != null ? 'Plan ' : 'Projektion ') + eur(mPlan) + (abw(mPlan, z.miete_ist, true) ? ' · ' + abw(mPlan, z.miete_ist, true) : ''),
      (erh.length ? 'Erhöhung ' + esc(erh.join(', ')) + '.' : 'Keine Erhöhung in diesem Jahr eingetragen.') + (listeLeer && !lauf ? ' Ohne Liste rechnet DealPilot vergangene Jahre mit der heutigen Miete.' : '')
        + (!lauf ? (z.miete_eigen ? ' Ist-Miete von dir eingetragen.' : (z.miete_vivi ? ' Ist-Miete aus ViVi übernommen.' : ' Die Ist-Miete ' + z.jahr + ' fehlt noch. Trag ein, was wirklich eingegangen ist.')) : ''),
      (!lauf && !z.miete_eigen && !z.miete_vivi ? knopf('eintragen', 'Ist-Miete ' + z.jahr + ' eintragen', true, z.jahr) + ' ' : '') + knopf('miete', 'Mieterhöhung eintragen', listeLeer && !lauf), z.jahr);
    var stW = { geplant: 'nicht erklärt', erklaert: 'erklärt, Bescheid fehlt', bescheid: 'Bescheid liegt vor' }[z.status] || 'nicht erklärt';
    var stI = z.steuer ? z.steuer.ergebnis : null, stP = pl && istZahl(pl.zve_y) ? pl.zve_y : null;
    sch += schritt('steuer', 'Steuer', s, istZahl(stI) ? vz(stI) : '–', (stP != null ? 'Plan ' + vz(stP) : 'kein Plan') + (abw(stP, stI, true) ? ' · ' + abw(stP, stI, true) : ''),
      'Ergebnis Anlage V · ' + stW + '.', knopf('steuer', z.status === 'geplant' ? 'Anlage V ' + z.jahr + ' ausfüllen' : 'Anlage V ansehen', s.steuer === 'offen') + ' ' + knopf('eintragen', 'Stand setzen', false, z.jahr), z.jahr);
    var wP = pl && istZahl(pl.wert_y) ? pl.wert_y : null, wI = z.mb ? z.mb.wert : null;
    sch += schritt('wert', 'Wert', s, wI != null ? eur(wI) : '–', (wP != null ? 'Plan ' + eur(wP) : 'kein Plan') + (abw(wP, wI, true) ? ' · ' + abw(wP, wI, true) : ''),
      z.mb ? 'Marktbericht vom ' + datumText(z.mb.am) + '.' : 'Kein Marktbericht in ' + z.jahr + '.', knopf(z.mb ? 'wert-sehen' : 'wert', z.mb ? 'Alle Berichte' : 'Marktbericht abrufen', s.wert === 'offen'), z.jahr);
    if (weg) {
      var hgW = istZahl(h.hg_ist_j) ? eur(h.hg_ist_j) : (istZahl(h.hg_plan_m) ? eur(h.hg_plan_m * 12) : '–');
      var hgV = istZahl(h.hg_plan_m) ? 'Plan ' + eur(h.hg_plan_m * 12) + (istZahl(h.hg_ist_j) ? ' · ' + abw(h.hg_plan_m * 12, h.hg_ist_j, false) : ' · Wirtschaftsplan') : (istZahl(h.hg_ist_j) ? 'Hausgeld laut Abrechnung' : 'Hausgeld im Jahr');
      var hausT = [];
      hausT.push(h.protokoll ? 'Versammlung ' + esc(h.protokoll) : 'Protokoll fehlt');
      hausT.push(h.wirtschaftsplan ? 'Wirtschaftsplan da' : 'Wirtschaftsplan fehlt');
      hausT.push(h.abrechnung ? 'Abrechnung da' + (istZahl(h.ergebnis) ? ' (' + (h.ergebnis > 0 ? 'Nachzahlung ' : 'Guthaben ') + eur(Math.abs(h.ergebnis)) + ')' : '') : 'Abrechnung fehlt');
      /* v3993 · F22 Marcel 23.11.2026: maßgeblich ist die Abrechnung, der Wirtschaftsplan nur zur Plausibilität (mehr als 10 % Abstand = Hinweis) */
      if (istZahl(h.hg_plan_m) && istZahl(h.hg_ist_j) && h.hg_plan_m > 0) {
        var _hgQ = (h.hg_ist_j - h.hg_plan_m * 12) / (h.hg_plan_m * 12);
        if (Math.abs(_hgQ) > 0.10) hausT.push('Abrechnung ' + String(Math.round(Math.abs(_hgQ) * 1000) / 10).replace('.', ',') + ' % ' + (_hgQ > 0 ? 'über' : 'unter') + ' dem Wirtschaftsplan, maßgeblich ist die Abrechnung');
      }
      var suP = pl && istZahl(pl.su_y) ? pl.su_y : 0;
      var suT = h.suDa && h.su > 0 ? ' Sonderumlage ' + eur(h.su) + (suP ? ' (Plan ' + eur(suP) + ')' : ' (nicht geplant)') + '.' : '';
      var bT = h.beschluesse.length ? ' ' + esc(h.beschluesse.slice(0, 2).join(' · ')) + '.' : '';
      sch += schritt('haus', 'Haus', s, hgW, hgV, hausT.join(' · ') + '.' + suT + bT,
        knopf('haus', 'Unterlagen hochladen', s.haus !== 'ok' && !lauf) + ' ' + knopf('haus-sehen', 'Haus ansehen', false), z.jahr);
    } else {
      var ev = h.ereignisse.slice(0, 2).map(function (e) { return esc(e.titel || e.text); }).filter(Boolean);
      sch += schritt('haus', 'Haus', s, h.suDa && h.su > 0 ? eur(h.su) : 'keine', 'Sonderumlage · Plan ' + eur(pl && istZahl(pl.su_y) ? pl.su_y : 0),
        'Kein Wohnungseigentum, die Hauskosten stehen in der Anlage V.' + (ev.length ? ' ' + ev.join(' · ') + '.' : ''), knopf('steuer', 'Anlage V ansehen', false), z.jahr);
    }
    out += '<div class="dp-ja-schritte">' + sch + '</div>';

    /* v4017 · ViVi des Jahres mit Differenz zu DealPilot */
    var vd = null; try { vd = viviDaten(); } catch (e) { vd = null; }
    try { out += viviHtml(z, vd); } catch (e) { try { console.warn('[jahresabgleich] ViVi', e); } catch (x) {} }

    /* Mieterhöhungspotenzial des Jahres */
    try { out += potenzialHtml(z, lauf); } catch (e) { try { console.warn('[jahresabgleich] Mietpotenzial', e); } catch (x) {} }

    /* Jahr für Jahr: eine Tabelle statt drei */
    out += abschnitt('Jahr für Jahr', 'Plan vom Kauf gegen Ist · Zeile wählt das Jahr');
    out += tabelleHtml(Z, weg, L, vd);
    var hin = '';
    if (z.abgleich && z.abgleich.art !== 'gleich') hin += '<div class="dp-ja-notiz">' + esc(z.abgleich.text) + (z.abgleich.art === 'vorschlag' ? ' ' + knopf('av', 'übernehmen', false, z.jahr) : '') + '</div>';
    if (z.ziel_erreicht && z.ziel_fassung && z.ziel_fassung.status !== 'erreicht') hin += '<div class="dp-ja-notiz ok">Die Ist-Miete ' + z.jahr + ' erreicht das Ziel von ' + esc(z.ziel_titel || 'Zielbild') + '. <button type="button" class="btn-clean dp-pa4-btn" data-ja-aktion="erreicht" data-ja-fassung="' + esc(z.ziel_fassung.id) + '">als erreicht kennzeichnen</button></div>';
    if (z.notiz) hin += '<div class="dp-ja-notiz">Notiz ' + z.jahr + ': ' + esc(z.notiz) + '</div>';
    out += hin;
    var nSt = 0; try { nSt = global.DpJahresstaende && global.DpJahresstaende.liste ? global.DpJahresstaende.liste().length : 0; } catch (e) {}
    out += '<div class="dp-ja-fuss"><span>Plan ist die Rechnung vom Kauf, eingefroren. DSCR und Score aus dem Jahresstand (' + nSt + ' festgehalten). '
      + (z.ohne_plan ? 'Ohne eingefrorenen Plan steht grau die heutige Projektion. ' : '') + '</span>'
      + '<button type="button" class="btn-clean dp-pa4-btn" data-ja-aktion="festhalten">Stand ' + heuteJahr() + ' festhalten</button></div>';

    /* Verlauf */
    out += abschnitt('Verlauf', 'Kaltmiete und Cashflow · Plan gegen Ist') + '<div data-dp-jb-grafik="1" data-ja-grafik="1"></div>';
    out += '</div>';
    return out;
  }

  /* ── Hosts, Klicks ─────────────────────────────────────────────── */
  /* v4016 · Marcel 23.11.2026: beim Wechsel der Jahre blieb im Reiter „Jahresabgleich 2025 · 2/4" stehen. Die Marke
     folgt jetzt dem gewählten Jahr (vor dem ersten Öffnen: dem Vorjahr, wie die Auswahl) und sagt es in Worten. */
  function gewaehltesJahr(Z) {
    var jahre = Z.map(function (z) { return z.jahr; });
    if (_gewaehltKey === global._currentObjKey && _gewaehlt != null && jahre.indexOf(_gewaehlt) >= 0) return _gewaehlt;
    return jahre.indexOf(heuteJahr() - 1) >= 0 ? heuteJahr() - 1 : jahre[0];
  }
  function reiterMarke() {
    var d = doc(); if (!d) return;
    var info = null;
    try {
      if (verfuegbar()) {
        var Z = JB().zeilen(), j = Z.length ? gewaehltesJahr(Z) : null, z = Z.filter(function (x) { return x.jahr === j; })[0];
        var s = z ? stand(z, mitWeg()) : null;
        if (s && j < heuteJahr()) info = { t: s.nFest === 4 ? j + ' festgeschrieben' : (s.fertig ? j + ' erledigt' : j + ' · ' + s.n + ' von 4 erledigt'), ok: s.fertig, title: standText(s, j) + (s.offen.length && s.nFest < 4 ? '. Offen: ' + s.offen.join(', ') : '') };
      }
    } catch (e) { info = null; }
    Array.prototype.forEach.call(d.querySelectorAll('.dp-pa-tab'), function (b) {
      if ((b.getAttribute('onclick') || '').indexOf("'jahr'") < 0) return;
      var m = b.querySelector('.dp-ja-marke');
      if (!info) { if (m) m.parentNode.removeChild(m); return; }
      if (!m) { m = d.createElement('span'); m.className = 'dp-ja-marke'; b.appendChild(m); }
      m.style.cssText = 'margin-left:6px;font:600 10.5px Inter,sans-serif;color:' + (info.ok ? '#2f7d52' : '#B8625C');
      m.textContent = info.t;
      m.title = info.title;
    });
  }
  function grafikOpt() { return { gewaehlt: _gewaehlt, onJahr: function (j) { if (j && j <= heuteJahr()) { _gewaehlt = j; mountAll(); } } }; }
  function mountAll() {
    var d = doc(); if (!d || !d.querySelectorAll) return;
    var hs = d.querySelectorAll('[data-dp-ja-host]');
    for (var i = 0; i < hs.length; i++) { try { hs[i].innerHTML = html(); binden(hs[i]); } catch (e) { hs[i].innerHTML = ''; try { console.warn('[jahresabgleich]', e); } catch (x) {} } }
    try { if (hs.length && global.DpJahresbuchGrafik) global.DpJahresbuchGrafik.mountAll(grafikOpt()); } catch (e) {}
    reiterMarke();
    if (hs.length && JB() && JB().mbLaden && mountAll._mb !== global._currentObjKey) {
      mountAll._mb = global._currentObjKey;
      JB().mbLaden().then(function () { setTimeout(mountAll, 0); });
    }
  }
  /** Marktbericht in der Stufe, die der Nutzer gewählt hat (höchstens sein Detailgrad - stufeAbrufen(3) tut darüber still nichts) */
  function mbAbrufen() {
    try {
      var OR = global.DealPilotObjektReiter; if (!OR || typeof OR.stufeAbrufen !== 'function') return;
      var dg = global.DpDetailgrad && global.DpDetailgrad.stufe ? global.DpDetailgrad.stufe() : 3;
      var w = typeof OR.mbWahl === 'function' ? Number(OR.mbWahl()) : NaN;
      OR.stufeAbrufen(Math.max(1, Math.min(dg || 3, isFinite(w) && w > 0 ? w : 3)));
    } catch (x) {}
  }
  function zuReiter(sec) {
    var d = doc(), t = d && d.querySelector('.tab[data-target-sec="' + sec + '"]');
    if (t) t.click();
    try { var m = d.querySelector('.main-col'); if (m) m.scrollTop = 0; global.scrollTo(0, 0); } catch (e) {}
  }
  /** In den Reiter, in dem das Feld steht (Abschnitt .sec), und dorthin rollen. ziel 'mh': Soll-Miete / Mietleiter */
  function zuMiete(ziel) {
    var d = doc(), kand = ziel === 'mh' ? ['zb_soll_qm', 'mfh-einheiten', 'mv-erh-host', 'mv_letzte_erhoehung'] : ['mv-erh-host', 'mv_letzte_erhoehung'];
    var e = null; kand.some(function (id) { var x = d.getElementById(id); if (x) { e = x; return true; } return false; });
    var sec = e && e.closest ? e.closest('.sec') : null;
    zuReiter(sec && sec.id ? sec.id : 's2');
    setTimeout(function () {
      var k = e && e.closest ? e.closest('.card,.sec-card,fieldset') : null;
      try { (k || e) && (k || e).scrollIntoView({ block: 'center' }); } catch (x) {}
      try { if (ziel === 'mh' && e && e.tagName === 'INPUT' && e.offsetParent) e.focus({ preventScroll: true }); } catch (x) {}
    }, 300);
  }
  function binden(host) {
    if (host._dpJa) return; host._dpJa = true;
    host.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-ja-aktion],[data-ja-jahr]') : null; if (!b) return;
      ev.preventDefault();
      var a = b.getAttribute('data-ja-aktion');
      if (!a) { var j = +b.getAttribute('data-ja-jahr'); if (j) { _gewaehlt = j; mountAll(); } return; }
      var y = +b.getAttribute('data-ja-j') || _gewaehlt;
      if (a === 'festschreiben' || a === 'freigeben') {   /* v4016 · ein Schritt (data-ja-schritt-k) oder das ganze Jahr */
        var k = b.getAttribute('data-ja-schritt-k');
        if (JB() && JB().festSetzen) JB().festSetzen(_gewaehlt, k ? [k] : null, a === 'festschreiben');
        mountAll(); return;
      }
      if (a === 'miete') { zuMiete(); return; }
      if (a === 'mieterhoehung') { zuMiete('mh'); return; }
      if (a === 'vivi-mh') { try { global.DpViviMieterhoehung.oeffnen({ quelle: 'pilot-analyse' }); } catch (x) {} return; }   /* v4037 */
      if (a === 'steuer') { zuReiter('s3-tax'); return; }
      if (a === 'eintragen') { if (JB() && JB().oeffnen) JB().oeffnen(y); return; }
      if (a === 'av' || a === 'erreicht') { if (JB() && JB().aktion) JB().aktion(a, y, b.getAttribute('data-ja-fassung')); return; }
      if (a === 'festhalten') { if (global.DpJahresstaende && global.DpJahresstaende.festhalten) global.DpJahresstaende.festhalten(); return; }
      if (a === 'wert') { mbAbrufen(); return; }
      if (a === 'wert-sehen' || a === 'haus-sehen') { var w = host.closest('.dp-pa-wrap'), t = w && (a === 'wert-sehen' ? w.querySelector('#dp-pa-tab-wert') : w.querySelector('.dp-pa-tab[onclick*="\'haus\'"]')); if (t) t.click(); return; }
      if (a === 'haus') { try { if (global.DpUnterlagen && global.DpUnterlagen.nachreichen) global.DpUnterlagen.nachreichen(); else if (global.DpEingang) global.DpEingang.oeffnen(); } catch (x) {} }
    });
  }
  if (global.addEventListener) {
    global.addEventListener('dp:object-ready', function () { mountAll._mb = null; _mp.key = null; setTimeout(mountAll, 950); });
    global.addEventListener('dp:erhoehungen', function () { _mp.key = null; setTimeout(mountAll, 120); });
    global.addEventListener('dp:potenzial', function () { _mp.key = null; var d = doc(); if (d && d.querySelector && d.querySelector('[data-dp-ja-host] .dp-ja')) { clearTimeout(mountAll._p); mountAll._p = setTimeout(mountAll, 200); } });
  }

  global.DpJahresabgleich = { VERSION: VERSION, stand: stand, hausStand: hausStand, hausJahr: hausJahr, erinnerung: erinnerung, mbAbrufen: mbAbrufen,
    mpRein: mpRein, mpQuellen: mpQuellen, mpJahr: mpJahr, html: html, mountAll: mountAll, verfuegbar: verfuegbar, grafikOpt: grafikOpt,
    standText: standText, viviMieteRein: viviMieteRein, viviJahr: viviJahr };   /* v4016, v4017 */
})(typeof window !== 'undefined' ? window : globalThis);
