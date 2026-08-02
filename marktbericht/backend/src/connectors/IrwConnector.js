// IrwConnector.js — Immobilienrichtwerte aus BORIS-NRW.
// ────────────────────────────────────────────────────────────────────────────
// Quelle: WMS des Oberen Gutachterausschusses NRW,
//   https://www.wms.nrw.de/boris/wms_nw_irw
// Lizenz: Datenlizenz Deutschland Zero 2.0 — jede Nutzung ohne Einschraenkung.
// Gebuehren laut Dienst: "none/keine". Jaehrlich fortgeschrieben.
//
// WARUM DAS WICHTIG IST
// Immobilienrichtwerte sind Vergleichsfaktoren fuer bebaute Grundstuecke im
// Sinne von Paragraf 20 ImmoWertV. Sie werden aus der KAUFPREISSAMMLUNG
// abgeleitet und vom Gutachterausschuss beschlossen — also aus beurkundeten
// Kaufpreisen. Unser bisheriger Vergleichswert stammt aus Portalinseraten,
// das sind Angebotspreise. Paragraf 25 ImmoWertV verlangt Kaufpreise.
//
// Beim Wohnungseigentum bezieht sich der Richtwert auf das Wohnungseigentum
// EINSCHLIESSLICH Miteigentumsanteil am Grund und Boden — also inklusive
// Bodenanteil, kein separater Bodenwert noetig.
//
// DIE GRENZE, DIE NICHT VERSCHOBEN WIRD
// Der Richtwert gilt fuer ein NORMOBJEKT. Gemessen an Dortmund City-Ost:
// Baujahr 1980, 70 m2 Wohnflaeche, Wohnlage 5. Weicht das Bewertungsobjekt
// davon ab, sind die Umrechnungskoeffizienten des jeweiligen Ausschusses
// anzuwenden — und die stehen als PDF unter UDOK_URL, nicht maschinenlesbar.
//
// Deshalb liefert dieser Konnektor den Richtwert als ANKER mit seinen
// Normobjekt-Merkmalen und dem Link zur Umrechnungsvorschrift. Er rechnet
// NICHT eigenmaechtig um. Eine stille Umrechnung ohne die amtlichen
// Koeffizienten waere modellfremd (Paragraf 10) und saehe amtlich aus.

const WMS = process.env.IRW_WMS_URL || 'https://www.wms.nrw.de/boris/wms_nw_irw';
/* Derselbe Bestand mit Zeitachse: Jahrgaenge ab 2011 ueber den TIME-Parameter.
 * Gebraucht fuer die Rueckwaertssuche — siehe JAHRE_ZURUECK. */
const WMS_T = process.env.IRW_WMS_T_URL || 'https://www.wms.nrw.de/boris/wms-t_nw_irw';
const TIMEOUT_MS = Number(process.env.IRW_TIMEOUT_MS || 8000);

/* Wie viele Jahrgaenge rueckwaerts gesucht wird, wenn der aktuelle leer ist.
 *
 * Der Grund: Gutachterausschuesse beschliessen nicht jedes Jahr neu. Hat einer
 * 2024 beschlossen und 2026 noch nicht nachgezogen, ist der Wert von 2024 mit
 * sichtbarem Stichtag deutlich besser als gar keiner — ein zwei Jahre alter
 * AMTLICHER Wert schlaegt ein Inserat von gestern, solange er als solcher
 * gekennzeichnet ist.
 *
 * Wo der Ausschuss NIE beschlossen hat (Status "Richtwerte noch nicht
 * beschlossen", gemessen fuer Huellhorst), findet auch die Rueckwaertssuche
 * nichts. Sie wird dort deshalb gar nicht erst gestartet. */
const JAHRE_ZURUECK = Number(process.env.IRW_JAHRE_ZURUECK || 3);

/* Ebenennummern, gemessen aus GetCapabilities am 02.08.2026.
 * Die Verfuegbarkeitsebene 1 wird IMMER mitgefragt: sie sagt, ob der
 * zustaendige Ausschuss ueberhaupt Richtwerte beschlossen hat. Ohne sie
 * waere eine leere Antwort nicht von einem Fehler zu unterscheiden. */
export const IRW_EBENEN = {
  verfuegbarkeit: 1,
  gewerbe_industrie: 3,
  buero_geschaeft: 6,
  gemischt_genutzt: 9,
  mehrfamilienhaeuser: 12,
  reihen_doppelhaeuser: 15,
  ein_zweifamilienhaeuser: 18,
  eigentumswohnungen: 21,
};

/** Objektart des Berichts auf die passende IRW-Ebene abbilden. */
export function ebeneFuer(objektart, anzahlWe) {
  const s = String(objektart || '').toLowerCase();
  if (/etw|eigentumswohnung|wohnung|whg|apartment/.test(s)) return IRW_EBENEN.eigentumswohnungen;
  if (/reihe|doppel|rh|dhh/.test(s)) return IRW_EBENEN.reihen_doppelhaeuser;
  if (/mfh|mehrfamilien/.test(s)) return IRW_EBENEN.mehrfamilienhaeuser;
  if (/efh|zfh|einfamilien|zweifamilien|haus/.test(s)) {
    return Number(anzahlWe) > 2 ? IRW_EBENEN.mehrfamilienhaeuser : IRW_EBENEN.ein_zweifamilienhaeuser;
  }
  if (/buero|büro|laden|geschaeft|geschäft/.test(s)) return IRW_EBENEN.buero_geschaeft;
  if (/gewerbe|industrie|halle/.test(s)) return IRW_EBENEN.gewerbe_industrie;
  if (/gemischt/.test(s)) return IRW_EBENEN.gemischt_genutzt;
  return null;
}

const zahl = (v) => {
  const s = String(v == null ? '' : v).trim().replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const text = (v) => {
  const s = String(v == null ? '' : v).trim();
  return (s && s !== 'n/a') ? s : null;
};

/**
 * Punktabfrage am WMS.
 *
 * WMS 1.3.0 vertauscht bei geografischen Bezugssystemen die Achsen: die
 * BBOX lautet lat,lon — nicht lon,lat. Das ist der haeufigste Grund fuer
 * leere Antworten und war hier beim ersten Versuch gemessen worden.
 */
async function frage(lat, lon, ebenen, jahr = null) {
  const d = 0.001;                     // rund 100 m Kantenlaenge
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: ebenen.join(','), QUERY_LAYERS: ebenen.join(','),
    CRS: 'EPSG:4326',
    BBOX: [lat - d, lon - d, lat + d, lon + d].join(','),
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50',
    INFO_FORMAT: 'application/geo+json', FEATURE_COUNT: '10',
  });
  /* Mit Jahrgang geht die Anfrage an den zeitfaehigen Dienst. Ohne TIME
   * liefert der den aktuellen Stand — deshalb wird beides getrennt gehalten. */
  if (jahr) p.set('TIME', jahr + '-01-01');
  const ziel = jahr ? WMS_T : WMS;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(ziel + '?' + p.toString(), {
      signal: ctl.signal,
      headers: { 'User-Agent': process.env.OPENDATA_USER_AGENT || 'DealPilot/1.0' },
    });
    if (!r.ok) return { fehler: 'HTTP ' + r.status };
    const j = await r.json();
    return { features: Array.isArray(j && j.features) ? j.features : [] };
  } catch (e) {
    return { fehler: e && e.name === 'AbortError' ? 'Zeitueberschreitung' : String(e && e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

export const IrwConnector = {
  /**
   * Immobilienrichtwert fuer eine Adresse.
   * @param {object} o
   * @param {number} o.lat
   * @param {number} o.lon
   * @param {string} o.objektart
   * @param {number} [o.anzahlWe]
   */
  async hole({ lat, lon, objektart, anzahlWe = null }) {
    const LA = Number(lat), LO = Number(lon);
    if (!Number.isFinite(LA) || !Number.isFinite(LO)) return null;

    const ebene = ebeneFuer(objektart, anzahlWe);
    const ebenen = ebene ? [IRW_EBENEN.verfuegbarkeit, ebene] : [IRW_EBENEN.verfuegbarkeit];

    const a = await frage(LA, LO, ebenen);
    if (a.fehler) return { verfuegbar: false, grund: 'technisch', fehler: a.fehler };

    const verf = a.features.find((f) => f.layerName === 'irw_verfuegbarkeit');
    let wert = a.features.find((f) => f.layerName !== 'irw_verfuegbarkeit');
    let jahrgang = null;

    /* Rueckwaertssuche. Nur, wenn der Ausschuss ueberhaupt beschlossen hat —
     * sonst waeren es sinnlose Abrufe gegen einen fremden Server. Der Status
     * der Verfuegbarkeitsebene entscheidet das. */
    const nieBeschlossen = verf
      && /nicht beschlossen/i.test(String((verf.properties || {}).STATUS || ''));
    if (!wert && ebene && !nieBeschlossen && JAHRE_ZURUECK > 0) {
      const heuer = new Date().getFullYear();
      for (let j = heuer - 1; j >= heuer - JAHRE_ZURUECK; j--) {
        const b = await frage(LA, LO, [ebene], j);
        if (b.fehler) break;
        const tr = (b.features || []).find((f) => f.layerName !== 'irw_verfuegbarkeit');
        if (tr) { wert = tr; jahrgang = j; break; }
      }
    }

    /* Die Verfuegbarkeitsebene trennt "gibt es nicht" von "ging schief". */
    if (!wert) {
      const st = verf && text(verf.properties && verf.properties.STATUS);
      return {
        verfuegbar: false,
        grund: st ? 'nicht_beschlossen' : 'kein_treffer',
        status: st,
        gemeinde: verf && text(verf.properties && verf.properties.GENA),
        ags: verf && text(verf.properties && verf.properties.GESL),
        hinweis: st
          ? `Für ${(verf && text(verf.properties.GENA)) || 'diese Gemeinde'} hat der Gutachterausschuss `
            + `noch keine Immobilienrichtwerte beschlossen (${st}). Der Vergleichswert stützt sich `
            + 'daher weiterhin auf Angebotspreise.'
          : 'An dieser Stelle liegt kein Immobilienrichtwert vor.',
      };
    }

    const p = wert.properties || {};
    const irw = zahl(p.IMRW);
    if (!(irw > 0)) return { verfuegbar: false, grund: 'kein_wert' };

    return {
      verfuegbar: true,
      wert_qm: irw,
      stichtag: text(p.STAG),
      gutachterausschuss: text(p.GABE),
      gemeinde: text(p.GENA) || text(p.GEMA),
      ags: text(p.GESL),
      ortsteil: text(p.ORTST),
      gebiet: text(p.GEBIET),
      plz: text(p.PLZ),
      zonennummer: text(p.WNUM) || text(p.NUMZ),
      teilmarkt: text(p.TEILMA),
      /* Das Normobjekt, auf das sich der Richtwert bezieht. Ohne diese
       * Angaben ist der Wert nicht einzuordnen — er gilt fuer ein typisches
       * Objekt der Lage, nicht fuer jedes. */
      normobjekt: {
        baujahr: zahl(p.BJ),
        wohnflaeche_qm: zahl(p.WHNFL),
        wohnlage: text(p.WHNLA),
        ausstattung: text(p.AKL),
        wohnungsanzahl: text(p.WHNA),
        beitragszustand: text(p.BEIT),
        grundstuecksflaeche_qm: zahl(p.FLAE),
        restnutzungsdauer: zahl(p.RND),
      },
      umrechnungsvorschrift_url: text(p.UDOK_URL),
      /* Ein aelterer Jahrgang bleibt sichtbar aelter. Ein amtlicher Wert von
       * vorgestern ist brauchbar, ein als aktuell ausgegebener nicht. */
      jahrgang: jahrgang,
      aus_vorjahr: jahrgang != null,
      vorjahr_hinweis: jahrgang != null
        ? `Für den laufenden Jahrgang liegt kein Immobilienrichtwert vor; `
          + `ausgewiesen ist der Stand ${jahrgang} (Stichtag ${text(p.STAG) || '01.01.' + jahrgang}). `
          + `Zwischenzeitliche Marktbewegungen sind darin nicht enthalten.`
        : null,
      quelle: 'BORIS-NRW, Immobilienrichtwerte (dl-de/zero-2-0)',
      lizenz: 'dl-de/zero-2-0',
      ebene: wert.layerName,
    };
  },

  /**
   * Wie weit weicht das Bewertungsobjekt vom Normobjekt ab?
   *
   * Rechnet BEWUSST nicht um. Die Umrechnungskoeffizienten stehen als PDF
   * beim jeweiligen Ausschuss; sie zu schaetzen waere modellfremd und saehe
   * amtlich aus. Diese Funktion sagt nur, WIE STARK abgewichen wird — damit
   * der Leser weiss, wie belastbar der Anker ist.
   */
  abweichung(irw, ref) {
    if (!irw || !irw.verfuegbar || !irw.normobjekt) return null;
    const n = irw.normobjekt;
    const teile = [];
    let stark = false;

    const wfl = Number(ref && ref.living_area);
    if (n.wohnflaeche_qm > 0 && wfl > 0) {
      const p = Math.round((wfl / n.wohnflaeche_qm - 1) * 100);
      if (Math.abs(p) >= 15) {
        teile.push(`Wohnfläche ${wfl} m² gegen ${n.wohnflaeche_qm} m² (${p > 0 ? '+' : ''}${p} %)`);
        if (Math.abs(p) >= 40) stark = true;
      }
    }
    const bj = Number(ref && ref.construction_year);
    if (n.baujahr > 0 && bj > 0) {
      const d = bj - n.baujahr;
      if (Math.abs(d) >= 10) {
        teile.push(`Baujahr ${bj} gegen ${n.baujahr} (${d > 0 ? '+' : ''}${d} Jahre)`);
        if (Math.abs(d) >= 25) stark = true;
      }
    }
    if (!teile.length) return { erheblich: false, stark: false, punkte: [] };

    return {
      erheblich: true,
      stark,
      punkte: teile,
      hinweis: 'Der Immobilienrichtwert gilt für ein Normobjekt dieser Lage. Das bewertete Objekt '
        + 'weicht davon ab: ' + teile.join(' · ') + '. Für eine Umrechnung sind ausschließlich die '
        + 'Umrechnungstabellen des Gutachterausschusses zu verwenden; sie sind hier nicht angewendet. '
        + 'Der Richtwert dient deshalb als Orientierung, nicht als Vergleichswert des Objekts.',
    };
  },
};
