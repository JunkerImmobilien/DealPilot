/* ══ v3072 · FÖRDERREGISTER (KfW / BAFA) — EINE QUELLE FÜR ALLE HINWEISE ═══
   Marcel 02.11.2026: „KfW können wir pflegen und Link dazu."
   Recherche: design/Vorschläge/kfw-foerderregister-recherche.md (kfw.de, bafa.de,
   gelesen 02.11.2026).

   v5120 · JJ6 (Marcel 26.11.2026: „KfW-Programme drauf geben, welche man nutzen
   kann, auch für Kapitalanleger, aber nur wenn sinnvoll"): neu gelesen am
   26.11.2026 auf kfw.de und bafa.de (Produktseiten, Abschnitte „Das Wichtigste in
   Kürze", „Wen fördern wir?", Kredithöchstbeträge, Tilgungszuschuss-Tabelle).
     programme       = Vermieter-Programme (wie bisher, gelesen von calc.js
                       updateFESH() und Darlehen 2). Nur Felder ergänzt.
     programme_eigen = NEU: Programme, die nur bei Selbstnutzung gelten (124, 300,
                       308, 358, 297) bzw. für Selbstnutzer andere Sätze haben.
   Die Auswahl je Objekt trifft der Kern js/foerderung.js (DpFoerderung.passend).
   Kundentext: keine Gedankenstriche, keine Semikolons (Namen mit „·").

   ZINSEN stehen bewusst NICHT hier: sie ändern sich mehrmals im Monat, und das
   KfW-Impressum untersagt die Vervielfältigung der Tabellen ohne Zustimmung. Die App
   verlinkt den Konditionenanzeiger der KfW.

   PFLEGE: Jahreswerte-Register (marktbericht/backend/src/lib/data/jahreswerte.json,
   id „foerderprogramme") mit Fälligkeit; Agent „jahreswerte" zieht nach und setzt
   `stand` neu. Wer hier etwas ändert, zieht `stand` und `erwartet` im Register mit.
   Gelesen von: calc.js updateFESH() (Empfehlungen im Block „Sanierungsbedarf"),
   calc.js (Links in Darlehen 2 „KfW-Darlehen") und js/foerderung.js. */
window.DpFoerderregister = {
  stand: '2026-11-26',
  konditionen_url: 'https://www.kfw-formularsammlung.de/KonditionenanzeigerINet/KonditionenAnzeiger',
  hinweis_antrag: 'Voraussetzungen und Konditionen vor Antrag beim Förderprogramm prüfen.',
  programme: [
    { id: 'kfw261', name: 'KfW 261 · Wohngebäude-Kredit (Sanierung zum Effizienzhaus)', art: 'kredit',
      ausloeser: ['energie'], fuer: ['eigen', 'vermietet'], bestand: true, neubau: false,
      betrag: 'bis 150.000 € je Wohneinheit',
      vorteil: 'Tilgungszuschuss je nach Effizienzhaus-Stufe 5 bis 15 %, mit Boni (Worst Performing Building, serielle Sanierung) mehr. Nur wenn das Gebäude insgesamt eine Effizienzhaus-Stufe erreicht. EH 70 und EH 85 Erneuerbare-Energien ohne Tilgungszuschuss',
      voraussetzung: 'Effizienzhaus-Stufe nach BEG, Experte für Energieeffizienz verpflichtend',
      antrag: 'vor Beginn der Arbeiten bzw. vor dem Kaufvertrag beantragen, Verträge nur mit aufschiebender oder auflösender Bedingung',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Bundesförderung-für-effiziente-Gebäude-Wohngebäude-Kredit-(261-262)/',
      gelesen: '2026-11-26', abschnitt: 'Kredithöhe und Tilgungszuschuss',
      darlehen2: true },
    { id: 'kfw458', name: 'KfW 458 · Heizungsförderung (Zuschuss)', art: 'zuschuss',
      ausloeser: ['heizung'], fuer: ['eigen', 'vermietet'], bestand: true, neubau: false,
      betrag: 'für Vermieter 30 % Grundförderung. Förderfähig 1. Wohneinheit bis 28.000 €, 2. bis 6. je 15.000 €, ab der 7. je 8.000 €',
      vorteil: 'Klimageschwindigkeits- und Einkommensbonus nur bei Selbstnutzung. GbR und Gesellschaften über KfW 459. Ab 1. Quartal 2027 ist ein Wertschöpfungsbonus angekündigt, die Grundförderung für Wärmepumpen aus Nicht-EU-Herstellung könnte dann sinken, bitte prüfen',
      voraussetzung: 'Einbau einer effizienten Heizung (zum Beispiel Wärmepumpe) im Bestand, Förderung unter Vorbehalt verfügbarer Haushaltsmittel',
      antrag: 'vor Beginn, Liefer- oder Leistungsvertrag mit aufschiebender oder auflösender Bedingung',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Heizungsförderung-für-Privatpersonen-Wohngebäude-(458)/',
      gelesen: '2026-11-26', abschnitt: 'Das Wichtigste in Kürze, Grundförderung, Beispiele' },
    { id: 'bafa_huelle', name: 'BAFA · Einzelmaßnahmen Gebäudehülle (Zuschuss)', art: 'zuschuss',
      ausloeser: ['huelle'], fuer: ['eigen', 'vermietet'], bestand: true, neubau: false,
      betrag: '15 % Zuschuss, 5 % mehr mit individuellem Sanierungsfahrplan (iSFP). Förderfähig 1. Wohneinheit bis 30.000 €, mit iSFP bis 60.000 €',
      vorteil: 'Direktzuschuss für Fenster, Dämmung von Fassade, Dach und oberster Geschossdecke. Der Heizungstausch läuft über KfW 458',
      voraussetzung: 'Bestandsgebäude (Bauantrag mindestens fünf Jahre alt), Energieeffizienz-Experte einbinden, Mindestinvestition 300 €',
      antrag: 'vor Beginn der Maßnahme beim BAFA beantragen',
      url: 'https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/Sanierung_Wohngebaeude/Gebaeudehuelle/gebaeudehuelle_node.html',
      gelesen: '2026-11-26', abschnitt: 'Investitionsvolumen und Höhe der Förderung' },
    { id: 'kfw359', name: 'KfW 359 · Ergänzungskredit Einzelmaßnahmen', art: 'kredit',
      ausloeser: ['heizung', 'huelle'], fuer: ['eigen', 'vermietet'], bestand: true, neubau: false,
      betrag: 'bis 120.000 € je Wohneinheit',
      vorteil: 'Kredit zusätzlich zu einer Zuschusszusage (KfW 458 oder BAFA, höchstens 12 Monate alt), ohne Einkommensgrenze',
      voraussetzung: 'bestehende Zuschusszusage für eine Einzelmaßnahme',
      antrag: 'nach der Zuschusszusage, innerhalb von 12 Monaten',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Einzelmaßnahmen-Ergänzungskredit-Wohngebäude-(358-359)/',
      gelesen: '2026-11-26', abschnitt: 'Wen fördern wir?',
      darlehen2: true },
    { id: 'kfw159', name: 'KfW 159 · Altersgerecht Umbauen (Kredit)', art: 'kredit',
      ausloeser: ['bad'], fuer: ['eigen', 'vermietet'], bestand: true, neubau: false,
      betrag: 'bis 50.000 € je Wohneinheit',
      vorteil: 'Kredit für barrierereduzierende Umbauten (Bad, Türen, Aufzug) und Einbruchschutz, auch für den Kauf umgebauter Wohnungen. Kein Zuschuss',
      voraussetzung: 'Maßnahmen nach den technischen Mindestanforderungen, Förderung unter Vorbehalt verfügbarer Haushaltsmittel',
      antrag: 'vor Beginn des Vorhabens beantragen',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Altersgerecht-Umbauen-(159)/',
      gelesen: '2026-11-26', abschnitt: 'Das Wichtigste in Kürze, Wen fördern wir?',
      darlehen2: true },
    { id: 'kfw298', name: 'KfW 298 · Klimafreundlicher Neubau zur Vermietung', art: 'kredit',
      ausloeser: ['neubau'], fuer: ['vermietet'], bestand: false, neubau: true,
      betrag: 'Effizienzhaus 55 bzw. Klimafreundliches Wohngebäude bis 100.000 € je Wohnung, mit QNG bis 150.000 €',
      vorteil: 'zinsverbilligt, kein Tilgungszuschuss',
      voraussetzung: 'Neubau oder Erstkauf, Förderung unter Vorbehalt der Bundesmittel',
      antrag: 'vor Baubeginn bzw. vor dem Kaufvertrag beantragen',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/Förderprodukte/Klimafreundlicher-Neubau-Wohngebäude-(297-298)/',
      gelesen: '2026-11-26', abschnitt: 'Kredithöhe',
      darlehen2: true },
    { id: 'kfw296', name: 'KfW 296 · Klimafreundlicher Neubau im Niedrigpreissegment', art: 'kredit',
      ausloeser: ['neubau'], fuer: ['eigen', 'vermietet'], bestand: false, neubau: true,
      betrag: 'bis 100.000 € je Wohnung',
      vorteil: 'besonders zinsgünstig, auch für Vermieter, flächeneffizient mit Kostengrenze, keine fossile Heizung',
      voraussetzung: 'Effizienzhaus 55, Flächen- und Kostengrenzen, bitte prüfen',
      antrag: 'vor Baubeginn bzw. vor dem Kaufvertrag beantragen',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/Förderprodukte/Klimafreundlicher-Neubau-im-Niedrigpreissegment-(296)/',
      gelesen: '2026-11-26', abschnitt: 'Das Wichtigste in Kürze',
      darlehen2: true }
  ],
  /* v5120 · nur Selbstnutzer (bzw. Selbstnutzer-Fassung). calc.js liest diese Liste NICHT. */
  programme_eigen: [
    { id: 'kfw124', name: 'KfW 124 · Wohneigentumsprogramm', art: 'kredit',
      ausloeser: ['kauf', 'neubau'], fuer: ['eigen'], bestand: true, neubau: true,
      betrag: 'bis 100.000 € je Vorhaben',
      vorteil: 'für Kauf oder Bau einer selbst genutzten Wohnung oder eines Hauses, auch für Nebenkosten wie Notar, Makler und Grunderwerbsteuer',
      voraussetzung: 'Privatperson, die selbst einzieht. Nicht für Ferienwohnungen, Umschuldung oder bereits begonnene Vorhaben',
      antrag: 'vor dem Kaufvertrag bzw. vor Baubeginn über die Hausbank beantragen',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/Förderprodukte/Wohneigentumsprogramm-(124)/',
      gelesen: '2026-11-26', abschnitt: 'Das Wichtigste in Kürze, Was fördern wir?' },
    { id: 'kfw308', name: 'KfW 308 · Wohneigentum für Familien, Bestandserwerb (Jung kauft Alt)', art: 'kredit',
      ausloeser: ['kauf'], fuer: ['eigen'], bestand: true, neubau: false,
      betrag: 'bis 140.000 € (1 Kind), 160.000 € (2 Kinder), 180.000 € (ab 3 Kindern)',
      einkommen_grenze: { basis: 90000, je_weiteres_kind: 10000 },
      kredit_je_kinder: { 1: 140000, 2: 160000, 3: 180000 },
      klassen: ['F', 'G', 'H'],
      vorteil: 'zinsgünstiger Kredit für den Kauf eines energetisch schwachen Bestandsgebäudes, das danach saniert wird',
      voraussetzung: 'mindestens ein Kind unter 18 im Haushalt, Haushaltseinkommen höchstens 90.000 € bei einem Kind plus 10.000 € je weiterem Kind, einzige Wohnimmobilie in Deutschland, Energieausweis Klasse F, G oder H, Sanierung mindestens auf Effizienzhaus 85 EE oder per Einzelmaßnahmen (Fenster, Heizung, Fassade, Dach). Frist für die Sanierung bitte prüfen',
      antrag: 'vor dem Kaufvertrag beantragen, gültiger Energieausweis muss bei Antrag vorliegen',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Wohneigentum-für-Familien-Bestandserwerb-(308)/',
      gelesen: '2026-11-26', abschnitt: 'Was fördern wir?, Wen fördern wir?, Kredithöchstbeträge' },
    { id: 'kfw300', name: 'KfW 300 · Wohneigentum für Familien, Neubau', art: 'kredit',
      ausloeser: ['neubau'], fuer: ['eigen'], bestand: false, neubau: true,
      betrag: 'Klimafreundliches Wohngebäude 170.000 € (1 bis 2 Kinder), 200.000 € (3 bis 4), 220.000 € (ab 5). Mit QNG 220.000 bis 270.000 €',
      einkommen_grenze: { basis: 90000, je_weiteres_kind: 10000 },
      vorteil: 'zinsgünstiger Kredit für Familien, die klimafreundlich bauen oder einen solchen Neubau erstmals kaufen',
      voraussetzung: 'mindestens ein Kind unter 18, Haushaltseinkommen höchstens 90.000 € bei einem Kind plus 10.000 € je weiterem Kind, einzige Wohnimmobilie, Effizienzhaus 40 mit Anforderungen an Treibhausgase, keine Öl-, Gas- oder Biomasseheizung',
      antrag: 'vor Baubeginn bzw. vor dem Kaufvertrag beantragen',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/Förderprodukte/Wohneigentum-für-Familien-(300)/',
      gelesen: '2026-11-26', abschnitt: 'Wen fördern wir?, Kredithöchstbeträge' },
    { id: 'kfw297', name: 'KfW 297 · Klimafreundlicher Neubau zur Selbstnutzung', art: 'kredit',
      ausloeser: ['neubau'], fuer: ['eigen'], bestand: false, neubau: true,
      betrag: 'Effizienzhaus 55 bzw. Klimafreundliches Wohngebäude bis 100.000 € je Wohnung, mit QNG bis 150.000 €',
      vorteil: 'zinsverbilligt, inklusive Nebenkosten, ohne Einkommensgrenze',
      voraussetzung: 'Neubau oder Erstkauf, Förderung unter Vorbehalt der Bundesmittel',
      antrag: 'vor Baubeginn bzw. vor dem Kaufvertrag beantragen',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/Förderprodukte/Klimafreundlicher-Neubau-Wohngebäude-(297-298)/',
      gelesen: '2026-11-26', abschnitt: 'Kredithöhe' },
    { id: 'kfw458_eigen', name: 'KfW 458 · Heizungsförderung für Selbstnutzer (Zuschuss)', art: 'zuschuss',
      ausloeser: ['heizung'], fuer: ['eigen'], bestand: true, neubau: false,
      betrag: '30 % Grundförderung, dazu Klimageschwindigkeitsbonus 16 % und Einkommensbonus 10 bis 40 %, zusammen höchstens 70 % (bei geringem Einkommen 80 %). Förderfähig im Einfamilienhaus bis 28.000 €',
      einkommensbonus: [ /* zu versteuerndes Haushaltsjahreseinkommen, ohne / mit Kind unter 18 (Familienzuschlag 10.000 €) */
        { bis: 30000, ohne_kind: 40, mit_kind: 40 }, { bis: 40000, ohne_kind: 30, mit_kind: 40 },
        { bis: 50000, ohne_kind: 10, mit_kind: 30 }, { bis: 60000, ohne_kind: 0, mit_kind: 10 } ],
      klimabonus: { pct: 16, sinkt_ab: '2027-02-01', schritt_pct: 4, endet_fuer_antraege_ab: '2028-08-01' },
      vorteil: 'Klimageschwindigkeitsbonus beim Tausch einer funktionierenden Öl-, Kohle-, Gas-Etagen- oder Nachtspeicherheizung oder einer mindestens 20 Jahre alten Gas- oder Biomasseheizung. Der Bonus sinkt ab 1.2.2027 halbjährlich um 4 Punkte',
      voraussetzung: 'selbst genutzte Haupt- oder alleinige Wohneinheit, Förderung unter Vorbehalt verfügbarer Haushaltsmittel',
      antrag: 'vor Beginn, Liefer- oder Leistungsvertrag mit aufschiebender oder auflösender Bedingung',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Heizungsförderung-für-Privatpersonen-Wohngebäude-(458)/',
      gelesen: '2026-11-26', abschnitt: 'Grundförderung, Klimageschwindigkeitsbonus, Einkommensbonus' },
    { id: 'kfw358', name: 'KfW 358 · Ergänzungskredit Plus (zinsverbilligt)', art: 'kredit',
      ausloeser: ['heizung', 'huelle'], fuer: ['eigen'], bestand: true, neubau: false,
      betrag: 'bis 120.000 € je Wohneinheit',
      einkommen_grenze: { basis: 90000, je_weiteres_kind: 0 },
      vorteil: 'zinsverbilligter Kredit zur Zwischenfinanzierung einer bewilligten Einzelmaßnahme',
      voraussetzung: 'Zuschusszusage von KfW oder BAFA höchstens 12 Monate alt, selbst bewohntes Einfamilienhaus oder Wohnung, Haushaltseinkommen höchstens 90.000 €',
      antrag: 'nach der Zuschusszusage, innerhalb von 12 Monaten',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Einzelmaßnahmen-Ergänzungskredit-Wohngebäude-(358-359)/',
      gelesen: '2026-11-26', abschnitt: 'Wen fördern wir?' }
  ]
};
