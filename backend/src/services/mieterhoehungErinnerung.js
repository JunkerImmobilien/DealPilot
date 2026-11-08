'use strict';
/**
 * v3218 · W-12b · Erinnerung vor möglicher Mieterhöhung
 *
 * Wunsch des Entwicklungspartners (W-12, Staging 07.11.2026): ein bis zwei Monate,
 * bevor laut Rechnung eine Mieterhöhung verlangt werden kann, eine Mail an den
 * Nutzer - NUR mit seiner Einwilligung (Einstellung „Erinnerung vor Mieterhöhung",
 * Standard aus).
 *
 * NICHTS NEU GERECHNET. Die Termine rechnet das Frontend (mietpotenzial-kern.js
 * mhTermine über potenzial.js modell -> sollFuer) und speichert sie seit v3159 beim
 * Speichern des Objekts mit: objects.data._soll_einheiten.einheiten[] mit
 * verlangbar_ab / wirksam_ab ('JJJJ-MM'), Nummer und Lage der Einheit, Ist- und
 * Soll-Miete - KEIN Mietername. Hier wird nur gelesen und verschickt.
 *
 * Keine Migration:
 *   · Einwilligung     user_settings, Schlüssel 'erinnerungen' ({ mieterhoehung: true })
 *                      - geschrieben NUR von routes/erinnerungen.js, Nachweis zusätzlich
 *                      in consent_log (art 'erinnerung_mieterhoehung')
 *   · Merker           retention_log (kind 'mieterhoehung', ref_key je Objekt, Einheit
 *                      und Termin; UNIQUE (user_id, kind, ref_key)) - je Termin höchstens
 *                      eine Mail, auch nach Neustart oder ausgefallenem Tag
 *
 * Nur Objekte im Bestand (_deal_won, nicht _deal_lost): eine Erhöhung beim Ankauf-Deal
 * betrifft niemanden.
 */
const { query } = require('../db/pool');
const mailer = require('./mailerService');
let _mailLayout = null;
try { _mailLayout = require('./mailLayout'); } catch (e) { _mailLayout = null; }

const KIND = 'mieterhoehung';
const SCHLUESSEL = 'erinnerungen';
const VORLAUF_TAGE = 62;            /* „ein bis zwei Monate vorher": ab 62 Tagen vor dem Termin */
const APP_URL = process.env.FRONTEND_BASE_URL || 'https://dealpilot.junker-immobilien.io';

function _ym(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + '-' + m[2] : null; }
function _mmjj(ym) { return ym ? ym.slice(5, 7) + '/' + ym.slice(0, 4) : ''; }
function _zahl(v) { const n = Number(v); return v == null || v === '' || !isFinite(n) ? null : n; }
function _eur(v) { return Math.round(v).toLocaleString('de-DE') + ' €'; }
function _isoTag(d) { return d.toISOString().slice(0, 10); }

/**
 * Reine Funktion (ohne DB, prüfbar): welche Einheiten eines Objekts sind jetzt fällig?
 *   se:    objects.data._soll_einheiten
 *   heute: 'JJJJ-MM-TT'
 * Fällig: verlangbar_ab liegt in der ZUKUNFT und höchstens VORLAUF_TAGE entfernt, und laut
 * Rechnung ist eine Erhöhung möglich (Soll § 558 über Ist). Ein Termin „sofort" (heute oder
 * früher) ist keine Erinnerung mehr wert - er steht schon in der App.
 */
function faellige(se, heute, vorlaufTage) {
  const vorlauf = vorlaufTage == null ? VORLAUF_TAGE : vorlaufTage;
  const liste = se && Array.isArray(se.einheiten) ? se.einheiten : [];
  const h = new Date(String(heute).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(h)) return [];
  const out = [];
  liste.forEach(function (e, i) {
    if (!e || e.status === 'leer') return;
    const va = _ym(e.verlangbar_ab);
    if (!va) return;
    const ist = _zahl(e.ist_monat);
    const soll = _zahl(e.soll558_monat != null ? e.soll558_monat : e.soll_monat);
    if (!(ist > 0) || !(soll > ist + 0.5)) return;
    const termin = new Date(va + '-01T00:00:00Z');
    const tage = Math.round((termin - h) / 86400000);
    if (tage <= 0 || tage > vorlauf) return;
    out.push({
      nr: e.nr != null && String(e.nr).trim() ? String(e.nr).trim() : String(i + 1),
      lage: e.lage ? String(e.lage) : '',
      verlangbar_ab: va,
      wirksam_ab: _ym(e.wirksam_ab),
      ist_monat: ist,
      soll_monat: soll,
      tage: tage
    });
  });
  return out;
}

/* ref_key: VARCHAR(80) in retention_log - 'mh:' + UUID(36) + ':' + JJJJ-MM + ':' + Einheit (gekürzt) */
function refKey(objektId, f) {
  return ('mh:' + objektId + ':' + f.verlangbar_ab + ':' + String(f.nr).slice(0, 28)).slice(0, 80);
}

function _objektName(o) {
  return [o.kuerzel, o.name].filter(function (x) { return x && String(x).trim(); }).join(' · ') || 'Objekt';
}

function mailInhalt(user, posten) {
  const zeilen = posten.map(function (p) {
    const f = p.f;
    return '• ' + _objektName(p.o) + (p.mehrere ? ', Einheit ' + f.nr + (f.lage ? ' (' + f.lage + ')' : '') : '')
      + ': verlangbar ab ' + _mmjj(f.verlangbar_ab)
      + (f.wirksam_ab ? ', wirksam ab ' + _mmjj(f.wirksam_ab) : '')
      + ' – laut Rechnung ' + _eur(f.ist_monat) + ' → bis ' + _eur(f.soll_monat) + ' im Monat';
  });
  const subject = posten.length === 1
    ? 'Erinnerung: Mieterhöhung ab ' + _mmjj(posten[0].f.verlangbar_ab) + ' möglich'
    : 'Erinnerung: ' + posten.length + ' Mieterhöhungen bald möglich';
  const text = 'Hallo' + (user.name ? ' ' + user.name : '') + ',\n\n'
    + 'du hast in DealPilot die Erinnerung vor Mieterhöhungen eingeschaltet. Laut deiner Rechnung '
    + 'kannst du bald eine Erhöhung verlangen:\n\n'
    + zeilen.join('\n') + '\n\n'
    + 'Grundlage sind die Angaben, die beim letzten Speichern des Objekts galten (Ist-Miete, letzte '
    + 'Erhöhung, Kappungsgrenze, Vergleichsmiete; § 558 BGB, Zugang des Schreibens nach § 558b BGB). '
    + 'Prüfe vor dem Schreiben die Begründung (Mietspiegel, Vergleichswohnungen) – das ist eine '
    + 'Erinnerung, keine Rechtsberatung.\n\n'
    + 'Zur App: ' + APP_URL + '\n\n'
    + 'Abschalten: Einstellungen › Allgemein › „Erinnerung vor Mieterhöhung“.';
  let html = null;
  if (_mailLayout && typeof _mailLayout.wrap === 'function') {
    const e = _mailLayout._esc;
    html = _mailLayout.wrap({
      preheader: subject,
      heroKicker: 'ERINNERUNG',
      heroTitle: subject,
      bodyHtml: '<div style="font-size:15px;line-height:1.6;color:#1b1815;">'
        + '<p>Hallo' + (user.name ? ' ' + e(user.name) : '') + ',</p>'
        + '<p>du hast in DealPilot die Erinnerung vor Mieterhöhungen eingeschaltet. Laut deiner Rechnung kannst du bald eine Erhöhung verlangen:</p>'
        + '<ul style="padding-left:18px">' + zeilen.map(function (z) { return '<li>' + e(z.replace(/^• /, '')) + '</li>'; }).join('') + '</ul>'
        + '<p style="font-size:13px;color:#5C554E">Grundlage sind die Angaben beim letzten Speichern des Objekts (Ist-Miete, letzte Erhöhung, Kappungsgrenze, Vergleichsmiete; § 558 BGB, Zugang nach § 558b BGB). Prüfe vor dem Schreiben die Begründung – das ist eine Erinnerung, keine Rechtsberatung.</p>'
        + '<p style="margin:22px 0">' + _mailLayout.button('DealPilot öffnen', APP_URL) + '</p>'
        + '<p style="font-size:12px;color:#8a8473">Abschalten: Einstellungen › Allgemein › „Erinnerung vor Mieterhöhung“.</p>'
        + '</div>'
    });
  }
  return { subject: subject, text: text, html: html };
}

async function _schonGesendet(userId, key) {
  const r = await query('SELECT 1 FROM retention_log WHERE user_id = $1 AND kind = $2 AND ref_key = $3 LIMIT 1', [userId, KIND, key]);
  return r.rowCount > 0;
}
async function _merken(userId, key, meta) {
  await query('INSERT INTO retention_log (user_id, kind, ref_key, meta) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
    [userId, KIND, key, meta ? JSON.stringify(meta) : null]);
}

/**
 * runOnce({ dryRun, heute }) - vom täglichen Lauf in index.js gerufen.
 * dryRun: nur zählen (keine Mail, kein Merker).
 */
async function runOnce(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const heute = /^\d{4}-\d{2}-\d{2}$/.test(opts.heute || '') ? opts.heute : _isoTag(new Date());
  const res = { nutzer: 0, termine: 0, gesendet: 0, mails: 0, uebersprungen: 0, fehler: 0, dryRun: dryRun };
  const nutzer = await query(
    `SELECT u.id, u.email, u.name FROM users u
       JOIN user_settings s ON s.user_id = u.id AND s.schluessel = $1
      WHERE (s.wert->>'mieterhoehung') = 'true'
        AND u.deleted_at IS NULL AND u.is_active = TRUE AND u.email IS NOT NULL`, [SCHLUESSEL]);
  for (const u of nutzer.rows) {
    res.nutzer++;
    try {
      const objs = await query(
        `SELECT id, name, kuerzel, data->'_soll_einheiten' AS se FROM objects
          WHERE user_id = $1 AND data ? '_soll_einheiten'
            AND COALESCE(data->>'_deal_won', 'false') = 'true'
            AND COALESCE(data->>'_deal_lost', 'false') <> 'true'`, [u.id]);
      const posten = [];
      for (const o of objs.rows) {
        const f = faellige(o.se, heute);
        const mehrere = !!(o.se && Array.isArray(o.se.einheiten) && o.se.einheiten.length > 1);
        for (const x of f) {
          res.termine++;
          const key = refKey(o.id, x);
          if (await _schonGesendet(u.id, key)) { res.uebersprungen++; continue; }
          posten.push({ o: o, f: x, key: key, mehrere: mehrere });
        }
      }
      if (!posten.length) continue;
      if (dryRun) { res.gesendet += posten.length; continue; }
      const m = mailInhalt(u, posten);
      await mailer.sendMail({ to: u.email, subject: m.subject, text: m.text, html: m.html || undefined });
      for (const p of posten) await _merken(u.id, p.key, { objekt: p.o.id, einheit: p.f.nr, verlangbar_ab: p.f.verlangbar_ab });
      res.gesendet += posten.length; res.mails++;
    } catch (e) {
      res.fehler++;
      console.error('[mieterhoehung] Nutzer ' + u.id + ':', e && e.message);
    }
  }
  return res;
}

/* Einwilligung lesen/schreiben (routes/erinnerungen.js) */
async function stand(userId) {
  const r = await query('SELECT wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = $2', [userId, SCHLUESSEL]);
  const w = r.rowCount ? (r.rows[0].wert || {}) : {};
  return { mieterhoehung: w.mieterhoehung === true, seit: w.mieterhoehung === true ? (w.geaendert || null) : null };
}
async function setzen(userId, an) {
  const r0 = await query('SELECT wert FROM user_settings WHERE user_id = $1 AND schluessel = $2', [userId, SCHLUESSEL]);
  const w = Object.assign({}, r0.rowCount ? (r0.rows[0].wert || {}) : {}, { mieterhoehung: !!an, geaendert: new Date().toISOString() });
  await query(
    `INSERT INTO user_settings (user_id, schluessel, wert, updated_at) VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = $3::jsonb, updated_at = NOW()`,
    [userId, SCHLUESSEL, JSON.stringify(w)]);
  return { mieterhoehung: w.mieterhoehung, seit: w.mieterhoehung ? w.geaendert : null };
}

module.exports = { KIND, SCHLUESSEL, VORLAUF_TAGE, faellige, refKey, mailInhalt, runOnce, stand, setzen };
