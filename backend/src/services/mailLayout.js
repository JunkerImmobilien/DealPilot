'use strict';
/*
 * mailLayout.js (v775) — Gemeinsames DealPilot-Maillayout (Boarding-Pass, Gold/Schwarz).
 * Single-Source-of-Truth für künftige Mails (Lifecycle, Massenmail, Ticket-Antworten).
 *   wrap({preheader, brandTag, heroKicker, heroTitle, heroSubtitle, bodyHtml, footerNote}) -> volle HTML
 *   button(label, url) -> Obsidian-CTA
 *   text({title, bodyText}) -> Plain-Text-Gerüst
 * Tischlerei-frei: nur Inline-Styles + Tabellen (E-Mail-kompatibel).
 */
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function button(label, url) {
  return '<a href="' + url + '" style="display:inline-block;background:#070707;color:#E8CC7A;' +
    'font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:700;font-size:15px;' +
    'padding:14px 28px;border-radius:10px;text-decoration:none;">' + _esc(label) + '</a>';
}

function wrap(o) {
  o = o || {};
  var brandTag  = _esc(o.brandTag || 'DEALPILOT');
  var kicker    = o.heroKicker || '';
  var title     = o.heroTitle || '';
  var sub       = o.heroSubtitle || '';
  var body      = o.bodyHtml || '';
  var preheader = o.preheader || '';
  var footer    = o.footerNote || 'DealPilot \u00b7 Junker Immobilien \u00b7 <a href="https://www.junker-immobilien.io" style="color:#b8932f;text-decoration:none;">junker-immobilien.io</a>';

  var hero = '';
  if (kicker || title || sub) {
    hero =
    '<tr><td style="background:#C9A84C;background:linear-gradient(110deg,#E8CC7A,#C9A84C 60%,#b8932f);padding:30px 26px 26px;">' +
      (kicker ? '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;letter-spacing:3px;color:#5a4a14;font-weight:700;">' + _esc(kicker) + '</div>' : '') +
      (title ? '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:25px;line-height:1.2;font-weight:700;color:#1a1407;margin-top:8px;">' + _esc(title) + '</div>' : '') +
      (sub ? '<div style="font-size:14px;line-height:1.5;color:#3a2e08;margin-top:8px;">' + sub + '</div>' : '') +
    '</td></tr>';
  }

  var bodyRadius = hero ? '' : 'border-radius:0;';
  return '' +
  '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
  '<body style="margin:0;padding:0;background:#EDE7DA;font-family:Arial,Helvetica,sans-serif;">' +
  (preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EDE7DA;font-size:1px;line-height:1px;">' + _esc(preheader) + '</div>' : '') +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE7DA;"><tr>' +
  '<td align="center" style="padding:28px 12px;">' +
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">' +
  '<tr><td style="background:#070707;border-radius:16px 16px 0 0;padding:18px 26px;">' +
    '<span style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;">Deal<span style="color:#E8CC7A;">Pilot</span></span>' +
    '<span style="float:right;font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:2px;color:#C9A84C;">' + brandTag + '</span>' +
  '</td></tr>' +
  hero +
  '<tr><td style="background:#ffffff;padding:26px;' + bodyRadius + '">' + body + '</td></tr>' +
  '<tr><td style="background:#FAF6EC;padding:18px 26px;border-top:1px solid #E6DFCE;border-radius:0 0 16px 16px;font-size:11px;color:#8a8473;line-height:1.6;">' + footer + '</td></tr>' +
  '</table></td></tr></table></body></html>';
}

function text(o) {
  o = o || {};
  return (o.title ? o.title + '\n\n' : '') + (o.bodyText || '') + '\n\n\u2014 DealPilot \u00b7 Junker Immobilien \u00b7 www.junker-immobilien.io';
}

module.exports = { wrap: wrap, button: button, text: text, _esc: _esc };
