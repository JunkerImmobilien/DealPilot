#!/usr/bin/env node
/* kartenvermerk-pruefen.mjs · v3338 — Namensnennung der Kartengrundlage im Kundenweg
   Die Kartenbilder von /marktbericht/static-map und die Leaflet-/Lagekarten-Kacheln beruhen auf
   OpenStreetMap-Daten (ODbL). Jede Stelle im Kundenweg, die eine solche Karte zeigt, muss
   "© OpenStreetMap-Mitwirkende" in Reichweite tragen. Den Kartendienst selbst nennen wir nicht.
   Grep-basiert, ohne Netz, an den ECHTEN Dateien:
     A  Suche: jede Datei unter frontend/ (ohne vendor/, messe-*), die static-map, tile.openstreetmap.org
        oder L.tileLayer( (ohne .wms) aufruft, steht in der Liste unten - eine neue Fundstelle ist ROT,
        bis sie hier mit ihrem Vermerk eingetragen ist
     B  je Stelle der Vermerk in Reichweite (Profi-Bericht, Marktbericht-PDF, Angebotsseite,
        Leaflet-Ebenen, Lagekarte)
     C  der Vermerk nennt nur OpenStreetMap, nicht den Kartendienst
     G  Gegenprobe: dieselben Pruefungen gegen den Stand vor v3338 (Commit 9f695066) muessen ROT sein
   RC=0 sauber. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOR = '9f695066';
let n = 0, fehler = 0;
const ok = (b, t) => { n++; if (!b) fehler++; console.log((b ? '  ok   ' : '  ROT  ') + t); };
const VERMERK = /(©|\\u00a9|\\u00A9|&copy;) ?OpenStreetMap-Mitwirkende/;

/* Kommentare grob entfernen (Zeilen- und Blockkommentare), damit ein Vermerk im Kommentar nicht zaehlt */
const ohneKommentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
const lies = (p) => readFileSync(join(WURZEL, p), 'utf8');
const liesAlt = (p) => { try { return execSync('git show ' + VOR + ':' + p, { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch (e) { return null; } };

/* ── Die bekannten Stellen und ihr Vermerk ────────────────────────────── */
const STELLEN = {
  'frontend/js/marktbericht-profi.js': (s) => {
    const c = ohneKommentar(s);
    return [
      [/var OSM_VERMERK = '(\\u00a9|©) OpenStreetMap-Mitwirkende'/.test(c), 'Profi: Vermerk-Konstante'],
      [/function mitOsmVermerk\([\s\S]{0,700}fillText\(OSM_VERMERK/.test(c), 'Profi: mitOsmVermerk malt den Vermerk ins Bild'],
      [/karte\(lat, lon, 16, 1200, 620\)[^\n]*mitZonen[^\n]*mitOsmVermerk\(k, 1200, 620\)/.test(c), 'Profi: Nahkarte (Lage) mit Vermerk, NACH den Bodenrichtwertzonen gemalt'],
      [/karte\(lat, lon, 12, 1200, 620\)\.then\(function \(k\) \{ return mitOsmVermerk\(k, 1200, 620\)/.test(c), 'Profi: Regionalkarte (Lage) mit Vermerk'],
      [/titelbild && istKarte \? '<span class="osm">' \+ esc\(OSM_VERMERK\)/.test(c), 'Profi: Titelkarte (Deckblatt) mit Vermerk ueber dem Bild (object-fit:cover schneidet einen gemalten ab)'],
      [/\.deck \.bild \.rechts \.osm\{position:absolute/.test(c), 'Profi: Stil des Deckblatt-Vermerks'],
      [/Kartengrundlage: (\\u00a9|©) OpenStreetMap-Mitwirkende/.test(c), 'Profi: Quellenseite nennt die Kartengrundlage'],
    ];
  },
  'frontend/marktbericht-app/app.js': (s) => {
    const c = ohneKommentar(s);
    return [
      [/function contentBg\(\) \{\s*osmAufSeite = false;/.test(c), 'MB-PDF: jede Inhaltsseite setzt den Merker zurueck'],
      [/addImage\(lightImg, 'PNG', 0, 0, W, H, 'lightwm'\); osmAufSeite = true;/.test(c), 'MB-PDF: helle Hintergrundkarte setzt den Merker'],
      [/if \(osmAufSeite\) \{[\s\S]{0,200}doc\.text\('(\\u00A9|©) OpenStreetMap-Mitwirkende', W - M, H - 4\.5/.test(c), 'MB-PDF: Fusszeile druckt den Vermerk auf Seiten mit Karte'],
      [/addImage\(objImg, 'PNG', 0, 0, W, H\); osmAufSeite = true;/.test(c), 'MB-PDF: Inhaltsverzeichnis mit Titelkarte als Hintergrund traegt den Vermerk'],
      [/if \(!covArtUsed\) \{\s*doc\.setFontSize\(6\.5\)[^\n]*\n\s*doc\.text\('\\u00A9 OpenStreetMap-Mitwirkende'/.test(c), 'MB-PDF: Deckblatt mit Live-Karte (auch object_image) traegt den Vermerk'],
      [/attribution: '© OpenStreetMap-Mitwirkende'/.test(c), 'MB-Web: Leaflet-Karte mit Namensnennung'],
    ];
  },
  'frontend/marktbericht-app/angebot.html': (s) => [
    [/<span class="osm" id="heroOsm" hidden>© OpenStreetMap-Mitwirkende<\/span>/.test(s), 'Angebot: Vermerk im Kopfbild vorhanden (versteckt bis Kartenrueckfall)'],
    [/img\.onerror = \(\) => \{[^\n]*img\.src = mapUrl; if \(o\) o\.hidden = false;/.test(s), 'Angebot: Rueckfall auf die Karte zeigt den Vermerk'],
    [/attribution: '© OpenStreetMap-Mitwirkende'/.test(s), 'Angebot: Leaflet-Karte mit Namensnennung'],
  ],
  'frontend/js/brw-karte.js': (s) => [
    [/L\.tileLayer\('https:\/\/tile\.openstreetmap\.org[^)]*attribution: '© OpenStreetMap-Mitwirkende'/.test(s), 'BRW-Karte: OSM-Ebene mit Namensnennung'],
  ],
  'frontend/js/lagekarte.js': (s) => [
    [/var VERMERK = '© OpenStreetMap-Mitwirkende'/.test(s) && /fillText\(VERMERK/.test(s), 'Lagekarte (PDF): Vermerk ins Bild gemalt'],
  ],
  /* exportiert, aber ohne Aufrufer - Pruefung D unten */
  'frontend/js/dp-dokument.js': () => [],
};
/* Fundstellen ohne Kundenweg */
const AUSGENOMMEN = (p) => /(^|\/)vendor\//.test(p) || /(^|\/)messe-[^/]*\.js$/.test(p) || /\.pre-/.test(p);

/* ── A · Suche ─────────────────────────────────────────────────────── */
function dateien(dir) {
  const r = [];
  for (const e of readdirSync(join(WURZEL, dir))) {
    const p = dir + '/' + e, st = statSync(join(WURZEL, p));
    if (st.isDirectory()) { if (!/^(node_modules|vendor|patchesold)$/.test(e)) r.push(...dateien(p)); }
    else if (/\.(js|html|mjs)$/.test(e)) r.push(p);
  }
  return r;
}
console.log('A · Suche nach Kartenbildern und Kachelebenen unter frontend/');
const TREFFER = /\/static-map\b|tile\.openstreetmap\.org|L\.tileLayer\((?!\s*\.wms)/;
const funde = dateien('frontend').filter((p) => !AUSGENOMMEN(p)).filter((p) => TREFFER.test(ohneKommentar(lies(p))));
for (const p of funde) ok(p in STELLEN, p + ' ist als Kartenstelle mit Vermerk gefuehrt');
for (const p of Object.keys(STELLEN)) if (!funde.includes(p) && !/(dp-dokument|lagekarte)\.js$/.test(p)) console.log('  hinweis  ' + p + ' ruft keine Karte mehr ab - Eintrag kann weg');

/* ── B · Vermerk je Stelle ────────────────────────────────────────── */
console.log('B · Vermerk in Reichweite');
for (const [p, f] of Object.entries(STELLEN)) for (const [b, t] of f(lies(p))) ok(b, t);

/* ── C · nur OpenStreetMap, nicht der Kartendienst ────────────────── */
console.log('C · Vermerk nennt den Kartendienst nicht');
for (const p of Object.keys(STELLEN)) {
  const c = ohneKommentar(lies(p));
  const zeilen = c.split('\n').filter((z) => VERMERK.test(z));
  ok(zeilen.length > 0 || p === 'frontend/js/dp-dokument.js', p + ': ' + zeilen.length + ' Zeile(n) mit Vermerk');
  ok(!zeilen.some((z) => /geoapify/i.test(z)), p + ': keine Vermerkzeile nennt den Kartendienst');
}

/* ── D · DpDokument.karte ohne Aufrufer ───────────────────────────── */
console.log('D · DpDokument.karte (static-map ohne Vermerk) wird nirgends gerufen');
const rufer = dateien('frontend').filter((p) => !AUSGENOMMEN(p) && p !== 'frontend/js/dp-dokument.js')
  .filter((p) => /DpDokument\.karte\s*\(|\bD\.karte\s*\(/.test(ohneKommentar(lies(p))));
ok(rufer.length === 0, 'kein Aufrufer' + (rufer.length ? ': ' + rufer.join(', ') : '') + ' - wer ihn ruft, malt den Vermerk dazu');

/* ── G · Gegenprobe gegen den Stand vor v3338 ─────────────────────── */
console.log('G · Gegenprobe (Stand ' + VOR + ', vor v3338)');
let rotAlt = 0, gelesen = 0;
for (const p of ['frontend/js/marktbericht-profi.js', 'frontend/marktbericht-app/app.js', 'frontend/marktbericht-app/angebot.html']) {
  const alt = liesAlt(p);
  if (alt == null) continue;
  gelesen++;
  rotAlt += STELLEN[p](alt).filter(([b]) => !b).length;
}
if (gelesen) ok(rotAlt >= 8, 'die alte Fassung faellt durch: ' + rotAlt + ' ROT');
else console.log('  hinweis  Commit ' + VOR + ' nicht lesbar - Gegenprobe uebersprungen');

console.log('\n' + n + ' Punkte, ' + fehler + ' ROT');
process.exit(fehler ? 1 : 0);
