// pruefstrecke-swf.mjs   (v1886-WPRF)
//
// DER PRUEFSTAND FUER DAS SACHWERTFAKTOR-REGISTER.
//
// Jeder Registerdatensatz wird durch DENSELBEN Auswerter geschickt, den auch
// der Server benutzt. Kein zweiter Rechenweg, keine nachgebaute Formel — eine
// Dublette laeuft frueher oder spaeter auseinander.
//
// FUENF PRUEFUNGEN JE DATENSATZ:
//   1. Anwendungsbeispiel  — der Sollwert kommt aus dem Dokument, nie aus dem
//                            Kopf. Einschliesslich der Rundung.
//   2. Zaehlpruefung       — Zeilen und Spalten gegen die erwartete Zahl.
//                            Die dumme Pruefung faengt, was die kluge uebersieht:
//                            am 11.08. gingen Monotonie, Wertebereich UND
//                            Anwendungsbeispiel durch, waehrend zwei Zeilen
//                            fehlten.
//   3. Monotonie           — ueber die GANZE Tabelle, nicht als Stichprobe.
//                            Faengt vertauschte Bloecke und Zahlendreher.
//   4. Extrapolationssperre— ein Punkt ausserhalb der Achse MUSS
//                            verfuegbar:false liefern.
//   5. Einheit             — was der Datensatz als `liefert` ausweist, muss
//                            hinten als Faktor ankommen.
//
// Faellt eine durch, ist der Rueckgabewert 1 und nichts wird ausgeliefert.
//
// AUFRUF:
//  node tools/pruefstrecke-swf.mjs src/lib/register/swf-nrw.json
//  (aus marktbericht/backend/ heraus — und im Container aus /app/)
//
// ═══ v1886-WPRF · DREI DINGE, DIE DIESER PRUEFER NICHT SAH ══════════════
//
// 1 · ER LAS NUR `belege[0]`.
//     GEMESSEN am 05.10.2026 ueber alle 55 Registerdateien: 181
//     Anwendungsbeispiele, davon FUENF an zweiter oder spaeterer Stelle —
//     vier beim Kreis Coesfeld (05558/ezfh, Berechnungsbeispiele 1, 2, 3
//     und 5 des Berichts) und eines bei Ludwigslust-Parchim (13076/rhdhh).
//     Sie wurden stillschweigend uebersprungen, und der Lauf meldete
//     trotzdem "0 Fehler".
//
//       > "0 Fehler" ohne Deckung ist keine Aussage. Es kann heissen
//       > "alles richtig" und "nichts geprueft", und man sieht nicht,
//       > welches von beidem.
//
//     Jetzt wird JEDER Beleg der Art `anwendungsbeispiel` gerechnet, und
//     der Lauf nennt am Ende seine DECKUNG: gepruefte Beispiele, Saetze mit
//     Beispiel, Saetze insgesamt.
//
// 2 · ER STARB AN EINEM SATZ OHNE FORMEL.
//     `lzs-st-th-sh-ni-2025.json` enthaelt Saetze mit `formel: null` —
//     Sperrvermerke, die dokumentieren, was ein Ausschuss NICHT fuehrt.
//     `s.formel.zellen` warf dort einen TypeError und riss den ganzen Lauf
//     mit. Ein Pruefer, der an einem Datenfeld stirbt, prueft nichts.
//
// 3 · ER GAB DEM AUSWERTER WENIGER ALS DER SERVER.
//     `gutachterausschuss.js` reicht seit v1886 auch `modellansaetze`
//     durch — dort liegen Hamburgs Stadtteil- und Aktualisierungstabellen.
//     Ohne sie prueft dieser Lauf ein anderes Modell als das ausgelieferte.
//
// ACHTUNG, DUBLETTE: diese Datei liegt zweimal im Repo —
// `tools/swf-register/pruefstrecke-swf.mjs` und
// `marktbericht/backend/tools/pruefstrecke-swf.mjs`. Sie waren bis v1886
// auseinandergelaufen (v1084 gegen v1085); jetzt sind sie wieder gleich.
// Wer eine aendert, aendert beide — oder raeumt die eine weg.

import { readFileSync } from 'node:fs';
import { auswerten } from '../src/lib/swf_modelle.js';

const DATEI = process.argv[2] || 'out/swf-nrw.json';
const saetze = JSON.parse(readFileSync(DATEI, 'utf8'));
if (!Array.isArray(saetze)) {
  /* Im Registerordner liegen auch Dateien, die KEINE Satzliste sind
     (`verfuegbarkeit-*.json`). Daran starb dieser Lauf mit einem
     Stacktrace — und ein Stacktrace ist die schlechteste Art zu sagen
     "falsche Datei". */
  console.error(`Diese Datei ist keine Satzliste (${typeof saetze}): ${DATEI}`);
  process.exit(2);
}

let ok = 0, fehler = 0, uebersprungen = 0, informativ = 0;
/* Die Deckung. Ohne sie ist "0 Fehler" keine Aussage. */
let saetzeGesehen = 0, saetzeMitBeispiel = 0;
let beispieleGesehen = 0, beispielePruefbar = 0;
const nichtZaehlbar = [];
const beschreibendeEckwerte = [];
const einheitFalsch = [];
const statistikBelege = [];
const unbeachtet = [];
const sollOhneEingabe = [];
const meldungen = [];

/** Belegarten, die keine Rechnung tragen und keine tragen sollen: sie
 *  dokumentieren Wortlaut und Herkunft. Sie werden gezaehlt, nicht
 *  angemahnt — aber auch nicht als Pruefung verbucht. */
const INFORMATIV = new Set(['formel', 'kontext', 'amtliche Veroeffentlichung',
  'amtliche Veroeffentlichung ohne Wert', 'hinweis', 'sperre', 'quelle',
  'tabelle', 'auszug']);

function fehl(s, text) {
  fehler++;
  meldungen.push(`  FEHLER  ${s.ags} ${s.zweig} `
    + `(${(s.formel || {}).form || 'ohne Formel'}) — ${text}`);
}
function gut(s, text) {
  ok++;
  meldungen.push(`  ok      ${s.ags} ${s.zweig} — ${text}`);
}

/** Der Auswerter erwartet Formel, Korrekturen UND Kennzahl in EINEM Objekt.
 *
 * Die Kennzahl fehlte hier zuerst — und der Berliner Liegenschaftszinssatz
 * fiel prompt durch das Plausibilitaetsband der Sachwertfaktoren. Derselbe
 * Fehler wie bei der Feldbruecke: der Test muss den Vertrag sprechen, den
 * auch gutachterausschuss.js spricht, sonst prueft er etwas anderes als das,
 * was laeuft.
 *
 * v1886-WPRF: deshalb reisen jetzt auch die `modellansaetze` mit. Hamburgs
 * Formelwerk holt Stadtteil- und Aktualisierungsfaktor von dort. */
function modellAus(s) {
  return { ...(s.formel || {}), kennzahl: s.kennzahl,
           modellansaetze: s.modellansaetze || null,
           korrekturen: s.korrekturen || [] };
}

/** Vergleich auf der Stellenzahl des Dokuments, nicht auf Maschinengenauigkeit.
 *  879,97 ist nicht 880 — aber 0,8899999 ist 0,89. */
function trifft(ist, soll, stellen) {
  if (ist == null || soll == null) return false;
  const p = Math.pow(10, stellen);
  return Math.round(ist * p) === Math.round(soll * p);
}

function stellenVon(x) {
  const t = String(x);
  const i = t.indexOf('.');
  return i < 0 ? 0 : t.length - i - 1;
}

/* ═══ v1886-WPRF · NICHT JEDER ECKWERT IST EINE RECHNUNG ════════════════
   GEMESSEN an Otterndorf (16051000 mfh) und Augsburg (09162000): dort
   stehen unter `soll_eckwerte` keine Eingaben, sondern BESCHREIBUNGEN —

     { "kennzahl": "standardabweichung_pp", "wert": 1.41 }
     { "merkmal": "sachwert", "klasse": "bis 800.000 EUR", "wert": 1.15 }

   Das sind abgedruckte Kennzahlen und Klassenbezeichnungen, keine
   Objektmerkmale. Wer sie in den Auswerter steckt, bekommt `achse_fehlt`
   und haelt es fuer einen Fehler im Modell.

   Unterschieden wird am SCHLUESSEL: ein Eckwert, der ein beschreibendes
   Feld traegt, wird gezaehlt und genannt, aber nicht gerechnet. */
const BESCHREIBEND = new Set(['kennzahl', 'merkmal', 'klasse', 'bez',
  'einheit', 'hinweis', 'fundstelle', 'bemerkung']);

function eckwerte(s, b, wo) {
  let gerechnet = 0;
  for (const e of (b.soll_eckwerte || [])) {
    const { wert: soll_w, ...ein } = e;
    if (Object.keys(ein).some((k) => BESCHREIBEND.has(k))) {
      beschreibendeEckwerte.push(`${s.ags} ${s.zweig} (${JSON.stringify(ein)})`);
      continue;
    }
    const r = auswerten(modellAus(s), ein);
    const ist = r.dokumentwert != null ? r.dokumentwert : r.wert;
    if (!r.verfuegbar || !trifft(ist, soll_w, stellenVon(soll_w))) {
      fehl(s, `${wo} · Eckwert ${JSON.stringify(ein)}: `
        + `${r.verfuegbar ? ist : r.grund} statt ${soll_w}`);
      return null;
    }
    gerechnet++;
  }
  return gerechnet;
}

/* ── 1 · Anwendungsbeispiel ────────────────────────────────────────────── */

function pruefeBeispiel(s, b, wo, eingabe) {
  if (!eingabe) {
    fehl(s, `${wo} · Anwendungsbeispiel ohne Eingabe — es ist damit nicht `
      + 'maschinell pruefbar. Entweder `eingabe` nachtragen oder die Belegart '
      + 'aendern; ein Beispiel, das niemand rechnet, ist kein Nachweis.');
    return false;
  }
  const r = auswerten(modellAus(s), eingabe);
  if (!r.verfuegbar) {
    fehl(s, `${wo} · Anwendungsbeispiel liefert nichts: ${r.grund} — ${r.hinweis}`);
    return true;
  }
  if (b.soll_tabellenwert != null) {
    const st = stellenVon(b.soll_tabellenwert);
    if (!trifft(r.tabellenwert, b.soll_tabellenwert, st)) {
      fehl(s, `${wo} · Tabellenwert ${r.tabellenwert} statt ${b.soll_tabellenwert} `
        + `(${b.fundstelle || 'ohne Fundstelle'})`);
      return true;
    }
  }
  if (b.soll_wert != null) {
    /* ═══ v1886-WPRF · EIN SOLLWERT IN DER FALSCHEN EINHEIT ════════════
       GEMESSEN an Braunschweig-Wolfsburg (03101 ezfh): der Beleg fuehrt
       `soll_wert: 395000` — das ist das ERGEBNIS des Anwendungsbeispiels
       (500.000 € x 0,79), nicht der Koeffizient, den das Modell liefert.
       Der Vergleich kann nicht gelingen und sagt nichts ueber das Modell.
       Genannt statt als Modellfehler verbucht; das Belegfeld gehoert
       nachgezogen (`soll_ergebnis_eur`). */
    const ein2 = (s.formel || {}).liefert || 'faktor';
    const band = ein2 === 'wert_eur' ? [100, Infinity]
      : ein2 === 'prozent' || ein2 === 'zuschlag_prozent' ? [-100, 100]
      : [0.001, 20];
    if (b.soll_wert < band[0] || b.soll_wert > band[1]) {
      einheitFalsch.push(`${s.ags} ${s.zweig} (soll_wert ${b.soll_wert}, `
        + `das Modell liefert ${ein2})`);
      return true;
    }
    const sw = stellenVon(b.soll_wert);
    const rd = b.soll_rundung;
    /* Der Bericht druckt seine eigene Einheit. Kreis Lippe druckt 90,86 %,
     * nicht 0,9086 — der Sollwert kommt aus dem Dokument, also wird gegen
     * die Dokumentzahl geprueft und nicht gegen den umgerechneten Faktor. */
    const roh = (r.dokumentwert != null) ? r.dokumentwert : r.wert;
    const ist = rd ? Math.round(roh / rd) * rd : roh;
    if (!trifft(ist, b.soll_wert, sw)) {
      fehl(s, `${wo} · Ergebnis ${ist} statt ${b.soll_wert} `
        + `(${b.fundstelle || 'ohne Fundstelle'}) · Rechenweg: ${r.rechenweg}`);
      return true;
    }
  }
  /* Wo der Bericht BEIDES druckt — die eigene Zahl und den daraus
   * abgeleiteten Faktor — wird auch beides geprueft. Dortmund druckt
   * "+34 %" und "Sachwertfaktor 1,34"; nur die erste zu pruefen hiesse,
   * die Umrechnung ungeprueft zu lassen. */
  if (b.soll_faktor != null) {
    const sf = stellenVon(b.soll_faktor);
    if (!trifft(r.wert, b.soll_faktor, sf)) {
      fehl(s, `${wo} · Faktor ${r.wert} statt ${b.soll_faktor} `
        + `(${b.fundstelle || 'ohne Fundstelle'}) · Rechenweg: ${r.rechenweg}`);
      return true;
    }
  }
  gut(s, `${wo} · Anwendungsbeispiel getroffen: `
    + `${r.rechenweg || r.rechenweg_formelwerk || r.wert}`);
  return true;
}

/* ── 2 · Zaehlpruefung ─────────────────────────────────────────────────── */

function pruefeZaehlung(s, b, wo) {
  const f = s.formel || {};
  const z = f.zellen;
  if (!z) {
    if (f.form === 'konstante') {
      return gut(s, `${wo} · Konstante ${f.wert} — nichts zu zaehlen`);
    }
    // stufen_1d und potenz fuehren keine Matrix, sondern eine Reihe.
    // Gezaehlt werden dort die Stuetzstellen.
    if (f.stufen) {
      const n = Object.keys(f.stufen).length;
      /* Eine Reihe hat Stuetzstellen, keine Zeilen. Ein Blatt, das sie
       * waagerecht druckt, meldet soll_zeilen:1 und soll_spalten:10 —
       * gemeint ist beides Mal dieselbe Reihe. Der ausdrueckliche
       * Schluessel gewinnt. */
      const soll = b.soll_stuetzstellen
        ?? (b.soll_zeilen === 1 ? b.soll_spalten : b.soll_zeilen);
      if (soll != null && n !== soll) {
        return fehl(s, `${wo} · ${n} Stuetzstellen statt ${soll}`);
      }
      const e = eckwerte(s, b, wo);
      if (e === null) return undefined;
      return gut(s, `${wo} · Zaehlpruefung ${n} Stuetzstellen`
        + (e ? ` · ${e} Eckwerte getroffen` : ''));
    }
    /* ═══ v1886-WPRF · NICHT JEDE FORM FUEHRT EINE ZELLENTABELLE ════════
       Erst mit dem Blick auf ALLE Belege fielen sie auf: fuenf
       Zaehlpruefungen standen an zweiter Stelle und wurden nie gelesen.
       `baender_1d` zaehlt Klassen, `baender_kategorial` Klassen je
       Kategorie, `verzweigt` die Zellen seiner Untermodelle. */
    if (Array.isArray(f.baender)) {
      const n = f.baender.length;
      const soll = b.soll_stuetzstellen ?? b.soll_klassen ?? b.soll_zeilen;
      if (soll != null && n !== soll) {
        return fehl(s, `${wo} · ${n} Klassen statt ${soll}`);
      }
      return gut(s, `${wo} · Zaehlpruefung ${n} Klassen`);
    }
    if (f.baender_je_kategorie) {
      const je = Object.entries(f.baender_je_kategorie)
        .map(([k, r]) => `${k}:${(r || []).length}`);
      const n = Object.values(f.baender_je_kategorie)
        .reduce((x, r) => x + (r || []).length, 0);
      if (b.soll_zellen != null && n !== b.soll_zellen) {
        return fehl(s, `${wo} · ${n} Klassen statt ${b.soll_zellen} (${je.join(' ')})`);
      }
      return gut(s, `${wo} · Zaehlpruefung ${n} Klassen (${je.join(' ')})`);
    }
    if (f.modell_je_kategorie) {
      let n = 0;
      const je = [];
      for (const [k, u] of Object.entries(f.modell_je_kategorie)) {
        const uz = (u || {}).zellen;
        let m = 0;
        if (uz) {
          const breite = new Set(Object.values(uz)
            .map((r) => (Array.isArray(r) ? r.length : -1)));
          if (breite.size !== 1) {
            return fehl(s, `${wo} · Untermodell "${k}": Zeilen unterschiedlich lang`);
          }
          m = Object.keys(uz).length * [...breite][0];
        } else if ((u || {}).stufen) m = Object.keys(u.stufen).length;
        else if (Array.isArray((u || {}).baender)) m = u.baender.length;
        n += m;
        je.push(`${k}:${m}`);
      }
      const soll = b.soll_zellen
        ?? ((b.soll_zeilen != null && b.soll_spalten != null)
            ? b.soll_zeilen * b.soll_spalten : null);
      if (soll != null && n !== soll) {
        return fehl(s, `${wo} · ${n} Zellen in den Untermodellen statt ${soll} `
          + `(${je.join(' ')})`);
      }
      return gut(s, `${wo} · Zaehlpruefung ${n} Zellen in `
        + `${je.length} Untermodellen (${je.join(' ')})`);
    }
    /* Eine Form ohne Tabelle kann man nicht nachzaehlen — eine Regression
       ERSETZT die abgedruckte Tabelle. Das ist eine Grenze dieses Pruefers
       und kein Datenfehler; sie wird gezaehlt und genannt, damit sie nicht
       als "geprueft" durchgeht. */
    nichtZaehlbar.push(`${s.ags} ${s.zweig} (${f.form})`);
    meldungen.push(`  ?       ${s.ags} ${s.zweig} — ${wo}: Zaehlpruefung bei Form `
      + `'${f.form}' nicht durchfuehrbar (keine Tabelle im Rezept; die Formel `
      + `ersetzt sie). Der Beleg nennt `
      + `${b.soll_zeilen ?? '?'} x ${b.soll_spalten ?? '?'} der Druckfassung.`);
    return undefined;
  }
  const zeilen = Object.keys(z).length;
  const spalten = new Set(Object.values(z).map((r) => (Array.isArray(r) ? r.length : -1)));
  if (spalten.size !== 1) {
    return fehl(s, `${wo} · Zeilen unterschiedlich lang: ${[...spalten].join('/')}`);
  }
  const sp = [...spalten][0];
  /* ═══ v1886-WPRF · DAS REZEPT DARF GEDREHT SEIN ══════════════════════
     GEMESSEN an Otterndorf: der Bericht druckt 46 Zeilen x 3 Spalten, das
     Rezept haelt 3 Zeilen x 46 Spalten — dieselben 138 Zellen, andere
     Achsenreihenfolge. Die ZAHL DER ZELLEN ist der Pruefmassstab, der
     beides ueberlebt; wo der Beleg sie nennt, gilt sie. Nur wo er sie
     nicht nennt, werden Zeilen und Spalten verglichen, und dann in beiden
     Drehungen. */
  if (b.soll_zellen != null) {
    if (zeilen * sp !== b.soll_zellen) {
      return fehl(s, `${wo} · ${zeilen} x ${sp} = ${zeilen * sp} Zellen statt `
        + `${b.soll_zellen}`);
    }
    return gut(s, `${wo} · Zaehlpruefung ${zeilen} x ${sp} = ${b.soll_zellen} Zellen`
      + ((b.soll_zeilen != null && b.soll_zeilen !== zeilen)
         ? ' (Rezept gegenueber der Druckfassung gedreht)' : ''));
  }
  if (b.soll_zeilen != null && b.soll_spalten != null) {
    const gerade = zeilen === b.soll_zeilen && sp === b.soll_spalten;
    const gedreht = zeilen === b.soll_spalten && sp === b.soll_zeilen;
    if (!gerade && !gedreht) {
      return fehl(s, `${wo} · ${zeilen} x ${sp} statt ${b.soll_zeilen} x `
        + `${b.soll_spalten}`);
    }
    return gut(s, `${wo} · Zaehlpruefung ${zeilen} x ${sp} = ${zeilen * sp} Zellen`
      + (gedreht ? ' (gedreht gegenueber der Druckfassung)' : ''));
  }
  if (b.soll_zeilen != null && zeilen !== b.soll_zeilen && sp !== b.soll_zeilen) {
    return fehl(s, `${wo} · ${zeilen} Zeilen / ${sp} Spalten, der Beleg nennt `
      + `${b.soll_zeilen}`);
  }
  if (b.soll_spalten != null && sp !== b.soll_spalten && zeilen !== b.soll_spalten) {
    return fehl(s, `${wo} · ${sp} Spalten / ${zeilen} Zeilen, der Beleg nennt `
      + `${b.soll_spalten}`);
  }
  return gut(s, `${wo} · Zaehlpruefung ${zeilen} x ${sp} = ${zeilen * sp} Zellen`);
}

/* ── 3 · Formel gegen Tabelle ──────────────────────────────────────────── */

function pruefeFormelGegenTabelle(s, b, wo) {
  /* Der Bericht druckt kein Anwendungsbeispiel, aber die Regressionsformel.
   * Formel und Tabelle wurden in getrennten Leselaeufen erhoben und
   * gegeneinander gerechnet — zwei unabhaengige Wege auf dieselbe Zahl.
   * Hier wird nachgezaehlt und gegen die Eckwerte gerechnet. */
  const z = (s.formel || {}).zellen || {};
  const zeilen = Object.keys(z).length;
  const breite = new Set(Object.values(z).map((r) => (Array.isArray(r) ? r.length : -1)));
  if (breite.size !== 1) return fehl(s, `${wo} · Zeilen unterschiedlich lang`);
  const sp = [...breite][0];
  if (b.soll_zellen != null && zeilen * sp !== b.soll_zellen) {
    return fehl(s, `${wo} · ${zeilen * sp} Zellen statt ${b.soll_zellen}`);
  }
  const e = eckwerte(s, b, wo);
  if (e === null) return undefined;
  return gut(s, `${wo} · Formel gegen Tabelle: ${zeilen} x ${sp} Zellen · `
    + `${e} Eckwerte`);
}

/* ── Alle Belege eines Satzes ──────────────────────────────────────────── */

/* ═══ v1886-WPRF · DIE FELDER ENTSCHEIDEN, NICHT DER NAME DER BELEGART ═══
 *
 * GEMESSEN am 05.10.2026 ueber alle Registerdateien: die Ernte fuehrt 22
 * verschiedene Belegarten. Dieser Pruefer kannte DREI Namen — und zwei
 * davon trafen daneben:
 *
 *     funktion_gegen_tabelle                       5 x   (gesucht wurde
 *     abgedruckte_formel_gegen_abgedruckte_tabelle 1 x    `formel_gegen_
 *     abgedruckte_regressionsformel_und_...        1 x     tabelle` — das
 *     gesamtmittel_gegen_zellwerte                 2 x     gibt es NULL mal)
 *     doppelt_gemessene_abgedruckte_tabelle        2 x
 *     zaehlpruefung_zwei_leselaeufe                1 x
 *     abgedrucktes_anwendungsbeispiel              1 x   (Eingabe unter
 *                                                        `soll_eingabe`)
 *
 * Dreizehn Belege mit `soll_eckwerte`, `soll_zellen` oder einer Eingabe —
 * alle maschinell pruefbar, alle nie angefasst. Die Gegenstelle hiess
 * einfach anders.
 *
 *   > Ein Pruefer, der nach NAMEN sucht, prueft das, was man beim Ernten
 *   > zufaellig gleich genannt hat.
 *
 * Deshalb entscheidet jetzt der INHALT: wer eine `eingabe` fuehrt, wird
 * gerechnet; wer `soll_eckwerte` fuehrt, wird an seinen Eckwerten gemessen;
 * wer Zeilen und Spalten nennt, wird nachgezaehlt. Ein Beleg mit
 * `soll_`-Feldern, aus dem dieser Lauf nichts machen kann, wird NAMENTLICH
 * ausgewiesen — das ist der Unterschied zwischen einer Luecke und einem
 * Schweigen. */
const ZAEHLFELD = ['soll_zeilen', 'soll_spalten', 'soll_zellen',
  'soll_stuetzstellen', 'soll_klassen'];

function pruefeBelege(s) {
  const belege = Array.isArray(s.belege) ? s.belege : [];
  if (!belege.length) {
    return fehl(s, 'kein Beleg — CHECK (jsonb_array_length(belege) > 0)');
  }
  let bsp = 0, pruefbar = 0;
  belege.forEach((b, i) => {
    const wo = `Beleg ${i} (${(b && b.art) || 'ohne Art'})`;
    if (!b || typeof b !== 'object') {
      uebersprungen++;
      meldungen.push(`  ?       ${s.ags} ${s.zweig} — Beleg ${i} ist kein Objekt`);
      return;
    }
    const sollFelder = Object.keys(b).filter((k) => /^soll/.test(k) || k === 'eingabe');
    const eingabe = b.eingabe || b.soll_eingabe || null;
    const istBeispiel = /anwendungsbeispiel/i.test(String(b.art || ''));
    let getan = false;

    if (eingabe || istBeispiel) {
      bsp++;
      if (pruefeBeispiel(s, b, wo, eingabe)) pruefbar++;
      getan = true;
    }
    if (Array.isArray(b.soll_eckwerte) && b.soll_eckwerte.length) {
      const n = eckwerte(s, b, wo);
      if (n !== null) gut(s, `${wo} · ${n} Eckwerte des Dokuments getroffen`);
      getan = true;
    }
    if (ZAEHLFELD.some((k) => b[k] != null)) {
      pruefeZaehlung(s, b, wo);
      getan = true;
    }
    if (b.soll_wert != null && !eingabe && !istBeispiel) {
      /* Ein Sollwert ohne Eingabe ist nicht nachzurechnen — bei
         `gesamtmittel_gegen_zellwerte` ist er das Mittel ueber die ganze
         Tabelle, nicht der Wert eines Objekts. Genannt statt verschwiegen. */
      sollOhneEingabe.push(`${s.ags} ${s.zweig} (${b.art}, soll_wert `
        + `${b.soll_wert})`);
      getan = true;
    }
    if (getan) return;
    if (sollFelder.length === 1 && sollFelder[0] === 'soll_kennzahlen') {
      /* Stichprobenstatistik (Fallzahl, Streuung, Spannen) — eine Angabe
         UEBER die Stichprobe, keine Rechnung. Gezaehlt, nicht angemahnt. */
      statistikBelege.push(`${s.ags} ${s.zweig}`);
      return;
    }
    if (sollFelder.length) {
      unbeachtet.push(`${s.ags} ${s.zweig} (${b.art}: ${sollFelder.join(', ')})`);
      meldungen.push(`  ?       ${s.ags} ${s.zweig} — ${wo}: traegt pruefbare `
        + `Felder (${sollFelder.join(', ')}), aus denen dieser Lauf nichts `
        + 'machen kann');
      uebersprungen++;
      return;
    }
    if (INFORMATIV.has(b.art) || /^(amtliche|quellen|tabellenwert|abgedruckte|lizenz|modellbeschreibung|gemessene|kontext|formel)/i
        .test(String(b.art || ''))) {
      informativ++;
      return;
    }
    uebersprungen++;
    meldungen.push(`  ?       ${s.ags} ${s.zweig} — ${wo}: Belegart unbekannt `
      + 'und ohne pruefbare Felder');
  });
  beispieleGesehen += bsp;
  beispielePruefbar += pruefbar;
  if (bsp) saetzeMitBeispiel++;
}

/* ── 4 · Monotonie ueber die ganze Tabelle ─────────────────────────────── */

function richtung(reihe) {
  const w = reihe.filter((v) => typeof v === 'number');
  if (w.length < 2) return 'zu_kurz';
  let auf = 0, ab = 0;
  for (let i = 1; i < w.length; i++) {
    if (w[i] > w[i - 1]) auf++;
    else if (w[i] < w[i - 1]) ab++;
  }
  if (auf && ab) return 'gemischt';
  return auf ? 'steigend' : ab ? 'fallend' : 'gleich';
}

function pruefeMonotonie(s) {
  const f = s.formel || {};
  const z = f.zellen;
  if (!z) return;
  const zeilen = Object.entries(z).filter(([, r]) => Array.isArray(r));
  if (zeilen.length < 2) return;

  const querAchseNumerisch = f.form === 'matrix_interp';
  const quer = querAchseNumerisch ? zeilen.map(([k, r]) => [k, richtung(r)]) : [];
  const gemischt = quer.filter(([, d]) => d === 'gemischt');
  if (gemischt.length) {
    meldungen.push(`  HINWEIS ${s.ags} ${s.zweig} — ${gemischt.length} Zeile(n) `
      + `nicht monoton (${gemischt.slice(0, 4).map(([k]) => k).join(', ')})`);
  }

  // Spaltenweise. Nur wenn die Zeilenschluessel numerisch sind — sonst ist
  // die y-Achse kategorial und Monotonie waere eine Erwartung, die der
  // Bericht gar nicht aufstellt.
  const numerisch = zeilen.every(([k]) => /^-?\d+$/.test(k));
  if (!numerisch) return;
  const sortiert = [...zeilen].sort((a, b) => Number(a[0]) - Number(b[0]));
  const breite = sortiert[0][1].length;
  const schief = [];
  for (let c = 0; c < breite; c++) {
    if (richtung(sortiert.map(([, r]) => r[c])) === 'gemischt') schief.push(c);
  }
  if (schief.length) {
    meldungen.push(`  HINWEIS ${s.ags} ${s.zweig} — Spalte(n) ${schief.join(', ')} `
      + 'nicht monoton');
  }
}

/* ── 5 · Extrapolationssperre ──────────────────────────────────────────── */

function pruefeSperre(s) {
  const f = s.formel || {};
  const b = (s.belege || []).find((x) => x && x.eingabe) || {};
  const e = { ...(b.eingabe || {}) };
  let feld = null, weit = null;

  if (f.form === 'matrix_interp') { feld = f.achse_y_feld; weit = Math.max(...f.achse_y) * 10; }
  else if (f.form === 'matrix_kategorial') { feld = f.achse_x_feld; weit = Math.max(...f.achse_x) * 10; }
  else if (f.form === 'stufen_1d') {
    feld = f.achse_feld;
    weit = Math.max(...Object.keys(f.stufen).map(Number)) * 10;
  } else return;                       // konstante, potenz, doppel_log: eigene Sperre

  if (!feld) return;
  const r = auswerten(modellAus(s), { ...e, [feld]: weit });
  if (r.verfuegbar) {
    fehl(s, `Extrapolationssperre offen: ${feld}=${weit} liefert ${r.wert}`);
  } else {
    ok++;
    meldungen.push(`  ok      ${s.ags} ${s.zweig} — Sperre greift (${r.grund})`);
  }
}

/* ── 6 · Einheit ───────────────────────────────────────────────────────── */

function pruefeEinheit(s) {
  const f = s.formel || {};
  const einheit = f.liefert || 'faktor';
  const b = (s.belege || []).find((x) => x && x.art === 'anwendungsbeispiel'
                                      && x.eingabe);
  if (!b) return;
  const r = auswerten(modellAus(s), b.eingabe);
  if (!r.verfuegbar) return;

  if (einheit === 'wert_eur') {
    if (!(r.wert > 1000)) fehl(s, `liefert=wert_eur, aber wert=${r.wert}`);
    else { ok++; meldungen.push(`  ok      ${s.ags} ${s.zweig} — Euro-Betrag ${r.wert}`); }
    return;
  }
  /* Ein Liegenschaftszinssatz ist kein Sachwertfaktor: 2,49 % sind als
     Faktor 0,0249. Das Band dafuer haelt `swf_modelle.js` je Kennzahl —
     hier wird nur geprueft, dass die Umrechnung ueberhaupt stattgefunden
     hat und das Ergebnis in der Groessenordnung seiner Kennzahl liegt. */
  const [u, o] = (s.kennzahl === 'liegenschaftszinssatz')
    ? [0.001, 0.15] : [0.2, 3.0];
  if (!(r.wert > u && r.wert < o)) {
    fehl(s, `liefert=${einheit}, Ergebnis ${r.wert} liegt ausserhalb von `
      + `${u} bis ${o} fuer ${s.kennzahl || 'sachwertfaktor'}`);
  } else {
    ok++;
    meldungen.push(`  ok      ${s.ags} ${s.zweig} — Einheit ${einheit} -> ${r.wert}`);
  }
}

/* ── Lauf ──────────────────────────────────────────────────────────────── */

const gesehen = new Set();
for (const s of saetze) {
  // Ein Modell gilt fuer mehrere AGS. Geprueft wird es einmal.
  const k = `${s.gaa_name}|${s.zweig}|${s.berichtsjahr}`;
  if (gesehen.has(k)) continue;
  gesehen.add(k);
  saetzeGesehen++;

  pruefeBelege(s);
  pruefeMonotonie(s);
  pruefeSperre(s);
  pruefeEinheit(s);
}

console.log(meldungen.join('\n'));
console.log('');
/* DIE DECKUNG ZUERST. Eine Fehlerzahl ohne Deckung laesst offen, ob
   nichts falsch war oder nichts geprueft wurde. */
console.log(`Datei: ${DATEI}`);
console.log(`Modelle (ein Modell je Ausschuss/Zweig/Jahrgang): ${saetzeGesehen}`);
console.log(`davon mit Anwendungsbeispiel: ${saetzeMitBeispiel} `
  + `(${saetzeGesehen ? Math.round(saetzeMitBeispiel / saetzeGesehen * 100) : 0} %)`);
console.log(`Anwendungsbeispiele im Register: ${beispieleGesehen} · `
  + `maschinell gerechnet: ${beispielePruefbar}`);
console.log(`informative Belege (Wortlaut, Herkunft): ${informativ} · `
  + `unbekannte Belegart: ${uebersprungen}`);
if (nichtZaehlbar.length) {
  console.log(`Zaehlpruefungen nicht durchfuehrbar: ${nichtZaehlbar.length} `
    + `(${nichtZaehlbar.join(' · ')}) — diese Formen fuehren keine Tabelle`);
}
if (sollOhneEingabe.length) {
  console.log(`Sollwerte ohne Eingabe (nicht nachrechenbar): `
    + `${sollOhneEingabe.length} (${sollOhneEingabe.join(' · ')})`);
}
if (beschreibendeEckwerte.length) {
  console.log(`beschreibende Eckwerte (Kennzahl/Klasse, nicht nachrechenbar): `
    + `${beschreibendeEckwerte.length}`);
}
if (statistikBelege.length) {
  console.log(`Belege mit Stichprobenstatistik (soll_kennzahlen): `
    + `${statistikBelege.length} — dieser Lauf rechnet sie nicht`);
}
if (einheitFalsch.length) {
  console.log(`ACHTUNG, Sollwert passt nicht zur Einheit des Modells: `
    + `${einheitFalsch.length} (${einheitFalsch.join(' · ')})`);
}
if (unbeachtet.length) {
  console.log(`ACHTUNG, pruefbare Belege ohne Pruefung: ${unbeachtet.length} `
    + `(${unbeachtet.join(' · ')})`);
}
console.log(`Pruefungen ok: ${ok} · FEHLER: ${fehler}`);
if (beispieleGesehen !== beispielePruefbar) {
  console.log('ACHTUNG: nicht jedes Anwendungsbeispiel wurde gerechnet — '
    + 'eine Null bei den Fehlern sagt dann nichts ueber die uebersprungenen.');
}
process.exit(fehler ? 1 : 0);
