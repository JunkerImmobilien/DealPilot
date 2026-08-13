// swf-abfrage.mjs   (v1084-WABF)
//
// DAS REGISTER VON DER KONSOLE AUS FRAGEN.
//
// Ein Klicktest zeigt, was der Bildschirm sagt. Diese Abfrage zeigt, was der
// Auflöser sagt — und zwar über GENAU denselben Weg, den der Bericht geht:
// gutachterausschuss.sachwertfaktor(). Kein nachgebauter Rechenweg, keine
// zweite Wahrheit.
//
// AUFRUF
//   node swf-abfrage.mjs --stand
//       Was liegt überhaupt drin? Ausschüsse, Zweige, Kennzahlen, Jahrgänge.
//
//   node swf-abfrage.mjs --liste
//       Alle Ausschüsse mit Zuständigkeitsschlüssel und Modellform.
//
//   node swf-abfrage.mjs 05762020 --sachwert 300000 --brw 80 --rnd 55 \
//                        --bgf 300 --art Einfamilienhaus
//       Eine echte Anfrage. Gibt den Rechenweg aus oder den Grund, warum
//       nichts geliefert wird.
//
//   node swf-abfrage.mjs --zins 05758016 --art Zweifamilienhaus
//       Dasselbe für den Liegenschaftszinssatz samt Modellvermerk.
//
// Das Verzeichnis der Module lässt sich mit DP_LIB überschreiben; ohne das
// wird /opt/dealpilot/marktbericht/backend/src/lib genommen.

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const LIB = process.env.DP_LIB || '/opt/dealpilot/marktbericht/backend/src/lib';

const ga = await import(pathToFileURL(join(LIB, 'gutachterausschuss.js')).href);
const reg = await import(pathToFileURL(join(LIB, 'ausschuss_register.js')).href);

/* ── Argumente ─────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const opt = {};
const frei = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
    opt[k] = v;
  } else frei.push(a);
}

const z = (v) => (v == null ? '–' : String(v));
const eur = (v) => (v == null ? '–' : Number(v).toLocaleString('de-DE') + ' €');

/* ── --stand ───────────────────────────────────────────────────────────── */

function stand() {
  /* Das Register laedt sich beim ersten Zugriff selbst (v1083a-WLAZ). Wer
   * nur registerStand() liest, bekommt "leer" — und das saehe aus wie ein
   * Installationsfehler, obwohl bloss noch niemand gefragt hat. Deshalb
   * genau EIN Zugriff ueber den oeffentlichen Weg, denselben, den der
   * Server geht. */
  ga.sachwertfaktor({ ags: '05762020' });
  const s = reg.registerStand();
  console.log('REGISTER  (nach einem Zugriff — so laedt es auch der Server)');
  console.log(`  Herkunft            ${s.herkunft}`);
  console.log(`  Datensätze          ${z(s.saetze)}`);
  console.log(`  Schlüssel           ${z(s.schluessel)} · Gebiete ${z(s.gebiete)}`);
  for (const g of (s.gelesen || [])) {
    console.log(`  gelesen             ${g.datei.split('/').pop()} · ${g.saetze}`);
  }
  for (const v of (s.vermisst || [])) {
    console.log(`  NICHT LESBAR        ${v.datei.split('/').pop()} · ${v.fehler}`);
  }
  if (!s.saetze) {
    console.log('');
    console.log('  Das Register ist LEER. Ohne Saatdatei meldet der Bericht für');
    console.log('  jede Adresse "kein Ausschuss hinterlegt" — und das sähe aus');
    console.log('  wie eine Datenlücke, nicht wie ein Installationsfehler.');
  }
}

/* ── --liste ───────────────────────────────────────────────────────────── */
// Liest die Saatdatei direkt, weil das Register nach Schlüssel indiziert ist
// und keine Liste über alle Ausschüsse anbietet.

async function liste() {
  const { readFileSync } = await import('node:fs');
  const datei = join(LIB, 'register', 'swf-nrw.json');
  let saetze;
  try {
    saetze = JSON.parse(readFileSync(datei, 'utf8'));
  } catch (e) {
    console.log(`Saatdatei nicht lesbar: ${datei}`);
    console.log(e.message);
    process.exit(1);
  }
  const nach = new Map();
  for (const s of saetze) {
    const k = s.gaa_name;
    if (!nach.has(k)) nach.set(k, { ags: new Set(), ebene: s.ebene, zweige: new Map(),
                                    jahr: s.berichtsjahr, lizenz: s.lizenz });
    const e = nach.get(k);
    e.ags.add(s.ags);
    e.zweige.set(s.zweig, (s.formel || {}).form);
  }
  console.log(`SACHWERTFAKTOREN — ${nach.size} Ausschüsse, ${saetze.length} Datensätze\n`);
  for (const [name, e] of [...nach].sort((a, b) => a[0].localeCompare(b[0]))) {
    const kurz = name.replace(/^Der Gutachterausschuss für Grundstückswerte /, '');
    console.log(`${kurz}`);
    console.log(`  ${e.ebene.padEnd(9)} ${[...e.ags].sort().join(' ')}   GMB ${z(e.jahr)}   ${z(e.lizenz)}`);
    for (const [zw, form] of e.zweige) console.log(`    ${String(zw).padEnd(12)} ${form}`);
  }
}

/* ── Eine echte Anfrage ────────────────────────────────────────────────── */

function anfrage(ags) {
  const o = {
    ags,
    sachwert_eur: opt.sachwert != null && opt.sachwert !== true ? Number(opt.sachwert) : undefined,
    brw_eur_qm: opt.brw != null && opt.brw !== true ? Number(opt.brw) : undefined,
    rnd_jahre: opt.rnd != null && opt.rnd !== true ? Number(opt.rnd) : undefined,
    bgf_qm: opt.bgf != null && opt.bgf !== true ? Number(opt.bgf) : undefined,
    objektart: opt.art !== true ? opt.art : undefined,
  };
  /* Kategoriale Achsen kommen nur, wenn sie ausdrücklich mitgegeben werden —
   * das Formular erhebt sie nicht, und der Auswerter soll das auch sagen. */
  for (const k of ['wohnlage', 'gebiet', 'anbauweise_rheinseite',
                   'gebaeudegruppe', 'baulandflaeche', 'baujahr', 'flaeche']) {
    if (opt[k] != null && opt[k] !== true) o[k] = opt[k];
  }

  console.log(`ANFRAGE  ags=${ags}  ${z(o.objektart)}`);
  console.log(`         vorl. Sachwert ${eur(o.sachwert_eur)} · BRW ${z(o.brw_eur_qm)} €/m²`
    + ` · RND ${z(o.rnd_jahre)} J · BGF ${z(o.bgf_qm)} m²`);
  console.log('');

  const r = ga.sachwertfaktor(o);
  if (!r) { console.log('SACHWERTFAKTOR   (kein Ergebnisobjekt)'); return; }

  if (!r.verfuegbar) {
    console.log('SACHWERTFAKTOR   KEIN WERT');
    console.log(`  Grund          ${z(r.grund)}`);
    if (r.ausschuss) console.log(`  Ausschuss      ${r.ausschuss}`);
    if (r.gefuehrte_zweige) console.log(`  geführt werden ${r.gefuehrte_zweige.join(', ')}`);
    if (r.hinweis) console.log(`  Hinweis        ${r.hinweis}`);
    return;
  }

  console.log(`SACHWERTFAKTOR   ${r.wert}`);
  console.log(`  Herkunft       ${z(r.herkunft)}`);
  console.log(`  Ausschuss      ${z(r.ausschuss)}`);
  if (r.zweig) console.log(`  Zweig          ${r.zweig}`);
  if (r.modellform) console.log(`  Modellform     ${r.modellform}`);
  if (r.rechenweg) console.log(`  Rechenweg      ${r.rechenweg}`);
  if (r.dokumentwert != null && r.einheit && r.einheit !== 'faktor') {
    console.log(`  Dokumentwert   ${r.dokumentwert} (${r.einheit})`);
  }
  console.log(`  Stufe          ${z(r.stufe)}   Fallzahl ${z(r.fallzahl)}   `
    + `Streuung ${z(r.streuung)}`);
  console.log(`  Stichtag       ${z(r.stichtag)}   Berichtsjahr ${z(r.berichtsjahr)}`);
  if (r.fundstelle) console.log(`  Fundstelle     ${r.fundstelle}`);
  if (r.lizenz) console.log(`  Lizenz         ${r.lizenz}`);
  if (r.quellenvermerk) console.log(`  Quellenvermerk ${r.quellenvermerk}`);
  if (r.quelle_url) console.log(`  Quelle         ${r.quelle_url}`);
  if (r.beleg && r.beleg.wortlaut) {
    console.log(`  Beleg          ${String(r.beleg.wortlaut).slice(0, 160)}`);
  }
}

/* ── Liegenschaftszinssatz ─────────────────────────────────────────────── */

function zins(ags) {
  const r = ga.liegenschaftszinssatz({ ags, zweig: opt.art !== true ? opt.art : undefined });
  console.log(`LIEGENSCHAFTSZINSSATZ  ags=${ags}  zweig=${z(opt.art)}`);
  if (!r.verfuegbar) {
    console.log(`  KEIN WERT      ${z(r.grund)}`);
    if (r.hinweis) console.log(`  ${r.hinweis}`);
    return;
  }
  console.log(`  Zinssatz       ${r.wert_pct} %`);
  console.log(`  Stufe          ${z(r.stufe)}   ${z(r.stufe_grund)}`);
  console.log(`  Ausschuss      ${z(r.ausschuss)}`);
  console.log(`  Fallzahl       ${z(r.fallzahl)}   Streuung ${z(r.streuung)}`);
  console.log(`  Stichtag       ${z(r.stichtag)}   Berichtsjahr ${z(r.berichtsjahr)}`);
  const m = r.modell || {};
  console.log('  MODELLVERMERK — ohne ihn darf der Zinssatz nicht verwendet werden:');
  console.log(`    GND ${z(m.gesamtnutzungsdauer)} J · RND-Mittel ${z(m.restnutzungsdauer_mittel)} J`);
  console.log(`    BWK-Quote ${z(m.bewirtschaftungskosten_quote)} · `
    + `Marktmiete ${z(m.marktmiete_eur_qm)} €/m²`);
  if (r.lizenz) console.log(`  Lizenz         ${r.lizenz}`);
}

/* ── Los ───────────────────────────────────────────────────────────────── */

if (opt.stand) { stand(); }
else if (opt.liste) { await liste(); }
else if (opt.zins) {
  zins(opt.zins === true ? frei[0] : opt.zins);
} else if (frei.length) {
  anfrage(frei[0]);
} else {
  console.log('node swf-abfrage.mjs --stand');
  console.log('node swf-abfrage.mjs --liste');
  console.log('node swf-abfrage.mjs <AGS> --sachwert N --brw N --rnd N --bgf N --art TEXT');
  console.log('node swf-abfrage.mjs --zins <AGS> --art efh');
  process.exit(2);
}
