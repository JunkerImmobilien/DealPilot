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
    /* v2287b · Eine Sperre traegt KEINE rechenbare Formel. mb.param_modell kennt
       kein vollstaendig-Feld - eine Sperre mit Tabelle kam dort als WERT an
       (HE, TH, Aachen, Staging 16.10.2026). Vorgemerkte Tabellen: formel_vorgemerkt. */
    if ((s.vollstaendig === false || s.warum_kein_wert) && s.formel && s.formel.form !== 'konstante') {
      rot(wo + ': Sperre mit rechenbarer Formel (' + s.formel.form + ') - nach formel_vorgemerkt verschieben');
    }
    if (s.vollstaendig === false) continue;   /* Sperre: Weg ohne Zahl */
    for (const k of ['quelle_url', 'lizenz', 'stichtag', 'fundstelle', 'quellenvermerk']) {
      if (!s[k]) rot(wo + ': ' + k + ' fehlt');
    }
    const fm = s.formel || {};
    for (const [schl, t] of Object.entries(fm.tabellen || {})) {
      /* v2281b · Tabelle "*" (eine fuer jede Bezugsgroesse): steht ihr 1,00-Punkt in
         t.bezug_qm, wird dort geprueft; sonst sucht ihn der Block unten selbst. */
      const norm = schl === '*' && Number(t.bezug_qm) > 0 ? t.bezug_qm : schl;
      const xs = t.flaeche_qm || [], ys = t.koeffizient || [];
      if (xs.length !== ys.length) { rot(wo + ' Norm ' + norm + ': Achsen ungleich lang'); continue; }
      for (let i = 1; i < xs.length; i++) {
        if (!(xs[i] > xs[i - 1])) rot(wo + ' Norm ' + norm + ': Flaeche nicht steigend bei ' + xs[i]);
        if (ys[i] > ys[i - 1] + 1e-9) rot(wo + ' Norm ' + norm + ': Koeffizient steigt bei ' + xs[i] + ' m²');
      }
      /* v2281b · Schluessel "*" = EINE Tabelle fuer jede Bezugsgroesse (der Kern
         rechnet UK(Objekt) / UK(Richtwertgrundstueck), BORIS-NI). Number('*')
         ist NaN - geprueft wird dann am Bezugspunkt der Tabelle (Koeffizient 1,00). */
      let normZ = Number(norm);
      if (norm === '*') {
        const i1 = ys.findIndex((y) => Math.abs(y - 1) < 0.005);
        if (i1 < 0) { rot(wo + ' Tabelle *: kein Bezugspunkt mit Koeffizient 1,00'); continue; }
        normZ = xs[i1];
      }
      const kn = UK.koeffizientFuer(s, normZ, normZ);
      if (kn.k == null || Math.abs(kn.k - 1) > 0.005) rot(wo + ' Norm ' + norm + ': Koeffizient bei der Normgroesse ' + kn.k + ' statt 1,00');
      const max = xs[xs.length - 1];
      const kMax = UK.koeffizientFuer(s, max, normZ), kDrueber = UK.koeffizientFuer(s, max + 1, normZ);
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
