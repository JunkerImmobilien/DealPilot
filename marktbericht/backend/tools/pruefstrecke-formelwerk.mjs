// pruefstrecke-formelwerk.mjs   (v1886-WFW)
//
// DER PRUEFSTAND FUER DIE MODELLFORM `formelwerk`.
//
// Acht Registersaetze tragen diese Form. Bis v1885 kannte der Auswerter sie
// nicht und meldete `form_unbekannt` — Magdeburg, Kiel und GANZ HAMBURG waren
// damit stumm. Dieser Lauf fasst JEDEN der acht Saetze an und prueft:
//
//   MAGDEBURG   das Normobjekt (2,49 %) und alle 13 abgedruckten
//               Kurvenpunkte zeichengleich, die Umrechnungskoeffizienten als
//               zweiten, unabhaengigen Weg, und beide Gueltigkeitsgrenzen.
//   KIEL        das Anwendungsbeispiel des Berichts (S. 52) samt seinen drei
//               Anpassungsfaktoren und den zwei additiven Korrekturwerten.
//   HAMBURG     dass KEIN Wert herauskommt, solange eine Eingabe fehlt — und
//               dass die Auskunft die fehlenden NENNT. Dazu die Teilfaktoren
//               (Lage, Alter, Erstbezug) einzeln gegen die Formel des Blattes.
//
// DER ECHTE WEG WIRD MITGEPRUEFT: nicht nur `auswerten()`, sondern
// `GAA.liegenschaftszinssatz()` und `zinssatzFuerObjekt()` — ein Pruefer, der
// nicht dieselben Wege laeuft wie die Maschine, misst sich selbst.
//
// Jede Pruefung nennt ihren SOLLWERT aus dem Dokument. Am Ende steht die
// DECKUNG: wie viele der acht Saetze angefasst wurden, nicht nur wie viele
// Pruefungen gruen sind.
//
// Aufruf:  node tools/pruefstrecke-formelwerk.mjs
// Rueckgabewert 1, wenn eine Pruefung faellt.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { auswerten } from '../src/lib/swf_modelle.js';
import { liegenschaftszinssatz, sachwertfaktor } from '../src/lib/gutachterausschuss.js';
import { ladeSaat, finde, lagenFuer, SAATDATEIEN }
  from '../src/lib/ausschuss_register.js';
import { zinssatzFuerObjekt } from '../src/lib/zweigwahl.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REG = path.join(HIER, '..', 'src', 'lib', 'register');

/* ── Register laden, wie der Dienst es tut ─────────────────────────────────
 *
 * KEIN Mock und keine eigene Dateiliste: `ladeSaat()` ist der Weg, den der
 * Dienst geht. Ein Pruefer, der seine Daten selbst zusammenstellt, prueft
 * seine eigene Zusammenstellung — und nicht das, was ausgeliefert wird.
 *
 * Fuer die DECKUNG wird der Ordner zusaetzlich gelesen: ein Satz, der im
 * Ordner liegt, aber in `SAATDATEIEN` fehlt, erreicht keinen Bericht. Diese
 * Luecke muss der Lauf nennen, nicht verschweigen. */
const stand = ladeSaat();

const formelwerke = [];
for (const f of readdirSync(REG).filter((x) => x.endsWith('.json'))) {
  let a;
  try { a = JSON.parse(readFileSync(path.join(REG, f), 'utf8')); } catch (e) { continue; }
  if (!Array.isArray(a)) continue;
  for (const s of a) {
    if (s.formel && s.formel.form === 'formelwerk') {
      formelwerke.push({ ...s, _datei: f, _gesaet: SAATDATEIEN.includes(f) });
    }
  }
}

let ok = 0, fehler = 0;
const angefasst = new Set();
const meldungen = [];

function pruefe(bez, istRoh, soll, stellen = 2) {
  const ist = (istRoh == null) ? null : Number(istRoh);
  const p = Math.pow(10, stellen);
  const trifft = ist != null && Math.round(ist * p) === Math.round(Number(soll) * p);
  if (trifft) { ok++; meldungen.push(`  ok      ${bez}: ${ist} (soll ${soll})`); }
  else { fehler++; meldungen.push(`  FEHLER  ${bez}: ${ist} statt ${soll}`); }
  return trifft;
}

function pruefeNahe(bez, ist, soll, toleranz) {
  const trifft = ist != null && Math.abs(Number(ist) - Number(soll)) <= toleranz;
  if (trifft) {
    ok++;
    meldungen.push(`  ok      ${bez}: ${Number(ist).toFixed(3)} `
      + `(soll ${soll} ± ${toleranz})`);
  } else {
    fehler++;
    meldungen.push(`  FEHLER  ${bez}: ${ist} statt ${soll} (± ${toleranz})`);
  }
  return trifft;
}

function pruefeGrund(bez, r, sollGrund) {
  if (r.verfuegbar) {
    fehler++;
    meldungen.push(`  FEHLER  ${bez}: liefert ${r.wert} — erwartet war KEIN Wert `
      + `(${sollGrund})`);
    return false;
  }
  if (r.grund !== sollGrund) {
    fehler++;
    meldungen.push(`  FEHLER  ${bez}: Grund '${r.grund}' statt '${sollGrund}'`);
    return false;
  }
  ok++;
  meldungen.push(`  ok      ${bez}: kein Wert, Grund '${r.grund}'`);
  return true;
}

function pruefeNennt(bez, text, woerter) {
  const t = String(text || '').toLowerCase();
  const fehlt = woerter.filter((w) => !t.includes(String(w).toLowerCase()));
  if (fehlt.length) {
    fehler++;
    meldungen.push(`  FEHLER  ${bez}: die Auskunft nennt nicht: ${fehlt.join(', ')}`);
    return false;
  }
  ok++;
  meldungen.push(`  ok      ${bez}: die Auskunft nennt ${woerter.join(', ')}`);
  return true;
}

function satz(ags, kennzahl, zweig) {
  const s = formelwerke.find((x) => x.ags === ags && x.kennzahl === kennzahl
                                 && x.zweig === zweig);
  if (!s) throw new Error(`Satz ${ags}/${kennzahl}/${zweig} nicht im Register`);
  angefasst.add(`${ags}|${kennzahl}|${zweig}`);
  return s;
}

/** Das Modellobjekt, GENAU wie gutachterausschuss.js es baut. */
function modell(s) {
  return { ...s.formel, kennzahl: s.kennzahl,
    modellansaetze: s.modellansaetze || null,
    korrekturen: s.korrekturen || [] };
}
const dok = (r) => (r.dokumentwert != null ? r.dokumentwert : r.wert);

/* ══ 1 · MAGDEBURG ═════════════════════════════════════════════════════ */

meldungen.push('── Magdeburg 15003000 mfh · quadrierte Linearkombination ──');
{
  const s = satz('15003000', 'liegenschaftszinssatz', 'mfh');
  const f = s.formel;
  const no = f.normobjekt;

  /* Das Normobjekt, mit der Jahresklasse im Wortlaut des Blattes. */
  const rn = auswerten(modell(s), { rnd: no.restnutzungsdauer_jahre,
    wohnflaeche: no.wohn_nutzflaeche_qm, jahr: no.jahr });
  pruefe('Normobjekt (RND 30, 700 m², 2023/24)', dok(rn),
    no.liegenschaftszinssatz_pct);

  /* Alle 13 Stuetzstellen der abgedruckten Normobjekt-Kurve, diesmal mit
     dem KALENDERJAHR als Eingabe — damit ist auch die Zuordnung
     Kalenderjahr -> Jahresklasse geprueft. */
  for (const [rnd, soll] of Object.entries(f.normobjekt_kurve_rnd)) {
    const r = auswerten(modell(s), { rnd: Number(rnd),
      wohnflaeche: no.wohn_nutzflaeche_qm, jahr: 2024 });
    pruefe(`Kurvenpunkt RND ${rnd}`, dok(r), soll);
  }

  /* Die Umrechnungskoeffizienten sind der ZWEITE Weg des Blattes: Kurve mal
     Koeffizient statt Formel. Zwei unabhaengige Wege auf dieselbe Zahl —
     erst das macht aus einer Rechnung einen Beweis. Toleranz 0,01, weil das
     Blatt die Koeffizienten zweistellig abdruckt. */
  const basis = dok(auswerten(modell(s), { rnd: 30, wohnflaeche: 700, jahr: 2023 }));
  const grenze = (f.gueltigkeit || {}).wohn_nutzflaeche_qm || [null, null];
  for (const [wnf, soll] of Object.entries(f.umrechnungskoeffizienten.wohn_nutzflaeche_qm)) {
    const x = Number(wnf);
    const r = auswerten(modell(s), { rnd: 30, wohnflaeche: x, jahr: 2023 });
    if (grenze[1] != null && x > grenze[1]) {
      /* Die UK-Tabelle reicht bis 2.100 m², die FORMEL nur bis 1.500 —
         ausserhalb muss gesperrt sein, nicht gerechnet. */
      pruefeGrund(`UK ${wnf} m² liegt ausserhalb der Formelgrenze`, r,
        'ausserhalb_der_stichprobe');
      continue;
    }
    pruefeNahe(`UK Wohn-/Nutzflaeche ${wnf} m²`, dok(r) / basis, soll, 0.01);
  }
  const rJ = auswerten(modell(s), { rnd: 30, wohnflaeche: 700, jahr: 2021 });
  pruefeNahe('UK Jahresklasse 2021/2022',
    dok(rJ) / basis, f.umrechnungskoeffizienten.jahr['Jahre 2021 / 2022'], 0.01);

  /* Die Gueltigkeitsgrenzen. "Ausserhalb RND 23-49 Jahre und WNF
     210-1.500 m² (Formelgrenzen) KEIN Wert." */
  pruefeGrund('RND 22 (unter der Grenze 23)',
    auswerten(modell(s), { rnd: 22, wohnflaeche: 700, jahr: 2024 }),
    'ausserhalb_der_stichprobe');
  pruefeGrund('RND 50 (ueber der Grenze 49)',
    auswerten(modell(s), { rnd: 50, wohnflaeche: 700, jahr: 2024 }),
    'ausserhalb_der_stichprobe');
  pruefeGrund('Wohnflaeche 200 m² (unter 210)',
    auswerten(modell(s), { rnd: 30, wohnflaeche: 200, jahr: 2024 }),
    'ausserhalb_der_stichprobe');
  pruefeGrund('Wohnflaeche 1.600 m² (ueber 1.500)',
    auswerten(modell(s), { rnd: 30, wohnflaeche: 1600, jahr: 2024 }),
    'ausserhalb_der_stichprobe');

  /* Keine Jahresklasse fuer 2026 — das Blatt endet bei 2023/2024. */
  const r26 = auswerten(modell(s), { rnd: 30, wohnflaeche: 700, jahr: 2026 });
  pruefeGrund('Jahr 2026 (keine Klasse im Blatt)', r26, 'ausserhalb_der_jahresklassen');
  pruefeNennt('Auskunft 2026 nennt die gefuehrten Klassen', r26.hinweis,
    ['Jahre 2021 / 2022', 'Jahre 2023 / 2024']);

  /* Ohne Jahresangabe: kein Wert, aber mit Namen. */
  const rOhne = auswerten(modell(s), { rnd: 30, wohnflaeche: 700 });
  pruefeGrund('ohne Restnutzungsdauer/Jahr', auswerten(modell(s), {}), 'feld_fehlt');
  pruefeNennt('Auskunft ohne Jahr nennt das Feld', rOhne.hinweis,
    ['jahr', 'stichtag']);

  /* DIE VERTAUSCHTE JAHRESBASIS. Mit der gedruckten Tabelle (2023/24 = 1)
     kaeme 1,46 statt 2,49 heraus — die Korrektur muss als ZAHL im Satz
     stehen, nicht im Fliesstext. */
  const mitBlatt = { ...modell(s) };
  delete mitBlatt.jahr_basis_anwendung;
  const rBlatt = auswerten(mitBlatt, { rnd: 30, wohnflaeche: 700, jahr: 2024 });
  pruefe('Gegenprobe: mit der GEDRUCKTEN Jahresbasis kommt 1,46 heraus',
    dok(rBlatt), 1.46);
  if (dok(rBlatt) === dok(rn)) {
    fehler++;
    meldungen.push('  FEHLER  die anzuwendende Jahresbasis wirkt nicht — '
      + '`jahr_basis_anwendung` wird nicht gelesen');
  } else {
    ok++;
    meldungen.push('  ok      `jahr_basis_anwendung` wirkt (2,49 gegen 1,46)');
  }

  /* Der aeussere Exponent ist Pflicht, wo der Ausdruck ihn abdruckt. */
  const ohneExp = { ...modell(s) };
  delete ohneExp.aussen_exponent;
  pruefeGrund('ohne `aussen_exponent` wird NICHT gerechnet',
    auswerten(ohneExp, { rnd: 30, wohnflaeche: 700, jahr: 2024 }),
    'exponent_nicht_beziffert');

  /* Monotonie der ganzen Kurve — die dumme Pruefung faengt, was die kluge
     uebersieht. */
  let monoton = true, vorher = null;
  for (let rnd = 23; rnd <= 49; rnd++) {
    const v = dok(auswerten(modell(s), { rnd, wohnflaeche: 700, jahr: 2024 }));
    if (vorher != null && !(v >= vorher)) monoton = false;
    vorher = v;
  }
  if (monoton) { ok++; meldungen.push('  ok      Monotonie RND 23–49 (27 Punkte, steigend)'); }
  else { fehler++; meldungen.push('  FEHLER  Kurve nicht monoton'); }

  /* Der ECHTE Weg: GAA.liegenschaftszinssatz(). */
  const echt = liegenschaftszinssatz({ ags: '15003000', zweig: 'mfh',
    rnd_jahre: 30, wohnflaeche_qm: 700, jahr: 2024 });
  pruefe('echter Weg GAA.liegenschaftszinssatz()', echt.wert_pct, 2.49);
}

/* ══ 2 · KIEL ══════════════════════════════════════════════════════════ */

meldungen.push('── Kiel 01002000 mfh · Produkt mit additiven Korrekturen ──');
{
  const s = satz('01002000', 'liegenschaftszinssatz', 'mfh');
  /* Anwendungsbeispiel S. 52: 1,6 × 1,49 × 1,19 × 1,13 − 1,2 + 0,3 = rd. 2,3 % */
  const e = { jahr: 2025, norm_brw_eur_qm: 450, nettokaltmiete_eur_m2_monat: 8.0,
    stadtteil: 'Blücherplatz', nutzungsart: 'Wohn- und Geschäftshaus' };
  const r = auswerten(modell(s), e);
  pruefe('Anwendungsbeispiel S. 52 (rd. 2,3 %)', dok(r), 2.3, 1);

  const t = (name) => (r.teilergebnisse || []).find((x) => x.faktor === name) || {};
  pruefe('AF_Zeit 2025', t('af_zeit').wert, 1.49);
  pruefe('AF_n.BRW 450 €/m²', t('af_nbrw').wert, 1.19);
  pruefe('AF_NKM 8,00 €/m²', t('af_nkm').wert, 1.13);
  const kn = (r.korrekturen_formelwerk || []).map((k) => k.merkmal + ' ' + k.wert);
  pruefeNennt('beide Korrekturwerte angewandt', kn.join(' | '),
    ['Stadtteil Blücherplatz -1.2', 'Wohn- und Geschäftshaus 0.3']);

  /* Das Standardobjekt 2025: 1,6 × 1,49 = 2,384. Der Satz haelt es
     ausdruecklich als RECHNERISCH fest, nicht als abgedruckte Zahl. */
  const rStd = auswerten(modell(s), { jahr: 2025, norm_brw_eur_qm: 555,
    nettokaltmiete_eur_m2_monat: 6.66 });
  pruefeNahe('Standardobjekt 2025 (1,6 × 1,49)', dok(rStd),
    s.formel.wert_standardobjekt_2025_pct, 0.03);

  /* Interpolation ist erlaubt — "zwischen Tabellenwerten sachgerecht". */
  const rI = auswerten(modell(s), { jahr: 2025, norm_brw_eur_qm: 475,
    nettokaltmiete_eur_m2_monat: 7.0 });
  pruefeNahe('Interpolation n.BRW 475 (zwischen 1,19 und 1,06)',
    (rI.teilergebnisse || []).find((x) => x.faktor === 'af_nbrw').wert, 1.125, 0.001);

  /* Die Grenzen der drei Stufentabellen. */
  for (const [bez, ein, faktor] of [
    ['Jahrgang 2012 (Tabelle beginnt 2013)',
      { jahr: 2012, norm_brw_eur_qm: 450, nettokaltmiete_eur_m2_monat: 8 }, 'af_zeit'],
    ['n.BRW 900 €/m² (Tabelle endet 850)',
      { jahr: 2025, norm_brw_eur_qm: 900, nettokaltmiete_eur_m2_monat: 8 }, 'af_nbrw'],
    ['Nettokaltmiete 3,00 € (Tabelle beginnt 4,00)',
      { jahr: 2025, norm_brw_eur_qm: 450, nettokaltmiete_eur_m2_monat: 3 }, 'af_nkm'],
  ]) {
    const rr = auswerten(modell(s), ein);
    const st = (rr.teilergebnisse || []).find((x) => x.faktor === faktor) || {};
    if (!rr.verfuegbar && st.status === 'ausserhalb_der_tabelle') {
      ok++; meldungen.push(`  ok      ${bez}: gesperrt (${faktor} ausserhalb der Tabelle)`);
    } else {
      fehler++;
      meldungen.push(`  FEHLER  ${bez}: ${rr.verfuegbar ? 'liefert ' + dok(rr)
        : faktor + ' ' + st.status}`);
    }
  }

  /* Ohne Nettokaltmiete: kein Wert, und die Auskunft nennt sie. */
  const rF = auswerten(modell(s), { jahr: 2025, norm_brw_eur_qm: 450 });
  pruefeGrund('ohne Nettokaltmiete', rF, 'modell_unvollstaendig');
  pruefeNennt('Auskunft nennt die fehlende Eingabe', rF.hinweis,
    ['af_nkm', 'nettokaltmiete']);

  /* Ohne Stadtteil: der Wert kommt, aber die offene Korrektur steht im
     Protokoll. Drei Stadtteile weichen um bis zu 1,3 Prozentpunkte ab —
     das darf nicht stillschweigend verschwinden. */
  const rOS = auswerten(modell(s), { jahr: 2025, norm_brw_eur_qm: 450,
    nettokaltmiete_eur_m2_monat: 8 });
  if (rOS.verfuegbar && (rOS.korrekturen_offen_formelwerk || []).length >= 4) {
    ok++;
    meldungen.push('  ok      ohne Stadtteil/Nutzungsart: '
      + `${dok(rOS)} % mit ${rOS.korrekturen_offen_formelwerk.length} offenen Korrekturen`);
  } else {
    fehler++;
    meldungen.push('  FEHLER  offene Korrekturen werden nicht ausgewiesen: '
      + JSON.stringify(rOS.korrekturen_offen_formelwerk));
  }

  const echt = liegenschaftszinssatz({ ags: '01002000', zweig: 'mfh', ...e });
  pruefe('echter Weg GAA.liegenschaftszinssatz()', echt.wert_pct, 2.3, 1);
}

/* ══ 3 · HAMBURG ═══════════════════════════════════════════════════════ */

meldungen.push('── Hamburg 02000000 · fuenf Zinssaetze und ein Sachwertfaktor ──');
{
  const mfh = satz('02000000', 'liegenschaftszinssatz', 'mfh');

  /* 3a · DER ECHTE WEG liefert KEINEN Wert — und nennt, was fehlt. Die
     FELDBRUECKE kennt weder den normierten Bodenrichtwert 2019 noch den
     Stadtteil als Pflichtangabe. */
  const leer = auswerten(modell(mfh), {});
  pruefeGrund('Hamburg mfh ohne Eingaben', leer, 'modell_unvollstaendig');
  pruefeNennt('nennt alle fuenf Faktoren', leer.hinweis,
    ['lagefaktor', 'altersfaktor', 'erstbezugsfaktor', 'stadtteilfaktor',
     'aktualisierungsfaktor']);
  pruefeNennt('nennt die beizubringenden Eingaben', leer.hinweis,
    ['norm_brw', 'baujahr', 'stichtag', 'stadtteil', 'erstbezug']);

  /* 3b · Die Teilfaktoren einzeln gegen die Formel des Blattes. Sie duerfen
     in der Auskunft erscheinen, ohne dass daraus ein Zinssatz wird. */
  const tf = (ein, name) => {
    const r = auswerten(modell(mfh), ein);
    const l = (r.teilergebnisse || []).find((x) => x.faktor === name) || {};
    return { r, wert: l.wert, status: l.status };
  };
  pruefe('Lagefaktor bei NormBRW19 = 1.100 (Median, mittlere Lage)',
    tf({ norm_brw_eur_qm: 1100 }, 'lagefaktor').wert, 1, 4);
  pruefe('Lagefaktor bei NormBRW19 = 2.200 ((2)^-0,282)',
    tf({ norm_brw_eur_qm: 2200 }, 'lagefaktor').wert, Math.pow(2, -0.282), 6);
  pruefe('Altersfaktor bei Alter 10 (1,36 − 0,012·10)',
    tf({ alter_jahre: 10 }, 'altersfaktor').wert, 1.24, 4);
  pruefe('Altersfaktor bei Alter 30 (Normalfall laut Blatt: 1)',
    tf({ alter_jahre: 30 }, 'altersfaktor').wert, 1, 4);
  pruefe('Altersfaktor aus Baujahr und Stichtag (2026 − 1998 = 28)',
    tf({ baujahr: 1998, stichtag: '2026-01-01' }, 'altersfaktor').wert,
    1.36 - 0.012 * 28, 6);
  pruefe('Erstbezugsfaktor bei Erstbezug', tf({ erstbezug: true }, 'erstbezugsfaktor').wert,
    0.83, 4);
  pruefe('Erstbezugsfaktor ohne Erstbezug (faellt aus dem Produkt)',
    tf({ erstbezug: false }, 'erstbezugsfaktor').wert, 1, 4);
  pruefe('Aktualisierungsfaktor zum 01.01.2026',
    tf({ stichtag: '2026-01-01' }, 'aktualisierungsfaktor').wert, 0.732, 4);
  pruefe('Stadtteilfaktor Veddel', tf({ stadtteil: 'Veddel' }, 'stadtteilfaktor').wert,
    0.96, 4);

  /* Neuwerk traegt in keiner Stadtteiltabelle einen Faktor. */
  const nw = tf({ stadtteil: 'Neuwerk' }, 'stadtteilfaktor');
  if (nw.status === 'ohne_wert') {
    ok++; meldungen.push('  ok      Neuwerk: Stadtteil ohne Faktor (ohne_wert)');
  } else { fehler++; meldungen.push(`  FEHLER  Neuwerk: ${nw.status}`); }

  /* Ein Stichtag, den die Tabelle nicht fuehrt. */
  const alt = tf({ stichtag: '2019-01-01' }, 'aktualisierungsfaktor');
  if (alt.status === 'stichtag_ohne_faktor') {
    ok++; meldungen.push('  ok      Stichtag 2019: kein Aktualisierungsfaktor');
  } else { fehler++; meldungen.push(`  FEHLER  Stichtag 2019: ${alt.status}`); }

  /* 3c · MIT allen Eingaben rechnet es — das ist der Gegenbeweis dafuer,
     dass nicht die TABELLEN fehlen, sondern die ANGABEN. 4,37 × 1 × 1 × 1
     × 1 × 0,732 = 3,20 % zum Stichtag 01.01.2026 in mittlerer Lage. */
  const voll = auswerten(modell(mfh), { norm_brw_eur_qm: 1100, baujahr: 1960,
    stichtag: '2026-01-01', erstbezug: false, stadtteil: 'Winterhude' });
  pruefe('Hamburg mfh MIT allen Eingaben (4,37 × 0,732)', dok(voll),
    Math.round(4.37 * 0.732 * 100) / 100);

  /* 3d · etw und efh haengen am mfh-Zweig. Ohne ihn: kein Wert, mit Nennung
     des Zweiges. */
  for (const [zweig, a, b] of [['etw', 1.16, -2.3], ['efh', 0.85, -0.53]]) {
    const s2 = satz('02000000', 'liegenschaftszinssatz', zweig);
    const r0 = auswerten(modell(s2), {});
    pruefeGrund(`Hamburg ${zweig} ohne Bezugswert`, r0, 'bezugswert_fehlt');
    pruefeNennt(`Hamburg ${zweig} nennt den Zweig, an dem es haengt`, r0.hinweis,
      ['mfh']);
    const r1 = auswerten(modell(s2), { bezugswert_pct: 3.2 });
    pruefe(`Hamburg ${zweig} mit LIZI(MFH) = 3,2 %`, dok(r1),
      Math.round((a * 3.2 + b) * 100) / 100);
  }

  /* 3e · Buero und Produktion/Logistik: was genau fehlt. */
  const bu = satz('02000000', 'liegenschaftszinssatz', 'buero');
  const rbu = auswerten(modell(bu), {});
  pruefeGrund('Hamburg buero ohne Eingaben', rbu, 'modell_unvollstaendig');
  pruefe('Hamburg buero: Baujahrsfaktor 1965 (Klasse 1960 bis 1979)',
    ((auswerten(modell(bu), { baujahr: 1965 }).teilergebnisse || [])
      .find((x) => x.faktor === 'baujahrsfaktor') || {}).wert, 0.89, 4);
  /* Der Gebaeudeartfaktor ist der Fall, in dem der Normalfall AUSDRUECKLICH
     nicht beziffert ist ("Ein Wert fuer den Normalfall (sonst) ist im
     Bericht nicht beziffert"). Also gilt er auch nicht als 1. */
  const gf = (auswerten(modell(bu), { norm_brw_eur_qm: 900, baujahr: 1965,
    gebaeudeart_laden: false }).teilergebnisse || [])
    .find((x) => x.faktor === 'gebaeudeartfaktor') || {};
  if (gf.status === 'normalfall_nicht_beziffert') {
    ok++;
    meldungen.push('  ok      Hamburg buero: Normalfall des Gebaeudeartfaktors '
      + 'gilt als unbelegt (so steht es im Satz)');
  } else {
    fehler++;
    meldungen.push(`  FEHLER  Hamburg buero: Gebaeudeartfaktor ${gf.status} `
      + '— ein nicht bezifferter Normalfall darf nicht als 1 durchgehen');
  }

  const pl = satz('02000000', 'liegenschaftszinssatz', 'produktion_logistik');
  const rpl = auswerten(modell(pl), { brw_eur_qm: 440, erstbezug: false });
  pruefeGrund('Hamburg produktion_logistik', rpl, 'modell_unvollstaendig');
  pruefeNennt('nennt den Miethoehenfaktor als Quotienten zweier Groessen',
    rpl.hinweis, ['miethoehenfaktor', 'quotient']);
  pruefe('Hamburg produktion_logistik: Lagefaktor bei BRW22 = 440 (Normstelle)',
    ((rpl.teilergebnisse || []).find((x) => x.faktor === 'lagefaktor') || {}).wert,
    1, 4);

  /* 3f · Der Sachwertfaktor. 19 Faktoren, und es fehlt viel — aber die
     Auskunft sagt WAS. */
  const swf = satz('02000000', 'sachwertfaktor', 'efh');
  const rswf = auswerten(modell(swf), {});
  pruefeGrund('Hamburg Sachwertfaktor efh', rswf, 'modell_unvollstaendig');
  if ((rswf.faktoren_gefuehrt || 0) === 19) {
    ok++; meldungen.push('  ok      Hamburg Sachwertfaktor: 19 Faktoren gelesen');
  } else {
    fehler++;
    meldungen.push(`  FEHLER  Hamburg Sachwertfaktor: ${rswf.faktoren_gefuehrt} `
      + 'Faktoren statt 19');
  }
  /* Die Falle mit a und b: beim Restnutzungsdauerfaktor ist `a` die
     Steigung, beim Bodenwertanteilsfaktor der Achsabschnitt. Der
     Restnutzungsdauerfaktor ist ausserdem dreigeteilt — er darf NICHT als
     einfache Gerade durchgehen. */
  const rnd50 = auswerten(modell(swf), { rnd_jahre: 50, bodenwertanteil: 0.6 });
  const trnd = (rnd50.teilergebnisse || [])
    .find((x) => x.faktor === 'restnutzungsdauerfaktor') || {};
  if (trnd.status === 'verzweigung_nicht_maschinenlesbar') {
    ok++;
    meldungen.push('  ok      Restnutzungsdauerfaktor: Verzweigung erkannt, '
      + 'nicht als Gerade gerechnet');
  } else {
    fehler++;
    meldungen.push(`  FEHLER  Restnutzungsdauerfaktor: ${trnd.status} `
      + `${trnd.wert} — drei Abschnitte des Blattes uebergangen`);
  }
  pruefe('Bodenwertanteilsfaktor bei 60 % (Normstelle laut Blatt: 1)',
    ((rnd50.teilergebnisse || [])
      .find((x) => x.faktor === 'bodenwertanteilsfaktor') || {}).wert, 1, 3);
  /* Und die Gegenprobe zur Einheit: 60 statt 0,60 wird NICHT gerechnet. */
  const bwPct = (auswerten(modell(swf), { bodenwertanteil: 60 }).teilergebnisse || [])
    .find((x) => x.faktor === 'bodenwertanteilsfaktor') || {};
  if (bwPct.status === 'eingang_einheit_unklar') {
    ok++;
    meldungen.push('  ok      Bodenwertanteil 60 statt 0,60: Einheit wird '
      + 'nachgefragt, nicht gerechnet');
  } else {
    fehler++;
    meldungen.push(`  FEHLER  Bodenwertanteil 60 ergibt ${bwPct.wert} `
      + `(${bwPct.status}) — ein Faktor 100 bleibt unentdeckt`);
  }

  /* ── DER ECHTE SACHWERTFAKTOR-WEG HAMBURGS GEHT WOANDERS HIN ──────────
     Zwei Saetze beschreiben dasselbe Modell:

       hamburg.json  sachwertfaktor/efh  ebene "land"     form formelwerk
       swf-hh.json   sachwertfaktor/ezfh ebene "gemeinde" form konstante
                     0,788 + 19 multiplikative Korrekturen

     Der erste ist fuer den Sachwertfaktor ebenenseitig gesperrt (bei einem
     STADTSTAAT ist `land` aber die Gemeinde), der zweite gewinnt. Geprueft
     wird deshalb, was wirklich herauskommt — und das ist ein Befund, kein
     Sollwert: der Satz liefert 0,788, OBWOHL alle 19 Faktoren offen sind. */
  const swfEcht = sachwertfaktor({ ags: '02000000', objektart: 'efh',
    sachwert_eur: 500000 });
  meldungen.push('  BEFUND  echter Sachwertfaktor-Weg Hamburg: '
    + (swfEcht && swfEcht.verfuegbar
       ? `Wert ${swfEcht.wert} aus Zweig "${swfEcht.zweig}" (Form `
         + `${swfEcht.modellform}) — mit `
         + `${(swfEcht.korrekturen_offen || []).length} von `
         + `${swfEcht.korrekturen_gefuehrt} Korrekturen OFFEN`
       : (swfEcht && swfEcht.grund) || 'kein Ergebnis'));
  if (swfEcht && swfEcht.verfuegbar
      && (swfEcht.korrekturen_offen || []).length === swfEcht.korrekturen_gefuehrt) {
    meldungen.push('  BEFUND  das ist der Grundwert des Produktmodells ohne '
      + 'einen einzigen Faktor — Entscheidung noetig (siehe Bericht)');
  }
}

/* ══ 4 · DER ECHTE WEG ueber zinssatzFuerObjekt() ══════════════════════ */

meldungen.push('── der echte Weg: zinssatzFuerObjekt() ──');
{
  const deps = { finde, lagenFuer, abruf: liegenschaftszinssatz };
  const md = zinssatzFuerObjekt(deps, '15003000',
    { objart: 'Mehrfamilienhaus', restnutzungsdauer: 30, rnd_jahre: 30,
      wohnflaeche_qm: 700, jahr: 2024 });
  pruefe('zinssatzFuerObjekt Magdeburg mfh', md.wert_pct, 2.49);

  const ki = zinssatzFuerObjekt(deps, '01002000',
    { objart: 'Mehrfamilienhaus', jahr: 2025, norm_brw_eur_qm: 450,
      nettokaltmiete_eur_m2_monat: 8.0, stadtteil: 'Blücherplatz',
      nutzungsart: 'Wohn- und Geschäftshaus' });
  pruefe('zinssatzFuerObjekt Kiel mfh', ki.wert_pct, 2.3, 1);

  const hh = zinssatzFuerObjekt(deps, '02000000',
    { objart: 'Mehrfamilienhaus', baujahr: 1960 });
  if (hh.verfuegbar) {
    fehler++;
    meldungen.push(`  FEHLER  Hamburg liefert ueber den echten Weg ${hh.wert_pct} % — `
      + 'erwartet war kein Wert');
  } else {
    ok++;
    meldungen.push(`  ok      Hamburg ueber den echten Weg: kein Wert `
      + `(${hh.rueckfrage})`);
  }
  pruefeNennt('die Rueckfrage nennt die fehlenden Eingaben',
    (hh.fehlende_eingaben || []).join(', ') + ' ' + (hh.hinweis || ''),
    ['norm_brw', 'stadtteil', 'stichtag']);

  const hhVoll = zinssatzFuerObjekt(deps, '02000000',
    { objart: 'Mehrfamilienhaus', norm_brw_eur_qm: 1100, baujahr: 1960,
      stichtag: '2026-01-01', erstbezug: false, stadtteil: 'Winterhude' });
  pruefe('zinssatzFuerObjekt Hamburg mfh MIT allen Eingaben', hhVoll.wert_pct,
    Math.round(4.37 * 0.732 * 100) / 100);

  /* Und damit rechnet auch der Zweig, der am mfh haengt: etw = 1,16 × LIZI
     − 2,30. Den Bezugswert holt gutachterausschuss.js aus dem Register. */
  const hhEtw = zinssatzFuerObjekt(deps, '02000000',
    { objart: 'Eigentumswohnung', norm_brw_eur_qm: 1100, baujahr: 1960,
      stichtag: '2026-01-01', erstbezug: false, stadtteil: 'Winterhude' });
  pruefe('zinssatzFuerObjekt Hamburg etw (Bezug auf mfh aufgeloest)',
    hhEtw.wert_pct, Math.round((1.16 * 3.2 - 2.3) * 100) / 100);
}

/* ── Deckung ───────────────────────────────────────────────────────────── */

const gefunden = formelwerke.length;
const nichtAngefasst = formelwerke
  .filter((s) => !angefasst.has(`${s.ags}|${s.kennzahl}|${s.zweig}`))
  .map((s) => `${s.ags}/${s.kennzahl}/${s.zweig} (${s._datei})`);
const nichtGesaet = formelwerke.filter((s) => !s._gesaet)
  .map((s) => `${s.ags}/${s.kennzahl}/${s.zweig} (${s._datei})`);

console.log(meldungen.join('\n'));
console.log('');
console.log(`Register geladen: ${stand.saetze} Saetze aus ${stand.gelesen.length} `
  + `Saatdateien (Herkunft wie im Dienst)`);
if (nichtGesaet.length) {
  console.log('NICHT in SAATDATEIEN und damit fuer den Bericht unerreichbar: '
    + nichtGesaet.join(' · '));
}
console.log(`Saetze mit form=formelwerk im Registerordner: ${gefunden}`);
console.log(`davon angefasst: ${angefasst.size} — DECKUNG `
  + `${gefunden ? Math.round(angefasst.size / gefunden * 100) : 0} %`);
if (nichtAngefasst.length) {
  console.log('NICHT angefasst: ' + nichtAngefasst.join(' · '));
}
console.log(`Pruefungen ok: ${ok} · FEHLER: ${fehler}`);
if (angefasst.size < gefunden) {
  console.log('ACHTUNG: ein Satz, den niemand anfasst, ist nicht geprueft — '
    + '"0 Fehler" heisst dann nichts.');
}
process.exit((fehler || angefasst.size < gefunden) ? 1 : 0);
