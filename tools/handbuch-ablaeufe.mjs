/* tools/handbuch-ablaeufe.mjs — v2574 · Flughandbuch, Teil „Schritt für Schritt“
 *
 * Marcel am 21.10.2026: „Das Flughandbuch könnte auch in Richtung
 * Schritt-für-Schritt-Anleitung mit Text ergänzt werden, falls es das noch
 * nicht hat."
 *
 * ── WARUM DIESE DATEI VON HAND GEPFLEGT IST ───────────────────────────────
 *
 * Der Rest des Handbuchs wird aus index.html und den Hilfetexten GELESEN.
 * Ein Ablauf („erst hier klicken, dann dort“) steht so in keiner Quelle —
 * er ist Prosa. Damit er trotzdem nicht von der App wegläuft, trägt JEDER
 * Schritt Belege: [Datei, Text]. tools/handbuch-erzeugen.mjs prüft, dass
 * der Text in der Datei steht (roh, nach \uXXXX und nach HTML-Entitäten
 * aufgelöst). Fällt ein Knopf weg oder wird umbenannt, wird der Erzeuger
 * rot — und das Handbuch erzählt nicht weiter von einem Knopf, den es
 * nicht mehr gibt (dasselbe Prinzip wie tools/prozess-atlas-pruefen.mjs).
 *
 * Abgrenzung (nichts doppelt):
 *   - Feld für Feld steht in den Kapiteln ETW · EFH · MFH — hier wird nur
 *     dorthin verlinkt (siehe: '#s-ETW-s3' usw.).
 *   - Die Wohnungsliste des MFH hat ihre Schritttabelle im Kapitel MFH.
 *   - Der Prozess-Atlas (Hilfe) zeigt die Abläufe als Netzplan; hier
 *     stehen sie als nummerierte Liste zum Nachklicken und Ausdrucken.
 *
 * Aufbau je Ablauf:
 *   id, titel, kurz (ein Satz: wozu), wann (optional),
 *   schritte: [{ t: Text (**fett** erlaubt), kosten?: Text, plan?: Text,
 *               belege: [[datei, text], …] }],
 *   bilder?: [{ datei, unter }]  — nur vorhandene Bilder aus handbuch/bilder
 *   siehe?:  [[Anker, Text]]     — Sprung in die Feldkapitel
 *   hinweis?: Text
 *
 * Regeln: einfache Sprache, Du. „Kontingent“, nie „Kerosin“. Keine
 * Anbieter- oder Datenquellennamen. Was das Kontingent belastet, trägt
 * `kosten`.
 */

const IX = 'frontend/index.html';
const QC = 'frontend/quickcheck-app.html';
const J = (n) => 'frontend/js/' + n;

export const ABLAEUFE = [
  {
    id: 'einrichten',
    titel: 'Vor dem ersten Flug: Anlegerprofil und Einstellungen',
    kurz: 'Einmal einrichten, womit DealPilot rechnet — danach ist jedes neue Objekt mit deinen Annahmen vorbelegt.',
    wann: 'Beim ersten Anmelden und immer dann, wenn sich deine Annahmen ändern.',
    schritte: [
      { t: 'Beim ersten Anmelden öffnet sich ein Einrichtungsfenster mit sechs Schritten: **Aussehen**, **Daten**, **Finanzierung** (dein Anlegerprofil), **Steuer**, **Bewertung** und **Hilfe**. Jeden Schritt kannst du überspringen — dann gilt die Vorbelegung.',
        belege: [[J('onboarding.js'), 'Wie soll DealPilot aussehen?'], [J('onboarding.js'), 'Dein Anlegerprofil — womit sollen wir rechnen?'], [J('onboarding.js'), 'Möchtest du Hilfe beim Start?']] },
      { t: 'Später erreichst du alles über die Seitenleiste: **Aktionen** → unter „System“ **Einstellungen**.',
        belege: [[IX, '<span class="sb-actions-l">Aktionen</span>'], [IX, '<div class="sb-act-section-title">System</div>'], [IX, "sbActionsAction('settings')"]] },
      { t: 'Reiter **Standardwerte**, ganz oben **Dein Anlegerprofil**: wähle **Ausgewogen**, **Vorsichtig** oder **Renditeorientiert**. Das Profil setzt Tilgung, Eigenkapital, Mietausfall, Mindest-DSCR, den Abschlag auf Angebotspreise und die Gewichte des Deal Scores.',
        belege: [[J('settings.js'), "standardwerte:['Standardwerte'"], [J('standardwerte-karten.js'), 'Dein Anlegerprofil'], [J('standardwerte-karten.js'), 'Dein Anlegerprofil setzt Tilgung, Eigenkapital, Mietausfall, Mindest-DSCR, den Abschlag auf Angebotspreise und die Gewichte des Deal Scores.'], [J('standardwerte-karten.js'), "'Renditeorientiert'"]] },
      { t: 'Darunter unter **Lageklassen A · B · C** je Klasse die Zielrendite (% brutto) eintragen und bei **Standard für neue Quick-Checks** die Klasse wählen, die im Quick-Check vorausgewählt sein soll.',
        belege: [[J('investment-profile.js'), 'Lageklassen A · B · C'], [J('investment-profile.js'), 'Standard für neue Quick-Checks']] },
      { t: 'Mit **Profil speichern** sichern. Die Gewichte des Scores gelten sofort; **Auf Defaults zurücksetzen** stellt die Vorgaben wieder her.',
        belege: [[J('investment-profile.js'), '>Profil speichern<'], [J('investment-profile.js'), '>Auf Defaults zurücksetzen<'], [J('standardwerte-karten.js'), 'die Score-Gewichte gelten sofort']] },
      { t: 'Reiter **Kontakt & Logo**: Kontaktdaten eintragen und über **Logo hochladen** dein Logo setzen — es steht dann im Kopf deiner PDFs.',
        belege: [[J('settings.js'), "contact:['Kontakt & Logo'"], [J('settings.js'), 'Logo hochladen']] },
      { t: 'Reiter **Mandanten**: festlegen, wer Objekte hält (Privat oder eine Gesellschaft), und dort die Steuerzeiträume pflegen (siehe Ablauf „Steuer“).',
        belege: [[J('settings.js'), "mandanten:['Mandanten','Gesellschaften, Halter und Steuerregime verwalten.']"]] },
      { t: 'Reiter **Plan**: hier siehst du dein Abo und dein Kontingent — wie viele Marktberichte je Stufe in diesem Monat noch frei sind.',
        belege: [[J('settings.js'), "plan:['Plan','Dein aktueller Tarif und dein Bewertungs-Kontingent.']"]] }
    ],
    hinweis: 'Unten im Einstellungsfenster steht „Auto-Save aktiv · Änderungen werden direkt übernommen“ — die meisten Felder speichern sich sofort.'
  },
  {
    id: 'quickcheck',
    titel: 'Erstes Objekt: Quick-Check und „Als Objekt speichern“',
    kurz: 'Ein Inserat in einer Minute einordnen — und wenn es sich lohnt, mit einem Klick als Objekt anlegen.',
    schritte: [
      { t: 'Seitenleiste: **Aktionen** → unter „Anlegen“ **Quick Boarding**. Der Quick-Check öffnet sich im Inhaltsbereich.',
        belege: [[IX, '<div class="sb-act-section-title">Anlegen</div>'], [IX, "sbActionsAction('quickcheck')"], [IX, '<span class="sb-act-l">Quick Boarding</span>']] },
      { t: 'Die Pflichtfelder ausfüllen: Straße, PLZ, Ort, Wohnfläche, Kaufpreis, Nettokaltmiete, Hausgeld, den nicht umlagefähigen Anteil, Eigenkapital, Zins und Tilgung. Die Hausnummer ist freiwillig. Solange etwas fehlt, bleibt das Speichern gesperrt.',
        belege: [[QC, 'Pflichtfelder aus, um das Objekt speichern zu können']] },
      { t: 'Optional Daten holen: in der Leiste **QUICKBOARDING PASS** Kacheln anklicken — **DealPilot** (Marktbewertung: Marktwert, Marktmiete, Lage), **Exposé / Marktbericht** (PDF auslesen), **Sprachaufzeichnung** (Objekt frei einsprechen) — und **Abrufen** drücken.',
        kosten: 'Die DealPilot-Marktbewertung verbraucht 1 Bewertung aus deinem Kontingent. Vorher fragt DealPilot im Fenster „Abruf bestätigen“ nach.',
        belege: [[QC, 'QUICKBOARDING PASS'], [QC, 'Exposé / Marktbericht'], [QC, 'Sprachaufzeichnung'], [QC, 'onclick="QcApp.openCreditModal()"'], [QC, 'Abruf bestätigen'], [J('object-actions.js'), "dealpilot:    '1 Bewertung'"]] },
      { t: 'Ergebnis lesen: **QUICK CHECK SCORE** mit Kennzahlen, die Bewertung und die **Verhandlungs-Empfehlung** mit Zielkaufpreis.',
        belege: [[QC, 'QUICK CHECK SCORE'], [QC, 'Verhandlungs-Empfehlung']] },
      { t: 'Passt das Objekt: **Als Objekt speichern** klicken.',
        belege: [[QC, 'Als Objekt speichern']] },
      { t: 'Im Fenster **Diese Daten werden übernommen** zeigt der Reiter **Übernahme** die Werte der Marktbewertung — unter **Spanne** wählst du Unten, Ø oder Oben. Der Reiter **Ausgelesene Daten** zeigt alles aus dem Quick-Check. Haken entfernen, was nicht mit soll, oder **Alle übernehmen**.',
        belege: [[J('qc-bridge.js'), 'Diese Daten werden übernommen'], [J('qc-bridge.js'), 'Ausgelesene Daten'], [J('qc-bridge.js'), '<span class="qcpm-cl">Spanne</span>'], [J('qc-bridge.js'), 'Alle übernehmen']] },
      { t: '**Speichern & übernehmen** — DealPilot legt ein neues Objekt an; ein geöffnetes Objekt wird nicht überschrieben.',
        belege: [[J('qc-bridge.js'), 'Speichern & übernehmen']] },
      { t: 'Ohne Quick-Check geht es auch: **Aktionen** → **Neues Objekt** (oder **Neues Objekt hinzufügen** oben in der Objektliste) legt ein leeres Objekt an.',
        belege: [[IX, "sbActionsAction('new')"], [IX, '<span class="sb-act-l">Neues Objekt</span>'], [J('storage.js'), 'Neues Objekt hinzufügen']] }
    ],
    hinweis: 'Nach der Marktbewertung trägt DealPilot die Marktmiete als Grundmiete ein. Willst du mit der Ist-Miete rechnen, trag sie danach wieder ein.'
  },
  {
    id: 'import',
    titel: 'Exposé oder PDF einlesen',
    kurz: 'Statt abzutippen: Exposé, Marktbericht oder andere PDFs lesen lassen und die Werte gezielt übernehmen.',
    schritte: [
      { t: 'Das Objekt öffnen. In der Leiste oben im Objekt („Daten einlesen“ bzw. „Daten übernehmen aus“) die Kachel **Exposé / Marktbericht** wählen und **Abrufen** drücken.',
        belege: [[J('object-actions.js'), '<span class="k-heute">Daten einlesen</span>'], [J('object-actions.js'), "pfTileTool('import', _doc, 'Exposé / Marktbericht'"]] },
      { t: 'Im Fenster **PDFs einlesen — Exposé, Marktbericht, Dokumente** die Dateien auswählen oder hineinziehen. Mehrere PDFs auf einmal gehen, bis 100 MB je Datei.',
        belege: [[J('object-actions.js'), 'PDFs einlesen — Exposé, Marktbericht, Dokumente'], [J('object-actions.js'), 'mehrere Dateien möglich · max 100 MB je Datei']] },
      { t: 'DealPilot erkennt den Typ jeder Datei (auch gescannte PDFs); du kannst ihn je Datei umstellen. Alle Werte werden zusammengeführt — widersprechen sich zwei Dateien, führt der Marktbericht.',
        belege: [[J('object-actions.js'), 'Typ wird automatisch erkannt (inkl. OCR bei Scan-/Grafik-PDFs) und ist pro Datei umstellbar'], [J('object-actions.js'), 'Marktbericht führt bei Konflikt']] },
      { t: 'Liste prüfen: Weicht ein gelesener Wert von dem ab, was schon im Objekt steht, ist die Zeile markiert und nicht vorgehakt. Gefundene Bilder lassen sich in die Objektfotos übernehmen.',
        belege: [[J('object-actions.js'), "' class=\"oabi-abw\"'"], [J('object-actions.js'), 'in Objektfotos übernehmen']] },
      { t: '**Ausgewählte übernehmen** — die angehakten Werte stehen in den Feldern.',
        belege: [[J('object-actions.js'), 'Ausgewählte übernehmen']] },
      { t: 'Für andere Dokumente: **Aktionen** → **Import**. Dort liest **Dokument einlesen** z. B. Grundbuch, Gutachten oder Kaufvertrag; **Excel-Kalkulation importieren** übernimmt eine Excel-Kalkulation ins geöffnete Objekt (bestehende Eingaben werden überschrieben); **JSON-Backup importieren** stellt eine Sicherung wieder her.',
        belege: [[IX, "sbActionsAction('hub-import')"], [J('import-export-modal.js'), '<h3>Dokument einlesen'], [J('import-export-modal.js'), '<h3>Excel-Kalkulation importieren'], [J('import-export-modal.js'), 'Bestehende Eingaben im aktuellen Objekt werden überschrieben'], [J('import-export-modal.js'), '<h3>JSON-Backup importieren']] }
    ],
    hinweis: 'Aus fremden Gutachten übernimmt DealPilot nur die Eingaben, nie deren Ergebnis — gerechnet wird in DealPilot.'
  },
  {
    id: 'erfassen',
    titel: 'Ein Objekt vollständig erfassen — die Reiter der Reihe nach',
    kurz: 'Der Weg durch die Datenaufnahme, vom Groben zum Feinen. Was in jedes einzelne Feld gehört, steht in den Kapiteln Eigentumswohnung, Einfamilienhaus und Mehrfamilienhaus.',
    schritte: [
      { t: 'Das Objekt in der Objektliste anklicken. Änderungen speichert DealPilot automatisch.',
        belege: [[J('tour-content.js'), 'werden automatisch gespeichert']] },
      { t: 'Reiter **Objekt**: oben die **Eingabetiefe** wählen (Pillen 1 · 2 · 3 — Einfach, Mittel, Ausgiebig). Sie bestimmt, welche Felder für den Marktbericht Pflicht sind. Den Haken **weitere Objektdetails angeben** setzen, wenn du alle Felder sehen willst. Dann Adresse, Objektart, Wohnfläche und Baujahr eintragen.',
        belege: [[IX, '<span class="tab-lbl">Objekt</span>'], [IX, '<span class="oe-ziel-lbl">Eingabetiefe</span>'], [IX, 'weitere Objektdetails angeben'], [J('objekt-reiter.js'), "name: 'Einfach · Stufe 1'"]] },
      { t: 'Beim Mehrfamilienhaus die Wohnungen erfassen — die **Wohnungsliste** mit ihren Schritten steht im Kapitel Mehrfamilienhaus.',
        belege: [[J('mfh-einheiten.js'), 'var SCHRITTE = [']] },
      { t: 'Reiter **Investition**: Kaufpreis und Kaufnebenkosten (Makler, Notar, Grundbuchamt, Grunderwerbsteuer), dazu Sanierung und Inventar, wenn es sie gibt.',
        belege: [[IX, '<span class="tab-lbl">Investition</span>']] },
      { t: 'Reiter **Miete**: Nettokaltmiete pro Monat, zusätzliche Einnahmen und die Angaben zum Mietvertrag.',
        belege: [[IX, '<span class="tab-lbl">Miete</span>']] },
      { t: 'Reiter **Finanzierung**: Darlehen, Zinsbindung und Anschlussfinanzierung (eigener Ablauf weiter unten).',
        belege: [[IX, '<span class="tab-lbl">Finanzierung</span>']] },
      { t: 'Reiter **Bewirtschaftung**: entweder schnell als Prozent der Nettokaltmiete oder als einzelne Kosten pro Jahr. Leere Felder füllt DealPilot aus deinen Standardwerten je Objektart.',
        belege: [[IX, '<span class="tab-lbl">Bewirtschaftung</span>']] },
      { t: 'Reiter **Steuer**: Einkommen und AfA (eigener Ablauf weiter unten).',
        belege: [[IX, '<span class="tab-lbl">Steuer</span>']] },
      { t: 'Kontrolle: rechts in der Reiterleiste zeigt die Anzeige „… / 6 · … %“, wie weit die Datenaufnahme ist. Danach die Ergebnisse ansehen: Reiter **Bewertung** (Kennzahlen), **Pilot-Analyse** und **Deal-Aktion**.',
        belege: [[IX, 'title="Workflow-Fortschritt"'], [IX, '<span class="tab-lbl">Bewertung</span>'], [IX, '<span class="tab-lbl">Pilot-Analyse</span>'], [IX, '<span class="tab-lbl">Deal-Aktion</span>']] }
    ],
    bilder: [{ datei: 'hb-etw-s0-1.webp', unter: 'Reiter Objekt, Objektdaten — die Nummern gehören zur Feldliste im Kapitel Eigentumswohnung' }],
    siehe: [['#k-ETW', 'Kapitel Eigentumswohnung'], ['#k-EFH', 'Kapitel Einfamilienhaus'], ['#k-MFH', 'Kapitel Mehrfamilienhaus'], ['#s-MFH-wohnungen', 'Wohnungsliste']]
  },
  {
    id: 'finanzierung',
    titel: 'Finanzierung und Anschlussfinanzierung eintragen',
    kurz: 'Das Darlehen so erfassen, wie es im Vertrag oder Angebot steht — und festlegen, womit nach der Zinsbindung gerechnet wird.',
    schritte: [
      { t: 'Reiter **Finanzierung**, Karte **Darlehen I – Hauptdarlehen**.',
        belege: [[IX, 'Darlehen I – Hauptdarlehen']] },
      { t: '**Art des Darlehens** wählen: **Annuitätendarlehen** oder **Tilgungsaussetzungsdarlehen (mit Bausparvertrag)**. Bei der Tilgungsaussetzung erscheint zusätzlich die Karte für den Bausparvertrag.',
        belege: [[IX, '<label>Art des Darlehens'], [IX, 'Tilgungsaussetzungsdarlehen (mit Bausparvertrag)'], [IX, 'Bausparvertrag']] },
      { t: 'Eigenkapital, Darlehenssumme, **Zinssatz nominal (% p.a.)**, **Tilgung (% p.a.)** und **Zinsbindung (Jahre)** eintragen. Rate, Restschuld am Ende der Zinsbindung und das Ende der Bindung rechnet DealPilot selbst.',
        belege: [[IX, 'Zinssatz nominal (% p.a.)'], [IX, 'Tilgung (% p.a.)'], [IX, 'Zinsbindung (Jahre)'], [IX, 'Restschuld Ende Zinsbindung']] },
      { t: 'Liegt der Darlehensvertrag als PDF vor: **Daten aus Bank-PDF importieren** — die Werte werden aus dem Vertrag übernommen.',
        belege: [[IX, 'Daten aus Bank-PDF importieren'], [IX, 'Bankvertrag scannen — Werte werden automatisch übernommen']] },
      { t: 'Anschlussfinanzierung: den Haken **Eigene Anschlussfinanzierung für Darlehen 1** setzen und **Zinssatz Anschluss (%)** sowie **Tilgung Anschluss (%)** eintragen. Ohne Haken läuft das Darlehen nach der Bindung zu den heutigen Konditionen weiter.',
        belege: [[IX, 'Eigene Anschlussfinanzierung für Darlehen 1'], [IX, 'Zinssatz Anschluss (%)'], [IX, 'Tilgung Anschluss (%)'], [J('help.js'), 'Ohne Haken läuft das Darlehen zu den heutigen Konditionen weiter']] },
      { t: 'Ein zweites Darlehen (z. B. Förderdarlehen): in der Karte **Darlehen II – Zusatzdarlehen** auf **Hinzufügen** — es hat seine eigene Anschlussfinanzierung.',
        belege: [[IX, 'Darlehen II – Zusatzdarlehen'], [IX, '<span>Hinzufügen</span>'], [IX, 'Eigene Anschlussfinanzierung für Darlehen 2']] },
      { t: 'Wirkung prüfen: Die Mehrbelastung nach der Zinsbindung (Zinsänderungsrisiko) steht im Reiter **Bewertung**.',
        belege: [[J('help.js'), 'Es steht im Reiter <strong>Bewertung</strong> und im Bankgespräch']] }
    ],
    bilder: [
      { datei: 'hb-etw-s3-2.webp', unter: 'Zinsbindung, Bank-PDF-Import und der Haken für die Anschlussfinanzierung' },
      { datei: 'hb-etw-s3-x1.webp', unter: 'Nach dem Haken: die Felder der Anschlussfinanzierung' }
    ],
    siehe: [['#s-ETW-s3', 'Reiter Finanzierung, Feld für Feld']]
  },
  {
    id: 'rnd',
    titel: 'Restnutzungsdauer mit dem Assistenten ermitteln',
    kurz: 'Ist das Gebäude kürzer nutzbar als die Regel-AfA annimmt, ist ein höherer AfA-Satz möglich. Der Assistent ermittelt die Restnutzungsdauer und setzt den Satz.',
    schritte: [
      { t: 'Reiter **Steuer**, Karte **AfA-Konfiguration**, Feld **AfA-Satz**: den Eintrag **Eigenen Satz / Restnutzungsdauer eingeben …** wählen.',
        belege: [[IX, 'AfA-Konfiguration'], [J('afa-eigen.js'), 'Eigenen Satz / Restnutzungsdauer eingeben …']] },
      { t: 'Auf **Restnutzungsdauer ermitteln** klicken. Der Assistent hat neun Schritte: Objekt-Basis · Auftraggeber & Stichtag · Bauliche Anlagen · Gebäudetechnik · Modernisierungen · Zustand der Gewerke · Schäden & Mängel · Sachverständiger · Ergebnis & Empfehlung. Was im Objekt schon steht, ist vorausgefüllt.',
        belege: [[J('afa-eigen.js'), '>Restnutzungsdauer ermitteln<'], [J('rnd-wizard.js'), "title: 'Objekt-Basis'"], [J('rnd-wizard.js'), "title: 'Schäden & Mängel'"], [J('rnd-wizard.js'), "title: 'Ergebnis & Empfehlung'"], [J('deal-action.js'), 'var prefill = _getRndPrefill();']] },
      { t: 'Mit **Weiter →** durch die Schritte; in Schritt 8 heißt der Knopf **Berechnen →**.',
        belege: [[J('rnd-wizard.js'), "'Weiter →'"], [J('rnd-wizard.js'), "'Berechnen →'"]] },
      { t: 'Im Ergebnis **Restnutzungsdauer … Jahre übernehmen** klicken: DealPilot setzt den eigenen AfA-Satz (100 ÷ Restnutzungsdauer) und zeigt die Steuerwirkung vorher und nachher. Ist die Übernahme gesperrt, braucht der Fall erst eine sachverständige Beurteilung.',
        belege: [[J('rnd-wizard.js'), ' Jahre übernehmen'], [J('rnd-wizard.js'), 'Übernahme gesperrt — erst nach sachverständiger Beurteilung'], [J('afa-eigen.js'), 'Eine eingetragene Restnutzungsdauer ergibt den Satz: 100 ÷ RND.']] },
      { t: 'Für den Nachweis beim Finanzamt: **✉ Anfrage senden →** schickt die Angaben als Anfrage für ein Gutachten an einen Sachverständigen.',
        kosten: 'Das Gutachten selbst ist eine eigene, kostenpflichtige Leistung des Sachverständigen — DealPilot zeigt die Gutachterkosten im Reiter Deal-Aktion neben der Steuerersparnis.',
        belege: [[J('rnd-wizard.js'), "'✉ Anfrage senden →'"], [J('deal-action.js'), 'GUTACHTER-KOSTEN']] },
      { t: 'Später genügt **Letzte Ermittlung übernehmen**: Restnutzungsdauer und Satz werden eingesetzt, unter **Grundlage** steht „RND-Ermittlung DealPilot (indikativ)“. Das Finanzamt verlangt für einen eigenen Satz einen Nachweis (Gutachten).',
        belege: [[J('afa-eigen.js'), 'Letzte Ermittlung übernehmen'], [J('afa-eigen.js'), 'RND-Ermittlung DealPilot (indikativ)'], [J('afa-eigen.js'), 'Das Finanzamt verlangt dafür einen Nachweis (Gutachten).']] }
    ],
    bilder: [{ datei: 'hb-etw-s3-tax-1.webp', unter: 'Reiter Steuer — Feld AfA-Satz in der Karte AfA-Konfiguration' }],
    hinweis: 'Der Assistent dient der Steuer. Für den Marktbericht rechnet DealPilot die Restnutzungsdauer aus den Modernisierungen im Reiter Objekt (Modernisierungsgrad nach Anlage 2 ImmoWertV).',
    siehe: [['#s-ETW-s3-tax', 'Reiter Steuer, Feld für Feld']]
  },
  {
    id: 'marktbericht',
    titel: 'Marktbericht und Potenzial abrufen und lesen',
    kurz: 'Den Wert des Objekts einordnen lassen — von der schnellen Marktpreisindikation bis zur Wertermittlung nach ImmoWertV — und sehen, was nach Mieterhöhung oder Umbau drin ist.',
    schritte: [
      { t: 'Reiter **Objekt**, oben die **Eingabetiefe** wählen: **Einfach · Stufe 1** (Marktpreisindikation), **Mittel · Stufe 2** (erweiterte Indikation, ab Plan Investor) oder **Ausgiebig · Stufe 3** (Wertermittlung nach ImmoWertV mit Boden-, Ertrags- und Sachwert, ab Plan Pro).',
        plan: 'Stufe 2 ab Investor, Stufe 3 ab Pro',
        belege: [[J('objekt-reiter.js'), "name: 'Einfach · Stufe 1'"], [J('objekt-reiter.js'), "name: 'Mittel · Stufe 2'"], [J('objekt-reiter.js'), "name: 'Ausgiebig · Stufe 3'"], [J('objekt-reiter.js'), "var ab = { 2: 'ab Investor', 3: 'ab Pro' };"]] },
      { t: 'In der Box **Marktbericht abrufen** steht je Stufe, wie viele Berichte noch frei sind. Heißt der Knopf **was fehlt**, zeigt ein Klick die fehlenden Felder — ausfüllen, bis dort **abrufen** steht. Der Bericht rechnet nie halb.',
        belege: [[IX, 'Marktbericht abrufen'], [J('objekt-reiter.js'), "(fehlt ? 'was fehlt' : 'abrufen')"], [J('objekt-reiter.js'), "r + ' frei'"]] },
      { t: '**abrufen** klicken und bestätigen.',
        kosten: 'Jeder Abruf verbraucht 1 Bewertung aus dem Kontingent seiner Stufe. Eine schon bezahlte Tiefe kostet beim erneuten Abruf nichts.',
        belege: [[J('object-actions.js'), 'Für diesen Abruf wird dein Kontingent belastet:'], [J('help.js'), 'eine schon bezahlte Tiefe kostet beim erneuten Abruf nichts']] },
      { t: 'Ein Fenster zeigt die Etappen. Mit **Im Hintergrund weiter** arbeitest du normal weiter; ist der Bericht fertig, wird die Pille unten zu „✓ Marktbericht fertig · … — öffnen“.',
        belege: [[J('mb-auftrag.js'), 'Im Hintergrund weiter'], [J('mb-auftrag.js'), 'Marktbericht fertig · ']] },
      { t: 'Lesen: **Im Marktbericht öffnen →** (oder **Aktionen** → **Marktbericht**). In Stufe 3 trägt jede amtliche Zahl ihre Herkunftsstufe (A bis E und N), und der Quellennachweis nennt die Gutachterausschüsse, deren Zahlen im Bericht stecken.',
        belege: [[IX, 'Im Marktbericht öffnen →'], [IX, "sbActionsAction('marktbericht')"]] },
      { t: 'Verkehrswert übernehmen: Reiter **Objekt**, Karte **Wertanker**, unter dem Feld Verkehrswert einen Eintrag aus dem Verlauf wählen und **als Verkehrswert übernehmen** klicken. Welche Zahl gilt, entscheidest du.',
        belege: [[IX, 'Wertanker'], [J('objekt-reiter.js'), 'als Verkehrswert übernehmen']] },
      { t: 'Alte Berichte: Reiter **Deal-Aktion**, Abschnitt **Marktberichte** („Erzeugte Berichte als PDF“) — neueste zuerst, als PDF ladbar.',
        belege: [[J('deal-action-boarding.js'), "band('doc', 'Marktberichte', 'Erzeugte Berichte als PDF')"]] },
      { t: 'Potenzial: im Reiter **Objekt** die Karte **Mieterhöhung und Zielbild (optional)** ausfüllen (beim Mehrfamilienhaus je Wohnung in der Wohnungsliste). DealPilot rechnet Soll-Miete und Zielbild mit demselben Kern wie Stufe 3 — ohne Kontingent. Das Ergebnis steht in der Pilot-Analyse unter **Ankauf · Bestand · Zielbild** und in den PDFs.',
        belege: [[IX, 'Mieterhöhung und Zielbild'], [IX, 'Ankauf &middot; Bestand &middot; Zielbild'], [J('help.js'), 'je Stufe wechseln nur Miete und Restnutzungsdauer. Kein Kontingent.']] },
      { t: 'Marktpreise zum Potenzial: Reiter **Pilot-Analyse**, Bereich „Ankauf · Bestand · Zielbild“ → **Marktpreise abrufen** → **Ja, abrufen**.',
        kosten: 'Kostet 1 × erweiterte Marktpreisindikation aus deinem Kontingent; DealPilot fragt vorher nach.',
        belege: [[J('potenzial.js'), 'Marktpreise abrufen'], [J('potenzial.js'), 'Kostet 1 × erweiterte Marktpreisindikation'], [J('potenzial.js'), 'Ja, abrufen']] }
    ],
    hinweis: 'Der Marktbericht ist eine Marktpreisindikation, ausdrücklich kein Gutachten nach § 194 BauGB. Fehlt ein amtlicher Wert, nennt der Bericht den zuständigen Gutachterausschuss und den Weg zur Quelle.',
    siehe: [['#k-ETW', 'Pflichtfelder je Stufe (Steckbrief jedes Kapitels)']]
  },
  {
    id: 'pilot',
    titel: 'Pilot-Analyse abrufen und als PDF ausgeben',
    kurz: 'Die KI-Einschätzung zum Objekt holen und mit genau den Bausteinen ins PDF bringen, die du zeigen willst.',
    schritte: [
      { t: 'Reiter **Pilot-Analyse** → **Pilot-Analyse starten**. Sie ist in deinem Plan enthalten und verbraucht kein Kontingent.',
        belege: [[IX, '<span>Pilot-Analyse starten</span>'], [J('help.js'), 'Die Pilot-Analyse ist in deinem Plan enthalten und verbraucht kein Kontingent.']] },
      { t: 'Die Analyse wird beim Objekt gespeichert. Für eine frische Einschätzung (etwa nach geänderten Zahlen) einfach erneut starten.',
        belege: [[J('help.js'), 'Die Pilot-Analyse wird beim Objekt gespeichert.']] },
      { t: 'Fürs PDF: den Schalter **Pilot-Analyse im PDF-Export einschließen** setzen, dann **Bausteine im PDF** aufklappen und die Haken setzen oder entfernen — z. B. Gesamtbewertung, Stärken, Risiken, Verhandlungsempfehlung, Bankargumente, Ankauf · Bestand · Zielbild, Steuerliche Zusammenfassung.',
        belege: [[IX, 'Pilot-Analyse im PDF-Export einschließen'], [IX, 'Bausteine im PDF'], [IX, 'id="ai-pdf-sec-gesamt"'], [IX, 'id="ai-pdf-sec-steuer"']] },
      { t: 'Tipp: einmal kurz den Reiter **Bewertung** öffnen — dann sind alle Grafiken gezeichnet.',
        belege: [[J('help.js'), 'Öffne vorher einmal kurz den Reiter <strong>Bewertung</strong>']] },
      { t: 'Reiter **Deal-Aktion** → **PDFs herunterladen** → beim **Investment-PDF** auf **PDF**.',
        belege: [[J('deal-action-boarding.js'), 'PDFs herunterladen'], [J('deal-action-boarding.js'), "DealActionBoarding.exportDoc(\\''"]] },
      { t: 'Fassung wählen: **Bankfassung**, **Investment-PDF · hell** oder **Investment-PDF · Obsidian**. Mit **Diese Wahl merken** fragt DealPilot nicht mehr — zurück zur Auswahl kommst du über den Knopf **Fassung** neben „PDF“.',
        belege: [[J('pdf-wahl.js'), "titel: 'Bankfassung'"], [J('pdf-wahl.js'), "titel: 'Investment-PDF · hell'"], [J('pdf-wahl.js'), "titel: 'Investment-PDF · Obsidian'"], [J('pdf-wahl.js'), 'Diese Wahl merken'], [J('deal-action-boarding.js'), '>Fassung</button>']] },
      { t: 'Derselbe Bericht geht auch über **Aktionen** → **Export** → **PDF-Report für Objekt**.',
        belege: [[IX, "sbActionsAction('hub-export')"], [J('import-export-modal.js'), 'PDF-Report für Objekt']] }
    ],
    hinweis: 'Im Free-Plan trägt jedes PDF ein Wasserzeichen.'
  },
  {
    id: 'bank',
    titel: 'Unterlagen für die Bank: Bank-PDF und Bankexport',
    kurz: 'Das Objekt bankfertig machen, die Bankfassung des PDFs erzeugen und die Darlehen aller Objekte als Liste ausgeben.',
    schritte: [
      { t: 'Reiter **Deal-Aktion**, Abschnitt **Bereit für die Bank?**: dort steht „… Grundfelder befüllt“; jedes fehlende Feld ist aufgeführt und führt per Klick zum Eingabefeld.',
        belege: [[J('deal-action-boarding.js'), 'Bereit für die Bank?'], [J('deal-action-boarding.js'), 'Grundfelder befüllt']] },
      { t: 'Unter **PDFs herunterladen** beim **Investment-PDF** auf **PDF** und die Fassung **Bankfassung** wählen — weißes Papier, Kennzahlen als Tabelle, für Bank, Finanzierung und Steuerberater.',
        belege: [[J('pdf-wahl.js'), "unter: 'Weisses Papier, Kennzahlen als Tabelle'"], [J('pdf-wahl.js'), "fuer: 'Bank · Finanzierung · Steuerberater'"]] },
      { t: 'Abschnitt **Bordkarte & Unterlagen**: die Listen „Persönliche Unterlagen“ und „Objekt-Unterlagen“ zeigen, was die Bank üblicherweise sehen will. **Unterlagen beim Amt anfordern** ermittelt die zuständige Stelle und schreibt den Antrag.',
        kosten: 'Die Ämter erheben für Auszüge und Akten ihre eigenen Gebühren.',
        belege: [[J('deal-action-boarding.js'), "band('doc2', 'Bordkarte &amp; Unterlagen'"], [J('deal-action-boarding.js'), 'Persönliche Unterlagen'], [J('deal-action-boarding.js'), 'Unterlagen beim Amt anfordern'], [J('deal-action-boarding.js'), 'die zuständige Stelle und schreibt den Antrag']] },
      { t: 'Alle Darlehen aller Objekte als Liste: Seitenleiste **Aktionen** → unter „Ausgeben“ **Bankexport**. Einzelne Darlehen per Häkchen abwählen, dann **CSV exportieren**, **Excel exportieren** oder **PDF erstellen**.',
        plan: 'je nach Plan freigeschaltet',
        belege: [[IX, "sbActionsAction('bankexport')"], [IX, 'data-feature="bank_pdf_a3"'], [J('storage.js'), 'CSV exportieren'], [J('storage.js'), 'Excel exportieren'], [J('storage.js'), "'PDF erstellen"]] },
      { t: 'Als Nachweis deiner Erfahrung: **Aktionen** → **Track Record** — gewonnene Deals als Einzel- oder Sammel-PDF.',
        belege: [[IX, "sbActionsAction('trackrec')"], [IX, '<span class="sb-act-l">Track Record</span>']] }
    ],
    siehe: [['#k-ETW', 'Felder, die in den Bank-PDFs stehen (Feldlisten, „Was es bewirkt“)']]
  },
  {
    id: 'steuer',
    titel: 'Steuer: Einkommen, Steuerzeiträume und BMF-Kaufpreisaufteilung',
    kurz: 'Die Steuerwirkung des Objekts richtig rechnen lassen: dein Einkommen über die Jahre, der Gebäudeanteil und die Werbungskosten bis zum Finanzamt-PDF.',
    schritte: [
      { t: 'Reiter **Steuer**, Karte **Persönliche Steuer**: dein zu versteuerndes Einkommen (zvE) vor der Immobilie eintragen. Mit dem Haken **Grenzsteuersatz automatisch aus zvE berechnen** rechnet DealPilot den Satz selbst.',
        belege: [[IX, 'Persönliche Steuer'], [IX, 'Zu versteuerndes Einkommen (zvE) vor Immobilie / Jahr'], [IX, 'Grenzsteuersatz automatisch aus zvE berechnen']] },
      { t: 'Ändert sich dein Einkommen über die Jahre: **Steuerzeiträume verwalten →**. Unter **Neuen Zeitraum hinzufügen** **Gültig von**, **Gültig bis (leer = laufend)**, **zvE / Jahr (€)** und einen **Grund** eintragen, dann **Hinzufügen**. Überschneidet sich ein Zeitraum, zeigt DealPilot den Konflikt — du kannst abbrechen oder **Trotzdem als neuen Zeitraum anlegen**.',
        belege: [[IX, 'Steuerzeiträume verwalten →</a>'], [J('tax-periods.js'), 'Neuen Zeitraum hinzufügen'], [J('tax-periods.js'), 'Gültig bis (leer = laufend)'], [J('tax-periods.js'), 'zvE / Jahr (€)'], [J('tax-periods.js'), 'Trotzdem als neuen Zeitraum anlegen']] },
      { t: 'Karte **AfA-Konfiguration**: **AfA-Satz** und **Gebäudeanteil am KP (%)** prüfen. Für einen genaueren Gebäudeanteil rechts in der Karte den Knopf **BMF-Rechner** öffnen (nicht den Link unter „Hilfreiche Links“).',
        plan: 'BMF-Rechner ab Pro',
        belege: [[IX, 'Gebäudeanteil am KP (%)'], [IX, 'id="btnBmfAdvanced"'], [IX, 'onclick="openBMFModal()"'], [IX, 'plan-badge plan-badge-gold']] },
      { t: 'Im Fenster **Anschaffungskosten & BMF-Kaufpreisaufteilung** die vier Reiter der Reihe nach: **1 Anschaffungskosten** · **2 BMF-Aufteilung** · **3 AfA-Vorschau** · **4 AfA-Hebel**, jeweils mit **Weiter →**. Die Reiter 2 bis 4 öffnen erst, wenn die Pflichtangaben vollständig sind.',
        belege: [[J('bmf-modal-html.html'), 'Anschaffungskosten &amp; BMF-Kaufpreisaufteilung'], [J('bmf-modal-html.html'), "switchPane('p-hebel')"], [J('bmf-modal.js'), "'p-hebel': '<b>Schritt 4 / 4:</b>"], [J('bmf-modal-html.html'), 'Weiter →']] },
      { t: 'Im Reiter 4 eine Variante per Klick wählen und **✓ Übernehmen** — Gebäudeanteil und AfA-Satz stehen danach im Reiter Steuer. Ausgabe: **Kaufpreisaufteilung als PDF** oder **BMF-Arbeitshilfe als PDF**.',
        belege: [[J('bmf-modal-html.html'), '✓ Übernehmen'], [J('bmf-modal.js'), 'Kaufpreisaufteilung als PDF'], [J('bmf-modal.js'), 'BMF-Arbeitshilfe als PDF']] },
      { t: 'Werbungskosten je Jahr: Karte **Steuerformular pro Jahr · individuelle Werte**. DealPilot schlägt Werte vor; du überschreibst sie, etwa mit den Zahlen aus dem Bescheid. Belege liest **Belege & Abrechnungen einlesen (KI)**.',
        belege: [[IX, 'Steuerformular pro Jahr · individuelle Werte'], [IX, 'Belege &amp; Abrechnungen einlesen (KI)']] },
      { t: 'Finanzamt-PDF: unter **Steuerjahr** ein Jahr wählen, optional **Anlage V** anhaken und **Finanzamt-PDF** klicken. Dasselbe PDF gibt es im Reiter Deal-Aktion unter „PDFs herunterladen“.',
        belege: [[IX, '>Steuerjahr<'], [IX, 'id="fa-pdf-anlagev"'], [IX, 'title="Finanzamt-PDF für das gewählte Steuerjahr erzeugen'], [J('deal-action-boarding.js'), 'Finanzamt-PDF (Steuerformular)']] }
    ],
    bilder: [{ datei: 'hb-etw-s3-tax-1.webp', unter: 'Reiter Steuer: Persönliche Steuer mit „Steuerzeiträume verwalten“, AfA-Konfiguration mit dem Knopf BMF-Rechner' }],
    hinweis: 'DealPilot ist keine Steuerberatung (§ 6 StBerG). Die Rechnungen sind Hilfsmittel — die finale Beurteilung gehört zu deinem Steuerberater.',
    siehe: [['#s-ETW-s3-tax', 'Reiter Steuer, Feld für Feld']]
  },
  {
    id: 'portfolio',
    titel: 'Vom Deal zum Portfolio',
    kurz: 'Ein gekauftes Objekt in den Bestand nehmen und alle Objekte zusammen im Portfolio-Cockpit steuern.',
    schritte: [
      { t: 'Im Reiter **Objekt** das Datum **Wirtsch. Übergang** (Nutzen-/Lastenwechsel) eintragen. Ohne dieses Datum friert DealPilot den Ankauf-Stand nicht ein.',
        belege: [[IX, 'Wirtsch. Übergang']] },
      { t: 'Reiter **Deal-Aktion**, Deal-Status **Gewonnen** wählen („Deal gewonnen — Objekt im Bestand“). DealPilot schreibt den Ankauf-Stand zu diesem Tag fest.',
        belege: [[J('deal-action-boarding.js'), "['won', 'Gewonnen', 'Abgeflogen', 'Deal gewonnen \\u2014 Objekt im Bestand']"]] },
      { t: 'Seitenleiste **Aktionen** → **Portfolio-Cockpit**.',
        belege: [[IX, "sbActionsAction('cockpit')"], [IX, '<span class="sb-act-l">Portfolio-Cockpit</span>']] },
      { t: 'Oben **Portfolio Score** und die Kennzahlen über alle gewonnenen Objekte. Weiter unten die Steuer über alle Objekte und die Projektion.',
        belege: [[J('dashboard.js'), 'Portfolio Score']] },
      { t: 'Steuer-Mappe fürs Finanzamt: **Veranlagungsjahr** wählen, optional **Anlage-V-Zuordnung anhängen**, dann **Steuer-Mappe erstellen** — ein PDF über alle Objekte mit Steuerdaten.',
        belege: [[J('dashboard.js'), 'Veranlagungsjahr'], [J('dashboard.js'), 'Anlage-V-Zuordnung anhängen'], [J('dashboard.js'), 'Steuer-Mappe erstellen']] }
    ],
    hinweis: 'Das Portfolio zählt nur Objekte mit Status Gewonnen. Verlorene Objekte bleiben mit allen Zahlen erhalten.'
  },
  /* v2965b · Marcel 26.10.2026: „Können wir auch beschreiben und erklären, wie Zielbilder angelegt werden?“
     Fakten aus potenzial.js, wert-zielbild.js, mfh-einheiten.js, dashboard.js — jede Zeile belegt. */
  {
    id: 'zielbild',
    titel: 'Mieterhöhung und Zielbild anlegen',
    kurz: 'Zeigen, was im Haus steckt: welche Miete der heutige Mieter nach normalen Erhöhungen zahlt (Soll-Miete), was nach Umbau oder Neuvermietung drin ist (Zielbild) — und was das am Ertragswert ausmacht.',
    wann: 'Freiwillig, für Objekte im Bestand oder im Ankauf. Ohne Angaben ändert sich nichts.',
    schritte: [
      { t: 'Das Objekt öffnen, Reiter **Objekt**, Karte **Mieterhöhung und Zielbild (optional)** aufklappen. Beim Mehrfamilienhaus weiter mit Schritt 7.',
        belege: [[IX, 'Mieterhöhung und Zielbild (optional)']] },
      { t: '**Vergleichsmiete (€/m²)** eintragen, wenn du den Mietspiegel kennst. Leer nimmt DealPilot die Marktmiete aus dem Reiter Miete.',
        belege: [[IX, 'Vergleichsmiete (€/m²)'], [IX, 'Leer: DealPilot nimmt die Marktmiete aus dem Tab Miete.']] },
      { t: '**Soll-Miete (Mieter bleibt, €/m²)** leer lassen: Darunter steht „DealPilot rechnet vor: …“ — bis zur Vergleichsmiete, frühestens 15 Monate nach der letzten Erhöhung, höchstens um die Kappungsgrenze. Eine eigene Zahl überschreibt den Vorschlag. **Soll erreichbar ab** ist ohne Angabe 15 Monate nach der letzten Erhöhung.',
        belege: [[IX, 'Soll-Miete (Mieter bleibt, €/m²)'], [J('potenzial.js'), 'DealPilot rechnet vor: '], [IX, 'Soll erreichbar ab']] },
      { t: 'Fürs Zielbild die **Zielmiete (€/m²)** eintragen — was nach Umbau oder Neuvermietung erzielbar ist — und unter **Zielbild ab wann** den Anlass (z. B. bei Mieterwechsel).',
        belege: [[IX, 'Zielmiete (€/m²)'], [IX, 'Zielbild ab wann']] },
      { t: 'Unter **Maßnahmen** die Chips anklicken (Bad, Fenster, Böden/Innenausbau, Grundriss, Elektrik, Dach, Fassade/Dämmung, Heizung, Leitungen, Renovierung, Küche, Sonstiges) und je Maßnahme die **Kosten €** eintragen. Der Chip zeigt, wie viele Modernisierungspunkte nach Anlage 2 ImmoWertV das Gewerk noch bringt; die Punkte verlängern die Restnutzungsdauer von Mieterhöhung und Zielbild.',
        belege: [[J('potenzial.js'), "t: 'Fassade/Dämmung'"], [J('potenzial.js'), '<span>Kosten €</span>'], [J('potenzial.js'), ' Modernisierungspunkte (Anlage 2)']] },
      { t: 'Wird mit Mieter in der Wohnung modernisiert, den Haken **bewohnt (§ 559)** setzen: 8 % der Kosten im Jahr kommen auf die Soll-Miete, gedeckelt. **Zielbild fertig (Jahr)** setzt das Jahr für Pilot-Analyse und PDF.',
        belege: [[J('potenzial.js'), 'bewohnt (§ 559)'], [IX, 'Zielbild fertig (Jahr)']] },
      { t: 'Mehrfamilienhaus: unter der Wohnfläche **Einheiten erfassen** öffnen, in der Liste bei jeder Wohnung **Details** — dort stehen Mietvertrag, Soll-Miete, **Zielbild · nach Umbau** mit den Maßnahmen der Wohnung und der Ertragswert. Ist das Haus aufgeteilt, im Schritt Gebäude **In Wohnungseigentum aufgeteilt** anhaken und die **Kosten der Aufteilung** prüfen (Vorbelegung 1.800 € je Wohnung).',
        belege: [[J('mfh-einheiten.js'), 'Einheiten erfassen'], [J('mfh-einheiten.js'), 'Zielbild · nach Umbau'], [J('mfh-einheiten.js'), 'In Wohnungseigentum aufgeteilt'], [J('mfh-einheiten.js'), 'Kosten der Aufteilung']] },
      { t: 'Reiter **Bewertung**, Karte **Wert & Zielbild**: Fehlen die Ertragswerte oder sind sie veraltet, rechnet DealPilot sie beim Öffnen von selbst nach; sonst **Jetzt rechnen** (oder **Ertragswerte rechnen** in der Pilot-Analyse). Das Ergebnis wird mit dem Objekt gespeichert.',
        kosten: 'Kostenlos — kein Kontingent. Der Ertragswert je Stufe erscheint aber nur, wenn für das Objekt ein Marktbericht Stufe 3 vorliegt oder dein Tarif Stufe 3 enthält.',
        belege: [[J('wert-zielbild.js'), 'Wert &amp; Zielbild'], [J('wert-zielbild.js'), 'Jetzt rechnen'], [J('potenzial.js'), 'Ertragswerte rechnen'], [J('potenzial.js'), 'Ertragswert je Stufe mit DealPilot Stufe 3']] },
      { t: 'Lesen: Kacheln mit Kaltmiete, Rendite, Ertragswert und **Wertzuwachs nach Kosten** (Ertragswert der Stufe minus Bestand minus Maßnahmen); **Im Detail** zeigt Wohnungen, Wertüberleitung und Kennzahlen je Stufe. Dasselbe steht in der Pilot-Analyse unter „Ankauf · Bestand · Zielbild“ und in beiden PDFs.',
        belege: [[J('wert-zielbild.js'), 'Wertzuwachs nach Kosten'], [J('wert-zielbild.js'), 'Im Detail: Wohnungen, Wertüberleitung, Kennzahlen je Stufe'], [IX, 'Ankauf &middot; Bestand &middot; Zielbild']] },
      { t: 'Über alle Objekte: **Portfolio-Cockpit**, Abschnitt **03 Bestand & Zielbild**. Fehlt ein Objekt, steht es unter „Nicht oder nur teilweise enthalten · mit Grund“ — mit **Im Objekt öffnen** und **neu rechnen ↻** (öffnet das Objekt, rechnet kostenlos und speichert).',
        belege: [[J('dashboard.js'), 'Bestand &amp; Zielbild'], [J('dashboard.js'), 'Nicht oder nur teilweise enthalten · mit Grund'], [J('dashboard.js'), 'neu rechnen ↻']] }
    ],
    hinweis: 'Die Ertragswerte nach Mieterhöhung und im Zielbild sind ein Ausblick: Sie unterstellen, dass die höhere Miete erzielt bzw. die Maßnahmen umgesetzt sind. Sie sind kein Verkehrswert zum heutigen Stichtag. Score, Verkehrswert und Marktbericht rechnen weiter mit dem Bestand.'
  }
];
