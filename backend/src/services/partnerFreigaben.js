'use strict';
/**
 * partnerFreigaben.js · v3690 — Freigabe des Kunden an seinen Partner (Paket P1, Konzept
 * Dateien/Mandantenkonzept/Anfordern-und-Freigeben-2026-11-18.md, Abschnitte 2.1 bis 2.5, 4 und 5.1)
 *
 * Marcel 18.11.2026: dauerhaft UND einmalig. Steuerdaten gehen nur mit Freigabe mit, abgefragt direkt bei der
 * Kopplung (Einladung annehmen, Anfrage bestaetigen, Verbindungscode), spaeter unter Mein Partner aenderbar.
 *
 *   art       dauer   gilt bis zum Widerruf, der Partner darf immer wieder anfordern
 *             einmal  gilt fuer die naechste Sendung (oder Anforderung) und endet mit ihr (verbraucht_am)
 *             keine   verbunden, der Kunde sendet nur selbst, nur der Bereich Objekt
 *   bereiche  objekt (immer), steuer, steuerdaten (nur mit steuer), finanzierung, unterlagen, marktbericht
 *
 * Fassungen statt Ueberschreiben: jede Aenderung ist eine neue Zeile, die alte bekommt ersetzt_am. Es gibt hoechstens
 * eine aktive Fassung je Verbindung (Index uq_partner_freigaben_aktiv). Gelesen wird die Freigabe nur hier.
 *
 * Wirkung in P1 (senden): ohne Bereich steuer fallen STEUER_FELDER aus der Kopie, ohne steuerdaten STEUERDATEN_FELDER.
 * Die uebrigen Bereiche werden gespeichert und wirken mit den Anforderungen (P3 bis P5).
 */
const { query } = require('../db/pool');

const TEXT_VERSION = 'freigabe-1.0';
const BEREICHE = ['objekt', 'steuer', 'steuerdaten', 'finanzierung', 'unterlagen', 'marktbericht'];
const ARTEN = ['dauer', 'einmal', 'keine'];
const QUELLEN = ['einladung', 'anfrage', 'code', 'mein_partner', 'anforderung'];
/* Bereich Steuer: Anlage V je Jahr, Jahresbuch (Ist-Miete, Status je Jahr), Werbungskosten je Jahr */
const STEUER_FELDER = ['_tax_overrides', '_jahre', 'steuer_snapshot'];
/* Bereich Steuerdaten: persoenliche Steuerangaben und was direkt aus ihnen gerechnet ist (Cashflow nach Steuern,
   Steuerjahr der Kennzahl, Merker „Steuer vorlaeufig“). Splitting und Kirchensteuer liegen nur im Browser des Kunden
   (Investmentprofil) und reisen ohnehin nicht. */
const STEUERDATEN_FELDER = ['zve', 'grenz', '_steuerbasis', '_kpis_cf_ns', '_kpis_steuerjahr', '_steuer_vorlaeufig'];

function fehler(code, status, detail) { const e = new Error(code); e.status = status || 400; if (detail) e.detail = detail; return e; }

/** Bereiche in die feste Form: objekt immer an, steuerdaten nur zusammen mit steuer, unbekannte Schluessel fallen weg */
function bereicheSauber(roh) {
  const r = {}; const b = roh && typeof roh === 'object' ? roh : {};
  BEREICHE.forEach((k) => { r[k] = b[k] === true; });
  r.objekt = true;
  if (!r.steuer) r.steuerdaten = false;
  return r;
}
/** Eingabe des Kunden pruefen. Wirft 400 bei unbekannter Art. Bei 'keine' bleibt nur der Bereich Objekt. */
function freigabeSauber(roh) {
  if (!roh || typeof roh !== 'object') throw fehler('freigabe_fehlt', 400, 'Bitte wähle, was dein Partner anfordern darf.');
  const art = String(roh.art || '');
  if (ARTEN.indexOf(art) < 0) throw fehler('freigabe_art_ungueltig', 400, 'Bitte wähle dauerhaft, einmalig oder noch nicht.');
  const bereiche = art === 'keine' ? bereicheSauber({}) : bereicheSauber(roh.bereiche);
  return { art, bereiche, umfang: 'alle' };
}
/** Vorschlag des Partners (Einladung, Anfrage, Code). Fehlt er oder ist er unbrauchbar: null, kein Fehler. */
function vorschlagSauber(roh) {
  if (!roh || typeof roh !== 'object') return null;
  const art = ['dauer', 'einmal'].indexOf(roh.art) >= 0 ? roh.art : null;
  if (!art) return null;
  return { art, bereiche: bereicheSauber(roh.bereiche) };
}
/** Was beim Senden gilt: die aktive Fassung, sonst (keine, widerrufen, verbraucht, nie erteilt) nur Objekt */
function bereicheWirksam(aktiv) {
  if (!aktiv || aktiv.art === 'keine') return bereicheSauber({});
  return bereicheSauber(aktiv.bereiche);
}
/** Entfernt aus dem Objekt-JSON der Kopie, was ohne Bereich nicht mitgehen darf. Rein, aendert d, gibt die Schluessel zurueck. */
function kopieFiltern(d, bereiche) {
  const b = bereicheSauber(bereiche), weg = [];
  const raus = (k) => { if (Object.prototype.hasOwnProperty.call(d, k)) { delete d[k]; weg.push(k); } };
  if (!b.steuerdaten) STEUERDATEN_FELDER.forEach(raus);
  if (!b.steuer) STEUER_FELDER.forEach(raus);
  return weg;
}
/** Zustand fuer die Anzeige: dauer | einmal | keine | widerrufen | verbraucht | ohne (nie erteilt) */
function zustand(aktiv, letzte) {
  if (aktiv) return aktiv.art;
  if (!letzte) return 'ohne';
  if (letzte.widerrufen_am) return 'widerrufen';
  if (letzte.verbraucht_am) return 'verbraucht';
  return 'ohne';
}

const AKTIV = 'ersetzt_am IS NULL AND widerrufen_am IS NULL AND verbraucht_am IS NULL';
async function aktive(clientId, q) {
  const r = await (q || query)(`SELECT * FROM partner_freigaben WHERE client_id = $1 AND ${AKTIV} ORDER BY erteilt_am DESC LIMIT 1`, [clientId]);
  return r.rows[0] || null;
}
async function verlauf(clientId, limit) {
  return (await query(`SELECT id, art, bereiche, umfang, text_version, quelle, erteilt_am, ersetzt_am, widerrufen_am, verbraucht_am, staende_zurueckgezogen
                         FROM partner_freigaben WHERE client_id = $1 ORDER BY erteilt_am DESC, id LIMIT $2`, [clientId, Math.min(limit || 20, 100)])).rows;
}
/** Kurzform fuer Kunde und Partner: aktive Fassung, Zustand, Verlauf */
async function uebersicht(clientId) {
  const l = await verlauf(clientId, 20);
  const aktiv = l.filter((x) => !x.ersetzt_am && !x.widerrufen_am && !x.verbraucht_am)[0] || null;
  return { aktiv, zustand: zustand(aktiv, l[0] || null), verlauf: l, text_version: TEXT_VERSION };
}

/* Eine Transaktion, wenn der echte Pool da ist (im Pruefer ohne DB laeuft es ueber query). */
async function inTx(fn) {
  let pool = null; try { pool = require('../db/pool').pool; } catch (e) {}
  if (!pool || typeof pool.connect !== 'function') return fn(query);
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn((s, p) => c.query(s, p)); await c.query('COMMIT'); return r; }
  catch (e) { try { await c.query('ROLLBACK'); } catch (x) {} throw e; }
  finally { c.release(); }
}

/** Neue Fassung: die aktive bekommt ersetzt_am, die neue wird aktiv. f kommt aus freigabeSauber. */
async function setzen(clientId, userId, f, quelle) {
  if (QUELLEN.indexOf(quelle) < 0) throw fehler('freigabe_quelle_ungueltig', 500);
  return inTx(async (q) => {
    await q(`SELECT id FROM reseller_clients WHERE id = $1 FOR UPDATE`, [clientId]);   /* zwei gleichzeitige Fassungen hintereinander */
    const alt = await q(`UPDATE partner_freigaben SET ersetzt_am = now() WHERE client_id = $1 AND ${AKTIV} RETURNING id`, [clientId]);
    const r = await q(
      `INSERT INTO partner_freigaben (client_id, art, bereiche, umfang, text_version, quelle, erteilt_von)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7) RETURNING *`,
      [clientId, f.art, JSON.stringify(f.bereiche), f.umfang || 'alle', TEXT_VERSION, quelle, userId || null]);
    return Object.assign(r.rows[0], { ersetzt: alt.rowCount || 0 });
  });
}
/** Widerruf der aktiven Fassung. null, wenn keine aktiv war. */
async function widerrufen(clientId) {
  const r = await query(`UPDATE partner_freigaben SET widerrufen_am = now() WHERE client_id = $1 AND ${AKTIV} RETURNING *`, [clientId]);
  return r.rows[0] || null;
}
/** Einmalige Freigabe nach der Sendung verbrauchen. Eine Dauerfreigabe bleibt. */
async function verbrauchen(id) {
  if (!id) return false;
  const r = await query(`UPDATE partner_freigaben SET verbraucht_am = now() WHERE id = $1 AND art = 'einmal' AND ${AKTIV} RETURNING id`, [id]);
  return r.rowCount > 0;
}

/** Kurztext fuer Meldungen an den Partner (Punkt und Komma) */
const NAMEN = { objekt: 'Objekte', steuer: 'Steuer', steuerdaten: 'Steuerdaten', finanzierung: 'Finanzierung', unterlagen: 'Unterlagen und Belege', marktbericht: 'Marktbericht' };
const ART_TEXT = { dauer: 'dauerhaft', einmal: 'einmalig' };
/** Ein ganzer Satz: „Freigabe dauerhaft für Objekte, Steuer.“ oder „Noch keine Freigabe.“ */
function kurztext(f) {
  if (!f || f.art === 'keine') return 'Noch keine Freigabe.';
  const b = bereicheSauber(f.bereiche);
  return 'Freigabe ' + ART_TEXT[f.art] + ' für ' + BEREICHE.filter((k) => b[k]).map((k) => NAMEN[k]).join(', ') + '.';
}

module.exports = {
  TEXT_VERSION, BEREICHE, ARTEN, QUELLEN, STEUER_FELDER, STEUERDATEN_FELDER,
  bereicheSauber, freigabeSauber, vorschlagSauber, bereicheWirksam, kopieFiltern, zustand, kurztext,
  aktive, verlauf, uebersicht, setzen, widerrufen, verbrauchen
};
