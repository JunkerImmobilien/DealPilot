# DealPilot Marktbericht-Service (Standalone)

Eigenständiger Marktbericht-Service, architektonisch so gebaut, dass er später
1:1 in DealPilot wandert (Node/Express, Postgres+PostGIS, Connector-Pattern wie `avm.js`,
API-Prefix `/api/v1/marktbericht`).

## Was ist echt angebunden
- **Geoapify** – Geocoding + POI/Mikrolage (dein Key)
- **OSM Overpass** – POI-Fallback (keyless)
- **OpenAI** – KI-Bericht (dein Key, per ENV aktivierbar)
- **Vergleichs-Marktdaten** – Seed-Generator (realistische DE-Angebote) + CSV-Import-Endpoint
  > Es gibt für DE keine kostenlose offene Kaufpreis-API. GeoMap/PriceHubble später als Drop-in-Connector.
- **BORIS-NRW** – echte amtliche Bodenrichtwerte (Open Data, dl-de/zero-2-0), via WMS GetFeatureInfo. Nur NRW; kein Key noetig.
- **Destatis/Makro** – bewusst weggelassen (Token noetig); als dokumentiertes Stub-Geruest vorhanden.

## Schnellstart mit Docker (empfohlen)
```bash
cp .env.example .env
# .env editieren: GEOAPIFY_KEY und (optional) OPENAI_API_KEY + REPORT_AI_MODE=openai
docker compose up --build
```
Migration + Seed laufen automatisch. Dann:
- Dashboard:  http://localhost:4000/
- Health:     http://localhost:4000/api/v1/marktbericht/health

## Start ohne Docker
Voraussetzung: lokales PostgreSQL mit PostGIS auf Port 5433 (oder PGHOST/PGPORT anpassen).
```bash
cd backend
npm install
cp ../.env.example .env   # Keys eintragen; PGHOST/PGPORT auf deine DB
node src/lib/migrate.js
node src/lib/seed.js
node src/server.js
```

## KI echt aktivieren
In `.env`:
```
REPORT_AI_MODE=openai
OPENAI_API_KEY=sk-...
```
Ohne das läuft der Stub-Modus (deterministisches Template, kein API-Call).

## Wichtige Endpunkte
| Methode | Pfad | Zweck |
|--|--|--|
| POST | `/api/v1/marktbericht/reports/generate` | Vollbericht erzeugen |
| GET  | `/api/v1/marktbericht/reports/:propertyId` | letzten Bericht holen |
| GET  | `/api/v1/marktbericht/market/location?lat=&lon=&listing=kauf` | Marktstats Punkt |
| GET  | `/api/v1/marktbericht/comparables/:propertyId` | Vergleichsobjekte |
| GET  | `/api/v1/marktbericht/micro/:propertyId` | Mikrolage |
| GET  | `/api/v1/marktbericht/geocode?address=` | Geocoding |
| POST | `/api/v1/marktbericht/import/offers` | eigene Angebote importieren |
| POST | `/api/v1/marktbericht/import/dealpilot` | DealPilot-Objekte als Vergleichspool importieren |
| POST | `/api/v1/marktbericht/import/geomap` | echte GeoMap-Angebote fuer einen Standort holen |
| GET  | `/api/v1/marktbericht/geomap/balance` | GeoMap-Guthaben (EUR netto) |
| GET  | `/api/v1/marktbericht/boris?lat=&lon=&year=` | Bodenrichtwert am Punkt (BORIS-NRW) |
| GET  | `/api/v1/marktbericht/stats/offers` | Seed-Sanity-Check |

## CSV/JSON-Import eigener Angebote
```bash
curl -X POST http://localhost:4000/api/v1/marktbericht/import/offers \
  -H 'Content-Type: application/json' \
  -d '{"offers":[{"listing_type":"kauf","property_type":"wohnung","city":"Huellhorst","postcode":"32609","lat":52.3186,"lon":8.671,"living_area":75,"build_year":1998,"condition":"gepflegt","price":210000,"offer_date":"2026-02-01"}]}'
```

## GeoMap echte Vergleichsdaten (api.geomap.immo)
Liefert echte Kauf-/Mietangebote DE/AT/CH. Auth per Bearer-Token aus dem GeoMap-Account,
Guthaben EUR-basiert (Mindestaufladung 300 EUR netto). Zweistufig: ID-Suche + Detail-Abruf
(Details ziehen Guthaben -> `GEOMAP_MAX_DETAILS` begrenzt die Kosten pro Abruf).

In `.env`: `GEOMAP_TOKEN=...` setzen. Dann fuer einen Standort einmal abrufen (wird 30 Tage
gecached, kein Doppelabruf):
```bash
# Guthaben pruefen
curl http://localhost:4000/api/v1/marktbericht/geomap/balance

# echte Angebote fuer einen Standort holen (per Adresse ODER lat/lon)
curl -X POST http://localhost:4000/api/v1/marktbericht/import/geomap \
  -H 'Content-Type: application/json' \
  -d '{"address":"Hermannstr. 9, 32609 Huellhorst","radiusKm":5}'
```
Danach nutzt die Vergleichs-Engine automatisch die echten GeoMap-Angebote (source_code=geomap).
`force:true` erzwingt einen Neuabruf trotz Cache.

## BORIS-NRW Bodenrichtwert (amtlich, Open Data)

Echte Bodenrichtwerte der Gutachterausschuesse NRW ueber den WMS-GetFeatureInfo-Dienst.
Kein API-Key noetig, Lizenz dl-de/zero-2-0 (auch kommerziell frei). Nur NRW-Abdeckung.

```bash
# Bodenrichtwert an einem Punkt (Hüllhorst)
curl "http://localhost:4000/api/v1/marktbericht/boris?lat=52.3186&lon=8.671"
# optional Stichjahr (2011-2026):
curl "http://localhost:4000/api/v1/marktbericht/boris?lat=52.3186&lon=8.671&year=2024"
```

Antwort: `value_sqm` (EUR/m2), `stichtag`, `nutzung`, `zone`, plus `properties_raw`
(Rohfelder der Zone - falls das Feld-Mapping mal nachjustiert werden muss).
Punkte ausserhalb NRW liefern `available:false, reason:"ausserhalb_nrw"`. Im Marktbericht
fliesst der Wert automatisch in Kapitel I) Bodenrichtwertanalyse ein.
Wichtig: Bodenrichtwert = unbebautes Grundstueck, ist kein Verkehrswert.

## DealPilot-Objekte importieren
Exportiere deine DealPilot-Objekte als JSON und kippe sie als echten Vergleichspool rein.
Akzeptiert flache Objekte ODER Backend-Form `{id, data:{...}}`. Pro Objekt entstehen ein
Kauf- und ein Miet-Vergleichspunkt (sofern Kaufpreis/Miete vorhanden); Standort wird aus der
Adresse geokodiert (Geoapify), falls keine lat/lon vorhanden sind.
```bash
curl -X POST http://localhost:4000/api/v1/marktbericht/import/dealpilot \
  -H 'Content-Type: application/json' \
  -d '{"objects":[{"kp":225000,"nkm":780,"wfl":80,"objart":"ETW","str":"Hermannstr.","hnr":"9","plz":"32609","ort":"Huellhorst","baujahr":1995}]}'
```

## Architektur (Datenfluss)
```
Adresse/Objekt-Input
  -> GeocodingService (Geoapify)        -> mb.addresses
  -> MarketAnalysisService (PostGIS)    -> mb.offers (Seed/CSV) -> Median/Quantile/IQR/Konfidenz
  -> MicroLocationService (Geoapify/OSM)-> POI-Distanzen -> Mikro-Score
  -> ScoringService                     -> Makro-Score (Stub) + Deal-Score
  -> ValuationService                   -> Marktwert + Spanne + Rendite
  -> ReportGenerationService            -> Stub-Template ODER OpenAI
  -> mb.market_reports                  -> JSON + Markdown + Dashboard
```

## Spätere DealPilot-Integration
- Router unter `/api/v1/marktbericht` als zusätzlichen `app.use(...)` ins bestehende Express-Backend hängen.
- Migration-SQL ins eigene Schema `mb` -> keine Kollision mit `objects`/`users`/`tax_snapshots`.
- Vergleichsdaten/AVM: `MarketAnalysisService` als Consumer der bestehenden `avm.js`-Engine umstellen
  (Single Source of Truth, analog zur DSCR-Regel) statt eigener Marktdaten-Quelle.
- Mikrolage/POI koennen den bestehenden Objekt-Tab speisen.

## Roadmap-Connector-Slots (vorbereitet)
- `GeoMapConnector.marketOffers()` -> echte Vergleichsangebote
- `BorisConnector.landValue()` -> NRW echt angebunden; weitere Bundeslaender = je eigener Adapter
- `DestatisConnector.macro()` -> GENESIS/Regionalstatistik fuer echten Makro-Score
- Mietindex/Preisindex-Zeitreihen -> Miet-/Kaufpreisentwicklung + 3-5-Jahres-Prognose
