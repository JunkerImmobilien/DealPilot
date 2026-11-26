// lib/nebenkosten/nebenkosten.js · nn6 (26.11.2026) — laufende Wohnnebenkosten je Gemeinde für den Haus-Check
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Marcel 26.11.2026: „kannst du den genau ermitteln? können wir dafür datenbanken anlegen?“
// Bisher rechnete der Eigennutzer-Kern die übrigen Nebenkosten pauschal mit 2,00 €/m² im Monat.
//
// JE POSTEN EINE HERKUNFT (nie ein Wert ohne Herkunft):
//   'gemeinde'  amtlich je Gemeinde abgeleitet  (Grundsteuer: Aufkommen B / Wohnfläche, kalibriert)
//   'bund'      Bundesdurchschnitt               (übrige Posten, Betriebskostenspiegel; Quelle nur intern)
//
// GRUNDSTEUER: Seit 2025 gilt die reformierte Grundsteuer mit neuen Hebesätzen. Die Regionaldatenbank
// führt Aufkommen und Hebesätze bisher bis 2024. Die Reform war je Gemeinde aufkommensneutral
// angelegt, darum trägt das Aufkommen B je m² Wohnfläche weiter als Ortsniveau. Das Aufkommen B
// enthält auch Nichtwohngrundstücke; der Faktor K bringt den Bundesschnitt auf den Wohnanteil
// (Bundesschnitt Grundsteuer der Wohnung, intern belegt). Ergebnis ist ein DURCHSCHNITT der
// Gemeinde, kein Bescheid: das einzelne Haus kann deutlich abweichen (Grundstücksgröße, Landesmodell).
//
// Datenquellen (intern, nicht im Kundentext): Regionaldatenbank 71231-01-03-5 und 31231-02-01-5
// (dl-de/by-2-0, Statistische Ämter des Bundes und der Länder); Betriebskostenspiegel des
// Deutschen Mieterbunds, Abrechnungsjahr 2024 (veröffentlicht 18.12.2025).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATEI = path.join(DIR, 'grundsteuer-gemeinden.json');

/* Bundesdurchschnitte €/m² Wohnfläche und Monat, Abrechnungsjahr 2024 (intern belegt, Stand 18.12.2025). */
export const BUND = Object.freeze({
  stand: '2024',
  grundsteuer: 0.18, wasser: 0.29, muell: 0.16, versicherung: 0.31,
  schornstein: 0.04, strasse: 0.04, strom_allgemein: 0.06,
});

const NAMEN = {
  grundsteuer: 'Grundsteuer', wasser: 'Wasser und Abwasser', muell: 'Müllabfuhr',
  versicherung: 'Gebäudeversicherung', schornstein: 'Schornsteinfeger', strasse: 'Straßenreinigung',
  strom_allgemein: 'Strom für Außenbereich und Allgemeinflächen',
};

let _daten = null;
export function daten() {
  if (_daten) return _daten;
  _daten = existsSync(DATEI) ? JSON.parse(readFileSync(DATEI, 'utf8')) : { gemeinden: {}, faktor_k: null };
  return _daten;
}

const r2 = (x) => Math.round(x * 100) / 100;
const komma = (x, n = 2) => Number(x).toFixed(n).replace('.', ',');

/** Grundsteuer €/m²·Monat der Gemeinde (Durchschnitt) oder null. */
export function grundsteuerQm(ags) {
  const D = daten(), g = D.gemeinden && D.gemeinden[String(ags || '')];
  if (!g || !(g.gs_qm_monat > 0)) return null;
  return { qm: g.gs_qm_monat, hebesatz_b: g.hebesatz_b ?? null, jahr: D.jahr, name: g.name };
}

/**
 * Laufende Nebenkosten (ohne Heizung) für ein selbst genutztes Objekt.
 * @param {string} ags   achtstelliger Gemeindeschlüssel
 * @param {object} o     { wfl (m²), art ('efh'|'zfh'|'dhh'|'rh'|'etw') }
 * @returns {{ posten:Array, summe_qm:number, summe_monat:number|null, herkunft_text:string, hinweis:string }}
 */
export function nebenkostenFuer(ags, o = {}) {
  const wfl = Number(o.wfl) > 0 ? Number(o.wfl) : null;
  const gs = grundsteuerQm(ags);
  const posten = [];
  for (const id of Object.keys(NAMEN)) {
    let qm = BUND[id], herkunft = 'bund', text = 'Bundesdurchschnitt';
    if (id === 'grundsteuer' && gs) {
      qm = gs.qm; herkunft = 'gemeinde';
      text = 'Durchschnitt der Gemeinde, aus dem Grundsteueraufkommen ' + gs.jahr + ' je m² Wohnfläche abgeleitet';
    }
    posten.push({ id, name: NAMEN[id], qm_monat: r2(qm), eur_monat: wfl ? Math.round(qm * wfl) : null, herkunft, text });
  }
  const summe = posten.reduce((s, p) => s + p.qm_monat, 0);
  return {
    ags: String(ags || ''), gemeinde: gs ? gs.name : null,
    posten, summe_qm: r2(summe), summe_monat: wfl ? Math.round(summe * wfl) : null,
    herkunft_text: (gs ? 'Grundsteuer als Durchschnitt der Gemeinde' : 'Grundsteuer als Bundesdurchschnitt')
      + ', übrige Posten als Bundesdurchschnitt, zusammen ' + komma(summe) + ' €/m² im Monat',
    hinweis: 'Durchschnittswerte, kein Bescheid. Grundsteuerbescheid, Abfallgebühren und Versicherungsangebot des Objekts sind genauer.',
    grundsteuer_hebesatz_b_vor_reform: gs ? gs.hebesatz_b : null,
  };
}
