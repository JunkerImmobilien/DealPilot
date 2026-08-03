// CrossCheckService.js — Sachwert- & Ertragswertverfahren als PLAUSIBILITÄTS-QUERCHECK
// zum Vergleichswert. Vereinfachte, transparente Umsetzung nach ImmoWertV-Logik
// (indikativ, KEIN Gutachten): alle Annahmen als Konstanten dokumentiert und im
// Output unter assumptions ausgewiesen. Reine Rechnung — keine API-Kosten.
import { round } from '../lib/stats.js';
/* WKERN-1 · Ertragswert wird nicht mehr hier gerechnet, sondern im gemeinsamen
 * Kern. Zwei Ertragswerte im selben Bericht waeren zwei Wahrheiten. */
import { ErtragswertService } from './ErtragswertService.js';
/* WNHK-4 */
import { sachwert as nhkSachwert, NHK_2010 } from '../lib/nhk2010.js';
import { restnutzungsdauer as anlage2Rnd } from '../lib/anlage2.js';   /* v1056-WRND-3 */
import { fuehrendesVerfahren, angepassterZins } from '../lib/verfahrenswahl.js';   /* v1061-WVER-1 */
/* v1069-WSWF-1 · Sachwertfaktoren nach § 21 Abs. 3 ImmoWertV. */
/* v1073-WGAA-1 · Nicht mehr ein Modul, sondern der Aufloeser. Er
 * entscheidet nach dem Gemeindeschluessel, welcher Ausschuss zustaendig
 * ist, und gibt immer dieselbe Form zurueck. Kein Treffer heisst KEIN
 * WERT — nie ein Nachbarkreis, nie ein Landesmittel. */
import { sachwertfaktor as swfNachTabelle } from '../lib/gutachterausschuss.js';

// ---- Annahmen (dokumentiert, anpassbar) ----
const NHK_EFH_BGF = 835;          // NHK 2010, EFH Standardstufe 3, €/m² BGF
const BAUPREISINDEX = 2.02;       // Baupreisindex Wohngebäude 2010 -> 2026 (Destatis, gerundet)
const BGF_FAKTOR = 1.35;          // BGF ≈ Wohnfläche × 1,35 (EFH-Faustwert)
const GND_JAHRE = 80;             // Gesamtnutzungsdauer Wohngebäude
const RND_MIN = 10;               // Mindest-Restnutzungsdauer
const SACHWERTFAKTOR = 1.0;       // Marktanpassung (ohne lokale GAA-Daten neutral = 1,0)
const BWK_QUOTE = 0.23;           // Bewirtschaftungskosten inkl. Mietausfallwagnis, % v. Rohertrag
const LIEGENSCHAFTSZINS = 0.03;   // EFH-typisch 2,5–3,5 % -> 3,0 %
/* v955-etw: Der Zinssatz ist EFH-begruendet. Fuer Eigentumswohnungen liegen
 * Liegenschaftszinsen typischerweise HOEHER (3,5-5 %) — ein zu niedriger Zins
 * rechnet den Ertragswert nach OBEN. Der Hinweis steht im Output, damit niemand
 * die Zahl fuer eine Aussage haelt, die sie nicht ist. */

const _num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

export const CrossCheckService = {
  // ref: Objektdaten; landValue: BORIS ({available, value_sqm}); rent: GeoMap-Mietstats;
  // valuation: Ergebnis des Vergleichswertverfahrens (fuer die Gegenueberstellung)
  compute(ref, landValue, rent, valuation, params) {   /* WKERN-3: params optional */
    /* v1047-WTDZ-1 · `p` stand bis hierher erst weit unten (Z. 174), wurde
     * aber schon in der NHK-Rechnung (Z. 103) gelesen. Temporale Todeszone.
     * Sie hat nie gefeuert, weil der Block hinter !istWohnung lag und alle
     * Berichte Eigentumswohnungen waren. Bei einem Einfamilienhaus waere
     * sie sofort abgestuerzt — der Sachwert fuer Haeuser war latent kaputt,
     * seit `params` eingefuehrt wurde. Deklaration gehoert an den Anfang. */
    const p = params || {};
    const out = {
      available: false,
      sachwert: { available: false },
      ertragswert: { available: false },
      comparison: null,
      assumptions: {
        /* WSACH-2 · Die Fussnote nannte hart "Liegenschaftszins 3 %", auch wenn
         * tatsaechlich 4 % gerechnet wurden. Eine Annahme, die etwas anderes
         * behauptet als die Rechnung, ist schlimmer als keine. */
        nhk_efh_bgf_eur: NHK_EFH_BGF, baupreisindex_2010_heute: BAUPREISINDEX,
        bgf_faktor: BGF_FAKTOR, gnd_jahre: GND_JAHRE, sachwertfaktor: SACHWERTFAKTOR,
        liegenschaftszins_pct_effektiv: (params && params.lzs_pct != null)
          ? Number(params.lzs_pct) : LIEGENSCHAFTSZINS * 100,
        liegenschaftszins_stufe: (params && params.lzs_stufe) || null,
        bwk_quote: BWK_QUOTE, liegenschaftszins: LIEGENSCHAFTSZINS,
      },
      notes: ['Vereinfachtes Sachwert-/Ertragswertverfahren nach ImmoWertV-Logik als Plausibilitäts-Quercheck. Indikativ, kein Gutachten n. § 194 BauGB.'],
    };

    /* v955-etw: Die Objektart kam in dieser Datei bisher NICHT vor (grep = 0).
     * Gerechnet wurde alles als EFH — auch jede Eigentumswohnung. */
    const _pt = String(ref.property_type || '').toLowerCase().trim();
    const istWohnung = /etw|wohnung|whg|apartment|appartement/.test(_pt);
    const istHaus = /efh|dhh|\brh\b|reihen|zfh|mfh|haus|villa/.test(_pt);
    const wfl = _num(ref.living_area);
    const buildYear = _num(ref.build_year);
    const plot = _num(ref.plot_area);
    const brw = landValue && landValue.available ? _num(landValue.value_sqm) : null;
    const bodenwert = plot && brw ? Math.round(plot * brw) : null;
    const nowYear = new Date().getFullYear();

    // ---- Restnutzungsdauer (vereinfacht modifiziert) ----
    // Basis: GND - Alter. Modernisierung verlängert (teilmodernisiert +10 J., kern-/umfassend +20 J.),
    // gedeckelt auf GND-10; Minimum RND_MIN.
    let rnd = null;
    if (buildYear) {
      const alter = Math.max(0, nowYear - buildYear);
      rnd = GND_JAHRE - alter;
      const mod = String(ref.modernization || '').toLowerCase();
      const modYear = _num(ref.modernization_year);
      let bonus = 0;
      if (mod.includes('kern') || mod.includes('umfassend')) bonus = 20;
      else if (mod.includes('teil') || (modYear && nowYear - modYear <= 35)) bonus = 10;
      rnd = Math.min(GND_JAHRE - 10, Math.max(rnd + bonus, RND_MIN));
    }

    // ================= SACHWERT =================
    /* v955-etw
     * ────────────────────────────────────────────────────────────────────────
     * Bei einer Eigentumswohnung wird der Sachwert NICHT gerechnet, sondern
     * weggelassen. Die Konstanten oben sagen selbst, wofuer sie gelten:
     *     NHK_EFH_BGF = 835     "EFH Standardstufe 3"
     *     BGF_FAKTOR  = 1.35    "EFH-Faustwert"
     * Eine ETW hat keinen eigenen Dachstuhl und kein eigenes Fundament; ihr
     * Anteil an Treppenhaus und Keller steckt anders in der Flaeche. Mit der
     * EFH-Tabelle kaeme eine Zahl heraus, die aussieht wie eine zweite Meinung
     * und doch nur dieselbe Flaeche mit der falschen Tabelle ist.
     *
     * Ein falsch gerechneter Quercheck ist schlechter als keiner: er beruhigt.
     * Der Ertragswert bleibt — der rechnet aus Rohertrag und Liegenschaftszins
     * und gilt fuer eine ETW genauso.
     */
    /* WSACH-1 · Ohne Objekttyp wurde der Sachwert mit der EFH-Tabelle gerechnet
     * — im Test kam fuer eine Eigentumswohnung ein Sachwert von 100.000 EUR und
     * ein Verfahrens-Spread von 192 % heraus. Ein falsch gerechneter Quercheck
     * ist schlechter als keiner, das steht schon im Kommentar unten. */
    let _nhkFertig = false;
    /* WNHK-5 · Sobald die NHK-Tabelle steht, rechnet der richtige Sachwert.
     * Bis dahin bleibt der bisherige vereinfachte Weg fuer Haeuser. */
    /* v1047-WSWE-1 · Wohnungen zugelassen, sobald eine BGF vorliegt.
     * Ohne BGF bleibt es gesperrt: die Naeherung aus der Wohnflaeche ist
     * bei einem Mehrfamilienhaus unbrauchbar (Treppenhaus, Keller,
     * Gemeinschaftsflaechen), und ein zu genau aussehender falscher Wert
     * ist schlimmer als keiner. */
    /* v1056-WRND-2 · Anlage 2, wenn Punkte vorliegen — sonst die
     * bisherige Schaetzung. Dieselbe Quelle wie beim Ertragswert. */
    const _rndEinheitlich = () => {
      const _mp = _num(ref.mod_punkte);
      if (_mp == null) return rnd;
      const _kern = /kernsaniert/i.test(String(ref.modernization || '')) && _mp >= 18;
      const _bj = _kern && _num(ref.modernization_year) > 1500
        ? _num(ref.modernization_year) : _num(ref.build_year);
      if (!(_bj > 1500)) return rnd;
      const _a2 = anlage2Rnd({ gnd: GND_JAHRE, alter: Math.max(0, (new Date().getFullYear()) - _bj),
                               punkte: _mp, kernsaniert: _kern });
      return _a2 && _a2.rnd != null ? _a2.rnd : rnd;
    };
    const _bgfWhg = Number((p && p.bgf_direkt) || ref.bgf || 0);
    const _nhkTypWhg = (u) => (u > 20 ? '4.3' : (u > 6 ? '4.2' : '4.1'));
    if (NHK_2010.geprueft && ref.property_type && (!istWohnung || _bgfWhg > 0)) {
      const _sw = nhkSachwert({
        nhk_typ: (p && p.nhk_typ) || ref.nhk_typ
          || (istWohnung ? _nhkTypWhg(Number(ref.units || 0)) : null), keller_dg: (p && p.keller_dg) || ref.keller_dg,
        standardstufe: (p && p.standardstufe) || ref.standardstufe,
        bgf_direkt: (p && p.bgf_direkt) || ref.bgf, wohnflaeche_qm: wfl, objektart: ref.property_type,
        baupreisindex: BAUPREISINDEX, regionalfaktor: (p && p.regionalfaktor) || null,
        /* v1056-WRND-1 · Bisher bekam der Sachwert die alte Schaetzung,
         * waehrend der Ertragswert seit v1052 nach Anlage 2 rechnet: 38
         * gegen 49,6 Jahre fuer dasselbe Gebaeude. Zwei Alterswerte fuer
         * ein Haus sind in keinem Verfahren zu rechtfertigen; der Sachwert
         * lag dadurch rund 50.000 EUR zu niedrig. Liegen
         * Modernisierungspunkte vor, gilt Anlage 2 fuer BEIDE. */
        gnd_jahre: GND_JAHRE, rnd_jahre: _rndEinheitlich(),
        bes_bauteile: (p && p.bes_bauteile) || null, aussenanlagen: (p && p.aussenanlagen) || null,
        /* v1074-WAUS9-5 · Kette. */
        ausstattung: (p && p.ausstattung) || ref.ausstattung || null,
        bauteile_hk: (p && p.bauteile_hk) || ref.bauteile_hk || null,
        bauteile_detail: (p && p.bauteile_detail) || ref.bauteile_detail || null,
        /* v1072-WGAR-5 · Die Kette von A nach B — ohne diese vier Zeilen
         * waere der ganze Garagen- und Aussenanlagenblock wirkungslos. */
        aussenanlagen_pct: (p && p.aussenanlagen_pct) || ref.aussenanlagen_pct || null,
        garagen_bgf_qm: (p && p.garagen_bgf_qm) || ref.garagen_bgf_qm || null,
        garagen_stufe: (p && p.garagen_stufe) || ref.garagen_stufe || null,
      }, (p && p.bodenwert) || null, (p && p.sachwertfaktor_param) || null);

      /* v1069-WSWF-2 · Der Sachwertfaktor haengt vom vorlaeufigen Sachwert
       * ab — er laesst sich nicht vorab aus einer Tabelle holen. Deshalb
       * zwei Laeufe: der erste liefert den vorlaeufigen Sachwert und die
       * Restnutzungsdauer, damit wird der Faktor nachgeschlagen, der zweite
       * rechnet mit ihm.
       *
       * Ein gepflegter Wert aus der Parametertabelle hat Vorrang: die
       * Tabelle ist kuratiert, die Matrix gilt fuer genau einen Kreis. */
      let _swfTab = null;
      if (!(p && p.sachwertfaktor_param && p.sachwertfaktor_param.sachwertfaktor)
          && _sw && _sw.vorlaeufiger_sachwert_eur != null) {
        _swfTab = swfNachTabelle({
          ags: (p && p.ags) || ref.ags || null,
          sachwert_eur: _sw.vorlaeufiger_sachwert_eur,
          rnd_jahre: _sw.restnutzungsdauer_jahre,
          objektart: ref.property_type,
          /* v1073-WGAA-2 · Herford braucht zwei weitere Groessen: die
           * Lagequalitaet ueber den Bodenrichtwert und die
           * Bruttogrundflaeche. Minden-Luebbecke ignoriert beide — der
           * Aufloeser reicht durch, das Modul nimmt sich, was es kennt.
           * Ohne diese zwei Zeilen bliebe der Herforder Faktor fuer immer
           * bei 'brw_fehlt'. */
          brw_eur_qm: (p && p.bodenwert && p.bodenwert.quelle && p.bodenwert.quelle.brw_sqm)
            || (p && p.brw_sqm) || ref.brw_sqm || null,
          bgf_qm: (p && p.bgf_direkt) || ref.bgf || null,
        });
        if (_swfTab && _swfTab.verfuegbar) {
          const _sw2 = nhkSachwert({
            nhk_typ: (p && p.nhk_typ) || ref.nhk_typ
              || (istWohnung ? _nhkTypWhg(Number(ref.units || 0)) : null),
            keller_dg: (p && p.keller_dg) || ref.keller_dg,
            standardstufe: (p && p.standardstufe) || ref.standardstufe,
            bgf_direkt: (p && p.bgf_direkt) || ref.bgf, wohnflaeche_qm: wfl,
            objektart: ref.property_type, baupreisindex: BAUPREISINDEX,
            regionalfaktor: (p && p.regionalfaktor) || null,
            gnd_jahre: GND_JAHRE, rnd_jahre: _rndEinheitlich(),
            bes_bauteile: (p && p.bes_bauteile) || null,
            aussenanlagen: (p && p.aussenanlagen) || null,
            /* v1074-WFIX-1 · Der zweite Lauf (mit amtlichem Sachwertfaktor)
             * kannte die v1072er-Felder nicht. Mit Garage oder Aussenanlagen-
             * Prozent wich sein vorlaeufiger Sachwert vom ersten Lauf ab, und
             * die Uebernahme-Bedingung verwarf den amtlichen Faktor still. */
            aussenanlagen_pct: (p && p.aussenanlagen_pct) || ref.aussenanlagen_pct || null,
            garagen_bgf_qm: (p && p.garagen_bgf_qm) || ref.garagen_bgf_qm || null,
            garagen_stufe: (p && p.garagen_stufe) || ref.garagen_stufe || null,
            /* v1074-WAUS9-9 · Kette, zweiter Lauf. */
            ausstattung: (p && p.ausstattung) || ref.ausstattung || null,
            bauteile_hk: (p && p.bauteile_hk) || ref.bauteile_hk || null,
            bauteile_detail: (p && p.bauteile_detail) || ref.bauteile_detail || null,
          }, (p && p.bodenwert) || null, {
            sachwertfaktor: _swfTab.wert, stufe: _swfTab.stufe,
            quelle: _swfTab.quelle_text,
          });
          /* Nur uebernehmen, wenn der zweite Lauf denselben vorlaeufigen
           * Sachwert liefert — sonst haette sich zwischen den Laeufen etwas
           * geaendert, und das waere ein Fehler, kein Ergebnis. */
          if (_sw2 && _sw2.wert != null
              && _sw2.vorlaeufiger_sachwert_eur === _sw.vorlaeufiger_sachwert_eur) {
            _sw = _sw2;
          } else {
            _swfTab = { verfuegbar: false, grund: 'zweiter_lauf_abweichend' };
          }
        }
      }

      if (_sw.wert != null) {
        out.sachwert = {
          available: true, value_eur: _sw.wert, staffel: _sw.staffel,
          marktangepasst: _sw.marktangepasst, sachwertfaktor: _sw.sachwertfaktor || null,
          /* v1069-WSWF-3 · Bleibt der Sachwert vorlaeufig, soll dastehen
           * WARUM. "ohne Sachwertfaktor" ist keine Begruendung, sondern eine
           * Feststellung — der Grund unterscheidet, ob der Ausschuss keinen
           * abgeleitet hat, ob das Objekt aus der Spanne faellt oder ob es
           * gar nicht sein Zustaendigkeitsbereich ist. */
          sachwertfaktor_grund: (_swfTab && !_swfTab.verfuegbar) ? _swfTab.grund : null,
          sachwertfaktor_hinweis: (_swfTab && !_swfTab.verfuegbar) ? (_swfTab.hinweis || null)
            : (_swfTab && _swfTab.verfuegbar ? _swfTab.hinweis : null),
          sachwertfaktor_stuetzstellen: (_swfTab && _swfTab.verfuegbar)
            ? _swfTab.stuetzstellen : null,
          /* v1073-WGAA-3 · Welcher Ausschuss den Faktor abgeleitet hat,
           * gehoert an die Zahl — sonst sieht ein Leser nicht, ob sie
           * ueberhaupt fuer seinen Ort gilt. */
          sachwertfaktor_ausschuss: (_swfTab && _swfTab.ausschuss) || null,
          sachwertfaktor_tabellenwert: (_swfTab && _swfTab.tabellenwert) || null,
          sachwertfaktor_korrekturen: (_swfTab && _swfTab.verfuegbar
            && (_swfTab.korrektur_rnd != null || _swfTab.korrektur_bgf != null))
            ? { rnd: _swfTab.korrektur_rnd, bgf: _swfTab.korrektur_bgf,
                nicht_korrigiert: _swfTab.nicht_korrigiert || null }
            : null,
          verfahren: _sw.verfahren,
          /* v1056-WSW-3 · Die Zwischenwerte, die die Karte braucht. */
          bodenwert_eur: _sw.bodenwert_eur != null ? _sw.bodenwert_eur : null,
          gebaeude_sachwert_eur: _sw.gebaeude_sachwert_eur != null ? _sw.gebaeude_sachwert_eur : null,
          restnutzungsdauer_jahre: _sw.restnutzungsdauer_jahre != null ? _sw.restnutzungsdauer_jahre : null,
          gesamtnutzungsdauer_jahre: _sw.gesamtnutzungsdauer_jahre != null ? _sw.gesamtnutzungsdauer_jahre : null,
          /* v1061-WFUS-3 · Der tatsaechlich verwendete NHK-Kennwert. */
          nhk_eur_qm_bgf: _sw.nhk_eur_qm_bgf != null ? _sw.nhk_eur_qm_bgf : null,
          /* Ohne Sachwertfaktor ist es eine Herstellungskostenrechnung.
           * Das steht so in den Warnungen des Rechenkerns — der Bericht
           * muss es genauso sagen und darf die Zahl nicht als drittes
           * gleichrangiges Verfahren fuehren. */
          vorlaeufig: !_sw.marktangepasst,
          bezeichnung: _sw.marktangepasst ? 'Sachwert' : 'vorläufiger Sachwert',
          hinweis_kurz: _sw.marktangepasst ? null
            : 'ohne Sachwertfaktor — Herstellungskosten, kein Marktwert',
        };
        _sw.warnungen.forEach((w) => { if (out.notes.indexOf(w) < 0) out.notes.push(w); });
        _sw.hinweise.forEach((h) => { if (out.notes.indexOf(h) < 0) out.notes.push(h); });
        /* v1028 · Kein vorzeitiges return: der Vergleichsblock unten setzt
         * out.comparison und den Spread. Frueher aussteigen hiesse, den
         * Sachwert zu haben und die Gegenueberstellung zu verlieren. */
        _nhkFertig = true;
      }
    }

    const _typUnbekannt = !ref.property_type;
    if (_nhkFertig) { /* WNHK-6: Sachwert steht bereits aus der NHK-Rechnung */ }
    else if (_typUnbekannt) {
      out.sachwert = { available: false,
        grund: 'Objekttyp nicht angegeben — ohne ihn ist die richtige NHK-Tabelle nicht bestimmbar.' };
      out.notes.push('Sachwert nicht ausgewiesen: Der Objekttyp fehlt. Bitte im Formular ergänzen.');
    } else if (istWohnung) {
      out.sachwert = {
        available: false,
        /* v1047-WSWE-2 · Der alte Text behauptete, die Bruttogrundflaeche
         * fehle — auch dann, wenn sie laengst im Formular stand. Er stammt
         * aus der Zeit, als das Feld noch gar nicht erfassbar war. */
        grund: _bgfWhg > 0
          ? 'Sachwert nicht ausgewiesen: die Bruttogrundfläche liegt vor, aber die '
            + 'Standardstufe fehlt. Ohne sie ist nicht bestimmbar, welcher der drei '
            /* v1052-WSTD-1 · Bei Mehrfamilienhaeusern (4.1 bis 4.3) kennt
             * Anlage 4 nur die Stufen 3 bis 5 — drei Kennwerte, nicht fuenf.
             * Der Text stammt aus der Zeit, als der Sachwert nur fuer
             * Haeuser lief. Zwischen Stufe 3 und 5 liegen bei 4.1 rund
             * 44 Prozent (825 gegen 1.190 EUR je m2 BGF). */
            + 'NHK-Kennwerte gilt — zwischen Stufe 3 und Stufe 5 liegen rund 44 Prozent, zu viel, '
            + 'um sie zu mitteln. Standardstufe ergänzen, dann rechnet er.'
          : 'Sachwert nicht ausgewiesen: für eine Eigentumswohnung wird die '
            + 'Bruttogrundfläche der Wohnung benötigt. Die Näherung aus der '
            + 'Wohnfläche ist im Mehrfamilienhaus zu ungenau (Treppenhaus, Keller, '
            + 'Gemeinschaftsflächen). Beim Wohnungseigentum führt ohnehin das '
            + 'Vergleichswertverfahren.',
      };
      out.notes.push('Sachwert nicht ausgewiesen: Das vereinfachte Sachwertverfahren arbeitet mit den Normalherstellungskosten für Einfamilienhäuser (NHK 2010, Standardstufe 3) und dem EFH-Faustwert BGF ≈ Wohnfläche × 1,35. Für eine Eigentumswohnung ist das die falsche Grundlage – lieber keine Zahl als eine falsche. Der Ertragswert-Quercheck bleibt.');
    } else if (wfl && buildYear) {
      const bgf = wfl * BGF_FAKTOR;
      const hkNeubau = bgf * NHK_EFH_BGF * BAUPREISINDEX;
      const alterswertfaktor = rnd != null ? rnd / GND_JAHRE : null;
      const gebaeudeSachwert = alterswertfaktor != null ? hkNeubau * alterswertfaktor : null;
      if (gebaeudeSachwert != null) {
        const vorl = (bodenwert || 0) + gebaeudeSachwert;
        const sachwert = Math.round(vorl * SACHWERTFAKTOR / 1000) * 1000;
        out.sachwert = {
          available: true,
          bodenwert_eur: bodenwert,                       // null wenn Grundstueck/BRW fehlt
          bgf_sqm: Math.round(bgf),
          herstellungskosten_neubau_eur: Math.round(hkNeubau),
          alter_jahre: nowYear - buildYear,
          restnutzungsdauer_jahre: rnd,
          alterswertminderung_faktor: round(alterswertfaktor, 3),
          gebaeude_sachwert_eur: Math.round(gebaeudeSachwert),
          sachwertfaktor: SACHWERTFAKTOR,
          value_eur: sachwert,
          bodenwert_fehlt: bodenwert == null,
        };
        if (bodenwert == null) out.notes.push('Sachwert OHNE Bodenwert (Grundstücksfläche oder Bodenrichtwert fehlt) – nur Gebäudesachwert ausgewiesen.');
        /* v955-etw: SACHWERTFAKTOR = 1.0 heisst "keine Marktanpassung", nicht
         * "Marktanpassung ergibt 1,0". Real liegt er je nach Lage bei 0,8-1,3.
         * Wer das nicht weiss, liest den Sachwert als Verkehrswert. */
        out.notes.push('Sachwertfaktor 1,0 angesetzt: Ohne Daten des örtlichen Gutachterausschusses erfolgt KEINE Marktanpassung. Reale Sachwertfaktoren liegen je nach Lage zwischen 0,8 und 1,3 – der ausgewiesene Sachwert ist deshalb unangepasst und weicht systematisch vom Verkehrswert ab.');
        if (!istHaus && !istWohnung) out.notes.push('Objektart nicht eindeutig – Sachwert mit EFH-Ansatz gerechnet. Bei Nicht-Wohnnutzung ist er nicht belastbar.');
      }
    }

    /* WKERN-2 · ERTRAGSWERT ueber den gemeinsamen Kern.
     * Die Formel ist dieselbe. Neu ist, woher die Parameter kommen: Liegenschafts-
     * zins und Bewirtschaftungskosten waren hier fest verdrahtet (3,0 % und
     * pauschal 23 %). Jetzt setzt der Aufrufer sie ueber `params`; fehlt etwas,
     * greifen dieselben Pauschalen wie bisher. Ein Kern, zwei Genauigkeitsgrade.
     */
    const rentSqm = rent && _num(rent.median_per_sqm);
    /* v1059-WMIET-5 · Die Miete, die der Ertragswert kapitalisiert.
     * Traegt der Zinssatz den Vermerk agvga_nrw_2016 und liegt eine
     * Mietpreisuebersicht vor, fuehrt die amtliche Miete — Paragraf 10:
     * derselbe Modellansatz, aus dem der Zinssatz abgeleitet wurde.
     * Sonst bleibt es beim Portalangebot, unveraendert. */
    const _amtFuehrt = !!(p.amtliche_miete && p.amtliche_miete.verfuegbar
      && p.amtliche_miete.fuehrend !== false
      && ['agvga_nrw_2016'].indexOf(String(p.modellversion || '')) >= 0);
    const mieteQm = _amtFuehrt ? p.amtliche_miete.miete_qm : rentSqm;
    const mieteQuelle = _amtFuehrt
      ? 'Mietpreisübersicht des Gutachterausschusses' : 'Angebotsmieten';
    /* v1047 · `p` steht jetzt am Anfang der Funktion. */
    /* v1072-WERT-1 · KEINE ERTRAGSWERT-ZAHL OHNE ERFASSTE MIETE.
     *
     * Gemessen an Loehner Str. 278: keine Miete eingegeben, kein Kaufpreis,
     * und trotzdem stand ein Ertragswert von 530.000 EUR im Bericht — die
     * groesste der drei Zahlen, neben einem fuehrenden Sachwert von
     * 337.713 EUR. Der Rohertrag stammte vollstaendig aus Portalangeboten
     * fuer WOHNUNGEN, hochgerechnet auf 233 m2 Haus.
     *
     * Das Verkehrswertgutachten zu demselben Objekt sagt es klar: unter
     * "Das Ertragswertverfahren § 27ff." steht die Definition und dann
     * "Ein stuetzendes Wertermittlungsverfahren wurde nicht angewandt."
     * Fuer ein selbstgenutztes Zweifamilienhaus rechnet ein
     * Sachverstaendiger keinen Ertragswert.
     *
     * v1071 hat die Mietquelle nur gekennzeichnet. Das reicht nicht: wer
     * drei Zahlen nebeneinander sieht, liest die groesste. Bei Ein- und
     * Zweifamilienhaeusern ohne erfasste Miete erscheint deshalb KEINE
     * Zahl mehr — der Rechenweg bleibt, mit Begruendung.
     *
     * Bei Mehrfamilienhaeusern und Wohnungen bleibt es beim Portalwert:
     * dort IST der Ertrag preisbildend, und § 31 Abs. 2 verlangt ohnehin
     * die marktueblich erzielbare statt der Ist-Miete. */
    /* v1072 · _pt ist in dieser Funktion bereits vergeben (Sachwertzweig) —
     * node --check in apply.sh hat die Kollision gefangen. */
    const _ptEw = String(ref.property_type || '').toLowerCase();
    const _eigennutz = /efh|zfh|dhh|^rh$|reihen|doppel|einfamilien|zweifamilien|haus/.test(_ptEw)
      && !/mfh|mehrfamilien/.test(_ptEw);
    const _mieteErfasst = _num(ref.monthly_net_rent) > 0 || !!_amtFuehrt;
    const _ertragUnterdruecken = _eigennutz && !_mieteErfasst;

    if (wfl && mieteQm && rnd != null) {
      /* v1059-WMIET-6 */
      const rohertrag = Math.round(mieteQm * wfl * 12);
      const lzsPct = _num(p.lzs_pct) != null ? Number(p.lzs_pct) : LIEGENSCHAFTSZINS * 100;
      const bwErgebnis = (p.bodenwert && p.bodenwert.vollstaendig)
        ? p.bodenwert
        : { vollstaendig: bodenwert != null, wert: bodenwert,
            quelle: { brw_sqm: brw, herkunft: brw ? 'boris' : 'manuell' } };

      const ein = {
        objektart: ref.property_type, baujahr: buildYear, baustatus: ref.baustatus || 'bestand',
        wohnflaeche_qm: wfl, anzahl_we: _num(ref.units) || 1, stichtag_jahr: nowYear,
        miete_markt_jahr: rohertrag,
        miete_markt_qm: mieteQm, miete_quelle: mieteQuelle,   /* v1059-WMIET-7 */
        /* v1048-WSPL-1 · Vorher nur ref.garages — die Aussenstellplaetze
         * fielen unter den Tisch. Das PDF meldete "1 Stellpl." bei einem
         * Objekt mit einer Garage UND zwei Aussenplaetzen. */
        stellplatz_anz: (_num(ref.garages) || 0) + (_num(ref.outdoor_parking) || 0),
        garagen_anz: _num(ref.garages) || 0,
        aussen_anz: _num(ref.outdoor_parking) || 0,
        stellplatz_miete_monat: _num(p.stellplatz_miete_monat),
        /* Nach welchem Modell der Zinssatz abgeleitet wurde. */
        modellversion: p.modellversion || null,
        /* v1052-WA2-1 · rnd_jahre wird BEWUSST nicht gesetzt, wenn
         * Modernisierungspunkte vorliegen: der Ertragswertdienst betritt
         * den Anlage-2-Zweig nur, wenn keine Restnutzungsdauer vorgegeben
         * ist (`if (!R)`). Mit vorgegebener Dauer blieb es bei der
         * Schaetzung, obwohl die Punkte durchgereicht wurden — der Wert
         * kam an und wurde trotzdem nicht benutzt. */
        rnd_jahre: (_num(ref.mod_punkte) != null ? null : rnd),
        /* v1057-WSON-7 */
        sonstige_jahr: _num(ref.sonstige_jahr),
        sonstige_dauer_jahre: _num(ref.sonstige_dauer_jahre),
        mod_punkte: _num(ref.mod_punkte),
        /* v1052-WA2-2 · Kernsanierung nur, wenn die Punkte sie auch tragen.
         * Anlage 2 versteht darunter einen Zustand, der NAHEZU EINEM NEUEN
         * GEBAEUDE entspricht, und erlaubt dafuer 90 statt 70 Prozent der
         * Gesamtnutzungsdauer. Gemessen am Testobjekt: das Wort allein hob
         * die Restnutzungsdauer von 49,6 auf 72 Jahre und den Ertragswert
         * um rund dreissig Prozent — bei 14 von 20 Punkten und ohne
         * Aussenwanddaemmung. Ein Auswahlfeld darf das nicht koennen. */
        kernsaniert: /kernsaniert/i.test(String(ref.modernization || ''))
          && (_num(ref.mod_punkte) || 0) >= 18,
        sanierungsjahr: _num(ref.modernization_year) || _num(ref.reconstruction_year) || null,
        lzs_pct: lzsPct, lzs_quelle: p.lzs_quelle || 'pauschal', lzs_stufe: p.lzs_stufe || null,
        bog_eur: _num(p.bog_eur), bog_grund: p.bog_grund || null,
      };
      /* v1048-WMOD-3 */
      const _hatModell = ['agvga_nrw_2016'].indexOf(String(p.modellversion || '')) >= 0;
      /* v1049-WBWK-3 · Hat der Ausschuss seine eigene Quote veroeffentlicht,
       * ist sie der genaueste Ansatz — genauer als jeder Modellwert, weil
       * sie aus denselben Kauffaellen stammt wie der Zinssatz. */
      const _quote = _num(p.bwk_quote_pct);
      if (_quote > 0) {
        ein.bwk_modus = 'manuell';
        /* v1061-WBWK-1 · Die Quote gehoert auf den GESAMTEN Rohertrag.
         * `rohertrag` enthaelt hier nur die Wohnung; die Stellplaetze kommen
         * erst im Ertragswertdienst dazu. Der Bericht wies deshalb '27 %'
         * aus und rechnete 23,1 % — 729 EUR zu wenig Kosten und ueber den
         * Barwertfaktor rund 22.000 EUR zu viel Ertragswert.
         *
         * Der Ausschuss rechnet mit dem normierten Kaufpreis, der 'typische
         * Nebengebaeude wie Garagen' enthaelt — Stellplaetze gehoeren also
         * in die Bezugsgroesse. */
        const _spEinnahme = (_num(p.stellplatz_miete_monat) || 0)
          * ((_num(ref.garages) || 0) + (_num(ref.outdoor_parking) || 0)) * 12;
        ein.bwk_gesamt_jahr = Math.round((rohertrag + _spEinnahme) * _quote / 100);
        ein.bwk_bezugsgroesse_jahr = Math.round(rohertrag + _spEinnahme);
        ein.bwk_quote_herkunft = p.bwk_quote_quelle || null;
        ein.bwk_quote_pct = _quote;   /* v1052-WBWK-2 */
        out.notes.push('Bewirtschaftungskosten mit der Quote von '
          + String(_quote).replace('.', ',') + ' % gerechnet'
          + (p.bwk_quote_quelle ? ' — Quelle: ' + p.bwk_quote_quelle : '')
          + '. Sie stammt aus denselben Kauffällen wie der Liegenschaftszinssatz '
          + 'und ist damit der modellkonformste verfügbare Ansatz.');
      } else
      if (!_hatModell && p.bwk_modus !== 'normiert') {
        ein.bwk_modus = 'manuell';
        ein.bwk_gesamt_jahr = Math.round(rohertrag * BWK_QUOTE);
      } else {
        ein.bwk_modus = 'normiert';
        ein.bwk_verwaltung_je_we = _num(p.bwk_verwaltung_je_we);
        ein.bwk_instandhaltung_je_qm = _num(p.bwk_instandhaltung_je_qm);
        ein.bwk_mietausfall_pct = _num(p.bwk_mietausfall_pct);
        ein.bwk_betrieb_nul_jahr = _num(p.bwk_betrieb_nul_jahr);
      }

      const kern = ErtragswertService.ertragswert(ein, bwErgebnis);
      out.ertragswert_kern = kern;

      if (kern.vollstaendig && kern.wert != null && _ertragUnterdruecken) {
        /* v1072-WERT-2 · Der Rechenweg bleibt, die Zahl nicht. */
        out.ertragswert = {
          available: false,
          unterdrueckt: true,
          grund: 'keine_miete_erfasst',
          staffel: kern.staffel,
          miete_quelle: mieteQuelle,
          hinweis: 'Für dieses Objekt ist keine Miete erfasst. Ein- und '
            + 'Zweifamilienhäuser werden in der Regel nicht unter '
            + 'Renditegesichtspunkten gehandelt (§ 6 Abs. 1 ImmoWertV); ein '
            + 'Ertragswert aus abgeleiteten Angebotsmieten wäre eine Aussage über '
            + 'etwas, das nicht erhoben wurde. Der Rechenweg ist unten dargestellt, '
            + 'ein Wert wird nicht ausgewiesen. Wird eine Miete eingetragen, '
            + 'erscheint er.',
        };
        kern.warnungen.forEach((w) => { if (out.notes.indexOf(w) < 0) out.notes.push(w); });
      } else if (kern.vollstaendig && kern.wert != null) {
        const hol = (t) => { const r = kern.staffel.find((s) => s.pos.indexOf(t) >= 0); return r ? r.wert : null; };
        out.ertragswert = {
          available: true,
          rohertrag_pa_eur: hol('= Rohertrag'),
          bwk_pa_eur: Math.abs(hol('Bewirtschaftungskosten') || 0),
          reinertrag_pa_eur: hol('= Reinertrag'),
          liegenschaftszins_pct: kern.lzs ? kern.lzs.pct : lzsPct,
          liegenschaftszins_stufe: kern.lzs ? kern.lzs.stufe : null,
          /* v1050-WSTR-2 · Ohne diese vier Zeilen bleibt die Spanne im PDF
           * leer — die Kaskade kennt sie, die Karte sah sie nie. */
          streuung_pct: _num(p.lzs_streuung_pct),
          liegenschaftszins_min: _num(p.lzs_min),
          liegenschaftszins_max: _num(p.lzs_max),
          liegenschaftszins_herabgestuft: !!p.lzs_herabgestuft,
          liegenschaftszins_quelle: kern.lzs ? kern.lzs.quelle : null,
          /* v1071-WMIE-1 · mieteQuelle wird seit v1059 bestimmt und war
           * nirgends sichtbar. Bei Loehner Strasse 278 war KEINE Miete
           * erfasst — der Rohertrag von 27.065 EUR stammt vollstaendig aus
           * Portalangeboten fuer Wohnungen, angewandt auf ein 233-m2-Haus,
           * und ergab einen Ertragswert von 496.000 EUR neben einem
           * fuehrenden Sachwert von 287.433 EUR. Wer drei Zahlen sieht, muss
           * erkennen koennen, welche auf Angaben beruht. */
          miete_quelle: mieteQuelle,
          miete_erfasst: !!(p && p.ist_miete_erfasst),
          miete_modellkonform: mieteQuelle === 'Mietpreisübersicht des Gutachterausschusses',
          /* v1063-WOD-8 · dritte Station der Kette */
          liegenschaftszins_einordnung: p.lzs_einordnung || null,
          restnutzungsdauer_jahre: kern.nutzungsdauer ? kern.nutzungsdauer.rnd : rnd,
          vervielfaeltiger: kern.barwertfaktor,
          bodenwert_eur: bwErgebnis.vollstaendig ? bwErgebnis.wert : null,
          value_eur: kern.wert,
          bodenwert_fehlt: !bwErgebnis.vollstaendig,
          staffel: kern.staffel,
          belastbarkeit: kern.belastbarkeit,
          sensitivitaet: kern.sensitivitaet,
          verfahren: kern.verfahren,
          modellversion: kern.modellversion,
        };
        kern.warnungen.forEach((w) => { if (out.notes.indexOf(w) < 0) out.notes.push(w); });
        kern.hinweise.forEach((h) => { if (out.notes.indexOf(h) < 0) out.notes.push(h); });
      } else {
        out.ertragswert = { available: false, grund: (kern.warnungen[0] || 'Ertragswert nicht berechenbar.') };
      }
    }

    // ================= VERGLEICH =================
    const vgl = valuation && valuation.market_value ? valuation.market_value.estimated : null;
    if (out.sachwert.available || out.ertragswert.available) {
      /* v1049-WFLA-3 · Der Flaechenbefund gehoert in den Bericht, nicht nur
     * ins Log. Eine stille Annahme ueber den Bodenwert ist dieselbe Sorte
     * Fehler wie die stille Standardstufe 3. */
    /* v1053-WIRW-4 · Der Immobilienrichtwert gehoert in den Bericht — auch
     * und gerade dann, wenn es keinen gibt. "Fuer diese Gemeinde noch
     * nicht beschlossen" ist eine Auskunft, kein Fehler. */
    if (p.irw) {
      out.irw = p.irw;
      if (p.irw.verfuegbar && p.irw.abweichung && p.irw.abweichung.hinweis
          && out.notes.indexOf(p.irw.abweichung.hinweis) < 0) {
        out.notes.push(p.irw.abweichung.hinweis);
      } else if (!p.irw.verfuegbar && p.irw.hinweis
                 && out.notes.indexOf(p.irw.hinweis) < 0) {
        out.notes.push(p.irw.hinweis);
      }
    }
    /* v1059-WMIET-4 · Traegt der Zinssatz den Modellvermerk und liegt eine
     * Mietpreisuebersicht vor, fuehrt die amtliche Miete den Ertragswert.
     * Paragraf 10: derselbe Modellansatz, aus dem der Zinssatz stammt.
     * Die Portalmiete bleibt sichtbar — der Abstand ist selbst eine
     * Aussage ueber den Markt. */
    /* v1060-WVF-4 · Der amtliche Vergleichsfaktor gehoert in den Bericht —
     * auch dann, wenn er nicht fuehrt. Dass ein Objekt aus dem
     * Anwendungsbereich des Ausschusses faellt, ist selbst eine Auskunft. */
    /* v1061-WVER-2 · Paragraf 6 Abs. 1 ImmoWertV: die Verfahren sind nach
     * der Art des Objekts zu waehlen. Der Marktbericht gibt die Regel vor —
     * Ein- und Zweifamilienhaeuser ueber den Sachwert, Renditeobjekte ueber
     * den Ertragswert, typisches Wohnungseigentum ueber den Vergleich.
     * Feste Regel, kein Gefuehl: derselbe Objekttyp bekommt immer dieselbe
     * Behandlung. */
    out.verfahrenswahl = fuehrendesVerfahren({
      objektart: ref.property_type, wohneinheiten: ref.units, nutzung: ref.usage_type,
    });
    if (out.verfahrenswahl && out.verfahrenswahl.grund) {
      out.notes.push('Führendes Verfahren: ' + ({ sachwert: 'Sachwertverfahren',
        ertragswert: 'Ertragswertverfahren', vergleichswert: 'Vergleichswertverfahren' }
        [out.verfahrenswahl.verfahren] || '—') + '. ' + out.verfahrenswahl.grund);
    }

    /* v1061-WVER-3 · Objektspezifisch angepasster Zinssatz nach Paragraf 33.
     * Ausgangswert bleibt der amtliche; die Anpassung folgt dem Katalog des
     * Ausschusses und bleibt in seiner Streuung. Ergebnis ist Stufe C —
     * marktabgeleitet, nie amtlich. */
    if (p.lzs_pct > 0 && p.lzs_min != null && p.lzs_max != null) {
      const _stabw = (Number(p.lzs_max) - Number(p.lzs_min)) / 2;
      const _an = angepassterZins({
        basis_pct: Number(p.lzs_pct), stabw_pct: _stabw,
        gebaeudealter: ref.build_year ? (new Date()).getFullYear() - Number(ref.build_year) : null,
        mikrolage_score: p.mikrolage_score != null ? Number(p.mikrolage_score) : null,
        nutzung: ref.usage_type, wohneinheiten: ref.units,
        wohnflaeche_qm: ref.living_area, normobjekt_qm: p.normobjekt_qm || null,
      });
      if (_an && _an.verfuegbar) out.zins_anpassung = _an;
    }

    if (p.amtlicher_vergleichsfaktor) {
      out.amtlicher_vergleichsfaktor = p.amtlicher_vergleichsfaktor;
      const _vf = p.amtlicher_vergleichsfaktor;
      if (_vf.verfuegbar && _vf.hinweis && out.notes.indexOf(_vf.hinweis) < 0) {
        out.notes.push(_vf.hinweis);
      }
    }
    if (p.amtliche_miete) {
      out.amtliche_miete = p.amtliche_miete;
      if (p.amtliche_miete.verfuegbar && rentSqm > 0) {
        const _ab = Math.round((rentSqm / p.amtliche_miete.miete_qm - 1) * 100);
        out.amtliche_miete.abweichung_pct = _ab;
        out.notes.push('Die Angebotsmiete liegt mit '
          + String(rentSqm).replace('.', ',') + ' €/m² um ' + (_ab > 0 ? '+' : '') + _ab
          + ' % über der Mietpreisübersicht des Gutachterausschusses ('
          + String(p.amtliche_miete.miete_qm).replace('.', ',') + ' €/m²). '
          + 'Der Liegenschaftszinssatz wurde auf Grundlage der amtlichen Übersicht '
          + 'abgeleitet; der Ertragswert folgt ihr deshalb (§ 10 ImmoWertV).');
      }
    }
    if (p.flaeche) {
      out.flaeche = p.flaeche;
      if (p.flaeche.hinweis && out.notes.indexOf(p.flaeche.hinweis) < 0) {
        out.notes.push(p.flaeche.hinweis);
      }
    }
    out.available = true;
      const vals = [
        ['vergleichswert', vgl],
        /* v1056-WSPR-1 · Ein vorlaeufiger Sachwert gehoert NICHT in den
         * Spread. Er ist eine Herstellungskostenrechnung; ihn gegen zwei
         * Marktwerte zu stellen misst Aepfel gegen Birnen und meldet dann
         * eine "grosse Abweichung", die keine Aussage traegt. Gemessen:
         * 46,8 Prozent allein aus diesem Vergleich. */
        ['sachwert', (out.sachwert.available && !out.sachwert.vorlaeufig)
          ? out.sachwert.value_eur : null],
        ['ertragswert', out.ertragswert.available ? out.ertragswert.value_eur : null],
      ].filter(([, v]) => v != null);
      const nums = vals.map(([, v]) => v);
      out.comparison = {
        vergleichswert_eur: vgl,
        sachwert_eur: out.sachwert.available ? out.sachwert.value_eur : null,
        ertragswert_eur: out.ertragswert.available ? out.ertragswert.value_eur : null,
        min_eur: nums.length ? Math.min(...nums) : null,
        max_eur: nums.length ? Math.max(...nums) : null,
        spread_pct: nums.length >= 2 && Math.min(...nums) > 0
          ? round((Math.max(...nums) / Math.min(...nums) - 1) * 100, 1) : null,
      };
    }
    return out;
  },
};
