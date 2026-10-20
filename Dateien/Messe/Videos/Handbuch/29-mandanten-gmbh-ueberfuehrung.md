# 29 · Mandanten, GmbH als Halter, Überführung und Jahresabschluss

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: noch kein Video (Kandidat „Mandanten/GmbH-Halter" in Videoreihe.md) ·
> Messe-Geschichte: 6 „Überführung in die GmbH" — Am Markt 9 und Hölderlinstr. (design/Messe/demo-geschichten.md)

## 1 · Wozu

Viele Investoren halten nicht alles privat. In DealPilot legst du fest, **wem** ein Objekt gehört: dir privat oder einer deiner Gesellschaften (GmbH/UG). Für dich privat pflegst du dein zu versteuerndes Einkommen über die Jahre (**Steuerzeiträume**); die Gesellschaft rechnet mit Körperschaftsteuer, ohne Progression. Ein Privatobjekt überführst du mit einem Assistenten in die GmbH — beide Seiten bleiben verknüpft. Und für die Gesellschaft liefert DealPilot die Zahlen für Bilanz und GuV.

## 2 · Wo in der App

- **Einstellungen → Mandanten**: Karten je Halter (Privat in allen Plänen; Gesellschaften GmbH/UG mit eigenem Steuerregime im Pro-Plan). Jede Karte zeigt, welche Objekte ihr gehören.
  - *Privat → Bearbeiten → Steuerzeiträume:* „Gültig von", „Gültig bis (leer = laufend)", „zvE / Jahr (€)", „Grund", Notiz → Hinzufügen. Überschneidungen meldet DealPilot.
  - *Gesellschaft:* Identifikation, Körperschaftsteuer + Soli (Vorgabe **15,825 %**), Gewerbesteuer-Hebesatz, erweiterte Kürzung, Buchhaltung (Kontenrahmen, Stammkapital …), Kosten der Gesellschaft je Jahr; „Überführung starten".
- **Am Objekt:** Halter wählen. **Seitenleiste:** Halter-Filter (z. B. „Demo Immobilien GmbH").
- **Reiter Steuer → 📅 Steuerzeiträume verwalten →** springt zu den Mandanten.
- **Deal-Aktion → „In Gesellschaft überführen"** (`ueberfuehrung-wizard.js`): fragt Stichtag, Gesellschaft, Verkehrswert als AfA-Basis und übernommenen Zins; weist auf Grunderwerbsteuer und verdeckte Einlage hin; prüft die Zehnjahresfrist nach § 23 EStG. Danach friert das Privatobjekt ein, ein verlinktes GmbH-Objekt entsteht mit Werten, Fotos und Analyse. Ohne angelegte Gesellschaft: Hinweis „Keine Gesellschaft (GmbH/UG) angelegt …".
- **Portfolio-Cockpit → Jahresabschluss** (nur mit GmbH/UG): Gesellschaft und Geschäftsjahr wählen → Jahresabschluss erstellen (Bilanz, GuV, Anlagenspiegel je Objekt).

## 3 · Schritt für Schritt — Beispiel Am Markt 9 und Hölderlinstr. (Demo Immobilien GmbH)

| Schritt | Klick | Was die App zeigt |
|---|---|---|
| 1 | Seitenleiste → Halter-Filter „Demo Immobilien GmbH" | die Objekte der Gesellschaft |
| 2 | Objekt 2026-1002 (privat) neben 2026-1007 (GmbH) | Privatobjekt **endet am 01.01.2026**, das GmbH-Objekt rechnet **ab 01.01.2026** weiter |
| 3 | Hölderlinstr. (2026-1008), Reiter Steuer, Jahr 2026 | Ergebnis **1.953 €** → Körperschaftsteuer **309 €** (privat wären es rund **814 €**) |
| 4 | Verlustjahr in der GmbH | **keine Erstattung** bei Verlust — anders als privat |

Warum 309 statt 814 €? In der Gesellschaft gilt der feste Satz (15,825 % inkl. Soli), privat der persönliche Grenzsteuersatz.

**Belegt:** Geschichte 6 in demo-geschichten.md (Objektnummern, Stichtag, 1.953 € → 309 €, privat rund 814 €, 15,825 %, keine Erstattung bei Verlust); Felder und Ablauf aus `help.js` („Mandanten und Steuerzeiträume", „In eine Gesellschaft überführen", „Jahresabschluss für GmbH und UG") und `ueberfuehrung-wizard.js` (Kopf, Vorbedingung). Bilanzzahlen live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Lohnt sich die GmbH?"** — DealPilot zeigt die Steuer beider Seiten nebeneinander. Die Entscheidung — mit Grunderwerbsteuer, verdeckter Einlage, Spekulationsfrist — gehört zum Steuerberater.
- **„Mein Einkommen ändert sich."** — Steuerzeiträume: je Jahr gilt das zvE des Zeitraums zur Jahresmitte.
- **„Gibt es eine Anlage V für die GmbH?"** — Nein, die Einkünfte sind gewerblich. Stattdessen Bilanz und GuV.

## 5 · Grenzen und Kennzeichnung

- **Keine Steuerberatung** (§ 6 StBerG). Hinweise zu Grunderwerbsteuer, verdeckter Einlage und § 23 EStG sind Hinweise, keine Prüfung.
- Der Jahresabschluss ist **kein aufgestellter Jahresabschluss nach §§ 242 ff. HGB**, sondern die Zahlen dafür in HGB-Gliederung. Was DealPilot nicht kennt (Einlagen, Kautionen, Bankbewegungen), steht offen als **Verrechnungskonto Gesellschafter** — nicht versteckt.
- Fehlt der KSt-Satz einer Gesellschaft, steht „nicht hinterlegt".
- Verlustverrechnungsgrenzen (§ 15a, § 15b, § 10d EStG) bleiben außen vor.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Einstellungen → Mandanten | Karte Privat, Karte GmbH | Wem gehört das Objekt? Dir privat oder deiner Gesellschaft — jede mit eigenem Steuerregime. |
| 2 | Steuerzeiträume | Zeitraum hinzufügen | Dein Einkommen ändert sich — DealPilot rechnet jedes Jahr mit dem passenden zvE. |
| 3 | Deal-Aktion | In Gesellschaft überführen | Der Assistent fragt Stichtag, Gesellschaft, Wert und Zins — und nennt Grunderwerbsteuer und Spekulationsfrist. |
| 4 | Privat- und GmbH-Objekt nebeneinander | Halter-Filter | Privat endet am Stichtag, die GmbH rechnet weiter. Beide bleiben verknüpft. |
| 5 | Steuer Hölderlinstr. 2026 | — | 1.953 € Ergebnis: 309 € Körperschaftsteuer statt rund 814 € privat. Aber keine Erstattung bei Verlust. |
| 6 | Cockpit → Jahresabschluss | erstellen | Bilanz und GuV über alle Objekte der Gesellschaft — die Lücke steht offen als Verrechnungskonto. |

### Sprechertext (Entwurf, ca. 85 Sekunden)

Nicht jedes Objekt gehört dir privat. In den Einstellungen unter Mandanten legst du deine Gesellschaften an — mit Körperschaftsteuer, Gewerbesteuer-Hebesatz und den Kosten der Gesellschaft. Am Objekt wählst du dann den Halter.

Für dich privat pflegst du Steuerzeiträume. Ändert sich dein Einkommen, rechnet DealPilot jedes Jahr mit dem richtigen Wert.

Willst du ein Objekt in deine GmbH bringen, startest du in der Deal-Aktion die Überführung. Der Assistent fragt Stichtag, Gesellschaft, Wert und Zins, und er weist dich auf Grunderwerbsteuer und die Zehnjahresfrist hin. Danach endet das Privatobjekt am Stichtag, und die Gesellschaft rechnet weiter.

Im Beispiel: eintausendneunhundertdreiundfünfzig Euro Ergebnis kosten in der GmbH dreihundertneun Euro Steuer — privat wären es rund achthundert. Dafür gibt es in der Gesellschaft keine Erstattung bei Verlust.

Und am Jahresende liefert DealPilot die Zahlen für Bilanz und GuV. Für die Beratung bleibt dein Steuerberater zuständig.

## Querverweise

- Handbuch 10 (Steuer-Grundlagen, zvE), 21 (Deal-Aktion), 23 (Cockpit: Steuer über alle Objekte, Jahresabschluss), 13 (Anlage V), 26 (Einstellungen)
