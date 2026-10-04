#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1839 · WELCHES OBJEKT KANN EINE WERTERMITTLUNG, UND WELCHES NICHT
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 04.10.2026: „natürlich einmal für jedes Objekt, was wir
   angelegt haben, alle Felder vernünftig befüllen, also in den einzelnen
   Tabs, auch die ganzen Qualitätsstufen und allem, dass wir auch überall
   dann einmal eine Wertermittlung abrufen können."

   Dieser Lauf beantwortet den zweiten Teil zuerst: WO KLEMMT ES. Er
   schreibt nichts — er liest und sagt je Objekt, was fehlt.

     > Bevor Felder gefüllt werden, muss feststehen, welche gebraucht
     > werden. Sonst füllt man die bequemen und nicht die nötigen.

   ── WAS ER PRÜFT ────────────────────────────────────────────────────────

   Die Felder, die `DealPilotObjectMapper.reportInput()` an den
   Marktbericht weitergibt — gelesen AUS DER ECHTEN DATEI, nicht
   nachgebaut. Dazu die Staffel der drei Stufen:

     Stufe 1 (mpi)      Adresse, Objektart, Wohnfläche, Baujahr
     Stufe 2 (mpi_plus) dazu Kaufpreis und Miete
     Stufe 3 (wev)      dazu Grundstück, Bodenrichtwert, MEA bei ETW,
                        Einheiten bei MFH, Ausstattung, Zustand

   ── WAS ER NICHT TUT ────────────────────────────────────────────────────

   Er ruft keinen Bericht ab. Das kostet Kontingent, und ob es ausgegeben
   wird, entscheidet nicht ein Werkzeug.

   Aufruf im Marktbericht-Container:
     docker exec -e DP_DB_PASS=… dealpilot-mb-backend \
       node /app/tools/objekt-vollstaendigkeit.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import pg from 'pg';

const { DealPilotObjectMapper } = await import('/app/src/services/DealPilotObjectMapper.js');

const kn = new pg.Client({
  host: process.env.DP_DB_HOST || 'dealpilot-postgres',
  user: process.env.DP_DB_USER || 'dealpilot',
  password: process.env.DP_DB_PASS || process.env.PGPASSWORD,
  database: process.env.DP_DB_NAME || 'dealpilot_db'
});
await kn.connect();
const r = await kn.query('SELECT id, name, data FROM objects ORDER BY name');
await kn.end();

console.log('═══ OBJEKT-VOLLSTÄNDIGKEIT (v1839) ═══');
console.log('Mapper: DealPilotObjectMapper.reportInput (echte Datei)');
console.log('Objekte: ' + r.rows.length);
console.log('');

/* Die Staffel. `pruef` bekommt das GEMAPPTE Objekt — so wird geprüft, was
   wirklich ankommt, nicht was in der Datenbank steht. Zwischen beidem
   liegt der Mapper, und genau dort ist schon einmal etwas verloren
   gegangen (v1444: die Ausstattung kam nie an). */
const STUFEN = [
  { nr: 1, name: 'mpi', felder: [
    ['address', (m) => m.address && /\d/.test(m.address) && m.address.length > 8],
    ['property_type', (m) => Boolean(m.property_type)],
    ['living_area', (m) => m.living_area > 0],
    ['build_year', (m) => m.build_year > 1700]
  ] },
  { nr: 2, name: 'mpi_plus', felder: [
    ['purchase_price', (m) => m.purchase_price > 0],
    ['monthly_net_rent', (m) => m.monthly_net_rent > 0]
  ] },
  { nr: 3, name: 'wev', felder: [
    ['plot_area', (m) => m.plot_area > 0],
    ['land_value_manual', (m) => m.land_value_manual > 0],
    ['condition', (m) => Boolean(m.condition)],
    ['quality', (m) => Boolean(m.quality)]
  ] }
];

/* Bedingte Pflichtfelder — sie gelten nur für bestimmte Objektarten.
   Eine Eigentumswohnung OHNE Miteigentumsanteil bekommt nach der Doktrin
   KEINEN Bodenwert; ein Mehrfamilienhaus ohne Einheitenzahl rechnet die
   Verwaltungskosten am Durchschnitt statt je bewerteter Einheit
   (Anlage 3 ImmoWertV, v1437). */
const BEDINGT = [
  { feld: 'mea_pct', wenn: (m, d) => /etw|wohnung/i.test(String(d.objart || '')),
    pruef: (m) => m.mea_pct > 0,
    warum: 'ETW ohne Miteigentumsanteil bekommt keinen Bodenwert' },
  { feld: 'units', wenn: (m, d) => /mfh|mehrfamilien/i.test(String(d.objart || '')),
    pruef: (m) => m.units > 0,
    warum: 'MFH ohne Einheitenzahl rechnet Verwaltungskosten am Durchschnitt' }
];

const zeilen = [];
const zaehler = { s1: 0, s2: 0, s3: 0 };
for (const row of r.rows) {
  const d = row.data || {};
  const m = DealPilotObjectMapper.reportInput(row);
  const fehlt = { 1: [], 2: [], 3: [] };
  for (const st of STUFEN) {
    for (const [feld, ok] of st.felder) { if (!ok(m)) fehlt[st.nr].push(feld); }
  }
  const bedingt = [];
  for (const b of BEDINGT) {
    if (b.wenn(m, d) && !b.pruef(m)) { fehlt[3].push(b.feld); bedingt.push(b.feld + ' — ' + b.warum); }
  }
  /* Eine Stufe geht nur, wenn ALLE darunter auch gehen. */
  const s1 = fehlt[1].length === 0;
  const s2 = s1 && fehlt[2].length === 0;
  const s3 = s2 && fehlt[3].length === 0;
  if (s1) zaehler.s1++; if (s2) zaehler.s2++; if (s3) zaehler.s3++;

  zeilen.push({ name: String(row.name || '—').slice(0, 36), s1, s2, s3, fehlt, bedingt,
    objart: d.objart || '—' });
}

console.log('OBJEKT                                ART      S1  S2  S3   was fehlt');
console.log('─'.repeat(104));
for (const z of zeilen) {
  const h = (b) => b ? ' ✓ ' : ' – ';
  const alleFehlend = [...new Set([].concat(z.fehlt[1], z.fehlt[2], z.fehlt[3]))];
  console.log(z.name.padEnd(37) + String(z.objart).padEnd(9)
    + h(z.s1) + h(z.s2) + h(z.s3) + '  ' + (alleFehlend.join(', ') || '—'));
}
console.log('─'.repeat(104));
console.log('');
console.log('Stufe 1 (Marktpreisindikation)        : ' + zaehler.s1 + ' von ' + r.rows.length);
console.log('Stufe 2 (erweiterte Indikation)       : ' + zaehler.s2 + ' von ' + r.rows.length);
console.log('Stufe 3 (Wertermittlung ImmoWertV)    : ' + zaehler.s3 + ' von ' + r.rows.length);

/* Welche Felder fehlen am häufigsten? Das sagt, wo das Füllen anfängt. */
const haeufig = {};
for (const z of zeilen) {
  for (const f of [...new Set([].concat(z.fehlt[1], z.fehlt[2], z.fehlt[3]))]) {
    haeufig[f] = (haeufig[f] || 0) + 1;
  }
}
const sortiert = Object.entries(haeufig).sort((a, b) => b[1] - a[1]);
if (sortiert.length) {
  console.log('');
  console.log('AM HÄUFIGSTEN FEHLEND:');
  for (const [f, n] of sortiert) console.log('  ' + String(n).padStart(3) + '×  ' + f);
}

const mitBedingt = zeilen.filter((z) => z.bedingt.length);
if (mitBedingt.length) {
  console.log('');
  console.log('BEDINGTE PFLICHTFELDER (gelten nur für diese Objektart):');
  for (const z of mitBedingt) {
    for (const b of z.bedingt) console.log('  ' + z.name.padEnd(37) + b);
  }
}
