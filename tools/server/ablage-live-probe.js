/* tools/server/ablage-live-probe.js — v4910 · Live-Probe der Dokumentenablage, NUR Staging, im Backend-Container:
 *   docker cp tools/server/ablage-live-probe.js dealpilot-backend:/tmp/ && docker exec dealpilot-backend node /tmp/ablage-live-probe.js
 * Prüft gegen die echte Datenbank: (1) Löschfrist abgelaufen → Dateien und Frist weg, Datei vom Laufwerk weg,
 * (2) Konto löschen (kontoLoeschen.loeschen) → Ablage-Ordner und Nutzer weg, (3) belegt_pct und Einsortierung.
 * Legt Testkonten @ablage-probe.dealpilot.test an und räumt sie ab; Mails an .test gehen nie über SMTP. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
process.chdir('/app');
const A = require('/app/src/services/dateiAblage.js');
const K = require('/app/src/services/kontoLoeschen.js');
const { query } = require('/app/src/db/pool');
const BASIS = process.env.DATEI_ABLAGE_DIR || '/app/uploads/dateien';
let ok = 0, rot = 0;
const pruef = (n, b, i) => { if (b) { ok++; console.log('  ok   ' + n); } else { rot++; console.log('  ROT  ' + n + (i ? ' · ' + i : '')); } };

async function konto(tag) {
  const email = 'ablage-probe-' + tag + '-' + Date.now() + '@ablage-probe.dealpilot.test';
  const u = (await query("INSERT INTO users (email, password_hash, name) VALUES ($1, 'x', 'Ablage Probe') RETURNING id", [email])).rows[0].id;
  return { u, email };
}
async function dateiDirekt(u, ordner, meta) {
  const schl = crypto.randomBytes(16).toString('hex');
  await A._schreiben(u, schl, Buffer.from('Probeinhalt ' + schl));
  const r = await query("INSERT INTO dateien (user_id, ordner, name, mime, groesse, sha256, ablage_schluessel, quelle, meta) VALUES ($1,$2,'probe.pdf','application/pdf',20,$3,$4,'upload',$5) RETURNING id",
    [u, ordner, crypto.randomBytes(8).toString('hex'), schl, JSON.stringify(meta || {})]);
  return { id: r.rows[0].id, schl };
}

(async () => {
  const k1 = await konto('frist'), k2 = await konto('konto');
  try {
    /* (1) Löschfrist abgelaufen */
    const d1 = await dateiDirekt(k1.u, 'Belege', { jahr: 2025 });
    await query('INSERT INTO dateien_fristen (user_id, erkannt_am, frist_am) VALUES ($1, NOW() - INTERVAL \'100 days\', NOW() - INTERVAL \'1 day\')', [k1.u]);
    const s1 = await A.stand(k1.u);
    pruef('stand: belegt_pct vorhanden (Free: 0)', typeof s1.belegt_pct === 'number' && s1.darf_ablegen === false, JSON.stringify(s1));
    const mails = [];
    const r = await A.fristLauf({ nurNutzer: k1.u, mail: async (u, am) => { mails.push(am); return A.fristMail(u, am); } });
    const rest = await query('SELECT count(*)::int n FROM dateien WHERE user_id = $1 AND deleted_at IS NULL', [k1.u]);
    const fr = await query('SELECT 1 FROM dateien_fristen WHERE user_id = $1', [k1.u]);
    pruef('Frist abgelaufen: Dateien gelöscht, Frist weg', r.geloescht_konten === 1 && rest.rows[0].n === 0 && fr.rowCount === 0, JSON.stringify(r));
    pruef('Frist abgelaufen: Datei vom Laufwerk entfernt', !fs.existsSync(path.join(BASIS, k1.u, d1.schl)));
    /* neue Frist + Mail (an .test, nie SMTP) */
    await dateiDirekt(k1.u, 'Protokolle', {});
    const r2 = await A.fristLauf({ nurNutzer: k1.u, mail: A.fristMail });
    const fr2 = await query('SELECT frist_am, mail_am FROM dateien_fristen WHERE user_id = $1', [k1.u]);
    const tage = fr2.rowCount ? Math.round((new Date(fr2.rows[0].frist_am) - Date.now()) / 864e5) : -1;
    pruef('neue Frist 90 Tage, Mail-Zeitpunkt gesetzt', r2.neu === 1 && tage >= 89 && tage <= 90 && !!fr2.rows[0].mail_am, JSON.stringify(r2));
    /* (3) Einsortierung über ordnerAus */
    pruef('Einsortierung: Rechnung → Belege, Protokoll → Protokolle', A.ordnerAus('Rechnung') === 'Belege' && A.ordnerAus('WEG-Protokoll') === 'Protokolle');
    /* (2) Konto löschen */
    const d2 = await dateiDirekt(k2.u, 'Mietverträge', {});
    const vorher = fs.existsSync(path.join(BASIS, k2.u, d2.schl));
    const ber = await K.loeschen(k2.u, k2.email);
    const nutzer = await query('SELECT 1 FROM users WHERE id = $1', [k2.u]);
    const zeilen = await query('SELECT count(*)::int n FROM dateien WHERE user_id = $1', [k2.u]);
    pruef('Konto löschen: Ablage-Ordner, Zeilen und Nutzer weg', vorher && ber.dateien === true && !fs.existsSync(path.join(BASIS, k2.u)) && nutzer.rowCount === 0 && zeilen.rows[0].n === 0, JSON.stringify(ber));
  } catch (e) { rot++; console.log('  ROT  Ausnahme · ' + (e && e.stack || e)); }
  finally {
    for (const k of [k1, k2]) {
      try { await A.kontoLeeren(k.u); } catch (e) {}
      try { await query('DELETE FROM users WHERE id = $1', [k.u]); } catch (e) {}
    }
  }
  console.log('\n' + ok + ' ok, ' + rot + ' rot');
  process.exit(rot ? 1 : 0);
})();
