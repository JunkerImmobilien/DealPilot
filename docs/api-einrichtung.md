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
| Voraussetzung | aktiver **Pro-Plan** am Konto — siehe Warnung unten |

> ### ⚠ Gemessen am 10.10.2026: der Plan blockiert noch
>
> Ein frisch angelegter Schlüssel wird **erkannt**, der Aufruf endet aber
> mit **403 · „API access requires an active Pro plan"**.
>
> Der Grund steht in `backend/src/middleware/auth.js`:
> ```js
> const PRO_PLAN_IDS = ['pro'];
> ```
> Das Konto trägt auf Staging den Plan **„Partner"**, und der steht nicht
> in dieser Liste. **Ein 403 heißt hier also nicht „Schlüssel falsch".**
>
> Zwei Wege, beide sind eine Produktentscheidung:
> 1. `'partner'` in `PRO_PLAN_IDS` aufnehmen (eine Zeile), oder
> 2. das Konto auf `pro` setzen (Eingriff in die Datenbank).
>
> Bis das entschieden ist, laufen alle Aufrufe über die **angemeldete
> Sitzung** statt über den Schlüssel.

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

Antwort (rund **890 KB** bei 23 Objekten, ohne Fotos):

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
