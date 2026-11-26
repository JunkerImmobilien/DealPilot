#!/usr/bin/env node
/* tools/neuvermietung-faktor-ableiten.mjs · MM6 (26.11.2026) · Faktor Neuvermietung je Kreis aus eigenen Angebotsmieten

   Marcel 26.11.2026: „teils 10,50 bei Neuvermietung“, Untergrenze nicht zu niedrig. Heute rechnet die App bei
   Neuvermietung ohne Mietpreisbremse mit Vergleichsmiete (oberer Wert) × 1,20 (lib/mietanker.js zielMaximum).
   Sobald je Kreis genug eigene Angebotsmieten gesammelt sind (mb.angebot_miete_messung, je Marktbericht eine
   zusammengefasste Zeile, seit Prod 1.0.244), leitet dieses Werkzeug je Kreis den gemessenen Faktor ab:

     Faktor = Median( Angebotsmiete-Median der Zeile / Vergleichsmiete oben derselben Gemeinde, Baujahr- und Größenklasse )

   Die Vergleichsmiete kommt aus der Route /marktbericht/mietspiegel (Mietspiegel bzw. DealPilot-Näherung, dieselbe
   Rechnung wie in der App). Untergrenze 1,20: der Faktor sinkt nie unter den heutigen Wert.

   HEUTE NUR AUSGABE. Es wird nichts geschrieben, bis mindestens MIN_N Zeilen je Kreis vorliegen. Das Schreiben
   (Datei je Kreis, die zielMaximum liest) wird gebaut, wenn der erste Kreis die Schwelle erreicht (BACKLOG).

   Aufruf:  node tools/neuvermietung-faktor-ableiten.mjs            Staging lesen (ssh, nur SELECT und GET)
            node tools/neuvermietung-faktor-ableiten.mjs --prod     Prod lesen (nur lesend)
*/
import { execFileSync } from 'node:child_process';

const ARG = new Set(process.argv.slice(2));
const HOST = ARG.has('--prod') ? 'root@157.90.117.167' : 'root@116.203.214.11';
const MIN_N = 20, UNTERGRENZE = 1.2;

function ssh(cmd) { return execFileSync('ssh', ['-o', 'ConnectTimeout=15', HOST, cmd], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
const med = (a) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };

const sql = "SELECT ags, objektart, wfl_klasse, bj_klasse, median_eur_qm, n FROM mb.angebot_miete_messung WHERE ags IS NOT NULL AND objektart = 'wohnung'";
const roh = ssh(`docker exec dealpilot-mb-db psql -U mb -d marktbericht -At -F '|' -c "${sql}"`).trim();
const zeilen = roh ? roh.split('\n').map((l) => { const [ags, art, wfl, bj, m, n] = l.split('|'); return { ags, art, wfl, bj, median: Number(m), n: Number(n) }; }) : [];
const jeKreis = new Map();
for (const z of zeilen) { const k = String(z.ags).slice(0, 5); (jeKreis.get(k) || jeKreis.set(k, []).get(k)).push(z); }

console.log(`Angebotsmiete-Messungen (${HOST.includes('157') ? 'Prod' : 'Staging'}): ${zeilen.length} Zeilen, ${jeKreis.size} Kreise, Schwelle ${MIN_N} je Kreis`);
const mitte = (kl) => { const m = String(kl || '').match(/(\d{2,4})\D+(\d{2,4})/); return m ? Math.round((Number(m[1]) + Number(m[2])) / 2) : (String(kl || '').match(/\d{2,4}/) || [null])[0]; };
let bereit = 0;
for (const [kreis, z] of [...jeKreis.entries()].sort((a, b) => b[1].length - a[1].length)) {
  if (z.length < MIN_N) { console.log(`  ${kreis}: ${z.length} Zeilen, noch zu wenig`); continue; }
  bereit++;
  const q = [];
  for (const r of z) {
    const bj = mitte(r.bj), wfl = mitte(r.wfl);
    if (!(Number(bj) > 1000) || !(Number(wfl) > 0)) continue;
    try {
      const j = JSON.parse(ssh(`docker exec dealpilot-mb-backend sh -c 'wget -qO- "http://localhost:4000/api/v1/marktbericht/mietspiegel?ags=${r.ags}&baujahr=${bj}&wfl=${wfl}&nur_frei=1"'`));
      const oben = (j.vergleich_wohnung && j.vergleich_wohnung.oben) || (j.naeherung && j.naeherung.oben) || (j.werte && j.werte.oben);
      if (oben > 0 && r.median > 0) q.push(r.median / oben);
    } catch (e) { /* einzelne Zeile ohne Vergleich */ }
  }
  const f = med(q);
  console.log(`  ${kreis}: ${z.length} Zeilen, ${q.length} mit Vergleichsmiete · gemessener Faktor ${Number.isFinite(f) ? f.toFixed(3) : '–'} → genutzt ${Number.isFinite(f) ? Math.max(UNTERGRENZE, f).toFixed(3) : UNTERGRENZE.toFixed(2)} (Untergrenze ${UNTERGRENZE})`);
}
if (!bereit) console.log('Noch kein Kreis über der Schwelle. Es wird nichts geschrieben, die App rechnet weiter mit × 1,20.');
else console.log('Schreiben ist noch nicht gebaut (BACKLOG): erst wenn Marcel den gemessenen Faktor gesehen hat.');
