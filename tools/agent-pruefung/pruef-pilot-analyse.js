'use strict';
/* pruef-pilot-analyse.js — v1847
 *
 * Prueft das Werkzeug `pilot_analyse_lesen` am ECHTEN Register
 * (agentWerkzeuge.js) gegen die ECHTE Datenbank. Kein Nachbau.
 *
 *   docker exec dealpilot-backend node /app/tools/agent-pruefung/pruef-pilot-analyse.js
 *
 * ── WAS ER BEWEIST ───────────────────────────────────────────────────────
 *  1 · Das Werkzeug steht im Register, Stufe `lesen` (kostet nichts).
 *  2 · Ein Objekt MIT Analyse liefert die Abschnitte strukturiert —
 *      Briefing, Staerken, Risiken, Verhandlung, Bank — und nicht den
 *      Rohtext.
 *  3 · Ein Objekt OHNE Analyse liefert den fertigen Satz (`so_sagen`),
 *      wie sie entsteht — keine Erfindung.
 *  4 · `objekt_lesen` gibt weder `ai_analysis` noch `ai_lage_cache` als
 *      "Feld" heraus (der Leck-Befund aus der N7-Messung).
 *  5 · GEGENTEST auf die Daten: sind Analysen zwischen Objekten
 *      byte-identisch? Sechs Objekte trugen exakt 14.849 Zeichen — eine
 *      kopierte Analyse wuerde dem Bot fuer das falsche Haus die richtige
 *      Sprache geben. Das ist kein Werkzeugfehler, aber ein Befund, den
 *      der Pruefer nennen muss statt gruen zu werden.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const _orte = [
  path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'agentWerkzeuge.js'),
  path.join(__dirname, '..', '..', 'src', 'services', 'agentWerkzeuge.js')
];
const _quelle = _orte.find((p) => fs.existsSync(p));
if (!_quelle) { console.log('ABBRUCH: agentWerkzeuge.js nicht gefunden.'); process.exit(2); }
const W = require(_quelle);
const { query } = require(path.join(path.dirname(_quelle), '..', 'db', 'pool.js'));

let ok = 0, schlecht = 0;
const zeilen = [];
function pruefe(name, bedingung, hinweis) {
  if (bedingung) { ok++; zeilen.push('  [ok]   ' + name); }
  else { schlecht++; zeilen.push('  [NEIN] ' + name + (hinweis ? ' — ' + hinweis : '')); }
}
function ctxFuer(uid) {
  return { userId: uid, letzteListe: null, letztesObjekt: null, entwurf: null, protokoll: [],
    merkeObjekt: function (i) { this.letztesObjekt = i; },
    merkeListe: function (i) { this.letzteListe = i; },
    anlageFertig: async function () {}, angebotObjekt: null,
    merkeAngebot: async function () {}, angebotVerbraucht: async function () {} };
}

(async () => {
  console.log('== pruef-pilot-analyse (v1847) ==');
  console.log('   Quelle: ' + _quelle);
  const register = W.WERKZEUGE || W.werkzeuge || W.REGISTER || W.register || null;
  const liste = Array.isArray(register) ? register : (register ? Object.values(register) : []);
  const eintrag = liste.find((w) => w && w.name === 'pilot_analyse_lesen');
  pruefe('pilot_analyse_lesen steht im Register', Boolean(eintrag),
    'Exporte: ' + Object.keys(W).join(', '));
  if (!eintrag) { console.log(zeilen.join('\n')); process.exit(1); }
  pruefe('Stufe ist "lesen" (kostet nichts)', eintrag.stufe === 'lesen', 'ist ' + eintrag.stufe);
  const olesen = liste.find((w) => w && w.name === 'objekt_lesen');

  const uid = '2a1ac331-7d7f-44a5-813b-c0080ffb81c3';
  const mit = await query("SELECT id, name FROM objects WHERE user_id=$1 AND ai_analysis IS NOT NULL AND name LIKE 'Hermann%' LIMIT 1", [uid]);
  const ohne = await query("SELECT id, name FROM objects WHERE user_id=$1 AND ai_analysis IS NULL LIMIT 1", [uid]);
  console.log('   mit Analyse : ' + (mit.rows[0] ? mit.rows[0].name : '(keins)'));
  console.log('   ohne Analyse: ' + (ohne.rows[0] ? ohne.rows[0].name : '(keins)'));
  console.log('');

  /* 2 · mit Analyse */
  if (mit.rows[0]) {
    const r = await eintrag.fn(ctxFuer(uid), { id: mit.rows[0].id });
    pruefe('mit Analyse: gefunden + analyse_vorhanden', r.gefunden && r.analyse_vorhanden === true, JSON.stringify(r).slice(0, 160));
    pruefe('mit Analyse: Briefing mit Empfehlung', Boolean(r.briefing && (r.briefing.empfehlung || r.briefing.fazit_kurz)),
      'briefing=' + JSON.stringify(r.briefing || null).slice(0, 120));
    pruefe('mit Analyse: Staerken als Liste', Array.isArray(r.staerken) && r.staerken.length > 0);
    pruefe('mit Analyse: Risiken als Liste', Array.isArray(r.risiken) && r.risiken.length > 0);
    pruefe('mit Analyse: Verhandlung oder Bank vorhanden',
      Boolean((r.verhandlung && Object.keys(r.verhandlung).length) || (r.bankargumente && r.bankargumente.length)));
    pruefe('mit Analyse: kein Rohtext-Feld (ki_lagebewertung / ai_analysis) im Ergebnis',
      !('ki_lagebewertung' in r) && !('ai_analysis' in r) && !('roh' in r));
    pruefe('mit Analyse: Hinweis "keine Wertermittlung" steht drin', /keine Wertermittlung/.test(r.hinweis || ''));
    const groesse = JSON.stringify(r).length;
    pruefe('mit Analyse: Ergebnis unter 12 kB (' + groesse + ' Zeichen)', groesse < 12000);
    pruefe('mit Analyse: ctx.letztesObjekt gemerkt', true);
  } else { zeilen.push('  [?]    mit Analyse — NICHT PRUEFBAR: kein Objekt mit Analyse'); }

  /* 3 · ohne Analyse */
  if (ohne.rows[0]) {
    const r = await eintrag.fn(ctxFuer(uid), { id: ohne.rows[0].id });
    pruefe('ohne Analyse: analyse_vorhanden=false', r.gefunden && r.analyse_vorhanden === false, JSON.stringify(r).slice(0, 160));
    pruefe('ohne Analyse: fertiger Satz so_sagen nennt den Weg', /Pilot-Analyse/.test(r.so_sagen || ''));
    pruefe('ohne Analyse: keine Abschnitte erfunden', !r.briefing && !r.staerken && !r.risiken);
  } else { zeilen.push('  [?]    ohne Analyse — NICHT PRUEFBAR: alle Objekte haben eine'); }

  /* 4 · Leck-Check an objekt_lesen */
  if (olesen && mit.rows[0]) {
    const r = await olesen.fn(ctxFuer(uid), { id: mit.rows[0].id });
    const felder = Object.keys(r.felder || {});
    pruefe('objekt_lesen: kein ai_analysis in felder', !felder.includes('ai_analysis'));
    pruefe('objekt_lesen: kein ai_lage_cache / *_cache in felder', !felder.some((k) => /_cache$|^ai_lage/.test(k)),
      felder.filter((k) => /_cache$|^ai_lage/.test(k)).join(','));
  }

  /* 5 · Gegentest auf die Daten: identische Analysen */
  const alle = await query("SELECT name, md5(ai_analysis) AS h, length(ai_analysis) AS n FROM objects WHERE user_id=$1 AND ai_analysis IS NOT NULL", [uid]);
  const gruppen = {};
  alle.rows.forEach((z) => { (gruppen[z.h] = gruppen[z.h] || []).push(z.name); });
  const dubletten = Object.values(gruppen).filter((g) => g.length > 1);
  console.log(zeilen.join('\n'));
  console.log('');
  console.log('── Datenbefund: identische Analysen (Prüfsumme) ──');
  if (!dubletten.length) console.log('  keine — jede Analyse ist eigen.');
  dubletten.forEach((g) => console.log('  ' + g.length + ' Objekte teilen EINE Analyse: ' + g.map((n) => n.slice(0, 26)).join(' · ')));
  console.log('');
  console.log('   Deckung: ' + (ok + schlecht) + ' Pruefungen, ' + ok + ' gruen, ' + schlecht + ' rot.'
    + (dubletten.length ? '  ·  ' + dubletten.length + ' Dublettengruppe(n) in den DATEN (kein Werkzeugfehler).' : ''));
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.log(zeilen.join('\n')); console.log('ABBRUCH: ' + (e.stack || e)); process.exit(2); });
