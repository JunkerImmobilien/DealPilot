'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * qc-heuristik.js — v1925 · qc-v2450 (Texte, Teilnoten, Prüfliste je Objektart)
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
  /* v2232 · URTEIL UND STUFE AUF DENSELBEN GRENZEN. Marcel 14.10.2026:
     „das müssen wir angleichen mit dem Urteil und Stufe. Das muss passen."
     Hier standen 75/60/40, die Score-Stufen (score-tiers.js) brechen bei
     85/70/50/35. Gemessen: Score 39 hieß „Schwach" und „Finger weg", Score 71
     hieß „Gut" und „Kauf möglich — genauer prüfen". Jetzt:
       Gut und Sehr gut (>= 70) -> KAUFEN (bzw. VERHANDELN über Markt)
       Solide (>= 50)           -> VERHANDELN / PRUEFEN
       Schwach (>= 35)          -> KRITISCH
       Kritisch (< 35)          -> PASS
     tools/score-ketten-pruefen.mjs prüft die Gleichheit mit ScoreTier. */
  var SCHWELLE = { kaufen: 70, verhandeln: 50, kritisch: 35 };

  /* ── v1939 · DER ANGEBOTSABSCHLAG ───────────────────────────────────────
   *
   * Marcel am 07.10.2026, als Bewertungsvorgabe:
   *
   *   „Immer bedenken dass es angebotspreise sind und meistens 10 %
   *    dadrunter verkauft wird."
   *
   * Er ist DESAG-geprüfter Sachverständiger; bei Bewertungsfragen gilt
   * sein Wort. Ein Preis, der aus Angebotsdaten stammt, liegt systematisch
   * über dem, was am Ende gezahlt wird.
   *
   * ── DER SATZ STEHT HIER UND NUR HIER ─────────────────────────────────
   *
   * Eine Zahl, die an drei Stellen steht, ist an zweien irgendwann falsch.
   * `abschlagFuer()` ist die einzige Stelle, die ihn vergibt — und sie
   * nimmt die PREISART entgegen, damit er später je Quelle oder Region
   * unterschiedlich ausfallen kann, ohne dass jemand suchen muss.
   *
   * ── NICHT PAUSCHAL AUF ALLES ─────────────────────────────────────────
   *
   * GEMESSEN am 07.10.2026, woher unsere Werte kommen:
   *
   *   `svwert` am Objekt     ein VERKEHRSWERT. Das ist bereits ein Wert
   *                          und kein Angebot — ein Abschlag darauf wäre
   *                          eine zweite Minderung derselben Sache.
   *   AVM-Abruf              `pricehubble-client.js` ruft `dealType:
   *                          'sale'`, also einen Marktwert. OB dahinter
   *                          Angebots- oder Transaktionsdaten stehen,
   *                          sagt unser Code NICHT — die Art ist aus
   *                          dem, was wir haben, nicht feststellbar.
   *   manueller Eintrag      Makler, Gutachten, Notiz. Was davon, steht
   *                          im Etikett, nicht in der Zahl.
   *
   *   > Wo die Art unbekannt ist, wird nicht geraten — aber auch nicht
   *   > weggesehen. Marcels Vorgabe sagt „IMMER bedenken", und wie mit
   *   > einer unsicheren Herkunft umzugehen ist, ist genau seine
   *   > Entscheidung. Also gilt der Abschlag, UND es steht dabei, dass
   *   > die Art nicht feststellbar war.
   *
   * Der Abschlag ist damit eine ANNAHME und wird überall als solche
   * ausgewiesen. Eine bereinigte Zahl ohne ihren Abschlag sieht aus wie
   * eine gemessene. */
  var ANGEBOTSABSCHLAG = 0.10;
  /* v2237 · ab so viel Prozent unter dem bereinigten Marktwert nennt das
     Urteil den Wertpuffer („deutlich unter Markt") */
  var WERT_SCHWELLE = 10;

  /** Welcher Abschlag gilt für diese Preisart?
   *  'wert'        — Verkehrswert, Gutachten: kein Abschlag
   *  'transaktion' — belegt aus Kaufpreissammlung: kein Abschlag
   *  'angebot'     — Portal, Exposé, Vermarktung: voller Abschlag
   *  'unbekannt'   — Art nicht feststellbar: Abschlag, und es steht dabei
   */
  /* v2237 · Marcel 14.10.2026: „die Abschläge kann man im Set angeben unter
     Einstellungen, und wir recherchieren immer den aktuellen Durchschnitt."
     Der Kern liest KEINE Einstellung (er läuft auch im Backend): der Satz
     kommt als Parameter (`satz` in Prozent, `quelle` als Text). Ohne ihn
     gilt wie bisher ANGEBOTSABSCHLAG - der Telegram-Bot rechnet unverändert. */
  function abschlagFuer(preisart, satz) {
    if (preisart === 'wert' || preisart === 'transaktion') return 0;
    var s = (satz == null || satz === '') ? NaN : Number(String(satz).replace(',', '.'));
    return (isFinite(s) && s >= 0 && s < 50) ? s / 100 : ANGEBOTSABSCHLAG;
  }
  function _pctTxt(a) { return String(Math.round(a * 1000) / 10).replace('.', ',') + ' %'; }

  function _abschlagGrund(preisart, a, quelle) {
    if (preisart === 'wert') return 'Verkehrswert — kein Angebotsabschlag, das ist bereits ein Wert.';
    if (preisart === 'transaktion') return 'belegter Transaktionspreis — kein Angebotsabschlag nötig.';
    var wie = quelle ? ' (' + quelle + ')' : '';
    if (preisart === 'angebot') {
      return 'Angebotspreise — ' + _pctTxt(a) + ' Abschlag angesetzt' + wie + ', '
        + 'weil erfahrungsgemäß darunter verkauft wird.' + (quelle ? '' : ' Das ist eine ANNAHME, keine Messung.');
    }
    return 'Die Art dieser Quelle ist nicht feststellbar (Angebot oder Transaktion). '
      + 'Vorsichtshalber wie ein Angebotspreis behandelt: ' + _pctTxt(a) + ' Abschlag' + wie + '.'
      + (quelle ? '' : ' Das ist eine ANNAHME, keine Messung.');
  }

  /**
   * Der Marktwert, auf dem gerechnet wird — mit ausgewiesenem Abschlag.
   *
   * @param {number} wert      der Wert, wie die Quelle ihn nennt
   * @param {string} preisart  'wert' | 'transaktion' | 'angebot' | 'unbekannt'
   * @returns {object|null}    { roh, bereinigt, abschlag_pct, preisart, grund }
   */
  function marktwertBereinigt(wert, preisart, satz, quelle) {
    var w = +wert;
    if (!isFinite(w) || w <= 0) return null;
    var a = abschlagFuer(preisart, satz);
    return {
      roh: w,
      bereinigt: Math.round(w * (1 - a)),
      abschlag_pct: Math.round(a * 1000) / 10,
      preisart: preisart || 'unbekannt',
      grund: _abschlagGrund(preisart, a, quelle)
    };
  }

  function _fmtEur(n) {
    if (!isFinite(n)) return '—';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }
  /* qc-v2450 · Cashflow mit Vorzeichen und Tausenderpunkt („-1.250 €/Monat") */
  function _eurMon(n) {
    var r = Math.round(+n || 0);
    return (r > 0 ? '+' : '') + r.toLocaleString('de-DE') + ' €/Monat';
  }
  /* qc-v2450 · Ein Zielpreis wird auf volle 1.000 € ABgerundet gezeigt und
     gerechnet - „unter 281.149 €" ist eine Scheingenauigkeit, und ein
     aufgerundeter Zielpreis laege ueber dem, was der Deal traegt. */
  function _rund1000(x) { return Math.floor(x / 1000) * 1000; }

  /* qc-v2450 · WAS VOR DEM KAUF ZU PRUEFEN IST, HAENGT AM OBJEKT
     Hier stand fuer JEDES Objekt „Hausgeld-Aufstellung, Eigentuemerprotokolle
     der letzten 3 Jahre" - beim Ein- und Mehrfamilienhaus gibt es weder
     Hausgeld noch eine Eigentuemerversammlung. Ohne Objektart (Telegram-Bot,
     alte Aufrufer) bleibt die ETW-Liste, wie bisher. */
  function _pruefliste(objektart) {
    var a = String(objektart || '').toUpperCase();
    if (a === 'MFH' || a === 'GEWERBE')
      return 'Mietverträge und Mieterliste, Betriebskostenabrechnungen, Zustand von Dach, Heizung und Leitungen, Energieausweis';
    if (a === 'EFH' || a === 'DHH' || a === 'RH' || a === 'ZFH')
      return 'Mietvertrag, Betriebskostenabrechnung, Zustand von Dach, Heizung und Fenstern, Energieausweis';
    return 'Hausgeldabrechnung und Wirtschaftsplan, Eigentümerprotokolle der letzten 3 Jahre, Energieausweis';
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
    /* qc-v2450: „Negativer Cashflow von -124" war eine doppelte Verneinung */
    if (cfMon < 0) msgs.push('Negativer Cashflow (' + _eurMon(cfMon) + ') — der Deal kostet dich jeden Monat Geld.');
    if (dscr > 0 && dscr < 1.0) msgs.push('DSCR unter 1,0 — die Mieteinnahmen decken nicht einmal die Bankrate.');
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
  /* ══ v1956 · DIE ZIELRENDITE KOMMT JETZT VON AUSSEN ══════════════════
     Marcel am 07.10.2026: „wir nehmen eine A-Lage und da möchte ich 8
     Prozent Bruttomietrendite haben, dann geht im Quick-Check in unsere
     Bewertung mit ein, um wie viel ich den Kaufpreis verhandeln muss,
     damit ich meinen 8-Prozenter bekomme."

     Bis hierher stand da `nkmYear / 0.06` — SECHS PROZENT, fest
     verdrahtet, für jeden Kunden und jede Lage dieselbe Zahl.

     > WARUM DER WERT ALS PARAMETER KOMMT UND NICHT AUS DEN
     > EINSTELLUNGEN GELESEN WIRD: das hier ist ein RECHENKERN. Er wird
     > wörtlich ins Backend-Image gespiegelt
     > (`tools/rechenkerne-spiegeln.mjs`) und läuft dort ohne Browser,
     > ohne localStorage und ohne angemeldeten Nutzer. Ein Kern, der sich
     > seine Eingaben selbst holt, ist in dem Moment nicht mehr derselbe
     > Kern — und genau dafür gibt es die Spiegelung. Der AUFRUFER liest
     > das Lage-Profil und reicht die Zahl herein.

     Fehlt `zielBmr`, bleibt alles wie vorher: 6 %. Der Telegram-Bot
     setzt heute nichts und rechnet damit unverändert weiter.

     Geprüft wird auf ABWESENHEIT, nicht auf den Wahrheitswert.
     `Number(null)` ist 0 und besteht `isFinite` — mit `||` als Rückfall
     hätte eine 0 die 6 % ersetzt und durch null geteilt. */
  var ZIEL_BMR_RUECKFALL = 6;     /* Prozent, wenn der Aufrufer nichts sagt */

  function zielKaufpreis(d) {
    var kp = +d.kp || 0, nkm = +d.nkm || 0;
    var cfMon = +d.cfMon || 0, dscr = +d.dscr || 0;
    var nkmYear = nkm * 12;
    var zielBmr = (d.zielBmr == null || d.zielBmr === '')
      ? ZIEL_BMR_RUECKFALL
      : Number(String(d.zielBmr).replace(',', '.'));
    if (!isFinite(zielBmr) || zielBmr <= 0) zielBmr = ZIEL_BMR_RUECKFALL;
    var kpForBmr = nkmYear / (zielBmr / 100);        // KP bei der Ziel-Bruttomietrendite
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

    /* ── v1939 · DER MARKT IST DIE DRITTE OBERGRENZE ───────────────────
     *
     * Marcel am 07.10.2026: „Wenn es einen Preis gibt dann sollte man
     * diesen auch mit in die heuristic bauen. Marktpreisindikation die
     * daten mit in die heuristic übergeben und mit score zusammen
     * auswerten."
     *
     * Bis v1938 kannte die Heuristik nur zwei Deckel: den Preis, bei dem
     * die Bruttomietrendite 6 % erreicht, und den, bei dem der Cashflow
     * null wird. Beide kommen aus der MIETE. Was das Objekt am MARKT wert
     * ist, kam gar nicht vor — deshalb konnte ein Deal „KAUFEN" heißen,
     * während der Kaufpreis 22 % über dem Marktwert lag (gemessen an der
     * Hermannstr. 9 am 07.10.2026).
     *
     *   > Ein Preis, der sich aus der Miete rechnet, sagt nichts darüber,
     *   > ob man ihn am Markt auch wieder bekommt.
     *
     * `d.marktwert` ist der BEREINIGTE Wert (siehe `marktwertBereinigt`) —
     * der Abschlag ist schon drin, damit hier nicht zweimal gerechnet
     * wird. Fehlt er, bleibt alles wie vorher. */
    var markt = +d.marktwert;
    var ziel = Math.min(kpForBmr, kpForCf0);
    if (isFinite(markt) && markt > 0) ziel = Math.min(ziel, markt);
    if (!isFinite(ziel) || ziel <= 0 || ziel >= kp) {
      // Wenn KP schon unter den Zielen → keine Preissenkung nötig
      ziel = kp;
    }
    return ziel;
  }

  /* ── v1939 · WORAN ES KONKRET LIEGT ─────────────────────────────────────
   *
   * Marcel am 07.10.2026: „wenn es geprüft werden muss soll es da stehen.
   * aber wichtig ist der Grund."
   *
   * Der PRUEFEN-Rat sagte bis v1938 „die Schwäche steckt woanders
   * (Bewirtschaftung, Finanzierung, LTV)" — eine Aufzählung aller
   * Möglichkeiten ist kein Grund. Hier wird die SCHWÄCHSTE Größe gesucht
   * und beim Namen genannt, mit ihrem Wert.
   *
   *   > „Irgendwo anders" ist kein Befund. Ein Befund zeigt auf eine Zahl.
   *
   * Gewertet wird über dieselben Skalen, die auch die Ampel benutzt —
   * kein zweiter Maßstab. Was nicht anwendbar ist, kann auch nicht
   * schwach sein und wird übersprungen.
   */
  /* ── qc-v2450 · DER GRUND MUSS IM SCORE STECKEN ─────────────────────────
     GEMESSEN am 20.10.2026 (ETW 120.000 €, Miete 650 €, Hausgeld 220 €,
     LTV 90 %, Score 67): „Der Score bleibt im Mittelfeld, und zwar wegen
     Bewirtschaftungsquote (34 %) und LTV (90 %)". Die Bewirtschaftungsquote
     geht in DealScore.computeFromKpis gar nicht ein (Cashflow, NMR, LTV,
     DSCR, Wertpuffer) - der genannte Grund war keiner. Der eigentliche,
     der Wertpuffer ohne Marktwert (30 von 100 Punkten), kam nicht vor.
     Liefert der Aufrufer die TEILNOTEN des Scores (`d.teilnoten`, Schluessel
     wie in DealScore: cashflow, rendite, ltv, risiko, potenzial), werden
     genau sie gereiht. Ohne sie (Telegram-Bot) bleibt der alte Weg. */
  var TEILNOTEN = [
    ['cashflow',  'Cashflow'],
    ['rendite',   'Nettomietrendite'],
    ['ltv',       'LTV'],
    ['risiko',    'DSCR'],
    ['potenzial', 'Wertpuffer']
  ];
  function _teilnotenPunkte(d, na) {
    var t = d.teilnoten, liste = [];
    TEILNOTEN.forEach(function (x) {
      var p = t[x[0]];
      if (p == null || !isFinite(+p)) return;            /* Barkauf: LTV/DSCR entfallen */
      if (x[0] === 'ltv' && na.ltv) return;
      if (x[0] === 'risiko' && na.dscr) return;
      var wert;
      if (x[0] === 'cashflow') wert = _eurMon(d.cfMon);
      else if (x[0] === 'rendite') wert = _kpiText('prozent', +d.nmr || 0);
      else if (x[0] === 'ltv') wert = _kpiText('prozent0', +d.ltv || 0);
      else if (x[0] === 'risiko') wert = _kpiText('zahl2', +d.dscr || 0);
      else wert = (isFinite(+d.marktwert) && +d.marktwert > 0)
        ? ((+d.marktwert >= +d.kp ? '+' : '') + _fmtEur(+d.marktwert - (+d.kp || 0)))
        : 'kein Marktwert abgerufen';
      liste.push({ id: x[0], was: x[1], wert: wert + ', ' + Math.round(+p) + ' von 100 Punkten', guete: (+p) / 100 });
    });
    return liste;
  }

  function schwaechstePunkte(d, nichtAnwendbar, wieviele) {
    var na = nichtAnwendbar || {};
    if (d && d.teilnoten && typeof d.teilnoten === 'object') {
      var tl = _teilnotenPunkte(d, na);
      tl.sort(function (a, b) { return a.guete - b.guete; });
      return tl.slice(0, wieviele || 2);
    }
    var quelle = { bmr: d.bmr, nmr: d.nmr, ekr: d.ekr, cf: d.cfMon,
                   dscr: d.dscr, ltv: d.ltv, bwk: d.bewirtPctNkm };
    var liste = [];
    KPI_SKALEN.forEach(function (s) {
      if (na[s[0]]) return;
      var v = +quelle[s[0]] || 0;
      /* v2143: dieselbe Guete wie in der Ampel - sonst nennt der Satz
         „die schwaechste Groesse" eine andere als die rote Ampel
         darueber, und beide stehen auf demselben Bildschirm. */
      var zg = (s[0] === 'bmr') ? _zielGuete(v, d.zielBmr) : null;
      liste.push({ id: s[0], was: s[1], wert: _kpiText(s[2], v),
                   guete: (zg != null) ? zg : s[3](v) });
    });
    liste.sort(function (a, b) { return a.guete - b.guete; });
    return liste.slice(0, wieviele || 2);
  }

  /** Die schwächsten Größen als Satzteil — „die Eigenkapitalrendite
   *  (0,00 %) und der LTV (91 %)". */
  function _schwachSatz(d, na) {
    var s = schwaechstePunkte(d, na, 2).filter(function (x) { return x.guete < 0.75; });
    if (!s.length) return null;
    return s.map(function (x) { return x.was + ' (' + x.wert + ')'; })
      .join(s.length > 1 ? ' und ' : '');
  }

  /* qc-v2450 · Was man an der schwaechsten Groesse TUN kann. Vorher stand
     unter jedem Grund dieselbe Liste (Hausgeld, Protokolle, Energieausweis) -
     auch wenn der Grund der LTV war. */
  function _hebel(d, na) {
    var s = schwaechstePunkte(d, na, 2).filter(function (x) { return x.guete < 0.75; });
    var h = [];
    s.forEach(function (x) {
      if (x.id === 'ltv') h.push('mehr Eigenkapital senkt den LTV');
      else if (x.id === 'potenzial') h.push((isFinite(+d.marktwert) && +d.marktwert > 0)
        ? 'der Preis liegt kaum unter dem Marktwert' : 'ein Marktwert-Abruf zeigt, ob ein Wertpuffer da ist');
      else if (x.id === 'cashflow' || x.id === 'risiko' || x.id === 'cf' || x.id === 'dscr') h.push('Miete, Zins und Tilgung entscheiden über Cashflow und DSCR');
      else if (x.id === 'rendite' || x.id === 'nmr' || x.id === 'bwk') h.push('Miete und nicht umlagefähige Kosten prüfen');
    });
    var u = h.filter(function (x, i) { return h.indexOf(x) === i; });
    return u.length ? (u.join('; ').replace(/^./, function (c) { return c.toUpperCase(); }) + '. ') : '';
  }

  /* ── 3 · DIE KAUFEMPFEHLUNG ─────────────────────────────────────────────
   * Woertlich aus quick-check.js (_renderQcRecommendation, Z. 909–953).
   * `betont` zeichnet den Kaufpreis aus — im Browser `<strong>`, im Chat
   * gar nicht. */
  /* ── v2546a · GUENSTIG GEKAUFT, ABER DIE RECHNUNG TRAEGT NICHT ──────────
   *
   * Marcel 21.10.2026 (Sachsenstr. 18, Herford): „da kam ein Dealscore von
   * 26 raus, und die Bewertung sagt nicht kaufen, aber 18 % unter Markt. Das
   * ist widersprüchlich und müsste genauer erklärt werden, warum wir das so
   * entscheiden."
   *
   * Gemessen: KP 180.000, Marktwert 213.000 (+18 %), Miete 750, Hausgeld 400,
   * Zins 4,31 + 1,5 % Tilgung, 100 % finanziert -> Cashflow −362 €/Monat,
   * DSCR 0,76. Beide Aussagen waren richtig gerechnet, der Text darunter
   * sagte aber „Ein Preis klar unter Markt ist ein zusätzliches Argument für
   * den Kauf" - direkt unter „Finger weg". Fuer die beiden Absage-Stufen
   * steht jetzt, WARUM der Preisabstand nicht reicht, mit den Treibern in
   * Zahlen. Der Score bleibt unberuehrt. */
  function _warumTrotzdemNicht(d, cfMon, b) {
    var t = [];
    if (cfMon < 0) t.push('Cashflow ' + b(_eurMon(cfMon)));
    if (+d.dscr > 0 && +d.dscr < 1) t.push('DSCR ' + b((+d.dscr).toFixed(2).replace('.', ',')) + ' (die Miete deckt die Rate nicht)');
    if (+d.nmr > 0) t.push('Nettomietrendite ' + b((Math.round(+d.nmr * 10) / 10).toFixed(1).replace('.', ',') + ' %'));
    return 'Warum trotzdem nicht: der Preisabstand ist ein Wert auf dem Papier, er zahlt keine Monatsrate. ' +
      (t.length ? 'Als Kapitalanlage trägt die Rechnung nicht — ' + t.join(', ') + '. ' : '') +
      'Der Puffer hilft erst beim Verkauf oder als Sicherheit gegenüber der Bank; bis dahin musst du die Lücke jeden Monat selbst zahlen. ' +
      'Mit mehr Eigenkapital, besserer Miete oder niedrigerem Zins kann das Bild kippen — dann neu rechnen.';
  }

  function empfehlung(d, betont, nichtAnwendbar) {
    var b = (typeof betont === 'function') ? betont : function (s) { return s; };
    var na = nichtAnwendbar || {};
    var score = +d.score;
    var kp = +d.kp || 0, cfMon = +d.cfMon || 0;
    var ziel = zielKaufpreis(d);
    if (ziel < kp) ziel = _rund1000(ziel);                /* qc-v2450 */
    var liste = _pruefliste(d.objektart);
    var markt = +d.marktwert;
    var ueberMarkt = (isFinite(markt) && markt > 0 && kp > markt);
    var verdict, farbklasse, advice;

    if (score >= SCHWELLE.kaufen && !ueberMarkt) {
      verdict = 'KAUFEN';
      farbklasse = 'qc-rec-green';
      advice = 'Die Kennzahlen passen — Kauf bei ' + b(_fmtEur(kp)) + ' ist gerechtfertigt. ' +
               (isFinite(markt) && markt > 0
                 ? 'Der Preis liegt auch nicht über dem Marktwert. ' : '') +
               'Vor dem Kaufvertrag noch: Finanzierungszusage einholen und ' + liste + ' prüfen.';
    } else if (score >= SCHWELLE.kaufen && ueberMarkt) {
      /* ── v1939 · DER SCORE SAGT JA, DER MARKT SAGT ZU TEUER ──────────
       *
       * Marcel: „Marktpreisindikation … mit score zusammen auswerten."
       *
       * GEMESSEN an der Hermannstr. 9 (Score 83): Empfehlung KAUFEN, und
       * der Kaufpreis lag 22 % über dem Marktwert. Beides stand in
       * derselben Antwort, und keins war falsch gerechnet — der Score
       * kennt den Markt nur nicht.
       *
       *   > Ein guter Score sagt, dass die Rechnung aufgeht. Er sagt
       *   > nicht, dass der Preis stimmt. Wer über Markt kauft, zahlt die
       *   > Differenz beim Wiederverkauf — unabhaengig vom Cashflow.
       *
       * Ein Preis über Markt ist ein PREISproblem, und dafür gibt es ein
       * Wort: verhandeln. Der SCORE bleibt unangetastet; nur das Urteil
       * nimmt den Markt dazu. */
      verdict = 'VERHANDELN';
      farbklasse = 'qc-rec-gold';
      var ueber = Math.round((kp / markt - 1) * 100);
      advice = 'Die Kennzahlen passen — aber der Preis nicht: ' + _fmtEur(kp) + ' liegen ' +
               ueber + ' % über dem Marktwert von ' + b(_fmtEur(markt)) + '. ' +
               (d.marktwert_grund ? d.marktwert_grund + ' ' : '') +
               'Der laufende Ertrag trägt das, der Wiederverkauf nicht. ' +
               'Empfehlung: auf ' + b(_fmtEur(ziel)) + ' oder darunter verhandeln — ' +
               'bei diesen Kennzahlen hast du das Argument auf deiner Seite.';
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
        advice = 'Solide, aber mit Spielraum beim Preis. Bei einem Kaufpreis von ' + b(_fmtEur(ziel)) + ' ' +
                 '(' + diffPct + ' % Nachlass = ' + _fmtEur(diffEur) + ' weniger) trägt sich der Deal deutlich besser. ' +
                 'Empfehlung: den Kaufpreis herunterhandeln oder prüfen, ob sich die Miete steigern lässt.';
      } else {
        /* ── v1939 · DER GRUND IST DAS WICHTIGE ──────────────────────────
         * Marcel: „wenn es geprüft werden muss soll es da stehen. aber
         * wichtig ist der Grund." Hier stand bis v1938 „die Schwäche
         * steckt woanders (Bewirtschaftung, Finanzierung, LTV)" — eine
         * Aufzählung aller Möglichkeiten ist kein Grund. Jetzt wird die
         * schwächste Größe beim Namen genannt, mit ihrem Wert. */
        verdict = 'PRUEFEN';
        farbklasse = 'qc-rec-gold';
        var schwach = _schwachSatz(d, na);
        advice = 'Solide Kennzahlen, und der Preis ist nicht das Problem — er liegt schon ' +
                 'unter dem, was dieser Deal tragen würde' +
                 ((isFinite(markt) && markt > 0) ? ' und auch nicht über dem Marktwert' : '') + '. ' +
                 'Der Score bleibt trotzdem im Mittelfeld, ' +
                 (schwach ? 'Punkte kosten vor allem ' + b(schwach) : 'weil keine Teilnote heraussticht — es ist das Zusammenspiel') + '. ' +
                 _hebel(d, na) +
                 'Vor dem Kauf: ' + liste + ' prüfen.';
      }
    } else if (score >= SCHWELLE.kritisch) {
      verdict = 'KRITISCH';
      farbklasse = 'qc-rec-red';
      if (ziel < kp) {
        var diffPct2 = Math.round((1 - ziel / kp) * 100);
        var diffEur2 = Math.round(kp - ziel);
        advice = 'Die Kennzahlen sind zu schwach. Damit es ein Investment wird, müsste der Kaufpreis auf ' +
                 b(_fmtEur(ziel)) + ' (' + diffPct2 + ' % Nachlass = ' + _fmtEur(diffEur2) + ' weniger) sinken — ' +
                 'oder die Miete deutlich steigen. ' +
                 (cfMon < 0 ? 'Der Cashflow ist negativ (' + _eurMon(cfMon) + ') — ein klares Warnsignal. ' : '') +
                 'Eher absagen oder hart verhandeln.';
      } else {
        /* qc-v2450: hier stand die Aufzaehlung „(Bewirtschaftung, Finanzierung,
           LTV)" - derselbe Nicht-Grund, den v1939 im PRUEFEN-Zweig ersetzt hat. */
        var schwach2 = _schwachSatz(d, na);
        advice = 'Die Kennzahlen sind schwach, obwohl der Preis angemessen ist' +
                 (schwach2 ? ' — Punkte kosten vor allem ' + b(schwach2) : '') + '. ' +
                 (cfMon < 0 ? 'Der Cashflow ist negativ (' + _eurMon(cfMon) + '). ' : '') +
                 'Empfehlung: mehr Eigenkapital, bessere Konditionen oder ein anderes Objekt.';
      }
    } else {
      verdict = 'PASS';
      farbklasse = 'qc-rec-red';
      /* qc-v2450: „Klares Pass" ist kein Deutsch, und „bessere Substanz" meint
         das Gebaeude - geurteilt wird hier aber ueber die Zahlen. */
      advice = 'Klare Absage — die Kennzahlen sind so weit von solide entfernt, dass auch starkes Verhandeln das nicht rettet. ' +
               (ziel < kp ? 'Erst bei einem Kaufpreis um ' + b(_fmtEur(ziel)) + ' käme die Rechnung in Reichweite. ' : '') +
               'Empfehlung: weitersuchen.';
    }

    /* ── v2226 · DIE LAGE GEHÖRT INS URTEIL, NICHT IN DEN SCORE ──────────
     *
     * Marcel 14.10.2026: „nicht in den Score [dann ist es nicht mehr
     * vergleichbar], aber in die Gesamtbewertung. Wenn der Kauf aufgrund
     * der Lage nicht passt, muss drauf hingewiesen werden ganz oben und
     * nicht kaufen gesagt werden, aber auch gesagt werden, warum der Deal
     * trotzdem gut ist, falls das so ist."
     *
     * Gemessen vorher: die Lage stand nur in der „Meinung" unten („knapp
     * unter deinem Ziel von 7,0 % für die C-Lage"), das Urteil oben blieb
     * davon unberührt. Jetzt: liegt die Bruttomietrendite UNTER der
     * Zielrendite der gewählten Lageklasse (Ampel gelb oder rot aus
     * zielUrteil - dieselbe Entscheidung wie dort), heißt das Urteil
     * NICHT KAUFEN, mit Grund, Preis und - wenn die Rechnung sonst trägt -
     * dem ausdrücklichen „trotzdem". Der Score bleibt unverändert.
     * Nur mit gewählter Klasse: ohne Klasse gibt es keinen Maßstab. */
    var lage = null;
    if (d.lageklasse && d.zielBmr != null && d.zielBmr !== '' && +d.nkm > 0 && kp > 0) {
      var bmrIst = (+d.bmr > 0) ? +d.bmr : (+d.nkm * 12 / kp * 100);
      var zu = zielUrteil(bmrIst, d.zielBmr, d.lageklasse);
      if (zu && (zu.ampel === 'rot' || zu.ampel === 'gelb')) {
        /* ungerundet: derselbe Wert wie kpForBmr in zielKaufpreis - sonst
           stünden 131.000 € und 131.314 € im selben Absatz */
        var kpLage = _rund1000((+d.nkm * 12) / (zu.ziel / 100));   /* qc-v2450: wie ziel abgerundet */
        var pct = function (x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ',') + ' %'; };
        /* qc-v2450: das Ziel mit zwei Stellen wie im Skalensatz (v2148c) - sonst „3,8 %" bei gerechneten 3,75 */
        var zielT = zu.ziel.toFixed(2).replace(/0$/, '').replace(/\.$/, '').replace('.', ',') + ' %';
        var lageSatz = 'Für die ' + zu.klasse + '-Lage zu wenig Rendite: ' + b(pct(bmrIst)) + ' brutto statt deiner ' +
                       zielT + ' (' + zu.wort + '). ';
        var preisSatz = (kpLage > 0 && kpLage < kp)
          ? 'Deine Zielrendite erreicht er erst bei einem Kaufpreis von ' + b(_fmtEur(kpLage)) + ' oder darunter. ' : '';
        var trotzdem = '';
        if (score >= SCHWELLE.verhandeln) {
          trotzdem = 'Rechnerisch trägt der Deal trotzdem' + (score >= SCHWELLE.kaufen ? ' gut' : '') + ': Score ' + Math.round(score) +
                     (cfMon >= 0 ? ', Cashflow ' + _eurMon(cfMon) : '') +
                     ((+d.dscr > 0) ? ', DSCR ' + (+d.dscr).toFixed(2).replace('.', ',') : '') +
                     ' — er passt nur nicht zu deinem Maßstab für diese Lage. ';
        }
        lage = { passt: false, klasse: zu.klasse, ziel: zu.ziel, ist: bmrIst, wort: zu.wort, kp_ziel: kpLage };
        if (verdict === 'KAUFEN' || verdict === 'VERHANDELN' || verdict === 'PRUEFEN') {
          verdict = 'NICHT KAUFEN';
          farbklasse = 'qc-rec-red';
          advice = lageSatz + preisSatz + trotzdem;
        } else {
          advice = lageSatz + preisSatz + advice;
        }
      } else if (zu) {
        lage = { passt: true, klasse: zu.klasse, ziel: zu.ziel, ist: bmrIst, wort: zu.wort };
      }
    }

    /* ── v2237 · ÜBER DEN EIGENEN MASSSTAB HINAUS ─────────────────────────
     *
     * Marcel 14.10.2026: „die Bewertung soll aussagekräftig sein — nach
     * eigenen Kriterien und auch darüber. Die Wohnung, bei der die Lageklasse
     * nicht passte, aber der Kauf trotzdem sinnvoll ist."
     *
     * Gemessen am Rundgang-Objekt (139.000 €, DealPilot Ø 189.000 €): das
     * Urteil sagte nur „Nicht kaufen — Rendite unter deinem Ziel"; dass der
     * Preis rund 28 % unter dem realistischen Marktwert lag, kam nirgends
     * vor. Das Urteil nach dem eigenen Maßstab BLEIBT (oben, unverändert),
     * die zweite Sicht kommt dazu: liegt der Kaufpreis deutlich (ab
     * WERT_SCHWELLE) unter dem bereinigten Marktwert, steht der Wertpuffer
     * dabei - und bei verfehlter Lage-Rendite das ausdrückliche „trotzdem".
     * `d.marktwert` ist schon bereinigt (Angebotsabschlag drin). */
    var wert = null;
    if (isFinite(markt) && markt > 0 && kp > 0 && (markt - kp) / kp * 100 >= WERT_SCHWELLE) {
      var puffer = markt - kp, pp = Math.round((markt - kp) / kp * 100);
      wert = { marktwert: markt, puffer: puffer, pct: pp };
      advice = String(advice || '').replace(/\s*$/, ' ') + 'Über deinen Maßstab hinaus: gekauft für ' + _fmtEur(kp) + ', realistisch wert rund ' + b(_fmtEur(markt)) +
        ' — ' + b('+' + _fmtEur(puffer)) + ' (+' + pp + ' %) Wertpuffer ab dem ersten Tag. ' +
        ((lage && !lage.passt)
          ? 'Als Renditeobjekt passt er nicht zu deiner ' + lage.klasse + '-Lage, als Substanzkauf kann er sich trotzdem lohnen.'
          : (verdict === 'PASS' || verdict === 'KRITISCH')
            ? _warumTrotzdemNicht(d, cfMon, b)
            : 'Ein Preis klar unter Markt ist ein zusätzliches Argument für den Kauf.');
    }

    return { verdict: verdict, farbklasse: farbklasse, text: advice, ziel_kp: ziel, lage: lage, wert: wert };
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

  /* v2143 · Die Guete der Bruttomietrendite AM ZIEL DER LAGEKLASSE.
     Gibt null zurueck, wenn kein Ziel vorliegt - dann greift die feste
     Skala aus KPI_SKALEN weiter. */
  function _zielGuete(erreicht, ziel) {
    if (ziel == null || ziel === '') return null;
    var z = Number(String(ziel).replace(',', '.'));
    if (!isFinite(z) || z <= 0) return null;
    var e = Number(erreicht);
    if (!isFinite(e) || e <= 0) return 0;
    var q = e / z;
    /* v2143a · DIE KNICKPUNKTE LIEGEN NICHT AUF DEN AMPELSCHWELLEN.

       Erster Entwurf begann bei 0,6 und traf damit bei genau 80 % des
       Ziels die Guete 0,3994 - die Gelb-Schwelle liegt bei 0,40. Ein
       Tausendstel, und die Ampel sprang auf Rot. Eine Grenze, die auf
       einer anderen Grenze liegt, entscheidet per Rundung.

       Jetzt beginnt die Skala bei 0,5, und die Ampelwechsel liegen
       dazwischen statt auf einem Knick:

         unter 75 % des Ziels    rot
         75 bis 97 %             gelb
         ab 97 %                 gruen   (Ziel erreicht = 0,80)
         ab 130 %                volle Punktzahl

       Und fachlich ist es besser: wer 60 % seiner Zielrendite
       erreicht, hat kein wertloses Objekt. */
    if (q <= 0.5) return 0;
    if (q >= 1.3) return 1;
    if (q <= 1.0) return (q - 0.5) / 0.5 * 0.8;
    return 0.8 + (q - 1.0) / 0.3 * 0.2;
  }

  /* Der Satz unter der Ampel, wenn ein Ziel gilt. Er nennt BEIDE
     Zahlen - das Ziel und das Erreichte -, weil eine Note ohne ihren
     Massstab nicht nachvollziehbar ist. */
  function _zielSkala(ziel, klasse) {
    var z = Number(String(ziel).replace(',', '.'));
    var k = klasse ? String(klasse).toUpperCase().charAt(0) : '';
    /* ── v2148c · DER GENANNTE MASSSTAB MUSS DER GERECHNETE SEIN ───────

       Hier stand `toFixed(1)`. GEMESSEN an Marcels eigenem Profil auf
       Staging: sein A-Ziel steht auf **3,75 %**, der Satz sagte „Ziel
       3,8 %" — gerechnet wurde mit 3,75.

       > Eine Note mit ihrem Massstab daneben ist nur dann
       > nachvollziehbar, wenn der genannte Massstab der gerechnete ist.
       > Wer bei 3,78 % nachprueft, findet sonst einen Widerspruch, der
       > keiner ist — und glaubt der Ampel nicht mehr.

       Zwei Nachkommastellen, die ueberfluessige Null faellt weg: 5 wird
       „5", 3,75 bleibt „3,75", 3,5 wird „3,5". */
    var zs = z.toFixed(2).replace(/0$/, '').replace(/[.,]$/, '').replace('.', ',');
    return 'Ziel ' + zs + ' %'
      + (k === 'A' || k === 'B' || k === 'C' ? ' (' + k + '-Lage)' : '')
      + ' erreicht = gruen · ab 75 % gelb · 130 % = volle Punktzahl';
  }

  function _ampel(q) {
    if (q == null) return null;
    if (q >= 0.75) return 'gruen';
    if (q >= 0.4) return 'gelb';
    return 'rot';
  }

  /* ══ v2148 · DAS ZIELURTEIL IN WORTEN — EINE STELLE ══════════════════

     Marcel am 12.10.2026: „Das muss auch mit in die Bewertung im Quick
     Check unten weil der Investor ja lesen möchte und bewerten möchte
     ob der deal passt."

     GEMESSEN, warum das noetig war: `composeOpinion()` im Quick-Check
     (quickcheck-app.html:5479) beurteilte die Bruttomietrendite an
     FESTEN Schwellen — „ab 5,5 % gut, ueber dem deutschen Durchschnitt
     (~4,5 %)". Die Lageklasse kam dort nicht vor. Ein Investor mit
     C-Lage-Ziel 7 % las also „gut" bei 5,6 %, obwohl er sein Ziel um
     ein Fuenftel verfehlt.

     > **Und das Gegenteil ist schlimmer:** in A-Lage mit Ziel 3,5 % hiess
     > eine 4,0 % „unterdurchschnittlich und braucht Mietsteigerung oder
     > Kaufpreis-Reduktion" — bei 114 % des eigenen Ziels.

     ── WARUM DIE WORTE HIERHER GEHOEREN ────────────────────────────────

     Zwei Zeilen ueber jener Stelle steht der Befund von v1945: dort
     stand schon einmal die DRITTE Kopie derselben Schwellen, und sie
     widersprach dem Urteil zwei Zentimeter darueber. Wer jetzt dort
     „ab 75 % gelb" hinschreibt, baut die VIERTE.

     Darum liefert diese Funktion das Wort mit — sie ist dieselbe
     Quelle, aus der schon die Ampel und der Skalensatz kommen. Die
     Schwellen stehen genau einmal, in `_zielGuete`.

     ── UND SIE LIEST NICHTS ────────────────────────────────────────────

     `ziel` kommt als PARAMETER. Der Kern laeuft im Backend ohne
     Browser und ohne `DealPilotLageProfil` — wer sich seine Eingaben
     selbst holt, ist dort nicht mehr derselbe Kern. */
  function zielUrteil(bmr, ziel, klasse) {
    var g = _zielGuete(bmr, ziel);
    if (g == null) return null;                    /* kein Ziel -> der Aufrufer bleibt bei seiner festen Skala */
    var e = Number(bmr), z = Number(String(ziel).replace(',', '.'));
    var q = (isFinite(e) && z > 0) ? e / z : 0;
    var amp = _ampel(g);

    /* ── DAS WORT HAENGT AN DER AMPEL, NICHT AN EIGENEN SCHWELLEN ──────

       Erster Entwurf liess das Wort bei q >= 0,97 auf „am Ziel"
       springen. GEMESSEN mit `tools/zielurteil-pruefen.mjs`:

         q = 0,9699  ->  Guete 0,7518  ->  Ampel GRUEN
                         Wort „knapp unter deinem Ziel"

       Die Ampel kippt bei Guete 0,75, das heisst bei q = 0,96875. In
       der Luecke von 1,25 Promille stand eine gruene Ampel neben
       „knapp unter deinem Ziel".

       > **Die Grenze auf 0,96875 zu ziehen waere der falsche Weg** —
       > dann liegt sie wieder GENAU auf einer anderen Grenze, und
       > genau daran ist v2143 einmal gescheitert. Zwei Zahlenreihen,
       > die dasselbe beschreiben, laufen irgendwann auseinander.

       Deshalb leitet sich das Wort jetzt AUS DER AMPEL ab. Rot, gelb
       und gruen koennen nicht mehr etwas anderes sagen als der Text —
       sie sind dieselbe Entscheidung. Nur innerhalb von Gruen wird
       noch unterschieden, weil die Ampel oben nicht weiterzaehlt:
       1,15 ist dort die EINZIGE eigene Grenze. */
    var wort, satz;
    if (amp === 'rot')       { wort = 'deutlich unter deinem Ziel'; satz = 'Entweder der Preis muss fallen oder die Miete steigen.'; }
    /* qc-v2450: „die Lücke ist klein" stand auch bei 77 % des Ziels (2,9 statt
       3,75 %) - dort muesste der Preis um 22 % fallen. Das Wort bleibt (es haengt
       an der Ampel), der Satz sagt die Groesse nur, wo sie stimmt. */
    /* v2485 · Marcel 20.10.2026 („ja" zu einem deutlicheren Wort): „knapp" nur
       ab 90 % des Ziels. Darunter (75-90 %) heisst es „deutlich unter", die Ampel
       bleibt GELB - 0,9 liegt auf keiner Ampelgrenze (0,75 / 0,96875), und die
       Satzgrenze war schon dieselbe (qc-v2450). */
    else if (amp === 'gelb') {
      if (q >= 0.9) { wort = 'knapp unter deinem Ziel';    satz = 'Erreichbar über den Preis oder die Miete — die Lücke ist klein.'; }
      else          { wort = 'deutlich unter deinem Ziel'; satz = 'Erreichbar über den Preis oder die Miete — dafür muss sich spürbar etwas bewegen.'; }
    }
    else if (q >= 1.15)      { wort = 'deutlich über deinem Ziel';  satz = 'Das ist Spielraum — beim Preis oder bei der Qualität des Objekts.'; }
    else                     { wort = 'am Ziel';                    satz = 'Genau das, was du für diese Lage angesetzt hast.'; }
    return {
      guete: g,
      ampel: amp,
      quote: q,
      wort: wort,
      satz: satz,
      skala: _zielSkala(ziel, klasse),
      ziel: z,
      klasse: klasse ? String(klasse).toUpperCase().charAt(0) : null
    };
  }

  /**
   * Die sieben Kennzahlen mit Wert, Ampel und Skala.
   * Erwartet { bmr, nmr, ekr, cfMon, dscr, ltv, bewirtPctNkm }.
   * Felder, die gar nicht anwendbar sind, uebergibt der Aufrufer als
   * `null` — dann steht `wert: null` und ein Grund daneben.
   */
  /* ══ v2240 · DIE PERSOENLICHEN MINDEST-SCHWELLEN ALS PARAMETER ══════
     Marcels Entscheidung „Alle Ampeln": min_dscr, max_ltv und
     min_cashflow_vor_st aus den Einstellungen steuern auch diese Ampel.
     Der Kern liest sie NIE selbst (er laeuft im Backend ohne Browser) -
     der Aufrufer uebergibt { dscrGruen, dscrGelb, ltvGruen, ltvRot,
     cfGruen, cfGelb } (im Browser DealPilotSchwellen.get()).

     Ohne Parameter bleibt alles wie bisher: die Ampel folgt der
     Punkte-Skala aus KPI_SKALEN. Das ist der Weg des Backends, das kein
     Investmentprofil kennt. Der SCORE bleibt in beiden Faellen
     unberuehrt - die Schwellen faerben, sie rechnen nicht. */
  function _schwellenOk(sw) {
    if (!sw || typeof sw !== 'object') return null;
    function n(x, rf) { var z = Number(x); return (x != null && x !== '' && isFinite(z)) ? z : rf; }
    var g = n(sw.dscrGruen, 1.2); if (!(g > 0)) g = 1.2;
    var y = n(sw.dscrGelb, Math.min(1.0, g)); if (y > g) y = g;
    var lg = n(sw.ltvGruen, 90); if (!(lg > 0)) lg = 90;
    var lr = n(sw.ltvRot, Math.max(100, lg)); if (lr < lg) lr = lg;
    var cg = n(sw.cfGruen, n(sw.cfMin, 0));
    var cy = n(sw.cfGelb, Math.min(0, cg)); if (cy > cg) cy = cg;
    return { dscrGruen: g, dscrGelb: y, ltvGruen: lg, ltvRot: lr, cfGruen: cg, cfGelb: cy };
  }
  function _z2(n) { return n.toFixed(2).replace('.', ','); }
  function _z1(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }
  function _eu(n) { return (n > 0 ? '+' : '') + Math.round(n).toLocaleString('de-DE') + ' €/Mon'; }
  function _schwellenAmpel(id, v, sw) {
    if (id === 'dscr') return {
      ampel: v >= sw.dscrGruen ? 'gruen' : v >= sw.dscrGelb ? 'gelb' : 'rot',
      skala: 'grün ab ' + _z2(sw.dscrGruen) + ' (deine Mindest-Schwelle)'
        + (sw.dscrGelb < sw.dscrGruen ? ' · gelb ab ' + _z2(sw.dscrGelb) : '') + ' · darunter rot' };
    if (id === 'ltv') return {
      ampel: v <= sw.ltvGruen ? 'gruen' : v <= sw.ltvRot ? 'gelb' : 'rot',
      skala: 'grün bis ' + _z1(sw.ltvGruen) + ' % (dein Maximal-LTV)'
        + (sw.ltvRot > sw.ltvGruen ? ' · gelb bis ' + _z1(sw.ltvRot) + ' %' : '') + ' · darüber rot' };
    if (id === 'cf') return {
      ampel: v >= sw.cfGruen ? 'gruen' : v >= sw.cfGelb ? 'gelb' : 'rot',
      skala: 'grün ab ' + _eu(sw.cfGruen) + ' (dein Mindest-Cashflow vor Steuer)'
        + (sw.cfGelb < sw.cfGruen ? ' · gelb ab ' + _eu(sw.cfGelb) : '') + ' · darunter rot' };
    return null;
  }

  function kennzahlenAmpel(d, nichtAnwendbar, schwellen) {
    var na = nichtAnwendbar || {};
    var sw = _schwellenOk(schwellen);
    var quelle = { bmr: d.bmr, nmr: d.nmr, ekr: d.ekr, cf: d.cfMon,
                   dscr: d.dscr, ltv: d.ltv, bwk: d.bewirtPctNkm };
    return KPI_SKALEN.map(function (s) {
      var id = s[0];
      if (na[id]) return { id: id, was: s[1], wert: null, ampel: null,
                           skala: s[4], entfaellt: na[id] };
      var v = +quelle[id] || 0;
      var sa = sw ? _schwellenAmpel(id, v, sw) : null;
      if (sa) return { id: id, was: s[1], wert: _kpiText(s[2], v), ampel: sa.ampel,
                       skala: sa.skala, am_schwelle: true };
      /* ══ v2143 · DIE BRUTTOMIETRENDITE MISST AM ZIEL DER LAGE ══════
         Nur sie: die Lageklasse ist in BRUTTOmietrendite definiert
         (lage-profil.js VORGABE), und die anderen Groessen haben mit
         ihr nichts zu tun. Fehlt das Ziel, bleibt die feste Skala.

         Der SCORE bleibt unberuehrt - diese Ampel ist Anzeige, und
         `kategorien()` nimmt die Punkte aus DealScore. */
      var zg = (id === 'bmr') ? _zielGuete(v, d.zielBmr) : null;
      var q = (zg != null) ? zg : s[3](v);
      return { id: id, was: s[1], wert: _kpiText(s[2], v), ampel: _ampel(q),
               skala: (zg != null) ? _zielSkala(d.zielBmr, d.lageklasse) : s[4],
               /* Damit die Anzeige sagen kann, WORAN gemessen wurde. */
               am_ziel: (zg != null) ? true : undefined };
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
  function bewerten(d, betont, nichtAnwendbar) {
    var e = (d && isFinite(+d.score) && (+d.kp) && (+d.nkm))
      ? empfehlung(d, betont, nichtAnwendbar)
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
    marktwertBereinigt: marktwertBereinigt, /* v1939 */
    schwaechstePunkte: schwaechstePunkte,   /* v1939 */
    abschlagFuer: abschlagFuer,             /* v1939 */
    ANGEBOTSABSCHLAG: ANGEBOTSABSCHLAG,     /* v1939 */
    kennzahlenAmpel: kennzahlenAmpel, /* v1936 */
    kategorien: kategorien,         /* v1936 */
    zielUrteil: zielUrteil,         /* v2148 */
    SCHWELLE: SCHWELLE
  };
})();
