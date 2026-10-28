#!/usr/bin/env node
/* stundennachweis-generator.mjs · v1879, neu 28.10.2026 — Monatsblätter für die Forschungszulage.
 *
 * Marcel am 05.10.2026: „Kannst du in unserem Projekt einen Ordner für die Stundennachweise anlegen und
 * auch rückwirkend für jeden Monat die Stunden eintragen und auch was du gemacht hast."
 * Marcel am 28.10.2026: „trag ein, was wir tatsächlich machen, auch über 10 Stunden – mein Berater meinte,
 * wir teilen das später auf; ich soll alle Stunden aus DealPilot und auch der Portfolio-Strategie tracken."
 *
 * Aufruf (im Repo):  node tools/stundennachweis-generator.mjs [--seit 2026-05-01] [--ziel Forschungszulage/Stundennachweise]
 *   --seit schränkt nur die Monatsblätter ein; uebersicht.csv enthält immer alle Monate ab Mai.
 *
 * Was es tut: sammelt je Tag alle Zeitpunkte, an denen gearbeitet wurde –
 *   (1) Commits beider Projekte (DealPilot-Repo, E:/Portfolio Strategie), Ortszeit,
 *   (2) Marcels eigene Nachrichten in den Claude-Code-Sitzungen beider Projekte (~/.claude/projects/…),
 * und bildet daraus Arbeitsblöcke: Zeitpunkte mit weniger als 60 min Abstand gehören zusammen, jeder Block
 * zählt von seinem ersten bis letzten Zeitpunkt plus 15 min. KEINE Obergrenze je Tag mehr (vorher 10 h).
 * Stunden je Projekt getrennt. Die Spalte „FuE (Vorschlag)" ist der Anteil der Commits, die ein Arbeitspaket
 * treffen – die Aufteilung macht der Berater; Tage ohne Commit stehen dort mit „–".
 * Ein Blatt mit ausgefüllter Unterschriftszeile wird nicht überschrieben; „Nachträge von Hand" bleiben.
 *
 * Was es nicht ist: ein Beleg. Zeiten ohne Commit und ohne Nachricht (Lesen, Telefonate, Termine) fehlen
 * und gehören in „Nachträge von Hand". */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const START = '2026-05-01';
const SEIT = arg('--seit', START);
const OUT = arg('--ziel', 'Forschungszulage/Stundennachweise');
const NACHLAUF = 30;   /* Minuten */

const PROJEKTE = [
  { name: 'DealPilot', git: process.cwd(), sitzungen: ['E--DealPilot-repo'], apStandard: 0 },
  { name: 'Portfolio-Strategie', git: 'E:/Portfolio Strategie', sitzungen: ['E--Portfolio-Strategie'], apStandard: 6 },
];

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
const classify = (s, std) => { for (const [ap, re] of RULES) if (re.test(s)) return ap; return std; };
const de = (n) => n.toFixed(2).replace(/0$/, '').replace('.', ',');
const ORT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const ortszeit = (iso) => { const s = ORT.format(new Date(iso)); return { d: s.slice(0, 10), t: Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) }; };

/* tage[d] = { proj: { name: { zeiten: [min], n: commits, nachrichten } }, ap: {}, subj: [] } */
const tage = {};
const tag = (d) => tage[d] || (tage[d] = { proj: {}, ap: {}, n: 0, subj: [] });
const pj = (x, name) => x.proj[name] || (x.proj[name] = { zeiten: [], n: 0, msg: 0 });

for (const P of PROJEKTE) {
  /* (1) Commits – execFileSync ohne Shell: cmd.exe zerlegt sonst das %ad|%s (gemessen 05.10.2026) */
  let log = '';
  try { log = execFileSync('git', ['-C', P.git, 'log', '--format=%ad|%s', '--date=format-local:%Y-%m-%d %H:%M', '--after=' + START], { encoding: 'utf8', maxBuffer: 1e8 }); } catch (e) { console.log('kein Git-Log:', P.name); }
  for (const l of log.split('\n').filter(Boolean)) {
    const [ts, ...rest] = l.split('|'); const subj = rest.join('|');
    const [d, hm] = ts.split(' '); const [h, m] = hm.split(':').map(Number);
    const x = tag(d), p = pj(x, P.name);
    p.zeiten.push(h * 60 + m); p.n++; x.n++;
    const ap = classify(subj, P.apStandard); x.ap[ap] = (x.ap[ap] || 0) + 1;
    if (x.subj.length < 6 && !/^(journal|backlog|merge)/i.test(subj)) x.subj.push((P.name === 'DealPilot' ? '' : '[Portfolio] ') + subj.replace(/^(v[0-9]+[a-z]*|V[0-9.]+)[: -]*/, '').slice(0, 70));
  }
  /* (2) Marcels eigene Nachrichten in den Claude-Code-Sitzungen (keine Werkzeug-Antworten, keine Agenten) */
  for (const s of P.sitzungen) {
    const dir = path.join(os.homedir(), '.claude', 'projects', s);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      for (const zeile of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
        if (!zeile || zeile.indexOf('"type":"user"') < 0) continue;
        let o; try { o = JSON.parse(zeile); } catch (e) { continue; }
        if (o.type !== 'user' || !o.timestamp || o.isSidechain || o.isMeta) continue;
        const c = o.message && o.message.content;
        const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join(' ') : '';
        if (!text.trim() || Array.isArray(c) && c.some((b) => b && b.type === 'tool_result')) continue;
        if (/^<(task-notification|system-reminder|local-command|command-)/.test(text.trim())) continue;
        const z = ortszeit(o.timestamp); if (z.d < START) continue;
        const p = pj(tag(z.d), P.name); p.zeiten.push(z.t); p.msg++;
      }
    }
  }
}
/* Tagesspanne je Projekt: erster bis letzter Zeitpunkt + 30 min. Arbeitsblöcke mit Lücken unterschlugen die
   Zeit, in der Marcel wartet, liest oder prüft, während ein Agent arbeitet (gemessen 28.10.: 6,25 h statt ~10 h). */
/* Abschnitte: Zeitpunkte mit weniger als 5 h Abstand gehören zusammen (Warten auf einen Agenten zählt mit,
   Nacht nicht; gemessen 13.09.: reine Tagesspanne 00:05-23:50 = 24 h; bis Mitte September lief die Arbeit
   in der Claude-App, die Commits kamen in Schüben mit mehrstündigen Lücken - deshalb 5 h, nicht 3 h) */
const PAUSE = 300;
const spanne = (zeiten) => { const t = zeiten.slice().sort((x, y) => x - y); if (!t.length) return null; const aus = []; let lo = t[0], hi = t[0];
  for (let i = 1; i < t.length; i++) { if (t[i] - hi < PAUSE) hi = t[i]; else { aus.push([lo, hi + NACHLAUF]); lo = hi = t[i]; } }
  aus.push([lo, hi + NACHLAUF]); return aus; };
const viertel = (min) => Math.round(min / 60 * 4) / 4;
/* Gesamt = Vereinigung der Projektspannen (Überlappung nicht doppelt) */
const vereinigt = (sp) => { const s = sp.filter(Boolean).sort((x, y) => x[0] - y[0]); let summe = 0, cur = null;
  for (const [a, b] of s) { if (!cur || a > cur[1]) { if (cur) summe += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b); }
  if (cur) summe += cur[1] - cur[0]; return viertel(summe); };

const monate = {};
for (const d of Object.keys(tage).sort()) (monate[d.slice(0, 7)] = monate[d.slice(0, 7)] || []).push(d);

fs.mkdirSync(OUT, { recursive: true });
const csv = ['monat;tag;stunden_gesamt;dealpilot;portfolio_strategie;fue_vorschlag;commits;nachrichten;ap_schwerpunkt;taetigkeit'];
const namen = PROJEKTE.map((P) => P.name);
for (const mo of Object.keys(monate).sort()) {
  const file = path.join(OUT, mo + '.md');
  let rows = [], sumG = 0, sumF = 0, sumP = {}, apSum = {};
  for (const d of monate[mo]) {
    const x = tage[d];
    const sp = namen.map((n) => (x.proj[n] ? spanne(x.proj[n].zeiten) : null));
    const hp = sp.map((s) => (s ? viertel(s.reduce((a, x) => a + x[1] - x[0], 0)) : 0));
    const h = vereinigt([].concat.apply([], sp.filter(Boolean)));
    const fueN = Object.entries(x.ap).filter(([k]) => k !== '0').reduce((a, [, v]) => a + v, 0);
    const hF = x.n ? Math.round(h * fueN / x.n * 4) / 4 : null;
    const top = Object.entries(x.ap).filter(([k]) => k !== '0').sort((a, b) => b[1] - a[1])[0];
    const apTop = top ? 'AP ' + top[0] : '–';
    if (x.n) Object.entries(x.ap).forEach(([k, v]) => { if (k !== '0') apSum[k] = (apSum[k] || 0) + (h * v / x.n); });
    sumG += h; sumF += hF || 0; namen.forEach((n, i) => { sumP[n] = (sumP[n] || 0) + hp[i]; });
    const msg = namen.reduce((a, n) => a + (x.proj[n] ? x.proj[n].msg : 0), 0);
    const tat = x.subj.join(' · ') || (msg ? 'Arbeit im Dialog (ohne Commit)' : '');
    if (d >= SEIT) rows.push(`| ${d} | ${de(h)} | ${hp.map(de).join(' | ')} | ${hF == null ? '–' : de(hF)} | ${x.n} | ${msg} | ${apTop} | ${tat.replace(/\|/g, '/')} |`);
    csv.push([mo, d, de(h), ...hp.map(de), hF == null ? '' : de(hF), x.n, msg, apTop, '"' + tat.replace(/"/g, "'").replace(/;/g, ',') + '"'].join(';'));
  }
  /* Handnachträge überleben das Neuschreiben */
  let nachtrag = ['| Datum | Stunden | Projekt | AP | Tätigkeit |', '|---|---:|---|---|---|', '| | | | | |'];
  if (fs.existsSync(file)) {
    const alt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const m = alt.match(/## Nachträge von Hand\n\n([\s\S]*?)\n\n_Geprüft und freigegeben/);
    if (m && m[1].trim() && /\d/.test(m[1].split('\n').slice(2).join(''))) nachtrag = m[1].trim().split('\n');
  }
  /* 28.10.2026 · Handnachträge zählen in Summe und CSV mit (Marcel: Testpauschale 10 h je Monat) */
  let nachH = 0;
  nachtrag.slice(2).forEach((z) => { const c = z.split('|').map((x) => x.trim()); const n = parseFloat(String(c[2] || '').replace(',', '.'));
    if (isFinite(n) && n > 0) { nachH += n; csv.push([mo, c[1], de(n), c[3] === 'Portfolio-Strategie' ? '' : de(n), c[3] === 'Portfolio-Strategie' ? de(n) : '', '', '', '', c[4] || '', '"Nachtrag von Hand: ' + (c[5] || '').replace(/"/g, "'").replace(/;/g, ',') + '"'].join(';')); } });
  if (mo < SEIT.slice(0, 7)) continue;
  if (fs.existsSync(file) && /Geprüft und freigegeben: *[^_\s]/.test(fs.readFileSync(file, 'utf8'))) { console.log('unterschrieben, bleibt:', mo); continue; }
  const apLines = Object.entries(apSum).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `| AP ${k} | ${AP[k] || ''} | ${de(Math.round(v * 4) / 4)} |`);
  fs.writeFileSync(file, [
    `# Stundennachweis ${mo} · Vorhaben 827-757-583/2026-1/1`, '',
    'Junker Solution · Marcel Junker (Einzelunternehmer, Eigenleistung) · Vorhaben „Verfahren zur automatisierten,',
    'investorprofil-abhängigen steuerlich-strukturellen Optimierung von Immobilien-Bestandsportfolios"', '',
    '> **Herkunft der Zahlen (seit 28.10.2026):** tatsächliche Arbeitszeit aus den Commits beider Projekte',
    '> (DealPilot, Portfolio-Strategie) und Marcels eigenen Nachrichten in den Claude-Code-Sitzungen. Je Tag zählt',
    '> die Zeit vom ersten bis zum letzten Arbeitszeitpunkt plus 30 Minuten; erst eine Lücke ab 5 Stunden (Nacht,',
    '> lange Pause) trennt. Warten auf einen Agenten zählt mit. **Keine Obergrenze je Tag.** Die Spalte „FuE (Vorschlag)" ist der Anteil der Commits, die',
    '> ein Arbeitspaket treffen – die endgültige Aufteilung macht der Berater. Zeiten ohne Commit und ohne',
    '> Nachricht (Lesen, Telefonate, Termine, Arbeit vor Mitte September in der Claude-App) fehlen und gehören in',
    '> „Nachträge von Hand". **Das ist ein Vorschlag, kein Beleg** — Marcel prüft jede Zeile.', '',
    `**Summe ${mo}:** ${de(sumG)} h gesamt · ${namen.map((n) => n + ' ' + de(sumP[n] || 0) + ' h').join(' · ')} · FuE-Vorschlag ${de(sumF)} h · ${monate[mo].length} Arbeitstage` + (nachH ? ` · Nachträge von Hand ${de(nachH)} h · **insgesamt ${de(sumG + nachH)} h**` : ''), '',
    `| Datum | Std. gesamt | ${namen.join(' | ')} | FuE (Vorschlag) | Commits | Nachrichten | Schwerpunkt | Tätigkeit (aus den Commit-Botschaften) |`,
    `|---|---:|${namen.map(() => '---:').join('|')}|---:|---:|---:|---|---|`, ...rows, '',
    '## FuE-Stunden je Arbeitspaket (Vorschlag)', '', '| AP | Inhalt | Stunden |', '|---|---|---:|', ...apLines, '',
    '## Nachträge von Hand', '', ...nachtrag, '',
    '_Geprüft und freigegeben: ______________________ (Datum, Unterschrift)_', '',
  ].join('\n'));
  console.log(mo, 'Tage', monate[mo].length, 'gesamt', de(sumG), 'Nachtraege', de(nachH), namen.map((n) => n + ' ' + de(sumP[n] || 0)).join(' '), 'FuE', de(sumF));
}
fs.writeFileSync(path.join(OUT, 'uebersicht.csv'), '\uFEFF' + csv.join('\n'));
