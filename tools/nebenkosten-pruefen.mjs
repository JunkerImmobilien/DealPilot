#!/usr/bin/env node
/* tools/nebenkosten-pruefen.mjs · nn6 (26.11.2026) — Wohnnebenkosten je Gemeinde (lib/nebenkosten/)
   Prüft die Datei grundsteuer-gemeinden.json und die Funktion nebenkostenFuer() am echten Modul:
     A  Datei: Deckung (≥ 10.000 Gemeinden), Herkunft/Lizenz/Jahr, Faktor K plausibel (0,3–0,9)
     B  Kalibrierung: wohnflächengewichteter Schnitt == Bundesschnitt (±1 %) — über die Rohsumme rekonstruiert
     C  Funktion: jeder Posten mit Wert und Herkunft, Summe = Summe der Posten, € = qm × Wohnfläche
     D  Gemeinde mit Wert → Grundsteuer 'gemeinde'; unbekannter AGS → alles 'bund'
     E  Kundentext: keine Quellennamen, kein Gedankenstrich, kein Semikolon
     F  Gegenprobe: ein verfälschter Wert wird von C erkannt
     W  pp6 Wasser: trinkwasser-gemeinden.json (Deckung ≥ 9.000, Lizenz, Median, Landesmittel), Kirchlengern
        'gemeinde', mittlere Gemeinde = Bundesschnitt, Rückfall Kreis bzw. Landesmittel, Faktor 0,6 bis 1,8, Gegenprobe
   RC 0 = sauber. */
import { nebenkostenFuer, daten, BUND, trinkwasserDaten, wasserFaktor } from '../marktbericht/backend/src/lib/nebenkosten/nebenkosten.js';
let rot = 0, gruen = 0;
const ok = (b, t) => { if (b) gruen++; else { rot++; console.log('ROT  ' + t); } };
const D = daten();
const G = D.gemeinden || {};
const n = Object.keys(G).length;
ok(n >= 10000, 'A Deckung: ' + n + ' Gemeinden (erwartet ≥ 10.000)');
ok(D.jahr >= 2023 && D.lizenz === 'dl-de/by-2-0' && /71231-01-03-5/.test(D.quelle_intern || ''), 'A Herkunft/Lizenz/Jahr');
ok(D.faktor_k > 0.3 && D.faktor_k < 0.9, 'A Faktor K ' + D.faktor_k);
ok(Math.abs(D.bund_roh_qm_monat * D.faktor_k - BUND.grundsteuer) < BUND.grundsteuer * 0.01, 'B Kalibrierung roh × K = Bundesschnitt');

function stimmt(r, wfl) {
  let b = true;
  for (const p of r.posten) {
    if (!(p.qm_monat > 0) || !['gemeinde', 'kreis', 'land', 'bund'].includes(p.herkunft) || !p.text) b = false;
    if (wfl && Math.abs(p.eur_monat - Math.round(p.qm_monat * wfl)) > 1) b = false;
  }
  const s = r.posten.reduce((x, p) => x + p.qm_monat, 0);
  if (Math.abs(s - r.summe_qm) > 0.011) b = false;
  return b;
}
const pruefeErgebnis = (r, wfl, t) => ok(stimmt(r, wfl), 'C Posten/Summe ' + t);
const kl = nebenkostenFuer('05758020', { wfl: 140, art: 'efh' });
pruefeErgebnis(kl, 140, 'Kirchlengern');
ok(kl.posten.find((p) => p.id === 'grundsteuer').herkunft === 'gemeinde', 'D Kirchlengern Grundsteuer je Gemeinde');
const un = nebenkostenFuer('99999999', { wfl: 100 });
ok(un.posten.every((p) => p.herkunft === 'bund') && un.gemeinde === null, 'D unbekannter AGS → Bundesschnitt');
ok(Math.abs(un.summe_qm - Object.entries(BUND).filter(([k]) => k !== 'stand').reduce((s, [, v]) => s + v, 0)) < 0.011, 'D Bundessumme');

const text = JSON.stringify([kl.posten.map((p) => p.text + p.name), kl.herkunft_text, kl.hinweis]);
ok(!/Mieterbund|Regionaldatenbank|Destatis|Statistisch|BKS|Betriebskostenspiegel/i.test(text), 'E keine Quellennamen im Kundentext');
ok(!/[–—;]/.test(text), 'E kein Gedankenstrich, kein Semikolon');

/* W Wasser und Abwasser am Ort (pp6) */
const T = trinkwasserDaten(), nT = Object.keys(T.gemeinden || {}).length;
ok(nT >= 9000, 'W Deckung Trinkwasser: ' + nT + ' Gemeinden (erwartet ≥ 9.000)');
ok(T.lizenz === 'dl-de/by-2-0' && /32271-01-01-5/.test(T.quelle_intern || '') && T.jahr >= 2024, 'W Herkunft/Lizenz/Jahr Trinkwasser');
ok(T.median && T.median.eur_m3 > 1 && T.median.eur_m3 < 4, 'W Median plausibel ' + (T.median && T.median.eur_m3));
ok(Object.keys(T.laender || {}).length >= 13, 'W Landesmittel für ≥ 13 Länder: ' + Object.keys(T.laender || {}).length);
const klW = kl.posten.find((p) => p.id === 'wasser');
ok(klW.herkunft === 'gemeinde' && /Trinkwasserentgelt der Gemeinde/.test(klW.text), 'W Kirchlengern Wasser je Gemeinde');
const mittel = Object.entries(T.gemeinden || {}).find(([, v]) => v.eur_m3 === T.median.eur_m3 && Math.abs((v.grund_jahr || 0) - T.median.grund_jahr) < 0.01);
if (mittel) ok(Math.abs(nebenkostenFuer(mittel[0], { wfl: 100 }).posten.find((p) => p.id === 'wasser').qm_monat - BUND.wasser) < 0.011, 'W mittlere Gemeinde = Bundesschnitt');
const lnd = Object.keys(T.laender || {})[0] || '05', ohne = lnd + '999999', wo = wasserFaktor(ohne, 100);
ok(!(T.gemeinden || {})[ohne] && wo && ['kreis', 'land'].includes(wo.ebene), 'W Rückfall Kreis/Land für Gemeinde ohne Zeile');
let fmin = 9, fmax = 0; for (const k of Object.keys(T.gemeinden || {})) { const w = wasserFaktor(k, 120); fmin = Math.min(fmin, w.faktor); fmax = Math.max(fmax, w.faktor); }
ok(fmin >= 0.6 && fmax <= 1.8, 'W Faktor begrenzt ' + fmin.toFixed(2) + ' bis ' + fmax.toFixed(2));
ok(nebenkostenFuer('99999999', { wfl: 100 }).posten.find((p) => p.id === 'wasser').herkunft === 'bund', 'W unbekanntes Land → Bundesschnitt');
const falschW = JSON.parse(JSON.stringify(kl)); falschW.posten.find((p) => p.id === 'wasser').herkunft = 'ort';
ok(!stimmt(falschW, 140), 'W Gegenprobe: unbekannte Herkunft wird erkannt');

/* F Gegenprobe */
const falsch = JSON.parse(JSON.stringify(kl)); falsch.posten[0].eur_monat += 50;
ok(!stimmt(falsch, 140), 'F Gegenprobe: verfälschter Betrag wird erkannt');

console.log((rot ? 'ROT ' + rot : 'sauber') + ' · ' + gruen + ' Punkte · Kirchlengern ' + kl.summe_qm + ' €/m² (Grundsteuer ' + kl.posten[0].qm_monat + ', Wasser ' + klW.qm_monat + ' ' + klW.herkunft + '), 140 m² = ' + kl.summe_monat + ' €/Monat');
process.exit(rot ? 1 : 0);
