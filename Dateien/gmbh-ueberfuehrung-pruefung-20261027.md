# Prüfung: Objekt in eine Gesellschaft überführen (GmbH · UG · VV-GmbH · VV-UG)

Stand 27.10.2026, Zweig `staging` (HEAD `ef329faf`). Geprüft wurde nur durch Lesen und Rechnen:
kein Code geändert, nichts committet, keine Datenbank, keine Produktion.

**Methode.** Die Rechenstellen sind **aus den echten Dateien ausgeschnitten** und in node ausgeführt
(wie die Prüfer unter `tools/`): `calc.js` Z. 895–897 (Nebenkosten), 963–1007 (Gebäude-AHK),
1260–1283 (AfA-Basis mit Überführung), 2050–2072 (`_mtx`/`_mtxYear`), 2199–2225 (Privat-Schnitt),
`mandanten.js effRate()`, `tax.js _kstMitVortrag()`, `ueberfuehrung-wizard.js _spekPruefen()` und die
Zinsformatierung Z. 346–347. Skript:
`C:\Users\ThinkPad\AppData\Local\Temp\claude\E--DealPilot-repo\c8646e43-6cce-4669-a39b-3a770a8588b1\scratchpad\gmbh\pruef.mjs`.
**Nicht im Browser nachgemessen** (Anmeldung nicht möglich). Was nur aus dem Code gelesen ist, steht
als „gelesen“ da und ist ein Staging-Abnahmepunkt.

Rechtsstand nach meinem Wissen (Stand Mitte 2026). Wo ich unsicher bin, steht es dabei.
Das ist eine Prüfung der Software, keine Steuerberatung.

---

## 1 · Inventar: was die App heute tut

### 1.1 Einstieg und Vorbedingungen
- Aufruf: Deal-Aktion „Überführung starten“ (`deal-action.js:608–615`), Rechtsklick auf die Sidebar-Karte
  (`storage.js:4983–4991`), Mandanten-Einstellungen. Modul `window.DealPilotUeberfuehrung`
  (`ueberfuehrung-wizard.js`, 402 Zeilen).
- Es muss ein Mandant mit Rechtsform `gmbh` oder `ug` existieren (`mandanten.js:16–25`,
  `isCorp()`). **„VV-GmbH“/„VV-UG“ gibt es nicht als Rechtsform** — der Unterschied vermögensverwaltend
  gegen gewerblich ist allein der Haken „erweiterte Kürzung“ am Mandanten (`mandanten.js:927`).
  Mandanten mit Steuerregime nur im Plan Pro/Partner (`mandanten.js:31–40`, `effRate()` gibt sonst `null`).
- Vorprüfung (v1234, `ueberfuehrung-wizard.js:42–68`): kein Objekt mit `obj_herkunft = ueberfuehrung`,
  kein schon eingefrorenes (`ueberf_ende`), nur Halter `privat`.

### 1.2 Eingabefelder
| Schritt | Feld (Wizard → Objektfeld) | Bedeutung laut App | Vorbelegung |
|---|---|---|---|
| 1 | `dpuew-stichtag` → `ueberf_ende`, `halter_seit`, `kaufdat`, `wirtschaftlicher_uebergang` | Stichtag Privat → Gesellschaft | leer |
| 2 | `dpuew-halter` → `halter` | Gesellschaft (Mandant) | erste GmbH/UG |
| 2 | `dpuew-vw` → `verkehrswert_ueberf` | „Verkehrswert (AfA-Basis)“ | `bankval` → `svwert` → `kp` (Z. 111) |
| 2 | `dpuew-up` → `ueberf_preis` | „Überführungspreis (GrESt)“ | leer |
| 2 | `dpuew-rs` → `ueberf_restschuld` | übernommene Restschuld | `ueberf_restschuld` → **`d1` (Anfangsbetrag)** (Z. 112) |
| 2 | `dpuew-zins` → `ueberf_rest_zins` | übernommener Zins % | leer, **auf eine Nachkommastelle gerundet** (Z. 346–347) |
| – | `gesellschafterdarlehen` | gespeichert (`storage.js:177`), im PDF gezeigt (`pdf-investment-bank.js:1105`) | **wird vom Wizard nie gefragt, rechnet nirgends** |
| Mandant | `mand-f-kst` (15,825), `mand-f-gewst` (Hebesatz, Vorgabe 0), `mand-f-kuerz` (erw. Kürzung, Vorgabe an), Eröffnungsbilanz inkl. `mand-f-gesdar` | `mandanten.js:914–938` | |

Im Wizard angezeigte Regeln (Z. 192–198): GrESt auf den Überführungspreis (§ 8 Abs. 1 GrEStG),
verdeckte Einlage = VW − Preis erhöht die AfA-Basis, Preis > VW = vGA, Hinweis § 42 AO und „BFH 2023“,
Zehnjahresfrist § 23 EStG wird aus `kaufdat` und Stichtag **als Datum** geprüft (`_spekPruefen`, Z. 230–248).

### 1.3 Was beim Klick passiert (`_execute`, Z. 316–398)
1. Privat-Objekt: `ueberf_ende = Stichtag`, speichern (eingefroren).
2. Neues Objekt = **vollständige Kopie** des Privat-Blobs (`JSON.parse(JSON.stringify(privatBlob))`, Z. 337),
   dazu `halter`, `obj_herkunft='ueberfuehrung'`, `verkehrswert_ueberf`, `ueberf_preis`, `halter_seit`,
   `kaufdat` und `wirtschaftlicher_uebergang` = Stichtag, `ueberf_restschuld`, `ueberf_rest_zins`,
   `ueberf_ende` = Stichtag, Kürzel + „ VV“, `_ueberf_link` = Privat-Schlüssel; Fotos und KI-Text mit.
   **Mitkopiert werden auch `kp`, alle Nebenkosten-Prozente (inkl. Makler), `san`, `moebl`,
   `afa_satz`, § 7b-Haken, `d2`.**
3. Rück-Link am Privat-Objekt per `PUT /objects/:id` (`_ueberf_link = GmbH-Schlüssel`), nie auf sich selbst (v1236).
4. Aufheben: `mandanten.js` „Überführung aufheben“ (löscht das Gesellschaftsobjekt, taut das Privatobjekt auf).

Verknüpfung am Beispiel: `2026-1002` (privat, gekauft 07.07.2024, `ueberf_ende 2026-01-01`,
`_ueberf_link → 2026-1007`) ↔ `2026-1007` (Halter UG/GmbH, `obj_herkunft=ueberfuehrung`,
`halter_seit 2026-01-01`, `_ueberf_link → 2026-1002`) (Journal `claude/projektanweisung-hauptapp.md:7736`).

### 1.4 Rechenschritte
| Was | Wo | Wie |
|---|---|---|
| Nebenkosten / GrESt Gesellschaftsobjekt | `calc.js:896–897` | `kp × gest_p` usw. — **alter Kaufpreis, alte Sätze** |
| AfA-Basis Gesellschaft | `calc.js:1260–1283` | alte Gebäude-AHK (inkl. alter NK) × `verkehrswert_ueberf / kp` |
| AfA-Satz, degressiv, § 7b | `calc.js:1285–1310` | aus dem kopierten Privatobjekt |
| 15-%-Grenze anschaffungsnahe HK | `calc.js:1008` | auf den **alten, unskalierten** Gebäude-AHK |
| Darlehen | `calc.js:1518–1528` | `d1 := ueberf_restschuld`, `d1z := ueberf_rest_zins`; `d2` bleibt alt |
| Steuersatz Gesellschaft | `mandanten.js:353–364` | KSt+Soli (15,825 %) + (erw. Kürzung ? 0 : 3,5 % × Hebesatz) |
| Steuer je Jahr (Projektion, Kennzahlen) | `calc.js:2050–2072`, 2107, 2348, 3289, 3447, 3494 | `max(0, Ergebnis) × Satz`; im Stichtagsjahr Anteil Privat (ESt) + Anteil GmbH; **kein Verlustvortrag** |
| Steuer-Reiter Gesellschaft | `tax.js:860–925`, `_kstMitVortrag` 1561 | KSt mit Verlustvortrag (§ 10d-Mindestbesteuerung 70 % 2024–27) je Objekt und über alle Objekte des Halters |
| Zweite Ebene Ausschüttung | `tax.js:940–985` | volle Ausschüttung × 26,375 %, Hinweis Teileinkünfteverfahren § 32d Abs. 2 Nr. 3 |
| Privat-Schnitt im Stichtagsjahr | `calc.js:2199–2225`, 2290 | Laufzeit auf Stichtagsjahr gekappt, letztes Jahr × **Monat/12** (nur Vermögens-/CF-Schleife) |
| Jahresabschluss (Bilanz/GuV) | `gesellschaft-abschluss.js` | AK = Verkehrswert, Gebäudeanteil, kum. AfA, Restschuld aus **`d1`** (Annuität), Steuer = `effRate × max(0, Ergebnis)`, kein Verlustvortrag (Z. 414–426) |

### 1.5 Ausgaben
- Investment-/Bank-PDF: Block „Überführung“ mit Verkehrswert (AfA-Basis), Überführungspreis (Basis GrESt),
  Restschuld, Gesellschafterdarlehen (`pdf-investment-bank.js:1099–1105`).
- Steuer-Mappe / Werbungskosten-PDF: Vermerk Überführung, Hinweis Wechseljahr (`werbungskosten-pdf.js:751–790`).
- Steuer-Reiter: KSt-Regime, Mandanten-Steuerakte, zweite Steuerebene.
- Jahresabschluss-PDF je Gesellschaft (Bilanz, GuV, Anlagenspiegel).

**Nicht vorhanden:** ein Betrag für die Grunderwerbsteuer der Überführung, ein Betrag für den
Veräußerungsgewinn § 23 und die Steuer darauf, Notar/Grundbuch der Überführung, Gesellschafterdarlehen
mit Zins, Gewerbesteuer-Kürzung § 9 Nr. 1 S. 1, Prüfung der Voraussetzungen der erweiterten Kürzung.

---

## 2 · Steuerliche Prüfung je Punkt

### 2.1 Grunderwerbsteuer
- **Steuerbar:** Kaufvertrag mit der eigenen GmbH/UG (§ 1 Abs. 1 Nr. 1 GrEStG), ebenso Einbringungs-/
  Sacheinlagevertrag. Die Gesellschaft ist eigener Rechtsträger.
- **Keine Befreiung:** §§ 5, 6 GrEStG gelten nur für Personengesellschaften, nicht für Kapitalgesellschaften.
  § 3 Nr. 2 (Schenkung) greift bei einer verdeckten Einlage in die eigene GmbH regelmäßig nicht
  (keine freigebige Zuwendung an die Gesellschaft). § 6a GrEStG (Konzernumwandlung) nicht einschlägig.
- **Bemessung:**
  - Kaufvertrag: Gegenleistung (§ 8 Abs. 1, § 9 Abs. 1 Nr. 1), inkl. übernommener Schulden — die
    übernommene Restschuld ist Teil der Gegenleistung, nicht zusätzlich.
  - Einlage ohne Preis / Sacheinlage gegen Gesellschaftsanteile / Erwerb auf gesellschaftsvertraglicher
    Grundlage: **Grundbesitzwert** (§ 8 Abs. 2 S. 1 Nr. 1 bzw. Nr. 2 GrEStG i. V. m. §§ 151, 157 BewG).
  - Teilentgeltlicher Kaufvertrag (Preis < VW): nach h. M. die vereinbarte Gegenleistung. **Unsicher:**
    Das im Wizard zitierte „BFH 2023“ (Z. 197) kann ich keiner Entscheidung zuordnen — Aktenzeichen
    nachtragen oder Hinweis streichen.
- **Satz:** Landesrecht (§ 11 GrEStG i. V. m. Art. 105 Abs. 2a GG), NRW 6,5 %. Spanne bundesweit
  3,5 % (BY) bis 6,5 % — der Wizard-Text sagt das richtig.
- **App:** rechnet **keine** GrESt der Überführung. Im Gesellschaftsobjekt steht die GrESt des
  privaten Erwerbs (alter Kaufpreis × alter Satz, `calc.js:896`). Der Wizard-Text sagt „fällt auf den
  Überführungspreis“; bleibt das Feld leer (Einlage), liest der Nutzer daraus „keine GrESt“ — richtig
  wäre GrESt auf den Grundbesitzwert. → **falsche Zahl / falsche Aussage.**

### 2.2 Privates Veräußerungsgeschäft § 23 EStG
- Kauf an die eigene Gesellschaft = Veräußerung (§ 23 Abs. 1 S. 1 Nr. 1). Verdeckte Einlage in eine
  Kapitalgesellschaft gilt als Veräußerung (§ 23 Abs. 1 S. 5 Nr. 2); an die Stelle des Preises tritt der
  **gemeine Wert** (§ 23 Abs. 3 S. 2). Sacheinlage gegen Anteile ist tauschähnlich (Veräußerung zum gemeinen
  Wert der Anteile ≈ Verkehrswert).
- Teilentgeltlich (Preis < VW): Aufteilung in entgeltlichen Teil (Preis) und verdeckte Einlage
  (gemeiner Wert des Rests) — **in Summe ist der Gewinn VW − fortgeführte Anschaffungskosten**, nicht
  Preis − fortgeführte AK.
- Fortgeführte AK = AK inkl. Erwerbsnebenkosten − in Anspruch genommene AfA (§ 23 Abs. 3 S. 4).
- Freigrenze 1.000 € je Jahr ab VZ 2024 (§ 23 Abs. 3 S. 5), Frist taggenau.
- **App:** prüft die Frist taggenau und richtig (`_spekPruefen`, Z. 241–247; Fall A „steuerpflichtig“,
  Fall B „frei“). Sie **rechnet keinen Gewinn und keine Steuer**, und der Text nennt die falsche Formel
  („Überführungspreis minus fortgeführte AK“, Z. 247) — bei Preis < VW zu niedrig. → **falsche Aussage, fehlende Zahl.**
- Weitere Prüfpunkte ohne Abbildung: Drei-Objekt-Grenze (gewerblicher Grundstückshandel — die Übertragung an
  die eigene GmbH zählt als Veräußerung), Schenkungsteuer § 7 Abs. 8 ErbStG bei Preis < VW, wenn es
  Mitgesellschafter gibt.

### 2.3 AfA in der Gesellschaft
- Kauf: AK der Gesellschaft = Kaufpreis + GrESt + Notar + Grundbuch (§ 255 Abs. 1 HGB), aufgeteilt in
  Boden/Gebäude **zum Erwerbszeitpunkt der Gesellschaft** (neuer Bodenrichtwert).
- Verdeckte Einlage: Teilwert (§ 8 Abs. 1 KStG i. V. m. § 6 Abs. 1 Nr. 5 EStG); Einlage erhöht das
  Einkommen nicht (§ 8 Abs. 3 S. 3 KStG), Zugang zum steuerlichen Einlagekonto (§ 27 KStG).
  **Unsicher:** die Obergrenze „höchstens AK, wenn binnen drei Jahren angeschafft“ (§ 6 Abs. 1 Nr. 5 S. 1
  Buchst. a) — ob sie bei der verdeckten Einlage in eine Kapitalgesellschaft greift, die beim Gesellschafter
  schon nach § 23 besteuert wird, kann ich nicht sicher sagen. **Fall „Am Markt 9“ (Kauf 07/2024,
  Einlage 01/2026) liegt genau in dieser Frist** → mit dem Steuerberater klären.
- Satz: 2 % (fertiggestellt 1925–2022), 2,5 % (vor 1925), 3 % (nach 2022), § 7 Abs. 4 S. 1 Nr. 2;
  kürzere tatsächliche Nutzungsdauer per Gutachten (§ 7 Abs. 4 S. 2) möglich.
  Degressive AfA § 7 Abs. 5a und Sonder-AfA § 7b nur, wenn **bis Ende des Fertigstellungsjahres
  angeschafft** — bei einer späteren Überführung nicht mehr.
- **App:** Basis = alte Gebäude-AHK × VW/kp (`calc.js:1276–1283`). Das ist richtig, **wenn** der neue
  Nebenkostensatz zufällig dem alten gleicht und Preis = VW. Falsch wird es, sobald privat ein Makler
  bezahlt wurde (Fall A′: +3,3 %), der GrESt-Satz sich geändert hat (Fall B: 3,5 % → 6,5 %) oder
  degressiv/§ 7b privat gewählt war (wird mitkopiert, Z. 337). → **falsche Zahl in Sonderfällen.**
- 15-%-Grenze anschaffungsnahe HK (§ 6 Abs. 1 Nr. 1a): beginnt für die Gesellschaft neu (drei Jahre ab
  ihrer Anschaffung, 15 % ihrer Gebäude-AK). Die App rechnet sie auf den **alten** Gebäude-AHK
  (`calc.js:1008`) und kopiert `san` mit — eine privat schon abgezogene Sanierung kann im Gesellschafts-
  objekt **ein zweites Mal** in die Werbungskosten laufen (gelesen, Staging-Abnahmepunkt).

### 2.4 Körperschaftsteuer
- 15 % (§ 23 Abs. 1 KStG) + Soli 5,5 % darauf = 15,825 % (§§ 3, 4 SolZG). **App richtig** (`mandanten.js:359`).
- Verluste: kein Ausgleich mit privatem Einkommen, Vortrag (§ 8 Abs. 1 KStG, § 10d EStG).
  App: Steuer-Reiter **mit** Vortrag (`tax.js:1561`), Projektion/Kennzahlen **ohne** (`calc.js:2050`),
  Jahresabschluss **ohne** (`gesellschaft-abschluss.js:414–426`) → drei Zahlen für dasselbe Jahr.
- Kosten der Gesellschaft (Steuerberatung, IHK, Konto, GF) gehen nur in den Jahresabschluss ein, nicht in
  die Objektansicht.

### 2.5 Gewerbesteuer und erweiterte Kürzung
- Kapitalgesellschaft = Gewerbebetrieb kraft Rechtsform (§ 2 Abs. 2 GewStG), kein Freibetrag.
  Messzahl 3,5 % (§ 11 Abs. 2), Gewerbeertrag auf volle 100 € abgerundet (§ 11 Abs. 1 S. 3),
  GewSt keine Betriebsausgabe (§ 4 Abs. 5b EStG) → Sätze addieren sich. **App richtig in der Grundformel.**
- **Ohne** erweiterte Kürzung: Kürzung § 9 Nr. 1 S. 1 — ab EZ 2025 **0,11 % des Grundsteuerwerts**
  (bis 2024: 1,2 % von 140 % des Einheitswerts). **Fehlt in der App** (kleine Überzeichnung).
  Hinzurechnung § 8 Nr. 1 Buchst. a (25 % der Schuldentgelte über 200.000 € Freibetrag) fehlt ebenfalls —
  für Einzelobjekte meist ohne Wirkung, bei größeren Beständen nicht.
- **Mit** erweiterter Kürzung (§ 9 Nr. 1 S. 2): Gewerbeertrag aus Verwaltung/Nutzung eigenen Grundbesitzes
  wird vollständig gekürzt. Voraussetzungen: **ausschließlich** eigener Grundbesitz (plus die erlaubten
  Nebentätigkeiten), **das ganze Jahr**. Schädlich u. a.: Mitvermietung von Betriebsvorrichtungen,
  gewerblicher Grundstückshandel, Grundbesitz dient dem Gewerbebetrieb eines Gesellschafters
  (§ 9 Nr. 1 S. 5 Nr. 1), Beteiligung an gewerblicher Personengesellschaft, hotelähnliche Kurzzeitvermietung.
  Bagatellgrenzen für Stromlieferung/Leistungen an Mieter in § 9 Nr. 1 S. 3 (**genauen Prozentsatz bitte
  nachlesen, ich bin unsicher**, ob 10 % oder nach JStG 2024 geändert). Möblierte Vermietung: Prüfpunkt,
  kann schädlich sein.
- **App:** ein Haken, Vorgabe „an“ (`mandanten.js:927`), ohne jede Prüfung der Objekte (möbliert,
  Gewerbeeinheit, PV). Zudem uneinheitlich: Ist `erw_kuerzung` am Mandanten **nicht gesetzt**, zeigt die
  Maske den Haken **an** und das Abschluss-PDF „erweiterte Kürzung“ (`gesellschaft-abschluss.js:624, 704`:
  `!== false`), `effRate()` rechnet aber **mit** GewSt (`mandanten.js:361`: Wahrheitswert). Gemessen:
  `effRate` = 0,31575 statt 0,15825 bei Hebesatz 450.

### 2.6 VV-GmbH gegen gewerbliche GmbH, UG
- Steuerlich identisch bis auf die Kürzung. App bildet das über den Haken ab — sachlich vertretbar.
  Darstellung: das neue Objekt heißt immer „… VV“ (`ueberfuehrung-wizard.js:349`), auch ohne Kürzung.
- UG: Steuer = GmbH. Gesellschaftsrecht: 25 % Rücklage aus dem Jahresüberschuss (§ 5a Abs. 3 GmbHG) →
  höchstens 75 % ausschüttbar; **Sacheinlagen sind bei der UG ausgeschlossen** (§ 5a Abs. 2 S. 2 GmbHG)
  — eine Immobilie kommt dort nur per Kauf oder verdeckter Einlage (Kapitalrücklage) hinein. Die App
  unterscheidet UG und GmbH nirgends; die Ausschüttungszeile rechnet bei der UG 100 %.

### 2.7 Ausschüttung, Gesellschafterdarlehen, Finanzierung
- Ausschüttung: 25 % + Soli = 26,375 % (§ 20 Abs. 1 Nr. 1, § 32d Abs. 1 EStG), ggf. Kirchensteuer,
  Sparer-Pauschbetrag 1.000 € (§ 20 Abs. 9). Option Teileinkünfteverfahren § 32d Abs. 2 Nr. 3
  (≥ 25 % oder ≥ 1 % + beruflich tätig), dann 60 % steuerpflichtig (§ 3 Nr. 40 d). **App richtig** im Kern,
  ohne Kirchensteuer und UG-Rücklage.
- Gesellschafterdarlehen (typisch: Kaufpreisrest, den die GmbH dem Gesellschafter schuldet): Zinsen in der
  GmbH Betriebsausgabe, Fremdvergleich (überhöhter Zins = vGA, § 8 Abs. 3 S. 2 KStG); beim Gesellschafter mit
  ≥ 10 % Beteiligung **Tarif statt Abgeltungsteuer** (§ 32d Abs. 2 Nr. 1 S. 1 Buchst. b). **App: Feld ohne
  Wirkung**, Wizard fragt es nicht.
- Finanzierung: Übernahme des Bankdarlehens braucht die Zustimmung der Bank (§§ 414, 415 BGB); nachträgliche
  Schuldzinsen privat nur, soweit der Erlös die Schuld nicht deckt. App: `d1` wird durch die Restschuld
  ersetzt (gut), `d2` bleibt mit dem **Anfangsbetrag** stehen, die Vorbelegung der Restschuld ist der
  **Anfangsbetrag `d1`**, nicht die Restschuld (`ueberfuehrung-wizard.js:112`; `mandanten.js _prefillRest`
  nimmt dagegen `State.rs1`), der Zins wird auf eine Stelle gerundet (3,85 → 3,9). Der Jahresabschluss
  rechnet die Restschuld aus `d1`/`d1z`, **nicht** aus `ueberf_restschuld` (`gesellschaft-abschluss.js:120–130`)
  — seine eigene Gegenprobe gegen `State.cfRows` müsste deshalb abweichen.
- Notar/Grundbuch der Überführung: App setzt keine neuen an; alte Prozente auf den alten Kaufpreis.
- § 8c KStG (Anteilsübertragung) und § 6a GrEStG: für den Vorgang nicht einschlägig — richtig, dass die App sie nicht rechnet.

### 2.8 Trennung der Jahre Privat / Gesellschaft
- Richtig: private Verluste bleiben privat (ESt, mit Erstattung), die Gesellschaft startet ohne Vortrag;
  Sphären sauber getrennt (`mandanten.js sphaere()`, v1404).
- **Fehler 1 — ein Monat doppelt:** Privat-Schnitt rechnet das letzte Jahr mit `Monat/12`
  (`calc.js:2222`), die Gesellschaft ab Stichtagsmonat mit `(13 − Monat)/12` (`calc.js:2063`). Gemessen:
  Stichtag 01.01.2026 → privat 1/12 + GmbH 12/12 = **13/12**; Stichtag 01.07. → 7/12 + 6/12 = 13/12.
  Der Wizard kündigt es sogar an („rechnet bis Jan 2026 … + 1/12“, Z. 98–107). Richtig: privat (Monat − 1)/12.
- **Fehler 2 — Privat-Jahr in Projektion und Steuer-Reiter voll:** der Schnitt-Faktor wirkt nur in der
  Vermögens-/CF-Schleife (`calc.js:2290`); die Projektion `State.cfRows` (Schleife ab `calc.js:3124`) und der
  Steuer-Reiter (`tax.js:1362` Miete aus dem Feld × 12) kennen ihn nicht. Bei Am Markt 9 stünde für **2026
  im Privatobjekt ein volles V+V-Jahr** neben dem vollen Jahr der Gesellschaft (gelesen, Staging-Abnahmepunkt).
- **Fehler 3 — Gesellschaftsobjekt im Stichtagsjahr zum Teil als ESt besteuert:** das Gesellschaftsobjekt hat
  `kaufdat = Stichtag`, sein erstes Jahr ist schon nach Übergang anteilig (`anteilig.js getWuMonths`). `_mtxYear`
  teilt dieses bereits anteilige Ergebnis **noch einmal** und besteuert den „Privat-Anteil“ mit ESt inkl.
  Erstattung (`calc.js:2064–2067`). Gemessen bei Stichtag 01.07.2026: Ergebnis 3.000 € → App 867 € statt
  475 €; Ergebnis −3.000 € → App **−630 € (ESt-Erstattung aus einem GmbH-Verlust)** statt 0 €. Bei Stichtag
  01.01. wirkungslos.

---

## 3 · Fehlende Werte

| Angabe | wofür | heute |
|---|---|---|
| Art des Vorgangs: Kauf / teilentgeltlich / verdeckte Einlage / Sacheinlage gegen Anteile | GrESt-Bemessung, § 23-Preis, AK der GmbH, UG-Verbot | fehlt |
| Verkehrswert = gemeiner Wert / Teilwert zum Stichtag, mit Herkunft (Gutachten, Marktbericht) | § 23, AfA-Basis | vorhanden, Vorbelegung bevorzugt `bankval` vor `svwert` |
| Grundbesitzwert (BewG) bei Einlage | GrESt | fehlt |
| GrESt-Satz der Überführung (Land) | GrESt | alter Satz kopiert |
| Notar/Grundbuch der Überführung | AK der GmbH | alte Prozente auf alten KP |
| Fortgeführte AK privat (AK + NK − AfA bis Stichtag) | § 23 | nicht berechnet, obwohl alle Teile im Privatobjekt liegen |
| Weitere § 23-Gewinne im Jahr | Freigrenze 1.000 € | fehlt |
| Gebäudeanteil zum Stichtag (neue Kaufpreisaufteilung) | AfA | alter kopiert |
| AfA-Methode der Gesellschaft (degressiv/§ 7b ausgeschlossen), RND-Gutachten | AfA | alter kopiert |
| Grundsteuerwert | GewSt § 9 Nr. 1 S. 1 | fehlt |
| Hebesatz der Gemeinde | GewSt | Vorgabe 0 |
| Prüfung erweiterte Kürzung (möbliert, Gewerbe an Gesellschafter, PV, Grundstückshandel) | GewSt | nur Haken |
| Beteiligungsquote des Nutzers an der GmbH | § 32d Abs. 2 Nr. 1 b / Nr. 3, Schenkungsteuer | fehlt (Quote nur für GbR) |
| Gesellschafterdarlehen: Betrag, Zins, Laufzeit | Zinsabzug GmbH, Tarif beim Gesellschafter | Feld ohne Wirkung |
| Aktuelle Restschuld zum Stichtag, Bankzustimmung, `d2` | Finanzierung | Vorbelegung Anfangsbetrag, `d2` alt |
| Kosten der Gesellschaft in der Objektansicht | laufende Steuer | nur Jahresabschluss |
| Kirchensteuer bei Ausschüttung | zweite Ebene | fehlt |

---

## 4 · Beispiele (App per node an den echten Zeilen, korrekt von Hand)

Gemeinsame Annahmen: NRW, GrESt 6,5 %, Notar 1,5 %, Grundbuch 0,5 %, Grenzsteuersatz 42 % + Soli,
ohne Kirchensteuer, Hebesatz 450 %, AfA 2 % (Baujahr 1925–2022).

### Fall A — ETW privat 07.07.2024 für 132.000 €, Kauf durch VV-GmbH am 01.01.2026 zum VW 145.000 €
Gebäudeanteil 80 %. Privat ohne Makler (A) bzw. mit Makler 3,57 % (A′).

| | App | korrekt |
|---|---:|---:|
| GrESt der Überführung | keine Zahl; im GmbH-Objekt stehen 8.580 € (6,5 % × 132.000) | **9.425 €** (6,5 % × 145.000) |
| Gesamtinvestition/AK der GmbH | 143.220 € (alter KP + alte NK) | **157.325 €** |
| AfA-Basis Gebäude (A) | 125.860 € | 125.860 € (zufällig gleich, weil NK-Satz gleich) |
| AfA/Jahr (A) | 2.517 € | 2.517 € |
| AfA/Jahr (A′, privat mit Makler) | **2.600 €** (Makler mitskaliert) | 2.517 € |
| § 23 Frist | „steuerpflichtig“ (richtig) | läuft bis 07.07.2034 |
| fortgeführte AK privat (A) | – | 143.220 − AfA 1.146 (2024) − 2.292 (2025) = 139.783 € |
| Veräußerungsgewinn (A) | – | **5.217 €** → ESt 2.191 + Soli 121 = **2.312 €** |
| Veräußerungsgewinn (A′) | – | 618 € → unter Freigrenze 1.000 € → 0 € (wenn sonst kein § 23-Gewinn) |
| Jahr 2026 | privat 1/12 (Vermögens-CF) bzw. 12/12 (Projektion/Steuer) **plus** GmbH 12/12 | nur GmbH 12/12 |

Hinweis: wäre der Preis unter VW (z. B. 100.000 €), sagt die App „Gewinn = Preis − fortgeführte AK“
= −39.783 € (Verlust), richtig ist VW − fortgeführte AK = 5.217 € Gewinn (§ 23 Abs. 3 S. 2). Dann zusätzlich
die offene Drei-Jahres-Frage zur AfA-Basis (2.3).

### Fall B — MFH privat seit 2010 (KP 300.000 €, GrESt damals 3,5 %), Einlage in GmbH zum VW 500.000 €, Boden 30 %
| | App | korrekt |
|---|---:|---:|
| Wizard-Aussage GrESt | „auf den Überführungspreis“ — Preis leer/0 → liest sich wie 0 € | **32.500 €** (6,5 % auf Grundbesitzwert, hier ≈ 500.000 angenommen; § 8 Abs. 2 GrEStG) |
| GrESt im GmbH-Objekt | 10.500 € (3,5 % × 300.000) | 32.500 € |
| AK der GmbH | – | 500.000 + 32.500 + 7.500 = 540.000 € |
| AfA-Basis / AfA | 369.250 € / **7.385 €** | 378.000 € / **7.560 €** |
| § 23 | „frei“ (richtig, Frist 2020 abgelaufen) | 0 € |
| „Verdeckte Einlage“ | 500.000 € | 500.000 € bei verdeckter Einlage; bei offener Sacheinlage Stammkapital/Rücklage — **bei einer UG unzulässig** (§ 5a Abs. 2 S. 2 GmbHG) |

(Grundbesitzwert nach BewG weicht im Einzelfall vom Verkehrswert ab; die Gleichsetzung ist eine Annahme.)

### Fall C — Neukauf durch VV-UG: MFH 400.000 €, NK 8,5 % (ohne Makler), Gebäude 75 %
Miete 30.000 €/J, nicht umlagefähige Kosten 3.600 €, Darlehen 320.000 € zu 3,8 % (12.160 € Zins),
Kosten der Gesellschaft 2.000 €, Grundsteuerwert 250.000 € angenommen.

| | App | korrekt |
|---|---:|---:|
| AfA | 6.510 € | 6.510 € |
| Ergebnis | 7.730 € (Objektansicht, ohne Gesellschaftskosten) | 5.730 € |
| Satz mit erw. Kürzung | 15,825 % → **1.223 €** | KSt+Soli **907 €**, GewSt 0 |
| ohne erw. Kürzung | 31,575 % → **2.441 €** (auf 5.730: 1.809 €) | 907 € + GewSt 851 € (5.730 − 275 Kürzung → 5.400 × 3,5 % × 450 %) = **1.757 €** |
| Verlust 2026 −4.000, dann +3.000/+3.000 (mit Kürzung) | Steuer-Reiter 0 / 0 / 317 €; Projektion **0 / 475 / 475 €** | 0 / 0 / 317 € (Mindestbesteuerung erst über 1 Mio.) |
| Ausschüttung | 4.823 € × 26,375 % = 1.272 € | UG: höchstens 75 % = 3.617 € → 954 € KapESt; Rest Pflichtrücklage |

Abweichungen in C sind vor allem: Gesellschaftskosten fehlen in der Objektansicht, Kürzung § 9 Nr. 1 S. 1
fehlt, Projektion ohne Verlustvortrag, UG-Rücklage fehlt. Die Grundsätze (15,825 %, 3,5 % × Hebesatz, keine
Erstattung) stimmen.

---

## 5 · Bewertung — Abweichungen nach Schwere

### A · Falsche Zahl (eindeutige Fehler)
1. **Ein Monat doppelt im Stichtagsjahr** — `calc.js:2222` (`Monat/12`) gegen `calc.js:2063` (`(13−Monat)/12`); Wizard-Text `ueberfuehrung-wizard.js:98–107`. Privat müsste `(Monat−1)/12` rechnen.
2. **Privatobjekt rechnet das Stichtagsjahr in Projektion und Steuer-Reiter voll** — Schnittfaktor nur in `calc.js:2290`, nicht in `cfRows` (`calc.js:3124 ff.`) und nicht in `tax.js:1362`. (gelesen, im Browser abnehmen)
3. **Gesellschaftsobjekt: Ergebnis des Stichtagsjahres zum Teil als ESt mit Erstattung** — `calc.js:2055–2067`; das Gesellschaftsobjekt ist durch `kaufdat = Stichtag` schon anteilig. Gemessen −630 € „Erstattung“ aus GmbH-Verlust.
4. **GrESt und Nebenkosten der Gesellschaft auf alten Kaufpreis, alten Satz, inkl. altem Makler** — `calc.js:896–897` mit kopiertem Blob `ueberfuehrung-wizard.js:337`. Fall A: 8.580 statt 9.425 €; Fall B: 10.500 statt 32.500 €.
5. **AfA-Basis skaliert alte Nebenkosten** — `calc.js:1276–1283`. Fall A′ +3,3 %, Fall B −2,3 %. Dazu degressiv/§ 7b werden mitkopiert, obwohl nach Überführung ausgeschlossen (§ 7 Abs. 5a, § 7b: Anschaffung bis Ende Fertigstellungsjahr).
6. **Restschuld im Jahresabschluss aus `d1` statt `ueberf_restschuld`** — `gesellschaft-abschluss.js:120–130`.
7. **Zins gerundet** — `ueberfuehrung-wizard.js:346–347` (3,85 → 3,9 %).
8. **Vorbelegung Restschuld = Anfangsbetrag `d1`** — `ueberfuehrung-wizard.js:112`; `d2` bleibt in voller Anfangshöhe im Gesellschaftsobjekt.
9. **`san` mitkopiert, 15-%-Grenze auf altem Gebäude-AHK** — `ueberfuehrung-wizard.js:337`, `calc.js:1008`; mögliche Doppelabzüge (gelesen, im Browser abnehmen).
10. **Kürzungs-Haken uneinheitlich bei nicht gesetztem Feld** — `mandanten.js:361` (Wahrheitswert) gegen `mandanten.js:927`, `gesellschaft-abschluss.js:624/704` (`!== false`).
11. **Drei KSt-Zahlen für dasselbe Jahr** — Projektion ohne Vortrag `calc.js:2050`, Steuer-Reiter mit `tax.js:1561`, Abschluss ohne `gesellschaft-abschluss.js:424`.

### B · Falsche Rechtsaussage im Text
12. **§ 23-Gewinn „Überführungspreis minus fortgeführte AK“** — `ueberfuehrung-wizard.js:247`. Richtig: gemeiner Wert (bei verdeckter/teilentgeltlicher Einlage) − fortgeführte AK, § 23 Abs. 3 S. 2.
13. **„GrESt fällt auf den Überführungspreis“** ohne den Fall Einlage/Sacheinlage (Grundbesitzwert § 8 Abs. 2) — `ueberfuehrung-wizard.js:194`.
14. **„BFH 2023“ ohne Aktenzeichen** — `ueberfuehrung-wizard.js:197`; nicht verifizierbar.

### C · Fehlende Pflichtangabe / fehlende Rechnung
15. Kein GrESt-Betrag der Überführung, kein § 23-Gewinn und keine Steuer darauf (alle Eingaben liegen vor).
16. Art des Vorgangs (Kauf / Einlage / Sacheinlage) fehlt — steuert GrESt-Basis, § 23-Preis, UG-Zulässigkeit.
17. Gesellschafterdarlehen ohne Wirkung (`storage.js:177`, nur PDF `pdf-investment-bank.js:1105`).
18. GewSt ohne Kürzung § 9 Nr. 1 S. 1 (0,11 % Grundsteuerwert), ohne Abrundung, ohne § 8 Nr. 1 — `mandanten.js:361`.
19. Erweiterte Kürzung ohne jede Plausibilitätsprüfung.
20. Gesellschaftskosten fehlen in der Objektansicht.
21. UG: Rücklage § 5a Abs. 3 GmbHG fehlt in der Ausschüttungszeile `tax.js:955–960`.

### D · Darstellung
22. Kürzel immer „… VV“ (`ueberfuehrung-wizard.js:349`), Überschrift immer „in GmbH überführen“, auch bei UG.
23. Steuer-Reiter der Gesellschaft sagt „Einnahmen V+V“, „Werbungskosten“ (`tax.js:878–879`) — bei der GmbH Betriebseinnahmen/-ausgaben.
24. Verkehrswert-Vorbelegung nimmt Bankbewertung vor Verkehrswert (`ueberfuehrung-wizard.js:111`).
25. Portfolio-Strategie zeigt die Spekulationsfrist auch für Gesellschaftsobjekte (`portfolio-strategie.js:68–71`) — für eine Kapitalgesellschaft gibt es keine steuerfreie Veräußerung nach zehn Jahren; `steuer-verlauf.js:51` macht es richtig.

### Entscheidungen für Marcel (fachlich, kein Programmierfehler)
- **E1 Vorgangsart:** Soll der Assistent Kauf / teilentgeltlich / verdeckte Einlage / Sacheinlage unterscheiden und daraus GrESt-Basis (Gegenleistung oder Grundbesitzwert) und § 23-Preis ableiten?
- **E2 § 23 rechnen:** Gewinn und Steuer als Zahl ausweisen (fortgeführte AK aus dem Privatobjekt), mit Freigrenze 1.000 €?
- **E3 AK der Gesellschaft:** neue Nebenkosten (GrESt-Satz zum Stichtag, Notar, Grundbuch, kein Makler) statt Skalierung; neue Kaufpreisaufteilung zum Stichtag ja/nein?
- **E4 Drei-Jahres-Grenze § 6 Abs. 1 Nr. 5 S. 1 a** bei verdeckter Einlage binnen drei Jahren (Am Markt 9!) — Rechtsfrage, mit Steuerberater klären, dann Regel festlegen.
- **E5 Stichtagsmonat:** gehört der Monat des Stichtags der Gesellschaft (meine Lesart) oder privat? Danach Fehler 1–3 einheitlich beheben.
- **E6 Erweiterte Kürzung:** Vorgabe „an“ beibehalten oder erst nach Prüffragen (möbliert, Gewerbe an Gesellschafter, PV/Ladestrom, Verkäufe)?
- **E7 Gesellschafterdarlehen** (Kaufpreisrest) abbilden: Zins in der GmbH, Tarif beim Gesellschafter ab 10 %?
- **E8 UG:** Rücklage 25 % und Sacheinlageverbot als Hinweis/Regel?
- **E9 Verlustvortrag** in der Projektion und im Abschluss wie im Steuer-Reiter?
- **E10 Hinweis „BFH 2023“:** Aktenzeichen liefern oder streichen.
