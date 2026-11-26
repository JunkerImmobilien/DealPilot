#!/usr/bin/env node
// tools/betrieb-pruefen.mjs — v4880 · Prüfer für services/betrieb.js (Ampeln, Hochrechnung, Mail-Auslöser)
// Lädt die ECHTE Datei, ohne Datenbank. Gegenproben: jede Schwelle einmal knapp drunter / drüber.
// Zusätzlich Quelltext: Host-Skripte nur lesend (kein apt upgrade, kein reboot, kein rm außer Probe-Container),
// Takt unter takt('betrieb'), Mail nur mit BETRIEB_MAIL=1, Route requireAdmin.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = require(path.join(WURZEL, 'backend/src/services/betrieb.js'));

let ok = 0, rot = 0;
function pr(name, bed) { if (bed) { ok++; } else { rot++; console.log('ROT  ' + name); } }

const JETZT = Date.parse('2026-11-25T12:00:00Z');
const h = (std) => new Date(JETZT - std * 3600000).toISOString();
function basis(over) {
  const d = {
    platte: { gesamt: 160e9, belegt: 66e9, frei: 88e9, pct: 41.1 },
    speicher: { gesamt: 8e9, verfuegbar: 6e9, pct: 25 }, last: { l1: 0.3, kerne: 4 },
    updates: { ausstehend: 5, sicherheit: 0, automatisch: true, neustart_noetig: false },
    ports: { offen: [22, 80, 443], unerwartet: [] },
    tls: [{ domain: 'a.test', tage: 80 }], images: [{ image: 'x', tage: 10 }],
    db: { haupt: 35e6, marktbericht: 637e6 }, uploads: 15e6,
    sicherung: { haupt: [{ groesse: 7.6e6, zeit: h(9) }, { groesse: 7.5e6, zeit: h(33) }], marktbericht: [{ groesse: 32e6, zeit: h(9) }], uploads: [{ groesse: 15e6, zeit: h(9) }], log_ok: true, log_letzte: 'ok' }
  };
  return Object.assign(d, over || {});
}
const probeOk = { erfasst_am: h(24 * 5), daten: { bestanden: true, haupt: { zeilen_probe: 10 }, marktbericht: { zeilen_probe: 20 } } };
const auditOk = { erfasst_am: h(24), daten: { ok: true, schwachstellen: { critical: 0, high: 0 } } };
function bew(daten, extra) {
  return B.bewerten(Object.assign({ messung: { erfasst_am: h(0.5), daten }, verlauf: [], probe: probeOk, audit: auditOk, jetzt: JETZT, konfigOffsite: true }, extra || {}));
}
const stufe = (b, bereich) => { const p = b.punkte.filter((x) => x.bereich === bereich); return p.length ? p.reduce((g, x) => (x.stufe === 'rot' ? 'rot' : (x.stufe === 'gelb' && g !== 'rot' ? 'gelb' : g)), 'gruen') : null; };

// A · Grundfall grün
let b = bew(basis());
pr('A1 Grundfall gesamt grün', b.gesamt === 'gruen');
pr('A2 kein Handlungsbedarf', b.handlungsbedarf.length === 0);

// B · Platte
pr('B1 69,9 % grün', stufe(bew(basis({ platte: { gesamt: 100, belegt: 69.9, frei: 30, pct: 69.9 } })), 'platte') === 'gruen');
pr('B2 70 % gelb', stufe(bew(basis({ platte: { gesamt: 100, belegt: 70, frei: 30, pct: 70 } })), 'platte') === 'gelb');
pr('B3 85 % rot', stufe(bew(basis({ platte: { gesamt: 100, belegt: 85, frei: 15, pct: 85 } })), 'platte') === 'rot');

// C · Hochrechnung: 1 GB/Tag Wachstum, 160 GB, 66 GB belegt → 85 % (136 GB) in 70 Tagen ≈ 2,3 Monate
const verlauf = [];
for (let t = 10; t >= 0; t--) verlauf.push({ erfasst_am: h(t * 24), daten: { platte: { belegt: 66e9 - t * 1e9 } } });
const hr = B.hochrechnung(verlauf.map((v) => ({ zeit: v.erfasst_am, belegt: v.daten.platte.belegt })), 160e9, JETZT);
pr('C1 Wachstum 1 GB/Tag erkannt', Math.abs(hr.je_tag - 1e9) < 1e6);
pr('C2 85 % in ~2,3 Monaten', Math.abs(hr.monate_85 - 2.3) < 0.15);
pr('C3 daraus rot (≤ 4 Monate)', stufe(bew(basis(), { verlauf }), 'wachstum') === 'rot');
const flach = verlauf.map((v) => ({ zeit: v.erfasst_am, belegt: 66e9 }));
pr('C4 kein Wachstum → keine Monate', B.hochrechnung(flach, 160e9, JETZT).monate_85 == null);
pr('C5 zu kurzer Verlauf → keine Hochrechnung', B.hochrechnung(flach.slice(-2), 160e9, JETZT).je_tag == null);

// D · Sicherung
pr('D1 fehlt → rot', stufe(bew(basis({ sicherung: { haupt: [], marktbericht: [], log_ok: true } })), 'sicherung') === 'rot');
const alt = basis(); alt.sicherung.haupt[0].zeit = h(27);
pr('D2 27 h alt → rot', stufe(bew(alt), 'sicherung') === 'rot');
const klein = basis(); klein.sicherung.haupt[0].groesse = 3e6;
pr('D3 < 50 % der Vornacht → rot', stufe(bew(klein), 'sicherung') === 'rot');
const logf = basis(); logf.sicherung.log_ok = false;
pr('D4 Log-Fehler → rot', stufe(bew(logf), 'sicherung') === 'rot');

// E · TLS, Neustart, Ports, Updates, Images
pr('E1 TLS 13 Tage rot', stufe(bew(basis({ tls: [{ domain: 'a', tage: 13 }] })), 'tls') === 'rot');
pr('E2 TLS 20 Tage gelb', stufe(bew(basis({ tls: [{ domain: 'a', tage: 20 }] })), 'tls') === 'gelb');
pr('E3 Neustart seit 11 Tagen gelb', stufe(bew(basis({ updates: { sicherheit: 0, automatisch: true, neustart_noetig: true, neustart_seit: h(24 * 11) } })), 'neustart') === 'gelb');
pr('E4 Neustart seit 31 Tagen rot', stufe(bew(basis({ updates: { sicherheit: 0, automatisch: true, neustart_noetig: true, neustart_seit: h(24 * 31) } })), 'neustart') === 'rot');
pr('E5 unerwarteter Port rot', stufe(bew(basis({ ports: { offen: [22, 80, 443, 5432], unerwartet: [5432] } })), 'ports') === 'rot');
pr('E6 Sicherheitsupdate gelb', stufe(bew(basis({ updates: { sicherheit: 2, sicherheit_pakete: ['a'], automatisch: true } })), 'updates') === 'gelb');
pr('E7 Image 772 Tage gelb', stufe(bew(basis({ images: [{ image: 'postgis', tage: 772 }] })), 'images') === 'gelb');

// F · Messung, Probe, Audit
pr('F1 Messung 4 h alt → rot', stufe(B.bewerten({ messung: { erfasst_am: h(4), daten: basis() }, verlauf: [], probe: probeOk, audit: auditOk, jetzt: JETZT }), 'messung') === 'rot');
pr('F2 keine Probe → gelb', stufe(bew(basis(), { probe: null }), 'probe') === 'gelb');
pr('F3 Probe nicht bestanden → rot', stufe(bew(basis(), { probe: { erfasst_am: h(24), daten: { bestanden: false } } }), 'probe') === 'rot');
pr('F4 Probe 63 Tage → rot', stufe(bew(basis(), { probe: { erfasst_am: h(24 * 63), daten: { bestanden: true } } }), 'probe') === 'rot');
pr('F5 Audit kritisch → gelb', stufe(bew(basis(), { audit: { erfasst_am: h(1), daten: { ok: true, schwachstellen: { critical: 1 } } } }), 'audit') === 'gelb');

pr('F6 Konfiguration ohne Offsite → gelb', stufe(bew(basis(), { konfigOffsite: false }), 'konfig') === 'gelb');
pr('F7 Konfiguration mit Offsite → grün', stufe(bew(basis(), { konfigOffsite: true }), 'konfig') === 'gruen');

// G · Mail-Auslöser
const br = bew(basis({ platte: { gesamt: 100, belegt: 90, frei: 10, pct: 90 }, images: [{ image: 'x', tage: 900 }] }));
pr('G1 Platte rot wird gemailt', B.rotZuMailen(br, {}, JETZT).some((p) => p.bereich === 'platte'));
pr('G2 innerhalb 24 h nicht erneut', !B.rotZuMailen(br, { 'rot:platte': JETZT - 3600000 }, JETZT).some((p) => p.bereich === 'platte'));
pr('G3 nach 25 h erneut', B.rotZuMailen(br, { 'rot:platte': JETZT - 25 * 3600000 }, JETZT).some((p) => p.bereich === 'platte'));
pr('G4 gelb (Images) nie sofort gemailt', !B.rotZuMailen(br, {}, JETZT).some((p) => p.bereich === 'images'));
const unerw = bew(basis({ ports: { offen: [5432], unerwartet: [5432] } }));
pr('G5 Ports rot nur in Wochenmail, nicht sofort (nicht in ROT_MAILEN)', !B.rotZuMailen(unerw, {}, JETZT).length);
const mo = Date.parse('2026-11-30T07:00:00Z'), di = Date.parse('2026-12-01T07:00:00Z');
pr('G6 Wochenmail montags fällig', B.wocheFaellig(null, mo));
pr('G7 dienstags nicht', !B.wocheFaellig(null, di));
pr('G8 nicht zweimal in der Woche', !B.wocheFaellig(mo - 3600000, mo));
pr('G9 Mail-Text nennt Handlungsbedarf', B.mailText('prod', br, 'T').includes('Handlungsbedarf'));

// H · Quelltext
const sammler = fs.readFileSync(path.join(WURZEL, 'tools/server/betrieb-sammeln.py'), 'utf8');
const probe = fs.readFileSync(path.join(WURZEL, 'tools/server/wiederherstellungsprobe.sh'), 'utf8');
const idx = fs.readFileSync(path.join(WURZEL, 'backend/src/index.js'), 'utf8');
const adm = fs.readFileSync(path.join(WURZEL, 'backend/src/routes/admin.js'), 'utf8');
const code = (s) => s.split('\n').filter((z) => !/^\s*#/.test(z)).join('\n');
pr('H1 Sammler ohne apt upgrade/install', !/apt(-get)?\s+(upgrade|install|full-upgrade|dist-upgrade)/.test(code(sammler)));
pr('H2 Sammler ohne reboot/shutdown', !/\b(reboot|shutdown)\b(?![-.])/.test(code(sammler)));
pr('H3 Sammler löscht nichts', !/\brm\s|os\.remove|shutil\.rmtree/.test(code(sammler)));
pr('H4 Probe nur --network none', /--network none/.test(probe));
pr('H5 Probe räumt per trap auf', /trap aufraeumen EXIT/.test(probe) && /docker rm -f -v "\$P1" "\$P2"/.test(probe));
pr('H6 Probe ohne reboot/apt', !/\b(reboot|apt)\b/.test(code(probe)));
pr('H7 Takt unter takt(\'betrieb\')', /takt\('betrieb'/.test(idx));
pr('H8 Mails nur mit BETRIEB_MAIL=1', /BETRIEB_MAIL \|\| ''\) === '1'/.test(idx));
pr('H10 Mail nur rot aus Liste', JSON.stringify(B.ROT_MAILEN) === JSON.stringify(['platte','sicherung','tls','probe','messung']));
pr('H9 Routen requireAdmin', /router\.get\('\/betrieb', requireAdmin/.test(adm) && /router\.get\('\/betrieb\/mail-vorschau', requireAdmin/.test(adm));

/* v5080 · Mietspiegel-Wächter: gelb bei neuer Ausgabe oder Ablauf, nie rot, nie in der Sofort-Mail; ohne Antwort kein Punkt */
const msP = (ms) => B.bewerten({ mietspiegel: ms }).punkte.filter((p) => p.bereich === 'mietspiegel');
pr('M1 Mietspiegel geändert = gelb', (msP({ letzter_lauf: 'x', geprueft: 9, geaendert: [{ gemeinde: 'A' }], abgelaufen: [] })[0] || {}).stufe === 'gelb');
pr('M2 Mietspiegel abgelaufen = gelb', (msP({ letzter_lauf: 'x', geprueft: 9, geaendert: [], abgelaufen: [{ gemeinde: 'B', bis: '2026-01-01' }] })[0] || {}).stufe === 'gelb');
pr('M3 Mietspiegel ohne Befund = grün', (msP({ letzter_lauf: 'x', geprueft: 9, geaendert: [], abgelaufen: [] })[0] || {}).stufe === 'gruen');
pr('M4 Mietspiegel ohne Antwort = kein Punkt', msP({ fehler_abruf: 'ECONNREFUSED' }).length === 0 && msP(null).length === 0);
pr('M5 mietspiegel nicht in ROT_MAILEN', B.ROT_MAILEN.indexOf('mietspiegel') < 0);

console.log((rot ? 'ROT' : 'GRÜN') + ' · betrieb-pruefen ' + ok + '/' + (ok + rot));
process.exit(rot ? 1 : 0);
