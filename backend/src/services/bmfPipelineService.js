/**
 * BMF-Pipeline-Service V290
 * ─────────────────────────────────────────────────────────────────
 * Orchestriert die 12 Phasen der steuerlichen Immobilienoptimierung:
 *
 *  Phase 1: Eingaben (vom Frontend)
 *  Phase 2: Inventar-Trennung      (KP − Inventar = Immobilien-KP)
 *  Phase 3: Prognose-AK            (Immo-KP + NK)
 *  Phase 4: BMF-Aufteilung         (bmfService.calculateKpa)
 *  Phase 5: 3 Varianten            (Konservativ × 1.0, Optimiert × 0.85, Aggressiv × 0.75)
 *  Phase 6: Vertragsstruktur       (intern, kein eigener Output)
 *  Phase 7: NK-Verteilung          (Geb/Boden anteilig, NICHT Inventar)
 *  Phase 8: Finale AK              (Geb-KP + Geb-NK pro Variante)
 *  Phase 9: 15-%-Grenze            (von Gebäude-AK)
 *  Phase 10: AfA-Berechnung        (Gebäude + Inventar getrennt)
 *  Phase 11: Risikoampel           (Score 0=grün, 1-3=gelb, 4+=rot)
 *  Phase 12: Übernehmen            (im Frontend, hier nur Response zurück)
 *
 *  Engine-Version: v290.0.0
 *  Konzept-Doc: /mnt/user-data/outputs/BMF_Konzept_V290.md
 */

const bmfService = require('./bmfService');

const ENGINE_VERSION = 'v290.0.0';

// User-confirmed Faktoren aus Konzept-Doc Kapitel 12
const BODEN_FAKTOREN = {
  konservativ: 1.00,
  optimiert:   0.85,
  aggressiv:   0.75
};

// AfA-Satz nach Baujahr (§ 7 Abs. 4 EStG, vereinfacht)
function _afaSatzFromBaujahr(baujahr) {
  if (!baujahr) return 2.0;
  // Neubau ab 2023: 3,0% (§7 IV Nr. 2a)
  if (baujahr >= 2023) return 3.0;
  // Baujahr ≥ 1925: 2,0% linear
  // Baujahr <  1925: 2,5% (Altbau)
  return baujahr >= 1925 ? 2.0 : 2.5;
}

// Grenzsteuersatz für Steuerersparnis-Hochrechnung
const GRENZSTEUER_DEFAULT = 0.4045;

// ─────────────────────────────────────────────────────────────────
// PHASE 2: Inventar-Trennung
// ─────────────────────────────────────────────────────────────────
function _phase2_inventar(inputs) {
  const inv = inputs.inventar || {};
  const kueche      = Number(inv.kueche)      || 0;
  const moebel      = Number(inv.moebel)      || 0;
  const geraete     = Number(inv.geraete)     || 0;
  const pv          = Number(inv.pv)          || 0;
  const stellplatz  = Number(inv.stellplatz)  || 0;
  const sonstiges   = Number(inv.sonstiges)   || 0;

  const inventar_gesamt = kueche + moebel + geraete + pv + stellplatz + sonstiges;
  const kp_brutto = Number(inputs.investition?.kp_brutto) || 0;
  const immobilien_kp = Math.max(0, kp_brutto - inventar_gesamt);

  const warnings = [];
  // Plausibilität: Inventar darf nicht > 15 % vom KP sein (FA-Anhaltspunkt)
  if (kp_brutto > 0 && inventar_gesamt / kp_brutto > 0.15) {
    warnings.push({
      level: 'warn',
      code: 'INVENTAR_HOCH',
      msg: `Inventarwert (${inventar_gesamt} €) entspricht ${(inventar_gesamt / kp_brutto * 100).toFixed(1)}% des Kaufpreises — FA prüft das genau.`
    });
  }

  return {
    inventar_gesamt,
    immobilien_kp,
    aufschluesselung: { kueche, moebel, geraete, pv, stellplatz, sonstiges },
    warnings
  };
}

// ─────────────────────────────────────────────────────────────────
// PHASE 3: Prognose-AK
// ─────────────────────────────────────────────────────────────────
function _phase3_prognoseAk(inputs, phase2) {
  const investition = inputs.investition || {};
  const grest    = Number(investition.gest_e) || 0;
  const notar    = Number(investition.notar_e) || 0;
  const gba      = Number(investition.gba_e) || 0;
  const makler   = Number(investition.makler_e) || 0;
  const ji_sonst = Number(investition.ji_sonst_e) || 0;

  const nk_gesamt = grest + notar + gba + makler + ji_sonst;
  const prognose_ak = phase2.immobilien_kp + nk_gesamt;

  return {
    immobilien_kp: phase2.immobilien_kp,
    nk_gesamt,
    prognose_ak,
    nk_aufschluesselung: { grest, notar, gba, makler, ji_sonst }
  };
}

// ─────────────────────────────────────────────────────────────────
// PHASE 4: BMF-Aufteilung via bmfService (LibreOffice)
// ─────────────────────────────────────────────────────────────────
async function _phase4_bmf(inputs, phase3) {
  const objekt = inputs.objekt || {};
  const miete  = inputs.miete  || {};
  const gaa    = inputs.gaa    || {};

  // Adresse zusammensetzen
  const lage = [
    [objekt.str, objekt.hnr].filter(Boolean).join(' '),
    [objekt.plz, objekt.ort].filter(Boolean).join(' ')
  ].filter(Boolean).join(', ');

  // Miete: bei Leerstand aus Marktmiete (€/m² × Wfl); sonst aus NKM
  let miete_monatlich = Number(miete.nkm) || 0;
  if (miete.leerstand || miete_monatlich === 0) {
    const marktmiete_qm = Number(miete.marktmiete_qm) || 0;
    const wfl = Number(objekt.wfl) || 0;
    if (marktmiete_qm > 0 && wfl > 0) {
      miete_monatlich = marktmiete_qm * wfl;
    }
  }

  // BMF braucht Prognose-AK als Kaufpreis (Konzept Phase 3 → 4)
  const bmfInputs = {
    lage,
    grundstuecksart: objekt.objart_bmf || 'Wohnungseigentum [WE]',
    kaufdatum: inputs.investition?.kaufdat || new Date().toISOString().slice(0, 10),
    kaufpreis: phase3.prognose_ak,   // ← KRITISCH: Prognose-AK statt KP-brutto
    baujahr: Number(objekt.baujahr) || 0,
    wohnflaeche: Number(objekt.wfl) || 0,
    grundstuecksgroesse: Number(objekt.gsfl) || 0,
    bodenrichtwert: Number(gaa.brw_user || objekt.brw) || 0,
    /* V292.6.7-pipeline-mea: MEA-Anteil aus objekt.mea (war hardcoded 0 → negativer Gebäudeanteil!)
     * objekt.mea ist Prozent (z.B. 7.06) → Zähler 706 bei Nenner 10000.
     * Bei leer/0 → 1000/1000 (=100%, kein WE-Anteil). */
    mea_zaehler: (function(){
      var pct = Number(String(objekt.mea || '').replace(',', '.')) || 0;
      return pct > 0 ? Math.round(pct * 100) : 1000;
    })(),
    mea_nenner: (function(){
      var pct = Number(String(objekt.mea || '').replace(',', '.')) || 0;
      return pct > 0 ? 10000 : 1000;
    })(),
    miete_bekannt: miete_monatlich > 0 ? 'Ja' : 'Nein',
    miete_monatlich,
    vergleichsfaktor_vorhanden: gaa.vergleichsmiete_low ? 'Ja' : 'Nein',
    regionalfaktor: 1,
    sachwertfaktor: Number(gaa.sachwertfaktor) || 1
  };

  // Pflichtfelder validieren (Backend-Service erwartet sie)
  const required = ['lage', 'kaufpreis', 'baujahr', 'wohnflaeche'];
  const missing = required.filter(k => !bmfInputs[k] || bmfInputs[k] === 0);
  if (missing.length) {
    return {
      _error: true,
      _missing: missing,
      _msg: `BMF-Pflichtfelder fehlen: ${missing.join(', ')}`
    };
  }

  // BMF-Backend aufrufen
  const bmfResult = await bmfService.calculateKpa(bmfInputs, { includeFile: false });
  const r = bmfResult.results || {};

  // Werte extrahieren — Service liefert nur gebaeudeanteil_prozent
  const gebaeude_pct = r.gebaeudeanteil_prozent?.value ?? 80;
  const boden_pct = 100 - gebaeude_pct;

  const gebaeudewert = r.gebaeude_wert?.value ?? 0;
  const bodenwert    = r.bodenwert?.value ?? 0;

  // Verfahren inferieren — der maßgebende Verkehrswert nähert sich am stärksten an einem der drei
  let verfahren = 'unknown';
  const massgebend = r.massgebender_verkehrswert?.value ?? 0;
  if (massgebend > 0) {
    const candidates = [
      { name: 'ertragswert',   val: r.ertragswert?.value ?? 0 },
      { name: 'sachwert',      val: r.sachwert_marktangepasst?.value ?? r.sachwert_vorlaeufig?.value ?? 0 },
      { name: 'vergleichswert', val: r.vergleichswert?.value ?? 0 }
    ];
    const closest = candidates.reduce((best, c) => {
      const d = Math.abs(c.val - massgebend);
      return d < best.d ? { name: c.name, d } : best;
    }, { name: 'unknown', d: Infinity });
    verfahren = closest.name;
  }

  return {
    bodenwert,
    gebaeudewert,
    bodenanteil_prozent: boden_pct,
    gebaeudeanteil_prozent: gebaeude_pct,
    verfahren,
    massgebender_verkehrswert: massgebend,
    fiktives_baujahr: r.fiktives_baujahr?.value ?? null,
    warnings: bmfResult.warnings || []
  };
}

// ─────────────────────────────────────────────────────────────────
// PHASE 5: 3 Vertragsvarianten generieren
// ─────────────────────────────────────────────────────────────────
function _phase5_varianten(phase2, phase4) {
  const immoKp = phase2.immobilien_kp;
  const bmfBodenPct = phase4.bodenanteil_prozent;

  const result = {};
  for (const [name, faktor] of Object.entries(BODEN_FAKTOREN)) {
    const boden_pct = bmfBodenPct * faktor;
    const gebaeude_pct = 100 - boden_pct;

    result[name] = {
      faktor,
      gebaeude_pct: Number(gebaeude_pct.toFixed(2)),
      boden_pct:    Number(boden_pct.toFixed(2)),
      gebaeude_eur_vertrag: Math.round(immoKp * gebaeude_pct / 100),
      boden_eur_vertrag:    Math.round(immoKp * boden_pct / 100)
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// PHASE 7: NK-Verteilung pro Variante (Geb/Boden, NICHT Inventar)
// ─────────────────────────────────────────────────────────────────
function _phase7_nkVerteilung(phase3, phase5) {
  const nkGesamt = phase3.nk_gesamt;
  const result = {};
  for (const [name, v] of Object.entries(phase5)) {
    result[name] = {
      geb_nk:   Math.round(nkGesamt * v.gebaeude_pct / 100),
      boden_nk: Math.round(nkGesamt * v.boden_pct / 100)
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// PHASE 8: Finale Anschaffungskosten
// ─────────────────────────────────────────────────────────────────
function _phase8_finaleAk(phase2, phase5, phase7) {
  const result = {};
  for (const name of Object.keys(phase5)) {
    const v = phase5[name];
    const nk = phase7[name];
    result[name] = {
      gebaeude_ak: v.gebaeude_eur_vertrag + nk.geb_nk,
      boden_ak:    v.boden_eur_vertrag + nk.boden_nk,
      inventar_ak: phase2.inventar_gesamt
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// PHASE 9: 15-%-Grenze von Gebäude-AK (§ 6 Abs. 1 Nr. 1a EStG)
// ─────────────────────────────────────────────────────────────────
function _phase9_15pct(phase8, inputs) {
  const geplant = Number(inputs.renovierung?.san_geplant_3j) || 0;
  const result = {};
  for (const name of Object.keys(phase8)) {
    const ak = phase8[name];
    const max = Math.round(ak.gebaeude_ak * 0.15);
    const puffer = max - geplant;
    let status = 'puffer';
    if (puffer < 0) status = 'ueberschritten';
    else if (puffer < max * 0.10) status = 'eng';
    result[name] = { max, geplant, puffer, status };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// PHASE 10: AfA-Berechnung (Gebäude + Inventar getrennt)
// ─────────────────────────────────────────────────────────────────
function _phase10_afa(inputs, phase2, phase8) {
  const baujahr = Number(inputs.objekt?.baujahr) || 0;
  const afa_satz_pct = _afaSatzFromBaujahr(baujahr);

  const inventar_jahre = Number(inputs.renovierung?.moebl_verteilung_jahre) || 10;
  const inventar_afa_jahr = inventar_jahre > 0
    ? Math.round(phase2.inventar_gesamt / inventar_jahre)
    : 0;

  const result = {};
  for (const name of Object.keys(phase8)) {
    const ak = phase8[name];
    const afa_basis = ak.gebaeude_ak;
    const afa_jahr = Math.round(afa_basis * afa_satz_pct / 100);
    const afa_summe = afa_jahr + inventar_afa_jahr;
    result[name] = {
      afa_satz_pct,
      afa_basis,
      afa_jahr,
      inventar_afa_jahr,
      inventar_afa_jahre: inventar_jahre,
      afa_summe_jahr: afa_summe,
      steuerersparnis_jahr: Math.round(afa_summe * GRENZSTEUER_DEFAULT)
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// PHASE 11: Risikoampel (Score-basiert nach Konzept-Doc Kapitel 7)
// ─────────────────────────────────────────────────────────────────
function _phase11_risiko(phase2, phase4, phase5, phase8, phase9, inputs) {
  const kpBrutto = Number(inputs.investition?.kp_brutto) || 0;
  const inventarPct = kpBrutto > 0 ? (phase2.inventar_gesamt / kpBrutto * 100) : 0;
  const bmfBodenPct = phase4.bodenanteil_prozent;

  const result = {};
  for (const name of Object.keys(phase5)) {
    let score = 0;
    const begruendungen = [];

    // Faktor 1: Variant-Typ
    if (name === 'optimiert') {
      score += 1;
      begruendungen.push('Optimierte Aufteilung (Boden −15 %)');
    } else if (name === 'aggressiv') {
      score += 3;
      begruendungen.push('Aggressive Aufteilung (Boden −25 %)');
    }

    // Faktor 2: Inventar-Plausibilität
    if (inventarPct > 10) {
      score += 2;
      begruendungen.push(`Inventarwert hoch (${inventarPct.toFixed(1)}% des KP) — FA-Anhaltspunkt`);
    } else if (inventarPct > 5) {
      score += 1;
      begruendungen.push(`Inventarwert erklärungsbedürftig (${inventarPct.toFixed(1)}% des KP)`);
    }

    // Faktor 3: 15-%-Grenze
    const grenze = phase9[name];
    if (grenze.status === 'ueberschritten') {
      score += 3;
      begruendungen.push('15-%-Grenze überschritten — Sanierungen als anschaffungsnahe HK behandelt');
    } else if (grenze.status === 'eng') {
      score += 1;
      begruendungen.push('15-%-Grenze knapp (< 10 % Puffer)');
    }

    // Faktor 4: Abweichung von BMF
    const v = phase5[name];
    const abweichung = Math.abs(v.boden_pct - bmfBodenPct);
    const abwPct = bmfBodenPct > 0 ? (abweichung / bmfBodenPct * 100) : 0;
    if (abwPct > 30) {
      score += 2;
      begruendungen.push(`Bodenabweichung > 30 % von BMF`);
    } else if (abwPct > 20) {
      score += 1;
      begruendungen.push(`Bodenabweichung > 20 % von BMF`);
    }

    // Score → Ampel
    let ampel = 'gruen';
    if (score >= 4) ampel = 'rot';
    else if (score >= 1) ampel = 'gelb';

    if (begruendungen.length === 0) {
      begruendungen.push('Aufteilung entspricht BMF-Referenz — FA-konform, niedriges Risiko.');
    }

    result[name] = { ampel, score, begruendungen };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// HAUPT-PIPELINE
// ─────────────────────────────────────────────────────────────────
async function runPipeline(rawInputs) {
  const inputs = rawInputs.phase1_inputs || rawInputs;

  // Validate top-level
  if (!inputs.objekt) throw _err('PIPELINE_INVALID_INPUT', 'phase1_inputs.objekt fehlt');
  if (!inputs.investition) throw _err('PIPELINE_INVALID_INPUT', 'phase1_inputs.investition fehlt');

  // Phase 2: Inventar-Trennung
  const phase2 = _phase2_inventar(inputs);

  // Phase 3: Prognose-AK
  const phase3 = _phase3_prognoseAk(inputs, phase2);

  // Phase 4: BMF-Aufteilung (LibreOffice — Bottleneck)
  const phase4 = await _phase4_bmf(inputs, phase3);
  if (phase4._error) {
    return {
      ok: false,
      error: phase4._msg,
      missing: phase4._missing,
      phase2_inventar: phase2,
      phase3_prognose_ak: phase3
    };
  }

  // Phase 5: 3 Vertragsvarianten
  const phase5 = _phase5_varianten(phase2, phase4);

  // Phase 7: NK-Verteilung
  const phase7 = _phase7_nkVerteilung(phase3, phase5);

  // Phase 8: Finale AK
  const phase8 = _phase8_finaleAk(phase2, phase5, phase7);

  // Phase 9: 15-%-Grenze
  const phase9 = _phase9_15pct(phase8, inputs);

  // Phase 10: AfA
  const phase10 = _phase10_afa(inputs, phase2, phase8);

  // Phase 11: Risikoampel
  const phase11 = _phase11_risiko(phase2, phase4, phase5, phase8, phase9, inputs);

  return {
    ok: true,
    phase2_inventar: phase2,
    phase3_prognose_ak: phase3,
    phase4_bmf: phase4,
    phase5_varianten: phase5,
    phase7_nk_verteilung: phase7,
    phase8_finale_ak: phase8,
    phase9_15pct: phase9,
    phase10_afa: phase10,
    phase11_risiko: phase11,
    meta: {
      calculated_at: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
      bmf_template_version: 'Juni 2023'
    }
  };
}

function _err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// ─────────────────────────────────────────────────────────────────
// SelfTest mit dem Konzept-Doc-Beispiel (Sachsenstr 16, Herford)
// ─────────────────────────────────────────────────────────────────
async function selfTest() {
  const inputs = {
    phase1_inputs: {
      objekt: {
        plz: '32602', ort: 'Herford', str: 'Sachsenstr', hnr: '16',
        objart_bmf: 'Wohnungseigentum [WE]',
        wfl: 95, baujahr: 1994, gsfl: 1570, brw: 160
      },
      investition: {
        kp_brutto: 180000,
        gest_e: 11700, notar_e: 3960, gba_e: 0, makler_e: 0, ji_sonst_e: 0,
        kaufdat: '2026-04-01'
      },
      inventar: {
        kueche: 7000, moebel: 0, geraete: 0, pv: 0, stellplatz: 0, sonstiges: 0
      },
      renovierung: {
        san_geplant_3j: 10000,
        moebl_verteilung_jahre: 10
      },
      miete: {
        nkm: 748.80,
        marktmiete_qm: 9.50,
        leerstand: false
      },
      gaa: {}
    }
  };

  const result = await runPipeline(inputs);
  return { inputs_received: inputs, result };
}

module.exports = {
  runPipeline,
  selfTest,
  BODEN_FAKTOREN,
  ENGINE_VERSION
};
