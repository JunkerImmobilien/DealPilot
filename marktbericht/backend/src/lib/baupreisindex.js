/* ═══════════════════════════════════════════════════════════════════════
   lib/baupreisindex.js · v2996 — Baupreisindex zum Wertermittlungsstichtag
   (§ 36 Abs. 2 ImmoWertV: „der für den Wertermittlungsstichtag aktuelle
   … Preisindex für die Bauwirtschaft").

   Bis v2995 stand in CrossCheckService die Konstante 1,91 („2010 →
   01.01.2026"), passend zu November 2025. Zum 27.10.2026 galt August 2026,
   umbasiert 2,00 - der Sachwert fiel rund 4,7 % zu niedrig aus
   (Gegenprüfung 27.10.2026).

   QUELLE: Statistisches Bundesamt, Baupreisindizes, Neubau Wohngebäude
   (konventionelle Bauart), Bauleistungen am Bauwerk einschließlich
   Umsatzsteuer, 2021 = 100, Tabelle „bpr110", Stand 9. Oktober 2026
   (I = Februar, II = Mai, III = August, IV = November). Wörtlich abgelesen.

   UMBASIERUNG AUF 2010 = 100 (NHK 2010): Destatis veröffentlicht den Wert
   2010 auf Basis 2021 nicht mehr frei. Angesetzt ist 70,8, doppelt belegt:
     · Destatis: Baupreise Wohngebäude 2010 bis 2025 „+89 %"; Jahresmittel
       2025 aus den vier Quartalen 133,9 → 133,9 / 1,89 = 70,8
     · Gutachterausschüsse zum November 2025 (135,0): Hamburg 1,911 → 70,6,
       Dortmund 1,906 → 70,8
   Jährlich bzw. je Quartal nachtragen; die Tabelle hält nur, was gelesen ist.
   ═══════════════════════════════════════════════════════════════════════ */

export const BPI_TABELLE = {
  quelle: 'Statistisches Bundesamt, Baupreisindex Neubau Wohngebäude (konventionell), Bauleistungen am Bauwerk einschl. USt, 2021 = 100',
  quelle_url: 'https://www.destatis.de/DE/Themen/Wirtschaft/Konjunkturindikatoren/Preise/bpr110.html',
  stand: '2026-10-09',
  basis2010_in_2021: 70.8,
  monate: { '2024-11': 130.8, '2025-02': 132.6, '2025-05': 133.6, '2025-08': 134.3,
            '2025-11': 135.0, '2026-02': 137.0, '2026-05': 140.3, '2026-08': 141.7 },
};

/** Index (2010 = 100, als Faktor wie 2,00) zum Stichtag: der jüngste veröffentlichte
    Quartalsmonat am oder vor dem Stichtag; vor Nov. 2024 null (dann gilt ein Wert
    aus dem Modell des Ausschusses oder die Rechnung sagt, dass er fehlt). */
export function baupreisindexAm(stichtag) {
  const d = stichtag instanceof Date && !isNaN(stichtag) ? stichtag : new Date();
  const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const k = Object.keys(BPI_TABELLE.monate).filter((x) => x <= m).sort().pop();
  if (!k) return null;
  const roh = BPI_TABELLE.monate[k];
  const wert = Math.round(roh / BPI_TABELLE.basis2010_in_2021 * 100) / 100;
  const [j, mo] = k.split('-');
  return { wert, roh_2021: roh, monat: k, stichtag: k + '-01', art: 'amtlich',
    text: 'Baupreisindex ' + String(wert).replace('.', ',') + ' (2010 = 100; ' + mo + '/' + j + ': ' + String(roh).replace('.', ',') + ' auf Basis 2021, Statistisches Bundesamt)',
    quelle: BPI_TABELLE.quelle, quelle_url: BPI_TABELLE.quelle_url };
}
