'use strict';
/* services/dateiAblage.js — v3162 · UNTERLAGEN AUF DEM EIGENEN SERVER
 *
 * Marcel 03.11.2026: „können wir auch auf unserem Server speichern um erstmal weiter zu machen … Struktur
 * Ordner mit Unterordnern möglich?“ Grenzen je Plan (Vorschlag übernommen): Free 100 MB · Starter 500 MB ·
 * Investor 2 GB · Pro 10 GB · Partner 25 GB; eine Datei höchstens 25 MB.
 *
 * ── Wo die Dateien liegen ────────────────────────────────────────────────
 * Laufwerk backend_uploads (/app/uploads, übersteht den Neubau des Containers), darunter
 * dateien/<user_id>/<datei_id>. Jede Datei ist mit AES-256-GCM verschlüsselt; der Schlüssel steht in der
 * .env (DATEI_SCHLUESSEL, 64 Hex-Zeichen). Ohne Schlüssel wird NICHT gespeichert (fail closed) — eine
 * unverschlüsselte Ablage von Mietverträgen soll es nicht still geben.
 *
 * ── Später: eigener Speicher ─────────────────────────────────────────────
 * Alles Lesen/Schreiben läuft über _schreiben/_lesen/_entfernen. Ein Umzug auf einen S3-Speicher ersetzt
 * nur diese drei Funktionen; Tabelle, Aufrufe und App bleiben.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../db/pool');

const BASIS = process.env.DATEI_ABLAGE_DIR || path.join(__dirname, '..', '..', 'uploads', 'dateien');
const MAX_DATEI = 20 * 1024 * 1024;   /* v4860 · Marcel 25.11.2026: je Datei höchstens 20 MB */
const MB = 1024 * 1024;
/* v4860 · Dokumentenablage (Marcel 25.11.2026, Vorlage design/Vorschläge/dokumentenablage-2026-11-25.md):
   Free keine Ablage (nur Auslesen) · Starter 500 MB · Investor 1 GB · Pro 3 GB · Business 25 GB · Partner 5 GB (Partner-Konto).
   Marcel 25.11.2026: Investor 1 GB statt 2 GB, Pro 3 GB statt 10 GB, Partner 5 GB. Kunden eines Partners nutzen das
   Kontingent ihres eigenen Plans.
   Kunden eines Partners haben ihren eigenen Plan (Lizenz) und damit ihr eigenes Kontingent. */
const GRENZE_JE_PLAN = { free: 0, starter: 500 * MB, investor: 1024 * MB, pro: 3072 * MB, business: 25600 * MB, partner: 5120 * MB };
const FRIST_TAGE = 90;

function _schluessel() {
  const k = String(process.env.DATEI_SCHLUESSEL || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(k)) return null;
  return Buffer.from(k, 'hex');
}
function bereit() { return !!_schluessel(); }

/* Ordnerpfad säubern: keine „..“, keine führenden/doppelten Schrägstriche, höchstens 8 Ebenen */
function ordnerSauber(o) {
  return String(o || '').replace(/\\/g, '/').split('/').map((t) => t.trim().replace(/[\u0000-\u001f<>:"|?*]/g, '').slice(0, 80))
    .filter((t) => t && t !== '.' && t !== '..').slice(0, 8).join('/');
}
function nameSauber(n) {
  const s = String(n || 'Datei').replace(/[\\/]/g, '_').replace(/[\u0000-\u001f<>:"|?*]/g, '').trim().slice(0, 180);
  return s || 'Datei';
}

/* ── Laufwerk (austauschbar) ── */
function _pfad(userId, schluessel) { return path.join(BASIS, String(userId), String(schluessel)); }
async function _schreiben(userId, schluessel, puffer) {
  const k = _schluessel(); if (!k) throw new Error('Ablage nicht eingerichtet (DATEI_SCHLUESSEL fehlt)');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const verschl = Buffer.concat([c.update(puffer), c.final()]);
  const tag = c.getAuthTag();
  await fs.promises.mkdir(path.join(BASIS, String(userId)), { recursive: true });
  await fs.promises.writeFile(_pfad(userId, schluessel), Buffer.concat([Buffer.from('DPA1'), iv, tag, verschl]));
}
async function _lesen(userId, schluessel) {
  const k = _schluessel(); if (!k) throw new Error('Ablage nicht eingerichtet (DATEI_SCHLUESSEL fehlt)');
  const b = await fs.promises.readFile(_pfad(userId, schluessel));
  if (b.slice(0, 4).toString() !== 'DPA1') throw new Error('Dateiformat unbekannt');
  const iv = b.slice(4, 16), tag = b.slice(16, 32), daten = b.slice(32);
  const d = crypto.createDecipheriv('aes-256-gcm', k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(daten), d.final()]);
}
async function _entfernen(userId, schluessel) {
  try { await fs.promises.unlink(_pfad(userId, schluessel)); } catch (e) { /* schon weg */ }
}

/* ── Grenzen ── */
async function stand(userId) {
  let plan = 'free';
  try { const eff = await require('./subscriptionService').getEffectivePlan(userId); if (eff && eff.plan_id) plan = String(eff.plan_id); } catch (e) {}
  const grenze = GRENZE_JE_PLAN[plan] != null ? GRENZE_JE_PLAN[plan] : GRENZE_JE_PLAN.free;
  const r = await query("SELECT COALESCE(SUM(groesse), 0)::bigint AS belegt, COUNT(*)::int AS anzahl FROM dateien WHERE user_id = $1 AND deleted_at IS NULL AND quelle IS DISTINCT FROM 'objektfoto'", [userId]);  /* v3310: Objektfotos zählen nicht */
  const belegt = Number(r.rows[0].belegt) || 0;
  let frist = null;
  try { const f = await query('SELECT frist_am FROM dateien_fristen WHERE user_id = $1', [userId]); if (f.rowCount) frist = f.rows[0].frist_am; } catch (e) {}
  return { plan, grenze_bytes: grenze, belegt_bytes: belegt, frei_bytes: Math.max(0, grenze - belegt), anzahl: r.rows[0].anzahl, max_datei_bytes: MAX_DATEI, bereit: bereit(),
    darf_ablegen: grenze > 0, loeschung_am: frist,
    belegt_pct: grenze > 0 ? Math.min(100, Math.round(belegt / grenze * 1000) / 10) : 0, warnung: grenze > 0 && belegt / grenze >= 0.8 };
}

/* v4910 · Einsortieren (Marcel 25.11.2026: „passend nach Ordnern ablegen und auch für die Jahre“). Ordner aus der
   erkannten Dokumentart, wenn keiner angegeben ist; das Jahr steht in meta.jahr (aus Belegdatum, sonst Ablagejahr). */
const ORDNER = ['Belege', 'Mietverträge', 'Protokolle', 'Energieausweis', 'Exposé', 'Kauf & Objekt', 'Bewertung', 'Finanzierung', 'Steuer', 'Sonstiges'];
function ordnerAus(art) {
  const l = String(art || '').toLowerCase();
  if (!l) return 'Sonstiges';
  if (/rechnung|beleg|quittung/.test(l)) return 'Belege';
  if (/expos/.test(l)) return 'Exposé';
  if (/energieausweis/.test(l)) return 'Energieausweis';
  if (/mietvertrag|mieterliste|mietaufstellung/.test(l)) return 'Mietverträge';
  if (/protokoll|eigentümerversammlung|wirtschaftsplan|hausgeld|abrechnung|weg/.test(l)) return 'Protokolle';
  if (/market|marktbericht|gutachten|wertermittlung|restnutzungsdauer/.test(l)) return 'Bewertung';
  if (/grundbuch|teilung|flurkarte|liegenschaft|baulast|kaufvertrag|auflassung/.test(l)) return 'Kauf & Objekt';
  if (/darlehen|finanzierung|bank|grundschuld/.test(l)) return 'Finanzierung';
  if (/steuer|bescheid/.test(l)) return 'Steuer';
  return 'Sonstiges';
}
function jahrAusMeta(meta) {
  const m = meta || {};
  const j = Number(m.jahr); if (j >= 1900 && j <= 2200) return j;
  for (const k of ['belegdatum', 'rechnungsdatum', 'datum', 'stichtag']) {
    const t = String(m[k] || ''); const x = t.match(/(19|20|21)[0-9]{2}/); if (x) return Number(x[0]);
  }
  return null;
}

async function _objektGehoert(userId, objectId) {
  if (!objectId) return true;
  const r = await query('SELECT 1 FROM objects WHERE id = $1 AND user_id = $2', [objectId, userId]);
  return r.rowCount > 0;
}

/** Datei ablegen. Gibt die Zeile zurück oder wirft mit .status (400/403/413/507). */
async function ablegen(userId, opts) {
  const puffer = opts.puffer;
  const fehler = (s, t) => { const e = new Error(t); e.status = s; return e; };
  if (!bereit()) throw fehler(503, 'Die Ablage ist auf diesem Server noch nicht eingerichtet.');
  if (!Buffer.isBuffer(puffer) || !puffer.length) throw fehler(400, 'Leere Datei.');
  if (puffer.length > MAX_DATEI) throw fehler(413, 'Datei größer als 20 MB.');
  if (!(await _objektGehoert(userId, opts.objectId))) throw fehler(403, 'Objekt gehört nicht zu diesem Konto.');
  const sha = crypto.createHash('sha256').update(puffer).digest('hex');
  /* dieselbe Datei im selben Ordner desselben Objekts nicht doppelt ablegen */
  const meta0 = Object.assign({}, opts.meta || {});
  const jm = jahrAusMeta(meta0); if (jm) meta0.jahr = jm;
  const ordner = ordnerSauber(opts.ordner) || (module.exports.ordnerAus || ordnerAus)(meta0.art || opts.art);
  const dup = await query('SELECT id, user_id, object_id, ordner, name, mime, groesse, sha256, quelle, meta, created_at FROM dateien WHERE user_id = $1 AND sha256 = $2 AND ordner = $3 AND object_id IS NOT DISTINCT FROM $4 AND deleted_at IS NULL LIMIT 1',
    [userId, sha, ordner, opts.objectId || null]);
  if (dup.rowCount) return Object.assign({ doppelt: true }, dup.rows[0]);
  const s = await stand(userId);
  if (!s.darf_ablegen) throw fehler(403, 'Die Dokumentenablage gibt es ab dem Plan Starter. Vorhandene Dateien kannst du weiter ansehen.');
  if (puffer.length > s.frei_bytes) throw fehler(507, 'Speicher voll: ' + Math.round(s.belegt_bytes / MB) + ' von ' + Math.round(s.grenze_bytes / MB) + ' MB belegt (Plan ' + s.plan + ').');
  const schluessel = crypto.randomBytes(16).toString('hex');
  await _schreiben(userId, schluessel, puffer);
  try {
    const r = await query(
      'INSERT INTO dateien (user_id, object_id, ordner, name, mime, groesse, sha256, ablage_schluessel, quelle, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) '
      + 'RETURNING id, user_id, object_id, ordner, name, mime, groesse, sha256, quelle, meta, created_at',
      [userId, opts.objectId || null, ordner, nameSauber(opts.name), String(opts.mime || 'application/octet-stream').slice(0, 120), puffer.length, sha, schluessel,
        String(opts.quelle || 'upload').slice(0, 20), JSON.stringify(meta0)]);
    return r.rows[0];
  } catch (e) { await _entfernen(userId, schluessel); throw e; }
}

async function liste(userId, objectId) {
  const args = [userId];
  let w = "user_id = $1 AND deleted_at IS NULL AND quelle IS DISTINCT FROM 'objektfoto'";   /* v3310: Objektfotos nicht in der Liste */
  if (objectId === null) w += ' AND object_id IS NULL';
  else if (objectId) { args.push(objectId); w += ' AND object_id = $2'; }
  const r = await query('SELECT d.id, d.object_id, d.ordner, d.name, d.mime, d.groesse, d.sha256, d.quelle, d.meta, d.created_at, d.updated_at, o.name AS objekt_name FROM dateien d LEFT JOIN objects o ON o.id = d.object_id WHERE ' + w.replace(/(^|AND )(user_id|deleted_at|quelle|object_id)/g, '$1d.$2') + ' ORDER BY d.ordner, d.name', args);
  return r.rows.map((z) => Object.assign(z, { jahr: jahrVon(z) }));
}

async function holen(userId, id) {
  const r = await query('SELECT * FROM dateien WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId]);
  if (!r.rowCount) return null;
  const z = r.rows[0];
  const puffer = await _lesen(userId, z.ablage_schluessel);
  return { zeile: z, puffer };
}

async function aendern(userId, id, opts) {
  const sets = [], args = [id, userId];
  if (opts.ordner !== undefined) { args.push(ordnerSauber(opts.ordner)); sets.push('ordner = $' + args.length); }
  if (opts.name !== undefined) { args.push(nameSauber(opts.name)); sets.push('name = $' + args.length); }
  if (opts.objectId !== undefined) {
    if (!(await _objektGehoert(userId, opts.objectId))) { const e = new Error('Objekt gehört nicht zu diesem Konto.'); e.status = 403; throw e; }
    args.push(opts.objectId || null); sets.push('object_id = $' + args.length);
  }
  if (!sets.length) return null;
  const r = await query('UPDATE dateien SET ' + sets.join(', ') + ", updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND quelle IS DISTINCT FROM 'objektfoto' RETURNING id, object_id, ordner, name, mime, groesse, quelle, updated_at", args);
  return r.rows[0] || null;
}

async function loeschen(userId, id) {
  const r = await query("UPDATE dateien SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND quelle IS DISTINCT FROM 'objektfoto' RETURNING ablage_schluessel"  /* v3310: Objektfotos nur über das Objekt */, [id, userId]);
  if (!r.rowCount) return false;
  await _entfernen(userId, r.rows[0].ablage_schluessel);
  return true;
}

/* v4860 · Jahr einer Datei: Belegjahr aus meta.jahr, sonst das Jahr des Ablegens */
function jahrVon(z) {
  const j = z && z.meta && Number(z.meta.jahr);
  if (j >= 1900 && j <= 2200) return j;
  const d = z && z.created_at ? new Date(z.created_at) : null;
  return d && !isNaN(d) ? d.getFullYear() : null;
}

/** v4860 · alle Dateien eines Jahres (je Objekt) löschen. Gibt die Zahl zurück. */
/** v4910 · Gruppe löschen: alle Dateien eines Objekts in einem Ordner und/oder Jahr. Ohne Ordner und Jahr: nichts. */
async function loeschenGruppe(userId, objectId, opt) {
  opt = opt || {};
  const j = opt.jahr != null ? Number(opt.jahr) : null;
  const ord = opt.ordner != null ? ordnerSauber(opt.ordner) : null;
  if ((j == null || !(j >= 1900 && j <= 2200)) && !ord) return 0;
  const alle = await liste(userId, objectId);
  let n = 0;
  for (const d of alle) {
    if (j != null && d.jahr !== j) continue;
    if (ord && String(d.ordner || '').split('/')[0] !== ord.split('/')[0]) continue;
    if (await loeschen(userId, d.id)) n++;
  }
  return n;
}
async function loeschenJahr(userId, objectId, jahr) {
  const j = Number(jahr); if (!(j >= 1900 && j <= 2200)) return 0;
  const alle = await liste(userId, objectId);
  let n = 0;
  for (const d of alle) { if (d.jahr === j && await loeschen(userId, d.id)) n++; }
  return n;
}

/** v4860 · Löschfrist nach Vertragsende. Konten mit Dateien, deren Plan keine Ablage mehr hat (Kündigung, Downgrade
 *  auf Free): beim ersten Erkennen Frist = heute + 90 Tage und eine Mail; ist die Frist vorbei, werden die Dateien
 *  gelöscht. Wieder ein Plan mit Ablage: die Frist fällt weg. opt: { mail(userId, fristAm), jetzt, trocken, nurNutzer } */
async function fristLauf(opt) {
  opt = opt || {};
  const jetzt = opt.jetzt ? new Date(opt.jetzt) : new Date();
  const erg = { geprueft: 0, neu: 0, aufgehoben: 0, geloescht_konten: 0, geloescht_dateien: 0 };
  const args = [];
  let w = "deleted_at IS NULL AND quelle IS DISTINCT FROM 'objektfoto'";
  if (opt.nurNutzer) { args.push(opt.nurNutzer); w += ' AND user_id = $1'; }
  const nutzer = await query('SELECT DISTINCT user_id FROM dateien WHERE ' + w, args);
  for (const z of nutzer.rows) {
    erg.geprueft++;
    const s = await stand(z.user_id);
    const f = await query('SELECT frist_am FROM dateien_fristen WHERE user_id = $1', [z.user_id]);
    if (s.darf_ablegen) {
      if (f.rowCount && !opt.trocken) { await query('DELETE FROM dateien_fristen WHERE user_id = $1', [z.user_id]); erg.aufgehoben++; }
      continue;
    }
    if (!f.rowCount) {
      const am = new Date(jetzt.getTime() + FRIST_TAGE * 864e5);
      if (!opt.trocken) {
        await query('INSERT INTO dateien_fristen (user_id, erkannt_am, frist_am) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING', [z.user_id, jetzt, am]);
        try { if (opt.mail) { await opt.mail(z.user_id, am); await query('UPDATE dateien_fristen SET mail_am = $2 WHERE user_id = $1', [z.user_id, jetzt]); } } catch (e) {}
      }
      erg.neu++;
      continue;
    }
    if (new Date(f.rows[0].frist_am) <= jetzt) {
      const r = await query("SELECT id FROM dateien WHERE user_id = $1 AND deleted_at IS NULL AND quelle IS DISTINCT FROM 'objektfoto'", [z.user_id]);
      if (!opt.trocken) {
        for (const d of r.rows) { if (await loeschen(z.user_id, d.id)) erg.geloescht_dateien++; }
        await query('DELETE FROM dateien_fristen WHERE user_id = $1', [z.user_id]);
      }
      erg.geloescht_konten++;
    }
  }
  return erg;
}

/** v4860 · Hinweis-Mail zur Löschfrist (nur, wenn der Takt scharf ist) */
async function fristMail(userId, fristAm) {
  const r = await query('SELECT email FROM users WHERE id = $1', [userId]);
  if (!r.rowCount || !r.rows[0].email) return;
  const datum = new Date(fristAm).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
  const text = 'Hallo,\n\ndein Plan enthält keine Dokumentenablage mehr. Deine abgelegten Unterlagen kannst du bis zum ' + datum
    + ' weiter ansehen und herunterladen. Danach löschen wir sie.\n\nWillst du sie behalten, lade sie vorher herunter oder wähle wieder einen Plan ab Starter.\n\nDein DealPilot-Team';
  await require('./mailerService').sendMail({ to: r.rows[0].email, subject: 'Deine Dokumentenablage: Löschung am ' + datum, text });
}

/** v4860 · Plattenbelegung des Ablage-Laufwerks (Marcel 25.11.2026: Warnung ab 70 %). Der Speicherort ist über
 *  DATEI_ABLAGE_DIR einstellbar (z. B. eine eingehängte Storage Box), ohne Umbau. Gibt null zurück, wenn statfs fehlt. */
const PLATTE_WARN_PCT = Number(process.env.ABLAGE_PLATTE_WARN_PCT || 70);
async function plattenStand() {
  try {
    await fs.promises.mkdir(BASIS, { recursive: true });
    const s = await fs.promises.statfs(BASIS);
    const gesamt = Number(s.blocks) * Number(s.bsize), frei = Number(s.bavail) * Number(s.bsize);
    const pct = gesamt ? Math.round((1 - frei / gesamt) * 1000) / 10 : 0;
    return { ort: BASIS, gesamt_bytes: gesamt, frei_bytes: frei, belegt_pct: pct, warn_pct: PLATTE_WARN_PCT, warnung: pct >= PLATTE_WARN_PCT };
  } catch (e) { return null; }
}
/** Admin-Warnung (eine Mail je Lauf, der Takt läuft täglich). An ABLAGE_WARN_TO, sonst CREDIT_ALERT_TO, sonst info@. */
async function plattenWarnung(opt) {
  opt = opt || {};
  const p = opt.stand || await plattenStand();
  if (!p || !p.warnung) return { gewarnt: false, stand: p };
  const an = process.env.ABLAGE_WARN_TO || process.env.CREDIT_ALERT_TO || 'info@dealpilot.immo';
  const text = 'Die Dokumentenablage ist zu ' + String(p.belegt_pct).replace('.', ',') + ' % belegt (Warnschwelle ' + p.warn_pct + ' %).\n'
    + 'Ort: ' + p.ort + '\nFrei: ' + Math.round(p.frei_bytes / MB) + ' MB von ' + Math.round(p.gesamt_bytes / MB) + ' MB.\n\n'
    + 'Abhilfe: Volume vergrößern oder DATEI_ABLAGE_DIR auf einen größeren Speicher (Storage Box) umstellen und den Ordner umziehen.';
  if (!opt.trocken) await (opt.mail || ((o) => require('./mailerService').sendMail(o)))({ to: an, subject: 'DealPilot · Dokumentenablage ' + p.belegt_pct + ' % belegt', text });
  return { gewarnt: true, stand: p, an };
}

/** Konto gelöscht: alle Dateien vom Laufwerk (die Zeilen löscht die Kaskade). */
async function kontoLeeren(userId) {
  try { await fs.promises.rm(path.join(BASIS, String(userId)), { recursive: true, force: true }); return true; } catch (e) { return false; }
}

module.exports = { ordnerAus, jahrAusMeta, ORDNER, loeschenGruppe, ablegen, liste, holen, aendern, loeschen, loeschenJahr, fristLauf, fristMail, plattenStand, plattenWarnung, jahrVon, FRIST_TAGE, stand, kontoLeeren, bereit, ordnerSauber, nameSauber, GRENZE_JE_PLAN, MAX_DATEI, _lesen, _schreiben, _entfernen };
