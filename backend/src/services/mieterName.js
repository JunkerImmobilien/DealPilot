'use strict';
/* ════════════════════════════════════════════════════════════════════
   v3150 · DER NAME DES MIETERS AUS DEM MIETVERTRAG — OHNE KI

   Marcel 03.11.2026: „ja, wir können den Namen des Mieters auslesen, aber
   halt nicht an die KI schicken, damit wir kein Datenschutzproblem kriegen."

   Ablauf in routes/ai.js /extract-dokument: der ROHE Text (vor schwaerzen.js)
   geht nur durch diese Regeln, hier auf dem eigenen Server. Die KI bekommt
   wie bisher den geschwärzten Text und wird nach keinem Namen gefragt. Der
   gefundene Name reist in der Antwort als `extracted.mieter_name` zurück in
   die App und landet nach Bestätigung im Feld `mv_mieter` der Einheit.

   Regeln (deutsche Musterverträge, gemessen an den Mustern von Haus & Grund,
   Mieterbund und Verwalter-Vorlagen; Beispiele unten sind erfunden):
     A  „… und Herrn Max Beispiel … – nachstehend „Mieter" genannt –"
     B  „Mieter: Max Beispiel"  /  „Name des Mieters: …"  /  „Mieter (Name): …"
     C  „Herrn Max Beispiel (Mieter)"  /  „… als Mieter"
   Sicher ist ein Treffer nur über A oder B; C ist ein Vorschlag. Mehrere
   Mieter („Herrn Max und Frau Erika Beispiel") bleiben zusammen.

   GRENZE, ehrlich: ein Name ohne Rollenwort in der Nähe wird nicht gefunden.
   Dann bleibt das Feld leer — nie ein geratener Name.
   ════════════════════════════════════════════════════════════════════ */

const W = "[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?";
const TITEL = '(?:(?:Dr\\.|Prof\\.|Dipl\\.-[A-Za-z]+\\.?)\\s*)*';
const ANREDE = '(?:Herrn?|Frau|Eheleuten?|Familie)';
/* eine Person: [Anrede] [Titel] Vorname [Zweitname] Nachname, auch „Nachname, Vorname" */
const PERSON = '(?:' + ANREDE + '[ \\t]+)?' + TITEL + W + '(?:[ \\t]+' + W + '){0,2}';   /* nie ueber das Zeilenende */
const NAMEN = PERSON + '(?:[ \\t]*(?:,|und|u\\.|&)[ \\t]*' + PERSON + ')?';
const STOP = /^(?:Vermieter|Mieter|Mieterin|Wohnung|Mietvertrag|Vertrag|Mietsache|Objekt|Anschrift|Straße|Name|Vorname|Nachname|Haus|Der|Die|Das|Den|Dem|Und|Zwischen|Nachstehend|Im|Folgenden|Genannt|Firma|Gesellschaft)$/;

function aufraeumen(roh) {
  let n = String(roh || '').replace(/\s+/g, ' ').trim().replace(/[,;:.\-–]+$/, '').trim();
  n = n.replace(/^(?:Herrn|Herr|Frau|Eheleuten?|Familie)\s+/, '').replace(/\s+(?:und|u\.|&)\s+(?:Herrn?|Frau)\s+/, ' und ');
  const woerter = n.split(/\s+/).filter(Boolean);
  if (woerter.length < 2 || woerter.length > 8) return null;
  if (woerter.some((w) => STOP.test(w.replace(/[,]$/, '')))) return null;
  if (/\d|@|\[/.test(n)) return null;
  return n;
}

const REGELN = [
  { name: 'nachstehend_mieter', sicher: true,
    re: new RegExp('\\bund\\s+(' + NAMEN + ')(?:(?!Vermieter)[\\s\\S]){0,160}?(?:nachstehend|nachfolgend|im\\s+Folgenden|im\\s+weiteren)[^\\n]{0,20}?[„"»\']?\\s*Mieter(?:in|innen)?\\b', 'u') },
  { name: 'feld_mieter', sicher: true,
    re: new RegExp('(?:^|\\n|\\s)(?:Name\\s+des\\s+Mieters|Mieter(?:in)?\\s*\\(Name\\)|Mieter(?:in)?(?:\\s*\\d)?)\\s*:\\s*(' + NAMEN + ')', 'u') },
  { name: 'klammer_mieter', sicher: false,
    re: new RegExp('(' + NAMEN + ')\\s*(?:\\(\\s*(?:als\\s+)?Mieter(?:in)?\\s*\\)|,?\\s+als\\s+Mieter(?:in)?\\b)', 'u') },
];

/** Liest den Namen des Mieters aus dem rohen Vertragstext. → { name, sicher, regel } oder null */
function mieterAusText(text) {
  const t = String(text || '').slice(0, 20000);
  if (!t) return null;
  for (const r of REGELN) {
    const m = r.re.exec(t);
    if (!m) continue;
    const name = aufraeumen(m[1]);
    if (name) return { name, sicher: r.sicher, regel: r.name };
  }
  return null;
}

module.exports = { mieterAusText, REGELN };
