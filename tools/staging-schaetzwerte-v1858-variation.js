'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   staging-schaetzwerte-v1858-variation.js — die Lage-Schätzwerte durchwachsen
   ═══════════════════════════════════════════════════════════════════════
   Marcel, 04.10.2026: „Das wäre auf jeden Fall gut, wenn das so ein bisschen
   durchwachsen ist und dass da auch mal ein bisschen was drinsteht."

   v1854 hatte allen 17 Objekten dieselbe Lage gegeben (durchschnittlich /
   stabil / mittel / begrenzt). Hier wird NUR überschrieben, was v1854 als
   „geschaetzt (Demo-Vorbelegung v1854)" vermerkt hat — eigene Angaben
   bleiben. Die Variation ist deterministisch aus Ort und Baujahr
   abgeleitet (gleiche Eingabe, gleiches Ergebnis), nicht gewürfelt:
   Großstadt (Leipzig, Bielefeld, Detmold, Castrop-Rauxel) wachsend/stark,
   Kleinstadt (Hüllhorst, Hiddenhausen, Kabelsketal, Rinteln, Ibbenbüren,
   Bad Oeynhausen) stabil/mittel bis leicht fallend/schwach; Altbau ohne
   Modernisierung schwächer. Der Vermerk wird auf v1858 gesetzt.

     docker exec dealpilot-backend node /app/tools/staging-schaetzwerte-v1858-variation.js --probe
     docker exec dealpilot-backend node /app/tools/staging-schaetzwerte-v1858-variation.js --schreiben
   ═══════════════════════════════════════════════════════════════════════ */
const path = require('path');
const fs = require('fs');
const _orte = [path.join(__dirname, '..', 'backend', 'src', 'db', 'pool.js'), path.join(__dirname, '..', 'src', 'db', 'pool.js')];
const _pool = _orte.find((p) => fs.existsSync(p));
if (!_pool) { console.log('ABBRUCH: pool.js nicht gefunden'); process.exit(2); }
const { query } = require(_pool);
const UID = '2a1ac331-7d7f-44a5-813b-c0080ffb81c3';
const SCHREIBEN = process.argv.includes('--schreiben');
const ALT = 'geschaetzt (Demo-Vorbelegung v1854)', NEU = 'geschaetzt (Demo-Vorbelegung v1858)';

const GROSS = /leipzig|bielefeld|detmold|castrop/i;
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function variation(d) {
  const ort = String(d.ort || ''), bj = parseInt(d.baujahr, 10) || 1975;
  const gross = GROSS.test(ort);
  const w = hash(ort + '|' + (d.str || '')) % 3;           // 0,1,2 — stabil je Objekt
  const alt = bj < 1970 && !d.modernis;
  const lage = {
    makrolage:        gross ? ['gut', 'gut', 'sehr_gut'][w] : ['durchschnittlich', 'schwach', 'durchschnittlich'][w],
    mikrolage:        gross ? ['gut', 'durchschnittlich', 'sehr_gut'][w] : (alt ? ['schwach', 'durchschnittlich', 'durchschnittlich'][w] : ['durchschnittlich', 'gut', 'durchschnittlich'][w]),
    ds2_bevoelkerung: gross ? ['wachsend', 'stark_wachsend', 'wachsend'][w] : ['stabil', 'leicht_fallend', 'stabil'][w],
    ds2_nachfrage:    gross ? ['stark', 'sehr_stark', 'stark'][w] : ['mittel', 'schwach', 'mittel'][w],
    ds2_wertsteigerung: gross ? ['hoch', 'mittel', 'hoch'][w] : ['mittel', 'niedrig', 'mittel'][w],
    ds2_entwicklung:  gross ? ['eine_starke', 'mehrere', 'begrenzt'][w] : ['begrenzt', 'kaum', 'begrenzt'][w],
    ds2_mietausfall:  gross ? 'gering' : (alt ? 'mittel' : ['mittel', 'gering', 'mittel'][w])
  };
  return lage;
}

(async () => {
  const r = await query(`SELECT id, name, data FROM objects WHERE user_id = $1 ORDER BY seq_no NULLS LAST, created_at`, [UID]);
  let gesamt = 0; const bericht = [];
  for (const o of r.rows) {
    let d = {}; try { d = typeof o.data === 'string' ? JSON.parse(o.data) : (o.data || {}); } catch (e) { d = {}; }
    let herk = {}; try { herk = JSON.parse(d._dp_herkunft || '{}') || {}; } catch (e) { herk = {}; }
    const v = variation(d); const gesetzt = [];
    Object.keys(v).forEach((k) => {
      if (herk[k] !== ALT) return;                 /* nur, was v1854 geschätzt hat */
      if (d[k] === v[k]) { herk[k] = NEU; return; }
      d[k] = v[k]; herk[k] = NEU; gesetzt.push(k + '=' + v[k]);
    });
    d._dp_herkunft = JSON.stringify(herk);
    gesamt += gesetzt.length;
    bericht.push(o.name.padEnd(36) + (GROSS.test(d.ort || '') ? 'Großstadt ' : 'Kleinstadt') + ' · ' + (gesetzt.length ? gesetzt.join(', ') : 'unverändert (eigene Angaben)'));
    if (SCHREIBEN) await query(`UPDATE objects SET data = $1::jsonb, updated_at = now() WHERE id = $2 AND user_id = $3`, [JSON.stringify(d), o.id, UID]);
  }
  console.log((SCHREIBEN ? 'GESCHRIEBEN' : 'PROBE (nichts geschrieben)') + ' · ' + r.rows.length + ' Objekte · ' + gesamt + ' Felder geändert');
  console.log(bericht.join('\n'));
  process.exit(0);
})().catch((e) => { console.log('ABBRUCH: ' + (e.stack || e)); process.exit(2); });
