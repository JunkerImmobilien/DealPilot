#!/usr/bin/env node
/* uk-flaeche-pruefen.mjs (v2279) — prueft JEDEN Registersatz der Kennzahl
   umrechnungskoeffizient_flaeche gegen sich selbst und gegen das amtliche
   Anwendungsbeispiel (formel.pruefbeispiel), mit der ECHTEN Funktion aus
   lib/umrechnung_flaeche.js:

     1. Anwendungsbeispiel des Dokuments nachgerechnet (Koeffizient + Bodenwert)
     2. Tabelle: gleich lange Achsen, Flaechen streng steigend,
        Koeffizient bei der Normgroesse = 1,00, faellt mit der Flaeche (nie steigt)
     3. Regel oberhalb der Tabelle schliesst an die Tabelle an (letzter Wert)
     4. Satz fuehrt Quelle, Lizenz, Stichtag, Fundstelle
   Nennt die DECKUNG (Dateien, Saetze, Laender). RC=0 sauber. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDNER = path.join(WURZEL, 'marktbericht/backend/src/lib/register');
const UK = await import('file://' + path.join(WURZEL, 'marktbericht/backend/src/lib/umrechnung_flaeche.js').replace(/\\/g, '/'));

let rc = 0, saetze = 0, dateien = 0, beispiele = 0;
const laender = new Set();
const rot = (t) => { rc = 1; console.log('  ROT  ' + t); };

for (const f of fs.readdirSync(ORDNER).filter((x) => x.endsWith('.json')).sort()) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(ORDNER, f), 'utf8')); } catch { continue; }
  if (!Array.isArray(arr)) continue;
  const uk = arr.filter((s) => s && s.kennzahl === UK.KENNZAHL);
  if (!uk.length) continue;
  dateien++;
  for (const s of uk) {
    saetze++; laender.add(s.land_code);
    const wo = f + ' ' + (s.gebiet_name || s.ags) + '/' + s.zweig;
    if (s.vollstaendig === false) continue;   /* Sperre: Weg ohne Zahl */
    for (const k of ['quelle_url', 'lizenz', 'stichtag', 'fundstelle', 'quellenvermerk']) {
      if (!s[k]) rot(wo + ': ' + k + ' fehlt');
    }
    const fm = s.formel || {};
    for (const [schl, t] of Object.entries(fm.tabellen || {})) {
      /* v2281b · Tabelle "*" (eine fuer jede Bezugsgroesse): ihr 1,00-Punkt steht in
         t.bezug_qm - ohne ihn ist die Normprobe nicht moeglich und der Satz rot. */
      const norm = schl === '*' ? t.bezug_qm : schl;
      if (!(Number(norm) > 0)) { rot(wo + ' Tabelle ' + schl + ': bezug_qm fehlt (1,00-Punkt der Tabelle)'); continue; }
      const xs = t.flaeche_qm || [], ys = t.koeffizient || [];
      if (xs.length !== ys.length) { rot(wo + ' Norm ' + norm + ': Achsen ungleich lang'); continue; }
      for (let i = 1; i < xs.length; i++) {
        if (!(xs[i] > xs[i - 1])) rot(wo + ' Norm ' + norm + ': Flaeche nicht steigend bei ' + xs[i]);
        if (ys[i] > ys[i - 1] + 1e-9) rot(wo + ' Norm ' + norm + ': Koeffizient steigt bei ' + xs[i] + ' m²');
      }
      const kn = UK.koeffizientFuer(s, Number(norm), Number(norm));
      if (kn.k == null || Math.abs(kn.k - 1) > 0.005) rot(wo + ' Norm ' + norm + ': Koeffizient bei der Normgroesse ' + kn.k + ' statt 1,00');
      const max = xs[xs.length - 1];
      const kMax = UK.koeffizientFuer(s, max, Number(norm)), kDrueber = UK.koeffizientFuer(s, max + 1, Number(norm));
      if (kDrueber.k != null && Math.abs(kDrueber.k - kMax.k) > 0.01) {
        rot(wo + ' Norm ' + norm + ': Regel oberhalb springt an der Tabellengrenze (' + kMax.k + ' -> ' + kDrueber.k + ')');
      }
    }
    const b = UK.pruefeBeispiel(s);
    if (b.ok === null) console.log('  HINWEIS ' + wo + ': kein Anwendungsbeispiel im Dokument');
    else if (!b.ok) rot(wo + ': Anwendungsbeispiel nicht getroffen — Koeffizient ' + b.k + ' (soll ' + b.soll_k
      + '), Bodenwert ' + b.bodenwert + ' (soll ' + b.soll_bodenwert + ')');
    else beispiele++;
  }
}
console.log('DECKUNG: ' + dateien + ' Datei(en), ' + saetze + ' Saetze, Laender ' + ([...laender].sort().join(' ') || '–')
  + ', ' + beispiele + ' Anwendungsbeispiel(e) getroffen');
console.log(rc ? 'ERGEBNIS: ROT' : 'ERGEBNIS: sauber');
process.exit(rc);
