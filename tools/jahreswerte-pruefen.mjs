#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   tools/jahreswerte-pruefen.mjs · v3021 — Jahreswerte-Register prüfen

   Marcel 28.10.2026: „den Wert bitte dann jedes Jahr automatisch neu
   ermitteln, und das müssen wir auch bei den Steuerdaten machen."

   Liest marktbericht/backend/src/lib/data/jahreswerte.json und prüft:
     1. Fälligkeit je Wert (dieselbe Rechnung wie der Admin-Abschnitt,
        lib/jahreswerte.js): überfällig / in 60 Tagen fällig / ok.
     2. Spiegelstellen: jede Stelle im Code trägt denselben Wert, und zwar
        den, der im Register als 'erwartet' steht. Verbotene zweite Quellen
        (z. B. eine Zahl für den Angebotsabschlag im Frontend) sind rot.
     3. Tarif § 32a: jeder Jahrgang in tax.js ist an den Zonengrenzen
        stetig (falsche Koeffizienten springen dort).

   RC=1 nur bei: überfällig (außer verfahren 'automatisch' - dort ist nur
   der Rückfall alt, gelb), Spiegel ungleich, Tarif unstetig.
   „bald fällig" ist gelb und bricht nicht ab.

   Aufruf:  node tools/jahreswerte-pruefen.mjs [--alle] [--heute=JJJJ-MM-TT]
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = await import(pathToFileURL(path.join(REPO, 'marktbericht/backend/src/lib/jahreswerte.js')).href);

const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=')[1];
const alle = process.argv.includes('--alle');
const heute = arg('heute') ? new Date(arg('heute') + 'T12:00:00Z') : new Date();

const reg = J.jahreswerteRegister();
const status = J.jahreswerteStatus(reg, heute);
let rot = 0, gelb = 0;
const zeilen = [];

for (const s of status) {
  const w = reg.werte.find((x) => x.id === s.id);
  const sp = J.spiegelPruefen(w);
  const hatSpiegel = sp.werte.length || (w.verboten || []).length;
  let farbe = 'ok';
  if (s.abbruch || (hatSpiegel && !sp.gleich) || s.fehler) farbe = 'ROT';
  else if (s.status === 'ueberfaellig' || s.status === 'bald') farbe = 'gelb';
  if (farbe === 'ROT') rot++; else if (farbe === 'gelb') gelb++;
  const f = s.faellig_am ? s.faellig_am + ' (' + (s.tage >= 0 ? 'in ' + s.tage : -s.tage + ' ueber') + ' Tg.)' : 'ohne Termin';
  const grund = [];
  if (s.status === 'ueberfaellig') grund.push(s.verfahren === 'automatisch' ? 'Rueckfall im Code alt (automatisch)' : 'UEBERFAELLIG');
  if (s.status === 'bald') grund.push('bald faellig');
  if (s.fehler) grund.push(s.fehler);
  if (hatSpiegel && !sp.gleich) {
    const ws = sp.werte.map((x) => x.ort.split('/').pop() + '=' + (x.wert == null ? '(' + x.fehler + ')' : x.wert));
    grund.push('SPIEGEL UNGLEICH' + (sp.erwartet != null ? ' (erwartet ' + sp.erwartet + ')' : '') + ': ' + ws.join(' | '));
    for (const v of sp.verstoesse) grund.push('ZWEITE QUELLE ' + v);
  }
  if (farbe !== 'ok' || alle) {
    zeilen.push(('[' + farbe + ']').padEnd(7) + ' ' + s.id.padEnd(24) + ' ' + f.padEnd(28) + ' ' + s.verfahren.padEnd(11)
      + (grund.length ? ' ' + grund.join('; ') : (hatSpiegel ? ' Spiegel ' + sp.werte.length + 'x gleich' : '')));
  }
}

/* Tarif § 32a: Stetigkeit an den Zonengrenzen je Jahrgang */
const tax = fs.readFileSync(path.join(REPO, 'frontend/js/tax.js'), 'utf8').replace(/\r\n/g, '\n');
const tb = tax.slice(tax.indexOf('var TARIFE = {'), tax.indexOf('var TARIF_JAHRE'));
const jahrgaenge = [...tb.matchAll(/\n    (\d{4}): \{([\s\S]*?)\n    \}/g)];
for (const [, jahr, body] of jahrgaenge) {
  const g = (k) => { const m = body.match(new RegExp('\\b' + k + ': ([\\d.]+)')); return m ? Number(m[1]) : NaN; };
  const T = { gf: g('grundfreibetrag'), z2bis: g('z2bis'), z2a: g('z2a'), z2b: g('z2b'), z3basis: g('z3basis'), z3bis: g('z3bis'),
    z3a: g('z3a'), z3b: g('z3b'), z3c: g('z3c'), z4bis: g('z4bis'), z4satz: g('z4satz'), z4c: g('z4c'), z5satz: g('z5satz'), z5c: g('z5c') };
  const z2 = (x) => { const y = (x - T.gf) / 1e4; return (T.z2a * y + T.z2b) * y; };
  const z3 = (x) => { const z = (x - T.z3basis) / 1e4; return (T.z3a * z + T.z3b) * z + T.z3c; };
  const sprung = [Math.abs(z2(T.z2bis) - z3(T.z2bis)), Math.abs(z3(T.z3bis) - (T.z4satz * T.z3bis - T.z4c)),
    Math.abs((T.z4satz * T.z4bis - T.z4c) - (T.z5satz * T.z4bis - T.z5c))];
  const ok = sprung.every((d) => Number.isFinite(d) && d < 1);
  if (!ok) rot++;
  if (!ok || alle) zeilen.push(('[' + (ok ? 'ok' : 'ROT') + ']').padEnd(7) + ' tarif ' + jahr + ' stetig an den Zonengrenzen: '
    + sprung.map((d) => d.toFixed(2)).join(' / ') + ' EUR' + (ok ? '' : '  <- Koeffizient falsch?'));
}

console.log('Jahreswerte-Register ' + reg.version + ' (Stand ' + reg.stand + '), ' + reg.werte.length + ' Werte, Tarifjahrgaenge '
  + jahrgaenge.map((x) => x[1]).join('/') + ', geprueft am ' + heute.toISOString().slice(0, 10));
for (const z of zeilen) console.log(z);
console.log((rot ? 'ROT ' + rot : 'gruen') + (gelb ? ' · gelb ' + gelb : '') + ' · ' + (reg.werte.length - rot - gelb) + ' ok');
process.exit(rot ? 1 : 0);
