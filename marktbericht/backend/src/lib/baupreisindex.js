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
  /* v3010 · 2021-02 bis 2024-08 nachgetragen (dieselbe Tabelle bpr110, Stand 09.10.2026), damit
     zurueckliegende Stichtage nicht auf die Konstante 1,91 fallen */
  monate: { '2021-02': 95.0, '2021-05': 98.7, '2021-08': 102.1, '2021-11': 104.2,
            '2022-02': 108.8, '2022-05': 115.9, '2022-08': 118.9, '2022-11': 121.7,
            '2023-02': 125.0, '2023-05': 126.0, '2023-08': 126.4, '2023-11': 126.9,
            '2024-02': 128.5, '2024-05': 129.4, '2024-08': 130.3, '2024-11': 130.8, '2025-02': 132.6, '2025-05': 133.6, '2025-08': 134.3,
            '2025-11': 135.0, '2026-02': 137.0, '2026-05': 140.3, '2026-08': 141.7 },
  /* v3010 · WANN der Wert veroeffentlicht wurde (Marcel 27.10.2026: bei historischen Stichtagen
     zaehlt der veroeffentlichte Stand). Belegt nur August 2026 (Pressemitteilung/Tabelle vom
     09.10.2026). Fuer die uebrigen gilt der Destatis-Rhythmus „Quartalsmonat + 2 Monate",
     angesetzt zum 10. dieses Monats - ausgewiesen als angenommen, nicht als belegt. */
  veroeffentlicht: { '2026-08': '2026-10-09' },
};

/** Tag, ab dem der Wert des Quartalsmonats `k` (JJJJ-MM) veroeffentlicht ist. */
export function veroeffentlichtAm(k) {
  const bel = BPI_TABELLE.veroeffentlicht[k];
  if (bel) return { datum: bel, art: 'belegt' };
  const [j, m] = k.split('-').map(Number);
  const mm = m + 2, jj = j + (mm > 12 ? 1 : 0), m2 = ((mm - 1) % 12) + 1;
  return { datum: jj + '-' + String(m2).padStart(2, '0') + '-10', art: 'angenommen' };
}

/** Index (2010 = 100, als Faktor wie 2,00) zum Stichtag: der jüngste veröffentlichte
    Quartalsmonat am oder vor dem Stichtag; vor Nov. 2024 null (dann gilt ein Wert
    aus dem Modell des Ausschusses oder die Rechnung sagt, dass er fehlt). */
export function baupreisindexAm(stichtag) {
  const d = stichtag instanceof Date && !isNaN(stichtag) ? stichtag : new Date();
  const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  /* v3010 · nur, was am Stichtag schon veroeffentlicht war (bis v3009: jeder Quartalsmonat <= Stichtag,
     auch der August-Wert am 01.09., der erst am 09.10. erschien) */
  const tag = d.toISOString().slice(0, 10);
  const k = Object.keys(BPI_TABELLE.monate).filter((x) => x <= m && veroeffentlichtAm(x).datum <= tag).sort().pop();
  if (!k) return null;
  const roh = BPI_TABELLE.monate[k];
  const wert = Math.round(roh / BPI_TABELLE.basis2010_in_2021 * 100) / 100;
  const [j, mo] = k.split('-');
  const _v = veroeffentlichtAm(k);
  return { wert, roh_2021: roh, monat: k, stichtag: k + '-01', art: 'amtlich',
    veroeffentlicht: _v.datum, veroeffentlicht_art: _v.art,   /* v3010 */
    text: 'Baupreisindex ' + String(wert).replace('.', ',') + ' (2010 = 100; ' + mo + '/' + j + ': ' + String(roh).replace('.', ',') + ' auf Basis 2021, Statistisches Bundesamt)',
    quelle: BPI_TABELLE.quelle, quelle_url: BPI_TABELLE.quelle_url };
}

/* v3021 · AUTOMATISCH GEHOLTE QUARTALE (lib/destatis_reihen.js, JahreswerteService).
   Die Tabelle oben bleibt der Rueckfall und hat Vorrang: ein hier belegter Wert wird
   nie ueberschrieben - nur NEUE Quartale kommen dazu, und nur solche, die die
   Plausibilitaetspruefung bestanden haben (status 'aktiv' in mb.jahreswerte_abruf).
   Veroeffentlicht gilt ab dem „Stand" der gelesenen Seite, sonst ab dem Abruftag -
   frueher war der Wert fuer DealPilot nachweislich nicht sichtbar. */
BPI_TABELLE.abgerufen = {};
export function uebernimmAbruf(zeilen) {
  let neu = 0;
  for (const z of zeilen || []) {
    const k = String(z.periode || '');
    const w = Number(z.wert);
    if (!/^\d{4}-(02|05|08|11)$/.test(k) || !(w > 0)) continue;
    if (BPI_TABELLE.monate[k] != null && !BPI_TABELLE.abgerufen[k]) continue;   /* belegt im Code - bleibt */
    const ab = String(z.abgerufen_am instanceof Date ? z.abgerufen_am.toISOString() : (z.abgerufen_am || '')).slice(0, 10);
    const st = z.quelle_stand ? String(z.quelle_stand instanceof Date ? z.quelle_stand.toISOString() : z.quelle_stand).slice(0, 10) : null;
    BPI_TABELLE.monate[k] = w;
    BPI_TABELLE.veroeffentlicht[k] = (st && st >= k + '-01') ? st : ab;
    BPI_TABELLE.abgerufen[k] = { abgerufen_am: ab, quelle_stand: st, weg: z.weg || null };
    neu++;
  }
  return neu;
}
