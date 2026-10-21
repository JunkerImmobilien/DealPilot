# 32 · Datenschutz und Server in Deutschland

> Stand 20.10.2026 (Staging bis v2544). Wortlaut aus `frontend/landing/sicherheit.html` und `frontend/js/legal.js` (AGB Ziffer 8) — vor der Messe gegen die veröffentlichte Seite prüfen.
> Video: noch kein Video · Messe-Geschichte: — (Pflichtantwort für jeden Besucher, der nach Daten fragt)

## 1 · Wozu

Wer eine Immobilie durchrechnet, gibt Kaufpreis, Miete und Finanzierung preis — Zahlen, die niemanden sonst etwas angehen. Diese Seite sagt dem Messe-Team in einfachen Worten, **wo die Daten liegen, wer sie sehen kann und wann sie das Land verlassen** — und zwar genau so, wie es auf der Sicherheitsseite und in den AGB steht. Nichts darüber hinaus versprechen.

## 2 · Wo in der App / auf der Seite

- **Landingpage → „Daten & Server"** (`sicherheit.html`, Titel „Sicherheit & Datenschutz") und Band „Server in Deutschland · DSGVO-konform".
- **AGB Ziffer 8 „Datenverarbeitung (DSGVO)"** (`legal.js`), **Datenschutzerklärung** (`/datenschutz.html`, Abschnitt 6 zur KI).
- **In der App:** Einstellungen → Account & Sicherheit (Passwort, Zwei-Faktor, Account löschen); Einwilligung beim Telegram-Bot; Hinweis vor jedem Marktbewertungs-Abruf.

## 3 · Die Aussagen im Wortlaut-Kern — zum Nachsprechen

| Thema | Was gilt (laut sicherheit.html / legal.js) |
|---|---|
| Server | Anwendung und Datenbanken laufen auf Servern der **Hetzner Online GmbH** in deutschen Rechenzentren — **Nürnberg und Falkenstein**. Deutsches Unternehmen, deutsches Recht, **ISO-27001-zertifizierter Betrieb**. |
| Verbindung, Passwörter | Jede Verbindung über **TLS**, HTTPS erzwungen. Passwörter nie im Klartext, nur als Streuwert (**bcrypt**) — „auch wir können sie nicht lesen". Sitzungen laufen ab und lassen sich beenden. |
| Sicherungen | Beide Datenbanken werden gesichert; die Sicherungen liegen am selben Ort, also in Deutschland. Keine Ablage außerhalb der EU. Rücksprung auf einen früheren Stand möglich. |
| Speicherdauer | Anmeldedaten bis zur Löschung des Kontos; Berechnungen und Fotos, bis du das Objekt löschst; Exposés, Belege, Datenraum. |
| Zahlung | Zahlungsabwicklung über **Stripe**; Kartendaten und IBAN liegen nicht bei DealPilot; gesetzliche Aufbewahrungsfrist für Rechnungen. |
| Kein Tracking | Nur **technisch notwendige Cookies**, keine Tracking-Cookies, keine Werbe-Tracker, keine Profilbildung, keine Weitergabe zu Werbezwecken. |
| Marktbewertung | Für eine Marktpreisindikation werden Adresse und Objektbeschreibung an einen **unabhängigen Bewertungspartner** übertragen — nur, wenn du einen Abruf ausdrücklich auslöst, und es wird dir vorher angezeigt. |
| KI | Für KI-gestützte Auswertungen und Texte (z. B. Co-Pilot und KI-Analyse) nutzt DealPilot die Schnittstelle von **OpenAI mit Sitz in den USA**. Übermittelt werden Objekt- und Berechnungsdaten und deine Frage — keine Login-, keine Zahlungsdaten. Grundlage: Auftragsverarbeitungsvertrag mit **EU-Standardvertragsklauseln**. OpenAI verwendet die Daten **nicht zum Training** und löscht Anfragen nach **höchstens 30 Tagen**. |
| Rechenkerne | Kennzahlen, Score, Finanzierung, Steuer rechnen **ohne KI**, im Browser und auf den Servern in Deutschland. |
| Telegram-Bot | Nur mit Einwilligung: Objektdaten gelangen in die **Vereinigten Arabischen Emirate**, Bot-Chats sind **nicht Ende-zu-Ende-verschlüsselt** (Handbuch 24). |
| Rechte | Auskunft und Herausgabe in gängigem Format (formlose E-Mail genügt); Objekte und Dokumente löschst du selbst, das ganze Konto auf Anforderung. |
| Beruflich für Mandanten | Wer DealPilot beruflich für Mandanten nutzt, braucht einen **Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO** — DealPilot stellt ihn bereit. |
| Anbieter | Junker Solution, Marcel Junker. |

**Belegt:** alle Zeilen aus `landing/sicherheit.html` (Textauszug) und `legal.js` Z. 100–105; Telegram aus `help.js` „Telegram-Bot verbinden".

## 4 · Fragen am Stand

- **„Wo liegen meine Daten?"** — In Deutschland, bei Hetzner in Nürnberg und Falkenstein, auch die Sicherungen.
- **„Liest die KI mit?"** — Nur, wenn du eine KI-Funktion nutzt (Pilot-Analyse, Co-Pilot …). Dann gehen Objektdaten und Frage an OpenAI in den USA, unter Standardvertragsklauseln, ohne Training, gelöscht nach höchstens 30 Tagen. Die Rechnung selbst — Cashflow, Steuer, Score — läuft ohne KI.
- **„Wer bekommt meine Adresse bei der Marktbewertung?"** — Ein unabhängiger Bewertungspartner, nur bei deinem ausdrücklichen Abruf. Namen nennen wir nicht.
- **„Kann ich als Berater meine Mandanten-Objekte einpflegen?"** — Ja, mit AV-Vertrag nach Art. 28 DSGVO.

## 5 · Grenzen und Kennzeichnung

- **Nichts versprechen, was dort nicht steht** — z. B. keine „Ende-zu-Ende-Verschlüsselung" der App, keine Zertifizierung von DealPilot selbst (zertifiziert ist der Betrieb des Rechenzentrums).
- Bewertungspartner nie namentlich; ImmoMetrica darf genannt werden (eigener Zugang des Nutzers).
- Die DealPilot-Sicherung (`.dpkt`) ist ohne Passwort Klartext (Handbuch 27).

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Landingpage, Band „Server in Deutschland" | „Daten & Server" | Deine Zahlen gehen niemanden etwas an. Hier steht, wo sie liegen. |
| 2 | Abschnitt Server | — | Server und Sicherungen in Deutschland — Rechenzentren in Nürnberg und Falkenstein. |
| 3 | Abschnitt Verschlüsselung | — | TLS für jede Verbindung, Passwörter nur als Streuwert. |
| 4 | Abschnitt KI | — | KI nur, wenn du sie nutzt — ohne Training, nach höchstens 30 Tagen gelöscht. Gerechnet wird ohne KI. |
| 5 | Abschnitt Rechte | — | Auskunft, Herausgabe, Löschen — und ein AV-Vertrag für alle, die für Mandanten arbeiten. |

### Sprechertext (Entwurf, ca. 65 Sekunden)

Wer eine Immobilie durchrechnet, legt Zahlen offen, die niemanden sonst etwas angehen. Deshalb sagen wir genau, wo sie liegen.

DealPilot läuft auf Servern in Deutschland, in Rechenzentren in Nürnberg und Falkenstein. Auch die Sicherungen bleiben dort. Jede Verbindung ist verschlüsselt, Passwörter speichern wir nur so, dass auch wir sie nicht lesen können. Keine Werbe-Tracker, keine Weitergabe.

Wenn du eine KI-Funktion nutzt, gehen die Objektdaten und deine Frage an einen KI-Dienst in den USA — unter Standardvertragsklauseln, ohne Training, gelöscht nach höchstens dreißig Tagen. Die eigentliche Rechnung — Cashflow, Steuer, Score — läuft ohne KI.

Und wer DealPilot für Mandanten nutzt, bekommt von uns den Vertrag zur Auftragsverarbeitung.

## Querverweise

- Handbuch 24 (Telegram-Einwilligung), 27 (Sicherung, Verschlüsselung), 01 (Konto, Zwei-Faktor), 31 (Partner, AV-Vertrag)
