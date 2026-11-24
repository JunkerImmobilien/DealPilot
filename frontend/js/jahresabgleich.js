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
  var VERSION = 'v4500b';
  var GOLD = 'var(--wl-c9a84c, #C9A84C)';
  /* v4090 · Marcel 23.11.2026: „ich würde die Reihenfolge ändern in Miete, Wert, Haus und dann Steuern" (die Steuer braucht die Zahlen der drei davor) */
  var SCHRITTE = [['miete', 'Miete'], ['wert', 'Wert'], ['haus', 'Haus'], ['steuer', 'Steuer']];
  var WORT = { ok: 'erledigt', teil: 'teilweise', offen: 'offen', laufend: 'läuft' };
  var _gewaehlt = null, _gewaehltKey = null, _fuehrung = {}, _eingabe = null, _frage = null;   /* v4090 · geführter Schritt je Jahr, offene Eingabe (Jahr) */

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
    /* v4100 · Hausgeld des Jahres laut ViVi zählt als Teil-Ist (Protokoll und Abrechnung liefert ViVi nicht) */
    var vivi = h.hg_quelle === 'vivi' && istZahl(h.hg_ist_j);
    return da && papier ? 'ok' : (da || papier || vivi ? 'teil' : (lauf ? 'laufend' : 'offen'));
  }
  /* ── v4100 · Hausgeld des Jahres aus ViVi ──────────────────────────
     Marcel 23.11.2026: „im Schritt 3 unter Unterlagen hochladen sollten wir bei einer ViVi-Anbindung den Abgleich machen“.
     ViVi liefert je Steuerjahr die Belege der Anlage V (stand.steuer[jahr], viviSteuer.js). Das Hausgeld steht dort in den
     Zeilen umgelegte und nicht umgelegte Kosten, erkannt am Text wie im Backend (RE_HAUSGELD, bewirtschaftungAus).
     Nur gelesen, nie geschrieben. Eigene Angaben und die Abrechnung schlagen ViVi, ein festgeschriebener Haus-Schritt
     bleibt, wie er ist. */
  var RE_HAUSGELD = /hausgeld|\(vorauszahlung\)|\(nicht umlagef/i;
  function hgViviRein(sj) {
    if (!sj || typeof sj !== 'object') return null;
    var s = 0, n = 0;
    ['nk_umlf', 'nk_n_umlf'].forEach(function (sp) {
      var z = sj[sp]; if (!z || !Array.isArray(z.posten)) return;
      z.posten.forEach(function (p) { if (p && RE_HAUSGELD.test(String(p.text || '')) && istZahl(p.betrag)) { s += p.betrag; n++; } });
    });
    return n ? Math.round(s * 100) / 100 : null;
  }
  function viviStand() { try { return global.DpVivi && global.DpVivi.stand ? global.DpVivi.stand() : null; } catch (e) { return null; } }
  function viviVerknuepft() { var v = viviStand(); return !!(v && v.verknuepft); }
  function viviHgJahr(jahr) { var v = viviStand(); return v && v.steuer ? hgViviRein(v.steuer[jahr] || v.steuer[String(jahr)]) : null; }
  /** Rein: Haus des Jahres mit dem Hausgeld aus ViVi ergänzen (nur wo kein eigener Wert steht und der Schritt nicht fest ist) */
  function hausMitViviRein(h, hgVivi, fest) {
    if (!h) return h;
    if (istZahl(h.hg_ist_j)) { h.hg_quelle = h.hg_quelle || 'eigen'; return h; }
    if (!fest && istZahl(hgVivi)) { h.hg_ist_j = hgVivi; h.hg_quelle = 'vivi'; }
    return h;
  }
  /** Stand je Schritt für ein Jahr (z = Zeile aus DpJahresbuch.zeilen()) */
  function stand(z, weg, L) {
    if (!z) return null;
    var lauf = z.jahr >= heuteJahr(), h = hausMitViviRein(hausJahr(z.jahr, L), lauf ? null : viviHgJahr(z.jahr), !!festJahr(z.jahr).haus), s = {};
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
  /* v4500 · § 558 zu einem beliebigen Tag (01.01. oder Tag einer Erhöhung): letzte Erhöhung VOR dem Tag, Miete istAm */
  function sollAm(q, L, iso, istAm, ctx, K, E) {
    var letzte = null, betrag = null;
    if (L.length) {
      var bis = L.filter(function (x) { return x.datum < iso; });
      var ab = E.ableiten(bis, iso); letzte = ab.letzte; betrag = ab.betrag;
      if (!letzte && /^\d{4}-\d{2}-\d{2}$/.test(String(q.letzte || '')) && q.letzte < iso && q.letzte < L[0].datum) { letzte = q.letzte; betrag = zahl(q.betrag); }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.letzte || '')) && q.letzte < iso) { letzte = q.letzte; betrag = zahl(q.betrag); }
    return K.sollFuer({ ist: istAm, wfl: q.wfl, status: 'vermietet', vgl_qm: q.vgl_eigen || '', mv_art: q.mv_art || '', art: q.art || 'wohnen',
      mv_letzte_erhoehung: letzte || '', mv_letzte_erhoehung_betrag: betrag != null ? betrag : '', massnahmen: [] },
      { kapp: ctx && ctx.kapp, vgl_qm: q.vgl_qm, vgl_art: q.vgl_art || null, heute: iso.slice(0, 7) });
  }
  function tagDavor(iso) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
  /* v4500 · Marcel 24.11.2026 (Demostraße 5, 2025): „zulässig sagt er, wir sind drüber … verstehe ich nicht“. Gemessen: die
     Spalte verglich die Kaltmiete des GANZEN Jahres mit der zum 01.01. zulässigen Miete × 12. Jede Erhöhung im Lauf des
     Jahres sah damit wie „darüber“ aus, auch eine erlaubte. Jetzt: je Monat die zulässige Miete (vor dem Termin die Miete
     am 01.01., ab Wirksamkeit die § 558-Grenze, ab einer eingetragenen Erhöhung ihr Betrag, höchstens die am Tag der
     Erhöhung zulässige Miete), und jede § 558-Erhöhung des Jahres wird an ihrem eigenen Tag geprüft (ueber_erh).
     opt.monate: Monate ab Übergang (Kaufjahr), sonst 12. */
  function mpRein(quellen, jahr, ctx, K, E, opt) {
    var iso = jahr + '-01-01';
    var mon = opt && opt.monate != null ? Math.max(0, Math.min(12, opt.monate)) : 12, vonM = 13 - Math.max(1, mon || 12);
    var r = { jahr: jahr, stichtag: iso, ist: 0, zul: 0, plus: 0, ungenutzt_jahr: 0, verlangbar_ab: null, wirksam_ab: null, genutzt: [], wohnungen: [], ohne_vgl: false, sperre: false, n: 0, zul_jahr: 0, monate: mon, ueber_erh: [] };
    if (!K || !E || !K.sollFuer) return r;
    (quellen || []).forEach(function (q) {
      if (!q || !(zahl(q.heute) > 0)) return;
      var L = E.sortiert ? E.sortiert(q.liste) : (q.liste || []);
      var ist0 = E.mieteMonat({ liste: L, heute: q.heute, letzte: q.letzte, betrag: q.betrag }, iso);
      if (!(ist0 > 0)) return;
      var s = sollAm(q, L, iso, ist0, ctx, K, E);
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
      /* v4500 · Erhöhungen des Jahres an ihrem Tag prüfen, zulässige Miete je Monat summieren */
      var stufen = [];
      L.filter(function (x) { return String(x.datum).slice(0, 4) === String(jahr) && istZahl(zahl(x.auf)); }).forEach(function (x) {
        var d = String(x.datum), mo = +d.slice(5, 7) + (+d.slice(8, 10) > 1 ? 1 : 0), auf = zahl(x.auf), grenze = auf;
        if (!x.art || String(x.art) === '558') {
          var vor = E.mieteMonat({ liste: L, heute: q.heute, letzte: q.letzte, betrag: q.betrag }, tagDavor(d));
          if (vor > 0) {
            var sx = sollAm(q, L, d, vor, ctx, K, E), zx = sx.miete != null ? K.teil558(sx, vor) : vor;
            if (auf > zx + 0.5) { grenze = zx; r.ueber_erh.push({ nr: q.nr || '', datum: d, von: Math.round(vor * 100) / 100, auf: auf, zul: Math.round(zx * 100) / 100, grund: sx.grund || null }); }
          }
        }
        if (mo <= 12) stufen.push({ ab: mo, wert: grenze });
      });
      w.zul_jahr = 0;
      if (mon > 0) for (var k = vonM; k <= 12; k++) {
        var ymk = jahr + '-' + String(k).padStart(2, '0'), erl = (w.wirksam_ab && ymk >= w.wirksam_ab) ? zul : ist0;
        stufen.forEach(function (st) { if (k >= st.ab && st.wert > erl) erl = st.wert; });
        w.zul_jahr += erl;
      }
      w.zul_jahr = Math.round(w.zul_jahr * 100) / 100;
      r.zul_jahr += w.zul_jahr;
      if (s.grund === 'Keine Vergleichsmiete eingetragen.') r.ohne_vgl = true;
      if (w.sperre) r.sperre = true;
      r.ist += w.ist; r.zul += w.zul; r.plus += w.plus; r.ungenutzt_jahr += w.ungenutzt_jahr; r.n++;
      r.genutzt = r.genutzt.concat(w.genutzt);
      if (w.verlangbar_ab && (!r.verlangbar_ab || w.verlangbar_ab < r.verlangbar_ab)) r.verlangbar_ab = w.verlangbar_ab;
      if (w.wirksam_ab && (!r.wirksam_ab || w.wirksam_ab < r.wirksam_ab)) r.wirksam_ab = w.wirksam_ab;
      r.wohnungen.push(w);
    });
    r.ist = Math.round(r.ist * 100) / 100; r.zul = Math.round(r.zul * 100) / 100; r.zul_jahr = Math.round(r.zul_jahr); r.plus = Math.round(r.plus * 100) / 100;
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
    if (!_mp.jahre[jahr]) _mp.jahre[jahr] = mpRein(_mp.q.quellen, jahr, _mp.q.ctx, global.DpMietpotenzial, global.DpErhoehungen, { monate: monateJahr(jahr) });
    return _mp.jahre[jahr];
  }
  /* v4410 · Marcel 24.11.2026 (Westerfeldstr. 146, 2026): „Kaltmiete 39.420, zulässig 39.388, ungenutzt. Und darüber
     Mieterhöhung 2026 +87 €/Monat. Das passt ja gar nicht.“ Gemessen: die Spalte Kaltmiete trägt die GANZE Kaltmiete
     ((3.195 Wohnungen + 90 Stellplätze/Zuschläge) × 12 = 39.420), „zulässig § 558“ nur die Wohnungen (3.282,35 × 12 = 39.388).
     Die +87 €/Monat sind richtig (Whg. 3 bis 6 haben Luft), nur der Vergleich lief auf zwei Grundlagen. Jetzt eine Rechnung:
     zulässig GESAMT = zulässige Wohnungsmiete + übrige Miete (Stellplätze, Zuschläge, unverändert). Liegt die Kaltmiete des
     Jahres dennoch über dem zulässigen Gesamtbetrag, wird keine Mieterhöhung angeboten (Hinweis statt „ungenutzt“). */
  function monateJahr(jahr) {   /* v4500 · Monate ab Übergang wie die Ist-Miete des Jahresbuchs (anteilig.js) */
    try { var A = global.DealPilotAnteilig; if (A && typeof A.getWuMonths === 'function') { var n = Number(A.getWuMonths(+jahr)); if (isFinite(n)) return Math.max(0, Math.min(12, n)); } } catch (e) {}
    return 12;
  }
  function zusatzMonat() {
    var d = doc(), e = d && d.getElementById('ze'), s = e ? String(e.value || '').trim() : '';
    var v = typeof global.v === 'function' && e ? zahl(global.v('ze')) : (s.indexOf(',') >= 0 ? zahl(s.replace(/\./g, '').replace(',', '.')) : zahl(s));   /* calc.js v() wie die Kaltmiete */
    return v != null && v > 0 ? v : 0;
  }
  function mpUrteil(mp, zus, mieteJahr) {
    zus = zahl(zus) > 0 ? zahl(zus) : 0;
    /* v4500 · mit zul_jahr (Monat für Monat, mpRein) statt „zulässig am 01.01. × 12“, sonst wie bisher */
    var mon = istZahl(mp.monate) ? mp.monate : 12, jz = istZahl(mp.zul_jahr) && mp.zul_jahr > 0;
    var r = { zul_j: Math.round((jz ? mp.zul_jahr : mp.zul * mon) + zus * mon), wohn_zul_j: Math.round(jz ? mp.zul_jahr : mp.zul * mon), wohn_ist_j: Math.round(mp.ist * mon), zus_j: Math.round(zus * mon),
      luft_m: Math.max(0, Math.round(mp.zul - mp.ist)), ueber: false, erh: (mp.ueber_erh || []).slice() };
    if (r.erh.length || (istZahl(mieteJahr) && mieteJahr > r.zul_j + 6)) { r.ueber = true; r.luft_m = 0; }
    return r;
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
    /* v4037 · auch der Rechenweg ohne Ist-Jahre (laufendes Jahr): Zusatzeinnahmen aus DealPilot je Monat dazu, ViVi kennt
       nicht alle. Sonst stand bei 2026-1041 eine Differenz von genau 12 × 90 € in der Spalte „laut ViVi“. */
    if (istZahl(out.miete)) { var zeL = zahl((doc() && doc().getElementById('ze') || {}).value) || 0; if (zeL > 0) out.miete = Math.round((out.miete + zeL * (13 - ab)) * 100) / 100; }
    /* v4220 · Fork S (v4210): ViVi meldet je Jahr, ob der Mietverlauf das Jahr ganz abdeckt (abgedeckt, luecken).
       Ein Jahr, das ViVi nicht vollständig kennt (vor dem Anlegen in ViVi, fehlende Vormieter), liefert keine Summe. */
    if (ij && ij.summe && ij.summe[String(jahr)] && ij.summe[String(jahr)].abgedeckt === false) {
      out.miete = null; out.luecken = (ij.luecken || {})[String(jahr)] || []; out.unvollstaendig = true;
    } else if (ij && ij.summe && ij.summe[String(jahr)] && ij.summe[String(jahr)].abgedeckt !== false && istZahl(zahl(ij.summe[String(jahr)].miete))) {
      /* wie vivi-felder: Kaltmiete aus ViVi plus Zusatzeinnahmen aus DealPilot je vermietetem Monat */
      var xj = ij.summe[String(jahr)], zeD = zahl((doc() && doc().getElementById('ze') || {}).value) || 0;
      out.miete = istZahl(zahl(xj.kalt)) ? Math.round((zahl(xj.kalt) + zeD * (istZahl(zahl(xj.monate_vermietet)) ? zahl(xj.monate_vermietet) : 12)) * 100) / 100 : zahl(xj.miete);
    }
    out.gezahlt = ij && ij.gezahlt && istZahl(zahl(ij.gezahlt[String(jahr)])) ? zahl(ij.gezahlt[String(jahr)]) : null;
    out.soll_warm = ij && ij.soll_warm && istZahl(zahl(ij.soll_warm[String(jahr)])) ? zahl(ij.soll_warm[String(jahr)]) : null;
    (info.sondertilgungen || []).forEach(function (x) { if (x && String(x.datum || '').slice(0, 4) === String(jahr)) out.st.push(x); });
    if (jahr === heuteJahr() && info.restschuld_heute && istZahl(info.restschuld_heute.wert)) out.rs = info.restschuld_heute;
    return out;
  }
  /* v4220 · B9: Lücken des ViVi-Mietverlaufs als Satz. luecken = [{ einheit, monate }], monate = Liste oder Zahl */
  function lueckenText(l) {
    var t = (Array.isArray(l) ? l : []).map(function (x) {
      var n = Array.isArray(x && x.monate) ? x.monate.length : zahl(x && x.monate);
      return (x && x.einheit ? 'Wohnung ' + x.einheit : 'Objekt') + (istZahl(n) && n > 0 ? ' ' + n + (n === 1 ? ' Monat' : ' Monate') : '');
    }).filter(Boolean);
    return t.length ? t.join(', ') : '';
  }
  /** v4220 · B9: kennt ViVi das Jahr nicht vollständig? { text } oder null. Für Assistent und Reiter ViVi. */
  function viviLuecke(jahr) {
    var vd = null; try { vd = viviDaten(); } catch (e) { vd = null; }
    var vj = vd ? viviJahr(+jahr, vd) : null;
    if (!vj || !vj.unvollstaendig) return null;
    var lt = lueckenText(vj.luecken);
    return { luecken: vj.luecken || [], text: 'ViVi kennt ' + jahr + ' nicht vollständig' + (lt ? ' (es fehlen ' + lt + ')' : '') + '. Die Summe laut ViVi wird deshalb nicht angeboten.' };
  }
  /* v4042 · Marcel 23.11.2026: keine Doppelung mit dem Reiter ViVi. Im Jahresabgleich nur noch eine Zeile je Jahr mit der
     Zahl der Abweichungen (gezählt wie im Reiter, DpViviReiter.abweichungen) und dem Absprung dorthin. Was dort nicht
     steht, bleibt als kurzer Zusatz: weniger Miete eingegangen als vereinbart. viviBlockAlt ist die Fassung bis v4041. */
  function viviHtml(z, vd) {
    var R = global.DpViviReiter; if (!vd || !R || !R.abweichungen || !R.sichtbar || !R.sichtbar()) return '';
    var n = R.abweichungen(z.jahr); if (n == null) return '';
    var vj = null; try { vj = viviJahr(z.jahr, vd); } catch (e) { vj = null; }
    var zu = '';
    if (vj && vj.gezahlt != null && vj.soll_warm != null && vj.soll_warm > 0 && vj.gezahlt / vj.soll_warm < 0.97) zu = ' <span class="dp-ja-schlecht">' + Math.round((1 - vj.gezahlt / vj.soll_warm) * 100) + ' % weniger Miete eingegangen als vereinbart.</span>';
    return '<div class="dp-ja-vivi dp-ja-vivi-kurz" data-ja-vivi="' + z.jahr + '"><span><b>ViVi:</b> ' + (n ? '<span class="dp-ja-schlecht">' + n + (n === 1 ? ' Abweichung' : ' Abweichungen') + '</span>' : '<span class="dp-ja-gut">stimmt mit ViVi überein</span>') + zu + '</span>'
      + knopf('vivi-reiter', n ? 'zum Abgleich' : 'ansehen', false, z.jahr) + '</div>';
  }
  /* v4500 · Marcel 24.11.2026: „zwei Abweichungen zeigt er mir im Jahresabgleich. Was sollen das für Abweichungen sein?“
     Gemessen: die Zahl ist DpViviReiter.abweichungen(jahr), also Positionen der Anlage V, die von ViVi abweichen, plus die
     Jahresmiete. Die eigene Zeile über der Mieterhöhung entfällt. Die Zahl steht jetzt im Schritt Steuer als Knopf zum Reiter
     ViVi („2 Abweichungen zu ViVi“), der Hinweis „weniger Miete eingegangen“ im Schritt Miete. */
  function viviKurz(z, vd) {
    var R = global.DpViviReiter; if (!vd || !R || !R.abweichungen || !R.sichtbar || !R.sichtbar()) return null;
    var n = null; try { n = R.abweichungen(z.jahr); } catch (e) { n = null; }
    if (n == null) return null;
    var vj = null; try { vj = viviJahr(z.jahr, vd); } catch (e) { vj = null; }
    var weniger = vj && vj.gezahlt != null && vj.soll_warm != null && vj.soll_warm > 0 && vj.gezahlt / vj.soll_warm < 0.97 ? Math.round((1 - vj.gezahlt / vj.soll_warm) * 100) : 0;
    return { n: n, weniger: weniger };
  }
  function viviBlockAlt(z, vd) {
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
      /* v4150 · ein Jahr-Knopf an der Jahresauswahl, Karten ohne Knöpfe und ganz anklickbar */
      '.dp-ja-jk{margin-left:auto;display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}.dp-ja-erg>.dp-ja-jk-t{margin-left:auto}',
      '.dp-ja-jk-t{display:inline-flex;align-items:center;gap:5px;font:500 12px Inter,sans-serif;color:' + M + '}',
      '.dp-pa-wrap .dp-ja-jk button.dp-ja-fest{margin-left:0}',
      '.dp-ja-schritt:hover{background:color-mix(in srgb, ' + GOLD + ' 4%, #fff)}.dp-ja-schritt:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:-2px}',
      '.dp-pa-wrap .dp-ja-schritt button.dp-ja-fest{margin-top:2px}',
      '.dp-ja-vivi{border:1px solid ' + LI + ';border-radius:10px;padding:10px 16px;margin-top:12px;background:#fff;display:flex;flex-direction:column;gap:4px}',
      '.dp-ja-vivi.dp-ja-vivi-kurz{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;padding:6px 6px 6px 16px}',   /* v4042b · eine Zeile */
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
      /* v4500 · Anlage-V-Aktion in der Zeile, Hilfe im Spaltenkopf */
      '.dp-ja-tab .dp-ja-av{display:block;margin:3px 0 0 auto;padding:1px 7px;border:1px solid var(--wl-c9a84c, #C9A84C);border-radius:999px;background:transparent;color:' + T + ';font:500 10.5px/1.5 Inter,sans-serif;cursor:pointer;white-space:nowrap}',
      '.dp-ja-tab .dp-ja-av:hover{background:color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 14%,transparent)}',
      '.dp-ja-tab th .dp-tip{margin-left:3px;vertical-align:middle}',
      '.dp-ja-tab td small.dp-ja-schlecht{color:#B8625C}', '.dp-ja-tab td small.dp-ja-gut{color:#2f7d52}',
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
      /* v4090 · geführter Ablauf, aktiver Schritt, Eingabe im Reiter, Sprungziel */
      '.dp-ja-fuehrung{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px 18px;align-items:center;border:1px solid ' + GOLD + ';border-radius:10px;padding:10px 14px;margin:0 0 10px;background:color-mix(in srgb, ' + GOLD + ' 6%, #fff)}',
      '.dp-ja-fuehrung.fertig{border-color:rgba(63,165,108,.45);background:color-mix(in srgb, #3FA56C 6%, #fff);grid-template-columns:auto minmax(0,1fr)}',
      '.dp-ja-f-p{display:flex;gap:4px;margin:0;padding:0;list-style:none}',
      '.dp-pa-wrap .dp-ja-f-p button{display:inline-flex !important;align-items:center;gap:6px;padding:4px 9px 4px 5px !important;min-height:0 !important;height:auto !important;border-radius:14px !important;border:1px solid ' + LI + ' !important;background:#fff !important;font:500 12px Inter,sans-serif !important;color:' + M + ' !important;cursor:pointer;box-shadow:none !important}',
      '.dp-pa-wrap .dp-ja-f-p button.an{border-color:' + GOLD + ' !important;color:' + T + ' !important;font-weight:600 !important;box-shadow:0 0 0 2px color-mix(in srgb, ' + GOLD + ' 25%, transparent) !important}',
      '.dp-ja-f-p i{font-style:normal;width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font:600 10.5px Inter,sans-serif;background:rgba(42,39,39,.07);color:' + T + '}',
      '.dp-ja-f-p .dp-ja-f-ok i{background:#3FA56C;color:#fff}.dp-ja-f-p .dp-ja-f-teil i{background:#C99A2E;color:#fff}.dp-ja-f-p .dp-ja-f-offen i{background:rgba(184,98,92,.14);color:#B8625C}',
      '.dp-ja-f-t{display:flex;flex-direction:column;gap:2px;font:400 13px/1.45 Inter,sans-serif;color:' + T + ';min-width:0}',
      '.dp-ja-f-k{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
      '.dp-pa-wrap .dp-ja-f-k button.dp-ja-f-nav{color:' + M + ' !important}',
      '.dp-ja-schritt{cursor:pointer;transition:background .15s}.dp-ja-schritt.dp-ja-akt{background:color-mix(in srgb, ' + GOLD + ' 7%, #fff);box-shadow:inset 0 3px 0 ' + GOLD + '}',
      '.dp-ja-eingabe{margin-top:10px}.dp-ja-eingabe-k{display:flex;align-items:baseline;gap:10px;margin:0 0 -4px;flex-wrap:wrap}.dp-ja-eingabe-k b{font:600 14px "Space Grotesk",Inter,sans-serif;color:' + T + '}.dp-ja-eingabe-k span{font-size:12px;color:' + M + '}',
      '.dp-pa-wrap .dp-ja button.dp-ja-ein-x{margin-left:auto;background:none !important;border:none !important;box-shadow:none !important;font-size:16px !important;min-height:30px !important;padding:0 6px !important;color:' + M + ' !important;cursor:pointer}',
      '.dp-ja-fh{display:inline-flex;align-items:center;gap:4px}',
      '.dp-ja-frage{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px;border:1px solid #B8625C;border-radius:10px;padding:10px 14px;margin:0 0 10px;background:color-mix(in srgb, #B8625C 6%, #fff);font:400 13px/1.45 Inter,sans-serif;color:' + T + '}',
      '.dp-ja-prot{font:400 11.5px Inter,sans-serif;color:' + LE + ';margin:-4px 0 10px}',
      /* v4100 · Jahreswechsel und Knopf „fertig machen“ */
      '.dp-ja-wechsel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 14px;border:1px solid ' + GOLD + ';border-radius:10px;padding:8px 8px 8px 14px;margin:0 0 10px;background:var(--gold-bg, color-mix(in srgb, ' + GOLD + ' 8%, #fff));font:400 13px/1.45 Inter,sans-serif;color:' + T + '}',
      '@keyframes dpJaBlink{0%,100%{box-shadow:0 0 0 0 transparent}20%,60%{box-shadow:0 0 0 4px color-mix(in srgb, ' + GOLD + ' 45%, transparent)}}',
      '.dp-ja-blink{animation:dpJaBlink 1.3s ease-in-out 2;border-radius:8px}',
      /* v4560 · Zeitstrahl über die Finanzierungsdauer, kleine Karten, Knopfleiste darunter, Mieterhöhung als Kennzahlen */
      '.dp-ja-erg{flex-wrap:nowrap;align-items:flex-end;gap:14px;padding:2px 0 12px;margin-bottom:12px}',
      '.dp-ja-strahl{flex:1 1 auto;min-width:0;display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;padding:2px 0 2px}',
      '.dp-pa-wrap .dp-ja-strahl button.dp-ja-sj{flex:1 0 50px;display:flex !important;flex-direction:column;align-items:center;gap:3px;position:relative;background:none !important;border:none !important;box-shadow:none !important;padding:0 2px 4px !important;min-height:0 !important;height:auto !important;border-radius:8px !important;cursor:pointer;color:' + T + ' !important}',
      '.dp-ja-sj::before{content:"";position:absolute;top:8px;left:0;right:0;height:2px;background:' + RA + '}',
      '.dp-ja-sj:first-child::before{left:50%}.dp-ja-sj:last-child::before{right:50%}',
      '.dp-ja-sp{position:relative;z-index:1;width:18px;height:18px;border-radius:50%;box-sizing:border-box;border:2px solid ' + RA + ';background:#fff;display:grid;place-items:center;color:#fff}',
      '.dp-ja-sp svg{width:9px;height:9px}',
      '.dp-ja-sj.ok .dp-ja-sp,.dp-ja-sj.fest .dp-ja-sp{background:#3FA56C;border-color:#3FA56C}',
      '.dp-ja-sj.teil .dp-ja-sp{background:#C99A2E;border-color:#C99A2E}',
      '.dp-ja-sj.offen .dp-ja-sp{background:#fff;border-color:#B8625C}',
      '.dp-ja-sj.laeuft .dp-ja-sp{background:#fff;border-color:' + GOLD + ';box-shadow:0 0 0 3px color-mix(in srgb, ' + GOLD + ' 22%, transparent)}',
      '.dp-ja-sj b{font:600 12.5px Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.dp-ja-sj small{font:500 9.5px "JetBrains Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:' + LE + ';white-space:nowrap}',
      '.dp-ja-sj .dp-ja-mini{height:10px}',
      '.dp-pa-wrap .dp-ja-strahl button.dp-ja-sj.kommt{cursor:default;opacity:.45}',
      '.dp-pa-wrap .dp-ja-strahl button.dp-ja-sj[aria-pressed="true"]{background:color-mix(in srgb, ' + GOLD + ' 13%, #fff) !important}',
      '.dp-ja-sj[aria-pressed="true"] b{text-decoration:underline;text-decoration-color:' + GOLD + ';text-decoration-thickness:2px;text-underline-offset:3px}',
      '.dp-pa-wrap .dp-ja-strahl button.dp-ja-sj:not(.kommt):hover{background:color-mix(in srgb, ' + GOLD + ' 7%, #fff) !important}',
      '.dp-ja-erg>.dp-ja-jk{flex:0 0 auto;margin-left:0;padding-bottom:6px}',
      '.dp-ja-schritt{padding:10px 14px;gap:2px}',
      '.dp-ja-schritte .dp-ja-w{font-size:17px}',
      '.dp-ja-fuehrung{grid-template-columns:minmax(0,1fr) auto;padding:7px 10px 7px 14px;margin:8px 0 0}',
      '.dp-ja-fuehrung.fertig{grid-template-columns:1fr}',
      '.dp-ja-pot{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"k p n" "k b n" "r r r";gap:8px 20px;padding:12px 16px}',
      '.dp-ja-pot-k{grid-area:k;display:flex;flex-direction:column;gap:2px}.dp-ja-pot-k small{font-size:11px;color:' + LE + '}',
      '.dp-ja-pks{grid-area:p;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}',
      '.dp-ja-pk{display:flex;flex-direction:column;gap:1px;min-width:0;cursor:help}',
      '.dp-ja-pk b{font:600 15px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums;color:' + T + ';white-space:nowrap}',
      '.dp-ja-pk b.dp-ja-gold-t{color:#8a6d1f}',
      '.dp-ja-pot>.dp-ja-balken{grid-area:b;height:6px}',
      '.dp-ja-pot-kn{grid-area:n}',
      '.dp-ja-pot-rot{grid-area:r;font:500 12px Inter,sans-serif}',
      '@media (max-width:760px){.dp-ja-erg{flex-wrap:wrap}.dp-ja-erg>.dp-ja-jk{flex:1 1 100%}.dp-pa-wrap .dp-ja-strahl button.dp-ja-sj{flex:0 0 52px}'
        + '.dp-ja-pot{grid-template-columns:1fr;grid-template-areas:"k" "p" "b" "n" "r"}.dp-ja-pks{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-ja-schritt{padding:9px 10px}}',
      '@media (max-width:760px){.dp-ja-fuehrung{grid-template-columns:1fr;padding:10px}.dp-ja-f-p{flex-wrap:nowrap}.dp-ja-f-k{justify-content:flex-start}.dp-ja-f-p button:not(.an) .w{display:none}.dp-pa-wrap .dp-ja-f-p button:not(.an){padding:4px !important}}',   /* v4090b · am Handy nur der aktive Schritt mit Wort */
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
  /* v4150 · Marcel 23.11.2026: „in den Karten Miete, Wert, Haus und Steuern die Buttons rausnehmen … weil wir ja oben drüber
     schon die Buttons angeben. Und wir können das ja auch anklicken.“ Die Karte zeigt nur noch Stand, Wert und Satz und ist
     ganz anklickbar (Klick = Schritt wählen). Ihre Knöpfe merkt sich _kn, die Führungsleiste zeigt sie. */
  var _kn = {};
  function schritt(k, titel, s, wert, vgl, text, kn, jahr) {
    _kn[k] = kn || '';
    var nr = SCHRITTE.map(function (x) { return x[0]; }).indexOf(k) + 1, fest = s.fest && s.fest[k], lauf = jahr >= heuteJahr();
    var stW = fest ? 'festgeschrieben' : WORT[s[k]];
    var festKn = '', _alt = lauf ? '' : (fest
      ? '<button type="button" class="btn-clean dp-ja-fest an" data-ja-aktion="freigeben" data-ja-schritt-k="' + k + '" title="Festgeschrieben am ' + esc(datumText(fest)) + '. Wieder freigeben, um ' + titel + ' ' + jahr + ' zu ändern.">' + SCHLOSS + ' wieder freigeben</button>'
      : '<button type="button" class="btn-clean dp-ja-fest" data-ja-aktion="festschreiben" data-ja-schritt-k="' + k + '" title="' + titel + ' ' + jahr + ' abschließen. Danach lässt sich der Schritt nicht mehr ändern, bis er freigegeben ist.">' + SCHLOSS + ' festschreiben</button>');
    /* v4560 · Marcel 24.11.2026: „Karten total verzerrt … viel zu viel Information“. Die Karte zeigt nur Titel, Stand, Zahl
       und Vergleich, der Satz steht im Überfahren (title). Knöpfe stehen nur in der Leiste darüber (_kn je Schritt). */
    var tt = String(text || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return '<div class="dp-ja-schritt' + (fest ? ' fest' : '') + '" data-ja-schritt="' + k + '" data-ja-k="' + k + '" title="' + esc(titel + ' ' + jahr + ': ' + stW + '. ' + tt) + '"><div class="dp-ja-kk"><span class="dp-ja-nr">' + nr + '</span><b>' + titel + '</b><span class="st dp-ja-st-' + (fest ? 'fest' : s[k]) + '">' + stW + '</span></div>'
      + '<div class="dp-ja-w">' + wert + '</div><div class="dp-ja-vgl">' + vgl + '</div></div>';
  }
  function abschnitt(t, eti) { return '<div class="dp-ja-abs"><h4>' + t + '</h4>' + (eti ? '<span class="dp-ja-eti">' + eti + '</span>' : '') + '</div>'; }

  function potenzialHtml(z, lauf) {
    var mp = mpJahr(z.jahr);
    if (!mp || !mp.n) return '';
    var zus = zusatzMonat(), U = mpUrteil(mp, zus, z.miete_ist);   /* v4410 */
    var ungenutzt = U.luft_m, quote = mp.zul > 0 ? Math.min(100, Math.round(mp.ist / mp.zul * 100)) : 100;
    var gen = mp.genutzt.filter(function (x) { return istZahl(x.auf); });
    var genT = gen.length ? ' ' + (gen.length === 1 ? 'Erhöhung' : 'Erhöhungen') + ' ' + gen.map(function (x) { return (x.nr ? 'Whg. ' + esc(x.nr) + ' ' : '') + 'auf ' + eur(x.auf) + ' ab ' + mmjj(x.datum); }).join(', ') + ' eingetragen.' : '';
    var t = 'Zum 01.01.' + z.jahr + ' zulässig nach § 558 BGB' + (zus > 0 ? ' für die Wohnungen' : '') + ': <b>' + eur(mp.zul) + '</b> im Monat, eingetragen <b>' + eur(mp.ist) + '</b>'
      + (ungenutzt > 0 && mp.verlangbar_ab ? ', verlangbar ab ' + mmjj(mp.verlangbar_ab) + ', wirksam ab ' + mmjj(mp.wirksam_ab) : '') + '.'
      + (mp.wohnungen.length > 1 ? ' Summe aus ' + mp.wohnungen.length + ' Wohnungen' + (mp.wohnungen.filter(function (w) { return w.plus > 0.5; }).length ? ', Luft in ' + mp.wohnungen.filter(function (w) { return w.plus > 0.5; }).map(function (w) { return 'Whg. ' + esc(w.nr); }).join(', ') : '') + '.' : '')
      + genT
      + (ungenutzt > 0 && mp.ungenutzt_jahr > 0 && !lauf ? ' Nicht genutzt im Jahr: <b>' + eur(mp.ungenutzt_jahr) + '</b>.' : '')
      + (ungenutzt > 0 && mp.ungenutzt_jahr > 0 && lauf ? ' Bis Jahresende ohne Erhöhung: ' + eur(mp.ungenutzt_jahr) + ' weniger.' : '')
      + (mp.ohne_vgl ? ' Für ' + (mp.wohnungen.length > 1 ? 'einen Teil der Wohnungen' : 'die Wohnung') + ' ist keine Vergleichsmiete bekannt, dort rechnet § 558 nicht (Mietspiegel im Reiter Miete eintragen).' : '')
      + (mp.sperre ? ' Die Erhöhung davor ist nicht eingetragen, die Sperrfrist ist nicht geprüft.' : '')
      + (zus > 0 ? ' Stellplätze und Zuschläge (' + eur(zus) + ' im Monat) kommen unverändert dazu, zusammen zulässig ' + eur(U.zul_j) + ' im Jahr.' : '')
      + (U.erh.length ? ' ' + U.erh.map(function (x) { return 'Die Erhöhung ' + (x.nr ? 'Whg. ' + esc(x.nr) + ' ' : '') + 'zum ' + datumText(x.datum) + ' auf ' + eur(x.auf) + ' liegt über der an diesem Tag nach § 558 BGB zulässigen Miete von ' + eur(x.zul) + (x.grund ? ' (' + esc(String(x.grund).replace(/.$/, '')) + ')' : '') + '.'; }).join(' ')
          + ' Prüf die Mieterhöhung oder die Vergleichsmiete im Reiter Miete. War es eine Neuvermietung, Index- oder Staffelmiete, trag sie dort mit dieser Art ein.'
        : (U.ueber ? ' Die Kaltmiete ' + z.jahr + ' von ' + eur(z.miete_ist) + ' liegt über der zulässigen Miete von ' + eur(U.zul_j) + ' im Jahr. Eine Mieterhöhung ist nicht möglich.' : ''))
      + (ungenutzt <= 0 && !gen.length && !U.ueber ? ' ' + esc((mp.wohnungen[0] && mp.wohnungen[0].grund) || 'Die Miete liegt an der zulässigen Grenze.') : '');
    /* im Jahr genutzt: die Erhöhung ist eingetragen und es blieb (fast) nichts liegen */
    var genutzt = !lauf && ungenutzt > 0 && gen.length && mp.ungenutzt_jahr <= Math.max(5, ungenutzt * 1.2);
    var wort = genutzt ? 'genutzt' : (ungenutzt > 0 ? vz(ungenutzt) + ' / Monat' : (U.ueber ? 'über der Grenze' : 'ausgeschöpft'));
    if (genutzt) ungenutzt = 0;   /* v4220 · B15: festgeschriebene Miete des Jahres bietet keine Mieterhöhung mehr an (Knöpfe unten) */
    /* v4560 · Marcel 24.11.2026: „die Kachel Mieterhöhung, diese Bullet Points, das sieht scheiße aus“. Jetzt vier kleine
       Kennzahlen (eingetragen, zulässig, Luft, ab wann) mit Balken, die ganze Rechnung im Überfahren. Nur eine Zeile bleibt
       sichtbar: wenn eine eingetragene Erhöhung über § 558 liegt (das muss man sehen). */
    var tt = String(t).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      + ' Gerechnet wie die Potenzialanalyse (Kappung, Sperrfrist, Vergleichsmiete). Frühere Jahre mit der heutigen Vergleichsmiete.';
    var kz = function (eti, wert, kl, tip) { return '<div class="dp-ja-pk"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><span class="dp-ja-eti">' + eti + '</span><b' + (kl ? ' class="' + kl + '"' : '') + '>' + wert + '</b></div>'; };
    var abW = genutzt ? 'genutzt ab ' + mmjj(gen[0].datum) : (ungenutzt > 0 && mp.wirksam_ab ? mmjj(mp.wirksam_ab) : '–');
    var abTip = genutzt ? 'Die Erhöhung ist eingetragen.' : (ungenutzt > 0 && mp.verlangbar_ab ? 'Verlangbar ab ' + mmjj(mp.verlangbar_ab) + ', wirksam ab ' + mmjj(mp.wirksam_ab) + ' (Zustimmungsfrist).' : '');
    var rot = U.erh.length ? '<div class="dp-ja-pot-rot dp-ja-schlecht">' + U.erh.map(function (x) { return 'Erhöhung zum ' + datumText(x.datum) + ' auf ' + eur(x.auf) + ' liegt über ' + eur(x.zul) + ' zulässig'; }).join(' · ') + '</div>'
      : (U.ueber ? '<div class="dp-ja-pot-rot dp-ja-schlecht">Kaltmiete ' + z.jahr + ' liegt über der zulässigen Miete</div>' : '');
    return '<div class="dp-ja-pot" data-ja-pot="' + z.jahr + '" title="' + esc(tt) + '">'
      + '<div class="dp-ja-pot-k"><span class="dp-ja-eti">Mieterhöhung ' + z.jahr + '</span>' + (mp.wohnungen.length > 1 ? '<small>' + mp.wohnungen.length + ' Wohnungen</small>' : '') + '</div>'
      + '<div class="dp-ja-pks">'
      + kz('eingetragen', eur(mp.ist), '', 'Kaltmiete der Wohnungen im Monat, wie eingetragen.')
      + kz('zulässig § 558', eur(mp.zul), '', 'Zulässig zum 01.01.' + z.jahr + ' nach Kappung, Sperrfrist und Vergleichsmiete.')
      + kz('Luft', wort, ungenutzt > 0 ? 'dp-ja-gold-t' : (U.ueber ? 'dp-ja-schlecht' : 'dp-ja-gut'), ungenutzt > 0 && mp.ungenutzt_jahr > 0 ? (lauf ? 'Bis Jahresende ohne Erhöhung ' + eur(mp.ungenutzt_jahr) + ' weniger.' : 'Im Jahr nicht genutzt: ' + eur(mp.ungenutzt_jahr) + '.') : '')
      + kz('ab', abW, '', abTip)
      + '</div>'
      + '<div class="dp-ja-balken" role="img" aria-label="eingetragen ' + quote + ' % der zulässigen Miete"><i style="width:' + quote + '%"></i></div>'
      + (ungenutzt > 0 && !(festJahr(z.jahr) || {}).miete ? '<span class="dp-ja-pot-kn">' + knopf('mieterhoehung', 'Mieterhöhung vorbereiten', true)
        + (global.DpViviMieterhoehung && global.DpViviMieterhoehung.verfuegbar() ? ' ' + knopf('vivi-mh', 'In ViVi anlegen', false) : '') + '</span>' : '')
      + rot + '</div>';
  }

  /* v4500 · Marcel 24.11.2026: „Bericht 2026 abgerufen, den hast du für 24 eingetragen“. Gemessen Demostraße 5: Bericht 616 vom
     24.11.2026, Wertermittlungsstichtag 01.03.2024 von Hand gesetzt (eigen). Er bewertet also den Kaufzeitpunkt und steht zu Recht
     unter 2024 (Regel v4390/v4430). Jetzt steht beides sichtbar da: Stichtag und Abrufdatum. */
  function anderswo(jahr) {   /* v4500 · in diesem Jahr abgerufen, aber zu einem anderen Stichtag */
    var l = []; try { l = JB() && JB().mbListe ? JB().mbListe() : []; } catch (e) { l = []; }
    var x = l.filter(function (b) { return b.stichtag && String(b.am).slice(0, 4) === String(jahr) && String(b.stichtag).slice(0, 4) !== String(jahr); }).pop();
    return x ? ' Der Bericht vom ' + datumText(x.am) + ' bewertet zum ' + datumText(x.stichtag) + ' und steht deshalb unter ' + String(x.stichtag).slice(0, 4) + '.' : '';
  }
  function stichtagKurz(mb) {
    if (!mb || !mb.stichtag) return '';
    return String(mb.stichtag).slice(0, 4) !== String(mb.am).slice(0, 4) ? 'Stichtag ' + mmjj(mb.stichtag) + ', abgerufen ' + mmjj(mb.am) : '';
  }
  /* v4500 · Marcel 24.11.2026: der Hinweis „In der Anlage V steht noch der Vorschlag …“ stand unter der Tabelle. Jetzt als
     kleine Aktion in der Zeile des Jahres, die Erklärung im Überfahren. */
  function avKnopf(z) {
    var a = z && z.abgleich; if (!a) return '';
    if (a.art === 'vorschlag') {
      var gl = z.av && istZahl(z.av.wert) && istZahl(z.miete_ist) && Math.abs(z.av.wert - z.miete_ist) < 1;
      var t = gl ? 'In der Anlage V ' + z.jahr + ' steht die Mieteinnahme ' + eur(z.av.wert) + ' nur als Vorschlag. Klick bestätigt sie als deine Angabe.'
        : 'In der Anlage V ' + z.jahr + ' steht noch der Vorschlag ' + eur(z.av.wert) + '. Klick übernimmt die tatsächliche Kaltmiete ' + eur(z.miete_ist) + ' als Mieteinnahme.';
      return '<button type="button" class="btn-clean dp-ja-av" data-ja-aktion="av" data-ja-j="' + z.jahr + '" title="' + esc(t) + '">' + (gl ? 'in Anlage V bestätigen' : 'in Anlage V übernehmen') + '</button>';
    }
    if (a.art === 'abweichung') return '<small class="dp-ja-schlecht" title="' + esc(a.text) + '">Anlage V ' + eur(z.av.wert) + '</small>';
    return '';
  }
  function tabelleHtml(Z, weg, L, vd) {
    var J = global.DpJahresstaende;
    /* v4500 · Marcel 24.11.2026: „Kaltmiete Plan und Kaltmiete Ist … kann ich nicht nachvollziehen“. Klare Worte und Hilfe zum Überfahren. */
    /* Überfahren des Kopfes zeigt den Text (title, auch im Modus Feldhilfe, dort sind die i-Knöpfe aus), der i-Knopf das Fenster */
    var tip = function (id, t) { return '<button type="button" class="dp-tip" data-tip-id="' + id + '" tabindex="-1" aria-label="' + t + '"></button>'; };
    var th = function (id, inhalt, t) { var x = null; try { x = global.DpTooltips && global.DpTooltips.get ? global.DpTooltips.get(id) : null; } catch (e) { x = null; }
      return '<th' + (x ? ' title="' + esc(x.title + ': ' + x.body) + '" style="cursor:help"' : '') + '>' + inhalt + tip(id, t) + '</th>'; };
    var kopf = '<tr><th>Jahr</th>' + th('pa.ja_miete_plan', 'Kaltmiete<br>geplant', 'Was heißt geplant?') + th('pa.ja_miete_ist', 'Kaltmiete<br>tatsächlich', 'Was heißt tatsächlich?') + (vd ? '<th>Kaltmiete<br>laut ViVi</th>' : '') + th('pa.ja_zulaessig', 'zulässig<br>§ 558', 'Was heißt zulässig?') + '<th>Cashflow v. St.<br>Plan · Ist</th><th>Ergebnis<br>V+V</th><th>Wert</th><th>Rest&shy;schuld</th><th>DSCR</th><th>Score</th><th>Abgleich</th></tr>';
    var body = Z.map(function (z) {
      var sx = stand(z, weg, L), lauf = z.jahr >= heuteJahr(), pl = planZeile(z.jahr), mp = mpJahr(z.jahr);
      var st = J && J.standJahr ? J.standJahr(z.jahr) : null, kz = (st && st.kz) || {};
      var dscr = zahl(kz._kpis_dscr), score = zahl(kz._ds2_score);
      var planM = istZahl(z.miete_plan) ? eur(z.miete_plan) : (istZahl(z.miete_proj) ? '<span style="color:#9A9285">' + eur(z.miete_proj) + '</span><small>kein Plan vom Kauf</small>' : '–');
      var gen = mp && mp.n && !lauf && mp.genutzt.length && mp.zul > mp.ist + 0.5 && mp.ungenutzt_jahr <= Math.max(5, (mp.zul - mp.ist) * 1.2);
      var U = mp && mp.n ? mpUrteil(mp, zusatzMonat(), z.miete_ist) : null;   /* v4410 · gleiche Grundlage wie die Spalte Kaltmiete */
      var ung = mp && mp.n ? (U.ueber ? '<small class="dp-ja-schlecht"' + (U.erh.length ? ' title="' + esc(U.erh.map(function (x) { return 'Erhöhung zum ' + datumText(x.datum) + ' auf ' + eur(x.auf) + ', zulässig ' + eur(x.zul); }).join(', ')) + '"' : '') + '>' + (U.erh.length ? 'Erhöhung zu hoch' : 'tatsächlich darüber') + '</small>' : gen ? '<small class="dp-ja-gut">genutzt</small>' : mp.ungenutzt_jahr > 0 ? '<small class="dp-ja-schlecht">' + vz(-mp.ungenutzt_jahr) + ' ungenutzt</small>' : (mp.zul > mp.ist + 0.5 ? '<small>ab ' + mmjj(mp.wirksam_ab) + '</small>' : '<small class="dp-ja-gut">ausgeschöpft</small>')) : '';
      var cfP = istZahl(z.cf_plan) ? z.cf_plan : z.cf_proj, cfI = istZahl(z.cf_stand) ? z.cf_stand : null;
      var rs = istZahl(z.rs_ist) ? z.rs_ist : z.rs_proj;
      return '<tr data-ja-jahr="' + z.jahr + '" class="' + (z.jahr === _gewaehlt ? 'an' : '') + '" title="Jahr ' + z.jahr + ' wählen">'
        + '<td><b>' + z.jahr + '</b>' + (lauf ? '<small>läuft</small>' : '') + '<button type="button" class="btn-clean dp-ja-ein" data-ja-aktion="eintragen" data-ja-j="' + z.jahr + '" title="Steuerstand, Restschuld laut Kontoauszug, Leerstand und Notiz für ' + z.jahr + '">eintragen</button></td>'
        + '<td>' + planM + '</td>'
        + '<td>' + (istZahl(z.miete_ist) ? eur(z.miete_ist) : '–') + '<small>' + [lauf ? 'Hochrechnung' : (z.miete_eigen ? 'eingetragen' : (z.miete_vivi ? 'laut ViVi' : 'gerechnet')), lauf ? '' : abw(z.miete_basis, z.miete_ist, true)].filter(Boolean).join(' · ') + '</small>'
          + avKnopf(z) + '</td>'
        + (vd ? (function () { var vj = viviJahr(z.jahr, vd), m = vj && vj.miete, d = istZahl(m) && istZahl(z.miete_ist) ? z.miete_ist - m : null;
            return '<td>' + (istZahl(m) ? eur(m) : '–') + '<small' + (d != null && Math.abs(d) >= 1 ? ' class="dp-ja-schlecht">Δ ' + vz(d) : (d != null ? ' class="dp-ja-gut">gleich' : '>')) + '</small></td>'; })() : '')
        + '<td' + (U && U.zus_j > 0 ? ' title="Wohnungen zulässig ' + eur(U.wohn_zul_j) + ', dazu Stellplätze und Zuschläge ' + eur(U.zus_j) + ' unverändert"' : '') + '>' + (mp && mp.n ? eur(U.zul_j) + ung : '–') + '</td>'
        + '<td>' + eur(cfP) + '<small>' + (cfI != null ? 'Ist ' + eur(cfI) : (lauf ? 'läuft' : 'kein Stand')) + '</small></td>'
        + '<td>' + (z.steuer && istZahl(z.steuer.ergebnis) ? vz(z.steuer.ergebnis) : '–') + '<small>' + (pl && istZahl(pl.zve_y) ? 'Plan ' + vz(pl.zve_y) : '') + '</small><span class="dp-ja-stp ' + esc(z.status) + '">' + esc(JB().statusWort(z.status)) + '</span></td>'
        + (function () {   /* v4410 · führendes Verfahren vor der Marktpreisindikation, wie Schritt 2 im Assistenten */
            var fu = z.mb && z.mb.fu && !z.mb.fu.stufe_m ? z.mb.fu : null;
            return '<td' + (z.mb ? ' title="' + esc((fu ? fu.name + ' (führend) ' + eur(fu.wert) + ', ' : '') + 'Marktpreisindikation ' + eur(z.mb.wert) + ' aus Angebotspreisen, Bericht vom ' + datumText(z.mb.am) + (z.mb.stichtag ? ', bewertet zum ' + datumText(z.mb.stichtag) + '. Ein Bericht steht im Jahr seines Wertermittlungsstichtags.' : '')) + '"' : '') + '>'
              + (z.mb ? eur(fu ? fu.wert : z.mb.wert) : '<span style="color:#9A9285">–</span>')
              + '<small>' + [fu ? esc(fu.name.replace(' (vorläufig)', '')) : '', stichtagKurz(z.mb), pl && istZahl(pl.wert_y) ? 'Plan ' + eur(pl.wert_y) : ''].filter(Boolean).join(' · ') + '</small></td>'; })()
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
    if (_gewaehltKey !== key) { _gewaehlt = null; _gewaehltKey = key; _fuehrung = {}; _eingabe = null; _frage = null; }   /* v4150a · gewählter Schritt galt sonst im nächsten Objekt weiter */
    var jahre = Z.map(function (z) { return z.jahr; });
    if (_gewaehlt == null || jahre.indexOf(_gewaehlt) < 0) _gewaehlt = jahre.indexOf(heuteJahr() - 1) >= 0 ? heuteJahr() - 1 : jahre[0];
    var z = Z.filter(function (x) { return x.jahr === _gewaehlt; })[0], s = stand(z, weg, L), h = s._haus;
    var pl = planZeile(z.jahr), pr = projZeile(z.jahr), lauf = z.jahr >= heuteJahr();

    var out = '<div class="dp-ja" data-dp-ja="1" data-dp-kp-nie="1">';   /* v4560 · keine automatischen Stichpunkte (punkteAus) im Jahresabgleich */
    /* v4150 · Hinweiszeile wechselHtml entfällt, der Knopf steht an der Jahresauswahl (jahrKn) */
    /* v4016 · Die Erinnerung „Jahresabgleich 2025: 2 von 4" stand oben über JEDEM gewählten Jahr (Marcel 23.11.2026:
       „bleibt beim Wechsel der Jahre stehen"). Jetzt sagt der Kopf nur das gewählte Jahr; offene Jahre zeigt die
       Jahresleiste mit Punkt und Zahl. */

    /* v4560 · Marcel 24.11.2026: „Oben die Jahre … ein kompletter Zeitstrahl über die Finanzierungsdauer. Welches läuft und
       welche noch nicht da sind, ein bisschen ausgrauen. Ganz am Schluss das Jahr, was man anklickt, ob man das fertig machen
       kann … Wir brauchen dann auch nicht so viel Text daneben.“ Zeitstrahl vom Kaufjahr bis zum Ende der Zinsbindung
       (mindestens bis zum laufenden Jahr), künftige Jahre grau und nicht wählbar. Der Ergebnissatz entfällt, den Stand zeigen
       Punkt und Kästchen je Jahr. Rechts EIN Knopf für das gewählte Jahr: vorbei und offen „<Jahr> abschließen“ (Assistent),
       ganz festgeschrieben „wieder freigeben“, laufendes Jahr „<Jahr> vorbereiten“ (Eingabe im Reiter). */
    var vonJ = jahre.reduce(function (a, b) { return Math.min(a, b); }, heuteJahr());
    var bindj = 10; try { var _bj = Number(global.State && global.State.bindj); if (isFinite(_bj) && _bj > 0) bindj = Math.round(_bj); } catch (e) {}
    var bisJ = Math.max(heuteJahr(), vonJ + bindj);
    var strahl = [];
    for (var yy = vonJ; yy <= bisJ; yy++) strahl.push(yy);
    var jahrKn = lauf ? knopf('eintragen', z.jahr + ' vorbereiten', false, z.jahr)
      : (s.nFest === 4 ? '<button type="button" class="btn-clean dp-ja-fest an" data-ja-aktion="freigeben" title="' + z.jahr + ' ist festgeschrieben. Alle vier Schritte wieder freigeben.">' + SCHLOSS + ' ' + z.jahr + ' freigeben</button>'
        : knopf('fertig', z.jahr + ' abschließen', true, z.jahr));
    out += '<div class="dp-ja-erg"><div class="dp-ja-strahl" role="group" aria-label="Jahr wählen">' + strahl.map(function (y) {
        var x = Z.filter(function (q) { return q.jahr === y; })[0];
        var marke = y === vonJ ? 'Kauf' : (y === vonJ + bindj ? 'Zinsbindung' : '');
        if (!x) return '<button type="button" class="btn-clean dp-ja-sj kommt" disabled title="' + y + ' kommt noch' + (marke ? ' (Ende der Zinsbindung)' : '') + '"><i class="dp-ja-sp"></i><b>' + y + '</b><small>' + (marke || '&nbsp;') + '</small></button>';
        var sx = stand(x, weg, L), xl = x.jahr >= heuteJahr();
        var kl = xl ? 'laeuft' : (sx.nFest === 4 ? 'fest' : (sx.n === 4 ? 'ok' : (sx.n >= 2 ? 'teil' : 'offen')));
        var tt = xl ? y + ' läuft' : (sx.nFest === 4 ? y + ' festgeschrieben' : standText(sx, y) + (sx.offen.length ? '. Offen: ' + sx.offen.join(', ') : ''));
        return '<button type="button" class="btn-clean dp-ja-sj ' + kl + '" data-ja-jahr="' + y + '" aria-pressed="' + (y === _gewaehlt) + '" title="' + esc(tt) + '" aria-label="' + esc(tt) + '"><i class="dp-ja-sp">' + (kl === 'fest' ? SCHLOSS : '') + '</i><b>' + y + '</b>'
          + (xl ? '<small>' + (marke || 'läuft') + '</small>' : sx.nFest === 4 ? '<small>' + (marke || 'fest') + '</small>'
            : '<span class="dp-ja-mini">' + SCHRITTE.map(function (q) { return '<i class="dp-ja-' + (sx[q[0]] === 'ok' ? 'ok' : sx[q[0]]) + '"></i>'; }).join('') + '</span>') + '</button>';
      }).join('') + '</div><div class="dp-ja-jk">' + jahrKn + '</div></div>';
    out += frageHtml(z.jahr) + protokollHtml(z.jahr);

    /* die vier Schritte als eine Leiste */
    var erh = (z.erhoehungen || []).map(function (e) { return datumText(e.datum) + (e.nr ? ' (Whg. ' + e.nr + ')' : '') + (istZahl(zahl(e.auf)) ? ' auf ' + eur(zahl(e.auf)) : ''); });
    var listeLeer = false; try { var E = global.DpErhoehungen; listeLeer = !!(E && E.alle && !E.alle().length); } catch (e) {}
    var mPlan = z.miete_plan != null ? z.miete_plan : z.miete_proj;
    var vd = null; try { vd = viviDaten(); } catch (e) { vd = null; }
    var vk = null; try { vk = viviKurz(z, vd); } catch (e) { vk = null; }   /* v4500 */
    var sch = '', teile = {};
    teile.miete = schritt('miete', 'Miete', s, eur(z.miete_ist), (z.miete_plan != null ? 'Plan ' : 'Projektion ') + eur(mPlan) + (abw(mPlan, z.miete_ist, true) ? ' · ' + abw(mPlan, z.miete_ist, true) : ''),
      (erh.length ? 'Erhöhung ' + esc(erh.join(', ')) + '.' : 'Keine Erhöhung in diesem Jahr eingetragen.') + (listeLeer && !lauf ? ' Ohne Liste rechnet DealPilot vergangene Jahre mit der heutigen Miete.' : '')
        + (!lauf ? (z.miete_eigen ? ' Ist-Miete von dir eingetragen.' : (z.miete_vivi ? ' Ist-Miete aus ViVi übernommen.' : ' Die Ist-Miete ' + z.jahr + ' fehlt noch. Trag ein, was wirklich eingegangen ist.')) : '')
        + (vk && vk.weniger ? ' <span class="dp-ja-schlecht">Laut ViVi ' + vk.weniger + ' % weniger Miete eingegangen als vereinbart.</span>' : ''),
      (!lauf && !z.miete_eigen && !z.miete_vivi ? knopf('eintragen', 'Ist-Miete ' + z.jahr + ' eintragen', true, z.jahr) + ' ' : '') + knopf('miete', 'Mieterhöhung eintragen', listeLeer && !lauf), z.jahr);
    var stW = { geplant: 'nicht erklärt', erklaert: 'erklärt, Bescheid fehlt', bescheid: 'Bescheid liegt vor' }[z.status] || 'nicht erklärt';
    var stI = z.steuer ? z.steuer.ergebnis : null, stP = pl && istZahl(pl.zve_y) ? pl.zve_y : null;
    teile.steuer = schritt('steuer', 'Steuer', s, istZahl(stI) ? vz(stI) : '–', (stP != null ? 'Plan ' + vz(stP) : 'kein Plan') + (abw(stP, stI, true) ? ' · ' + abw(stP, stI, true) : ''),
      'Ergebnis Anlage V · ' + stW + '.' + (vk ? (vk.n ? ' ' + vk.n + (vk.n === 1 ? ' Position weicht' : ' Positionen weichen') + ' von ViVi ab.' : ' Stimmt mit ViVi überein.') : ''),
      (lauf && !anlageVErlaubt() ? '' : knopf('steuer', z.status === 'geplant' ? 'Anlage V ' + z.jahr + ' ausfüllen' : 'Anlage V ansehen', s.steuer === 'offen')) + ' ' + knopf('eintragen', 'Stand setzen', false, z.jahr)
        + (vk && vk.n ? ' ' + knopf('vivi-reiter', vk.n + (vk.n === 1 ? ' Abweichung' : ' Abweichungen') + ' zu ViVi', false, z.jahr) : ''), z.jahr);
    var wP = pl && istZahl(pl.wert_y) ? pl.wert_y : null, wI = z.mb ? z.mb.wert : null;
    teile.wert = schritt('wert', 'Wert', s, wI != null ? eur(wI) : '–', (wP != null ? 'Plan ' + eur(wP) : 'kein Plan') + (abw(wP, wI, true) ? ' · ' + abw(wP, wI, true) : ''),
      z.mb ? 'Marktbericht vom ' + datumText(z.mb.am) + (z.mb.stichtag && z.mb.stichtag !== z.mb.am ? ', bewertet zum ' + datumText(z.mb.stichtag) : '') + '.'
        + (z.mb.stichtag && String(z.mb.stichtag).slice(0, 4) !== String(z.mb.am).slice(0, 4) ? ' Ein Bericht steht im Jahr seines Wertermittlungsstichtags.' : '')
        : 'Kein Marktbericht zum Stichtag in ' + z.jahr + '.' + anderswo(z.jahr), knopf(z.mb ? 'wert-sehen' : 'wert', z.mb ? 'Alle Berichte' : 'Marktbericht abrufen', s.wert === 'offen'), z.jahr);
    if (weg) {
      var hgW = istZahl(h.hg_ist_j) ? eur(h.hg_ist_j) : (istZahl(h.hg_plan_m) ? eur(h.hg_plan_m * 12) : '–');
      var hgV = istZahl(h.hg_plan_m) ? 'Plan ' + eur(h.hg_plan_m * 12) + (istZahl(h.hg_ist_j) ? ' · ' + abw(h.hg_plan_m * 12, h.hg_ist_j, false) : ' · Wirtschaftsplan') : (istZahl(h.hg_ist_j) ? (h.hg_quelle === 'vivi' ? 'Hausgeld laut ViVi' : 'Hausgeld laut Abrechnung') : 'Hausgeld im Jahr');
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
      teile.haus = schritt('haus', 'Haus', s, hgW, hgV, hausT.join(' · ') + '.' + suT + bT,
        knopf('haus', 'Unterlagen hochladen', s.haus !== 'ok' && !lauf) + (viviVerknuepft() && !lauf ? ' ' + knopf('vivi-abgleich', 'Mit ViVi abgleichen', false, z.jahr) : '') + ' ' + knopf('haus-sehen', 'Haus ansehen', false), z.jahr);
    } else {
      var ev = h.ereignisse.slice(0, 2).map(function (e) { return esc(e.titel || e.text); }).filter(Boolean);
      teile.haus = schritt('haus', 'Haus', s, h.suDa && h.su > 0 ? eur(h.su) : 'keine', 'Sonderumlage · Plan ' + eur(pl && istZahl(pl.su_y) ? pl.su_y : 0),
        'Kein Wohnungseigentum, die Hauskosten stehen in der Anlage V.' + (ev.length ? ' ' + ev.join(' · ') + '.' : ''), (lauf && !anlageVErlaubt() ? '' : knopf('steuer', 'Anlage V ansehen', false)), z.jahr);
    }
    var akt = aktiverSchritt(z, s, lauf);
    sch = SCHRITTE.map(function (x) { var t = teile[x[0]] || ''; return x[0] === akt ? t.replace('class="dp-ja-schritt', 'class="dp-ja-schritt dp-ja-akt') : t; }).join('');
    out += '<div class="dp-ja-schritte">' + sch + '</div>';   /* v4560 · Karten zuerst, darunter die Knopfleiste des gewählten Schritts */
    out += fuehrungHtml(z, s, lauf, akt, weg);
    if (_eingabe === z.jahr && JB() && JB().eingabeHtml) out += '<div class="dp-ja-eingabe" data-ja-eingabe="' + z.jahr + '"><div class="dp-ja-eingabe-k"><b>' + z.jahr + ' eintragen</b><span>Ist-Miete, Leerstand, Restschuld laut Kontoauszug, Stand der Steuer und Notiz</span><button type="button" class="btn-clean dp-ja-ein-x" data-ja-aktion="ein-zu" aria-label="Eingabe schließen">✕</button></div>' + JB().eingabeHtml(z.jahr) + '</div>';

    /* v4500 · die ViVi-Zeile (viviHtml) entfällt, die Abweichungen stehen im Schritt Steuer (viviKurz) */

    /* Mieterhöhungspotenzial des Jahres */
    try { out += potenzialHtml(z, lauf); } catch (e) { try { console.warn('[jahresabgleich] Mietpotenzial', e); } catch (x) {} }

    /* Jahr für Jahr: eine Tabelle statt drei */
    out += abschnitt('Jahr für Jahr', 'Plan vom Kauf gegen Ist · Zeile wählt das Jahr');
    out += tabelleHtml(Z, weg, L, null);   /* v4042 · Spalte „laut ViVi“ entfällt, der Vergleich steht im Reiter ViVi */
    var hin = '';
    /* v4500 · der Anlage-V-Hinweis steht jetzt als Aktion in der Zeile (avKnopf) */
    if (z.ziel_erreicht && z.ziel_fassung && z.ziel_fassung.status !== 'erreicht') hin += '<div class="dp-ja-notiz ok">Die Ist-Miete ' + z.jahr + ' erreicht das Ziel von ' + esc(z.ziel_titel || 'Zielbild') + '. <button type="button" class="btn-clean dp-pa4-btn" data-ja-aktion="erreicht" data-ja-fassung="' + esc(z.ziel_fassung.id) + '">als erreicht kennzeichnen</button></div>';
    if (z.notiz) hin += '<div class="dp-ja-notiz">Notiz ' + z.jahr + ': ' + esc(z.notiz) + '</div>';
    out += hin;
    var nSt = 0; try { nSt = global.DpJahresstaende && global.DpJahresstaende.liste ? global.DpJahresstaende.liste().length : 0; } catch (e) {}
    /* v4500 · Marcel 24.11.2026: „Kennzahlen 2026 jetzt sichern … verstehe ich überhaupt nicht“. Der Knopf tat nur, was jedes
       Speichern ohnehin tut (DpJahresstaende.beimSpeichern). Er entfällt, der Satz sagt es. */
    out += '<div class="dp-ja-fuss"><span>Geplant ist die Rechnung vom Kauf, eingefroren. Tatsächlich ist, was du eingetragen hast, was aus ViVi kommt oder, solange beides fehlt, was DealPilot aus dem Reiter Miete rechnet. DSCR und Score je Jahr merkt sich DealPilot bei jedem Speichern von selbst (' + nSt + (nSt === 1 ? ' Jahr' : ' Jahre') + ').'
      + (z.ohne_plan ? ' Ohne eingefrorenen Plan steht grau die heutige Projektion.' : '') + '</span></div>';

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
  function grafikOpt() { return { karten: true, gewaehlt: _gewaehlt, onJahr: function (j) { if (j && j <= heuteJahr()) { _gewaehlt = j; mountAll(); } } }; }
  function mountAll() {
    var d = doc(); if (!d || !d.querySelectorAll) return;
    var hs = d.querySelectorAll('[data-dp-ja-host]');
    /* v4500 · Marcel 24.11.2026: „immer wenn ich auf Kennzahlen oder Übernehmen klicke, kommt kurz ein Diagramm“. Gemessen:
       jedes Neuzeichnen setzte die alten Karten (jahresbuch-grafik.js) 170 ms sichtbar ein, erst 220 ms später ersetzte
       grafiken-neu.js sie durch den Verlauf und spielte dessen Anlauf neu ab. Jetzt wandert der fertige Verlauf (data-dp-gn)
       über das Neuzeichnen mit, die alten Karten sind darunter sofort versteckt (dp-gn-weg). Gleiche Signatur = kein Neuzeichnen. */
    var mit = [];
    for (var j = 0; j < hs.length; j++) { var gh = hs[j].querySelector('[data-ja-grafik]'); mit.push(gh ? Array.prototype.slice.call(gh.querySelectorAll('[data-dp-gn]')) : []); }
    for (var i = 0; i < hs.length; i++) { try { hs[i].innerHTML = html(); binden(hs[i]); eingabeBinden(hs[i]); } catch (e) { hs[i].innerHTML = ''; try { console.warn('[jahresabgleich]', e); } catch (x) {} } }
    try { if (hs.length && global.DpJahresbuchGrafik) global.DpJahresbuchGrafik.mountAll(grafikOpt()); } catch (e) {}
    var gnAn = !!(d.body && d.body.classList && d.body.classList.contains('dp-gn-an'));
    for (var u = 0; u < hs.length; u++) {
      var ng = hs[u].querySelector('[data-ja-grafik]'); if (!ng || !gnAn) continue;
      var ka = ng.querySelector('.jbg-karten');
      if (ka) ka.classList.add('dp-gn-weg');
      (mit[u] || []).forEach(function (k) { if (ka && ka.parentNode) ka.parentNode.insertBefore(k, ka); else ng.appendChild(k); });
    }
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
  /** v4090 · Marcel 23.11.2026: „Mieterhöhung eintragen springt nur in den Tab Miete, aber nicht an die Stelle."
      Ursache gemessen (Demostraße, ETW): der Sprung rollte 300 ms nach dem Reiterwechsel. Da war die Karte noch nicht
      sichtbar (offsetParent null), es wurde nichts gerollt und die Seite blieb oben. Jetzt: warten, bis das Ziel
      sichtbar ist, dann zur Eingabe „Erhöhung eintragen" rollen, sie aufklappen und kurz hervorheben.
      MFH: die Wohnung mit Luft nach § 558 (sonst die erste) in den Einheiten öffnen, dort die Liste der Erhöhungen.
      ziel 'erh': Mieterhöhung eintragen · 'mh': Mieterhöhung vorbereiten (Soll-Miete, Zielbild) */
  function wohnungMitLuft() {
    try {
      var mp = mpJahr(_gewaehlt), M = global._dpMfh, E = M && Array.isArray(M.einheiten) ? M.einheiten : [];
      var w = mp && mp.wohnungen ? mp.wohnungen.filter(function (x) { return x.plus > 0.5; })[0] : null;
      if (!w) return 0;
      for (var i = 0; i < E.length; i++) if (String((E[i] && E[i].nr) || i + 1) === String(w.nr)) return i;
    } catch (e) {}
    return 0;
  }
  /* v4090 · GEMESSEN 23.11.2026 (Demostraße): die Karte Mietvertrag liegt seit v4060 im zugeklappten „Mietvertrag und
     Mieterhöhungen" (details.dp-md-auf in einer Karte mit overflow:hidden). scrollIntoView tat dort nichts. Erst alle
     umgebenden details aufklappen, dann rollen. */
  function aufklappen(e) { for (var p = e; p && p.tagName; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) p.open = true; }
  function hervorheben(e) {
    if (!e) return;
    aufklappen(e);
    try { e.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) { try { e.scrollIntoView(); } catch (y) {} }
    try {
      e.classList.remove('dp-ja-blink'); void e.offsetWidth; e.classList.add('dp-ja-blink');
      setTimeout(function () { try { e.classList.remove('dp-ja-blink'); } catch (x) {} }, 2600);
    } catch (x) {}
  }
  /* v4110 · Marcel 23.11.2026: „Absprung zu Anlage V soll nur möglich sein, wenn man das passende Level hat … beim
     Absprung muss er dann auch runter springen zur Anlage V und nicht nur den Tab aufmachen.“ Die Anlage V ist
     #yearly-tax-form-box, in detailgrad-zuordnung.js s3-tax Stufe 2 (Einsteiger nein, Fortgeschritten Quick, Experte
     auch Detail). Erlaubt heißt: der Detailgrad blendet sie nicht aus. */
  function anlageVErlaubt() {
    try {
      var D = global.DpDetailgrad, el = doc() && doc().getElementById('yearly-tax-form-box');
      if (D && D.ausgeblendet && el) return !D.ausgeblendet(el);
      if (D && D.stufe) return D.stufe() >= 2;
    } catch (e) {}
    return true;
  }
  function zuAnlageV() {
    if (!anlageVErlaubt()) { zuReiter('s3-tax'); return; }
    var d = doc(); zuReiter('s3-tax');
    warteSichtbar(function () { return d.getElementById('yearly-tax-form-box'); }, function (e) {
      if (!e) return;
      aufklappen(e);
      /* v4110a · GEMESSEN (Demostraße, 1568 px): scrollIntoView start legte die Anlage V auf −4 px, also unter Kopf und
         Reiterleiste (nav.tabs endet bei 92 px). Jetzt die Rollstrecke selbst: Oberkante knapp unter die Reiterleiste. */
      try {
        var nav = d.querySelector('nav.tabs'), nb = nav ? nav.getBoundingClientRect() : null, unten = nb && nb.height > 0 && nb.bottom > 0 ? nb.bottom : 0;
        var dy = e.getBoundingClientRect().top - (unten + 12), sc = d.querySelector('.main-col');
        if (sc && sc.scrollHeight > sc.clientHeight + 4) sc.scrollBy({ top: dy, behavior: 'smooth' }); else global.scrollBy({ top: dy, behavior: 'smooth' });
        /* v4330 · Nachkontrolle: liegt die Anlage V nach der Rolle nicht oben, ohne Animation nachziehen */
        setTimeout(function () { try { var dy2 = e.getBoundingClientRect().top - (unten + 12); if (Math.abs(dy2) > 60) { if (sc && sc.scrollHeight > sc.clientHeight + 4) sc.scrollBy(0, dy2); else global.scrollBy(0, dy2); } } catch (x) {} }, 1300);
      } catch (x) { try { e.scrollIntoView(); } catch (y) {} }
      try { e.classList.remove('dp-ja-blink'); void e.offsetWidth; e.classList.add('dp-ja-blink'); setTimeout(function () { try { e.classList.remove('dp-ja-blink'); } catch (x) {} }, 2600); } catch (x) {}
    });
  }
  function warteSichtbar(finde, fertig, n) {
    var e = finde();
    /* v4330 · GEMESSEN (Musterweg 7, 1568 px): der Reiterwechsel ruft _v236ScrollTop nach 30/50/200/250/300 ms mit smooth auf.
       Nach 150 ms gestartet, brach diese Rolle nach oben unsere Rolle zur Anlage V ab, sie blieb bei 0. Erst nach 420 ms rollen. */
    if (e && e.offsetParent && e.getBoundingClientRect().height > 0) { setTimeout(function () { fertig(finde() || e); }, 420); return; }
    if ((n || 0) > 30) { fertig(e); return; }
    setTimeout(function () { warteSichtbar(finde, fertig, (n || 0) + 1); }, 100);
  }
  function zuMiete(ziel) {
    var d = doc(); stil();
    var Mf = global.DpMfhEinheiten, mfh = !!(Mf && Mf.artMitEinheiten && Mf.artMitEinheiten() && global._dpMfh && Array.isArray(global._dpMfh.einheiten) && global._dpMfh.einheiten.length);
    if (ziel === 'erh' && mfh && Mf.einheitOeffnen) {
      try { Mf.einheitOeffnen(wohnungMitLuft()); } catch (x) {}
      warteSichtbar(function () { return d.getElementById('mfh-we-erh-liste'); }, function (e) {
        var det = e && e.querySelector('details'); if (det) det.open = true;
        hervorheben(det || e);
      });
      return;
    }
    var kand = ziel === 'mh' ? ['zb_soll_qm', 'mv-erh-host', 'mv_letzte_erhoehung'] : ['mv-erh-host', 'mv_letzte_erhoehung'];
    var finde = function () { var e = null; kand.some(function (id) { var x = d.getElementById(id); if (x) { e = x; return true; } return false; }); return e; };
    var e0 = finde(), sec = e0 && e0.closest ? e0.closest('.sec') : null;
    zuReiter(sec && sec.id ? sec.id : 's2');
    warteSichtbar(finde, function (e) {
      if (!e) return;
      var ziel2 = e;
      if (e.id === 'mv-erh-host') {
        var det = e.querySelector('details');
        if (det) { det.open = true; ziel2 = det; var f = det.querySelector('input[data-erh-feld="datum"]'); setTimeout(function () { try { if (f) f.focus({ preventScroll: true }); } catch (x) {} }, 600); }
      } else if (ziel === 'mh' && e.closest) ziel2 = e.closest('.f,.card') || e;
      hervorheben(ziel2);
    });
  }
  /* ── v4090 · Geführter Ablauf ───────────────────────────────────────
     Marcel 23.11.2026: „es wäre besser, wenn man einen Ablauf hat, der einen da durchführt. Ich find es nicht
     selbsterklärend." Eine Leiste über den vier Schritten: die vier Punkte mit Stand, Schritt n von 4, was zu tun
     ist, der Knopf dafür, zurück und weiter. Aktiv ist der erste offene Schritt, bis der Nutzer selbst wählt
     (_fuehrung je Jahr). Nur für vergangene Jahre, das laufende Jahr läuft noch. */
  function aktiverSchritt(z, s, lauf) {
    var w = _fuehrung[z.jahr];
    if (lauf) return w && SCHRITTE.some(function (x) { return x[0] === w; }) ? w : 'miete';   /* v4150 · auch das laufende Jahr zeigt die Knöpfe des gewählten Schritts */
    if (w && SCHRITTE.some(function (x) { return x[0] === w; })) return w;
    var o = SCHRITTE.filter(function (x) { return s[x[0]] !== 'ok'; })[0];
    return o ? o[0] : null;
  }
  function aufgabe(k, z, s, weg) {
    var J = z.jahr, ok = s[k] === 'ok', fest = s.fest && s.fest[k];
    if (fest) return { t: 'Festgeschrieben. Zum Ändern erst wieder freigeben.', kn: '' };
    if (k === 'miete') return ok
      ? { t: 'Die Ist-Miete ' + J + ' steht fest. Gab es im Jahr eine Erhöhung, trag sie im Reiter Miete ein.', kn: knopf('miete', 'Mieterhöhung eintragen', false) }
      : { t: 'Trag ein, was ' + J + ' wirklich an Kaltmiete eingegangen ist. Erhöhungen im Jahr gehören in den Reiter Miete.', kn: knopf('eintragen', 'Ist-Miete ' + J + ' eintragen', true, J) + ' ' + knopf('miete', 'Mieterhöhung eintragen', false) };
    if (k === 'wert') return ok
      ? { t: 'Für ' + J + ' liegt ein Marktbericht vor. Der Wert steht gegen den Plan vom Kauf.', kn: knopf('wert-sehen', 'Alle Berichte', false) }
      : { t: 'Für ' + J + ' fehlt ein Marktbericht. Ein Bericht zählt für das Jahr seines Wertermittlungsstichtags. Gibt es keinen für ' + J + ', schreib den Schritt fest.', kn: knopf('wert', 'Marktbericht abrufen', true) };
    if (k === 'haus') return weg
      ? (ok ? { t: 'Protokoll und Abrechnung ' + J + ' sind da. Hausgeld, Rücklage und Beschlüsse stehen im Schritt Haus.', kn: knopf('haus-sehen', 'Haus ansehen', false) }
        : { t: (s._haus && s._haus.hg_quelle === 'vivi' ? 'Das Hausgeld ' + J + ' kommt aus ViVi. Lade noch Protokoll und Abrechnung ' + J + ' hoch, DealPilot liest Rücklage und Beschlüsse daraus.'
              : 'Lade Protokoll, Wirtschaftsplan und Abrechnung ' + J + ' hoch. DealPilot liest Hausgeld, Rücklage und Beschlüsse daraus.' + (viviVerknuepft() ? ' Das Hausgeld kann auch ViVi liefern.' : '')),
            kn: knopf('haus', 'Unterlagen hochladen', true) + (viviVerknuepft() ? ' ' + knopf('vivi-abgleich', 'Mit ViVi abgleichen', false, J) : '') })
      : { t: 'Kein Wohnungseigentum. Die Hauskosten stehen in der Anlage V, der Schritt folgt der Steuer.', kn: '' };
    var vk = null; try { vk = viviKurz(z, viviDaten()); } catch (e) { vk = null; }   /* v4500 · Abweichungen zu ViVi im Schritt Steuer */
    var vkT = vk && vk.n ? ' ' + vk.n + (vk.n === 1 ? ' Position der Anlage V weicht' : ' Positionen der Anlage V weichen') + ' von ViVi ab, im Reiter ViVi kannst du sie übernehmen oder bestätigen.' : '';
    var vkK = vk && vk.n ? ' ' + knopf('vivi-reiter', vk.n + (vk.n === 1 ? ' Abweichung' : ' Abweichungen') + ' zu ViVi', false, J) : '';
    return ok
      ? { t: 'Der Bescheid ' + J + ' liegt vor. Damit ist die Steuer abgeglichen.' + vkT, kn: knopf('steuer', 'Anlage V ansehen', false) + vkK }
      : { t: (z.status === 'erklaert' ? 'Die Anlage V ' + J + ' ist erklärt. Sobald der Bescheid da ist, setz den Stand auf Bescheid.' : 'Füll die Anlage V ' + J + ' aus und setz danach den Stand auf erklärt oder Bescheid.') + vkT,
          kn: knopf('steuer', 'Anlage V ' + J + ' ' + (z.status === 'geplant' ? 'ausfüllen' : 'ansehen'), true) + ' ' + knopf('eintragen', 'Stand setzen', false, J) + vkK };
  }
  function fuehrungHtml(z, s, lauf, akt, weg) {
    var ks = SCHRITTE.map(function (x) { return x[0]; });
    var punkte = '<ol class="dp-ja-f-p" aria-label="Ablauf ' + z.jahr + '">' + SCHRITTE.map(function (x, i) {
      var st = s.fest && s.fest[x[0]] ? 'ok' : s[x[0]];
      return '<li><button type="button" class="btn-clean dp-ja-f-' + (st === 'ok' ? 'ok' : st) + (x[0] === akt ? ' an' : '') + '" data-ja-aktion="f-wahl" data-ja-k="' + x[0] + '" aria-current="' + (x[0] === akt ? 'step' : 'false') + '" title="' + x[1] + ': ' + (st === 'ok' ? 'erledigt' : WORT[st]) + '">'
        + '<i>' + (st === 'ok' ? '✓' : (i + 1)) + '</i><span class="w">' + x[1] + '</span></button></li>';
    }).join('') + '</ol>';
    /* v4560 · die Punkte 1 bis 4 entfallen, die Karten darunter wählen den Schritt. Die Leiste ist eine schmale Zeile mit den Knöpfen, die Aufgabe steht im Überfahren. */
    if (!akt) return '<div class="dp-ja-fuehrung fertig"><div class="dp-ja-f-t"><span class="dp-ja-eti">' + z.jahr + ' · ' + (s.nFest === 4 ? 'festgeschrieben' : 'alle Schritte erledigt') + '</span></div></div>';
    var i = ks.indexOf(akt), st = s.fest && s.fest[akt] ? 'ok' : s[akt], fest = s.fest && s.fest[akt];
    /* v4150 · Marcel 23.11.2026: „in der Strecke ja auch kein Weiter und Zurück, sondern geben dann nur die Buttons an“.
       Die Punkte und die Karten wählen den Schritt, hier stehen nur seine Knöpfe (dieselben wie bisher in der Karte) und
       klein „Schritt festschreiben“ bzw. „wieder freigeben“. Laufendes Jahr: Knöpfe der Karte, kein Festschreiben. */
    var a = lauf ? { t: 'Das Jahr ' + z.jahr + ' läuft noch. Abgleich ab Februar ' + (z.jahr + 1) + '.', kn: _kn[akt] || '' } : aufgabe(akt, z, s, weg);
    var festK = lauf ? '' : (fest
      ? '<button type="button" class="btn-clean dp-ja-fest an" data-ja-aktion="freigeben" data-ja-schritt-k="' + akt + '" title="Festgeschrieben am ' + esc(datumText(fest)) + '. Wieder freigeben, um ' + SCHRITTE[i][1] + ' ' + z.jahr + ' zu ändern.">' + SCHLOSS + ' wieder freigeben</button>'
      : '<button type="button" class="btn-clean dp-ja-fest" data-ja-aktion="festschreiben" data-ja-schritt-k="' + akt + '" title="' + SCHRITTE[i][1] + ' ' + z.jahr + ' abschließen. Danach lässt sich der Schritt nicht mehr ändern, bis er freigegeben ist.">' + SCHLOSS + ' Schritt festschreiben</button>');
    return '<div class="dp-ja-fuehrung' + (lauf ? ' lauf' : '') + '" title="' + esc(a.t) + '">'
      + '<div class="dp-ja-f-t"><span class="dp-ja-eti">' + (lauf ? z.jahr + ' · ' + SCHRITTE[i][1] + ' · läuft' : 'Schritt ' + (i + 1) + ' von 4 · ' + SCHRITTE[i][1] + ' · ' + (st === 'ok' ? 'erledigt' : WORT[st])) + '</span></div>'
      + '<div class="dp-ja-f-k">' + a.kn + festK + '</div></div>';
  }
  /* v4090 · Rückfrage vor dem Freigeben und Protokoll des Jahres */
  /* ── v4100 · Jahr fertig machen ─────────────────────────────────────
     Marcel 23.11.2026: „schauen, ob wir schon im neuen Jahr sind und für das Jahr schon komplett alles fertig machen
     können“. Ein vergangenes Jahr: (a) bei ViVi erst abgleichen (Miete aus dem Mietverlauf, Steuerjahr, Hausgeld),
     (b) Stand neu rechnen, (c) zum ersten offenen Schritt mit dem, was noch fehlt, (d) ist alles erledigt, Rückfrage
     „festschreiben?“. Festgeschrieben wird nie ohne Rückfrage. */
  /** Rein: was im Jahr noch fehlt, in Worten je offenem Schritt */
  function offenListe(z, s, weg) {
    var L = [];
    SCHRITTE.forEach(function (x) {
      var k = x[0]; if (s[k] === 'ok') return;
      if (k === 'miete') L.push('Ist-Miete ' + z.jahr);
      else if (k === 'wert') L.push('Marktbericht oder Wert festschreiben');
      else if (k === 'haus') {
        var h = s._haus || {};
        if (!weg) L.push('Hauskosten in der Anlage V');
        else { if (!h.protokoll) L.push('Protokoll hochladen'); if (!(h.abrechnung || h.wirtschaftsplan)) L.push('Abrechnung hochladen'); }
      } else L.push(z.status === 'erklaert' ? 'Steuerbescheid' : 'Anlage V ' + z.jahr);
    });
    return L;
  }
  /** Rein: was nach dem Prüfen geschieht. Nie festschreiben, nur fragen. */
  function fertigErgebnis(z, s, weg) {
    if (!z || z.jahr >= heuteJahr()) return { art: 'laeuft' };
    if (s.nFest === 4) return { art: 'fest' };
    var L = offenListe(z, s, weg);
    if (!L.length) return { art: 'frage', text: 'Alle vier Schritte von ' + z.jahr + ' sind erledigt.' };
    var erster = SCHRITTE.filter(function (x) { return s[x[0]] !== 'ok'; })[0][0];
    return { art: 'offen', schritt: erster, text: 'Noch offen: ' + L.join(', ') + '.' };
  }
  function zeileJahr(jahr) { try { return JB().zeilen().filter(function (x) { return x.jahr === jahr; })[0] || null; } catch (e) { return null; } }
  function hausLesen() { try { return global.DpHausverlauf && global.DpHausverlauf.lesen ? global.DpHausverlauf.lesen() : null; } catch (e) { return null; } }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /** ViVi abrufen (nur lesen). vivi-felder schreibt die Ist-Miete des Jahres, vivi-steuer-abgleich die Steuerjahre nach
      Einstellung, beide lassen festgeschriebene Jahre unberührt (v4090). */
  function viviAbgleichen(still) {
    if (!viviVerknuepft() || !global.DpVivi || !global.DpVivi.abgleichen) return Promise.resolve(false);
    var frei = global.DpViviZugang ? global.DpViviZugang.frei().catch(function () { return false; }) : Promise.resolve(false);   /* v4350 · Plan-Merkmal vivi (ab Investor) */
    return frei.then(function (ok) { return ok ? global.DpVivi.abgleichen(!!still) : null; }).then(function () { return warte(1500); }).then(function () { return true; }, function () { return false; });
  }
  /** Jahreswechsel: das Vorjahr ist vorbei und noch nicht festgeschrieben */
  /* v4110 · Marcel 23.11.2026: „sollte auch umstellen, wenn man 2024 anklickt.“ Die Zeile gilt dem gewählten Jahr, wenn es
     vorbei ist, sonst (laufendes Jahr gewählt) dem Vorjahr. Festgeschrieben: keine Zeile und kein Knopf. */
  function wechselJahr(Z, weg, L, gew) {
    var H = heuteJahr(), j = gew < H ? gew : H - 1, z = Z.filter(function (x) { return x.jahr === j; })[0];
    if (!z) return null;
    var s = stand(z, weg, L); if (s.nFest === 4) return null;
    return { jahr: j, alleOk: s.n === 4 };
  }
  /* v4150 · wechselHtml (Hinweiszeile „<Jahr> ist vorbei“ mit Knopf) entfällt, der Knopf steht an der Jahresauswahl (jahrKn) */
  function frageHtml(jahr) {
    if (!_frage || _frage.jahr !== jahr) return '';
    var w = _frage.k ? (SCHRITTE.filter(function (x) { return x[0] === _frage.k; })[0] || ['', _frage.k])[1] + ' ' + jahr : 'Das ganze Jahr ' + jahr;
    return '<div class="dp-ja-frage" role="alertdialog" aria-label="Festschreibung aufheben"><span><b>' + esc(w) + ' wieder freigeben?</b> Danach lassen sich die Werte wieder ändern. Das Freigeben wird mit Datum protokolliert.</span>'
      + '<span>' + knopf('freigeben-ja', 'Ja, freigeben', true) + ' ' + knopf('freigeben-nein', 'Abbrechen', false) + '</span></div>';
  }
  function protokollHtml(jahr) {
    var l = []; try { var e = (global._currentObjData && global._currentObjData._jahre && global._currentObjData._jahre[String(jahr)]) || {}; l = Array.isArray(e.fest_protokoll) ? e.fest_protokoll : []; } catch (x) { l = []; }
    if (!l.length) return '';
    var wort = function (k) { return (SCHRITTE.filter(function (x) { return x[0] === k; })[0] || ['', k])[1]; };
    var z = l.slice(-3).reverse().map(function (p) { return esc(datumText(String(p.am || '').slice(0, 10)) + ' ' + (p.schritte || []).map(wort).join(', ') + ' ' + p.aktion); });
    return '<div class="dp-ja-prot" title="Protokoll der Festschreibung ' + jahr + '">Protokoll ' + jahr + ': ' + z.join(' · ') + (l.length > 3 ? ' · ' + (l.length - 3) + ' ältere' : '') + '</div>';
  }
  /* v4090 · Eingabe eines Jahres im Reiter (vorher Fenster „Jahre") */
  function eingabeAuf(y) {
    _eingabe = _eingabe === y ? null : y;
    if (_eingabe && y !== _gewaehlt) _gewaehlt = y;
    mountAll();
    if (!_eingabe) return;
    setTimeout(function () { var d = doc(), e = d && d.querySelector('[data-ja-eingabe="' + y + '"]'); if (e) hervorheben(e); }, 60);
  }
  function eingabeBinden(host) {
    var e = host.querySelector('[data-ja-eingabe] .dp-jb-inline'); if (!e || !JB() || !JB().eingabeBinden) return;
    JB().eingabeBinden(e, function () { _eingabe = null; mountAll(); try { if (typeof global.toast === 'function') global.toast('✓ Gespeichert'); } catch (x) {} });
  }
  function binden(host) {
    if (host._dpJa) return; host._dpJa = true;
    host.addEventListener('click', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.dp-jb-inline,.dp-tip')) return;   /* v4090 · die Eingabe bindet selbst (DpJahresbuch.eingabeBinden) */
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-ja-aktion],[data-ja-jahr]') : null;
      if (!b) { var kc = ev.target && ev.target.closest ? ev.target.closest('.dp-ja-schritt[data-ja-k]') : null; if (kc && !(ev.target.closest('a,input,select'))) { _fuehrung[_gewaehlt] = kc.getAttribute('data-ja-k'); mountAll(); } return; }
      ev.preventDefault();
      var a = b.getAttribute('data-ja-aktion');
      if (!a) { var j = +b.getAttribute('data-ja-jahr'); if (j) { _gewaehlt = j; mountAll(); } return; }
      var y = +b.getAttribute('data-ja-j') || _gewaehlt;
      if (a === 'festschreiben') {   /* v4016 · ein Schritt (data-ja-schritt-k) oder das ganze Jahr */
        var k = b.getAttribute('data-ja-schritt-k');
        if (!k && global.DpJahresabschluss) { global.DpJahresabschluss.oeffnen(_gewaehlt, 'fest'); return; }   /* v4100 · ganzes Jahr nur mit Rückfrage */
        if (JB() && JB().festSetzen) JB().festSetzen(_gewaehlt, k ? [k] : null, true);
        _frage = null; mountAll(); return;
      }
      /* v4090 · Marcel 23.11.2026: an festgeschriebenen Jahren nicht einfach wieder etwas ändern. Freigeben fragt erst
         nach (Leiste über den Schritten), dann wird es mit Datum ins Protokoll des Jahres geschrieben (jahresbuch.js). */
      if (a === 'freigeben') { _frage = { jahr: _gewaehlt, k: b.getAttribute('data-ja-schritt-k') || null }; mountAll();
        setTimeout(function () { var q = host.querySelector('.dp-ja-frage'); if (q) hervorheben(q); }, 30); return; }
      if (a === 'freigeben-nein') { _frage = null; mountAll(); return; }
      /* v4100 · Marcel 23.11.2026: „vom Schritt 1 Miete … dann weiter über alle Schritte bis zur Festschreibung“. Ein
         vergangenes Jahr läuft über den Assistenten „Jahresabschluss“ (jahresabschluss.js), jeder Schritt-Knopf öffnet ihn
         beim jeweiligen Schritt. Das laufende Jahr behält die direkten Wege. */
      var AS = global.DpJahresabschluss, vorbei = y < heuteJahr();
      if (AS && vorbei) {
        var ziel = { fertig: null, eintragen: 'miete', wert: 'wert', haus: 'haus', 'vivi-abgleich': 'haus', steuer: 'steuer' }[a];
        if (a === 'fertig' || ziel) { AS.oeffnen(y, ziel); return; }
      }
      if (a === 'freigeben-ja') {
        var fq = _frage; _frage = null;
        if (fq && JB() && JB().festSetzen) JB().festSetzen(fq.jahr, fq.k ? [fq.k] : null, false);
        mountAll(); try { if (typeof global.toast === 'function') global.toast('Freigegeben und protokolliert'); } catch (x) {} return;
      }
      if (a === 'miete') { zuMiete('erh'); return; }
      if (a === 'mieterhoehung') { zuMiete('mh'); return; }
      if (a === 'vivi-reiter') { try { global.DpViviReiter.oeffnen(Number(b.getAttribute('data-ja-j')) || null); } catch (x) {} return; }   /* v4042 */
      if (a === 'vivi-mh') { try { global.DpViviMieterhoehung.oeffnen({ quelle: 'pilot-analyse' }); } catch (x) {} return; }   /* v4037 */
      if (a === 'steuer') { zuAnlageV(); return; }   /* v4110 · bis zur Anlage V rollen (nur mit Stufe, sonst nur der Reiter) */
      if (a === 'eintragen') { eingabeAuf(y); return; }   /* v4090 · im Reiter statt im Fenster „Jahre" (JB().oeffnen(y) bleibt für Steuer und Mietentwicklung) */
      if (a === 'ein-zu') { _eingabe = null; mountAll(); return; }
      if (a === 'f-weiter' || a === 'f-zurueck') { var ks = SCHRITTE.map(function (x) { return x[0]; }), ik = ks.indexOf(b.getAttribute('data-ja-k')), nk = ks[Math.max(0, Math.min(3, ik + (a === 'f-weiter' ? 1 : -1)))];
        _fuehrung[_gewaehlt] = nk; mountAll(); return; }
      if (a === 'f-wahl') { _fuehrung[_gewaehlt] = b.getAttribute('data-ja-k'); mountAll(); return; }
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
    mpRein: mpRein, mpQuellen: mpQuellen, mpJahr: mpJahr, mpUrteil: mpUrteil, html: html, mountAll: mountAll, verfuegbar: verfuegbar, grafikOpt: grafikOpt,
    standText: standText, viviMieteRein: viviMieteRein, viviJahr: viviJahr, viviLuecke: viviLuecke, lueckenText: lueckenText,   /* v4220 */   /* v4016, v4017 */
    SCHRITTE: SCHRITTE, aktiverSchritt: aktiverSchritt, aufgabe: aufgabe, fuehrungHtml: fuehrungHtml,   /* v4090 · für den Prüfer */
    hgViviRein: hgViviRein, hausMitViviRein: hausMitViviRein, offenListe: offenListe, fertigErgebnis: fertigErgebnis,   /* v4100 */
    standFuer: function (j) { var z = zeileJahr(j), w = mitWeg(); return z ? { z: z, s: stand(z, w, hausLesen()), weg: w } : null; },
    viviVerknuepft: viviVerknuepft, viviAbgleichen: viviAbgleichen, viviHgJahr: viviHgJahr, zuMiete: zuMiete, zuReiter: zuReiter, hervorheben: hervorheben,
    anlageVErlaubt: anlageVErlaubt, zuAnlageV: zuAnlageV, wechselJahr: wechselJahr,   /* v4110 */
    schritt: schritt };   /* v4150 · für den Prüfer */
})(typeof window !== 'undefined' ? window : globalThis);
