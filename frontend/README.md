# Junker Immobilien – Kalkulations-App V5.0

Professionelle Immobilienkalkulations-App mit Investment Case PDF-Export.

## 🚀 Starten mit GitHub Pages

1. Repository `junker-kalkulation` anlegen (Public)
2. Alle Dateien hochladen (oder ZIP entpacken)
3. **Settings → Pages → Branch: main → / (root) → Save**
4. URL: `https://DEIN-USERNAME.github.io/junker-kalkulation/`

## 💻 Lokal starten (empfohlen für Tests)

```bash
cd junker-kalkulation
python3 -m http.server 8080
# → http://localhost:8080
```

Alternativ: `npx serve .` oder einfach `index.html` im Browser öffnen.

## 📦 Projektstruktur

```
junker-kalkulation/
├── index.html          ← Haupt-App (8 Tabs)
├── css/
│   └── style.css       ← Komplettes Styling
├── js/
│   ├── calc.js         ← Alle Berechnungen (KPIs, IRR, Projektion)
│   ├── charts.js       ← 3 Chart.js Charts
│   ├── pdf.js          ← 6-seitiger Investment Case PDF
│   ├── storage.js      ← Speichern/Laden/Export/Import
│   ├── ai.js           ← Claude KI-Analyse
│   └── main.js         ← Tab-Navigation, Fotos, Init
└── README.md
```

## ✨ Features

- **8 Tabs:** Objekt+Fotos, Investition, Miete+Steuern, Finanzierung, BWK, KI-Analyse, Kennzahlen, Gespeicherte
- **Live-Berechnung:** Alle KPIs updaten sofort beim Tippen
- **PDF Investment Case:** 6 Seiten, professionelles Bankdokument (inkl. KI-Analyse, Fotos)
- **CSV Export:** Cashflow-Projektion als Tabelle
- **KI-Analyse:** Claude analysiert mit 6 Blöcken (API-Key nötig)
- **Lokal Speichern:** Mehrere Objekte in localStorage
- **JSON Import/Export:** Datensicherung und Übertragung
- **Foto-Upload:** Drag & Drop, bis zu 6 Fotos

## 🔑 KI-Analyse

1. Auf [console.anthropic.com](https://console.anthropic.com/settings/keys) registrieren
2. API Key erstellen (kostenlos / Pay-per-use)
3. In Tab "KI-Analyse" eingeben und speichern

## 📄 PDF-Inhalt (6 Seiten)

1. **Deckblatt** – Dunkles Design, Gold-Akzente, Titelfoto, 4 Cover-KPIs
2. **Executive Summary** – KPI-Tiles, Szenarien, Cashflow-Rechnung
3. **Objekt & Finanzierung** – Nebenkosten, Wertpuffer, Darlehensstruktur, BWK
4. **Cashflow-Projektion** – 20-Jahres-Tabelle mit Goldzeile = Zinsbindungsende
5. **KI-Analyse** – Strukturierte AI-Bewertung (falls vorhanden)
6. **Annahmen & Disclaimer** – Prognose-Parameter, rechtlicher Hinweis

---
Junker Immobilien · www.junker-immobilien.io
