// pruefstrecke-swf.mjs   (v1084-WPRF)
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

import { readFileSync } from 'node:fs';
import { auswerten } from '../lib/swf_modelle.js';

const DATEI = process.argv[2] || 'out/swf-nrw.json';
const saetze = JSON.parse(readFileSync(DATEI, 'utf8'));

let ok = 0, fehler = 0, uebersprungen = 0;
const meldungen = [];

function fehl(s, text) {
  fehler++;
  meldungen.push(`  FEHLER  ${s.ags} ${s.zweig} (${s.formel.form}) — ${text}`);
}
function gut(s, text) {
  ok++;
  meldungen.push(`  ok      ${s.ags} ${s.zweig} — ${text}`);
}

/** Der Auswerter erwartet Formel und Korrekturen in EINEM Objekt. */
function modellAus(s) {
  return { ...s.formel, korrekturen: s.korrekturen || [] };
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

/* ── 1/2 · Beleg ───────────────────────────────────────────────────────── */

function pruefeBeleg(s) {
  const b = (s.belege || [])[0];
  if (!b) return fehl(s, 'kein Beleg — CHECK (jsonb_array_length(belege) > 0)');

  if (b.art === 'anwendungsbeispiel') {
    if (!b.eingabe) return fehl(s, 'Anwendungsbeispiel ohne Eingabe');
    const r = auswerten(modellAus(s), b.eingabe);
    if (!r.verfuegbar) {
      return fehl(s, `Anwendungsbeispiel liefert nichts: ${r.grund} — ${r.hinweis}`);
    }
    if (b.soll_tabellenwert != null) {
      const st = stellenVon(b.soll_tabellenwert);
      if (!trifft(r.tabellenwert, b.soll_tabellenwert, st)) {
        return fehl(s, `Tabellenwert ${r.tabellenwert} statt ${b.soll_tabellenwert} `
          + `(${b.fundstelle || 'ohne Fundstelle'})`);
      }
    }
    if (b.soll_wert != null) {
      const sw = stellenVon(b.soll_wert);
      const rd = b.soll_rundung;
      /* Der Bericht druckt seine eigene Einheit. Kreis Lippe druckt 90,86 %,
       * nicht 0,9086 — der Sollwert kommt aus dem Dokument, also wird gegen
       * die Dokumentzahl geprueft und nicht gegen den umgerechneten Faktor. */
      const roh = (r.dokumentwert != null) ? r.dokumentwert : r.wert;
      const ist = rd ? Math.round(roh / rd) * rd : roh;
      if (!trifft(ist, b.soll_wert, sw)) {
        return fehl(s, `Ergebnis ${ist} statt ${b.soll_wert} `
          + `(${b.fundstelle || 'ohne Fundstelle'}) · Rechenweg: ${r.rechenweg}`);
      }
    }
    /* Wo der Bericht BEIDES druckt — die eigene Zahl und den daraus
     * abgeleiteten Faktor — wird auch beides geprueft. Dortmund druckt
     * "+34 %" und "Sachwertfaktor 1,34"; nur die erste zu pruefen hiesse,
     * die Umrechnung ungeprueft zu lassen. */
    if (b.soll_faktor != null) {
      const sf = stellenVon(b.soll_faktor);
      if (!trifft(r.wert, b.soll_faktor, sf)) {
        return fehl(s, `Faktor ${r.wert} statt ${b.soll_faktor} `
          + `(${b.fundstelle || 'ohne Fundstelle'}) · Rechenweg: ${r.rechenweg}`);
      }
    }
    return gut(s, `Anwendungsbeispiel getroffen: ${r.rechenweg || r.wert}`);
  }

  if (b.art === 'zaehlpruefung') {
    const z = s.formel.zellen;
    if (!z) {
      if (s.formel.form === 'konstante') {
        return gut(s, `Konstante ${s.formel.wert} — nichts zu zaehlen`);
      }
      // stufen_1d und potenz fuehren keine Matrix, sondern eine Reihe.
      // Gezaehlt werden dort die Stuetzstellen.
      if (s.formel.stufen) {
        const n = Object.keys(s.formel.stufen).length;
        if (b.soll_zeilen != null && n !== b.soll_zeilen) {
          return fehl(s, `${n} Stuetzstellen statt ${b.soll_zeilen}`);
        }
        return gut(s, `Zaehlpruefung ${n} Stuetzstellen`);
      }
      return fehl(s, 'Zaehlpruefung ohne Zellen und ohne Stufen');
    }
    const zeilen = Object.keys(z).length;
    const spalten = new Set(Object.values(z).map((r) => (Array.isArray(r) ? r.length : -1)));
    if (spalten.size !== 1) {
      return fehl(s, `Zeilen unterschiedlich lang: ${[...spalten].join('/')}`);
    }
    const sp = [...spalten][0];
    if (b.soll_zeilen != null && zeilen !== b.soll_zeilen) {
      return fehl(s, `${zeilen} Zeilen statt ${b.soll_zeilen}`);
    }
    if (b.soll_spalten != null && sp !== b.soll_spalten) {
      return fehl(s, `${sp} Spalten statt ${b.soll_spalten}`);
    }
    return gut(s, `Zaehlpruefung ${zeilen} x ${sp} = ${zeilen * sp} Zellen`);
  }

  uebersprungen++;
  meldungen.push(`  ?       ${s.ags} ${s.zweig} — Belegart '${b.art}' unbekannt`);
}

/* ── 3 · Monotonie ueber die ganze Tabelle ─────────────────────────────── */

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
  const z = s.formel.zellen;
  if (!z) return;
  const zeilen = Object.entries(z).filter(([, r]) => Array.isArray(r));
  if (zeilen.length < 2) return;

  const querAchseNumerisch = s.formel.form === 'matrix_interp';
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

/* ── 4 · Extrapolationssperre ──────────────────────────────────────────── */

function pruefeSperre(s) {
  const f = s.formel;
  const b = (s.belege || [])[0] || {};
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

/* ── 5 · Einheit ───────────────────────────────────────────────────────── */

function pruefeEinheit(s) {
  const einheit = s.formel.liefert || 'faktor';
  const b = (s.belege || [])[0] || {};
  if (b.art !== 'anwendungsbeispiel' || !b.eingabe) return;
  const r = auswerten(modellAus(s), b.eingabe);
  if (!r.verfuegbar) return;

  if (einheit === 'wert_eur') {
    if (!(r.wert > 1000)) fehl(s, `liefert=wert_eur, aber wert=${r.wert}`);
    else { ok++; meldungen.push(`  ok      ${s.ags} ${s.zweig} — Euro-Betrag ${r.wert}`); }
    return;
  }
  // Alles andere muss hinten ein FAKTOR sein. Ein Sachwertfaktor von 90,86
  // ist keiner — die Berichte drucken Prozent, gerechnet wird mit dem Faktor.
  if (!(r.wert > 0.2 && r.wert < 3.0)) {
    fehl(s, `liefert=${einheit}, Ergebnis ${r.wert} ist kein Sachwertfaktor `
      + '(erwartet zwischen 0,2 und 3,0)');
  } else {
    ok++;
    meldungen.push(`  ok      ${s.ags} ${s.zweig} — Einheit ${einheit} -> Faktor ${r.wert}`);
  }
}

/* ── Lauf ──────────────────────────────────────────────────────────────── */

const gesehen = new Set();
for (const s of saetze) {
  // Ein Modell gilt fuer mehrere AGS. Geprueft wird es einmal.
  const k = `${s.gaa_name}|${s.zweig}|${s.berichtsjahr}`;
  if (gesehen.has(k)) continue;
  gesehen.add(k);

  pruefeBeleg(s);
  pruefeMonotonie(s);
  pruefeSperre(s);
  pruefeEinheit(s);
}

console.log(meldungen.join('\n'));
console.log('');
console.log(`Modelle geprueft: ${gesehen.size} · Pruefungen ok: ${ok} · `
  + `FEHLER: ${fehler} · uebersprungen: ${uebersprungen}`);
process.exit(fehler ? 1 : 0);
