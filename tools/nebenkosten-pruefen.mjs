#!/usr/bin/env node
/* tools/nebenkosten-pruefen.mjs · nn6 (26.11.2026) — Wohnnebenkosten je Gemeinde (lib/nebenkosten/)
   Prüft die Datei grundsteuer-gemeinden.json und die Funktion nebenkostenFuer() am echten Modul:
     A  Datei: Deckung (≥ 10.000 Gemeinden), Herkunft/Lizenz/Jahr, Faktor K plausibel (0,3–0,9)
     B  Kalibrierung: wohnflächengewichteter Schnitt == Bundesschnitt (±1 %) — über die Rohsumme rekonstruiert
     C  Funktion: jeder Posten mit Wert und Herkunft, Summe = Summe der Posten, € = qm × Wohnfläche
     D  Gemeinde mit Wert → Grundsteuer 'gemeinde'; unbekannter AGS → alles 'bund'
     E  Kundentext: keine Quellennamen, kein Gedankenstrich, kein Semikolon
     F  Gegenprobe: ein verfälschter Wert wird von C erkannt
   RC 0 = sauber. */
import { nebenkostenFuer, daten, BUND } from '../marktbericht/backend/src/lib/nebenkosten/nebenkosten.js';
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
    if (!(p.qm_monat > 0) || !['gemeinde', 'bund'].includes(p.herkunft) || !p.text) b = false;
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

/* F Gegenprobe */
const falsch = JSON.parse(JSON.stringify(kl)); falsch.posten[0].eur_monat += 50;
ok(!stimmt(falsch, 140), 'F Gegenprobe: verfälschter Betrag wird erkannt');

console.log((rot ? 'ROT ' + rot : 'sauber') + ' · ' + gruen + ' Punkte · Kirchlengern ' + kl.summe_qm + ' €/m² (Grundsteuer ' + kl.posten[0].qm_monat + '), 140 m² = ' + kl.summe_monat + ' €/Monat');
process.exit(rot ? 1 : 0);
