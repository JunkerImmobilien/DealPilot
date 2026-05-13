/**
 * DealPilot — BTE-Lebensdauerkatalog
 * =====================================
 * Auszug aus dem Lebensdauerkatalog des Bund Deutscher Experten (BTE)
 * Empfehlungen der BTE-Arbeitsgruppe + statistische Auswertungen.
 *
 * Quelle: Gutachten 25DG06644 Kapitel 3.3 b)
 * Werte = Mittelwerte (MW) der BTE-Empfehlung in Jahren.
 *
 * Bauteilgliederung nach DIN 276-1
 *
 * Verwendung:
 *   const ld = DealPilotRND_BTE.get('8.2.5');     // Dachziegel = 60 Jahre
 *   const list = DealPilotRND_BTE.search('Heizung');
 *   const cat = DealPilotRND_BTE.byCategory();    // Hierarchisch gruppiert
 */
(function (global) {
  'use strict';

  // [code, label, category, mw_jahre]  — MW = Mittelwert BTE-Empfehlung
  // Werte 1:1 aus Gutachten Tabelle Kap. 3.3 b
  const BTE = [
    // 2.5.6 Fensterbänke außen (Beispiele)
    { code: '2.5.6.2', label: 'Kunststoff (Fensterbänke außen)',  cat: 'Fenster',           mw: 25 },
    { code: '2.5.6.3', label: 'Stahl (Fensterbänke außen)',       cat: 'Fenster',           mw: 30 },
    { code: '2.5.6.4', label: 'Aluminium (Fensterbänke außen)',   cat: 'Fenster',           mw: 35 },

    // 2.5.7 Abdeckungen, Fensterbänke
    { code: '2.5.7.1', label: 'Naturstein (Abdeckung)',           cat: 'Abdeckungen',       mw: 75 },
    { code: '2.5.7.2', label: 'Kunststein (Abdeckung)',           cat: 'Abdeckungen',       mw: 75 },
    { code: '2.5.7.3', label: 'Aluminium (Abdeckung)',            cat: 'Abdeckungen',       mw: 50 },
    { code: '2.5.7.4', label: 'Kupfer (Abdeckung)',               cat: 'Abdeckungen',       mw: 60 },
    { code: '2.5.7.5', label: 'Faserzement (Abdeckung)',          cat: 'Abdeckungen',       mw: 40 },
    { code: '2.5.7.6', label: 'Zinkblech (Abdeckung)',            cat: 'Abdeckungen',       mw: 40 },
    { code: '2.5.7.7', label: 'Kunststoff (Abdeckung)',           cat: 'Abdeckungen',       mw: 30 },

    // 3 Innenwände
    { code: '3.1.1',   label: 'Innenwand Beton',                  cat: 'Innenwände',        mw: 100 },
    { code: '3.1.2',   label: 'Innenwand Ziegel',                 cat: 'Innenwände',        mw: 100 },
    { code: '3.1.3',   label: 'Innenwand Stein',                  cat: 'Innenwände',        mw: 100 },
    { code: '3.1.4',   label: 'Innenwand Holz weich',             cat: 'Innenwände',        mw: 50 },
    { code: '3.1.5',   label: 'Innenwand Holz hart',              cat: 'Innenwände',        mw: 75 },
    { code: '3.1.6',   label: 'Innenwand Metallständer/Stahlblech',cat:'Innenwände',        mw: 40 },

    // 3.2 Bekleidungen
    { code: '3.2.1',   label: 'Gipskarton-/Gipsfaserplatten',     cat: 'Wandbekleidung',    mw: 50 },
    { code: '3.2.2',   label: 'Putz',                             cat: 'Wandbekleidung',    mw: 70 },
    { code: '3.2.3',   label: 'Holz (Wandbekleidung)',            cat: 'Wandbekleidung',    mw: 40 },
    { code: '3.2.4',   label: 'Fliesen (Wand)',                   cat: 'Wandbekleidung',    mw: 40 },

    // 3.3 Innenanstriche
    { code: '3.3.1',   label: 'Innenanstrich',                    cat: 'Anstriche',         mw: 8 },
    { code: '3.3.2',   label: 'Tapeten',                          cat: 'Anstriche',         mw: 10 },

    // 3.4 Innentüren / Fensterbänke innen
    { code: '3.4.1.1', label: 'Holztür (innen)',                  cat: 'Innentüren',        mw: 60 },
    { code: '3.4.1.2', label: 'Stahltür (innen)',                 cat: 'Innentüren',        mw: 40 },
    { code: '3.4.1.3', label: 'Sperrholz/Schichtholz (innen)',    cat: 'Innentüren',        mw: 40 },
    { code: '3.4.1.4', label: 'Glastür (innen)',                  cat: 'Innentüren',        mw: 50 },
    { code: '3.4.3.1', label: 'Holz (Fensterbank innen)',         cat: 'Innentüren',        mw: 50 },
    { code: '3.4.3.2', label: 'Naturstein/Keramik (Fensterbank innen)', cat: 'Innentüren',  mw: 70 },
    { code: '3.4.3.3', label: 'Kunststoff/Alu (Fensterbank innen)',cat: 'Innentüren',       mw: 50 },

    // 4 Decken, Treppen
    { code: '4.1.1',   label: 'Deckenkonstruktion Beton',         cat: 'Decken',            mw: 100 },
    { code: '4.1.2',   label: 'Deckenkonstruktion Weichholz',     cat: 'Decken',            mw: 65 },
    { code: '4.1.3',   label: 'Deckenkonstruktion Hartholz',      cat: 'Decken',            mw: 75 },
    { code: '4.1.4',   label: 'Deckenkonstruktion Stahl',         cat: 'Decken',            mw: 80 },
    { code: '4.1.5',   label: 'Steindecke / Kappendecke',         cat: 'Decken',            mw: 90 },

    { code: '4.2.1',   label: 'Estrich, schwimmend',              cat: 'Estrich',           mw: 50 },

    // 4.3 Bodenbeläge
    { code: '4.3.1',   label: 'Naturstein (Bodenbelag)',          cat: 'Böden',             mw: 80 },
    { code: '4.3.2',   label: 'Naturstein, weich',                cat: 'Böden',             mw: 80 },
    { code: '4.3.2b',  label: 'Betonwerkstein, Kunststein',       cat: 'Böden',             mw: 70 },
    { code: '4.3.3',   label: 'Hartholz, Keramik, Parkett',       cat: 'Böden',             mw: 80 },
    { code: '4.3.4',   label: 'Weichholz, Vollparkett',           cat: 'Böden',             mw: 60 },
    { code: '4.3.5',   label: 'PVC',                              cat: 'Böden',             mw: 25 },
    { code: '4.3.6',   label: 'Linoleum',                         cat: 'Böden',             mw: 30 },
    { code: '4.3.7',   label: 'Textil (Teppich)',                 cat: 'Böden',             mw: 15 },
    { code: '4.3.8',   label: 'Laminat',                          cat: 'Böden',             mw: 20 },
    { code: '4.3.9',   label: 'Parkett, Fertigparkett',           cat: 'Böden',             mw: 40 },
    { code: '4.3.10',  label: 'Fliesen (Boden)',                  cat: 'Böden',             mw: 40 },
    { code: '4.3.11',  label: 'Natursteinfliesen',                cat: 'Böden',             mw: 40 },

    { code: '4.4.1',   label: 'Versiegelung, Lack',               cat: 'Bodenschutz',       mw: 7 },
    { code: '4.4.2',   label: 'Imprägnierung, Öl, Wachs',         cat: 'Bodenschutz',       mw: 7 },

    // 4.5 Deckenbekleidung
    { code: '4.5.1.1', label: 'Abhängekonstruktion Holz',         cat: 'Deckenbekleidung',  mw: 60 },
    { code: '4.5.1.2', label: 'Abhängekonstruktion Metall',       cat: 'Deckenbekleidung',  mw: 40 },
    { code: '4.5.2.1', label: 'Bekleidung Holz',                  cat: 'Deckenbekleidung',  mw: 50 },
    { code: '4.5.2.2', label: 'Bekleidung Metall',                cat: 'Deckenbekleidung',  mw: 50 },
    { code: '4.5.2.3', label: 'Bekleidung Gipskarton',            cat: 'Deckenbekleidung',  mw: 50 },
    { code: '4.5.2.4', label: 'Bekleidung Kunststoff',            cat: 'Deckenbekleidung',  mw: 30 },
    { code: '4.5.2.5', label: 'Bekleidung Putz',                  cat: 'Deckenbekleidung',  mw: 50 },
    { code: '4.5.2.6', label: 'Mineralfaser (OWA etc.)',          cat: 'Deckenbekleidung',  mw: 30 },

    // 5 Treppen
    { code: '5.1.1',   label: 'Treppe Beton',                     cat: 'Treppen',           mw: 50 },
    { code: '5.1.2',   label: 'Treppe Stahl',                     cat: 'Treppen',           mw: 50 },
    { code: '5.1.3',   label: 'Treppe Weichholz',                 cat: 'Treppen',           mw: 20 },
    { code: '5.1.4',   label: 'Treppe Hartholz',                  cat: 'Treppen',           mw: 30 },
    { code: '5.4.1',   label: 'Treppengeländer Stahl',            cat: 'Treppen',           mw: 50 },
    { code: '5.4.2',   label: 'Treppengeländer Aluminium',        cat: 'Treppen',           mw: 50 },
    { code: '5.4.3',   label: 'Treppengeländer Holz',             cat: 'Treppen',           mw: 25 },

    // 6 Balkone
    { code: '6.1.1',   label: 'Balkonkonstruktion Beton',         cat: 'Balkone',           mw: 80 },
    { code: '6.1.2',   label: 'Balkonkonstruktion Stahl',         cat: 'Balkone',           mw: 70 },
    { code: '6.1.3',   label: 'Balkonkonstruktion Holz weich',    cat: 'Balkone',           mw: 40 },

    // 7 Flachdächer
    { code: '7.2.1',   label: 'Bituminöse Abdichtung',            cat: 'Flachdach',         mw: 25 },
    { code: '7.2.2',   label: 'Kunststoff-Abdichtung hochwertig', cat: 'Flachdach',         mw: 25 },
    { code: '7.2.3',   label: 'Kunststoff-Abdichtung einfach',    cat: 'Flachdach',         mw: 17 },
    { code: '7.3',     label: 'Ausstiege, Lichtöffnungen',        cat: 'Flachdach',         mw: 25 },

    // 8 Geneigte Dächer
    { code: '8.1',     label: 'Geneigte Dachkonstruktion (Mittel)',cat: 'Dach',             mw: 75 },
    { code: '8.1.1',   label: 'Holz/Stahl/Nagelbinder (Dach)',    cat: 'Dach',              mw: 75 },
    { code: '8.1.3',   label: 'Stahl (Dachkonstruktion)',         cat: 'Dach',              mw: 75 },
    { code: '8.1.6',   label: 'Leimbinder/BSH',                   cat: 'Dach',              mw: 75 },
    { code: '8.1.7',   label: 'Nagelbinder',                      cat: 'Dach',              mw: 75 },

    // 8.2 Dachdeckungen
    { code: '8.2.1',   label: 'Zinkblech (Dach)',                 cat: 'Dachdeckung',       mw: 40 },
    { code: '8.2.2',   label: 'Kupferblech (Dach)',               cat: 'Dachdeckung',       mw: 70 },
    { code: '8.2.3',   label: 'Stahlprofilblech (Trapezblech)',   cat: 'Dachdeckung',       mw: 40 },
    { code: '8.2.4',   label: 'Faserzementplatten',               cat: 'Dachdeckung',       mw: 40 },
    { code: '8.2.5',   label: 'Dachziegel',                       cat: 'Dachdeckung',       mw: 60 },
    { code: '8.2.6',   label: 'Dachsteine (Beton)',               cat: 'Dachdeckung',       mw: 50 },
    { code: '8.2.7',   label: 'Schieferplatten',                  cat: 'Dachdeckung',       mw: 75 },
    { code: '8.2.9',   label: 'Aluminium-Dach',                   cat: 'Dachdeckung',       mw: 40 },

    // 8.3 Sperrstoffe / Dampfsperre
    { code: '8.3.1',   label: 'Dampfsperre (allg.)',              cat: 'Dachdämmung',       mw: 40 },
    { code: '8.3.1.1', label: 'PE-Folie',                         cat: 'Dachdämmung',       mw: 40 },
    { code: '8.3.1.2', label: 'Aluminiumfolie',                   cat: 'Dachdämmung',       mw: 40 },
    { code: '8.3.2',   label: 'Dampfbremse',                      cat: 'Dachdämmung',       mw: 40 },
    { code: '8.3.3',   label: 'Winddichtung',                     cat: 'Dachdämmung',       mw: 40 },
    { code: '8.3.4',   label: 'Abdichtung (Klebebänder/Komprib.)',cat: 'Dachdämmung',       mw: 20 },

    // 8.4 Dachöffnungen
    { code: '8.4.1',   label: 'Dachfenster Stahl',                cat: 'Dachöffnungen',     mw: 30 },
    { code: '8.4.2',   label: 'Dachfenster Holz',                 cat: 'Dachöffnungen',     mw: 30 },
    { code: '8.4.3',   label: 'Dachfenster Kunststoff',           cat: 'Dachöffnungen',     mw: 30 },

    // 8.5 Dachentwässerung
    { code: '8.5.1.1', label: 'Rinne/Fallrohr Zinkblech',         cat: 'Entwässerung',      mw: 30 },
    { code: '8.5.1.2', label: 'Rinne/Fallrohr Kunststoff',        cat: 'Entwässerung',      mw: 20 },
    { code: '8.5.1.3', label: 'Rinne/Fallrohr Kupferblech',       cat: 'Entwässerung',      mw: 50 },

    // 8.6/8.7 Schornsteine, Schneefänge
    { code: '8.6.1',   label: 'Schneefang/Leiter Zink',           cat: 'Dachzubehör',       mw: 30 },
    { code: '8.6.2',   label: 'Schneefang/Leiter Stahl',          cat: 'Dachzubehör',       mw: 30 },
    { code: '8.7.1',   label: 'Schornstein Edelstahl',            cat: 'Schornstein',       mw: 50 },
    { code: '8.7.2',   label: 'Schornstein Formsteine',           cat: 'Schornstein',       mw: 60 },
    { code: '8.7.3',   label: 'Schornstein Mauerwerk',            cat: 'Schornstein',       mw: 60 },

    // 9 Abwasseranlagen
    { code: '9.1.1',   label: 'PVC-Rohr / PP-Rohr (Abwasser)',    cat: 'Abwasser',          mw: 70 },
    { code: '9.1.2',   label: 'Steinzeug (Abwasser)',             cat: 'Abwasser',          mw: 60 },
    { code: '9.1.3',   label: 'Gussrohr (Abwasser)',              cat: 'Abwasser',          mw: 50 },
    { code: '9.1.4',   label: 'Hebeanlage',                       cat: 'Abwasser',          mw: 25 },

    // 10 Wasseranlagen
    { code: '10.1.1',  label: 'Stahlrohr (Wasser)',               cat: 'Wasserleitungen',   mw: 35 },
    { code: '10.1.2',  label: 'Kupferrohr (Wasser)',              cat: 'Wasserleitungen',   mw: 45 },
    { code: '10.1.3',  label: 'Edelstahl/Verbund/Kunststoff',     cat: 'Wasserleitungen',   mw: 50 },
    { code: '10.2',    label: 'Wasseraufbereitung',               cat: 'Wasserleitungen',   mw: 15 },
    { code: '10.3.1',  label: 'Duschabtrennung Alu/Kunststoff',   cat: 'Sanitär',           mw: 12 },
    { code: '10.3.2',  label: 'Duschabtrennung Glas',             cat: 'Sanitär',           mw: 17 },
    { code: '10.3',    label: 'Sanitärobjekte (allg.)',           cat: 'Sanitär',           mw: 30 },

    // 11 Warmwasser
    { code: '11.2',    label: 'Zentraler Warmwasserwärmer',       cat: 'Warmwasser',        mw: 20 },
    { code: '11.3',    label: 'Durchlauferhitzer Gas/Elektro',    cat: 'Warmwasser',        mw: 20 },
    { code: '11.4',    label: 'Thermische Solaranlage',           cat: 'Warmwasser',        mw: 20 },

    // 12 Gas
    { code: '12.1',    label: 'Gasleitungen',                     cat: 'Gas',               mw: 50 },

    // 13 Heizung
    { code: '13.1.1',  label: 'Pumpen, Motoren (Heizung)',        cat: 'Heizung',           mw: 15 },
    { code: '13.2',    label: 'Gasheizthermen',                   cat: 'Heizung',           mw: 20 },
    { code: '13.3',    label: 'Heizrohrleitungen',                cat: 'Heizung',           mw: 40 },
    { code: '13.4',    label: 'Brenner',                          cat: 'Heizung',           mw: 20 },
    { code: '13.5',    label: 'Feststoffbrennkessel (Holz/Kohle)',cat: 'Heizung',           mw: 20 },
    { code: '13.6',    label: 'Holzpellet-Heizkessel',            cat: 'Heizung',           mw: 17 },
    { code: '13.7',    label: 'Gasheizkessel',                    cat: 'Heizung',           mw: 21 },
    { code: '13.8',    label: 'Ölheizkessel',                     cat: 'Heizung',           mw: 17 },
    { code: '13.9',    label: 'Blockheizkraftwerk Kleinanlage',   cat: 'Heizung',           mw: 15 },
    { code: '13.10',   label: 'Fernwärmeübergabe',                cat: 'Heizung',           mw: 16 },
    { code: '13.11',   label: 'Wärmepumpenanlage',                cat: 'Heizung',           mw: 21 },
    { code: '13.6.1',  label: 'Heizöltank im Keller',             cat: 'Heizung',           mw: 45 },
    { code: '13.6.2',  label: 'Heizöltank unterirdisch',          cat: 'Heizung',           mw: 45 },
    { code: '13.7.1',  label: 'Stahlblechrippen-Heizkörper',      cat: 'Heizkörper',        mw: 40 },
    { code: '13.7.2',  label: 'Stahlblechflächen-Heizkörper',     cat: 'Heizkörper',        mw: 40 },
    { code: '13.7.3',  label: 'Gusseisen-Heizkörper',             cat: 'Heizkörper',        mw: 65 },
    { code: '13.7.5',  label: 'Flächenheizsysteme (Fußbodenh.)',  cat: 'Heizkörper',        mw: 50 },

    // 14 Lüftung
    { code: '14.1',    label: 'Abluftanlagen',                    cat: 'Lüftung',           mw: 30 },
    { code: '14.2',    label: 'Wärmetauscher',                    cat: 'Lüftung',           mw: 30 },
    { code: '14.3',    label: 'Wärmerückgewinnung',               cat: 'Lüftung',           mw: 30 },
    { code: '14.4',    label: 'Lüftungsleitungen',                cat: 'Lüftung',           mw: 30 },

    // 15 Starkstrom
    { code: '15.1',    label: 'Leitungen unter Putz',             cat: 'Elektro',           mw: 50 },
    { code: '15.2',    label: 'Schalter, Steckdosen',             cat: 'Elektro',           mw: 25 },
    { code: '15.5',    label: 'Leuchten innen',                   cat: 'Elektro',           mw: 25 },
    { code: '15.6',    label: 'Leuchten außen',                   cat: 'Elektro',           mw: 20 },
    { code: '15.8',    label: 'Elektrische Nachtspeichergeräte',  cat: 'Elektro',           mw: 25 },
    { code: '15.9',    label: 'Elektrische Lüftungen',            cat: 'Elektro',           mw: 10 },
    { code: '15.10',   label: 'Blitzschutzanlagen',               cat: 'Elektro',           mw: 50 },

    // 16 Schwachstrom
    { code: '16.1',    label: 'Leitungen Schwachstrom',           cat: 'Schwachstrom',      mw: 50 },
    { code: '16.2',    label: 'Sprech-/Klingelanlagen',           cat: 'Schwachstrom',      mw: 25 },
    { code: '16.3',    label: 'Antennenanlagen',                  cat: 'Schwachstrom',      mw: 20 },
    { code: '16.4',    label: 'Brandmeldeanlagen',                cat: 'Schwachstrom',      mw: 20 },
    { code: '16.5.1',  label: 'PV-Regler',                        cat: 'Photovoltaik',      mw: 12 },
    { code: '16.5.2',  label: 'Photovoltaik-Zellen',              cat: 'Photovoltaik',      mw: 25 },

    // 17 Förderanlagen
    { code: '17.1.1',  label: 'Seilaufzüge',                      cat: 'Aufzüge',           mw: 40 },
    { code: '17.1.2',  label: 'Hydraulikaufzüge',                 cat: 'Aufzüge',           mw: 40 },
    { code: '17.2',    label: 'Liftanlagen',                      cat: 'Aufzüge',           mw: 40 },

    // 18 Befestigte Flächen
    { code: '18.1.1',  label: 'Natursteinbelag (außen)',          cat: 'Außenbelag',        mw: 25 },
    { code: '18.1.2',  label: 'Kunststeinbelag (außen)',          cat: 'Außenbelag',        mw: 25 },
    { code: '18.1.3',  label: 'Ziegel (außen)',                   cat: 'Außenbelag',        mw: 40 },
    { code: '18.1.4',  label: 'Kies (Belag)',                     cat: 'Außenbelag',        mw: 15 },
    { code: '18.1.5',  label: 'Holzpflaster',                     cat: 'Außenbelag',        mw: 15 },
    { code: '18.2.1',  label: 'Straße/Hof Beton',                 cat: 'Außenbelag',        mw: 35 },
    { code: '18.2.2',  label: 'Straße/Hof Asphalt',               cat: 'Außenbelag',        mw: 30 },
    { code: '18.2.3',  label: 'Straße/Hof Naturstein',            cat: 'Außenbelag',        mw: 50 },

    // 19 Einfriedungen
    { code: '19.1.1',  label: 'Mauer Ziegel',                     cat: 'Einfriedung',       mw: 60 },
    { code: '19.1.2',  label: 'Mauer Beton',                      cat: 'Einfriedung',       mw: 60 },
    { code: '19.2.1',  label: 'Holzzaun mit Sockel massiv',       cat: 'Einfriedung',       mw: 20 },
    { code: '19.2.2',  label: 'Holzzaun ohne Sockel',             cat: 'Einfriedung',       mw: 20 },
    { code: '19.2.3',  label: 'Drahtzaun mit Sockel',             cat: 'Einfriedung',       mw: 30 },
    { code: '19.2.4',  label: 'Drahtzaun mit Stahlpfosten',       cat: 'Einfriedung',       mw: 30 },

    // 20 Einbauten
    { code: '20.1',    label: 'Fahrradständer, Fahnenmaste',      cat: 'Einbauten',         mw: 25 },

    // 21 Abwasseranlagen außen
    { code: '21.1',    label: 'Abwasserkanäle (außen, allg.)',    cat: 'Abwasser außen',    mw: 60 },
    { code: '21.1.1',  label: 'Kanal Steinzeug',                  cat: 'Abwasser außen',    mw: 60 },
    { code: '21.1.2',  label: 'Kanal Beton',                      cat: 'Abwasser außen',    mw: 60 },
    { code: '21.1.3',  label: 'Kanal Stahl',                      cat: 'Abwasser außen',    mw: 60 },
    { code: '21.1.4',  label: 'Kanal PVC-U',                      cat: 'Abwasser außen',    mw: 60 },
    { code: '21.2.1',  label: 'Kläranlage Beton',                 cat: 'Abwasser außen',    mw: 60 },
    { code: '21.2.2',  label: 'Kläranlage Mauerwerk',             cat: 'Abwasser außen',    mw: 60 },
    { code: '21.3.1',  label: 'Kontrollschacht Beton',            cat: 'Abwasser außen',    mw: 60 },
    { code: '21.3.2',  label: 'Kontrollschacht Mauerwerk',        cat: 'Abwasser außen',    mw: 60 }
  ];

  // ============================================================
  // STANDARD-MAPPING auf die 9 RND-Gewerke
  // ============================================================
  // Gibt für jedes Gewerk die typischen BTE-Codes mit ihrer
  // gewichteten Lebensdauer zurück. Verwendung in techn. RND.
  const GEWERK_MAPPING = {
    'dach': [
      { code: '8.2.5', label: 'Dachziegel/Dachsteine', defaultMw: 60 },
      { code: '8.1',   label: 'Dachstuhl',              defaultMw: 80 }
    ],
    'fenster': [
      { code: '3.4.3.3', label: 'Fenster Kunststoff/Alu', defaultMw: 50 },
      { code: '_fenster_kunst', label: 'Fenster (Kunststoff, 25 J. lt. Gutachten)', defaultMw: 25 }
    ],
    'leitungen': [
      { code: '10.1.2', label: 'Wasserleitung Kupfer', defaultMw: 45 },
      { code: '9.1.1',  label: 'Abwasser PVC',          defaultMw: 50 } // Mittelwert 30-50
    ],
    'heizung': [
      { code: '13.7',   label: 'Gasheizkessel',         defaultMw: 25 } // 21-25
    ],
    'aussenwand': [
      { code: '_wdvs',  label: 'Wärmedämmverbundsystem', defaultMw: 35 },
      { code: '_farbe', label: 'Farbe/Anstrich Außen',   defaultMw: 12 }
    ],
    'baeder': [
      { code: '10.3',   label: 'Sanitärobjekte',         defaultMw: 30 }
    ],
    'decken': [
      { code: '4.1.1',  label: 'Geschossdecke Beton',    defaultMw: 100 }
    ],
    'technik': [
      { code: '_technik', label: 'Technische Ausstattung allg.', defaultMw: 25 }
    ],
    'grundriss': [
      { code: '_grundriss', label: 'Bauliche Grundsubstanz', defaultMw: 70 }
    ]
  };

  // ============================================================
  // API
  // ============================================================
  function get(code) {
    const e = BTE.find(function (x) { return x.code === code; });
    return e ? e.mw : null;
  }

  function getEntry(code) {
    return BTE.find(function (x) { return x.code === code; }) || null;
  }

  function search(text) {
    const t = String(text || '').toLowerCase();
    return BTE.filter(function (x) {
      return x.label.toLowerCase().indexOf(t) >= 0
          || x.cat.toLowerCase().indexOf(t) >= 0;
    });
  }

  function byCategory() {
    const out = {};
    BTE.forEach(function (x) {
      if (!out[x.cat]) out[x.cat] = [];
      out[x.cat].push(x);
    });
    return out;
  }

  function categories() {
    const set = {};
    BTE.forEach(function (x) { set[x.cat] = true; });
    return Object.keys(set);
  }

  /**
   * Berechnet Restlebensdauer eines Bauteils.
   *   sanierungAlter = wann zuletzt erneuert (Jahre vor Stichtag)
   *   ggf. < 0 = nie saniert, dann = Gebäudealter
   */
  function restlebensdauer(mw, sanierungAlter) {
    const sa = (typeof sanierungAlter === 'number' && sanierungAlter >= 0)
      ? sanierungAlter : 0;
    return Math.max(0, mw - sa);
  }

  global.DealPilotRND_BTE = {
    BTE: BTE,
    GEWERK_MAPPING: GEWERK_MAPPING,
    get: get,
    getEntry: getEntry,
    search: search,
    byCategory: byCategory,
    categories: categories,
    restlebensdauer: restlebensdauer
  };
})(typeof window !== 'undefined' ? window : globalThis);
