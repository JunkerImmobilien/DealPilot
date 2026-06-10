# DealPilot — Marktbericht-Microservice · Übergabe / Projektstand

**Zweck dieses Dokuments:** Kontext für die Weiterarbeit in einem neuen Chat. Code liegt im selben ZIP.
Sprache: casual Deutsch (du-Form), direkt, kopierbare Bash-Befehle. Owner: Marcel Junker (nicht-technisch,
testet LOKAL via ZIP + `docker compose` und beurteilt nach Screenshots des gerenderten PDF / der Web-UI).

---

## Produkt & Kontext
- Standalone **Marktbericht-Microservice** unter DealPilot (Junker Immobilien). Erzeugt eine deutschsprachige
  Immobilien-Marktwerteinschätzung als (a) Web-Ergebnis-Anzeige, (b) PDF, (c) teilbare Angebot-Seite.
- Soll später in die DealPilot-Hauptapp integriert werden (eigenes Projekt, eigener Chat-Kontext).

## Stack
- **Backend:** Node 22 / Express (ESM), PostgreSQL + PostGIS. Container, DB-Port 5433, Backend-Port 4000.
- **Frontend:** Vanilla JS, KEIN Build-Step, volume-mounted. jsPDF 2.5.1 + autotable, Chart.js, Leaflet (CDN).
- **Proxy:** Caddy. Express mountet API unter `/api/v1/marktbericht`, BORIS unter `/api/boris`, Frontend statisch unter `/`.
- **Server-Einstieg:** `backend/src/server.js`. Router: `backend/src/routes/api.js`.

## Lokales Deploy (Marcel)
```bash
cd ~/Downloads
mv marktbericht marktbericht.bak.$(date +%H%M)
unzip -o marktbericht.zip
cd marktbericht
docker compose up -d --build
```
Danach **Strg+Shift+R**. Frontend ist volume-mounted (sofort live); Backend-Code wirkt erst nach `--build`.

## Arbeitsweise / Konventionen
- **Diagnose-First:** Sandbox hat KEIN Netz/SSH (web_search/web_fetch gehen). Echte Funktionen/IDs/Antworten via
  Marcel-Output verifizieren, nie raten. Nach 2–3 Fehlversuchen STOPP + Konsole-/Netzwerk-Diagnose.
- **Cache-Bump:** Bei JEDEM Frontend-Release den `?v=`-Token bumpen in `index.html`, `app.js`, `angebot.html`.
  **Aktueller Stand: `?v=49k`.**
- `node --check` nach jeder JS-Änderung. Anchor-basierte Python/str_replace-Patches, **kein** `sed` auf JS-Logik.
  Uploads sind oft stale → Live-Stand per grep verifizieren.
- Auslieferung: kumulatives ZIP nach `/mnt/user-data/outputs/marktbericht.zip`:
  `cd /home/claude && rm -f marktbericht.zip && zip -rq marktbericht.zip marktbericht -x '*/node_modules/*' -x '*/.env' -x '*/.git/*' -x '*/.DS_Store' -x '*.bak'`
- PDF/Web-UI sind im Sandbox NICHT renderbar → Marcel screenshot-testet. Preview-PDFs (PIL-Annäherung via
  `render_preview.py`) nur als grobe Selbstkontrolle, ersetzen den echten Export NICHT.
- Bei Optik-Kritik IMMER konkretes Element nennen lassen, statt breit zu raten.

## Wichtige Architektur-Fakten (Fallen!)
- **`q(text, params)` in `backend/src/lib/db.js` gibt das Zeilen-ARRAY zurück (`res.rows`), NICHT `{rows}`.**
  → Konsumenten nutzen `rows.length` / `rows[0]`, niemals `r.rows`. (War die Ursache des Angebot-500.)
- **`/api/v1/marktbericht/reports/replay?key=<object_key>`** liefert den kompletten gespeicherten `out` (out._replay=true).
  Speicherung: `saveFixture(out)` nach jedem generate → Tabelle `mb.report_fixtures(key, address, result JSONB)`
  (Migration 003). `ensureFixtures()` legt Schema+Tabelle bei Bedarf idempotent an. key='last' + object_key.
- **Teilbare Angebot-Seite:** `frontend/angebot.html?key=<object_key>` lädt via Replay → Hero (Street View →
  Fallback `/static-map`), Marktbewertungs-Karte (dpmb), Kennzahlen, Deal-Score, Makro-Kacheln (wenn vorhanden),
  Lage-Karte (Leaflet, POI-Marker je Kategorie + Isochrone-Overlay), KI-Text. Teilen-Button im Tool kopiert den Link.
- **Datenobjekt (`out.data`):** `ref`, `address` (mit `.lat`/`.lon`/`.formatted`), `sale`, `rent`, `micro`
  (groups[cat] = {label, score, score5, items:[{name,distance_m,lat,lon}]}), `macro` ({score, breakdown, estimated}),
  `valuation` (market_value{estimated,low,high,confidence_label,confidence_pct,basis_median_sqm}, yield, rent_estimate),
  `deal_score` ({score, rating, breakdown}), `land_value`, `cross_check`, `market_history`, `price_trend_pct`.
  `report_md` und `object_key` liegen TOP-LEVEL in `out`.
- `render(out)` in `app.js` rendert die Web-Ergebnis-Anzeige; `window._lastOut = out`.

## Design-System
- Obsidian `#050505`/`#0d0d11`, Gold `#C9A84C`. Satte DealPilot-Ampel: Grün `#43B77C`, Gold `#C9A84C`,
  Rot `#D9685F` (Tier: ≥70 grün, ≥50 gold, <50 rot). Fonts: Space Grotesk / JetBrains Mono / Inter.
- POI-Kategorie-Farben: einkaufen `#43B77C`, verkehr `#C9A84C`, gesundheit `#5AA0E6`, freizeit `#C77DD9`,
  bildung `#E8946A`, gastronomie `#D9685F`; Objekt-Marker Gold.

## Relevante ENV-Variablen (in `.env` neben docker-compose.yml; werden via compose durchgereicht)
- `GEOMAP_TOKEN` — GeoMap-Marktdaten (Kauf/Miete-KPIs, Historie). **Hauptkostentreiber, pro Bericht mehrere Abrufe.**
- `GEOMAP_REPORT_LISTINGS` (Default 0) — >0 zieht einzelne Vergleichsinserate (kostet extra). 0 = nur aggregierte Quartile.
- `GEOMAP_HISTORY_START=2018`, `GEOMAP_HISTORY_RENT`
- `GEOAPIFY_KEY` — Geocoding, POIs, Static-Map, Isochrone (Free-Tier).
- `GOOGLE_MAPS_KEY` — Street View Static (Angebot-Hero). Ohne Key → 503 → Karten-Fallback. Im Google-Projekt
  „Street View Static API" + Billing aktivieren. Test: `…/streetview?lat=52.1087&lon=8.6784`.
- `DESTATIS_TOKEN` / `DESTATIS_PASSWORD` / `DESTATIS_BASE` (regionalstatistik.de GENESIS) +
  `DESTATIS_TABLE_POP=12411-01-01-4`, `DESTATIS_TABLE_INCOME=82411-01-03-4`, `DESTATIS_TABLE_UNEMP=13211-02-05-4`
  (Regionalstatistik-Codes mit Bindestrichen, NICHT die Destatis-Bundescodes wie 12411-0014).
- `BORIS_NRW_WMS` + `BORIS_NRW_LAYER`; `BORISD_WMS_BASE` + `BORISD_WMS_LAYER=brw_sonstige_flaechen` (BORIS-D, 11 Länder).
- `REPORT_AI_MODE=openai`, `OPENAI_MODEL=gpt-4.1-mini` (Bindestriche! Leerzeichen → 404 → Stub-Fallback),
  `OPENAI_API_KEY`. KI-Text via `backend/src/services/ReportGenerationService.js` (System-Prompt = `report_prompt.txt`).

## In dieser Session erledigt
- **Teilbare Angebot-Seite** `angebot.html` (Hero, dpmb-Karte, Kennzahlen, Deal-Score, Makro-Kacheln, Lage-Karte
  mit POI-Markern + Erreichbarkeits-Isochrone, KI-Text) + Teilen-Button + Auto-Replay (`index.html?angebot=KEY`).
- **Backend-Proxies:** `/streetview` (env-gated, Key serverseitig), `/isoline` (Geoapify Isochrone). compose reicht
  `GOOGLE_MAPS_KEY` durch. `MicroLocationService` trägt jetzt `lat/lon` je POI (für Karten-Marker).
- **Angebot-500 gefixt:** `q()` liefert Array — `r.rows` war der Bug. An 4 Stellen korrigiert (replay, fixtures-Liste,
  objects, history). `ensureFixtures()` legt die Tabelle bei Bedarf an.
- **Makro-Label ehrlich:** zeigt echten Grund (z. B. `Destatis nicht verfügbar: kein_wert_geparst`) statt „Token nötig".
- **Bericht zusammengefasst:** ausführlicher Teil von 16 Kapiteln → **3 Abschnitte** (A Zusammenfassung & Empfehlung,
  B Objekt/Lage/Markt, C Bewertung/Rendite/Ausblick), zusammenhängender Fließtext. Per-Abschnitt-Score-Pillen ENTFERNT
  (ein maßgeblicher Score = Deal-Score + Zusammensetzung auf Seite 1). Geändert: `report_prompt.txt` (Gliederung),
  `ReportGenerationService.js` (CHAPTER_GROUPS = 3 Gruppen, „Fließtext"-Anweisung), `app.js` (PDF_SECTION_TITLES,
  `SECTION_SCORE = {}`).
- **PDF-Tacho an Web-Optik angeglichen:** Ampelbogen (grün→gold→rot, bei Miete invertiert) statt Gold-Füllung,
  Wert mittig im Tacho, **dünne Nadel (0,4 mm) ohne Glow** + kleine helle Nabe.
- **PDF-Politur:** Überschriften-Orphan-Schutz (`need(22)` reserviert Titel + ~3 Zeilen), dezenter kurzer Gold-Akzent
  statt voller Linie, mehr Absatz-/Abschnittsabstand, große Gold-Kartenwerte auto-skaliert (kein Überlauf).

## Offene Punkte / Nächste Schritte
1. **GeoMap liefert „keine Daten" (Regression beim Testen):** Vergleichspreise/-mieten/Markttempo/Historie fielen auf
   FEHLT, Marktwert auf „Spanne pauschal ±10 %". Höchstwahrscheinlich **Guthaben aufgebraucht** (jeder neue Bericht
   zieht GeoMap-Credits). Prüfen: `…/geomap/balance` + `docker compose logs backend | grep -iE "geomap|kpi|402|429|quota" | tail`.
   Beim Layout-Iterieren **Replay/„Letzten Bericht laden" nutzen** (keine GeoMap-Kosten), nicht neu generieren.
2. **Destatis `kein_wert_geparst`:** GENESIS antwortet, aber Parser zieht keinen Wert (Tabellenformat). Rohantwort holen:
   `…/destatis/raw?ags=05758&table=12411-01-01-4` (Kreis Herford) + `…/destatis/macro?ags=05758` + `…/destatis/check`
   → `_parseSeries` in `backend/src/connectors/stubConnectors.js` an echte Struktur anpassen. Dann werden Sozioökonomie
   + Makro-Kacheln live.
3. **Gelbe PDF-Formatierung:** Marcel meldet, dass gelbe Texte „manchmal nicht passen". Konkreten Screenshot der Stelle
   einholen (Überschrift? Kartenwert? Kennzahl?) und gezielt fixen. (Kartenwerte sind bereits auto-skaliert.)
4. **Street View:** sobald `GOOGLE_MAPS_KEY` gesetzt + API aktiv → Fassaden-Hero. Status der Test-URL klären (Bild/503/404/502).
5. **Zensus-CSV** `backend/data/zensus2022_kreise.csv` ist Platzhalter (Leerstand/Eigentümerquote) → mit Zensus-2022-
   Kreiswerten befüllen.
6. **Optional:** Makro-Kacheln auch ins PDF; Angebot-Seite Phase 2 (Marktentwicklungs-Chart, Foto-Galerie/Upload).

## Datei-Übersicht (Auswahl)
- `frontend/index.html` (inline CSS, Ergebnis-DOM), `frontend/app.js` (~2500 Z.: render, PDF-Builder mit `gauge()`/
  `drawValueCard`, `mdToPdfLines`, PDF_SECTION_TITLES, Share/Replay), `frontend/angebot.html` (teilbare Seite),
  `frontend/marktbewertung-card.js` + `.css` (self-contained „dpmb"-Karte, `DealPilotMarktbewertung.mount`).
- `backend/src/routes/api.js` (alle Endpoints inkl. replay/streetview/isoline/static-map/destatis-debug),
  `backend/src/lib/db.js` (`q` → Array!), `backend/src/services/ReportOrchestrator.js` (Pipeline, Provenance/
  Datengrundlage-Labels), `ReportGenerationService.js` (KI, CHAPTER_GROUPS), `report_prompt.txt` (System-Prompt),
  `ScoringService.js` (macroScore/Deal-Score), `MicroLocationService.js` (POIs + lat/lon),
  `backend/src/connectors/` (Geoapify, GeoMap, stubConnectors=Destatis, boris/registry.js).
- `docker-compose.yml` (env-Durchreichung), `backend/migrations/` (003 = report_fixtures).
