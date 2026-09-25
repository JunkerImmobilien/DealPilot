# Bremen und Saarland — die zwei letzten Länder ohne Sachwertfaktor

**Geklärt am 23.09.2026.** Beide standen in `laender-registry.js` als
„echte Lücke, noch nicht lokalisiert". Beide sind jetzt lokalisiert — und in
beiden Fällen ist das Ergebnis eine **begründete Auskunft**, kein Wert.

Das ist kein Misserfolg. CLAUDE.md: *„Wo kein Wert vorliegt, bekommt der Kunde
den Weg dorthin — den zuständigen Ausschuss und den Link auf seine Quelle."*

---

## Bremen: **es gibt keine Sachwertfaktoren**

Der Gutachterausschuss Bremen schreibt es selbst, im frei zugänglichen Auszug
des Grundstücksmarktberichts 2026, Abschnitt 8.4:

> Gemäß § 21 (3) Nr. 1 ImmoWertV 2021 sowie §§ 35 bis 38 ImmoWertV 2021 sollen
> von den Gutachterausschüssen Sachwertfaktoren ermittelt werden. Es handelt
> sich hierbei um eine personalintensive Aufgabe. **Aufgrund unzureichender
> Personalausstattung seiner Geschäftsstelle sieht sich der Gutachterausschuss
> Bremen derzeit nicht in der Lage, dieser zusätzlichen Aufgabe nachzukommen.**
> Sachverständigen wird daher empfohlen, für Verkehrswertableitungen
> einzelfallbezogene Vergleichskaufpreise (Auskünfte aus der
> Kaufpreissammlung) einzuholen.

**Damit ist Bremen abschließend geklärt.** Es fehlt nicht in unserer Ernte —
es existiert nicht. Der Bericht nennt sogar die Alternative, und die gehört in
die Auskunft: Vergleichskaufpreise aus der Kaufpreissammlung.

### Der Liegenschaftszinssatz dagegen existiert

Abschnitt 8.1 des Berichts führt ihn, aufgeteilt nach Eigentumswohnungen
(8.1.1), Wohngebäuden (8.1.2), Büro- und Geschäftshäusern (8.1.3) und
Gewerbeimmobilien (8.1.4) — Seiten 113 bis 123.

**Der freie Auszug hat nur 15 Seiten** und endet vor diesem Abschnitt. Der
Vollbericht kostet **50 €** bei GeoInformation Bremen und wird nach unserer
Regel nicht abgerufen.

| | |
|---|---|
| Ausschuss | Gutachterausschuss für Grundstückswerte in Bremen |
| AGS | 04011 (Bremen) · 04012 (Bremerhaven) |
| Sachwertfaktor | **wird nicht ermittelt** — Personalmangel, im Bericht begründet |
| Liegenschaftszins | vorhanden, Abschnitt 8.1, nur im Vollbericht (50 €) |
| Auszug (frei) | `gutachterausschuss.bremen.de` → Marktbericht |

---

## Saarland: kostenpflichtig und nicht abrufbar

Der Grundstücksmarktbericht wird von der **Zentralen Geschäftsstelle der
Gutachterausschüsse (ZGGA)** beim Landesamt für Vermessung erstellt, alle zwei
Jahre, für sieben Gutachterausschüsse. Er enthält laut Beschreibung
**Liegenschaftszinssätze und Sachwertfaktoren**.

Zwei Gründe, warum daraus nichts wird:

1. **Er kostet 75 €.** Kostenpflichtige Berichte werden nach unserer Regel
   nicht abgerufen.
2. **Die Seite ist gegen automatisierte Abrufe geschützt.** Gemessen: die
   Publikationsseite antwortet mit `403 Forbidden`, der direkte PDF-Link
   liefert 2,2 KB HTML statt eines PDF. Das ist eine Ansage, keine Hürde.

| | |
|---|---|
| Ausschuss | Zentrale Geschäftsstelle der Gutachterausschüsse des Saarlandes |
| Führt | Liegenschaftszinssätze (MFH, gemischt) · Sachwertfaktoren (EFH/ZFH) |
| Zugang | Bericht 75 € · Seite botgeschützt |
| Einstieg | `saarland.de/lvgl` → ZGGA → Grundstücksmarktbericht |

---

## Was ins Register gehört

Beide Länder bekommen einen **Ausschuss-Eintrag ohne Wert**, mit dem Grund —
so wie es `AUSSCHUSS_QUELLEN` in `quellen_links.js` seit v1118b für Stuttgart,
Pinneberg, Kiel und Stormarn führt. Pflichtfeld dort: `warum_kein_wert`.

```
HB  Bremen         warum_kein_wert: "Der Gutachterausschuss ermittelt keine
                   Sachwertfaktoren (Personalausstattung, GMB 2026 Abschnitt
                   8.4). Empfehlung des Ausschusses: Vergleichskaufpreise aus
                   der Kaufpreissammlung."
SL  Saarland       warum_kein_wert: "Grundstücksmarktbericht kostenpflichtig
                   (75 €), Seite gegen automatisierte Abrufe geschützt."
```

Damit ist die Landkarte für den Sachwertfaktor **abgeschlossen**: 14 Länder mit
Werten, Bremen ohne (weil es keine gibt), das Saarland ohne (weil der Zugang
Geld kostet). Kein Land ist mehr unerklärt.
