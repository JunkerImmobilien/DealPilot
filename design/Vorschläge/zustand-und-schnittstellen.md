# Objektzustand und Bewertungsschnittstellen — Befund und Vorschlag

**Backlog v22, Punkte 17 und 18** · 18.09.2026 · im Code gemessen (mit
Datei:Zeile). Drei Fehler, die still Daten verloren, sind bereits behoben
(`v1438`, siehe Abschnitt 3). Der Rest braucht Marcels fachliche Entscheidung.

---

## 1 · Der Zustand: sechs Skalen für einen Begriff

| Wo | Skala | Werte |
|---|---|---|
| Objekt-Tab, 8 Sterne (`star-rating.js`) | 0–5 je Komponente | Zustand: Küche, Bad, Boden, Fenster · Qualität: dieselben vier |
| Objekt-Tab, Auswahl `ds2_zustand` | 5 Stufen | neubau · gut · normal · renovierungsbedürftig · stark sanierungsbedürftig |
| Marktbericht `cond` | 6 Stufen | neuwertig · saniert · modernisiert · gepflegt · normal · renovierungsbedürftig |
| Sprengnetter `modernization_class` | 5 Stufen | EXTENSIVE · PREDOMINANT · AVERAGE · SIMPLE · NONE |
| Deal Score 2 (`dealscore2-ui.js:103`) | Mittel der 8 Sterne → 5 Stufen | |
| RND (`rnd-calc.js:649`) | 3 Stufen | veraltet · standard · gehoben |

### Was davon wirklich in eine Bewertung geht

- **Die 8 Sterne gehen an KEINE Bewertungsschnittstelle.** Gelesen werden sie
  nur vom Deal Score (Mittelwert) und von der RND. Sprengnetter, PriceHubble
  und GeoMap bekommen sie nie.
- **`ds2_zustand`** geht an Sprengnetter, allerdings als
  `modernization_class` — ein Zustand im Feld für den Modernisierungsgrad
  (`sprengnetter-client.js:67-76`).
- **PriceHubble** bekommt weder Zustand noch Qualität
  (`pricehubble-client.js:91-97`, nur Adresse, Typ, Baujahr, Fläche).
- **DealPilot-Karte → GeoMap** schickt 8 Felder (`dealpilot-mb.js:153`),
  kein Zustand. Der Mapper setzt dann `'gepflegt'` (Faktor 1,0,
  `DealPilotObjectMapper.js:58`) — **jedes Objekt gilt dort als gepflegt.**

### Zwei Ungereimtheiten in der Übersetzung

1. `stark_sanierungsbeduerftig` wird im Marktbericht auf
   `renovierungsbeduerftig` (Faktor 0,88) gelegt, obwohl ValuationService
   `sanierungsbeduerftig` mit 0,82 kennt (`mb-objektwahl.js:302-310`,
   `ValuationService.js:7-15`). Grund: das Marktbericht-Formular hat diese
   Stufe gar nicht als Auswahl. **Nicht geändert** — das ist eine
   Bewertungsfrage.
2. Die Stern-Beschriftung mischt Zustand und Qualität: Zustand 4 heißt
   „Gehobenes Niveau" — das ist eine Qualitäts-, keine Zustandsaussage.

### Vorschlag

**Eine verbale Zustandsskala** (fünf Stufen, fachlich benannt statt Sterne),
**je Komponente** — und eine **Gesamtstufe**, die daraus abgeleitet und
überschreibbar ist:

| Stufe | Bedeutung (Vorschlag) | → Sprengnetter | → Marktbericht |
|---|---|---|---|
| 5 · neuwertig | Neubau oder Kernsanierung < 5 J. | EXTENSIVE | neuwertig |
| 4 · modernisiert | wesentliche Modernisierung < 15 J. | PREDOMINANT | modernisiert |
| 3 · gepflegt | laufend instand gehalten | AVERAGE | gepflegt |
| 2 · renovierungsbedürftig | Schönheitsreparaturen, einzelne Gewerke | SIMPLE | renovierungsbedürftig |
| 1 · sanierungsbedürftig | Substanz, Haustechnik, Dach | NONE | sanierungsbedürftig |

Komponenten wie heute (Küche, Bad, Boden, Fenster) **plus** die, die für
Bewertung und RND zählen: Heizung/Haustechnik, Dach, Fassade/Dämmung.
Die **Qualität** bleibt eine eigene Achse (einfach · normal · gehoben · luxuriös).

**Altbestand bleibt lesbar:** Stern 1–5 = Stufe 1–5 (gleiche Richtung);
`ds2_zustand` wird aus der Gesamtstufe gesetzt, statt eigenständig zu sein.

---

## 2 · Was wir haben, senden, senden könnten

| Schnittstelle | Wir senden | Könnten zusätzlich (vorhanden im Objekt) | Kommt zurück / wo |
|---|---|---|---|
| **Sprengnetter** | Adresse, Kategorie, Baujahr, Modernisierungsjahr, Fläche, Zimmer, Etage (ETW), Geschosse (Haus), Garagen, Grundstück, `ds2_zustand`, Ausstattung | `bad_anz` → mehr als ein Bad; `standardstufe` → equipment.value; `mod_punkte` → modernization_class (statt Zustand) | Wert + Spanne, Miete, Vergleichsobjekte → AVM-Karte |
| **PriceHubble** | Adresse, Typ, Baujahr, Fläche | Zustand/Qualität **je Komponente** (Küche, Bad, Boden, Fenster — passt 1:1 auf die Sterne), Grundstück, Zimmer, Etage, Aufzug, Energieklasse — *laut Anbieterdoku, im Repo nicht belegt* | Wertspanne, Miete → AVM-Karte |
| **DealPilot-Karte → GeoMap** | plz, ort, str, hnr, objektart, wfl, baujahr, kp | **Zustand, Qualität, Ausstattung, Grundstück, Modernisierung, Einheiten, Vermietungsstand** — der Mapper kann sie alle schon (`DealPilotObjectMapper.js:47-97`) | Median/Quartile €/m², Vergleiche, Trend |
| **Marktbericht (App)** | vollständig, inkl. Wertermittlung | — | Wertverfahren, Bericht |
| **BORIS / IRW / Zensus / Destatis / Geoapify** | Koordinaten, Kreis, Typ, Einheiten | — | Bodenrichtwert, Normobjekt, Leerstand, Makro, POI |

**Der größte Hebel:** die DealPilot-Karte schickt 8 Felder, obwohl der Mapper
das ganze Objekt versteht. Zustand, Ausstattung und Modernisierung gehen dort
verloren — die Marktpreisindikation der Karte rechnet deshalb jedes Objekt
als „gepflegt, normale Ausstattung".

---

## 3 · Bereits behoben (v1438 und v1437)

| Fehler | Wirkung | behoben |
|---|---|---|
| Quick Check schickte das Baujahr als `bj`, die Clients lesen `baujahr` | Sprengnetter und PriceHubble bekamen aus dem Quick Check **nie ein Baujahr** | v1438 |
| Ausstattung kam als `heating/windows/…`, der Rechenkern las nur `eq_*` | Standardstufe und Modernisierungspunkte bekamen auf diesem Weg **nichts** | v1438, auf Staging nachgemessen |
| IRW las `ref.construction_year`, ref führt `build_year` | Baujahr-Abweichung zum Normobjekt fiel **immer** aus | v1438 |
| Aufzug `'Ja'` scheiterte an `=== 'ja'` | Aufzug nie erkannt | v1438 |
| Mapper übernahm keine Wohneinheiten | Ertragswert rechnete die Verwaltung ohne Einheitenzahl | v1437 |

---

## 4 · Was Marcel entscheiden muss

1. **Zustandsskala:** die fünf Stufen oben so — oder andere Grenzen/Namen?
   Welche Komponenten gehören dazu (Heizung, Dach, Fassade)?
2. **`stark sanierungsbedürftig` → 0,82 statt 0,88?** Dafür bekäme das
   Marktbericht-Formular die fehlende Stufe.
3. **DealPilot-Karte:** Zustand, Ausstattung und Modernisierung mitschicken?
   Das verändert die Marktpreisindikation bestehender Objekte (jedes galt bisher
   als „gepflegt").
4. **PriceHubble** um Zustand/Qualität je Komponente erweitern? Dafür gehört
   zuerst die Anbieterdoku geprüft — im Repo steht sie nicht.
