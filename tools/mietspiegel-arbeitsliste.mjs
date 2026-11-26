#!/usr/bin/env node
/* tools/mietspiegel-arbeitsliste.mjs · v5080 — Arbeitsliste für die Mietspiegel-Ernte
   Marcel 26.11.2026: „den Mietspiegel für ALLE Städte und Bundesländer“. Liest das Verzeichnis (alle Gemeinden ab
   50.000 Einwohnern + Demo-Orte) und den Ordner werte/, schreibt Dateien/Register/Mietspiegel-Arbeitsliste.md:
   je Region und Land jede Gemeinde mit Einwohnern, Art, Form, Zugang, Gültigkeit, Status und Link, davor die
   Regeln für die Erntenden (aus tools/mietspiegel-ernteregeln.md). Nach jeder Ernte neu laufen lassen. Nur Dateien. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel');
const ZIEL = path.join(WURZEL, 'Dateien/Register/Mietspiegel-Arbeitsliste.md');
const REGELN = path.join(WURZEL, 'tools/mietspiegel-ernteregeln.md');

const v = JSON.parse(fs.readFileSync(path.join(M, 'verzeichnis.json'), 'utf8'));
const W = {};
for (const f of fs.readdirSync(path.join(M, 'werte')).filter((f) => /^\d{8}\.json$/.test(f))) {
  const j = JSON.parse(fs.readFileSync(path.join(M, 'werte', f), 'utf8')); W[j.ags] = j;
}
const LAND = { SH: 'Schleswig-Holstein', HH: 'Hamburg', NI: 'Niedersachsen', HB: 'Bremen', NW: 'Nordrhein-Westfalen', HE: 'Hessen',
  RP: 'Rheinland-Pfalz', BW: 'Baden-Württemberg', BY: 'Bayern', SL: 'Saarland', BE: 'Berlin', BB: 'Brandenburg',
  MV: 'Mecklenburg-Vorpommern', SN: 'Sachsen', ST: 'Sachsen-Anhalt', TH: 'Thüringen' };
const REGION = { Nord: ['SH', 'HH', 'NI', 'HB', 'MV'], West: ['NW'], Mitte: ['HE', 'RP', 'SL'], Süd: ['BW', 'BY'], Ost: ['BE', 'BB', 'SN', 'ST', 'TH'] };

/* Status-Schlüssel (für die Zählung) und Text */
function status(s) {
  const w = W[s.ags];
  if (w) return w.freigabe === 'gesperrt' ? ['gesperrt', 'Datei gesperrt (Rechtevorbehalt, nur Staging)'] : ['fertig', 'fertig'];
  if (s.werte_nutzung === 'verboten') return ['verboten', 'verboten (Speicherverbot)'];
  if (s.art === 'keiner') return ['kein', 'kein Mietspiegel'];
  if (s.art === 'unklar') return ['unklar', 'unklar, erst Art klären'];
  if (s.zugang && s.zugang !== 'frei' && s.zugang !== 'online_rechner') return ['nicht_frei', 'nicht frei (' + s.zugang + (s.preis ? ', ' + s.preis : '') + ')'];
  if (s.form === 'punkte') return ['offen', 'OFFEN (Punkte)'];
  if (s.form === 'online_rechner' || s.zugang === 'online_rechner') return ['offen', 'OFFEN (nur Online-Rechner, Dokumentation suchen)'];
  return ['offen', 'OFFEN'];
}
const zellen = (s) => [s.gemeinde, s.ags, (s.einwohner_ca || 0).toLocaleString('de-DE'), s.art || '', s.form || '',
  (s.zugang || '') + (s.preis ? ' ' + s.preis : ''), (W[s.ags] && W[s.ags].gueltig_bis) || s.gueltig_bis || (s.naechste_anpassung ? 'nächste ' + s.naechste_anpassung : ''),
  status(s)[1], s.url ? '[Quelle](' + s.url + ')' : ''];

const jeLand = {};
for (const s of v.saetze) (jeLand[s.land] = jeLand[s.land] || []).push(s);
const gesamt = {};
let teil = '';
for (const [reg, laender] of Object.entries(REGION)) {
  const rz = {};
  let rt = '';
  for (const l of laender) {
    const L = (jeLand[l] || []).slice().sort((a, b) => (b.einwohner_ca || 0) - (a.einwohner_ca || 0));
    const z = {};
    L.forEach((s) => { const k = status(s)[0]; z[k] = (z[k] || 0) + 1; rz[k] = (rz[k] || 0) + 1; gesamt[k] = (gesamt[k] || 0) + 1; });
    rt += '### ' + LAND[l] + ' · ' + L.length + ' Gemeinden · ' + Object.entries(z).map(([k, n]) => k + ' ' + n).join(', ') + '\n\n';
    if (!L.length) { rt += '_keine Gemeinde ab 50.000 Einwohnern im Verzeichnis_\n\n'; continue; }
    rt += '| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |\n|---|---|---:|---|---|---|---|---|---|\n';
    for (const s of L) rt += '| ' + zellen(s).join(' | ') + ' |\n';
    rt += '\n';
  }
  teil += '## Region ' + reg + ' (' + laender.join(', ') + ') · ' + Object.entries(rz).map(([k, n]) => k + ' ' + n).join(', ') + '\n\n' + rt;
}
let kopf = '# Mietspiegel-Arbeitsliste\n\n';
kopf += 'Erzeugt am ' + new Date().toISOString().slice(0, 10) + ' mit `node tools/mietspiegel-arbeitsliste.mjs` aus `marktbericht/backend/src/lib/mietspiegel/verzeichnis.json` '
  + '(alle Gemeinden ab 50.000 Einwohnern, Destatis 31.12.2024, dazu die Demo-Orte) und dem Ordner `werte/`.\n\n';
kopf += '**Gesamt:** ' + v.saetze.length + ' Gemeinden · ' + Object.entries(gesamt).map(([k, n]) => k + ' ' + n).join(' · ') + '\n\n';
kopf += 'Status: **fertig** = Wertedatei frei nutzbar · **gesperrt** = Wertedatei mit Rechtevorbehalt (`freigabe: gesperrt`, nur Staging) · '
  + '**verboten** = Speicherverbot im Dokument, nie eine Datei · **OFFEN** = zu ernten · **nicht_frei** = nur gegen Gebühr oder auf Anfrage · '
  + '**unklar** = Art erst klären · **kein** = Gemeinde hat keinen.\n\n';
const regeln = fs.existsSync(REGELN) ? fs.readFileSync(REGELN, 'utf8') + '\n' : '';
fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, kopf + regeln + teil);
console.log('geschrieben: ' + path.relative(WURZEL, ZIEL) + ' · ' + JSON.stringify(gesamt));
