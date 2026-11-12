#!/usr/bin/env node
/* hausverlauf-pruefen.mjs — v3323 · Prüfer für den Reiter „Hausverlauf" der Pilot-Analyse
   ───────────────────────────────────────────────────────────────────────────
   Lädt die ECHTE Datei frontend/js/hausverlauf.js (reine Funktion ereignisse(), kein DOM) und prüft sie
   mit ERFUNDENEN Daten (keine echten Namen, keine echten Objekte):
     A  neue Auswertung mit weg.chronik: Datum, Art, Betrag, Status, Quelle kommen an, älteste zuerst
     B  alte Auswertung ohne chronik: kernpunkte „JJJJ: …" → Jahr, Art aus dem Text, nichts erfunden
     C  Versammlungen aus den Dokumentdaten, Sonderumlagen aus #weg_su (Anteil, Fälligkeit), Maßnahmen ohne Doppel
     D  Sortierung: Jahr, dann Datum; datierte vor undatierten im selben Jahr; ohne Jahr zuletzt
     E  leere/kaputte Eingaben werfen nicht
     F  Vertrag Backend: dokumenteAuswerten verlangt weg.chronik mit denselben Arten wie das Frontend (ARTEN)
   RC=0 sauber. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const HV = require(path.join(wurzel, 'frontend/js/hausverlauf.js'));

let ok = 0, fehl = 0;
function pruef(name, bed, info) { if (bed) { ok++; } else { fehl++; console.log('  ROT  ' + name + (info ? ' — ' + info : '')); } }

/* A · Chronik */
const A = HV.ereignisse({ weg: { chronik: [
  { datum: '18.06.2025', jahr: 2025, art: 'beschluss', titel: 'Dachsanierung beschlossen', text: 'Flachdach für 92.000 € beschlossen.', betrag_eur: 92000, status: 'beschlossen', quelle: 'Protokoll 18.06.2025 TOP 4' },
  { datum: '12.06.2024', jahr: 2024, art: 'schaden', titel: 'Feuchtigkeit im Keller', text: 'Erstmals festgestellt.', betrag_eur: null, status: null, quelle: 'Protokoll 12.06.2024 TOP 6' },
  { datum: null, jahr: 2025, art: 'verwaltung', titel: 'Verwaltervertrag verlängert', text: 'Bis 2028.', quelle: 'Protokoll 18.06.2025' }
] } }, [], []);
pruef('A1 drei Ereignisse', A.length === 3, A.length);
pruef('A2 älteste zuerst', A[0].jahr === 2024 && A[0].datum === '12.06.2024', JSON.stringify(A[0]));
pruef('A3 Betrag und Status', A[1].betrag === 92000 && A[1].status === 'beschlossen');
pruef('A4 Quelle', /TOP 4/.test(A[1].quelle));
pruef('A5 datiert vor undatiert im selben Jahr', A[1].iso === '2025-06-18' && A[2].iso === null);
pruef('A6 Art bleibt', A[0].art === 'schaden' && A[2].art === 'verwaltung');

/* B · alte Auswertung: Kernpunkte mit Jahr */
const B = HV.ereignisse({ weg: { kernpunkte: ['2025: Sonderumlage 42.000 € für das Dach beschlossen.', '2024: Notreparatur Dach (2.140 €).', 'ohne Jahr: Hausordnung geändert.'] } }, [], []);
pruef('B1 drei Kernpunkte', B.length === 3, B.length);
pruef('B2 Jahr aus dem Text', B[0].jahr === 2024 && B[1].jahr === 2025);
pruef('B3 Art aus dem Text (Sonderumlage)', B[1].art === 'sonderumlage', B[1].art);
pruef('B4 Art aus dem Text (Instandhaltung)', B[0].art === 'instandhaltung', B[0].art);
pruef('B5 kein erfundener Betrag', B.every((e) => e.betrag === null));
pruef('B6 ohne Jahr zuletzt', B[2].jahr === null, JSON.stringify(B[2]));
pruef('B7 Herkunft kernpunkt', B.every((e) => e.herkunft === 'kernpunkt'));

/* C · Dokumente, Sonderumlagen, Maßnahmen */
const C = HV.ereignisse(
  { weg: { chronik: [{ datum: '18.06.2025', jahr: 2025, art: 'instandhaltung', titel: 'Flachdachsanierung beschlossen', text: '', betrag_eur: 92000, status: 'beschlossen', quelle: 'P' }],
           sanierungen: [{ massnahme: 'Flachdachsanierung mit Dämmung', status: 'beschlossen', jahr: 2025, kosten_eur: 92000 },
                         { massnahme: 'Fassadenanstrich Nord', status: 'geplant', jahr: 2026, kosten_eur: 24500 }] } },
  [{ zweck: 'Dach', betrag: 7000, faellig: '01.03.2026', status: 'beschlossen' }],
  [{ typ: 'weg_protokoll', label: 'WEG-Protokoll', datum: '18.06.2025' }, { typ: 'grundbuch', label: 'Grundbuch', datum: '01.01.2020' }]);
pruef('C1 Versammlung aus Protokoll-Datum', C.some((e) => e.art === 'versammlung' && e.iso === '2025-06-18'));
pruef('C2 Grundbuch ist keine Versammlung', !C.some((e) => e.iso === '2020-01-01'));
pruef('C3 Maßnahme aus Chronik nicht doppelt', C.filter((e) => /Flachdach/.test(e.titel)).length === 1, C.filter((e) => /Flachdach/.test(e.titel)).length);
pruef('C4 neue Maßnahme dazu', C.some((e) => /Fassadenanstrich/.test(e.titel) && e.status === 'geplant' && e.jahr === 2026));
const su = C.find((e) => e.art === 'sonderumlage');
pruef('C5 Sonderumlage mit Anteil und Fälligkeit', su && su.betrag === 7000 && su.anteil === true && su.iso === '2026-03-01', JSON.stringify(su));
pruef('C6 Reihenfolge 2025 → 2026', C.map((e) => e.jahr).every((j, i, a) => i === 0 || (a[i - 1] || 9999) <= (j || 9999)));

/* D · Sortierung im selben Jahr nach Datum */
const D = HV.ereignisse({ weg: { chronik: [
  { datum: '01.12.2025', jahr: 2025, art: 'hausgeld', titel: 'Wirtschaftsplan 2026' },
  { datum: '02.02.2025', jahr: 2025, art: 'beschluss', titel: 'Beschluss Februar' }] } }, [], []);
pruef('D1 Februar vor Dezember', D[0].titel === 'Beschluss Februar');

/* E · leer und kaputt */
let wirft = false;
try { HV.ereignisse(null, null, null); HV.ereignisse({ weg: { chronik: [null, 5, 'x'], kernpunkte: null } }, [null], [null, {}]); HV.ereignisse({ weg: 'kaputt' }, 'x', 'y'); } catch (e) { wirft = true; }
pruef('E1 wirft nicht', !wirft);
pruef('E2 leer → leere Liste', HV.ereignisse({}, [], []).length === 0);
pruef('E3 unbekannte Art → aus Text', HV.ereignisse({ weg: { chronik: [{ jahr: 2024, art: 'quatsch', titel: 'Verwalterwechsel zur Firma X' }] } }, [], [])[0].art === 'verwaltung');

/* F · Vertrag mit dem Backend */
const svc = readFileSync(path.join(wurzel, 'backend/src/services/openaiService.js'), 'utf8');
const i = svc.indexOf('async function dokumenteAuswerten');
const teil = i >= 0 ? svc.slice(i, i + 9000) : '';
pruef('F1 dokumenteAuswerten verlangt "chronik"', /"chronik": \[\{"datum"/.test(teil));
const artenBackend = (teil.match(/"art": ("beschluss"(?:\|"[a-z]+")+)/) || [])[1] || '';
const ab = artenBackend.replace(/"/g, '').split('|').filter(Boolean);
pruef('F2 jede Backend-Art kennt das Frontend', ab.length >= 8 && ab.every((a) => HV.ARTEN[a]), ab.filter((a) => !HV.ARTEN[a]).join(','));

console.log('hausverlauf-pruefen: ' + ok + ' grün, ' + fehl + ' rot');
process.exit(fehl ? 1 : 0);
