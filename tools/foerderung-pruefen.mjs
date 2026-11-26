#!/usr/bin/env node
/* tools/foerderung-pruefen.mjs · v5120 · Förder-Kern (js/foerderung.js) gegen erwartete Programme
   Lädt die ECHTEN Dateien frontend/js/data/foerderregister.js und frontend/js/foerderung.js in
   einem vm-Kontext und rechnet Beispielfälle. Dazu: Kundentext ohne Gedankenstrich/Semikolon,
   jedes Programm mit url, gelesen, antrag. RC=0 sauber. Gegenprobe: --gegenprobe muss RC=1 liefern. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEGEN = process.argv.includes('--gegenprobe');
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(W, 'frontend/js/data/foerderregister.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(W, 'frontend/js/foerderung.js'), 'utf8'), ctx);
const F = ctx.DpFoerderung, R = ctx.DpFoerderregister;
let rot = 0;
const ok = (b, t) => { if (!b) rot++; console.log((b ? 'grün ' : 'ROT  ') + t); };
const ids = (r) => r.liste.map((x) => x.id).sort().join(',');

const faelle = [
  { t: 'Eigennutzer Bestand 1975, 1 Kind, Einkommen 80.000, Klasse G, Heizungstausch Öl, zvE 45.000',
    e: { nutzung: 'eigen', kauf: true, neubau: false, baujahr: 1975, energieklasse: 'G', kinder: 1, haushaltseinkommen: 80000, einkommen_zve: 45000, erste_immobilie: true, massnahmen: ['heizung'], heizung_art: 'oel', stichtag: '2026-11-26' },
    soll: 'kfw124,kfw308,kfw358,kfw458_eigen', satz: 70 /* 30+16+30=76, Deckel 70 % (zvE über 40.000 mit Kind) */ },
  { t: 'Eigennutzer Bestand, Klasse C (308 passt nicht), ohne Maßnahmen',
    e: { nutzung: 'eigen', kauf: true, energieklasse: 'C', kinder: 2, haushaltseinkommen: 70000 }, soll: 'kfw124' },
  { t: 'Eigennutzer Bestand, Einkommen über Grenze (1 Kind, 95.000)',
    e: { nutzung: 'eigen', kauf: true, energieklasse: 'H', kinder: 1, haushaltseinkommen: 95000 }, soll: 'kfw124' },
  { t: 'Vermieter, reiner Kauf ohne Vorhaben: leer',
    e: { nutzung: 'vermietet', kauf: true }, soll: '' },
  { t: 'Vermieter mit Heizungstausch',
    e: { nutzung: 'vermietet', kauf: true, massnahmen: ['heizung'] }, soll: 'kfw359,kfw458' },
  { t: 'Vermieter Effizienzhaus + Fenster',
    e: { nutzung: 'vermietet', massnahmen: ['effizienzhaus', 'huelle'] }, soll: 'bafa_huelle,kfw261,kfw359' },
  { t: 'Neubau Eigennutzer, 2 Kinder, 95.000 (Grenze 100.000)',
    e: { nutzung: 'eigen', neubau: true, kauf: true, kinder: 2, haushaltseinkommen: 95000 }, soll: 'kfw124,kfw296,kfw297,kfw300' },
  { t: 'Neubau Vermieter',
    e: { nutzung: 'vermietet', neubau: true }, soll: 'kfw296,kfw298' }
];
for (const f of faelle) {
  const r = F.passend(f.e, R);
  let soll = f.soll; if (GEGEN && f === faelle[0]) soll = 'kfw124';
  ok(ids(r) === soll, f.t + ' → [' + ids(r) + ']' + (ids(r) === soll ? '' : ' erwartet [' + soll + ']'));
  if (f.satz) { const e = r.liste.find((x) => x.id === 'kfw458_eigen'); ok(e && e.satz_pct === f.satz, '  458 Satz ' + (e && e.satz_pct) + ' % (erwartet ' + f.satz + ')'); }
}
/* Klimageschwindigkeitsbonus sinkt */
ok(F.klimabonusPct(R.programme_eigen.find((p) => p.id === 'kfw458_eigen').klimabonus, '2027-03-01') === 12, 'Klimabonus ab 1.2.2027 = 12 %');
ok(F.klimabonusPct(R.programme_eigen.find((p) => p.id === 'kfw458_eigen').klimabonus, '2028-08-01') === 0, 'Klimabonus ab 1.8.2028 = 0 %');
/* Register: Pflichtfelder, Kundentext */
for (const p of [].concat(R.programme, R.programme_eigen)) {
  const txt = [p.name, p.betrag, p.vorteil, p.voraussetzung, p.antrag].join(' ');
  ok(!!p.url && !!p.gelesen && !!p.antrag && Array.isArray(p.fuer), p.id + ': url, gelesen, antrag, fuer');
  ok(!/[–—;]/.test(txt), p.id + ': Kundentext ohne Gedankenstrich und Semikolon');
}
ok(/^\d{4}-\d{2}-\d{2}$/.test(R.stand), 'Register-Stand ' + R.stand);
console.log(rot ? '\nROT: ' + rot : '\nsauber');
process.exit(rot ? 1 : 0);
