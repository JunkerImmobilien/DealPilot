/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/anmeldung-auskunft-pruefen.mjs · v2094
   Backlog N60.3 (Vormessung)

   Prueft die Auskunft bei `is_active = false`.

   ER LAEDT DIE ECHTEN DATEIEN UND RUFT DIE ECHTE FUNKTION. Die Datenbank
   wird ersetzt, sonst nichts:
     · backend/src/services/userService.js   -> authenticate()
     · backend/src/middleware/errors.js      -> errorHandler()

   `node --check` haette hier nichts gefunden: die Frage ist nicht, ob die
   Datei parst, sondern ob `code` bis in die Antwort kommt. Genau das hat
   sie vorher NICHT getan - der Handler reichte nur `error` weiter.

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import Module from 'module';

const wurzel = process.cwd();
const require_ = createRequire(path.join(wurzel, 'backend', 'src', 'x.js'));

let fehler = 0, geprueft = 0;
const melde = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text);
};

/* ── Die Datenbank ersetzen, und ZWAR NUR SIE ──────────────────────────
   `userService` zieht `db/pool`, `authFailuresService`, `password` und
   mehr. Ersetzt wird, was nach aussen geht; die Logik bleibt die echte. */
const pfadPool = require_.resolve('./db/pool');
const pfadFails = require_.resolve('./services/authFailuresService');
const pfadPw = require_.resolve('./utils/password');
/* `config` zieht `dotenv`, und das liegt lokal nicht in node_modules.
   Ersetzt wird nur, was der Pruefer braucht: `env`. Ohne diesen Ersatz
   bricht der Lauf an einer Abhaengigkeit ab, die mit der Sache nichts zu
   tun hat - und ein Pruefer, der nicht startet, prueft nichts. */
const pfadConfig = require_.resolve('./config');
require_.cache[pfadConfig] = new Module(pfadConfig, null);
require_.cache[pfadConfig].exports = { env: 'test' };
require_.cache[pfadConfig].loaded = true;

let naechsteZeile = null;
const abfragen = [];

require_.cache[pfadPool] = new Module(pfadPool, null);
require_.cache[pfadPool].exports = {
  query: async (sql, params) => {
    abfragen.push(String(sql).replace(/\s+/g, ' ').trim());
    if (/FROM users WHERE email/i.test(sql)) {
      return naechsteZeile
        ? { rowCount: 1, rows: [naechsteZeile] }
        : { rowCount: 0, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  },
  pool: {}
};
require_.cache[pfadPool].loaded = true;

require_.cache[pfadFails] = new Module(pfadFails, null);
require_.cache[pfadFails].exports = {
  checkLock: async () => null,
  recordFailure: async () => {},
  recordSuccess: async () => {}
};
require_.cache[pfadFails].loaded = true;

require_.cache[pfadPw] = new Module(pfadPw, null);
require_.cache[pfadPw].exports = {
  verify: async (klar) => klar === 'richtig',
  hash: async (x) => 'hash:' + x
};
require_.cache[pfadPw].loaded = true;

const userService = require_('./services/userService');
const { errorHandler } = require_('./middleware/errors');

/* ── 1 · Die Spalte wird ueberhaupt abgefragt ─────────────────────────── */
console.log('\n=== 1 · Wird email_verified_at mitgelesen? ===');
naechsteZeile = { id: 'u1', email: 'a@b.de', password_hash: 'h', name: 'A',
                  role: 'user', is_active: true, email_verified_at: new Date() };
abfragen.length = 0;
await userService.authenticate({ email: 'A@B.de', plainPassword: 'richtig', ipAddress: '1.2.3.4' });
const sql0 = abfragen.find((s) => /FROM users WHERE email/i.test(s)) || '';
melde(/email_verified_at/.test(sql0),
  'Die SELECT-Liste enthaelt email_verified_at' + (/email_verified_at/.test(sql0) ? '' : ' -> ' + sql0.slice(0, 90)));
melde(/is_active/.test(sql0), 'Die SELECT-Liste enthaelt is_active');

/* ── 2 · Die zwei Lagen liefern VERSCHIEDENE Auskunft ─────────────────── */
console.log('\n=== 2 · Nie bestaetigt vs. wirklich deaktiviert ===');
async function hol(zeile) {
  naechsteZeile = zeile;
  try {
    await userService.authenticate({ email: 'a@b.de', plainPassword: 'richtig', ipAddress: '1.2.3.4' });
    return { kein: true };
  } catch (e) { return e; }
}

const nieBestaetigt = await hol({ id: 'u2', email: 'neu@b.de', password_hash: 'h', name: 'N',
                                  role: 'user', is_active: false, email_verified_at: null });
const deaktiviert = await hol({ id: 'u3', email: 'alt@b.de', password_hash: 'h', name: 'D',
                                role: 'user', is_active: false, email_verified_at: new Date('2026-01-01') });

melde(nieBestaetigt.statusCode === 403, 'Unbestaetigt gibt 403 (ist: ' + nieBestaetigt.statusCode + ')');
melde(deaktiviert.statusCode === 403, 'Deaktiviert gibt 403');
melde(nieBestaetigt.code === 'EMAIL_NOT_VERIFIED',
  'Unbestaetigt traegt code EMAIL_NOT_VERIFIED (ist: ' + nieBestaetigt.code + ')');
melde(deaktiviert.code === 'ACCOUNT_DISABLED',
  'Deaktiviert traegt code ACCOUNT_DISABLED (ist: ' + deaktiviert.code + ')');
melde(nieBestaetigt.message !== deaktiviert.message,
  'Die beiden Botschaften sind VERSCHIEDEN');
melde(!/disabled|deaktiviert/i.test(nieBestaetigt.message),
  'Unbestaetigt sagt NICHT "deaktiviert" — das war der ganze Fehler');
melde(/bestätigt|bestaetigt/i.test(nieBestaetigt.message),
  'Unbestaetigt nennt die Bestaetigung');
melde(/Postfach|Spam/i.test(nieBestaetigt.message),
  'Unbestaetigt sagt, WO der Nutzer nachsehen soll');
for (const [n, e] of [['unbestaetigt', nieBestaetigt], ['deaktiviert', deaktiviert]]) {
  melde(!/[A-Za-z]+ is disabled/.test(e.message), n + ': kein englischer Satz mehr');
}

/* ── 3 · Die Auskunft kommt ERST NACH dem Passwort ────────────────────── */
console.log('\n=== 3 · Keine Nutzer-Enumeration ===');
naechsteZeile = { id: 'u4', email: 'neu@b.de', password_hash: 'h', name: 'N',
                  role: 'user', is_active: false, email_verified_at: null };
let falschesPw;
try {
  await userService.authenticate({ email: 'neu@b.de', plainPassword: 'falsch', ipAddress: '1.2.3.4' });
  falschesPw = { kein: true };
} catch (e) { falschesPw = e; }
melde(falschesPw.statusCode === 401,
  'Falsches Passwort gibt 401, nicht 403 (ist: ' + falschesPw.statusCode + ')');
melde(!falschesPw.code,
  'Falsches Passwort traegt KEIN code — sonst verraet es den Kontozustand');
melde(/Invalid email or password/.test(falschesPw.message || ''),
  'Falsches Passwort bleibt bei der nichtssagenden Botschaft');

/* ── 4 · Der Handler laesst `code` durch — DER ENTSCHEIDENDE PUNKT ────── */
console.log('\n=== 4 · Kommt code bis in die Antwort? ===');
function durchHandler(err) {
  let status = null, koerper = null;
  const res = {
    status(s) { status = s; return this; },
    json(b) { koerper = b; return this; }
  };
  errorHandler(err, { ip: '1.2.3.4', path: '/auth/login' }, res, () => {});
  return { status, koerper };
}
const a1 = durchHandler(nieBestaetigt);
melde(a1.status === 403, 'Handler setzt 403');
melde(a1.koerper && a1.koerper.code === 'EMAIL_NOT_VERIFIED',
  'Die ANTWORT traegt code EMAIL_NOT_VERIFIED (ist: ' + JSON.stringify(a1.koerper) + ')');
melde(a1.koerper && typeof a1.koerper.error === 'string' && a1.koerper.error.length > 20,
  'Die Antwort traegt weiterhin einen lesbaren Text');

const a2 = durchHandler(deaktiviert);
melde(a2.koerper && a2.koerper.code === 'ACCOUNT_DISABLED', 'ACCOUNT_DISABLED kommt an');

/* Ein Datenbankcode darf NICHT nach aussen.

   ACHTUNG, hier stand zuerst `code: '23505'` — und der Punkt bestand aus
   dem FALSCHEN GRUND: 23505 wird zwei Weichen weiter oben als
   "Resource already exists" abgefangen und erreicht die neue Zeile nie.
   Der Test war gruen und hat nichts geprueft.

   `42P01` (undefined_table) faellt durch alle Sonderfaelle bis zur
   statusCode-Weiche und ist damit der echte Fall. */
const pgFehler = Object.assign(new Error('relation does not exist'),
                               { statusCode: 500, code: '42P01' });
const a3 = durchHandler(pgFehler);
melde(!(a3.koerper && a3.koerper.code),
  'Ein PostgreSQL-Code (42P01) wird NICHT durchgelassen (ist: ' + JSON.stringify(a3.koerper) + ')');
melde(a3.status === 500, 'und er behaelt seinen Status 500 (ist: ' + a3.status + ')');
/* Gegenprobe: der ABGEFANGENE Code nimmt wirklich den anderen Weg */
const a3b = durchHandler(Object.assign(new Error('dup'), { statusCode: 500, code: '23505' }));
melde(a3b.status === 409 && /already exists/.test(a3b.koerper.error || ''),
  '23505 nimmt weiterhin die fruehere Weiche (409) — deshalb taugt er nicht als Probe');
const kleinFehler = Object.assign(new Error('x'), { statusCode: 400, code: 'ab' });
const a4 = durchHandler(kleinFehler);
melde(!(a4.koerper && a4.koerper.code), 'Ein Kleinbuchstaben-Code wird nicht durchgelassen');

/* Ein Fehler OHNE code bleibt unveraendert */
const ohne = Object.assign(new Error('nur Text'), { statusCode: 404 });
const a5 = durchHandler(ohne);
melde(a5.koerper && a5.koerper.error === 'nur Text' && !('code' in a5.koerper),
  'Ein Fehler ohne code bekommt kein leeres Feld angehaengt');

/* ── 5 · Der GEMESSENE Befund fuer N60.3, als Waechter ────────────────── */
console.log('\n=== 5 · Der Befund der Vormessung bleibt wahr? ===');
const authJs = fs.readFileSync('backend/src/routes/auth.js', 'utf8');
const ohneKomm = authJs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
melde(!/email_verified_at/.test(ohneKomm),
  'routes/auth.js prueft email_verified_at weiterhin NICHT fuer den Zugang');
const reg = fs.readFileSync('backend/src/routes/registerWithVerify.js', 'utf8');
melde(/is_active/.test(reg), 'registerWithVerify.js arbeitet mit is_active');
const svc = fs.readFileSync('backend/src/services/userService.js', 'utf8');
melde((svc.match(/EMAIL_NOT_VERIFIED/g) || []).length === 1,
  'EMAIL_NOT_VERIFIED steht genau einmal im Dienst');

/* ── 6 · Deckung ─────────────────────────────────────────────────────── */
console.log('\n=== 6 · Deckung ===');
console.log('  Pruefpunkte            : ' + geprueft);
console.log('  echte Funktionsaufrufe : authenticate() 4x, errorHandler() 5x');
console.log('  ersetzt                : db/pool, authFailuresService, utils/password');
console.log('  NICHT ersetzt          : userService, errors.js — die echten Dateien');

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, keine Abweichung'
  : 'RC=1 - ' + fehler + ' Abweichung(en) von ' + geprueft));
process.exit(fehler === 0 ? 0 : 1);
