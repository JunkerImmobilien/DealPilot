#!/usr/bin/env node
/**
 * tools/partner-kunden-pruefen.mjs · v3357 — Partner und Kunden (backend/src/services/partnerKunden.js)
 *
 *   A  ohne DB: Rechte-Vorgaben (Partnerplatz vs. eigener Plan), Verbindungscode (Zeichen ohne Verwechsler, Normalform)
 *   B  jede Abfrage im Backend, die Objekte eines Nutzers LISTET oder ZAEHLT, schliesst Kundenstaende aus
 *      (kunden_freigabe_id IS NULL) oder steht begruendet in der Ausnahmeliste. Neue Stelle ohne beides = rot.
 *   C  Plan-Schutz steht in assignSeat und unassignSeat, Kundenstand ist im Update schreibgeschuetzt,
 *      die Kostenstellen Marktbericht und KI fragen die Partner-Rechte.
 *
 *   node tools/partner-kunden-pruefen.mjs        RC 0 = sauber
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

let n = 0, rot = 0;
const ok = (ab, was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + ab + ' · ' + was + (ist !== undefined ? ' → ' + ist : '')); };

// ── A ─────────────────────────────────────────────────────────────────────
/* Der Dienst laedt db/pool beim Import; ohne DATABASE_URL reicht ein Platzhalter-Modul im require-Cache */
const poolPfad = path.join(WURZEL, 'backend/src/db/pool.js');
function platzhalter(rel, exp) { const f = path.join(WURZEL, rel); require.cache[require.resolve(f)] = { id: f, filename: f, loaded: true, exports: exp }; }
platzhalter('backend/src/db/pool.js', { query: async () => ({ rows: [], rowCount: 0 }), pool: {} });
platzhalter('backend/src/services/resellerService.js', { hatBezahltesAbo: async () => false, getPool: async () => null });
platzhalter('backend/src/services/objectService.js', {});
platzhalter('backend/src/services/planService.js', {});
const pk = require(path.join(WURZEL, 'backend/src/services/partnerKunden.js'));

const r0 = pk.rechteAus({ platz_art: 'platz', rechte: null });
ok('A', 'Partnerplatz ohne Angabe: alles an', pk.RECHTE.every((k) => r0[k] === true));
const r1 = pk.rechteAus({ platz_art: 'platz', rechte: { pdf: false, markt: false } });
ok('A', 'Partnerplatz: pdf und markt aus, Rest an', r1.pdf === false && r1.markt === false && r1.ki === true && r1.senden === true);
const r2 = pk.rechteAus({ platz_art: 'eigen', rechte: { pdf: false } });
ok('A', 'eigener Plan: Partner-Rechte wirken nie', r2.pdf === true);
ok('A', 'Code-Zeichen ohne 0 O 1 I L', !/[01OIL]/.test(pk.CODE_ZEICHEN) && pk.CODE_ZEICHEN.length === 31);
ok('A', 'Code-Normalform aus „k7qm-4xtd “', pk._codeNorm(' k7qm-4xtd ') === 'K7QM4XTD');
ok('A', 'Code nur als SHA-256 (64 Hex)', /^[0-9a-f]{64}$/.test(pk._sha('K7QM4XTD')));
ok('A', 'Entzugsfrist 30 Tage', pk.ENTZUG_FRIST_TAGE === 30);

// ── B ─────────────────────────────────────────────────────────────────────
/* Datei:Muster -> Grund. Abfragen nach EINER Objekt-ID (id = $1) sind keine Liste und stehen nicht hier. */
const AUSNAHMEN = {
  'routes/admin.js': 'Admin-Zaehler je Nutzer (Speicherbedarf, alles zaehlt)',
  'db/seed-demo.js': 'Demo-Konto anlegen',
  'services/demoObjectService.js': 'Demo-Objekte des Demo-Kontos',
  'services/statsService.js': 'Gesamtstatistik',
  'routes/publicStats.js': 'oeffentliche Gesamtzahl',
  'services/objektFotos.js': 'Fotoablage aller Objekte (Kopien haben eigene Fotos)',
  'services/partnerKunden.js': 'der Dienst selbst',
  'services/immometricaFlow.js': 'Suche nach ImmoMetrica-ID, Kopien tragen keine',
  'routes/network.js': 'Suche nach einem Objekt per Kennung',
  'services/agentWerkzeuge.js#1539': 'Suche nach Name',
  'services/objectService.js#114': 'Nummernvergabe (Kundenstaende tragen K-Nummern und stoeren sie nicht)',
};
const dateien = [];
(function lauf(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'generated' && f !== 'node_modules') lauf(p); } else if (f.endsWith('.js')) dateien.push(p); } })(path.join(WURZEL, 'backend/src'));
let stellen = 0;
for (const p of dateien) {
  const rel = path.relative(path.join(WURZEL, 'backend/src'), p).replace(/\\/g, '/');
  const txt = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  txt.forEach((zeile, i) => {
    if (!/FROM objects\b/.test(zeile)) return;
    const block = txt.slice(i, i + 4).join(' ');
    if (!/user_id\s*=\s*\$1/.test(block)) return;            /* nicht je Nutzer */
    if (/\bid\s*=\s*\$1\b|WHERE id\s*=|AND id\s*=|id\s*=\s*ANY|id::text\s*=/.test(block)) return;   /* eine bestimmte ID */
    stellen++;
    if (/kunden_freigabe_id IS NULL/.test(block)) return;
    if (AUSNAHMEN[rel] || AUSNAHMEN[rel + '#' + (i + 1)]) return;
    ok('B', rel + ':' + (i + 1) + ' listet Objekte ohne Ausschluss der Kundenstaende', false);
  });
}
ok('B', 'Listen- und Zaehlstellen geprueft', stellen >= 10, stellen);

// ── C ─────────────────────────────────────────────────────────────────────
const lies = (r) => fs.readFileSync(path.join(WURZEL, r), 'utf8');
const rs = lies('backend/src/services/resellerService.js');
ok('C', 'assignSeat prueft bezahltes Abo (Plan-Schutz)', /async function assignSeat[\s\S]{0,900}hatBezahltesAbo/.test(rs));
ok('C', 'unassignSeat setzt den Plan von vorher zurueck', /async function unassignSeat[\s\S]{0,1200}plan_vorher/.test(rs));
ok('C', 'Kundenstand im Update schreibgeschuetzt', /kundenstand_schreibgeschuetzt/.test(lies('backend/src/services/objectService.js')));
ok('C', 'Marktbericht fragt Partner-Rechte (beide Wege)', (lies('backend/src/routes/marktbericht.js').match(/marktberichtErlaubt/g) || []).length >= 2);
ok('C', 'KI fragt Partner-Rechte', /kiErlaubt/.test(lies('backend/src/routes/ai.js')));
ok('C', 'Partnernetzwerk fragt Partner-Rechte', /rechteFuer/.test(lies('backend/src/routes/network.js')));
ok('C', 'Ende des Partner-Abos laeuft in die Frist', /aboEnde/.test(lies('backend/src/services/partnerSeatsWebhook.js')));
ok('C', 'Einladung eines bestehenden Kontos wird erst bestaetigt', /einladungFragen/.test(lies('frontend/js/reseller-portal.js')));
ok('C', 'Marke nur bei aktiver Verbindung und Wahl Partner', /getrennt_am IS NULL AND rc\.marke = 'partner'/.test(lies('backend/src/routes/resellerInvite.js')));

console.log('\npartner-kunden-pruefen v3357 · ' + n + ' Punkte, ' + (n - rot) + ' gruen, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
