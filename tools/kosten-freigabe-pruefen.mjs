#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * kosten-freigabe-pruefen.mjs — v3296 · Flow Investor, Punkt 6
 *
 * Freigabe fuer kostenpflichtige Stufen (services/kostenFreigabe.js) mit den
 * ECHTEN Dateien und einer Datenbank im Speicher - KEIN echter Abruf, keine Kosten.
 *
 *   K1  entscheiden(): auto bis zur Monatsgrenze, darueber frage; frage immer;
 *       nie gesperrt; schon bezahlt kostet nichts; leeres Kontingent ohne Token.
 *   K2  PREIS_EUR = frontend/js/config.js EINZELKAUF (Spiegel, gegen die Datei gelesen).
 *   K3  tokenPflicht(): Schluessel mit Bereich flow immer, Sitzung nur mit Token.
 *   K4  Ablauf anfrage -> freigeben -> einloesen am Speicher: wartet ohne Freigabe
 *       nicht einloesbar, falsche Stufe / anderes Objekt abgewiesen, zweimal einloesen
 *       abgewiesen, zurueck() gibt frei, auto summiert im Monat, Profil nie sperrt.
 *   K5  Telegram-Weg in agentWerkzeuge (_kostenToken ueber den echten Lauf von
 *       marktbericht_abrufen ist DB-gebunden): hier nur die Quelle - die beiden
 *       Abruf-Werkzeuge rufen _kostenToken und uebergeben kosten_token.
 *
 * Aufruf: node tools/kosten-freigabe-pruefen.mjs     RC 0 = alles gruen
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Module, { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);

/* ── Datenbank im Speicher: genau die Abfragen von kostenFreigabe.js ── */
const T = { zeilen: [], id: 0, profil: null };
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const DB = {
  query: async (sql, p) => {
    const s = String(sql).replace(/\s+/g, ' ');
    if (/SELECT 1 FROM objects/.test(s)) return { rowCount: p[0] === 'fremd' ? 0 : 1, rows: [{}] };
    if (/FROM user_settings/.test(s)) return T.profil ? { rowCount: 1, rows: [{ schluessel: 'browser_vorgaben', wert: T.profil, updated_at: new Date() }] } : { rowCount: 0, rows: [] };
    if (/SUM\(preis_eur\)/.test(s)) return { rows: [{ s: T.zeilen.filter((z) => z.user_id === p[0] && z.freigabe === 'auto' && (z.status === 'frei' || z.status === 'verbraucht')).reduce((a, z) => a + z.preis_eur, 0) }] };
    if (/^INSERT INTO kosten_freigaben/.test(s.trim())) {
      T.zeilen.push({ id: ++T.id, user_id: p[0], token_hash: p[1], art: p[2], stufe: p[3], objekt_ref: p[4], preis_eur: p[5], kostet: p[6], freigabe: p[7], status: p[8], kanal: p[9], gilt: true });
      return { rowCount: 1, rows: [] };
    }
    if (/SET status='frei', freigabe=COALESCE/.test(s)) {
      const z = T.zeilen.find((x) => x.user_id === p[0] && x.token_hash === p[1] && (x.status === 'wartet' || x.status === 'frei') && x.gilt);
      if (!z) return { rowCount: 0, rows: [] };
      z.status = 'frei'; z.freigabe = z.freigabe || p[2];
      return { rowCount: 1, rows: [{ art: z.art, stufe: z.stufe, objekt_ref: z.objekt_ref, preis_eur: z.preis_eur }] };
    }
    if (/SET status='abgelehnt'/.test(s)) { const z = T.zeilen.find((x) => x.token_hash === p[1] && (x.status === 'wartet' || x.status === 'frei')); if (z) z.status = 'abgelehnt'; return { rowCount: z ? 1 : 0, rows: z ? [{ id: z.id }] : [] }; }
    if (/SET status='verbraucht'/.test(s)) {
      const z = T.zeilen.find((x) => x.user_id === p[0] && x.token_hash === p[1] && x.status === 'frei' && x.gilt && x.stufe === p[2] && (x.objekt_ref || '') === (p[3] || ''));
      if (!z) return { rowCount: 0, rows: [] };
      z.status = 'verbraucht'; return { rowCount: 1, rows: [{ id: z.id }] };
    }
    if (/SELECT status, stufe, objekt_ref/.test(s)) { const z = T.zeilen.find((x) => x.user_id === p[0] && x.token_hash === p[1]); return z ? { rowCount: 1, rows: [{ status: z.status, stufe: z.stufe, objekt_ref: z.objekt_ref, gilt: z.gilt }] } : { rowCount: 0, rows: [] }; }
    if (/SET status='frei', verbraucht_at=NULL/.test(s)) { const z = T.zeilen.find((x) => x.id === p[0] && x.status === 'verbraucht'); if (z) z.status = 'frei'; return { rowCount: z ? 1 : 0 }; }
    throw new Error('Pruefer: unbekannte Abfrage ' + s.slice(0, 80));
  }
};
const origLoad = Module._load;
Module._load = function (req) {
  if (/[\\/]db[\\/]pool(\.js)?$/.test(req) || req === '../db/pool') return DB;
  if (!req.startsWith('.') && !req.startsWith('node:') && !Module.isBuiltin(req) && !path.isAbsolute(req)) {
    try { return origLoad.apply(this, arguments); } catch (e) {
      const leer = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : leer), apply: () => leer, construct: () => leer });
      return leer;
    }
  }
  return origLoad.apply(this, arguments);
};
const _w = console.warn; console.warn = () => {};
const K = require_(path.join(ROOT, 'backend/src/services/kostenFreigabe.js'));
console.warn = _w;

let fehler = 0, n = 0;
const pruef = (name, ok, ist) => { n++; if (!ok) { fehler++; console.log('  \x1b[31mROT\x1b[0m ' + name + (ist !== undefined ? '  ' + JSON.stringify(ist).slice(0, 300) : '')); } };

/* K1 */
const e = (o) => K.entscheiden(Object.assign({ regel: 'frage', kostet: true, preis: 0.9, monatSummeAuto: 0, grenze: 0, rest: 3 }, o)).status;
pruef('K1 frage -> wartet', e({}) === 'wartet');
pruef('K1 nie -> gesperrt', e({ regel: 'nie' }) === 'gesperrt');
pruef('K1 auto unter Grenze -> frei', e({ regel: 'auto', grenze: 5, monatSummeAuto: 3 }) === 'frei');
pruef('K1 auto genau an der Grenze -> frei', e({ regel: 'auto', grenze: 3.9, monatSummeAuto: 3, preis: 0.9 }) === 'frei');
pruef('K1 auto ueber Grenze -> wartet', e({ regel: 'auto', grenze: 3.5, monatSummeAuto: 3, preis: 0.9 }) === 'wartet');
pruef('K1 auto ohne Grenze -> wartet', e({ regel: 'auto', grenze: 0 }) === 'wartet');
pruef('K1 schon bezahlt -> frei, auch bei nie', e({ kostet: false, regel: 'nie' }) === 'frei');
pruef('K1 Kontingent leer -> kontingent_leer', e({ rest: 0 }) === 'kontingent_leer');

/* K2 */
const cfg = fs.readFileSync(path.join(ROOT, 'frontend/js/config.js'), 'utf8');
const ein = {};
for (const m of cfg.matchAll(/\{\s*key:\s*'(mpi|mpi_plus|wev)'[^}]*price_eur:\s*([0-9.]+)/g)) ein[m[1]] = Number(m[2]);
pruef('K2 Preise = config.js EINZELKAUF', ['mpi', 'mpi_plus', 'wev'].every((k) => ein[k] === K.PREIS_EUR[k]), { config: ein, server: K.PREIS_EUR });

/* K3 */
pruef('K3 flow-Schluessel ohne Token: Pflicht', K.tokenPflicht({ apiKey: { scopes: 'flow' } }, null) === true);
pruef('K3 crud flow: Pflicht', K.tokenPflicht({ apiKey: { scopes: 'crud flow' } }, null) === true);
pruef('K3 crud-Schluessel ohne Token: wie bisher', K.tokenPflicht({ apiKey: { scopes: 'crud' } }, null) === false);
pruef('K3 Sitzung ohne Token: wie bisher', K.tokenPflicht({}, null) === false);
pruef('K3 Sitzung mit Token (Bot): wird geprueft', K.tokenPflicht({}, 'dpkt_x') === true);

/* K4 */
const v = (rest, kostet) => async (uid, ref, stufe) => ({ moeglich: true, stufe, verbraucht_einen_abruf: kostet !== false, bestand: rest });
const U = 'u1';
let a = await K.anfrage(U, { art: 'mpi', objekt_id: 'o1' }, { voranschlag: v(3) });
pruef('K4 frage: wartet mit Token, Preis 0,90', a.ok && a.freigabe_noetig && a.token && a.preis === 0.9 && a.kontingent_rest === 3, a);
let r = await K.einloesen(U, a.token, { stufe: 1, objekt_ref: 'o1' });
pruef('K4 ohne Freigabe nicht einloesbar', !r.ok && r.code === 'KOSTEN_FREIGABE_FEHLT', r);
pruef('K4 freigeben', (await K.freigeben(U, a.token, 'nutzer')).ok);
r = await K.einloesen(U, a.token, { stufe: 2, objekt_ref: 'o1' });
pruef('K4 falsche Stufe abgewiesen', !r.ok && r.code === 'KOSTEN_TOKEN_PASST_NICHT', r);
r = await K.einloesen(U, a.token, { stufe: 1, objekt_ref: 'o2' });
pruef('K4 anderes Objekt abgewiesen', !r.ok && r.code === 'KOSTEN_TOKEN_PASST_NICHT', r);
r = await K.einloesen(U, a.token, { stufe: 1, objekt_ref: 'o1' });
pruef('K4 passend eingeloest', r.ok, r);
const r2 = await K.einloesen(U, a.token, { stufe: 1, objekt_ref: 'o1' });
pruef('K4 zweimal abgewiesen', !r2.ok && r2.code === 'KOSTEN_TOKEN_VERBRAUCHT', r2);
await K.zurueck(r.id);
pruef('K4 zurueck() gibt wieder frei', (await K.einloesen(U, a.token, { stufe: 1, objekt_ref: 'o1' })).ok);
pruef('K4 ohne Token: KOSTEN_TOKEN_FEHLT mit Weg', (await K.einloesen(U, null, { stufe: 1 })).code === 'KOSTEN_TOKEN_FEHLT');
pruef('K4 fremdes Objekt 404', (await K.anfrage(U, { art: 'mpi', objekt_id: 'fremd' }, { voranschlag: v(3) })).status === 404);
T.profil = { keys: { dp_investment_profile: JSON.stringify({ flow: { freigaben: { mpi: 'auto', mpi_plus: 'nie', monatsgrenze_eur: 2 } } }) } };
a = await K.anfrage(U, { art: 'mpi', objekt_id: 'o3' }, { voranschlag: v(3) });
pruef('K4 auto 1: frei ohne Rueckfrage', a.ok && !a.freigabe_noetig && a.status === 'frei' && a.token, a);
const b2 = await K.anfrage(U, { art: 'mpi', objekt_id: 'o4' }, { voranschlag: v(3) });
pruef('K4 auto 2 (Summe 1,80 <= 2): frei', b2.status === 'frei', b2);
const b3 = await K.anfrage(U, { art: 'mpi', objekt_id: 'o5' }, { voranschlag: v(3) });
pruef('K4 auto 3 (2,70 > 2): Rueckfrage', b3.status === 'wartet' && b3.freigabe_noetig, b3);
const b4 = await K.anfrage(U, { art: 'mpi_plus', objekt_id: 'o5' }, { voranschlag: v(3) });
pruef('K4 nie: gesperrt, kein Token', b4.status === 'gesperrt' && !b4.token, b4);
const b5 = await K.anfrage(U, { art: 'mpi', objekt_id: 'o6' }, { voranschlag: v(0) });
pruef('K4 Kontingent leer: kein Token', b5.status === 'kontingent_leer' && !b5.token, b5);
const b6 = await K.anfrage(U, { art: 'mpi', objekt_id: 'o7' }, { voranschlag: v(3, false) });
pruef('K4 schon bezahlt: Preis 0, frei', b6.status === 'frei' && b6.preis === 0, b6);

/* K5 */
const wz = fs.readFileSync(path.join(ROOT, 'backend/src/services/agentWerkzeuge.js'), 'utf8');
pruef('K5 marktbericht_abrufen loest den Token ein', /_kostenToken\(ctx, stufe, id\)[\s\S]{0,200}markt\.abrufen\(ctx\.userId, o, stufe, \{ kosten_token: _kt\.token \}\)/.test(wz));
pruef('K5 marktpreis_ohne_objekt_abrufen ebenso', /_kostenToken\(ctx, 1, null\)[\s\S]{0,200}markt\.abrufenFrei\(ctx\.userId, frei, \{ kosten_token: _kt\.token \}\)/.test(wz));
const mb = fs.readFileSync(path.join(ROOT, 'backend/src/routes/marktbericht.js'), 'utf8');
pruef('K5 runReport prueft den Token vor dem Abruf', mb.indexOf('_kosten.einloesen') > 0 && mb.indexOf('_kosten.einloesen') < mb.indexOf("forward('POST', '/reports/generate'"));

console.log('kosten-freigabe-pruefen: ' + (n - fehler) + ' von ' + n + ' gruen');
console.log(fehler ? '\x1b[31mRC=1\x1b[0m' : '\x1b[32mRC=0\x1b[0m');
process.exit(fehler ? 1 : 0);
