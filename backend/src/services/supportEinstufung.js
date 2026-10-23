'use strict';
/**
 * v2935 · SUPPORT-EINSTUFUNG (Migration 091).
 *
 * Marcel am 23.10.2026: genau genug beschriebene Fehler kommen ins
 * Fehler-Backlog (ein Agent arbeitet sie ab, wenn er danach fragt), bei zu
 * duenner Beschreibung entsteht eine Rueckfrage an den Kunden im DealPilot-
 * Design. Die Rueckfrage geht NICHT von selbst raus: sie liegt als Entwurf am
 * Ticket und wird im Admin mit einem Klick gesendet (Marcels Wahl am
 * 23.10.2026 - erst einmal mit Freigabe).
 *
 * Was an die KI geht: Kategorie, der Text des Kunden (vorher regelbasiert
 * geschwaerzt, services/schwaerzen.js), ob ein Objekt und wie viele Bilder
 * anhaengen, die technische Diagnose ohne E-Mail. KEINE Bilder, kein Objekt-JSON.
 *
 * Abschaltbar mit SUPPORT_KI=aus. Ohne Schluessel oder bei Fehler bleibt das
 * Ticket wie bisher - die Einstufung ist ein Zusatz, nie eine Huerde.
 */
const { query } = require('../db/pool');

const ARTEN = ['fehler', 'bedienfrage', 'wunsch', 'abrechnung', 'sonstiges'];

function _diagnoseOhnePerson(d) {
  if (!d || typeof d !== 'object') return {};
  const o = {};
  Object.keys(d).forEach(function (k) {
    if (/mail|name|user_id|token|phone|tel/i.test(k)) return;
    const v = d[k];
    if (v == null) return;
    o[k] = (typeof v === 'object') ? JSON.stringify(v).slice(0, 300) : String(v).slice(0, 200);
  });
  return o;
}

function _prompt(t) {
  return [
    'Du sortierst Support-Anfragen fuer DealPilot, eine Web-App zur Analyse von Immobilien-Investments',
    '(Reiter: Objekt, Investition, Miete, Finanzierung, Bewirtschaftung, Steuer, Pilot-Analyse, Bewertung,',
    'Deal-Aktion; dazu Quick-Check, Marktbericht, PDF-Export, Portfolio-Cockpit, Telegram-Bot).',
    'Benutze KEINE Websuche. Antworte NUR mit einem JSON-Objekt, ohne Erklaerung davor oder danach.',
    '',
    'Felder:',
    '  "art": eins von "fehler" | "bedienfrage" | "wunsch" | "abrechnung" | "sonstiges"',
    '  "genau_genug": true, wenn ein Entwickler den FEHLER ohne Rueckfrage nachstellen kann: es ist klar,',
    '      WO (Reiter/Funktion), WAS getan wurde (Schritte), was ERWARTET wurde und was STATTDESSEN passierte.',
    '      Bilder und ein angehaengtes Objekt helfen, sind aber KEINE Voraussetzung: nennt der Text Ort, Schritte,',
    '      Erwartung und Ergebnis, ist er genau genug. Bei art != "fehler" immer false.',
    '  "titel": hoechstens 80 Zeichen, sachlich, OHNE Namen, Anschriften, E-Mail-Adressen',
    '  "beschreibung": fuer den Entwickler, gegliedert in "Wo:", "Schritte:", "Erwartet:", "Tatsaechlich:",',
    '      "Hinweise:" - OHNE Namen, Anschriften, E-Mail-Adressen, Telefonnummern (durch [Kunde]/[Adresse] ersetzen)',
    '  "fehlt": Liste, was fuer das Nachstellen fehlt (leer, wenn genau_genug)',
    '  "fragen": 1 bis 4 konkrete Rueckfragen an den Kunden in der Du-Form, nur wenn art="fehler" und',
    '      genau_genug=false; freundlich, kurz, jede Frage beantwortbar ohne Fachwissen; z. B. nach dem Reiter,',
    '      den Schritten, der erwarteten Zahl, einem Bildschirmfoto. Frage NIE nach etwas, das der Text schon',
    '      sagt, und zweifle die Eingaben des Kunden nicht an ("hast du richtig eingegeben?" ist verboten).',
    '  "beschreibung" ist ein TEXT (String), kein Objekt.',
    '  "prioritaet": "hoch" (Daten falsch/verloren, Rechnung falsch, Zahlung, nichts geht), "mittel", "niedrig"',
    '',
    'Kategorie im Formular: ' + (t.category || '-'),
    'Objekt angehaengt: ' + (t.objekt ? 'ja' : 'nein') + ' · Bilder: ' + (t.bilder || 0),
    'Technische Diagnose: ' + JSON.stringify(t.diagnose || {}).slice(0, 800),
    '',
    'Text des Kunden (geschwaerzt):',
    '"""',
    String(t.text || '').slice(0, 3000),
    '"""'
  ].join('\n');
}

function _jsonAus(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('keine JSON-Antwort');
  return JSON.parse(s.slice(a, b + 1));
}

function _rueckfrageText(fragen) {
  const f = (fragen || []).filter(Boolean).slice(0, 4);
  if (!f.length) return null;
  return 'Hallo,\n\ndanke für deine Nachricht. Damit wir den Fehler nachstellen und beheben können, '
    + 'brauchen wir noch ein paar Angaben:\n\n'
    + f.map(function (q, i) { return (i + 1) + '. ' + String(q).trim(); }).join('\n')
    + '\n\nEin Bildschirmfoto der Stelle hilft uns sehr – du kannst es einfach an diese E-Mail anhängen.'
    + '\n\nViele Grüße\nDein DealPilot-Support';
}

async function einstufen(ticketId) {
  if (String(process.env.SUPPORT_KI || '').toLowerCase() === 'aus') return { uebersprungen: 'SUPPORT_KI=aus' };
  const tr = await query(
    `SELECT t.id, t.category, t.object_snapshot IS NOT NULL AS objekt, t.diagnose,
            (SELECT body FROM ticket_messages m WHERE m.ticket_id = t.id AND m.sender = 'user' ORDER BY created_at ASC LIMIT 1) AS text,
            (SELECT COUNT(*) FROM ticket_attachments a WHERE a.ticket_id = t.id AND a.sender = 'user')::int AS bilder
       FROM support_tickets t WHERE t.id = $1`, [ticketId]);
  if (!tr.rowCount) return { fehler: 'ticket fehlt' };
  const t = tr.rows[0];
  let text = t.text || '';
  try { text = require('./schwaerzen').schwaerze(text).text; } catch (e) {}
  const openai = require('./openaiService');
  /* v2935a · nicht COPILOT_MODEL: gemessen am 23.10.2026 stufte gpt-4o-mini eine
     Meldung mit Ort, Schritten, Erwartung und Ergebnis als "nicht genau genug" ein
     und fragte den Kunden, ob er richtig eingegeben habe. */
  const model = process.env.SUPPORT_MODEL || 'gpt-4.1';
  const res = await openai.callOpenAI(_prompt({
    category: t.category, objekt: t.objekt, bilder: t.bilder,
    diagnose: _diagnoseOhnePerson(t.diagnose), text: text
  }), { model: model, noWebSearch: true, aiOptions: { temperature: 0.1 } });
  const e = _jsonAus(res.text);
  const art = ARTEN.indexOf(e.art) >= 0 ? e.art : 'sonstiges';
  const genau = art === 'fehler' && e.genau_genug === true;
  const einstufung = {
    art: art, genau_genug: genau,
    fehlt: Array.isArray(e.fehlt) ? e.fehlt.slice(0, 6).map(String) : [],
    fragen: Array.isArray(e.fragen) ? e.fragen.slice(0, 4).map(String) : [],
    prioritaet: ['hoch', 'mittel', 'niedrig'].indexOf(e.prioritaet) >= 0 ? e.prioritaet : 'mittel',
    modell: res.model || model
  };
  const titel = String(e.titel || '').slice(0, 120) || null;
  /* v2935a · manche Modelle liefern die Gliederung als Objekt {Wo, Schritte, ...} -
     gemessen stand dann "[object Object]" im Backlog. */
  let _b = e.beschreibung;
  if (_b && typeof _b === 'object') {
    _b = Object.keys(_b).map(function (k) {
      const v = _b[k];
      return k.replace(/:$/, '') + ': ' + (Array.isArray(v) ? '\n  - ' + v.join('\n  - ') : String(v));
    }).join('\n');
  }
  const beschreibung = String(_b || '').slice(0, 4000) || null;
  let backlog = null, entwurf = null, rfStatus = null;
  if (art === 'fehler' && genau) backlog = 'offen';
  if (art === 'fehler' && !genau) { entwurf = _rueckfrageText(einstufung.fragen); rfStatus = entwurf ? 'entwurf' : null; }
  /* Eine schon gesetzte Backlog-Stufe (in_arbeit, erledigt) wird nicht zurueckgedreht. */
  await query(
    `UPDATE support_tickets SET einstufung = $2, einstufung_at = NOW(),
            fehler_titel = COALESCE($3, fehler_titel), fehler_beschreibung = COALESCE($4, fehler_beschreibung),
            fehler_backlog = CASE WHEN fehler_backlog IN ('in_arbeit','erledigt') THEN fehler_backlog ELSE $5 END,
            rueckfrage_entwurf = CASE WHEN rueckfrage_status = 'gesendet' THEN rueckfrage_entwurf ELSE $6 END,
            rueckfrage_status  = CASE WHEN rueckfrage_status = 'gesendet' THEN rueckfrage_status ELSE $7 END
      WHERE id = $1`,
    [ticketId, JSON.stringify(einstufung), titel, beschreibung, backlog, entwurf, rfStatus]);
  return { einstufung: einstufung, fehler_backlog: backlog, rueckfrage: !!entwurf };
}

/* Fuer die Ticket-Annahme: nie blockieren, nie werfen. */
function einstufenImHintergrund(ticketId) {
  setImmediate(function () {
    einstufen(ticketId).then(function (r) {
      console.log('[support-ki] Ticket ' + String(ticketId).slice(0, 8) + ':', JSON.stringify({ art: r.einstufung && r.einstufung.art, backlog: r.fehler_backlog, rueckfrage: r.rueckfrage, uebersprungen: r.uebersprungen }));
    }).catch(function (e) { console.error('[support-ki] Ticket ' + String(ticketId).slice(0, 8) + ' nicht eingestuft:', e.message); });
  });
}

async function backlogListe(status) {
  const r = await query(
    `SELECT t.id, t.fehler_titel, t.fehler_beschreibung, t.fehler_backlog, t.einstufung, t.category,
            t.created_at, t.fehler_erledigt_commit, t.object_snapshot IS NOT NULL AS objekt,
            (SELECT COUNT(*) FROM ticket_attachments a WHERE a.ticket_id = t.id)::int AS bilder
       FROM support_tickets t
      WHERE t.fehler_backlog IS NOT NULL ${status && status !== 'alle' ? 'AND t.fehler_backlog = $1' : ''}
      ORDER BY (t.fehler_backlog = 'offen') DESC, t.created_at ASC LIMIT 200`,
    status && status !== 'alle' ? [status] : []);
  return r.rows;
}

async function backlogSetzen(ticketId, status, commit) {
  if (['offen', 'in_arbeit', 'erledigt', 'kein_fehler', null].indexOf(status) < 0) return { error: 'ungueltiger Status' };
  await query(`UPDATE support_tickets SET fehler_backlog = $2, fehler_erledigt_commit = COALESCE($3, fehler_erledigt_commit) WHERE id = $1`,
    [ticketId, status, commit ? String(commit).slice(0, 40) : null]);
  return { ok: true };
}

module.exports = { einstufen, einstufenImHintergrund, backlogListe, backlogSetzen, _rueckfrageText, _jsonAus };
