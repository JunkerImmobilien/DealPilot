'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   staging-schaetzwerte-v1854.js — Schätzwerte für die Demo-Objekte
   ═══════════════════════════════════════════════════════════════════════
   Marcel, 04.10.2026: „ich würde mir wünschen, wenn du das für alle meine
   Häuser, die wir dort angelegt haben im Portfolio, wenn du dort überall
   Sachen einträgst. Da kannst du auch einfach nach Schätzen, was du
   einträgst."

   NUR STAGING, NUR DAS TESTKONTO, NUR LEERE FELDER. Jeder gesetzte Wert
   wird in `_dp_herkunft` als „geschaetzt (Demo-Vorbelegung v1854)"
   vermerkt — die App zeigt die Herkunft je Feld. Gefüllt werden die Felder
   des Umbaus (Gewerke, Modernisierung, Bauteile, Lage, Stufe-3-Block), aus
   Objektart, Baujahr, Zustand und Fläche abgeleitet. Keine Preise, keine
   Mieten, keine Bodenrichtwerte — die stammen aus Abrufen oder von Marcel.

   Aufruf im Backend-Container:
     docker exec dealpilot-backend node /app/tools/staging-schaetzwerte-v1854.js --probe
     docker exec dealpilot-backend node /app/tools/staging-schaetzwerte-v1854.js --schreiben
   ═══════════════════════════════════════════════════════════════════════ */
const path = require('path');
const fs = require('fs');
const _orte = [path.join(__dirname, '..', 'backend', 'src', 'db', 'pool.js'), path.join(__dirname, '..', 'src', 'db', 'pool.js')];
const _pool = _orte.find((p) => fs.existsSync(p));
if (!_pool) { console.log('ABBRUCH: pool.js nicht gefunden'); process.exit(2); }
const { query } = require(_pool);
const UID = '2a1ac331-7d7f-44a5-813b-c0080ffb81c3';
const SCHREIBEN = process.argv.includes('--schreiben');
const HERKUNFT = 'geschaetzt (Demo-Vorbelegung v1854)';

const leer = (v) => v == null || String(v).trim() === '';
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

function schaetzen(d) {
  const art = String(d.objart || '').toUpperCase();
  const haus = /^(EFH|ZFH|DHH|RH)$/.test(art), etw = art === 'ETW', mfh = art === 'MFH';
  const bj = num(d.baujahr) || 1975;
  const wfl = num(d.wfl) || 80;
  const einh = num(d.einheiten) || (mfh ? 6 : haus && art === 'ZFH' ? 2 : 1);
  const etagen = num(d.etagen_ges) || (mfh ? 4 : haus ? 2 : 3);
  const zust = String(d.ds2_zustand || (bj >= 2015 ? 'neubau' : bj >= 1995 ? 'gut' : 'normal'));
  const modJ = num(d.modernis);
  const alter = (j) => new Date().getFullYear() - j;
  /* Modernisierung: aus Modernisierungsjahr, sonst aus dem Zustand */
  const band = (() => {
    if (zust === 'neubau') return '< 5 Jahre';
    if (modJ) { const a = alter(modJ); return a < 5 ? '< 5 Jahre' : a < 10 ? '5 - 10 Jahre' : a < 20 ? '10 - 20 Jahre' : '> 20 Jahre'; }
    if (zust === 'gut') return '10 - 20 Jahre';
    if (zust === 'normal') return bj >= 1990 ? '> 20 Jahre' : 'Keine/Nie';
    return 'Keine/Nie';
  })();
  const modernisiert = band !== 'Keine/Nie' && band !== '> 20 Jahre';
  const neu = zust === 'neubau' || bj >= 2010;
  const v = {
    /* Gewerke · Art */
    eq_walls: (neu || (modernisiert && zust === 'gut')) ? 'AUSSENWAENDE_GEDAEMMT' : 'AUSSENWAENDE_NICHT_GEDAEMMT',
    eq_roof: 'DACHPFANNEN',
    eq_windows: neu ? 'DREIFACHVERGLASUNG' : modernisiert ? 'ISOLIERVERGLASUNG' : bj >= 1980 ? 'ZWEIFACHVERGLASUNG' : 'EINFACH',
    eq_heating: neu ? 'FUSSBODENHEIZUNG' : 'ZENTRALHEIZUNG',
    eq_floor: neu ? 'PARKETT_NATURSTEIN' : zust === 'gut' ? 'FLIESEN' : 'TEPPICH_LAMINAT',
    eq_bath: haus ? 'MEHR_ALS_EIN_BAD' : 'MIT_FENSTER',
    eq_guest_wc: haus ? 'GAESTE_WC' : 'KEIN_GAESTE_WC',
    eq_store_room: etw ? 'AUSSERHALB' : 'INNERHALB',
    eq_elevator: (mfh && etagen >= 4) ? 'Ja' : 'Nein',
    /* Modernisierung je Bauteil (Anlage 2) */
    mod_dach: band === '< 5 Jahre' ? band : (modernisiert ? '10 - 20 Jahre' : band),
    mod_fenster: band, mod_leitungen: modernisiert ? band : 'Keine/Nie', mod_heizung: band,
    mod_aussenwand: neu ? band : 'Keine/Nie', mod_baeder: band,
    mod_innenausbau: modernisiert ? band : 'Keine/Nie', mod_grundriss: 'Keine/Nie',
    /* Stammdaten, die leer sind */
    ds2_zustand: zust,
    ds2_energie: neu ? 'B' : bj >= 1995 ? 'D' : bj >= 1978 ? 'E' : modernisiert ? 'E' : 'F',
    standardstufe: neu ? '4' : zust === 'gut' ? '3' : '3',
    baustatus: zust === 'neubau' && bj >= new Date().getFullYear() - 1 ? 'neubau_erstbezug' : 'bestand',
    nutzungsart: 'kapitalanlage',
    zimmer: String(Math.max(1, Math.round(wfl / 28))),
    bad_anz: String(mfh ? einh : haus ? 2 : 1),
    etage: etw ? '1' : '0',
    etagen_ges: String(etagen),
    balkon_flae: String(etw ? 6 : haus ? 12 : 0),
    garagen: String(haus ? 1 : etw ? 1 : 0),
    stellpl_aussen: String(mfh ? Math.min(einh, 6) : haus ? 1 : 0),
    einheiten: String(einh),
    /* Lage (Deal Score) */
    makrolage: 'durchschnittlich', mikrolage: 'durchschnittlich',
    ds2_bevoelkerung: 'stabil', ds2_nachfrage: 'mittel', ds2_wertsteigerung: 'mittel', ds2_entwicklung: 'begrenzt', ds2_mietausfall: 'mittel',
    /* Sach- und Ertragswert (Stufe 3) */
    bgf: (haus || mfh) ? String(Math.round(wfl * (haus ? 1.35 : 1.3))) : '',
    nhk_haus: haus ? (art === 'EFH' || art === 'ZFH' ? '1' : art === 'DHH' ? '2' : '3') : '',
    nhk_geschosse: haus ? (etagen >= 2 ? '1' : '0') : '',
    nhk_dach: haus ? (etagen >= 2 ? '2' : '1') : '',
    grundriss: mfh ? (einh <= 2 ? 'zweispaenner' : einh === 3 ? 'dreispaenner' : 'vierspaenner') : '',
    garagen_bgf_qm: (haus || etw) ? '18' : '',
    garagen_stufe: (haus || etw) ? '3' : '',
    aussenanlagen_pct: (haus || mfh) ? '4' : '',
    gsfl: etw ? '' : String(haus ? 600 : 800),
    mea: etw ? String(Math.round(100 / Math.max(2, einh) * 100) / 100) : ''
  };
  /* Gewerke-Stufen nur, wenn alle neun leer sind (v1839 hat sie meist gefüllt) */
  const ausst = ['ausst_aussenwaende', 'ausst_dach', 'ausst_fenster', 'ausst_innenwaende', 'ausst_decken', 'ausst_fussboeden', 'ausst_sanitaer', 'ausst_heizung', 'ausst_technik'];
  if (ausst.every((k) => leer(d[k]))) {
    const basis = neu ? 4 : zust === 'gut' ? 3 : 2.5;
    ausst.forEach((k) => { v[k] = String(k === 'ausst_fenster' && modernisiert ? Math.min(5, basis + 0.5) : basis); });
  }
  return v;
}

(async () => {
  const r = await query(`SELECT id, name, data FROM objects WHERE user_id = $1 ORDER BY seq_no NULLS LAST, created_at`, [UID]);
  let gesamt = 0;
  const bericht = [];
  for (const o of r.rows) {
    let d = {}; try { d = typeof o.data === 'string' ? JSON.parse(o.data) : (o.data || {}); } catch (e) { d = {}; }
    if (!d.objart) { bericht.push(o.name + ': ohne Objektart — übersprungen'); continue; }
    const v = schaetzen(d);
    let herk = {}; try { herk = JSON.parse(d._dp_herkunft || '{}') || {}; } catch (e) { herk = {}; }
    const gesetzt = [];
    Object.keys(v).forEach((k) => {
      if (v[k] === '' || v[k] == null) return;
      if (!leer(d[k])) return;                      /* nur leere Felder */
      d[k] = v[k]; herk[k] = HERKUNFT; gesetzt.push(k);
    });
    if (gesetzt.length) d._dp_herkunft = JSON.stringify(herk);
    gesamt += gesetzt.length;
    bericht.push(o.name.padEnd(36) + (d.objart || '').padEnd(5) + gesetzt.length + ' Felder' + (gesetzt.length ? ': ' + gesetzt.slice(0, 7).join(', ') + (gesetzt.length > 7 ? ' …' : '') : ''));
    if (SCHREIBEN && gesetzt.length) {
      await query(`UPDATE objects SET data = $1::jsonb, updated_at = now() WHERE id = $2 AND user_id = $3`, [JSON.stringify(d), o.id, UID]);
    }
  }
  console.log((SCHREIBEN ? 'GESCHRIEBEN' : 'PROBE (nichts geschrieben)') + ' · ' + r.rows.length + ' Objekte · ' + gesamt + ' Felder');
  console.log(bericht.join('\n'));
  process.exit(0);
})().catch((e) => { console.log('ABBRUCH: ' + (e.stack || e)); process.exit(2); });
