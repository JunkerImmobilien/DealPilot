# Anfragen an die Gutachterausschüsse Straubing-Bogen und Roth

Zwei getrennte Mails, gleicher Text, nur der Ausschuss wechselt. Beide Berichte sind frei abrufbar und enthalten Werte, erlauben aber nur eine nichtkommerzielle Nutzung.

---

**An:** gutachterausschuss@landkreis-straubing-bogen.de
**bzw.:** gutachterausschuss@landratsamt-roth.de

**Betreff:** Nutzung Ihres Grundstücksmarktberichts in einer Bewertungssoftware

Sehr geehrte Damen und Herren,

ich betreibe mit DealPilot eine Software zur Investitionsanalyse von Wohnimmobilien. Für die Ertragswert- und Sachwertermittlung möchte ich die Liegenschaftszinssätze und Sachwertfaktoren aus Ihrem aktuellen Grundstücksmarktbericht verwenden.

Ihr Bericht erlaubt die Nutzung nur für nichtkommerzielle Zwecke. Da DealPilot kostenpflichtig angeboten wird, frage ich vorher nach.

Geplant ist Folgendes:

- Die Werte fließen als Rechengröße in indikative Bewertungen einzelner Objekte in Ihrem Zuständigkeitsbereich ein. Der Bericht wird weder als Ganzes noch als Tabelle weitergegeben.
- Jeder Bericht nennt Ihren Gutachterausschuss als Quelle, mit Jahrgang, Stichtag, Seite und Link.

Meine Fragen:

1. Dürfen wir die Werte so verwenden?
2. Wenn ja, zu welchen Bedingungen, und welchen Quellenvermerk wünschen Sie?
3. Falls eine Nutzung nur gegen Entgelt möglich ist: Wie hoch wäre es?

Bis zu Ihrer Antwort verwenden wir die Werte nicht und verweisen unsere Kunden direkt auf Ihren Bericht.

Mit freundlichen Grüßen

Marcel Junker
Junker Solution · DealPilot

---

*Intern, nicht mitsenden:* Die Sperren stehen in `marktbericht/backend/src/lib/register/lzs-swf-by-2026-sperren.json` mit `zugang: nichtkommerziell` (Ernte 20.11.2026). Kommt eine Zusage: Werte aus dem Bericht als neue Satzdatei mit Lizenzvermerk der Zusage ernten (Agent `register-ernte`), Sperre ablösen, `saat-pruefen` und `wertermittlung-pruefen` laufen lassen.
