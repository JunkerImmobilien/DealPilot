'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/objektUebergabe.js — v3317 · OBJEKT AN KUNDEN UEBERGEBEN
 *
 * Marcel 12.11.2026 (freigegebene Spezifikation): ein Partner legt ein Objekt
 * an, rechnet es durch und uebergibt es per E-Mail an einen Kunden. Bisher gab
 * es nur die Gegenrichtung (Kunde reicht beim Partner ein, object_shares) —
 * Dateien/Partner-Demo/Demo-Zugang.md fuehrte es deshalb unter "nicht versprechen".
 *
 * ── Ablauf ────────────────────────────────────────────────────────────────
 *   anlegen()   Partner (Owner oder Mitglied des Reseller-Kontos) waehlt EIGENES
 *               Objekt + E-Mail + optional einen Satz. Zufallstoken (32 Byte),
 *               gespeichert NUR als SHA-256, 30 Tage gueltig. Mail in Partnermarke
 *               (resellerInviteMail.marke/rahmen - derselbe Baustein wie die Einladung).
 *   info()      oeffentlich, Token aus dem Link: zeigt Partner + Objekt, setzt
 *               "geoeffnet" (erster Aufruf).
 *   uebernehmen() angemeldeter Kunde: atomarer Zugriff auf die Zeile (nur einmal),
 *               Kunde wird Mandant des Partners (falls noch nicht), bekommt als NEUER
 *               Mandant einen freien Platz (resellerService.assignSeat - derselbe Weg
 *               wie die Einladung), und eine KOPIE des Objekts (objectService.create,
 *               Fotos wandern dabei in SEINE Dateiablage). Das Original bleibt beim Partner.
 *   bild()      oeffentlich, eigener Zufallsschluessel (nicht das Token): das Titelfoto
 *               fuer die Mail. Mailprogramme laden Bilder ueber Proxys - das Token des
 *               Links soll dort nicht auftauchen.
 *
 * ── Was die Mail zeigt ────────────────────────────────────────────────────
 * Nur GESPEICHERTE Werte des Objekts (data._dealpilot_score, _kpis_cf_ns,
 * _kpis_bmy, _kpis_dscr, svwert). Keine zweite Rechnung: die Stufe kommt aus
 * dem gespiegelten Kern score-tiers.js (services/rechenkerne.stufe), der
 * Monatswert des Cashflows ist Jahr / 12 wie auf der Objektkarte.
 *
 * ── Plaetze ───────────────────────────────────────────────────────────────
 * Kein Stripe-Zugriff. Ist der Empfaenger noch kein Mandant und der Pool leer,
 * lehnt anlegen() mit 409 kein_freier_platz ab (das Portal sagt es VORHER aus
 * der vorpruefung()). Wird der Platz zwischen Senden und Uebernehmen verbraucht,
 * uebernimmt der Kunde trotzdem (Kopie + Mandant), nur ohne Platz -
 * seat_assigned:false, wie bei der Einladung.
 *
 * ── Testadressen ──────────────────────────────────────────────────────────
 * An reservierte Domains (RFC 2606/6761: .test .invalid .example .localhost,
 * example.com/.net/.org) geht KEINE Mail ueber SMTP - sie kaemen als Unzustellbar
 * an info@ zurueck. mail_status 'testadresse', die Mail ist mit mailBauen()
 * jederzeit ansehbar.
 * ═══════════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const { query } = require('../db/pool');
const reseller = require('./resellerService');
const objectService = require('./objectService');
const objektFotos = require('./objektFotos');
const partnerMail = require('./resellerInviteMail');

const GUELTIG_TAGE = 30;
const TAGESGRENZE = 60;          /* Uebergaben je Partner-Konto und 24 h - Schutz gegen Missbrauch als Mailschleuder */
const NACHRICHT_MAX = 600;
const NAME_MAX = 120;
const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function fehler(code, status) { const e = new Error(code); e.status = status; return e; }
function hash(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function neuesToken() { return crypto.randomBytes(32).toString('base64url'); }
function istTestadresse(email) {
  const dom = String(email || '').toLowerCase().split('@')[1] || '';
  return /\.(test|invalid|example|localhost)$/.test(dom) || /^(.+\.)?example\.(com|net|org)$/.test(dom);
}
function zahl(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function _alsObjekt(d) {
  if (typeof d === 'string') { try { return JSON.parse(d) || {}; } catch (e) { return {}; } }
  return d && typeof d === 'object' ? d : {};
}

/* svw_herkunft -> Wortlaut im Kundentext. Nur das Gutachten ist ein Verkehrswert (§ 194 BauGB). */
const HERKUNFT = {
  gutachten: 'Verkehrswertgutachten', bank: 'Bankbewertung', marktbericht: 'Marktbericht',
  indikation: 'Marktpreisindikation aus Angebotspreisen', eigene: 'eigene Schätzung'
};

/** Was die Mail und die Landeseite zeigen - nur gespeicherte Werte. */
function zusammenfassung(data, opts) {
  const d = _alsObjekt(data);
  const strasse = [d.str, d.hnr].filter(Boolean).join(' ').trim();
  const ort = [d.plz, d.ort].filter(Boolean).join(' ').trim();
  const adresse = [strasse, ort].filter(Boolean).join(', ') || d._name || 'Objekt';
  const score = zahl(d._dealpilot_score);
  let stufe = null;
  if (score !== null) {
    try { stufe = require('./rechenkerne').stufe(score); } catch (e) { stufe = null; }
  }
  const cfJahr = zahl(d._kpis_cf_ns);
  const sv = zahl(d.svwert);
  return {
    adresse: adresse,
    seq: d._obj_seq || null,
    objektart: d.objart || d.objektart || null,
    score: score !== null ? Math.round(score) : null,
    stufe: stufe ? { wort: stufe.wort, versal: stufe.versal, farbe: stufe.farbe } : null,
    cashflow_jahr: cfJahr,
    cashflow_monat: cfJahr !== null ? cfJahr / 12 : null,
    rendite_brutto: zahl(d._kpis_bmy),
    dscr: zahl(d._kpis_dscr),
    marktwert: sv !== null && sv > 0 ? { wert: sv, herkunft: HERKUNFT[d.svw_herkunft] || null } : null,
    hat_foto: !!(opts && opts.hatFoto)
  };
}

/* Datenfelder, die beim Kunden nichts zu suchen haben (Kopie, nicht Verschiebung). */
const NICHT_MITNEHMEN = ['_obj_seq', '_deal_won', '_deal_won_at', '_deal_won_state', '_deal_won_at_state', '_deal_lost', '_deal_lost_state', 'halter'];
function datenFuerKopie(data, meta) {
  const d = JSON.parse(JSON.stringify(_alsObjekt(data)));
  NICHT_MITNEHMEN.forEach((k) => { delete d[k]; });
  d._uebergabe = meta;
  return d;
}

// ── Partner-Kontext ────────────────────────────────────────────────────────
async function istPartnerVon(resellerId, userId) {
  const r = await query(
    `SELECT 1 FROM resellers WHERE id = $1 AND owner_user_id = $2
     UNION SELECT 1 FROM reseller_members WHERE reseller_id = $1 AND user_id = $2 LIMIT 1`, [resellerId, userId]);
  return r.rowCount > 0;
}

async function _markeLaden(resellerId, basis) {
  const r = await query(
    `SELECT id, name, brand_name, brand_logo_b64, brand_accent, brand_mail_accent, whitelabel_enabled,
            brand_email, brand_website, brand_company,
            (brand_logo_auf_dunkel IS NOT NULL) AS hat_variante,
            extract(epoch from updated_at)::bigint AS stand
       FROM resellers WHERE id = $1`, [resellerId]);
  const b = r.rows[0] || {};
  b.basis = basis;
  return b;
}

/** Vor dem Senden: ist die Adresse schon Mandant dieses Partners, und gibt es einen freien Platz? */
async function vorpruefung(resellerId, email) {
  email = String(email || '').trim().toLowerCase();
  const m = await query(
    `SELECT c.id FROM reseller_clients c JOIN users u ON u.id = c.user_id
      WHERE c.reseller_id = $1 AND LOWER(u.email) = $2 LIMIT 1`, [resellerId, email]);
  const pool = await reseller.getPool(resellerId);
  const frei = parseInt(pool.frei, 10) || 0;
  const bestehend = m.rowCount > 0;
  /* v3317b · platz_moeglich: das Haekchen "Kundenplatz mitschicken" kann gesetzt werden (neue Adresse + freier Platz) */
  return { bestehender_mandant: bestehend, frei: frei, reserviert: parseInt(pool.reserviert, 10) || 0, braucht_platz: !bestehend,
           kann_senden: bestehend || frei > 0, platz_moeglich: !bestehend && frei > 0 };
}

// ── Mail ───────────────────────────────────────────────────────────────────
function _eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
function _pct(n) { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %'; }
function _dscr(n) { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
/* Statusfarben bleiben in jeder Marke gleich (CLAUDE.md) - deshalb hier fest. */
const STUFENFARBE = { top: '#3FA56C', green: '#3FA56C', gold: '#b8932f', red: '#B8625C', na: '#8a8473' };

/**
 * Baut Betreff, HTML und Text. Rein - ohne Datenbank, fuer Pruefer und Vorschau.
 * @param p { zusammenfassung, nachricht, anzeigeName, link, bildUrl, ablauf, reseller (siehe marke()) }
 */
function mailBauen(p) {
  const esc = partnerMail.esc;
  const m = partnerMail.marke(p.reseller);
  const z = p.zusammenfassung || {};
  const name = String(p.anzeigeName || '').trim();
  const kz = (t, v, u) => '<td style="width:33%;padding:12px 10px;border:1px solid #eee8db;border-radius:8px;background:#FDFCFA;vertical-align:top">' +
      '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8a8473">' + t + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:#1c1a17;margin-top:4px">' + v + '</div>' +
      (u ? '<div style="font-size:11px;color:#8a8473;margin-top:2px">' + u + '</div>' : '') + '</td>';
  const cf = z.cashflow_monat !== null && z.cashflow_monat !== undefined;
  const kennzahlen =
    '<table role="presentation" cellspacing="6" cellpadding="0" style="width:100%;border-collapse:separate;margin:6px -6px 0"><tr>' +
      kz('Cashflow n. St.', cf ? _eur(z.cashflow_monat) : '–', cf ? 'je Monat · ' + _eur(z.cashflow_jahr) + ' im Jahr' : 'nicht berechnet') +
      kz('Rendite', z.rendite_brutto !== null && z.rendite_brutto !== undefined ? _pct(z.rendite_brutto) : '–', 'Bruttomietrendite') +
      kz('DSCR', z.dscr !== null && z.dscr !== undefined ? _dscr(z.dscr) : '–', 'Schuldendienstdeckung') +
    '</tr></table>';
  const stufe = z.stufe || null;
  const scoreZeile = (z.score !== null && z.score !== undefined && stufe)
    ? '<span style="display:inline-block;background:' + (STUFENFARBE[stufe.farbe] || STUFENFARBE.na) + ';color:#fff;font-weight:700;font-size:12px;letter-spacing:.06em;padding:5px 11px;border-radius:20px">' +
        'Score ' + esc(z.score) + ' · ' + esc(stufe.versal) + '</span>'
    : '';
  const bild = p.bildUrl
    ? '<img src="' + esc(p.bildUrl) + '" alt="' + esc(z.adresse) + '" width="504" style="display:block;width:100%;max-width:504px;height:auto;border-radius:10px 10px 0 0;border:0">'
    : '';
  const marktwert = z.marktwert
    ? '<p style="font-size:13px;color:#3a352c;margin:12px 0 0">Wertangabe: <b>' + _eur(z.marktwert.wert) + '</b>' + (z.marktwert.herkunft ? ' (' + esc(z.marktwert.herkunft) + ')' : '') + '</p>'
    : '';
  const satz = String(p.nachricht || '').trim();
  const satzHtml = satz
    ? '<div style="border-left:3px solid ' + esc(m.accent) + ';padding:4px 0 4px 14px;margin:0 0 18px;font-size:14px;line-height:1.6;color:#3a352c;font-style:italic">' +
        esc(satz).replace(/\n/g, '<br>') + '</div>'
    : '';
  const ablauf = p.ablauf ? new Date(p.ablauf).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }) : null;

  const innen =
    '<p style="font-size:15px;margin:0 0 14px">' + (name ? 'Hallo ' + esc(name) + ',' : 'Hallo,') + '</p>' +
    '<p style="font-size:14px;line-height:1.6;color:#3a352c;margin:0 0 16px">' + esc(m.brandName) +
      ' hat ein Objekt für dich durchgerechnet und übergibt es dir.</p>' +
    satzHtml +
    '<div style="border:1px solid #e6e0d4;border-radius:10px;overflow:hidden;margin:0 0 6px">' + bild +
      '<div style="padding:16px 16px 14px">' +
        '<div style="font-size:16px;font-weight:700;color:#1c1a17;margin:0 0 8px">' + esc(z.adresse) + '</div>' +
        scoreZeile + kennzahlen + marktwert +
      '</div>' +
    '</div>' +
    /* v3317b · Platz mitgeschickt */
    (p.platz ? '<p style="font-size:14px;line-height:1.6;color:#1c1a17;margin:18px 0 0;padding:12px 14px;background:#e2f0e6;border-radius:8px">' +
      '<b>Dein Zugang ist schon freigeschaltet.</b> ' + esc(m.brandName) + ' hat dir einen Platz reserviert - du legst nur noch dein Konto an.</p>' : '') +
    '<p style="text-align:center;margin:24px 0">' + partnerMail.knopf(m, 'Objekt öffnen', p.link) + '</p>' +
    '<p style="font-size:12px;color:#8a8473;line-height:1.6">Oder kopiere diesen Link:<br>' + esc(p.link) + '</p>' +
    '<p style="font-size:12px;color:#8a8473;border-top:1px solid #eee;padding-top:14px;margin-top:18px;line-height:1.6">' +
      'Mit dem Link meldest du dich an oder legst ein Konto an; danach liegt eine Kopie des Objekts in deinem Konto. ' +
      'Der Link ist ' + (ablauf ? 'bis ' + ablauf : GUELTIG_TAGE + ' Tage') + ' gültig und lässt sich einmal übernehmen. ' +
      'Die Zahlen sind der Stand der Berechnung beim Versand.' +
    '</p>';

  const t = [];
  t.push(name ? 'Hallo ' + name + ',' : 'Hallo,', '', m.brandName + ' hat ein Objekt für dich durchgerechnet und übergibt es dir.');
  if (satz) t.push('', '„' + satz + '“');
  t.push('', z.adresse);
  if (z.score !== null && z.score !== undefined && stufe) t.push('Score ' + z.score + ' · ' + stufe.wort);
  if (cf) t.push('Cashflow nach Steuern: ' + _eur(z.cashflow_monat) + ' je Monat (' + _eur(z.cashflow_jahr) + ' im Jahr)');
  if (z.rendite_brutto !== null && z.rendite_brutto !== undefined) t.push('Bruttomietrendite: ' + _pct(z.rendite_brutto));
  if (z.dscr !== null && z.dscr !== undefined) t.push('DSCR: ' + _dscr(z.dscr));
  if (z.marktwert) t.push('Wertangabe: ' + _eur(z.marktwert.wert) + (z.marktwert.herkunft ? ' (' + z.marktwert.herkunft + ')' : ''));
  if (p.platz) t.push('', 'Dein Zugang ist schon freigeschaltet: ' + m.brandName + ' hat dir einen Platz reserviert - du legst nur noch dein Konto an.');
  t.push('', 'Objekt öffnen:', p.link, '', 'Der Link ist ' + (ablauf ? 'bis ' + ablauf : GUELTIG_TAGE + ' Tage') + ' gültig und lässt sich einmal übernehmen.');

  return {
    marke: m,
    subject: m.brandName + ' übergibt dir ein Objekt: ' + z.adresse,
    html: partnerMail.rahmen(m, innen),
    text: t.join('\n') + m.textFuss
  };
}

function _link(basis, token) { return String(basis || '').replace(/\/+$/, '') + '/?rp_uebergabe=' + encodeURIComponent(token); }
function _bildUrl(basis, schluessel) {
  return schluessel ? String(basis || '').replace(/\/+$/, '') + '/api/v1/public/objekt-uebergabe/bild/' + schluessel + '.jpg' : null;
}

// ── Anlegen (Partner) ──────────────────────────────────────────────────────
/**
 * @param o { resellerId, userId, objectId, email, anzeigeName, nachricht, basis }
 * @returns { uebergabe (ohne Hash), token, mail }
 */
async function anlegen(o) {
  const email = String(o.email || '').trim().toLowerCase();
  if (!EMAIL_RX.test(email) || email.length > 254) throw fehler('email_ungueltig', 400);
  if (!o.objectId) throw fehler('objectId_fehlt', 400);
  if (!(await istPartnerVon(o.resellerId, o.userId))) throw fehler('kein_partner', 403);
  const nachricht = String(o.nachricht || '').trim().slice(0, NACHRICHT_MAX);
  const anzeigeName = String(o.anzeigeName || '').trim().slice(0, NAME_MAX);

  /* nur EIGENE Objekte (user_id = sendender Partner) */
  const ob = await query('SELECT id, user_id, data, photos FROM objects WHERE id = $1 AND user_id = $2', [o.objectId, o.userId]);
  if (!ob.rowCount) throw fehler('objekt_nicht_gefunden', 404);
  const obj = ob.rows[0];

  const ich = await query('SELECT LOWER(email) AS email FROM users WHERE id = $1', [o.userId]);
  if (ich.rows[0] && ich.rows[0].email === email) throw fehler('eigene_adresse', 400);

  const n = await query(`SELECT COUNT(*)::int AS n FROM objekt_uebergaben WHERE reseller_id = $1 AND created_at > now() - interval '24 hours'`, [o.resellerId]);
  if (n.rows[0].n >= TAGESGRENZE) throw fehler('tagesgrenze', 429);

  const vp = await vorpruefung(o.resellerId, email);
  if (!vp.kann_senden) throw fehler('kein_freier_platz', 409);

  let fotos = obj.photos;
  if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
  const hatFoto = Array.isArray(fotos) && fotos.length > 0 && typeof fotos[0] === 'string';
  const z = zusammenfassung(obj.data, { hatFoto: hatFoto });

  const token = neuesToken();
  const bildSchluessel = hatFoto ? crypto.randomBytes(16).toString('hex') : null;
  const ins = await query(
    `INSERT INTO objekt_uebergaben (reseller_id, absender_user_id, object_id, email, anzeige_name, nachricht,
                                    token_hash, bild_schluessel, zusammenfassung, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + make_interval(days => $10::int))
     RETURNING id, email, anzeige_name, status, created_at, expires_at`,
    [o.resellerId, o.userId, obj.id, email, anzeigeName || null, nachricht || null, hash(token), bildSchluessel,
      JSON.stringify(z), GUELTIG_TAGE]);
  const row = ins.rows[0];

  /* v3317b · Kundenplatz mitschicken: beim SENDEN einen freien Platz fuer genau diese Uebergabe
     reservieren (atomar - zwei gleichzeitige Uebergaben greifen nie denselben Platz). Kein Platz
     mehr frei -> die Uebergabe wird nicht angelegt, 409. Fuer Bestandsmandanten nie. */
  row.lizenz_id = null;
  if (o.platzMitschicken && !vp.bestehender_mandant) {
    const res = await query(
      `UPDATE licenses SET reserviert_fuer = $2
        WHERE id = (SELECT id FROM licenses WHERE reseller_id = $1 AND kind = 'client' AND status = 'pool' AND ${reseller.FREI_SQL}
                     ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id`, [o.resellerId, row.id]);
    if (!res.rowCount) {
      await query('DELETE FROM objekt_uebergaben WHERE id = $1', [row.id]);
      throw fehler('kein_freier_platz', 409);
    }
    row.lizenz_id = res.rows[0].id;
    await query('UPDATE objekt_uebergaben SET lizenz_id = $2 WHERE id = $1', [row.id, row.lizenz_id]);
  }

  const brand = await _markeLaden(o.resellerId, o.basis);
  const mail = mailBauen({ zusammenfassung: z, nachricht: nachricht, anzeigeName: anzeigeName, link: _link(o.basis, token),
                           bildUrl: _bildUrl(o.basis, bildSchluessel), ablauf: row.expires_at, reseller: brand, platz: !!row.lizenz_id });
  let mailStatus;
  if (istTestadresse(email)) {
    mailStatus = 'testadresse';
    console.log('[objekt-uebergabe] Testadresse, keine Mail ueber SMTP:', email, '·', mail.subject);
    /* Fuer die Abnahme: Link ins Protokoll, Mail als Datei unter /tmp (nur Testadressen - reservierte Domains, nie zustellbar) */
    console.log('[objekt-uebergabe] Testadresse, Link:', _link(o.basis, token));
    try { require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'objekt-uebergabe-' + row.id + '.html'), '<!doctype html><meta charset="utf-8"><title>' + partnerMail.esc(mail.subject) + '</title><body style="background:#f3efe6;padding:24px">' + mail.html); } catch (e) {}
  } else {
    try {
      const r = await partnerMail.senden(mail.marke, { to: email, subject: mail.subject, text: mail.text, html: mail.html });
      mailStatus = r && r.dryRun ? 'dry_run' : 'gesendet';
    } catch (e) { mailStatus = 'fehler'; console.error('[objekt-uebergabe] Mail:', e.message); }
  }
  await query('UPDATE objekt_uebergaben SET mail_status = $2 WHERE id = $1', [row.id, mailStatus]);
  row.mail_status = mailStatus;
  return { uebergabe: row, token: token, mail: { status: mailStatus, subject: mail.subject } };
}

// ── Liste / Widerruf (Partner) ─────────────────────────────────────────────
async function liste(resellerId) {
  const r = await query(
    `SELECT u.id, u.object_id, u.email, u.anzeige_name, u.mail_status, u.created_at, u.expires_at,
            u.geoeffnet_at, u.uebernommen_at, u.widerrufen_at, u.seat_assigned, u.lizenz_id,
            /* v3317b · Platz gerade fuer diese Uebergabe reserviert (aktiv) */
            (u.status IN ('gesendet','geoeffnet') AND u.expires_at > now() AND EXISTS (
               SELECT 1 FROM licenses l WHERE l.id = u.lizenz_id AND l.reserviert_fuer = u.id AND l.status = 'pool')) AS platz_reserviert,
            CASE WHEN u.status IN ('gesendet','geoeffnet') AND u.expires_at <= now() THEN 'abgelaufen' ELSE u.status END AS status,
            u.zusammenfassung->>'adresse' AS adresse, (u.zusammenfassung->>'score')::int AS score,
            o.seq_no
       FROM objekt_uebergaben u LEFT JOIN objects o ON o.id = u.object_id
      WHERE u.reseller_id = $1
      ORDER BY u.created_at DESC LIMIT 200`, [resellerId]);
  return r.rows;
}

async function widerrufen(resellerId, id) {
  const r = await query(
    `UPDATE objekt_uebergaben SET status = 'widerrufen', widerrufen_at = now()
      WHERE id = $1 AND reseller_id = $2 AND status IN ('gesendet','geoeffnet') RETURNING id`, [id, resellerId]);
  /* v3317b · ein reservierter Platz ist sofort wieder frei */
  if (r.rowCount) await query('UPDATE licenses SET reserviert_fuer = NULL WHERE reserviert_fuer = $1', [id]);
  return r.rowCount > 0;
}

// ── Oeffentlich: Landeseite ────────────────────────────────────────────────
async function _zeile(token) {
  if (!token || String(token).length < 20) return null;
  const r = await query(
    `SELECT u.*, COALESCE(NULLIF(rs.brand_name,''), rs.name) AS brand_name, rs.whitelabel_enabled
       FROM objekt_uebergaben u JOIN resellers rs ON rs.id = u.reseller_id
      WHERE u.token_hash = $1 LIMIT 1`, [hash(token)]);
  return r.rows[0] || null;
}

async function info(token) {
  const z = await _zeile(token);
  if (!z) return null;
  if (z.status === 'gesendet' && new Date(z.expires_at) > new Date()) {
    await query(`UPDATE objekt_uebergaben SET status = 'geoeffnet', geoeffnet_at = now() WHERE id = $1 AND status = 'gesendet'`, [z.id]);
    z.status = 'geoeffnet';
  }
  const abgelaufen = new Date(z.expires_at) <= new Date();
  const zf = _alsObjekt(z.zusammenfassung);
  return {
    brand_name: z.brand_name,
    email: z.email,
    anzeige_name: z.anzeige_name,
    status: (abgelaufen && z.status !== 'uebernommen') ? 'abgelaufen' : z.status,
    valid: !abgelaufen && (z.status === 'gesendet' || z.status === 'geoeffnet'),
    expires_at: z.expires_at,
    objekt: { adresse: zf.adresse, score: zf.score, stufe: zf.stufe ? zf.stufe.wort : null },
    platz_reserviert: !!z.lizenz_id   /* v3317b */
  };
}

// ── Uebernehmen (angemeldeter Kunde) ───────────────────────────────────────
async function uebernehmen(token, user) {
  const z = await _zeile(token);
  if (!z) throw fehler('uebergabe_nicht_gefunden', 404);
  if (z.status === 'uebernommen') throw fehler('schon_uebernommen', 409);
  if (z.status === 'widerrufen') throw fehler('widerrufen', 410);
  if (new Date(z.expires_at) <= new Date()) throw fehler('abgelaufen', 410);

  /* Ein Partner nimmt sich nicht selbst etwas ab - und ein Mandant hat genau EINEN Partner
     (my-branding, my-reseller lesen je LIMIT 1). */
  const partnerIrgendwo = await query(
    `SELECT 1 FROM resellers WHERE owner_user_id = $1 UNION SELECT 1 FROM reseller_members WHERE user_id = $1 LIMIT 1`, [user.id]);
  if (partnerIrgendwo.rowCount) throw fehler('partnerkonto', 409);
  const fremd = await query('SELECT 1 FROM reseller_clients WHERE user_id = $1 AND reseller_id <> $2 LIMIT 1', [user.id, z.reseller_id]);
  if (fremd.rowCount) throw fehler('mandant_anderer_partner', 409);
  if (!z.object_id) throw fehler('objekt_geloescht', 410);

  /* EINMALIG: wer die Zeile hier umschaltet, hat sie - der zweite Aufruf findet nichts mehr. */
  const greif = await query(
    `UPDATE objekt_uebergaben SET status = 'uebernommen', uebernommen_at = now(), empfaenger_user_id = $2,
            geoeffnet_at = COALESCE(geoeffnet_at, now())
      WHERE id = $1 AND status IN ('gesendet','geoeffnet') AND expires_at > now()
      RETURNING id, status`, [z.id, user.id]);
  if (!greif.rowCount) throw fehler('schon_uebernommen', 409);
  const vorher = z.status;

  try {
    const orig = await objectService.getById(z.absender_user_id, z.object_id);   /* Fotos als data-URLs */
    if (!orig) throw fehler('objekt_geloescht', 410);

    let client = (await query('SELECT * FROM reseller_clients WHERE reseller_id = $1 AND user_id = $2', [z.reseller_id, user.id])).rows[0];
    let neuerMandant = false;
    if (!client) {
      client = await reseller.createClient(z.reseller_id, { userId: user.id, displayName: z.anzeige_name || user.name || z.email });
      neuerMandant = true;
    }
    let seatAssigned = null;
    if (neuerMandant) {
      seatAssigned = false;
      /* v3317b · mitgeschickter Platz: genau DIESER geht an den Kunden */
      try { await reseller.assignSeat(z.reseller_id, client.id, { lizenzId: z.lizenz_id || null }); seatAssigned = true; } catch (e) { /* kein Platz mehr frei - Partner weist spaeter zu */ }
    }
    /* v3317b · Bestandsmandant braucht den reservierten Platz nicht -> zurueck in den Pool */
    if (z.lizenz_id) await query('UPDATE licenses SET reserviert_fuer = NULL WHERE id = $1 AND reserviert_fuer = $2', [z.lizenz_id, z.id]);

    const daten = datenFuerKopie(orig.data, { uebergabe_id: z.id, von: z.brand_name, am: new Date().toISOString(), seq_partner: (orig.data && orig.data._obj_seq) || null });
    let fotos = orig.photos;
    if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
    const kopie = await objectService.create(user.id, { data: daten, aiAnalysis: orig.ai_analysis || null, photos: Array.isArray(fotos) ? fotos : [] });
    try {
      await objectService.logAudit({ userId: user.id, action: 'object.uebergabe_uebernommen', resourceType: 'object', resourceId: kopie.id,
        metadata: { uebergabe_id: z.id, reseller_id: z.reseller_id, original_object_id: z.object_id } });
    } catch (e) {}

    await query('UPDATE objekt_uebergaben SET client_id = $2, kopie_object_id = $3, seat_assigned = $4 WHERE id = $1',
      [z.id, client.id, kopie.id, seatAssigned]);
    return { ok: true, brand_name: z.brand_name, object_id: kopie.id, seq_no: kopie.seq_no, client_id: client.id,
             neuer_mandant: neuerMandant, seat_assigned: seatAssigned };
  } catch (e) {
    /* Kopie gescheitert -> Zeile wieder freigeben, sonst ist der Link verbrannt */
    try {
      await query(`UPDATE objekt_uebergaben SET status = $2, uebernommen_at = NULL, empfaenger_user_id = NULL WHERE id = $1 AND kopie_object_id IS NULL`, [z.id, vorher]);
    } catch (e2) {}
    throw e;
  }
}

// ── Oeffentlich: Titelfoto fuer die Mail ───────────────────────────────────
async function bild(schluessel) {
  if (!/^[0-9a-f]{32}$/.test(String(schluessel || ''))) return null;
  const r = await query(
    `SELECT o.user_id, o.photos FROM objekt_uebergaben u JOIN objects o ON o.id = u.object_id
      WHERE u.bild_schluessel = $1 AND u.status <> 'widerrufen' AND u.expires_at > now() LIMIT 1`, [schluessel]);
  const z = r.rows[0];
  if (!z) return null;
  let fotos = z.photos;
  if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
  if (!Array.isArray(fotos) || !fotos.length) return null;
  const aufgeloest = await objektFotos.zumLesen(z.user_id, [fotos[0]]);
  const m = /^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/i.exec(aufgeloest[0] || '');
  if (!m) return null;
  return { mime: m[1].toLowerCase().replace('image/jpg', 'image/jpeg'), puffer: Buffer.from(m[3], 'base64') };
}

module.exports = {
  anlegen, liste, widerrufen, vorpruefung, info, uebernehmen, bild,
  /* rein, fuer den Pruefer */
  zusammenfassung, mailBauen, datenFuerKopie, hash, istTestadresse, istPartnerVon,
  GUELTIG_TAGE, NICHT_MITNEHMEN
};
