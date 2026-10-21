/* ════════════════════════════════════════════════════════════════════
   v2620 · VERGLEICHSWERT AUS DEM IMMOBILIENRICHTWERT (NRW)
   §§ 24–26 ImmoWertV, § 20 ImmoWertV, ImmoWertA zu § 20 und § 26

   WAS DAS IST
   Der Immobilienrichtwert (IRW) ist ein Vergleichsfaktor im Sinne des
   § 20 ImmoWertV: aus der KAUFPREISSAMMLUNG abgeleitet, vom Ausschuss
   beschlossen, in Euro je m² Wohnflaeche, bezogen auf ein Normobjekt.
   Weicht das Bewertungsobjekt vom Normobjekt ab, wird er mit den
   Umrechnungskoeffizienten DESSELBEN Ausschusses angepasst — „ausschliess-
   lich mit den Umrechnungstabellen des Gutachterausschusses", „nur innerhalb
   des Modells" (Gars Dortmund, ebenso Herford: „nur innerhalb des Modells
   des Gutachterausschusses mit seinen entsprechenden Umrechnungskoeffizienten").

       vorlaeufiger Vergleichswert
         = IRW × Π ( UK(Objekt) / UK(Normobjekt) ) × Wohnflaeche
       Vergleichswert
         = vorlaeufiger Vergleichswert ± besondere objektspezifische
           Grundstuecksmerkmale (§ 8 Abs. 3, ImmoWertA zu § 26),
           darunter Stellplaetze, wenn das Modell sie AUSSCHLIESST.

   Angebotspreise sind KEIN Vergleichswert (§ 25 Abs. 1). Die bisherige
   Marktpreisindikation aus Angeboten bleibt unberuehrt und heisst weiter so.

   DIE REGELN (Doktrin, CLAUDE.md „Wertermittlung")
   - Koeffizienten NUR aus dem Register (uk-irw-*.json, Kennzahl
     `umrechnung_irw`), je Ausschuss × Teilmarkt × Jahrgang.
   - Tabellen: lineare Interpolation innerhalb, NIE Extrapolation.
     Ausserhalb → kein Wert, mit Grund.
   - Fehlt ein Merkmal des Objekts, das der Ausschuss umrechnet → kein Wert,
     mit der Liste dessen, was fehlt (Weg: Angabe nachtragen).
   - Liegt der Wert auf einer Klassengrenze zweier verschiedener
     Koeffizienten → kein Wert („in den Randbereichen sachverstaendig").
   - Eine Sperre im Register traegt keine rechenbare formel.
   - Ergebnis Stufe A (amtlich): IRW und Koeffizienten sind beschlossen.

   SCHNITTSTELLE (fuer CrossCheckService — die Verdrahtung macht der
   Hauptagent, dieses Modul ruft keinen Dienst):

     import { vergleichswertIrw } from '../lib/vergleichswert_irw.js';
     const v = vergleichswertIrw({
       irw,      // Ergebnis von IrwConnector.hole() (mit .roh = Zonenmerkmale)
       objekt,   // kanonische Merkmale, siehe EINGABEN unten
       bog,      // optional [{ pos, eur }] — besondere objektspez. Merkmale
       saetze,   // optional: Registersaetze (Test); sonst aus dem Ordner
     });

     v.verfuegbar === true:
       { wert_qm, wert_qm_roh, vorlaeufig_eur, vergleichswert_eur, stufe:'A',
         faktoren:[{id, name, objekt, norm, uk, art}], rechenweg:[{pos, detail, wert}],
         bog:[…], stellplaetze_im_irw, quelle:{…}, quellennachweis, hinweise:[] }
     v.verfuegbar === false:
       { grund: 'kein_irw'|'kein_satz'|'sperre'|'merkmal_fehlt'|'ausserhalb'|
                'norm_unbekannt'|'zweifel'|'teilmarkt',
         fehlt:[ids], hinweis, weg:{url, text} }
   ════════════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KENNZAHL = 'umrechnung_irw';
const HIER = dirname(fileURLToPath(import.meta.url));
const ORDNER = join(HIER, 'register');

/* Teilmarkt-Kennung des IRW-Datenmodells (Feld 19 UDOK / 21 TEILMA). */
export const TEILMAERKTE = {
  1: 'etw', 2: 'efh_zfh', 3: 'rh_dhh', 4: 'mfh', 5: 'gemischt', 6: 'buero', 7: 'gewerbe',
};

/* Kanonische Objektmerkmale. Ein Registersatz darf in `eingabe` nur
   diese Namen fuehren; der Pruefer (tools/irw-pruefen.mjs) haelt das fest.
   Codes nach dem IRW-Datenmodell NRW (Borisplus v3.3, Feldnummer in Klammern). */
export const EINGABEN = {
  baujahr: 'Baujahr (Jahr der Bezugsfertigkeit), Zahl',
  wohnflaeche: 'Wohnfläche in m², Zahl',
  grundstuecksflaeche: 'Grundstücksfläche in m², Zahl',
  bodenrichtwert: 'Bodenrichtwert am Objekt in €/m², Zahl',
  standardstufe: 'Standardstufe nach Anlage 4 ImmoWertV (1,0–5,0)',
  gstand: 'Gebäudestandard (60), Code 1–10 — wird aus der Standardstufe abgeleitet, wenn nicht angegeben',
  modernisierungspunkte: 'Modernisierungspunkte nach Anlage 2 ImmoWertV (0–20)',
  mgrad: 'Modernisierungsgrad (61), Code 1–5',
  mtyp: 'Modernisierungstyp (28), Code 1 baujahrtypisch · 2 teilmodernisiert · 3 neuzeitlich',
  keller: 'Keller vorhanden, ja/nein',
  anbauweise: "Ergänzende Gebäudeart (24): 'freistehend' | 'doppelhaushaelfte' | 'reihenendhaus' | 'reihenmittelhaus'",
  gebaeudeart: "Gebäudeart (23): 'efh' | 'efh_einlieger' | 'zfh' | 'dfh' | 'mfh' | 'villa'",
  vermietet: 'vermietet, ja/nein',
  wohnlage: 'Wohnlage (11), Code 1 sehr gut … 8 sehr einfach, oder Wort des Ausschusses',
  einheiten: 'Anzahl der Wohnungen/Einheiten im Gebäude bzw. der Anlage, Zahl',
  geschoss: 'Geschosslage (31), Code: 88 EG, 1…n OG, 77 DG, 99 Souterrain, 98 Maisonette, 67 Penthouse',
  erstverkauf: 'Erstverkauf aus Neubau, ja/nein',
  balkon: 'Balkon/Terrasse vorhanden, ja/nein',
  aufzug: 'Aufzug vorhanden, ja/nein',
  garage: 'Garage/Stellplatz im Kaufpreis enthalten, ja/nein',
  dachgeschoss: 'Dachgeschoss ausgebaut, ja/nein',
  restnutzungsdauer: 'Restnutzungsdauer in Jahren, Zahl',
  geschosse: 'Anzahl der Geschosse im Gebäude, Zahl (36)',
  denkmalschutz: 'Baudenkmal, ja/nein (54)',
  /* Kein Objektmerkmal: Zeitpunkt. Stichtag des Richtwerts = Wertermittlungsstichtag. */
  stichtag: '(intern) Registrierungsjahr/Kaufzeitpunkt — gleich dem Richtwertstichtag',
};

/* IRW-Datenmodell Feld 60: Standardstufe → Gebaeudestandard-Code.
   [1,0–1,2]=1 … [2,8–3,2]=5 … [5,0]=10. Auf eine Stelle gerundet. */
export function gstandAusStandardstufe(s) {
  const x = Math.round(Number(s) * 10) / 10;
  if (!(x >= 1 && x <= 5)) return null;
  const B = [[1.2, 1], [1.7, 2], [2.2, 3], [2.7, 4], [3.2, 5], [3.7, 6], [4.2, 7], [4.7, 8], [4.9, 9], [5.0, 10]];
  for (const [o, c] of B) if (x <= o + 1e-9) return c;
  return null;
}

const leer = (v) => v == null || (typeof v === 'string' && (!v.trim() || v.trim() === 'n/a'));
const num = (v) => {
  if (leer(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!/^-?[\d.,]+$/.test(s)) return null;
  /* Nur Dezimalkomma; Tausenderpunkte kommen in den IRW-Feldern nicht vor
     (Datenmodell: „ohne Tausender-Trennzeichen"). Siehe Memory „Punkt ist kein Tausender". */
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const r3 = (x) => Math.round(x * 1000) / 1000;
const de = (x, st = 3) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st });
const eur = (x) => Number(x).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';

/* ── Register ─────────────────────────────────────────────────────── */
let _cache = null;
export function ladeSaetze() {
  if (_cache) return _cache;
  const alle = [];
  for (const f of readdirSync(ORDNER).filter((x) => x.startsWith('uk-irw-') && x.endsWith('.json')).sort()) {
    for (const s of JSON.parse(readFileSync(join(ORDNER, f), 'utf8'))) {
      if (s && s.kennzahl === KENNZAHL) alle.push({ ...s, _datei: f });
    }
  }
  _cache = alle;
  return alle;
}

/** Registersatz fuer Ausschuss (GASL) × Teilmarkt × Jahrgang. */
export function satzFuer({ gasl, teilmarkt, jahrgang = null, saetze = null }) {
  const tm = typeof teilmarkt === 'number' ? TEILMAERKTE[teilmarkt] : teilmarkt;
  const alle = (saetze || ladeSaetze()).filter((s) => String(s.gasl) === String(gasl) && s.zweig === tm);
  if (!alle.length) return null;
  const passend = jahrgang ? alle.filter((s) => Number(s.jahrgang) === Number(jahrgang)) : alle;
  const pool = passend.length ? passend : [];
  pool.sort((a, b) => Number(b.jahrgang) - Number(a.jahrgang));
  return pool[0] || null;
}

/* ── Merkmal auswerten ────────────────────────────────────────────── */

/* Objektwert fuer ein Merkmal aus den kanonischen Eingaben. */
/* `eingabe` darf eine Liste sein: der erste Wert, der in der Tabelle
   vorkommt, gilt (z. B. ['anbauweise','gebaeudeart'] — eine Doppelhaus-
   haelfte vor dem Einfamilienhaus). */
function eingabeWert(k, m, objekt) {
  let v = objekt ? objekt[k] : undefined;
  if (k === 'gstand' && leer(v) && objekt && !leer(objekt.standardstufe)) v = gstandAusStandardstufe(objekt.standardstufe);
  if (k === 'mgrad' && leer(v) && objekt && !leer(objekt.modernisierungspunkte) && m.punkte_zuordnung) {
    const p = Number(objekt.modernisierungspunkte);
    const t = m.punkte_zuordnung.find((z) => p >= z.von && p <= z.bis);
    v = t ? t.wert : '__grenze__';
  }
  if (typeof v === 'boolean') v = v ? 'ja' : 'nein';
  if (m.runden != null && typeof v === 'number') v = Math.round(v * 10 ** m.runden) / 10 ** m.runden;
  return leer(v) ? null : v;
}
function objektWert(m, objekt) {
  const liste = Array.isArray(m.eingabe) ? m.eingabe : [m.eingabe];
  let erst = null;
  for (const k of liste) {
    const v = eingabeWert(k, m, objekt);
    if (v == null) continue;
    if (erst == null) erst = v;
    if (liste.length === 1) return v;
    const s = String(aufSchluessel(m, v)).toLowerCase();
    const bekannt = m.art === 'kategorien' ? Object.keys(m.werte || {}).some((x) => x.toLowerCase() === s)
      : m.art === 'matrix' ? (m.kategorien || []).some((x) => String(x).toLowerCase() === s) : true;
    if (bekannt) return v;
  }
  return erst;
}

/* Wert auf den Schluessel des Merkmals bringen (Code → Kategorie).
   Objekt: `zuordnung`; Norm: `norm_zuordnung` (sonst `zuordnung`) —
   die Norm kommt als Code des IRW-Datenmodells, das Objekt oft anders. */
function aufSchluessel(m, v, fuerNorm = false) {
  if (v == null) return null;
  const z = (fuerNorm && m.norm_zuordnung) || m.zuordnung || {};
  const s = String(v).trim();
  if (Object.prototype.hasOwnProperty.call(z, s)) return z[s];
  const k = Object.keys(z).find((x) => x.toLowerCase() === s.toLowerCase());
  return k != null ? z[k] : v;
}

/* Klasse finden: Name ODER Zahl. Liefert {klasse} | {grenze:true} | null. */
function klasseFuer(m, v) {
  const kl = m.klassen || [];
  const s = String(v).trim().toLowerCase();
  const nachName = kl.find((k) => String(k.name || '').trim().toLowerCase() === s);
  if (nachName) return { klasse: nachName };
  /* Spanne wie im IRW-Feld: "126-150" */
  const sp = String(v).match(/^\s*(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (sp) {
    const a = num(sp[1]), b = num(sp[2]);
    const t = kl.find((k) => k.von === a && k.bis === b);
    return t ? { klasse: t } : null;
  }
  const x = num(v);
  if (x == null) return null;
  const treffer = kl.filter((k) => (k.von == null || x >= k.von) && (k.bis == null || x <= k.bis));
  if (!treffer.length) return null;
  const uks = new Set(treffer.map((k) => k.uk));
  if (treffer.length > 1 && uks.size > 1) return { grenze: true, treffer };
  return { klasse: treffer[0] };
}

/* Kurve: lineare Interpolation, keine Extrapolation. */
function kurveBei(m, x) {
  const xs = m.x, ys = m.uk;
  const zw = (m.zweifel || []).map((z) => Number(z.bei));
  for (let i = 0; i < xs.length; i++) {
    if (Math.abs(xs[i] - x) < 1e-9) {
      if (zw.includes(xs[i])) return { zweifel: xs[i] };
      return ys[i] == null ? null : { uk: Number(ys[i]) };
    }
    if (i + 1 < xs.length && ((xs[i] < x && x < xs[i + 1]) || (xs[i] > x && x > xs[i + 1]))) {
      if (zw.includes(xs[i]) || zw.includes(xs[i + 1])) return { zweifel: zw.includes(xs[i]) ? xs[i] : xs[i + 1] };
      if (ys[i] == null || ys[i + 1] == null) return null;
      return { uk: Number(ys[i]) + (Number(ys[i + 1]) - Number(ys[i])) * (x - xs[i]) / (xs[i + 1] - xs[i]) };
    }
  }
  return null;
}

/* Normwert des Merkmals: aus der Zone (Feld des IRW), sonst aus dem Satz. */
function normWert(m, roh, satzNorm) {
  if (m.norm_feld && roh && !leer(roh[m.norm_feld])) {
    const v = String(roh[m.norm_feld]).trim();
    return { wert: aufSchluessel(m, v, true), herkunft: 'zone', roh: v };
  }
  const n = m.norm != null ? m.norm : (satzNorm || {})[m.id];
  return n == null ? null : { wert: aufSchluessel(m, n, true), herkunft: 'satz', roh: n };
}

/**
 * Ein Merkmal: Faktor Objekt gegen Norm.
 * @returns {{ok:true, uk, objekt, norm, text}} | {{ok:false, grund, text}}
 */
export function merkmalFaktor(m, objekt, roh, satzNorm) {
  const name = m.name || m.id;
  if (m.art === 'stichtag') {
    return { ok: true, uk: 1, objekt: 'Stichtag des Richtwerts', norm: m.norm != null ? String(m.norm) : 'Richtwertstichtag',
      text: `${name}: Wertermittlungsstichtag gleich Richtwertstichtag — keine Zeitanpassung` };
  }
  const nw = normWert(m, roh, satzNorm);
  if (!nw) return { ok: false, grund: 'norm_unbekannt', text: `${name}: das Normobjekt der Zone führt dieses Merkmal nicht` };
  const ov0 = objektWert(m, objekt);
  if (ov0 == null) {
    const k0 = Array.isArray(m.eingabe) ? m.eingabe[m.eingabe.length - 1] : m.eingabe;
    return { ok: false, grund: 'merkmal_fehlt', text: `${name}: Angabe zum Objekt fehlt (${EINGABEN[k0] || k0})` };
  }
  if (ov0 === '__grenze__') {
    return { ok: false, grund: 'grenze', text: `${name}: die Modernisierungspunkte liegen zwischen zwei Stufen des Ausschusses — sachverständig zuzuordnen` };
  }
  const ov = aufSchluessel(m, ov0);

  if (m.art === 'matrix') {
    const ks = m.kategorien.map((k) => String(k).toLowerCase());
    const i = ks.indexOf(String(ov).toLowerCase()), j = ks.indexOf(String(nw.wert).toLowerCase());
    if (i < 0) return { ok: false, grund: 'ausserhalb', text: `${name}: „${ov0}" ist in der Tabelle des Ausschusses nicht geführt` };
    if (j < 0) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist der Tabelle nicht zuzuordnen` };
    const uk = (m.werte[i] || [])[j];
    if (uk == null) return { ok: false, grund: 'ausserhalb', text: `${name}: kein Koeffizient für ${m.kategorien[i]} gegen ${m.kategorien[j]}` };
    return { ok: true, uk: Number(uk), objekt: m.kategorien[i], norm: m.kategorien[j],
      text: `${name}: ${m.kategorien[i]} gegen Norm ${m.kategorien[j]} → ${de(uk)}` };
  }

  let ukO, ukN, oTxt, nTxt;
  if (m.art === 'klassen') {
    const o = klasseFuer(m, ov), n = klasseFuer(m, nw.wert);
    if (o && o.grenze) return { ok: false, grund: 'grenze', text: `${name}: ${ov0} liegt auf der Grenze zweier Klassen (${o.treffer.map((k) => k.name).join(' / ')}) — sachverständig zuzuordnen` };
    if (!o) return { ok: false, grund: 'ausserhalb', text: `${name}: ${ov0} liegt außerhalb der Klassen des Ausschusses` };
    if (!n || n.grenze) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist keiner Klasse zuzuordnen` };
    if (o.klasse.uk == null || n.klasse.uk == null) return { ok: false, grund: 'ausserhalb', text: `${name}: für diese Klasse veröffentlicht der Ausschuss keinen Koeffizienten` };
    ukO = Number(o.klasse.uk); ukN = Number(n.klasse.uk); oTxt = o.klasse.name; nTxt = n.klasse.name;
  } else if (m.art === 'kategorien') {
    const w = m.werte || {};
    const key = Object.keys(w).find((k) => k.toLowerCase() === String(ov).toLowerCase());
    const nkey = Object.keys(w).find((k) => k.toLowerCase() === String(nw.wert).toLowerCase());
    if (key == null) return { ok: false, grund: 'ausserhalb', text: `${name}: „${ov0}" ist in der Tabelle des Ausschusses nicht geführt` };
    if (nkey == null) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist der Tabelle nicht zuzuordnen` };
    if (w[key] == null || w[nkey] == null) return { ok: false, grund: 'ausserhalb', text: `${name}: kein Koeffizient veröffentlicht` };
    ukO = Number(w[key]); ukN = Number(w[nkey]); oTxt = key; nTxt = nkey;
  } else if (m.art === 'kurve') {
    const xo = num(ov), xn = num(nw.wert);
    if (xo == null) return { ok: false, grund: 'merkmal_fehlt', text: `${name}: „${ov0}" ist keine Zahl` };
    if (xn == null) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist keine Zahl (Spanne?) — nicht eindeutig` };
    const a = kurveBei(m, xo), b = kurveBei(m, xn);
    if (a && a.zweifel != null) return { ok: false, grund: 'zweifel', text: `${name}: der amtliche Tabellenwert bei ${a.zweifel} ist offensichtlich fehlerhaft gedruckt — Rückfrage beim Ausschuss` };
    if (b && b.zweifel != null) return { ok: false, grund: 'zweifel', text: `${name}: der amtliche Tabellenwert am Normobjekt (${b.zweifel}) ist offensichtlich fehlerhaft gedruckt` };
    if (!a) return { ok: false, grund: 'ausserhalb', text: `${name}: ${xo} liegt außerhalb der Tabelle des Ausschusses (${m.x[0]}–${m.x[m.x.length - 1]}); eine Fortschreibung darüber hinaus ist nicht zulässig` };
    if (!b) return { ok: false, grund: 'norm_unbekannt', text: `${name}: das Normobjekt der Zone (${xn}) liegt außerhalb der veröffentlichten Tabelle (${m.x[0]}–${m.x[m.x.length - 1]})` };
    ukO = a.uk; ukN = b.uk; oTxt = String(xo); nTxt = String(xn);
  } else {
    return { ok: false, grund: 'form', text: `${name}: unbekannte Form ${m.art}` };
  }
  const uk = ukO / ukN;
  return { ok: true, uk, uk_objekt: ukO, uk_norm: ukN, objekt: oTxt, norm: nTxt,
    text: ukN === 1 ? `${name}: ${oTxt} (Norm ${nTxt}) → ${de(ukO)}`
      : `${name}: ${oTxt} gegen Norm ${nTxt} → ${de(ukO)} / ${de(ukN)} = ${de(uk, 4)}` };
}

/** Nur die Umrechnung (ohne Flaeche), fuer Pruefer und Rechner. */
export function umrechnen(satz, irwWert, objekt, roh = null) {
  const f = satz.formel || {};
  const faktoren = [], fehler = [];
  for (const m of f.merkmale || []) {
    const r = merkmalFaktor(m, objekt, roh, f.normobjekt);
    if (!r.ok) { fehler.push({ id: m.id, grund: r.grund, text: r.text }); continue; }
    faktoren.push({ id: m.id, name: m.name || m.id, art: m.art, objekt: r.objekt, norm: r.norm, uk: r.uk, uk_objekt: r.uk_objekt, uk_norm: r.uk_norm, text: r.text });
  }
  if (fehler.length) return { ok: false, fehler };
  /* Additives Berechnungsverfahren (BRECHV 1) gibt es im Datenmodell; im
     Register heute nur multiplikativ. Additiv wird nicht still multipliziert. */
  if ((f.verknuepfung || 'multiplikativ') !== 'multiplikativ') {
    return { ok: false, fehler: [{ id: '*', grund: 'form', text: 'additive Verknüpfung ist nicht umgesetzt' }] };
  }
  const prod = faktoren.reduce((a, x) => a * x.uk, 1);
  return { ok: true, faktoren, produkt: prod, wert_qm: irwWert * prod };
}

const GRUND_TEXT = {
  merkmal_fehlt: 'Für die Umrechnung fehlen Angaben zum Objekt',
  ausserhalb: 'Das Objekt liegt außerhalb der Umrechnungstabellen des Gutachterausschusses',
  norm_unbekannt: 'Das Normobjekt dieser Richtwertzone ist mit den veröffentlichten Tabellen nicht abzubilden',
  grenze: 'Ein Merkmal liegt auf einer Klassengrenze',
  zweifel: 'Ein amtlicher Tabellenwert ist offensichtlich fehlerhaft gedruckt',
  form: 'Die Umrechnungsvorschrift ist nicht umgesetzt',
};

/**
 * Vergleichswert aus dem Immobilienrichtwert.
 * @param {object} p
 * @param {object} p.irw     IrwConnector.hole()-Ergebnis (verfuegbar, wert_qm, gasl, teilmarkt_code, roh, …)
 * @param {object} p.objekt  kanonische Merkmale (EINGABEN)
 * @param {Array}  [p.bog]   [{ pos, eur }] — besondere objektspezifische Grundstücksmerkmale
 * @param {Array}  [p.saetze] Registersätze (sonst Ordner)
 */
export function vergleichswertIrw({ irw, objekt = {}, bog = [], saetze = null }) {
  if (!irw || !irw.verfuegbar || !(Number(irw.wert_qm) > 0)) {
    return { verfuegbar: false, grund: 'kein_irw',
      hinweis: (irw && irw.hinweis) || 'An dieser Stelle liegt kein Immobilienrichtwert vor.' };
  }
  const roh = irw.roh || {};
  const gasl = irw.gasl || roh.GASL;
  const tm = Number(irw.teilmarkt_code || roh.TEILMA);
  const jahr = irw.stichtag ? Number(String(irw.stichtag).slice(-4)) : null;
  const udok = irw.umrechnungsvorschrift_url || roh.UDOK_URL || null;
  const weg = udok ? { url: udok, text: 'Umrechnungsvorschrift des Gutachterausschusses (Örtliche Fachinformationen, BORIS-NRW)' } : null;

  const satz = satzFuer({ gasl, teilmarkt: tm, jahrgang: jahr, saetze });
  if (!satz) {
    return { verfuegbar: false, grund: 'kein_satz', weg,
      hinweis: `Für den Immobilienrichtwert liegen die Umrechnungskoeffizienten des Gutachterausschusses `
        + `(${irw.gutachterausschuss || 'Ausschuss ' + gasl}, Teilmarkt ${TEILMAERKTE[tm] || tm}, Jahrgang ${jahr || '?'}) `
        + 'noch nicht im Register. Ohne sie wird nicht umgerechnet — der Richtwert bleibt Orientierung.' };
  }
  if (satz.vollstaendig === false || satz.warum_kein_wert || !satz.formel) {
    return { verfuegbar: false, grund: 'sperre', weg: weg || (satz.quelle_url ? { url: satz.quelle_url, text: 'Quelle' } : null),
      hinweis: satz.warum_kein_wert || 'Die Umrechnung dieses Ausschusses ist gesperrt.' };
  }

  const u = umrechnen(satz, Number(irw.wert_qm), objekt, roh);
  if (!u.ok) {
    const g = u.fehler[0].grund;
    return { verfuegbar: false, grund: g, fehlt: u.fehler.filter((x) => x.grund === 'merkmal_fehlt').map((x) => x.id),
      gruende: u.fehler, weg,
      hinweis: `${GRUND_TEXT[g] || 'Keine Umrechnung möglich'}: ${u.fehler.map((x) => x.text).join(' · ')}. `
        + 'Ein Vergleichswert wird deshalb nicht ausgewiesen; der Immobilienrichtwert bleibt Orientierung.' };
  }

  const wfl = num(objekt.wohnflaeche);
  if (!(wfl > 0)) return { verfuegbar: false, grund: 'merkmal_fehlt', fehlt: ['wohnflaeche'], weg, hinweis: 'Ohne Wohnfläche kein Vergleichswert.' };

  const f = satz.formel;
  const wertQm = u.wert_qm;
  const vorl = wertQm * wfl;
  const rechenweg = [{ pos: 'Immobilienrichtwert der Zone', detail: `${irw.zonennummer ? 'Zone ' + irw.zonennummer + ', ' : ''}Stichtag ${irw.stichtag || '?'}`, wert: Number(irw.wert_qm), einheit: '€/m²' }];
  for (const x of u.faktoren) rechenweg.push({ pos: `× ${x.name}`, detail: x.text, faktor: r3(x.uk) });
  rechenweg.push({ pos: '= angepasster Richtwert', detail: `Produkt der Koeffizienten ${de(u.produkt, 4)}`, wert: Math.round(wertQm * 100) / 100, einheit: '€/m²' });
  rechenweg.push({ pos: '× Wohnfläche', detail: `${de(wfl, 2)} m²`, wert: Math.round(vorl), einheit: '€' });

  const bogListe = (Array.isArray(bog) ? bog : []).filter((b) => b && Number.isFinite(Number(b.eur)) && Number(b.eur) !== 0);
  let summeBog = 0;
  for (const b of bogListe) { summeBog += Number(b.eur); rechenweg.push({ pos: (Number(b.eur) > 0 ? '+ ' : '− ') + (b.pos || 'besonderes Merkmal'), detail: b.detail || '§ 8 Abs. 3 ImmoWertV', wert: Math.round(Number(b.eur)), einheit: '€' }); }
  const vw = vorl + summeBog;
  rechenweg.push({ pos: '= Vergleichswert', detail: bogListe.length ? 'vorläufiger Vergleichswert ± besondere objektspezifische Grundstücksmerkmale' : 'ohne besondere objektspezifische Grundstücksmerkmale', wert: Math.round(vw), einheit: '€' });

  const hinweise = [];
  if (f.stellplaetze_im_irw === false) hinweise.push('Stellplätze und Garagen sind im Immobilienrichtwert nicht enthalten; sie sind getrennt als besonderes objektspezifisches Merkmal anzusetzen.');
  if (f.stellplaetze_im_irw === true) hinweise.push(f.stellplaetze_hinweis || 'Das Normobjekt enthält Garage oder Stellplatz; ein gesonderter Ansatz entfällt.');
  if (irw.aus_vorjahr) hinweise.push(irw.vorjahr_hinweis);
  if (f.hinweis_ausschuss) hinweise.push(f.hinweis_ausschuss);

  const quelle = {
    ausschuss: satz.gaa_name, gasl, teilmarkt: satz.zweig, jahrgang: satz.jahrgang,
    irw_quelle: irw.quelle || 'BORIS-NRW, Immobilienrichtwerte (dl-de/zero-2-0)',
    umrechnung_url: satz.quelle_url, seite: satz.seite, lizenz: satz.lizenz, stichtag: satz.stichtag,
  };
  return {
    verfuegbar: true,
    stufe: 'A',
    verfahren: 'vergleichswert',
    basis: 'immobilienrichtwert',
    wert_qm_roh: wertQm,
    wert_qm: Math.round(wertQm),
    vorlaeufig_eur: Math.round(vorl),
    bog: bogListe,
    vergleichswert_eur: Math.round(vw),
    faktoren: u.faktoren.map((x) => ({ ...x, uk: r3(x.uk) })),
    produkt: u.produkt,
    rechenweg,
    stellplaetze_im_irw: f.stellplaetze_im_irw ?? null,
    quelle,
    /* dl-de/zero-2-0 verlangt keine Namensnennung; genannt wird die Quelle
       trotzdem (ImmoWertA 9: Herkunft der Daten). */
    quellennachweis: `${satz.gaa_name}: Immobilienrichtwert (BORIS-NRW, Stichtag ${irw.stichtag || satz.stichtag}) und `
      + `Umrechnungskoeffizienten (Örtliche Fachinformationen ${satz.jahrgang}, ${satz.seite || ''}), ${satz.lizenz}`,
    satz_id: `${satz.gasl}/${satz.zweig}/${satz.jahrgang}`,
    hinweise,
    rechtsgrundlage: '§§ 24–26 ImmoWertV i. V. m. § 20 ImmoWertV (Vergleichsfaktor)',
  };
}

/** Anwendungsbeispiel eines Satzes nachrechnen (Pruefmassstab). */
export function pruefeBeispiel(satz) {
  const b = satz.anwendungsbeispiel;
  if (!b) return null;
  const u = umrechnen(satz, Number(b.irw), b.objekt || {}, b.norm_zone || null);
  if (!u.ok) return { ok: false, fehler: u.fehler };
  const abw = [];
  for (const [id, soll] of Object.entries(b.faktoren || {})) {
    const ist = u.faktoren.find((x) => x.id === id);
    if (!ist) { abw.push(`${id}: nicht berechnet`); continue; }
    if (Math.abs(ist.uk - Number(soll)) > (b.toleranz_uk ?? 0.0005)) abw.push(`${id}: ${r3(ist.uk)} statt ${soll}`);
  }
  const tol = b.toleranz_eur_qm ?? 1;
  if (b.ergebnis_eur_qm != null && Math.abs(u.wert_qm - Number(b.ergebnis_eur_qm)) > tol) {
    abw.push(`€/m²: ${Math.round(u.wert_qm * 100) / 100} statt ${b.ergebnis_eur_qm} (±${tol})`);
  }
  return { ok: !abw.length, abw, wert_qm: u.wert_qm, faktoren: u.faktoren.length };
}

export default { KENNZAHL, TEILMAERKTE, EINGABEN, ladeSaetze, satzFuer, merkmalFaktor, umrechnen, vergleichswertIrw, pruefeBeispiel, gstandAusStandardstufe };
