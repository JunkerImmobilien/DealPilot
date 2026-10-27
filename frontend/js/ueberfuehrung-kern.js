/* ueberfuehrung-kern.js — v2984: Rechenkern Ueberfuehrung Privat -> Kapitalgesellschaft
 * und Steuer der Gesellschaft (KSt + Soli + GewSt, mit Verlustvortrag).
 *
 * window.DealPilotUeberfuehrungKern — reine Funktionen, kein DOM, kein
 * localStorage, keine Einstellungen. Alles, was gebraucht wird, kommt als
 * Parameter (CLAUDE.md: „Ein Kern liest NIE Einstellungen").
 *
 * EINE Stelle fuer die Steuer der Gesellschaft: Projektion (calc.js),
 * Steuer-Reiter (tax.js) und Jahresabschluss (gesellschaft-abschluss.js)
 * rufen steuerReihe() bzw. tracker(). Vorher drei Rechnungen, drei Zahlen
 * fuer dasselbe Jahr (Pruefbericht 27.10.2026, Befund 11).
 *
 * Rechtsgrundlagen (Belege in Dateien/gmbh-ueberfuehrung-umsetzung-20261027.md):
 *   § 23 Abs. 1 S. 1 Nr. 1, S. 5 Nr. 2, Abs. 3 S. 1, 2, 4, 5 EStG
 *   § 8 Abs. 1, Abs. 2 S. 1 Nr. 1/2 GrEStG; § 11 GrEStG i. V. m. Landesrecht
 *   § 8 Abs. 1, Abs. 3 S. 3 KStG i. V. m. § 6 Abs. 1 Nr. 5 EStG; R 8.9 Abs. 4 KStR
 *   § 7 Abs. 4, 5a; § 7b EStG; § 6 Abs. 1 Nr. 1a EStG
 *   § 23 Abs. 1 KStG, §§ 3, 4 SolZG; § 10d EStG (i. V. m. § 8 Abs. 1 KStG)
 *   § 9 Nr. 1 GewStG (S. 1 Fassung JStG 2024 ab EZ 2025), § 10a, § 11 Abs. 1 S. 3, Abs. 2 GewStG
 *   § 32d Abs. 2 Nr. 1 S. 1 Buchst. b EStG; § 5a Abs. 2 S. 2, Abs. 3 GmbHG
 */
(function (root) {
  'use strict';

  var ARTEN = {
    kauf:           { t: 'Kauf zum Verkehrswert', kurz: 'Kauf' },
    teilentgeltlich:{ t: 'Teilentgeltlicher Kauf (Preis unter Verkehrswert)', kurz: 'teilentgeltlich' },
    verdeckt:       { t: 'Verdeckte Einlage (ohne Gegenleistung)', kurz: 'verdeckte Einlage' },
    sacheinlage:    { t: 'Offene Sacheinlage gegen Gesellschaftsanteile', kurz: 'Sacheinlage' }
  };

  function _n(x) { var n = Number(x); return (x === null || x === undefined || x === '' || !isFinite(n)) ? null : n; }
  function _iso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null; }
  function _r2(x) { return Math.round(x * 100) / 100; }

  /* ── Art pruefen: UG darf keine Sacheinlage (§ 5a Abs. 2 S. 2 GmbHG) ── */
  function artZulaessig(art, rechtsform) {
    if (!ARTEN[art]) return { ok: false, grund: 'Unbekannte Art der Übertragung.' };
    if (art === 'sacheinlage' && rechtsform === 'ug') {
      return { ok: false, grund: 'Bei einer UG (haftungsbeschränkt) sind Sacheinlagen ausgeschlossen (§ 5a Abs. 2 Satz 2 GmbHG). Möglich sind Kauf oder verdeckte Einlage (Kapitalrücklage).' };
    }
    return { ok: true };
  }

  /* ── Stichtagsjahr: wem gehoert welcher Anteil? ─────────────────────────
     Einkuenfte stehen dem zu, auf den Nutzen und Lasten uebergegangen sind
     (§ 446 BGB). Die App rechnet monatsgenau (anteilig.js, (13 − Monat)/12
     fuer das erste Jahr der Gesellschaft). Damit kein Monat doppelt zaehlt,
     endet das Privatobjekt mit (Monat − 1)/12. Ein Stichtag mitten im Monat
     wird zum Monatsersten gerechnet (der Monat gehoert der Gesellschaft);
     tagesgenau steht nur als Auskunft daneben. */
  function stichtagAnteile(stichtag) {
    var s = _iso(stichtag);
    if (!s) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    var tageJahr = ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
    var tagImJahr = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);  /* Tage VOR dem Stichtag */
    return {
      jahr: y, monat: m, tag: d,
      privatMonate: m - 1,
      gesellschaftMonate: 13 - m,
      privatFaktor: (m - 1) / 12,
      gesellschaftFaktor: (13 - m) / 12,
      monatsErster: d === 1,
      privatTage: tagImJahr,
      privatFaktorTaggenau: tagImJahr / tageJahr
    };
  }

  /* ── Grunderwerbsteuer ───────────────────────────────────────────────────
     Kauf / teilentgeltlich: Gegenleistung (§ 8 Abs. 1, § 9 Abs. 1 Nr. 1
     GrEStG) — der vereinbarte Preis einschliesslich uebernommener Schulden.
     Verdeckte Einlage (keine Gegenleistung): Grundbesitzwert (§ 8 Abs. 2
     S. 1 Nr. 1). Sacheinlage (gesellschaftsvertragliche Grundlage):
     Grundbesitzwert (§ 8 Abs. 2 S. 1 Nr. 2). Den Grundbesitzwert stellt das
     Finanzamt fest (§§ 151, 157 ff. BewG); fehlt er, wird VORLAEUFIG mit dem
     Verkehrswert gerechnet und das gesagt. Keine Befreiung fuer
     Kapitalgesellschaften (§§ 5, 6 GrEStG gelten nur fuer Gesamthand). */
  function grest(p) {
    p = p || {};
    var art = p.art, satz = _n(p.satzPct), kp = _n(p.kaufpreis), vw = _n(p.verkehrswert), gbw = _n(p.grundbesitzwert);
    if (satz == null || satz < 0) return { ok: false, fehlt: ['GrESt-Satz'] };
    var basis = null, quelle = null, vorl = false, fehlt = [];
    if (art === 'kauf' || art === 'teilentgeltlich') {
      if (kp == null || !(kp > 0)) fehlt.push('Kaufpreis');
      else { basis = kp; quelle = 'gegenleistung'; }
    } else if (art === 'verdeckt' || art === 'sacheinlage') {
      if (gbw != null && gbw > 0) { basis = gbw; quelle = 'grundbesitzwert'; }
      else if (vw != null && vw > 0) { basis = vw; quelle = 'verkehrswert_vorlaeufig'; vorl = true; }
      else fehlt.push('Grundbesitzwert oder Verkehrswert');
    } else fehlt.push('Art der Übertragung');
    if (fehlt.length) return { ok: false, fehlt: fehlt };
    return { ok: true, basis: basis, quelle: quelle, vorlaeufig: vorl, satzPct: satz, betrag: _r2(basis * satz / 100) };
  }

  /* ── Wert, den die Gesellschaft ansetzt ─────────────────────────────────
     Kauf zum Verkehrswert: Anschaffungskosten = Preis. Preis unter VW:
     Preis + verdeckte Einlage (VW − Preis), angesetzt zum Teilwert
     (§ 8 Abs. 1 KStG i. V. m. § 6 Abs. 1 Nr. 5 EStG). Die Dreijahresgrenze
     (§ 6 Abs. 1 Nr. 5 S. 1 Buchst. a) greift NICHT, weil die verdeckte
     Einlage beim Gesellschafter als Veraeusserung gilt (§ 23 Abs. 1 S. 5
     Nr. 2 EStG; R 8.9 Abs. 4 KStR). Preis ueber VW: Mehrbetrag ist
     verdeckte Gewinnausschuettung (§ 8 Abs. 3 S. 2 KStG), AK = VW.
     Teilwert = Verkehrswert ist die Annahme dieser Rechnung. */
  function wertAnsatz(p) {
    var art = p.art, kp = _n(p.kaufpreis), vw = _n(p.verkehrswert);
    if (!(vw > 0)) return { ok: false, fehlt: ['Verkehrswert'] };
    var preis = (art === 'kauf' || art === 'teilentgeltlich') ? (kp > 0 ? kp : null) : 0;
    if (preis == null) return { ok: false, fehlt: ['Kaufpreis'] };
    var einlage = Math.max(0, vw - preis), vga = Math.max(0, preis - vw);
    return { ok: true, ansatz: vw, preis: preis, verdeckteEinlage: (art === 'sacheinlage') ? 0 : einlage,
             sacheinlage: (art === 'sacheinlage') ? vw : 0, vga: vga };
  }

  /* ── AfA-Satz der Gesellschaft: nur linear, § 7 Abs. 4 EStG ─────────────
     Degressive AfA (§ 7 Abs. 5a) und Sonder-AfA (§ 7b) setzen die
     Anschaffung bis zum Ende des Fertigstellungsjahres voraus — bei einer
     spaeteren Ueberfuehrung nie erfuellt. */
  function afaSatzGesellschaft(p) {
    var bj = _n(p.baujahr), wohnen = p.wohnzwecke !== false;
    if (!wohnen) return { satzPct: 3.0, grund: '§ 7 Abs. 4 S. 1 Nr. 1 EStG: Betriebsgebäude, nicht Wohnzwecken dienend', sicher: bj != null };
    if (bj == null) return { satzPct: 2.0, grund: 'Baujahr fehlt — 2 % angenommen (§ 7 Abs. 4 S. 1 Nr. 2 Buchst. b EStG), bitte ergänzen', sicher: false };
    if (bj < 1925) return { satzPct: 2.5, grund: '§ 7 Abs. 4 S. 1 Nr. 2 Buchst. c EStG: fertiggestellt vor 1925', sicher: true };
    if (bj >= 2023) return { satzPct: 3.0, grund: '§ 7 Abs. 4 S. 1 Nr. 2 Buchst. a EStG: fertiggestellt nach dem 31.12.2022', sicher: true };
    return { satzPct: 2.0, grund: '§ 7 Abs. 4 S. 1 Nr. 2 Buchst. b EStG: fertiggestellt 1925–2022', sicher: true };
  }

  /* ── Anschaffungskosten der Gesellschaft ────────────────────────────────
     Ansatz (VW) + GrESt + Notar/Grundbuch (§ 255 Abs. 1 HGB). Kein Makler.
     Aufteilung Boden/Gebaeude ZUM STICHTAG (neuer Bodenwert). */
  function akGesellschaft(p) {
    var w = wertAnsatz(p);
    if (!w.ok) return w;
    var g = grest(p);
    if (!g.ok) return { ok: false, fehlt: g.fehlt };
    var notarPct = _n(p.notarPct); if (notarPct == null) notarPct = 2.0;
    var notar = _r2(w.ansatz * notarPct / 100);
    var nk = g.betrag + notar;
    var ak = w.ansatz + nk;
    var boden = _n(p.bodenwert), gebAnt = null, bodenQuelle = null;
    if (boden != null && boden >= 0 && boden < w.ansatz) { gebAnt = (w.ansatz - boden) / w.ansatz; bodenQuelle = p.bodenQuelle || 'eingetragen'; }
    else if (_n(p.gebAntPct) != null) { gebAnt = _n(p.gebAntPct) / 100; bodenQuelle = 'uebernommen'; }
    var afa = afaSatzGesellschaft(p);
    var gebAK = (gebAnt != null) ? ak * gebAnt : null;
    return {
      ok: true, wert: w, grest: g, notarPct: notarPct, notar: notar, nebenkosten: nk, ak: ak,
      gebAntPct: gebAnt != null ? gebAnt * 100 : null, bodenQuelle: bodenQuelle,
      gebaeudeAK: gebAK, bodenAK: gebAK != null ? ak - gebAK : null,
      afaSatzPct: afa.satzPct, afaGrund: afa.grund, afaSicher: afa.sicher,
      afaJahr: gebAK != null ? gebAK * afa.satzPct / 100 : null,
      /* 15-%-Grenze § 6 Abs. 1 Nr. 1a beginnt neu: 3 Jahre ab Erwerb durch die Gesellschaft */
      grenze15: gebAK != null ? gebAK * 0.15 : null,
      grenze15Bis: p.stichtag ? _plusJahre(p.stichtag, 3) : null,
      grestSatzEffektivPct: w.ansatz > 0 ? g.betrag / w.ansatz * 100 : null
    };
  }

  function _plusJahre(iso, n) {
    var s = _iso(iso); if (!s) return null;
    return (+s.slice(0, 4) + n) + s.slice(4);
  }
  function _de(iso) { var s = _iso(iso); return s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : ''; }

  /* ── Zehnjahresfrist § 23 Abs. 1 S. 1 Nr. 1 EStG, taggenau ──────────── */
  function frist23(kaufdat, stichtag) {
    var a = _iso(kaufdat), b = _iso(stichtag);
    if (!a) return { art: 'unbekannt', grund: 'Kaufdatum des Privatobjekts fehlt' };
    if (!b) return { art: 'unbekannt', grund: 'Stichtag fehlt' };
    var ende = _plusJahre(a, 10);
    /* „nicht mehr als zehn Jahre": Veraeusserung NACH dem Fristende ist frei */
    if (b > ende) return { art: 'frei', fristEnde: ende, text: 'Frist endete am ' + _de(ende) };
    var tage = Math.round((Date.UTC(+ende.slice(0, 4), +ende.slice(5, 7) - 1, +ende.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86400000);
    return { art: 'steuerpflichtig', fristEnde: ende, restTage: tage, text: 'Frist endet am ' + _de(ende) };
  }

  /* ── AfA, die privat bis zum Stichtag abgezogen wurde (§ 23 Abs. 3 S. 4) ──
     serie: AfA je Kalenderjahr ab dem Kaufjahr (Index 0 = Kaufjahr, schon
     monatsanteilig wie in der App). Im Stichtagsjahr zaehlt der private Teil
     (Monate vor dem Stichtag / aktive Monate des Jahres). */
  function afaBisStichtag(p) {
    var serie = p.serie || [], kj = _iso(p.kaufdat), st = stichtagAnteile(p.stichtag);
    if (!kj || !st) return null;
    var ky = +kj.slice(0, 4), km = +kj.slice(5, 7), sum = 0;
    for (var y = ky; y <= st.jahr; y++) {
      var a = Number(serie[y - ky]) || 0;
      if (y < st.jahr) { sum += a; continue; }
      var aktiv = (y === ky) ? (13 - km) : 12;
      var priv = (y === ky) ? Math.max(0, st.monat - km) : st.privatMonate;
      if (aktiv > 0) sum += a * priv / aktiv;
    }
    return _r2(sum);
  }

  /* ── Privates Veraeusserungsgeschaeft § 23 EStG ─────────────────────────
     Veraeusserungspreis: Kauf -> Preis (hoechstens VW; ein Mehrpreis ist vGA
     und Kapitalertrag, § 20 Abs. 1 Nr. 1 S. 2). Teilentgeltlich, verdeckte
     Einlage -> gemeiner Wert (§ 23 Abs. 3 S. 2: entgeltlicher Teil +
     verdeckte Einlage = VW). Sacheinlage gegen Anteile -> tauschaehnlich,
     gemeiner Wert der Anteile = VW. Gewinn = Preis − (AK + NK − AfA) − WK.
     Freigrenze: steuerfrei, wenn der GESAMTgewinn des Jahres < 1.000 €
     (§ 23 Abs. 3 S. 5, ab VZ 2024). */
  function paragraph23(p) {
    var f = frist23(p.kaufdat, p.stichtag);
    var w = wertAnsatz(p);
    var out = { frist: f };
    if (f.art === 'frei') { out.steuerfrei = true; out.gewinn = null; out.steuer = 0; return out; }
    if (f.art === 'unbekannt') { out.fehlt = [f.grund]; return out; }
    if (!w.ok) { out.fehlt = w.fehlt; return out; }
    var akPriv = _n(p.akPrivat), afa = _n(p.afaBisher);
    if (akPriv == null) { out.fehlt = ['Anschaffungskosten privat']; return out; }
    if (afa == null) afa = 0;
    var preis = (p.art === 'kauf') ? Math.min(w.preis, w.ansatz) : w.ansatz;
    var fortg = akPriv - afa;
    var wk = _n(p.werbungskosten) || 0;
    var gewinn = preis - fortg - wk;
    var weitere = _n(p.weitereGewinne) || 0;
    var gesamt = gewinn + weitere;
    out.veraeusserungspreis = preis;
    out.preisQuelle = (p.art === 'kauf') ? 'Kaufpreis' : 'gemeiner Wert (§ 23 Abs. 3 S. 2 EStG)';
    out.akPrivat = akPriv; out.afaBisher = afa; out.fortgefuehrteAK = fortg; out.werbungskosten = wk;
    out.gewinn = _r2(gewinn); out.gesamtgewinnJahr = _r2(gesamt);
    out.freigrenze = 1000;
    out.unterFreigrenze = gesamt < 1000;
    out.steuerpflichtig = gewinn > 0 && !out.unterFreigrenze;
    out.vga = w.vga;
    return out;
  }

  /* Indikative Steuer auf den § 23-Gewinn: Differenz der Steuerlast mit und
     ohne Gewinn (steuerLast-Funktion als Parameter), sonst Grenzsatz + Soli. */
  function steuer23(gewinn, p) {
    p = p || {};
    if (!(gewinn > 0)) return { betrag: 0, methode: 'kein Gewinn' };
    if (typeof p.steuerLast === 'function' && _n(p.zve) != null && p.zve > 0) {
      var d = p.steuerLast(p.zve + gewinn) - p.steuerLast(p.zve);
      if (isFinite(d)) return { betrag: _r2(d), methode: 'Steuerlast mit/ohne Gewinn bei zvE ' + Math.round(p.zve) };
    }
    var g = _n(p.grenzPct);
    if (g == null || !(g > 0)) return { betrag: null, methode: 'kein Grenzsteuersatz hinterlegt' };
    var soli = p.mitSoli === false ? 0 : 0.055;
    return { betrag: _r2(gewinn * g / 100 * (1 + soli)), methode: 'Grenzsteuersatz ' + String(g).replace('.', ',') + ' %' + (soli ? ' + Soli' : '') };
  }

  /* ── Erweiterte Kuerzung § 9 Nr. 1 S. 2 GewStG ──────────────────────────
     Aktiv NUR, wenn beantragt (erw_kuerzung === true) UND alle Pruefpunkte
     bestaetigt. Ein nie gespeicherter Wert gilt als NICHT beantragt —
     ueberall gleich (Anzeige, Rechnung, PDF). */
  var PRUEFPUNKTE = [
    { k: 'nur_grundbesitz', t: 'Die Gesellschaft verwaltet und nutzt ausschließlich eigenen Grundbesitz (daneben höchstens eigenes Kapitalvermögen) — das ganze Jahr, kein gewerblicher Grundstückshandel.' },
    { k: 'keine_betriebsvorrichtung', t: 'Keine Mitvermietung von Betriebsvorrichtungen, keine hotelähnliche Kurzzeitvermietung; Möblierung allenfalls untergeordnet.' },
    { k: 'kein_gesellschafterbetrieb', t: 'Kein Grundbesitz dient dem Gewerbebetrieb eines Gesellschafters (§ 9 Nr. 1 S. 5 Nr. 1 GewStG).' },
    { k: 'bagatell', t: 'Strom aus PV/Ladesäulen höchstens 20 %, sonstige Leistungen an Mieter höchstens 5 % der Mieteinnahmen (§ 9 Nr. 1 S. 3 Buchst. b, c GewStG).' }
  ];
  function erwKuerzungStatus(reg) {
    reg = reg || {};
    var beantragt = reg.erw_kuerzung === true;
    var pr = reg.erw_pruefung || {};
    var offen = PRUEFPUNKTE.filter(function (x) { return pr[x.k] !== true; }).map(function (x) { return x.k; });
    return { beantragt: beantragt, aktiv: beantragt && offen.length === 0, offen: offen };
  }

  /* ── Steuer der Gesellschaft ueber eine Jahresreihe ─────────────────────
     reihe: [{ jahr, erg, grundsteuer? }] — erg = Ergebnis vor Steuern.
     p: { kstSoliPct (15,825), hebesatz (%), erwKuerzung (bool) }
     KSt: § 10d EStG — Sockel 1 Mio. voll, darueber 70 % (VZ 2024–2027)
     bzw. 60 %. GewSt: Kuerzung § 9 Nr. 1 S. 1 (ab EZ 2025: die als
     Betriebsausgabe erfasste Grundsteuer) bzw. erweiterte Kuerzung;
     Verlustvortrag § 10a (1 Mio. + 60 %); Abrundung auf volle 100 €
     (§ 11 Abs. 1 S. 3); Messzahl 3,5 % (§ 11 Abs. 2); kein Freibetrag
     fuer Kapitalgesellschaften. Steuern sind keine Betriebsausgabe. */
  function _mindest(erg, vortrag, quote) {
    var grenze = Math.min(erg, 1000000) + Math.max(0, erg - 1000000) * quote;
    return Math.min(vortrag, grenze);
  }
  function steuerReihe(reihe, p) {
    p = p || {};
    var kstSoli = (_n(p.kstSoliPct) != null ? p.kstSoliPct : 15.825) / 100;
    var heb = _n(p.hebesatz) || 0;
    var vK = _n(p.vortragKSt) || 0, vG = _n(p.vortragGewSt) || 0;
    return (reihe || []).map(function (r) {
      var jahr = Number(r.jahr) || 0, erg = Number(r.erg) || 0;
      /* KSt */
      var gK = 0, bemK = 0;
      if (erg < 0) vK += -erg;
      else if (erg > 0) { gK = _mindest(erg, vK, (jahr >= 2024 && jahr <= 2027) ? 0.70 : 0.60); vK -= gK; bemK = erg - gK; }
      var kst = bemK * kstSoli;
      /* GewSt */
      var kuerz = 0, ge = 0, gG = 0, bemG = 0, gewst = 0;
      if (p.erwKuerzung) { kuerz = Math.max(0, erg); ge = Math.min(0, erg); }
      else { kuerz = Math.max(0, Number(r.grundsteuer) || 0); ge = erg - kuerz; }
      if (ge < 0) vG += -ge;
      else if (ge > 0) { gG = _mindest(ge, vG, 0.60); vG -= gG; bemG = Math.floor((ge - gG) / 100) * 100; }
      gewst = bemG * 0.035 * heb / 100;
      return { jahr: jahr, erg: erg, genutzt: gK, bemessung: bemK, kst: kst,
               gewKuerzung: kuerz, gewerbeertrag: bemG, gewGenutzt: gG, gewst: gewst,
               steuer: kst + gewst, vortragNach: vK, vortragGewNach: vG };
    });
  }

  /* Fortlaufender Zaehler fuer Schleifen, die Jahr fuer Jahr rechnen
     (calc.js-Projektion). Faengt ein neuer Durchlauf an (Jahr kleiner als
     das letzte), beginnt er wieder ohne Vortrag; dasselbe Jahr ersetzt den
     letzten Eintrag. */
  function tracker(p) {
    var hist = [];
    return {
      steuer: function (erg, jahr, grundsteuer) {
        var last = hist.length ? hist[hist.length - 1].jahr : null;
        if (last !== null && jahr === last) hist.pop();          /* dasselbe Jahr neu gerechnet (calc.js V353) */
        else if (last !== null && jahr < last) hist = [];        /* neue Schleife */
        hist.push({ jahr: jahr, erg: erg, grundsteuer: grundsteuer });
        var r = steuerReihe(hist, p);
        return r[r.length - 1];
      },
      reset: function () { hist = []; }
    };
  }

  /* ── Ausschuettung (zweite Ebene) ────────────────────────────────────────
     UG: 25 % des um den Verlustvortrag geminderten Jahresueberschusses in
     die gesetzliche Ruecklage (§ 5a Abs. 3 GmbHG), bis das Stammkapital
     auf 25.000 € erhoeht ist. Abgeltungsteuer 25 % + Soli (§ 32d Abs. 1). */
  function ausschuettung(p) {
    var jue = _n(p.jahresueberschuss) || 0;
    if (!(jue > 0)) return { ausschuettbar: 0, ruecklage: 0, kapESt: 0, netto: 0 };
    var rl = (p.rechtsform === 'ug') ? jue * 0.25 : 0;
    var aus = jue - rl;
    var kap = aus * 0.26375;
    return { ausschuettbar: aus, ruecklage: rl, kapESt: kap, netto: aus - kap };
  }

  /* ── Gesellschafterdarlehen ─────────────────────────────────────────────
     Zins = Betriebsausgabe der Gesellschaft (fremdueblich; Mehrzins vGA).
     Beim Gesellschafter: ab 10 % Beteiligung Tarif statt Abgeltungsteuer
     (§ 32d Abs. 2 Nr. 1 S. 1 Buchst. b EStG). */
  function gesellschafterdarlehen(p) {
    var b = _n(p.betrag) || 0, z = _n(p.zinsPct) || 0, q = _n(p.beteiligungPct);
    var zins = b * z / 100;
    var tarif = (q == null) ? null : (q >= 10);
    return { zins: zins, tarif: tarif,
      regel: tarif === null ? 'Beteiligungsquote fehlt' : (tarif ? 'Tarif (§ 32d Abs. 2 Nr. 1 S. 1 Buchst. b EStG), Werbungskosten abziehbar' : 'Abgeltungsteuer 25 % + Soli') };
  }

  root.DealPilotUeberfuehrungKern = {
    version: 'v2984',
    ARTEN: ARTEN, PRUEFPUNKTE: PRUEFPUNKTE,
    artZulaessig: artZulaessig, stichtagAnteile: stichtagAnteile,
    grest: grest, wertAnsatz: wertAnsatz, afaSatzGesellschaft: afaSatzGesellschaft,
    akGesellschaft: akGesellschaft, frist23: frist23, afaBisStichtag: afaBisStichtag,
    paragraph23: paragraph23, steuer23: steuer23,
    erwKuerzungStatus: erwKuerzungStatus, steuerReihe: steuerReihe, tracker: tracker,
    ausschuettung: ausschuettung, gesellschafterdarlehen: gesellschafterdarlehen
  };
})(typeof window !== 'undefined' ? window : globalThis);
