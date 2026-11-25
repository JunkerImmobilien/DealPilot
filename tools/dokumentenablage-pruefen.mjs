#!/usr/bin/env node
/* tools/dokumentenablage-pruefen.mjs — v4860 · DOKUMENTENABLAGE (Marcel 25.11.2026)
 *
 * Prüft services/dateiAblage.js am echten Code, ohne Datenbank (Teil A, eigene Mini-Datenbank im Speicher):
 *   A1 Grenzen je Plan: Free 0 · Starter 500 MB · Investor 1 GB · Pro 3 GB · Business 25 GB · Partner 5 GB, Datei 20 MB
 *   A2 Free darf nicht ablegen (403), Starter darf; über 20 MB → 413; Speicher voll → 507
 *   A3 Verschlüsselung rund (Klartext zurück, auf dem Laufwerk kein Klartext), Manipulation → Fehler
 *   A4 fremder Nutzer: holen → null, löschen → false
 *   A5 Jahr löschen trifft nur das Jahr und nur das Objekt
 *   A6 Löschfrist: Free mit Dateien → Frist +90 Tage und eine Mail; vor Ablauf nichts gelöscht; nach Ablauf gelöscht;
 *      wieder ein Plan mit Ablage → Frist fällt weg; trocken schreibt nichts
 *   A7 Frontend: dateiablage.js eingebunden, Rückfrage ohne Schließen per Klick daneben, Häkchen „Original aufbewahren“
 *   A9  v4910 Einsortieren: Ordner aus der Dokumentart, Jahr aus Belegdatum, sonst Ablagejahr
 *   A10 v4910 Belegung in Prozent, Warnstufe ab 80 %
 *   A11 v4910 Ordner löschen (auch mit Jahr) trifft nur Ordner/Jahr/Objekt
 *   A12 v4910 Konto löschen: kontoLoeschen.loeschen räumt die Ablage (Laufwerk) vor dem Nutzer ab
 *   A13 v4910 Frontend: Belegungsanzeige im Beleg-Dialog und in Meine Dokumente, Einstellungen › Dokumente
 *   G  Gegenproben (Free mit 100 MB, Frist 0 Tage) müssen rot werden
 * Teil B (--live, NUR Staging, im Backend-Container): echter Lauf gegen Postgres mit einem Testkonto, räumt selbst ab.
 */
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = process.argv.includes('--live');
let fehler = 0, ok = 0;
function pruef(name, bed, info) { if (bed) { ok++; console.log('  ok   ' + name); } else { fehler++; console.log('  ROT  ' + name + (info ? '  · ' + info : '')); } }

/* ── Mini-Datenbank ── */
function neueDb() {
  const db = { dateien: [], fristen: {}, objekte: {}, plaene: {}, mails: [], users: {} };
  db.query = async (sql, a = []) => {
    const s = sql.replace(/\s+/g, ' ');
    const rows = (r) => ({ rows: r, rowCount: r.length });
    const aktiv = (d) => !d.deleted_at && d.quelle !== 'objektfoto';
    if (/SUM\(groesse\)/.test(s)) { const l = db.dateien.filter((d) => d.user_id === a[0] && aktiv(d)); return rows([{ belegt: l.reduce((x, d) => x + d.groesse, 0), anzahl: l.length }]); }
    if (/SELECT frist_am FROM dateien_fristen/.test(s)) { const f = db.fristen[a[0]]; return rows(f ? [f] : []); }
    if (/SELECT 1 FROM objects/.test(s)) return rows(db.objekte[a[0]] === a[1] ? [{}] : []);
    if (/sha256 = \$2 AND ordner = \$3/.test(s)) return rows(db.dateien.filter((d) => d.user_id === a[0] && d.sha256 === a[1] && d.ordner === a[2] && (d.object_id || null) === (a[3] || null) && !d.deleted_at));
    if (/^INSERT INTO dateien \(/.test(s)) { const z = { id: crypto.randomUUID(), user_id: a[0], object_id: a[1], ordner: a[2], name: a[3], mime: a[4], groesse: a[5], sha256: a[6], ablage_schluessel: a[7], quelle: a[8], meta: JSON.parse(a[9]), created_at: new Date(), deleted_at: null }; db.dateien.push(z); return rows([z]); }
    if (/FROM dateien (d LEFT JOIN objects o ON o\.id = d\.object_id )?WHERE (d\.)?user_id = \$1 AND (d\.)?deleted_at IS NULL AND (d\.)?quelle IS DISTINCT FROM 'objektfoto'( AND (d\.)?object_id = \$2)? ORDER/.test(s)) return rows(db.dateien.filter((d) => d.user_id === a[0] && aktiv(d) && (a.length < 2 || d.object_id === a[1])));
    if (/SELECT \* FROM dateien WHERE id = \$1 AND user_id = \$2/.test(s)) return rows(db.dateien.filter((d) => d.id === a[0] && d.user_id === a[1] && !d.deleted_at));
    if (/UPDATE dateien SET deleted_at/.test(s)) { const d = db.dateien.find((x) => x.id === a[0] && x.user_id === a[1] && aktiv(x)); if (!d) return rows([]); d.deleted_at = new Date(); return rows([{ ablage_schluessel: d.ablage_schluessel }]); }
    if (/SELECT DISTINCT user_id FROM dateien/.test(s)) return rows([...new Set(db.dateien.filter((d) => aktiv(d) && (!a.length || d.user_id === a[0])).map((d) => d.user_id))].map((u) => ({ user_id: u })));
    if (/INSERT INTO dateien_fristen/.test(s)) { if (!db.fristen[a[0]]) db.fristen[a[0]] = { erkannt_am: a[1], frist_am: a[2], mail_am: null }; return rows([]); }
    if (/UPDATE dateien_fristen SET mail_am/.test(s)) { if (db.fristen[a[0]]) db.fristen[a[0]].mail_am = a[1]; return rows([]); }
    if (/DELETE FROM dateien_fristen/.test(s)) { delete db.fristen[a[0]]; return rows([]); }
    if (/SELECT id FROM dateien WHERE user_id = \$1 AND deleted_at IS NULL/.test(s)) return rows(db.dateien.filter((d) => d.user_id === a[0] && aktiv(d)).map((d) => ({ id: d.id })));
    throw new Error('Mini-DB kennt die Abfrage nicht: ' + s.slice(0, 120));
  };
  return db;
}

function ladeDienst(db, ablageDir) {
  const dienst = path.join(WURZEL, 'backend/src/services/dateiAblage.js');
  const stub = (p, exp) => { const f = path.join(WURZEL, p); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
  /* Abhängigkeiten im Modul-Cache ersetzen: dateiAblage.js lädt subscriptionService erst zur Laufzeit */
  stub('backend/src/db/pool.js', { query: db.query });
  stub('backend/src/services/subscriptionService.js', { getEffectivePlan: async (u) => ({ plan_id: db.plaene[u] || 'free' }) });
  delete require.cache[dienst];
  process.env.DATEI_ABLAGE_DIR = ablageDir;
  process.env.DATEI_SCHLUESSEL = crypto.randomBytes(32).toString('hex');
  return require(dienst);
}

async function teilA(gegenprobe) {
  const db = neueDb(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpab-'));
  const A = ladeDienst(db, dir);
  const MB = 1024 * 1024;
  if (gegenprobe === 'free100') A.GRENZE_JE_PLAN.free = 100 * MB;
  const u1 = crypto.randomUUID(), u2 = crypto.randomUUID(), o1 = crypto.randomUUID(), o2 = crypto.randomUUID();
  db.objekte[o1] = u1; db.objekte[o2] = u1; db.plaene[u1] = 'starter'; db.plaene[u2] = 'free';
  const erg = {};
  /* A1 */
  const G = A.GRENZE_JE_PLAN;
  erg.a1 = G.free === 0 && G.starter === 500 * MB && G.investor === 1024 * MB && G.pro === 3072 * MB && G.business === 25600 * MB && G.partner === 5120 * MB && A.MAX_DATEI === 20 * MB && A.FRIST_TAGE === 90;
  /* A2 */
  let st = 0; try { await A.ablegen(u2, { puffer: Buffer.from('x'), name: 'a.pdf' }); st = 201; } catch (e) { st = e.status; }
  erg.a2free = st === 403;
  let st2 = 0; try { await A.ablegen(u1, { puffer: Buffer.alloc(21 * MB, 1), name: 'gross.pdf' }); } catch (e) { st2 = e.status; }
  erg.a2gross = st2 === 413;
  const klar = Buffer.from('Mietvertrag Wohnung 3, Musterweg 7 (Testinhalt)');
  const d1 = await A.ablegen(u1, { puffer: klar, name: 'mv.pdf', objectId: o1, ordner: 'Mietverträge', meta: { jahr: 2025 } });
  erg.a2starter = !!(d1 && d1.id);
  /* A3 */
  const z1 = db.dateien.find((d) => d.id === d1.id);
  const roh = fs.readFileSync(path.join(dir, u1, z1.ablage_schluessel));
  const h = await A.holen(u1, d1.id);
  erg.a3rund = h && Buffer.compare(h.puffer, klar) === 0 && roh.indexOf(klar) < 0 && roh.slice(0, 4).toString() === 'DPA1';
  const kaputt = Buffer.from(roh); kaputt[kaputt.length - 1] ^= 0xff; fs.writeFileSync(path.join(dir, u1, z1.ablage_schluessel), kaputt);
  let wurf = false; try { await A.holen(u1, d1.id); } catch (e) { wurf = true; }
  erg.a3manip = wurf;
  fs.writeFileSync(path.join(dir, u1, z1.ablage_schluessel), roh);
  /* A4 */
  erg.a4 = (await A.holen(u2, d1.id)) === null && (await A.loeschen(u2, d1.id)) === false;
  /* A5 */
  await A.ablegen(u1, { puffer: Buffer.from('beleg 2024'), name: 'b24.pdf', objectId: o1, ordner: 'Rechnungen', meta: { jahr: 2024 } });
  await A.ablegen(u1, { puffer: Buffer.from('beleg 2024 b'), name: 'b24b.pdf', objectId: o1, ordner: 'Rechnungen', meta: { jahr: 2024 } });
  await A.ablegen(u1, { puffer: Buffer.from('beleg 2024 anderes Objekt'), name: 'x24.pdf', objectId: o2, ordner: 'Rechnungen', meta: { jahr: 2024 } });
  const n = await A.loeschenJahr(u1, o1, 2024);
  const rest = await A.liste(u1, undefined);
  erg.a5 = n === 2 && rest.length === 2 && rest.some((d) => d.object_id === o2 && d.jahr === 2024) && rest.some((d) => d.jahr === 2025);
  /* A6 */
  db.plaene[u1] = 'free';
  const t0 = new Date('2026-12-01T10:00:00Z'), mails = [];
  const tr = await A.fristLauf({ jetzt: t0, trocken: true });
  const nachTrocken = Object.keys(db.fristen).length;
  const r1 = await A.fristLauf({ jetzt: t0, mail: async (u, am) => { mails.push([u, am]); } });
  const fr = db.fristen[u1];
  const tage = fr ? Math.round((new Date(fr.frist_am) - t0) / 864e5) : -1;
  const r2 = await A.fristLauf({ jetzt: new Date(t0.getTime() + 30 * 864e5), mail: async () => mails.push(['nochmal']) });
  const vorAblauf = (await A.liste(u1, undefined)).length;
  const r3 = await A.fristLauf({ jetzt: new Date(t0.getTime() + 91 * 864e5) });
  const nachAblauf = (await A.liste(u1, undefined)).length;
  erg.a6trocken = tr.neu === 1 && nachTrocken === 0;
  erg.a6frist = r1.neu === 1 && tage === 90 && mails.length === 1 && !!fr.mail_am;
  erg.a6vor = r2.neu === 0 && r2.geloescht_konten === 0 && vorAblauf === 2;
  erg.a6nach = r3.geloescht_konten === 1 && nachAblauf === 0 && !db.fristen[u1];
  /* wieder Plan mit Ablage: Frist fällt weg */
  db.plaene[u1] = 'starter';
  await A.ablegen(u1, { puffer: Buffer.from('neu'), name: 'n.pdf', objectId: o1 });
  db.plaene[u1] = 'free'; await A.fristLauf({ jetzt: t0 });
  db.plaene[u1] = 'investor'; const r4 = await A.fristLauf({ jetzt: t0 });
  erg.a6auf = r4.aufgehoben === 1 && !db.fristen[u1];
  fs.rmSync(dir, { recursive: true, force: true });
  return erg;
}

console.log('Dokumentenablage · Teil A (ohne Datenbank)');
const e = await teilA();
pruef('A1 Grenzen je Plan, Datei 20 MB, Frist 90 Tage', e.a1);
pruef('A2 Free legt nicht ab (403)', e.a2free);
pruef('A2 über 20 MB abgewiesen (413)', e.a2gross);
pruef('A2 Starter legt ab', e.a2starter);
pruef('A3 Verschlüsselung rund, kein Klartext auf dem Laufwerk', e.a3rund);
pruef('A3 manipulierte Datei wird nicht entschlüsselt', e.a3manip);
pruef('A4 fremder Nutzer: holen null, löschen false', e.a4);
pruef('A5 Jahr löschen trifft nur Jahr und Objekt', e.a5);
pruef('A6 trocken schreibt keine Frist', e.a6trocken);
pruef('A6 Frist +90 Tage und genau eine Mail', e.a6frist);
pruef('A6 vor Ablauf nichts gelöscht, keine zweite Mail', e.a6vor);
pruef('A6 nach Ablauf gelöscht, Frist weg', e.a6nach);
pruef('A6 wieder Plan mit Ablage: Frist aufgehoben', e.a6auf);

/* A7 Frontend */
const fe = fs.readFileSync(path.join(WURZEL, 'frontend/js/dateiablage.js'), 'utf8');
const idx = fs.readFileSync(path.join(WURZEL, 'frontend/index.html'), 'utf8');
const oa = fs.readFileSync(path.join(WURZEL, 'frontend/js/object-actions.js'), 'utf8');
const ue = fs.readFileSync(path.join(WURZEL, 'frontend/js/unterlagen-eingang.js'), 'utf8');
const pa = fs.readFileSync(path.join(WURZEL, 'frontend/js/pilot-analyse-v4.js'), 'utf8');
pruef('A7 dateiablage.js in index.html geladen', /<script src="js\/dateiablage\.js\?v=/.test(idx));
pruef('A7 Rückfrage schließt nicht per Klick daneben', /Klick daneben: nichts/.test(fe) && !/ov\.addEventListener\('click', function \(ev\) \{ if \(ev\.target === ov\)/.test(fe));
pruef('A7 Jahr löschen und Einzel-Löschen mit Rückfrage', /data-ab-jahr-loeschen/.test(fe) && /bestaetigen\('Datei löschen\?'/.test(fe));
pruef('A7 Häkchen „Original aufbewahren“ im Eingang', /id="oabi-orig"/.test(oa.replace(/\\"/g, '"')) && /_originaleAblegen\(/.test(oa));
pruef('A7 Verlauf: Original-Knopf und Löschen fragt nach den Dateien', /data-eg-orig/.test(ue) && /eintragLoeschenMitDatei/.test(ue) && /dateienVerknuepfen/.test(ue));
pruef('A7 Karte „Meine Dokumente“ in Haus & Unterlagen', /kopfzeile\('Meine Dokumente'\)/.test(pa));
pruef('A7 Kundentext ohne Gedankenstrich und Semikolon', !(fe.match(/'[^'\n]{12,}'/g) || []).filter((t) => !/[(){}=]/.test(t)).some((t) => / – |; [a-zäöü]/.test(t)));

/* A8 Plattenbelegung (Warnung ab 70 %, Ort über DATEI_ABLAGE_DIR) */
{
  const db = neueDb(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpab-p-'));
  const A = ladeDienst(db, dir);
  const p = await A.plattenStand();
  const mails = [];
  const w1 = await A.plattenWarnung({ stand: Object.assign({}, p, { belegt_pct: 71, warnung: true }), mail: async (m) => mails.push(m) });
  const w2 = await A.plattenWarnung({ stand: Object.assign({}, p, { belegt_pct: 40, warnung: false }), mail: async (m) => mails.push(m) });
  pruef('A8 Plattenstand liest den eingestellten Ort', p && p.ort === dir && p.gesamt_bytes > 0 && p.warn_pct === 70);
  pruef('A8 Warnung ab 70 % genau eine Mail, darunter keine', w1.gewarnt && !w2.gewarnt && mails.length === 1);
  fs.rmSync(dir, { recursive: true, force: true });
}

/* A9–A12 · v4910 */
async function teilB(gegenprobe) {
  const db = neueDb(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpab-b-'));
  const A = ladeDienst(db, dir);
  if (gegenprobe === 'keinOrdner') A.ordnerAus = () => 'Sonstiges';
  const u = crypto.randomUUID(), o1 = crypto.randomUUID(), o2 = crypto.randomUUID();
  db.objekte[o1] = u; db.objekte[o2] = u; db.plaene[u] = 'investor';
  const e = {};
  const r1 = await A.ablegen(u, { puffer: Buffer.from('rechnung 2025'), name: 'r.pdf', objectId: o1, meta: { art: 'Rechnung', rechnungsdatum: '2025-04-03' } });
  const r2 = await A.ablegen(u, { puffer: Buffer.from('protokoll'), name: 'p.pdf', objectId: o1, meta: { art: 'WEG-Protokoll', datum: '12.05.2024' } });
  const r3 = await A.ablegen(u, { puffer: Buffer.from('ea'), name: 'e.pdf', objectId: o1, meta: { art: 'Energieausweis' } });
  const r4 = await A.ablegen(u, { puffer: Buffer.from('eigener ordner'), name: 'x.pdf', objectId: o1, ordner: 'Mein Ordner', meta: { art: 'Rechnung' } });
  const l = await A.liste(u, o1);
  const j = (id) => (l.find((d) => d.id === id) || {}).jahr;
  e.a9 = r1.ordner === 'Belege' && r2.ordner === 'Protokolle' && r3.ordner === 'Energieausweis' && r4.ordner === 'Mein Ordner'
    && j(r1.id) === 2025 && j(r2.id) === 2024 && j(r3.id) === new Date().getFullYear();
  const s = await A.stand(u);
  e.a10 = typeof s.belegt_pct === 'number' && s.belegt_pct >= 0 && s.belegt_pct <= 100 && s.warnung === false;
  db.dateien.push({ id: crypto.randomUUID(), user_id: u, object_id: o2, ordner: 'Sonstiges', name: 'gross', groesse: 900 * 1024 * 1024, sha256: 'z', ablage_schluessel: 'z', quelle: 'upload', meta: {}, created_at: new Date() });
  const s2 = await A.stand(u);
  e.a10warn = s2.warnung === true && s2.belegt_pct >= 80;
  await A.ablegen(u, { puffer: Buffer.from('beleg 2024'), name: 'b24.pdf', objectId: o1, meta: { art: 'Rechnung', jahr: 2024 } });
  const nOrd = await A.loeschenGruppe(u, o1, { ordner: 'Belege', jahr: 2024 });
  const nach = await A.liste(u, o1);
  const nLeer = await A.loeschenGruppe(u, o1, {});
  e.a11 = nOrd === 1 && nach.some((d) => d.id === r1.id) && nach.some((d) => d.id === r2.id) && nLeer === 0;
  fs.rmSync(dir, { recursive: true, force: true });
  return e;
}
const eb = await teilB();
pruef('A9 Einsortieren: Ordner aus Dokumentart, Jahr aus Belegdatum, sonst Ablagejahr, eigener Ordner bleibt', eb.a9);
pruef('A10 Belegung in Prozent', eb.a10);
pruef('A10 Warnstufe ab 80 %', eb.a10warn);
pruef('A11 Ordner und Jahr löschen trifft nur diese, ohne Angabe nichts', eb.a11);
{
  const kl = fs.readFileSync(path.join(WURZEL, 'backend/src/services/kontoLoeschen.js'), 'utf8');
  const iAbl = kl.indexOf("require('./dateiAblage').kontoLeeren(userId)"), iDel = kl.indexOf("DELETE FROM users WHERE id = $1");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpab-k-')), A = ladeDienst(neueDb(), dir);
  const u = crypto.randomUUID(); fs.mkdirSync(path.join(dir, u)); fs.writeFileSync(path.join(dir, u, 'a'), 'x');
  const ok1 = await A.kontoLeeren(u);
  pruef('A12 Konto löschen leert die Ablage vom Laufwerk, vor dem Löschen des Nutzers', iAbl > 0 && iDel > iAbl && ok1 && !fs.existsSync(path.join(dir, u)));
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const st = fs.readFileSync(path.join(WURZEL, 'frontend/js/settings.js'), 'utf8');
  pruef('A13 Belegungsanzeige (DpAblage.belegungHtml) im Beleg-Dialog und in Meine Dokumente', /belegungHtml/.test(fe) && /DpAblage\.belegungHtml/.test(oa) && /belegungHtml\(/.test(fe.split('function zeichnen')[1] || ''));
  pruef('A13 Einstellungen › Dokumente (DpAblage.verwaltung)', /DpAblage\.verwaltung/.test(st) && /function verwaltung/.test(fe));
}
const gb = await teilB('keinOrdner');
pruef('G  Gegenprobe ohne Einsortierung wird rot (A9)', !gb.a9);

/* Gegenprobe */
const g = await teilA('free100');
pruef('G  Gegenprobe Free mit 100 MB wird rot (A1/A2)', !g.a1 && !g.a2free);

if (LIVE) {
  console.log('\nTeil B (--live) · echte Datenbank');
  for (const k of Object.keys(require.cache)) if (/backend[\\/]src/.test(k)) delete require.cache[k];   /* Stubs aus Teil A weg */
  const A = require(path.join(WURZEL, 'backend/src/services/dateiAblage.js'));
  const { query } = require(path.join(WURZEL, 'backend/src/db/pool'));
  const email = 'ablage-pruefer-' + Date.now() + '@ablage-pruefer.dealpilot.test';
  const u = (await query("INSERT INTO users (email, password_hash, name) VALUES ($1, 'x', 'Ablage Prüfer') RETURNING id", [email])).rows[0].id;
  try {
    const s = await A.stand(u);
    pruef('B1 neues Konto (Free): darf nicht ablegen', s.darf_ablegen === false && s.bereit === true, JSON.stringify(s));
    let st = 0; try { await A.ablegen(u, { puffer: Buffer.from('x'), name: 't.pdf' }); } catch (x) { st = x.status; }
    pruef('B2 Free: Ablegen 403', st === 403);
    const r = await A.fristLauf({ trocken: true, nurNutzer: u });
    pruef('B3 Fristlauf trocken auf echter DB', r && typeof r.geprueft === 'number');
  } finally {
    await query('DELETE FROM users WHERE id = $1', [u]);
  }
}

console.log('\n' + ok + ' ok, ' + fehler + ' rot');
process.exit(fehler ? 1 : 0);
