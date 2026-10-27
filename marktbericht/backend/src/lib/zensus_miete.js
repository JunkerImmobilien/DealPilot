/* ═══════════════════════════════════════════════════════════════════════
   lib/zensus_miete.js · v2993 — Bestandsmiete aus dem Zensus 2022, auf den
   Wertermittlungsstichtag fortgeschrieben.

   WOZU. Der Ertragswert kapitalisiert die marktüblich erzielbare Miete
   (§ 27 Abs. 1, § 31 Abs. 2 ImmoWertV), und zwar die Miete, mit der der
   verwendete Liegenschaftszins abgeleitet wurde (Modellkonformität, § 10;
   ImmoWertA zu § 31 b und zu § 33). Die Ausschüsse leiten ihre Zinsen aus
   Kauffällen mit den TATSÄCHLICHEN Mieten ab (z. B. LVermGeo Sachsen-Anhalt
   2025: „tatsächliche Mieten …, sofern diese marktüblich sind", Mittel
   4,86–5,23 €/m²); § 256 BewG gehört zu den typisierten BESTANDSmieten der
   Anlage 39 BewG. Eine Angebotsmiete passt zu keinem der beiden Modelle:
   Inserate liegen im Mittel 17 % über den Neuvertragsmieten (empirica
   Paper 273, 25.10.2024), Bestandsmieten noch tiefer.

   Gemessen 27.10.2026, Am Markt 9, 06184 Kabelsketal (ETW, kein Satz mit
   Ø Miete): Angebotsmiete 8,40 €/m² → Ertragswert 254.000 €; Zensus 5,59 €/m²
   → rund 164.000 €. Kaufpreis 1.119 €/m², amtlicher ETW-Median Saalekreis
   1.171 €/m². Marcel 27.10.2026: „eher in Richtung 164.000".

   WAS. Zensus 2022 (Stichtag 15.05.2022), Nettokaltmiete je m² nach Baujahr
   und nach Wohnungsgröße, Gemeinde vor Kreis. Beide Klassen sind getrennte
   Auswertungen; liegt beides vor, gilt das Mittel. Fortgeschrieben mit dem
   Index der Nettokaltmieten im Verbraucherpreisindex (Destatis, 2020 = 100):
   Monatswert des Stichtags (sonst Jahresdurchschnitt) / Mai 2022.
   Nie erfunden: ohne Zensuswert kein Ergebnis.
   ═══════════════════════════════════════════════════════════════════════ */

/* Destatis, Verbraucherpreisindex für Deutschland, Sondergliederungen,
   Spalte „Nettokaltmiete", Stand 13.10.2026, gelesen 27.10.2026.
   Jährlich nachtragen; Länderwerte (GENESIS 61111-0020) sind nicht frei
   abrufbar und werden deshalb nicht verwendet. */
export const NKM_INDEX = {
  quelle: 'Statistisches Bundesamt, Verbraucherpreisindex, Index der Nettokaltmieten (2020 = 100)',
  quelle_url: 'https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Verbraucherpreisindex/Tabellen/Verbraucherpreise-Sondergliederungen.html',
  stand: '2026-10-13',
  basis_monat: '2022-05', basis_wert: 102.7,
  jahre: { 2022: 102.9, 2023: 105.0, 2024: 107.2, 2025: 109.4 },
  monate: { '2022-05': 102.7, '2026-01': 110.6, '2026-02': 110.8, '2026-03': 110.9, '2026-04': 111.1,
            '2026-05': 111.3, '2026-06': 111.4, '2026-07': 111.6, '2026-08': 111.8, '2026-09': 111.9 },
};

function monat(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

/** Index zum Stichtag: Monatswert, sonst der letzte Monatswert davor im selben
    Jahr, sonst Jahresdurchschnitt, sonst der jüngste bekannte Wert. */
export function nkmIndexAm(stichtag) {
  const d = stichtag instanceof Date && !isNaN(stichtag) ? stichtag : new Date();
  const m = monat(d), I = NKM_INDEX;
  if (I.monate[m] != null) return { wert: I.monate[m], bezug: m };
  const vorher = Object.keys(I.monate).filter((k) => k <= m && k.slice(0, 4) === m.slice(0, 4)).sort().pop();
  if (vorher) return { wert: I.monate[vorher], bezug: vorher };
  const j = d.getFullYear();
  if (I.jahre[j] != null) return { wert: I.jahre[j], bezug: String(j) + ' (Jahresdurchschnitt)' };
  const letzter = Object.keys(I.monate).sort().pop();
  if (m > letzter) return { wert: I.monate[letzter], bezug: letzter, juengster: true };
  return null;   /* vor Mai 2022: keine Fortschreibung zurück */
}

const zahl = (x) => (x == null || x === '' || !isFinite(Number(x)) ? null : Number(x));

/**
 * @param {object} zensus  Ergebnis von ZensusConnector.lookupDb
 * @param {Date}   stichtag
 * @returns {null | {qm, roh_qm, faktor, ebene, gebiet, klassen[], index, quelle, text}}
 */
export function zensusMieteAmStichtag(zensus, stichtag) {
  if (!zensus || !zensus.available) return null;
  const blocke = [['gemeinde', zensus.gemeinde], ['kreis', zensus.kreis]];
  for (const [ebene, b] of blocke) {
    if (!b) continue;
    const kl = [];
    if (b.miete_baujahr && zahl(b.miete_baujahr.wert) > 0) kl.push({ art: 'Baujahr', klasse: b.miete_baujahr.klasse, qm: zahl(b.miete_baujahr.wert) });
    if (b.miete_flaeche && zahl(b.miete_flaeche.wert) > 0) kl.push({ art: 'Wohnungsgröße', klasse: b.miete_flaeche.klasse, qm: zahl(b.miete_flaeche.wert) });
    let roh = kl.length ? kl.reduce((a, k) => a + k.qm, 0) / kl.length : null;
    if (roh == null && zahl(b.nettokaltmiete_qm) > 0) { roh = zahl(b.nettokaltmiete_qm); kl.push({ art: 'gesamt', klasse: 'alle Wohnungen', qm: roh }); }
    if (!(roh > 0)) continue;
    const idx = nkmIndexAm(stichtag);
    const faktor = idx ? idx.wert / NKM_INDEX.basis_wert : 1;
    const qm = Math.round(roh * faktor * 100) / 100;
    const r2 = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
    return {
      qm, roh_qm: Math.round(roh * 100) / 100, faktor: Math.round(faktor * 10000) / 10000,
      ebene, gebiet: b.name || null, klassen: kl, index: idx,
      quelle: 'Zensus 2022 (Stichtag 15.05.2022), Nettokaltmiete der bewohnten Mietwohnungen'
        + (ebene === 'gemeinde' ? ' der Gemeinde ' : ' des Kreises ') + (b.name || ''),
      text: 'Bestandsmiete Zensus 2022 ' + r2(roh) + ' €/m² (' + kl.map((k) => k.art + ' ' + (k.klasse || '')).join(', ')
        + ')' + (idx ? ', fortgeschrieben mit dem Index der Nettokaltmieten (' + String(NKM_INDEX.basis_wert).replace('.', ',')
        + ' im Mai 2022 → ' + String(idx.wert).replace('.', ',') + ' ' + idx.bezug + ') auf ' + r2(qm) + ' €/m²' : ''),
    };
  }
  return null;
}
