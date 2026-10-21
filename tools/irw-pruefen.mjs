#!/usr/bin/env node
/* v2620 · Prüft die Umrechnungskoeffizienten zum Immobilienrichtwert
   (register/uk-irw-*.json, Kennzahl `umrechnung_irw`) mit der ECHTEN Funktion
   (lib/vergleichswert_irw.js):

   1. Aufbau je Merkmal (Form, Eingabe aus dem kanonischen Katalog,
      Koeffizienten 0,3–3, Kurven aufsteigend, Matrix quadratisch mit 1 auf der Diagonale)
   2. Normbezug: am Normobjekt des Satzes ergibt jedes Merkmal 1,000
   3. Anwendungsbeispiel des amtlichen Dokuments: jeder gedruckte Koeffizient
      und das Ergebnis je m² (Prüfmaßstab, CLAUDE.md)
   4. Sperre trägt KEINE rechenbare formel
   5. Verfahrenswahl mit IRW (lib/verfahrenswahl.js, verfahrenMitIrw)

   Optional:
     --shape <pfad.dbf>  misst gegen das IRW-Shape (opengeodata.nrw.de), wie viele
                         Zonen je Satz ihr Normobjekt in den Tabellen abbilden können
     --live              rechnet die drei Testobjekte mit echten WMS-Abrufen

   RC=0 ist sauber. Die DECKUNG steht immer dabei. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HIER, '..', 'marktbericht', 'backend', 'src', 'lib');
const ORDNER = path.join(LIB, 'register');
const imp = (d) => import('file://' + path.join(LIB, d).replace(/\\/g, '/'));
const V = await imp('vergleichswert_irw.js');
const VW = await imp('verfahrenswahl.js');

const argv = process.argv.slice(2);
const SHAPE = argv.includes('--shape') ? argv[argv.indexOf('--shape') + 1] : null;
const LIVE = argv.includes('--live');

let saetze = 0, werte = 0, sperren = 0, beispiele = 0, ohneBeispiel = 0, rot = 0;
const fehler = (t) => { rot++; console.log('  FEHLER ' + t); };
const ARTEN = new Set(['klassen', 'kategorien', 'kurve', 'matrix', 'stichtag']);
const dateien = fs.readdirSync(ORDNER).filter((x) => x.startsWith('uk-irw-') && x.endsWith('.json')).sort();
const alle = [];
const schl = new Map();

for (const d of dateien) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(ORDNER, d), 'utf8')); } catch (e) { fehler(d + ': kein JSON — ' + e.message); continue; }
  for (const s of arr) {
    saetze++;
    const wo = `${d} ${s.gebiet_name || s.ags} ${s.zweig}`;
    if (s.kennzahl !== V.KENNZAHL) { fehler(wo + ': kennzahl ' + s.kennzahl); continue; }
    const k = [s.gasl, s.zweig, s.jahrgang].join('/');
    if (schl.has(k)) fehler(wo + ': doppelt (' + k + ') auch in ' + schl.get(k));
    schl.set(k, d);
    if (!s.gasl) fehler(wo + ': gasl fehlt (Gutachterausschusskennziffer, Schlüssel der Suche)');
    if (s.vollstaendig === false || s.warum_kein_wert) {
      sperren++;
      if (s.formel) fehler(wo + ': Sperre trägt formel — gehört nach formel_vorgemerkt');
      if (!s.warum_kein_wert) fehler(wo + ': Sperre ohne warum_kein_wert');
      continue;
    }
    werte++;
    alle.push({ ...s, _datei: d });
    for (const p of ['quelle_url', 'lizenz', 'stichtag', 'seite', 'jahrgang', 'belege', 'modellversion', 'quelle_parser', 'modellansaetze']) {
      if (s[p] == null || s[p] === '' || (Array.isArray(s[p]) && !s[p].length)) fehler(wo + ': ' + p + ' fehlt');
    }
    const f = s.formel || {};
    if (f.form !== 'irw_umrechnung') fehler(wo + ': formel.form ' + f.form);
    if (typeof f.stellplaetze_im_irw !== 'boolean') fehler(wo + ': formel.stellplaetze_im_irw muss true/false sein (Modell sagt, ob Stellplätze enthalten sind)');
    if (!s.geltungsbereich || !s.geltungsbereich.teilmarkt) fehler(wo + ': geltungsbereich.teilmarkt fehlt');
    if (V.TEILMAERKTE[s.geltungsbereich && s.geltungsbereich.teilmarkt] !== s.zweig) fehler(wo + ': zweig passt nicht zum Teilmarkt-Code');
    const ids = new Set();
    for (const m of f.merkmale || []) {
      const mw = wo + ' · ' + m.id;
      if (ids.has(m.id)) fehler(mw + ': id doppelt');
      ids.add(m.id);
      if (!ARTEN.has(m.art)) { fehler(mw + ': art ' + m.art); continue; }
      for (const e of [].concat(m.eingabe)) if (!V.EINGABEN[e]) fehler(mw + ': eingabe ' + e + ' nicht im kanonischen Katalog (EINGABEN)');
      const ukOk = (u) => u == null || (typeof u === 'number' && u >= 0.3 && u <= 3);
      if (m.art === 'klassen') {
        for (const kl of m.klassen || []) if (!ukOk(kl.uk)) fehler(mw + ': uk ' + kl.uk + ' in Klasse ' + kl.name);
        const num = (m.klassen || []).filter((kl) => kl.von != null || kl.bis != null);
        for (let i = 1; i < num.length; i++) {
          const a = num[i - 1], b = num[i];
          if (a.bis != null && b.von != null && b.von < a.bis) fehler(mw + ': Klassen überlappen (' + a.name + ' / ' + b.name + ')');
        }
      }
      if (m.art === 'kategorien') for (const [kk, u] of Object.entries(m.werte || {})) if (!ukOk(u)) fehler(mw + ': uk ' + u + ' bei ' + kk);
      if (m.art === 'kurve') {
        if (!Array.isArray(m.x) || m.x.length !== (m.uk || []).length || m.x.length < 2) fehler(mw + ': x/uk ungleich lang');
        for (let i = 1; i < m.x.length; i++) if (!(m.x[i] > m.x[i - 1])) fehler(mw + ': x nicht aufsteigend bei ' + m.x[i]);
        for (const u of m.uk || []) if (!ukOk(u)) fehler(mw + ': uk ' + u);
        if (!(m.uk || []).some((u) => u === 1)) console.log('  HINWEIS ' + mw + ': Kurve ohne Stützstelle 1,000 (Richtwertobjekt?)');
        const zw = (m.zweifel || []).map((z) => z.bei);
        for (const b of zw) if (!m.x.includes(b)) fehler(mw + ': zweifel bei ' + b + ' ist keine Stützstelle');
        if (zw.length) console.log('  HINWEIS ' + mw + ': ' + m.zweifel.map((z) => z.bei + ' — ' + z.grund).join('; '));
      }
      if (m.art === 'matrix') {
        const n = (m.kategorien || []).length;
        if (!n || (m.werte || []).length !== n || m.werte.some((z) => z.length !== n)) fehler(mw + ': Matrix nicht ' + n + '×' + n);
        else for (let i = 0; i < n; i++) if (m.werte[i][i] !== 1) fehler(mw + ': Diagonale ' + m.kategorien[i] + ' = ' + m.werte[i][i]);
      }
      /* Normbezug: Objekt = Norm ergibt 1 (nur wo die Norm im Satz steht) */
      if (m.art !== 'stichtag' && m.art !== 'matrix' && m.norm != null) {
        const o = {};
        const e0 = [].concat(m.eingabe);
        o[e0[e0.length - 1]] = m.norm;
        if (e0.length > 1) o[e0[0]] = m.norm;
        const r = V.merkmalFaktor({ ...m, zuordnung: { ...(m.zuordnung || {}) }, norm_feld: null }, o, null, f.normobjekt);
        if (!r.ok) fehler(mw + ': Norm ' + m.norm + ' nicht rechenbar — ' + r.text);
        else if (Math.abs(r.uk - 1) > 1e-9) fehler(mw + ': am Normobjekt ' + r.uk + ' statt 1');
      }
    }
    const p = V.pruefeBeispiel(s);
    if (p == null) { ohneBeispiel++; console.log('  HINWEIS ' + wo + ': kein Anwendungsbeispiel im Dokument — nur Aufbau und Normbezug geprüft'); }
    else if (!p.ok) fehler(wo + ': Anwendungsbeispiel ' + JSON.stringify(p.abw || p.fehler));
    else { beispiele++; console.log(`  ok ${wo}: Beispiel ${s.anwendungsbeispiel.seite || ''} getroffen (${Math.round(p.wert_qm)} €/m², ${p.faktoren} Merkmale)`); }
  }
}

/* ── Verfahrenswahl mit IRW ── */
let vwFaelle = 0;
const vw = (eingabe, soll) => {
  vwFaelle++;
  const r = VW.verfahrenMitIrw(eingabe);
  const ist = { fuehrend: r.fuehrend, zweites: (r.weitere || []).join(',') };
  if (ist.fuehrend !== soll.fuehrend || ist.zweites !== (soll.zweites || '')) fehler(`verfahrenMitIrw ${JSON.stringify(eingabe)} → ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`);
};
vw({ objektart: 'etw', wohneinheiten: 12, irw_vergleichswert: true }, { fuehrend: 'vergleichswert', zweites: 'ertragswert' });
vw({ objektart: 'etw', wohneinheiten: 12, irw_vergleichswert: false }, { fuehrend: null, zweites: '' });
vw({ objektart: 'efh', irw_vergleichswert: true, sachwertfaktor: true }, { fuehrend: 'sachwert', zweites: 'vergleichswert' });
vw({ objektart: 'efh', irw_vergleichswert: true, sachwertfaktor: false }, { fuehrend: 'vergleichswert', zweites: '' });
vw({ objektart: 'efh', irw_vergleichswert: false, sachwertfaktor: true }, { fuehrend: 'sachwert', zweites: '' });
vw({ objektart: 'zfh', irw_vergleichswert: true, sachwertfaktor: true }, { fuehrend: 'sachwert', zweites: 'vergleichswert' });
vw({ objektart: 'mfh', irw_vergleichswert: true }, { fuehrend: 'ertragswert', zweites: 'vergleichswert' });
vw({ objektart: 'mfh', irw_vergleichswert: false }, { fuehrend: 'ertragswert', zweites: '' });
vw({ objektart: 'wohnung', wohneinheiten: 2, irw_vergleichswert: true, sachwertfaktor: true }, { fuehrend: 'sachwert', zweites: 'vergleichswert' });

/* ── optional: Deckung gegen das Shape ── */
/* Minimaler DBF-Leser für die Attribute des IRW-Shapes (UTF-8, siehe .cpg). */
function liesDbf(pfad) {
  const b = fs.readFileSync(pfad);
  const n = b.readUInt32LE(4), kopf = b.readUInt16LE(8), satz = b.readUInt16LE(10);
  const felder = [];
  for (let o = 32; b[o] !== 0x0d; o += 32) felder.push({ name: b.toString('latin1', o, o + 11).split('\0')[0], len: b[o + 16] });
  const dec = new TextDecoder('utf-8'); const zeilen = [];
  for (let i = 0; i < n; i++) {
    let o = kopf + i * satz;
    if (b[o] === 0x2a) continue;
    o += 1; const z = {};
    for (const f of felder) { z[f.name] = dec.decode(b.subarray(o, o + f.len)).trim(); o += f.len; }
    zeilen.push(z);
  }
  return { felder, zeilen };
}
if (SHAPE) {
  {
    const { zeilen } = liesDbf(SHAPE);
    const ga = new Set(zeilen.map((z) => z.GASL));
    console.log(`SHAPE: ${zeilen.length} Zonen, ${ga.size} Ausschüsse, ${new Set(zeilen.map((z) => z.UDOK_URL)).size} Umrechnungsdokumente`);
    for (const s of alle) {
      const zonen = zeilen.filter((z) => z.GASL === s.gasl && V.TEILMAERKTE[Number(z.TEILMA)] === s.zweig);
      let ok = 0; const gruende = {};
      for (const z of zonen) {
        let gut = true;
        for (const m of s.formel.merkmale) {
          if (m.art === 'stichtag' || !m.norm_feld) continue;
          /* Objekt = Norm der Zone: dann muss jedes Merkmal rechenbar sein */
          const nv = (z[m.norm_feld] || '').trim();
          const o = {}; const e0 = [].concat(m.eingabe); o[e0[e0.length - 1]] = nv || m.norm;
          const mm = { ...m, zuordnung: { ...(m.zuordnung || {}), ...(m.norm_zuordnung || {}) } };
          const r = V.merkmalFaktor(mm, o, z, s.formel.normobjekt);
          if (!r.ok) { gut = false; gruende[m.id + ':' + r.grund] = (gruende[m.id + ':' + r.grund] || 0) + 1; }
        }
        if (gut) ok++;
      }
      console.log(`  ${s.gebiet_name} ${s.zweig}: ${ok}/${zonen.length} Zonen mit abbildbarem Normobjekt` + (Object.keys(gruende).length ? ' · ' + JSON.stringify(gruende) : ''));
    }
  }
}

/* ── optional: Testobjekte live ── */
if (LIVE) {
  const { IrwConnector } = await import('file://' + path.join(LIB, '..', 'connectors', 'IrwConnector.js').replace(/\\/g, '/'));
  /* Die drei Testobjekte aus CLAUDE.md, Eingaben wie in tools/wertermittlung-faelle.json.
     keller: NHK-Typ 1.12 ist unterkellert. Garage: beim Herforder EFH im Normobjekt enthalten. */
  const T = [
    { name: 'Hüllhorst, Hermannstr. 9 (ETW 165 m², Bj 1968)', lat: 52.2861968, lon: 8.656101, objektart: 'etw',
      objekt: { wohnflaeche: 165, baujahr: 1968, standardstufe: 4, modernisierungspunkte: 11, vermietet: true, einheiten: 2, keller: true } },
    { name: 'Hiddenhausen, Löhner Str. 278 (ZFH 233 m², Bj 1964)', lat: 52.1646636, lon: 8.6281328, objektart: 'zfh',
      objekt: { wohnflaeche: 233, baujahr: 1964, standardstufe: 3, modernisierungspunkte: 1, keller: true, grundstuecksflaeche: 700, anbauweise: 'freistehend', gebaeudeart: 'zfh', vermietet: true } },
    { name: 'Bielefeld, Westerfeldstr. 140 (MFH 390 m², Bj 1967, 4 WE)', lat: 52.0575061, lon: 8.5284083, objektart: 'mfh',
      objekt: { wohnflaeche: 390, baujahr: 1967, einheiten: 4, grundstuecksflaeche: 1570, vermietet: true, standardstufe: 3 } },
  ];
  for (const t of T) {
    const irw = await IrwConnector.hole({ lat: t.lat, lon: t.lon, objektart: t.objektart, anzahlWe: t.objekt.einheiten });
    const v = V.vergleichswertIrw({ irw, objekt: t.objekt, bog: t.bog || [] });
    console.log(`LIVE ${t.name}: IRW ${irw && irw.verfuegbar ? irw.wert_qm + ' €/m² (' + irw.gutachterausschuss + ')' : 'keiner (' + (irw && (irw.status || irw.grund)) + ')'}`);
    if (v.verfuegbar) { for (const z of v.rechenweg) console.log(`     ${z.pos.padEnd(34)} ${String(z.faktor ?? (z.wert + ' ' + z.einheit)).padStart(14)}  ${z.detail}`); }
    else console.log(`     kein Vergleichswert (${v.grund}): ${v.hinweis}`);
  }
}

console.log(`DECKUNG: ${dateien.length} Datei(en), ${saetze} Sätze (${werte} Werte, ${sperren} Sperren), `
  + `${beispiele} Anwendungsbeispiel(e) getroffen, ${ohneBeispiel} ohne Beispiel · Verfahrenswahl ${vwFaelle} Fälle`);
if (!saetze) { rot++; console.log('  -> NULL Sätze gelesen — kein grünes Ergebnis'); }
console.log('ERGEBNIS: ' + (rot ? rot + ' Fehler' : 'sauber'));
process.exit(rot ? 1 : 0);
