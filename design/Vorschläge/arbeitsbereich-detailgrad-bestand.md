# Arbeitsbereich · Detailgrad — Bestand und Zuordnung (Entwurf)

Stand 02.11.2026 · nur gemessen, nichts in `frontend/` oder `backend/` geändert ·
Demo: `design/Vorschläge/arbeitsbereich-detailgrad-demo.html`

Anlass: Marcel 02.11.2026 — „Ich wollte den Arbeitsbereich und Detailgrad der
einzelnen Tabs im Arbeitsbereich vereinfacht haben." Der erste Entwurf
(`detailstufen-demo.html`, eigenes Formular mit Flugnamen) ging daran vorbei.
Dieser Entwurf nimmt den **echten** Arbeitsbereich: dieselben neun Reiter, dieselben
Karten, und ein Schalter **Einfach · Standard · Profi** blendet Karten und Felder
ein oder aus.

## So wurde gemessen

- `frontend/index.html` (4.372 Zeilen) mit einem Tag-Zähler gelesen (Kommentare,
  `<script>` und `<style>` vorher geleert, Zeilennummern bleiben). Je Abschnitt
  `div.sec#sX` jede `div.card` mit Titel aus der ersten `.ct`, Eingabefelder =
  `input/select/textarea` ohne `type=hidden`, und ob ein Vorfahr
  `data-oe-stufe-min` / `data-oe-detail` trägt.
- Gegenprobe: Felder je Abschnitt per `grep` gezählt — stimmt mit der Summe der
  Karten überein (s0: 123 in Karten + 1 im Kopf = 124).
- Karten, die JS nachträglich einhängt: `grep` nach `className = 'card'` und nach
  Zugriffen auf `#s0 … #s8`. Gefunden: `potenzial.js:324` (Mietrecht, s2),
  `potenzial.js:2090` (Wertpotenzial, s6), `wert-zielbild.js:771` (Wert & Zielbild,
  s6), `deal-action.js:591` + `deal-action-boarding.js:91` (ganzer Reiter s8).
  `afa-eigen.js:26` hängt ein Feld `afa_eigen` an den AfA-Satz (nicht mitgezählt).
- Die Zahlen im Entwurf stehen als Daten in der HTML-Datei; ein Prüflauf hat sie
  gegen diese Messung gelegt — Profi = heute, in jedem Reiter gleich.

## 1 · Bestand je Reiter

Spalte **Stufe heute**: `detail=1` = hängt am Haken „weitere Objektdetails"
(`oe-details-cb`), `min=3` = nur bei Eingabetiefe 3. **Vorgabe bei leer** sagt,
womit gerechnet wird, wenn der Nutzer nichts einträgt — davon hängt ab, was man
ausblenden darf.

Vorgaben-Quellen: `main.js:98 setDefaults()` (neues Objekt) ·
`config.js:1045 investmentProfileDefaults` · `investment-profile.js:125`
(`setIfEmpty`) · `bwk-profil.js` (BWK je Objektart) · `dealscore2.js:164`
(fehlende Score-Kategorie = neutral 60).

### s0 Objekt — 8 Karten, 124 Felder

| Karte | Datei:Zeile | Felder | Stufe heute | Vorgabe bei leer |
|---|---|---:|---|---|
| (Kopf) Haken „weitere Objektdetails" | index.html:1050 | 1 | — | Merker `dp_details` |
| Objektdaten | index.html:1087 | 33 | — | keine. Pflicht nach `pflichtFuer()` (`objekt-reiter.js:633`): Stufe 1 = plz, ort, str, objart, wfl, baujahr |
| Automatisch ermittelt (BRW, Stichtag, Ausstattung) | index.html:1142 | 3 | — | automatisch (BORIS) |
| Gewerke & Ausstattung | index.html:1267 | 23 | detail=1 | Score-Merkmal „Qualität" fehlt → neutral |
| Bauteile & Grundstück | index.html:1282 | 21 | detail=1 | keine; nur Marktbericht-Verfeinerung |
| Lage & Einschätzung | index.html:1330 | 11 | — („immer sichtbar") | Score-Merkmale Lage/Markt → neutral 60 |
| Objektfotos | index.html:1422 | 1 | — | PDF ohne Fotos |
| Sonstige Bemerkungen | index.html:1433 | 1 | — | — |
| Sach- und Ertragswert · Stufe 3 | index.html:1456 | 30 | min=3 | Ansätze der Anlage 3 (`objekt-reiter.js:676`, „optional"-Schild) |

### s1 Investition — 4 Karten, 50 Felder

| Karte | Datei:Zeile | Felder | Stufe heute | Vorgabe bei leer |
|---|---|---:|---|---|
| Kaufpreis & Nebenkosten | index.html:1600 | 11 | — | 5 Sätze aus Profil: GrESt nach Bundesland, Notar 1,70, Grundbuch 0,50, Makler 3,57, Sonstige 1,50 % (`main.js:105-125`). **Kaufpreis selbst: keine** |
| Sanierung | index.html:1640 | 22 | — | 0 € |
| Inventar | index.html:1762 | 10 | — | 0 € |
| Mieterhöhung und Zielbild („optional") | index.html:1854 | 7 | — | kein Zielbild |

### s2 Miete — 5 Karten (+1 JS), 23 Felder

| Karte | Datei:Zeile | Felder | Stufe heute | Vorgabe bei leer |
|---|---|---:|---|---|
| Mietstruktur | index.html:1909 | 3 | — | **NKM: keine** · ZE/Umlagen 0 |
| Mietpreis-Analyse | index.html:1918 | 2 | — | Score neutral |
| Mietvertrag für dieses Objekt | index.html:1971 | 7 | — | — |
| Mietrecht an dieser Adresse (JS, 0 Felder) | potenzial.js:324 | 0 | — | aus Landesverordnungen |
| Mietentwicklung · Prognose | index.html:1992 | 6 | — | Mietsteigerung aus Profil 1,5 % |
| Prognose-Annahmen | index.html:2057 | 5 | — | Wertsteigerung 1,5 · Leerstand 2 · Kostensteigerung 1,0 · Betrachtung 15 J. · Exit 5,0 |

### s3 Finanzierung — 9 Karten, 39 Felder

| Karte | Datei:Zeile | Felder | Stufe heute | Vorgabe bei leer |
|---|---|---:|---|---|
| Empfohlen für Ihr Objekt (Zinsen kompakt) | index.html:2425 | 0 | — | — |
| Markt-Kontext (EZB & Geldmarkt) | index.html:2463 | 0 | — | — |
| Aktuelle Marktzinsen (Bundesbank) | index.html:2507 | 0 | — | — |
| Indikative Konditionen nach Zinsbindung | index.html:2595 | 0 | — | — |
| Darlehen I – Hauptdarlehen | index.html:2694 | 16 | — | Zins indikativ (`getZins()`), Tilgung 1,5, Bindung 10, Anschluss 5,0/1,0/15. EK aus Quote 10 % **nur wenn KP beim Anlegen schon steht** (`investment-profile.js:142`). **Darlehensbetrag `d1`: keine** — siehe Befund A |
| Bausparvertrag (nur bei Darlehensart Bauspar) | index.html:2821 | 9 | `display:none` | — |
| Darlehen II – Zusatzdarlehen | index.html:2876 | 14 | — | aus |
| Finanzierungsübersicht | index.html:2951 | 0 | — | — |
| Bankargumente | index.html:2977 | 0 | — | — |

### s4 Bewirtschaftung — 7 Karten, 19 Felder

| Karte | Datei:Zeile | Felder | Stufe heute | Vorgabe bei leer |
|---|---|---:|---|---|
| Eingabe-Modus | index.html:2997 | 0 | — | Modus aus Profil (`main.js` `bwk_modus_default`) |
| BWK – Quick-Eingabe | index.html:3013 | 3 | — | 17 % / 16 % NKM aus Profil |
| Berechnete BWK | index.html:3081 | 0 | — | Euro je Objektart (`bwk-profil.js`, Anlage 3 × 1,60) |
| Umlagefähige Kosten / Jahr | index.html:3101 | 3 | — | aus Profil |
| Nicht umlagefähige Kosten / Jahr | index.html:3107 | 5 | — | Mietausfall 1 % NKM (`main.js:137`) |
| BWK Zusammenfassung | index.html:3121 | 0 | — | — |
| Detailpositionen (optional) | index.html:3129 | 8 | — | 0 |

### s3-tax Steuer — 7 Karten (1 verborgen), 14 Felder

| Karte | Datei:Zeile | Felder | Stufe heute | Vorgabe bei leer |
|---|---|---:|---|---|
| Hinweis Progression (`hidden`, bei Bedarf) | index.html:2098 | 0 | — | — |
| Was mit diesen Werten passiert | index.html:2106 | 0 | — | — |
| Persönliche Steuer | index.html:2158 | 5 | — | Grenzsteuersatz 40,45 % oder aus hinterlegtem zvE (`main.js` v-zvE-Block) |
| AfA-Konfiguration | index.html:2199 | 7 | — | AfA 2,0 % (erste Option, **nicht nach Baujahr**), Gebäudeanteil 80 % |
| Steuer-Modul · Echte Progression 2026 | index.html:2349 | 0 | — | — |
| Steuerverlauf | index.html:2368 | 0 | — | — |
| Steuerformular pro Jahr | index.html:2379 | 2 | — | — |

### s5 Pilot-Analyse — keine `.card`, 19 Felder

| Block | Datei:Zeile | Felder | Stufe heute | Vorgabe bei leer |
|---|---|---:|---|---|
| `.ai-box` Investment-Analyse (Knopf, Kontingent) | index.html:3166 | 0 | — | — |
| Pilot-Analyse im PDF | index.html:3183 | 1 | — | Vorgabe aus Einstellungen › PDF-Export |
| Bausteine im PDF (`<details>`) | index.html:3190 | 18 | — | alle an |
| Ankauf · Bestand · Zielbild, Umschalter **Einfach \| Genau** | wert-zielbild.js:564 | 0 | eigener Umschalter | — |

### s6 Bewertung — 13 Karten (+2 JS), 0 Felder

| Karte | Datei:Zeile | Hinweis |
|---|---|---|
| DealPilot Score (zugeklappt) | index.html:3228 | KPI-Score, rechnet aus Kaufpreis/Miete/Finanzierung |
| Investor Deal Score | index.html:3250 | 17 Merkmale; fehlende Kategorie neutral 60 (`dealscore2.js:651-674`) |
| Investor-Score Zusatzangaben | index.html:3265 | von `dpsh-score-hero.js` ausgeblendet |
| Kennzahlen-Bewertung | index.html:3279 | |
| AVM-Verlauf (Host) | index.html:3293 | |
| Pilot-Kurzfazit | index.html:3296 | `display:none` bis Analyse |
| Cashflow – Korrekte Berechnung | index.html:3347 | |
| Alle Kennzahlen | index.html:3384 | |
| Bausparvertrag · Lebenszyklus | index.html:3400 | `display:none` ohne BSV |
| Vermögenszuwachs · 10 Jahre | index.html:3416 | |
| Zinsänderungsrisiko · Detail | index.html:3471 | |
| Kennzahlen-Vergleich · Heute · Ende Zinsbindung · Anschluss | index.html:3522 | |
| Cashflow-Projektion | index.html:3569 | |
| Wert & Zielbild (JS) | wert-zielbild.js:771 | vor Vermögenszuwachs eingehängt |
| Wertpotenzial (JS) | potenzial.js:2090 | Detail in „Wert & Zielbild" |

### s8 Deal-Aktion — ganz aus JS, 0 Felder

`deal-action.js:591 renderTab()` → `deal-action-boarding.js:91 buildTop()`:
Bereit für die Bank (Readiness) · Dokumente & Exporte (Investment-PDF, Finanzamt,
Kaufpreisaufteilung, Track Record; Z. 126) · Marktberichte (Z. 136) · Bordkarte &
Unterlagen (Z. 140) · Dein Netzwerk (Z. 171) · In Gesellschaft überführen
(`deal-action.js:612`).

### Summe heute

| Reiter | Karten | Felder |
|---|---:|---:|
| Objekt | 8 | 124 |
| Investition | 4 | 50 |
| Miete | 5 (+1 JS) | 23 |
| Finanzierung | 9 | 39 |
| Bewirtschaftung | 7 | 19 |
| Steuer | 7 | 14 |
| Pilot-Analyse | 0 (ai-box) | 19 |
| Bewertung | 13 (+2 JS) | 0 |
| Deal-Aktion | JS | 0 |
| **Summe** | | **288** |

### Vorhandene Mechanik

- **Eingabetiefe 1/2/3** nur im Reiter Objekt: `objekt-reiter.js:633-760`, Merker
  `dp_zielstufe` **je Nutzer**, Pillen im Pre-Flight (`objekt-reiter.js:878`),
  Namen dort „Einfach · Mittel · Ausgiebig". Blendet nur zwei Dinge: alle
  `[data-oe-stufe-min="3"]` (eine Karte) und über den Haken die zwei
  `data-oe-detail`-Karten. **Kein anderer Reiter trägt eine Stufenmarke.**
- Die Stufen sind zugleich die **Marktbericht-Stufen** (`pflichtFuer()`; Stufe 3 =
  Sach-/Ertragswert) und zählen in „Bereit für die Bank" mit
  (`deal-action-readycheck.js:200`).
- **Einfach | Genau** gibt es zweimal, beide nur Anzeige: Pilot-Analyse
  (`wert-zielbild.js:564`) und Portfolio-Cockpit (`dashboard.js:1135`).

### Befunde, die vor dem Bau gelöst sein müssen

- **A · Darlehensbetrag.** Im Hauptformular leitet niemand `d1` ab —
  `setDefaults()` lässt ihn leer, nur `loadExample()` setzt 200.000. Der Quick-Check
  rechnet ihn (`quick-check.js:1978`: Kaufpreis × (1 + NK %) − EK). Ohne diese
  Ableitung gibt es in „Einfach" keine Rate, keinen Cashflow, keinen DSCR.
- **B · Eigenkapital.** Die 10-%-Quote greift nur, wenn beim Anlegen schon ein
  Kaufpreis steht (`investment-profile.js:142`). In „Einfach" muss sie dem
  Kaufpreis folgen, solange der Nutzer kein eigenes EK einträgt.
- **C · Bereitschaft.** „Bereit für die Bank" zählt immer die 17 Score-Merkmale
  (`deal-action-readycheck.js:23`). In „Einfach" stünde dort dauerhaft „nicht
  bereit", obwohl Score und PDF entstehen — die Zählung muss der Stufe folgen.
- **D · AfA-Vorgabe** ist 2,0 % unabhängig vom Baujahr. Für Baujahr < 1925 wären es
  2,5 %, ab 2023 3,0 %. Wer in „Einfach" die AfA nicht sieht, sieht den Fehler nicht.

## 2 · Zuordnung je Stufe (Vorschlag)

Gezählt aus den Daten der Demo: **Einfach 20 · Standard 96 · Profi 287 Felder**
(Profi = heute ohne den Haken, der im Schalter aufgeht). Pflicht: 8 · 13 · 17.

| Reiter | Einfach (Felder) | dazu in Standard | dazu in Profi |
|---|---|---|---|
| **Objekt** | Objektdaten: Adresse, Objektart, Wohnfläche, Baujahr · Automatisch ermittelt · Lage: Makro/Mikro · Fotos — **4 Karten, 13** | Objektdaten: Nutzungsart, Zimmer, Etage, Zustand, Standardstufe, Energie, Grundstück, MEA, Kaufdatum … · **Gewerke & Ausstattung** · Lage voll · Bemerkungen — **6 Karten, 57** | Bauteile & Grundstück · Sach- und Ertragswert · These/Risiken/Exit · Überführung — **8 Karten, 123** |
| **Investition** | Kaufpreis (NK-Sätze nur als Zeile „aus Einstellungen") — **1 Karte, 1** | 5 NK-Sätze · Sanierung gesamt · Inventar gesamt — **3, 10** | NK in € · Sanierung je Gewerk · Inventar im Detail · Mieterhöhung und Zielbild — **4, 50** |
| **Miete** | Nettokaltmiete — **1, 1** | ZE, Umlagen · Mietpreis-Analyse · Mietrecht · Mietsteigerung · Wertsteigerung, Leerstand — **5, 8** | Mietvertrag · Staffel/Index · Kosten-/Exit-Annahmen — **6, 23** |
| **Finanzierung** | Zinsen kompakt · Darlehen I: EK, Zins, Tilgung (alle vorbelegt), Darlehen **abgeleitet** · Übersicht — **3, 3** | Darlehensbetrag, Bindung, Art · Konditionen · Bankargumente — **5, 8** | Bank/Vertrag · Anschluss · Bausparvertrag · Darlehen II · Markt-Kontext · Bundesbank — **9, 39** |
| **Bewirtschaftung** | nur **Berechnete BWK** (je Objektart, als Vorgabe markiert) — **1, 0** | Modus · Quick-Eingabe % · Hausgeld, Grundsteuer, WEG-Rücklage, Mietausfall · Zusammenfassung — **6, 7** | Sonstige · eigene Rücklage · Detailpositionen — **7, 19** |
| **Steuer** | Grenzsteuersatz (vorbelegt) · Steuerverlauf — **2, 1** | zvE + Automatik · AfA-Satz, Gebäudeanteil · Erklärung · Steuer-Modul — **5, 5** | Splitting/KiSt · § 7b · Steuerformular — **6, 14** |
| **Pilot-Analyse** | Analyse-Knopf · „ins PDF" · Kernaussagen (Einfach) — **3, 1** | wie Einfach — **3, 1** | Bausteine im PDF (18) · Genau — **4, 19** |
| **Bewertung** | Score (beide) · Cashflow · Wert & Zielbild (Kernaussagen) — **3 Karten** | Kennzahlen-Bewertung · Alle Kennzahlen · Vermögenszuwachs · Cashflow-Projektion · Pilot-Kurzfazit — **8** | AVM-Verlauf · Zinsänderungsrisiko · Kennzahlen-Vergleich · Bausparvertrag · Wertpotenzial — **13** |
| **Deal-Aktion** | Bereit für die Bank · Investment-PDF · Netzwerk — **3** | Finanzamt/KPA · Marktberichte · Bordkarte — **5** | Track Record · In Gesellschaft überführen — **6** |

**Begründung.**

- **Einfach = was ein Anfänger aus dem Exposé abschreibt**: Adresse, Art, Fläche,
  Baujahr, Kaufpreis, Kaltmiete. Alles andere, was die Rechnung braucht, liegt
  schon heute als Vorgabe im Profil (Nebenkosten, Zins, Tilgung, Bindung, BWK,
  Mietausfall, Steigerungen, Grenzsteuersatz, AfA). Damit rechnen KPI-Score,
  Cashflow und Investment-PDF ohne leere Stelle — vorausgesetzt Befund A und B.
- **Standard = Marktbericht-Stufe 2**: genau die Felder aus `pflichtFuer(2)`
  (Zustand, Energie, Standardstufe, Zimmer, Etage) plus die Angaben, die ein
  Käufer mit Unterlagen kennt (Hausgeld, Grundsteuer, Darlehensbetrag).
- **Profi = heute**: nichts fällt weg; Stufe 3 bleibt die Wertermittlung.
- **Nichts geht verloren**: Hochschalten blendet Felder leer oder mit Vorgabe ein;
  Herunterschalten blendet nur aus — erfasste Werte rechnen weiter und stehen im
  Reiter als „ausgeblendet, aber erfasst". Im PDF stehen die Vorgaben als Block
  „Annahmen".

## 3 · Was Marcel entscheiden muss

1. **Ein Schalter für alles?** Der neue Schalter ersetzt die heutige Eingabetiefe
   1/2/3 (`dp_zielstufe`, Pillen „Einfach · Mittel · Ausgiebig") und den Haken
   „weitere Objektdetails" — Einfach = Marktbericht-Stufe 1, Standard = 2, Profi = 3.
   Oder bleibt die Marktbericht-Stufe ein eigener Regler?
2. **Merker je Objekt oder je Nutzer?** Heute je Nutzer. Für „ein einfach
   angelegtes Objekt später erweitern" wäre **je Objekt** (Vorgabe für neue
   Objekte aus den Einstellungen) passender.
3. **Investor Deal Score in Einfach zeigen?** In Einfach haben von 17 Merkmalen
   ~2 eine eigene Angabe, 5 eine Vorgabe, 10 rechnen neutral mit 60. Zeigen mit
   dieser Kennzeichnung (wie in der Demo) — oder in Einfach nur den DealPilot
   Score aus den Kennzahlen?
4. **Gewerke & Ausstattung (23 Felder) in Standard oder erst in Profi?** Heute
   blendet „Mittel" sie ein. In Profi wäre Standard rund 23 Felder leichter, dafür
   bleibt „Qualität" im Score bis Profi neutral.
