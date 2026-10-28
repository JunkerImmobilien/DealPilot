#!/usr/bin/env node
/* tools/indexmiete-pruefen.mjs · v3026 — Prüfstrecke Indexmiete (§ 557b BGB)

   Lädt den ECHTEN Kern frontend/js/indexmiete.js und rechnet vier von Hand
   nachgerechnete Fälle. VPI-Werte: Destatis 61111-0002 (2020 = 100), wie sie
   am 28.10.2026 in mb.jahreswerte_abruf auf Staging standen (2025-10 = 123,0
   ist im Code belegt). „heute" ist fest 2026-10, damit der Prüfer nicht mit
   der Uhr wandert.

   RC=0 sauber, RC=1 Abweichung. */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I = require(path.join(WURZEL, 'frontend/js/indexmiete.js'));

const VPI = { monate: {
  '2023-01': 114.3, '2023-02': 115.2, '2023-03': 116.1, '2023-04': 116.6, '2023-05': 116.5, '2023-06': 116.8,
  '2023-07': 117.1, '2023-08': 117.5, '2023-09': 117.8, '2023-10': 117.8, '2023-11': 117.3, '2023-12': 117.4,
  '2024-01': 117.6, '2024-02': 118.1, '2024-03': 118.6, '2024-04': 119.2, '2024-05': 119.3, '2024-06': 119.4,
  '2024-07': 119.8, '2024-08': 119.7, '2024-09': 119.7, '2024-10': 120.2, '2024-11': 119.9, '2024-12': 120.5,
  '2025-01': 120.3, '2025-02': 120.8, '2025-03': 121.2, '2025-04': 121.7, '2025-05': 121.8, '2025-06': 121.8,
  '2025-07': 122.2, '2025-08': 122.3, '2025-09': 122.6, '2025-10': 123.0, '2025-11': 122.7, '2025-12': 122.7,
  '2026-01': 122.8, '2026-02': 123.1, '2026-03': 124.5, '2026-04': 125.2, '2026-05': 125.0, '2026-06': 124.6,
  '2026-07': 125.6, '2026-08': 125.8, '2026-09': 126.6 } };
const HEUTE = '2026-10';

let fehler = 0, n = 0;
function gleich(name, ist, soll) {
  n++;
  const ok = typeof soll === 'number' ? Math.abs(Number(ist) - soll) < 0.005 : ist === soll;
  if (!ok) { fehler++; console.log('  FEHLER ' + name + ': ist ' + JSON.stringify(ist) + ', soll ' + JSON.stringify(soll)); }
}

/* Fall A — letzte Erhöhung 03/2024 (VPI 118,6), heute erklären.
   800 × 126,6 / 118,6 = 853,963 → 853,96 €; +53,96 €/Monat, +647,52 €/Jahr.
   Erklärung 10/2026, wirksam ab 12/2026 (übernächster Monat, § 557b Abs. 3).
   Jahr 2: Indexmonat 09/2027 liegt nach dem letzten echten Wert → Annahme 2 %:
   126,6 × 1,02 = 129,13 → 129,1; 853,96 × 129,1 / 126,6 = 870,823 → 870,82 €. */
{
  const r = I.rechne({ miete: 800, letzte: '2024-03-01', beginn: '2019-05-01', vpi: VPI, heute: HEUTE, jahre: 5 });
  gleich('A ok', r.ok, true);
  gleich('A Basis', r.basis.wert, 118.6);
  gleich('A Basis-Herkunft', r.basis.herkunft, 'letzte Erhöhung');
  const s1 = r.schritte[0], s2 = r.schritte[1];
  gleich('A1 Erklärung', s1.erklaerung, '2026-10');
  gleich('A1 Indexmonat', s1.indexmonat, '2026-09');
  gleich('A1 wirksam', s1.wirksam, '2026-12');
  gleich('A1 Miete', s1.miete_neu, 853.96);
  gleich('A1 +Monat', s1.plus_monat, 53.96);
  gleich('A1 +Jahr', s1.plus_jahr, 647.52);
  gleich('A1 echt', s1.annahme, false);
  gleich('A2 Annahme', s2.annahme, true);
  gleich('A2 Index', s2.index, 129.1);
  gleich('A2 Miete', s2.miete_neu, 870.82);
  gleich('A2 wirksam', s2.wirksam, '2027-12');
  gleich('A Schritte', r.schritte.length, 5);
}

/* Fall B — 12-Monats-Sperre (§ 557b Abs. 2): letzte Erhöhung 03/2026 (VPI 124,5).
   Frühestens wirksam 03/2027 → Erklärung spätestens 01/2027; Indexmonat 12/2026
   liegt nach dem letzten echten Wert (09/2026) → Annahme:
   126,6 × 1,02^(3/12) = 127,228 → 127,2; 1.000 × 127,2 / 124,5 = 1.021,69 €. */
{
  const r = I.rechne({ miete: 1000, letzte: '2026-03', vpi: VPI, heute: HEUTE, jahre: 3 });
  const s1 = r.schritte[0];
  gleich('B ok', r.ok, true);
  gleich('B1 Erklärung', s1.erklaerung, '2027-01');
  gleich('B1 wirksam', s1.wirksam, '2027-03');
  gleich('B1 Annahme', s1.annahme, true);
  gleich('B1 Index', s1.index, 127.2);
  gleich('B1 Miete', s1.miete_neu, 1021.69);
}

/* Fall C — keine Erhöhung bisher, Mietbeginn 15.07.2023 (VPI 117,1).
   650 × 126,6 / 117,1 = 702,733 → 702,73 €, +52,73 €/Monat, wirksam ab 12/2026.
   Mit eigener Annahme 0 % bleibt die Miete danach gleich (Szenario, kein Wert). */
{
  const r = I.rechne({ miete: 650, beginn: '2023-07-15', vpi: VPI, heute: HEUTE, annahme_pct: 0, jahre: 3 });
  gleich('C ok', r.ok, true);
  gleich('C Basis-Herkunft', r.basis.herkunft, 'Mietbeginn');
  gleich('C1 Miete', r.schritte[0].miete_neu, 702.73);
  gleich('C1 +Monat', r.schritte[0].plus_monat, 52.73);
  gleich('C1 wirksam', r.schritte[0].wirksam, '2026-12');
  gleich('C2 Miete (0 %)', r.schritte[1].miete_neu, 702.73);
  gleich('C Annahme', r.annahme_pct, 0);
}

/* Fall D — fehlende Angaben: kein Rechnen mit Platzhalter, sondern was fehlt. */
{
  const a = I.rechne({ miete: 700, vpi: VPI, heute: HEUTE });
  gleich('D1 ok', a.ok, false);
  gleich('D1 fehlt Datum', /Mietbeginn oder letzte Erhöhung/.test((a.fehlt || []).join()), true);
  const b = I.rechne({ miete: 700, beginn: '2015-01-01', vpi: VPI, heute: HEUTE });
  gleich('D2 ok', b.ok, false);
  gleich('D2 fehlt VPI', /Verbraucherpreisindex für 01\/2015/.test((b.fehlt || []).join()), true);
  const c = I.rechne({ miete: 0, beginn: '2024-01', vpi: VPI, heute: HEUTE });
  gleich('D3 fehlt Miete', /Ist-Kaltmiete/.test((c.fehlt || []).join()), true);
  const d = I.rechne({ miete: 700, beginn: '2024-01', vpi: null, heute: HEUTE });
  gleich('D4 fehlt Reihe', /Reihe noch nicht geladen/.test((d.fehlt || []).join()), true);
}

/* Summe je Haus: A + C, nächste Anpassung ab 12/2026, +53,96 + 52,73 = 106,69 €/Monat */
{
  const a = I.rechne({ miete: 800, letzte: '2024-03', vpi: VPI, heute: HEUTE });
  const c = I.rechne({ miete: 650, beginn: '2023-07', vpi: VPI, heute: HEUTE });
  const h = I.haus([a, c, null]);
  gleich('H n', h.n, 2);
  gleich('H ab', h.naechste_ab, '2026-12');
  gleich('H +Monat', h.plus_monat_naechste, 106.69);
  gleich('H Zeile', /nächste Anpassung ab 12\/2026/.test(I.zeileText(h)), true);
  gleich('H Annahme genannt', /kein amtlicher Wert/.test(I.zeileText(h)), true);
}

console.log((fehler ? 'ROT' : 'GRÜN') + ' · Indexmiete (§ 557b BGB): ' + (n - fehler) + '/' + n + ' Prüfpunkte');
process.exit(fehler ? 1 : 0);
