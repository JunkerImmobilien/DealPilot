import zlib from 'zlib';   /* v3021a · GENESIS liefert ZIP */
/* ═══════════════════════════════════════════════════════════════════════
   lib/destatis_reihen.js · v3021 — amtliche Preisreihen automatisch holen

   Marcel 28.10.2026: „den Wert bitte dann jedes Jahr automatisch neu
   ermitteln, und das müssen wir auch bei den Steuerdaten machen."

   ZWEI REIHEN, beide Statistisches Bundesamt:
     vpi   Verbraucherpreisindex Deutschland, Monatswerte, 2020 = 100
           (GENESIS 61111-0002). Gebraucht: Oktoberwerte für die
           Fortschreibung der Bewirtschaftungskosten (Anlage 3 ImmoWertV,
           AGVGA.NRW-Modell).
     bpi   Baupreisindex Neubau Wohngebäude (konventionell), einschl. USt,
           2021 = 100, Quartale I–IV = Feb/Mai/Aug/Nov (GENESIS 61261-0002).
           Gebraucht: Sachwert (§ 36 Abs. 2 ImmoWertV).

   ZWEI WEGE, gemessen 28.10.2026:
     1. GENESIS-Online-API (genesis.destatis.de/genesisWS/rest/2020) — braucht
        ein (kostenloses) Konto: ohne Zugangsdaten Code 15 „nicht berechtigt".
        Der vorhandene DESTATIS_TOKEN gilt nur für die Regionaldatenbank, und
        die führt weder 61111 noch 61261 (Code 104). Vorbereitet über
        GENESIS_TOKEN; ohne ihn bleibt Weg 1 aus.
     2. Die öffentlichen Tabellenseiten von destatis.de (ohne Konto):
          VPI  …/Preise/Verbraucherpreisindex/Tabellen/Verbraucherpreise-12Kategorien.html
          BPI  …/Konjunkturindikatoren/Preise/bpr110.html
        ACHTUNG: die Themenseite Konjunkturindikatoren (bpr110) wird laut
        Destatis „seit KW 43 2026 nicht mehr aktualisiert und Anfang 2027
        abgeschaltet". Für den Baupreisindex braucht es danach Weg 1.

   NIE ÜBERNOMMEN wird ein Wert, der die Plausibilitätsprüfung nicht besteht
   (pruefe()): außerhalb des Bandes, Sprung zur Vorperiode zu groß, oder ein
   im Code belegter Wert wird anders gelesen (dann misst der Parser falsch).
   Er landet als 'warnung' in mb.jahreswerte_abruf und wirkt nicht.
   ═══════════════════════════════════════════════════════════════════════ */

export const REIHEN = Object.freeze({
  vpi: {
    name: 'Verbraucherpreisindex Deutschland (2020 = 100)',
    basis: '2020=100',
    genesis: '61111-0002',
    genesis_filter: ['DG'],                 /* v3021a · Deutschland insgesamt */
    /* v3026 · Indexmiete (§ 557b BGB) braucht die Monate seit Vertragsbeginn bzw. letzter
       Anpassung - deshalb ab 2008 statt der letzten sechs Jahre (2008-01 = rund 82 auf 2020 = 100). */
    genesis_startjahr: 2008,
    seite: 'https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Verbraucherpreisindex/Tabellen/Verbraucherpreise-12Kategorien.html',
    band: [70, 250],
    sprung_max_pct: 3,      /* je Monat Abstand zum naechsten belegten Wert */
    schritt_monate: 1,
  },
  bpi: {
    name: 'Baupreisindex Neubau Wohngebäude, konventionell, einschl. USt (2021 = 100)',
    basis: '2021=100',
    genesis: '61261-0002',
    /* v3021a · gemessen: Wohngebäude (BPNBK), Bauleistungen am Bauwerk (BAULEISTBW), einschl. USt (STEMW1);
       August 2026 = 141,7 wie in lib/baupreisindex.js */
    genesis_filter: ['BPNBK', 'BAULEISTBW', 'STEMW1'],
    seite: 'https://www.destatis.de/DE/Themen/Wirtschaft/Konjunkturindikatoren/Preise/bpr110.html',
    band: [80, 300],
    sprung_max_pct: 5,      /* je Quartal Abstand */
    schritt_monate: 3,
  },
  /* v3026 · Index der Nettokaltmieten (Bund) - fortgeschrieben wird damit die Zensusmiete 2022
     (lib/zensus_miete.js NKM_INDEX). Gemessen 28.10.2026 an der echten GENESIS-Antwort:
     Tabelle 61111-0006 (VPI Deutschland, Monate, COICOP Sonderpositionen), Merkmal CC13B1
     „Verwendungszw. d. Individualkonsums, Sonderpositionen", Ausprägung CC13-73 „Nettokaltmiete";
     81 Monate 2020-01 bis 2026-09, Mai 2022 = 102,7, Sep 2026 = 111,9 - alle zehn im Code
     belegten Monate gleich. Die Länderreihe gäbe es als 61111-0021 (mit Konto abrufbar), sie
     bleibt bewusst aus: die Fortschreibung bleibt beim Bundesindex (Methodik).
     Weg 2: Seite „Sondergliederungen", Spalte „Nettokaltmiete" (Spalte per Kopf gesucht). */
  nkm: {
    name: 'Index der Nettokaltmieten, Deutschland (2020 = 100)',
    basis: '2020=100',
    genesis: '61111-0006',
    genesis_param: { classifyingvariable1: 'CC13B1', classifyingkey1: 'CC13-73' },
    genesis_filter: ['DG', 'CC13-73'],
    genesis_startjahr: 2020,
    seite: 'https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Verbraucherpreisindex/Tabellen/Verbraucherpreise-Sondergliederungen.html',
    seite_spalte: /^Nettokaltmiete\b/,
    band: [80, 250],
    sprung_max_pct: 1.5,    /* Mieten laufen langsam: 0,1-0,4 % je Monat */
    schritt_monate: 1,
  },
});

/* Abweichung, ab der ein schon belegter Wert als Lesefehler gilt (Prozent). */
export const BELEG_TOLERANZ_PCT = 0.5;

const MONATE = { jan: '01', feb: '02', 'mär': '03', mar: '03', apr: '04', mai: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dez: '12' };
const QUARTAL = { I: '02', II: '05', III: '08', IV: '11' };
const MONAT_LANG = { januar: '01', februar: '02', 'märz': '03', april: '04', mai: '05', juni: '06', juli: '07',
  august: '08', september: '09', oktober: '10', november: '11', dezember: '12' };

function zelle(s) {
  /* v3026 · weicher Trennstrich: die Seite schreibt Netto&shy;kaltmiete */
  return String(s).replace(/<[^>]+>/g, '').replace(/&shy;|\u00ad/g, '').replace(/&nbsp;/g, ' ').replace(/&auml;/g, 'ä')
    .replace(/&#228;/g, 'ä').replace(/\s+/g, ' ').trim();
}
function zahl(s) {
  const m = String(s || '').match(/^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|^-?\d+(?:,\d+)?/);
  return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : null;
}

/** „Stand 9. Oktober 2026" → '2026-10-09' (erste Fundstelle), sonst null. */
export function standAusSeite(html) {
  const m = String(html || '').replace(/&nbsp;/g, ' ').match(/Stand\s+(\d{1,2})\.\s*([A-Za-zäÄ]+)\s+(\d{4})/);
  if (!m) return null;
  const mo = MONAT_LANG[m[2].toLowerCase()];
  return mo ? m[3] + '-' + mo + '-' + String(m[1]).padStart(2, '0') : null;
}

/** Zeilen der ERSTEN Tabelle einer Seite als Zellen-Arrays. */
function ersteTabelle(html) {
  const t = String(html || '').split(/<table/i)[1];
  if (!t) return [];
  return t.split(/<tr/i).slice(1).map((r) => r.split(/<t[hd][^>]*>/i).slice(1).map(zelle));
}
/** v3026 · erste Tabelle, deren Kopfzeile eine Zelle nach `muster` führt → { zeilen, spalte } */
function tabelleMitSpalte(html, muster) {
  for (const t of String(html || '').split(/<table/i).slice(1)) {
    const zeilen = t.split(/<tr/i).slice(1).map((r) => r.split(/<t[hd][^>]*>/i).slice(1).map(zelle));
    const k = (zeilen[0] || []).findIndex((c) => muster.test(c));
    if (k > 0) return { zeilen, spalte: k };
  }
  return { zeilen: [], spalte: 1 };
}

/**
 * Tabellenseite → { 'JJJJ-MM': wert }. Spalte 1 nach Jahr/Periode ist die
 * Zielreihe (VPI: „insgesamt", BPI: „Wohngebäude") — so stehen beide Seiten,
 * gemessen 28.10.2026. Das Jahr steht nur in der ersten Zeile eines Jahres.
 */
export function parseTabellenseite(reihe, html) {
  const out = {};
  let jahr = null;
  const R = REIHEN[reihe] || {};
  const tab = R.seite_spalte ? tabelleMitSpalte(html, R.seite_spalte) : { zeilen: ersteTabelle(html), spalte: 1 };
  for (const z of tab.zeilen) {
    if (!z.length) continue;
    let i = 0;
    if (/^(19|20)\d{2}$/.test(z[0])) { jahr = z[0]; i = 1; }
    if (!jahr) continue;
    const per = (z[i] || '').replace(/\d+$/, '');   /* Fußnotenziffer „Apr1" */
    let mm = null;
    if (reihe === 'bpi') mm = QUARTAL[per] || null;
    else mm = MONATE[per.toLowerCase().slice(0, 3)] || null;
    if (!mm) continue;
    const w = zahl(z[i + tab.spalte]);
    if (w == null) continue;
    out[jahr + '-' + mm] = w;
  }
  return out;
}

/** Weg 2: öffentliche Tabellenseite holen und lesen. */
export async function holeSeite(reihe, { fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
  const R = REIHEN[reihe];
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(R.seite, { signal: ctl.signal, redirect: 'follow',
      headers: { 'User-Agent': 'DealPilot-Jahreswerte/1.0 (+https://dealpilot.de)' } });
    if (!r.ok) return { ok: false, grund: 'HTTP ' + r.status, weg: 'seite' };
    const html = await r.text();
    const werte = parseTabellenseite(reihe, html);
    if (!Object.keys(werte).length) return { ok: false, grund: 'Tabelle nicht lesbar (Seitenaufbau geändert?)', weg: 'seite' };
    return { ok: true, weg: 'seite', quelle_url: R.seite, quelle_stand: standAusSeite(html), werte,
      eingefroren: /nicht mehr aktualisiert/i.test(html) };
  } catch (e) {
    return { ok: false, grund: e.name === 'AbortError' ? 'Zeitüberschreitung' : e.message, weg: 'seite' };
  } finally { clearTimeout(t); }
}

/**
 * Weg 1: GENESIS-Online-API (ffcsv). Nur mit GENESIS_TOKEN (Konto bei
 * genesis.destatis.de). Ohne ihn: { ok:false, grund:'kein_genesis_token' }.
 * Der Leser ist auf das ffcsv-Format der GENESIS-Doku (v5) gebaut und noch
 * NICHT an einer echten Antwort gemessen — erster Lauf mit Token = Abnahme.
 */
export async function holeGenesis(reihe, { fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const tok = env.GENESIS_TOKEN || '';
  if (!tok) return { ok: false, grund: 'kein_genesis_token', weg: 'genesis' };
  const R = REIHEN[reihe];
  const base = env.GENESIS_BASE || 'https://genesis.destatis.de/genesisWS/rest/2020';
  const jahr = new Date().getFullYear();
  try {
    const body = new URLSearchParams({ name: R.genesis, area: 'all', compress: 'false', format: 'ffcsv',
      language: 'de', startyear: String(R.genesis_startjahr || jahr - 6), endyear: String(jahr),
      ...(R.genesis_param || {}) }).toString();   /* v3026 · Merkmal serverseitig eingrenzen (61111-0006 ist sonst gross) */
    const r = await fetchImpl(base + '/data/tablefile', { method: 'POST', body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', username: tok, password: env.GENESIS_PASSWORD || '' } });
    /* v3021a · GENESIS liefert die Tabelle als ZIP, auch mit compress=false (gemessen) */
    const buf = Buffer.from(await r.arrayBuffer());
    const txt = (buf[0] === 0x50 && buf[1] === 0x4b ? entpackeZip(buf) : buf).toString('utf8').replace(/^\uFEFF/, '');
    if (!r.ok || /^\s*\{/.test(txt)) return { ok: false, grund: 'GENESIS: ' + txt.slice(0, 200), weg: 'genesis' };
    const werte = parseGenesisFfcsv(reihe, txt);
    if (!Object.keys(werte).length) return { ok: false, grund: 'GENESIS-Antwort nicht lesbar', weg: 'genesis' };
    return { ok: true, weg: 'genesis', quelle_url: base + ' (' + R.genesis + ')', quelle_stand: null, werte };
  } catch (e) { return { ok: false, grund: e.message, weg: 'genesis' }; }
}

/* v3021a · eine Datei aus einem ZIP (Central Directory lesen, Deflate oder gespeichert) */
export function entpackeZip(buf) {
  const i = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  if (i < 0) return buf;
  const methode = buf.readUInt16LE(i + 10), csize = buf.readUInt32LE(i + 20), off = buf.readUInt32LE(i + 42);
  const n = buf.readUInt16LE(off + 26), m = buf.readUInt16LE(off + 28);
  const daten = buf.subarray(off + 30 + n + m, off + 30 + n + m + csize);
  return methode === 8 ? zlib.inflateRawSync(daten) : daten;
}

/** ffcsv (gemessen 28.10.2026): time; …_variable_attribute_code (MONATnn/QUARTn); value; value_unit.
 *  Prozent-Zeilen (Veränderungsraten) werden übersprungen; genesis_filter = Merkmalscodes, die
 *  alle in der Zeile vorkommen müssen. */
export function parseGenesisFfcsv(reihe, txt) {
  const zeilen = String(txt || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (zeilen.length < 2) return {};
  const kopf = zeilen[0].split(';').map((s) => s.replace(/"/g, '').trim());
  const iZeit = kopf.findIndex((k) => /^time$|^zeit$/i.test(k));
  const iWert = kopf.findIndex((k) => /^value$|wert$/i.test(k) && !/flag|qualit/i.test(k));
  const iEinh = kopf.findIndex((k) => /^value_unit$/i.test(k));
  const iCodes = kopf.map((k, i) => (/_variable_attribute_code$|_auspraegung_code$/i.test(k) ? i : -1)).filter((i) => i >= 0);
  const filter = (REIHEN[reihe] && REIHEN[reihe].genesis_filter) || [];
  if (iZeit < 0 || iWert < 0) return {};
  const out = {};
  for (const l of zeilen.slice(1)) {
    const c = l.split(';').map((s) => s.replace(/"/g, '').trim());
    if (iEinh >= 0 && /%/.test(c[iEinh] || '')) continue;
    const codes = iCodes.map((i) => c[i] || '');
    if (filter.some((f) => codes.indexOf(f) < 0)) continue;
    const j = c[iZeit];
    const code = codes.find((x) => /^(MONAT\d{2}|QUART\d)$/.test(x)) || '';
    let mm = null;
    let m = code.match(/MONAT(\d{2})/); if (m) mm = m[1];
    m = code.match(/QUART(\d)/); if (m) mm = ['02', '05', '08', '11'][Number(m[1]) - 1];
    const w = zahl(c[iWert]);
    if (!/^\d{4}$/.test(j) || !mm || w == null) continue;
    out[j + '-' + mm] = w;
  }
  return out;
}

/**
 * Plausibilität eines gelesenen Wertes.
 * @param {string} reihe
 * @param {string} periode  'JJJJ-MM'
 * @param {number} wert
 * @param {object} bekannt  { 'JJJJ-MM': wert } – im Code belegte UND aktive DB-Werte
 * @returns {{ ok:boolean, status:'aktiv'|'warnung'|'gleich', pruefung:string }}
 */
export function pruefe(reihe, periode, wert, bekannt = {}) {
  const R = REIHEN[reihe];
  if (!(Number.isFinite(wert))) return { ok: false, status: 'warnung', pruefung: 'keine Zahl' };
  if (wert < R.band[0] || wert > R.band[1]) return { ok: false, status: 'warnung', pruefung: 'außerhalb des Bandes ' + R.band.join('–') };
  if (bekannt[periode] != null) {
    const abw = Math.abs(wert / bekannt[periode] - 1) * 100;
    if (abw === 0) return { ok: true, status: 'gleich', pruefung: 'wie belegt' };
    if (abw > BELEG_TOLERANZ_PCT) return { ok: false, status: 'warnung', pruefung: 'weicht vom belegten Wert ' + bekannt[periode] + ' um ' + abw.toFixed(2) + ' % ab (Lesefehler oder Revision - von Hand prüfen)' };
    return { ok: true, status: 'gleich', pruefung: 'Revision unter ' + BELEG_TOLERANZ_PCT + ' % (' + bekannt[periode] + ' → ' + wert + '), belegter Wert bleibt' };
  }
  /* naechster bekannter Wert (davor oder danach); die Grenze waechst mit dem Abstand */
  const mon = (k) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7));
  const nah = Object.keys(bekannt).sort((x, y) => Math.abs(mon(x) - mon(periode)) - Math.abs(mon(y) - mon(periode)) || (x < y ? -1 : 1))[0];
  if (nah) {
    const abstand = Math.abs(mon(nah) - mon(periode));
    const grenze = R.sprung_max_pct * Math.max(1, abstand / R.schritt_monate);
    const spr = Math.abs(wert / bekannt[nah] - 1) * 100;
    if (spr > grenze) return { ok: false, status: 'warnung', pruefung: 'Sprung ' + spr.toFixed(1) + ' % gegen ' + nah + ' (Grenze ' + grenze.toFixed(1) + ' %)' };
    return { ok: true, status: 'aktiv', pruefung: 'Sprung ' + spr.toFixed(1) + ' % gegen ' + nah + ' (Grenze ' + grenze.toFixed(1) + ' %)' };
  }
  return { ok: false, status: 'warnung', pruefung: 'kein belegter Wert zum Vergleich' };
}
