# Steuerkanzlei-Brücke — Konzept

Stand 02.11.2026 · Konzept, **nichts gebaut** · Grundlage: Code-Lesung im Repo (Zweig `staging`) und Recherche auf den offiziellen Seiten von DATEV, ELSTER, Wolters Kluwer und Buhl.

**Kennzeichnung:** **[belegt]** = im Code gelesen oder auf einer offiziellen Seite nachgelesen (Quelle unten). **[Annahme]** = Schluss oder Erfahrungswert, nicht nachgelesen. **[offen]** = muss bei der Gegenseite erfragt werden.

---

## 1 · Kurzfassung

1. Rund **70 % des Kanzlei-Ablaufs gibt es schon**: Partner-Konto, Seat-Pool mit Stripe, Einladung per Link, Mandanten-Liste, Freigabe je Objekt mit Status `eingereicht → bestätigt / zurückgegeben / widerrufen` und Protokolltabelle `share_audit` (Migration `055_reseller_core.sql`).
2. Es fehlen drei Dinge: der **Bezug auf ein Steuerjahr**, ein **eingefrorener Stand** zum Zeitpunkt „fertig“ (heute sieht die Kanzlei immer den Live-Stand) und **mehr als eine Kanzlei je Nutzer** (heute holt `getMyReseller()` genau eine, `LIMIT 1`).
3. Beide Wege, die Marcel will (Kanzlei kauft Seats / Nutzer verbindet sich selbst), laufen auf **dieselbe Tabelle** hinaus. Der Unterschied ist nur, wer die Verknüpfung anlegt und wer den Seat bezahlt.
4. **Eine direkte Übergabe in DATEV- oder Addison-Einkommensteuer gibt es für Fremdanbieter nicht öffentlich.** DATEV überträgt Anlage-V-Werte nur aus der eigenen Buchhaltung („DATEV Vermietung und Verpachtung“) in DATEV Einkommensteuer [belegt]. Der offene Fremdweg ist das **DATEV-Format (EXTF-Buchungsstapel)** in die Kanzlei-Buchhaltung — das passt zu einem Privatmandanten mit Anlage V nur über einen Umweg.
5. **ELSTER direkt ist technisch möglich** (ERiC ist kostenlos, Herstellerregistrierung beim Bayerischen Landesamt für Steuern) [belegt], aber DealPilot würde damit zur **Steuersoftware mit Haftungs- und Pflegelast** für eine vollständige Einkommensteuererklärung, nicht nur Anlage V [Annahme].
6. Für WISO Steuer (vermutlich das gemeinte „Aviso Steuer“), Taxfix und SteuerSparErklärung ist **kein offener Importweg belegt**.
7. **Empfehlung:** Stufe 1 bauen — Freigabe je Steuerjahr mit eingefrorenem Stand und einem **Kanzlei-Paket** (PDF „Steuermappe“ + CSV je Anlage-V-Zeile/Kennzahl + Belege). Das trägt ohne Partnervertrag und nutzt der Kanzlei sofort, egal ob DATEV, Addison oder etwas anderes. Stufe 2 (DATEV-Format, später Marktplatz) erst, wenn Kanzleien es nachfragen; Stufe 3 (ELSTER) zurückstellen.

---

## 2 · Was es schon gibt

### 2.1 Partner, Seats, Mandanten

| Baustein | Wo | Stand |
|---|---|---|
| Tabellen `resellers`, `reseller_members` (Rollen `owner`/`berater`), `reseller_clients`, `licenses` (Seat: `pool`/`zugewiesen`/`pausiert`/`gekuendigt`), `object_shares`, `share_audit` | `backend/migrations/055_reseller_core.sql` | **fertig** [belegt] |
| Partner-Rolle `steuerberater` ist schon ein Wert von `reseller_role` (neben makler, finanzierer, hausverwalter …) | ebenda | fertig [belegt] |
| Plan `partner` (149 €/Monat bzw. 1.490 €/Jahr, nicht öffentlich gelistet) | `056_partner_plan.sql`, `075_partner_preis_v1536.sql` | fertig [belegt] |
| Einladungen mit Token, Ablaufdatum, Status `pending/accepted/revoked` | `057_reseller_invites.sql`, `backend/src/routes/resellerInvite.js` (`/info`, `/accept`) | fertig [belegt] |
| Seat-Kauf per Stripe-Checkout, Pool, Zuweisen/Entziehen | `backend/src/routes/resellerPortal.js` (`/pool`, `/seats/checkout`, `/pool/confirm`, `/clients/:id/assign`, `/unassign`) | fertig [belegt] |
| Beim Annehmen einer Einladung wird automatisch ein freier Seat zugewiesen | `resellerService.acceptInvite()` | fertig [belegt] |
| Freigabe durch den Mandanten (`POST /reseller-invite/my-shares`), Widerruf | `resellerService.createMandantShare()`, `revokeMandantShare()`; Oberfläche `frontend/js/mandant-freigaben.js` („Meine Freigaben“) | fertig [belegt] |
| Prüfung durch den Partner: bestätigen / zurückgeben, Objekt nur lesen, Investment- und Werbungskosten-PDF ziehen | `resellerPortal.js` (`/shares`, `/shares/:id/object`, `/shares/:id/review`), `frontend/js/reseller-portal.js` (Z. ~366–460) | fertig [belegt] |
| Partner-Branding (Whitelabel, Logo, Akzent, PDF hell) | Migrationen 058–062, `mandant-branding.js`, `whitelabel-override.js` | fertig [belegt] |

**Status-Typ heute** (`share_status`): `offen`, `eingereicht`, `in_pruefung`, `bestaetigt`, `zurueckgegeben`, `widerrufen` [belegt]. `in_pruefung` und `offen` werden im Code nicht gesetzt [belegt, per grep].

**Was dem Kanzlei-Ablauf fehlt** [belegt am Code]:

- **Kein Steuerjahr.** `object_shares` ist `UNIQUE (object_id, reseller_id)` — ein Objekt kann je Kanzlei nur *eine* Freigabe haben, nicht „2025“ und „2026“ nebeneinander.
- **Kein eingefrorener Stand.** Die Kanzlei liest per `getSharedObject()` immer `objects.data` live. Ändert der Mandant nach „fertig“ noch etwas, prüft der Berater etwas anderes als eingereicht.
- **„Zurückgegeben“ sperrt den Berater aus.** `sharedObjectOwner()` und `getSharedObject()` geben bei `zurueckgegeben` keinen Zugriff mehr. Für eine Rückfrage („bitte Zeile 48 belegen“) muss der Berater das Objekt aber weiter sehen.
- **Ein Nutzer, eine Kanzlei.** `getMyReseller()` und `createMandantShare()` nehmen `LIMIT 1`. Ein Investor mit Steuerberater *und* Finanzierer geht nicht.
- **Weg 2 fehlt.** Ein bestehender Nutzer kann sich nicht selbst mit einer Kanzlei verbinden; er braucht immer eine Einladung des Partners. Eine Kanzlei-Suche oder einen Verbindungscode gibt es nicht.
- **Kein Rückfrage-Text.** `reviewShare()` speichert nur die Entscheidung, keinen Grund; `share_audit.meta` ist dafür da, wird aber leer (`{}`) befüllt.
- **Keine Benachrichtigung beim Statuswechsel** außer dem, was `resellerNotify.js` beim Einladen/Seat tut [Annahme: nicht für Prüfungsentscheide — nicht im Einzelnen gelesen].

> **Namensfalle:** `frontend/js/mandanten.js` heißt zwar „Mandanten“, verwaltet aber die **Halter** eines Objekts (Privat, GmbH, UG, GbR; Kontenrahmen SKR03/04, `localStorage dp_mandanten`). Mit Kanzlei-Mandanten hat es nichts zu tun. Im Konzept heißt der Kanzlei-Kunde deshalb **Mandant**, der Eigentümer im Objekt **Halter**.

### 2.2 Steuerdaten und Exporte

| Baustein | Wo | Stand |
|---|---|---|
| Anlage V 2025: Zuordnung jeder DealPilot-Kostenart zu Formularzeile und (26×) Kennzahl, mit Herkunft `formular` / `auffang` / `sachlogik` und Liste „nicht erfasst“ | `frontend/js/anlage-v-2025.js` | fertig für **VZ 2025**; für 2026 braucht es eine eigene Datei [belegt] |
| Steuermappe als PDF je Jahr, wahlweise mit Anlage-V-Seite; Werbungskosten je Halter/Regime | `frontend/js/werbungskosten-pdf.js` (`exportSteuerMappePDF(jahr, {anlageV})`, Z. 802), Aufruf `dashboard.js:3458` | fertig, **nur im Browser** (jsPDF) [belegt] |
| Werbungskosten / Überschuss je Jahr gespeichert | Tabelle `tax_snapshots.wk_per_year` (`026_tax_snapshots.sql`), `POST /objects/:id/steuer-snapshot`, `routes/wkAggregate.js` | fertig, nur **Summen je Jahr**, keine Zeilen [belegt] |
| Portfolio-Export mit Lexikon (Feldbedeutungen) | `backend/src/services/portfolioExport.js`, `GET /objects/portfolio-export` | fertig, kein Steuerformat [belegt] |
| Export-Hub: PDF, JSON-Sicherung, CSV komplett / einzeln | `frontend/js/import-export-modal.js` | fertig, Rohfelder, kein Steuerformat [belegt] |
| Belege / Unterlagen (Upload, Fotos, PDF) | `backend/src/routes/unterlagen.js`, v3090a „Fotos im Unterlagen-Import“ | vorhanden; ob Belege einer Kostenzeile zugeordnet sind, nicht geprüft [offen] |
| DATEV / Addison / ELSTER | — | **nichts**. „DATEV“ kommt nur als Kontenrahmen-Hinweis in `mandanten.js:1048` vor, „ELSTER“ nur als Text in `onboarding.js:597` [belegt] |

---

## 3 · Zielbild — zwei Wege, ein Ablauf

### Weg 1 · Kanzlei kauft Seats und legt Mandanten an

1. Kanzlei hat ein Partner-Konto (Rolle `steuerberater`), kauft Seats in den Pool.
2. Kanzlei lädt den Mandanten per E-Mail ein (gibt es) — **neu:** mit Angabe des Steuerjahres und der Rolle „Steuerberatung“.
3. Mandant legt sein Konto an, Seat wird zugewiesen (gibt es). Der Seat bezahlt das Abo des Mandanten.
4. Mandant erfasst Objekte, Mieten, Kosten. Ablauf weiter wie unten.

### Weg 2 · Bestehender Nutzer verbindet sich mit einer Kanzlei

1. Nutzer hat ein eigenes Abo und eigene Objekte.
2. Er verbindet sich: entweder über einen **Verbindungscode / Link der Kanzlei** (empfohlen, kein Kanzlei-Verzeichnis nötig) oder über die Einladung der Kanzlei an seine bestehende Mail-Adresse (Annahme im eingeloggten Konto — `acceptInvite()` kann das schon, legt aber einen Seat-Versuch an).
3. **Kein Seat nötig**: er zahlt sein Abo selbst. Ob die Kanzlei für solche Verbindungen etwas zahlt, ist eine Preisfrage (→ offene Fragen).
4. Er kann **mehrere** Partner haben (Kanzlei, Finanzierer), jeweils mit eigener Freigabe.

### Gemeinsamer Ablauf je Steuerjahr

```
Mandant                         Kanzlei
───────                         ───────
verknüpfen (Steuerjahr 2025,
  Objekte A, B)  ──────────────▶ sieht: „verknüpft, in Arbeit“
erfasst, prüft selbst
„fertig“ melden ──────────────▶ eingereicht  (Stand wird eingefroren)
                                 prüft  → in_pruefung
             ◀────────────────── zurück mit Rückfrage (Text je Zeile)
korrigiert, erneut „fertig“ ───▶ eingereicht (neuer Stand, Version 2)
                                 freigeben → freigegeben
                                 übertragen (Paket / DATEV / ELSTER)
                                  → übertragen
Widerruf jederzeit ────────────▶ widerrufen (kein Zugriff mehr)
```

**Wer darf was:** Der Mandant entscheidet *was* sichtbar ist (Steuerjahr, Objekte) und wann es „fertig“ ist. Die Kanzlei entscheidet *ob* es so übernommen wird. Die Kanzlei ändert **keine** Mandantendaten in DealPilot; sie gibt zurück. [Vorschlag — Alternative „Kanzlei korrigiert selbst“ siehe offene Fragen.]

---

## 4 · Datenmodell-Skizze

**Grundsatz:** Bestehendes erweitern, nichts daneben bauen. `object_shares` bleibt für die bisherige „Objekt zur Prüfung“-Freigabe (Makler, Finanzierer); für die Steuer kommt eine **Verknüpfung je Steuerjahr** dazu, die auf dieselben Kunden- und Partnertabellen zeigt.

```
resellers ─┬─ reseller_members (Berater der Kanzlei)
           └─ reseller_clients  (Mandant der Kanzlei, user_id)
                  │   NEU: herkunft  'einladung' | 'verbindung'   (Weg 1 / Weg 2)
                  │   NEU: seat_pflicht boolean                     (Weg 2 = false)
                  │
                  └─ steuer_mandate                       NEU
                       id, reseller_id, client_id, steuerjahr (int)
                       zweck 'steuererklaerung'
                       status  entwurf | eingereicht | in_pruefung |
                               zurueckgegeben | freigegeben | uebertragen | widerrufen
                       einwilligung_am, einwilligung_text_version
                       widerrufen_am
                       UNIQUE (reseller_id, client_id, steuerjahr)
                       │
                       ├─ steuer_mandat_objekte           NEU
                       │    mandat_id, object_id          (welche Objekte gehören dazu)
                       │
                       ├─ steuer_staende                  NEU (eingefroren)
                       │    id, mandat_id, version (1, 2, …)
                       │    eingereicht_am, eingereicht_von
                       │    daten jsonb   — je Objekt: Anlage-V-Zeilen/Kz, Beträge,
                       │                    Herkunft je Wert, Formularjahr-Kennung
                       │    pruefsumme    — sha256 über daten
                       │    pdf_ref       — die Steuermappe dieses Standes
                       │
                       ├─ steuer_rueckfragen              NEU
                       │    stand_id, zeile/kz, text, von, am, erledigt_am
                       │
                       └─ steuer_uebertragungen           NEU
                            stand_id, weg 'paket'|'datev_extf'|'elster'|…,
                            am, von, ergebnis, datei_ref / transfer_ticket
share_audit → verallgemeinern zu  partner_audit
       (bezug_typ 'share'|'mandat', bezug_id, actor_user_id, action, meta, created_at)
```

**Statusregeln:**

| von | nach | wer | Bedingung |
|---|---|---|---|
| entwurf | eingereicht | Mandant | Formulardatei fürs Steuerjahr vorhanden (sonst kein „fertig“, wie heute: keine Anlage V ohne Jahresdatei) |
| eingereicht | in_pruefung | Kanzlei | automatisch beim ersten Öffnen |
| in_pruefung | zurueckgegeben | Kanzlei | mindestens eine Rückfrage mit Text |
| zurueckgegeben | eingereicht | Mandant | erzeugt **neue Version** des Standes |
| in_pruefung | freigegeben | Kanzlei | — |
| freigegeben | uebertragen | Kanzlei | je Übertragung ein Eintrag; mehrfach erlaubt |
| jeder | widerrufen | Mandant | sofort; Kanzlei behält nur, was sie schon übertragen hat (siehe DSGVO) |

**Wichtig:** Die Kanzlei prüft und überträgt immer **einen Stand** (`steuer_staende.version`), nie die Live-Daten. Damit ist belegbar, was eingereicht und was freigegeben wurde.

**Kerne:** Die Anlage-V-Zuordnung liegt heute nur im Frontend (`anlage-v-2025.js`). Für einen eingefrorenen Stand, den das Backend erzeugt oder prüft, gehört sie wie die anderen Kerne ins Backend gespiegelt (Muster `tools/rechenkerne-spiegeln.mjs`) — oder der Stand wird im Browser gerechnet und mit Prüfsumme hochgeladen. [Entscheidung offen, technisch.]

---

## 5 · Rechte und DSGVO

[Rechtliche Einordnung = **Annahme**, nicht anwaltlich geprüft. Vor dem Bau einmal mit Datenschutzberatung abstimmen.]

- **Rollen.** DealPilot ist gegenüber dem Mandanten Verantwortlicher für sein Konto. Die Kanzlei verarbeitet die freigegebenen Daten **für ihre eigene Berufsausübung** — Steuerberater gelten bei der Steuerberatung nach herrschender Auffassung als **eigene Verantwortliche**, nicht als Auftragsverarbeiter (Art. 28 DSGVO greift für die Beratung selbst nicht). DealPilot ist gegenüber der **Kanzlei** Auftragsverarbeiter, soweit die Kanzlei DealPilot als Werkzeug für ihre Mandanten nutzt (Weg 1: sie kauft Seats und lädt ein) → **AVV DealPilot ↔ Kanzlei** nötig. [Annahme]
- **Einwilligung je Steuerjahr und Objektauswahl.** Rechtsgrundlage für die Weitergabe an die Kanzlei ist die ausdrückliche Handlung des Mandanten (Art. 6 Abs. 1 lit. a oder b DSGVO). Gespeichert: Zeitpunkt, Textversion, Umfang (Jahr, Objekte). Kein Vorhaken.
- **Widerruf** jederzeit, wirkt sofort für den Zugriff in DealPilot. Was die Kanzlei bereits übertragen hat (Paket heruntergeladen, in DATEV gebucht), liegt in ihrer Verantwortung und unterliegt ihren Aufbewahrungspflichten (§ 66 StBerG Handakten, § 147 AO) — das muss im Einwilligungstext stehen.
- **Berufsgeheimnis (§ 57 StBerG, § 203 StGB).** Die Kanzlei darf DealPilot als Dienstleister nur einsetzen, wenn DealPilot zur Verschwiegenheit verpflichtet ist (§ 62a StBerG — Verschwiegenheitsverpflichtung von Dienstleistern) [Annahme: Norm genannt, Wortlaut nicht nachgelesen]. Also: Vertrag mit Verschwiegenheitsklausel, Serverstandort Deutschland (Hetzner) nennen.
- **Datensparsamkeit.** Die Kanzlei sieht nur das freigegebene Steuerjahr und die gewählten Objekte — nicht Deal-Score, KI-Analysen, verlorene Deals, Finanzierungsanfragen. Heute liefert `getSharedObject()` `data` und `ai_analysis` komplett [belegt]; für die Steuerfreigabe ist das zu viel.
- **Protokoll.** Jede Sicht, jede Entscheidung, jede Übertragung in `partner_audit`; der Mandant kann es einsehen.
- **Löschung.** Endet das Mandat, werden Stände nach einer festen Frist gelöscht oder dem Mandanten übergeben — die Kanzlei hat ihre Kopie aus der Übertragung. [Frist offen]

---

## 6 · Exportwege im Vergleich

| Weg | Aufwand für uns | Voraussetzung | Nutzen | Belegt? |
|---|---|---|---|---|
| **A · Kanzlei-Paket** (PDF-Steuermappe + CSV je Objekt/Zeile/Kennzahl + Belege als ZIP) | gering — PDF gibt es, CSV aus `anlage-v-2025.js` | keine | Kanzlei tippt Kennzahlen in DATEV ESt / Addison ab oder liest die CSV mit eigenen Mitteln ein. Funktioniert mit **jeder** Kanzleisoftware. | Grundlagen im Code belegt |
| **B · DATEV-Format (EXTF-CSV „Buchungsstapel“)** | mittel — Kontierung je Kostenart auf SKR03/04-V+V-Konten, Spezifikation EXTF 7.00 | keine Partnerschaft für die **Datei** (offenes Format); Kanzlei muss das Mandat in DATEV Rechnungswesen führen | Für Kanzleien, die V+V über **„DATEV Vermietung und Verpachtung“** buchen: Import → von dort Übergabe in Anlage V (DATEV-eigener Weg). Für reine ESt-Mandate ohne Buchhaltung Umweg. | Format und V+V-Weg belegt; Eignung für Privatmandanten **Annahme** |
| **C · DATEV Datenservice / Marktplatz** (z. B. Buchungsdatenservice, Belegbilderservice ESt; DATEVconnect online) | hoch — Online-API, Prüfung durch DATEV, laufende Gebühren | Schnittstellen-Partner: Datenservice umgesetzt + **mind. 25 Kunden** nutzen ihn; Beratung ohne Partnerschaft kostenpflichtig | Übertragung per Knopfdruck ins DATEV-Rechenzentrum, Listung im Marktplatz = Vertrieb an Kanzleien | belegt (FAQ DATEV); Kosten nur aus Community-Beitrag 2023 (~1 Tagessatz einmalig, Grundgebühr + Klickpreis) |
| **D · Direktimport Anlage V in DATEV Einkommensteuer** | — | — | — | **nicht belegt** — DATEV nennt nur die eigene Übergabe aus Rechnungswesen |
| **E · Addison (Wolters Kluwer)** | wie B, wenn Addison das DATEV-ASCII-Format liest | Kanzlei nutzt Addison Buchhaltung | Buchungsimport; ESt-Import nicht belegt | DATEV-ASCII-Import in Addison nur über Drittanbieter-Hilfeseite belegt; ESt **offen** |
| **F · ELSTER direkt (ERiC)** | sehr hoch — vollständige ESt-Erklärung (Hauptvordruck + Anlagen), jährliche ERiC-Updates, Plausibilitäten, Haftung | Herstellerregistrierung + Prüfung durch BayLfSt, Hersteller-ID; Authentifizierung des Steuerpflichtigen (ELSTER-Zertifikat) [Pflichtdetails **offen**] | Mandant ohne Kanzlei gibt ab; aber nur Anlage V allein ist **keine** Erklärung | ERiC kostenlos + Registrierung belegt; „nur Anlage V geht nicht“ **Annahme** |
| **G · Consumer-Steuersoftware** (WISO Steuer/Buhl, Taxfix, SteuerSparErklärung) | — | — | — | **kein offener Importweg belegt**; Buhl wirbt nur mit Bankdaten-Import, Taxfix nennt nur ELSTER-Übertragung |
| **H · Ausfüllhilfe für Selbstabgeber** (Ansicht „Zeile 9 · Kz 1234 · Betrag“ zum Abtippen in Mein ELSTER / WISO) | gering — Anlage-V-Ansicht gibt es | keine | Nutzer ohne Kanzlei überträgt in 10 Minuten selbst, egal mit welchem Programm | Grundlage im Code belegt |

**Zu „Aviso Steuer“:** Ein Produkt dieses Namens war nicht auffindbar. Gemeint ist sehr wahrscheinlich **WISO Steuer** (Buhl) — gesprochen „wiso“, per Spracheingabe leicht zu „Aviso“ verhört. [Annahme — bitte bestätigen]

### Empfehlung in Stufen

**Stufe 1 · ohne Partnervertrag (jetzt)**
- Freigabe je Steuerjahr mit eingefrorenem Stand, Rückfragen, Freigabe, Protokoll (Abschnitt 3–4).
- Weg 2: Verbindungscode der Kanzlei, mehrere Partner je Nutzer.
- **Kanzlei-Paket (Weg A):** ZIP mit Steuermappe-PDF, `anlage-v-<jahr>-<objekt>.csv` (Spalten: Steuerjahr, Objekt, Halter, Zeile, Kennzahl, Bezeichnung, Betrag, Herkunft `formular/auffang/sachlogik`, Hinweis) und den Belegen.
- **Ausfüllhilfe (Weg H)** für Nutzer ohne Kanzlei — ehrlich benannt: „zum Übertragen in dein Steuerprogramm oder Mein ELSTER“.
- Nutzen ab Tag 1, keine Abhängigkeit von DATEV, Addison oder Buhl.

**Stufe 2 · DATEV-Format, später Marktplatz (wenn Kanzleien fragen)**
- 2a: EXTF-Buchungsstapel je Objekt und Jahr (Weg B) — nur, wenn mindestens eine Partnerkanzlei bestätigt, dass sie V+V-Mandate in DATEV Rechnungswesen bucht und den Import nutzen würde. Vorher eine Probedatei mit ihr testen.
- 2b: Schnittstellen-Partner mit Datenservice (Weg C), sobald 25 Kanzleikunden absehbar sind (DATEV-Bedingung). Vorher Gespräch mit dem DATEV-Partnermanagement über einen Weg **in DATEV Einkommensteuer** — das ist die eigentliche Frage, die keine öffentliche Seite beantwortet.
- Addison: gleiches Vorgehen, Anfrage bei Wolters Kluwer.

**Stufe 3 · ELSTER direkt (zurückstellen)**
- Erst, wenn DealPilot bewusst eine vollständige Einkommensteuererklärung anbieten will. Für Anlage V allein lohnt es nicht: ohne Hauptvordruck keine Abgabe [Annahme]. Alternativ prüfen, ob ein bestehender ELSTER-Hersteller eine Übernahme-Schnittstelle anbietet [offen].

---

## 7 · Offene Fragen an Marcel

1. **„Aviso Steuer“** — ist WISO Steuer gemeint, oder ein anderes Programm?
2. **Preis Weg 2:** Zahlt die Kanzlei für Mandanten, die sich mit eigenem Abo verbinden, etwas (z. B. je verbundenen Mandanten), oder ist das gratis und nur Weg 1 kostet Seats?
3. **Bekommt ein Weg-2-Nutzer einen Vorteil**, wenn er sich verbindet (Rabatt, Kontingent)?
4. **Darf die Kanzlei Werte selbst korrigieren**, oder nur zurückgeben? (Vorschlag: nur zurückgeben — dann bleibt der Mandant Herr seiner Daten.)
5. **Steuerjahr oder Dauer-Mandat?** Reicht „verknüpft für 2025“, und für 2026 muss der Mandant neu zustimmen — oder soll es eine Daueroption „bis auf Widerruf“ geben?
6. **Welche Halter** gehören in die Steuerfreigabe? Nur Privat (Anlage V), oder auch GmbH/UG/GbR (dort Buchhaltung/Feststellungserklärung statt Anlage V — `werbungskosten-pdf.js` unterscheidet das schon)?
7. **Gibt es eine Kanzlei**, mit der wir Stufe 1 und eine EXTF-Probedatei testen dürfen? Welche Software nutzt sie (DATEV ESt classic/comfort, Addison)?
8. **Anlage V 2026:** Die Formulardatei fürs nächste Jahr gibt es noch nicht — soll die Freigabe für 2026 erst kommen, wenn das amtliche Formular vorliegt (so wie heute die Anlage-V-Ansicht)?
9. **Belege:** Sollen Belege (Rechnungen, Kontoauszüge) Teil des Pakets sein? Dafür müssen sie je Kostenzeile zugeordnet sein — das ist heute nicht nachgemessen.

---

## 8 · Quellen

**Code (Repo, Zweig `staging`)**
- `backend/migrations/055_reseller_core.sql`, `056_partner_plan.sql`, `057_reseller_invites.sql`, `026_tax_snapshots.sql`
- `backend/src/services/resellerService.js` (Freigaben, Einladungen, Seats), `backend/src/routes/resellerPortal.js`, `resellerInvite.js`, `resellerAdminPanel.js`
- `backend/src/routes/objects.js` (`/portfolio-export`, `/:id/steuer-snapshot`), `backend/src/routes/wkAggregate.js`, `backend/src/services/portfolioExport.js`
- `frontend/js/reseller-portal.js`, `mandant-freigaben.js`, `mandanten.js` (Halter!), `anlage-v-2025.js`, `werbungskosten-pdf.js`, `import-export-modal.js`

**DATEV**
- FAQ für Softwarehersteller (Partnerkategorien, 25 Kunden, Beratung, Zertifizierung): https://www.datev.de/web/de/berufsgruppenuebergreifend/ueber-datev/portfolio/oekosystem/partnering/datev-marktplatz/faq-fuer-softwarehersteller
- Erste Schritte zum Partnerstatus: https://www.datev.de/web/de/berufsgruppenuebergreifend/ueber-datev/portfolio/oekosystem/partnering/datev-marktplatz/erste-schritte-zum-partnerstatus
- FAQ zum DATEV-Marktplatz: https://www.datev.de/web/de/ueber-datev/das-digitale-oekosystem-von-datev/partnering/datev-marktplatz/faq-zum-datev-marktplatz/
- DATEV Vermietung und Verpachtung (Übergabe in Anlage V, setzt DATEV Rechnungswesen + DATEV ESt voraus): https://www.datev.de/web/de/shop/produkt-details/datev-vermietung-und-verpachtung-74552
- Pressemitteilung 2024 „Effiziente Deklaration von Miet- und Pachteinkünften“: https://www.datev.de/web/de/berufsgruppenuebergreifend/presse/presseinformationen/meldungen-2024/effiziente-deklaration-von-miet-und-pachteinkuenften
- Fachbeitrag Vermietung und Verpachtung: https://www.datev.de/web/de/steuerberatung/loesungen/rechnungswesen/buchfuehrung-erstellen/fachbeitrag-vermietung-und-verpachtung
- DATEV-Format (EXTF-CSV): https://developer.datev.de/datev/platform/en/dtvf
- Datei-Schnittstellen: https://developer.datev.de/datev/platform/en/file-interfaces
- Entscheidungshilfe Datenservices (u. a. Belegbilderservice Einkommensteuer): https://www.prod.datev.de/content/dam/markenassets/unternehmenskommunikation/pdf/portfolio/entscheidungsilfe_datenservices.pdf
- Community (inoffiziell, 2023, Kosten DATEVconnect online ~1 Tagessatz): https://www.datev-community.de/t5/Unternehmen-online/Kosten-Datev-Online-als-Anbieter/m-p/338461

**ELSTER**
- Entwickler-Infoseite (Registrierung, Prüfung BayLfSt, Hersteller-ID, ERiC kostenlos): https://www.elster.de/eportal/infoseite/entwickler
- Registrierung für Entwickler: https://www.elster.de/elsterweb/registrierung-entwickler
- Rechtliches (ERiC-Pflicht für Drittprogramme): https://www.elster.de/eportal/infoseite/rechtliches

**Addison / Wolters Kluwer**
- Addison Steuern SME: https://www.wolterskluwer.com/de-de/solutions/addison-komplettloesung-mittelstand/addison-steuern-sme
- Drittanbieter-Hilfe „Export für ADDISON“ (DATEV-ASCII v7 als Importformat, sekundär): https://support.easybill.de/hc/de/articles/360021491119-Export-f%C3%BCr-ADDISON

**Consumer-Software**
- Buhl / WISO Steuer (Bankdaten-Import): https://www.buhl.de/steuer/?p=5792
- Taxfix Sicherheit (Übertragung über ELSTER): https://taxfix.de/sicherheit/
- Kein offizieller Importweg für Fremddaten gefunden bei WISO Steuer, Taxfix, SteuerSparErklärung — **Verneinung gilt für die durchsuchten Seiten am 02.11.2026**, nicht allgemein.

**Rechtsnormen (genannt, Wortlaut nicht nachgelesen):** Art. 6, 7, 28 DSGVO · § 57, § 62a, § 66 StBerG · § 203 StGB · § 147 AO.
