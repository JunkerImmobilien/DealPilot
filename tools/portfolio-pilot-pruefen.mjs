// tools/portfolio-pilot-pruefen.mjs · v2951b
// Prueft den Zahlen-/Zuordnungspruefer des Portfolio-Piloten an der ECHTEN Datei
// gegen den ersten Lauf vom 25.10.2026 (Ausschnitte woertlich).
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=fs.readFileSync(path.join(ROOT,'frontend/js/portfolio-pilot.js'),'utf8');
const win={}; const doc={readyState:'loading',addEventListener(){},getElementById(){return null;}};
win.window=win; win.document=doc;
vm.runInNewContext(src,{window:win,document:doc,console,setTimeout,MutationObserver:undefined});
const P=win.DealPilotPortfolioPilot;
const ctx={bestand_zielbild:{
  kaltmiete_jahr:{bestand:279300,nach_mieterhoehung:313300,zielbild:317688,mehr_durch_mieterhoehung:34000,mehr_durch_umbau_neuvermietung:4388,mehr_gesamt:38388,mehr_gesamt_prozent:13.7,mehr_durch_mieterhoehung_prozent:12.2,mehr_durch_umbau_neuvermietung_prozent:1.6},
  kaltmiete_laut_objektdaten_derselben_objekte:288420, massnahmen_gesamt:366500,
  bruttomietrendite_prozent:{bestand:5.41,zielbild_auf_kaufpreis_plus_massnahmen:5.75},
  ertragswert:{bestand:5270000,zielbild:5794000,mehrwert:524000,massnahmen_dieser_objekte:366500,nach_kosten:5427500,wertzuwachs_nach_kosten:157500,kaufpreise_dieser_objekte:5159000,ertragswert_bestand_gegen_kaufpreis_prozent:2.2,kaufpreis_gegen_ertragswert_bestand_prozent:-2.1},
  massnahmen_teurer_als_wert:['Gohliser Str. 42 Leipzig','Bismarckstr. 27 Detmold'],
  je_objekt:[{name:'Gohliser Str. 42 Leipzig',ertragswert_bestand:2205000,wertzuwachs_nach_kosten:-5500,mehr_miete:12240,mehr_miete_prozent:13},{name:'Bäckerstr. 7 Musterhausen',wertzuwachs_nach_kosten:0,mehr_miete:1872,mehr_miete_prozent:20},{name:'Bismarckstr. 27 Detmold',wertzuwachs_nach_kosten:-21000}],
  gesamtbewertung:{kaufpreise:6927000,nebenkosten:931198,gesamtinvestition:8010198,objektwerte_wertansatz_kaufpreis:6927000,restschuld_heute:5739861,eigenkapital_eingesetzt:2077954}}};
const lauf1 = "2. Die Kaltmiete im Bestand beträgt 279.300 EUR pro Jahr. Nach den geplanten Mieterhöhungen soll die Kaltmiete auf 313.300 EUR steigen, was eine Erhöhung um 34.000 EUR oder 13,7 % bedeutet. Die Kaltmiete laut Objektdaten derselben Objekte beträgt 288.420 EUR, was von den Mieten im Zielbild abweicht, da nicht alle Objekte die gleiche Mieterhöhung erfahren.\n\n3. Die Maßnahmen kosten insgesamt 366.500 EUR. Die Bruttomietrendite liegt im Bestand bei 5,41 % und soll im Zielbild auf 5,75 % steigen.\n\n4. Der Ertragswert im Bestand beträgt 5.270.000 EUR, während der Ertragswert im Zielbild 5.794.000 EUR beträgt. Nach Abzug der Kosten ergibt sich ein Wertzuwachs nach Kosten von 524.000 EUR. Der Ertragswert im Bestand steht im Verhältnis zu den Kaufpreisen derselben Objekte, wobei der Ertragswertbestand 2,2 % unter den Kaufpreisen liegt.\n\n5. Bei den einzelnen Objekten trägt die Gohliser Str. 42 Leipzig am meisten zum Ertragswert bei, während die Maßnahmen für das Objekt Bäckerstr. 7 Musterhausen mehr kosten, als sie an Wert bringen. Die Gohliser Str. 42 hat einen Ertragswert von 2.205.000 EUR, während die Maßnahmen für Bäckerstr. 7 0 EUR an Wertzuwachs bringen.\n\n6. In der Gesamtbewertung beträgt die Summe der Kaufpreise 6.927.000 EUR und die Nebenkosten 931.198 EUR, was zu einer Gesamtinvestition von 8.010.198 EUR führt. Die Objektwerte betragen 6.927.000 EUR, die Restschuld liegt bei 5.739.861 EUR, und das eingesetzte Eigenkapital beträgt 2.077.954 EUR.\n";
const r=P._zahlenPruefen(lauf1,ctx);
console.log(JSON.stringify(r,null,1));
// Gegenprobe: ein korrekter Text darf keinen Befund ergeben
const gut='Die Kaltmiete steigt um 34.000 € oder 12,2 % durch die Mieterhöhung. Insgesamt sind es 38.388 € oder 13,7 %. Der Ertragswert im Bestand liegt 2,2 % über den Kaufpreisen derselben Objekte. Der Mehrwert beträgt 524.000 €, der Wertzuwachs nach Kosten 157.500 €. Bei Gohliser Str. 42 Leipzig kosten die Maßnahmen mehr, als sie an Wert bringen.';
const g=P._zahlenPruefen(gut,ctx); console.log('GEGENPROBE', JSON.stringify(g));
process.exitCode = (r.bedeutung.length>=4 && g.bedeutung.length===0 && g.nicht_gefunden.length===0) ? 0 : 1;

console.log(process.exitCode ? "ROT" : "SAUBER — 4 Zuordnungsfehler des ersten Laufs erkannt, Gegenprobe ohne Befund");
