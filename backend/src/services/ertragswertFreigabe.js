'use strict';
/* services/ertragswertFreigabe.js — v2431 · Ertragswert im Zielbild nur mit Stufe 3
 *
 * Marcel am 19.10.2026 (Geld): der Ertragswert je Stufe (Bestand, Mieterhoehung,
 * Zielbild, Haus und je Wohnung, Aufteilung) ist derselbe Kern wie die
 * Wertermittlung nach ImmoWertV (Stufe 3, Kontingent "wev"). Er wird nur
 * gerechnet, wenn
 *
 *   (1) der TARIF Stufe 3 enthaelt  - Monatskontingent wev > 0 (pro, partner)
 *       oder eine laufende Testphase mit wev (aiCreditsService.getStatus);
 *       Einzeln gekaufte Wertermittlungen (Bank) zaehlen NICHT als Tarif -
 *       mit ihnen zieht man einen Bericht Stufe 3, und der gibt das Objekt frei;
 *   (2) fuer DIESES Objekt ein Bericht Stufe 3 vorliegt - mb.object_snapshots
 *       mit data.ref.wert_stufe = 3, Nutzer und external_ref (= objects.id)
 *       wie /objects/history, UND die Adresse des Berichts passt zum Objekt
 *       (sonst reichte die Kennung eines anderen, bezahlten Objekts).
 *
 * Es gibt KEINEN Feature-Schluessel dafuer: Stufe 3 haengt in diesem Haus am
 * Kontingent (KONTINGENT[plan].wev), nicht an plan.features. Ein neu erfundener
 * Schluessel waere nach der Hausregel fuer jeden false - auch fuer Pro.
 *
 * Die Pruefung verbraucht nichts. Im Zweifel (Dienst nicht erreichbar) NICHT
 * freigeben: lieber einmal zu wenig gezeigt als eine Leistung verschenkt. */
const aiCreditsService = require('./aiCreditsService');

const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

const HINWEIS_KURZ = 'Ertragswert je Stufe mit DealPilot Stufe 3';
const HINWEIS_LANG = 'Der Ertragswert je Stufe gehört zur Wertermittlung nach ImmoWertV (Stufe 3). '
  + 'Er erscheint hier, sobald für dieses Objekt ein Marktbericht Stufe 3 vorliegt oder dein Tarif Stufe 3 enthält. '
  + 'Mieten, Mieterhöhung, Zielbild, Kosten und Rendite rechnen auch ohne.';

function _refTaugt(ref) {
  return typeof ref === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(ref.trim());
}

/* Strasse und Hausnummer vergleichbar machen: "Westerfeldstr. 140" ==
   "Westerfeldstraße 140" == "westerfeld strasse 140". */
function _norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/str\.|strasse/g, 'str').replace(/[^a-z0-9]/g, '');
}
/** Passt die Adresse eines Berichts ("Westerfeldstr. 140, 33613 Bielefeld")
 *  zum Objekt? PLZ, Strasse und Hausnummer muessen sich wiederfinden. */
function adressePasst(adresse, obj) {
  if (!obj) return false;
  const plz = String(obj.plz || '').trim();
  const str = _norm(obj.str || obj.strasse || '');
  const hnr = _norm(obj.hnr || obj.hausnummer || '');
  const a = String(adresse || '');
  if (!plz || !a) return false;
  if (a.indexOf(plz) < 0) return false;
  const an = _norm(a);
  if (str && hnr) return an.indexOf(str + hnr) >= 0;
  return !!str && an.indexOf(str) >= 0;
}

/** Enthaelt der Tarif Stufe 3? */
async function tarifMitStufe3(userId) {
  try {
    const st = await aiCreditsService.getStatus(userId);
    const w = st && st.arten && st.arten.wev;
    if (w && w.limit > 0) return { ok: true, weg: 'tarif' };
    if (w && w.testphase > 0 && st.testphase && st.testphase.laeuft) return { ok: true, weg: 'testphase' };
  } catch (e) { /* nicht freigeben */ }
  return { ok: false };
}

async function _stufe3Berichte(userId, ref) {
  const p = new URLSearchParams({ user_id: String(userId) });
  if (ref) p.set('ref', ref);
  const r = await fetch(MB_BASE + '/objects/stufe3?' + p.toString());
  if (!r.ok) throw new Error('mb ' + r.status);
  const d = await r.json();
  return Array.isArray(d && d.berichte) ? d.berichte : [];
}

/** Freigabe fuer EIN Objekt. obj = die Objektdaten (plz, str, hnr). */
async function fuerObjekt(userId, ref, obj) {
  const t = await tarifMitStufe3(userId);
  if (t.ok) return t;
  if (!_refTaugt(ref)) return { ok: false, grund: 'kein_bericht' };
  try {
    const b = (await _stufe3Berichte(userId, String(ref).trim())).find((x) => adressePasst(x.address, obj));
    if (b) return { ok: true, weg: 'bericht', report_id: b.report_id || null, stand: b.created_at || null };
  } catch (e) { return { ok: false, grund: 'pruefung_fehlgeschlagen' }; }
  return { ok: false, grund: 'kein_bericht' };
}

/** Fuer viele Objekte eines Nutzers auf einmal (Portfolio-Pilot):
 *  liefert eine Funktion (ref, obj) -> boolean. Ein Abruf beim Dienst. */
async function pruefer(userId) {
  const t = await tarifMitStufe3(userId);
  if (t.ok) return function () { return true; };
  let liste = [];
  try { liste = await _stufe3Berichte(userId, null); } catch (e) { liste = []; }
  return function (ref, obj) {
    return liste.some((x) => String(x.external_ref) === String(ref) && adressePasst(x.address, obj));
  };
}

module.exports = { fuerObjekt, pruefer, tarifMitStufe3, adressePasst, HINWEIS_KURZ, HINWEIS_LANG };
