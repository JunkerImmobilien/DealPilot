# Amtliche Gratis-Datenquellen (Tier 1) — so füllst du sie

Ziel: ein eigener Marktbericht, der die ~5–6 €/Bericht von Sprengnetter/PriceHubble
unterbietet. Beide Quellen hier sind **kostenlos** und **amtlich**.

---

## 1) Destatis / Regionalstatistik (Makro-Score) — nur ein Token nötig

Der Connector ist fertig gebaut. Es fehlt nur der kostenlose Zugang:

1. Auf https://www.regionalstatistik.de registrieren (kostenlos).
2. Im Profil deinen **Token** (32-stellig) bzw. Benutzerkennung holen.
3. In `/opt/dealpilot/.env` bzw. der lokalen `.env` eintragen:
   ```
   DESTATIS_TOKEN=dein_token_hier
   DESTATIS_PASSWORD=
   ```
   (Bei Token-Login bleibt `DESTATIS_PASSWORD` leer.)
4. `docker compose down && docker compose up --build`
5. Prüfen im Browser: `http://localhost:4000/api/v1/marktbericht/destatis/check`
   → sollte `ok: true` zeigen. Danach füllt sich der Makro-Score mit echten Werten
   (Bevölkerung, Einkommen, Arbeitslosenquote) statt dem neutralen Default 50.

---

## 2) Zensus 2022 (Leerstand + Eigentümerquote + Ø-Miete) — eine CSV befüllen

Diese Werte gibt es nicht per einfachem Token-API, aber als **freie amtliche Daten**.
Du trägst sie einmalig in die Datei `zensus2022_kreise.csv` (neben dieser README) ein.

### Format (Trennzeichen Semikolon, deutsches Komma als Dezimaltrennzeichen)
```
ags;name;leerstandsquote;eigentuemerquote;nettokaltmiete_qm
05758;Kreis Herford;3,1;48,2;7,1
05770;Kreis Minden-Lübbecke;2,9;55,4;6,8
```
- `ags` = 5-stelliger Kreisschlüssel (Amtlicher Gemeindeschlüssel, erste 5 Stellen).
- Werte als Prozent bzw. €/m² mit Komma. Spalten, die du nicht hast, einfach leer lassen.
- Die mitgelieferte Beispielzeile (`00000;…`) wird vom System ignoriert.

### Woher die Zahlen?
1. https://ergebnisse.zensus2022.de → Thema **Wohnungen** → Kennzahlen
   **Leerstandsquote** und **Eigentümerquote** (Ebene: Kreise/kreisfreie Städte).
2. Optional Ø-Nettokaltmiete (Thema Haushalte/Wohnungen).
3. Werte je Kreis in die CSV übertragen (für deine Testregionen reichen 2–3 Zeilen;
   bundesweit ~400 Kreise für volle Abdeckung).

Tipp: Du musst nicht alle 400 Kreise auf einmal pflegen — fang mit deinen Regionen
(OWL/NRW) an, der Bericht zeigt dann genau dort die Werte; für unbekannte Kreise
bleibt der Abschnitt einfach leer (kein Fehler, keine erfundenen Zahlen).

### Prüfen
`http://localhost:4000/api/v1/marktbericht/zensus/check`
→ zeigt, wie viele Kreise geladen wurden, welche Spalten erkannt wurden + ein Beispiel.

Quellenangabe (wird im Bericht automatisch gesetzt):
„© Statistische Ämter des Bundes und der Länder, 2024".
