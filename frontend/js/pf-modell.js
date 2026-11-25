/* v4730 · Portfolio-Cockpit: Datenmodell und Motor der Module aus den Demos (Runde d)
 *
 * Marcel 25.11.2026: „das neue Portfolio-Cockpit hundertprozentig integrieren … Standard Objektmatrix, die anderen
 * auswählbar, Baukasten mit allem.“ Die Module der Demos (Dateien/Portfolio-Cockpit/Demos-2026-11-25d) laufen hier
 * als Motor: pf-kit.js (Zeichnen, Tooltips, EK-Stufe), pf-bausteine.js, pf-katalog.js (Module, Kennzahl-Karten, Vorlagen).
 *
 * Gerechnet wird hier NICHTS Neues. Das Modell ist eine Umbenennung vorhandener Zahlen:
 *   Zeilen je Objekt      grafiken-portfolio.js daten() (portfolioPayload, blickDaten W/BW/A, grafikDaten)
 *   Summen                blickDaten().S (aggStats), .A (Zielbild), .BS (Bewertungssummen), portfolioPayload().projektion
 *   Steuer je Objekt      steuerKetteDaten() (Ergebnis V+V, Wirkung auf den Cashflow, Halter)
 *   EK-Rendite            rows[].ekr4 = DealPilotDashboard.ekr4Obj (ek-rendite.js), Portfolio DpEkRendite.portfolio
 *   Wertansatz            rows[].wert = maßgebender Wert je Objekt (dashboard.js _wertAnsatz, v4730), sonst Kaufpreis
 *   Ziele                 Investmentprofil (min_dscr, min_cashflow_vor_st, max_ltv), nur wenn eingetragen
 * Fehlt eine Angabe, bleibt das Feld leer (null); die Module sagen dann „keine Angabe“ statt eine Zahl zu erfinden.
 */
(function () {
  'use strict';
  function z(v) { if (v == null || v === '') return null; var n = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function ziel(key) {
    try { var P = window.DealPilotInvestmentProfile, p = P && P.load ? P.load() : null, v = p ? p[key] : null; if (v == null || v === '') return null;
      if (typeof v !== 'number') { v = String(v).trim(); if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.'); v = Number(v); }
      return isFinite(v) ? v : null; } catch (e) { return null; }
  }
  function heute() { var d = new Date(); return d.getFullYear() + d.getMonth() / 12 + d.getDate() / 365; }
  function ym(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + '-' + m[2] : null; }
  function kurzName(n) { return String(n || '').replace(/\s+(Bielefeld|Herford|Minden|Leipzig|Bünde|Hüllhorst|Hiddenhausen)$/, ''); }

  function steuerJeObjekt() {
    var M = {}, zve = null, grenz = null;
    try {
      var S = window.DealPilotDashboard.steuerKetteDaten(); (S && S.toepfe || []).forEach(function (t) {
        if (t.estPflichtig && zve == null) { zve = z(t.zve); }
        (t.schritte || []).forEach(function (s) {
          M[s.id] = { erg: z(s.erg), wirkung: z(s.wirkung), halter: t.name || 'Privat', kaufjahr: s.datum ? Number(String(s.datum).slice(0, 4)) : null };
          if (t.estPflichtig && z(s.satzNach) != null) grenz = z(s.satzNach);
        });
      });
    } catch (e) {}
    return { M: M, zve: zve, grenz: grenz };
  }

  function modell(rows, B, P) {
    var D = window.DealPilotDashboard, p = null; try { p = D.portfolioPayload(); } catch (e) { p = null; }
    var po = {}; ((p && p.objekte) || []).forEach(function (o) { po[o.id] = o; });
    var ST = steuerJeObjekt(), H = heute(), S0 = (B && B.S) || {}, A = (B && B.A) || {};
    var objekte = rows.map(function (r, i) {
      var o = po[r.id] || {}, zb = r.zb || {}, st = ST.M[r.id] || {};
      var zbS = ym(r.bindEnde) || ym(o.zinsbindung_bis);
      var zbJahr = zbS ? Number(zbS.slice(0, 4)) + (Number(zbS.slice(5, 7)) - 1) / 12 : null;
      var mieteB = z(zb.mB), mieteZ = z(zb.mZ), mieteJ = z(r.mieteJ);
      var x = {
        i: i, id: r.id, name: kurzName(r.name), ort: o.ort || r.ort || '', art: (r.art === 'Mehrfamilienhaus' ? 'MFH' : r.art) || 'Objekt',
        lage: o.lageklasse || null, zustand: o.zustand || null, energie: r.energie || o.energieklasse || null, leer: z(r.leer),
        we: z(r.we), bj: z(o.baujahr), wfl: z(r.wfl), kp: z(r.kp), mieteJ: mieteJ, cfNs: z(r.cfns), cfVs: z(r.cfvs),
        ek: r.ekr4 && r.ekr4.ek != null ? z(r.ekr4.ek) : z(o.eigenkapital_eur), darl: z(r.darlehen), rest: z(r.rest),
        tilgJ: z(r.tilgJ) || 0, zinsJ: z(r.zinsJ) || 0, zb: zbS || '', score: z(r.score),
        empf: o.pilot_analyse && o.pilot_analyse.empfehlung ? o.pilot_analyse.empfehlung : null,
        dscr: z(r.dscr), zins: r.zinsPct != null ? Math.round(r.zinsPct * 100) / 100 : z(o.zins_prozent), ltv: r.wert ? z(r.rest) / r.wert * 100 : z(o.ltv_prozent),
        stufe: zb.top || 'bestand', mieteB: mieteB != null ? mieteB : mieteJ, mieteZ: mieteZ != null ? mieteZ : (mieteB != null ? mieteB : mieteJ),
        mieteMh: z(zb.mM), massn: z(zb.kosten) || 0, ewB: z(zb.ewB) != null ? z(zb.ewB) : z(r.ew), ewZ: z(zb.ewZ), zuwachs: z(zb.zuw),
        rndB: z(zb.rndB), rndZ: z(zb.rndZ), mpi: z(r.mpi),
        kaufjahr: st.kaufjahr || null, ergVV: st.erg != null ? st.erg : null, steuerWirkung: st.wirkung != null ? st.wirkung : null, halter: st.halter || 'Privat',
        wert: z(r.wert), wertQuelle: r.wertText || (r.wertQ === 'kp' || r.wertQ === 'laedt' ? 'Kaufpreis' : 'maßgebender Wert'),
        bild: r.thumb || null, bildArt: r.thumb ? 'foto' : null,
        adr: (function () { var s = [r.str, r.hnr].filter(Boolean).join(' ').trim(), o2 = [r.plz, r.ort].filter(Boolean).join(' ').trim(); return s && o2 ? s + ', ' + o2 : ''; })(),   /* v4770 · Lagekarte ohne Foto */
        ekr: r.ekr4 || null
      };
      x.ekHeute = (x.wert || 0) - (x.rest || 0);
      x.zbJahr = zbJahr != null ? zbJahr : H + 30;   /* ohne Angabe ans Ende sortiert */
      x.zbRest = zbJahr != null ? zbJahr - H : 99;
      x.restZb = z(r.rsBind) != null ? z(r.rsBind) : x.rest;   /* Restschuld bei Bindungsende aus calc.js (_kpis_rs_bindung) */
      x.kapDienst = x.zinsJ + x.tilgJ;
      x.coc = x.ek > 0 && x.cfVs != null ? x.cfVs / x.ek * 100 : null;
      x.mehrMiete = (x.mieteZ || 0) - (x.mieteB || 0);
      x.qmMiete = x.wfl && x.mieteJ ? x.mieteJ / 12 / x.wfl : null;
      if (!x.zb) x.zb = '';
      return x;
    });
    /* Projektion: dieselbe Rechnung wie die Kachel Vermögen netto in der Projektion (grafiken-portfolio.js projektion(), Basis Wertansatz) */
    var wSum = objekte.reduce(function (s, o) { return s + (o.wert || 0); }, 0);
    var proj = (P || []).map(function (q, i) { return { j: i, rest: z(q.rest), wert: z(q.wert) }; });
    if (!proj.length) proj = [{ j: 0, rest: z(S0.rest), wert: wSum }];
    var ekrP = null; try { ekrP = window.DpEkRendite ? DpEkRendite.portfolio(objekte.map(function (o) { return o.ekr; })) : null; } catch (e) { ekrP = null; }
    var BS = (B && B.BS) || {};
    var D2 = {
      stand: new Date().toLocaleDateString('de-DE'), heute: H, objekte: objekte,
      ziele: { minDscr: ziel('min_dscr'), minCfVs: ziel('min_cashflow_vor_st'), maxLtv: ziel('max_ltv') },
      summe: { n: objekte.length, kp: z(S0.kp), gi: z(S0.gi), ek: z(S0.ek), darl: z(S0.darl), rest: z(S0.rest), mieteJ: z(S0.mieteJ), cfVsJ: z(S0.cfVsJ), cfNsJ: z(S0.cfNsJ),
        tilgJ: z(S0.tilgJ), zinsJ: z(S0.zinsJ), kdJ: z(S0.kdJ), brutto: z(S0.brutto), netto: z(S0.netto), dscr: z(S0.dscr), nebenkosten: null },
      zielbild: { mieteB: z(A.mieteB), mieteMh: z(A.mieteM), mieteZ: z(A.mieteZ), massn: z(A.kosten), ewB: z(A.ewB), ewZ: z(A.ewZ),
        nachKosten: z(A.ewZ) != null ? z(A.ewZ) - (z(A.kosten) || 0) : null, zuwachsNK: z(A.zuw), mpiB: z(A.mpiB),
        renditeB: z(A.kpMit) ? z(A.mieteB) / z(A.kpMit) * 100 : null, renditeZ: z(A.kpMit) ? z(A.mieteZ) / (z(A.kpMit) + (z(A.kosten) || 0)) * 100 : null },
      projektion: proj,
      steuer: { zvePrivat: ST.zve, grenz: ST.grenz },
      ekrP: ekrP,
      gesamt: { kp: z(S0.kp), gi: z(S0.gi), darl: z(S0.darl), ek: z(S0.ek), wertKp: wSum, rest: z(S0.rest), ewN: (BS.mitEw || []).length, ewS: z(BS.ewS), kpEwS: z(BS.kpEwS), mpiS: z(BS.mpiS), nk: null, sonst: null },
      score: null
    };
    /* Ziele nur, wenn eingetragen: sonst null (die Module zeigen dann keinen Zielabgleich) */
    if (D2.ziele.minDscr == null && D2.ziele.minCfVs == null && D2.ziele.maxLtv == null) D2.zieleLeer = true;
    D2.ziele = { minDscr: D2.ziele.minDscr != null ? D2.ziele.minDscr : 1.2, minCfVs: D2.ziele.minCfVs != null ? D2.ziele.minCfVs : 0, maxLtv: D2.ziele.maxLtv != null ? D2.ziele.maxLtv : 90 };
    return D2;
  }

  var E = null, sig = null;
  function setze(rows, B, P) {
    if (!window.DpPfKit || !window.DpPfBausteineF || !window.DpPfKatalogF || !rows || !rows.length) return null;
    var s = JSON.stringify([rows.map(function (r) { return [r.id, Math.round(r.wert || 0), Math.round(r.cfns || 0), r.ekr4 ? Math.round((r.ekr4.k4 || 0) * 10) : 0]; }), B && B.S ? Math.round(B.S.rest) : 0]);
    if (E && s === sig) return E;
    var D2 = modell(rows, B, P);
    DpPfKit.setD(D2);
    if (D2.zieleLeer) DpPfKit.setZiele(false); else DpPfKit.setZiele(true);
    var Bs = DpPfBausteineF(DpPfKit), C = DpPfKatalogF(DpPfKit, Bs);
    E = { K: DpPfKit, B: Bs, C: C, D: D2 }; sig = s;
    return E;
  }
  /* Ein Modul in ein Element zeichnen. Fehler im Modul legen nicht das Cockpit lahm: dann ein Satz statt der Grafik. */
  function zeichne(el, key) {
    if (!E || !el) return false;
    var m = E.C.MOD[key]; if (!m) return false;
    el.classList.add('pfm');
    try { m.bau(el); return true; }
    catch (e) { el.innerHTML = '<div class="gx-kopf"><div class="gx-eye">' + String(m.t).replace(/</g, '&lt;') + '</div></div><div class="gx-s">Für dieses Modul fehlen Angaben im Bestand.</div>'; try { console.warn('[pf-modell]', key, e); } catch (x) {} return false; }
  }
  /* Kennzahl-Karte als Daten {l, v, s, c, tip}, gleiche Form wie in den Demos */
  function kachel(key) {
    if (!E) return null; var k = E.C.KZ[key]; if (!k) return null;
    try { return k.f(); } catch (e) { return { l: k.t, v: 'keine Angabe', s: '' }; }
  }
  function neu() { try { if (E) E.K.neu(); } catch (e) {} }
  window.DpPfModell = { setze: setze, zeichne: zeichne, kachel: kachel, neu: neu, modell: modell, get E() { return E; }, version: 'v4730' };
})();
