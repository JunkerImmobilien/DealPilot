'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   v1227 · JAHRESABSCHLUSS EINER IMMOBILIEN-GESELLSCHAFT
   ───────────────────────────────────────────────────────────────────────────
   Marcel am 03.09.2026: "schau mal nach ob wir auch nr. 3 machen können …
   was ist wenn mehrere objekte in einer gesellschaft sind. können wir das
   zuordnen? dann wäre die Bilanz super und die GuV."

   Eine GmbH oder UG erzielt nach § 8 Abs. 2 KStG ausschliesslich Einkuenfte
   aus Gewerbebetrieb. Es gibt dort keine Anlage V, sondern eine Bilanz und
   eine Gewinn- und Verlustrechnung. Dieses Modul erzeugt beides aus den
   Daten, die DealPilot ohnehin fuehrt — je Gesellschaft, ueber alle Objekte
   dieses Halters.

   DREI GRUNDSAETZE, DIE HIER ALLES ENTSCHEIDEN:

   1 · EINE BILANZ MUSS AUFGEHEN, ODER SIE IST KEINE.
       DealPilot kennt nicht jede Geldbewegung — Einlagen, private Zahlungen
       fuer die Gesellschaft, Kautionen, den Zeitpunkt der Steuerzahlung.
       Die Differenz wird deshalb NICHT still auf eine Position aufgeschlagen,
       bis es passt, sondern als eigene Zeile ausgewiesen:
       "Verrechnungskonto Gesellschafter". Bei kleinen Immobilien-
       gesellschaften ist das nicht einmal ein Kunstgriff — dort laeuft
       tatsaechlich vieles ueber dieses Konto. Eine benannte Luecke kann
       geprueft werden, eine versteckte nicht.

   2 · NICHTS WIRD ZWEIMAL GERECHNET.
       Die Betraege kommen aus _computeYearTotal() — derselben Funktion, die
       auch der Bildschirm und die Steuer-Mappe benutzen. Die einzige neue
       Rechnung ist die Restschuld, weil sie im gespeicherten Steuersatz
       nicht steht (gemessen am 03.09.2026: 45 Felder, keines davon).
       Sie wird deshalb gegen den bestehenden Rechenkern GEPRUEFT —
       _gaRestschuldProbe() vergleicht sie fuer das geoeffnete Objekt mit
       State.cfRows[].rs, und das Ergebnis steht im PDF.

   3 · WAS NICHT BEKANNT IST, WIRD BENANNT.
       Fehlen die Kosten der Gesellschaft (v1226), ist der Jahresueberschuss
       zu hoch. Das Blatt sagt das, statt eine Null zu drucken, die wie ein
       gemessener Wert aussieht.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────────────────────
   1 · RESTSCHULD
   Annuitaetendarlehen, monatliche Zahlung. Die Parameter stehen am Objekt:
   d1 (Hoehe), d1z (Zins % p.a.), d1t (anfaengliche Tilgung %), dasselbe fuer
   d2. Startzeitpunkt ist der Darlehensvertrag, ersatzweise der
   wirtschaftliche Uebergang, ersatzweise das Kaufdatum.

   R(n) = D · (1+i)^n − (A/12) · ((1+i)^n − 1) / i
   mit i = z/1200 und A = D · (z+t)/100

   Was diese Formel NICHT kennt: Sondertilgungen, tilgungsfreie Anlaufzeiten,
   Bauspar- und Tilgungsaussetzungsvertraege, eine Anschlussfinanzierung zu
   anderen Konditionen nach Ablauf der Zinsbindung. Wo ein Darlehen einen
   anderen Typ als "annuitaet" traegt, sagt der Bericht es.
   ─────────────────────────────────────────────────────────────────────────── */
/* v1227b · ZAHLEN LIEST parseDe(), NICHT ICH.
   Gemessen an einem echten Objekt: mein eigener Parser machte aus dem
   Zinssatz "3.5" den Wert 35 — er hielt den Punkt fuer einen
   Tausendertrenner. Die App hat mit parseDe() laengst die Funktion, die
   beide Schreibweisen richtig liest ("3.5" -> 3,5 und "1.234,56" ->
   1234,56). Sie ist ab jetzt die Quelle; der eigene Weg bleibt nur als
   Rueckfall, falls das Modul einmal ohne calc.js geladen wird. Genau
   dafuer gilt die Regel, Rechenkerne nicht zu duplizieren — auch das
   Lesen einer Zahl ist einer. */
function _gaNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof window.parseDe === 'function') {
    var p = window.parseDe(v);
    return isFinite(p) ? p : 0;
  }
  var s = String(v).trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/* v1227b · d1_vertrag IST KEIN DATUM.
   Gemessen: das Feld ist ein Textfeld und trug am geprueften Objekt den
   Wert "4711" — eine VertragsNUMMER. Weil mein Rueckfall erst bei einem
   leeren Wert griff, rechnete die Restschuld mit null Monaten und blieb
   ueber fuenfzehn Jahre auf der vollen Darlehenssumme stehen. Ein Feld,
   das nach einem Datum klingt, ist keines: es wird nur genommen, wenn es
   auch wie eines aussieht. */
function _gaStartDatum(d) {
  var istDatum = function (x) { return /^\d{4}-\d{2}(-\d{2})?$/.test(String(x || '').trim()); };
  if (istDatum(d.d1_vertrag)) return d.d1_vertrag;
  if (istDatum(d.wirtschaftlicher_uebergang)) return d.wirtschaftlicher_uebergang;
  if (istDatum(d.kaufdat)) return d.kaufdat;
  return '';
}

/* Monate vom Start bis zum 31.12. des Bilanzjahres. Ein Darlehen, das erst
   im naechsten Jahr beginnt, hat null Monate und volle Restschuld. */
function _gaMonate(startIso, jahr) {
  if (!startIso) return null;
  var p = String(startIso).split('-');
  if (p.length < 2) return null;
  var sJ = parseInt(p[0], 10), sM = parseInt(p[1], 10);
  if (!sJ || !sM) return null;
  var n = (jahr - sJ) * 12 + (12 - sM + 1);
  return n;
}

function _gaRestschuldEines(D, z, t, n) {
  if (!(D > 0)) return 0;
  if (n == null || n <= 0) return D;
  var A = D * (z + t) / 100;          /* Jahresannuitaet */
  if (!(A > 0)) return D;             /* weder Zins noch Tilgung: nichts passiert */
  var m = A / 12;
  if (z <= 0) return Math.max(0, D - m * n);
  var i = z / 1200;
  var q = Math.pow(1 + i, n);
  var R = D * q - m * (q - 1) / i;
  return Math.max(0, R);
}

/* Liefert die Restschuld ALLER Darlehen eines Objekts zum 31.12. des Jahres
   und sagt dazu, worauf sie beruht. */
function _gaRestschuld(d, jahr) {
  d = d || {};
  var start = _gaStartDatum(d);
  var n = _gaMonate(start, jahr);
  var teile = [], summe = 0, vorbehalt = [];

  [['d1', 'd1z', 'd1t', 'd1_type', 'Darlehen 1'],
   ['d2', 'd2z', 'd2t', 'd2_type', 'Darlehen 2']].forEach(function (k) {
    var D = _gaNum(d[k[0]]);
    if (!(D > 0)) return;
    var z = _gaNum(d[k[1]]), t = _gaNum(d[k[2]]);
    var typ = String(d[k[3]] || '').toLowerCase();
    var R = _gaRestschuldEines(D, z, t, n);
    if (typ && typ.indexOf('annu') < 0) {
      vorbehalt.push(k[4] + ' ist als "' + d[k[3]] + '" erfasst und wird hier wie ein '
        + 'Annuitätendarlehen gerechnet');
    }
    teile.push({ name: k[4], anfang: D, zins: z, tilgung: t, rest: R });
    summe += R;
  });

  if (!start && teile.length) vorbehalt.push('kein Darlehensbeginn hinterlegt');
  if (_gaNum(d.sondertilgung) > 0 || _gaNum(d.st_jahr) > 0) {
    vorbehalt.push('Sondertilgungen sind in dieser Rechnung nicht enthalten');
  }

  return {
    summe: summe,
    teile: teile,
    monate: n,
    start: start,
    bekannt: teile.length > 0,
    vorbehalt: vorbehalt
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   DIE GEGENPROBE. Ohne sie waere die Formel oben ein zweiter
   Wahrheitsanspruch neben dem Rechenkern. Fuer das GEOEFFNETE Objekt gibt es
   beide Zahlen — die eigene und State.cfRows[].rs aus calc.js. Stimmen sie
   ueberein, ist die Formel belegt; weichen sie ab, steht die Abweichung im
   PDF und niemand haelt die Bilanz fuer geprueft, die es nicht ist.
   ─────────────────────────────────────────────────────────────────────────── */
function _gaRestschuldProbe(jahr) {
  try {
    if (!window.State || !State.cfRows || !State.cfRows.length) return null;
    var zeile = null;
    for (var i = 0; i < State.cfRows.length; i++) {
      if (State.cfRows[i].cal === jahr) { zeile = State.cfRows[i]; break; }
    }
    if (!zeile) return null;
    var kern = _gaNum(zeile.rs != null ? zeile.rs : zeile.eff_rs);
    if (!(kern > 0)) return null;

    var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    var d = {
      d1: g('d1'), d1z: g('d1z'), d1t: g('d1t'), d1_type: g('d1_type'), d1_vertrag: g('d1_vertrag'),
      d2: g('d2'), d2z: g('d2z'), d2t: g('d2t'), d2_type: g('d2_type'),
      wirtschaftlicher_uebergang: g('wirtschaftlicher_uebergang'), kaufdat: g('kaufdat')
    };
    var eigen = _gaRestschuld(d, jahr).summe;
    var abw = kern ? Math.abs(eigen - kern) / kern : 0;
    return { kern: kern, eigen: eigen, abweichung: abw, ok: abw < 0.01 };
  } catch (e) { return null; }
}

/* ───────────────────────────────────────────────────────────────────────────
   2 · DIE ZUORDNUNG DER STEUERFELDER ZU DEN GuV-POSITIONEN
   Gliederung nach § 275 Abs. 2 HGB (Gesamtkostenverfahren), verkuerzt auf
   das, was bei einer reinen Vermietungsgesellschaft vorkommt.

   `anschaffungsnah` steht hier bei den ABSCHREIBUNGEN und nicht beim
   Erhaltungsaufwand. Gemessen in tax.js: das Feld traegt bereits den auf die
   Gebaeude-Nutzungsdauer verteilten Jahresbetrag (tax.js:1025 mit der
   effektiven Nutzungsdauer aus Zeile 887) — es ist eine Abschreibung, keine
   sofort abziehbare Ausgabe. Wer es beim Erhaltungsaufwand einsortiert,
   verschiebt keine Summe, aber jede einzelne Position.
   ─────────────────────────────────────────────────────────────────────────── */
var _GA_GUV = [
  { k: 'umsatz', t: 'Umsatzerlöse', hgb: '§ 275 Abs. 2 Nr. 1',
    felder: ['einnahmen_km', 'einnahmen_nk'], vorzeichen: 1,
    hinweis: 'Kaltmieten und umgelegte Nebenkosten' },
  { k: 'grundstueck', t: 'Grundstücksaufwendungen', hgb: '§ 275 Abs. 2 Nr. 5',
    felder: ['nk_umlf', 'nk_n_umlf', 'betr_sonst', 'erhaltungsaufwand'], vorzeichen: -1,
    hinweis: 'Betriebskosten und Erhaltungsaufwand' },
  { k: 'personal', t: 'Personalaufwand', hgb: '§ 275 Abs. 2 Nr. 6',
    felder: [], vorzeichen: -1,
    hinweis: 'Geschäftsführergehalt aus den Kosten der Gesellschaft' },
  { k: 'afa', t: 'Abschreibungen', hgb: '§ 275 Abs. 2 Nr. 7',
    felder: ['afa', 'sonst_bewegl_wg', 'anschaffungsnah'], vorzeichen: -1,
    hinweis: 'Gebäude linear und § 7b, bewegliche Wirtschaftsgüter, anschaffungsnahe Herstellkosten' },
  { k: 'sonstige', t: 'Sonstige betriebliche Aufwendungen', hgb: '§ 275 Abs. 2 Nr. 8',
    felder: ['hausverwaltung', 'steuerber', 'porto', 'verw_sonst', 'fahrtkosten',
             'verpflegung', 'hotel', 'inserat', 'gericht', 'telefon', 'sonst_kosten'],
    vorzeichen: -1,
    hinweis: 'Verwaltung der Objekte, dazu die Kosten der Gesellschaft ohne Personal' },
  { k: 'zinsen', t: 'Zinsen und ähnliche Aufwendungen', hgb: '§ 275 Abs. 2 Nr. 13',
    felder: ['schuldzinsen', 'kontofuehrung', 'bereitstellung', 'notar_grundschuld',
             'vermittlung', 'finanz_sonst'], vorzeichen: -1,
    hinweis: 'Zinsen und Finanzierungsnebenkosten' }
];

/* ───────────────────────────────────────────────────────────────────────────
   3 · DATEN SAMMELN
   Wie die Steuer-Mappe: die Liste /objects traegt kein `data`, die Details
   liegen in /objects/:id. Zusaetzlich werden hier ALLE Jahre der Steuersaetze
   geholt, nicht nur das Bilanzjahr — die kumulierte Abschreibung des
   Anlagevermoegens ist die Summe aller Jahre bis einschliesslich des
   Bilanzjahres, und die steht nirgends sonst.
   ─────────────────────────────────────────────────────────────────────────── */
async function _gaDaten(halterId, jahr) {
  var r = await Auth.apiCall('/tax-records?from=1990&to=' + (jahr + 1));
  var alle = (r && r.records) || [];

  var lo = await Auth.apiCall('/objects');
  var liste = (lo && (lo.items || lo.objects || lo)) || [];
  if (!Array.isArray(liste)) liste = [];

  /* Welche Objekte gehoeren diesem Halter? Die Listenantwort traegt `halter`
     top-level — geprueft am 03.09.2026. */
  var meine = liste.filter(function (o) {
    return String(o.halter || 'privat') === String(halterId);
  }).map(function (o) { return o.id; });

  var details = await Promise.all(meine.map(function (id) {
    return Auth.apiCall('/objects/' + id).catch(function () { return null; });
  }));

  var objekte = [];
  details.forEach(function (res, i) {
    var id = meine[i];
    var o = res ? (res.object || res) : null;
    var d = (o && o.data) || {};
    var name = (o && o.name) || (liste.filter(function (x) { return x.id === id; })[0] || {}).name || 'Objekt';

    var saetze = alle.filter(function (s) { return s.object_id === id; });
    var satzJahr = saetze.filter(function (s) { return Number(s.year) === jahr; })[0] || null;
    var bisJahr = saetze.filter(function (s) { return Number(s.year) <= jahr; });

    /* Kumulierte Abschreibung — Gebaeude und bewegliche Wirtschaftsgueter
       getrennt, weil sie in der Bilanz getrennt stehen. */
    var kumGeb = 0, kumBwg = 0;
    bisJahr.forEach(function (s) {
      kumGeb += _gaNum(s.afa) + _gaNum(s.anschaffungsnah);
      kumBwg += _gaNum(s.sonst_bewegl_wg);
    });

    var kp = _gaNum(d.kp);
    var gebAnt = _gaNum(d.geb_ant) / 100;
    if (!(gebAnt > 0 && gebAnt <= 1)) gebAnt = 0.80;
    /* Ueberfuehrte Objekte: die Gesellschaft setzt den Verkehrswert an. */
    var basis = (d.obj_herkunft === 'ueberfuehrung' && _gaNum(d.verkehrswert_ueberf) > 0)
      ? _gaNum(d.verkehrswert_ueberf) : kp;
    /* Anschaffungsnahe Herstellkosten sind aktiviert — sie erhoehen die
       Anschaffungskosten des Gebaeudes, sonst faellt der Buchwert um eine
       Abschreibung, deren Grundlage in der Bilanz fehlt. */
    var aktiviert = bisJahr.some(function (s) { return _gaNum(s.anschaffungsnah) > 0; })
      ? _gaNum(d.san) : 0;

    objekte.push({
      id: id, name: name, data: d, detailsDa: !!res,
      satz: satzJahr,
      jahreErfasst: saetze.map(function (s) { return Number(s.year); }).sort(),
      akGrund: basis * (1 - gebAnt),
      akGebaeude: basis * gebAnt + aktiviert,
      akAktiviert: aktiviert,
      akBwg: _gaNum(d.moebl),
      kumAfaGebaeude: kumGeb,
      kumAfaBwg: kumBwg,
      basisIstVerkehrswert: (basis !== kp),
      restschuld: _gaRestschuld(d, jahr)
    });
  });

  return { objekte: objekte, gesamtSaetze: alle.length };
}

/* ───────────────────────────────────────────────────────────────────────────
   4 · GuV UND BILANZ RECHNEN
   ─────────────────────────────────────────────────────────────────────────── */
function _gaRechnen(halterId, jahr, daten) {
  var mand = null, reg = {}, bh = {};
  try {
    mand = window.DealPilotMandanten && DealPilotMandanten.get(halterId);
    reg = (mand && mand.regime) || {};
    bh = (mand && mand.bh) || {};
  } catch (e) {}

  var kosten = { erfasst: false, summe: 0, werte: {}, arten: [] };
  try {
    if (window.DealPilotMandanten && DealPilotMandanten.kostenFuer) {
      kosten = DealPilotMandanten.kostenFuer(halterId, jahr);
    }
  } catch (e) {}

  /* ── GuV ── */
  var guv = {}, ohneSatz = [];
  _GA_GUV.forEach(function (p) { guv[p.k] = 0; });

  daten.objekte.forEach(function (o) {
    if (!o.satz) { ohneSatz.push(o.name); return; }
    var t = _computeYearTotal(jahr, 0, o.satz);
    o.totals = t;
    var v = (t && t.values) || {};
    _GA_GUV.forEach(function (p) {
      p.felder.forEach(function (f) { guv[p.k] += _gaNum(v[f]); });
    });
  });

  /* Die Kosten der Gesellschaft treten hier dazu — Personal getrennt, weil
     das HGB es getrennt verlangt. */
  var gfGehalt = _gaNum(kosten.werte && kosten.werte.gf);
  guv.personal += gfGehalt;
  guv.sonstige += (kosten.summe - gfGehalt);

  var ergebnisVorSteuern = guv.umsatz - guv.grundstueck - guv.personal
    - guv.afa - guv.sonstige - guv.zinsen;

  /* Steuern vom Einkommen und Ertrag: derselbe Satz, mit dem die App den
     Cashflow rechnet — effRate() liefert KSt + Soli und, wenn die erweiterte
     Kuerzung nicht greift, die Gewerbesteuer. Bei einem Verlust faellt keine
     Steuer an; ein Verlustvortrag wird hier NICHT gerechnet. */
  var satz = null;
  try {
    if (window.DealPilotMandanten && DealPilotMandanten.effRate) {
      satz = DealPilotMandanten.effRate(halterId);
    }
  } catch (e) {}
  if (satz == null || !isFinite(satz)) satz = 0.15825;
  var steuern = ergebnisVorSteuern > 0 ? ergebnisVorSteuern * satz : 0;
  var jahresueberschuss = ergebnisVorSteuern - steuern;

  /* ── Bilanz ── */
  var akGrund = 0, akGeb = 0, kumGeb = 0, akBwg = 0, kumBwg = 0, darlehen = 0;
  var restUnbekannt = [];
  daten.objekte.forEach(function (o) {
    akGrund += o.akGrund;
    akGeb += o.akGebaeude;
    kumGeb += o.kumAfaGebaeude;
    akBwg += o.akBwg;
    kumBwg += o.kumAfaBwg;
    darlehen += o.restschuld.summe;
    if (!o.restschuld.bekannt) restUnbekannt.push(o.name);
  });

  var bwGeb = Math.max(0, akGeb - kumGeb);
  var bwBwg = Math.max(0, akBwg - kumBwg);
  var bank = _gaNum(bh.eb_bank);

  var aktivaOhneAusgleich = akGrund + bwGeb + bwBwg + bank;

  var stammkapital = _gaNum(bh.stammkapital);
  var gewinnvortrag = _gaNum(bh.eb_gewinnvortrag);
  var gesdar = _gaNum(bh.eb_gesdar);
  var passivaOhneAusgleich = stammkapital + gewinnvortrag + jahresueberschuss
    + darlehen + gesdar + steuern;

  /* Der Ausgleich. Positiv heisst: die Gesellschaft schuldet dem
     Gesellschafter — die Zeile steht auf der Passivseite. Negativ heisst
     umgekehrt, dann steht sie als Forderung links. */
  var ausgleich = aktivaOhneAusgleich - passivaOhneAusgleich;

  return {
    mandant: mand, regime: reg, bh: bh, kosten: kosten,
    steuersatz: satz,
    guv: {
      umsatz: guv.umsatz, grundstueck: guv.grundstueck, personal: guv.personal,
      afa: guv.afa, sonstige: guv.sonstige, zinsen: guv.zinsen,
      ergebnisVorSteuern: ergebnisVorSteuern, steuern: steuern,
      jahresueberschuss: jahresueberschuss
    },
    bilanz: {
      akGrund: akGrund, akGebaeude: akGeb, kumAfaGebaeude: kumGeb, bwGebaeude: bwGeb,
      akBwg: akBwg, kumAfaBwg: kumBwg, bwBwg: bwBwg,
      bank: bank,
      stammkapital: stammkapital, gewinnvortrag: gewinnvortrag,
      jahresueberschuss: jahresueberschuss,
      darlehen: darlehen, gesdar: gesdar, steuerrueckstellung: steuern,
      ausgleich: ausgleich,
      summeAktiva: aktivaOhneAusgleich + (ausgleich < 0 ? -ausgleich : 0),
      summePassiva: passivaOhneAusgleich + (ausgleich > 0 ? ausgleich : 0)
    },
    befunde: {
      ohneSatz: ohneSatz,
      restUnbekannt: restUnbekannt,
      kostenFehlen: !kosten.erfasst,
      probe: _gaRestschuldProbe(jahr)
    }
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   5 · DAS PDF
   ─────────────────────────────────────────────────────────────────────────── */
async function exportAbschlussPDF(halterId, jahr) {
  if (typeof Plan !== 'undefined' && Plan.can && !Plan.can('werbungskosten_pdf')) {
    if (typeof toast === 'function') toast('🔒 Der Jahresabschluss ist im Investor-Plan enthalten');
    return;
  }
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
  if (typeof window.jspdf === 'undefined') {
    if (typeof toast === 'function') toast('PDF-Bibliothek lädt noch...');
    return;
  }
  if (typeof _computeYearTotal !== 'function') {
    if (typeof toast === 'function') toast('Steuerrechnung nicht geladen');
    return;
  }
  jahr = parseInt(jahr, 10) || (new Date().getFullYear() - 1);

  var reg = null;
  try { reg = _steuerRegime(halterId); } catch (e) {}
  if (reg && reg.anlageV) {
    if (typeof toast === 'function') {
      toast('Jahresabschluss gibt es nur für Gesellschaften — ' + reg.name + ' ist ' + reg.art);
    }
    return;
  }

  var daten, rech;
  try {
    daten = await _gaDaten(halterId, jahr);
  } catch (e) {
    if (typeof toast === 'function') toast('✗ Daten nicht abrufbar: ' + (e.message || e));
    return;
  }
  if (!daten.objekte.length) {
    if (typeof toast === 'function') toast('Dieser Gesellschaft ist kein Objekt zugeordnet.');
    return;
  }
  rech = _gaRechnen(halterId, jahr, daten);

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210, H = 297, M = 16, CW = W - 2 * M;
  var name = (rech.mandant && rech.mandant.name) || 'Gesellschaft';

  _gaDeckblatt(doc, jahr, name, rech, daten, W, H, M, CW);
  doc.addPage();
  _gaGuvSeite(doc, jahr, name, rech, W, H, M, CW);
  doc.addPage();
  _gaBilanzSeite(doc, jahr, name, rech, W, H, M, CW);
  doc.addPage();
  _gaSpiegelSeite(doc, jahr, name, rech, daten, W, H, M, CW);

  doc.save('Jahresabschluss_' + String(name).replace(/[^\wäöüÄÖÜß-]+/g, '_') + '_' + jahr + '.pdf');
  if (typeof toast === 'function') {
    toast('✓ Jahresabschluss ' + jahr + ' — ' + daten.objekte.length + ' Objekt'
      + (daten.objekte.length === 1 ? '' : 'e'));
  }
}

/* ── gemeinsame Bausteine ── */
function _gaEur(n) {
  var v = Math.round(Number(n) || 0);
  return v.toLocaleString('de-DE') + ' €';
}
function _gaKopf(doc, W, M, titel, unter, rechtsOben, rechtsUnten) {
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(0, 26, W, 1, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(titel, M, 13);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(unter, M, 19);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(rechtsOben, W - M, 13, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(rechtsUnten, W - M, 19, { align: 'right' });
  doc.setTextColor(42, 39, 39);
}

function _gaDeckblatt(doc, jahr, name, rech, daten, W, H, M, CW) {
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 46, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(0, 46, W, 1.4, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  doc.text('JAHRESABSCHLUSS', M, 24);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.4);
  doc.text('Bilanz und Gewinn- und Verlustrechnung · Einkünfte aus Gewerbebetrieb · § 8 Abs. 2 KStG', M, 33);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('Geschäftsjahr ' + jahr, W - M, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Erstellt: ' + new Date().toLocaleDateString('de-DE'), W - M, 33, { align: 'right' });

  var cy = 62;
  var ident = (rech.mandant && rech.mandant.ident) || {};
  var zeile = function (lab, wert, fehlt) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(122, 115, 112);
    doc.text(lab, M, cy);
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, fehlt ? [176, 140, 90] : [42, 39, 39]);
    doc.setFont('helvetica', fehlt ? 'italic' : 'bold');
    doc.text(String(wert), M + 46, cy);
    cy += 8;
  };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(42, 39, 39);
  doc.text('GESELLSCHAFT', M, cy);
  cy += 3;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, cy, M + CW, cy); cy += 8;

  zeile('Name', name, false);
  zeile('Rechtsform', (rech.regime && rech.mandant)
    ? (window.DealPilotMandanten.rfLabel(rech.mandant.rechtsform)) : '—', false);
  zeile('Steuernummer', ident.steuernummer || 'nicht hinterlegt', !ident.steuernummer);
  zeile('Finanzamt', ident.finanzamt || 'nicht hinterlegt', !ident.finanzamt);
  zeile('Handelsregister', ident.handelsregister || 'nicht hinterlegt', !ident.handelsregister);
  zeile('USt-IdNr.', ident.ustid || 'nicht hinterlegt', !ident.ustid);
  var anschrift = [ident.strasse, ident.ort].filter(Boolean).join(', ');
  zeile('Anschrift', anschrift || 'nicht hinterlegt', !anschrift);
  zeile('Steuersatz', (rech.steuersatz * 100).toFixed(3).replace('.', ',') + ' %'
    + (rech.regime.erw_kuerzung !== false ? '  ·  erweiterte Kürzung § 9 GewStG' : ''), false);

  cy += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(42, 39, 39);
  doc.text('OBJEKTE DER GESELLSCHAFT (' + daten.objekte.length + ')', M, cy);
  cy += 3;
  doc.setDrawColor(210, 205, 198); doc.line(M, cy, M + CW, cy); cy += 7;
  daten.objekte.forEach(function (o, i) {
    if (cy > H - 76) { doc.addPage(); cy = 26; }
    doc.setFont('helvetica', 'normal'); doc.setTextColor(122, 115, 112); doc.setFontSize(8);
    doc.text(String(i + 1) + '.', M, cy);
    doc.setTextColor(42, 39, 39); doc.setFontSize(9);
    doc.text(String(o.name).slice(0, 46)
      + (o.basisIstVerkehrswert ? '  (überführt)' : ''), M + 7, cy);
    doc.setTextColor(122, 115, 112); doc.setFontSize(7.5);
    doc.text(o.satz ? ('Buchwert ' + _gaEur(Math.max(0, o.akGebaeude - o.kumAfaGebaeude) + o.akGrund))
                    : 'kein Steuersatz für ' + jahr, M + CW, cy, { align: 'right' });
    cy += 6.2;
  });

  /* Was das Heft NICHT ist — auf dem Deckblatt, nicht im Kleingedruckten. */
  var fy = H - 40;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, fy - 6, M + CW, fy - 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(122, 115, 112);
  var ft = doc.splitTextToSize('Diese Auswertung fasst zusammen, was DealPilot über die Objekte '
    + 'dieser Gesellschaft führt, und stellt es in der Gliederung des HGB dar. '
    + 'Sie ist KEIN aufgestellter Jahresabschluss im Sinne der §§ 242 ff. HGB und ersetzt weder '
    + 'die Buchführung noch die Beratung: sie kennt nur die Geschäftsvorfälle, die in DealPilot '
    + 'erfasst sind. Was darüber hinaus über das Konto der Gesellschaft läuft, steht als '
    + '„Verrechnungskonto Gesellschafter" in der Bilanz — siehe die Erläuterung dort.', CW);
  doc.text(ft, M, fy);
}

function _gaGuvSeite(doc, jahr, name, rech, W, H, M, CW) {
  _gaKopf(doc, W, M, 'GEWINN- UND VERLUSTRECHNUNG',
    'Gesamtkostenverfahren · § 275 Abs. 2 HGB', name, '01.01.–31.12.' + jahr);

  var cy = 38, g = rech.guv;
  var pos = function (nr, txt, betrag, opt) {
    opt = opt || {};
    if (cy > H - 34) { doc.addPage(); cy = 26; }
    doc.setFont('helvetica', opt.fett ? 'bold' : 'normal');
    doc.setFontSize(opt.fett ? 9.5 : 9);
    doc.setTextColor(122, 115, 112); doc.setFontSize(7.5);
    if (nr) doc.text(nr, M, cy);
    doc.setTextColor.apply(doc, opt.rot ? [176, 90, 84] : [42, 39, 39]);
    doc.setFontSize(opt.fett ? 9.5 : 9);
    doc.text(txt, M + 12, cy);
    doc.text(_gaEur(betrag), M + CW, cy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    cy += opt.fett ? 7 : 6;
    if (opt.hinweis) {
      doc.setFontSize(6.8); doc.setTextColor(150, 143, 136);
      var h = doc.splitTextToSize(opt.hinweis, CW - 14);
      doc.text(h, M + 12, cy - 1.5);
      cy += h.length * 3.1 + 1.5;
      doc.setTextColor(42, 39, 39);
    }
  };
  var strich = function (dick) {
    doc.setDrawColor(42, 39, 39); doc.setLineWidth(dick ? 0.5 : 0.3);
    doc.line(M + 12, cy - 3.5, M + CW, cy - 3.5);
    cy += 1.5;
  };

  pos('1.', 'Umsatzerlöse', g.umsatz, { hinweis: 'Kaltmieten und umgelegte Nebenkosten aller Objekte' });
  cy += 2;
  pos('5.', 'Grundstücksaufwendungen', -g.grundstueck, { hinweis: 'Betriebskosten und Erhaltungsaufwand' });
  pos('6.', 'Personalaufwand', -g.personal, { hinweis: 'Geschäftsführergehalt aus den Kosten der Gesellschaft' });
  pos('7.', 'Abschreibungen', -g.afa, { hinweis: 'Gebäude linear und § 7b, bewegliche Wirtschaftsgüter, anschaffungsnahe Herstellkosten' });
  pos('8.', 'Sonstige betriebliche Aufwendungen', -g.sonstige, { hinweis: 'Verwaltung der Objekte, dazu die Kosten der Gesellschaft ohne Personal' });
  pos('13.', 'Zinsen und ähnliche Aufwendungen', -g.zinsen, { hinweis: 'Zinsen und Finanzierungsnebenkosten' });
  strich(true);
  pos('', 'Ergebnis vor Steuern', g.ergebnisVorSteuern, { fett: true, rot: g.ergebnisVorSteuern < 0 });
  pos('14.', 'Steuern vom Einkommen und vom Ertrag', -g.steuern,
    { hinweis: 'Satz ' + (rech.steuersatz * 100).toFixed(3).replace('.', ',') + ' % — '
      + 'Körperschaftsteuer und Soli'
      + (rech.regime.erw_kuerzung !== false
          ? ', Gewerbesteuer wegen erweiterter Kürzung nach § 9 Nr. 1 Satz 2 GewStG mit 0 angesetzt'
          : ', einschließlich Gewerbesteuer')
      + '. Ein Verlustvortrag aus Vorjahren ist nicht berücksichtigt.' });
  strich(true);
  pos('', 'Jahresüberschuss', g.jahresueberschuss, { fett: true, rot: g.jahresueberschuss < 0 });

  /* Die Kosten der Gesellschaft — und was es heisst, wenn sie fehlen. */
  cy += 8;
  if (rech.befunde.kostenFehlen) {
    var bh = doc.splitTextToSize('Für ' + jahr + ' sind KEINE Kosten der Gesellschaft erfasst. '
      + 'Steuerberatung für den Jahresabschluss, Kammerbeiträge, Kontoführung und ein etwaiges '
      + 'Geschäftsführergehalt fehlen damit vollständig. Der Jahresüberschuss oben ist deshalb '
      + 'zu hoch, und die Bilanz auf der nächsten Seite geht in gleicher Höhe nicht auf. '
      + 'Nachzutragen unter Einstellungen / Mandanten.', CW - 8);
    var bhh = bh.length * 3.6 + 11;
    doc.setFillColor(250, 240, 236);
    doc.setDrawColor(176, 98, 92); doc.setLineWidth(0.4);
    doc.rect(M, cy, CW, bhh, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(176, 98, 92);
    doc.text('KOSTEN DER GESELLSCHAFT FEHLEN', M + 4, cy + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
    doc.setTextColor(122, 90, 86);
    doc.text(bh, M + 4, cy + 10.5);
    doc.setTextColor(42, 39, 39);
    cy += bhh + 6;
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(42, 39, 39);
    doc.text('DARIN ENTHALTEN: KOSTEN DER GESELLSCHAFT', M, cy);
    cy += 2.5;
    doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
    doc.line(M, cy, M + CW, cy); cy += 5.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    (rech.kosten.arten || []).forEach(function (a) {
      if (!a.betrag) return;
      doc.setTextColor(42, 39, 39);
      doc.text(a.t, M + 12, cy);
      doc.text(_gaEur(a.betrag), M + CW, cy, { align: 'right' });
      cy += 5.4;
    });
    doc.setFont('helvetica', 'bold');
    doc.text('Summe', M + 12, cy);
    doc.text(_gaEur(rech.kosten.summe), M + CW, cy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    cy += 8;
  }

  if (rech.befunde.ohneSatz.length) {
    doc.setFontSize(7.2); doc.setTextColor(176, 98, 92);
    var os = doc.splitTextToSize('Für ' + rech.befunde.ohneSatz.length + ' Objekt'
      + (rech.befunde.ohneSatz.length === 1 ? '' : 'e') + ' liegt für ' + jahr
      + ' kein Steuersatz vor: ' + rech.befunde.ohneSatz.join(', ')
      + '. Diese Objekte sind in der GuV mit null enthalten, stehen in der Bilanz aber mit '
      + 'ihrem Buchwert — die Rechnung ist deshalb unvollständig.', CW);
    doc.text(os, M, cy);
    cy += os.length * 3.4 + 3;
    doc.setTextColor(42, 39, 39);
  }
}

function _gaBilanzSeite(doc, jahr, name, rech, W, H, M, CW) {
  _gaKopf(doc, W, M, 'BILANZ', 'Gliederung nach § 266 HGB, verkürzt',
    name, 'zum 31.12.' + jahr);

  var b = rech.bilanz;
  var sp = (CW - 8) / 2;
  var lx = M, rx = M + sp + 8;
  var ly = 40, ry = 40;

  var seite = function (x, y, t) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setTextColor(42, 39, 39);
    doc.text(t, x, y);
    doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.5);
    doc.line(x, y + 2, x + sp, y + 2);
    return y + 8;
  };
  var zeile = function (x, y, t, betrag, opt) {
    opt = opt || {};
    doc.setFont('helvetica', opt.fett ? 'bold' : 'normal');
    doc.setFontSize(opt.klein ? 7.5 : 8.6);
    doc.setTextColor.apply(doc, opt.aus ? [150, 120, 70] : [42, 39, 39]);
    var tt = doc.splitTextToSize(t, sp - 26);
    doc.text(tt, x, y);
    if (betrag !== null) doc.text(_gaEur(betrag), x + sp, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(42, 39, 39);
    return y + (tt.length > 1 ? tt.length * 3.9 + 1.6 : 5.6);
  };
  var unter = function (x, y, t) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6);
    doc.setTextColor(150, 143, 136);
    var tt = doc.splitTextToSize(t, sp - 2);
    doc.text(tt, x, y);
    doc.setTextColor(42, 39, 39);
    return y + tt.length * 3 + 1.6;
  };

  /* ── Aktiva ── */
  ly = seite(lx, ly, 'AKTIVA');
  ly = zeile(lx, ly, 'A. Anlagevermögen', null, { fett: true });
  ly = zeile(lx, ly, 'I. Grundstücke', b.akGrund);
  ly = unter(lx, ly, 'Anschaffungskosten, nicht abgeschrieben');
  ly = zeile(lx, ly, 'II. Gebäude', b.bwGebaeude);
  ly = unter(lx, ly, 'AK ' + _gaEur(b.akGebaeude) + ' abzüglich kumulierter AfA '
    + _gaEur(b.kumAfaGebaeude));
  if (b.akBwg > 0) {
    ly = zeile(lx, ly, 'III. Betriebs- und Geschäftsausstattung', b.bwBwg);
    ly = unter(lx, ly, 'AK ' + _gaEur(b.akBwg) + ' abzüglich ' + _gaEur(b.kumAfaBwg));
  }
  ly += 2;
  ly = zeile(lx, ly, 'B. Umlaufvermögen', null, { fett: true });
  ly = zeile(lx, ly, 'Guthaben bei Kreditinstituten', b.bank);
  ly = unter(lx, ly, 'Eröffnungsbestand aus den Stammdaten — die laufenden '
    + 'Zahlungen des Jahres sind DealPilot nicht bekannt');
  if (b.ausgleich < 0) {
    ly += 2;
    ly = zeile(lx, ly, 'Forderungen gegen Gesellschafter', -b.ausgleich, { aus: true });
    ly = unter(lx, ly, 'Ausgleichsposten — siehe Erläuterung unten');
  }

  /* ── Passiva ── */
  ry = seite(rx, ry, 'PASSIVA');
  ry = zeile(rx, ry, 'A. Eigenkapital', null, { fett: true });
  ry = zeile(rx, ry, 'I. Gezeichnetes Kapital', b.stammkapital);
  ry = zeile(rx, ry, 'II. Gewinnvortrag', b.gewinnvortrag);
  ry = unter(rx, ry, 'Anfangsbestand aus den Stammdaten');
  ry = zeile(rx, ry, 'III. Jahresüberschuss', b.jahresueberschuss);
  ry += 2;
  ry = zeile(rx, ry, 'B. Rückstellungen', null, { fett: true });
  ry = zeile(rx, ry, 'Steuerrückstellung', b.steuerrueckstellung);
  ry = unter(rx, ry, 'Körperschaftsteuer des Jahres, hier in voller Höhe als noch '
    + 'nicht gezahlt angesetzt — Vorauszahlungen sind nicht bekannt');
  ry += 2;
  ry = zeile(rx, ry, 'C. Verbindlichkeiten', null, { fett: true });
  ry = zeile(rx, ry, 'gegenüber Kreditinstituten', b.darlehen);
  ry = unter(rx, ry, 'Restschuld zum 31.12. aus den Darlehensangaben der Objekte');
  ry = zeile(rx, ry, 'Gesellschafterdarlehen', b.gesdar);
  if (b.ausgleich > 0) {
    ry = zeile(rx, ry, 'Verrechnungskonto Gesellschafter', b.ausgleich, { aus: true });
    ry = unter(rx, ry, 'Ausgleichsposten — siehe Erläuterung unten');
  }

  /* ── Summen ── */
  var sy = Math.max(ly, ry) + 4;
  doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.5);
  doc.line(lx, sy - 3, lx + sp, sy - 3);
  doc.line(rx, sy - 3, rx + sp, sy - 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.text('Summe Aktiva', lx, sy);
  doc.text(_gaEur(b.summeAktiva), lx + sp, sy, { align: 'right' });
  doc.text('Summe Passiva', rx, sy);
  doc.text(_gaEur(b.summePassiva), rx + sp, sy, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  /* ── Erläuterung des Ausgleichspostens ── */
  var cy = sy + 12;
  var ist = Math.abs(b.summeAktiva - b.summePassiva) < 1;
  doc.setFillColor(ist ? 246 : 250, ist ? 240 : 240, ist ? 220 : 236);
  doc.setDrawColor.apply(doc, ist ? [176, 140, 90] : [176, 98, 92]);
  doc.setLineWidth(0.4);
  var et = doc.splitTextToSize('Die Bilanz geht auf, weil die Differenz zwischen dem, was '
    + 'DealPilot kennt, und dem, was tatsächlich über das Konto der Gesellschaft lief, '
    + 'als eigene Zeile ausgewiesen wird — nicht, weil sie null wäre. In diesem Posten '
    + 'stecken alle Vorgänge, die DealPilot nicht führt: Einlagen und Entnahmen, private '
    + 'Zahlungen für die Gesellschaft, Mietkautionen, der Zeitpunkt von Steuerzahlungen, '
    + 'sowie die laufenden Bankbewegungen des Jahres. Bei kleinen Immobiliengesellschaften '
    + 'läuft vieles davon ohnehin über das Verrechnungskonto des Gesellschafters. '
    + 'Ein Betrag in ungewöhnlicher Höhe ist ein Hinweis darauf, dass Angaben fehlen — '
    + 'zuerst die Kosten der Gesellschaft und der Eröffnungsbestand der Bank prüfen.', CW - 8);
  var eh = et.length * 3.6 + 11;
  doc.rect(M, cy, CW, eh, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.setTextColor.apply(doc, ist ? [150, 120, 70] : [176, 98, 92]);
  doc.text('WARUM EIN VERRECHNUNGSKONTO UND KEINE STILLE KORREKTUR', M + 4, cy + 5.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(110, 103, 100);
  doc.text(et, M + 4, cy + 10.5);
  doc.setTextColor(42, 39, 39);
  cy += eh + 6;

  if (!ist) {
    doc.setFontSize(8); doc.setTextColor(176, 98, 92);
    doc.setFont('helvetica', 'bold');
    doc.text('ACHTUNG: Die Summen weichen um ' + _gaEur(b.summeAktiva - b.summePassiva)
      + ' voneinander ab. Das ist ein Fehler in der Rechnung, kein Datenmangel.', M, cy);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(42, 39, 39);
    cy += 7;
  }
}

function _gaSpiegelSeite(doc, jahr, name, rech, daten, W, H, M, CW) {
  _gaKopf(doc, W, M, 'ANLAGENSPIEGEL UND NACHWEISE',
    'je Objekt · § 268 Abs. 2 HGB', name, 'zum 31.12.' + jahr);

  var cy = 38;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.setTextColor(122, 115, 112);
  doc.text('OBJEKT', M, cy);
  doc.text('AK GEBÄUDE', M + 78, cy, { align: 'right' });
  doc.text('KUM. AfA', M + 112, cy, { align: 'right' });
  doc.text('BUCHWERT', M + 146, cy, { align: 'right' });
  doc.text('RESTSCHULD', M + CW, cy, { align: 'right' });
  cy += 2;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, cy, M + CW, cy); cy += 5.5;
  doc.setFont('helvetica', 'normal');

  var sAk = 0, sKum = 0, sBw = 0, sRs = 0;
  daten.objekte.forEach(function (o) {
    if (cy > H - 60) { doc.addPage(); cy = 26; }
    var bw = Math.max(0, o.akGebaeude - o.kumAfaGebaeude);
    sAk += o.akGebaeude; sKum += o.kumAfaGebaeude; sBw += bw; sRs += o.restschuld.summe;
    doc.setTextColor(42, 39, 39); doc.setFontSize(8.4);
    doc.text(String(o.name).slice(0, 34), M, cy);
    doc.text(_gaEur(o.akGebaeude), M + 78, cy, { align: 'right' });
    doc.text(_gaEur(o.kumAfaGebaeude), M + 112, cy, { align: 'right' });
    doc.text(_gaEur(bw), M + 146, cy, { align: 'right' });
    doc.text(o.restschuld.bekannt ? _gaEur(o.restschuld.summe) : 'kein Darlehen',
      M + CW, cy, { align: 'right' });
    cy += 5.2;
    var fu = [];
    if (o.basisIstVerkehrswert) fu.push('AfA-Bemessungsgrundlage ist der Verkehrswert bei Überführung');
    if (o.akAktiviert) fu.push('einschließlich aktivierter anschaffungsnaher Herstellkosten '
      + _gaEur(o.akAktiviert));
    if (o.jahreErfasst.length) fu.push('AfA kumuliert aus den Jahren '
      + o.jahreErfasst[0] + '–' + o.jahreErfasst[o.jahreErfasst.length - 1]);
    if (o.restschuld.vorbehalt.length) fu.push(o.restschuld.vorbehalt.join('; '));
    if (fu.length) {
      doc.setFontSize(6.6); doc.setTextColor(150, 143, 136);
      var t = doc.splitTextToSize(fu.join(' · '), CW - 4);
      doc.text(t, M + 4, cy);
      cy += t.length * 3 + 1.4;
      doc.setTextColor(42, 39, 39);
    }
    cy += 1.4;
  });

  doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.5);
  doc.line(M, cy, M + CW, cy); cy += 5.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6);
  doc.text('Summe', M, cy);
  doc.text(_gaEur(sAk), M + 78, cy, { align: 'right' });
  doc.text(_gaEur(sKum), M + 112, cy, { align: 'right' });
  doc.text(_gaEur(sBw), M + 146, cy, { align: 'right' });
  doc.text(_gaEur(sRs), M + CW, cy, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  cy += 12;

  /* ── Die Gegenprobe der Restschuldrechnung ── */
  var p = rech.befunde.probe;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.setTextColor(42, 39, 39);
  doc.text('WORAUF DIE RESTSCHULD BERUHT', M, cy);
  cy += 2.5;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, cy, M + CW, cy); cy += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(122, 115, 112);
  var pt = 'Der gespeicherte Steuersatz eines Objekts führt die Restschuld nicht — geprüft am '
    + '03.09.2026 an allen 45 Feldern. Sie wird deshalb hier aus den Darlehensangaben des '
    + 'Objekts gerechnet: Annuitätendarlehen mit monatlicher Zahlung, Beginn laut '
    + 'Darlehensvertrag. Nicht enthalten sind Sondertilgungen, tilgungsfreie Anlaufzeiten und '
    + 'eine Anschlussfinanzierung zu anderen Konditionen.';
  if (p) {
    pt += '  Gegenprobe am geöffneten Objekt gegen den Rechenkern der App: '
      + _gaEur(p.eigen) + ' hier, ' + _gaEur(p.kern) + ' dort — Abweichung '
      + (p.abweichung * 100).toFixed(2).replace('.', ',') + ' %'
      + (p.ok ? '. Die Rechnung stimmt mit dem Rechenkern überein.'
              : '. DAS IST ZU VIEL: die Restschuld in dieser Bilanz ist nicht belegt.');
  } else {
    pt += '  Eine Gegenprobe gegen den Rechenkern war nicht möglich, weil für ' + jahr
      + ' kein geöffnetes Objekt mit Cashflow-Reihe vorlag. Die Restschuld ist damit '
      + 'gerechnet, aber nicht geprüft.';
  }
  var ptt = doc.splitTextToSize(pt, CW);
  doc.text(ptt, M, cy);
  cy += ptt.length * 3.4 + 6;

  if (rech.befunde.restUnbekannt.length) {
    doc.setTextColor(176, 98, 92); doc.setFontSize(7.2);
    var ru = doc.splitTextToSize('Ohne Darlehensangaben und deshalb mit null angesetzt: '
      + rech.befunde.restUnbekannt.join(', ') + '. Ist eines dieser Objekte finanziert, '
      + 'fehlt die Verbindlichkeit in der Bilanz und der Ausgleichsposten ist entsprechend '
      + 'zu hoch.', CW);
    doc.text(ru, M, cy);
    cy += ru.length * 3.4 + 4;
    doc.setTextColor(42, 39, 39);
  }
}

window.exportAbschlussPDF = exportAbschlussPDF;
window._gaRestschuld = _gaRestschuld;
window._gaRestschuldProbe = _gaRestschuldProbe;
window._gaDaten = _gaDaten;
window._gaRechnen = _gaRechnen;
