/* lib/mietanker_kontext.js · v3343 — Laden des Kontexts für lib/mietanker.js (Datei + eigene Tabelle).
   Getrennt vom Kern: hier Dateien (Mietspiegel-Werte, Näherungsparameter) und mb.zensus_werte, dort nur Rechnung.
   Dieselbe Regel wie die Route GET /mietspiegel: gesperrte Wertedatei nur auf Staging (nurFrei=false). */
import { q } from './db.js';
import { werteFuer } from './mietspiegel/werte.js';
import { naeherungParameter } from './mietspiegel/naeherung.js';
import { mietpreisbremseFuer } from './kappung.js';
import { signaleAus } from './mietanker.js';

export const ZENSUS_SQL = "SELECT dimension, auspraegung, auspraegung_text, wert, gebiet_name FROM mb.zensus_werte WHERE ebene = 'gemeinde' AND kennzahl = 'nettokaltmiete_qm' AND ags = $1";

/** ref: gemapptes Objekt (DealPilotObjectMapper) · → Kontext oder null (ohne 8-stellige AGS) */
export async function vergleichsmieteKontext(ref, opts = {}) {
  const ags = String((ref && ref.ags) || '').replace(/\D/g, '');
  if (ags.length !== 8) return null;
  /* Der Wertkern nimmt gesperrte Wertedateien (Rechtevorbehalt, v3260) NIE - auf Staging und Prod gleich, damit
     die Ertragswerte beider Server vergleichbar bleiben. Die Route zeigt sie auf Staging weiter an. */
  const nurFrei = opts.nurFrei != null ? !!opts.nurFrei : true;
  let werte = werteFuer(ags);
  if (werte && werte.freigabe === 'gesperrt' && nurFrei) werte = null;
  let zeilen = null;
  if (!werte) { try { zeilen = await q(ZENSUS_SQL, [ags]); } catch (e) { zeilen = null; } }
  const st = ref.wertermittlungsstichtag ? new Date(ref.wertermittlungsstichtag) : new Date();
  const jahr = Number.isFinite(st.getTime()) ? st.getUTCFullYear() : new Date().getUTCFullYear();
  return {
    ags, werte: werte || null, naeherung_param: werte ? null : naeherungParameter(), zensus_zeilen: zeilen,
    baujahr: ref.build_year || null,
    signale: signaleAus({ standardstufe: ref.standardstufe, mikrolage: ref.mikrolage, mod_punkte: ref.mod_punkte,
      baujahr: ref.build_year, zustand: ref.condition }, jahr),
    bremse: (function () { try { return mietpreisbremseFuer(ags, st); } catch (e) { return null; } })(),
  };
}
