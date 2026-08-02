// ErtragswertService.js — Bodenwert und Ertragswert nach ImmoWertV 2021.
//
// Getrennt vom ValuationService: der rechnet eine VERGLEICHSBASIERTE Marktindikation
// (Median EUR/m² x Flaeche x Faktoren). Hier entsteht ein eigenstaendiges Verfahren.
// Beide muessen unabhaengig bleiben, sonst ist die spaetere Verprobung wertlos.
//
// Jede Zwischengroesse wird einzeln ausgewiesen — das PDF druckt die Staffel Zeile
// fuer Zeile, und wer nachrechnen will, muss es koennen.

/* v1048-WBWK-1 · Ohne diesen Import laeuft der Block unten auf einen
 * ReferenceError. node --check sieht fehlende Importe nicht: kein
 * Syntaxfehler, sondern ein fehlender Bezeichner. */
import { bewirtschaftungskosten as nrwBwk } from '../lib/nrw_modell.js';
import {
  BWK_TABELLE, GND_TABELLE, MODELL,
  barwertfaktor, abzinsungsfaktor, gnd, rnd, lzsNach256,
  istNeubau, istErstbezugNachSanierung, round0, round2,
} from '../lib/immowertv.js';

/* FIX-NUM: Number(null) ist 0, nicht NaN. Ohne diese Wache lieferte
 * num(null) ?? Default die 0 und kippte die gesamten Bewirtschaftungs-
 * kosten auf null. Gleiche Familie wie die _euro(null)-Falle. */
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
};
const pos = (v) => { const n = num(v); return n != null && n > 0 ? n : null; };

export const ErtragswertService = {

  /* ══════════════════════════════════════════════════════════════════════════
   * BODENWERT — Grundlage fuer Ertrags- UND Sachwert.
   *
   * grund: {
   *   flaeche_qm, brw_sqm, brw_stichtag, brw_zone, brw_quelle,
   *   mea_pct            Miteigentumsanteil in Prozent (nur ETW)
   *   gfz_koeff          Umrechnungskoeffizient, falls die GFZ abweicht (manuell)
   *   beitrag_abzug_eur  Erschliessungsbeitrag, falls Richtwert beitragsfrei
   *   anpassung_pct      Zuschnitt/Ecklage/Tiefe, mit Begruendung
   *   anpassung_grund
   * }
   * ══════════════════════════════════════════════════════════════════════════ */
  bodenwert(grund = {}) {
    const out = { schritte: [], hinweise: [], wert: null, vollstaendig: false };

    const flaeche = pos(grund.flaeche_qm);
    const brw = pos(grund.brw_sqm);

    if (!flaeche) out.hinweise.push('Grundstücksfläche fehlt — ohne sie ist kein Bodenwert und damit kein Ertragswert möglich.');
    if (!brw) out.hinweise.push('Bodenrichtwert fehlt — über BORIS abrufen oder aus dem Grundstücksmarktbericht eintragen.');
    if (!flaeche || !brw) return out;

    let wert = flaeche * brw;
    out.schritte.push({ pos: 'Grundstücksfläche × Bodenrichtwert', detail: `${flaeche} m² × ${brw} €/m²`, wert: round0(wert) });

    // GFZ-Umrechnung nur mit ausdruecklich angegebenem Koeffizienten. Wir erfinden
    // keinen — die Umrechnungstabellen sind regional und gehoeren zum Marktbericht.
    const koeff = pos(grund.gfz_koeff);
    if (koeff && koeff !== 1) {
      wert *= koeff;
      out.schritte.push({ pos: 'GFZ-Umrechnung', detail: `× ${koeff}`, wert: round0(wert) });
    } else if (grund.brw_gfz && grund.obj_gfz && Number(grund.brw_gfz) !== Number(grund.obj_gfz)) {
      out.hinweise.push(`Die GFZ des Objekts (${grund.obj_gfz}) weicht von der des Richtwertgrundstücks (${grund.brw_gfz}) ab. Ohne Umrechnungskoeffizient aus dem Grundstücksmarktbericht wurde nicht umgerechnet — der Bodenwert ist insoweit ungenau.`);
    }

    // Zuschnitt / Ecklage / Tiefe
    const anp = num(grund.anpassung_pct);
    if (anp && anp !== 0) {
      wert *= (1 + anp / 100);
      out.schritte.push({
        pos: 'Anpassung Zuschnitt / Lage',
        detail: `${anp > 0 ? '+' : ''}${anp} %${grund.anpassung_grund ? ' — ' + grund.anpassung_grund : ''}`,
        wert: round0(wert),
      });
      if (!grund.anpassung_grund) out.hinweise.push('Die Bodenwert-Anpassung ist ohne Begründung eingetragen. Im Dossier gehört eine Begründung dazu.');
    }

    // Erschliessungsbeitrag
    const beitrag = num(grund.beitrag_abzug_eur);
    if (beitrag && beitrag !== 0) {
      wert -= Math.abs(beitrag);
      out.schritte.push({ pos: 'Erschließungsbeitrag', detail: '− ' + Math.abs(beitrag).toLocaleString('de-DE') + ' €', wert: round0(wert) });
    }

    out.bodenwert_gesamt = round0(wert);

    // Miteigentumsanteil (ETW)
    /* v1026 · Bei einer Eigentumswohnung ist der VOLLE Grundstueckswert immer
     * falsch. Ohne Miteigentumsanteil wurde er trotzdem angesetzt: im Coswiger
     * Testfall 160.300 EUR (700 m2 x 229) fuer eine 50-m2-Wohnung in einem Haus
     * mit zehn Einheiten. Die Bodenwertverzinsung frass 4.809 von 6.578 EUR
     * Reinertrag, das Gebaeude trug nur noch 1.769 EUR bei — bei einem Neubau.
     * Lieber gar kein Bodenwert als ein zehnfach zu hoher. */
    const mea = pos(grund.mea_pct);
    if (grund.ist_wohnung && !mea) {
      out.wert = null;
      out.vollstaendig = false;
      out.bodenwert_gesamt = round0(wert);
      out.hinweise.push('Bei einer Eigentumswohnung wird der Bodenwert ueber den Miteigentumsanteil '
        + 'ermittelt. Ohne ihn waere der volle Grundstueckswert anzusetzen, was den Ertragswert '
        + 'stark verzerrt — deshalb bleibt er hier aussen vor. Miteigentumsanteil ergaenzen '
        + '(steht in der Teilungserklaerung, meist als Bruch wie 125/1000).');
      return out;
    }
    if (mea) {
      wert = wert * (mea / 100);
      out.schritte.push({ pos: 'Miteigentumsanteil', detail: `${round2(mea)} %`, wert: round0(wert) });
    }

    out.wert = round0(wert);
    out.vollstaendig = true;
    out.quelle = {
      brw_sqm: brw, stichtag: grund.brw_stichtag || null,
      zone: grund.brw_zone || null, herkunft: grund.brw_quelle || 'manuell',
    };
    return out;
  },

  /* ══════════════════════════════════════════════════════════════════════════
   * ERTRAGSWERT — allgemeines Ertragswertverfahren, §§ 27–34 ImmoWertV.
   *
   * ein: {
   *   objektart, baujahr, baustatus, wohnflaeche_qm, anzahl_we, stichtag_jahr,
   *   miete_markt_jahr        marktueblich erzielbarer Jahresrohertrag Wohnen
   *   miete_ist_jahr          Ist-Miete, nur zum Abgleich
   *   gewerbe_jahr, stellplatz_anz, stellplatz_miete_monat, sonstige_jahr,
   *   bwk_modus               'normiert' | 'manuell'
   *   bwk_verwaltung_je_we, bwk_instandhaltung_je_qm, bwk_mietausfall_pct,
   *   bwk_betrieb_nul_jahr, bwk_gesamt_jahr (nur bei 'manuell')
   *   lzs_pct, lzs_quelle, lzs_stufe   ('A'|'B'|'C'|'D')
   *   gnd_jahre, rnd_jahre             (optional, sonst abgeleitet)
   *   bog_eur, bog_grund
   * }
   * bodenwertErgebnis: Rueckgabe von bodenwert()
   * ══════════════════════════════════════════════════════════════════════════ */
  ertragswert(ein = {}, bodenwertErgebnis = null) {
    const out = {
      verfahren: 'allgemeines Ertragswertverfahren',
      rechtsgrundlage: '§§ 27–34 ImmoWertV 2021',
      modellversion: MODELL.IMMOWERTV_2021,
      staffel: [], hinweise: [], warnungen: [],
      wert: null, vollstaendig: false,
    };

    /* FIX-OHNEBW: Fehlt der Bodenwert (typisch bei Eigentumswohnungen ohne
     * Grundstuecksangabe), wird NICHT abgebrochen, sondern ohne Bodenwert-
     * trennung gerechnet - so wie der Quercheck es bisher tat. Ein Abbruch
     * haette den haeufigsten Objekttyp verloren. */
    const hatBw = !!(bodenwertErgebnis && bodenwertErgebnis.vollstaendig && bodenwertErgebnis.wert != null);
    const bw = hatBw ? bodenwertErgebnis.wert : 0;
    if (!hatBw) {
      out.verfahren = 'vereinfachtes Ertragswertverfahren (ohne Bodenwerttrennung)';
      out.warnungen.push('Ohne Bodenwert wurde ohne Bodenwerttrennung gerechnet. Grundstücksfläche und Bodenrichtwert ergänzen, dann rechnet das allgemeine Ertragswertverfahren.');
    }

    /* ── 1 · Rohertrag ──────────────────────────────────────────────────── */
    const mieteMarkt = pos(ein.miete_markt_jahr) || 0;
    const gewerbe = pos(ein.gewerbe_jahr) || 0;
    const spAnz = pos(ein.stellplatz_anz) || 0;
    const spMiete = pos(ein.stellplatz_miete_monat) || 0;
    const stellplatz = round0(spAnz * spMiete * 12);
    const sonstige = pos(ein.sonstige_jahr) || 0;

    if (!mieteMarkt && !gewerbe) {
      out.warnungen.push('Kein Rohertrag — ohne marktüblich erzielbare Miete ist das Ertragswertverfahren nicht anwendbar.');
      return out;
    }

    /* v1057-WSON-1 · Sonstige Ertraege gehoeren NICHT in den kapitalisierten
     * Rohertrag. Sie haften an einer Sache, nicht am Gebaeude: eine
     * Einbaukueche haelt fuenfzehn Jahre, das Gebaeude fuenfzig. Bei einem
     * Barwertfaktor von 30 hiesse Mitkapitalisieren, die Kueche dreissigmal
     * zu bezahlen. Sie werden weiter unten mit eigener Dauer angesetzt. */
    const rohertrag = round0(mieteMarkt + gewerbe + stellplatz);
    out.staffel.push({ pos: 'Rohertrag Wohnen (marktüblich erzielbar)', wert: round0(mieteMarkt) });
    if (gewerbe) out.staffel.push({ pos: 'Rohertrag Gewerbe', wert: round0(gewerbe) });
    if (stellplatz) out.staffel.push({ pos: `Stellplätze (${spAnz} × ${spMiete} €/Monat)`, wert: stellplatz });
    /* v1057-WSON-2 · Diese Zeile stand im Rohertrag und wurde damit ueber
     * die volle Restnutzungsdauer kapitalisiert. Der Ansatz steht jetzt
     * weiter unten mit eigener Laufzeit. */
    out.staffel.push({ pos: '= Rohertrag', wert: rohertrag, summe: true });

    // Ist-Miete nur als Hinweis — sie gehoert NICHT in den Rohertrag.
    const ist = pos(ein.miete_ist_jahr);
    if (ist && mieteMarkt) {
      const abw = ((ist - mieteMarkt) / mieteMarkt) * 100;
      if (Math.abs(abw) >= 10) {
        out.hinweise.push(
          `Die Ist-Miete (${round0(ist).toLocaleString('de-DE')} €/Jahr) weicht um ${abw > 0 ? '+' : ''}${round2(abw)} % von der marktüblich erzielbaren Miete ab. `
          + 'Angesetzt wird die marktübliche Miete; eine dauerhafte Über- oder Untermiete ist als besonderes objektspezifisches Merkmal zu bewerten, nicht im Rohertrag.'
        );
      }
    }

    /* ── 2 · Bewirtschaftungskosten ─────────────────────────────────────── */
    let bwk, bwkDetail = [];
    if (String(ein.bwk_modus) === 'manuell' && pos(ein.bwk_gesamt_jahr)) {
      bwk = round0(pos(ein.bwk_gesamt_jahr));
      /* v1052-WBWK-1 · "eigene Kalkulation" ist die nichtssagendste Zeile
       * im ganzen Bericht — und steht ausgerechnet dort, wo die amtliche
       * Quote des Gutachterausschusses gerechnet wird. */
      bwkDetail.push({
        pos: ein.bwk_quote_herkunft
          ? 'Bewirtschaftungskosten (' + (ein.bwk_quote_pct != null
              ? String(ein.bwk_quote_pct).replace('.', ',') + ' % · ' : '')
            + 'Angabe des Gutachterausschusses)'
          : 'Bewirtschaftungskosten (eigene Kalkulation)',
        wert: bwk });
      out.hinweise.push('Die Bewirtschaftungskosten wurden aus der eigenen Objektkalkulation übernommen. Die ImmoWertV sieht dafür normierte Ansätze vor (Anlage 3) — die Abweichung ist gewollt, sollte im Dossier aber benannt werden.');
    } else {
      /* v1018 · Verwaltungskosten gelten je Wohneinheit — aber bewertet wird
       * bei einer Eigentumswohnung EINE Einheit, nicht das ganze Haus.
       * Vorher: 10 WE x 230 = 2.330 EUR bei 7.506 EUR Rohertrag, also 31 %
       * allein fuer Verwaltung. Die Bewirtschaftungskosten lagen bei 40 %
       * statt der ueblichen 12 %, und der Ertragswert entsprechend zu tief
       * (137.000 statt rund 200.000). Die Zahl der Einheiten im Gebaeude
       * bleibt fuer die Objektart-Zuordnung relevant, nicht fuer die Kosten. */
      const _istEinheit = /etw|wohnung|whg|apartment/i.test(String(ein.objektart || ''));
      const we = _istEinheit ? 1 : (pos(ein.anzahl_we) || 1);
      const wfl = pos(ein.wohnflaeche_qm) || 0;
      /* v1047-WBWK-2 · Bei Wohnungseigentum gilt der hoehere Ansatz aus
       * Anlage 3 I.1 — WEG-Verwaltung, Eigentuemerversammlung,
       * Jahresabrechnung. */
      const _istWhg = /etw|wohnung|whg|apartment|appartement/i.test(String(ein.objektart || ''));

      /* v1048-WBWK-2 · Traegt der Zinssatz den Vermerk agvga_nrw_2016,
       * gelten dessen Bewirtschaftungskosten — nicht die der ImmoWertV.
       * Paragraf 10: dieselben Modellansaetze, die der Ableitung zugrunde
       * lagen. Sonst rechnet man mit einem amtlichen Zinssatz und fremden
       * Kosten, und das Ergebnis sieht amtlich aus, ohne es zu sein. */
      let _nrw = null;
      if (String(ein.modellversion || '') === 'agvga_nrw_2016') {
        _nrw = nrwBwk({
          rohertrag_eur: rohertrag, wohnflaeche_qm: wfl, ist_eigentumswohnung: _istWhg,
          wohneinheiten: we, garagen: pos(ein.garagen_anz) || 0,
          stellplaetze: pos(ein.aussen_anz) || 0,
          stichtag_jahr: ein.stichtag_jahr,
        });
      }
      if (_nrw) {
        bwk = _nrw.summe_eur;
        _nrw.posten.forEach((x) => out.staffel.push(x));
        out.bwk_modell = { modell: _nrw.modell, stand: _nrw.stand,
          fortgeschrieben: _nrw.fortgeschrieben, anteil_pct: _nrw.anteil_pct,
          hinweis: _nrw.hinweis, beleg: _nrw.beleg };
        out.hinweise.push(_nrw.hinweis);
      } else {
      const vJeWe = num(ein.bwk_verwaltung_je_we)
        ?? (_istWhg ? BWK_TABELLE.verwaltung_je_etw_eur : BWK_TABELLE.verwaltung_je_we_eur);

      /* v1026 · Was im Objekt schon gepflegt ist, wird genutzt: die eigene
       * Instandhaltungsruecklage und die Leerstandsannahme aus der Prognose.
       * Das sind seine Zahlen, nicht meine Tabellenwerte — und naeher an der
       * Wirklichkeit. Fehlt beides, greift Anlage 3. */
      let iJeQm = num(ein.bwk_instandhaltung_je_qm);
      let iHerkunft = 'Anlage 3';
      if (iJeQm == null && pos(ein.instandhaltung_ruecklage_jahr) && pos(ein.wohnflaeche_qm)) {
        iJeQm = round2(pos(ein.instandhaltung_ruecklage_jahr) / pos(ein.wohnflaeche_qm));
        iHerkunft = 'eigene Ruecklage';
      }
      if (iJeQm == null) iJeQm = BWK_TABELLE.instandhaltung_je_qm_wfl_eur;
      let maPct = num(ein.bwk_mietausfall_pct);
      let maHerkunft = 'Anlage 3';
      if (maPct == null && pos(ein.leerstand_pct)) {
        maPct = pos(ein.leerstand_pct); maHerkunft = 'eigene Leerstandsannahme';
      }
      if (maPct == null) {
        maPct = gewerbe > mieteMarkt
          ? BWK_TABELLE.mietausfall_gewerbe_pct : BWK_TABELLE.mietausfall_wohnen_pct;
      }
      out.bwk_herkunft = { instandhaltung: iHerkunft, mietausfall: maHerkunft };

      const verwaltung = round0(we * vJeWe + spAnz * BWK_TABELLE.verwaltung_je_stellplatz_eur);
      const instand = round0(wfl * iJeQm + spAnz * BWK_TABELLE.instandhaltung_je_stellplatz_eur);
      const mietausfall = round0(rohertrag * maPct / 100);
      const betriebNul = round0(pos(ein.bwk_betrieb_nul_jahr) || 0);

      bwkDetail.push({
        pos: `Verwaltungskosten (${we} WE × ${vJeWe} €`
             + (spAnz ? ` + ${spAnz} Stellpl. × ${BWK_TABELLE.verwaltung_je_stellplatz_eur} €` : '')
             + ')',
        wert: verwaltung });
      bwkDetail.push({ pos: `Instandhaltung (${wfl} m² × ${iJeQm} €)`,
        detail: iHerkunft === 'Anlage 3' ? null : 'aus deiner Rücklage',
        wert: instand });
      bwkDetail.push({ pos: `Mietausfallwagnis (${maPct} % vom Rohertrag)`,
        detail: maHerkunft === 'Anlage 3' ? null : 'aus deiner Leerstandsannahme',
        wert: mietausfall });
      if (betriebNul) bwkDetail.push({ pos: 'Nicht umlagefähige Betriebskosten', wert: betriebNul });

      bwk = verwaltung + instand + mietausfall + betriebNul;
      }   /* v1048-WBWK-3 · Ende des Zweigs ohne Modellvorgabe */

      if (!BWK_TABELLE.geprueft) {
        out.warnungen.push('Die normierten Bewirtschaftungskosten-Ansätze sind noch nicht gegen den Verordnungstext (Anlage 3 ImmoWertV) verifiziert und nicht indexiert. Das Ergebnis ist insoweit vorläufig.');
      }
      if (!wfl) out.hinweise.push('Ohne Wohnfläche wurden keine Instandhaltungskosten angesetzt — das überschätzt den Ertragswert.');
    }
    bwkDetail.forEach((d) => out.staffel.push(d));
    out.staffel.push({ pos: '− Bewirtschaftungskosten', wert: -round0(bwk), summe: true });

    const reinertrag = round0(rohertrag - bwk);
    out.staffel.push({ pos: '= Reinertrag', wert: reinertrag, summe: true });

    if (reinertrag <= 0) {
      out.warnungen.push('Der Reinertrag ist null oder negativ — das Ertragswertverfahren liefert hier kein sinnvolles Ergebnis.');
      return out;
    }

    /* ── 3 · Liegenschaftszinssatz ──────────────────────────────────────── */
    let lzs = pos(ein.lzs_pct);
    let lzsQuelle = ein.lzs_quelle || null;
    let lzsStufe = ein.lzs_stufe || null;
    if (!lzs) {
      const fb = lzsNach256(ein.objektart, bodenwertErgebnis?.quelle?.brw_sqm, ein.anzahl_we);
      lzs = fb.pct; lzsQuelle = fb.quelle; lzsStufe = 'D';
      out.warnungen.push(fb.hinweis);
    }
    out.lzs = { pct: lzs, quelle: lzsQuelle, stufe: lzsStufe };

    /* ── 4 · Bodenwertverzinsung ────────────────────────────────────────── */
    const bwVerzinsung = hatBw ? round0(bw * lzs / 100) : 0;
    if (hatBw) out.staffel.push({ pos: `− Bodenwertverzinsung (${bw.toLocaleString('de-DE')} € × ${lzs} %)`, wert: -bwVerzinsung, summe: true });

    const gebReinertrag = round0(reinertrag - bwVerzinsung);
    if (hatBw) out.staffel.push({ pos: '= Gebäudereinertrag', wert: gebReinertrag, summe: true });

    if (hatBw && gebReinertrag <= 0) {
      out.warnungen.push('Der Gebäudereinertrag ist null oder negativ: Die Bodenwertverzinsung übersteigt den Reinertrag. In diesem Fall ist regelmäßig der Bodenwert die maßgebliche Größe — das Gebäude trägt rechnerisch nichts bei.');
      out.wert = bw;
      out.staffel.push({ pos: '= Ertragswert (entspricht dem Bodenwert)', wert: bw, summe: true });
      out.vollstaendig = true;
      return out;
    }

    /* ── 5 · Restnutzungsdauer und Barwertfaktor ────────────────────────── */
    const G = pos(ein.gnd_jahre) || gnd(ein.objektart);
    /* FIX-NEUBAU: Beim Neubau gilt die volle Nutzungsdauer, auch wenn der
     * Aufrufer eine Restnutzungsdauer mitgibt (der Quercheck deckelt auf GND-10). */
    let R = istNeubau(ein.baustatus) ? null : pos(ein.rnd_jahre);
    let rndInfo = null;
    if (!R) {
      rndInfo = rnd(G, ein.baujahr, ein.baustatus, ein.stichtag_jahr,
        /* v1047-WA2-2 */
        { mod_punkte: ein.mod_punkte, kernsaniert: ein.kernsaniert,
          sanierungsjahr: ein.sanierungsjahr });
      R = rndInfo.jahre;
      if (rndInfo.hinweis) out.hinweise.push(rndInfo.hinweis);
    }
    if (!R) {
      out.warnungen.push('Ohne Restnutzungsdauer kein Barwertfaktor — Baujahr oder Restnutzungsdauer angeben.');
      return out;
    }
    out.nutzungsdauer = { gnd: G, rnd: R, modell: rndInfo ? rndInfo.modell : 'manuell', alter: rndInfo ? rndInfo.alter : null };
    if (!GND_TABELLE.geprueft && !pos(ein.gnd_jahre)) {
      out.warnungen.push('Die Gesamtnutzungsdauer stammt aus einer noch nicht gegen Anlage 1 ImmoWertV verifizierten Tabelle.');
    }

    const V = barwertfaktor(lzs, R);
    out.barwertfaktor = V;
    out.staffel.push({ pos: `× Barwertfaktor (${lzs} % / ${R} Jahre)`, wert: null, faktor: V });

    const gebErtragswert = round0(gebReinertrag * V);
    out.staffel.push({ pos: '= Gebäudeertragswert', wert: gebErtragswert, summe: true });

    /* ── 6 · Ertragswert ────────────────────────────────────────────────── */
    /* v1057-WSON-3 · Sonstige Ertraege mit EIGENER Dauer. Eine Kueche haelt
     * fuenfzehn Jahre, das Gebaeude fuenfzig; sie ueber den Barwertfaktor des
     * Gebaeudes zu kapitalisieren waere eine Ueberbewertung um ein Vielfaches.
     * Vorgabe 15 Jahre, ueber sonstige_dauer_jahre einstellbar. */
    let sonstigeBarwert = 0;
    if (sonstige > 0) {
      const _dauer = Math.min(pos(ein.sonstige_dauer_jahre) || 15, R);
      const _vS = barwertfaktor(lzs, _dauer);
      sonstigeBarwert = round0(sonstige * _vS);
      out.staffel.push({ pos: '+ sonstige Erträge (' + round0(sonstige).toLocaleString('de-DE')
        + ' € × Barwertfaktor ' + _vS.toFixed(2).replace('.', ',') + ' für ' + _dauer + ' Jahre)',
        wert: sonstigeBarwert });
      out.hinweise.push('Sonstige Erträge (z. B. Küche, Möblierung) sind mit einer eigenen '
        + 'Laufzeit von ' + _dauer + ' Jahren angesetzt, nicht über die Restnutzungsdauer des '
        + 'Gebäudes. Sie haften an einer Sache, nicht am Bauwerk.');
      out.sonstige_ertraege = { jahr: round0(sonstige), dauer_jahre: _dauer,
                                barwertfaktor: _vS, barwert_eur: sonstigeBarwert };
    }
    let ertragswert = gebErtragswert + bw + sonstigeBarwert;
    if (hatBw) out.staffel.push({ pos: '+ Bodenwert', wert: bw });
    /* WPDF12-4 · Ohne Bodenwert und ohne boG ist "vorlaeufiger Ertragswert"
     * dieselbe Zahl wie der Gebaeudeertragswert eine Zeile darueber. */
    if (hatBw || num(ein.bog_eur)) {
      out.staffel.push({ pos: '= vorläufiger Ertragswert', wert: round0(ertragswert), summe: true });
    }

    const bog = num(ein.bog_eur);
    if (bog && bog !== 0) {
      ertragswert += bog;
      out.staffel.push({
        pos: 'besondere objektspezifische Merkmale',
        detail: ein.bog_grund || null,
        wert: round0(bog),
      });
      if (!ein.bog_grund) out.hinweise.push('Besondere objektspezifische Merkmale sind ohne Begründung angesetzt. Ohne Begründung sind sie im Dossier nicht verwertbar.');
      out.staffel.push({ pos: '= Ertragswert', wert: round0(ertragswert), summe: true });
    }

    out.wert = rundeSinnvoll(ertragswert);
    out.wert_ungerundet = round0(ertragswert);
    out.vollstaendig = true;

    /* ── 7 · Belastbarkeit ──────────────────────────────────────────────── */
    out.belastbarkeit = belastbarkeit({
      lzsStufe, bwkGeprueft: BWK_TABELLE.geprueft,
      bodenwertQuelle: bodenwertErgebnis?.quelle?.herkunft,
      hatWohnflaeche: !!pos(ein.wohnflaeche_qm),
      hatRnd: !!R,
      warnungen: out.warnungen.length,
    });

    // Sensitivitaet: was macht ein halber Punkt? Das ist die ehrlichste Angabe
    // im ganzen Verfahren — sie zeigt, wie sehr alles an dieser einen Zahl haengt.
    const V2 = barwertfaktor(lzs + 0.5, R);
    if (V2) {
      const alt = round0(bw + (reinertrag - bw * (lzs + 0.5) / 100) * V2 + (bog || 0));
      out.sensitivitaet = {
        lzs_plus_05: { lzs_pct: round2(lzs + 0.5), wert: rundeSinnvoll(alt), abweichung_pct: round2(((alt - ertragswert) / ertragswert) * 100) },
      };
    }

    return out;
  },
};

function rundeSinnvoll(v) {
  if (v == null) return null;
  const step = v >= 500000 ? 5000 : v >= 100000 ? 1000 : 500;
  return Math.round(v / step) * step;
}

function belastbarkeit({ lzsStufe, bwkGeprueft, bodenwertQuelle, hatWohnflaeche, hatRnd, warnungen }) {
  let p = 100;
  const abzuege = [];
  const stufe = String(lzsStufe || 'D').toUpperCase();
  if (stufe === 'B') { p -= 12; abzuege.push('Liegenschaftszinssatz regional statt kreisscharf (−12)'); }
  /* v1022 · Die Marktableitung nutzt echte Preise, der gesetzliche
   * Auffangwert gar keine. Der Abstand im Abzug muss das abbilden. */
  if (stufe === 'C') { p -= 20; abzuege.push('Liegenschaftszinssatz marktabgeleitet, nicht amtlich (−20)'); }
  if (stufe === 'D') { p -= 40; abzuege.push('Liegenschaftszinssatz nur gesetzlicher Auffangwert (−40)'); }
  if (stufe === 'E') { p -= 10; abzuege.push('Liegenschaftszinssatz vom Nutzer gesetzt (−10)'); }
  if (!bwkGeprueft) { p -= 8; abzuege.push('Bewirtschaftungskosten-Tabelle ungeprüft (−8)'); }
  if (bodenwertQuelle && bodenwertQuelle !== 'boris') { p -= 10; abzuege.push('Bodenrichtwert nicht amtlich abgerufen (−10)'); }
  if (!hatWohnflaeche) { p -= 8; abzuege.push('Wohnfläche fehlt (−8)'); }
  if (!hatRnd) { p -= 15; abzuege.push('Restnutzungsdauer geschätzt (−15)'); }
  if (warnungen > 2) { p -= 5; abzuege.push('mehrere Warnungen (−5)'); }
  p = Math.max(10, Math.min(100, p));
  return {
    pct: p,
    label: p >= 80 ? 'Hoch' : p >= 60 ? 'Mittel' : p >= 40 ? 'Niedrig' : 'Sehr niedrig',
    abzuege,
  };
}
