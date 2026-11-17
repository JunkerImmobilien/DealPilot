/* js/modernisierung-herkunft.js — v3660 · WOHER DIE MODERNISIERUNGSPUNKTE KOMMEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEFUND 17.11.2026 (Paket aus sieben Mehrfamilienhaeusern der 1950er): das
 * Exposé beschrieb WDVS, Dachdaemmung, Brennwertheizung und modernisierte
 * Wohnungen, aber keine Jahreszahlen. DealPilot rechnete die Restnutzungs-
 * dauer nach Anlage 2 ImmoWertV mit 0 Punkten — still, ohne Hinweis. RND
 * 12 bis 14 Jahre, Ertragswert des Pakets 4,87 statt rund 7,05 Mio. EUR.
 *
 * Marcel: „Das müssen wir auch für andere Objekte berücksichtigen. Vielleicht
 * können wir den Zustand auch aus den Bildern ableiten. Wenn nicht, dann
 * mittel annehmen." — und dazu: „Er soll gucken, was Mehrwert gibt."
 *
 * DIESES MODUL RECHNET KEINE RESTNUTZUNGSDAUER. Es bestimmt nur, mit wie
 * vielen Punkten die Anlage 2 gerechnet wird und WOHER sie kommen. Die
 * Kerne (rnd-calc.js, anlage2.js) bekommen die Punkte als Parameter.
 *
 * RANGFOLGE (bestimmen()):
 *   1  eigene Angabe   Punkte, die acht Gewerke-Felder oder die Einheiten
 *                      (MFH); danach der grobe Zustand, wenn der Nutzer ihn
 *                      selbst gesetzt hat (Quick-Check „Zustand", Objekt
 *                      „Zustand")
 *   2  abgeleitet      JE GEWERK aus Exposé-Text und Bildern kombiniert:
 *                      konkrete Textaussage > Bild > allgemeiner Textsatz;
 *                      Gewerke ohne Aussage bekommen den Rueckfall-Anteil
 *   3  Rueckfall       nach Alter und Energieklasse (unten)
 *
 * RUECKFALL (rueckfall()) — Anlage 2 Tabelle 2 nennt fuer den „mittleren
 * Modernisierungsgrad" 6 bis 10 Punkte; angesetzt ist die Mitte, 8 Punkte.
 * Das ist zugleich die Zeile der Tabelle 3 mit a = 0,5 / b = 1,1 / c = 1,0
 * und der Wert, den das Auswahlfeld im Reiter Objekt fuer „mittel" fuehrt.
 * Je Gewerk sind das 40 Prozent der Hoechstpunkte (8 / 20).
 *   - Gebaeude juenger als 30 Jahre: 0 Punkte. Dort ist 0 der Modellwert
 *     fuer bauzeitliche, noch zeitgemaesse Bauteile, und die Anlage 2
 *     rechnet bis 60 % der GND ohnehin linear (GND minus Alter).
 *   - Energieklasse (nur Baujahr vor 1995, nur die vier energetischen
 *     Gewerke Dach, Fenster, Heizung, Aussenwand = 12 Punkte):
 *       A+ bis C  -> 70 % (wie „5 bis 10 Jahre")      gesamt 12 Punkte
 *       D, E      -> 40 % (Rueckfall unveraendert)     gesamt  8 Punkte
 *       F bis H   -> 20 %                              gesamt  6 Punkte
 *     Die uebrigen vier Gewerke (Baeder, Innenausbau, Leitungen, Grundriss)
 *     sagt der Energieausweis nicht — sie bleiben bei 40 %.
 *
 * TEILPUNKTE OHNE JAHR — dieselben Stufen wie punkteAusMod() in rnd-calc.js:
 *   unter 5 Jahren 100 %, 5–10 Jahre 70 %, 10–20 Jahre 40 %, aelter 0.
 *   Ohne Jahr 50 % (zwischen den beiden mittleren Stufen); „teilweise" die
 *   Haelfte davon, „ueberwiegend" drei Viertel.
 *
 * Laeuft im Browser (window.DpModernisierung), im Backend-Image ueber die
 * Spiegelung der Rechenkerne (vm-Kontext) und im mb-Backend als .cjs —
 * Byte fuer Byte dieselbe Datei (tools/rechenkerne-spiegeln.mjs).
 * Prueft: tools/modernisierung-ableiten-pruefen.mjs
 */
(function (root) {
  'use strict';

  var GEWERKE = [
    { id: 'dach',        max: 4, text: 'Dach',         energie: true  },
    { id: 'fenster',     max: 2, text: 'Fenster',      energie: true  },
    { id: 'leitungen',   max: 2, text: 'Leitungen',    energie: false },
    { id: 'heizung',     max: 2, text: 'Heizung',      energie: true  },
    { id: 'aussenwand',  max: 4, text: 'Außenwand',    energie: true  },
    { id: 'baeder',      max: 2, text: 'Bäder',        energie: false },
    { id: 'innenausbau', max: 2, text: 'Innenausbau',  energie: false },
    { id: 'grundriss',   max: 2, text: 'Grundriss',    energie: false }
  ];
  var MAX = {}; GEWERKE.forEach(function (g) { MAX[g.id] = g.max; });
  /* anlage2.js heisst die Aussenwand `daemmung` */
  var ALIAS = { daemmung: 'aussenwand', 'außenwand': 'aussenwand', bad: 'baeder', 'bäder': 'baeder' };

  /* Anlage 2 Tabelle 2 — die Grenzen der Verordnung */
  var GRADE = [
    { von: 0,  bis: 1,  text: 'nicht modernisiert' },
    { von: 2,  bis: 5,  text: 'kleine Modernisierungen im Rahmen der Instandhaltung' },
    { von: 6,  bis: 10, text: 'mittlerer Modernisierungsgrad' },
    { von: 11, bis: 17, text: 'überwiegend modernisiert' },
    { von: 18, bis: 20, text: 'umfassend modernisiert' }
  ];
  var ALTER_MIN = 30;          /* ab diesem Alter ist Modernisierung typisch */
  var BJ_ENERGIE_BIS = 1995;   /* vor der WSchV 1995 sagt die Klasse etwas ueber Modernisierung */
  var F_RUECKFALL = 0.4;       /* 8 von 20 Punkten, Mitte „mittel" */
  var F_ENERGIE = { gut: 0.7, mittel: 0.4, schlecht: 0.2 };
  var F_OHNE_JAHR = 0.5;
  var F_FOTO = { neuwertig: 0.7, zeitgemaess: 0.4, veraltet: 0 };

  /* Zustand (Quick-Check, Objekt) -> Punkte. Werte = Auswahlfeld „Modernisierungsgrad" */
  var ZUSTAND = {
    neubau:                     { punkte: 19, text: 'Neubau / kernsaniert' },
    gut:                        { punkte: 14, text: 'gut' },
    normal:                     { punkte: 8,  text: 'mittel' },
    mittel:                     { punkte: 8,  text: 'mittel' },
    renovierungsbeduerftig:     { punkte: 4,  text: 'renovierungsbedürftig' },
    stark_sanierungsbeduerftig: { punkte: 0,  text: 'sanierungsbedürftig' }
  };

  function zahl(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function kl(s) { return String(s || '').trim().toUpperCase().replace(/\s/g, ''); }

  function grad(p) {
    var q = Math.max(0, Math.min(20, Math.round(Number(p) || 0)));
    for (var i = 0; i < GRADE.length; i++) if (q >= GRADE[i].von && q <= GRADE[i].bis) return GRADE[i].text;
    return GRADE[0].text;
  }
  /* Punkte -> Zustand (fuer das Vorbelegen der Felder aus einer Ableitung) */
  function zustandAusPunkten(p) {
    var q = Math.round(Number(p) || 0);
    if (q >= 11) return 'gut';
    if (q >= 6) return 'normal';
    if (q >= 2) return 'renovierungsbeduerftig';
    return 'stark_sanierungsbeduerftig';
  }

  function energieKlasse(k) {
    var c = kl(k);
    if (/^A\+*$|^B$|^C$/.test(c)) return 'gut';
    if (c === 'D' || c === 'E') return 'mittel';
    if (c === 'F' || c === 'G' || c === 'H') return 'schlecht';
    return null;
  }

  var KUERZLICH = /(in den letzten (\d+ |zwei |drei |paar )?jahren|kürzlich|kuerzlich|jüngst|juengst|vor kurzem|frisch|neuwertig)/i;
  function jahrFaktor(jahr, stichtagJahr, kuerzlich) {
    var j = zahl(jahr), s = zahl(stichtagJahr) || new Date().getFullYear();
    if ((!(j > 1800) || j > s) && kuerzlich) return { f: 0.7, text: 'laut Text in den letzten Jahren' };
    if (!(j > 1800) || j > s) return { f: F_OHNE_JAHR, text: 'Zeitpunkt unbekannt' };
    var a = s - j;
    if (a < 5) return { f: 1, text: 'vor weniger als 5 Jahren' };
    if (a <= 10) return { f: 0.7, text: 'vor 5 bis 10 Jahren' };
    if (a <= 20) return { f: 0.4, text: 'vor 10 bis 20 Jahren' };
    return { f: 0, text: 'vor mehr als 20 Jahren' };
  }
  function umfangFaktor(u) {
    var s = String(u || '').toLowerCase();
    if (/teil/.test(s)) return 0.5;
    if (/ueberwieg|überwieg/.test(s)) return 0.75;
    return 1;
  }

  /* ── Rueckfall ohne jede Angabe ─────────────────────────────────────── */
  function rueckfallFaktoren(o) {
    o = o || {};
    var bj = zahl(o.baujahr), sj = zahl(o.stichtag_jahr) || new Date().getFullYear();
    var alter = bj > 1500 ? sj - bj : null;
    var ek = (bj > 1500 && bj < BJ_ENERGIE_BIS) ? energieKlasse(o.energieklasse) : null;
    var f = {};
    GEWERKE.forEach(function (g) {
      if (alter != null && alter < ALTER_MIN) f[g.id] = 0;
      else f[g.id] = (g.energie && ek) ? F_ENERGIE[ek] : F_RUECKFALL;
    });
    return { f: f, alter: alter, energie: ek, klasse: ek ? kl(o.energieklasse) : null, jung: alter != null && alter < ALTER_MIN };
  }

  function rueckfall(o) {
    var rf = rueckfallFaktoren(o), summe = 0, gew = {};
    GEWERKE.forEach(function (g) { var p = r1(g.max * rf.f[g.id]); gew[g.id] = { punkte: p, quelle: 'angenommen' }; summe += p; });
    var p = Math.min(20, Math.round(summe));
    var satz;
    if (rf.jung) {
      satz = 'Modernisierung: 0 Punkte angesetzt — das Gebäude ist jünger als ' + ALTER_MIN
        + ' Jahre, die Bauteile entsprechen dem Baujahr (Anlage 2 ImmoWertV rechnet hier ohnehin linear).';
    } else if (rf.energie && rf.energie !== 'mittel') {
      satz = 'Modernisierung angenommen: ' + grad(p) + ' (' + p + ' Punkte), keine Angaben je Gewerk; '
        + 'Dach, Fenster, Heizung und Außenwand abgestuft nach der Energieklasse ' + rf.klasse
        + (rf.energie === 'gut' ? ' (für das Baujahr ein Hinweis auf energetische Modernisierung).' : ' (für das Baujahr ein Hinweis auf wenig energetische Modernisierung).');
    } else {
      satz = 'Modernisierung angenommen: mittlerer Modernisierungsgrad (' + p + ' Punkte), da keine Angaben vorliegen'
        + (rf.alter == null ? '' : ' (Gebäude ' + rf.alter + ' Jahre alt)') + '.';
    }
    return { punkte: p, herkunft: rf.jung ? 'jung' : (rf.energie && rf.energie !== 'mittel' ? 'rueckfall_energie' : 'rueckfall_mittel'),
             stufe: 3, angenommen: !rf.jung, grad: grad(p), gewerke: gew, satz: satz };
  }

  /* ── Textableitung (ohne KI, deterministisch) ───────────────────────── */
  var MUSTER = {
    dach:        /(\bdach(?!geschoss|fenster|terrass|boden|rinne)\w*|dächer|oberste[n]? geschossdecke|dachgeschossdecke)/i,
    fenster:     /(fenster(?!bank)|verglas|außentür|aussentuer|haustür|haustuer|eingangstür)/i,
    leitungen:   /(elektr|leitung|strang|stränge|steigleitung|abwasser|wasserinstallation|hausanschl)/i,
    heizung:     /(heizung|brennwert|wärmepumpe|waermepumpe|heizkessel|kessel|therme|pellet)/i,
    aussenwand:  /(wdvs|wärmedämmverbund|waermedaemmverbund|vollwärmeschutz|vollwaermeschutz|fassad|außenwand|aussenwand|außendämmung|aussendaemmung)/i,
    baeder:      /(\bbad\b|\bbäder|\bbaeder|badezimmer|duschbad|sanitär|sanitaer|gäste-?wc)/i,
    innenausbau: /(fußböden|fussboeden|\bböden\b|bodenbeläge|bodenbelaege|treppenhaus|treppenhäuser|innenausbau|innentüren|laminat|parkett|vinylboden)/i,
    grundriss:   /(grundriss|zusammengelegt|zusammenlegung|neu aufgeteilt)/i
  };
  var POSITIV = /(erneuert|\bneu(e|er|es|en|em)?\b|saniert|modernisiert|ausgetauscht|getauscht|gedämmt|gedaemmt|renoviert|eingebaut|installiert|verbessert|optimiert|aufgebracht|instand gesetzt|zweifach|dreifach|2-fach|3-fach|isolierverglas|wärmeschutzverglas|kunststofffenster|brennwert|wärmepumpe|waermepumpe|wdvs|vollwärmeschutz|wärmedämmverbund|waermedaemmverbund|zeitgemäß|zeitgemaess|modern\b|moderne[nrs]?\b)/i;
  var NEGATIV = /(\bmuss|\bmüss|muess|sollte|bedürftig|beduerftig|erforderlich|notwendig|anstehend|steht an|stehen an|geplant|nicht\s+(erneuert|saniert|modernisiert|gedämmt|gedaemmt)|veraltet|\balte[nrs]?\s|ursprünglich|urspruenglich|bauzeitlich|einfachverglas|nachtspeicher|ofenheizung|einzelöfen|sanierungsstau|instandhaltungsstau|renovierungsstau|handlungsbedarf)/i;
  var ALLGEMEIN_ALLE = /(kernsaniert|kernsanierung|vollsaniert|vollständig saniert|vollstaendig saniert|komplett saniert|komplett modernisiert|umfassend (saniert|modernisiert)|grundlegend saniert|grundsaniert)/i;
  var ALLGEMEIN_WHG = /(wohnungen\s+(wurden\s+|sind\s+)?(\w+\s+){0,5}(modernisiert|saniert|renoviert)|(modernisierte|sanierte|renovierte)\s+wohnungen|wohnungsmodernisierung)/i;
  var NUR_PFLEGE = /(gepflegt|solide[nr]? (substanz|bauweise)|gute[rn]? zustand|guter allgemeinzustand|ordentliche[rn]? zustand)/i;
  var JAHR_RE = /(^|[^\d])((19[5-9]\d)|(20[0-4]\d))(?!\d)/g;
  var BAUJAHR_VOR = /(baujahr|bj\.?|errichtet|erbaut|gebaut|bauzeit)\s*(ca\.?|um|im jahr)?\s*$/i;

  function saetze(text) {
    return String(text || '').replace(/\r/g, '')
      .split(/(?<=[.!?;•])\s+|\n+|\s[-–]\s/)
      .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return s.length >= 4; });
  }
  function jahrIn(satz, stichtagJahr) {
    var s = zahl(stichtagJahr) || new Date().getFullYear(), best = null, m;
    JAHR_RE.lastIndex = 0;
    while ((m = JAHR_RE.exec(satz))) {
      var j = Number(m[2]);
      var vorher = satz.slice(Math.max(0, m.index - 18), m.index + m[1].length);
      if (BAUJAHR_VOR.test(vorher)) continue;
      if (j <= s && (best == null || j > best)) best = j;
    }
    return best;
  }
  function umfangIn(satz) {
    if (/(teilweise|\bteils\b|tlw\.?|einige|einzelne|mehrere|zum teil|partiell)/i.test(satz)) return 'teilweise';
    if (/(überwiegend|ueberwiegend|größtenteils|groesstenteils|weitgehend)/i.test(satz)) return 'ueberwiegend';
    return 'vollstaendig';
  }

  /**
   * Belegstellen je Gewerk aus einem Exposé-/Beschreibungstext.
   * @returns {Array<{gewerk, art:'konkret'|'allgemein', richtung:'positiv'|'negativ', umfang, jahr, zitat}>}
   */
  function ausText(text, opt) {
    var sj = opt && opt.stichtag_jahr, aus = [];
    saetze(text).forEach(function (satz) {
      var zitat = satz.length > 220 ? satz.slice(0, 217) + '…' : satz;
      var neg = NEGATIV.test(satz), pos = POSITIV.test(satz);
      var treffer = 0;
      GEWERKE.forEach(function (g) {
        if (!MUSTER[g.id].test(satz)) return;
        if (!neg && !pos) return;
        treffer++;
        aus.push({ gewerk: g.id, art: 'konkret', richtung: neg ? 'negativ' : 'positiv', umfang: umfangIn(satz),
                   jahr: neg ? null : jahrIn(satz, sj), kuerzlich: KUERZLICH.test(satz), zitat: zitat });
      });
      if (!treffer && !neg) {
        var ids = ALLGEMEIN_ALLE.test(satz) ? GEWERKE.map(function (g) { return g.id; })
          : (ALLGEMEIN_WHG.test(satz) ? ['baeder', 'innenausbau'] : null);
        if (ids) ids.forEach(function (id) {
          aus.push({ gewerk: id, art: 'allgemein', richtung: 'positiv',
                     umfang: /(alle|sämtliche|saemtliche|kern|komplett|vollständig|vollstaendig|umfassend|grund)/i.test(satz) ? umfangIn(satz) : (umfangIn(satz) === 'vollstaendig' ? 'teilweise' : umfangIn(satz)),
                     jahr: jahrIn(satz, sj), kuerzlich: KUERZLICH.test(satz), zitat: zitat });
        });
      }
    });
    return aus;
  }

  /* KI-Antwort (Exposé) normalisieren: nur bekannte Gewerke, nur mit Zitat */
  function normListe(liste, quelleText) {
    if (!Array.isArray(liste)) return [];
    var hay = quelleText ? String(quelleText).replace(/\s+/g, ' ').toLowerCase() : null;
    return liste.map(function (x) {
      if (!x || typeof x !== 'object') return null;
      var id = String(x.gewerk || '').toLowerCase().trim(); id = ALIAS[id] || id;
      if (!MAX[id]) return null;
      var zitat = String(x.zitat || x.beleg || '').replace(/\s+/g, ' ').trim();
      if (zitat.length < 4) return null;
      /* Beleg muss im Text stehen — ein Zitat, das es nicht gibt, ist keine Belegstelle */
      if (hay && hay.indexOf(zitat.toLowerCase().slice(0, 40)) < 0) return null;
      var richtung = /neg|veraltet|bedarf|beduerf|bedürf/i.test(String(x.richtung || x.zustand || '')) ? 'negativ' : 'positiv';
      return { gewerk: id, art: x.art === 'allgemein' ? 'allgemein' : 'konkret', richtung: richtung,
               umfang: umfangIn(String(x.umfang || '')), jahr: zahl(x.jahr), kuerzlich: KUERZLICH.test(zitat), zitat: zitat.slice(0, 220) };
    }).filter(Boolean);
  }

  /* Bildauswertung normalisieren: { gewerk: { stufe, sicherheit, beschreibung } } */
  function normFotos(f) {
    var aus = {};
    if (!f || typeof f !== 'object') return aus;
    var g = f.gewerke || f;
    Object.keys(g || {}).forEach(function (k) {
      var id = ALIAS[k] || k, x = g[k];
      if (!MAX[id] || !x || typeof x !== 'object') return;
      var st = String(x.stufe || '').toLowerCase();
      st = /neu/.test(st) ? 'neuwertig' : (/zeitgem|gepfleg|mittel/.test(st) ? 'zeitgemaess' : (/veralt|alt|schlecht|sanier/.test(st) ? 'veraltet' : null));
      if (!st) return;
      if (/niedrig|gering|unsicher/i.test(String(x.sicherheit || ''))) return;
      aus[id] = { stufe: st, beschreibung: String(x.beschreibung || '').trim().slice(0, 200) };
    });
    return aus;
  }

  /* Energieklasse plausibilisiert: nennt der Text eine energetische Massnahme ohne Jahr und
     ist die Klasse fuer ein Baujahr vor 1995 A+ bis C, hat sie offenbar gewirkt — 70 % statt 50 %. */
  function punkteText(t, sj, rf) {
    if (t.richtung === 'negativ') return { punkte: 0, wie: 'nicht modernisiert laut Text' };
    var jf = jahrFaktor(t.jahr, sj, t.kuerzlich), uf = umfangFaktor(t.umfang);
    var gw = null; GEWERKE.forEach(function (g) { if (g.id === t.gewerk) gw = g; });
    if (jf.f === F_OHNE_JAHR && rf && rf.energie === 'gut' && gw && gw.energie) jf = { f: 0.7, text: 'Zeitpunkt unbekannt, Energieklasse ' + rf.klasse + ' bestätigt die Wirkung' };
    return { punkte: r1(MAX[t.gewerk] * jf.f * uf), wie: (t.jahr ? 'Jahr ' + t.jahr + ', ' + jf.text : jf.text)
      + (uf < 1 ? (uf === 0.5 ? ', teilweise' : ', überwiegend') : '') };
  }

  /**
   * Kombiniert Text- und Bildbefunde JE GEWERK (Marcel: „was Mehrwert gibt").
   * @param {object} o  { text:[ausText/normListe], fotos:{normFotos}, baujahr, stichtag_jahr, energieklasse }
   * @returns {null | {punkte, gewerke:{id:{punkte, quelle, beleg, wie, widerspruch?}}, quellen:[], widersprueche:[], satz, kurz}}
   */
  function kombinieren(o) {
    o = o || {};
    var sj = zahl(o.stichtag_jahr) || new Date().getFullYear();
    var text = Array.isArray(o.text) ? o.text : [], fotos = o.fotos || {};
    var rf = rueckfallFaktoren(o);
    var gew = {}, summe = 0, belegt = 0, quellen = {}, wid = [];
    GEWERKE.forEach(function (g) {
      var konkret = text.filter(function (t) { return t.gewerk === g.id && t.art === 'konkret'; });
      var allg = text.filter(function (t) { return t.gewerk === g.id && t.art === 'allgemein'; });
      var foto = fotos[g.id] || null;
      var e = null;
      if (konkret.length) {
        /* die beste konkrete Aussage: negativ schlaegt nicht positiv, sondern ist eigener Befund;
           bei mehreren positiven zaehlt die mit den meisten Punkten */
        var best = null;
        konkret.forEach(function (t) { var p = punkteText(t, sj, rf); if (!best || p.punkte > best.p.punkte) best = { t: t, p: p }; });
        e = { punkte: best.p.punkte, quelle: 'text', beleg: '„' + best.t.zitat + '"', wie: best.p.wie };
        if (foto) {
          var fp = r1(g.max * F_FOTO[foto.stufe]);
          if ((best.t.richtung === 'positiv' && foto.stufe === 'veraltet') || (best.t.richtung === 'negativ' && foto.stufe === 'neuwertig')) {
            e.widerspruch = 'Bild: ' + (foto.beschreibung || foto.stufe) + ' — die konkrete Textaussage gilt.';
            wid.push(g.text + ': Text und Bild widersprechen sich, die konkrete Textaussage gilt.');
          } else if (fp > e.punkte && best.t.richtung === 'positiv' && !best.t.jahr) {
            e.bild = foto.beschreibung || null;
          }
        }
      } else if (foto) {
        e = { punkte: r1(g.max * F_FOTO[foto.stufe]), quelle: 'bild', beleg: foto.beschreibung || ('Bild: ' + foto.stufe),
              wie: foto.stufe === 'neuwertig' ? 'auf den Bildern neuwertig' : (foto.stufe === 'zeitgemaess' ? 'auf den Bildern zeitgemäß, nicht neu' : 'auf den Bildern veraltet') };
        if (allg.length) e.wie += ' (präzisiert den Textsatz „' + allg[0].zitat.slice(0, 60) + '…")';
      } else if (allg.length) {
        var pa = punkteText(allg[0], sj, rf);
        e = { punkte: pa.punkte, quelle: 'text', beleg: '„' + allg[0].zitat + '"', wie: 'allgemeine Aussage, ' + pa.wie };
      }
      /* Eine POSITIVE Aussage senkt nie unter die Annahme ohne Angabe („einige Wohnungen
         modernisiert" ohne Jahr gaebe sonst weniger als gar nichts) — eine negative darf es. */
      var annahme = r1(g.max * rf.f[g.id]);
      if (e && e.punkte < annahme && !/nicht modernisiert|veraltet/.test(e.wie)) {
        e.punkte = annahme; e.wie += ' (mindestens die Annahme ohne Angabe)';
      }
      if (e) { belegt++; quellen[e.quelle] = 1; }
      else {
        e = { punkte: r1(g.max * rf.f[g.id]), quelle: 'angenommen',
              beleg: null, wie: rf.jung ? 'Gebäude jünger als ' + ALTER_MIN + ' Jahre' : (g.energie && rf.energie ? 'aus Energieklasse ' + rf.klasse : 'keine Aussage, mittel angenommen') };
      }
      if (e.quelle !== 'angenommen' && g.id === 'aussenwand' && rf.energie === 'schlecht' && e.punkte >= 2) {
        e.widerspruch = 'Energieklasse ' + rf.klasse + ' passt nicht zu einer gedämmten Außenwand.';
        wid.push('Außenwand: Energieklasse ' + rf.klasse + ' passt nicht zur Dämmung laut ' + (e.quelle === 'bild' ? 'Bild' : 'Text') + '.');
      }
      gew[g.id] = e; summe += e.punkte;
    });
    if (!belegt) return null;
    var p = Math.min(20, Math.round(summe));
    var q = Object.keys(quellen).filter(function (k) { return k !== 'angenommen'; });
    var kurz = q.length === 2 ? 'aus Exposé-Text und Bildern abgeleitet' : (q[0] === 'bild' ? 'aus Bildern abgeleitet' : 'aus dem Exposé-Text abgeleitet');
    return { punkte: p, gewerke: gew, belegt: belegt, quellen: q, widersprueche: wid, kurz: kurz, grad: grad(p),
             satz: 'Modernisierung ' + kurz + ': ' + grad(p) + ' (' + p + ' Punkte, ' + belegt + ' von 8 Gewerken belegt'
               + (belegt < 8 ? ', übrige angenommen' : '') + ').' };
  }

  /**
   * DIE RANGFOLGE. Gibt immer ein Ergebnis — nie ein stilles 0.
   * @param {object} e {
   *   mod_punkte, mod_punkte_herkunft ('eigene_angabe'|'gewerke'|'mfh'|…), mod_angaben (Zahl der acht Felder),
   *   zustand, zustand_quelle ('eigene'|'bilder'|'text'|null), ableitung ({punkte, gewerke, kurz, …} aus kombinieren()),
   *   baujahr, stichtag_jahr, energieklasse }
   */
  function bestimmen(e) {
    e = e || {};
    var mp = zahl(e.mod_punkte), her = String(e.mod_punkte_herkunft || '');
    var angaben = Number(e.mod_angaben) || 0;
    var EIGEN = 'Eigene Angaben je Gewerk sind genauer.';
    /* 1a · Punkte, die der Nutzer gesetzt oder aus seinen Gewerken gerechnet hat.
       Eine 0 zaehlt nur, wenn sie als Angabe gekennzeichnet ist oder Gewerke beantwortet sind —
       sonst ist sie die alte Vorbelegung (v2541) und keine Antwort. */
    var abgeleiteteHerkunft = /^(abgeleitet|rueckfall|jung|expose|bilder|text)/.test(her);
    if (mp != null && mp >= 0 && !abgeleiteteHerkunft && (mp > 0 || her === 'eigene_angabe' || her === 'gewerke' || her === 'mfh' || angaben > 0)) {
      var p1 = Math.min(20, Math.round(mp));
      return { punkte: p1, herkunft: 'eigene', stufe: 1, angenommen: false, grad: grad(p1),
               kurz: 'eigene Angabe', satz: 'Modernisierung: eigene Angabe, ' + grad(p1) + ' (' + p1 + ' Punkte).' };
    }
    var rf = rueckfallFaktoren(e);
    /* 1b · grober Zustand, vom Nutzer selbst gesetzt */
    var zq = String(e.zustand_quelle || 'eigene');
    var z = ZUSTAND[String(e.zustand || '').trim()];
    if (z && zq === 'eigene') {
      var pz = rf.jung ? 0 : z.punkte;
      return { punkte: pz, herkunft: 'zustand', stufe: 1, angenommen: true, grad: grad(pz), zustand: z.text,
               kurz: 'abgeschätzt aus Zustand „' + z.text + '"',
               satz: 'Modernisierung abgeschätzt aus Zustand „' + z.text + '": ' + grad(pz) + ' (' + pz + ' Punkte'
                 + (rf.jung ? ', Gebäude jünger als ' + ALTER_MIN + ' Jahre' : '') + '). ' + EIGEN };
    }
    /* 2 · abgeleitet aus Exposé-Text und Bildern */
    var ab = e.ableitung;
    if (ab && typeof ab === 'object' && zahl(ab.punkte) != null && ab.gewerke) {
      var pa = Math.min(20, Math.max(0, Math.round(zahl(ab.punkte))));
      return { punkte: pa, herkunft: 'abgeleitet', stufe: 2, angenommen: true, grad: grad(pa), gewerke: ab.gewerke,
               quellen: ab.quellen || [], widersprueche: ab.widersprueche || [], kurz: ab.kurz || 'abgeleitet',
               satz: (ab.satz || ('Modernisierung abgeleitet: ' + grad(pa) + ' (' + pa + ' Punkte).')) + ' ' + EIGEN };
    }
    /* 3 · Rueckfall */
    var r = rueckfall(e);
    r.kurz = r.herkunft === 'jung' ? '0 Punkte, Gebäude jünger als ' + ALTER_MIN + ' Jahre'
      : (r.herkunft === 'rueckfall_energie' ? 'angenommen (' + r.grad + ', nach Energieklasse)' : 'angenommen (mittel, keine Angaben)');
    if (r.angenommen) r.satz += ' ' + EIGEN;
    return r;
  }

  var api = {
    version: 'v3660',
    GEWERKE: GEWERKE, GRADE: GRADE, ZUSTAND: ZUSTAND, ALTER_MIN: ALTER_MIN,
    grad: grad, zustandAusPunkten: zustandAusPunkten, rueckfall: rueckfall,
    ausText: ausText, normListe: normListe, normFotos: normFotos,
    kombinieren: kombinieren, bestimmen: bestimmen
  };
  root.DpModernisierung = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
