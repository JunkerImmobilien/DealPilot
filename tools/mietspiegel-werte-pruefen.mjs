#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   tools/mietspiegel-werte-pruefen.mjs · v3255 — Mietspiegel-WERTE prüfen

   Liest jede Datei marktbericht/backend/src/lib/mietspiegel/werte/<ags>.json
   (Aufbau: README.md daneben, Abschnitt „Werte“) und prüft:
     1. Pflichtfelder (Kopf, Quelle mit url/dokument/seite/lizenz/abgerufen, Form)
     2. AGS steht im Verzeichnis (verzeichnis.json) und die Art stimmt überein
     3. Zellen/Basis: vollständig, Achsen-Index gültig, unten ≤ mittel ≤ oben,
        alle Werte 3–30 €/m²
     4. mindestens ein Prüfbeispiel; die ECHTE Rechenfunktion
        (lib/mietspiegel/werte.js mietspiegelWerteFuer) liefert für jedes den
        erwarteten Wert ± 0,01 (erwartet null = kein Wert)
   RC=0 sauber, RC=1 bei jedem Fehler. Optionen: --nur=<ags>, --leise.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MS = path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel');
const ORDNER = path.join(MS, 'werte');
const { mietspiegelWerteFuer } = await import(pathToFileURL(path.join(MS, 'werte.js')).href);
const arg = (k) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const NUR = arg('nur'); const LEISE = process.argv.includes('--leise');

const verz = JSON.parse(fs.readFileSync(path.join(MS, 'verzeichnis.json'), 'utf8'));
const jeAgs = new Map((verz.saetze || []).map(s => [s.ags, s]));

const fehler = []; const warn = []; let dateien = 0, beispiele = 0, zellenZahl = 0;
const F = (d, t) => fehler.push(d + ': ' + t);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/* v5080 · Grenze 1,5–40 €/m² (vorher 3–30): Darmstadt führt belegte Werte über 30 €, Velbert unter 3 €. Zwischen 1,5–3 und
   30–40 gelb (am Dokument prüfen), außerhalb rot. */
const plausibel = (v) => isNum(v) && v >= 1.5 && v <= 40;
const grenzwertig = (v) => isNum(v) && (v < 3 || v > 30);
const DATUM = /^\d{4}(-\d{2}(-\d{2})?)?$/;

let liste = [];
try { liste = fs.readdirSync(ORDNER).filter(f => f.endsWith('.json') && !f.startsWith('_')); } catch (e) { liste = []; }
if (NUR) liste = liste.filter(f => f.startsWith(NUR));

for (const f of liste) {
  const d = f;
  if (!/^\d{8}\.json$/.test(f)) { F(d, 'Dateiname muss <ags 8-stellig>.json sein'); continue; }
  let w;
  try { w = JSON.parse(fs.readFileSync(path.join(ORDNER, f), 'utf8')); } catch (e) { F(d, 'kein gültiges JSON: ' + e.message); continue; }
  dateien++;
  /* 1 · Kopf */
  if (w.ags !== f.slice(0, 8)) F(d, 'ags ' + w.ags + ' passt nicht zum Dateinamen');
  for (const k of ['gemeinde', 'art', 'stand', 'einheit', 'form']) if (!w[k]) F(d, 'Pflichtfeld ' + k + ' fehlt');
  for (const k of ['erhebungsstichtag', 'gueltig_ab', 'gueltig_bis']) if (!(k in w)) F(d, 'Feld ' + k + ' fehlt (unbekannt = null)');
  for (const k of ['stand', 'erhebungsstichtag', 'gueltig_ab', 'gueltig_bis']) if (w[k] && !DATUM.test(w[k])) F(d, k + ' „' + w[k] + '“ ist kein Datum (JJJJ, JJJJ-MM, JJJJ-MM-TT)');
  if (!['qualifiziert', 'einfach'].includes(w.art)) F(d, 'art muss qualifiziert oder einfach sein');
  if (w.einheit !== 'eur_qm_nettokalt') F(d, 'einheit muss eur_qm_nettokalt sein');
  if (!['tabelle', 'regression', 'punkte'].includes(w.form)) F(d, 'form unbekannt: ' + w.form);
  const q = w.quelle || {};
  for (const k of ['url', 'dokument', 'seite', 'lizenz', 'abgerufen']) if (!q[k]) F(d, 'quelle.' + k + ' fehlt');
  if (q.url && !/^https?:\/\//.test(q.url)) F(d, 'quelle.url ist kein Link');
  /* 2 · Verzeichnis */
  const s = jeAgs.get(w.ags);
  if (!s) F(d, 'AGS steht nicht im Verzeichnis');
  else {
    if (s.art !== w.art) F(d, 'art „' + w.art + '“ ≠ Verzeichnis „' + s.art + '“');
    if (s.gemeinde && w.gemeinde && s.gemeinde !== w.gemeinde) warn.push(d + ': Gemeinde „' + w.gemeinde + '“ ≠ Verzeichnis „' + s.gemeinde + '“');
  }
  /* 3 · Zellen / Basis */
  if (w.form === 'tabelle') {
    const T = w.tabelle || {}, A = T.achsen || {};
    if (!Array.isArray(T.zellen) || !T.zellen.length) F(d, 'tabelle.zellen fehlt oder leer');
    if (!Array.isArray(A.baujahr) && !Array.isArray(A.wfl)) F(d, 'tabelle.achsen braucht baujahr und/oder wfl');
    for (const ax of ['baujahr', 'wfl']) (A[ax] || []).forEach((k, i) => {
      if (k.von != null && !isNum(k.von)) F(d, ax + '[' + i + '].von keine Zahl');
      if (k.bis != null && !isNum(k.bis)) F(d, ax + '[' + i + '].bis keine Zahl');
      if (isNum(k.von) && isNum(k.bis) && k.von > k.bis) F(d, ax + '[' + i + '] von > bis');
    });
    const sieht = new Set();
    (T.zellen || []).forEach((z, i) => {
      zellenZahl++;
      const wo = 'Zelle ' + i;
      for (const ax of ['baujahr', 'wfl']) if (z[ax] != null && (!Number.isInteger(z[ax]) || !A[ax] || z[ax] < 0 || z[ax] >= A[ax].length)) F(d, wo + ': ' + ax + '-Index ' + z[ax] + ' ungültig');
      for (const ax of ['lage', 'ausstattung']) if (z[ax] != null) {
        const L = A[ax] || [];
        const ok = typeof z[ax] === 'number' ? (z[ax] >= 0 && z[ax] < L.length) : L.some(e => e.schluessel === z[ax]);
        if (!ok) F(d, wo + ': ' + ax + ' „' + z[ax] + '“ steht nicht in der Achse');
      }
      const vals = ['unten', 'mittel', 'oben'].filter(k => z[k] != null);
      if (z.mittel == null) F(d, wo + ': mittel fehlt');
      if (!T.spanne && (z.unten == null || z.oben == null)) warn.push(d + ': ' + wo + ' ohne Spanne (unten/oben) und ohne tabelle.spanne');
      for (const k of vals) { if (!plausibel(z[k])) F(d, wo + ': ' + k + ' ' + z[k] + ' außerhalb 1,5–40 €/m²'); else if (grenzwertig(z[k])) warn.push(d + ': ' + wo + ': ' + k + ' ' + z[k] + ' €/m² außerhalb 3–30, am Dokument prüfen'); }
      if (isNum(z.unten) && isNum(z.mittel) && z.unten > z.mittel) F(d, wo + ': unten > mittel');
      if (isNum(z.mittel) && isNum(z.oben) && z.mittel > z.oben) F(d, wo + ': mittel > oben');
      const key = [z.baujahr, z.wfl, z.lage, z.ausstattung].join('|');
      if (sieht.has(key)) F(d, wo + ': doppelte Zelle ' + key); sieht.add(key);
    });
    /* Vollständigkeit: jede Kombination der Achsen hat eine Zelle (leere Felder im Dokument → Hinweis) */
    const nB = (A.baujahr || [null]).length, nW = (A.wfl || [null]).length, nL = (A.lage || [null]).length;
    const soll = nB * nW * nL, ist = (T.zellen || []).length;
    if (ist < soll) warn.push(d + ': ' + ist + ' von ' + soll + ' Tabellenfeldern belegt (leere Felder im Dokument?)');
    (T.zuschlaege || []).forEach((z, i) => {
      if (!z.merkmal) F(d, 'zuschlaege[' + i + '].merkmal fehlt');
      if (!['eur_qm', 'pct'].includes(z.art)) F(d, 'zuschlaege[' + i + '].art muss eur_qm oder pct sein');
      if (!Array.isArray(z.wfl_klassen) && !isNum(z.wert)) F(d, 'zuschlaege[' + i + '].wert keine Zahl');
      if (!z.beleg) F(d, 'zuschlaege[' + i + '].beleg fehlt');
    });
  } else if (w.form === 'regression') {
    const R = w.regression || {};
    const B = R.basis || {};
    if (!isNum(R.basis_eur_qm) && !Array.isArray(B.werte)) F(d, 'regression braucht basis_eur_qm oder basis.werte');
    (B.werte || []).forEach((b, i) => { zellenZahl++; if (!plausibel(b.eur_qm)) F(d, 'basis.werte[' + i + '].eur_qm ' + b.eur_qm + ' außerhalb 1,5–40'); });
    if (isNum(R.basis_eur_qm) && !plausibel(R.basis_eur_qm)) F(d, 'basis_eur_qm außerhalb 1,5–40');
    (R.faktoren || []).forEach((f, i) => {
      if (!['wfl_kurve', 'baujahr_klasse', 'flag', 'lage', 'auswahl', 'eingabe'].includes(f.typ)) F(d, 'faktoren[' + i + '].typ unbekannt: ' + f.typ);
      /* v3261 · eingabe: Betrag vom Nutzer (Rostock Wohnlage je Adresse) - Spannweite des Verzeichnisses ist Pflicht */
      if (f.typ === 'eingabe' && (!isNum(f.von) || !isNum(f.bis) || f.von > f.bis)) F(d, 'faktoren[' + i + '] eingabe braucht von ≤ bis (Spannweite des Verzeichnisses)');
      if (f.typ === 'eingabe' && f.art === 'faktor') F(d, 'faktoren[' + i + '] eingabe nur mit art pct oder eur_qm');
      if (!['pct', 'eur_qm', 'faktor'].includes(f.art)) F(d, 'faktoren[' + i + '].art unbekannt: ' + f.art);
      if (!f.beleg) F(d, 'faktoren[' + i + '].beleg fehlt');
      if (f.art === 'faktor') {
        /* v3261 · ein Faktor darf { wert, unten, oben } sein (Konfidenzgrenzen, Ibbenbüren) — unten ≤ wert ≤ oben */
        const roh = f.typ === 'flag' ? [f.werte] : Array.isArray(f.werte) ? f.werte : Object.values(f.werte || {});
        roh.forEach(v => {
          const x = v && typeof v === 'object' ? v.wert : v;
          if (!isNum(x) || x < 0.5 || x > 1.6) F(d, 'faktoren[' + i + '] Faktor ' + x + ' unplausibel');
          if (v && typeof v === 'object' && (v.unten != null || v.oben != null)) {
            if (!isNum(v.unten) || !isNum(v.oben) || v.unten > x || x > v.oben) F(d, 'faktoren[' + i + '] Grenzen ' + v.unten + ' ≤ ' + x + ' ≤ ' + v.oben + ' verletzt');
          }
        });
      }
    });
    if (!R.spanne) warn.push(d + ': regression ohne spanne');
  } else if (w.form === 'punkte') {
    if (!w.punkte || !w.punkte.beleg) F(d, 'punkte.beleg fehlt');
  }
  /* 4 · Prüfbeispiele mit der echten Rechenfunktion */
  const pb = Array.isArray(w.pruefbeispiele) ? w.pruefbeispiele : [];
  if (!pb.length) F(d, 'kein Prüfbeispiel');
  if (pb.length && !pb.some(p => p.erwartet && isNum(p.erwartet.mittel))) F(d, 'kein Prüfbeispiel mit erwartetem Wert');
  pb.forEach((p, i) => {
    beispiele++;
    const wo = 'Prüfbeispiel ' + (i + 1) + ' (S. ' + (p.seite || '?') + ')';
    if (!p.seite) F(d, wo + ': seite fehlt');
    const r = mietspiegelWerteFuer(w, p.eingabe || {});
    if (p.erwartet === null) {
      if (r.mittel !== null) F(d, wo + ': erwartet kein Wert, gerechnet ' + r.mittel);
      return;
    }
    for (const k of ['unten', 'mittel', 'oben']) {
      if (!p.erwartet || p.erwartet[k] === undefined) continue;
      const ist = r[k], soll = p.erwartet[k];
      if (ist === null || Math.abs(ist - soll) > 0.0101) F(d, wo + ': ' + k + ' erwartet ' + soll + ', gerechnet ' + ist + ' — ' + (r.rechnung || r.hinweise.join('; ')));
    }
  });
}

/* v5080 · Häuser: jede Datei mit Feld haus hat eine bekannte Regel, ein Zuschlags-Merkmal, das die Datei auch führt,
   und die Regel wirkt in mietspiegelMitWerten (Ausschluss → keine Werte, Zuschlag → anderer Wert als die Wohnung). */
{
  const { mietspiegelMitWerten, hausTyp, werteLaden } = await import(pathToFileURL(path.join(MS, 'werte.js')).href);
  const REGELN = ['zuschlag', 'gilt', 'orientierung', 'oberer_spannenwert', 'ausgeschlossen'];
  let nHaus = 0;
  for (const [ags, w] of werteLaden().jeAgs) {
    const H = w.haus; if (!H) continue; nHaus++;
    if (REGELN.indexOf(H.regel) < 0) { F(ags, 'haus.regel unbekannt: ' + H.regel); continue; }
    if (!H.beleg) F(ags, 'haus ohne beleg');
    if (H.regel === 'zuschlag') {
      const namen = typeof H.merkmal === 'string' ? [H.merkmal] : Object.values(H.merkmal || {});
      const da = new Set([...(((w.tabelle || {}).zuschlaege) || []), ...(((w.regression || {}).faktoren) || []), ...((((w.regression || {}).basis || {}).ersatz) || [])].map((z) => z.merkmal));
      for (const m of namen) if (!da.has(m)) F(ags, 'haus.merkmal ' + m + ' fehlt in den Zuschlägen der Datei');
    }
    if (H.regel === 'ausgeschlossen') {
      const s = mietspiegelMitWerten({ ags }, { baujahr: 1975, wfl: 80, objektart: 'EFH' });
      if (s.werte_verfuegbar || !s.haus_ausgeschlossen) F(ags, 'Ausschluss für Häuser wirkt nicht');
      const s2 = mietspiegelMitWerten({ ags }, { baujahr: 1975, wfl: 80, objektart: 'ETW' });
      if (!s2.werte_verfuegbar) F(ags, 'Ausschluss für Häuser trifft auch die Wohnung');
    }
  }
  if (hausTyp('EFH') !== 'efh' || hausTyp('MFH') !== null || hausTyp('ETW') !== null || hausTyp('Reihenendhaus') !== 'rh') F('hausTyp', 'Zuordnung der Objektart falsch');
  /* Moers 1975/80 m²: Haus mit Zuschlag Mitte der Spanne (22,5 %) liegt über der Wohnung */
  const wo = mietspiegelMitWerten({ ags: '05170024' }, { baujahr: 1975, wfl: 80, objektart: 'ETW' }).werte;
  const ha = mietspiegelMitWerten({ ags: '05170024' }, { baujahr: 1975, wfl: 80, objektart: 'EFH' }).werte;
  if (!(wo && ha && ha.mittel > wo.mittel && Math.abs(ha.mittel / wo.mittel - 1.225) < 0.01)) F('05170024', 'Hauszuschlag Moers nicht 22,5 % (' + (wo && wo.mittel) + ' / ' + (ha && ha.mittel) + ')');
  if (!LEISE) console.log('Häuser: ' + nHaus + ' Dateien mit Hausregel');
}

/* v5110 · DealPilot-Näherung: Spanne (oben/unten) und amtliche Marktmiete (EE6, Marcel 26.11.2026 „nicht zu niedrig") */
{
  const NZ = await import(new URL('../marktbericht/backend/src/lib/mietspiegel/naeherung.js', import.meta.url).href);
  const P = NZ.naeherungParameter(), MM = NZ.marktmieteParameter();
  const zl = [{ dimension: 'gesamt', auspraegung: 'gesamt', wert: 7 }];
  const n0 = NZ.naeherungFuer(P, zl, { baujahr: 1975, wfl: 70 });
  if (!(P && P.spanne && P.spanne.oben > 1 && P.spanne.unten < 1)) F('naeherung', 'naeherung.json ohne Spanne oben/unten');
  else if (!(n0.qm > 0 && n0.oben > n0.qm && n0.unten < n0.qm && Math.abs(n0.oben / n0.qm - P.spanne.oben) < 0.01)) F('naeherung', 'Näherung liefert oben/unten nicht (' + n0.qm + '/' + n0.oben + '/' + n0.unten + ')');
  if (P && P.marktmiete) {
    const m = { qm: 9, ebene: 'kreis' }, n1 = NZ.naeherungFuer(P, zl, { baujahr: 1975, wfl: 70, marktmiete: m });
    const soll = Math.round(((1 - P.marktmiete.gewicht_kreis) * n0.qm + P.marktmiete.gewicht_kreis * 9 * P.marktmiete.g) * 100) / 100;
    if (!(Math.abs(n1.qm - soll) < 0.011)) F('naeherung', 'Marktmiete nicht wie berechnet eingerechnet (' + n1.qm + ' statt ' + soll + ')');
    if (/Gutachterausschuss für|Open Data|NRW/.test(n1.rechnung || '')) F('naeherung', 'Quellenname im Rechenweg');
    if (!MM || !(MM.n_gemeinden + MM.n_kreise > 0)) F('naeherung', 'marktmiete-amtlich.json fehlt oder leer');
    else if (!NZ.marktmieteFuer(MM, '05711000') && !NZ.marktmieteFuer(MM, Object.keys(MM.gemeinde)[0])) F('naeherung', 'marktmieteFuer findet keinen Wert');
  }
  if (!LEISE) console.log('Näherung: Spanne ×' + (P && P.spanne && P.spanne.oben) + ' / ×' + (P && P.spanne && P.spanne.unten) + (P && P.marktmiete ? ', Marktmiete Gewicht Gemeinde ' + P.marktmiete.gewicht_gemeinde + ' Kreis ' + P.marktmiete.gewicht_kreis : ''));
}

if (!LEISE) {
  console.log('Mietspiegel-Werte: ' + dateien + ' Dateien, ' + zellenZahl + ' Tabellenfelder/Basiswerte, ' + beispiele + ' Prüfbeispiele');
  for (const w of warn.slice(0, 15)) console.log('  gelb  ' + w);
  if (warn.length > 15) console.log('  … ' + (warn.length - 15) + ' weitere Hinweise');
}
for (const f of fehler.slice(0, 40)) console.log('  ROT   ' + f);
if (fehler.length > 40) console.log('  … ' + (fehler.length - 40) + ' weitere Fehler');
console.log(fehler.length ? 'RC=1 · ' + fehler.length + ' Fehler' : 'RC=0 · sauber');
process.exit(fehler.length ? 1 : 0);
