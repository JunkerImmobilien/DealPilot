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
const ARTEN_MIT_EINHEITEN = { MFH: 1, ZFH: 1, GESCH: 1, BUERO: 1, HOTEL: 1, GEW: 1 };
const ART_WORT = { ETW: 'Wohnung', EFH: 'Einfamilienhaus', DHH: 'Einfamilienhaus', RH: 'Einfamilienhaus', ZFH: 'Mehrfamilienhaus', MFH: 'Mehrfamilienhaus',
  BUERO: 'Gewerbe', GESCH: 'Gewerbe', HOTEL: 'Gewerbe', GEW: 'Gewerbe', GRST: 'Grundstück', GAR: 'Objekt' };   /* v4050 · Anzeigename in ViVi */   /* wie mfh-einheiten.js */
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
/* ── v4210 · Mietverlauf beim Anlegen (Befund B2/B3, Fork M 23.11.2026 an 2026-1188) ─────────────
   Bis v4209 ging je Einheit nur der heutige Vertrag mit der heutigen Miete ab Mietbeginn nach ViVi: Einheit 1 stand dort
   mit 560 € seit 2014, eine heute leere Einheit ohne ihr frueheres Mietverhaeltnis. ViVis Mietverlauf war damit fuer jedes
   vergangene Jahr falsch, und der Jahresabgleich nahm ihn als Ist. Jetzt geht mit, was DealPilot weiss:
     · fruehere Vertraege (e.mv_historie, mfh-einheiten.js v3160) als rental_type past mit rental_end, sofern sie nach dem
       Uebergang endeten (Ende = abgelegt_am, hoechstens der Tag vor dem naechsten Vertrag)
     · je Vertrag die Anfangsmiete und die Mieterhoehungen der Liste (e.erhoehungen bzw. _erhoehungen, mieterhoehungen.js)
       als Mietaenderungen mit Stichtag (POST …/rent-changes, dieselbe freigegebene Methode wie v4037)
   Geht die Kette nicht auf (letzte Erhoehung endet nicht bei der Miete des Vertrags), bleibt es beim Stand bis v4209:
   heutige Miete ab Mietbeginn, mit Hinweis. Lieber ein bekannter Fehler als ein erfundener Verlauf. */
const ANPASSUNG_ART = { '558': ['increase', '§ 558 BGB'], '559': ['modernization', '§ 559 BGB'], staffel: ['stepped_rent', '§ 557a BGB'], index: ['index_adjustment', '§ 557b BGB'] };
function tagDavor(iso) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
function erhoehungenSortiert(liste) {
  return (Array.isArray(liste) ? liste : []).filter(function (x) { return x && isoDatum(x.datum) && zahl(x.auf) != null && zahl(x.auf) > 0; })
    .map(function (x) { return { datum: isoDatum(x.datum), von: zahl(x.von), auf: zahl(x.auf), art: text(x.art) }; })
    .sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });
}
/** Ein Vertrag: Anfangsmiete und Aenderungen zwischen start und ende (ohne Neuvermietung, die ist der Vertragsbeginn).
    endMiete = Miete am Vertragsende (heute bzw. beim Ablegen). null, wenn die Kette nicht aufgeht. */
function vertragsKette(erh, start, ende, endMiete) {
  const L = erh.filter(function (x) { return x.art !== 'neuvermietung' && x.datum > start && (!ende || x.datum <= ende); });
  if (!L.length) return { anfang: endMiete, aenderungen: [] };
  const anfang = L[0].von != null && L[0].von > 0 ? L[0].von : null;
  if (anfang == null) return null;
  const letzte = L[L.length - 1].auf;
  if (endMiete != null && Math.abs(letzte - endMiete) > 0.5) return null;
  return { anfang: anfang, aenderungen: L.map(function (x) {
    const a = ANPASSUNG_ART[x.art] || [x.von != null && x.auf < x.von ? 'decrease' : 'increase', null];
    const r = { effective_date: x.datum, adjustment_type: a[0], new_rent: rund(x.auf), adjustment_reason: 'Aus DealPilot übernommen (Mieterhöhung vom ' + deDatum(x.datum) + ')' };
    if (a[1]) r.legal_basis = a[1];
    return r;
  }) };
}

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
  /* v4050 · Marcel 23.11.2026: „die Schnittstelle so voll wie möglich befüllen“. Anzeigename wie bei der Umbenennung
     vom 23.11.2026 (Ort - Straße Nr - Art), sonst bildet ViVi ihn selbst. Nicht im Testbetrieb mit Musteranschrift. */
  if (!muster && text(daten.ort) && text(daten.str)) projekt.name = (text(daten.ort) + ' - ' + text(daten.str) + ' ' + text(daten.hnr) + ' - ' + (ART_WORT[a] || 'Objekt')).replace(/\s+/g, ' ').trim().slice(0, 255);
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
  function miete(e, name, qm, etage, ist, nkEigen, nkIndex, stp, zielQm, erhListe) {
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
    /* v4210 · Anfangsmiete und Erhoehungen dieses Vertrags (siehe vertragsKette) */
    const kette = beginn ? vertragsKette(erhoehungenSortiert(erhListe), beginn, null, ist) : { aenderungen: [] };
    if (kette && kette.aenderungen.length) { m.rent = rund(kette.anfang); m.aenderungen = kette.aenderungen; }
    else if (!kette) hinweise.push('Bei ' + name + ' passen die Mieterhöhungen nicht zur heutigen Miete. In ViVi steht die heutige Miete ab Mietbeginn.');
    /* v4050 · Zielmiete (Zielbild €/m² × Fläche) als target_rent, in ViVi rein informativ */
    const zq = zahl(zielQm); if (zq != null && zq > 0 && qm > 0 && zq * qm > ist) m.target_rent = rund(zq * qm);
    if (stp != null && stp > 0) m.amenities = [{ type: 'parking_space', description: 'Stellplatz', monthly_rent: rund(stp) }];
    const notizen = [];
    if (n.platzhalter) notizen.push('Mietername als Platzhalter');
    if (nkWert == null) notizen.push(nkV != null ? 'Nebenkosten aus den umlagefähigen Kosten abgeleitet, bitte prüfen' : 'Nebenkosten unbekannt, mit 0 € angesetzt');
    /* v3953 · unter 0,50 €/m² im Monat ist ein abgeleiteter Abschlag fast sicher zu niedrig (2026-1053/1055: 3 bis 4 €) */
    if (nkWert == null && nkV != null && qm > 0 && nkV / qm < NK_MIN_QM) { notizen.push('nur ' + String(rund(nkV / qm, 2)).replace('.', ',') + ' €/m², auffällig niedrig'); nkNiedrig.push(name); }
    if (!isoDatum(e.mv_beginn)) notizen.push(kauf ? 'Mietbeginn fehlt, angesetzt ist der Übergang' : 'Mietbeginn fehlt');
    if (!beginn) fehlt.push({ feld: 'mv_beginn', text: 'Mietbeginn fehlt bei ' + name });
    if (!(qm > 0)) fehlt.push({ feld: 'wfl', text: 'Wohnfläche fehlt bei ' + name });
    /* v4034 · Demo-Durchlauf 23.11.2026: der Stellplatz ging als amenity mit, die Vorschau nannte ihn nicht */
    const stpText = (stp != null && stp > 0) ? ', Stellplatz ' + eur(rund(stp)) : '';
    if (m.aenderungen) notizen.push('Anfangsmiete ' + eur(m.rent) + ', dann ' + m.aenderungen.length + (m.aenderungen.length === 1 ? ' Mieterhöhung' : ' Mieterhöhungen'));
    zeige('Mietverhältnis', name, eur(ist) + ' kalt' + stpText + ', ' + eur(m.monthly_utility_costs) + ' Nebenkosten, ab ' + deDatum(beginn), notizen.join('. '));
    return m;
  }

  /* v4210 · fruehere Vertraege einer Einheit (e.mv_historie, neuester zuerst) als vergangene Mietverhaeltnisse nach ViVi,
     soweit sie nach dem Uebergang endeten. naechsterBeginn = Beginn des heutigen Vertrags (null bei Leerstand). */
  function fruehere(e, name, qm, etage, erhListe, naechsterBeginn) {
    const H = (Array.isArray(e.mv_historie) ? e.mv_historie : []).filter(function (h) { return h && isoDatum(h.mv_beginn); })
      .slice().sort(function (a, b) { return isoDatum(a.mv_beginn) < isoDatum(b.mv_beginn) ? -1 : 1; });
    const erh = erhoehungenSortiert(erhListe), aus = [];
    H.forEach(function (h, i) {
      const start = isoDatum(h.mv_beginn);
      const nb = i + 1 < H.length ? isoDatum(H[i + 1].mv_beginn) : naechsterBeginn;
      let ende = isoDatum(h.abgelegt_am);
      if (nb && (!ende || ende >= nb)) ende = tagDavor(nb);
      if (!ende || ende < start) { hinweise.push('Ein früherer Vertrag bei ' + name + ' hat kein Ende und geht nicht nach ViVi.'); return; }
      if (kauf && ende < kauf) return;   /* endete vor dem Uebergang: gehoert nicht zu diesem Eigentum */
      const endMiete = zahl(h.kaltmiete);
      if (!(endMiete > 0)) { hinweise.push('Ein früherer Vertrag bei ' + name + ' hat keine Miete und geht nicht nach ViVi.'); return; }
      const kette = vertragsKette(erh, start, ende, endMiete);
      const n = mieterName(h.mv_mieter, name, !!opt.platzhalterNamen);
      const nkW = zahl(h.nk_vorauszahlung);
      const m = { tenant_first_name: n.vorname, tenant_last_name: (n.nachname + (n.platzhalter ? ' früher' : '')).slice(0, 255),
        rent: rund(kette ? kette.anfang : endMiete), monthly_utility_costs: nkW != null ? rund(nkW) : 0,
        rental_start: start, rental_end: ende, rental_type: 'past', rent_due_day: faellig, unit_identifier: name.slice(0, 255) };
      if (qm != null && qm > 0) m.unit_square_meters = rund(qm);
      if (etage) m.unit_floor = etage;
      if (kette && kette.aenderungen.length) m.aenderungen = kette.aenderungen;
      if (!kette) hinweise.push('Beim früheren Vertrag von ' + name + ' passen die Mieterhöhungen nicht zur Miete. In ViVi steht ' + eur(endMiete) + ' für die ganze Laufzeit.');
      zeige('Früheres Mietverhältnis', name, eur(endMiete) + ' kalt zuletzt, ' + deDatum(start) + ' bis ' + deDatum(ende), m.aenderungen ? 'Anfangsmiete ' + eur(m.rent) + ', dann ' + m.aenderungen.length + (m.aenderungen.length === 1 ? ' Mieterhöhung' : ' Mieterhöhungen') : '');
      aus.push(m);
    });
    return aus;
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
      if (vermietet) eintrag.miete = miete(e, name, qm, etage, ist, e.nk_vorauszahlung, x.index, zahl(e.stellplatz_miete), e.ziel_qm, e.erhoehungen);
      else { leerMeldung.push(name); zeige('Einheit', name, (qm ? String(qm).replace('.', ',') + ' m²' : 'ohne Fläche') + ', leer'); }
      const fr = fruehere(e, name, qm, etage, e.erhoehungen, vermietet ? (isoDatum(e.mv_beginn) || kauf || null) : null);   /* v4210 */
      if (fr.length) eintrag.fruehere = fr;
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
    /* v4032 · Marcel 23.11.2026, gemessen 2026-1157: die Stellplatzmiete (60 €) stand nur im Feld des Reiters Objekt
       (stellplatz_miete_monat), ze_stp_monat war leer. ViVi bekam deshalb keinen Stellplatz, die Mieteinnahmen 2025 wichen
       um 9 × 60 € ab. Jetzt: Aufteilung im Reiter Miete zuerst, sonst das Feld des Reiters Objekt. */
    const stpEinzel = zahl(daten.ze_stp_monat) > 0 ? zahl(daten.ze_stp_monat) : (zahl(daten.stellplatz_miete_monat) > 0 ? zahl(daten.stellplatz_miete_monat) : null);
    if (vermietet) eintrag.miete = miete(daten, name, qm, etage, ist, daten.nk_vorauszahlung, null, stpEinzel, daten.zb_ziel_qm, daten._erhoehungen);
    const frE = fruehere(daten, name, qm, etage, daten._erhoehungen, vermietet ? (isoDatum(daten.mv_beginn) || kauf || null) : null);   /* v4210 */
    if (frE.length) eintrag.fruehere = frE;
    else zeige('Einheit', name, (qm ? String(qm).replace('.', ',') + ' m²' : 'ohne Fläche') + (text(daten.nutzungsart) === 'eigennutzung' ? ', selbst genutzt' : ', leer'));
    if (a === 'ZFH' || a === 'MFH') hinweise.push('Keine Einheiten erfasst. Übertragen wird eine Einheit für das ganze Haus. Genauer wird es mit den Einheiten im Reiter Objekt.');
    einheiten.push(eintrag);
  }
  /* v3997 · F19 Gesamt-Flow, Marcel 23.11.2026: Stellplaetze nie als eigene Nebeneinheit, sondern beim Mieter
     (amenities am Mietverhaeltnis). Eine Stellplatzmiete nur am Objekt (ze_stp_monat) gehoert keinem Mieter und geht
     deshalb nicht mit, das sagt der Hinweis. */
  const stpObjekt = zahl(daten.ze_stp_monat) > 0 ? zahl(daten.ze_stp_monat) : zahl(daten.stellplatz_miete_monat);   /* v4032 */
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
  function darl(schluessel, bez, betrag, zins, tilg, bindj, start, bank, tilgAus, typ, mehr) {
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
    /* v4050 · was DealPilot zum Darlehen weiß, geht mit (Disagio aus dem Auszahlungskurs, tilgungsfreie Monate, Sondertilgungsrecht) */
    mehr = mehr || {};
    const kurs = zahl(mehr.kurs); if (kurs != null && kurs > 0 && kurs < 100) b.disagio_amount = rund(betrag * (100 - kurs) / 100);
    const tf = zahl(mehr.tfMon); if (tf != null && tf > 0 && tf <= 120) b.repayment_free_months = Math.round(tf);
    const stp = zahl(mehr.stPct); if (stp != null && stp > 0 && stp <= 100) { b.special_repayment_allowed = true; b.special_repayment_max_percent = rund(stp, 2); }
    if (!start && kauf) hinweise.push('Beginn von ' + bez + ' fehlt, angesetzt ist der Übergang.');
    darlehen.push({ schluessel: schluessel, body: b });
    zeige('Darlehen', bez, eur(betrag) + ', ' + String(b.interest_rate).replace('.', ',') + ' % Zins' + (b.initial_repayment != null ? ', ' + String(b.initial_repayment).replace('.', ',') + ' % Tilgung' : '') + (tilgAus ? ', Tilgungsersatz' : ''), b.fixed_interest_period != null ? 'Zinsbindung ' + b.fixed_interest_period + ' Jahre' : '');
  }
  darl('d1', 'Darlehen I', zahl(daten.d1), zahl(daten.d1z), zahl(daten.d1t), zahl(daten.d1_bindj), monatDatum(daten.d1_auszahl), daten.bank_inst, text(daten.d1_type) === 'tilgungsaussetzung', 'primary', { kurs: daten.d1_kurs, tfMon: daten.d1_tf_mon, stPct: daten.d1_st_pct });
  darl('d2', 'Darlehen II', zahl(daten.d2), zahl(daten.d2z), zahl(daten.d2t), zahl(daten.d2_bindj), monatDatum(daten.d2_auszahl), daten.d2_inst, text(daten.d2_type) === 'tilgungsaussetzung', 'parallel', { kurs: daten.d2_kurs, stPct: daten.d2_st_pct });
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
/* v3998 · Mieterhoehungen aus dem Mietverlauf: jede wirksame Aenderung bis heute mit hoeherer Kaltmiete, als Eintrag der
   Liste in js/mieterhoehungen.js { id, datum, art, von, auf, beleg }. Reine NK-Anpassungen und Senkungen zaehlen nicht.
   Die Art folgt adjustment_type (Index, Staffel, Modernisierung), sonst Vergleichsmiete (§ 558). */
function erhoehungenAus(verlauf, heute) {
  const L = verlauf && Array.isArray(verlauf.rent_changes) ? verlauf.rent_changes : [];
  const aus = [];
  L.forEach(function (c) {
    if (!c || (c.status && c.status !== 'active')) return;
    const d = isoDatum(c.effective_date); if (!d || d > heute) return;
    const alt = zahl(c.previous_rent), neu = zahl(c.new_rent);
    if (alt == null || neu == null || !(neu > alt)) return;
    const t = text(c.adjustment_type).toLowerCase();
    const art = /index/.test(t) ? 'index' : (/stag|graduat|step/.test(t) ? 'staffel' : (/moderni/.test(t) ? '559' : '558'));
    aus.push({ id: 'vivi-' + (c.id != null ? c.id : d), datum: d, art: art, von: rund(alt), auf: rund(neu), beleg: 'aus ViVi' });
  });
  return aus.sort(function (a, b) { return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0); });
}
/* v4037 · Geplante Mieterhoehungen (ViVi status scheduled oder Datum nach heute) als eigene Liste. Sie zaehlen nicht als
   „letzte Erhoehung“ und nicht fuer die Sperrfrist, nur fuer die Plan-Jahre ab ihrem Datum (mietentwicklung.js). */
function geplanteAus(verlauf, heute) {
  const L = verlauf && Array.isArray(verlauf.rent_changes) ? verlauf.rent_changes : [];
  const aus = [];
  L.forEach(function (c) {
    if (!c || (c.status && !/^(scheduled|planned|pending|active)$/.test(c.status))) return;
    const d = isoDatum(c.effective_date); if (!d || d <= heute) return;
    const alt = zahl(c.previous_rent), neu = zahl(c.new_rent);
    if (alt == null || neu == null || !(neu > alt)) return;
    const t = text(c.adjustment_type).toLowerCase();
    const art = /index/.test(t) ? 'index' : (/stag|graduat|step/.test(t) ? 'staffel' : (/moderni/.test(t) ? '559' : '558'));
    aus.push({ id: 'vivi-' + (c.id != null ? c.id : d), datum: d, art: art, von: rund(alt), auf: rund(neu), beleg: 'aus ViVi, geplant', geplant: true });
  });
  return aus.sort(function (a, b) { return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0); });
}
/* v4037 · Marcel 23.11.2026: „fuer jedes Jahr tatsaechlich die Werte, auch rueckwirkend“. Kaltmiete je vergangenem
   Kalenderjahr ab dem Uebergang aus ALLEN Mietverhaeltnissen einer Einheit (auch beendeten): je Monat die Miete laut
   Mietverlauf (start_state, wirksame Aenderungen), Monate ohne Mietverhaeltnis zaehlen 0 (Leerstand). Stellplaetze des
   Mietverhaeltnisses zaehlen mit (DealPilot fuehrt die Jahresmiete samt Zusatzeinnahmen). Der Monat des Uebergangs zaehlt
   voll, wie anteilig.js getWuMonths. Ergebnis { 'JJJJ': { miete, monate_vermietet } } fuer Jahre vor dem laufenden. */
function mieteImMonat(r, verlauf, iso, ohneStellplatz) {
  if (!r || (r.occupancy_type && r.occupancy_type !== 'rented')) return null;
  const b = isoDatum(r.rental_start), e = isoDatum(r.rental_end);
  const mEnde = iso.slice(0, 7) + '-31';
  if (b && b > mEnde) return null;
  if (e && e < iso) return null;
  let m = null;
  if (verlauf && verlauf.start_state && zahl(verlauf.start_state.rent) != null) {
    m = zahl(verlauf.start_state.rent);
    const L = Array.isArray(verlauf.rent_changes) ? verlauf.rent_changes.slice() : [];
    L.filter(function (c) { return c && (!c.status || c.status === 'active') && isoDatum(c.effective_date) && isoDatum(c.effective_date) <= iso && zahl(c.new_rent) != null; })
      .sort(function (x, y) { return isoDatum(x.effective_date) < isoDatum(y.effective_date) ? -1 : 1; })
      .forEach(function (c) { m = zahl(c.new_rent); });
  } else m = zahl(r.rent);
  if (m == null) return null;
  if (ohneStellplatz) return m;
  const stp = stellplatzMiete(r);
  return m + (stp || 0);
}
function istJahreAus(rentals, mietverlauf, ab, heute) {
  const out = {};
  const a = isoDatum(ab); if (!a) return out;
  const j0 = +a.slice(0, 4), m0 = +a.slice(5, 7), jh = +heute.slice(0, 4);
  for (let j = j0; j < jh; j++) {
    let sum = 0, kalt = 0, vermietet = 0;
    for (let mo = (j === j0 ? m0 : 1); mo <= 12; mo++) {
      const iso = j + '-' + String(mo).padStart(2, '0') + '-01';
      let monat = 0, mk = 0, da = false;
      (rentals || []).forEach(function (r) { const h = mietverlauf && mietverlauf[r.id]; const v = mieteImMonat(r, h, iso); if (v != null) { monat += v; mk += mieteImMonat(r, h, iso, true); da = true; } });
      sum += monat; kalt += mk; if (da) vermietet++;
    }
    /* kalt = Nettokaltmiete ohne Stellplaetze. Das Frontend rechnet die Zusatzeinnahmen aus DealPilot dazu, weil ViVi
       nicht alle kennt (gemessen 2026-1052: 90 € im Monat nur in DealPilot, 2025 sonst 1.080 € zu wenig). */
    out[String(j)] = { miete: rund(sum), kalt: rund(kalt), monate_vermietet: vermietet, monate: 12 - (j === j0 ? m0 - 1 : 0) };
  }
  return out;
}
/* v4210 · Mietzeiten laut DealPilot je Einheit (heutiger Vertrag offen, fruehere mit Ende), aus demselben Plan wie das
   Anlegen. Schluessel: Index in _mfh.einheiten, beim Einzelobjekt 'e0'. Fuer die Abdeckungspruefung in ausVivi. */
function dpMietzeiten(daten) {
  const out = {};
  let plan = null; try { plan = nachVivi(daten || {}, { platzhalterNamen: true, musterAnschrift: true }); } catch (e) { return out; }
  (plan.einheiten || []).forEach(function (e) {
    const k = e.index == null ? 'e0' : String(e.index), P = [];
    (e.fruehere || []).forEach(function (f) { P.push({ start: f.rental_start, ende: f.rental_end }); });
    if (e.miete && e.miete.rental_start) P.push({ start: e.miete.rental_start, ende: e.miete.rental_end || null });
    if (P.length) out[k] = P;
  });
  return out;
}
/* v4210 · Deckt der ViVi-Mietverlauf einer Einheit ein vergangenes Jahr ab? Ein Monat fehlt, wenn DealPilot dort einen
   Vertrag fuehrt (dpMietzeiten), ViVi aber keine Miete. Ergebnis { 'JJJJ': Zahl fehlender Monate } nur mit Luecken. */
function mietLuecken(perioden, rentals, mietverlauf, ab, heute) {
  const out = {};
  const a = isoDatum(ab); if (!a || !Array.isArray(perioden) || !perioden.length) return out;
  const j0 = +a.slice(0, 4), m0 = +a.slice(5, 7), jh = +heute.slice(0, 4);
  for (let j = j0; j < jh; j++) {
    for (let mo = (j === j0 ? m0 : 1); mo <= 12; mo++) {
      const iso = j + '-' + String(mo).padStart(2, '0') + '-01', mEnde = j + '-' + String(mo).padStart(2, '0') + '-28';
      const dp = perioden.some(function (p) { return p.start && p.start <= mEnde && (!p.ende || p.ende >= iso); });
      if (!dp) continue;
      const vi = (rentals || []).some(function (r) { return mieteImMonat(r, mietverlauf && mietverlauf[r.id], iso) != null; });
      if (!vi) out[String(j)] = (out[String(j)] || 0) + 1;
    }
  }
  return out;
}
function istJahreSumme(teile) {
  const out = {};
  teile.forEach(function (t) { Object.keys(t || {}).forEach(function (j) {
    const x = out[j] || (out[j] = { miete: 0, kalt: 0, monate_vermietet: 0, monate: t[j].monate });
    x.miete = rund(x.miete + t[j].miete); x.kalt = rund(x.kalt + (t[j].kalt || 0)); x.monate_vermietet = Math.max(x.monate_vermietet, t[j].monate_vermietet);
  }); });
  return out;
}
function monatJahr(iso) { const m = /^(\d{4})-(\d{2})/.exec(text(iso)); return m ? m[2] + '.' + m[1] : null; }

/* ══ v4050 · STAMMDATEN NACH DEM ANLEGEN NIE MEHR ÜBERSCHREIBEN ═══════════════════════════════════════════
   Marcel 23.11.2026 (Grundregel ViVi): beim Anlegen (DealPilot → ViVi wie ViVi → DealPilot) so voll wie möglich, danach
   werden Stammdaten in BEIDE Richtungen nie mehr überschrieben: Anschrift, Objektart, Baujahr, Einheiten mit Fläche,
   Zimmer, Geschoss, Namen, Kaufdaten. Der Abgleich zieht nur noch Zahlen (Mieten, NK-Vorauszahlung, Hausgeld,
   Darlehen, Ist je Jahr, Bewirtschaftung). Ändert sich in ViVi ein Stammdatum, zeigt der Reiter ViVi einen Hinweis
   „In ViVi geändert … übernehmen?“, übernommen wird nur auf Klick (info.stamm_aenderungen, js/vivi-reiter.js). */
const STAMM_FELD = /^(str|hnr|plz|ort|baujahr|wirtschaftlicher_uebergang|kp|makler_p|gest_p|notar_p|gba_p|ji_p|wfl|etage|einheit\.\d+\.wfl)$/;
const STAMM_WORT = { str: 'Straße', hnr: 'Hausnummer', plz: 'Postleitzahl', ort: 'Ort', baujahr: 'Baujahr', wirtschaftlicher_uebergang: 'Übergang von Nutzen und Lasten',
  kp: 'Kaufpreis', makler_p: 'Makler (%)', gest_p: 'Grunderwerbsteuer (%)', notar_p: 'Notar (%)', gba_p: 'Grundbuch (%)', ji_p: 'Sonstige Kaufnebenkosten (%)', wfl: 'Wohnfläche', etage: 'Etage' };
function istStamm(id) { return STAMM_FELD.test(String(id || '')); }
/** Vergleich der ViVi-Stammdaten (info.stamm) mit dem DealPilot-Objekt. Ergebnis fuer den Hinweis im Reiter ViVi. */
function stammAenderungen(stamm, daten, viviEinheiten) {
  const aus = [];
  daten = daten || {};
  const L = daten._mfh && Array.isArray(daten._mfh.einheiten) ? daten._mfh.einheiten : null;
  Object.keys(stamm || {}).forEach(function (id) {
    const vw = stamm[id];
    let dw = null, wort = STAMM_WORT[id] || id;
    const m = /^einheit\.(\d+)\.wfl$/.exec(id);
    if (m) { const e = L && L[+m[1]]; if (!e) return; dw = e.wfl; wort = 'Fläche ' + (text(e.art) === 'gewerbe' ? 'GE ' : 'WE ') + (text(e.nr) || String(+m[1] + 1)); }
    else dw = daten[id];
    const zv = zahl(vw), zd = zahl(dw);
    const gleich = (zv != null && zd != null && !/^(str|hnr|plz|ort|wirtschaftlicher_uebergang)$/.test(id)) ? Math.abs(zv - zd) < 0.005 : text(vw).toLowerCase() === text(dw).toLowerCase();
    if (gleich || text(vw) === '') return;
    aus.push({ feld: id, wort: wort, dealpilot: dw == null ? '' : dw, vivi: vw, uebernehmbar: true });
  });
  if (L && viviEinheiten != null && viviEinheiten !== L.length) {
    aus.push({ feld: '_einheiten', wort: 'Zahl der Einheiten', dealpilot: L.length, vivi: viviEinheiten, uebernehmbar: false });
  }
  return aus;
}

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
  const erhoehungenInfo = {};
  const geplantInfo = {};   /* v4037 */
  const istTeile = [], istEinheiten = {}, istLuecken = {};   /* v4037, v4210 */
  zuordnung.forEach(function (z) {
    const u = z.unit, q = 'units/' + u.id, P = z.praefix;
    if (P) einheitenInfo[z.index] = { nr: z.nr, name: text(u.identifier) };
    const r = rentals.filter(function (x) { return String(x.unit_id) === String(u.id) && laufend(x, heute); })[0] || null;
    /* v4037 · Ist je vergangenem Jahr aus allen Mietverhaeltnissen dieser Einheit */
    if (kontext.uebergang) {
      const alleR = rentals.filter(function (x) { return String(x.unit_id) === String(u.id); });
      const ij = istJahreAus(alleR, paket.mietverlauf, kontext.uebergang, heute);
      if (Object.keys(ij).length) { istTeile.push(ij); if (P) istEinheiten[z.index] = ij; }
      /* v4210 · Abdeckung: fehlen ViVi Monate, in denen DealPilot einen Vertrag fuehrt, ist das Jahr nicht abgedeckt */
      const dpz = kontext.dpMietzeiten && kontext.dpMietzeiten[z.index == null ? 'e0' : String(z.index)];
      if (dpz) { const lu = mietLuecken(dpz, alleR, paket.mietverlauf, kontext.uebergang, heute);
        Object.keys(lu).forEach(function (j) { (istLuecken[j] = istLuecken[j] || []).push({ einheit: z.nr || (z.index == null ? null : String(z.index + 1)), monate: lu[j] }); }); }
    }
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
    /* v3998 · Marcel 23.11.2026: Kauf 2024, heute 2026: die Miete jedes vergangenen Jahres muss stimmen, auch bei
       mehreren Erhoehungen. Der ganze Mietverlauf geht in die Liste der Mieterhoehungen (js/mieterhoehungen.js). */
    const erhListe = erhoehungenAus(paket.mietverlauf && paket.mietverlauf[r.id], heute);
    if (erhListe.length) erhoehungenInfo[P ? String(z.index) : 'objekt'] = erhListe;
    const gepl = geplanteAus(paket.mietverlauf && paket.mietverlauf[r.id], heute);   /* v4037 */
    if (gepl.length) geplantInfo[P ? String(z.index) : 'objekt'] = gepl;
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
  if (Object.keys(erhoehungenInfo).length) info.erhoehungen = erhoehungenInfo;
  if (Object.keys(geplantInfo).length) info.erhoehungen_geplant = geplantInfo;   /* v4037 */
  if (istTeile.length) info.ist_jahre = { summe: istJahreSumme(istTeile), einheiten: istEinheiten };   /* v4037 */
  /* v4210 · Jahre, die ViVis Mietverlauf nicht ganz abdeckt: summe[j].abgedeckt = false und luecken[j] = [{ einheit, monate }].
     Das Frontend uebernimmt solche Jahre nicht als Ist (vivi-felder.js istJahreUebernehmen) und zeigt einen Hinweis. */
  if (info.ist_jahre && kontext.dpMietzeiten) {
    Object.keys(info.ist_jahre.summe).forEach(function (j) { info.ist_jahre.summe[j].abgedeckt = !istLuecken[j]; });
    if (Object.keys(istLuecken).length) info.ist_jahre.luecken = istLuecken;
  }
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
  /* v4050 · ausser beim Anlegen aus ViVi (kontext.stammdaten) gehen Stammdaten NICHT in die Felder, sondern nur in den
     Vergleich (info.stamm). Der Abgleich ueberschreibt sie so nie mehr. */
  if (!kontext.stammdaten) {
    const stamm = {};
    Object.keys(felder).forEach(function (id) { if (istStamm(id)) { stamm[id] = felder[id].wert; delete felder[id]; } });
    info.stamm = stamm;
    info.stamm_einheiten = units.length;
  }
  return { felder: felder, info: info };
}

/* ══ v4050 · ViVi -> NEUES DealPilot-Objekt (Import) ═══════════════════════
   Marcel 23.11.2026: „wenn wir ein Objekt aus ViVi übernehmen … kann man das auch rückwirkend machen? Sodass wir dann
   auch einen Ankauf einfrieren können? Weil es kann ja sein, dass das Objekt schon drei Jahre bei ViVi verwaltet wird.“
   Der Datensatz, den diese Funktion baut, ist der STAND ZUM KAUFDATUM (purchase_date): Mietverhältnisse, die an diesem
   Tag liefen, mit der Kaltmiete laut Mietverlauf an diesem Tag, Mieterhöhungen bis dahin, die Darlehen mit ihrem
   Ursprungsbetrag. Der Browser schreibt daraus den Ankauf-Stand fest (js/vivi-import.js, Stichtag = Kaufdatum) und
   legt danach die Werte von heute aus ViVi darüber (der normale Abgleich, js/vivi.js). So rechnen beide Stände die
   echten Kerne, keiner wird hier gerechnet.
   Keine Personendaten der Mieter: Name, Geburtstag, Telefon und E-Mail bleiben in ViVi (ausVivi liest sie ohnehin nicht). */
const OBJART_AUS_TYP = Object.freeze({ apartment: 'ETW', single_family_house: 'EFH', commercial: 'GESCH', land: 'GRST' });
function importArt(projekt, units) {
  const t = text(projekt && projekt.type);
  if (t === 'multi_family_house') return (units || []).length === 2 ? 'ZFH' : 'MFH';
  return OBJART_AUS_TYP[t] || null;
}
function importEinheiten(paket) {
  return (Array.isArray(paket.einheiten) ? paket.einheiten : []).filter(function (u) { return u && u.unit_type !== 'ancillary'; });
}
/* Darlehen in derselben Reihenfolge wie ausVivi ohne gemerkte IDs: nach Beginn, ohne Anschluss und Bausparer */
function importDarlehen(paket) {
  return (Array.isArray(paket.darlehen) ? paket.darlehen : []).filter(function (f) { return f && !f.is_savings_plan && f.financing_type !== 'follow_up'; })
    .sort(function (x, y) { return String(x.financing_start_date || '').localeCompare(String(y.financing_start_date || '')); });
}
/** vivi_ids fuer ein importiertes Objekt: Einheiten e0..eN mit Index (MFH) bzw. e0 ohne Index, Darlehen d1/d2. */
function importIds(paket, objart) {
  const p = paket.projekt || {};
  const units = importEinheiten(paket);
  const mehr = !!ARTEN_MIT_EINHEITEN[objart];
  const ids = { projekt: p.id, einheiten: {}, darlehen: {}, muster_anschrift: false, import: { am: null, kaufdatum: isoDatum(p.purchase_date) || null } };
  if (mehr) units.forEach(function (u, i) { ids.einheiten['e' + i] = { index: i, nr: String(i + 1), name: text(u.identifier), unit_id: u.id, fertig: true }; });
  else if (units[0]) ids.einheiten.e0 = { index: null, nr: '1', name: text(units[0].identifier), unit_id: units[0].id, fertig: true };
  const D = importDarlehen(paket);
  if (D[0]) ids.darlehen.d1 = D[0].id;
  if (D[1]) ids.darlehen.d2 = D[1].id;
  return ids;
}
function zs(n) { return n == null ? '' : String(n); }   /* Formularwerte stehen als Text im Datensatz, Dezimalpunkt */

/**
 * @param paket    wie ausVivi: { projekt, einheiten, mietverhaeltnisse, darlehen, mietverlauf }
 * @param kontext  { jetzt }
 * @returns { ok, daten, vivi_ids, objart, stichtag, fehlt_bewertung: [{feld, text}], kurz }
 */
function importDaten(paket, kontext) {
  paket = Object.assign({}, paket || {}); kontext = kontext || {};
  const p = paket.projekt || {};
  if (!Array.isArray(paket.einheiten) && Array.isArray(p.units)) paket.einheiten = p.units;   /* ViVi liefert die Einheiten oft im Objekt */
  const units = importEinheiten(paket);
  const objart = importArt(p, units);
  const heute = heuteIso(kontext.jetzt);
  const kauf = isoDatum(p.purchase_date);
  const stichtag = kauf && kauf <= heute ? kauf : heute;
  const mehr = !!ARTEN_MIT_EINHEITEN[objart];
  const ids = importIds(paket, objart);
  const tag = Date.parse(stichtag + 'T12:00:00Z');
  /* der ganze Abbildungsweg von ausVivi, nur mit „heute“ = Kaufdatum: laufende Mietverhaeltnisse, letzte Erhoehung
     und die Liste der Erhoehungen gelten zu diesem Tag */
  const erg = ausVivi(paket, { vivi_ids: ids, mitEinheiten: mehr, objart: objart, jetzt: tag, musterAnschrift: false, uebergang: null, stammdaten: true });
  const f = erg.felder, info = erg.info || {};
  const rentals = Array.isArray(paket.mietverhaeltnisse) ? paket.mietverhaeltnisse : [];
  const verlauf = paket.mietverlauf || {};
  const mieteAmTag = function (u) {
    const r = rentals.filter(function (x) { return String(x.unit_id) === String(u.id) && laufend(x, stichtag); })[0] || null;
    if (!r) return null;
    const m = mieteImMonat(r, verlauf[r.id], stichtag, true);
    return m != null ? rund(m) : null;
  };

  const d = {
    objart: objart || '',
    nutzungsart: 'kapitalanlage',
    obj_herkunft: 'neukauf',
    _deal_won: true,
    _deal_won_at: new Date(kontext.jetzt == null ? Date.now() : kontext.jetzt).toISOString(),
    kaufdat: kauf || '',
    wirtschaftlicher_uebergang: kauf || ''
    /* kein dp_stufe: der Detailgrad gilt seit v3077 je Nutzer (detailgrad.js), das Objektfeld spiegelt ihn nur */
  };
  Object.keys(f).forEach(function (id) {
    if (/^einheit\./.test(id)) return;
    const w = f[id] && f[id].wert;
    if (w === '' || w == null) return;
    d[id] = typeof w === 'number' ? zs(w) : w;
  });
  if (!d.kaufdat && d.wirtschaftlicher_uebergang) d.kaufdat = d.wirtschaftlicher_uebergang;

  let leer = 0;
  if (mehr) {
    const L = units.map(function (u, i) {
      const P = 'einheit.' + i + '.';
      const g = function (k) { const x = f[P + k]; return x && x.wert !== '' && x.wert != null ? x.wert : null; };
      const gew = /commercial|business|office|retail/.test(text(u.unit_type));
      const e = { nr: String(i + 1), art: gew ? 'gewerbe' : 'wohnen', status: g('status') || 'leer' };
      /* DealPilot legt Einheiten in ViVi als „WE 3 · EG rechts“ an: Nummer und Lage wieder trennen */
      const idm = /^(?:WE|GE)\s*(\d+)\s*·\s*(.+)$/.exec(text(u.identifier));
      if (idm) { e.nr = idm[1]; e.lage = idm[2].slice(0, 80); } else if (text(u.identifier)) e.lage = text(u.identifier).slice(0, 80);
      const et = etageText(u.floor); if (et) e.etage = et;
      const zi = zahl(u.rooms); if (zi != null && zi > 0) e.zimmer = zs(zi);
      ['wfl', 'nk_vorauszahlung', 'mv_beginn', 'mv_befristet_bis', 'mv_kaution', 'mv_letzte_erhoehung', 'mv_letzte_erhoehung_betrag', 'mv_art', 'stellplatz_miete'].forEach(function (k) {
        const w = g(k); if (w != null) e[k] = typeof w === 'number' ? zs(w) : w;
      });
      /* ohne Mietverlauf in ViVi kennt ausVivi nur last_rent_increase, auch wenn es NACH dem Kauf liegt: nicht in den Ankauf */
      if (e.mv_letzte_erhoehung && e.mv_letzte_erhoehung > stichtag) { delete e.mv_letzte_erhoehung; delete e.mv_letzte_erhoehung_betrag; }
      if (e.status === 'vermietet') { const m = mieteAmTag(u); const ist = m != null ? m : zahl(g('ist')); if (ist != null) e.ist = zs(ist); }
      else leer++;
      /* v4050 · Zielmiete aus ViVi (target_rent) als Zielbild €/m², nur beim Anlegen */
      const rz = rentals.filter(function (x) { return String(x.unit_id) === String(u.id) && laufend(x, heute); })[0];
      const tr = rz ? zahl(rz.target_rent) : null, fq = zahl(e.wfl);
      if (tr != null && tr > 0 && fq > 0) e.ziel_qm = zs(rund(tr / fq, 2));
      const erh = info.erhoehungen && info.erhoehungen[String(i)];
      if (Array.isArray(erh) && erh.length) e.erhoehungen = erh;
      return e;
    });
    d._mfh = { einheiten: L, stand: stichtag };
    d.einheiten = zs(L.length);
    let fl = 0, ohne = 0, ist = 0;
    L.forEach(function (e) { const w = zahl(e.wfl); if (w > 0) fl += w; else ohne++; if (e.status !== 'leer') ist += zahl(e.ist) || 0; });
    if (fl > 0 && !ohne) d.wfl = zs(rund(fl));
    if (ist > 0) d.nkm = zs(rund(ist));
  } else if (units[0]) {
    const m = mieteAmTag(units[0]);
    if (m != null) d.nkm = zs(m);
    else if (d.nkm == null) leer = 1;
    const zi = zahl(units[0].rooms); if (zi != null && zi > 0) d.zimmer = zs(zi);
    const rz = rentals.filter(function (x) { return String(x.unit_id) === String(units[0].id) && laufend(x, heute); })[0];
    const tr = rz ? zahl(rz.target_rent) : null, fq = zahl(d.wfl);
    if (tr != null && tr > 0 && fq > 0) d.zb_ziel_qm = zs(rund(tr / fq, 2));   /* v4050 · Zielmiete aus ViVi */
    if (info.erhoehungen && Array.isArray(info.erhoehungen.objekt) && info.erhoehungen.objekt.length) d._erhoehungen = info.erhoehungen.objekt;
    if (d.mv_letzte_erhoehung && d.mv_letzte_erhoehung > stichtag) { delete d.mv_letzte_erhoehung; delete d.mv_letzte_erhoehung_betrag; }
    d.einheiten = '1';
  }
  d.vermstand = leer === 0 ? 'Vollvermietet' : (mehr && leer < units.length ? 'Teilweise leer' : 'Leer');

  const fehlt = importFehlt(d, objart);
  const kurz = {
    name: [text(p.street), text(p.house_number)].filter(Boolean).join(' ') + (text(p.city) ? ', ' + text(p.city) : ''),
    objart: objart, einheiten: units.length, vermietet: units.length - leer,
    kaufdatum: kauf || null, kaufpreis: zahl(p.purchase_price), nkm_heute: null, darlehen: importDarlehen(paket).length
  };
  return { ok: !!objart, daten: d, vivi_ids: ids, objart: objart, stichtag: stichtag, fehlt_bewertung: fehlt, kurz: kurz };
}

/* Was ViVi nicht kennt, die Bewertung aber braucht. Feld-ids aus storage.js FIELDS, Texte kurz, ohne Gedankenstrich. */
const BEWERTUNG_FELDER = [
  { feld: 'ds2_zustand', text: 'Zustand des Objekts' },
  { feld: 'mod_punkte', text: 'Modernisierungen (für die Restnutzungsdauer)', alle: ['mod_dach', 'mod_fenster', 'mod_leitungen', 'mod_heizung', 'mod_aussenwand', 'mod_baeder', 'mod_innenausbau', 'mod_grundriss'] },
  { feld: 'ausst', text: 'Ausstattung' },
  { feld: 'standardstufe', text: 'Standardstufe' },
  { feld: 'ds2_energie', text: 'Energieeffizienz' },
  { feld: 'gsfl', text: 'Grundstücksgröße', nicht: ['ETW'] },
  { feld: 'mea', text: 'Miteigentumsanteil', nur: ['ETW'] },
  { feld: 'etage', text: 'Etage der Wohnung', nur: ['ETW'] },
  { feld: 'zimmer', text: 'Zimmerzahl', nur: ['ETW', 'EFH'] },
  { feld: 'baujahr', text: 'Baujahr' },
  { feld: 'bgf', text: 'Bruttogrundfläche' },
  { feld: 'wfl', text: 'Wohnfläche' },
  { feld: 'kp', text: 'Kaufpreis' },
  { feld: 'wirtschaftlicher_uebergang', text: 'Kaufdatum (Übergang von Nutzen und Lasten)' },
  { feld: 'hg_ul', text: 'Hausgeld bzw. umlagefähige Kosten', bewirtschaftung: true }
];
function importFehlt(d, objart) {
  return BEWERTUNG_FELDER.filter(function (x) {
    if (x.nur && x.nur.indexOf(objart) < 0) return false;
    if (x.nicht && x.nicht.indexOf(objart) >= 0) return false;
    if (x.alle) return !x.alle.some(function (k) { return text(d[k]) !== ''; });
    return text(d[x.feld]) === '';
  }).map(function (x) { return { feld: x.feld, text: x.text }; });
}

module.exports = { dpMietzeiten, mietLuecken, istStamm, stammAenderungen, STAMM_FELD, importDaten, importIds, importArt, importFehlt, BEWERTUNG_FELDER, erhoehungenAus, geplanteAus, istJahreAus, istJahreSumme, mieteImMonat,
  nachVivi, ausVivi, letzteErhoehung, erhoehungBetrag, nkVorschlag, ulJahr, einheitenListe, zahl, isoDatum, monatDatum, etageText, etageZahl, mieterName,
  NK_MIN_QM, OBJEKTTYP, VERTRAG_NACH_VIVI, VERTRAG_AUS_VIVI, UL_FELDER, ARTEN_MIT_EINHEITEN, MUSTER_ANSCHRIFT
};
