#!/usr/bin/env node
/* tools/eigennutzer-pruefen.mjs · v5130 · Prüfer des Eigennutzer-Kerns (frontend/js/eigennutzer-kern.js)
   Lädt die ECHTE Datei (und gnotkg.js, score-tiers.js wie im Browser) und rechnet Beispielfälle.
   Prüft: Gewichte 35/35/30, Leistbarkeit NICHT im Haus-Score, ersparte Miete = Mittelwert (+Hauszuschlag nur bei Häusern),
   MFH abgewiesen mit Hinweis, ETW-WEG-Teil drückt Zustand und steht im Kurzurteil, Nebenkosten über GNotKG,
   Kaufen-gegen-Mieten-Jahr plausibel, keine Gedankenstriche/Semikolons im Kundentext, Spiegel im Backend gleich.
   RC=0 sauber. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, Math, Number, String, Array, Object, Date, isFinite, JSON };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['score-tiers.js', 'gnotkg.js', 'eigennutzer-kern.js']) {
  vm.runInContext(fs.readFileSync(path.join(W, 'frontend', 'js', f), 'utf8'), ctx, { filename: f });
}
const K = ctx.DpEigennutzerKern;
let rot = 0, gruen = 0;
function ok(bed, text) { if (bed) gruen++; else { rot++; console.log('ROT  ' + text); } }
const nah = (a, b, tol) => Math.abs(a - b) <= tol;

/* 1 · Gewichte */
ok(K.GEWICHT.preis === 0.35 && K.GEWICHT.zustand === 0.35 && K.GEWICHT.lage === 0.30, 'Gewichte Preis 35 / Zustand 35 / Lage 30');

/* 2 · EFH Bielefeld wie im Muster */
const efh = K.kern({ kaufpreis: 310000, wfl: 130, baujahr: 1998, objektart: 'efh', ek: 100000, netto: 5200, zins_pct: 4.09,
  grest_pct: 6.5, vergleichsmiete_qm: 7.30, hauszuschlag_pct: 15, lage_score: 57 });
ok(efh.ok, 'EFH rechnet');
const erw = Math.round((efh.haus.gruppen.preis.score * 0.35 + efh.haus.gruppen.zustand.score * 0.35 + 57 * 0.30));
ok(efh.haus.score === erw, 'Haus-Score = 35/35/30 (' + efh.haus.score + ' gegen ' + erw + ')');
ok(nah(efh.miete.qm, 7.30 * 1.15, 0.01), 'ersparte Miete = Mittelwert × Hauszuschlag');
ok(efh.miete.basis === 'Mittelwert der Vergleichsmiete', 'Basis Mittelwert benannt');
ok(efh.leistbarkeit.ampel === 'gruen' || efh.leistbarkeit.ampel === 'gelb', 'Leistbarkeit als Ampel (' + efh.leistbarkeit.ampel + ', ' + efh.leistbarkeit.quote + ' %)');
ok(efh.nebenkosten.gnotkg === true && efh.nebenkosten.grest === 20150, 'Nebenkosten mit GNotKG, GrESt 6,5 % = 20.150 €');
ok(efh.nebenkosten.pct > 10 && efh.nebenkosten.pct < 13, 'Nebenkosten 10 bis 13 % (' + efh.nebenkosten.pct + ' %)');
ok(efh.kaufen_mieten.reihe.length === 21 && efh.kaufen_mieten.jahr >= 5 && efh.kaufen_mieten.jahr <= 20, 'Kaufen gegen Mieten Jahr ' + efh.kaufen_mieten.jahr);

/* 3 · Leistbarkeit beeinflusst den Haus-Score NICHT */
const ohneNetto = K.kern({ kaufpreis: 310000, wfl: 130, baujahr: 1998, objektart: 'efh', ek: 100000, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30, hauszuschlag_pct: 15, lage_score: 57 });
const armNetto = K.kern({ kaufpreis: 310000, wfl: 130, baujahr: 1998, objektart: 'efh', ek: 100000, netto: 2000, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30, hauszuschlag_pct: 15, lage_score: 57 });
ok(ohneNetto.haus.score === efh.haus.score && armNetto.haus.score === efh.haus.score, 'Haus-Score unabhängig vom Einkommen');
ok(ohneNetto.leistbarkeit.ampel === null && armNetto.leistbarkeit.ampel === 'rot', 'Ampel null ohne Einkommen, rot bei 2.000 € netto');

/* 4 · MFH abgewiesen */
const mfh = K.kern({ kaufpreis: 600000, wfl: 400, baujahr: 1970, objektart: 'mfh' });
ok(mfh.ok === false && mfh.grund === 'mfh' && /Vermieten/.test(mfh.hinweis), 'MFH mit Hinweis Modus Vermieten');

/* 5 · ETW: kein Hauszuschlag, WEG-Teil */
const etwOhne = K.kern({ kaufpreis: 220000, wfl: 75, baujahr: 1975, objektart: 'etw', ek: 50000, zins_pct: 4.0, grest_pct: 6.5, vergleichsmiete_qm: 8.5, hauszuschlag_pct: 15, lage_score: 60 });
const etwMit = K.kern({ kaufpreis: 220000, wfl: 75, baujahr: 1975, objektart: 'etw', ek: 50000, zins_pct: 4.0, grest_pct: 6.5, vergleichsmiete_qm: 8.5, lage_score: 60,
  weg: { sonderumlage_eur: 12000, ruecklage_eur_qm: 6, sanierung_beschlossen: 'Dach 2026' } });
ok(etwOhne.miete.hauszuschlag_pct === 0 && nah(etwOhne.miete.qm, 8.5, 0.001), 'ETW ohne Hauszuschlag');
ok(etwMit.haus.gruppen.zustand.score < etwOhne.haus.gruppen.zustand.score, 'WEG-Befunde drücken den Zustand');
ok(etwMit.urteil.some((s) => /Sonderumlage/.test(s)) && etwMit.urteil.some((s) => /Rücklage/.test(s)), 'WEG-Teil im Kurzurteil');

/* 6 · Wert vorhanden: Preis aus Wert und Faktor */
const mitWert = K.kern({ kaufpreis: 310000, wfl: 130, baujahr: 1998, objektart: 'efh', ek: 100000, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30, hauszuschlag_pct: 15, lage_score: 57, wert: { betrag: 340000 } });
ok(mitWert.haus.gruppen.preis.wert_score != null && mitWert.haus.gruppen.preis.abweichung_pct < 0, 'Preis unter Wert erkannt');
ok(mitWert.haus.gruppen.preis.score > efh.haus.gruppen.preis.score, 'Preis unter Wert verbessert den Preis-Score');

/* 7 · Ohne Lage: Gewichte neu verteilt */
const ohneLage = K.kern({ kaufpreis: 310000, wfl: 130, baujahr: 1998, objektart: 'efh', ek: 100000, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30, hauszuschlag_pct: 15 });
const g = ohneLage.haus.gruppen; ok(ohneLage.haus.score === Math.round((g.preis.score + g.zustand.score) / 2), 'ohne Lage: Preis und Zustand je zur Hälfte');

/* 8 · Demo-Adapter liefert die alte Form */
const demo = K.rechne({ kp: 310000, wfl: 130, bj: 1998, ek: 100000, netto: 5200 }, { zinsFn: () => 4.09, mieteQm: 7.30, makro: 51, leer: 'gut', bev: 0.13, gebiet: 'Bielefeld', quelle: 'Test' });
ok(demo.ok && demo.gruppen.length === 4 && demo.reihe.length === 21 && demo.reihe[20].kauf != null && typeof demo.gesamt === 'number', 'Demo-Adapter alte Form');

/* 9 · Kundentext ohne Gedankenstrich und Semikolon */
const texte = [].concat(efh.urteil, etwMit.urteil, ohneNetto.urteil, demo.gruppen.map((x) => x.t), [mfh.hinweis]);
ok(texte.every((t) => !/[–—;]/.test(t)), 'Kundentext ohne – — ;');

/* 10 · Spiegel im Backend gleich der Quelle */
const quelle = path.join(W, 'frontend', 'js', 'eigennutzer-kern.js');
const spiegel = path.join(W, 'backend', 'src', 'generated', 'rechenkerne', 'eigennutzer-kern.js');
const sum = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
ok(fs.existsSync(spiegel) && sum(spiegel) === sum(quelle), 'Backend-Spiegel gleich der Quelle (node tools/rechenkerne-spiegeln.mjs)');

console.log((rot ? 'ROT' : 'sauber') + ' · ' + gruen + ' grün, ' + rot + ' rot · Haus-Score Muster ' + efh.haus.score + ' (' + efh.haus.stufe.wort + '), Kaufen ab Jahr ' + efh.kaufen_mieten.jahr);
process.exit(rot ? 1 : 0);
