'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/verkaufSchalter.js · v5130 KK6 · Verkauf von Einzel-Check und Haus-Check an- und abschalten
 *
 * Marcel 26.11.2026: zwei Kippschalter in Admin › Betrieb, daneben die Käufe heute und im Monat.
 *   verkauft = UMGEBUNG erlaubt  UND  Schalter in der DB an
 *   Umgebung: EINZELCHECK_AKTIV bzw. HAUSCHECK_AKTIV ('1' an, '0' Not-Aus, leer = nur Staging). Steht sie auf aus,
 *   nützt der Admin-Schalter nichts. Ohne DB-Zeile gilt „an“ (Migration 135 legt beide Zeilen an).
 *   Bei „aus“: die Landing rechnet weiter kostenlos, statt „kaufen“ steht „Bald verfügbar“, POST /kaufen antwortet 409.
 *   Bereits bezahlte Käufe (Status, Bericht, PDF) laufen weiter.
 * Schalten nur über Admin › Betrieb (Rolle owner), protokolliert im admin_audit_log (routes/admin.js).
 * ═══════════════════════════════════════════════════════════════════════════ */
const PRODUKTE = { einzelcheck: { name: 'Deal-Check', env: 'EINZELCHECK_AKTIV' }, hauscheck: { name: 'Haus-Check', env: 'HAUSCHECK_AKTIV' } };

const STANDARD = {
  query: function (t, p) { return require('../db/pool').query(t, p); },
  istStaging: function () { return /staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || ''); },
  env: function (k) { return process.env[k]; },
  jetzt: function () { return Date.now(); }
};
let _deps = null;
function deps() { return _deps || STANDARD; }
function _setzeDeps(d) { _cache = {}; _deps = d ? Object.assign(Object.create(STANDARD), d) : null; }

/** Obergrenze aus der Umgebung: '1' an, '0' aus, leer nur Staging. */
function umgebungErlaubt(produkt) {
  const p = PRODUKTE[produkt]; if (!p) return false;
  const s = String(deps().env(p.env) || '');
  if (s === '1') return true;
  if (s === '0') return false;
  return deps().istStaging();
}

let _cache = {};
const CACHE_MS = 20 * 1000;
async function schalterAn(produkt) {
  const c = _cache[produkt];
  if (c && deps().jetzt() - c.t < CACHE_MS) return c.an;
  let an = true;
  try {
    const r = await deps().query('SELECT aktiv FROM verkauf_schalter WHERE produkt = $1', [produkt]);
    an = r.rows && r.rows.length ? r.rows[0].aktiv !== false : true;
  } catch (e) { an = true; }   /* Tabelle fehlt (Migration noch nicht gelaufen): wie bisher, nur die Umgebung zählt */
  _cache[produkt] = { t: deps().jetzt(), an: an };
  return an;
}

/** Darf jetzt verkauft werden? */
async function verkauft(produkt) {
  if (!umgebungErlaubt(produkt)) return false;
  return schalterAn(produkt);
}

async function setzen(produkt, an, von) {
  if (!PRODUKTE[produkt]) { const e = new Error('unbekanntes Produkt'); e.status = 400; throw e; }
  await deps().query(
    'INSERT INTO verkauf_schalter (produkt, aktiv, geaendert_am, geaendert_von) VALUES ($1, $2, now(), $3)' +
    ' ON CONFLICT (produkt) DO UPDATE SET aktiv = EXCLUDED.aktiv, geaendert_am = now(), geaendert_von = EXCLUDED.geaendert_von',
    [produkt, !!an, von || null]);
  delete _cache[produkt];
  return stand();
}

/** Bezahlter Kauf: Tageszähler (die Kauf-Zeilen löscht der Takt nach 14 Tagen). Fehler brechen den Webhook nie. */
async function gezaehlt(produkt, cent) {
  try {
    await deps().query(
      "INSERT INTO verkauf_tage (produkt, tag, anzahl, cent) VALUES ($1, (now() AT TIME ZONE 'Europe/Berlin')::date, 1, $2)" +
      ' ON CONFLICT (produkt, tag) DO UPDATE SET anzahl = verkauf_tage.anzahl + 1, cent = verkauf_tage.cent + EXCLUDED.cent',
      [produkt, Math.max(0, Math.round(Number(cent) || 0))]);
  } catch (e) { console.warn('[verkauf] Zähler nicht geschrieben:', e.message); }
}

/** Stand für Admin › Betrieb: je Produkt Umgebung, Schalter, wirksam, Käufe heute und im Monat. */
async function stand() {
  const out = [];
  let zahlen = [];
  try {
    const r = await deps().query(
      "SELECT produkt, SUM(anzahl) FILTER (WHERE tag = (now() AT TIME ZONE 'Europe/Berlin')::date) AS heute," +
      " SUM(cent) FILTER (WHERE tag = (now() AT TIME ZONE 'Europe/Berlin')::date) AS heute_cent," +
      " SUM(anzahl) AS monat, SUM(cent) AS monat_cent FROM verkauf_tage" +
      " WHERE tag >= date_trunc('month', now() AT TIME ZONE 'Europe/Berlin')::date GROUP BY produkt", []);
    zahlen = r.rows || [];
  } catch (e) { zahlen = []; }
  let zeilen = [];
  try { zeilen = (await deps().query('SELECT produkt, aktiv, geaendert_am, geaendert_von FROM verkauf_schalter', [])).rows || []; } catch (e) { zeilen = []; }
  for (const k of Object.keys(PRODUKTE)) {
    const z = zahlen.find((x) => x.produkt === k) || {};
    const s = zeilen.find((x) => x.produkt === k) || null;
    const umg = umgebungErlaubt(k);
    const an = s ? s.aktiv !== false : true;
    out.push({ produkt: k, name: PRODUKTE[k].name, umgebung: umg, umgebung_var: PRODUKTE[k].env, schalter: an, wirksam: umg && an,
      geaendert_am: s ? s.geaendert_am : null, geaendert_von: s ? s.geaendert_von : null,
      heute: Number(z.heute) || 0, heute_cent: Number(z.heute_cent) || 0, monat: Number(z.monat) || 0, monat_cent: Number(z.monat_cent) || 0 });
  }
  return out;
}

module.exports = { PRODUKTE, umgebungErlaubt, schalterAn, verkauft, setzen, gezaehlt, stand, _setzeDeps };
