'use strict';
/**
 * resellerInviteMail.js — Mandanten-Einladungs-Mail (Paket 5)
 * Nutzt den bestehenden mailerService. Branding kaskadiert aus den
 * resellers-Feldern (brand_name/brand_logo_b64/brand_accent) mit
 * DealPilot-Fallback.
 */
const { sendMail } = require('./mailerService');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getMailFrom(brandName) {
  var name = brandName || process.env.MAIL_FROM_NAME || 'DealPilot';
  var addr = process.env.MAIL_FROM_ADDRESS || process.env.BETA_SMTP_USER || 'dealpilot@junker-immobilien.io';
  return '"' + name.replace(/"/g, '') + '" <' + addr + '>';
}

/**
 * @param {object} p
 *   p.email, p.displayName, p.link
 *   p.reseller { name, brand_name, brand_logo_b64, brand_accent, whitelabel_enabled }
 */
async function sendInvite(p) {
  var r = p.reseller || {};
  var wl = r.whitelabel_enabled && r.brand_name;
  var brandName = wl ? r.brand_name : (r.name || 'DealPilot');
  var accent = (wl && r.brand_accent) ? r.brand_accent : '#C9A84C';
  var logo = (wl && r.brand_logo_b64) ? r.brand_logo_b64 : null;

  var logoHtml = logo
    ? '<img src="' + esc(logo) + '" alt="' + esc(brandName) + '" style="max-height:44px;margin-bottom:6px">'
    : '<div style="font:700 22px Georgia,serif;color:#fff">' + esc(brandName) + '</div>';

  var subject = brandName + ' lädt dich zu DealPilot ein';
  var html =
    '<div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;background:#fff;border:1px solid #e6e0d4;border-radius:14px;overflow:hidden">' +
      '<div style="background:#0b0b0a;padding:22px 26px">' + logoHtml + '</div>' +
      '<div style="background:linear-gradient(105deg,' + esc(accent) + ',' + esc(accent) + ');height:4px"></div>' +
      '<div style="padding:26px 28px;color:#1c1a17">' +
        '<p style="font-size:15px;margin:0 0 14px">Hallo ' + esc(p.displayName) + ',</p>' +
        '<p style="font-size:14px;line-height:1.6;color:#3a352c">' +
          esc(brandName) + ' möchte mit dir in <b>DealPilot</b> zusammenarbeiten — der Plattform für ' +
          'Immobilien-Investitionsanalyse. Du bekommst einen eigenen Zugang, mit dem du Objekte ' +
          'erfassen und zur Prüfung freigeben kannst.' +
        '</p>' +
        '<p style="text-align:center;margin:24px 0">' +
          '<a href="' + esc(p.link) + '" style="background:' + esc(accent) + ';color:#241c05;font-weight:700;' +
          'padding:13px 26px;border-radius:9px;text-decoration:none;font-size:14px;display:inline-block">' +
          'Einladung annehmen &amp; Konto anlegen</a>' +
        '</p>' +
        '<p style="font-size:12px;color:#8a8473;line-height:1.6">Oder kopiere diesen Link:<br>' + esc(p.link) + '</p>' +
        '<p style="font-size:12px;color:#8a8473;border-top:1px solid #eee;padding-top:14px;margin-top:18px">' +
          'Der Link ist 21 Tage gültig. Wenn du nichts damit anfangen kannst, ignoriere diese Mail einfach.' +
        '</p>' +
      '</div>' +
    '</div>';

  var text = 'Hallo ' + p.displayName + ',\n\n' + brandName + ' lädt dich zu DealPilot ein.\n' +
    'Einladung annehmen und Konto anlegen:\n' + p.link + '\n\nDer Link ist 21 Tage gültig.';

  return sendMail({ from: getMailFrom(brandName), to: p.email, subject: subject, text: text, html: html });
}

module.exports = { sendInvite: sendInvite };
