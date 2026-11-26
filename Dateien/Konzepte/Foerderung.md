# Förder-Modul (KfW, BAFA) · v5120 · JJ6, 26.11.2026

Marcel 26.11.2026: „KfW-Programme drauf geben, welche man nutzen kann. Auch für Kapitalanleger interessant, aber nur wenn sinnvoll.“

## Bausteine
| Datei | Rolle |
|---|---|
| `frontend/js/data/foerderregister.js` | Register (`window.DpFoerderregister`). `programme` = Vermieter (wie bisher, von calc.js gelesen), NEU `programme_eigen` = Selbstnutzer. Jedes Programm mit `fuer`, `betrag`, `voraussetzung`, `antrag`, `url`, `gelesen`, `abschnitt`. Stand 26.11.2026. |
| `frontend/js/foerderung.js` | Kern `DpFoerderung.passend(eingabe, register)`. Liest nichts aus Einstellungen. Ausgabe `{ liste, hinweis, stand, leer_grund }`, je Eintrag `name, warum (1 Satz), betrag, antrag, pruefen[], url`. |
| `frontend/js/foerderung-karte.js` | Demo-Karte für Kapitalanleger in Pilot-Analyse › Potenzial, nur hinter Vorschau `foerderung`, nur sichtbar, wenn eine Sanierung im Block Sanierungsbedarf angehakt ist. |
| `tools/foerderung-pruefen.mjs` | Prüfer: 8 Beispielfälle, Klimabonus-Absenkung, Pflichtfelder, Kundentext ohne Gedankenstrich/Semikolon. `--gegenprobe` muss rot sein. |
| Jahreswerte-Register `foerderprogramme` | Fälligkeit 26.12.2026 (monatlich, Programme ändern sich oft), Spiegel `stand` in der Registerdatei. |

## Regeln im Kern
- **Kapitalanleger (`nutzung: 'vermietet'`)**: Liste nur bei geplanter Maßnahme oder Neubau. Reiner Kauf → leer mit `leer_grund`. Heizung → 458 (30 %) + 359, Hülle → BAFA + 359, Effizienzhaus → 261, Barriere → 159, Neubau → 298, 296.
- **Selbstnutzer (`nutzung: 'eigen'`)**: Kauf → 124. Kauf Bestand mit Kind, Einkommen unter Grenze (90.000 € + 10.000 € je weiterem Kind), Klasse F/G/H oder unbekannt → 308 mit Kredithöchstbetrag. Neubau → 297, 296, mit Kind → 300. Heizung → 458 mit Grundförderung 30 % + Klimageschwindigkeitsbonus (16 %, ab 1.2.2027 halbjährlich −4, ab 1.8.2028 0) + Einkommensbonus nach zvE-Tabelle, gedeckelt 70 % bzw. 80 %. Hülle/Heizung + Einkommen ≤ 90.000 € → 358, sonst 359.
- Unbekannte Angaben werden nicht geraten: Programm erscheint mit `pruefen` (z. B. „Energieausweis Klasse F, G oder H“).
- Keine Rendite-Rechnung mit Zuschüssen (bewusst, bis Marcel es will).
- Kundentext immer mit: „Voraussetzungen und Konditionen vor Antrag beim Förderprogramm prüfen.“

## Einbindung Eigennutzer-Bericht (HH6) und Eigennutzer-App (II6)
```js
var r = DpFoerderung.passend({
  nutzung: 'eigen', kauf: true, neubau: false,
  baujahr: 1975, energieklasse: 'G', kinder: 1,
  haushaltseinkommen: 80000, einkommen_zve: 45000, erste_immobilie: true,
  massnahmen: ['heizung'], heizung_art: 'oel', stichtag: '2026-11-26'
}, window.DpFoerderregister);
// r.liste → KfW 124, KfW 308 (bis 140.000 €), KfW 458 Selbstnutzer (≈ 70 %), KfW 358
```
Im Bericht je Eintrag: Name, `warum`, `betrag`, `antrag`, `pruefen`, Link, dazu `r.hinweis` und „Stand“ aus `r.stand`. Skripte: `js/data/foerderregister.js?v=v5120` vor `js/foerderung.js?v=v5120`. Im Backend (PDF-Dienst) Kern per vm laden wie im Prüfer, falls serverseitig nötig (Spiegel nur, wenn ein Backend-Pfad ihn braucht).

## Wächter für Programmänderungen (nur notiert, nicht gebaut)
Der Mietspiegel-Wächter (`MietspiegelWaechterService`, Takt, Hash der Quellseite, Meldung in Admin › Betrieb) lässt sich übertragen: je Programm-URL ein Hash des Abschnitts „Das Wichtigste in Kürze“ und „Wen fördern wir?“, monatlich, gelb bei Änderung. Bis dahin erinnert das Jahreswerte-Register (fällig 26.12.2026).

## Beobachtungen der Recherche (26.11.2026)
- KfW 458: Für 1. Quartal 2027 ist ein „Wertschöpfungsbonus“ angekündigt, Grundförderung für Wärmepumpen aus Nicht-EU-Herstellung könnte auf 15 % sinken. Klimageschwindigkeitsbonus sinkt ab 1.2.2027.
- BAFA: eigene Seite „Für Anträge bis 20.07.2026“ zeigt einen Regelwechsel zum 21.07.2026. Aktuelle Seite Gebäudehülle: Grundfördersatz 15 %, iSFP +5 %, förderfähig 30.000 € (mit iSFP 60.000 €) für die 1. WE.
- KfW 308: Sanierungsfrist nach dem Kauf auf der Produktseite nicht gefunden, im Register als „bitte prüfen“.
- KfW-Zinsen werden nicht übernommen (Impressum), nur Konditionenanzeiger verlinkt.
