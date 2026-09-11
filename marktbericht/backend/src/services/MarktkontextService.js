/* ═══════════════════════════════════════════════════════════════════════
   MarktkontextService.js · v1321 · Was der Markt sonst noch hergibt
   ═══════════════════════════════════════════════════════════════════════

   Marcels Frage zu Marcels eigenem GeoMap-Papier: „was kann das dann mehr?
   bringt uns das was und wo könnten wir das integrieren?"

   GEMESSEN am 11.09.2026, Bielefeld 5 km, gegen die echte API. Jede Zahl
   hier ist ein echter Abruf, keine Doku-Lektüre:

     Basis, alle Wohnungen Kauf          2.948,68 EUR/m²   n=1.120
     vermietet (leased:true)             2.769,33          n=  140   -7,1 %
     frei (leased:false)                 2.980,96          n=  978
     Energie A/B/C                       3.227,73          n=   77
     Energie D/E                         2.594,20          n=  159
     Energie F/G/H                       2.549,35          n=   38  -21,0 %
     Angebotsrendite (RENDITE)                4,26 %       n=1.116
     Erbbaurecht (searchString)          2.012,20          n=    9  -31,8 %

   UND DAS WICHTIGSTE ERGEBNIS: **KPI-Abrufe kosten nichts.** Guthaben vor
   und nach acht Abfragen: 257,115 -> 257,115. Nur Detail-Abrufe
   (getDetailsById) ziehen Geld, rund einen Cent je Angebot. Damit ist
   dieser ganze Block gratis — er kostet nur Zeit, und die läuft parallel.

   WAS NICHT GEHT (auch gemessen, damit es niemand zweimal versucht):
     objectClasses ['StellplatzGarage']   n=0, liefert in Bielefeld nichts
     priceChanged / hasPriceChange        400 Unrecognized field
     priceChangeCountRange                400 Unrecognized field
     priceChangeDirection allein          filtert NICHT (n=1.120 = alle)
     energyRatings 'A_PLUS' / 'A+'        400 Unknown energyRating
   Der Verhandlungsspielraum aus dem Papier ist per KPI also nicht zu
   holen; er ginge nur über Detail-Abrufe, und die kosten.

   Gültige Energieklassen: A B C D E F G H. Kein A+.
   ═══════════════════════════════════════════════════════════════════════ */
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';
import { geomapEnabled } from '../lib/config.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { segment } from '../lib/marktsegment.js';

/* Marktkontext ändert sich langsam — eine Woche Cache reicht. */
const TTL_MS = (parseInt(process.env.MARKTKONTEXT_CACHE_TTL_MIN, 10) || 10080) * 60 * 1000;

const ENERGIE_GUT = ['A', 'B', 'C'];
const ENERGIE_MITTEL = ['D', 'E'];
const ENERGIE_SCHLECHT = ['F', 'G', 'H'];

/* Wie viele Treffer eine Aussage mindestens braucht. Darunter ist der
   Median Zufall, und eine Zahl ohne Grundlage ist schlimmer als keine. */
const MIN_N = 15;

function prozentUnterschied(a, b) {
  if (!(a > 0) || !(b > 0)) return null;
  return ((a - b) / b) * 100;
}

export const MarktkontextService = {
  /**
   * derive(ref) -> { rendite, vermietung, energie, erbbau, radiusKm } | null
   *
   * Alles optional: was die Datenlage nicht hergibt, fehlt. Kein Teil
   * bricht den Bericht ab, keiner erfindet einen Wert.
   */
  async derive(ref) {
    if (!geomapEnabled()) return null;
    if (!ref || ref.lat == null || ref.lon == null) return null;

    const radiusKm = 5;
    const bis = new Date().toISOString().slice(0, 10);
    const von = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const period = { from: von, to: bis };

    const ck = ['mk', ref.lat.toFixed(3), ref.lon.toFixed(3), ref.property_type || '?', radiusKm].join('|');
    const cached = cacheGet(ck);
    if (cached) return { ...cached, cached: true };

    const seg = segment(ref.property_type, 'Kauf');
    const gem = {
      lat: ref.lat, lon: ref.lon, radiusKm, offerType: 'Kauf',
      objectClasses: seg.objectClasses, objectTypes: seg.objectTypes, period,
    };
    const kpi = (extra) => GeoMapConnector.kpiCollection({ ...gem, analyzedField: 'PREISPROQM', ...extra })
      .catch(() => null);

    /* Alles parallel — acht Abrufe nacheinander wären acht mal Wartezeit,
       und kosten tun sie ohnehin nichts. */
    const [basis, vermietet, frei, eGut, eMittel, eSchlecht, rendite, erbbau] = await Promise.all([
      kpi({}),
      kpi({ filters: { leased: true } }),
      kpi({ filters: { leased: false } }),
      kpi({ filters: { energyRatings: ENERGIE_GUT } }),
      kpi({ filters: { energyRatings: ENERGIE_MITTEL } }),
      kpi({ filters: { energyRatings: ENERGIE_SCHLECHT } }),
      GeoMapConnector.kpiCollection({ ...gem, analyzedField: 'RENDITE' }).catch(() => null),
      kpi({ filters: { searchString: 'Erbbaurecht Erbpacht Erbbauzins' } }),
    ]);

    const gut = (k) => (k && !k.error && k.median != null && k.count >= MIN_N) ? k : null;
    const b = gut(basis);
    const out = { radiusKm, zeitraum: period, basis_median_sqm: b ? b.median : null, basis_n: b ? b.count : null };

    /* ── Vermietet oder frei ────────────────────────────────────────────
       Für einen Kapitalanleger ist das die ehrlichere Vergleichsgruppe:
       eine vermietete Wohnung kann er nicht selbst beziehen, und der Markt
       bepreist das. Gemessen -7,1 % in Bielefeld. */
    const v = gut(vermietet), f = gut(frei);
    if (v && f) {
      out.vermietung = {
        vermietet_median_sqm: v.median, vermietet_n: v.count,
        frei_median_sqm: f.median, frei_n: f.count,
        abschlag_pct: prozentUnterschied(v.median, f.median),
      };
    }

    /* ── Energieklassen-Spreizung ("Brown Discount") ────────────────────
       Was ein schlechter Energieausweis am ORT wirklich kostet - nicht
       aus einer Studie, sondern aus den Angeboten im Umkreis. */
    const g = gut(eGut), m = gut(eMittel), s = gut(eSchlecht);
    if (g && s) {
      out.energie = {
        gut_median_sqm: g.median, gut_n: g.count,
        mittel_median_sqm: m ? m.median : null, mittel_n: m ? m.count : null,
        schlecht_median_sqm: s.median, schlecht_n: s.count,
        spreizung_pct: prozentUnterschied(s.median, g.median),
      };
    }

    /* ── Angebotsrendite am Ort ─────────────────────────────────────────
       GeoMaps eigene Kennzahl, direkt vergleichbar mit der Bruttorendite
       des Objekts. Sagt in einer Zahl, ob der Deal über oder unter dem
       liegt, was der Markt gerade bietet. */
    if (rendite && !rendite.error && rendite.median != null && rendite.count >= MIN_N) {
      out.rendite = {
        median_pct: rendite.median, q25_pct: rendite.q25, q75_pct: rendite.q75, n: rendite.count,
      };
    }

    /* ── Erbbaurechts-Anteil und -Preisniveau ───────────────────────────
       KEIN FILTER, sondern eine Volltextsuche in Titel und Beschreibung.
       Sie trifft deshalb auch ein Angebot, das „kein Erbbaurecht"
       schreibt - die Zahl ist ein SIGNAL, kein Beleg, und wird auch so
       benannt. Als Plausibilisierung des gerechneten Abschlags taugt sie
       trotzdem: gemessen -31,8 % gegen die Basis. */
    const e = (erbbau && !erbbau.error && erbbau.median != null && erbbau.count >= 5) ? erbbau : null;
    if (e && b) {
      out.erbbau_markt = {
        median_sqm: e.median, n: e.count,
        anteil_pct: b.count > 0 ? (e.count / b.count) * 100 : null,
        abstand_pct: prozentUnterschied(e.median, b.median),
        hinweis: 'Volltextsuche in Titel und Beschreibung, kein Filter — '
          + 'ein Angebot, das „kein Erbbaurecht" schreibt, wird mitgezählt. Signal, kein Beleg.',
      };
    }

    const hatEtwas = out.vermietung || out.energie || out.rendite || out.erbbau_markt;
    if (!hatEtwas) return null;
    cacheSet(ck, out, TTL_MS);
    return out;
  },
};
