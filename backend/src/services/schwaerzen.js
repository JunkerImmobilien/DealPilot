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
  // Anrede + Name (bis drei Wörter, Titel erlaubt)
  { name: 'anrede',
    re: new RegExp('\\b(Herrn?|Frau|Eheleute|Notarin|Notar)\\s+((?:Dr\\.|Prof\\.|Dipl\\.-[A-Za-z]+\\.?)\\s*)*' + W + '(?:\\s+(?:und\\s+)?' + W + '){0,3}', 'g'),
    ersatz: (m, p1) => p1 + ' [Name]' },
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
