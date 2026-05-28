// backend/src/services/bmfService.js
// V282 — BMF Kaufpreisaufteilung (Phase 1 / Labor)
// Sandwich-Ansatz: Schreibt User-Inputs in die offizielle BMF-Vorlage (Juni 2023),
// lässt LibreOffice headless die Formeln recalcen, liest Ergebnisse aus.
//
// KEINE parallele Logik zu bestehenden Berechnungen — das ist ein eigenständiges
// Labor-Modul, das später (Phase 2+) in die echte Steuer-Engine eingebaut wird.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const os = require('os');

let ExcelJS;
try { ExcelJS = require('exceljs'); } catch (e) { ExcelJS = null; }

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'BMF_Vorlage_Juni2023.xlsx');
const LIBREOFFICE_BIN = process.env.LIBREOFFICE_BIN || 'libreoffice';
const RECALC_TIMEOUT_MS = parseInt(process.env.BMF_RECALC_TIMEOUT_MS || '60000', 10);

// ----------------------------------------------------------------------
// Input/Output-Mapping in der BMF-Vorlage (KPA-Sheet)
// ----------------------------------------------------------------------
// Diese Map wurde anhand der Original-XLSX (Fassung Juni 2023) extrahiert.
// Bei einem späteren BMF-Update muss nur diese Map angepasst werden.

const INPUT_CELLS = {
  // 1) Lage
  lage:                { sheet: 'KPA', cell: 'E5'  },
  // 2) Grundstücksart - Dropdown-Werte siehe GRUNDSTUECKSART_OPTIONS
  grundstuecksart:     { sheet: 'KPA', cell: 'E7'  },
  // 3) Datum Kaufvertrag (ISO yyyy-mm-dd, wird zu Excel-Datum konvertiert)
  kaufdatum:           { sheet: 'KPA', cell: 'G9'  },
  // 4) Kaufpreis inkl. Nebenkosten in €
  kaufpreis:           { sheet: 'KPA', cell: 'K9'  },
  // 5) Ursprüngliches Baujahr
  baujahr:             { sheet: 'KPA', cell: 'G11' },
  // 6) Wohn-/Nutzfläche in m²
  wohnflaeche:         { sheet: 'KPA', cell: 'K11' },
  // 7) Anzahl Garagenstellplätze
  garagen:             { sheet: 'KPA', cell: 'G13' },
  // 8) Anzahl Tiefgaragenstellplätze
  tiefgaragen:         { sheet: 'KPA', cell: 'K13' },
  // 9/10) MEA Zähler/Nenner
  mea_zaehler:         { sheet: 'KPA', cell: 'G15' },
  mea_nenner:          { sheet: 'KPA', cell: 'K15' },
  // 11/12) Grundstücksgröße + Bodenrichtwert (Fläche 1)
  grundstuecksgroesse: { sheet: 'KPA', cell: 'G17' },
  bodenrichtwert:      { sheet: 'KPA', cell: 'K17' },
  // 13/14) Optional: Fläche 2 + Wert 2
  grundstuecksgroesse2:{ sheet: 'KPA', cell: 'G20' },
  bodenrichtwert2:     { sheet: 'KPA', cell: 'K20' },
  // 15) Vergleichsfaktor vorhanden? "Ja" / "Nein"
  vergleichsfaktor_vorhanden: { sheet: 'KPA', cell: 'G26' },
  // 16) Bezugsmaßstab: "Wohn- bzw. Nutzfläche" / "Bruttogrundfläche"
  bezugsmassstab:      { sheet: 'KPA', cell: 'K26' },
  // 17) Vergleichsfaktor
  vergleichsfaktor:    { sheet: 'KPA', cell: 'G28' },
  // 19/20) Vergleichsfaktor je Garage/Tiefgarage
  vergleichsfaktor_garage:    { sheet: 'KPA', cell: 'G31' },
  vergleichsfaktor_tiefgarage:{ sheet: 'KPA', cell: 'G33' },
  // 21) Miete bekannt? "Ja" / "Nein"
  miete_bekannt:       { sheet: 'KPA', cell: 'G38' },
  // 22) monatl. Nettokaltmiete (incl. Stellplätze)
  miete_monatlich:     { sheet: 'KPA', cell: 'G40' },
  // 23) Anzahl Wohneinheiten (für MFH; bei WE/EFH auto)
  wohneinheiten:       { sheet: 'KPA', cell: 'G42' },
  // 24) Liegenschaftszinssatz (sofern bekannt, sonst leer)
  liegenschaftszinssatz: { sheet: 'KPA', cell: 'K37' },
  // 25/26) Regionalfaktor + Sachwertfaktor (Default 1.0)
  regionalfaktor:      { sheet: 'KPA', cell: 'G47' },
  sachwertfaktor:      { sheet: 'KPA', cell: 'K47' },
  // --- Modernisierungs-Eingaben (Sheet 'Fiktives Baujahr', D17–D24) ---
  // Werte: "ja" / "nein" / "teilweise"
  // Pflicht bei alten Gebäuden (sonst #N/A in Sachwert-/Ertragswertkette).
  mod_dach:        { sheet: 'Fiktives Baujahr', cell: 'D17' },
  mod_fenster:     { sheet: 'Fiktives Baujahr', cell: 'D18' },
  mod_leitungen:   { sheet: 'Fiktives Baujahr', cell: 'D19' },
  mod_heizung:     { sheet: 'Fiktives Baujahr', cell: 'D20' },
  mod_waermedaemmung: { sheet: 'Fiktives Baujahr', cell: 'D21' },
  mod_baeder:      { sheet: 'Fiktives Baujahr', cell: 'D22' },
  mod_innenausbau: { sheet: 'Fiktives Baujahr', cell: 'D23' },
  mod_grundriss:   { sheet: 'Fiktives Baujahr', cell: 'D24' },
};

const OUTPUT_CELLS = {
  bodenwert:                { sheet: 'KPA', cell: 'K59',  label: 'Bodenwert (€)' },
  sachwert_vorlaeufig:      { sheet: 'KPA', cell: 'K72',  label: 'Vorläufiger Sachwert (€)' },
  sachwert_marktangepasst:  { sheet: 'KPA', cell: 'K75',  label: 'Marktangepasster Sachwert (€)' },
  ertragswert:              { sheet: 'KPA', cell: 'K101', label: 'Vorläufiger Ertragswert (€)' },
  vergleichswert:           { sheet: 'KPA', cell: 'K112', label: 'Vorläufiger Vergleichswert (€)' },
  massgebender_verkehrswert: { sheet: 'KPA', cell: 'K114', label: 'Maßgebender Verkehrswert (€)' },
  gebaeudeanteil_prozent:   { sheet: 'KPA', cell: 'K116', label: 'Gebäudeanteil (%)' },
  grund_boden_wert:         { sheet: 'KPA', cell: 'F120', label: 'Grund und Boden — Einzelwert (€)' },
  gebaeude_wert:            { sheet: 'KPA', cell: 'F121', label: 'Gebäudewert — Einzelwert (€)' },
  kaufpreisanteil_grund:    { sheet: 'KPA', cell: 'J120', label: 'Kaufpreisanteil Grund & Boden (€)' },
  kaufpreisanteil_gebaeude: { sheet: 'KPA', cell: 'J121', label: 'Kaufpreisanteil Gebäude (€)' },
  // Aus Sheet "Fiktives Baujahr"
  fiktives_baujahr:         { sheet: 'Fiktives Baujahr', cell: 'D49', label: 'Fiktives Baujahr' },
  modernisierungsgrad:      { sheet: 'Fiktives Baujahr', cell: 'D47', label: 'Modernisierungsgrad' },
};

// Die Strings MÜSSEN exakt mit dem Lookup-Sheet "EW-Bewertungsparameter" Spalte A
// übereinstimmen, sonst gibt's VLOOKUP-#N/A in K89 (Zinssatz) und K116 wird #N/A.
const GRUNDSTUECKSART_OPTIONS = [
  'Wohnungseigentum [WE]',
  'Mietwohngrundstücke (Mehrfamilienhäuser)',
  'Teileigentum: Mietwohngrundstücke (Mehrfamilienhäuser)',
  'Ein- und Zweifamilienhäuser [EFH/ZFH]  (ohne weitere Angaben)  ',
  'gemischt genutzte Grundstücke, Wohnhäuser mit Mischnutzung (gewerbl. Anteil < 50%)',
  'gemischt genutzte Grundstücke, Wohnhäuser mit Mischnutzung (gewerbl. Anteil > 50%)',
  'Geschäftsgrundstücke, Geschäftshäuser',
  'Geschäftsgrundstücke, Bürogebäude',
];

// ----------------------------------------------------------------------
// Helper: Excel-Datumserialnummer aus ISO-Date
// ----------------------------------------------------------------------
function isoToExcelDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // Excel-Epoche: 1899-12-30 (mit Bug-Kompatibilität)
  const epoch = Date.UTC(1899, 11, 30);
  return Math.floor((d.getTime() - epoch) / 86400000);
}

// ----------------------------------------------------------------------
// Recalc via LibreOffice headless (ZWEI-Schritt-Verfahren:
//   1. Datei in tmp kopieren (mit Inputs geschrieben)
//   2. soffice --headless --calc --convert-to xlsx → triggert Recalc
// LibreOffice schreibt die berechneten Werte in den <v>-Tag der XLSX.
// ----------------------------------------------------------------------
function recalcWithLibreOffice(xlsxPath) {
  return new Promise((resolve, reject) => {
    const inDir = path.dirname(xlsxPath);
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmf-out-'));
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-profile-'));

    // V292.6.6-force-recalc-xcu: LibreOffice ZWINGEN, Formeln neu zu rechnen.
    // Ohne dieses Setting behält LibreOffice die gecachten Formel-Ergebnisse
    // der Vorlage (Bug: J122 blieb 139178 statt neuem K9-Wert).
    // ODFRecalcMode=0 + OOXMLRecalcMode=0 = "immer neu berechnen beim Laden".
    // Live-bewiesen: MIT diesem Setting rechnet LibreOffice korrekt neu.
    try {
      const xcuUserDir = path.join(profileDir, 'user');
      fs.mkdirSync(xcuUserDir, { recursive: true });
      const xcuContent = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema">' +
        '<item oor:path="/org.openoffice.Office.Calc/Formula/Load">' +
        '<prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>' +
        '<item oor:path="/org.openoffice.Office.Calc/Formula/Load">' +
        '<prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>' +
        '</oor:items>';
      fs.writeFileSync(path.join(xcuUserDir, 'registrymodifications.xcu'), xcuContent, 'utf8');
    } catch (xcuErr) {
      console.error('[BMF] XCU-Write fehlgeschlagen (Recalc evtl. stale):', xcuErr.message);
    }

    // soffice braucht: kein UI, eigenes Profil (sonst Lock-Konflikte),
    // separates outDir (sonst 0x4c0c-Fehler beim Überschreiben der Quelldatei)
    const args = [
      '--headless',
      '--norestore',
      '--nologo',
      '--nofirststartwizard',
      `-env:UserInstallation=file://${profileDir}`,
      '--calc',
      '--convert-to', 'xlsx',
      '--outdir', outDir,
      xlsxPath,
    ];

    const proc = spawn(LIBREOFFICE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) {}
      try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
      try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
      reject(new Error(`LibreOffice-Recalc timeout (${RECALC_TIMEOUT_MS}ms)\nstderr: ${stderr}`));
    }, RECALC_TIMEOUT_MS);

    proc.on('error', (err) => {
      clearTimeout(timeout);
      try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
      try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
      reject(new Error(`LibreOffice nicht ausführbar: ${err.message}. Bin: ${LIBREOFFICE_BIN}`));
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
      if (code !== 0) {
        try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
        return reject(new Error(`LibreOffice exit code ${code}\nstderr: ${stderr}\nstdout: ${stdout}`));
      }
      // Recalcte Datei zurück über das Original kopieren
      const recalced = path.join(outDir, path.basename(xlsxPath));
      if (!fs.existsSync(recalced)) {
        try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
        return reject(new Error(`Recalcte Datei nicht gefunden: ${recalced}`));
      }
      try {
        fs.copyFileSync(recalced, xlsxPath);
        fs.rmSync(outDir, { recursive: true, force: true });
      } catch (e) {
        return reject(new Error(`Kopieren der recalcten Datei fehlgeschlagen: ${e.message}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

// ----------------------------------------------------------------------
// Hauptfunktion: Eingaben → BMF-Berechnung → Ergebnis + Datei
// ----------------------------------------------------------------------
async function calculateKpa(inputs, opts = {}) {
  if (!ExcelJS) throw new Error("exceljs nicht installiert — bitte 'npm i exceljs' im backend/");
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`BMF-Vorlage fehlt: ${TEMPLATE_PATH}`);
  }

  // 1) Arbeitskopie der Vorlage anlegen
  const jobId = crypto.randomBytes(8).toString('hex');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `bmf-${jobId}-`));
  const workPath = path.join(tmpDir, `bmf_${jobId}.xlsx`);
  fs.copyFileSync(TEMPLATE_PATH, workPath);

  // 2) Inputs in die Vorlage schreiben
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(workPath);

  for (const [key, target] of Object.entries(INPUT_CELLS)) {
    if (!(key in inputs)) continue;
    let v = inputs[key];
    if (v === '' || v === null || typeof v === 'undefined') continue;

    // Datum-Sonderfall: ExcelJS akzeptiert Date-Objekte direkt
    if (key === 'kaufdatum') {
      const d = new Date(v);
      if (!isNaN(d.getTime())) v = d;
      else continue;
    }

    const sh = wb.getWorksheet(target.sheet);
    if (!sh) continue;
    const cell = sh.getCell(target.cell);

    // Numerisch wenn möglich (außer für Dropdown-Strings)
    const stringFields = ['lage','grundstuecksart','vergleichsfaktor_vorhanden',
                          'bezugsmassstab','miete_bekannt',
                          'mod_dach','mod_fenster','mod_leitungen','mod_heizung',
                          'mod_waermedaemmung','mod_baeder','mod_innenausbau','mod_grundriss'];
    if (!stringFields.includes(key) && typeof v !== 'number') {
      const n = Number(String(v).replace(/\s/g,'').replace(',', '.'));
      if (!isNaN(n)) v = n;
    }
    cell.value = v;
  }

  // Cached values löschen, damit LibreOffice frisch rechnet
  wb.eachSheet((sh) => {
    sh.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.formula && cell.result !== undefined) {
          cell.result = null;
        }
      });
    });
  });

  // V288.1-cf-strip-applied: Conditional-Formatting-Regeln entfernen.
  // ExcelJS hat einen Bug (CfRuleXform.renderExpression) der beim writeFile
  // crasht wenn die XLSX komplexe CF-Regeln enthält. Die BMF-Vorlage Juni 2023
  // hat solche Regeln (Farb-Markierung von Plausibilitätsbereichen).
  // Die CF-Regeln sind nur visuell — auf die Berechnung haben sie KEINEN Einfluss.
  wb.eachSheet((sh) => {
    if (sh.conditionalFormattings && Array.isArray(sh.conditionalFormattings)) {
      sh.conditionalFormattings = [];
    }
    // Auch der interne Setter, falls ExcelJS-Version anders speichert
    try { sh._conditionalFormattings = []; } catch(_) {}
  });

  await wb.xlsx.writeFile(workPath);

  // 3) LibreOffice-Recalc
  let recalcInfo = null;
  try {
    recalcInfo = await recalcWithLibreOffice(workPath);
  } catch (err) {
    return {
      ok: false,
      stage: 'recalc',
      error: err.message,
      hint: 'LibreOffice muss im Backend-Container installiert sein. Siehe Dockerfile-Patch.',
    };
  }

  // 4) Ergebnisse auslesen (data_only-Modus via ExcelJS: getCell.value liefert
  // bei Formel-Cells nach Recalc das result-Property)
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(workPath);

  const results = {};
  for (const [key, target] of Object.entries(OUTPUT_CELLS)) {
    const sh = wb2.getWorksheet(target.sheet);
    if (!sh) { results[key] = null; continue; }
    const cell = sh.getCell(target.cell);
    let v = cell.value;
    if (v && typeof v === 'object' && 'result' in v) v = v.result;
    if (typeof v === 'number' && !isFinite(v)) v = null;
    results[key] = { value: v, label: target.label };
  }

  // 5) Aufgefüllte XLSX als Base64 mitliefern (optional, für Download)
  let filledBase64 = null;
  if (opts.includeFile !== false) {
    filledBase64 = fs.readFileSync(workPath).toString('base64');
  }

  // 6) Cleanup
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

  return {
    ok: true,
    stage: 'done',
    inputs_received: inputs,
    results,
    file_base64: filledBase64,
    file_name: `BMF_Aufteilung_${new Date().toISOString().slice(0,10)}.xlsx`,
    meta: {
      template_version: 'Fassung Juni 2023',
      template_path: TEMPLATE_PATH,
      job_id: jobId,
      recalc_engine: 'LibreOffice headless',
    },
  };
}

// ----------------------------------------------------------------------
// Selbsttest (npm-run-script "bmf:selftest") - läuft mit Demo-Daten
// ----------------------------------------------------------------------
async function selfTest() {
  const demo = {
    lage: 'Musterstraße 1, 10115 Berlin',
    grundstuecksart: 'Wohnungseigentum [WE]',
    kaufdatum: '2021-09-23',
    kaufpreis: 139178,
    baujahr: 1998,
    wohnflaeche: 118,
    mea_zaehler: 71,
    mea_nenner: 1000,
    grundstuecksgroesse: 2393,
    bodenrichtwert: 130,
    vergleichsfaktor_vorhanden: 'Nein',
    miete_bekannt: 'Ja',
    miete_monatlich: 753,
    regionalfaktor: 1,
    sachwertfaktor: 1,
  };
  const r = await calculateKpa(demo, { includeFile: false });
  return r;
}

module.exports = {
  calculateKpa,
  selfTest,
  GRUNDSTUECKSART_OPTIONS,
  INPUT_CELLS,
  OUTPUT_CELLS,
};
