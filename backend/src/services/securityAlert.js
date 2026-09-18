'use strict';
/**
 * v1370 (B8) — Adminbenachrichtigung bei wichtigen Sicherheitsereignissen
 * ══════════════════════════════════════════════════════════════════════
 *
 * Marcels Punkt B8: „Adminbenachrichtigung bei allen wichtigen
 * Ereignissen."
 *
 * Seit v1367 landen Beobachtungen in `security_events`, seit v1368 sind
 * sie im Admin sichtbar. Beides setzt voraus, dass jemand hinsieht. Wer
 * nachts um drei ausgelesen wird, erfährt es sonst am Montag.
 *
 * ────────────────────────────────────────────────────────────────────
 * WANN — und warum nicht öfter
 *
 * Nur zwei Anlässe lösen eine Mail aus:
 *
 *   1. die berechnete Stufe erreicht WARNUNG oder HOHES RISIKO
 *   2. ein Mensch hat eingeschränkt oder gesperrt
 *
 * „Auffällig" tut es ausdrücklich NICHT. Diese Stufe erreicht jeder,
 * der einmal zu schnell klickt — eine Mail dafür wäre nach drei Tagen
 * Tapete, und dann liest auch die wichtige niemand mehr.
 *
 * ────────────────────────────────────────────────────────────────────
 * DER TON
 *
 * Die Mail berichtet ZAHLEN und nennt den Maßstab daneben. Sie fordert
 * nichts und schlägt nichts vor. Marcels Auflage gilt auch hier: eine
 * technische Auffälligkeit ist kein bewiesener Verstoß, und eine Mail,
 * die anders klingt, erzeugt genau den Reflex, den er nicht will.
 *
 * Spam-Schutz über `app_alerts` — dieselbe Tabelle und dasselbe Muster
 * wie `creditAlert.js` (v554). Höchstens eine Mail je Konto und
 * Zeitfenster; ein Skript mit tausend Anfragen erzeugt eine Mail, nicht
 * tausend.
 */
const { sendMail } = require('./mailerService');
const { query } = require('../db/pool');

const ALERT_TO   = process.env.SECURITY_ALERT_TO || process.env.CREDIT_ALERT_TO
                || 'info@dealpilot.immo';
/* Sechs Stunden: lang genug, dass ein anhaltender Vorgang nicht zumüllt,
   kurz genug, dass zwei verschiedene Vorfälle an einem Tag beide
   ankommen. */
const RUHE_MS = parseInt(process.env.SECURITY_ALERT_RUHE_MIN || '360', 10) * 60 * 1000;

function darfSenden(letzte) {
  if (!letzte) return true;
  return (Date.now() - new Date(letzte).getTime()) >= RUHE_MS;
}

/**
 * Meldet eine berechnete Stufe. Wird nur an den Schwellen aufgerufen,
 * nicht bei jeder Überschreitung — sonst kostet die Benachrichtigung mehr
 * Abfragen als der Vorgang, den sie meldet.
 */
async function stufeMelden({ userId, email, stufe, grund, vergleich }) {
  try {
    if (stufe !== 'warnung' && stufe !== 'hohes_risiko') return { gesendet: false };

    const key = 'sec_stufe_' + String(userId).slice(0, 40);
    const r = await query('SELECT last_sent_at FROM app_alerts WHERE alert_key = $1', [key]);
    if (!darfSenden(r.rows[0] && r.rows[0].last_sent_at)) {
      return { gesendet: false, grund: 'ruhefenster' };
    }

    const g = grund || {};
    const v = vergleich || {};
    const wer = email || ('Konto ' + userId);

    await sendMail({
      to: ALERT_TO,
      subject: 'DealPilot Sicherheit: ' + (stufe === 'hohes_risiko' ? 'hohes Risiko' : 'Warnung')
             + ' bei ' + wer,
      text: [
        'Ein Konto hat eine Stufe erreicht, die laut Konfiguration gemeldet wird.',
        '',
        'Konto:  ' + wer,
        'Stufe:  ' + (stufe === 'hohes_risiko' ? 'HOHES RISIKO' : 'WARNUNG'),
        '',
        'Woran das gemessen wurde:',
        '  Limit-Ueberschreitungen : ' + (g.ueberschreitungen != null ? g.ueberschreitungen : '?')
          + (g.schwelle ? '  (Schwelle ' + g.schwelle + ')' : ''),
        '  Endpunktgruppen        : ' + (g.vielfalt != null ? g.vielfalt : '?')
          + '   (normale Nutzung: ' + (v.normalnutzung_vielfalt || '?') + ')',
        '  Streuung der Abstaende : ' + (g.streuung != null ? String(g.streuung).replace('.', ',') : 'zu wenig Daten')
          + '   (normale Nutzung: ' + String(v.normalnutzung_streuung || '?').replace('.', ',') + ')',
        '  Zeitfenster            : ' + (g.fenster_minuten || 60) + ' Minuten',
        '',
        'WAS DAS HEISST UND WAS NICHT:',
        'Das sind Beobachtungen. Eine technische Auffaelligkeit ist kein',
        'bewiesener Vertragsverstoss - sie kann genauso gut ein zuegiger Nutzer',
        'oder ein Fehlalarm sein. Das System hat NICHTS gesperrt und wird auch',
        'nichts sperren; jede Einschraenkung setzt ein Mensch.',
        '',
        'Die vollstaendige Fallakte steht im Admin unter Sicherheit.',
        '',
        '-- DealPilot'
      ].join('\n')
    });

    await query(
      `INSERT INTO app_alerts (alert_key, last_sent_at) VALUES ($1, NOW())
       ON CONFLICT (alert_key) DO UPDATE SET last_sent_at = NOW()`,
      [key]
    );
    return { gesendet: true };
  } catch (e) {
    /* Eine Benachrichtigung, die scheitert, darf den Vorgang nicht
       aufhalten - sie ist die Zugabe, nicht die Aufgabe. */
    console.warn('[sec-alert] Stufenmeldung nicht verschickt:', e.message);
    return { gesendet: false, fehler: e.message };
  }
}

/**
 * Meldet eine menschliche Entscheidung. Hier gibt es KEIN Ruhefenster:
 * wer sperrt, tut das selten, und jede dieser Entscheidungen gehört
 * protokolliert und gemeldet.
 */
async function entscheidungMelden({ email, adminEmail, art, notiz, standVorher }) {
  try {
    const was = art === 'gesperrt' ? 'GESPERRT'
              : art === 'eingeschraenkt' ? 'EINGESCHRAENKT'
              : 'MANUELL FREIGEGEBEN';

    await sendMail({
      to: ALERT_TO,
      subject: 'DealPilot Sicherheit: ' + was + ' — ' + (email || 'Konto'),
      text: [
        'Ein Administrator hat einen Kontozustand gesetzt.',
        '',
        'Konto:        ' + (email || '?'),
        'Neuer Stand:  ' + was,
        'Gesetzt von:  ' + (adminEmail || 'unbekannt'),
        'Berechnet war: ' + (standVorher || '?'),
        '',
        'Begruendung:',
        '  ' + (notiz || '(keine)'),
        '',
        'Der Eintrag steht in der Fallakte und laesst sich nicht aendern -',
        'eine Korrektur ist ein neuer Eintrag.',
        '',
        '-- DealPilot'
      ].join('\n')
    });
    return { gesendet: true };
  } catch (e) {
    console.warn('[sec-alert] Entscheidungsmeldung nicht verschickt:', e.message);
    return { gesendet: false, fehler: e.message };
  }
}

module.exports = { stufeMelden, entscheidungMelden, ALERT_TO, RUHE_MS };
