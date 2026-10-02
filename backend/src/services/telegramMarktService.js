'use strict';
/* services/telegramMarktService.js — Marktpreisindikation fuer den Bot (v1798)
 *
 * ── WARUM DER BOT HIER DIE EIGENE HTTP-API RUFT ─────────────────────────
 *
 * Die Marktbericht-Route (`routes/marktbericht.js`) ist geldfuehrend: sie
 * ermittelt die faellige Stufe, prueft das Plan-Kontingent VOR der
 * Leistung, rechnet den Aufpreis gegen schon bezahlte Stufen auf und bucht
 * danach ab. Das sind fuenf Schranken, tief mit `req`/`res` verwoben.
 *
 * Sie req/res-frei nachzubauen — wie bei `avmDienst` geschehen — waere
 * hier der falsche Weg:
 *
 *   > Bei einer geldfuehrenden Strecke ist jede zweite Fassung eine zweite
 *   > Stelle, an der abgebucht wird. Eine davon ist irgendwann die
 *   > falsche, und auffallen wird es auf einer Rechnung.
 *
 * Deshalb geht der Bot GENAU DEN WEG, DEN AUCH DER BROWSER GEHT: ein
 * HTTP-Aufruf an die eigene API, mit einem kurzlebigen Token fuer genau
 * diesen Nutzer. Alle fuenf Schranken greifen damit unveraendert, und es
 * gibt weiterhin nur eine Stelle, die bucht.
 *
 * ── DIE STUFEN ──────────────────────────────────────────────────────────
 *
 *   1  mpi       Marktpreisindikation            Lage und Preisspanne
 *   2  mpi_plus  Erweiterte Marktpreisindikation + Zustand und Qualitaet
 *   3  wev       Wertermittlung nach ImmoWertV   (der Bot bietet sie nicht an)
 *
 * ACHTUNG, und das ist teuer: `marktbericht.js` faellt OHNE `wert_stufe`
 * auf STUFE 2 zurueck. Wer sie nicht mitschickt, bucht ungewollt die
 * teurere. Hier wird sie deshalb immer gesetzt.
 */
const jwtUtil = require('../utils/jwt');
const config = require('../config');
const aiCreditsService = require('./aiCreditsService');

const STUFEN = {
  1: { art: 'mpi',      name: 'Marktpreisindikation' },
  2: { art: 'mpi_plus', name: 'Erweiterte Marktpreisindikation' }
};

function basis() {
  return 'http://127.0.0.1:' + config.port + '/api/v1';
}

/* Ein Token nur fuer diesen einen Aufruf. Es traegt dieselbe Nutzlast wie
   das des Browsers — mehr Rechte bekommt der Bot dadurch nicht. */
function token(userId) {
  return jwtUtil.sign({ id: userId, userId: userId });
}

async function ruf(userId, pfad, opts) {
  const o = opts || {};
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), o.timeoutMs || 120000);
  try {
    const r = await fetch(basis() + pfad, {
      method: o.method || 'GET',
      headers: Object.assign({
        'Authorization': 'Bearer ' + token(userId),
        'Content-Type': 'application/json'
      }, o.headers || {}),
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: ctrl.signal
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  } finally { clearTimeout(t); }
}

/* ── Was kostet es? Kostet selbst nichts. ────────────────────────────────
 *
 * `/stufenpreis` rechnet schon bezahlte Stufen gegen — wer eine
 * Marktpreisindikation hat und auf die erweiterte geht, zahlt nur die
 * Differenz. Dieselbe Funktion, die auch abbucht (Kommentar v1154 dort:
 * "Was hier angekuendigt wird, KANN damit nicht mehr von der Abbuchung
 * abweichen").
 */
async function voranschlag(userId, objektId, stufe) {
  const s = STUFEN[stufe] ? stufe : 1;
  const r = await ruf(userId, '/marktbericht/stufenpreis?ref=' + encodeURIComponent(objektId || ''),
    { timeoutMs: 20000 });
  if (r.status !== 200) {
    return { moeglich: false, grund: (r.body && r.body.error) || ('HTTP ' + r.status) };
  }
  const kosten = (r.body.kosten && r.body.kosten[s]) || { anzahl: 0, art: null };
  let bestand = null;
  try {
    const st = await aiCreditsService.getStatus(userId);
    const a = st && st.arten && st.arten[STUFEN[s].art];
    bestand = a ? a.rest : null;
  } catch (e) { /* ohne Bestandsangabe geht es auch, nur weniger genau */ }

  return {
    moeglich: true,
    stufe: s,
    art: STUFEN[s].art,
    name: STUFEN[s].name,
    schon_bezahlt: r.body.bezahlte_stufe || 0,
    kostet: kosten.anzahl > 0,
    bestand: bestand
  };
}

/* ── Der Abruf. Nur nach ausdruecklicher Bestaetigung. ───────────────── */
async function abrufen(userId, objekt, stufe) {
  const s = STUFEN[stufe] ? stufe : 1;
  const d = (objekt && objekt.daten) || {};
  const r = await ruf(userId, '/marktbericht/reports/from-dealpilot', {
    method: 'POST',
    body: {
      fast: true,
      external_ref: objekt.objekt_id,
      wert_stufe: s,            /* NIE weglassen — der Default waere 2 */
      object: {
        id: objekt.objekt_id,
        plz: d.plz, ort: d.ort, str: d.str, hnr: d.hnr,
        objektart: d.objektart || d.objart,
        objart: d.objart || d.objektart,
        wfl: d.wfl, baujahr: d.baujahr, kp: d.kp, zimmer: d.zimmer,
        nkm: d.nkm, gsfl: d.gsfl, mea: d.mea
      }
    }
  });

  if (r.status === 402) {
    const e = new Error((r.body && r.body.message)
      || 'Dein Kontingent für diese Bewertung ist aufgebraucht.');
    e.fachlich = true; e.kontingent = true; e.upgradeTo = r.body && r.body.upgrade_to;
    throw e;
  }
  if (r.status !== 200 && r.status !== 201) {
    const e = new Error((r.body && (r.body.message || r.body.error)) || ('HTTP ' + r.status));
    e.fachlich = Boolean(r.body && (r.body.message || r.body.error));
    throw e;
  }
  return r.body;
}

module.exports = { voranschlag, abrufen, STUFEN };
