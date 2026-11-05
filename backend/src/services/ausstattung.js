'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   ausstattung.js · v3193 — Ausstattungsmerkmale lesbar für die Schnittstelle

   Marcel 05.11.2026: „die Portfoliostrategie sagt: Wir haben keine Ausstattungsmerkmale. Haben wir die nicht?"
   Gemessen: DealPilot führt sie, aber verstreut im Rohdatensatz (eq_*, ausst_*, mod_*, standardstufe, ds2_energie,
   _mfh.einheiten[]) - als Codes ohne Erklärung. Dieser Baustein fasst sie zu EINEM Block `ausstattung` zusammen,
   mit Klartext aus der Feldliste (frontend-konstanten.json) und je Wohnung; was eine Wohnung nicht selbst führt,
   wird aus dem Gebäude abgeleitet und als `quelle: "abgeleitet"` gekennzeichnet. Rechnet nichts, liest nur.
   ═══════════════════════════════════════════════════════════════════════ */
let _lex = null;
function lexikon() {
  if (_lex) return _lex;
  _lex = {};
  try {
    const k = require('../generated/frontend-konstanten.json');
    ((k.daten || k).felder || []).forEach((f) => { if (f && f.id) _lex[f.id] = f; });
  } catch (e) { _lex = {}; }
  return _lex;
}
function leer(v) { return v == null || String(v).trim() === ''; }
function text(id, wert) {
  if (leer(wert)) return null;
  const f = lexikon()[id];
  const o = f && Array.isArray(f.optionen) ? f.optionen.find((x) => String(x.wert) === String(wert)) : null;
  return o ? o.text : String(wert);
}
function feld(d, id) { return leer(d[id]) ? null : { wert: d[id], text: text(id, d[id]) }; }
function zahl(v) { if (leer(v)) return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }

const GEWERKE = [
  ['Außenwände', 'eq_walls', 'mod_aussenwand', 'ausst_aussenwaende'],
  ['Dach', 'eq_roof', 'mod_dach', 'ausst_dach'],
  ['Fenster und Außentüren', 'eq_windows', 'mod_fenster', 'ausst_fenster'],
  ['Heizung', 'eq_heating', 'mod_heizung', 'ausst_heizung'],
  ['Bad / Sanitär', 'eq_bath', 'mod_baeder', 'ausst_sanitaer'],
  ['Fußböden', 'eq_floor', null, 'ausst_fussboeden'],
  ['Innenwände und -türen', null, 'mod_innenausbau', 'ausst_innenwaende'],
  ['Decken und Treppen', null, null, 'ausst_decken'],
  ['Technik / Leitungen', null, 'mod_leitungen', 'ausst_technik'],
  ['Grundriss', null, 'mod_grundriss', null]
];
const KUECHE = { keine: 'keine Einbauküche', ebk_einfach: 'Einbauküche einfach', ebk_hochwertig: 'Einbauküche hochwertig' };
const BAD = { einfach: 'einfach / älter', standard: 'Standard', modern: 'modernisiert / gehoben' };
const BODEN = { pvc_teppich: 'PVC / Teppich', laminat: 'Laminat / Vinyl', fliesen: 'Fliesen', parkett: 'Parkett / Dielen' };

/** Gebäudeteil */
function gebaeude(d) {
  const gewerke = GEWERKE.map(([name, art, mod, stufe]) => {
    const z = { gewerk: name };
    if (art && !leer(d[art])) z.art = text(art, d[art]);
    if (mod && !leer(d[mod])) z.modernisiert = text(mod, d[mod]);
    if (stufe && !leer(d[stufe])) z.standardstufe = zahl(d[stufe]);
    return z;
  }).filter((z) => Object.keys(z).length > 1);
  return {
    standardstufe: feld(d, 'standardstufe'),
    zustand: feld(d, 'ds2_zustand'),
    energieklasse: feld(d, 'ds2_energie'),
    modernisierungspunkte: zahl(d.mod_punkte),
    modernisierung_jahr: zahl(d.modernis),
    gewerke: gewerke,
    bauteile: {
      aufzug: feld(d, 'eq_elevator'),
      gaeste_wc: feld(d, 'eq_guest_wc'),
      keller_abstellraum: feld(d, 'eq_store_room'),
      baeder: zahl(d.bad_anz),
      balkon_terrasse_qm: zahl(d.balkon_flae),
      garagen: zahl(d.garagen),
      stellplaetze_aussen: zahl(d.stellpl_aussen)
    }
  };
}

/** Ableitung je Wohnung aus dem Gebäude, wenn die Wohnung selbst nichts führt */
function abgeleitet(d) {
  const a = {};
  const s = zahl(d.ausst_sanitaer), mb = String(d.mod_baeder || '');
  if (s != null) a.bad = s >= 3.5 ? 'modern' : s >= 2.5 ? 'standard' : 'einfach';
  if (/kern|< ?5|unter 5|0-5|1-5/i.test(mb)) a.bad = 'modern';
  const fb = String(text('eq_floor', d.eq_floor) || '').toLowerCase();
  if (/parkett|diele/.test(fb)) a.boden = 'parkett';
  else if (/fliese/.test(fb)) a.boden = 'fliesen';
  else if (/laminat|vinyl/.test(fb)) a.boden = 'laminat';
  else if (/pvc|teppich/.test(fb)) a.boden = 'pvc_teppich';
  const rk = zahl(d.rate_kueche) || zahl(d.qual_kueche);
  if (rk != null) a.kueche = rk >= 4 ? 'ebk_hochwertig' : rk >= 2 ? 'ebk_einfach' : 'keine';
  return a;
}

function wohnung(e, ab) {
  const merkmal = (eigen, abg, karte) => !leer(eigen)
    ? { wert: eigen, text: karte[eigen] || String(eigen), quelle: 'erfasst' }
    : (abg ? { wert: abg, text: karte[abg] || abg, quelle: 'abgeleitet' } : null);
  return {
    nr: e.nr || null, lage: e.lage || null, art: e.art || 'wohnen',
    wohnflaeche: zahl(e.wfl), zimmer: zahl(e.zimmer), etage: e.etage || null,
    balkon_terrasse_qm: zahl(e.balkon_qm), keller: e.keller || null, stellplatz: e.stellplatz || null,
    zustand: zahl(e.zustand),
    kueche: merkmal(e.aus_kueche, ab.kueche, KUECHE),
    bad: merkmal(e.aus_bad, ab.bad, BAD),
    bad_modernisiert_jahr: zahl(e.aus_bad_jahr),
    boden: merkmal(e.aus_boden, ab.boden, BODEN),
    fussbodenheizung: leer(e.aus_fbh) ? null : e.aus_fbh,
    barrierearm: leer(e.aus_barrierearm) ? null : e.aus_barrierearm,
    modernisierung: e.mod && typeof e.mod === 'object' ? e.mod : null
  };
}

/** Der Block für ein Objekt (data = Rohdatensatz) */
function ausstattung(data) {
  const d = data && typeof data === 'object' ? data : {};
  const ab = abgeleitet(d);
  const einheiten = d._mfh && Array.isArray(d._mfh.einheiten) ? d._mfh.einheiten : null;
  return {
    hinweis: 'Ausstattung lesbar zusammengefasst; Rohfelder stehen weiter im Datensatz (eq_*, ausst_*, mod_*, _mfh.einheiten). quelle "abgeleitet" = aus dem Gebäude, nicht je Wohnung erfasst.',
    gebaeude: gebaeude(d),
    /* Einzelobjekt (ETW/EFH): eine „Wohnung" aus den Objektfeldern */
    einheiten: einheiten ? einheiten.map((e) => wohnung(e || {}, ab))
      : [wohnung({ wfl: d.wfl, zimmer: d.zimmer, etage: d.etage, balkon_qm: d.balkon_flae, aus_kueche: d.aus_kueche, aus_bad: d.aus_bad, aus_boden: d.aus_boden }, ab)]
  };
}

module.exports = { ausstattung, abgeleitet };
