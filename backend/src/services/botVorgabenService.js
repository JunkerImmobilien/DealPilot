'use strict';
/* services/botVorgabenService.js — v1824 · DIE VORGABEN DES NUTZERS
 *
 * Marcel am 04.10.2026:
 *
 *   "Und halt die Finanzierungsdaten auch, wenn wir was hinterlegt haben,
 *    dass er vielleicht einfach fragt: Soll ich irgendwie kuenftig die
 *    Sachen dann hinterlegen? Aber nur dann, wenn nichts hinterlegt ist,
 *    dass man einmal fragt, dann wird es naechstes Mal schneller gehen."
 *
 * GEMESSEN am 04.10.2026: `user_settings` hat bei ihm genau EINEN
 * Schluessel (`datenraum`). Finanzierung und Kaufnebenkosten sind nirgends
 * hinterlegt — es gab keinen Ort dafuer.
 *
 * ── WAS HIER NICHT PASSIERT ────────────────────────────────────────────
 *
 * Diese Datei erfindet keine Zinssaetze. Sie speichert, was der Nutzer
 * EINMAL gesagt hat, und gibt es wieder heraus.
 *
 *   > Ein Standardwert, den niemand gesetzt hat, ist eine Annahme mit
 *   > Hausrecht. Sie steht im Ergebnis und niemand hat sie zu
 *   > verantworten.
 *
 * Deshalb trennt jede Rueckgabe streng: `vom_nutzer` ist gesetzt worden,
 * `vorschlag` ist eine Ableitung mit Herkunft, und was fehlt, fehlt.
 *
 * ── DIE KAUFNEBENKOSTEN ────────────────────────────────────────────────
 *
 * Die Grunderwerbsteuer kommt aus der PLZ (eine Tabelle, im Frontend
 * gepflegt, ueber den Extraktor hier lesbar — v1823). Makler, Notar und
 * Grundbuch sind dagegen VERHANDELBAR und ortsabhaengig; dafuer gibt es
 * keinen amtlichen Satz. Sie werden als VORSCHLAG mit ihrer Begruendung
 * ausgegeben, nie stillschweigend eingesetzt.
 */
const { query } = require('../db/pool');

const SCHLUESSEL = 'bot_vorgaben';

/* Die Felder, die der Bot hinterlegen darf. Eine geschlossene Liste:
   was hier nicht steht, landet nicht in den Vorgaben — sonst wird daraus
   mit der Zeit ein zweiter Objektdatensatz. */
const ERLAUBT = {
  d1z:        { label: 'Zinssatz', einheit: '% p.a.', min: 0.1, max: 15 },
  d1t:        { label: 'Tilgung', einheit: '% p.a.', min: 0, max: 10 },
  d1_bindj:   { label: 'Zinsbindung', einheit: 'Jahre', min: 1, max: 40 },
  ek_quote:   { label: 'Eigenkapitalquote', einheit: '% vom Kaufpreis', min: 0, max: 100 },
  makler_p:   { label: 'Maklercourtage', einheit: '% vom Kaufpreis', min: 0, max: 10 },
  notar_p:    { label: 'Notar', einheit: '% vom Kaufpreis', min: 0, max: 5 },
  gba_p:      { label: 'Grundbuch', einheit: '% vom Kaufpreis', min: 0, max: 5 },
};

/* Richtwerte für Notar und Grundbuch. KEINE Erfindung: sie stehen so im
   Formular der Haupt-App als Vorbelegung und sind die uebliche Groesse
   (Notar rund 1,5 %, Grundbuch rund 0,5 %). Sie werden als VORSCHLAG
   gekennzeichnet, nicht als Tatsache. */
const RICHTWERT = { notar_p: 1.5, gba_p: 0.5 };

function pruefe(id, wert) {
  const r = ERLAUBT[id];
  if (!r) return null;
  const n = Number(String(wert).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n < r.min || n > r.max) return null;
  return n;
}

/** Was hat der Nutzer hinterlegt? Leeres Objekt, wenn nichts. */
async function lesen(userId) {
  try {
    const r = await query(
      `SELECT wert FROM user_settings WHERE user_id = $1 AND schluessel = $2`,
      [userId, SCHLUESSEL]);
    const w = r.rows.length ? r.rows[0].wert : null;
    return (w && typeof w === 'object') ? w : {};
  } catch (e) { return {}; }
}

/** Setzen — nur erlaubte Felder, nur plausible Werte. */
async function setzen(userId, felder) {
  const alt = await lesen(userId);
  const neu = Object.assign({}, alt);
  const uebernommen = [], abgewiesen = [];
  Object.keys(felder || {}).forEach((id) => {
    const n = pruefe(id, felder[id]);
    if (n == null) { abgewiesen.push(id); return; }
    neu[id] = n;
    uebernommen.push(id);
  });
  neu.gesetzt_am = new Date().toISOString();
  await query(
    `INSERT INTO user_settings (user_id, schluessel, wert, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (user_id, schluessel) DO UPDATE
       SET wert = EXCLUDED.wert, updated_at = now()`,
    [userId, SCHLUESSEL, JSON.stringify(neu)]);
  return { uebernommen, abgewiesen, vorgaben: neu };
}

async function loeschen(userId) {
  await query(`DELETE FROM user_settings WHERE user_id = $1 AND schluessel = $2`,
    [userId, SCHLUESSEL]);
}

/* ── Die Grunderwerbsteuer aus der PLZ ─────────────────────────────────
 *
 * Die Tabelle wird im Frontend gepflegt (grest-plz-lookup.js) und steht
 * hier ueber die abgeleiteten Konstanten. Keine zweite Tabelle.
 *
 * ACHTUNG, DIE REIHENFOLGE ZAEHLT: der erste Treffer gilt, weil engere
 * Bereiche vor weiteren stehen (04900-04938 Brandenburg vor 04000-04999
 * Sachsen). Wer hier sortiert, bricht die Zuordnung.
 */
let _grest = null;
function grestTabelle() {
  if (_grest !== null) return _grest;
  try {
    const k = require('../generated/frontend-konstanten.json');
    _grest = ((k.daten || k).grest) || null;
  } catch (e) { _grest = null; }
  return _grest;
}

function grestFuerPlz(plz) {
  const g = grestTabelle();
  if (!g || !Array.isArray(g.plz_bereiche)) return null;
  const n = parseInt(String(plz == null ? '' : plz).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1000 || n > 99999 || n === 12345) return null;
  for (const b of g.plz_bereiche) {
    if (n >= b[0] && n <= b[1]) {
      const bl = b[2];
      const satz = g.saetze ? g.saetze[bl] : null;
      if (satz == null) return null;
      return { bundesland: bl, name: (g.namen && g.namen[bl]) || bl, satz: Number(satz) };
    }
  }
  return null;
}

/**
 * Was fehlt dem Objekt noch, und was koennen wir anbieten?
 *
 * Gibt drei getrennte Listen zurueck — und die Trennung ist der Punkt:
 *
 *   vorhanden   steht am Objekt
 *   vom_nutzer  aus seinen Vorgaben (er hat es einmal gesagt)
 *   vorschlag   abgeleitet, MIT Herkunft (Grunderwerbsteuer, Richtwert)
 *   fehlt       niemand weiss es — und das bleibt so, bis er es sagt
 */
async function ergaenzung(userId, daten) {
  const d = daten || {};
  const vorgaben = await lesen(userId);
  const vorhanden = {}, vomNutzer = {}, vorschlag = {}, fehlt = [];

  const hat = (id) => d[id] != null && String(d[id]).trim() !== '';

  Object.keys(ERLAUBT).forEach((id) => {
    if (id === 'ek_quote') return;          /* kein Objektfeld, nur Vorgabe */
    if (hat(id)) { vorhanden[id] = d[id]; return; }
    if (vorgaben[id] != null) { vomNutzer[id] = vorgaben[id]; return; }
    fehlt.push(id);
  });

  /* Die Grunderwerbsteuer ist KEINE Verhandlungssache — sie steht im
     Gesetz des Landes. Wenn die PLZ da ist, ist sie da. */
  if (!hat('gest_p')) {
    const g = grestFuerPlz(d.plz);
    if (g) {
      vorschlag.gest_p = { wert: g.satz, einheit: '% vom Kaufpreis',
        herkunft: 'Grunderwerbsteuer ' + g.name + ' (gesetzlicher Satz)' };
      const i = fehlt.indexOf('gest_p'); if (i >= 0) fehlt.splice(i, 1);
    } else if (d.plz) {
      fehlt.push('gest_p');
    }
  } else { vorhanden.gest_p = d.gest_p; }

  /* Notar und Grundbuch: Richtwerte, ausdruecklich als solche. */
  ['notar_p', 'gba_p'].forEach((id) => {
    const i = fehlt.indexOf(id);
    if (i >= 0 && RICHTWERT[id] != null) {
      fehlt.splice(i, 1);
      vorschlag[id] = { wert: RICHTWERT[id], einheit: '% vom Kaufpreis',
        herkunft: 'uebliche Groesse, kein amtlicher Satz — bitte am Angebot pruefen' };
    }
  });

  return {
    vorhanden, vom_nutzer: vomNutzer, vorschlag, fehlt,
    hat_vorgaben: Object.keys(vorgaben).filter((k) => k !== 'gesetzt_am').length > 0,
    beschriftung: Object.fromEntries(
      Object.entries(ERLAUBT).map(([id, r]) => [id, r.label + ' (' + r.einheit + ')'])),
  };
}

module.exports = { lesen, setzen, loeschen, ergaenzung, grestFuerPlz, ERLAUBT, SCHLUESSEL };
