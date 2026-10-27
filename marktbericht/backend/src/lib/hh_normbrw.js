/* v3008 · NORMIERTE BODENRICHTWERTE HAMBURG (Lagefaktor der Vergleichsfaktoren)
 *
 * Die Hamburger Vergleichsfaktoren (vgf-hh-2026.json) rechnen den Lagefaktor
 * nicht aus dem aktuellen Bodenrichtwert, sondern aus dem NORMIERTEN der
 * Zone zu einem festen Jahrgang:
 *
 *   normbrw20  EFH-Normrichtwert (auf 1.000 m² normiert), Jahrgang 2020
 *              -> WFS-Attribut `normrichtwert`, Zone mit Nutzung „EFH …"
 *   normbrw18  MFH-Normschichtwert (auf WGFZ 1,0 normiert), Jahrgang 2018
 *              -> WFS-Attribut `normschichtwert`, Zone mit Nutzung „MFH …"
 *
 * Quelle: WFS HH_WFS_Bodenrichtwerte, FeatureType app:lgv_brw_zoniert_alle,
 * Lizenz dl-de/by-2-0, Namensnennung „Freie und Hansestadt Hamburg,
 * Landesbetrieb Geoinformation und Vermessung". Gemessen 27.10.2026 an
 * Volksdorf (53,65 / 10,162): normrichtwert 2020 = 830,00, normschichtwert
 * 2018 = 1.750,00.
 *
 * KEIN TREFFER HEISST KEIN WERT: liegt der Punkt in keiner EFH- bzw. MFH-Zone
 * des Jahrgangs, kommt null - der Satz rechnet dann nicht (bedingung_nicht_
 * pruefbar). Ein Fehler oder eine Zeitueberschreitung liefert ebenfalls null,
 * nie einen gekippten Bericht. */
const URL_WFS = process.env.HH_BRW_WFS || 'https://geodienste.hamburg.de/HH_WFS_Bodenrichtwerte';
export const HH_NORMBRW_QUELLE = Object.freeze({
  vermerk: 'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung',
  lizenz: 'dl-de/by-2-0',
  url: URL_WFS,
  kennzahl: 'normierter Bodenrichtwert (Lagefaktor der Vergleichsfaktoren)',
});
const _cache = new Map();

function _anfrage(lat, lon, jahrgang) {
  return '<wfs:GetFeature service="WFS" version="2.0.0" xmlns:wfs="http://www.opengis.net/wfs/2.0" '
    + 'xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" '
    + 'xmlns:app="http://www.deegree.org/app"><wfs:Query typeNames="app:lgv_brw_zoniert_alle"><fes:Filter><fes:And>'
    + '<fes:PropertyIsEqualTo><fes:ValueReference>app:jahrgang</fes:ValueReference><fes:Literal>' + jahrgang
    + '</fes:Literal></fes:PropertyIsEqualTo><fes:Intersects><fes:ValueReference>app:geom_zone</fes:ValueReference>'
    + '<gml:Point gml:id="p1" srsName="urn:ogc:def:crs:EPSG::4326"><gml:pos>' + lat + ' ' + lon
    + '</gml:pos></gml:Point></fes:Intersects></fes:And></fes:Filter></wfs:Query></wfs:GetFeature>';
}

/** Zonen eines Jahrgangs am Punkt: [{ nutzung, normrichtwert, normschichtwert, stadtteil, richtwertnummer }] */
export function zonenAusAntwort(xml) {
  return String(xml || '').split(/<wfs:member>/).slice(1).map((f) => {
    const g = (n) => { const m = new RegExp('<app:' + n + '>([^<]*)</app:' + n + '>').exec(f); return m ? m[1].trim() : ''; };
    const z = (v) => { const n = Number(String(v).replace(',', '.')); return v !== '' && Number.isFinite(n) ? n : null; };
    return { nutzung: g('nutzung_kombiniert'), normrichtwert: z(g('normrichtwert')),
      normschichtwert: z(g('normschichtwert')), stadtteil: g('stadtteil') || null,
      richtwertnummer: g('richtwertnummer') || null };
  });
}

async function _zonen(lat, lon, jahrgang, fristMs) {
  const k = [Number(lat).toFixed(5), Number(lon).toFixed(5), jahrgang].join('|');
  if (_cache.has(k)) return _cache.get(k);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), fristMs);
  try {
    const r = await fetch(URL_WFS, { method: 'POST', headers: { 'Content-Type': 'application/xml' },
      body: _anfrage(lat, lon, jahrgang), signal: ctl.signal });
    if (!r.ok) return null;
    const z = zonenAusAntwort(await r.text());
    if (_cache.size > 500) _cache.clear();
    _cache.set(k, z);
    return z;
  } catch (e) { return null; } finally { clearTimeout(t); }
}

/** { normbrw20, normbrw18, zone20, zone18, quelle } - je Wert null, wenn keine passende Zone. */
export async function hhNormBrw(lat, lon, { fristMs = 6000 } = {}) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
  const [z20, z18] = await Promise.all([_zonen(lat, lon, 2020, fristMs), _zonen(lat, lon, 2018, fristMs)]);
  const efh = (z20 || []).filter((z) => /^EFH\b/.test(z.nutzung) && z.normrichtwert != null);
  const mfh = (z18 || []).filter((z) => /^MFH\b/.test(z.nutzung) && z.normschichtwert != null);
  /* Zwei verschiedene Zonen derselben Nutzung am Punkt waeren eine Frage, keine Regel. */
  const eins = (l, f) => (new Set(l.map((z) => z[f])).size === 1 ? l[0] : null);
  const e = eins(efh, 'normrichtwert'), m = eins(mfh, 'normschichtwert');
  return { normbrw20: e ? e.normrichtwert : null, normbrw18: m ? m.normschichtwert : null,
    zone20: e, zone18: m, quelle: HH_NORMBRW_QUELLE };
}
