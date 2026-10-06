'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * scripts/pruef-schnellblick.js — v1925
 *
 * EIN ECHTER LAUF des Bot-Werkzeugs `objekt_schnellblick` gegen ein echtes
 * Objekt in der echten Datenbank — und die Gegenprobe des Deal-Scores
 * gegen die am Objekt GESPEICHERTEN Werte.
 *
 * ── WARUM ES DIESES SKRIPT GIBT ───────────────────────────────────────────
 *
 * `node --check` prueft Syntax. Dass ein Werkzeug die richtigen Zahlen
 * liefert, prueft nur ein Lauf mit echten Daten — und zwar einer, der
 * dieselbe Funktion ruft, die der Bot ruft, und nicht eine nachgebaute.
 *
 *   > Ein Pruefer, der seine Abhaengigkeiten selbst verdrahtet, misst sich
 *   > selbst. Er laedt die ECHTE Datei und ruft die ECHTE Funktion.
 *
 * Deshalb: `require('../src/services/agentWerkzeuge')`, der echte `ctx`
 * des Agenten ({ userId, merkeObjekt }), und die Pruefung vergleicht das
 * Ergebnis mit den `_kpis_*`-Feldern, die der BROWSER geschrieben hat.
 *
 * ── AUFRUF ───────────────────────────────────────────────────────────────
 *
 *   docker exec dealpilot-backend node scripts/pruef-schnellblick.js
 *   docker exec dealpilot-backend node scripts/pruef-schnellblick.js <objekt-id>
 *
 * Ohne Angabe nimmt es die fuenf zuletzt geaenderten Objekte mit
 * gespeichertem Deal-Score. RC=1, wenn eine Kennzahl abweicht.
 * ═══════════════════════════════════════════════════════════════════════════ */

const { query } = require('../src/db/pool');
const werkzeuge = require('../src/services/agentWerkzeuge');
const rechenkerne = require('../src/services/rechenkerne');

function zahl(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function dez(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* Die Zahl aus einem fertig formatierten Text zurueckholen — die Werkzeuge
   geben bewusst Text aus ("90,91 %", "9.000 EUR"), damit das Modell nichts
   umrechnet. Fuer den Vergleich braucht es die Zahl. */
function ausText(s) {
  if (s == null) return null;
  const m = String(s).replace(/\./g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

(async () => {
  let fehler = 0;

  /* Welche Funktion ruft der Bot? Die, die im Verzeichnis steht — nicht
     eine nachgebaute. `finde()` ist genau der Weg, den `agentLauf.js`
     geht. */
  const eintrag = werkzeuge.finde('objekt_schnellblick');
  if (!eintrag || typeof eintrag.fn !== 'function') {
    console.error('objekt_schnellblick ist in der Werkzeugliste nicht erreichbar — '
      + 'Export geaendert? ' + Object.keys(werkzeuge).join(', '));
    process.exit(1);
  }
  console.log('Werkzeug gefunden: ' + eintrag.name + ' (Stufe ' + eintrag.stufe + ')');
  console.log('Rechenkerne: ' + JSON.stringify(rechenkerne.herkunft()));

  const wunsch = process.argv[2];
  const r = wunsch
    ? await query('SELECT id, user_id, data FROM objects WHERE id = $1', [wunsch])
    : await query(`SELECT id, user_id, data FROM objects
                    WHERE data::jsonb->>'_dealpilot_score' IS NOT NULL
                    ORDER BY updated_at DESC LIMIT 5`);
  if (!r.rows.length) {
    console.error('Kein Objekt gefunden.');
    process.exit(1);
  }

  for (const zeile of r.rows) {
    const d = zeile.data || {};
    const adr = [d.str, d.hnr].filter(Boolean).join(' ') || '(ohne Strasse)';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(adr + '   ·   ' + zeile.id.slice(0, 8));

    const gemerkt = [];
    const ctx = { userId: zeile.user_id, merkeObjekt: (x) => gemerkt.push(x) };
    let erg;
    try {
      erg = await eintrag.fn(ctx, { id: zeile.id });
    } catch (e) {
      console.error('  LAUF GESCHEITERT: ' + e.message);
      fehler++;
      continue;
    }
    if (!erg.gefunden) { console.log('  nicht gefunden — uebersprungen'); continue; }

    console.log('  Adresse im Ergebnis: ' + erg.adresse);
    console.log('  Rechnung:            ' + JSON.stringify(erg.rechnung));
    if (erg.finanzierung) {
      console.log('  Kapitaldienst:       ' + erg.finanzierung.kapitaldienst_jahr);
      console.log('  Bewirtschaftung:     ' + erg.finanzierung.bewirtschaftung_jahr);
      console.log('  Ueberschuss:         ' + erg.finanzierung.ueberschuss_jahr);
    } else {
      console.log('  Finanzierung:        nicht gerechnet (Zins/Tilgung fehlen)');
    }

    const b = erg.bewertung;
    if (!b) { console.error('  KEIN Bewertungsblock — das ist der Fehler, den v1925 behebt'); fehler++; continue; }

    if (b.geht_noch_nicht) {
      console.log('  SCORE: nicht gerechnet, fehlt: ' + b.geht_noch_nicht.join(' / '));
      console.log('         ' + b.hinweis);
    } else {
      console.log('  SCORE: ' + b.dealpilot_score + '  (' + b.stufe + ')');
      console.log('         Herkunft: ' + b.herkunft);
      if (b.empfehlung) {
        console.log('  EMPFEHLUNG: ' + b.empfehlung);
        console.log('         ' + b.empfehlung_text);
      }
      if (b.einschaetzung) b.einschaetzung.forEach((m) => console.log('         - ' + m));
      if (b.teilnoten) b.teilnoten.forEach((t) =>
        console.log('         · ' + t.was + ': ' + t.punkte + ' x ' + t.gewicht + '  (' + t.grundlage + ')'));
      if (b.kennzahlen) console.log('         ' + JSON.stringify(b.kennzahlen));
      if (b.wertpuffer) console.log('         Wertpuffer: ' + b.wertpuffer);
    }

    /* ── DIE GEGENMESSUNG ────────────────────────────────────────────────
     * Gegen die Werte, die der BROWSER am Objekt gespeichert hat. Sie sind
     * die einzige unabhaengige Quelle, die es gibt: dieselbe Rechnung, ein
     * anderer Prozess, ein anderer Zeitpunkt. */
    const soll = {
      score: zahl(d._dealpilot_score),
      dscr: dez(d._kpis_dscr), ltv: dez(d._kpis_ltv),
      bmy: dez(d._kpis_bmy), bwk: dez(d._kpis_bwk_y), cf_vs: dez(d._kpis_cf_vs)
    };
    console.log('  gespeichert (Browser): score ' + soll.score
      + '  dscr ' + soll.dscr + '  ltv ' + soll.ltv
      + '  bmy ' + soll.bmy + '  bwk ' + soll.bwk + '  cf_vs ' + soll.cf_vs);

    function vgl(name, ist, sollwert, eps) {
      if (ist == null || sollwert == null) {
        console.log('    –  ' + name + ': nicht beidseitig vorhanden (Kern ' + ist + ', DB ' + sollwert + ')');
        return;
      }
      const ab = Math.abs(ist - sollwert);
      const ok = ab <= eps;
      console.log('    ' + (ok ? 'OK ' : 'ABW') + ' ' + name.padEnd(8)
        + 'Kern ' + String(ist).padEnd(22) + 'DB ' + String(sollwert).padEnd(22)
        + 'd=' + ab);
      if (!ok) fehler++;
    }

    /* Der gespeicherte Score gewinnt im Werkzeug, wenn es einen gibt —
       dann ist die Gegenmessung trivial und prueft nur die Durchleitung.
       Interessant ist die Stufe: sie darf nicht erfunden sein. */
    if (b.dealpilot_score != null && soll.score != null) {
      vgl('score', b.dealpilot_score, soll.score, 0);
      const sollStufe = rechenkerne.stufe(soll.score).versal;
      console.log('    ' + (b.stufe === sollStufe ? 'OK ' : 'ABW') + ' stufe   '
        + b.stufe + ' / erwartet ' + sollStufe);
      if (b.stufe !== sollStufe) fehler++;
    }
    if (erg.rechnung && soll.bmy != null) {
      vgl('bmy', ausText(erg.rechnung.bruttomietrendite), soll.bmy, 0.005);
    }
    if (b.kennzahlen) {
      if (soll.dscr != null) vgl('dscr', ausText(b.kennzahlen.dscr), soll.dscr, 0.005);
      if (soll.ltv != null) vgl('ltv', ausText(b.kennzahlen.ltv), soll.ltv, 0.005);
    }
    if (erg.finanzierung && soll.bwk != null) {
      vgl('bwk', ausText(erg.finanzierung.bewirtschaftung_jahr), soll.bwk, 0.51);
    }
    if (erg.finanzierung && soll.cf_vs != null) {
      vgl('cf_vs', ausText(erg.finanzierung.ueberschuss_jahr), soll.cf_vs, 0.51);
    }

    if (gemerkt.length !== 1 || gemerkt[0] !== zeile.id) {
      console.error('    ABW merkeObjekt: ' + JSON.stringify(gemerkt));
      fehler++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(fehler ? (fehler + ' Abweichung(en)') : 'Keine Abweichung.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
