'use strict';
/* pruef-bank.js — v1853 · N8
 *
 * Prueft das Werkzeug `bank_uebersicht` am ECHTEN Register gegen die ECHTE
 * Datenbank. Kein Nachbau.
 *
 *   docker exec dealpilot-backend node /app/tools/agent-pruefung/pruef-bank.js
 *
 * ── WAS ER BEWEIST ───────────────────────────────────────────────────────
 *  1 · Das Werkzeug steht im Register, Stufe `lesen`.
 *  2 · Eine Zeile je Darlehen: die Zahl der Zeilen entspricht der Zahl der
 *      Objekte mit d1 (+ d2) in der Datenbank — gegengerechnet per SQL.
 *  3 · Eingaben kommen aus dem Objekt (Vertragsnummer, Bank, Zins), die
 *      gerechneten Groessen (Restschuld, Rate) aus dem Spiegel — und wo kein
 *      Spiegel ist, stehen sie NICHT (null), nicht erfunden.
 *  4 · Zins „3,5" kommt als 3.5 an, nicht als 35 (die Falle aus v1851c).
 *  5 · Filter auf eine Adresse liefert nur dieses Objekt; Unbekanntes
 *      liefert den fertigen Satz.
 *  6 · so_schreiben hat so viele Zeilen wie `zeilen`, jede mit Betrag.
 */
const path = require('path');
const fs = require('fs');
const _orte = [
  path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'agentWerkzeuge.js'),
  path.join(__dirname, '..', '..', 'src', 'services', 'agentWerkzeuge.js')
];
const _quelle = _orte.find((p) => fs.existsSync(p));
if (!_quelle) { console.log('ABBRUCH: agentWerkzeuge.js nicht gefunden.'); process.exit(2); }
const W = require(_quelle);
const { query } = require(path.join(path.dirname(_quelle), '..', 'db', 'pool.js'));

let ok = 0, schlecht = 0; const zeilen = [];
function pruefe(name, b, hinweis) { if (b) { ok++; zeilen.push('  [ok]   ' + name); } else { schlecht++; zeilen.push('  [NEIN] ' + name + (hinweis ? ' — ' + hinweis : '')); } }
function ctxFuer(uid) { return { userId: uid, letzteListe: null, letztesObjekt: null, protokoll: [], merkeObjekt() {}, merkeListe() {} }; }

(async () => {
  console.log('== pruef-bank (v1853) ==');
  const register = W.WERKZEUGE || W.werkzeuge || W.REGISTER || W.register || null;
  const liste = Array.isArray(register) ? register : (register ? Object.values(register) : []);
  const e = liste.find((w) => w && w.name === 'bank_uebersicht');
  pruefe('bank_uebersicht steht im Register', !!e, 'Exporte: ' + Object.keys(W).join(', '));
  if (!e) { console.log(zeilen.join('\n')); process.exit(1); }
  pruefe('Stufe ist "lesen"', e.stufe === 'lesen', e.stufe);

  const uid = '2a1ac331-7d7f-44a5-813b-c0080ffb81c3';
  const sql = await query(`SELECT count(*) FILTER (WHERE coalesce(data->>'d1','') <> '' AND coalesce(data->>'d1','0') <> '0')::int AS d1,
                                  count(*) FILTER (WHERE coalesce(data->>'d2','') <> '' AND coalesce(data->>'d2','0') <> '0')::int AS d2
                             FROM objects WHERE user_id=$1`, [uid]);
  const soll = sql.rows[0].d1 + sql.rows[0].d2;
  const r = await e.fn(ctxFuer(uid), {});
  console.log('   SQL: ' + sql.rows[0].d1 + ' × d1, ' + sql.rows[0].d2 + ' × d2 → ' + soll + ' Darlehen · Werkzeug: ' + r.anzahl + ' Zeilen');
  pruefe('eine Zeile je Darlehen (SQL ' + soll + ' = Werkzeug ' + r.anzahl + ')', r.anzahl === soll);
  pruefe('so_schreiben hat so viele Zeilen wie zeilen', Array.isArray(r.so_schreiben) && r.so_schreiben.length === r.zeilen.length);
  pruefe('jede so_schreiben-Zeile nennt einen EUR-Betrag', r.so_schreiben.every((t) => /EUR/.test(t)));
  const mitVertrag = r.zeilen.filter((z) => z.vertragsnummer).length;
  pruefe('Vertragsnummern kommen aus dem Objekt (' + mitVertrag + ' von ' + r.zeilen.length + ')', mitVertrag > 0);
  const zins = r.zeilen.map((z) => z.zins_pct).filter((v) => v != null);
  pruefe('Zins liegt zwischen 0 und 15 % (kein 35 aus "3,5")', zins.length > 0 && zins.every((v) => v > 0 && v < 15), JSON.stringify(zins.slice(0, 5)));
  const mitSp = r.zeilen.filter((z) => z.spiegel_vorhanden), ohneSp = r.zeilen.filter((z) => !z.spiegel_vorhanden);
  pruefe('mit Spiegel: Restschuld vorhanden (' + mitSp.filter((z) => z.restschuld_eur != null).length + ' von ' + mitSp.length + ')',
    mitSp.length === 0 || mitSp.some((z) => z.restschuld_eur != null));
  pruefe('ohne Spiegel: Restschuld und Rate sind null, nicht erfunden',
    ohneSp.every((z) => z.restschuld_eur == null && z.rate_monat_eur == null));
  pruefe('Hinweis nennt die Herkunft (Objekt vs. Portfolio-Stand)', /Portfolio-Stand/.test(r.hinweis || ''));

  const eins = await e.fn(ctxFuer(uid), { adresse: 'Hermann' });
  pruefe('Filter "Hermann": nur Hermannstrasse (' + eins.anzahl + ' Zeile(n))', eins.anzahl >= 1 && eins.zeilen.every((z) => /Hermann/.test(z.adresse)));
  const keins = await e.fn(ctxFuer(uid), { adresse: 'Nirgendwostrasse 99' });
  pruefe('Unbekannte Adresse: anzahl 0 und fertiger Satz', keins.anzahl === 0 && /kein Objekt/.test(keins.so_sagen || ''));

  console.log(zeilen.join('\n'));
  console.log('');
  console.log('   Beispiel: ' + (r.so_schreiben[0] || '—').slice(0, 220));
  console.log('   Deckung: ' + (ok + schlecht) + ' Pruefungen, ' + ok + ' gruen, ' + schlecht + ' rot.');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.log(zeilen.join('\n')); console.log('ABBRUCH: ' + (e.stack || e)); process.exit(2); });
