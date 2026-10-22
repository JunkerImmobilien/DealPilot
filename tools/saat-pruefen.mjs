#!/usr/bin/env node
/* saat-pruefen.mjs · v1880 — Pflichtfelder einer Register-Saatdatei prüfen, BEVOR register-saat.mjs läuft.
 *
 * Doktrin (CLAUDE.md): jede Zahl trägt Herkunft — Quelle-URL, Berichtsjahr, Stichtag, Seite, Lizenz, Stufe.
 * Dieses Skript schreibt nichts; es nennt je Satz, was fehlt, und seine Deckung (wie viele Sätze es las).
 *
 * Aufruf:  node tools/saat-pruefen.mjs marktbericht/backend/src/lib/register/<datei>.json [...]
 * Rückgabe 1, wenn ein Satz eine Pflichtangabe nicht trägt. */
import fs from 'fs';

const PFLICHT = ['land_code', 'ags', 'ebene', 'gebiet_name', 'gaa_name', 'kennzahl', 'zweig', 'formel', 'belege', 'stufe', 'berichtsjahr', 'quelle_url', 'lizenz'];
/* ══ v1975 · `vergleichsfaktor` FEHLTE IN DER ERLAUBTEN LISTE ══════════

   Seit v1971 fuehrt das Vergleichswertverfahren nur noch mit
   kaufpreisbasierter Grundlage, und die Ernte holt deshalb die amtlichen
   Vergleichsfaktoren nach (Backlog N50). Dieser Pruefer haette jeden
   solchen Satz mit „unbekannte kennzahl vergleichsfaktor" abgewiesen —
   ein Waechter, der die neue Ernte aufhaelt, statt sie zu pruefen.

   > Gemessen am 08.10.2026: 0 Saetze mit dieser Kennzahl im Register. Die
   > Liste war also nicht falsch, sondern unvollstaendig fuer das, was
   > kommt. */
const KENNZAHLEN = new Set(['liegenschaftszinssatz', 'sachwertfaktor', 'vergleichsfaktor',
  'erbbaurechtskoeffizient', 'erbbauzinssatz', 'bodenpreisindex', 'bodenpreisniveau',
  'durchschnittspreis', 'preisentwicklung', 'rohertragsfaktor',
  /* v2279: Umrechnungskoeffizient Grundstuecksgroesse (§ 19 ImmoWertV) */
  'umrechnungskoeffizient_flaeche', 'umrechnungskoeffizient_wgfz',   /* v2361 */
  /* v2620: Umrechnungskoeffizienten zum Immobilienrichtwert (§ 20, §§ 24–26 ImmoWertV),
     uk-irw-*.json, gelesen von lib/vergleichswert_irw.js, geprueft von tools/irw-pruefen.mjs */
  'umrechnung_irw']);

/* ══ v1975 · DIE EINHEIT IST DIE VERWECHSLUNGSPROBE ════════════════════

   `swf-bb.json` fuehrt sie als Abnahmetext und sie gehoert in den
   Pruefer, nicht nur in die Prosa:

     Sachwertfaktor              dimensionslos, Groessenordnung 1,0
     Vergleichsfaktor            Euro je Quadratmeter (dreistellig bis
                                 vierstellig) oder ein Vielfaches des
                                 Rohertrags (einstellig bis zweistellig)
     Erbbaurechtskoeffizient     Prozent

   Ein Vergleichsfaktor von 1,05 ist also mit Sicherheit ein
   Sachwertfaktor, der in der falschen Spalte gelandet ist — und
   umgekehrt. Die Spanne ist bewusst weit: sie soll die VERWECHSLUNG
   fangen, nicht den Ausreisser bewerten. */
const SPANNEN = {
  sachwertfaktor: [0.3, 3.0, 'dimensionslos, Groessenordnung 1,0'],
  erbbaurechtskoeffizient: [0, 100, 'Prozent'],
  erbbauzinssatz: [0, 12, 'Prozent'],
};
let rc = 0;
/* ══ v1981c · OHNE ARGUMENT PRUEFTE ER NULL SAETZE UND WAR GRUEN ══════

   GEMESSEN am 08.10.2026, an mir selbst: ich rief
   `node tools/saat-pruefen.mjs` ohne Datei, bekam EINE Zeile
   („Handliste SAATDATEIEN: 56 Dateien") und RC=0 — und habe das als
   „der neue Berliner Satz ist in Ordnung" gelesen. Geprueft hatte er
   davon: nichts. Die Schleife lief ueber eine leere Liste.

   Der Kommentar bei der Handliste nannte das ausdruecklich Absicht
   („`node tools/saat-pruefen.mjs` allein prueft nur die Handliste").
   Absicht oder nicht — ein Pruefer, der auf den bequemsten Aufruf
   gruen wird, ohne etwas gemessen zu haben, ist derselbe Fehler wie
   der gold-audit, der 6 statt 181 Dateien las.

   Ohne Argument nimmt er jetzt den GANZEN Registerordner, und er nennt
   in jedem Fall seine DECKUNG — Dateien und Saetze. Eine Null dort ist
   ab sofort RC=1, nicht gruen. */
/* ══ v2176 · DER PFLICHTFELD-VERTRAG UND SEINE BASISLINIE ═══════════════
   Marcel am 13.10.2026: „Ich moechte sicherstellen, dass wir immer die
   notwendigen Felder ausfuellen und auch mit Quellen."
   GEMESSEN: dieser Pruefer stand auf RC=1 (49 Altbefunde), lief nur von
   Hand und prueft Stichtag, Gesamtnutzungsdauer und Baupreisindex nicht -
   81 LZS-Werte ohne Stichtag, kein einziger Satz mit Index als Zahl.
   Ein Rot, das immer rot ist, liest niemand (Lehre gold-audit, v1259).
   Deshalb wie dort: --basislinie vergleicht je Datei und Regel gegen
   tools/saat-basislinie.json. Mehr als dort = rot, eine neue Datei mit
   Befund = rot, weniger = gruen mit Hinweis zum Senken
   (--basislinie-schreiben). Der Deckel darf sinken, nie steigen.
   deploy-staging.ps1 ruft --basislinie bei jedem Ausrollen. */
const _ALLE_ARGV = process.argv.slice(2);
const _BASIS = _ALLE_ARGV.includes('--basislinie') || _ALLE_ARGV.includes('--basislinie-schreiben');
const _BASIS_SCHREIBEN = _ALLE_ARGV.includes('--basislinie-schreiben');
const _BASIS_DATEI = 'tools/saat-basislinie.json';
const _zaehler = {};   /* datei -> regel -> anzahl */
const _ARGV = _ALLE_ARGV.filter((a) => !a.startsWith('--'));
let _dateien = _ARGV;
let _quelle = "Argumente";
if (!_ARGV.length) {
  const _ordner = "marktbericht/backend/src/lib/register";
  _dateien = fs.readdirSync(_ordner)
    .filter((f) => f.endsWith(".json") && !/^verfuegbarkeit-/.test(f))
    .sort()
    .map((f) => _ordner + "/" + f);
  _quelle = "ganzer Registerordner";
}
let _saetzeGelesen = 0;
for (const f of _dateien) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`${f}: KEIN JSON — ${e.message}`); rc = 1; continue; }
  if (!Array.isArray(arr)) { console.log(`${f}: kein Array`); rc = 1; continue; }
  _saetzeGelesen += arr.length;
  const fehler = []; const schl = new Map();
  arr.forEach((s, i) => {
    const wo = `#${i} ${s.gebiet_name || s.ags || '?'} ${s.kennzahl || ''}/${s.zweig || ''}`;
    const sperre = s.vollstaendig === false || !!s.warum_kein_wert;   /* Sperreintrag: Weg ohne Zahl, erlaubt */
    /* ══ v1975c · EINE SPERRE BRAUCHT KEINE LIZENZ ═══════════════════════

       Eine Sperre fuehrt KEINEN Wert — sie nennt den Weg zur Quelle. Eine
       Namensnennung kann es deshalb nicht verlangen: es wird nichts
       verwendet, was zugeschrieben werden muesste.

       Gemessen an der Saarland-Ernte vom 08.10.2026: vier Sperren fuer die
       Landeshauptstadt Saarbruecken tragen , weil der
       Immobilienmarktbericht 2026 ueber den ganzen Text NULL Treffer auf
       Urheberrecht, Vervielfaeltigung, Nachdruck oder Lizenz hat. Das ist
       keine fehlende Angabe, sondern eine nicht existente — und
       erfunden werden darf sie nicht.

       Die Zeile nahm Sperren schon bei  und  aus; die
       Lizenz gehoert in dieselbe Ausnahme. CLAUDE.md fuehrt die Regel
       umgekehrt fuer WERTE: ohne Lizenz ist nicht entscheidbar, ob ein
       Vermerk noetig waere — dort bleibt sie Pflicht. */
    const SPERRE_OPTIONAL = ['formel', 'belege', 'lizenz'];
    for (const k of PFLICHT) {
      if (sperre && SPERRE_OPTIONAL.indexOf(k) >= 0) continue;
      if (s[k] == null || s[k] === '' || (Array.isArray(s[k]) && !s[k].length)) fehler.push(`${wo}: ${k} fehlt`);
    }
    if (s.kennzahl && !KENNZAHLEN.has(s.kennzahl)) fehler.push(`${wo}: unbekannte kennzahl ${s.kennzahl}`);
    /* v2396 · EINE SPERRE TRAEGT KEINE RECHENBARE formel (CLAUDE.md).
       Gemessen am 19.10.2026: 135 Sperren (99 LZS, 35 SWF, 1 BPI) trugen
       noch eine, register-saat spielte sie als WERT ein, und die Tabelle
       ueberstimmte die Sperre — Muenchen Sachwertfaktor 1,15 / 1,38. Eine
       vorgemerkte Tabelle steht unter formel_vorgemerkt. Die Basislinie
       fuehrt diese Regel nicht: jeder Treffer ist rot. */
    if (sperre && s.formel) fehler.push(`${wo}: Sperre traegt formel — gehoert nach formel_vorgemerkt`);
    /* v2287 · mb.param_modell.modellversion ist NOT NULL - ein Wert ohne sie wird beim
       Einspielen (register-saat.mjs) still verworfen. Gemessen 16.10.2026: alle 111
       Umrechnungskoeffizienten mit Wert fehlten in der Tabelle, der Pruefer war gruen. */
    for (const _k of ['modellversion', 'quelle_parser', 'modellansaetze']) {   /* v2287: NOT NULL in mb.param_modell */
      if (!sperre && s.formel && s[_k] == null) fehler.push(`${wo}: ${_k} fehlt (Datenbank verlangt es)`);
    }
    if (s.stufe && !/^[A-E]$/.test(s.stufe)) fehler.push(`${wo}: stufe ${s.stufe}`);
    if (!sperre && s.formel && s.formel.form === 'konstante' && !(typeof s.formel.wert === 'number' && isFinite(s.formel.wert))) fehler.push(`${wo}: formel.wert keine Zahl`);
    if (s.formel && s.kennzahl === 'liegenschaftszinssatz' && typeof s.formel.wert === 'number' && (s.formel.wert < -2 || s.formel.wert > 12)) fehler.push(`${wo}: Zins ${s.formel.wert} außerhalb -2–12 %`);   /* Frankfurt druckt negative Saetze (EFH zentral -0,1) */
    /* v1975: die Verwechslungsprobe je Kennzahl. */
    if (!sperre && s.formel && typeof s.formel.wert === 'number' && SPANNEN[s.kennzahl]) {
      const [u, o, was] = SPANNEN[s.kennzahl];
      if (s.formel.wert < u || s.formel.wert > o) {
        fehler.push(`${wo}: ${s.kennzahl} ${s.formel.wert} liegt ausserhalb ${u}–${o} (${was}) — Kennzahl verwechselt?`);
      }
    }
    /* Ein Vergleichsfaktor traegt seine EINHEIT mit, sonst ist er nicht
       anwendbar: Euro/m2 und ein Vielfaches des Rohertrags sind zwei
       verschiedene Groessen, und 12 kann beides sein. */
    /* v1975b: Einheit und Normobjekt stehen im Register INNERHALB von
       `formel` — `formel.liefert_einheit` und `formel.normobjekt` sind
       die gewachsenen Namen (gemessen: laender3.json fuehrt
       `liefert_einheit`, fuenf Dateien fuehren `formel.normobjekt`).
       Meine erste Fassung suchte `formel.einheit` und
       `modellansaetze.normobjekt` und fand deshalb nichts, obwohl beides
       da war. */
    if (s.kennzahl === 'vergleichsfaktor' && !sperre) {
      const f = s.formel || {}, ma = s.modellansaetze || {};
      const eh = f.liefert_einheit || f.einheit || ma.einheit || ma.liefert_einheit;
      if (!eh) fehler.push(`${wo}: vergleichsfaktor ohne Einheit (erwartet Euro/m² oder Rohertragsfaktor)`);
      else if (!/eur|euro|m²|m2|qm|quadratmeter|rohertrag/i.test(String(eh))) fehler.push(`${wo}: Einheit '${eh}' unbekannt`);
      const normo = f.normobjekt || ma.normobjekt || ma.normgroesse_qm || ma.bezugsmaßstab || ma.bezugsmassstab;
      if (!normo) fehler.push(`${wo}: vergleichsfaktor ohne NORMOBJEKT — § 10 ImmoWertV: nur mit seinem Modell anwendbar`);
    }
    /* ══ v1975b · DIESE PRUEFUNG WAR SEIT IMMER FALSCH ════════════════

       Hier stand:

         if (!b.fundstelle || !/\d/.test(String(b.fundstelle)))

       Das setzt voraus, dass jeder Beleg ein OBJEKT mit `.fundstelle`
       ist. Das Register fuehrt aber ZWEI Formen, und beide sind
       gewachsen und akzeptiert — gemessen am 08.10.2026 ueber alle 58
       Dateien:

         41 Dateien  belege als OBJEKT   { fundstelle, … }
         12 Dateien  belege als STRING   "… Kap. 8.2.3.1, S. 83 bis 85 …"

       Bei der String-Form steht die Seite IM TEXT. Die Pruefung las
       `b.fundstelle` von einer Zeichenkette, bekam `undefined` und
       meldete „ohne Seite/Fundstelle" — fuer JEDEN Satz dieser zwoelf
       Dateien, darunter die laengst abgenommenen `swf-bb.json` und
       `swf-be.json`.

       > Ein Waechter, der auf RICHTIGE Daten rot wird, ist so schaedlich
       > wie einer, der auf falsche gruen wird: man lernt, ihn zu
       > ignorieren. Gefunden, als die Brandenburg-Ernte acht Befunde
       > bekam, von denen sechs keine waren.

       Geprueft wird jetzt, was gemeint war: steht in dem Beleg
       irgendwo eine ZAHL, also eine Seite, eine Abbildung, ein
       Kapitel? */
    /* ══ v1983a · EINE TABELLENQUELLE HAT KEINE SEITENZAHL ════════════

       Bis hierher musste im Beleg eine ZAHL stehen. Das trifft fuer ein
       PDF ("Kap. 8.2.3.1, S. 83") und verfehlt jede CSV-Ausleitung:
       die 1.019 NRW-Offendatensaetze fuehren "Grundstuecksmarktdaten
       NRW, baulandpreise.csv" - eine vollstaendige Fundstelle ohne eine
       einzige Ziffer. 129 Scheinbefunde, null echte.

       Zweites Mal an derselben Zeile (v1975: Belege als String statt
       Objekt, sechs von acht Befunden waren keine). Die Lehre von damals
       steht oben und war schon eingetreten: ich habe die 129 Zeilen beim
       Lesen uebersprungen, weil mein Suchmuster sie nicht kannte.

       Jetzt gilt als Fundstelle: eine Zahl ODER ein benannter
       Dateiname. Was gar nichts fuehrt, bleibt rot.

       Gelesen werden ZWEI Felder: `fundstelle` und `feldbeschreibung`.
       Beide sind Ortsangaben - marktdaten-nrw.json fuehrt die Datei in
       `feldbeschreibung` ("allgemein_erlaeuterung.xlsx"), nicht in
       `fundstelle`. `wortlaut` bleibt bewusst DRAUSSEN: das ist Prosa,
       und eine Zahl in einem Satz ist keine Seitenangabe. Nimmt man ihn
       mit, besteht fast jeder Beleg die Pruefung - dann ist der Waechter
       zwar nie rot, prueft aber auch nichts mehr. */
    /* v2176 · Vertrag fuer WERTE (Sperren nennen nur den Weg):
       Stichtag immer; beim Sachwertfaktor die Gesamtnutzungsdauer und der
       Baupreisindex als ZAHL - sonst rechnet der Kern mit 80 Jahren und
       der Konstanten 1,91, und nichts widerspricht (CLAUDE.md B1). */
    if (!sperre) {
      if (!s.stichtag) fehler.push(`${wo}: stichtag fehlt`);
      if (s.kennzahl === 'sachwertfaktor') {
        const ma = s.modellansaetze || {};
        const gnd = ma.gnd_jahre ?? ma.gesamtnutzungsdauer_jahre ?? ma.gnd;
        if (!(typeof gnd === 'number' && isFinite(gnd))) fehler.push(`${wo}: modellansaetze.gnd_jahre fehlt als Zahl`);
        const bpi = ma.baupreisindex ?? ma.baupreisindex_stichtag ?? ma.baupreisindex_wert;
        /* v2720 · Entscheidung Marcel 22.10.2026: ein Modell, das den Index nicht als
           Zahl, aber mit eindeutigem BEZUG nennt („Baupreisindex zum Beurkundungs-/
           Kaufzeitpunkt"), ist vollstaendig bestimmt - abgeleitet mit dem Index zum
           Kaufzeitpunkt, angewandt mit dem Index zum Wertermittlungsstichtag (§ 36
           Abs. 2 ImmoWertV, ImmoWertA 36). Pflicht: bezug 'kaufzeitpunkt' UND der
           woertliche Satz des Dokuments UND seine Seite. Ein Index ohne Bezug
           („Baupreisindex des Statistischen Bundesamtes") bleibt eine Luecke. */
        const bpiBezug = ma.baupreisindex_bezug === 'kaufzeitpunkt'
          && typeof ma.baupreisindex_wortlaut === 'string' && ma.baupreisindex_wortlaut.trim().length >= 10
          && /\d/.test(String(ma.baupreisindex_seite ?? ''));
        if (!(typeof bpi === 'number' && isFinite(bpi)) && !bpiBezug) {
          fehler.push(`${wo}: modellansaetze.baupreisindex fehlt als Zahl`);
        }
      }
    }
    /* v2620 · Vertrag der Kennzahl umrechnung_irw (Marcel 21.10.2026, E7): ein Wert
       wird ueber Ausschuss (gasl) × Teilmarkt × Jahrgang gefunden; ohne diese drei
       findet ihn die Rechnung nicht. Stellplaetze: das Modell muss sagen, ob sie im
       Richtwert stecken (sonst doppelt oder gar nicht gezaehlt). Seite und Normobjekt
       sind Herkunft. Die Rechenpruefung selbst macht tools/irw-pruefen.mjs. */
    if (!sperre && s.kennzahl === 'umrechnung_irw') {
      const f = s.formel || {};
      if (!/^\d{5}$/.test(String(s.gasl || ''))) fehler.push(`${wo}: gasl fehlt (Gutachterausschusskennziffer, 5-stellig)`);
      if (!s.jahrgang) fehler.push(`${wo}: jahrgang fehlt`);
      if (!s.seite) fehler.push(`${wo}: seite fehlt`);
      if (!(s.geltungsbereich && s.geltungsbereich.teilmarkt)) fehler.push(`${wo}: geltungsbereich.teilmarkt fehlt`);
      if (typeof f.stellplaetze_im_irw !== 'boolean') fehler.push(`${wo}: formel.stellplaetze_im_irw nicht true/false`);
      if (!f.normobjekt) fehler.push(`${wo}: formel.normobjekt fehlt`);
      if (!Array.isArray(f.merkmale) || !f.merkmale.length) fehler.push(`${wo}: formel.merkmale leer`);
    }
    const _FUNDSTELLE_DATEI = /\.(csv|xlsx?|json|txt|zip|gpkg|shp)\b/i;
    (s.belege || []).forEach((b, j) => {
      const txt = (b && typeof b === 'object')
        ? [b.fundstelle, b.feldbeschreibung].filter(Boolean).join(' ')
        : String(b || '');
      const taugt = txt && (/\d/.test(txt) || _FUNDSTELLE_DATEI.test(txt));
      if (!taugt) fehler.push(`${wo}: beleg[${j}] ohne Seite, Kapitel oder Datei`);
    });
    if (s.quelle_url && !/^https?:\/\//.test(s.quelle_url)) fehler.push(`${wo}: quelle_url keine URL`);
    /* ══ v1983b · DER LANDESSCHLUESSEL IST ZWEISTELLIG ════════════════

       Bis hierher waren nur 5 oder 8 Stellen erlaubt. Gemessen ueber
       alle 56 Registerdateien kommen DREI Laengen amtlich vor:

         2 Stellen   17x  ebene land   (12 = Brandenburg, 15 = ST)
         5 Stellen 2655x  Kreise, dazu kreisfreie Staedte
         8 Stellen 2160x  Gemeinden, Stadtstaaten, GAA-Bezirke

       Die 14 Brandenburger Zinssaetze wurden also rot - mit dem
       RICHTIGEN Landesschluessel. Aufgefallen erst, als die 17 fehlenden
       Lizenzen behoben waren: die Fehlerliste je Datei ist bei 40
       gekappt, und darunter lag diese Schicht verborgen. Ein Waechter,
       der seine Befunde kappt, versteckt die naechste Schicht.

       An `ebene` gebunden wird die Regel ausdruecklich NICHT: dort
       verschwimmen die Stufen amtlich. Hamburg fuehrt auf ebene `land`
       die 02000000 (Stadtstaat), Braunschweig und Schwerin auf ebene
       `gemeinde` einen fuenfstelligen Schluessel (kreisfrei), Halle auf
       ebene `kreis` einen achtstelligen. Eine strenge Zuordnung von
       Ebene zu Laenge haette 18 neue Scheinbefunde erzeugt -
       nachgemessen, nicht vermutet. */
    if (s.ags && !/^(\d{2}|\d{5}|\d{8})$/.test(String(s.ags))) {
      fehler.push(`${wo}: ags ${s.ags} ist nicht 2-, 5- oder 8-stellig`);
    }
    const key = [s.land_code, s.ags, s.kennzahl, s.zweig, s.berichtsjahr, s.quelle_url].join('|');
    schl.set(key, (schl.get(key) || 0) + 1);
  });
  for (const [k, n] of schl) if (n > 1) fehler.push(`Dublette (${n}×) im Upsert-Schlüssel: ${k.slice(0, 90)}`);
  const laender = [...new Set(arr.map(s => s.land_code))].join(',');
  const kz = {}; arr.forEach(s => { kz[s.kennzahl + '/' + s.zweig] = (kz[s.kennzahl + '/' + s.zweig] || 0) + 1; });
  console.log(`${f}: ${arr.length} Sätze gelesen · Länder ${laender} · Stufen ${[...new Set(arr.map(s => s.stufe))].join('')} · ${Object.entries(kz).map(([k, v]) => k + '=' + v).join(' ')}`);
  const _datei = String(f).replace(/^.*[\\/]/, '');
  _zaehler[_datei] = {};
  for (const m of fehler) {
    const regel = m.replace(/^.*?: /, '').replace(/\d+([.,]\d+)?/g, '#').replace(/'[^']*'/g, "'…'").slice(0, 80);
    _zaehler[_datei][regel] = (_zaehler[_datei][regel] || 0) + 1;
  }
  if (_BASIS) { /* Ausgabe folgt gesammelt unten */ }
  else if (fehler.length) { rc = 1; console.log('  ' + fehler.slice(0, 40).join('\n  ')); if (fehler.length > 40) console.log(`  … ${fehler.length - 40} weitere`); }
  else console.log('  alle Pflichtfelder vorhanden, keine Dublette');
}
/* ══ v1975 · DER WAECHTER STAND DA UND WAR NICHT AUFGESTELLT ═══════════

   `ausschuss_register.js` hat seit v1778 eine Funktion
   `fehlendeSaatdateien()`. Der Kommentar daneben sagt: „Der Abgleich
   unten sorgt dafuer, dass die Luecke beim naechsten Mal AUFFAELLT,
   statt still zu bleiben."

   GEMESSEN am 08.10.2026: sie wird NIRGENDS gerufen. Zwei Treffer im
   ganzen Repo, beide in Kommentaren. Der Waechter war gebaut und nie
   aufgestellt.

   Was er verhindern soll, ist einmal passiert und stand teuer im
   Register: zehn Erntedateien mit 89 Saetzen lagen im Ordner, fehlten
   in der Handliste, erreichten die Datenbank — und keinen einzigen
   Bericht.

     > Eine Ernte, die das Repo nicht verlaesst, ist keine Ernte. Eine,
     > die die Datenbank erreicht und den Rechenweg nicht, ist auch
     > keine.

   Jetzt laeuft der Abgleich bei JEDEM Saat-Pruefen mit, auch ohne
   Dateiargument — `node tools/saat-pruefen.mjs` allein prueft nur die
   Handliste. Heute: 53 Dateien in SAATDATEIEN, 0 fehlen.

   > Er ist bewusst RC=1, nicht nur ein Hinweis. Eine Warnung, die man
   > ueberliest, ist derselbe stille Rueckfall in anderer Form. */
try {
  const reg = await import('../marktbericht/backend/src/lib/ausschuss_register.js');
  const fehlt = reg.fehlendeSaatdateien();
  const inListe = reg.SAATDATEIEN.length;
  console.log(`Handliste SAATDATEIEN: ${inListe} Dateien · ${fehlt.length} im Ordner, aber nicht in der Liste`);
  if (fehlt.length) {
    rc = 1;
    for (const x of fehlt) console.log(`  FEHLT: ${x.datei} (${x.saetze} Sätze) — erreicht KEINEN Bericht`);
    console.log('  -> in SAATDATEIEN in marktbericht/backend/src/lib/ausschuss_register.js eintragen');
  }
} catch (e) {
  rc = 1;
  console.log(`Handliste NICHT geprüft: ${e.message}`);
  console.log('  -> dieser Abgleich darf nicht ausfallen; ohne ihn rutscht eine Ernte durch');
}

if (_BASIS) {
  if (_BASIS_SCHREIBEN) {
    fs.writeFileSync(_BASIS_DATEI, JSON.stringify({ stand: new Date().toISOString().slice(0, 10), saetze: _saetzeGelesen, dateien: _dateien.length, befunde: _zaehler }, null, 1) + '\n');
    const n = Object.values(_zaehler).reduce((a, r) => a + Object.values(r).reduce((x, y) => x + y, 0), 0);
    console.log(`BASISLINIE geschrieben: ${n} Befunde in ${Object.keys(_zaehler).filter((d) => Object.keys(_zaehler[d]).length).length} Dateien`);
  } else {
    let basis = null;
    try { basis = JSON.parse(fs.readFileSync(_BASIS_DATEI, 'utf8')); } catch (e) { console.log('KEINE BASISLINIE (' + _BASIS_DATEI + ') — erst mit --basislinie-schreiben anlegen'); rc = 1; }
    if (basis) {
      let mehr = 0, weniger = 0;
      for (const [d, regeln] of Object.entries(_zaehler)) {
        for (const [r, n] of Object.entries(regeln)) {
          const alt = (basis.befunde[d] && basis.befunde[d][r]) || 0;
          if (n > alt) { mehr++; rc = 1; console.log(`  NEU  ${d}: ${r} — ${n} statt ${alt}`); }
          else if (n < alt) weniger++;
        }
      }
      /* die Saetze eines Basislinien-Laufs ohne Befunde zaehlen nicht als
         Fehler - aber eine GESCHRUMPFTE Deckung schon: wer Dateien nicht
         mehr liest, wird sonst gruen (Lehre gold-audit 6 statt 181) */
      if (basis.saetze && _saetzeGelesen < basis.saetze * 0.9) { rc = 1; console.log(`  DECKUNG GESUNKEN: ${_saetzeGelesen} Saetze statt ${basis.saetze}`); }
      console.log(`BASISLINIE ${basis.stand}: ${mehr ? mehr + ' Regel(n) ueber dem Deckel — ROT' : 'nichts ueber dem Deckel'}`
        + (weniger ? ` · ${weniger} Regel(n) darunter — Deckel senken: node tools/saat-pruefen.mjs --basislinie-schreiben` : ''));
    }
  }
}
/* v1981c · DIE DECKUNG IST TEIL DES BEFUNDES, NICHT EIN ZUSATZ */
console.log(`DECKUNG: ${_dateien.length} Datei(en) aus ${_quelle} · ${_saetzeGelesen} Sätze gelesen`);
if (!_saetzeGelesen) {
  rc = 1;
  console.log("  -> NULL Sätze geprüft. Das ist kein grünes Ergebnis, sondern ein nicht gelaufener Prüfer.");
}

process.exit(rc);
