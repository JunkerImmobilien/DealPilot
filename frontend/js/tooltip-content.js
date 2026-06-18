'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * DealPilot V228 — Tooltip-Content-Library
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Zentrale Sammlung aller Tooltip-Texte. Pro Eintrag:
 *   - title:    Kurzer Titel (Header im Popup)
 *   - body:     Erklärung (Plaintext oder kleines HTML)
 *   - severity: 'beginner' | 'pro' | 'critical'
 *               - critical: immer zeigen, auch im Profi-Modus
 *               - pro:      auch im Profi-Modus zeigen
 *               - beginner: nur im Anfänger-Modus zeigen
 *   - paragraph?: optional § oder Quelle für Profi-Zusatz
 *   - example?:   optional Beispiel-Wert
 *   - format:   'tooltip' (default) | 'infobox'
 *               - tooltip:  ⓘ-Icon → Popup
 *               - infobox:  permanent als InfoBox unter dem Feld
 *
 * Namensschema: <tab>.<feld>
 *   tab1 = Objekt
 *   tab2 = Investition
 *   tab3 = Miete
 *   tab4 = Steuer-Details
 *   tab5 = Finanzierung
 *   tab6 = BWK
 *   tab7 = KI-Analyse
 *   tab8 = Bewertung
 *
 * Wer das konsumiert: tooltip-engine.js (Popup-Rendering) und
 * patches die <label>...</label> um <button class="dp-tip" data-tip-id="...">
 * erweitern.
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var T = {
    // ──────── TAB 1: OBJEKT ──────────────────────────────────────────────
    'tab1.energieklasse': {
      title: 'Energieklasse',
      body: 'Die Energieklasse (A+ bis H) zeigt den Energieverbrauch des Gebäudes. Sie steht im Energieausweis und ist seit 2014 Pflichtangabe in Immobilien-Inseraten. A+ = sehr sparsam (Passivhaus), H = sehr hoher Verbrauch (unsaniert).',
      example: 'Beispiel: B = Effizienzhaus 70, üblich für Neubauten ab 2016.',
      paragraph: 'GEG § 86',
      severity: 'beginner'
    },
    'tab1.ds2_zustand': {
      title: 'Zustand der Wohnung',
      body: 'Subjektive Einschätzung des Bauzustands. Beeinflusst den DealScore-Risiko-Anteil und unterstützt die Auto-AfA-Vorauswahl (Neubau ab Baujahr 2023 → degressive AfA möglich).',
      severity: 'beginner'
    },
    'tab1.vermietungsstand': {
      title: 'Vermietungsstand',
      body: 'Aktueller Stand: vollvermietet, teilvermietet, leerstehend oder Eigenbedarf. Banken zahlen für vollvermietete Objekte deutlich bessere Konditionen — Mieteinnahmen sind nachgewiesen.',
      severity: 'beginner'
    },
    'tab1.exitstrategie': {
      title: 'Exitstrategie',
      body: 'Wie lange willst du das Objekt halten? "Langfristig halten" = klassischer Buy-and-Hold. "10 Jahre Spekulationsfrist" = Verkauf steuerfrei nach 10 Jahren (§ 23 EStG). "Kurzfristig flippen" = nicht steuerfrei und ggf. gewerblich.',
      paragraph: '§ 23 EStG',
      severity: 'beginner'
    },
    /* v727-eq-tips: Ausstattungsdetails fuer Marktbewertung */
    'tab1.eq_heating': { title: 'Heizung', body: 'Heizungsart der Wohnung. Fließt in die Sprengnetter-Marktbewertung ein — Fußboden- und Zentralheizung wirken werterhöhend gegenüber Einzelöfen.' },
    'tab1.eq_windows': { title: 'Verglasung', body: 'Fenstertyp. Relevant für Sprengnetter-Bewertung und Energiebewertung. Dreifachverglasung = modern/energieeffizient, Kastenfenster = Altbau.' },
    'tab1.eq_floor': { title: 'Bodenbelag', body: 'Hauptbodenbelag. Parkett/Naturstein gilt als hochwertig, Teppich/Laminat als einfacher. Beeinflusst die Ausstattungsbewertung bei Sprengnetter.' },
    'tab1.eq_bath': { title: 'Bad', body: 'Badausstattung. „Mit Fenster“ und „mehr als ein Bad“ wirken werterhöhend. Geht in die Sprengnetter-Bewertung ein.' },
    'tab1.eq_guest_wc': { title: 'Gäste-WC', body: 'Separates Gäste-WC vorhanden? Werterhöhendes Ausstattungsmerkmal in der Sprengnetter-Bewertung.' },
    'tab1.eq_store_room': { title: 'Keller / Abstellraum', body: 'Lage des Abstellraums. Relevant für die Sprengnetter-Ausstattungsbewertung.' },
    'tab1.eq_walls': { title: 'Außenwände', body: 'Sind die Außenwände gedämmt? Energetisch und für die Bewertung relevant (Sprengnetter).' },
    'tab1.eq_roof': { title: 'Dacheindeckung', body: 'Art der Dacheindeckung (v.a. bei Häusern relevant). Fließt in die Sprengnetter-Bewertung ein.' },
    'tab1.eq_elevator': { title: 'Aufzug', body: 'Aufzug im Gebäude vorhanden? Werterhöhend besonders in oberen Etagen — geht in die Sprengnetter-Bewertung ein.' },

    'tab1.wfl': {
      title: 'Wohnfläche',
      body: 'Wohnfläche nach Wohnflächenverordnung (WoFlV). Wichtig für: Miete pro m², Bodenrichtwert-Hochrechnung, BMF-AfA-Berechnung und § 7b Sonder-AfA-Cap (max. 4.000 €/m² förderfähig).',
      paragraph: 'WoFlV',
      severity: 'beginner'
    },
    'tab1.baujahr': {
      title: 'Baujahr',
      body: 'Errichtungsjahr des Gebäudes. Bestimmt den linearen AfA-Satz: vor 1925 = 2,5%, ab 1925 = 2,0%, Neubau ab Bauantrag 2023 = 3,0% oder 5,0% degressiv möglich. Auch relevant für GEG-Sanierungspflichten.',
      paragraph: '§ 7 Abs. 4 EStG',
      severity: 'beginner'
    },
    'tab1.kuerzel': {
      title: 'Objekt-Kürzel',
      body: 'Kurzes Kennzeichen zur internen Identifikation, z.B. "MS_HAU_12" für "Münster Hauptstraße 12". Wird im PDF-Header und in der Objekt-Liste angezeigt.',
      severity: 'pro'
    },
    'tab1.investitionsthese': {
      title: 'Investitionsthese',
      body: 'Deine Begründung warum dieser Deal Sinn macht — in einem Satz. Beispiel: "ETW unter Marktwert, Buy-and-Hold, Mietsteigerung durch lokales Bevölkerungswachstum". Wird in der KI-Analyse mitberücksichtigt.',
      severity: 'pro'
    },
    'tab1.bekannte_risiken': {
      title: 'Bekannte Risiken',
      body: 'Risiken die dir bewusst sind — z.B. Sanierungsstau am Dach, anstehende GEG-Pflicht für Heizungstausch, Mieterwechsel geplant. Hilft dir bei späteren Verhandlungen ehrlich zu bleiben und fließt in die KI-Risikoanalyse.',
      severity: 'pro'
    },
    'tab1.verkehrswert': {
      title: 'Verkehrswert (§ 194 BauGB)',
      body: 'Der "objektive" Marktwert nach Sachverständigen-Gutachten — meist via Sachwertverfahren, Ertragswertverfahren oder Vergleichswertverfahren. Wenn höher als Kaufpreis → Wertpuffer und besseres Verhandlungsargument bei der Bank.',
      paragraph: '§ 194 BauGB',
      severity: 'pro'
    },
    'tab1.bankbewertung': {
      title: 'Bankbewertung',
      body: 'Beleihungswert nach BelWertV (Beleihungswertermittlungsverordnung). Banken setzen typisch 80-90% des Verkehrswerts an — der dann als Sicherheit dient. Wenn unbekannt: Verkehrswert nutzen.',
      paragraph: 'BelWertV',
      severity: 'pro'
    },
    'tab1.bodenrichtwert': {
      title: 'Bodenrichtwert',
      body: 'Durchschnittspreis pro m² Bauland in deiner Lage. Wird von Gutachterausschüssen festgelegt und ist die Basis für die Aufteilung Boden-/Gebäudeanteil. Du findest aktuelle Werte im BORIS-Portal des jeweiligen Bundeslands.',
      example: 'Beispiel: München-Schwabing: 8.000 €/m². Münster-Geist: 420 €/m².',
      severity: 'beginner'
    },
    'tab1.miteigentumsanteil': {
      title: 'Miteigentumsanteil (MEA)',
      body: 'Dein Anteil am gesamten Grundstück (in % oder als Bruch wie "75/1000"). Steht in der Teilungserklärung und im Kaufvertrag. Multipliziert mit Grundstücksfläche ergibt das deinen Grundstücksanteil — relevant für AfA und Bodenwert.',
      severity: 'pro'
    },

    // ──────── TAB 2: INVESTITION ──────────────────────────────────────────
    'tab2.kp': {
      title: 'Kaufpreis',
      body: 'Notarieller Kaufpreis ohne Erwerbsnebenkosten. Aufgeteilt in Grundstücksanteil (kein AfA möglich) und Gebäudeanteil (AfA-fähig). Bei Wohneigentum: oft 80/20 Gebäude/Boden, exakte Werte über BMF-Rechner oder Gutachten.',
      severity: 'beginner'
    },
    'tab2.kueche_im_kp': {
      title: 'Bewegliche Wirtschaftsgüter im Kaufpreis',
      body: 'Wenn die Einbauküche oder Möblierung separat im Notarvertrag ausgewiesen ist, gilt sie als bewegliches Wirtschaftsgut. Steuerlich vorteilhaft: eigene AfA über 10 Jahre, fällt nicht unter die 15%-Grenze des Gebäudes.',
      paragraph: '§ 7 EStG',
      severity: 'pro'
    },
    'tab2.makler': {
      title: 'Maklerprovision',
      body: 'Übliche Höhe in Deutschland: 3,57% inkl. USt für den Käufer (Bestellerprinzip seit 2020 oft 50/50 zwischen Käufer und Verkäufer). 0 bei Privatkauf. Maklerkosten sind Anschaffungsnebenkosten — sie erhöhen die Gebäude-AfA-Basis nicht direkt, sondern nur anteilig.',
      severity: 'beginner'
    },
    'tab2.notar': {
      title: 'Notarkosten',
      body: 'Notar- und Grundbuchgebühren nach GNotKG-Tabelle. Üblich: 1,5-2,0% des Kaufpreises. Wird teilweise zwischen Käufer und Verkäufer aufgeteilt — meist trägt der Käufer die Kosten für die Auflassungsvormerkung und Eigentumsumschreibung.',
      paragraph: 'GNotKG',
      severity: 'beginner'
    },
    'tab2.grundbuchamt': {
      title: 'Grundbuchamt',
      body: 'Eintragungsgebühren beim Grundbuchamt — typisch 0,5-1,0% des Kaufpreises. Inkludiert: Auflassungsvormerkung, Eigentumsumschreibung, Eintragung der Grundschuld (falls Finanzierung).',
      severity: 'beginner'
    },
    'tab2.grunderwerbsteuer': {
      title: 'Grunderwerbsteuer',
      body: 'Bundesland-spezifisch zwischen 3,5% (Bayern, Sachsen) und 6,5% (NRW, Schleswig-Holstein, Saarland, Brandenburg). DealPilot ermittelt den Satz automatisch aus der PLZ — manuelles Übersteuern bleibt möglich.',
      paragraph: 'GrEStG',
      severity: 'beginner'
    },
    'tab2.markt_faktor': {
      title: 'Markt-Faktor / Bruttovervielfältiger',
      body: 'Wie viele Jahres-Nettokaltmieten kostet das Objekt? Faustregel: unter 20 = günstig (Schnäppchen), 20-25 = normal, 25-30 = teuer, über 30 = Großstadt-Premium. Wird aus Kaufpreis ÷ Jahres-Nettokaltmiete automatisch berechnet und fließt in den Upside-Score.',
      example: 'Beispiel: 200.000 € KP / 10.000 € NKM = Faktor 20.',
      severity: 'beginner'
    },
    'tab2.san_taxoption': {
      title: 'Sanierungs-Steueroption',
      body: 'Wie sollen Sanierungskosten steuerlich verteilt werden? "Automatisch (15%-Regel)": bei Beträgen unter 15% Gebäudeanteil als Erhaltungsaufwand sofort absetzbar, sonst über AfA-Periode. Manuell: feste Jahre wählen (§ 82b EStDV erlaubt Verteilung auf 2-5 Jahre).',
      paragraph: '§ 82b EStDV',
      severity: 'pro'
    },
    'tab2.moebl_taxoption': {
      title: 'Möblierungs-Verteilung',
      body: 'Bewegliche Wirtschaftsgüter werden linear über die wirtschaftliche Nutzungsdauer abgeschrieben. Standard: 10 Jahre (Küche, Möbel). Kürzer bei sehr verschleißanfälligen Gütern, länger bei sehr hochwertigen Anlagen.',
      paragraph: '§ 7 EStG',
      severity: 'pro'
    },
    'tab2.15prozent_grenze': {
      title: '15%-Grenze (§ 6 Abs. 1 Nr. 1a EStG)',
      body: 'Sanierungen in den ersten 3 Jahren nach Kauf, die 15% der Gebäude-Anschaffungskosten überschreiten, gelten als "anschaffungsnahe Herstellungskosten". Sie sind NICHT mehr als Werbungskosten sofort absetzbar, sondern müssen über die Gebäude-Nutzungsdauer (33-50 Jahre) abgeschrieben werden — ein erheblicher steuerlicher Nachteil.',
      paragraph: '§ 6 Abs. 1 Nr. 1a EStG',
      format: 'infobox',
      severity: 'critical'
    },

    // ──────── TAB 3: MIETE ────────────────────────────────────────────────
    'tab3.nkm': {
      title: 'Nettokaltmiete',
      body: 'Reine Miete für die Wohnung ohne Nebenkosten — Zins, Tilgung und Werbungskosten beziehen sich darauf. Heizung, Wasser, Müllabfuhr etc. sind NICHT enthalten (das sind die umlagefähigen Nebenkosten).',
      severity: 'beginner'
    },
    'tab3.ze': {
      title: 'Zusätzliche Einnahmen',
      body: 'Mieteinnahmen aus Stellplatz, Garage, Keller, Garten oder anderen Nebenflächen. Fließen in die Nettokaltmiete der Steuerberechnung ein. Wichtig: getrennt vom NKM ausweisen, damit die Miete pro m² korrekt berechnet wird.',
      severity: 'beginner'
    },
    'tab3.umlagefaehig': {
      title: 'Umlagefähige Kosten',
      body: 'Betriebskosten die der Mieter zahlt: Heizung, Wasser, Müllabfuhr, Grundsteuer, Versicherungen (Gebäudehaftpflicht), Hausmeister, Aufzugswartung. Sind in der Bewirtschaftung als "durchlaufender Posten" — Mieter zahlt, Verwaltung leitet weiter.',
      paragraph: 'BetrKV',
      severity: 'beginner'
    },
    'tab3.marktmiete': {
      title: 'Marktmiete (€/m²)',
      body: 'Markt-übliche Nettokaltmiete pro m² für vergleichbare Objekte in der Region. Aus Mietspiegel, Immobilienscout-Statistik oder KI-Recherche. Wird mit der Ist-Miete verglichen für den Upside-Score: wenn Ist < Markt → Mietsteigerungs-Potenzial.',
      severity: 'pro'
    },
    'tab3.mietausfall_risiko': {
      title: 'Mietausfall-Risiko',
      body: 'Wie wahrscheinlich sind Mietausfälle in deiner Lage? Faktoren: Mieterstruktur, Sozialindex, Leerstandsquote, lokale Wirtschaftslage. Niedrig = großstädtische A-Lage, Hoch = strukturschwache Region.',
      severity: 'pro'
    },
    'tab3.mietsteigerung': {
      title: 'Mietsteigerung p.a.',
      body: 'Erwartete jährliche Mietsteigerung. Historisch in Deutschland 2-3% p.a. Bei Mietpreisbremse (Berlin, München etc.) maximal 15% in 3 Jahren erlaubt. Konservative Investoren rechnen mit 1,5-2,0%.',
      paragraph: '§ 558 BGB (Mieterhöhung)',
      severity: 'beginner'
    },
    'tab3.wertsteigerung': {
      title: 'Wertsteigerung p.a.',
      body: 'Erwartete jährliche Wertsteigerung der Immobilie. Stabile A-Lagen: 1-2%, Wachstumsregionen: 2-4%, Spekulationsmarkt: 4%+. Über lange Sicht meist Inflation + 0,5-1,5%.',
      severity: 'beginner'
    },
    'tab3.kostensteigerung': {
      title: 'Kostensteigerung p.a.',
      body: 'Erwartete jährliche Steigerung der Bewirtschaftungskosten (Hausgeld, Verwaltung, Versicherungen). Historisch leicht über Inflation, typisch 1-2%.',
      severity: 'beginner'
    },
    'tab3.leerstand': {
      title: 'Leerstand p.a.',
      body: 'Anteil der Monate pro Jahr ohne Miete. Bei langjährigen Mietern: 0%. Mit gelegentlichem Mieterwechsel: 2-5%. In strukturschwachen Lagen ggf. 10%+. Reduziert die effektive Jahresmiete.',
      severity: 'beginner'
    },
    'tab3.btj': {
      title: 'Betrachtungszeitraum',
      body: 'Über wie viele Jahre sollen Cashflow, Rendite und Vermögensaufbau berechnet werden? 10 Jahre = Spekulationsfrist nach § 23 EStG (steuerfreier Verkauf möglich). 15-20 Jahre = langfristige Investorenrechnung. 30+ Jahre = vollständige Tilgung.',
      paragraph: '§ 23 EStG',
      severity: 'beginner'
    },
    'tab3.exit_bmy': {
      title: 'Exit-Rendite (Verkauf)',
      body: 'Erwartete Brutto-Mietrendite des Käufers beim Exit — bestimmt den Verkaufspreis. Wir berechnen: Exit-Preis = Jahres-NKM ÷ Exit-Rendite. Niedrigere Exit-Rendite = höherer Verkaufspreis. Beispiel: 10.000 € NKM / 5% = 200.000 € Verkaufspreis (20-fache Jahresmiete).',
      severity: 'pro'
    },

    // ──────── TAB 4: STEUER-DETAILS ───────────────────────────────────────
    'tab4.zve': {
      title: 'zvE — zu versteuerndes Einkommen',
      body: 'Dein zu versteuerndes Einkommen ohne diese Immobilie. Du findest es im letzten Steuerbescheid unter "zu versteuerndes Einkommen". Daraus berechnet sich der Grenzsteuersatz: bei zvE 30.000 € ≈ 25%, bei 60.000 € ≈ 35%, bei 80.000 € ≈ 42% (Höchstsatz).',
      paragraph: '§ 32a EStG',
      severity: 'beginner'
    },
    'tab4.grenzsteuersatz': {
      title: 'Grenzsteuersatz',
      body: 'Steuersatz auf den nächsten verdienten Euro — entscheidend für die Wirkung der V+V-Verluste. Wenn DealPilot ihn aus dem zvE berechnen soll, einfach die Checkbox aktiv lassen. Reichensteuer (45%) ab 277.826 € zvE.',
      paragraph: '§ 32a EStG',
      severity: 'beginner'
    },
    'tab4.afa_satz': {
      title: 'AfA-Satz',
      body: 'Wie schnell wird das Gebäude abgeschrieben? Linear 2,0% (50 Jahre): Standard ab Baujahr 1925. Linear 2,5% (40 Jahre): vor 1925. Linear 3,0% (33 Jahre): Wohnzwecke mit Bauantrag ab 2023. Degressiv 5,0%: nur für Neubau-Wohnbau (Bauantrag 10/2023 – 09/2029).',
      paragraph: '§ 7 EStG',
      severity: 'beginner'
    },
    'tab4.geb_anteil': {
      title: 'Gebäudeanteil',
      body: 'Anteil des Gebäudes am Kaufpreis. Der Rest ist Grundstücksanteil und NICHT abschreibbar. Standard: 80% Gebäude / 20% Grundstück (ETW). Bei A-Lagen kann der Grundstücksanteil 30-40% betragen. Exakte Werte über BMF-Sachwertverfahren oder Gutachten ermitteln.',
      severity: 'pro'
    },
    'tab4.degressive_afa': {
      title: 'Degressive AfA § 7 Abs. 5a EStG',
      body: 'Nur für Wohngebäude mit Bauantrag oder Kaufvertrag zwischen 01.10.2023 und 30.09.2029. Die AfA wird in den ersten Jahren deutlich höher (5% vom Restbuchwert) und sinkt jedes Jahr — bringt frühe Steuervorteile, hilft bei der Anlauf-Cashflow-Phase.',
      paragraph: '§ 7 Abs. 5a EStG',
      format: 'infobox',
      severity: 'critical'
    },
    'tab4.sonder_7b': {
      title: '§ 7b Sonder-AfA',
      body: 'Nur für Mietwohnungs-Neubau (Effizienzhaus 40 NH, Baukosten ≤ 5.200 €/m², 10 Jahre Vermietungspflicht, Bauantrag/Kaufvertrag zwischen 01.01.2023 und 30.09.2029). Wenn alle 4 Bedingungen erfüllt: zusätzliche 5% AfA p.a. in den ersten 4 Jahren — 20% Bonus auf förderfähige Basis (max. 4.000 €/m²).',
      paragraph: '§ 7b EStG',
      format: 'infobox',
      severity: 'critical'
    },

    // ──────── TAB 5: FINANZIERUNG ─────────────────────────────────────────
    'tab5.eigenkapital': {
      title: 'Eigenkapital',
      body: 'Wieviel zahlst du aus eigener Tasche? Banken geben für Wohnimmobilien typischerweise bis zu 100% Kaufpreis-Finanzierung — die Erwerbsnebenkosten (~10%) musst du aus eigenen Mitteln zahlen. Mehr EK = besserer LTV = bessere Konditionen.',
      severity: 'beginner'
    },
    'tab5.ltv_basis': {
      title: 'LTV-Bezugsgröße',
      body: 'Loan-to-Value — Darlehen geteilt durch was? Standard-Bankenpraxis: LTV gegen Kaufpreis (oder Verkehrswert). Konservativere Sicht: LTV gegen Gesamtinvestition inkl. Nebenkosten — strenger, weil Notar/GrESt/Makler nicht als Sicherheit zählen.',
      severity: 'pro'
    },
    'tab5.zinsbindung': {
      title: 'Zinsbindung',
      body: 'Wie lange ist dein Zinssatz fixiert? Kurze Bindung (5-10 Jahre) = flexibler + günstiger, aber höheres Anschlussrisiko. Lange Bindung (15-25 Jahre) = Planungssicherheit + Preisaufschlag. Bei aktueller flacher Zinsstruktur: 10-15 Jahre meist optimal.',
      severity: 'beginner'
    },
    'tab5.tilgung': {
      title: 'Tilgung p.a.',
      body: 'Wieviel deiner Schulden tilgst du pro Jahr (in % der Darlehenssumme). Banken verlangen heute meist mindestens 2%. Höhere Tilgung = schnellere Entschuldung + geringere Restschuld bei Anschlussfinanzierung. Faustregel: mindestens 2,5% bei 10 Jahre Zinsbindung.',
      severity: 'beginner'
    },
    'tab5.kfw': {
      title: 'KfW-Förderdarlehen',
      body: 'Die KfW vergibt vergünstigte Darlehen für Wohngebäude (KfW 261), energetische Sanierung (KfW 458), Familien (KfW 300) und mehr. Niedrige Zinsen, teils Tilgungszuschüsse — aber strenge Bedingungen. Lohnt sich fast immer zu prüfen.',
      severity: 'pro'
    },
    'tab5.tilgungsaussetzung': {
      title: 'Tilgungsaussetzungsdarlehen',
      body: 'Während der Laufzeit zahlst du nur Zinsen — die Tilgung erfolgt am Ende über einen Tilgungsträger (Bausparvertrag, Lebensversicherung, Fondssparplan). Steuerlich vorteilhaft: Zinskosten bleiben konstant hoch = mehr abzugsfähige Werbungskosten. Aber höheres Risiko bei Marktrückgang.',
      severity: 'pro'
    },
    'tab5.dscr': {
      title: 'DSCR — Debt Service Coverage Ratio',
      body: 'Schuldendeckungsgrad: Mieteinnahmen ÷ Kapitaldienst (Zins + Tilgung). Banken wollen ≥ 1,2 sehen (Miete deckt Kapitaldienst + 20% Puffer). Achtung: DSCR berücksichtigt KEINE Bewirtschaftungskosten und Steuern — Cashflow kann trotz DSCR > 1 negativ sein!',
      severity: 'pro'
    },
    'tab5.ltv': {
      title: 'LTV — Loan-to-Value',
      body: 'Beleihungsauslauf: Darlehenssumme ÷ Verkehrswert (oder Kaufpreis). Bis 60% = Top-Konditionen ("Premium"). 60-80% = Standard. 80-90% = Risikoaufschlag. Über 90% = "Vollfinanzierung", deutlich teurer und nicht von allen Banken angeboten.',
      severity: 'pro'
    },
    'tab5.zinsaenderungsrisiko': {
      title: 'Zinsänderungsrisiko',
      body: 'Mehrkosten pro Monat falls die Anschluss-Zinsen höher liegen als die aktuelle Kalkulation. Beispiel: 3,5% heute → 5% Anschluss = ~100-150 €/Monat mehr. Über 25 Jahre Restlaufzeit kann das 30-50.000 € Mehrkosten bedeuten.',
      severity: 'pro'
    },

    // ──────── TAB 6: BEWIRTSCHAFTUNG ──────────────────────────────────────
    'tab6.hg_umlagefaehig': {
      title: 'Hausgeld (umlagefähig)',
      body: 'Anteil des monatlichen Hausgelds, den du auf den Mieter umlegen darfst: Heizung, Wasser, Müll, Hausreinigung, Aufzugswartung, Hausmeister, Versicherungen, Grundsteuer. Steht in der Hausgeld-Abrechnung.',
      paragraph: 'BetrKV § 2',
      severity: 'beginner'
    },
    'tab6.hg_nicht_umlagefaehig': {
      title: 'Hausgeld (nicht umlagefähig)',
      body: 'Anteil des Hausgelds, den DU trägst — kann NICHT auf den Mieter umgelegt werden: Verwaltergebühren, WEG-Rücklage, Bankgebühren, anteilige Sanierungen aus der Rücklage. Typisch 30-50% des Gesamthausgelds.',
      severity: 'beginner'
    },
    'tab6.weg_ruecklage': {
      title: 'WEG-Rücklage (nur Info!)',
      body: 'Anteil der monatlichen WEG-Rücklage am Hausgeld — wird NICHT zusätzlich summiert, ist BEREITS Teil des nicht-umlagefähigen Hausgelds. Nur zur Information für deine eigene Übersicht. Doppelt-Einrechnen führt zu falscher Cashflow-Berechnung!',
      format: 'infobox',
      severity: 'critical'
    },
    'tab6.eigene_irl': {
      title: 'Eigene Instandhaltungsrücklage',
      body: 'Zusätzliches Geld, das DU zurücklegst — NEBEN der WEG-Rücklage. Für sondereigentums-spezifische Sanierungen (eigenes Bad, Heizung, Fenster). Faustregel: 1-2% vom Kaufpreis p.a. bei ETW, 5-10% der NKM bei MFH.',
      severity: 'pro'
    },
    'tab6.sonderverwaltung': {
      title: 'Sonderverwaltung',
      body: 'Zusätzliche Verwalter-Gebühren für Sonderaufgaben: WEG-Versammlungs-Vorbereitung, juristische Beratung, Sonder-Abrechnungen. Bei MFH selbst-verwaltet: 0. Bei ETW im WEG: meist im Hausgeld enthalten — hier dann 0.',
      severity: 'pro'
    },
    'tab6.kalkulat_mietausfall': {
      title: 'Kalkulatorischer Mietausfall',
      body: 'Konservativer Puffer für Mieterwechsel, Leerstand und Zahlungsausfälle. Bei stabilem Mieter: 0. Bei normalem Risiko: 1-2 Monatsmieten p.a. Bei strukturschwacher Lage: 3-4 Monate. Wird je nach DS2-Mietausfall-Risiko (Tab Miete) auto-vorbefüllt.',
      severity: 'pro'
    },
    'tab6.sonstiges_umlagefaehig': {
      title: 'Sonstiges umlagefähig',
      body: 'Weitere umlagefähige Positionen: Schornsteinfeger, Hausmeister, Aufzugs-Wartung, Müllabfuhr, anteilige Gebäudeversicherung, Strom für Treppenhaus.',
      paragraph: 'BetrKV § 2',
      severity: 'pro'
    },

    // ──────── TAB 7: KI-ANALYSE ───────────────────────────────────────────
    'tab7.ki_credits': {
      title: 'KI-Credits',
      body: 'Eine vollständige KI-Analyse kostet 2 Credits. KI-Lage-Bewertung und KI-Mietpreis-Analyse: je 1 Credit. Du kannst Credit-Pakete kaufen oder über das Abo erhalten.',
      severity: 'beginner'
    },
    'tab7.analyse_parameter': {
      title: 'Analyse-Parameter',
      body: 'Diese 4 Parameter werden in den Einstellungen unter "KI" gepflegt: Strategie (Buy&Hold, Flip etc.), Verkäuferbereitschaft (verhandlungsbereit / fest), eigene Risikotoleranz (konservativ / moderat / aggressiv), Marktphase (Buy / Hold / Sell). Die KI nutzt sie als Kontext für ihre Empfehlung.',
      severity: 'pro'
    },
    'tab7.empfehlungs_skala': {
      title: 'DealPilot-Empfehlung',
      body: 'Skala: KAUFEN (DealScore > 85, klar überdurchschnittliches Deal), PRÜFEN (60-85, attraktiv aber mit Vorbehalten), VORSICHT (40-60, kritische Punkte überwiegen), NICHT KAUFEN (< 40, deutliche rote Flaggen). Die Skala ist intern, nicht offiziell.',
      severity: 'beginner'
    },

    // ──────── TAB 8: BEWERTUNG ────────────────────────────────────────────
    'tab8.dealpilot_score': {
      title: 'DealPilot Score',
      body: 'Vereinfachter Score (0-100) basierend auf 5 Faktoren: Cashflow (30%), Rendite NMR (25%), LTV (15%), Risiko DSCR (15%), Potenzial Wertpuffer+Miete (15%). Entspricht exakt dem Quick-Check-Score. Gewichtung anpassbar.',
      severity: 'beginner'
    },
    'tab8.investor_score': {
      title: 'Investor Deal Score 2.0',
      body: 'Erweiterter Score mit 24 KPIs: Rendite (35%), Risiko (20%), Finanzierung (25%), Lage & Markt (10%), Upside-Potenzial (10%). Bewertet auch Substanz, Energie-Zustand, Mietpotenzial. Für Profi-Investoren-Sicht.',
      severity: 'pro'
    },
    'tab8.bruttomietrendite': {
      title: 'Bruttomietrendite',
      body: 'Statische Erst-Rendite: Jahres-Nettokaltmiete ÷ Kaufpreis. Üblich 4-7% in Deutschland. Über 6%: solide Ausgangsbasis. Unter 4%: nur attraktiv bei sicherer Lage und hohem Wertsteigerungs-Potenzial.',
      severity: 'beginner'
    },
    'tab8.nettomietrendite': {
      title: 'Nettomietrendite (NMR)',
      body: 'Realistische Rendite: (NKM − nicht-umlagefähige BWK) ÷ Gesamtinvestition (inkl. Nebenkosten). Über 4%: operativ profitabel. Unter 3%: braucht Wertsteigerung um Sinn zu machen.',
      severity: 'beginner'
    },
    'tab8.cashflow_rendite': {
      title: 'Cashflow-Rendite',
      body: 'Cashflow nach Steuern geteilt durch Immobilienwert. Zeigt: was bringt mir die Immobilie netto auf die Hand? Vergleichbar mit Dividende einer Aktie. 1-3% ist üblich, über 3% sehr gut.',
      severity: 'pro'
    },
    'tab8.ek_rendite': {
      title: 'EK-Rendite (Eigenkapital-Rendite)',
      body: 'Cashflow nach Steuern ÷ eingesetztes Eigenkapital. Bei 100%-Finanzierung mit nur Kaufnebenkosten als EK: oft 20%+ (Leverage-Effekt). Bei viel EK: niedriger, dafür sicherer. ∞ bei 0 € EK = maximaler Hebel.',
      severity: 'pro'
    },
    'tab8.equity_multiple': {
      title: 'Equity Multiple',
      body: 'Vermögenszuwachs ÷ eingesetztes Eigenkapital. Wie oft hat sich dein EK über die Haltedauer vermehrt? Bei 10 Jahre Halten ist 2-4× üblich. Über 5× = sehr starker Deal. ∞ bei 0 € EK = unendlicher Hebel (Risiko bei Marktrückgang!).',
      severity: 'pro'
    },
    'tab8.wertpuffer': {
      title: 'Wertpuffer',
      body: 'Verkehrswert minus Kaufpreis. Wenn der Verkehrswert (Sachverständigen-Gutachten) höher als der Kaufpreis ist: positiver Wertpuffer = sofortiger Buchgewinn. Negativer Wertpuffer = du zahlst über Marktwert.',
      severity: 'pro'
    },
    'tab8.tilgung_vom_mieter': {
      title: 'Tilgung vom Mieter',
      body: 'Anteil der Tilgung, der durch die Mieteinnahmen gedeckt wird. Wenn der Cashflow nach Bedienung der Bank positiv ist: 100% der Tilgung kommt vom Mieter. Bei negativem Cashflow zahlst du den Rest aus eigener Tasche.',
      severity: 'pro'
    },
    'tab8.stress_matrix': {
      title: 'Stress-Matrix',
      body: 'DSCR-Werte für 25 Szenarien: 5 Stufen Mietausfall (−20% bis +20%) × 5 Stufen Zinsänderung (−2pp bis +5pp). Grün = Bank-OK (DSCR ≥ 1,2). Gelb = Achtung (1,0-1,2). Rot = Stresszone (< 1,0). Zeigt wie robust dein Deal ist.',
      severity: 'pro'
    },
  // ─── V235.1: tab8.ltv_basis (rest waren Duplikate) ──────────────
  'tab8.ltv_basis': {
    title: 'LTV — Loan-to-Value',
    body: 'Das <b>Loan-to-Value</b>-Verhältnis zeigt wie hoch deine Restschuld im Verhältnis zum Immobilien-Wert ist. Die Bank nutzt das als wichtigstes Risikomaß.<br><br><b>Welcher Wert ist die Basis?</b><br>• <b>Wenn Sachverständigenwert vorhanden</b>: dieser wird genutzt<br>• <b>Sonst</b>: Kaufpreis<br>• <b>Optional bei Setup</b>: Gesamtinvestition (KP + Nebenkosten) — strenger<br><br><b>LTV-Stufen:</b><br>• Unter 60 % — Tier 1 (beste Konditionen)<br>• 60-80 % — Standard<br>• 80-95 % — Risikoaufschlag<br>• Über 95 % — Vollfinanzierung, höchste Zinsen<br><br><b>Im Zeitverlauf</b> sinkt der LTV durch Tilgung und Wertsteigerung — wichtig für Anschlussfinanzierung.'
  },

  };

  // Anzahl + Export
  var _count = Object.keys(T).length;

  window.DpTooltips = {
    content: T,
    count: _count,
    /**
     * Liefert das Content-Object oder null wenn nicht vorhanden.
     */
    get: function (id) { return T[id] || null; },
    /**
     * Liefert alle Keys eines Tabs (z.B. 'tab1.*').
     */
    forTab: function (tabPrefix) {
      var keys = [];
      for (var k in T) {
        if (k.indexOf(tabPrefix + '.') === 0) keys.push(k);
      }
      return keys;
    },
    VERSION: 'V228'
  };
})();
