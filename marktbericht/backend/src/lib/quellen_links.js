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
  /* v1122-WNI · Niedersachsen führt seine Sachwertfaktoren in KALKULATOREN,
     einen je Ausschuss und Teilmarkt, erreichbar über eine Karte. Der Weg
     dorthin ist zwei Klicks lang und lohnt die genauere Auskunft: die
     Landesseite darüber führt alle Marktdaten, die Karte führt GENAU den
     Rechner für das Gebiet des Nutzers. */
  '03': { land: 'Niedersachsen',
          stelle: 'Gutachterausschüsse für Grundstückswerte in Niedersachsen',
          url: 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/sachwertfaktor/',
          zugang: 'kostenfrei',
          hinweis: 'Der Sachwertfaktor steht dort in einem Rechner, nicht in einer Tabelle: Teilmarkt wählen (Ein-/Zweifamilienhaus, Reihenhaus/Doppelhaushälfte, Hof, Wochenendhaus), auf der Karte die Region anklicken, dann Bodenrichtwert und vorläufigen Sachwert eingeben. Der Rechner nennt auch die Standardabweichung und die Stichprobe.' },
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

/* ═══ v1118-WAQ · DIE AUSSCHUSS-EBENE ═══════════════════════════════════
 *
 * Die Landestabelle darueber schickt jeden Nutzer auf dasselbe Portal.
 * Das ist besser als nichts, aber es ist nicht das, was wir wissen.
 *
 * Bei der Ernte wird JEDER Ausschuss einzeln geprueft, und bei vielen
 * endet die Pruefung mit „geht nicht" — der Bericht ist kostenpflichtig,
 * die Zahlen stehen nur als Diagramm, das Modell ist zehn Jahre alt. Diese
 * Erkenntnis war Arbeit und ist fuer den Nutzer mehr wert als das
 * Landesportal: sie sagt ihm, WO genau die Zahl liegt und WAS ihn
 * erwartet, wenn er sie holt.
 *
 * Ohne diese Tabelle faellt sie nach jeder Ernte auf den Boden.
 *
 * Schluessel ist der AGS-PRAEFIX (Kreis- oder Gemeindeschluessel); der
 * laengste Treffer gewinnt. `warum_kein_wert` ist Pflicht — wer hier einen
 * Eintrag anlegt, hat nachgesehen und schreibt auf, was er gefunden hat.
 *
 * NICHT hier hinein gehoert ein Ausschuss, dessen Zahlen im Register
 * stehen. Dort gewinnt ohnehin der Registersatz. */
export const AUSSCHUSS_QUELLEN = {
  '08111': {
    stelle: 'Gutachterausschuss für die Ermittlung von Grundstückswerten in Stuttgart',
    url: 'https://www.stuttgart.de/leben/bauen/grundstueckswerte/',
    zugang: 'kostenpflichtig',
    warum_kein_wert: 'Der Internet-Auszug des Grundstücksmarktberichts ist kostenfrei, führt die Sachwertfaktoren aber nicht. Sie stehen in Kapitel 6.5.3 des Vollberichts, den das Kundenzentrum des Stadtmessungsamts abgibt.',
    hinweis: 'Die Modellbeschreibung zu den Sachwertfaktoren ist frei abrufbar (Stand 20.05.2025) — sie nennt alle Ansätze, die eine modellkonforme Rechnung braucht, nur nicht die Faktoren selbst.',
  },
  '01002': {
    stelle: 'Gutachterausschuss für Grundstückswerte in der Landeshauptstadt Kiel',
    url: 'https://www.gutachterausschuss-kiel.de/dienstleistungen/sachwertfaktoren/',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Das veröffentlichte Sachwertfaktorenmodell wertet die Jahre 2013 bis 2015 aus (Stand Februar 2017). Ein Faktor mit zehn Jahre altem Stichtag gehört nicht ungefragt in eine heutige Wertermittlung — wer ihn anwenden will, soll das bewusst tun.',
  },
  '01056': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Kreis Pinneberg',
    url: 'https://www.schleswig-holstein.de/gaa/DE/wir_ueber_uns/Gutachterausschuesse/gaPinneberg',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Die Immobilienmarktinformation 2025 beschreibt vier Bodenrichtwertklassen (100–275, 300–425, rund 500, 600–850 €/m²), druckt die Sachwertfaktoren aber nur als Diagramm ab. Eine Kurve abzulesen wäre geraten.',
  },
  '01060': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Kreis Segeberg',
    url: 'https://www.segeberg.de/Für-Segeberger/Umwelt-Planen-Bauen/Gutachterausschuss/',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Der Grundstücksmarktbericht liegt beim Kreis selbst und nicht auf dem Landesportal; ein Sachwertfaktorenblatt im Format der übrigen Ausschüsse gibt es dort nicht.',
  },
  '01062': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Kreis Stormarn',
    url: 'https://www.kreis-stormarn.de/kreis/sonderbereiche/gutachterausschuss-fuer-grundstueckswerte-im-kreis-stormarn/index.html',
    zugang: 'kostenpflichtig',
    warum_kein_wert: 'Der Grundstücksmarktbericht erscheint alle zwei bis drei Jahre und führt Sachwertfaktoren; die Einzelwerte gibt der Ausschuss kostenpflichtig über bodenrichtwerte.com heraus.',
  },
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

  /* v1118-WAQ - der zustaendige Ausschuss gewinnt gegen das Landesportal.
     Laengster Praefix zuerst: ein Gemeindeeintrag (08111) schlaegt einen
     Kreiseintrag, ein Kreiseintrag schlaegt das Land. */
  const ziffern = String(ags || '').replace(/\D/g, '');
  if (ziffern) {
    const treffer = Object.keys(AUSSCHUSS_QUELLEN)
      .filter((p) => ziffern.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    if (treffer) {
      const a = AUSSCHUSS_QUELLEN[treffer];
      const land = LAND_QUELLEN[ziffern.slice(0, 2)];
      return { stelle: a.stelle, url: a.url, land: land ? land.land : null,
               zugang: a.zugang, hinweis: a.hinweis,
               warum_kein_wert: a.warum_kein_wert, herkunft: 'ausschusstabelle' };
    }
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
    : q.zugang === 'kostenpflichtig'
      /* v1118-WAQ - hier ist es nicht "vielleicht": der zustaendige
         Ausschuss gibt die Zahl gegen Gebuehr heraus. Das gehoert
         gesagt, bevor jemand vergeblich sucht. */
      ? 'Der Ausschuss gibt diese Werte gegen Gebuehr heraus.'
      : '';
  return {
    text: `${was} für dieses Gebiet führt ${q.stelle}.`,
    kosten,
    url: q.url,
    hinweis: q.hinweis || null,
    /* v1118-WAQ - warum hier keine Zahl steht. Nur die Ausschusstabelle
       fuehrt das; bei Land und Registersatz bleibt es leer. */
    warum_kein_wert: q.warum_kein_wert || null,
  };
}
