/* eigennutzer-kern.js · v5130 · KERN EIGENNUTZER-CHECK „Ist das Haus gut?“
   (v5130, KK6: aus dem Demo-Kern v5120ii6 sauber geschnitten. Annahmen in KONFIGURATION,
   Haus-Score Preis 35 · Zustand 35 · Lage 30, Leistbarkeit eigene Ampel, gespiegelt, Prüfer
   tools/eigennutzer-pruefen.mjs. Die alte Demo-Schnittstelle rechne(e, d) bleibt über einen
   Adapter erhalten, damit eigennutzer-qc-demo.js / eigennutzer-app-demo.js weiterlaufen.)
   ─────────────────────────────────────────────────────────────────────────
   Marcel 26.11.2026: Bericht 9,99 €, Einkommen freiwillig, ersparte Miete mit dem
   MITTELWERT der Vergleichsmiete (nicht dem Oberwert der Investorenlogik), bei ETW
   der WEG-Teil (Protokolle, Rücklage, Sonderumlagen) im Kurzurteil.

   Gewichte (Vorschlag Claude, Marcel 26.11.: „ja passt“ zur Trennung):
     HAUS-SCORE „Ist das Haus gut?“  = Preis 35 · Zustand 35 · Lage 30
     LEISTBARKEIT „Passt es zu mir?“ = eigene Ampel (Belastungsquote), NICHT im Haus-Score,
       weil sie etwas über den Käufer sagt, nicht über das Haus.
   Wer die Gewichte ändert, ändert nur GEWICHT unten und lässt tools/eigennutzer-pruefen.mjs laufen.

   EIN KERN LIEST NIE EINSTELLUNGEN. Alles kommt als Parameter. Kaufnebenkosten über
   DealPilotGnotkg (gnotkg.js, Notar/Grundbuch) und den übergebenen GrESt-Satz
   (Aufrufer: DealPilotGrest.forPlz). Gespiegelt ins Backend (tools/rechenkerne-spiegeln.mjs).

   NUR für EFH, ZFH, DHH, RH und ETW. Beim MFH: { ok:false, grund:'mfh' } mit dem Hinweis
   „Für Mehrfamilienhäuser den Modus Vermieten nutzen“.

   Stufenwörter aus ScoreTier (score-tiers.js), wenn geladen, sonst dieselbe Kette lokal. */
(function (root) {
  'use strict';

  var GEWICHT = { preis: 0.35, zustand: 0.35, lage: 0.30 };
  /* ── KONFIGURATION (Annahmen, jede einzeln überschreibbar über den Eingang) ── */
  var STANDARD = {
    tilgung_pct: 2.0,          /* anfängliche Tilgung */
    makler_pct: 3.57,          /* Käuferanteil Maklerprovision inkl. USt (Halbteilung § 656c BGB, häufigster Satz) */
    bewirt_qm: 3.0,            /* Eigennutzer-Kosten, die ein Mieter NICHT trägt: Instandhaltung 1,50 + Rücklage/Versicherungsanteil 1,50 €/m² mtl. */
    wertsteigerung_pct: 1.5,   /* Wertentwicklung p. a. (vorsichtig) */
    mietsteigerung_pct: 2.0,   /* Mietsteigerung p. a. */
    anlagezins_pct: 3.0,       /* Anlagezins des Mieters für Eigenkapital und Differenz */
    jahre: 20
  };

  var ARTEN = ['efh', 'zfh', 'dhh', 'rh', 'etw'];
  var MFH_HINWEIS = 'Für Mehrfamilienhäuser den Modus Vermieten nutzen.';

  function num(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function r0(x) { return Math.round(x); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function lin(x, pts) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
      var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
    return pts[pts.length - 1][1];
  }
  function klemm(x) { return Math.max(0, Math.min(100, x)); }
  function stufe(s) {
    var T = root.ScoreTier;
    if (T && typeof T.stufe === 'function') { var t = T.stufe(s); if (t && t.wort) return { wort: t.wort, versal: t.versal || t.wort.toUpperCase() }; }
    var w = s >= 85 ? 'Sehr gut' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : s >= 35 ? 'Schwach' : 'Kritisch';
    return { wort: w, versal: w.toUpperCase() };
  }
  function eur(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('de-DE') + ' €'; }
  function komma(x, d) { return x.toFixed(d == null ? 1 : d).replace('.', ','); }

  /* ── Kaufnebenkosten ─────────────────────────────────────────────── */
  function nebenkosten(kp, darlehen, grestPct, maklerPct) {
    var G = root.DealPilotGnotkg;
    var grest = kp * (num(grestPct) != null ? grestPct : 6.5) / 100;
    var notar = G ? (G.notar(kp, darlehen) || {}).eur : kp * 0.015;
    var gb = G ? (G.grundbuch(kp, darlehen) || {}).eur : kp * 0.005;
    var makler = kp * (num(maklerPct) != null ? maklerPct : STANDARD.makler_pct) / 100;
    var summe = grest + notar + gb + makler;
    return { grest: r0(grest), notar: r0(notar), grundbuch: r0(gb), makler: r0(makler), summe: r0(summe), pct: r2(summe / kp * 100),
      gnotkg: !!G };
  }

  /* ── Zustand nach Baujahr (gekürzt aus besichtigung.js) + Merkmale ─ */
  function zustand(bj, z, objektart, weg) {
    var s, punkte;
    if (bj >= 2010) { s = 90; punkte = ['Gewährleistung und Bauabnahme prüfen', 'Lüftungsanlage und Wartung', 'Energieausweis mit Bedarfswerten']; }
    else if (bj >= 1995) { s = 78; punkte = ['Wärmedämmfassade auf Risse prüfen', 'Fenster und Lüftung', 'Heizung ab 30 Jahren tauschen']; }
    else if (bj >= 1978) { s = 62; punkte = ['Asbest möglich bis 1993', 'Flachdach und Isolierglas', 'Heizung oft schon über 30 Jahre']; }
    else if (bj >= 1949) { s = 48; punkte = ['Asbest, PCB und Bleileitungen möglich', 'kaum Dämmung, hohe Energiekosten', 'Elektrik und Bäder oft veraltet']; }
    else { s = 42; punkte = ['Holzbalkendecken und Feuchte', 'Elektrik erneuern', 'Denkmalschutz prüfen']; }
    var hinweise = [];
    z = z || {};
    var ek = z.energieklasse ? String(z.energieklasse).toUpperCase() : null;
    if (ek) {
      var ekAdj = { 'A+': 10, A: 8, B: 5, C: 2, D: 0, E: -4, F: -8, G: -12, H: -15 }[ek];
      if (ekAdj != null) { s += ekAdj; if (ekAdj <= -8) hinweise.push('Energieklasse ' + ek + ': hohe Energiekosten, Sanierung einplanen.'); }
    }
    var hz = num(z.heizung_baujahr), jetzt = num(z.stichjahr) || new Date().getFullYear();
    if (hz != null && jetzt - hz >= 30) { s -= 8; hinweise.push('Heizung von ' + hz + ': nach dem Eigentümerwechsel kann eine Austauschpflicht greifen, bitte prüfen.'); }
    if (z.renovierungsbeduerftig) { s -= 12; hinweise.push('Laut Unterlagen renovierungsbedürftig.'); }
    var risk = num(z.risiken_n); if (risk) { s -= Math.min(15, risk * 4); hinweise.push(risk + (risk === 1 ? ' Risiko' : ' Risiken') + ' aus den Unterlagen.'); }
    if (objektart === 'etw' && weg) {
      if (num(weg.sonderumlage_eur) > 0) { s -= 10; hinweise.push('Sonderumlage ' + eur(weg.sonderumlage_eur) + ' laut Protokoll.'); }
      var rq = num(weg.ruecklage_eur_qm);
      if (rq != null && rq < 10) { s -= 8; hinweise.push('Rücklage nur ' + komma(rq) + ' €/m², eher knapp.'); }
      if (weg.sanierung_beschlossen) { s -= 5; hinweise.push('Beschlossene Sanierung in der Gemeinschaft: ' + String(weg.sanierung_beschlossen) + '.'); }
    }
    return { score: r0(klemm(s)), punkte: punkte, hinweise: hinweise };
  }

  /* ── Preis: Kaufpreis gegen Wert und gegen ersparte Miete ─────────── */
  function preis(kp, wert, faktor) {
    var sFak = r0(lin(faktor, [[18, 100], [22, 85], [26, 65], [30, 45], [35, 20], [40, 5]]));
    var w = wert && num(wert.betrag) > 0 ? num(wert.betrag) : null;
    if (w == null) return { score: sFak, faktor_score: sFak, wert_score: null, abweichung_pct: null };
    var abw = (kp / w - 1) * 100;
    var sWert = r0(lin(abw, [[-15, 100], [0, 82], [10, 58], [20, 32], [35, 5]]));
    return { score: r0(sWert * 0.6 + sFak * 0.4), faktor_score: sFak, wert_score: sWert, abweichung_pct: r2(abw) };
  }

  /* ── Hauptrechnung ───────────────────────────────────────────────── */
  function rechne(e) {
    e = e || {};
    var kp = num(e.kaufpreis), wfl = num(e.wfl), bj = num(e.baujahr);
    if (!(kp > 0) || !(wfl > 0) || !(bj > 1000)) return { ok: false, fehlt: ['kaufpreis', 'wfl', 'baujahr'].filter(function (k) { return !(num(e[k]) > 0); }) };
    var A = {}; for (var k in STANDARD) A[k] = num(e[k]) != null ? num(e[k]) : STANDARD[k];
    var art = String(e.objektart || 'efh').toLowerCase();
    if (ARTEN.indexOf(art) < 0) return { ok: false, grund: art === 'mfh' ? 'mfh' : 'objektart', hinweis: art === 'mfh' ? MFH_HINWEIS : 'Der Eigennutzer-Check gilt für Einfamilien-, Zweifamilien-, Doppel- und Reihenhäuser und Eigentumswohnungen.' };
    var ek = num(e.ek) || 0, netto = num(e.netto);
    var zins = num(e.zins_pct); if (zins == null) zins = 4.0;

    /* Darlehen: Kaufpreis + Nebenkosten − EK; Nebenkosten hängen über Notar/Grundbuch am Darlehen → zwei Durchläufe */
    var nk = nebenkosten(kp, 0, e.grest_pct, e.makler_pct);
    var darlehen = Math.max(0, kp + nk.summe - ek);
    nk = nebenkosten(kp, darlehen, e.grest_pct, e.makler_pct);
    darlehen = Math.max(0, kp + nk.summe - ek);
    var rate = darlehen * (zins + A.tilgung_pct) / 100 / 12;
    var bewirt = wfl * A.bewirt_qm;
    if (art === 'etw' && e.weg && num(e.weg.hausgeld_nicht_umlagefaehig) != null) bewirt = num(e.weg.hausgeld_nicht_umlagefaehig);

    /* Ersparte Miete = MITTELWERT der Vergleichsmiete (+ Hauszuschlag laut Mietspiegel bei Häusern) */
    var vm = num(e.vergleichsmiete_qm);
    var zuschlag = art === 'etw' ? 0 : (num(e.hauszuschlag_pct) || 0);
    var mieteQm = vm != null ? vm * (1 + zuschlag / 100) : null;
    var miete = mieteQm != null ? mieteQm * wfl : null;
    var faktor = miete ? kp / (miete * 12) : null;

    var pr = faktor != null ? preis(kp, e.wert, faktor) : (e.wert ? preis(kp, e.wert, 26) : null);
    var zu = zustand(bj, e.zustand, art, e.weg);
    var lage = num(e.lage_score);

    /* Haus-Score: nur vorhandene Gruppen, Gewichte neu verteilt */
    var teile = [], summeW = 0, summe = 0;
    if (pr) { teile.push(['preis', pr.score]); }
    teile.push(['zustand', zu.score]);
    if (lage != null) teile.push(['lage', klemm(lage)]);
    teile.forEach(function (t) { summeW += GEWICHT[t[0]]; summe += GEWICHT[t[0]] * t[1]; });
    var haus = r0(summe / summeW);

    /* Leistbarkeit (eigene Ampel) */
    var wohnkosten = rate + bewirt;
    var quote = netto > 0 ? wohnkosten / netto * 100 : null;
    var ampel = quote == null ? null : quote <= 35 ? 'gruen' : quote <= 45 ? 'gelb' : 'rot';

    /* Kaufen gegen Mieten über A.jahre */
    var reihe = [], wert = kp, schuld = darlehen, depot = ek, mieteJ = miete ? miete * 12 : null, jahr = null;
    if (mieteJ) for (var t = 0; t <= A.jahre; t++) {
      var kauf = wert - schuld;
      reihe.push({ jahr: t, kaufen: r0(kauf), mieten: r0(depot) });
      if (jahr == null && t > 0 && kauf >= depot) jahr = t;
      var zinsJ = schuld * zins / 100, tilgJ = Math.min(schuld, rate * 12 - zinsJ);
      schuld = Math.max(0, schuld - tilgJ);
      wert *= 1 + A.wertsteigerung_pct / 100;
      depot = depot * (1 + A.anlagezins_pct / 100) + Math.max(0, (rate + bewirt) * 12 - mieteJ);
      mieteJ *= 1 + A.mietsteigerung_pct / 100;
    }

    /* Kurzurteil, Sätze ohne Gedankenstrich und Semikolon */
    var urteil = [];
    var st = stufe(haus);
    urteil.push('Das Haus ist insgesamt ' + st.wort.toLowerCase() + ' (' + haus + ' von 100).');
    if (pr && pr.abweichung_pct != null) urteil.push(pr.abweichung_pct > 0
      ? 'Der Kaufpreis liegt ' + komma(pr.abweichung_pct) + ' % über dem ermittelten Wert.'
      : 'Der Kaufpreis liegt ' + komma(-pr.abweichung_pct) + ' % unter dem ermittelten Wert.');
    if (faktor) urteil.push('Du zahlst ' + komma(faktor) + ' Jahresmieten für das, was du an Miete sparst.');
    zu.hinweise.slice(0, art === 'etw' ? 4 : 2).forEach(function (h) { urteil.push(h); });
    if (ampel) urteil.push('Deine Wohnkosten liegen bei ' + r0(quote) + ' % vom Netto-Einkommen' + (ampel === 'gruen' ? ', das ist gut tragbar.' : ampel === 'gelb' ? ', das ist knapp.' : ', das ist zu hoch.'));
    if (reihe.length) urteil.push(jahr ? 'Kaufen ist nach ' + jahr + ' Jahren günstiger als mieten.' : 'In ' + A.jahre + ' Jahren wird Kaufen hier nicht günstiger als mieten.');

    return {
      ok: true, version: 'v5130',
      haus: { score: haus, stufe: st, gewichte: GEWICHT,
        gruppen: { preis: pr, zustand: zu, lage: lage != null ? { score: r0(klemm(lage)) } : null } },
      leistbarkeit: { quote: quote != null ? r2(quote) : null, ampel: ampel, wohnkosten: r0(wohnkosten), netto: netto },
      finanzierung: { zins_pct: zins, tilgung_pct: A.tilgung_pct, darlehen: r0(darlehen), rate: r0(rate), ltv_pct: r2(darlehen / kp * 100), bewirt: r0(bewirt) },
      nebenkosten: nk,
      miete: { vergleich_qm: vm, hauszuschlag_pct: zuschlag, qm: mieteQm != null ? r2(mieteQm) : null, monat: miete != null ? r0(miete) : null,
        faktor: faktor != null ? r2(faktor) : null, basis: 'Mittelwert der Vergleichsmiete' },
      kaufen_mieten: { reihe: reihe, jahr: jahr, annahmen: { wertsteigerung_pct: A.wertsteigerung_pct, mietsteigerung_pct: A.mietsteigerung_pct, anlagezins_pct: A.anlagezins_pct } },
      urteil: urteil
    };
  }


  /* ── ADAPTER für die Demo-Schnittstelle v5120ii6: rechne(e, d) ─────────
     e = { kp, wfl, bj, ek, netto, plz, objektart }, d = Ergebnis von daten(): { zinsFn, mieteQm, makro, leer, bev, gebiet, quelle }.
     Liefert die alte Form (gesamt, gruppen[4], reihe {t,kauf,mieten} …) aus dem neuen Kern. gesamt = HAUS-Score
     (ohne Leistbarkeit), die Gruppe Leistbarkeit trägt nur die Ampel-Zahl. */
  function lageAusMarkt(d) {
    if (!d || d.makro == null) return null;
    return klemm(d.makro + (d.leer === 'gut' ? 6 : d.leer === 'schlecht' ? -6 : 0) + (d.bev > 0.3 ? 4 : d.bev < -0.3 ? -4 : 0));
  }
  function rechneDemo(e, d) {
    e = e || {}; d = d || {};
    var kp = num(e.kp), ek = num(e.ek) || 0;
    var ltv0 = kp > 0 ? Math.max(0, kp * 1.1 - ek) / kp * 100 : 80;
    var zins = typeof d.zinsFn === 'function' ? d.zinsFn(ltv0) : num(d.zins);
    var art = String(e.objektart || 'efh').toLowerCase();
    var r = rechne({ kaufpreis: kp, wfl: e.wfl, baujahr: e.bj, objektart: art, ek: ek, netto: e.netto,
      zins_pct: zins, grest_pct: e.grest_pct, vergleichsmiete_qm: d.mieteQm,
      hauszuschlag_pct: e.hauszuschlag_pct != null ? e.hauszuschlag_pct : (art === 'etw' ? 0 : 15),
      lage_score: lageAusMarkt(d), zustand: e.zustand, weg: e.weg, wert: e.wert });
    if (!r.ok) return r;
    var G = r.haus.gruppen, L = r.leistbarkeit;
    var leistS = L.quote == null ? null : r0(lin(L.quote, [[25, 100], [30, 90], [35, 72], [40, 50], [45, 30], [55, 5]]));
    return {
      ok: true, kern: r, gesamt: r.haus.score, stufe: r.haus.stufe, zins: r.finanzierung.zins_pct, rate: r.finanzierung.rate,
      bew: r.finanzierung.bewirt, miete: r.miete.monat, faktor: r.miete.faktor, quote: L.quote, ampel: L.ampel,
      darlehen: r.finanzierung.darlehen, ltv: r.finanzierung.ltv_pct, jahr: r.kaufen_mieten.jahr,
      reihe: r.kaufen_mieten.reihe.map(function (p) { return { t: p.jahr, kauf: p.kaufen, mieten: p.mieten }; }),
      gebiet: d.gebiet, quelle: d.quelle, nebenkosten: r.nebenkosten, urteil: r.urteil,
      gruppen: [
        { k: 'Preis', s: G.preis ? G.preis.score : null, t: r.miete.faktor ? 'Du zahlst ' + komma(r.miete.faktor) + ' Jahresmieten. Üblich sind rund 22 bis 26.' : 'Ohne Vergleichsmiete keine Preiseinordnung.' },
        { k: 'Zustand', s: G.zustand.score, t: 'Baujahr ' + e.bj + ': ' + G.zustand.punkte[0] + '.', punkte: G.zustand.punkte.concat(G.zustand.hinweise) },
        { k: 'Lage', s: G.lage ? G.lage.score : null, t: d.makro != null ? 'Makrolage ' + d.makro + ' von 100, Leerstand ' + (d.leer === 'gut' ? 'niedrig' : 'erhöht') + '.' : 'Keine Lagedaten.' },
        { k: 'Leistbarkeit', s: leistS, ampel: L.ampel, eigen: true, t: L.quote == null ? 'Netto-Einkommen eintragen, dann rechnen wir die Belastung.' : 'Wohnkosten ' + r0(L.quote) + ' % vom Netto-Einkommen.' }
      ]
    };
  }

  /* ── Datenholer der Demo (Browser, öffentliche Endpunkte). Kein Rechenteil. ── */
  var RUECK = { zins: 4.09, miete: 7.87, makro: 51, leer: 'gut', bev: 0.13, gebiet: 'Bielefeld, Stadt', quelle: 'Rückfall' };
  function daten(plz, bj, wfl) {
    var d = { zinsFn: function () { return RUECK.zins; }, mieteQm: RUECK.miete, makro: RUECK.makro, leer: RUECK.leer, bev: RUECK.bev, gebiet: RUECK.gebiet, quelle: RUECK.quelle };
    if (typeof fetch !== 'function' || typeof location === 'undefined') return Promise.resolve(d);
    /* App-Domain: dort liegt /api/v1. Auf der Landing (dealpilot.immo, staging.dealpilot.immo) die passende App-Domain. */
    var h = location.hostname, API = (/^app\./.test(h) || /localhost|127\.0\.0\.1/.test(h) ? (location.origin || '')
      : /staging/.test(h) ? 'https://app.staging.dealpilot.immo' : 'https://app.dealpilot.immo') + '/api/v1';
    var z = fetch(API + '/market-rates/bauzins').then(function (r) { return r.json(); }).then(function (j) {
      var ir = j.indicativeRates && j.indicativeRates['10'], st = j.stufen_ltv || { premium: 60, standard: 80, schwach: 90, voll: 100 };
      if (ir) d.zinsFn = function (ltv) { var k = ltv <= st.premium ? 'premium' : ltv <= st.standard ? 'standard' : ltv <= st.schwach ? 'schwach' : 'voll'; return ir[k]; };
    }).catch(function () {});
    var m = fetch(API + '/market-stats/schnellcheck?plz=' + encodeURIComponent(plz) + '&baujahr=' + bj + '&wfl=' + wfl)
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j.vergleichsmiete && j.vergleichsmiete.qm) { d.mieteQm = j.vergleichsmiete.qm; d.quelle = j.vergleichsmiete.quelle === 'mietspiegel' ? 'Mietspiegel' : 'DealPilot-Näherung'; }
        if (j.makrolage && j.makrolage.wert != null) d.makro = j.makrolage.wert;
        if (j.leerstand && j.leerstand.ton) d.leer = j.leerstand.ton;
        if (j.bevoelkerung && j.bevoelkerung.wert != null) d.bev = j.bevoelkerung.wert;
        if (j.gebiet) d.gebiet = j.gebiet;
      }).catch(function () {});
    return Promise.all([z, m]).then(function () { return d; });
  }

  /* ── Umfeld (Supermarkt, Kita, Bus und Bahn …) über GET /market-stats/umfeld, OSM-Daten. Kein Rechenteil. ── */
  function umfeld(adresse, lat, lon) {
    if (typeof fetch !== 'function' || typeof location === 'undefined') return Promise.resolve(null);
    var h = location.hostname, base = (/^app\./.test(h) || /localhost|127\.0\.0\.1/.test(h) ? (location.origin || '')
      : /staging/.test(h) ? 'https://app.staging.dealpilot.immo' : 'https://app.dealpilot.immo') + '/api/v1/market-stats/umfeld';
    var q = (lat != null && lon != null) ? '?lat=' + lat + '&lon=' + lon : '?adresse=' + encodeURIComponent(adresse || '');
    return fetch(base + q).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  var api = { rechne: function (e, d) { return arguments.length >= 2 || (e && e.kp != null) ? rechneDemo(e, d) : rechne(e); },
    kern: rechne, rechneDemo: rechneDemo, daten: daten, umfeld: umfeld, nebenkosten: nebenkosten, eur: eur, stufe: stufe,
    GEWICHT: GEWICHT, STANDARD: STANDARD, ARTEN: ARTEN, MFH_HINWEIS: MFH_HINWEIS, version: 'v5130' };
  root.DpEigennutzerKern = api;
  root.DpEigennutzer = api;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
