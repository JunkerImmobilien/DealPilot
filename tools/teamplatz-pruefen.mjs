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
 *   E  Anzeige: Landing preise.html (Rueckfall) und partner.html gegen dieselbe Quelle, keine Preis-Kopie in
 *      teamplatz-rechner.js, partner-kunden.js, partner-plan-kauf.js, Kundentext ohne Gedankenstrich und Semikolon
 *   F  Stripe-Skript: Parameter aus der Quelle, Sicherungen (Trockenlauf, Testschluessel, --live), lookup_key = Backend
 *   G  Ladeweg und Buster
 *   H  Gegenproben: verfaelschte Quelle, Volume statt Graduated, falsche Stufe, Sicherung ohne Schluessel
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
kopf('E Landing und App gegen dieselbe Quelle');
const preise = text('frontend/landing/preise.html'), partnerHtml = text('frontend/landing/partner.html');
function eurText(v) { const r = Math.round(v * 100) / 100; return r.toLocaleString('de-DE', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
function teamBlock(html) { const a = html.indexOf('id="teamplaetze"'); if (a < 0) return ''; const b = html.indexOf('<div class="pe rv">', a); return html.slice(a, b < 0 ? a + 6000 : b); }
function partnerAusHtml(html) {
  const m = /<div class="pr" data-m="([^"]+)" data-j="([^"]+)">/.exec(html);
  const z = (t) => parseFloat(String(t).replace(/[^\d,]/g, '').replace(',', '.'));
  return m ? { m: z(m[1]), j: z(m[2]) } : null;
}
/** Vergleicht den Landing-Rueckfall mit einer Quelle Q. Liefert Liste der Abweichungen. */
function landingGegenQuelle(html, Q) {
  const abw = [], blk = teamBlock(html);
  if (!blk) return ['Block #teamplaetze fehlt'];
  Q.STUFEN.forEach((s, i) => {
    const re = new RegExp('<div class="st">([^<]+)</div><div class="pv" data-team-stufe="' + i + '" data-m="(\\d+)" data-j="(\\d+)">([^<]+)<small>/ Monat</small></div><div class="pj">oder ([^<]+) im Jahr</div>');
    const m = re.exec(blk);
    if (!m) { abw.push('Stufe ' + i + ' nicht gefunden'); return; }
    if (m[1] !== Q.stufenName(s).toUpperCase()) abw.push('Stufe ' + i + ' Name ' + m[1]);
    if (+m[2] !== s.monat || +m[3] !== s.jahr) abw.push('Stufe ' + i + ' data-m/j ' + m[2] + '/' + m[3]);
    if (m[4] !== eurText(s.monat) || m[5] !== eurText(s.jahr)) abw.push('Stufe ' + i + ' Text ' + m[4] + ' / ' + m[5]);
  });
  if ((blk.match(/data-team-stufe="/g) || []).length !== Q.STUFEN.length) abw.push('Zahl der Stufen');
  const l = /value="(\d+)"[^>]*data-team-logins/.exec(blk), P = partnerAusHtml(html);
  if (!l || !P) abw.push('Rechner oder Partner-Preis fehlt');
  else {
    const logins = +l[1], tp = logins - 1, team = Q.summeLogins(logins, 'monthly'), zus = P.m + team;
    const erg = blk.slice(blk.indexOf('data-team-ergebnis'));
    const zeilen = [...erg.matchAll(/<div class="pteam-z[^"]*"><span>([\s\S]*?)<\/span><span>([^<]+)<\/span><\/div>/g)].map((m) => [m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), m[2]]);
    const st = Q.stripeStufen('monthly'); let rest = tp, unten = 0; const teile = [];
    for (const s of st) { if (rest <= 0) break; const k = Math.max(0, Math.min(rest, (s.bis == null ? Infinity : s.bis) - unten)); if (k) teile.push(k + ' × ' + eurText(s.cent / 100)); rest -= k; unten = s.bis == null ? Infinity : s.bis; }
    const soll = [['Partner-Plan mit dir als Inhaber', eurText(P.m)], [tp + (tp === 1 ? ' Teamplatz ' : ' Teamplätze ') + teile.join(' + '), eurText(team)],
                  ['Zusammen je Monat', eurText(zus)], ['im Schnitt je Login', eurText(zus / logins)]];
    if (JSON.stringify(zeilen) !== JSON.stringify(soll)) abw.push('Rechner-Rückfall ' + JSON.stringify(zeilen) + ' statt ' + JSON.stringify(soll));
  }
  for (const [name, h] of [['preise.html', html]]) {
    const li = /<li data-team-ab>([^<]*)</.exec(h);
    if (!li || li[1].indexOf('ab ' + eurText(Q.ab('monthly')) + ' im Monat') < 0) abw.push(name + ' Zeile „weitere Logins ab …“');
  }
  return abw;
}
const abwL = landingGegenQuelle(preise, TP);
ok(!abwL.length, 'preise.html #teamplaetze: Stufen, Beträge, Monat/Jahr und Rechner-Rückfall (3 Logins) = Quelle' + (abwL.length ? ': ' + abwL.join(' · ') : ''));
const P = partnerAusHtml(preise);
ok(P && P.m === PARTNER.m && P.j === PARTNER.j, 'Partner-Plan auf der Seite 99 € / 1.089 € (der Rechner liest ihn dort, keine Kopie)');
ok(/<li data-team-ab>[^<]*ab 39 € im Monat/.test(partnerHtml) && /href="preise\.html#teamplaetze"/.test(partnerHtml) && TP.ab('monthly') === 39,
  'partner.html: „weitere Logins ab 39 € im Monat“ = DpTeamplatz.ab, Link auf die Staffel');
const rechnerJs = text('frontend/landing/teamplatz-rechner.js');
const PREISZAHL = /\b(59|49|39|649|539|429|99|1\.?089)\s*(€|EUR|\\u20ac)/;
const ohneKommentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!PREISZAHL.test(ohneKommentar(rechnerJs)) && !/\b(5900|4900|3900)\b/.test(rechnerJs), 'teamplatz-rechner.js trägt keine Preiszahl (liest Quelle und Partner-Karte)');
const pk = text('frontend/js/partner-kunden.js');
const pkTeam = pk.slice(pk.indexOf('v3947 · Teamplaetze mit Preis'), pk.indexOf('/* Eingeladene Seite: Band und Fenster'));
ok(pkTeam.length > 2000 && !PREISZAHL.test(ohneKommentar(pkTeam)) && /summeAusStufen\(a\.stufen, n\)/.test(pkTeam) && /api\('\/partner\/team\/preis'\)/.test(pkTeam),
  'Cockpit: keine Preiszahl im Code, Beträge aus GET /partner/team/preis (Stripe-Stufen), Summe über DpTeamplatz.summeAusStufen');
ok(/nx\.satz_cent/.test(pkTeam) && /nx\.summe_cent/.test(pkTeam) && /'Platz buchen und einladen'/.test(pkTeam) && /anzahl: a\.bezahlt_abo \+ 1/.test(pkTeam),
  'Cockpit: vor dem Bestätigen Satz des nächsten Platzes und neue Summe, dann Platz buchen (+1) und einladen');
const ppk = text('frontend/js/partner-plan-kauf.js');
ok(/TP\.ab\(iv\)/.test(ppk) && /teamZeile\(iv\)/.test(ppk) && !/Logins für dein Team ab \d/.test(ppk), 'Preisfenster: „weitere Logins ab …“ aus DpTeamplatz.ab, keine Zahl im Code');
/* Kundentext: sichtbarer Text ohne Gedankenstrich und Semikolon */
const sichtbar = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
const blkText = sichtbar(teamBlock(preise)) + ' ' + sichtbar((/<li data-team-ab>[\s\S]*?<\/li>/.exec(preise) || [''])[0]) + ' ' + sichtbar((/<li data-team-ab>[\s\S]*?<\/li>/.exec(partnerHtml) || [''])[0]);
ok(!/[–—;]/.test(blkText), 'Landing-Text der Teamplätze ohne Gedankenstrich und Semikolon');
const strings = (src) => [...ohneKommentar(src).matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((s) => !/^[#.][\w-]/.test(s) && !/[{}]/.test(s) && /[a-zäöü]{3}/i.test(s));
const kt = strings(pkTeam).concat(strings(rechnerJs)).concat(strings(ppk.slice(ppk.indexOf('function teamZeile'), ppk.indexOf('/* ── Karte im Preis-Fenster'))));
const kaputt = kt.filter((s) => /[–—;]/.test(s.replace(/style="[^"]*"/g, '').replace(/&[a-z#0-9]+;/g, '')));
ok(!kaputt.length, 'Kundentext in Cockpit, Rechner und Preisfenster ohne Gedankenstrich und Semikolon (' + kt.length + ' Texte)' + (kaputt.length ? ': ' + kaputt.slice(0, 2).join(' | ') : ''));

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
const bIdx = (/js\/teamplatz-staffel\.js\?v=([\w.-]+)/.exec(idx) || [])[1], bRech = (/js\/teamplatz-staffel\.js\?v=([\w.-]+)/.exec(rechnerJs) || [])[1];
ok(bIdx && bIdx === bRech, 'teamplatz-staffel.js: gleicher Buster in index.html und teamplatz-rechner.js (' + bIdx + ' / ' + bRech + ')');
ok(idx.indexOf('js/teamplatz-staffel.js') < idx.indexOf('js/partner-plan-kauf.js') && idx.indexOf('js/teamplatz-staffel.js') < idx.indexOf('js/partner-kunden.js'),
  'index.html lädt die Quelle vor Preisfenster und Cockpit');
ok(/<script src="teamplatz-rechner\.js\?v=[\w.-]+"><\/script>/.test(preise), 'preise.html lädt teamplatz-rechner.js');
ok(/frontend\/landing\/teamplatz-rechner\.js/.test(text('tools/buster-ebenen-pruefen.mjs')), 'buster-ebenen-pruefen.mjs kennt teamplatz-rechner.js als Dokument');

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
const landKaputt = preise.replace('data-m="59" data-j="649">59 €', 'data-m="59" data-j="649">58 €');
ok(landingGegenQuelle(landKaputt, TP).length > 0, 'Landing mit 58 statt 59 €: rot');
const landStrich = sichtbar(teamBlock(preise.replace('Teamplätze für deine Kanzlei', 'Teamplätze – für deine Kanzlei')));
ok(/[–—;]/.test(landStrich), 'Gedankenstrich im Landing-Text würde gefunden');

console.log((fehler ? 'ROT' : 'SAUBER') + ': ' + (n - fehler) + '/' + n + ' Punkte');
process.exit(fehler ? 1 : 0);
