# 31 · Whitelabel und Partner-Plan — NUR INTERN

> **Nur intern, nicht am Stand zeigen.** Für Vertriebsgespräche mit Maklern, Finanzierern, Steuerberatern, die DealPilot unter eigener Marke für ihre Mandanten wollen. Preise nie aus dieser Datei nennen — „laut Preisübersicht".
> Stand 20.10.2026 (Staging bis v2544). Video: noch kein Video (Kandidat „Darstellung und Whitelabel" in Videoreihe.md) · Messe-Geschichte: — (Geschichte 10 und 14 richten sich an Makler/Partner, zeigen aber die normale App)

## 1 · Wozu

Ein Partner — Makler, Finanzierer, Berater — gibt DealPilot an seine Mandanten weiter: unter **seinem Logo und seinen Farben**. Er kauft Plätze (Seats) im Lizenz-Pool, lädt Mandanten per E-Mail ein, und die Mandanten können ihm Objekte zur Betreuung freigeben. Heute gibt es **genau ein** Partner-Abo; vor dem ersten echten Whitelabel-Kunden werden die sichtbaren Flächen noch nachgezogen (siehe Grenzen).

## 2 · Wo in der App

- **Partner-Plan** = ein erweiterter Pro (dasselbe Kontingent wie Pro: `aiCreditsService.js` `KONTINGENT.partner`).
- **Partner-Portal** (`reseller-portal.js`): „Übersicht & Lizenz-Pool — Seats kaufen und an deine Mandanten verteilen." Blöcke: Partner-Plan aktiv · Abo & Rechnungen · **Lizenz-Pool** (zugewiesen/frei) · **Seats kaufen** (monatlich oder jährlich, Anzahl, Kasse über Stripe) · **Mandanten** (Seat zuweisen, Einladung ausstehend, „Name des Mandanten", „E-Mail (bekommt die Einladung)", Einladung senden) · Freigaben.
- **Mandanten-Seite** (`mandant-freigaben.js`): Einstellungen → „Meine Freigaben" — erscheint nur, wenn der Nutzer Mandant eines Partners ist; er gibt eigene Objekte an seinen Betreuer frei und kann sie zurückgeben.
- **Marke:** `whitelabel-override.js` → `DealPilotWhitelabel.apply()` setzt `--gold` samt Abstufungen, `--obsidian` und die `--wl-<hex>`-Tokens am `<html>`; `mandant-branding.js`, `darstellung-reseller.js`, `qc-whitelabel.js`, `mb-whitelabel.js` tragen die Marke in Quick Boarding und Marktbericht. PDFs übernehmen den Akzent (Bank-PDF in der weißen Fassung, Modul 19).
- **Einstellungen → Kontakt & Logo**: Logo in PDF-Kopf, Kontakt im PDF-Fuß — das gibt es für jeden Nutzer, nicht nur für Partner.

## 3 · Schritt für Schritt — Ablauf (ohne echte Zahlen)

| Schritt | Wer | Klick | Ergebnis |
|---|---|---|---|
| 1 | Partner | Partner-Portal → Seats kaufen | Plätze im Lizenz-Pool (Preis laut Preisübersicht) |
| 2 | Partner | Mandanten → Name, E-Mail → Einladung senden | Mandant bekommt eine Einladung; Status „Einladung ausstehend" |
| 3 | Partner | Seat zuweisen | Mandant nutzt DealPilot unter der Marke des Partners |
| 4 | Mandant | Einstellungen → Meine Freigaben | gibt ein Objekt an seinen Betreuer frei |
| 5 | Partner | Freigaben | sieht das freigegebene Objekt |

**Belegt:** Beschriftungen aus `reseller-portal.js` (Z. 165–376) und `mandant-freigaben.js` (Kopf); Token-Mechanik aus CLAUDE.md „Whitelabel-Pflicht"; „ein Partner-Abo" aus CLAUDE.md (Gold-Audit-Absatz). Keine Zahlen gemessen.

## 4 · Was man daraus liest — Fragen im Partnergespräch

- **„Sieht mein Mandant DealPilot oder mich?"** — Deine Farben und dein Logo; die Rechenkerne bleiben dieselben.
- **„Sehe ich die Objekte meiner Mandanten?"** — Nur, was der Mandant dir ausdrücklich freigibt — und er kann es zurückgeben.
- **„Was kostet ein Seat?"** — Laut Preisübersicht; Staffel nach Anzahl, jährlich mit Freimonaten.

## 5 · Grenzen und Kennzeichnung

- **Hartes Gold ist noch nicht überall abgetragen:** der Gold-Audit führt eine Basislinie von Fundstellen, die sich beim Mandanten nicht umfärben. Vor dem ersten echten Whitelabel-Kunden gehören die sichtbaren Flächen nachgezogen — zuerst `pricing-modal.js`, `reseller-portal.js`, `qc-bridge.js` (CLAUDE.md). Am 19.10. wurden 53 groß geschriebene Tokens korrigiert, die sich nie umgefärbt hatten (v2421).
- **Statusfarben** (Grün, Rot) bleiben in jeder Marke gleich — gewollt.
- Partner-Namen und Mandanten-Daten nie in Messe-Videos.
- Datenschutz: wer DealPilot beruflich für Mandanten nutzt, braucht einen AV-Vertrag nach Art. 28 DSGVO (Handbuch 32).

## 6 · Für das Video (nur für ein internes Partner-Video)

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Partner-Portal, Übersicht | — | Dein Cockpit als Partner: Lizenz-Pool, Mandanten, Freigaben. |
| 2 | Seats kaufen | Anzahl wählen (nicht bezahlen) | Plätze für deine Mandanten — monatlich oder jährlich. |
| 3 | Mandant einladen | Name, E-Mail (Testadresse) | Eine Einladung, ein Seat — dein Mandant fliegt unter deiner Marke. |
| 4 | App im Partner-Look | — | Deine Farben, dein Logo, dieselben Rechenkerne. |
| 5 | Meine Freigaben (Mandantensicht) | Objekt freigeben | Der Mandant entscheidet, welche Objekte du siehst. |

### Sprechertext (Entwurf, ca. 60 Sekunden)

Du betreust Kunden, die Immobilien kaufen? Dann gib ihnen DealPilot — unter deiner Marke.

Im Partner-Portal kaufst du Plätze für deinen Lizenz-Pool und lädst deine Mandanten per E-Mail ein. Sie sehen deine Farben und dein Logo, rechnen aber mit denselben Kernen wie jeder DealPilot-Nutzer: Cashflow, DSCR, Steuer, Deal Score.

Will dein Mandant, dass du auf ein Objekt schaust, gibt er es dir frei. Und er kann es jederzeit zurücknehmen. So bleibt klar, wem welche Daten gehören.

## Querverweise

- Handbuch 01 (Pläne, Kontingent), 26 (Kontakt & Logo, Darstellung), 27 (Sicherung als Übertragungsweg), 32 (Datenschutz, AV-Vertrag)
