#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   tools/wuensche-holen.mjs · v3097

   Liest die Umsetzungswünsche der Entwicklungspartner (Tabelle umsetzungswuensche,
   App › System › Umsetzungswünsche) von Produktion und Staging — NUR LESEND.
   Zu Beginn einer Sitzung laufen lassen; neue Wünsche (Stand „neu“) kommen mit
   „W-<id>“ ins BACKLOG.md. Den Stand („Im Backlog“, Backlog-Nr.) setzen Marcel
   oder der Partner in der App — Claude schreibt nicht in die Prod-Datenbank.

     node tools/wuensche-holen.mjs            nur Stand „neu“
     node tools/wuensche-holen.mjs --offen    neu, im Backlog, in Arbeit
     node tools/wuensche-holen.mjs --alle
   ══════════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';

const SERVER = { prod: 'root@157.90.117.167', staging: 'root@116.203.214.11' };
const arg = process.argv.slice(2);
const filter = arg.includes('--alle') ? '' : arg.includes('--offen')
  ? "WHERE w.status IN ('neu','backlog','arbeit')" : "WHERE w.status = 'neu'";

const sql = `SELECT coalesce(json_agg(x ORDER BY x.id), '[]') FROM (
  SELECT w.id, w.titel, w.beschreibung, w.bereich, w.dringlichkeit, w.status, w.backlog_nr, w.antwort,
         to_char(w.created_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS am,
         split_part(u.email, '@', 1) AS von
    FROM umsetzungswuensche w LEFT JOIN users u ON u.id = w.user_id ${filter}) x`;

let gesamt = 0;
for (const [name, host] of Object.entries(SERVER)) {
  let liste;
  try {
    const out = execFileSync('ssh', ['-o', 'BatchMode=yes', host,
      `docker exec -i dealpilot-postgres psql -U dealpilot -d dealpilot_db -At`], { input: sql, encoding: 'utf8' });
    liste = JSON.parse(out.trim() || '[]');
  } catch (e) {
    console.log(`${name}: nicht lesbar (${String(e.message).split('\n')[0]})`);
    continue;
  }
  console.log(`\n== ${name}: ${liste.length} Wunsch/Wünsche ==`);
  for (const w of liste) {
    gesamt++;
    console.log(`\nW-${w.id} · ${w.titel}  [${w.status}${w.backlog_nr ? ' · ' + w.backlog_nr : ''}]`);
    console.log(`  ${w.bereich} · ${w.dringlichkeit} · ${w.von || '–'} · ${w.am}`);
    if (w.beschreibung) console.log('  ' + w.beschreibung.replace(/\n/g, '\n  '));
    if (w.antwort) console.log('  Antwort: ' + w.antwort);
  }
}
console.log(`\n${gesamt} insgesamt.`);
