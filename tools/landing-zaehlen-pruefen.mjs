#!/usr/bin/env node
/* tools/landing-zaehlen-pruefen.mjs · landing-zaehlen-1 (23.11.2026)
 *
 * Marcel 23.11.2026: „es ist ganz wichtig, dass wir weiterhin unsere Seite so verknüpfen, dass wir auch die User zählen“.
 * Vom 24.09. bis 23.11.2026 zählte die Landing nichts: die neue Startseite (v1594) hatte das Zählskript der alten
 * nicht übernommen, und kein Prüfer merkte es. Dieser Prüfer läuft in deploy-staging.ps1 und rollout-prod.ps1 mit.
 *
 * Prüft gegen die ECHTEN Dateien:
 *   A  jede Seite der sitemap.xml, die in frontend/landing liegt, lädt dp2.js oder besucher-zaehlen.js
 *   B  dp2.js lädt besucher-zaehlen.js nach, besucher-zaehlen.js sendet an /api/v1/track mit pageview, section, exit
 *   C  backend/src/routes/track.js nimmt diese Ereignisse an, der Server bindet die Route ein
 *   D  Gegenprobe: eine Seite ohne Skript wird rot (sonst prüft der Prüfer nichts)
 * RC 0 = sauber. --still: nur bei Rot ausgeben.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const R = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const L = path.join(R, 'frontend', 'landing');
const still = process.argv.includes('--still');
let rot = 0, gruen = 0;
const ok = (b, t) => { if (b) { gruen++; if (!still) console.log('  ok  ' + t); } else { rot++; console.log('  ROT ' + t); } return b; };
const lies = (p) => fs.readFileSync(p, 'utf8');

const zaehlt = (html) => /<script[^>]+src="(?:\.\/)?dp2\.js[^"]*"/.test(html) || /<script[^>]+src="(?:\.\/)?besucher-zaehlen\.js[^"]*"/.test(html);

/* A */
const sitemap = lies(path.join(L, 'sitemap.xml'));
const seiten = [...sitemap.matchAll(/<loc>https?:\/\/[^/<]+\/([^<]*)<\/loc>/g)].map((m) => m[1] || 'index.html');
let geprueft = 0;
for (const s of seiten) {
  const datei = path.join(L, s.endsWith('/') || s === '' ? s + 'index.html' : s);
  if (!fs.existsSync(datei)) continue;   /* Rechtstexte liegen in frontend/, nicht in der Landing */
  geprueft++;
  ok(zaehlt(lies(datei)), 'A ' + s + ' zählt Besucher (dp2.js oder besucher-zaehlen.js)');
}
ok(geprueft >= 15, 'A mindestens 15 Seiten der sitemap.xml geprüft (' + geprueft + ')');

/* B */
const dp2 = lies(path.join(L, 'dp2.js'));
ok(/besucher-zaehlen\.js/.test(dp2) && /__dpZaehlen/.test(dp2), 'B dp2.js lädt besucher-zaehlen.js nach');
const bz = lies(path.join(L, 'besucher-zaehlen.js'));
ok(/\/api\/v1\/track/.test(bz), 'B besucher-zaehlen.js sendet an /api/v1/track');
ok(['pageview', 'section', 'exit', 'scroll', 'cta'].every((t) => bz.indexOf("'" + t + "'") >= 0), 'B Ereignisse pageview, scroll, section, cta, exit');
ok(!/document\.cookie|localStorage/.test(bz), 'B anonym: kein Cookie, kein localStorage (nur sessionStorage im Tab)');

/* C */
const tr = lies(path.join(R, 'backend', 'src', 'routes', 'track.js'));
ok(/INSERT INTO landing_events/.test(tr) && ['pageview', 'section', 'exit'].every((t) => tr.indexOf("'" + t + "'") >= 0), 'C routes/track.js schreibt landing_events und kennt die Ereignisse');
const serverDateien = ['server.js', 'app.js', 'index.js'].map((f) => path.join(R, 'backend', 'src', f)).filter((f) => fs.existsSync(f));
ok(serverDateien.some((f) => /routes\/track/.test(lies(f))), 'C die Route ist im Server eingebunden');

/* D */
ok(!zaehlt('<html><body><script src="dp2-kern.js"></script></body></html>') && zaehlt('<script src="dp2.js?v=x"></script>'), 'D Gegenprobe: Seite ohne Zählskript wäre rot');

console.log((rot ? 'ROT · ' + rot + ' Befund(e), ' : 'SAUBER · ') + gruen + ' Prüfpunkte grün');
process.exit(rot ? 1 : 0);
