// beleihungswert.js  (v2630)
//
// INDIKATIVER BELEIHUNGSWERT-CHECK nach der Beleihungswertermittlungsverordnung
// (BelWertV i. d. F. vom 04.10.2022, BGBl. I 2022, 1713). Kein Gutachten nach
// § 5 BelWertV, keine Beleihungswertfestsetzung (§ 16 Abs. 1 PfandBG) - eine
// Naeherung aus dem Marktbericht, damit der Kunde vor dem Bankgespraech weiss,
// wo die Bank ungefaehr landen wird.
//
// Marcel 21.10.2026 (E8 freigegeben): im Bank-Export, klar getrennt vom
// Verkehrswert, nie als Gutachten bezeichnet.
//
// REINER KERN. Liest keine Einstellungen, keine Datenbank, keine Uhr. Was
// sich am Markt aendert (Mindestkapitalisierungszins der BaFin, Rendite der
// 30-jaehrigen Bundesanleihe), kommt als PARAMETER; die Zahlen der Verordnung
// selbst stehen hier als benannte Konstanten mit Paragraf.
//
// Wortlaut nachgelesen am 21.10.2026 auf gesetze-im-internet.de/belwertv
// (§§ 4, 9, 10, 11, 12, 16, 19, 24, Anlagen 1-3) und /pfandbg (§§ 14, 16);
// Mindestsaetze gegen die Bekanntgabe der BaFin (Pfandbriefbanken ->
// Bekanntgabe BelWertV: seit 01.01.2024 Wohnen 5,5 %, Gewerbe 6,5 %) und
// eine Fachveroeffentlichung vom 08.12.2025 (unveraendert auch 2026).

export const VERSION = 'v2630b';

/* ── Zahlen der Verordnung ─────────────────────────────────────────── */
export const BELWERTV = Object.freeze({
  bwk_min_quote: 0.15,             // § 11 Abs. 2 Satz 3: Verwaltung + Instandhaltung + Mietausfall >= 15 % des Rohertrags
  mietausfall_wohnen: 0.02,        // Anlage 1, Mietausfallwagnis a) Wohnungsbau
  mietausfall_gewerbe: 0.04,       // Anlage 1, Mietausfallwagnis b) gewerbliche Objekte
  verwaltung_gewerbe: 0.01,        // Anlage 1, Verwaltungskosten b) 1 % des Jahresrohertrags
  instandhaltung_wohnen_hk: 0.005, // Anlage 1, Instandhaltung b) 0,5 % der Herstellungskosten (Wohngebaeude, mittlerer Standard)
  aufschlag_wohnen_pp: 3,          // § 12 Abs. 4 Satz 1
  aufschlag_gewerbe_pp: 4,
  korridor_wohnen: [3.5, 5.5],     // § 12 Abs. 4 Satz 3
  korridor_gewerbe: [4.5, 6.5],
  sicherheitsabschlag_hk: 0.10,    // § 16 Abs. 2
  aussenanlagen_max: 0.05,         // § 16 Abs. 1 Satz 4 (im Regelfall)
  sicherheitsabschlag_vergleich: 0.10, // § 19 Abs. 1 Satz 2
  abweichung_pruefung: 0.20,       // § 4 Abs. 1 Satz 3
  nd_max_wohnen: 80,               // Anlage 2 A
  nd_max_gewerbe: 60,              // Anlage 2 B a) Geschaefts- und Buerohaeuser
  beleihungsgrenze: 0.60,          // § 14 PfandBG
  kleindarlehen_eur: 600000,       // § 24 Abs. 1 Satz 1
  kleindarlehen_gewerbe_max: 1 / 3, // § 24 Abs. 1 Satz 2
});

const n = (x) => (x === null || x === undefined || x === '' ? null : (Number.isFinite(Number(x)) ? Number(x) : null));
const r0 = (x) => Math.round(x);
const r2 = (x) => Math.round(x * 100) / 100;
const de = (x, d = 0) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 1) => de(x, d) + ' %';

/** Vervielfaeltiger nach § 12 Abs. 1 BelWertV: V = (q^n - 1) / (q^n * z). */
export function vervielfaeltiger(zinsPct, rndJahre) {
  const z = zinsPct / 100, nn = rndJahre;
  if (!(z > 0) || !(nn > 0)) return null;
  const qn = Math.pow(1 + z, nn);
  return (qn - 1) / (qn * z);
}

/** Mindestkapitalisierungszins (§ 12 Abs. 4) fuer 'wohnen' oder 'gewerbe'.
 *  Rangfolge: 1. der von der BaFin bekanntgegebene Satz (das ist der geltende,
 *  weil Satz 2 eine Anpassungsregel mit Schwelle hat - die Rendite allein
 *  bestimmt ihn nicht), 2. aus der Rendite abgeleitet (gerundet + Aufschlag,
 *  im Korridor), 3. ohne beides die Untergrenze des Korridors - gekennzeichnet. */
export function mindestzins(parameter, nutzung) {
  const P = parameter || {};
  const gew = nutzung === 'gewerbe';
  const kor = gew ? BELWERTV.korridor_gewerbe : BELWERTV.korridor_wohnen;
  const auf = gew ? BELWERTV.aufschlag_gewerbe_pp : BELWERTV.aufschlag_wohnen_pp;
  const mz = P.mindestzins || {};
  const rend = P.rendite_30j || {};
  const rPct = n(rend.pct);
  const abgeleitet = rPct != null ? Math.min(kor[1], Math.max(kor[0], Math.round(rPct * 10) / 10 + auf)) : null;
  const bafin = n(gew ? mz.gewerbe_pct : mz.wohnen_pct);
  if (bafin != null) {
    return { pct: bafin, herkunft: 'bafin', gueltig_ab: mz.gueltig_ab || null, quelle: mz.quelle || null,
             rendite_pct: rPct, rendite_datum: rend.datum || null, abgeleitet_pct: abgeleitet,
             text: 'Mindestkapitalisierungszins ' + (gew ? 'Gewerbe' : 'Wohnen') + ' ' + pct(bafin) + ' (§ 12 Abs. 4 BelWertV, von der BaFin bekanntgegeben'
               + (mz.gueltig_ab ? ', gültig seit ' + mz.gueltig_ab : '') + ')' };
  }
  if (abgeleitet != null) {
    return { pct: abgeleitet, herkunft: 'rendite', rendite_pct: rPct, rendite_datum: rend.datum || null, quelle: rend.quelle || null,
             text: 'Mindestkapitalisierungszins ' + pct(abgeleitet) + ' aus der Rendite 30-jähriger Bundesanleihen ' + pct(rPct, 2)
               + (rend.datum ? ' (' + rend.datum + ')' : '') + ' + ' + auf + ' Prozentpunkte, im Korridor ' + pct(kor[0]) + '–' + pct(kor[1])
               + ' - ohne die Anpassungsregel des § 12 Abs. 4 Satz 2, daher nur eine Näherung' };
  }
  return { pct: kor[0], herkunft: 'untergrenze', rendite_pct: null,
           text: 'Kein aktueller Mindestzins hinterlegt: gerechnet mit der Untergrenze des Korridors ' + pct(kor[0])
             + ' (§ 12 Abs. 4 Satz 3). Der geltende Satz kann deutlich höher liegen - der Beleihungswert ist damit eher zu hoch.' };
}

/* ── Eingaben aus dem gespeicherten Bericht (cross_check) ──────────── */
const zeile = (staffel, re) => (Array.isArray(staffel) ? staffel.find((z) => z && re.test(String(z.pos || ''))) : null) || null;
const zw = (staffel, re) => { const z = zeile(staffel, re); return z ? n(z.wert) : null; };

/** Liest aus `data.cross_check` eines Berichts die Groessen, die der Check
 *  braucht. Rechnet nichts neu - nur Umsortieren und Lesen. */
export function eingabenAusBericht(cc, extra) {
  const X = extra || {};
  if (!cc || typeof cc !== 'object') return null;
  const ew = cc.ertragswert || {};
  const sw = cc.sachwert || {};
  const st = Array.isArray(ew.staffel) ? ew.staffel : [];
  const auft = ew.miete_aufteilung || null;
  const marktQm = n(ew.miete_vergleich_qm) ?? n(ew.miete_band && ew.miete_band.angebot_qm) ?? n(ew.miete_qm);
  const reWohnen = zw(st, /^Rohertrag Wohnen/);
  const einheiten = [];
  if (auft && Array.isArray(auft.einheiten) && auft.einheiten.length) {
    auft.einheiten.forEach((e) => {
      const leer = e.herkunft === 'leer_marktueblich' || n(e.ist_qm) == null;
      einheiten.push({ nr: e.nr || null, wfl: n(e.wfl), leer,
        vertrag_jahr: leer ? null : (e.herkunft === 'ist_im_band' && n(e.jahr) != null ? n(e.jahr) : r0(n(e.ist_qm) * n(e.wfl) * 12)),
        ansatz_bericht_jahr: n(e.jahr) });
    });
  } else if (auft && n(auft.wfl_vermietet) != null) {
    const istQm = n(ew.miete_ist_qm);
    if (n(auft.wfl_vermietet) > 0) einheiten.push({ nr: 'vermietet', wfl: n(auft.wfl_vermietet), leer: false,
      vertrag_jahr: istQm != null ? r0(istQm * n(auft.wfl_vermietet) * 12) : null, ansatz_bericht_jahr: n(auft.jahr_vermietet) });
    if (n(auft.wfl_leer) > 0) einheiten.push({ nr: 'leer', wfl: n(auft.wfl_leer), leer: true, vertrag_jahr: null, ansatz_bericht_jahr: n(auft.jahr_leer) });
  } else if (reWohnen != null && n(ew.miete_qm) > 0) {
    const wfl = r2(reWohnen / (n(ew.miete_qm) * 12));
    const istQm = n(ew.miete_ist_qm);
    einheiten.push({ nr: 'Wohnen', wfl, leer: false, vertrag_jahr: istQm != null ? r0(istQm * wfl * 12) : null, ansatz_bericht_jahr: reWohnen });
  } else if (reWohnen != null) {
    /* aeltere Berichte (vor v1059) fuehren keine Miete je m2: nur der Rohertrag */
    einheiten.push({ nr: 'Wohnen', wfl: null, leer: false, vertrag_jahr: null, ansatz_bericht_jahr: reWohnen });
  }
  const sv = zeile(st, /^Stellpl/);
  const hk = zw(sw.staffel, /^= Herstellungskosten/);
  const awm = zw(sw.staffel, /Alterswertminderung/);
  const aussen = zw(sw.staffel, /Au(ß|ss)enanlagen/);
  const avf = cc.amtlicher_vergleichsfaktor || {};
  const vgl = cc.comparison || {};
  const verf = cc.verfahrenswahl && cc.verfahrenswahl.verfahren;
  /* Vergleichswert nur, wenn amtlich (Vergleichsfaktor des Ausschusses) - ein Wert aus
     Angebotspreisen ist kein Verkehrswert und taugt nicht als Deckel (Baeckerstr. 7, v2630b). */
  const wertVon = { ertragswert: n(ew.value_eur), sachwert: n(sw.value_eur), vergleichswert: avf.verfuegbar ? n(vgl.vergleichswert_eur) : null };
  return {
    objektart: X.objektart || (cc.ref && cc.ref.property_type) || null,
    wohnen: { einheiten, markt_qm: marktQm, rohertrag_bericht_jahr: reWohnen },
    stellplaetze: sv ? { jahr: n(sv.wert), text: sv.pos } : null,
    sonstige_ertraege: zeile(st, /sonstige Ertr/) ? zw(st, /sonstige Ertr/) : null,
    gewerbe: zw(st, /^Rohertrag Gewerbe/) != null
      ? { ansatz_jahr: zw(st, /^Rohertrag Gewerbe/), vertrag_jahr: n(X.gewerbe_vertrag_jahr), anteil_pct: n(cc.gewerbeanteil_pct) } : null,
    bwk: { verwaltung: zw(st, /^Verwaltung/), instandhaltung: zw(st, /^Instandhaltung/), mietausfall: zw(st, /^Mietausfall/),
           summe: n(ew.bwk_pa_eur), rohertrag: n(ew.rohertrag_pa_eur) },
    bodenwert: n(ew.bodenwert_eur) ?? n(sw.bodenwert_eur),
    rnd_jahre: n(ew.restnutzungsdauer_jahre) ?? n(sw.restnutzungsdauer_jahre),
    gnd_jahre: n(ew.gesamtnutzungsdauer_jahre) ?? n(sw.gesamtnutzungsdauer_jahre),
    lzs_pct: n(ew.liegenschaftszins_pct),
    lzs_stufe: ew.liegenschaftszins_stufe || null,
    ertragswert_bericht: n(ew.value_eur),
    sachwert: (sw.available && hk != null && awm != null)
      ? { hk_gebaeude: hk, alterswertminderung: awm, aussenanlagen: aussen || 0,
          gebaeude_sachwert: n(sw.gebaeude_sachwert_eur), bodenwert: n(sw.bodenwert_eur), wert_bericht: n(sw.value_eur) } : null,
    vergleichswert: (avf.verfuegbar && n(vgl.vergleichswert_eur)) ? { wert: n(vgl.vergleichswert_eur), amtlich: true } : null,
    verkehrswert: (verf && wertVon[verf]) || wertVon.ertragswert || wertVon.sachwert || null,
    verkehrswert_verfahren: (verf && wertVon[verf]) ? verf : (wertVon.ertragswert ? 'ertragswert' : (wertVon.sachwert ? 'sachwert' : null)),
    darlehen: n(X.darlehen),
  };
}

const ERKLAERUNGEN = Object.freeze({
  beleihungswert: 'Der Wert, den eine Bank einer Immobilie auf lange Sicht sicher zutraut - vorsichtiger als der Verkehrswert, weil er auch in schwächeren Marktphasen halten soll (§ 3 BelWertV).',
  nachhaltige_miete: 'Die Miete, die dauerhaft jeder Eigentümer erzielen kann. Liegt die vereinbarte Miete darunter, zählt die vereinbarte (§ 10 Abs. 1). Liegt sie darüber, zählt nur die nachhaltige.',
  bewirtschaftungskosten: 'Verwaltung, Instandhaltung und Mietausfallwagnis - zusammen mindestens 15 % des Rohertrags (§ 11 Abs. 2).',
  kapitalisierungszins: 'Der Zins, mit dem die Bank die Erträge in einen Wert umrechnet. Er darf eine Untergrenze nicht unterschreiten, die die BaFin aus der Rendite 30-jähriger Bundesanleihen festlegt (§ 12 Abs. 4).',
  sicherheitsabschlag: 'Abschlag von mindestens 10 % auf die Herstellungskosten, damit der Wert auch sinkende Baupreise übersteht (§ 16 Abs. 2).',
  beleihungsauslauf: 'Darlehen geteilt durch Beleihungswert. Bis 60 % des Beleihungswerts gilt ein Darlehen als erstrangiger Realkredit (§ 14 PfandBG) - darüber verlangen Banken meist einen Zinsaufschlag.',
  kleindarlehen: 'Bis 600.000 € Darlehen (alle Vorlasten eingerechnet) darf die Bank bei Wohnobjekten statt eines Gutachtens eine vereinfachte Wertermittlung verwenden (§ 24 BelWertV).',
});

/** § 16 Abs. 2: Sachwert mit Sicherheitsabschlag auf die Herstellungskosten. */
export function sachwertBel(sw, bwFallback) {
  if (!sw || !(n(sw.hk_gebaeude) > 0)) return null;
  const hkv = n(sw.hk_gebaeude), awm = n(sw.alterswertminderung) || 0;
  const altersfaktor = (hkv + awm) / hkv;
  const hkBel = hkv * (1 - BELWERTV.sicherheitsabschlag_hk);
  const gebBel = hkBel * altersfaktor;
  const rest = Math.max(0, (n(sw.gebaeude_sachwert) || 0) - (hkv + awm) - (n(sw.aussenanlagen) || 0)); // z. B. Garage
  const aussen = Math.min(n(sw.aussenanlagen) || 0, BELWERTV.aussenanlagen_max * hkBel * altersfaktor);
  const bwS = n(sw.bodenwert) ?? n(bwFallback) ?? 0;
  const wert = r0(gebBel + rest * (1 - BELWERTV.sicherheitsabschlag_hk) + aussen + bwS);
  return { herstellungskosten: r0(hkv), sicherheitsabschlag: r0(hkv - hkBel), herstellungswert_vermindert: r0(hkBel),
    altersfaktor: Math.round(altersfaktor * 1000) / 1000, gebaeude: r0(gebBel), sonstige_anlagen: r0(rest * (1 - BELWERTV.sicherheitsabschlag_hk)),
    aussenanlagen: r0(aussen), bodenwert: r0(bwS), wert, sachwert_bericht: n(sw.wert_bericht) };
}

/* § 4 Abs. 2: bei EZFH und Wohnungseigentum darf sich der Beleihungswert am
   Sach- oder Vergleichswert orientieren - nur bei zweifelsfreier Eignung zur
   Eigennutzung. Ohne Ertragswert zeigen wir genau das, gekennzeichnet. */
function ohneErtragswert(E, out, grund) {
  const art = String(E.objektart || '').toLowerCase();
  const ezfhEtw = /efh|zfh|einfamil|zweifamil|dhh|doppel|reihen|rh|etw|wohnung/.test(art);
  const sw = sachwertBel(E.sachwert, E.bodenwert);
  const vg = E.vergleichswert && n(E.vergleichswert.wert) ? r0(n(E.vergleichswert.wert) * (1 - BELWERTV.sicherheitsabschlag_vergleich)) : null;
  const k = vg != null ? { art: 'vergleichswert', wert: vg } : (sw ? { art: 'sachwert', wert: sw.wert } : null);
  if (!ezfhEtw || !k) { out.grund = grund + ' - ohne Ertragswert des Marktberichts (Stufe 3) ist kein Check möglich.'; return out; }
  let wert = k.wert; const vw = n(E.verkehrswert);
  if (vw != null && wert > vw) wert = vw;
  out.hinweise.push('Kein Ertragswert: bei Ein-/Zweifamilienhäusern und Eigentumswohnungen darf sich die Bank am '
    + (k.art === 'sachwert' ? 'Sachwert' : 'Vergleichswert') + ' orientieren - aber nur, wenn das Objekt zweifelsfrei zur Eigennutzung taugt und dauerhaft nachgefragt wird (§ 4 Abs. 2 BelWertV). Ist es vermietet, zieht die Bank dafür noch etwas ab.');
  const bwG = Math.floor(wert / 1000) * 1000;
  Object.assign(out, { verfuegbar: true, beleihungswert: bwG, basis: k.art + '_4_2',
    verkehrswert: vw, verkehrswert_verfahren: E.verkehrswert_verfahren || null, verhaeltnis_zum_verkehrswert_pct: vw ? r2(bwG / vw * 100) : null, sachwert: sw, vergleichswert: vg != null ? { wert: vg, ausgang: n(E.vergleichswert.wert) } : null, ertragswert: null });
  return out;
}

/** Der Check. eingaben aus eingabenAusBericht(), parameter aus der Konfiguration. */
export function beleihungswert(eingaben, parameter) {
  const E = eingaben || {};
  const hinweise = [];
  const out = { version: VERSION, verfuegbar: false, indikativ: true,
    kennzeichnung: 'Indikativer Beleihungswert-Check nach BelWertV - kein Beleihungswertgutachten nach § 5 BelWertV und keine Festsetzung durch die Bank.',
    erklaerungen: ERKLAERUNGEN, hinweise };
  const rnd = n(E.rnd_jahre), bw = n(E.bodenwert);
  const W = E.wohnen || { einheiten: [] };

  /* ── § 10 Rohertrag: je Einheit min(Vertragsmiete, nachhaltige Miete) ── */
  const marktQm = n(W.markt_qm);
  let reWohnen = 0, vertragFehlt = 0, leerN = 0, overN = 0, underN = 0;
  const einh = (W.einheiten || []).map((e) => {
    const wfl = n(e.wfl) || 0;
    const nachhaltig = (marktQm != null && wfl > 0) ? r0(marktQm * wfl * 12) : n(e.ansatz_bericht_jahr);
    let ansatz, grund;
    if (e.leer) { ansatz = nachhaltig; grund = 'leer: nachhaltige Miete angesetzt'; leerN++; }
    else if (n(e.vertrag_jahr) == null) { ansatz = n(e.ansatz_bericht_jahr) ?? nachhaltig; grund = 'Vertragsmiete nicht erfasst: Ansatz des Berichts'; vertragFehlt++; }
    else if (nachhaltig != null && n(e.vertrag_jahr) > nachhaltig) { ansatz = nachhaltig; grund = 'über der nachhaltigen Miete: gedeckelt'; overN++; }
    else { ansatz = n(e.vertrag_jahr); grund = (nachhaltig != null && n(e.vertrag_jahr) < nachhaltig) ? 'unter der nachhaltigen Miete: Vertragsmiete zählt' : 'Vertragsmiete'; if (nachhaltig != null && n(e.vertrag_jahr) < nachhaltig) underN++; }
    reWohnen += ansatz || 0;
    return { nr: e.nr, wfl, vertrag_jahr: n(e.vertrag_jahr), nachhaltig_jahr: nachhaltig, ansatz_jahr: ansatz, grund };
  });
  const stp = E.stellplaetze && n(E.stellplaetze.jahr) ? n(E.stellplaetze.jahr) : 0;
  const G = E.gewerbe || null;
  let reGew = 0;
  if (G) {
    const a = n(G.ansatz_jahr) || 0, v = n(G.vertrag_jahr);
    reGew = v != null ? Math.min(a, v) : a;
    if (v == null) hinweise.push('Gewerbe: Vertragsmiete nicht getrennt erfasst - angesetzt ist die Gewerbemiete des Berichts (' + de(a) + ' €/Jahr). Liegt die Vertragsmiete darunter, zählt sie.');
  }
  if (!einh.length && !reGew) return ohneErtragswert(E, out, 'Kein Rohertrag im Bericht');
  if (!(rnd > 0)) return ohneErtragswert(E, out, 'Keine Restnutzungsdauer im Bericht');
  if (leerN) hinweise.push(leerN + ' leere Einheit(en) mit der nachhaltigen Miete angesetzt. Banken prüfen Leerstand besonders (§ 10 Abs. 4) - eine Vermietung vor dem Termin stärkt die Unterlage.');
  if (vertragFehlt) hinweise.push(vertragFehlt + ' Einheit(en) ohne erfasste Vertragsmiete - dort steht der Ansatz des Berichts.');
  if (stp) hinweise.push('Stellplätze wie im Bericht angesetzt (' + de(stp) + ' €/Jahr).');
  const reBel = r0(reWohnen + stp + reGew);
  const reBericht = n(E.bwk && E.bwk.rohertrag);
  const anteilGew = reBel > 0 ? reGew / reBel : 0;

  /* ── § 11 Bewirtschaftungskosten ── */
  const B = E.bwk || {};
  const sw = E.sachwert || null;
  const verwM = n(B.verwaltung), instM = n(B.instandhaltung), mawM = n(B.mietausfall), sumM = n(B.summe);
  const teileBekannt = verwM != null && instM != null && mawM != null;
  const mawQuoteM = (mawM != null && reBericht > 0) ? mawM / reBericht : null;
  const mawMin = BELWERTV.mietausfall_wohnen * (reBel - reGew) + BELWERTV.mietausfall_gewerbe * reGew;
  const maw = Math.max(mawQuoteM != null ? mawQuoteM * reBel : 0, mawMin);
  const verw = Math.max(verwM || 0, BELWERTV.verwaltung_gewerbe * reGew);   // Wohnen: Anlage 1 a) = Anlage 3 ImmoWertV, also der Modellansatz
  const instMin = sw && n(sw.hk_gebaeude) ? BELWERTV.instandhaltung_wohnen_hk * n(sw.hk_gebaeude) : 0;
  const inst = Math.max(instM || 0, instMin);
  const sonst = (teileBekannt && sumM != null) ? Math.max(0, sumM - verwM - instM - mawM) : 0;
  /* Nur Summe bekannt (Quote des Ausschusses, z. B. 27 %): die Quote auf den
     Rohertrag der Bank, mindestens das Mietausfallwagnis der Anlage 1. */
  const quoteM = (sumM != null && reBericht > 0) ? sumM / reBericht : null;
  let bwkEinzeln = teileBekannt ? verw + inst + maw + sonst : Math.max(quoteM != null ? quoteM * reBel : (sumM || 0), mawMin);
  const bwkMin15 = BELWERTV.bwk_min_quote * reBel;
  /* Einzelansaetze bekannt: sie sind die kalkulierten Kosten (§ 11 Abs. 2 Satz 4) -
     das Mietausfallwagnis faellt mit dem Rohertrag, die Summe des Modells nicht.
     Unbekannt: die Summe des Modells als Untergrenze. */
  const bwk = r0(Math.max(bwkEinzeln, bwkMin15));
  const bwkWeg = bwkMin15 > bwkEinzeln ? 'mindestquote_15' : 'einzelansaetze';
  if (bwkWeg === 'mindestquote_15') hinweise.push('Bewirtschaftungskosten auf die Mindesthöhe von 15 % des Rohertrags angehoben (§ 11 Abs. 2 Satz 3): ' + de(bwk) + ' € statt ' + de(r0(bwkEinzeln)) + ' €.');
  if (teileBekannt && instMin > (instM || 0)) hinweise.push('Instandhaltung auf den Mindestsatz 0,5 % der Herstellungskosten angehoben (Anlage 1 BelWertV).');
  if (!teileBekannt) hinweise.push('Der Bericht führt die Bewirtschaftungskosten als Quote (' + (quoteM != null ? pct(quoteM * 100) : 'Summe') + '), nicht einzeln - geprüft wurden die Mindestquote von 15 % und das Mietausfallwagnis.');
  if (n(E.sonstige_ertraege)) hinweise.push('Sonstige Erträge des Berichts sind nicht angesetzt - die Bank rechnet nur mit der nachhaltigen Miete.');

  /* ── § 12 Kapitalisierung, je Nutzung getrennt (Abs. 3 Satz 3) ── */
  const mzW = mindestzins(parameter, 'wohnen');
  const mzG = G ? mindestzins(parameter, 'gewerbe') : null;
  const lzs = n(E.lzs_pct);
  const zW = Math.max(mzW.pct, lzs || 0);
  const zG = mzG ? Math.max(mzG.pct, lzs || 0) : null;
  if (mzW.herkunft === 'untergrenze') hinweise.push(mzW.text);
  const rein = reBel - bwk;
  const teile = [];
  const teil = (name, anteil, zins) => {
    const reinT = rein * anteil, bwT = (bw || 0) * anteil;
    const verz = bwT * zins / 100;
    const ndMax = name === 'gewerbe' ? BELWERTV.nd_max_gewerbe : BELWERTV.nd_max_wohnen;
    const nT = Math.min(rnd, ndMax);
    const V = vervielfaeltiger(zins, nT);
    const geb = (reinT - verz) * V;
    teile.push({ nutzung: name, anteil: r2(anteil * 100), zins_pct: zins, rnd_jahre: nT, reinertrag: r0(reinT),
      bodenwertverzinsung: r0(verz), gebaeudereinertrag: r0(reinT - verz), vervielfaeltiger: r2(V), gebaeudeertragswert: r0(geb) });
    return geb;
  };
  let gebEW = teil('wohnen', 1 - anteilGew, zW);
  if (G && anteilGew > 0) gebEW += teil('gewerbe', anteilGew, zG);
  if (teile.some((t) => t.gebaeudereinertrag <= 0)) hinweise.push('Der Reinertrag deckt die Verzinsung des Bodenwerts nicht: das Gebäude trägt beim Mindestzins keinen eigenen Ertrag. Banken prüfen dann besonders, ob das Objekt überhaupt ertragsfähig ist.');
  const ewBel = r0(gebEW + (bw || 0));

  /* ── § 16 Sachwert mit Sicherheitsabschlag ── */
  const swWeg = sachwertBel(sw, bw);
  const swBel = swWeg ? swWeg.wert : null;
  /* ── § 19 Vergleichswert (nur amtlich) ── */
  const vgBel = E.vergleichswert && n(E.vergleichswert.wert) ? r0(n(E.vergleichswert.wert) * (1 - BELWERTV.sicherheitsabschlag_vergleich)) : null;

  /* ── § 4 Abs. 1: Ertragswert maßgeblich, Kontrollwert ── */
  const kontroll = swBel != null ? { art: 'sachwert', wert: swBel } : (vgBel != null ? { art: 'vergleichswert', wert: vgBel } : null);
  let abw = null, pruefung = false;
  if (kontroll && ewBel > 0) {
    abw = r2((kontroll.wert - ewBel) / ewBel * 100);
    pruefung = kontroll.wert < ewBel * (1 - BELWERTV.abweichung_pruefung);
    if (pruefung) hinweise.push('Der ' + (kontroll.art === 'sachwert' ? 'Sachwert' : 'Vergleichswert') + ' liegt ' + de(Math.abs(abw), 1) + ' % unter dem Ertragswert. Ab 20 % prüft die Bank, ob Miete und Zins wirklich nachhaltig sind (§ 4 Abs. 1 Satz 3) - und mindert den Ertragswert, wenn sich das nicht begründen lässt.');
  }
  let wert = ewBel, basis = 'ertragswert';
  const vw = n(E.verkehrswert);
  if (vw != null && wert > vw) { wert = vw; basis = 'marktwert_deckel'; hinweise.push('Gedeckelt auf den Verkehrswert des Berichts (' + de(vw) + ' €): der Beleihungswert darf den Marktwert nicht übersteigen (§ 16 Abs. 2 PfandBG).'); }
  const wertGerundet = Math.floor(wert / 1000) * 1000;

  /* ── Beleihungsauslauf ── */
  const darl = n(E.darlehen);
  const auslauf = (darl != null && darl > 0 && wertGerundet > 0) ? {
    darlehen: r0(darl), auslauf_pct: r2(darl / wertGerundet * 100),
    grenze_60_eur: r0(wertGerundet * BELWERTV.beleihungsgrenze),
    ueber_60: darl > wertGerundet * BELWERTV.beleihungsgrenze,
    text: 'Beleihungsauslauf ' + pct(darl / wertGerundet * 100) + ' (Darlehen ' + de(darl) + ' € / Beleihungswert ' + de(wertGerundet) + ' €). '
      + (darl > wertGerundet * BELWERTV.beleihungsgrenze ? 'Über der 60-%-Grenze des § 14 PfandBG (' + de(r0(wertGerundet * 0.6)) + ' €) - der Teil darüber gilt bei der Bank nicht als erstrangiger Realkredit.' : 'Innerhalb der 60-%-Grenze des § 14 PfandBG.'),
  } : null;
  const klein = darl != null && darl > 0 ? {
    moeglich: darl <= BELWERTV.kleindarlehen_eur && anteilGew <= BELWERTV.kleindarlehen_gewerbe_max,
    text: (darl <= BELWERTV.kleindarlehen_eur && anteilGew <= BELWERTV.kleindarlehen_gewerbe_max)
      ? 'Darlehen bis 600.000 €: die Bank darf eine vereinfachte Wertermittlung statt eines Gutachtens verwenden (§ 24 BelWertV), sofern keine weiteren Vorlasten bestehen.'
      : (darl > BELWERTV.kleindarlehen_eur ? 'Darlehen über 600.000 €: die Bank braucht ein Beleihungswertgutachten (§ 5 BelWertV).' : 'Gewerbeanteil über einem Drittel des Rohertrags: keine vereinfachte Wertermittlung nach § 24.'),
  } : null;

  Object.assign(out, {
    verfuegbar: true,
    beleihungswert: wertGerundet, basis,
    verkehrswert: vw, verkehrswert_verfahren: E.verkehrswert_verfahren || null,
    verhaeltnis_zum_verkehrswert_pct: vw ? r2(wertGerundet / vw * 100) : null,
    ertragswert: { wert: ewBel, rohertrag: reBel, rohertrag_bericht: reBericht, rohertrag_wohnen: r0(reWohnen), stellplaetze: r0(stp), rohertrag_gewerbe: r0(reGew),
      gewerbeanteil_pct: r2(anteilGew * 100), einheiten: einh, overrent_n: overN, underrent_n: underN, leer_n: leerN,
      bwk: { summe: bwk, quote_pct: reBel > 0 ? r2(bwk / reBel * 100) : null, weg: bwkWeg, verwaltung: r0(verw), instandhaltung: r0(inst), mietausfall: r0(maw), sonstige: r0(sonst),
             modell_summe: sumM, mindestquote_eur: r0(bwkMin15) },
      reinertrag: r0(rein), bodenwert: bw, lzs_bericht_pct: lzs, lzs_stufe: E.lzs_stufe || null,
      zins_wohnen_pct: zW, zins_gewerbe_pct: zG, zins_angehoben: lzs == null || zW > lzs,
      mindestzins_wohnen: mzW, mindestzins_gewerbe: mzG, rnd_jahre: rnd, teile, ertragswert_bericht: n(E.ertragswert_bericht) },
    sachwert: swWeg, vergleichswert: vgBel != null ? { wert: vgBel, ausgang: n(E.vergleichswert.wert) } : null,
    kontrolle: kontroll ? { art: kontroll.art, wert: kontroll.wert, abweichung_pct: abw, besondere_pruefung: pruefung } : null,
    auslauf, kleindarlehen: klein,
  });
  if (lzs != null && zW > lzs) hinweise.unshift('Kapitalisierungszins ' + pct(zW) + ' statt des Liegenschaftszinses ' + pct(lzs) + ' aus dem Bericht: Banken dürfen den Mindestzins des § 12 Abs. 4 nicht unterschreiten. Das ist der größte Unterschied zum Verkehrswert.');
  if (overN) hinweise.unshift(overN + ' Einheit(en) über der nachhaltigen Miete: auf die nachhaltige Miete gedeckelt (§ 10 Abs. 1).');
  return out;
}
