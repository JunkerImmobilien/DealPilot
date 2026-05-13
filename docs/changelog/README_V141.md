# V141 — Datenraum Pro-Objekt-Architektur

## Was ist neu in V141?

V140 hatte den Design-Fehler, dass alle Objekte einen gemeinsamen Bank-Ordner-Slot teilten. V141 stellt das um auf:

### Architektur

**1. Persönlicher Datenraum** (ein globaler Ordner für alle Objekte)
- Personalausweis (Vorder- & Rückseite)
- SCHUFA-Auskunft
- Gehaltsabrechnungen
- Lohnsteuerbescheinigung
- Steuerbescheide
- Selbstauskunft
- Rentenbescheid (optional)
- EÜR (optional)
- Kontoauszüge

**2. Objekt-Datenraum** (ein Ordner pro Objekt)
User strukturiert intern selbst (Bank/Notar/Mieter etc. als Sub-Ordner). DealPilot prüft nur 17 typische Pflicht-Dokumente per User-Häkchen:
- Exposé, Objektbilder, Grundrisse, Wohnflächenberechnung, Lageplan, Energieausweis
- Mietverträge, Mieterliste, Nebenkosten
- Grundbuchauszug, Kaufvertrag-Entwurf, Teilungserklärung
- Eigentümerprotokolle, Wirtschaftsplan, Versicherung
- Verkehrswert- und RND-Gutachten

### Pflege in Settings

Settings → Tab "Datenraum" zeigt:
- Sektion **Persönlicher Datenraum** mit eigenem Slot
- Sektion **Objekt-Datenräume** mit **Drop-down** zur Objekt-Auswahl
- Bei Auswahl eines Objekts erscheint die Slot-Karte für genau dieses Objekt
- Ein "✓"-Marker im Drop-down zeigt, welche Objekte bereits verknüpft sind

### Bei Bank-/FB-Anfrage

Step 2 zeigt zwei Datenraum-Blöcke:
- Persönlicher Datenraum mit eigener Progress-Bar
- Objekt-Datenraum (für das aktuell aktive Objekt) mit eigener Progress-Bar

In der Versand-E-Mail werden **beide Ordner** mit Pflicht-Doc-Status eingefügt:
```
── Datenraum ──
Persönlicher Ordner (Google Drive):
  https://drive.google.com/.../persoenlich
  Bestätigt:
    ✓ Personalausweis
    ✓ SCHUFA-Auskunft
    ...
  Ausstehend:
    ○ Lohnsteuerbescheinigung

Objekt-Ordner (Google Drive):
  https://drive.google.com/.../KOE-1
  Bestätigt:
    ✓ Exposé
    ✓ Objektbilder
    ...
```

### Migration aus V140

Alte V140-Daten (`localStorage 'dp_datenraum'`) werden automatisch beim ersten Laden migriert: der alte `bank`-Slot wird zum persönlichen Datenraum.

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124
cp -r frontend frontend.bak-pre-v141
scp dealpilot-v141.zip root@hetzner-host:/root/
unzip -q -o /root/dealpilot-v141.zip
sed -i 's/datenraum\.js?v=[0-9]\+/datenraum.js?v=141/g; \
        s/datenraum\.css?v=[0-9]\+/datenraum.css?v=141/g; \
        s/deal-action\.js?v=[0-9]\+/deal-action.js?v=141/g; \
        s/settings\.js?v=[0-9]\+/settings.js?v=141/g' frontend/index.html
docker compose -f docker-compose.prod.yml up -d --build
```

## Verifikation im Browser

1. Settings → Tab "Datenraum"
2. Erste Section: "Persönlicher Datenraum" — "Ordner-Link einfügen" klicken
3. Test-URL `https://drive.google.com/drive/folders/persoenlich` → speichern
4. Doc-Häkchen aufklappen, Personalausweis/SCHUFA/Gehalt/etc. abhaken
5. Zweite Section: "Objekt-Datenräume" — Drop-down zeigt alle Objekte
6. Objekt auswählen → Slot-Karte erscheint, Link für dieses Objekt einfügen
7. Drop-down: nächstes Objekt auswählen → eigene Slot-Karte für dieses Objekt
8. Deal-Aktion-Tab → Quick-Access-Bar zeigt zwei Chips (P=Persönlich, O=Objekt)
9. Bankanfrage → Step 2 zeigt beide Datenraum-Blöcke mit Progress-Bars
10. Bei Versand: Datenraum-Block mit BEIDEN Ordnern landet in der E-Mail

## Bekannte Einschränkungen

- **Reine Verlinkung** — kein OAuth, kein automatischer Datei-Listen-Abruf. Doc-Bestätigung erfolgt per User-Häkchen.
- **localStorage** — Cookie-Löschung entfernt die Links.
- **Phase 2 (V142+)** würde OAuth-Integration für Google Drive / OneDrive / Dropbox bringen, mit echtem automatischen Vollständigkeits-Check der Cloud-Ordner-Inhalte.
