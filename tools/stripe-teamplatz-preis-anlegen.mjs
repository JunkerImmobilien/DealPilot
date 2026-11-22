#!/usr/bin/env node
/* stripe-teamplatz-preis-anlegen.mjs · v3947 (22.11.2026)
 *
 * Legt in Stripe die zwei Preise der Teamplaetze an (Marcels Entscheidung 22.11.2026), aus GENAU den Stufen in
 * frontend/js/teamplatz-staffel.js:
 *
 *   Produkt  „DealPilot Teamplatz“ (metadata.dp_key = teamplatz), wird wiederverwendet, wenn es schon da ist
 *   Preis    lookup_key dp_teamplatz_monat   EUR, monatlich, billing_scheme tiered, tiers_mode graduated
 *            1. bis 3. Teamplatz 59 EUR, 4. bis 8. 49 EUR, ab dem 9. 39 EUR   (= 2. bis 4. / 5. bis 9. / ab 10. Login)
 *   Preis    lookup_key dp_teamplatz_jahr    dasselbe jaehrlich: 649 / 539 / 429 EUR
 *
 * Das Backend (services/partnerPlanKauf.js TEAM_LOOKUP) findet die Preise ueber den lookup_key. Steuer: wie die
 * uebrigen Preise ohne automatic_tax (Kleinunternehmer § 19 UStG), tax_behavior bleibt Stripe-Vorgabe.
 *
 * SICHERUNGEN (Marcel: Stripe-Schreibzugriff nur nach seinem OK):
 *   ohne --ausfuehren          Trockenlauf: zeigt, was angelegt wuerde, schreibt NICHTS, RC 2
 *   --ausfuehren               nur mit Testschluessel (sk_test_ / rk_test_) in STRIPE_SECRET_KEY, sonst RC 3
 *   --ausfuehren --live        nur mit Live-Schluessel (sk_live_ / rk_live_), sonst RC 3
 *   Schluessel aus der Umgebung: STRIPE_SECRET_KEY, oder --schluessel-var=NAME fuer eine andere Variable.
 *   Er wird nie ausgegeben.
 *   Gibt es einen lookup_key schon: gleiche Stufen -> uebersprungen, andere Stufen -> Abbruch RC 4 (nie umhaengen,
 *   neue Preise brauchen einen neuen lookup_key und eine neue Version in teamplatz-staffel.js).
 *   Nach dem Anlegen wird jeder Preis zurueckgelesen und gegen die Quelle verglichen, Abweichung RC 5.
 *
 * Aufruf (nach Marcels OK):
 *   STRIPE_SECRET_KEY=sk_test_... node tools/stripe-teamplatz-preis-anlegen.mjs --ausfuehren
 *   STRIPE_SECRET_KEY=sk_live_... node tools/stripe-teamplatz-preis-anlegen.mjs --ausfuehren --live
 * Je Stripe-Konto einmal (Sandbox fuer Staging, Live fuer Prod, siehe Gedaechtnis „zwei Stripe-Konten“).
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TP = require(join(ROOT, 'frontend', 'js', 'teamplatz-staffel.js'));

export const PRODUKT = { name: 'DealPilot Teamplatz', dp_key: 'teamplatz',
  beschreibung: 'Weiterer Login im Partnerkonto (Berater der Kanzlei). Der Inhaber ist im Partner-Plan enthalten.' };

/** Parameter eines Preises (ohne product), rein aus der Quelle. */
export function preisParameter(intervall) {
  const iv = intervall === 'yearly' ? 'yearly' : 'monthly';
  return {
    currency: 'eur',
    lookup_key: TP.LOOKUP[iv],
    nickname: 'Teamplatz ' + (iv === 'yearly' ? 'jährlich' : 'monatlich') + ' (Staffel ' + TP.VERSION + ')',
    recurring: { interval: iv === 'yearly' ? 'year' : 'month' },
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    tiers: TP.stripeStufen(iv).map((s) => ({ up_to: s.bis == null ? 'inf' : s.bis, unit_amount: s.cent })),
    metadata: { dp_key: 'teamplatz', dp_quelle: 'frontend/js/teamplatz-staffel.js ' + TP.VERSION }
  };
}

/** Stripe-Formularkodierung (verschachtelt: tiers[0][up_to]=3). */
export function formular(obj, pre, out) {
  out = out || [];
  for (const [k, v] of Object.entries(obj)) {
    const key = pre ? pre + '[' + k + ']' : k;
    if (v == null) continue;
    if (typeof v === 'object') formular(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}

/** Stufen eines Stripe-Preises (gelesen) gegen die Quelle: true = gleich. */
export function gleicheStufen(preis, intervall) {
  const soll = preisParameter(intervall);
  const ist = (preis && preis.tiers) || [];
  if (!preis || preis.tiers_mode !== 'graduated' || preis.billing_scheme !== 'tiered' || preis.currency !== 'eur') return false;
  if (!preis.recurring || preis.recurring.interval !== soll.recurring.interval) return false;
  if (ist.length !== soll.tiers.length) return false;
  return soll.tiers.every((t, i) => {
    const up = ist[i].up_to == null ? 'inf' : ist[i].up_to;
    return String(up) === String(t.up_to) && Number(ist[i].unit_amount) === t.unit_amount && !(ist[i].flat_amount > 0);
  });
}

/** Pruefung der Sicherungen, rein. Liefert { ok, rc, grund }. */
export function sicherung({ ausfuehren, live, schluessel }) {
  if (!ausfuehren) return { ok: false, rc: 2, grund: 'Trockenlauf: ohne --ausfuehren wird nichts angelegt.' };
  const k = String(schluessel || '');
  if (!k) return { ok: false, rc: 3, grund: 'Kein Schlüssel in der Umgebung (STRIPE_SECRET_KEY).' };
  const test = /^(sk|rk)_test_/.test(k), echt = /^(sk|rk)_live_/.test(k);
  if (!live && !test) return { ok: false, rc: 3, grund: 'Ohne --live nur mit Testschlüssel (sk_test_). Abbruch, nichts angelegt.' };
  if (live && !echt) return { ok: false, rc: 3, grund: 'Mit --live nur mit Live-Schlüssel (sk_live_). Abbruch, nichts angelegt.' };
  return { ok: true, rc: 0, grund: live ? 'LIVE-Konto' : 'Testkonto' };
}

async function stripe(schluessel, methode, pfad, daten) {
  const r = await fetch('https://api.stripe.com/v1/' + pfad, {
    method: methode,
    headers: { Authorization: 'Bearer ' + schluessel, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: daten ? formular(daten) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Stripe ' + methode + ' ' + pfad.split('?')[0] + ': ' + r.status + ' ' + ((j.error && j.error.message) || ''));
  return j;
}

async function main() {
  const args = process.argv.slice(2);
  const ausfuehren = args.includes('--ausfuehren'), live = args.includes('--live');
  const varName = (args.find((a) => a.startsWith('--schluessel-var=')) || '').split('=')[1] || 'STRIPE_SECRET_KEY';
  const schluessel = process.env[varName];

  console.log('Teamplatz-Preise aus frontend/js/teamplatz-staffel.js ' + TP.VERSION);
  for (const iv of ['monthly', 'yearly']) {
    const p = preisParameter(iv);
    console.log('  ' + p.lookup_key.padEnd(20) + p.recurring.interval.padEnd(6) + p.tiers_mode + '  ' +
      p.tiers.map((t) => 'bis ' + t.up_to + ': ' + (t.unit_amount / 100) + ' EUR').join(' · '));
  }
  console.log('  Produkt: ' + PRODUKT.name + ' (metadata.dp_key = ' + PRODUKT.dp_key + ')');

  const s = sicherung({ ausfuehren, live, schluessel });
  if (!s.ok) { console.log(s.grund); process.exit(s.rc); }
  console.log('Schreibe in Stripe: ' + s.grund);

  const keys = [TP.LOOKUP.monthly, TP.LOOKUP.yearly];
  const vorhanden = await stripe(schluessel, 'GET', 'prices?active=true&limit=10&expand[]=data.tiers&' + keys.map((k) => 'lookup_keys[]=' + encodeURIComponent(k)).join('&'));
  const by = {}; for (const p of vorhanden.data || []) by[p.lookup_key] = p;
  for (const iv of ['monthly', 'yearly']) {
    const k = TP.LOOKUP[iv];
    if (by[k] && !gleicheStufen(by[k], iv)) { console.log('ABBRUCH: ' + k + ' existiert mit ANDEREN Stufen (' + by[k].id + '). Nichts angelegt.'); process.exit(4); }
  }

  let produkt = null;
  if (!by[keys[0]] || !by[keys[1]]) {
    const liste = await stripe(schluessel, 'GET', 'products?active=true&limit=100');
    produkt = (liste.data || []).find((p) => p.metadata && p.metadata.dp_key === PRODUKT.dp_key) || null;
    if (!produkt) {
      produkt = await stripe(schluessel, 'POST', 'products', { name: PRODUKT.name, description: PRODUKT.beschreibung, metadata: { dp_key: PRODUKT.dp_key } });
      console.log('  Produkt angelegt: ' + produkt.id);
    } else console.log('  Produkt vorhanden: ' + produkt.id);
  }

  for (const iv of ['monthly', 'yearly']) {
    const k = TP.LOOKUP[iv];
    if (by[k]) { console.log('  ' + k + ' schon da (' + by[k].id + '), gleiche Stufen, übersprungen'); continue; }
    const neu = await stripe(schluessel, 'POST', 'prices', Object.assign({ product: produkt.id }, preisParameter(iv)));
    console.log('  ' + k + ' angelegt: ' + neu.id);
  }

  const nach = await stripe(schluessel, 'GET', 'prices?active=true&limit=10&expand[]=data.tiers&' + keys.map((k) => 'lookup_keys[]=' + encodeURIComponent(k)).join('&'));
  const by2 = {}; for (const p of nach.data || []) by2[p.lookup_key] = p;
  let rot = 0;
  for (const iv of ['monthly', 'yearly']) {
    const ok = gleicheStufen(by2[TP.LOOKUP[iv]], iv);
    if (!ok) rot++;
    console.log('  Nachmessung ' + TP.LOOKUP[iv] + ': ' + (ok ? 'gleich der Quelle' : 'ABWEICHUNG'));
  }
  process.exit(rot ? 5 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
}
