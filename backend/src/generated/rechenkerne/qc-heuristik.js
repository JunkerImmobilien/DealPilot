'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * qc-heuristik.js — v1925
 *
 * DIE BEWERTUNG DES QUICK-CHECKS, als reine Funktion.
 *
 * ── WARUM ES DIESE DATEI GIBT ─────────────────────────────────────────────
 *
 * Marcel am 06.10.2026 zum Telegram-Bot:
 *
 *   „Ich habe dir gesagt, ich moechte mit meinem Telegram-Bot moechte ich,
 *    dass wir auch, wenn wir den Quick-Check machen, dass dann natuerlich
 *    der Deal-Score berechnet wird und dann auch die Bewertung der
 *    Heuristik mit angegeben wird."
 *
 * Und am 04.10.2026, genauer, WAS er meint:
 *
 *   „die Einschaetzung, die der Quick-Check dort geben wuerde unten, also
 *    eine Kaufempfehlung, diese Heuristik, den Deal-Score, die Werte dazu."
 *
 * „Diese Heuristik" ist also zweierlei, und beides stand bis v1922 MITTEN
 * IM ZEICHENCODE von `quick-check.js`:
 *
 *   1. die EINSCHAETZUNG — die Zeilen der Bewertungsbox („Bruttorendite
 *      unter 4 % …", „DSCR < 1,0 …"), gebaut in `qcCalc()` ab Z. 747
 *   2. die KAUFEMPFEHLUNG — KAUFEN / VERHANDELN / KRITISCH / PASS samt
 *      Schmerzschwellen-Kaufpreis, gebaut in `_renderQcRecommendation()`
 *      ab Z. 865
 *
 * Beide Bloecke lasen und schrieben DOM in derselben Funktion, in der sie
 * rechneten. Fuer das Backend waren sie damit unerreichbar — und ein Bot,
 * der dieselbe Bewertung aussprechen soll, haette sie nachbauen muessen.
 *
 *   > Eine zweite Bewertung ueber denselben Deal ist eine zweite Meinung.
 *   > Im Chat staende dann ein anderes Urteil als im Quick-Check, und
 *   > keines von beiden waere falsch — das ist schlimmer als ein Fehler.
 *
 * CLAUDE.md sagt es kurz: „Rechenkerne — nie duplizieren."
 *
 * ── WAS HIER PASSIERT IST, UND WAS NICHT ─────────────────────────────────
 *
 * Die Schwellen, die Reihenfolge, die Formulierungen und die
 * Schmerzschwellen-Rechnung sind WOERTLICH aus `quick-check.js`
 * uebernommen. Keine Zahl wurde angefasst, kein Satz umgeschrieben. Was
 * sich geaendert hat, ist nur der Ort: `quick-check.js` ruft jetzt hier an
 * und schreibt das Ergebnis ins DOM.
 *
 * KEIN DOM, KEIN localStorage, KEIN Timer — damit die Datei woertlich ins
 * Backend gespiegelt werden kann (`tools/rechenkerne-spiegeln.mjs`).
 *
 * ── DIE BETONUNG IST ANZEIGE, NICHT INHALT ───────────────────────────────
 *
 * Der Empfehlungstext hebt den Kaufpreis hervor. Im Browser ist das
 * `<strong>`, im Telegram-Chat waere es Unsinn. Deshalb nimmt `bewerten()`
 * eine Funktion `betont` entgegen; ohne sie bleibt der Text nackt. So
 * stehen die SAETZE an einer Stelle und nur ihre Auszeichnung ist zweimal
 * da.
 * ═══════════════════════════════════════════════════════════════════════════ */

window.QcHeuristik = (function () {

  /* Die Schwellen der Kaufempfehlung. Sie sind NICHT die Score-Stufen aus
     `score-tiers.js` (85/70/50/35) — eine Kaufempfehlung ist eine andere
     Aussage als eine Note, und sie stand hier seit V54 auf 75/60/40.
     Wer sie angleichen will, entscheidet das fachlich; stillschweigend
     verschieben waere eine Produktaenderung ohne Ansage. */
  var SCHWELLE = { kaufen: 75, verhandeln: 60, kritisch: 40 };

  function _fmtEur(n) {
    if (!isFinite(n)) return '—';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }

  /* ── 1 · DIE EINSCHAETZUNG ──────────────────────────────────────────────
   * Woertlich aus quick-check.js (qcCalc, Z. 747–754). Die Reihenfolge ist
   * Teil der Aussage: die Warnungen zuerst, das Lob danach, und wenn gar
   * nichts auffaellt, der Satz, dass nichts auffaellt. */
  function einschaetzung(d) {
    var bmr = +d.bmr || 0, nmr = +d.nmr || 0, cfMon = +d.cfMon || 0;
    var dscr = +d.dscr || 0, ekr = +d.ekr || 0;
    var bewirtPctNkm = +d.bewirtPctNkm || 0;
    var msgs = [];
    if (bmr < 4) msgs.push('Bruttorendite unter 4% — preislich teuer für die Region oder Miete zu niedrig.');
    if (nmr < 2) msgs.push('Nettorendite unter 2% — nach Bewirtschaftungskosten bleibt sehr wenig.');
    if (cfMon < 0) msgs.push('Negativer Cashflow von ' + Math.round(cfMon) + ' €/Mon — Deal kostet dich Geld jeden Monat.');
    if (dscr > 0 && dscr < 1.0) msgs.push('DSCR < 1,0 — Mieteinnahmen decken nicht mal die Bankrate.');
    if (bewirtPctNkm > 35) msgs.push('Bewirtschaftungskosten über 35% der NKM — IVD-Empfehlung wäre 18-35%.');
    if (ekr > 8 && cfMon > 100) msgs.push('Sehr starke EK-Rendite und positiver Cashflow — solider Deal.');
    if (msgs.length === 0) msgs.push('Solide Eckdaten ohne offensichtliche Probleme. Im vollen Objekt-Modus siehst du den vollständigen Investor Deal Score 2.0 mit ~22 KPIs.');
    return msgs;
  }

  /* ── 2 · DER SCHMERZSCHWELLEN-KAUFPREIS ─────────────────────────────────
   * Woertlich aus quick-check.js (_renderQcRecommendation, Z. 865–908),
   * samt der Begruendung, die dort stand:
   *
   *   V63.25: Vorher kpFor55 = nkmYear / 0.055 (= BMR-5,5-%-Ziel) — Bug:
   *   bei hoher Ist-BMR empfahl das System einen HOEHEREN KP mit
   *   „negativem Nachlass". Sinnlos.
   *
   *   Neue Logik: finde den KP, bei dem die Rechnung „wenigstens halbwegs
   *   traegt" — Ziel BMR >= 6 %, Cashflow >= 0 EUR/Mon, DSCR >= 1,1. Es
   *   gilt der STRENGERE der beiden ableitbaren Preise, und nur dann, wenn
   *   er UNTER dem heutigen Kaufpreis liegt. */
  function zielKaufpreis(d) {
    var kp = +d.kp || 0, nkm = +d.nkm || 0;
    var cfMon = +d.cfMon || 0, dscr = +d.dscr || 0;
    var nkmYear = nkm * 12;
    var kpForBmr = nkmYear / 0.06;                   // KP bei BMR=6%
    var annuitaetJahr;
    if (dscr && dscr > 0) {
      annuitaetJahr = nkmYear / dscr;
    } else {
      annuitaetJahr = nkmYear * 0.6;                 // Fallback ~60% der NKM
    }
    var heutigeKnk = kp * 0.105;
    var heutigesDarlehen = Math.max(1, kp + heutigeKnk - (kp * 0.05)); // grobe EK-Annahme 5%
    var annuitaetsFaktor = annuitaetJahr / heutigesDarlehen;   // z.B. 0.058 (5,8%)
    if (annuitaetsFaktor < 0.04) annuitaetsFaktor = 0.058;
    var deltaKp = (cfMon < 0) ? Math.abs(cfMon) * 12 / annuitaetsFaktor : 0;
    var kpForCf0 = kp - deltaKp;

    var ziel = Math.min(kpForBmr, kpForCf0);
    if (!isFinite(ziel) || ziel <= 0 || ziel >= kp) {
      // Wenn KP schon unter den Zielen → keine Preissenkung nötig
      ziel = kp;
    }
    return ziel;
  }

  /* ── 3 · DIE KAUFEMPFEHLUNG ─────────────────────────────────────────────
   * Woertlich aus quick-check.js (_renderQcRecommendation, Z. 909–953).
   * `betont` zeichnet den Kaufpreis aus — im Browser `<strong>`, im Chat
   * gar nicht. */
  function empfehlung(d, betont) {
    var b = (typeof betont === 'function') ? betont : function (s) { return s; };
    var score = +d.score;
    var kp = +d.kp || 0, cfMon = +d.cfMon || 0;
    var ziel = zielKaufpreis(d);
    var verdict, farbklasse, advice;

    if (score >= SCHWELLE.kaufen) {
      verdict = 'KAUFEN';
      farbklasse = 'qc-rec-green';
      advice = 'Die Kennzahlen passen — Kauf bei ' + b(_fmtEur(kp)) + ' ist gerechtfertigt. ' +
               'Vor Kaufvertrag noch: Bonität checken, Hausgeld-Aufstellung anfordern, ' +
               'Eigentümerprotokolle der letzten 3 Jahre prüfen, Energieausweis verifizieren.';
    } else if (score >= SCHWELLE.verhandeln) {
      verdict = 'VERHANDELN';
      farbklasse = 'qc-rec-gold';
      if (ziel < kp) {
        var diffPct = Math.round((1 - ziel / kp) * 100);
        var diffEur = Math.round(kp - ziel);
        advice = 'Aktuell solide aber mit Spielraum. Bei einem Kaufpreis von ' + b(_fmtEur(ziel)) + ' ' +
                 '(' + diffPct + '% Nachlass = ' + _fmtEur(diffEur) + ' weniger) wäre der Deal klar gut. ' +
                 'Empfehlung: Verhandle den KP runter oder schau ob du die Miete steigern kannst.';
      } else {
        advice = 'Solide Kennzahlen — am aktuellen Preis brauchst du nicht viel Verhandlungs-Spielraum. ' +
                 'Trotzdem: Hausgeld-Aufstellung, Protokolle, Energieausweis prüfen.';
      }
    } else if (score >= SCHWELLE.kritisch) {
      verdict = 'KRITISCH';
      farbklasse = 'qc-rec-red';
      if (ziel < kp) {
        var diffPct2 = Math.round((1 - ziel / kp) * 100);
        var diffEur2 = Math.round(kp - ziel);
        advice = 'Die Kennzahlen sind zu schwach. Damit es ein Investment wird, müsste der Kaufpreis auf ' +
                 b(_fmtEur(ziel)) + ' (' + diffPct2 + '% Nachlass = ' + _fmtEur(diffEur2) + ' weniger) runter — ' +
                 'oder die Miete deutlich steigen. ' +
                 (cfMon < 0 ? 'Negativer Cashflow von ' + Math.round(cfMon) + ' €/Mon ist ein klares Warnsignal. ' : '') +
                 'Eher passen oder hart verhandeln.';
      } else {
        advice = 'Die Kennzahlen sind schwach trotz angemessenem Preis — die Schwäche kommt aus anderen Faktoren ' +
                 '(Bewirtschaftung, Finanzierung, LTV). ' +
                 (cfMon < 0 ? 'Negativer Cashflow von ' + Math.round(cfMon) + ' €/Mon. ' : '') +
                 'Empfehlung: EK erhöhen, bessere Konditionen verhandeln oder anderes Objekt suchen.';
      }
    } else {
      verdict = 'PASS';
      farbklasse = 'qc-rec-red';
      advice = 'Klares Pass. Die Kennzahlen sind so weit weg von solide, dass auch starkes Verhandeln das nicht rettet. ' +
               (ziel < kp ? 'Bei einem Kaufpreis unter ' + b(_fmtEur(ziel)) + ' könnte man drüber reden. ' : '') +
               'Empfehlung: Such ein anderes Objekt mit besserer Substanz.';
    }

    return { verdict: verdict, farbklasse: farbklasse, text: advice, ziel_kp: ziel };
  }

  /** Beides auf einmal — das, was der Quick-Check unten anzeigt. */
  function bewerten(d, betont) {
    var e = (d && isFinite(+d.score) && (+d.kp) && (+d.nkm))
      ? empfehlung(d, betont)
      : null;
    return {
      einschaetzung: einschaetzung(d || {}),
      empfehlung: e
    };
  }

  return {
    einschaetzung: einschaetzung,
    empfehlung: empfehlung,
    zielKaufpreis: zielKaufpreis,
    bewerten: bewerten,
    SCHWELLE: SCHWELLE
  };
})();
