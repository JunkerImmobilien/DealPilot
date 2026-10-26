'use strict';
/* services/telegramPdfService.js — PDFs fuer den Bot (v2961)
 *
 * Die PDFs der App entstehen im Browser (jsPDF). Der Bot baut sie NICHT
 * nach: er bittet den PDF-Dienst (pdf-dienst/, eigener Container), die
 * echte App mit einem 5-Minuten-Token fuer genau diesen Nutzer zu oeffnen
 * und DIESELBE Funktion wie der Knopf zu rufen. Zurueck kommt die Datei,
 * die die App heruntergeladen haette — und die geht per sendDocument raus.
 *
 *   > Eine zweite PDF-Fassung im Backend waere am ersten Tag dieselbe und
 *   > ab dem zweiten eine andere.
 *
 * Ohne PDF_DIENST_SECRET (Produktion bis zur Freigabe) sagt der Bot das und
 * gibt den Weg in die App — er tut nicht so, als gaebe es das PDF.
 */
const { query } = require('../db/pool');
const jwtUtil = require('../utils/jwt');
const config = require('../config');

const ARTEN = {
  investment: { name: 'Investment-PDF (hell)', objekt: true },
  investment_dunkel: { name: 'Investment-PDF (Obsidian)', objekt: true },
  bank:       { name: 'Investment Case (Bankfassung)', objekt: true },
  bank_kurz:  { name: 'Investment Case (Kurzfassung)', objekt: true },
  bankexport: { name: 'Bankexport (alle Darlehen)', objekt: false },
  marktbericht: { name: 'Marktbericht', objekt: true, bericht: true }
};

function verfuegbar() {
  return Boolean(process.env.PDF_DIENST_SECRET);
}

function dienstUrl() {
  return String(process.env.PDF_DIENST_URL || 'http://dealpilot-pdf:4100').replace(/\/+$/, '');
}

async function _sitzung(userId) {
  const r = await query('SELECT id, email, name, role FROM users WHERE id = $1', [userId]);
  if (!r.rows.length) throw new Error('Nutzer nicht gefunden');
  const u = r.rows[0];
  return { userId: u.id, email: u.email, name: u.name, role: u.role };
}

/** Erzeugt das PDF. Rueckgabe { pdf: Buffer, dateiname, ms, speicherMb }
 *  oder wirft einen Fehler mit .fachlich und ggf. .luecken / .toasts. */
async function erzeugen(userId, art, objektId, reportId) {
  if (!ARTEN[art]) throw Object.assign(new Error('Unbekannte PDF-Art: ' + art), { fachlich: true });
  if (!verfuegbar()) {
    throw Object.assign(new Error('Der PDF-Dienst ist hier nicht eingerichtet.'), { fachlich: true, kein_dienst: true });
  }
  const s = await _sitzung(userId);
  /* Dieselbe Nutzlast wie beim Login (auth.js sessionFromUser), nur kurz. */
  const token = jwtUtil.signKurz({ userId: s.userId, email: s.email, name: s.name, role: s.role }, '5m');
  const sitzung = Object.assign({}, s, { mode: 'api', expires: Date.now() + 5 * 60 * 1000 });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 180000);
  let r;
  try {
    r = await fetch(dienstUrl() + '/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pdf-Geheimnis': process.env.PDF_DIENST_SECRET },
      body: JSON.stringify({ art: art, objekt_id: objektId || null, report_id: reportId || null,
        token: token, sitzung: sitzung }),
      signal: ctrl.signal
    });
  } catch (e) {
    throw Object.assign(new Error('Der PDF-Dienst antwortet nicht.'), { fachlich: true });
  } finally { clearTimeout(t); }

  if (r.status === 200) {
    const pdf = Buffer.from(await r.arrayBuffer());
    let name = ARTEN[art].name + '.pdf';
    try { name = decodeURIComponent(r.headers.get('x-dateiname') || '') || name; } catch (e) {}
    return { pdf, dateiname: name, ms: Number(r.headers.get('x-dauer-ms')) || null,
      speicherMb: Number(r.headers.get('x-speicher-mb')) || null };
  }
  const j = await r.json().catch(() => ({}));
  const e = new Error(j.fehler || ('PDF-Dienst HTTP ' + r.status));
  e.fachlich = true; e.code = j.code; e.luecken = j.luecken; e.toasts = j.toasts;
  e.konsole = j.konsole; e.schritte = j.schritte; e.blockiert = j.blockiert;
  e.vorher = j.vorher; e.fenster = j.fenster; e.saves = j.saves;
  try {
    console.warn('[telegram v2961] PDF ' + art + ' fehlgeschlagen: ' + (j.code || r.status) + ' '
      + String(j.fehler || '').slice(0, 160) + ' toasts=' + JSON.stringify(j.toasts || []).slice(0, 200));
  } catch (_) {}
  throw e;
}

/** Ein Satz fuer den Nutzer, wenn es nicht geklappt hat. */
function fehlerSatz(e, art) {
  const name = (ARTEN[art] && ARTEN[art].name) || 'PDF';
  if (e && e.kein_dienst) {
    return 'Das ' + name + ' kann ich hier noch nicht erzeugen. In DealPilot: Aktionen › Export.';
  }
  if (e && e.code === 'luecken' && Array.isArray(e.luecken) && e.luecken.length) {
    return 'Für das ' + name + ' fehlt noch: '
      + e.luecken.map((l) => l.was + (l.wo ? ' (' + l.wo + ')' : '')).join(', ') + '.';
  }
  if (e && e.code === 'kein_pdf') {
    const t = (e.toasts || []).filter(Boolean).slice(-1)[0];
    return 'DealPilot hat kein ' + name + ' erzeugt' + (t ? ': „' + String(t).replace(/^alert: /, '').slice(0, 200) + '"' : '.')
      + ' In der App unter Aktionen › Export siehst du den Grund genauer.';
  }
  if (e && e.code === 'voll') return 'Gerade laufen schon PDFs. Frag mich in einer Minute noch einmal.';
  return 'Das ' + name + ' ist nicht entstanden: ' + ((e && e.message) || 'unbekannter Fehler') + '.';
}

function appLink() {
  return String((config.frontend && config.frontend.baseUrl) || '').replace(/\/+$/, '');
}

module.exports = { erzeugen, fehlerSatz, verfuegbar, ARTEN, appLink };
