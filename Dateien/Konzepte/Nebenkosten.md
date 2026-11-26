# Wohnnebenkosten je Gemeinde für den Haus-Check (nn6, 26.11.2026)

Marcel 26.11.2026: „kannst du den genau ermitteln? können wir dafür datenbanken anlegen?“ (Pauschale 2,00 €/m² im Eigennutzer-Kern)

## Was es gibt
| Posten | Quelle | Feinheit | Stand |
|---|---|---|---|
| **Grundsteuer** | Regionaldatenbank 71231-01-03-5 (Aufkommen B, Hebesatz B) ÷ 31231-02-01-5 (Wohnfläche), kalibriert auf den Bundesschnitt der Grundsteuer der Wohnung | **je Gemeinde** (alle Länder) | Jahr 2024, vor der Reform |
| Wasser und Abwasser | Bundesschnitt (Betriebskostenspiegel, intern) | Bund | Abrechnungsjahr 2024 |
| Müll | Bundesschnitt | Bund | 2024 |
| Gebäudeversicherung | Bundesschnitt | Bund | 2024 |
| Schornsteinfeger | Bundesschnitt | Bund | 2024 |
| Straßenreinigung | Bundesschnitt | Bund | 2024 |
| Strom Außen/Allgemein | Bundesschnitt | Bund | 2024 |

Bundessumme 1,08 €/m² im Monat (Grundsteuer 0,18 · Wasser 0,29 · Müll 0,16 · Versicherung 0,31 · Schornstein 0,04 · Straße 0,04 · Strom 0,06). Gartenpflege und Hausreinigung fehlen bewusst: der Eigennutzer macht sie selbst.

## Warum die Grundsteuer so und nicht über das Landesmodell
- Seit 2025 gelten neue Messbeträge und neue Hebesätze. Die Regionaldatenbank führt bis heute nur 2024. Den alten Hebesatz mit einem neuen Messbetrag zu multiplizieren wäre falsch (die Gemeinden haben die Sätze zur Reform gezielt verschoben).
- Die Reform war je Gemeinde **aufkommensneutral** angelegt. Darum trägt das Aufkommen B je m² Wohnfläche als Ortsniveau weiter.
- Das Aufkommen B enthält auch Gewerbe- und andere Nichtwohngrundstücke. Faktor K = Bundesschnitt Wohnung ÷ (Σ Aufkommen B ÷ Σ Wohnfläche) zieht diesen Anteil im Mittel ab.
- Ergebnis ist ein **Durchschnitt der Gemeinde**, kein Bescheid. Ein Haus mit großem Grundstück liegt im Bundesmodell meist darüber. Eine echte Objektrechnung (Bundesmodell Anlage 39 BewG, Ländermodelle BW, BY, HH, HE, NI) wäre der nächste Schritt; sie braucht die neuen Hebesätze 2025 je Gemeinde, die es frei noch nicht gesammelt gibt.

## Schnittstelle
- Funktion: `marktbericht/backend/src/lib/nebenkosten/nebenkosten.js` → `nebenkostenFuer(ags, { wfl, art })`
- Route: `GET /api/v1/marktbericht/nebenkosten?ags=05758020&wfl=140&art=efh`
- Antwort: `{ posten:[{id,name,qm_monat,eur_monat,herkunft:'gemeinde'|'bund',text}], summe_qm, summe_monat, herkunft_text, hinweis, gemeinde }`

## Einbindung in den Eigennutzer-Kern (KK6, Datei nicht angefasst)
Der Kern nimmt schon `e.betriebskosten_qm` (Annahmen-Block, Vorrang vor der Pauschale 2,00). Der Aufrufer (Landing haus-check, App, Bericht-Pipeline) holt vorher die Route und setzt:
```
e.betriebskosten_qm = antwort.summe_qm;            // statt Pauschale
e.betriebskosten_herkunft = antwort.herkunft_text; // NEU: der Kern sollte diesen Text statt „Pauschale 2,00 €/m²“ zeigen
e.betriebskosten_posten = antwort.posten;          // optional für die Aufstellung im PDF
```
Im Kern genügt eine Zeile: `uebrigHerkunft = e.betriebskosten_herkunft || ('Pauschale ' + …)`. Werte aus den Unterlagen (`betriebskosten_monat`) behalten Vorrang.

## Pflege
- Jahreswerte-Register: `nebenkosten_grundsteuer` (fällig 31.03.2027: prüfen, ob das Jahr 2025 erschienen ist) und `nebenkosten_bund` (fällig 15.01.2027, neuer Betriebskostenspiegel im Dezember).
- Neu holen: `tools/nebenkosten-grundsteuer-holen.mjs` im mb-Container, dann `tools/nebenkosten-grundsteuer-bauen.mjs <roh.json>`, dann `tools/nebenkosten-pruefen.mjs`.

## Offen
- Wasser und Abwasser je Land: die statistischen Landesämter veröffentlichen Entgelte (z. B. Sachsen, Hessen, Berlin-Brandenburg, Statistik Nord), eine zentrale maschinenlesbare Tabelle aller Länder habe ich nicht gefunden (GENESIS-Suche ohne Treffer). Nächster Schritt: Landesberichte einzeln ernten, Trinkwasser €/m³ + Grundgebühr + Schmutzwasser + Niederschlagswasser je m² versiegelt.
- Müll: keine freie zentrale Quelle je Kreis gefunden. Bleibt Bundesschnitt.
- Grundsteuer nach Landesmodell je Objekt (siehe oben).
