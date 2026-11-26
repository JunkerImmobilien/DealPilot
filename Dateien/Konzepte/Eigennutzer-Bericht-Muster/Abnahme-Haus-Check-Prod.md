# Abnahme Haus-Check auf Prod: echter Kauf mit Erstattung

Für Marcel. Dauer etwa 10 Minuten. Erst nach dem Freischalten (`HAUSCHECK_AKTIV=1` und Schalter in Admin › Betrieb an).

1. **Seite öffnen:** https://dealpilot.immo/ , im Deal-Check oben den Reiter **„Selbst nutzen“** wählen (führt zu `haus-check.html`). Der Reiter erscheint nur, wenn der Verkauf an ist.
2. **Rechnen:** Ein echtes Objekt eintragen (mit Straße und Hausnummer, beim Haus mit Grundstücksfläche, Keller, Geschosse, Dach). „Startfreigabe · Haus prüfen“.
3. **Kaufen:** Unter dem Ergebnis das Häkchen zum Widerrufsrecht setzen, „Haus-Check kaufen · 9,99 €“. Bei Stripe mit der eigenen Karte zahlen (Anschrift wird abgefragt).
4. **Zurück auf der Seite prüfen:**
   - „Dein Haus-Check ist fertig“ erscheint (Zahlung wird bis zu 30 Sekunden geprüft).
   - Der Haus-Score oben und im Kasten sind gleich, darüber „Mit dem Wert nach ImmoWertV gerechnet“.
   - Die Anrechnung steht da: „Code HC…“, gültig 14 Tage.
   - „PDF herunterladen“ liefert das PDF, „Im Browser ansehen“ zeigt es.
5. **PDF prüfen:** Verkehrswert oder vorläufiger Wert mit Rechenweg, Beleihungswert, Haushaltsrechnung, Umfeld, Fußzeile „DealPilot · Haus-Check“, Code in „Weiter in DealPilot“.
6. **Admin › Betrieb:** Karte „Verkauf“: Haus-Check heute 1 (9,99 €).
7. **Stripe (Live-Dashboard):** Zahlung 9,99 € mit Rechnung, Promotion-Code `HC…` auf Coupon `dp_hauscheck_anrechnung` angelegt.
8. **Erstatten:** Stripe › Zahlungen › die 9,99 € › „Erstatten“ › volle Summe. Danach den Promotion-Code `HC…` deaktivieren (Stripe › Produkte › Gutscheine › dp_hauscheck_anrechnung › Code archivieren), damit die Anrechnung nicht genutzt wird.
9. **Optional Gegenprobe:** In Admin › Betrieb „Haus-Check verkaufen“ ausschalten, Seite neu laden: statt des Kaufknopfs steht „Bald verfügbar“. Wieder einschalten.

Bei Abweichung: Bildschirmfoto an Claude, nichts weiter tun. Not-Aus ohne Admin: `HAUSCHECK_AKTIV=0` in der Prod-.env und Backend neu erzeugen.
