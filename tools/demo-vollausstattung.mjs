/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/demo-vollausstattung.mjs · Backlog N148 (11.11.2026)

   Legt im Demo-Konto zwei Pruefobjekte "Vollausstattung A/B" an, in denen
   die Felder gefuellt sind, die am 10./11.11.2026 in KEINEM der Demo-Objekte
   vorkamen (Inventar, Sonderumlage, Kostenpositionen II-IV, Darlehen II mit
   Bausparvertrag, Bausparvertrag am Darlehen I, § 7b, Mietspiegel, Zielbild,
   Mietvertrag, Eigentum, Erbbaurecht, Sanierungsplan …).

   ZWEI Objekte, weil sich einiges gegenseitig ausschliesst:
     · § 7b verlangt einen NEUBAU im Jahr der Fertigstellung angeschafft -
       Sanierungsbedarf (fesh_*), Sanierungsplan, Mieterhoehungs-Historie
       und Zielbild gehoeren zu einem BESTAND.
     · eig_* (Ehegatten/Bruchteile) gibt es nur privat; Grundsteuerwert
       (§ 9 Nr. 1 GewStG) nur bei GmbH/UG.
     · mv_kuendigungsverzicht_bis und mv_befristet_bis haengen an EINER
       Vertragsart (mv_art kuendigungsverzicht / zeitmiete).
     · Vergleichsfaktor-Klassen (vgf_*) gibt es nur, wo der Registersatz sie
       fuehrt (Konstanz); der UK Grundstuecksgroesse nur bei EFH/ZFH/DHH/RH.
   A = Bestands-ETW in Konstanz, privat (Bruchteilsgemeinschaft), WEG.
   B = Neubau-DHH in Bielefeld auf Erbbaurecht, Halter Demo Immobilien GmbH.

   Bewusst NICHT gefuellt (Grund: Backlog N148):
     gesellschafterdarlehen (nur aus dem Ueberfuehrungs-Assistenten; eine
     Ueberfuehrung schliesst § 7b in B aus), fesh_d (Dach/Fassade ist in A
     Gemeinschaftseigentum -> Sonderumlage, B ist Neubau), mietausfall_alt,
     _avm_state, _immometrica_*, erwerbsart, anbietertyp, bspar_zuteil,
     mietspiegel, moebl_tax_active (von der App selbst geschrieben, Import
     oder Altfeld ohne Eingabe).

   Alle Namen, Anschriften, Vertragsnummern und Mietspiegelwerte sind
   ERFUNDEN (memory echte-namen-nie-ins-repo).

   Aufruf:
     node tools/demo-vollausstattung.mjs                 Trockenlauf: Feldpruefung + KPI-Kern
     node tools/demo-vollausstattung.mjs --anlegen --token=<JWT>   [--server=staging|prod] [--nur=A|B] [--aktualisieren]
   Der Token gehoert dem Demo-Konto (info@…); auf dem Server erzeugen:
     docker exec -w /app dealpilot-backend node -e "process.stdout.write(require('./src/utils/jwt')
       .signKurz({userId:'<uuid>',email:'<mail>',name:'<name>',role:'<rolle>'},'60m'))"
   Ein Objekt, dessen Kuerzel (VOLL-A / VOLL-B) im Konto schon steht, wird
   NICHT noch einmal angelegt. Halter-Id von B (Demo Immobilien GmbH) gilt
   fuer Staging und Prod nur, wenn die Mandantenliste gespiegelt ist -
   vor dem Prod-Lauf user_settings 'mandanten' pruefen.
   Per API angelegt fehlen _kpis_* und die Scores, bis die App das Objekt einmal
   speichert. VORSICHT beim Oeffnen in der App (gemessen 11.11.2026): wer erst A
   (Darlehen I mit Tilgungsaussetzung) und dann B oeffnet, bekommt in B die
   Tilgung von Darlehen I auf 0 gesetzt (financing.js onD1TypeChange, dataset.
   savedValue ueberlebt den Objektwechsel) - und das Auto-Speichern schreibt sie.
   B also zuerst oder nach einem Neuladen oeffnen.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);

const SERVER = {
  staging: 'https://app.staging.dealpilot.immo',
  prod: 'https://app.dealpilot.immo'
};
const GMBH_ID = 'mmv7q18g379';   /* Demo Immobilien GmbH, user_settings mandanten (Staging, 11.11.2026) */
const KONSTANZ_MS_URL = 'https://www.konstanz.de/site/Konstanz/get/params_E-2040053820_Dattachment/729933/Methodenbericht%20zum%20Gemeinsamen%20Mietspiegel%20Konstanz-Allensbach-Reichenau%202025.pdf';

const J = (x) => JSON.stringify(x);

/* ── A · Bestands-ETW, privat, WEG ─────────────────────────────────── */
const A = {
  _name: 'Musterallee 7a Konstanz', kuerzel: 'VOLL-A', dp_stufe: '3',
  thesis: 'Prüfobjekt N148 · Vollausstattung A (Bestands-ETW, privat, WEG)',
  notizen: 'Prüfobjekt N148 (11.11.2026): füllt die Felder, die in keinem Demo-Objekt vorkamen. Anschrift, Namen, Vertragsnummern und Mietspiegelwerte sind erfunden. Erzeugt mit tools/demo-vollausstattung.mjs.',
  risiken: 'Sonderumlage Fassade 2026 beschlossen; Kündigungsverzicht bis 03/2027.',
  plz: '78467', ort: 'Konstanz', str: 'Musterallee', hnr: '7a', objart: 'ETW',
  wfl: '82', zimmer: '3', bad_anz: '1', etage: '2', etagen_ges: '4', einheiten: '1',
  baujahr: '1994', baustatus: 'bestand', standardstufe: '4', ausst: 'Gehoben',
  mea: '4,85', gsfl: '1650', brw: '1250', wgfz_objekt: '1,1',
  vgf_wohnlage: 'gute', vgf_ausstattung: 'gehoben',
  makrolage: 'gut', mikrolage: 'gut', lageklasse: 'B',
  nutzungsart: 'kapitalanlage', vermstand: 'Vollvermietet', exitstr: 'Langfristig halten',
  halter: 'privat', obj_herkunft: 'neukauf',
  kaufdat: '2025-03-01', wirtschaftlicher_uebergang: '2025-04-01', wertermittlungsstichtag: '2025-03-01',
  /* Preis, Wert, Nebenkosten (BW: GrESt 5,0 %) */
  kp: '465000', makler_p: '3,57', notar_p: '1,5', gba_p: '0,5', gest_p: '5,0', ji_p: '0',
  svwert: '520000', svw_herkunft: 'gutachten', bankval: '500000', wert_soll: '560000',
  /* Sanierung = Summe der angehakten Sanierungsfelder (fesh_*); Dach/Fassade laeuft ueber die WEG */
  san: '38000', san_ust: 'brutto', san_tax_active: true, san_tax_years: 'auto', san_ausgefuehrt: '2025-10-15',
  fesh_b: true, fesh_b_cost: '14000', fesh_e: true, fesh_e_cost: '6000', fesh_f: true, fesh_f_cost: '9000',
  fesh_h: true, fesh_h_cost: '7000', fesh_o: true, fesh_o_cost: '2000',
  san_plan: J([
    { bez: 'Malerarbeiten und Innentüren', jahr: 2028, betrag: 4500, art: 'erhaltung', vert: 'auto' },
    { bez: 'Elektrische Rollläden (Neueinbau)', jahr: 2030, betrag: 3800, art: 'herstellung', vert: 'auto' }
  ]),
  /* Inventar, Summe = moebl (inventar-sync.js) */
  inv_kueche: '6500', inv_moebel: '1500', inv_geraete: '1200', inv_stellplatz: '12000', inv_sonst: '800',
  moebl: '22000', inv_tax_active: true, inv_tax_years: '10',
  /* Miete */
  nkm: '950', ze: '60', umlagef: '230', stellplatz_miete_monat: '60', leerstand: '2',
  mietstg: '1,5', wertstg: '1,5', kostenstg: '2', btj: '15', exit_bmy: '4',
  /* Bewirtschaftung (EUR/Jahr), Detailpositionen I-IV */
  hg_ul: '2160', grundsteuer: '420', ul_sonst: '120', hg_nul: '1140', weg_r: '1020', eigen_r: '300', nul_sonst: '240',
  kp1: '180', kp1l: 'Rauchwarnmelder-Miete', kp2: '96', kp2l: 'Kabelanschluss', kp3: '144', kp3l: 'Gartenpflege (Anteil)', kp4: '60', kp4l: 'Wartung Gasetagentherme',
  weg_su: J([{ zweck: 'Fassadendämmung und Balkonsanierung (Beschluss der Eigentümerversammlung 12.05.2025)',
    jahr: 2026, faellig: '2026-07-01', betrag: 4850, modus: 'gesamt', gesamt: 100000,
    wie: '100.000 € der Gemeinschaft × Miteigentumsanteil 4,85 %', quelle: 'Prüfobjekt (erfunden)',
    verw_jahr: 2026, art: 'erhaltung' }]),
  /* Steuer */
  afa_satz: '2.0', geb_ant: '78', zve: '120000', grenz: '41.35', grenz_auto: true,   /* grenz = was grenz_auto aus zve rechnet */
  /* Eigentum: Bruchteilsgemeinschaft Ehegatten + Dritter */
  eig_struktur: 'gemeinschaft', eig_erwerb: 'kauf', eig_anteil_ich: '50', eig_anteil_ehegatte: '25', eig_anteil_dritte: '25',
  eig_erwerb_datum: '2025-03-01',
  /* Darlehen I: Tilgungsaussetzung mit Bausparvertrag */
  ek: '172150', bank_inst: 'Beispielbank eG',
  d1: '330000', d1z: '3,6', d1t: '0', d1_bindj: '15', d1_type: 'tilgungsaussetzung', d1_verwendung: 'kauf',
  d1_auszahl: '03.2025', d1_vertrag: 'D1-0000-0815', d1_vertragsdatum: '10.01.2025',
  anschl_z: '4,5', anschl_t: '2', anschl_bj: '10', _d1_anschl_enable: true,
  bspar_inst: 'Beispiel-Bausparkasse AG', bspar_vertrag: 'BSV-0000-4711', bspar_vertragsdatum: '14.02.2025',
  bspar_sum: '150000', bspar_rate: '650', bspar_zins: '0,10', bspar_quote_min: '40', bspar_dar_z: '2,45', bspar_dar_t: '6',
  /* Darlehen II: KfW fuer die Sanierung */
  _d2_enabled: true, d2: '50000', d2z: '2,35', d2t: '2', d2_bindj: '10', d2_type: 'kfw', d2_verwendung: 'sanierung',
  d2_inst: 'KfW über Beispielbank eG', d2_auszahl: '09.2025', d2_vertrag: 'KfW-0000000', d2_vertragsdatum: '20.08.2025',
  d2_az: '4,0', d2_at: '2', _d2_anschl_enable: true,
  /* Mietspiegel (eigene Angabe; Konstanz untersagt die Speicherung der Werte im Register) */
  ms_art: 'qualifiziert', ms_unten: '10,90', ms_mittel: '12,40', ms_oben: '13,90', ms_stand: '2025-12', ms_url: KONSTANZ_MS_URL, ms_wahl: 'mittel',
  /* Mietvertrag */
  mv_art: 'kuendigungsverzicht', mv_beginn: '2019-04-01', mv_letzte_erhoehung: '2023-04-01', mv_letzte_erhoehung_betrag: '60',
  mv_kuendigungsverzicht_bis: '2027-03-31', mv_abw_jahre: '2',
  /* Zielbild */
  zb_soll_qm: '12,40', zb_soll_ab: '2026-04', zb_vgl_qm: '12,40', zb_ziel_qm: '13,60', zb_ziel_wann: 'nach Mieterwechsel 2029',
  zb_markt_qm: '14,00', zb_fertig_jahr: '2029',
  zb_massnahmen: J([{ id: 'kueche', t: 'Küche', k: 12000, bewohnt: false }, { id: 'boeden', t: 'Böden/Innenausbau', k: 6000, bewohnt: false }]),
  ds2_zustand: 'gut', ds2_energie: 'C', ds2_bevoelkerung: 'wachsend', ds2_nachfrage: 'sehr_stark', ds2_mietausfall: 'niedrig',
  ds2_marktmiete: '13,80', ds2_marktfaktor: '38', ds2_wertsteigerung: 'mittel', ds2_entwicklung: 'begrenzt',
  /* Haken ausdruecklich setzen: loadData uebernimmt sie nur, wenn der Schluessel da ist (sonst erbt das Objekt den des vorigen) */
  _erbpacht: false, _erb_wert_ist_erb: false, _me_inc_ze: false, _ek_ist_nk: false
};

/* ── B · Neubau-DHH, GmbH, Erbbaurecht, § 7b ───────────────────────── */
const B = {
  _name: 'Musterweg 3 Bielefeld', kuerzel: 'VOLL-B', dp_stufe: '3',
  thesis: 'Prüfobjekt N148 · Vollausstattung B (Neubau-DHH, GmbH, Erbbaurecht, § 7b)',
  notizen: 'Prüfobjekt N148 (11.11.2026): füllt die Felder, die in keinem Demo-Objekt vorkamen und sich mit Objekt A ausschließen. Anschrift, Namen und Vertragsnummern sind erfunden. Erzeugt mit tools/demo-vollausstattung.mjs.',
  risiken: 'Erbbaurecht: Zinsanpassung und Heimfall; Zeitmietvertrag endet 09/2031.',
  plz: '33619', ort: 'Bielefeld', str: 'Musterweg', hnr: '3', objart: 'DHH',
  wfl: '128', zimmer: '5', bad_anz: '2', etagen_ges: '2', einheiten: '1',
  baujahr: '2026', baustatus: 'neubau_erstbezug', standardstufe: '4', ausst: 'Gehoben',
  gsfl: '310', brw: '280', uk_flaeche: '1,04',
  makrolage: 'gut', mikrolage: 'gut', lageklasse: 'B',
  nutzungsart: 'kapitalanlage', vermstand: 'Vollvermietet', exitstr: 'Langfristig halten',
  halter: GMBH_ID, obj_herkunft: 'neukauf', grundsteuerwert: '248000',
  kaufdat: '2026-09-15', wirtschaftlicher_uebergang: '2026-10-01', wertermittlungsstichtag: '2026-09-15',
  /* Bautraegerkauf ohne Makler (NRW: GrESt 6,5 %) */
  kp: '470000', makler_p: '0', notar_p: '1,5', gba_p: '0,5', gest_p: '6,5', ji_p: '0',
  svwert: '480000', svw_herkunft: 'bank', bankval: '480000',
  /* Erbbaurecht */
  _erbpacht: true, _erb_wert_ist_erb: true /* die Bankbewertung ist schon der Wert des Erbbaurechts */, erbbauzins: '2600', erb_restlz: '99', erb_zs_ang: '4', erb_entsch: '66,7',
  /* § 7b und degressive AfA */
  afa_satz: '5.0_deg_wechsel', geb_ant: '100',
  afa_sonder7b_aktiv: true, afa_sonder7b_neubau: true, afa_sonder7b_vermietung: true, afa_sonder7b_eh40: true, afa_sonder7b_baukosten: true,
  /* Inventar: PV-Anlage und Kueche */
  inv_pv: '14000', inv_kueche: '9000', moebl: '23000', inv_tax_active: true, inv_tax_years: '10',
  /* Miete: Zeitmietvertrag (§ 575 Abs. 1 Nr. 3 BGB, spaeter Mitarbeiterwohnung) */
  nkm: '1650', ze: '50', umlagef: '280', leerstand: '2',
  mietstg: '2', wertstg: '1,5', kostenstg: '2', btj: '15', exit_bmy: '4,5',
  mv_art: 'zeitmiete', mv_beginn: '2026-10-01', mv_befristet_bis: '2031-09-30',
  hg_ul: '0', grundsteuer: '610', ul_sonst: '1800', hg_nul: '0', eigen_r: '1280', nul_sonst: '600',
  /* Darlehen I annuitaetisch, Darlehen II Tilgungsaussetzung mit Bausparvertrag */
  ek: '107600', bank_inst: 'Beispielbank AG',
  d1: '300000', d1z: '3,9', d1t: '2', d1_bindj: '10', d1_type: 'annuitaet', d1_verwendung: 'kauf',
  d1_auszahl: '10.2026', d1_vertrag: 'D1-0000-0042', d1_vertragsdatum: '28.08.2026',
  _d2_enabled: true, d2: '100000', d2z: '3,7', d2t: '0', d2_bindj: '10', d2_type: 'tilgungsaussetzung', d2_verwendung: 'kauf',
  d2_inst: 'Beispielbank AG', d2_auszahl: '10.2026', d2_vertrag: 'D2-0000-0042', d2_vertragsdatum: '28.08.2026',
  d2_bspar: 'BSV-0000-0042',
  ds2_zustand: 'neubau', ds2_energie: 'A+', ds2_bevoelkerung: 'stabil', ds2_nachfrage: 'stark', ds2_mietausfall: 'niedrig',
  ds2_marktmiete: '12,50', ds2_marktfaktor: '24', ds2_wertsteigerung: 'mittel', ds2_entwicklung: 'eine_starke',
  _d1_anschl_enable: false, _d2_anschl_enable: false, _me_inc_ze: false, _ek_ist_nk: false
};

const OBJEKTE = { A, B };

/* Schluessel, die collectData() ausserhalb von FIELDS schreibt (Haken) */
const EXTRA = ['_name', '_d2_enabled', '_d1_anschl_enable', '_d2_anschl_enable', '_erbpacht', '_erb_wert_ist_erb', '_me_inc_ze', '_ek_ist_nk'];

function feldPruefung() {
  const F = JSON.parse(fs.readFileSync(path.join(WURZEL, 'backend/src/generated/frontend-konstanten.json'), 'utf8')).daten.feld_ids;
  let rc = 0;
  for (const [k, o] of Object.entries(OBJEKTE)) {
    const fremd = Object.keys(o).filter((id) => !F.includes(id) && !EXTRA.includes(id));
    if (fremd.length) { rc = 1; console.log('  ' + k + ': NICHT in FIELDS (würde beim nächsten Speichern verworfen): ' + fremd.join(' ')); }
    else console.log('  ' + k + ': ' + Object.keys(o).length + ' Schlüssel, alle in FIELDS oder bekannte Haken');
    for (const id of ['weg_su', 'san_plan', 'zb_massnahmen']) if (o[id]) JSON.parse(o[id]);
  }
  return rc;
}

const z = (v) => { if (v == null || v === '') return 0; const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };

/* Grobe Gegenrechnung mit dem ECHTEN Kern (DealKpis.compute, Spiegel im Backend).
   Das ist nicht die Rechnung des Reiters (calc.js) - die misst nur die App selbst. */
function kpiPruefung() {
  const rk = require_(path.join(WURZEL, 'backend/src/services/rechenkerne.js'));
  for (const [k, o] of Object.entries(OBJEKTE)) {
    const kp = z(o.kp);
    const nk = kp * (z(o.makler_p) + z(o.notar_p) + z(o.gba_p) + z(o.gest_p) + z(o.ji_p)) / 100;
    const bwk_ul = z(o.hg_ul) + z(o.grundsteuer) + z(o.ul_sonst) + z(o.kp1) + z(o.kp2) + z(o.kp3) + z(o.kp4);
    const bwk_nul = z(o.hg_nul) + z(o.weg_r) + z(o.eigen_r) + z(o.nul_sonst) + (o._erbpacht ? z(o.erbbauzins) : 0);
    const e = { kp, nk, san: z(o.san), moebl: z(o.moebl), nkm: z(o.nkm), ze: z(o.ze), uf: z(o.umlagef),
      bwk_ul, bwk_nul, d1: z(o.d1), d1z: z(o.d1z), d1t: z(o.d1t), d2: z(o.d2), d2z: z(o.d2z), d2t: z(o.d2t),
      ek: z(o.ek), grenz: z(o.grenz), svw: z(o.svwert), svw_herkunft: o.svw_herkunft, bankval: z(o.bankval),
      leerstand_pct: z(o.leerstand), bspar_y: o.d1_type === 'tilgungsaussetzung' ? z(o.bspar_rate) * 12 : 0 };
    const r = rk.kpis(e);
    const bad = Object.entries(r).filter(([, v]) => typeof v === 'number' && !isFinite(v)).map(([n]) => n);
    const f2 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
    console.log('  ' + k + ': gi ' + f2(r.gi) + ' · bmy ' + f2(r.bmy) + ' % · nmy ' + f2(r.nmy) + ' % · cf_op ' + f2(r.cf_op)
      + ' · dscr ' + f2(r.dscr) + ' · ltv ' + f2(r.ltv) + (bad.length ? ' · NICHT ENDLICH: ' + bad.join(',') : ''));
    if (bad.length) return 1;
  }
  return 0;
}

async function anlegen(server, token, nur, aktualisieren) {
  const basis = SERVER[server];
  if (!basis) throw new Error('unbekannter Server ' + server);
  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const liste = await fetch(basis + '/api/v1/objects?limit=500', { headers: h }).then((r) => { if (!r.ok) throw new Error('GET /objects ' + r.status); return r.json(); });
  const vorhanden = new Set((liste.items || []).map((i) => i.kuerzel).filter(Boolean));
  console.log('  Konto hat ' + (liste.items || []).length + ' Objekte');
  for (const [k, o] of Object.entries(OBJEKTE)) {
    if (nur && nur !== k) continue;
    if (vorhanden.has(o.kuerzel)) {
      if (!aktualisieren) { console.log('  ' + k + ': ' + o.kuerzel + ' steht schon im Konto - skip (--aktualisieren schreibt den Stand dieses Skripts)'); continue; }
      const it = (liste.items || []).find((i) => i.kuerzel === o.kuerzel);
      const alt = await fetch(basis + '/api/v1/objects/' + it.id, { headers: h }).then((r) => r.json());
      const altD = typeof alt.data === 'string' ? JSON.parse(alt.data) : (alt.data || {});
      const neu = Object.assign({}, o, { _obj_seq: altD._obj_seq });
      const r = await fetch(basis + '/api/v1/objects/' + it.id, { method: 'PUT', headers: h, body: JSON.stringify({ data: neu }) });
      if (!r.ok) throw new Error(k + ': PUT ' + r.status);
      console.log('  ' + k + ': ' + o.kuerzel + ' aktualisiert (id ' + it.id + ', Nummer ' + altD._obj_seq + ')');
      continue;
    }
    const r = await fetch(basis + '/api/v1/objects', { method: 'POST', headers: h, body: JSON.stringify({ data: o }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(k + ': POST ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
    console.log('  ' + k + ': angelegt id ' + j.id + ' · Nummer ' + j.seq_no + ' · ' + j.name);
  }
}

const arg = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] == null ? true : m[2]] : [a, true]; }));
console.log('Feldprüfung:'); let rc = feldPruefung();
console.log('Kern DealKpis.compute():'); rc = kpiPruefung() || rc;
if (arg.anlegen) {
  if (rc) { console.log('Prüfung rot - nichts angelegt.'); process.exit(1); }
  const token = arg.token || process.env.DP_TOKEN;
  if (!token) { console.log('--token=<JWT> oder DP_TOKEN fehlt'); process.exit(1); }
  await anlegen(arg.server || 'staging', token, arg.nur, !!arg.aktualisieren);
}
process.exit(rc);
