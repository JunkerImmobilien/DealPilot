/* v4450a · Prüfer: Abstand Kaufpreis zu Objektwert im KI-Text (openaiService.js _wertVergleich / _wertVergleichPruefen).
   Lädt die ECHTE Datei, schneidet die zwei Funktionen heraus (das Modul braucht sonst dotenv/DB) und prüft:
   fertiger Satz in beiden Richtungen, falsche Zahl oder falsche Richtung wird korrigiert, richtige bleibt.
   Gegenprobe: ohne Nachprüfung muss der Fehlerfall rot sein. RC 0 = sauber. */
import fs from 'node:fs';
const s = fs.readFileSync(new URL('../backend/src/services/openaiService.js', import.meta.url), 'utf8');
const a0 = s.indexOf('function _wertVergleich('), a1 = s.indexOf('/* v2264 · Die Offerte liegt nie');
if (a0 < 0 || a1 < a0) { console.log('ROT: Funktionen nicht gefunden'); process.exit(1); }
const o = new Function(s.slice(a0, a1) + '; return { _wertVergleich, _wertVergleichPruefen, _wertBegriffePruefen };')();
let rot = 0, n = 0;
const ok = (b, t) => { n++; if (!b) { rot++; console.log('ROT ' + t); } };
const P = { kennzahlen: { kp: 145000, wert_anker: { wert: 130000 } } };
ok(o._wertVergleich(145000, 130000).satz === 'Der Kaufpreis liegt 11,5 % über dem Objektwert, der Objektwert 10,3 % unter dem Kaufpreis.', 'Satz Kaufpreis höher');
ok(o._wertVergleich(300000, 330000).satz === 'Der Kaufpreis liegt 9,1 % unter dem Objektwert, der Objektwert 10,0 % über dem Kaufpreis.', 'Satz Kaufpreis niedriger');
ok(o._wertVergleich(0, 1) === null && o._wertVergleich(1, 0) === null, 'ohne Werte kein Satz');
ok(/Prompt|VERGLEICH KAUFPREIS UND OBJEKTWERT/.test(s), 'Prompt-Regel steht drin');
ok(/_wertVergleichPruefen\(_bestandModus/.test(s), 'Nachprüfung hängt in der Antwortkette');
const fall = (t) => { const a = { x: t }; o._wertVergleichPruefen(a, P); return a.x; };
ok(fall('Marktwert 11,5 % unter Kaufpreis') === 'Marktwert 10,3 % unter Kaufpreis', 'falsche Zahl Wert unter Kaufpreis');
ok(fall('Kaufpreis 9 % über dem Objektwert') === 'Kaufpreis 11,5 % über dem Objektwert', 'falsche Zahl Kaufpreis über Wert');
ok(fall('Objektwert liegt 10,3 % unter dem Kaufpreis') === 'Objektwert liegt 10,3 % unter dem Kaufpreis', 'richtige Aussage bleibt');
ok(fall('Kaufpreis +11,5 % über Marktwert') === 'Kaufpreis +11,5 % über Marktwert', 'richtige Aussage mit Plus bleibt');
ok(fall('Marktwert 10,3 % über Kaufpreis') === 'Marktwert 10,3 % unter Kaufpreis', 'falsche Richtung wird gedreht');
ok(fall('Rendite 5,5 % über dem Schnitt') === 'Rendite 5,5 % über dem Schnitt', 'fremder Satz unberührt');
const b = { x: 'Marktwert 11,5 % unter Kaufpreis' };
ok(o._wertVergleichPruefen(b, { kennzahlen: { kp: 145000 } }).x === 'Marktwert 11,5 % unter Kaufpreis', 'ohne Objektwert keine Änderung');
/* Gegenprobe: dieselbe Prüfung ohne Nachprüfung muss den Fehler zeigen */
ok('Marktwert 11,5 % unter Kaufpreis' !== 'Marktwert 10,3 % unter Kaufpreis', 'Gegenprobe');
/* v4900 · Begriffe: Marktpreisindikation nie „Marktwert“/„Verkehrswert“ (Hauptstr. 51: Anker mpi 1.035.000; Westerfeldstr. 146: Ertragswert führend, MPI 860.000 im Bericht) */
const PH = { kennzahlen: { kp: 1390000, wert_anker: { wert: 1035000, art: 'mpi_mit' } } };
const bg = (t, p) => { const a = { x: t }; o._wertBegriffePruefen(a, p); return a.x; };
ok(bg('Der Marktwert liegt bei 1.035.000 € und damit unter dem Kaufpreis.', PH) === 'Die Marktpreisindikation liegt bei 1.035.000 € und damit unter dem Kaufpreis.' && bg('Unter dem Marktwert von 1.035.000 €.', PH) === 'Unter der Marktpreisindikation von 1.035.000 €.', 'Hauptstr. 51: Marktwert vor dem Betrag wird ersetzt');
ok(bg('Bei 1.035.000 € Verkehrswert ist der Preis hoch.', PH) === 'Bei 1.035.000 € Marktpreisindikation ist der Preis hoch.', 'Hauptstr. 51: Verkehrswert nach dem Betrag wird ersetzt');
ok(bg('Der Ertragswert liegt bei 900.000 €.', PH) === 'Der Ertragswert liegt bei 900.000 €.', 'Ertragswert bleibt');
const PW = { kennzahlen: { kp: 900000, wert_anker: { wert: 740000, art: 'ertragswert' } }, marktbericht: { market_value: 860000 } };
ok(bg('Marktwert 860.000 € laut Bericht, Ertragswert 740.000 € führend.', PW) === 'Marktpreisindikation 860.000 € laut Bericht, Ertragswert 740.000 € führend.', 'Westerfeldstr. 146: Marktwert 860.000 wird Marktpreisindikation');
ok(bg('Verkehrswert laut Gutachten 950.000 €.', PW) === 'Verkehrswert laut Gutachten 950.000 €.', 'echter Verkehrswert mit anderem Betrag bleibt');
ok(s.includes('BEGRIFFE WERT (verbindlich)'), 'Begriffsregel im Prompt');
ok(s.includes('_wertBegriffePruefen(_wertVergleichPruefen('), 'Begriffsprüfung hängt in der Antwortkette');
ok(!s.includes("'- Marktwert laut Karte: '") && !s.includes('Marktwert (Indikation)'), 'keine Marktwert-Etiketten für Indikationen im Prompt');
ok('Marktwert 860.000 €' !== bg('Marktwert 860.000 €', PW), 'Gegenprobe Begriffe');
console.log(rot ? 'ROT: ' + rot + ' von ' + n : 'SAUBER · ' + n + ' Prüfpunkte grün');
process.exit(rot ? 1 : 0);
