'use strict';
/**
 * v627 — Verify-Mail im Boarding-Pass-Design.
 * Wird von registerWithVerify.js genutzt: subject() / renderVerifyText() / renderVerifyMail().
 * Absender setzt mailerService (BETA_MAIL_FROM = "DealPilot <dealpilot@junker-immobilien.io>").
 */

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function subject() {
  return 'Dein Boarding-Pass \u2014 Check-in bestätigen';
}

/* W21-verifytext: Die Text-Variante leckte "DealPilot" zweimal plus die Prod-URL.
   Ein Mandant, dessen Mail-Programm HTML blockt, las also im Reseller-Onboarding
   "dein DealPilot-Team". Jetzt optional gebrandet; OHNE brand byte-identisch. */
function renderVerifyText(firstName, verifyUrl, brand) {
  var fn = (firstName || '').toString().trim() || 'Pilot';
  var nm = (brand && brand.name) ? brand.name : 'DealPilot';
  var url = (brand && brand.website) ? brand.website : 'https://dealpilot.junker-immobilien.io';
  return (
    'Hallo ' + fn + ',\n\n' +
    'dein Check-in bei ' + nm + ' ist fast fertig \u2014 bitte bestätige deine E-Mail-Adresse,\n' +
    'um dein Cockpit zu aktivieren:\n\n' +
    verifyUrl + '\n\n' +
    'Der Link ist 24 Stunden gültig. Falls du dich nicht angemeldet hast, ignoriere diese Mail.\n\n' +
    'Guten Flug \u2014 dein ' + nm + '-Team\n' +
    url
  );
}

/* W19-mailbrand: Der Mandant bekam die Einladung im Reseller-Branding und danach
   eine DealPilot-Verify-Mail — Bruch mitten im Onboarding. Jetzt optional:
     renderVerifyMail(name, url, { accent, name, brandTag, footerNote, supportEmail })
   OHNE brand ist die Ausgabe byte-identisch zu vorher. */
function _b_hx(h) { return /^#[0-9a-fA-F]{6}$/.test(h || '') ? h : null; }
function _b_mix(hex, p) {
  var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  function f(v) {
    var x = p > 0 ? v + (255 - v) * p : v * (1 + p);
    return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2);
  }
  return '#' + f(r) + f(g) + f(b);
}
function _brand(o) {
  o = o || {};
  var a = _b_hx(o.accent);
  return {
    acc:  a || '#C9A84C',
    hi:   a ? _b_mix(a, 0.22)  : '#E8CC7A',
    lo:   a ? _b_mix(a, -0.16) : '#b8932f',
    wordmark: o.name ? _esc(o.name)
            : 'Deal<span style="color:' + (a ? _b_mix(a, 0.22) : '#E8CC7A') + ';">Pilot</span>',
    tag:  _esc(o.brandTag || 'DEALPILOT'),
    foot: o.footerNote || null,
    sup:  o.supportEmail || 'support@junker-immobilien.io'
  };
}

function renderVerifyMail(firstName, verifyUrl, brand) {
  var fn = _esc((firstName || '').toString().trim() || 'Pilot');
  var url = verifyUrl;
  var B = _brand(brand);
  return '' +
'<!DOCTYPE html>\n' +
'<html lang="de" xmlns="http://www.w3.org/1999/xhtml">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<meta http-equiv="X-UA-Compatible" content="IE=edge">\n' +
'<title>Check-in bestätigen</title>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">\n' +
'<!--[if mso]><style type="text/css">body,table,td,a{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->\n' +
'<style>\n' +
'  body{margin:0;padding:0;background:#EDE7DA;}\n' +
'  a{text-decoration:none;}\n' +
'  @media (max-width:620px){\n' +
'    .container{width:100%!important;}\n' +
'    .px{padding-left:22px!important;padding-right:22px!important;}\n' +
'    .stub{display:block!important;width:100%!important;border-radius:14px 14px 0 0!important;}\n' +
'    .ticketbody{display:block!important;width:100%!important;border-radius:0 0 14px 14px!important;}\n' +
'    .fields td{display:table-cell!important;width:33%!important;vertical-align:top!important;padding-right:6px!important;}\n' +
'    .perf{display:none!important;}\n' +
'    .ticketbody{padding:16px 18px!important;}\n' +  /* v631-ticket-mobile */

'  }\n' +
'</style>\n' +
'</head>\n' +
'<body style="margin:0;padding:0;background:#EDE7DA;">\n' +
'<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EDE7DA;font-size:1px;line-height:1px;">\n' +
'  Nur noch ein Klick: bestätige deine E-Mail und dein Cockpit ist startklar.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;\n' +
'</div>\n' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE7DA;">\n' +
'<tr><td align="center" style="padding:28px 12px;">\n' +
'  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">\n' +
'    <tr>\n' +
'      <td style="background:#070707;border-radius:16px 16px 0 0;padding:18px 26px;" class="px">\n' +
'        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>\n' +
'          <td align="left" style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.3px;">\n' +
'            ' + B.wordmark + '\n' +
'          </td>\n' +
'          <td align="right" style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:10px;letter-spacing:2px;color:' + B.acc + ';">\n' +
'            PRE-FLIGHT &middot; CHECK-IN\n' +
'          </td>\n' +
'        </tr></table>\n' +
'      </td>\n' +
'    </tr>\n' +
'    <tr>\n' +
'      <td style="background:' + B.acc + ';background:linear-gradient(110deg,' + B.hi + ',' + B.acc + ' 60%,' + B.lo + ');padding:30px 26px 26px;" class="px">\n' +
'        <div style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:11px;letter-spacing:3px;color:#5a4a14;font-weight:700;">BOARDING PASS \u00b7 CHECK-IN</div>\n' +
'        <div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:27px;line-height:1.2;font-weight:700;color:#1a1407;margin-top:8px;">\n' +
'          Willkommen an Bord,&nbsp;' + fn + '.\n' +
'        </div>\n' +
'        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#3a2e08;margin-top:8px;max-width:430px;">\n' +
'          Nur noch ein Klick: bestätige deine E-Mail-Adresse und dein Cockpit ist startklar. Ab dann fliegst du nicht mehr nach Bauchgefühl, sondern nach Flugdaten.\n' +
'        </div>\n' +
'      </td>\n' +
'    </tr>\n' +
'    <tr>\n' +
'      <td style="background:#ffffff;padding:24px 26px;" class="px">\n' +
'        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E6DFCE;border-radius:14px;">\n' +
'          <tr>\n' +
'            <td class="stub" width="170" valign="middle" style="background:#070707;border-radius:14px 0 0 14px;padding:20px 18px;">\n' +
'              <div style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:8px;letter-spacing:2px;color:#9a8f6a;">PASSENGER</div>\n' +
'              <div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:15px;font-weight:700;color:' + B.hi + ';margin-top:3px;">' + fn + '</div>\n' +
'              <div style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:8px;letter-spacing:1px;color:#9a8f6a;margin-top:12px;">FLIGHT</div>\n' +
'              <div style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:13px;font-weight:700;color:#ffffff;margin-top:2px;">DP \u00b7 BOARDING</div>\n' +
'            </td>\n' +
'            <td class="perf" width="1" style="border-left:2px dashed #d9cfb4;font-size:0;line-height:0;">&nbsp;</td>\n' +
'            <td class="ticketbody" valign="middle" style="padding:18px 22px;">\n' +
'              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fields"><tr>\n' +
'                <td style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:8px;letter-spacing:1px;color:#8a8473;padding-right:18px;">\n' +
'                  GATE<br><span style="font-size:13px;color:#1a1407;font-weight:700;">COCKPIT</span>\n' +
'                </td>\n' +
'                <td style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:8px;letter-spacing:1px;color:#8a8473;padding-right:18px;">\n' +
'                  TANK<br><span style="font-size:13px;color:#1a1407;font-weight:700;">KEROSIN \u2713</span>\n' +
'                </td>\n' +
'                <td style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:8px;letter-spacing:1px;color:#8a8473;">\n' +
'                  STATUS<br><span style="font-size:13px;color:' + B.acc + ';font-weight:700;">CHECK-IN</span>\n' +
'                </td>\n' +
'              </tr></table>\n' +
'              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4a4536;margin-top:14px;">\n' +
'                Dein Co-Pilot sitzt schon im Cockpit. Bestätige deine E-Mail \u2014 dann lädst du dein erstes Exposé hoch und wir berechnen Marktwert, Cashflow und DealScore in Minuten.\n' +
'              </div>\n' +
'            </td>\n' +
'          </tr>\n' +
'        </table>\n' +
'      </td>\n' +
'    </tr>\n' +
'    <tr>\n' +
'      <td align="center" style="background:#ffffff;padding:4px 26px 30px;" class="px">\n' +
'        <table role="presentation" cellpadding="0" cellspacing="0"><tr>\n' +
'          <td align="center" bgcolor="#0a0a0a" style="border-radius:11px;">\n' +
'            <a href="' + url + '" target="_blank"\n' +
'               style="display:inline-block;font-family:\'Space Grotesk\',Arial,sans-serif;font-size:15px;font-weight:700;color:' + B.hi + ';padding:14px 30px;border-radius:11px;">\n' +
'              \u2708&nbsp;&nbsp;Check-in abschließen\n' +
'            </a>\n' +
'          </td>\n' +
'        </tr></table>\n' +
'        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a8473;margin-top:12px;">\n' +
'          Klappt der Button nicht? Kopiere diesen Link in deinen Browser:<br>\n' +
'          <a href="' + url + '" style="color:#8d7430;word-break:break-all;">' + url + '</a>\n' +
'        </div>\n' +
'      </td>\n' +
'    </tr>\n' +
'    <tr>\n' +
'      <td style="background:#FAF6EC;padding:24px 26px;border-top:1px solid #E6DFCE;" class="px">\n' +
'        <div style="font-family:\'JetBrains Mono\',\'Courier New\',monospace;font-size:10px;letter-spacing:2px;color:#8d7430;font-weight:700;margin-bottom:14px;">DEIN PRE-FLIGHT-CHECK</div>\n' +
'        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">\n' +
'          <tr>\n' +
'            <td valign="top" width="28" style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:15px;font-weight:700;color:' + B.acc + ';">1</td>\n' +
'            <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4a4536;padding-bottom:10px;"><b style="color:#1a1407;">Objekt einlesen</b> \u2014 Exposé/Marktbericht hochladen oder per Sprache erfassen.</td>\n' +
'          </tr>\n' +
'          <tr>\n' +
'            <td valign="top" width="28" style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:15px;font-weight:700;color:' + B.acc + ';">2</td>\n' +
'            <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4a4536;padding-bottom:10px;"><b style="color:#1a1407;">Marktwert abrufen</b> \u2014 Marktbewertung &amp; DealScore auf Knopfdruck.</td>\n' +
'          </tr>\n' +
'          <tr>\n' +
'            <td valign="top" width="28" style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:15px;font-weight:700;color:' + B.acc + ';">3</td>\n' +
'            <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4a4536;"><b style="color:#1a1407;">Abheben</b> \u2014 bankfertige Analyse als PDF, mit Co-Pilot an deiner Seite.</td>\n' +
'          </tr>\n' +
'        </table>\n' +
'      </td>\n' +
'    </tr>\n' +
'    <tr>\n' +
'      <td style="background:#070707;border-radius:0 0 16px 16px;padding:24px 26px;" class="px">\n' +
'        <div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;">Guten Flug \u2014 dein DealPilot-Team \u2708</div>\n' +
'        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9a8f6a;margin-top:12px;">\n' +
'          Fragen? Antworte einfach auf diese Mail oder schreib an\n' +
'          <a href="mailto:' + B.sup + '" style="color:' + B.acc + ';">' + B.sup + '</a>.\n' +
'        </div>\n' +
'        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#6a6453;margin-top:14px;border-top:1px solid #1f1c14;padding-top:14px;">\n' +
'          Junker Immobilien \u00b7 DealPilot<br>\n' +
'          Du erhältst diese Mail, weil du dich gerade bei DealPilot registriert hast. Der Link ist 24 Stunden gültig.\n' +
'        </div>\n' +
'      </td>\n' +
'    </tr>\n' +
'  </table>\n' +
'</td></tr>\n' +
'</table>\n' +
'</body>\n' +
'</html>';
}

module.exports = { subject: subject, renderVerifyText: renderVerifyText, renderVerifyMail: renderVerifyMail };
