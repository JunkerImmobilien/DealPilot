'use strict';
/**
 * resellerInviteMail.js — Mandanten-Einladungs-Mail (Paket 5)
 * Nutzt den bestehenden mailerService. Branding kaskadiert aus den
 * resellers-Feldern (brand_name/brand_logo_b64/brand_accent) mit
 * DealPilot-Fallback.
 *
 * v3299 · Partner-Demo 11.11.2026 (Befund 2g):
 *   - Text sagte "lädt dich zu DealPilot ein" - bei aktivem Branding jetzt
 *     "lädt dich ein", DealPilot nur noch dezent als Plattform im Fuss.
 *   - brand_mail_accent kam nie an (fehlte im SELECT der Route).
 *   - Das Logo stand als data:-Bild im HTML - Gmail/Outlook zeigen das in
 *     der Regel nicht. Jetzt die gehostete Adresse (routes/partnerLogo.js),
 *     Variante fuer den DUNKLEN Kopf.
 *   - Absendername: der Partner (mailerService fromName), Adresse bleibt
 *     technisch info@dealpilot.immo; Reply-To an die Partner-Kontaktadresse.
 * OHNE Partner-Branding ist die Mail inhaltlich wie vorher.
 *
 * v3317 · Der Rahmen (Kopf mit Logo, Akzentlinie, Fuss "Plattform: DealPilot",
 * Absendername, Reply-To) ist jetzt ein eigener Baustein: marke(r) + rahmen().
 * Grund: die Objekt-Uebergabe (services/objektUebergabe.js) schickt eine zweite
 * Partner-Mail und soll GENAU denselben Rahmen tragen, nicht einen nachgebauten.
 * Die Einladung ist Zeichen fuer Zeichen dieselbe wie vorher (Vergleich alt/neu
 * in tools/objekt-uebergabe-pruefen.mjs, Abschnitt RAHMEN).
 */
const { sendMail } = require('./mailerService');
const { logoUrl } = require('../routes/partnerLogo');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getMailFrom(brandName) {
  var name = brandName || process.env.MAIL_FROM_NAME || 'DealPilot';
  var addr = process.env.MAIL_FROM_ADDRESS || process.env.BETA_SMTP_USER || 'info@dealpilot.immo';
  return '"' + name.replace(/"/g, '') + '" <' + addr + '>';
}

/* Text auf dem Akzent-Knopf: hell oder dunkel, je nachdem was mehr Kontrast hat. */
function _knopfText(hex) {
  var n = parseInt(String(hex).slice(1), 16);
  var f = function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  var L = 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#241c05' : '#ffffff';
}

/**
 * Die Marke eines Partners fuer eine Mail (v3317 aus sendInvite herausgeloest).
 * @param r { id, name, brand_name, brand_logo_b64, brand_accent, brand_mail_accent,
 *            whitelabel_enabled, brand_email, brand_website, brand_company,
 *            hat_variante, stand, basis }
 */
function marke(r) {
  r = r || {};
  var wl = !!(r.whitelabel_enabled && r.brand_name);
  var brandName = wl ? r.brand_name : (r.name || 'DealPilot');
  /* W9-mailaccent: Die Mail-Farbe ist vom App-Akzent entkoppelt (Entscheidung 15.07.).
     brand_mail_accent hat Vorrang; leer/NULL -> Fallback auf brand_accent. */
  var _macc = (r.brand_mail_accent || r.brand_accent);
  var accent = (wl && /^#[0-9a-fA-F]{6}$/.test(_macc || '')) ? _macc : '#C9A84C';

  /* v3299 · gehostetes Logo statt data:. Ein SVG ohne Variante liefert die Route
     nicht aus (404) - dann lieber der Name als Schriftzug. */
  var istSvg = /^data:image\/svg/.test(r.brand_logo_b64 || '');
  var logo = (wl && r.brand_logo_b64 && r.id && (r.hat_variante || !istSvg))
    ? logoUrl(r.basis, r.id, 'dunkel', r.stand) : null;

  var logoHtml = logo
    ? '<img src="' + esc(logo) + '" alt="' + esc(brandName) + '" height="44" style="max-height:44px;max-width:240px;height:auto;margin-bottom:6px;display:block;border:0">'
    : '<div style="font:700 22px Georgia,serif;color:#fff">' + esc(brandName) + '</div>';

  var site = wl && r.brand_website ? String(r.brand_website) : '';
  var siteHref = site ? (/^https?:\/\//i.test(site) ? site : 'https://' + site) : '';
  var fussPartner = wl
    ? '<p style="font-size:11px;color:#a39d8e;margin:10px 0 0">' + esc(r.brand_company || brandName) +
        (site ? ' · <a href="' + esc(siteHref) + '" style="color:#8a8473;text-decoration:none">' + esc(site.replace(/^https?:\/\//i, '')) + '</a>' : '') +
        '<br>Plattform: DealPilot</p>'
    : '';
  var textFuss = wl ? '\n\n' + (r.brand_company || brandName) + (site ? ' · ' + site : '') + '\nPlattform: DealPilot' : '';
  var replyTo = (wl && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.brand_email || '')) ? r.brand_email : undefined;

  return { wl: wl, brandName: brandName, accent: accent, logoHtml: logoHtml, fussPartner: fussPartner,
           textFuss: textFuss, replyTo: replyTo, from: getMailFrom(brandName), fromName: wl ? brandName : undefined };
}

/** Akzent-Knopf in der Partnerfarbe. */
function knopf(m, label, link) {
  return '<a href="' + esc(link) + '" style="background:' + esc(m.accent) + ';color:' + _knopfText(m.accent) + ';font-weight:700;' +
    'padding:13px 26px;border-radius:9px;text-decoration:none;font-size:14px;display:inline-block">' +
    label + '</a>';
}

/** Der Rahmen: Kopf mit Logo, Akzentlinie, Inhalt, Fuss des Partners. `innen` ist fertiges HTML. */
function rahmen(m, innen) {
  return '<div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;background:#fff;border:1px solid #e6e0d4;border-radius:14px;overflow:hidden">' +
      '<div style="background:#0b0b0a;padding:22px 26px">' + m.logoHtml + '</div>' +
      '<div style="background:linear-gradient(105deg,' + esc(m.accent) + ',' + esc(m.accent) + ');height:4px"></div>' +
      '<div style="padding:26px 28px;color:#1c1a17">' +
        innen + m.fussPartner +
      '</div>' +
    '</div>';
}

/** Versand mit Absendername und Reply-To des Partners. */
function senden(m, opts) {
  return sendMail({ from: m.from, fromName: m.fromName, replyTo: m.replyTo,
                    to: opts.to, subject: opts.subject, text: opts.text, html: opts.html,
                    attachments: opts.attachments });
}

/* v3680 · Marcel 17.11.2026: Link auf das Kunden-Video („Mit deinem Partner arbeiten“, Videothek) in JEDE
   Einladung an Kunden. Die Videothek liegt in jeder Umgebung unter <App>/landing/ (gemessen: Staging und Prod 200).
   Ohne Video-Adresse kein Block - die Mail bleibt dann Zeichen fuer Zeichen die alte (Pruefer objekt-uebergabe A1). */
const KUNDEN_VIDEO = 'partner-kunde-1';
function videoLink(basis) {
  return basis ? String(basis).replace(/\/+$/, '') + '/landing/videothek.html?v=' + KUNDEN_VIDEO : '';
}
function videoHtml(m, link) {
  if (!link) return '';
  return '<p style="font-size:13px;line-height:1.6;color:#3a352c;background:#f7f3ea;border-radius:9px;padding:12px 14px;margin:18px 0 0">' +
    'Wie die Zusammenarbeit mit ' + esc(m.brandName) + ' funktioniert, zeigt dir ein kurzes Video in drei Minuten: ' +
    'verbinden, Objekte senden und Anmerkungen bearbeiten.<br>' +
    '<a href="' + esc(link) + '" style="color:' + esc(m.accent) + ';font-weight:700;text-decoration:none">&#9654; Video ansehen</a></p>';
}
function videoText(link) {
  return link ? '\n\nSo funktioniert die Zusammenarbeit (Video, drei Minuten):\n' + link : '';
}
/** Basis-Adresse der App, wie routes/resellerPortal.js inviteBase(). */
function basisAus(req) {
  return process.env.FRONTEND_BASE_URL || process.env.APP_URL || process.env.FRONTEND_URL || ('https://' + req.headers.host);
}

/**
 * @param {object} p
 *   p.email, p.displayName, p.link
 *   p.reseller  siehe marke()
 *   p.video     Adresse des Kunden-Videos (videoLink), optional
 */
async function sendInvite(p) {
  var m = marke(p.reseller);
  var wl = m.wl, brandName = m.brandName;

  var subject = wl ? brandName + ' lädt dich ein' : brandName + ' lädt dich zu DealPilot ein';
  var absatz = wl
    ? esc(brandName) + ' lädt dich ein: Du bekommst einen eigenen Zugang zur Immobilien-Investitionsanalyse, ' +
      'mit dem du Objekte erfassen, durchrechnen und ' + esc(brandName) + ' zur Prüfung freigeben kannst.'
    : esc(brandName) + ' möchte mit dir in <b>DealPilot</b> zusammenarbeiten — der Plattform für ' +
      'Immobilien-Investitionsanalyse. Du bekommst einen eigenen Zugang, mit dem du Objekte ' +
      'erfassen und zur Prüfung freigeben kannst.';

  var html = rahmen(m,
        '<p style="font-size:15px;margin:0 0 14px">Hallo ' + esc(p.displayName) + ',</p>' +
        '<p style="font-size:14px;line-height:1.6;color:#3a352c">' + absatz + '</p>' +
        '<p style="text-align:center;margin:24px 0">' +
          knopf(m, 'Einladung annehmen &amp; Konto anlegen', p.link) +
        '</p>' +
        videoHtml(m, p.video) +
        '<p style="font-size:12px;color:#8a8473;line-height:1.6">Oder kopiere diesen Link:<br>' + esc(p.link) + '</p>' +
        '<p style="font-size:12px;color:#8a8473;border-top:1px solid #eee;padding-top:14px;margin-top:18px">' +
          'Der Link ist 21 Tage gültig. Wenn du nichts damit anfangen kannst, ignoriere diese Mail einfach.' +
        '</p>');

  var text = 'Hallo ' + p.displayName + ',\n\n' +
    (wl ? brandName + ' lädt dich ein.\n' : brandName + ' lädt dich zu DealPilot ein.\n') +
    'Einladung annehmen und Konto anlegen:\n' + p.link + '\n\nDer Link ist 21 Tage gültig.' +
    videoText(p.video) +
    m.textFuss;

  return senden(m, { to: p.email, subject: subject, text: text, html: html });
}

/**
 * v3680 · Anfrage an ein BESTEHENDES Konto (partnerKunden.einladen). Bis v3679 ging hier keine Mail raus,
 * die Anfrage stand nur als Band in der App - wer sich nicht anmeldete, erfuhr nie davon.
 * @param p { email, displayName, link (App-Adresse), reseller, video }
 */
async function sendAnfrage(p) {
  var m = marke(p.reseller);
  var subject = m.wl ? m.brandName + ' möchte sich mit dir verbinden' : m.brandName + ' möchte sich mit dir in DealPilot verbinden';
  var html = rahmen(m,
        '<p style="font-size:15px;margin:0 0 14px">Hallo ' + esc(p.displayName) + ',</p>' +
        '<p style="font-size:14px;line-height:1.6;color:#3a352c">' + esc(m.brandName) + ' möchte mit dir zusammenarbeiten. ' +
          'Melde dich mit deinem Konto an. Die Anfrage erscheint dann oben in der App und unter <b>Mein Partner</b>, dort bestätigst du sie.</p>' +
        '<p style="font-size:14px;line-height:1.6;color:#3a352c">Solange du nicht bestätigst, sieht ' + esc(m.brandName) + ' nichts aus deinem Konto. ' +
          'Auch danach nur die Objekte, die du selbst sendest.</p>' +
        '<p style="text-align:center;margin:24px 0">' + knopf(m, 'Anmelden und Anfrage ansehen', p.link) + '</p>' +
        videoHtml(m, p.video) +
        '<p style="font-size:12px;color:#8a8473;border-top:1px solid #eee;padding-top:14px;margin-top:18px">' +
          'Wenn du nichts damit anfangen kannst, ignoriere diese Mail einfach. Ohne deine Bestätigung entsteht keine Verbindung.' +
        '</p>');
  var text = 'Hallo ' + p.displayName + ',\n\n' + m.brandName + ' möchte mit dir zusammenarbeiten.\n' +
    'Melde dich an. Die Anfrage erscheint oben in der App und unter Mein Partner, dort bestätigst du sie:\n' + p.link +
    '\n\nSolange du nicht bestätigst, sieht ' + m.brandName + ' nichts aus deinem Konto.' +
    videoText(p.video) + m.textFuss;
  return senden(m, { to: p.email, subject: subject, text: text, html: html });
}

/* v3680 · Markenzeile des Partners fuer die Mails, dieselben Spalten wie routes/resellerPortal.js /invite. */
async function markeLaden(query, resellerId, basis) {
  const r = await query(
    "SELECT id, name, brand_name, brand_logo_b64, brand_accent, brand_mail_accent, whitelabel_enabled, " +
    "       brand_email, brand_website, brand_company, (brand_logo_auf_dunkel IS NOT NULL) AS hat_variante, " +
    "       extract(epoch from updated_at)::bigint AS stand FROM resellers WHERE id=$1", [resellerId]);
  const b = r.rows[0] || {};
  b.basis = basis;
  return b;
}

module.exports = { sendInvite: sendInvite, sendAnfrage: sendAnfrage, markeLaden: markeLaden, videoLink: videoLink, basisAus: basisAus, marke: marke, rahmen: rahmen, knopf: knopf, senden: senden, esc: esc };
