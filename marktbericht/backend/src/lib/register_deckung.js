// register_deckung.js  (v2591)
//
// DIE DECKUNG DES REGISTERS — als Auskunft fuer die Admin-Ansicht
// „Register & Ernte".
//
// Marcel will dort immer sehen: wie viel wir haben, wie viele Werte, wo
// Luecken sind, welche Orte nur kostenpflichtig zu bekommen sind, und was
// die Hintergrund-Ernte gefunden hat.
//
// WOHER DIE ZAHLEN KOMMEN:
//   · Registerdateien ueber leseSaatdateien(SAATDATEIEN) — derselbe
//     Leseweg wie ladeSaat(), aber ohne das laufende Register anzufassen.
//     Die Liste SAATDATEIEN entscheidet, was in den Bericht kommt; eine
//     Datei, die nur im Ordner liegt, zaehlt hier auch nicht mit (sie
//     steht unter `nicht_in_liste`).
//   · Sperre ist, was der Rechenweg fuer eine Sperre haelt:
//     `vollstaendig === false || warum_kein_wert` (wie in ladeAusDb()).
//   · Objektart ueber zweigwahl.objektgruppe() — ART_RANG, keine eigene Liste.
//   · mb.param_modell nur lesend, als Abgleich Datei gegen Tabelle, mit
//     demselben vollen Schluessel wie ladeAusDb().
//
// „KOSTENPFLICHTIG" STEHT AN VIER STELLEN, und keine kennt die andere:
//   1 Register-Feld `zugang` (kostenpflichtig / genehmigungspflichtig) bzw.
//     `kostenpflichtig: true`
//   2 Freitext der Sperre (warum_kein_wert, unvollstaendig_grund, weg) —
//     VORSICHTIG erkannt und mit der Fundstelle im Text ausgewiesen, damit
//     ein Fehlgriff sichtbar ist statt still
//   3 lib/quellen_links.js (Ausschuss- und Landesebene)
//   4 mb.gaa_sources (zugang, preis_eur, bestell_url)
// Zusammengefuehrt wird je Ausschuss (Name + Land), sonst je AGS. Jeder
// Eintrag sagt, an welchen Stellen er gefunden wurde.
//
// Namen privater Anbieter gehen nicht nach aussen, auch nicht ins Admin:
// sie werden im Text ersetzt (Links bleiben, sie sind der Bestellweg).

import { SAATDATEIEN, leseSaatdateien, fehlendeSaatdateien, DB_KENNZAHLEN }
  from './ausschuss_register.js';
import { objektgruppe, OBJEKTGRUPPEN } from './zweigwahl.js';
import { LAND_QUELLEN, AUSSCHUSS_QUELLEN } from './quellen_links.js';

export const LC = { '01':'SH','02':'HH','03':'NI','04':'HB','05':'NW','06':'HE',
  '07':'RP','08':'BW','09':'BY','10':'SL','11':'BE','12':'BB',
  '13':'MV','14':'SN','15':'ST','16':'TH' };
export const LAENDER = ['SH','HH','NI','HB','NW','HE','RP','BW','BY','SL','BE','BB','MV','SN','ST','TH'];
const LAND_NAME = Object.fromEntries(Object.entries(LAND_QUELLEN)
  .map(([k, v]) => [LC[k], v.land]));

export const KENNZAHLEN = {
  liegenschaftszinssatz: 'lzs',
  sachwertfaktor: 'swf',
  umrechnungskoeffizient_flaeche: 'uk_flaeche',
  umrechnungskoeffizient_wgfz: 'uk_wgfz',
};
export const KZ_NAME = { lzs: 'Liegenschaftszinssatz', swf: 'Sachwertfaktor',
  uk_flaeche: 'UK Grundstücksgröße', uk_wgfz: 'UK WGFZ', sonstige: 'sonstige Kennzahlen' };
const kzVon = (k) => KENNZAHLEN[k] || 'sonstige';

const landVon = (s) => LC[String((s && s.ags) || '').replace(/\D/g, '').slice(0, 2)]
  || (s && s.land_code && LAENDER.includes(String(s.land_code).toUpperCase())
      ? String(s.land_code).toUpperCase() : null);

export const istSperre = (s) => s.vollstaendig === false || !!s.warum_kein_wert;

const ZUGANG_KAUF = new Set(['kostenpflichtig', 'genehmigungspflichtig']);
const istKaufFeld = (s) => ZUGANG_KAUF.has(String(s.zugang || '').toLowerCase())
  || s.kostenpflichtig === true;

/* Vorsichtig: nur ausdrueckliche Worte, und nie, wenn der Satz es
   ausdruecklich verneint. Die Fundstelle im Text geht mit. */
const KAUF_MUSTER = /kostenpflichtig|gegen\s+geb(ü|ue)hr|geb(ü|ue)hrenpflichtig|genehmigungspflichtig|genehmigung\s+(des|der)\s+(gutachterausschuss|gesch(ä|ae)ftsstelle)|nur\s+(im|in\s+der)\s+(kostenpflichtigen\s+)?voll(bericht|fassung|version)/i;
const KAUF_VERNEINT = /nicht\s+kostenpflichtig|kostenfrei\s+und\s+vollst(ä|ae)ndig/i;
function kaufImText(s) {
  const txt = [s.warum_kein_wert, s.unvollstaendig_grund, s.weg]
    .filter((x) => typeof x === 'string').join(' · ');
  if (!txt) return null;
  const m = KAUF_MUSTER.exec(txt);
  if (!m || KAUF_VERNEINT.test(txt)) return null;
  const a = Math.max(0, m.index - 90), e = Math.min(txt.length, m.index + m[0].length + 90);
  return (a > 0 ? '… ' : '') + txt.slice(a, e).trim() + (e < txt.length ? ' …' : '');
}

const FREMD = [
  [/sprengnetter/gi, 'unabhängiger Bewertungspartner'],
  [/pricehubble/gi, 'unabhängiger Bewertungspartner'],
  [/immobilienscout\s*24|immoscout\s*24?/gi, 'Marktdatenquelle'],
  [/bodenrichtwerte\.com/gi, 'externes Bestellportal'],
];
export function maskiere(t) {
  if (t == null) return t;
  let r = String(t);
  for (const [m, w] of FREMD) r = r.replace(m, () => w);
  return r;
}
const kurz = (t, n = 320) => {
  if (t == null || t === '') return null;
  const s = maskiere(String(t)).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

/* Fundstelle wie saat-pruefen.mjs: eine Zahl ODER ein benannter Dateiname. */
const _FUNDSTELLE_DATEI = /\.(csv|xlsx?|json|txt|zip|gpkg|shp)\b/i;
function hatSeite(s) {
  if (s.seite != null && String(s.seite).trim() !== '') return true;
  if (s.quelle_seite != null && String(s.quelle_seite).trim() !== '') return true;
  if (typeof s.fundstelle === 'string' && (/\d/.test(s.fundstelle) || _FUNDSTELLE_DATEI.test(s.fundstelle))) return true;
  return (s.belege || []).some((b) => {
    const txt = (b && typeof b === 'object')
      ? [b.fundstelle, b.feldbeschreibung, b.seite].filter((x) => x != null).join(' ')
      : String(b || '');
    return txt && (/\d/.test(txt) || _FUNDSTELLE_DATEI.test(txt));
  });
}

const jahrVon = (s) => {
  const b = Number(s.berichtsjahr ?? s.jahrgang);
  if (Number.isFinite(b) && b > 1900) return b;
  const t = /^(\d{4})/.exec(String(s.stichtag || ''));
  return t ? Number(t[1]) : null;
};
const ausschussName = (s) => maskiere(s.gaa_name || s.ausschuss || s.gebiet_name || ('AGS ' + s.ags));
const normName = (n) => String(n || '').toLowerCase()
  .replace(/gutachterausschuss(es)?|f(ü|ue)r|grundst(ü|ue)ckswerte|immobilienwerte|die ermittlung von|im bereich|des|der|den|die|in|gemeinsame[rn]?|obere[rn]?/g, ' ')
  .replace(/[^a-zäöüß0-9]+/g, '');

/* Dieselben Schluessel wie ladeAusDb() (v2396). */
const _zw = (s) => s.zweig || 'standard';
const misch = (s) => [s.ags, s.kennzahl, _zw(s), s.berichtsjahr ?? ''].join('|');
const voll = (s) => [misch(s), s.quelle_url || ''].join('|');

function leereZelle() {
  return { werte: 0, sperren: 0, kostenpflichtig: 0, jahr_min: null, jahr_max: null,
           ohne_stichtag: 0, ohne_seite: 0, ausschuesse: 0, _aus: new Set(),
           je_objekt: {}, db_werte: null, db_deckt: null };
}

/* ── Der Dateiteil haengt nur am Code-Stand: einmal je Prozess. ──────── */
let _dateiCache = null;
function dateiTeil() {
  if (_dateiCache) return _dateiCache;
  const { alle, gelesen, vermisst } = leseSaatdateien(SAATDATEIEN, { mitDatei: true });
  _dateiCache = { alle, gelesen: gelesen.length, vermisst: vermisst.length,
                  nicht_in_liste: fehlendeSaatdateien() };
  return _dateiCache;
}

export function _cacheLeeren() { _dateiCache = null; }

function zaehle(alle) {
  const zellen = {};
  const summe = {};
  const gruppenArten = {};
  for (const L of LAENDER) zellen[L] = {};
  let ohneLand = 0;
  for (const s of alle) {
    if (!s || !s.kennzahl) continue;
    const L = landVon(s);
    if (!L) { ohneLand++; continue; }
    const k = kzVon(s.kennzahl);
    const z = zellen[L][k] || (zellen[L][k] = leereZelle());
    const sm = summe[k] || (summe[k] = { werte: 0, sperren: 0, kostenpflichtig: 0 });
    const sp = istSperre(s);
    const { gruppe, art } = objektgruppe(s.zweig);
    (gruppenArten[gruppe] || (gruppenArten[gruppe] = new Set())).add(art);
    const o = z.je_objekt[gruppe] || (z.je_objekt[gruppe] = { werte: 0, sperren: 0 });
    z._aus.add(normName(ausschussName(s)));
    if (sp) { z.sperren++; sm.sperren++; o.sperren++; }
    else {
      z.werte++; sm.werte++; o.werte++;
      const j = jahrVon(s);
      if (j) {
        z.jahr_min = z.jahr_min == null ? j : Math.min(z.jahr_min, j);
        z.jahr_max = z.jahr_max == null ? j : Math.max(z.jahr_max, j);
      }
      if (!s.stichtag) z.ohne_stichtag++;
      if (!hatSeite(s)) z.ohne_seite++;
    }
    if (istKaufFeld(s) || (sp && kaufImText(s))) { z.kostenpflichtig++; sm.kostenpflichtig++; }
  }
  for (const L of LAENDER) for (const z of Object.values(zellen[L])) {
    z.ausschuesse = z._aus.size; delete z._aus;
  }
  return { zellen, summe, ohne_land: ohneLand,
           gruppen_arten: Object.fromEntries(Object.entries(gruppenArten)
             .map(([g, a]) => [g, [...a].sort().slice(0, 40)])) };
}

/* ── Abgleich mit mb.param_modell ─────────────────────────────────────── */
async function dbAbgleich(q, alle, zellen) {
  let rows;
  try {
    rows = await q(`SELECT ags, land_code, kennzahl, zweig, berichtsjahr, quelle_url
                      FROM mb.param_modell`);
  } catch (e) { return { fehler: e.message }; }
  const dateiWert = new Map();
  const dateiMisch = new Map();
  for (const s of alle) {
    if (!s || !s.kennzahl) continue;
    const m = misch(s);
    if (!dateiMisch.has(m)) dateiMisch.set(m, []);
    dateiMisch.get(m).push(s);
    if (!istSperre(s)) dateiWert.set(voll(s), s);
  }
  for (const L of LAENDER) for (const z of Object.values(zellen[L])) { z.db_werte = 0; z.db_deckt = 0; }
  const summe = { zeilen: rows.length, deckt: 0, ueber_sperre: 0, fremde_url: 0, ohne_datei: 0 };
  const gedeckt = new Set();
  for (const r of rows) {
    const L = landVon(r);
    const k = kzVon(r.kennzahl);
    const z = L && zellen[L] ? (zellen[L][k] || (zellen[L][k] = leereZelle())) : null;
    if (z) { if (z.db_werte == null) { z.db_werte = 0; z.db_deckt = 0; } z.db_werte++; }
    const key = voll(r);
    if (dateiWert.has(key)) {
      summe.deckt++;
      if (z && !gedeckt.has(key)) z.db_deckt++;
      gedeckt.add(key);
      continue;
    }
    const gl = dateiMisch.get(misch(r));
    if (gl && gl.some(istSperre)) summe.ueber_sperre++;
    else if (gl) summe.fremde_url++;
    else summe.ohne_datei++;
  }
  summe.datei_ohne_db = [...dateiWert.keys()]
    .filter((k) => !gedeckt.has(k) && DB_KENNZAHLEN.includes(k.split('|')[1])).length;
  summe.db_liest = [...DB_KENNZAHLEN];
  return summe;
}

/* ── Zusammengefuehrte Liste „kostenpflichtig" ───────────────────────── */
const _MAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const _TEL = /(Tel(\.|efon)?\s*:?\s*)(\+?[\d][\d\s/()-]{5,}\d)/gi;
function kontaktAus(...texte) {
  const t = texte.filter((x) => typeof x === 'string').join(' ');
  const mails = [...new Set(t.match(_MAIL) || [])];
  const tels = [];
  let m; _TEL.lastIndex = 0;
  while ((m = _TEL.exec(t))) tels.push(m[3].trim());
  const r = [...mails, ...[...new Set(tels)].map((x) => 'Tel. ' + x)];
  return r.length ? r.slice(0, 4).join(' · ') : null;
}

function kaufListe(alle, quellenDb) {
  const eintr = new Map();
  const nachAgs = new Map();
  const neu = (key, basis) => {
    if (!eintr.has(key)) eintr.set(key, { land: basis.land, stelle: basis.stelle, ags: new Set(),
      kennzahlen: new Set(), fundorte: new Set(), grund: null, erkannt_aus: null,
      preis: null, bestell_url: null, quelle_url: null, kontakt: null, zugang: new Set(),
      saetze: 0 });
    return eintr.get(key);
  };
  const merkeAgs = (e, ags) => {
    if (!ags) return;
    e.ags.add(ags);
    if (!nachAgs.has(ags)) nachAgs.set(ags, e);
  };

  /* 1 + 2 · Register */
  for (const s of alle) {
    if (!s || !s.kennzahl) continue;
    const feld = istKaufFeld(s);
    const text = !feld && istSperre(s) ? kaufImText(s) : null;
    if (!feld && !text) continue;
    const L = landVon(s);
    const stelle = ausschussName(s);
    const e = neu((L || '?') + '|' + normName(stelle), { land: L, stelle });
    merkeAgs(e, String(s.ags));
    e.kennzahlen.add(kzVon(s.kennzahl));
    e.fundorte.add(feld ? 'register_zugang' : 'register_text');
    e.saetze++;
    if (s.zugang) e.zugang.add(String(s.zugang));
    if (!e.grund) e.grund = kurz(s.warum_kein_wert || s.unvollstaendig_grund || null);
    if (text && !e.erkannt_aus) e.erkannt_aus = kurz(text, 260);
    if (!e.preis && s.gebuehr) e.preis = kurz(s.gebuehr, 120);
    if (!e.bestell_url && s.bestell_url) e.bestell_url = s.bestell_url;
    if (!e.quelle_url && s.quelle_url) e.quelle_url = s.quelle_url;
    if (!e.kontakt) e.kontakt = kontaktAus(s.weg, s.zustaendige_stelle);
  }

  /* 3 · quellen_links.js, Ausschussebene */
  const findeAgs = (ags) => {
    for (const [a, e] of nachAgs) if (a.startsWith(ags) || ags.startsWith(a)) return e;
    return null;
  };
  for (const [ags, a] of Object.entries(AUSSCHUSS_QUELLEN)) {
    const zg = String(a.zugang || '').toLowerCase();
    if (!/kostenpflichtig|genehmigungspflichtig/.test(zg)) continue;
    const L = LC[ags.slice(0, 2)];
    const e = findeAgs(ags) || neu(L + '|' + normName(a.stelle), { land: L, stelle: maskiere(a.stelle) });
    merkeAgs(e, ags);
    e.fundorte.add('quellen_links');
    e.zugang.add(a.zugang);
    const w = a.warum_kein_wert;
    if (!e.grund) e.grund = kurz(typeof w === 'object' && w ? (w.alle || Object.values(w)[0]) : w);
    if (!e.quelle_url && a.url) e.quelle_url = a.url;
    if (!e.kontakt) e.kontakt = kontaktAus(a.hinweis);
  }
  /* 3b · quellen_links.js, Landesebene — eigener Eintrag je Land */
  const landEbene = [];
  for (const [k, l] of Object.entries(LAND_QUELLEN)) {
    if (!/kostenpflichtig/.test(String(l.zugang || ''))) continue;
    landEbene.push({ land: LC[k], stelle: maskiere(l.stelle), zugang: l.zugang, url: l.url,
                     hinweis: kurz(l.hinweis, 200) });
  }

  /* 4 · mb.gaa_sources */
  for (const r of quellenDb || []) {
    const zg = String(r.zugang || '').toLowerCase();
    if (!['kostenpflichtig', 'auf_anfrage', 'genehmigungspflichtig'].includes(zg)) continue;
    const L = String(r.bundesland || '').toUpperCase();
    const nn = normName(r.name);
    let e = eintr.get(L + '|' + nn) || null;
    if (!e) for (const a of r.ags_liste || []) { e = findeAgs(String(a)); if (e) break; }
    if (!e) {
      e = neu(L + '|' + nn, { land: L, stelle: maskiere(r.name) });
      for (const a of r.ags_liste || []) merkeAgs(e, String(a));
    }
    e.fundorte.add('gaa_sources');
    e.zugang.add(r.zugang);
    if (r.preis_eur != null) e.preis = Number(r.preis_eur).toLocaleString('de-DE',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' + (e.preis ? ' · ' + e.preis : '');
    if (r.bestell_url && !e.bestell_url) e.bestell_url = r.bestell_url;
    if (r.portal_url && !e.quelle_url) e.quelle_url = r.portal_url;
    if (!e.grund && r.notiz) e.grund = kurz(r.notiz);
    e.pruefstand = r.pruefstand || null;
  }

  /* Art: kostenpflichtig, sobald an IRGENDEINER Stelle Geld steht (Zugang,
     Preis, Wortlaut); sonst genehmigungspflichtig — dann ist der Wert frei
     lesbar, aber die Wiedergabe braucht eine Genehmigung. */
  const artVon = (e) => {
    const t = [...e.zugang, e.grund || '', e.erkannt_aus || '', e.preis || ''].join(' ');
    return /kostenpflichtig|geb(ü|ue)hr|€|auf_anfrage|voll(bericht|fassung|version)/i.test(t)
      ? 'kostenpflichtig' : 'genehmigungspflichtig';
  };
  const liste = [...eintr.values()].map((e) => ({
    land: e.land, stelle: e.stelle, art: artVon(e),
    ags: [...e.ags].sort().slice(0, 12), ags_anzahl: e.ags.size,
    kennzahlen: [...e.kennzahlen], fundorte: [...e.fundorte], zugang: [...e.zugang],
    saetze: e.saetze, grund: e.grund, erkannt_aus: e.erkannt_aus,
    preis: e.preis, bestell_url: e.bestell_url, quelle_url: e.quelle_url,
    kontakt: e.kontakt, pruefstand: e.pruefstand || null,
  })).sort((a, b) => String(a.land).localeCompare(String(b.land))
    || String(a.stelle).localeCompare(String(b.stelle), 'de'));
  const fundorte = {};
  for (const e of liste) for (const f of e.fundorte) fundorte[f] = (fundorte[f] || 0) + 1;
  return { liste, land_ebene: landEbene, fundorte };
}

/* ── Ernte-Eingang ─────────────────────────────────────────────────────── */
async function ernteEingang(q, laufStand) {
  const out = {};
  try {
    out.dokumente = await q(`SELECT s.bundesland AS land, d.status, count(*)::int AS n,
        max(d.gefunden_am) AS zuletzt
        FROM mb.gaa_documents d JOIN mb.gaa_sources s ON s.id = d.source_id
       GROUP BY 1, 2 ORDER BY 1, 2`);
    out.neueste = await q(`SELECT d.id, s.bundesland AS land, s.name AS quelle, d.titel, d.url,
        d.jahrgang, d.status, d.gefunden_am
        FROM mb.gaa_documents d JOIN mb.gaa_sources s ON s.id = d.source_id
       ORDER BY d.gefunden_am DESC LIMIT 40`);
    out.defekt = await q(`SELECT id, name, bundesland AS land, portal_url, letzter_check, notiz
        FROM mb.gaa_sources WHERE status = 'portal_defekt' ORDER BY bundesland, name`);
    out.quellen = await q(`SELECT status, count(*)::int AS n, max(letzter_check) AS zuletzt
        FROM mb.gaa_sources GROUP BY status ORDER BY 2 DESC`);
  } catch (e) { out.fehler = e.message; }
  for (const r of out.neueste || []) { r.titel = maskiere(r.titel); r.quelle = maskiere(r.quelle); }
  for (const r of out.defekt || []) { r.name = maskiere(r.name); r.notiz = kurz(r.notiz, 200); }
  const lauf = typeof laufStand === 'function' ? laufStand() : null;
  const zuletztCheck = (out.quellen || []).reduce((a, r) =>
    (r.zuletzt && (!a || new Date(r.zuletzt) > new Date(a)) ? r.zuletzt : a), null);
  out.takt = { ...(lauf || {}), letzter_check_quellen: zuletztCheck };
  return out;
}

/* ── Schnappschuss je Tag (mb.register_deckung_lauf, Migration 021) ──── */
async function schnappschuss(q, kopf) {
  const r = { heute_geschrieben: false, vergleich: null };
  try {
    const ins = await q(`INSERT INTO mb.register_deckung_lauf (gemessen_am, daten)
        VALUES (CURRENT_DATE, $1::jsonb) ON CONFLICT (gemessen_am) DO NOTHING
        RETURNING gemessen_am`, [JSON.stringify(kopf)]);
    r.heute_geschrieben = !!(ins && ins.length);
    /* Vergleich: der juengste Lauf, der mindestens 28 Tage zurueckliegt;
       gibt es keinen, der aelteste ueberhaupt (und das wird gesagt). */
    let v = await q(`SELECT gemessen_am, daten FROM mb.register_deckung_lauf
        WHERE gemessen_am <= CURRENT_DATE - 28 ORDER BY gemessen_am DESC LIMIT 1`);
    let monat = true;
    if (!v || !v.length) {
      v = await q(`SELECT gemessen_am, daten FROM mb.register_deckung_lauf
          WHERE gemessen_am < CURRENT_DATE ORDER BY gemessen_am ASC LIMIT 1`);
      monat = false;
    }
    const n = await q('SELECT count(*)::int AS n, min(gemessen_am) AS erster FROM mb.register_deckung_lauf');
    r.laeufe = n && n[0] ? n[0].n : 0;
    r.erster = n && n[0] ? n[0].erster : null;
    if (v && v.length) r.vergleich = { gemessen_am: v[0].gemessen_am, vor_monat: monat, daten: v[0].daten };
  } catch (e) { r.fehler = e.message; }
  return r;
}

/** Die ganze Auskunft. `q` ist die DB-Funktion aus db.js (liefert Zeilen). */
export async function registerDeckung({ q, laufStand, schreibeSchnappschuss = true } = {}) {
  const d = dateiTeil();
  const { zellen, summe, ohne_land, gruppen_arten } = zaehle(d.alle);
  let db = null, quellenDb = [];
  if (typeof q === 'function') {
    db = await dbAbgleich(q, d.alle, zellen);
    try {
      quellenDb = await q(`SELECT id, name, bundesland, zugang, preis_eur, bestell_url,
          portal_url, ags_liste, notiz, pruefstand FROM mb.gaa_sources`);
    } catch (e) { quellenDb = []; }
  }
  const kauf = kaufListe(d.alle, quellenDb);
  const ernte = typeof q === 'function' ? await ernteEingang(q, laufStand) : null;

  const laenderMitWert = {};
  for (const k of Object.keys(KZ_NAME)) {
    laenderMitWert[k] = LAENDER.filter((L) => zellen[L][k] && zellen[L][k].werte > 0).length;
  }
  const kopf = {
    saetze: d.alle.length, dateien: d.gelesen, summe,
    kostenpflichtig_stellen: kauf.liste.length,
    laender_mit_wert: laenderMitWert,
    zellen: Object.fromEntries(LAENDER.map((L) => [L, Object.fromEntries(
      Object.entries(zellen[L]).map(([k, z]) => [k, { w: z.werte, s: z.sperren }]))])),
  };
  const verlauf = (typeof q === 'function' && schreibeSchnappschuss)
    ? await schnappschuss(q, kopf) : null;

  return {
    gemessen_am: new Date().toISOString(),
    dateien: { gelesen: d.gelesen, vermisst: d.vermisst, nicht_in_liste: d.nicht_in_liste },
    saetze: d.alle.length, ohne_land,
    laender: LAENDER, land_name: LAND_NAME,
    kennzahlen: KZ_NAME, objektgruppen: OBJEKTGRUPPEN, gruppen_arten,
    summe, laender_mit_wert: laenderMitWert, zellen, db,
    kostenpflichtig: kauf, ernte, verlauf,
  };
}

/** Die Ausschuesse einer Zelle (Land x Kennzahl) — fuer den Klick. */
export function zellenListe(land, kz) {
  const d = dateiTeil();
  const L = String(land || '').toUpperCase();
  const m = new Map();
  for (const s of d.alle) {
    if (!s || !s.kennzahl || landVon(s) !== L || kzVon(s.kennzahl) !== kz) continue;
    const name = ausschussName(s);
    const key = normName(name);
    if (!m.has(key)) m.set(key, { stelle: name, ags: new Set(), werte: 0, sperren: 0,
      jahre: new Set(), url: null, url_jahr: -1, grund: null, kostenpflichtig: false,
      objekt: {}, dateien: new Set() });
    const e = m.get(key);
    e.ags.add(String(s.ags));
    e.dateien.add(s._datei);
    const sp = istSperre(s);
    const j = jahrVon(s);
    if (sp) e.sperren++; else e.werte++;
    if (j) e.jahre.add(j);
    if (s.quelle_url && (j || 0) >= e.url_jahr) { e.url = s.quelle_url; e.url_jahr = j || 0; }
    if (sp && !e.grund) e.grund = kurz(s.warum_kein_wert || s.unvollstaendig_grund, 240);
    if (istKaufFeld(s) || (sp && kaufImText(s))) e.kostenpflichtig = true;
    const g = objektgruppe(s.zweig).gruppe;
    const o = e.objekt[g] || (e.objekt[g] = { w: 0, s: 0 });
    if (sp) o.s++; else o.w++;
  }
  return [...m.values()].map((e) => ({
    stelle: e.stelle, ags: [...e.ags].sort().slice(0, 8), ags_anzahl: e.ags.size,
    werte: e.werte, sperren: e.sperren, jahrgaenge: [...e.jahre].sort(),
    url: e.url, grund: e.werte ? null : e.grund, kostenpflichtig: e.kostenpflichtig,
    objekt: e.objekt, dateien: [...e.dateien].sort(),
  })).sort((a, b) => (b.werte - a.werte) || a.stelle.localeCompare(b.stelle, 'de'));
}
