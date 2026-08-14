#!/usr/bin/env node
/* kettenpruefung-v1095.mjs
 *
 * DIE LAGE VOM 14.08. AUF STAGING, NACHGEBAUT.
 *
 * Der Rollout von v1094 hat gemeldet: 2150 Saetze in den Saatdateien, 1565
 * im laufenden Server. In mb.param_modell liegen 493 Liegenschaftszinssaetze
 * aus dem Saatlauf vom 12.08. — nur NRW, nur Berichtsjahr 2024. Die
 * Saatdatei fuehrt inzwischen 1078.
 *
 * Diese Pruefung baut GENAU DAS nach, mit einem Mock, der sich wie die
 * Tabelle verhaelt: er liefert eine Teilmenge der Kennzahl. Sie prueft, dass
 * die Zusammenfuehrung danach ALLE Saetze fuehrt und nicht nur die der
 * Tabelle — und dass ein Satz, den die Tabelle wirklich ersetzt, auch
 * wirklich aus der Tabelle kommt.
 *
 * DER MOCK MUSS DIE ECHTE SCHNITTSTELLE ABBILDEN. `q()` liefert `res.rows`
 * direkt — ein Stub mit `{rows: []}` haette in v1083 neun `.rows`-Zugriffe
 * verdeckt. Deshalb gibt dieser Mock ein Array zurueck, so wie q() es tut.
 */

import { _setzeRegister, ladeAusDb, registerStand, finde }
  from '../lib/ausschuss_register.js';

let fehler = 0, geprueft = 0;

function pruefe(name, ist, soll) {
  geprueft++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler++;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name.padEnd(58)} `
    + `ist ${JSON.stringify(ist)}  soll ${JSON.stringify(soll)}`);
}

/* Eine Saat wie nach v1094: zwei Kennzahlen, mehrere Laender, zwei
 * Jahrgaenge desselben Ausschusses. */
const satz = (ags, kennzahl, zweig, jahr, wert) => ({
  land_code: { '05': 'NW', '06': 'HE', '03': 'NI', '12': 'BB' }[ags.slice(0, 2)],
  ags, kennzahl, zweig, berichtsjahr: jahr, ebene: 'kreis',
  gaa_name: 'Saat ' + ags, formel: { form: 'konstante', wert, liefert: 'prozent' },
  belege: [{ art: 'test' }], stufe: 'A',
});

const SAAT = [
  satz('05758', 'liegenschaftszinssatz', 'efh', 2024, 1.4),   /* NW, in der DB */
  satz('05770', 'liegenschaftszinssatz', 'efh', 2024, 1.5),   /* NW, in der DB */
  satz('05758', 'liegenschaftszinssatz', 'efh', 2023, 1.3),   /* NW, Jg. 2023 — NICHT in der DB */
  satz('06414000', 'liegenschaftszinssatz', 'efh', 2024, 1.7),/* HE — NICHT in der DB */
  satz('03452', 'liegenschaftszinssatz', 'ezfh', 2024, 1.2),  /* NI — NICHT in der DB */
  satz('12054', 'sachwertfaktor', 'ezfh', 2025, 1.06),        /* BB, Kennzahl fehlt in der DB */
];

/* Die Tabelle: NUR die beiden NRW-Saetze des Jahrgangs 2024, und einer
 * davon mit einem ANDEREN Wert — sie ist die juengere Ernte fuer genau
 * diesen Satz und muss ihn ersetzen. */
const ROWS = [
  { ...satz('05758', 'liegenschaftszinssatz', 'efh', 2024, 1.9),
    gaa_name: 'DB 05758' },
  { ...satz('05770', 'liegenschaftszinssatz', 'efh', 2024, 1.5),
    gaa_name: 'DB 05770' },
];

const q = async () => ROWS;          /* q() liefert res.rows DIREKT */

console.log('\n1 · Die Lage vom 14.08.: veraltete Tabelle, neuere Saat');
_setzeRegister(SAAT);
const r = await ladeAusDb(q);
const st = registerStand();

pruefe('kein Satz geht verloren', st.saetze, SAAT.length);
pruefe('  davon aus der Tabelle', st.aus_db, 2);
pruefe('  davon aus der Saat', st.aus_saat, 4);
pruefe('  ersetzt wurden', st.ersetzt, 2);

console.log('\n2 · Was die Tabelle fuehrt, kommt aus der Tabelle');
pruefe('05758/2024 kommt aus der DB',
  finde('liegenschaftszinssatz', '05758')
    .find((s) => s.berichtsjahr === 2024).gaa_name, 'DB 05758');

console.log('\n3 · Was sie NICHT fuehrt, bleibt stehen — das ist der Befund');
for (const [bez, ags, kz, jahr] of [
  ['Hessen (Wiesbaden)', '06414000', 'liegenschaftszinssatz', 2024],
  ['Niedersachsen (Aurich)', '03452', 'liegenschaftszinssatz', 2024],
  ['der Jahrgang 2023', '05758', 'liegenschaftszinssatz', 2023],
  ['Brandenburg (Potsdam)', '12054', 'sachwertfaktor', 2025],
]) {
  const t = finde(kz, ags).filter((s) => s.berichtsjahr === jahr);
  pruefe(`${bez} ist erreichbar`, t.length > 0, true);
}

console.log('\n4 · Gegenprobe: die alte Regel haette 3 Saetze verloren');
/* Je Kennzahl gerechnet: die Tabelle fuehrt `liegenschaftszinssatz`, also
 * waeren ALLE fuenf Saetze dieser Kennzahl aus der Saat gefallen und nur
 * die zwei der Tabelle geblieben — Hessen, Niedersachsen und der Jahrgang
 * 2023 waeren weg gewesen. Genau das ist am 14.08. passiert. */
const ausDbKennzahl = new Set(ROWS.map((x) => x.kennzahl));
const nachAlterRegel = SAAT.filter((s) => !ausDbKennzahl.has(s.kennzahl)).length
                     + ROWS.length;
pruefe('alte Regel: nur 3 Saetze statt 6', nachAlterRegel, 3);
pruefe('neue Regel: 6', st.saetze, 6);

console.log('\n5 · Die leere Tabelle darf weiterhin nichts loeschen');
_setzeRegister(SAAT);
const leer = await ladeAusDb(async () => []);
pruefe('leere Tabelle wird abgewiesen', leer.grund, 'tabelle_leer');
pruefe('  und die Saat steht noch', registerStand().saetze, SAAT.length);

console.log(`\n${geprueft} Pruefungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
