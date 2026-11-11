'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/offertePayload.js — v3295 · Flow Investor, Punkt 2
 *
 * Der Auftrag fuer openaiService.analyze() (dieselbe Funktion wie POST /ai/analyze),
 * gebaut auf dem SERVER aus dem gespeicherten Objekt - fuer
 * POST /api/v1/objects/:id/offerte (routes/objects.js, services/flowOfferte.js).
 *
 * Vorbild ist `_buildAIPayload()` in frontend/js/ui.js: dieselben Bloecke, dieselben
 * Schluessel, dieselben Feld-Ids. Der Browser liest das Formular (g('id')), der Server
 * liest dasselbe Feld am Objekt (data[id]) - das Formular IST der gespeicherte Datensatz.
 * Die Kennzahlen kommen aus objektRechnung.rechnen() (Quick-Check-Kern), nicht aus
 * State.kpis des Browsers.
 *
 * NICHT auf dem Server vorhanden (nur im Browser gerechnet) und deshalb nicht im Auftrag -
 * gemessen und aufgelistet von tools/offerte-payload-pruefen.mjs:
 *   steuer.werbungskosten_jahr1 / verlauf / wende (calc.js Jahresschleife State.cfRows),
 *   finanzierung.restschuld_ezb (State.rs1), potenzial, indexmiete, bestand (DpBestand),
 *   zustand.restnutzungsdauer_berechnet (_dpRnd), investor_score (DS2), aiOptions (Settings).
 * Was fehlt, fehlt - es wird nichts geschaetzt.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* Zahlen wie calc.js parseDe() - deutsche und amerikanische Schreibweise. null statt 0
   fuer leere Felder: ein nicht erfasstes Feld darf im Prompt nicht wie eine Null aussehen. */
function pd(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[€$\s %]/g, '');
  if (!s) return null;
  let neg = false;
  if (s.charAt(0) === '-') { neg = true; s = s.slice(1); } else if (s.charAt(0) === '+') s = s.slice(1);
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  let n;
  if (lc === -1 && ld === -1) n = parseFloat(s);
  else if (lc > ld) n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  else if (lc >= 0) n = parseFloat(s.replace(/,/g, ''));
  else {
    const dots = (s.match(/\./g) || []).length, nach = s.length - ld - 1;
    n = (dots > 1 || (dots === 1 && nach === 3)) ? parseFloat(s.replace(/\./g, '')) : parseFloat(s);
  }
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}
function txt(v) { return (v == null || String(v).trim() === '') ? null : String(v).trim(); }
function an(v) { return v === true || v === 'true' || v === '1' || v === 1 || v === 'on'; }
function json(v) { if (v && typeof v === 'object') return v; try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function eur(n) { return n == null ? '' : Math.round(n).toLocaleString('de-DE') + ' €'; }

/* Stufen der Modernisierung (mfh-einheiten.js STUFE_ZU_OBJEKT, Rueckfall wie ui.js) */
const STUFE = { '0': 'Keine/Nie', h: '10 - 20 Jahre', v: '< 5 Jahre' };
const BAUTEILE = { mod_dach: 'Dach', mod_fenster: 'Fenster', mod_leitungen: 'Leitungen', mod_heizung: 'Heizung',
  mod_aussenwand: 'Aussenwaende', mod_baeder: 'Baeder', mod_innenausbau: 'Innenausbau', mod_grundriss: 'Grundriss' };

function einheiten(d) {
  const m = json(d._mfh);
  if (!m || !Array.isArray(m.einheiten) || !m.einheiten.length) return null;
  const liste = m.einheiten.filter(Boolean);
  const z = (v) => { const n = pd(v); return n == null ? NaN : n; };
  const fl = liste.map((e) => z(e.wfl)).filter((n) => isFinite(n) && n > 0);
  const summe = fl.reduce((a, b) => a + b, 0);
  const mod = (() => {
    const g2 = m.gebaeude;
    if (!g2 || typeof g2 !== 'object') return g2 || null;
    const o = {}; let n = 0;
    Object.keys(g2).forEach((k) => { const v = g2[k]; if (v == null || v === '') return; o[k] = STUFE[String(v)] || (String(v) + ' (unbekannte Stufe)'); n++; });
    return n ? o : null;
  })();
  return {
    anzahl: liste.length,
    flaeche_summe: fl.length ? Math.round(summe) : null,
    flaeche_schnitt: fl.length ? Math.round(summe / fl.length) : null,
    je_einheit: liste.slice(0, 20).map((e) => ({
      nr: e.nr || null, wfl: z(e.wfl) || null, miete: z(e.ist) || null, art: e.art || null, status: e.status || null,
      lage: e.lage || null, etage: e.etage || null, zimmer: z(e.zimmer) || null, vertragsart: e.mv_art || null,
      letzte_erhoehung: e.mv_letzte_erhoehung || null, letzte_erhoehung_betrag: z(e.mv_letzte_erhoehung_betrag) || null,
      naechste_anpassung: e.mv_naechste_anpassung || null, befristet_bis: e.mv_befristet_bis || null,
      zustand: e.zustand || null, soll_miete: z(e.soll) || null, mietvertrag_seit: e.mv_beginn || null,
      kuendigungsverzicht_bis: e.mv_kuendigungsverzicht_bis || null, erhoehung_art: e.mv_erhoehung_art || null,
      erhoehung_wert: z(e.mv_erhoehung_wert) || null, erhoehung_rhythmus_jahre: z(e.mv_rhythmus_jahre) || null,
      stufen_offen: z(e.mv_stufen_offen) || null, massnahme: e.massnahme || null, massnahme_kosten: z(e.kosten) || null
    })),
    aufgeteilt: m.aufgeteilt != null ? !!m.aufgeteilt : null,
    gnd: Number(m.gnd) || null,
    stand: m.stand || null,
    modernisierung: mod
  };
}

/* Unterlagen wie unterlagen.js promptTeile() */
function unterlagenTeile(d) {
  const u = json(d._dok_auswertung);
  if (!u || !u.auswertung) return {};
  const a = u.auswertung;
  const zahl = (v) => pd(v);
  const r = (a.risiken || []).slice(0, 12).map((x) => '[' + (x.schwere || '') + '] ' + x.titel + ': ' + x.beschreibung
    + (zahl(x.kosten_eur) ? ' (' + eur(zahl(x.kosten_eur)) + ')' : '') + ' — ' + (x.quelle || '')).join(' | ');
  const w = a.weg ? [(a.weg.kernpunkte || []).join(' · '), a.weg.ruecklage ? 'Rücklage: ' + a.weg.ruecklage : '', a.weg.fazit || ''].filter(Boolean).join(' | ') : '';
  return {
    dok_unterlagen: (u.dokumente || []).map((x) => x.label + (x.datum ? ' ' + x.datum : '')).join(', ') || null,
    dok_risiken: r || null,
    dok_weg: w || null
  };
}

/**
 * bauen(d, R, opt) -> payload fuer openaiService.analyze()
 *   d        objects.data
 *   R        objektRechnung.rechnen() (mit Profil-Gewichten)
 *   opt.S    der geltende Score { score, breakdown } (R.S)
 *   opt.profil  flowProfil.profilAus()
 *   opt.objId   Objekt-Id (fuer den Marktbericht-Verlauf, wie im Browser)
 */
function bauen(d, R, opt) {
  opt = opt || {};
  d = d || {};
  const K = R && (R.K || R.K0) || {};
  const ut = unterlagenTeile(d);
  const p = {
    objekt: {
      plz: d.plz || '', ort: d.ort || '', str: d.str || '', hnr: d.hnr || '',
      objart: d.objart || '', wfl: pd(d.wfl) || null, baujahr: d.baujahr || '',
      makrolage: d.makrolage || '', mikrolage: d.mikrolage || '',
      lageklasse: txt(d.lageklasse),
      bevoelkerung: txt(d.ds2_bevoelkerung), nachfrage: txt(d.ds2_nachfrage),
      wertsteigerung: txt(d.ds2_wertsteigerung), entwicklung: txt(d.ds2_entwicklung),
      thesis: d.thesis || '', risiken: d.risiken || '', notizen: d.notizen || '',
      dok_unterlagen: ut.dok_unterlagen || null, dok_risiken: ut.dok_risiken || null, dok_weg: ut.dok_weg || null,
      einheiten: einheiten(d),
      wertstg_pct: pd(d.wertstg) || null,
      mietstg_pct: pd(d.mietstg) || null
    },
    kennzahlen: {
      kp: R ? R.kp : pd(d.kp), gi: K.gi != null ? K.gi : null, ek: R && R.ek != null ? R.ek : null,
      bmy: K.bmy, nmy: K.nmy != null ? K.nmy : null, dscr: R && R.darlehenGesamt > 0 ? K.dscr : null,
      ltv: R && R.darlehenGesamt > 0 ? K.ltv : null, cf_m: K.cf_m != null ? K.cf_m : null, em: null,
      ekr: K.ekr != null ? K.ekr : null, nkm_j: K.nkm_j != null ? K.nkm_j : null, bwk: K.bwk != null ? K.bwk : null
    },
    finanzierung: {
      d1z_pct: R && R.zins ? R.zins.wert : null, d1t_pct: R && R.tilg ? R.tilg.wert : null,
      d1: R && R.darlehen != null ? R.darlehen : null,
      d1_bindj: pd(d.d1_bindj), anschl_z: pd(d.anschl_z), anschl_t: pd(d.anschl_t), anschl_bj: pd(d.anschl_bj),
      restschuld_ezb: pd(d.restschuld) || pd(d._kpis_rs_bindung) || null
    },
    steuer: (() => {
      const s = {
        zve: pd(d.zve), grenzsteuersatz_pct: pd(d.grenz), afa_satz_pct: pd(d.afa_satz), afa_rnd_jahre: pd(d.afa_rnd_jahre),
        gebaeudeanteil_pct: pd(d.geb_ant), afa_eigen_pct: pd(d.afa_eigen)
      };
      const san = pd(d.san);
      if (san) s.sanierung = { kosten_eur: san, betrag_ist: txt(d.san_ust), steuerlich_angesetzt: an(d.san_tax_active), verteilung_jahre: txt(d.san_tax_years) };
      if (an(d.afa_sonder7b_aktiv)) s.sonder_afa_7b = true;
      if (an(d._erbpacht)) s.erbbaurecht = { ja: true, erbbauzins_eur_jahr: pd(d.erbbauzins) || null };
      return s;
    })(),
    bewirtschaftung: {
      hausgeld_umlagefaehig: pd(d.hg_ul), hausgeld_nicht_umlagefaehig: pd(d.hg_nul), grundsteuer: pd(d.grundsteuer),
      weg_ruecklage: pd(d.weg_r), eigene_ruecklage: pd(d.eigen_r), mietausfall_pct: pd(d.mietausfall)
    },
    mietentwicklung: (() => {
      const m = txt(d.me_modus);
      const aus = {
        modus: m,
        herkunft: m === 'einheiten' ? 'Aus den Mietverträgen der einzelnen Wohnungen'
          : (m === 'detail' ? 'Stufenplan von Hand' : 'Gleichmaessige Steigerung je Jahr'),
        mietspiegel_eur_qm: pd(d.mietspiegel), leerstand_pct: pd(d.leerstand), umlagefaehig: pd(d.umlagef)
      };
      if (m !== 'einheiten') {
        aus.soll_eur_qm = pd(d.me_soll); aus.schritte = pd(d.me_anz); aus.intervall_jahre = pd(d.me_int); aus.schritt_pct = pd(d.me_pct);
      }
      return aus;
    })(),
    ankauf: (() => {
      const a = json(d._ankauf);
      if (!a || !a.daten || typeof a.daten !== 'object') return null;
      return { stichtag: a.stichtag || null, festgeschrieben_am: a.am || null, korrekturen: (a.korrekturen || []).length,
        kennzahlen_damals: a.kurz || null, abweichung: null };
    })(),
    wohnung: {
      zimmer: pd(d.zimmer), baeder: pd(d.bad_anz), etage: txt(d.etage), etagen_gesamt: pd(d.etagen_ges),
      garagen: pd(d.garagen), stellplaetze_aussen: pd(d.stellpl_aussen), balkon_qm: pd(d.balkon_flae), grundriss: txt(d.grundriss)
    },
    boden: {
      bodenrichtwert_eur_qm: pd(d.brw), brw_stichtag: txt(d.brw_stichtag), grundstueck_qm: pd(d.gsfl),
      miteigentumsanteil_pct: pd(d.mea), bgf_qm: pd(d.bgf), standardstufe: txt(d.standardstufe),
      sachwertfaktor: pd(d.sachwertfaktor), liegenschaftszins_pct: pd(d.lzs_pct), nutzungsart: txt(d.nutzungsart)
    },
    halter: {
      name: txt(d.halter), seit: txt(d.halter_seit), kaufdatum: txt(d.kaufdat),
      wirtschaftlicher_uebergang: txt(d.wirtschaftlicher_uebergang), vermietungsstand: txt(d.vermstand)
    },
    zustand: (() => {
      const bauteile = {}; let n = 0;
      Object.keys(BAUTEILE).forEach((id) => { const v = String(d[id] || '').trim(); if (!v) return; bauteile[BAUTEILE[id]] = v; n++; });
      const z = { ds2_zustand: txt(d.ds2_zustand), energieklasse: txt(d.ds2_energie), modernisierung: txt(d.modernis), modernisierungspunkte: pd(d.mod_punkte) };
      if (n) z.bauteile = bauteile;
      return z;
    })(),
    dealscore: (() => {
      const S = opt.S;
      if (!S || S.score == null) return {};
      const snap = { total: S.score, label: S.label || null, color: S.color || null };   /* wie DealScore.snapshot() */
      (S.breakdown || []).forEach((b) => {
        if (b.score == null) return;
        if (b.key === 'cashflow') snap.cf_score = Math.round(b.score);
        if (b.key === 'rendite') snap.rendite_score = Math.round(b.score);
        if (b.key === 'ltv') snap.ltv_score = Math.round(b.score);
        if (b.key === 'risiko') snap.dscr_score = Math.round(b.score);
        if (b.key === 'potenzial') snap.potenzial_score = Math.round(b.score);
      });
      return snap;
    })(),
    objId: opt.objId || null,
    herkunft: (() => { const o = json(d._dp_herkunft); return (o && typeof o === 'object' && Object.keys(o).length) ? o : null; })(),
    marktbewertung: { marktwert: pd(d.svwert) || null, marktmiete_qm: pd(d.ds2_marktmiete) || null }
  };
  /* Marktradar (_avm_state) und Vermarktungsdauer, wie ui.js v589/v671 */
  try {
    const avm = json(d._avm_state);
    const map = (avm && avm.avm) ? avm.avm : {};
    const mr = Object.keys(map).map((pk) => {
      const r = map[pk] || {}; const e = { provider: r.provider || pk };
      if (r.marktwert != null) e.marktwert = r.marktwert;
      if (r.low != null) e.low = r.low;
      if (r.high != null) e.high = r.high;
      const k = r.konfidenz != null ? r.konfidenz : (r.confidence != null ? r.confidence : (r.confidence_label != null ? r.confidence_label : null));
      if (k != null) e.konfidenz = k;
      return e;
    });
    if (mr.length) p.marktradar = mr;
  } catch (e) {}
  try {
    const os = d._immometrica_online_since;
    if (os) {
      const od = new Date(String(os).slice(0, 10));
      if (!isNaN(od.getTime())) p.verhandlung = { inseriert_seit: String(os).slice(0, 10), tage_online: Math.max(0, Math.round((Date.now() - od.getTime()) / 86400000)) };
    }
  } catch (e) {}
  try {
    const mb = json(d._mb_state);
    const card = mb && mb.card;
    if (card) {
      const lbl = (raw) => { if (raw == null) return null; const s = raw / 10;
        return { label: s >= 8 ? 'sehr_gut' : s >= 6 ? 'gut' : s >= 4 ? 'durchschnittlich' : s >= 2 ? 'schwach' : 'sehr_schwach', score: Math.round(s * 10) / 10 }; };
      const o = {};
      const mi = lbl(card.microRaw), ma = lbl(card.macroRaw);
      if (mi) o.mikrolage = mi;
      if (ma) o.makrolage = ma;
      if (card.trendRaw != null) o.wertentwicklung_pct_pa = card.trendRaw;
      if (card.mw && card.mw.med != null) o.marktwert = card.mw.med;
      if (card.marktkontext) o.marktkontext = card.marktkontext;
      if (card.erbbaurecht) o.erbbaurecht = card.erbbaurecht;
      if (Object.keys(o).length) p.dealpilot_marktbewertung = o;
    }
  } catch (e) {}
  /* Investmentprofil wie ui.js v2140/v2140b: Wert plus Liste dessen, was der Nutzer selbst gesetzt hat */
  try {
    const ip = (opt.profil && opt.profil.investment) || {};
    const prof = {}, gesetzt = [];
    [['min_dscr', 'min_dscr'], ['min_cashflow_vor_st', 'min_cashflow_vor_st'], ['max_ltv', 'max_ltv'],
     ['strategie', 'ai_strat'], ['risikoneigung', 'ai_risk']].forEach(([k, roh]) => {
      if (ip[roh] == null || ip[roh] === '') return;
      prof[k] = ip[roh]; gesetzt.push(k);
    });
    if (Object.keys(prof).length) { prof._selbst_gesetzt = gesetzt; p.investor_profil = prof; }
  } catch (e) {}
  return p;
}

module.exports = { bauen, pd, einheiten, unterlagenTeile };
