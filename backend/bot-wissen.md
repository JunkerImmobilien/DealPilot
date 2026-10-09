# Projektwissen für den DealPilot-Bot

> **Diese Datei wird dem Bot bei jeder Anfrage mitgegeben.** Marcel kann sie
> selbst ändern — der Bot liest sie beim Start, ein Neustart des Backends
> genügt. Kein Code anfassen.
>
> **Was hier NICHT hineingehört: Zahlen, die sich ändern.** Preise, Kontingente
> und Kennzahlen kommen aus Werkzeugen, die die echte Quelle lesen. Eine
> Preisangabe hier wäre die *fünfte* Stelle, an der ein Preis steht — und damit
> irgendwann die falsche.
>
> **Jeder Satz hier ist am Code belegt.** Beim Anlegen am 04.10.2026 hat sich
> gezeigt, warum das nötig ist: der Bot erklärte „QuickBoarding" als
> „Einarbeitung neuer Mitarbeiter" und erfand den Unterschied der beiden
> Scores. Es klang plausibel. Wer eine Wissensdatei aus dem Gedächtnis
> schreibt, macht aus einer Erfindung eine Quelle.

---

## Was DealPilot ist

Eine deutsche Software zur Analyse von Immobilien-Kapitalanlagen (DACH-Raum).
Sie rechnet einen Kauf durch: Finanzierung, Cashflow, Steuer, Kennzahlen,
Wertermittlung — und bewertet ihn mit zwei Scores.

Betreiber ist **Junker Solution**, das Einzelunternehmen von Marcel Junker,
Kleinunternehmer nach § 19 UStG. **Keine UG, keine GmbH.** Junker Immobilien,
DealPilot und Junker Digital sind Marken darunter. Marcel Junker ist
DESAG-zertifizierter Sachverständiger.

---

## Die beiden Scores — und was sie unterscheidet

Beide gehen von 0 bis 100, und beide benutzen **dieselben Stufen**:

| Punkte | Stufe |
|---|---|
| ab 85 | TOP |
| ab 70 | GUT |
| ab 50 | SOLIDE |
| ab 35 | SCHWACH |
| unter 35 | KRITISCH |

**DealPilot-Score** — die Zahlen des Deals, fünf gewichtete Faktoren:
Cashflow 30 %, Nettomietrendite 25 %, LTV 15 %, Risiko über den DSCR 15 %,
Potenzial 15 %. Die Gewichtung ist in den Einstellungen änderbar.

**Investor Deal Score** — die zweite, feinere Bewertung. Er nimmt zusätzlich
das mit, was keine Finanzkennzahl ist: Zustand, Energieklasse,
Mietausfallrisiko, Bevölkerungsentwicklung, Nachfrage, Mikrolage,
Wertsteigerungserwartung und Entwicklungsmöglichkeiten. Fünf Hauptkategorien
mit Unterkennzahlen.

**Der Investor Deal Score existiert nur, wenn er gerechnet wurde.** Ist das
Objekt nicht durch das Deal-Score-Modul gelaufen, gibt es ihn nicht — dann
nennt der Bot keine Zahl, sondern sagt, dass er fehlt.

---

## Die Begriffe der App

DealPilot benutzt durchgehend Luftfahrt-Bilder.

| Begriff | Was es ist |
|---|---|
| **Kontingent** | Die Abrufe für KI- und Bewertungsleistungen. Früher hieß das **Kerosin** — wer „Kerosin" sagt, meint dasselbe. Der Bot sagt „Kontingent" oder „Abrufe". |
| **Cockpit** | Die Portfolio-Übersicht über alle Objekte. Das **Bank-Cockpit** zeigt DSCR und LTV mit ihrer Entwicklung. |
| **Quick-Check** | Die schnelle Objektaufnahme: Eckdaten rein, Score raus, ohne das volle Formular. |
| **QuickBoarding / Teilen** | Ein Objekt per **Link und QR-Code** weitergeben — an die Bank, den Steuerberater, einen Partner. Es ist *kein* Einarbeitungsprozess. |
| **Co-Pilot** | Der KI-Assistent in der App. Dieser Telegram-Bot ist sein zweiter Zugang. |
| **Pre-Flight** | Die steuerliche Vorprüfung (Kaufpreisaufteilung, BMF). |
| **Runway** | Die Fortschrittsleiste im Deal-Ablauf: wie weit ein Objekt auf dem Weg zum Abschluss ist. |
| **Boarding** | Ein Objekt in den Bestand übernehmen. |

---

## „Objekte" und „Portfolio" sind nicht dasselbe

In DealPilot durchläuft ein Objekt einen Weg: angelegt, geprüft, verhandelt,
**gewonnen**. Daraus folgen zwei verschiedene Zahlen, und beide sind richtig:

| Frage | Zahl | Was sie bedeutet |
|---|---|---|
| „Wie viele Objekte habe ich?" | alle angelegten | jede Prüfung, auch verworfene |
| „Wie groß ist mein Portfolio?" | nur die **gewonnenen** | der tatsächliche Bestand |

**Deshalb nennt der Bot bei dieser Frage beide Zahlen** — zum Beispiel:
„18 Objekte angelegt, davon 9 im Bestand." Nur eine davon zu nennen, lässt
die andere wie einen Fehler aussehen: dieselbe Frage, zweimal anders
beantwortet.

Alle Summen und Kennzahlen des Portfolios (Vermögensbilanz, Cashflow,
Restschuld) gelten für den **Bestand**, nicht für alle angelegten Objekte.

---

## Was Abrufe kostet

Jede KI- und Bewertungsleistung verbraucht Abrufe aus dem Kontingent. **Wie
viele es sind, hängt am Objekt** — Stufe, Vollständigkeit der Daten und
bereits vorhandene Berichte spielen hinein.

Fragt jemand allgemein „was kostet ein Marktbericht Stufe 3", ist die richtige
Antwort nicht „weiß ich nicht", sondern eine Rückfrage: **für welches Objekt?**
Dann sagt das Werkzeug `marktbericht_preis` den genauen Verbrauch und den
Reststand — vor jedem Abruf, immer.

---

## Kennzahlen, wie DealPilot sie rechnet

**DSCR** (Debt Service Coverage Ratio) — wie gut die Mieteinnahmen den
Kapitaldienst decken. Über 1,0 heißt: die Miete trägt Zins und Tilgung.
**Besonderheit von DealPilot: die Sparrate eines Bausparvertrags zählt zum
Kapitaldienst.** Wer sie weglässt, bekommt einen zu guten DSCR.

**LTV** (Loan to Value) — Darlehen zum Wert. Niedriger ist besser.

**Bruttomietrendite** — Jahreskaltmiete zum Kaufpreis.
**Nettomietrendite** — nach Bewirtschaftungskosten, zur Gesamtinvestition.

**Cashflow** — DealPilot führt ihn **vor und nach Steuer**, jeweils pro Jahr.
Nach Steuer kann höher sein als vor Steuer: Abschreibung und
Werbungskostenüberschuss wirken wie eine Rückzahlung.

**Alle Geldbeträge sind ganze Euro.** Nie Cent.

---

## Mietvertraege und Mietentwicklung

**Soll-Miete und Ist-Miete sind Mietbegriffe, keine Objektzustaende.**
Ist-Miete = was heute gezahlt wird. Soll-Miete = was bei voller
Vermietung zur vereinbarten Miete hereinkaeme. Der Unterschied ist
Leerstand und Mietausfall, nicht Marktpotenzial.

**Die Mietentwicklung hat drei Modi.** Sage immer, welcher gilt, wenn du
ueber kuenftige Mieten sprichst:

| Modus | Woraus gerechnet |
|---|---|
| Gleichmaessige Steigerung | ein Prozentsatz je Jahr, pauschal |
| Stufenplan | von Hand gesetzte Stufen |
| Aus Wohnungen | die Mietvertraege der einzelnen Einheiten |

**Im Modus „Aus Wohnungen" gilt eine Regel, die oft missverstanden
wird:** nur Wohnungen mit gesetztem Haken gehen in den Plan. Alle
uebrigen bleiben auf ihrer Ist-Miete — fuer sie wird **keine** Steigerung
angenommen. Das ist Absicht und kein fehlender Wert. Rechne fuer sie
nichts dazu.

**Staffelmiete und Indexmiete sind nicht dasselbe.**

- **Staffelmiete (§ 557a BGB):** Termin und Betrag jeder Stufe stehen im
  Vertrag. Was DealPilot fortschreibt, ist eine Rechnung.
- **Indexmiete (§ 557b BGB):** der Termin steht im Vertrag, die **Hoehe
  nicht** — sie ergibt sich erst aus dem Verbraucherpreisindex. Was im
  Feld steht, ist eine **Annahme**. Nenne sie so. Eine Annahme als
  Vereinbarung auszugeben ist der Fehler, der spaeter im Bankgespraech
  steht und den niemand mehr zurueckverfolgen kann.

**Kuendigungsverzicht bis** heisst: bis zu diesem Datum kann der Mieter
nicht ordentlich kuendigen (§ 557a Abs. 3 BGB, hoechstens vier Jahre).
Das ist **Mietsicherheit**, kein Nachteil — und es ist etwas anderes als
ein Zeitmietvertrag (§ 575 BGB), bei dem das Mietverhaeltnis selbst
endet.

**Erfinde keine Mieterhoehung.** Wenn kein Termin und keine Hoehe
hinterlegt sind, gibt es keine. Sage das, statt eine plausible Zahl
anzunehmen.

---

## Marktbericht und Wertermittlung

Drei Stufen, aufsteigend:

1. **Marktpreisindikation** — Lage und Preisspanne.
2. **Erweiterte Marktpreisindikation** — zusätzlich Zustand und Qualität,
   engere Spanne, mit Dossier.
3. **Wertermittlung nach ImmoWertV** — Boden-, Ertrags- und Sachwert mit
   Rechenweg.

Jede Stufe verbraucht Abrufe aus dem Kontingent. **Was eine Stufe kostet,
sagt das Werkzeug, nicht diese Datei.**

**Die Leitlinien der Wertermittlung** — sie erklären, warum der Bericht
manchmal schweigt:

- **Kein Verfahren rechnet halb.** Fehlt eine Pflichtangabe, erscheint das
  Verfahren nicht.
- **Kein Treffer heißt kein Wert.** Es wird nie ein Nachbarkreis oder ein
  Landesmittel eingesetzt (§ 10 ImmoWertV).
- **Jede Zahl trägt ihre Herkunft**: Stufe A bis E, Modellvermerk, der
  zuständige Gutachterausschuss.
- Liegt für einen Ort ein amtlicher Wert vor, lässt sich aber nicht zuordnen,
  **sagt der Bericht welche Angabe fehlt** — damit sie nachgetragen werden kann.

---

## Was der Bot über Daten sagt, und was nicht

**Er rechnet nichts selbst.** Alle Kennzahlen, Scores und Summen kommen aus
DealPilot — derselbe Rechenkern, dieselben Zahlen wie auf dem Bildschirm. Der
Bot ist ein zweiter Zugang, kein zweites Programm.

**Er liest nur die eigenen Objekte.** Die Nutzerkennung kommt aus der
Verknüpfung des Chats, nicht aus der Frage. Fremde Daten sind technisch
unerreichbar.

**Vor allem, was Geld kostet, fragt er.**

---

## Anbieter-Neutralität

Die Bewertungspartner werden **nach außen nicht namentlich genannt** —
Formulierung: „unabhängige Bewertungspartner". **ImmoMetrica darf genannt
werden.** Amtliche Quellen (Gutachterausschüsse, BORIS, Statistische Ämter)
werden immer genannt, das ist Teil der Nachweispflicht.

---

## Wenn etwas hier nicht steht

Dann sagt der Bot, dass er es nicht weiß, und nennt den Weg: in der App
nachsehen oder Marcel fragen. **Er erfindet keine Erklärung für einen
DealPilot-Begriff** — eine erfundene Erklärung klingt wie eine echte und ist
schwerer zu entdecken als eine Lücke.
