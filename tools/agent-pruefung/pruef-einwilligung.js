'use strict';
/* pruef-einwilligung.js — v1827
 *
 * PRUEFT DEN WEG, DEN EIN KUNDE WIRKLICH GEHT: ueber HTTP gegen die
 * laufende API, mit einem echten Login. Nicht die Funktionen daneben.
 *
 * Laeuft IM Container:
 *   docker exec dealpilot-backend node /app/tools/agent-pruefung/pruef-einwilligung.js
 *
 * ── WAS ER BEWEIST ───────────────────────────────────────────────────────
 *
 *  1 · GET /telegram/status nennt die Fassung (ds_fassung).
 *  2 · PUT /bot OHNE Einwilligung wird abgewiesen — und zwar mit
 *      `einwilligung_fehlt: true`. Dieses Feld kann nur vom neuen Code
 *      kommen: es ist damit gleichzeitig der GEGENTEST darauf, dass der
 *      alte Stand die Pruefung nicht hatte.
 *  3 · PUT /bot mit FALSCHER Fassung gibt 409 — eine Zustimmung zu einem
 *      Text, der nicht mehr gilt, ist keine.
 *  4 · PUT /bot mit Einwilligung und MUELLTOKEN scheitert am TOKEN, nicht
 *      an der Einwilligung. Das ist der Durchlass-Nachweis: die Sperre
 *      laesst durch, wenn sie erfuellt ist.
 *  5 · PUT /bot mit Einwilligung und formgueltigem, aber falschem Token
 *      kommt bis Telegram. Damit ist belegt, dass die Sperre VOR getMe
 *      sitzt und sie dennoch nicht blockiert.
 *  6 · Der INSERT der Route fuellt die beiden neuen Spalten — gefahren mit
 *      dem SQL, das AUS DER ROUTENDATEI GELESEN wird, nicht mit einem
 *      Nachbau. Zweimal gefahren, damit auch der ON-CONFLICT-Zweig
 *      gemessen ist (jedes Verbinden ist eine eigene Einwilligung).
 *
 * ── WAS ER NICHT BEWEISEN KANN ───────────────────────────────────────────
 *
 * Den vollen Erfolgsfall mit einem ECHTEN Bot-Token. Dafuer braeuchte er
 * einen gueltigen Token, und der ist ein Passwort. Schritt 6 ersetzt das,
 * indem er die Datenbankseite derselben Anweisung echt fährt.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASIS = process.env.PRUEF_BASIS || 'http://localhost:3000/api/v1';
const u = new URL(BASIS);

let ok = 0, schlecht = 0;
const zeilen = [];
function pruefe(name, bedingung, hinweis) {
  if (bedingung) { ok++; zeilen.push('  [ok]   ' + name); }
  else { schlecht++; zeilen.push('  [NEIN] ' + name + (hinweis ? ' — ' + hinweis : '')); }
}
function unpruefbar(name, grund) {
  zeilen.push('  [?]    ' + name + ' — NICHT PRUEFBAR: ' + grund);
}

function ruf(methode, pfad, body, jwt) {
  return new Promise((loesen, brechen) => {
    const daten = body == null ? null : JSON.stringify(body);
    const kopf = { 'Content-Type': 'application/json' };
    if (daten) kopf['Content-Length'] = Buffer.byteLength(daten);
    if (jwt) kopf['Authorization'] = 'Bearer ' + jwt;
    const r = http.request({
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname.replace(/\/$/, '') + pfad,
      method: methode, headers: kopf
    }, (a) => {
      let s = '';
      a.on('data', (c) => { s += c; });
      a.on('end', () => {
        let j = null;
        try { j = JSON.parse(s); } catch (e) {}
        loesen({ code: a.statusCode, body: j, roh: s.slice(0, 400) });
      });
    });
    r.on('error', brechen);
    if (daten) r.write(daten);
    r.end();
  });
}

(async function () {
  console.log('== pruef-einwilligung (v1827) ==');
  console.log('   Basis: ' + BASIS);

  /* ── Login. Ein eigener Testnutzer, damit kein echtes Konto angefasst
     wird — auf Staging ist das erlaubt und hier noetig: der Pruefer darf
     Marcels Bot nicht neu einrichten. ───────────────────────────────── */
  const kennung = 'pruef-ein-' + crypto.randomBytes(4).toString('hex') + '@dealpilot.test';
  const geheim = 'Pruef' + crypto.randomBytes(9).toString('base64url') + '!9';
  let jwt = null;
  const reg = await ruf('POST', '/auth/register',
    { email: kennung, password: geheim, name: 'Pruefer Einwilligung' });
  jwt = (reg.body && (reg.body.token || (reg.body.data && reg.body.data.token))) || null;
  if (!jwt) {
    const log = await ruf('POST', '/auth/login', { email: kennung, password: geheim });
    jwt = (log.body && (log.body.token || (log.body.data && log.body.data.token))) || null;
  }
  if (!jwt) {
    console.log('   ABBRUCH: kein Login moeglich. register=' + reg.code + ' ' + reg.roh);
    process.exit(2);
  }
  console.log('   Testnutzer angelegt, Sitzung steht.');
  console.log('');

  /* ── 1 · Die Fassung kommt aus dem Status ─────────────────────────── */
  const st = await ruf('GET', '/telegram/status', null, jwt);
  const fassung = st.body && st.body.ds_fassung;
  pruefe('status nennt ds_fassung', Boolean(fassung), 'bekam: ' + JSON.stringify(fassung));
  pruefe('status: einwilligung ist null, solange kein Bot da ist',
    st.body && st.body.einwilligung === null,
    'bekam: ' + JSON.stringify(st.body && st.body.einwilligung));

  /* Ein formgueltiger Token, den Telegram ablehnt. Frei erfunden, nicht
     von einem echten Bot — er muss nur durch den Formtest kommen. */
  const FORMGUELTIG = '123456789:' + crypto.randomBytes(24).toString('base64url').slice(0, 35);
  const MUELL = 'das-ist-kein-token';

  /* ── 2 · Ohne Einwilligung: Tuer zu ──────────────────────────────── */
  const a = await ruf('PUT', '/telegram/bot', { token: FORMGUELTIG }, jwt);
  pruefe('ohne Einwilligung abgewiesen (400)', a.code === 400, 'Code ' + a.code);
  pruefe('ohne Einwilligung: Feld einwilligung_fehlt (= Gegentest auf den alten Stand)',
    Boolean(a.body && a.body.einwilligung_fehlt),
    'bekam: ' + JSON.stringify(a.body));

  const a2 = await ruf('PUT', '/telegram/bot',
    { token: FORMGUELTIG, einwilligung: 'ja', ds_fassung: fassung }, jwt);
  pruefe('einwilligung:"ja" (Zeichenkette) gilt NICHT als Einwilligung',
    a2.code === 400 && a2.body && a2.body.einwilligung_fehlt, 'Code ' + a2.code);

  /* ── 3 · Falsche Fassung: 409 ────────────────────────────────────── */
  const b = await ruf('PUT', '/telegram/bot',
    { token: FORMGUELTIG, einwilligung: true, ds_fassung: '0.9' }, jwt);
  pruefe('falsche Fassung abgewiesen (409)', b.code === 409, 'Code ' + b.code);
  pruefe('falsche Fassung: Server nennt die erwartete',
    b.body && b.body.fassung_erwartet === fassung,
    'bekam: ' + JSON.stringify(b.body && b.body.fassung_erwartet));

  const b2 = await ruf('PUT', '/telegram/bot',
    { token: FORMGUELTIG, einwilligung: true }, jwt);
  pruefe('Einwilligung OHNE Fassung reicht nicht', b2.code === 409, 'Code ' + b2.code);

  /* ── 4 · Mit Einwilligung, Muelltoken: scheitert am TOKEN ────────── */
  const c = await ruf('PUT', '/telegram/bot',
    { token: MUELL, einwilligung: true, ds_fassung: fassung }, jwt);
  const cTxt = String((c.body && c.body.error) || '');
  pruefe('mit Einwilligung + Muelltoken: Fehler nennt den TOKEN, nicht die Einwilligung',
    c.code === 400 && /Token/i.test(cTxt) && !(c.body && c.body.einwilligung_fehlt),
    'Code ' + c.code + ' · ' + cTxt.slice(0, 120));

  /* ── 5 · Mit Einwilligung, formgueltig: kommt bis Telegram ───────── */
  const d = await ruf('PUT', '/telegram/bot',
    { token: FORMGUELTIG, einwilligung: true, ds_fassung: fassung }, jwt);
  const dTxt = String((d.body && d.body.error) || '');
  if (/oeffentliche Adresse|PUBLIC_API_URL/i.test(dTxt)) {
    unpruefbar('Durchlass bis getMe',
      'diese Installation hat keine oeffentliche Adresse (PUBLIC_API_URL) — '
      + 'die Pruefung endet eine Stufe vorher, aber die Einwilligung war erfuellt');
    pruefe('Durchlass: nicht an der Einwilligung gescheitert',
      !(d.body && d.body.einwilligung_fehlt) && d.code !== 409, 'Code ' + d.code);
  } else {
    pruefe('mit Einwilligung + formgueltigem Token: Telegram entscheidet, nicht wir',
      /Telegram/i.test(dTxt), 'Code ' + d.code + ' · ' + dTxt.slice(0, 140));
  }

  /* ── 6 · Der INSERT der Route, echt gefahren ─────────────────────────
     Das SQL wird AUS DER ROUTENDATEI gelesen. Ein Nachbau wuerde den
     Nachbau pruefen — das ist hier schon schiefgegangen (register-saat). */
  let sql = null;
  try {
    const quelle = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'routes', 'telegram.js'), 'utf8');
    const m = quelle.match(/`(INSERT INTO telegram_bots[\s\S]*?)`/);
    sql = m ? m[1] : null;
  } catch (e) { sql = null; }

  if (!sql) {
    unpruefbar('INSERT fuellt die Einwilligungsspalten',
      'das SQL liess sich nicht aus telegram.js lesen');
  } else {
    pruefe('gelesenes SQL nennt einwilligung_am', /einwilligung_am/.test(sql));
    const { query } = require('../../src/db/pool');
    const nutzer = await query(
      'SELECT id FROM users WHERE email = $1', [kennung]);
    const uid = nutzer.rows[0] && nutzer.rows[0].id;
    if (!uid) {
      unpruefbar('INSERT echt gefahren', 'der Testnutzer war in der DB nicht zu finden');
    } else {
      const p = (n) => ['p' + n, 'n' + n, 'id' + n, 'pf' + n, 'sc' + n];
      await query(sql, [uid, 'pruefbot1', 'Pruef 1', 111, 'pfad-a', 'sec-a', fassung]);
      const r1 = await query(
        'SELECT einwilligung_am, einwilligung_fassung FROM telegram_bots WHERE user_id = $1',
        [uid]);
      const z1 = r1.rows[0] || {};
      pruefe('INSERT: einwilligung_am gesetzt', Boolean(z1.einwilligung_am),
        'bekam: ' + JSON.stringify(z1.einwilligung_am));
      pruefe('INSERT: Fassung gespeichert', z1.einwilligung_fassung === fassung,
        'bekam: ' + JSON.stringify(z1.einwilligung_fassung));

      /* Zweiter Lauf = der ON-CONFLICT-Zweig. Jedes Verbinden ist eine
         eigene Einwilligung, also MUSS der Zeitstempel wandern. */
      await new Promise((f) => setTimeout(f, 1100));
      await query(sql, [uid, 'pruefbot2', 'Pruef 2', 222, 'pfad-b', 'sec-b', fassung]);
      const r2 = await query(
        'SELECT einwilligung_am FROM telegram_bots WHERE user_id = $1', [uid]);
      const alt = new Date(z1.einwilligung_am).getTime();
      const neu = new Date(r2.rows[0].einwilligung_am).getTime();
      /* SUBTRAHIEREN, nicht nebeneinander drucken. */
      pruefe('zweites Verbinden zieht den Zeitstempel nach (Differenz > 0,5 s)',
        (neu - alt) > 500, 'Differenz: ' + (neu - alt) + ' ms');

      /* Und der Status zeigt es dem Nutzer. */
      const st2 = await ruf('GET', '/telegram/status', null, jwt);
      const e2 = st2.body && st2.body.einwilligung;
      pruefe('status gibt die Einwilligung heraus', Boolean(e2 && e2.am),
        'bekam: ' + JSON.stringify(e2));
      pruefe('status: veraltet ist false bei gleicher Fassung',
        e2 && e2.veraltet === false, 'bekam: ' + JSON.stringify(e2 && e2.veraltet));

      /* Aufraeumen: die Testzeile wieder weg. */
      await query('DELETE FROM telegram_bots WHERE user_id = $1', [uid]);
      const rest = await query(
        'SELECT count(*)::int n FROM telegram_bots WHERE user_id = $1', [uid]);
      pruefe('Testzeile wieder entfernt', rest.rows[0].n === 0);
    }
  }

  console.log(zeilen.join('\n'));
  console.log('');
  console.log('   Deckung: ' + (ok + schlecht) + ' Pruefungen gefahren, '
    + ok + ' gruen, ' + schlecht + ' rot.');
  console.log('   Testnutzer ' + kennung + ' bleibt stehen (Staging).');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => {
  console.log(zeilen.join('\n'));
  console.log('   ABBRUCH: ' + (e && e.stack || e));
  process.exit(2);
});
