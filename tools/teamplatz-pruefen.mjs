#!/usr/bin/env node
/* teamplatz-pruefen.mjs · v3947 (22.11.2026) — Teamplaetze mit Preis
 *
 * Marcels Entscheidung 22.11.2026: 2. bis 4. Login 59 EUR, 5. bis 9. 49 EUR, ab dem 10. 39 EUR im Monat,
 * im Jahr 649 / 539 / 429 EUR (11 Monatsbeitraege). Der Inhaber ist im Partner-Plan (99 EUR) enthalten.
 * EINE Quelle: frontend/js/teamplatz-staffel.js. Ohne Stripe, ohne Datenbank, ohne Netz.
 *
 *   A  Quelle: Stufen lueckenlos ab Login 2, Jahr = 11 Monatsbeitraege, Stripe-Form (up_to = Teamplaetze)
 *   B  Staffelrechnung 1 bis 15 Logins gegen eine HAND-Tabelle, Monat und Jahr, am Frontend-Rechner UND an
 *      partnerPlanKauf.staffelSumme(…, 'graduated') auf den Stripe-Stufen
 *   C  Webhook-Mengenabgleich nachgebaut (wie partner-seats-webhook-pruefen): echte partnerSeatsWebhook +
 *      echte partnerTeam.bezahltAbgleichen auf einer In-Memory-Tabelle
 *   D  Rahmen (kostenlos + bezahlt), Bestand, Migration 124, Einladen ohne freien Platz
 *   E  Anzeige: Landing preise.html (v3960: vier Partner-Pakete, Rueckfall) und partner.html gegen dieselben Quellen,
 *      keine Preis-Kopie in partner-pakete.js, partner-kunden.js, partner-plan-kauf.js, Kundentext ohne Gedankenstrich und Semikolon
 *   F  Stripe-Skript: Parameter aus der Quelle, Sicherungen (Trockenlauf, Testschluessel, --live), lookup_key = Backend
 *   G  Ladeweg und Buster
 *   I  Bestand zaehlt in der Staffel mit (v3947a): k kostenlose Plaetze, naechster Login zum Satz SEINER Stufe,
 *      Stripe-Menge k + b mit Coupon in Hoehe der ersten k Plaetze. Rechner = Cockpit = Stripe-Betrag
 *   H  Gegenproben: verfaelschte Quelle, Volume statt Graduated, falsche Stufe, Sicherung ohne Schluessel
 *   K  v3960 · Kundenplatz-Quelle frontend/js/kundenplatz-staffel.js: lookup_keys = partnerPlanKauf.js, Stufen = Sandbox-Messung
 *      (gelesen aus partner-seats-webhook-pruefen.mjs), staffelSumme(volume) 0 bis 120, partner.html, reseller-portal.js
 *   L  Rechenproben der vier Pakete (Solo 0, Buero 5, Kanzlei 10, Netzwerk 25 Kunden) gegen eine Hand-Tabelle, Monat und Jahr
 *   M  Jetzt buchen: Landing-Link, partner-plan-kauf.js ECHT im vm (Adresse -> Merker -> openPricingModal({period}) ->
 *      Mengen -> Kaufen-Body), ohne Teamplatz-Preis leise ohne Teamplaetze, checkoutParameter mit dritter Position,
 *      teamImCheckout, Route; Gegenproben je Regel
 * RC=0 ist sauber.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'backend', 'src');
const text = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

let fehler = 0, n = 0;
const ok = (bed, t) => { n++; if (!bed) { fehler++; console.log('  ROT  ' + t); } else console.log('  ok   ' + t); };
const kopf = (t) => console.log('-- ' + t);

const TP = require(join(ROOT, 'frontend', 'js', 'teamplatz-staffel.js'));
const tief = (o) => JSON.parse(JSON.stringify(o));

// ── Hand-Tabelle (unabhaengig von der Quelle von Hand gerechnet, Summe der TEAMPLAETZE ohne Partner-Plan) ──
//  Logins: 1 2   3    4    5    6    7    8    9    10   11   12   13   14   15
const HAND_MONAT = [0, 59, 118, 177, 226, 275, 324, 373, 422, 461, 500, 539, 578, 617, 656];
const HAND_JAHR  = [0, 649, 1298, 1947, 2486, 3025, 3564, 4103, 4642, 5071, 5500, 5929, 6358, 6787, 7216];
const HAND_SATZ_MONAT = [0, 59, 59, 59, 49, 49, 49, 49, 49, 39, 39, 39, 39, 39, 39];   // Satz des n-ten Logins
const PARTNER = { m: 99, j: 1089 };   // Partner-Plan, gelesen gegen die Landing (E)

// ══ A · Quelle ══════════════════════════════════════════════════════════════
kopf('A Quelle frontend/js/teamplatz-staffel.js ' + TP.VERSION);
function quellePruefen(Q) {
  const s = Q.STUFEN, r = [];
  r.push(s.length === 3 && s[0].von_login === 2);
  for (let i = 1; i < s.length; i++) r.push(s[i].von_login === s[i - 1].bis_login + 1);
  r.push(s[s.length - 1].bis_login == null);
  r.push(s.every((x) => x.jahr === x.monat * (12 - Q.FREIMONATE)));
  r.push(s.every((x, i) => i === 0 || x.monat < s[i - 1].monat));
  return r.every(Boolean);
}
ok(quellePruefen(TP), 'Stufen lückenlos ab Login 2, offen nach oben, je Stufe günstiger, Jahr = 11 Monatsbeiträge (ein Monat frei)');
ok(TP.STUFEN.map((s) => s.monat).join('/') === '59/49/39' && TP.STUFEN.map((s) => s.jahr).join('/') === '649/539/429',
  'Beträge = Marcels Entscheidung 22.11.2026: 59/49/39 € im Monat, 649/539/429 € im Jahr');
ok(TP.STUFEN.map((s) => s.monat - 20).join('/') === '39/29/19' && TP.STUFEN.map((s) => s.jahr - 220).join('/') === '429/319/209',
  'je 20 € (Jahr 220 €) über Vorschlag A 39/29/19 bzw. 429/319/209 € (Teamplaetze-Preisvorschlag-2026-11-19.html)');
ok(JSON.stringify(TP.stripeStufen('monthly')) === JSON.stringify([{ bis: 3, cent: 5900 }, { bis: 8, cent: 4900 }, { bis: null, cent: 3900 }]),
  'Stripe-Form Monat: bis 3 Teamplätze 5900, bis 8 4900, darüber 3900 Cent (Stufe zählt Teamplätze, nicht Logins)');
ok(JSON.stringify(TP.stripeStufen('yearly')) === JSON.stringify([{ bis: 3, cent: 64900 }, { bis: 8, cent: 53900 }, { bis: null, cent: 42900 }]),
  'Stripe-Form Jahr: 64900 / 53900 / 42900 Cent');
ok(TP.ab('monthly') === 39 && TP.ab('yearly') === 429, 'weitere Logins ab 39 € im Monat bzw. 429 € im Jahr');
ok(TP.LOOKUP.monthly === 'dp_teamplatz_monat' && TP.LOOKUP.yearly === 'dp_teamplatz_jahr', 'lookup_key dp_teamplatz_monat / dp_teamplatz_jahr');

// ══ B · Staffelrechnung 1 bis 15 Logins ═════════════════════════════════════
kopf('B Staffelrechnung gegen die Hand-Tabelle');
// Backend laden (Stubs wie partner-seats-webhook-pruefen)
const db = { resellers: new Map(), pool: [] };
async function query(sql, p = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (/^SELECT id, stripe_subscription_id FROM resellers/.test(s)) { const r = db.resellers.get(p[0]); return { rows: r ? [r] : [], rowCount: r ? 1 : 0 }; }
  if (/^UPDATE resellers SET team_plaetze_bezahlt = \$2 WHERE id = \$1 AND team_plaetze_bezahlt IS DISTINCT FROM \$2/.test(s)) {
    const r = db.resellers.get(p[0]); if (!r || r.team_plaetze_bezahlt === p[1]) return { rows: [], rowCount: 0 };
    r.team_plaetze_bezahlt = p[1]; return { rows: [{ id: r.id }], rowCount: 1 };
  }
  throw new Error('unbekanntes SQL im Pruefer: ' + s.slice(0, 90));
}
const stub = (rel, exp) => { const f = require.resolve(join(SRC, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
stub('db/pool.js', { query, pool: { query } });
stub('services/planService.js', {});
stub('services/stripeService.js', {});
const kauf = require(join(SRC, 'services', 'partnerPlanKauf.js'));
const T = require(join(SRC, 'services', 'partnerTeam.js'));
const { handlePartnerSeatsEvent } = require(join(SRC, 'services', 'partnerSeatsWebhook.js'));
const SKRIPT = await import(pathToFileURL(join(ROOT, 'tools', 'stripe-teamplatz-preis-anlegen.mjs')).href);
const stripeTiers = (iv) => SKRIPT.preisParameter(iv).tiers.map((t) => ({ up_to: t.up_to === 'inf' ? null : t.up_to, unit_amount: t.unit_amount }));

function staffelGegenHand(Q) {
  const abw = [];
  for (let l = 1; l <= 15; l++) {
    const m = Q.summeLogins(l, 'monthly'), j = Q.summeLogins(l, 'yearly');
    if (m !== HAND_MONAT[l - 1] || j !== HAND_JAHR[l - 1]) abw.push(l + ' Logins: ' + m + '/' + j + ' statt ' + HAND_MONAT[l - 1] + '/' + HAND_JAHR[l - 1]);
    if (Q.satzLogin(l, 'monthly') !== HAND_SATZ_MONAT[l - 1]) abw.push('Satz Login ' + l + ': ' + Q.satzLogin(l, 'monthly'));
  }
  return abw;
}
const abwF = staffelGegenHand(TP);
ok(!abwF.length, 'Frontend-Rechner (DpTeamplatz.summeLogins, satzLogin) = Hand-Tabelle für 1 bis 15 Logins, Monat und Jahr' + (abwF.length ? ': ' + abwF.slice(0, 3).join(' · ') : ''));
const abwB = [];
for (let l = 1; l <= 15; l++) {
  const m = kauf.staffelSumme(stripeTiers('monthly'), 'graduated', l - 1) / 100, j = kauf.staffelSumme(stripeTiers('yearly'), 'graduated', l - 1) / 100;
  if (m !== HAND_MONAT[l - 1] || j !== HAND_JAHR[l - 1]) abwB.push(l + ': ' + m + '/' + j);
}
ok(!abwB.length, 'Backend partnerPlanKauf.staffelSumme(graduated) auf den Stripe-Stufen des Skripts = Hand-Tabelle 1 bis 15' + (abwB.length ? ': ' + abwB.join(' · ') : ''));
ok([1, 2, 3, 5, 10, 15].map((l) => PARTNER.m + HAND_MONAT[l - 1]).join('/') === '99/158/217/325/560/755',
  'Kanzlei je Monat mit Partner-Plan: 1 → 99, 2 → 158, 3 → 217, 5 → 325, 10 → 560, 15 → 755 €');
ok([1, 5, 10, 15].every((l) => PARTNER.j + HAND_JAHR[l - 1] === (PARTNER.m + HAND_MONAT[l - 1]) * 11),
  'Jahr = 11 × Monat auch mit Partner-Plan (1.089 €), z. B. 10 Logins 6.160 € statt 6.720 €');
ok(TP.summeAusStufen([{ bis: 3, cent: 5900, pauschal: 0 }, { bis: 8, cent: 4900, pauschal: 0 }, { bis: null, cent: 3900, pauschal: 0 }], 9) === 46100 && TP.summeAusStufen(TP.stripeStufen('monthly'), 0) === 0,
  'summeAusStufen mit Stufen in der Form von GET /partner/team/preis (bis, cent, pauschal): 9 Teamplätze 3 × 59 + 5 × 49 + 39 = 461 €, 0 → 0');

// ══ C · Webhook-Mengenabgleich ══════════════════════════════════════════════
kopf('C Webhook gleicht die Teamplätze ab (nachgebaut, echte partnerSeatsWebhook + partnerTeam.bezahltAbgleichen)');
const abos = new Map();
const poolAufrufe = [];
const deps = {
  query,
  /* wie die echte syncPoolQuantity: setzt die Abo-ID am Reseller (danach wird ein fremdes Abo erkannt) */
  syncPoolQuantity: async (rid, menge, o) => { poolAufrufe.push([rid, menge]); if (o && o.stripeSubscriptionId) db.resellers.get(rid).stripe_subscription_id = o.stripeSubscriptionId; return { gekauft: menge }; },
  getSubscription: async (id) => abos.get(id),
  aboEnde: async () => ({ kunden: 0 }),
  teamAbgleichen: (rid, menge) => T.bezahltAbgleichen(rid, menge)
};
const pos = (id, key, qty, iv) => ({ id, quantity: qty, price: { id: 'price_' + key, lookup_key: key, recurring: { interval: iv } } });
const ppAbo = (id, rid, { seat = 0, team = 0, status = 'active', iv = 'month', extra = {} } = {}) => ({
  id, object: 'subscription', status, cancel_at_period_end: false, ...extra, current_period_end: 1800000000,
  metadata: { kind: 'partner_plan', reseller_id: rid, userId: 'u-' + rid },
  items: { data: [pos('si_plan_' + id, iv === 'year' ? 'dp_plan_partner_yearly' : 'dp_plan_partner_monthly', 1, iv)]
    .concat(seat > 0 ? [pos('si_seat_' + id, iv === 'year' ? 'dp_seat_yearly' : 'dp_seat_monthly', seat, iv)] : [])
    .concat(team > 0 ? [pos('si_team_' + id, iv === 'year' ? 'dp_teamplatz_jahr' : 'dp_teamplatz_monat', team, iv)] : []) } });
const ev = (type, object) => ({ id: 'evt_' + Math.random().toString(36).slice(2), type, data: { object } });
const bezahlt = (rid) => db.resellers.get(rid).team_plaetze_bezahlt;

db.resellers.set('k1', { id: 'k1', stripe_subscription_id: null, team_plaetze: 0, team_plaetze_bezahlt: 0 });
abos.set('sub_K', ppAbo('sub_K', 'k1', { seat: 4, team: 2 }));
const sessK = { id: 'cs_K', object: 'checkout.session', mode: 'subscription', subscription: 'sub_K', metadata: { kind: 'partner_plan', reseller_id: 'k1', userId: 'u-k1' } };
let r = await handlePartnerSeatsEvent(ev('checkout.session.completed', sessK), deps);
ok(r.handled && r.weiter && r.menge === 4 && r.team && r.team.menge === 2 && bezahlt('k1') === 2, 'Checkout mit 4 Kundenplätzen und 2 Teamplätzen: Pool 4, Teamplätze 2 (je Position ihre Menge)');
r = await handlePartnerSeatsEvent(ev('checkout.session.completed', sessK), deps);
ok(bezahlt('k1') === 2 && r.team && r.team.geaendert === false, 'doppelt zugestellt: 2, nichts geändert (idempotent)');
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_K', 'k1', { seat: 4, team: 5 })), deps);
ok(bezahlt('k1') === 5 && r.menge === 4, 'Menge 2 → 5 (Cockpit oder Kundenportal): 5, Kundenplätze unberührt');
await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_K', 'k1', { seat: 4, team: 5, status: 'past_due' })), deps);
ok(bezahlt('k1') === 5, 'past_due: Teamplätze bleiben');
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_K', 'k1', { seat: 4, team: 9, status: 'incomplete' })), deps);
ok(r.aktion === 'uebersprungen' && bezahlt('k1') === 5, 'incomplete (noch nicht bezahlt): übersprungen, bleibt 5');
await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_K', 'k1', { seat: 4, team: 5, extra: { cancel_at_period_end: true } })), deps);
ok(bezahlt('k1') === 5, 'gekündigt zum Laufzeitende: Teamplätze bleiben bis zum Ende');
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_FREMD', 'k1', { team: 20 })), deps);
ok(r.grund === 'anderes_abo' && bezahlt('k1') === 5, 'fremdes Abo: übersprungen, bleibt 5');
await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_K', 'k1', { seat: 4 })), deps);
ok(bezahlt('k1') === 0, 'Teamplatz-Position entfernt (Plan läuft weiter): 0');
await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_K', 'k1', { seat: 4, team: 3, iv: 'year' })), deps);
ok(bezahlt('k1') === 3, 'jährliches Abo mit dp_teamplatz_jahr: 3');
r = await handlePartnerSeatsEvent(ev('customer.subscription.deleted', ppAbo('sub_K', 'k1', { seat: 4, team: 3, status: 'canceled' })), deps);
ok(bezahlt('k1') === 0 && r.team && r.team.menge === 0, 'Abo endet (deleted): 0 bezahlte Teamplätze');
db.resellers.set('k2', { id: 'k2', stripe_subscription_id: null, team_plaetze: 5, team_plaetze_bezahlt: 0 });
const altSeat = { id: 'sub_S', object: 'subscription', status: 'active', metadata: { kind: 'partner_seats', reseller_id: 'k2' }, current_period_end: 1800000000,
  items: { data: [{ id: 'si_s', quantity: 6, price: { recurring: { interval: 'month' } } }] } };
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', altSeat), deps);
ok(r.handled && r.team === undefined && bezahlt('k2') === 0 && db.resellers.get('k2').team_plaetze === 5, 'altes Platz-Abo (partner_seats): Teamplätze unberührt, Bestand 5 bleibt');
const depsAlt = { ...deps }; delete depsAlt.teamAbgleichen;
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_K', 'k1', { seat: 2, team: 7 })), depsAlt);
ok(r.handled && r.team === undefined && bezahlt('k1') === 0, 'ohne deps.teamAbgleichen (ältere Prüfer): kein Abgleich, kein Absturz');
const dreiPos = ppAbo('x', 'k1', { seat: 6, team: 4 });
ok(kauf.seatPosition(dreiPos).quantity === 6 && kauf.teamMenge(dreiPos) === 4 && kauf.planPosition(dreiPos).quantity === 1,
  'drei Positionen: Platz über dp_seat_*, Team über dp_teamplatz_*, Plan über dp_plan_* (keine verwechselt die andere)');
ok(kauf.aboIntervall(ppAbo('y', 'k1', { team: 1, iv: 'year' })) === 'yearly' && kauf.teamMenge(ppAbo('z', 'k1', {})) === 0, 'Intervall aus der Plan-Position, ohne Team-Position Menge 0');

// ══ D · Rahmen, Bestand, Migration ══════════════════════════════════════════
kopf('D Rahmen kostenlos + bezahlt, Bestand, Migration 124');
const R = T.teamRahmen;
let x = R({ team_plaetze: 5, team_plaetze_bezahlt: 0 }, 2, 1);
ok(x.plaetze === 5 && x.frei === 2 && x.mindest_bezahlt === 0 && x.kostenlos === 5, 'Altkunde mit Bestand 5, 2 Berater + 1 Einladung: 2 frei, nichts zu bezahlen');
x = R({ team_plaetze: 0, team_plaetze_bezahlt: 0 }, 0, 0);
ok(x.plaetze === 0 && x.frei === 0, 'neues Partnerkonto: 0 Teamplätze, der erste Berater braucht einen gebuchten Platz (Grenze 5 entfällt)');
x = R({ team_plaetze: 0, team_plaetze_bezahlt: 12 }, 11, 0);
ok(x.plaetze === 12 && x.frei === 1 && x.mindest_bezahlt === 11, '12 gebucht, 11 Berater: 1 frei, weniger als 11 nicht möglich (keine Obergrenze 5)');
x = R({ team_plaetze: 1, team_plaetze_bezahlt: 1 }, 4, 0);
ok(x.frei === 0 && x.ueberbelegt === 2 && x.mindest_bezahlt === 3, 'Menge unter die Belegung gesenkt: überbelegt 2, niemand fliegt raus, Einladen gesperrt');
x = R({ team_plaetze: null, team_plaetze_bezahlt: 'x' }, -1, undefined);
ok(x.plaetze === 0 && x.belegt === 0 && x.frei === 0, 'fehlende oder kaputte Werte zählen 0 (keine stille Vorgabe 5 mehr)');
const qT = text('backend/src/services/partnerTeam.js');
ok(/if \(t\.frei <= 0\) throw fehler\('team_voll', 409, [^\n]*teamplatz_buchen: true/.test(qT), 'Einladen ohne freien Platz: 409 team_voll mit teamplatz_buchen (Cockpit bucht dann einen Platz dazu)');
ok(!/team_plaetze\)\) \? Number\(rs\.team_plaetze\) : 5/.test(qT) && /Object\.assign\(\{ mitglieder, einladungen \}, teamRahmen\(rs, berater, einladungen\.length\)\)/.test(qT),
  'team() rechnet den Rahmen nur über teamRahmen(), die Rückfallzahl 5 ist weg');
ok(/m\.team_bestand/.test(qT), 'Mitgliederliste führt team_bestand (Chip „Bestand“ im Cockpit)');
const m124 = text('backend/migrations/124_teamplaetze_abrechnung.sql');
ok(/ADD COLUMN IF NOT EXISTS team_plaetze_bezahlt integer NOT NULL DEFAULT 0/.test(m124) && /ALTER COLUMN team_plaetze SET DEFAULT 0/.test(m124)
   && /ADD COLUMN IF NOT EXISTS team_bestand boolean NOT NULL DEFAULT false/.test(m124) && /SET team_bestand = true WHERE role = 'berater'/.test(m124),
  'Migration 124: bezahlt-Spalte, neue Konten 0 kostenlos, Berater von heute als Bestand markiert');
ok(!/UPDATE public\.resellers SET team_plaetze\b/.test(m124), 'Migration 124 ändert die kostenlosen Plätze der Altkunden NICHT (nicht automatisch berechnen, Übergang offen)');
const qK = text('backend/src/services/partnerPlanKauf.js');
ok(/if \(ziel < team\.mindest_bezahlt\) throw fehler\('unter_belegung'/.test(qK) && /proration_behavior: proration\(alt, ziel\)/.test(qK.slice(qK.indexOf('async function teamplaetzeAendern'))),
  'teamplaetzeAendern: Untergrenze = mindest_bezahlt, Proration wie die Kundenplätze');
ok(/const optional = \[TEAM_LOOKUP\.monthly, TEAM_LOOKUP\.yearly\]/.test(qK) && /const fehlt = keys\.filter/.test(qK),
  'fehlt der Teamplatz-Preis in Stripe, bleibt der Partner-Kauf möglich (optional, nicht in keys)');
const qR = text('backend/src/routes/partnerKunden.js');
ok(/partner\.post\('\/team\/plaetze', fn\(async \(req\) => \{\s*T\.nurInhaber\(req\.partnerRolle\);/.test(qR) && /partner\.get\('\/team\/preis'/.test(qR), 'Routen: GET /partner/team/preis (alle), POST /partner/team/plaetze nur Inhaber');

// ══ E · Anzeige gegen dieselbe Quelle ═══════════════════════════════════════
kopf('E Landing und App gegen dieselbe Quelle (v3960: vier Pakete auf preise.html)');
const K = require(join(ROOT, 'frontend', 'js', 'kundenplatz-staffel.js'));
const preise = text('frontend/landing/preise.html'), partnerHtml = text('frontend/landing/partner.html');
function eurText(v) { const r = Math.round(v * 100) / 100; return r.toLocaleString('de-DE', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
/** Partner-Block der Landing: von #partner-plan bis zu den sechs Kacheln (.pe) */
function teamBlock(html) { const a = html.indexOf('id="partner-plan"'); if (a < 0) return ''; const b = html.indexOf('<div class="pe rv">', a); return html.slice(a, b < 0 ? a + 12000 : b); }
/* Marcels Entscheidung 22.11.2026: Variante C, vorbelegt mit 0 / 5 / 10 / 25 Kundenplaetzen; Logins wie in der Demo 1 / 2 / 3 / 8 */
const PAKETE_SOLL = [['Solo', 0, 1], ['Büro', 5, 2], ['Kanzlei', 10, 3], ['Netzwerk', 25, 8]];
function teileText(Q, n) {
  const st = Q.stripeStufen('monthly'); let rest = n, unten = 0; const teile = [];
  for (const s of st) { if (rest <= 0) break; const k = Math.max(0, Math.min(rest, (s.bis == null ? Infinity : s.bis) - unten)); if (k) teile.push(k + ' × ' + eurText(s.cent / 100)); rest -= k; unten = s.bis == null ? Infinity : s.bis; }
  return teile.join(' + ');
}
function karten(html) {
  const blk = teamBlock(html);
  return [...blk.matchAll(/<div class="tk ppk[^"]*" data-paket="([^"]+)" data-kunden="(\d+)" data-logins="(\d+)">([\s\S]*?)<div class="tk-rip">/g)]
    .map((m) => ({ paket: m[1], kunden: +m[2], logins: +m[3], inhalt: m[4] }));
}
/** Vergleicht den Landing-Rueckfall (monatlich, Vorbelegung) mit den Quellen Kq (Kundenplatz) und Q (Teamplatz). */
function landingGegenQuelle(html, Q, Kq = K) {
  const abw = [], blk = teamBlock(html);
  if (!blk) return ['Block #partner-plan fehlt'];
  if (!/id="teamplaetze"/.test(blk)) abw.push('Anker #teamplaetze fehlt im Partner-Block');
  const ks = karten(html);
  if (ks.length !== 4) abw.push('Zahl der Paketkarten ' + ks.length);
  ks.forEach((k, i) => {
    const soll = PAKETE_SOLL[i] || [];
    const name = (/<div class="tk-name">([^<]+)</.exec(k.inhalt) || [])[1];
    if (name !== soll[0] || k.kunden !== soll[1] || k.logins !== soll[2]) abw.push('Paket ' + i + ' ' + name + ' ' + k.kunden + '/' + k.logins);
    const tp = k.logins - 1, plan = Kq.plan('monthly'), ksum = Kq.summe(k.kunden, 'monthly'), team = Q.teamSumme(tp, 'monthly'), g = plan + ksum + team;
    const gesamt = (/data-o="gesamt">([^<]+)</.exec(k.inhalt) || [])[1];
    if (gesamt !== eurText(g).replace(' €', '')) abw.push(name + ' gesamt ' + gesamt + ' statt ' + eurText(g));
    if (!/<span class="per">\/ Monat<\/span>/.test(k.inhalt)) abw.push(name + ' Einheit');
    const schnitt = (/data-o="schnitt">([^<]+)</.exec(k.inhalt) || [])[1];
    const schnittSoll = k.kunden ? 'im Schnitt ' + eurText(g / k.kunden) + ' je Kunde' : 'ohne Kundenplätze';
    if (schnitt !== schnittSoll) abw.push(name + ' Schnitt ' + schnitt);
    const zeilen = [...(/data-o="rechnung">([\s\S]*?)<div class="ppk-fuell">/.exec(k.inhalt) || ['', ''])[1].matchAll(/<div><span>([\s\S]*?)<\/span><b>([^<]+)<\/b><\/div>/g)]
      .map((m) => [m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), m[2]]);
    const zSoll = [['Partner-Plan du als Inhaber', eurText(plan)],
      [k.kunden + (k.kunden === 1 ? ' Kundenplatz ' : ' Kundenplätze ') + (k.kunden ? k.kunden + ' × ' + eurText(Kq.satz(k.kunden, 'monthly')) : 'nach Bedarf dazu'), eurText(ksum)],
      [(tp ? tp + (tp === 1 ? ' Teamplatz ' : ' Teamplätze ') + teileText(Q, tp) : 'Kein Teamplatz nur du'), eurText(team)]];
    if (JSON.stringify(zeilen) !== JSON.stringify(zSoll)) abw.push(name + ' Rechnung ' + JSON.stringify(zeilen) + ' statt ' + JSON.stringify(zSoll));
    const href = (/data-o="buchen" href="([^"]+)"/.exec(k.inhalt) || [])[1];
    if (href !== 'https://app.dealpilot.immo/?register=1&amp;partner_kauf=1&amp;intervall=monthly&amp;kundenplaetze=' + k.kunden + '&amp;teamplaetze=' + tp) abw.push(name + ' Buchungslink ' + href);
    const inp = [...k.inhalt.matchAll(/value="(\d+)" inputmode="numeric" data-k="(kunden|logins)"/g)].map((m) => m[2] + '=' + m[1]).join(',');
    if (inp !== 'kunden=' + k.kunden + ',logins=' + k.logins) abw.push(name + ' Mengenwahl ' + inp);
  });
  const st = (/data-o="staffel">([^<]+)</.exec(blk) || [])[1];
  const vor = (n) => /^ab /.test(n) ? n : 'für ' + (/Login$/.test(n) ? 'den ' : '') + n;
  const stSoll = 'Kundenplatz ' + Kq.STUFEN.map((s) => eurText(s.monat) + ' ' + vor(Kq.stufenName(s))).join(', ') + ', alle Plätze zum Satz der erreichten Stufe. Teamplatz ' +
    Q.STUFEN.map((s) => eurText(s.monat) + ' ' + vor(Q.stufenName(s))).join(', ') + ', jeder zum Satz seiner Stufe. Preise je Monat.';
  if (st !== stSoll) abw.push('Staffelzeile ' + st + ' statt ' + stSoll);
  return abw;
}
const abwL = landingGegenQuelle(preise, TP);
ok(!abwL.length, 'preise.html Partner-Pakete: vier Karten (Solo 0, Büro 5, Kanzlei 10, Netzwerk 25), Gesamt, Schnitt, Rechnung, Mengenwahl, Buchungslink und Staffelzeile = Quellen' + (abwL.length ? ': ' + abwL.join(' · ') : ''));
ok(K.plan('monthly') === PARTNER.m && K.plan('yearly') === PARTNER.j, 'Partner-Plan in der Quelle 99 € / 1.089 € (die Landing liest ihn dort, keine Kopie)');
ok(!/class="pcard|data-team-rechner|data-team-stufen|class="pstaffel/.test(teamBlock(preise)) && (preise.match(/id="teamplaetze"/g) || []).length === 1 && (preise.match(/id="partner-plan"/g) || []).length === 1,
  'alter Partnerblock (Karte, Mandanten-Staffel, Teamplatz-Rechner) ist ersetzt, #partner-plan und #teamplaetze je genau einmal');
ok(/<li data-team-ab>[^<]*ab 39 € im Monat/.test(partnerHtml) && /href="preise\.html#teamplaetze"/.test(partnerHtml) && TP.ab('monthly') === 39,
  'partner.html: „weitere Logins ab 39 € im Monat“ = DpTeamplatz.ab, Link auf preise.html#teamplaetze (landet auf den Paketen)');
const rechnerJs = text('frontend/landing/partner-pakete.js');
const PREISZAHL = /\b(59|49|39|649|539|429|99|1\.?089|19|15|12|209|165|132)\s*(€|EUR|\\u20ac)/;
const ohneKommentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!PREISZAHL.test(ohneKommentar(rechnerJs)) && !/\b(5900|4900|3900|1900|1500|1200|9900)\b/.test(rechnerJs) && !/data-kunden="\d|kunden:\s*\d/.test(rechnerJs),
  'partner-pakete.js trägt keine Preiszahl und keine Vorbelegung (liest Quellen und data-kunden/data-logins)');
const pk = text('frontend/js/partner-kunden.js');
const pkTeam = pk.slice(pk.indexOf('v3947 · Teamplaetze mit Preis'), pk.indexOf('/* Eingeladene Seite: Band und Fenster'));
ok(pkTeam.length > 2000 && !PREISZAHL.test(ohneKommentar(pkTeam)) && /summeBezahlt\(a\.stufen, a\.bestand \|\| 0, n\)/.test(pkTeam) && /api\('\/partner\/team\/preis'\)/.test(pkTeam),
  'Cockpit: keine Preiszahl im Code, Beträge aus GET /partner/team/preis (Stripe-Stufen), Summe über DpTeamplatz.summeBezahlt mit Bestand');
ok(/nx\.satz_cent/.test(pkTeam) && /nx\.summe_cent/.test(pkTeam) && /'Platz buchen und einladen'/.test(pkTeam) && /anzahl: a\.bezahlt_abo \+ 1/.test(pkTeam),
  'Cockpit: vor dem Bestätigen Satz des nächsten Platzes und neue Summe, dann Platz buchen (+1) und einladen');
const ppk = text('frontend/js/partner-plan-kauf.js');
ok(/TP\.ab\(iv\)/.test(ppk) && /teamZeile\(iv\)/.test(ppk) && !/Logins für dein Team ab \d/.test(ppk) && !PREISZAHL.test(ohneKommentar(ppk)),
  'Preisfenster: „weitere Logins ab …“ aus DpTeamplatz.ab, keine Preiszahl im Code');
/* Kundentext: sichtbarer Text ohne Gedankenstrich und Semikolon */
const sichtbar = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ');   /* v3960 · &amp; ist kein Semikolon im Text */
const blkText = sichtbar(teamBlock(preise)) + ' ' + sichtbar((/<li data-team-ab>[\s\S]*?<\/li>/.exec(partnerHtml) || [''])[0]);
ok(!/[–—;]/.test(blkText), 'Landing-Text der Partner-Pakete ohne Gedankenstrich und Semikolon');
const strings = (src) => [...ohneKommentar(src).matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((s) => !/^[#.][\w-]/.test(s) && !/[{}]/.test(s) && /[a-zäöü]{3}/i.test(s));
const kt = strings(pkTeam).concat(strings(rechnerJs)).concat(strings(ppk.slice(ppk.indexOf('function teamZeile'), ppk.indexOf('function einhaengen'))));
const kaputt = kt.filter((s) => /[–—;]/.test(s.replace(/style="[^"]*"/g, '').replace(/&[a-z#0-9]+;/g, '')));
ok(!kaputt.length, 'Kundentext in Cockpit, Paketen und Preisfenster ohne Gedankenstrich und Semikolon (' + kt.length + ' Texte)' + (kaputt.length ? ': ' + kaputt.slice(0, 2).join(' | ') : ''));

// ══ F · Stripe-Skript ═══════════════════════════════════════════════════════
kopf('F tools/stripe-teamplatz-preis-anlegen.mjs');
for (const iv of ['monthly', 'yearly']) {
  const p = SKRIPT.preisParameter(iv);
  ok(p.tiers_mode === 'graduated' && p.billing_scheme === 'tiered' && p.currency === 'eur' && p.recurring.interval === (iv === 'yearly' ? 'year' : 'month')
     && JSON.stringify(p.tiers) === JSON.stringify(TP.stripeStufen(iv).map((s) => ({ up_to: s.bis == null ? 'inf' : s.bis, unit_amount: s.cent }))) && p.lookup_key === TP.LOOKUP[iv],
    'Preis ' + iv + ': graduated, EUR, ' + p.recurring.interval + ', Stufen und lookup_key ' + p.lookup_key + ' aus der Quelle');
}
ok(kauf.TEAM_LOOKUP.monthly === TP.LOOKUP.monthly && kauf.TEAM_LOOKUP.yearly === TP.LOOKUP.yearly, 'Backend findet den Preis über denselben lookup_key (partnerPlanKauf.TEAM_LOOKUP = DpTeamplatz.LOOKUP)');
const form = SKRIPT.formular(SKRIPT.preisParameter('monthly'));
ok(/tiers%5B2%5D%5Bup_to%5D=inf/.test(form) && /tiers%5B0%5D%5Bunit_amount%5D=5900/.test(form) && /recurring%5Binterval%5D=month/.test(form), 'Formularkodierung: tiers[0][unit_amount]=5900, tiers[2][up_to]=inf, recurring[interval]=month');
const gelesen = (iv, tiers, mode = 'graduated') => ({ currency: 'eur', billing_scheme: 'tiered', tiers_mode: mode, recurring: { interval: iv === 'yearly' ? 'year' : 'month' },
  tiers: tiers.map((t) => ({ up_to: t.up_to === 'inf' ? null : t.up_to, unit_amount: t.unit_amount, flat_amount: null })) });
ok(SKRIPT.gleicheStufen(gelesen('monthly', SKRIPT.preisParameter('monthly').tiers), 'monthly') && SKRIPT.gleicheStufen(gelesen('yearly', SKRIPT.preisParameter('yearly').tiers), 'yearly'),
  'Nachmessung: ein gelesener Stripe-Preis mit den Quellstufen gilt als gleich (up_to null = inf)');
const S1 = SKRIPT.sicherung;
ok(S1({ ausfuehren: false, schluessel: 'sk_test_x' }).rc === 2 && S1({ ausfuehren: true }).rc === 3 && S1({ ausfuehren: true, schluessel: 'sk_live_x' }).rc === 3
   && S1({ ausfuehren: true, live: true, schluessel: 'sk_test_x' }).rc === 3 && S1({ ausfuehren: true, schluessel: 'sk_test_x' }).ok && S1({ ausfuehren: true, live: true, schluessel: 'sk_live_x' }).ok,
  'Sicherungen: ohne --ausfuehren RC 2, ohne Schlüssel RC 3, Live-Schlüssel ohne --live RC 3, --live mit Testschlüssel RC 3')
const lauf = (args, key) => spawnSync(process.execPath, [join(ROOT, 'tools', 'stripe-teamplatz-preis-anlegen.mjs'), ...args],
  { env: { ...process.env, STRIPE_SECRET_KEY: key || '' }, encoding: 'utf8', timeout: 20000 });
const l1 = lauf([], 'sk_test_x'), l2 = lauf(['--ausfuehren'], 'sk_live_x'), l3 = lauf(['--ausfuehren', '--live'], 'sk_test_x'), l4 = lauf(['--ausfuehren'], '');
ok(l1.status === 2 && /Trockenlauf/.test(l1.stdout) && /dp_teamplatz_monat/.test(l1.stdout), 'echter Lauf ohne --ausfuehren: RC 2, zeigt nur, was angelegt würde');
ok(l2.status === 3 && l3.status === 3 && l4.status === 3 && !/sk_live_x|sk_test_x/.test(l2.stdout + l3.stdout), 'echte Läufe mit falschem oder fehlendem Schlüssel: RC 3, kein Netz, Schlüssel nie ausgegeben');

// ══ G · Ladeweg und Buster ══════════════════════════════════════════════════
kopf('G Ladeweg und Buster');
const idx = text('frontend/index.html');
const buster = (t, datei) => (new RegExp('js\\/' + datei.replace('.', '\\.') + '\\?v=([\\w.-]+)').exec(t) || [])[1];
for (const d of ['teamplatz-staffel.js', 'kundenplatz-staffel.js']) {
  const bIdx = buster(idx, d), bRech = buster(rechnerJs, d);
  ok(bIdx && bIdx === bRech, d + ': gleicher Buster in index.html und partner-pakete.js (' + bIdx + ' / ' + bRech + ')');
}
ok(idx.indexOf('js/teamplatz-staffel.js') < idx.indexOf('js/partner-plan-kauf.js') && idx.indexOf('js/kundenplatz-staffel.js') < idx.indexOf('js/partner-plan-kauf.js')
   && idx.indexOf('js/teamplatz-staffel.js') < idx.indexOf('js/partner-kunden.js'),
  'index.html lädt beide Quellen vor Preisfenster und Cockpit');
ok(/<script src="partner-pakete\.js\?v=[\w.-]+"><\/script>/.test(preise) && /<link rel="stylesheet" href="partner-pakete\.css\?v=[\w.-]+">/.test(preise) && !/teamplatz-rechner\.js/.test(preise),
  'preise.html lädt partner-pakete.js und partner-pakete.css, teamplatz-rechner.js nicht mehr');
ok(/frontend\/landing\/partner-pakete\.js/.test(text('tools/buster-ebenen-pruefen.mjs')), 'buster-ebenen-pruefen.mjs kennt partner-pakete.js als Dokument');

// ══ H · Gegenproben ═════════════════════════════════════════════════════════
kopf('H Gegenproben (der Prüfer muss rot werden, wenn es falsch ist)');
function quelleMit(fn) {
  const st = tief(TP.STUFEN); fn(st);
  const f = new Function('module', readFileSync(join(ROOT, 'frontend', 'js', 'teamplatz-staffel.js'), 'utf8').replace(/var STUFEN = \[[\s\S]*?\];/, 'var STUFEN = ' + JSON.stringify(st) + ';'));
  const m = { exports: {} }; f(m); return m.exports;
}
const Q60 = quelleMit((st) => { st[0].monat = 60; st[0].jahr = 660; });
ok(staffelGegenHand(Q60).length > 0, 'Quelle 60 statt 59 €: Hand-Tabelle wird rot');
ok(landingGegenQuelle(preise, Q60).length > 0, 'Quelle 60 statt 59 €: Landing-Rückfall wird rot (keine stille Kopie)');
const Qjahr = quelleMit((st) => { st[1].jahr = 588; });
ok(!quellePruefen(Qjahr), 'Jahr 12 statt 11 Monatsbeiträge: Quellprüfung wird rot');
const Qluecke = quelleMit((st) => { st[1].von_login = 6; });
ok(!quellePruefen(Qluecke), 'Lücke zwischen den Stufen: Quellprüfung wird rot');
const tM = stripeTiers('monthly');
ok(kauf.staffelSumme(tM, 'volume', 9) / 100 !== HAND_MONAT[9] && kauf.staffelSumme(tM, 'volume', 9) / 100 === 351, 'Volume statt Graduated: 10 Logins 351 statt 461 € (die Form ist prüfbar)');
const falsch = SKRIPT.preisParameter('monthly').tiers.map((t, i) => i === 1 ? { ...t, unit_amount: 4800 } : t);
ok(!SKRIPT.gleicheStufen(gelesen('monthly', falsch), 'monthly') && !SKRIPT.gleicheStufen(gelesen('monthly', SKRIPT.preisParameter('monthly').tiers, 'volume'), 'monthly')
   && !SKRIPT.gleicheStufen(gelesen('yearly', SKRIPT.preisParameter('monthly').tiers), 'monthly'),
  'Nachmessung erkennt falsche Stufe, volume und falsches Intervall');
const landKaputt0 = preise.replace('data-o="gesamt">253<', 'data-o="gesamt">252<');
ok(landKaputt0 !== preise && landingGegenQuelle(landKaputt0, TP).length > 0, 'Landing Büro 252 statt 253 €: rot');
const landStrich = sichtbar(teamBlock(preise.replace('Vier Größen.', 'Vier Größen –')));
ok(/[–—;]/.test(landStrich), 'Gedankenstrich im Landing-Text würde gefunden');

// ══ I · Bestand zaehlt in der Staffel mit ═══════════════════════════════════
kopf('I Bestand zählt mit (v3947a): nächster Login zum Satz seiner Stufe, Rechner = Cockpit = Stripe');
const TB = require(join(SRC, 'services', 'teamplatzBestand.js'));
// Hand: [Bestand k, bezahlt b, Login-Nr des naechsten, Satz Monat, Satz Jahr, Summe der b bezahlten im Monat]
const HAND_BESTAND = [
  [0, 0, 2, 59, 649, 0], [0, 3, 5, 49, 539, 177], [0, 8, 10, 39, 429, 422],
  [3, 0, 5, 49, 539, 0], [3, 4, 9, 49, 539, 196], [3, 5, 10, 39, 429, 245], [3, 6, 11, 39, 429, 284],
  [5, 0, 7, 49, 539, 0], [5, 2, 9, 49, 539, 98], [5, 3, 10, 39, 429, 147], [5, 7, 14, 39, 429, 303]
];
const tiersM = stripeTiers('monthly'), tiersJ = stripeTiers('yearly');
function bestandGegenHand(Q, TBx) {
  const abw = [];
  for (const [k, b, login, sm, sj, summe] of HAND_BESTAND) {
    if (1 + k + b + 1 !== login) abw.push('Login ' + k + '/' + b);
    if (Q.satzNaechster(k, b, 'monthly') !== sm || Q.satzNaechster(k, b, 'yearly') !== sj) abw.push('Rechner ' + k + '/' + b + ': ' + Q.satzNaechster(k, b, 'monthly'));
    if (Q.summeBezahlt(Q.stripeStufen('monthly'), k, b) !== summe * 100) abw.push('Summe Frontend ' + k + '/' + b);
    if (TBx.summeBezahlt(tiersM, k, b) !== summe * 100 || TBx.summeBezahlt(tiersM, k, b + 1) - TBx.summeBezahlt(tiersM, k, b) !== sm * 100) abw.push('Backend ' + k + '/' + b);
    /* Stripe: Menge k + b auf der Staffel, Coupon = Kosten der ersten k Plaetze */
    const c = TBx.couponParameter(k, 'monthly', { tiers: tiersM, product: 'prod_X' });
    const stripeBetrag = TBx.staffel(tiersM, TBx.positionFelder(k, b, c && c.id).quantity) - (c ? c.amount_off : 0);
    if (stripeBetrag !== summe * 100) abw.push('Stripe ' + k + '/' + b + ': ' + stripeBetrag);
  }
  return abw;
}
const abwBe = bestandGegenHand(TP, TB);
ok(!abwBe.length, 'Bestand 0, 3 und 5: nächster Login, Satz Monat/Jahr, Summe der bezahlten, Stripe-Betrag (Menge k + b minus Coupon) = Hand-Tabelle, 11 Fälle' + (abwBe.length ? ': ' + abwBe.slice(0, 3).join(' · ') : ''));
ok([3, 5].every((k) => TP.satzNaechster(k, 0, 'monthly') === 49) && TP.satzNaechster(0, 0, 'monthly') === 59,
  'Altkunde mit 3 oder 5 kostenlosen Plätzen zahlt für den nächsten Login 49 €, nicht 59 € (Marcel 22.11.2026)');
let gleichFB = true;
for (let k = 0; k <= 6; k++) for (let b = 0; b <= 12; b++) for (const iv of ['monthly', 'yearly']) {
  if (TP.summeBezahlt(TP.stripeStufen(iv), k, b) !== TB.summeBezahlt(iv === 'yearly' ? tiersJ : tiersM, k, b)) gleichFB = false;
}
ok(gleichFB, 'Frontend summeBezahlt = Backend teamplatzBestand.summeBezahlt für Bestand 0 bis 6, bezahlt 0 bis 12, Monat und Jahr');
const c3 = TB.couponParameter(3, 'monthly', { tiers: tiersM, product: 'prod_X' }), c5 = TB.couponParameter(5, 'yearly', { tiers: tiersJ, product: { id: 'prod_Y' } });
ok(TB.couponParameter(0, 'monthly', { tiers: tiersM, product: 'prod_X' }) === null && c3.amount_off === 17700 && c3.id === 'dp_teamplatz_bestand_monthly_3_17700'
   && c3.duration === 'forever' && c3.currency === 'eur' && c3.applies_to.products[0] === 'prod_X' && c5.amount_off === 302500 && c5.applies_to.products[0] === 'prod_Y',
  'Coupon: Bestand 0 keiner, 3 im Monat 177 €, 5 im Jahr 3.025 €, für immer, nur auf das Teamplatz-Produkt, Betrag in der ID');
const pf = TB.positionFelder(5, 3, 'c5'), p0 = TB.positionFelder(0, 2, null);
ok(pf.quantity === 8 && pf.metadata.bestand === '5' && pf.discounts[0].coupon === 'c5' && p0.quantity === 2 && p0.discounts === '' && p0.metadata.bestand === '0',
  'Position: Menge Bestand + bezahlt, metadata.bestand, Rabatt nur mit Bestand (ohne: Feld geleert)');
ok(TB.bezahltAusPosition({ quantity: 8, metadata: { bestand: '5' } }) === 3 && TB.bezahltAusPosition({ quantity: 2 }) === 2 && TB.bezahltAusPosition({ quantity: 1, metadata: { bestand: '5' } }) === 0,
  'bezahlt aus der Position = Menge minus Bestand, ohne Metadaten die Menge, nie negativ');
db.resellers.set('k5', { id: 'k5', stripe_subscription_id: null, team_plaetze: 5, team_plaetze_bezahlt: 0 });
const aboB = ppAbo('sub_B', 'k5', { team: 8 }); aboB.items.data[1].metadata = { bestand: '5' };
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', aboB), deps);
ok(bezahlt('k5') === 3 && db.resellers.get('k5').team_plaetze === 5, 'Webhook: Position Menge 8 mit Bestand 5 ergibt 3 bezahlte, Bestand bleibt 5');
const qK2 = text('backend/src/services/partnerPlanKauf.js'), aendern = qK2.slice(qK2.indexOf('async function teamplaetzeAendern'), qK2.indexOf('/** Rueckweg nach dem Checkout'));
ok(/TB\.couponSicherstellen\(stripe\(\), k, iv, preis\)/.test(aendern) && /TB\.positionFelder\(k, ziel, coupon\)/.test(aendern) && /const k = team\.kostenlos;/.test(qK2) && /TB\.summeBezahlt\(preis\.tiers \|\| \[\], k, n\)/.test(qK2),
  'Cockpit-Angebot und Buchung rechnen mit Bestand k über teamplatzBestand.js (Coupon, Position, Summe)');
ok(!/discounts\s*:/.test(qK2), 'partnerPlanKauf.js bleibt ohne Rabatt-Feld (der Bestandsrabatt sitzt in teamplatzBestand.js an der Teamplatz-Position)');
// Gegenproben
const naiv = (k, b) => TP.satzAusStufen(TP.stripeStufen('monthly'), b + 1) / 100;   // Bestand vergessen
ok(naiv(5, 0) === 59 && naiv(5, 0) !== TP.satzNaechster(5, 0, 'monthly'), 'Gegenprobe: ohne Bestand kostete der 7. Login eines Altkunden 59 statt 49 € (der Prüfer sieht den Unterschied)');
const TBkaputt = Object.assign({}, TB, { summeBezahlt: (t, k, b) => TB.staffel(t, b) });
ok(bestandGegenHand(TP, TBkaputt).length > 0, 'Gegenprobe: Backend ohne Bestand wird rot');
const TBohneCoupon = Object.assign({}, TB, { couponParameter: () => null });
ok(bestandGegenHand(TP, TBohneCoupon).length > 0, 'Gegenprobe: Stripe-Menge k + b ohne Coupon berechnet den Bestand mit und wird rot');

// ══ K · Kundenplatz-Quelle (v3960) ══════════════════════════════════════════
kopf('K Quelle frontend/js/kundenplatz-staffel.js ' + K.VERSION + ' gegen Stripe-Form, Backend und Altstellen');
/* Die Sandbox-Messung vom 17.11.2026 steht in tools/partner-seats-webhook-pruefen.mjs (T_M, T_J). Sie wird von dort
   GELESEN, nicht abgeschrieben: aendert jemand die Messung, sieht dieser Pruefer es. */
const wsp = text('tools/partner-seats-webhook-pruefen.mjs');
const tiersAus = (name) => JSON.parse(((new RegExp('const ' + name + ' = (\\[[^\\n]+\\]);').exec(wsp) || [])[1] || '[]').replace(/(\w+):/g, '"$1":'));
const SB = { monthly: tiersAus('T_M'), yearly: tiersAus('T_J') };
ok(SB.monthly.length === 3 && SB.yearly.length === 3, 'Sandbox-Stufen aus partner-seats-webhook-pruefen.mjs gelesen (T_M, T_J)');
function kQuellePruefen(Q) {
  const s = Q.STUFEN, r = [];
  r.push(s.length === 3 && s[0].von === 1 && s[s.length - 1].bis == null);
  for (let i = 1; i < s.length; i++) r.push(s[i].von === s[i - 1].bis + 1 && s[i].monat < s[i - 1].monat);
  r.push(s.every((x) => x.jahr === x.monat * (12 - Q.FREIMONATE)) && Q.PLAN.jahr === Q.PLAN.monat * (12 - Q.FREIMONATE));
  r.push(Q.MODUS === 'volume');
  return r.every(Boolean);
}
ok(kQuellePruefen(K), 'Stufen lückenlos ab 1, offen nach oben, je Stufe günstiger, Jahr = 11 Monatsbeiträge (Plan und Plätze), Modus volume');
ok(K.PLAN.monat === 99 && K.PLAN.jahr === 1089 && K.STUFEN.map((s) => s.monat).join('/') === '19/15/12' && K.STUFEN.map((s) => s.jahr).join('/') === '209/165/132',
  'Beträge: Partner-Plan 99 / 1.089 €, Kundenplatz 19/15/12 € bzw. 209/165/132 €');
ok(JSON.stringify(K.LOOKUP.plan) === JSON.stringify(kauf.PLAN_LOOKUP) && JSON.stringify(K.LOOKUP.platz) === JSON.stringify(kauf.SEAT_LOOKUP) && K.MAX === kauf.MAX_PLAETZE,
  'lookup_keys und Obergrenze = partnerPlanKauf.js (dp_plan_partner_*, dp_seat_*, ' + kauf.MAX_PLAETZE + ')');
function kGegenStripe(Q) {
  const abw = [];
  for (const iv of ['monthly', 'yearly']) {
    const st = Q.stripeStufen(iv).map((s) => ({ up_to: s.bis, unit_amount: s.cent }));
    if (JSON.stringify(st) !== JSON.stringify(SB[iv])) abw.push('Stufen ' + iv);
    for (let n = 0; n <= 120; n++) {
      const soll = kauf.staffelSumme(SB[iv], 'volume', n);
      if (Q.summe(n, iv) * 100 !== soll) { abw.push(iv + ' ' + n + ': ' + Q.summe(n, iv) + ' statt ' + soll / 100); break; }
    }
  }
  return abw;
}
const abwK = kGegenStripe(K);
ok(!abwK.length, 'Quelle = Sandbox-Stufen und = partnerPlanKauf.staffelSumme(volume) für 0 bis 120 Plätze, Monat und Jahr' + (abwK.length ? ': ' + abwK.join(' · ') : ''));
const HAND_K = [[0, 0, 0], [1, 19, 209], [9, 171, 1881], [10, 150, 1650], [24, 360, 3960], [25, 300, 3300], [60, 720, 7920]];
ok(HAND_K.every(([n, m, j]) => K.summe(n, 'monthly') === m && K.summe(n, 'yearly') === j), 'Hand-Tabelle Kundenplätze: 1 → 19, 9 → 171, 10 → 150, 24 → 360, 25 → 300, 60 → 720 € (Jahr 209 … 7.920 €)');
const angebotSB = (team) => ({ plan: { monthly: 9900, yearly: 108900 },
  platz: { monthly: { tiers_mode: 'volume', stufen: SB.monthly.map((t) => ({ bis: t.up_to, cent: t.unit_amount, pauschal: 0 })) },
           yearly: { tiers_mode: 'volume', stufen: SB.yearly.map((t) => ({ bis: t.up_to, cent: t.unit_amount, pauschal: 0 })) } },
  team: team ? { monthly: { tiers_mode: 'graduated', stufen: TP.stripeStufen('monthly').map((s) => ({ ...s, pauschal: 0 })) },
                 yearly: { tiers_mode: 'graduated', stufen: TP.stripeStufen('yearly').map((s) => ({ ...s, pauschal: 0 })) } } : null,
  darf_kaufen: true, max_plaetze: 500 });
ok(K.abweichungen(angebotSB(true)).length === 0, 'DpKundenplatz.abweichungen(Angebot in Stripe-Form) leer: Preisfenster und Quelle stimmen überein');
const rpS = text('frontend/js/reseller-portal.js');
ok(K.STUFEN.every((s) => new RegExp('bis: ' + (s.bis == null ? 'Infinity' : s.bis) + ',\\s+monat: ' + s.monat + ', jahr: ' + s.jahr).test(rpS)), 'reseller-portal.js STAFFEL (Vorschau im alten Kaufpanel) = Quelle');
ok(K.STUFEN.every((s) => partnerHtml.indexOf((s.bis == null ? 'AB ' + s.von : s.von + ' – ' + s.bis) + ' MANDANTEN</div><div class="pv">' + s.monat + ' € / Platz') >= 0), 'partner.html Mandanten-Staffel = Quelle');

// ══ L · Pakete: Rechenproben ════════════════════════════════════════════════
kopf('L Rechenproben der vier Pakete (Hand-Tabelle, Monat und Jahr)');
//               Paket       Kunden Logins  Monat  Jahr       Monat von Hand                     Jahr von Hand
const HAND_P = [['Solo',      0,  1,   99, 1089],   // 99                                1.089
                ['Büro',      5,  2,  253, 2783],   // 99 + 5 × 19 + 59                  1.089 + 5 × 209 + 649
                ['Kanzlei',  10,  3,  367, 4037],   // 99 + 10 × 15 + 2 × 59             1.089 + 10 × 165 + 2 × 649
                ['Netzwerk', 25,  8,  772, 8492]];  // 99 + 25 × 12 + 3 × 59 + 4 × 49    1.089 + 25 × 132 + 3 × 649 + 4 × 539
const paketSumme = (Kq, Q, kunden, logins, iv) => Kq.plan(iv) + Kq.summe(kunden, iv) + Q.teamSumme(logins - 1, iv);
const abwP = HAND_P.filter(([n, k, l, m, j]) => paketSumme(K, TP, k, l, 'monthly') !== m || paketSumme(K, TP, k, l, 'yearly') !== j);
ok(!abwP.length, 'Solo 99 / 1.089 €, Büro 253 / 2.783 €, Kanzlei 367 / 4.037 €, Netzwerk 772 / 8.492 €' + (abwP.length ? ': ' + abwP.map((x) => x[0]).join(', ') : ''));
ok(HAND_P.every(([, , , m, j]) => j === m * 11), 'Jahr = 11 × Monat für jedes Paket (ein Monat frei, Plan, Kunden- und Teamplätze)');
ok(HAND_P.every(([n, k, l], i) => PAKETE_SOLL[i][0] === n && PAKETE_SOLL[i][1] === k && PAKETE_SOLL[i][2] === l), 'Hand-Tabelle und Landing-Vorbelegung sind dieselben Pakete');
ok(eurText(367 / 10) === '36,70 €' && eurText(772 / 25) === '30,88 €', 'im Schnitt je Kunde: Kanzlei 36,70 €, Netzwerk 30,88 € im Monat');

// ══ M · Buchungsweg Landing → Preisfenster → Checkout ═══════════════════════
kopf('M Jetzt buchen mit Mengen: Link, vonDerLanding, Preisfenster, Checkout mit drei Positionen');
ok(/'\?register=1&partner_kauf=1&intervall=' \+ iv\(\) \+ '&kundenplaetze=' \+ r\.kunden \+ '&teamplaetze=' \+ r\.tp/.test(rechnerJs),
  'partner-pakete.js verlinkt ?register=1&partner_kauf=1&intervall=…&kundenplaetze=…&teamplaetze=… (Teamplätze = Logins ohne Inhaber)');
const vm = await import('node:vm');
/** partner-plan-kauf.js echt ausfuehren (vm, Browser nachgebaut): Adresse/Merker -> Preisfenster -> Kaufen. */
async function ppkLauf({ quelle = ppk, search = '', merker = null, angebot, karte = 'monthly' } = {}) {
  const store = new Map(merker != null ? [['dp_partner_kauf', merker]] : []), timers = [], aufrufe = { open: [], api: [], warn: [] };
  const knopf = { disabled: false, textContent: '', onclick: null };
  const el = { innerHTML: '', id: '', className: '', classList: { add() {} }, style: {}, querySelectorAll: () => [], querySelector: (s) => (s === '[data-a="kaufen"]' ? knopf : null), scrollIntoView() {} };
  const w = {
    console: { log() {}, warn: (...a) => aufrufe.warn.push(a.join(' ')), error() {} }, URLSearchParams, JSON, Math, Number, String, Date, Promise, Object, Array, parseInt, isNaN,
    location: { search, origin: 'https://app.x', pathname: '/' },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null, head: { appendChild() {} }, body: { appendChild() {} },
                createElement: (t) => (t === 'div' ? el : { textContent: '' }) },
    history: { replaceState() {} }, setTimeout: (f) => { timers.push(f); return timers.length; }, alert() {},
    Auth: { isLoggedIn: () => true, apiCall: async (p, o) => { aufrufe.api.push([p, o]); return p === '/subscription/partner/angebot' ? angebot : { url: 'https://checkout.stripe.test/c' }; } },
    openPricingModal: (o) => aufrufe.open.push(o === undefined ? null : o),
    DpKundenplatz: K, DpTeamplatz: TP, DpWiderruf: { einholen: async () => ({ widerruf_version: 'w1', zusatz: {} }) }
  };
  w.window = w; w.addEventListener = () => {};
  vm.createContext(w);
  vm.runInContext(quelle, w, { filename: 'partner-plan-kauf.js' });
  for (let i = 0; i < timers.length && i < 20; i++) { try { timers[i](); } catch (e) { /* Scroll-Takte */ } }
  const S = w.DpPartnerPlan._state;
  const nachher = { iv: S.iv, plaetze: S.plaetze, team: S.team };
  S.angebot = null;
  w.DpPartnerPlan.einhaengen({ parentNode: { insertBefore() {} }, nextSibling: null }, karte);
  const nb = (t) => t.replace(/ /g, ' ');   /* eur() im Preisfenster setzt ein geschuetztes Leerzeichen vor € */
  const vorlaeufig = nb(el.innerHTML);
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  const html = nb(el.innerHTML);
  if (knopf.onclick) { knopf.onclick(); for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); }
  const kauf1 = aufrufe.api.find((a) => a[0] === '/subscription/partner/checkout');
  return { aufrufe, nachher, vorlaeufig, html, body: kauf1 && kauf1[1].body };
}
let L1 = await ppkLauf({ search: '?register=1&partner_kauf=1&intervall=yearly&kundenplaetze=10&teamplaetze=2', angebot: angebotSB(true), karte: 'yearly' });
ok(L1.aufrufe.open.length === 1 && L1.aufrufe.open[0] && L1.aufrufe.open[0].period === 'yearly' && L1.nachher.iv === 'yearly' && L1.nachher.plaetze === 10 && L1.nachher.team === 2,
  'vonDerLanding: Adresse intervall=yearly, kundenplaetze=10, teamplaetze=2 → openPricingModal({period: yearly}), 10 Kundenplätze, 2 Teamplätze');
ok(/data-art="team"/.test(L1.html) && /4\.037 €/.test(L1.html) && L1.body && L1.body.billingInterval === 'yearly' && L1.body.plaetze === 10 && L1.body.teamplaetze === 2,
  'Preisfenster mit Teamplatz-Preis: Mengenwahl Teamplätze, Kanzlei im Jahr 4.037 €, Kauf schickt yearly, 10 Kundenplätze, 2 Teamplätze');
ok(/Preise werden mit dem Zahlungsanbieter abgeglichen/.test(L1.vorlaeufig) && /data-a="kaufen" disabled/.test(L1.vorlaeufig) && /2\.739 €/.test(L1.vorlaeufig),
  'vor der Stripe-Antwort: Vorschau aus kundenplatz-staffel.js (1.089 + 10 × 165 = 2.739 €), Kaufen gesperrt');
ok(L1.aufrufe.warn.length === 0 && L1.body.widerruf_verzicht === true, 'Stripe-Angebot = Quelle (keine Warnung), Widerrufsverzicht bleibt im Kauf');
let L2 = await ppkLauf({ search: '?register=1&partner_kauf=1&intervall=yearly&kundenplaetze=10&teamplaetze=2', angebot: angebotSB(false), karte: 'yearly' });
ok(!/data-art="team"/.test(L2.html) && /data-hinweis="team"/.test(L2.html) && /im Partner-Cockpit unter Team/.test(L2.html) && /2\.739 €/.test(L2.html)
   && L2.body && L2.body.teamplaetze === 0 && L2.body.plaetze === 10 && !/fehler|Fehler/.test(L2.html),
  'ohne Teamplatz-Preis (angebot.team null, wie Prod): keine Mengenwahl, Hinweis aufs Cockpit, Summe ohne Team 2.739 €, Kauf mit 0 Teamplätzen, kein Fehler');
let L3 = await ppkLauf({ merker: String(Date.now()), angebot: angebotSB(true) });
ok(L3.aufrufe.open.length === 1 && L3.aufrufe.open[0].period === 'monthly' && L3.nachher.plaetze === 0 && L3.nachher.team === 0, 'alter Merker (nur Zeit, vor v3960): Preisfenster monatlich ohne Mengen, wie bisher');
let L4 = await ppkLauf({ search: '?register=1&partner_kauf=1&intervall=monthly&kundenplaetze=25&teamplaetze=7', angebot: angebotSB(true) });
ok(/772 €/.test(L4.html) && L4.body.teamplaetze === 7 && L4.body.plaetze === 25 && L4.body.billingInterval === 'monthly', 'Netzwerk monatlich: 772 € im Preisfenster, Kauf mit 25 Kunden- und 7 Teamplätzen');
let L5 = await ppkLauf({ search: '?partner_kauf=1&kundenplaetze=-4&teamplaetze=x&intervall=quatsch', angebot: angebotSB(true) });
ok(L5.aufrufe.open[0].period === 'monthly' && L5.nachher.plaetze === 0 && L5.nachher.team === 0, 'kaputte Adresswerte: monatlich, 0, 0 (kein NaN, keine negative Menge)');
const qPm = text('frontend/js/pricing-modal.js');
ok(/window\.openPricingModal = function\(opts\)/.test(qPm) && /STATE\.period = \(opts && opts\.period === 'yearly'\) \? 'yearly' : 'monthly';/.test(qPm) && /dp-toggle-btn\[data-period="yearly"\]'\);\s*if \(yb\) yb\.click\(\);/.test(qPm),
  'openPricingModal({period}) setzt das Intervall und schaltet den Umschalter über denselben Klickweg');

// Backend: dritte Position
const cp3 = (o) => kauf.checkoutParameter(Object.assign({ kundeId: 'cus_X', planPreisId: 'price_plan', seatPreisId: 'price_seat', plaetze: 10, resellerId: 'r1', userId: 'u1', successUrl: 'https://x/s', cancelUrl: 'https://x/c' }, o));
const cT = cp3({ teamPreisId: 'price_team', teamplaetze: 2 });
ok(cT.line_items.length === 3 && cT.line_items[2].price === 'price_team' && cT.line_items[2].quantity === 2 && cT.line_items[1].quantity === 10 && cT.metadata.teamplaetze === '2' && cT.subscription_data.metadata.teamplaetze === '2',
  'checkoutParameter: Plan × 1, Kundenplätze × 10, Teamplätze × 2 in EINEM Abo, Menge in den Metadaten');
ok(cp3({ teamplaetze: 4 }).line_items.length === 2 && cp3({ teamPreisId: 'price_team', teamplaetze: 0 }).line_items.length === 2 && !('teamplaetze' in cp3({}).metadata),
  'ohne Teamplatz-Preis oder mit 0 Teamplätzen: keine dritte Position');
const schl3 = (o, acc = []) => { if (o && typeof o === 'object') for (const k2 of Object.keys(o)) { acc.push(k2); schl3(o[k2], acc); } return acc; };
ok(!schl3(cT).some((k2) => /trial|discount|promotion/i.test(k2)), 'auch mit Teamplätzen kein trial-, Rabatt- oder Gutscheinfeld im Checkout');
function teamRegelOk(fn) {
  const preis = { id: 'price_team' };
  const a = fn(2, preis, { team_plaetze: 0 }), b = fn(2, null, { team_plaetze: 0 }), c = fn(2, preis, { team_plaetze: 5 }), d = fn(0, preis, { team_plaetze: 0 });
  return a.menge === 2 && a.preisId === 'price_team' && !a.hinweis && b.menge === 0 && b.hinweis === 'preis_fehlt' && c.menge === 0 && c.hinweis === 'bestand' && d.menge === 0 && !d.hinweis;
}
ok(teamRegelOk(kauf.teamImCheckout), 'teamImCheckout: Preis da und kein Bestand → mitbuchen, Preis fehlt → leise ohne (preis_fehlt), kostenloser Bestand → leise ohne (bestand, sonst fehlte der Coupon)');
const qSubM = text('backend/src/routes/subscription.js'), qKaufM = text('backend/src/services/partnerPlanKauf.js');
ok(/partnerCheckoutSchema = z\.object\(\{[\s\S]{0,300}teamplaetze: z\.number\(\)\.int\(\)\.min\(0\)\.max\(partnerKauf\.MAX_PLAETZE\)\.optional\(\)/.test(qSubM)
   && /checkoutAnlegen\(\{\s*user: req\.user, interval: req\.body\.billingInterval, plaetze: req\.body\.plaetze, teamplaetze: req\.body\.teamplaetze \|\| 0/.test(qSubM),
  'Route partner/checkout: teamplaetze optional im strikten Schema und an checkoutAnlegen durchgereicht');
ok(/const team = teamImCheckout\(teamplaetze, by\[TEAM_LOOKUP\[iv\]\], rs\);/.test(qKaufM) && /teamPreisId: team\.preisId, teamplaetze: team\.menge/.test(qKaufM) && /team_hinweis: team\.hinweis/.test(qKaufM),
  'checkoutAnlegen: Teamplätze nur über teamImCheckout, Antwort meldet team_hinweis');
// Gegenproben
ok(!kQuellePruefen(Object.assign({}, K, { STUFEN: K.STUFEN.map((s, i) => i === 1 ? { ...s, jahr: 180 } : s) })), 'Gegenprobe: Jahr 12 statt 11 Monatsbeiträge in der Kundenplatz-Quelle wird rot');
const K16 = Object.assign({}, K, { STUFEN: K.STUFEN.map((s, i) => i === 1 ? { ...s, monat: 16 } : s) });
K16.summe = (n, iv) => { const x = Math.max(0, parseInt(n, 10) || 0); if (!x) return 0; const st = K16.STUFEN.find((s) => s.bis == null || x <= s.bis); return x * st[iv === 'yearly' ? 'jahr' : 'monat']; };
K16.stripeStufen = (iv) => K16.STUFEN.map((s) => ({ bis: s.bis, cent: s[iv === 'yearly' ? 'jahr' : 'monat'] * 100 }));
ok(kGegenStripe(K16).length > 0 && landingGegenQuelle(preise, TP, K16).length > 0, 'Gegenprobe: Quelle 16 statt 15 € → Stripe-Vergleich und Landing-Rückfall werden rot');
const Kgrad = Object.assign({}, K, { summe: (n, iv) => kauf.staffelSumme(SB[iv], 'graduated', n) / 100 });
ok(kGegenStripe(Kgrad).length > 0, 'Gegenprobe: graduated statt volume bei den Kundenplätzen wird rot');
ok(K.abweichungen(Object.assign(angebotSB(true), { plan: { monthly: 9900, yearly: 118800 } })).length > 0, 'Gegenprobe: Stripe-Jahrespreis 1.188 € statt 1.089 € → abweichungen() meldet es');
ok(!teamRegelOk((t, p) => ({ menge: p ? t : 0, preisId: p ? p.id : null, hinweis: p ? null : 'preis_fehlt' })), 'Gegenprobe: eine Regel, die den kostenlosen Bestand übersieht, wird rot');
const ppkKaputt = ppk.replace("teamplaetze: (S.angebot && S.angebot.team && S.angebot.team[S.iv]) ? S.team : 0,", 'teamplaetze: S.team,');
const LK = await ppkLauf({ quelle: ppkKaputt, search: '?partner_kauf=1&intervall=yearly&kundenplaetze=10&teamplaetze=2', angebot: angebotSB(false), karte: 'yearly' });
ok(ppkKaputt !== ppk && LK.body && LK.body.teamplaetze === 2, 'Gegenprobe: schickt das Preisfenster Teamplätze ohne Stripe-Preis, sähe der Prüfer 2 statt 0');
const landKaputt = preise.replace('data-o="gesamt">367<', 'data-o="gesamt">368<');
ok(landKaputt !== preise && landingGegenQuelle(landKaputt, TP).length > 0, 'Gegenprobe: Kanzlei-Rückfall 368 statt 367 € wird rot');
const landVorbelegung = preise.replace('data-paket="kanzlei" data-kunden="10"', 'data-paket="kanzlei" data-kunden="12"');
ok(landVorbelegung !== preise && landingGegenQuelle(landVorbelegung, TP).length > 0, 'Gegenprobe: Kanzlei mit 12 statt 10 Kundenplätzen (Marcels Vorbelegung) wird rot');

console.log((fehler ? 'ROT' : 'SAUBER') + ': ' + (n - fehler) + '/' + n + ' Punkte');
process.exit(fehler ? 1 : 0);
