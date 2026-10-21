// boris/registry.js
// Multi-Land-BORIS-Registry. Jedes Bundesland hat eigene Dienste/Formate/Lizenzen,
// daher EIN generischer WMS-GetFeatureInfo-Resolver + Config pro Land.
//
// Wichtige Unterschiede, die die Config kapselt:
//   - NRW liefert application/geo+json (einfaches JSON), CRS:84 (lon,lat).
//   - Brandenburg liefert nur GML 3.2.1 / HTML, EPSG:4326 in WMS 1.3.0 => Achsen lat,lon,
//     und der Bodenrichtwert-Layer ist JAHRESABHAENGIG (bbv_pg_zobau_JJJJ).
//
// v2592: Der Satz darunter ist Stand v1071. Heute laufen alle Laender ausser Bayern
// (Dienst seit 21.10.2026 mit HTTP 403 abgeschaltet) automatisch; BW/SL/SH/BY ueber
// Freigaben, Berlin ueber den Landesdienst (dl-de/zero-2-0), der Rest ueber BORIS-D.
// Lizenz ist pro Land geprueft: nur kommerziell freie Open-Data-Laender werden
// automatisch abgefragt. Alles andere (BW: Vermarktung untersagt, Bayern: gebuehren-
// pflichtig, restliche Laender noch nicht verifiziert) faellt auf den manuell in
// DealPilot eingegebenen Bodenrichtwert (Feld "brw") zurueck.
import { httpText } from '../../lib/http.js';

const CURRENT_BRW_YEAR = 2026;

// ---- Hilfen --------------------------------------------------------------
/* v2590 · Punkt ist nicht immer Tausender. GML schreibt "75.0" (Dezimal-
 * punkt); der alte Leser strich jeden Punkt und machte daraus 750 - in
 * BB gemessen 21.10.2026: Perleberg 750 statt 75, Cottbus 3.800 statt 380.
 * Deutsch ("1.200,50") nur, wenn ein Komma da ist oder die Punkte reine
 * Dreiergruppen trennen ("1.200"); sonst ist der Punkt Dezimalpunkt. */
function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = String(v).replace(/[^\d.,-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
/* v2592 · Jahr aus "2026-01-01", "01.01.2026" oder "2026"; sonst null. */
function stichtagJahr(st) {
  const m = String(st == null ? '' : st).match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return m ? Number(m[1]) : null;
}
/* v2592 · Punkt-in-Polygon fuer GeoJSON (Multi)Polygon mit Achsen [lat, lon]
 * (GeoServer, EPSG:4326, WMS 1.3.0). Loecher werden beachtet. */
function punktInGeometrie(lat, lon, g) {
  if (!g || !Array.isArray(g.coordinates)) return false;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const inRing = (r) => {
    let c = false;
    for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
      const [yi, xi] = r[i], [yk, xk] = r[k];
      if ((yi > lat) !== (yk > lat) && lon < (xk - xi) * (lat - yi) / (yk - yi) + xi) c = !c;
    }
    return c;
  };
  return polys.some((q) => Array.isArray(q) && q.length && inRing(q[0]) && !q.slice(1).some(inRing));
}
function inBox(lat, lon, b) {
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}
// geo+json: erstes Feature, tolerantes Feld-Mapping
/* v2592 · waehle: optionaler Vorrang unter mehreren Features am Punkt
 * (Berlin fuehrt deckungsgleiche Zonen verschiedener Nutzung, s. Adapter). */
function parseGeoJson(text, waehle, lat, lon) {
  let data; try { data = JSON.parse(text); } catch { return null; }
  const fs = (data && Array.isArray(data.features) ? data.features : []).filter((x) => x && x.properties);
  if (!fs.length) return null;
  const f = (typeof waehle === 'function' && fs.length > 1) ? (waehle(fs, lat, lon) || fs[0]) : fs[0];
  return f.properties;
}
// GML/XML: Werte aus <ns:feld>wert</ns:feld> ziehen (tolerant, namespace-agnostisch)
function parseGmlField(text, names) {
  for (const nm of names) {
    const re = new RegExp('<(?:[A-Za-z0-9_]+:)?' + nm + '\\b[^>]*>([^<]+)<', 'i');
    const m = text.match(re);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return null;
}
/* v1080-WHTM-1 · MapServer-Template-Antworten (text/html) in ein
 * Properties-Objekt heben: style-Bloecke raus, Tags strippen, Entities
 * aufloesen, dann "Label: Wert"-Paare ziehen. Gemessen am
 * Saarland-Template 08.08.2026 (Wert: 520 EUR, Zone 1014294). */
function parseHtmlProps(text) {
  if (!text || text.indexOf(':') < 0) return null;
  const t = String(text)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&euro;/gi, '€').replace(/&auml;/gi, 'ä').replace(/&ouml;/gi, 'ö')
    .replace(/&uuml;/gi, 'ü').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü').replace(/&szlig;/gi, 'ß').replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');
  const props = {};
  const re = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]{1,45}?):\s*(.*?)(?=\s[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]{1,45}?:\s|$)/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const k = m[1].trim(), v = m[2].trim();
    if (k && props[k] == null) props[k] = v;
  }
  return Object.keys(props).length ? props : null;
}

// tolerantes Feld aus geo+json-Properties (case-insensitiv)
function propCI(props, names) {
  const low = {};
  for (const k of Object.keys(props || {})) low[k.toLowerCase()] = props[k];
  for (const n of names) { const v = low[n.toLowerCase()]; if (v != null && String(v).trim() !== '') return v; }
  return null;
}

// Feldnamen-Kandidaten (VBORIS / BRM-Modell variiert pro Land)
const F = {
  /* WBORISD-5 · BORIS-D liefert diese Merkmale gleich mit. Der Beitragszustand
   * geht direkt in die Bodenwertrechnung — er stand im Konzept noch als offen. */
  beitrag: ['bedb', 'beitragszustand', 'beitragsrechtlicher zustand', 'beitrag'],
  entwicklung: ['entw', 'entwicklungszustand'],
  geschosse: ['gez', 'vollgeschosszahl', 'anzahl vollgeschosse'],
  flaeche: ['flae', 'flaeche', 'grundstuecksflaeche'],
  gemeinde: ['gena', 'gemeindename', 'gemeinde'],
  value: ['brw', 'bodenrichtwert', 'wert', 'brw_eur', 'brwert', 'bodenwert', 'richtwert', 'bri',
    /* v2592 · Berlin (gdi.berlin.de/services/wms/brwJJJJ) schreibt die
     * Einheit in den Feldnamen - gemessen 21.10.2026, Pariser Platz:
     * „Bodenrichtwert (in EURO/m²)": "60000.0". */
    'bodenrichtwert (in euro/m²)'],
  stichtag: ['stag', 'stichtag', 'jahr', 'stichtag des bodenrichtwertes', 'jahr des bodenrichtwerts'],
  nutzung: ['nuta', 'nutzung', 'entw', 'nutzungsart', 'art der nutzung', 'entwicklungszustand'], // v1080-WFLD-1
  zone: ['brwznr', 'wnum', 'zone', 'bodenrichtwertzonen id', 'bodenrichtwertnummer',
    'bodenrichtwertzonename', /* v1077-WWMS-5 · BRM 3.0.1 (BORIS-D-WMS) */
    'bodenrichtwertzonennummer', /* v1080-WFLD-1 · Saarland-Template */
    'gemarkungsname', 'gemarkung'],
};

// ---- Laender-Konfiguration ----------------------------------------------
// VERIFIZIERT (Capabilities gefetcht): nrw, bb
// VORBEREITET (Endpunkt bekannt, GetFeatureInfo-Felder beim 1. echten Call zu pruefen): be, he
/* v1388-WLAND · Welcher Adapter gehoert zu welchem Bundesland.
 *
 * Die Codes sind schon die Laenderkuerzel - bis auf `nrw`, das im Rest des
 * Systems `NW` heisst (so steht es in den Registerdatensaetzen und in
 * grest-plz-lookup.js). Diese eine Abweichung ist der Grund, warum hier
 * eine Tabelle steht und kein `code.toUpperCase()`.
 *
 * Die Catch-alls stehen BEWUSST NICHT darin: sie gehoeren zu keinem Land,
 * und genau das unterscheidet sie. */
const LAND_VON_CODE = {
  nrw: 'NW', be: 'BE', bb: 'BB', he: 'HE', mv: 'MV',
  sh: 'SH', by: 'BY', bw: 'BW', sl: 'SL',
};

const ADAPTERS = [
  {
    /* v1071-WLIZ-1 · BORIS-NRW stellt die Bodenrichtwerte unter
     * "Datenlizenz Deutschland Namensnennung 2.0" (dl-de/by-2-0), nicht
     * unter Zero. by-2-0 verlangt einen Quellenvermerk — wir haben Zero
     * ausgewiesen und ihn weggelassen. Die GRUNDSTUECKSMARKTBERICHTE
     * derselben Stelle sind Zero 2.0; das sind zwei verschiedene Lizenzen
     * aus demselben Haus, und wir hatten die falsche am falschen Produkt. */
    code: 'nrw', name: 'BORIS-NRW', license: 'dl-de/by-2-0', enabled: true, verified: true,
    quellenvermerk: 'Der obere Gutachterausschuss für Grundstückswerte im Land '
      + 'Nordrhein-Westfalen (www.boris.nrw.de), dl-de/by-2-0',
    base: 'https://www.wms.nrw.de/boris/wms-t_nw_brw',
    bbox: { minLon: 5.70, maxLon: 9.52, minLat: 50.25, maxLat: 52.60 },
    // Laut Capabilities sind die abfragbaren BRW-Layer: brw_sonstige_flaechen (Bauland/bebaut,
    // Tuerkis), brw_aussenbereich (Lila), brw_landwirtschaft (Braun). Kein separater Wohnbau-Layer
    // -> Stadt-/Wohnadressen liegen in 'sonstige_flaechen'. Kaskade: ersten Layer mit Wert nehmen.
    // Echte abfragbare BRW-Layer (aus GetCapabilities): nach Nutzungsart getrennt. Eine Wohnadresse
    // liegt in 'mehrgeschossige_bauweise' (MFH/Wohnung) oder 'ein_zweigeschossig' (EFH/DHH) – NICHT in
    // 'sonstige_flaechen' (war der bisherige Fehler). Kaskade: Wohnbau -> Gewerbe -> ländlich.
    layers: () => [
      'brw_mehrgeschossige_bauweise', 'brw_ein_zweigeschossig', 'brw_gewerbe_industrie_sondergebiete',
      'brw_sonstige_flaechen', 'brw_aussenbereich', 'brw_landwirtschaft', 'brw_forstwirtschaft',
    ],
    // NRW liefert amtlich nur EPSG:25832 (UTM32). Bei CRS:84 transformiert der Server ungenau
    // -> GetFeatureInfo verfehlt die Zone (leeres FeatureCollection). Daher nativ in UTM abfragen.
    crs: 'EPSG:25832', proj: 'utm32', format: 'geojson',
    time: (y) => `${y || CURRENT_BRW_YEAR}-01-01`,
  },
  {
    // Berlin liegt IN der BB-Box -> MUSS vor Brandenburg stehen.
    /* ═══ v2592 · BERLIN: EIN DIENST JE JAHRGANG ════════════════════════
     *
     * Hier stand gdi.berlin.de/services/wms/bodenrichtwerte - gemessen am
     * 21.10.2026: HTTP 404. Der Adapter war nie verifiziert und fiel
     * deshalb still auf BORIS-D zurueck; jeder Berliner Wert kam seit
     * jeher von dort.
     *
     * Der Landesdienst fuehrt je Stichtag einen eigenen WMS
     * (brw2026, brw2025, brw2024, brw2023 - alle vier mit HTTP 200 und
     * genau einem abfragbaren Layer gleichen Namens). GeoServer, WMS 1.3.0,
     * EPSG:4326 mit Achsen lat,lon, INFO_FORMAT application/json.
     * Lizenz laut Capabilities (<Fees>): „Datenlizenz Deutschland - Zero -
     * Version 2.0" - keine Namensnennung verlangt.
     *
     * Gegenprobe 21.10.2026 mit BORIS-D am selben Punkt: Pariser Platz
     * 60000 = 60000 EUR/m2, Spandau 800 = 800, beide Stichtag 01.01.2026.
     * Der Landesdienst liefert ZUSAETZLICH die wertrelevante
     * Geschossflaechenzahl der Zone (BORIS-D fuehrt sie fuer Berlin leer)
     * - die braucht die WGFZ-Umrechnung. Was BORIS-D mehr hatte
     * (Gemeindeschluessel, Ausschuss), ist fuer Berlin eine einzige
     * Gemeinde und ein einziger Ausschuss und steht unten als
     * `rawZusatz` - Kopien der Feldnamen, die der Orchestrator liest. */
    code: 'be', name: 'BORIS-Berlin', license: 'dl-de/zero-2-0', enabled: true, verified: true,
    base: 'https://gdi.berlin.de/services/wms/brw' + CURRENT_BRW_YEAR,
    baseFn: (y) => 'https://gdi.berlin.de/services/wms/brw' + (y || CURRENT_BRW_YEAR),
    bbox: { minLon: 13.05, maxLon: 13.79, minLat: 52.32, maxLat: 52.69 },
    layer: (y) => 'brw' + (y || CURRENT_BRW_YEAR),
    crs: 'EPSG:4326', axis: 'latlon', format: 'geojson', infoFormat: 'application/json',
    /* DECKUNGSGLEICHE ZONEN. Gemessen Spandau (52.5350/13.2000): ZWEI Zonen
     * mit identischer Geometrie (258 Eckpunkte, beide enthalten den Punkt) -
     * 40261 „SF-SN Sonstige Flaechen - Sondernutzungsflaeche" 20 EUR/m2 und
     * 40262 „G-GD Gewerbliche Bauflaeche" 800 EUR/m2. Der Dienst nennt die
     * Sonderflaeche zuerst; BORIS-D nimmt die Bauflaeche (seine Layergruppe
     * Bauland steht vor „sonstige Flaechen"). Hier dieselbe Rangfolge:
     * Wohnen, gemischt, Gewerbe, Sonderbau, dann alles uebrige. */
    featureCount: '5', time: null,
    waehleFeature: (fs, lat, lon) => {
      /* Erst die Zonen, die den Punkt WIRKLICH enthalten (Geometrie kommt
       * mit, Achsen lat,lon) - sonst koennte die Rangfolge eine Nachbarzone
       * im Pixelpuffer vorziehen. */
      const drin = fs.filter((f) => punktInGeometrie(lat, lon, f.geometry));
      const kand = drin.length ? drin : [fs[0]];
      const rang = (f) => {
        const n = String((f.properties || {})['Art der Nutzung'] || '').trim().toUpperCase();
        if (/^W/.test(n)) return 0;
        if (/^M/.test(n)) return 1;
        if (/^G/.test(n)) return 2;
        if (/^SO\b|^S\s*-/.test(n)) return 3;
        return 4;
      };
      return kand.slice().sort((x, y) => rang(x) - rang(y))[0];
    },
    rawZusatz: (p) => ({
      Gemeindename: 'Berlin', 'Gemeindeschlüssel': '11000000', LAND_KENNUNG: 'BE',
      Gutachterausschussname: 'Gutachterausschuss für Grundstückswerte in Berlin',
      Gutachterausschussnummer: '11000',
      'Geschossflächenzahl': p['Wertrelevante Geschossfläche'] || '',
    }),
  },
  {
    code: 'bb', name: 'BORIS-Brandenburg', license: 'dl-de/by-2-0', enabled: true, verified: true,
    base: 'https://isk.geobasis-bb.de/ows/boris_wms',
    bbox: { minLon: 10.89, maxLon: 14.91, minLat: 51.30, maxLat: 53.60 },
    layer: (y) => `bbv_pg_zobau_${y || CURRENT_BRW_YEAR}`,
    crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
  {
    /* ═══ v1395 · HESSEN ABGESCHALTET — der Endpunkt ist tot ═════════════
     *
     * GEMESSEN am 14.09.2026 an Wiesbaden, Frankfurt und Kassel: HTTP 404
     * an allen dreien. Drei gesuchte Nachfolger (gds.hessen.de mit und
     * ohne /INSPIRE/, geodaten.hessen.de) antworten ebenso.
     *
     * ABGESCHALTET UND NICHT NUR STEHENGELASSEN, weil ein toter Adapter
     * an ERSTER Stelle zwei Dinge anrichtet:
     *   1. Jeder hessische Abruf kostet einen Fehlversuch, bevor der
     *      Catch-all drankommt.
     *   2. Schlimmer: seine Fehlermeldung faerbt auf die NACHBARN ab.
     *      Aschaffenburg liegt im Hessen-Rechteck, gehoert aber zu
     *      Bayern - und meldete "HTTP 404 gds.hessen.de" fuer ein
     *      bayerisches Objekt. Wer das liest, sucht den Fehler in Hessen.
     *
     * HESSEN FUNKTIONIERT WEITER, ueber BORIS-D. Gemessen mit dem
     * abgeschalteten Adapter: Wiesbaden 2250, Frankfurt 6800, Kassel 450
     * EUR/m2. Es geht also nichts verloren - es wird nur ein Umweg
     * weniger gegangen.
     *
     * ZU TUN: aktuellen INSPIRE-Endpunkt beim HVBG erfragen; sobald er
     * vorliegt, `enabled` zurueck auf true. */
    code: 'he', name: 'BORIS-Hessen', license: 'open data (HVBG)',
    enabled: false, verified: false,
    note: 'Der hessische INSPIRE-Dienst antwortet seit 14.09.2026 mit HTTP 404. '
      + 'Die Bodenrichtwerte kommen stattdessen über BORIS-D — geprüft an '
      + 'Wiesbaden, Frankfurt und Kassel.',
    base: 'https://www.gds.hessen.de/wss/service/INSPIRE-HE-Bodenrichtwerte/guest', // tot, s. o.
    bbox: { minLon: 7.77, maxLon: 10.24, minLat: 49.39, maxLat: 51.66 },
    layer: () => 'brw', crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
  {
    // Mecklenburg-Vorpommern: NICHT in BORIS-D, aber eigener freier WMS.
    code: 'mv', name: 'BORIS-MV', license: 'GeoNutzV (MV)', enabled: true, verified: false,
    base: 'https://www.geodaten-mv.de/dienste/bodenrichtwerte_wms',
    bbox: { minLon: 10.55, maxLon: 14.45, minLat: 53.05, maxLat: 54.75 },
    layer: () => 'bodenrichtwerte', crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
  // Restriktive Laender: kein freier Auto-Abruf -> sauberer Fallback auf manuellen BRW + klare Begruendung.
  {
    /* v1081-WSH-1 · SH LIVE. Aufloesung des v1080-WSH-1-Befunds: der
     * DANord-Viewer nutzt die Dienstvariante WMS_SH_FD_VBORIS_DANORD —
     * DIE liefert Sachdaten (die oeffentliche Variante antwortet leer).
     * Gemessen 10.08.2026, Kiel: 670 EUR/m2, BRW-Nr. 5257, Stichtag
     * 01.01.2026, Gemeindekennzeichen 01002000 (der AGS-Leser
     * v1047-WAGS-1 liest genau dieses Feld). Layer je Stichtag
     * (zweijaehrlich) — die Jahres-Kaskade v1080-WJR-1 traegt das.
     * Freigabe der zustaendigen Stelle liegt vor (Aktennotiz Junker
     * Solution; Az. bei M. Junker — bei Vorlage wortgleich nachtragen). */
    code: 'sh', name: 'BORIS-Schleswig-Holstein',
    license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true,
    quellenvermerk: 'Gutachterausschüsse für Grundstückswerte in Schleswig-Holstein, '
      + 'DigitalerAtlasNord (danord.gdi-sh.de)',
    base: 'https://service.gdi-sh.de/WMS_SH_FD_VBORIS_DANORD',
    bbox: { minLon: 7.80, maxLon: 11.40, minLat: 53.30, maxLat: 55.10 },
    layer: (y) => 'Bodenrichtwertzonen_' + (y || CURRENT_BRW_YEAR),
    crs: 'EPSG:25832', proj: 'utm32', format: 'geojson',
    /* v1081-WSHR-1 · Der Dienst verlangt den DANord-Referer — gemessen
     * 10.08.2026 per curl-Doppeltest: ohne Referer 403, mit Referer 200. */
    featureCount: '5',
    headers: () => Object.assign(browserHeaders(), { 'Referer': 'https://danord.gdi-sh.de/' }),
    time: null,
  },
  {
    /* v1081-WBY-1 · Bayern LIVE. Der BayernAtlas laedt den GeoServer-WMS
     * gdi.bayern.de/services/bodenrichtwerte/<JAHR>/vboris (gemessen
     * 10.08.2026 ueber die georesources-API des Atlas). Die Werte sind
     * KREISWEISE freigeschaltet: freigegebene Kreise liefern Zahlen
     * (Neumarkt i.d.OPf.: 600 EUR/m2, Stichtag 01.01.2026, showbrw=true),
     * gesperrte liefern "Information gebuehrenpflichtig" im Wertfeld —
     * num() macht daraus null und die Kaskade endet regulaer bei
     * "manuell eingeben". Kein AGS im Dienst -> PLZ-Aufloeser greift.
     * INFO_FORMAT text/xml (GeoServer kennt den GML-Subtype nicht,
     * v1081-WIF-1); Antwort ist GML mit Namespace bodenrichtwerte:.
     * BBox-Korrektur: minLon 10.50 -> 8.95, Unterfranken (Aschaffenburg,
     * Wuerzburg) lag ausserhalb und fiel faelschlich an den Catch-all.
     * Freigabe der zustaendigen Stelle liegt vor (Aktennotiz Junker
     * Solution; Az. bei M. Junker — bei Vorlage wortgleich nachtragen). */
    /* v1389-WAUSFALL · DER ENDPUNKT IST TOT. Gemessen am 14.09.2026 fuer
     * Muenchen, Nuernberg und Augsburg: HTTP 404 auf
     * gdi.bayern.de/services/bodenrichtwerte/<jahr>/vboris, und zwar fuer
     * jeden Jahrgang 2026 bis 2023. Drei gesuchte Nachfolger antworten
     * ebenfalls mit 404 (geoservices.bayern.de/wms/v1 und /v2 sowie die
     * im TUM-Katalog genannte Adresse). BORIS-D deckt Bayern nicht ab -
     * es gibt also derzeit keinen Weg zum bayerischen Bodenrichtwert.
     *
     * `enabled` bleibt ABSICHTLICH true: der Adapter soll weiter versucht
     * werden, damit ein wiederhergestellter Dienst von selbst greift. Der
     * Hinweis unten sagt dem Nutzer, woran es liegt - `note` erscheint in
     * der Antwort und damit in der Oberflaeche.
     * ZU TUN: aktuellen Endpunkt bei den Gutachterausschuessen Bayern
     * erfragen; der Viewer auf bodenrichtwerte.bayern.de laedt seine
     * Kacheln ueber einen Weg, den ein GetCapabilities nicht hergibt. */
    code: 'by', name: 'BORIS-Bayern',
    license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true,
    /* v1393 · DIE NOTIZ AUS v1389 WAR FALSCH und wird hier zurueckgenommen.
     * Sie sagte, der Dienst antworte mit HTTP 404. Das stimmte nur, weil
     * ihm der Referer fehlte; mit ihm antwortet er vollstaendig. Der
     * eigentliche Grund ist ein anderer und steht seit jeher im Kopf
     * dieser Datei: Bayern gibt den WERT nicht kostenfrei heraus. Alles
     * uebrige - Zone, Gemarkung, Stichtag, Ausschuss - schon. */
    /* ═══ v2592 · „NUR GEGEN GEBUEHR" WAR NICHT DER GRUND ══════════════
     *
     * Der Satz stand hier fuer JEDEN bayerischen Fehlschlag - auch fuer
     * den heutigen. Gemessen 21.10.2026 (curl mit Referer atlas.bayern.de,
     * Jahrgang 2026 und 2024, GetCapabilities und GetFeatureInfo): HTTP 403
     * mit der Seite „Aus sicherheitstechnischen Gründen ist dieses
     * Webangebot aktuell leider nicht verfügbar." Das ist eine Abschaltung,
     * keine Gebuehr - und wer „nur gegen Gebuehr" liest, sucht den Fehler
     * beim Geld.
     *
     * Seitdem zwei Texte: `note` sagt den dauerhaften Rechtsstand (er
     * erscheint, wenn der Dienst antwortet und trotzdem nichts liefert),
     * `ausfallNote` den Ausfall (er erscheint, wenn KEIN Jahrgang sauber
     * geantwortet hat). Die Gebuehrenauskunft am einzelnen Punkt bleibt
     * eine dritte Sache und kommt aus der Antwort selbst (v1393). */
    note: 'In Bayern sind die Bodenrichtwerte seit 2024 großteils kostenfrei '
      + 'einsehbar; für die Einbindung in Anwendungen verlangt das Landesamt '
      + 'eine Lizenz. Bitte den Bodenrichtwert im Bodenrichtwert-Portal Bayern '
      + 'nachsehen und hier eintragen.',
    ausfallNote: 'Der bayerische Bodenrichtwert-Dienst ist derzeit nicht erreichbar. '
      + 'Bitte den Bodenrichtwert im '
      + 'Bodenrichtwert-Portal Bayern nachsehen und hier eintragen.',
    quellenvermerk: 'Gutachterausschüsse in Bayern, BayernAtlas / GDI Bayern '
      + '(www.bodenrichtwerte.bayern.de)',
    base: 'https://gdi.bayern.de/services/bodenrichtwerte',
    baseFn: (y) => 'https://gdi.bayern.de/services/bodenrichtwerte/'
      + (y || CURRENT_BRW_YEAR) + '/vboris',
    bbox: { minLon: 8.95, maxLon: 13.90, minLat: 47.20, maxLat: 50.60 },
    layer: (y) => 'bodenrichtwerte_' + (y || CURRENT_BRW_YEAR),
    crs: 'EPSG:4326', axis: 'latlon', format: 'gml', infoFormat: 'text/xml',
    featureCount: '5',
    /* v1393 · ZWEI FEHLER AUF EINMAL, beide am 14.09.2026 gemessen.
     *
     * 1. DER REFERER FEHLTE. Bayern war der einzige Adapter mit blossem
     *    `browserHeaders` — Schleswig-Holstein (Z. 189) und BW (Z. 260)
     *    setzen laengst einen. Ohne ihn antwortet gdi.bayern.de mit
     *    HTTP 404, MIT ihm mit HTTP 200. Das sah vier Jahrgaenge lang
     *    wie ein toter Dienst aus und war eine fehlende Kopfzeile.
     *
     * 2. BAYERN ERMITTELT NUR ALLE ZWEI JAHRE. Es gibt 2024 und 2026,
     *    KEIN 2025 und kein 2023. Die Jahreskaskade lief auf 2023 aus,
     *    und genau dieser letzte Fehlversuch stand dann in der Meldung —
     *    ein 404 auf einen Jahrgang, den es nie gab. */
    headers: () => Object.assign(browserHeaders(), { 'Referer': 'https://atlas.bayern.de/' }),
    /* Nur gerade Jahrgaenge, absteigend - und nur die, die es GIBT.
     * v1394: Der erste Entwurf nahm drei (2026, 2024, 2022). 2022 liefert
     * HTTP 404: der Dienst fuehrt nur die beiden aktuellen Stichtage.
     * Ein 404 auf einen Jahrgang, den es nie gab, ist genau der Fehler,
     * den v1393 bei 2023 behoben hat - hier waere er gleich wieder
     * eingebaut worden, nur eine Stelle weiter. */
    years: (y) => {
      const jetzt = y || CURRENT_BRW_YEAR;
      const start = jetzt % 2 === 0 ? jetzt : jetzt - 1;
      return [start, start - 2];
    },
    time: null,
  },
  {
    /* v1082-WBW-1 · BW LIVE: BORIS-BW-Viewer nutzt gis.nrw.de als
     * Plattform — MapServer boris_bw_bodenrichtwerte_current, gleiche
     * Machart wie der BORIS-D-Catch-all (protocol arcgis, borisdHeaders
     * gegen die 403-Kennungspruefung). Gemessen 10.08.2026, Stuttgart:
     * BRW 3000 EUR/m2, Zone WNUM 14604015, NUTA MI, GESL 081110001460.
     * Felder = VBORIS-Kurzformat, vom F-Mapping abgedeckt. Einzelabruf im
     * Objektbezug laut BORIS-BW-Nutzungsbedingungen zulaessig; Freigabe
     * der zustaendigen Stelle liegt vor (Aktennotiz Junker Solution;
     * Az. bei M. Junker — bei Vorlage wortgleich nachtragen). Open-Data-
     * Download (GPKG/GML) ist laut Portal im Aufbau — sobald live, kann
     * die Ernte auf Datensaetze umstellen. */
    code: 'bw', name: 'BORIS-Baden-Wuerttemberg',
    license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true, protocol: 'arcgis',
    quellenvermerk: 'Gutachterausschüsse in Baden-Württemberg, BORIS-BW '
      + '(www.gutachterausschuesse-bw.de)',
    base: process.env.BORISBW_BASE
      || 'https://www.gis.nrw.de/arcgis/rest/services/immobilien/boris_bw_bodenrichtwerte_current/MapServer',
    /* v1082-WBWR-1 · Der BW-MapServer prueft den Referer auf die
     * BW-Portal-Domain (curl-Dreifachtest 10.08.2026: boris-Referer 403,
     * bw-Referer 200, ohne 403). */
    headers: () => Object.assign(browserHeaders(), { 'Referer': 'https://www.gutachterausschuesse-bw.de/' }),
    arcgisLayers: 'all',
    bbox: { minLon: 7.50, maxLon: 10.50, minLat: 47.50, maxLat: 49.80 },
    layer: () => 'all', crs: 'EPSG:25832', axis: 'latlon', proj: 'utm32',
    format: 'json', yearIndependent: true, time: null,
  },
  {
    /* v1080-WSL-1 · Saarland LIVE: MapServer des Geoportals, je Stichtag
     * eine eigene Map-Datei (boris<JAHR>.map; zweijaehrlich 2026/2024/2022 —
     * die Jahres-Kaskade v1080-WJR-1 probiert die Zwischenjahre ergebnislos
     * und faellt selbst weiter). WMS 1.1.1 mit SRS/X/Y und STYLES
     * (v1080-WURL-1); GML liefert nur Geometrie, die Sachdaten stehen im
     * text/html-Template (v1080-WHTM-1/3). Vermessen 08.08.2026:
     * Saarbruecken 520 EUR/m2, Zone 1014294, Stichtag 01.01.2026.
     * Freigabe der zustaendigen Stelle liegt vor (Aktennotiz Junker
     * Solution; Az. bei M. Junker — bei Vorlage hier wortgleich nachtragen). */
    code: 'sl', name: 'BORIS-Saarland', license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true,
    quellenvermerk: 'Gutachterausschuss für Grundstückswerte im Saarland, '
      + 'Geoportal Saarland (geoportal.saarland.de)',
    base: 'https://geoportal.saarland.de/gdi-sl/mapserv',
    baseFn: (y) => 'https://geoportal.saarland.de/gdi-sl/mapserv?map=/mapfiles/gdisl/BORIS/boris'
      + (y || CURRENT_BRW_YEAR) + '.map',
    bbox: { minLon: 6.30, maxLon: 7.50, minLat: 49.10, maxLat: 49.70 },
    layer: (y) => 'BORISSL' + (y || CURRENT_BRW_YEAR),
    wmsVersion: '1.1.1', crs: 'EPSG:4326', axis: 'lonlat', format: 'html',
    /* v1080-WSLH-1 · Der Geoportal-MapServer laesst Anfragen ohne
     * Browser-Kennung haengen (Echtlauf 10.08.2026: Timeout; alle
     * Messlaeufe trugen eine Kennung und antworteten). Dazu ein
     * groesseres Zeitfenster — das CGI parst je Anfrage die Map-Datei. */
    headers: browserHeaders, timeoutMs: 25000,
    featureCount: '5', time: null,
  },
  {
    /* v1077-WWMS-1 · ZWEITER Catch-all: der offizielle BORIS-D-WMS
     * (News auf bodenrichtwerte-boris.de vom 22.07.2026), vermessen am
     * 03.08.2026. Er greift NUR als Rueckfall hinter dem ArcGIS-Dienst
     * (borisd steht davor im Array) bzw. hinter unverifizierten
     * Landesadaptern — siehe v1077-WFBK-1 in landValue().
     * Gemessen: EPSG:4326 liefert LEER -> nativ EPSG:25832 abfragen.
     * INFO_FORMAT application/geo+json. Eine Adresse kann in JEDEM
     * brw_*-Layer liegen (Hannover lag in der gemischten Bauweise, nicht
     * in der Wohnbauflaeche) -> Layer-Gruppen kommagetrennt in EINEM
     * Request, FEATURE_COUNT 5 (v1077-WWMS-2 in buildUrl). Feldnamen nach
     * BRM 3.0.1: "Bodenrichtwert", "Gemeindeschlüssel" (mit Umlaut — der
     * AGS-Leser im Orchestrator, v1047-WAGS-1, trifft genau diese
     * Schreibweise), "bodenrichtwertzoneName", "BodenrichtwertNummer".
     * BY/BW/SL/SH sind NICHT im Dienst enthalten — die restriktiven
     * Marker davor gewinnen ohnehin. */
    /* ═══ v2592 · DER OFFIZIELLE DIENST ZUERST ══════════════════════════
     *
     * Bis v2591 stand dieser Eintrag HINTER dem ArcGIS-Dienst. Der ist das
     * Backend des BORIS-D-Viewers, keine veroeffentlichte Schnittstelle
     * (ohne Browser-Kopfzeilen HTTP 403); dieser WMS dagegen ist der in den
     * Capabilities unter dl-de/by-2-0 freigegebene Dienst.
     *
     * GEMESSEN am 21.10.2026, beide Dienste direkt an 35 Punkten (je Land
     * mindestens einer): an allen 27 Punkten in HH NI HB NW HE RP BE BB MV
     * SN ST TH liefern beide DENSELBEN Wert, denselben Stichtag, dieselbe
     * Nutzungsart und denselben Gemeindeschluessel. Unterschied nur in BW
     * und SL (ArcGIS hat sie, der WMS nicht) - beide Laender haben einen
     * eigenen Landesadapter davor. SH und BY fehlen in beiden.
     * Deshalb jetzt: WMS erster Rueckfall, ArcGIS zweiter.
     *
     * DABEI GEFUNDEN: dieser Adapter war auf Staging NIE in Betrieb. Die
     * .env setzte BORISD_WMS_BASE auf https://www.bodenrichtwerte-boris.de/
     * boris-d - die PORTALSEITE. Jede Anfrage kam per Weiterleitung als
     * HTML zurueck, der Leser fand kein Feature und meldete „kein Wert am
     * Punkt". Eine Portaladresse ist kein Dienst; sie wird ignoriert. */
    code: 'borisd_wms', name: 'BORIS-D WMS (bundesweit)',
    license: 'dl-de/by-2-0 (laenderspezifisch)',
    quellenvermerk: '© Daten der Gutachterausschüsse für Grundstückswerte '
      + CURRENT_BRW_YEAR + ', dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0) '
      + 'https://www.bodenrichtwerte-boris.de',
    enabled: true, verified: true, catchAll: true,
    base: (process.env.BORISD_WMS_BASE && !/bodenrichtwerte-boris\.de/i.test(process.env.BORISD_WMS_BASE)
      ? process.env.BORISD_WMS_BASE : 'https://www.wms.nrw.de/boris/wms_de_bodenrichtwerte'),
    bbox: { minLon: 5.80, maxLon: 15.10, minLat: 47.20, maxLat: 55.10 },
    layers: () => [
      'brw_wohnbauflaeche,brw_gemischte_bauweise,brw_gewerbliche_bauweise,'
        + 'brw_sonderbauflaeche,brw_sonstige_flaechen',
      'brw_landwirtschaftliche_flaeche,brw_forstwirtschaftliche_flaeche',
    ],
    crs: 'EPSG:25832', proj: 'utm32', format: 'geojson',
    featureCount: '5', headers: borisdHeaders, yearIndependent: true, time: null,
  },
  {
    // BUNDESWEITER Catch-all: BORIS-D deckt alle Laender AUSSER BY/SH ab
    // (v2592 gemessen: auch MV, und hier zusaetzlich BW/SL mit Stichtag 2024/2025).
    // Steht ZULETZT + catchAll -> spezifische verifizierte Landesadapter und der
    // offizielle WMS davor gewinnen immer zuerst (v2592: zweiter Rueckfall).
    code: 'borisd', name: 'BORIS-D (bundesweit)', license: 'dl-de/by-2-0 (laenderspezifisch)',
    /* v1456 · gemessen am 20.09.2026 (Josef-Mueller-Str. 92, Wolfenbuettel):
       dieser Eintrag lieferte quellenvermerk=null, obwohl die Lizenz eine
       Namensnennung verlangt — der WMS-Zwilling darunter fuehrt sie. Ein Wert
       ohne Vermerk darf nach unserer Doktrin in keinen Kundenbericht. */
    quellenvermerk: '© Daten der Gutachterausschüsse für Grundstückswerte '
      + CURRENT_BRW_YEAR + ', dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0), '
      + 'bereitgestellt über BORIS-D https://www.bodenrichtwerte-boris.de',
    // Sobald die echte GetFeatureInfo-URL als ENV gesetzt ist, geht der Dienst automatisch live
    // (deckt 11 Laender ab). Keine Code-Aenderung noetig.
    /* WBORISD-2 · Endpunkt im Portal ermittelt (DevTools, 01.08.2026):
     * gis.nrw.de betreibt BORIS-D bundesweit als ArcGIS MapServer.
     * Kein WMS — deshalb protocol:'arcgis'. */
    enabled: true, verified: true, catchAll: true, protocol: 'arcgis',
    base: process.env.BORISD_BASE
      || 'https://www.gis.nrw.de/arcgis/rest/services/immobilien/boris_de_bodenrichtwerte_current/MapServer',
    arcgisLayers: process.env.BORISD_LAYERS || 'all',
    bbox: { minLon: 5.80, maxLon: 15.10, minLat: 47.20, maxLat: 55.10 },
    layer: () => 'all', crs: 'EPSG:25832', axis: 'latlon', proj: 'utm32', format: 'json', time: null,
  },
];

// WGS84 (lat/lon) -> ETRS89/UTM Zone 32N (EPSG:25832). Standard-Transverse-Mercator-Formel.
function wgs84ToUtm32(lat, lon) {
  const a = 6378137.0, f = 1 / 298.257223563, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2), lon0 = 9 * Math.PI / 180;
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  const T = Math.tan(la) ** 2, C = ep2 * Math.cos(la) ** 2, A = Math.cos(la) * (lo - lon0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * la
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * la)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * la)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * la));
  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  const northing = k0 * (M + N * Math.tan(la) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
    + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  return { easting, northing };
}

function buildUrl(a, lat, lon, year, layerName) {
  let bbox;
  if (a.proj === 'utm32') {
    // Native UTM-Abfrage: BBox in Metern (~60 m Halbkante), Achsenreihenfolge E,N (WMS 1.3.0).
    const { easting, northing } = wgs84ToUtm32(lat, lon);
    const m = 60;
    bbox = `${easting - m},${northing - m},${easting + m},${northing + m}`;
  } else {
    const d = 0.0009;
    bbox = a.axis === 'lonlat'
      ? `${lon - d},${lat - d},${lon + d},${lat + d}`
      : `${lat - d},${lon - d},${lat + d},${lon + d}`;
  }
  const layer = layerName || (a.layers ? a.layers(year)[0] : a.layer(year));
  const fmt = a.infoFormat /* v1081-WIF-1 · GeoServer BY kennt den GML-Subtype nicht */
    || (a.format === 'geojson' ? 'application/geo+json'
    : a.format === 'html' ? 'text/html'   /* v1080-WHTM-2 · MapServer-Template */
    : 'text/xml;subtype=gml/3.2.1');
  /* v1080-WURL-1 · WMS 1.1.1 neben 1.3.0: SRS statt CRS, X/Y statt I/J,
   * STYLES pflicht (so vermessen am Saarland-MapServer, 08.08.2026).
   * FEATURE_COUNT aus dem Adapter (v1077-WWMS-2). Die Basis darf
   * jahresabhaengig sein (baseFn -> boris<JAHR>.map) und bereits einen
   * Query-String tragen. */
  const ver = a.wmsVersion || '1.3.0';
  const p = new URLSearchParams(ver === '1.1.1' ? {
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, STYLES: '', SRS: a.crs, BBOX: bbox,
    WIDTH: '101', HEIGHT: '101', X: '50', Y: '50',
    INFO_FORMAT: fmt, FEATURE_COUNT: a.featureCount || '1',
  } : {
    /* v2590 · STYLES auch bei 1.3.0 (Pflicht laut WMS 1.3.0). BORIS-BB
     * antwortet ohne ihn „The required parameter STYLES is missing" -
     * der Leser hielt das fuer „kein Wert am Punkt", ganz BB ausser dem
     * Berlin-Rechteck lieferte nichts (gemessen 21.10.2026). */
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, STYLES: '', CRS: a.crs, BBOX: bbox,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50',
    INFO_FORMAT: fmt, FEATURE_COUNT: a.featureCount || '1',
  });
  if (a.time) p.set('TIME', a.time(year));
  const base = a.baseFn ? a.baseFn(year) : a.base;
  return base + (base.includes('?') ? '&' : '?') + p.toString();
}

/* WBORISD-1 · ArcGIS-Identify statt WMS-GetFeatureInfo.
 * Der Dienst arbeitet in ETRS89/UTM 32N; die Umrechnung liegt bereits vor.
 * tolerance in Pixeln, mapExtent/imageDisplay muessen zueinander passen —
 * ArcGIS rechnet die Toleranz ueber diese Angaben in Meter um. */
function buildArcgisUrl(a, lat, lon) {
  const { easting, northing } = wgs84ToUtm32(lat, lon);
  const m = 250;
  const p = new URLSearchParams({
    geometry: JSON.stringify({ x: easting, y: northing, spatialReference: { wkid: 25832 } }),
    geometryType: 'esriGeometryPoint',
    sr: '25832',
    layers: a.arcgisLayers || 'all',
    tolerance: '4',
    mapExtent: `${easting - m},${northing - m},${easting + m},${northing + m}`,
    imageDisplay: '500,500,96',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${a.base}/identify?${p.toString()}`;
}

/* v1080-WSLH-2 · Browser-Kennung OHNE den BORIS-D-Referer — fuer Dienste
 * ausserhalb des BORIS-D-Portals (Saarland-Geoportal laesst kennungslose
 * Anfragen haengen, Echtlauf 10.08.2026). Kennung wie ueberall ueber
 * BORISD_USER_AGENT uebersteuerbar. */
function browserHeaders() {
  return {
    'User-Agent': process.env.BORISD_USER_AGENT
      || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': '*/*',
  };
}

/* Kennung. Der Dienst weist Anfragen ohne Browser-Kennung mit 403 ab; eine
 * feinere Einstellung ist behoerdenseitig nicht vorgesehen. Ueber ENV
 * ueberschreibbar, damit eine Aenderung keine Auslieferung braucht. */
function borisdHeaders() {
  return {
    'User-Agent': process.env.BORISD_USER_AGENT
      || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://www.bodenrichtwerte-boris.de/',
    'Accept': 'application/json, text/plain, */*',
  };
}

/* Antwort: { results: [ { layerId, layerName, attributes: {...} } ] }.
 * Attributnamen sind sprechend ("Bodenrichtwert", "Stichtag des ...") —
 * die vorhandene Feldzuordnung F trifft sie ueber propCI. */
function parseArcgis(text) {
  let j;
  try { j = JSON.parse(text); } catch { return null; }
  const res = Array.isArray(j.results) ? j.results : [];
  if (!res.length) return null;
  // Wohnbauflaeche bevorzugen, sonst den ersten Treffer mit Wert.
  const mitWert = res.filter((r) => r && r.attributes);
  const wohn = mitWert.find((r) => /wohn/i.test(JSON.stringify(r.attributes)));
  return (wohn || mitWert[0] || {}).attributes || null;
}

// Wie buildUrl, aber mit frei waehlbarem INFO_FORMAT (fuer die Diagnose-Probe).
function buildUrlFmt(a, lat, lon, year, layerName, infoFormat) {
  let bbox;
  if (a.proj === 'utm32') {
    const { easting, northing } = wgs84ToUtm32(lat, lon);
    const m = 60;
    bbox = `${easting - m},${northing - m},${easting + m},${northing + m}`;
  } else {
    const d = 0.0009;
    bbox = a.axis === 'lonlat'
      ? `${lon - d},${lat - d},${lon + d},${lat + d}`
      : `${lat - d},${lon - d},${lat + d},${lon + d}`;
  }
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: layerName, QUERY_LAYERS: layerName, CRS: a.crs, BBOX: bbox,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50',
    INFO_FORMAT: infoFormat, FEATURE_COUNT: '5',
  });
  if (a.time) p.set('TIME', a.time(year));
  return `${a.base}?${p.toString()}`;
}

export const BorisRegistry = {
  // Diagnose: holt die echte Layer-Liste vom WMS (GetCapabilities) und testet fuer den Punkt
  // systematisch Layer x INFO_FORMAT durch, bis ein nicht-leeres Ergebnis kommt. Loest die Frage
  // "falscher Layer ODER falsches Format?" ohne Raten.
  async probe(lat, lon) {
    const a = this.claim(lat, lon);
    if (!a) return { error: 'kein_adapter_fuer_punkt', lat, lon };
    const out = { land: a.name, base: a.base, utm: (a.proj === 'utm32' ? wgs84ToUtm32(lat, lon) : null) };

    // 1) GetCapabilities -> Layer-Namen (brw*) + unterstuetzte GetFeatureInfo-Formate
    try {
      const cap = await httpText(`${a.base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`, { timeoutMs: 20000, retries: 1 });
      const names = [...cap.text.matchAll(/<Name>\s*([^<]+?)\s*<\/Name>/g)].map((m) => m[1]);
      out.all_layers = [...new Set(names)];
      out.brw_layers = out.all_layers.filter((n) => /brw|bodenricht|richtwert/i.test(n));
      const fiBlock = (cap.text.match(/<GetFeatureInfo>([\s\S]*?)<\/GetFeatureInfo>/) || [])[1] || '';
      out.getfeatureinfo_formats = [...fiBlock.matchAll(/<Format>\s*([^<]+?)\s*<\/Format>/g)].map((m) => m[1]);
    } catch (e) { out.capabilities_error = e.message; }

    // 2) Probe-Matrix: jeden brw-Layer mit geo+json testen, ersten Layer zusaetzlich mit anderen Formaten
    const layersToTry = (out.brw_layers && out.brw_layers.length ? out.brw_layers : (a.layers ? a.layers() : [a.layer && a.layer()])).filter(Boolean).slice(0, 6);
    const formatsToTry = ['application/geo+json', 'application/json', 'text/html', 'text/plain'];
    const year = new Date().getFullYear() - 1;
    out.probes = [];
    for (const ln of layersToTry) {
      // pro Layer nur geo+json; fuer den ersten Layer alle Formate (um Format-Problem zu erkennen)
      const fmts = ln === layersToTry[0] ? formatsToTry : ['application/geo+json'];
      for (const fmt of fmts) {
        const url = buildUrlFmt(a, lat, lon, year, ln, fmt);
        try {
          const r = await httpText(url, { timeoutMs: 12000, retries: 0 });
          const t = (r.text || '').trim();
          const hasFeature = /"features"\s*:\s*\[\s*\{/.test(t) || /<gml:|<wfs:|<FeatureCollection|brw|bodenwert|richtwert/i.test(t.length < 5000 ? t : t.slice(0, 5000));
          const emptyFc = /"features"\s*:\s*\[\s*\]/.test(t);
          out.probes.push({ layer: ln, format: fmt, status: r.contentType, bytes: t.length,
            result: hasFeature && !emptyFc ? 'DATEN' : (emptyFc ? 'leer' : 'unklar'),
            sample: t.slice(0, 200) });
        } catch (e) { out.probes.push({ layer: ln, format: fmt, result: 'fehler', error: e.message }); }
      }
    }
    return out;
  },

  // Geografisch zustaendiger Adapter. Spezifische Landesadapter (verifiziert ODER restriktiv-
  // markiert) gewinnen IMMER vor dem bundesweiten BORIS-D-Catch-all. Innerhalb der spezifischen
  // wird ein aktiver bevorzugt (sonst der erste passende = "vorbereitet"/"restricted"-Info).
  claim(lat, lon) {
    const specific = ADAPTERS.filter((a) => !a.catchAll && inBox(lat, lon, a.bbox));
    const spec = specific.find((a) => a.enabled) || specific[0];
    if (spec) return spec;
    return ADAPTERS.find((a) => a.catchAll && inBox(lat, lon, a.bbox)) || null;
  },
  /* v1077-WFBK-6 · Direktzugriff fuer Diagnose und Pruefstrecke: den
   * zweiten Catch-all (borisd_wms) erreicht man ueber claim() nie. */
  adapter(code) { return ADAPTERS.find((a) => a.code === code) || null; },

  // Nur die aktiven (fuer GetFeatureInfo nutzbaren) Adapter.
  pick(lat, lon) {
    const a = this.claim(lat, lon);
    return a && a.enabled ? a : null;
  },

  // Hauptfunktion: { lat, lon, year, manualBrw } -> einheitliches Ergebnis.
  // manualBrw = in DealPilot eingegebener Bodenrichtwert (Feld "brw") als Fallback.
  async landValue({ lat, lon, year, manualBrw, land }) {
    const fallback = (reason) => {
      const mv = num(manualBrw);
      if (mv != null) {
        return { available: true, source: 'dealpilot-eingabe', value_sqm: mv,
                 note: 'Bodenrichtwert aus DealPilot-Eingabe (kein automatischer Amtsabruf).', reason };
      }
      return { available: false, source: 'boris', reason: reason || 'kein_adapter',
               note: 'Kein automatischer Bodenrichtwert und kein manueller Wert vorhanden.' };
    };

    let claimed = this.claim(lat, lon);   /* v1395: kann auf einen Ersatz wechseln */
    if (!claimed) return fallback('land_nicht_unterstuetzt');
    if (claimed.restricted) {
      const fb = fallback('land_kostenpflichtig_oder_gesperrt');
      fb.claimed_land = claimed.name;
      fb.note = claimed.note || fb.note;
      return fb;
    }
    /* ═══ v1395 · EIN ABGESCHALTETER DIENST BEENDET NICHTS ═══════════════
     *
     * Hier stand ein `return` — und das machte aus jedem abgeschalteten
     * Landesadapter eine Sackgasse fuer sein ganzes Rechteck.
     *
     * BEIM ABSCHALTEN VON HESSEN SOFORT AUFGEFALLEN, in der Gegenprobe:
     * Wiesbaden und Frankfurt lieferten vorher 2250 und 6800 EUR/m2 ueber
     * BORIS-D — nach dem Abschalten gar nichts mehr, mit der Begruendung
     * "land_vorbereitet_nicht_aktiv". Der Catch-all, der die Werte die
     * ganze Zeit geliefert hatte, kam nicht mehr an die Reihe.
     *
     * Derselbe Gedanke wie v1389: ein Dienst, der NICHTS SAGT, ist kein
     * Befund. Ein abgeschalteter sagt erst recht nichts. Also wird er
     * uebersprungen statt zum Abbruch erklaert — und die Kette laeuft mit
     * den uebrigen passenden Adaptern weiter, Catch-alls eingeschlossen.
     *
     * Nur wenn es gar keinen anderen gibt, bleibt es bei der alten
     * Auskunft. */
    if (!claimed.enabled) {
      const ersatz = ADAPTERS.filter((c) => c !== claimed && c.enabled && !c.restricted
                                            && inBox(lat, lon, c.bbox));
      if (!ersatz.length) {
        const fb = fallback('land_vorbereitet_nicht_aktiv');
        fb.claimed_land = claimed.name;
        if (claimed.note) fb.note = claimed.note;
        return fb;
      }
      /* Der erste Ersatz uebernimmt die Rolle des zustaendigen Adapters;
         die uebrigen haengen ueber die normale Kettenlogik daran. */
      claimed = ersatz[0];
    }
    /* v1077-WFBK-1 · Adapterkette statt Einzeladapter. Ein UNVERIFIZIERTER
     * Landesadapter (be/he/mv) darf bei kein_wert/request_failed auf die
     * bundesweiten Catch-alls zurueckfallen (erst der ArcGIS-Dienst, dann
     * der offizielle BORIS-D-WMS). VERIFIZIERTE Landesadapter (nrw, bb)
     * fallen NICHT zurueck — ihr Landesdienst ist amtlich belegt; ein
     * leeres Ergebnis dort ist ein Befund, kein Anlass fuer einen anderen
     * Dienst. Restriktive Laender (BY/BW/SL/SH) erreichen diese Stelle nie
     * (return weiter oben). Ist der zustaendige Adapter selbst ein
     * Catch-all (z. B. Hannover -> ArcGIS), haengt der zweite Catch-all
     * ebenfalls in der Kette. */
    const chain = [claimed];
    if (claimed.catchAll || !claimed.verified) {
      for (const c of ADAPTERS) {
        /* v1081-WFBK-7 · nicht nur Catch-alls: auch andere aktive
         * Landesdienste mit passender Box (BBox-Ueberlapp an Grenzen —
         * Wuerzburg liegt im Hessen-Rechteck, gehoert aber zu Bayern). */
        if (c !== claimed && c.enabled && !c.restricted && inBox(lat, lon, c.bbox)) chain.push(c);
      }
    } else if (!claimed.catchAll) {
      /* v1388-WLAND · DAS RECHTECK IST KEINE LANDESGRENZE ════════════════
       *
       * Marcels Befund vom 14.09.2026: "wir haben eigentlich alle 16
       * Bundeslaender abgedeckt und koennen ueberall die Bodenrichtwerte
       * aufrufen. Vielleicht hast du den falschen genommen."
       *
       * GEMESSEN an Rinteln (Niedersachsen), lat 52.2057 / lon 9.0882:
       *
       *   claim()     -> BORIS-NRW      (verifiziert)
       *   BORIS-NRW   -> nichts          richtig, es IST nicht NRW
       *   Kette bricht ab, weil "verifiziert" keine Catch-alls zulaesst
       *   BORIS-D     -> 80 EUR/m2       der Wert war die ganze Zeit da
       *
       * Die NRW-Box reicht bis maxLon 9.52 / maxLat 52.60 und verschluckt
       * damit einen breiten Streifen Niedersachsen entlang der Weser. Fuer
       * Niedersachsen gibt es keinen eigenen Landesdienst - es laeuft ueber
       * BORIS-D, also ueber einen CATCH-ALL. Genau den schloss die Regel
       * aus.
       *
       * DIE REGEL BLEIBT RICHTIG, nur ihre Voraussetzung fehlte: "ein
       * leeres NRW ist ein Befund" gilt, WENN der Punkt in NRW liegt. Sagt
       * der Aufrufer das Land (`land`), laesst sich das pruefen. Sagt er
       * nichts, bleibt alles wie bisher - der Marktbericht schickt das Feld
       * nicht und sieht deshalb keinen Unterschied. */
      const claimLand = LAND_VON_CODE[claimed.code] || null;
      const fremd = !!(land && claimLand && String(land).toUpperCase() !== claimLand);
      for (const c of ADAPTERS) {
        if (c === claimed || !c.enabled || !inBox(lat, lon, c.bbox)) continue;
        /* Der zustaendige Landesdienst des GENANNTEN Landes zuerst. */
        if (land && LAND_VON_CODE[c.code] === String(land).toUpperCase()) {
          chain.push(c); continue;
        }
        if (!c.catchAll && c.verified) { chain.push(c); continue; }
        /* Catch-alls nur, wenn der Punkt nachweislich AUSSERHALB des
         * beanspruchten Landes liegt. Ohne Landesangabe nie. */
        if (c.catchAll && fremd) chain.push(c);
      }
    }

    /* ═══ v1389-WAUSFALL · EIN TOTER DIENST IST KEIN BEFUND ══════════════
     *
     * Marcels Ziel: "dass wir fuer jedes Bundesland die Bodenrichtwerte
     * abrufen koennen. eigentlich haben wir dafuer alles das muss aber
     * jetzt funktionieren."
     *
     * GEMESSEN ueber alle 16 Laender (Landeshauptstaedte): 15 liefern,
     * Bayern nicht. Grund ist NICHT "kein Wert an dieser Stelle", sondern
     *
     *   HTTP 404  https://gdi.bayern.de/services/bodenrichtwerte/2023/vboris
     *
     * fuer JEDEN Jahrgang (2026 bis 2023). Der Endpunkt existiert nicht
     * mehr; drei gesuchte Nachfolger (geoservices.bayern.de/wms/v1 und /v2,
     * die im TUM-Katalog genannte Adresse) antworten ebenfalls mit 404.
     *
     * DIE UNTERSCHEIDUNG, DIE BISHER FEHLTE: "kein Wert am Punkt" ist eine
     * AUSSAGE des Dienstes — dort gibt es wirklich keine Zone, und ein
     * anderer Dienst zu fragen waere Shopping. "HTTP 404" oder ein
     * Zeitueberlauf ist ein AUSFALL — der Dienst hat gar nichts gesagt.
     * Die Regel "ein leeres NRW bleibt ein Befund" trifft den ersten Fall
     * und darf nicht auf den zweiten angewandt werden.
     *
     * Deshalb: faellt ein verifizierter Landesdienst mit einem FEHLER aus,
     * duerfen die Catch-alls ran. Fuer Bayern hilft das nicht (BORIS-D
     * deckt es nicht ab, gemessen an Muenchen, Nuernberg und Augsburg) —
     * fuer jedes andere Land ist es der Unterschied zwischen einem
     * voruebergehenden Ausfall und einem Totalausfall bei uns. */
    /* ═══ v1395 · DER GRUND KOMMT VOM AUSSAGEKRAEFTIGSTEN ADAPTER ════════
     *
     * Bisher stand in der Meldung immer der Befund des ERSTEN Adapters.
     * Gemessen an Aschaffenburg (Bayern, liegt im Hessen-Rechteck):
     * Hessen wurde zuerst gefragt, gab HTTP 404 - und genau das las der
     * Nutzer, obwohl danach noch Bayern, BORIS-D und der BORIS-D-WMS
     * sauber geantwortet hatten ("hier gibt es keine Zone").
     *
     * "Kein Wert am Punkt" ist eine AUSKUNFT, ein HTTP-Fehler ein
     * AUSFALL. Wenn irgendein Adapter sauber geantwortet hat, ist seine
     * Auskunft die bessere - auch wenn ein anderer vorher gescheitert
     * ist. Deshalb wird der erste SAUBERE Befund gemerkt und bevorzugt.
     *
     * Dasselbe gilt fuer die Gebuehrenauskunft aus v1393: sie ist die
     * aussagekraeftigste Antwort ueberhaupt und schlaegt beide. */
    /* ═══ v2592 · AUCH EIN LEERES „VERIFIZIERT" FAELLT ZURUECK ═══════════
     *
     * Bis v2591 durften die Catch-alls nur nach einem AUSFALL ran. Eine
     * leere Antwort eines verifizierten Landesdienstes beendete die Suche -
     * auch dann, wenn der Punkt gar nicht in seinem Land lag und der
     * Aufrufer das Land nicht mitschickte (das Rechteck-Problem aus v1388).
     *
     * Die Unterscheidung, die jetzt gilt:
     *   - LEER (keine Zone am Punkt) oder AUSFALL -> die Catch-alls fragen.
     *     BORIS-D fuehrt fuer NRW, BB, BE dieselben Zahlen wie der
     *     Landesdienst (gemessen 21.10.2026), ein Rueckfall erfindet also
     *     nichts - er findet nur, was das Rechteck verdeckt hat.
     *   - ZONE OHNE WERT vom zustaendigen Landesdienst -> das ist eine
     *     AUSKUNFT („hier gibt es keinen Bodenrichtwert"), und dann wird
     *     NICHT bei einem anderen Dienst nachgefragt. Gehoert der Dienst
     *     nachweislich zu einem anderen Land als `land`, zaehlt seine
     *     Auskunft nicht. */
    let hit = null, first = null, sauber = null, gebuehr = null, ausfall = false, explizit = null;
    const _landUp = land ? String(land).toUpperCase() : null;
    for (const a of chain) {
      const r = await this._queryAdapter(a, lat, lon, year);
      if (first == null) first = r;
      if (r.gebuehr && gebuehr == null) gebuehr = r;
      if (!r.lastErr && sauber == null) sauber = r;
      if (r.value != null) { hit = { a, r }; break; }
      if (r.lastErr) ausfall = true;
      if (!a.catchAll && r.zoneGesehen && explizit == null
          && (!_landUp || !LAND_VON_CODE[a.code] || LAND_VON_CODE[a.code] === _landUp)) explizit = a;
    }
    /* Der zustaendige Dienst hat KEINE einzige saubere Antwort gegeben. */
    const dienstAusfall = !!(first && first.lastErr && !first.antworten);
    if (!hit && (ausfall || !explizit)) {
      for (const c of ADAPTERS) {
        if (chain.indexOf(c) >= 0 || !c.catchAll || !c.enabled) continue;
        if (!inBox(lat, lon, c.bbox)) continue;
        const r = await this._queryAdapter(c, lat, lon, year);
        if (r.value != null) { hit = { a: c, r }; break; }
      }
    }

    if (!hit) {
      /* v1395: Gebuehrenauskunft schlaegt saubere Fehlanzeige schlaegt
         Ausfall - in dieser Reihenfolge, nicht nach Aufrufreihenfolge. */
      const r0 = gebuehr || sauber || first || {};
      const fb = fallback(r0.lastErr ? 'request_failed:' + r0.lastErr : 'kein_wert_am_punkt');
      fb.tried_source = chain.map((c) => c.name).join(' -> ');   /* v1077-WFBK-3 */
      fb.tried_layers = r0.layers || null;
      fb.tried_years = r0.years || null;
      fb.properties_raw = r0.raw != null ? r0.raw : null; // damit das Mapping bei Bedarf justiert werden kann
      /* v1389-WAUSFALL: Traegt der zustaendige Adapter eine Notiz zu einem
         bekannten Ausfall, gehoert sie in die Antwort. Bisher erschien sie
         NUR bei gesperrten Laendern (Z. 565) - ausgerechnet im Ausfall,
         wo der Nutzer am ehesten wissen will, woran es liegt, kam die
         Standardfloskel "kein automatischer Bodenrichtwert vorhanden". */
      /* v2592 · Ausfall und Rechtsstand sind zwei Texte (s. Bayern-Adapter).
         `dienst_ausfall` sagt dem Aufrufer, dass der Dienst NICHTS gesagt
         hat - dann heisst es „derzeit nicht erreichbar", nicht „kein Wert". */
      if (dienstAusfall) {
        fb.dienst_ausfall = true;
        fb.note = claimed.ausfallNote
          || ('Der Bodenrichtwert-Dienst (' + claimed.name + ') ist derzeit nicht erreichbar. '
              + 'Bitte den Bodenrichtwert selbst eintragen.');
      } else if (claimed.note) fb.note = claimed.note;
      fb.claimed_land = claimed.name;
      /* ═══ v1393 · DER WEG ZUM WERT, WENN ER GELD KOSTET ════════════════
       * Bayern antwortet vollstaendig und setzt an die Stelle des Wertes
       * „Information gebuehrenpflichtig". Zone, Gemarkung, Stichtag und
       * der zustaendige Gutachterausschuss stehen aber in derselben
       * Antwort. Die gehoeren weitergereicht: „wo kein Wert vorliegt,
       * bekommt der Kunde den Weg dorthin" (CLAUDE.md). Mit Zone und
       * Ausschuss findet er ihn in einer Minute. */
      if (r0.gebuehr) {
        fb.reason = 'wert_gebuehrenpflichtig';
        fb.gebuehr = r0.gebuehr;
        const g = r0.gebuehr;
        /* v2592 · Der Satz behauptete eine Landesregel („von diesem Bundesland
           nur gegen Gebuehr"). Belegt ist nur, was die Antwort sagt: an DIESER
           Stelle steht statt des Wertes „Information gebuehrenpflichtig". */
        fb.dienst_ausfall = false;
        fb.note = 'Der Bodenrichtwert liegt vor; der Dienst des Landes weist ihn an '
          + 'dieser Stelle als gebührenpflichtig aus.'
          + (g.zone ? ' Bodenrichtwertzone: „' + g.zone + '".' : '')
          + (g.gemarkung ? ' Gemarkung ' + g.gemarkung + '.' : '')
          + (g.stichtag ? ' Stichtag ' + g.stichtag + '.' : '')
          + (g.ausschuss ? ' Zuständig: ' + g.ausschuss + '.' : '');
      }
      return fb;
    }

    const out = {
      available: true, source: hit.a.name, license: hit.a.license, verified: hit.a.verified,
      quellenvermerk: hit.a.quellenvermerk || null,   /* v1071-WLIZ-2 */
      value_sqm: hit.r.value, stichtag: hit.r.stichtag, nutzung: hit.r.nutzung, zone: hit.r.zone,
      used_layer: hit.r.usedLayer, used_year: hit.r.usedYear, properties_raw: hit.r.raw,
    };
    /* ═══ v2592 · EIN ALTER STICHTAG GEHOERT GESAGT ══════════════════════
     *
     * BORIS-D liefert fuer Bremen den Stichtag 01.01.2023, fuer Sachsen
     * 01.01.2024 (gemessen 21.10.2026, Bremen, Bremerhaven, Dresden,
     * Oschatz). Der Bericht schrieb ihn hin, aber ohne Einordnung - ein
     * drei Jahre alter Wert sah aus wie ein aktueller. Veraltet heisst hier:
     * Stichtagsjahr VOR dem Vorjahr des Bewertungsjahres. Ob es einen
     * neueren gibt, wissen wir nicht - deshalb ein Hinweis, keine Sperre. */
    const _stJ = stichtagJahr(hit.r.stichtag);
    const _bewJ = Number(year) || new Date().getFullYear();
    out.stichtag_veraltet = _stJ != null ? _stJ < _bewJ - 1 : null;
    if (out.stichtag_veraltet) {
      out.stichtag_hinweis = 'Stichtag ' + _stJ + ' – älter als ein Jahr; ein neuerer '
        + 'Bodenrichtwert kann vorliegen (beim zuständigen Gutachterausschuss prüfen).';
    }
    if (hit.a !== chain[0]) {
      /* v1077-WFBK-4 · Der Wert kam aus dem Rueckfall, nicht vom eigentlich
       * zustaendigen (unverifizierten) Landesdienst — das gehoert in den
       * Bericht, jede Zahl traegt ihre Herkunft. */
      out.fallback_von = chain[0].name;
      out.note = dienstAusfall
        ? 'Landesdienst ' + chain[0].name + ' derzeit nicht erreichbar — Wert über ' + hit.a.name + '.'
        : 'Landesdienst ' + chain[0].name + ' lieferte keinen Wert — Rueckfall auf ' + hit.a.name + '.';
    }
    return out;
  },

  /* v1077-WFBK-2 · Layer- + Jahr-Kaskade fuer EINEN Adapter — herausgeloest
   * aus landValue, damit Adapterkette und verifyAll denselben Kern nutzen.
   * Semantik unveraendert uebernommen (v1071-WBRW-1, WBORISD-3, WBORISD-4). */
  async _queryAdapter(a, lat, lon, year) {
    // Layer- + Jahr-Kaskade: BRW zum aktuellen Stichtag sind oft noch nicht veroeffentlicht,
    // daher die letzten Jahre durchprobieren (neuestes zuerst). Ersten Treffer nehmen.
    const layersInfo = a.layers ? a.layers(year) : [a.layer(year)]; // fuer die Diagnose-Rueckgabe
    const nowY = new Date().getFullYear();
    /* v1071-WBRW-1 · Der AKTUELLE Jahrgang stand an letzter Stelle — damit
     * gewann immer der vorjaehrige. Gemessen im August 2026: Bodenrichtwert
     * mit Stichtag 01.01.2025 (135 EUR/m2), waehrend derselbe Bericht den
     * Immobilienrichtwert bereits zum 01.01.2026 auswies. Elf Prozent
     * Unterschied, und sie gehen in Bodenwert, Bodenwertverzinsung und
     * Sachwert.
     *
     * Die alte Reihenfolge war eine Kruecke fuer die Monate, in denen der
     * neue Jahrgang noch nicht veroeffentlicht ist (BORIS-NRW: bis Ende
     * Maerz). Die braucht es nicht — die Kaskade probiert der Reihe nach und
     * nimmt den ersten Treffer. Ist 2026 noch nicht da, faellt sie von
     * selbst auf 2025. */
    /* v1077-WWMS-4 · Adapter ohne Jahresbezug (kein TIME-Parameter, keine
     * jahresabhaengigen Layer) stellen fuer jedes Kandidatenjahr dieselbe
     * Anfrage — ein Durchlauf genuegt. Schont den Behoerdenserver
     * (ein Abruf je Sekunde gilt unveraendert). */
    /* v1393: Ein Adapter darf seine eigene Jahresliste mitbringen. Bayern
       ermittelt nur alle ZWEI Jahre (2024, 2026) - die Standardkaskade
       lief dort auf 2023 aus und meldete am Ende einen 404 auf einen
       Jahrgang, den es nie gab. Das sah aus wie ein toter Dienst. */
    const yearCandidates = year ? [year]
      : (typeof a.years === 'function' ? a.years(nowY)
      : (a.yearIndependent ? [nowY] : [nowY, nowY - 1, nowY - 2, nowY - 3]));
    let value = null, stichtag = null, nutzung = null, zone = null, raw = null, usedLayer = null, usedYear = null, lastErr = null;
    let gebuehr = null;   /* v1393: gesperrter Wert samt Zone und Ausschuss */
    /* v2592 · antworten = saubere Antworten (kein Fehler, keine Fehlerseite);
     * zoneGesehen = mindestens ein Feature/eine Zone am Punkt. Eine Zone
     * OHNE Wert ist eine ausdrueckliche Auskunft des Dienstes, eine leere
     * Antwort nicht - danach unterscheidet landValue() den Rueckfall. */
    let antworten = 0, zoneGesehen = false;
    outer:
    for (const yr of yearCandidates) {
      /* v1080-WJR-1 · Layer je KANDIDATENJAHR aufloesen — erst damit greift
       * die Jahres-Kaskade auch bei jahresabhaengigen Layern
       * (bb: bbv_pg_zobau_<JAHR>, sl: BORISSL<JAHR>). Bisher wurde der
       * Layer einmal vor der Schleife bestimmt und blieb beim aktuellen
       * Jahrgang haengen. */
      const lys = a.layers ? a.layers(yr) : [a.layer(yr)];
      for (const ln of lys) {
        let text;
        try {
          /* WBORISD-3 · ArcGIS-Zweig. Ein Abruf je Sekunde als Obergrenze —
           * wir sind Gast auf einem Behoerdenserver. Die Jahres-Kaskade
           * entfaellt hier, der Dienst liefert den aktuellen Jahrgang. */
          if (a.protocol === 'arcgis') {
            const res = await httpText(buildArcgisUrl(a, lat, lon),
              /* v1082-WBWR-2 · Adapter-Header gewinnen (BW: BW-Referer);
               * ohne eigene Header wie bisher borisdHeaders. */
              { timeoutMs: 20000, retries: 1, headers: a.headers ? a.headers() : borisdHeaders() });
            text = res.text;
          } else {
            /* v1077-WWMS-3 · Adapter koennen eigene Header mitgeben. Der
             * BORIS-D-WMS laeuft auf derselben Infrastruktur, die Anfragen
             * ohne Browser-Kennung mit 403 abweist (Aktennotiz Marcel,
             * BORISD_USER_AGENT). */
            const res = await httpText(buildUrl(a, lat, lon, yr, ln),
              { timeoutMs: a.timeoutMs || 15000, /* v1080-WSLH-3 */
                retries: 1, headers: a.headers ? a.headers() : undefined });
            text = res.text;
          }
        } catch (e) { lastErr = e.message; continue; }

        /* ═══ v2592 · HTTP 200 IST NOCH KEINE ANTWORT ═════════════════════
         *
         * Zwei Faelle, beide am 21.10.2026 gemessen, in denen ein Dienst
         * „200" sagt und trotzdem nichts gesagt hat:
         *   - der BORIS-D-WMS kam als PORTALSEITE zurueck (falsche Basis in
         *     der .env, Weiterleitung auf bodenrichtwerte-boris.de),
         *   - BORIS-BB meldete in einer ServiceException „STYLES is missing"
         *     (v2590).
         * Der Leser fand in beiden kein Feature und machte daraus „kein Wert
         * am Punkt" - eine AUSKUNFT, wo ein AUSFALL war. Ab hier zaehlen
         * beide als Fehler: dann darf die Kette weiterfragen, und die
         * Meldung nennt den Ausfall statt einer Fehlanzeige. */
        const _kopf = String(text || '').slice(0, 600);
        if (a.format !== 'html' && /^\s*(<!DOCTYPE html|<html)/i.test(_kopf)) {
          lastErr = 'HTML-Seite statt Dienstantwort'; continue;
        }
        if (/<(?:[A-Za-z0-9_]+:)?ServiceException\b/.test(_kopf)
            || (a.protocol === 'arcgis' && /^\s*\{\s*"error"\s*:/.test(_kopf))) {
          lastErr = 'Dienstfehler: ' + _kopf.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
          continue;
        }
        antworten++;

        let v = null, st = null, nu = null, zo = null, rw = null;
        if (a.protocol === 'arcgis') {   /* WBORISD-4 */
          const props = parseArcgis(text);
          if (props) {
            zoneGesehen = true;
            rw = props;
            v = num(propCI(props, F.value));
            st = propCI(props, F.stichtag);
            nu = propCI(props, F.nutzung);
            zo = propCI(props, F.zone);
          } else rw = (text || '').slice(0, 600);
        } else if (a.format === 'html') {
          /* v1080-WHTM-3 · MapServer-Template: Sachdaten stehen NUR im
           * text/html (GML liefert dort blosse Geometrie, gemessen SL). */
          const props = parseHtmlProps(text);
          if (props) { zoneGesehen = true; rw = props; v = num(propCI(props, F.value)); st = propCI(props, F.stichtag); nu = propCI(props, F.nutzung); zo = propCI(props, F.zone); }
          else rw = (text || '').slice(0, 1200);
        } else if (a.format === 'geojson') {
          let props = parseGeoJson(text, a.waehleFeature, lat, lon);
          /* v2592 · rawZusatz: Felder, die ein Landesdienst nicht fuehrt, der
           * Orchestrator aber liest (Berlin: Gemeindeschluessel, Ausschuss,
           * GFZ unter BORIS-D-Namen). Die Antwort des Dienstes gewinnt. */
          if (props && typeof a.rawZusatz === 'function') props = Object.assign(a.rawZusatz(props), props);
          if (props) { zoneGesehen = true; rw = props; v = num(propCI(props, F.value)); st = propCI(props, F.stichtag); nu = propCI(props, F.nutzung); zo = propCI(props, F.zone); }
          else rw = (text || '').slice(0, 1200); // kein Feature -> Rohtext fuer Diagnose behalten
        } else {
          rw = text.slice(0, 1200);
          const vRoh = parseGmlField(text, F.value);
          /* v1081-WBY-2 · Sperrtexte ("Information gebuehrenpflichtig",
           * auch als &#252;-Entitaet mit Ziffern) sind KEIN Wert. */
          const gesperrt = !!(vRoh && /geb(ührenpflichtig|uehrenpflichtig|&#252;hrenpflichtig)/i.test(String(vRoh)));
          v = gesperrt ? null : num(vRoh);
          if (vRoh != null || /<(?:[A-Za-z0-9_]+:)?(featureMember|member)\b/.test(text)) zoneGesehen = true;
          st = parseGmlField(text, F.stichtag);
          nu = parseGmlField(text, F.nutzung); zo = parseGmlField(text, F.zone);
          /* ═══ v1393 · EIN GESPERRTER WERT IST KEIN LEERES ERGEBNIS ══════
           *
           * Gemessen am Marienplatz, 14.09.2026: Bayern antwortet
           * vollstaendig — Gutachterausschuss, Gemarkung,
           * Bodenrichtwertzone („Marienplatz"), Stichtag 01.01.2024 — und
           * setzt an die Stelle des Wertes den Satz „Information
           * gebuehrenpflichtig". Der Sperrtext wurde seit v1081 richtig
           * als Nicht-Wert erkannt, aber ALLES UEBRIGE fiel mit ihm weg.
           *
           * Das ist der Unterschied zwischen „wir wissen nichts" und „der
           * Wert existiert, die Zone heisst so, und er kostet Geld". Nach
           * CLAUDE.md bekommt der Kunde genau dann den WEG zum Wert. */
          if (gesperrt) {
            gebuehr = {
              zone: zo || null,
              stichtag: st || null,
              gemarkung: parseGmlField(text, ['gemarkung']) || null,
              ausschuss: parseGmlField(text, ['gutachterausschuss_name']) || null,
              gemeinde: parseGmlField(text, ['gemeinde_name']) || null,
            };
          }
        }
        if (v != null) { value = v; stichtag = st; nutzung = nu; zone = zo; raw = rw; usedLayer = ln; usedYear = yr; break outer; }
        if (rw && raw == null) raw = rw; // letzten Roh-Response fuer Diagnose behalten
      }
    }
    return { value, stichtag, nutzung, zone, raw, usedLayer, usedYear, lastErr, gebuehr,
             antworten, zoneGesehen,
             layers: layersInfo, years: yearCandidates };
  },

  // Ein-Klick-Verifikation: testet jedes hinterlegte Land mit Dienst an einem Beispielpunkt
  // (BBox-Mitte) ueber die ECHTE Pipeline. Laeuft auf dem (vernetzten) Server -> zeigt, welche
  // Endpunkte echte Bodenrichtwerte liefern. Ergebnis -> danach gezielt enabled/Layer justieren.
  async verifyAll() {
    const out = [];
    for (const a of ADAPTERS) {
      if (a.restricted || !a.base) { out.push({ code: a.code, name: a.name, status: 'manuell (kein freier Dienst)' }); continue; }
      const lat = +(((a.bbox.minLat + a.bbox.maxLat) / 2).toFixed(5));
      const lon = +(((a.bbox.minLon + a.bbox.maxLon) / 2).toFixed(5));
      try {
        /* v1077-WFBK-5 · Catch-alls direkt abfragen, sonst testet die
         * BBox-Mitte immer nur den ERSTEN Catch-all der Kette. */
        let r;
        if (a.catchAll) {
          const q = await this._queryAdapter(a, lat, lon);
          r = { available: q.value != null, value_sqm: q.value, source: a.name,
                used_layer: q.usedLayer, used_year: q.usedYear,
                reason: q.value == null ? (q.lastErr ? 'request_failed:' + q.lastErr : 'kein_wert_am_punkt') : null };
        } else {
          r = await this.landValue({ lat, lon });
        }
        out.push({ code: a.code, name: a.name, enabled: a.enabled, testpunkt: { lat, lon },
          liefert_wert: r.available && r.value_sqm != null, value_sqm: r.value_sqm ?? null,
          source: r.source, used_layer: r.used_layer || null, used_year: r.used_year || null,
          reason: r.reason || null, fallback_von: r.fallback_von || null });
      } catch (e) { out.push({ code: a.code, name: a.name, error: e.message }); }
    }
    return out;
  },

  // Fuer /health und Transparenz: Abdeckungsuebersicht aller hinterlegten Laender.
  status() {
    return ADAPTERS.map((a) => ({
      code: a.code, name: a.name, enabled: a.enabled, verified: a.verified,
      license: a.license || null, catchAll: !!a.catchAll, restricted: !!a.restricted,
      coverage: a.enabled ? 'live' : (a.restricted ? 'manuell (rechtlich gesperrt/gebührenpflichtig)' : 'vorbereitet (Probe nötig)'),
      note: a.note || null,
    }));
  },
};
