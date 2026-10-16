// boris/ni-zone.js  (v2284)
//
// PUNKTABRUF DER BODENRICHTWERTZONE in Niedersachsen (und Bremen) gegen den
// amtlichen WFS der GDI-NI — nur fuer das, was BORIS-D NICHT mitliefert:
// die Flaeche des Richtwertgrundstuecks (boris:flaeche, die Bezugsgroesse
// fuer den Umrechnungskoeffizienten) und die der Zone zugeordneten
// Umrechnungstabellen (boris:listeUmrechnungstabelle, z. B. DENIBR5526UW0110).
//
// WARUM: gemessen am 16.10.2026 auf Staging - Leer kam ueber „BORIS-D
// (bundesweit)" mit 320 EUR/m2, aber properties_raw „Fläche": "" (leer),
// Bremen ebenso. Ohne Bezugsgroesse greift kein einziger NI-Registersatz
// der Kennzahl umrechnungskoeffizient_flaeche. Und in Goettingen, Hannover,
// Northeim ... haengt die Tabelle an der ZONE, nicht an der Gemeinde: ohne
// die Tabellen-ID ist dort keine Auswahl moeglich.
//
// Der Abruf ist ein FES-Intersects auf den Punkt (0,3-0,8 s gemessen; ein
// BBOX-Abruf brauchte 5 s, weil er nach Umring filtert). An einem Punkt
// liegen meist mehrere Zonen uebereinander (Bauland und Landwirtschaft,
// in Bremen zwei Bauland-Zonen) - geliefert werden alle, gewaehlt wird im
// Aufrufer ueber den Bodenrichtwert, damit Flaeche und Tabelle zu GENAU der
// Zone gehoeren, deren Richtwert gerechnet wird.
//
// Lizenz: dl-de/by-2-0 (WFS-Capabilities „© GDI-NI"; Vermerk der GAG
// Niedersachsen steht an den Registersaetzen). Ein Fehler wirft nie:
// Rueckgabe ist dann { verfuegbar: false, grund }.

const DIENSTE = {
  NI: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/boris_{JAHR}_wfs',
  HB: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/borishb_{JAHR}_wfs',
};
const PROPS = ['boris:entwicklungszustand', 'boris:bodenrichtwert', 'boris:flaeche', 'boris:nutzung',
  'boris:listeUmrechnungstabelle', 'boris:bodenrichtwertNummer', 'boris:gemeinde', 'boris:stichtag'].join(',');

export function zustaendig(land) {
  const l = String(land || '').toUpperCase();
  return DIENSTE[l] ? l : null;
}

function filterPunkt(lat, lon) {
  return '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"'
    + ' xmlns:adv="http://www.adv-online.de/namespaces/adv/gid/6.0"><fes:Intersects>'
    + '<fes:ValueReference>adv:position</fes:ValueReference>'
    + '<gml:Point srsName="urn:ogc:def:crs:EPSG::4326"><gml:pos>' + lat + ' ' + lon + '</gml:pos></gml:Point>'
    + '</fes:Intersects></fes:Filter>';
}

export function urlFuer(land, lat, lon, jahr) {
  const basis = DIENSTE[land].replace('{JAHR}', String(jahr));
  return basis + '?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=boris:BR_BodenrichtwertZonal'
    + '&PROPERTYNAME=' + encodeURIComponent(PROPS) + '&FILTER=' + encodeURIComponent(filterPunkt(lat, lon));
}

/** GML-Antwort -> Zonen (ohne Geometrie). Exportiert fuer den Pruefer. */
export function zonenAusGml(text) {
  const out = [];
  for (const m of String(text || '').split('<wfs:member>').slice(1)) {
    const g = (re) => { const x = m.match(re); return x ? x[1] : null; };
    const kz = m.match(/<boris:land>(\d+)<\/boris:land>\s*<boris:regierungsbezirk>(\d*)<\/boris:regierungsbezirk>\s*<boris:kreis>(\d*)<\/boris:kreis>\s*<boris:gemeinde>(\d*)<\/boris:gemeinde>/);
    const brw = parseFloat(g(/<boris:bodenrichtwert>([^<]*)</));
    const fl = parseFloat(g(/<boris:flaeche>[\s\S]*?<boris:wert>([^<]*)</));
    out.push({
      zone_id: g(/gml:id="([^"]+)"/),
      bodenrichtwert_nummer: g(/<boris:bodenrichtwertNummer>([^<]*)</),
      entwicklungszustand: g(/<boris:entwicklungszustand>([^<]*)</),
      nutzung: g(/<boris:BR_Nutzung>\s*<boris:art>([^<]*)</),
      ergaenzung: [...m.matchAll(/<boris:ergaenzung>([^<]*)</g)].map((x) => x[1]).join(',') || null,
      brw_eur_qm: Number.isFinite(brw) ? brw : null,
      flaeche_qm: Number.isFinite(fl) && fl > 0 ? fl : null,
      ags: kz ? kz[1] + kz[2] + kz[3] + kz[4] : null,
      stichtag: g(/<boris:stichtag>([^<]*)</),
      /* nur die Werte-Tabellen (UW); UD sind die zugehoerigen Dateien */
      tabellen_ids: [...m.matchAll(/listeUmrechnungstabelle xlink:href="urn:adv:oid:([^"]+)"/g)]
        .map((x) => x[1]).filter((id) => /UW\d+$/.test(id)),
    });
  }
  return out;
}

/** Die Zone zu einem Bodenrichtwert waehlen: Bauland, gleicher Richtwert.
 *  Ohne Richtwert nur, wenn am Punkt genau EINE Bauland-Zone liegt. */
export function waehleZone(zonen, brwEurQm) {
  const bau = (zonen || []).filter((z) => z.entwicklungszustand === 'B');
  const brw = Number(brwEurQm);
  if (brw > 0) {
    const gleich = bau.filter((z) => z.brw_eur_qm != null && Math.abs(z.brw_eur_qm - brw) < 0.005);
    if (gleich.length === 1) return { zone: gleich[0] };
    if (gleich.length > 1) return { zone: null, grund: 'mehrdeutig', anzahl: gleich.length };
    return { zone: null, grund: 'kein_gleicher_richtwert', bauland: bau.map((z) => z.brw_eur_qm) };
  }
  if (bau.length === 1) return { zone: bau[0] };
  return { zone: null, grund: bau.length ? 'mehrdeutig' : 'keine_baulandzone', anzahl: bau.length };
}

/**
 * Punktabruf. fristMs gilt fuer den GANZEN Abruf (ein Versuch, kein Retry).
 * -> { verfuegbar, land, url, zonen[], ms } oder { verfuegbar:false, grund }
 */
export async function holeZonen({ lat, lon, land, jahr = 2026, fristMs = 4000 }) {
  const l = zustaendig(land);
  if (!l) return { verfuegbar: false, grund: 'land_nicht_zustaendig' };
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return { verfuegbar: false, grund: 'keine_koordinaten' };
  const url = urlFuer(l, la, lo, jahr);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), fristMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) return { verfuegbar: false, grund: 'http_' + res.status, url };
    if (/ExceptionReport/.test(text.slice(0, 400))) return { verfuegbar: false, grund: 'wfs_exception', url };
    return { verfuegbar: true, land: l, url, zonen: zonenAusGml(text), ms: Date.now() - t0 };
  } catch (e) {
    return { verfuegbar: false, grund: e && e.name === 'AbortError' ? 'frist_' + fristMs + 'ms' : 'fehler: ' + (e && e.message), url };
  } finally {
    clearTimeout(timer);
  }
}

/** Abruf + Wahl in einem: was der Bericht braucht. Wirft nie. */
export async function zoneFuerBericht({ lat, lon, land, brw_eur_qm, jahr = 2026, fristMs = 4000 }) {
  try {
    const r = await holeZonen({ lat, lon, land, jahr, fristMs });
    if (!r.verfuegbar) return r;
    const w = waehleZone(r.zonen, brw_eur_qm);
    if (!w.zone) return { verfuegbar: false, grund: w.grund, url: r.url, ms: r.ms, zonen_am_punkt: r.zonen.length };
    return { verfuegbar: true, land: r.land, url: r.url, ms: r.ms, ...w.zone,
      quelle: r.land === 'HB' ? 'BORIS-HB (WFS borishb_' + jahr + '_wfs, GDI-NI)' : 'BORIS-NI (WFS boris_' + jahr + '_wfs, GDI-NI)' };
  } catch (e) {
    return { verfuegbar: false, grund: 'fehler: ' + (e && e.message) };
  }
}
