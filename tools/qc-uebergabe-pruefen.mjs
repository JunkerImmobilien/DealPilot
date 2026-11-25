#!/usr/bin/env node
/* v4820 · Prüfer: Übergabe Quick-Check → Objekt (Lindenallee-Fall).
   Teil A (ohne Browser): die Verträge im Quelltext, an denen die Übergabe hängt. Jeder Punkt ist eine
   Stelle, die schon einmal gebrochen ist (I3 v4590, Y3 v4700, DD4 v4740, II4 v4780f).
   Teil B (--objekt=<uuid> [--host=root@116.203.214.11]): der gespeicherte Datensatz eines Objekts, das
   über Quick Boarding mit allen Lindenallee-Unterlagen angelegt wurde (nur lesend, per ssh/psql).
   --datei=<pfad> prüft statt object-actions.js eine andere Fassung (Gegenprobe).
   RC 0 = sauber, RC 1 = rot. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const datei = arg('datei') || path.join(ROOT, 'frontend/js/object-actions.js');
const src = fs.readFileSync(datei, 'utf8');
const mfh = fs.readFileSync(path.join(ROOT, 'frontend/js/mfh-einheiten.js'), 'utf8');

let rot = 0, gruen = 0;
function pruef(name, ok, hinweis) { if (ok) { gruen++; console.log('  ok   ' + name); } else { rot++; console.log('  ROT  ' + name + (hinweis ? '  · ' + hinweis : '')); } }

console.log('Teil A · Verträge im Quelltext (' + path.relative(ROOT, datei) + ')');
const obj2qc = (src.match(/var OBJ2QC = \{([\s\S]*?)\};/) || [])[1] || '';
pruef('A1 Energieklasse, Zins, Tilgung gehen in den Quick-Check (OBJ2QC)', /ds2_energie:'qc_energieklasse'/.test(obj2qc) && /d1z:'qc_zins'/.test(obj2qc) && /d1t:'qc_tilg'/.test(obj2qc));
pruef('A2 Auswertung der Unterlagen wird als Merker _dok_auswertung angeboten', /_merged\._dok_auswertung = \{/.test(src));
pruef('A3 Einheitenliste trägt „aufgeteilt“ aus der Teilungserklärung (teilung)', /mfh_einheiten_liste = \{[\s\S]{0,600}teilung: _unterlagenListe\(\)\.some\(function \(t\) \{ return t\.typ === 'teilungserklaerung'; \}\)/.test(src));
pruef('A4 „Ausgewählte übernehmen“ wartet auf die laufende Auswertung', /function applyMerged\(\) \{\s*[\s\S]{0,700}if \(_auswertungLaeuft\) \{/.test(src));
pruef('A5 _dok_auswertung wandert beim Speichern immer mit (_immer)', /var _immer = \(id === '_dok_auswertung'\)/.test(src) && /if \(targets && !targets\[id\] && !_immer\) return;/.test(src));
pruef('A6 Pilot-Analyse startet nach der Übergabe mit Unterlagen', /if \(_mitUnterlagen && applied\.indexOf\('_dok_auswertung'\) >= 0\) _pilotNachUebergabe\(\);/.test(src));
pruef('A7 je gelesener Datei ein Verlaufseintrag (_qcVerlauf nach applyQcPending)', /_qcVerlauf\(_proItem, _qcEingang\)/.test(src));
pruef('A8 Einheiten werden beim Speichern automatisch übernommen (DpMfhEinheiten.automatisch mit aufgeteilt)', /DpMfhEinheiten\.automatisch\(liste, \{ aufgeteilt: !!it\.teilung \}\)/.test(src) && /automatisch\s*[:=]/.test(mfh));

const objekt = arg('objekt');
if (objekt) {
  if (!/^[0-9a-f-]{36}$/.test(objekt)) { console.log('  ROT  --objekt ist keine UUID'); process.exit(1); }
  const host = arg('host') || 'root@116.203.214.11';
  const sql = "SELECT json_build_object('str',data->>'str','en',data->>'ds2_energie','zins',data->>'d1z','tilg',data->>'d1t','nkm',data->>'nkm',"
    + "'aufgeteilt',data->'_mfh'->>'aufgeteilt','einh',jsonb_array_length(coalesce(data->'_mfh'->'einheiten','[]'::jsonb)),"
    + "'eingang',length(coalesce(data->>'_dok_eingang','')),'ausw',length(coalesce(data->>'_dok_auswertung','')),'ai',length(coalesce(data->>'_ai','')),"
    + "'risiken',length(coalesce(data->>'risiken','')),'eingangtext',left(coalesce(data->>'_dok_eingang',''),20000)) FROM objects WHERE id='" + objekt + "'";
  let r;
  try { r = JSON.parse(execFileSync('ssh', ['-o', 'ConnectTimeout=10', host, 'docker exec dealpilot-postgres psql -U dealpilot -d dealpilot_db -tAc "' + sql.replace(/"/g, '\\"') + '"'], { encoding: 'utf8' }).trim()); }
  catch (e) { console.log('  ROT  Datensatz nicht lesbar: ' + e.message.split('\n')[0]); process.exit(1); }
  console.log('Teil B · gespeichertes Objekt ' + objekt);
  pruef('B1 Energieklasse gesetzt', !!r.en, r.en);
  pruef('B2 Zins und Tilgung gesetzt', !!r.zins && !!r.tilg, r.zins + ' / ' + r.tilg);
  pruef('B3 „in Wohnungseigentum aufgeteilt“', r.aufgeteilt === 'true', String(r.aufgeteilt));
  pruef('B4 Einheiten aus der Mieterliste (≥ 2)', r.einh >= 2, String(r.einh));
  pruef('B5 Auswertung der Unterlagen gespeichert', r.ausw > 100, String(r.ausw));
  pruef('B6 Risiken im Objekt', r.risiken > 20, String(r.risiken));
  pruef('B7 Verlauf „Eingelesen und übernommen“ gespeichert', r.eingang > 100, String(r.eingang));
  pruef('B8 Pilot-Analyse gespeichert', r.ai > 100, String(r.ai));
  const nkmIm = (String(r.eingangtext).match(/Nettokaltmiete[^"]{0,30}/) || [''])[0];
  pruef('B9 Nettokaltmiete im Verlauf mit Tausenderpunkt (kein „3,66 €“)', !nkmIm || !/:\s*\d,\d\d\s*€/.test(nkmIm), nkmIm);
}

console.log((rot ? 'ROT' : 'SAUBER') + ' · ' + gruen + ' ok, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
