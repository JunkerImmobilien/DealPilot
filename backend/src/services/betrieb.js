'use strict';
/* services/betrieb.js — v4880 · BETRIEB: Ampeln, Hochrechnung, Mails
 *
 * Marcel 25.11.2026: „dass wir irgendwann wissen, wann wir größere Server brauchen, ob wir Sicherheits-
 * lücken haben, wie Backups laufen, und wenn mal alles zusammenstürzt, dass wir unser System wieder
 * vernünftig herstellen können.“
 *
 * Die Daten schreibt der HOST (tools/server/betrieb-sammeln.py stündlich, wiederherstellungsprobe.sh
 * monatlich) in betrieb_messungen. Dieses Modul liest nur, bewertet (bewerten() ist rein, geprüft von
 * tools/betrieb-pruefen.mjs) und verschickt:
 *   · sofort eine Mail bei ROT in Platte, Nachtsicherung, TLS, Wiederherstellungsprobe, Messung fehlt
 *     (je Punkt höchstens einmal in 24 h),
 *   · montags eine Wochenmail mit Ampeln und Handlungsbedarf.
 * Empfänger: ADMIN_EMAIL (config.admin.email). Scharf nur mit BETRIEB_MAIL=1 (Prod), sonst trocken.
 */

const SCHWELLEN = Object.freeze({
  platteGelb: 70, platteRot: 85,          // % belegt
  ramGelb: 80, ramRot: 92,                // % belegt, 7-Tage-Schnitt
  lastGelb: 0.8, lastRot: 1.5,            // Last1 je Kern, 7-Tage-Schnitt
  tlsGelb: 30, tlsRot: 14,                // Tage bis Ablauf
  neustartGelb: 7, neustartRot: 30,       // Tage seit „Neustart nötig“
  imageGelb: 180,                         // Tage Alter des laufenden Images (nur gelb)
  sicherungAlterStd: 26,                  // Nachtsicherung älter = rot
  sicherungSchwund: 0.5,                  // kleiner als 50 % der Vornacht = rot
  probeGelbTage: 35, probeRotTage: 62,    // Alter der letzten bestandenen Probe
  messungAltStd: 3,                       // keine Messung seit … = rot (Sammler steht)
  vollMonateGelb: 12, vollMonateRot: 4    // Hochrechnung „85 % erreicht in …“
});
/* Die Plattenwarnung der Dokumentenablage (UU4, ABLAGE_PLATTE_WARN_PCT) ist dieselbe Gelb-Schwelle: aus der Umgebung übernehmen, nicht doppelt führen. */
function schwellenAusUmgebung() { const w = parseFloat(process.env.ABLAGE_PLATTE_WARN_PCT); return isFinite(w) && w > 0 && w < 100 ? { platteGelb: w } : {}; }
const ROT_MAILEN = ['platte', 'sicherung', 'tls', 'probe', 'messung'];

function _tage(a, b) { return (b - a) / 86400000; }
function _ms(t) { const x = Date.parse(t); return isFinite(x) ? x : null; }
function _de(x) { return x == null ? '–' : String(x).replace('.', ','); }
function _gb(b) { return b == null ? '–' : (b / 1e9).toFixed(1).replace('.', ',') + ' GB'; }
function _mb(b) { return b == null ? '–' : Math.round(b / 1e6) + ' MB'; }

/* Lineare Regression über (Zeit, belegt) der letzten 30 Tage → Bytes je Tag; daraus Monate bis 85 % / 100 %. */
function hochrechnung(verlauf, gesamt, jetzt) {
  const p = (verlauf || []).map((v) => ({ t: _ms(v.zeit), y: v.belegt })).filter((x) => x.t != null && x.y != null);
  if (p.length < 3) return { je_tag: null, grund: 'zu wenige Messungen' };
  const span = _tage(Math.min(...p.map((x) => x.t)), Math.max(...p.map((x) => x.t)));
  if (span < 3) return { je_tag: null, grund: 'weniger als 3 Tage Verlauf' };
  const mt = p.reduce((s, x) => s + x.t, 0) / p.length, my = p.reduce((s, x) => s + x.y, 0) / p.length;
  let zl = 0, nn = 0;
  p.forEach((x) => { zl += (x.t - mt) * (x.y - my); nn += (x.t - mt) * (x.t - mt); });
  const jeMs = nn ? zl / nn : 0, jeTag = jeMs * 86400000;
  const aktuell = p[p.length - 1].y;
  if (!(jeTag > 0) || !gesamt) return { je_tag: jeTag, monate_85: null, monate_100: null, grund: 'kein Wachstum' };
  const m = (ziel) => Math.max(0, (ziel - aktuell) / jeTag / 30.4);
  return { je_tag: jeTag, monate_85: +m(gesamt * 0.85).toFixed(1), monate_100: +m(gesamt).toFixed(1) };
}

function _schnitt(werte) { const w = werte.filter((x) => typeof x === 'number' && isFinite(x)); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; }

/* bewerten({messung, verlauf, probe, audit, jetzt}) → { gesamt, punkte[], handlungsbedarf[], kennzahlen } — rein. */
function bewerten(o) {
  const S = Object.assign({}, SCHWELLEN, o.schwellen || {}), jetzt = o.jetzt || Date.now();
  const m = (o.messung && o.messung.daten) || null;
  const mZeit = o.messung ? _ms(o.messung.erfasst_am) : null;
  const punkte = [];
  const add = (bereich, stufe, text, rat) => punkte.push({ bereich, stufe, text, rat: rat || '' });

  if (!m || mZeit == null) { add('messung', 'rot', 'Keine Messung vorhanden', 'Host-Takt betrieb-sammeln.py prüfen (crontab).'); }
  else if ((jetzt - mZeit) / 3600000 > S.messungAltStd) add('messung', 'rot', 'Letzte Messung ist ' + Math.round((jetzt - mZeit) / 3600000) + ' h alt', 'Host-Takt betrieb-sammeln.py läuft nicht, crontab prüfen.');

  const k = {};
  if (m) {
    const pl = m.platte || {};
    k.platte_pct = pl.pct;
    if (pl.pct >= S.platteRot) add('platte', 'rot', 'Platte zu ' + _de(pl.pct) + ' % belegt', 'Sofort Platz schaffen (Build-Cache, alte Handsicherungen) oder Speicher erweitern.');
    else if (pl.pct >= S.platteGelb) add('platte', 'gelb', 'Platte zu ' + _de(pl.pct) + ' % belegt', 'Aufräumen planen, Storage Box oder größeren Server vorbereiten.');
    else add('platte', 'gruen', 'Platte zu ' + _de(pl.pct) + ' % belegt, ' + _gb(pl.frei) + ' frei');

    const h = hochrechnung((o.verlauf || []).map((v) => ({ zeit: v.erfasst_am, belegt: v.daten && v.daten.platte && v.daten.platte.belegt })), pl.gesamt, jetzt);
    k.hochrechnung = h;
    if (h.monate_85 != null) {
      if (h.monate_85 <= S.vollMonateRot) add('wachstum', 'rot', '85 % Platte in etwa ' + _de(h.monate_85) + ' Monaten', 'Größeren Server oder Storage Box jetzt bestellen.');
      else if (h.monate_85 <= S.vollMonateGelb) add('wachstum', 'gelb', '85 % Platte in etwa ' + _de(h.monate_85) + ' Monaten', 'Speichererweiterung einplanen.');
      else add('wachstum', 'gruen', '85 % Platte frühestens in ' + _de(h.monate_85) + ' Monaten');
    } else add('wachstum', 'gruen', 'Hochrechnung: ' + (h.grund || 'kein Wachstum'));

    const v7 = (o.verlauf || []).filter((v) => _ms(v.erfasst_am) != null && jetzt - _ms(v.erfasst_am) <= 7 * 86400000);
    const ram7 = _schnitt(v7.map((v) => v.daten && v.daten.speicher && v.daten.speicher.pct).concat([m.speicher && m.speicher.pct]));
    const last7 = _schnitt(v7.map((v) => v.daten && v.daten.last && v.daten.last.kerne ? v.daten.last.l1 / v.daten.last.kerne : null)
      .concat([m.last && m.last.kerne ? m.last.l1 / m.last.kerne : null]));
    k.ram_7 = ram7 == null ? null : +ram7.toFixed(1); k.last_7 = last7 == null ? null : +last7.toFixed(2);
    if (ram7 != null) {
      if (ram7 >= S.ramRot) add('speicher', 'rot', 'Arbeitsspeicher im Schnitt ' + _de(k.ram_7) + ' % belegt', 'Größeren Server einplanen.');
      else if (ram7 >= S.ramGelb) add('speicher', 'gelb', 'Arbeitsspeicher im Schnitt ' + _de(k.ram_7) + ' % belegt', 'Beobachten, größeren Server vorbereiten.');
      else add('speicher', 'gruen', 'Arbeitsspeicher im Schnitt ' + _de(k.ram_7) + ' % belegt');
    }
    if (last7 != null) {
      if (last7 >= S.lastRot) add('last', 'rot', 'Last je Kern im Schnitt ' + _de(k.last_7), 'Mehr CPU-Kerne nötig.');
      else if (last7 >= S.lastGelb) add('last', 'gelb', 'Last je Kern im Schnitt ' + _de(k.last_7), 'Beobachten.');
      else add('last', 'gruen', 'Last je Kern im Schnitt ' + _de(k.last_7));
    }

    const u = m.updates || {};
    if (u.sicherheit > 0) add('updates', 'gelb', u.sicherheit + ' Sicherheitsupdates ausstehend' + (u.sicherheit_pakete && u.sicherheit_pakete.length ? ' (' + u.sicherheit_pakete.slice(0, 4).join(', ') + ')' : ''), 'Spielen die automatischen Updates meist von selbst ein. Bleiben sie liegen: apt upgrade im Wartungsfenster.');
    else add('updates', 'gruen', 'Keine Sicherheitsupdates ausstehend');
    if (!u.automatisch) add('updates', 'gelb', 'Automatische Sicherheitsupdates sind aus', 'unattended-upgrades aktivieren.');
    if (u.neustart_noetig) {
      const seit = _ms(u.neustart_seit), t = seit ? Math.floor(_tage(seit, jetzt)) : null;
      const txt = 'Neustart nötig' + (t != null ? ' seit ' + t + ' Tagen' : '') + (u.neustart_pakete && u.neustart_pakete.length ? ' (' + Array.from(new Set(u.neustart_pakete)).slice(0, 3).join(', ') + ')' : '');
      if (t != null && t >= S.neustartRot) add('neustart', 'rot', txt, 'Neustart im Wartungsfenster, erst dann wirkt der neue Kernel.');
      else if (t == null || t >= S.neustartGelb) add('neustart', 'gelb', txt, 'Neustart in den nächsten Tagen nachts einplanen (1 bis 2 Minuten Ausfall).');
      else add('neustart', 'gruen', txt);
    } else add('neustart', 'gruen', 'Kein Neustart nötig');

    const po = m.ports || {};
    if (po.unerwartet && po.unerwartet.length) add('ports', 'rot', 'Unerwartete offene Ports: ' + po.unerwartet.join(', '), 'Dienst prüfen und Port schließen.');
    else add('ports', 'gruen', 'Offene Ports nur ' + (po.offen || []).join(', '));

    (m.tls || []).forEach((t) => {
      if (t.fehler) add('tls', 'rot', 'TLS ' + t.domain + ' nicht prüfbar: ' + t.fehler, 'Erreichbarkeit und Zertifikat prüfen.');
      else if (t.tage < S.tlsRot) add('tls', 'rot', 'TLS ' + t.domain + ' läuft in ' + t.tage + ' Tagen ab', 'Caddy-Erneuerung prüfen (Logs).');
      else if (t.tage < S.tlsGelb) add('tls', 'gelb', 'TLS ' + t.domain + ' läuft in ' + t.tage + ' Tagen ab', 'Caddy erneuert normalerweise selbst, beobachten.');
      else add('tls', 'gruen', 'TLS ' + t.domain + ' gültig noch ' + t.tage + ' Tage');
    });

    const alt = (m.images || []).filter((i) => i.tage != null && i.tage >= S.imageGelb);
    if (alt.length) add('images', 'gelb', 'Alte Basis-Images: ' + alt.map((i) => i.image + ' (' + i.tage + ' T.)').join(', '), 'Basis-Images im Wartungsfenster aktualisieren (Postgres nur Patch-Version).');
    else add('images', 'gruen', 'Alle Images jünger als ' + S.imageGelb + ' Tage');

    const s = m.sicherung || {};
    const hp = (s.haupt || [])[0], mp = (s.marktbericht || [])[0], up = (s.uploads || [])[0];
    const altStd = hp ? (jetzt - _ms(hp.zeit)) / 3600000 : null;
    if (!hp || !mp) add('sicherung', 'rot', 'Nachtsicherung fehlt', '/root/nachtsicherung.sh und crontab prüfen.');
    else if (altStd > S.sicherungAlterStd) add('sicherung', 'rot', 'Nachtsicherung ist ' + Math.round(altStd) + ' h alt', 'Nachtsicherung läuft nicht, Log /var/log/nachtsicherung.log prüfen.');
    else if (!s.log_ok) add('sicherung', 'rot', 'Nachtsicherung meldet Fehler: ' + (s.log_letzte || ''), 'Log /var/log/nachtsicherung.log prüfen.');
    else {
      const schw = ['haupt', 'marktbericht', 'uploads'].filter((n) => { const a = s[n] || []; return a.length > 1 && a[1].groesse > 0 && a[0].groesse < a[1].groesse * S.sicherungSchwund; });
      if (schw.length) add('sicherung', 'rot', 'Nachtsicherung deutlich kleiner als in der Vornacht: ' + schw.join(', '), 'Sicherung ansehen, bevor die alte rotiert.');
      else add('sicherung', 'gruen', 'Nachtsicherung ok' + (s.skript && s.skript.art ? ' (' + s.skript.art + (s.skript.naechte_dumps ? ', ' + s.skript.naechte_dumps + ' Nächte' : '') + ')' : '') + ': Haupt ' + _mb(hp.groesse) + ', Marktbericht ' + _mb(mp.groesse) + (up ? ', Dateien ' + _mb(up.groesse) : ''));
    }
    k.db = m.db; k.uploads = m.uploads; k.docker = m.docker; k.hand = { anzahl: s.hand_anzahl, groesse: s.hand_groesse };
    const vor7 = (o.verlauf || []).find((v) => _ms(v.erfasst_am) != null && jetzt - _ms(v.erfasst_am) >= 6.5 * 86400000);
    k.db_woche = vor7 && vor7.daten && vor7.daten.db && m.db ? { haupt: m.db.haupt - vor7.daten.db.haupt, marktbericht: m.db.marktbericht - vor7.daten.db.marktbericht } : null;
  }

  if (o.konfigOffsite) add('konfig', 'gruen', 'Konfiguration (.env, Compose, Caddyfile) auch außerhalb des Servers gesichert');
  else add('konfig', 'gelb', 'Konfiguration (.env mit DATEI_SCHLUESSEL, Compose, Caddyfile) liegt nur auf dem Server und in der Hetzner-Sicherung', 'Verschlüsselte Kopie im Passwortmanager ablegen, danach BETRIEB_KONFIG_OFFSITE=1 setzen.');

  const pr = o.probe && o.probe.daten;
  const prZeit = o.probe ? _ms(o.probe.erfasst_am) : null;
  if (!pr || prZeit == null) add('probe', 'gelb', 'Noch keine Wiederherstellungsprobe', 'tools/server/wiederherstellungsprobe.sh ausführen.');
  else {
    const t = Math.floor(_tage(prZeit, jetzt));
    if (!pr.bestanden) add('probe', 'rot', 'Wiederherstellungsprobe NICHT bestanden (' + t + ' Tage alt)', 'Ergebnis im Admin ansehen, Sicherung prüfen.');
    else if (t >= S.probeRotTage) add('probe', 'rot', 'Letzte bestandene Wiederherstellungsprobe ist ' + t + ' Tage alt', 'Probe erneut laufen lassen, monatlichen Takt prüfen.');
    else if (t >= S.probeGelbTage) add('probe', 'gelb', 'Letzte Wiederherstellungsprobe ist ' + t + ' Tage alt', 'Probe ist fällig.');
    else add('probe', 'gruen', 'Wiederherstellungsprobe bestanden vor ' + t + ' Tagen (' + ((pr.haupt || {}).zeilen_probe || 0).toLocaleString('de-DE') + ' + ' + ((pr.marktbericht || {}).zeilen_probe || 0).toLocaleString('de-DE') + ' Zeilen)');
  }

  const au = o.audit && o.audit.daten;
  if (au && au.ok) {
    const v = au.schwachstellen || {};
    if ((v.critical || 0) + (v.high || 0) > 0) add('audit', 'gelb', 'npm audit: ' + (v.critical || 0) + ' kritisch, ' + (v.high || 0) + ' hoch', 'Abhängigkeiten im Backend aktualisieren (npm audit fix prüfen).');
    else add('audit', 'gruen', 'npm audit: keine kritischen oder hohen Schwachstellen');
  } else add('audit', 'gelb', au ? 'npm audit lief nicht durch' : 'Noch kein npm audit', 'Wöchentlichen Audit-Takt prüfen.');

  const rang = { rot: 2, gelb: 1, gruen: 0 };
  const gesamt = punkte.reduce((g, p) => (rang[p.stufe] > rang[g] ? p.stufe : g), 'gruen');
  const handlungsbedarf = punkte.filter((p) => p.stufe !== 'gruen').sort((a, b) => rang[b.stufe] - rang[a.stufe]);
  return { gesamt, punkte, handlungsbedarf, kennzahlen: k };
}

/* Mail-Auslöser (rein): welche roten Punkte wären jetzt zu mailen, gegeben die zuletzt gemailten Schlüssel. */
function rotZuMailen(bewertung, gemailt, jetzt) {
  const vor24 = (jetzt || Date.now()) - 24 * 3600000;
  return bewertung.punkte.filter((p) => p.stufe === 'rot' && ROT_MAILEN.includes(p.bereich))
    .filter((p) => { const g = gemailt && gemailt['rot:' + p.bereich]; return !g || g < vor24; });
}
function wocheFaellig(letzteWoche, jetzt) {
  const d = new Date(jetzt || Date.now());
  if (d.getUTCDay() !== 1 || d.getUTCHours() < 6) return false;          // montags ab 07:00 MEZ
  return !letzteWoche || (jetzt || Date.now()) - letzteWoche > 6 * 86400000;
}

async function laden(db, server) {
  const sv = server || process.env.BETRIEB_SERVER || (String(process.env.APP_URL || '').includes('staging') ? 'staging' : 'prod');
  const q = (sql, p) => db.query(sql, p).then((r) => r.rows);
  const [mess] = await q(`SELECT erfasst_am, daten FROM betrieb_messungen WHERE server=$1 AND art='messung' ORDER BY erfasst_am DESC LIMIT 1`, [sv]);
  const verlauf = await q(`SELECT erfasst_am, jsonb_build_object('platte', daten->'platte', 'speicher', daten->'speicher', 'last', daten->'last', 'db', daten->'db') AS daten
                             FROM betrieb_messungen WHERE server=$1 AND art='messung' AND erfasst_am > NOW() - INTERVAL '30 days' ORDER BY erfasst_am`, [sv]);
  const [probe] = await q(`SELECT erfasst_am, daten FROM betrieb_messungen WHERE server=$1 AND art='probe' ORDER BY erfasst_am DESC LIMIT 1`, [sv]);
  const [audit] = await q(`SELECT erfasst_am, daten FROM betrieb_messungen WHERE server=$1 AND art='audit' ORDER BY erfasst_am DESC LIMIT 1`, [sv]);
  let kunden = [];
  try {
    kunden = await q(`SELECT p.name AS plan, COUNT(*)::int AS anzahl FROM subscriptions s JOIN plans p ON p.id = s.plan_id
                      WHERE s.status IN ('active','trialing') GROUP BY p.name ORDER BY 2 DESC`);
  } catch (e) { kunden = []; }
  return { server: sv, messung: mess || null, verlauf, probe: probe || null, audit: audit || null, kunden };
}

function mailHtml(server, b, titel) {
  const farbe = { rot: '#B8625C', gelb: '#b8932f', gruen: '#3FA56C' };
  const wort = { rot: 'Rot', gelb: 'Gelb', gruen: 'Grün' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zeile = (p) => '<tr><td style="padding:6px 8px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + farbe[p.stufe] + '"></span></td>'
    + '<td style="padding:6px 8px;font-size:14px;">' + esc(p.text) + (p.rat ? '<div style="color:#7a7468;font-size:12px;">' + esc(p.rat) + '</div>' : '') + '</td></tr>';
  const hb = b.handlungsbedarf.length ? b.handlungsbedarf : [];
  const body = '<p style="font-size:15px;">Server <b>' + esc(server) + '</b>, Gesamt: <b style="color:' + farbe[b.gesamt] + '">' + wort[b.gesamt] + '</b></p>'
    + (hb.length ? '<h3 style="font-size:15px;margin:16px 0 6px;">Handlungsbedarf</h3><table style="border-collapse:collapse;">' + hb.map(zeile).join('') + '</table>' : '<p>Kein Handlungsbedarf.</p>')
    + '<h3 style="font-size:15px;margin:16px 0 6px;">Alle Punkte</h3><table style="border-collapse:collapse;">' + b.punkte.map(zeile).join('') + '</table>'
    + '<p style="color:#7a7468;font-size:12px;margin-top:16px;">Admin › Betrieb zeigt Verlauf und Einzelheiten.</p>';
  try { return require('./mailLayout').wrap({ heroKicker: 'BETRIEB', heroTitle: titel, bodyHtml: body, preheader: titel }); }
  catch (e) { return body; }
}
function mailText(server, b, titel) {
  const w = { rot: 'ROT', gelb: 'GELB', gruen: 'ok' };
  return titel + '\nServer ' + server + ', Gesamt ' + w[b.gesamt] + '\n\n'
    + (b.handlungsbedarf.length ? 'Handlungsbedarf:\n' + b.handlungsbedarf.map((p) => '- [' + w[p.stufe] + '] ' + p.text + (p.rat ? ' (' + p.rat + ')' : '')).join('\n') : 'Kein Handlungsbedarf.')
    + '\n\nAdmin › Betrieb zeigt Verlauf und Einzelheiten.';
}

/* Stündlicher Lauf (unter takt('betrieb')). opt.trocken: nichts senden, nur zurückgeben. */
async function lauf(db, opt) {
  opt = opt || {};
  const jetzt = opt.jetzt || Date.now();
  const d = await laden(db);
  const b = bewerten({ messung: d.messung, verlauf: d.verlauf, probe: d.probe, audit: d.audit, jetzt, schwellen: schwellenAusUmgebung(), konfigOffsite: String(process.env.BETRIEB_KONFIG_OFFSITE || '') === '1' });
  const mails = await db.query(`SELECT daten->>'schluessel' AS s, MAX(erfasst_am) AS t FROM betrieb_messungen WHERE server=$1 AND art='mail' AND erfasst_am > NOW() - INTERVAL '8 days' GROUP BY 1`, [d.server]).then((r) => r.rows);
  const gemailt = {}; mails.forEach((x) => { gemailt[x.s] = new Date(x.t).getTime(); });
  const rot = rotZuMailen(b, gemailt, jetzt);
  const woche = wocheFaellig(gemailt.woche || null, jetzt);
  const an = (require('../config').admin || {}).email || process.env.ADMIN_EMAIL || '';
  const erg = { server: d.server, gesamt: b.gesamt, rot: rot.map((p) => p.bereich), woche, an: an ? 'ADMIN_EMAIL' : '', gesendet: [] };
  if (opt.trocken || !an) return erg;
  const { sendMail } = require('./mailerService');
  const merke = (schluessel) => db.query(`INSERT INTO betrieb_messungen (server, art, daten) VALUES ($1,'mail',$2)`, [d.server, JSON.stringify({ schluessel })]);
  if (rot.length) {
    const titel = 'Betrieb ' + d.server + ': ' + rot.length + ' rote Meldung' + (rot.length > 1 ? 'en' : '');
    await sendMail({ to: an, subject: '[DealPilot Betrieb] ' + titel + ': ' + rot.map((p) => p.text).join(' · ').slice(0, 120), html: mailHtml(d.server, b, titel), text: mailText(d.server, b, titel) });
    for (const p of rot) await merke('rot:' + p.bereich);
    erg.gesendet.push('rot');
  }
  if (woche) {
    const titel = 'Wochenbericht Betrieb ' + d.server;
    await sendMail({ to: an, subject: '[DealPilot Betrieb] ' + titel + ' · ' + ({ rot: 'Rot', gelb: 'Gelb', gruen: 'Grün' })[b.gesamt], html: mailHtml(d.server, b, titel), text: mailText(d.server, b, titel) });
    await merke('woche');
    erg.gesendet.push('woche');
  }
  // Aufräumen: Messungen älter als 400 Tage (Proben und Audits bleiben)
  await db.query(`DELETE FROM betrieb_messungen WHERE art IN ('messung','mail') AND erfasst_am < NOW() - INTERVAL '400 days'`);
  return erg;
}

module.exports = { SCHWELLEN, schwellenAusUmgebung, ROT_MAILEN, bewerten, hochrechnung, rotZuMailen, wocheFaellig, laden, lauf, mailHtml, mailText };
