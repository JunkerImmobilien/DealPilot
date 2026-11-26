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

/* pp6 · Nebenkosten einzeln: Posten als „davon“-Zeilen mit Herkunft, Summe der Posten = übrige Nebenkosten,
   Unterlagen ersetzen die Posten. Muster-Posten erfunden, nicht aus einer Gemeinde. */
const POSTEN = [{ id: 'grundsteuer', name: 'Grundsteuer', qm: 0.17, herkunft: 'gemeinde' }, { id: 'wasser', name: 'Wasser und Abwasser', qm: 0.31, herkunft: 'gemeinde' },
  { id: 'muell', name: 'Müllabfuhr', qm: 0.16, herkunft: 'bund' }, { id: 'versicherung', name: 'Gebäudeversicherung', qm: 0.31, herkunft: 'land' }];
const mitP = K.kern({ kaufpreis: 310000, wfl: 140, baujahr: 1998, objektart: 'efh', ek: 100000, netto: 5200, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30,
  nebenkosten_qm: { wert: 0.95, herkunft: 'teils ortsgenau', posten: POSTEN } });
const AUp = mitP.leistbarkeit.aufstellung, teile = AUp.filter((x) => x.teil), ue = AUp.find((x) => x.k === 'uebrige');
ok(teile.length === 4 && teile.every((x) => /^davon /.test(x.l) && x.herkunft), 'Posten einzeln als davon-Zeilen mit Herkunft (' + teile.length + ')');
ok(teile.map((x) => x.herkunft).join() === 'je Gemeinde,je Gemeinde,Bundesschnitt,Landesmittel', 'Herkunft je Gemeinde / Bundesschnitt / Landesmittel');
ok(ue.eur === teile.reduce((s, x) => s + x.eur, 0), 'Übrige Nebenkosten = Summe der Posten (' + ue.eur + ' €)');
ok(AUp[AUp.length - 1].summe && AUp.filter((x) => !x.teil && !x.summe).reduce((s, x) => s + x.eur, 0) - AUp[AUp.length - 1].eur <= 2, 'Summe im Monat ohne doppelte Posten');
const mitU = K.kern({ kaufpreis: 310000, wfl: 140, baujahr: 1998, objektart: 'efh', ek: 100000, netto: 5200, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30,
  nebenkosten_qm: { wert: 0.95, posten: POSTEN }, betriebskosten_monat: 210 });
ok(!mitU.leistbarkeit.aufstellung.some((x) => x.teil), 'Unterlagen ersetzen die Posten');
const ohneP = K.kern({ kaufpreis: 310000, wfl: 140, baujahr: 1998, objektart: 'efh', ek: 100000, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30 });
ok(!ohneP.leistbarkeit.aufstellung.some((x) => x.teil), 'Pauschale ohne Posten');

/* pp6 · Zustand als Stufe (Anlage 2), Tilgung und Zinsbindung */
const zB = (st) => K.kern({ kaufpreis: 310000, wfl: 140, baujahr: 1975, objektart: 'efh', ek: 100000, zins_pct: 4, grest_pct: 6.5, vergleichsmiete_qm: 7.3, zustand: st ? { stufe: st } : undefined });
const z0 = zB(null), zU = zB('unsaniert'), zK = zB('kernsaniert'), zT = zB('teilweise');
ok(zK.haus.gruppen.zustand.score > z0.haus.gruppen.zustand.score && zU.haus.gruppen.zustand.score < z0.haus.gruppen.zustand.score, 'Zustand: kernsaniert hebt, unsaniert senkt (' + zU.haus.gruppen.zustand.score + ' / ' + z0.haus.gruppen.zustand.score + ' / ' + zK.haus.gruppen.zustand.score + ')');
ok(zK.haus.gruppen.zustand.mod_punkte === 19 && zT.haus.gruppen.zustand.mod_punkte === 8 && zU.haus.gruppen.zustand.mod_punkte === 0, 'Punkte nach Anlage 2: 0 / 8 / 19');
ok(zK.haus.gruppen.zustand.hinweise.some((t) => /Anlage 2/.test(t)), 'Hinweis nennt Anlage 2');
const t3 = K.kern({ kaufpreis: 310000, wfl: 140, baujahr: 1998, objektart: 'efh', ek: 100000, zins_pct: 4, tilgung_pct: 3, bindung_jahre: 15, zins_herkunft: 'tagesaktuell', grest_pct: 6.5, vergleichsmiete_qm: 7.3 });
const t2 = K.kern({ kaufpreis: 310000, wfl: 140, baujahr: 1998, objektart: 'efh', ek: 100000, zins_pct: 4, grest_pct: 6.5, vergleichsmiete_qm: 7.3 });
ok(t3.finanzierung.tilgung_pct === 3 && t2.finanzierung.tilgung_pct === 2 && Math.abs(t3.finanzierung.rate - t2.finanzierung.rate - t2.finanzierung.darlehen * 0.01 / 12) <= 1, 'Tilgung 3 % hebt die Rate um 1 % des Darlehens im Jahr');
ok(t3.finanzierung.bindung_jahre === 15 && t3.finanzierung.zins_herkunft === 'tagesaktuell' && t2.finanzierung.bindung_jahre === 10, 'Zinsbindung und Herkunft im Ergebnis');
const dz = { zinsFn: (ltv, b) => ({ 10: 4.11, 15: 4.31, 20: 4.41 })[b || 10], zinsLive: true, mieteQm: 7.3 };
const rd15 = K.rechneDemo({ kp: 310000, wfl: 140, bj: 1998, ek: 100000, objektart: 'efh', bindung: 15 }, dz), rdE = K.rechneDemo({ kp: 310000, wfl: 140, bj: 1998, ek: 100000, objektart: 'efh', zins_eigen: 3.5 }, dz);
ok(rd15.zins === 4.31 && rd15.kern.finanzierung.zins_herkunft === 'tagesaktuell' && rdE.zins === 3.5 && rdE.kern.finanzierung.zins_herkunft === 'deine Angabe', 'Zins zur Bindung, eigener Zins schlägt den Live-Zins');

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

/* 11 · v5130j · Betriebskosten in der Leistbarkeit (Marcel 26.11.2026) */
{
  const basisE = { kaufpreis: 310000, wfl: 130, baujahr: 1998, objektart: 'efh', ek: 100000, netto: 5200, zins_pct: 4.09, grest_pct: 6.5, vergleichsmiete_qm: 7.30, hauszuschlag_pct: 15, lage_score: 57 };
  const mitAusweis = K.kern(Object.assign({}, basisE, { zustand: { endenergie_kwh: 120, energietraeger: 'Erdgas' } }));
  const L = mitAusweis.leistbarkeit, A = L.aufstellung;
  const z = (k) => A.find((x) => x.k === k).eur;
  ok(z('heizung') === Math.round(120 * 130 * 12.2 / 100 / 12), 'Heizung aus Ausweis: 120 kWh × 130 m² × 12,2 ct / 12 = ' + z('heizung') + ' €');
  ok(z('uebrige') === 260, 'übrige Nebenkosten Pauschale 2,00 €/m² × 130 = 260 €');
  ok(Math.abs(z('summe') - (z('rate') + z('eigentuemer') + z('heizung') + z('uebrige'))) <= 2, 'Summe = Rate + Eigentümer + Heizung + übrige');
  ok(Math.abs(L.quote - L.wohnkosten / 5200 * 100) < 0.05, 'Quote = Summe / Netto');
  ok(L.grenzen.gruen === 40 && L.grenzen.gelb === 50, 'Ampelgrenzen 40 / 50 %');
  const oel = K.kern(Object.assign({}, basisE, { zustand: { endenergie_kwh: 120, energietraeger: 'Heizöl' } }));
  ok(oel.leistbarkeit.aufstellung.find((x) => x.k === 'heizung').eur > z('heizung'), 'Heizöl teurer als Gas bei gleicher Endenergie');
  const klasse = K.kern(Object.assign({}, basisE, { zustand: { energieklasse: 'C' } }));
  ok(klasse.leistbarkeit.heizung.kwh_qm === 87 && /Energieklasse C/.test(klasse.leistbarkeit.heizung.herkunft), 'ohne Ausweiswert: Mitte der Klasse C (87 kWh)');
  const bj = K.kern(Object.assign({}, basisE));
  ok(bj.leistbarkeit.heizung.kwh_qm === 110 && /Baujahr/.test(bj.leistbarkeit.heizung.herkunft), 'ohne Klasse: Annahme nach Baujahr 1998 (110 kWh)');
  const expose = K.kern(Object.assign({}, basisE, { betriebskosten_monat: 210, heizkosten_monat: 150 }));
  ok(expose.leistbarkeit.aufstellung.find((x) => x.k === 'uebrige').eur === 210 && expose.leistbarkeit.aufstellung.find((x) => x.k === 'heizung').eur === 150, 'Werte aus den Unterlagen haben Vorrang');
  const etwHg = K.kern({ kaufpreis: 220000, wfl: 75, baujahr: 1975, objektart: 'etw', ek: 50000, netto: 3800, zins_pct: 4.0, grest_pct: 6.5, vergleichsmiete_qm: 8.5, lage_score: 60, weg: { hausgeld_umlagefaehig: 230, hausgeld_nicht_umlagefaehig: 90 } });
  const ea = etwHg.leistbarkeit.aufstellung;
  ok(ea.find((x) => x.k === 'uebrige').eur === 230 && ea.find((x) => x.k === 'heizung').eur === 0 && ea.find((x) => x.k === 'eigentuemer').eur === 90, 'ETW: umlagefähiges Hausgeld statt Pauschale, Heizung darin enthalten');
  const etwGasEtage = K.kern({ kaufpreis: 220000, wfl: 75, baujahr: 1975, objektart: 'etw', ek: 50000, netto: 3800, zins_pct: 4.0, vergleichsmiete_qm: 8.5, weg: { hausgeld_umlagefaehig: 160, heizung_im_hausgeld: false } });
  ok(etwGasEtage.leistbarkeit.aufstellung.find((x) => x.k === 'heizung').eur > 0, 'ETW mit Etagenheizung: Heizung extra');
  /* Kaufen oder mieten bleibt unverändert: Betriebskosten heben sich auf */
  const ohneBK = K.kern(Object.assign({}, basisE, { betriebskosten_monat: 0, heizkosten_monat: 0 }));
  ok(JSON.stringify(ohneBK.kaufen_mieten.reihe) === JSON.stringify(mitAusweis.kaufen_mieten.reihe), 'Kaufen oder mieten unabhängig von den Betriebskosten');
  ok(ohneBK.haus.score === mitAusweis.haus.score, 'Haus-Score unabhängig von den Betriebskosten');
  ok(ohneBK.leistbarkeit.quote < mitAusweis.leistbarkeit.quote, 'Betriebskosten erhöhen die Belastung');
  ok(A.every((x) => !/[–—;]/.test(x.l + (x.herkunft || ''))), 'Aufstellung ohne – — ;');
  const ort = K.kern(Object.assign({}, basisE, { nebenkosten_qm: { wert: 2.4, herkunft: 'Betriebskosten am Ort' } }));
  const oU = ort.leistbarkeit.aufstellung.find((x) => x.k === 'uebrige');
  ok(oU.eur === Math.round(2.4 * 130) && /Betriebskosten am Ort/.test(oU.herkunft), 'Schnittstelle: ortsgenauer Wert ersetzt die Pauschale, mit Herkunft');
  const ortUnt = K.kern(Object.assign({}, basisE, { nebenkosten_qm: 2.4, betriebskosten_monat: 199 }));
  ok(ortUnt.leistbarkeit.aufstellung.find((x) => x.k === 'uebrige').eur === 199, 'Unterlagen schlagen den ortsgenauen Wert');
}

/* 12 · nn6 · ortsgenaue Nebenkosten (e.nebenkosten_qm) vor der Pauschale, Unterlagen vor beidem */
{
  const b = { kaufpreis: 310000, wfl: 130, baujahr: 1998, objektart: 'efh', ek: 100000, netto: 5200, zins_pct: 4.09, vergleichsmiete_qm: 7.3, lage_score: 57 };
  const u = (r) => r.leistbarkeit.aufstellung.find((x) => x.k === 'uebrige');
  const ort = K.kern(Object.assign({}, b, { nebenkosten_qm: { wert: 1.09, herkunft: 'Grundsteuer der Gemeinde, übrige Posten Durchschnitt' } }));
  ok(u(ort).eur === Math.round(1.09 * 130) && /Grundsteuer der Gemeinde/.test(u(ort).herkunft || ''), 'nn6: ortsgenaue Nebenkosten 1,09 €/m² statt Pauschale');
  const ohne = K.kern(Object.assign({}, b, { nebenkosten_qm: null }));
  ok(u(ohne).eur === 260, 'nn6: ohne Ortswert Rückfall Pauschale 2,00 €/m²');
  const unterl = K.kern(Object.assign({}, b, { nebenkosten_qm: { wert: 1.09 }, betriebskosten_monat: 199 }));
  ok(u(unterl).eur === 199, 'nn6: Unterlagen vor Ortswert');
  const demoNk = K.rechne({ kp: 310000, wfl: 130, bj: 1998, ek: 100000, netto: 5200, objektart: 'efh' }, { zinsFn: () => 4.09, mieteQm: 7.3, makro: 60, leer: 'gut', nebenkosten: { qm: 1.09, ortsgenau: ['grundsteuer'] } });
  ok(demoNk.ok, 'nn6: Demo-Adapter nimmt d.nebenkosten an');
}
/* 10 · Spiegel im Backend gleich der Quelle */
const quelle = path.join(W, 'frontend', 'js', 'eigennutzer-kern.js');
const spiegel = path.join(W, 'backend', 'src', 'generated', 'rechenkerne', 'eigennutzer-kern.js');
const sum = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
ok(fs.existsSync(spiegel) && sum(spiegel) === sum(quelle), 'Backend-Spiegel gleich der Quelle (node tools/rechenkerne-spiegeln.mjs)');

console.log((rot ? 'ROT' : 'sauber') + ' · ' + gruen + ' grün, ' + rot + ' rot · Haus-Score Muster ' + efh.haus.score + ' (' + efh.haus.stufe.wort + '), Kaufen ab Jahr ' + efh.kaufen_mieten.jahr);
process.exit(rot ? 1 : 0);
