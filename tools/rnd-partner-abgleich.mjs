#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   tools/rnd-partner-abgleich.mjs · v3580 — KERN GEGEN PARTNER (nur lesend)

   Marcel 16.11.2026: „Rechenkern mit den Partner-Ergebnissen kontinuierlich
   prüfen/verbessern.“ Zu jeder Ersteinschaetzung bei gutachten.org speichert
   routes/gutachterpartner.js die uebergebenen Eingaben, das Partner-Ergebnis und
   die RND UNSERES Kerns zum selben Zeitpunkt (Tabelle gutachter_anfragen, Spalten
   ergebnis / eingaben / kern, Migration 109). Dieses Werkzeug liest die Tabelle
   NUR LESEND und zeigt:
     - Abweichung je Fall (Kern − Partner, Jahre)
     - Mittelwert, Median, Streuung
     - nach Baujahr-Gruppe und Modernisierungsgrad (Punkte Anlage 2 aus der Kern-Eingabe)
     - die groessten Abweichungen
     - Vorschlaege (nur Text). DER KERN WIRD NIE AUTOMATISCH GEAENDERT —
       eine Aenderung an rnd-calc.js nur nach Marcels Freigabe.

     node tools/rnd-partner-abgleich.mjs                 Staging
     node tools/rnd-partner-abgleich.mjs --prod          Produktion (lesend)
     node tools/rnd-partner-abgleich.mjs --nur-produktiv nur Anfragen der Produktiv-Umgebung des Partners
     node tools/rnd-partner-abgleich.mjs --json          Rohdaten als JSON
     node tools/rnd-partner-abgleich.mjs --datei=x.json  aus einer Datei statt vom Server (Pruefer)
   ══════════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const arg = process.argv.slice(2);
const hat = (n) => arg.includes('--' + n);
const wert = (n) => { const a = arg.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const SERVER = hat('prod') ? 'root@157.90.117.167' : 'root@116.203.214.11';

const SQL = "SELECT COALESCE(json_agg(json_build_object('nr', request_number, 'zeit', created_at, 'objekt', objekt_id, 'umgebung', umgebung, "
  + "'ergebnis', ergebnis, 'eingaben', eingaben, 'kern', kern) ORDER BY created_at), '[]'::json) FROM gutachter_anfragen "
  + "WHERE formular = 'remaining-useful-life-lite' AND ergebnis ? 'finalAverageRUL'";

export function laden() {
  const d = wert('datei');
  if (d) return JSON.parse(fs.readFileSync(d, 'utf8'));
  const out = execFileSync('ssh', [SERVER, 'docker exec dealpilot-postgres psql -U dealpilot -d dealpilot_db -tAc "' + SQL.replace(/"/g, '\\"') + '"'], { encoding: 'utf8' });
  return JSON.parse(out.trim() || '[]');
}

function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function mittel(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
function streuung(a) { if (a.length < 2) return null; const m = mittel(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); }
const f1 = (x) => (x == null ? '–' : (Math.round(x * 10) / 10).toFixed(1).replace('.', ','));

export function faelleBauen(roh) {
  return roh.map((r) => {
    const e = r.ergebnis || {}, k = r.kern || {}, ein = r.eingaben || {};
    const bj = (ein.property && ein.property.constructionYear) || (k.eingabe && k.eingabe.baujahr) || null;
    const punkte = k.eingabe && k.eingabe.modPoints != null ? Number(k.eingabe.modPoints) : null;
    const partner = Number(e.finalAverageRUL), kern = k.final_rnd != null ? Number(k.final_rnd) : null;
    return { nr: r.nr, zeit: r.zeit, objekt: r.objekt, umgebung: r.umgebung, baujahr: bj, punkte, partner, spanne: e.finalRangeRUL || null,
      partnerAfa: e.annualDepreciation, technisch: e.technicalMethodResult, punktraster: e.pointGridMethodResult,
      kern, kernVerfahren: k.verfahren || null, kernFehlt: k.fehlt || (kern == null ? 'kein Kernwert' : null),
      diff: kern != null && isFinite(partner) ? kern - partner : null };
  });
}
export function bjGruppe(bj) { if (!bj) return 'Baujahr unbekannt'; if (bj < 1950) return 'vor 1950'; if (bj < 1970) return '1950–1969'; if (bj < 1990) return '1970–1989'; if (bj < 2010) return '1990–2009'; return 'ab 2010'; }
/* Modernisierungsgrad nach Anlage 2 ImmoWertV (Punkte) */
export function modGruppe(p) { if (p == null) return 'Punkte unbekannt'; if (p <= 1) return 'nicht modernisiert (0–1)'; if (p <= 5) return 'kleine Modernisierungen (2–5)'; if (p <= 10) return 'mittlerer Grad (6–10)'; if (p <= 17) return 'überwiegend modernisiert (11–17)'; return 'umfassend modernisiert (18–20)'; }
export function auswerten(faelle) {
  const mit = faelle.filter((f) => f.diff != null);
  const d = mit.map((f) => f.diff);
  const gruppen = (fn) => {
    const g = {};
    mit.forEach((f) => { const k = fn(f); (g[k] = g[k] || []).push(f.diff); });
    return Object.keys(g).map((k) => ({ gruppe: k, n: g[k].length, mittel: mittel(g[k]), median: median(g[k]) }));
  };
  return { n: faelle.length, nMitKern: mit.length, mittel: mittel(d), median: median(d), streuung: streuung(d),
    mittelAbs: mittel(d.map(Math.abs)), nachBaujahr: gruppen((f) => bjGruppe(f.baujahr)), nachModernisierung: gruppen((f) => modGruppe(f.punkte)),
    groesste: mit.slice().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 10) };
}
export function vorschlaege(a) {
  const v = [];
  if (a.nMitKern < 10) v.push('Erst ab etwa 10 Fällen mit Kernwert ist eine Aussage belastbar (heute ' + a.nMitKern + '). Bis dahin: sammeln, nichts ändern.');
  [...a.nachBaujahr, ...a.nachModernisierung].forEach((g) => {
    if (g.n >= 5 && Math.abs(g.median) >= 3) v.push('Gruppe „' + g.gruppe + '“ (' + g.n + ' Fälle): Kern liegt im Median ' + f1(Math.abs(g.median)) + ' Jahre ' + (g.median > 0 ? 'ÜBER' : 'UNTER') + ' gutachten.org — Gesamtnutzungsdauer und Punktraster dieser Gruppe prüfen (Vorschlag, keine Änderung).');
  });
  if (a.mittel != null && Math.abs(a.mittel) >= 3 && a.nMitKern >= 10) v.push('Systematische Abweichung insgesamt ' + f1(a.mittel) + ' Jahre (Kern − Partner) — Rangfolge der Verfahren in rnd-calc.js mit Marcel besprechen.');
  return v;
}

const istHaupt = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (istHaupt) {
  const roh = laden();
  let faelle = faelleBauen(roh);
  if (hat('nur-produktiv')) faelle = faelle.filter((f) => f.umgebung === 'produktion');
  if (hat('json')) { console.log(JSON.stringify(faelle, null, 1)); process.exit(0); }
  const a = auswerten(faelle);
  console.log('Kern gegen gutachten.org · ' + (hat('prod') ? 'Produktion' : 'Staging') + ' · ' + a.n + ' Ersteinschätzungen, ' + a.nMitKern + ' mit Kernwert');
  console.log('Abweichung Kern − Partner (Jahre): Mittel ' + f1(a.mittel) + ' · Median ' + f1(a.median) + ' · Streuung ' + f1(a.streuung) + ' · mittlerer Betrag ' + f1(a.mittelAbs));
  console.log('\nNach Baujahr:'); a.nachBaujahr.forEach((g) => console.log('  ' + g.gruppe.padEnd(18) + ' n=' + g.n + '  Mittel ' + f1(g.mittel) + '  Median ' + f1(g.median)));
  console.log('Nach Modernisierungsgrad:'); a.nachModernisierung.forEach((g) => console.log('  ' + g.gruppe.padEnd(34) + ' n=' + g.n + '  Mittel ' + f1(g.mittel) + '  Median ' + f1(g.median)));
  console.log('\nFälle (größte Abweichung zuerst):');
  a.groesste.forEach((f) => console.log('  ' + (f.nr || '?') + '  Bj ' + (f.baujahr || '?') + '  Punkte ' + (f.punkte == null ? '?' : f.punkte) + '  Partner ' + f.partner + ' J (' + (f.spanne || '–') + ')  Kern ' + f.kern + ' J (' + (f.kernVerfahren || '') + ')  Δ ' + f1(f.diff) + (f.umgebung === 'test' ? '  [Test]' : '')));
  const ohne = faelle.filter((f) => f.diff == null);
  if (ohne.length) { console.log('\nOhne Kernwert:'); ohne.forEach((f) => console.log('  ' + (f.nr || '?') + '  ' + (f.kernFehlt || ''))); }
  console.log('\nVorschläge (nur Text, der Kern wird nicht geändert):'); vorschlaege(a).forEach((x) => console.log('  - ' + x));
}
