#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   tools/vorschau-pruefen.mjs — v3600
   PRUEFT DIE SPERRE DER VORSCHAU-FUNKTIONEN VOR JEDEM ROLLOUT

   Marcel 17.11.2026: „Funktionen, die noch nicht fertig sind, dürfen beim nächsten
   Prod-Rollout nicht für Kunden sichtbar werden.“ Die Liste steht EINMAL in
   backend/src/services/vorschau-funktionen.json. Der Pruefer liest die ECHTEN Dateien:

     A  Liste: Pflichtfelder, Schluessel eindeutig, Gruppen bekannt, Erkennung kompiliert
     B  Entscheidung am echten Kern (services/vorschau.js entscheiden): Kunde gesperrt,
        Admin / Freigabeliste / Zusatz / „für alle“ frei, unbekannter Schluessel gesperrt
     C  Backend: jede Route der Liste ist in index.js montiert und ihre Datei setzt
        router.use(vorschau.sperre('<schluessel>')) VOR der ersten Route; jede Routendatei,
        die die Erkennung der Funktion trifft, traegt die Sperre; jede backend_stelle fragt
        vorschau.darf(..., '<schluessel>'); /api/v1/vorschau ist montiert
     D  Frontend: jede Datei (js/**, index.html, quickcheck-app.html, messkabine.html,
        marktbericht-app/index.html), die die Erkennung trifft, traegt die Sperre
        (DpVorschau.frei('<schluessel>') im Skript, data-vorschau="<schluessel>" am TAG im HTML);
        Ausnahmen nur mit Grund und nur, wenn sie noch treffen; index.html laedt js/vorschau.js
        und blendet [data-vorschau] ab dem ersten Bild aus, auch gegen
        aside.sidebar .sb-act-item{display:flex!important} (v3495)
     E  Gegenprobe (immer): dieselben Pruefungen gegen Kopien im Speicher, aus denen je eine
        Sperre entfernt ist - jede muss ROT werden. Ein Pruefer, der dabei gruen bleibt, prueft nichts.

   Aufruf:  node tools/vorschau-pruefen.mjs           RC=0 sauber, RC=1 rot
            node tools/vorschau-pruefen.mjs --liste   die Liste (Schluessel, seit, fuer wen)
   Laeuft in tools/deploy-staging.ps1 und tools/rollout-prod.ps1 (bricht ab).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const LISTE_PFAD = 'backend/src/services/vorschau-funktionen.json';
const ARGS = process.argv.slice(2);

function lesenEcht(rel) { try { return fs.readFileSync(path.join(WURZEL, rel), 'utf8'); } catch (e) { return null; } }
function alleDateien(rel, filter) {
  const out = [];
  (function lauf(r) {
    let ents; try { ents = fs.readdirSync(path.join(WURZEL, r), { withFileTypes: true }); } catch (e) { return; }
    for (const d of ents) {
      const x = r + '/' + d.name;
      if (d.isDirectory()) { if (!/node_modules|\.git/.test(d.name)) lauf(x); }
      else if (filter(x)) out.push(x);
    }
  })(rel);
  return out;
}

const liste = JSON.parse(lesenEcht(LISTE_PFAD)).funktionen;

if (ARGS.includes('--liste')) {
  for (const e of liste) console.log(e.schluessel.padEnd(20) + ' seit ' + String(e.seit).padEnd(7) + ' frei fuer ' + e.frei_fuer.join(', ') + '  · ' + e.bezeichnung);
  process.exit(0);
}

/* Frontend-Dateien, die Kunden erreichen. admin/ hat einen eigenen Zugang (Admin-Token),
   landing/handbuch/messe-schleife sind Werbung und Hilfe ohne App-Funktion. */
const FRONT_HTML = ['frontend/index.html', 'frontend/quickcheck-app.html', 'frontend/messkabine.html', 'frontend/marktbericht-app/index.html'];
const FRONT_JS = alleDateien('frontend/js', (x) => x.endsWith('.js'));
const ROUTEN = alleDateien('backend/src/routes', (x) => x.endsWith('.js'));

/* ── die Pruefungen, gegen eine Lesefunktion (echt oder Gegenprobe) ── */
function pruefen(lesen, still) {
  const fehler = [];
  const ok = (bed, text) => { if (!bed) fehler.push(text); else if (!still) console.log('  ok  ' + text); return bed; };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* C · Backend */
  const idx = lesen('backend/src/index.js') || '';
  ok(/app\.use\('\/api\/v1\/vorschau',\s*require\('\.\/routes\/vorschau'\)\)/.test(idx), 'C  index.js montiert /api/v1/vorschau');
  for (const e of liste) {
    const k = e.schluessel;
    const sperreRe = new RegExp("router\\.use\\(\\s*vorschau\\.sperre\\(\\s*'" + esc(k) + "'\\s*\\)\\s*\\)");
    const markerRe = new RegExp("vorschau\\.(sperre|darf)\\([^)]*'" + esc(k) + "'");
    const geprueft = new Set();
    for (const r of e.routen || []) {
      const m = idx.match(new RegExp("app\\.use\\('" + esc(r) + "'[^\\n]*?require\\('\\./routes/([A-Za-z0-9_-]+)'\\)"));
      if (!ok(!!m, 'C  ' + k + ': ' + r + ' in index.js montiert')) continue;
      const datei = 'backend/src/routes/' + m[1] + '.js';
      geprueft.add(datei);
      const t = lesen(datei) || '';
      const iSperre = t.search(sperreRe);
      const iRoute = t.search(/router\.(get|post|put|patch|delete|all)\(/);
      ok(iSperre >= 0, 'C  ' + k + ': ' + datei + ' setzt router.use(vorschau.sperre(\'' + k + '\'))');
      ok(iSperre >= 0 && (iRoute < 0 || iSperre < iRoute), 'C  ' + k + ': Sperre steht vor der ersten Route in ' + datei);
      ok(/require\('\.\.\/services\/vorschau'\)/.test(t), 'C  ' + k + ': ' + datei + ' laedt services/vorschau');
    }
    if (e.backend_erkennung) {
      const re = new RegExp(e.backend_erkennung);
      for (const datei of ROUTEN) {
        if (geprueft.has(datei)) continue;
        const t = lesen(datei) || '';
        if (!re.test(t)) continue;
        const admin = /router\.use\(\s*requireAdmin\s*\)/.test(t) && t.search(/router\.use\(\s*requireAdmin\s*\)/) < Math.max(0, t.search(/router\.(get|post|put|patch|delete|all)\(/));
        if (admin) { if (!still) console.log('  --  ' + k + ': ' + datei + ' nur Admin (requireAdmin vor allen Routen)'); continue; }
        ok(markerRe.test(t), 'C  ' + k + ': ' + datei + ' trifft die Erkennung und traegt die Sperre');
      }
    }
    for (const s of e.backend_stellen || []) {
      const t = lesen(s.datei) || '';
      ok(markerRe.test(t), 'C  ' + k + ': ' + s.datei + ' fragt vorschau.darf(…, \'' + k + '\') (' + s.grund + ')');
    }
  }

  /* D · Frontend */
  const html = lesen('frontend/index.html') || '';
  const iVs = html.indexOf('<script src="js/vorschau.js');
  ok(iVs > 0, 'D  index.html laedt js/vorschau.js');
  ok(/<style id="dp-vorschau-grund">[^<]*\[data-vorschau\]:not\(\.dpv-frei\)[^<]*aside\.sidebar \.sb-act-item\[data-vorschau\]:not\(\.dpv-frei\)[^<]*display:none !important/.test(html)
    && html.indexOf('id="dp-vorschau-grund"') < html.indexOf('</head>'), 'D  index.html blendet [data-vorschau] im <head> aus, auch gegen aside.sidebar .sb-act-item (v3495)');
  const vs = lesen('frontend/js/vorschau.js') || '';
  ok(/aside\.sidebar \.sb-act-item\[data-vorschau\]:not\(\.dpv-frei\)/.test(vs) && /#sidebar \[data-vorschau\]:not\(\.dpv-frei\)/.test(vs), 'D  js/vorschau.js: Sperrregel mit Sidebar- und ID-Anker');
  ok(/Auth\.apiCall\('\/vorschau'\)/.test(vs) && /\.catch\(function \(\) \{ return \{\}; \}\)/.test(vs), 'D  js/vorschau.js: ohne Antwort bleibt alles gesperrt');
  for (const e of liste) {
    const k = e.schluessel;
    const re = new RegExp(e.frontend_erkennung, 'g');
    const aus = e.frontend_ausgenommen || {};
    for (const datei of Object.keys(aus)) {
      const t = lesen(datei);
      ok(t != null && new RegExp(e.frontend_erkennung).test(t), 'D  ' + k + ': Ausnahme ' + datei + ' trifft die Erkennung noch (' + aus[datei] + ')');
    }
    for (const datei of FRONT_HTML) {
      const t = lesen(datei); if (!t) continue;
      let m; re.lastIndex = 0;
      while ((m = re.exec(t))) {
        if (aus[datei]) break;
        const a = t.lastIndexOf('<', m.index), b = t.indexOf('>', m.index);
        const tag = t.slice(a, b + 1);
        if (/^<script\b/i.test(tag) || /^<\/?(script|style)/i.test(tag)) continue;
        /* Treffer im Skriptblock oder Kommentar: dann muss die Datei die Skript-Sperre tragen */
        const imTag = a >= 0 && b > m.index && t.lastIndexOf('>', m.index) < a;
        if (imTag) ok(tag.indexOf('data-vorschau="' + k + '"') >= 0, 'D  ' + k + ': ' + datei + ' Tag mit „' + m[0] + '“ traegt data-vorschau="' + k + '"');
        else ok(t.indexOf("DpVorschau.frei('" + k + "')") >= 0 || /<!--[^]*$/.test(t.slice(Math.max(0, t.lastIndexOf('-->', m.index)), m.index)), 'D  ' + k + ': ' + datei + ' „' + m[0] + '“ ausserhalb eines Tags nur mit DpVorschau.frei');
      }
    }
    for (const datei of FRONT_JS) {
      if (aus[datei]) continue;
      const t = lesen(datei) || '';
      if (!new RegExp(e.frontend_erkennung).test(t)) continue;
      ok(t.indexOf("DpVorschau.frei('" + k + "')") >= 0, 'D  ' + k + ': ' + datei + ' trifft die Erkennung und fragt DpVorschau.frei(\'' + k + '\')');
    }
  }
  return fehler;
}

let rot = 0;
const rotMelden = (t) => { rot++; console.log('  ROT ' + t); };

/* A · Liste */
console.log('A  Liste ' + LISTE_PFAD + ' (' + liste.length + ' Funktionen)');
const gesehen = new Set();
for (const e of liste) {
  const z = e.schluessel || '?';
  if (!/^[a-z][a-z0-9_]*$/.test(e.schluessel || '')) rotMelden(z + ': Schluessel fehlt oder ist nicht [a-z0-9_]');
  if (gesehen.has(z)) rotMelden(z + ': doppelt'); gesehen.add(z);
  if (!e.bezeichnung || !e.beschreibung) rotMelden(z + ': Bezeichnung oder Beschreibung fehlt');
  if (!/^v\d{3,4}[a-z]?$/.test(e.seit || '')) rotMelden(z + ': seit ist keine Version vNNNN');
  if (!Array.isArray(e.frei_fuer) || !e.frei_fuer.length) rotMelden(z + ': frei_fuer leer');
  (e.frei_fuer || []).forEach((g) => { if (!/^(admin|vorschau|zusatz:[a-z_]+)$/.test(g)) rotMelden(z + ': unbekannte Gruppe ' + g); });
  try { new RegExp(e.frontend_erkennung); if (!e.frontend_erkennung) throw new Error('leer'); } catch (x) { rotMelden(z + ': frontend_erkennung ' + x.message); }
  /* v4140 · reine Darstellungs-Funktion ohne Route: nur mit ausdruecklicher Begruendung in nur_frontend (mind. 40 Zeichen) */
  if (!(e.routen || []).length && !(e.backend_stellen || []).length && !(typeof e.nur_frontend === 'string' && e.nur_frontend.trim().length >= 40)) rotMelden(z + ': keine Backend-Sperre (routen oder backend_stellen) - Ausblenden allein reicht nicht (nur_frontend nur mit Begruendung)');
}
if (!rot) console.log('  ok  ' + liste.map((e) => e.schluessel).join(', '));

/* B · Entscheidung am echten Kern */
console.log('B  Entscheidung (backend/src/services/vorschau.js)');
const V = require(path.join(WURZEL, 'backend/src/services/vorschau.js'));
const S = (a) => new Set(a || []);
const faelle = [];
for (const e of liste) {
  const k = e.schluessel;
  faelle.push([k + ': Kunde ohne alles gesperrt', V.entscheiden(k, { role: 'user', zusaetze: S(), fuerAlle: S() }).frei === false]);
  faelle.push([k + ': Kunde mit anderem Zusatz gesperrt', V.entscheiden(k, { role: 'user', zusaetze: S(['flow', 'rechenkerne_api']), fuerAlle: S() }).frei === false]);
  faelle.push([k + ': „für alle“ frei', V.entscheiden(k, { role: 'user', zusaetze: S(), fuerAlle: S([k]) }).frei === true]);
  faelle.push([k + ': „für alle“ einer ANDEREN Funktion gesperrt', V.entscheiden(k, { role: 'user', zusaetze: S(), fuerAlle: S(liste.filter((x) => x.schluessel !== k).map((x) => x.schluessel)) }).frei === false]);
  const adm = e.frei_fuer.includes('admin'), vor = e.frei_fuer.includes('vorschau');
  faelle.push([k + ': Admin ' + (adm ? 'frei' : 'gesperrt'), V.entscheiden(k, { role: 'admin', zusaetze: S(), fuerAlle: S() }).frei === adm]);
  faelle.push([k + ': Freigabeliste ' + (vor ? 'frei' : 'gesperrt'), V.entscheiden(k, { role: 'user', zusaetze: S(['vorschau']), fuerAlle: S() }).frei === vor]);
  e.frei_fuer.filter((g) => g.startsWith('zusatz:')).forEach((g) => faelle.push([k + ': ' + g + ' frei', V.entscheiden(k, { role: 'user', zusaetze: S([g.slice(7)]), fuerAlle: S() }).frei === true]));
}
faelle.push(['unbekannter Schluessel gesperrt, auch fuer Admin', V.entscheiden('gibt_es_nicht', { role: 'admin', zusaetze: S(['vorschau']), fuerAlle: S(['gibt_es_nicht']) }).frei === false]);
let sperreWirft = false; try { V.sperre('gibt_es_nicht'); } catch (x) { sperreWirft = true; }
faelle.push(['vorschau.sperre(unbekannt) wirft beim Start (kein stilles Durchlassen)', sperreWirft]);
const zsQ = lesenEcht('backend/src/services/zusatzService.js') || '';   /* Text statt require: pg liegt nur im Container */
faelle.push(['zusatzService kennt den Zusatz vorschau (BEKANNT)', /const VORSCHAU = 'vorschau';/.test(zsQ) && /const BEKANNT = \[[^\]]*\bVORSCHAU\b[^\]]*\]/.test(zsQ)]);
let bOk = 0; faelle.forEach(([t, b]) => { if (b) bOk++; else rotMelden('B  ' + t); });
console.log('  ok  ' + bOk + ' von ' + faelle.length + ' Faellen');

/* C/D · die echten Dateien */
console.log('C/D  Sperren im Backend und Frontend (echte Dateien)');
const echt = pruefen(lesenEcht, ARGS.includes('--still'));
echt.forEach((f) => rotMelden(f));

/* E · Gegenprobe: je eine Sperre entfernt -> muss rot werden */
console.log('E  Gegenprobe (Kopien im Speicher, je eine Sperre entfernt)');
const proben = [
  ['Route gutachterpartner ohne router.use(vorschau.sperre)', 'backend/src/routes/gutachterpartner.js', (t) => t.replace(/router\.use\(vorschau\.sperre\('gutachten_org'\)\);/, '')],
  ['Route wuensche ohne Sperre', 'backend/src/routes/wuensche.js', (t) => t.replace(/router\.use\(vorschau\.sperre\('umsetzungswuensche'\)\);/, '')],
  ['Route vivi ohne Sperre (v3950)', 'backend/src/routes/vivi.js', (t) => t.replace(/router\.use\(vorschau\.sperre\('vivi'\)\);/, '')],
  ['vivi.js (App) ohne DpVorschau.frei (v3950)', 'frontend/js/vivi.js', (t) => t.split("DpVorschau.frei('vivi')").join('DpVorschau.x()')],
  ['grafiken-neu.js ohne DpVorschau.frei (v4140)', 'frontend/js/grafiken-neu.js', (t) => t.split("DpVorschau.frei('grafiken_neu')").join('DpVorschau.x()')],
  ['Sperre der Route nach der ersten Route', 'backend/src/routes/gutachterpartner.js', (t) => t.replace(/router\.use\(vorschau\.sperre\('gutachten_org'\)\);/, '') + "\nrouter.use(vorschau.sperre('gutachten_org'));\n"],
  ['PDF dok_vermoegen ohne vorschau.darf', 'backend/src/services/telegramPdfService.js', (t) => t.replace(/\.darf\(\{ id: s\.userId, role: s\.role \}, 'vermoegen'\)/, '.nix()')],
  ['gutachterpartner.js (App) ohne DpVorschau.frei', 'frontend/js/gutachterpartner.js', (t) => t.split("DpVorschau.frei('gutachten_org')").join('DpVorschau.x()')],
  ['index.html: Vermögen-Knopf ohne data-vorschau', 'frontend/index.html', (t) => t.replace('data-act="vermoegen" data-vorschau="vermoegen"', 'data-act="vermoegen"')],
  ['index.html: Umsetzungswünsche ohne data-vorschau', 'frontend/index.html', (t) => t.replace(' data-vorschau="umsetzungswuensche"', '')],
  ['index.html ohne Grundregel im <head>', 'frontend/index.html', (t) => t.replace(/<style id="dp-vorschau-grund">[^<]*<\/style>/, '')],
  ['neue Datei ruft /gutachterpartner ohne Sperre', 'frontend/js/__neu__.js', () => "Auth.apiCall('/gutachterpartner/status');"],
  ['neue Routendatei nutzt evalionClient ohne Sperre', 'backend/src/routes/__neu__.js', () => "const ev = require('../services/evalionClient'); router.get('/x', f);"]
];
for (const [name, datei, aendern] of proben) {
  const neu = !lesenEcht(datei);
  if (neu) { if (datei.startsWith('frontend/js/')) FRONT_JS.push(datei); else ROUTEN.push(datei); }
  const roh = lesenEcht(datei) || '';
  const geaendert = aendern(roh);
  const f = (geaendert === roh && !neu) ? [] : pruefen((rel) => (rel === datei ? geaendert : lesenEcht(rel)), true).filter((x) => echt.indexOf(x) < 0);   /* nur NEUE Befunde zaehlen */
  if (neu) { const l = datei.startsWith('frontend/js/') ? FRONT_JS : ROUTEN; l.splice(l.indexOf(datei), 1); }
  if (f.length) console.log('  ok  rot bei: ' + name + '  (' + f[0] + ')');
  else rotMelden('E  Gegenprobe blieb GRUEN: ' + name + (geaendert === roh && !neu ? ' (Anker nicht gefunden)' : ''));
}

console.log('');
if (rot) { console.log('ROT - ' + rot + ' Befund(e). Eine Vorschau-Funktion waere fuer Kunden erreichbar. Kein Rollout.'); process.exit(1); }
console.log('SAUBER - ' + liste.length + ' Vorschau-Funktionen hinter Frontend- und Routen-Sperre, Gegenprobe ' + proben.length + '/' + proben.length + ' rot.');
process.exit(0);
