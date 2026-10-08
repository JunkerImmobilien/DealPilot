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
  'durchschnittspreis', 'preisentwicklung', 'rohertragsfaktor']);

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
const _ARGV = process.argv.slice(2);
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
    (s.belege || []).forEach((b, j) => {
      const txt = (b && typeof b === 'object') ? String(b.fundstelle || '') : String(b || '');
      if (!txt || !/\d/.test(txt)) fehler.push(`${wo}: beleg[${j}] ohne Seite/Fundstelle`);
    });
    if (s.quelle_url && !/^https?:\/\//.test(s.quelle_url)) fehler.push(`${wo}: quelle_url keine URL`);
    if (s.ags && !/^\d{5}(\d{3})?$/.test(String(s.ags))) fehler.push(`${wo}: ags ${s.ags} nicht 5- oder 8-stellig`);
    const key = [s.land_code, s.ags, s.kennzahl, s.zweig, s.berichtsjahr, s.quelle_url].join('|');
    schl.set(key, (schl.get(key) || 0) + 1);
  });
  for (const [k, n] of schl) if (n > 1) fehler.push(`Dublette (${n}×) im Upsert-Schlüssel: ${k.slice(0, 90)}`);
  const laender = [...new Set(arr.map(s => s.land_code))].join(',');
  const kz = {}; arr.forEach(s => { kz[s.kennzahl + '/' + s.zweig] = (kz[s.kennzahl + '/' + s.zweig] || 0) + 1; });
  console.log(`${f}: ${arr.length} Sätze gelesen · Länder ${laender} · Stufen ${[...new Set(arr.map(s => s.stufe))].join('')} · ${Object.entries(kz).map(([k, v]) => k + '=' + v).join(' ')}`);
  if (fehler.length) { rc = 1; console.log('  ' + fehler.slice(0, 40).join('\n  ')); if (fehler.length > 40) console.log(`  … ${fehler.length - 40} weitere`); }
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

/* v1981c · DIE DECKUNG IST TEIL DES BEFUNDES, NICHT EIN ZUSATZ */
console.log(`DECKUNG: ${_dateien.length} Datei(en) aus ${_quelle} · ${_saetzeGelesen} Sätze gelesen`);
if (!_saetzeGelesen) {
  rc = 1;
  console.log("  -> NULL Sätze geprüft. Das ist kein grünes Ergebnis, sondern ein nicht gelaufener Prüfer.");
}

process.exit(rc);
