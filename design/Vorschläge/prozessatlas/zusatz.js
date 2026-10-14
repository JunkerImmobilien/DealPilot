/* Prozessatlas-Demos · Zusatzdaten (v2216k, N68.2)
   ─────────────────────────────────────────────────────────────────────
   Die sieben Abläufe kommen ECHT aus frontend/js/prozess-atlas.js
   (window.DealPilotAtlas.PROZESSE) — die Demos laden die Datei direkt,
   damit sie nichts erzählen, was der Atlas nicht auch erzählt.

   Neu sind hier zwei Abläufe, die Marcel ausdrücklich sehen wollte
   („Visualisierung der Spracheingabe und des PDF-Imports"), und die
   Rechenkerne für das Zusammenspiel. Jede Station trägt `beleg`
   im selben Format wie der Atlas; bei Übernahme in prozess-atlas.js
   prüft tools/prozess-atlas-pruefen.mjs sie mit.
   ───────────────────────────────────────────────────────────────────── */
window.ATLAS_ZUSATZ = {
  ablaeufe: [
    {
      id: 'sprache', name: 'Sprechlauf', sub: 'Du erzählst das Objekt — DealPilot füllt die Felder',
      spalten: ['Sprechen', 'Verstehen', 'Übernehmen'],
      knoten: [
        { id: 'v1', s: 0, z: 0, t: 'Aufnahme', k: 'bis 4 Minuten', d: 'Die Aufnahme startet sofort. Während du sprichst, erscheint der Text live als Vorschau; maßgeblich ist die Audio-Aufnahme.', ein: ['Mikrofon'], aus: ['Audio', 'Live-Vorschau'], beleg: 'frontend/js/voice-import.js:MAX_SEC' },
        { id: 'v2', s: 0, z: 1, t: 'Transkription', k: 'in Abschnitten', d: 'Der Mitschnitt wird abschnittsweise in Text übertragen. Pause und Fortsetzen sind jederzeit möglich.', ein: ['Audio'], aus: ['Text'], beleg: 'frontend/js/voice-import.js:transcribe-chunk' },
        { id: 'v3', s: 1, z: 0, t: 'Feldkatalog', k: 'zur Laufzeit gelesen', d: 'Alle Felder aller Reiter, Auswahlfelder mit ihren echten Optionen. So wird „Zustand ist gut" zum passenden Optionswert.', ein: ['Felder der App'], aus: ['Katalog'], beleg: 'frontend/js/voice-import.js:renderMergedTable' },
        { id: 'v4', s: 1, z: 1, t: 'Zuordnen', k: 'Text → Felder', d: 'Die KI ordnet das Gesagte den Feldern zu. Was nicht im Katalog steht, wird nicht erfunden.', ein: ['Text', 'Katalog'], aus: ['Vorschläge je Feld'], beleg: 'backend/src/routes/ai.js:/extract-voice' },
        { id: 'v5', s: 2, z: 0, t: 'Nachfragen', k: 'wenn ein Feld belegt ist', d: 'Trägt das Objekt schon Werte, zeigt DealPilot, was sich ändern würde — und fragt, bevor überschrieben wird.', ein: ['bestehende Werte'], aus: ['Rückfrage'], beleg: 'frontend/js/voice-import.js:bereits Stammdaten' },
        { id: 'v6', s: 2, z: 1, t: 'Übernehmen', k: 'an- und abwählbar', d: 'Dieselbe Tabelle wie beim Exposé-Import. Du wählst, was übernommen wird — danach rechnen alle Kerne neu.', ein: ['deine Auswahl'], aus: ['gefüllte Felder', 'neuer Score'], beleg: 'frontend/js/voice-import.js:applyMerged' }
      ]
    },
    {
      id: 'dokumente', name: 'Dokument-Import', sub: 'Exposé, Grundbuch, Gutachten, Belege — lesen statt abtippen',
      spalten: ['Einlesen', 'Schützen', 'Auswerten', 'Übernehmen'],
      knoten: [
        { id: 'p1', s: 0, z: 0, t: 'PDF wählen', k: 'Text aus allen Seiten', d: 'Der Text wird im Browser aus dem PDF gelesen. Belege und Fotos gehen als Bild in die Auswertung.', ein: ['PDF', 'Foto'], aus: ['Seitentext'], beleg: 'frontend/js/pdf-import.js:extractText' },
        { id: 'p2', s: 0, z: 1, t: 'Art erkennen', k: 'neun Dokumentarten', d: 'Grundbuch, Kataster, Kaufvertrag, WEG-Protokoll, BORIS, Verkehrswert-, Restnutzungsdauergutachten, Kaufpreisaufteilung, Marktbericht — je mit eigenem Schema.', ein: ['Seitentext'], aus: ['Dokumentart'], beleg: 'frontend/js/dokument-import.js:Kaufpreisaufteilung' },
        { id: 'p3', s: 1, z: 0, t: 'Schwärzen', k: 'auf dem DealPilot-Server, vor der KI', d: 'Geburtsdaten, Namen nach Anrede, Anschriften nach „wohnhaft", E-Mail, Telefon, IBAN, Steuer-ID werden ersetzt. Die Objektanschrift und Beträge bleiben — die braucht die Auswertung.', ein: ['Seitentext'], aus: ['geschwärzter Text'], beleg: 'backend/src/services/schwaerzen.js:schwaerze' },
        { id: 'p4', s: 2, z: 0, t: 'Auslesen', k: 'Schema ohne Personendaten', d: 'Das Schema fragt nur nach Objektdaten. Was nicht gefragt wird, schreibt das Modell nicht heraus.', ein: ['geschwärzter Text', 'Schema'], aus: ['Felder mit Fundstelle'], beleg: 'backend/src/routes/ai.js:/extract-dokument' },
        { id: 'p5', s: 2, z: 1, t: 'Vergleich, nicht Ergebnis', k: 'fremde Gutachten', d: 'Ein mitgelesener Gutachtenwert (Restnutzungsdauer, Verkehrswert, Gebäudeanteil) erscheint als Vergleich neben der eigenen Rechnung — er wird nicht übernommen.', ein: ['Gutachtenwert'], aus: ['Abgleich'], beleg: 'frontend/js/dokument-import.js:VERGLEICH' },
        { id: 'p6', s: 3, z: 0, t: 'Übernehmen', k: 'Feld für Feld', d: 'Exposé-Werte landen nach deiner Auswahl in der Datenaufnahme; Belege bestätigst du Zeile für Zeile, weil sie in die Steuer gehen.', ein: ['deine Auswahl'], aus: ['Datenaufnahme', 'Anschaffungskosten'], beleg: 'frontend/js/beleg-import.js:extract-beleg' }
      ]
    }
  ],
  /* Die Rechenkerne aus CLAUDE.md "Rechenkerne — nie duplizieren".
     `nutzt`: welche Abläufe lesen den Kern (aus den Stationen gezählt). */
  kerne: [
    { id: 'kpi', t: 'DealKpis', k: 'Renditen · Cashflow · LTV', beleg: 'frontend/js/deal-kpis.js:compute', nutzt: ['reise', 'quickcheck', 'boarding', 'scores', 'deal', 'sprache', 'dokumente', 'telegram'] },
    { id: 'dscr', t: 'DSCR', k: 'Kapitaldienstdeckung', beleg: 'frontend/js/dscr-engine.js:compute', nutzt: ['reise', 'quickcheck', 'boarding', 'deal', 'scores', 'telegram'] },
    { id: 'score', t: 'DealScore', k: 'fünf Faktoren', beleg: 'frontend/js/dealscore.js:DEFAULT_WEIGHTS', nutzt: ['reise', 'quickcheck', 'scores', 'deal', 'sprache', 'dokumente', 'telegram'] },
    { id: 'tier', t: 'ScoreTier', k: 'Sehr gut … Kritisch', beleg: 'frontend/js/score-tiers.js:stufe', nutzt: ['scores', 'quickcheck', 'marktbericht', 'reise', 'telegram'] },
    { id: 'swf', t: 'Gutachterausschuss', k: 'LZS · Sachwertfaktor', beleg: 'marktbericht/backend/src/lib/gutachterausschuss.js', nutzt: ['marktbericht', 'boarding', 'reise'] },
    { id: 'steuer', t: 'Steuer & AfA', k: 'Anlage V · § 7b', beleg: 'frontend/js/anlage-v-2025.js:Anlage V', nutzt: ['steuer', 'deal', 'boarding', 'dokumente'] }
  ]
};

/* v2218 · Sprechlauf und Dokument-Import stehen jetzt im ECHTEN Atlas
   (frontend/js/prozess-atlas.js). Wer beide lädt, bekäme sie doppelt -
   deshalb gilt hier nur, was der Atlas noch nicht kennt. */
(function () {
  var A = window.DealPilotAtlas && window.DealPilotAtlas.PROZESSE;
  if (!A) return;
  window.ATLAS_ZUSATZ.ablaeufe = window.ATLAS_ZUSATZ.ablaeufe.filter(function (p) {
    return !A.some(function (x) { return x.id === p.id; });
  });
})();
