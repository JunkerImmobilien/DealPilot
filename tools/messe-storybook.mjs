#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   messe-storybook.mjs · v2941 — das Messe-Storybook als PDF

   Marcel 23.10.2026: „ich brauche dann auch eine Datei für die Messe mit
   Storytelling, also jedes Objekt, wo ich etwas dran erklären kann. Das
   bitte gut formatiert als PDF mit Logo."

   Die ZAHLEN kommen nie von Hand: Kennzahlen der Demo-Objekte aus dem Konto
   info@junker-immobilien.io auf Staging (nur SELECT), App- und Amtsdaten aus
   frontend/messe-schleife/app-zahlen.js und register-stand.js. Von Hand steht
   hier nur die GESCHICHTE je Objekt (Was zeigst du, welcher Satz trägt).

   Aufruf:  node tools/messe-storybook.mjs
   Ausgabe: Dateien/Messe/DealPilot Messe-Storybook.pdf (+ .html daneben)
   Nach jeder Änderung an den Demo-Objekten neu laufen lassen.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const ZIEL = path.join(WURZEL, 'Dateien', 'Messe');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

/* ── Die Geschichten (von Hand) ─────────────────────────────────────── */
const STORYS = [
  { seq: '2026-1041', titel: 'Der Investment Case für die Bank', thema: 'Bank-PDF · Pilot-Analyse · DealScore',
    geschichte: 'Ein solides Mehrfamilienhaus in Bielefeld, sechs Einheiten, Baujahr 1967. An diesem Objekt siehst du den ganzen Weg: vom Objekt über die Pilot-Analyse bis zum PDF, das du der Bank auf den Tisch legst.',
    zeigen: ['Reiter Kennzahlen: Score-Ring und die fünf Kategorien', 'Reiter Pilot-Analyse: Urteil, Stärken, Risiken, Verhandlungsempfehlung', 'Deal-Aktion › PDF › Bankfassung oder Kurzfassung wählen', 'im PDF: Finanzierung, Belastungsprobe, Annahmen'],
    satz: 'Was du sonst einen Abend lang in Excel zusammenbaust, liegt hier mit einem Klick als Investment Case vor – jedes Mal mit den aktuellen Zahlen.' },
  { seq: '2026-1056', titel: 'Vom Ankauf zum Zielbild', thema: 'Bestand · Soll/Ist · Zielbild · Modernisierungspunkte',
    geschichte: 'Altbau von 1905 mit fünf Wohnungen, Ende 2024 unsaniert gekauft. 2025 flossen 137.000 € in Bäder, Leitungen, Heizung und Innenausbau – DealPilot zählt das als Modernisierung nach Anlage 2 ImmoWertV: die Restnutzungsdauer steigt von 12 auf 32 Jahre, der Ertragswert liegt heute über dem Kaufpreis. Die Sanierung aus dem Ankauf ist erledigt und wird nicht mehr als Stau abgezogen. Die spannende Frage kommt danach: Lohnt sich die nächste Runde? Das Zielbild plant weitere Maßnahmen – und DealPilot zeigt ehrlich, dass sie mehr kosten, als sie an Ertragswert bringen.',
    zeigen: ['Objektkarte: Kaufpreis, Score, Cashflow', 'Reiter Objekt: acht Modernisierungsfelder, Quelle „aus den acht Feldern“', 'Bewertung › Wert & Zielbild: Ankauf · Bestand · Zielbild nebeneinander', 'Restnutzungsdauer und Ertragswert je Stufe – mit Rechenweg', 'Wertzuwachs nach Kosten: hier negativ – die Antwort, bevor das Geld weg ist'],
    satz: 'DealPilot sagt dir nicht nur, was die Sanierung gebracht hat – sondern auch, wann die nächste Maßnahme sich nicht mehr rechnet.', zielbild: true },
  { seq: '2026-1052', titel: 'So sieht ein gutes Geschäft aus', thema: 'DealScore · Lageklasse A',
    geschichte: 'Zwölf Wohnungen in Leipzig, Lageklasse A, sauber finanziert. Das Gegenstück zum Lindenhof: Score „Gut“, DSCR über 1,3, positiver Cashflow vor und nach Steuern.',
    zeigen: ['Objektkarte: Score und Pille', 'Reiter Kennzahlen: woraus sich der Score zusammensetzt', 'Portfolio-Cockpit: das Objekt im Vergleich zu den anderen'],
    satz: 'Ein Blick auf den Score sagt dir, wo du genauer hinschauen solltest – und wo nicht.' },
  { seq: '2026-1051', titel: 'Wann DealPilot „Nein“ sagt', thema: 'Risiko · DSCR · Belastungsprobe',
    geschichte: '24 Wohnungen in Castrop-Rauxel, fast 2,5 Mio. € Kaufpreis – auf dem Papier groß, in Wahrheit ein Verlustgeschäft. Die Mieten decken den Kapitaldienst nicht, der Cashflow ist tief negativ. Genau hier soll ein Werkzeug bremsen.',
    zeigen: ['Score „Schwach“ und die rote DSCR-Ampel', 'Pilot-Analyse: Risiken und die Empfehlung', 'Belastungsprobe: was passiert, wenn der Zins steigt'],
    satz: 'Das teuerste Objekt ist das, das du nicht hättest kaufen sollen. DealPilot sagt dir das vorher.' },
  { seq: '2026-1054', titel: 'Wertermittlung wie ein Gutachter', thema: 'Stufe 3 · Ertrags- und Sachwert · amtliche Daten',
    geschichte: 'Jugendstilhaus in Detmold, Baujahr 1908, sechs Wohnungen. Ein Fall für die Wertermittlung: Bodenrichtwert aus BORIS, Liegenschaftszins des Gutachterausschusses, Sachwert nach NHK 2010 – mit Rechenweg und Quellen. Und ein schöner Gesprächsanlass: Der Ertragswert liegt über dem Kaufpreis, die Marktpreisindikation aus Angeboten darunter. Warum? Weil Angebote den Markt von heute zeigen, der Ertragswert die Miete dieses Hauses – und genau dafür gibt es drei Verfahren nebeneinander.',
    zeigen: ['Reiter Bewertung: Stufe 3 erzeugen', 'Rechenweg Ertragswert: Rohertrag, Bewirtschaftung, Liegenschaftszins', 'Sachwert: NHK 2010, Baupreisindex, Alterswertminderung', 'Quellennachweis: welcher Gutachterausschuss, welches Jahr'],
    satz: 'Jede Zahl mit Herkunft: welcher Ausschuss, welches Jahr, welche Seite. Keine Schätzung ohne Quelle.' },
  { seq: '2026-1053', titel: 'Steuer, AfA und Zeiträume', thema: 'Steuer · AfA · zvE je Jahr',
    geschichte: 'Acht Wohnungen in Bielefeld. Hier zeigt sich, was die Steuer aus einem Objekt macht: der Cashflow nach Steuern liegt über dem vor Steuern – die Abschreibung arbeitet für dich.',
    zeigen: ['Reiter Steuer: zvE, Splitting, Kirchensteuer', 'Steuerverlauf: wann der Wendepunkt kommt', 'AfA: Gebäudeanteil und Restnutzungsdauer'],
    satz: 'Du siehst Jahr für Jahr, was das Objekt dich nach Steuern kostet oder bringt – nicht erst mit dem Bescheid.' },
  { seq: '2026-1036', titel: 'Die Cashflow-Maschine', thema: 'Rendite · Cashflow',
    geschichte: 'Zwei Häuser in Rinteln, sechs Einheiten, Baujahr 1972. Hohe Bruttorendite, starker DSCR, fünfstelliger Cashflow im Jahr – das Objekt, das Investoren gern sehen.',
    zeigen: ['Reiter Investition und Finanzierung: Eigenkapital, Darlehen, Rate', 'Kennzahlen: Brutto- und Nettorendite, DSCR', 'Cashflow je Phase: heute, Ende Zinsbindung, Anschluss'],
    satz: 'In zwei Minuten weißt du, ob ein Haus sich selbst trägt – und wie lange.' },
  { seq: '2026-1055', titel: 'Wohnen und Gewerbe unter einem Dach', thema: 'Gemischte Nutzung · Gewerbe',
    geschichte: 'Wohn- und Geschäftshaus in Ibbenbüren mit sechs Einheiten. Gewerbe rechnet anders: eigene Bewirtschaftungskosten, eigene Liegenschaftszinsen, eigene Risiken.',
    zeigen: ['Einheitenliste: Wohnen und Gewerbe getrennt', 'Bewertung: Gewerbeanteil im Ertragswert', 'Steuer: Cashflow nach Steuern deutlich über dem vor Steuern'],
    satz: 'Auch gemischt genutzte Häuser rechnet DealPilot je Einheit – Wohnen und Gewerbe nach ihren eigenen Regeln.' },
  { seq: '2026-001', titel: 'Der Marktbericht', thema: 'Marktbericht · Bodenwert · Lage',
    geschichte: 'Eigentumswohnung in Hüllhorst, 100 m², Baujahr 1962, mit Hinterland und 50 % Miteigentumsanteil. Am Marktbericht siehst du Lage, Bodenwert und Werte – jeweils mit amtlicher Quelle.',
    zeigen: ['Reiter Objekt: Lageklasse und Karte', 'Marktbericht: Bodenwert inklusive Hinterland und Miteigentumsanteil', 'Ertrags- und Sachwert mit Rechenweg'],
    satz: 'Der Marktbericht rechnet mit den Zahlen des Gutachterausschusses – nicht mit Durchschnittswerten aus dem Internet.' },
  { seq: '2026-1040', titel: 'Restnutzungsdauer: das echte Gutachten', thema: 'RND · Anlage 2 · Gutachten-Abgleich',
    geschichte: 'Wohnung in Kabelsketal, Baujahr 1994. Dazu gibt es ein unterschriebenes RND-Gutachten. DealPilot rechnet dieselben Verfahren nach – und erkennt, wann die Formel der Anlage 2 noch gar nicht greift.',
    zeigen: ['Reiter Steuer › RND-Rechner: linear, Anlage 2, technisch', 'Schwelle der Anlage 2: unterhalb gilt GND minus Alter', 'Ergebnis neben dem Gutachten'],
    satz: 'Ein RND-Gutachten senkt deine Steuer über Jahre. DealPilot zeigt dir vorher, ob es sich lohnt.' },
  { seq: '2026-1042', titel: 'Kürzere RND, mehr Abschreibung', thema: 'RND-Gutachten · AfA',
    geschichte: 'Dachgeschosswohnung in Bielefeld, Baujahr 1976, mit Gutachten zur Restnutzungsdauer. Kürzere Restnutzungsdauer heißt höhere AfA – das wirkt jedes Jahr auf den Cashflow nach Steuern.',
    zeigen: ['RND-Rechner mit Modernisierungspunkten', 'AfA-Satz aus der Restnutzungsdauer', 'Wirkung im Steuerverlauf'],
    satz: 'Die richtige Restnutzungsdauer ist bares Geld – jedes Jahr.' },
  { seq: '2026-1006', titel: 'Gutachten gegen App', thema: 'Sachwert · Verkehrswert',
    geschichte: 'Zweifamilienhaus in Hiddenhausen, Baujahr 1964. Für dieses Haus gibt es ein Verkehrswertgutachten über rund 350.000 € – genau der Kaufpreis. Ein schöner Prüfstein: Wie nah kommt die App an den Sachverständigen?',
    zeigen: ['Bewertung: Sachwertverfahren mit BGF und NHK 2010', 'Bodenwert aus dem Bodenrichtwert', 'Vergleich mit dem Gutachtenwert'],
    satz: 'Wir haben DealPilot an echten Gutachten geprüft – Zahl für Zahl.' },
  { seq: '2026-1002', titel: 'Privat oder GmbH?', thema: 'Halter · Steuerwirkung', paar: '2026-1007',
    geschichte: 'Dieselbe Wohnung in Kabelsketal, zweimal im Konto: vor der Überführung privat gehalten, seit 01.01.2026 in der vermögensverwaltenden GmbH. Im Portfolio zählt nur noch die GmbH-Fassung – die private ist als abgegeben markiert, damit nichts doppelt zählt. Gleiches Objekt, andere Steuer: privat greift die Einkommensteuer mit Progression, in der GmbH die Körperschaftsteuer, ohne Erstattung bei Verlust.',
    zeigen: ['Reiter Objekt: Halter wählen', 'Cashflow nach Steuern privat und in der GmbH vergleichen', 'Portfolio-Cockpit: Objekte je Halter'],
    satz: 'Ob privat oder in der GmbH: DealPilot rechnet beides – du siehst den Unterschied, bevor du dich festlegst.' },
  { seq: '2026-1008', titel: 'Die Wohnung in der GmbH', thema: 'Kapitalgesellschaft · Steuer',
    geschichte: 'Eigentumswohnung in Bad Oeynhausen, gehalten von der GmbH. Hier zeigt sich die Steuer der Gesellschaft: Körperschaft- und Gewerbesteuer statt Einkommensteuer.',
    zeigen: ['Halter: GmbH', 'Steuer: Körperschaftsteuer und Gewerbesteuer', 'Cashflow nach Steuern'],
    satz: 'Auch für vermögensverwaltende GmbHs: dieselben Kennzahlen, die richtige Steuer.' },
  { seq: '2026-004', titel: 'Erst rechnen, dann boarden', thema: 'Schwache Finanzierung · Verhandlung',
    geschichte: 'Altbauwohnung von 1928 in Minden, voll finanziert. Gekauft knapp unter der Marktpreisindikation – und trotzdem ein Lehrstück: Die Miete liegt mit 10 €/m² über dem, was der Gutachterausschuss als marktüblich ausweist. Der Ertragswert rechnet deshalb mit der Marktmiete und liegt weit unter dem Kaufpreis; dazu trägt die Miete die Rate nicht (DSCR unter 1). Kein Grund zum Abwinken – aber ein Grund zum Verhandeln.',
    zeigen: ['Kennzahlen: DSCR unter 1 und LTV 100 %', 'Pilot-Analyse: vorgeschlagene Kaufpreis-Offerte', 'Finanzierung: was sich mit mehr Eigenkapital ändert'],
    satz: 'DealPilot sagt dir nicht nur, ob ein Deal schlecht ist – sondern zu welchem Preis er gut wird.' },
  { seq: '2026-999', titel: 'Das Standard-Beispiel', thema: 'Quick-Check · Einstieg',
    geschichte: 'Eine typische Eigentumswohnung in Leipzig, Baujahr 1998. Ideal für den schnellen Einstieg am Stand: vom Exposé zum ersten Urteil in wenigen Minuten.',
    zeigen: ['Quick-Check: Exposé-Link oder Adresse', 'Ergebnis übernehmen › Objekt', 'Score und Kennzahlen'],
    satz: 'Exposé rein, Urteil raus – in unter fünf Minuten.' }
];

/* ── Daten holen (Staging, nur lesend) ───────────────────────────────── */
const seqs = STORYS.flatMap((s) => [s.seq].concat(s.paar ? [s.paar] : []));
const sql = "select o.seq_no, o.name, o.data->>'objart', o.data->>'baujahr', o.data->>'wfl', o.data->>'einheiten', round(o.kaufpreis), o.data->>'ek', o.data->>'d1', coalesce(o.data->>'d2',''), (o.data->>'_kpis_bmy'), (o.data->>'_kpis_nmy'), (o.data->>'_kpis_dscr'), (o.data->>'_kpis_ltv'), (o.data->>'_kpis_cf_vs'), (o.data->>'_kpis_cf_ns'), o.data->>'_ds2_score', o.data->>'_deal_won', o.data->>'halter', o.data->>'nkm', o.data->>'lageklasse', o.data->>'ort', o.id, coalesce((o.data->'_potenzial'->'zusammenfassung'->'stufen')::text,''), o.data->>'_deal_lost' from objects o join users u on u.id=o.user_id where u.email='info@junker-immobilien.io' and (o.seq_no in (" + seqs.map((s) => "'" + s + "'").join(',') + ") or o.data->>'_deal_won'='true')";
/* Abfrage ueber stdin: unter Windows deutet cmd.exe das „>" in „->>" sonst als Umleitung */
const roh = execSync('ssh -o ConnectTimeout=10 root@116.203.214.11 "docker exec -i dealpilot-postgres psql -U dealpilot -d dealpilot_db -At -F \'|\'"', { encoding: 'utf8', input: sql + ';\n' });
const O = {};
roh.split('\n').filter(Boolean).forEach((z) => {
  const f = z.split('|');
  const n = (x) => (x === '' || x == null ? null : Number(String(x).replace(/\./g, '').replace(',', '.')));
  const d = (x) => (x === '' || x == null ? null : Number(x));
  O[f[0]] = { seq: f[0], name: f[1], art: f[2], bj: f[3], wfl: f[4], we: f[5], kp: d(f[6]), ek: n(f[7]), d1: n(f[8]), d2: n(f[9]) || 0,
    bmy: d(f[10]), nmy: d(f[11]), dscr: d(f[12]), ltv: d(f[13]), cfvs: d(f[14]), cfns: d(f[15]), score: d(f[16]), won: f[17] === 'true',
    halter: f[18], nkm: n(f[19]), lage: f[20], ort: f[21], id: f[22], stufen: f[23] ? JSON.parse(f[23]) : null, lost: f[24] === 'true' };
});
/* v2954 · Wert heute je Objekt: der letzte Marktbericht (Marktbericht-DB, nur lesend) */
const HEUTE = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const ids = Object.values(O).map((o) => "'dp:" + o.id + "'");
const mbRoh = execSync('ssh -o ConnectTimeout=10 root@116.203.214.11 "docker exec -i dealpilot-mb-db psql -U mb marktbericht -At -F \'|\'"', { encoding: 'utf8',
  input: "select distinct on (object_key) object_key, market_value, data->'cross_check'->'ertragswert'->>'value_eur', created_at::date as tag from mb.object_snapshots where object_key in (" + ids.join(',') + ") and market_value is not null order by object_key, created_at desc;\n" });
mbRoh.split('\n').filter(Boolean).forEach((z) => {
  const f = z.split('|'); const o = Object.values(O).find((x) => 'dp:' + x.id === f[0]); if (!o) return;
  o.mpi = f[1] ? Number(f[1]) : null; o.ew = f[2] ? Number(f[2]) : null; o.mbDatum = f[3];
});
/* Bestand = gewonnen und nicht abgegeben - dieselbe Menge wie das Portfolio-Cockpit */
const BESTAND = Object.values(O).filter((o) => o.won && !o.lost).sort((a, b) => (b.kp || 0) - (a.kp || 0));
global.window = {};
eval(fs.readFileSync(path.join(WURZEL, 'frontend/messe-schleife/app-zahlen.js'), 'utf8'));
eval(fs.readFileSync(path.join(WURZEL, 'frontend/messe-schleife/register-stand.js'), 'utf8'));
const A = window.DPS_APP, R = window.DPS_REGISTER && window.DPS_REGISTER.kopf, M = A.amtlich || {};

/* ── Format ───────────────────────────────────────────────────────────── */
const de = (x, s = 0) => (x == null || !isFinite(x) ? '–' : Number(x).toLocaleString('de-DE', { minimumFractionDigits: s, maximumFractionDigits: s }));
const eur = (x) => (x == null ? '–' : de(Math.round(x)) + ' €');
const pct = (x, s = 2) => (x == null ? '–' : de(x, s) + ' %');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stufe = (s) => (s == null ? '–' : s >= 85 ? 'Sehr gut' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : s >= 35 ? 'Schwach' : 'Kritisch');
const farbe = (s) => (s == null ? '#9a9184' : s >= 70 ? '#3FA56C' : s >= 50 ? '#C9A84C' : '#B8625C');
const artWort = { ETW: 'Eigentumswohnung', MFH: 'Mehrfamilienhaus', ZFH: 'Zweifamilienhaus', EFH: 'Einfamilienhaus', GESCH: 'Wohn- und Geschäftshaus' };
const halterWort = (h) => (!h || h === 'privat' ? 'privat' : 'GmbH');
const datum = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; };
const logo = 'file:///' + path.join(WURZEL, 'design/logo/dealpilot-logo-rahmen-transparent.png').replace(/\\/g, '/');
const fonts = 'file:///' + path.join(WURZEL, 'frontend/fonts/dp-fonts.css').replace(/\\/g, '/');

function chips(o) {
  const gi = (o.ek || 0) + (o.d1 || 0) + (o.d2 || 0);
  const z = [['Kaufpreis', eur(o.kp)], ['Gesamtinvestition', eur(gi)], ['Eigenkapital', eur(o.ek)], ['Darlehen', eur((o.d1 || 0) + (o.d2 || 0))],
    ['Bruttorendite', pct(o.bmy)], ['Nettorendite', pct(o.nmy)], ['DSCR', de(o.dscr, 2)], ['LTV', pct(o.ltv, 1)],
    ['Cashflow v. St. / Jahr', eur(o.cfvs)], ['Cashflow n. St. / Jahr', eur(o.cfns)]];
  return '<div class="chips">' + z.map((c) => '<div><span>' + c[0] + '</span><b>' + c[1] + '</b></div>').join('') + '</div>';
}
/* v2954 · Wert heute: Kaufpreis gegen Marktpreisindikation und Ertragswert des letzten Berichts */
const abst = (w, kp) => (w != null && kp ? ((w / kp - 1) * 100) : null);
const vz = (p) => (p == null ? '' : (p >= 0 ? '+' : '−') + de(Math.abs(p), 1) + ' %');
function wertZeile(o) {
  if (o.mpi == null && o.ew == null) return '';
  return '<div class="wert"><div><span>Marktpreisindikation</span><b>' + eur(o.mpi) + '</b><i class="' + (abst(o.mpi, o.kp) >= 0 ? 'pos' : 'neg') + '">' + vz(abst(o.mpi, o.kp)) + '</i></div>'
    + '<div><span>Ertragswert</span><b>' + eur(o.ew) + '</b><i class="' + (abst(o.ew, o.kp) >= 0 ? 'pos' : 'neg') + '">' + vz(abst(o.ew, o.kp)) + '</i></div>'
    + '<div><span>Marktbericht vom</span><b>' + datum(o.mbDatum) + '</b><i>letzter Bericht</i></div></div>';
}
function kopf(o) {
  return '<div class="ok"><div class="ok-l"><div class="ok-seq">' + esc(o.seq) + (o.won ? ' · im Bestand' : ' · in Prüfung') + ' · ' + halterWort(o.halter) + '</div>'
    + '<div class="ok-name">' + esc(o.name) + '</div>'
    + '<div class="ok-meta">' + esc(artWort[o.art] || o.art || '') + (o.bj ? ' · Baujahr ' + esc(o.bj) : '') + (o.wfl ? ' · ' + esc(o.wfl) + ' m²' : '') + (o.we && o.we !== '1' ? ' · ' + esc(o.we) + ' Einheiten' : '') + (o.lage ? ' · Lageklasse ' + esc(o.lage) : '') + '</div></div>'
    + '<div class="ok-score" style="--f:' + farbe(o.score) + '"><b>' + de(o.score) + '</b><span>' + stufe(o.score) + '</span></div></div>';
}
function seite(s) {
  const o = O[s.seq]; if (!o) return '';
  let h = '<section class="seite obj' + (s.zielbild ? ' dicht' : '') + '">' + kopf(o) + '<div class="thema">' + esc(s.thema) + '</div><h2>' + esc(s.titel) + '</h2>'
    + '<p class="gesch">' + esc(s.geschichte) + '</p>' + chips(o);
  if (s.paar && O[s.paar]) {
    const p = O[s.paar];
    h += '<div class="vgl"><div class="vgl-k">Im Vergleich: ' + esc(p.seq) + ' · ' + halterWort(p.halter) + '</div><table><tr><th></th><th>' + halterWort(o.halter) + '</th><th>' + halterWort(p.halter) + '</th></tr>'
      + [['Cashflow v. St. / Jahr', eur(o.cfvs), eur(p.cfvs)], ['Cashflow n. St. / Jahr', eur(o.cfns), eur(p.cfns)], ['LTV', pct(o.ltv, 1), pct(p.ltv, 1)], ['DealScore', de(o.score), de(p.score)]]
        .map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</table></div>';
  }
  h += wertZeile(o);
  if (s.zielbild && o.stufen && o.stufen.bestand) {
    /* v2954 · aus dem gespeicherten Zielbild-Lauf des Objekts, nicht von Hand */
    const S = o.stufen, Z = S.zielbild || S.mieterhoehung, B = S.bestand;
    const zuw = Z && Z.ertragswert != null && B.ertragswert != null ? Z.ertragswert - B.ertragswert - (Z.kosten || 0) : null;
    const zelle = (x, extra) => x ? eur(x.ertragswert) + ' · RND ' + de(x.rnd, 1) + ' J.<br><small>Kaltmiete ' + eur(x.kaltmiete_jahr) + ' im Jahr' + (extra || '') + '</small>' : '–';
    h += '<div class="vgl"><div class="vgl-k">Ertragswert je Stufe (Zielbild-Lauf vom Objekt)</div><table><tr><th>Bestand heute</th><th>Mieterhöhung</th><th>Zielbild</th></tr>'
      + '<tr><td>' + zelle(B) + '</td><td>' + zelle(S.mieterhoehung) + '</td><td><b>' + zelle(S.zielbild, S.zielbild ? ' · Maßnahmen ' + eur(S.zielbild.kosten) : '') + '</b></td></tr></table>'
      + (zuw != null ? '<p class="gesetze">Wertzuwachs nach Kosten: <b>' + (zuw >= 0 ? '+ ' : '− ') + eur(Math.abs(zuw)) + '</b> – ' + (zuw >= 0 ? 'die Maßnahmen bringen mehr Ertragswert, als sie kosten.' : 'die Maßnahmen kosten mehr, als sie an Ertragswert bringen.') + '</p>' : '') + '</div>';
  }
  h += '<div class="zwei"><div class="box"><div class="box-k">So zeigst du es</div><ol>' + s.zeigen.map((z) => '<li>' + esc(z) + '</li>').join('') + '</ol></div>'
    + '<div class="box gold"><div class="box-k">Der Satz für den Besucher</div><p>„' + esc(s.satz) + '“</p></div></div>';
  if (!s.zielbild) h += '<div class="notiz"><div class="box-k">Notizen am Stand</div>' + '<i></i>'.repeat(s.paar ? 3 : 6) + '</div>';   /* Zielbild-Seite ist voll */
  return h + '<div class="fuss">DealPilot · Messe-Storybook · Demo-Konto info@junker-immobilien.io · Zahlen vom ' + HEUTE + '</div></section>';
}

const ubersicht = '<section class="seite"><div class="kick">Die Demo-Objekte auf einen Blick</div><h1>Welches Objekt für welche Frage?</h1><table class="ueb"><tr><th>Objekt</th><th>Score</th><th>Thema</th><th>Geschichte</th></tr>'
  + STORYS.map((s) => { const o = O[s.seq] || {}; return '<tr><td><b>' + esc((o.name || s.seq).replace(/ (Bad Oeynhausen|Bielefeld|Leipzig|Detmold|Rinteln|Ibbenbüren|Hüllhorst|Kabelsketal|Hiddenhausen|Castrop-Rauxel|Musterhausen|Minden)$/, '')) + '</b><br><small>' + esc(o.ort || '') + ' · ' + esc(s.seq) + '</small></td><td><span class="pille" style="--f:' + farbe(o.score) + '">' + de(o.score) + ' ' + stufe(o.score) + '</span></td><td>' + esc(s.thema) + '</td><td>' + esc(s.titel) + '</td></tr>'; }).join('')
  + '</table><div class="fuss">DealPilot · Messe-Storybook</div></section>';

/* ── v2954 · Der Rundgang am Stand: eine Geschichte in fünf Akten ───── */
const NAME = (seq) => (O[seq] ? O[seq].name : seq);
const rundgang = '<section class="seite dicht"><div class="kick">Am Stand · fünf Minuten, eine Geschichte</div><h1>Der Rundgang: vom ersten Blick bis zum ganzen Bestand</h1>'
  + '<p class="gesch">Erzähl keine Funktionen, erzähl den Weg eines Investors. Jeder Akt hat ein Objekt und eine Frage, die der Besucher selbst kennt. Wer nur eine Minute hat, bekommt Akt 1 und Akt 5. Wer bleibt, bekommt alles.</p>'
  + '<table class="ueb akte"><tr><th>Akt</th><th>Die Frage des Besuchers</th><th>Objekt</th><th>Was du zeigst</th></tr>'
  + [['1 · Finden', '„Ist das Angebot überhaupt was?“', NAME('2026-999'), 'Quick-Check: Adresse und Preis rein, in Sekunden Score und Marktpreisindikation mit Spanne. Dann „übernehmen“ – das Objekt ist angelegt.'],
     ['2 · Prüfen', '„Würde die Bank das finanzieren?“', NAME('2026-1041'), 'Pilot-Analyse mit Urteil, Stärken, Risiken – dann das Bank-PDF. Als Gegenstück ' + NAME('2026-1051') + ': hier sagt DealPilot „Nein“.'],
     ['3 · Bewerten', '„Was ist das Haus wirklich wert?“', NAME('2026-1054'), 'Stufe 3: Ertrags-, Sach- und Vergleichswert nebeneinander, jeder mit Gutachterausschuss, Jahr und Seite. Warum die Verfahren auseinanderliegen.'],
     ['4 · Halten', '„Hat sich die Sanierung gelohnt – und die nächste?“', NAME('2026-1056'), 'Modernisierung nach Anlage 2 verlängert die Restnutzungsdauer. Zielbild: Wertzuwachs nach Kosten – hier ehrlich negativ.'],
     ['5 · Überblick', '„Was ist mein ganzer Bestand wert?“', 'Portfolio-Cockpit', 'Gesamtbewertung in drei Spalten, Bewertung je Objekt, Zeitraum 10/20/30 Jahre, Portfolio-Pilot mit Zahlenprüfung. Zum Schluss: Bankexport im Telegram-Bot.']]
    .map((r) => '<tr><td><b>' + r[0] + '</b></td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + '</td></tr>').join('') + '</table>'
  + '<div class="zwei" style="margin-top:5mm"><div class="box"><div class="box-k">Übergänge, die tragen</div><ol>'
  + '<li>Von 1 nach 2: „Der Score sagt dir, ob es sich lohnt, genauer hinzusehen. Jetzt sehen wir genauer hin.“</li>'
  + '<li>Von 2 nach 3: „Die Bank fragt als Nächstes: Was ist das Haus wert?“</li>'
  + '<li>Von 3 nach 4: „Gekauft ist es. Jetzt beginnt die eigentliche Arbeit.“</li>'
  + '<li>Von 4 nach 5: „Und jetzt alle Objekte auf einmal.“</li></ol></div>'
  + '<div class="box"><div class="box-k">Wenn Fragen kommen</div><ol>'
  + '<li><b>Ist das ein Gutachten?</b> Nein – eine Indikation nach ImmoWertV-Logik, kein Verkehrswert nach § 194 BauGB. Aber jede Zahl trägt ihre amtliche Herkunft.</li>'
  + '<li><b>Woher kommen die Daten?</b> Von den Gutachterausschüssen, aus BORIS und amtlichen Statistiken – dazu der aktuelle Marktdurchschnitt aus Angeboten.</li>'
  + '<li><b>Rechnet die KI?</b> Nein. Gerechnet wird mit festen Formeln, die KI erklärt nur – und jede ihrer Zahlen wird gegengeprüft.</li></ol></div></div>'
  + '<div class="box gold"><div class="box-k">Der Schlusssatz</div><p>„Vom ersten Exposé bis zum ganzen Bestand – ein Werkzeug, eine Logik, amtliche Zahlen.“</p></div>'
  + '<div class="fuss">DealPilot · Messe-Storybook</div></section>';

/* ── v2954 · Das Portfolio-Cockpit: Zahlen aus den Objekten und ihren letzten Berichten ── */
const sum = (L, f) => L.reduce((t, o) => t + (o[f] || 0), 0);
const mitEw = BESTAND.filter((o) => o.ew != null), mitMpi = BESTAND.filter((o) => o.mpi != null);
const kpS = sum(BESTAND, 'kp'), ewS = sum(mitEw, 'ew'), kpEwS = sum(mitEw, 'kp'), mpiS = sum(mitMpi, 'mpi'), kpMpiS = sum(mitMpi, 'kp');
const ekS = sum(BESTAND, 'ek'), cfS = sum(BESTAND, 'cfns');
const besser = BESTAND.filter((o) => o.ew != null && o.ew >= o.kp), teurer = BESTAND.filter((o) => o.ew != null && o.ew < o.kp);
const cockpit = '<section class="seite dicht"><div class="kick">Bestand · Portfolio-Cockpit</div><h1>Was ist mein ganzer Bestand wert?</h1>'
  + '<p class="gesch">' + BESTAND.length + ' Objekte im Bestand, zusammen ' + eur(kpS) + ' Kaufpreis. Die erste Frage jedes Bestandshalters ist: Habe ich gut gekauft? Das Cockpit beantwortet sie in drei Schritten – was investiert wurde, was in der Bilanz steht und was die Objekte nach Bewertung wert sind. '
  + 'Hier liegt der Ertragswert ' + vz(abst(ewS, kpEwS)) + ' neben den Kaufpreisen: ' + besser.length + ' Objekte wurden günstiger gekauft, als sie heute aus ihren Mieten wert sind, ' + teurer.length + ' teurer. '
  + 'Fehlt einem Objekt ein Wert, steht es rot in der Liste – mit dem Grund und dem Sprung ins Objekt.</p>'
  + '<div class="raster">' + [[eur(kpS), 'Kaufpreise · ' + BESTAND.length + ' Objekte'], [eur(mpiS), 'Marktpreisindikation · ' + vz(abst(mpiS, kpMpiS))], [eur(ewS), 'Ertragswert · ' + vz(abst(ewS, kpEwS))], [eur(ekS), 'Eigenkapital eingesetzt'],
    [eur(cfS), 'Cashflow nach Steuer im Jahr'], [mitEw.length + ' von ' + BESTAND.length, 'Objekte mit Ertragswert'], [besser.length + ' · ' + teurer.length, 'günstiger · teurer gekauft als der Ertragswert'], ['10 · 20 · 30', 'Jahre Projektion, alles zieht mit']]
    .map((x) => '<div><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></div>').join('') + '</div>'
  + '<div class="vgl" style="margin-top:5mm"><div class="vgl-k">Bewertung je Objekt (wie im Cockpit)</div><table><tr><th>Objekt</th><th>Kaufpreis</th><th>Marktpreisindikation</th><th>Ertragswert</th><th>Score</th></tr>'
  + BESTAND.map((o) => '<tr><td>' + esc(o.name) + '</td><td>' + eur(o.kp) + '</td><td>' + eur(o.mpi) + ' <small>' + vz(abst(o.mpi, o.kp)) + '</small></td><td>' + eur(o.ew) + ' <small>' + vz(abst(o.ew, o.kp)) + '</small></td><td>' + de(o.score) + '</td></tr>').join('') + '</table></div>'
  + '<div class="zwei"><div class="box"><div class="box-k">So zeigst du es</div><ol><li>Portfolio-Cockpit öffnen, oben Einfach | Genau</li><li>Gesamtbewertung: investiert · Bilanz · nach Bewertung</li><li>„Bewertung je Objekt“ aufklappen – grün und rot je Objekt</li><li>Projektion auf 10, 20, 30 Jahre stellen – Bilanz-Charts und Kachel ziehen mit</li><li>Portfolio-Pilot: „Bestand & Zielbild erklären“, unten die Zahlenprüfung</li></ol></div>'
  + '<div class="box gold"><div class="box-k">Der Satz für den Besucher</div><p>„Du siehst auf einen Blick, welche Objekte gut gekauft waren – und welche nicht. Jede Zahl mit Herkunft, nichts geschätzt.“</p></div></div>'
  + '<div class="fuss">DealPilot · Messe-Storybook · Demo-Konto info@junker-immobilien.io · Werte aus den letzten Marktberichten der Objekte</div></section>';

/* ── v2954 · Bestand & Zielbild über das Portfolio (gespeicherte Zielbild-Läufe) ── */
const ZB = BESTAND.filter((o) => o.stufen && o.stufen.bestand && (o.stufen.mieterhoehung || o.stufen.zielbild)).map((o) => {
  const S = o.stufen, T = S.zielbild || S.mieterhoehung, B = S.bestand;
  return { name: o.name, mB: B.kaltmiete_jahr || 0, mZ: T.kaltmiete_jahr || 0, k: T.kosten || 0, eB: B.ertragswert, eZ: T.ertragswert,
    zuw: T.ertragswert != null && B.ertragswert != null ? T.ertragswert - B.ertragswert - (T.kosten || 0) : null, ziel: !!S.zielbild };
});
const zbSum = (f) => ZB.reduce((t, x) => t + (x[f] || 0), 0);
const zbZuw = zbSum('zuw'), zbPos = ZB.filter((x) => x.zuw > 0).sort((a, b) => b.zuw - a.zuw), zbNeg = ZB.filter((x) => x.zuw != null && x.zuw < 0);
const zielbildSeite = '<section class="seite dicht"><div class="kick">Bestand · Mieterhöhung · Zielbild</div><h1>Lohnt sich, was ich vorhabe?</h1>'
  + '<p class="gesch">Für ' + ZB.length + ' von ' + BESTAND.length + ' Objekten ist geplant, was als Nächstes kommt: Mieterhöhung bis zur Vergleichsmiete, Umbau, Neuvermietung. Über alle zusammen steigt die Kaltmiete von ' + eur(zbSum('mB')) + ' auf ' + eur(zbSum('mZ')) + ' im Jahr. '
  + 'Die Maßnahmen dafür kosten ' + eur(zbSum('k')) + '. Und dann die ehrliche Frage, die sonst keiner stellt: Bringen sie mehr Wert, als sie kosten? Über das Portfolio bleibt nach Kosten ' + (zbZuw >= 0 ? 'ein Plus von ' : 'ein Minus von ') + eur(Math.abs(zbZuw)) + '. '
  + (zbPos.length ? 'Den größten Beitrag liefert ' + esc(zbPos[0].name) + '. ' : '') + (zbNeg.length ? 'Bei ' + esc(zbNeg.map((x) => x.name).join(', ')) + ' kosten die Maßnahmen mehr, als sie an Ertragswert bringen – das zu wissen, bevor das Geld ausgegeben ist, ist der eigentliche Wert.' : '') + '</p>'
  + '<div class="vgl"><div class="vgl-k">Je Objekt (gespeicherter Zielbild-Lauf)</div><table><tr><th>Objekt</th><th>Kaltmiete heute → Ziel</th><th>Maßnahmen</th><th>Ertragswert heute → Ziel</th><th>nach Kosten</th></tr>'
  + ZB.map((x) => '<tr><td>' + esc(x.name) + (x.ziel ? '' : ' <small>(nur Mieterhöhung)</small>') + '</td><td>' + eur(x.mB) + ' → ' + eur(x.mZ) + '</td><td>' + eur(x.k) + '</td><td>' + eur(x.eB) + ' → ' + eur(x.eZ) + '</td><td><b>' + (x.zuw == null ? '–' : (x.zuw >= 0 ? '+ ' : '− ') + eur(Math.abs(x.zuw))) + '</b></td></tr>').join('') + '</table></div>'
  + '<div class="zwei"><div class="box"><div class="box-k">So zeigst du es</div><ol><li>Cockpit › Bestand gegen Zielbild: Kacheln und Brücken</li><li>„Je Objekt“: wer trägt, wer kostet</li><li>Im Objekt › Bewertung › Wert & Zielbild: Stufen mit Restnutzungsdauer</li><li>„neu rechnen ↻“ – kostenlos, ohne Kontingent</li></ol></div>'
  + '<div class="box gold"><div class="box-k">Der Satz für den Besucher</div><p>„Mehr Miete ist schön. Aber DealPilot zeigt dir, ob die Sanierung dafür mehr Wert schafft, als sie kostet.“</p></div></div>'
  + '<div class="box"><div class="box-k">Wichtig beim Erklären</div>Die Werte nach Mieterhöhung und im Zielbild sind ein Ausblick, kein Verkehrswert zum heutigen Stichtag. Maßgeblich für heute ist der Ertragswert im Bestand.</div>'
  + '<div class="fuss">DealPilot · Messe-Storybook · Demo-Konto info@junker-immobilien.io</div></section>';

const zahlen = '<section class="seite"><div class="kick">DealPilot in Zahlen · Stand ' + datum(A.stand) + '</div><h1>Was unter der Haube steckt</h1>'
  + '<div class="riesig"><b>' + de(A.zeilen) + '</b><span>Zeilen eigener Code in ' + de(A.dateien) + ' Dateien · ' + de(A.tage) + ' Tage Entwicklung · ' + de(A.versionen) + ' Versionen</span></div>'
  + '<div class="raster">' + [[A.module, 'Module'], [A.funktionen, 'Funktionen'], [A.schnittstellen, 'Schnittstellen'], [A.tabellen, 'Datenbank-Tabellen'], [A.felder, 'Eingabefelder'], [A.paragrafen, 'Paragrafen aus ' + (A.gesetze || []).length + ' Gesetzen'], [A.pruefer, 'Prüfwerkzeuge'], [A.registerzeilen, 'Zeilen amtliche Registerdaten']]
    .map((x) => '<div><b>' + de(x[0]) + '</b><span>' + x[1] + '</span></div>').join('') + '</div>'
  + '<div class="kick" style="margin-top:26px">Amtliche Daten an Bord</div>'
  + '<div class="riesig klein"><b>' + de((M.zensus_werte || 0) + (M.makro_werte || 0) + (M.register_db || 0) + (M.wert_parameter || 0)) + '</b><span>amtliche Datenpunkte</span></div>'
  + '<div class="raster">' + [[M.zensus_werte, 'Zensus-Werte für ' + de(M.zensus_gemeinden) + ' Gemeinden'], [M.makro_werte, 'Makro-Werte für ' + de(M.makro_gebiete) + ' Gebiete'], [R && R.werte_gesamt, 'amtliche Registerwerte'], [R && R.ausschuesse, 'Gutachterausschüsse'],
    [R && R.lzs, 'Liegenschaftszinssätze'], [R && R.swf, 'Sachwertfaktoren'], [M.boris_systeme, 'Bodenrichtwert-Systeme live (' + (M.boris_laender || 0) + ' Länder + BORIS-D)'], [M.mietrecht_gemeinden, 'Gemeinden mit Mietrechts-VO']]
    .map((x) => '<div><b>' + de(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>').join('') + '</div>'
  + '<p class="gesetze"><b>Gesetze an Bord:</b> ' + (A.gesetze || []).map((g) => esc(g.gesetz) + ' ' + g.paragrafen + (g.gesetz === 'DSGVO' ? ' Art.' : (g.paragrafen === 1 ? ' §' : ' §§'))).join(' · ') + '</p>'
  + '<div class="fuss">Alle Zahlen gemessen: Code im Repository, amtliche Daten in der Marktbericht-Datenbank.</div></section>';

const stand = '<section class="seite"><div class="kick">Am Stand</div><h1>Der Pitch in 30 Sekunden</h1>'
  + '<div class="box gold gross"><p>„Du kaufst eine Immobilie für zwanzig, dreißig Jahre – und entscheidest oft nach Bauchgefühl und Excel. DealPilot prüft jedes Objekt wie ein Pilot vor dem Start: Rendite, Finanzierung, Steuer und Wert mit den amtlichen Daten der Gutachterausschüsse. Am Ende steht ein klares Urteil – und ein PDF, das du der Bank geben kannst.“</p></div>'
  + '<div class="zwei"><div class="box"><div class="box-k">Drei Fragen für den Einstieg</div><ol><li>Kaufst du gerade, oder hast du schon Objekte im Bestand?</li><li>Wie prüfst du heute, ob ein Deal gut ist?</li><li>Was will deine Bank von dir sehen?</li></ol></div>'
  + '<div class="box"><div class="box-k">Der Weg durch die App</div><ol><li>Quick-Check: Exposé rein, Urteil raus</li><li>Objekt: Investition, Miete, Finanzierung, Steuer</li><li>Bewertung und Pilot-Analyse</li><li>Bank-PDF und Deal-Aktion</li><li>Bestand: Soll/Ist und Zielbild</li></ol></div></div>'
  + '<div class="box"><div class="box-k">Die Messe-Schleife bedienen</div><table class="tasten"><tr><td><b>E</b></td><td>Menü: Gewinnspiel, Tafeln, Abstände, Startkanal (oder dreimal oben rechts tippen)</td></tr><tr><td><b>G</b></td><td>Gewinnspiel-Tafel an/aus</td></tr><tr><td><b>R / V</b></td><td>Rundgang / Videothek</td></tr><tr><td><b>N</b></td><td>nächstes Video oder nächste Tafel</td></tr><tr><td><b>F</b></td><td>Vollbild</td></tr></table></div>'
  + '<div class="fuss">DealPilot · Messe-Storybook</div></section>';

const deckblatt = '<section class="seite deck"><img class="deck-logo" src="' + logo + '" alt="DealPilot"><div class="deck-titel">Messe-Storybook</div>'
  + '<div class="deck-unter">Die Demo-Objekte und ihre Geschichten · Pitch · Zahlen</div><div class="deck-claim">Immobilien prüfen wie ein <em>Pilot</em>.</div>'
  + '<div class="deck-fuss">Junker Solution · DealPilot · Stand ' + datum(A.stand) + '</div></section>';

const css = `@import url('${fonts}');
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;font:10.5pt/1.5 Inter,system-ui,sans-serif;color:#1f1b14;background:#fff}
.seite{width:210mm;height:297mm;padding:18mm 17mm 16mm;position:relative;page-break-after:always;overflow:hidden;background:#FDFCFA}
.deck{background:#050505;color:#FDFCFA;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:30mm 22mm}
.deck-logo{width:120mm;margin-bottom:22mm}
.deck-titel{font:700 40pt/1 'Space Grotesk',sans-serif;letter-spacing:-.02em}
.deck-unter{margin-top:6mm;font:500 13pt Inter,sans-serif;color:#d9cfb8}
.deck-claim{margin-top:28mm;font:500 italic 20pt 'Cormorant Garamond',serif;color:#E8CC7A}
.deck-claim em{font-style:italic;color:#C9A84C}
.deck-fuss{position:absolute;left:22mm;bottom:16mm;font:600 8.5pt 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#8c8578}
.kick{font:700 8pt 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#b8932f}
h1{font:700 22pt/1.15 'Space Grotesk',sans-serif;margin:2mm 0 6mm;letter-spacing:-.01em}
h2{font:700 17pt/1.2 'Space Grotesk',sans-serif;margin:1mm 0 3mm}
.ok{display:flex;justify-content:space-between;align-items:center;gap:8mm;background:#050505;color:#FDFCFA;margin:-18mm -17mm 7mm;padding:9mm 17mm 8mm;border-bottom:3px solid #C9A84C}
.ok-seq{font:600 7.5pt 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#C9A84C}
.ok-name{font:700 17pt/1.15 'Space Grotesk',sans-serif;margin-top:1.5mm}
.ok-meta{font-size:9pt;color:#d9cfb8;margin-top:1.5mm}
.ok-score{flex:0 0 auto;width:24mm;height:24mm;border-radius:50%;border:2.2mm solid var(--f);display:flex;flex-direction:column;align-items:center;justify-content:center}
.ok-score b{font:700 19pt/1 'Space Grotesk',sans-serif}
.ok-score span{font:600 6.5pt 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.08em;margin-top:1mm}
.thema{font:700 7.5pt 'JetBrains Mono',monospace;letter-spacing:.18em;text-transform:uppercase;color:#b8932f}
.gesch{font-size:11pt;line-height:1.6;margin:0 0 5mm}
.chips{display:grid;grid-template-columns:repeat(5,1fr);gap:2.4mm;margin-bottom:5mm}
.chips div{background:#FBF6E9;border:1px solid #ecdfb9;border-radius:2.5mm;padding:2.4mm 2.6mm}
.chips span{display:block;font:600 6.4pt 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#8a7a50}
.chips b{display:block;font:700 10.5pt 'Space Grotesk',sans-serif;margin-top:.8mm}
.zwei{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:5mm}
.box{border:1px solid #e7e1d4;border-radius:3mm;padding:4mm 5mm;background:#fff;margin-bottom:5mm}
.zwei .box{margin-bottom:0}
.box.gold{background:#050505;color:#FDFCFA;border-color:#C9A84C}
.box.gold p{font:500 italic 13pt/1.45 'Cormorant Garamond',serif;color:#f3ead0;margin:0}
.box.gross p{font-size:15pt}
.box-k{font:700 7.5pt 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#b8932f;margin-bottom:2mm}
.box ol{margin:0;padding-left:5mm}.box li{margin:1mm 0}
.vgl{margin-bottom:5mm}.vgl-k{font:700 7.5pt 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#b8932f;margin-bottom:2mm}
.vgl table,.ueb,.tasten{width:100%;border-collapse:collapse;font-size:9.5pt}
.vgl th,.vgl td,.ueb th,.ueb td{border-bottom:1px solid #e7e1d4;padding:2mm 2.5mm;text-align:left;vertical-align:top}
.vgl th,.ueb th{font:700 7.2pt 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:#8a7a50}
.ueb td small{color:#8c8578}
.ueb{font-size:8.6pt}.ueb th,.ueb td{padding:1.3mm 2mm}
.notiz{position:static;margin-top:5mm;border:1px solid #e7e1d4;border-radius:3mm;padding:3.5mm 5mm 2mm;background:#fff}
.notiz .box-k{margin-bottom:0}
.notiz i{display:block;height:8.5mm;border-bottom:1px solid #eee6d4}
.pille{display:inline-block;padding:.6mm 2.2mm;border-radius:2mm;background:var(--f);color:#fff;font:700 7.5pt 'JetBrains Mono',monospace;white-space:nowrap}
.tasten td{padding:1.4mm 2mm;border-bottom:1px solid #f0ebe0}.tasten td:first-child{width:16mm;font-family:'JetBrains Mono',monospace}
.riesig{margin:2mm 0 5mm}.riesig b{display:block;font:700 46pt/1 'Space Grotesk',sans-serif;color:#b8932f;letter-spacing:-.03em}
.riesig.klein b{font-size:34pt}.riesig span{display:block;margin-top:1.5mm;color:#5d5546}
.raster{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
.raster div{border:1px solid #ecdfb9;background:#FBF6E9;border-radius:3mm;padding:3.5mm}
.raster b{display:block;font:700 15pt 'Space Grotesk',sans-serif}
.raster span{display:block;font-size:8pt;color:#5d5546;margin-top:1mm;line-height:1.3}
.gesetze{margin-top:5mm;font-size:8.6pt;color:#5d5546}
.wert{display:grid;grid-template-columns:repeat(3,1fr);gap:2.4mm;margin:-2mm 0 5mm}
.wert div{border:1px solid #e7e1d4;border-radius:2.5mm;padding:2.2mm 2.6mm;background:#fff}
.wert span{display:block;font:600 6.4pt 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#8a7a50}
.wert b{display:block;font:700 10.5pt 'Space Grotesk',sans-serif;margin-top:.8mm}
.wert i{display:block;font:600 7.5pt 'JetBrains Mono',monospace;font-style:normal;color:#8c8578;margin-top:.5mm}
.wert i.pos{color:#3FA56C}.wert i.neg{color:#B8625C}
.akte td{font-size:8.8pt}.akte td:first-child{white-space:nowrap}
.vgl td small{color:#8c8578}
.dicht h1{font-size:19pt;margin-bottom:4mm}
.dicht .gesch{font-size:9.6pt;line-height:1.5;margin-bottom:4mm}
.dicht .vgl table{font-size:8.6pt}.dicht .vgl th,.dicht .vgl td{padding:1.2mm 2mm}
.dicht .vgl td{white-space:nowrap}.dicht .vgl td:first-child{white-space:normal}
.dicht .raster{gap:2mm}.dicht .raster div{padding:2.4mm 3mm}.dicht .raster b{font-size:12.5pt}
.dicht .zwei{gap:4mm;margin-bottom:4mm}.dicht .box{padding:3mm 4mm;margin-bottom:4mm;font-size:9pt}
.dicht .box li{margin:.6mm 0}.dicht .box.gold p{font-size:11.5pt}
.dicht .ueb td,.dicht .ueb th{padding:1.1mm 1.6mm}
.fuss{position:absolute;left:17mm;right:17mm;bottom:9mm;font:600 6.8pt 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#a89f8e;border-top:1px solid #e7e1d4;padding-top:2.5mm}`;

const html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>DealPilot Messe-Storybook</title><style>' + css + '</style></head><body>'
  + deckblatt + stand + rundgang + ubersicht + cockpit + zielbildSeite + STORYS.map(seite).join('') + zahlen + '</body></html>';
fs.mkdirSync(ZIEL, { recursive: true });
const htmlDatei = path.join(ZIEL, 'DealPilot Messe-Storybook.html');
const pdfDatei = path.join(ZIEL, 'DealPilot Messe-Storybook.pdf');
fs.writeFileSync(htmlDatei, html);
const fehlt = STORYS.filter((s) => !O[s.seq]).map((s) => s.seq);
if (fehlt.length) console.log('FEHLT in der DB: ' + fehlt.join(', '));
if (!CHROME) { console.log('Kein Chrome/Edge gefunden - nur HTML geschrieben: ' + htmlDatei); process.exit(0); }
execSync('"' + CHROME + '" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files --print-to-pdf="' + pdfDatei + '" "file:///' + htmlDatei.replace(/\\/g, '/') + '"', { stdio: 'ignore', timeout: 120000 });
console.log('Objekte ' + Object.keys(O).length + ' · Seiten ' + (6 + STORYS.length + 1) + ' · ' + path.relative(WURZEL, pdfDatei) + ' (' + Math.round(fs.statSync(pdfDatei).size / 1024) + ' KB)');
