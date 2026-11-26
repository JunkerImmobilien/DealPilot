# Konzept: Haus-Check für Selbstnutzer (Eigennutzer-Bericht)

Stand 26.11.2026 · HH6 · nur Konzept und Muster, nichts am Produkt gebaut.
Marcel: „Variante A ist cool. Kann man daraus dann auch einen kompletten Bericht machen, der für Eigennutzer was taugt, auch dass die Unterlagen reinladen können?“

- Demo Landing (Variante A mit Upload): https://staging.dealpilot.immo/demo-eigennutzer-landing-a.html?selbst=1&upload=1
- Muster-PDF: `Dateien/Konzepte/Eigennutzer-Bericht-Muster/Haus-Check-Eigennutzer-Muster.pdf` (13 Seiten), auf Staging: https://staging.dealpilot.immo/demo-eigennutzer-bericht.pdf
- Vorlage: `Dateien/Konzepte/Eigennutzer-Bericht-Muster/bericht.html` (statisches HTML, per Headless-Chrome gedruckt)

## 1. Ablauf

Derselbe Weg wie beim Deal-Check: **erst auslesen, dann Grundangaben, dann rechnen**.

1. Umschalter in der Deal-Check-Karte: „Zum Vermieten · Selbst nutzen“ (Variante A).
2. Schnell-Ergebnis kostenlos: Kaufpreis, Wohnfläche, Baujahr, PLZ, optional Eigenkapital und Netto-Einkommen → Score „Ist das Haus gut?“ mit vier Gruppen.
3. Unterlagen reinladen (optional, aber Voraussetzung für den kompletten Bericht):
   - Haus: Exposé, Energieausweis, Grundriss, Baubeschreibung bzw. Modernisierungsliste, Flurkarte
   - Wohnung zusätzlich: Protokolle der Eigentümerversammlung, Wirtschaftsplan, Teilungserklärung, Hausgeldabrechnung
4. Auslesen mit denselben Schemas wie im Deal-Check (`dokumentSchemas.js`), Abweichungen zwischen Unterlagen werden gemeldet (Muster: Exposé 135 m² gegen Grundriss 130 m²).
5. Grundangaben bestätigen, dann Bericht erzeugen und kaufen.

## 2. Inhalt des Berichts (Muster: 13 Seiten)

| Kap. | Inhalt | Quelle im Bestand |
|---|---|---|
| Deckblatt | Karte mit Pin, Score-Ring, vier Kacheln (Wertindikation, ersparte Miete, Rate, „Kaufen lohnt ab Jahr X“) | Deal-Check-PDF-Deckblatt |
| 1 Kurzurteil | Score mit Preis, Zustand, Lage, Leistbarkeit, je ein Satz, „Was du wissen solltest“ | neu (Kern `eigennutzer-score`) |
| 2 Unterlagen | gelesene Unterlagen, Grundangaben mit Herkunft, Abweichungen | Deal-Check (auslesen, Grundangaben) |
| 3 Preis gegen Wert | Sachwert (EFH) bzw. Vergleichswert (ETW) mit Rechenweg, Marktpreisindikation „kein Verkehrswert“, Kaufpreis in Jahresmieten. „Verkehrswert“ nur bei Stufe 3 nach ImmoWertV | Marktbericht-Kern (CrossCheckService, nhk2010, Register) |
| 4 Kaufen oder mieten | Vermögen Kaufen gegen „Mieten und anlegen“ über 20 Jahre, Schnittpunkt, Tabelle 5/10/X/20 | neu (Rechnung aus demo-eigennutzer.js) |
| 5 Leistbarkeit | Finanzierung, Beleihung, Zins heute, Rate, Instandhaltung, Belastungsquote mit Ampel, Zinsrisiko nach Bindung | App-Finanzierung, Bauzins-Route |
| 6 Zustand und Sanierung | Baujahr-Checkliste, Unterlagen-Funde, Heizung und GEG (30-Jahre-Pflicht, 65 % bei Tausch, Pflichten nach Eigentümerwechsel), Heizkosten aus Energieausweis, grobe Kosten je Gewerk. ETW: Beschlüsse, Sonderumlagen, Rücklage | besichtigung.js, Haus & Unterlagen, sonderumlage.js |
| 7 Förderung | KfW Heizungsförderung, BAFA Einzelmaßnahmen und Energieberatung, KfW Kredite, allgemein mit Prüfvorbehalt | neu (Textbaustein, jährlich pflegen) |
| 8 Lage | Makrolage, Leerstand, Bevölkerung, Bodenrichtwert, Nahversorgung, Lärm | Marktbericht |
| 9 Checkliste | abhakbar zum Ausdrucken, aus Unterlagen + Baujahr + allgemein | besichtigung.js |
| 10 Kaufnebenkosten | GrESt je Land, Notar und Grundbuch nach GNotKG, Makler | gnotkg.js, GrESt-Tabelle |
| 11 Quellen und Methodik | Herkunft je Zahlenart, Grenzen | Deal-Check-Quellenseite |

**Zahlen im Muster** (erfundenes Objekt Musterstraße 12, 33602 Bielefeld, EFH, 130 m², Bj 1998, 310.000 €): Score 75 Gut (Preis 77, Zustand 75, Lage 57, Leistbarkeit 85), Wertindikation 314.000 € (Sachwert, Beispielwerte), Marktpreisindikation 304.000 €, ersparte Miete 1.091 €, Kaufnebenkosten 35.680 € (GrESt 20.150, Notar 2.975, Grundbuch 1.488, Makler 11.067), Darlehen 245.680 €, Rate 1.247 €, Wohnkosten 31,5 % vom Netto, Kaufen günstiger ab Jahr 16.

Hinweis: Die Landing-Demo rechnet mit pauschal 10 % Nebenkosten (Rate 1.223 €, ab Jahr 14). Der Bericht rechnet mit den echten Posten (11,5 %). Im Produkt nimmt beides dieselbe Rechnung.

## 3. Preisvorschlag (Marcel entscheidet)

- **Variante 1 · wie Deal-Check:** Schnell-Ergebnis kostenlos, kompletter Bericht 3,99 €. Niedrige Schwelle, viele Leads, KI-Kosten des Auslesens pro Bericht im Blick behalten.
- **Variante 2 · Eigennutzer-Paket:** Schnell-Ergebnis kostenlos, Bericht 14,90 € inklusive Marktbericht-Werten der Stufe 2 und Besichtigungs-Checkliste als eigenes PDF. Eigennutzer kaufen einmal, nicht laufend, daher höherer Einzelpreis.

## 4. Was wiederverwendet wird und was neu ist

| Baustein | Stand | Aufwand |
|---|---|---|
| Upload, Auslesen, Grundangaben, Kauf, PDF-Pipeline | Deal-Check, vorhanden | gering: Objektart „selbst nutzen“ durchreichen, Schema-Felder Energieausweis/Modernisierung prüfen |
| Wertermittlung, Lage, Karte, Quellen | Marktbericht, vorhanden | gering |
| Vergleichsmiete mit Hauszuschlag | Mietspiegel-Kette (v5080/v5110), vorhanden | gering: Mittelwert statt Oberwert für Selbstnutzer |
| Besichtigungs-Checkliste | besichtigung.js, vorhanden | gering: als PDF-Seite |
| GNotKG, GrESt | vorhanden | keiner |
| Eigennutzer-Score (Preis, Zustand, Lage, Leistbarkeit) | neu | mittel: eigener Kern, ins Backend spiegeln, Prüfer |
| Kaufen oder mieten (20 Jahre) | neu | gering bis mittel |
| GEG-Pflichten und Sanierungskosten je Gewerk | neu | mittel: Regeltabelle mit Fundstellen, jährlich pflegen (Jahreswerte-Register) |
| Förderteil | neu | gering, aber Pflege nötig |
| Landing Variante A + Upload-Einstieg | Demo vorhanden | gering bis mittel |
| PDF-Vorlage „Haus-Check“ | Muster vorhanden | mittel: in dp-dokumente.js überführen |

Grobe Gesamtschätzung: ein größeres Paket (3 bis 4 Forks parallel), davon Score-Kern und PDF-Vorlage die längsten Teile.

## 5. Offene Fragen an Marcel

1. Preis: Variante 1 (3,99 €) oder 2 (14,90 €)?
2. Netto-Einkommen abfragen (nur freiwillig, nicht gespeichert) ja oder nein?
3. Gewichtung im Score: Preis 30 · Zustand 20 · Lage 20 · Leistbarkeit 30 so lassen?
4. Ersparte Miete mit Mittelwert (Vorschlag) statt Oberwert der Investorenlogik, einverstanden?
5. Soll für ETW-Selbstnutzer der WEG-Teil (Protokolle, Rücklage, Sonderumlagen) ins Kurzurteil eingehen?
