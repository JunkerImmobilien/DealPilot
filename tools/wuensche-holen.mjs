#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   tools/wuensche-holen.mjs · v3097, Bilder seit v3110 (Bordbuch)

   Liest das Bordbuch / die Umsetzungswünsche (Tabelle umsetzungswuensche,
   App › Mechaniker neben dem Piloten bzw. System › Umsetzungswünsche) von
   Produktion und Staging — NUR LESEND. Zu Beginn einer Sitzung laufen lassen;
   neue Einträge (Stand „neu“) kommen mit „W-<id> (Prod)“ ins BACKLOG.md.
   Den Stand setzen Marcel oder der Partner in der App — Claude schreibt dort nicht.

   Screenshots landen unter Dateien/Backlog-Bilder/<server>-W<id>-<n>.jpg
   (Dateien/ ist nicht versioniert) und lassen sich mit dem Read-Werkzeug ansehen.

     node tools/wuensche-holen.mjs                    nur Stand „neu“, beide Server
     node tools/wuensche-holen.mjs --offen            neu, im Backlog, in Arbeit
     node tools/wuensche-holen.mjs --alle
     node tools/wuensche-holen.mjs --nur=staging      bzw. --nur=prod
     node tools/wuensche-holen.mjs --ohne-bilder
   ══════════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = { prod: 'root@157.90.117.167', staging: 'root@116.203.214.11' };
const arg = process.argv.slice(2);
const nur = (arg.find((a) => a.startsWith('--nur=')) || '').slice(6);
const mitBildern = !arg.includes('--ohne-bilder');
const filter = arg.includes('--alle') ? '' : arg.includes('--offen')
  ? "WHERE w.status IN ('neu','backlog','arbeit')" : "WHERE w.status = 'neu'";

const sql = `SELECT coalesce(json_agg(x ORDER BY x.id), '[]') FROM (
  SELECT w.id, to_jsonb(w)->>'art' AS art, w.titel, w.beschreibung, w.bereich, w.dringlichkeit, w.status, w.backlog_nr, w.antwort,
         to_jsonb(w)->'kontext' AS kontext, ${mitBildern ? "coalesce(to_jsonb(w)->'bilder', '[]'::jsonb) AS bilder" : "'[]'::jsonb AS bilder"},   /* v3167 · art/kontext/bilder erst ab Migration 095 - gemessen 04.11.: auf Prod scheiterte die Abfrage und das Werkzeug meldete 0 */
         to_char(w.created_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS am,
         split_part(u.email, '@', 1) AS von
    FROM umsetzungswuensche w LEFT JOIN users u ON u.id = w.user_id ${filter}) x`;

const BILDORDNER = join(ROOT, 'Dateien', 'Backlog-Bilder');
let gesamt = 0;
for (const [name, host] of Object.entries(SERVER)) {
  if (nur && nur !== name) continue;
  let liste;
  try {
    const out = execFileSync('ssh', ['-o', 'BatchMode=yes', host,
      'docker exec -i dealpilot-postgres psql -v ON_ERROR_STOP=1 -U dealpilot -d dealpilot_db -At'],
      { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    liste = JSON.parse(out.trim() || '[]');
  } catch (e) {
    /* v3167 · psql meldete Abfragefehler bisher mit Rueckgabe 0 - das Werkzeug zeigte dann „0 Eintraege" (Prod, 04.11.) */
    console.log(`${name}: FEHLER, nicht gelesen - das ist NICHT „0 Wünsche" (${String(e.message).split('\n')[0]})`);
    process.exitCode = 1;
    continue;
  }
  console.log(`\n== ${name}: ${liste.length} Eintrag/Einträge ==`);
  for (const w of liste) {
    gesamt++;
    console.log(`\nW-${w.id} (${name}) · ${w.art || 'wunsch'} · ${w.titel}  [${w.status}${w.backlog_nr ? ' · ' + w.backlog_nr : ''}]`);
    console.log(`  ${w.bereich} · ${w.dringlichkeit} · ${w.von || '–'} · ${w.am}`);
    const k = w.kontext || {};
    const kt = [k.reiter && 'Reiter ' + k.reiter, k.objekt && 'Objekt ' + k.objekt, k.fenster && 'Fenster ' + k.fenster, k.version && 'Version ' + k.version, k.seite].filter(Boolean).join(' · ');
    if (kt) console.log('  ' + kt);
    if (w.beschreibung) console.log('  ' + w.beschreibung.replace(/\n/g, '\n  '));
    if (w.antwort) console.log('  Antwort: ' + w.antwort);
    (w.bilder || []).forEach((u, i) => {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(u || '');
      if (!m) return;
      mkdirSync(BILDORDNER, { recursive: true });
      const datei = join(BILDORDNER, `${name}-W${w.id}-${i + 1}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
      writeFileSync(datei, Buffer.from(m[2], 'base64'));
      console.log('  Bild: ' + datei);
    });
  }
}
console.log(`\n${gesamt} insgesamt.`);
