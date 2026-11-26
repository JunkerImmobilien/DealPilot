#!/usr/bin/env node
/* stripe-hauscheck-preis-anlegen.mjs · v5130 KK6 (26.11.2026)
 *
 * Legt in Stripe den Einmalpreis des Haus-Checks an (Eigennutzer-Bericht, Marcel 26.11.2026: 9,99 €):
 *
 *   Produkt  „DealPilot Haus-Check“ (metadata.dp_key = hauscheck), wird wiederverwendet, wenn es schon da ist
 *   Preis    lookup_key dp_hauscheck_999   EUR, einmalig, 999 Cent
 *   Coupon   dp_hauscheck_anrechnung       9,99 € einmal (Anrechnung aufs Abo, Webhook legt je Kauf einen Code darauf an)
 *
 * Das Backend (services/hausCheck.js LOOKUP_KEY) findet den Preis über den lookup_key, in beiden Konten gleich.
 * Steuer ohne automatic_tax (Kleinunternehmer § 19 UStG).
 *
 * SICHERUNGEN (Live-Preis erst beim Prod-Livegang nach Marcels Abnahme):
 *   ohne --ausfuehren          Trockenlauf: zeigt, was angelegt würde, schreibt NICHTS, RC 2
 *   --ausfuehren               nur mit Testschlüssel (sk_test_ / rk_test_), sonst RC 3
 *   --ausfuehren --live        nur mit Live-Schlüssel (sk_live_ / rk_live_), sonst RC 3
 *   Schlüssel aus STRIPE_SECRET_KEY (oder --schluessel-var=NAME), wird nie ausgegeben.
 *   Gibt es den lookup_key schon: gleicher Betrag -> übersprungen, anderer Betrag -> Abbruch RC 4.
 *   Nach dem Anlegen zurückgelesen und gegen die Quelle verglichen, Abweichung RC 5.
 *
 * Aufruf im Container (der Schlüssel liegt dort schon in der Umgebung):
 *   docker cp tools/stripe-hauscheck-preis-anlegen.mjs dealpilot-backend:/app/ && docker exec dealpilot-backend node /app/stripe-hauscheck-preis-anlegen.mjs [--ausfuehren] [--live]
 * Staging = Sandbox (acct …KEjyPDo0wo), Prod = Live-Konto. Danach die Datei im Container wieder löschen.
 */
import { pathToFileURL } from 'node:url';

export const PRODUKT = { name: 'DealPilot Haus-Check', dp_key: 'hauscheck',
  beschreibung: 'Haus-Check für Eigennutzer: Haus-Score, Wert nach ImmoWertV, Beleihungswert, Umfeld und PDF für die Bank. Einmalig, ohne Abo.' };
export const PREIS = { currency: 'eur', unit_amount: 999, lookup_key: 'dp_hauscheck_999', nickname: 'Haus-Check einmalig 9,99 EUR',
  metadata: { dp_key: 'hauscheck', dp_quelle: 'tools/stripe-hauscheck-preis-anlegen.mjs v5130kk6' } };

export const COUPON = { id: 'dp_hauscheck_anrechnung', name: 'Haus-Check angerechnet', amount_off: 999, currency: 'eur', duration: 'once' };
export function couponGleich(c) { return !!c && c.amount_off === COUPON.amount_off && c.currency === COUPON.currency && c.duration === COUPON.duration && c.valid !== false; }

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
export function gleich(p) {
  return !!p && p.type === 'one_time' && p.currency === 'eur' && Number(p.unit_amount) === PREIS.unit_amount && p.active !== false;
}
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
  console.log('Haus-Check: ' + PREIS.lookup_key + ' · einmalig ' + (PREIS.unit_amount / 100).toFixed(2).replace('.', ',') + ' EUR · Produkt ' + PRODUKT.name);
  const s = sicherung({ ausfuehren, live, schluessel });
  if (!s.ok) {
    if (schluessel) {
      try {
        const da = await stripe(schluessel, 'GET', 'prices?active=true&limit=1&lookup_keys[]=' + PREIS.lookup_key);
        const konto = await stripe(schluessel, 'GET', 'account');
        console.log('  Konto ' + konto.id + (/_test_/.test(schluessel) ? ' (Test)' : ' (LIVE)') + ': ' + (da.data && da.data[0] ? 'Preis vorhanden ' + da.data[0].id + (gleich(da.data[0]) ? ', gleich' : ', ABWEICHEND') : 'Preis fehlt, würde angelegt'));
        let c = null; try { c = await stripe(schluessel, 'GET', 'coupons/' + COUPON.id); } catch (e) { c = null; }
        console.log('  Coupon ' + COUPON.id + ': ' + (c ? 'vorhanden' + (couponGleich(c) ? ', gleich' : ', ABWEICHEND') : 'fehlt, würde angelegt'));
      } catch (e) { console.log('  Lesen nicht möglich: ' + e.message); }
    }
    console.log(s.grund); process.exit(s.rc);
  }
  const konto = await stripe(schluessel, 'GET', 'account');
  console.log('Schreibe in Stripe: ' + s.grund + ' ' + konto.id);
  const vorher = await stripe(schluessel, 'GET', 'prices?active=true&limit=1&lookup_keys[]=' + PREIS.lookup_key);
  const da = vorher.data && vorher.data[0];
  if (da && !gleich(da)) { console.log('ABBRUCH: ' + PREIS.lookup_key + ' existiert mit anderem Betrag (' + da.id + '). Nichts angelegt.'); process.exit(4); }
  if (da) console.log('  schon da (' + da.id + '), gleicher Betrag, übersprungen');
  else {
    const liste = await stripe(schluessel, 'GET', 'products?active=true&limit=100');
    let produkt = (liste.data || []).find((p) => p.metadata && p.metadata.dp_key === PRODUKT.dp_key) || null;
    if (!produkt) {
      produkt = await stripe(schluessel, 'POST', 'products', { name: PRODUKT.name, description: PRODUKT.beschreibung, metadata: { dp_key: PRODUKT.dp_key } });
      console.log('  Produkt angelegt: ' + produkt.id);
    } else console.log('  Produkt vorhanden: ' + produkt.id);
    const neu = await stripe(schluessel, 'POST', 'prices', Object.assign({ product: produkt.id }, PREIS));
    console.log('  Preis angelegt: ' + neu.id);
  }
  let cp = null; try { cp = await stripe(schluessel, 'GET', 'coupons/' + COUPON.id); } catch (e) { cp = null; }
  if (cp && !couponGleich(cp)) { console.log('ABBRUCH: Coupon ' + COUPON.id + ' existiert mit anderen Werten.'); process.exit(4); }
  if (!cp) { cp = await stripe(schluessel, 'POST', 'coupons', COUPON); console.log('  Coupon angelegt: ' + cp.id); }
  else console.log('  Coupon schon da, gleich, übersprungen');
  const nach = await stripe(schluessel, 'GET', 'prices?active=true&limit=1&lookup_keys[]=' + PREIS.lookup_key);
  const cNach = await stripe(schluessel, 'GET', 'coupons/' + COUPON.id);
  const ok = gleich(nach.data && nach.data[0]) && couponGleich(cNach);
  console.log('  Nachmessung: ' + (ok ? 'Preis 999 Cent einmalig und Coupon 9,99 € einmal, gleich der Quelle' : 'ABWEICHUNG'));
  process.exit(ok ? 0 : 5);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
}
