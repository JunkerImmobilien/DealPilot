'use strict';
/* ═════════════════════════════════════════════════════════════════════
   prozess-atlas.js — v2188 · Alle Abläufe von DealPilot als Netzplan

   Marcel, 13.10.2026: „wir haben irgendwann mal eine Prozesskarte
   erstellt … die Prozesse und den Ablauf der im DealPilot möglichen
   Prozesse unter Hilfe auch abbilden. So ein Netzplan, aber dann
   animiert. Auch Steuerprozesse, Ablauf Quick-Check, Ablauf bis zu
   gewonnen. Mit Erklärung und allem. Unsere Prozesse müssen dokumentiert
   sein und plausibel sein." Nach der Demo: „granularer, besser animiert,
   ein richtiger Wow-Effekt — mit Klick klappen sich Unterprozesse auf
   oder Daten fliegen ein."

   Die Inhalte stammen aus den beiden Messe-Karten
   (design/Messe/prozesskarte.html, prozesskarte-detail.html — dort am
   Code gemessen) und aus einer Messung am 13.10.2026 (Quick-Check,
   Deal-Aktion, Überführung, Steuer, Cockpit, Marktbericht).

   JEDE Station trägt `beleg: 'datei:symbol'`. tools/prozess-atlas-pruefen.mjs
   prüft, dass es die Datei gibt und das Symbol darin steht. Fällt ein
   Ablauf im Code weg, wird der Prüfer rot — und der Atlas erzählt nicht
   weiter von einem Weg, den es nicht mehr gibt.

   Aufbau je Station:
     id, s (Spalte), z (Zeile), t (Titel), k (Unterzeile), d (Erklärung),
     unter [[Schritt, Erklärung]], ein [Eingaben], aus [Ergebnisse],
     gew [[Name, Prozent]] (nur Scores), opt (gestrichelt), ziel, beleg
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotAtlas) return;

  var PROZESSE = [
    {
      id: 'reise', name: 'Die ganze Reise', sub: 'Vom ersten Inserat bis zum Portfolio — neun Stationen in drei Phasen',
      spalten: ['Pre-Flight · Quick-Check', 'Boarding · Ankauf', 'Reiseflug · Bestand'],
      knoten: [
        { id: 'qc1', s: 0, z: 0, t: 'Inserat erfassen', k: 'Quick-Check',
          d: 'Adresse, Fläche, Miete, Hausgeld und Finanzierung — mehr braucht der Quick-Check nicht. Der Score rechnet live mit, während du tippst.',
          unter: [['Adresse', 'Straße, PLZ und Ort sind Pflicht. Die Hausnummer ist frei — fehlt sie, bezieht sich die Lage auf die Straße.'], ['Objektdaten', 'Objektart, Wohnfläche, Baujahr, Lageklasse A/B/C.'], ['Miete und Hausgeld', 'Nettokaltmiete gesamt, Hausgeld und der nicht umlagefähige Anteil.'], ['Finanzierung', 'Beleihung, Kaufpreis, Eigenkapital, Zins, Tilgung.']],
          ein: ['PLZ', 'Ort', 'Wohnfläche', 'Nettokaltmiete', 'Hausgeld', 'Kaufpreis', 'Eigenkapital', 'Zins', 'Tilgung'],
          aus: ['Quick Check Score', 'Fünf Teilscores', 'KPI-Leiste mit Zielwerten'],
          ziel: { aktion: 'quickcheck' }, beleg: 'frontend/quickcheck-app.html:QUICK CHECK SCORE' },
        { id: 'qc2', s: 0, z: 1, t: 'Marktpreis einholen', k: 'Marktbewertung · Abruf',
          d: 'Eine Marktpreisindikation von einem unabhängigen Bewertungspartner — Marktwert mit Spanne. Ausdrücklich kein Gutachten nach § 194 BauGB.',
          unter: [['Bewertungsquelle wählen', 'In der Aktionsleiste unter „Marktbewertung“.'], ['Abrufen', 'Der Abruf wird vorher bestätigt — er zählt auf dein Kontingent.'], ['Ergebnis prüfen', 'Marktwert, Marktmiete und Lage erscheinen unter der Leiste.']],
          ein: ['PLZ', 'Ort', 'Objektart', 'Wohnfläche'], aus: ['Marktwert mit Spanne', 'Marktmiete', 'Lage-Einschätzung'],
          ziel: { aktion: 'quickcheck' }, beleg: 'frontend/quickcheck-app.html:openCreditModal' },
        { id: 'qc3', s: 0, z: 2, t: 'Urteil und speichern', k: 'Entscheidung',
          d: 'Das Urteil mit Pro-Argumenten, Warnungen und einer Verhandlungs-Empfehlung. Der Zielpreis darin kommt aus deiner Ziel-Bruttomietrendite je Lageklasse. Lohnt es sich: „Als Objekt speichern“.',
          unter: [['Bewertung lesen', 'Urteil, Pro-Argumente, „Achtung“-Punkte.'], ['Verhandlungs-Empfehlung', 'Zielpreis aus Zielrendite und Cashflow-Null — nie über dem Marktwert.'], ['Als Objekt speichern', 'Erst wenn alle Pflichtfelder gefüllt sind. Du wählst, welche Daten übernommen werden.']],
          ein: ['Score', 'Lageklasse', 'Ziel-Bruttomietrendite'], aus: ['Verhandlungs-Empfehlung', 'neues Objekt „In Prüfung“'],
          ziel: { aktion: 'quickcheck' }, beleg: 'frontend/js/qc-heuristik.js:zielKaufpreis' },
        { id: 'an1', s: 1, z: 0, t: 'Datenaufnahme', k: 'Etappen 1–8',
          d: 'Vom Groben zum Feinen. Jede Etappe schaltet Kennzahlen frei — was fehlt, wird nicht geschätzt, sondern genannt.',
          unter: [['Basis', 'Objekt, Preis und Miete.'], ['Geld', 'Finanzierung und Kaufnebenkosten.'], ['Lage & Zustand', 'Wo es steht und wie es dasteht.'], ['Feinschliff', 'Bewirtschaftung, Entwicklung, Steuer.'], ['Deine Sicht', 'These und Risiken in eigenen Worten.'], ['Wertermittlung · Restnutzungsdauer', 'Optional, wenn Stufe 3 gebraucht wird.']],
          ein: ['259 Felder', '11 Objektarten'], aus: ['DSCR', 'Cashflow n. St.', 'LTV', 'DealScore', 'Investor Deal Score'],
          ziel: { tab: 's0' }, beleg: 'backend/src/generated/frontend-konstanten.json:Feinschliff' },
        { id: 'an2', s: 1, z: 1, t: 'Wert ermitteln', k: 'Marktbericht Stufe 3',
          d: 'Boden-, Ertrags- und Sachwert nach ImmoWertV — mit Liegenschaftszins und Sachwertfaktor des zuständigen Gutachterausschusses und Quellennachweis.',
          unter: [['Eingabetiefe „Ausgiebig“', 'Im Reiter Objekt die Box „Marktbericht abrufen“.'], ['Läuft im Hintergrund', 'Acht Etappen, du arbeitest weiter.'], ['Übernehmen', 'Jeder Abruf landet im Verlauf und steht am Verkehrswert zur Übernahme.']],
          ein: ['Grundstück', 'Bodenrichtwert', 'Zustand', 'Standardstufe'], aus: ['Bodenwert', 'Ertragswert', 'Sachwert', 'Quellennachweis'],
          ziel: { tab: 's0' }, beleg: 'frontend/js/objekt-reiter.js:pflichtFuer' },
        { id: 'an3', s: 1, z: 2, t: 'Bereit für die Bank', k: 'Deal-Aktion',
          d: 'Der Vorflug-Check zählt die Grundfelder. Daneben die bankfertigen PDFs und die Unterlagen fürs Bankgespräch.',
          unter: [['Vorflug-Check', '„X / Y Grundfelder befüllt“ — was fehlt, steht als Chip da.'], ['Investment-PDF', 'Empfohlen, in mehreren Fassungen.'], ['Bordkarte & Unterlagen', 'Persönliche und Objekt-Unterlagen, Anforderung beim Amt.']],
          ein: ['Grundfelder', 'Pilot-Analyse'], aus: ['Investment-PDF', 'Unterlagenliste'],
          ziel: { tab: 's8' }, beleg: 'frontend/js/deal-action-boarding.js:Bereit für die Bank' },
        { id: 'be1', s: 2, z: 0, t: 'Gewonnen: einfrieren', k: 'Ankauf-Stand',
          d: 'Auf „Gewonnen“ wird der ganze Datensatz zum Nutzen-/Lastenwechsel festgeschrieben — das Soll. Ohne dieses Datum wird nichts eingefroren.',
          unter: [['Status „Gewonnen“', 'Deal-Aktion → Departures · Deal-Status.'], ['Stichtag prüfen', 'Feld „Wirtsch. Übergang · Nutzen-/Lastenwechsel“ im Reiter Objekt.'], ['Festschreiben', 'Automatisch, wenn das Datum steht — sonst fragt DealPilot nach.']],
          ein: ['Nutzen-/Lastenwechsel', 'alle Felder'], aus: ['Soll · Ankauf-Stand', 'Objekt im Bestand'],
          ziel: { tab: 's8' }, beleg: 'frontend/js/ankauf.js:vonSelbst' },
        { id: 'be2', s: 2, z: 1, t: 'Ist pflegen', k: 'Ist · heute',
          d: 'Im Bestand pflegst du Mieten, Kosten und Verträge weiter. Oben im Objekt schaltest du zwischen Ist und Soll — die Abweichung bleibt sichtbar.',
          unter: [['Ist · heute', 'Frei zu pflegen.'], ['Soll · Ankauf-Stand', 'Gesperrt — der Haken „zum nachträglichen Bearbeiten freigeben“ öffnet ihn mit Nachweis.'], ['Marktbericht wiederholen', 'Der Wertverlauf wächst mit jedem Abruf.']],
          ein: ['Mieten', 'Kosten', 'Marktberichte'], aus: ['Soll/Ist-Abweichung', 'Wertverlauf'],
          ziel: { tab: 's0' }, beleg: 'frontend/js/ankauf-ansicht.js:sollSpeichern' },
        { id: 'be3', s: 2, z: 2, t: 'Portfolio steuern', k: 'Portfolio-Cockpit',
          d: 'Alle Objekte zusammen: Portfolio Score, Kennzahlen, Bestand & Zielbild, geteilte Objekte, Steuer über alle Objekte, Projektion, Steuer-Mappe und Jahresabschluss.',
          unter: [['01 Portfolio Score', 'So setzt sich der Score zusammen.'], ['03 Bestand & Zielbild', 'Potenzial aller Objekte.'], ['05 Steuer über alle Objekte', ''], ['08 Steuer-Mappe', 'Anlage V · § 21 EStG.'], ['09 Jahresabschluss', 'Bilanz · GuV.']],
          ein: ['alle Objekte'], aus: ['Portfolio Score', 'Gesamt-Projektion', 'Steuer-Mappe'],
          ziel: { aktion: 'cockpit' }, beleg: 'frontend/js/ui.js:setMainView' }
      ],
      kanten: [['qc1', 'qc2'], ['qc2', 'qc3'], ['qc3', 'an1'], ['an1', 'an2'], ['an2', 'an3'], ['an3', 'be1'], ['be1', 'be2'], ['be2', 'be3']]
    },
    {
      id: 'quickcheck', name: 'Quick-Check', sub: 'Ein Inserat in einer Minute einordnen — und nur übernehmen, was taugt',
      spalten: ['Eingeben', 'Bewerten', 'Entscheiden'],
      knoten: [
        { id: 'q1', s: 0, z: 0, t: 'Adresse', k: 'Straße · PLZ · Ort Pflicht', d: 'Die Hausnummer ist freiwillig — viele Inserate nennen keine. Fehlt sie, bezieht sich die Lage auf die Straße.', ein: ['Straße', 'Hausnr.', 'PLZ', 'Ort'], aus: ['Standort'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/quickcheck-app.html:Adresse' },
        { id: 'q2', s: 0, z: 1, t: 'Objekt und Miete', k: 'Wohnfläche · Nettokaltmiete', d: 'Objektart, Fläche, Baujahr, Lageklasse — und die Mieteinnahmen je Monat. Die Lageklasse bestimmt deine Zielrendite.', ein: ['Objektart', 'Wohnfläche', 'Baujahr', 'Lageklasse', 'Grundmiete', 'Stellplatz'], aus: ['Nettokaltmiete gesamt'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/quickcheck-app.html:Mieteinnahmen' },
        { id: 'q3', s: 0, z: 2, t: 'Kosten und Geld', k: 'Hausgeld · Finanzierung', d: 'Hausgeld je Monat und der nicht umlagefähige Anteil (Vorgabe 22 %). Dazu Beleihung, Kaufpreis, Eigenkapital, Zins und Tilgung.', ein: ['Hausgeld', 'nicht umlagefähig %', 'Kaufpreis', 'Eigenkapital', 'Zins', 'Tilgung'], aus: ['Kapitaldienst'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/quickcheck-app.html:Bewirtschaftungskosten' },
        { id: 'q4', s: 1, z: 0, t: 'Score live', k: 'fünf Teilscores', d: 'Rendite, Cashflow, LTV, Risiko, Potenzial — je von 100, dazu der Ring mit dem Gesamtscore. Er rechnet bei jeder Eingabe neu.', gew: [['Rendite', 0], ['Cashflow', 0], ['LTV', 0], ['Risiko', 0], ['Potenzial', 0]], aus: ['Quick Check Score'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/js/quick-check.js:kennzahlenAmpel' },
        { id: 'q5', s: 1, z: 1, t: 'Ampel je Kennzahl', k: 'gegen Zielwerte', d: 'Jede Kennzahl gegen ihren Zielwert: Bruttomietrendite ≥ 5 %, Nettomietrendite ≥ 3 %, EK-Rendite ≥ 7 %, Cashflow, DSCR und LTV gegen deine Mindest-Schwellen aus den Einstellungen (Vorgabe ≥ 0 €, ≥ 1,2, ≤ 90 %), Bewirtschaftung 18–35 %.', aus: ['grün · gelb · rot'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/js/qc-heuristik.js:kennzahlenAmpel' },
        { id: 'q6', s: 1, z: 2, t: 'Marktpreis', k: 'optional · Abruf', opt: true, d: 'Die Marktpreisindikation eines unabhängigen Bewertungspartners — mit Spanne. Sie fließt als Obergrenze in den Zielpreis.', ein: ['PLZ', 'Ort', 'Objektart', 'Wohnfläche'], aus: ['Marktwert mit Spanne', 'Marktmiete'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/quickcheck-app.html:avm-results-host' },
        { id: 'q7', s: 2, z: 0, t: 'Urteil', k: 'Bewertung', d: 'Ein Urteil wie „Kauf erwägen“, Pro-Argumente und „Achtung“-Punkte, die Experten-Meinung.', aus: ['Urteil', 'Pro / Achtung'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/quickcheck-app.html:Experten-Meinung' },
        { id: 'q8', s: 2, z: 1, t: 'Verhandlungs-Empfehlung', k: 'Zielpreis', d: 'Der Preis, bei dem deine Ziel-Bruttomietrendite erreicht wird und der Cashflow nicht negativ ist — nie über dem Marktwert.', ein: ['Zielrendite der Lageklasse', 'Marktwert'], aus: ['Zielpreis', 'Verhandlungsspanne'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/js/qc-heuristik.js:zielKaufpreis' },
        { id: 'q9', s: 2, z: 2, t: 'Als Objekt speichern', k: 'Speichern & übernehmen', d: 'Erst wenn alle Pflichtfelder gefüllt sind. Du hakst an, welche Daten mitgehen — auch Fotos und Marktwerte. Das neue Objekt startet „In Prüfung“.', unter: [['Welche Daten übernehmen?', '„Alle übernehmen“ oder einzeln.'], ['Neues Objekt', 'Legt ein Objekt an und überträgt die Werte.'], ['Weiter in der Datenaufnahme', 'Ab hier geht es im Objekt weiter.']], aus: ['Objekt · In Prüfung'], ziel: { aktion: 'quickcheck' }, beleg: 'frontend/js/qc-bridge.js:_handleSave' }
      ],
      kanten: [['q1', 'q2'], ['q2', 'q3'], ['q1', 'q4'], ['q2', 'q4'], ['q3', 'q4'], ['q4', 'q5'], ['q1', 'q6', 'opt'], ['q6', 'q8', 'opt'], ['q5', 'q7'], ['q7', 'q8'], ['q8', 'q9']]
    },
    /* v2218 · aus der Demo (design/Vorschläge/prozessatlas) übernommen. Marcel 14.10.2026:
       „so wie es in der Demo ist, ist es super.“ Sprechlauf und Dokument-Import als eigene Abläufe. */
    {
      "id": "sprache",
      "name": "Sprechlauf",
      "sub": "Du erzählst das Objekt — DealPilot füllt die Felder",
      "spalten": [
        "Sprechen",
        "Verstehen",
        "Übernehmen"
      ],
      "knoten": [
        {
          "id": "v1",
          "s": 0,
          "z": 0,
          "t": "Aufnahme",
          "k": "bis 4 Minuten",
          "d": "Die Aufnahme startet sofort. Während du sprichst, erscheint der Text live als Vorschau; maßgeblich ist die Audio-Aufnahme.",
          "ein": [
            "Mikrofon"
          ],
          "aus": [
            "Audio",
            "Live-Vorschau"
          ],
          "beleg": "frontend/js/voice-import.js:MAX_SEC",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "v2",
          "s": 0,
          "z": 1,
          "t": "Transkription",
          "k": "in Abschnitten",
          "d": "Der Mitschnitt wird abschnittsweise in Text übertragen. Pause und Fortsetzen sind jederzeit möglich.",
          "ein": [
            "Audio"
          ],
          "aus": [
            "Text"
          ],
          "beleg": "frontend/js/voice-import.js:transcribe-chunk",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "v3",
          "s": 1,
          "z": 0,
          "t": "Feldkatalog",
          "k": "zur Laufzeit gelesen",
          "d": "Alle Felder aller Reiter, Auswahlfelder mit ihren echten Optionen. So wird „Zustand ist gut\" zum passenden Optionswert.",
          "ein": [
            "Felder der App"
          ],
          "aus": [
            "Katalog"
          ],
          "beleg": "frontend/js/voice-import.js:renderMergedTable",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "v4",
          "s": 1,
          "z": 1,
          "t": "Zuordnen",
          "k": "Text → Felder",
          "d": "Die KI ordnet das Gesagte den Feldern zu. Was nicht im Katalog steht, wird nicht erfunden.",
          "ein": [
            "Text",
            "Katalog"
          ],
          "aus": [
            "Vorschläge je Feld"
          ],
          "beleg": "backend/src/routes/ai.js:/extract-voice",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "v5",
          "s": 2,
          "z": 0,
          "t": "Nachfragen",
          "k": "wenn ein Feld belegt ist",
          "d": "Trägt das Objekt schon Werte, zeigt DealPilot, was sich ändern würde — und fragt, bevor überschrieben wird.",
          "ein": [
            "bestehende Werte"
          ],
          "aus": [
            "Rückfrage"
          ],
          "beleg": "frontend/js/voice-import.js:bereits Stammdaten",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "v6",
          "s": 2,
          "z": 1,
          "t": "Übernehmen",
          "k": "an- und abwählbar",
          "d": "Dieselbe Tabelle wie beim Exposé-Import. Du wählst, was übernommen wird — danach rechnen alle Kerne neu.",
          "ein": [
            "deine Auswahl"
          ],
          "aus": [
            "gefüllte Felder",
            "neuer Score"
          ],
          "beleg": "frontend/js/voice-import.js:applyMerged",
          "ziel": {
            "tab": "s0"
          }
        }
      ],
      "kanten": [
        [
          "v1",
          "v2"
        ],
        [
          "v2",
          "v3"
        ],
        [
          "v3",
          "v4"
        ],
        [
          "v4",
          "v5"
        ],
        [
          "v5",
          "v6"
        ]
      ]
    },
    {
      "id": "dokumente",
      "name": "Dokument-Import",
      "sub": "Exposé, Grundbuch, Gutachten, Belege — lesen statt abtippen",
      "spalten": [
        "Einlesen",
        "Schützen",
        "Auswerten",
        "Übernehmen"
      ],
      "knoten": [
        {
          "id": "p1",
          "s": 0,
          "z": 0,
          "t": "PDF wählen",
          "k": "Text aus allen Seiten",
          "d": "Der Text wird im Browser aus dem PDF gelesen. Belege und Fotos gehen als Bild in die Auswertung.",
          "ein": [
            "PDF",
            "Foto"
          ],
          "aus": [
            "Seitentext"
          ],
          "beleg": "frontend/js/object-actions.js:istDokument",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "p2",
          "s": 0,
          "z": 1,
          "t": "Art erkennen",
          "k": "neun Dokumentarten",
          "d": "Grundbuch, Kataster, Kaufvertrag, WEG-Protokoll, BORIS, Verkehrswert-, Restnutzungsdauergutachten, Kaufpreisaufteilung, Marktbericht — je mit eigenem Schema.",
          "ein": [
            "Seitentext"
          ],
          "aus": [
            "Dokumentart"
          ],
          "beleg": "frontend/js/dokument-import.js:Kaufpreisaufteilung",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "p3",
          "s": 1,
          "z": 0,
          "t": "Schwärzen",
          "k": "auf dem DealPilot-Server, vor der KI",
          "d": "Geburtsdaten, Namen nach Anrede, Anschriften nach „wohnhaft\", E-Mail, Telefon, IBAN, Steuer-ID werden ersetzt. Die Objektanschrift und Beträge bleiben — die braucht die Auswertung.",
          "ein": [
            "Seitentext"
          ],
          "aus": [
            "geschwärzter Text"
          ],
          "beleg": "backend/src/services/schwaerzen.js:schwaerze",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "p4",
          "s": 2,
          "z": 0,
          "t": "Auslesen",
          "k": "Schema ohne Personendaten",
          "d": "Das Schema fragt nur nach Objektdaten. Was nicht gefragt wird, schreibt das Modell nicht heraus.",
          "ein": [
            "geschwärzter Text",
            "Schema"
          ],
          "aus": [
            "Felder mit Fundstelle"
          ],
          "beleg": "backend/src/routes/ai.js:/extract-dokument",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "p5",
          "s": 2,
          "z": 1,
          "t": "Vergleich, nicht Ergebnis",
          "k": "fremde Gutachten",
          "d": "Ein mitgelesener Gutachtenwert (Restnutzungsdauer, Verkehrswert, Gebäudeanteil) erscheint als Vergleich neben der eigenen Rechnung — er wird nicht übernommen.",
          "ein": [
            "Gutachtenwert"
          ],
          "aus": [
            "Abgleich"
          ],
          "beleg": "frontend/js/dokument-import.js:VERGLEICH",
          "ziel": {
            "tab": "s0"
          }
        },
        {
          "id": "p6",
          "s": 3,
          "z": 0,
          "t": "Übernehmen",
          "k": "Feld für Feld",
          "d": "Jedes Feld steht mit „im Dokument“ und „im Objekt“ nebeneinander: leere Felder sind vorgehakt, abweichende nicht — still überschrieben wird nie. Belege bestätigst du Zeile für Zeile, weil sie in die Steuer gehen.",
          "ein": [
            "deine Auswahl"
          ],
          "aus": [
            "Datenaufnahme",
            "Anschaffungskosten"
          ],
          "beleg": "frontend/js/dokument-import.js:_abgleich",
          "ziel": {
            "tab": "s0"
          }
        }
      ],
      "kanten": [
        [
          "p1",
          "p2"
        ],
        [
          "p2",
          "p3"
        ],
        [
          "p3",
          "p4"
        ],
        [
          "p4",
          "p5"
        ],
        [
          "p5",
          "p6"
        ]
      ]
    },
    {
      id: 'boarding', name: 'Netzplan Datenaufnahme', sub: 'Jede Stufe schaltet frei, was ohne sie nicht rechnen darf',
      spalten: ['Stufe 1 · Einordnen · 6 Pflichtfelder', 'Stufe 2 · Durchrechnen · 13', 'Stufe 3 · Bewerten · bis 20'],
      knoten: [
        { id: 'e1', s: 0, z: 1, t: 'E1 Basis', k: 'Objekt, Preis und Miete', d: 'Adresse, Objektart, Wohnfläche, Baujahr. Ohne Stufe 1 kein Score — und keine Schätzung an ihrer Stelle.', ein: ['PLZ', 'Ort', 'Straße', 'Objektart', 'Wohnfläche', 'Baujahr'], aus: ['Bruttomietrendite', 'Kaufpreisfaktor', 'Marktpreisindikation Stufe 1'], ziel: { tab: 's0' }, beleg: 'frontend/js/objekt-reiter.js:pflichtFuer' },
        { id: 'e2', s: 1, z: 0, t: 'E2 Geld', k: 'Finanzierung, Kaufnebenkosten', d: 'Zwei Darlehen, Zins, Tilgung, Zinsbindung, Eigenkapital.', ein: ['Kaufpreis', 'Darlehen', 'Zins', 'Tilgung', 'Zinsbindung', 'Eigenkapital'], aus: ['DSCR', 'Beleihungsauslauf', 'Cashflow', 'DealScore'], ziel: { tab: 's3' }, beleg: 'frontend/js/dscr-engine.js:compute' },
        { id: 'e3', s: 1, z: 1, t: 'E3 Lage & Zustand', k: 'wo es steht, wie es dasteht', d: 'Zustand, Energieklasse, Standardstufe, Zimmer — bei ETW die Etage, beim MFH die Einheiten.', ein: ['Nettokaltmiete', 'Zustand', 'Energieklasse', 'Standardstufe', 'Zimmer'], aus: ['Lage-Analyse', 'Mietanalyse', 'Risiko im Investor Deal Score'], ziel: { tab: 's0' }, beleg: 'frontend/js/objekt-reiter.js:ds2_zustand' },
        { id: 'e4', s: 1, z: 2, t: 'E4 Feinschliff', k: 'Bewirtschaftung, Steuer', d: 'Hausgeld getrennt nach umlagefähig, Rücklagen, Grenzsteuersatz. Ohne Wirtschaftsplan schlägt DealPilot die Standardwerte je Objektart vor.', ein: ['Hausgeld umlagefähig', 'Rücklagen', 'Grenzsteuersatz'], aus: ['Cashflow nach Steuer', 'AfA inkl. § 7b', 'Mietentwicklungsplan', 'Anlage V'], ziel: { tab: 's4' }, beleg: 'frontend/js/bwk-profil.js:jahresFaktor' },
        { id: 'e5', s: 2, z: 0, t: 'E5 Deine Sicht', k: 'These und Risiken', d: 'Investmentthese und Risiken in eigenen Worten — die Pilot-Analyse bezieht sich dann auf deine These statt auf allgemeines Wissen.', ein: ['Investmentthese', 'Risiken'], aus: ['Pilot-Analyse mit Bezug'], ziel: { tab: 's5' }, beleg: 'backend/src/generated/frontend-konstanten.json:Deine Sicht' },
        { id: 'e7', s: 2, z: 1, t: 'E7 Wertermittlung', k: 'Sachwert nach ImmoWertV', opt: true, d: 'Nutzungsart, Grundstück, Bodenrichtwert, BGF — bei ETW der Miteigentumsanteil, am Haus Hausform, Geschosse und Dach. ETW ohne Miteigentumsanteil: Sachwert ohne Bodenwert, und das steht dann dran.', ein: ['Nutzungsart', 'Grundstücksfläche', 'Bodenrichtwert', 'BGF', 'MEA (ETW)'], aus: ['Sachwert (NHK 2010)', 'Ertragswert', 'Marktbericht Stufe 3'], ziel: { tab: 's0' }, beleg: 'backend/src/generated/frontend-konstanten.json:Wertermittlung' },
        { id: 'e8', s: 2, z: 2, t: 'E8 Restnutzungsdauer', k: 'Anlage 2 · 20 Punkte', opt: true, d: 'Modernisierungsgrad nach Anlage 2 ImmoWertV — acht Bauteile, zwanzig Punkte. Daraus die Restnutzungsdauer, abgeglichen gegen die AfA-Dauer.', ein: ['8 Bauteile', 'Modernisierungsjahre'], aus: ['Restnutzungsdauer', 'Abgleich AfA-Dauer'], ziel: { tab: 's0' }, beleg: 'backend/src/generated/frontend-konstanten.json:Restnutzungsdauer' }
      ],
      kanten: [['e1', 'e2'], ['e1', 'e3'], ['e1', 'e4'], ['e2', 'e5'], ['e3', 'e5'], ['e4', 'e5'], ['e3', 'e7', 'opt'], ['e7', 'e8', 'opt']]
    },
    {
      id: 'deal', name: 'Deal bis gewonnen', sub: 'Offen — Gewonnen — Verloren, und was jeder Status auslöst',
      spalten: ['Akquise', 'Deal-Status', 'Danach'],
      knoten: [
        { id: 'd1', s: 0, z: 0, t: 'Offen', k: 'Deal in Prüfung · BOARDING', d: 'Jedes neue Objekt startet offen und steht in der Liste unter „Ankauf“.', aus: ['Liste: Ankauf'], ziel: { tab: 's8' }, beleg: 'frontend/js/deal-action-boarding.js:Deal in Prüfung' },
        { id: 'd2', s: 0, z: 1, t: 'Pilot-Analyse', k: 'KI-Einordnung', d: 'Stärken, Risiken, Szenarien, Verhandlungsempfehlung und Bank-Argumente — gespeichert am Objekt.', aus: ['Empfehlung', 'Ziel-Kaufpreis', 'Bank-Argumente'], ziel: { tab: 's5' }, beleg: 'frontend/js/ui.js:_dpVerlaufKiText' },
        { id: 'd3', s: 0, z: 2, t: 'Vorflug-Check & PDFs', k: 'Bereit für die Bank', d: 'Grundfelder zählen, Investment-PDF erzeugen, Unterlagen fürs Bankgespräch sammeln.', aus: ['Investment-PDF', 'Unterlagenliste'], ziel: { tab: 's8' }, beleg: 'frontend/js/deal-action-boarding.js:Vorflug-Check' },
        { id: 'd4', s: 1, z: 0, t: 'Gewonnen', k: 'ABGEFLOGEN', d: 'Deal gewonnen — Objekt im Bestand. Mit dem Nutzen-/Lastenwechsel wird der Ankauf-Stand automatisch festgeschrieben.', unter: [['Datum vorhanden', '„Ankauf-Stand automatisch festgeschrieben zum …“'], ['Datum fehlt', 'Nichts wird eingefroren — DealPilot sagt, dass der Nutzen-/Lastenwechsel fehlt.'], ['rückgängig / Stand neu nehmen', 'Jederzeit in der Zeile darunter.']], ein: ['Nutzen-/Lastenwechsel'], aus: ['Soll · Ankauf-Stand', 'Liste: Bestand'], ziel: { tab: 's8' }, beleg: 'frontend/js/deal-action.js:setDealWon' },
        { id: 'd5', s: 1, z: 2, t: 'Verloren', k: 'GESTRICHEN', d: 'Deal nicht zustande gekommen. Das Objekt bleibt mit allen Zahlen erhalten — ausgegraut am Ende der Ankauf-Liste.', aus: ['ausgegraut in Ankauf'], ziel: { tab: 's8' }, beleg: 'frontend/js/deal-action.js:_deal_lost' },
        { id: 'd6', s: 2, z: 0, t: 'Bestand', k: 'Ist · Soll', d: 'Das Objekt steht unter „Bestand“. Oben im Objekt: „Ist · heute“ und „Soll · Ankauf-Stand“.', aus: ['Soll/Ist-Abgleich'], ziel: { tab: 's0' }, beleg: 'frontend/js/doppelkarte.js:Bestand' },
        { id: 'd7', s: 2, z: 1, t: 'In Gesellschaft überführen', k: 'Privat → GmbH', opt: true, d: 'Das Privatobjekt friert ein, ein neues GmbH-Objekt entsteht mit Werten, Fotos und KI-Analyse — beide verlinkt.', unter: [['Stichtag', '„Stichtag · Privat → Gesellschaft“'], ['Gesellschaft', 'Halter, Verkehrswert als AfA-Basis, übernommener Zins — mit Hinweis auf Grunderwerbsteuer und verdeckte Einlage, Prüfung der Zehnjahresfrist § 23 EStG.'], ['Bestätigen', 'Vorschau „Privat · friert ein“ / „GmbH · neu“.']], ein: ['Stichtag', 'Gesellschaft', 'Verkehrswert'], aus: ['GmbH-Objekt', 'Privatobjekt eingefroren'], ziel: { tab: 's8' }, beleg: 'frontend/js/ueberfuehrung-wizard.js:Stichtag der' }
      ],
      kanten: [['d1', 'd2'], ['d2', 'd3'], ['d3', 'd4'], ['d3', 'd5', 'nein'], ['d4', 'd6'], ['d6', 'd7', 'opt']]
    },
    {
      id: 'steuer', name: 'Das Steuerjahr', sub: 'Der Plan von damals bleibt stehen — daneben wachsen die Ist-Eintragungen',
      spalten: ['beim Kauf · einmal', 'laufendes Jahr', 'zum Jahresende', 'zur Erklärung'],
      knoten: [
        { id: 's1', s: 0, z: 0, t: 'Ankauf-Stand', k: 'AfA-Basis steht fest', d: 'Zum Nutzen-/Lastenwechsel wird der ganze Datensatz festgeschrieben — Kaufpreisaufteilung Boden/Gebäude und AfA-Basis inklusive.', unter: [['Kaufpreisaufteilung', 'Nach der Arbeitshilfe des BMF, Belege über „Anschaffungskosten einlesen“.'], ['AfA-Konfiguration', 'Satz oder Restnutzungsdauer, § 7b falls zutreffend.']], ein: ['Kaufpreis', 'Bodenrichtwert', 'Grundstück'], aus: ['AfA-Bemessungsgrundlage'], ziel: { tab: 's3-tax' }, beleg: 'frontend/js/werbungskosten-pdf.js:exportWerbungskostenPDF' },
        { id: 's2', s: 1, z: 0, t: 'Steuerzeitraum anlegen', k: 'Gültig von · bis', d: 'Je Zeitraum dein zu versteuerndes Einkommen. DealPilot prüft auf Überlappung — zwei Zeiträume über denselben Monat wären zwei Wahrheiten über dieselbe Miete.', unter: [['Steuerzeiträume verwalten', 'Link im Reiter Steuer.'], ['Neuen Zeitraum hinzufügen', 'Gültig von, gültig bis (leer = laufend), zvE, Grund.'], ['Konfliktprüfung', '„Konflikt — überschneidende Zeiträume“']], ein: ['zvE / Jahr', 'Gültig von', 'Gültig bis'], aus: ['Grenzsteuersatz je Jahr'], ziel: { fn: '_v842OpenTaxPeriods' }, beleg: 'frontend/js/tax-periods.js:Neuen Zeitraum' },
        { id: 's3', s: 2, z: 0, t: 'Werbungskosten eintragen', k: 'Ist je Jahr', d: 'Die tatsächlichen Kosten des Jahres je Objekt. Belege und Abrechnungen lassen sich einlesen statt abtippen.', unter: [['Steuerjahr wählen', 'Karte „Steuerformular pro Jahr“.'], ['Belege & Abrechnungen einlesen (KI)', 'Hausgeld- und Nebenkostenabrechnung, Rechnungen.'], ['Quick- oder Detail-Modus', 'Vorschläge lassen sich wiederherstellen.']], ein: ['Hausgeldabrechnung', 'Rechnungen', 'Zinsbescheinigung'], aus: ['Werbungskosten je Kategorie'], ziel: { tab: 's3-tax' }, beleg: 'backend/src/routes/wkAggregate.js:wk' },
        { id: 's4', s: 3, z: 0, t: 'Anlage V und Bilanz', k: 'Finanzamt-PDF', d: 'Finanzamt-PDF mit der Anlage V als zweiter Seite. Im Cockpit: Steuer über alle Objekte, Steuer-Mappe und Jahresabschluss.', ein: ['Werbungskosten', 'Mieteinnahmen', 'AfA'], aus: ['Anlage V', 'Finanzamt-PDF', 'Überschuss V+V'], ziel: { tab: 's3-tax' }, beleg: 'frontend/js/anlage-v-2025.js:Anlage V' }
      ],
      kanten: [['s1', 's2'], ['s2', 's3'], ['s3', 's4'], ['s4', 's2', 'loop']]
    },
    {
      id: 'marktbericht', name: 'Marktbericht', sub: 'Drei Stufen, acht Etappen — und jede Zahl mit Herkunft',
      spalten: ['Stufe wählen', 'Erstellen · im Hintergrund', 'Ergebnis'],
      knoten: [
        { id: 'm1', s: 0, z: 0, t: 'Einfach · Stufe 1', k: 'Marktpreisindikation', d: 'Aus Adresse, Objektart, Fläche und Baujahr.', ein: ['Adresse', 'Objektart', 'Wohnfläche', 'Baujahr'], aus: ['Marktwert mit Spanne'], ziel: { tab: 's0' }, beleg: 'frontend/js/objekt-reiter.js:Einfach' },
        { id: 'm2', s: 0, z: 1, t: 'Mittel · Stufe 2', k: 'erweiterte Indikation · ab Investor', d: 'Dazu Kaufpreis, Miete, Zustand, Energie, Ausstattung.', ein: ['Kaufpreis', 'Nettokaltmiete', 'Zustand', 'Energie'], aus: ['Rendite', 'Abstand zum Markt'], ziel: { tab: 's0' }, beleg: 'frontend/js/objekt-reiter.js:Mittel' },
        { id: 'm3', s: 0, z: 2, t: 'Ausgiebig · Stufe 3', k: 'Wertermittlung · ab Pro', d: 'Nach ImmoWertV. Fehlt eine Angabe, sagt DealPilot welche: der Bericht rechnet nie halb.', ein: ['Grundstück', 'Bodenrichtwert', 'Zustand', 'Standardstufe'], aus: ['Verkehrswert-Indikation'], ziel: { tab: 's0' }, beleg: 'frontend/js/objekt-reiter.js:Ausgiebig' },
        { id: 'm4', s: 1, z: 1, t: 'Acht Etappen', k: 'du arbeitest weiter', d: 'Der Bericht entsteht im Hintergrund, unten zeigt eine Leiste den Fortschritt. Ist er fertig, meldet sich DealPilot.', unter: [['Standort ermitteln', ''], ['Vergleichspreise', ''], ['Vergleichsmieten', ''], ['Mikrolage', ''], ['Makrolage', 'Aus der eigenen Datenbank, monatlich aktualisiert.'], ['Strukturdaten (Zensus)', ''], ['Bodenrichtwert', ''], ['Bewertung und Bericht', '']], aus: ['„Bericht ist fertig“'], ziel: { tab: 's0' }, beleg: 'frontend/js/mb-auftrag.js:ETAPPEN' },
        { id: 'm5', s: 2, z: 0, t: 'Bericht und Verlauf', k: 'zur Übernahme', d: 'Jeder Abruf landet im Verlauf und steht am Verkehrswert zur Übernahme. Wiederholte Abrufe zeigen den Wertverlauf, die Pilot-Analyse ordnet ihn ein.', aus: ['Verkehrswert', 'Wertverlauf', 'KI-Einordnung'], ziel: { aktion: 'marktbericht' }, beleg: 'frontend/js/dealpilot-mb.js:generate-stream' },
        { id: 'm6', s: 2, z: 2, t: 'Quellennachweis', k: 'Herkunft jeder Zahl', d: 'Liegenschaftszins und Sachwertfaktor des zuständigen Gutachterausschusses, mit Lizenz und Stichtag. Wo kein amtlicher Wert vorliegt, nennt der Bericht den Ausschuss und den Weg zur Quelle — statt eine Zahl zu erfinden.', aus: ['Quellennachweis', 'Weg zur Quelle'], ziel: { aktion: 'marktbericht' }, beleg: 'marktbericht/backend/src/services/CrossCheckService.js:quellen_nachweis' }
      ],
      kanten: [['m1', 'm4'], ['m2', 'm4'], ['m3', 'm4'], ['m4', 'm5'], ['m4', 'm6']]
    },
    {
      id: 'scores', name: 'Woraus die Scores bestehen', sub: 'Zwei Scores, bewusst verschieden — und wo du drehst',
      spalten: ['Eingang', 'Scores', 'Urteil'],
      knoten: [
        { id: 'c1', s: 0, z: 0, t: 'Kennzahlen', k: 'aus der Datenaufnahme', d: 'Cashflow, Renditen, DSCR, LTV, Lage, Zustand — dieselben Rechenkerne wie überall in der App.', aus: ['KPI-Satz'], ziel: { tab: 's6' }, beleg: 'frontend/js/deal-kpis.js:compute' },
        { id: 'c2', s: 0, z: 2, t: 'Deine Einstellungen', k: 'Vorlagen · Gewichte · Lageklassen', d: 'Sechs Vorlagen für den DealScore (ausgewogen, konservativ, optimistisch, lageorientiert, cashflowstark, sicherheitsorientiert), eigene Gewichte mit Summe 100, Ziel-Bruttomietrendite je Lageklasse (3,5 / 5,0 / 7,0 %), persönliche Mindest-Schwellen.', ein: ['Vorlage', 'Gewichte', 'Lageklasse'], aus: ['andere Rangfolge — dieselben Objekte'], ziel: { aktion: 'settings' }, beleg: 'frontend/js/dealscore.js:PRESET_WEIGHTS' },
        { id: 'c3', s: 1, z: 0, t: 'DealScore', k: 'fünf Faktoren · der schnelle Blick', d: 'Barkauf: Beleihungsauslauf und Risiko entfallen und werden nicht schlecht bewertet.', ein: ['Cashflow', 'Rendite', 'LTV', 'DSCR'], gew: [['Cashflow', 30], ['Rendite', 25], ['Beleihungsauslauf', 15], ['Risiko (Kapitaldienst)', 15], ['Potenzial', 15]], aus: ['0–100'], ziel: { tab: 's6' }, beleg: 'frontend/js/dealscore.js:DEFAULT_WEIGHTS' },
        { id: 'c4', s: 1, z: 2, t: 'Investor Deal Score', k: 'fünf Kategorien mit Unterkennzahlen', d: 'Fehlt eine Unterkennzahl, fällt sie aus der Gewichtung — sie wird nicht mit einem Mittelwert gefüllt.', ein: ['DSCR', 'LTV', 'Cashflow', 'Lage', 'Baujahr', 'Energie'], gew: [['Rendite', 35], ['Finanzierung', 25], ['Risiko', 20], ['Lage', 10], ['Upside', 10]], unter: [['Rendite', 'brutto 25 · netto 30 · Cashflow 25 · Cash-on-Cash 20'], ['Finanzierung', 'DSCR 35 · LTV 30 · Zins 15 · Tilgung 10 · EK-Bedarf 10'], ['Risiko', 'Leerstand 20 · Instandhaltung 20 · Qualität 20 · Baujahr 15 · Energie 15 · Mietausfall 10'], ['Lage', 'Markt vs. Ist 25 · Mietwachstum 25 · Bevölkerung 20 · Nachfrage 15 · Mikrolage 15'], ['Upside', 'Mietsteigerung 35 · Kaufpreisfaktor 30 · Wertsteigerung 20 · Entwicklung 15']], aus: ['0–100 mit Deckung'], ziel: { tab: 's6' }, beleg: 'frontend/js/dealscore2.js:subWeights' },
        { id: 'c5', s: 2, z: 1, t: 'Score-Stufen', k: 'überall dieselben', d: 'Sehr gut ab 85 · Gut ab 70 · Solide ab 50 · Schwach ab 35 · Kritisch darunter. Auf der Objektkarte, im Quick-Check, im Marktbericht und im Telegram-Bot.', gew: [['Sehr gut', 85], ['Gut', 70], ['Solide', 50], ['Schwach', 35]], aus: ['Pille auf der Objektkarte'], ziel: { aktion: 'view-all' }, beleg: 'frontend/js/score-tiers.js:stufe' }
      ],
      kanten: [['c1', 'c3'], ['c1', 'c4'], ['c2', 'c3'], ['c2', 'c4'], ['c3', 'c5'], ['c4', 'c5']]
    },
    /* v2965b · Marcel 26.10.2026: „Können wir auch beschreiben und erklären, wie Zielbilder angelegt werden?"
       Fakten aus potenzial.js, wert-zielbild.js, mfh-einheiten.js und dashboard.js (renderZielbild). */
    {
      id: 'zielbild', name: 'Mieterhöhung und Zielbild', sub: 'Was im Haus steckt — Soll-Miete, Umbau, Ertragswert je Stufe',
      spalten: ['Eintragen · im Reiter Objekt', 'Rechnen · kostenlos', 'Lesen'],
      knoten: [
        { id: 'z1', s: 0, z: 0, t: 'Soll-Miete eintragen', k: 'Mieter bleibt · § 558 BGB',
          d: 'Die Soll-Miete ist, was der jetzige Mieter nach normalen Mieterhöhungen zahlt. Lässt du das Feld leer, rechnet DealPilot sie vor: bis zur Vergleichsmiete, frühestens 15 Monate nach der letzten Erhöhung, höchstens um die Kappungsgrenze (15 % oder 20 % in drei Jahren). Deine eigene Angabe überschreibt immer.',
          unter: [['Karte öffnen', 'Reiter Investition, Karte „Mieterhöhung und Zielbild (optional)“.'], ['Vergleichsmiete (€/m²)', 'Die ortsübliche Vergleichsmiete. Leer: die Marktmiete aus dem Reiter Miete.'], ['Soll-Miete (Mieter bleibt, €/m²)', 'Leer lassen, dann steht darunter der Vorschlag mit Begründung — oder eine eigene Zahl eintragen.'], ['Soll erreichbar ab', 'Leer: 15 Monate nach der letzten Erhöhung aus dem Mietvertrag.']],
          ein: ['Ist-Miete', 'Vergleichsmiete', 'letzte Mieterhöhung', 'Kappungsgrenze'], aus: ['Soll-Miete', 'Mieterhöhung je Monat'],
          ziel: { tab: 's0' }, beleg: 'frontend/index.html:Soll-Miete (Mieter bleibt, €/m²)' },
        { id: 'z2', s: 0, z: 1, t: 'Zielbild und Maßnahmen', k: 'nach Umbau oder Neuvermietung',
          d: 'Das Zielbild ist, was nach deinem Umbau oder bei einem Mieterwechsel drin ist. Jede Maßnahme ist ein Chip mit Kosten. Bad, Fenster, Böden/Innenausbau, Grundriss, Elektrik, Dach, Fassade, Heizung und Leitungen tragen Modernisierungspunkte nach Anlage 2 ImmoWertV — das verlängert die Restnutzungsdauer und hebt den Ertragswert.',
          unter: [['Zielmiete (€/m²)', 'Was nach Umbau oder Neuvermietung erzielbar ist.'], ['Maßnahmen anklicken', 'Der Chip zeigt, wie viele Punkte das Gewerk noch bringt (z. B. „+2 P.“).'], ['Kosten € je Maßnahme', 'Die Summe steht unter der Karte.'], ['Haken „bewohnt (§ 559)“', 'Modernisierung mit Mieter in der Wohnung: 8 % der Kosten im Jahr auf die Soll-Miete, gedeckelt.'], ['Zielbild fertig (Jahr)', 'Für Pilot-Analyse und PDF; leer heißt offen.']],
          ein: ['Zielmiete', 'Maßnahmen', 'Kosten'], aus: ['Zielbild', 'Modernisierungspunkte', 'Maßnahmenkosten'],
          ziel: { tab: 's0' }, beleg: 'frontend/js/potenzial.js:MASSNAHMEN' },
        { id: 'z3', s: 0, z: 2, t: 'Mehrfamilienhaus: je Wohnung', k: 'Einheiten erfassen › Details', opt: true,
          d: 'Beim Mehrfamilienhaus stehen Soll-Miete und Zielbild je Wohnung. Die Karte im Reiter Investition zeigt dann nur die Summe aus den Wohnungen.',
          unter: [['Einheiten erfassen', 'Knopf unter der Wohnfläche im Reiter Objekt.'], ['Details', 'In der Liste die Wohnung öffnen: Mietvertrag, Soll-Miete, Zielbild mit Maßnahmen, Ertragswert.'], ['Maßnahmen am ganzen Haus', 'Im Schritt Gebäude: Dach, Fassade, Fenster, Heizung, Leitungen mit Kosten. Kosten nach Wohnfläche verteilt, Punkte für jede Wohnung, je Gewerk nur einmal.'], ['Aufgeteilt?', 'Im Schritt Gebäude der Haken „In Wohnungseigentum aufgeteilt“ und die Kosten der Aufteilung (Vorbelegung 1.800 € je Wohnung).']],
          ein: ['Wohnungen', 'Ist-Miete je Wohnung'], aus: ['Summe aus den Wohnungen', 'Anteil Haus je Wohnung', 'Ertragswert je Wohnung'],
          ziel: { tab: 's0' }, beleg: 'frontend/js/mfh-einheiten.js:Zielbild · nach Umbau' },
        { id: 'z4', s: 1, z: 1, t: 'Ertragswert je Stufe', k: 'kein Kontingent · mit Stufe 3',
          d: 'Derselbe Rechenkern wie der Marktbericht Stufe 3, mit denselben Ansätzen (Liegenschaftszins, Bewirtschaftung, Bodenwert). Je Stufe wechseln nur die Miete und die Restnutzungsdauer nach den Modernisierungspunkten. Das kostet kein Kontingent. Der Ertragswert erscheint, sobald für das Objekt ein Marktbericht Stufe 3 vorliegt oder dein Tarif Stufe 3 enthält.',
          unter: [['Von selbst', 'Öffnest du den Reiter Bewertung, rechnet DealPilot fehlende oder veraltete Ertragswerte von selbst nach.'], ['Von Hand', '„Ertragswerte rechnen“ in der Pilot-Analyse, „Jetzt rechnen“ in Wert & Zielbild.'], ['Gespeichert', 'Das Ergebnis reist mit dem Objekt — das Portfolio-Cockpit liest es von dort.']],
          ein: ['Soll-Miete', 'Zielbild', 'Modernisierungspunkte', 'Liegenschaftszins', 'Bodenwert'], aus: ['Ertragswert Bestand', 'Ertragswert Mieterhöhung', 'Ertragswert Zielbild'],
          ziel: { tab: 's6' }, beleg: 'frontend/js/potenzial.js:Ertragswert je Stufe mit DealPilot Stufe 3' },
        { id: 'z5', s: 2, z: 0, t: 'Wert & Zielbild lesen', k: 'Bewertung · Pilot-Analyse · PDF',
          d: 'Im Reiter Bewertung die Karte „Wert & Zielbild“: Kaltmiete, Maßnahmen, Ertragswert je Stufe und der Wertzuwachs nach Kosten (Ertragswert der Stufe minus Bestand minus Maßnahmen). Alles ist ein Ausblick, kein Verkehrswert zum heutigen Stichtag — maßgeblich für heute bleibt der Bestand.',
          unter: [['Kacheln', 'Die Kernaussagen auf einen Blick.'], ['Im Detail', 'Wohnungen, Wertüberleitung, Kennzahlen je Stufe.'], ['Pilot-Analyse', 'Bereich „Ankauf · Bestand · Zielbild“ mit Einfach und Genau.'], ['PDF', 'Seite Wertpotenzial in beiden PDFs.']],
          ein: ['Ertragswert je Stufe', 'Maßnahmenkosten'], aus: ['Wertzuwachs nach Kosten', 'Bruttomietrendite je Stufe'],
          ziel: { tab: 's6' }, beleg: 'frontend/js/wert-zielbild.js:Wertzuwachs nach Kosten' },
        { id: 'z6', s: 2, z: 2, t: 'Im Portfolio-Cockpit', k: '03 Bestand & Zielbild',
          d: 'Das Cockpit addiert Mieterhöhung und Zielbild aller Objekte, für die sie erfasst und gerechnet sind. Fehlt ein Objekt, steht der Grund daneben — mit einem Knopf ins Objekt und „neu rechnen ↻“ (kostenlos).',
          unter: [['Kacheln und Brücken', 'Kaltmiete, Rendite, Maßnahmen, Wertzuwachs nach Kosten.'], ['Je Objekt', 'Steigerung der Kaltmiete und Wertzuwachs nach Kosten.'], ['Mit Grund', 'Nicht oder nur teilweise enthalten — z. B. noch nichts eingetragen, Ertragswert nur mit Stufe 3, noch nicht gerechnet.']],
          ein: ['Ertragswert je Stufe', 'alle Objekte'], aus: ['Wertzuwachs Portfolio', 'Gründe fehlender Objekte'],
          ziel: { aktion: 'cockpit' }, beleg: 'frontend/js/dashboard.js:Nicht oder nur teilweise enthalten · mit Grund' }
      ],
      kanten: [['z1', 'z4'], ['z2', 'z4'], ['z3', 'z4', 'opt'], ['z4', 'z5'], ['z5', 'z6']]
    },
    /* v2217 · Marcel 14.10.2026: „Ist der Telegram-Bot … auch in dem Atlas
       passend integriert?" Er war es nicht - kein Ablauf, keine Station.
       Jede Station hier hat ihr Werkzeug in agentWerkzeuge.js als Beleg. */
    {
      id: 'telegram', name: 'Telegram-Bot', sub: 'DealPilot unterwegs — fragen, sprechen, anlegen, ohne die App zu öffnen',
      spalten: ['Verbinden', 'Fragen', 'Handeln'],
      knoten: [
        { id: 't1', s: 0, z: 0, t: 'Bot verbinden', k: 'Code aus den Einstellungen', d: 'In den Einstellungen erzeugst du einen Code und schickst ihn deinem Bot. Erst dann gehört der Chat zu deinem Konto — welche Daten der Bot liest, entscheidet nie der Nachrichtentext.', ein: ['Code'], aus: ['verknüpfter Chat'], ziel: { aktion: 'settings' }, beleg: 'backend/src/routes/telegram.js:/code' },
        { id: 't2', s: 0, z: 1, t: 'Sprechen, tippen, fotografieren', k: 'ohne Befehle', d: 'Sprachnachrichten werden umgeschrieben, Text versteht er wie gesagt, ein Foto vom Exposé liest er aus. Befehle wie /objekte gehen auch.', ein: ['Sprachnachricht', 'Text', 'Foto'], aus: ['Frage'], beleg: 'backend/src/routes/telegramWebhook.js:voiceExtract' },
        { id: 't3', s: 1, z: 0, t: 'Objekt und Kennzahlen', k: 'DSCR, Miete, Score …', d: 'Liste, Kerndaten und gerechnete Kennzahlen eines Objekts — aus denselben Rechenkernen wie die App, ins Backend gespiegelt. Er bleibt beim Objekt, bis du ein anderes nennst.', ein: ['Frage'], aus: ['DSCR', 'Cashflow', 'DealScore'], beleg: 'backend/src/services/agentWerkzeuge.js:objekt_kennzahlen' },
        { id: 't4', s: 1, z: 1, t: 'Portfolio', k: 'Vermögensbilanz · Rangliste · Hebel', d: 'Summen nur aus Zahlen, die DealPilot gerechnet hat — mit Stand. Dazu die Rangliste deiner Objekte und die Hebel für mehr Cashflow.', ein: ['Frage'], aus: ['Vermögensbilanz', 'Rangliste'], beleg: 'backend/src/services/agentWerkzeuge.js:portfolio_lesen' },
        { id: 't5', s: 1, z: 2, t: 'Soll/Ist und Pilot-Analyse', k: 'Plan gegen heute', d: 'Für Objekte im Bestand: der Ankauf-Stand gegen heute, Kennzahl für Kennzahl, und die Pilot-Analyse beim Ankauf neben der heutigen.', ein: ['Ankauf-Stand'], aus: ['Soll/Ist-Abgleich', 'Empfehlung damals und heute'], beleg: 'backend/src/services/agentWerkzeuge.js:soll_ist_lesen' },
        { id: 't6', s: 2, z: 0, t: 'Objekt anlegen', k: 'Frage für Frage', d: '„Leg mir ein Objekt an" — dann erzählst du, und er fragt nach, was fehlt. Das Objekt steht danach in der App.', ein: ['Adresse', 'Kaufpreis', 'Wohnfläche'], aus: ['Objekt · In Prüfung'], beleg: 'backend/src/services/agentWerkzeuge.js:objekt_anlegen' },
        { id: 't7', s: 2, z: 1, t: 'Felder ändern', k: 'mit Rückfrage', d: '„Setz die Zimmerzahl auf 5" — er nennt alt und neu und ändert erst nach deinem Ja.', ein: ['Feld', 'neuer Wert'], aus: ['geändertes Objekt'], beleg: 'backend/src/services/agentWerkzeuge.js:felder_aendern' },
        { id: 't8', s: 2, z: 2, t: 'Marktpreis abrufen', k: 'kostet · erst Preis, dann Frage', opt: true, d: 'Erst sagt er, was der Abruf kostet, dann fragt er — abgerufen wird nur nach deinem Ja.', ein: ['Adresse', 'Objektart', 'Wohnfläche'], aus: ['Marktwert mit Spanne'], beleg: 'backend/src/services/agentWerkzeuge.js:marktbericht_abrufen' }
      ],
      kanten: [['t1', 't2'], ['t2', 't3'], ['t2', 't4'], ['t2', 't5'], ['t3', 't6'], ['t3', 't7'], ['t3', 't8', 'opt']]
    }
  ];

  /* ── Hilfsmittel ──────────────────────────────────────────────────── */

  /* v2965a · Marcel 26.10.2026: „Hat die Hilfe und der Prozess-Atlas auch die genaue Beschreibung,
     die wir mal gemacht haben, dabei?" Die Schritt-für-Schritt-Anleitung (Flughandbuch Teil A, v2574,
     tools/handbuch-ablaeufe.mjs) war vom Atlas aus nicht erreichbar. Je Station der passende Ablauf;
     tools/prozess-atlas-pruefen.mjs prüft, dass es jede Ablauf-Id im Handbuch gibt. */
  var HANDBUCH = {
    'reise:qc1': 'quickcheck', 'reise:qc2': 'quickcheck', 'reise:qc3': 'quickcheck', 'reise:an1': 'erfassen',
    'reise:an2': 'marktbericht', 'reise:an3': 'bank', 'reise:be3': 'portfolio',
    'quickcheck:*': 'quickcheck', 'dokumente:*': 'import', 'boarding:*': 'erfassen', 'deal:d2': 'pilot', 'deal:d3': 'bank',
    'deal:d4': 'portfolio', 'steuer:*': 'steuer', 'marktbericht:*': 'marktbericht', 'zielbild:*': 'zielbild'
  };
  function handbuchFuer(pid, kid) { return HANDBUCH[pid + ':' + kid] || HANDBUCH[pid + ':*'] || null; }
  var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GL = 'var(--wl-b8932f, #b8932f)';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function proz(id) { for (var i = 0; i < PROZESSE.length; i++) if (PROZESSE[i].id === id) return PROZESSE[i]; return PROZESSE[0]; }
  function knoten(P, id) { for (var i = 0; i < P.knoten.length; i++) if (P.knoten[i].id === id) return P.knoten[i]; return null; }
  var ruhig = false;
  try { ruhig = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* Wo steht das geöffnete Objekt? Gemessen an denselben Merkern, die die
     App selbst setzt — nicht geraten. */
  function hierIn(pid) {
    var key = window._currentObjKey, d = window._currentObjData || {};
    var won = false; try { var w = document.getElementById('_deal_won_state'); won = !!(w && w.value === 'true') || !!d._deal_won; } catch (e) {}
    var lost = !!d._deal_lost, ank = !!window._dpAnkauf;
    var map = {
      reise: !key ? 'qc1' : (won || ank) ? 'be2' : 'an1',
      deal: !key ? null : lost ? 'd5' : (won || ank) ? 'd6' : 'd1',
      steuer: (won || ank) ? 's3' : null
    };
    return map[pid] || null;
  }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('dp-atlas-css')) return;
    var st = document.createElement('style'); st.id = 'dp-atlas-css';
    st.textContent = [
      '#dp-atlas{position:fixed;inset:0;z-index:10040;display:none;flex-direction:column;background:#050505;color:#f3ead0;font:400 13.5px/1.5 Inter,system-ui,sans-serif;overflow:hidden}',
      '#dp-atlas.an{display:flex;animation:atl-ein .35s ease}',
      '@keyframes atl-ein{from{opacity:0}to{opacity:1}}',
      '#dp-atlas::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 60% at 10% -10%,rgba(232,204,122,.13),transparent 60%),radial-gradient(90% 60% at 95% 110%,color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 9%, transparent),transparent 65%)}',
      '#dp-atlas::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.35;background-image:linear-gradient(color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 6%, transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 6%, transparent) 1px,transparent 1px);background-size:44px 44px;animation:atl-raster 40s linear infinite}',
      '@keyframes atl-raster{to{background-position:44px 44px}}',
      '.atl-kopf{position:relative;z-index:2;display:flex;align-items:center;gap:14px;padding:14px 20px 10px;flex-wrap:wrap}',
      '.atl-kopf .u{font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.16em;text-transform:uppercase;color:' + GH + '}',
      '.atl-kopf h2{margin:2px 0 0;font:600 21px/1.2 "Space Grotesk",sans-serif;color:#fdfcfa}',
      '.atl-kopf .s{color:#a99d84;font-size:12.5px}',
      '.atl-kopf .rechts{margin-left:auto;display:flex;gap:8px;align-items:center}',
      '.atl-btn{border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 55%, transparent);background:rgba(20,18,16,.8);color:' + GH + ';border-radius:9px;padding:7px 12px;font:600 12.5px Inter,sans-serif;cursor:pointer}',
      '.atl-btn:hover{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent)}',
      '.atl-btn.zu{font-size:18px;line-height:1;padding:5px 11px}',
      '.atl-wahl{position:relative;z-index:2;display:flex;gap:6px;padding:0 20px 10px;overflow-x:auto;scrollbar-width:none}',
      '.atl-wahl button{flex:0 0 auto;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 28%, transparent);background:rgba(20,18,16,.75);color:#d9cfb8;border-radius:999px;padding:7px 13px;font:600 12.5px Inter,sans-serif;cursor:pointer;transition:all .2s}',
      '.atl-wahl button.an{background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');color:#1a1407;border-color:transparent}',
      '.atl-rumpf{position:relative;z-index:2;flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:14px;padding:0 20px 18px}',
      /* v2966d · Messkabine 26.10.2026: die Flaeche wurde mit der Breite OHNE Rollbalken gelegt; kam der senkrechte
         Balken dazu, ragte sie 9 px ueber (390: 364 > 355, 768: 726 > 717) - Platz fuer den Balken immer freihalten.
         v2966f: nachgemessen blieben 4 px (Flaeche beim Oeffnen 359, danach 355) - die Flaeche ist per
         Bau nie breiter als noetig (Knoten enden bei breite - 18), quer wird deshalb nicht gerollt. */
      '.atl-netz{position:relative;min-height:0;overflow:hidden auto;scrollbar-gutter:stable;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent);border-radius:16px;background:rgba(14,12,10,.72)}',
      '.atl-flaeche{position:relative}',
      '.atl-flaeche svg.kt{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}',
      '.atl-sp{position:absolute;top:12px;font:500 10px/1.3 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:' + G + ';text-align:center;padding:5px 6px;border-bottom:1px dashed color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);opacity:0;animation:atl-pop .5s ease forwards}',
      '.atl-k{position:absolute;box-sizing:border-box;padding:10px 12px;border-radius:13px;background:linear-gradient(160deg,#1f1b16,#15120f);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 42%, transparent);cursor:pointer;opacity:0;transform:scale(.6);animation:atl-pop .55s cubic-bezier(.2,1.4,.4,1) forwards;transition:border-color .2s,box-shadow .25s,background .2s}',
      '.atl-k:hover{border-color:' + GH + ';box-shadow:0 0 0 1px rgba(232,204,122,.35),0 12px 30px -12px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent)}',
      '.atl-k.an{border-color:' + GH + ';background:linear-gradient(160deg,#30281b,#1a160f);box-shadow:0 0 0 2px rgba(232,204,122,.5),0 16px 40px -14px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 60%, transparent)}',
      '.atl-k.opt{border-style:dashed}',
      '.atl-k .kk{font:500 9.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#a99d84;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.atl-k .tt{font:600 14px/1.25 "Space Grotesk",sans-serif;color:#fdfcfa;margin-top:2px}',
      '.atl-k .zz{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap}',
      '.atl-k .zz span{font:600 9.5px "JetBrains Mono",monospace;color:' + GH + ';background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent);border-radius:5px;padding:1px 6px}',
      '.atl-k.hier{border-color:#3FA56C}',
      '.atl-k.hier::before{content:"";position:absolute;inset:-6px;border-radius:17px;border:2px solid #3FA56C;animation:atl-puls 1.8s ease-out infinite;pointer-events:none}',
      '.atl-k .hier-tag{position:absolute;right:10px;top:-9px;background:#3FA56C;color:#04140a;font:700 9px "JetBrains Mono",monospace;letter-spacing:.08em;padding:2px 6px;border-radius:5px}',
      '@keyframes atl-puls{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.12)}}',
      '@keyframes atl-pop{to{opacity:1;transform:scale(1)}}',
      '.atl-k.knall::after{content:"";position:absolute;inset:-2px;border-radius:14px;box-shadow:0 0 0 0 rgba(232,204,122,.7);animation:atl-knall .7s ease-out}',
      '@keyframes atl-knall{to{box-shadow:0 0 0 26px rgba(232,204,122,0)}}',
      '.kt path.l{fill:none;stroke:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 42%, transparent);stroke-width:2;stroke-dasharray:1;stroke-dashoffset:1;animation:atl-zieh .7s ease forwards}',
      '.kt path.l.opt{stroke-dasharray:1;stroke:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent)}',
      '.kt path.l.nein{stroke:rgba(184,98,92,.6)}',
      '.kt path.l.loop{stroke:rgba(63,165,108,.55)}',
      '.kt path.f{fill:none;stroke:' + GH + ';stroke-width:2;stroke-dasharray:3 14;opacity:0;animation:atl-fluss 1.1s linear infinite,atl-sicht .3s ease forwards}',
      '.kt path.f.opt{stroke-dasharray:2 9;opacity:.6}',
      '.kt path.f.nein{stroke:#D8564C}.kt path.f.loop{stroke:#3FA56C}',
      '@keyframes atl-zieh{to{stroke-dashoffset:0}}',
      '@keyframes atl-fluss{to{stroke-dashoffset:-17}}',
      '@keyframes atl-sicht{to{opacity:.75}}',
      '.kt .flieger path{fill:' + GH + '}',
      '.kt .flieger{filter:drop-shadow(0 0 6px rgba(232,204,122,.9))}',
      '.atl-panel{position:relative;min-height:0;overflow:auto;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 28%, transparent);border-radius:16px;background:rgba(20,18,16,.92);padding:16px 18px}',
      '.atl-panel .u{font:500 10px/1.3 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:' + G + '}',
      '.atl-panel h3{margin:4px 0 6px;font:600 19px/1.25 "Space Grotesk",sans-serif;color:#fdfcfa}',
      '.atl-panel .d{color:#ddd3bd}',
      '.atl-panel .bl{margin-top:14px;font:500 10px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#a99d84}',
      '.atl-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;min-height:26px}',
      '.atl-chip{display:inline-block;border-radius:7px;padding:3px 9px;font:500 12px Inter,sans-serif;background:#26211b;border:1px solid #3a3227;color:#efe6d2}',
      '.atl-chip.aus{background:rgba(63,165,108,.14);border-color:rgba(63,165,108,.45);color:#bfe8cf}',
      '.atl-chip.flug{position:fixed;z-index:10045;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.45)}',
      '.atl-chip.platz{visibility:hidden}',
      '.atl-schritte{list-style:none;margin:8px 0 0;padding:0 0 0 18px;position:relative}',
      '.atl-schritte::before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:linear-gradient(' + GH + ',' + GL + ');transform-origin:top;transform:scaleY(0);animation:atl-linie .9s ease forwards}',
      '@keyframes atl-linie{to{transform:scaleY(1)}}',
      '.atl-schritte li{position:relative;margin:0 0 9px;opacity:0;transform:translateX(-8px);animation:atl-rein .4s ease forwards}',
      '.atl-schritte li::before{content:"";position:absolute;left:-17px;top:5px;width:10px;height:10px;border-radius:50%;background:#141210;border:2px solid ' + G + '}',
      '.atl-schritte b{display:block;font-weight:600;color:#fdfcfa;font-size:13px}.atl-schritte span{color:#b9ad8f;font-size:12.5px}',
      '@keyframes atl-rein{to{opacity:1;transform:none}}',
      '.atl-gew{margin-top:8px}',
      '.atl-gew .r{display:grid;grid-template-columns:130px 1fr 40px;gap:8px;align-items:center;margin:5px 0;font-size:12.5px}',
      '.atl-gew .b{height:8px;border-radius:4px;background:#26211b;overflow:hidden}',
      '.atl-gew .b i{display:block;height:100%;width:0;border-radius:4px;background:linear-gradient(90deg,' + GH + ',' + GL + ');transition:width .9s cubic-bezier(.2,1,.3,1)}',
      '.atl-gew .v{font:600 12px "JetBrains Mono",monospace;color:' + GH + ';text-align:right}',
      '.atl-weiter{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}',
      '.atl-weiter button{border:1px dashed color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 50%, transparent);background:transparent;color:#e8dcc0;border-radius:8px;padding:5px 10px;font:500 12px Inter,sans-serif;cursor:pointer}',
      '.atl-hin{margin-top:16px;width:100%;padding:10px;border:0;border-radius:10px;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');color:#1a1407;font:600 13.5px "Space Grotesk",sans-serif;cursor:pointer}',
      '.atl-kap{position:absolute;width:46px;height:73px;z-index:3;pointer-events:none;transition:left 1.1s cubic-bezier(.45,0,.3,1),top 1.1s cubic-bezier(.45,0,.3,1)}',
      '.atl-kap .pf-wrap{display:block;width:100%;height:100%}.atl-kap svg.pf{width:100%;height:100%}',
      '.atl-hb{display:block;margin-top:8px;padding:9px 10px;border:1px solid ' + G + ';border-radius:10px;color:' + GH + ';font:600 13px "Space Grotesk",sans-serif;text-align:center;text-decoration:none}.atl-hb:hover{background:color-mix(in srgb, ' + G + ' 12%, transparent)}',
      '.atl-beleg{margin-top:10px;font:500 10.5px "JetBrains Mono",monospace;color:#7f7663;word-break:break-all}',
      '@media (max-width:900px){.atl-rumpf{grid-template-columns:1fr;grid-template-rows:minmax(260px,1fr) auto;overflow:auto}.atl-panel{max-height:none;overflow:visible}#dp-atlas{overflow:auto}.atl-rumpf{flex:none}}',
      '.atl-kopf,.atl-wahl{flex:0 0 auto}',
      '@media (max-width:900px){.atl-netz{max-height:56vh}}',
      '@media (max-width:640px){.atl-kopf{padding:12px 14px 8px}.atl-wahl{padding:0 14px 8px}.atl-rumpf{padding:0 12px 14px}.atl-kopf h2{font-size:18px}.atl-kopf .s{display:none}}',
      '@media (prefers-reduced-motion:reduce){.atl-k,.atl-sp,.atl-schritte li{animation:none;opacity:1;transform:none}.kt path.l{animation:none;stroke-dashoffset:0}#dp-atlas::after{animation:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ── Aufbau ───────────────────────────────────────────────────────── */
  var root, aktuell = 'reise', auswahl = null, _abspiel = null, _lay = null;
  function bauen() {
    if (root) return;
    css();
    root = document.createElement('div'); root.id = 'dp-atlas'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Prozess-Atlas');
    root.innerHTML = '<div class="atl-kopf"><div><div class="u">DealPilot · Prozess-Atlas</div><h2 class="nm"></h2><div class="s"></div></div>'
      + '<div class="rechts"><button type="button" class="atl-btn sp">▶ Ablauf abspielen</button><button type="button" class="atl-btn zu" aria-label="Schließen">×</button></div></div>'
      + '<div class="atl-wahl"></div>'
      + '<div class="atl-rumpf"><div class="atl-netz"><div class="atl-flaeche"></div></div><div class="atl-panel"></div></div>';
    document.body.appendChild(root);
    root.querySelector('.zu').addEventListener('click', schliessen);
    root.querySelector('.sp').addEventListener('click', function () { _abspiel ? stopp() : abspielen(); });
    root.querySelector('.atl-wahl').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) zeige(b.getAttribute('data-p')); });
    root.querySelector('.atl-flaeche').addEventListener('click', function (e) { var k = e.target.closest('.atl-k'); if (k) { stopp(); waehle(k.getAttribute('data-k'), true); } });
    root.querySelector('.atl-panel').addEventListener('click', function (e) {
      var w = e.target.closest('[data-weiter]'); if (w) { stopp(); waehle(w.getAttribute('data-weiter'), true); return; }
      if (e.target.closest('.atl-hin')) hinfliegen();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('an') && !(document.getElementById('dp-tower') || {}).classList?.contains('an')) schliessen(); });
    var t; window.addEventListener('resize', function () { if (!root.classList.contains('an')) return; clearTimeout(t); t = setTimeout(function () { zeichne(false); }, 150); });
  }

  /* Layout: Spalten nebeneinander; zu schmal → eine Spalte untereinander */
  function layout(P, breite) {
    var spN = P.spalten.length, zMax = 0;
    P.knoten.forEach(function (k) { if (k.z > zMax) zMax = k.z; });
    var pad = 18, gapX = 54, gapY = 26, H = 96, kopf = 46;
    var W = Math.floor((breite - 2 * pad - (spN - 1) * gapX) / spN);
    var L = { pos: {}, sp: [], vertikal: W < 165 };
    if (!L.vertikal) {
      W = Math.min(W, 300);
      var gesamt = spN * W + (spN - 1) * gapX, x0 = Math.max(pad, (breite - gesamt) / 2);
      P.spalten.forEach(function (s, i) { L.sp.push({ t: s, x: x0 + i * (W + gapX), w: W }); });
      P.knoten.forEach(function (k) { L.pos[k.id] = { x: x0 + k.s * (W + gapX), y: kopf + k.z * (H + gapY), w: W, h: H }; });
      L.w = breite; L.h = kopf + (zMax + 1) * (H + gapY) + 24;
    } else {
      var reih = P.knoten.slice().sort(function (a, b) { return a.s - b.s || a.z - b.z; });
      W = breite - 2 * pad - 30; var y = 14, hv = 78;
      reih.forEach(function (k, i) { L.pos[k.id] = { x: pad + 30, y: y, w: W, h: hv }; y += hv + 22; });
      L.w = breite; L.h = y + 10;
    }
    return L;
  }
  function kantenPfad(a, b, art) {
    var ax2 = a.x + a.w, acy = a.y + a.h / 2, bcy = b.y + b.h / 2;
    if (art === 'loop') {
      var yb = Math.max(a.y + a.h, b.y + b.h) + 34;
      return 'M' + (a.x + a.w / 2) + ' ' + (a.y + a.h) + ' C' + (a.x + a.w / 2) + ' ' + yb + ',' + (b.x + b.w / 2) + ' ' + yb + ',' + (b.x + b.w / 2) + ' ' + (b.y + b.h);
    }
    if (b.x >= ax2 - 2) {
      var dx = Math.max(30, (b.x - ax2) / 2);
      return 'M' + ax2 + ' ' + acy + ' C' + (ax2 + dx) + ' ' + acy + ',' + (b.x - dx) + ' ' + bcy + ',' + b.x + ' ' + bcy;
    }
    if (b.y > a.y) {
      var sx = a.x + a.w * 0.5, ex = b.x + b.w * 0.5, dy = Math.max(14, (b.y - a.y - a.h) / 2);
      if (Math.abs(a.x - b.x) < 3) { sx = a.x + 14; ex = b.x + 14; return 'M' + sx + ' ' + (a.y + a.h) + ' L' + ex + ' ' + b.y; }
      return 'M' + sx + ' ' + (a.y + a.h) + ' C' + sx + ' ' + (a.y + a.h + dy) + ',' + ex + ' ' + (b.y - dy) + ',' + ex + ' ' + b.y;
    }
    return 'M' + a.x + ' ' + acy + ' C' + (a.x - 30) + ' ' + acy + ',' + (b.x + b.w + 30) + ' ' + bcy + ',' + (b.x + b.w) + ' ' + bcy;
  }
  function vertikalPfad(a, b, art) {
    var x = a.x - 16;
    if (art === 'loop' || b.y < a.y) return 'M' + a.x + ' ' + (a.y + a.h / 2) + ' C' + (x - 22) + ' ' + (a.y + a.h / 2) + ',' + (x - 22) + ' ' + (b.y + b.h / 2) + ',' + b.x + ' ' + (b.y + b.h / 2);
    return 'M' + a.x + ' ' + (a.y + a.h / 2) + ' C' + x + ' ' + (a.y + a.h / 2) + ',' + x + ' ' + (b.y + b.h / 2) + ',' + b.x + ' ' + (b.y + b.h / 2);
  }

  function zeichne(animiert) {
    var P = proz(aktuell);
    var netz = root.querySelector('.atl-netz'), fl = root.querySelector('.atl-flaeche');
    var L = layout(P, Math.max(280, netz.clientWidth));
    _lay = L;
    fl.style.width = L.w + 'px'; fl.style.height = L.h + 'px';
    var hier = hierIn(P.id), html = '', sv = '', pfade = [];
    var reihe = P.knoten.slice().sort(function (a, b) { return a.s - b.s || a.z - b.z; });
    var ord = {}; reihe.forEach(function (k, i) { ord[k.id] = i; });
    var tA = animiert && !ruhig;
    if (!L.vertikal) L.sp.forEach(function (s, i) { html += '<div class="atl-sp" style="left:' + s.x + 'px;width:' + s.w + 'px;' + (tA ? 'animation-delay:' + (i * 120) + 'ms' : 'opacity:1') + '">' + esc(s.t) + '</div>'; });
    P.kanten.forEach(function (e, i) {
      var a = L.pos[e[0]], b = L.pos[e[1]]; if (!a || !b) return;
      var d = L.vertikal ? vertikalPfad(a, b, e[2]) : kantenPfad(a, b, e[2]);
      var verz = (ord[e[0]] * 110 + 260);
      sv += '<path class="l ' + (e[2] || '') + '" pathLength="1" d="' + d + '" style="' + (tA ? 'animation-delay:' + verz + 'ms' : 'animation:none;stroke-dashoffset:0') + '"/>'
        + '<path class="f ' + (e[2] || '') + '" d="' + d + '" style="' + (tA ? 'animation-delay:0s,' + (verz + 600) + 'ms' : '') + '"/>';
      if (!e[2]) pfade.push(d);
    });
    if (pfade.length && !ruhig) {
      /* v2965 · Marcel 26.10.2026: „die Flugzeuge fliegen rueckwaerts". rotate="auto" legt die +x-Achse
         in Flugrichtung; der Umriss hatte die Nase bei x -11 (Fluegel und Leitwerk bei +x). Gespiegelt: Nase bei +11. */
      sv += '<g class="flieger"><path d="M11 -1.6 L3 -1.6 L-4 -8 L-7 -8 L-3 -1.6 L-9 -1.6 L-12 -4 L-13.5 -4 L-12 0 L-13.5 4 L-12 4 L-9 1.6 L-3 1.6 L-7 8 L-4 8 L3 1.6 L11 1.6 Z"/>'
        + '<animateMotion dur="' + (pfade.length * 1.5) + 's" begin="' + (tA ? '1.2s' : '0s') + '" repeatCount="indefinite" rotate="auto" path="' + pfade.join(' ') + '"/></g>';
    }
    P.knoten.forEach(function (k) {
      var p = L.pos[k.id], n = [];
      if (k.unter && k.unter.length) n.push(k.unter.length + ' Schritte');
      if (k.ein && k.ein.length) n.push(k.ein.length + ' Eingaben');
      if (k.aus && k.aus.length) n.push(k.aus.length + ' Ergebnisse');
      html += '<div class="atl-k' + (k.opt ? ' opt' : '') + (hier === k.id ? ' hier' : '') + (auswahl === k.id ? ' an' : '') + '" data-k="' + k.id + '" tabindex="0" style="left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.w + 'px;height:' + p.h + 'px;' + (tA ? 'animation-delay:' + (ord[k.id] * 110) + 'ms' : 'animation:none;opacity:1;transform:none') + '">'
        + (hier === k.id ? '<span class="hier-tag">DU BIST HIER</span>' : '')
        + '<div class="kk">' + esc(k.k || '') + '</div><div class="tt">' + esc(k.t) + '</div>'
        + (L.vertikal ? '' : '<div class="zz">' + n.slice(0, 2).map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>') + '</div>';
    });
    fl.innerHTML = '<svg class="kt" width="' + L.w + '" height="' + L.h + '" viewBox="0 0 ' + L.w + ' ' + L.h + '">' + sv + '</svg>' + html;
    kapitaen(true);
    if (auswahl) kapitaenZu(auswahl, fl.querySelector('.atl-k[data-k="' + auswahl + '"]'));
  }

  /* ── Der Kapitän mit Koffer ─────────────────────────────────────────
     Marcel, 13.10.2026: „bei den Prozessen auch mit einem Pilotenkoffer".
     Er rollt den Koffer zur gewählten Station, bleibt links daneben
     stehen und zeigt auf sie. Die Figur ist dieselbe wie im Tower
     (pilot-figur.js). */
  var _kap = null, _kapT = null;
  function kapitaen(neu) {
    if (!window.DealPilotFigur) return;
    var fl = root.querySelector('.atl-flaeche');
    _kap = document.createElement('div'); _kap.className = 'atl-kap';
    _kap.appendChild(DealPilotFigur.bauen({ koffer: true }));
    _kap.style.transition = 'none'; _kap.style.left = '-60px'; _kap.style.top = '0px';
    fl.appendChild(_kap);
  }
  function kapitaenPlatz(id) {
    var p = _lay && _lay.pos[id]; if (!p) return null;
    var x = p.x - 50, y = p.y + p.h - 73 + 2;
    if (x < 0) x = Math.max(0, p.x - 48);   /* einspaltig: links in den Rand, nie rechts aus dem Bild (gemessen 390 px: x 363) */
    return { x: x, y: y };
  }
  function kapitaenZu(id, kEl) {
    if (!_kap) return;
    var z = kapitaenPlatz(id); if (!z) return;
    var w = _kap.querySelector('.pf-wrap'), s = w && w.querySelector('svg.pf');
    var alt = { x: parseFloat(_kap.style.left), y: parseFloat(_kap.style.top) };
    var erst = alt.x < 0;
    if (s) s.classList.remove('zeigt');
    if (erst || ruhig) {
      _kap.style.transition = 'none'; _kap.style.left = z.x + 'px'; _kap.style.top = z.y + 'px';
      void _kap.offsetWidth; _kap.style.transition = '';
      setTimeout(function () { if (kEl) DealPilotFigur.zeigeAuf(w, kEl.getBoundingClientRect()); }, 60);
      return;
    }
    w.classList.toggle('links', z.x < alt.x);
    if (s) s.classList.add('laeuft');
    _kap.style.left = z.x + 'px'; _kap.style.top = z.y + 'px';
    clearTimeout(_kapT);
    _kapT = setTimeout(function () {
      if (s) s.classList.remove('laeuft');
      w.classList.remove('links');
      if (kEl) DealPilotFigur.zeigeAuf(w, kEl.getBoundingClientRect());
    }, 1120);
  }

  /* ── Auswahl: Schritte klappen auf, Daten fliegen ein ─────────────── */
  function chipsFliegen(vonEl, zielBox, liste, klasse, verz) {
    var r0 = vonEl.getBoundingClientRect();
    zielBox.innerHTML = liste.map(function (x) { return '<span class="atl-chip ' + klasse + ' platz">' + esc(x) + '</span>'; }).join('');
    var plaetze = zielBox.querySelectorAll('.atl-chip');
    plaetze.forEach(function (pl, i) {
      if (ruhig) { pl.classList.remove('platz'); return; }
      setTimeout(function () {
        var r1 = pl.getBoundingClientRect();
        var f = pl.cloneNode(true); f.classList.remove('platz'); f.classList.add('flug');
        var sx = r0.left + r0.width / 2 - r1.width / 2 + (Math.random() * 40 - 20), sy = r0.top + r0.height / 2 - r1.height / 2;
        f.style.left = r1.left + 'px'; f.style.top = r1.top + 'px';
        document.body.appendChild(f);
        var dx = sx - r1.left, dy = sy - r1.top, mx = dx * 0.45, my = dy * 0.45 - 70;
        var an = f.animate([
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.4)', opacity: 0 },
          { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.12)', opacity: 1, offset: 0.55 },
          { transform: 'translate(0,0) scale(1)', opacity: 1 }
        ], { duration: 720, easing: 'cubic-bezier(.3,.9,.3,1)' });
        an.onfinish = function () { f.remove(); pl.classList.remove('platz'); };
      }, verz + i * 75);
    });
  }
  function waehle(id, mitFlug) {
    var P = proz(aktuell), k = knoten(P, id); if (!k) return;
    auswahl = id;
    root.querySelectorAll('.atl-k').forEach(function (el) { el.classList.toggle('an', el.getAttribute('data-k') === id); });
    var kEl = root.querySelector('.atl-k[data-k="' + id + '"]');
    kapitaenZu(id, kEl);
    if (kEl) { kEl.classList.remove('knall'); void kEl.offsetWidth; kEl.classList.add('knall'); try { kEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch (e) {} }
    var nr = P.knoten.slice().sort(function (a, b) { return a.s - b.s || a.z - b.z; }).indexOf(k) + 1;
    var weiter = P.kanten.filter(function (e) { return e[0] === id; }).map(function (e) { var n = knoten(P, e[1]); return n ? '<button type="button" data-weiter="' + n.id + '">' + (e[2] === 'loop' ? '↻ ' : e[2] === 'nein' ? '✕ ' : '→ ') + esc(n.t) + '</button>' : ''; }).join('');
    var h = '<div class="u">' + esc(P.name) + ' · Station ' + nr + ' von ' + P.knoten.length + (k.opt ? ' · optional' : '') + '</div>'
      + '<h3>' + esc(k.t) + '</h3><div class="d">' + esc(k.d) + '</div>';
    if (k.ein && k.ein.length) h += '<div class="bl">Was hineingeht</div><div class="atl-chips ein"></div>';
    if (k.gew && k.gew.some(function (g) { return g[1]; })) h += '<div class="bl">' + (P.id === 'scores' && k.id === 'c5' ? 'Schwellen' : 'Gewichtung') + '</div><div class="atl-gew">' + k.gew.map(function (g) {
      return '<div class="r"><span>' + esc(g[0]) + '</span><span class="b"><i data-w="' + g[1] + '"></i></span><span class="v">' + g[1] + (k.id === 'c5' ? '' : ' %') + '</span></div>';
    }).join('') + '</div>';
    else if (k.gew) h += '<div class="bl">Teilscores</div><div class="atl-chips">' + k.gew.map(function (g) { return '<span class="atl-chip">' + esc(g[0]) + ' /100</span>'; }).join('') + '</div>';
    if (k.unter && k.unter.length) h += '<div class="bl">Schritt für Schritt</div><ol class="atl-schritte">' + k.unter.map(function (u, i) {
      return '<li style="animation-delay:' + (ruhig ? 0 : 250 + i * 140) + 'ms"><b>' + esc(u[0]) + '</b>' + (u[1] ? '<span>' + esc(u[1]) + '</span>' : '') + '</li>';
    }).join('') + '</ol>';
    if (k.aus && k.aus.length) h += '<div class="bl">Was herauskommt</div><div class="atl-chips aus"></div>';
    if (weiter) h += '<div class="bl">Wie es weitergeht</div><div class="atl-weiter">' + weiter + '</div>';
    if (k.ziel) h += '<button type="button" class="atl-hin">✈ Hinfliegen — in der App öffnen</button>';
    var hbId = handbuchFuer(P.id, k.id);
    if (hbId) h += '<a class="atl-hb" href="handbuch.html#a-' + esc(hbId) + '" target="_blank" rel="noopener">Schritt für Schritt im Flughandbuch →</a>';
    h += '<div class="atl-beleg">Beleg im Code: ' + esc(k.beleg) + '</div>';
    var pan = root.querySelector('.atl-panel'); pan.innerHTML = h; pan.scrollTop = 0;
    /* schmal: die Erklaerung steht UNTER dem Netz - nach dem Klick dorthin, sonst fliegen die Daten ins Unsichtbare */
    if (mitFlug && innerWidth <= 900) { try { pan.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' }); } catch (e) {} }
    var vonEl = kEl || pan;
    var schrittZeit = (k.unter ? k.unter.length * 140 : 0);
    if (k.ein && k.ein.length) chipsFliegen(vonEl, pan.querySelector('.atl-chips.ein'), k.ein, '', mitFlug ? 80 : 0);
    if (k.aus && k.aus.length) chipsFliegen(pan.querySelector('h3'), pan.querySelector('.atl-chips.aus'), k.aus, 'aus', (mitFlug ? 380 : 0) + schrittZeit + (k.ein ? k.ein.length * 50 : 0));
    setTimeout(function () { pan.querySelectorAll('.atl-gew i').forEach(function (i, j) { setTimeout(function () { i.style.width = Math.min(100, +i.getAttribute('data-w')) + '%'; }, j * 90); }); }, 120);
  }

  function zeige(pid, station) {
    stopp();
    aktuell = proz(pid).id; auswahl = null;
    var P = proz(aktuell);
    root.querySelector('.nm').textContent = P.name;
    root.querySelector('.s').textContent = P.sub;
    root.querySelector('.atl-wahl').innerHTML = PROZESSE.map(function (p) { return '<button type="button" data-p="' + p.id + '"' + (p.id === aktuell ? ' class="an"' : '') + '>' + esc(p.name) + '</button>'; }).join('');
    try { localStorage.setItem('dp_atlas_letzt', aktuell); } catch (e) {}
    zeichne(true);
    var start = station || hierIn(aktuell) || P.knoten.slice().sort(function (a, b) { return a.s - b.s || a.z - b.z; })[0].id;
    setTimeout(function () { waehle(start, true); }, ruhig ? 0 : 650);
  }
  function abspielen() {
    var P = proz(aktuell), reihe = P.knoten.slice().sort(function (a, b) { return a.s - b.s || a.z - b.z; });
    var i = 0, btn = root.querySelector('.sp');
    btn.textContent = '■ Anhalten';
    function schritt() { if (!_abspiel) return; waehle(reihe[i].id, true); i++; if (i >= reihe.length) { _abspiel = setTimeout(stopp, 3600); return; } _abspiel = setTimeout(schritt, 3600); }
    _abspiel = 1; schritt();
  }
  function stopp() { if (_abspiel && _abspiel !== 1) clearTimeout(_abspiel); _abspiel = null; if (root) root.querySelector('.sp').textContent = '▶ Ablauf abspielen'; }
  function hinfliegen() {
    var k = knoten(proz(aktuell), auswahl); if (!k || !k.ziel) return;
    schliessen();
    setTimeout(function () {
      if (window.DealPilotPilot && DealPilotPilot.fliegeNach) DealPilotPilot.fliegeNach(k.ziel);
      else if (k.ziel.aktion && window.sbActionsAction) sbActionsAction(k.ziel.aktion);
    }, 120);
  }

  function oeffne(pid, station) {
    bauen();
    try { if (window.hideHelp) hideHelp(); } catch (e) {}
    if (!pid) { try { pid = localStorage.getItem('dp_atlas_letzt'); } catch (e) {} }
    root.classList.add('an');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { zeige(pid || 'reise', station); }, 16);   /* rAF laeuft im Hintergrund-Tab nie */
  }
  function schliessen() { stopp(); if (root) root.classList.remove('an'); document.documentElement.style.overflow = ''; document.querySelectorAll('.atl-chip.flug').forEach(function (x) { x.remove(); }); }

  function stationen() {
    var L = [];
    PROZESSE.forEach(function (P) { P.knoten.forEach(function (k) { L.push(Object.assign({ pid: P.id, prozess: P.name }, k)); }); });
    return L;
  }

  window.DealPilotAtlas = { PROZESSE: PROZESSE, HANDBUCH: HANDBUCH, oeffne: oeffne, schliessen: schliessen, stationen: stationen, hierIn: hierIn };
})();
