# Arbeitsbereich · Detailgrad — Bestand, Zuordnung, Prüfung (Entwurf)

Stand 02.11.2026, Folgeauftrag · nur gemessen, nichts in `frontend/` oder `backend/` geändert

| Datei | Inhalt |
|---|---|
| `design/Vorschläge/arbeitsbereich-detailgrad-zuordnung.json` | **die Zuordnung für den Bau**, maschinenlesbar |
| `design/Vorschläge/arbeitsbereich-detailgrad-demo.html` | der Arbeitsbereich mit Schalter **Einsteiger · Fortgeschritten · Experte** |
| diese Datei | Bestand, Prüfergebnis der Selektoren, Vorschläge zu den vier Blockern |

Anlass: Marcel 02.11.2026 — „Ich wollte den Arbeitsbereich und Detailgrad der
einzelnen Tabs im Arbeitsbereich vereinfacht haben." Im Folgeauftrag festgelegt:
die Stufen heißen **Einsteiger · Fortgeschritten · Experte** (nicht Investor/Profi —
das kollidiert mit den Plannamen), Zielgrößen ~45 / ~150 / alle, gleichmäßigere
Sprünge als im ersten Entwurf (20 / 96 / 287).

## Zurückgenommen aus dem ersten Bericht

Im ersten Bericht (heute Vormittag) standen vier „Blocker". **Drei davon sind
falsch:** ich hatte nur `setDefaults()` und `applyToNewObject()` gelesen und daraus
geschlossen, dass niemand nachzieht. Die Nachzieher laufen auf echte Eingaben und
sind längst gebaut:

| Behauptung im ersten Bericht | gemessen |
|---|---|
| „Im Hauptformular leitet niemand `d1` ab, nur der Quick-Check" | **falsch.** `financing.js:843` `dpDarlehenNachziehen()` setzt `d1` = Gesamtinvestition − EK − Darlehen II, sobald der Nutzer Kaufpreis, EK, Nebenkosten, Sanierung oder Darlehen II ändert (Auslöser `financing.js:825`), solange `d1` nicht von Hand gesetzt ist. Die Herleitung steht unter dem Feld (`#d1-herleitung`, `financing.js:856`). |
| „EK-Quote greift nur, wenn beim Anlegen schon ein Kaufpreis steht" | **falsch.** `investment-profile.js:567` `nachziehen('kp')` setzt das EK aus der Quote, sobald der Kaufpreis eingetragen wird und das EK leer ist (Listener `investment-profile.js:590`), und stößt danach das Darlehen an. Ebenso der Mietausfall bei `nkm`. |
| „AfA-Vorgabe 2,0 % unabhängig vom Baujahr" | **falsch.** `object-actions.js:2802` `dpAfaNachBaujahr()` setzt 2,5 / 2,0 / 3,0 % nach `Afa.linearNachFertigstellung()` (`afa-engine.js:288`), sobald das Baujahr von Hand geändert wird (`object-actions.js:2816`); ein von Hand gewählter Satz bleibt. |
| „Bereit für die Bank zählt immer die 17 Score-Merkmale" | **stimmt** — siehe Vorschlag C. |

Ebenfalls zurückgenommen: „Berechnete BWK zeigt die Werte je Objektart aus
`bwk-profil.js`". Die Karte gehört zum **Prozent-Modus** (`#bwk-percent-mode`,
index.html:3016) und rechnet die Prozentsätze um. Die Werte je Objektart schreibt
`bwk-profil.js` in `hg_ul`, `hg_nul`, `eigen_r` (Modus „Detailliert",
`#bwk-detail-mode`, index.html:3104), sobald Objektart oder Wohnfläche eingetragen
werden (`bwk-profil.js:169` `einsetzen()`, nur in leere Felder).

## 1 · Bestand je Reiter (Zeilen Stand nach v3067)

Gemessen mit einem Tag-Zähler über `frontend/index.html` (Kommentare, `<script>`,
`<style>` geleert, Zeilen bleiben). Felder = `input/select/textarea` ohne
`type=hidden`. Seit dem Vormittag haben v3065–v3067 Zeilen ab index.html:1640 um
4–5 verschoben; die Feldzahlen sind gleich geblieben.

| Reiter | Karten (Zeilen) | Felder |
|---|---|---:|
| **s0 Objekt** | Objektdaten 1087 (33) · Automatisch ermittelt `#qz-card` 1142 (3) · Gewerke `#oe-karte-gewerke` 1267 (23, `data-oe-detail`) · Bauteile `#oe-karte-bauteile` 1282 (21, `data-oe-detail`) · Lage `#oe-karte-lage` 1330 (11) · Fotos 1422 (1) · Bemerkungen 1433 (1) · Sach-/Ertragswert 1456 (30, `data-oe-stufe-min="3"`) · Haken `#oe-details-cb` im Kopf 1050 (1) | 124 |
| **s1 Investition** | Kaufpreis & Nebenkosten 1600 (11) · Sanierung 1640 (22, Kacheln in `#sanbedarf_body` 1649) · Inventar 1766 (10) · Mieterhöhung und Zielbild `#zb-karte` 1858 (7; Mietleiter `#zb-leiter` aus `potenzial.js:335`) | 50 |
| **s2 Miete** | Mietstruktur 1914 (3) · Mietpreis-Analyse 1923 (2) · Mietvertrag `#mv-objekt-karte` 1976 (7) · Mietrecht `#dp-mietrecht-karte` aus `potenzial.js:481` (0) · Mietentwicklung 1997 (6) · Prognose-Annahmen 2062 (5) | 23 |
| **s3 Finanzierung** | Zinsen kompakt `#v10-zins-compact` 2430 · Markt-Kontext 2468 · Marktzinsen 2512 · Konditionen 2600 (alle 0) · Darlehen I 2699 (16) · Bausparvertrag `#bspar_card` 2826 (9) · Darlehen II 2881 (14) · Finanzierungsübersicht 2956 · Bankargumente 2982 (0) | 39 |
| **s4 Bewirtschaftung** | Eingabe-Modus 3002 (0) · **Modus %** `#bwk-percent-mode` 3016: Quick-Eingabe 3018 (3), Berechnete BWK 3086 (0) · **Modus Detailliert** `#bwk-detail-mode` 3104: Umlagefähige 3106 (3), Nicht umlagefähige 3112 (5) · Zusammenfassung 3126 (0) · Detailpositionen 3134 (8) | 19 |
| **s3-tax Steuer** | Hinweis `#prog-hinweis` 2103 (hidden) · `#tax-flow-hint` 2111 · `#tax-personal-card` 2163 (5) · AfA 2204 (7) · Steuer-Modul 2354 · `#tax-timeline-card` 2373 · Steuerformular 2384 (2) | 14 |
| **s5 Pilot-Analyse** | `.ai-box` 3157 · `#ai-in-pdf` 3174 (1) · `#ai-pdf-sections` 3181 (18) · Einfach\|Genau `wert-zielbild.js:564` | 19 |
| **s6 Bewertung** | `#dealscore-card` 3233 · `#dealscore2-card` 3255 · `#ds2-readonly-card` 3270 (ausgeblendet) · `#kpi-eval-card` 3284 · `#avm-history-host` 3298 · `#ai-mini-card` 3301 · Cashflow 3352 · Alle Kennzahlen 3389 · `#bsv-summary-card` 3405 · `#card-vermoegen-zuwachs` 3421 · Zinsänderungsrisiko 3476 · Kennzahlen-Vergleich 3527 · `#card-cashflow-projektion` 3574 · JS: `#card-wert-zielbild` `wert-zielbild.js:771`, `#card-wertpotenzial` `potenzial.js:2251` | 0 |
| **s8 Deal-Aktion** | ganz aus JS (`deal-action.js:591`): `#dab-cockpit` 116 · `#dab-smart` 127 · `#dab-mb-host` 137 · `#dab-dr-host` 168 · `#dab-rails-host` 172 (`deal-action-boarding.js`) · `#dpuew-stage` `deal-action.js:609` | 0 |
| **Summe** | | **288** |

**Vorhandene Mechanik:** Eingabetiefe 1/2/3 nur im Reiter Objekt
(`objekt-reiter.js:633-760`, Merker `dp_zielstufe` je Nutzer, Pillen im Pre-Flight
`objekt-reiter.js:878`, Namen „Einfach · Mittel · Ausgiebig"), dazu der Haken
`#oe-details-cb`. Einfach | Genau als reine Anzeige in Pilot-Analyse
(`wert-zielbild.js:564`) und Portfolio-Cockpit (`dashboard.js:1135`).

**Was bei leerem Feld rechnet** (Grundlage dafür, was ausgeblendet werden darf):
Nebenkosten-Sätze, Zins, Tilgung, Bindung, Steigerungen, Leerstand, Exit,
Gebäudeanteil, Grenzsteuersatz (`main.js:98 setDefaults()`), EK und Mietausfall
(`investment-profile.js:567`), Darlehen (`financing.js:843`), Hausgeld/Rücklage je
Objektart (`bwk-profil.js:169`), AfA nach Baujahr (`object-actions.js:2802`),
fehlende Score-Kategorie neutral 60 (`dealscore2.js:164`), Sach-/Ertragswert mit
Anlage-3-Ansätzen (`objekt-reiter.js:676`).

## 2 · Zuordnung (Kurzfassung der JSON)

Gezählt von `pruef.mjs` aus der JSON gegen index.html — die Demo zählt dasselbe.

| Reiter | Einsteiger | + dazu | = Fortgeschritten | Experte |
|---|---:|---:|---:|---:|
| s0 Objekt | 22 | 35 | 57 | 124 |
| s1 Investition | 6 | 30 | 36 | 50 |
| s2 Miete | 6 | 12 | 18 | 23 |
| s3 Finanzierung | 5 | 22 | 27 | 39 |
| s4 Bewirtschaftung | 4 | 6 | 10 | 19 |
| s3-tax Steuer | 1 | 4 | 5 | 14 |
| s5 Pilot-Analyse | 1 | 0 | 1 | 19 |
| s6 Bewertung | 0 (5 Karten) | 0 (+4) | 0 (9) | 0 (alle) |
| s8 Deal-Aktion | 0 (3 Blöcke) | 0 (+2) | 0 (5) | 0 (alle) |
| **Summe** | **45** | **109** | **154** | **288** |

Sprünge: +109, +134 (vorher +76, +191). Experte = 288 mit dem Haken
`#oe-details-cb`, der im neuen Schalter aufgeht (Demo zählt 287).

- **Einsteiger (45):** Adresse, Objektart, Wohnfläche, Baujahr, Zimmer, Etage,
  Einheiten, Zustand, Energie, Kaufdatum · BRW automatisch · Lageklasse, Makro-,
  Mikrolage, Wertangabe · Fotos · Kaufpreis + 5 NK-Sätze (vorbelegt) · NKM, ZE,
  Umlagen, Miet-/Wertsteigerung, Leerstand (vorbelegt) · EK, Darlehen, Zins,
  Tilgung, Bindung (vorbelegt bzw. nachgezogen) · Hausgeld ul/nul, Grundsteuer,
  Mietausfall im Modus „Detailliert" · Grenzsteuersatz · „Analyse ins PDF".
  Damit rechnen Cashflow, DSCR, KPI-Score und Investment-PDF mit echten Zahlen;
  Zimmer, Etage, Zustand, Energie decken zugleich die Marktbericht-Stufe 1/2-Pflicht
  (`pflichtFuer(2)`) bis auf die Standardstufe.
- **Fortgeschritten (+109):** Standardstufe, Nutzungsart, Grundstück, MEA ·
  Gewerke (23) · Lage-Merkmale · Sanierung mit FESH-Kacheln `#sanbedarf_body` (22) ·
  Inventar gesamt · Zielbild-Karte `#zb-karte` mit Mietleiter `#zb-leiter` (7) ·
  Mietpreis-Analyse · Mietvertrag `#mv-objekt-karte` (7) · Mietrecht
  `#dp-mietrecht-karte` · Kosten-/Exit-Annahmen · Darlehensart, Bank, Anschluss ·
  Darlehen II (14) · BWK-Modus % und Rücklagen · zvE, AfA-Satz, Gebäudeanteil ·
  Marktberichte, Bordkarte. Das ist Marktbericht-Stufe 2 vollständig.
- **Experte:** alles Übrige — Bauteile & Grundstück, Sach-/Ertragswert (Stufe 3),
  Überführung, NK in €, Inventar im Detail, Staffel/Index, Bausparvertrag,
  Vertragsdaten, Markt-Kontext, Detailpositionen, Splitting/KiSt, § 7b,
  Steuerformular, PDF-Bausteine, Track Record, In Gesellschaft überführen.

## 3 · Prüfergebnis der Selektoren

Skript: `pruef.mjs` (Scratchpad) liest index.html mit demselben Tag-Zähler und
prüft je Eintrag der JSON: `#id` existiert; bei `art: karte` ist es eine `.card`;
bei `art: kind` liegt es in einer `.card` desselben Reiters; bei `art: block` reicht
die Existenz; fehlt die id in index.html, muss sie in genau dem genannten JS-Modul
als `id="…"` oder `.id = '…'` stehen. Je Feld: ist ein Eingabefeld im genannten
Reiter, kommt nur einmal vor.

**Ergebnis: 51 Karten-/Block-Selektoren, 154 Feld-ids — 0 Fehler.**
Ein Selektor braucht eine Nummer: `#s4 .bwk-mode-btns` trifft zweimal, Treffer 0 ist
die Karte Eingabe-Modus — beim Bau besser eine id vergeben.

| Reiter | Stufe | Karte | Selektor | Art | Fundstelle | Prüfung |
|---|---|---|---|---|---|---|
| s0 | einsteiger | Objektdaten | `#plz` | kind | index.html:1088 → Karte index.html:1087 | ok |
| s0 | einsteiger | Automatisch ermittelt | `#qz-card` | karte | index.html:1142 | ok |
| s0 | einsteiger | Lage & Einschätzung | `#oe-karte-lage` | karte | index.html:1330 | ok |
| s0 | einsteiger | Objektfotos | `#img-inp` | kind | index.html:1424 → Karte index.html:1422 | ok |
| s0 | fortgeschritten | Gewerke & Ausstattung | `#oe-karte-gewerke` | karte | index.html:1267 | ok |
| s0 | fortgeschritten | Sonstige Bemerkungen | `#notizen` | kind | index.html:1434 → Karte index.html:1433 | ok |
| s1 | einsteiger | Kaufpreis & Nebenkosten | `#kp` | kind | index.html:1601 → Karte index.html:1600 | ok |
| s1 | fortgeschritten | Sanierung | `#sanbedarf_toggle` | kind | index.html:1645 → Karte index.html:1640 | ok |
| s1 | fortgeschritten | Sanierung · FESH-Kacheln | `#sanbedarf_body` | block | index.html:1649 | ok |
| s1 | fortgeschritten | Inventar | `#moebl` | kind | index.html:1778 → Karte index.html:1766 | ok |
| s1 | fortgeschritten | Mieterhöhung und Zielbild | `#zb-karte` | karte | index.html:1858 | ok |
| s1 | fortgeschritten | Mietleiter ETW/EFH/ZFH (in der Zielbild-Karte) | `#zb-leiter` | block | potenzial.js:335 (JS) | ok |
| s2 | einsteiger | Mietstruktur | `#nkm` | kind | index.html:1915 → Karte index.html:1914 | ok |
| s2 | einsteiger | Mietentwicklung · Prognose | `#mietstg` | kind | index.html:2032 → Karte index.html:1997 | ok |
| s2 | einsteiger | Prognose-Annahmen | `#wertstg` | kind | index.html:2063 → Karte index.html:2062 | ok |
| s2 | fortgeschritten | Mietpreis-Analyse | `#ds2_marktmiete` | kind | index.html:1934 → Karte index.html:1923 | ok |
| s2 | fortgeschritten | Mietvertrag für dieses Objekt | `#mv-objekt-karte` | karte | index.html:1976 | ok |
| s2 | fortgeschritten | Mietrecht an dieser Adresse | `#dp-mietrecht-karte` | karte | potenzial.js:481 (JS) | ok |
| s3 | einsteiger | Empfohlen für Ihr Objekt (Zinsen kompakt) | `#v10-zins-compact` | karte | index.html:2430 | ok |
| s3 | einsteiger | Darlehen I – Hauptdarlehen | `#d1` | kind | index.html:2753 → Karte index.html:2699 | ok |
| s3 | einsteiger | Finanzierungsübersicht | `#ltv-explanation` | kind | index.html:2965 → Karte index.html:2960 | ok |
| s3 | fortgeschritten | Indikative Konditionen nach Zinsbindung | `#mr-pf-grid` | kind | index.html:2634 → Karte index.html:2600 | ok |
| s3 | fortgeschritten | Darlehen II – Zusatzdarlehen | `#d2` | kind | index.html:2905 → Karte index.html:2881 | ok |
| s3 | fortgeschritten | Bankargumente | `#bi-dscr` | kind | index.html:2988 → Karte index.html:2986 | ok |
| s4 | einsteiger | Umlagefähige Kosten / Jahr | `#hg_ul` | kind | index.html:3111 → Karte index.html:3110 | ok |
| s4 | einsteiger | Nicht umlagefähige Kosten / Jahr | `#hg_nul` | kind | index.html:3117 → Karte index.html:3116 | ok |
| s4 | einsteiger | BWK Zusammenfassung | `#r-bwk` | kind | index.html:3134 → Karte index.html:3130 | ok |
| s4 | fortgeschritten | Eingabe-Modus (Detailliert | % der NKM) | `#s4 .bwk-mode-btns` | kind | index.html:3012 (Treffer 0 von 2) → Karte index.html:3006 | ok |
| s4 | fortgeschritten | Prozent-Modus: BWK – Quick-Eingabe + Berechnete BWK | `#bwk-percent-mode` | block | index.html:3020 | ok |
| s4 | fortgeschritten | BWK – Quick-Eingabe | `#bwk_ul_pct` | kind | index.html:3034 → Karte index.html:3022 | ok |
| s4 | fortgeschritten | Berechnete BWK | `#bwk_pct_nkm` | kind | index.html:3091 → Karte index.html:3090 | ok |
| s3-tax | einsteiger | Persönliche Steuer | `#tax-personal-card` | karte | index.html:2163 | ok |
| s3-tax | einsteiger | Steuerverlauf | `#tax-timeline-card` | karte | index.html:2373 | ok |
| s3-tax | fortgeschritten | Was mit diesen Werten passiert | `#tax-flow-hint` | karte | index.html:2111 | ok |
| s3-tax | fortgeschritten | AfA-Konfiguration | `#afa_satz` | kind | index.html:2234 → Karte index.html:2204 | ok |
| s3-tax | fortgeschritten | Steuer-Modul · Echte Progression | `#tax-result-box` | kind | index.html:2363 → Karte index.html:2354 | ok |
| s5 | einsteiger | Investment-Analyse (ai-box) | `.ai-box` | block | index.html:3161 | ok |
| s6 | einsteiger | DealPilot Score | `#dealscore-card` | karte | index.html:3237 | ok |
| s6 | einsteiger | Investor Deal Score | `#dealscore2-card` | karte | index.html:3259 | ok |
| s6 | einsteiger | Cashflow – Korrekte Berechnung | `#cr-title` | kind | index.html:3358 → Karte index.html:3356 | ok |
| s6 | einsteiger | Alle Kennzahlen | `#r-bmy` | kind | index.html:3394 → Karte index.html:3393 | ok |
| s6 | einsteiger | Wert & Zielbild | `#card-wert-zielbild` | karte | wert-zielbild.js:771 (JS) | ok |
| s6 | fortgeschritten | Kennzahlen-Bewertung | `#kpi-eval-card` | karte | index.html:3288 | ok |
| s6 | fortgeschritten | Pilot-Kurzfazit | `#ai-mini-card` | karte | index.html:3305 | ok |
| s6 | fortgeschritten | Vermögenszuwachs · 10 Jahre | `#card-vermoegen-zuwachs` | karte | index.html:3425 | ok |
| s6 | fortgeschritten | Cashflow-Projektion | `#card-cashflow-projektion` | karte | index.html:3578 | ok |
| s8 | einsteiger | Bereit für die Bank (Readiness) | `#dab-cockpit` | block | deal-action-boarding.js:116 (JS) | ok |
| s8 | einsteiger | Dokumente & Exporte (Investment-PDF) | `#dab-smart` | block | deal-action-boarding.js:127 (JS) | ok |
| s8 | einsteiger | Dein Netzwerk | `#dab-rails-host` | block | deal-action-boarding.js:172 (JS) | ok |
| s8 | fortgeschritten | Marktberichte | `#dab-mb-host` | block | deal-action-boarding.js:137 (JS) | ok |
| s8 | fortgeschritten | Bordkarte & Unterlagen | `#dab-dr-host` | block | deal-action-boarding.js:168 (JS) | ok |

## 4 · Die vier Blocker — Vorschläge (nicht gebaut)

**A · Darlehensbetrag `d1`** — schon gelöst (`financing.js:843`, siehe oben). Für
Einsteiger bleibt nur: `#d1` sichtbar lassen (die Herleitung `#d1-herleitung` steht
darunter) und **beim Ausblenden nichts tun** — der Nachzieher hört auf `document`
(`financing.js:886`), nicht auf sichtbare Felder. `quick-check.js:1978` ist **keine**
Vorlage mehr, er rechnet dasselbe ein zweites Mal; nicht kopieren.
Rest: ein per Import geschriebener Kaufpreis löst `isTrusted` nicht aus — dafür
gibt es `dpImportFolgen()` (`object-actions.js:2782`), es ruft
`nachziehen('kp')` und darüber das Darlehen.

**B · EK-Vorgabe ohne Kaufpreis** — schon gelöst (`investment-profile.js:567`).
Ohne Kaufpreis gibt es kein EK, und das ist richtig: 10 % von nichts ist keine
Zahl. Vorschlag nur für die Anzeige: in Einsteiger unter `#ek` eine Zeile
„wird 10 % vom Kaufpreis, sobald er steht" (Quote aus
`DealPilotInvestmentProfile.get('ek_quote_default')`), solange `#kp` leer ist.

**C · „Bereit für die Bank" je Stufe** — offen, der einzige echte Blocker.
`getData()` (`deal-action-readycheck.js:232`) zählt alle 17 `FIELD_TARGETS`
(Z. 23) plus `artPflichtFelder()` plus `stufenPflicht()` (Z. 180, liest
`OR.zielstufe()`). Vorschlag:
1. `fieldState()` (Z. 91) gibt `exists:false` zurück, wenn das Feld in der
   gewählten Stufe ausgeblendet ist (`el.closest('[data-dp-stufe-aus]')` o. ä.,
   je nachdem, wie der Bau ausblendet) **und** leer ist. Ein ausgeblendetes, aber
   gefülltes Feld zählt weiter mit — es rechnet ja.
2. `stufenPflicht()` liest die neue Stufe statt `dp_zielstufe`, wenn beide
   zusammengelegt werden (Entscheidung 1).
3. In den Chips „Fehlt" erscheinen ausgeblendete Score-Merkmale nicht; stattdessen
   eine Zeile „n Merkmale rechnen mit Vorgabe/neutral — genauer in Fortgeschritten".

Ergebnis in Einsteiger: 8 Pflichtfelder (plz, ort, str, objart, wfl, baujahr, kp,
nkm) plus die sichtbaren Score-Felder mit Vorgabe (Zins, Tilgung, Mietwachstum,
Leerstand, Mietausfall, Instandhaltung) — „startklar" ist erreichbar.

**D · AfA nach Baujahr** — schon gelöst (`object-actions.js:2802`). Rest: der
Nachzieher hört nur auf `change` des Baujahrs. Wird das Baujahr per Import oder
Skript gesetzt, läuft er über `dpImportFolgen()` (Z. 2797). Für Einsteiger, wo
`#afa_satz` ausgeblendet ist, gehört in die Karte Steuerverlauf ein Satz
„AfA 2,0 % nach Baujahr 1994" — damit der Satz sichtbar bleibt, auch wenn das
Feld es nicht ist.

## 5 · Was Marcel entscheiden muss

1. **Ein Schalter für alles?** Ersetzt der Schalter die Eingabetiefe 1/2/3
   (`dp_zielstufe`, Pillen „Einfach · Mittel · Ausgiebig") und den Haken
   „weitere Objektdetails" — Einsteiger = Marktbericht-Stufe 1, Fortgeschritten = 2,
   Experte = 3? Die Zuordnung ist darauf ausgelegt.
2. **Merker je Objekt oder je Nutzer?** Heute je Nutzer. „Ein einfach angelegtes
   Objekt später erweitern" spricht für je Objekt (Vorgabe für neue Objekte aus
   den Einstellungen).
3. **Investor Deal Score bei Einsteiger zeigen?** Von 17 Merkmalen haben im
   Beispiel 2 eine eigene Angabe, 6 eine Vorgabe, 9 rechnen neutral mit 60. Zeigen
   mit dieser Kennzeichnung (wie in der Demo) oder bei Einsteiger nur den
   DealPilot Score aus den Kennzahlen?
4. **Ausgeblendet, aber gefüllt** — rechnet weiter und zählt in „Bereit für die
   Bank" (Vorschlag C.1), sichtbar als Zeile „ausgeblendet, aber erfasst". Oder
   soll ein Herunterschalten diese Werte aus der Rechnung nehmen?
