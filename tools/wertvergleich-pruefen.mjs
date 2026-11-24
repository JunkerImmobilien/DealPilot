/* v4450a · Prüfer: Abstand Kaufpreis zu Objektwert im KI-Text (openaiService.js _wertVergleich / _wertVergleichPruefen).
   Lädt die ECHTE Datei, schneidet die zwei Funktionen heraus (das Modul braucht sonst dotenv/DB) und prüft:
   fertiger Satz in beiden Richtungen, falsche Zahl oder falsche Richtung wird korrigiert, richtige bleibt.
   Gegenprobe: ohne Nachprüfung muss der Fehlerfall rot sein. RC 0 = sauber. */
import fs from 'node:fs';
const s = fs.readFileSync(new URL('../backend/src/services/openaiService.js', import.meta.url), 'utf8');
const a0 = s.indexOf('function _wertVergleich('), a1 = s.indexOf('/* v2264 · Die Offerte liegt nie');
if (a0 < 0 || a1 < a0) { console.log('ROT: Funktionen nicht gefunden'); process.exit(1); }
const o = new Function(s.slice(a0, a1) + '; return { _wertVergleich, _wertVergleichPruefen };')();
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
console.log(rot ? 'ROT: ' + rot + ' von ' + n : 'SAUBER · ' + n + ' Prüfpunkte grün');
process.exit(rot ? 1 : 0);
