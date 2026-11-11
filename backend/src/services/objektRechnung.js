'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/objektRechnung.js — v3289 · EINE ABBILDUNG Objekt -> Rechenkerne
 *
 * Flow Investor (Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md, Punkt 1):
 * der Makler-Hub ruft POST /objects/:id/berechnen und bekommt Kennzahlen und
 * Quick-Check aus den Kernen der App. Die Abbildung „gespeichertes Objekt ->
 * Kerneingabe" gab es schon - mitten im Bot-Werkzeug `objekt_schnellblick`
 * (agentWerkzeuge.js, v1899-v3215), vermengt mit den Texten fuer den Chat.
 *
 *   > Zwei Wege, die dasselbe Objekt rechnen, brauchen EINE Abbildung. Sonst
 *   > urteilt der Hub anders als der Bot, und keiner merkt es (07.10.2026).
 *
 * Deshalb steht die Rechnung jetzt HIER, ohne Text und ohne Datenbank, und
 * `objekt_schnellblick` wie `flowBerechnung` rufen sie. Was der Bot dazu
 * schreibt, bleibt beim Bot. Die Kommentare mit den Messungen (Prozent-Parser
 * v1899, Bewirtschaftung v1925, Darlehen v1925, Wertpuffer v3006b, GrESt v3006c)
 * stehen weiter am Werkzeug, wo die Messungen gemacht wurden; hier steht die
 * Kurzfassung.
 *
 * Reine Funktionen: kein `query`, kein `localStorage`. Was aus den
 * Einstellungen kommt (Vorgaben, Lage-Ziel, Score-Gewichte, Ampel-Schwellen,
 * Marktpreis), reicht der Aufrufer herein. `opt.kerne` erlaubt dem Pruefer
 * (tools/flow-berechnen-pruefen.mjs), dieselbe Abbildung mit den Kernen aus
 * frontend/js statt dem Spiegel zu fahren.
 * ═══════════════════════════════════════════════════════════════════════════ */
const rechenkerne = require('./rechenkerne');

/* Betraege: der Punkt ist ein TAUSENDERtrennzeichen ("180.000"). */
function z(v) {
  const n = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
/* Prozentsaetze und Dezimalzahlen: ein Punkt ist nie ein Tausender (v1899). */
function dez(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* v3003a · EINE Wertangabe: Marktwert/Verkehrswert (svwert) mit Herkunft (svw_herkunft). Dieselbe Regel
   wie frontend/js/wertangabe.js aufloesen(): bankval ist keine eigene Quelle mehr, sondern gilt nur,
   solange das Objekt noch nicht im Formular uebertragen ist (bankval_migriert).
   (v3289 aus agentWerkzeuge.js hierher verschoben, dort wird sie von hier gelesen.) */
function wertangabe(d) {
  d = d || {};
  const n = (v) => { const x = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : null; };
  const sv = n(d.svwert), bv = n(d.bankval), h = String(d.svw_herkunft || '');
  if (String(d.bankval_migriert || '') === '1' || !bv) return { wert: sv, herkunft: sv ? (h || null) : null };
  if (!sv) return { wert: bv, herkunft: 'bank' };
  if (Math.abs(sv - bv) < 1) return { wert: sv, herkunft: h || 'bank' };
  if (h === 'gutachten' || h === 'bank') return { wert: sv, herkunft: h, anders: bv };
  return { wert: bv, herkunft: 'bank', anders: sv };
}

/** v2143 · Zielrendite der Lageklasse aus dem Lage-Profil (user_settings lage_profil).
 *  Gelesen, nicht gerechnet. Fehlt etwas, null - dann gilt die feste Skala.
 *  `Number(null)` ist 0 und besteht isFinite: deshalb erst auf Abwesenheit pruefen. */
function zielBmrAusProfil(lageProfil, lageklasse) {
  const klasse = lageklasse ? String(lageklasse).toUpperCase().charAt(0) : null;
  if (klasse !== 'A' && klasse !== 'B' && klasse !== 'C') return null;
  const k = lageProfil && lageProfil.klassen ? lageProfil.klassen[klasse] : null;
  const zz = k ? k.ziel_bmr : null;
  if (zz == null || zz === '') return null;
  const n = Number(String(zz).replace(',', '.'));
  return (isFinite(n) && n > 0) ? n : null;
}

const KNK_POSTEN = [['gest_p', 'Grunderwerbsteuer'], ['notar_p', 'Notar'], ['gba_p', 'Grundbuch'],
  ['makler_p', 'Maklercourtage']];

/**
 * rechnen(d, opt) — Kennzahlen und Deal-Score eines gespeicherten Objekts.
 *
 * opt.erg          Ergebnis von botVorgabenService.ergaenzung() (vorhanden / vom_nutzer / vorschlag / fehlt)
 * opt.gespeichert  telegramDialogService.scoreLesen(d) - entscheidet, ob ein Darlehen abgeleitet werden darf
 * opt.gewichte     Score-Gewichte (rechenkerne.scoreGewichte); ohne: die des Kerns (balanced)
 * opt.kerne        Fassade { kpis, grestBasis, gebaeudeAhk, score, vorhanden } - nur fuer den Pruefer
 *
 * Rueckgabe: { pflicht[] } wenn Kaufpreis/Miete fehlen, { kernFehlt: true } ohne Spiegelung,
 * sonst die Teile der Rechnung als Zahlen (keine Texte).
 */
function rechnen(daten, opt) {
  opt = opt || {};
  const d = daten || {};
  const erg = opt.erg || { vorhanden: {}, vom_nutzer: {}, vorschlag: {}, fehlt: [] };
  const sGespeichert = opt.gespeichert || { dealscore: null };

  const kp = z(d.kp), nkm = z(d.nkm), ze = z(d.ze) || 0, wfl = z(d.wfl);
  const r = { kp: kp, nkm: nkm, ze: ze, wfl: wfl, lageklasse: d.lageklasse || null, pflicht: [] };
  if (!kp) r.pflicht.push('Kaufpreis');
  if (!nkm) r.pflicht.push('Nettokaltmiete pro Monat');
  if (r.pflicht.length) return r;

  const rk = opt.kerne || rechenkerne;
  if (typeof rk.vorhanden === 'function' && !rk.vorhanden()) { r.kernFehlt = true; return r; }

  /* Bruttomietrendite und Faktor haengen nur am Kaufpreis (v1899). */
  r.K0 = rk.kpis({ kp: kp, nkm: nkm, ze: ze });

  /* ── Kaufnebenkosten, soweit belegbar ─────────────────────────────── */
  const satzVon = (id2) => {
    if (erg.vorhanden[id2] != null) return { wert: dez(erg.vorhanden[id2]), quelle: 'am Objekt' };
    if (erg.vom_nutzer[id2] != null) return { wert: Number(erg.vom_nutzer[id2]), quelle: (erg.quelle && erg.quelle[id2]) || 'deine Vorgabe' };
    if (erg.vorschlag[id2]) return { wert: Number(erg.vorschlag[id2].wert), quelle: erg.vorschlag[id2].herkunft };
    return null;
  };
  /* v3006c · Grunderwerbsteuer auf den Kaufpreis ohne ausgewiesenes Inventar (§ 2 GrEStG). */
  const invGr = Math.max(0, z(d.inv_kueche) || 0, z(d.moebl) || 0);
  const grBasis = rk.grestBasis(kp, invGr);
  const posten = [];
  let summe = 0, grest = 0, vollstaendig = true;
  KNK_POSTEN.forEach(([fid, name]) => {
    const s = satzVon(fid);
    if (!s || s.wert == null) { vollstaendig = false; posten.push({ fid: fid, name: name, fehlt: true }); return; }
    const basis = (fid === 'gest_p' ? grBasis : kp);
    const betrag = basis * s.wert / 100;
    if (fid === 'gest_p') grest = betrag;
    summe += betrag;
    posten.push({ fid: fid, name: name, satz: s.wert, quelle: s.quelle, betrag: betrag, basis: basis });
  });
  /* v3289 · Sonstige Nebenkosten (ji_p, % vom Kaufpreis) - calc.js und DealKpis.nebenkosten zaehlen sie
     zur Gesamtinvestition, die Abbildung fuehrte sie nicht (gemessen mit tools/flow-berechnen-pruefen.mjs:
     Nettomietrendite rund 1,3 % zu hoch bei ji_p 1,5). Optional: ohne Wert kein Posten, nichts „unbekannt". */
  const jiP = dez(d.ji_p);
  if (jiP != null && jiP > 0) {
    const betragJi = kp * jiP / 100;
    summe += betragJi;
    posten.push({ fid: 'ji_p', name: 'Sonstige Nebenkosten', satz: jiP, quelle: 'am Objekt', betrag: betragJi, basis: kp });
  }
  r.knk = { posten: posten, summe: summe, grest: grest, vollstaendig: vollstaendig, grBasis: grBasis };

  /* ── Finanzierung, wenn Vorgaben vorliegen ────────────────────────── */
  const zins = satzVon('d1z'), tilg = satzVon('d1t');
  const ekQuote = erg.vom_nutzer.ek_quote != null ? Number(erg.vom_nutzer.ek_quote) : null;
  r.zins = zins; r.tilg = tilg; r.ekQuote = ekQuote;

  /* ── v1925 · Bewirtschaftung genau wie calc.js (detail / percent nkm / percent kp).
     weg_r steckt im Hausgeld und wird NICHT addiert. Fehlt sie, wird nichts geschaetzt. */
  const bwkModus = d._bwk_mode || 'detail';
  let bwkUl = 0, bwkNul = 0, bwkHerkunft = null, bwkArt = null, bwkQu = null, bwkQn = null, bwkQkp = null;
  if (bwkModus === 'percent') {
    if ((d._bwk_pct_mode || 'nkm') === 'kp') {
      const q = dez(d.bwk_kp_pct);
      if (q != null && q > 0) {
        bwkUl = kp * q / 100 * 0.5;
        bwkNul = kp * q / 100 * 0.5;
        bwkArt = 'kp'; bwkQkp = q;
      }
    } else {
      const qu = dez(d.bwk_ul_pct), qn = dez(d.bwk_nul_pct);
      if ((qu != null && qu > 0) || (qn != null && qn > 0)) {
        bwkUl = nkm * 12 * (qu || 0) / 100;
        bwkNul = nkm * 12 * (qn || 0) / 100;
        bwkArt = 'nkm'; bwkQu = qu || 0; bwkQn = qn || 0;
      }
    }
  } else {
    const ulT = ['hg_ul', 'grundsteuer', 'ul_sonst', 'kp1', 'kp2', 'kp3', 'kp4'];
    /* v3289 · #mietausfall zaehlt seit v3238 NICHT mehr in nul - er ist der Leerstand in Euro und kommt
       genau einmal ueber leerstand_pct (calc.js „MIETAUSFALL = LEERSTAND“). Bis hier zaehlte die Abbildung
       ihn doppelt (gemessen am Demo-Konto, VOLL-B: Cashflow 408 EUR/Jahr zu niedrig). Als Zeichen, dass
       Bewirtschaftung hinterlegt ist, gilt er weiter. */
    const nulT = ['hg_nul', 'eigen_r', 'nul_sonst'];
    const sum = (ids) => ids.reduce((a, k2) => a + (z(d[k2]) || 0), 0);
    const hatEtwas = ulT.concat(nulT, ['mietausfall']).some((k2) => z(d[k2]) != null && z(d[k2]) !== 0);
    if (hatEtwas) {
      bwkUl = sum(ulT);
      bwkNul = sum(nulT);
      bwkArt = 'detail';
    }
  }
  bwkHerkunft = bwkArt;
  const bwkDa = bwkHerkunft != null;
  /* v3289 · Erbbauzins (EUR/Jahr) wie calc.js v1312: nicht umlagefaehig, nur mit gesetztem Haken
     Erbbaurecht. Er ersetzt kein Hausgeld - ob bewirtschaftet ist, entscheidet weiter bwkDa. */
  const erbAn = d._erbpacht === true || d._erbpacht === 'true';
  const erbZins = erbAn ? (z(d.erbbauzins) || 0) : 0;
  if (erbZins > 0) bwkNul += erbZins;
  r.bwk = { modus: bwkModus, art: bwkArt, ul: bwkUl, nul: bwkNul, da: bwkDa, erbbauzins: erbZins,
    quote_ul: bwkQu, quote_nul: bwkQn, quote_kp: bwkQkp };

  /* ── Finanzierung und Kennzahlen: EIN Lauf des Kerns (v1925) ──────── */
  let K = null, darlehen = null, ek = null, darlehenGesetzt = false, darlehenAbgeleitet = false;
  if (zins && tilg) {
    const gi = kp + summe;
    ek = ekQuote != null ? gi * ekQuote / 100 : (z(d.ek) || 0);
    /* v1925 · Das Darlehen am Objekt schlaegt jede Ableitung. Abgeleitet (GI minus EK) wird nur,
       solange das Objekt in DealPilot noch keinen gerechneten Score hat - sonst gilt, was
       eingetragen ist, auch die Null (Barkauf). */
    /* v3289 · „In DealPilot gerechnet" heisst: der Browser hat das Objekt gestempelt - nicht nur einen
       Score gespeichert. Gemessen am Demo-Konto: Objekte mit _kpis_* (calc.js/storage.js), aber ohne
       _dealpilot_score, rechnet die App als Barkauf (_kpis_dscr 0, _kpis_ltv 0); die Abbildung leitete
       dort ein Darlehen ab und meldete z. B. Cashflow -8.221 statt 7.526 €/Jahr. */
    const d1Objekt = z(d.d1);
    const browserGerechnet = sGespeichert.dealscore != null
      || (d._kpis_bmy != null && d._kpis_bmy !== '' && d._kpis_dscr != null && d._kpis_dscr !== '');
    darlehenGesetzt = d1Objekt != null && d1Objekt > 0;
    darlehenAbgeleitet = !darlehenGesetzt && !browserGerechnet;
    darlehen = darlehenGesetzt ? d1Objekt
      : (darlehenAbgeleitet ? Math.max(0, gi - ek) : 0);

    /* AfA und Grenzsteuersatz nur, wenn sie am Objekt stehen (v3006b: Gebaeude-AHK aus dem Kern). */
    const gebAnt = dez(d.geb_ant), afaSatz = dez(d.afa_satz);
    const invB = Math.max(0, z(d.inv_kueche) || 0, z(d.moebl) || 0);
    const afa = (gebAnt != null && gebAnt > 0)
      ? rk.gebaeudeAhk({ kp: kp, nk: summe, nkNurImmo: grest, gebAntPct: gebAnt, inventar: invB }).gebAhk
        * ((afaSatz != null ? afaSatz : 2) / 100) : 0;
    /* v3006 · LTV-Basis wie die App: der Wert mit seiner Herkunft (wertangabe). */
    const wa = wertangabe(d);
    const svw = wa.wert || 0;
    const svwHerkunft = svw > 0 ? (wa.herkunft || 'eigene') : null;

    /* v3289 · Leerstand wie calc.js v3238: ohne Prozentsatz wird ein alter Euro-Mietausfall in Prozent der
       Jahresmiete (NKM + Zusatzeinnahmen) umgerechnet - so zaehlt er einmal, nicht gar nicht. */
    let leerPct = dez(d.leerstand) || 0;
    if (!(leerPct > 0)) {
      const maAlt = z(d.mietausfall), mj = (nkm + ze) * 12;
      if (maAlt > 0 && mj > 0) leerPct = maAlt / mj * 100;
    }

    /* v3289 · Darlehen II wie calc.js (Haken _d2_enabled; Tilgungsaussetzung = ohne Tilgung). */
    const d2An = d._d2_enabled === true || d._d2_enabled === 'true';
    const d2 = d2An ? (z(d.d2) || 0) : 0;
    const d2z = d2 > 0 ? (dez(d.d2z) || 0) : 0;
    const d2t = (d2 > 0 && String(d.d2_type || 'annuitaet') !== 'tilgungsaussetzung') ? (dez(d.d2t) || 0) : 0;
    r.d2 = d2;

    K = rk.kpis({
      kp: kp, nk: summe, san: z(d.san) || 0, moebl: z(d.moebl) || 0,
      nkm: nkm, ze: ze, uf: 0,
      bwk_ul: bwkUl, bwk_nul: bwkNul,
      leerstand_pct: leerPct,                  /* v3030: wie calc.js (v3289: alter Euro-Mietausfall umgerechnet) */
      d1: darlehen, d1z: zins.wert, d1t: tilg.wert, ek: ek,
      d2: d2, d2z: d2z, d2t: d2t,
      afa: afa, grenz: dez(d.grenz) || 0,
      ekInklNkLtv: false,                      /* v3213 · W-16 */
      svw: svw,
      svw_herkunft: svwHerkunft,
      bankval: 0                               /* v3003a · steckt in svw mit Herkunft bank */
    });
    r.afa = afa; r.gi = gi;
  }
  r.K = K; r.darlehen = darlehen; r.ek = ek;
  /* v3289 · alle Darlehen (I + II), so wie der Kern sie summiert - fuer Barkauf-Pruefung und Score */
  r.darlehenGesamt = (K && Number.isFinite(K.d_total)) ? K.d_total : darlehen;
  const dGes = r.darlehenGesamt;
  r.darlehenGesetzt = darlehenGesetzt; r.darlehenAbgeleitet = darlehenAbgeleitet;

  /* ── Was dem Score fehlt ─────────────────────────────────────────── */
  const scoreFehlt = [];
  if (!zins || !tilg) scoreFehlt.push('Zinssatz und Tilgung');
  if (!bwkDa) scoreFehlt.push('Hausgeld bzw. Bewirtschaftungskosten');
  r.scoreFehlt = scoreFehlt;

  /* v3006b · Wertpuffer: eine Marktpreisindikation aus Angebotspreisen traegt keinen. Ohne
     Wertangabe die 5-%-Annahme des Quick-Checks (calc.js wp / wp_kpi). */
  const wa2 = wertangabe(d);
  const svwIndikation = (wa2.wert || 0) > 0 && wa2.herkunft === 'indikation';
  const svw2 = svwIndikation ? 0 : (wa2.wert || 0);
  const wp = svw2 > 0 ? svw2 - kp : (svwIndikation ? 0 : kp * 0.05);
  r.svw2 = svw2; r.svwIndikation = svwIndikation; r.wp = wp;
  r.wpAngenommen = !(svw2 > 0) && !svwIndikation;

  /* ── Der Deal-Score aus DealScore.computeFromKpis() — nur mit allem, was er braucht ── */
  r.S = null; r.teilnotenRoh = null;
  if (!scoreFehlt.length) {
    const mstg = dez(d.mietstg) != null ? dez(d.mietstg) : 1.5;
    const eingabe = {
      kp: kp, cf_m: K.cf_m, nmy: K.nmy, ltv: K.ltv, dscr: K.dscr,
      wp_kpi: wp, mstg: mstg,
      darlehen: (dGes != null && isFinite(dGes)) ? dGes : null   /* v2141: Barkauf (v3289: I + II) */
    };
    if (opt.gewichte) eingabe.gewichte = opt.gewichte;   /* v3289: Bewertungsprofil als Parameter */
    r.S = rk.score(eingabe);
    r.mstg = mstg;
    r.teilnotenRoh = {};
    r.S.breakdown.forEach((b) => { r.teilnotenRoh[b.key] = b.score; });
  }

  /* v1938 · EINE Liste, was an diesem Objekt nicht anwendbar ist - Ampel und Kategorien lesen sie. */
  r.nichtAnwendbar = {
    dscr: (dGes > 0) ? null : 'ohne Kapitaldienst gibt es keinen Deckungsgrad',
    ltv: (dGes > 0) ? null : 'am Objekt ist kein Darlehen hinterlegt',
    bwk: bwkDa ? null : 'am Objekt ist keine Bewirtschaftung hinterlegt',
    ekr: (ek > 0) ? null : 'ohne eingesetztes Eigenkapital nicht berechenbar'
  };
  r.bwkQuote = (K && K.nkm_j > 0) ? (K.bwk / K.nkm_j * 100) : null;
  return r;
}

/**
 * bewerten(r, score, opt) — die Heuristik des Quick-Checks zu einem Score.
 *
 * r              Ergebnis von rechnen()
 * score          der geltende Score (gespeichert oder r.S.score)
 * opt.teilnoten  r.teilnotenRoh, nur wenn der Score aus DIESER Rechnung stammt
 * opt.marktBasis / opt.marktGrund   bereinigter Marktwert (v1939)
 * opt.zielBmr    Zielrendite der Lageklasse (zielBmrAusProfil)
 * opt.schwellen  Ampel-Schwellen { dscrGruen, ltvGruen, cfMin } (v2240) - ohne: 1,2 / 90 / 0
 */
function bewerten(r, score, opt) {
  opt = opt || {};
  const rk = opt.kerne || rechenkerne;
  const K = r.K;
  const na = r.nichtAnwendbar;
  const bwkQuote = r.bwkQuote;
  const H = K ? rk.heuristik({
    score: score, kp: r.kp, nkm: r.nkm + r.ze,
    bmr: K.bmy, nmr: K.nmy, cfMon: K.cf_m, dscr: K.dscr, ltv: K.ltv,
    ekr: K.ekr, bewirtPctNkm: bwkQuote || 0,
    marktwert: opt.marktBasis == null ? null : opt.marktBasis,
    marktwert_grund: opt.marktGrund == null ? null : opt.marktGrund,
    zielBmr: opt.zielBmr == null ? null : opt.zielBmr, lageklasse: r.lageklasse
  }, undefined, na) : null;
  return {
    H: H,
    stufensatz: H ? rk.heuristikTeil('stufensatz', rk.stufe(score).farbe) : undefined,
    ampel: K ? rk.heuristikTeil('kennzahlenAmpel',
      { bmr: K.bmy, nmr: K.nmy, ekr: K.ekr, cfMon: K.cf_m,
        dscr: K.dscr, ltv: K.ltv, bewirtPctNkm: bwkQuote || 0,
        zielBmr: opt.zielBmr == null ? null : opt.zielBmr, lageklasse: r.lageklasse }, na,
      opt.schwellen || {}) : undefined,
    kategorien: K ? rk.heuristikTeil('kategorien',
      { bmr: K.bmy, nmr: K.nmy, ekr: K.ekr, cfMon: K.cf_m,
        dscr: K.dscr, ltv: K.ltv, bewirtPctNkm: bwkQuote || 0,
        kp: r.kp, wp: r.wp },
      opt.teilnoten || null, na) : undefined
  };
}

module.exports = { rechnen, bewerten, wertangabe, zielBmrAusProfil, z, dez, KNK_POSTEN };
