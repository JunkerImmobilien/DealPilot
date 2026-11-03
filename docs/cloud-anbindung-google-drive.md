# Google Drive anbinden — Einrichtung (für Marcel)

Stand 03.11.2026 · Ziel: Kunden verbinden ihren eigenen Google-Drive-Ordner (mit Unterordnern) als
Datenraum. Die Dateien bleiben beim Kunden, DealPilot liest sie nur — mit dem bestehenden Eingang
(Prüffenster, Vier-Augen-Prinzip, Schwärzen). Gespeichert wird bei uns nur, was gelesen wurde, und ein
Verweis auf die Datei.

## Was du anlegen musst (einmalig, ca. 20 Minuten)

1. **Google Cloud Console** öffnen: https://console.cloud.google.com — mit dem Google-Konto von Junker Solution.
2. **Neues Projekt** anlegen, Name z. B. „DealPilot Datenraum“.
3. **APIs aktivieren** (Menü „APIs & Dienste“ › „Bibliothek“):
   - Google Drive API
   - Google Picker API
4. **OAuth-Zustimmungsbildschirm** („APIs & Dienste“ › „OAuth-Zustimmungsbildschirm“):
   - Nutzertyp: **Extern**
   - App-Name: DealPilot · Support-E-Mail und Entwickler-E-Mail: deine
   - App-Domain: die Adresse der App, Link zur Datenschutzerklärung und zu den AGB
   - Autorisierte Domains: die Domain der App (Prod) und die Staging-Domain
   - Bereiche (Scopes): zunächst nur `.../auth/drive.file` (siehe unten, „Ganzer Ordner“)
   - Testnutzer: dein eigenes Google-Konto (solange die App im Testmodus ist)
5. **Anmeldedaten** („APIs & Dienste“ › „Anmeldedaten“):
   - „Anmeldedaten erstellen“ › **OAuth-Client-ID** › Typ „Webanwendung“
   - Autorisierte JavaScript-Quellen: `https://app.staging.dealpilot.immo` und die Prod-Adresse
   - Autorisierte Weiterleitungs-URIs: `https://app.staging.dealpilot.immo/api/v1/cloud/google/rueckruf`
     und dieselbe Adresse für Prod
   - zusätzlich „Anmeldedaten erstellen“ › **API-Schlüssel** (für die Dateiauswahl), beschränkt auf die
     Picker API und auf die beiden Domains
6. **Die drei Werte auf dem Server eintragen** — nicht in den Chat schreiben. In
   `/opt/dealpilot/.env` auf Staging (später Prod) diese drei Zeilen ergänzen:
   ```
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   GOOGLE_PICKER_API_KEY=…
   ```
   Danach mir Bescheid geben — ich starte das Backend neu und teste.

## Ganzer Ordner mit Unterordnern — die eine offene Frage

Google kennt zwei Arten des Zugriffs:

| Freigabe | Was DealPilot sieht | Prüfung durch Google |
|---|---|---|
| `drive.file` | nur die Dateien und Ordner, die der Kunde in der Dateiauswahl anklickt | keine aufwendige Prüfung |
| `drive.readonly` | alles im Drive des Kunden (lesend) | **eingeschränkter Bereich**: Prüfung durch Google und jährliche Sicherheitsbewertung durch einen externen Prüfer (kostenpflichtig) |

Ob `drive.file` beim **Auswählen eines Ordners** auch dessen Inhalt und Unterordner freigibt, ist in
Googles Doku nicht eindeutig beschrieben; Berichte aus der Entwickler-Community sagen eher nein. Wir
testen das zuerst mit `drive.file` auf Staging:

- **Reicht es** — dann bleibt es bei der leichten Freigabe.
- **Reicht es nicht** — dann gibt es zwei Wege: (a) der Kunde wählt in der Dateiauswahl die Dateien
  des Ordners aus (Mehrfachauswahl, auch aus Unterordnern), oder (b) wir beantragen `drive.readonly` mit
  der Prüfung durch Google. Für (b) entscheidest du, weil die Sicherheitsbewertung Geld kostet.

## Datenschutz

- Lesezugriff nur auf das, was der Kunde freigibt; Zugriff jederzeit in DealPilot und in seinem
  Google-Konto widerrufbar.
- Die Zugangsschlüssel (Tokens) liegen verschlüsselt auf unserem Server, je Konto getrennt.
- Dateien werden zum Lesen kurz geladen, auf dem Server geschwärzt (wie heute) und nicht gespeichert.
- Die Datenschutzerklärung braucht einen Absatz zu Google Drive (Anbieter, Zweck, Widerruf). Den
  Entwurf liefere ich mit.

## Danach

Dropbox und Microsoft OneDrive nach demselben Muster — dort ist Lesen eines ganzen Ordners mit
Unterordnern ohne Sonderprüfung möglich (Dropbox verlangt ab 50 Nutzern eine Freigabe der App).
