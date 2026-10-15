'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   DealPilot v2245 – bauzinsService.js
   MARKTABHAENGIGER, DYNAMISCHER INDIKATIVER BAUZINS

   Marcel am 15.10.2026: "baue den mal genauso wie vorgeschlagen".

     Bauzins(Bindung b, LTV) = Bund_b(heute) + A_mfi(b) + K + Z(LTV)

   Bund_b    taegliche Rendite der Bundeswertpapiere, Restlaufzeit b Jahre
             (Bundesbank BBSIS, Zinsstruktur am Rentenmarkt).
   A_mfi(b)  monatlicher Marktaufschlag der Banken: MFI-Effektivzins
             Wohnungsbaukredite Neugeschaeft (BBIM1) MINUS Monatsschnitt
             der Bund-Rendite gleicher Laufzeit im selben Monat. Immer der
             LETZTE veroeffentlichte Monat (Verzug rund sechs Wochen).
   K         Kalibrierkonstante auf Angebotsniveau bei 80 % Beleihung.
   Z(LTV)    Beleihungszuschlag relativ zu 80 %, linear zwischen
             Stuetzstellen.

   WARUM NICHT MEHR PFANDBRIEF + FESTE MARGE (v210 bis v2242):
   Die Marge der Banken ist keine Konstante. Gemessen schwankte der
   Aufschlag MFI minus Bund 10 in 13 Monaten zwischen 0,56 und 0,87
   Prozentpunkten. Eine feste Marge rechnet dann je nach Monat bis zu
   0,3 Punkte daneben - und nichts widerspricht. Der MFI-Zins ist das,
   was Banken in Deutschland tatsaechlich abgeschlossen haben; der
   Abstand zur Bundesanleihe ist damit gemessen statt angenommen.

   WAS MIT AUSFALL PASSIERT:
     1. Bundesbank erreichbar     -> frische Werte, in die DB geschrieben
     2. Bundesbank weg, DB da     -> letzter gespeicherter Stand
     3. beides weg                -> STATISCHER_STAND unten (gemessen)
   Die Quelle steht in jeder Antwort (quelle: live | db | static).

   Takt: taeglich 18:00 Serverzeit plus einmal beim Start, wenn der
   letzte Abruf aelter als ein Tag ist (index.js -> starteTakt()).
═══════════════════════════════════════════════════════════════════════ */

const BBSIS = 'https://api.statistiken.bundesbank.de/rest/data/BBSIS';
const BBIM1 = 'https://api.statistiken.bundesbank.de/rest/data/BBIM1';
const ACCEPT_JSON = 'application/vnd.sdmx.data+json;version=1.0.0';

const LAUFZEITEN = [5, 10, 15, 20];

function _rl(b) { return (b < 10 ? '0' : '') + b; }
function bundKey(b)       { return 'D.I.ZST.ZI.EUR.S1311.B.A604.R' + _rl(b) + 'XX.R.A.A._Z._Z.A'; }
function pfandbriefKey(b) { return 'D.I.ZAR.ZI.EUR.S122.B.A100.R' + _rl(b) + 'XX.R.A.A._Z._Z.A'; }
function mfiKey(reihe)    { return 'M.DE.B.A2C.' + reihe + '.R.A.2250.EUR.N'; }

/* Zuordnung Zinsbindung -> MFI-Reihe. Die MFI-Statistik kennt nur drei
   Baender (I = ueber 1 bis 5 J, O = ueber 5 bis 10 J, P = ueber 10 J);
   15 und 20 Jahre teilen sich P, werden aber gegen IHRE Bund-Laufzeit
   gestellt - der Aufschlag gilt jeweils auf die passende Anleihe. */
const MFI_REIHE = { 5: 'I', 10: 'O', 15: 'P', 20: 'P' };

/* K - KALIBRIERKONSTANTE. Nachkalibrieren: Angebotszins 10 J / 80 %
   gegen Bund 10 (Tag) + Aufschlag (letzter Monat) stellen, die
   Differenz ist das neue K. Datum und Bezug mit fortschreiben. */
const K_KALIBRIERUNG = {
  wert: 0.27,
  stand: '2026-10-15',
  bezug: '10 J Zinsbindung, 80 % Beleihung',
  begruendung: 'Angebotsniveau am 15.10.2026: 4,34 % = Bund 10 (3,51) + Aufschlag 08/2026 (0,56) + K. '
             + 'Der MFI-Zins ist ein Durchschnitt ALLER Abschluesse (auch sehr gute Bonitaeten, '
             + 'niedrige Beleihung, Verhandlungsergebnisse); ein Angebot bei 80 % liegt darueber.'
};

/* Z(LTV) - Beleihungszuschlag relativ zu 80 %, Prozentpunkte.
   Unter 60 % gilt der 60er-Wert, ab 110 % der 110er-Wert. */
const LTV_STUETZSTELLEN = [
  [60, -0.20],
  [70, -0.10],
  [80,  0.00],
  [90,  0.22],
  [100, 0.45],
  [110, 0.95]
];

/* Die drei Stufen der bisherigen Oberflaeche (premium / standard /
   schwach) bleiben als feste Beleihungen erhalten - abwaertskompatibel
   fuer jeden, der indicativeRates[b][stufe] liest. */
const STUFEN_LTV = { premium: 60, standard: 80, schwach: 90 };

/* Letztes Sicherheitsnetz, gemessen an der Bundesbank-API am 15.10.2026
   (tools/bauzins-pruefen.mjs). Nur fuer den Fall, dass weder die API
   noch die Datenbank antworten. */
const STATISCHER_STAND = {
  datum: '2026-10-14',
  bund: { 5: 3.23, 10: 3.51, 15: 3.70, 20: 3.80 },
  aufschlag_monat: '2026-08',
  aufschlag: { 5: 0.558, 10: 0.558, 15: 0.558, 20: 0.558 }   /* v2246: ein Aufschlag (5-10 J) */
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const HISTORIE_TAGE_ERST = 460;   // 13 volle Monate Aufschlag samt MFI-Verzug
const HISTORIE_TAGE_FOLGE = 110;   // deckt den MFI-Verzug (rund 6 Wochen) samt vollem Vormonat

function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }
function _num(x) { var n = (x == null) ? NaN : Number(x); return isFinite(n) ? n : null; }

/* ───────────────────────── Beleihungszuschlag ───────────────────────── */
function zuschlagLtv(ltv) {
  var l = _num(ltv);
  if (l == null) return 0;
  var S = LTV_STUETZSTELLEN;
  if (l <= S[0][0]) return S[0][1];
  if (l >= S[S.length - 1][0]) return S[S.length - 1][1];
  for (var i = 1; i < S.length; i++) {
    if (l <= S[i][0]) {
      var a = S[i - 1], b = S[i];
      return r3(a[1] + (b[1] - a[1]) * (l - a[0]) / (b[0] - a[0]));
    }
  }
  return 0;
}

/* ───────────────────────── Bundesbank-Abruf ───────────────────────── */
async function _sdmx(flow, key, params) {
  var qs = Object.keys(params || {}).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  var url = flow + '/' + key + (qs ? '?' + qs : '');
  var res = await fetch(url, {
    headers: { 'Accept': ACCEPT_JSON, 'User-Agent': 'DealPilot/1.0' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' fuer ' + key);
  var j = await res.json();
  var d = j && j.data;
  if (!d || !d.dataSets || !d.dataSets[0]) throw new Error('leere Antwort fuer ' + key);
  var serien = d.dataSets[0].series || {};
  var sk = Object.keys(serien)[0];
  if (!sk) return [];
  var obs = serien[sk].observations || {};
  var zeit = d.structure.dimensions.observation[0].values;
  var aus = [];
  Object.keys(obs).forEach(function (i) {
    var v = obs[i] && obs[i][0];
    var n = (v == null || v === '') ? null : Number(v);   // Wochenend-/Feiertagswerte sind leer
    if (n == null || !isFinite(n)) return;
    aus.push({ period: zeit[Number(i)].id, value: n });
  });
  aus.sort(function (a, b) { return a.period < b.period ? -1 : 1; });
  return aus;
}

function _isoTag(d) { return d.toISOString().slice(0, 10); }
function _tageZurueck(n) { return _isoTag(new Date(Date.now() - n * 86400000)); }

/* Holt Bund + Pfandbrief taeglich ab `ab` und die MFI-Monatswerte.
   Liefert dieselbe Datenform, die auch aus der DB kommt. */
async function abrufenLive(opts) {
  opts = opts || {};
  var ab = opts.ab || _tageZurueck(HISTORIE_TAGE_ERST);
  var auftraege = [];
  LAUFZEITEN.forEach(function (b) {
    auftraege.push(_sdmx(BBSIS, bundKey(b), { startPeriod: ab }).then(function (r) { return { art: 'bund', b: b, r: r }; }));
    auftraege.push(_sdmx(BBSIS, pfandbriefKey(b), { startPeriod: ab }).then(function (r) { return { art: 'pf', b: b, r: r }; })
      .catch(function (e) { console.warn('[bauzins] Pfandbrief ' + b + ' J: ' + e.message); return { art: 'pf', b: b, r: [] }; }));
  });
  ['I', 'O', 'P'].forEach(function (reihe) {
    auftraege.push(_sdmx(BBIM1, mfiKey(reihe), { lastNObservations: 16 }).then(function (r) { return { art: 'mfi', reihe: reihe, r: r }; }));
  });
  var erg = await Promise.all(auftraege);   // Bund oder MFI fehlt -> ganzer Abruf gilt als gescheitert

  var tageMap = {};   // b -> datum -> {bund, pfandbrief}
  var mfi = {};       // reihe -> [{period, value}]
  LAUFZEITEN.forEach(function (b) { tageMap[b] = {}; });
  erg.forEach(function (e) {
    if (e.art === 'mfi') { mfi[e.reihe] = e.r; return; }
    e.r.forEach(function (o) {
      var z = tageMap[e.b][o.period] || (tageMap[e.b][o.period] = { datum: o.period, bund: null, pfandbrief: null });
      if (e.art === 'bund') z.bund = o.value; else z.pfandbrief = o.value;
    });
  });
  var tage = {};
  LAUFZEITEN.forEach(function (b) {
    tage[b] = Object.keys(tageMap[b]).sort().map(function (k) { return tageMap[b][k]; });
  });

  /* Monatsaufschlag: nur fuer Monate, die im Abruffenster VOLLSTAENDIG
     liegen - ein angeschnittener Monat ergaebe einen falschen Schnitt. */
  var abMonat = ab.slice(0, 7);
  var monate = {};
  LAUFZEITEN.forEach(function (b) {
    monate[b] = [];
    (mfi[MFI_REIHE[b]] || []).forEach(function (o) {
      var m = o.period.slice(0, 7);
      if (m <= abMonat && ab.slice(8, 10) !== '01') return;
      if (m < abMonat) return;
      var werte = tage[b].filter(function (t) { return t.bund != null && t.datum.slice(0, 7) === m; }).map(function (t) { return t.bund; });
      if (werte.length < 10) return;   // zu wenige Handelstage fuer einen Monatsschnitt
      var avg = werte.reduce(function (s, x) { return s + x; }, 0) / werte.length;
      monate[b].push({ monat: m, mfi: r3(o.value), bund_avg: r3(avg), aufschlag: r3(o.value - avg), reihe: MFI_REIHE[b] });
    });
  });
  return { tage: tage, monate: monate, quelle: 'live', abgerufen: new Date().toISOString() };
}

/* ───────────────────────── Datenbank ───────────────────────── */
function _db() { return require('../db/pool'); }

async function speichern(daten) {
  var db = _db();
  var d = [], l = [], bu = [], pf = [];
  LAUFZEITEN.forEach(function (b) {
    (daten.tage[b] || []).forEach(function (t) { d.push(t.datum); l.push(b); bu.push(t.bund); pf.push(t.pfandbrief); });
  });
  var n1 = 0, n2 = 0;
  if (d.length) {
    var r = await db.query(
      'INSERT INTO markt_zins_tag (datum, laufzeit, bund, pfandbrief) ' +
      'SELECT * FROM unnest($1::date[], $2::smallint[], $3::numeric[], $4::numeric[]) ' +
      'ON CONFLICT (datum, laufzeit) DO UPDATE SET ' +
      '  bund = COALESCE(EXCLUDED.bund, markt_zins_tag.bund), ' +
      '  pfandbrief = COALESCE(EXCLUDED.pfandbrief, markt_zins_tag.pfandbrief), ' +
      '  abgerufen_at = now()', [d, l, bu, pf]);
    n1 = r.rowCount;
  }
  var mo = [], ml = [], mm = [], mb = [], ma = [], mr = [];
  LAUFZEITEN.forEach(function (b) {
    (daten.monate[b] || []).forEach(function (m) {
      mo.push(m.monat + '-01'); ml.push(b); mm.push(m.mfi); mb.push(m.bund_avg); ma.push(m.aufschlag); mr.push(m.reihe || MFI_REIHE[b]);
    });
  });
  if (mo.length) {
    var r2_ = await db.query(
      'INSERT INTO markt_bauzins_monat (monat, laufzeit, mfi, bund_avg, aufschlag, reihe) ' +
      'SELECT * FROM unnest($1::date[], $2::smallint[], $3::numeric[], $4::numeric[], $5::numeric[], $6::text[]) ' +
      'ON CONFLICT (monat, laufzeit) DO UPDATE SET mfi = EXCLUDED.mfi, bund_avg = EXCLUDED.bund_avg, ' +
      '  aufschlag = EXCLUDED.aufschlag, reihe = EXCLUDED.reihe, abgerufen_at = now()', [mo, ml, mm, mb, ma, mr]);
    n2 = r2_.rowCount;
  }
  return { tage: n1, monate: n2 };
}

async function ladenAusDb() {
  var db = _db();
  var t = await db.query(
    "SELECT to_char(datum, 'YYYY-MM-DD') AS datum, laufzeit, bund, pfandbrief, abgerufen_at " +
    "FROM markt_zins_tag WHERE datum >= CURRENT_DATE - 460 ORDER BY datum");
  if (!t.rows.length) return null;
  var m = await db.query(
    "SELECT to_char(monat, 'YYYY-MM') AS monat, laufzeit, mfi, bund_avg, aufschlag, reihe " +
    "FROM markt_bauzins_monat WHERE monat >= CURRENT_DATE - 760 ORDER BY monat");
  var tage = {}, monate = {}, letzt = 0;
  LAUFZEITEN.forEach(function (b) { tage[b] = []; monate[b] = []; });
  t.rows.forEach(function (r) {
    var b = Number(r.laufzeit); if (!tage[b]) return;
    tage[b].push({ datum: r.datum, bund: _num(r.bund), pfandbrief: _num(r.pfandbrief) });
    var ts = new Date(r.abgerufen_at).getTime(); if (ts > letzt) letzt = ts;
  });
  m.rows.forEach(function (r) {
    var b = Number(r.laufzeit); if (!monate[b]) return;
    monate[b].push({ monat: r.monat, mfi: _num(r.mfi), bund_avg: _num(r.bund_avg), aufschlag: _num(r.aufschlag), reihe: r.reihe });
  });
  return { tage: tage, monate: monate, quelle: 'db', abgerufen: letzt ? new Date(letzt).toISOString() : null };
}

/* ───────────────────────── Rechnung ───────────────────────── */
function _isoWoche(datum) {
  var d = new Date(datum + 'T00:00:00Z');
  var tag = (d.getUTCDay() + 6) % 7;            // Mo = 0
  d.setUTCDate(d.getUTCDate() - tag + 3);       // Donnerstag der Woche
  var jahr = d.getUTCFullYear();
  var erster = new Date(Date.UTC(jahr, 0, 4));
  var w = 1 + Math.round(((d - erster) / 86400000 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7);
  return jahr + '-W' + (w < 10 ? '0' : '') + w;
}

/* Aufschlag, der fuer einen Monat galt: der des Monats selbst, wenn
   veroeffentlicht, sonst der letzte davor. */
function _aufschlagFuer(monate, monat) {
  var best = null;
  for (var i = 0; i < monate.length; i++) { if (monate[i].monat <= monat) best = monate[i]; }
  return best;
}

function zinsFuer(bund, aufschlag, ltv) {
  return r2(bund + aufschlag + K_KALIBRIERUNG.wert + zuschlagLtv(ltv));
}

/* Aus Rohdaten (live, DB oder statisch) die fertige Antwort bauen. */
function berechnen(daten) {
  var bund = {}, bundDatum = {}, pfandbrief = {}, aufschlag = {}, aufschlagMonat = {}, mfi = {}, indicativeRates = {};
  var fehlt = [];
  LAUFZEITEN.forEach(function (b) {
    var t = (daten.tage[b] || []).filter(function (x) { return x.bund != null; });
    var lt = t[t.length - 1];
    var tp = (daten.tage[b] || []).filter(function (x) { return x.pfandbrief != null; });
    pfandbrief[b] = tp.length ? tp[tp.length - 1].pfandbrief : null;
    /* v2246 · EIN Marktaufschlag fuer alle Bindungen: der aus der Reihe
       5-10 J gegen Bund 10. Je Bindung eigene Reihen gaben 5 J = 4,64 %
       (ueber 10 J!) und 20 J < 15 J - die MFI-Klasse 1-5 J mischt kurze,
       teure Kredite, die Klasse ueber 10 J mischt 15 und 20 J. Die Form
       der Kurve kommt jetzt allein aus den Bund-Laufzeiten. */
    var ms = daten.monate[10] || [];
    var lm = ms[ms.length - 1];
    if (!lt || !lm) { fehlt.push(b); bund[b] = lt ? lt.bund : null; indicativeRates[b] = null; return; }
    bund[b] = lt.bund; bundDatum[b] = lt.datum;
    aufschlag[b] = lm.aufschlag; aufschlagMonat[b] = lm.monat; mfi[b] = lm.mfi;
    indicativeRates[b] = {};
    Object.keys(STUFEN_LTV).forEach(function (s) { indicativeRates[b][s] = zinsFuer(lt.bund, lm.aufschlag, STUFEN_LTV[s]); });
  });

  /* Verlauf fuer die Grafik "Der Aufschlag der Banken waechst":
     Wochen = Bauzins-Modell 10 J / 80 % minus Wochenschnitt Bund 10
     (also Aufschlag + K, Sprung beim Monatswechsel), daneben der
     Pfandbrief-Abstand zur Bundesanleihe, der woechentlich atmet.
     Monate = der gemessene MFI-Aufschlag selbst. */
  var t10 = (daten.tage[10] || []).filter(function (x) { return x.bund != null; });
  var wochenMap = {}, wReihe = [];
  t10.forEach(function (x) {
    var w = _isoWoche(x.datum);
    var e = wochenMap[w];
    if (!e) { e = wochenMap[w] = { woche: w, von: x.datum, bis: x.datum, b: [], p: [] }; wReihe.push(e); }
    e.bis = x.datum; e.b.push(x.bund); if (x.pfandbrief != null) e.p.push(x.pfandbrief);
  });
  var m10 = daten.monate[10] || [];
  var wochen = wReihe.slice(-12).map(function (e) {
    var bAvg = e.b.reduce(function (s, x) { return s + x; }, 0) / e.b.length;
    var pAvg = e.p.length ? e.p.reduce(function (s, x) { return s + x; }, 0) / e.p.length : null;
    var a = _aufschlagFuer(m10, e.bis.slice(0, 7));
    var modell = a ? bAvg + a.aufschlag + K_KALIBRIERUNG.wert : null;
    return {
      woche: e.woche, von: e.von, bis: e.bis,
      bund10: r3(bAvg),
      bauzins10: modell != null ? r2(modell) : null,
      aufschlag: modell != null ? r2(modell - bAvg) : null,
      aufschlag_monat: a ? a.monat : null,
      pfandbrief10: pAvg != null ? r3(pAvg) : null,
      pfandbrief_spread: pAvg != null ? r2(pAvg - bAvg) : null
    };
  });
  var monateJe = {};
  LAUFZEITEN.forEach(function (b) { monateJe[b] = (daten.monate[b] || []).slice(-13); });

  var quelle = fehlt.length === LAUFZEITEN.length ? 'unavailable' : daten.quelle;
  return {
    modell: 'bund+aufschlag',
    quelle: quelle,
    abgerufen: daten.abgerufen || null,
    maturities: LAUFZEITEN.map(String),
    indicativeRates: indicativeRates,
    stufen_ltv: Object.assign({}, STUFEN_LTV),
    formel: {
      text: 'Bauzins = Bundesanleihe (Tag) + Marktaufschlag (Monat) + K + Beleihungszuschlag',
      bund: bund,
      bund_datum: bundDatum,
      aufschlag: aufschlag,
      aufschlag_monat: aufschlagMonat[10] || null,
      aufschlag_monat_je: aufschlagMonat,
      mfi: mfi,
      mfi_reihe: Object.assign({}, MFI_REIHE),
      k: K_KALIBRIERUNG.wert,
      k_stand: K_KALIBRIERUNG.stand,
      k_bezug: K_KALIBRIERUNG.bezug,
      zuschlaege: LTV_STUETZSTELLEN.map(function (s) { return s.slice(); }),
      zuschlag_bezug_ltv: 80
    },
    pfandbrief: pfandbrief,
    verlauf: { wochen: wochen, monate: monateJe[10], monate_je_bindung: monateJe },
    fehlt: fehlt
  };
}

function _statischeDaten() {
  var tage = {}, monate = {};
  LAUFZEITEN.forEach(function (b) {
    tage[b] = [{ datum: STATISCHER_STAND.datum, bund: STATISCHER_STAND.bund[b], pfandbrief: null }];
    monate[b] = [{ monat: STATISCHER_STAND.aufschlag_monat, mfi: null, bund_avg: null, aufschlag: STATISCHER_STAND.aufschlag[b], reihe: MFI_REIHE[b] }];
  });
  return { tage: tage, monate: monate, quelle: 'static', abgerufen: null };
}

/* ───────────────────────── Oeffentliche Schnittstelle ───────────────────────── */
let _cache = null;

function _frisch(daten) {
  if (!daten || !daten.abgerufen) return false;
  return (Date.now() - new Date(daten.abgerufen).getTime()) < 26 * 60 * 60 * 1000;
}

/* Abruf + Speichern. Wird vom Takt gerufen; wirft nicht. */
async function aktualisieren(opts) {
  opts = opts || {};
  var tage = HISTORIE_TAGE_ERST;
  try {
    var db = _db();
    var r = await db.query('SELECT max(datum) AS m FROM markt_zins_tag');
    if (r.rows[0] && r.rows[0].m && !opts.voll) tage = HISTORIE_TAGE_FOLGE;
  } catch (e) { /* ohne DB: voller Abruf, nur im Speicher */ }
  var daten = await abrufenLive({ ab: _tageZurueck(tage) });
  var gesp = null;
  try { gesp = await speichern(daten); } catch (e) { console.warn('[bauzins] speichern fehlgeschlagen: ' + e.message); }
  _cache = null;
  console.log('[bauzins] Abruf ' + tage + ' Tage: ' +
    LAUFZEITEN.map(function (b) { return b + 'J ' + (daten.tage[b] || []).length; }).join(', ') +
    (gesp ? ' | gespeichert ' + gesp.tage + ' Tage-, ' + gesp.monate + ' Monatszeilen' : ' | nicht gespeichert'));
  return daten;
}

async function getBauzins() {
  if (_cache && (Date.now() - _cache.t) < CACHE_TTL_MS) return _cache.wert;
  var dbDaten = null;
  try { dbDaten = await ladenAusDb(); } catch (e) { /* DB fehlt oder Tabelle noch nicht migriert */ }
  var daten = null;
  if (_frisch(dbDaten)) {
    daten = dbDaten; daten.quelle = 'live';
  } else {
    try { daten = await aktualisieren(); }
    catch (e) {
      console.warn('[bauzins] Bundesbank nicht erreichbar: ' + e.message);
      daten = dbDaten || _statischeDaten();
    }
  }
  var wert = berechnen(daten);
  if (wert.fehlt.length && daten.quelle !== 'static') {
    /* einzelne Laufzeit ohne Daten: aus dem statischen Stand ergaenzen,
       sichtbar gemacht in quellen_je */
    var st = berechnen(_statischeDaten());
    wert.quellen_je = {};
    LAUFZEITEN.forEach(function (b) {
      if (wert.fehlt.indexOf(b) >= 0) {
        wert.indicativeRates[b] = st.indicativeRates[b];
        wert.formel.bund[b] = st.formel.bund[b]; wert.formel.aufschlag[b] = st.formel.aufschlag[b];
        wert.quellen_je[b] = 'static';
      } else wert.quellen_je[b] = wert.quelle;
    });
  }
  _cache = { t: Date.now(), wert: wert };
  return wert;
}

function clearCache() { _cache = null; }

/* Takt: einmal kurz nach dem Start, wenn der letzte Abruf aelter als
   ein Tag ist; danach taeglich um 18:00 Serverzeit. */
function starteTakt() {
  async function _wennAlt() {
    try {
      var db = _db();
      var r = await db.query('SELECT max(abgerufen_at) AS a FROM markt_zins_tag');
      var a = r.rows[0] && r.rows[0].a;
      if (a && (Date.now() - new Date(a).getTime()) < 24 * 60 * 60 * 1000) {
        console.log('[bauzins] Stand vom ' + new Date(a).toISOString() + ' ist frisch, kein Startabruf');
        return;
      }
    } catch (e) { console.warn('[bauzins] Startpruefung: ' + e.message); }
    try { await aktualisieren(); } catch (e) { console.warn('[bauzins] Startabruf fehlgeschlagen: ' + e.message); }
  }
  async function _taeglich() {
    try { await aktualisieren(); } catch (e) { console.warn('[bauzins] Tagesabruf fehlgeschlagen: ' + e.message); }
  }
  setTimeout(_wennAlt, 20 * 1000);
  var jetzt = new Date(), ziel = new Date(jetzt);
  ziel.setHours(18, 0, 0, 0);
  if (ziel <= jetzt) ziel.setDate(ziel.getDate() + 1);
  setTimeout(function () {
    _taeglich();
    setInterval(_taeglich, 24 * 60 * 60 * 1000);
  }, ziel - jetzt);
  console.log('✓ Bauzins-Takt aktiv (taeglich 18:00 Serverzeit, naechster Lauf ' + ziel.toISOString() + ')');
}

module.exports = {
  getBauzins,
  aktualisieren,
  abrufenLive,
  berechnen,
  zuschlagLtv,
  zinsFuer,
  clearCache,
  starteTakt,
  K_KALIBRIERUNG,
  LTV_STUETZSTELLEN,
  STUFEN_LTV,
  STATISCHER_STAND,
  MFI_REIHE,
  LAUFZEITEN,
  bundKey,
  pfandbriefKey,
  mfiKey
};
