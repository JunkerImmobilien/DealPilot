# DealPilot-Schnittstelle — Einrichtung

Stand 10.10.2026 · gemessen an Staging, nicht aus der Erinnerung geschrieben.

Diese Seite ist für den **anderen Chat** gedacht: sie sagt, wie man die
Schnittstelle anspricht und was zurückkommt. **Der Schlüssel selbst steht
hier nicht** — er wird genau einmal beim Anlegen gezeigt und ist ein
Geheimnis wie ein Passwort.

---

## 1 · Zugang

| | |
|---|---|
| Basis (Staging) | `https://app.staging.dealpilot.immo/api/v1` |
| Basis (Produktion) | `https://app.dealpilot.immo/api/v1` |
| Kopfzeile | `x-api-key: <schlüssel>` |
| Grenze | **120 Aufrufe je Minute** je Schlüssel |
| Voraussetzung | das Plan-Merkmal **`api_access`** (haben `pro` und `partner`) |

### Der Schlüssel

Für die Anbindung liegt ein Schlüssel bereit — Name im Konto
**„Rechenkerne + Export (Chat 2)"**, Recht `crud`, angelegt am
10.10.2026, gültig für **Staging**. Marcel gibt ihn direkt weiter.

**Er steht absichtlich nicht in dieser Datei.** Stattdessen als
Umgebungsvariable setzen und von dort lesen:

```bash
export DEALPILOT_KEY="dpk_live_…"        # Linux / macOS
$env:DEALPILOT_KEY = "dpk_live_…"        # PowerShell
```

> Ein Schlüssel in einer versionierten Datei ist auch nach dem Löschen
> der Zeile noch im Git-Verlauf — und diese Datei wandert in einen
> zweiten Chat. Zurückziehen geht jederzeit in
> **Einstellungen → API**; ein neuer ist in zehn Sekunden angelegt.

### Gegengetestet am 10.10.2026

| Aufruf | Ergebnis |
|---|---|
| `GET /rechenkerne/` | **200** · nennt beide Kerne |
| `GET /objects/portfolio-export` | **200** · 655 KB · 23 Objekte, 13 Pilot-Analysen, 17 Marktberichte, 60 Verlaufspunkte |
| `POST /rechenkerne/rnd` | **200** · `final_rnd 28,0` am Objekt 2026-001 (seit v2073; vorher 10,5 mit falscher Eingabe) |
| `POST /rechenkerne/verkehrswert` | **422** — siehe Abschnitt 5 |

> **Bis `v2072a` gab jeder Aufruf 403 „requires an active Pro plan".**
> Der Grund war keine fehlende Berechtigung, sondern eine Namensliste
> `PRO_PLAN_IDS = ['pro']` im Server — und `pro` kommt in der Tabelle
> `subscriptions` gar nicht vor (dort stehen `partner`, `free`,
> `starter`). Die Liste liess also **niemanden** durch. Jetzt hängt der
> Zugang am Merkmal `plans.features->api_access`, genau wie das Anlegen
> eines Schlüssels. **Ein 403 nennt jetzt den gemessenen Plan mit** —
> wer ihn sieht, muss nicht am Schlüssel suchen.

Der Schlüssel beginnt mit `dpk_live_`. Er ersetzt den
`Authorization: Bearer …`-Kopf — **beides zusammen ist nicht nötig.**

```bash
curl -H "x-api-key: $DEALPILOT_KEY" \
  https://app.staging.dealpilot.immo/api/v1/objects/portfolio-export
```

### Rechte (`scopes`)

| Wert | darf |
|---|---|
| `read` | nur lesen (GET) |
| `crud` / `write` | lesen und schreiben |

Seit `v1796` wird das Recht **wirklich geprüft** — vorher wurde es
vergeben, angezeigt und nie ausgewertet. Für das Auslesen des Portfolios
reicht `read`.

### Schlüssel anlegen

In der App unter **Einstellungen → API**. Dort steht auch die Liste der
vorhandenen Schlüssel (nur Präfix und Name — der Klartext wird nie
wieder gezeigt).

---

## 2 · Der eine Aufruf, der alles bringt

```
GET /objects/portfolio-export
GET /objects/portfolio-export?fotos=1     # mit Bildern (deutlich größer)
```

Antwort (gemessen **655 KB** bei 23 Objekten, ohne Fotos):

```jsonc
{
  "dealpilot_export": "portfolio",
  "format_version": 1,
  "erzeugt_am": "…",
  "anzahl_objekte": 23,
  "objekte_mit_pilot_analyse": 13,
  "objekte_mit_marktbericht": 17,
  "marktbericht_verlaufspunkte": 60,
  "marktbericht_fehler": "…",        // nur falls der Dienst schwieg
  "lexikon": { … },                   // was die Schlüssel bedeuten
  "wissen":  { … },                   // Projektwissen, Portfolio-Analyse
  "objekte": [ … ]
}
```

### Je Objekt

| Feld | Inhalt |
|---|---|
| `id`, `nummer`, `name`, `ort`, `kuerzel` | Kennung |
| `lageklasse`, `gewonnen`, `verloren`, `ankauf_stand` | Zustand |
| **`daten`** | **286 Feldnamen**, 273–281 belegt — alles aus Objekt, Investition, Miete, Finanzierung, Bewirtschaftung, Steuer |
| **`analyse`** | die **Pilot-Analyse** mit 24 Textfeldern (9–12 KB) |
| **`marktbericht`** | Stand **und Verlauf** — siehe unten |
| `fotos_anzahl`, `fotos` | Bilder (nur mit `?fotos=1`) |

### `daten` — was darin besonders ist

- **`_mfh`** · der Wohnungskonfigurator. Je Einheit: `nr`, `lage`, `art`,
  `wfl`, `zimmer`, **`ist`/`soll`** (Monatsmieten), **`status`**
  (das Mietverhältnis), `zustand`, `massnahme`, `kosten`.
  Dazu `gebaeude` (Dach, Außenwand, Leitungen, Heizung), `gnd`,
  `aufgeteilt`, `sollAbJahr`.
- **`_ankauf`** · der eingefrorene Stand beim Lastenwechsel (das **Soll**).
  Der übrige Datensatz ist der laufende Stand (das **Ist**).
- **`_rnd`** · die vom Wizard gerechnete Restnutzungsdauer nach Anlage 2.
  **Nicht zu verwechseln mit `afa_rnd_jahre`** im Reiter Steuer: dort
  steht, was der Nutzer angesetzt hat. Weichen beide ab, ist das ein
  Befund und kein Fehler.
- **`_kpis_*`** · Kennzahlen, gerechnet von den echten Kernen zu ihrer
  Zeit. Sie werden **nicht** neu gerechnet.
- `san`, `san_ust`, `san_tax_years`, `san_tax_active` · Sanierung
- 8× `mod_*` · die Bauteile (Dach, Fenster, Leitungen, Heizung,
  Außenwände, Bäder, Innenausbau, Grundriss)
- `brw`, `lzs_pct`, `sachwertfaktor`, `geb_ant` · Bodenrichtwert,
  Liegenschaftszins, Sachwertfaktor, BMF-Gebäudeanteil

### `marktbericht` — steht **neben** `daten`, nicht darin

Die Berichte liegen in einer eigenen Datenbank und werden über
`object_key = "dp:" + id` zugeordnet.

```jsonc
"marktbericht": {
  "stand": {
    "adresse": "…", "objektart": "wohnung",
    "wohnflaeche": "100", "baujahr": 1962,
    "marktwert_eur": "199000", "deal_score": 61,
    "berichte": "33", "zuletzt": "2026-10-07T19:02:53Z"
  },
  "verlauf": [                         // ein Eintrag je Bericht, nach Datum
    { "datum": "2026-07-17T05:41:05Z", "bericht_id": 1,
      "marktwert_eur": "210000",
      "marktwert_von": "156000", "marktwert_bis": "291000",
      "eur_pro_qm": "1710", "wohnflaeche": "100", "baujahr": 1962 }
  ]
}
```

> **Fehlt der Block ganz**, hat das Objekt keinen Marktbericht.
> **Steht im Kopf `marktbericht_fehler`**, war der Dienst nicht
> erreichbar — dann ist das Fehlen *keine Aussage über die Objekte*.

### `lexikon` — die Bedienungsanleitung im Export

| Schlüssel | Inhalt |
|---|---|
| `felder` | 225 Formularfelder mit Beschriftung, Art und Auswahloptionen |
| `felder_reihenfolge` | die Reihenfolge, falls sie gebraucht wird |
| `objektarten`, `etappen` | ETW, EFH, ZFH, MFH … im Klartext |
| **`strukturen`** | `_mfh`, `_ankauf`, `_kpis_`, `_rnd`, `_ds2_`, `_deal_won`, `marktbericht` |
| `score_stufen` | 85 / 70 / 50 / 35 → Sehr gut · Gut · Solide · Schwach · Kritisch |
| `hinweise` | **die Einheiten-Fallen** — bitte lesen, bevor gerechnet wird |

Aus `hinweise`, weil es sonst teuer wird:
- Alle Geldbeträge sind **Euro**, nicht Cent.
- `nkm` ist die Nettokaltmiete **pro Monat**, nicht pro m².
- `_kpis_cf_ns` ist der Cashflow nach Steuer **pro Jahr**.
- `_kpis_dscr` ist ein **Verhältnis ohne Einheit** — eine Prozentangabe
  darauf ist irreführend.
- Ein fehlender Wert ist **fehlend, nicht null**.

---

## 3 · Weitere Endpunkte

| Aufruf | Inhalt |
|---|---|
| `GET /objects` | Liste der Objekte (ohne Marktbericht und Lexikon) |
| `GET /objects/:id` | ein Objekt roh |
| `GET /marktbericht/objects` | alle Objekte **mit** Marktbericht (39 auf Staging) |
| `GET /marktbericht/objects/history` | der **Verlauf**, ein Eintrag je Bericht (109) |
| `GET /marktbericht/reports/one?id=…` | ein einzelner Bericht, mit Text |

Für den Normalfall reicht `/objects/portfolio-export` — es fasst alles
zusammen.

---

## 4 · Was die Schnittstelle **nicht** liefert

Ehrlich benannt, damit niemand danach sucht:

- **Die BMF-Detailrechnung.** Zurück ins Objekt kommt nur `geb_ant`
  (der Gebäudeanteil in Prozent); Boden-, Ertrags- und Sachwert der
  Kaufpreisaufteilung bleiben im Rechner-Fenster.
- **Die Portfolio-Cockpit-Ansicht als solche.** Ihre Zahlen entstehen
  aus denselben Objekten; die Portfolio-Analyse selbst steckt in
  `wissen.portfolio_analyse`.
- **`price_indices` / `rent_indices`** der Marktbericht-Datenbank sind
  derzeit leer (0 Zeilen, gemessen 10.10.2026).

---

## 5 · Die Rechenkerne (`v2071`)

Zwei Endpunkte nehmen einen Objektdatensatz und geben eine Rechnung
zurück. Sie heissen so, weil sie **dieselben Kerne** benutzen wie die
App — nicht eine zweite Rechnung, die irgendwann auseinanderläuft.

```
GET  /rechenkerne/                 # Verzeichnis: was es gibt und was nicht
POST /rechenkerne/rnd              # Restnutzungsdauer, rechnet HIER
POST /rechenkerne/verkehrswert     # Wertermittlung, rechnet im mb-Dienst
```

### `POST /rechenkerne/rnd` — Restnutzungsdauer

Zwei Eingabeformen, beide gültig:

```jsonc
{ "objekt": { … } }        // ein DealPilot-Datensatz, z.B. objekte[].daten
                           // aus dem Portfolio-Export — wird übersetzt
{ "eingabe": { … } }       // direkt die Kern-Eingabe
```

Optional `{ "afa": { "gebaeudeanteil": 70, "grenzsteuersatz": 42 } }`
für den steuerlichen Vergleich.

Optional `{ "zweck": "afa" }` — dann gilt als Stichtag der
**wirtschaftliche Übergang** (steuerlicher Betrachtungsbeginn) statt
des heutigen Tages. Ebenfalls optional `{ "stichtag": "2024-01-01" }`
und `{ "gnd": 70 }`; beide übersteuern die Ableitung.

Gemessen am Objekt `2026-001` (ETW, Baujahr 1962, 100 m²) über die
echte Schnittstelle, **Stand `v2073`**:

```jsonc
{
  "kern": "restnutzungsdauer",
  "eingabe_verwendet": {
    "gnd": 80,
    "gnd_herkunft": "Anlage 1 ImmoWertV, abgeleitet aus der Objektart \"ETW\"",
    "modPoints": 11,
    "modPoints_herkunft": "Feld mod_punkte im Objekt",
    "stichtag": "2026-10-10",
    "stichtag_herkunft": "heute (Verkehrswert-Stichtag)",
    "kernsaniert": true
  },
  "ergebnis": {
    "final_rnd": 28,
    "final_source": "technische Alterswertminderung (vorrangig)",
    "verfahren": "technisch",
    "methods": { "punktraster": { "restnutzungsdauer": 41.73 }, "linear": { … }, … },
    "grenzen": [ … ],
    "plausibilitaet": { "mindest_30_prozent": 24, "unterschritten": false },
    "pruefung": {
      "erforderlich": false,
      "grund": null,
      "uebernahme_gesperrt": false,
      "basis_rnd_jahre": 16,
      "loest_die_sperre": "input.reelleRND (sachverstaendig, mit Begruendung)"
    }
  }
}
```

> ### ⚠ `pruefung.uebernahme_gesperrt` VOR dem Wert lesen
>
> Steht dort `true`, **darf `final_rnd` nicht übernommen werden.** Der
> Fall tritt ein, wenn das Alter die Gesamtnutzungsdauer erreicht: die
> rechnerische Basis ist dann 0, und **daraus folgt nicht, dass die
> wirtschaftliche Restnutzungsdauer 0 ist** — sie ist sachverständig zu
> beurteilen (Modernisierung, Sanierung, baulicher Zustand,
> wirtschaftliche Nutzbarkeit; bei Kernsanierung ein fiktives Baujahr).
> Die Sperre löst nur eine dokumentierte `reelleRND`.
>
> Der Kern rechnet die Formel der Anlage 2 dort **bewusst nicht fort**.
> Am Gutachten-Modul V4.2 nachgemessen, warum: hinter ihrem
> Scheitelpunkt (bei GND 80 zwischen Alter 84 und 88,6) steigt die
> Parabel wieder. Ein 160 Jahre altes Gebäude bekäme dort 56 Jahre
> Restnutzungsdauer — mehr als ein 56 Jahre altes mit 38.
>
> Fachliche Festlegung Marcels vom 10.10.2026. Sie besagt ausdrücklich
> auch, dass Anlage 2 bei Alter ≥ GND **nicht gesetzlich ausgeschlossen**
> ist; was dort endet, ist der fachlich plausible Bereich der Formel.

> **`eingabe_verwendet` zuerst lesen, nicht das Ergebnis.** Dort steht
> mit Herkunft, was aus dem Datensatz geworden ist. **Bis `v2073` kamen
> drei Felder gar nicht an:** `gnd` lief in den Default 70 statt 80,
> `modPoints` in 0 (obwohl das Objekt 11 trägt) und der Stichtag war
> stillschweigend das Kaufdatum. Dasselbe Objekt rechnete deshalb
> **10,5 statt 28,0 Jahre**. Wer gegen eine vor dem 10.10.2026
> gezogene Zahl prüft, findet eine Abweichung, die eine ist.
>
> **`grenzen` ist kein Beiwerk.** Der Kern sagt selbst, wenn ein Wert
> sachverständig gewürdigt werden muss. Wer nur `final_rnd` übernimmt,
> verliert die Warnung — und damit die Begründbarkeit.
>
> **`final_rnd` ist nicht automatisch das Punktraster.** Hier gewinnt
> die technische Alterswertminderung mit 28,0, während Anlage 2 auf
> 41,73 kommt. Welches Verfahren gilt, ist eine Bewertungsentscheidung —
> `methods` weist alle getrennt aus, `final_source` nennt das gewählte.

### `POST /rechenkerne/verkehrswert` — Wertermittlung

Geht an den Marktbericht-Dienst, weil dort das Register der
Gutachterausschüsse liegt (Liegenschaftszins § 21 Abs. 2,
Sachwertfaktor § 21 Abs. 3, NHK 2010, Bodenrichtwerte).
`wert_stufe` 3 ist die Wertermittlung nach ImmoWertV.

> ### ⚠ Gemessen am 10.10.2026: **422, noch nicht nutzbar**
>
> ```
> "Keine Koordinaten – Adresse nicht geokodierbar und keine lat/lon angegeben."
> ```
>
> Die Adresse im Datensatz ist vollständig (`str` „Hermannstraße",
> `hnr` „9", `plz` „32609", `ort` „Hüllhorst"), und **kein** Objekt im
> Export führt Koordinaten — Felder dafür gibt es gar nicht. Der Fehler
> liegt also an der Weitergabe oder am Geokodierer, nicht an den Daten.
> **Offen und im Backlog**; `/rechenkerne/rnd` und der Export sind davon
> nicht betroffen.

### Die spätere Bepreisung ist vorbereitet, nicht gebaut

Marcel am 10.10.2026: *„Das brauchen wir jetzt nicht umsetzen."*
Drei Dinge stehen schon, damit es später eine Zeile bleibt:

1. **Eigener Namensraum** `/rechenkerne/*` — eine spätere Regel greift
   genau diesen Pfad, ohne andere Endpunkte zu treffen.
2. **Jeder Aufruf meldet sich** mit Nutzer, Kern und Dauer. Wer
   abrechnen will, hat die Zählung schon.
3. **Eine Stelle für die Freigabe:** `_darfRechnen()`. Sie lässt heute
   jeden Berechtigten durch und ist der einzige Ort, an dem später ein
   Plan-Merkmal oder ein Admin-Schalter hinein muss.

> Eine Abrechnung, die man später an zwölf Stellen einbauen muss, wird
> nicht eingebaut. Deshalb steht die Tür schon da — sie ist nur offen.
