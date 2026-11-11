'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/flowAgent.js — v3297 · Flow Investor, Punkt 5: Co-Pilot mit allen Objekten ueber die API
 *
 * POST /api/v1/agent/frage { text, objekt_id?, darf_kosten?, kosten_token?, verlauf? }
 *   -> { antwort, schritte: [{ werkzeug, kurz }], bestaetigen?: [{ token, werkzeug, kurz }], kosten_vorschlag? }
 * POST /api/v1/agent/bestaetigen { token } -> fuehrt EIN vorgemerktes schreibendes Werkzeug aus.
 *
 *   · derselbe Agent wie im Telegram-Bot: agentLauf.laufen() mit den Werkzeugen aus agentWerkzeuge.js
 *   · schreibende Werkzeuge (felder_aendern, objekt_anlegen, vorgaben_setzen) werden NUR vorgemerkt
 *     (Tabelle agent_vorschlaege, Token nur als SHA-256, 24 h) - Marcel 11.11.2026: „ja, mit Bestaetigung"
 *   · kostenpflichtige Werkzeuge nur mit darf_kosten UND einem freigegebenen kosten_token (Punkt 6); der
 *     Token bestimmt Stufe und Objekt - das Modell kann nichts anderes kaufen. Ohne Token gibt es einen
 *     kosten_vorschlag, mit dem der Hub POST /kosten/anfrage stellt.
 *   · Tageslimit: dasselbe wie /ai/copilot (routes/ai.js copilotKontingent - ein Zaehler fuer Browser,
 *     Telegram und API).
 * ═══════════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const { query } = require('../db/pool');
const { HttpError } = require('../middleware/errors');

const GUELTIG_STD = 24;
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function neuerToken() { return 'dpav_' + crypto.randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function kurz(name, args) {
  const a = args && typeof args === 'object' ? args : {};
  const teile = [];
  if (a.felder && typeof a.felder === 'object') teile.push(Object.keys(a.felder).map((k) => k + '=' + String(a.felder[k]).slice(0, 40)).join(', '));
  if (a.beschreibung) teile.push(String(a.beschreibung).slice(0, 120));
  if (a.adresse) teile.push(String(a.adresse).slice(0, 80));
  return name + (teile.length ? ': ' + teile.join(' · ') : '');
}

function _ctx(userId, b) {
  return {
    userId: userId, kanal: 'api', nummerErfunden: true,
    letzteListe: null, letztesObjekt: b.objekt_id || null, protokoll: [],
    merkeObjekt: function (id) { this.letztesObjekt = id; },
    merkeListe: function (ids) { this.letzteListe = ids; },
    anlageFertig: async function () {},
    angebotObjekt: null, angebotStufe: null, angebotFrei: null,
    merkeAngebot: async function (id, adr, stufe, frei) {
      /* Preisansage merken - abgerufen wird damit NICHT; das braucht den kosten_token */
      this.vorschlagObjekt = id; this.vorschlagStufe = stufe || null; this.vorschlagAdresse = adr || null;
    },
    angebotVerbraucht: async function () { this.angebotObjekt = null; this.angebotStufe = null; }
  };
}

async function frage(userId, b) {
  b = b || {};
  const text = String(b.text || '').trim();
  if (!text) throw new HttpError(400, 'text fehlt');
  if (text.length > 4000) throw new HttpError(400, 'text ist zu lang (höchstens 4000 Zeichen)');
  if (b.objekt_id) {
    const o = await query('SELECT 1 FROM objects WHERE id=$1 AND user_id=$2', [b.objekt_id, userId]);
    if (!o.rowCount) throw new HttpError(404, 'Object not found');
  }
  const ctx = _ctx(userId, b);
  const darfKosten = b.darf_kosten === true;
  if (darfKosten) {
    if (!b.kosten_token) { const e = new HttpError(402, 'darf_kosten braucht einen freigegebenen kosten_token (POST /kosten/anfrage).'); e.code = 'KOSTEN_TOKEN_FEHLT'; throw e; }
    const r = await query("SELECT stufe, objekt_ref FROM kosten_freigaben WHERE user_id=$1 AND token_hash=$2 AND status='frei' AND expires_at > NOW()",
      [userId, sha256(b.kosten_token)]);
    if (!r.rowCount) { const e = new HttpError(402, 'Der kosten_token ist nicht freigegeben, abgelaufen oder verbraucht.'); e.code = 'KOSTEN_FREIGABE_FEHLT'; throw e; }
    if (!r.rows[0].objekt_ref) { const e = new HttpError(400, 'Über die Schnittstelle kauft der Co-Pilot nur Berichte zu einem Objekt (kosten_token mit objekt_id).'); e.code = 'KOSTEN_OHNE_OBJEKT'; throw e; }
    ctx.kostenToken = b.kosten_token;
    ctx.angebotObjekt = r.rows[0].objekt_ref;
    ctx.angebotStufe = r.rows[0].stufe;
  }
  const lim = await require('../routes/ai').copilotKontingent.verbrauchen(userId);
  if (!lim.ok) { const e = new HttpError(429, 'Co-Pilot-Tageslimit erreicht (' + lim.limit + ' am Tag).'); e.code = 'COPILOT_TAGESLIMIT'; throw e; }

  const vorschlaege = [];
  const vormerken = async (name, args) => {
    const t = neuerToken();
    const k = kurz(name, args);
    await query(
      "INSERT INTO agent_vorschlaege (user_id, token_hash, werkzeug, args, kurz, expires_at) VALUES ($1,$2,$3,$4::jsonb,$5, NOW() + ($6 || ' hours')::interval)",
      [userId, sha256(t), name, JSON.stringify(args || {}), k, String(GUELTIG_STD)]);
    vorschlaege.push({ token: t, werkzeug: name, kurz: k, args: args });
    return { ok: true, vorgemerkt: true,
      hinweis: 'NICHT ausgefuehrt: Aenderungen ueber die Schnittstelle brauchen die Bestaetigung des Nutzers. '
        + 'Sag in einem Satz, was du aendern wuerdest, und dass es nach der Bestaetigung ausgefuehrt wird.' };
  };
  const verlauf = Array.isArray(b.verlauf) ? b.verlauf.slice(-10).map((e) => ({ rolle: e && e.rolle === 'user' ? 'user' : 'assistant', text: String((e && e.text) || '').slice(0, 2000) })) : [];
  const laufen = require('./agentLauf').laufen;
  const r = await laufen(text, ctx, { darfKosten: darfKosten, schreibenVormerken: vormerken, verlauf: verlauf });

  const schritte = (r.protokoll || ctx.protokoll || []).map((p) => {
    let args = {};
    try { args = p.args ? JSON.parse(p.args) : {}; } catch (e) { args = {}; }
    return { werkzeug: p.werkzeug, stufe: p.stufe, kurz: kurz(p.werkzeug, args) };
  });
  const aus = { antwort: r.text || '', schritte: schritte, kosten: darfKosten ? 'freigegeben' : 'keine', tageslimit: { benutzt: lim.benutzt, limit: lim.limit } };
  if (vorschlaege.length) aus.bestaetigen = vorschlaege.map((v) => ({ token: v.token, werkzeug: v.werkzeug, kurz: v.kurz, gueltig_std: GUELTIG_STD }));
  if (!darfKosten && ctx.vorschlagStufe && ctx.vorschlagObjekt) {
    const K = require('./kostenFreigabe');
    const art = K.STUFE_ART[ctx.vorschlagStufe];
    aus.kosten_vorschlag = { art: art, stufe: ctx.vorschlagStufe, preis: K.PREIS_EUR[art], objekt_id: ctx.vorschlagObjekt,
      weg: 'POST /api/v1/kosten/anfrage { art, objekt_id }, freigeben, dann erneut fragen mit darf_kosten:true und kosten_token' };
  }
  if (r.abgebrochen) aus.abgebrochen = true;
  return aus;
}

async function bestaetigen(userId, token) {
  const r = await query(
    "UPDATE agent_vorschlaege SET status='ausgefuehrt', erledigt_at=NOW() WHERE user_id=$1 AND token_hash=$2 AND status='offen' AND expires_at > NOW() RETURNING id, werkzeug, args, kurz",
    [userId, sha256(token || '')]);
  if (!r.rowCount) { const e = new HttpError(404, 'Vorschlag unbekannt, abgelaufen oder schon erledigt.'); e.code = 'VORSCHLAG_UNGUELTIG'; throw e; }
  const v = r.rows[0];
  const w = require('./agentWerkzeuge').finde(v.werkzeug);
  if (!w || w.stufe !== 'schreiben') { const e = new HttpError(400, 'Kein schreibendes Werkzeug.'); throw e; }
  /* Die Bestaetigung ueber die Schnittstelle IST die Bestaetigung des Nutzers - die Werkzeuge, die
     selbst zweistufig fragen (objekt_anlegen, felder_aendern bei belegten Feldern), bekommen bestaetigt:true. */
  const args = Object.assign({}, v.args || {}, { bestaetigt: true });
  const ctx = _ctx(userId, {});
  let ergebnis;
  try { ergebnis = await w.fn(ctx, args); } catch (e) { ergebnis = { ok: false, fehler: String(e && e.message || e) }; }
  await query('UPDATE agent_vorschlaege SET ergebnis=$2::jsonb WHERE id=$1', [v.id, JSON.stringify(ergebnis || {}).slice(0, 20000)]);
  return { ok: !(ergebnis && ergebnis.ok === false), werkzeug: v.werkzeug, kurz: v.kurz, ergebnis: ergebnis };
}

async function verwerfen(userId, token) {
  const r = await query("UPDATE agent_vorschlaege SET status='verworfen', erledigt_at=NOW() WHERE user_id=$1 AND token_hash=$2 AND status='offen' RETURNING id", [userId, sha256(token || '')]);
  return { ok: r.rowCount > 0 };
}

module.exports = { frage, bestaetigen, verwerfen, kurz };
