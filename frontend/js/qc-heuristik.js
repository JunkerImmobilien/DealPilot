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
      /* ── v1935 · EIN URTEIL, DAS SEINE EIGENE BEGRUENDUNG AUFHOB ──────
       *
       * Marcel am 07.10.2026 zur Sachsenstr. 18 (Score 68):
       *
       *   „wenn ich verhandeln soll, aber unten steht, brauchst du nicht
       *    viel Verhandlungsspielraum, das schliesst sich gegenseitig aus."
       *
       * Er hat recht, und es war kein Formulierungsfehler. Das Urteil hing
       * ALLEIN am Score, der Rat darunter aber am PREIS — und beide liefen
       * auseinander, sobald der Kaufpreis schon unter beiden Zielpreisen
       * lag (BMR >= 6 % und Cashflow >= 0). Dann stand woertlich:
       *
       *     VERHANDELN
       *     Solide Kennzahlen — am aktuellen Preis brauchst du nicht viel
       *     Verhandlungs-Spielraum.
       *
       * GEMESSEN ueber ein Gitter aus 15.150 Faellen (Score 0-100 x sechs
       * Preis/Miete-Paare x fuenf Cashflows x fuenf DSCR): **990 Faelle,
       * 6,5 %** — und die betreffen die GANZE Spanne 60 bis 74, nicht
       * einen Rand.
       *
       *   > „Verhandeln" ist eine Handlungsanweisung an den PREIS. Wo der
       *   > Preis kein Hebel ist, ist sie keine Empfehlung, sondern eine
       *   > Aufforderung ins Leere.
       *
       * Deshalb richtet sich das Urteil jetzt nach dem, was der Rat
       * tatsaechlich sagt: gibt es einen Preishebel, heisst es VERHANDELN;
       * gibt es keinen, heisst es PRUEFEN — und der Rat nennt, was zu
       * pruefen ist. Die SCHWELLEN sind unveraendert (75/60/40), der Score
       * ist unveraendert, nur das Wort trifft jetzt zu.
       *
       *   ⚠ Das ist eine PRODUKTentscheidung an einer Stelle, die Marcel
       *   kennt: die Pille im Quick-Check zeigt jetzt bei manchen Objekten
       *   PRUEFEN statt VERHANDELN. Gemeldet, damit er widersprechen kann. */
      if (ziel < kp) {
        verdict = 'VERHANDELN';
        farbklasse = 'qc-rec-gold';
        var diffPct = Math.round((1 - ziel / kp) * 100);
        var diffEur = Math.round(kp - ziel);
        advice = 'Aktuell solide aber mit Spielraum. Bei einem Kaufpreis von ' + b(_fmtEur(ziel)) + ' ' +
                 '(' + diffPct + '% Nachlass = ' + _fmtEur(diffEur) + ' weniger) wäre der Deal klar gut. ' +
                 'Empfehlung: Verhandle den KP runter oder schau ob du die Miete steigern kannst.';
      } else {
        verdict = 'PRUEFEN';
        farbklasse = 'qc-rec-gold';
        advice = 'Solide Kennzahlen, und der Preis ist nicht das Problem — er liegt schon ' +
                 'unter dem, was dieser Deal tragen würde. Der Score bleibt trotzdem im ' +
                 'Mittelfeld; die Schwäche steckt woanders (Bewirtschaftung, Finanzierung, LTV). ' +
                 'Deshalb nicht am Preis ansetzen, sondern prüfen: Hausgeld-Aufstellung, ' +
                 'Eigentümerprotokolle der letzten 3 Jahre, Energieausweis.';
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

  /* ── 4 · DER SATZ ZUR STUFE ─────────────────────────────────────────────
   * Woertlich aus quick-check.js (`#qc-top-deal-desc`, Z. 658-665). Er
   * haengt an der FARBKLASSE aus `score-tiers.js` (top/green/gold/red),
   * nicht am Score — deshalb nimmt er sie entgegen. */
  function stufensatz(klasse) {
    if (klasse === 'top') return 'Quick-Check zeigt sehr gute Kennzahlen. Im Objekt-Modus genauer prüfen für vollen Score.';
    if (klasse === 'green') return 'Quick-Check signalisiert solide bis gute Eckwerte. Detail-Analyse empfohlen.';
    if (klasse === 'gold') return 'Brauchbare Basis aber mit Schwächen. Genaue Prüfung notwendig.';
    return 'Quick-Check zeigt Schwächen. Im Detail-Modus analysieren ob das Bild kippt.';
  }

  /* ── 5 · DIE SIEBEN KENNZAHLEN MIT IHRER AMPEL ──────────────────────────
   *
   * v1936. Marcel am 07.10.2026: „beim Quickcheck geben wir doch immer
   * diese Heuristik aus, was dabei rauskommt. Das muss doch da
   * vollumfaenglich stehen."
   *
   * GEMESSEN, was der Quick-Check unten WIRKLICH zeigt: nicht nur Urteil
   * und Einschaetzung, sondern SIEBEN Kennzahlenkacheln mit einer Ampel
   * (`qc-kpi-good` / `-mid` / `-bad`) und FUENF Kategorien mit Punkten und
   * ausgeschriebener Skala. Davon lieferte der Bot bis v1935 nur einen
   * Teil — die Ampel und die Skalen steckten im DOM-Code.
   *
   *   > Eine Ampel ist keine Verzierung. Sie sagt, welche der sieben
   *   > Zahlen das Urteil traegt — und genau das fragt der Nutzer als
   *   > Naechstes.
   *
   * Die Skalen sind WOERTLICH die aus `_setKpi()` (quick-check.js
   * Z. 696-709), die Schwellen der Ampel die aus `_setKpi` selbst:
   * >= 0,75 gruen, >= 0,40 gelb, sonst rot. */
  var KPI_SKALEN = [
    ['bmr',  'Bruttomietrendite',  'prozent', function (v) { return v <= 3 ? 0 : v >= 7 ? 1 : (v - 3) / 4; },      '3 % = 0 Pkt, 7 % = 100 Pkt'],
    ['nmr',  'Nettomietrendite',   'prozent', function (v) { return v <= 1 ? 0 : v >= 5 ? 1 : (v - 1) / 4; },      '1 % = 0 Pkt, 5 % = 100 Pkt'],
    ['ekr',  'Eigenkapitalrendite', 'prozent', function (v) { return v <= 0 ? 0 : v >= 12 ? 1 : v / 12; },          '0 % = 0 Pkt, 12 % = 100 Pkt'],
    ['cf',   'Cashflow je Monat',  'euro',    function (v) { return v <= -200 ? 0 : v >= 300 ? 1 : (v + 200) / 500; }, '−200 €/Mon = 0 Pkt, +300 €/Mon = 100 Pkt'],
    ['dscr', 'DSCR',               'zahl2',   function (v) { return v <= 0.9 ? 0 : v >= 1.5 ? 1 : (v - 0.9) / 0.6; }, '0,9 = 0 Pkt, 1,5 = 100 Pkt · Faustregel Bank: ab 1,2 guter Deckungsgrad'],
    ['ltv',  'LTV',                'prozent0', function (v) { return v >= 100 ? 0 : v >= 90 ? 0.4 : v >= 80 ? 0.7 : 1; }, 'ab 100 % riskant, unter 80 % gut'],
    ['bwk',  'Bewirtschaftungsquote', 'prozent0', function (v) { return v <= 18 ? 1 : v >= 40 ? 0 : (40 - v) / 22; }, '18 % = 100 Pkt, 40 % = 30 Pkt · IVD-Empfehlung ETW 18–35 %']
  ];

  function _kpiText(art, v) {
    if (art === 'prozent') return v.toFixed(2).replace('.', ',') + ' %';
    if (art === 'prozent0') return v.toFixed(0) + ' %';
    if (art === 'zahl2') return v ? v.toFixed(2).replace('.', ',') : '—';
    if (art === 'euro') return (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('de-DE') + ' €';
    return String(v);
  }

  function _ampel(q) {
    if (q == null) return null;
    if (q >= 0.75) return 'gruen';
    if (q >= 0.4) return 'gelb';
    return 'rot';
  }

  /**
   * Die sieben Kennzahlen mit Wert, Ampel und Skala.
   * Erwartet { bmr, nmr, ekr, cfMon, dscr, ltv, bewirtPctNkm }.
   * Felder, die gar nicht anwendbar sind, uebergibt der Aufrufer als
   * `null` — dann steht `wert: null` und ein Grund daneben.
   */
  function kennzahlenAmpel(d, nichtAnwendbar) {
    var na = nichtAnwendbar || {};
    var quelle = { bmr: d.bmr, nmr: d.nmr, ekr: d.ekr, cf: d.cfMon,
                   dscr: d.dscr, ltv: d.ltv, bwk: d.bewirtPctNkm };
    return KPI_SKALEN.map(function (s) {
      var id = s[0];
      if (na[id]) return { id: id, was: s[1], wert: null, ampel: null,
                           skala: s[4], entfaellt: na[id] };
      var v = +quelle[id] || 0;
      var q = s[3](v);
      return { id: id, was: s[1], wert: _kpiText(s[2], v), ampel: _ampel(q), skala: s[4] };
    });
  }

  /* ── 6 · DIE FUENF KATEGORIEN MIT IHRER SKALA ───────────────────────────
   * Woertlich die Rechenwege aus `_setQcCat()` (quick-check.js Z. 716-745).
   * Die PUNKTE kommen von `DealScore.computeFromKpis()` und werden
   * uebergeben — hier wird nichts nachgerechnet. */
  function kategorien(d, punkte, nichtAnwendbar) {
    var p = punkte || {};
    /* ── v1938 · DIESELBE NULL, ZWEITES MAL ────────────────────────────
     *
     * GEMESSEN am 07.10.2026 an der Sachsenstr. 18: die Ampel sagte
     * „entfaellt — am Objekt ist kein Darlehen hinterlegt", und zwei
     * Zeilen darunter stand in derselben Antwort „Finanzierung: LTV 0 %".
     *
     * Das ist derselbe Fehler, der in v1927a an den `kennzahlen` behoben
     * wurde — nur eine Ebene weiter. Beim Verschieben des Codes ist die
     * Beziehung „diese Zahl gilt nur unter dieser Bedingung" nicht
     * mitgewandert.
     *
     *   > Ein Befund ist erst behoben, wenn er an JEDER Stelle behoben
     *   > ist, die dieselbe Zahl anzeigt. Sonst widerspricht sich die
     *   > Antwort selbst — und die falsche Haelfte sieht genauso
     *   > sorgfaeltig aus wie die richtige.
     *
     * Die Liste der nicht anwendbaren Groessen ist deshalb DIESELBE, die
     * `kennzahlenAmpel()` bekommt, und wird vom Aufrufer einmal gebildet. */
    var na = nichtAnwendbar || {};
    /* Ohne Punkte bleibt der RECHENWEG trotzdem stehen — er haengt an den
       Kennzahlen, nicht am Score. Das ist der Fall, wenn ein gespeicherter
       Score gilt: dann hat hier keine Rechnung stattgefunden, und eine
       erfundene Teilnote waere schlimmer als eine fehlende. */
    var pz = function (v) {
      return (v == null) ? 'nicht gerechnet (der Score kommt aus DealPilot)'
                         : (Math.round(v) + ' von 100');
    };
    var zwei = function (v) { return (+v || 0).toFixed(2).replace('.', ','); };
    var cf = +d.cfMon || 0;
    return [
      { id: 'rendite', was: 'Rendite', punkte: pz(p.rendite),
        wert: zwei(d.bmr) + ' % BMR · ' + zwei(d.nmr) + ' % NMR',
        rechenweg: 'Bruttomietrendite ' + zwei(d.bmr) + ' % (Skala 3 % = 0, 7 % = 100, Gewicht 40 %) · '
          + 'Nettomietrendite ' + zwei(d.nmr) + ' % (Skala 1 % = 0, 5 % = 100, Gewicht 40 %) · '
          + 'Eigenkapitalrendite ' + (na.ekr ? ('entfällt — ' + na.ekr)
              : (zwei(d.ekr) + ' % (Skala 0 % = 0, 12 % = 100, Gewicht 20 %)')) },
      { id: 'cashflow', was: 'Cashflow', punkte: pz(p.cashflow),
        wert: (cf >= 0 ? '+' : '') + Math.round(cf).toLocaleString('de-DE') + ' €/Mon',
        rechenweg: 'Cashflow vor Steuern ' + (cf >= 0 ? '+' : '') + Math.round(cf).toLocaleString('de-DE')
          + ' €/Monat · Skala −200 €/Mon = 0 Pkt, +300 €/Mon = 100 Pkt (linear) · '
          + 'Formel: NKM − Annuität − BWK_NUL/12' },
      { id: 'sicherheit', was: 'Sicherheit', punkte: na.dscr ? '–' : pz(p.risiko),
        wert: na.dscr ? ('entfällt — ' + na.dscr) : ('DSCR ' + (d.dscr ? zwei(d.dscr) : '–')),
        rechenweg: na.dscr
          ? ('Ohne Kapitaldienst gibt es keinen Deckungsgrad — ' + na.dscr)
          : ('DSCR ' + (d.dscr ? zwei(d.dscr) : '–') + ' · Skala 0,9 = 0 Pkt, 1,5 = 100 Pkt · '
            + 'Formel: (NKM × 12 − BWK_NUL) / Annuität · Faustregel Bank: ab 1,2 guter Deckungsgrad') },
      { id: 'finanzierung', was: 'Finanzierung', punkte: na.ltv ? '–' : pz(p.ltv),
        wert: na.ltv ? ('entfällt — ' + na.ltv) : ('LTV ' + (+d.ltv || 0).toFixed(0) + ' %'),
        rechenweg: na.ltv
          ? ('Ohne Darlehen gibt es kein Loan-to-Value — ' + na.ltv)
          : ('Loan-to-Value ' + (+d.ltv || 0).toFixed(0) + ' % · Stufen: ab 100 % → 30 Pkt '
            + '(kein Eigenkapital eingesetzt = riskant), ab 90 % → 60 Pkt, ab 80 % → 80 Pkt, '
            + 'unter 80 % → 90 Pkt') },
      { id: 'bewirt', was: 'Effizienz', punkte: na.bwk ? '–' : pz(p.potenzial),
        wert: na.bwk ? ('entfällt — ' + na.bwk) : ((+d.bewirtPctNkm || 0).toFixed(0) + ' % der NKM'),
        rechenweg: na.bwk
          ? ('Ohne hinterlegte Bewirtschaftung gibt es keine Quote — ' + na.bwk)
          : ('Bewirtschaftungskosten ' + (+d.bewirtPctNkm || 0).toFixed(0) + ' % der Nettokaltmiete · '
            + 'Skala 18 % = 100 Pkt, 40 % = 30 Pkt (linear dazwischen) · IVD-Empfehlung ETW 18–35 % · '
            + 'Formel: (BWK_NUL + BWK_UL) / NKM_jährlich × 100') }
    ];
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
    stufensatz: stufensatz,         /* v1936 */
    kennzahlenAmpel: kennzahlenAmpel, /* v1936 */
    kategorien: kategorien,         /* v1936 */
    SCHWELLE: SCHWELLE
  };
})();
