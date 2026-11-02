'use strict';
/* ════════════════════════════════════════════════════════════════════
   v2210 · SCHWÄRZEN, BEVOR EIN DOKUMENT HINAUSGEHT

   Marcel am 14.10.2026: „Ja gerne schwärzen und wir schauen wie weit
   wir kommen." Gemessen vorher: der Dokument-Import schickte den Text
   eines Grundbuchauszugs oder Kaufvertrags ungeschwärzt an OpenAI, und
   das Schema verlangte Eigentümer mit Geburtsdatum, Käufer und Verkäufer
   mit Anschrift (dokumentSchemas.js, vor v2210).

   Was hier geschwärzt wird (regelbasiert, ohne KI):
     · Geburtsdaten („geb. 01.02.1960", „geboren am …")
     · Geburtsnamen („geb. Müller", „geborene Müller")
     · Personennamen vor „geb." im Grundbuch-Muster „Nachname, Vorname, geb."
     · Personennamen nach Anrede: Herr, Herrn, Frau, Eheleute, Notar(in)
     · Anschriften nach „wohnhaft"
     · E-Mail, Telefon/Fax, IBAN, Steuer-ID

   Was NICHT geschwärzt wird, mit Absicht:
     · die Objektanschrift, Flurstücke, Beträge, Daten ohne Geburtsbezug —
       die braucht die Auswertung.
     · Banken als Gläubiger (keine natürliche Person).

   GRENZE, ehrlich: ein Name ohne jedes dieser Signalwörter bleibt stehen
   („Hans Müller verkauft …"). Regeln finden Muster, keine Menschen. Deshalb
   fragen die Schemata seit v2210 auch nicht mehr nach Namen — was nicht
   gefragt wird, schreibt das Modell nicht heraus.
   ════════════════════════════════════════════════════════════════════ */

const W = '[A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ\\-]+';                 // ein Namenswort
/* v3089 · ein Eigentümername hinter „Wohnung": ein oder mehrere Namenswörter mit „/" verbunden,
   nie ein Lage-, Nummern- oder Gebäudewort (Wohnung Nr. 5, Wohnung im EG, Wohnung Dachgeschoss) */
const STOP_WE = '(?!(?:Familie|Fam|Herr|Herrn|Frau|Eheleute|Hr|Fr|Nr|Nummer|Erdgeschoss|Obergeschoss|Dachgeschoss|Untergeschoss|Kellergeschoss|Souterrain|Haus|Hinterhaus|Vorderhaus|Seitenflügel|Eingang|Aufgang|Treppenhaus|Links|Rechts|Mitte|Typ|Gesamt|Größe|Wohnfläche|Miete|Lage|Etage|Ebene|Nord|Süd|Ost|West|Mieter|Eigentümer|Leerstand|Sanierung|Fenster|Bad|Küche|Heizung|Dach|Fassade|Balkon|Terrasse|Garten|Stellplatz|Garage|Tiefgarage|Keller|Abrechnung|Kosten|Rücklage|Instandhaltung)\\b)';
/* kein Hauptwort mit typischer Endung („und Kostentragung“, „sowie Sanierung“) */
const NOMEN_WE = String.raw`(?![A-ZÄÖÜ][a-zäöüß]*(?:ung|ungen|heit|keit|schaft|tion|kosten|arbeiten|maßnahmen?|umlage|beschluss)\b)`;
const NAME_WE = STOP_WE + NOMEN_WE + W + '(?:\\s*/\\s*' + W + ')*';
const DATUM = '\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?\\d{2,4}';

const REGELN = [
  // Grundbuch: „Müller, Erika, geb. Schmidt, …" → „Nachname, Vorname" vor jedem „geb."
  { name: 'name_vor_geb_name',
    re: new RegExp('(' + W + ',\\s*' + W + '(?:\\s+' + W + ')?)(?=,?\\s*geb(?:\\.|orene|orener|oren)\\s+[A-ZÄÖÜ])', 'g'),
    ersatz: () => '[Name]' },
  // Grundbuch: „Müller, Hans Peter, geb. 01.02.1960" → Name und Datum
  { name: 'name_vor_geb',
    re: new RegExp('(' + W + ',\\s*' + W + '(?:\\s+' + W + ')?)(,?\\s*geb(?:oren)?\\.?\\s*(?:am\\s*)?' + DATUM + ')', 'g'),
    ersatz: () => '[Name], geb. [Datum]' },
  // Geburtsdatum allein
  { name: 'geburtsdatum',
    re: new RegExp('(geb(?:oren)?\\.?\\s*(?:am\\s*)?)' + DATUM, 'gi'),
    ersatz: () => 'geb. [Datum]' },
  // Geburtsname: „geb. Müller", „geborene Müller"
  { name: 'geburtsname',
    re: new RegExp('\\b(geb\\.|geborene|geborener)\\s+' + W, 'g'),
    ersatz: (m, p1) => p1 + ' [Name]' },
  // v3016k · Rolle + Name OHNE Anrede, wie in Exposés: „Ansprechpartner: Thomas Becker",
  // „Ihr Makler Max Mustermann". Marcel 28.10.2026: personenbezogene Daten aus dem Exposé
  // sollen nicht an die KI. Nur nach einer Rollenbezeichnung - ein Strassen- oder Firmenname
  // ohne Rolle davor bleibt stehen.
  { name: 'rolle_name',
    re: new RegExp('\\b((?:Ihr(?:e)?\\s+)?(?:Ansprechpartner(?:in)?|Kontaktperson|Kontakt|Makler(?:in)?|Berater(?:in)?|Verkäufer(?:in)?|Eigentümer(?:in)?|Vermieter(?:in)?|Mieter(?:in)?|Verwalter(?:in)?|Sachbearbeiter(?:in)?)\\s*:?\\s+)(?!\\[)' + W + '\\s+' + W + '(?:\\s+' + W + ')?(?=[\\s,.;)]|$)', 'g'),
    ersatz: (m, p1) => p1 + '[Name]' },
  // Anrede + Name (bis drei Wörter, Titel erlaubt)
  { name: 'anrede',
    re: new RegExp('\\b(Herrn?|Frau|Eheleute|Notarin|Notar)\\s+((?:Dr\\.|Prof\\.|Dipl\\.-[A-Za-z]+\\.?)\\s*)*' + W + '(?:\\s+(?:und\\s+)?' + W + '){0,3}', 'g'),
    ersatz: (m, p1) => p1 + ' [Name]' },
  // v3089 · Eigentümer in WEG-Protokollen: „der Wohnung Albers/Kowalski", „den Wohnungen
  // Petersen und Meyer". Gemessen 02.11.2026 an einem echten Protokoll: diese Namen blieben stehen,
  // weil kein Signalwort (Herr, Frau, Eheleute) davorsteht. Lage- und Nummernwörter sind ausgenommen.
  { name: 'wohnung_name',
    re: new RegExp('\\b(Wohnung(?:en)?|Whg\\.|Einheit(?:en)?|Sondereigentum)\\s+' + NAME_WE + '(?:\\s*(?:,|und|sowie)\\s*' + NAME_WE + ')*', 'g'),
    ersatz: (m, p1) => p1 + ' [Name]' },
  // v3089 · abgekürzte Anrede: „Hr. Müller", „Fr. Schmidt"
  { name: 'anrede_kurz',
    re: new RegExp('\\b(Hr\\.|Fr\\.|Hrn\\.)\\s*' + W + '(?:\\s*/\\s*' + W + ')?', 'g'),
    ersatz: (m, p1) => p1 + ' [Name]' },
  // v3089 · „Familie Lorenz" (gemessen am echten Protokoll 2025, blieb stehen)
  { name: 'familie',
    re: new RegExp('\\b(Familie|Fam\\.)\\s+' + W + '(?:\\s*/\\s*' + W + ')?', 'g'),
    ersatz: (m, p1) => p1 + ' [Name]' },
  // v3089 · Privatanschrift direkt hinter einem geschwärzten Namen: „Herr [Name], Ahornweg 12,
  // 12345 Musterstadt" (Muster gemessen an einer echten Teilungserklärung, Beispiel erfunden). Läuft NACH den Namensregeln.
  { name: 'anschrift_nach_name',
    re: /(\[Name\]),\s*[A-ZÄÖÜ][^,\n]{2,40}?\s\d+\s?[a-zA-Z]?(?:\s*-\s*\d+)?,\s*\d{5}\s+[A-ZÄÖÜ][A-Za-zäöüß.\- ]{1,40}/g,
    ersatz: (m, p1) => p1 + ', [Anschrift]' },
  // Anschrift einer Person
  { name: 'wohnhaft',
    re: /\b(wohnhaft(?:\s+in)?)\s+[^\n;]{3,80}?(?=[;\n]|,\s*(?:und|als|nachstehend|im Folgenden)|$)/gi,
    ersatz: (m, p1) => p1 + ' [Anschrift]' },
  { name: 'email',
    re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, ersatz: () => '[E-Mail]' },
  { name: 'iban',
    re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g, ersatz: () => '[IBAN]' },
  { name: 'telefon',
    re: /\b(Tel(?:efon)?|Fax|Mobil|Handy)\.?\s*:?\s*[+\d][\d\s/()-]{5,}\d/gi,
    ersatz: (m, p1) => p1 + ' [Nummer]' },
  { name: 'steuer_id',
    re: /\b(Steuer-?ID|Steuer-Identifikationsnummer|IdNr\.?)\s*:?\s*\d[\d\s]{9,13}\d/gi,
    ersatz: (m, p1) => p1 + ' [Nummer]' },
];

/** Schwärzt einen Text. Liefert { text, treffer: {regel: anzahl}, gesamt }. */
function schwaerze(text) {
  if (typeof text !== 'string' || !text) return { text: text, treffer: {}, gesamt: 0 };
  let t = text;
  const treffer = {};
  let gesamt = 0;
  for (const r of REGELN) {
    t = t.replace(r.re, function () {
      treffer[r.name] = (treffer[r.name] || 0) + 1;
      gesamt++;
      return r.ersatz.apply(null, arguments);
    });
  }
  return { text: t, treffer, gesamt };
}

module.exports = { schwaerze, REGELN };
