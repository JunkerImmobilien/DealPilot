# design/

Vorlagen und Bildmaterial für die Oberfläche. **Nichts hier wird ausgeliefert** —
das sind Referenzen, gegen die gebaut wird.

Was live geht, liegt unter `frontend/assets/`.

---

## mockups/

Eigenständige HTML-Dateien. Doppelklick genügt, kein Server nötig.
Sie zeigen den **Zielzustand**, nicht den Ist-Zustand.

| Datei | Wofür |
|---|---|
| `dp-darstellung-panel.html` | **Der abgenommene Zielzustand.** Panel rechts, App links live. Darstellung × Karten × Fläche × Partnerfarben |
| `dp-mockup-alle-formate.html` | Desktop, Tablet quer, Tablet hoch, Handy — dieselbe Oberfläche in vier Größen |
| `dp-handy-mockup-v2.html` | Handy in drei Zuständen: Formular, Objektliste, Aktionen |
| `dp-einstellungen-darstellung.html` | Einstellungen → Profil & Anzeige, Plan-Abstufungen durchschaltbar |

**So werden sie benutzt:** Bei einer Layoutfrage nicht raten, sondern das
Mockup öffnen und nachsehen, wie es dort gelöst ist. Die Schalter oben in
jedem Mockup zeigen die Varianten.

**Was sie nicht sind:** Kein Code zum Kopieren. Die Mockups sind Neubauten mit
sauberem Markup — die echte App hat eine gewachsene Struktur. Übernommen wird
die **Gestaltung**, nicht die Umsetzung.

---

## logo/

Logo-Varianten für die drei Fassungen.

| Datei | Einsatz |
|---|---|
| `dp-logo-dark.png` | Fassung DealPilot (Obsidian) — heutiges Logo |
| `dp-logo-light.png` | Fassung Kontor und Panel — für hellen Untergrund |
| `dp-logo-mark.png` | Nur die Bildmarke, für eingeklappte Leiste und Handy |

Empfehlung: PNG mit Transparenz, doppelte Auflösung (Retina). Die Bildmarke
quadratisch, damit sie in runde und eckige Rahmen passt.

Legt man hier neue Dateien ab, gehören sie beim Umsetzen nach
`frontend/assets/` kopiert — nicht von hier aus verlinkt.

---

## Farben und Schriften

Stehen in `CLAUDE.md` unter „Marke und Design". Dort ist die Quelle, nicht
hier — sonst laufen zwei Listen auseinander.

Kurz: Obsidian `#050505`, Gold `#C9A84C`, Grün `#3FA56C`, Rot `#B8625C`,
Creme `#FDFCFA`. Schriften: Space Grotesk, JetBrains Mono, Inter,
Cormorant Garamond.

**Statusfarben werden nie tokenisiert** — Grün und Rot bleiben in jeder Marke
gleich, auch im Whitelabel.
