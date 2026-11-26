#!/usr/bin/env node
/* tools/verkauf-schalter-pruefen.mjs · v5130 KK6 · Verkauf an/aus für Einzel-Check und Haus-Check (Marcel 26.11.2026)
   A  Logik an der ECHTEN Datei backend/src/services/verkaufSchalter.js mit gestellter DB und Umgebung:
      Umgebung '0' = Not-Aus (Admin-Schalter nützt nichts), '1' = Obergrenze offen, leer = nur Staging,
      DB-Schalter aus = kein Verkauf, ohne Zeile oder DB-Fehler = an (wie bisher), setzen() leert den Zwischenspeicher,
      Zähler heute/Monat, Zählerfehler bricht nichts.
   B  Verdrahtung in den echten Dateien: beide /kaufen prüfen verkauft() VOR dem Kauf und antworten 409, /preis meldet
      verkauf, Admin-Schalten nur requireRole('owner') mit audit(), beide Webhooks zählen, beide Landings zeigen
      „Bald verfügbar“, Bestätigungsfenster ohne Schliessen per Klick daneben, Migration 135.
   C  Gegenprobe: ein Schalter, der nichts prüft, würde rot.
   RC=0 sauber. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const vs = require(path.join(W, 'backend/src/services/verkaufSchalter.js'));
let rot = 0, gruen = 0;
function ok(b, t) { if (b) gruen++; else { rot++; console.log('ROT  ' + t); } }
const lies = (f) => fs.readFileSync(path.join(W, f), 'utf8');

/* A · Logik */
function welt({ env = {}, staging = false, db = {}, dbFehler = false }) {
  const zaehler = [];
  let jetzt = 1e12;
  vs._setzeDeps({
    env: (k) => env[k], istStaging: () => staging, jetzt: () => jetzt,
    query: async (sql, p) => {
      if (dbFehler) throw new Error('Tabelle fehlt');
      if (/^SELECT aktiv FROM verkauf_schalter/.test(sql)) return { rows: p[0] in db ? [{ aktiv: db[p[0]] }] : [] };
      if (/^INSERT INTO verkauf_schalter/.test(sql)) { db[p[0]] = p[1]; return { rowCount: 1 }; }
      if (/^INSERT INTO verkauf_tage/.test(sql)) { zaehler.push(p); return { rowCount: 1 }; }
      if (/FROM verkauf_tage/.test(sql)) return { rows: [{ produkt: 'hauscheck', heute: 2, heute_cent: 1998, monat: 5, monat_cent: 4995 }] };
      if (/FROM verkauf_schalter/.test(sql)) return { rows: Object.keys(db).map((k) => ({ produkt: k, aktiv: db[k], geaendert_am: null, geaendert_von: 'admin@test' })) };
      throw new Error('unerwartet: ' + sql.slice(0, 40));
    }
  });
  return { zaehler, db, tick: (ms) => { jetzt += ms; } };
}
for (const pr of ['einzelcheck', 'hauscheck']) {
  const V = pr === 'einzelcheck' ? 'EINZELCHECK_AKTIV' : 'HAUSCHECK_AKTIV';
  welt({ env: { [V]: '0' }, staging: true, db: { [pr]: true } });
  ok(await vs.verkauft(pr) === false, pr + ': Umgebung 0 = Not-Aus, auch mit Schalter an und auf Staging');
  welt({ env: { [V]: '1' }, db: { [pr]: true } });
  ok(await vs.verkauft(pr) === true, pr + ': Umgebung 1 + Schalter an = Verkauf');
  welt({ env: { [V]: '1' }, db: { [pr]: false } });
  ok(await vs.verkauft(pr) === false, pr + ': Umgebung 1 + Schalter aus = kein Verkauf');
  welt({ env: {}, staging: false, db: { [pr]: true } });
  ok(await vs.verkauft(pr) === false, pr + ': Umgebung leer auf Prod = aus');
  welt({ env: {}, staging: true, db: {} });
  ok(await vs.verkauft(pr) === true, pr + ': Umgebung leer auf Staging, ohne Zeile = an');
  welt({ env: { [V]: '1' }, dbFehler: true });
  ok(await vs.verkauft(pr) === true, pr + ': DB-Fehler (Migration fehlt) = wie bisher an');
}
{
  const w = welt({ env: { HAUSCHECK_AKTIV: '1' }, db: { hauscheck: true } });
  ok(await vs.verkauft('hauscheck') === true, 'vor dem Schalten an');
  await vs.setzen('hauscheck', false, 'admin@test');
  ok(w.db.hauscheck === false && await vs.verkauft('hauscheck') === false, 'setzen(aus) wirkt sofort (Zwischenspeicher geleert)');
  let f = null; try { await vs.setzen('mfhcheck', true, 'x'); } catch (e) { f = e; }
  ok(f && f.status === 400, 'unbekanntes Produkt abgelehnt');
  await vs.gezaehlt('hauscheck', 999);
  ok(w.zaehler.length === 1 && w.zaehler[0][0] === 'hauscheck' && w.zaehler[0][1] === 999, 'Tageszähler: Produkt und Betrag');
  const st = await vs.stand();
  const h = st.find((x) => x.produkt === 'hauscheck'), e = st.find((x) => x.produkt === 'einzelcheck');
  ok(h.heute === 2 && h.monat === 5 && h.monat_cent === 4995 && h.schalter === false && h.wirksam === false && h.umgebung === true, 'Stand: Käufe heute/Monat, Schalter, wirksam');
  ok(e.umgebung === false && e.wirksam === false && e.umgebung_var === 'EINZELCHECK_AKTIV', 'Stand: Einzel-Check ohne Umgebung nicht wirksam, Variable genannt');
}
welt({ dbFehler: true });
let wurf = null; try { await vs.gezaehlt('hauscheck', 999); } catch (e) { wurf = e; }
ok(wurf === null, 'Zählerfehler bricht den Webhook nicht');
vs._setzeDeps(null);

/* B · Verdrahtung */
for (const [datei, pr] of [['backend/src/routes/publicHausCheck.js', 'hauscheck'], ['backend/src/routes/publicEinzelcheck.js', 'einzelcheck']]) {
  const t = lies(datei);
  const k = t.indexOf("router.post('/kaufen'");
  const block = t.slice(k, t.indexOf('router.post(', k + 10));
  const iV = block.indexOf("verkauft('" + pr + "')"), iK = block.search(/kaufAnlegen\(/);
  ok(iV > 0 && iK > iV && /status\(409\)/.test(block) && /verkauf_aus/.test(block), datei + ': /kaufen prüft den Schalter vor dem Kauf, 409');
  const pb = t.slice(t.indexOf("router.get('/preis'"), t.indexOf("router.get('/preis'") + 600);
  ok(new RegExp("verkauft\\('" + pr + "'\\)").test(pb) && /verkauf: verkauf/.test(pb), datei + ': /preis meldet verkauf');
}
const adm = lies('backend/src/routes/admin.js');
const ab = adm.slice(adm.indexOf("router.post('/verkauf'"), adm.indexOf("router.post('/verkauf'") + 1200);
ok(/requireAdmin, requireRole\('owner'\)/.test(ab) && /await audit\(/.test(ab), 'Admin: Schalten nur owner, mit audit()');
ok(/'verkauf\.' \+ \(b\.aktiv \? 'an' : 'aus'\)/.test(ab), 'Admin: Aktion verkauf.an / verkauf.aus im Protokoll');
ok(/gezaehlt\('hauscheck'/.test(lies('backend/src/services/hausCheck.js')) && /gezaehlt\('einzelcheck'/.test(lies('backend/src/services/einzelcheck.js')), 'beide Webhooks zählen');
ok(/Bald verfügbar/.test(lies('frontend/landing/haus-check-kauf.js')) && /p\.verkauf !== false/.test(lies('frontend/landing/haus-check-kauf.js')) && /verkauf = false;/.test(lies('frontend/landing/haus-check-kauf.js')), 'Landing Haus-Check: Bald verfügbar, auch ohne Antwort von /preis');
ok(/Bald verfügbar/.test(lies('frontend/landing/einzelcheck.js')) && /INFO\.verkauf = p\.verkauf !== false/.test(lies('frontend/landing/einzelcheck.js')), 'Landing Einzel-Check: Bald verfügbar');
const ui = lies('frontend/admin/js/admin-betrieb.js');
ok(/data-vk-zu/.test(ui) && /Escape/.test(ui) && !/vk-modal[^;]*addEventListener\('click', *zu\)/.test(ui) && !/m\.addEventListener\('click'/.test(ui), 'Admin-Fenster: schliesst nur über Abbrechen, × oder Esc');
ok(/var\(--wl-c9a84c/.test(ui), 'Admin-Fenster: Gold als Whitelabel-Token');
ok(/CREATE TABLE IF NOT EXISTS public\.verkauf_schalter/.test(lies('backend/migrations/135_verkauf_schalter.sql')), 'Migration 135');

/* C · Gegenprobe: ein Schalter, der den DB-Wert ignoriert, wäre rot */
{
  welt({ env: { HAUSCHECK_AKTIV: '1' }, db: { hauscheck: false } });
  const ignorant = async () => vs.umgebungErlaubt('hauscheck');
  ok(await ignorant() !== await vs.verkauft('hauscheck'), 'Gegenprobe: nur die Umgebung zu prüfen ergäbe ein anderes Ergebnis');
  vs._setzeDeps(null);
}
console.log((rot ? 'ROT' : 'sauber') + ' · ' + gruen + ' grün, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
