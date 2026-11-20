# Entwurf · Datenschutzerklärung, Absatz „Einzel-Check“ (v3940)

Stand 20.11.2026 · **Entwurf, nicht eingebaut.** Marcel nimmt ab. Ziel: `frontend/datenschutz.html`,
neuer Abschnitt nach Ziffer 6 (KI-Verarbeitung durch OpenAI), z. B. als **6a**. Ziffer 12
(Speicherdauer) bekommt die Zeile unten dazu.

Jeder Satz ist gegen den Code geprüft (Fundstelle in Klammern, gehört nicht in den Kundentext).

---

## 6a. Einzel-Check ohne Konto

**(1) Was passiert.** Auf unserer Startseite können Sie ohne Konto bis zu vier Unterlagen zu einer
Immobilie hochladen, zum Beispiel ein Exposé, eine Mietaufstellung, ein WEG-Protokoll oder einen
Energieausweis. Zwei davon lesen wir kostenlos aus und geben eine grobe Einschätzung. Kaufen Sie den
Bericht, lesen wir alle Unterlagen aus und erstellen den Bericht in Ihrem Browser.
*(routes/publicEinzelcheck.js, services/einzelcheck.js, frontend/landing/einzelcheck.js)*

**(2) Die Unterlagen werden nicht gespeichert.** Die Dateien verarbeiten wir nur im Arbeitsspeicher
unseres Servers in Deutschland. Sie werden weder auf einem Datenträger abgelegt noch in einer
Datenbank gespeichert und sind nach dem Auslesen gelöscht. Gelesen werden nur PDF-Dateien mit
Textebene. *(multer memoryStorage, pdftotext über stdin/stdout; Prüfer tools/einzelcheck-pruefen.mjs Teil A)*

**(3) Schwärzung vor der KI.** Bevor ein Text ausgelesen wird, schwärzen wir automatisch nach Mustern
Namen von Personen (zum Beispiel nach einer Anrede oder im Grundbuch-Muster), Geburtsdaten,
Anschriften nach „wohnhaft“, E-Mail-Adressen, Telefonnummern, Kontonummern und Steuer-IDs. Diese
Schwärzung erkennt nicht jede Schreibweise. *(services/schwaerzen.js; Teil B)*

**(4) KI-Auslesen als Auftragsverarbeitung.** Zum Auslesen übermitteln wir nur den geschwärzten Text
an OpenAI (siehe Ziffer 6), die ihn als Auftragsverarbeiter nach Art. 28 DSGVO auf Grundlage des Data
Processing Addendum und der EU-Standardvertragsklauseln verarbeitet. OpenAI ist angewiesen, die
Anfragen nicht zu speichern, und verwendet sie nicht zum Training. OpenAI kann Anfragen bis zu 30 Tage
zur Missbrauchsprüfung vorhalten. *(callOpenAI store:false; Ziffer 6 (4) und (5))*

**(5) Lage und Wert.** Für den gekauften Bericht ermitteln wir aus der Objektanschrift Lage,
Marktdaten, Vergleichsmiete und eine Wertindikation über unseren eigenen Marktbericht-Dienst. Die
Anschrift wird dafür nur im Arbeitsspeicher verwendet und dort nicht gespeichert. Zur Ermittlung der
Koordinaten und der Marktdaten übermitteln wir die Objektanschrift beziehungsweise die Koordinaten an
unsere Dienstleister für Kartendaten und Marktdaten (siehe Ziffer 8a).
*(mb /reports/einzelcheck, ReportOrchestrator ohneAblage, GeocodingService ohneAblage)*
> **Zu prüfen (Marcel):** Ziffer 8a muss den Geocoding- und den Marktdaten-Dienstleister schon führen;
> der Einzel-Check übermittelt an dieselben wie der Marktbericht der App. Die Anbieter werden in der
> Datenschutzerklärung namentlich genannt (Pflicht), nicht im Produkt.

**(6) Was wir speichern und wie lange.** Kaufen Sie den Bericht, speichern wir für höchstens 14 Tage
nur die ausgelesenen Zahlen (zum Beispiel Kaufpreis, Wohnfläche, Miete, Baujahr, Postleitzahl und Ort,
Effizienzklasse), ohne Namen und ohne Straße, dazu einen verschlüsselten Prüfwert Ihres Kaufbelegs.
Den Kaufbeleg selbst kennt nur Ihr Browser. Damit können Sie innerhalb von 14 Tagen den Bericht erneut
erstellen, den Kaufpreis auf ein Paket anrechnen lassen und das Objekt in ein DealPilot-Konto
übernehmen. Danach löschen wir den Eintrag automatisch. Ohne Kauf speichern wir aus dem Einzel-Check
nichts außer einer Kostenzeile ohne Inhalt (verwendetes KI-Modell, Zahl der Textbausteine, Kosten).
*(Tabelle einzelcheck_kaeufe, Migration 123 mit CHECK 14 Tage, Takt einzelcheckLoeschen alle 6 h;
ki_verbrauch ohne Nutzer und ohne Text)*

**(7) Zahlung.** Die Zahlung läuft über Stripe (siehe Ziffer 7). Ihre Rechnung erstellt Stripe; Name,
Anschrift und E-Mail geben Sie dort selbst ein. Ihre Bestätigung, dass der Bericht sofort erstellt
werden soll (§ 356 Abs. 5 BGB), protokollieren wir mit Zeitpunkt und Textfassung, ohne IP-Adresse.
*(consentService.widerrufVerzichtPruefen, consent_log 3 Jahre)*

**(8) Missbrauchsschutz.** Um Missbrauch zu verhindern, begrenzen wir die kostenlosen Durchläufe je
Internetanschluss (drei am Tag). Dafür hält der Server die IP-Adresse höchstens 24 Stunden im
Arbeitsspeicher, nicht in einer Datenbank. *(express-rate-limit, Speicher im Prozess)*

**(9) Rechtsgrundlage.** Art. 6 Abs. 1 lit. b DSGVO (Durchführung des von Ihnen angefragten
Einzel-Checks und des Kaufs), für den Missbrauchsschutz Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
Interesse an einem sicheren Betrieb). Für Daten Dritter in Ihren Unterlagen (etwa Mieter oder
Eigentümer) Art. 6 Abs. 1 lit. f DSGVO, beschränkt durch Schwärzung und Nichtspeicherung.

---

## Zeile für Ziffer 12 (Speicherdauer)

> Einzel-Check ohne Konto: hochgeladene Unterlagen werden nicht gespeichert. Ausgelesene Zahlen ohne
> Namen und Straße sowie der Prüfwert des Kaufbelegs höchstens 14 Tage nach dem Kauf, danach
> automatische Löschung. Rechnung bei Stripe nach den gesetzlichen Aufbewahrungsfristen.

## Offen für die Abnahme

1. Ziffer 8a gegenlesen (Geocoding, Marktdaten) – Absatz (5) verweist dorthin.
2. Docker-Protokolle: der mb-Dienst schreibt im Lauf ohne Ablage keine Schrittzeilen mehr; die
   Zugriffsprotokolle von Caddy (IP, Pfad) gelten wie in Ziffer 5 (4) beschrieben.
3. Absatz (8): express-rate-limit hält den Zähler je IP im Arbeitsspeicher; nach einem Neustart ist er leer.
