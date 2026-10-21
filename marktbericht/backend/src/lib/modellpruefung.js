// modellpruefung.js — v2595 · Passt der Liegenschaftszins zu DIESEM Objekt?
// ─────────────────────────────────────────────────────────────────────────────
// § 10 ImmoWertV: ein Liegenschaftszinssatz gilt nur im Modell, aus dem er
// abgeleitet wurde. Die Gutachterausschüsse veröffentlichen zu jedem Satz die
// Durchschnitte ihrer Stichprobe (Ø Miete, Ø Restnutzungsdauer, Ø Objektgröße,
// Definition des Rohertrags). Liegt das bewertete Objekt weit außerhalb dieser
// Stichprobe, ist der Zins zwar amtlich, passt aber nur eingeschränkt.
//
// Gutachterprüfung 21.10.2026, Bismarckstr. 27 Detmold: angesetzt 9,66 €/m²,
// der Satz des Kreises Lippe (MFH 2025) ist aus Kauffällen mit Ø 6,70 €/m²
// abgeleitet — 44 % darüber. Bis v2594 hieß das „miete_modellkonform: true",
// weil die Ist-Miete im Band lag. Das Band prüft die MARKTÜBLICHKEIT der Miete,
// nicht ob der Zins zu ihr passt; beides sind verschiedene Fragen.
//
// Diese Prüfung ÄNDERT KEINEN WERT. Sie stellt Satz und Ansatz nebeneinander,
// beziffert die Abweichung und meldet sie (Belastbarkeit, Bericht, Pilot-Tafel).
//
// Feldnamen gemessen am 21.10.2026 über alle Registerdateien (3.661 Sätze
// liegenschaftszinssatz, Schlüssel in `modellansaetze`), Zahlen nur dort:
//   Miete   marktmiete_eur_qm 1.535 · nettokaltmiete_eur_qm 10 · mietspiegelmiete_eur_qm 1
//           („marktmiete", „miete", „mietansatz" sind TEXT: die Definition)
//   RND     restnutzungsdauer_mittel 1.539 · rnd_jahre 10
//           („restnutzungsdauer" ist fast immer Text, einmal ein Objekt)
//   Fläche  objektgroesse_qm 1.513 · mittlere_wohnflaeche_qm 7 · wohnflaeche_qm 5
//           („wohnflaeche", „wohn_nutzflaeche" sind Text)
//   Rohertrag  „rohertrag" 559× Text (Definition), nie eine Zahl
// Dieselbe Falle wie bei der GND (CLAUDE.md, gnd_jahre): wer nur nach einem
// Namen greift, hält die anderen Sätze für lückenhaft. Die Rangfolge unten
// nimmt den häufigsten Namen zuerst.

/* ══ DEALPILOT-HINWEISSCHWELLEN — KEINE GESETZLICHE GRENZE ═══════════════════
   Weder ImmoWertV noch ImmoWertA nennen eine Zahl, ab der ein Objekt „außerhalb
   des Modells" liegt. Die Schwellen sind Analyseparameter von DealPilot und
   lösen nur einen HINWEIS aus (und einen moderaten Abzug in der Belastbarkeit);
   sie ändern keinen Wert.
     Miete   ±20 %   wie der hessische Leitfaden II (Anwendung der Liegen-
                     schaftszinssätze: Miete des Objekts höchstens ±20 % vom
                     Mittel der Stichprobe)
     RND     ±20 J.  wie die Kontrolle K7 im ValuationService
     Fläche  0,5- bis 2-fach der Ø Objektgröße der Stichprobe                  */
export const SCHWELLEN = Object.freeze({
  miete_pct: 20,
  rnd_jahre: 20,
  flaeche_faktor_min: 0.5,
  flaeche_faktor_max: 2,
  art: 'DealPilot-Hinweisschwelle, keine gesetzliche Grenze',
});

/* Abzug in der Belastbarkeit je Merkmal (ErtragswertService.belastbarkeitMitModell).
   Moderat: der Zins bleibt der amtliche, nur seine Übertragbarkeit ist eingeschränkt.
   Zum Vergleich: Stufe B −12, Stufe C −20. */
export const ABZUG = Object.freeze({ abweichend: 8, unbekannt: 3 });

const FELDER = {
  miete: ['marktmiete_eur_qm', 'nettokaltmiete_eur_qm', 'mietspiegelmiete_eur_qm'],
  rnd: ['restnutzungsdauer_mittel', 'rnd_jahre'],
  flaeche: ['objektgroesse_qm', 'mittlere_wohnflaeche_qm', 'wohnflaeche_qm'],
};
const NAME = { miete: 'Durchschnittsmiete', rnd: 'Restnutzungsdauer', flaeche: 'Objektgröße' };

/** Zahl aus einem Modellansatz: Zahl, „6,70", oder { mittel | wert }. Sonst null. */
function alsZahl(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  if (typeof v === 'object' && !Array.isArray(v)) return alsZahl(v.mittel != null ? v.mittel : v.wert);
  if (typeof v === 'string') {
    if (!/^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return null;   /* Text („aus Mietspiegeln …") ist keine Zahl */
    v = v.replace(',', '.');
  }
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Die Durchschnitte des Satzes als Zahl, mit dem Feld, aus dem sie stammen. */
export function modellDurchschnitte(ma) {
  const m = (ma && typeof ma === 'object') ? ma : {};
  const out = {};
  for (const [k, felder] of Object.entries(FELDER)) {
    out[k] = null; out[k + '_feld'] = null;
    for (const f of felder) {
      const z = alsZahl(m[f]);
      if (z != null) { out[k] = z; out[k + '_feld'] = f; break; }
    }
  }
  out.rohertrag_definition = typeof m.rohertrag === 'string' && m.rohertrag.trim() ? m.rohertrag.trim() : null;
  return out;
}

const de = (x, d = 2) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const r1 = (x) => Math.round(x * 10) / 10;

/**
 * @param {object|null} ma      modellansaetze des VERWENDETEN Liegenschaftszins-Satzes
 * @param {object} ansatz       { miete_qm, rnd_jahre, flaeche_qm } — was der Ertragswert tatsächlich ansetzt
 * @param {object} [meta]       { ausschuss, berichtsjahr, zweig, amtliche_miete_fuehrt }
 * @returns {object} { geprueft, merkmale:{miete,rnd,flaeche}, abweichend[], unbekannt[], texte[], kurz, … }
 */
export function pruefeModell(ma, ansatz = {}, meta = {}) {
  const S = SCHWELLEN;
  if (!ma || typeof ma !== 'object') {
    return {
      geprueft: false, grund: 'kein_satz',
      hinweis: 'Nicht prüfbar: der Liegenschaftszins stammt nicht aus einem Satz des Gutachterausschusses '
        + 'mit veröffentlichten Modelldaten.',
      merkmale: null, abweichend: [], unbekannt: [], texte: [], kurz: null, schwellen: S,
    };
  }
  const D = modellDurchschnitte(ma);
  const merk = {};

  /* Miete €/m² Wohnfläche (monatlich, nettokalt) */
  {
    const satz = D.miete, a = alsZahl(ansatz.miete_qm);
    const m = { satz, ansatz: a, feld: D.miete_feld, einheit: '€/m²', abweichung_pct: null, status: 'unbekannt' };
    if (satz != null && a != null) {
      m.abweichung_pct = r1((a / satz - 1) * 100);
      m.status = Math.abs(m.abweichung_pct) <= S.miete_pct ? 'im_modell' : 'abweichend';
    } else if (satz == null && meta.amtliche_miete_fuehrt) {
      /* AGVGA-NRW-Modell mit Mietpreisübersicht: der Zins ist mit derselben
         amtlichen Miete abgeleitet, die hier angesetzt ist (§ 10). Eine Ø Miete
         führt der Satz nicht - die Definition ist der Nachweis, keine Zahl. */
      m.status = 'im_modell'; m.nach_definition = true;
    }
    merk.miete = m;
  }
  /* Restnutzungsdauer in Jahren */
  {
    const satz = D.rnd, a = alsZahl(ansatz.rnd_jahre);
    const m = { satz, ansatz: a, feld: D.rnd_feld, einheit: 'Jahre', abweichung_pct: null, abweichung_jahre: null, status: 'unbekannt' };
    if (satz != null && a != null) {
      m.abweichung_jahre = Math.round(a - satz);
      m.abweichung_pct = r1((a / satz - 1) * 100);
      m.status = Math.abs(a - satz) <= S.rnd_jahre ? 'im_modell' : 'abweichend';
    }
    merk.rnd = m;
  }
  /* Objektgröße (Wohnfläche des ganzen Objekts) */
  {
    const satz = D.flaeche, a = alsZahl(ansatz.flaeche_qm);
    const m = { satz, ansatz: a, feld: D.flaeche_feld, einheit: 'm²', abweichung_pct: null, faktor: null, status: 'unbekannt' };
    if (satz != null && a != null) {
      m.faktor = Math.round(a / satz * 100) / 100;
      m.abweichung_pct = r1((a / satz - 1) * 100);
      m.status = (m.faktor >= S.flaeche_faktor_min && m.faktor <= S.flaeche_faktor_max) ? 'im_modell' : 'abweichend';
    }
    merk.flaeche = m;
  }

  const abweichend = Object.keys(merk).filter((k) => merk[k].status === 'abweichend');
  const unbekannt = Object.keys(merk).filter((k) => merk[k].status === 'unbekannt');

  /* Kundentexte ohne Fachjargon, je abweichendem Merkmal ein Satz */
  const texte = [];
  const quelle = 'aus der der Gutachterausschuss den Liegenschaftszins abgeleitet hat';
  if (merk.miete.status === 'abweichend') {
    const m = merk.miete, ueber = m.abweichung_pct > 0;
    texte.push('Die angesetzte Miete (' + de(m.ansatz) + ' €/m²) liegt ' + Math.round(Math.abs(m.abweichung_pct)) + ' % '
      + (ueber ? 'über' : 'unter') + ' der Durchschnittsmiete, ' + quelle + ' (' + de(m.satz) + ' €/m²).');
  }
  if (merk.rnd.status === 'abweichend') {
    const m = merk.rnd, laenger = m.abweichung_jahre > 0;
    texte.push('Die Restnutzungsdauer dieses Objekts (' + Math.round(m.ansatz) + ' Jahre) liegt ' + Math.abs(m.abweichung_jahre)
      + ' Jahre ' + (laenger ? 'über' : 'unter') + ' dem Durchschnitt der Kauffälle, ' + quelle.replace('aus der', 'aus denen') + ' (' + Math.round(m.satz) + ' Jahre).');
  }
  if (merk.flaeche.status === 'abweichend') {
    const m = merk.flaeche;
    texte.push('Das Objekt ist mit ' + Math.round(m.ansatz).toLocaleString('de-DE') + ' m² Wohnfläche '
      + (m.faktor > 1 ? de(m.faktor, 1).replace(',0', '') + '-mal so groß wie' : 'nur ' + Math.round(m.faktor * 100) + ' % so groß wie')
      + ' die durchschnittliche Objektgröße der Kauffälle (' + Math.round(m.satz).toLocaleString('de-DE') + ' m²).');
  }
  if (texte.length) texte.push('Der Zins passt deshalb nur eingeschränkt zu diesem Objekt.');
  if (unbekannt.length) {
    texte.push('Nicht prüfbar, weil der Gutachterausschuss es zu diesem Zins nicht angibt: '
      + unbekannt.map((k) => (k === 'flaeche' ? 'Objektgröße' : NAME[k])).join(', ') + '.');
  }

  const kurz = abweichend.length
    ? 'Zins passt nur eingeschränkt: ' + abweichend.map((k) => {
        const m = merk[k];
        if (k === 'miete') return 'Miete ' + (m.abweichung_pct > 0 ? '+' : '−') + Math.round(Math.abs(m.abweichung_pct)) + ' % gegen Ø ' + de(m.satz) + ' €/m²';
        if (k === 'rnd') return 'Restnutzungsdauer ' + Math.round(m.ansatz) + ' gegen Ø ' + Math.round(m.satz) + ' J.';
        return 'Wohnfläche ' + Math.round(m.ansatz).toLocaleString('de-DE') + ' gegen Ø ' + Math.round(m.satz).toLocaleString('de-DE') + ' m²';
      }).join(' · ')
    : (unbekannt.length === 3 ? 'Modelldaten des Zinses nicht angegeben — nicht prüfbar'
      : 'Objekt im Modell des Zinses' + (unbekannt.length ? ' (' + unbekannt.map((k) => NAME[k]).join(', ') + ' nicht prüfbar)' : ''));

  return {
    geprueft: true,
    ausschuss: meta.ausschuss || null, berichtsjahr: meta.berichtsjahr || null, zweig: meta.zweig || null,
    merkmale: merk, abweichend, unbekannt,
    rohertrag_definition: D.rohertrag_definition,
    texte, text: texte.join(' '), kurz,
    schwellen: S,
  };
}

/** Das Urteil für `miete_modellkonform` (CrossCheckService): true nur „im_modell",
 *  false bei Abweichung (mit Grund), null wenn der Satz keine Ø Miete führt. */
export function mieteModellkonform(mp) {
  const m = mp && mp.geprueft && mp.merkmale ? mp.merkmale.miete : null;
  if (!m || m.status === 'unbekannt') {
    return { wert: null, grund: 'nicht prüfbar: ' + (mp && mp.geprueft
      ? 'der Gutachterausschuss nennt zu diesem Zins keine Durchschnittsmiete'
      : 'kein Satz des Gutachterausschusses mit Modelldaten') };
  }
  if (m.status === 'im_modell') {
    return { wert: true, grund: m.nach_definition
      ? 'Miete aus derselben Mietpreisübersicht, mit der der Zins abgeleitet ist'
      : 'Miete ' + (m.abweichung_pct >= 0 ? '+' : '−') + Math.abs(m.abweichung_pct).toLocaleString('de-DE') + ' % gegen die Ø Miete des Zinses (Schwelle ±' + SCHWELLEN.miete_pct + ' %)' };
  }
  return { wert: false, grund: 'Miete ' + (m.abweichung_pct >= 0 ? '+' : '−') + Math.abs(m.abweichung_pct).toLocaleString('de-DE')
    + ' % gegen die Ø Miete des Zinses (' + m.satz.toLocaleString('de-DE') + ' €/m²), außerhalb ±' + SCHWELLEN.miete_pct + ' % (DealPilot-Hinweisschwelle)' };
}

export default { SCHWELLEN, ABZUG, pruefeModell, modellDurchschnitte, mieteModellkonform };
