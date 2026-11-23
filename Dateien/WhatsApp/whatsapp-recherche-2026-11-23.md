# WhatsApp für DealPilot: wie ViVi es macht und wie wir es anbinden

Stand 23.11.2026. Recherche ohne Konto, ohne Kauf, ohne Änderung am Code. Auftrag aus Marcels Liste vom 23.11.2026, Punkt 2 (`wissen/2026-11-23.md`).

## 1. Kurzantwort

WhatsApp geht. Meta bietet dafür die WhatsApp Business Platform mit der Cloud API an. ViVi nutzt genau diesen Weg: eine zentrale ViVi-Nummer, der Nutzer verknüpft seine Handynummer einmal mit einem Code und schickt danach Fragen, Fotos, PDFs und Sprachnachrichten an ViVi. Das ist dasselbe Muster wie unser Telegram-Bot, nur mit einer gemeinsamen Nummer statt einem Bot je Nutzer.

Dazu kommt ein Fund im eigenen Haus: **Marcels Makler-Hub (`E:\Makler Hub`) hat WhatsApp bereits eingebaut**, mit vier Anbietern (Meta direkt, 360dialog, Dualhook, Twilio), Webhook, Vorlage und Medien in die Akte. Der Verbinder `server/connectors/messenger.js` hat 190 Zeilen. Im Hub steht er auf `WHATSAPP_MODUS=simulation`, er ist also noch nie gegen Meta selbst gelaufen. Die Einrichtungsschritte stehen in `E:\Makler Hub\docs\LIVEBETRIEB.md` ab Zeile 329.

## 2. Was wir früher zu WhatsApp festgehalten haben

Gesucht in `wissen/`, `claude/`, `BACKLOG.md`, `FALLEN.md`, `Dateien/`, im Code und in der Git-Geschichte von DealPilot.

**Ein Satz „WhatsApp geht nicht“ steht nirgends im Repo.** Auch kein Commit erwähnt es. Die Aussage stammt vermutlich aus einem Chat und wurde nie aufgeschrieben. Gefunden habe ich nur diese Stellen:

| Fundstelle | Inhalt |
|---|---|
| `Dateien/Landing/Vergleich-ImmoMetrica-gutachten-org.md:131` | „Telefon und WhatsApp als Kanal, solange Marcel das ausdrücklich nicht will.“ Gemeint ist WhatsApp als **Support-Kanal** auf der Landing, keine technische Grenze. |
| `frontend/js/quick-boarding-share.js:137` | Teilen eines Quick Boarding Pass per `wa.me`-Link. Das ist nur ein Link, keine Anbindung. |
| `frontend/landing/loesungen.html:264, 303, 307` | Die Seite zum Makler-Hub verspricht bereits „Anfrage per E-Mail, WhatsApp oder Telegram“ und „Morgen-Briefing per Telegram oder WhatsApp“. |
| `Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md:9` | „Der Hub liefert Postfächer, WhatsApp, Telegram …“ Für Flow Investor ist WhatsApp also dem Hub zugeordnet. |
| `Dateien/Architektur/ViVi-Anbindung-2026-11-22.md:74` und `MCP-und-Vivi-2026-11-22.md:141` | ViVi führt WhatsApp als Funktion. |
| `voice-import.js`, `claude/projektanweisung-hauptapp.md:40802`, `wissen/2026-10-14.md` | „Mikrofon wie bei WhatsApp“, nur Bedienvorbild. |

**Ein echter Grund, warum WhatsApp früher schwieriger aussah, steht in den Regeln von Meta selbst:** seit dem 15.01.2026 verbietet Meta auf der Business Platform Anbieter, deren **Hauptprodukt ein allgemeiner KI-Assistent** ist (ChatGPT und Perplexity mussten gehen). Unternehmen, die KI als Teil ihres eigenen Fachdienstes einsetzen, sind ausdrücklich nicht betroffen ([TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform), [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)). DealPilot ist eine Investitionsanalyse mit KI als Werkzeug, genau wie ViVi. Das Restrisiko: Meta legt den Begriff selbst aus. Der Co-Pilot sollte deshalb über WhatsApp bei Immobilienfragen bleiben und kein offener Plauderchat sein.

## 3. Wie ViVi WhatsApp anbietet

Quelle: [ViVi, WhatsApp-Funktionsseite](https://www.vivi-immo.de/funktionen/whatsapp-immobilienverwaltung/), [ViVi KI-Assistent](https://www.vivi-immo.de/funktionen/ki-assistent/), [vivi-immo.de](https://vivi-immo.de).

- **Einrichtung:** Einstellungen, Integrationen, WhatsApp. Der Nutzer trägt seine Nummer ein und schickt den angezeigten Code an ViVi. Danach ist ViVi in WhatsApp erreichbar. Freigeschaltet für „alle verifizierten Nutzer“.
- **Eingaben:** Text, Sprachnachrichten, Fotos (Rechnungen, Zählerstände), Dokumente wie Mietverträge als PDF.
- **Ablauf:** ViVi liest aus und legt einen Vorschlag zur Bestätigung vor. „Nichts wird gespeichert, bis Du bestätigst.“ Erst nach „Ja, mach.“ meldet ViVi „Angelegt.“
- **Kosten für den Kunden:** im Abo ohne Aufpreis, verbraucht KI-Credits wie der Chat.
- **Anbieter:** nennt ViVi nicht. Die Seite sagt nur „WhatsApp ist ein Dienst von Meta, die Nachrichten laufen also über deren Infrastruktur.“ Aus dem Ablauf (eine ViVi-Nummer, Nutzer schreibt zuerst, Code zur Verknüpfung) folgt: das ist die WhatsApp Business Platform, entweder direkt über die Meta Cloud API oder über einen Dienstleister davor. Welcher, lässt sich von außen nicht belegen.
- **Mieter:** WhatsApp ist bei ViVi ein Kanal für den Verwalter zur eigenen KI, nicht für Mieter. Mieter laufen über das Mieterportal.

Der Kniff von ViVi: **der Nutzer schreibt immer zuerst.** Damit ist das 24-Stunden-Fenster offen, Antworten brauchen keine Vorlage und sind bis 1.000 im Monat kostenlos. Teure Vorlagen fallen nur an, wenn ViVi von sich aus schreibt.

## 4. Was die WhatsApp Business Platform verlangt

### 4.1 Konto und Verifizierung

- **Meta Business Portfolio** (früher Business Manager) für Junker Solution, dazu ein WhatsApp-Business-Konto (WABA) und eine App auf developers.facebook.com mit dem Produkt WhatsApp.
- **Unternehmensverifizierung bei Meta:** ohne sie startet ein neues Portfolio mit einem Limit von 250 vom Unternehmen begonnenen Gesprächen in 24 Stunden. Verifiziert geht es auf 2.000 und automatisch weiter bis 10.000 und unbegrenzt. **Für Gespräche, die der Nutzer beginnt, gilt kein Limit** ([Meta, Messaging Limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits), [Infobip](https://www.infobip.com/docs/whatsapp/manage-integration/integration-essentials)). Für einen Bot nach ViVi-Muster reicht also zur Not schon der Start ohne Verifizierung, für Meldungen an viele Nutzer nicht.
- Für die Verifizierung braucht Meta üblicherweise einen Nachweis des Unternehmens (bei einem Einzelunternehmen die Gewerbeanmeldung), Anschrift, eine Website mit Impressum, auf der Name und Marke zusammen stehen, und eine E-Mail-Adresse unter derselben Domain. Wichtig für uns: der Anzeigename „DealPilot“ muss auf `dealpilot.immo` klar als Marke von Junker Solution erkennbar sein. Die Namensprüfung meldet `APPROVED` oder `DECLINED`, höchstens 10 Änderungen in 30 Tagen ([Meta, Display Names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names)).

### 4.2 Telefonnummer

- Eine Nummer, die SMS oder einen Anruf zur Bestätigung empfangen kann. Festnetz oder virtuelle Nummer geht, wenn der Anruf ankommt.
- Die Nummer darf **nicht gleichzeitig** in der normalen WhatsApp-App laufen. Ausnahme ist **Coexistence**: die Nummer bleibt in der WhatsApp-Business-App auf dem Handy und ist zusätzlich an die API gekoppelt. In Deutschland und der EU verfügbar laut [seven.io](https://help.seven.io/en/whatsapp/whatsapp-coexistence) und [360dialog](https://docs.360dialog.com/docs/hub/embedded-signup/whatsapp-coexistence). Grenzen: App mindestens alle 13 bis 14 Tage öffnen, WhatsApp Web wird getrennt, einige Funktionen fehlen. Für einen Bot ist Coexistence unnötig, sie lohnt sich nur, wenn ein Mensch dieselbe Nummer am Handy bedient (Makler-Hub-Fall).

### 4.3 Vorlagen und 24-Stunden-Fenster

- Schreibt der Nutzer, öffnet sich ein **Kundenservice-Fenster von 24 Stunden**. Darin darf DealPilot frei antworten, mit Text, Dateien und Knöpfen.
- Außerhalb des Fensters darf DealPilot **nur freigegebene Vorlagen** schicken (Kategorien Utility, Marketing, Authentication). Freigabe meist innerhalb von Stunden. Beispiel aus dem Makler-Hub: Vorlage `hub_nachricht`, Kategorie Utility, Sprache Deutsch.
- Für uns heißt das: Antworten auf ein geschicktes Exposé sind frei. Eine Meldung „Kaufpreis gesunken“ oder ein Briefing am nächsten Morgen braucht eine Utility-Vorlage und kostet je Nachricht.
- Der Nutzer muss vorher zugestimmt haben (Opt-in). Bei uns ergibt sich das aus der Verknüpfung per Code in den Einstellungen.

### 4.4 Kosten in Deutschland 2026

Meta rechnet seit 01.07.2025 je **zugestellter Nachricht** ab, Preis nach Kategorie und Land des Empfängers. Nachrichten vom Nutzer an uns kosten nichts ([Meta, Pricing](https://developers.facebook.com/docs/whatsapp/pricing)).

| Nachrichtenart | Preis Deutschland je Nachricht |
|---|---:|
| Marketing-Vorlage | 0,1131 € |
| Utility-Vorlage | 0,0456 € |
| Authentication-Vorlage | 0,0456 € |
| Freie Antwort im 24-Stunden-Fenster (Service) | die ersten 1.000 je Nummer und Monat frei, danach 0,0456 € |

Preise laut [meetergo](https://help.meetergo.com/en/integrations/automation/whatsapp-pricing) (Stand 07.09.2026) und [chatarmin](https://chatarmin.com/en/blog/whatsapp-business-costs), beide nach Metas Preisliste. Verbindlich ist die [Preisliste bei WhatsApp](https://business.whatsapp.com/products/platform-pricing#rates).

**Neu seit 01.10.2026:** Service-Antworten waren bis dahin unbegrenzt frei. Jetzt sind nur noch 1.000 je Monat und Nummer frei, auch Utility-Vorlagen im offenen Fenster kosten wieder. Ohne hinterlegtes Zahlungsmittel stellt Meta nach den 1.000 freien nicht mehr zu. Meta ändert Preise nur zum Quartalsbeginn.

**Sonderregel für KI-Anbieter:** Meta hat ab Februar und März 2026 für „AI Provider“ jede Service-Nachricht in der EU berechnet, in der EU und dem EWR aber nur bis 12.05.2026. Ab 13.05.2026 fallen dort keine Gebühren mehr an ([Meta, AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers)). Hintergrund ist ein Verfahren der EU-Kommission ([BornCity, 21.05.2026](https://borncity.com/news/meta-oeffnet-whatsapp-business-api-fuer-ki-konkurrenten-in-der-eu/)). Die Lage ist in Bewegung, vor dem Start nachsehen.

**Dienstleister (BSP) zusätzlich, nur wenn wir einen nehmen:**

| Weg | Grundgebühr | Aufschlag je Nachricht |
|---|---|---|
| Meta Cloud API direkt | 0 € | keiner |
| 360dialog | ab 25 bis 49 € je Nummer und Monat, Pakete bis 99 € und mehr ([360dialog Preise](https://docs.360dialog.com/docs/get-started/pricing), [Partner](https://docs.360dialog.com/partner/get-started/pricing-and-plans)) | keiner, Meta-Preise werden durchgereicht |
| Dualhook | ab 12 $ im Monat (laut Makler-Hub-Doku) | keiner |
| Twilio | keine Grundgebühr | eigener Aufschlag je Nachricht, nicht nachgemessen |

**Rechenbeispiel DealPilot**, angenommen 50 aktive Nutzer, je 20 Exposés oder Fragen im Monat, je Anfrage 3 Antworten des Bots: 3.000 Service-Nachrichten, davon 1.000 frei, 2.000 × 0,0456 € = **rund 91 € im Monat**. Dazu je Nutzer 10 Meldungen außerhalb des Fensters als Utility-Vorlage: 500 × 0,0456 € = **rund 23 €**. Zusammen rund 115 € im Monat bei Meta direkt. Wenige Nutzer bleiben praktisch kostenlos. Weniger Antworten je Anfrage (eine zusammengefasste Nachricht statt drei) senkt die Kosten direkt.

### 4.5 Datenschutz

- Bei der Cloud API ist **WhatsApp Ireland Auftragsverarbeiter** für Daten aus Europa. Es gelten die [Meta Hosting Terms für die Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/data-privacy-and-security) und für europäische Kunden das [WhatsApp Business Data Transfer Addendum](https://www.whatsapp.com/legal/business-data-transfer-addendum). Eine eigene AVV muss Marcel nicht aushandeln, sie wird mit den Nutzungsbedingungen angenommen.
- Übermittlung in die USA stützt Meta auf die üblichen DSGVO-Mechanismen (Angemessenheitsbeschluss und Standardvertragsklauseln). Die Pflichten aus der DSGVO bleiben bei uns.
- **Serverstandort:** die Cloud API verarbeitet in Rechenzentren von Meta weltweit. Mit **Local Storage** bleiben gespeicherte Nachrichteninhalte in einem gewählten Land, laut [360dialog](https://docs.360dialog.com/docs/hub/local-storage) auch Deutschland. Während der Verarbeitung können Inhalte bis zu 60 Minuten anderswo liegen ([Meta, Local Storage](https://developers.facebook.com/documentation/business-messaging/whatsapp/local-storage/)). Einschalten geht nur vor der Registrierung der Nummer. Also gleich beim Anlegen setzen.
- **Exposés enthalten oft Namen und Anschriften Dritter.** Die Datenschutzerklärung von DealPilot braucht einen Absatz zu WhatsApp (Zweck, Meta als Empfänger, Drittlandübermittlung, Löschung). In den Einstellungen sollte, wie bei ViVi, der Hinweis stehen, dass dieselben Aufgaben auch in der App gehen.
- Medien liegen bei Meta: per Webhook gemeldete Medien 7 Tage abrufbar, hochgeladene 30 Tage. Wir holen sie sofort ab und speichern sie wie heute die Telegram-Dateien.

### 4.6 PDFs und Bilder über den Webhook

Laut [Meta, Media](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media):

1. Der Webhook meldet eine Nachricht vom Typ `document`, `image` oder `audio` mit einer Media-ID.
2. `GET /<MEDIA_ID>` mit dem Zugriffsschlüssel liefert `url`, `mime_type`, `sha256`, `file_size`.
3. Die Datei mit derselben Autorisierung von dieser URL laden. **Die URL gilt nur 5 Minuten**, danach neu abfragen.

| Typ | Formate | Größe |
|---|---|---:|
| Dokument | PDF | bis 100 MB |
| Bild | JPEG, PNG, WebP | bis 5 MB |
| Audio | AAC, AMR, MP3, M4A, OGG/Opus | bis 16 MB |

Größere Dateien meldet der Webhook mit Fehler 131052. Jeder Webhook trägt die Signatur `X-Hub-Signature-256` (HMAC mit dem App-Secret), die wir prüfen müssen. Der Makler-Hub hat dafür schon `WHATSAPP_APP_SECRET`.

## 5. Unterschiede zu Telegram

| | Telegram (heute) | WhatsApp Business Platform |
|---|---|---|
| Bot | je Nutzer ein eigener Bot über BotFather (`routes/telegram.js`, `setWebhook` je Bot) | eine zentrale DealPilot-Nummer für alle |
| Zuordnung zum Nutzer | geheimer Pfad je Bot, Secret-Kopf, dann `chat.id` (`routes/telegramWebhook.js`) | signierter Webhook, dann Absendernummer `wa_id`, verknüpft per Code |
| Kosten | kostenlos | je Nachricht, siehe 4.4 |
| Von sich aus schreiben | jederzeit, wenn der Nutzer den Bot einmal gestartet hat | nur mit freigegebener Vorlage außerhalb von 24 Stunden |
| Einrichtung durch uns | keine, Nutzer legt seinen Bot an | Meta-Portfolio, Verifizierung, Nummer, Vorlagen, Zahlungsmittel |
| Einrichtung durch den Nutzer | Bot anlegen, Token eintragen (umständlich) | Nummer eintragen, Code schicken (einfach) |
| Dateien vom Nutzer | Bot API lädt bis 20 MB | PDF bis 100 MB, Bilder bis 5 MB |
| Formatierung | HTML oder Markdown (`parse_mode`) | nur *fett*, _kursiv_, ~durch~, Monospace |
| Knöpfe | Inline-Tasten (bei uns ungenutzt) | bis 3 Antwortknöpfe oder Liste mit 10 Zeilen |
| Regeln zum Inhalt | kaum | kein allgemeiner KI-Assistent als Hauptzweck, Vorlagen werden geprüft |
| Verbreitung bei Investoren | gering | fast jeder hat es |

Der größte Gewinn ist nicht die Technik, sondern die Hürde für den Nutzer: bei Telegram muss er heute einen eigenen Bot anlegen und ein Token kopieren. Bei WhatsApp schickt er einen Code an eine Nummer und ist fertig.

## 6. Empfehlung für DealPilot

### Weg

**Meta Cloud API direkt, eine eigene neue Nummer nur für den Bot, Verknüpfung per Code wie bei ViVi.** Kein Dienstleister davor, keine Coexistence.

Begründung:
- Direkt bei Meta fällt keine Grundgebühr und kein Aufschlag an. Ein Dienstleister bringt uns nur eine bequemere Anmeldung, die wir einmal selbst erledigen.
- Coexistence braucht ein Handy, das alle 13 Tage geöffnet wird. Für einen Bot ohne Menschen am Handy ist das eine Fehlerquelle ohne Nutzen.
- Der Verbinder aus dem Makler-Hub kann Meta, 360dialog und Dualhook mit derselben Schnittstelle. Wechseln wir später, ändert sich nur Basisadresse und Schlüssel.
- Der Makler-Hub bleibt für die Postfach-Nummer der Makler zuständig (dort ist Coexistence richtig). DealPilot bekommt den Bot.

### Bauplan (ein Paket nach CLAUDE.md Regel 5)

1. **Kanal-Schicht:** die Telegram-Pipeline (Dialog, Absicht, Unterlagen, Markt, PDF, 3.459 Zeilen in `routes/telegram*.js` und `services/telegram*.js`) bekommt eine dünne Abstraktion „senden, Datei senden, Datei holen“. Telegram und WhatsApp sind zwei Umsetzungen davon. Kein zweiter Bot daneben.
2. **Webhook** `POST /api/v1/whatsapp/webhook` mit Prüfung von `X-Hub-Signature-256` und `GET` für die Bestätigung mit Verify Token. Regel wie in `telegramWebhook.js`: nur signierter Kopf und verknüpfte Nummer entscheiden, wessen Daten gelesen werden, nie der Nachrichteninhalt.
3. **Verknüpfung:** Einstellungen, Integrationen, WhatsApp. Nutzer trägt Nummer ein, bekommt einen Code, schickt ihn an die DealPilot-Nummer. Tabelle `whatsapp_verknuepfungen` (Nutzer-UUID, `wa_id`, bestätigt am, Zustimmung am). Migration.
4. **Medien:** Media-ID sofort auflösen und laden (URL gilt 5 Minuten), dann in denselben Weg wie heute `getFile` bei Telegram (Exposé zu Quick-Check, Bilder, Sprachnachricht abschreiben).
5. **Antworten:** Telegram-HTML in WhatsApp-Format umsetzen. Zusammenfassen statt viele Einzelnachrichten (spart Geld). Rückfragen mit bis zu 3 Knöpfen.
6. **Vorlagen:** eine Utility-Vorlage für Meldungen außerhalb des Fensters, Muster wie `hub_nachricht` im Makler-Hub.
7. **Zählung und Deckel:** jede ausgehende Nachricht mit Kategorie protokollieren, Monatsdeckel je Konto ähnlich `services/kiVerbrauch.js`, damit ein Fehler im Takt keine Rechnung erzeugt. Dazu ein Prüfer `tools/whatsapp-pruefen.mjs` (Signatur, Zuordnung, Medienkette, Deckel) gegen nachgebaute Webhooks.
8. **Vorschau-Funktion:** zuerst hinter `vorschau-funktionen.json`, Staging mit Metas Testnummer, die ohne Verifizierung geht.

**Aufwand:** für den Code etwa 2 bis 3 Arbeitstage bis Staging, weil die Telegram-Pipeline und der Hub-Verbinder schon stehen. Die längste Zeit ist Warten auf Meta: Verifizierung einige Tage bis etwa 2 Wochen, Vorlagen meist Stunden. Diese Zeiten sind Erfahrungswerte aus Anbieterquellen, nicht gemessen.

**Laufende Kosten:** bei Meta direkt 0 € Grundgebühr, Nachrichten nach Verbrauch, im Beispiel mit 50 aktiven Nutzern rund 115 € im Monat. Dazu die Nummer selbst (je nach Anbieter wenige Euro im Monat) und die KI-Kosten wie bei Telegram. Ob WhatsApp für Kunden im Abo enthalten ist oder ein Kontingent verbraucht, ist eine Preisentscheidung für Marcel.

### Was Marcel selbst tun muss

1. **Meta Business Portfolio** für Junker Solution anlegen (mit seinem Facebook-Konto) und die **Unternehmensverifizierung** starten: Gewerbeanmeldung, Anschrift, Website, E-Mail unter der eigenen Domain.
2. Auf **`dealpilot.immo`** prüfen, dass Impressum und Seite „DealPilot“ als Marke von Junker Solution zeigen, sonst lehnt Meta den Anzeigenamen ab.
3. **Eine eigene Telefonnummer** besorgen, die noch nie in WhatsApp lief und SMS oder Anrufe empfängt. Nicht die private Handynummer und nicht die Nummer von Junker Immobilien.
4. Bei Meta ein **Zahlungsmittel** hinterlegen.
5. Entscheiden: WhatsApp im Abo enthalten oder als Kontingent, und ob DealPilot von sich aus melden darf (Vorlagen kosten).
6. Datenschutzerklärung um den WhatsApp-Absatz ergänzen lassen (Entwurf liefert Claude).
7. Danach Claude Zugriff geben: Telefonnummern-ID, WABA-ID, App-Secret und einen dauerhaften Systemnutzer-Schlüssel mit `whatsapp_business_messaging` und `whatsapp_business_management`. Die Schritte stehen fertig in `E:\Makler Hub\docs\LIVEBETRIEB.md` ab Zeile 384.

### Offen und vor dem Start zu messen

- Ob Meta DealPilot als „AI Provider“ einstuft. Nach dem Wortlaut nein, weil die KI nicht das Hauptprodukt ist. Den Zweck bei der Einrichtung als „Immobilien-Investitionsanalyse“ angeben.
- Die aktuelle Preisliste für Deutschland zum Quartal, in dem wir starten.
- Ob Local Storage mit Region Deutschland bei Meta direkt wählbar ist (laut 360dialog ja).
- Der Makler-Hub-Verbinder ist nur gegen nachgebaute Gegenstellen getestet. Der erste echte Lauf ist der Beweis.

## Quellen

- ViVi: [WhatsApp-Funktion](https://www.vivi-immo.de/funktionen/whatsapp-immobilienverwaltung/), [KI-Assistent](https://www.vivi-immo.de/funktionen/ki-assistent/), [Startseite](https://vivi-immo.de), [Capterra-Eintrag](https://www.capterra.co.uk/software/1107896/ViVi-Immo), [OMR Reviews](https://omr.com/de/reviews/product/vivi)
- Meta: [Pricing](https://developers.facebook.com/docs/whatsapp/pricing), [Preisliste](https://business.whatsapp.com/products/platform-pricing#rates), [AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers), [Messaging Limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits), [Display Names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names), [Media](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media), [Data Privacy and Security](https://developers.facebook.com/documentation/business-messaging/whatsapp/data-privacy-and-security), [Local Storage](https://developers.facebook.com/documentation/business-messaging/whatsapp/local-storage/), [Data Transfer Addendum](https://www.whatsapp.com/legal/business-data-transfer-addendum)
- KI-Regeln: [TechCrunch 18.10.2025](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform), [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban), [BornCity 21.05.2026](https://borncity.com/news/meta-oeffnet-whatsapp-business-api-fuer-ki-konkurrenten-in-der-eu/)
- Preise Deutschland: [meetergo](https://help.meetergo.com/en/integrations/automation/whatsapp-pricing), [chatarmin](https://chatarmin.com/en/blog/whatsapp-business-costs)
- Dienstleister und Coexistence: [360dialog Preise](https://docs.360dialog.com/docs/get-started/pricing), [360dialog Partner](https://docs.360dialog.com/partner/get-started/pricing-and-plans), [360dialog Coexistence](https://docs.360dialog.com/docs/hub/embedded-signup/whatsapp-coexistence), [360dialog Local Storage](https://docs.360dialog.com/docs/hub/local-storage), [seven.io Coexistence](https://help.seven.io/en/whatsapp/whatsapp-coexistence), [Dualhook Coexistence](https://dualhook.com/docs/coexistence), [Infobip](https://www.infobip.com/docs/whatsapp/manage-integration/integration-essentials)
- Eigenes Repo: `E:\Makler Hub\server\connectors\messenger.js`, `E:\Makler Hub\docs\LIVEBETRIEB.md`, `E:\Makler Hub\docs\AUFGABEN.md`, `backend/src/routes/telegramWebhook.js`, `backend/src/routes/telegram.js`
