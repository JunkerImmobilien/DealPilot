/* ═══════════════════════════════════════════════════════════════════════
   erbbaurecht.js · v1320 · Erbbaurechts-Abschlag im Marktbericht
   ═══════════════════════════════════════════════════════════════════════

   ⚠ ZWEITE FASSUNG DERSELBEN FORMEL — UND DAS IST ABSICHT

   Die erste steht in `frontend/js/erbbau-engine.js`. Beide rechnen § 50
   ImmoWertV, beide mit denselben Konstanten. Sie leben in verschiedenen
   Welten: die eine im Browser als ES5-IIFE ohne Bundler, die andere hier
   als ESM im Node-Container. Es gibt heute keinen Build-Schritt, der sie
   zusammenführen könnte.

   **WER EINE ÄNDERT, ÄNDERT BEIDE.** Der Prüfwert am Ende dieser Datei
   hält sie zusammen: dieselbe Eingabe muss hier und dort dieselbe Zahl
   ergeben. Weicht sie ab, ist eine der beiden angefasst worden und die
   andere nicht.

   Prüffall (von Hand nachgerechnet, 11.09.2026):
     Volleigentum 300.000 · Bodenwert 60.000 · RLZ 50 J · Zins 1.200/J
     angemessen 3,5 % · LIZ 3,5 % · RND 60 J · Entschädigung 66,67 %
     -> Erbbaurechtswert 258.723 € · Abschlag 41.277 € · 13,76 %

   WARUM DER MARKTBERICHT ES SELBST RECHNEN MUSS
   Kein Bewertungspartner nimmt den Parameter entgegen. Gemessen am
   11.09.2026 gegen die echte GeoMap-API: leasehold,
   heritableBuildingRight, groundLease, erbbaurecht und erbpacht kommen
   alle als 400 „Unrecognized field" zurück. Auch der erweiterte
   Detailabruf kennt kein Feld dafür — bei echten Erbbaurechts-Angeboten
   steht es nur im Beschreibungstext. Was der Bericht an Marktdaten
   bekommt, ist deshalb IMMER Volleigentum.
   ═══════════════════════════════════════════════════════════════════════ */

export const ZINSSATZ_ANGEMESSEN = 3.5;   /* Wohnen, marktüblich 3-5 % */
export const ENTSCHAEDIGUNG_PCT = 66.67;  /* § 27 ErbbauRG, Minimum Wohnraum */

/* § 193 Abs. 4 S. 3 BewG. Gleiche Tabelle wie im Frontend. */
const LIZ_NACH_ART = {
  efh: 2.5, zfh: 2.5, dhh: 2.5, rh: 2.5, haus: 2.5,
  etw: 3.5, mfh: 3.5, wohnung: 3.5,
  gemischt: 4.5, buero: 4.5,
  gew: 5.0, gewerbe: 5.0, hotel: 5.0,
  gesch: 6.0, geschaeft: 6.0,
};
const LIZ_STANDARD = 3.5;

const MARKT_SPANNEN = [
  { abJahre: 70, von: 5, bis: 15, text: 'lange Restlaufzeit' },
  { abJahre: 40, von: 15, bis: 30, text: 'mittlere Restlaufzeit' },
  { abJahre: 20, von: 30, bis: 50, text: 'kurze Restlaufzeit' },
  { abJahre: 0, von: 50, bis: 80, text: 'sehr kurze Restlaufzeit' },
];

function zahl(x) {
  if (x == null || x === '') return null;
  const n = typeof x === 'number' ? x : parseFloat(String(x).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function barwertfaktor(i, n) {
  if (!(n > 0)) return 0;
  if (!(i > 0)) return n;
  return (1 - Math.pow(1 + i, -n)) / i;
}

export function abzinsfaktor(i, n) {
  if (!(n > 0) || !(i > 0)) return 1;
  return Math.pow(1 + i, -n);
}

export function zinsFuerArt(art) {
  if (!art) return LIZ_STANDARD;
  const k = String(art).toLowerCase().replace(/[^a-z]/g, '');
  return LIZ_NACH_ART[k] != null ? LIZ_NACH_ART[k] : LIZ_STANDARD;
}

export function marktSpanne(rlz) {
  const n = zahl(rlz);
  if (n == null) return null;
  return MARKT_SPANNEN.find((s) => n >= s.abJahre) || MARKT_SPANNEN[MARKT_SPANNEN.length - 1];
}

/**
 * compute(e) — identisch zur Frontend-Fassung.
 * Fehlt eine Pflichtangabe, kommt KEIN Wert: kein Verfahren rechnet halb.
 */
export function compute(e = {}) {
  const out = { ok: false, fehlt: [], hinweise: [] };

  const voll = zahl(e.volleigentum);
  const bw = zahl(e.bodenwert);
  const rlz = zahl(e.restlaufzeit);

  if (!(voll > 0)) out.fehlt.push('volleigentum');
  if (bw == null || !(bw >= 0)) out.fehlt.push('bodenwert');
  if (!(rlz > 0)) out.fehlt.push('restlaufzeit');
  if (out.fehlt.length) return out;

  let zsAng = zahl(e.zinssatzAngemessen);
  if (!(zsAng > 0)) zsAng = ZINSSATZ_ANGEMESSEN;

  let liz = zahl(e.kapitalzins);
  if (!(liz > 0)) liz = zinsFuerArt(e.objektart);
  const i = liz / 100;

  let ent = zahl(e.entschaedigungPct);
  if (ent == null || ent < 0) ent = ENTSCHAEDIGUNG_PCT;
  if (ent > 100) ent = 100;

  const gebaeudeanteil = Math.max(0, voll - bw);

  const zinsAngemessenEur = bw * (zsAng / 100);
  let zinsVertragEur = zahl(e.erbbauzins);
  const zinsBekannt = zinsVertragEur != null && zinsVertragEur >= 0;
  if (!zinsBekannt) {
    zinsVertragEur = zinsAngemessenEur;
    out.hinweise.push('Kein Erbbauzins angegeben – gerechnet wird mit einem marktgerechten Vertrag. '
      + 'Alte Verträge liegen oft deutlich darunter; dann fällt der Abschlag kleiner aus.');
  }
  const bwf = barwertfaktor(i, rlz);
  const zinsvorteil = (zinsAngemessenEur - zinsVertragEur) * bwf;

  const rnd = zahl(e.restnutzungsdauer);
  const azf = abzinsfaktor(i, rlz);
  let heimfall = 0;
  let restGeb = 0;
  if (rnd != null && rnd > rlz) {
    restGeb = gebaeudeanteil * ((rnd - rlz) / rnd);
    heimfall = restGeb * (1 - ent / 100) * azf;
  } else if (rnd == null) {
    out.hinweise.push('Keine Restnutzungsdauer angegeben – der Heimfall bleibt unberücksichtigt. '
      + 'Überlebt das Gebäude den Vertrag, fällt der Abschlag höher aus.');
  }

  let wert = gebaeudeanteil + zinsvorteil - heimfall;
  if (wert < 0) wert = 0;
  const abschlag = voll - wert;
  const abschlagPct = voll > 0 ? (abschlag / voll) * 100 : 0;

  const sp = marktSpanne(rlz);
  let markt = null;
  if (sp) {
    markt = {
      von: sp.von, bis: sp.bis, text: sp.text,
      imRahmen: abschlagPct >= sp.von - 5 && abschlagPct <= sp.bis + 5,
    };
    if (!markt.imRahmen) {
      out.hinweise.push(`Der gerechnete Abschlag von ${abschlagPct.toFixed(1)} % liegt außerhalb der `
        + `Spanne, die bei ${sp.text} (${sp.von}–${sp.bis} %) am Markt beobachtet wird.`);
    }
  }

  if (rlz < 30) {
    out.hinweise.push('Unter 30 Jahren Restlaufzeit finanzieren die meisten Banken nicht mehr voll – '
      + 'die Tilgung muss innerhalb der Restlaufzeit durch sein.');
  }

  out.ok = true;
  out.erbbaurechtswert = wert;
  out.abschlag = abschlag;
  out.abschlagPct = abschlagPct;
  out.teile = {
    gebaeudeanteil, bodenwert: bw, zinsAngemessenEur, zinsVertragEur,
    zinsvorteil, barwertfaktor: bwf, abzinsfaktor: azf,
    gebaeuderestwertBeiAblauf: restGeb, heimfallabschlag: heimfall,
  };
  out.annahmen = {
    zinssatzAngemessen: zsAng, kapitalzins: liz, entschaedigungPct: ent,
    restlaufzeit: rlz, restnutzungsdauer: rnd, zinsGeschaetzt: !zinsBekannt,
    quelle: '§ 50 ImmoWertV 2021, Zinssätze nach § 193 Abs. 4 BewG, Entschädigung § 27 ErbbauRG',
  };
  out.markt = markt;
  return out;
}

/**
 * pruefwert() — hält die beiden Fassungen zusammen.
 * Muss 41277 ergeben. Dieselbe Eingabe liefert im Frontend dieselbe Zahl;
 * weicht sie ab, ist eine der beiden Fassungen angefasst worden.
 */
export function pruefwert() {
  const r = compute({
    volleigentum: 300000, bodenwert: 60000, restlaufzeit: 50,
    erbbauzins: 1200, objektart: 'etw', restnutzungsdauer: 60,
  });
  return r.ok ? Math.round(r.abschlag) : null;
}
