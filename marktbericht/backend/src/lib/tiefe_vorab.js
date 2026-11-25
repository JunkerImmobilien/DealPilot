/* lib/tiefe_vorab.js · v4630 · WELCHE TIEFE DIE WERTERMITTLUNG FUER DIESEN ORT HAT, VOR DEM KAUF
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Marcel 25.11.2026: „ob wir für Stufe 3 die amtlichen Zahlen alle haben … und dass wir den Kunden
 * darauf hinweisen, welche Tiefe zur Verfügung steht, damit er nicht etwas bezahlt, was er nicht bekommt.“
 *
 * KEINE ZWEITE RECHNUNG. Gefragt werden dieselben Zugaenge wie im Bericht:
 *   Liegenschaftszins   WertParameterService.liegenschaftszins()  (Register, Kaskade A bis D/N, wie ReportOrchestrator)
 *   Sachwertfaktor      GAA.sachwertfaktor()                      (lib/gutachterausschuss.js, die einzige Tuer)
 *   Vergleichsfaktor    GAA.vergleichsfaktor()
 *   Bodenrichtwert      BorisRegistry.status()                    (ob das Land angebunden ist; die Zone braucht die Anschrift)
 * Vorab fehlen dem Aufruf Bodenrichtwert und Restnutzungsdauer. Ein Satz, der nur DESHALB nicht rechnet
 * (brw_fehlt, achse fehlt, Rueckfrage), ist vorhanden: der Bericht holt den Bodenrichtwert selbst.
 * Gesperrt, nicht hinterlegt, nicht abgeleitet oder unvollstaendig heisst: dieser Teil kommt nicht amtlich.
 *
 * Kundentext: keine Gedankenstriche, keine Semikolons, keine Quellennamen. */
import * as GAA from './gutachterausschuss.js';
import { WertParameterService } from '../services/WertParameterService.js';
import { AgsResolver } from '../connectors/AgsResolver.js';
import { BorisConnector } from '../connectors/BorisConnector.js';

const LAND = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };
const ADAPTER = { NW: 'nrw' };   /* sonst Kleinbuchstaben des Landes */

/* Rueckgabe-Gruende, die nur sagen „mit dem Bodenrichtwert oder der Restnutzungsdauer rechnet es“ */
const BRAUCHT_ANGABEN = /brw|bodenricht|achse|rueckfrage|rnd|restnutzung|angabe|eingabe|sachwert_fehlt|flaeche/i;
const ZUGANG_TEXT = { kostenpflichtig: 'nur kostenpflichtig beim Gutachterausschuss', genehmigungspflichtig: 'nur mit Genehmigung des Gutachterausschusses',
  nichtkommerziell: 'nur für nichtkommerzielle Nutzung freigegeben', auf_anfrage: 'nur auf Anfrage beim Gutachterausschuss' };

function art(objektart) {
  const s = String(objektart || '').toLowerCase();
  if (/etw|wohnung/.test(s)) return { formular: 'wohnung', gaa: 'Eigentumswohnung', objart: 'ETW', haus: false, mfh: false };
  if (/mfh|mehrfam/.test(s)) return { formular: 'mfh', gaa: 'Mehrfamilienhaus', objart: 'MFH', haus: false, mfh: true };
  if (/zfh|zweifam/.test(s)) return { formular: 'zfh', gaa: 'Zweifamilienhaus', objart: 'ZFH', haus: true, mfh: false };
  if (/dhh|doppel/.test(s)) return { formular: 'dhh', gaa: 'Doppelhaushälfte', objart: 'DHH', haus: true, mfh: false };
  if (/rh|reihen/.test(s)) return { formular: 'rh', gaa: 'Reihenhaus', objart: 'RH', haus: true, mfh: false };
  if (/gew/.test(s)) return { formular: 'gewerbe', gaa: 'Gewerbe', objart: 'GEW', haus: false, mfh: false };
  return { formular: 'efh', gaa: 'Einfamilienhaus', objart: 'EFH', haus: true, mfh: false };
}

/** Ergebnis eines GAA-Zugangs in eine von drei Lagen bringen: amtlich | vorhanden | fehlt */
function lage(r) {
  if (!r) return { lage: 'fehlt', grund: null };
  if (r.verfuegbar) return { lage: 'amtlich', grund: null };
  const g = String(r.grund || '');
  if (g === 'gesperrt') return { lage: 'gesperrt', grund: ZUGANG_TEXT[r.zugang] || 'beim Gutachterausschuss nicht frei abrufbar' };
  if (BRAUCHT_ANGABEN.test(g)) return { lage: 'vorhanden', grund: null };
  return { lage: 'fehlt', grund: g || null };
}

export async function tiefeVorab({ plz, ort, objektart, wfl = null, baujahr = null, anzahl_we = null, strasse = null } = {}) {
  const a = art(objektart);
  const p = String(plz || '').trim();
  if (!/^\d{5}$/.test(p)) return { verfuegbar: false, grund: 'ohne_plz', text: 'Mit der Postleitzahl prüfen wir vorab, welche amtlichen Daten es für den Ort gibt.' };
  const [kreis, gem] = await Promise.all([
    AgsResolver.fromPostcode(p).catch(() => null),
    AgsResolver.gemeindeEindeutig(p, ort || null).catch(() => null)
  ]);
  const ags = String((gem && gem.gemeinde_ags) || (kreis && kreis.kreis_ags) || '').replace(/\D/g, '');
  if (!ags) return { verfuegbar: false, grund: 'ort_unbekannt', text: 'Zu dieser Postleitzahl finden wir keinen Ort. Bitte die Postleitzahl prüfen.' };
  const land = LAND[ags.slice(0, 2)] || null;
  const aus = { verfuegbar: true, ags, land, punkte: [], stufe3_voll: false };

  /* 1 · Liegenschaftszins, derselbe Weg wie im Bericht (immer ein Wert, die Ebene entscheidet) */
  let lzs = null;
  try {
    lzs = await WertParameterService.liegenschaftszins({ ags, objektart: a.formular, anzahlWe: anzahl_we || null,
      objekt: { objart: a.objart, nutzung: 'vermietet', baujahr: baujahr || null, einheiten: anzahl_we || null } });
  } catch (e) { lzs = null; }
  const st = String((lzs && lzs.stufe) || '').toUpperCase();
  const lzsAmtlich = st === 'A' || st === 'B';
  aus.punkte.push({ id: 'ertragswert', name: 'Ertragswert', ok: lzsAmtlich ? 'ja' : (st ? 'teils' : 'nein'), stufe: st || null,
    text: lzsAmtlich ? 'Mit amtlichem Liegenschaftszins des Gutachterausschusses.'
      : st === 'D' ? 'Rechnet, aber mit dem gesetzlichen Auffangwert, weil der Ausschuss für diese Objektart keinen Zins veröffentlicht. Indikativ.'
      : st === 'N' ? 'Rechnet mit einem abgeleiteten Zins, nicht amtlich. Indikativ.'
      : st ? 'Rechnet mit einem nicht amtlichen Zins. Indikativ.'
      : 'Für diesen Ort lässt sich vorab kein Zins bestimmen.' });

  /* 2 · Sachwertfaktor, nur Ein- und Zweifamilien-, Doppel- und Reihenhaus (wie der Bericht) */
  if (a.haus) {
    let r = null; try { r = GAA.sachwertfaktor({ ags, objektart: a.gaa, sachwert: 300000, wfl: wfl || undefined, baujahr: baujahr || undefined }); } catch (e) { r = null; }
    const l = lage(r);
    aus.punkte.push({ id: 'sachwert', name: 'Sachwert', ok: l.lage === 'amtlich' || l.lage === 'vorhanden' ? 'ja' : 'nein',
      text: l.lage === 'amtlich' || l.lage === 'vorhanden' ? 'Mit Sachwertfaktor des Gutachterausschusses, also marktangepasst.'
        : l.lage === 'gesperrt' ? 'Der Sachwertfaktor ist ' + l.grund + '. Der Sachwert bleibt ohne ihn vorläufig und ist kein Marktwert.'
        : 'Für diesen Ort liegt kein Sachwertfaktor vor. Der Sachwert bleibt vorläufig und ist kein Marktwert.' });
  }

  /* 3 · Vergleichsfaktor (amtliche Kaufpreise), sonst Vergleichswert aus Angeboten (Stufe M, kein ImmoWertV-Verfahren) */
  {
    let r = null; try { r = GAA.vergleichsfaktor({ ags, objektart: a.gaa, wfl: wfl || undefined, wohnflaeche: wfl || undefined, baujahr: baujahr || undefined }); } catch (e) { r = null; }
    const l = lage(r);
    const nrwEtw = land === 'NW' && !a.haus && !a.mfh;
    aus.punkte.push({ id: 'vergleichswert', name: 'Vergleichswert', ok: (l.lage === 'amtlich' || l.lage === 'vorhanden') ? 'ja' : (nrwEtw ? 'teils' : 'nein'),
      text: (l.lage === 'amtlich' || l.lage === 'vorhanden') ? 'Mit amtlichem Vergleichsfaktor aus Kaufpreisen.'
        : nrwEtw ? 'Über den Immobilienrichtwert, wenn er für die Anschrift veröffentlicht ist. Sonst aus Angebotspreisen, indikativ.'
        : l.lage === 'gesperrt' ? 'Der Vergleichsfaktor ist ' + l.grund + '. Ohne ihn nur aus Angebotspreisen, indikativ und kein Verfahren nach ImmoWertV.'
        : 'Kein amtlicher Vergleichsfaktor für diesen Ort. Bei Wohnungen deshalb nur aus Angebotspreisen, indikativ und kein Verfahren nach ImmoWertV.' });
  }

  /* 4 · Bodenrichtwert: Land angebunden? Die Zone braucht Strasse und Hausnummer */
  {
    let ad = null;
    try { const s = BorisConnector.status(); const code = land ? (ADAPTER[land] || land.toLowerCase()) : null; ad = (s || []).find((x) => x.code === code) || null;
      if (!ad || !ad.enabled) { const bund = (s || []).find((x) => x.code === 'borisd' && x.enabled); if (bund) ad = Object.assign({}, bund, { bund: true }); } } catch (e) { ad = null; }
    const mitStr = typeof strasse === 'string' && strasse.trim().length >= 4;
    aus.punkte.push({ id: 'boden', name: 'Bodenrichtwert', ok: ad && ad.enabled ? (mitStr ? 'ja' : 'teils') : 'nein',
      text: ad && ad.enabled ? (mitStr ? 'Amtlich abrufbar für die Anschrift.' : 'Amtlich abrufbar, aber nur mit Straße und Hausnummer. Ohne sie fehlt der Bodenwert.')
        : 'Im Land nicht frei abrufbar. Ohne Bodenrichtwert rechnen Ertrags- und Sachwert nicht.' });
  }

  const ja = aus.punkte.filter((x) => x.ok === 'ja').length;
  aus.stufe3_voll = aus.punkte.every((x) => x.ok === 'ja');
  aus.kurz = aus.stufe3_voll ? 'Für diesen Ort liegen alle amtlichen Daten vor.'
    : ja === 0 ? 'Für diesen Ort liegen kaum amtliche Daten vor. Die Wertermittlung bleibt weitgehend indikativ.'
    : 'Für diesen Ort liegen nicht alle amtlichen Daten vor. Was fehlt, rechnet indikativ oder gar nicht.';
  aus.hinweis = 'Vorabprüfung nach Postleitzahl und Objektart. Mit allen Angaben zum Objekt kann der Bericht genauer zuordnen.';
  return aus;
}
