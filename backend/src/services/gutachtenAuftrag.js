'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   services/gutachtenAuftrag.js — v3590
   RND-GUTACHTEN UEBER JUNKER IMMOBILIEN (durchgereicht an gutachten.org)

   Marcel 16.11.2026: Er verkauft die Restnutzungsdauer-Gutachten selbst ueber sein
   Portal und reicht sie an gutachten.org durch. Deshalb:
     - beim Partner steht IMMER Junker Solution als Anfragender (requester) — der
       Partner mailt Marcel, nicht dem Kunden. Die Angaben kommen aus der Umgebung
       (GUTACHTEN_AUFTRAGGEBER_*), nie aus dem Browser.
     - die Daten des Kunden erfasst DealPilot selbst (fuer Marcels Rechnung) und
       speichert sie nur mit ausdruecklicher Zustimmung (Tabelle gutachten_auftraege).
     - der Preis kommt aus EINER Tabelle (unten), gerechnet wird nur hier — die
       Oberflaeche fragt POST /gutachterpartner/preis.

   PREISE: NUR in services/gutachtenPreise.js (vorlaeufig, Stand junker-immobilien.io/preise.html 16.11.2026)
   (gelesen 16.11.2026). Endpreise, Kleinunternehmer § 19 UStG, keine Umsatzsteuer.
   Spaeter im Admin pflegbar (vorgemerkt, Backlog N169).
   ═══════════════════════════════════════════════════════════════════════ */

/* Preise: NUR aus services/gutachtenPreise.js (eine Stelle, vorlaeufig, austauschbar) */
const { preisliste } = require('./gutachtenPreise');

/* v3590 · Schalter: das VERBINDLICHE Absenden des Gutachtens an gutachten.org erst nach Zusage des Partners
   (Marcel fragt an, ob Beauftragung aus der Software geht). Standard AUS: die Bestellung wird in DealPilot
   gespeichert, der Entwurf liegt beim Partner, Marcel wird benachrichtigt und sendet selbst ab. */
function beauftragungAktiv() { return String(process.env.GUTACHTEN_BEAUFTRAGUNG_AKTIV || '').trim().toLowerCase() === 'true'; }

function rund(x) { return Math.round(x * 100) / 100; }

/** Preis fuer EIN Objekt. eingabe: { flaeche, besichtigung: keine|aussen|innen_aussen, express, rabattcode, anzahl } */
function preisBerechnen(eingabe) {
  const e = eingabe || {};
  const fl = Number(String(e.flaeche == null ? '' : e.flaeche).replace(',', '.'));
  if (!isFinite(fl) || fl <= 0) return { fehler: 'flaeche_fehlt', text: 'Bitte die Wohn- bzw. Nutzfläche angeben.' };
  const stufe = preisliste().stufen.find((s) => s.bis == null || fl <= s.bis);
  const besKey = preisliste().besichtigung[e.besichtigung] ? e.besichtigung : 'keine';
  const posten = [{ text: 'Restnutzungsdauer-Gutachten (' + stufe.text + ')', betrag: stufe.preis }];
  if (preisliste().besichtigung[besKey].betrag) posten.push({ text: preisliste().besichtigung[besKey].text, betrag: preisliste().besichtigung[besKey].betrag });
  if (e.express === true) posten.push({ text: preisliste().express.text + ' (' + preisliste().express.hinweis + ')', betrag: preisliste().express.betrag });
  const honorar = posten.reduce((s, p) => s + p.betrag, 0);
  const anzahl = Math.max(1, parseInt(e.anzahl, 10) || 1);
  const menge = preisliste().mengenrabatt.find((m) => anzahl >= m.ab) || null;
  const codeRoh = String(e.rabattcode || '').trim();
  const code = codeRoh ? preisliste().codes[codeRoh.toUpperCase()] || null : null;
  let rabatt = null;
  const kandidaten = [];
  if (menge) kandidaten.push({ art: 'menge', pct: menge.pct, text: 'Mengenrabatt ab ' + menge.ab + ' Gutachten' });
  if (code) kandidaten.push({ art: 'code', pct: code.pct, text: code.text, code: codeRoh.toUpperCase() });
  if (kandidaten.length) {
    rabatt = kandidaten.sort((a, b) => b.pct - a.pct)[0];
    rabatt.betrag = rund(honorar * rabatt.pct / 100);
  }
  return {
    flaeche: fl, stufe: stufe.text, grundpreis: stufe.preis, besichtigung: besKey, express: e.express === true, posten,
    honorar: rund(honorar), rabatt, endpreis: rund(honorar - (rabatt ? rabatt.betrag : 0)),
    code_ungueltig: !!(codeRoh && !code),
    code_text: codeRoh && !code ? 'Der Rabattcode „' + codeRoh.slice(0, 30) + '“ ist uns nicht bekannt. Bitte prüfen – ohne Code gilt der normale Preis.' : null,
    code_nicht_kombiniert: !!(code && menge),
    individuell_moeglich: fl > 1000 || stufe.bis == null,
    anzahl
  };
}

/** Junker Solution als Anfragender beim Partner — nur aus der Umgebung. null, wenn unvollstaendig. */
function auftraggeber() {
  const g = (k) => String(process.env['GUTACHTEN_AUFTRAGGEBER_' + k] || '').trim();
  const a = { firma: g('FIRMA'), vorname: g('VORNAME'), nachname: g('NACHNAME'), strasse: g('STRASSE'), hnr: g('HNR'),
    plz: g('PLZ'), ort: g('ORT'), email: g('EMAIL'), telefon: g('TELEFON'), anzeige: g('ANZEIGE') || 'Junker Immobilien' };
  if (!a.firma || !a.nachname || !a.email || !a.strasse || !a.plz || !a.ort || !a.telefon) return null;
  return a;
}
/* requester im Format der Partner-Formulare (lite und voll) */
function requesterFuerPartner(a, art) {
  const r = { title: 'company', companyName: a.firma, firstName: a.vorname || '-', lastName: a.nachname,
    address: { streetName: a.strasse, streetNumber: a.hnr || '-', postalCode: a.plz, city: a.ort, country: 'DE' },
    phoneNumber: a.telefon, email: a.email };
  if (art === 'lite') Object.assign(r, { leadSource: 'other', leadSourceDetails: 'DealPilot', acceptPrivacy: true, acceptTerms: true });
  return r;
}
/* Vereinbarung beim vollstaendigen Gutachten: Marcel beauftragt als Firma, Zahlung auf Rechnung (an Marcel) */
const BESICHTIGUNG_PARTNER = { keine: 'none', aussen: 'onSiteInspection', innen_aussen: 'interiorExteriorOnSiteInspection' };
function vereinbarungFuerPartner(auswahl) {
  const b = BESICHTIGUNG_PARTNER[(auswahl && auswahl.besichtigung) || 'keine'] || 'none';
  return { desiredProducts: 'noAssessment', paymentType: 'postPay', addonService: b, taxPlausibilityCheckService: 'none',
    leadSource: 'other', leadSourceDetails: 'DealPilot', acceptPrivacy: true, acceptTerms: true, acceptServiceWithdrawalTerms: true,
    generalComments: (auswahl && auswahl.express ? 'Expresszuschlag beauftragt (Fertigstellung binnen einer Woche). ' : '') + 'Beauftragt über Junker Immobilien (DealPilot).' };
}

/* Mail an Marcel. Nie echte Mails von Staging: dort nur an reservierte Testadressen. */
function istTestadresse(email) {
  const dom = String(email || '').toLowerCase().split('@')[1] || '';
  return /\.(test|invalid|example|localhost)$/.test(dom) || /^(.+\.)?example\.(com|net|org)$/.test(dom);
}
function istStaging() { return /staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || ''); }
function mailEmpfaenger() { return String(process.env.GUTACHTEN_AUFTRAG_MAIL || 'info@junker-immobilien.io').trim(); }
async function benachrichtigen(auftrag) {
  const an = mailEmpfaenger();
  if (istStaging() && !istTestadresse(an)) return { status: 'staging_unterdrueckt', an };
  if (istTestadresse(an)) return { status: 'testadresse_nicht_gesendet', an };
  const mailer = require('./mailerService');
  const p = auftrag.preis || {}, k = auftrag.kunde || {};
  const eur = (x) => Number(x || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const text = ['Neuer Gutachtenauftrag über DealPilot (' + ({ beauftragt: 'an gutachten.org abgesendet', bestellt: 'bestellt – Entwurf liegt bei gutachten.org, bitte dort absenden' }[auftrag.status] || 'Entwurf') + ')', '',
    'Kunde: ' + [k.firma, [k.vorname, k.nachname].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    'Anschrift: ' + [k.strasse, k.hnr].filter(Boolean).join(' ') + ', ' + [k.plz, k.ort].filter(Boolean).join(' '),
    'E-Mail: ' + (k.email || '–') + ' · Telefon: ' + (k.telefon || '–'), '',
    'Objekt: ' + (auftrag.objekt_text || '–'),
    'Leistung: ' + (p.posten || []).map((x) => x.text + ' ' + eur(x.betrag)).join(' · '),
    p.rabatt ? 'Rabatt: ' + p.rabatt.text + ' −' + eur(p.rabatt.betrag) : 'Rabatt: –',
    'Endpreis: ' + eur(p.endpreis) + ' (§ 19 UStG, keine USt)',
    'Express: ' + (auftrag.auswahl && auftrag.auswahl.express ? 'ja' : 'nein'),
    'gutachten.org Anfrage-Nr.: ' + (auftrag.request_number || '–'), 'Zeit: ' + new Date().toISOString()].join('\n');
  try {
    await mailer.sendMail({ to: an, subject: 'Gutachtenauftrag ' + (auftrag.request_number || '') + ' · ' + eur(p.endpreis), text });
    return { status: 'gesendet', an };
  } catch (e) { return { status: 'fehler', an, fehler: e.message }; }
}

module.exports = { preisliste, beauftragungAktiv, preisBerechnen, auftraggeber, requesterFuerPartner, vereinbarungFuerPartner, BESICHTIGUNG_PARTNER,
  benachrichtigen, istTestadresse, istStaging, mailEmpfaenger };
