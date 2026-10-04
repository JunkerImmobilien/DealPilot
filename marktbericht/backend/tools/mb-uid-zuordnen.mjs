#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1769 · DIE GESTÜMMELTEN KENNUNGEN ZURÜCKORDNEN
   ═══════════════════════════════════════════════════════════════════════

   `users.id` ist eine UUID, `mb.*.user_id` war INTEGER, und fünf Routen
   machten `parseInt()` daraus. Migration 015 hat die Spalte auf TEXT
   gestellt — die alten Zahlen stehen seither als Text darin:

     in der mb-DB   echte UUID                              E-Mail
     2      (72x)   2a1ac331-7d7f-44a5-813b-c0080ffb81c3    info@junker-immobilien.io
     833654 (22x)   833654ba-870b-4fe8-9de0-398c56a11d26    junker_immobilien@gmx.de
     1       (7x)   1c6fe29f-f83b-49bb-9a34-975462a2b7ea    majunker@gmx.net

   `parseInt` hat die Kennung nicht verworfen, sondern GESTÜMMELT: es nimmt
   das führende Ziffernpräfix. Damit ist die Zuordnung rekonstruierbar —
   SOLANGE die Präfixe eindeutig sind.

   > Eine Reparatur, die sich auf eine Eigenschaft der Daten stützt, muss
   > sie messen, nicht annehmen. Auf Produktion können zwei UUIDs mit
   > derselben Ziffernfolge beginnen; dann ordnet dieses Werkzeug nichts
   > zu und sagt, warum.

   Es liest die `users`-Tabelle aus der HAUPT-Datenbank und schreibt in die
   mb-DB. Zwei Verbindungen, zwei Container.

   Aufruf im mb-Container:
     docker exec dealpilot-mb-backend node /app/tools/mb-uid-zuordnen.mjs --trocken
     docker exec dealpilot-mb-backend node /app/tools/mb-uid-zuordnen.mjs

   Die Haupt-DB erreicht er über DP_DB_URL; ohne die Variable bricht er ab
   statt stillschweigend nichts zu tun.
   ═══════════════════════════════════════════════════════════════════════ */

import pg from 'pg';

const TROCKEN = process.argv.includes('--trocken');
const TABELLEN = ['object_snapshots', 'market_reports'];

const DP_URL = process.env.DP_DB_URL || '';
if (!DP_URL) {
  console.error('ABBRUCH: DP_DB_URL fehlt — ohne die Haupt-Datenbank gibt es');
  console.error('         keine UUID-Liste, und ohne die wird nichts zugeordnet.');
  console.error('   Beispiel: DP_DB_URL=postgres://dealpilot:PASS@HOST:5432/dealpilot_db');
  process.exit(1);
}

const { q } = await import('../src/lib/db.js');

/* ── 1 · Die echten Kennungen holen ───────────────────────────────────── */
const dp = new pg.Client({ connectionString: DP_URL });
await dp.connect();
const nutzer = (await dp.query('SELECT id::text AS id, email FROM users ORDER BY created_at')).rows;
await dp.end();

console.log('═══ NUTZER IN DER HAUPT-DB ═══');
console.log(`${nutzer.length} Nutzer gelesen`);
if (!nutzer.length) { console.error('ABBRUCH: keine Nutzer — das kann nicht stimmen.'); process.exit(1); }

/* ── 2 · Die Stümmelung nachbilden und ihre EINDEUTIGKEIT beweisen ────── */
const praefix = (uuid) => {
  const m = String(uuid).match(/^[0-9]+/);
  return m ? m[0] : null;          /* parseInt("c650…") ist NaN */
};
const nachPraefix = new Map();
nutzer.forEach((u) => {
  const p = praefix(u.id);
  if (p === null) return;          /* beginnt nicht mit einer Ziffer */
  if (!nachPraefix.has(p)) nachPraefix.set(p, []);
  nachPraefix.get(p).push(u);
});

console.log('');
console.log('═══ EINDEUTIGKEIT DER PRÄFIXE ═══');
const mehrdeutig = [...nachPraefix.entries()].filter(([, g]) => g.length > 1);
nachPraefix.forEach((g, p) => {
  console.log(`  ${String(p).padStart(8)}  ->  ${g.map((u) => u.id).join(' UND ')}`
    + (g.length > 1 ? '   MEHRDEUTIG' : ''));
});
const ohnePraefix = nutzer.length - [...nachPraefix.values()].reduce((s, g) => s + g.length, 0);
if (ohnePraefix) console.log(`  ${ohnePraefix} Nutzer beginnen nicht mit einer Ziffer `
  + `(parseInt ergab NaN -> ihre Zeilen tragen NULL, nicht eine falsche Zahl)`);

if (mehrdeutig.length) {
  console.error('');
  console.error(`ABBRUCH: ${mehrdeutig.length} Präfix(e) gehören zu mehreren Nutzern.`);
  console.error('   Eine gestümmelte Zahl lässt sich dann nicht einem Nutzer zuordnen,');
  console.error('   und die falsche Zuordnung wäre schlimmer als keine: sie gäbe');
  console.error('   einem Nutzer die Berichte eines anderen. Es wird NICHTS geschrieben.');
  process.exit(1);
}
console.log('  alle Präfixe eindeutig.');

/* ── 3 · Was steht in der mb-DB? ──────────────────────────────────────── */
console.log('');
console.log('═══ BESTAND IN DER MB-DB ═══');
const bestand = {};
for (const t of TABELLEN) {
  const r = await q(`SELECT user_id, count(*)::int AS n FROM mb.${t}
                      GROUP BY user_id ORDER BY n DESC`);
  bestand[t] = r;
  const typ = await q(`SELECT data_type FROM information_schema.columns
                        WHERE table_schema='mb' AND table_name=$1 AND column_name='user_id'`, [t]);
  const dt = (typ[0] || {}).data_type;
  console.log(`  mb.${t}  (user_id: ${dt})`);
  if (dt !== 'text') {
    console.error(`ABBRUCH: mb.${t}.user_id ist ${dt}, nicht text.`);
    console.error('   Migration 015 ist nicht gelaufen. Erst das Image neu bauen.');
    process.exit(1);
  }
  r.forEach((z) => {
    const w = z.user_id === null ? 'NULL' : String(z.user_id);
    const istUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(w);
    const ziel = istUuid ? '(schon UUID)'
      : (nachPraefix.get(w) ? '-> ' + nachPraefix.get(w)[0].id : '(kein Nutzer dazu)');
    console.log(`     ${w.padEnd(38)} ${String(z.n).padStart(4)} Zeilen   ${ziel}`);
  });
}

/* ── 4 · Umschreiben ──────────────────────────────────────────────────── */
console.log('');
if (TROCKEN) {
  console.log('Trockenlauf — es wird nichts geschrieben.');
  process.exit(0);
}
console.log('═══ SCHREIBEN ═══');
let gesamt = 0;
for (const t of TABELLEN) {
  for (const [p, g] of nachPraefix) {
    /* `q()` gibt `res.rows` zurück, nicht das Ergebnisobjekt — `rowCount`
       gibt es hier nicht (`src/lib/db.js:19`). Ohne `RETURNING` wäre jede
       Zahl in diesem Protokoll eine Null, und der Lauf sähe aus, als hätte
       er nichts zu tun gefunden.

       > Ein Zähler, der seine Quelle nicht kennt, zählt zuverlässig null. */
    const r = await q(`UPDATE mb.${t} SET user_id = $1 WHERE user_id = $2 RETURNING 1`,
      [g[0].id, p]);
    const n = r.length;
    if (n) { console.log(`  mb.${t}: ${n} Zeilen  ${p} -> ${g[0].id}`); gesamt += n; }
  }
}
console.log(`  insgesamt ${gesamt} Zeilen umgeschrieben`);

/* ── 5 · Gegenprobe am geschriebenen Stand ────────────────────────────── */
console.log('');
console.log('═══ GEGENPROBE (gelesen aus der Tabelle) ═══');
const UUID = "user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-'";
let alleGut = true;
for (const t of TABELLEN) {
  const r = await q(`SELECT
      count(*)::int AS n,
      count(*) FILTER (WHERE ${UUID})::int AS uuid,
      count(*) FILTER (WHERE user_id IS NULL)::int AS leer,
      count(*) FILTER (WHERE user_id IS NOT NULL AND NOT (${UUID}))::int AS rest
    FROM mb.${t}`);
  const z = r[0];
  console.log(`  mb.${t}: ${z.n} Zeilen · ${z.uuid} mit UUID · ${z.leer} ohne Kennung`
    + (z.rest ? ` · ${z.rest} WEDER NOCH` : ''));
  if (z.rest) {
    alleGut = false;
    const w = await q(`SELECT DISTINCT user_id FROM mb.${t}
                        WHERE user_id IS NOT NULL AND NOT (${UUID}) LIMIT 8`);
    console.error(`     offen: ${w.map((x) => x.user_id).join(', ')}`);
    console.error('     Zu diesen Werten gibt es keinen Nutzer mit passendem Präfix —');
    console.error('     sie bleiben stehen. Eine erfundene Zuordnung wäre schlimmer.');
  }
}
console.log('');
console.log(alleGut
  ? '✓ Keine gestümmelte Kennung mehr übrig.'
  : '⚠ Es bleiben Werte, die zu keinem Nutzer passen — siehe oben.');
process.exit(0);
