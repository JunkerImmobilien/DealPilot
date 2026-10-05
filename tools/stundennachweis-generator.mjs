#!/usr/bin/env node
/* stundennachweis-generator.mjs · v1879 — Monatsblätter für die Forschungszulage aus der Commit-Historie.
 *
 * Marcel am 05.10.2026: „Kannst du in unserem Projekt einen Ordner für die Stundennachweise anlegen und
 * auch rückwirkend für jeden Monat die Stunden eintragen und auch was du gemacht hast."
 *
 * Aufruf (im Repo):  node tools/stundennachweis-generator.mjs [--seit 2026-05-01] [--ziel Forschungszulage/Stundennachweise]
 *
 * Was es tut: liest `git log`, bildet je Tag die Spanne erster→letzter Commit + 30 min (höchstens 10 h),
 * ordnet Commit-Botschaften per Stichwortregel den Arbeitspaketen zu und schreibt je Monat ein Markdown-Blatt
 * plus eine CSV. Ein Blatt, das schon eine Unterschriftszeile mit Datum trägt (Zeile „Geprüft und freigegeben:"
 * mit etwas anderem als Unterstrichen), wird NICHT überschrieben.
 *
 * Was es nicht ist: ein Beleg. Die Zahlen sind eine Rekonstruktion und werden von Marcel geprüft. */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SEIT = arg('--seit', '2026-05-01');
const OUT = arg('--ziel', 'Forschungszulage/Stundennachweise');
const CAP = 10;

const AP = {
  2: 'Steuer-Rechenkern (AfA-Methodenwechsel, § 7b, V+V, Tarif § 32a, Verlustverrechnung)',
  3: 'Normableitung (Normtext zu Rechengröße, Wahlrechte)',
  4: 'Datenfusion (Bewertungsquellen, Liegenschaftszins/Sachwertfaktor-Register, Marktbericht)',
  6: 'Heuristische Suche / Szenario-Engine (Portfolio, Zuordnung und Zeitpunkt)',
  7: 'Restriktions- und Fristenmodell (Budgets, Fristen, Freibeträge)',
  8: 'Ereignisextraktion aus Freitext (Sprache, Dialog, Import)',
  9: 'Profilgewichtung (Investorprofil, Deal Score, Kennzahlen)',
  10: 'Validierung (Prüfläufe, Messungen, Fehlalarmanalyse)',
};
const RULES = [
  [2, /steuer|afa|§ ?7|7b|bmf|kaufpreisaufteil|zve|progress|anlage v|verlust|15 ?%|grenze|abschreib|restnutzungsdauer|rnd/i],
  [4, /avm|marktbericht|markteinsch|bewertungsquell|liegenschaftszins|lzs|sachwertfaktor|swf|ernte|register|boris|bodenricht|sprengnetter|pricehubble|konsens|spanne|wertermittl|immowertv|ertragswert|sachwert|gutachter|nhk|baupreis|mietspiegel|marktmiete|quellen/i],
  [6, /portfolio|heuristik|umschicht|zuordnung|strategie|szenario|exit|gmbh|vermögensverwalt|vermoegensverwalt/i],
  [7, /frist|spekulation|drei-objekt|freibetrag|erbst|schenkung|budget/i],
  [8, /sprach|voice|freitext|diktat|telegram|dialog|ereignis|erkenn|import|ocr|expos|pdf-?import|co-?pilot|copilot|agent/i],
  [9, /profil|investor|score|gewicht|ds2|kennzahl|dscr|kpi|rendite|cashflow/i],
  [10, /pr[üue]f|test|validier|messung|selbsttest|fehlalarm|gegenrech|nachgemessen|abnahme/i],
  [3, /norm|wahlrecht|paragraph|§/i],
];
const classify = (s) => { for (const [ap, re] of RULES) if (re.test(s)) return ap; return 0; };
const de = (n) => n.toFixed(1).replace('.', ',');

/* execFileSync ohne Shell: unter Windows zerlegt cmd.exe sonst das %ad|%s (gemessen 05.10.2026). */
const log = execFileSync('git', ['log', '--format=%ad|%s', '--date=format:%Y-%m-%d %H:%M', '--after=' + SEIT], { encoding: 'utf8' });
const days = {};
for (const l of log.split('\n').filter(Boolean)) {
  const [ts, ...rest] = l.split('|'); const subj = rest.join('|');
  const [d, hm] = ts.split(' '); const [h, m] = hm.split(':').map(Number); const t = h * 60 + m;
  const x = days[d] || (days[d] = { lo: t, hi: t, n: 0, ap: {}, subj: [] });
  x.lo = Math.min(x.lo, t); x.hi = Math.max(x.hi, t); x.n++;
  const ap = classify(subj); x.ap[ap] = (x.ap[ap] || 0) + 1;
  if (x.subj.length < 6 && !/^(journal|backlog|merge)/i.test(subj)) x.subj.push(subj.replace(/^(v[0-9]+[a-z]*|V[0-9.]+)[: -]*/, '').slice(0, 70));
}
const stunden = (x) => { let h = (x.hi - x.lo) / 60 + 0.5; if (h < 1) h = 1; if (h > CAP) h = CAP; return Math.round(h * 2) / 2; };

const months = {};
for (const d of Object.keys(days).sort()) (months[d.slice(0, 7)] = months[d.slice(0, 7)] || []).push(d);
fs.mkdirSync(OUT, { recursive: true });
const csv = ['monat;tag;stunden_gesamt;stunden_fue;stunden_produkt;commits;ap_schwerpunkt;taetigkeit'];
for (const mo of Object.keys(months).sort()) {
  const file = path.join(OUT, mo + '.md');
  if (fs.existsSync(file) && /Geprüft und freigegeben: *[^_\s]/.test(fs.readFileSync(file, 'utf8'))) { console.log('unterschrieben, bleibt:', mo); continue; }
  let rows = [], sumG = 0, sumF = 0, sumP = 0, apSum = {};
  for (const d of months[mo]) {
    const x = days[d]; const h = stunden(x);
    const fueN = Object.entries(x.ap).filter(([k]) => k !== '0').reduce((a, [, v]) => a + v, 0);
    const hF = Math.round(h * (x.n ? fueN / x.n : 0) * 2) / 2, hP = Math.round((h - hF) * 2) / 2;
    const top = Object.entries(x.ap).filter(([k]) => k !== '0').sort((a, b) => b[1] - a[1])[0];
    const apTop = top ? 'AP ' + top[0] : '–';
    Object.entries(x.ap).forEach(([k, v]) => { if (k !== '0') apSum[k] = (apSum[k] || 0) + (h * v / x.n); });
    sumG += h; sumF += hF; sumP += hP;
    const tat = x.subj.join(' · ');
    rows.push(`| ${d} | ${de(h)} | ${de(hF)} | ${de(hP)} | ${x.n} | ${apTop} | ${tat.replace(/\|/g, '/')} |`);
    csv.push([mo, d, de(h), de(hF), de(hP), x.n, apTop, '"' + tat.replace(/"/g, "'").replace(/;/g, ',') + '"'].join(';'));
  }
  const apLines = Object.entries(apSum).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `| AP ${k} | ${AP[k] || ''} | ${de(Math.round(v * 2) / 2)} |`);
  fs.writeFileSync(file, [
    `# Stundennachweis ${mo} · Vorhaben 827-757-583/2026-1/1`, '',
    'Junker Solution · Marcel Junker (Einzelunternehmer, Eigenleistung) · Vorhaben „Verfahren zur automatisierten,',
    'investorprofil-abhängigen steuerlich-strukturellen Optimierung von Immobilien-Bestandsportfolios"', '',
    '> **Herkunft der Zahlen:** abgeleitet aus den Commit-Zeitstempeln des Repos (erster bis letzter Commit',
    '> des Tages plus 30 Minuten, höchstens 10 Stunden je Tag). Die Spalte „FuE" ist der Anteil der Commits,',
    '> die ein Arbeitspaket treffen; „Produkt" ist der Rest (Oberfläche, Landing, Deploy, Doku). **Das ist ein',
    '> Vorschlag, kein Beleg** — Marcel prüft und korrigiert jede Zeile, bevor sie beim Finanzamt zählt.',
    '> Tage ohne Commit (Recherche, Gespräche, Lesen) fehlen hier und sind von Hand nachzutragen.', '',
    `**Summe ${mo}:** ${de(sumG)} h gesamt · davon FuE ${de(sumF)} h · Produkt ${de(sumP)} h · ${months[mo].length} Arbeitstage`, '',
    '| Datum | Std. gesamt | FuE | Produkt | Commits | Schwerpunkt | Tätigkeit (aus den Commit-Botschaften) |',
    '|---|---:|---:|---:|---:|---|---|', ...rows, '',
    '## FuE-Stunden je Arbeitspaket (Vorschlag)', '', '| AP | Inhalt | Stunden |', '|---|---|---:|', ...apLines, '',
    '## Nachträge von Hand', '', '| Datum | Stunden | AP | Tätigkeit |', '|---|---:|---|---|', '| | | | |', '',
    '_Geprüft und freigegeben: ______________________ (Datum, Unterschrift)_', '',
  ].join('\n'));
  console.log(mo, 'Tage', months[mo].length, 'gesamt', de(sumG), 'FuE', de(sumF));
}
fs.writeFileSync(path.join(OUT, 'uebersicht.csv'), csv.join('\n'));
