# DealPilot Landing-Page · v11

## Was in v11 neu ist

### 1. Logo deutlich größer + animierter goldener Rahmen
- Logo wuchs von 88px auf **112px**
- **Conic-Gradient Goldring** läuft umlaufend um das Logo (4 Sekunden pro Drehung)
- Beim Hover: Rotation beschleunigt sich auf 2 Sekunden + Logo bekommt zusätzlichen Drop-Shadow-Glow
- Bei `@property`-fähigen Browsern (Chrome/Edge/Safari modern) als sanft drehender Lichtstreifen; Fallback für ältere Browser über `transform: rotate`

### 2. Workflow (01-05) komplett neu in Szene gesetzt
Vergleich Vorher → Nachher:
- **Vorher:** Eine dünne goldene Linie über dem Step, kleine Nummer „01 · IMPORT", dünner Text
- **Nachher:**
  - Jeder Step ist eine eigene **Card mit Gold-Border und Backdrop-Blur**
  - **Riesige Nummer (56px) in animiertem Gold-Gradient** als visueller Anker
  - Label „// IMPORT" eigenständig unter der Nummer
  - **Horizontale Connector-Linie** verbindet alle 5 Steps optisch
  - **Goldene Bullet-Pins** als Anker oben auf der Linie (mit Glow-Ring)
  - Cards heben sich beim Hover (`translateY -6px`) mit Schatten + Border-Glow
  - Spotlight folgt der Maus durch jede Card (subtiler Radial-Glow)

### 3. Pricing-Sektion deutlich cooler
- **Section-Header** „// Pläne & Preise · Vier Pläne. Vier Credit-Pakete." als Aufmacher
- **Pulsierender Hintergrund-Glow** in der Mitte der Sektion (atmet alle 8 Sekunden)
- **Animierte Gold-Linie** oben fließt durch
- **dp-card Hover-Effekte:** Lift + Gold-Border-Glow + 60px Outer-Glow
- **Credit-Cards Hover:** Lift + Border-Color zu Gold
- **CTA-Buttons** bekommen Shimmer-Sweep beim Hover (Licht streicht von links nach rechts)

### 4. 16 Stories — mit Material aus v2 (Power-Pitch) und v4 (Founder-Voice)
Die 12 Storytelling-Slides bleiben, dazu 4 neue:
- **#13 — Power-Pitch:** „Schluss mit Excel-Voodoo." (große, fette, gradient-text Headline)
- **#14 — Founder-Voice:** Persönliche Geschichte „Vor drei Jahren saß ich an einem Samstagnachmittag…" (Cormorant Garamond Italic, persönliche Signatur)
- **#15 — Power-Pitch:** „Sechs Zahlen. Eine Wahrheit." (Quick-Check-Manifest)
- **#16 — Founder-Voice:** „Die 15-%-Lektion" — eigene Erfahrung aus 2019, in Code gegossen

Die Stilvarianten visuell:
- **Power-Pitch:** Quote ist fett (Gewicht 700), sehr groß (28-42px), Gradient von Weiß zu Gold-Bright, Schwarze Garamond-Italic nicht
- **Founder-Voice:** Cormorant Garamond Italic, persönlicher Ton, Signatur am Ende als kursive Pill

### 5. Auto-Advance: 60 Sekunden statt 120
- Slider wechselt jetzt nach **maximal 1 Minute** automatisch
- Pause beim Hovern bleibt
- Manuelle Navigation (Pfeile, Dots, Tastatur, Swipe) bleibt

## Effekt-Übersicht (komplett)

| # | Effekt | Wo |
|---|---|---|
| 1 | Particle-Network-Background | Global |
| 2 | Story-Slider (16 Stories · 60s Auto-Advance) | Hero-Bereich |
| 3 | Reveal-on-Scroll | Cards, Steps |
| 4 | Cursor-Glow | Folgt der Maus |
| 5 | Magnetic Buttons | Alle CTAs |
| 6 | Tilt-Cards | Workflow + Features |
| 7 | Number-Counter | Hero-Stats |
| 8 | Spotlight (Maus-Follow) | Features, Plans, Workflow-Steps |
| 9 | Scroll-Parallax | Background-Orbs |
| 10 | Ripple | Button-Klicks |
| 11 | **Logo Conic-Gradient Goldring** | Nav-Brand (V11) |
| 12 | **Logo Glow-Drop-Shadow Hover** | Nav-Brand (V11) |
| 13 | **Workflow Big-Numbers Gradient** | Workflow (V11) |
| 14 | **Workflow Connector-Linie + Bullet-Pins** | Workflow (V11) |
| 15 | **Workflow Card-Hover Glow** | Workflow (V11) |
| 16 | **Pricing Pulse-Background** | Pricing (V11) |
| 17 | **dp-card Hover Glow** | Pricing (V11) |
| 18 | **CTA Shimmer-Sweep** | Pricing (V11) |
| 19 | Pricing-Line-Flow | Pricing |
| 20 | Footer-Stars + Aurora | Footer |
| 21 | Footer-Link-Arrow | Footer-Links |
| 22 | Rate-Tile-Glow | Marktzinsen |
| 23 | Custom Scrollbar | Global |
| 24 | **Story-Style-Varianten** Power-Pitch + Founder-Voice | Slider (V11) |

## Dateistruktur

```
landing/
├── index.html                  (~98 KB · alle Sektionen + Effekte)
├── leistungsumfang.html        (~53 KB · 15 Module ausführlich)
├── assets/
│   ├── dealpilot-logo.png      (~35 KB)
│   ├── hero-werbung.jpg        (~257 KB)
│   ├── pricing-plugin.js       (~19 KB)
│   ├── pricing-plugin.css      (~25 KB)
│   └── effects.js              (~20 KB · 12 Effekt-Module)
└── README.md
```

## Plan-Daten & Credits (unverändert)
- Free 0 € · 1 Objekt · 1 KI-Credit einmalig
- Starter 29 € / 290 € · 5 Objekte · 5 KI-Credits/Mo
- **Investor 59 € / 590 €** · 25 Objekte · 15 KI-Credits/Mo · BESTSELLER
- Pro 99 € / 990 € · ∞ Objekte · 40 KI-Credits/Mo

KI-Credits: 5/2 € · 15/5 € · 40/12 € BELIEBT · 100/25 €
