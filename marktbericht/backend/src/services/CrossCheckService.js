// CrossCheckService.js — Sachwert- & Ertragswertverfahren als PLAUSIBILITÄTS-QUERCHECK
// zum Vergleichswert. Vereinfachte, transparente Umsetzung nach ImmoWertV-Logik
// (indikativ, KEIN Gutachten): alle Annahmen als Konstanten dokumentiert und im
// Output unter assumptions ausgewiesen. Reine Rechnung — keine API-Kosten.
import { round } from '../lib/stats.js';
/* v1099-WQL · Der Weg zur Quelle - fuer den Fall, dass wir keinen Wert
   haben. Dann ist der Link die einzige Auskunft, die wir geben koennen. */
import { quelleFuer, quellenSatz } from '../lib/quellen_links.js';
/* WKERN-1 · Ertragswert wird nicht mehr hier gerechnet, sondern im gemeinsamen
 * Kern. Zwei Ertragswerte im selben Bericht waeren zwei Wahrheiten. */
import { ErtragswertService } from './ErtragswertService.js';
/* WNHK-4 */
import { sachwert as nhkSachwert, NHK_2010 } from '../lib/nhk2010.js';
import { pruefeModell, mieteModellkonform } from '../lib/modellpruefung.js';   /* v2595 */
/* ══ v1968 · HIER STAND EIN TOTER IMPORT ══════════════════════════════

     import { restnutzungsdauer as anlage2Rnd } from '../lib/anlage2.js';

   `anlage2Rnd` kam in dieser Datei GENAU EINMAL vor: in der Importzeile.
   Gerechnet wird seit v1816 ueber `rndEinheitlich` (Zeile darunter).

   Er stand damit genau an der Stelle, die CLAUDE.md mit „Eine
   Restnutzungsdauer fuer alle Verfahren" meint — und sah aus wie ein
   zweiter Weg, der noch benutzt wird. Wer hier sucht, welchen Kern der
   Sachwert fragt, fand zwei Kandidaten.

   Die Zieldatei lib/anlage2.js bleibt: lib/rnd-einheitlich.js und
   lib/immowertv.js importieren sie und rufen sie auch. */
import { restnutzungsdauerEinheitlich as rndEinheitlich } from '../lib/rnd-einheitlich.js'; /* v1816 */
import { fuehrendesVerfahren, angepassterZins } from '../lib/verfahrenswahl.js';   /* v1061-WVER-1 */
/* v1069-WSWF-1 · Sachwertfaktoren nach § 21 Abs. 3 ImmoWertV. */
/* v1073-WGAA-1 · Nicht mehr ein Modul, sondern der Aufloeser. Er
 * entscheidet nach dem Gemeindeschluessel, welcher Ausschuss zustaendig
 * ist, und gibt immer dieselbe Form zurueck. Kein Treffer heisst KEIN
 * WERT — nie ein Nachbarkreis, nie ein Landesmittel. */
import { sachwertfaktor as swfNachTabelle } from '../lib/gutachterausschuss.js';
/* v2241 · Gewerbe und Grundstueck: eine Quelle fuer die Objektart. */
import { istGewerbe, istGrundstueck, gewerbeArt, gewerbeAnlage3, gewerbeGndSchluessel } from '../lib/marktsegment.js';
import { gnd as gndNachArt, GND_TABELLE, gndNachAnlage1Belegt } from '../lib/immowertv.js';
import { schaetzung as rndSchaetzung } from '../lib/rnd-einheitlich.js';

// ---- Annahmen (dokumentiert, anpassbar) ----
const NHK_EFH_BGF = 835;          // NHK 2010, EFH Standardstufe 3, €/m² BGF
/* ═══ v1407 · DER BAUPREISINDEX WAR 5,7 PROZENT ZU HOCH ═══════════════════
   Hier stand `2.02` mit dem Vermerk „Destatis, gerundet". Gemessen am
   15.09.2026 sagen ZWEI unabhaengige amtliche Quellen etwas anderes — beide
   zum selben Stichtag 01.01.2026:

     Immobilienmarktbericht Hamburg 2026   1,911   (Basis Mai 2010 = 1)
     Grundstuecksmarktbericht Dortmund 2026 1,906

   Die beiden sind sich auf zwei Nachkommastellen einig; unsere Konstante lag
   5,7 Prozent darueber. Was das kostet, am Gebaeudesachwert gerechnet
   (NHK 835 EUR/m2 BGF, BGF = Wohnflaeche x 1,35):

     120 m2, RND 40/80    136.623 statt 129.250 EUR    +7.373
     150 m2, RND 60/80    256.168 statt 242.345 EUR   +13.823
     200 m2, RND 50/80    284.631 statt 269.272 EUR   +15.359

   Durchgehend 5,7 Prozent zu hoch — und zwar in die gefaehrliche Richtung:
   der Sachwert faellt zu gross aus, das Objekt sieht zu gut aus.

   WARUM 1,91 UND NICHT EINER DER BEIDEN WERTE: sie unterscheiden sich um
   0,26 Prozent, und ihre Basis ist minimal verschieden (Hamburg nennt
   ausdruecklich „Mai 2010", Dortmund keinen Monat). Auf zwei Stellen sind
   sie identisch. Eine dritte Stelle vorzutaeuschen, die die Quellen nicht
   hergeben, waere Scheingenauigkeit.

   UND DAS BLEIBT FALSCH, auch mit der besseren Zahl: eine KONSTANTE hat
   keinen Stichtagsbezug. Fuer einen Wertermittlungsstichtag in der
   Vergangenheit rechnet sie zwangslaeufig daneben. Der richtige Weg ist der
   Registerdatensatz — 33 Saetze fuehren den Index bereits, aber als
   FLIESSTEXT („Preisindizes des Statistischen Bundesamtes fuer den Neubau
   von Wohngebaeuden") statt als Zahl. Nur Hamburg hat ihn beziffert. Das
   ist dasselbe Muster wie bei der Gesamtnutzungsdauer vor v1338: der Wert
   steht da, aber nicht in einem Feld, das jemand abholen kann.
   Siehe Backlog B1 (2). */
const BAUPREISINDEX = 1.91;       // Neubau Wohngebaeude, 2010 -> 01.01.2026
export const BAUPREISINDEX_KONSTANTE = { wert: BAUPREISINDEX, stichtag: '2026-01-01', art: 'konstante' }; /* v1851: fuer die Automatik-Leiste, EINE Quelle */
                                  // Quellen: IMB Hamburg 2026 (1,911),
                                  // GMB Dortmund 2026 (1,906)
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
const BAND_OBEN = 1.15;   /* v2541 · obere Kante des Marktueblichkeitsbandes (bis v2540: 1,3) */

/* v2488 · DIE BANDREGEL ALS EINE FUNKTION (Marcel 20.10.2026: jede Stufe baut auf
   derselben Basis wie der Bestand). Bis v2487 stand sie nur inline in compute();
   PotenzialService braucht sie je WOHNUNG. Band nach v2382: untere Kante =
   min(amtlich, Angebot) x 0,7, obere = max(...) x 1,3. Ist im Band -> Ist,
   darueber/darunter -> die Kante, ohne Ist -> die Vergleichsmiete. */
export function mieteNachBand(istQm, band, refQm) {
  const lage = (istQm != null && band)
    ? (istQm > band.oben_qm ? 'ueber' : (istQm < band.unten_qm ? 'unter' : 'im_band')) : null;
  const fuehrt = istQm != null && (band == null || lage === 'im_band');
  const kante = lage === 'ueber' ? band.oben_qm : (lage === 'unter' ? band.unten_qm : null);
  return { qm: fuehrt ? istQm : (kante != null ? kante : refQm), lage, fuehrt, kante };
}

/* v2595 · Differenz Marktpreisindikation − Ertragswert, bezogen auf den Ertragswert.
   Auch PotenzialService nutzt sie (eine Rechnung, zwei Ausgaben). */
export function differenzZumErtragswert(mpi, ew) {
  const m = Number(mpi), e = Number(ew);
  if (mpi == null || ew == null || !Number.isFinite(m) || !Number.isFinite(e) || e === 0 || m <= 0) return null;
  const abs = Math.round(m - e);
  return { mpi_eur: Math.round(m), ertragswert_eur: Math.round(e), absolut_eur: abs,
           relativ_pct: Math.round(abs / e * 10000) / 100, bezug: 'ertragswert',
           formel: 'Marktpreisindikation − Ertragswert; in % des Ertragswerts' };
}

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
        /* v1816 · Welcher Zweig des Ausschusses — die Angabe trennt einen
           amtlichen Wert von einem gemittelten. */
        liegenschaftszins_zweig: (params && params.lzs_zweig) || null,
        liegenschaftszins_berichtsjahr: (params && params.lzs_berichtsjahr) || null,
        liegenschaftszins_aus_register: !!(params && params.lzs_aus_register),
        bwk_quote: BWK_QUOTE, liegenschaftszins: LIEGENSCHAFTSZINS,
      },
      notes: ['Vereinfachtes Sachwert-/Ertragswertverfahren nach ImmoWertV-Logik als Plausibilitäts-Quercheck. Indikativ, kein Gutachten n. § 194 BauGB.'],
    };

    /* ── v1816 · DIE RUECKFRAGE WIRD EIN SATZ IM BERICHT ──────────────────
     *
     * Der Gutachterausschuss fuehrt fuer diesen Ort einen amtlichen
     * Liegenschaftszinssatz, aber es fehlt eine Angabe zum Staffeln.
     * Gerechnet wurde deshalb mit dem Rueckfall.
     *
     *   > Ein Auffangwert ohne Begruendung sieht aus wie das Beste, was
     *   > es gibt. Er ist das Schlechteste, was es gibt.
     *
     * Der Satz nennt, WAS fehlt und WAS der Ausschuss anbietet — damit der
     * Nutzer es nachtragen und den amtlichen Wert bekommen kann. */
    try {
      const _rf = params && params.lzs_rueckfrage;
      if (_rf && _rf.hinweis) {
        const _was = {
          lage: 'die Lage', stadtteil: 'der Stadtteil',
          restnutzungsdauer: 'die Restnutzungsdauer', baujahr: 'das Baujahr',
          objektart: 'die Objektart',
          /* v2396 · Rueckfragen statt Zufall bei gleich passenden Zweigen (Dresden) */
          haustyp: 'die Hausart (Reihenend- oder Reihenmittelhaus)',
          bauweise: 'die Bauweise (offen oder geschlossen)',
        }[_rf.fehlt || _rf.grund] || 'eine Angabe';
        const _auswahl = (Array.isArray(_rf.auswahl) && _rf.auswahl.length)
          ? ' Der Ausschuss führt: ' + _rf.auswahl.slice(0, 12).join(', ') + '.' : '';
        /* v2381 · Der Rueckfall heisst so und traegt seine Herkunft - nie „Stufe A" ohne Zusatz. */
        const _rfArt = (params && params.lzs_stufe === 'D')
          ? 'dem gesetzlichen Auffangwert nach § 256 BewG (Stufe D, kein Wert des Gutachterausschusses)'
          /* v2401 · N tritt mit offener Rueckfrage nie auf (WertParameterService) - falls doch, beim Namen */
          : (params && params.lzs_stufe === 'N')
          ? 'einem aus der DealPilot-Formel abgeleiteten Wert (Stufe N, nicht amtlich)'
          : 'einem Rückfallwert' + ((params && params.lzs_quelle) ? ' (' + String(params.lzs_quelle).split(',')[0] + ')' : '')
            + ' — nicht dem objektgenau zugeordneten amtlichen Satz';
        out.notes.push(_rf.grund === 'ausserhalb_geltung'
          ? ('Kein amtlicher Liegenschaftszinssatz für dieses Objekt: ' + _rf.hinweis
            + ' Gerechnet wurde deshalb mit ' + _rfArt + '.')
          : ('Für diesen Ort liegt ein amtlicher Liegenschaftszinssatz '
          + 'des Gutachterausschusses vor, konnte aber nicht zugeordnet werden: '
          + _was + ' fehlt.' + _auswahl + ' ' + _rf.hinweis
          + ' Gerechnet wurde deshalb mit ' + _rfArt + '.'));
        out.liegenschaftszins_rueckfrage = _rf;
      }
    } catch (e) { /* ein Hinweis darf den Bericht nie kippen */ }

    /* ═══ v2241 · UNBEBAUTES GRUNDSTUECK ═══════════════════════════════════
       Bis hier hatte es keinen Weg: die App kannte die Objektart nicht, und
       der Bericht meldete „Objekttyp nicht angegeben". Ohne Gebaeude gibt
       es keinen Gebaeudesachwert, keinen Gebaeudeertrag und keine
       Gebaeude-Vergleichspreise. Der Wert ist der Bodenwert (§ 40 ImmoWertV,
       Abs. 2: auf Grundlage geeigneter Bodenrichtwerte) — aus dem
       Bodenwert-Kern, mit seinem Rechenweg und seiner Herkunft. */
    if (istGrundstueck(ref.property_type)) {
      const _bwG = p.bodenwert || null;
      const _gruendeG = 'Unbebautes Grundstück — kein Gebäude, für das ';
      out.sachwert = { available: false, grund: _gruendeG + 'Herstellungskosten (NHK, § 36 ImmoWertV) anzusetzen wären.' };
      out.ertragswert = { available: false, grund: _gruendeG + 'ein Gebäudereinertrag kapitalisiert werden könnte (§ 27 ImmoWertV).' };
      out.bodenwert_verfahren = (_bwG && _bwG.vollstaendig && _bwG.wert != null)
        ? { available: true, value_eur: _bwG.wert, verfahren: 'Bodenwert nach § 40 Abs. 2 ImmoWertV (Bodenrichtwert)',
            staffel: Array.isArray(_bwG.schritte) ? _bwG.schritte : [], quelle: _bwG.quelle || null,
            hinweise: Array.isArray(_bwG.hinweise) ? _bwG.hinweise : [] }
        : { available: false,
            grund: (_bwG && Array.isArray(_bwG.hinweise) && _bwG.hinweise.length)
              ? _bwG.hinweise.join(' ') : 'Grundstücksfläche oder Bodenrichtwert fehlt.' };
      out.verfahrenswahl = { verfahren: 'bodenwert',
        grund: 'Unbebautes Grundstück: maßgeblich ist der Bodenwert (§ 40 ImmoWertV). Vergleichs-, '
          + 'Ertrags- und Sachwertverfahren für Gebäude entfallen.' };
      out.notes.push('Führendes Verfahren: Bodenwert. ' + out.verfahrenswahl.grund);
      if (!out.bodenwert_verfahren.available) out.notes.push('Bodenwert nicht ausgewiesen: ' + out.bodenwert_verfahren.grund);
      out.comparison = out.bodenwert_verfahren.available
        ? { vergleichswert_eur: null, basis: 'bodenwert', bezeichnung: 'Bodenwert',
            bodenwert_eur: out.bodenwert_verfahren.value_eur, sachwert_eur: null, ertragswert_eur: null,
            min_eur: out.bodenwert_verfahren.value_eur, max_eur: out.bodenwert_verfahren.value_eur, spread_pct: null }
        : null;
      out.available = !!out.bodenwert_verfahren.available;
      out.quellen_nachweis = [];
      return out;
    }

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
    /* v2390 · Warum der NHK-Kern nichts lieferte (Gebaeudetyp, Standardstufe,
       Kennwert) - der vereinfachte Pauschalweg unten muss es sagen koennen. */
    let _nhkGrundFehlt = null;
    /* WNHK-5 · Sobald die NHK-Tabelle steht, rechnet der richtige Sachwert.
     * Bis dahin bleibt der bisherige vereinfachte Weg fuer Haeuser. */
    /* v1047-WSWE-1 · Wohnungen zugelassen, sobald eine BGF vorliegt.
     * Ohne BGF bleibt es gesperrt: die Naeherung aus der Wohnflaeche ist
     * bei einem Mehrfamilienhaus unbrauchbar (Treppenhaus, Keller,
     * Gemeinschaftsflaechen), und ein zu genau aussehender falscher Wert
     * ist schlimmer als keiner. */
    /* v1056-WRND-2 · Anlage 2, wenn Punkte vorliegen — sonst die
     * bisherige Schaetzung. Dieselbe Quelle wie beim Ertragswert. */
    /* v1083-WRND-1 · EIN STILLER RUECKFALL IST SCHLIMMER ALS EIN FEHLER.
     *
     * Bleibt der Modernisierungsgrad leer, faellt die Restnutzungsdauer auf
     * die Schaetzung GND minus Alter zurueck — und der Bericht zeigte diese
     * Zahl bisher OHNE Hinweis, als waere sie nach Anlage 2 ermittelt.
     *
     * Wirkung an der Loehner Strasse: 18 statt 24 Jahre, Restwertfaktor
     * 0,225 statt 0,30, rund 57.500 EUR weniger Gebaeudesachwert. Unbemerkt.
     *
     * Das verletzt zwei eigene Grundsaetze: kein Verfahren rechnet halb, und
     * jede Zahl traegt ihre Herkunft. Gerechnet wird weiter genau wie vorher
     * — der Rueckfall meldet sich jetzt nur. */
    const _rndHerkunft = { quelle: null, grund: null, rnd_jahre: null,
                           gnd_jahre: GND_JAHRE, hinweis: null };
    const _rndMerke = (quelle, grund, wert, hinweis) => {
      _rndHerkunft.quelle = quelle; _rndHerkunft.grund = grund;
      _rndHerkunft.rnd_jahre = wert; _rndHerkunft.hinweis = hinweis;
      return wert;
    };
    const _SCHAETZUNG = 'Restnutzungsdauer geschätzt (Gesamtnutzungsdauer '
      + 'minus Alter) — Anlage 2 ImmoWertV wurde nicht angewandt.';
    /* === v1338 - DIE GESAMTNUTZUNGSDAUER IST EIN MODELLPARAMETER ======
       Sie stand hier als Konstante (`GND_JAHRE = 80`) und war damit fuer
       jeden Ausschuss dieselbe. Das Register fuehrt sie aber je Modell:
       38 Saetze mit 70, 4 mit 80, 5 mit 60, 73 ausdruecklich ohne Zahl.

       Paragraf 21 Abs. 3 ImmoWertV: der Sachwertfaktor darf nur mit dem
       Modell verwendet werden, aus dem er abgeleitet wurde. Eine
       Restnutzungsdauer aus dem 80er-Rahmen in ein 70er-Modell zu stecken
       ist nicht modellkonform - der Faktor passt dann auf eine Rechnung,
       die es beim Ausschuss nie gab.

       Deshalb bekommt die Ableitung die GND jetzt mit. Sie leitet die
       Restnutzungsdauer im RICHTIGEN Rahmen NEU ab (Anlage 2, aus Baujahr
       und Modernisierungspunkten) - sie rechnet keine fertige Zahl um.
       Das ist der Unterschied, auf den es ankommt: eine Neuableitung ist
       eindeutig, eine Umrechnung waere eine Methodenwahl (34/80 auf 70
       ergibt je nach Weg 30 oder 24 Jahre - 19.000 Euro Unterschied an
       einem Reihenhaus). Diese Wahl trifft die Software nicht. */
    /* ── v1816 · DIE ABLEITUNG LIEGT JETZT IN EINEM EIGENEN MODUL ────────
     *
     * Hier stand sie als Closure — von außen nicht erreichbar. Das wurde
     * zum Problem, als die amtlichen Liegenschaftszinssätze angeschlossen
     * wurden: die Gutachterausschüsse staffeln sie nach Restnutzungsdauer
     * (Dresden `efh_frei_rnd36_55`, Leipzig `etw_altbau_rnd20_34`), und
     * der Zinssatz wird im Bericht VOR dem Sachwert geholt.
     *
     * Der bequeme Weg wäre gewesen, sie dort noch einmal abzuleiten.
     *
     *   > Zwei Ableitungen derselben Zahl laufen auseinander. Nicht heute,
     *   > nicht absichtlich — aber sie laufen auseinander, und dann steht
     *   > in einem Gutachten an zwei Stellen eine andere
     *   > Restnutzungsdauer.
     *
     * CLAUDE.md: „Eine Restnutzungsdauer für alle Verfahren." Jetzt
     * buchstäblich eine.
     *
     * NACHGEMESSEN vor dem Umbau: 147 Fälle (7 Baujahre × 7
     * Modernisierungsgrade × 3 Modernisierungsarten), Modul gegen diese
     * Closure — 147 mal dieselbe Zahl, 0 Abweichungen. */
    const _rndEinheitlich = (gndArg) => {
      const e = rndEinheitlich(ref, Number(gndArg) > 0 ? Number(gndArg) : GND_JAHRE);
      _rndHerkunft.gnd_jahre = e.gnd_jahre;
      /* Der Rückfall des Moduls rechnet dieselbe Schätzung; stimmt sie
         nicht mit der hier gebildeten überein, gilt die hier gebildete —
         sie ist die, mit der die übrigen Verfahren dieses Laufs rechnen. */
      const wert = (e.quelle === 'anlage2') ? e.rnd : rnd;
      return _rndMerke(e.quelle, e.grund, wert, e.hinweis);
    };
    /* v1338: Die GND, mit der der Sachwert rechnet. Vor dem ersten Lauf
       kennt niemand das Modell des Ausschusses - der Faktor wird erst
       geholt, wenn ein vorlaeufiger Sachwert dasteht. Der erste Lauf
       nimmt deshalb Anlage 1; findet der zweite Lauf ein Modell mit
       eigener GND, wird sie dort gesetzt und die Rechnung wiederholt. */
    let _gndSw = GND_JAHRE;
    let _gndModell = null;
    const _bgfWhg = Number((p && p.bgf_direkt) || ref.bgf || 0);

    const _nhkTypWhg = (u) => (u > 20 ? '4.3' : (u > 6 ? '4.2' : '4.1'));
    /* v2277 · Auch das MEHRFAMILIENHAUS bekommt seinen Typ aus der Zahl der
       Wohnungen (Anlage 4: 4.1 bis 6 WE, 4.2 bis 20, 4.3 darueber). Bis hier
       nur die Wohnung - beim MFH blieb nhk_typ leer, der Kern fand keinen
       Kennwert, und der Bericht fiel still auf den vereinfachten EFH-Weg
       (EFH-Kosten, Faktor 1,0, RND = GND - Alter). Gemessen an Bericht 216
       (Westerfeldstr. 140, 4 WE): Sachwert mit 21 Jahren, Ertragswert mit
       32,3 - zwei Restnutzungsdauern fuer ein Haus. Ohne Wohnungszahl kein
       Typ: geraten wird nicht. */
    const _istMfh = /mfh|mehrfamil/.test(_pt);
    /* v2383 · Nur beim MFH und nur mit den Angaben: Wohnflaeche je WE aus Wohnflaeche/Einheiten,
       Grundrissart aus dem Formular (einspaenner ... vierspaenner). Ohne Angabe Faktor 1,0. */
    const _mfhKorr = (_istMfh && Number(ref.units) > 0 && Number(wfl) > 0)
      ? { wohnflaeche_je_we: Math.round(Number(wfl) / Number(ref.units) * 10) / 10,
          grundriss: (p && p.grundriss) || ref.grundriss || null }
      : (_istMfh ? { grundriss: (p && p.grundriss) || ref.grundriss || null } : {});
    const _nhkTypAuto = () => ((istWohnung || (_istMfh && Number(ref.units) > 0))
      ? _nhkTypWhg(Number(ref.units || 0)) : null);
    /* v1099-WQL: der Weg zur Quelle, unabhaengig davon, ob ein Wert
       gefunden wird. Genau dann zaehlt er am meisten.

       v1614-WGRD · STAND BIS HIERHER EINE EBENE TIEFER - und damit
       INNERHALB des property_type-Deckels darunter. Fehlte der Objekttyp,
       wurde er nie berechnet; der Kunde verlor genau dann den Weg zur
       Quelle, wenn er die einzige Auskunft gewesen waere. Gemessen am
       26.09.2026 im Container an Starnberg ohne Objekttyp: kein Link.

       Er haengt deshalb jetzt an der Funktion, nicht am Rechenzweig. */
    let _swfQuelle = null;
    try {
      const _qa = (p && p.ags) || ref.ags || null;
      const _q = _qa ? quelleFuer(_qa) : null;
      if (_q) _swfQuelle = { quelle_link: { ..._q, satz: quellenSatz(_q, 'sachwertfaktor') } };
    } catch { _swfQuelle = null; }

    /* v2595 · derselbe Bodenwert wie im Ertragswert (v1198): liegt das gepruefte Ergebnis
       vor, gilt es - auch wenn es „kein Bodenwert" sagt (ETW ohne MEA); nur ohne geprueftes
       Ergebnis Grundstuecksflaeche × Bodenrichtwert. Bis v2594 bekam der Sachwert ohne
       `p.bodenwert` gar keinen Bodenwert und wies das Gebaeude als Sachwert aus. */
    const _bwSw = (p && p.bodenwert) || (bodenwert != null ? { vollstaendig: true, wert: bodenwert } : null);
    if (NHK_2010.geprueft && ref.property_type && (!istWohnung || _bgfWhg > 0)) {
      let _sw = nhkSachwert({   /* v1076-WLET-1 · weiter unten steht _sw = _sw2 */
        nhk_typ: (p && p.nhk_typ) || ref.nhk_typ
          || _nhkTypAuto(), keller_dg: (p && p.keller_dg) || ref.keller_dg,
        standardstufe: (p && p.standardstufe) || ref.standardstufe,
        bgf_direkt: (p && p.bgf_direkt) || ref.bgf, wohnflaeche_qm: wfl, objektart: ref.property_type,
        zweifamilienhaus: ref.zweifamilienhaus === true,   /* v1427b-ZFH */
        /* v2383 · Korrekturfaktoren NHK 2010 Anlage 4 fuer Mehrfamilienhaeuser (Wohnungsgroesse,
           Grundrissart) - der Kern konnte sie seit jeher, sie kamen nie an. */
        ..._mfhKorr,
        baupreisindex: BAUPREISINDEX, regionalfaktor: (p && p.regionalfaktor) || null,
        /* v1056-WRND-1 · Bisher bekam der Sachwert die alte Schaetzung,
         * waehrend der Ertragswert seit v1052 nach Anlage 2 rechnet: 38
         * gegen 49,6 Jahre fuer dasselbe Gebaeude. Zwei Alterswerte fuer
         * ein Haus sind in keinem Verfahren zu rechtfertigen; der Sachwert
         * lag dadurch rund 50.000 EUR zu niedrig. Liegen
         * Modernisierungspunkte vor, gilt Anlage 2 fuer BEIDE. */
        gnd_jahre: _gndSw, rnd_jahre: _rndEinheitlich(_gndSw),
        /* v1337: der Hinweis steht NACH rnd_jahre - _rndEinheitlich()
           setzt ihn, und Objektliterale werten in Quelltextreihenfolge
           aus. Umgekehrt waere er null. */
        rnd_hinweis: _rndHerkunft.hinweis,
        /* v1338: besondere objektspezifische Grundstuecksmerkmale und die
           Flagge, ob die Restnutzungsdauer sachverstaendig verkuerzt wurde.
           Beide kommen aus dem Payload; ohne sie kann nhk2010.js den
           Doppelabzug nicht melden. */
        bom_eur: (p && p.bom_eur) != null ? p.bom_eur : (ref.bom_eur != null ? ref.bom_eur : null),
        bom_grund: (p && p.bom_grund) || ref.bom_grund || null,
        bom_positionen: (p && p.bom_positionen) || ref.bom_positionen || null,
        rnd_verkuerzt: !!((p && p.rnd_verkuerzt) || ref.rnd_verkuerzt),
        streuung: null,
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
      }, _bwSw, (p && p.sachwertfaktor_param) || null);

      /* v1069-WSWF-2 · Der Sachwertfaktor haengt vom vorlaeufigen Sachwert
       * ab — er laesst sich nicht vorab aus einer Tabelle holen. Deshalb
       * zwei Laeufe: der erste liefert den vorlaeufigen Sachwert und die
       * Restnutzungsdauer, damit wird der Faktor nachgeschlagen, der zweite
       * rechnet mit ihm.
       *
       * Ein gepflegter Wert aus der Parametertabelle hat Vorrang: die
       * Tabelle ist kuratiert, die Matrix gilt fuer genau einen Kreis. */
      let _swfTab = null;
      /* v1144-SWFELD · Dieselbe Feldverwechslung wie in nhk2010.js:868.
       * Geprüft wurde `.sachwertfaktor`, geliefert wird `.wert` — die Weiche
       * stand deshalb IMMER auf Tabellenweg, auch wenn ein eigener Wert
       * gepflegt war. Folge: der Vorrang des kuratierten Werts (Kommentar
       * oben) hat nie gegriffen, und `sachwertfaktor_grund` meldete einen
       * Tabellen-Fehlschlag, obwohl gar nicht die Tabelle gefragt war. */
      const _swfEigen = Number(p && p.sachwertfaktor_param
        && (p.sachwertfaktor_param.wert != null
            ? p.sachwertfaktor_param.wert : p.sachwertfaktor_param.sachwertfaktor));
      if (!(_swfEigen > 0)
          && _sw && _sw.vorlaeufiger_sachwert_eur != null) {
        _swfTab = swfNachTabelle({
          ags: (p && p.ags) || ref.ags || null,
          sachwert_eur: _sw.vorlaeufiger_sachwert_eur,
          rnd_jahre: _sw.restnutzungsdauer_jahre,
          /* v2396 · DIE HAUSART, NICHT „haus". mapPropertyType fasst EFH, ZFH,
             DHH und RH zu „haus" zusammen, und dafuer fuehrt ZWEIG_VORZUG
             keinen Eintrag: jedes App-Haus ausserhalb eines Ausschussmoduls
             bekam objektart_nicht_abgeleitet — gemessen am 19.10.2026 an Essen
             (Register 1,33), Muenchen und Dresden. Der Subtyp steht seit
             v2359 im reportInput und wurde nur fuer die Umrechnung gelesen. */
          objektart: ref.property_subtype || ref.property_type,
          /* v1073-WGAA-2 · Herford braucht zwei weitere Groessen: die
           * Lagequalitaet ueber den Bodenrichtwert und die
           * Bruttogrundflaeche. Minden-Luebbecke ignoriert beide — der
           * Aufloeser reicht durch, das Modul nimmt sich, was es kennt.
           * Ohne diese zwei Zeilen bliebe der Herforder Faktor fuer immer
           * bei 'brw_fehlt'. */
          brw_eur_qm: (p && p.bodenwert && p.bodenwert.quelle && p.bodenwert.quelle.brw_sqm)
            || (p && p.brw_sqm) || ref.brw_sqm || null,
          bgf_qm: (p && p.bgf_direkt) || ref.bgf || null,
          /* v1101-WSTD - die Standardstufe wird zwei Zeilen weiter unten an
             nhkSachwert uebergeben, kam aber HIER nie an. Wolfenbuettel
             korrigiert den Faktor nach ihr um bis zu 21 Prozent,
             Teltow-Flaeming fuehrt je Stufe eigene Bodenrichtwertbaender.
             Ohne diese Zeile rechnete das eine still ohne Korrektur, das
             andere gar nicht - und beides saehe im Bericht gleich aus. */
          standardstufe: (p && p.standardstufe) || ref.standardstufe || null,
          /* v1102-WORT - ueber den Ortsnamen findet Barnim seine Region.
             Trifft kein Name, meldet der Auswerter 'kategorie_ohne_wert'
             und der Bericht sagt, dass er die Lage nicht zuordnen kann -
             eine von vier Funktionen zu raten waere schlimmer als nichts. */
          ort: (p && p.gemeinde) || ref.gemeinde || null,
          ortsteil: (p && p.ortsteil) || ref.ortsteil || null,
          /* v1624 · Die Gemarkung entscheidet ueber die LAGEKLASSE, wo ein
             Ausschuss danach staffelt. Sie kommt aus derselben
             BORIS-Antwort wie der Bodenrichtwert (ReportOrchestrator
             hebt sie auf `ref`). Ohne sie meldet der Auswerter
             `lage_noetig` und sagt, welche Lagen es gibt - eine geratene
             waere teurer als gar kein Wert. */
          gemarkung: (p && p.gemarkung) || ref.gemarkung || null,
          gemarkungsnr: (p && p.gemarkungsnr) || ref.gemarkungsnr || null,
          /* v1103-WWFL - Havelland, Berliner Umland: Grundstuecks- mal
             Wohnflaeche. Ohne diese Zeile bliebe die halbe Tabelle leer. */
          wohnflaeche_qm: ref.living_area || null,
          grundstuecksflaeche_qm: ref.plot_area || null,
          /* v1105-WMOD - Cottbus trennt unsaniert (MODG 0-6) von
             teilsaniert/saniert (ab 7). */
          unterkellerung: (p && p.keller_dg) || ref.keller_dg || null,
          mod_punkte: (p && p.mod_punkte) != null ? p.mod_punkte
            : (ref.mod_punkte != null ? ref.mod_punkte : null),



        });
        if (_swfTab && _swfTab.verfuegbar) {
          /* v1338: Fuehrt das Modell des Ausschusses eine eigene
             Gesamtnutzungsdauer, gilt SIE - sonst passt der Faktor auf
             eine Rechnung, die es beim Ausschuss nie gab (Paragraf 21
             Abs. 3). `null` ist eine Antwort, keine Luecke: dann druckt
             der Bericht keine Zahl, und die eines Nachbarkreises darf
             nicht einspringen. */
          const _mg = Number(_swfTab.modell_gnd_jahre);
          if (_mg > 0 && _mg !== GND_JAHRE) { _gndSw = _mg; _gndModell = _mg; }
          const _sw2 = nhkSachwert({

            nhk_typ: (p && p.nhk_typ) || ref.nhk_typ
              || _nhkTypAuto(),
            keller_dg: (p && p.keller_dg) || ref.keller_dg,
            standardstufe: (p && p.standardstufe) || ref.standardstufe,
            bgf_direkt: (p && p.bgf_direkt) || ref.bgf, wohnflaeche_qm: wfl,
            objektart: ref.property_type, baupreisindex: BAUPREISINDEX,
            zweifamilienhaus: ref.zweifamilienhaus === true,   /* v1427b-ZFH · zweiter Lauf */
            ..._mfhKorr,   /* v2383 · zweiter Lauf */
            regionalfaktor: (p && p.regionalfaktor) || null,
            gnd_jahre: _gndSw, rnd_jahre: _rndEinheitlich(_gndSw),
        /* v1337: der Hinweis steht NACH rnd_jahre - _rndEinheitlich()
           setzt ihn, und Objektliterale werten in Quelltextreihenfolge
           aus. Umgekehrt waere er null. */
        rnd_hinweis: _rndHerkunft.hinweis,
        /* v1338: besondere objektspezifische Grundstuecksmerkmale und die
           Flagge, ob die Restnutzungsdauer sachverstaendig verkuerzt wurde.
           Beide kommen aus dem Payload; ohne sie kann nhk2010.js den
           Doppelabzug nicht melden. */
        bom_eur: (p && p.bom_eur) != null ? p.bom_eur : (ref.bom_eur != null ? ref.bom_eur : null),
        bom_grund: (p && p.bom_grund) || ref.bom_grund || null,
        bom_positionen: (p && p.bom_positionen) || ref.bom_positionen || null,
        rnd_verkuerzt: !!((p && p.rnd_verkuerzt) || ref.rnd_verkuerzt),
        streuung: null,
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
          }, _bwSw, {
            sachwertfaktor: _swfTab.wert, stufe: _swfTab.stufe,
            quelle: _swfTab.quelle_text,
            /* v1338: die Streuung des Registersatzes - sie lag seit jeher
               in `satz.streuung` und war nur beim Liegenschaftszins
               durchgereicht. */
            streuung: _swfTab.streuung != null ? _swfTab.streuung : null,
          });
          /* Nur uebernehmen, wenn der zweite Lauf denselben vorlaeufigen
           * Sachwert liefert — sonst haette sich zwischen den Laeufen etwas
           * geaendert, und das waere ein Fehler, kein Ergebnis. */
          /* v1338: Die Gleichheitspruefung aus v1074 bleibt - sie faengt
             echte Abweichungen zwischen den Laeufen ab. Hat sich aber die
             Gesamtnutzungsdauer geaendert, IST der vorlaeufige Sachwert
             ein anderer, und zwar mit Absicht. Sonst haette die
             Sicherung ausgerechnet die modellkonforme Rechnung verworfen. */
          const _erwartetAbweichend = _gndModell != null;
          if (_sw2 && _sw2.wert != null
              && (_erwartetAbweichend
                  || _sw2.vorlaeufiger_sachwert_eur === _sw.vorlaeufiger_sachwert_eur)) {

            _sw = _sw2;
          } else {
            _swfTab = { verfuegbar: false, grund: 'zweiter_lauf_abweichend' };
          }
        }
      }

      if (_sw.wert != null) {
        out.sachwert = {
          /* v1083-WRND-2 · Die Herkunft der Restnutzungsdauer wandert mit
           * nach aussen. `quelle` ist 'anlage2' oder 'geschaetzt'; im zweiten
           * Fall steht in `hinweis`, warum — und der gehoert in den Bericht. */
          restnutzungsdauer_herkunft: _rndHerkunft,
          /* v1338: Womit gerechnet wurde und warum. Ohne diese drei
             Felder sieht niemand, ob die Zahl im Modell des Ausschusses
             steht oder aus Anlage 1 stammt. */
          gnd_jahre: _gndSw,
          gnd_quelle: _gndModell != null ? 'modell_gutachterausschuss' : 'anlage1_immowertv',
          gnd_hinweis: _gndModell != null
            ? ('Der Gutachterausschuss leitet seine Sachwertfaktoren mit einer '
               + 'Gesamtnutzungsdauer von ' + _gndModell + ' Jahren ab. Die Rechnung folgt '
               + 'diesem Modell, nicht Anlage 1 ImmoWertV (' + GND_JAHRE + ' Jahre) '
               + '\u2014 ein Faktor gilt nur f\u00fcr das Modell, aus dem er stammt (\u00a7 21 Abs. 3 ImmoWertV).')
            : ((_swfTab && _swfTab.modell_gnd_hinweis)
               || 'Gesamtnutzungsdauer nach Anlage 1 ImmoWertV. Der Gutachterausschuss '
                  + 'beziffert in seinem Modell keine eigene \u2014 der Wert eines anderen '
                  + 'Ausschusses wird nicht ersatzweise \u00fcbernommen.'),

          /* v1338: bOM und die Streuung wandern mit nach aussen. */
          bom_eur: _sw.bom_eur != null ? _sw.bom_eur : null,
          bom_grund: _sw.bom_grund || null,
          bom_positionen: _sw.bom_positionen || null,
          hinweise_sachwert: _sw.hinweise || null,
          available: true, value_eur: _sw.wert, staffel: _sw.staffel,
          marktangepasst: _sw.marktangepasst, sachwertfaktor: _sw.sachwertfaktor || null,
          /* v1069-WSWF-3 · Bleibt der Sachwert vorlaeufig, soll dastehen
           * WARUM. "ohne Sachwertfaktor" ist keine Begruendung, sondern eine
           * Feststellung — der Grund unterscheidet, ob der Ausschuss keinen
           * abgeleitet hat, ob das Objekt aus der Spanne faellt oder ob es
           * gar nicht sein Zustaendigkeitsbereich ist. */
          /* v1867 · Marcel: „default vielleicht 1,0 mit Hinweis ohne Marktanpassung".
           * Bleibt der Sachwert vorläufig, rechnet er faktisch mit 1,0 — das steht
           * jetzt als Zahl da, mit dem Grund, warum kein amtlicher Faktor greift
           * (§ 7 Abs. 2 ImmoWertV: ohne Faktor, wenn keine wesentliche
           * Marktabweichung zu erwarten ist — hier mangels Ableitung). */
          sachwertfaktor_standard: (!_sw.marktangepasst && !_sw.sachwertfaktor) ? 1.0 : null,
          sachwertfaktor_standard_grund: (!_sw.marktangepasst && !_sw.sachwertfaktor)
            ? ('Standardwert 1,0 — ohne Marktanpassung. '
               + ((_swfTab && !_swfTab.verfuegbar && _swfTab.hinweis) ? String(_swfTab.hinweis) + ' ' : '')
               + (/mehrfamilien|mfh|drei/i.test(String(ref.property_type || '')) || Number(ref.units) >= 3
                   ? 'Für Mehrfamilienhäuser ist der Ertragswert das Verfahren; der Sachwert dient nur der Plausibilität.'
                   : 'Der vorläufige Sachwert ist eine Herstellungskostenrechnung, kein Marktwert.'))
            : null,
          sachwertfaktor_grund: (_swfTab && !_swfTab.verfuegbar) ? _swfTab.grund : null,
          sachwertfaktor_hinweis: (_swfTab && !_swfTab.verfuegbar) ? (_swfTab.hinweis || null)
            : (_swfTab && _swfTab.verfuegbar ? _swfTab.hinweis : null),
          sachwertfaktor_stuetzstellen: (_swfTab && _swfTab.verfuegbar)
            ? _swfTab.stuetzstellen : null,
          /* v1073-WGAA-3 · Welcher Ausschuss den Faktor abgeleitet hat,
           * gehoert an die Zahl — sonst sieht ein Leser nicht, ob sie
           * ueberhaupt fuer seinen Ort gilt. */
          sachwertfaktor_ausschuss: (_swfTab && _swfTab.ausschuss) || null,
          /* v1099-WQL · Und der Weg dorthin, wo er steht. Gerade beim
           * Sachwertfaktor ist das haeufig die einzige Auskunft: 39 von 73
           * NRW-Gebieten haben keinen, und in den meisten Laendern fuehren
           * wir noch gar keinen. Ein Link ist dort mehr wert als ein
           * Grund-Code. */
          sachwertfaktor_quelle_link: (_swfQuelle && _swfQuelle.quelle_link) || null,
          /* v1107-WNACH - DER QUELLENVERMERK IST EINE RECHTLICHE AUFLAGE,
             keine Fussnote. Die Brandenburger Saetze stehen unter
             dl-de/by-2-0: Namensnennung ist PFLICHT, und ohne sie darf die
             Zahl in keinen Kundenbericht. Sie lag an jedem Registersatz und
             kam im Bericht nie an. */
          sachwertfaktor_quellenvermerk: (_swfTab && _swfTab.quellenvermerk) || null,
          sachwertfaktor_lizenz: (_swfTab && _swfTab.lizenz) || null,
          sachwertfaktor_quelle_url: (_swfTab && _swfTab.quelle_url) || null,

          /* ═══ v1402 · AUS WELCHEM JAHRGANG DIE ZAHL STAMMT ══════════════
             MARCELS ANSTOSS: „für bayern und rheinland-pfalz gibt es vlt
             alte berichte die umsonst sind aus 2025 oder 2024? dann könnte
             man diese verwenden und einen vermerk daran setzen."

             Der Vermerk fehlte. Der Registersatz trägt `stichtag`,
             `berichtsjahr` und `modellversion` seit jeher, und
             `gutachterausschuss.js` reicht sie auch heraus (Z. 492–494) —
             HIER endete der Weg. Der Kunde sah einen Sachwertfaktor, ohne
             zu erfahren, aus welchem Berichtsjahr er stammt.

             OHNE DIESE ANGABE IST EIN ÄLTERER JAHRGANG NICHT VERWENDBAR.
             § 10 ImmoWertV verlangt Modellkonformität zum
             Wertermittlungsstichtag; ein Faktor von 2014 an einem Stichtag
             2026 ist es nicht. Mit der Angabe wird er zu etwas anderem:
             einer belegten, datierten Auskunft, die der Anwender selbst
             einordnen kann. Genau das ist der Unterschied, den Marcels
             Vorschlag braucht.

             GEMESSEN am 15.09.2026 als Anlass: Bayern verkauft ältere
             Jahrgänge deutlich billiger (Straubing 2024 für 20 € gegen
             2026 für 60 €), Coburg gibt die Jahrgänge 2014 und 2016 sogar
             gebührenfrei ab. Über die 13 Berichte mit Sachwertfaktor
             gerechnet: 610 statt 725 €, wenn man auf den jeweils
             günstigsten Jahrgang ab 2022 geht. */
          sachwertfaktor_berichtsjahr: (_swfTab && _swfTab.berichtsjahr != null)
            ? _swfTab.berichtsjahr : null,
          sachwertfaktor_stichtag: (_swfTab && _swfTab.stichtag) || null,
          sachwertfaktor_modellversion: (_swfTab && _swfTab.modellversion) || null,
          /* Wie alt die Zahl im laufenden Jahr ist, in JAHREN. Nur die
             Messung, keine Bewertung — wer sie liest, entscheidet selbst.
             Bezug ist bewusst das laufende Jahr: `ref` trägt keinen
             Wertermittlungsstichtag, und eine ehrliche Näherung ist besser
             als ein Feld, das es nicht gibt. */
          sachwertfaktor_alter_jahre: (function () {
            const bj = Number(_swfTab && _swfTab.berichtsjahr);
            if (!Number.isFinite(bj) || bj < 1990) return null;
            return new Date().getFullYear() - bj;
          })(),

          sachwertfaktor_tabellenwert: (_swfTab && _swfTab.tabellenwert) || null,
          sachwertfaktor_korrekturen: (_swfTab && _swfTab.verfuegbar
            && (_swfTab.korrektur_rnd != null || _swfTab.korrektur_bgf != null))
            ? { rnd: _swfTab.korrektur_rnd, bgf: _swfTab.korrektur_bgf,
                nicht_korrigiert: _swfTab.nicht_korrigiert || null }
            : null,
          verfahren: _sw.verfahren,
          /* v1075-WHER-1 · Herkunft durchreichen: gewogene Stufe, Bauteile,
           * Garage, Aussenanlagen, Hinweise. Die Staffel kam an, ihr Weg
           * nicht — Zahlen ohne Herleitung sind im Dossier wertlos. */
          hinweise: (_sw.hinweise && _sw.hinweise.length) ? _sw.hinweise : null,
          ausstattung_gewogen: _sw.ausstattung_gewogen || null,
          bauteile_hk_eur: _sw.bauteile_hk_eur != null ? _sw.bauteile_hk_eur : null,
          bauteile_detail: _sw.bauteile_detail || null,
          garage: _sw.garage || null,
          aussenanlagen_eur: _sw.aussenanlagen_eur != null ? _sw.aussenanlagen_eur : null,
          aussenanlagen_herkunft: _sw.aussenanlagen_herkunft || null,
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
      } else if (_sw.grund_code === 'bodenwert_fehlt') {
        /* v2595 · ohne Bodenwert kein Sachwert - und auch kein Pauschalweg darunter,
           der dieselbe Luecke mit einer anderen Zahl fuellte. Der Rechenweg bleibt. */
        out.sachwert = { available: false, grund: _sw.grund, grund_code: 'bodenwert_fehlt',
          gebaeude_sachwert_eur: _sw.gebaeude_sachwert_eur ?? null, staffel: _sw.staffel };
        if (out.notes.indexOf(_sw.grund) < 0) out.notes.push(_sw.grund);
        _nhkFertig = true;
      } else {
        _nhkGrundFehlt = _sw.grund || null;   /* v2390 */
      }
    }

    const _typUnbekannt = !ref.property_type;
    /* v1839 · Gewerbe und Garage sind KEINE fehlende Angabe. Sie sind
       eine Angabe, für die dieser Dienst kein Verfahren hat. Der
       Unterschied ist für den Nutzer der ganze: beim einen soll er etwas
       ergänzen, beim anderen gibt es nichts zu ergänzen. */
    const _typ = String(ref.property_type || '').toLowerCase();
    const _gewerblich = (_typ === 'gewerbe' || _typ === 'garage');
    if (_nhkFertig) { /* WNHK-6: Sachwert steht bereits aus der NHK-Rechnung */ }
    else if (_gewerblich) {
      out.sachwert = { available: false,
        grund: _typ === 'garage'
          ? 'Garagen und Stellplätze werden in diesem Bericht nicht eigenständig '
            + 'bewertet — sie gehören als Zubehör zum Hauptobjekt.'
          : 'Für gewerblich genutzte Objekte führt dieser Bericht kein Verfahren. '
            + 'Die Normalherstellungskosten der Anlage 4 ImmoWertV, die hier '
            + 'hinterlegt sind, gelten für Wohnnutzung; eine Bewertung darüber '
            + 'wäre nicht modellkonform (§ 10 ImmoWertV).' };
      out.notes.push(_typ === 'garage'
        ? 'Sachwert nicht ausgewiesen: Garagen sind kein eigenständiges Bewertungsobjekt.'
        : 'Sachwert nicht ausgewiesen: gewerbliche Nutzung. Für Büro, Geschäftshaus, '
          + 'Hotel und sonstiges Gewerbe braucht es die gewerblichen NHK-Typen — '
          + 'die sind hier nicht hinterlegt.');
    }
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
            + 'Gemeinschaftsflächen). Brutto-Grundfläche (BGF) ergänzen, dann rechnet er.',   /* v2383: „führt ohnehin das Vergleichswertverfahren" stimmte bei ETW in Objekten bis 2 WE nicht */
      };
      out.notes.push(_bgfWhg > 0 ? out.sachwert.grund : 'Sachwert nicht ausgewiesen: Für eine Eigentumswohnung fehlt die Brutto-Grundfläche (BGF); eine Näherung aus der Wohnfläche wäre im Mehrfamilienhaus zu ungenau — lieber keine Zahl als eine falsche. Mit der BGF rechnet das Sachwertverfahren nach NHK 2010. Der Ertragswert bleibt.');   /* v2383 */
    } else if (_istMfh) {
      /* v2277 · Der vereinfachte Weg unten rechnet mit EFH-Kosten und dem
         EFH-Faustwert fuer die BGF - fuer ein Mehrfamilienhaus die falsche
         Grundlage. Lieber keine Zahl als eine falsche. */
      out.sachwert = { available: false,
        grund: 'Sachwert nicht ausgewiesen: für ein Mehrfamilienhaus bestimmt die Zahl der '
          + 'Wohnungen den NHK-Gebäudetyp (Anlage 4 ImmoWertV: 4.1 bis 6, 4.2 bis 20, 4.3 darüber). '
          + 'Wohnungszahl und Standardstufe ergänzen, dann rechnet er.' };
      out.notes.push('Sachwert nicht ausgewiesen: Mehrfamilienhaus ohne bestimmbaren NHK-Gebäudetyp.');
    } else if (wfl && buildYear) {
      /* v2277 · Auch dieser Weg rechnet mit DER Restnutzungsdauer des
         Berichts (Anlage 2, wenn Punkte vorliegen) - nicht mit GND - Alter. */
      try { const _rE = _rndEinheitlich(GND_JAHRE); if (Number(_rE) > 0) rnd = _rE; } catch (e) {}
      const bgf = wfl * BGF_FAKTOR;
      const hkNeubau = bgf * NHK_EFH_BGF * BAUPREISINDEX;
      const alterswertfaktor = rnd != null ? rnd / GND_JAHRE : null;
      const gebaeudeSachwert = alterswertfaktor != null ? hkNeubau * alterswertfaktor : null;
      /* ══ v2595 · OHNE BODENWERT KEIN SACHWERT (§ 35 Abs. 2 ImmoWertV) ══════
         Bis v2594 wies dieser Weg ohne Grundstuecksflaeche oder Bodenrichtwert den
         reinen Gebaeudewert als „Sachwert" aus (mit einer Notiz). § 35 Abs. 2: der
         vorlaeufige Sachwert ist die Summe aus baulichen Anlagen, Aussenanlagen UND
         Bodenwert - ohne ihn ist er nicht bestimmt. Gemessen am 21.10.2026 auf Staging:
         5 von 130 Berichten mit Sachwert (mb.market_reports, zuletzt 14.09.2026). */
      if (gebaeudeSachwert != null && bodenwert == null) {
        out.sachwert = { available: false, grund_code: 'bodenwert_fehlt',
          gebaeude_sachwert_eur: Math.round(gebaeudeSachwert),
          grund: 'Sachwert nicht ausgewiesen: der Bodenwert fehlt (Grundstücksfläche oder Bodenrichtwert). '
            + 'Der Sachwert besteht aus Gebäude UND Boden (§ 35 Abs. 2 ImmoWertV); ein reiner Gebäudewert ist keiner. '
            + 'Grundstücksfläche bzw. Bodenrichtwert ergänzen, dann rechnet er.' };
        out.notes.push(out.sachwert.grund);
      } else
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
        /* ══ v2390 · DER PAUSCHALWEG IST VORLAEUFIG ═══════════════════════
           835 €/m² BGF × Wohnfläche × 1,35 × Baupreisindex, Faktor 1,0: das
           ist weder ein NHK-Kennwert der richtigen Tabelle noch marktangepasst.
           Bis hier fehlte `vorlaeufig` - die Zahl zaehlte deshalb im Spread,
           in Min/Max und als „gerechnetes" fuehrendes Verfahren mit, obwohl
           der vorlaeufige NHK-Sachwert ohne Faktor laengst draussen blieb.
           Marcel 19.10.2026: raus aus Spread und Wahl, und sagen, was fehlt. */
        const _fehltSw = [];
        if (!((p && p.nhk_typ) || ref.nhk_typ)) _fehltSw.push('Gebäudetyp nach NHK 2010');
        if (!((p && p.standardstufe) || ref.standardstufe)) _fehltSw.push('Standardstufe');
        const _fehltTxt = _fehltSw.length ? _fehltSw.join(' und ')
          : (_nhkGrundFehlt ? String(_nhkGrundFehlt).replace(/\.$/, '') : 'ein Kostenkennwert der NHK 2010');
        Object.assign(out.sachwert, {
          vorlaeufig: true, pauschal: true,
          bezeichnung: 'vereinfachter Sachwert (Pauschalansatz), vorläufig',
          hinweis_kurz: 'Pauschalansatz ohne NHK-Kennwert und ohne Marktanpassung — kein Marktwert',
          fehlt: _fehltSw.length ? _fehltSw : null,
          grund_vorlaeufig: 'Vereinfachter Sachwert (Pauschalansatz 835 €/m² BGF, BGF aus der '
            + 'Wohnfläche genähert, Sachwertfaktor 1,0), vorläufig: der Sachwert nach NHK 2010 '
            + 'ließ sich nicht rechnen — es fehlt ' + _fehltTxt + '. Mit dieser Angabe rechnet '
            + 'das Sachwertverfahren; bis dahin bleibt diese Zahl aus Verfahrensvergleich '
            + 'und Verfahrenswahl heraus.',
        });
        out.notes.push(out.sachwert.grund_vorlaeufig);
        /* v2241 · Derselbe Grundsatz wie im NHK-Kern (nhk2010.js): bOM wirken
           NACH der Marktanpassung, und dieser Weg hat keine. Ohne den Satz
           saehe es aus, als waeren die Sanierungskosten vergessen worden. */
        const _bomS = Number(ref.bom_eur);
        if (ref.bom_eur != null && Number.isFinite(_bomS) && _bomS !== 0) {
          out.sachwert.bom_nicht_angesetzt_eur = Math.round(_bomS);
          out.notes.push('Die besonderen objektspezifischen Grundstücksmerkmale ('
            + Math.round(_bomS).toLocaleString('de-DE') + ' €) wirken im vorläufigen Sachwert nicht: '
            + 'sie werden nach der Marktanpassung angesetzt, und dieser Sachwert ist unangepasst.');
        }
        /* v955-etw: SACHWERTFAKTOR = 1.0 heisst "keine Marktanpassung", nicht
         * "Marktanpassung ergibt 1,0". Real liegt er je nach Lage bei 0,8-1,3.
         * Wer das nicht weiss, liest den Sachwert als Verkehrswert. */
        out.notes.push('Sachwertfaktor 1,0 angesetzt: Ohne Daten des örtlichen Gutachterausschusses erfolgt KEINE Marktanpassung. Reale Sachwertfaktoren liegen je nach Lage zwischen 0,8 und 1,3 – der ausgewiesene Sachwert ist deshalb unangepasst und weicht systematisch vom Verkehrswert ab.');
        if (!istHaus && !istWohnung) out.notes.push('Objektart nicht eindeutig – Sachwert mit EFH-Ansatz gerechnet. Bei Nicht-Wohnnutzung ist er nicht belastbar.');
      }

    }

    /* ── v1614-WGRD · DER WEG ZUR QUELLE UEBERLEBT DEN NICHTTREFFER ──
     *
     * `sachwertfaktor_quelle_link` wurde bis hierher NUR im Zweig
     * `_sw.wert != null` gesetzt. Fehlt aber der Objekttyp, die
     * Bruttogrundflaeche oder die Standardstufe, entsteht
     * `out.sachwert = { available:false, grund:… }` — und mit ihm
     * verschwand der Link, obwohl der zustaendige Ausschuss bekannt ist.
     *
     * Das war genau verkehrt herum: wo kein Wert steht, ist der Weg zur
     * Quelle die EINZIGE Auskunft, die wir geben koennen.
     *
     * Steht BEWUSST hier unten, ausserhalb des property_type-Deckels:
     * der erste Anlauf lag innerhalb und feuerte deshalb in genau den
     * Faellen nicht, fuer die er gebaut war. Eine Stelle fuer alle
     * Zweige, damit ein spaeter ergaenzter ihn nicht wieder verliert. */
    if (out.sachwert && !out.sachwert.sachwertfaktor_quelle_link
        && _swfQuelle && _swfQuelle.quelle_link) {
      out.sachwert.sachwertfaktor_quelle_link = _swfQuelle.quelle_link;
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
    const _refQm = _amtFuehrt ? p.amtliche_miete.miete_qm : rentSqm;
    /* ══ v2367 · DIE IST-MIETE, WENN SIE MARKTUEBLICH IST (§ 31 Abs. 2 ImmoWertV) ══
       Marcel 18.10.2026: „Ertragswert wird ja eigentlich immer mit der Ist-Miete
       berechnet" - § 31 Abs. 2 verlangt die MARKTUEBLICH erzielbaren Ertraege;
       eine Ist-Miete im marktueblichen Rahmen IST das, und die Liegenschaftszins-
       saetze der Ausschuesse sind aus Kauffaellen mit ihren tatsaechlichen Mieten
       abgeleitet (Bielefeld 2025: MFH Ø 7,70 €/m², Angebote 9,47) - § 10.
       Gemessen am 17.10.2026, Westerfeldstr. 140: Angebotsmiete 9,47 €/m² ergab
       810.000 €, die Ist-Miete 8,19 €/m² rund 726.000 € - der Kaufpreisschnitt
       des Ausschusses (1.820 €/m² x 390 m²) liegt bei 709.800 €.
       Rahmen: hoechstens 30 % unter oder ueber der Vergleichsmiete (amtlich,
       sonst Angebotsmedian). Ausserhalb gilt die Vergleichsmiete; die Ueber-
       oder Untervermietung ist ein besonderes objektspezifisches Merkmal
       (§ 8 Abs. 3) und wird benannt, nicht stillschweigend kapitalisiert. */
    const _wflIst = _num(ref.living_area);
    /* ══ v2520 · LEERSTAND: IST-MIETE NUR AUF DIE VERMIETETE FLAECHE ═══════
       Marcel 20.10.2026: der Rohertrag steht mit der marktueblich erzielbaren
       Miete fuer ALLE Einheiten (§ 31 Abs. 2 ImmoWertV). Die Ist-Miete gehoert
       deshalb nur auf die Flaeche, fuer die sie gezahlt wird, und wird dort gegen
       das Band geprueft; leere Einheiten gehen mit der Vergleichsmiete ein.
       Bis v2519 teilte der Kern die Ist-Miete durch die GESAMTE Wohnflaeche,
       die leere Wohnung eingeschlossen - gemessen am Demo-MFH (378 m², WE 5 mit
       68 m² leer): 5,99 statt 7,31 €/m², damit unter der unteren Bandkante und
       der Rohertrag rund 5.000 €/Jahr zu niedrig.
       Quelle: die MFH-Einheiten (DealPilotObjectMapper.leerstandAus, nur mit
       mindestens einer leeren UND einer vermieteten Wohnung, ohne Gewerbe).
       Ohne diese Angabe - oder ohne Vergleichsmiete fuer die leere Flaeche -
       rechnet alles wie bisher. Die Einheitenflaechen werden auf die
       Wohnflaeche des Objekts umgelegt, damit die Summe dieselbe bleibt. */
    const _lsR = (ref.leerstand && typeof ref.leerstand === 'object' && !(ref.gewerbe && _num(ref.gewerbe.wfl_gewerbe))
      && _num(ref.leerstand.wfl_leer) && _num(ref.leerstand.wfl_vermietet) && _num(ref.leerstand.ist_monat_vermietet)
      && _wflIst > 0 && _refQm > 0) ? ref.leerstand : null;
    const _ls = _lsR ? (function () {
      const f = _wflIst / (_lsR.wfl_leer + _lsR.wfl_vermietet);
      const wflV = Math.round(_lsR.wfl_vermietet * f * 100) / 100;
      return { wfl_vermietet: wflV, wfl_leer: Math.round((_wflIst - wflV) * 100) / 100,
               n_leer: _lsR.n_leer || null, n_vermietet: _lsR.n_vermietet || null,
               ist_monat_vermietet: _lsR.ist_monat_vermietet, flaeche_umgelegt: Math.abs(f - 1) > 0.005,
               leer_qm: Math.round(_refQm * 100) / 100 };
    })() : null;
    const _istQm = _ls
      ? Math.round(_ls.ist_monat_vermietet / _ls.wfl_vermietet * 100) / 100
      : ((!ref.vacancy && _num(ref.monthly_net_rent) > 0 && _wflIst > 0 && !(ref.gewerbe && _num(ref.gewerbe.wfl_gewerbe)))
        ? Math.round(_num(ref.monthly_net_rent) / _wflIst * 100) / 100 : null);
    /* ══ v2382 · DAS BAND DER MARKTUEBLICHKEIT (Marcel 19.10.2026) ═════════
       Die Mietpreisuebersicht bildet weitgehend BESTANDSmieten ab; marktueblich
       im Sinne von § 27 Abs. 1 / § 31 Abs. 2 ImmoWertV ist die bei
       Neuvermietung erzielbare Miete. Keine der beiden Quellen ist allein der
       Massstab. Band: untere Kante = min(amtlich, Angebot) x 0,7, obere Kante
       = max(amtlich, Angebot) x 1,3; fehlt eine Quelle, zaehlt die andere.
       Ist-Miete im Band -> Ist-Miete. Darueber/darunter -> die jeweilige
       Kante; der Mehr-/Minderertrag ist ein besonderes objektspezifisches
       Grundstuecksmerkmal (§ 8 Abs. 3), nur fuer die gesicherte Restlaufzeit
       des Vertrags. Bis v2381 lag der Rahmen bei ±30 % um EINE Zahl, und
       die Notiz nannte die Angebotsmiete „marktueblich". */
    const _amtQmBand = (p.amtliche_miete && p.amtliche_miete.verfuegbar && _num(p.amtliche_miete.miete_qm))
      ? _num(p.amtliche_miete.miete_qm) : null;
    const _angQmBand = rentSqm > 0 ? rentSqm : null;
    const _bandQ = [_amtQmBand, _angQmBand].filter((x) => x != null);
    const _band = _bandQ.length ? {
      unten_qm: Math.round(Math.min(..._bandQ) * 0.7 * 100) / 100,
      /* v2541 · obere Kante × 1,15 statt × 1,3 (Marcel 20.10.2026; Pruefbericht: 12,35 €/m² lag in Bielefeld 2,7σ ueber dem Ø der MFH-Kauffaelle 7,70 ± 1,70) */
      oben_qm: Math.round(Math.max(..._bandQ) * BAND_OBEN * 100) / 100, faktor_oben: BAND_OBEN,
      amtlich_qm: _amtQmBand, angebot_qm: _angQmBand != null ? Math.round(_angQmBand * 100) / 100 : null,
      regel: 'untere Kante = min(amtliche Vergleichsmiete, Angebotsmiete) × 0,7; obere Kante = max(…) × 1,15',
    } : null;
    const _mnb = mieteNachBand(_istQm, _band, _refQm);   /* v2488 · eine Regel, auch je Wohnung */
    const _istLage = _mnb.lage;
    const _istAbw = (_istQm != null && _refQm > 0) ? (_istQm / _refQm - 1) : null;
    const _istFuehrt = _mnb.fuehrt;
    const _kante = _mnb.kante;
    /* ══ v2540 · DIE BANDPRUEFUNG JE WOHNUNG (Marcel 20.10.2026: „ja") ══════
       ImmoWertA 31.2 a/b: die tatsaechlichen Ertraege gelten, wenn sie in der
       Bandbreite des Marktueblichen liegen - geprueft je Mietverhaeltnis, denn
       Mieterhoehungsmoeglichkeiten gibt es nur je Vertrag; eine Saldierung ueber
       das ganze Haus deckt der Text nicht. Bis v2539 pruefte der Kern die Ist-
       Miete des HAUSES: Demo-MFH WE 1 mit 6,18 €/m² unter der Kante 6,64, das
       Haus mit 7,31 im Band - die Wohnung blieb bei 6,18 (und PotenzialService
       verteilte die Differenz auf die leere Wohnung). Jetzt je Wohnung
       mieteNachBand auf ihre EIGENE Flaeche; Flaechen fuer den Rohertrag auf die
       Wohnflaeche des Objekts umgelegt (wie v2520); leere Wohnungen mit der
       Vergleichsmiete. Ohne Einheitenliste oder ohne Band: wie bisher. */
    const _ehR = (Array.isArray(ref.einheiten_miete) && ref.einheiten_miete.length >= 2 && !(ref.gewerbe && _num(ref.gewerbe.wfl_gewerbe))
      && _band && _refQm > 0 && _wflIst > 0) ? ref.einheiten_miete : null;
    const _je = _ehR ? (function () {
      const r2 = (x) => Math.round(x * 100) / 100;
      const sum = _ehR.reduce((a, e) => a + (Number(e.wfl) || 0), 0);
      if (!(sum > 0)) return null;
      const f = _wflIst / sum;
      const zeilen = _ehR.map((e) => {
        const fl = r2(Number(e.wfl) * f);
        if (e.leer || !(Number(e.ist_monat) > 0)) {
          return { nr: e.nr, wfl: fl, ist_qm: null, qm: r2(_refQm), herkunft: 'leer_marktueblich', jahr: Math.round(_refQm * fl * 12) };
        }
        const iq = r2(Number(e.ist_monat) / Number(e.wfl));
        const r = mieteNachBand(iq, _band, _refQm);
        /* v2541 · im Band die VERTRAGSMIETE selbst (× Flaechenfaktor), nicht die auf Cent
           gerundeten €/m² hochgerechnet - Westerfeld: 799 € / 97,5 m² = 8,1949 -> 8,19 ergab
           9.582 statt 9.588 €/Jahr je Wohnung (Pruefbericht 20.10.2026). Bandkante: qm × Flaeche. */
        return { nr: e.nr, wfl: fl, ist_qm: iq, qm: r2(r.qm),
                 jahr: r.fuehrt ? Math.round(Number(e.ist_monat) * 12 * f) : Math.round(r.qm * fl * 12),
                 herkunft: r.fuehrt ? 'ist_im_band' : (r.lage === 'ueber' ? 'obere_kante' : 'untere_kante') };
      });
      const v = zeilen.filter((z) => z.herkunft !== 'leer_marktueblich'), l = zeilen.filter((z) => z.herkunft === 'leer_marktueblich');
      const wflV = r2(v.reduce((a, z) => a + z.wfl, 0)), jV = v.reduce((a, z) => a + z.jahr, 0);
      return { zeilen, flaeche_umgelegt: Math.abs(f - 1) > 0.005, wfl_vermietet: wflV, jahr_vermietet: jV,
               qm_vermietet: wflV > 0 ? r2(jV / 12 / wflV) : null,
               wfl_leer: r2(l.reduce((a, z) => a + z.wfl, 0)), jahr_leer: l.reduce((a, z) => a + z.jahr, 0),
               n_vermietet: v.length, n_leer: l.length,
               angepasst: v.filter((z) => z.herkunft !== 'ist_im_band') };
    })() : null;
    const mieteQm = _je && _je.qm_vermietet ? _je.qm_vermietet : _mnb.qm;
    const mieteQuelle = _je
      ? ('Ist-Miete je Wohnung (marktüblich, § 31 Abs. 2 ImmoWertV), außerhalb des Bandes die Bandkante'
        + (_je.n_leer ? '; leere Wohnungen mit der Vergleichsmiete' : ''))
      : ((_istFuehrt ? 'Ist-Miete (marktüblich, § 31 Abs. 2 ImmoWertV)'
      : (_kante != null ? (_istLage === 'ueber' ? 'obere' : 'untere') + ' Kante des Marktüblichkeitsbandes'
        : (_amtFuehrt ? 'Mietpreisübersicht des Gutachterausschusses' : 'Angebotsmieten')))
      /* v2520 · bei Leerstand gilt die Zahl nur fuer die vermietete Flaeche */
      + (_ls ? ' auf der vermieteten Fläche; leere Fläche mit der Vergleichsmiete' : ''));
    if (_band) {
      _band.ist_qm = _istQm; _band.lage = _istLage;
      /* v2540 · geprueft je Wohnung: welche Wohnung an welche Kante (Bericht/PDF nennen sie) */
      if (_je) _band.je_wohnung = { n_vermietet: _je.n_vermietet,
        angepasst: _je.angepasst.map((z) => ({ nr: z.nr, ist_qm: z.ist_qm, qm: z.qm, herkunft: z.herkunft })) };
      out.miete_band = _band;
    }
    const _dq = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
    const _bandText = _band ? ('Band der Marktüblichkeit ' + _dq(_band.unten_qm) + ' bis ' + _dq(_band.oben_qm) + ' €/m² ('
      + [_band.amtlich_qm != null ? 'amtliche Vergleichsmiete ' + _dq(_band.amtlich_qm) + ' €/m²' : null,
        _band.angebot_qm != null ? 'Angebotsmiete ' + _dq(_band.angebot_qm) + ' €/m²' : null].filter(Boolean).join(', ')
      + '; untere Kante × 0,7, obere × 1,15)') : '';
    const _dqJ = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
    if (_je) {
      /* v2540 · je Wohnung: welche Wohnung an welche Kante, in einem Satz */
      out.notes.push('Die Ist-Mieten sind je Wohnung gegen das Band der Marktüblichkeit ('
        + _dqJ(_band.unten_qm) + ' bis ' + _dqJ(_band.oben_qm) + ' €/m²) geprüft (ImmoWertA 31.2: je Mietverhältnis). '
        + (_je.angepasst.length
          ? ((_je.angepasst.length > 2 && _je.angepasst.every((z) => z.qm === _je.angepasst[0].qm && z.ist_qm === _je.angepasst[0].ist_qm))
              ? _je.angepasst.length + ' Wohnungen mit ' + _dqJ(_je.angepasst[0].ist_qm) + ' €/m² ' + (_je.angepasst[0].herkunft === 'obere_kante' ? 'über' : 'unter')
                + ' dem Band, angesetzt ' + _dqJ(_je.angepasst[0].qm) + ' €/m²'
              : _je.angepasst.map((z) => z.nr + ' ' + _dqJ(z.ist_qm) + ' €/m² ' + (z.herkunft === 'obere_kante' ? 'über' : 'unter')
              + ' dem Band, angesetzt ' + _dqJ(z.qm) + ' €/m²').join('; '))
            + '. Der Mehr- oder Minderertrag ist nach § 8 Abs. 3 ImmoWertV nur für die gesicherte Restlaufzeit des Mietvertrags zu würdigen; ohne bekannte Laufzeit ist er nicht angesetzt.'
          : 'Alle vermieteten Wohnungen liegen im Band; der Ertragswert rechnet mit ihren Ist-Mieten.'));
    } else if (_istQm != null && _band) {
      out.notes.push(_istFuehrt
        ? ('Die Ist-Miete (' + _dq(_istQm) + ' €/m²) liegt im ' + _bandText + ' und gilt als marktüblich '
          + '(§ 31 Abs. 2 ImmoWertV); der Ertragswert rechnet mit ihr.')
        : ('Die Ist-Miete (' + _dq(_istQm) + ' €/m²) liegt ' + (_istLage === 'ueber' ? 'über' : 'unter') + ' dem '
          + _bandText + '. Der Ertragswert rechnet mit der ' + (_istLage === 'ueber' ? 'oberen' : 'unteren')
          + ' Kante (' + _dq(_kante) + ' €/m²). Der ' + (_istLage === 'ueber' ? 'Mehr' : 'Minder') + 'ertrag ist nach '
          + '§ 8 Abs. 3 ImmoWertV als besonderes objektspezifisches Grundstücksmerkmal zu würdigen — nur für die '
          + 'gesicherte Restlaufzeit des Mietvertrags; ohne bekannte Laufzeit ist er nicht angesetzt.'));
    }
    if (_ls) {
      out.notes.push('Leerstand: Die Ist-Miete (' + _dq(_ls.ist_monat_vermietet) + ' €/Monat) bezieht sich auf die vermietete Fläche von '
        + _dq(_ls.wfl_vermietet) + ' m²' + (_ls.n_vermietet ? ' (' + _ls.n_vermietet + ' Wohnung' + (_ls.n_vermietet === 1 ? '' : 'en') + ')' : '')
        + ' und ist dort gegen das Band geprüft. Die leere Fläche von ' + _dq(_ls.wfl_leer) + ' m²'
        + (_ls.n_leer ? ' (' + _ls.n_leer + ' Wohnung' + (_ls.n_leer === 1 ? '' : 'en') + ')' : '')
        + ' geht mit der marktüblichen Miete von ' + _dq(_ls.leer_qm) + ' €/m² in den Rohertrag ein (§ 31 Abs. 2 ImmoWertV, '
        + 'ImmoWertA 31.4: bei vorübergehendem Leerstand die marktüblich erzielbaren Erträge).'
        /* v2540 · recherchiert 20.10.2026: Mietausfall bis zur Wiedervermietung und
           Herrichtungskosten stehen nicht in ImmoWertV/ImmoWertA, sie sind
           Fachpraxis unter § 8 Abs. 3 - ohne Angabe keine Zahl, aber benannt */
        + ' Der Mietausfall bis zur Wiedervermietung und Kosten der Herrichtung sind als besonderes objektspezifisches '
        + 'Grundstücksmerkmal (§ 8 Abs. 3 ImmoWertV) zu würdigen; ohne Angabe zur Dauer sind sie nicht angesetzt.'
        + (_ls.flaeche_umgelegt ? ' Die Flächen der Einheiten sind auf die Wohnfläche des Objekts umgelegt.' : ''));
    }
    /* v1207-WMIE-2 · DER WIDERSPRUCH GEHOERT BENANNT, NICHT VERSTECKT.
     *
     * Marcel las im eigenen Bericht "4,89 EUR/m2" neben dem Ertragswert und
     * fragte, warum damit gerechnet werde, wo die Spanne bis zehn Euro reiche.
     * Gemessen im gespeicherten Bericht: es wird NICHT damit gerechnet.
     *   cross_check.ertragswert.miete_quelle = "Angebotsmieten"
     *   modellversion = "immowertv2021"  (nicht agvga_nrw_2016)
     *   Rohertrag 9.204 EUR / 12 / 100 m2 = 7,67 EUR/m2
     * Die 4,89 stehen als amtlicher VERGLEICHSWERT daneben — und weil die
     * Mietpreisuebersicht ihre eigene Ableitungskette mit Gleichheitszeichen
     * zeigt ("= marktueblich erzielbare Miete  4,89"), sieht der Vergleichswert
     * aus wie ein Rechenschritt. Ein Leser kann das nicht auseinanderhalten.
     *
     * Also: die beiden Zahlen nebeneinanderstellen, die Abweichung beziffern
     * und sagen, WARUM die eine fuehrt. Modellkonform (Paragraf 10 ImmoWertV)
     * waere die amtliche Miete nur, wenn auch der Liegenschaftszins aus
     * derselben Quelle stammt — genau das prueft `_amtFuehrt` oben.
     *
     * Der Vergleich entsteht NUR, wenn es wirklich zwei Zahlen gibt. Kein
     * amtlicher Wert, keine angesetzte Miete, oder beide gleich: null, und
     * das Dokument sagt nichts dazu. Wo die Quelle endet, endet die Rechnung. */
    const _amtQm = (p.amtliche_miete && p.amtliche_miete.verfuegbar)
      ? _num(p.amtliche_miete.miete_qm) : null;
    const _q25 = rent ? _num(rent.q25_per_sqm) : null;
    const _q75 = rent ? _num(rent.q75_per_sqm) : null;
    const mieteVergleich = (mieteQm != null && _amtQm != null
        && Math.abs(_amtQm - mieteQm) >= 0.01) ? {
      angesetzt_qm: mieteQm,
      angesetzt_quelle: mieteQuelle,
      amtlich_qm: _amtQm,
      /* Bezugsgroesse ist die ANGESETZTE Miete: "die amtliche liegt X % darunter". */
      abweichung_pct: Math.round((_amtQm - mieteQm) / mieteQm * 1000) / 10,
      spanne_q25: _q25, spanne_q75: _q75,
      ausserhalb_spanne: (_q25 != null && _q75 != null)
        ? (_amtQm < _q25 ? 'unterhalb' : (_amtQm > _q75 ? 'oberhalb' : null)) : null,
      amtlich_fuehrt: _amtFuehrt,
    } : null;
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

    /* ── v2210 · GEWERBE GETRENNT (§ 31 Abs. 2, Anlage 3 ImmoWertV) ────────
       Bis hier: Rohertrag = Wohnmiete/m2 x GESAMTE Flaeche x 12 - das
       Ladenlokal bekam den Wohnmietansatz, und `gewerbe_jahr` setzte kein
       Aufrufer. Jetzt aus den MFH-Einheiten (DealPilotObjectMapper.gewerbeAus):
       Wohnmiete nur auf den Wohnteil, Gewerbe mit marktueblicher Miete, sonst
       mit der Ist-Miete (gekennzeichnet, indikativ). Leerstehendes Gewerbe
       OHNE Marktmiete: kein Ertrag bestimmbar -> kein Ertragswert. */
    const _gew = (ref.gewerbe && _num(ref.gewerbe.wfl_gewerbe)) ? ref.gewerbe : null;
    const wflWohnen = _gew
      ? (_num(_gew.wfl_wohnen) || Math.max(0, (wfl || 0) - _gew.wfl_gewerbe))
      : wfl;
    let _gewJahr = null, _gewHerkunft = null;
    if (_gew) {
      if (_num(_gew.markt_jahr)) { _gewJahr = _gew.markt_jahr; _gewHerkunft = 'marktueblich'; }
      else if (!_gew.leer_ohne_markt && _num(_gew.ist_jahr)) { _gewJahr = _gew.ist_jahr; _gewHerkunft = 'ist_ungeprueft'; }
    }
    /* v2241 · Ist das GANZE Objekt gewerblich (Buero, Geschaeftshaus, Hotel,
       Gewerbe), rechnet unten ein eigener Zweig — nie die Wohnmiete auf die
       Nutzflaeche. Hier stand bis v2240 fuer jedes Gewerbeobjekt ohne
       MFH-Einheiten: Angebotsmiete WOHNEN x gesamte Flaeche x 12. */
    const _gewObjekt = istGewerbe(ref.property_type) || !!ref.gewerbe_art;
    const _gewSperre = !_gewObjekt && !!_gew && _gewJahr == null;
    if (_gewSperre) {
      out.notes.push('Ertragswert entfällt: Das Objekt hat ' + _gew.n_gewerbe + ' Gewerbeeinheit(en) mit '
        + Math.round(_gew.wfl_gewerbe) + ' m², aber für '
        + (_gew.leer_ohne_markt ? 'leerstehende Einheiten' : 'diese Einheiten')
        + ' liegt weder eine marktübliche Miete noch eine Ist-Miete vor (§ 31 Abs. 2 ImmoWertV). '
        + 'Im MFH-Konfigurator je Gewerbeeinheit die marktübliche Miete (€/m²) eintragen.');
    }

    /* v2595 · Leerstand ohne Vergleichsmiete (Begruendung unten am Ertragswert) */
    const _leerAngabe = !_gew && ((ref.leerstand && typeof ref.leerstand === 'object'
        && _num(ref.leerstand.wfl_leer) && _num(ref.leerstand.wfl_vermietet))
      || (Array.isArray(ref.einheiten_miete) && ref.einheiten_miete.some((e) => e && (e.leer || !(Number(e.ist_monat) > 0)))
        && ref.einheiten_miete.some((e) => e && !e.leer && Number(e.ist_monat) > 0)));
    const _leerOhneMarkt = !_gewObjekt && !_gewSperre && !!_leerAngabe && !(_refQm > 0);
    /* v2556 · Rechnet der Ertragswert nicht, sagt die Notiz WAS fehlt - bis hier
       hiess es nur „eine Pflichtangabe fehlt" (Bismarckstr., 21.10.2026). */
    if (!_gewObjekt && !_gewSperre && !_leerOhneMarkt) {   /* v2595: dort steht der genauere Grund */
      const _fehlt = [];
      if (!wfl) _fehlt.push('Wohnfläche');
      if (!(wflWohnen > 0)) _fehlt.push('Wohnfläche Wohnen');
      if (!mieteQm) _fehlt.push('Miete je m² (weder Ist-Miete noch Vergleichs- oder Angebotsmiete)');
      if (rnd == null) _fehlt.push('Restnutzungsdauer (Baujahr bzw. Modernisierung)');
      if (_fehlt.length) out.notes.push('Ertragswert nicht gerechnet: es fehlt ' + _fehlt.join(', ') + '.');
    }

    /* ══ v2595 · LEERSTAND OHNE JEDE VERGLEICHSMIETE: KEIN ERTRAGSWERT ═════
       Gutachterpruefung 21.10.2026 (Pruefstrecke B4b): ohne Angebots- und ohne
       amtliche Miete griff die Leerstandsregel v2520 nicht (sie braucht die
       Vergleichsmiete fuer die leere Flaeche), und der Kern teilte die Ist-Miete
       der vermieteten Wohnungen durch die GANZE Wohnflaeche - Demo-MFH 4,72 statt
       5,99 €/m², die leere Wohnung trug 0 €, und der Ertragswert erschien als
       „Ist-Miete (marktueblich)". § 31 Abs. 2 verlangt fuer die leere Flaeche die
       marktueblich erzielbare Miete; ohne sie ist der Rohertrag nicht bestimmbar.
       Kein Verfahren rechnet halb: der Ertragswert entfaellt, der Grund steht da. */
    if (_leerOhneMarkt) {
      const _nL = ref.leerstand && ref.leerstand.n_leer ? Number(ref.leerstand.n_leer) : null;
      out.notes.push('Ertragswert entfällt: ' + (_nL ? _nL + ' Wohnung' + (_nL === 1 ? ' steht' : 'en stehen') : 'Ein Teil der Wohnfläche steht')
        + ' leer, und für diesen Ort liegt weder eine Angebotsmiete noch eine amtliche Vergleichsmiete vor. '
        + 'Die leere Fläche geht nach § 31 Abs. 2 ImmoWertV mit der marktüblich erzielbaren Miete in den Rohertrag ein — '
        + 'ohne sie ist der Rohertrag nicht bestimmbar. Die Ist-Miete der vermieteten Wohnungen auf die ganze Fläche zu verteilen, '
        + 'würde den Wert zu niedrig ausweisen. Für die leeren Wohnungen die marktübliche Miete (€/m²) im MFH-Konfigurator eintragen, '
        + 'dann rechnet der Ertragswert.');
      out.ertragswert = { available: false, grund_code: 'leerstand_ohne_vergleichsmiete',
        grund: 'Leerstand ohne Vergleichsmiete — die leere Fläche ist nicht bewertbar, der Ertragswert entfällt (§ 31 Abs. 2 ImmoWertV).' };
    }

    if (!_gewObjekt && wfl && mieteQm && rnd != null && !_gewSperre && wflWohnen > 0 && !_leerOhneMarkt) {
      /* v1059-WMIET-6 · v2210: nur der Wohnteil */
      /* v2520 · bei Leerstand: vermietete Flaeche x gewaehlte Miete (Band) +
         leere Flaeche x Vergleichsmiete. Ohne Leerstandsangabe wie bisher. */
      /* v2540 · je Wohnung: dieselbe Form, die Zeilen der Wohnungen dabei */
      const _aufteilung = _je ? {
        wfl_vermietet: _je.wfl_vermietet, qm_vermietet: _je.qm_vermietet, jahr_vermietet: _je.jahr_vermietet,
        wfl_leer: _je.wfl_leer, qm_leer: Math.round(_refQm * 100) / 100, jahr_leer: _je.jahr_leer,
        n_vermietet: _je.n_vermietet, n_leer: _je.n_leer, herkunft_vermietet: 'je_wohnung',
        einheiten: _je.zeilen, flaeche_umgelegt: _je.flaeche_umgelegt,
      } : _ls ? {
        wfl_vermietet: _ls.wfl_vermietet, qm_vermietet: mieteQm,
        jahr_vermietet: Math.round(mieteQm * _ls.wfl_vermietet * 12),
        wfl_leer: _ls.wfl_leer, qm_leer: _ls.leer_qm,
        jahr_leer: Math.round(_ls.leer_qm * _ls.wfl_leer * 12),
        n_vermietet: _ls.n_vermietet, n_leer: _ls.n_leer,
        herkunft_vermietet: _istFuehrt ? 'ist_im_band' : (_istLage === 'ueber' ? 'obere_kante' : 'untere_kante'),
      } : null;
      const rohertrag = _aufteilung ? (_aufteilung.jahr_vermietet + _aufteilung.jahr_leer)
        : Math.round(mieteQm * wflWohnen * 12);
      const lzsPct = _num(p.lzs_pct) != null ? Number(p.lzs_pct) : LIEGENSCHAFTSZINS * 100;
      /* ── v1198 · „unvollstaendig" ist eine ENTSCHEIDUNG, kein Fehlen ──────
         Hier stand:

             const bwErgebnis = (p.bodenwert && p.bodenwert.vollstaendig)
               ? p.bodenwert
               : { vollstaendig: bodenwert != null, wert: bodenwert, ... };

         `p.bodenwert` kommt aus `ErtragswertService.bodenwert()`. Dort setzt
         der v1026-Schutz bei einer Eigentumswohnung OHNE Miteigentumsanteil
         ausdruecklich `wert = null` und `vollstaendig = false` und legt einen
         Hinweis dazu — mit der Begruendung „Lieber gar kein Bodenwert als ein
         zehnfach zu hoher."

         Der Rueckfall oben las dieses `vollstaendig: false` aber als „liegt
         nicht vor" und setzte an seine Stelle `bodenwert` aus Zeile 75 —
         `plot * brw`, also GENAU den vollen Grundstueckswert, den der Schutz
         gerade verworfen hatte. Und er meldete ihn als `vollstaendig: true`.

         GEMESSEN am 02.09.2026, Bericht 78, ETW 100 m2, MEA fehlte,
         Grundstueck 950 m2 zu 90 EUR/m2:

             = Reinertrag                                3.767 EUR
             - Bodenwertverzinsung (85.500 EUR x 2,2 %) -1.881 EUR   <- halber Reinertrag
             = Gebaeudereinertrag                        1.886 EUR
             = Gebaeudeertragswert                      25.216 EUR
             + Bodenwert                                85.500 EUR   <- volles Grundstueck
             = vorlaeufiger Ertragswert                110.716 EUR

         Derselbe Bericht fuehrte daneben `cross_check.bodenwert.wert = null`
         mit dem Hinweis, der Bodenwert bleibe „hier aussen vor". Zwei
         Rechnungen derselben Groesse in einem Bericht, und der Ertragswert
         nahm die ungeschuetzte.

         JETZT: liegt `p.bodenwert` ueberhaupt vor, gilt es — auch und gerade
         dann, wenn es „nichts" sagt. Der Rueckfall greift nur noch, wenn gar
         kein geprueftes Ergebnis existiert (kein `_wertParams`).
         `ErtragswertService` faengt das sauber ab: `hatBw` wird false, und es
         rechnet das vereinfachte Ertragswertverfahren ohne Bodenwerttrennung
         samt Warnung — der Weg, den FIX-OHNEBW dort ausdruecklich vorsieht. */
      const bwErgebnis = p.bodenwert
        ? p.bodenwert
        : { vollstaendig: bodenwert != null, wert: bodenwert,
            quelle: { brw_sqm: brw, herkunft: brw ? ErtragswertService.brwHerkunft(landValue) : 'manuell' } };   /* v2390 */

      const ein = {
        objektart: ref.property_type, baujahr: buildYear, baustatus: ref.baustatus || 'bestand',
        /* v2210: Wohnflaeche und Einheiten nur des WOHNteils - Verwaltung je
           Wohnung und Instandhaltung je m2 Wohnflaeche gelten nur dort. */
        wohnflaeche_qm: wflWohnen,
        anzahl_we: _gew ? (_num(_gew.n_wohnen) || Math.max(1, (_num(ref.units) || 1) - _gew.n_gewerbe)) : (_num(ref.units) || 1),
        stichtag_jahr: nowYear,
        miete_markt_jahr: rohertrag,
        gewerbe_jahr: _gewJahr,
        gewerbe_herkunft: _gewHerkunft,
        gewerbe_ist_jahr: _gew ? _num(_gew.ist_jahr) : null,
        gewerbe_flaechen: _gew ? _gew.flaechen : null,
        gewerbe_ohne_nutzung_qm: _gew ? _num(_gew.ohne_nutzung_qm) : null,
        miete_markt_qm: mieteQm, miete_quelle: mieteQuelle,   /* v1059-WMIET-7 */
        miete_aufteilung: _aufteilung,   /* v2520 · vermietet/leer im Rechenweg */
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
        /* v2541 · ohne Punkte die RND nach Anlage 2 mit 0 Punkten (rndEinheitlich) statt der
           linearen Schaetzung `rnd` - gemessen: Herkunft sagte 18 J. (Anlage 2), gerechnet wurde 16 */
        rnd_jahre: (_num(ref.mod_punkte) != null ? null : (function () { try { const r = _rndEinheitlich(GND_JAHRE); return Number(r) > 0 ? Number(r) : rnd; } catch (e) { return rnd; } })()),
        /* v1057-WSON-7 */
        sonstige_jahr: _num(ref.sonstige_jahr),
        zusatz_jahr: _num(ref.zusatz_ertrag_jahr),   /* v2382 · Stellplatz/Garage aus `ze`, IM Rohertrag */
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
        /* v2390 · Ebene in Klartext fuer die Belastbarkeit (C ist nicht „marktabgeleitet") */
        lzs_herkunft: p.lzs_zins_herkunft
          ? { ebene: p.lzs_zins_herkunft.ebene, etikett: p.lzs_zins_herkunft.etikett } : null,
        /* v1083b-WSTU-7 · DAS FEHLENDE GLIED. Der Orchestrator setzt
         * lzs_herabgestuft seit v1050 — der CrossCheckService reichte es nie
         * durch. Der Ertragswert bekam also nur DASS der Wert auf B steht,
         * nie WARUM, und der Abzugstext blieb zwangslaeufig der pauschale.
         * Nach der Variable suchen, die angeblich gefuellt ist. */
        lzs_herabgestuft: !!p.lzs_herabgestuft,
        lzs_streuung_pp: p.lzs_streuung_pp != null ? p.lzs_streuung_pp : null,
        lzs_massstab: p.lzs_massstab || null,
        /* === v1338d - `_num` VERWIRFT JEDE NEGATIVE ZAHL ===============
           `const _num = (v) => Number.isFinite(n) && n > 0 ? n : null` - der
           Helfer heisst 'Zahl' und bedeutet 'Zahl groesser null'. Fuer
           Flaechen und Mieten ist das richtig. Fuer `bog_eur` ist es toedlich:
           besondere objektspezifische Grundstuecksmerkmale sind fast immer
           ein ABZUG, also negativ. `_num(-18000)` gab null.

           GEMESSEN am Bericht 116 (12.09.2026): `bog_eur: -18000` stand im
           ref, kam durch den ganzen Orchestrator bis hierher - und wurde in
           dieser einen Zeile stillschweigend zu null. Die Ertragswert-Staffel
           endete beim vorlaeufigen Ertragswert, ohne ein Wort dazu.

           Das Feld gibt es seit WPDF12; es hat also NIE funktioniert, ausser
           bei einem Zuschlag. Aufgefallen ist es erst, als v1338 ein
           Eingabefeld dafuer bekam - vorher konnte es niemand fuellen. */
        bog_eur: (function () {
          const n = Number(p.bog_eur);
          return Number.isFinite(n) && n !== 0 ? n : null;
        })(),
        bog_grund: p.bog_grund || null,
      };
      /* v1048-WMOD-3 */
      const _hatModell = ['agvga_nrw_2016'].indexOf(String(p.modellversion || '')) >= 0;
      /* v1049-WBWK-3 · Hat der Ausschuss seine eigene Quote veroeffentlicht,
       * ist sie der genaueste Ansatz — genauer als jeder Modellwert, weil
       * sie aus denselben Kauffaellen stammt wie der Zinssatz. */
      /* v2210 · Eine Wohn-Quote auf Gewerbe ist nicht modellkonform: mit
         Gewerbe gilt Anlage 3 je Nutzung (normiert), weder Ausschuss-Quote
         des Wohnzweigs noch die 23-%-Pauschale. */
      const _quote = _gew ? null : _num(p.bwk_quote_pct);
      if (_gew) {
        const _g = Math.round(_gewJahr / (rohertrag + _gewJahr) * 1000) / 10;
        out.gewerbeanteil_pct = _g;
        out.notes.push('Gemischte Nutzung: Gewerbe ' + String(_g).replace('.', ',') + ' % des Rohertrags ('
          + Math.round(_gewJahr).toLocaleString('de-DE') + ' € von '
          + Math.round(rohertrag + _gewJahr).toLocaleString('de-DE') + ' €). Wohnen und Gewerbe sind getrennt angesetzt, '
          + 'die Bewirtschaftung nach Anlage 3 je Nutzung.'
          + (_gewHerkunft === 'ist_ungeprueft'
            ? ' Gewerbemiete = Ist-Miete, nicht auf Marktüblichkeit geprüft (§ 31 Abs. 2 ImmoWertV) — der Ertragswert ist deshalb indikativ.'
            : ' Gewerbemiete = eingegebene marktübliche Miete.')
          + (_g > 20
            ? ' Ab rund 20 % Gewerbeanteil führen die Gutachterausschüsse meist einen eigenen Liegenschaftszinssatz für Wohn- und Geschäftshäuser; '
              + 'der angesetzte Satz ist darauf zu prüfen.'
            : ''));
        if (_gewHerkunft === 'marktueblich' && _num(_gew.ist_jahr)) {
          const _abw = Math.round((_gew.ist_jahr - _gewJahr) / _gewJahr * 1000) / 10;
          if (Math.abs(_abw) >= 10) out.notes.push('Gewerbe: Ist-Miete weicht ' + String(_abw).replace('.', ',')
            + ' % von der marktüblichen ab — als besonderes objektspezifisches Grundstücksmerkmal (§ 8 Abs. 3) über die Restlaufzeit des Mietvertrags zu prüfen.');
        }
      }
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
        /* v2382 · `ze` (Stellplatz/Garage etc.) ersetzt die Stueckrechnung - beides waere doppelt. */
        const _spEinnahme = _num(ref.zusatz_ertrag_jahr) || ((_num(p.stellplatz_miete_monat) || 0)
          * ((_num(ref.garages) || 0) + (_num(ref.outdoor_parking) || 0)) * 12);
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
      if (!_hatModell && p.bwk_modus !== 'normiert' && !_gew) {
        ein.bwk_modus = 'manuell';
        ein.bwk_gesamt_jahr = Math.round(rohertrag * BWK_QUOTE);
      } else {
        ein.bwk_modus = 'normiert';
        ein.bwk_verwaltung_je_we = _num(p.bwk_verwaltung_je_we);
        ein.bwk_instandhaltung_je_qm = _num(p.bwk_instandhaltung_je_qm);
        ein.bwk_mietausfall_pct = _num(p.bwk_mietausfall_pct);
        ein.bwk_betrieb_nul_jahr = _num(p.bwk_betrieb_nul_jahr);
      }

      /* ══ v2390 · DIE GND DES ZINSSATZ-MODELLS ══════════════════════════
         Der Ertragswert nahm die Gesamtnutzungsdauer immer nach Anlage 1
         (`gnd(objektart)` im Kern) - die GND des Registersatzes, dessen Zins
         er nutzt, kam nie an (GAA lieferte `modell` statt `modellansaetze`,
         der Orchestrator reichte nichts durch). § 10 ImmoWertV: der Zins gilt
         nur im Modell, aus dem er abgeleitet wurde.
         Wie beim Sachwert seit v1338 wird die Restnutzungsdauer im RICHTIGEN
         Rahmen NEU abgeleitet (Anlage 2 aus Baujahr und Punkten, sonst die
         Schaetzung im selben Rahmen) - keine fertige Zahl umgerechnet. Mit
         Punkten leitet der Kern selbst ab (rnd_jahre bleibt null). */
      const _gndLzs = _num(p.lzs_gnd_jahre);
      let _gndEwQuelle = 'anlage1_immowertv';
      if (_gndLzs) {
        ein.gnd_jahre = _gndLzs;
        _gndEwQuelle = 'modell_liegenschaftszins';
        if (ein.rnd_jahre != null) {
          try {
            const _eL = rndEinheitlich(ref, _gndLzs);
            if (_eL && Number(_eL.rnd) > 0) ein.rnd_jahre = Number(_eL.rnd);
          } catch (e) { /* bleibt bei der Schaetzung des Berichts */ }
        }
      }

      const kern = ErtragswertService.ertragswert(ein, bwErgebnis);
      out.ertragswert_kern = kern;
      /* v2430 · Die Eingabe des Kerns reist NICHT AUFZAEHLBAR mit: sie geht in
         keinen Bericht und kein JSON, steht aber dem Nur-Wert-Lauf (POST /potenzial)
         zur Verfuegung. Dort rechnet derselbe Kern mit getauschter Miete und RND -
         keine zweite Aufbereitung derselben Eingabe. */
      try {
        Object.defineProperty(out, '_ertragswertEingabe', { enumerable: false, configurable: true, writable: true,
          value: { ein: Object.assign({}, ein), bodenwert: bwErgebnis, wohnflaeche_wohnen: wflWohnen,
                   miete_qm: mieteQm, miete_quelle: mieteQuelle || null, gnd_quelle: _gndEwQuelle,
                   /* v2488 · Band und Vergleichsmiete fuer die Bestandsbasis je Wohnung */
                   miete_band: _band || null, markt_qm: _refQm > 0 ? _refQm : null,
                   /* v2520 · der Bestand trennt vermietete und leere Flaeche */
                   miete_aufteilung: _aufteilung } });
      } catch (e) { /* nur Zusatz */ }

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
        /* ══ v2595 · MODELLPRUEFUNG DES VERWENDETEN ZINSSATZES (lib/modellpruefung.js) ══
           Nach der Zinswahl und dem Kern: Ø Miete, Ø RND und Ø Objektgroesse des Satzes
           gegen das, was dieser Ertragswert TATSAECHLICH ansetzt - die Miete als Wohn-
           Rohertrag / 12 / Wohnflaeche Wohnen (bei Leerstand und je Wohnung also der
           Mittelwert ueber alle Flaechen), die RND des Kerns, die Wohnflaeche des Objekts.
           Der Wert bleibt; Belastbarkeit, miete_modellkonform und der Hinweis folgen. */
        const _mp = pruefeModell(p.lzs_modellansaetze || null, {
          miete_qm: wflWohnen > 0 ? Math.round(rohertrag / 12 / wflWohnen * 100) / 100 : null,
          rnd_jahre: kern.nutzungsdauer ? kern.nutzungsdauer.rnd : rnd,
          flaeche_qm: wfl,
        }, { ausschuss: p.lzs_ausschuss || null, berichtsjahr: p.lzs_berichtsjahr || null, zweig: p.lzs_zweig || null,
             amtliche_miete_fuehrt: !!_amtFuehrt });
        const _mk = mieteModellkonform(_mp);
        kern.belastbarkeit = ErtragswertService.belastbarkeitMitModell(kern.belastbarkeit, _mp);
        out.ertragswert = {
          available: true,
          rohertrag_pa_eur: hol('= Rohertrag'),
          bwk_pa_eur: Math.abs(hol('Bewirtschaftungskosten') || 0),
          reinertrag_pa_eur: hol('= Reinertrag'),
          liegenschaftszins_pct: kern.lzs ? kern.lzs.pct : lzsPct,
          liegenschaftszins_stufe: kern.lzs ? kern.lzs.stufe : null,
          /* v2381 · Rueckfall: der Ausschuss fuehrt einen Satz, er liess sich aber nicht
             objektgenau zuordnen oder gilt hier nicht - das ist nie „amtlich". */
          liegenschaftszins_rueckfall: !!(p.lzs_rueckfrage && !p.lzs_aus_register),
          liegenschaftszins_ausserhalb_geltung: !!(p.lzs_rueckfrage && p.lzs_rueckfrage.grund === 'ausserhalb_geltung'),
          /* v1050-WSTR-2 · Ohne diese vier Zeilen bleibt die Spanne im PDF
           * leer — die Kaskade kennt sie, die Karte sah sie nie. */
          streuung_pct: _num(p.lzs_streuung_pct),
          liegenschaftszins_min: _num(p.lzs_min),
          liegenschaftszins_max: _num(p.lzs_max),
          liegenschaftszins_herabgestuft: !!p.lzs_herabgestuft,
          liegenschaftszins_quelle: kern.lzs ? kern.lzs.quelle : null,
          /* v1099-WQL · DER WEG ZUR QUELLE GEHOERT AN DEN WERT.
           *
           * Marcels Vorgabe: der Kunde soll sehen, wer die Zahl fuehrt und
           * wo er sie selbst holen kann - auch und GERADE dann, wenn wir
           * keine liefern. Ein Bericht, der "kein Wert hinterlegt" sagt und
           * den Nutzer damit allein laesst, ist schlechter als einer, der
           * den zustaendigen Ausschuss beim Namen nennt.
           *
           * WertParameterService haengt das Feld an jede Antwort; hier geht
           * es nur weiter. */
          /* v2390 · `kern.lzs` fuehrt kein quelle_link (ErtragswertService
             setzt nur pct/quelle/stufe) - das Feld war deshalb IMMER null,
             und der Link im PDF-Zinskasten erschien nie. */
          liegenschaftszins_quelle_link: p.lzs_quelle_link || (kern.lzs ? (kern.lzs.quelle_link || null) : null),
          /* v1107-WNACH - derselbe Grund wie beim Sachwertfaktor. */
          liegenschaftszins_quellenvermerk: kern.lzs ? (kern.lzs.quellenvermerk || kern.lzs.quelle || null) : null,
          liegenschaftszins_lizenz: kern.lzs ? (kern.lzs.lizenz || null) : null,
          liegenschaftszins_quelle_url: kern.lzs ? (kern.lzs.quelle_url || null) : null,

          /* v1071-WMIE-1 · mieteQuelle wird seit v1059 bestimmt und war
           * nirgends sichtbar. Bei Loehner Strasse 278 war KEINE Miete
           * erfasst — der Rohertrag von 27.065 EUR stammt vollstaendig aus
           * Portalangeboten fuer Wohnungen, angewandt auf ein 233-m2-Haus,
           * und ergab einen Ertragswert von 496.000 EUR neben einem
           * fuehrenden Sachwert von 287.433 EUR. Wer drei Zahlen sieht, muss
           * erkennen koennen, welche auf Angaben beruht. */
          miete_quelle: mieteQuelle,
          miete_erfasst: !!(p && p.ist_miete_erfasst),
          /* v2595 · bis v2594 „modellkonform", sobald die Ist-Miete im Band lag (oder die
             Mietpreisuebersicht fuehrte). Das Band prueft die Marktueblichkeit, nicht ob der
             Zins zu dieser Miete passt. Jetzt: true nur, wenn die Modellpruefung „im_modell"
             ergibt; false mit Grund; null, wenn der Satz keine Ø Miete fuehrt. */
          /* v2595 · Herkunft der Miete als Code (Pilot-Tafel, Ursachen der Differenz):
             je_wohnung | ist_im_band | obere_kante | untere_kante | amtlich | angebot */
          miete_herkunft: (function () {
            const z = _je ? _je.zeilen : null;
            const n = (h) => (z ? z.filter((x) => x.herkunft === h).length : 0);
            const code = _je ? 'je_wohnung' : _istFuehrt ? 'ist_im_band'
              : (_kante != null ? (_istLage === 'ueber' ? 'obere_kante' : 'untere_kante') : (_amtFuehrt ? 'amtlich' : 'angebot'));
            return { code, vergleich: _amtFuehrt ? 'amtlich' : (_refQm > 0 ? 'angebot' : null),
                     vergleich_qm: _refQm > 0 ? Math.round(_refQm * 100) / 100 : null,
                     n_band: n('ist_im_band'), n_oben: n('obere_kante'), n_unten: n('untere_kante'),
                     n_leer: _je ? n('leer_marktueblich') : (_ls ? (_ls.n_leer || null) : 0),
                     wfl_leer: _je ? _je.wfl_leer : (_ls ? _ls.wfl_leer : null),
                     angesetzt_qm: wflWohnen > 0 ? Math.round(rohertrag / 12 / wflWohnen * 100) / 100 : null };
          })(),
          miete_modellkonform: _mk.wert,
          miete_modellkonform_grund: _mk.grund,
          modellpruefung: _mp,
          miete_ist_qm: _istQm, miete_vergleich_qm: _refQm != null ? Math.round(_refQm * 100) / 100 : null,
          miete_band: _band || null,   /* v2382 · beide Vergleichswerte und das Band */
          miete_aufteilung: _aufteilung,   /* v2520 · vermietete/leere Flaeche */
          /* v1207-WMIE-2 · die angesetzte Miete war nirgends als Zahl sichtbar,
           * nur als Quellenname. Ohne sie kann das Dokument den Vergleich mit
           * dem amtlichen Wert nicht ausschreiben, ohne ihn neu herzuleiten —
           * und Zahlen, die an zwei Stellen entstehen, laufen auseinander. */
          miete_qm: mieteQm,
          miete_vergleich: mieteVergleich,
          /* v1063-WOD-8 · dritte Station der Kette */
          liegenschaftszins_einordnung: p.lzs_einordnung || null,
          restnutzungsdauer_jahre: kern.nutzungsdauer ? kern.nutzungsdauer.rnd : rnd,
          gesamtnutzungsdauer_jahre: kern.nutzungsdauer ? kern.nutzungsdauer.gnd : null,   /* v2382 */
          /* v2390 · woher die GND des Ertragswerts kommt */
          gnd_quelle: _gndEwQuelle,
          gnd_hinweis: _gndLzs
            ? 'Gesamtnutzungsdauer ' + _gndLzs + ' Jahre aus dem Modell des Liegenschaftszinssatzes'
              + (p.lzs_ausschuss ? ' (' + p.lzs_ausschuss + ')' : '') + ' — die Restnutzungsdauer '
              + 'ist in diesem Rahmen neu abgeleitet (§ 10 ImmoWertV).'
            : null,
          /* v2390 · Ebene des Zinses in Klartext, Weg zum oertlichen Satz */
          liegenschaftszins_herkunft: p.lzs_zins_herkunft || null,
          /* v2401 · Stufe N: die Formel mit Datenbasis und Rechenweg; bei D der Grund ohne Formel */
          liegenschaftszins_formel: p.lzs_formel || null,
          liegenschaftszins_formel_hinweis: p.lzs_stufe === 'N' ? (p.lzs_hinweis || null) : null,
          liegenschaftszins_formel_nicht: p.lzs_formel_nicht || null,
          indikativ_wegen_zins: !!(p.lzs_zins_herkunft && p.lzs_zins_herkunft.unter_a),
          bwk_aus_zinssatz: !!p.bwk_quote_aus_lzs_satz,
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
        /* v2595 · die Modellpruefung als Satz im Bericht - nur wenn etwas abweicht */
        if (_mp.geprueft && _mp.abweichend.length) out.notes.push('Modellprüfung des Liegenschaftszinses: ' + _mp.text);
        /* v2390 · Zins unter A: Ertragswert insoweit indikativ, und der Weg */
        const _zh = p.lzs_zins_herkunft;
        if (_zh && _zh.unter_a && _zh.ertragswert_hinweis) {
          out.notes.push(_zh.ertragswert_hinweis + (_zh.weg && _zh.weg.text ? ' ' + _zh.weg.text : '')
            + (_zh.weg && _zh.weg.url ? ' Quelle: ' + _zh.weg.url : ''));
        }
        /* v2401 · N nennt seinen Rechenweg; D sagt, warum es keine DealPilot-Formel wurde
           (Ausschuss fuehrt einen Satz oder hat gesperrt, Land gemessen nicht besser, RND ausserhalb). */
        if (p.lzs_stufe === 'N' && p.lzs_hinweis && out.notes.indexOf(p.lzs_hinweis) < 0) out.notes.push(p.lzs_hinweis);
        if (p.lzs_stufe === 'D' && p.lzs_formel_nicht && p.lzs_formel_nicht.hinweis
            && out.notes.indexOf(p.lzs_formel_nicht.hinweis) < 0) out.notes.push(p.lzs_formel_nicht.hinweis);
        if (out.ertragswert.gnd_hinweis) out.notes.push(out.ertragswert.gnd_hinweis);
        /* v2390 · EINE RESTNUTZUNGSDAUER FUER ALLE VERFAHREN - ausser die
           Modelle der beiden Ausschusssaetze verlangen verschiedene GND.
           Dann rechnet jedes Verfahren in SEINEM Modell (§ 10), und der
           Bericht sagt es, statt es zu verstecken. */
        const _gSw = out.sachwert && out.sachwert.available ? Number(out.sachwert.gesamtnutzungsdauer_jahre) : null;
        const _gEw = Number(out.ertragswert.gesamtnutzungsdauer_jahre);
        if (_gSw > 0 && _gEw > 0 && _gSw !== _gEw) {
          out.gnd_abweichung = {
            sachwert_gnd_jahre: _gSw, ertragswert_gnd_jahre: _gEw,
            sachwert_rnd_jahre: out.sachwert.restnutzungsdauer_jahre != null ? out.sachwert.restnutzungsdauer_jahre : null,
            ertragswert_rnd_jahre: out.ertragswert.restnutzungsdauer_jahre,
            sachwert_quelle: out.sachwert.gnd_quelle || null, ertragswert_quelle: _gndEwQuelle,
            hinweis: 'Zwei Gesamtnutzungsdauern: der Sachwert rechnet mit ' + _gSw + ' Jahren ('
              + (out.sachwert.gnd_quelle === 'modell_gutachterausschuss' ? 'Modell des Sachwertfaktors' : 'Anlage 1 ImmoWertV')
              + '), der Ertragswert mit ' + _gEw + ' Jahren ('
              + (_gndEwQuelle === 'modell_liegenschaftszins' ? 'Modell des Liegenschaftszinssatzes' : 'Anlage 1 ImmoWertV')
              + '). Jedes Verfahren folgt dem Modell, aus dem sein Ausschusswert abgeleitet wurde '
              + '(§ 10 ImmoWertV); die Restnutzungsdauer ist je Modell aus denselben Angaben abgeleitet.',
          };
          out.notes.push(out.gnd_abweichung.hinweis);
        }
      } else {
        out.ertragswert = { available: false, grund: (kern.warnungen[0] || 'Ertragswert nicht berechenbar.') };
      }
    }

    /* ═══ v2241 · ERTRAGSWERT FUER GEWERBEOBJEKTE ══════════════════════════
       Pflichtangaben, ohne die das Verfahren ENTFAELLT (kein halbes Rechnen):
         1  Nutzflaeche
         2  Gewerbe-Rohertrag: marktuebliche Miete je Einheit (MFH-
            Konfigurator) oder die Ist-Miete — Letztere gekennzeichnet als
            nicht auf Marktueblichkeit geprueft (§ 31 Abs. 2). Angebotsmieten
            aus dem Gewerbemarkt werden NICHT als marktueblich angesetzt.
         3  ein amtlicher Gewerbe-Liegenschaftszinssatz aus dem Register.
            Ein Wohn-Zinssatz oder ein Auffangwert waere nicht modellkonform.
         4  ein Instandhaltungsansatz nach Anlage 3 je Nutzung (Buero/
            Praxis/Laden 100 %, Lager/Logistik/Produktion 30 %). Hotel und
            Gastronomie fuehrt Anlage 3 nicht.
         5  das Baujahr (RND = GND nach Anlage 1 minus Alter; Anlage 2 gilt
            fuer Wohngebaeude und wird hier nicht angewandt).
       Der Rechenkern ist derselbe wie fuer Wohnen (ErtragswertService). */
    if (_gewObjekt) {
      const _artG = gewerbeArt(ref.gewerbe_art) || null;
      const _flaechenEin = (_gew && _gew.flaechen && Object.keys(_gew.flaechen).length) ? _gew.flaechen : null;
      const _nutzung3 = gewerbeAnlage3(_artG);
      const _flG = _gew ? _num(_gew.wfl_gewerbe) : wfl;
      const _flW = _gew ? (_num(_gew.wfl_wohnen) || 0) : 0;
      let _gJahr = null, _gHerk = null;
      if (_gew) {
        _gJahr = _gewJahr; _gHerk = _gewHerkunft;
      } else if (_num(ref.monthly_net_rent) > 0 && !ref.vacancy) {
        _gJahr = Math.round(_num(ref.monthly_net_rent) * 12); _gHerk = 'ist_ungeprueft';
      }
      let _wJahr = 0;
      const _wohnOk = !(_flW > 0) || (_num(_gew && _gew.wohnen_ist_jahr) > 0 && !(_gew && _gew.wohnen_leer));
      if (_flW > 0 && _wohnOk) _wJahr = _num(_gew.wohnen_ist_jahr);
      /* Nur ein Registersatz, dessen ZWEIG gewerblich ist. `lzs_aus_register`
         allein reicht nicht: die Zweigwahl faellt bei 'gesch' bis zum
         MFH-Zweig zurueck, und ein Wohnsatz waere hier genau der Fehler. */
      const _zweigGew = /buero|gewerbe|gew_dl|ggg|gegi|indwb|handel|hotel|produktion|logistik/
        .test(String(p.lzs_zweig || ''));
      const _lzsG = (p.lzs_aus_register && _zweigGew && _num(p.lzs_pct)) ? Number(p.lzs_pct) : null;
      const _artText = { hotel: 'Hotels', gastro: 'Gastronomie' }[_artG] || 'diese Nutzung';
      let _sperreG = null;
      if (!_flG) _sperreG = ['flaeche_fehlt', 'Die Nutzfläche des Gewerbeobjekts fehlt.'];
      else if (_gJahr == null) {
        _sperreG = ['keine_gewerbemiete', 'Für das Gewerbeobjekt liegt weder eine marktübliche Miete '
          + 'noch eine Ist-Miete vor' + (ref.vacancy ? ' (als leerstehend erfasst)' : '') + ' (§ 31 Abs. 2 ImmoWertV). '
          + 'Angebotsmieten aus dem Gewerbemarkt werden nicht als marktüblich angesetzt — sie sind nicht auf '
          + 'Lage, Zuschnitt und Ausstattung des Objekts geprüft. Die Ist-Miete im Reiter Miete oder die '
          + 'marktübliche Miete je Gewerbeeinheit eintragen.'];
      } else if (!_wohnOk) {
        _sperreG = ['wohnteil_ohne_miete', 'Das Gewerbeobjekt enthält ' + Math.round(_flW) + ' m² Wohnfläche, '
          + 'für die keine Ist-Miete vorliegt (oder Einheiten leer stehen). Wohnmieten aus Angeboten werden in '
          + 'einem Gewerbeobjekt nicht angesetzt. Für ein Wohn- und Geschäftshaus die Objektart MFH wählen — '
          + 'dann rechnet der Bericht Wohnen und Gewerbe getrennt.'];
      } else if (_lzsG == null) {
        _sperreG = ['kein_gewerbe_lzs', 'Für diesen Ort führt das Register keinen amtlichen '
          + 'Liegenschaftszinssatz für diese gewerbliche Nutzung. Ein Zinssatz für Wohnnutzung oder ein '
          + 'gesetzlicher Auffangwert wäre für Gewerbe nicht modellkonform (§ 10, § 21 Abs. 2 ImmoWertV). '
          + 'Der zuständige Gutachterausschuss führt ihn gegebenenfalls in seinem Grundstücksmarktbericht.'];
      } else if (!_flaechenEin && !_nutzung3) {
        _sperreG = ['keine_anlage3_nutzung', _artG
          ? 'Anlage 3 ImmoWertV führt für ' + _artText + ' keinen Instandhaltungsansatz; ein eigener Ansatz '
            + 'wäre eine sachverständige Festlegung, die dieser Bericht nicht trifft.'
          : 'Die Gewerbeart (Büro, Laden, Hotel, Halle …) ist nicht angegeben — ohne sie gibt es weder den '
            + 'Instandhaltungsansatz nach Anlage 3 noch die Gesamtnutzungsdauer nach Anlage 1.'];
      } else if (!buildYear) {
        _sperreG = ['kein_baujahr', 'Ohne Baujahr ist keine Restnutzungsdauer bestimmbar.'];
      }
      if (_sperreG) {
        out.ertragswert = { available: false, grund: _sperreG[0], hinweis: _sperreG[1], gewerbe: true };
        out.notes.push('Ertragswert entfällt: ' + _sperreG[1]);
      } else {
        const _gndG = gndNachArt(gewerbeGndSchluessel(_artG) || (_flaechenEin && _flaechenEin.lager_logistik ? 'lager' : 'buero'));
        const _rndG = rndSchaetzung(ref, _gndG);
        const bwErgebnisG = p.bodenwert
          ? p.bodenwert
          : { vollstaendig: bodenwert != null, wert: bodenwert,
              quelle: { brw_sqm: brw, herkunft: brw ? ErtragswertService.brwHerkunft(landValue) : 'manuell' } };   /* v2390 */
        const einG = {
          objektart: 'gewerbe', baujahr: buildYear, baustatus: ref.baustatus || 'bestand',
          wohnflaeche_qm: _flW, anzahl_we: _gew ? (_num(_gew.n_wohnen) || 0) : 0,
          stichtag_jahr: nowYear,
          miete_markt_jahr: _wJahr, gewerbe_jahr: _gJahr, gewerbe_herkunft: _gHerk,
          gewerbe_ist_jahr: _gew ? _num(_gew.ist_jahr) : _gJahr,
          gewerbe_flaechen: _flaechenEin || { [_nutzung3]: _flG },
          gewerbe_ohne_nutzung_qm: _gew ? _num(_gew.ohne_nutzung_qm) : null,
          miete_quelle: _gHerk === 'marktueblich' ? 'marktübliche Gewerbemiete (eigene Angabe)' : 'Ist-Miete Gewerbe',
          stellplatz_anz: (_num(ref.garages) || 0) + (_num(ref.outdoor_parking) || 0),
          garagen_anz: _num(ref.garages) || 0, aussen_anz: _num(ref.outdoor_parking) || 0,
          stellplatz_miete_monat: _num(p.stellplatz_miete_monat),
          modellversion: p.modellversion || null,
          gnd_jahre: _gndG, rnd_jahre: _rndG,
          sonstige_jahr: _num(ref.sonstige_jahr), sonstige_dauer_jahre: _num(ref.sonstige_dauer_jahre),
          lzs_pct: _lzsG, lzs_quelle: p.lzs_quelle || 'register', lzs_stufe: p.lzs_stufe || null,
          lzs_herabgestuft: !!p.lzs_herabgestuft,
          lzs_streuung_pp: p.lzs_streuung_pp != null ? p.lzs_streuung_pp : null,
          lzs_massstab: p.lzs_massstab || null,
          bwk_modus: 'normiert',
          bwk_verwaltung_je_we: _num(p.bwk_verwaltung_je_we),
          bwk_instandhaltung_je_qm: _num(p.bwk_instandhaltung_je_qm),
          bwk_mietausfall_pct: _num(p.bwk_mietausfall_pct),
          bwk_betrieb_nul_jahr: _num(p.bwk_betrieb_nul_jahr),
          bog_eur: (function () { const n = Number(p.bog_eur); return Number.isFinite(n) && n !== 0 ? n : null; })(),
          bog_grund: p.bog_grund || null,
        };
        const kernG = ErtragswertService.ertragswert(einG, bwErgebnisG);
        out.ertragswert_kern = kernG;
        if (kernG.vollstaendig && kernG.wert != null) {
          const holG = (t) => { const r = kernG.staffel.find((s) => s.pos.indexOf(t) >= 0); return r ? r.wert : null; };
          out.ertragswert = {
            available: true, gewerbe: true, gewerbe_art: _artG,
            rohertrag_pa_eur: holG('= Rohertrag'),
            bwk_pa_eur: Math.abs(holG('Bewirtschaftungskosten') || 0),
            reinertrag_pa_eur: holG('= Reinertrag'),
            liegenschaftszins_pct: kernG.lzs ? kernG.lzs.pct : _lzsG,
            liegenschaftszins_stufe: kernG.lzs ? kernG.lzs.stufe : null,
            liegenschaftszins_zweig: p.lzs_zweig || null,
            streuung_pct: _num(p.lzs_streuung_pct),
            liegenschaftszins_min: _num(p.lzs_min), liegenschaftszins_max: _num(p.lzs_max),
            liegenschaftszins_herabgestuft: !!p.lzs_herabgestuft,
            liegenschaftszins_quelle: kernG.lzs ? kernG.lzs.quelle : null,
            liegenschaftszins_quelle_link: p.lzs_quelle_link || null,
            liegenschaftszins_quellenvermerk: p.lzs_quellenvermerk || null,
            liegenschaftszins_lizenz: p.lzs_lizenz || null,
            liegenschaftszins_quelle_url: p.lzs_quelle_url || null,
            liegenschaftszins_berichtsjahr: p.lzs_berichtsjahr || null,
            miete_quelle: einG.miete_quelle, miete_erfasst: true,
            /* v2595 · auch hier nur mit Modellpruefung „im_modell“ (vorher: _gHerk === 'marktueblich') */
            ...(function () {
              const _flS = (_flG || 0) + (_flW || 0);
              const _mpG = pruefeModell(p.lzs_modellansaetze || null, {
                miete_qm: _flS > 0 ? Math.round(((_gJahr || 0) + (_wJahr || 0)) / 12 / _flS * 100) / 100 : null,
                rnd_jahre: kernG.nutzungsdauer ? kernG.nutzungsdauer.rnd : _rndG, flaeche_qm: _flS || null,
              }, { ausschuss: p.lzs_ausschuss || null, berichtsjahr: p.lzs_berichtsjahr || null, zweig: p.lzs_zweig || null });
              const _mkG = mieteModellkonform(_mpG);
              kernG.belastbarkeit = ErtragswertService.belastbarkeitMitModell(kernG.belastbarkeit, _mpG);
              if (_mpG.geprueft && _mpG.abweichend.length) out.notes.push('Modellprüfung des Liegenschaftszinses: ' + _mpG.text);
              return { miete_modellkonform: _gHerk === 'marktueblich' ? _mkG.wert : (_mkG.wert === true ? false : _mkG.wert),
                       miete_modellkonform_grund: _gHerk === 'marktueblich' ? _mkG.grund : 'Gewerbemiete = Ist-Miete, nicht auf Marktüblichkeit geprüft; ' + _mkG.grund,
                       modellpruefung: _mpG };
            })(),
            miete_qm: null, miete_vergleich: null,
            gewerbe_herkunft: _gHerk,
            restnutzungsdauer_jahre: kernG.nutzungsdauer ? kernG.nutzungsdauer.rnd : _rndG,
            gesamtnutzungsdauer_jahre: _gndG,
            vervielfaeltiger: kernG.barwertfaktor,
            bodenwert_eur: bwErgebnisG.vollstaendig ? bwErgebnisG.wert : null,
            bodenwert_fehlt: !bwErgebnisG.vollstaendig,
            value_eur: kernG.wert, staffel: kernG.staffel,
            belastbarkeit: kernG.belastbarkeit, sensitivitaet: kernG.sensitivitaet,
            verfahren: kernG.verfahren, modellversion: kernG.modellversion,
            indikativ: _gHerk !== 'marktueblich',
          };
          out.notes.push('Ertragswert Gewerbe: Gesamtnutzungsdauer ' + _gndG + ' Jahre (Anlage 1 ImmoWertV'
            + ((GND_TABELLE.geprueft || gndNachAnlage1Belegt(gewerbeGndSchluessel(_artG) || (_flaechenEin && _flaechenEin.lager_logistik ? 'lager' : 'buero'))) ? '' : ', Tabellenstand nicht gegen den Verordnungstext verifiziert')
            + '), Restnutzungsdauer ' + _rndG + ' Jahre geschätzt (GND minus Alter; Anlage 2 gilt für Wohngebäude). '
            + (_gHerk === 'marktueblich' ? 'Rohertrag aus der eingegebenen marktüblichen Gewerbemiete.'
              : 'Rohertrag = Ist-Miete, nicht auf Marktüblichkeit geprüft (§ 31 Abs. 2 ImmoWertV) — der Ertragswert ist indikativ.'));
          kernG.warnungen.forEach((w) => { if (out.notes.indexOf(w) < 0) out.notes.push(w); });
          kernG.hinweise.forEach((h) => { if (out.notes.indexOf(h) < 0) out.notes.push(h); });
        } else {
          out.ertragswert = { available: false, gewerbe: true,
            grund: (kernG.warnungen[0] || 'Ertragswert nicht berechenbar.') };
        }
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
    /* ══ v1971 · DIE BASIS DES VERGLEICHS WIRD GEMESSEN ════════════════

       Ein Vergleichswertverfahren darf nur fuehren, wenn KAUFPREISE
       dahinterstehen (Paragraf 25 Abs. 1 ImmoWertV). Beide hier
       moeglichen Grundlagen sind kaufpreisbasiert und sagen das selbst:

         amtlicher Vergleichsfaktor  Paragraf 20, aus der
                                     Kaufpreissammlung des Ausschusses
         Immobilienrichtwert         beurkundete Kaufpreise, BORIS

       Fehlen beide, bleibt nur der Median aus Portalinseraten — und der
       ist ein ANGEBOTSPREIS. Dann gibt es kein fuehrendes Verfahren.
       Siehe den Block in lib/verfahrenswahl.js. */
    /* v1977: DRITTE kaufpreisbasierte Grundlage — der amtliche
       Vergleichsfaktor aus dem Register (§ 20 ImmoWertV, aus der
       Kaufpreissammlung). Er wird in ReportOrchestrator gelesen und
       trägt dort schon die `verwendung`-Prüfung: Sätze, die der
       Ausschuss nur für die steuerliche Bewertung freigibt, kommen
       bereits mit `verfuegbar: false` an. Hier wird deshalb nur noch
       `verfuegbar` gefragt — die Entscheidung fällt an der Stelle, die
       den Satz gelesen hat. */
    /* ══ v2380 · DIE BESCHRIFTUNG FOLGT DEM, WAS GERECHNET WURDE ══════════
       Bis hier hiess `vergleichswert_eur` „Vergleichswert · amtliche
       Grundlage aus der Kaufpreissammlung", sobald IRGENDEINE amtliche
       Grundlage existierte - auch ausserhalb ihres Anwendungsbereichs
       (Hueellhorst: Vergleichsfaktor fuer ETW in Objekten > 2 WE, 50-120 m²)
       oder ganz ohne Einfluss auf die Zahl (Hiddenhausen: Immobilienrichtwert
       1.700 €/m², gerechnet wurde der Angebotsmedian). Die Zahl war in allen
       drei Pruefberichten (220-231) der Angebotsmedian minus Abschlag.
       Jetzt: amtlich heisst es nur, wenn ein amtlicher Wert IM
       Anwendungsbereich vorliegt UND die Zahl aus ihm gebildet wird.
       Der Immobilienrichtwert wird hier nicht angewandt (dafuer fehlen die
       Umrechnungskoeffizienten der Anlage) - er bleibt Auskunft. */
    let _amtVgl = null;
    const _avf = p.amtlicher_vergleichsfaktor, _rvf = p.register_vergleichsfaktor;
    if (_avf && _avf.verfuegbar && _avf.fuehrend !== false && !_avf.ausserhalb_grenzen
        && Number(_avf.wert_eur) > 0) {
      _amtVgl = { wert_eur: Math.round(Number(_avf.wert_eur)), faktor_qm: _avf.faktor_qm || null,
        rechnung: _avf.rechnung || null, quelle: _avf.quelle || null, ausschuss: _avf.ausschuss || null,
        art: 'vergleichsfaktor' };
    } else if (_rvf && _rvf.verfuegbar && Number(_rvf.wert_eur) > 0) {
      _amtVgl = { wert_eur: Math.round(Number(_rvf.wert_eur)), faktor_qm: _rvf.faktor_qm || null,
        rechnung: _rvf.rechenweg || null, quelle: _rvf.quelle_url || null, ausschuss: _rvf.ausschuss || null,
        art: 'vergleichsfaktor_register' };
    }
    const _vglKaufpreise = !!_amtVgl;
    out.verfahrenswahl = fuehrendesVerfahren({
      objektart: ref.property_type, wohneinheiten: ref.units, nutzung: ref.usage_type,
      vergleichsbasis: _vglKaufpreise ? 'kaufpreise' : null,
    });
    /* v2380 · KEIN FUEHRENDES VERFAHREN, DAS NICHT GERECHNET WURDE.
       Hueellhorst (ETW ohne BGF, Bericht 223): „Fuehrend: Sachwertverfahren"
       stand neben einem Sachwert, der gar nicht ausgewiesen war. Dann wird
       das Verfahren benannt, das fuehren WUERDE, und was ihm fehlt. */
    if (out.verfahrenswahl && out.verfahrenswahl.verfahren) {
      const _vk = out.verfahrenswahl.verfahren;
      /* v2390 · der Pauschal-Sachwert fuehrt nicht - er ist kein Sachwert nach NHK 2010. */
      const _gerechnet = _vk === 'sachwert' ? !!(out.sachwert && out.sachwert.available && !out.sachwert.pauschal)
        : _vk === 'ertragswert' ? !!(out.ertragswert && out.ertragswert.available)
          : _vk === 'vergleichswert' ? _vglKaufpreise : true;
      if (!_gerechnet) {
        const _gGrund = String((_vk === 'sachwert' ? (out.sachwert && out.sachwert.grund)
          : (out.ertragswert && out.ertragswert.grund)) || '').trim();
        const _fehltWas = (_vk === 'sachwert' && istWohnung && !(_bgfWhg > 0))
          ? 'die Brutto-Grundfläche (BGF)'
          : (_vk === 'sachwert' && out.sachwert && out.sachwert.pauschal)   /* v2390 */
            ? ((out.sachwert.fehlt && out.sachwert.fehlt.length)
              ? 'die Angabe ' + out.sachwert.fehlt.join(' und ')
              : 'ein Kostenkennwert der NHK 2010')
          : _vk === 'vergleichswert' ? 'ein amtlicher Vergleichsfaktor im Anwendungsbereich'
            : ('eine Pflichtangabe' + (_gGrund ? ' (' + _gGrund.replace(/\.$/, '') + ')' : ''));
        const _vName = { sachwert: 'Sachwertverfahren', ertragswert: 'Ertragswertverfahren',
          vergleichswert: 'Vergleichswertverfahren' }[_vk];
        out.verfahrenswahl = {
          verfahren: null, waere: _vk, nicht_gerechnet: true,
          fehlt: _vk === 'sachwert' && istWohnung && !(_bgfWhg > 0) ? 'bgf' : null,
          grund: out.verfahrenswahl.grund,
          quelle: out.verfahrenswahl.quelle || null,
          weg: 'Führend wäre das ' + _vName + '; es konnte nicht gerechnet werden, weil '
            + _fehltWas.replace(/\.$/, '') + ' fehlt. Kein Verfahren rechnet halb — '
            + 'mit dieser Angabe wird es ausgewiesen.',
        };
      }
    }
    if (out.verfahrenswahl && out.verfahrenswahl.grund) {
      /* v1971: ohne fuehrendes Verfahren steht das AUCH im Bericht —
         „—" als Verfahrensname war eine Leerstelle, die wie ein Fehler
         aussah. */
      const _vn = { sachwert: 'Sachwertverfahren', ertragswert: 'Ertragswertverfahren',
        vergleichswert: 'Vergleichswertverfahren' }[out.verfahrenswahl.verfahren];
      out.notes.push(_vn
        ? 'Führendes Verfahren: ' + _vn + '. ' + out.verfahrenswahl.grund
        : 'Kein führendes Verfahren ausgewiesen. ' + out.verfahrenswahl.grund
          + (out.verfahrenswahl.weg ? ' ' + out.verfahrenswahl.weg : ''));
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

    /* v1977: auch der zurueckgehaltene Satz gehoert in den Bericht. Dass
       ein Ausschuss Vergleichsfaktoren fuehrt, sie aber nur fuer die
       steuerliche Bewertung freigibt, ist selbst eine Auskunft — und
       zwar die, die dem Leser sonst fehlt: er sieht kein fuehrendes
       Verfahren und erfaehrt nicht, warum. */
    if (p.register_vergleichsfaktor) {
      out.register_vergleichsfaktor = p.register_vergleichsfaktor;
      const _rv = p.register_vergleichsfaktor;
      if (_rv.hinweis && out.notes.indexOf(_rv.hinweis) < 0) out.notes.push(_rv.hinweis);
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
        /* v2382 · Die Notiz sagt, womit der Ertragswert WIRKLICH rechnet. Hier stand fest
           „der Ertragswert folgt ihr deshalb" - auch wenn er mit der Ist-Miete rechnete (H: 10,00 €/m²). */
        const _ewA = out.ertragswert && out.ertragswert.available ? out.ertragswert : null;
        out.notes.push('Die Angebotsmiete liegt mit '
          + String(Math.round(rentSqm * 100) / 100).replace('.', ',') + ' €/m² um ' + Math.abs(_ab)
          + ' % ' + (_ab >= 0 ? 'über' : 'unter') + ' der Mietpreisübersicht des Gutachterausschusses ('
          + String(p.amtliche_miete.miete_qm).replace('.', ',') + ' €/m²); die Übersicht bildet weitgehend Bestandsmieten ab. '
          + (_ewA && _ewA.miete_qm != null
            ? 'Der Ertragswert rechnet mit ' + String(_ewA.miete_quelle || 'der angesetzten Miete').replace(/^Ist-Miete/, 'der Ist-Miete')
              + ' (' + String(Math.round(_ewA.miete_qm * 100) / 100).replace('.', ',') + ' €/m²)'
              + (_amtFuehrt ? '; der Liegenschaftszinssatz ist auf Grundlage der amtlichen Übersicht abgeleitet (§ 10 ImmoWertV)' : '') + '.'
            : ''));
      }
    }
    if (p.flaeche) {
      out.flaeche = p.flaeche;
      if (p.flaeche.hinweis && out.notes.indexOf(p.flaeche.hinweis) < 0) {
        out.notes.push(p.flaeche.hinweis);
      }
    }
    /* v1083-WRND-3 · Auch auf oberster Ebene, damit PDF und Verlauf die
     * Herkunft lesen koennen, ohne in den Sachwertblock zu greifen — der
     * fehlt bei Objektarten ohne Sachwertverfahren ganz. */
    /* v2382 · Rechnet nur der Ertragswert (ETW ohne BGF), blieb die Herkunft leer -
       die Restnutzungsdauer stand im Rechenweg, ihre Ableitung nirgends. Dieselbe
       Ableitung wie im Sachwert (eine RND fuer alle Verfahren); weicht sie von der
       des Ertragswerts ab, wird DESSEN Zahl mit ihrer Quelle genannt. */
    if (!_rndHerkunft.quelle && out.ertragswert && out.ertragswert.available
        && out.ertragswert.restnutzungsdauer_jahre != null) {
      const _ewR = Number(out.ertragswert.restnutzungsdauer_jahre);
      const _ewG = Number(out.ertragswert.gesamtnutzungsdauer_jahre) || GND_JAHRE;
      const _e = rndEinheitlich(ref, _ewG);
      if (_e && _e.quelle === 'anlage2' && Math.abs(Number(_e.rnd) - _ewR) < 0.05) {
        _rndHerkunft.gnd_jahre = _e.gnd_jahre;
        _rndMerke('anlage2', _e.grund || null, _ewR, _e.hinweis);
      } else {
        _rndHerkunft.gnd_jahre = _ewG;
        _rndMerke('geschaetzt', 'nur_ertragswert', _ewR, _SCHAETZUNG);
      }
    }
    out.restnutzungsdauer_herkunft = _rndHerkunft;
    /* v2383 · Plausibilitaet der Bauteil-Betraege (Euro-Felder mit Stueckzahl befuellt) */
    if (ref.bauteile_unplausibel) {
      const _bu = Object.keys(ref.bauteile_unplausibel).map((k) => k + ' = ' + ref.bauteile_unplausibel[k]);
      out.bauteile_unplausibel = ref.bauteile_unplausibel;
      out.notes.push('Sonstige Bauteile nicht angesetzt: ' + _bu.join(', ') + ' € ist als Herstellungskosten unplausibel '
        + '(vermutlich eine Stückzahl). Das Feld erwartet den Betrag in Euro zum Stichtag.');
    }
    out.available = true;
      const vals = [
        ['vergleichswert', _amtVgl ? _amtVgl.wert_eur : vgl],   /* v2380 */
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
      /* ══ v1971 · DIE AUSGABE NENNT IHRE BASIS ════════════════════════

         `vergleichswert_eur` heisst aus Ruecksicht auf bestehende Leser
         weiter so (Verlauf, Dropdown, gespeicherte Berichte), traegt aber
         jetzt seine Herkunft mit. Beide Oberflaechen — Bildschirm und PDF
         — beschriften danach, statt den Namen zu behaupten.

           basis: 'kaufpreise'  amtlicher Vergleichsfaktor oder
                                Immobilienrichtwert -> echter
                                Vergleichswert nach Paragraf 24
           basis: 'angebote'    Median aus Portalinseraten -> das ist
                                eine MARKTPREISINDIKATION, kein
                                Vergleichswert

         > Eine Umbenennung des FELDES waere die groessere Reparatur, aber
         > sie bricht jeden gespeicherten Bericht und das Wertanker-
         > Dropdown. Die Beschriftung ist das, was der Kunde liest — sie
         > wird korrigiert, der Schluessel bleibt. */
      /* v2380: liegt ein amtlicher Vergleichsfaktor im Anwendungsbereich vor,
         IST die Zahl der amtliche Wert; der Angebotswert bleibt daneben stehen. */
      out.comparison = {
        vergleichswert_eur: _amtVgl ? _amtVgl.wert_eur : vgl,
        basis: _vglKaufpreise ? 'kaufpreise' : 'angebote',
        bezeichnung: _vglKaufpreise ? 'Vergleichswert (amtlicher Vergleichsfaktor)'
          : 'Marktpreisindikation aus Angebotspreisen',
        basis_hinweis: _vglKaufpreise
          ? 'Amtlicher Vergleichsfaktor des Gutachterausschusses, abgeleitet aus der '
            + 'Kaufpreissammlung (§ 20, § 25 Abs. 1 ImmoWertV)'
            + (_amtVgl.rechnung ? ': ' + _amtVgl.rechnung : '') + '.'
          : 'Angebotspreise (Marktdurchschnitt), keine Kaufpreise — § 25 Abs. 1 '
            + 'ImmoWertV verlangt für das Vergleichswertverfahren Kaufpreise.',
        amtlicher_vergleich: _amtVgl,
        angebotswert_eur: vgl,
        sachwert_eur: out.sachwert.available ? out.sachwert.value_eur : null,
        ertragswert_eur: out.ertragswert.available ? out.ertragswert.value_eur : null,
        min_eur: nums.length ? Math.min(...nums) : null,
        max_eur: nums.length ? Math.max(...nums) : null,
        spread_pct: nums.length >= 2 && Math.min(...nums) > 0
          ? round((Math.max(...nums) / Math.min(...nums) - 1) * 100, 1) : null,
        /* v2595 · DIE DIFFERENZ MIT VORZEICHEN, BEZOGEN AUF DEN ERTRAGSWERT
           (Prompt „Vergleich der Werte"): absolut = Marktpreisindikation − Ertragswert,
           relativ = absolut / Ertragswert × 100; null ohne Ertragswert (oder 0).
           spread_pct (max/min − 1, ohne Vorzeichen) bleibt fuer bestehende Leser. */
        differenz_zum_ertragswert: differenzZumErtragswert(vgl, out.ertragswert.available ? out.ertragswert.value_eur : null),
      };
    }

    /* === v1107-WNACH - DER QUELLENNACHWEIS =============================
       Wer eine Zahl unter dl-de/by-2-0 verwendet, MUSS ihre Herkunft
       nennen. Bis hierher hing der Vermerk an jedem Registersatz und
       erschien in keinem Bericht - damit durfte keine dieser Zahlen zum
       Kunden. Betroffen waren zuletzt alle sechzehn Brandenburger Saetze
       und Aurich mit einundvierzig Kreisschluesseln.

       GENANNT WIRD NUR, WAS IN DIESEM BERICHT WIRKLICH STECKT. Eine
       Namensnennung fuer einen Ausschuss, der hier gar nicht vorkommt,
       ist genauso falsch wie eine fehlende - sie behauptet eine Herkunft.

       Entdoppelt wird ueber den Vermerkstext: fuehrt derselbe Ausschuss
       Zins UND Sachwertfaktor, steht er einmal da, mit beiden Kennzahlen. */
    const _nachweis = new Map();
    /* v1402: `jahrgang` kommt dazu — eine Namensnennung ohne Datum sagt
       zwar, WER die Zahl erhoben hat, aber nicht WANN. Bei einem älteren
       Bericht ist genau das die entscheidende Auskunft. */
    const _merke = (vermerk, kennzahl, url, lizenz, jahrgang) => {
      const t = String(vermerk || '').trim();
      if (!t) return;
      const e = _nachweis.get(t) || { vermerk: t, kennzahlen: [], url: url || null,
                                      lizenz: lizenz || null, jahrgang: jahrgang || null };
      if (e.kennzahlen.indexOf(kennzahl) < 0) e.kennzahlen.push(kennzahl);
      if (!e.url && url) e.url = url;
      if (!e.lizenz && lizenz) e.lizenz = lizenz;
      /* Führt derselbe Ausschuss zwei Kennzahlen aus verschiedenen
         Jahrgängen, gewinnt der ÄLTERE — er begrenzt die Aussagekraft des
         Eintrags, und das ist die Zahl, die der Leser wissen muss. */
      if (jahrgang && (!e.jahrgang || Number(jahrgang) < Number(e.jahrgang))) {
        e.jahrgang = jahrgang;
      }
      _nachweis.set(t, e);
    };
    if (out.sachwert && out.sachwert.marktangepasst) {
      _merke(out.sachwert.sachwertfaktor_quellenvermerk, 'Sachwertfaktor',
             out.sachwert.sachwertfaktor_quelle_url, out.sachwert.sachwertfaktor_lizenz,
             out.sachwert.sachwertfaktor_berichtsjahr);
    }
    /* v2385 · Ein Auffangwert (D) oder eine eigene Angabe (E) ist keine Registerzahl - H nannte
       „§ 256 BewG (Liegenschaftszinssatz) · Lizenz nicht hinterlegt" als Quellennachweis.
       v2401 · Ebenso die DealPilot-Formel (N): sie nennt keinen Ausschuss, also keine Namensnennung. */
    if (out.ertragswert && out.ertragswert.available
        && out.ertragswert.liegenschaftszins_pct != null
        && ['N', 'D', 'E'].indexOf(String(out.ertragswert.liegenschaftszins_stufe || '')) < 0) {
      _merke(out.ertragswert.liegenschaftszins_quellenvermerk, 'Liegenschaftszinssatz',
             out.ertragswert.liegenschaftszins_quelle_url, out.ertragswert.liegenschaftszins_lizenz,
             out.ertragswert.liegenschaftszins_berichtsjahr || null);
    }
    /* v2280 · Der Umrechnungskoeffizient fuer die Grundstuecksgroesse ist eine
       Registerzahl wie Zins und Faktor - steckt er im Bodenwert, wird er genannt. */
    const _bwAuf = p.bodenwert && p.bodenwert.flaechenaufteilung;
    if (_bwAuf && _bwAuf.koeffizient_angewandt && _bwAuf.quellenvermerk) {
      _merke(_bwAuf.quellenvermerk, 'Umrechnungskoeffizient Grundstücksgröße',
             _bwAuf.quelle_url, _bwAuf.lizenz, _bwAuf.berichtsjahr || null);
    }
    out.quellen_nachweis = Array.from(_nachweis.values());

    /* v2382 · `assumptions` nennt, womit GERECHNET wurde. Bis hier standen die Vorgaben des
       vereinfachten EFH-Wegs (835 €/m², BGF-Faktor 1,35, Faktor 1,0, BWK 23 %, Zins 3 %) auch
       dann da, wenn NHK-Kern, Ausschuss-Quote und Registerzins rechneten. Die Vorgaben bleiben
       unter `vorgaben_vereinfacht` lesbar; die Felder oben tragen das Ergebnis oder null. */
    try {
      const _a = out.assumptions, _sw = out.sachwert || {}, _ew = out.ertragswert || {};
      _a.vorgaben_vereinfacht = { nhk_efh_bgf_eur: NHK_EFH_BGF, bgf_faktor: BGF_FAKTOR, sachwertfaktor: SACHWERTFAKTOR,
        bwk_quote: BWK_QUOTE, liegenschaftszins: LIEGENSCHAFTSZINS };
      const _vereinfacht = _sw.available && _sw.nhk_eur_qm_bgf == null;
      _a.nhk_efh_bgf_eur = _sw.available ? (_sw.nhk_eur_qm_bgf != null ? _sw.nhk_eur_qm_bgf : NHK_EFH_BGF) : null;
      _a.bgf_faktor = _vereinfacht ? BGF_FAKTOR : null;
      const _swf = _sw.sachwertfaktor; const _swfZ = (_swf && typeof _swf === 'object') ? _swf.wert : _swf;
      _a.sachwertfaktor = _sw.available ? (_swfZ != null ? _swfZ : (_sw.vorlaeufig ? null : SACHWERTFAKTOR)) : null;
      _a.gnd_jahre = _sw.available && _sw.gnd_jahre ? _sw.gnd_jahre : (_rndHerkunft.gnd_jahre || GND_JAHRE);
      _a.bwk_quote = (_ew.available && _ew.rohertrag_pa_eur > 0) ? Math.round(_ew.bwk_pa_eur / _ew.rohertrag_pa_eur * 1000) / 1000 : null;
      _a.liegenschaftszins = (_ew.available && _ew.liegenschaftszins_pct != null) ? Number(_ew.liegenschaftszins_pct) / 100 : null;
      if (_ew.available && _ew.liegenschaftszins_pct != null) _a.liegenschaftszins_pct_effektiv = Number(_ew.liegenschaftszins_pct);
      if (_ew.available) _a.liegenschaftszins_stufe = _ew.liegenschaftszins_stufe || _a.liegenschaftszins_stufe;
    } catch (e) { /* die Fussnote darf den Bericht nie kippen */ }

    return out;

  },
};
