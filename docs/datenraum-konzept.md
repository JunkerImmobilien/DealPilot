# Datenraum je Objekt — wie wir das machen könnten

**Stand 23.09.2026.** Marcels Frage: *„Wäre es möglich, zu jedem Objekt einen
Datenraum oder Ordner zu hinterlegen, der Unterordner enthält, wo die Software
sich alle wichtigen Informationen rausholt? … einmal vielleicht einen Datenraum
oder einen Ordner auch lokal."*

Alles hier ist am Code gemessen, nicht angenommen.

---

## 1 · Was heute schon da ist — mehr, als es aussieht

### Der Datenraum speichert keine Dateien

`frontend/js/datenraum.js` (1.004 Zeilen) merkt sich pro Objekt nur:

```
objekte['<obj_id>'] = { url, label, provider, docs_checked: {…} }
```

Also **einen Link** zu Google Drive, Dropbox, OneDrive oder Nextcloud, dazu
Häkchen, welche der 17 Dokumentarten vorliegen. Die Dateien selbst liegen
außerhalb; DealPilot weiß nur, *dass* es sie gibt. Der Füllstand entscheidet,
ob eine Netzwerk-Anfrage rausgehen darf.

### Aber: die Maschinerie zum echten Ablegen existiert bereits

`backend/src/services/nextcloudService.js` kann heute schon alles, was für
einen echten Ordner nötig ist:

| Funktion | Was sie tut |
|---|---|
| `_ensureFolder()` | legt einen Pfad an, auch mehrstufig |
| `_uploadFile()` | schreibt eine Datei hinein |
| `_createPublicShare()` | erzeugt einen Freigabelink mit Ablaufdatum |
| `uploadBankDocs()` | nutzt das — aber nur für `DealPilot/Bankanfragen` |

**Und sie ist eingerichtet.** Auf Staging sind alle fünf Variablen gesetzt:
`NEXTCLOUD_BASE_URL`, `NEXTCLOUD_USERNAME`, `NEXTCLOUD_APP_PASSWORD`,
`NEXTCLOUD_BASE_FOLDER`, `NEXTCLOUD_SHARE_EXPIRES_DAYS`.

> Das ist der eigentliche Befund: Wir bauen nichts Neues, wir benutzen
> Vorhandenes für einen zweiten Zweck.

### Erzeugte PDFs gehen heute in den Download-Ordner

`pdf-*.js` ruft `jsPDF.save()` mit sprechenden Namen auf —
`Investment_Case_Bank_<adresse>_<datum>.pdf`,
`Kaufpreisaufteilung_<adresse>_<datum>.pdf`,
`BMF_Anlage_Finanzamt_<adresse>_<datum>.pdf`.

Die Namen sind schon sortierfähig. Was fehlt, ist der Ort.

---

## 2 · Die Ordnerstruktur

Der Vorschlag orientiert sich daran, **wer die Unterlage später verlangt** —
nicht daran, in welchem Reiter sie entsteht. Wer etwas sucht, sucht es für
einen Anlass: für die Bank, fürs Finanzamt, für den Steuerberater.

```
DealPilot/
└── Objekte/
    └── 2026-1036 · Musterweg 12, 32105 Musterstadt/
        ├── 01 Exposé & Inserat/          ← hochgeladen
        ├── 02 Objektunterlagen/          ← Grundriss, Teilungserklärung, WEG
        ├── 03 Bank/                      ← erzeugt: Investment-Case, Bankexport
        ├── 04 Steuern/
        │   ├── Kaufpreisaufteilung/      ← erzeugt: BMF-PDF
        │   ├── Werbungskosten/           ← erzeugt: Werbungskosten-PDF
        │   └── Rechnungen/               ← hochgeladen: Belege
        ├── 05 Bewertung/                 ← erzeugt: RND-Gutachten, Marktbericht
        └── 06 Fotos/
```

**Der Ordnername trägt die Objektnummer zuerst**, damit die Sortierung der
Reihenfolge der Anschaffung entspricht und nicht dem Alphabet der Straßen.

Die Nummerierung `01…06` ist kein Selbstzweck: Ohne sie sortiert jeder
Dateimanager alphabetisch, und dann steht „Bank" vor „Exposé" — also das
Ergebnis vor dem Ausgangsmaterial.

---

## 3 · Drei Wege, mit unterschiedlichem Preis

### Weg A · Nextcloud ausbauen — der Ordner liegt beim Betreiber

Die vorhandene Maschinerie auf Objekte ausweiten.

**Was dann geht**
- Jedes erzeugte PDF landet automatisch im richtigen Unterordner
- Hochgeladene Exposés und Belege gehen in denselben Baum
- DealPilot kann den Ordner **lesen** — also erkennen, was schon da ist, und
  die Checkliste selbst abhaken statt den Nutzer fragen
- Freigabe per Link mit Ablaufdatum gibt es bereits
- Läuft auf jedem Gerät, auch auf dem Handy

**Was es kostet**
- Speicherplatz beim Betreiber, und der wächst mit jedem Kunden
- Die Dateien liegen dann bei uns — das gehört in die Datenschutzerklärung
  und in den AV-Vertrag
- Ein Kunde, der schon eine eigene Ordnung hat, bekommt eine zweite

### Weg B · Lokaler Ordner über die File System Access API

Der Browser darf einen Ordner auf dem Rechner öffnen, wenn der Nutzer ihn
einmal auswählt (`showDirectoryPicker()`). Danach kann DealPilot dort lesen
und schreiben, ohne dass eine Datei je den Rechner verlässt.

**Was dann geht**
- Die Dateien bleiben vollständig beim Kunden — das stärkste Datenschutz-Argument
- Kein Speicherplatz beim Betreiber
- Wer schon eine Ordnerstruktur hat, behält sie

**Was es kostet — und hier liegt der Haken**
- **Nur Chrome und Edge.** Safari und Firefox können es nicht, also fällt
  jeder Mac-Nutzer mit Safari und jeder Firefox-Nutzer heraus
- **Auf dem Handy gar nicht** — und der Quick-Check vor Ort ist ein
  Handy-Anwendungsfall
- Die Berechtigung muss nach jedem Neustart des Browsers bestätigt werden
- Nichts davon ist von einem zweiten Gerät aus erreichbar

> Das ist kein Grund, es nicht zu bauen — aber ein Grund, es **nicht als
> einzigen Weg** zu bauen. Ein Datenraum, den die Hälfte der Kunden nicht
> öffnen kann, ist kein Datenraum.

### Weg C · Verknüpfen statt ablegen — was heute da ist, nur feiner

Statt einer URL je Objekt **eine URL je Unterordner**. DealPilot legt nichts
ab, sondern zeigt beim PDF-Erzeugen: *„Investment-Case fertig — ablegen unter
03 Bank"* mit einem Knopf, der den Ordner öffnet.

**Was dann geht**
- Kein Speicherplatz, keine Rechtefrage, nichts zu bauen außer Oberfläche
- Funktioniert mit jedem Anbieter, auch mit einem Netzlaufwerk in der Kanzlei

**Was es kostet**
- DealPilot kann **nichts auslesen**. Die Checkliste bleibt Handarbeit —
  und genau das war Marcels Frage: *„wo die Software sich alle wichtigen
  Informationen rausholt"*. Das kann Weg C nicht.

---

## 4 · Empfehlung

**A als Rückgrat, C als Brücke, B als Zugabe.**

1. **Zuerst A**, weil die Maschinerie steht und eingerichtet ist. Der Aufwand
   liegt nicht im Hochladen, sondern in zwei Dingen: dem Anlegen des Baums
   beim ersten Speichern eines Objekts, und dem Umbiegen der `jsPDF.save()`-
   Aufrufe, damit sie zusätzlich hochladen.

2. **Dann C als Wahlmöglichkeit.** Wer seine Unterlagen schon bei sich
   ordnet, hinterlegt je Unterordner einen Link und bekommt denselben
   Ablage-Knopf — nur ohne automatisches Ablegen.

3. **B später und nur als Export.** „Ganzen Objektordner auf den Rechner
   ziehen" ist ein sinnvoller Knopf. Als täglicher Arbeitsweg taugt die API
   nicht, solange die Hälfte der Browser sie nicht kann.

### Was zuerst gebaut würde

| Schritt | Was | Wo |
|---|---|---|
| 1 | `ensureObjektOrdner(objId)` — legt den Baum an | `nextcloudService.js` |
| 2 | `ablegen(objId, unterordner, datei)` | dito |
| 3 | Die drei `jsPDF.save()`-Aufrufe zusätzlich hochladen lassen | `pdf-*.js` |
| 4 | Exposé- und Beleg-Upload in `01` bzw. `04/Rechnungen` | Upload-Routen |
| 5 | Ordner lesen → Checkliste selbst abhaken | `datenraum.js` |

Schritt 5 ist der, der Marcels Satz einlöst. Die Schritte 1–4 sind die
Voraussetzung dafür.

### Zwei Fragen, die vor dem Bauen zu klären sind

1. **Wem gehört der Speicher?** Wenn die Dateien bei uns liegen, gehören sie
   in den AV-Vertrag und in die Datenschutzerklärung — beides existiert, muss
   aber ergänzt werden. Und es braucht eine Antwort auf „was passiert beim
   Kündigen?".
2. **Wie viel Platz je Kunde?** Ein Objekt mit 30 Fotos und zehn PDFs liegt
   schnell bei 80 MB. Bei 25 Objekten im Investor-Plan sind das 2 GB. Das ist
   handhabbar, aber es ist eine Zahl, die in die Kalkulation gehört — nicht
   eine, die man erst merkt, wenn die Platte voll ist.
