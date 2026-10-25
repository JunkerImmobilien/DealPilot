/* V279-debounced: Single debounced POST fuer tax-snapshots */
(function(){
  var _timer = null;
  var _pendingPayload = null;
  /* v2890 · DIE KENNUNG GILT VOM AUSLOESEN AN, NICHT VOM SENDEN.
     Bis v2889 las der Timer window._currentObjKey erst 500 ms spaeter. Wurde
     dazwischen das Objekt gewechselt, landeten die Jahresergebnisse des
     alten Objekts unter der Kennung des neuen. Jetzt reist die Kennung mit
     der Nutzlast; ein Wechsel schickt das Ausstehende sofort ab, statt es
     zu verwerfen oder umzuhaengen. */
  var _pendingKey = null;
  function _senden(key, payload) {
    if (!key || !payload) return;
    window.Auth.apiCall('/tax-snapshots/' + key, {
      method: 'POST',
      body: { wk_per_year: payload }
    }).then(function(){
      if (window.DealPilotWKAggregator) {
        window.DealPilotWKAggregator._cache = null;  // soft-invalidate
      }
    }).catch(function(err){
      if (err && err.message && err.message.indexOf('429') < 0) {
        console.warn('[V279] snapshot POST failed:', err.message);
      }
    });
  }
  window._scheduleTaxSnapshotPost = function(wkPerYear) {
    if (!window._currentObjKey || !window.Auth || typeof window.Auth.apiCall !== 'function') return;
    if (!wkPerYear || typeof wkPerYear !== 'object') return;
    /* v2931 · In der Soll-Ansicht (Ankauf-Stand) rechnet die App mit dem
       eingefrorenen Datensatz. Gemessen 23.10.2026: auch dort ging der POST
       raus, und die Jahresergebnisse des ANKAUFS standen als Bestand auf dem
       Server - fuer die Verlustverrechnung der anderen Objekte und das
       Cockpit, bis jemand zurueck auf Ist schaltet. Die Ansicht ist nur
       Anzeige; geschrieben wird nur das Ist. */
    try { if (window.DealPilotAnkaufAnsicht && DealPilotAnkaufAnsicht.aktiv()) return; } catch (e) {}
    var key = window._currentObjKey;
    if (_timer && _pendingKey && _pendingKey !== key) {
      clearTimeout(_timer); _timer = null;
      _senden(_pendingKey, _pendingPayload);
    }
    _pendingPayload = wkPerYear;
    _pendingKey = key;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(function() {
      var payload = _pendingPayload, pkey = _pendingKey;
      _pendingPayload = null; _pendingKey = null;
      _timer = null;
      _senden(pkey, payload);
    }, 500);
  };
})();

'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – tax.js V12
   Deutsche Einkommensteuer-Berechnung mit Progression
   Basierend auf §32a EStG, Tarif 2026

   Tarif-Zonen 2026 (aus dem Excel "Steuerformular"):
     0     – 11.604 €    : steuerfrei
     11.605 – 17.005 €   : 14% – 24% Eingangsbereich
     17.006 – 66.760 €   : 24% – 42% Progressionsbereich
     66.761 – 277.825 €  : 42%
     ab 277.826 €        : 45% (Reichensteuer)

   Implementiert die offiziellen Formeln für 2026.
═══════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
// V269a2-helper-relocated: Helper für Steuer-Startjahr (File-Scope)
// War in V269a1 innerhalb von Tax-IIFE → ReferenceError bei renderYearlyTaxForm
// Jetzt File-Scope → für ALLE Funktionen in tax.js erreichbar
// Cascade: DealPilotAnteilig.getBaseYear() > State.cfRows[0].cal > heute
// ═══════════════════════════════════════════════════════════════
function _v269_getStartYear() {
  try {
    if (typeof window !== 'undefined' && window.DealPilotAnteilig && window.DealPilotAnteilig.getBaseYear) {
      var by = window.DealPilotAnteilig.getBaseYear();
      if (by) return by;
    }
  } catch(_) {}
  try {
    if (typeof State !== 'undefined' && State.cfRows && State.cfRows[0] && State.cfRows[0].cal) {
      return State.cfRows[0].cal;
    }
  } catch(_) {}
  return new Date().getFullYear();
}

var Tax = (function() {
  /* ══════════════════════════════════════════════════════════════════════
     v1364 · DER TARIF STEHT AN EINER STELLE UND KENNT SEIN JAHR
     ══════════════════════════════════════════════════════════════════════
     Marcels Vorgabe: „mir waere wichtig, dass wir immer die aktuellen
     saetze verwenden fuer das entsprechende jahr … das darf ja nicht an 3
     stellen unterschiedlich sein."

     Es WAR an drei Stellen unterschiedlich. Gemessen am 13.09.2026:

       tax.js        Grundfreibetrag 11.604   (Kommentar sagte „Tarif 2026")
       dashboard.js  Grundfreibetrag 11.784   (zusammengefuehrt in v1361)
       rnd-calc.js   Zonengrenzen 12.096 / 17.443 / 68.480

     KEINER DAVON WAR 2026. Der Wert 11.604 ist nicht einmal ein gueltiger
     Jahrgang - er war der urspruenglich GEPLANTE Grundfreibetrag 2024,
     bevor er auf 11.784 angehoben wurde. Er stand hier unter der
     Ueberschrift „Tarif 2026".

     DIE QUELLE IST DAS GESETZ, NICHT EINE SUCHMASCHINE. Abgerufen am
     13.09.2026 von gesetze-im-internet.de/estg/__32a.html, der amtlichen
     Fassung „ab dem Veranlagungszeitraum 2026". Eine Suchmaschine lieferte
     zuvor abweichende Zahlen (954,80 statt 914,51; Zonengrenze 17.005
     statt 17.799) - die Primaerquelle gewinnt.

     GEGENGEPRUEFT UEBER DIE STETIGKEIT. Der Tarif muss an jeder
     Zonengrenze denselben Wert liefern, sonst springt die Steuer:

       bei 17.799 EUR   Zone 2 -> 1.034,87   Zone 3 -> 1.034,87   passt
       bei 69.878 EUR   Zone 3 -> 18.213     Zone 4 -> 18.213     passt
       bei 277.825 EUR  Zone 4 -> 105.550,87 Zone 5 -> 105.550,87 passt

     Das ist die beste Probe, die es ohne amtliches Rechenbeispiel gibt:
     falsche Koeffizienten erzeugen an den Grenzen einen Sprung.

     WARUM NUR EIN JAHRGANG IN DER TABELLE STEHT: fuer 2025 liessen sich
     die Zonen 4 und 5 in der verfuegbaren Zeit nicht aus einer
     Primaerquelle belegen. Eine halb belegte Zahl ist schlechter als
     keine - wer einen Jahrgang braucht, traegt ihn hier ein, und alle
     drei Stellen bekommen ihn. Fehlt das angefragte Jahr, nimmt die
     Funktion den naechstaelteren vorhandenen und SAGT das ueber
     `tarifInfo()`, statt still eine andere Zahl zu rechnen.

     Die App rechnet Prognosen in die Zukunft: ein Objekt, das 2026
     gekauft und fuenfzehn Jahre projiziert wird, nutzt durchgehend den
     Tarif 2026, weil kuenftige Tarife niemand kennt. Historische
     Jahrgaenge braucht nur, wer eine alte Veranlagung nachrechnet.
     ══════════════════════════════════════════════════════════════════════ */
  var TARIFE = {
    2026: {
      quelle: '\u00a7 32a Abs. 1 EStG, Fassung ab VZ 2026 \u2014 gesetze-im-internet.de, abgerufen 13.09.2026',
      grundfreibetrag: 12348,
      /* Zone 2: (a*y + b) * y   mit y = (x - grundfreibetrag) / 10000 */
      z2bis: 17799, z2a: 914.51, z2b: 1400,
      /* Zone 3: (a*z + b) * z + c   mit z = (x - z3basis) / 10000 */
      z3basis: 17799, z3bis: 69878, z3a: 173.10, z3b: 2397, z3c: 1034.87,
      /* Zone 4: 0,42 * x - c */
      z4bis: 277825, z4satz: 0.42, z4c: 11135.63,
      /* Zone 5: 0,45 * x - c */
      z5satz: 0.45, z5c: 19470.38,
      /* v2891: Freigrenze des Solidaritaetszuschlags (§ 3 Abs. 3 SolZG,
         gesetze-im-internet.de, abgerufen 23.10.2026): 20.350 EUR
         Einkommensteuer, bei Zusammenveranlagung (§ 32a Abs. 5) 40.700 EUR.
         Steht am Tarif, weil sie mit ihm jaehrlich wandert. */
      soliFreigrenze: 20350
    }
  };

  var TARIF_JAHRE = Object.keys(TARIFE).map(Number).sort(function (a, b) { return a - b; });

  /* Welcher Jahrgang gilt fuer dieses Jahr? Gibt es ihn nicht, wird der
     naechstaeltere genommen - und das ist ueber tarifInfo() ablesbar. */
  function tarifFuer(jahr) {
    var j = parseInt(jahr, 10);
    if (!isFinite(j)) j = new Date().getFullYear();
    if (TARIFE[j]) return { jahr: j, tarif: TARIFE[j], exakt: true };
    var gewaehlt = TARIF_JAHRE[0];
    for (var i = 0; i < TARIF_JAHRE.length; i++) {
      if (TARIF_JAHRE[i] <= j) gewaehlt = TARIF_JAHRE[i];
    }
    return { jahr: gewaehlt, tarif: TARIFE[gewaehlt], exakt: false, angefragt: j };
  }

  /* Fuer Anzeige und Pruefung: welcher Tarif wurde benutzt, und woher
     stammt er? Ohne das ist von aussen nicht erkennbar, ob gerade der
     passende Jahrgang gerechnet wird oder ein Ersatz. */
  function tarifInfo(jahr) {
    var t = tarifFuer(jahr);
    return {
      jahr: t.jahr,
      exakt: t.exakt,
      angefragt: t.angefragt || t.jahr,
      grundfreibetrag: t.tarif.grundfreibetrag,
      /* v1405: die Zonengrenzen gehoeren dorthin, wo der Tarif steht. Die
         Progressionskurve im Cockpit braucht sie, um an den richtigen
         Stellen zu knicken — sie soll sie nicht selbst kennen muessen. */
      zonen: { z2bis: t.tarif.z2bis, z3bis: t.tarif.z3bis, z4bis: t.tarif.z4bis },
      quelle: t.tarif.quelle,
      verfuegbareJahre: TARIF_JAHRE.slice()
    };
  }

  /* § 32a Abs. 1 EStG. `x` ist das auf volle Euro ABGERUNDETE zu
     versteuernde Einkommen - das schreibt Satz 5 ausdruecklich vor, und
     genau daran ist die zweite Fassung in dashboard.js gescheitert, die
     mit Math.round arbeitete (v1361). */
  function calcEStG(zvE, jahr) {
    var T = tarifFuer(jahr).tarif;
    var x = Math.floor(Number(zvE) || 0);
    if (x <= T.grundfreibetrag) return 0;
    if (x <= T.z2bis) {
      var y = (x - T.grundfreibetrag) / 10000;
      return Math.floor((T.z2a * y + T.z2b) * y);
    }
    if (x <= T.z3bis) {
      var z = (x - T.z3basis) / 10000;
      return Math.floor((T.z3a * z + T.z3b) * z + T.z3c);
    }
    if (x <= T.z4bis) return Math.floor(T.z4satz * x - T.z4c);
    return Math.floor(T.z5satz * x - T.z5c);
  }


  /**
   * Calculates marginal tax rate (Grenzsteuersatz) at a given zvE.
   * Useful to know what the next euro of income will be taxed at.
   */
  /* v1364: das Jahr wird durchgereicht, damit der Grenzsteuersatz aus
     demselben Tarif stammt wie die Steuer selbst. (Der Abstand von 1.000
     EUR, der hier stand, ist seit v2890 durch die Ableitung ersetzt.) */
  /* v2890 · DIE ABLEITUNG DER ZONENFORMEL STATT EINES 1.000-EURO-SCHRITTS.
     Der Schritt mittelte ueber die naechsten 1.000 EUR und lag in Zone 2
     bis 0,9 Prozentpunkte daneben (12.348 EUR: 14,90 % statt 14,00 %;
     17.799 EUR: 24,20 % statt 23,97 %), an jeder Zonengrenze mischte er
     zwei Zonen. Die Formeln aus § 32a Abs. 1 lassen sich exakt ableiten:
       Zone 2  (2·a·y + b) / 10.000,  y = (x − Grundfreibetrag) / 10.000
       Zone 3  (2·a·z + b) / 10.000,  z = (x − Zonenbasis) / 10.000
       Zone 4/5  der lineare Satz (0,42 / 0,45). */
  function calcGrenzsteuersatz(zvE, jahr) {
    var T = tarifFuer(jahr).tarif;
    var x = Math.floor(Number(zvE) || 0);
    if (x <= T.grundfreibetrag) return 0;
    if (x <= T.z2bis) {
      var y = (x - T.grundfreibetrag) / 10000;
      return (2 * T.z2a * y + T.z2b) / 10000;
    }
    if (x <= T.z3bis) {
      var z = (x - T.z3basis) / 10000;
      return (2 * T.z3a * z + T.z3b) / 10000;
    }
    if (x <= T.z4bis) return T.z4satz;
    return T.z5satz;
  }


  /**
   * Average tax rate (Durchschnittssteuersatz)
   */
  function calcDurchschnittssteuersatz(zvE, jahr) {
    if (zvE <= 0) return 0;
    return calcEStG(zvE, jahr) / zvE;

  }

  /**
   * Calculate tax difference for additional income (or loss) from real estate.
   *
   * @param {number} baseIncome - regular zvE from job (without immo)
   * @param {number} immoResult - positive = income, negative = loss (V+V Überschuss/Verlust)
   * @returns {object} { taxBefore, taxAfter, taxDelta, refund }
   *   taxDelta = positive means more tax due
   *   refund = positive means money back from Finanzamt
   */
  /* ═══ v2891 · DIE STEUERLAST, NICHT NUR DIE EINKOMMENSTEUER ═════════════
     Marcel 23.10.2026: Splitting, Soli und Kirchensteuer gehoeren in die
     Steuerwirkung. Das zvE enthaelt keins davon - es ist die Groesse VOR
     dem Tarif. Splitting ist eine Tarifregel auf das zvE (§ 32a Abs. 5),
     Soli und Kirchensteuer stehen auf der Einkommensteuer.

     Gemessen vor v2891 (Pruefbericht 23.10.): ein Ehepaar mit 80.000 EUR
     gemeinsamem zvE und 10.000 EUR Verlust bekam 4.200 EUR Entlastung
     statt 3.078 (+36 %); bei 90.000 EUR (Einzel) und 9 % Kirchensteuer
     fehlten 878 EUR.

     `opt` = { splitting: bool, kist: 0 | 0.08 | 0.09 }. Fehlt es, gilt die
     Angabe unter den Steuerangaben (`optionen()`); ein Aufrufer, der einen
     fremden Fall rechnet (Pruefskript), gibt es ausdruecklich mit. */
  /* v2892: JE STEUERZEITRAUM. Fuehrt der Zeitraum des Jahres eine eigene
     Veranlagung oder Kirchensteuer (Spalten `splitting`, `kirchensteuer`,
     Migration 089), gilt sie vor dem Profil; null heisst "wie im Profil".
     Welcher Zeitraum gilt, entscheidet derselbe Weg wie beim zvE
     (`_getZveForDateWithFallback`: exakter Zeitraum, sonst der letzte
     fruehere) - sonst koennte ein Jahr das zvE des einen und die
     Veranlagung eines anderen Zeitraums bekommen. */
  function optionen(opt, jahr) {
    if (opt && typeof opt === 'object') {
      return { splitting: !!opt.splitting, kist: _kistSatz(opt.kist) };
    }
    var p = {};
    try {
      if (typeof window !== 'undefined' && window.DealPilotInvestmentProfile
          && typeof DealPilotInvestmentProfile.load === 'function') {
        p = DealPilotInvestmentProfile.load() || {};
      }
    } catch (e) { p = {}; }
    var o = { splitting: p.splitting === true || p.splitting === 'true',
              kist: _kistSatz(p.kirchensteuer), quelle: 'profil' };
    var per = _zeitraumFuer(jahr);
    if (per) {
      if (per.splitting === true || per.splitting === false) { o.splitting = per.splitting; o.quelle = 'zeitraum'; }
      if (per.kirchensteuer === 0 || per.kirchensteuer === 8 || per.kirchensteuer === 9) { o.kist = _kistSatz(per.kirchensteuer); o.quelle = 'zeitraum'; }
    }
    return o;
  }
  function _zeitraumFuer(jahr) {
    var j = parseInt(jahr, 10);
    if (!(j > 1900) || typeof _getZveForDateWithFallback !== 'function') return null;
    try { var r = _getZveForDateWithFallback(String(j)); return r && r.period ? r.period : null; }
    catch (e) { return null; }
  }
  /* 8 und 9 (Prozent) wie 0,08 und 0,09 - alles andere ist „keine". */
  function _kistSatz(k) {
    var n = parseFloat(String(k == null ? '' : k).replace(',', '.'));
    if (!isFinite(n) || n <= 0) return 0;
    if (n >= 1) n = n / 100;
    return (Math.abs(n - 0.08) < 1e-6 || Math.abs(n - 0.09) < 1e-6) ? n : 0;
  }

  /* Tarifliche Einkommensteuer: Grundtabelle oder Splitting (§ 32a Abs. 5:
     das Zweifache der Steuer auf die Haelfte des gemeinsamen zvE). */
  function estTarif(zvE, jahr, splitting) {
    var x = Math.max(0, Number(zvE) || 0);
    return splitting ? 2 * calcEStG(x / 2, jahr) : calcEStG(x, jahr);
  }

  /* § 4 SolZG: 5,5 % der Einkommensteuer, hoechstens 11,9 % des Betrags
     ueber der Freigrenze (Milderungszone); Bruchteile eines Cents entfallen. */
  function soli(est, jahr, splitting) {
    var fg = (tarifFuer(jahr).tarif.soliFreigrenze || 20350) * (splitting ? 2 : 1);
    if (!(est > fg)) return 0;
    return Math.floor(Math.min(0.055 * est, 0.119 * (est - fg)) * 100) / 100;
  }

  /* Die ganze Last auf ein zvE: ESt + Soli + Kirchensteuer.
     KIRCHENSTEUER ALS SONDERAUSGABE (§ 10 Abs. 1 Nr. 4 EStG): die gezahlte
     Kirchensteuer mindert das zvE. Gerechnet wird der Gleichgewichtsfall -
     die im Jahr gezahlte Kirchensteuer ist die des Jahres (K = k · ESt(zvE − K)),
     iterativ geloest; nach drei Schritten aendert sich nichts mehr (der
     Faktor k · Grenzsatz liegt unter 0,05). Exakt statt Faustformel, weil
     dieselbe Funktion auch die Differenz zweier Lasten liefert und eine
     Naeherung dort keine Kuerzung mehr waere. Kinderfreibetraege kennt
     DealPilot nicht; Soli und Kirchensteuer stehen deshalb auf der
     tariflichen Einkommensteuer. */
  function steuerLast(zvE, jahr, opt) {
    var o = optionen(opt, jahr);
    var x = Math.max(0, Math.floor(Number(zvE) || 0));
    var K = 0, E;
    if (o.kist > 0) {
      for (var i = 0; i < 6; i++) {
        E = estTarif(Math.max(0, x - K), jahr, o.splitting);
        var Kn = o.kist * E;
        if (Math.abs(Kn - K) < 0.01) { K = Kn; break; }
        K = Kn;
      }
    }
    E = estTarif(Math.max(0, x - Math.floor(K)), jahr, o.splitting);
    K = o.kist > 0 ? Math.floor(o.kist * E * 100) / 100 : 0;
    var S = soli(E, jahr, o.splitting);
    return { est: E, soli: S, kist: K, gesamt: E + S + K,
             splitting: o.splitting, kistSatz: o.kist };
  }

  /* Grenzsatz der GANZEN Last, abgeleitet statt geschaetzt:
       ESt-Grenzsatz g (beim Splitting der der halben Basis),
       Soli s' = 0 unter der Freigrenze, 11,9 % in der Milderungszone, sonst 5,5 %,
       Kirchensteuer mit Sonderausgabenabzug:  g · (1 + s' + k) / (1 + k · g). */
  function grenzsatzGesamt(zvE, jahr, opt) {
    var o = optionen(opt, jahr);
    var L = steuerLast(zvE, jahr, o);
    var basis = Math.max(0, Math.floor(Number(zvE) || 0) - Math.floor(L.kist));
    var g = o.splitting ? calcGrenzsteuersatz(basis / 2, jahr) : calcGrenzsteuersatz(basis, jahr);
    var fg = (tarifFuer(jahr).tarif.soliFreigrenze || 20350) * (o.splitting ? 2 : 1);
    var s = 0;
    if (L.est > fg) s = (0.119 * (L.est - fg) < 0.055 * L.est) ? 0.119 : 0.055;
    return g * (1 + s + o.kist) / (1 + o.kist * g);
  }

  function calcImmoTaxImpact(baseIncome, immoResult, jahr, opt) {
    var o = optionen(opt, jahr);
    var newZvE = baseIncome + immoResult;
    if (newZvE < 0) newZvE = 0;
    var vor = steuerLast(baseIncome, jahr, o);
    var nach = steuerLast(newZvE, jahr, o);
    var taxBefore = vor.gesamt;
    var taxAfter = nach.gesamt;
    var taxDelta = taxAfter - taxBefore;
    return {
      taxBefore: taxBefore,      /* v2891: ESt + Soli + Kirchensteuer */
      taxAfter: taxAfter,
      taxDelta: taxDelta,        // < 0 = Erstattung, > 0 = Nachzahlung
      refund: -taxDelta,         // > 0 = Erstattung
      vor: vor, nach: nach,      /* v2891: die Aufteilung je Steuerart */
      splitting: o.splitting, kistSatz: o.kist,
      /* v2891: Verlust, der das Einkommen uebersteigt - wirkt erst ueber
         den Verlustvortrag (§ 10d), hier nicht eingerechnet */
      verlustUeberhang: (baseIncome + immoResult < 0) ? -(baseIncome + immoResult) : 0,
      grenzsteuersatzBefore: grenzsatzGesamt(baseIncome, jahr, o),
      grenzsteuersatzAfter: grenzsatzGesamt(newZvE, jahr, o),
      avgBefore: baseIncome > 0 ? taxBefore / baseIncome : 0,
      avgAfter: newZvE > 0 ? taxAfter / newZvE : 0
    };
  }

  /* v2890: calcImmoResult und calculateForObject entfernt. Beide hatten
     keinen Aufrufer (gesucht in frontend, backend, marktbericht, tools) und
     fuehrten eine eigene, falsche 15-%-Grenze (Kaufpreis brutto statt
     Gebaeude-AHK netto) - eine zweite Wahrheit, die niemand prueft. */

  return {
    calcEStG: calcEStG,
    tarifInfo: tarifInfo,   /* v1364: welcher Jahrgang gilt gerade? */
    calcGrenzsteuersatz: calcGrenzsteuersatz,
    calcDurchschnittssteuersatz: calcDurchschnittssteuersatz,
    calcImmoTaxImpact: calcImmoTaxImpact,
    /* v2891 */
    optionen: optionen,
    estTarif: estTarif,
    soli: soli,
    steuerLast: steuerLast,
    grenzsatzGesamt: grenzsatzGesamt
  };
})();

// ═══════════════════════════════════════════════════
// UI: Steuer-Modul anzeigen (im Tab 3 "Miete & Steuern")
// ═══════════════════════════════════════════════════
// V275.2-helper-fix: Robuster Helper ohne STATE-Zugriff
// Nutzt nur oeffentliche getForDateSync() API + cached fuer Performance
var _zveCache = { periods: null, ts: 0 };

function _collectAllPeriodsViaScan() {
  // Sammelt alle Periods via getForDateSync() Probe-Calls fuer jedes Jahr 2000-2050
  // Das funktioniert OHNE Internal-STATE Zugriff.
  if (!window.DealPilotTaxPeriods || typeof DealPilotTaxPeriods.getForDateSync !== 'function') return [];
  var found = {};  // dedupe by valid_from
  for (var y = 2000; y <= 2050; y++) {
    var d = y + '-06-15';
    try {
      var p = DealPilotTaxPeriods.getForDateSync(d);
      if (p && p.valid_from && typeof p.zve === 'number') {
        found[p.valid_from] = p;
      }
    } catch(_) {}
  }
  return Object.keys(found).map(function(k){ return found[k]; });
}

function _getZveForDateWithFallback(yearStr) {
  if (!window.DealPilotTaxPeriods) return null;
  var refDate = yearStr + '-06-15';
  try {
    // Versuch 1: exakter Match via produktive API
    if (typeof DealPilotTaxPeriods.getForDateSync === 'function') {
      var p = DealPilotTaxPeriods.getForDateSync(refDate);
      if (p && typeof p.zve === 'number' && p.zve > 0) {
        return { zve: p.zve, source: 'Steuerzeitraum ' + yearStr, exact: true, period: p };
      }
    }
    // Versuch 2: alle Periods sammeln (mit Cache, 5 Sekunden TTL)
    var now = Date.now();
    if (!_zveCache.periods || (now - _zveCache.ts) > 5000) {
      _zveCache.periods = _collectAllPeriodsViaScan();
      _zveCache.ts = now;
    }
    var allPeriods = _zveCache.periods || [];
    var match = null;
    allPeriods.forEach(function(per) {
      if (!per || !per.valid_from || typeof per.zve !== 'number') return;
      if (per.valid_from <= refDate) {
        if (!match || per.valid_from > match.valid_from) match = per;
      }
    });
    if (match && typeof match.zve === 'number' && match.zve > 0) {
      return {
        zve: match.zve,
        source: 'letzter bekannter Wert (gültig ab ' + match.valid_from + ')',
        exact: false,
        period: match
      };
    }
  } catch(_) {}
  return null;
}


// V276-other-objects: Verluste/Ueberschuesse aus anderen Bestandsobjekten
function _getBestandLossesForYear(displayYear) {
  // Synchron, nutzt nur Cache. Returns {sum, list, loaded}
  // loaded=false bedeutet: Cache noch nicht da, sollte Re-Render triggern
  var result = { sum: 0, list: [], loaded: false };
  if (!window.DealPilotWKAggregator || !displayYear) return result;
  try {
    var all = DealPilotWKAggregator.getAllObjectsWithWK();
    if (!Array.isArray(all)) return result;
    result.loaded = true;
    // currentObjectId ermitteln (verschiedene Wege)
    var currentId = null;
    try {
      if (window._currentObjId) currentId = _currentObjId;
      else if (window.State && State.currentObjectId) currentId = State.currentObjectId;
      else if (window._currentObjKey) currentId = _currentObjKey;
    } catch(_) {}
    // V280-correct-filter: mein eigenes Kaufdatum holen (kaufdat-Feld oder WUe)
    var currentObjKaufdat = null;
    try {
      var kdEl = document.getElementById('kaufdat');
      var wuEl = document.getElementById('wirtschaftlicher_uebergang');
      var raw = (kdEl && kdEl.value) || (wuEl && wuEl.value) || '';
      if (raw && raw.length >= 10) currentObjKaufdat = raw.substring(0, 10);
    } catch(_) {}
    /* v1400/v1404: die Steuersphaere DIESES Objekts — Bezugspunkt der
       Trennung unten. `privat` und `gbr` teilen sich die Sphaere 'est',
       jede Kapitalgesellschaft hat ihre eigene. Faellt mandanten.js aus,
       gilt der Halter selbst als Sphaere: dann wird eher zu fein getrennt
       als vermischt. */
    function _sphVon(h) {
      try {
        if (window.DealPilotMandanten && DealPilotMandanten.sphaere) {
          return DealPilotMandanten.sphaere(h || 'privat');
        }
      } catch (_e) {}
      return String(h || 'privat');
    }
    /* Anteil am Ergebnis (1 = 100 %). Nur die GbR fuehrt eine Quote. */
    function _antVon(h) {
      try {
        if (window.DealPilotMandanten && DealPilotMandanten.anteil) {
          var a = DealPilotMandanten.anteil(h || 'privat');
          return (typeof a === 'number' && isFinite(a) && a > 0) ? a : 1;
        }
      } catch (_e) {}
      return 1;
    }
    var _curHalterId = 'privat';
    try {
      var _hEl = document.getElementById('halter');
      _curHalterId = String((_hEl && _hEl.value) || 'privat');
    } catch (_) { _curHalterId = 'privat'; }
    var _curSphaere = _sphVon(_curHalterId);
    /* v2891: Rang dieses Objekts in der Anlage-Reihenfolge, -1 = nicht gelistet */
    var _curRang = -1;
    all.forEach(function (o) {
      if (o && currentId && o.id === currentId && typeof o.rang === 'number') _curRang = o.rang;
    });
    // Year-Key als String
    var yearKey = String(displayYear);
    all.forEach(function(obj) {
      if (!obj || !obj.id) return;
      if (currentId && obj.id === currentId) return;  // sich selbst ueberspringen
      /* ═══ v1404 · GLEICHE SPHAERE STATT GLEICHER HALTER ══════════════════
         Bis v1403 stand hier `_objHalter !== _curHalterId` — also: nur
         Objekte DESSELBEN Halters. Das trennte GmbH und UG richtig ab, aber
         es trennte auch die GbR vom Privatvermoegen, und das ist falsch: eine
         GbR zahlt keine Einkommensteuer, ihr Ergebnis fliesst beim
         Gesellschafter in DASSELBE zvE.

         Gemessen an drei privaten und zwei GbR-Objekten: 9,6 Prozent zu viel
         ausgewiesene Entlastung, weil beide Toepfe die Progression von vorn
         durchliefen.

         `sphaere()` liegt in mandanten.js, wo auch die Rechtsformen stehen —
         eine zweite Fassung hier liefe frueher oder spaeter auseinander. */
      var _objSph = _sphVon(obj.halter);
      if (_objSph !== _curSphaere) return;
      // V280-correct-filter: Anderes Objekt nur wenn dessen Kaufdatum
      //   1) VOR meinem eigenen Kaufdatum liegt UND
      //   2) Bis zum Card-Year (displayYear) bereits existierte
      var refDate = obj.purchase_date || obj.kaufdat || obj.wirtschaftlicher_uebergang;
      if (!refDate) return;
      var refDateStr = String(refDate).substring(0, 10);
      // Bedingung 1: anderes Kaufdatum < mein Kaufdatum
      /* v2891 · GLEICHES KAUFDATUM: es entscheidet die Reihenfolge der
         Anlage (`rang`), dieselbe Ordnung wie die Steuerkette im Cockpit.
         Bis v2890 schlossen sich zwei Objekte desselben Tages gegenseitig
         aus - jedes rechnete auf der vollen Basis, die Summe der Boxen lag
         ueber der Kette. Steht dieses Objekt (noch) nicht in der Liste, gilt
         es als das juengste. */
      if (currentObjKaufdat && refDateStr > currentObjKaufdat) return;
      if (currentObjKaufdat && refDateStr === currentObjKaufdat
          && _curRang >= 0 && !(typeof obj.rang === 'number' && obj.rang < _curRang)) return;
      // Bedingung 2: anderes Kaufjahr <= displayYear
      var refYear = parseInt(refDateStr.substring(0, 4), 10);
      if (!refYear || refYear > displayYear) return;
      // Wert holen
      /* v1404: nur DEIN Anteil geht in deine Steuerrechnung ein. Bei einer
         GbR mit 50 Prozent zaehlt ein Verlust von 20.000 bei dir mit 10.000.
         Privat und Kapitalgesellschaft liefern immer 1. */
      var _ant = _antVon(obj.halter);
      var val = obj.wk_per_year && obj.wk_per_year[yearKey];
      if (typeof val === 'number' && _ant !== 1) val = val * _ant;
      if (typeof val !== 'number' || val === 0) {
        // Falls nichts da: trotzdem Objekt mit 0 anzeigen
        result.list.push({
          id: obj.id,
          name: obj.address || obj.kuerzel || obj.name || 'Objekt ' + obj.id.substring(0, 8),
          address: obj.address || '',
          kaufdat: refDateStr,
          objName: obj.name || obj.kuerzel || '',
          value: 0
        });
        return;
      }
      result.list.push({
        id: obj.id,
        name: obj.address || obj.kuerzel || obj.name || 'Objekt ' + obj.id.substring(0, 8),
        address: obj.address || '',
        kaufdat: refDateStr,
        objName: obj.name || obj.kuerzel || '',
        value: val
      });
      result.sum += val;
    });
  } catch(e) {
    console.warn('[V276-other-objects]', e.message);
  }
  return result;
}

// Trigger async WK-Aggregator-Load + Re-Render wenn fertig
function _ensureBestandDataAndRerender() {
  if (!window.DealPilotWKAggregator) return;
  var cache = DealPilotWKAggregator.getAllObjectsWithWK();
  if (Array.isArray(cache) && cache.length > 0) return;  // schon da
  DealPilotWKAggregator.loadAll(false).then(function() {
    // Nach Load: Re-Render Tax-Modul
    setTimeout(function() {
      if (typeof renderTaxModule === 'function') {
        try { renderTaxModule(); } catch(_) {}
      }
    }, 100);
  }).catch(function(){});
}

function renderTaxModule(yearOverride) { /* V270-displayYear */ /* V283-tax-applied */ /* V284-tax-applied */ /* V285-tax-applied */ /* V286-tax-applied */
  if (!State.kpis) return;
  if (typeof _computeYearTotal !== 'function') return;

  var box = document.getElementById('tax-result-box');
  if (!box) return;
  try { if (window.DpSteuerAngaben) DpSteuerAngaben.zeigen(); } catch (_eSA) {}   /* v2891 */

  // V270: Persistiere ausgewähltes Jahr (Klick auf Steuerverlauf-Card)
  if (typeof yearOverride === 'number' && yearOverride > 1900) {
    State._taxDisplayYear = yearOverride;
  }

  // V29: Empty-Guard — wenn weder Kaufpreis noch Kaltmiete da sind,
  // zeige einen klaren Empty-State statt verwirrender "Restwerte"
  // (vorher kamen z.B. 1.728 € Werbungskosten allein aus umlagefähigen NK,
  // was wie ein Phantom-Wert wirkt, obwohl der User nichts ausgefüllt hat).
  var hasKp = State.kpis.kp && State.kpis.kp > 0;
  var hasMiete = (State.kpis.nkm_m || 0) > 0 || (State.kpis.bmy_m || 0) > 0;
  if (!hasKp && !hasMiete) {
    box.innerHTML =
      '<div class="tax-empty-state">' +
        '<div class="tax-empty-icon">📋</div>' +
        '<div class="tax-empty-title">Noch keine Daten erfasst</div>' +
        '<div class="tax-empty-text">' +
          'Sobald du Kaufpreis und Kaltmiete eingibst, berechnen wir hier ' +
          'Werbungskosten, Überschuss und Steuer-Effekt automatisch.' +
        '</div>' +
      '</div>';
    return;
  }

  // V270: Year-Resolver — Cascade State._taxDisplayYear > heute > cfRows[0]
  var displayYear, yearIdx;
  var prefYear = State._taxDisplayYear || new Date().getFullYear();
  if (State.cfRows && State.cfRows.length) {
    yearIdx = -1;
    for (var _ti = 0; _ti < State.cfRows.length; _ti++) {
      if (State.cfRows[_ti].cal === prefYear) { yearIdx = _ti; break; }
    }
    if (yearIdx === -1) yearIdx = 0;
    displayYear = State.cfRows[yearIdx].cal;
  } else {
    yearIdx = 0;
    displayYear = prefYear;
  }
  var startYear = displayYear;
  var totals = _computeYearTotal(displayYear, yearIdx);

  /* v2890: zvE, Saldo und Steuerwirkung kommen aus _computeYearTotal, das
     seit v2890 ueber _dpSteuerBasis rechnet - die Box rechnet nicht mehr
     selbst, sonst gaebe es wieder zwei Zahlen fuer dasselbe Jahr. */
  var _bestandInfo = _getBestandLossesForYear(displayYear);
  if (!_bestandInfo.loaded) {
    _ensureBestandDataAndRerender();
  }
  var _zveSource = totals.zveQuelle || 'aktueller zvE-Wert';
  var _baseIncomeOrig = totals.zveOhneBestand;
  var baseIncome = totals.zve;

  // Tooltip am zvE-ohne-Wert (falls Element vorhanden)
  try {
    var _zveOhneTip = box.querySelector('[data-zve-ohne-tip]') || box.querySelector('.tax-zve-ohne');
    if (_zveOhneTip) _zveOhneTip.title = 'zvE-Quelle: ' + _zveSource;
  } catch(_) {}
  var impact = totals.impact;
  /* mand v805: Halter-Regime fuer den Steuer-Tab */
  var _mandCorp = false, _mandRate = null, _mandName = '';
  try {
    var _hsel = document.getElementById('halter');
    var _hid = _hsel ? _hsel.value : 'privat';
    if (window.DealPilotMandanten && DealPilotMandanten.get) {
      var _mObj = DealPilotMandanten.get(_hid);
      _mandCorp = !!(_mObj && DealPilotMandanten.isCorp && DealPilotMandanten.isCorp(_mObj.rechtsform));
      _mandName = _mObj ? _mObj.name : '';
      if (_mandCorp && DealPilotMandanten.effRate) _mandRate = DealPilotMandanten.effRate(_hid);
    }
  } catch (_eM) {}
  /* v814-A: persoenliche ESt-Sektion bei GmbH/UG ausblenden (Koerperschaft hat keine persoenliche ESt) */
  try {
    var _persCard = document.getElementById('tax-personal-card');
    if (_persCard) _persCard.style.display = _mandCorp ? 'none' : '';
  } catch (_e814) {}

  var refundColor = impact.refund > 0 ? 'var(--green)' : 'var(--red)';
  var refundLabel = impact.refund > 0 ? 'Steuer-Erstattung' : 'Steuer-Nachzahlung';
  var refundAbs = Math.abs(impact.refund);
  var isProfit = totals.ergebnis > 0;

  // V270: Header-Label aktualisieren (falls Element existiert)
  var titleEl = document.getElementById('tax-display-year');
  if (titleEl) titleEl.textContent = displayYear;
  // Alternativ: alle h2/h3-Headers im Steuer-Tab durchsuchen
  var taxSection = document.getElementById('s3-tax');
  if (taxSection) {
    var headers = taxSection.querySelectorAll('h2, h3, .sec-title, [class*="title"], .ct, .ct-pro'); /* V283a */
    headers.forEach(function(h) {
      if (/echte\s+progression\s+\d{4}/i.test(h.textContent)) {
        h.textContent = h.textContent.replace(/(echte\s+progression\s+)\d{4}/i, '$1' + displayYear);
      }
    });
  }

  box.innerHTML =
    /* V283b: Neues Layout — LINKS=OHNE Immobilie, RECHTS=MIT Immobilie */
    '<div class="tax-grid">' +
      /* ─── LINKS: Ausgangs-zvE ─── */
      '<div class="tax-item"><div class="tax-label">Ausgangs-zvE <span class="tax-info" title="zvE-Quelle: ' + _zveSource + '">ⓘ</span></div><div class="tax-val">' + fE(_baseIncomeOrig, 0) + '</div></div>' +
      /* ─── RECHTS: Einnahmen V+V ─── */
      '<div class="tax-item"><div class="tax-label">Einnahmen V+V <span class="tax-info" title="Kaltmiete + zus. Einnahmen + umlf. NK">ⓘ</span></div><div class="tax-val">' + fE(totals.einnahmen, 0) + '</div></div>' +
      /* ─── LINKS: Überschuss/Verlust V+V (aktueller Bestand) [V286: Hybrid mit Overlay] ─── */
      (function(){
        var fmtVal = function(n) { return (n >= 0 ? '+' : '') + n.toLocaleString('de-DE') + ' €'; };
        var fmtDate = function(s) {
          if (!s || s.length < 10) return '';
          /* YYYY-MM-DD → DD.MM.YYYY */
          var parts = s.substring(0, 10).split('-');
          if (parts.length !== 3) return s;
          return parts[2] + '.' + parts[1] + '.' + parts[0];
        };
        var escHtml = function(s) {
          return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        };
        /* ═══ v1399 · "KEINE" UND "NOCH NICHT GELADEN" SIND ZWEIERLEI ══════
           Hier stand EINE Antwort fuer zwei voellig verschiedene Zustaende:
           die Liste ist leer, WEIL es keine frueheren Objekte gibt — oder
           weil der Aggregator nichts geliefert hat (kein Token, Backend
           stumm, Netz weg). Der Text behauptete in beiden Faellen "Keine
           anderen Bestandsobjekte".

           Das ist die gefaehrliche Richtung: faellt der Abruf aus, rechnet
           das Objekt ohne Saldierung — also mit einer ZU HOHEN Ersparnis —
           und die Oberflaeche bestaetigt dem Nutzer, dass das richtig sei.
           `_bestandInfo.loaded` unterscheidet die beiden Faelle und lag
           ungenutzt daneben. */
        if (!_bestandInfo || !_bestandInfo.loaded) {
          return '<div class="tax-item"><div class="tax-label">Überschuss/Verlust V+V (aktueller Bestand) '
               + '<span class="tax-info" title="Die Daten deiner übrigen Objekte werden gerade geladen. '
               + 'Solange rechnet dieses Objekt für sich allein — die ausgewiesene Ersparnis kann dadurch zu hoch sein. '
               + 'Bleibt die Anzeige stehen, lade die Seite neu.">ⓘ</span></div>'
               + '<div class="tax-val" style="color:var(--muted)">wird geladen …</div></div>';
        }
        /* Fall 1: geladen, und es gibt wirklich keine frueheren Objekte */
        if (!_bestandInfo.list || _bestandInfo.list.length === 0) {
          return '<div class="tax-item"><div class="tax-label">Überschuss/Verlust V+V (aktueller Bestand) <span class="tax-info" title="Geprüft: es gibt kein weiteres gespeichertes Objekt mit einem Kaufdatum vor diesem. Dieses Objekt rechnet deshalb auf deinem vollen zvE.">ⓘ</span></div><div class="tax-val" style="color:var(--muted)">—</div></div>';
        }
        var sumColor = _bestandInfo.sum < 0 ? 'c-red' : (_bestandInfo.sum > 0 ? 'c-green' : '');
        var count = _bestandInfo.list.length;
        /* Sortierung: nach Kaufdatum aufsteigend (älteste zuerst) */
        var sorted = _bestandInfo.list.slice().sort(function(a, b) {
          var aD = a.kaufdat || '';
          var bD = b.kaufdat || '';
          if (aD < bD) return -1;
          if (aD > bD) return 1;
          return 0;
        });
        /* Daten in window._taxBestandData speichern für Overlay-Renderer */
        try { window._taxBestandData = { list: sorted, sum: _bestandInfo.sum, year: displayYear }; } catch(_) {}

        var labelHtml = '<div class="tax-label">Überschuss/Verlust V+V (aktueller Bestand) '
                      + '<span style="color:var(--muted);font-size:11.5px;margin-left:2px">(' + count + ')</span> '
                      + '<span class="tax-info" title="Summe der Überschüsse/Verluste aller anderen Bestandsobjekte (Kaufdatum vor diesem Objekt). Berechnung für Jahr ' + displayYear + '. Klick für Detailliste.">ⓘ</span></div>';

        /* Fall 2a: ≤5 Objekte → Inline-Liste */
        if (count <= 5) {
          var inlineRows = sorted.map(function(o) {
            var vColor = o.value < 0 ? 'c-red' : (o.value > 0 ? 'c-green' : '');
            return '<div class="tax-bestand-row">'
                 + '<span class="tax-bestand-name" title="' + escHtml(o.name) + '">' + escHtml(o.name) + '</span>'
                 + '<span class="tax-bestand-date">' + escHtml(fmtDate(o.kaufdat)) + '</span>'
                 + '<span class="tax-bestand-val ' + vColor + '">' + fmtVal(o.value) + '</span>'
                 + '</div>';
          }).join('');
          return '<details class="tax-item-bestand">'
               +   '<summary class="tax-item">'
               +     labelHtml
               +     '<div class="tax-val ' + sumColor + '">' + fmtVal(_bestandInfo.sum) + '</div>'
               +   '</summary>'
               +   '<div class="tax-bestand-list tax-bestand-list-inline">' + inlineRows + '</div>'
               + '</details>';
        }

        /* Fall 2b: >5 Objekte → Overlay (Klick auf Item öffnet) */
        return '<div class="tax-item tax-item-bestand-trigger" data-tax-bestand-open="1" role="button" tabindex="0">'
             +   labelHtml
             +   '<div class="tax-val ' + sumColor + '">' + fmtVal(_bestandInfo.sum) + ' ▸</div>'
             + '</div>';
      })() +
      /* ─── RECHTS: Werbungskosten gesamt ─── */
      '<div class="tax-item"><div class="tax-label">Werbungskosten gesamt <span class="tax-info" title="Schuldzinsen + Bewirtschaftung + AfA + alle übrigen abziehbaren Kosten. Umlagefähige NK sind Werbungskosten UND Einnahme — sie heben sich auf (durchlaufender Posten) und beeinflussen den Steuer-Effekt nicht.">ⓘ</span></div><div class="tax-val c-red">' + fE(totals.werbungskosten, 0) + '</div></div>' +
      /* ─── LINKS: Leerer Platzhalter (Symmetrie) ─── */
      '<div class="tax-item" style="opacity:.4;background:transparent;border-color:rgba(201,168,76,0.08)"><div class="tax-label" style="font-style:italic">—</div><div class="tax-val">—</div></div>' +
      /* ─── RECHTS: Überschuss/Verlust V+V (dieses Objekt) ─── */
      '<div class="tax-item tax-highlight"><div class="tax-label">Überschuss / Verlust V+V (diese Immobilie)</div><div class="tax-val" style="color:' + (isProfit ? 'var(--gold-d)' : 'var(--green)') + '">' + fE(totals.ergebnis, 0, true) + '</div></div>' +
      /* ─── LINKS: zvE ohne Immobilie ─── */
      '<div class="tax-item"><div class="tax-label">zvE ohne Immobilie (mit aktuellem Bestand)</div><div class="tax-val">' + fE(baseIncome, 0) + '</div></div>' +
      /* ─── RECHTS: zvE mit Immobilie ─── */
      '<div class="tax-item"><div class="tax-label">zvE mit dieser Immobilie</div><div class="tax-val">' + fE(baseIncome + totals.ergebnis, 0) + '</div></div>' +
      /* ─── LINKS/RECHTS: Steuerlast ohne/mit (v2891: ESt + Soli + Kirchensteuer) ─── */
      (function () {
        function _auf(L) {
          if (!L) return '';
          return 'Einkommensteuer ' + fE(L.est, 0) + ' · Solidaritätszuschlag ' + fE(L.soli, 0)
            + (L.kistSatz > 0 ? ' · Kirchensteuer ' + Math.round(L.kistSatz * 100) + ' % ' + fE(L.kist, 0) : ' · keine Kirchensteuer')
            + (L.splitting ? ' · Zusammenveranlagung (Splitting)' : ' · Einzelveranlagung');
        }
        return '<div class="tax-item"><div class="tax-label">Steuer ohne Immo <span class="tax-info" title="' + _auf(impact.vor) + '">ⓘ</span></div><div class="tax-val">' + fE(impact.taxBefore, 0) + '</div></div>'
          + '<div class="tax-item"><div class="tax-label">Steuer mit Immo <span class="tax-info" title="' + _auf(impact.nach) + '">ⓘ</span></div><div class="tax-val">' + fE(impact.taxAfter, 0) + '</div></div>';
      })() +
      /* ─── VOLLE BREITE: Erstattung/Nachzahlung ─── */
      '<div class="tax-item tax-result" style="grid-column:1/-1"><div class="tax-label">' + refundLabel + ' (jährlich)</div><div class="tax-val" style="color:' + refundColor + ';font-size:20px">' + (impact.refund >= 0 ? '+' : '') + fE(refundAbs, 0) + '</div></div>' +
      /* v2891: Verlustvortrag sichtbar machen - genutzt aus Vorjahren, oder neu entstanden */
      ((impact.vortragGenutzt > 0 || impact.verlustUeberhang > 0)
        ? '<div class="tax-item" style="grid-column:1/-1;opacity:.92"><div class="tax-label">Verlustvortrag (§ 10d EStG)</div><div class="tax-val" style="font-size:12.5px;font-weight:400;line-height:1.45">'
          + (impact.vortragGenutzt > 0 ? 'Aus den Vorjahren verrechnet: ' + fE(impact.vortragGenutzt, 0) + '. ' : '')
          + (impact.verlustUeberhang > 0 ? 'Der Verlust übersteigt das Einkommen um ' + fE(impact.verlustUeberhang, 0) + ' — dieser Teil wird ins Folgejahr vorgetragen (ein Rücktrag ins Vorjahr ist nicht gerechnet).' : '')
          + '</div></div>'
        : '') +
      /* ─── LINKS: Grenzsteuersatz ─── */
      '<div class="tax-item"><div class="tax-label">Grenzsteuersatz aktuell</div><div class="tax-val">' + (impact.grenzsteuersatzAfter * 100).toFixed(1).replace('.', ',') + ' %</div></div>' +
      /* ─── RECHTS: Durchschnittssteuersatz ─── */
      '<div class="tax-item"><div class="tax-label">Durchschnittssteuersatz</div><div class="tax-val">' + (impact.avgAfter * 100).toFixed(1).replace('.', ',') + ' %</div></div>' +
    '</div>';

  /* mand v805: GmbH/UG -> Koerperschaftsteuer-Ansicht statt ESt/Erstattung */
  if (_mandCorp && _mandRate != null) {
    var _erg = totals.ergebnis;
    /* v2891: KSt dieses Objekts nach Verlustvortrag aus seinen Vorjahren */
    var _kstR = (function () {
      var reihe = [];
      for (var _ki = 0; _ki < yearIdx && State.cfRows && _ki < State.cfRows.length; _ki++) {
        var _kr = State.cfRows[_ki];
        if (_kr && typeof _kr.cal === 'number') reihe.push({ jahr: _kr.cal, erg: _vvRoh(_kr.cal, _ki).ergebnis });
      }
      reihe.push({ jahr: displayYear, erg: _erg });
      return _kstMitVortrag(reihe, _mandRate);
    })();
    var _kstJ = _kstR[_kstR.length - 1];
    var _kst = _kstJ.kst;
    var _ergCol = _erg >= 0 ? 'var(--gold-d)' : 'var(--green)';
    var _rateTxt = (_mandRate * 100).toFixed(1).replace('.', ',') + ' %';
    box.innerHTML =
      '<div class="tax-grid">' +
        '<div class="tax-item" style="grid-column:1/-1;background:#1b1408;border-color:var(--gold-d)"><div class="tax-label" style="color:var(--gold-h)">Halter \u00b7 ' + (_mandName || 'Gesellschaft') + '</div><div class="tax-val" style="color:var(--gold-h)">K\u00f6rperschaftsteuer-Regime \u00b7 ' + _rateTxt + '</div></div>' +
        /* v814-B */ '<div class="tax-item" style="grid-column:1/-1;background:transparent;border-color:rgba(201,168,76,0.15)"><div class="tax-label" style="font-size:12px;color:var(--muted)">Halter wechseln</div><div class="tax-val" style="font-size:12px"><a href="#" onclick="if(typeof showSettings===&quot;function&quot;)showSettings();return false" style="color:var(--gold-d);text-decoration:underline">In den Einstellungen &rarr;</a></div></div>' +
        '<div class="tax-item"><div class="tax-label">Einnahmen V+V</div><div class="tax-val">' + fE(totals.einnahmen, 0) + '</div></div>' +
        '<div class="tax-item"><div class="tax-label">Werbungskosten gesamt</div><div class="tax-val c-red">' + fE(totals.werbungskosten, 0) + '</div></div>' +
        '<div class="tax-item tax-highlight" style="grid-column:1/-1"><div class="tax-label">Beitrag zum GmbH-Ergebnis (' + displayYear + ')</div><div class="tax-val" style="color:' + _ergCol + '">' + fE(_erg, 0, true) + '</div></div>' +
        '<div class="tax-item"><div class="tax-label">K\u00f6rperschaftsteuer-Satz</div><div class="tax-val">' + _rateTxt + '</div></div>' +
        '<div class="tax-item tax-result"><div class="tax-label">K\u00f6rperschaftsteuer (dieses Objekt)</div><div class="tax-val" style="color:' + (_erg >= 0 ? 'var(--red)' : 'var(--green)') + ';font-size:20px">' + (_erg >= 0 ? '\u2212' + fE(_kst, 0) : '0 \u20ac') + '</div></div>' +
        (_erg < 0 ? '<div class="tax-item" style="grid-column:1/-1;opacity:.9"><div class="tax-label">Verlust</div><div class="tax-val" style="color:var(--green)">keine Erstattung \u00b7 Verlustvortrag ins Folgejahr (Stand ' + fE(_kstJ.vortragNach, 0) + ')</div></div>' : '') +
        (_kstJ.genutzt > 0 ? '<div class="tax-item" style="grid-column:1/-1;opacity:.9"><div class="tax-label">Verlustvortrag verrechnet (\u00a7 10d EStG)</div><div class="tax-val" style="color:var(--green)">' + fE(_kstJ.genutzt, 0) + ' aus den Vorjahren \u00b7 Rest ' + fE(_kstJ.vortragNach, 0) + '</div></div>' : '') +
        (function(){  /* v813-3c: echte Mandanten-Steuerakte (KSt ueber alle Objekte der Gesellschaft) */
          try {
            var _curId = (window._currentObjId || (window.State && State.currentObjectId) || window._currentObjKey || null);
            var _curHalter = null;
            try { var _hs2 = document.getElementById('halter'); _curHalter = _hs2 ? _hs2.value : null; } catch(_e){}
            if (!_curHalter || _curHalter === 'privat' || !window.DealPilotWKAggregator) return '';
            var _all = DealPilotWKAggregator.getAllObjectsWithWK();
            if (!Array.isArray(_all)) return '';
            var _yk = String(displayYear);
            var _sum = 0, _n = 0, _curInList = false;
            _all.forEach(function(o){
              if (!o || (o.halter || 'privat') !== _curHalter) return;
              if (o.id === _curId) _curInList = true;
              var _vv = (o.wk_per_year && typeof o.wk_per_year[_yk] === 'number') ? o.wk_per_year[_yk] : null;
              if (o.id === _curId && _vv == null) _vv = _erg;
              if (typeof _vv !== 'number') return;
              _sum += _vv; _n++;
            });
            if (!_curInList) { _sum += _erg; _n++; }
            /* v2891: KSt der Gesellschaft nach Verlustvortrag - die Summen
               aller Vorjahre aus den gespeicherten Jahresergebnissen. */
            var _jahre = {};
            _all.forEach(function (o) {
              if (!o || (o.halter || 'privat') !== _curHalter || o.id === _curId) return;
              Object.keys(o.wk_per_year || {}).forEach(function (k) {
                var j = parseInt(k, 10), w = Number(o.wk_per_year[k]);
                if (j < displayYear && isFinite(w)) _jahre[j] = (_jahre[j] || 0) + w;
              });
            });
            for (var _ki2 = 0; _ki2 < yearIdx && _ki2 < State.cfRows.length; _ki2++) {
              var _cj = State.cfRows[_ki2] && State.cfRows[_ki2].cal;
              if (typeof _cj === 'number' && _cj < displayYear) _jahre[_cj] = (_jahre[_cj] || 0) + _vvRoh(_cj, _ki2).ergebnis;
            }
            var _reiheG = Object.keys(_jahre).map(Number).sort(function (a, b) { return a - b; })
              .map(function (j) { return { jahr: j, erg: _jahre[j] }; });
            _reiheG.push({ jahr: displayYear, erg: _sum });
            var _kG = _kstMitVortrag(_reiheG, _mandRate);
            var _kstGes = _kG[_kG.length - 1].kst;
            var _sumCol = _sum >= 0 ? 'var(--gold-d)' : 'var(--green)';
            return '<div class="tax-item" style="grid-column:1/-1;background:#140f06;border-color:var(--gold-d)">'
                 +   '<div class="tax-label" style="color:var(--gold-h)">Mandanten-Steuerakte &middot; ' + (_mandName || 'Gesellschaft') + ' (' + _n + ' Objekt' + (_n === 1 ? '' : 'e') + ', ' + displayYear + ')</div>'
                 +   '<div class="tax-val" style="color:' + _sumCol + '">Gesamt-Ergebnis ' + fE(_sum, 0, true) + '</div>'
                 + '</div>'
                 + '<div class="tax-item tax-result" style="grid-column:1/-1">'
                 +   '<div class="tax-label">K&ouml;rperschaftsteuer der Gesellschaft (' + displayYear + ')</div>'
                 +   '<div class="tax-val" style="color:' + (_sum >= 0 ? 'var(--red)' : 'var(--green)') + ';font-size:20px">' + (_sum >= 0 ? '&minus;' + fE(_kstGes, 0) : '0 &euro;') + '</div>'
                 + '</div>'
                 + (_sum < 0 ? '<div class="tax-item" style="grid-column:1/-1;opacity:.9"><div class="tax-label">Gesellschaft im Verlust</div><div class="tax-val" style="color:var(--green)">keine KSt &middot; Verlustvortrag</div></div>' : '');
          } catch(_e) { return ''; }
        })() +
        /* ═══════════════════════════════════════════════════════════════
           v1228 · DIE ZWEITE STEUEREBENE.
           ───────────────────────────────────────────────────────────────
           Marcel hat sie ausdruecklich gewollt: "Ja, als eigene Zeile."

           Bis hierher endet die Rechnung beim Gewinn der Gesellschaft —
           15,825 % gegen einen persoenlichen Satz von vielleicht 42 %.
           So verglichen gewinnt die GmbH immer, und der Vergleich ist
           falsch: was ENTNOMMEN wird, kostet beim Gesellschafter noch
           einmal. 25 % Kapitalertragsteuer plus Soli auf die
           Ausschuettung, also 26,375 %, oder auf Antrag das
           Teileinkuenfteverfahren.

           Gerechnet wird die volle Ausschuettung des Jahresergebnisses,
           weil das der Fall ist, in dem der Vergleich mit dem privaten
           Halten ueberhaupt Sinn ergibt. Bleibt der Gewinn in der
           Gesellschaft, gilt weiter der niedrige Satz — beide Wege stehen
           deshalb nebeneinander, statt dass einer behauptet wird.
           ═══════════════════════════════════════════════════════════════ */
        (function () {
          try {
            if (!(_erg > 0)) return '';
            var _nachKSt = _erg - _kst;
            var _kap = _nachKSt * 0.26375;          /* 25 % KapESt + 5,5 % Soli darauf */
            var _beim = _nachKSt - _kap;
            var _gesamt = _erg > 0 ? (1 - _beim / _erg) : 0;
            return '<div class="tax-item" style="grid-column:1/-1;background:transparent;border-color:rgba(201,168,76,.22)">'
                 +   '<div class="tax-label" style="color:var(--gold-h)">Wenn ausgesch&uuml;ttet wird &middot; zweite Steuerebene</div>'
                 +   '<div class="tax-val" style="font-size:13px;color:var(--muted);line-height:1.5">'
                 +     'Nach K&ouml;rperschaftsteuer ' + fE(_nachKSt, 0)
                 +     ' &middot; abz&uuml;glich Kapitalertragsteuer 26,375 % ' + fE(_kap, 0)
                 +   '</div>'
                 + '</div>'
                 + '<div class="tax-item tax-result" style="grid-column:1/-1">'
                 +   '<div class="tax-label">Beim Gesellschafter angekommen (' + displayYear + ')</div>'
                 +   '<div class="tax-val" style="color:var(--gold-h);font-size:20px">' + fE(_beim, 0)
                 +     ' <span style="font-size:12px;color:var(--muted);font-weight:400">von ' + fE(_erg, 0)
                 +     ' &middot; Gesamtbelastung ' + (_gesamt * 100).toFixed(1).replace('.', ',') + ' %</span></div>'
                 + '</div>'
                 + '<div class="tax-item" style="grid-column:1/-1;background:transparent;border:0;padding-top:0">'
                 +   '<div class="tax-val" style="font-size:11.5px;color:var(--muted);line-height:1.5;font-weight:400">'
                 +     'Gerechnet ist die <b>volle Aussch&uuml;ttung</b> &mdash; nur so ist der Vergleich mit dem '
                 +     'privaten Halten ehrlich. Bleibt der Gewinn in der Gesellschaft und wird weiter '
                 +     'investiert, gilt weiterhin ' + _rateTxt + '. Auf Antrag kann statt der '
                 +     'Abgeltungsteuer das Teileinkünfteverfahren g&uuml;nstiger sein (&sect; 32d Abs. 2 Nr. 3 EStG) &mdash; '
                 +     'das h&auml;ngt am pers&ouml;nlichen Satz und geh&ouml;rt zum Steuerberater.'
                 +   '</div>'
                 + '</div>';
          } catch (_eA) { return ''; }
        })() +
      '</div>';
  }

  // V279-debounced: renderTaxModule ruft Debouncer mit aktualisierter taxTimeline
  try {
    if (window._currentObjKey && typeof displayYear === 'number' && totals && typeof totals.ergebnis === 'number'
        && typeof window._scheduleTaxSnapshotPost === 'function') {
      /* v2890: eine Reihe, die zu einem anderen Objekt gehoert, wird nie
         uebernommen - dann geht nur das angezeigte Jahr mit; die volle Reihe
         schreibt renderTaxTimeline gleich danach. */
      var _tlEigen = Array.isArray(State.taxTimeline) && State.taxTimelineKey === window._currentObjKey;
      // taxTimeline mit UI-Wert updaten
      if (_tlEigen) {
        var _tlIdx = State.taxTimeline.findIndex(function(t){ return t && t.year === displayYear; });
        if (_tlIdx >= 0) State.taxTimeline[_tlIdx].immoResult = totals.ergebnis;
      }
      // Snapshot zusammenstellen
      var _newWk = {};
      if (_tlEigen) {
        State.taxTimeline.forEach(function(t){
          if (t && typeof t.year === 'number' && typeof t.immoResult === 'number') {
            _newWk[String(t.year)] = Math.round(t.immoResult);
          }
        });
      }
      _newWk[String(displayYear)] = Math.round(totals.ergebnis);
      window._scheduleTaxSnapshotPost(_newWk);
    }
  } catch (e) { console.warn('[V279] module snapshot error:', e); }

  // Cache for PDF export
  State.taxResult = {
    immoResult: totals.ergebnis, isProfit: isProfit,
    baseIncome: baseIncome, newZvE: baseIncome + totals.ergebnis,
    taxBefore: impact.taxBefore, taxAfter: impact.taxAfter,
    taxDelta: impact.taxDelta, refund: impact.refund,
    grenzsteuersatzAfter: impact.grenzsteuersatzAfter,
    avgAfter: impact.avgAfter
  };

  // EStG view in Persönliche Steuer card
  var estgView = document.getElementById('estg_view');
  if (estgView) estgView.textContent = fE(impact.taxBefore, 0);
}


// ═══════════════════════════════════════════════════
// STEUERVERLAUF über mehrere Jahre
// ═══════════════════════════════════════════════════
function renderTaxTimeline() {
  if (!State.cfRows || !State.cfRows.length) return;
  if (typeof Tax === 'undefined') return;

  var box = document.getElementById('tax-timeline-box');
  if (!box) return;

  // V110 BUG-FIX: Vorher rechnete der Verlauf eigene Werte (wm_y - zy - bwk_y - afa).
  //               Das war inkonsistent zum Steuerformular pro Jahr — Sanierung, Möblierung,
  //               umlagefähige NK, Verwaltungskosten etc. fehlten komplett. Folge: Erstattung
  //               im Verlauf wich teils stark von Erstattung im Detail-Formular ab.
  //               Jetzt nutzt der Verlauf _computeYearTotal() — die einzige Quelle der Wahrheit.
  if (typeof _computeYearTotal !== 'function') return;

  /* v2891 · GESPEICHERT WIRD DIE GANZE HALTEDAUER, GEZEIGT WERDEN 15 KARTEN.
     Bis v2890 gingen nur die ersten 15 Jahre ins Jahresergebnis: ab dem 16.
     Jahr fehlte ein Vorobjekt in der Saldierung jedes spaeter gekauften
     (Am Markt 9, Kauf 2024, fuehrte nur 2024-2026). */
  var years = State.cfRows.slice();

  var timelineVoll = years.map(function(r, i) {
    var totals = _computeYearTotal(r.cal, i);
    return {
      year: r.cal,
      einnahmen: totals.einnahmen,
      werbungskosten: totals.werbungskosten,
      immoResult: totals.ergebnis,
      taxDelta: totals.taxDelta,
      refund: totals.refund
    };
  });
  var timeline = timelineVoll.slice(0, 15);   /* die Karten */

  /* v2890 · DIE REIHE WIRD GESPEICHERT, BEVOR EIN ZWEIG ZURUECKKEHRT.
     Der GmbH/UG-Zweig unten endet mit return - bis v2889 VOR dieser Stelle.
     State.taxTimeline blieb dann die Reihe des zuvor geoeffneten Objekts,
     und renderTaxModule schrieb sie als Snapshot unter der Kennung der
     Gesellschaft (gemessen auf Staging: Hoelderlinstr. 1 trug die Reihe von
     Musterstrasse 12, Am Markt 9 die von Westerfeldstr. 140). Die Reihe
     traegt jetzt die Kennung ihres Objekts. */
  State.taxTimeline = timelineVoll;
  State.taxTimelineKey = window._currentObjKey || null;
  try {
    if (window._currentObjKey && Array.isArray(timelineVoll) && typeof window._scheduleTaxSnapshotPost === 'function') {
      var _wkSnap = {};
      timelineVoll.forEach(function(t) {
        if (t && typeof t.year === 'number' && typeof t.immoResult === 'number') {
          _wkSnap[String(t.year)] = Math.round(t.immoResult);
        }
      });
      if (Object.keys(_wkSnap).length > 0) {
        window._scheduleTaxSnapshotPost(_wkSnap);
      }
    }
  } catch (e) { console.warn('[V279] timeline snapshot error:', e); }

  /* v814-C: bei GmbH/UG -> KSt-Jahresverlauf der Gesellschaft statt ESt-Erstattung */
  var _tlCorp = false, _tlRate = null;
  try {
    var _th = document.getElementById('halter'); var _thid = _th ? _th.value : 'privat';
    if (window.DealPilotMandanten && DealPilotMandanten.get) {
      var _tm = DealPilotMandanten.get(_thid);
      _tlCorp = !!(_tm && DealPilotMandanten.isCorp && DealPilotMandanten.isCorp(_tm.rechtsform));
      if (_tlCorp && DealPilotMandanten.effRate) _tlRate = DealPilotMandanten.effRate(_thid);
    }
  } catch (_e) {}
  var _tlHdr = document.getElementById('tax-timeline-header');
  if (_tlCorp && _tlRate != null) {
    if (_tlHdr) _tlHdr.innerHTML = '<span class="ct-ico"><svg width="22" height="22"><use href="#i-calendar"/></svg></span>K&ouml;rperschaftsteuer-Verlauf der Gesellschaft';
    try { var _stvK = document.getElementById('tax-verlauf-chart'); if (_stvK) _stvK.innerHTML = ''; } catch (_e2) {}   /* v2544: die ESt-Grafik gilt nicht für die Gesellschaft */
    var _activeY = State._taxDisplayYear || new Date().getFullYear();
    var chtml = '<div class="tax-tl-grid">';
    var sumKst = 0;
    /* v2891: KSt je Jahr nach Verlustvortrag aus den Vorjahren */
    var _kstTl = _kstMitVortrag(timeline.map(function (t) { return { jahr: t.year, erg: t.immoResult }; }), _tlRate);
    timeline.forEach(function(t, _ti){
      var kst = _kstTl[_ti].kst;
      sumKst += kst;
      var hasKst = kst > 0.5;
      var color = hasKst ? 'var(--red)' : 'var(--green)';
      var bg = hasKst ? 'rgba(201,76,76,0.1)' : 'rgba(42,154,90,0.1)';
      var isA = (t.year === _activeY);
      var aStyle = isA ? ';outline:2px solid var(--gold,#C9A84C);outline-offset:1px;box-shadow:0 2px 8px rgba(201,168,76,0.3)' : '';
      chtml += '<div class="tax-tl-bar tax-tl-clickable" style="background:' + bg + ';border-left-color:' + color + ';cursor:pointer;transition:all 0.15s' + aStyle + '" '
        + 'onclick="if(typeof renderTaxModule===&quot;function&quot;){renderTaxModule(' + t.year + ');var b=document.getElementById(&quot;tax-result-box&quot;);if(b)b.scrollIntoView({behavior:&quot;smooth&quot;,block:&quot;center&quot;});}" '
        + 'title="Klick: Berechnung für ' + t.year + ' anzeigen">'
        + '<div class="tax-tl-year">' + t.year + '</div>'
        + '<div class="tax-tl-amount" style="color:' + color + '">' + (hasKst ? '&minus;' + Math.round(kst).toLocaleString('de-DE') + ' &euro;' : '0 &euro;') + '</div>'
        + '<div class="tax-tl-label">' + (hasKst ? 'K&ouml;rperschaftsteuer' : 'kein KSt') + '</div>'
        + '</div>';
    });
    chtml += '</div>';
    chtml += '<div class="tax-tl-total"><span>Summe KSt &uuml;ber ' + timeline.length + ' Jahre:</span>'
      + '<span style="color:var(--red);font-weight:700;font-size:18px">' + (sumKst > 0.5 ? '&minus;' + Math.round(sumKst).toLocaleString('de-DE') + ' &euro;' : '0 &euro;') + '</span></div>';
    box.innerHTML = chtml;
    return;
  } else if (_tlHdr) {
    _tlHdr.innerHTML = '<span class="ct-ico"><svg width="22" height="22"><use href="#i-calendar"/></svg></span>Steuerverlauf &middot; wann das Objekt steuerlich positiv wird';
  }
  /* v2544 · DIE GRAFIK MIT WENDEPUNKT über der Kärtchen-Reihe (steuer-verlauf.js;
     Marcel 20.10.2026: „wann ein Objekt ins Positive läuft und man Steuern zahlen
     müsste – das ist der Punkt, wo ich investiere"). Dieselben Jahreswerte
     (_computeYearTotal), über die ganze Haltedauer. */
  try {
    var _stvH = document.getElementById('tax-verlauf-chart');
    if (!_stvH && box.parentNode) {
      _stvH = document.createElement('div'); _stvH.id = 'tax-verlauf-chart';
      var _vor = box.previousElementSibling && /hint/.test(box.previousElementSibling.className || '') ? box.previousElementSibling : box;
      box.parentNode.insertBefore(_stvH, _vor);
    }
    if (_stvH && window.DpSteuerVerlauf) window.DpSteuerVerlauf.mount(_stvH);
  } catch (_stvE) {}
  // Render as visual timeline
  var html = '<div class="tax-tl-grid">';
  /* V270-cardClick: Klickbare Cards → laden Berechnung in Steuermodul oben */
  var _activeYear = State._taxDisplayYear || new Date().getFullYear();
  timeline.forEach(function(t) {
    var positive = t.refund > 0;
    var color = positive ? 'var(--green)' : 'var(--red)';
    var bgcolor = positive ? 'rgba(42,154,90,0.1)' : 'rgba(201,76,76,0.1)';
    var sign = positive ? '+' : '';
    var isActive = (t.year === _activeYear);
    var activeStyle = isActive
      ? ';outline:2px solid var(--gold,#C9A84C);outline-offset:1px;box-shadow:0 2px 8px rgba(201,168,76,0.3)'
      : '';
    html += '<div class="tax-tl-bar tax-tl-clickable" ' +
      'style="background:' + bgcolor + ';border-left-color:' + color + ';cursor:pointer;transition:all 0.15s' + activeStyle + '" ' +
      'onclick="if(typeof renderTaxModule===\'function\'){renderTaxModule(' + t.year + ');var b=document.getElementById(\'tax-result-box\');if(b)b.scrollIntoView({behavior:\'smooth\',block:\'center\'});}" ' +
      'title="Klick: Berechnung für ' + t.year + ' anzeigen">' +
      '<div class="tax-tl-year">' + t.year + '</div>' +
      '<div class="tax-tl-amount" style="color:' + color + '">' +
        sign + Math.round(Math.abs(t.refund)).toLocaleString('de-DE') + ' €' +
      '</div>' +
      '<div class="tax-tl-label">' + (positive ? 'Erstattung' : 'Nachzahlung') + '</div>' +
    '</div>';
  });
  html += '</div>';

  // Total
  var totalRefund = timeline.reduce(function(s, t) { return s + t.refund; }, 0);
  html += '<div class="tax-tl-total">' +
    '<span>Summe über ' + timeline.length + ' Jahre:</span>' +
    '<span style="color:' + (totalRefund >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:700;font-size:18px">' +
      (totalRefund >= 0 ? '+' : '') + Math.round(totalRefund).toLocaleString('de-DE') + ' €' +
    '</span>' +
  '</div>';

  box.innerHTML = html;

  /* v2890: State.taxTimeline und der Snapshot stehen jetzt oben, vor dem
     GmbH-Zweig. */
}

// Hook into existing renderTaxModule
/* v2239 · Ohne zvE rechnete der Steuer-Reiter still mit 65.891 EUR nach
   Tarif, die Kennzahlen dagegen linear mit dem Grenzsteuersatz aus Feld
   `grenz` (aus den Einstellungen). Bei 40,45 % fiel das nicht auf - genau
   dort liegt 65.891 EUR. Bei jedem anderen Satz zeigten beide Stellen fuer
   dasselbe Objekt eine andere Steuerwirkung. Jetzt: das zvE, dessen
   Grenzsteuersatz dem eingestellten entspricht (Suche ueber den Tarif). */
window._dpZveErsatz = function () {
  var g = NaN;
  try { g = parseDe((document.getElementById('grenz') || {}).value); } catch (e) {}
  if (!(g > 0)) return 65891;
  var ziel = g / 100, lo = 12000, hi = 280000;
  /* v2891: der eingestellte Satz ist die GANZE Last (wie die Automatik) */
  if (Tax.grenzsatzGesamt(hi) < ziel) return hi;
  if (Tax.grenzsatzGesamt(lo) > ziel) return lo;
  for (var i = 0; i < 40; i++) {
    var m = (lo + hi) / 2;
    if (Tax.grenzsatzGesamt(m) < ziel) lo = m; else hi = m;
  }
  return Math.round(hi);
};
var _origRenderTax = renderTaxModule;
renderTaxModule = function(year) { /* V270.1-hook-passthrough */
  _origRenderTax(year);
  renderTaxTimeline();
};

// ═══════════════════════════════════════════════════
// YEARLY TAX FORM (Steuerformular pro Jahr)
// Quick-Modus default + Detail-Modus per Toggle
// App rechnet als Vorschlag, User kann pro Jahr überschreiben
// ═══════════════════════════════════════════════════

// State for yearly overrides: { year: { field: value, ... } }
if (typeof window._taxYearlyOverrides === 'undefined') {
  window._taxYearlyOverrides = {};
}

function _yearKey(year) { return 'y' + year; }

function _getYearOverride(year, field) {
  var key = _yearKey(year);
  var entry = window._taxYearlyOverrides[key];
  if (!entry) return undefined;
  return entry[field];
}

function _setYearOverride(year, field, value) {
  var key = _yearKey(year);
  if (!window._taxYearlyOverrides[key]) window._taxYearlyOverrides[key] = {};
  if (value === '' || value == null || isNaN(value)) {
    delete window._taxYearlyOverrides[key][field];
  } else {
    window._taxYearlyOverrides[key][field] = parseFloat(value);
  }
}

/**
 * Compute the auto-suggestion for a given year (from cfRows + AfA + base income).
 * Returns: { year, einnahmen_km, einnahmen_nk, schuldzinsen, kontofuehrung, bereitstellung,
 *   notar_grundschuld, vermittlung, finanz_sonst, nk_umlf, nk_n_umlf, betr_sonst,
 *   hausverwaltung, steuerber, porto, verw_sonst, fahrtkosten, verpflegung, hotel,
 *   inserat, gericht, telefon, sonst_kosten, afa, sonst_bewegl_wg }
 */
function _computeAutoForYear(yearIdx, year) {
  // yearIdx is 0-based index into State.cfRows (year 1 = idx 0)
  var row = (State.cfRows && State.cfRows[yearIdx]) ? State.cfRows[yearIdx] : null;

  // V112 BUG-FIX: kpis.afa enthält Gebäude-AfA + Küche-AfA. Aber im Steuerformular pro Jahr
  //   ist Feld 5 "AfA Gebäude" (sollte NUR Gebäude sein), und Feld 6 "AfA bewegliche
  //   Wirtschaftsgüter" enthält separat die Küche/Möblierung. Vorher wurde die Küche in
  //   beiden Feldern aufgeführt → doppelt steuerlich abgesetzt.
  //   Fix: afa-Feld auf reine Gebäude-AfA reduzieren, Küche-AfA in sonst_bewegl_wg aufnehmen.
  var afaBd = (State._afaBreakdown) ? State._afaBreakdown : null;
  var afaGesamt = State.kpis ? (State.kpis.afa || 0) : 0;
  var afaKueche = (afaBd && afaBd.kueche) ? afaBd.kueche : 0;
  // V227: Jahresgenaue Gebäude-AfA (degressive AfA fällt jedes Jahr, § 7b wirkt nur J. 1-4)
  // Fallback auf Jahr-1-Wert wenn Series nicht verfügbar (z.B. wenn Engine noch nicht initialisiert)
  var afaGebaeude;
  var afaSonder7bJahr = 0;
  if (State._afaSeriesNormal && State._afaSeriesNormal.length > yearIdx) {
    afaGebaeude = State._afaSeriesNormal[yearIdx];
    afaSonder7bJahr = (State._afaSeriesSonder && State._afaSeriesSonder[yearIdx]) || 0;
  } else {
    afaGebaeude = afaBd && (afaBd.gebaeude != null) ? afaBd.gebaeude : (afaGesamt - afaKueche);
  }

  // V31/V32: Sanierung + Möblierung steuerlich korrekt verteilen
  // ───────────────────────────────────────────────────────
  var kp_inp = parseDe((document.getElementById('kp') || {}).value) || 0;
  var san_inp = parseDe((document.getElementById('san') || {}).value) || 0;
  var moebl_inp = parseDe((document.getElementById('moebl') || {}).value) || 0;

  // V32: User-Toggles aus Investition-Tab
  var sanActive = (document.getElementById('san_tax_active') || {}).checked !== false;
  /* v2261 · Der Haken „In Steuer-Werbungskosten übernehmen" der Inventar-Box
     (#inv_tax_active) wirkte nicht dauerhaft: gelesen wurde #moebl_tax_active,
     ein VERSTECKTES Textfeld. storage.js sichert davon den Wert (leer), nicht
     den Haken - nach dem Laden war das Inventar immer „nicht übernehmen".
     Das sichtbare Kästchen wird gespeichert und ist die Wahrheit. */
  var _invCb = document.getElementById('inv_tax_active');
  var moeblActive = _invCb
    ? (!!_invCb.checked || (document.getElementById('moebl_tax_active') || {}).checked === true)
    : ((document.getElementById('moebl_tax_active') || {}).checked !== false);
  var sanYearsChoice = (document.getElementById('san_tax_years') || {}).value || 'auto';
  var moeblYearsChoice = parseInt(((document.getElementById('inv_tax_years') || {}).value)
    || (document.getElementById('moebl_tax_years') || {}).value || '10');   /* v2261: sichtbare Auswahl zuerst */

  // SANIERUNG
  // V227: Methode-aware AfA-Satz-Bestimmung für Sanierungs-Laufzeit.
  // Bei degressiv ist der "AfA-Satz" für die Nutzungsdauer-Logik anders:
  //   linear 2.0% → 50 Jahre Nutzungsdauer
  //   linear 2.5% → 40 J.
  //   linear 3.0% → 33 J. (Wohnzwecke ab 2023, Neubau)
  //   degressiv 5%  → effektive Nutzungsdauer ist 33 J. (Neubau, Wohnbau)
  var afa_sel_val = (document.getElementById('afa_satz') || {}).value || '2.0';
  var afa_parsed_for_san = (window.Afa && Afa.parseSelectValue) ? Afa.parseSelectValue(afa_sel_val) : { methode: 'linear', satzPct: parseDe(afa_sel_val) || 2 };
  var afa_satz_pct = afa_parsed_for_san.satzPct;
  // Effektive Nutzungsdauer für anschaffungsnahe HK:
  var afa_nutzungsdauer = (afa_parsed_for_san.methode === 'linear')
    ? Math.round(100 / afa_satz_pct)
    : 33;  // Degressiv → Wohnbau-Neubau-Nutzungsdauer
  /* v2890 · DIE 15-%-GRENZE AUS DERSELBEN RECHNUNG WIE IM TAB INVESTITION.
     Hier stand `kp × 0,15`, verglichen mit dem Bruttobetrag. calc.js rechnet
     seit v1261 richtig (§ 6 Abs. 1 Nr. 1a EStG): 15 % der Gebaeude-
     Anschaffungskosten inklusive anteiliger Nebenkosten, verglichen OHNE
     Umsatzsteuer. Gemessen: Kaufpreis 300.000, Gebaeude 60 %, NK 30.000 ->
     Grenze 29.700 netto. 40.000 brutto sind dort anschaffungsnah (AfA ueber
     die Nutzungsdauer), hier wurden sie als Erhaltungsaufwand auf 5 Jahre
     verteilt - 8.000 statt rund 800 EUR Werbungskosten im Jahr.
     Die Grenze kommt aus State._ahk.sanLimit (calc.js); fehlt sie (erste
     Rechnung vor calc), bleibt der alte Naeherungswert. */
  var sanGrenze15 = (window.State && State._ahk && isFinite(State._ahk.sanLimit) && State._ahk.sanLimit > 0)
    ? State._ahk.sanLimit : kp_inp * 0.15;
  var _sanUstT = (document.getElementById('san_ust') || {}).value || 'brutto';
  var san_netto = (_sanUstT === 'netto') ? san_inp : (san_inp / 1.19);
  var sanAnschaffungsnah, sanLaufzeit, sanAfaJaehrlich;

  if (!sanActive) {
    sanAnschaffungsnah = false;
    sanLaufzeit = 0;
    sanAfaJaehrlich = 0;
  } else if (sanYearsChoice === 'auto') {
    // Automatik: 15%-Regel (netto gegen die Grenze, abgezogen wird brutto)
    sanAnschaffungsnah = san_netto > sanGrenze15;
    /* v2891: unter der Grenze ist der SOFORTABZUG der gesetzliche Normalfall
       (§ 11 Abs. 2 EStG). Die Verteilung auf 2-5 Jahre (§ 82b EStDV) ist ein
       Wahlrecht und steht in der Auswahl daneben - bis v2890 verteilte die
       Automatik stillschweigend auf 5 Jahre. */
    sanLaufzeit = sanAnschaffungsnah ? afa_nutzungsdauer : 1;
    sanAfaJaehrlich = san_inp / sanLaufzeit;
  } else if (sanYearsChoice === '50') {
    // Manuell: anschaffungsnah, also Gebäude-AfA-Nutzungsdauer
    sanAnschaffungsnah = true;
    sanLaufzeit = afa_nutzungsdauer;
    sanAfaJaehrlich = san_inp / sanLaufzeit;
  } else {
    // Manuell: feste Jahresanzahl als Erhaltungsaufwand
    sanAnschaffungsnah = false;
    sanLaufzeit = parseInt(sanYearsChoice);
    sanAfaJaehrlich = san_inp / sanLaufzeit;
  }
  var sanThisYear = (sanLaufzeit > 0 && yearIdx < sanLaufzeit) ? sanAfaJaehrlich : 0;

  // MÖBLIERUNG
  var moeblLaufzeit = moeblYearsChoice;
  var moeblPerYear = moeblActive ? (moebl_inp / moeblLaufzeit) : 0;
  var moeblThisYear = (moeblActive && yearIdx < moeblLaufzeit) ? moeblPerYear : 0;

  // Einnahmen: Nettokaltmiete + zusätzliche Einnahmen (z.B. Stellplatz, Garage)
  var nkm_m = parseDe((document.getElementById('nkm') || {}).value) || 0;
  var ze_m = parseDe((document.getElementById('ze') || {}).value) || 0;
  var mstg = (parseDe((document.getElementById('mietstg') || {}).value) || 1.5) / 100;
  // V23: Detail-Modus der Mietentwicklung nutzt eine Treppen-Funktion statt Compound %.
  // Wenn das Modul nicht geladen ist (Legacy-Fallback), wird mstg compound verwendet.
  var _mFac = (window.MietEntwicklung && typeof MietEntwicklung.factor === 'function')
              ? function(y){ return MietEntwicklung.factor(y); }
              : function(y){ return Math.pow(1 + mstg, y); };
  // Toggle: Erhöhung gilt nur für Nettokaltmiete (Default) ODER auch zE.
  var meIncludeZE = (window.MietEntwicklung && typeof MietEntwicklung.appliesToZE === 'function')
                    ? MietEntwicklung.appliesToZE() : false;
  // Kaltmiete (NKM) wächst mit Faktor; zE wächst je nach Toggle mit oder ohne
  var einnahmen_nkm = nkm_m * 12 * _mFac(yearIdx);
  var einnahmen_ze  = ze_m  * 12 * (meIncludeZE ? _mFac(yearIdx) : 1.0);
  var einnahmen_km = einnahmen_nkm + einnahmen_ze;

  // Umlagefähige Nebenkosten — wachsen mit Kostensteigerung (kstg), nicht mit Mietsteigerung.
  // V23-Fix: vorher wurden hier mistg verwendet, das ist konzeptionell falsch
  // (umlagefähige NK sind keine Mieteinnahme, sondern durchlaufender Posten).
  var nk_umlf_m = parseDe((document.getElementById('umlagef') || {}).value) || 0;
  var kstg = (parseDe((document.getElementById('kostenstg') || {}).value) || 1.0) / 100;
  var einnahmen_nk = nk_umlf_m * 12 * Math.pow(1 + kstg, yearIdx);

  // ═══════════════════════════════════════════════════════════════
  // V269c1-einnahmen-y1: Einnahmen Jahr 1 anteilig nach WU
  // Konsistent zu cfRows (V269c) — gleicher wuFactor.
  // Wirkt nur bei yearIdx === 0 UND WU mitten im Jahr.
  // ═══════════════════════════════════════════════════════════════
  if (yearIdx === 0 && typeof window.DealPilotAnteilig === 'object'
      && typeof window.DealPilotAnteilig.getWuMonths === 'function') {
    try {
      var _v269c1_wuMonths = window.DealPilotAnteilig.getWuMonths(year);
      if (typeof _v269c1_wuMonths === 'number' && _v269c1_wuMonths >= 0 && _v269c1_wuMonths < 12) {
        var _v269c1_factor = _v269c1_wuMonths / 12;
        einnahmen_nkm *= _v269c1_factor;
        einnahmen_ze  *= _v269c1_factor;
        einnahmen_km  = einnahmen_nkm + einnahmen_ze;
        einnahmen_nk  *= _v269c1_factor;
      }
    } catch(_v269c1_e) {
      console.warn('[V269c.1] Einnahmen Y1-Anteil:', _v269c1_e.message);
    }
  }

  // Schuldzinsen aus cfRows
  var schuldzinsen = row ? (row.zy || 0) : 0;
  /* ═══ v1898 · DIE BEWIRTSCHAFTUNG KOMMT AUS DEM RECHENKERN ═════════════
   *
   * Hier stand bis zum 06.10.2026 eine SCHAETZUNG:
   *
   *     bwk_total = row.bwk_y              // ul + nul, die GESAMT-BWK
   *     nk_n_umlf    = bwk_total * 0.30
   *     hausverwaltung = bwk_total * 0.20
   *     betr_sonst   = bwk_total * 0.05    // zusammen 55 %
   *
   * Zwei Dinge waren daran falsch, und das zweite ist das teurere:
   *
   * 1 · Die 55 % liefen auf die GESAMT-BWK, also auch auf den
   *     UMLAGEFAEHIGEN Teil. Der steht aber schon als `nk_umlf` in der
   *     Werbungskostensumme (und als `einnahmen_nk` dagegen) — der
   *     durchlaufende Posten, den der Kommentar an der Summenformel
   *     ausdruecklich so beschreibt. 55 % des umlagefaehigen Teils wurden
   *     damit ein ZWEITES Mal abgezogen. Gemessen am Objekt d65ed5cb
   *     (Staging): ul = 1.681 EUR, davon 55 % = 924,55 EUR zusaetzlich.
   *     Marcel am 06.10.2026 zu Punkt zwei der Liste: „da musst du
   *     schauen, was jetzt passt. Also doppelt gezaehlt werden soll das
   *     nicht."
   *
   * 2 · Es war eine Schaetzung, obwohl die echte Zahl zwei Felder weiter
   *     liegt. `cfRows` fuehrt je Jahr `bwk_st_y` — die nicht
   *     umlagefaehige Bewirtschaftung dieses Jahres OHNE
   *     Mietausfallwagnis, gebildet vom Rechenkern in calc.js und mit der
   *     Kostensteigerung fortgeschrieben. Genau das ist der Betrag, den
   *     § 9 EStG abziehen laesst.
   *
   * RUECKFALL: aeltere `cfRows` (vor v1898) kennen `bwk_st_y` nicht. Dann
   * gilt `bwk_cf_y` — die nicht umlagefaehige BWK MIT Wagnis, immer noch
   * naeher an der Wahrheit als 55 % der Gesamtsumme. Geprueft wird auf
   * ABWESENHEIT, nicht auf Wahrheitswert: eine Bewirtschaftung von 0 ist
   * eine Angabe, `undefined` ist keine.
   *
   * KEINE AUFTEILUNG MEHR AUF DREI ZEILEN: der Detail-Modus erfasst den
   * eigenen Hausgeldanteil als EINEN Posten. Welcher Euro darin
   * Verwalterhonorar ist, weiss die App nicht — und eine 20/30/5-Quote
   * waere wieder eine erfundene Zahl. Alles steht deshalb in
   * `nk_n_umlf`; wer es auf die Anlage-V-Zeilen verteilen will, kann die
   * Zeilen ueberschreiben (`_getYearOverride` greift unveraendert). */
  var bwk_total = row ? (row.bwk_y || 0) : 0;
  var betriebskosten_n_umlf = 0;
  if (row && row.bwk_st_y != null && isFinite(row.bwk_st_y)) {
    betriebskosten_n_umlf = row.bwk_st_y;
  } else if (row && row.bwk_cf_y != null && isFinite(row.bwk_cf_y)) {
    betriebskosten_n_umlf = row.bwk_cf_y;
  } else {
    betriebskosten_n_umlf = bwk_total * 0.55;   /* nur ohne cfRows */
  }
  var verwaltung = 0;
  var sonst_bewirt = 0;

  return {
    year: year,
    yearIdx: yearIdx,

    // 1.0 Finanzierungskosten
    schuldzinsen: schuldzinsen,
    /* v1898: war 8 EUR „typisch" — eine erfundene Zahl. In Marcels
       Einstellungen gibt es dafuer keine Pauschale, und die Doktrin sagt:
       wo keine Quelle ist, wird nicht geschaetzt. Das Feld bleibt
       ueberschreibbar, es schlaegt nur nichts mehr vor. (v646 hat
       `steuerber` und `telefon` aus demselben Grund auf 0 gesetzt.) */
    kontofuehrung: 0,
    bereitstellung: 0,
    notar_grundschuld: 0,
    vermittlung: 0,
    finanz_sonst: 0,

    // 2.0 Betriebskosten
    nk_umlf: einnahmen_nk,        // wird gegen Einnahmen verrechnet
    nk_n_umlf: betriebskosten_n_umlf,
    betr_sonst: sonst_bewirt,

    // 3.0 Verwaltungskosten
    hausverwaltung: verwaltung,
    steuerber: 0,  /* v646: kein Auto-Vorschlag */
    porto: 0,      /* v1898: war 5 EUR ohne Quelle — siehe kontofuehrung */
    verw_sonst: 0,

    // 4.0 Sonstige Kosten
    fahrtkosten: 0,
    verpflegung: 0,
    hotel: 0,
    inserat: 0,
    gericht: 0,
    telefon: 0,  /* v646: kein Auto-Vorschlag */
    sonst_kosten: 0,

    // 5.0 AfA Gebäude — V112 reine Gebäude-AfA (ohne Küche)
    // V227: + § 7b Sonder-AfA (wirkt nur in den ersten 4 Jahren)
    /* v1225 · die beiden Summanden bleiben getrennt VERFUEGBAR. Der Unterstrich
       sagt: kein Formularfeld, sondern eine Auskunft ueber die Zusammensetzung
       von `afa`. (v1258: der Satz „_computeYearTotal reicht sie weiter"
       stand hier und war FALSCH — die Funktion baut ihre Werte nur aus
       ihrer `fields`-Liste, und dort stehen die beiden nicht. Behoben in
       _computeYearTotal selbst.) Die Anlage-V-Seite
       braucht sie fuer Zeile 35 gegen Zeile 38. Die Summe oben bleibt exakt
       dieselbe — hier wird nichts umgerechnet. */
    _afaLinear: afaGebaeude,
    _afaSonder7b: afaSonder7bJahr,
    afa: afaGebaeude + afaSonder7bJahr,

    // 6.0 AfA bewegliche Wirtschaftsgüter
    // V31: Möblierung → 10 Jahre AfA
    // V112: + Küche-AfA (vorher fälschlich in afa-Feld → Doppelung)
    sonst_bewegl_wg: moeblThisYear + afaKueche,

    // 6.5 Anschaffungsnahe Herstellkosten / Erhaltungsaufwand
    // V31: Sanierung → je nach 15%-Grenze entweder als anschaffungsnah (AfA) oder als Erhaltungsaufwand (5 Jahre)
    anschaffungsnah:    sanAnschaffungsnah ? sanThisYear : 0,
    erhaltungsaufwand: !sanAnschaffungsnah ? sanThisYear : 0,

    // 7.0 Einnahmen
    einnahmen_km: einnahmen_km,
    einnahmen_nk: einnahmen_nk
  };
}

function _getEffectiveValue(year, field, autoVal) {
  var ov = _getYearOverride(year, field);
  return ov !== undefined ? ov : autoVal;
}

/**
 * Compute the year totals (Verlust/Überschuss + Steuer) using overrides where present.
 */
/* v1215-mappe · `vorgabe` erlaubt es, die 26 Werte von AUSSEN zu setzen —
   fuer die Steuer-Mappe ueber alle Objekte, wo die Zahlen aus einem
   gespeicherten Satz (GET /tax-records) kommen und nicht aus dem geoeffneten
   Objekt. Die SUMMENFORMEL darunter bleibt, wo sie ist: sie ist die einzige
   Wahrheit ueber Werbungskosten, Einnahmen und Ergebnis, und eine zweite
   Fassung davon waere genau der Fehler, den der Kommentar bei
   _renderSteuerwirkung verbietet.
   OHNE `vorgabe` ist das Verhalten bitgleich zu vorher. */
/* ═══ v2891 · VERLUSTVORTRAG (§ 10d EStG), NUR VORTRAG ══════════════════
   Uebersteigt der Verlust eines Jahres das Einkommen, wurde der Rest bis
   v2890 still verworfen (zvE auf 0 gekappt). Jetzt wandert er ins naechste
   Jahr und mindert dort das zvE, bis er aufgebraucht ist. Den Ruecktrag ins
   Vorjahr rechnet DealPilot nicht - er setzt eine Veranlagung voraus, die
   vor dem Objekt liegt; der Rest steht dann vollstaendig im Vortrag, und
   die Box sagt das. Die Mindestbesteuerung (1 Mio. EUR, darueber 60/70 %)
   greift bei Privatanlegern praktisch nie und bleibt aussen vor.

   Je Jahr wird die Reihe ab dem ersten Jahr durchlaufen. Damit das nicht
   quadratisch teuer wird, merkt sich `_vvMerk` jedes Rohergebnis bis zum
   Ende der laufenden Aufgabe (Microtask) - danach ist der Merker leer, und
   eine Eingabe des Nutzers rechnet immer frisch. */
/* v2891 · KOERPERSCHAFTSTEUER MIT VERLUSTVORTRAG (§ 8 Abs. 1 KStG i. V. m.
   § 10d EStG). Bis v2890 stand je Jahr max(0, Ergebnis) × Satz: ein Verlust
   im Jahr 1 minderte die Steuer im Jahr 2 nicht, die KSt spaeterer Jahre lag
   zu hoch. Mindestbesteuerung: bis 1 Mio. EUR voll verrechenbar, darueber
   70 % (VZ 2024-2027, Wachstumschancengesetz), sonst 60 %. Derselbe Satz
   gilt hier fuer den Gewerbesteueranteil des Halter-Satzes - § 10a GewStG
   verrechnet nach demselben Muster (dort 60 %); bei Objekten dieser
   Groessenordnung wird die Millionengrenze nicht erreicht. */
function _kstMitVortrag(reihe, rate) {
  var vortrag = 0, aus = [];
  (reihe || []).forEach(function (r) {
    var erg = Number(r.erg) || 0, genutzt = 0, bem = 0;
    if (erg < 0) { vortrag += -erg; }
    else if (erg > 0) {
      var quote = (r.jahr >= 2024 && r.jahr <= 2027) ? 0.70 : 0.60;
      var grenze = Math.min(erg, 1000000) + Math.max(0, erg - 1000000) * quote;
      genutzt = Math.min(vortrag, grenze);
      vortrag -= genutzt;
      bem = erg - genutzt;
    }
    aus.push({ jahr: r.jahr, erg: erg, genutzt: genutzt, bemessung: bem,
               kst: bem * (rate || 0), vortragNach: vortrag });
  });
  return aus;
}
window._dpKstMitVortrag = _kstMitVortrag;

var _vvMerk = null;
function _vvRoh(year, idx) {
  if (!_vvMerk) {
    _vvMerk = {};
    try { Promise.resolve().then(function () { _vvMerk = null; }); } catch (e) { _vvMerk = null; }
  }
  var k = year + '|' + idx;
  if (_vvMerk && _vvMerk[k]) return _vvMerk[k];
  var t = _computeYearTotal(year, idx, undefined, true);
  var r = { ergebnis: t.ergebnis, basis: t.zve };
  if (_vvMerk) _vvMerk[k] = r;
  return r;
}
function _dpVerlustvortragBis(yearIdx) {
  if (!(yearIdx > 0) || !State || !Array.isArray(State.cfRows)) return 0;
  var vortrag = 0;
  for (var i = 0; i < yearIdx && i < State.cfRows.length; i++) {
    var row = State.cfRows[i];
    if (!row || typeof row.cal !== 'number') continue;
    var r = _vvRoh(row.cal, i);
    var gesamt = r.basis + r.ergebnis;
    if (gesamt < 0) vortrag += -gesamt;
    else if (vortrag > 0) vortrag -= Math.min(vortrag, gesamt);
  }
  return vortrag;
}
window._dpVerlustvortragBis = _dpVerlustvortragBis;

function _computeYearTotal(year, yearIdx, vorgabe, ohneVortrag) {
  var auto = vorgabe ? {} : _computeAutoForYear(yearIdx, year);
  var fields = [
    'schuldzinsen', 'kontofuehrung', 'bereitstellung', 'notar_grundschuld',
    'vermittlung', 'finanz_sonst',
    'nk_umlf', 'nk_n_umlf', 'betr_sonst',
    'hausverwaltung', 'steuerber', 'porto', 'verw_sonst',
    'fahrtkosten', 'verpflegung', 'hotel', 'inserat', 'gericht', 'telefon',
    'sonst_kosten', 'afa', 'sonst_bewegl_wg',
    'anschaffungsnah', 'erhaltungsaufwand',
    'einnahmen_km', 'einnahmen_nk'
  ];
  var values = {};
  fields.forEach(function(f) {
    values[f] = vorgabe ? (Number(vorgabe[f]) || 0) : _getEffectiveValue(year, f, auto[f]);
  });

  /* v1258 · Die Aufteilung von `afa` mitführen.
     `fields` listet nur Formularfelder — Werte, die der Nutzer
     überschreiben kann. `_afaLinear` und `_afaSonder7b` sind keine
     Eingaben, sondern eine Auskunft darüber, woraus `afa` besteht; sie
     gehören deshalb NICHT in die Liste und nicht durch
     _getEffectiveValue.

     Der Kommentar bei tax.js:1061 behauptete seit v1225, diese Funktion
     reiche die beiden weiter. Sie tat es nicht — sie baut `values`
     ausschliesslich aus `fields`. Gemessen am 08.09.2026: `afa` kam mit
     1936 an, beide Unterstrich-Felder als undefined. Zurückgenommen und
     hier behoben.

     Bei einem GESPEICHERTEN Satz (`vorgabe`) kommen sie aus der
     Datenbank und heissen dort afa_linear / afa_sonder_7b. Fehlen sie —
     jeder Satz vor v1258 — bleibt es bei null, NICHT bei 0: „nicht
     erhoben" ist etwas anderes als „kein Paragraf 7b". */
  if (vorgabe) {
    values._afaLinear   = (vorgabe.afa_linear    != null) ? Number(vorgabe.afa_linear)    : null;
    values._afaSonder7b = (vorgabe.afa_sonder_7b != null) ? Number(vorgabe.afa_sonder_7b) : null;
  } else {
    values._afaLinear   = (auto._afaLinear   != null) ? auto._afaLinear   : null;
    values._afaSonder7b = (auto._afaSonder7b != null) ? auto._afaSonder7b : null;
  }

  // Werbungskosten — umlagefähige NK ist Teil davon (Excel-Logik: durchlaufender Posten)
  var werbungskosten =
    values.schuldzinsen + values.kontofuehrung + values.bereitstellung +
    values.notar_grundschuld + values.vermittlung + values.finanz_sonst +
    values.nk_umlf + values.nk_n_umlf + values.betr_sonst +
    values.hausverwaltung + values.steuerber + values.porto + values.verw_sonst +
    values.fahrtkosten + values.verpflegung + values.hotel + values.inserat +
    values.gericht + values.telefon + values.sonst_kosten +
    values.afa + values.sonst_bewegl_wg +
    (values.anschaffungsnah || 0) + (values.erhaltungsaufwand || 0);

  // Einnahmen V+V = Kaltmiete + Nebenkosten umlagefähig
  var einnahmen = values.einnahmen_km + values.einnahmen_nk;

  var ergebnis = einnahmen - werbungskosten;

  // Steuer: zvE base + ergebnis
  // V275-tax-cards-zve: Jahr-spezifisches zvE aus DealPilotTaxPeriods

  /* v2890: zvE und Bestandssaldo ueber den EINEN Weg (_dpSteuerBasis),
     derselbe wie die Ergebnisbox. Mit `vorgabe` rechnet diese Funktion fuer
     ein FREMDES Objekt (Steuer-Mappe): der Saldo haengt am Kaufdatum des
     geoeffneten Objekts und gehoert dort nicht hin - dann nur das zvE. */
  var _basis = window._dpSteuerBasis(year);
  var _zveOhneBestand = _basis.zve;
  var _saldo = vorgabe ? 0 : _basis.saldo;
  var baseIncome = vorgabe ? _basis.zve : _basis.basis;
  /* v2891: Steuerlast des Jahres (Splitting, Soli, Kirchensteuer aus den
     Steuerangaben) und ein Verlustvortrag aus den Vorjahren dieses Objekts. */
  var _vortrag = (vorgabe || ohneVortrag) ? 0 : _dpVerlustvortragBis(yearIdx);
  var _genutzt = 0;
  if (_vortrag > 0) _genutzt = Math.min(_vortrag, Math.max(0, baseIncome + ergebnis));
  var impact = Tax.calcImmoTaxImpact(baseIncome, ergebnis - _genutzt, year);
  impact.vortragGenutzt = _genutzt;
  impact.vortragVorhanden = _vortrag;

  return {
    auto: auto,
    values: values,
    werbungskosten: werbungskosten,
    einnahmen: einnahmen,
    ergebnis: ergebnis,
    /* v1225 · DIE AfA IST EINE ZAHL, ABER ZWEI FORMULARZEILEN.
       Zeile 35 der Anlage V heisst woertlich „Absetzung fuer Abnutzung fuer
       Gebaeude (OHNE Betraege in den Zeilen 36 bis 41)"; die Sonderab-
       schreibung nach § 7b gehoert in Zeile 38. Oben wird beides zu einem
       Feld addiert (afa = afaGebaeude + afaSonder7bJahr), und der gespeicherte
       Steuersatz hat nur eine Spalte dafuer.

       Hier wird nichts neu gerechnet und nichts umgebaut — die beiden Summanden
       werden nur MITGETEILT, damit die Anlage-V-Seite sie trennen kann.

       Nur ohne `vorgabe`: mit Vorgabe rechnet diese Funktion fuer ein FREMDES
       Objekt (Steuer-Mappe), und State._afaSeries* gehoert zum geoeffneten.
       Ein Wert aus dem falschen Objekt waere schlimmer als keiner — deshalb
       dann null, was „nicht bekannt" heisst und auf dem Blatt auch so steht. */
    afaLinear:    vorgabe ? null : (auto._afaLinear != null ? auto._afaLinear : null),
    afaSonder7b:  vorgabe ? null : (auto._afaSonder7b != null ? auto._afaSonder7b : null),
    refund: impact.refund,
    taxDelta: impact.taxDelta,
    /* v1133-steuerwirkung: calcImmoTaxImpact rechnet ESt vorher/nachher und
       beide Steuersaetze ohnehin — bisher wurden davon nur zwei Werte
       weitergereicht. Das Finanzamt-PDF soll die Wirkung zeigen wie Marcels
       Immokalk („Steuer Verlust/Ueberschuss pro Jahr / pro Monat"), und
       dafuer braucht es die ganze Auskunft. Nichts neu gerechnet. */
    zve: baseIncome,
    zveOhneBestand: _zveOhneBestand,   /* v2890: Ausgangs-zvE vor dem Saldo */
    bestandSaldo: _saldo,
    zveQuelle: _basis.source,
    impact: impact
  };
}

/**
 * Render the yearly tax form.
 * Two modes: 'quick' (collapsed grid) and 'detail' (full Excel-like form per year).
 */
function renderYearlyTaxForm() {
  var box = document.getElementById('yearly-tax-form-box');
  if (!box) return;
  if (!State.cfRows || !State.cfRows.length) {
    box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px">Bitte erst Werte eingeben</div>';
    return;
  }

  var mode = window._taxFormMode || 'quick';
  var startYear = _v269_getStartYear(); // V269a1
  var years = [];
  var nYears = Math.min(15, State.cfRows.length);
  for (var i = 0; i < nYears; i++) years.push({ idx: i, year: startYear + i });

  var html =
    '<div class="ytf-toolbar">' +
      '<div class="ytf-mode-toggle">' +
        '<button class="ytf-mode-btn ' + (mode === 'quick' ? 'active' : '') + '" onclick="setTaxFormMode(\'quick\')">Quick-Modus</button>' +
        '<button class="ytf-mode-btn ' + (mode === 'detail' ? 'active' : '') + '" onclick="setTaxFormMode(\'detail\')">Detail-Modus</button>' +
      '</div>' +
      '<button class="btn btn-outline btn-sm" onclick="resetAllTaxOverrides()" title="Alle manuellen Eingaben zurücksetzen">↺ Vorschläge wiederherstellen</button>' +
    '</div>';

  if (mode === 'quick') {
    html += _renderQuickForm(years);
  } else {
    html += _renderDetailForm(years);
  }

  box.innerHTML = html;
}

/* v2194 · N62.10 · Marcel: „das Vorjahr duplizieren … ausser die, die fest sind,
   wie Schuldzinsen oder AfA.“ Je Feld entschieden (Felder aus _computeAutoForYear):
   FEST, nie kopiert: schuldzinsen (sinken mit der Restschuld), afa, sonst_bewegl_wg
   (AfA), anschaffungsnah, erhaltungsaufwand (verteilt), notar_grundschuld,
   vermittlung, bereitstellung (einmalig), einnahmen_km (Miete nach Plan),
   inserat, gericht (Einzelfall).
   WIEDERKEHREND, kopiert: die Liste unten. Kopiert werden nur EIGENE Werte des
   Vorjahres, und nur in Felder, die im Zieljahr noch keinen eigenen Wert haben. */
var YTF_WIEDERKEHREND = ['hausverwaltung', 'nk_umlf', 'nk_n_umlf', 'einnahmen_nk', 'kontofuehrung',
  'steuerber', 'telefon', 'porto', 'fahrtkosten', 'verpflegung', 'hotel', 'betr_sonst', 'verw_sonst',
  'finanz_sonst', 'sonst_kosten'];
function _ytfVorjahrUebernehmen(year) {
  var n = 0, schon = 0;
  YTF_WIEDERKEHREND.forEach(function (f) {
    var v = _getYearOverride(year - 1, f);
    if (v === undefined || v === null || v === '') return;
    if (_getYearOverride(year, f) !== undefined) { schon++; return; }
    _setYearOverride(year, f, v); n++;
  });
  renderYearlyTaxForm();
  if (typeof renderTaxTimeline === 'function') renderTaxTimeline();
  if (typeof calc === 'function') setTimeout(calc, 50);
  var msg = n ? ('✓ ' + n + ' wiederkehrende Werte aus ' + (year - 1) + ' übernommen' + (schon ? ' (' + schon + ' hatten schon eigene Werte)' : '') + ' — Schuldzinsen, AfA und Einmaliges bleiben')
    : ('In ' + (year - 1) + ' stehen keine eigenen Werte für wiederkehrende Posten' + (schon ? ' (oder sie sind in ' + year + ' schon eingetragen)' : '') + '.');
  if (typeof toast === 'function') toast(msg);
}
window._ytfVorjahrUebernehmen = _ytfVorjahrUebernehmen;

function setTaxFormMode(m) {
  window._taxFormMode = m;
  renderYearlyTaxForm();
}

function resetAllTaxOverrides() {
  if (!confirm('Alle manuellen Jahres-Eingaben zurücksetzen?')) return;
  window._taxYearlyOverrides = {};
  renderYearlyTaxForm();
  if (typeof renderTaxTimeline === 'function') renderTaxTimeline();
  toast('✓ Alle Vorschläge wiederhergestellt');
}

function _renderQuickForm(years) {
  var html = '<div class="ytf-quick-wrap"><table class="ytf-table"><thead><tr>' +
    '<th>Jahr</th>' +
    '<th class="num">Einnahmen V+V</th>' +
    '<th class="num">Schuldzinsen</th>' +
    '<th class="num">AfA</th>' +
    '<th class="num">Bewirtschaftung</th>' +
    '<th class="num">Sonstige WK</th>' +
    '<th class="num ytf-result">= Verlust/Überschuss</th>' +
    '<th class="num ytf-result">Steuer-Effekt</th>' +
    '</tr></thead><tbody>';

  years.forEach(function(y) {
    var totals = _computeYearTotal(y.year, y.idx);
    var v = totals.values;
    var bewirt = v.nk_n_umlf + v.betr_sonst;
    var sonst = v.kontofuehrung + v.bereitstellung + v.notar_grundschuld +
                v.vermittlung + v.finanz_sonst + v.hausverwaltung + v.steuerber +
                v.porto + v.verw_sonst + v.fahrtkosten + v.verpflegung +
                v.hotel + v.inserat + v.gericht + v.telefon + v.sonst_kosten +
                v.sonst_bewegl_wg;

    // V63.58: Math.round().toLocaleString() liefert für negative Zahlen "-1.701", für
    // positive "1.701" → wir hängen nur bei positiven manuell ein '+' davor (Minus ist schon da).
    var refundColor = totals.refund >= 0 ? 'var(--green)' : 'var(--red)';
    var refundSign = totals.refund > 0 ? '+' : '';
    var ergSign = totals.ergebnis > 0 ? '+' : '';

    html += '<tr>' +
      '<td class="ytf-year">' + y.year + '</td>' +
      _ytfCell(y.year, 'einnahmen_km', v.einnahmen_km, totals.auto.einnahmen_km) +
      _ytfCell(y.year, 'schuldzinsen', v.schuldzinsen, totals.auto.schuldzinsen) +
      _ytfCell(y.year, 'afa', v.afa, totals.auto.afa) +
      _ytfCellComputed(bewirt) +
      _ytfCellComputed(sonst) +
      '<td class="num ytf-result" style="color:' + (totals.ergebnis >= 0 ? 'var(--gold-d)' : 'var(--green)') + '">' +
        ergSign + Math.round(totals.ergebnis).toLocaleString('de-DE') + ' €</td>' +
      '<td class="num ytf-result" style="color:' + refundColor + ';font-weight:700">' +
        refundSign + Math.round(totals.refund).toLocaleString('de-DE') + ' €</td>' +
    '</tr>';
  });

  html += '</tbody></table></div>' +
    '<p class="hint" style="margin-top:8px">' +
      '💡 Klicke ein Feld an, um den App-Vorschlag manuell zu überschreiben (z.B. tatsächliche Werbungskosten lt. Steuerbescheid). ' +
      'Der Pfeil ↺ neben einem überschriebenen Wert setzt ihn auf den Vorschlag zurück.' +
    '</p>';

  return html;
}

function _renderDetailForm(years) {
  // Show one year at a time with a year selector
  var selected = window._detailYearIdx;
  if (selected == null || selected >= years.length) selected = 0;

  var y = years[selected];
  var totals = _computeYearTotal(y.year, y.idx);
  var v = totals.values;

  var html = '<div class="ytf-detail-wrap">' +
    '<div class="ytf-year-selector">' +
      '<label>Veranlagungsjahr: </label>' +
      '<select onchange="window._detailYearIdx=parseInt(this.value);renderYearlyTaxForm()">';
  years.forEach(function(yy, i) {
    html += '<option value="' + i + '"' + (i === selected ? ' selected' : '') + '>' + yy.year + '</option>';
  });
  html += '</select>'
    /* v2194 · N62.10 Vorjahr uebernehmen - nur die WIEDERKEHRENDEN Posten */
    + (selected > 0 ? '<button type="button" class="btn btn-outline btn-sm ytf-vorjahr" style="margin-left:10px" onclick="_ytfVorjahrUebernehmen(' + y.year + ')" title="Übernimmt deine eigenen Werte aus ' + (y.year - 1) + ' für wiederkehrende Posten (Hausverwaltung, Nebenkosten, Kontoführung, Steuerberater, Telefon, Porto, Fahrten, sonstige Kosten). Nicht übernommen werden feste Werte wie Schuldzinsen, AfA, Erhaltungsaufwand oder Notar.">⧉ Werte aus ' + (y.year - 1) + ' übernehmen</button>' : '')
    + '</div>';

  // Hilfetexte zu jedem Feld (Punkt 8)
  var helpTexts = {
    schuldzinsen: 'Zinsen für das Immobiliendarlehen (ohne Tilgung). Werden lt. Tilgungsplan automatisch berechnet, können aber überschrieben werden.',
    kontofuehrung: 'Kosten für ein separates Konto, das nur für die Immobilie geführt wird. Pauschal i.d.R. 8-12 €/Jahr.',
    bereitstellung: 'Bereitstellungszinsen für noch nicht abgerufene Darlehen. Üblich: 3% p.a. nach 3-12 zinsfreien Monaten.',
    notar_grundschuld: 'Anteilige Notarkosten für die Bestellung der Grundschuld (NICHT die Kaufvertrag-Notarkosten - die gehören zu Anschaffungskosten).',
    vermittlung: 'Provision an einen Finanzierungsvermittler oder -berater (z.B. Interhyp, Dr. Klein).',
    finanz_sonst: 'Weitere finanzierungsbezogene Kosten (z.B. Wertgutachten für die Bank).',
    nk_n_umlf: 'Betriebskosten, die NICHT auf den Mieter umgelegt werden können (z.B. Hausverwaltung, Bankgebühren, Reparaturen).',
    betr_sonst: 'Weitere Betriebskosten, die nicht in andere Kategorien passen.',
    hausverwaltung: 'Kosten der Hausverwaltung / Mietsonderverwaltung (NICHT umlagefähige Anteile).',
    steuerber: 'Anteilige Steuerberatungskosten für die V+V-Anlage (Anlage V).',
    porto: 'Porto, Briefumschläge, Büromaterial im Zusammenhang mit der Vermietung.',
    verw_sonst: 'Sonstige Verwaltungskosten.',
    fahrtkosten: 'Fahrten zur Immobilie. Nachweispflichtig: 0,30 €/km mit eigenem PKW oder Bahn-Ticket.',
    verpflegung: 'Verpflegungsmehraufwand bei mehrtägiger Anreise (Pauschalen 14/28 € je nach Dauer).',
    hotel: 'Übernachtungskosten bei Anreise (Hotel, Pension, Camping mit Beleg).',
    inserat: 'Kosten für Vermietungsanzeigen (Immoscout24, Print, etc.).',
    gericht: 'Gerichts-, Anwalts- oder Mahnkosten (z.B. Räumungsklage, Streitigkeiten).',
    telefon: 'Telefon-/Internetkosten anteilig für die Vermietungstätigkeit.',
    sonst_kosten: 'Sonstige Kosten (Strom-/Gas-Kosten bei Leerstand, Reparaturen unter 4.000 €, etc.).',
    afa: 'Jährliche Abschreibung des Gebäudes (i.d.R. 2% linear vom Gebäudeanteil der Anschaffungskosten).',
    sonst_bewegl_wg: 'Bewegliche Wirtschaftsgüter (Einbauküche, Möbel) abschreibbar über 10 Jahre.',
    anschaffungsnah: 'Sanierungskosten in den ersten 3 Jahren NACH Anschaffung. Wenn > 15% des Gebäudewerts → werden zu Anschaffungskosten und nur über AfA abgeschrieben (NICHT direkt absetzbar). § 6 Abs. 1 Nr. 1a EStG.',
    erhaltungsaufwand: 'Reparaturen / Erhaltungsmaßnahmen NACH den ersten 3 Jahren. Direkt absetzbar im Jahr der Zahlung. Bei größeren Beträgen Verteilung über 2-5 Jahre möglich (§ 82b EStDV).',
    einnahmen_km: 'Kaltmiete (= Nettokaltmiete + zus. Einnahmen wie Stellplatz). Wird automatisch aus Tab "Miete & Steuern" übernommen.',
    einnahmen_nk: 'Umlagefähige Nebenkosten (durchlaufender Posten). Werden automatisch aus Tab "Bewirtschaftung" übernommen.'
  };

  // Group sections wie Excel-Steuerformular (Punkt 6)
  var sections = [
    {
      title: '1.0 Finanzierungskosten',
      rows: [
        { f: 'schuldzinsen', l: 'Schuldzinsen' },
        { f: 'kontofuehrung', l: 'Kontoführungsgebühren' },
        { f: 'bereitstellung', l: 'Bereitstellungszinsen' },
        { f: 'notar_grundschuld', l: 'Notar/Grundschuld (anteilig)' },
        { f: 'vermittlung', l: 'Vermittlungsprovision Darlehen' },
        { f: 'finanz_sonst', l: 'Sonstiges' }
      ]
    },
    {
      title: '2.0 Betriebskosten',
      rows: [
        { f: 'nk_n_umlf', l: 'Nicht-umlagefähige Nebenkosten' },
        { f: 'betr_sonst', l: 'Sonstige Betriebskosten' }
      ]
    },
    {
      title: '3.0 Verwaltungskosten',
      rows: [
        { f: 'hausverwaltung', l: 'Hausverwaltung / Mietsonderverwaltung' },
        { f: 'steuerber', l: 'Steuerberatung' },
        { f: 'porto', l: 'Porto, Büromaterial' },
        { f: 'verw_sonst', l: 'Sonstiges' }
      ]
    },
    {
      title: '4.0 Sonstige Kosten',
      rows: [
        { f: 'fahrtkosten', l: 'Fahrtkosten zur Immobilie' },
        { f: 'verpflegung', l: 'Verpflegungsmehraufwand' },
        { f: 'hotel', l: 'Übernachtungskosten' },
        { f: 'inserat', l: 'Inseratskosten' },
        { f: 'gericht', l: 'Gerichts-/Anwaltskosten' },
        { f: 'telefon', l: 'Telefon/Internet' },
        { f: 'sonst_kosten', l: 'Sonstiges (Leerstand etc.)' }
      ]
    },
    {
      title: '5.0 AfA Gebäude',
      rows: [
        /* v2948 · der Satz kommt aus dem Objekt (#afa_satz) - stand fest „linear 2%",
           gemessen an Westerfeldstr. 140: 5.609 € bei 6,25 % (Marcel 25.10.2026) */
        { f: 'afa', l: (function () {
          var s = parseFloat(String((document.getElementById('afa_satz') || {}).value || '').replace(',', '.'));
          return 'AfA-Betrag (linear ' + (s > 0 ? s.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %' : '') + ')';
        })() }
      ]
    },
    {
      title: '6.0 AfA bewegliche Wirtschaftsgüter',
      rows: [
        { f: 'sonst_bewegl_wg', l: 'Bewegliche Wirtschaftsgüter (10 J.)' }
      ]
    },
    {
      title: '6.5 Anschaffungsnahe Herstellkosten / Erhaltungsaufwand (Punkt 6)',
      rows: [
        { f: 'anschaffungsnah', l: 'Anschaffungsnahe Herstellkosten (§6 EStG)' },
        { f: 'erhaltungsaufwand', l: 'Erhaltungsaufwendungen (nach 3 J.)' }
      ]
    },
    {
      title: '7.0 Einnahmen (Punkt 9, 10: read-only - übernommen)',
      rows: [
        { f: 'einnahmen_km', l: 'Kaltmiete', readonly: true },
        { f: 'einnahmen_nk', l: 'Nebenkosten (umlagefähig)', readonly: true }
      ]
    }
  ];

  sections.forEach(function(sec) {
    html += '<div class="ytf-section"><div class="ytf-section-title">' + sec.title + '</div>' +
      '<table class="ytf-section-table"><tbody>';
    sec.rows.forEach(function(r) {
      var auto = totals.auto[r.f] || 0;
      var val = v[r.f] != null ? v[r.f] : auto;
      var help = helpTexts[r.f] || '';
      /* v1222 · DIE ANLAGE-V-ZEILE GEHÖRT IN DIE INFO, NICHT DANEBEN.
         Marcel: „prüfe das kleine Info-Teil ob dort auch beschreibungen drin
         stehen und erklärungen und setze die Zeile mit unter das Info-Feld."
         Er hat recht — dort steht bereits die fachliche Erklärung zu jedem
         Posten. Eine zweite Pille daneben hätte dieselbe Sache an zwei Orten
         erzählt; die Zeilennummer ist eine weitere Angabe ZU DIESEM Posten,
         also gehört sie unter die vorhandene Erklärung.

         Die Zuordnung ist JAHRESABHÄNGIG — sie kommt aus window.AnlageV<Jahr>,
         der Abschrift des Formulars für genau dieses Jahr. Gibt es dafür keine
         Datei, steht keine Zeile dort: lieber keine Nummer als die eines
         anderen Jahres. */
      /* v1222b · RÜCKFALL AUF DAS JÜNGSTE VERFÜGBARE JAHR — nur hier, nicht im PDF.
         Gemessen: das Steuerformular rendert die Jahre ab 2026 (State.cfRows),
         die Abschrift gibt es für 2025. Nach der strengen Regel erschien
         deshalb NIE eine Zeilennummer — richtig gebaut und trotzdem nutzlos.
         Die Anlage V 2026 ist Anfang September 2026 noch nicht veröffentlicht;
         Marcel kann sie also gar nicht liefern.

         Der Tooltip ist eine ARBEITSHILFE IM PROGRAMM, das PDF eine Unterlage,
         die jemand weiterreicht. Deshalb hier der Rückfall mit deutlichem
         Hinweis, im PDF weiterhin die strenge Regel: dort erscheint ohne
         passende Abschrift gar keine Anlage-V-Seite. Eine Orientierung mit
         Vorbehalt hilft beim Arbeiten; eine Zahl ohne Vorbehalt in einem
         Dokument, das ans Finanzamt geht, hilft niemandem. */
      var _avT = window['AnlageV' + y.year], _avAlt = null;
      if (!_avT) {
        var _avJahre = Object.keys(window)
          .filter(function (k) { return /^AnlageV\d{4}$/.test(k); })
          .map(function (k) { return parseInt(k.slice(7), 10); })
          .filter(function (j) { return j < y.year; })
          .sort(function (a, b) { return b - a; });
        if (_avJahre.length) { _avAlt = _avJahre[0]; _avT = window['AnlageV' + _avAlt]; }
      }
      var _avF = (_avT && _avT.felder) ? _avT.felder[r.f] : null;
      if (_avF && _avF.zeile != null) {
        var _avZ = (_avT.zeilen && _avT.zeilen[_avF.zeile]) || {};
        var _herkunft = (_avF.quelle === 'formular')
              ? 'Wörtlich aus dem Formular übernommen.'
            : (_avF.quelle === 'auffang')
              ? 'Steht in keiner spezielleren Zeile — das Formular führt dafür „Sonstige Kosten".'
            : (_avF.quelle === 'sachlogik')
              ? 'Zuordnung aus der Art des Aufwands, nicht aus dem Formulartext — bitte prüfen.'
              : '';
        help += (help ? '\n\n' : '')
          + '── ANLAGE V ' + (_avAlt || y.year) + ' ──\n'
          + 'Zeile ' + _avF.zeile + (_avZ.kz ? '  ·  Kennzahl ' + _avZ.kz : '') + '\n'
          + (_avZ.text ? _avZ.text + '\n' : '')
          + (_avF.grund ? '\n' + _avF.grund + '\n' : '')
          + (_herkunft ? '\n' + _herkunft : '')
          + (_avAlt ? '\n\nACHTUNG: Für ' + y.year + ' liegt noch keine Abschrift vor. '
                    + 'Angezeigt ist der Stand ' + _avAlt + '. Zeilennummern ändern sich je '
                    + 'Veranlagungsjahr — am aktuellen Formular prüfen.' : '');
      }
      var labelHtml = r.l;
      if (help) {
        labelHtml += ' <span class="ytf-help" title="' + help.replace(/"/g, '&quot;') + '">ℹ</span>';
      }
      html += '<tr><td class="ytf-section-label">' + labelHtml + '</td>' +
        '<td class="num">' +
          (r.readonly ? _ytfReadonlyValue(val) : _ytfDetailInput(y.year, r.f, val, auto)) +
        '</td>' +
        '<td class="ytf-bemerkung-cell">' +
          _ytfBemerkungInput(y.year, r.f) +
        '</td></tr>';
    });
    html += '</tbody></table></div>';
  });

  // Summary box
  var refundColor = totals.refund >= 0 ? 'var(--green)' : 'var(--red)';
  html += '<div class="ytf-summary">' +
    '<div class="ytf-sum-row"><span>Werbungskosten gesamt:</span><span class="num">' +
      Math.round(totals.werbungskosten).toLocaleString('de-DE') + ' €</span></div>' +
    '<div class="ytf-sum-row"><span>Einnahmen V+V:</span><span class="num">' +
      Math.round(totals.einnahmen).toLocaleString('de-DE') + ' €</span></div>' +
    '<div class="ytf-sum-row ytf-sum-result"><span><b>Verlust/Überschuss V+V:</b></span><span class="num"><b>' +
      (totals.ergebnis >= 0 ? '+' : '') + Math.round(totals.ergebnis).toLocaleString('de-DE') + ' €</b></span></div>' +
    '<div class="ytf-sum-row" style="color:' + refundColor + '"><span><b>Steuer-Effekt:</b></span><span class="num"><b>' +
      (totals.refund >= 0 ? '+' : '') + Math.round(totals.refund).toLocaleString('de-DE') + ' €</b></span></div>' +
    '</div>';

  html += '</div>';
  return html;
}

function _ytfCell(year, field, val, auto) {
  var override = _getYearOverride(year, field);
  var isOverride = override !== undefined;
  return '<td class="num ytf-cell ' + (isOverride ? 'ytf-overridden' : '') + '">' +
    '<div class="ytf-input-wrap">' +
      /* v646-empty-input: 0 ohne Override -> leeres Feld + Placeholder */
      '<input type="number" step="1" value="' + (Math.round(val) === 0 && !isOverride ? '' : Math.round(val)) + '" placeholder="0"' +
        ' data-year="' + year + '" data-field="' + field + '"' +
        ' onchange="updateTaxOverride(this)" />' +
      (isOverride ? '<button class="ytf-reset" onclick="resetTaxOverride(\'' + year + '\',\'' + field + '\')" title="Auf Vorschlag zurücksetzen (' + Math.round(auto).toLocaleString('de-DE') + ' €)">↺</button>' : '') +
    '</div>' +
  '</td>';
}

function _ytfDetailInput(year, field, val, auto) {
  var override = _getYearOverride(year, field);
  var isOverride = override !== undefined;
  return '<div class="ytf-input-wrap">' +
    /* v646-empty-input */
    '<input type="number" step="1" value="' + (Math.round(val) === 0 && !isOverride ? '' : Math.round(val)) + '" placeholder="0"' +
      ' data-year="' + year + '" data-field="' + field + '"' +
      ' onchange="updateTaxOverride(this)" />' +
    (isOverride ?
      '<button class="ytf-reset" onclick="resetTaxOverride(\'' + year + '\',\'' + field + '\')" title="Vorschlag: ' + Math.round(auto).toLocaleString('de-DE') + ' €">↺</button>'
      : '<span class="ytf-auto-hint" title="App-Vorschlag">●</span>') +
  '</div>';
}

function _ytfCellComputed(val) {
  return '<td class="num ytf-computed">' + Math.round(val).toLocaleString('de-DE') + ' €</td>';
}

function updateTaxOverride(input) {
  var year = parseInt(input.dataset.year);
  var field = input.dataset.field;
  var rawVal = input.value;
  var val = rawVal === '' ? undefined : parseFloat(rawVal);

  // V24-Fix: Wenn der User den Wert NICHT geändert hat (gleich dem Auto-Wert
  // oder leer), KEIN Override setzen. Verhindert, dass beim Tab-durchgehen
  // versehentlich überall "0" als sticky Override hängenbleibt.
  if (val !== undefined && State && State.cfRows) {
    try {
      // Auto-Wert für dieses Feld neu berechnen
      var yearIdx = -1;
      var startYear = _v269_getStartYear(); // V269a1 (Bug: .year war undefined)
      yearIdx = year - startYear;
      if (yearIdx >= 0 && yearIdx < State.cfRows.length) {
        var auto = _computeAutoForYear(yearIdx, year);
        var autoVal = auto[field];
        if (autoVal !== undefined && Math.round(val) === Math.round(autoVal)) {
          // Wert entspricht Auto-Vorschlag → KEIN Override, bestehenden löschen
          val = undefined;
        }
      }
    } catch (e) { /* fallback: normal speichern */ }
  }

  _setYearOverride(year, field, val);
  renderYearlyTaxForm();
  if (typeof renderTaxTimeline === 'function') renderTaxTimeline();
  if (typeof calc === 'function') setTimeout(calc, 50);
}


/* ═══════════════════════════════════════════════════════════════════════
   v1406 · BELEGE IN DIE JAHRESFELDER ÜBERNEHMEN
   ═══════════════════════════════════════════════════════════════════════
   Marcel: „da wäre schon cool, wenn wir … eine Nebenkostenabrechnung oder
   Hausgeld … da reingeben könnten und der teilt das passend auf."

   Der Beleg-Import liest und teilt auf; HIER landet das Ergebnis. Bewusst
   eine eigene Funktion statt `updateTaxOverride()`: die erwartet ein
   DOM-Element mit `dataset`, und ein Beleg hat keins.

   DAS JAHR IST NICHT VERHANDELBAR. Eine Hausgeldabrechnung für 2025, die
   im Mai 2026 kommt, gehört ins Veranlagungsjahr 2025 — deshalb nimmt diese
   Funktion das Jahr als Pflichtangabe und schreibt niemals „ins aktuelle".
   Der Beleg-Import liest es aus der Abrechnung; findet er keins, fragt er.

   ADDIEREN IST DER VORGABEFALL. Ein Jahr hat mehrere Handwerkerrechnungen,
   und die zweite darf die erste nicht löschen. Ersetzen nur, wenn der
   Aufrufer es ausdrücklich sagt.                                          */
function dpWkUebernehmen(jahr, posten, modus) {
  var j = parseInt(jahr, 10);
  if (!j || j < 1990 || j > 2200) return { ok: false, grund: 'kein gültiges Jahr' };
  if (!posten || typeof posten !== 'object') return { ok: false, grund: 'keine Posten' };
  var ersetzen = (modus === 'replace');
  var n = 0, felder = [];
  Object.keys(posten).forEach(function (feld) {
    var betrag = Number(posten[feld]);
    if (!isFinite(betrag) || betrag === 0) return;
    var alt = _getYearOverride(j, feld);
    var neu;
    if (ersetzen || alt === undefined || alt === null || !isFinite(Number(alt))) {
      /* Kein Override vorhanden: der Beleg SETZT den Wert. Der Auto-Vorschlag
         der App wird damit überschrieben — genau das ist gewollt, ein Beleg
         ist die bessere Auskunft als eine Schätzung. */
      neu = betrag;
    } else {
      neu = Number(alt) + betrag;
    }
    _setYearOverride(j, feld, neu);
    felder.push(feld);
    n++;
  });
  if (!n) return { ok: false, grund: 'keine übernehmbaren Beträge' };
  try { if (typeof renderYearlyTaxForm === 'function') renderYearlyTaxForm(); } catch (e) {}
  try { if (typeof renderTaxTimeline === 'function') renderTaxTimeline(); } catch (e) {}
  try { if (typeof renderTaxModule === 'function') renderTaxModule(); } catch (e) {}
  try { if (typeof calc === 'function') setTimeout(calc, 60); } catch (e) {}
  return { ok: true, anzahl: n, jahr: j, felder: felder, modus: ersetzen ? 'replace' : 'add' };
}
window.dpWkUebernehmen = dpWkUebernehmen;

/** Welche Jahre der Tab Steuern gerade führt — damit der Beleg-Import
 *  merkt, wenn ein Beleg in ein Jahr fällt, das es hier gar nicht gibt. */
function dpWkJahre() {
  try {
    if (!State || !State.cfRows || !State.cfRows.length) return [];
    var basis = (typeof _taxBaseYear === 'function') ? _taxBaseYear() : null;
    if (!basis) {
      var k = document.getElementById('kaufdat');
      var w = document.getElementById('wirtschaftlicher_uebergang');
      var raw = (k && k.value) || (w && w.value) || '';
      basis = raw.length >= 4 ? parseInt(raw.substring(0, 4), 10) : new Date().getFullYear();
    }
    var out = [];
    for (var i = 0; i < State.cfRows.length; i++) out.push(basis + i);
    return out;
  } catch (e) { return []; }
}
window.dpWkJahre = dpWkJahre;

function resetTaxOverride(year, field) {
  _setYearOverride(parseInt(year), field, undefined);
  renderYearlyTaxForm();
  if (typeof renderTaxTimeline === 'function') renderTaxTimeline();
  if (typeof calc === 'function') setTimeout(calc, 50);
}

/**
 * V110 BUG-FIX: Doppelung entfernt — die Original renderTaxTimeline (Z. 246) nutzt jetzt
 * selbst _computeYearTotal() und ist damit konsistent zum Steuerformular pro Jahr.
 * Vorher gab's eine Override hier die fast identisch war (auch _computeYearTotal nutzte),
 * aber mit subtil anderem Aufbau (startYear=heute statt r.cal). Beide Versionen sollten
 * identische Ergebnisse liefern, aber die Doppelung war Source of Bugs — wenn jemand die
 * eine änderte, drifteten sie auseinander.
 *
 * Wichtig: Die Original-Funktion ruft am Ende NICHT renderYearlyTaxForm() auf — die
 * Override tat das. Wir machen das jetzt explizit hier, aber als kleine Brücke statt
 * Re-Implementierung.
 */
var _origRenderTaxTimeline_V110 = renderTaxTimeline;
renderTaxTimeline = function() {
  _origRenderTaxTimeline_V110();
  // Yearly-Form mit derselben Quelle nachziehen
  if (typeof renderYearlyTaxForm === 'function') {
    try { renderYearlyTaxForm(); } catch(e) { /* ok */ }
  }
};

// ═══════════════════════════════════════════════════
// Grenzsteuersatz automatisch aus zvE (Punkt 2)
// ═══════════════════════════════════════════════════
/* ═══ v1383-GRENZAUTO · EINE AUTOMATIK, DIE ANGEHAKT WAR UND NICHT LIEF ══
 *
 * Marcels Frage: „Grauen wir den aus?"
 *
 * GEMESSEN: Die Checkbox steht in index.html:1940 auf `checked` — sie ist
 * also ab Werk an. Gerufen wurde `onGrenzAutoToggle()` aber NUR an zwei
 * Stellen: beim Klick auf die Checkbox selbst und beim Tippen ins
 * zvE-Feld. Beim LADEN eines Objekts feuert weder das eine noch das
 * andere (kein dispatchEvent in storage.js oder main.js).
 *
 * Folge: Wer ein Objekt oeffnet, sieht eine angehakte Automatik und ein
 * FREI EDITIERBARES Feld mit dem gespeicherten alten Wert. Beides
 * zusammen ist eine Luege — der Haken sagt „wird berechnet", und
 * berechnet wird nichts.
 *
 * Die Nachfuehrung steht deshalb jetzt in einer eigenen Funktion, die
 * auch STILL laufen kann: `calc()` ruft sie bei jedem Lauf, und ein
 * Toast bei jedem Rechenlauf waere unbrauchbar. */
function _grenzAutoNachziehen(mitToast) {
  var auto = document.getElementById('grenz_auto');
  var grenzInput = document.getElementById('grenz');
  if (!auto || !grenzInput) return false;
  if (auto.checked) {
    var zve = parseDe((document.getElementById('zve') || {}).value) || 0;
    if (zve > 0) {
      var gss = Tax.grenzsatzGesamt(zve, new Date().getFullYear()) * 100;   /* v2891: inkl. Soli, Kirchensteuer, Splitting; v2892: Jahr, damit ein Steuerzeitraum mit eigener Veranlagung greift */
      var neu = gss.toFixed(2);
      var geaendert = (String(grenzInput.value).replace(',', '.') !== neu);
      grenzInput.value = neu;
      grenzInput.disabled = true;
      grenzInput.style.background = 'rgba(201,168,76,0.12)';
      /* ═══ v1398 · DAS FELD ZEIGT DEN PERSOENLICHEN SATZ, NICHT DEN WIRKSAMEN
         Seit v1397 rechnet das Objekt gegen eine Basis, die um die Ergebnisse
         frueher gekaufter Objekte verschoben ist. Der hier angezeigte Satz
         bleibt bewusst der auf das VOLLE zvE — das ist der persoenliche
         Grenzsteuersatz, und danach fragt das Feld.
         Gemessen an drei Objekten (zvE 80.000): das Feld zeigt dreimal
         42,00 %, waehrend die wirksame Basis 80.000 / 55.000 / 35.000 betraegt
         und dort 42,00 / 37,00 / 30,10 % gelten. Ohne diesen Zusatz stuende
         die Abweichung unerklaert da. */
      var _salT = 0;
      try {
        if (typeof window._dpBestandSaldo === 'function') {
          _salT = window._dpBestandSaldo(
            (State && State._taxDisplayYear) || new Date().getFullYear()) || 0;
        }
      } catch (_eT) { _salT = 0; }
      grenzInput.title = 'Wird aus deinem zu versteuernden Einkommen berechnet '
        + '(§ 32a EStG). Zum Ändern den Haken darunter entfernen.'
        + (Math.abs(_salT) >= 1
            ? ' — Achtung: das ist dein persönlicher Satz auf das volle zvE. '
              + 'Dieses Objekt rechnet auf einer um '
              + Math.round(Math.abs(_salT)).toLocaleString('de-DE') + ' € '
              + (_salT < 0 ? 'gesenkten' : 'erhöhten')
              + ' Basis, weil früher gekaufte Bestandsobjekte einfließen. Der '
              + 'tatsächlich wirkende Satz steht im Hinweis „Dein Steuersatz '
              + 'wurde angepasst".'
            : '');
      if (mitToast && typeof toast === 'function') {
        toast('✓ Grenzsteuersatz aus zvE berechnet: ' + neu + ' %');
      }
      return geaendert;
    }
    /* Haken an, aber kein zvE: dann kann nichts berechnet werden. Das
       Feld bleibt frei — sonst waere es gesperrt UND leer. */
    grenzInput.disabled = false;
    grenzInput.style.background = '';
    grenzInput.title = 'Kein zu versteuerndes Einkommen erfasst — der Satz '
      + 'lässt sich nicht berechnen. Trage ihn selbst ein oder ergänze das zvE.';
    return false;
  }
  grenzInput.disabled = false;
  grenzInput.style.background = '';
  grenzInput.title = '';
  return false;
}

function onGrenzAutoToggle() {
  _grenzAutoNachziehen(true);
  if (typeof calcNow === 'function') calcNow();
}
window._grenzAutoNachziehen = _grenzAutoNachziehen;

/* ═══ v1397 · EIN WEG ZUR BESTANDSSALDIERUNG, NICHT ZWEI ═══════════════════
 *
 * GEMESSEN am 14.09.2026, ausgeloest durch Marcels Frage "warum steht das
 * noch drin?" zum Hinweistext im Tab Steuern.
 *
 * Der Text behauptet: "Die Objekte verschieben sich gegenseitig nicht die
 * Progression." Das stimmt seit V276 nur noch zur HAELFTE:
 *
 *   tax.js  (Tab Steuern)   rechnet baseIncome + _bestandInfo.sum und
 *                           DANN erst calcImmoTaxImpact  -> saldiert
 *   calc.js (Cashflow/KPI)  rechnet _estDelta gegen das rohe zvE-Feld
 *                           -> saldiert NICHT
 *
 * In calc.js steht der Grund woertlich im Kommentar: "Effektives zvE ohne
 * Immobilie + WK anderer Objekte (nur Display)". Die Zahl wurde also
 * ermittelt, angezeigt - und nicht gerechnet.
 *
 * Damit weist dieselbe App fuer dasselbe Objekt zwei verschiedene
 * Steuerwirkungen aus, und die Summe im Portfolio-Cockpit haengt an der
 * ungenaueren von beiden.
 *
 * DIESE FUNKTION IST DER EINE WEG. Sie liegt hier, weil hier auch der
 * Kaufdatums-Filter liegt (V280: nur Objekte, die VOR dem eigenen gekauft
 * wurden und im Bezugsjahr schon existierten). `getWKForOtherObjects` des
 * Aggregators filtert das NICHT - wer sie nimmt, bekommt eine andere Zahl
 * als der Tab Steuern. Genau diese Dublette soll hier nicht entstehen.
 *
 * Rueckgabe 0 heisst: kein Saldo anzuwenden. Das ist der richtige
 * Rueckfall, wenn der Aggregator-Cache noch nicht geladen ist - dann
 * rechnet calc.js wie bisher, statt mit einer halben Wahrheit.
 */
window._dpBestandSaldo = function (jahr) {
  try {
    if (typeof _getBestandLossesForYear !== 'function') return 0;
    var r = _getBestandLossesForYear(jahr);
    if (!r || !r.loaded) return 0;
    return (typeof r.sum === 'number' && isFinite(r.sum)) ? r.sum : 0;
  } catch (_e) { return 0; }
};

/* Wie viele andere Bestandsobjekte in den Saldo eingegangen sind — fuer die
 * Anzeige, damit eine gesenkte Basis nicht unerklaert dasteht. */
window._dpBestandAnzahl = function (jahr) {
  try {
    if (typeof _getBestandLossesForYear !== 'function') return 0;
    var r = _getBestandLossesForYear(jahr);
    return (r && r.loaded && Array.isArray(r.list)) ? r.list.length : 0;
  } catch (_e) { return 0; }
};

/* ═══ v2890 · EIN zvE-WEG UND EINE BASIS FUER ALLE STEUERSTELLEN ═════════
 *
 * GEMESSEN am 23.10.2026 an der echten tax.js: zvE 80.000, ein frueher
 * gekauftes Objekt mit −25.000, dieses Objekt −3.300. Die Ergebnisbox des
 * Tabs zeigte 1.197 EUR Erstattung, die Jahreskarte desselben Jahres
 * 1.386 EUR — +16 %, immer zu gut. Die Box rechnete saldiert,
 * `_computeYearTotal` gegen das rohe zvE, und weil calc.js die Projektion
 * aus `_computeYearTotal` ueberschreibt (Steuer je Jahr, Cashflow nach
 * Steuern, Steuerverlauf, Vermoegenszuwachs, kpis.steuer), galt die
 * unsaldierte Zahl fast ueberall. Dazu drei verschiedene zvE-Wege: die Box
 * fiel auf den letzten frueheren Steuerzeitraum zurueck, die beiden
 * anderen nur auf das Feld `zve`.
 *
 * JETZT EIN WEG, in dieser Reihenfolge:
 *   1. Steuerzeitraum, der das Jahr enthaelt (Stichtag 15.06.)
 *   2. letzter frueherer Steuerzeitraum
 *   3. Feld `zve`
 *   4. das zvE, dessen Grenzsteuersatz dem eingestellten entspricht (v2239)
 * und darauf der Bestandssaldo aus `_dpBestandSaldo` (v1397). Eine Basis
 * unter null gibt es im Tarif nicht; sie wird auf 0 gesetzt. */
window._dpZveFuerJahr = function (jahr) {
  var j = (typeof jahr === 'number' && jahr > 1900) ? jahr : new Date().getFullYear();
  try {
    var info = _getZveForDateWithFallback(String(j));
    if (info && info.zve > 0) {
      return { zve: info.zve, source: info.source, quelle: info.exact ? 'steuerzeitraum' : 'letzter-zeitraum' };
    }
  } catch (_e) {}
  var f = 0;
  try { f = parseDe((document.getElementById('zve') || {}).value) || 0; } catch (_e) { f = 0; }
  if (f > 0) return { zve: f, source: 'aktueller zvE-Wert', quelle: 'feld-zve' };
  return { zve: window._dpZveErsatz(), source: 'kein zvE hinterlegt - abgeleitet aus dem Grenzsteuersatz', quelle: 'ersatz' };
};
window._dpSteuerBasis = function (jahr) {
  var j = (typeof jahr === 'number' && jahr > 1900) ? jahr : new Date().getFullYear();
  var z = window._dpZveFuerJahr(j);
  var s = window._dpBestandSaldo(j);
  var b = z.zve + s;
  if (!(b > 0)) b = 0;
  return { zve: z.zve, saldo: s, basis: b, source: z.source, quelle: z.quelle };
};

/* ═══ v2891 · STEUERANGABEN: VERANLAGUNG UND KIRCHENSTEUER ════════════════
 * Marcel 23.10.2026: „kommt es mit unter die Steuerangaben, da wo man auch
 * sein zvE angibt?" - ja. Die beiden Auswahlfelder stehen im Tab Steuern
 * unter dem zvE (#st_splitting, #st_kist), im Investmentprofil und im
 * Einrichtungsfenster. Gespeichert wird an EINER Stelle: im Investmentprofil
 * (`splitting`, `kirchensteuer`), dort, wo auch das zvE liegt. Am Objekt
 * steht nichts davon - es ist eine Angabe ueber den Steuerpflichtigen, nicht
 * ueber die Immobilie. */
window.DpSteuerAngaben = (function () {
  function _prof() {
    try { return (window.DealPilotInvestmentProfile && DealPilotInvestmentProfile.load()) || {}; }
    catch (e) { return {}; }
  }
  function zeigen() {
    var p = _prof();
    var a = document.getElementById('st_splitting');
    var b = document.getElementById('st_kist');
    if (a) a.value = (p.splitting === true || p.splitting === 'true') ? '1' : '0';
    if (b) b.value = String(parseInt(p.kirchensteuer, 10) === 8 ? 8 : (parseInt(p.kirchensteuer, 10) === 9 ? 9 : 0));
    _zeitraeumeZeigen();
  }
  /* v2892: Ueberstimmt ein Steuerzeitraum die Angabe oben, steht das hier -
     sonst wundert sich, wer oben "Einzelveranlagung" sieht und fuer 2027
     mit Splitting gerechnet bekommt. */
  function _fmtD(s) { var t = String(s || '').split('-'); return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : String(s || ''); }
  function _zeitraeumeZeigen() {
    var el = document.getElementById('st_veranl_zeitraeume');
    if (!el) return;
    var liste = [];
    try {
      if (window.DealPilotTaxPeriods && typeof DealPilotTaxPeriods.getAllSync === 'function') liste = DealPilotTaxPeriods.getAllSync();
    } catch (e) { liste = []; }
    var teile = liste.filter(function (z) {
      return z && (z.splitting === true || z.splitting === false || z.kirchensteuer === 0 || z.kirchensteuer === 8 || z.kirchensteuer === 9);
    }).sort(function (a, b) { return a.valid_from < b.valid_from ? -1 : 1; }).map(function (z) {
      var w = [];
      if (z.splitting === true) w.push('Zusammenveranlagung');
      else if (z.splitting === false) w.push('Einzelveranlagung');
      if (z.kirchensteuer === 0) w.push('keine Kirchensteuer');
      else if (z.kirchensteuer === 8 || z.kirchensteuer === 9) w.push(z.kirchensteuer + ' % Kirchensteuer');
      return _fmtD(z.valid_from) + '–' + (z.valid_to ? _fmtD(z.valid_to) : 'laufend') + ': ' + w.join(', ');
    });
    if (!teile.length) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = 'Abweichend in deinen Steuerzeiträumen (gilt dort vor der Angabe oben): ' + teile.join(' · ') + '.';
  }
  function speichern(splitting, kist) {
    try {
      var P = window.DealPilotInvestmentProfile;
      if (!P || !P.load || !P.save) return false;
      var akt = P.load() || {};
      akt.splitting = !!splitting;
      akt.kirchensteuer = (kist === 8 || kist === 9) ? kist : 0;
      return P.save(akt);
    } catch (e) { return false; }
  }
  function aendern() {
    var a = document.getElementById('st_splitting');
    var b = document.getElementById('st_kist');
    speichern(a && a.value === '1', b ? (parseInt(b.value, 10) || 0) : 0);
    try { if (typeof _grenzAutoNachziehen === 'function') _grenzAutoNachziehen(false); } catch (e) {}
    if (typeof calcNow === 'function') calcNow(); else if (typeof calc === 'function') calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zeigen);
  else setTimeout(zeigen, 0);
  return { zeigen: zeigen, speichern: speichern, aendern: aendern };
})();

// Hook zvE input to update Grenz when auto is on
document.addEventListener('DOMContentLoaded', function() {
  var zveInp = document.getElementById('zve');
  if (zveInp) {
    zveInp.addEventListener('input', function() {
      var auto = document.getElementById('grenz_auto');
      if (auto && auto.checked) {
        onGrenzAutoToggle();
      }
    });
  }
});

// ═══════════════════════════════════════════════════
// Steuerprogression-Chart (vor / nach Investition)
// ═══════════════════════════════════════════════════
function showProgressionChart() {
  // V248-02: Funktion deaktiviert (Card aus HTML entfernt)
  return;

  // Remove existing if any
  var existing = document.getElementById('progression-modal');
  if (existing) existing.remove();

  var zve = parseDe((document.getElementById('zve') || {}).value) || window._dpZveErsatz();   /* v2239 */
  // Estimate immo result for "after investment" scenario - use first year tax data
  var immoResult = 0;
  if (State.cfRows && State.cfRows.length) {
    var year1 = State.cfRows[0];
    var afa = State.kpis ? (State.kpis.afa || 0) : 0;
    immoResult = year1.wm_y - year1.bwk_y - year1.zy - afa;
  }

  // Build chart data: zvE on X, ESt on Y
  // Range: 0 to zve+50000
  var maxZve = Math.max(zve + 50000, 120000);
  var step = 1000;
  var labels = [];
  var taxBefore = [];
  var taxAfter = [];
  for (var z = 0; z <= maxZve; z += step) {
    labels.push(z);
    taxBefore.push(Tax.calcEStG(z));
    taxAfter.push(Tax.calcEStG(Math.max(0, z + immoResult)));
  }

  var modal = document.createElement('div');
  modal.id = 'progression-modal';
  modal.className = 'global-view-overlay';
  modal.innerHTML =
    '<div class="global-view-modal" style="max-width:900px">' +
      '<button class="pricing-close" onclick="document.getElementById(\'progression-modal\').remove()">×</button>' +
      '<h2>📈 Steuerprogression · vor und nach Investition</h2>' +
      '<p style="color:var(--muted);font-size:12.5px;margin-bottom:14px">' +
        'Vergleich der Einkommensteuer (EStG-Tarif 2026) ohne und mit Berücksichtigung des Vermietungsergebnisses.' +
        ' Aktueller zvE: <b>' + zve.toLocaleString('de-DE') + ' €</b>, Verlust V+V: <b>' + Math.round(immoResult).toLocaleString('de-DE') + ' €</b>' +
      '</p>' +
      '<div style="position:relative;height:380px"><canvas id="progressionCanvas"></canvas></div>' +
      '<div class="prog-legend">' +
        '<div class="prog-legend-item"><span class="prog-dot" style="background:#999"></span> ESt VOR Investition</div>' +
        '<div class="prog-legend-item"><span class="prog-dot" style="background:var(--gold)"></span> ESt NACH Investition</div>' +
        '<div class="prog-legend-item"><span class="prog-dot" style="background:var(--green);border-radius:0;width:12px;height:2px;align-self:center"></span> Aktueller zvE-Punkt</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  // Render chart
  setTimeout(function() {
    var ctx = document.getElementById('progressionCanvas');
    if (!ctx || typeof Chart === 'undefined') return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.map(function(l) { return Math.round(l/1000) + 'k'; }),
        datasets: [
          {
            label: 'ESt VOR Investition',
            data: taxBefore,
            borderColor: '#999',
            backgroundColor: 'rgba(150,150,150,0.10)',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'ESt NACH Investition',
            data: taxAfter,
            borderColor: '#C9A84C',
            backgroundColor: 'rgba(201,168,76,0.18)',
            borderWidth: 2.5,
            tension: 0.1,
            pointRadius: 0,
            fill: '-1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + Math.round(ctx.raw).toLocaleString('de-DE') + ' €';
              }
            }
          },
          annotation: {
            annotations: {
              currentZve: {
                type: 'line',
                xMin: zve / step,
                xMax: zve / step,
                borderColor: '#2A9A5A',
                borderWidth: 2,
                borderDash: [4, 4],
                label: { content: 'Dein zvE', enabled: true, position: 'start' }
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'zu versteuerndes Einkommen (€)' } },
          y: {
            title: { display: true, text: 'Einkommensteuer (€)' },
            ticks: { callback: function(v) { return Math.round(v/1000) + 'k'; } }
          }
        }
      }
    });
  }, 100);
}

function _ytfReadonlyValue(val) {
  return '<div class="ytf-readonly" title="Wird automatisch übernommen">' +
    Math.round(val).toLocaleString('de-DE') + ' €' +
  '</div>';
}

function _ytfBemerkungInput(year, field) {
  var note = '';
  try {
    var key = _yearKey(year);
    if (window._taxYearlyBemerkungen && window._taxYearlyBemerkungen[key]) {
      note = window._taxYearlyBemerkungen[key][field] || '';
    }
  } catch(e) {}
  return '<input type="text" class="ytf-bemerkung-input" placeholder="Bemerkung..." value="' +
    (note || '').replace(/"/g, '&quot;') + '" data-year="' + year + '" data-field="' + field +
    '" onchange="updateTaxBemerkung(this)" />';
}

function updateTaxBemerkung(input) {
  if (!window._taxYearlyBemerkungen) window._taxYearlyBemerkungen = {};
  var year = parseInt(input.dataset.year);
  var field = input.dataset.field;
  var key = _yearKey(year);
  if (!window._taxYearlyBemerkungen[key]) window._taxYearlyBemerkungen[key] = {};
  window._taxYearlyBemerkungen[key][field] = input.value;
}

// V277.3-expose-yt: _computeYearTotal als window-Funktion verfuegbar fuer calc.js
if (typeof _computeYearTotal === 'function' && typeof window !== 'undefined') {
  window._computeYearTotal = _computeYearTotal;
}


/* ═══════════════════════════════════════════════════════════════
   V286 — Bestand-Overlay (>5 Objekte): Suche, Sortierung, Schließen
   ═══════════════════════════════════════════════════════════════ */
(function(){
  if (window._taxBestandOverlayInit) return;
  window._taxBestandOverlayInit = true;

  var fmtVal = function(n) { return (n >= 0 ? '+' : '') + n.toLocaleString('de-DE') + ' €'; };
  var fmtDate = function(s) {
    if (!s || s.length < 10) return '';
    var parts = s.substring(0, 10).split('-');
    if (parts.length !== 3) return s;
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  };
  var escHtml = function(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var _state = { sortKey: 'kaufdat', sortDir: 'asc', query: '' };

  function renderRows() {
    var data = window._taxBestandData;
    if (!data || !data.list) return '';
    var list = data.list.slice();
    /* Filter */
    var q = _state.query.trim().toLowerCase();
    if (q) {
      list = list.filter(function(o) {
        var hay = (o.name || '') + ' ' + (o.address || '') + ' ' + (o.objName || '') + ' ' + (o.kaufdat || '') + ' ' + (o.value || 0);
        return hay.toLowerCase().indexOf(q) >= 0;
      });
    }
    /* Sort */
    list.sort(function(a, b) {
      var av, bv;
      if (_state.sortKey === 'value') { av = a.value || 0; bv = b.value || 0; }
      else if (_state.sortKey === 'kaufdat') { av = a.kaufdat || ''; bv = b.kaufdat || ''; }
      else if (_state.sortKey === 'address') { av = (a.address || a.name || '').toLowerCase(); bv = (b.address || b.name || '').toLowerCase(); }
      else { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); }
      if (av < bv) return _state.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return _state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    if (list.length === 0) {
      return '<div class="tax-bestand-overlay-empty">Keine Treffer für “' + escHtml(_state.query) + '”</div>';
    }
    return list.map(function(o) {
      var vColor = o.value < 0 ? 'c-red' : (o.value > 0 ? 'c-green' : '');
      return '<tr>'
           + '<td class="tax-bo-name">' + escHtml(o.name) + '</td>'
           + '<td class="tax-bo-date">' + escHtml(fmtDate(o.kaufdat)) + '</td>'
           + '<td class="tax-bo-addr">' + escHtml(o.address || o.objName || '—') + '</td>'
           + '<td class="tax-bo-val ' + vColor + '">' + fmtVal(o.value) + '</td>'
           + '</tr>';
    }).join('');
  }

  function updateBody() {
    var tbody = document.getElementById('tax-bestand-overlay-tbody');
    if (tbody) tbody.innerHTML = renderRows();
    var sortArrows = document.querySelectorAll('#tax-bestand-overlay th[data-sort]');
    sortArrows.forEach(function(th) {
      var key = th.getAttribute('data-sort');
      var arrow = th.querySelector('.tax-bo-arrow');
      if (!arrow) return;
      if (key === _state.sortKey) {
        arrow.textContent = _state.sortDir === 'asc' ? ' ▴' : ' ▾';
      } else {
        arrow.textContent = '';
      }
    });
  }

  function buildOverlay() {
    var data = window._taxBestandData;
    if (!data) return null;
    var ov = document.createElement('div');
    ov.id = 'tax-bestand-overlay';
    ov.className = 'tax-bestand-overlay';
    ov.innerHTML =
      '<div class="tax-bestand-overlay-panel" role="dialog" aria-modal="true" aria-label="Liste Bestandsobjekte">'
      + '<div class="tax-bestand-overlay-head">'
      +   '<div class="tax-bestand-overlay-title">'
      +     'Bestandsobjekte <span class="tax-bo-count">' + data.list.length + '</span>'
      +     '<span class="tax-bo-year">(Berechnung für ' + data.year + ')</span>'
      +   '</div>'
      +   '<button class="tax-bestand-overlay-close" type="button" aria-label="Schließen">×</button>'
      + '</div>'
      + '<div class="tax-bestand-overlay-search">'
      +   '<input id="tax-bestand-overlay-q" type="search" placeholder="Suche (Name, Adresse, Datum, Saldo)…" autocomplete="off" />'
      + '</div>'
      + '<div class="tax-bestand-overlay-tablewrap">'
      +   '<table class="tax-bestand-overlay-table">'
      +     '<thead><tr>'
      +       '<th data-sort="name">Name<span class="tax-bo-arrow"></span></th>'
      +       '<th data-sort="kaufdat">Kaufdatum<span class="tax-bo-arrow"></span></th>'
      +       '<th data-sort="address">Adresse<span class="tax-bo-arrow"></span></th>'
      +       '<th data-sort="value" class="tax-bo-th-right">Saldo<span class="tax-bo-arrow"></span></th>'
      +     '</tr></thead>'
      +     '<tbody id="tax-bestand-overlay-tbody"></tbody>'
      +   '</table>'
      + '</div>'
      + '<div class="tax-bestand-overlay-foot">'
      +   '<span class="tax-bo-foot-label">Saldo gesamt</span>'
      +   '<span class="tax-bo-foot-val ' + (data.sum < 0 ? 'c-red' : (data.sum > 0 ? 'c-green' : '')) + '">' + fmtVal(data.sum) + '</span>'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    /* Initial render */
    updateBody();
    /* Event-Wires */
    var input = ov.querySelector('#tax-bestand-overlay-q');
    if (input) {
      input.addEventListener('input', function(e) {
        _state.query = e.target.value || '';
        updateBody();
      });
      setTimeout(function(){ try { input.focus(); } catch(_) {} }, 50);
    }
    ov.querySelectorAll('th[data-sort]').forEach(function(th) {
      th.addEventListener('click', function() {
        var key = th.getAttribute('data-sort');
        if (_state.sortKey === key) {
          _state.sortDir = _state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _state.sortKey = key;
          _state.sortDir = (key === 'value') ? 'asc' : 'asc';
        }
        updateBody();
      });
    });
    var closeBtn = ov.querySelector('.tax-bestand-overlay-close');
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);
    /* Klick auf Backdrop (außerhalb Panel) schließt */
    ov.addEventListener('click', function(e) {
      if (e.target === ov) closeOverlay();
    });
    return ov;
  }

  function openOverlay() {
    closeOverlay(); /* falls schon offen */
    /* state default */
    _state = { sortKey: 'kaufdat', sortDir: 'asc', query: '' };
    buildOverlay();
    /* ESC-Listener */
    document.addEventListener('keydown', escHandler);
  }

  function closeOverlay() {
    var ov = document.getElementById('tax-bestand-overlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape' || e.keyCode === 27) closeOverlay();
  }

  /* Delegated click: Trigger-Item öffnet Overlay */
  document.addEventListener('click', function(e) {
    var trigger = e.target.closest && e.target.closest('[data-tax-bestand-open]');
    if (trigger) {
      e.preventDefault();
      openOverlay();
    }
  });
  /* Tastatur: Enter/Space auf Trigger */
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = document.activeElement;
    if (t && t.matches && t.matches('[data-tax-bestand-open]')) {
      e.preventDefault();
      openOverlay();
    }
  });

  /* Expose für Debug */
  window._taxBestandOverlay = { open: openOverlay, close: closeOverlay };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   v1216-miete66 · DIE 66-%-GRENZE DES § 21 ABS. 2 EStG
   ───────────────────────────────────────────────────────────────────────────
   Der Nebenfund aus Backlog-Punkt 5: dieselbe Art Falle wie die 15-%-Grenze,
   fuer die es in beleg-import.js schon eine Ampel gibt. DealPilot kennt die
   Ist-Miete (#nkm) und die Marktmiete (#ds2_marktmiete x #wfl) bereits — es
   kann von selbst warnen, statt dass der Nutzer es merkt, wenn das Finanzamt
   den Werbungskostenabzug kuerzt.

   DIE SCHWELLEN STEHEN IM GESETZ, nicht in einem Formular: sie wechseln
   nicht jaehrlich wie die Zeilennummern der Anlage V. Deshalb duerfen sie
   hier stehen — aber als HINWEIS, nicht als Beratung. Der Text nennt die
   Grenze und fordert zur Pruefung auf, genau wie die 15-%-Ampel.

   Kein Wert, kein Kasten: fehlt die Marktmiete oder die Wohnflaeche, sagt
   der Kasten das und rechnet NICHT mit einer geratenen Vergleichsmiete.
   ═══════════════════════════════════════════════════════════════════════════ */
function _mieteQuote66() {
  function n(id) {
    var e = document.getElementById(id);
    if (!e) return null;
    var v = (typeof parseDe === 'function') ? parseDe(e.value) : parseFloat(String(e.value || '').replace(',', '.'));
    return (isFinite(v) && v > 0) ? v : null;
  }
  var ist = n('nkm');              /* Nettokaltmiete pro Monat */
  var marktQm = n('ds2_marktmiete'); /* ortsuebliche Miete in EUR/m2 */
  var wfl = n('wfl');
  if (ist == null) return { stand: 'keine-ist' };
  if (marktQm == null || wfl == null) return { stand: 'keine-markt', ist: ist };
  var markt = marktQm * wfl;
  if (!(markt > 0)) return { stand: 'keine-markt', ist: ist };
  return { stand: 'ok', ist: ist, markt: markt, quote: (ist / markt) * 100 };
}

function renderMiete66() {
  var box = document.getElementById('tax-miete66-box');
  if (!box) return;
  var r = _mieteQuote66();
  var eur = function (v) { return Math.round(v).toLocaleString('de-DE') + ' €'; };

  if (r.stand === 'keine-ist') {
    box.innerHTML = '<div class="m66 m66-n">Für die Prüfung nach § 21 Abs. 2 EStG fehlt die '
      + '<b>Nettokaltmiete</b> im Tab Miete.</div>';
    return;
  }
  if (r.stand === 'keine-markt') {
    box.innerHTML = '<div class="m66 m66-n">Für die Prüfung nach § 21 Abs. 2 EStG fehlt die '
      + '<b>ortsübliche Marktmiete</b> (Tab Bewertung, Feld „Marktmiete €/m²") oder die Wohnfläche. '
      + 'Ohne beide wird hier <b>nicht</b> mit einer geschätzten Vergleichsmiete gerechnet.</div>';
    return;
  }

  var q = r.quote, cls, kopf, txt;
  var zahlen = 'Angesetzt ' + eur(r.ist) + ' / Monat gegen ortsüblich ' + eur(r.markt)
             + ' / Monat — <b>' + q.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %</b>.';

  if (q >= 66) {
    cls = 'g'; kopf = 'Vollentgeltlich';
    txt = 'Die Miete erreicht mindestens 66 % der ortsüblichen Marktmiete. Die Werbungskosten '
        + 'sind in voller Höhe abziehbar.';
  } else if (q >= 50) {
    cls = 'a'; kopf = 'Prüfung nötig';
    txt = 'Die Miete liegt zwischen 50 % und 66 % der ortsüblichen Marktmiete. In diesem Bereich '
        + 'entscheidet eine <b>Totalüberschussprognose</b> darüber, ob die Werbungskosten voll '
        + 'abziehbar bleiben. <b>Bitte steuerlich prüfen lassen.</b>';
  } else {
    cls = 'r'; kopf = 'Aufteilung droht';
    txt = 'Die Miete liegt unter 50 % der ortsüblichen Marktmiete. Die Nutzungsüberlassung wird '
        + 'dann in einen entgeltlichen und einen unentgeltlichen Teil aufgeteilt; die '
        + 'Werbungskosten sind nur <b>anteilig</b> abziehbar. <b>Bitte steuerlich prüfen lassen.</b>';
  }

  box.innerHTML =
      '<div class="m66 m66-' + cls + '">'
    +   '<div class="m66-k"><span class="m66-p">§ 21 Abs. 2 EStG</span>' + kopf + '</div>'
    +   '<div class="m66-z">' + zahlen + '</div>'
    +   '<div class="m66-t">' + txt + '</div>'
    +   '<div class="m66-f">Orientierung, keine Steuerberatung. Maßgeblich ist die ortsübliche '
    +     'Marktmiete im Sinne der Rechtsprechung — hier wird der im Tab Bewertung erfasste Wert '
    +     'verwendet.</div>'
    + '</div>';
}

function _miete66Css() {
  if (document.getElementById('m66-css')) return;
  var s = document.createElement('style');
  s.id = 'm66-css';
  s.textContent =
    '.m66{border:1px solid rgba(128,128,128,.25);border-left-width:4px;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.55}'
  + '.m66-n{border-left-color:#8a8a92;opacity:.85}'
  + '.m66-g{border-left-color:#3FA56C}'
  + '.m66-a{border-left-color:var(--wl-c9a84c,#C9A84C)}'
  + '.m66-r{border-left-color:#B8625C}'
  + '.m66-k{font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}'
  + '.m66-p{font:600 9.5px ui-monospace,monospace;letter-spacing:.1em;opacity:.65;'
  +   'border:1px solid rgba(128,128,128,.3);border-radius:999px;padding:2px 8px}'
  + '.m66-z{margin-bottom:6px}'
  + '.m66-t{margin-bottom:8px}'
  + '.m66-f{font-size:11.5px;opacity:.6;line-height:1.45}';
  document.head.appendChild(s);
}

/* An die Rechenkette haengen: die Quote aendert sich, sobald Miete, Marktmiete
   oder Flaeche angefasst werden. calc() laeuft bei jeder dieser Aenderungen. */
(function () {
  function _hook() {
    try { _miete66Css(); renderMiete66(); } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    window.renderMiete66 = renderMiete66;
    ['nkm', 'ds2_marktmiete', 'wfl'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) { e.addEventListener('input', _hook); e.addEventListener('change', _hook); }
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _hook);
    else setTimeout(_hook, 300);
  }
})();
