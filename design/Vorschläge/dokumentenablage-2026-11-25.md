# Dokumentenablage je Objekt · Entscheidungsvorlage (25.11.2026)

Marcel 25.11.2026: „Wurden die PDFs jetzt auf dem Server abgelegt? Hat der Kunde dort eine Ansicht oder einen Bereich, wo er ablegen kann?“

## Stand heute (gemessen auf Staging, 25.11.2026)

| Frage | Antwort | Beleg |
|---|---|---|
| Werden eingelesene PDFs gespeichert? | **Nein.** Gelesen, Werte übernommen, Datei verworfen. Gespeichert werden Name, Art, Datum und die übernommenen Werte. | `object-actions.js` v3163 (Marcel 03.11.: „lesen wir die nur aus und verwerfen die später“), `unterlagen-eingang.js` `schonHtml()` |
| Gibt es einen Ablagebereich für den Kunden? | **Nein, nicht sichtbar.** | `frontend/js/dateiablage.js` ist gebaut, aber von `index.html` nicht geladen („VORERST NICHT EINGEBUNDEN“) |
| Gibt es die Technik dafür? | **Ja, vollständig, seit v3162.** | `backend/src/routes/dateien.js`, `services/dateiAblage.js`, Tabelle `dateien` |
| Was liegt heute in der Ablage? | Staging: 733 Objektfotos (Quelle `objektfoto`, seit v3310), 1 Makler-Hub-Datei, 4 Testdateien vom 03.11. Keine Mietverträge, keine Belege. | `select quelle, ordner, count(*) from dateien` |

Prod nicht gemessen (Lesezugriff in dieser Sitzung gesperrt). Laut Code gleiche Lage: der Eingang legt nichts ab.

## Was schon gebaut ist (v3162)

- **Speicherort:** Laufwerk `backend_uploads` (`/app/uploads/dateien/<nutzer>/<datei>`), übersteht den Neubau des Containers. Umzug auf S3 ersetzt nur drei Funktionen (`_schreiben`, `_lesen`, `_entfernen`).
- **Verschlüsselung:** jede Datei AES-256-GCM, Schlüssel `DATEI_SCHLUESSEL` in der `.env`. Ohne Schlüssel wird nichts gespeichert.
- **Grenzen je Plan:** Free 100 MB · Starter 500 MB · Investor 2 GB · Pro 10 GB · Partner 25 GB, je Datei höchstens 25 MB.
- **Ordner:** Pfade mit Unterordnern, Standard je Objekt: Kauf & Objekt, Finanzierung, Mietverträge, WEG, Steuer, Rechnungen, Bewertung, Sonstiges. `ordnerFuer()` legt eingelesene Dateien automatisch in den passenden Ordner (Rechnungen nach Jahr).
- **Routen:** Liste, Hochladen, Herunterladen (entschlüsselt), Verschieben/Umbenennen, Löschen (auch vom Laufwerk), Speicherstand. Mit API-Schlüssel nutzbar.

## Zu entscheiden

1. **Ablage einschalten?**
   - A · Ja, als Karte „Dokumente“ im Reiter Haus & Unterlagen, Eingang legt jede gelesene Datei automatisch ab (abschaltbar je Upload).
   - B · Ja, aber nur manuell: Kunde legt selbst ab, der Eingang verwirft weiter.
   - C · Nein, wie heute (nur Werte).
   *Empfehlung:* A mit Häkchen „Original aufbewahren“ (Standard an). Der Zusammenhang Wert ↔ Beleg ist für Steuer und Bank der eigentliche Nutzen.
2. **Kontingente:** die Grenzen oben übernehmen? Fotos zählen heute mit. *Empfehlung:* übernehmen, Fotos nicht mitzählen.
3. **DSGVO / AVV:** Mietverträge enthalten Daten Dritter (Mieter). Nötig: Eintrag im Verzeichnis der Verarbeitungstätigkeiten, Datenschutzerklärung um „Speicherung hochgeladener Unterlagen“ ergänzen, AVV-Anlage für Partner (Unterauftrag Hetzner, Standort Deutschland). Nach [[avv-erst-bei-echtem-partner]] erst mit erstem echten Partner, die Datenschutzerklärung aber vor dem Einschalten.
4. **Löschung:** Objekt gelöscht → Dateien mit löschen (heute: Objekt auf „verloren“, Dateien bleiben). Konto gekündigt → nach 30 Tagen löschen, vorher ZIP-Export anbieten. Aufbewahrungspflichten (10 Jahre für Belege) liegen beim Kunden, Hinweis im Text.
5. **Partner-Zugriff:** Partner sieht die Ablage seines Mandanten nur mit dessen Freigabe (dauerhaft oder einmalig, wie Steuerdaten, siehe [[partner-steuerjahr-freigabe]]). Übergabe eines Objekts an einen Kunden kopiert die Dateien (wie Fotos, v3317).
6. **Kosten:** Hetzner-Volume heute ausreichend. Bei 100 aktiven Konten à 500 MB ≈ 50 GB. Storage Box 1 TB rund 4 € im Monat oder Object Storage rund 5 € je TB im Monat. Kein eigener Preis nötig, im Plan enthalten.
7. **Sicherung:** Das Laufwerk steht in keinem Backup-Skript (nur Hetzner-Snapshots). Vor dem Einschalten eine tägliche Sicherung des Ordners (verschlüsselt liegt er ohnehin).

## Aufwand bei „A“

Ein Paket: `dateiablage.js` einbinden (Karte im Reiter Haus & Unterlagen, Whitelabel, kein Schließen per Klick daneben), Eingang ruft `DpAblage.ablegen()` je gelesener Datei, in „Eingelesen und übernommen“ wird der Dateiname zum Link auf das Original, Löschkette am Objekt, Sicherung, Datenschutztext. Rund ein Tag inkl. Messung.

## Entscheidung und Umsetzung (25.11.2026, v4860)

Marcel: „Dokumentenablage machst du fertig“, danach „Investor 1 GB, Pro 3 GB“ und „Partner 5 GB“.

| Plan | Ablage |
|---|---|
| Free | keine (nur Auslesen; vorhandene Dateien bleiben lesbar, Löschung 90 Tage nach Erkennen mit Mail) |
| Starter | 500 MB |
| Investor | 1 GB |
| Pro | 3 GB |
| Business | 25 GB |
| Partner | 5 GB (Partner-Konto). Kunden eines Partners haben ein eigenes Abo (Investor per Platz) und damit ihr eigenes Kontingent (1 GB). |

Datei höchstens 20 MB. Testphase (28 Tage Pro) hat 3 GB; endet sie ohne Abo, beginnt die 90-Tage-Frist.

Abweichungen von der Vorlage, mit Grund:
- Kontingente als Tabelle in `services/dateiAblage.js` (`GRENZE_JE_PLAN`), kein Plan-Merkmal in der Datenbank: eine Quelle, Prüfer liest sie.
- Löschfrist 90 Tage nach Vertragsende (Vorlage: 30 Tage) nach Marcels Vorgabe im Auftrag.
- Objekt gelöscht: Dateien bleiben (Objekte werden nicht gelöscht, nur „verloren“), wie bisher.
- Partner-Zugriff: es gibt keinen Zugriff fremder Konten auf `/dateien` (nur das eigene Konto); eine Freigabe an Partner ist damit noch nicht gebaut, Standard ist „kein Zugriff“.
- Sicherung: Prod-Nachtsicherung sichert das Uploads-Volume (inkl. `dateien/`) heute als Voll-tar, 7 Nächte. Neues Skript mit rsync-Schnappschüssen in `tools/server/nachtsicherung.sh` (auf Staging getestet).
- Speicherort über `DATEI_ABLAGE_DIR` einstellbar (Storage Box ohne Umbau), Admin-Mail ab 70 % Plattenbelegung (`ABLAGE_PLATTE_WARN_PCT`, Empfänger `ABLAGE_WARN_TO`).
- Datenschutz-Entwurf: `design/Vorschläge/dokumentenablage-datenschutz-entwurf-2026-11-25.md` (nicht veröffentlicht).
