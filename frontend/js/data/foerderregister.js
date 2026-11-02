/* ══ v3072 · FÖRDERREGISTER (KfW / BAFA) — EINE QUELLE FÜR ALLE HINWEISE ═══
   Marcel 02.11.2026: „KfW können wir pflegen und Link dazu."
   Recherche: design/Vorschläge/kfw-foerderregister-recherche.md (kfw.de, bafa.de,
   gelesen 02.11.2026). Nur Programme, die für VERMIETER gelten; 300/308/124/358 sind
   reine Selbstnutzer-Programme und stehen deshalb nicht hier.

   ZINSEN stehen bewusst NICHT hier: sie ändern sich mehrmals im Monat, und das
   KfW-Impressum untersagt die Vervielfältigung der Tabellen ohne Zustimmung. Die App
   verlinkt den Konditionenanzeiger der KfW.

   PFLEGE: Jahreswerte-Register (marktbericht/backend/src/lib/data/jahreswerte.json,
   id „foerderprogramme") mit Fälligkeit; Agent „jahreswerte" zieht nach und setzt
   `stand` neu. Wer hier etwas ändert, zieht `stand` und `erwartet` im Register mit.
   Gelesen von: calc.js updateFESH() (Empfehlungen im Block „Sanierungsbedarf")
   und calc.js (Links in Darlehen 2 „KfW-Darlehen"). */
window.DpFoerderregister = {
  stand: '2026-11-02',
  konditionen_url: 'https://www.kfw-formularsammlung.de/KonditionenanzeigerINet/KonditionenAnzeiger',
  programme: [
    { id: 'kfw261', name: 'KfW 261 – Wohngebäude-Kredit (Sanierung zum Effizienzhaus)', art: 'kredit',
      ausloeser: ['energie'],
      betrag: 'bis 150.000 € je Wohneinheit',
      vorteil: 'Tilgungszuschuss je nach Effizienzhaus-Stufe, im Regelfall 5–15 %, mit Boni bis zu 40 % — nur, wenn das Gebäude insgesamt Effizienzhaus-Niveau erreicht',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Bundesförderung-für-effiziente-Gebäude-Wohngebäude-Kredit-(261-262)/',
      darlehen2: true },
    { id: 'kfw458', name: 'KfW 458 – Heizungsförderung (Zuschuss)', art: 'zuschuss',
      ausloeser: ['heizung'],
      betrag: 'für Vermieter 30 % Grundförderung: 1. Wohneinheit höchstens 8.400 € (30 % von 28.000 €), 2.–6. je bis 4.500 €',
      vorteil: 'Klimageschwindigkeits- und Einkommensbonus nur bei Selbstnutzung; GbR und Gesellschaften über KfW 459',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Heizungsförderung-für-Privatpersonen-Wohngebäude-(458)/' },
    { id: 'bafa_huelle', name: 'BAFA – Einzelmaßnahmen Gebäudehülle (Zuschuss)', art: 'zuschuss',
      ausloeser: ['huelle'],
      betrag: '15 % Zuschuss, +5 % mit Sanierungsfahrplan (iSFP); förderfähig 1. WE bis 30.000 €, 2.–6. je 15.000 €',
      vorteil: 'Direktzuschuss für Fenster und Dämmung; der Heizungstausch läuft über KfW 458',
      url: 'https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/Sanierung_Wohngebaeude/Gebaeudehuelle/gebaeudehuelle_node.html' },
    { id: 'kfw359', name: 'KfW 359 – Ergänzungskredit Einzelmaßnahmen', art: 'kredit',
      ausloeser: ['heizung', 'huelle'],
      betrag: 'bis 120.000 € je Wohneinheit',
      vorteil: 'Kredit zusätzlich zu einer Zuschuss-Zusage (KfW 458/459 oder BAFA, höchstens 12 Monate alt); ohne Einkommensgrenze',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Einzelmaßnahmen-Ergänzungskredit-Wohngebäude-(358-359)/',
      darlehen2: true },
    { id: 'kfw159', name: 'KfW 159 – Altersgerecht Umbauen (Kredit)', art: 'kredit',
      ausloeser: ['bad'],
      betrag: 'bis 50.000 € je Wohneinheit',
      vorteil: 'Kredit für barrierereduzierende Umbauten (Bad, Türen, Aufzug); kein Zuschuss',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Förderprodukte/Altersgerecht-Umbauen-(159)/',
      darlehen2: true },
    { id: 'kfw298', name: 'KfW 298 – Klimafreundlicher Neubau zur Vermietung', art: 'kredit',
      ausloeser: ['neubau'],
      betrag: 'EH 40: 100.000 € je WE (mit QNG 150.000 €), EH 55: 100.000 € je WE',
      vorteil: 'zinsverbilligt, kein Tilgungszuschuss',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/Förderprodukte/Klimafreundlicher-Neubau-Wohngebäude-(297-298)/',
      darlehen2: true },
    { id: 'kfw296', name: 'KfW 296 – Klimafreundlicher Neubau im Niedrigpreissegment', art: 'kredit',
      ausloeser: ['neubau'],
      betrag: '100.000 € je WE (EH 55, flächeneffizient, Kostengrenze, keine fossile Heizung)',
      vorteil: 'zinsverbilligt, auch für Vermieter',
      url: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/Förderprodukte/Klimafreundlicher-Neubau-im-Niedrigpreissegment-(296)/',
      darlehen2: true }
  ]
};
