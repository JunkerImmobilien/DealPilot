# Steuern: AfA, Restnutzungsdauer und RND-Gutachten — Konzept

**Backlog v22, Punkt 22** · 18.09.2026 · Bestandsaufnahme im Code, Vorschlag.
Knüpft an Block **R** im Backlog (R3–R5) und an das Datenmodell aus
`mfh-ist-soll-konfigurator.md` (Objekt → Gebäude → Einheit) an.
**Nichts davon ist gebaut** außer zwei Fehlerkorrekturen (v1439, unten).

---

## 1 · Ist-Stand (gemessen)

### AfA im Tab Steuern
- `#afa_satz` ist eine **feste Auswahl mit fünf Werten** (2,0 · 2,5 · 3,0 ·
  5,0 degressiv · 5,0 degressiv mit Wechsel), `index.html:2008-2019`.
- **Kein eigener Satz, keine Restnutzungsdauer**: § 7 Abs. 4 Satz 2 EStG
  (kürzere Nutzungsdauer) steht nur als Bannertext in der Deal-Aktion.
  `Afa.parseSelectValue` würde jeden Satz verstehen — die Auswahl bietet ihn
  nicht an.
- Schutz eigener Werte gibt es nur verstreut (`dataset.userOverride` beim zvE,
  `userSet` im Quick Check) — kein gemeinsames Muster.

### Restnutzungsdauer: drei Rechnungen
| | wo | Stand |
|---|---|---|
| 1 | `rnd-calc.js` (`DealPilotRND`, Kern 3.1.0 aus dem Gutachten-Paket, v1426) | sechs Verfahren, Anlage-2-Grenzen, GND 80 — **der Master** |
| 2 | `marktbericht/backend/src/lib/anlage2.js` | eigene Punktraster-Umsetzung für den Marktbericht |
| 3 | `bmf-afa.js` `calcFiktivesBaujahr` | Näherung mit harten Schwellen |

Der Wizard (`rnd-wizard.js`, 9 Schritte) **fragt die Modernisierungen neu ab**,
obwohl der Objekt-Tab `#mod_punkte` führt — es wird nicht übergeben. Das
Ergebnis landet in Modal, PDF/DOCX und Anfrage — **nie im Steuer-Tab**.

### Gutachten anfragen: drei Wege, kein Status
| Weg | Ziel | Daten | Status |
|---|---|---|---|
| RND-Wizard → „anfragen" | `POST /rnd-request` → JSON-Datei + Mail | Wizard-Zustand komplett | keiner |
| Expert-Maske | Mail | Formular | keiner |
| Netzwerk-Karte „Gutachter" | `POST /network-cards/:id/lead` → Mail an Partner | Eckdaten (KP, Fläche, Bj, DSCR, LTV), Datenraum-Links — **nichts RND-Spezifisches** | `network_leads` ohne Status |

Die Karte **„Gutachten.org"** ist angelegt, hat aber **keine Ziel-Mail**
(`049_network_cards.sql:74-79`). Einen Konfigurator von junker-immobilien.io
gibt es im Repo nicht — der Rechenkern dort ist `rnd-calc.js` selbst
(Block R, Befund vom 13.09.).

---

## 2 · Vorschlag

### A · AfA: Auswahl ODER eigener Satz
```
AfA-Satz   [ 2,0 % linear (Baujahr ab 1925)   ▾ ]
           ( ) aus der Auswahl   (•) eigener Satz  [ 2,94 ] %
               Grundlage: [ Restnutzungsdauer 34 Jahre (Gutachten 03/2026) ]
               ⓘ gesetzt von dir — wird nicht automatisch geändert
```
- Neue Option **„Eigener Satz"**, Feld `afa_satz_manuell` + Pflichtfeld
  **Grundlage** (Freitext oder aus der RND übernommen).
- **Eigene Werte gewinnen immer.** Eine Automatik (Baujahr, degressiv-Banner)
  darf nur einen *Vorschlag* zeigen, nie überschreiben. Einheitliches Muster:
  `data-dp-eigen="1"` + sichtbare Plakette „von dir gesetzt".

### B · Restnutzungsdauer im Tab Steuern
Eine Karte mit zwei Wegen:
1. **Bekannt** — Jahre eintragen + Quelle (Gutachten, Datum).
2. **Ermitteln** — öffnet den **vorhandenen** Wizard, vorbefüllt aus dem
   Objekt (Baujahr, Art, Zustand, **`mod_punkte`**, Gebäudedaten aus dem
   MFH-Konfigurator). Keine zweite Rechnung.

Ergebnis: *„RND 34 Jahre → AfA 2,94 %"* mit Knopf **„als AfA übernehmen"**
→ setzt A (eigener Satz, Grundlage „RND-Ermittlung, indikativ").
Daneben der Hinweis, dass das Finanzamt für § 7 Abs. 4 Satz 2 einen Nachweis
verlangt — und der Weg dorthin (C).

### C · Ein Auftragsweg mit Status
- **Ein** Endpunkt für RND-Gutachten (`/rnd-request` bleibt), aber mit
  **Tabelle statt JSON-Datei**: `gutachten_auftraege (id, user_id,
  object_ref, anbieter, status, daten jsonb, dokument_url, …)`.
- Status: **angefragt → übermittelt → in Bearbeitung → abgeschlossen**,
  gesetzt im Admin (der Partnerprozess meldet heute nichts zurück).
- **Vor dem Absenden** eine Übersicht, *welche* Daten rausgehen, mit Haken
  zur Bestätigung (Leitplanke: kein Versand ohne Zutun).
- Die Netzwerk-Karte „Junker Immobilien" (Gutachter) führt **in denselben
  Weg** (R5) — mit RND-Daten statt nur Eckdaten.
- Nach „abgeschlossen": Link zum Gutachten am Deal; ein Knopf übernimmt die
  Gutachten-RND in A.
- Einstieg zusätzlich am Ende des Sprechlaufs (R3, Marcels Hauptwunsch).

### D · Ein Rechenkern
`rnd-calc.js` ist der Master. `anlage2.js` (Server) wird **gegen dieselben
Prüffälle** gehalten wie der Kern (Löhner, Hüllhorst) — eine gemeinsame
Prüfstrecke statt Portierung. `calcFiktivesBaujahr` in `bmf-afa.js` fällt
weg und liest die Kern-RND.

### E · Vererbung Objekt → Gebäude → Einheit
Wie im MFH-Konzept: Baujahr, Heizung, Dach, Fassade am **Gebäude**; jede
Einheit erbt; Abweichungen je Einheit (Bad erneuert, eigene Modernisierung)
überschreiben sichtbar. Die RND wird **je Gebäude** gerechnet; Einheiten mit
abweichender Modernisierung bekommen einen Hinweis, keine eigene RND.

---

## 3 · Bereits behoben (v1439)
- `afa-ui.js` las das Baujahr aus `#bj` (nur im Quick Check) — die Prüfung
  auf degressive AfA sah im Objekt-Tab **nie** ein Baujahr.
- `rnd-wizard.js` rechnete Wohngebäude mit **GND 70**, Tabelle und Kern mit
  **80** (Anl. 1 ImmoWertV 2021). Jetzt 80; Gewerbe unverändert.

---

## 4 · Was Marcel entscheiden muss
1. **Wohin geht der Auftrag?** Junker Immobilien (Mail + Admin-Status),
   Gutachten.org (keine Ziel-Mail hinterlegt) — oder Auswahl durch den Nutzer?
2. **„Lohnt sich"-Schwelle** (Block R): ab welcher Differenz zwischen
   Modell-RND und ermittelter RND wird das Gutachten empfohlen?
3. **Darf eine *indikative* RND als AfA übernommen werden** — oder nur mit
   Gutachten (dann bleibt sie Vorschlag mit Hinweis)?
4. Status-Pflege: **von Hand im Admin**, oder soll der Partner einen Link
   bekommen, über den er den Status selbst setzt?
