'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/flowBerechnung.js — v3289 · Flow Investor, Punkt 1
 *
 * POST /api/v1/objects/:id/berechnen: Kennzahlen und Quick-Check eines
 * gespeicherten Objekts auf dem Server, fuer den Makler-Hub (DealPilot Flow).
 * Auftrag: Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md.
 *
 *   · Gerechnet wird mit services/rechenkerne.js (DealKpis, DealScore,
 *     QcHeuristik - die gespiegelten Dateien der App) ueber DIESELBE Abbildung
 *     wie der Telegram-Bot: objektRechnung.rechnen() / bewerten().
 *   · Das Investmentprofil des Kontos kommt als PARAMETER an die Kerne:
 *     Score-Gewichte (browser_vorgaben: dp_dealscore2_preset/_eigen/_weights),
 *     Ampel-Schwellen (dp_investment_profile: min_dscr, max_ltv,
 *     min_cashflow_vor_st), Zielrendite der Lageklasse (lage_profil) und
 *     fehlende Finanzierungs-/Nebenkostensaetze (Profil, nur was gesetzt ist).
 *     Kein Kern liest selbst eine Einstellung.
 *   · Der Score wird IMMER neu gerechnet (der Hub aendert Preise, ein am
 *     Objekt gespeicherter Browser-Score waere dann veraltet). Der gespeicherte
 *     steht als `score_app` daneben.
 *   · Ergebnis am Objekt unter data._flow_berechnung, mit optimistischer
 *     Sperre (Version), damit Co-Pilot und Portfolio-Spiegel es kennen.
 *   · Kostenlos: kein Abruf, keine KI. Eine vorhandene Marktpreisindikation
 *     wird GELESEN (avm_valuations), nie abgerufen.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { query } = require('../db/pool');
const { HttpError } = require('../middleware/errors');
const objektRechnung = require('./objektRechnung');
const rechenkerne = require('./rechenkerne');
const vorgaben = require('./botVorgabenService');
const dialog = require('./telegramDialogService');

let _werkzeuge = null;
function werkzeuge() { return _werkzeuge || (_werkzeuge = require('./agentWerkzeuge')); }

/* Namen der Bewertungsprofile, wie dealscore2.js sie zeigt (v2548). */
const PROFIL_NAME = {
  balanced: 'Ausgewogen', conservative: 'Vorsichtig', optimistic: 'Renditeorientiert',
  lage: 'Lage-Fokus', cashflow: 'Cashflow-Fokus', sicherheit: 'Sicherheit', custom: 'Eigene Gewichte'
};

/* Fehlende Saetze aus dem Investmentprofil — nur, was der Nutzer dort GESETZT hat. Die Vorgaben der
   App (config.js investmentProfileDefaults) werden hier nicht eingesetzt: ein Standardwert, den
   niemand gesetzt hat, ist eine Annahme mit Hausrecht (botVorgabenService.js). */
const PROFIL_SAETZE = [
  ['d1z', 'zins_override'], ['d1t', 'tilgung_default'], ['d1_bindj', 'zinsbindung_default'],
  ['notar_p', 'notar_pct'], ['gba_p', 'grundbuch_pct'], ['makler_p', 'maklerkosten']
];

function _json(w) {
  if (typeof w === 'string') { try { return JSON.parse(w); } catch (e) { return null; } }
  return w || null;
}
function _zahl(v) {
  if (v == null || v === '') return null;
  const n = (typeof v === 'number') ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function _r(x, stellen) {
  if (x == null || !Number.isFinite(Number(x))) return null;
  const f = Math.pow(10, stellen);
  return Math.round(Number(x) * f) / f;
}

/** Das Profil des Kontos, so wie der Browser es hochlaedt (vorgaben-sync.js, v3024). */
async function profilLesen(userId) {
  const r = await query(
    'SELECT schluessel, wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = ANY($2)',
    [userId, ['browser_vorgaben', 'lage_profil']]);
  const e = {};
  r.rows.forEach((x) => { e[x.schluessel] = x; });
  return profilAus(e.browser_vorgaben ? _json(e.browser_vorgaben.wert) : null,
    e.lage_profil ? _json(e.lage_profil.wert) : null,
    [e.browser_vorgaben, e.lage_profil].filter(Boolean).map((x) => x.updated_at));
}

/** Rein (ohne DB) - auch fuer tools/flow-berechnen-pruefen.mjs. */
function profilAus(browserVorgaben, lageProfil, staende) {
  const keys = (browserVorgaben && browserVorgaben.keys) || {};
  const ip = _json(keys.dp_investment_profile) || {};
  const ds = {
    preset: keys.dp_dealscore2_preset || null,
    eigen: keys.dp_dealscore_eigen || null,
    weights: keys.dp_dealscore_weights || null
  };
  const t = (staende || []).map((x) => new Date(x).getTime()).filter((x) => Number.isFinite(x));
  const presetGilt = ds.preset && PROFIL_NAME[ds.preset] ? ds.preset : 'balanced';
  const name = (ds.eigen === '1' || ds.eigen === true) ? 'Eigene Gewichte' : PROFIL_NAME[presetGilt];
  /* Ampel-Schwellen wie schwellen.js get(): nur die drei Werte, den Rest leitet der Kern ab
     (qc-heuristik.js _schwellenOk). Fehlt einer, gilt seine Vorgabe 1,2 / 90 / 0. */
  const schwellen = {};
  const md = _zahl(ip.min_dscr), ml = _zahl(ip.max_ltv), mc = _zahl(ip.min_cashflow_vor_st);
  if (md != null && md > 0) schwellen.dscrGruen = md;
  if (ml != null && ml > 0) schwellen.ltvGruen = ml;
  if (mc != null) schwellen.cfMin = mc;
  return {
    vorhanden: !!browserVorgaben,
    name: name, preset: presetGilt,
    geaendert: t.length ? new Date(Math.max.apply(null, t)).toISOString() : null,
    investment: ip, lage: lageProfil || null, ds: ds, schwellen: schwellen
  };
}

/** Die Ergaenzung des Bots (Objekt > Bot-Vorgaben > Richtwert) plus das Investmentprofil fuer Luecken. */
function ergMitProfil(erg, profil, d) {
  const ip = (profil && profil.investment) || {};
  erg.quelle = erg.quelle || {};
  PROFIL_SAETZE.forEach(([fid, k]) => {
    if (erg.vorhanden[fid] != null || erg.vom_nutzer[fid] != null) return;
    const n = _zahl(ip[k]);
    const grenze = vorgaben.ERLAUBT[fid];
    if (n == null || (grenze && (n < grenze.min || n > grenze.max))) return;
    erg.vom_nutzer[fid] = n;
    erg.quelle[fid] = 'Investmentprofil';
    const i = erg.fehlt.indexOf(fid);
    if (i >= 0) erg.fehlt.splice(i, 1);
  });
  /* Eigenkapitalquote nur, wenn am Objekt kein Eigenkapital steht. */
  const ekObjekt = d && d.ek != null && String(d.ek).trim() !== '';
  if (erg.vom_nutzer.ek_quote == null && !ekObjekt) {
    const n = _zahl(ip.ek_quote_default);
    if (n != null && n >= 0 && n <= 100) { erg.vom_nutzer.ek_quote = n; erg.quelle.ek_quote = 'Investmentprofil'; }
  }
  return erg;
}

const AMPEL = { 'qc-rec-green': 'gruen', 'qc-rec-gold': 'gelb', 'qc-rec-red': 'rot' };

/**
 * Rechnet ein Objekt. Rein bis auf die Marktpreisindikation (optional per Funktion).
 *   d         objects.data
 *   erg       botVorgabenService.ergaenzung() (+ ergMitProfil)
 *   profil    profilAus()
 *   opt.markt { basis, grund } bereinigter Marktwert oder null
 *   opt.kerne nur fuer den Pruefer
 */
function ergebnisBauen(d, erg, profil, opt) {
  opt = opt || {};
  const gespeichert = dialog.scoreLesen(d);
  const gewichte = (opt.kerne || rechenkerne).scoreGewichte(profil.ds);
  const R = objektRechnung.rechnen(d, { erg: erg, gespeichert: gespeichert, gewichte: gewichte, kerne: opt.kerne });
  if (R.pflicht.length) return { ok: false, status: 422, fehlt: R.pflicht, R: R };
  if (R.kernFehlt) return { ok: false, status: 503, fehlt: ['Rechenkern'], R: R };

  const zielBmr = objektRechnung.zielBmrAusProfil(profil.lage, d.lageklasse);
  const score = R.S ? R.S.score : null;
  const B = score != null
    ? objektRechnung.bewerten(R, score, { teilnoten: R.teilnotenRoh, zielBmr: zielBmr, schwellen: profil.schwellen,
      marktBasis: opt.markt ? opt.markt.basis : null, marktGrund: opt.markt ? opt.markt.grund : null, kerne: opt.kerne })
    : null;
  const K = R.K, K0 = R.K0, mitDarlehen = R.darlehenGesamt > 0;
  const E = B && B.H ? B.H.empfehlung : null;
  const ziel = E && Number.isFinite(E.ziel_kp) ? E.ziel_kp : null;

  const annahmen = [];
  if (R.zins && R.zins.quelle !== 'am Objekt') annahmen.push('Zinssatz ' + R.zins.wert + ' % (' + R.zins.quelle + ')');
  if (R.tilg && R.tilg.quelle !== 'am Objekt') annahmen.push('Tilgung ' + R.tilg.wert + ' % (' + R.tilg.quelle + ')');
  R.knk.posten.forEach((p) => {
    if (p.fehlt) annahmen.push(p.name + ': kein Satz bekannt, fehlt in den Nebenkosten');
    else if (p.quelle !== 'am Objekt') annahmen.push(p.name + ' ' + p.satz + ' % (' + p.quelle + ')');
  });
  if (R.darlehenAbgeleitet && K) annahmen.push('Darlehen abgeleitet: Gesamtinvestition minus Eigenkapital'
    + (R.ekQuote != null ? ' (' + R.ekQuote + ' % Eigenkapital laut ' + ((erg.quelle && erg.quelle.ek_quote) || 'Vorgabe') + ')' : ''));
  if (K && !mitDarlehen) annahmen.push('Kein Darlehen: gerechnet wie ein Barkauf, DSCR und LTV entfallen');
  if (R.wpAngenommen) annahmen.push('Wertpuffer angenommen: 5 % vom Kaufpreis (kein Verkehrswert am Objekt)');
  if (R.svwIndikation) annahmen.push('Marktpreisindikation aus Angebotspreisen traegt keinen Wertpuffer');

  const kennzahlen = {
    kaufpreis: R.kp,
    nebenkosten: _r(R.knk.summe, 2),
    nebenkosten_vollstaendig: R.knk.vollstaendig,
    gesamtinvest: K ? _r(K.gi, 2) : _r(R.kp + R.knk.summe, 2),
    nkm_jahr: _r((K || K0).nkm_j, 2),
    bruttorendite: _r((K || K0).bmy, 4),
    nettorendite: K ? _r(K.nmy, 4) : null,
    faktor: _r((K || K0).fak, 4),
    cashflow_vor_steuer_monat: K ? _r(K.cf_m, 2) : null,
    dscr: (K && mitDarlehen) ? _r(K.dscr, 4) : null,
    ltv: (K && mitDarlehen) ? _r(K.ltv, 4) : null,
    ek_bedarf: K ? _r(Math.max(0, K.gi - (R.darlehenGesamt || 0)), 2) : null,
    /* dazu, damit der Hub die Zahlen pruefen kann */
    darlehen: K ? _r(R.darlehenGesamt, 2) : null,
    eigenkapital: K ? _r(R.ek, 2) : null,
    kapitaldienst_jahr: K ? _r(K.rate_j, 2) : null,
    bewirtschaftung_jahr: R.bwk.da ? _r(R.bwk.ul + R.bwk.nul, 2) : null,
    bewirtschaftung_nicht_umlagefaehig_jahr: R.bwk.da ? _r(R.bwk.nul, 2) : null,
    cashflow_nach_steuer_monat: K ? _r(K.cf_ns_m, 2) : null
  };
  const quickcheck = {
    ampel: E ? (AMPEL[E.farbklasse] || null) : null,
    score: score,
    stufe: score != null ? (opt.kerne || rechenkerne).stufe(score).wort : null,
    empfehlung: E ? E.verdict : null,
    empfehlung_text: E ? E.text : null,
    gruende: B && B.H ? (B.H.einschaetzung || []).slice() : [],
    noetige_preissenkung_pct: (ziel != null && R.kp > 0 && ziel < R.kp) ? _r((1 - ziel / R.kp) * 100, 1) : (ziel != null ? 0 : null),
    zielpreis: ziel != null ? Math.round(ziel) : null,
    grenze: (R.S && R.S.deckel && R.S.score_ohne_deckel > R.S.score) ? R.S.deckel : null,   /* nur, wenn sie greift */
    teilnoten: R.S ? R.S.breakdown.map((b) => ({ key: b.key, was: b.label, punkte: b.score == null ? null : _r(b.score, 1),
      gewicht: b.weight, grundlage: b.input })) : null,
    kennzahlen_ampel: B ? B.ampel : null,
    fehlt: R.scoreFehlt.length ? R.scoreFehlt : undefined,
    /* der im Browser gespeicherte Score (Vollbild) - zum Vergleich, er gilt hier nicht */
    score_app: gespeichert.dealscore
  };
  return {
    ok: true, R: R,
    ergebnis: {
      kennzahlen: kennzahlen,
      quickcheck: quickcheck,
      annahmen: annahmen,
      profil: { name: profil.name, geaendert: profil.geaendert, vorhanden: profil.vorhanden,
        gewichte: gewichte, schwellen: profil.schwellen, ziel_bmr_lage: zielBmr, lageklasse: d.lageklasse || null },
      marktpreisindikation: opt.markt ? { marktwert_bereinigt: _r(opt.markt.basis, 0), grund: opt.markt.grund || null } : null
    }
  };
}

/**
 * berechnen(userId, objectId, { expectedVersion, speichern }) — der Weg der Route.
 * 404 ohne Objekt, 409 bei Versionskonflikt, 422 ohne Kaufpreis/Miete.
 */
async function berechnen(userId, objectId, opts) {
  opts = opts || {};
  const r = await query('SELECT id, data, version FROM objects WHERE id = $1 AND user_id = $2', [objectId, userId]);
  if (!r.rowCount) throw new HttpError(404, 'Object not found');
  const row = r.rows[0];
  if (opts.expectedVersion != null && row.version !== opts.expectedVersion) {
    throw new HttpError(409, 'Version conflict (expected ' + opts.expectedVersion + ', got ' + row.version + ')');
  }
  let d = row.data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
  d = d || {};

  const profil = await profilLesen(userId);
  const erg = ergMitProfil(await vorgaben.ergaenzung(userId, d), profil, d);

  /* Die Marktpreisindikation wird GELESEN, wenn es eine gibt (wie im Bot, v1939) - nie abgerufen. */
  let markt = null;
  try {
    const kp = objektRechnung.z(d.kp);
    if (kp) {
      const mpi = await werkzeuge()._marktpreisIndikation(userId, objectId, d, kp);
      if (mpi && mpi.vergleich && mpi.vergleich._basis) markt = { basis: mpi.vergleich._basis, grund: mpi.vergleich._abschlag_grund || null };
    }
  } catch (e) { markt = null; }

  const b = ergebnisBauen(d, erg, profil, { markt: markt });
  if (!b.ok) {
    const err = new HttpError(b.status, b.status === 422
      ? 'Ohne ' + b.fehlt.join(' und ') + ' lässt sich nichts rechnen.'
      : 'Der Rechenkern ist gerade nicht ladbar.');
    err.code = b.status === 422 ? 'FLOW_ANGABEN_FEHLEN' : 'RECHENKERN_FEHLT';
    throw err;
  }
  const jetzt = new Date().toISOString();
  const herkunft = rechenkerne.herkunft();
  const ergebnis = Object.assign({ objekt_id: objectId }, b.ergebnis, {
    berechnet_at: jetzt,
    kern: { erzeugt_am: herkunft.erzeugt_am || null, abbildung: 'objektRechnung v3289' }
  });

  if (opts.speichern === false) return Object.assign(ergebnis, { gespeichert: false, version: row.version });

  /* Optimistische Sperre: gespeichert wird nur, wenn das Objekt seit dem Lesen unveraendert ist -
     sonst gehoert das Ergebnis zu einem Stand, den es nicht mehr gibt (409, neu rechnen). */
  const ablage = Object.assign({}, ergebnis, { version: row.version + 1 });
  const w = await query(
    `UPDATE objects
        SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{_flow_berechnung}', $1::jsonb, true),
            version = version + 1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3 AND version = $4
      RETURNING version`,
    [JSON.stringify(ablage), objectId, userId, row.version]);
  if (!w.rowCount) throw new HttpError(409, 'Version conflict: das Objekt wurde während der Berechnung geändert - bitte neu berechnen.');
  return Object.assign(ergebnis, { gespeichert: true, version: w.rows[0].version });
}

module.exports = { berechnen, ergebnisBauen, profilLesen, profilAus, ergMitProfil, PROFIL_SAETZE, PROFIL_NAME };
