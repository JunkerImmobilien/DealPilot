# 10 · Steuer-Grundlagen — zvE, Grenzsteuersatz, AfA, Steuerwirkung

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 10a „Steuer: AfA, Zeiträume, Restnutzungsdauer" (`DREHBUECHER`-Schlüssel `reihe-steuer`, Studio `?modul=10a`) ·
> Messe-Geschichten: 4 Westerfeldstr. (AfA per Gutachten), 6 GmbH, 15 „Die Mappe für den Steuerberater"
> (design/Messe/demo-geschichten.md)

## 1 · Wozu

Die Steuer ist bei Immobilien oft der stille Co-Pilot: Abschreibung und Zinsen senken in den ersten Jahren die Steuer,
später kehrt sich das um. Im Reiter Steuer trägst du einmal dein zu versteuerndes Einkommen ein, und DealPilot rechnet
für jedes Jahr, was dieses Objekt an deiner Steuer ändert — als Differenz zweier echter Tarifberechnungen, mit und ohne
das Objekt. So steht im Cashflow nach Steuern deine Zahl, nicht ein pauschaler Prozentsatz.

## 2 · Wo in der App

- **Reiter Steuer** (`data-target-sec="s3-tax"`):
  - Karte **Persönliche Steuer**: Zu versteuerndes Einkommen (zvE) vor Immobilie; Haken **„Grenzsteuersatz
    automatisch aus zvE berechnen"** (§ 32a EStG, Tarif 2026) — abhaken, um den Satz selbst einzutragen. Das zvE liegt
    zentral im Profil.
  - Knopf **„📅 Steuerzeiträume verwalten →"** — führt in Einstellungen → Mandanten → Privat → Bearbeiten
    (Gültig von / bis, zvE / Jahr, Grund, Notiz).
  - Karte **AfA-Konfiguration**: Feld **AfA-Satz** (2,0 % linear ab 1925 · 2,5 % vor 1925 · 3,0 % Wohnzwecke ab 2023 ·
    5,0 % degressiv, mit oder ohne Wechsel auf 3 % linear · „Eigenen Satz / Restnutzungsdauer eingeben …"),
    **Gebäudeanteil am KP (%)**, Knopf **BMF-Rechner**, **AfA / Jahr (berechnet)** mit „AfA-Verlauf erste 10 Jahre
    ansehen", aufklappbar **§ 7b Sonder-AfA**.
  - Darunter: Steuerverlauf mit Wendepunkt (siehe 14), Steuerformular pro Jahr (siehe 13).
- Halter des Objekts (Privat oder Gesellschaft) wählst du am Objekt; eine GmbH rechnet mit Körperschaftsteuer (siehe 29).

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH, Kauf 01.01.2025, KP 545.000 €)

| Feld | Wert |
|---|---|
| zvE vor Immobilie | 90.000 € (in allen Demo-Objekten gleich — ein Investor) |
| Grenzsteuersatz (automatisch) | 42 % |
| Gebäudeanteil am KP | 14,6 % (BMF-Arbeitshilfe, siehe 12) |
| AfA-Satz | eigener Satz 6,25 % · Nutzungsdauer 16 Jahre · Grundlage Nutzungsdauergutachten vom 28.05.2025 |

**Was die App zeigt:**

- **AfA / Jahr 5.609 €.** Klein, weil der Boden hier teurer ist als der Kaufpreis: 1.570 m² × 450 €/m² = 706.500 €
  Bodenwert. Jeder Prozentpunkt Gebäudeanteil ist AfA-Basis.
- **Steuer aus dem Objekt 2026: 2.104 €** (mit Werbungskosten, Stand nach der Befüllung). Das Objekt ist vom ersten Jahr
  an steuerlich positiv; 2028–2030 drehen die Bäder und Böden (Erhaltungsaufwand) die Jahre zur Erstattung.
- Ohne Gutachten (2 %, 50 Jahre) wäre die AfA rund ein Drittel davon — die Rechnung aus Geschichte 4 (Standard 1.719 €
  gegen 5.371 €, Stand 14.10.) zeigt den Hebel: rund 1.530 € weniger Steuer im Jahr, 16 Jahre lang.

**So entsteht die Steuerwirkung:** Ergebnis aus Vermietung (Miete − Kosten − Zinsen − AfA) wird auf dein zvE gerechnet.
DealPilot rechnet den Tarif zweimal — mit und ohne Objekt — und nimmt die Differenz. Deine gespeicherten
Bestandsobjekte rechnen dabei **in der Reihenfolge ihres Kaufs** mit: ein Verlust aus einem älteren Objekt senkt die
Basis, auf der das neue spart.

**Steuerzeiträume:** Ändert sich dein Einkommen (Beispiel: Lohnerhöhung), legst du einen neuen Zeitraum an. Jedes
Steuerjahr nimmt das zvE des Zeitraums, der zur Jahresmitte gilt.

**GmbH zum Vergleich — Hölderlinstr., Bad Oeynhausen:** 2026 Ergebnis 1.953 € → **309 €** Steuer bei 15,825 %
Körperschaftsteuer + Soli; privat wären es rund 814 €. Keine Erstattung bei Verlust.

Belegt: zvE/42 % demo-geschichten A.2; 14,6 %, 1.570 × 450 = 706.500 € Geschichte 4; AfA 5.609 € und Steuer 2026
2.104 € Korrektur zu Geschichte 4 (Stand 20.10. nach Befüllung), Steuer 2026 auch in `DpSteuerVerlauf.reihe()` gemessen (20.10.); 1.719/5.371/1.530 € Geschichte 4 (Stand 14.10.); Gutachten-Datum Geschichte 4;
GmbH Geschichte 6; Tarif/Reihenfolge/Zeiträume help.js („Grenzsteuersatz und Steuerwirkung", „Steuerzeiträume").

## 4 · Was man daraus liest — Fragen am Stand

- **„Woher kennt ihr meinen Steuersatz?"** — Aus deinem zvE nach § 32a EStG. Du kannst ihn auch selbst setzen.
- **„Rechnet ihr pauschal 42 % auf den Verlust?"** — Nein, zwei echte Tarifberechnungen. Bei großen Verlusten sinkt der
  Grenzsteuersatz mit — das sieht man im Cockpit (Abschnitt Steuer über alle Objekte).
- **„Was bringt § 7b?"** — Zusätzlich 5 % in vier Jahren, nur wenn du alle vier Voraussetzungen bestätigst
  (Effizienzhaus 40 NH, Baukosten ≤ 5.200 €/m², zehn Jahre Vermietung, Bauantrag/Kaufvertrag 01.01.2023–30.09.2029);
  Basis gekappt auf 4.000 €/m².
- **„Kann ich schneller abschreiben?"** — Mit einem Restnutzungsdauer-Gutachten (§ 7 Abs. 4 Satz 2 EStG), siehe 11.

## 5 · Grenzen und Kennzeichnung

- **DealPilot ist eine Rechenhilfe, keine Steuerberatung** (§ 6 StBerG). Die finale Beurteilung gehört zum
  Steuerberater.
- Verlustverrechnungsgrenzen (§ 15a, § 15b, § 10d EStG) bleiben außen vor.
- Ein eigener AfA-Satz braucht beim Finanzamt einen Nachweis; DealPilot übernimmt die Zahl, prüft das Gutachten nicht.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Karte Persönliche Steuer | zvE eintragen | Dein zu versteuerndes Einkommen vor der Immobilie — einmal eintragen, es gilt für alle Objekte. |
| 2 | Grenzsteuersatz | Haken „automatisch" | Der Grenzsteuersatz nach § 32a, Tarif 2026. Haken raus, wenn du ihn selbst setzen willst. |
| 3 | Steuerzeiträume | „Steuerzeiträume verwalten" | Einkommen ändert sich: je Zeitraum ein eigenes zvE. Jedes Jahr nimmt den Zeitraum zur Jahresmitte. |
| 4 | AfA-Konfiguration | AfA-Satz aufklappen | Zwei, zweieinhalb, drei Prozent linear oder degressiv — oder ein eigener Satz über die Restnutzungsdauer. |
| 5 | Gebäudeanteil | — | Nur das Gebäude wird abgeschrieben. Den Anteil liefert der BMF-Rechner. |
| 6 | AfA / Jahr, Steuer-Effekt | — | Die Steuerwirkung ist die Differenz zweier Tarifberechnungen — mit und ohne dieses Objekt. |

### Sprechertext (Entwurf, ca. 85 Sekunden)

Im Reiter Steuer sitzt der stille Co-Pilot deines Investments. Du trägst einmal dein zu versteuerndes Einkommen ein.
DealPilot rechnet daraus deinen Grenzsteuersatz nach dem Tarif 2026 — oder du setzt ihn selbst. Ändert sich dein
Einkommen, legst du Steuerzeiträume an.
Darunter die Abschreibung. Zwei Prozent linear sind der Standard, für Altbauten vor 1925 zweieinhalb, für neue
Wohngebäude drei Prozent oder degressiv. Abgeschrieben wird nur das Gebäude — wie groß sein Anteil ist, ermittelt der
BMF-Rechner.
Und jetzt der wichtigste Satz: DealPilot rechnet keine Pauschale. Die Steuerwirkung ist die Differenz zweier echter
Tarifberechnungen — mit und ohne dieses Objekt. Deine anderen Objekte rechnen in der Reihenfolge ihres Kaufs mit.
So steht im Cashflow nach Steuern deine Zahl.
DealPilot ist eine Rechenhilfe. Die Steuerberatung bleibt beim Steuerberater.

## Querverweise

11 Restnutzungsdauer-Rechner · 12 BMF-Kaufpreisaufteilung · 13 Werbungskosten und 15-%-Grenze · 14 Steuerverlauf mit
Wendepunkt · 23 Portfolio-Cockpit (Steuer über alle Objekte, Steuer-Mappe) · 29 Mandanten und GmbH.
