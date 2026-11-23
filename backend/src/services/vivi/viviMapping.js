'use strict';
/* services/vivi/viviMapping.js — v3950 · Abbildung DealPilot <-> ViVi, reine Funktionen
 *
 * Keine Datenbank, kein Netz, kein DOM. Vorbild immometricaMapping.js. Geprueft von tools/vivi-pruefen.mjs
 * gegen die Schemas der Spezifikation (Dateien/Architektur/vivi/vivi-openapi-v1.json): jedes Feld, das hier
 * nach ViVi geht, steht dort im Request-Schema, und jedes Feld, das hier gelesen wird, im Resource-Schema.
 *
 *   nachVivi(daten, opt)       DealPilot-Objekt (objects.data) -> Plan fuer das einmalige Anlegen
 *                              { ok, fehlt[], hinweise[], projekt, einheiten[], darlehen[], vorschau[] }
 *   ausVivi(paket, kontext)    ViVi-Antworten -> { felder: { feldId: { wert, quelle } }, info }
 *   nkVorschlag(daten, i)      Nebenkosten-Vorauszahlung je Einheit (EUR/Monat): umlagefaehige Kosten / 12,
 *                              nach Wohnflaeche verteilt. Dieselbe Rechnung steht in frontend/js/nk-vorauszahlung.js
 *                              (Vorbelegung im Formular), der Pruefer haelt beide gleich.
 *
 * ViVi-Pflichtfelder (Spezifikation):
 *   POST /projects                       type, street, house_number, postal_code, city, purchase_price, purchase_date
 *   POST /projects/{p}/units             identifier
 *   POST /projects/{p}/rental-units      tenant_first_name, tenant_last_name, rent, monthly_utility_costs,
 *                                        rental_start, rent_due_day
 *   POST /projects/{p}/financings        name, financing_type, financing_start_date, financing_amount, interest_rate
 *
 * Kundentexte hier (hinweise, fehlt, vorschau) ohne Gedankenstrich und ohne Semikolon, keine Datenquellennamen.
 */

const OBJEKTTYP = Object.freeze({
  ETW: 'apartment',
  EFH: 'single_family_house', DHH: 'single_family_house', RH: 'single_family_house',
  ZFH: 'multi_family_house', MFH: 'multi_family_house',
  BUERO: 'commercial', GESCH: 'commercial', HOTEL: 'commercial', GEW: 'commercial',
  GRST: 'land', GAR: 'other'
});
const ARTEN_MIT_EINHEITEN = { MFH: 1, ZFH: 1, GESCH: 1, BUERO: 1, HOTEL: 1, GEW: 1 };   /* wie mfh-einheiten.js */
const VERTRAG_NACH_VIVI = { staffel: 'stepped_rent', index: 'indexed_rent' };
const VERTRAG_AUS_VIVI = { stepped_rent: 'staffel', indexed_rent: 'index' };
const UL_FELDER = ['hg_ul', 'grundsteuer', 'ul_sonst', 'kp1', 'kp2', 'kp3', 'kp4'];   /* wie calc.js und main.js V187 */
const FAELLIG_TAG = 3;
const NK_MIN_QM = 0.5;   /* v3953 · €/m² im Monat, darunter Hinweis „auffällig niedrig“ */
const MUSTER_ANSCHRIFT = Object.freeze({ street: 'Musterstraße', postal_code: '12345', city: 'Musterstadt' });   /* v3951 */

/* ── Zahlen und Daten ─────────────────────────────────────────────────── */
/* "50.000" -> 50000, "3,1" -> 3.1, "3.5" -> 3.5 (Punkt mit ein oder zwei Nachkommastellen ist ein Dezimalpunkt).
   Leer und Unsinn -> null (nie 0: Number(null) ist 0 und besteht isFinite). Wie DpDarlehenWeitere.zahl(). */
function zahl(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s|€|%/g, '');
  if (!s) return null;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function rund(n, st) { const f = Math.pow(10, st == null ? 2 : st); return Math.round(n * f) / f; }
function text(v) { return v == null ? '' : String(v).trim(); }
function isoDatum(v) {
  const s = text(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return null;
}
/* Darlehens-Auszahlung "05.2025" -> "2025-05-01" */
function monatDatum(v) {
  const s = text(v);
  const m = /^(\d{1,2})[./](\d{4})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return m[2] + '-' + ('0' + m[1]).slice(-2) + '-01';
  return isoDatum(s);
}
function deDatum(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(iso)); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
function eur(n) { return n == null ? '' : rund(n, 2).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; }

function art(daten) { return text(daten && daten.objart).toUpperCase(); }

/* Die Einheiten, die zaehlen: wie mfh-felder.js liste() (Flaeche, Miete oder Lage angegeben). */
function einheitenListe(daten) {
  if (!ARTEN_MIT_EINHEITEN[art(daten)]) return [];
  const m = daten && daten._mfh;
  if (!m || !Array.isArray(m.einheiten)) return [];
  const aus = [];
  m.einheiten.forEach(function (e, i) {
    if (!e || typeof e !== 'object') return;
    if ((zahl(e.wfl) || 0) > 0 || (zahl(e.ist) || 0) > 0 || text(e.lage)) aus.push({ e: e, index: i });
  });
  return aus;
}

/* Umlagefaehige Kosten im Jahr: dieselben Posten wie calc.js (ul = hg_ul + grundsteuer + ul_sonst + kp1..4).
   Sind sie leer, gilt das Monatsfeld umlagef x 12 (Reiter Miete). */
function ulJahr(daten) {
  let s = 0, hat = false;
  UL_FELDER.forEach(function (k) { const n = zahl(daten && daten[k]); if (n != null) { s += n; hat = true; } });
  if (hat && s > 0) return s;
  const m = zahl(daten && daten.umlagef);
  return m != null && m > 0 ? m * 12 : 0;
}

/**
 * Vorschlag Nebenkosten-Vorauszahlung je Monat. index = Position in _mfh.einheiten (null = ganzes Objekt).
 * Verteilt nach Wohnflaeche ueber alle Einheiten mit Flaeche (auch leere: die Kosten fallen trotzdem an).
 * Ohne Flaechen gleich verteilt. Gerundet auf ganze Euro. Kein Rechenkern: Cashflow und KPI rechnen weiter
 * mit den umlagefaehigen Kosten, dieses Feld ist ein Stammdatum.
 */
function nkVorschlag(daten, index) {
  const jahr = ulJahr(daten);
  if (!(jahr > 0)) return null;
  const L = einheitenListe(daten);
  if (index == null || !L.length) return Math.round(jahr / 12);
  const ziel = L.find(function (x) { return x.index === index; });
  if (!ziel) return null;
  const summe = L.reduce(function (a, x) { return a + (zahl(x.e.wfl) || 0); }, 0);
  const anteil = summe > 0 ? (zahl(ziel.e.wfl) || 0) / summe : 1 / L.length;
  return Math.round(jahr / 12 * anteil);
}

/* Mietername: vorhandenen Namen teilen, sonst Platzhalter "Mieter <Einheit>". */
function mieterName(roh, einheitName, platzhalter) {
  const s = text(roh);
  if (platzhalter || !s) return { vorname: 'Mieter', nachname: einheitName || 'Einheit', platzhalter: true };
  const teile = s.split(/\s+/);
  if (teile.length === 1) return { vorname: 'Mieter', nachname: teile[0], platzhalter: false };
  return { vorname: teile.slice(0, -1).join(' ').slice(0, 255), nachname: teile[teile.length - 1].slice(0, 255), platzhalter: false };
}

function etageText(v) {
  const s = text(v);
  if (!s) return null;
  const n = zahl(s);
  if (n == null) return s.slice(0, 255);
  if (n === 0) return 'EG';
  if (n < 0) return Math.abs(n) + '. UG';
  return n + '. OG';
}
function etageZahl(v) {
  const s = text(v);
  if (!s) return null;
  if (/^EG$/i.test(s)) return 0;
  let m = /^(\d+)\.?\s*OG$/i.exec(s); if (m) return +m[1];
  m = /^(\d+)\.?\s*UG$/i.exec(s); if (m) return -m[1];
  return null;
}

/* ══ DealPilot -> ViVi ═══════════════════════════════════════════════════ */
/**
 * @param daten  objects.data
 * @param opt    { platzhalterNamen: bool, faelligTag: 1..31, musterAnschrift: bool, musterNr: '1'..'99' }
 *
 * v3951 · musterAnschrift (Testbetrieb, solange 'vivi' Vorschau-Funktion ist): statt der Anschrift des Objekts geht
 * MUSTER_ANSCHRIFT an ViVi (Hausnummer musterNr, damit mehrere Demo-Objekte unterscheidbar bleiben). Die echte
 * Anschrift verlaesst DealPilot dann nie. ausVivi() liest die Anschrift einer so angelegten Verknuepfung nicht
 * zurueck (kontext.musterAnschrift), sonst stuende die Musteranschrift danach im DealPilot-Objekt.
 */
function nachVivi(daten, opt) {
  daten = daten || {};
  opt = opt || {};
  const fehlt = [], hinweise = [], vorschau = [];
  const zeige = function (bereich, feld, wert, notiz) { vorschau.push({ bereich: bereich, feld: feld, wert: wert, notiz: notiz || '' }); };
  const a = art(daten);

  /* Objekt */
  const typ = OBJEKTTYP[a] || 'other';
  if (!OBJEKTTYP[a]) hinweise.push('Objektart unbekannt, in ViVi als Sonstiges angelegt.');
  const kp = zahl(daten.kp);
  const kauf = isoDatum(daten.wirtschaftlicher_uebergang) || isoDatum(daten.kaufdat);
  const plz = text(daten.plz);
  if (!opt.musterAnschrift) {
    if (!text(daten.str)) fehlt.push({ feld: 'str', text: 'Straße fehlt' });
    if (!text(daten.hnr)) fehlt.push({ feld: 'hnr', text: 'Hausnummer fehlt' });
    if (!/^\d{5}$/.test(plz)) fehlt.push({ feld: 'plz', text: 'Postleitzahl fehlt oder ist nicht fünfstellig' });
    if (!text(daten.ort)) fehlt.push({ feld: 'ort', text: 'Ort fehlt' });
  }
  if (!(kp > 0)) fehlt.push({ feld: 'kp', text: 'Kaufpreis fehlt' });
  if (!kauf) fehlt.push({ feld: 'wirtschaftlicher_uebergang', text: 'Übergang von Nutzen und Lasten fehlt (Reiter Objekt)' });
  else if (!isoDatum(daten.wirtschaftlicher_uebergang)) hinweise.push('Übergang von Nutzen und Lasten fehlt, angesetzt ist das Kaufdatum ' + deDatum(kauf) + '.');

  const muster = !!opt.musterAnschrift;
  const projekt = {
    type: typ,
    street: muster ? MUSTER_ANSCHRIFT.street : text(daten.str).slice(0, 255),
    house_number: muster ? (text(opt.musterNr) || '1').slice(0, 255) : text(daten.hnr).slice(0, 255),
    postal_code: muster ? MUSTER_ANSCHRIFT.postal_code : plz,
    city: muster ? MUSTER_ANSCHRIFT.city : text(daten.ort).slice(0, 255),
    purchase_price: kp > 0 ? rund(kp) : 0,
    purchase_date: kauf || '',
    units: 1
  };
  const bj = zahl(daten.baujahr);
  if (bj != null && bj > 0) projekt.construction_year = Math.round(bj);
  const nk = [['broker', 'makler_p', 'Makler'], ['real_estate_transfer_tax', 'gest_p', 'Grunderwerbsteuer'],
    ['notary', 'notar_p', 'Notar'], ['land_register', 'gba_p', 'Grundbuch'], ['other_costs', 'ji_p', 'Sonstige Kaufnebenkosten']];
  zeige('Objekt', 'Objektart', typ);
  zeige('Objekt', 'Anschrift', [projekt.street, projekt.house_number].join(' ') + ', ' + projekt.postal_code + ' ' + projekt.city, muster ? 'Musteranschrift für den Testbetrieb. Die Anschrift des Objekts bleibt in DealPilot' : '');
  if (muster) hinweise.push('Testbetrieb: In ViVi steht eine Musteranschrift. DealPilot liest die Anschrift deshalb nicht aus ViVi zurück.');
  zeige('Objekt', 'Kaufpreis', eur(kp));
  zeige('Objekt', 'Übergang Nutzen und Lasten', deDatum(kauf));
  if (projekt.construction_year) zeige('Objekt', 'Baujahr', String(projekt.construction_year));
  nk.forEach(function (x) {
    const p = zahl(daten[x[1]]);
    if (kp > 0 && p != null && p > 0) { projekt[x[0]] = rund(kp * p / 100); zeige('Objekt', x[2], eur(projekt[x[0]]), String(p).replace('.', ',') + ' % vom Kaufpreis'); }
  });

  /* Einheiten und Mietverhaeltnisse */
  const einheiten = [];
  const mitListe = einheitenListe(daten);
  const faellig = Math.min(31, Math.max(1, Math.round(zahl(opt.faelligTag) || FAELLIG_TAG)));
  const leerMeldung = [];
  const nkNiedrig = [];
  function miete(e, name, qm, etage, ist, nkEigen, nkIndex, stp) {
    const n = mieterName(e.mv_mieter, name, !!opt.platzhalterNamen);
    const nkWert = zahl(nkEigen);
    const nkV = nkWert != null ? nkWert : nkVorschlag(daten, nkIndex);
    const beginn = isoDatum(e.mv_beginn) || kauf || '';
    const m = {
      tenant_first_name: n.vorname, tenant_last_name: n.nachname,
      rent: rund(ist), monthly_utility_costs: nkV != null ? rund(nkV) : 0,
      rental_start: beginn, rent_due_day: faellig,
      unit_identifier: name.slice(0, 255)
    };
    if (qm != null && qm > 0) m.unit_square_meters = rund(qm);
    if (etage) m.unit_floor = etage;
    const ende = isoDatum(e.mv_befristet_bis); if (ende) m.rental_end = ende;
    const kaution = zahl(e.mv_kaution); if (kaution != null && kaution > 0) m.deposit_amount = rund(kaution);
    const erh = isoDatum(e.mv_letzte_erhoehung); if (erh) m.last_rent_increase = erh;
    const ct = VERTRAG_NACH_VIVI[text(e.mv_art)]; if (ct) m.contract_type = ct;
    if (stp != null && stp > 0) m.amenities = [{ type: 'parking_space', description: 'Stellplatz', monthly_rent: rund(stp) }];
    const notizen = [];
    if (n.platzhalter) notizen.push('Mietername als Platzhalter');
    if (nkWert == null) notizen.push(nkV != null ? 'Nebenkosten aus den umlagefähigen Kosten abgeleitet, bitte prüfen' : 'Nebenkosten unbekannt, mit 0 € angesetzt');
    /* v3953 · unter 0,50 €/m² im Monat ist ein abgeleiteter Abschlag fast sicher zu niedrig (2026-1053/1055: 3 bis 4 €) */
    if (nkWert == null && nkV != null && qm > 0 && nkV / qm < NK_MIN_QM) { notizen.push('nur ' + String(rund(nkV / qm, 2)).replace('.', ',') + ' €/m², auffällig niedrig'); nkNiedrig.push(name); }
    if (!isoDatum(e.mv_beginn)) notizen.push(kauf ? 'Mietbeginn fehlt, angesetzt ist der Übergang' : 'Mietbeginn fehlt');
    if (!beginn) fehlt.push({ feld: 'mv_beginn', text: 'Mietbeginn fehlt bei ' + name });
    if (!(qm > 0)) fehlt.push({ feld: 'wfl', text: 'Wohnfläche fehlt bei ' + name });
    zeige('Mietverhältnis', name, eur(ist) + ' kalt, ' + eur(m.monthly_utility_costs) + ' Nebenkosten, ab ' + deDatum(beginn), notizen.join('. '));
    return m;
  }

  if (mitListe.length) {
    mitListe.forEach(function (x, k) {
      const e = x.e;
      const gew = text(e.art) === 'gewerbe';
      const nr = text(e.nr) || String(x.index + 1);
      const name = (gew ? 'GE ' : 'WE ') + nr + (text(e.lage) ? ' · ' + text(e.lage) : '');
      const qm = zahl(e.wfl);
      const etage = etageText(e.etage) || (text(e.lage) ? text(e.lage).slice(0, 255) : null);
      const ist = zahl(e.ist);
      const vermietet = text(e.status) !== 'leer' && ist != null && ist > 0;
      const eintrag = { schluessel: 'e' + x.index, index: x.index, nr: nr, name: name, vermietet: vermietet,
        einheit: { identifier: name.slice(0, 255), unit_type: 'residential' } };
      if (qm != null && qm > 0) eintrag.einheit.square_meters = rund(qm);
      if (etage) eintrag.einheit.floor = etage;
      if (vermietet) eintrag.miete = miete(e, name, qm, etage, ist, e.nk_vorauszahlung, x.index, zahl(e.stellplatz_miete));
      else { leerMeldung.push(name); zeige('Einheit', name, (qm ? String(qm).replace('.', ',') + ' m²' : 'ohne Fläche') + ', leer'); }
      einheiten.push(eintrag);
    });
  } else {
    const name = a === 'ETW' ? 'Wohnung' : (OBJEKTTYP[a] === 'commercial' ? 'Gewerbeeinheit' : (a === 'GRST' ? 'Grundstück' : 'Haus'));
    const qm = zahl(daten.wfl);
    const etage = a === 'ETW' ? etageText(daten.etage) : null;
    const ist = zahl(daten.nkm);
    const vermietet = text(daten.nutzungsart) !== 'eigennutzung' && text(daten.vermstand) !== 'Leer' && ist != null && ist > 0;
    const eintrag = { schluessel: 'e0', index: null, nr: '1', name: name, vermietet: vermietet,
      einheit: { identifier: name, unit_type: 'residential' } };
    if (qm != null && qm > 0) eintrag.einheit.square_meters = rund(qm);
    if (etage) eintrag.einheit.floor = etage;
    if (vermietet) eintrag.miete = miete(daten, name, qm, etage, ist, daten.nk_vorauszahlung, null, zahl(daten.ze_stp_monat));
    else zeige('Einheit', name, (qm ? String(qm).replace('.', ',') + ' m²' : 'ohne Fläche') + (text(daten.nutzungsart) === 'eigennutzung' ? ', selbst genutzt' : ', leer'));
    if (a === 'ZFH' || a === 'MFH') hinweise.push('Keine Einheiten erfasst. Übertragen wird eine Einheit für das ganze Haus. Genauer wird es mit den Einheiten im Reiter Objekt.');
    einheiten.push(eintrag);
  }
  /* v3997 · F19 Gesamt-Flow, Marcel 23.11.2026: Stellplaetze nie als eigene Nebeneinheit, sondern beim Mieter
     (amenities am Mietverhaeltnis). Eine Stellplatzmiete nur am Objekt (ze_stp_monat) gehoert keinem Mieter und geht
     deshalb nicht mit, das sagt der Hinweis. */
  const stpObjekt = zahl(daten.ze_stp_monat);
  if (mitListe.length && stpObjekt != null && stpObjekt > 0 && !mitListe.some(function (x) { return zahl(x.e.stellplatz_miete) > 0; })) {
    hinweise.push('Die Stellplatzmiete von ' + eur(stpObjekt) + ' im Monat ist keinem Mieter zugeordnet und geht nicht mit. Trag sie in der Einheitentabelle bei der Wohnung ein, zu der der Stellplatz gehört.');
  }
  if (nkNiedrig.length) hinweise.push('Die abgeleitete Nebenkosten-Vorauszahlung ist auffällig niedrig bei ' + nkNiedrig.join(', ') + '. Bitte vor dem Anlegen die Vorauszahlung je Einheit eintragen.');
  /* v3953 · ViVi legt mit dem Objekt immer eine Einheit an (units, Minimum 1). Ihren Namen und ihre Flaeche setzt nur ein
     Mietverhaeltnis. v3965: ist keine Einheit vermietet, benennt viviDienst.anlegen() sie einmal per PATCH. */
  if (einheiten.some(function (x) { return x.miete; })) hinweise.push('ViVi legt ab Mietbeginn die Sollstellungen an und markiert die Monate bis heute als bezahlt.');
  if (einheiten.some(function (x) { return x.miete && x.miete.tenant_first_name === 'Mieter'; })) hinweise.push('Wo kein Mietername erfasst ist, steht in ViVi ein Platzhalter. Den echten Namen trägst du in ViVi ein.');

  /* Darlehen */
  const darlehen = [];
  function darl(schluessel, bez, betrag, zins, tilg, bindj, start, bank, tilgAus, typ) {
    if (!(betrag > 0)) return;
    const z = zins != null ? zins : null;
    if (z == null) { fehlt.push({ feld: schluessel + 'z', text: 'Zinssatz fehlt bei ' + bez }); }
    if (z != null && (z < 0 || z > 100)) fehlt.push({ feld: schluessel + 'z', text: 'Zinssatz bei ' + bez + ' ist kein Prozentwert' });
    const b = {
      name: (bez + (text(bank) ? ' ' + text(bank) : '')).slice(0, 255),
      financing_type: typ,
      financing_start_date: start || kauf || '',
      financing_amount: rund(betrag),
      interest_rate: z != null ? rund(z, 3) : 0
    };
    if (text(bank)) b.bank_name = text(bank).slice(0, 255);
    if (tilgAus) b.is_repayment_substitute = true;
    else if (tilg != null && tilg >= 0 && tilg <= 100) b.initial_repayment = rund(tilg, 3);
    if (bindj != null && bindj >= 0 && bindj <= 30) b.fixed_interest_period = Math.round(bindj);
    if (!start && kauf) hinweise.push('Beginn von ' + bez + ' fehlt, angesetzt ist der Übergang.');
    darlehen.push({ schluessel: schluessel, body: b });
    zeige('Darlehen', bez, eur(betrag) + ', ' + String(b.interest_rate).replace('.', ',') + ' % Zins' + (b.initial_repayment != null ? ', ' + String(b.initial_repayment).replace('.', ',') + ' % Tilgung' : '') + (tilgAus ? ', Tilgungsersatz' : ''), b.fixed_interest_period != null ? 'Zinsbindung ' + b.fixed_interest_period + ' Jahre' : '');
  }
  darl('d1', 'Darlehen I', zahl(daten.d1), zahl(daten.d1z), zahl(daten.d1t), zahl(daten.d1_bindj), monatDatum(daten.d1_auszahl), daten.bank_inst, text(daten.d1_type) === 'tilgungsaussetzung', 'primary');
  darl('d2', 'Darlehen II', zahl(daten.d2), zahl(daten.d2z), zahl(daten.d2t), zahl(daten.d2_bindj), monatDatum(daten.d2_auszahl), daten.d2_inst, text(daten.d2_type) === 'tilgungsaussetzung', 'parallel');
  let weitere = daten.darlehen_weitere;
  if (typeof weitere === 'string') { try { weitere = weitere.trim() ? JSON.parse(weitere) : []; } catch (e) { weitere = []; } }
  if (Array.isArray(weitere)) {
    const kaufJahr = kauf ? +kauf.slice(0, 4) : null;
    weitere.forEach(function (w, i) {
      if (!w || typeof w !== 'object') return;
      const sj = zahl(w.start_jahr);
      const start = sj && kaufJahr && sj > kaufJahr ? Math.round(sj) + '-01-01' : null;
      darl('w' + i, text(w.bez) || ('Darlehen ' + (i + 3)), zahl(w.betrag), zahl(w.zins), zahl(w.tilg), zahl(w.bindj), start, w.bank, text(w.art) === 'tilgungsaussetzung', 'parallel');
    });
  }

  return { ok: fehlt.length === 0, fehlt: fehlt, hinweise: hinweise, projekt: projekt, einheiten: einheiten, darlehen: darlehen, vorschau: vorschau };
}

/* ══ ViVi -> DealPilot ═══════════════════════════════════════════════════ */
function heuteIso(jetzt) { return new Date(jetzt == null ? Date.now() : jetzt).toISOString().slice(0, 10); }
function laufend(r, heute) {
  if (!r || typeof r !== 'object') return false;
  if (r.occupancy_type && r.occupancy_type !== 'rented') return false;
  const ende = isoDatum(r.rental_end);
  const beginn = isoDatum(r.rental_start);
  if (ende && ende < heute) return false;
  if (beginn && beginn > heute) return false;
  return true;
}
function stellplatzMiete(r) {
  const L = Array.isArray(r && r.amenities) ? r.amenities : [];
  let s = 0, hat = false;
  L.forEach(function (x) { if (x && (x.type === 'parking_space' || x.type === 'garage')) { const n = zahl(x.monthly_rent); if (n != null) { s += n; hat = true; } } });
  return hat ? rund(s) : null;
}
/* v3966 · letzte Mieterhoehung (Kaltmiete). verlauf = data von GET …/rental-units/{id}/rent-history oder null.
   Aus dem Verlauf: letzte wirksame Aenderung bis heute mit new_rent > previous_rent. Ohne solche Aenderung gilt
   last_rent_increase, aber nicht, wenn es der Mietbeginn ist oder der Tag einer reinen NK-Anpassung. */
function letzteErhoehung(r, verlauf, heute) {
  const L = verlauf && Array.isArray(verlauf.rent_changes) ? verlauf.rent_changes : [];
  const nurNk = {};
  let best = null;
  L.forEach(function (c) {
    if (!c || (c.status && c.status !== 'active')) return;
    const d = isoDatum(c.effective_date); if (!d || d > heute) return;
    const alt = zahl(c.previous_rent), neu = zahl(c.new_rent);
    if (alt != null && neu != null && neu > alt) { if (!best || d > best) best = d; }
    else if (alt != null && neu != null && neu === alt) nurNk[d] = true;
  });
  if (best) return best;
  const e = isoDatum(r && r.last_rent_increase);
  if (!e || e === isoDatum(r && r.rental_start) || nurNk[e]) return null;
  return e;
}
/* v3981 · F8 Gesamt-Flow 22.11.2026: der Abruf setzte das Datum der letzten Erhöhung (01.11.2026), der Betrag blieb
   der alte (45 € statt 25 €). Der Jahresabgleich rechnete damit 520 − 45 = 475 € als Vorjahresmiete (2025: 5.700
   statt 5.940 €). Betrag = neue minus bisherige Kaltmiete der Änderung an genau diesem Tag (Mietverlauf). Ohne
   Mietverlauf ist der Betrag unbekannt: dann leer (der alte Betrag gehört nicht zum neuen Datum). */
function erhoehungBetrag(verlauf, datum) {
  const L = verlauf && Array.isArray(verlauf.rent_changes) ? verlauf.rent_changes : [];
  let b = null;
  L.forEach(function (c) {
    if (!c || (c.status && c.status !== 'active') || isoDatum(c.effective_date) !== datum) return;
    const alt = zahl(c.previous_rent), neu = zahl(c.new_rent);
    if (alt != null && neu != null && neu > alt) b = Math.round((neu - alt) * 100) / 100;
  });
  return b;
}
function monatJahr(iso) { const m = /^(\d{4})-(\d{2})/.exec(text(iso)); return m ? m[2] + '.' + m[1] : null; }

/**
 * @param paket    { projekt, einheiten[], mietverhaeltnisse[], darlehen[], tilgungsplan, mietverlauf: { rentalId: rent-history } (v3966) }
 * @param kontext  { vivi_ids, mitEinheiten (bool), objart, jetzt, musterAnschrift (bool, v3951) }
 * @returns { felder: { id: { wert, quelle } }, info: { restschuld_heute, darlehen_weitere[] } }
 */
function ausVivi(paket, kontext) {
  paket = paket || {}; kontext = kontext || {};
  const ids = kontext.vivi_ids || {};
  const heute = heuteIso(kontext.jetzt);
  const felder = {};
  const setze = function (id, wert, quelle) { if (wert === null || wert === undefined || wert === '') return; felder[id] = { wert: wert, quelle: quelle }; };
  const p = paket.projekt || {};
  const pq = 'projects/' + (p.id == null ? '' : p.id);

  /* v3951 · Testbetrieb mit Musteranschrift: die Anschrift in ViVi ist nicht die des Objekts, also nicht zuruecklesen */
  if (!kontext.musterAnschrift) {
    setze('str', text(p.street), pq);
    setze('hnr', text(p.house_number), pq);
    setze('plz', text(p.postal_code), pq);
    setze('ort', text(p.city), pq);
  }
  if (p.construction_year != null && +p.construction_year > 0) setze('baujahr', String(p.construction_year), pq);
  setze('wirtschaftlicher_uebergang', isoDatum(p.purchase_date), pq);
  const kp = zahl(p.purchase_price);
  if (kp != null && kp > 0) {
    setze('kp', rund(kp), pq);
    [['broker', 'makler_p'], ['real_estate_transfer_tax', 'gest_p'], ['notary', 'notar_p'], ['land_register', 'gba_p'], ['other_costs', 'ji_p']].forEach(function (x) {
      const b = zahl(p[x[0]]); if (b != null && b > 0) setze(x[1], rund(b / kp * 100, 2), pq);
    });
  }

  /* Einheiten: zuerst ueber die beim Anlegen gemerkten IDs, sonst in ViVi-Reihenfolge (zugeordnete Objekte) */
  const units = Array.isArray(paket.einheiten) ? paket.einheiten.filter(function (u) { return u && u.unit_type !== 'ancillary'; }) : [];
  const rentals = Array.isArray(paket.mietverhaeltnisse) ? paket.mietverhaeltnisse : [];
  const zuordnung = [];   // [{ unit, praefix }]
  const gemerkt = ids.einheiten && typeof ids.einheiten === 'object' ? ids.einheiten : {};
  if (kontext.mitEinheiten) {
    const keys = Object.keys(gemerkt);
    if (keys.length) {
      keys.forEach(function (k) {
        const g = gemerkt[k]; if (!g || g.index == null) return;
        const u = units.find(function (x) { return String(x.id) === String(g.unit_id); });
        if (u) zuordnung.push({ unit: u, praefix: 'einheit.' + g.index + '.', index: g.index, nr: g.nr == null ? null : String(g.nr) });
      });
    } else units.forEach(function (u, i) { zuordnung.push({ unit: u, praefix: 'einheit.' + i + '.', index: i, nr: null }); });
  } else {
    const g = gemerkt.e0;
    const u = (g && units.find(function (x) { return String(x.id) === String(g.unit_id); })) || units[0];
    if (u) zuordnung.push({ unit: u, praefix: '' });
  }
  const einheitenInfo = {};
  zuordnung.forEach(function (z) {
    const u = z.unit, q = 'units/' + u.id, P = z.praefix;
    if (P) einheitenInfo[z.index] = { nr: z.nr, name: text(u.identifier) };
    const r = rentals.filter(function (x) { return String(x.unit_id) === String(u.id) && laufend(x, heute); })[0] || null;
    const rq = r ? 'rental-units/' + r.id : q;
    const qm = zahl(u.square_meters);
    if (P) {
      if (qm != null && qm > 0) setze(P + 'wfl', rund(qm), q);
      setze(P + 'status', r ? 'vermietet' : 'leer', rq);
      if (r) {
        const ist = zahl(r.rent); if (ist != null) setze(P + 'ist', rund(ist), rq);
      }
    } else {
      if (qm != null && qm > 0) setze('wfl', rund(qm), q);
      if (String(kontext.objart || '').toUpperCase() === 'ETW') { const et = etageZahl(u.floor); if (et != null) setze('etage', String(et), q); }
      if (r) { const ist = zahl(r.rent); if (ist != null) setze('nkm', rund(ist), rq); }
    }
    if (!r) return;
    const nk = zahl(r.monthly_utility_costs); if (nk != null) setze(P + 'nk_vorauszahlung', rund(nk), rq);
    setze(P + 'mv_beginn', isoDatum(r.rental_start), rq);
    setze(P + 'mv_befristet_bis', isoDatum(r.rental_end), rq);
    /* Kaution gibt es in DealPilot nur je Wohnung (_mfh), nicht am Einzelobjekt */
    const kaution = zahl(r.deposit_amount); if (P && kaution != null && kaution > 0) setze(P + 'mv_kaution', rund(kaution), rq);
    /* v3953 · ViVi setzt last_rent_increase beim Anlegen ohne Angabe auf den Mietbeginn (gemessen 22.11.2026 am
       Testkonto, 2026-001, 1158, 1053 WE 5, 1055 GE 1). Das ist keine Erhoehung, also nicht zuruecklesen.
       v3966 · ViVi setzt es auch bei einer reinen NK-Anpassung (gemessen 2026-001, 1041 WE 1). Deshalb zaehlt der
       Mietverlauf (rent-history), wenn er da ist: letzte wirksame Aenderung mit hoeherer Kaltmiete. */
    const erh = letzteErhoehung(r, paket.mietverlauf && paket.mietverlauf[r.id], heute);
    if (erh) {
      setze(P + 'mv_letzte_erhoehung', erh, rq);
      const eb = erhoehungBetrag(paket.mietverlauf && paket.mietverlauf[r.id], erh);   /* v3981 · F8 */
      if (eb != null) setze(P + 'mv_letzte_erhoehung_betrag', rund(eb), rq);
      else felder[P + 'mv_letzte_erhoehung_betrag'] = { wert: '', quelle: rq };   /* unbekannt: leer, nie der alte Betrag */
    }
    const va = VERTRAG_AUS_VIVI[text(r.contract_type)]; if (va) setze(P + 'mv_art', va, rq);
    const stp = stellplatzMiete(r); if (stp != null) setze(P ? P + 'stellplatz_miete' : 'ze_stp_monat', stp, rq);
  });

  /* Darlehen: gemerkte IDs d1/d2, sonst nach Beginn sortiert (Anschlussfinanzierungen nicht als eigenes Darlehen) */
  const fin = Array.isArray(paket.darlehen) ? paket.darlehen.filter(function (f) { return f && !f.is_savings_plan; }) : [];
  const gd = ids.darlehen && typeof ids.darlehen === 'object' ? ids.darlehen : {};
  let d1 = gd.d1 != null ? fin.find(function (f) { return String(f.id) === String(gd.d1); }) : null;
  let d2 = gd.d2 != null ? fin.find(function (f) { return String(f.id) === String(gd.d2); }) : null;
  if (!Object.keys(gd).length) {
    const sortiert = fin.filter(function (f) { return f.financing_type !== 'follow_up'; })
      .sort(function (x, y) { return String(x.financing_start_date || '').localeCompare(String(y.financing_start_date || '')); });
    d1 = sortiert[0] || null; d2 = sortiert[1] || null;
  }
  [['d1', d1, 'bank_inst'], ['d2', d2, 'd2_inst']].forEach(function (x) {
    const f = x[1]; if (!f) return;
    const k = x[0], q = 'financings/' + f.id;
    const betrag = zahl(f.financing_amount), zins = zahl(f.interest_rate);
    if (betrag != null && betrag > 0) setze(k, rund(betrag), q);
    if (zins != null) setze(k + 'z', rund(zins, 3), q);
    let tilg = zahl(f.initial_repayment);
    const rate = zahl(f.fixed_monthly_rate);
    if ((tilg == null || tilg === 0) && rate != null && rate > 0 && betrag > 0 && zins != null) tilg = rund(rate * 12 / betrag * 100 - zins, 3);
    if (tilg != null && !f.is_repayment_substitute) setze(k + 't', rund(tilg, 3), q);
    let bind = zahl(f.fixed_interest_period);
    if (bind == null && isoDatum(f.fixed_interest_end_date) && isoDatum(f.financing_start_date)) {
      bind = Math.round((new Date(isoDatum(f.fixed_interest_end_date)) - new Date(isoDatum(f.financing_start_date))) / (365.25 * 24 * 3600 * 1000));
    }
    if (bind != null) setze(k + '_bindj', String(bind), q);
    setze(x[2], text(f.bank_name), q);
    setze(k + '_auszahl', monatJahr(f.financing_start_date), q);
  });

  /* Gegenprobe: Restschuld heute aus dem Tilgungsplan (kein Eingabefeld, nur Vergleich zu calc.js) */
  const info = { restschuld_heute: null, darlehen_weitere: [], einheiten: einheitenInfo };
  const plan = paket.tilgungsplan && Array.isArray(paket.tilgungsplan.data) ? paket.tilgungsplan.data : [];
  const bisHeute = plan.filter(function (z) { return isoDatum(z.date) && isoDatum(z.date) <= heute; });
  if (bisHeute.length) {
    const nachDatum = {};
    bisHeute.forEach(function (z) { nachDatum[isoDatum(z.date)] = (nachDatum[isoDatum(z.date)] || 0) + (zahl(z.remaining_debt_after) || 0); });
    const letzt = Object.keys(nachDatum).sort().pop();
    info.restschuld_heute = { wert: rund(nachDatum[letzt]), stand: letzt };
    /* v3966 · Sondertilgungen nach dem letzten Planmonat bis heute stehen erst im naechsten Planmonat. Gemessen
       2026-1157: Sondertilgung 15.11., Plan bis 31.10. Sie werden hier abgezogen und ausgewiesen. */
    let st = 0;
    fin.forEach(function (f) { (Array.isArray(f.special_repayments) ? f.special_repayments : []).forEach(function (x) {
      const d = isoDatum(x && x.date); const b = zahl(x && x.amount); if (d && d > letzt && d <= heute && b > 0) st += b; }); });
    if (st > 0) { info.restschuld_heute.wert = rund(info.restschuld_heute.wert - st); info.restschuld_heute.sondertilgung = rund(st); }
  }
  info.sondertilgungen = [];
  fin.forEach(function (f) { (Array.isArray(f.special_repayments) ? f.special_repayments : []).forEach(function (x) {
    const d = isoDatum(x && x.date), b = zahl(x && x.amount); if (d && b > 0) info.sondertilgungen.push({ darlehen: f === d1 ? 'd1' : (f === d2 ? 'd2' : String(f.id)), datum: d, betrag: rund(b) }); }); });
  fin.forEach(function (f) { if (f !== d1 && f !== d2) info.darlehen_weitere.push({ id: f.id, name: f.name, betrag: zahl(f.financing_amount), zins: zahl(f.interest_rate) }); });
  return { felder: felder, info: info };
}

module.exports = {
  nachVivi, ausVivi, letzteErhoehung, erhoehungBetrag, nkVorschlag, ulJahr, einheitenListe, zahl, isoDatum, monatDatum, etageText, etageZahl, mieterName,
  NK_MIN_QM, OBJEKTTYP, VERTRAG_NACH_VIVI, VERTRAG_AUS_VIVI, UL_FELDER, ARTEN_MIT_EINHEITEN, MUSTER_ANSCHRIFT
};
