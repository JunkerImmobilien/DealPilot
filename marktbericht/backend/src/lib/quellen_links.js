// quellen_links.js  (v1099-WQL)
//
// WO DER KUNDE DEN WERT SELBST HOLT.
//
// Marcels Vorgabe vom 13.09.2026: „gib im Marktbericht bei den
// Liegenschaftszinsen und Sachwertfaktoren den Link an, wenn der Kunde die
// Adresse eingegeben hat. Dann kann er selber die Werte holen oder kaufen,
// wenn diese nicht umsonst zur Verfügung stehen."
//
// DAS IST DAS GEGENSTUECK ZUR DOKTRIN. Wir erfinden keine Zahl — also
// muessen wir umso genauer sagen koennen, wo die echte steht. Ein Bericht,
// der „kein Wert hinterlegt" sagt und den Nutzer damit allein laesst, ist
// schlechter als einer, der den zustaendigen Ausschuss beim Namen nennt und
// verlinkt.
//
// DREI REGELN, die aus dem Backlog (C2) kommen und hier gelten:
//
//   1. NUR DIE LANDINGSEITE, nie das Jahrgangs-PDF. Deep-Links brechen
//      jaehrlich; ein toter Link im Kundenbericht ist schlimmer als keiner.
//   2. KEIN BETRAG OHNE BELEG. Wo ein Bericht kostenpflichtig ist, steht
//      „kostenpflichtig" — keine Zahl, solange sie nicht belegt ist.
//   3. DER LINK DARF NICHT SUGGERIEREN, dass DealPilot den Wert liefert.
//      Der Text sagt, wer ihn fuehrt.
//
// WARUM EINE DATEI UND KEINE DATENBANKTABELLE (noch nicht):
// Das Quellenregister in der Datenbank ist Backlog C1 und groesser — es
// fuehrt Jahrgang, Lizenz, Stichtag, Seite und den Pruefzyklus. Diese Datei
// ist der kleine Anfang: sie beantwortet genau eine Frage, naemlich „wohin
// schicke ich den Nutzer". Sobald C1 steht, zieht sie dort ein; bis dahin
// ist eine Datei besser als ein fehlender Link.

/** Bundesland-Portale. Schluessel ist das Landeskuerzel des AGS (erste zwei
 *  Stellen), damit die Zuordnung ohne Namensliste funktioniert. */
export const LAND_QUELLEN = {
  '01': { land: 'Schleswig-Holstein',
          stelle: 'Obere Gutachterausschuss für Grundstückswerte in Schleswig-Holstein',
          url: 'https://www.schleswig-holstein.de/DE/landesregierung/themen/bauen-wohnen/gutachterausschuesse/gutachterausschuesse_node.html',
          zugang: 'teils kostenpflichtig' },
  '02': { land: 'Hamburg',
          stelle: 'Gutachterausschuss für Grundstückswerte in Hamburg',
          url: 'https://www.hamburg.de/politik-und-verwaltung/behoerden/behoerde-fuer-stadtentwicklung-und-wohnen/aemter-und-landesbetrieb/landesbetrieb-geoinformation-und-vermessung/produkte-und-dienstleistungen/infos-ueber-grundstuecke/gutachterausschuss-fuer-grundstueckswerte',
          zugang: 'kostenfrei' },
  '03': { land: 'Niedersachsen',
          stelle: 'Gutachterausschüsse für Grundstückswerte in Niedersachsen',
          url: 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/grundstucksmarktdaten-197115.html',
          zugang: 'kostenfrei',
          hinweis: 'Die Werte stehen als interaktive Kalkulatoren bereit — Bodenrichtwert und vorläufigen Sachwert eingeben, der Faktor wird berechnet.' },
  '04': { land: 'Bremen',
          stelle: 'Gutachterausschuss für Grundstückswerte in Bremen',
          url: 'https://www.bauumwelt.bremen.de/bauen/gutachterausschuss-fuer-grundstueckswerte-3489',
          zugang: 'teils kostenpflichtig' },
  '05': { land: 'Nordrhein-Westfalen',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte in Nordrhein-Westfalen',
          url: 'https://www.boris.nrw.de/',
          zugang: 'kostenfrei',
          hinweis: 'Die Grundstücksmarktberichte der einzelnen Ausschüsse stehen zusätzlich unter gars.nrw.' },
  '06': { land: 'Hessen',
          stelle: 'Zentrale Geschäftsstelle der Gutachterausschüsse für Immobilienwerte des Landes Hessen',
          url: 'https://hvbg.hessen.de/immobilienwertermittlung/immobilienmarktberichte',
          zugang: 'kostenfrei',
          hinweis: 'Die regionalen Immobilienmarktberichte der letzten zehn Jahre stehen im Downloadcenter unter gds.hessen.de.' },
  '07': { land: 'Rheinland-Pfalz',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte Rheinland-Pfalz',
          url: 'https://gutachterausschuesse.rlp.de/marktdaten',
          zugang: 'teils kostenpflichtig',
          hinweis: 'Die örtlichen Grundstücksmarktberichte liegen bei den Städten und Kreisen; der Landesbericht ist kostenpflichtig.' },
  '08': { land: 'Baden-Württemberg',
          stelle: 'Gutachterausschüsse in Baden-Württemberg',
          url: 'https://www.gutachterausschuesse-bw.de/',
          zugang: 'teils kostenpflichtig' },
  '09': { land: 'Bayern',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte im Freistaat Bayern',
          url: 'https://www.gutachterausschuesse-bayern.de/marktberichte-bayern/',
          zugang: 'kostenfrei',
          hinweis: 'Der Landesbericht ist frei abrufbar; die örtlichen Berichte führen die Gutachterausschüsse der Kreise und kreisfreien Städte.' },
  '10': { land: 'Saarland',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte im Saarland',
          url: 'https://www.saarland.de/lvgl/DE/portalthemen/immobilienmarkt/immobilienmarkt_node.html',
          zugang: 'teils kostenpflichtig' },
  '11': { land: 'Berlin',
          stelle: 'Gutachterausschuss für Grundstückswerte in Berlin',
          url: 'https://www.berlin.de/gutachterausschuss/',
          zugang: 'kostenfrei' },
  '12': { land: 'Brandenburg',
          stelle: 'Gutachterausschüsse für Grundstückswerte im Land Brandenburg',
          url: 'https://gutachterausschuesse-bb.de/',
          zugang: 'kostenfrei' },
  '13': { land: 'Mecklenburg-Vorpommern',
          stelle: 'Gutachterausschüsse für Grundstückswerte in Mecklenburg-Vorpommern',
          url: 'https://www.laiv-mv.de/Geoinformation/Wertermittlung/gutachterausschuesse%E2%80%93fuer%E2%80%93grundstueckswerte/',
          zugang: 'kostenfrei' },
  '14': { land: 'Sachsen',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte im Freistaat Sachsen',
          url: 'https://www.landesvermessung.sachsen.de/gutachterausschuesse-fuer-grundstueckswerte-4127.html',
          zugang: 'teils kostenpflichtig' },
  '15': { land: 'Sachsen-Anhalt',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte in Sachsen-Anhalt',
          url: 'https://www.lvermgeo.sachsen-anhalt.de/de/gutachterausschuesse.html',
          zugang: 'kostenfrei' },
  '16': { land: 'Thüringen',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte in Thüringen',
          url: 'https://tlbg.thueringen.de/gutachterausschuesse',
          zugang: 'kostenfrei' },
};

/**
 * Den Weg zur Quelle fuer einen AGS bestimmen.
 *
 * Liefert IMMER etwas, solange der AGS ein bekanntes Landeskuerzel traegt —
 * das ist der Sinn der Sache: der Nutzer soll nie ohne Anlaufstelle
 * dastehen. Ein Registersatz, falls vorhanden, gewinnt gegen die
 * Landestabelle, weil er den ZUSTAENDIGEN Ausschuss namentlich kennt.
 *
 * @param {string} ags        Amtlicher Gemeindeschluessel
 * @param {object} [satz]     Registersatz, falls einer vorliegt
 * @returns {{stelle:string, url:string, land:string, zugang:string,
 *            hinweis?:string, herkunft:'registersatz'|'landestabelle'}|null}
 */
export function quelleFuer(ags, satz = null) {
  /* Der Registersatz ist die bessere Auskunft: er nennt den Ausschuss, der
   * wirklich zustaendig ist, und die Seite, von der die Zahl stammt. */
  if (satz && satz.quelle_url) {
    const land = LAND_QUELLEN[String(satz.ags || ags || '').slice(0, 2)];
    return {
      stelle: satz.gaa_name || (land && land.stelle) || 'zuständiger Gutachterausschuss',
      url: satz.quelle_url,
      land: land ? land.land : null,
      zugang: (land && land.zugang) || 'unbekannt',
      hinweis: satz.auflagen || undefined,
      herkunft: 'registersatz',
    };
  }

  const l = LAND_QUELLEN[String(ags || '').replace(/\D/g, '').slice(0, 2)];
  if (!l) return null;
  return { stelle: l.stelle, url: l.url, land: l.land, zugang: l.zugang,
           hinweis: l.hinweis, herkunft: 'landestabelle' };
}

/**
 * Ein Satz fuer den Bericht — fertig formuliert, damit die Formulierung an
 * EINER Stelle steht und nicht in drei Ansichten auseinanderlaeuft.
 *
 * Er sagt drei Dinge: wer den Wert fuehrt, wo er steht, und ob er etwas
 * kostet. Was er NICHT sagt: dass DealPilot ihn liefert.
 */
export function quellenSatz(q, kennzahl = 'Wert') {
  if (!q) return null;
  const was = kennzahl === 'sachwertfaktor' ? 'Sachwertfaktoren'
            : kennzahl === 'liegenschaftszinssatz' ? 'Liegenschaftszinssätze'
            : kennzahl;
  const kosten = q.zugang === 'kostenfrei'
      ? 'Der Bericht steht dort kostenfrei zum Abruf.'
    : q.zugang === 'teils kostenpflichtig'
      ? 'Je nach Ausschuss ist der Bericht kostenfrei oder kostenpflichtig.'
      : '';
  return {
    text: `${was} für dieses Gebiet führt ${q.stelle}.`,
    kosten,
    url: q.url,
    hinweis: q.hinweis || null,
  };
}
