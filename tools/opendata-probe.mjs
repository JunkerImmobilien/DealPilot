#!/usr/bin/env node
// opendata-probe.mjs  (OD-02)
//
// Misst die Adressen aus laender-registry.js durch, BEVOR ein Parser gebaut wird.
// Das ist die Umsetzung der Lehre "erst die Adressen pruefen, dann das Werkzeug
// abschreiben" — der Crawler galt als untauglich, weil er auf Startseiten statt
// auf Verteilerseiten geschickt wurde.
//
// Das Skript LAEDT KEINE DATEN HERUNTER und schreibt NICHTS in die DB.
// Es holt je Adresse hoechstens die ersten Bytes und meldet Status/Typ/Groesse.
//
// Regeln, die hart eingebaut sind:
//   - ein Abruf je Sekunde (RATE_MS)
//   - eigene Kennung aus OPENDATA_USER_AGENT (ohne: Abbruch)
//   - Eintraege mit commercial 'gebuehr' oder 'captcha' werden NIE angefasst
//
// Aufruf:
//   OPENDATA_USER_AGENT="DealPilot/1.0 (+mail@dealpilot.immo)" \
//     node tools/opendata-probe.mjs            # alles
//   ... node tools/opendata-probe.mjs bb ni    # nur einzelne Laender
//   ... node tools/opendata-probe.mjs --json   # maschinenlesbar

import { BUND, LAENDER } from '../marktbericht/backend/src/connectors/opendata/laender-registry.js';

const RATE_MS = 1000;
const TIMEOUT_MS = 15000;
const UA = process.env.OPENDATA_USER_AGENT || '';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const nurCodes = args.filter((a) => !a.startsWith('--')).map((s) => s.toLowerCase());

if (!UA) {
  console.error('ABBRUCH: OPENDATA_USER_AGENT ist nicht gesetzt.');
  console.error('Ohne eigene Kennung mit Kontakt wird nicht abgerufen. Das ist Absicht.');
  process.exit(2);
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

function istUrl(v) {
  return typeof v === 'string' && /^https?:\/\//.test(v) && !/[{}]/.test(v);
}

/** Adressen eines Eintrags einsammeln (Muster mit {..} werden uebersprungen). */
function adressen(eintrag) {
  const out = [];
  for (const [schluessel, wert] of Object.entries(eintrag.quellen || {})) {
    if (istUrl(wert)) out.push({ schluessel, url: wert });
  }
  return out;
}

async function messen(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, Accept: '*/*' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const typ = (res.headers.get('content-type') || '').split(';')[0] || '?';
    const laengeKopf = parseInt(res.headers.get('content-length') || '', 10);
    // Nur anlesen, nicht herunterladen: erster Chunk reicht fuer die Signatur.
    let ersteBytes = 0;
    let signatur = '';
    if (res.body) {
      const leser = res.body.getReader();
      const { value } = await leser.read();
      if (value) {
        ersteBytes = value.length;
        signatur = new TextDecoder('utf-8', { fatal: false })
          .decode(value.slice(0, 8))
          .replace(/[^\x20-\x7e]/g, '.');
      }
      try { await leser.cancel(); } catch { /* egal */ }
    }
    return {
      ok: res.ok, status: res.status, typ,
      bytes: Number.isFinite(laengeKopf) ? laengeKopf : null,
      ersteBytes, signatur, ms: Date.now() - start,
    };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: 0, typ: '-', bytes: null, ersteBytes: 0, signatur: '', ms: Date.now() - start, fehler: e.name === 'AbortError' ? 'timeout' : e.message };
  }
}

function urteil(m, eintrag) {
  if (!m.ok) return 'TOT';
  if (/text\/html/.test(m.typ)) {
    // Eine HTML-Antwort auf eine erwartete Datei ist der klassische Fehlschlag:
    // Weboberflaeche statt Datensatz (boris.nrw.de: 9.440 Bytes JavaScript, null Links).
    return eintrag.parser === 'p4-katalog' || /uebersicht|einstieg|katalog|aktuelles|zgs|portal/.test(m.schluessel || '')
      ? 'SEITE' : 'HTML-STATT-DATEI';
  }
  if (/pdf/.test(m.typ)) return 'PDF';
  if (/json/.test(m.typ)) return 'JSON';
  if (/csv|text\/plain/.test(m.typ)) return 'CSV';
  if (/zip|octet-stream/.test(m.typ)) return 'BINAER';
  return 'UNKLAR';
}

const ziel = [];
const alles = [{ ...BUND, code: BUND.code }, ...LAENDER];
for (const e of alles) {
  if (nurCodes.length && !nurCodes.includes(e.code)) continue;
  if (e.commercial === 'gebuehr' || e.commercial === 'captcha') {
    ziel.push({ eintrag: e, uebersprungen: `gesperrt (${e.commercial})` });
    continue;
  }
  const a = adressen(e);
  if (!a.length) { ziel.push({ eintrag: e, uebersprungen: 'keine feste Adresse' }); continue; }
  ziel.push({ eintrag: e, adressen: a });
}

const bericht = [];
for (const z of ziel) {
  if (z.uebersprungen) {
    bericht.push({ code: z.eintrag.code, name: z.eintrag.name, uebersprungen: z.uebersprungen, treffer: [] });
    if (!asJson) console.log(`${z.eintrag.code.toUpperCase().padEnd(4)} ${z.eintrag.name.padEnd(26)} -- ${z.uebersprungen}`);
    continue;
  }
  const treffer = [];
  for (const a of z.adressen) {
    const m = await messen(a.url);
    m.schluessel = a.schluessel;
    const u = urteil(m, z.eintrag);
    treffer.push({ schluessel: a.schluessel, url: a.url, ...m, urteil: u });
    if (!asJson) {
      const groesse = m.bytes != null ? `${Math.round(m.bytes / 1024)}k` : `~${m.ersteBytes}b`;
      console.log(
        `${z.eintrag.code.toUpperCase().padEnd(4)} ${String(m.status).padEnd(4)} ${u.padEnd(16)} ` +
        `${m.typ.padEnd(26)} ${groesse.padEnd(7)} ${a.schluessel}${m.fehler ? '  [' + m.fehler + ']' : ''}`
      );
    }
    await schlaf(RATE_MS);
  }
  bericht.push({ code: z.eintrag.code, name: z.eintrag.name, status: z.eintrag.status, treffer });
}

if (asJson) {
  console.log(JSON.stringify(bericht, null, 2));
} else {
  const alle = bericht.flatMap((b) => b.treffer);
  const lebt = alle.filter((t) => t.urteil !== 'TOT').length;
  const html = alle.filter((t) => t.urteil === 'HTML-STATT-DATEI').length;
  console.log('');
  console.log(`geprueft ${alle.length} Adressen | erreichbar ${lebt} | HTML statt Datei ${html} | uebersprungen ${bericht.filter((b) => b.uebersprungen).length}`);
  if (html) console.log('HTML-STATT-DATEI heisst: Weboberflaeche fuer Menschen. Verteilerseite suchen, nicht parsen.');
}
