// laender-registry.js  (OD-02)
// Wo bekommen wir je Bundesland die "sonstigen zur Wertermittlung erforderlichen
// Daten" (§ 193 Abs. 5 BauGB) her: Liegenschaftszinssatz, Sachwertfaktor,
// Vergleichsfaktoren, Bewirtschaftungskosten, Rest-/Gesamtnutzungsdauer.
//
// WICHTIG — diese Datei ist eine LANDKARTE, kein Rechenkern. Sie enthaelt
// ausschliesslich Adressen, Formate, Lizenzen und Vorbehalte. Kein einziger
// Zahlenwert. Werte entstehen erst durch die Parser (P1..P4), und jeder
// geparste Wert traegt seine Stufe A..E mit (Parameter-Kaskade).
//
// Stand der Pruefung: 02.08.2026. Jeder Eintrag mit verified:false ist eine
// ADRESSE, keine Zusage — erst der Probe-Lauf auf dem Server entscheidet.
// Genau das war die Lehre aus dem Crawler: erst die Adressen pruefen, dann
// das Werkzeug abschreiben.
//
// Lizenz-Regeln, die nicht verschoben werden:
//   - kostenpflichtige Berichte NIE abrufen (commercial:'gebuehr' => skip)
//   - Captcha = Ansage, nicht Huerde (commercial:'captcha' => skip)
//   - ein Abruf je Sekunde, eigene Kennung mit Kontakt (OPENDATA_USER_AGENT)

/** Parser-Typen, die die Registry adressiert. */
export const PARSER = {
  P1_CSV_KLASSEN: 'p1-csv-klassen',   // AK-OGA IMB-DE: klassierte Spannen je Subkreis
  P2_PDF_TABELLE: 'p2-pdf-tabelle',   // Grundstuecksmarktberichte als PDF
  P3_TABLEAU: 'p3-tableau',           // Tableau-Public-Dashboards (NI, ST)
  P4_KATALOG: 'p4-katalog',           // CKAN / Transparenzportal-API
};

/** Was ein Eintrag liefern KANN (nicht: garantiert liefert). */
const K = {
  LZS: 'liegenschaftszinssatz',
  SWF: 'sachwertfaktor',
  VGL: 'vergleichsfaktor',
  BWK: 'bewirtschaftungskosten',
  RND: 'restnutzungsdauer',
  MIETE: 'marktmiete',
  PREIS: 'kaufpreisniveau',
  BRW: 'bodenrichtwert',
};

// ---------------------------------------------------------------------------
// BUND — deckt alle 16 Laender ab, aber nur klassiert (Spannen).
// ---------------------------------------------------------------------------
export const BUND = {
  code: 'de',
  name: 'AK OGA — Immobilienmarktbericht Deutschland (IMB-DE)',
  parser: PARSER.P1_CSV_KLASSEN,
  commercial: 'frei',
  lizenz: 'Quellenvermerk Pflicht: "AK OGA, Immobilienmarktbericht Deutschland 2025, ..."',
  stufe: 'C',            // klassiert -> Klassenmitte -> INDIKATIV, nie Stufe A
  indikativ: true,
  verified: true,        // CSV am 02.08.2026 abgerufen, Kopf + 200 Zeilen gelesen
  liefert: [K.PREIS, K.MIETE],
  ebene: 'subkreis',     // Subkr_ID = 8-stellig: AGS5 + 3 Stellen Subkreis
  quellen: {
    csv_2025: 'https://redaktion-akoga.niedersachsen.de/download/224079',
    geojson_subkreise_2025: 'https://redaktion-akoga.niedersachsen.de/download/224081',
    csv_2023: 'https://redaktion-akoga.niedersachsen.de/download/224078',
    csv_2021: 'https://redaktion-akoga.niedersachsen.de/download/202358',
    csv_2019: 'https://redaktion-akoga.niedersachsen.de/download/178009',
    katalogseite: 'https://redaktion-akoga.niedersachsen.de/startseite/download/daten_der_immobilienmarktberichte/download-daten-des-immobilienmarktberichtes-201850.html',
  },
  fallen: [
    'Werte sind KLASSIERT ("2500 und mehr", "bis unter 700") — nie als Punktwert ausgeben.',
    'Offene Randklassen ("und mehr") haben KEINE Mitte -> als Untergrenze fuehren, nicht mitteln.',
    'Spaltennamen sind Abbildungs-IDs (Abb_4_14 ...). Semantik nur ueber die Legende des IMB-DE-Berichts.',
    'R-Export-Artefakt: Hamburg steht als "2e+07" statt 20000000 -> Subkr_ID defensiv parsen.',
    'GEOJSON ist EPSG:25832, nicht WGS84 -> vor PostGIS transformieren.',
    'Erscheint zweijaehrlich (Bericht), Dashboards jaehrlich -> nie als tagesaktuell verkaufen.',
  ],
};

// ---------------------------------------------------------------------------
// LAENDER
// ---------------------------------------------------------------------------
export const LAENDER = [
  {
    code: 'nw', name: 'Nordrhein-Westfalen', parser: PARSER.P4_KATALOG,
    commercial: 'frei', lizenz: 'dl-de/zero-2-0', stufe: 'A', indikativ: false,
    verified: true, status: 'produktiv',
    liefert: [K.LZS, K.BWK, K.RND, K.MIETE, K.PREIS, K.BRW],
    ebene: 'gemeinde',
    quellen: {
      ckan: 'https://ckan.open.nrw.de/api/3/action/package_show?id=ad760913-eb7b-4843-b3b7-dc9100b788ca',
      datei: 'GMDNRW_CSV.zip -> lzs.csv (73 GAA x 11 Objektarten x 16 Kennzahlen)',
    },
    fallen: ['Bereits in Betrieb (2.557 Zeilen Stufe A). Nicht neu bauen.'],
  },
  {
    code: 'ni', name: 'Niedersachsen', parser: PARSER.P3_TABLEAU,
    commercial: 'frei', lizenz: 'Nutzungsbedingungen GAG NI pruefen', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.VGL, K.PREIS, K.BRW],
    ebene: 'gaa',
    quellen: {
      einstieg: 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/grundstucksmarktdaten-197115.html',
      muster_seite: 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/{jahr}/liegenschaftszinssatze/{objektart}/',
      muster_tableau: 'https://public.tableau.com/views/{jahr}_lizi_{kurz}_nds/Dash',
      objektarten: ['mehrfamilienhaus', 'wohngeschaeft'],
      brw: 'https://immobilienmarkt.niedersachsen.de/bodenrichtwerte',
    },
    fallen: [
      'GMB in Papierform ABGELOEST — seit 2022 nur noch Dashboards. Kein PDF mehr suchen.',
      'Die Landingpage enthaelt nur ein iframe auf public.tableau.com -> Daten liegen dort, nicht bei gag.ni.',
      'Immobilien-Preis-Kalkulator (boris.niedersachsen.de/boris/ipk) ist ABO-pflichtig -> NICHT abrufen.',
    ],
  },
  {
    code: 'be', name: 'Berlin', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'frei', lizenz: 'Nutzungsbestimmungen GAA Berlin', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.VGL, K.BWK],
    ebene: 'land',
    quellen: {
      uebersicht: 'https://www.berlin.de/gutachterausschuss/marktinformationen/daten-zur-wertermittlung/',
      muster_lzs: 'https://www.berlin.de/gutachterausschuss/_assets/amarktinformationen/adaten-zur-wertermittlung/05-02-010-{JJ}00.pdf',
      beispiel_2025: 'https://www.berlin.de/gutachterausschuss/_assets/amarktinformationen/adaten-zur-wertermittlung/05-02-010-2500.pdf',
      vergleichsfaktoren_efh: 'https://www.berlin.de/gutachterausschuss/marktinformationen/daten-zur-wertermittlung/artikel.1377900.php',
    },
    fallen: [
      'Dateiname kodiert das Jahr: 2400 = 2025er Ausgabe fuer Stichtag 2024, 2500 = Ausgabe 2025.',
      'LZS gelten NUR fuer Objekte ab vier Mieteinheiten — nicht auf EFH/ZFH/DHH anwenden.',
      'Modellkonformitaet: Berliner LZS setzen den BRW zum jeweiligen Stichtag voraus, GFZ-korrigiert.',
      'Die Vergleichsfaktoren EFH/Villen sind AUSDRUECKLICH nur fuer die steuerliche Bewertung.',
      'Der ?ts=-Parameter an der URL ist ein Cache-Buster, kein Pflichtteil.',
    ],
  },
  {
    code: 'bb', name: 'Brandenburg', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'frei', lizenz: 'kostenfreier Download, Quellenangabe', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.VGL, K.PREIS, K.BRW],
    ebene: 'kreis',
    quellen: {
      uebersicht: 'https://gutachterausschuss.brandenburg.de/gaa/de/marktinformationen/grundstuecksmarktberichte/',
      muster_kreis: 'https://gutachterausschuss.brandenburg.de/sixcms/media.php/9/GMB_{KRZ}.pdf',
      land: 'https://gutachterausschuss.brandenburg.de/sixcms/media.php/9/GMB_Land.pdf',
      belegt: ['GMB_UM.pdf (Uckermark)', 'GMB_PR.pdf (Prignitz)', 'GMB_Land.pdf'],
    },
    fallen: [
      'Deterministisches Namensmuster — die Kreiskuerzel muessen aber aus der Uebersichtsseite',
      'geerntet werden, NICHT aus Kfz-Kennzeichen geraten (Abweichungen sind zu erwarten).',
      'BORIS-BB (WMS) ist bereits in der boris/registry.js verifiziert — nicht doppelt bauen.',
    ],
  },
  {
    code: 'mv', name: 'Mecklenburg-Vorpommern', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'frei', lizenz: 'digital kostenfrei (Druck 30 EUR — irrelevant)', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.PREIS],
    ebene: 'kreis',
    quellen: {
      uebersicht: 'https://www.laiv-mv.de/Geoinformation/Wertermittlung/Grundstuecksmarktberichte/',
    },
    fallen: [
      'Das MV-Serviceportal beschreibt einen ANTRAG mit Gebuehr — das ist der Papierweg.',
      'Der digitale Weg ueber laiv-mv.de ist der kostenfreie. Nie das Antragsformular ansteuern.',
    ],
  },
  {
    code: 'sn', name: 'Sachsen', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'frei', lizenz: 'kostenfreier Download', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.PREIS, K.BRW],
    ebene: 'kreis',
    quellen: {
      uebersicht: 'https://www.boris.sachsen.de/marktinformationen-4042.html',
      portal: 'https://www.boris.sachsen.de/',
    },
    fallen: ['Zwei Publikationen: GMB (jaehrlich) und "Schlaglicht" (Grossstaedte). Beide frei.'],
  },
  {
    code: 'st', name: 'Sachsen-Anhalt', parser: PARSER.P3_TABLEAU,
    commercial: 'frei', lizenz: 'kostenfrei', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.PREIS, K.MIETE],
    ebene: 'gemeinde',
    quellen: {
      alt_pdf: 'https://www.lvermgeo.sachsen-anhalt.de/de/gdp-grundstuecksmarktbericht.html',
      neu_dashboards: 'https://www.geodatenportal.sachsen-anhalt.de/gfds/de/gdp-news/grundstuecksmarktinformationen-veroeffentlichen-2025.html',
    },
    fallen: [
      'Bruch 2024/2025: GMB (PDF) wurde durch "Grundstuecksmarktinformationen" (Dashboards) ersetzt.',
      'Beide Wege parallel halten — Altjahre nur als PDF, ab 2025 nur als Dashboard.',
    ],
  },
  {
    code: 'he', name: 'Hessen', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'frei', lizenz: 'kostenfrei ueber Geodaten-Downloadcenter', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.VGL, K.BRW],
    ebene: 'gaa',
    quellen: {
      uebersicht: 'https://hvbg.hessen.de/immobilienwertermittlung/immobilienmarktberichte',
      downloadcenter: 'https://gds.hessen.de/ (Downloadcenter -> Immobilienwerte -> Immobilienmarktberichte)',
      hinweis: '17 Gutachterausschuesse, Berichte der letzten 10 Jahre kostenfrei; Vergleichsfaktoren separat',
    },
    fallen: [
      'Das Downloadcenter ist eine Suchoberflaeche — Verteilerseite ansteuern, nicht die Startseite.',
      'Immobilien-Preis-Kalkulator Hessen ist ein Rechner, keine Datenquelle. Nicht scrapen.',
    ],
  },
  {
    code: 'rp', name: 'Rheinland-Pfalz', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'teilweise', lizenz: 'Kap. 1-3 frei; Kap. 4 (Wertermittlungsdaten) pruefen', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.VGL],
    ebene: 'land',
    quellen: {
      uebersicht: 'https://gutachterausschuesse.rlp.de/marktdaten/landesgrundstuecksmarktbericht-rheinland-pfalz-lgmb',
      lgmb_frei: 'https://gutachterausschuesse.rlp.de/fileadmin/gutachterausschuss/pdf/LGMB-2025_Online_1_3.pdf',
      zwischenauswertungen: 'SWF + LZS EFH/ZFH zum 01.01.2025 als eigene Kurz-PDFs (06/2025)',
    },
    fallen: [
      'Kapitel 4 traegt die Wertermittlungsdaten. Ob es frei liegt, entscheidet der Probe-Lauf —',
      'nicht annehmen, dass "LGMB ist kostenlos" auch fuer Kapitel 4 gilt.',
      'Die Vergleichsfaktoren wurden 2025 auf ein NEUES Modell umgestellt (Regressionsformel).',
      'Alt- und Neumodell nie mischen.',
    ],
  },
  {
    code: 'sh', name: 'Schleswig-Holstein', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'frei', lizenz: 'kostenfrei, barrierefreie PDFs', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.VGL, K.PREIS],
    ebene: 'kreis',
    quellen: {
      zgs: 'https://www.gdi-sh.de/gaa/DE/wir_ueber_uns/_documents/gaWirZentraleGs',
      land_pdf: 'https://www.schleswig-holstein.de/mm/downloads/LVermGeoSH/Gaa/gaZgMarktbericht_SH_2024.pdf',
      aktuelles: 'https://www.schleswig-holstein.de/gaa/DE/_documents/gaStartAktuelles',
    },
    fallen: [
      'Die ZGS-Uebersicht sagt AUSDRUECKLICH, welcher GAA welche Daten abgeleitet hat —',
      'das ist die Abdeckungskarte, die wir sonst muehsam selbst bauen muessten. Zuerst lesen.',
      'Einzelauskuenfte und Kaufpreissammlung sind gebuehrenpflichtig. Nur die Berichte nehmen.',
    ],
  },
  {
    code: 'hh', name: 'Hamburg', parser: PARSER.P4_KATALOG,
    commercial: 'frei', lizenz: 'Transparenzportal HH', stufe: 'A', indikativ: false,
    verified: false, status: 'adresse-bekannt',
    liefert: [K.LZS, K.SWF, K.VGL, K.BRW],
    ebene: 'land',
    quellen: {
      katalog: 'https://suche.transparenz.hamburg.de/dataset/bodenrichtwerte-hamburg25',
      imb: 'https://www.hamburg.de/politik-und-verwaltung/behoerden/behoerde-fuer-stadtentwicklung-und-wohnen/aemter-und-landesbetrieb/landesbetrieb-geoinformation-und-vermessung/produkte-und-dienstleistungen/infos-ueber-grundstuecke/gutachterausschuss-fuer-grundstueckswerte/immobilienmarktbericht-238656',
      hinweis: 'IMB Hamburg Teil II = die Wertermittlungsdaten n. § 193 Abs. 5 BauGB, ohne BRW',
    },
    fallen: [
      'BRW liegen als CSV UND GML vor. Ab Stichtag 01.01.2025 gilt Bodenrichtwertmodell 3.0,',
      'davor VBORIS — das Feld-Mapping bricht an dieser Kante. Zwei Mappings vorhalten.',
    ],
  },
  {
    code: 'hb', name: 'Bremen', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'unbekannt', lizenz: 'zu pruefen', stufe: 'B', indikativ: false,
    verified: false, status: 'luecke',
    liefert: [K.PREIS],
    ebene: 'land',
    quellen: { hinweis: 'Im IMB-DE enthalten (Bremen 40110000, Bremerhaven 40120000). Eigener GMB noch nicht lokalisiert.' },
    fallen: ['Echte Luecke. Bis zur Klaerung traegt Bremen nur die IMB-DE-Klassen (Stufe C).'],
  },
  {
    code: 'by', name: 'Bayern', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'gemischt', lizenz: 'Landesbericht frei; oertliche GMB gebuehrenpflichtig', stufe: 'B', indikativ: false,
    verified: false, status: 'nur-landesebene',
    liefert: [K.PREIS],
    ebene: 'land',
    quellen: {
      uebersicht: 'https://www.gutachterausschuesse-bayern.de/marktberichte/',
      imb_2024: 'https://www.gutachterausschuesse-bayern.de/fileadmin/user_upload/Immobilienmarktberichte/2024_IMB_BY.pdf',
      hinweis: 'IMB Bayern 2026 am 24.06.2026 vorgestellt',
    },
    fallen: [
      'HARTE GRENZE: die oertlichen GMB mit LZS/SWF/Vergleichsfaktoren laufen ueber BORIS-Bayern',
      'und sind GEBUEHRENPFLICHTIG. Nicht abrufen. Nur der Landesbericht ist frei.',
      'Damit bleibt Bayern unterhalb der Landesebene bei § 256 BewG (Stufe D).',
    ],
  },
  {
    code: 'bw', name: 'Baden-Wuerttemberg', parser: null,
    commercial: 'gebuehr', lizenz: 'Vermarktung untersagt (siehe boris/registry.js)', stufe: 'D', indikativ: true,
    verified: true, status: 'gesperrt',
    liefert: [],
    ebene: null,
    quellen: { zgg: 'https://www.zgg-bw.de/Marktberichte/index.html' },
    fallen: [
      'Gutachterausschuesse sind in BW bei den Gemeinden gebildet -> hunderte Stellen, kein Landesmodell.',
      'Berichte ueberwiegend kostenpflichtig, Leseproben frei. NICHT abrufen.',
      'BW bleibt § 256 BewG, Stufe D, indikativ. Das ist eine Entscheidung, kein Versaeumnis.',
    ],
  },
  {
    code: 'th', name: 'Thueringen', parser: null,
    commercial: 'captcha', lizenz: '-', stufe: 'D', indikativ: true,
    verified: true, status: 'gesperrt',
    liefert: [],
    ebene: null,
    quellen: {},
    fallen: ['Captcha = Ansage, nicht Huerde. Kein automatisierter Abruf. Nur manuelle Pflege.'],
  },
  {
    code: 'sl', name: 'Saarland', parser: PARSER.P2_PDF_TABELLE,
    commercial: 'unbekannt', lizenz: 'zu pruefen', stufe: 'B', indikativ: false,
    verified: false, status: 'luecke',
    liefert: [],
    ebene: 'land',
    quellen: { hinweis: 'Noch nicht lokalisiert. Einstieg ueber die AK-OGA-Landkarte, nicht ueber Google.' },
    fallen: ['Echte Luecke. Bis zur Klaerung nur IMB-DE-Klassen (Stufe C).'],
  },
];

/** Alle Eintraege, die ueberhaupt automatisiert abgerufen werden duerfen. */
export function abrufbar() {
  return LAENDER.filter((l) => l.parser && l.commercial !== 'gebuehr' && l.commercial !== 'captcha');
}

/** Eintrag per Landescode. */
export function land(code) {
  return LAENDER.find((l) => l.code === String(code || '').toLowerCase()) || null;
}

/** Abdeckungs-Uebersicht fuer den Admin-Reiter. */
export function abdeckung() {
  const zaehl = (p) => LAENDER.filter((l) => l.status === p).length;
  return {
    produktiv: zaehl('produktiv'),
    adresse_bekannt: zaehl('adresse-bekannt'),
    nur_landesebene: zaehl('nur-landesebene'),
    luecke: zaehl('luecke'),
    gesperrt: zaehl('gesperrt'),
    bundesweit_klassiert: BUND.verified,
  };
}

export default { BUND, LAENDER, PARSER, abrufbar, land, abdeckung };
