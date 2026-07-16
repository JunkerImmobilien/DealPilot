'use strict';
/**
 * resellerBrandLookup.js (W19) — Branding fuer Mails ermitteln
 *
 * PROBLEM: Ein Mandant bekommt die Einladung im Reseller-Branding
 * (resellerInviteMail.js, seit W9/W13 korrekt), klickt, registriert sich —
 * und bekommt dann eine DealPilot-gebrandete Verify-Mail. Bruch mitten im
 * Onboarding, genau an der Stelle, wo Vertrauen entsteht.
 *
 * Die Mail-Vorlagen sind synchron und wissen nichts von der DB. Dieser Helfer
 * macht den Nachschlag und liefert ein fertiges brand-Objekt, das
 * verifyMailTemplate/welcomeMail/mailLayout direkt verstehen.
 *
 * WICHTIG: brand_mail_accent hat Vorrang (Entkopplung vom 15.07.), Fallback
 * brand_accent. Ohne Reseller / ohne Whitelabel -> null -> alles bleibt DealPilot.
 */
const { query } = require('../db/pool');

function _row2brand(r) {
  if (!r || !r.whitelabel_enabled || !r.brand_name) return null;
  const acc = r.brand_mail_accent || r.brand_accent || null;
  const site = r.brand_website || '';
  const parts = [r.brand_company || r.brand_name];
  if (r.brand_city) parts.push(r.brand_city);
  let footer = parts.join(' \u00b7 ');
  if (site) {
    const href = /^https?:\/\//i.test(site) ? site : 'https://' + site;
    const label = site.replace(/^https?:\/\//i, '');
    footer += ' \u00b7 <a href="' + href + '" style="color:' + (acc || '#b8932f') + ';text-decoration:none;">' + label + '</a>';
  }
  return {
    name: r.brand_name,
    brandTag: String(r.brand_name).toUpperCase().slice(0, 28),
    accent: /^#[0-9a-fA-F]{6}$/.test(acc || '') ? acc : null,
    logo: r.brand_logo_b64 || null,
    footerNote: footer,
    supportEmail: r.brand_email || null,
    /* W21-website: die Text-Variante der Verify-Mail braucht eine Adresse fuer
       die Fusszeile — sonst stuende dort weiter dealpilot.junker-immobilien.io. */
    website: site ? (/^https?:\/\//i.test(site) ? site : 'https://' + site) : null
  };
}

const SEL = `rs.whitelabel_enabled, rs.brand_name, rs.brand_company, rs.brand_logo_b64,
             rs.brand_accent, rs.brand_mail_accent, rs.brand_city, rs.brand_website, rs.brand_email`;

/** Vor der Registrierung: gibt es eine offene Einladung fuer diese Adresse? */
async function brandForEmail(email) {
  if (!email) return null;
  try {
    const r = await query(
      `SELECT ${SEL}
         FROM reseller_invites i JOIN resellers rs ON rs.id = i.reseller_id
        WHERE lower(i.email) = lower($1) AND i.status = 'pending'
        ORDER BY i.invited_at DESC LIMIT 1`, [email]);
    return _row2brand(r.rows[0]);
  } catch (e) { return null; }   // Branding ist Kuer, nie mail-blockierend
}

/** Nach der Registrierung: haengt der User an einem Reseller? */
async function brandForUser(userId) {
  if (!userId) return null;
  try {
    const r = await query(
      `SELECT ${SEL}
         FROM reseller_clients c JOIN resellers rs ON rs.id = c.reseller_id
        WHERE c.user_id = $1 LIMIT 1`, [userId]);
    return _row2brand(r.rows[0]);
  } catch (e) { return null; }
}

/** Beides versuchen — erst der User, dann eine offene Einladung. */
async function brandFor(userId, email) {
  return (await brandForUser(userId)) || (await brandForEmail(email));
}

module.exports = { brandForEmail, brandForUser, brandFor };
