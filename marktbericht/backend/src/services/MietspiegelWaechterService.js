/* ═══════════════════════════════════════════════════════════════════════
   services/MietspiegelWaechterService.js · v5080 — Wächter über die Mietspiegel-Quellen

   Marcel 26.11.2026: „rufen wir das auch regelmäßig ab?" Bis hier gab es keinen Takt: neue Ausgaben (meist alle
   zwei Jahre) und abgelaufene Mietspiegel fielen niemandem auf.

   Täglich geprüft, je Quelle frühestens nach 30 Tagen wieder (also monatlich): die Quellseite jeder Wertedatei
   und jedes Verzeichnis-Satzes, GET der ersten 64 KB. Kennung = ETag | Last-Modified | Länge | SHA-1 des Anfangs.
   Weicht sie von der Basis ab, steht die Quelle auf 'geaendert'. Abgelaufen ist eine Wertedatei, deren
   gueltig_bis (oder bei qualifizierten die Vermutungsfrist des Verzeichnisses) vor heute liegt.

   Übernommen wird NICHTS. Admin › Betrieb (backend/src/services/betrieb.js) liest GET /mietspiegel/waechter und
   meldet gelb, die Wochenmail an support@ nimmt es mit. Eine neue Ausgabe erntet ein Agent und legt sie zur
   Prüfung vor; danach setzt quittieren(ags) die Basis neu.
   ═══════════════════════════════════════════════════════════════════════ */
import crypto from 'node:crypto';
/* db.js erst beim ersten echten Lauf (wie lib/taktSperre.js), damit Prüfer die reinen Teile ohne pg laden */
const q = async (sql, p) => (await import('../lib/db.js')).q(sql, p);
import { takt as _taktSperre } from '../lib/taktSperre.js';
import { werteLaden } from '../lib/mietspiegel/werte.js';
import { verzeichnisLaden } from '../lib/mietspiegel/verzeichnis.js';

export const TAKT_MS = 24 * 3600 * 1000;
export const ABSTAND_TAGE = 30;
const PAUSE_MS = 1500, ZEIT_MS = 20000, ANFANG_BYTES = 65536;
const UA = process.env.OPENDATA_USER_AGENT || 'DealPilot/1.0';

function verzeichnis() { try { return verzeichnisLaden(); } catch (e) { return null; } }
/** Sätze des Verzeichnisses (verzeichnisLaden liefert jeAgs; ein Test darf { saetze: [...] } geben) */
function saetzeAus(V) { return !V ? [] : Array.isArray(V.saetze) ? V.saetze : V.jeAgs ? [...V.jeAgs.values()] : []; }

/** Alle zu beobachtenden Quellen: Wertedateien zuerst, dann die Verzeichnis-Sätze mit URL (ohne Dubletten). */
export function quellen(werteMap, vz) {
  const W = werteMap || werteLaden().jeAgs, V = vz === undefined ? verzeichnis() : vz;
  const out = [], gesehen = new Set();
  const dazu = (ags, url, art) => {
    if (!url || !/^https?:\/\//.test(url) || gesehen.has(ags + '|' + url)) return;
    gesehen.add(ags + '|' + url); out.push({ ags, url, art });
  };
  for (const [ags, w] of W) dazu(ags, w && w.quelle && w.quelle.url, 'werte');
  for (const s of saetzeAus(V)) dazu(s.ags, s.url, 'verzeichnis');
  return out;
}

/** Kennung einer Antwort (rein): ETag, Last-Modified, Länge, Hash des Anfangs */
export function kennungAus(kopf, anfang) {
  const g = (k) => (kopf && kopf[k]) || '';
  const hash = anfang && anfang.length ? crypto.createHash('sha1').update(anfang).digest('hex').slice(0, 16) : '';
  return [g('etag'), g('last-modified'), g('content-length'), hash].join('|');
}
/** Zwei Kennungen gleich? Leere Teile zählen nicht (manche Server senden ein Feld mal mit, mal ohne). */
export function kennungGleich(a, b) {
  if (!a || !b) return a === b;
  const A = a.split('|'), B = b.split('|');
  let verglichen = 0;
  for (let i = 0; i < 4; i++) { if (A[i] && B[i]) { verglichen++; if (A[i] !== B[i]) return false; } }
  return verglichen > 0 ? true : a === b;
}

async function abrufen(url) {
  try {
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-' + (ANFANG_BYTES - 1) },
      redirect: 'follow', signal: AbortSignal.timeout(ZEIT_MS) });
    const buf = Buffer.from(await r.arrayBuffer()).subarray(0, ANFANG_BYTES);
    /* Stadtseite statt PDF: Sitzungskennungen und Zeitstempel im Text wechseln bei jedem Abruf. Dann zählt nur der
       Text ohne Skripte, lange Hex-Folgen und Ziffern. */
    const typ = String(r.headers.get('content-type') || '');
    const html = /html/i.test(typ);
    const anfang = html ? Buffer.from(buf.toString('utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/[0-9a-f]{12,}/gi, '').replace(/\d+/g, '')) : buf;
    const laenge = r.status === 206 ? String(r.headers.get('content-range') || '').split('/')[1] : r.headers.get('content-length');
    const kopf = html ? {} : { etag: r.headers.get('etag'), 'last-modified': r.headers.get('last-modified'), 'content-length': laenge || '' };
    return { status: r.status, kennung: kennungAus(kopf, anfang) };
  } catch (e) { return { status: null, fehler: (e && e.message) || String(e) }; }
}

/** Ein Durchgang: fällige Quellen abfragen. opt.alle = auch nicht fällige. Gibt die Zählung zurück. */
export async function durchgang(opt = {}) {
  const liste = quellen(), z = { geprueft: 0, gleich: 0, geaendert: 0, neu: 0, fehler: 0, uebersprungen: 0 };
  const alt = new Map((await q('SELECT ags, url, kennung_basis, geprueft_am, status FROM mb.mietspiegel_waechter')).map((r) => [r.ags + '|' + r.url, r]));
  for (const s of liste) {
    const a = alt.get(s.ags + '|' + s.url);
    if (!opt.alle && a && a.geprueft_am && Date.now() - new Date(a.geprueft_am).getTime() < ABSTAND_TAGE * 86400000) { z.uebersprungen++; continue; }
    const r = await abrufen(s.url);
    z.geprueft++;
    let status, basis = a ? a.kennung_basis : null;
    if (!r.kennung || !(r.status >= 200 && r.status < 400)) { status = 'fehler'; z.fehler++; }
    else if (!basis) { status = 'neu'; basis = r.kennung; z.neu++; }
    else if (kennungGleich(basis, r.kennung)) { status = a.status === 'geaendert' ? 'geaendert' : 'gleich'; z[status]++; }
    else { status = 'geaendert'; z.geaendert++; }
    /* ein Abruffehler hebt 'geaendert' nicht auf; die Basis setzt nur der erste erfolgreiche Abruf oder quittieren() */
    await q(`INSERT INTO mb.mietspiegel_waechter (ags, url, art, kennung, kennung_basis, http_status, status, fehler, geprueft_am, geaendert_am)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), CASE WHEN $7 = 'geaendert' THEN NOW() END)
             ON CONFLICT (ags, url) DO UPDATE SET
               kennung = COALESCE(EXCLUDED.kennung, mb.mietspiegel_waechter.kennung),
               kennung_basis = COALESCE(mb.mietspiegel_waechter.kennung_basis, EXCLUDED.kennung_basis),
               http_status = EXCLUDED.http_status, fehler = EXCLUDED.fehler, geprueft_am = NOW(),
               geaendert_am = CASE WHEN EXCLUDED.status = 'geaendert' AND mb.mietspiegel_waechter.status <> 'geaendert' THEN NOW()
                                   ELSE mb.mietspiegel_waechter.geaendert_am END,
               status = CASE WHEN EXCLUDED.status = 'fehler' AND mb.mietspiegel_waechter.status = 'geaendert' THEN 'geaendert'
                             ELSE EXCLUDED.status END`,
      [s.ags, s.url, s.art, r.kennung || null, basis, r.status, status, r.fehler || null]);
    await new Promise((ok) => setTimeout(ok, PAUSE_MS));
  }
  return z;
}

/** Nach der Ernte einer neuen Ausgabe: Basis neu setzen. */
export async function quittieren(ags) {
  await q(`UPDATE mb.mietspiegel_waechter SET kennung_basis = kennung, status = 'gleich', geaendert_am = NULL WHERE ags = $1`, [String(ags)]);
}

/** abgelaufene Wertedateien (rein, heute 'JJJJ-MM-TT'): gueltig_bis der Datei, sonst des Verzeichnisses, bei
    qualifizierten sonst die Vermutungsfrist (§ 558d Abs. 2 BGB). */
export function abgelaufen(heute, werteMap, vz) {
  const V = new Map(saetzeAus(vz).map((s) => [s.ags, s]));
  const out = [];
  for (const [ags, w] of werteMap) {
    const s = V.get(ags) || {};
    /* angekündigte nächste Ausgabe (JJJJ, JJJJ-MM oder Datum) zählt als Ende, wenn sonst nichts dasteht */
    const naechste = w.naechste_ausgabe ? String(w.naechste_ausgabe) + (String(w.naechste_ausgabe).length === 4 ? '-12-31' : String(w.naechste_ausgabe).length === 7 ? '-28' : '') : null;
    const bis = w.gueltig_bis || s.gueltig_bis || (w.art === 'qualifiziert' ? s.vermutung_bis : null) || naechste || null;
    if (bis && String(bis).slice(0, 10) < heute) out.push({ ags, gemeinde: w.gemeinde, art: w.art, stand: w.stand, bis: String(bis).slice(0, 10),
      herkunft: w.gueltig_bis ? 'datei' : (s.gueltig_bis ? 'verzeichnis' : (w.art === 'qualifiziert' && s.vermutung_bis) ? 'vermutungsfrist' : 'naechste_ausgabe') });
  }
  return out.sort((a, b) => (a.bis < b.bis ? -1 : 1));
}

/** Stand für Admin › Betrieb (GET /mietspiegel/waechter) */
export async function stand() {
  const zeilen = await q('SELECT ags, url, art, status, http_status, fehler, geprueft_am, geaendert_am FROM mb.mietspiegel_waechter');
  const W = werteLaden().jeAgs, V = verzeichnis();
  const vn = new Map(saetzeAus(V).map((s) => [s.ags, s.gemeinde]));
  const nm = (ags) => (W.get(ags) && W.get(ags).gemeinde) || vn.get(ags) || ags;
  const letzter = zeilen.reduce((m, r) => (r.geprueft_am && (!m || r.geprueft_am > m) ? r.geprueft_am : m), null);
  return {
    quellen: quellen(W, V).length, geprueft: zeilen.filter((r) => r.geprueft_am).length, letzter_lauf: letzter,
    geaendert: zeilen.filter((r) => r.status === 'geaendert').map((r) => ({ ags: r.ags, gemeinde: nm(r.ags), url: r.url, art: r.art, seit: r.geaendert_am })),
    fehler: zeilen.filter((r) => r.status === 'fehler').length,
    abgelaufen: abgelaufen(new Date().toISOString().slice(0, 10), W, V),
  };
}

export function starteMietspiegelWaechter() {
  if (String(process.env.MIETSPIEGEL_WAECHTER || '1') !== '1') { console.log('[mietspiegel] Wächter aus (MIETSPIEGEL_WAECHTER=0)'); return; }
  const _dg = _taktSperre('mietspiegel', async () => {
    const z = await durchgang();
    console.log('[mietspiegel] Wächter: ' + JSON.stringify(z));
    return z;
  });
  setTimeout(_dg, 20 * 60 * 1000);
  setInterval(_dg, TAKT_MS);
  console.log('[mietspiegel] Wächter an: täglich, je Quelle alle ' + ABSTAND_TAGE + ' Tage');
}
