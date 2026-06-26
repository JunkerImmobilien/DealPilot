'use strict';
/*
 * emailChangeMailTemplate.js — Boarding-Look (Gold/Schwarz), passend zu verifyMailTemplate.
 * Verify-Mail geht an die NEUE Adresse, Notice-Mail an die ALTE (Account-Sicherheit).
 * Absender setzt mailerService (BETA_MAIL_FROM).
 */
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function subjectVerify() { return 'Neue E-Mail bestätigen \u2014 DealPilot'; }
function subjectNotice() { return 'Deine DealPilot-E-Mail wurde geändert'; }

function renderVerifyText(firstName, verifyUrl, newEmail) {
  var fn = (firstName || '').toString().trim() || 'Pilot';
  return 'Hallo ' + fn + ',\n\n' +
    'du möchtest deine DealPilot-Login-Adresse auf ' + newEmail + ' ändern.\n' +
    'Bestätige die neue Adresse über diesen Link (24 Stunden gültig):\n\n' +
    verifyUrl + '\n\n' +
    'Danach meldest du dich mit der neuen Adresse neu an. Deine bisherige Adresse bleibt bis zur Bestätigung gültig.\n\n' +
    'Wenn du das nicht warst, ignoriere diese E-Mail \u2014 es ändert sich nichts.\n\n\u2014 DealPilot';
}

function renderVerifyMail(firstName, verifyUrl, newEmail) {
  var fn = _esc((firstName || '').toString().trim() || 'Pilot');
  return '' +
'<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Neue E-Mail bestätigen</title></head>' +
'<body style="margin:0;padding:0;background:#EDE7DA;font-family:Arial,Helvetica,sans-serif;">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE7DA;"><tr>' +
'<td align="center" style="padding:28px 12px;">' +
'<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">' +
'<tr><td style="background:#070707;border-radius:16px 16px 0 0;padding:18px 26px;">' +
  '<span style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;">Deal<span style="color:#E8CC7A;">Pilot</span></span>' +
  '<span style="float:right;font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:2px;color:#C9A84C;">RE-CHECK-IN</span>' +
'</td></tr>' +
'<tr><td style="background:#C9A84C;background:linear-gradient(110deg,#E8CC7A,#C9A84C 60%,#b8932f);padding:30px 26px 26px;">' +
  '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;letter-spacing:3px;color:#5a4a14;font-weight:700;">E-MAIL-WECHSEL \u00b7 BEST\u00c4TIGUNG</div>' +
  '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:25px;line-height:1.2;font-weight:700;color:#1a1407;margin-top:8px;">Neue Adresse best\u00e4tigen, ' + fn + '.</div>' +
  '<div style="font-size:14px;line-height:1.5;color:#3a2e08;margin-top:8px;">Du m\u00f6chtest dich k\u00fcnftig mit <b>' + _esc(newEmail) + '</b> einloggen. Best\u00e4tige die Adresse \u2014 danach meldest du dich neu an.</div>' +
'</td></tr>' +
'<tr><td style="background:#ffffff;padding:26px;border-radius:0 0 16px 16px;">' +
  '<a href="' + verifyUrl + '" style="display:inline-block;background:#070707;color:#E8CC7A;font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">Neue E-Mail best\u00e4tigen</a>' +
  '<div style="font-size:12px;color:#8a8473;margin-top:16px;line-height:1.5;">Link 24 Stunden g\u00fcltig. Deine bisherige Adresse bleibt bis dahin aktiv. Warst du das nicht? Ignoriere diese Mail \u2014 es \u00e4ndert sich nichts.</div>' +
'</td></tr>' +
'</table></td></tr></table></body></html>';
}

function renderNoticeText(firstName, newEmail) {
  var fn = (firstName || '').toString().trim() || 'Pilot';
  return 'Hallo ' + fn + ',\n\n' +
    'die Login-Adresse deines DealPilot-Accounts wurde soeben auf ' + newEmail + ' geändert.\n\n' +
    'Warst du das nicht? Dann melde dich SOFORT bei support@junker-immobilien.io \u2014 wir helfen dir, deinen Account zu sichern.\n\n\u2014 DealPilot';
}

function renderNoticeMail(firstName, newEmail) {
  var fn = _esc((firstName || '').toString().trim() || 'Pilot');
  return '' +
'<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1.0"><title>E-Mail geändert</title></head>' +
'<body style="margin:0;padding:0;background:#EDE7DA;font-family:Arial,Helvetica,sans-serif;">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE7DA;"><tr>' +
'<td align="center" style="padding:28px 12px;">' +
'<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">' +
'<tr><td style="background:#070707;border-radius:16px 16px 0 0;padding:18px 26px;">' +
  '<span style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;">Deal<span style="color:#E8CC7A;">Pilot</span></span>' +
  '<span style="float:right;font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:2px;color:#C9A84C;">SICHERHEIT</span>' +
'</td></tr>' +
'<tr><td style="background:#ffffff;padding:28px 26px;border-radius:0 0 16px 16px;">' +
  '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:20px;font-weight:700;color:#1a1407;">Hallo ' + fn + ',</div>' +
  '<div style="font-size:14px;line-height:1.6;color:#3a2e08;margin-top:10px;">die Login-Adresse deines DealPilot-Accounts wurde soeben auf <b>' + _esc(newEmail) + '</b> ge\u00e4ndert.</div>' +
  '<div style="font-size:14px;line-height:1.6;color:#B86250;margin-top:14px;font-weight:700;">Warst du das nicht?</div>' +
  '<div style="font-size:14px;line-height:1.6;color:#3a2e08;margin-top:4px;">Melde dich sofort bei <a href="mailto:support@junker-immobilien.io" style="color:#b8932f;font-weight:700;">support@junker-immobilien.io</a> \u2014 wir sichern deinen Account.</div>' +
'</td></tr>' +
'</table></td></tr></table></body></html>';
}

module.exports = {
  subjectVerify: subjectVerify,
  subjectNotice: subjectNotice,
  renderVerifyText: renderVerifyText,
  renderVerifyMail: renderVerifyMail,
  renderNoticeText: renderNoticeText,
  renderNoticeMail: renderNoticeMail
};
