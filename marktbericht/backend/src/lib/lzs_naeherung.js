// lzs_naeherung.js — v2400 · DIE DEALPILOT-FORMEL FUER DEN LIEGENSCHAFTSZINSSATZ (Stufe N)
//
// Abgeleitet aus allen amtlichen Wohn-Liegenschaftszinssaetzen des Registers
// (tools/lzs-naeherung-ableiten.mjs -> lib/lzs-naeherung.json, nach jeder
// Ernte neu):
//
//     LZS [%] = c + a_ETW + a_MFH + a_WGH + r * RND/10 + s * Stadt
//
// Marcel 19.10.2026 freigegeben, mit einer EIGENEN Stufe N zwischen C und D:
// „N · DealPilot-Formel — abgeleitet aus allen amtlichen Werten, nie amtlich".
//
// WO SIE GILT (und nur dort; sonst bleibt es bei § 256 BewG, Stufe D):
//   - Wohnnutzung: Ein-/Zweifamilien-, Doppel-, Reihenhaus, Wohnungseigentum,
//     Mehrfamilienhaus, Wohn- und Geschaeftshaus. Nie Gewerbe, Buero, Handel.
//   - RND 5 bis 80 Jahre (Gueltigkeitsbereich der Ableitung). Ohne RND die
//     mittlere RND der Objektfamilie aus der Ableitung (rnd_ersatz).
//   - NUR in Laendern, in denen sie GEMESSEN genauer ist als § 256 BewG
//     (Leave-one-Land-out je Land, `pruefung.je_land` der JSON). Ein Land ohne
//     Messung ist kein Land, in dem sie besser ist.
//   - NIE, wo der Ausschuss einen Satz fuehrt — auch keinen gesperrten. Das
//     prueft der Aufrufer (WertParameterService), weil nur er das Register
//     fuer diese AGS gefragt hat.
//
// Kein Kern im Sinne von CLAUDE.md (liest keine Einstellungen, rechnet nur
// aus Parametern und der JSON).
import { readFileSync } from 'node:fs';

let _D = null;
export function lzsNaeherungsDaten() {
  if (_D !== null) return _D;
  try { _D = JSON.parse(readFileSync(new URL('./lzs-naeherung.json', import.meta.url), 'utf8')); }
  catch (e) { _D = false; }
  return _D;
}

const LAND = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP',
  '08': 'BW', '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };
export function landAusAgs(ags) {
  const a = String(ags || '').replace(/\D/g, '');
  return LAND[a.slice(0, 2)] || null;
}

/** Laender, in denen die Formel im Leave-one-Land-out-Median genauer ist als § 256 BewG. */
export function lzsNaeherungLaender(d = lzsNaeherungsDaten()) {
  const j = (d && d.pruefung && d.pruefung.je_land) || {};
  return Object.keys(j).filter((l) => {
    const f = Number(j[l].formel_median_pp), b = Number(j[l].bewg256_median_pp);
    return Number.isFinite(f) && Number.isFinite(b) && f < b;
  }).sort();
}

const GEWERBE = /gewerbe|b(?:ue|ü)ro|handel|laden|lager|hotel|gastro|praxis|logistik|produktion|sonder|garage|stellplatz|parkhaus|tankstelle|pflege|klinik/;
function familieAus(t, anzahlWe) {
  const s = String(t || '').toLowerCase().trim();
  if (!s) return null;
  if (/wgh|wohn-?\s*und\s*gesch|gesch(?:ae|ä)ftshaus|gemischt|^ggg$|^gh$/.test(s)) return 'WGH';
  if (/etw|wohnung|whg|apartment|appartement|^we(_|$)/.test(s)) return 'ETW';
  if (/mfh|mehrfamilien|dreifamilien|dreifh/.test(s)) return 'MFH';
  if (/^(efh|zfh|ezfh|dhh|rh|reh|rmh|rhdhh)\b|einfamilien|zweifamilien|doppel|reihen|villa|bungalow/.test(s)) return 'EZFH';
  if (/^haus$/.test(s)) {
    const we = Number(anzahlWe);
    if (Number.isFinite(we) && we >= 3) return 'MFH';
    if (Number.isFinite(we) && we >= 1) return 'EZFH';
    return null;   /* „haus" ohne Hausart und ohne WE: keine Familie, kein Wert */
  }
  return null;
}
/** Objektfamilie der Ableitung (EZFH/ETW/MFH/WGH) oder null (Gewerbe, unbekannt). */
export function lzsFamilie(objektart, objart = null, anzahlWe = null) {
  const alle = String(objart || '') + ' ' + String(objektart || '');
  if (GEWERBE.test(alle.toLowerCase())) return null;
  return familieAus(objart, anzahlWe) || familieAus(objektart, anzahlWe);
}

/** Stadt im Sinne der Ableitung: Stadtstaat oder kreisfreie Stadt (8-stellige AGS auf 000). */
export function lzsStadt(ags) {
  const a = String(ags || '').replace(/\D/g, '');
  if (/^(02|04|11)/.test(a)) return 1;
  if (a.length >= 8 && a.slice(5, 8) === '000') return 1;
  return 0;
}

const de = (x, n = 2) => (x == null ? '–' : Number(x).toFixed(n).replace('.', ','));

/**
 * Die Formel fuer ein Objekt.
 * @returns {{verfuegbar:true, pct:number, familie, rnd, rnd_quelle, stadt, land, formel, hinweis}
 *          |{verfuegbar:false, grund:string, hinweis?:string}}
 */
export function lzsNaeherung({ ags, objektart, objart = null, anzahlWe = null, rnd = null }) {
  const nein = (grund, hinweis) => ({ verfuegbar: false, grund, hinweis: hinweis || null });
  const d = lzsNaeherungsDaten();
  if (!d || !d.koeffizienten || d.verdrahtet === false) return nein('keine_formel');
  const land = landAusAgs(ags);
  if (!land) return nein('kein_land');
  const laender = lzsNaeherungLaender(d);
  if (laender.indexOf(land) < 0) {
    const jl = (d.pruefung.je_land || {})[land];
    return nein('land_nicht_besser', jl
      ? 'In ' + land + ' ist die DealPilot-Formel gemessen nicht genauer als § 256 BewG (Median '
        + de(jl.formel_median_pp) + ' gegen ' + de(jl.bewg256_median_pp) + ' Prozentpunkte) — es bleibt beim gesetzlichen Auffangwert.'
      : 'Für ' + land + ' liegt keine Messung der DealPilot-Formel vor — es bleibt beim gesetzlichen Auffangwert.');
  }
  const F = lzsFamilie(objektart, objart, anzahlWe);
  if (!F) return nein('keine_wohnnutzung');
  const g = d.gilt_fuer || {};
  const von = Number(g.rnd_von || 5), bis = Number(g.rnd_bis || 80);
  let r = (rnd == null || rnd === '') ? null : Number(rnd);
  let rndQuelle = 'objekt';
  if (r == null || !Number.isFinite(r)) {
    r = Number((d.rnd_ersatz || {})[F]);
    rndQuelle = 'ersatz';
    if (!Number.isFinite(r)) return nein('rnd_fehlt');
  }
  if (r < von || r > bis) {
    return nein('rnd_ausserhalb', 'Die Restnutzungsdauer von ' + Math.round(r) + ' Jahren liegt außerhalb des Bereichs, für den die '
      + 'DealPilot-Formel abgeleitet ist (' + von + ' bis ' + bis + ' Jahre).');
  }
  const k = d.koeffizienten;
  const stadt = lzsStadt(ags);
  const roh = Number(k.c) + (F === 'ETW' ? Number(k.ETW) : 0) + (F === 'MFH' ? Number(k.MFH) : 0)
    + (F === 'WGH' ? Number(k.WGH) : 0) + Number(k.je_10_jahre_rnd) * r / 10 + Number(k.stadt) * stadt;
  const pct = Math.round(roh * 100) / 100;
  if (!(pct > 0)) return nein('nicht_positiv');
  const saetze = Number((d.daten || {}).saetze) || null;
  const lolo = (d.pruefung && d.pruefung.lolo) || {};
  const jl = (d.pruefung.je_land || {})[land] || {};
  const abw = Math.round(Number(lolo.median_pp) * 10) / 10;
  return {
    verfuegbar: true, pct, familie: F, rnd: r, rnd_quelle: rndQuelle, stadt, land,
    formel: {
      stand: d.stand || null, saetze, ausschuesse: (d.daten || {}).ausschuesse || null,
      laender: (d.daten || {}).laender || [], koeffizienten: k,
      abweichung_median_pp: Number(lolo.median_pp), abweichung_p90_pp: Number(lolo.p90_pp),
      land_median_pp: jl.formel_median_pp ?? null, land_bewg256_median_pp: jl.bewg256_median_pp ?? null,
    },
    hinweis: 'Liegenschaftszinssatz abgeleitet aus der DealPilot-Formel (Stufe N) — aus ' + (saetze || '?')
      + ' amtlichen Liegenschaftszinssätzen der Gutachterausschüsse abgeleitet, typische Abweichung '
      + de(abw, 1) + ' Prozentpunkte; nicht amtlich. '
      + 'Rechenweg: ' + de(k.c, 3)
      + (F === 'ETW' ? ' + ' + de(k.ETW, 3) + ' (Wohnungseigentum)' : '')
      + (F === 'MFH' ? ' + ' + de(k.MFH, 3) + ' (Mehrfamilienhaus)' : '')
      + (F === 'WGH' ? ' + ' + de(k.WGH, 3) + ' (Wohn- und Geschäftshaus)' : '')
      + ' + ' + de(k.je_10_jahre_rnd, 3) + ' × ' + de(r / 10, 1) + ' (RND ' + Math.round(r) + ' Jahre'
      + (rndQuelle === 'ersatz' ? ', mittlere RND der Objektart' : '') + ')'
      + (stadt ? ' ' + (Number(k.stadt) < 0 ? '− ' + de(-k.stadt, 3) : '+ ' + de(k.stadt, 3)) + ' (Stadt)' : '')
      + ' = ' + de(pct) + ' %. '
      + 'Genauer: den Liegenschaftszinssatz des zuständigen Gutachterausschusses eintragen.',
  };
}
