#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1832 · BMF-ARBEITSHILFE GEGEN DIE UMGEKEHRTE ERTRAGSWERTMETHODE
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 04.10.2026: „ich würde gerne mal einen test sehen wie sich das
   verhält und wieviel unterschied wir haben."

   Dieser Lauf rechnet für jedes echte Objekt BEIDE Wege und stellt sie
   nebeneinander. Er schreibt NICHTS — er liest.

   ── WO ER LÄUFT ─────────────────────────────────────────────────────────

   Im Marktbericht-Container, weil dort der amtliche Liegenschaftszins und
   die Restnutzungsdauer nach Anlage 2 liegen:

     docker cp backend/src/services/jacobyService.js dealpilot-mb-backend:/app/tools/
     docker exec dealpilot-mb-backend node /app/tools/vergleich-jacoby.mjs

   Die Jacoby-Datei wird dabei als CommonJS über `createRequire` geladen —
   es ist dieselbe Datei, die ausgeliefert wird, kein Nachbau.

   ── WAS ER NICHT KANN ───────────────────────────────────────────────────

   Den BMF-Gebäudeanteil rechnet er nicht nach. Der entsteht in der
   Original-XLSX über LibreOffice und braucht den Hauptapp-Container. Hier
   steht die Zahl, die AM OBJEKT gespeichert ist (`geb_ant`) — das ist der
   Wert, mit dem der Kunde heute rechnet, und damit der richtige Vergleich.
   Wo keiner gespeichert ist, steht das da.
   ═══════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const jacoby = require('/app/tools/jacobyService.cjs');

const { zinssatzFuerObjekt } = await import('/app/src/lib/zweigwahl.js');
const reg = await import('/app/src/lib/ausschuss_register.js');
const iw = await import('/app/src/lib/immowertv.js');

/* ── Selbsttest zuerst. Ein Vergleich aus einem Rechenkern, der sein
   eigenes Anwendungsbeispiel verfehlt, ist wertlos. ─────────────────── */
const st = jacoby.selbsttest();
console.log('═══ RECHENKERN GEGEN DAS GUTACHTEN (Az. 25DG02659/HH) ═══');
console.log(st.ok
  ? '  ✓ alle ' + st.proben.length + ' Groessen treffen (mit der Rundungsregel der Quelle)'
  : '  ✗ ' + st.abweichungen.length + ' Abweichung(en) — Vergleich waere wertlos');
if (!st.ok) {
  for (const a of st.abweichungen) {
    console.log('    ' + a.groesse + ': soll ' + a.soll + ', ist ' + a.ist + ', Diff ' + a.differenz);
  }
  process.exit(1);
}
console.log('');

/* ── Die Objekte aus der HAUPT-Datenbank ───────────────────────────────── */
const kn = new pg.Client({
  host: process.env.DP_DB_HOST || 'dealpilot-postgres',
  user: process.env.DP_DB_USER || 'dealpilot',
  password: process.env.DP_DB_PASS || process.env.PGPASSWORD,
  database: process.env.DP_DB_NAME || 'dealpilot_db'
});
await kn.connect();
const r = await kn.query(
  `SELECT name, data FROM objects
    WHERE COALESCE(data->>'kp','') <> '' ORDER BY name`);
await kn.end();

/* ── v1832 · HIER STAND MEIN EIGENER FEHLER ────────────────────────────
   Der erste Entwurf entfernte ALLE Punkte als Tausendertrenner. Aus dem
   Liegenschaftszins "2.56" wurde damit 256 — und der Lauf druckte
   gehorsam eine Zinszeile mit 256,00 Prozent. Genau die Falle, vor der
   ich eine Stunde vorher bei `parseDe` gewarnt hatte.

     > Ein Parser, der nur eine Schreibweise kennt, liest die andere
     > falsch statt gar nicht. Das ist der gefaehrlichere Fehler: eine
     > Zahl kommt heraus, und sie sieht aus wie eine Antwort.

   Jetzt dieselbe Heuristik wie `parseDe` (calc.js:9): ein Punkt mit genau
   drei Folgeziffern ist ein Tausendertrenner, sonst ein Dezimalpunkt. */
const z = (v) => {
  if (v == null || v === '') return null;
  let s = String(v).trim().replace(/[€\s %]/g, '');
  if (!s) return null;
  const kom = s.lastIndexOf(','), pkt = s.lastIndexOf('.');
  if (kom > pkt) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (pkt > kom && kom >= 0) {
    s = s.replace(/,/g, '');
  } else if (pkt >= 0) {
    const anz = (s.match(/\./g) || []).length;
    const nach = s.length - pkt - 1;
    if (anz > 1 || (anz === 1 && nach === 3)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
};

/* ── v1832 · DER ZWEITE EIGENE FEHLER ──────────────────────────────────
   Der erste Entwurf uebergab `ags = null` an `zinssatzFuerObjekt` — die
   Ableitung aus der Postleitzahl hatte ich schlicht nicht gebaut. Der
   Lauf meldete daraufhin fuer 21 von 22 Objekten "kein
   Liegenschaftszins (Objekt und Register leer)" und sah aus wie ein
   Befund ueber die Datenlage.

     > Null Treffer aus einem Werkzeug, das nie gesucht hat, ist kein
     > Befund, sondern ein Ausfall. Jedes Werkzeug muss seine Deckung
     > nennen koennen.

   Jetzt derselbe Weg, den der echte Bericht nimmt:
   `AgsResolver.fromPostcode` (ReportOrchestrator.js:308). */
const { AgsResolver } = await import('/app/src/connectors/AgsResolver.js');

/* Die drei Abhaengigkeiten GENAU wie der produktive Aufrufer sie setzt
   (WertParameterService.js:17-18, :283). Der erste Entwurf hat den dritten
   Namen GERATEN — `reg.abrufZins` gibt es nicht, und der Lauf meldete fuer
   neun Objekte "abruf is not a function". Geraten statt nachgesehen. */
const ga = await import('/app/src/lib/gutachterausschuss.js');
const deps = {
  finde: reg.finde,
  lagenFuer: reg.lagenFuer,
  abruf: ga.liegenschaftszinssatz
};
/* Deckung ansagen, bevor irgendeine Zahl kommt. */
console.log('Werkzeuge: finde=' + typeof deps.finde + ' lagenFuer=' + typeof deps.lagenFuer
  + ' abruf=' + typeof deps.abruf + ' AgsResolver=' + typeof AgsResolver?.fromPostcode
  + ' rnd=' + typeof iw.rnd + ' gnd=' + typeof iw.gnd);
if (typeof deps.abruf !== 'function' || typeof deps.finde !== 'function' || typeof AgsResolver?.fromPostcode !== 'function') {
  console.log('ABBRUCH: ein Werkzeug fehlt — jedes Ergebnis waere ein Ausfall, kein Befund.');
  process.exit(2);
}

console.log('═══ VERGLEICH JE OBJEKT ═══');
console.log('');
console.log('ACHTUNG ZUR SPALTE BMF%: dort steht `geb_ant` aus dem Objekt — der');
console.log('Wert, mit dem heute gerechnet wird. Das ist NICHT zwingend ein');
console.log('Ergebnis der BMF-Arbeitshilfe: das Feld hat den Vorgabewert 80, und');
console.log('ein von Hand gesetzter Wert sieht genauso aus wie ein gerechneter.');
console.log('Wo mehrere Objekte dieselbe runde Zahl tragen, ist sie vermutlich');
console.log('gesetzt. Die Spalte DIFF misst dann gegen eine Annahme, nicht gegen');
console.log('ein Verfahren.');
console.log('');
console.log('OBJEKT                          KP        BODENW   LZS%  RND   BMF%  JACOBY%   DIFF  MEHR-AfA/J');
console.log('─'.repeat(104));

let gerechnet = 0, ohneZins = 0, ohneBoden = 0, summeMehr = 0;
const zeilen = [];

for (const row of r.rows) {
  const d = row.data || {};
  const name = String(row.name || '—').slice(0, 30);
  const kp = z(d.kp);
  const gsfl = z(d.gsfl), brw = z(d.brw), mea = z(d.mea);
  const bjahr = z(d.baujahr);
  const objart = String(d.objart || '').toLowerCase();
  const bmf = z(d.geb_ant);

  /* Bodenwert wie die App ihn rechnet (calc.js:1140-1141). */
  let bodenwert = null;
  if (gsfl != null && brw != null) {
    bodenwert = gsfl * brw * ((mea != null ? mea : 100) / 100);
  }

  /* Liegenschaftszins: erst das Feld am Objekt, dann das Register. */
  let lzs = z(d.lzs_pct), lzsHer = lzs != null ? 'Objekt' : null;
  let grundOhneZins = null;
  if (lzs == null) {
    const plz = String(d.plz || '').trim();
    if (!plz) {
      grundOhneZins = 'keine PLZ am Objekt';
    } else {
      let ags = null;
      try { ags = (await AgsResolver.fromPostcode(plz))?.kreis_ags || null; }
      catch (e) { grundOhneZins = 'AGS-Abruf fehlgeschlagen: ' + (e.message || e); }
      if (!ags && !grundOhneZins) grundOhneZins = 'kein AGS zur PLZ ' + plz;
      if (ags) {
        try {
          const t = zinssatzFuerObjekt(deps, String(ags), { objart: objart, baujahr: bjahr });
          if (t && t.verfuegbar) { lzs = t.wert_pct; lzsHer = 'Register ' + t.stufe; }
          /* Die Rueckfrage des Registers ist die Antwort, nicht ihr
             Ausbleiben. Sie sagt, WAS fehlt — das gehoert in die Zeile. */
          else grundOhneZins = 'Register (AGS ' + ags + '): '
            + (t?.rueckfrage || t?.hinweis || 'kein Wert');
        } catch (e) { grundOhneZins = 'Registerabruf: ' + (e.message || e); }
      }
    }
  }

  /* Restnutzungsdauer nach Anlage 2, aus Baujahr und Gesamtnutzungsdauer. */
  let rnd = z(d.afa_rnd_jahre), rndHer = rnd != null ? 'Objekt' : null;
  if (rnd == null && bjahr != null && iw.gnd && iw.rnd) {
    try {
      const g = iw.gnd(objart);
      const rr = iw.rnd(g, bjahr, 'bestand', new Date().getFullYear());
      rnd = (rr && (rr.rnd ?? rr.jahre ?? rr)) || null;
      if (typeof rnd === 'object') rnd = rnd.rnd ?? null;
      rndHer = 'Anlage 2 (GND ' + g + ')';
    } catch (e) { rnd = null; }
  }

  if (bodenwert == null) { ohneBoden++; zeilen.push([name, 'kein Bodenwert (Fläche oder BRW fehlt)']); continue; }
  if (lzs == null) { ohneZins++; zeilen.push([name, grundOhneZins || 'kein Liegenschaftszins']); continue; }
  if (rnd == null) { zeilen.push([name, 'keine Restnutzungsdauer ableitbar']); continue; }

  const j = jacoby.berechne({ kaufpreis: kp, bodenwert: bodenwert, lzs_pct: lzs, rnd_jahre: rnd });
  if (!j.verfuegbar) { zeilen.push([name, j.hinweis]); continue; }

  gerechnet++;
  const diff = bmf != null ? (j.gebaeudeanteil_pct - bmf) : null;
  /* Was der Unterschied im Jahr WERT ist: mehr Gebäudeanteil = mehr
     AfA-Bemessungsgrundlage. 2 % linear nach § 7 Abs. 4 EStG. */
  const mehrAfa = diff != null ? (kp * diff / 100) * 0.02 : null;
  if (mehrAfa) summeMehr += mehrAfa;

  console.log(
    name.padEnd(30)
    + String(Math.round(kp)).padStart(10)
    + String(Math.round(bodenwert)).padStart(14)
    + String(lzs.toFixed(2)).padStart(7)
    + String(Math.round(rnd)).padStart(5)
    + String(bmf != null ? bmf.toFixed(1) : '—').padStart(7)
    + String(j.gebaeudeanteil_pct.toFixed(1)).padStart(9)
    + String(diff != null ? (diff >= 0 ? '+' : '') + diff.toFixed(1) : '—').padStart(7)
    + String(mehrAfa != null ? (mehrAfa >= 0 ? '+' : '') + Math.round(mehrAfa) : '—').padStart(12)
    + '   [' + lzsHer + ' · ' + rndHer + ']'
  );
}

console.log('─'.repeat(104));
console.log('');
console.log('Gerechnet: ' + gerechnet + ' von ' + r.rows.length + ' Objekten.');
if (zeilen.length) {
  console.log('');
  console.log('NICHT GERECHNET — und warum (kein Verfahren rechnet halb):');
  for (const [n, g] of zeilen) console.log('  ' + n.padEnd(32) + g);
}
console.log('');
console.log('Summe der jaehrlichen AfA-Differenz ueber alle gerechneten Objekte: '
  + (summeMehr >= 0 ? '+' : '') + Math.round(summeMehr) + ' EUR/Jahr');
console.log('(2 % linear nach § 7 Abs. 4 EStG auf die Differenz der Bemessungsgrundlage.)');
