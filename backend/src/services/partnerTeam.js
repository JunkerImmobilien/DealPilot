'use strict';
/**
 * partnerTeam.js · v3830 — Team in der Kanzlei, Rechte im Team, Loeschfristen (Marcel 19.11.2026)
 *
 *   Ein Partnerkonto (resellers) hat einen Inhaber (owner_user_id, reseller_members.role 'owner') und Berater
 *   (reseller_members.role 'berater'). Alle sehen das Cockpit der Kanzlei: Kunden, Kundenstaende, Aufgaben, Meldungen.
 *   Die Kundenplaetze sind ein gemeinsamer Pool.
 *
 *   Rechte:
 *     Inhaber  alles (Team, Plaetze, Abrechnung, Marke, jeder Kunde)
 *     Berater  betreut die EIGENEN Kunden (reseller_clients.berater_id = er selbst): Stufe und Rechte, Platz, Entzug,
 *              Trennen, Entfernen, Anmerkungen, Objekte zuordnen, an einen anderen Berater abgeben.
 *              Kunden anderer Berater sieht er nur. Team, Plaetze kaufen, Marke: nur der Inhaber.
 *
 *   Mitgliedsplaetze: vorerst OHNE Abrechnung (der Preis ist nicht entschieden), begrenzt durch resellers.team_plaetze
 *   (Vorgabe 5, zaehlt Berater und offene Einladungen, nicht den Inhaber). Kein Stripe.
 *
 *   Zugang: requireFeature('reseller') ODER Berater eines Partnerkontos, dessen Inhaber den Partner-Plan hat (zugang()).
 */
const crypto = require('crypto');
const { query } = require('../db/pool');

function fehler(code, status, detail) { const e = new Error(code); e.status = status || 400; if (detail) e.detail = detail; return e; }
const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EINLADUNG_TAGE = 30;
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

/* ── v3830 C · Loeschfristen an EINER Stelle (Takt aufraeumen(), Anzeige unter Verwaltung › Löschfristen).
   Mit der AVV (frontend/landing/avv.html § 12 Abs. 3) abgeglichen: die AVV fuehrt Meldungen, Aufgaben und den
   Verlauf der Uebergaben NICHT auf - die Zeilen gehoeren dort ergaenzt (neue AVV-Fassung, Entscheidung Marcel).
   Die uebrigen Zeilen stehen wortgleich in der AVV. */
const LOESCHFRISTEN = {
  meldung_gelesen_tage: 90,        /* gelesene Meldungen */
  meldung_ungelesen_tage: 365,     /* auch ungelesene, damit nichts unbegrenzt liegt */
  aufgabe_abgeschlossen_tage: 180, /* abgeschlossene Aufgaben samt Status je Kunde */
  uebergabe_beendet_tage: 180,     /* Verlauf der Uebergaben nach Ablauf, Widerruf oder Uebernahme */
  entzug_frist_tage: 30            /* AVV § 12: Kundenkonto auf einem Kundenplatz nach Entzug */
};
function fristenListe() {
  const F = LOESCHFRISTEN;
  return [
    { was: 'Meldungen, gelesen', wann: F.meldung_gelesen_tage + ' Tage nach dem Lesen automatisch', selbst: 'einzeln oder alle gelesenen auf einmal' },
    { was: 'Meldungen, ungelesen', wann: F.meldung_ungelesen_tage + ' Tage nach Eingang automatisch', selbst: 'einzeln' },
    { was: 'Aufgaben, abgeschlossen', wann: F.aufgabe_abgeschlossen_tage + ' Tage nach dem Abschließen automatisch, mit dem Stand je Kunde', selbst: 'sofort nach dem Abschließen' },
    { was: 'Aufgaben, offen', wann: 'bleiben, bis du sie abschließt', selbst: 'nach dem Abschließen' },
    { was: 'Übergaben, Verlauf', wann: F.uebergabe_beendet_tage + ' Tage nach Ablauf, Widerruf oder Übernahme automatisch. Der Link selbst gilt 30 Tage.', selbst: 'offene Übergaben widerrufen' },
    { was: 'Anmerkungen an Kundenständen', wann: 'bleiben am Kundenstand, bis du sie löschst, der Kunde den Stand zurückzieht oder du den Kunden entfernst', selbst: 'einzeln' },
    { was: 'Kundenstände (Kopie beim Partner)', wann: 'sofort, wenn der Kunde den Stand zurückzieht. Nach dem Trennen bleibt die Kopie bei dir, bis du den Kunden entfernst', selbst: 'Kunde entfernen' },
    { was: 'Kunde entfernen', wann: 'sofort: Verbindung, Kundennummer, Notiz, Kundenstände, Anmerkungen, Aufgaben, Meldungen, Übergaben und Zuordnungen. Das Konto des Kunden bleibt. Auf einem Kundenplatz läuft vorher die Frist von ' + F.entzug_frist_tage + ' Tagen', selbst: 'Kunden & Plätze › Kunde › Entfernen' },
    { was: 'Kundenkonto auf einem Kundenplatz nach Entzug', wann: F.entzug_frist_tage + ' Tage Frist, danach werden Verbindungen getrennt und das Konto gelöscht, außer der Kunde hat ein eigenes Abo', selbst: 'Platz entziehen' }
  ];
}

// ── Rolle und Rechte ─────────────────────────────────────────────────────────
async function rolle(rs, userId) {
  if (!rs || !userId) return null;
  if (rs.owner_user_id && String(rs.owner_user_id) === String(userId)) return 'owner';
  const r = await query(`SELECT role::text AS role FROM reseller_members WHERE reseller_id = $1 AND user_id = $2`, [rs.id, userId]);
  return r.rows[0] ? r.rows[0].role : null;
}
/** Darf dieser Nutzer den Kunden betreuen (aendern, Platz, Entzug, Trennen, Entfernen, Anmerkungen, Zuordnung)? Rein. */
function darfKunde(rolleWert, actorId, client) {
  if (rolleWert === 'owner') return true;
  if (rolleWert !== 'berater' || !client) return false;
  return !!client.berater_id && String(client.berater_id) === String(actorId);
}
function nurInhaber(rolleWert) {
  if (rolleWert !== 'owner') throw fehler('nur_inhaber', 403, 'Das darf nur der Inhaber des Partnerkontos.');
}
function pruefeKunde(rolleWert, actorId, client) {
  if (!darfKunde(rolleWert, actorId, client)) throw fehler('fremder_kunde', 403, 'Diesen Kunden betreut ein anderer Berater. Du kannst ihn nur ansehen.');
}

/** Zugang zum Cockpit: eigener Partner-Plan oder Berater eines Partnerkontos mit Partner-Plan des Inhabers. */
function zugang() {
  return async (req, res, next) => {
    try {
      const sub = require('./subscriptionService');
      const plan = await sub.getEffectivePlan(req.user.id);
      if (plan && plan.plan_features && plan.plan_features.reseller) return next();
      const m = (await query(
        `SELECT r.owner_user_id FROM reseller_members m JOIN resellers r ON r.id = m.reseller_id
          WHERE m.user_id = $1 AND m.role = 'berater' AND r.owner_user_id IS NOT NULL AND r.owner_user_id <> $1 LIMIT 1`, [req.user.id])).rows[0];
      if (m) {
        const p2 = await sub.getEffectivePlan(m.owner_user_id);
        if (p2 && p2.plan_features && p2.plan_features.reseller) { req.partnerTeamZugang = true; return next(); }
      }
      return res.status(403).json({ error: "Feature 'reseller' is not available on your plan", plan_id: plan && plan.plan_id, upgrade_required: true });
    } catch (e) { next(e); }
  };
}

// ── Team lesen ───────────────────────────────────────────────────────────────
async function team(rs) {
  const mitglieder = (await query(
    `SELECT m.user_id, m.role::text AS rolle, m.created_at, u.name, u.email,
            (SELECT count(*)::int FROM reseller_clients c WHERE c.reseller_id = m.reseller_id AND c.berater_id = m.user_id AND c.entfernt_am IS NULL AND c.getrennt_am IS NULL) AS kunden
       FROM reseller_members m JOIN users u ON u.id = m.user_id
      WHERE m.reseller_id = $1 AND u.deleted_at IS NULL
      ORDER BY (m.role = 'owner') DESC, u.name NULLS LAST, u.email`, [rs.id])).rows;
  /* Inhaber ohne Mitgliedszeile (sehr alter Stand): ergaenzen, damit er in der Liste und als Berater waehlbar ist */
  if (rs.owner_user_id && !mitglieder.some((x) => String(x.user_id) === String(rs.owner_user_id))) {
    await query(`INSERT INTO reseller_members (reseller_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT (reseller_id, user_id) DO NOTHING`, [rs.id, rs.owner_user_id]);
    return team(rs);
  }
  const einladungen = (await query(
    `SELECT id, email, name, erstellt_am, expires_at, (user_id IS NOT NULL) AS bestehendes_konto FROM partner_team_einladungen
      WHERE reseller_id = $1 AND status = 'offen' AND expires_at > now() ORDER BY erstellt_am DESC`, [rs.id])).rows;
  const plaetze = Number.isFinite(Number(rs.team_plaetze)) ? Number(rs.team_plaetze) : 5;
  const berater = mitglieder.filter((x) => x.rolle === 'berater').length;
  return { mitglieder, einladungen, plaetze, belegt: berater + einladungen.length, frei: Math.max(0, plaetze - berater - einladungen.length) };
}

// ── Einladen (nur Inhaber) ───────────────────────────────────────────────────
/** Pruefungen fuer ein Konto, das ins Team soll (bestehendes Konto). Liefert null oder den Fehler. */
async function kontoPruefen(rs, userId) {
  if (String(userId) === String(rs.owner_user_id)) return fehler('eigenes_konto', 409, 'Das ist dein eigenes Konto.');
  const schon = await query(`SELECT 1 FROM reseller_members WHERE reseller_id = $1 AND user_id = $2`, [rs.id, userId]);
  if (schon.rowCount) return fehler('schon_im_team', 409, 'Dieses Konto ist schon in deinem Team.');
  const anderes = await query(`SELECT 1 FROM reseller_members m WHERE m.user_id = $1 AND m.reseller_id <> $2 AND m.role = 'berater' LIMIT 1`, [userId, rs.id]);
  if (anderes.rowCount) return fehler('anderes_team', 409, 'Dieses Konto gehört schon zum Team eines anderen Partners.');
  const eigenesMitDaten = await query(
    `SELECT 1 FROM resellers r WHERE r.owner_user_id = $1 AND r.id <> $2 AND (
        EXISTS (SELECT 1 FROM reseller_clients c WHERE c.reseller_id = r.id) OR EXISTS (SELECT 1 FROM licenses l WHERE l.reseller_id = r.id)
        OR EXISTS (SELECT 1 FROM reseller_members m WHERE m.reseller_id = r.id AND m.role = 'berater')) LIMIT 1`, [userId, rs.id]);
  if (eigenesMitDaten.rowCount) return fehler('eigenes_partnerkonto', 409, 'Dieses Konto führt selbst ein Partnerkonto mit Kunden oder Plätzen.');
  const kunde = await query(`SELECT 1 FROM reseller_clients WHERE user_id = $1 AND getrennt_am IS NULL LIMIT 1`, [userId]);
  if (kunde.rowCount) return fehler('ist_kunde', 409, 'Dieses Konto ist Kunde eines Partners. Ein Kunde kann nicht zugleich im Team sein.');
  return null;
}

async function einladen(rs, actor, rolleWert, b, basis) {
  nurInhaber(rolleWert);
  const email = String(b && b.email || '').trim().toLowerCase();
  const name = String(b && b.name || '').trim().slice(0, 120);
  if (!EMAIL_RX.test(email) || email.length > 254) throw fehler('email_ungueltig', 400, 'Bitte eine gültige E-Mail eintragen.');
  if (!name) throw fehler('name_fehlt', 400, 'Bitte den Namen eintragen.');
  const t = await team(rs);
  if (t.frei <= 0) throw fehler('team_voll', 409, 'Alle ' + t.plaetze + ' Teamplätze sind belegt. Den Rahmen stellt DealPilot ein.');
  const u = (await query(`SELECT id, email FROM users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`, [email])).rows[0];
  if (u) { const f = await kontoPruefen(rs, u.id); if (f) throw f; }
  await query(`UPDATE partner_team_einladungen SET status = 'zurueckgezogen', beantwortet_am = now() WHERE reseller_id = $1 AND lower(email) = $2 AND status = 'offen'`, [rs.id, email]);
  const token = crypto.randomBytes(24).toString('base64url');
  const row = (await query(
    `INSERT INTO partner_team_einladungen (reseller_id, email, name, user_id, token_hash, erstellt_von, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(days => $7::int)) RETURNING id, email, name, erstellt_am, expires_at`,
    [rs.id, email, name, u ? u.id : null, sha(token), actor, EINLADUNG_TAGE])).rows[0];
  let gesendet = false;
  if (basis) {
    try {
      const im = require('./resellerInviteMail');
      const marke = await im.markeLaden(query, rs.id, basis);
      const app = String(basis).replace(/\/+$/, '');
      const m = await mailTeam(im, { email, name, bestehend: !!u, link: app + '/?dp_team=' + encodeURIComponent(token), reseller: marke, tage: EINLADUNG_TAGE });
      gesendet = !!(m && !m.skipped && !m.dryRun);
    } catch (e) { console.error('[partner-team] einladen-mail:', e.message); }
  }
  /* Antwort verraet nicht, ob es das Konto gibt (wie bei Kunden) */
  return { ok: true, einladung: row, mail_gesendet: gesendet, _token: process.env.NODE_ENV === 'test' ? token : undefined };
}

function mailTeam(im, p) {
  const m = im.marke(p.reseller);
  const subject = m.brandName + ' lädt dich in sein Team ein';
  const weg = p.bestehend
    ? 'Melde dich mit deinem Konto an. Die Einladung erscheint dann oben in der App, dort bestätigst du sie.'
    : 'Leg mit dieser E-Mail-Adresse ein DealPilot-Konto an. Danach erscheint die Einladung oben in der App, dort bestätigst du sie.';
  const html = im.rahmen(m,
    '<p style="font-size:15px;margin:0 0 14px">Hallo ' + im.esc(p.name) + ',</p>' +
    '<p style="font-size:14px;line-height:1.6;color:#3a352c">' + im.esc(m.brandName) + ' möchte dich als Berater ins Team aufnehmen. ' +
      'Im Team siehst du das Partner-Cockpit der Kanzlei und betreust deine eigenen Kunden.</p>' +
    '<p style="font-size:14px;line-height:1.6;color:#3a352c">' + weg + '</p>' +
    '<p style="text-align:center;margin:24px 0">' + im.knopf(m, p.bestehend ? 'Anmelden und Einladung ansehen' : 'Konto anlegen und beitreten', p.link) + '</p>' +
    '<p style="font-size:12px;color:#8a8473;border-top:1px solid #eee;padding-top:14px;margin-top:18px">Die Einladung gilt ' + p.tage + ' Tage. Ohne deine Bestätigung passiert nichts.</p>');
  const text = 'Hallo ' + p.name + ',\n\n' + m.brandName + ' möchte dich als Berater ins Team aufnehmen.\n' + weg + '\n' + p.link +
    '\n\nDie Einladung gilt ' + p.tage + ' Tage. Ohne deine Bestätigung passiert nichts.' + m.textFuss;
  return im.senden(m, { to: p.email, subject: subject, text: text, html: html });
}

async function einladungZurueckziehen(rs, rolleWert, id) {
  nurInhaber(rolleWert);
  const r = await query(`UPDATE partner_team_einladungen SET status = 'zurueckgezogen', beantwortet_am = now() WHERE id = $1 AND reseller_id = $2 AND status = 'offen' RETURNING id`, [id, rs.id]);
  return { ok: r.rowCount > 0 };
}

// ── Eingeladene Seite ────────────────────────────────────────────────────────
/** Offene Einladungen fuer diesen Nutzer (Konto bekannt oder gleiche E-Mail, auch nach der Registrierung). */
async function meineEinladungen(user) {
  const r = await query(
    `SELECT e.id, e.erstellt_am, e.expires_at, COALESCE(NULLIF(rs.brand_name,''), rs.name) AS partner_name, u2.name AS von
       FROM partner_team_einladungen e JOIN resellers rs ON rs.id = e.reseller_id LEFT JOIN users u2 ON u2.id = e.erstellt_von
      WHERE e.status = 'offen' AND e.expires_at > now() AND (e.user_id = $1 OR lower(e.email) = lower($2))
      ORDER BY e.erstellt_am DESC`, [user.id, user.email || '']);
  return r.rows;
}
async function einladungPerToken(user, token) {
  const e = (await query(`SELECT * FROM partner_team_einladungen WHERE token_hash = $1`, [sha(token || '')])).rows[0];
  if (!e || e.status !== 'offen' || new Date(e.expires_at) <= new Date()) throw fehler('einladung_ungueltig', 404, 'Die Einladung ist abgelaufen oder schon beantwortet.');
  if (String(e.email).toLowerCase() !== String(user.email || '').toLowerCase()) throw fehler('andere_adresse', 409, 'Die Einladung gilt für eine andere E-Mail-Adresse. Melde dich mit der eingeladenen Adresse an.');
  if (!e.user_id) await query(`UPDATE partner_team_einladungen SET user_id = $2 WHERE id = $1`, [e.id, user.id]);
  return (await meineEinladungen(user)).filter((x) => x.id === e.id)[0] || null;
}
async function beantworten(user, id, annehmen) {
  const e = (await query(
    `SELECT e.*, r.owner_user_id, r.team_plaetze FROM partner_team_einladungen e JOIN resellers r ON r.id = e.reseller_id
      WHERE e.id = $1 AND e.status = 'offen' AND e.expires_at > now() AND (e.user_id = $2 OR lower(e.email) = lower($3))`, [id, user.id, user.email || ''])).rows[0];
  if (!e) throw fehler('einladung_nicht_gefunden', 404);
  const rs = { id: e.reseller_id, owner_user_id: e.owner_user_id, team_plaetze: e.team_plaetze };
  if (!annehmen) {
    await query(`UPDATE partner_team_einladungen SET status = 'abgelehnt', beantwortet_am = now(), user_id = COALESCE(user_id, $2) WHERE id = $1`, [e.id, user.id]);
    await teamMeldung(rs.id, (e.name || e.email) + ' hat die Einladung ins Team abgelehnt');
    return { ok: true, angenommen: false };
  }
  const f = await kontoPruefen(rs, user.id); if (f) throw f;
  /* ein leeres eigenes Partnerkonto (ohne Kunden, Plaetze, Berater) wird abgeraeumt, sonst waehlte getResellerForUser es zuerst */
  await query(
    `DELETE FROM resellers r WHERE r.owner_user_id = $1 AND r.id <> $2
        AND NOT EXISTS (SELECT 1 FROM reseller_clients c WHERE c.reseller_id = r.id) AND NOT EXISTS (SELECT 1 FROM licenses l WHERE l.reseller_id = r.id)
        AND NOT EXISTS (SELECT 1 FROM reseller_members m WHERE m.reseller_id = r.id AND m.role = 'berater')`, [user.id, rs.id]);
  await query(`INSERT INTO reseller_members (reseller_id, user_id, role) VALUES ($1,$2,'berater') ON CONFLICT (reseller_id, user_id) DO UPDATE SET role = 'berater'`, [rs.id, user.id]);
  await query(`UPDATE partner_team_einladungen SET status = 'angenommen', beantwortet_am = now(), user_id = $2 WHERE id = $1`, [e.id, user.id]);
  await query(`UPDATE partner_team_einladungen SET status = 'zurueckgezogen', beantwortet_am = now() WHERE status = 'offen' AND id <> $1 AND (user_id = $2 OR lower(email) = lower($3))`, [e.id, user.id, user.email || '']);
  await teamMeldung(rs.id, (user.name || e.name || e.email) + ' ist dem Team beigetreten');
  const pn = (await query(`SELECT COALESCE(NULLIF(brand_name,''), name) AS n FROM resellers WHERE id = $1`, [rs.id])).rows[0];
  return { ok: true, angenommen: true, partner_name: pn ? pn.n : null };
}

// ── Mitglieder ───────────────────────────────────────────────────────────────
/** Berater aus dem Team nehmen (Inhaber) oder selbst gehen. Seine Kunden gehen an den Inhaber. */
async function mitgliedEntfernen(rs, actor, rolleWert, userId) {
  if (String(userId) !== String(actor)) nurInhaber(rolleWert);
  if (String(userId) === String(rs.owner_user_id)) throw fehler('inhaber_bleibt', 409, 'Der Inhaber kann das Team nicht verlassen.');
  const m = (await query(`SELECT m.user_id, u.name, u.email FROM reseller_members m JOIN users u ON u.id = m.user_id WHERE m.reseller_id = $1 AND m.user_id = $2 AND m.role = 'berater'`, [rs.id, userId])).rows[0];
  if (!m) throw fehler('mitglied_nicht_gefunden', 404);
  const k = await query(`UPDATE reseller_clients SET berater_id = $3 WHERE reseller_id = $1 AND berater_id = $2 RETURNING id`, [rs.id, userId, rs.owner_user_id]);
  await query(`DELETE FROM reseller_members WHERE reseller_id = $1 AND user_id = $2 AND role = 'berater'`, [rs.id, userId]);
  await teamMeldung(rs.id, (m.name || m.email) + (String(userId) === String(actor) ? ' hat das Team verlassen' : ' wurde aus dem Team genommen') +
    (k.rowCount ? '. ' + k.rowCount + (k.rowCount === 1 ? ' Kunde geht' : ' Kunden gehen') + ' an den Inhaber' : ''));
  return { ok: true, kunden_an_inhaber: k.rowCount };
}

/** Kunden einem anderen Berater geben (berater_id). Inhaber: jeden Kunden; Berater: nur eigene. */
async function kundeZuweisen(rs, actor, rolleWert, client, beraterId) {
  pruefeKunde(rolleWert, actor, client);
  const ziel = (await query(`SELECT m.user_id, u.name, u.email FROM reseller_members m JOIN users u ON u.id = m.user_id WHERE m.reseller_id = $1 AND m.user_id = $2`, [rs.id, beraterId])).rows[0];
  if (!ziel) throw fehler('berater_nicht_im_team', 400, 'Dieser Berater gehört nicht zum Team.');
  await query(`UPDATE reseller_clients SET berater_id = $2 WHERE id = $1`, [client.id, ziel.user_id]);
  return { ok: true, berater_id: ziel.user_id, berater: ziel.name || ziel.email };
}

async function teamMeldung(resellerId, text) {
  try { await query(`INSERT INTO partner_meldungen (reseller_id, client_id, art, text) VALUES ($1, NULL, 'team', $2)`, [resellerId, String(text).slice(0, 400)]); } catch (e) {}
}

/** Alle Nutzer des Teams (Inhaber und Berater) - fuer Abfragen ueber die Objekte des Teams */
async function teamNutzer(resellerId) {
  const r = await query(
    `SELECT user_id FROM reseller_members WHERE reseller_id = $1 UNION SELECT owner_user_id FROM resellers WHERE id = $1 AND owner_user_id IS NOT NULL`, [resellerId]);
  return r.rows.map((x) => x.user_id);
}

// ── v3830 C · Takt: abgelaufene Loeschfristen ────────────────────────────────
async function aufraeumen(opts) {
  const dry = !!(opts && opts.dryRun), F = LOESCHFRISTEN, out = {};
  const schritte = [
    ['meldungen_gelesen', `DELETE FROM partner_meldungen WHERE gelesen_am IS NOT NULL AND gelesen_am < now() - make_interval(days => $1::int)`, F.meldung_gelesen_tage],
    ['meldungen_ungelesen', `DELETE FROM partner_meldungen WHERE gelesen_am IS NULL AND erstellt_am < now() - make_interval(days => $1::int)`, F.meldung_ungelesen_tage],
    ['aufgaben', `DELETE FROM partner_aufgaben WHERE status = 'abgeschlossen' AND abgeschlossen_am IS NOT NULL AND abgeschlossen_am < now() - make_interval(days => $1::int)`, F.aufgabe_abgeschlossen_tage],
    ['uebergaben', `DELETE FROM objekt_uebergaben WHERE (
        (status = 'widerrufen' AND widerrufen_at < now() - make_interval(days => $1::int)) OR
        (status = 'uebernommen' AND uebernommen_at < now() - make_interval(days => $1::int)) OR
        (status IN ('gesendet','geoeffnet') AND expires_at < now() - make_interval(days => $1::int)))`, F.uebergabe_beendet_tage],
    ['team_einladungen', `DELETE FROM partner_team_einladungen WHERE (status <> 'offen' AND COALESCE(beantwortet_am, erstellt_am) < now() - make_interval(days => $1::int)) OR expires_at < now() - make_interval(days => $1::int)`, 90]
  ];
  for (const [k, sql, tage] of schritte) {
    try {
      if (dry) { out[k] = (await query(sql.replace(/^DELETE FROM (\S+) WHERE/, 'SELECT count(*)::int AS n FROM $1 WHERE'), [tage])).rows[0].n; }
      else out[k] = (await query(sql, [tage])).rowCount;
    } catch (e) { out[k] = 'fehler: ' + e.message; }
  }
  return out;
}

module.exports = {
  LOESCHFRISTEN, fristenListe, EINLADUNG_TAGE,
  rolle, darfKunde, nurInhaber, pruefeKunde, zugang,
  team, einladen, einladungZurueckziehen, meineEinladungen, einladungPerToken, beantworten,
  mitgliedEntfernen, kundeZuweisen, teamNutzer, aufraeumen, kontoPruefen, _sha: sha
};
