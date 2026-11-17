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
 *     v3460 E-Mail bei Rueckmeldung: echtes zurueckgeben() mit nachgebauter DB - Schalter aus = keine Mail, an/Vorgabe =
 *     genau eine Mail im Partner-Rahmen, Testadressen nie ueber SMTP, SMTP- und Vorbereitungsfehler brechen nicht ab.
 * B · tools/partner-anmerkungen-live.js: Rechte (fremder Partner, fremder Kunde, Entwurf unsichtbar), Lebenszyklus
 *     (Entwurf -> zurueckgegeben -> erledigt, Aufgabe erledigt, Meldung beim Partner), Feldbezug ueberlebt einen neuen Stand;
 *     v3460 Schalter je Kunde ueber die echte Route (aus -> 'aus', an -> 'testadresse'), share_audit, fremder Partner 404.
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

/* ── v3460 · E-Mail an den Kunden bei Rueckmeldung ─────────────────────────
   Das ECHTE Modul (services/partnerAnmerkungen.js) mit dem ECHTEN Mail-Rahmen (resellerInviteMail.js) und der ECHTEN
   Testadressen-Pruefung (objektUebergabe.istTestadresse); ersetzt sind nur db/pool (Antworten je SQL), mailerService
   (zaehlt statt zu senden) und die Module ohne Bezug. zurueckgeben() laeuft vollstaendig durch. */
console.log('A · E-Mail bei Rueckmeldung (v3460)');
{
  const SRC = path.join(WURZEL, 'backend', 'src');
  const gesendet = [];
  let mailerFehler = false;
  const db = { k: {}, audit: [], aufgaben: 0 };
  let antworte = async () => ({ rows: [] });
  const stub = (rel, exp) => { const f = require.resolve(path.join(SRC, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
  stub('db/pool.js', { query: (sql, p) => antworte(sql, p), pool: {} });
  stub('services/planService.js', {});
  stub('services/partnerKunden.js', {});
  stub('services/objectService.js', {});
  stub('services/objektFotos.js', {});
  stub('services/mailerService.js', { sendMail: async (o) => { if (mailerFehler) throw new Error('SMTP weg (Test)'); gesendet.push(o); return { dryRun: false, to: o.to }; } });
  const logoUrl = (basis, id, art, v) => (!basis || !id) ? null : String(basis).replace(/\/+$/, '') + '/api/v1/public/partner-logo/' + id + '/' + art + '.png' + (v ? '?v=' + v : '');
  stub('routes/partnerLogo.js', Object.assign(() => {}, { logoUrl }));
  const A = require(path.join(SRC, 'services', 'partnerAnmerkungen.js'));
  const S = '11111111-1111-4111-8111-111111111111';
  antworte = async (sql, p) => {
    if (/FROM object_shares s JOIN reseller_clients/.test(sql)) return { rows: [{ id: S, reseller_id: 'r1', client_id: 'c1', object_id: 'o1', kopie_object_id: 'k1', stand_nr: 1, status: 'gesendet' }] };
    if (/SELECT id FROM partner_anmerkungen/.test(sql)) return { rows: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] };
    if (/FROM objects WHERE id/.test(sql)) return { rows: [{ name: 'Objekt', str: 'Musterweg', hnr: '5', ort: 'Musterstadt' }] };
    if (/INSERT INTO partner_aufgaben \(/.test(sql)) { db.aufgaben++; return { rows: [{ id: 'auf' + db.aufgaben, titel: p[1] }] }; }
    if (/SELECT c\.mail_rueckmeldung/.test(sql)) return { rows: [db.k] };
    if (/FROM resellers WHERE id/.test(sql)) return { rows: [{ id: 'r1', name: 'Testpartner', brand_name: 'Muster Immobilien', whitelabel_enabled: true, brand_accent: '#2266AA', brand_email: 'kontakt@muster-immobilien.test', brand_company: 'Muster Immobilien GmbH', stand: 1 }] };
    if (/INSERT INTO share_audit/.test(sql)) { db.audit.push(JSON.parse(p[2])); return { rows: [] }; }
    return { rows: [] };
  };
  const rs = { id: 'r1' };
  const lauf = async (k, opt) => { db.k = k; gesendet.length = 0; db.audit.length = 0; return A.zurueckgeben(rs, 'u1', S, { text: 'Bitte die zwei Punkte ansehen.' }, Object.assign({ basis: 'https://app.beispiel.invalid' }, opt || {})); };
  const altEnv = { a: process.env.FRONTEND_BASE_URL, b: process.env.APP_URL, c: process.env.FRONTEND_URL };
  delete process.env.FRONTEND_BASE_URL; delete process.env.APP_URL; delete process.env.FRONTEND_URL;

  let r = await lauf({ mail_rueckmeldung: false, display_name: 'Kundin Muster', email: 'kundin@muster-kunde.de' });
  ok('Schalter aus: Aufgabe steht, keine Mail, Status aus', r.ok && r.aufgabe_id && r.anzahl === 3 && r.mail.status === 'aus' && gesendet.length === 0, [r.mail, gesendet.length]);
  ok('Schalter aus: Status steht im share_audit', db.audit[0] && db.audit[0].mail === 'aus', db.audit);
  r = await lauf({ mail_rueckmeldung: true, display_name: 'Kundin Muster', email: 'kundin@muster-kunde.de' });
  const g = gesendet[0] || {};
  ok('Schalter an: genau eine Mail an den Kunden', r.mail.status === 'gesendet' && gesendet.length === 1 && g.to === 'kundin@muster-kunde.de', [r.mail, gesendet.length, g.to]);
  ok('Vorgabe an: Spalte fehlt (NULL/undefined) -> Mail', (await lauf({ display_name: 'Kundin Muster', email: 'kundin@muster-kunde.de' })).mail.status === 'gesendet' && gesendet.length === 1);
  ok('Betreff: Partnermarke vorn, Objekt', /^Muster Immobilien: Rückmeldung zu Musterweg 5, Musterstadt$/.test(g.subject || ''), g.subject);
  ok('Absender und Antwortadresse des Partners', g.fromName === 'Muster Immobilien' && g.replyTo === 'kontakt@muster-immobilien.test', [g.fromName, g.replyTo]);
  const html = g.html || '', text = g.text || '';
  ok('Inhalt: Zahl der Anmerkungen, Begleittext, Objekt', /3 Anmerkungen/.test(html) && /Bitte die zwei Punkte ansehen\./.test(html) && /Musterweg 5, Musterstadt/.test(html) && /3 Anmerkungen/.test(text) && /Bitte die zwei Punkte ansehen\./.test(text));
  ok('Knopf in die App: ?dp_partner=aufgaben', html.includes('href="https://app.beispiel.invalid/?dp_partner=aufgaben"') && text.includes('https://app.beispiel.invalid/?dp_partner=aufgaben'));
  ok('DealPilot nur als Plattform', (html.match(/DealPilot/g) || []).length === 1 && /Plattform: DealPilot/.test(html) && /Plattform: DealPilot/.test(text) && !/DealPilot/.test(g.subject), (html.match(/DealPilot/g) || []).length);
  ok('Rahmen der Einladungs-Mail (marke/rahmen, Akzent des Partners), kein data:-Bild', html.startsWith('<div style="max-width:560px') && html.includes('#2266AA') && !/data:image/.test(html));
  ok('Anmerkungstexte stehen nicht in der Mail (nur die Zahl)', !/Bitte prüfen|Bitte nachreichen|Kaufpreis/.test(html));
  const xss = A.rueckmeldungMailBauen({ reseller: {}, anzeigeName: '<b>x</b>', objName: '<script>', anzahl: 1, begleit: '<img src=x onerror=1>', link: 'https://a.invalid/?dp_partner=aufgaben' });
  ok('Eingaben werden maskiert, 1 Anmerkung im Singular', !/<script>|<img src=x/.test(xss.html) && /1 Anmerkung</.test(xss.html) && /Plattform/.test(xss.html) === false, xss.html.slice(0, 120));
  for (const adr of ['kunde-a@partner-pruefung.dealpilot.test', 'x@foo.invalid', 'x@example.com', 'x@sub.example.org', 'x@ort.example']) {
    r = await lauf({ mail_rueckmeldung: true, display_name: 'Testkunde', email: adr });
    ok('Testadresse ' + adr.split('@')[1] + ' nie ueber SMTP', r.mail.status === 'testadresse' && gesendet.length === 0, [r.mail, gesendet.length]);
  }
  r = await lauf({ mail_rueckmeldung: true, display_name: 'Testkunde', email: '' });
  ok('ohne Adresse: kein Versand, Aufgabe steht', r.ok && r.mail.status === 'ohne_adresse' && gesendet.length === 0, r.mail);
  mailerFehler = true;
  r = await lauf({ mail_rueckmeldung: true, display_name: 'Kundin Muster', email: 'kundin@muster-kunde.de' });
  ok('SMTP-Fehler bricht das Zurueckgeben nicht ab (ok, Aufgabe, Status fehler, Audit)', r.ok && r.aufgabe_id && r.mail.status === 'fehler' && db.audit[0] && db.audit[0].mail === 'fehler', r);
  mailerFehler = false;
  const altAntw = antworte;
  antworte = async (sql, p) => { if (/FROM resellers WHERE id/.test(sql)) throw new Error('DB weg (Test)'); return altAntw(sql, p); };
  r = await lauf({ mail_rueckmeldung: true, display_name: 'Kundin Muster', email: 'kundin@muster-kunde.de' });
  ok('Fehler beim Vorbereiten (Marke) bricht nicht ab', r.ok && r.aufgabe_id && r.mail.status === 'fehler', r);
  antworte = altAntw;
  process.env.APP_URL = 'https://staging.beispiel.invalid';
  r = await lauf({ mail_rueckmeldung: true, display_name: 'Kundin Muster', email: 'kundin@muster-kunde.de' });
  ok('.env-Adresse geht vor dem Host der Anfrage', (gesendet[0] || {}).text && gesendet[0].text.includes('https://staging.beispiel.invalid/?dp_partner=aufgaben'));
  if (altEnv.a !== undefined) process.env.FRONTEND_BASE_URL = altEnv.a;
  if (altEnv.b !== undefined) process.env.APP_URL = altEnv.b; else delete process.env.APP_URL;
  if (altEnv.c !== undefined) process.env.FRONTEND_URL = altEnv.c;

  /* Schalter im Partner-Cockpit und Einstellung im Backend */
  const pkq = fs.readFileSync(path.join(WURZEL, 'frontend/js/partner-kunden.js'), 'utf8');
  /* v3640c · Kundendialog im RND-Stil: der Reiter „Kunde“ (kundeReiter) steht fuer BEIDE Zugangsarten vorn */
  ok('Cockpit: Schalter im Kundendialog beider Zugangsarten, gespeichert als mail_rueckmeldung', /var reiter = \[kundeReiter\(k\)\];/.test(pkq) && /hubChips\('pk-k-mailrm'/.test(pkq) && (pkq.match(/mail_rueckmeldung: chipWert\(b, 'pk-k-mailrm'\) !== 'aus'/g) || []).length === 1);
  ok('Cockpit: Vorgabe an (nur false schaltet aus)', /k\.mail_rueckmeldung !== false \? 'an' : 'aus'/.test(pkq));
  ok('Cockpit: Link ?dp_partner=aufgaben wird eingeloest', /get\('dp_partner'\)/.test(pkq) && /meinPartnerOeffnen\('aufgaben'\)/.test(pkq));
  const pks = fs.readFileSync(path.join(SRC, 'services/partnerKunden.js'), 'utf8');
  ok('Backend: kundeEinstellen setzt mail_rueckmeldung auch bei eigenem Plan', /if \(b\.mail_rueckmeldung !== undefined\) await query\(`UPDATE reseller_clients SET mail_rueckmeldung/.test(pks) && /setze\('mail_rueckmeldung'/.test(pks));
  ok('Backend: Cockpit und Kundenstaende liefern den Schalter', /c\.mail_rueckmeldung, c\.herkunft/.test(pks) && /c\.mail_rueckmeldung AS kunde_mail_rueckmeldung/.test(pks));
  const m107 = fs.readFileSync(path.join(WURZEL, 'backend/migrations/107_partner_mail_rueckmeldung.sql'), 'utf8');
  ok('Migration 107: mail_rueckmeldung boolean NOT NULL DEFAULT true, idempotent', /ADD COLUMN IF NOT EXISTS mail_rueckmeldung boolean NOT NULL DEFAULT true/.test(m107));
}

/* ── v3640 · Bildausschnitt an der Anmerkung, Rueckfrage, Sperre beim Senden ────────────────────────
   Marcel 17.11.2026: Bilder mit Markierungen an Anmerkungen; Zuruecksenden erst, wenn jede bearbeitet ist. */
{
  console.log('A · v3640 Bild, Rueckfrage, Senden');
  const A = require(path.join(WURZEL, 'backend', 'src', 'services', 'partnerAnmerkungen.js'));
  const bs = A._bildSauber;
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  ok('Bild: gueltiges PNG/WebP/JPEG bleibt', bs(png) === png && bs('data:image/webp;base64,UklGRg==') && bs('data:image/jpeg;base64,/9j/4A=='));
  ok('Bild: undefined = unveraendert, null/leer = entfernen', bs(undefined) === undefined && bs(null) === null && bs('') === null);
  const wirft = (v) => { try { bs(v); return null; } catch (e) { return e; } };
  const g = wirft('data:image/png;base64,' + 'A'.repeat(A.BILD_MAX));
  ok('Bild: ueber dem Deckel -> 413 bild_zu_gross', g && g.status === 413 && g.message === 'bild_zu_gross', g && g.message);
  ok('Bild: Deckel rund 400 KB (560000 Zeichen data:-URL) und unter dem DB-Netz 600000', A.BILD_MAX === 560000);
  const t = ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGI+', 'javascript:alert(1)', 'data:image/png;base64,<script>', 'https://x.invalid/a.png'].map(wirft);
  ok('Bild: SVG, HTML, Skript, fremde Adresse -> 400 bild_ungueltig', t.every((e) => e && e.status === 400 && e.message === 'bild_ungueltig'), t.map((e) => e && e.message));
  ok('Bild: _sauber nimmt es mit', A._sauber({ text: 'x', bild: png }).bild === png && A._sauber({ text: 'x' }).bild === undefined);
  const src = fs.readFileSync(modulPfad, 'utf8');
  ok('Bild: anlegen speichert, aendern ersetzt/entfernt, Kunde liest beide Bilder', /erstellt_von, bild\)/.test(src) && /bild = \$5 WHERE id = \$1/.test(src) && /n\.bild, n\.bild_antwort/.test(src) && /bild_antwort = \$4/.test(src));
  ok('Rueckfrage: Meldung an den Partner nennt sie und die Kundennummer', /' eine Rückfrage zu Anmerkung '/.test(src) && /n\.kundennummer \? ' \(' \+ n\.kundennummer/.test(src));
  const fe = {};
  vm.runInNewContext(fs.readFileSync(path.join(WURZEL, 'frontend/js/partner-anmerkungen.js'), 'utf8'), { window: fe, document: {}, setTimeout, clearTimeout, setInterval, clearInterval, console });
  const D = fe.DpAnmerkungen;
  ok('Frontend: Rueckfrage = offen mit Antwort oder Bild, erledigt nicht', !!D.istRueckfrage({ status: 'offen', antwort: 'Welcher Notar?' }) && !!D.istRueckfrage({ status: 'offen', bild_antwort: png }) && !D.istRueckfrage({ status: 'erledigt', antwort: 'ja' }) && !D.istRueckfrage({ status: 'offen', antwort: ' ' }));
  const m = D._zielMass(3200, 1000, 1600), m2 = D._zielMass(400, 300, 1600);
  ok('Frontend: Verkleinern haelt das Seitenverhaeltnis, vergroessert nie', m.w === 1600 && m.h === 500 && m2.w === 400 && m2.h === 300, [m, m2]);
  ok('Frontend: Groesse aus data:-URL (Ziel 400 KB)', D._bytesVon('data:image/png;base64,AAAA') === 3 && D.BILD_ZIEL === 409600);
  /* v3640a · html2canvas 1.4.1 bricht an color(srgb …)/oklab() ab - Umrechnung in der Kopie */
  const fu = D._farbeUmrechnen;
  const f1 = fu('color(srgb 0.788235 0.658824 0.298039 / 0.18)'), f2 = fu('linear-gradient(135deg, color(srgb 0.788235 0.658824 0.298039 / 0.18), color(srgb 1 1 1))');
  const f3 = fu('oklab(0.743202 0.00103384 0.117057 / 0.35) 0px 0px 14px, oklab(0 0 0 / 0) 0px 0px 0px'), f4 = fu('oklch(0.7 0.1 80)');
  ok('Farbumrechnung: color(srgb) -> rgba (Gold 201,168,76), auch im Verlauf', f1 === 'rgba(201, 168, 76, 0.18)' && f2 === 'linear-gradient(135deg, rgba(201, 168, 76, 0.18), rgba(255, 255, 255, 1))', [f1, f2]);
  ok('Farbumrechnung: oklab/oklch -> rgba, nichts Unbekanntes bleibt', !/(color|oklab|oklch)\(/.test(f3 + f4) && /^rgba\(\d+, \d+, \d+, 0\.35\) 0px 0px 14px, rgba\(0, 0, 0, 0\)/.test(f3), [f3, f4]);
  ok('Farbumrechnung: rgb bleibt unberuehrt', fu('rgb(1, 2, 3)') === 'rgb(1, 2, 3)' && fu('') === '');
  const fq = fs.readFileSync(path.join(WURZEL, 'frontend/js/partner-anmerkungen.js'), 'utf8');
  ok('Ausschnitt: alles in der Kopie (onclone): Transition aus, lesen dann schreiben in bis zu 3 Durchgaengen, Pseudoelemente, Verlauf ohne Flaeche', /onclone: farbenRetten/.test(fq) && /setProperty\('transition', 'none', 'important'\)/.test(fq) && /for \(var lauf = 0; lauf < 3; lauf\+\+\)/.test(fq) && /'::before', '::after'/.test(fq) && /\['background-image', 'none'\]/.test(fq) && (fq.match(/wurzel\.removeAttribute\('data-dp-wurzel'\)/g) || []).length === 2 && /imageTimeout: 2500/.test(fq));
  ok('Frontend: Ausschnitt ueber das vorhandene html2canvas, Rueckfall Einfuegen/Datei, Markieren rot mit Rueckgaengig',
    /window\.html2canvas\(wurzel, \{/.test(fq) && /function wurzelFuer\(rect\)/.test(fq) && /clipboardData/.test(fq) && /type="file" accept="image\/png,image\/jpeg,image\/webp"/.test(fq) && /var ROT = '#D8564C'/.test(fq) && /data-b="undo"/.test(fq) && /data-w="pfeil"/.test(fq) && /data-w="frei"/.test(fq) && /data-w="rechteck"/.test(fq));
  const idx = fs.readFileSync(path.join(WURZEL, 'frontend/index.html'), 'utf8');
  ok('index.html laedt html2canvas', /vendor\/cdn\/html2canvas\/1\.4\.1\/html2canvas\.min\.js/.test(idx));
}

/* ── v3491 · Kundenstand beim Partner: jeder Speicherweg still gesperrt ──────────────────────────────
   Gemessen 16.11.2026: beim Oeffnen eines Kundenstands zeigte die App „Fehler beim Speichern:
   kundenstand_schreibgeschuetzt“. Das Sofort-Speichern beim Laden lief, bevor partner-kunden.js die
   Sperre (_dppkKundenstand) setzte. Geprueft wird die ECHTE Funktion aus storage.js. */
{
  console.log('A · v3491 Kundenstand still schreibgeschuetzt');
  const st = fs.readFileSync(path.join(WURZEL, 'frontend/js/storage.js'), 'utf8').replace(/\r\n/g, '\n');
  const fn = st.slice(st.indexOf('function _dpIstKundenstand()'), st.indexOf('window._dpIstKundenstand = _dpIstKundenstand;'));
  const fall = (win) => { const c = { window: win }; vm.runInNewContext(fn + '\nthis.r = _dpIstKundenstand();', c); return c.r; };
  ok('Kundenstand am Datenblob (Sperre noch nicht gesetzt, Laden) → gesperrt', fall({ _currentObjData: { _kundenstand: { share_id: 's1' } } }) === true);
  ok('Sperre gesetzt (_dppkKundenstand) → gesperrt', fall({ _dppkKundenstand: { share_id: 's1' }, _currentObjData: {} }) === true);
  ok('eigenes Objekt → nicht gesperrt', fall({ _currentObjData: { str: 'Musterweg' } }) === false);
  ok('kein Objekt geladen → nicht gesperrt', fall({}) === false);
  const kopf = st.slice(st.indexOf('async function saveObj(opts) {'), st.indexOf('async function saveObj(opts) {') + 160);
  ok('saveObj prueft die Sperre als erstes, ohne Meldung', /opts = opts \|\| \{\};\n  if \(_dpIstKundenstand\(\)\) return null;/.test(kopf));
  const i = st.indexOf("toast('⚠ Fehler beim Speichern: ' + err.message);");
  ok('409 kundenstand_schreibgeschuetzt wird nie als Fehler gezeigt', i > 0 && /kundenstand_schreibgeschuetzt\/\.test\([^\n]*\)\) return null;[^\n]*\n\s*$/.test(st.slice(i - 400, i)));
  const an = fs.readFileSync(path.join(WURZEL, 'frontend/js/ankauf-ansicht.js'), 'utf8');
  ok('Ankauf-Stand speichern: Kundenstand still uebersprungen, keine Erfolgsmeldung', /if \(d\._kundenstand\) return false;/.test(an) && /if \(r === false\) return false;/.test(an));
  const idx = fs.readFileSync(path.join(WURZEL, 'frontend/index.html'), 'utf8');
  /* v3640 · „mindestens v3491“: jeder spaetere Stand traegt die Sperre mit (hier stand bis v3640 genau v3491, rot seit v3511) */
  const bv = (d) => { const i = idx.indexOf('js/' + d + '?v=v'); return i < 0 ? 0 : parseInt(idx.slice(i + d.length + 7), 10) || 0; };
  ok('Buster storage.js und ankauf-ansicht.js mindestens v3491', bv('storage.js') >= 3491 && bv('ankauf-ansicht.js') >= 3491, [bv('storage.js'), bv('ankauf-ansicht.js')]);
}

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
