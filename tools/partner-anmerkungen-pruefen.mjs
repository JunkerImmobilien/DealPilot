#!/usr/bin/env node
/**
 * tools/partner-anmerkungen-pruefen.mjs · v3450 — Anmerkungen am Kundenstand und Rueckmeldung an den Kunden
 *
 *   node tools/partner-anmerkungen-pruefen.mjs          A: ohne DB (echte Dateien)
 *   node tools/partner-anmerkungen-pruefen.mjs --live   A + B: NUR Staging, im Backend-Container (scp + docker exec)
 *
 * A · Feldbezug (frontend/js/partner-anmerkungen.js zuordnen, in einer nachgebauten Seite):
 *     feld_id gefunden -> Feld; nur Selektor -> Feld; Feld fehlt (neuer Stand) -> freie Anmerkung, nie ein falsches Feld;
 *     ungueltiger Selektor -> frei ohne Ausnahme; ohne Feldbezug -> frei; anderer Abschnitt -> frei.
 *     Eingaben (backend/src/services/partnerAnmerkungen.js _sauber): Art-Rueckfall, Laengendeckel, leerer Text.
 *     Routen: jede neue Route steht in routes/partnerKunden.js hinter dem Partner- bzw. Kunden-Router.
 * B · tools/partner-anmerkungen-live.js: Rechte (fremder Partner, fremder Kunde, Entwurf unsichtbar), Lebenszyklus
 *     (Entwurf -> zurueckgegeben -> erledigt, Aufgabe erledigt, Meldung beim Partner), Feldbezug ueberlebt einen neuen Stand.
 * RC 0 = sauber.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(import.meta.url);
let n = 0, rot = 0;
const ok = (was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + was + (ist !== undefined && !b ? ' → ' + JSON.stringify(ist) : '')); };

console.log('A · Feldbezug (zuordnen)');
const quelle = fs.readFileSync(path.join(WURZEL, 'frontend/js/partner-anmerkungen.js'), 'utf8');
const fenster = {};
vm.runInNewContext(quelle, { window: fenster, document: {}, setTimeout, clearTimeout, setInterval, clearInterval, console });
const zuordnen = fenster.DpAnmerkungen && fenster.DpAnmerkungen.zuordnen;
ok('Modul laedt und liefert zuordnen()', typeof zuordnen === 'function');
/* Nachgebaute Seite: Abschnitt s3 mit Feld zins und einer Kachel ohne id */
function el(id, inSec) { return { id, closest: (sel) => (inSec && sel === '#' + inSec ? {} : null) }; }
const seite = (felder, sels) => ({
  getElementById: (id) => felder[id] || null,
  querySelector: (s) => { if (s === 'kaputt[') throw new Error('SyntaxError'); return sels[s] || null; }
});
const s3 = { id: 's3' };
const doc = seite({ zins: el('zins', 's3'), s3 }, { '#s3 > div:nth-of-type(2)': el('', 's3') });
let r = zuordnen({ feld_id: 'zins', sec: 's3' }, doc); ok('feld_id gefunden -> Feld', r.art === 'feld', r);
r = zuordnen({ selektor: '#s3 > div:nth-of-type(2)', sec: 's3' }, doc); ok('nur Selektor -> Feld', r.art === 'feld', r);
r = zuordnen({ feld_id: 'tilgung', sec: 's3' }, doc); ok('Feld fehlt (neuer Stand) -> freie Anmerkung', r.art === 'frei' && r.grund === 'feld_fehlt', r);
r = zuordnen({ feld_id: 'weg', selektor: 'kaputt[' }, doc); ok('ungueltiger Selektor -> frei, keine Ausnahme', r.art === 'frei', r);
r = zuordnen({ text: 'allgemein' }, doc); ok('ohne Feldbezug -> frei', r.art === 'frei' && r.grund === 'ohne_feld', r);
const doc2 = seite({ zins: el('zins', 's4'), s3 }, {});
r = zuordnen({ feld_id: 'zins', sec: 's3' }, doc2); ok('Feld steht in einem anderen Abschnitt -> frei', r.art === 'frei' && r.grund === 'anderer_abschnitt', r);

console.log('A · Eingaben (_sauber)');
const modulPfad = path.join(WURZEL, 'backend/src/services/partnerAnmerkungen.js');
const src = fs.readFileSync(modulPfad, 'utf8');
const sauberQuelle = src.slice(src.indexOf('function kurz('), src.indexOf('/** Kundenstand des Partners'));
const ctx = {}; vm.runInNewContext(sauberQuelle + '\nthis.sauber = sauber;', Object.assign(ctx, { ARTEN: ['hinweis', 'pruefen', 'nachreichen'] }));
let x = ctx.sauber({ art: 'quatsch', text: '  ' }); ok('unbekannte Art -> hinweis, leerer Text -> null', x.art === 'hinweis' && x.text === null, x);
x = ctx.sauber({ art: 'nachreichen', text: 'a'.repeat(3000), selektor: 'b'.repeat(900), vorschlag: 'c'.repeat(800) });
ok('Deckel Text 2000, Selektor 400, Vorschlag 500', x.text.length === 2000 && x.selektor.length === 400 && x.vorschlag.length === 500 && x.art === 'nachreichen', [x.text.length, x.selektor.length, x.vorschlag.length]);

console.log('A · Routen');
const routen = fs.readFileSync(path.join(WURZEL, 'backend/src/routes/partnerKunden.js'), 'utf8');
[["partner.get('/kundenstaende/:id/anmerkungen'", 'Partner liest'], ["partner.post('/kundenstaende/:id/anmerkungen'", 'Partner legt an'],
 ["partner.post('/kundenstaende/:id/zurueck'", 'Partner gibt zurueck'], ["partner.put('/anmerkungen/:id'", 'Partner aendert'],
 ["partner.delete('/anmerkungen/:id'", 'Partner loescht'], ["kunde.get('/aufgaben/:id/anmerkungen'", 'Kunde liest'], ["kunde.post('/anmerkungen/:id'", 'Kunde setzt']]
  .forEach(([s, t]) => ok('Route ' + t + ' am richtigen Router', routen.includes(s)));
ok('Partner-Router verlangt das Merkmal reseller', /partner\.use\(requireFeature\('reseller'\)\)/.test(routen));
const mig = fs.readFileSync(path.join(WURZEL, 'backend/migrations/106_partner_anmerkungen.sql'), 'utf8');
ok('Migration: Anmerkung haengt am Kundenstand (CASCADE) und am Original (SET NULL)', /share_id\s+uuid NOT NULL REFERENCES public\.object_shares\(id\) ON DELETE CASCADE/.test(mig) && /objekt_id\s+uuid REFERENCES public\.objects\(id\) ON DELETE SET NULL/.test(mig));

if (process.argv.includes('--live')) {
  console.log('B · live auf Staging');
  const SERVER = 'root@116.203.214.11';
  const live = path.join(WURZEL, 'tools/partner-anmerkungen-live.js');
  try {
    const aus = execSync(`scp -q "${live}" ${SERVER}:/tmp/pal.js && ssh ${SERVER} "docker cp /tmp/pal.js dealpilot-backend:/app/partner-anmerkungen-live.js && docker exec dealpilot-backend node /app/partner-anmerkungen-live.js; docker exec dealpilot-backend rm -f /app/partner-anmerkungen-live.js; rm -f /tmp/pal.js"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });   /* RC kommt ueber die Zeile „LIVE … rot“ (die Shell unter Windows reicht $? nicht durch) */
    process.stdout.write(aus);
    const m = aus.match(/LIVE (\d+) Punkte, (\d+) rot/);
    ok('Live-Lauf vollstaendig', !!m && m[2] === '0', m && m[0]);
  } catch (e) { process.stdout.write(String(e.stdout || '')); ok('Live-Lauf', false, String(e.stderr || e.message).slice(0, 300)); }
}

console.log(`\n${n} Punkte, ${rot} rot`);
process.exit(rot ? 1 : 0);
