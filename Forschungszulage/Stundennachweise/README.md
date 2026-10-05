# Stundennachweise · Forschungszulage

**Vorhaben:** 827-757-583/2026-1/1 — „Verfahren zur automatisierten, investorprofil-abhängigen
steuerlich-strukturellen Optimierung von Immobilien-Bestandsportfolios"
**Bescheinigung:** BSFZ (VDI Technologiezentrum), Bescheid vom 05.10.2026 nach § 6 FZulG, erteilt (Abschnitt A).
**Antragsteller:** Marcel Junker, Junker Solution (Einzelunternehmer) — Eigenleistung nach § 3 Abs. 3 FZulG.
**Laufzeit:** 01.01.2026 bis voraussichtlich 31.12.2028.
**Geplante Eigenleistung laut Antrag:** 2026: 900 h · 2027: 980 h · 2028: 1.470 h · Summe 3.350 h.
**Unterlagen:** `Dateien/Forschungszulage/` (Antrag, Anlagen 1–7, Bescheid, Nachforderung).

## Was hier liegt

| Datei | Inhalt |
|---|---|
| `2026-01.md` … `2026-04.md` | Vorlagen — vor dem 13.05.2026 gibt es keine Commit-Historie; Stunden von Hand eintragen |
| `2026-05.md` … `2026-10.md` | Tagesweise abgeleitet aus den Commit-Zeitstempeln, mit Tätigkeit und AP-Vorschlag |
| `uebersicht.csv` | alle Tage in einer Tabelle (Semikolon, Dezimalkomma) für Excel |

## Wie die Stunden entstanden sind — und was sie NICHT sind

Die Monatsblätter ab Mai 2026 sind **aus dem Repository abgeleitet**: je Arbeitstag der Abstand vom ersten
bis zum letzten Commit plus 30 Minuten, höchstens 10 Stunden je Tag. Der Anteil „FuE" ist der Anteil der
Commits des Tages, deren Botschaft ein Arbeitspaket trifft (Stichwortregel, siehe unten); der Rest ist
„Produkt" (Oberfläche, Landing, Deploy, Dokumentation) und zählt **nicht** als Forschungszulage.

Das ist eine **Rekonstruktion**, kein Beleg. Für das Finanzamt zählt die Aufzeichnung, die Marcel geprüft und
unterschrieben hat. Deshalb:

- Jede Zeile prüfen, Stunden korrigieren, Tage ohne Commit (Recherche, Lesen von Gesetzestexten, Gespräche
  mit Steuerberater/Gutachtern, Modellbildung auf Papier) von Hand nachtragen.
- Die Obergrenze der Eigenleistung liegt bei **40 Stunden je Woche**; der Stundensatz ist gesetzlich auf
  **70 € je Stunde** festgelegt (§ 3 Abs. 3 FZulG). Wochen über 40 h sind zu kürzen.
- Ab jetzt wird **fortlaufend** geführt: jeder Arbeitstag am selben Tag, mit AP-Nummer und Tätigkeit.
  Das Monatsblatt wird am Monatsende unterschrieben (Zeile unten im Blatt).
- Aufbewahrung: alle Belege und Stundenzettel zehn Jahre (Hinweis im Antrag, S. 3).

## Arbeitspakete (aus Anlage 1 des Antrags)

| AP | Inhalt | Woran man es im Repo erkennt |
|---|---|---|
| AP 1 | Zielfunktion | Portfolio-Zielfunktion, Barwert, Steuerlast über alle Objekte |
| AP 2 | Steuer-Rechenkern | AfA-Methodenwechsel, § 7b-Cap, V+V-Ergebnis, Tarif § 32a, Verlustverrechnung, BMF-Aufteilung, 15-%-Grenze |
| AP 3 | Normableitung | Normtext zu Rechengröße, Wahlrechte als Exklusionsrelation |
| AP 4 | Datenfusion | Bewertungsquellen, Korrelationsprüfung, Liegenschaftszins-/Sachwertfaktor-Register, Marktbericht, BORIS |
| AP 5 | Szenario-Engine / Vergleichsmaß | Vergleich fester Varianten, 10-Jahres-Barwert, Cashflow nach Steuer |
| AP 6 | Heuristische Suche | Startheuristik, lokale Suche, Zuordnung und Zeitpunkt, Portfolio-Pilot |
| AP 7 | Restriktions- und Fristenmodell | Fristen und Freibeträge als verbrauchbare Budgets, § 23, § 15, § 22 UmwStG, ErbStG |
| AP 8 | Ereignisextraktion aus Freitext | Spracheingabe, Dialog, Telegram, Import aus Exposé/PDF, Regeln mit Rückfrage |
| AP 9 | Profilgewichtung | Investorprofil, Deal Score, profilabhängige Gewichte, Konvergenzprüfung |
| AP 10 | Validierung | Referenzbestand, Prüfläufe, Fehlalarmanalyse, Messungen |

Die Stichwortregel des Generators ordnet Commit-Botschaften diesen Paketen zu (Steuer/AfA/BMF → AP 2,
Marktbericht/Register/Zins/Faktor → AP 4, Portfolio/Szenario → AP 6, Fristen/Freibeträge → AP 7,
Sprache/Dialog/Import → AP 8, Profil/Score/Kennzahlen → AP 9, Prüfung/Messung/Test → AP 10). AP 1 und AP 5
lassen sich aus Commit-Botschaften nicht sicher erkennen und sind von Hand zuzuordnen.

## Fortschreiben

Generator: `tools/stundennachweis-generator.mjs` (liest `git log`, schreibt die Monatsblätter neu — **überschreibt
nur Monate, die noch nicht unterschrieben sind**; ein unterschriebenes Blatt wird vorher kopiert). Handnachträge
gehören in die Tabelle „Nachträge von Hand" am Ende jedes Blatts, nicht in die generierte Tabelle.
