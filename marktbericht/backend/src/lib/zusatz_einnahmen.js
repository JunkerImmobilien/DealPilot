/* ══ v3670 · ZUSAETZLICHE EINNAHMEN (Reiter Miete, Feld `ze`) IM ERTRAGSWERT ══════════════
   Marcel 17.11.2026: „Wir haben im Tab Miete ein Feld dafuer, das heisst zusaetzliche
   Einnahmen. Dort haben wir Kueche und Stellplatz als Summe … darunter zum Ausklappen
   auch trennen, aber nur wenn erforderlich."

   Das Feld `ze` bleibt die SUMME (€/Monat). Aufgeteilt werden darf sie in
     ze_stp_monat     Stellplatz / Garage        (€/Monat)
     ze_kueche_monat  Kueche / Moeblierung       (€/Monat, gesondert vereinbarter Zuschlag)
     ze_sonst_monat   Sonstiges                  (€/Monat)
   Ist aufgeteilt, ist `ze` im Formular gesperrt und gleich der Summe (js/ze-aufteilung.js).

   Wohin was gehoert (ImmoWertV / ImmoWertA):
   - Stellplatz/Garage und Sonstiges sind Rohertrag (§ 31 Abs. 2 ImmoWertV) und werden mit
     dem Gebaeude kapitalisiert (zusatz_ertrag_jahr).
   - Ein Kuechen-/Moeblierungszuschlag haftet an einer Sache mit eigener, kuerzerer Dauer:
     sonstige Ertraege mit eigenem Barwert (ImmoWertA 8.(3).2), NICHT im Rohertrag
     (sonstige_jahr, im Ertragswertdienst Vorgabe 15 Jahre).
   - Nicht aufgeteilt gilt `ze` als Ganzes als kapitalisierter Zusatzertrag (Stellplatz ist
     der Regelfall), im Bericht „Zusaetzliche Einnahmen (Stellplatz, Kueche, Sonstiges)".

   DOPPELZAEHLUNG (Regel): Steht im Objekt zusaetzlich Anzahl × Stellplatzmiete, beschreiben
   beide dieselben Plaetze, wenn `ze` einen Stellplatzanteil traegt oder nicht aufgeteilt ist.
   Dann gilt die eingetragene Einnahme (sie ist die tatsaechliche Miete, die Stueckrechnung
   nur ein Ansatz) und Anzahl × Miete entfaellt - der Bericht sagt es. Ist `ze` aufgeteilt
   und der Stellplatzanteil 0, rechnen Anzahl × Stellplatzmiete UND der Rest beide.
   Die Ist-Miete im Band (§ 31 Abs. 2) bleibt nkm / Wohnflaeche - `ze` beruehrt sie nie. */

function zahl(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let t = String(v).trim().replace(/[^\d.,-]/g, '');
  if (t === '') return null;
  if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}
const pos = (v) => { const n = zahl(v); return n != null && n > 0 ? n : 0; };

/**
 * @param {object} d  Objektdaten: ze, ze_stp_monat, ze_kueche_monat (je Monat), sonstige_jahr
 * @returns {{zusatz_ertrag_jahr:number|null, zusatz_stellplatz_jahr:number|null,
 *            zusatz_kueche_jahr:number|null, zusatz_sonst_jahr:number|null,
 *            zusatz_aufgeteilt:boolean, sonstige_jahr:number|null}}
 */
export function zusatzAufteilen(d) {
  d = d || {};
  const stp = pos(d.ze_stp_monat), kue = pos(d.ze_kueche_monat), sonstE = pos(d.ze_sonst_monat);
  const aufgeteilt = stp > 0 || kue > 0 || sonstE > 0;
  /* die Summe ist nie kleiner als ihre Teile (im Formular ist ze gesperrt und = Summe) */
  const ze = Math.max(pos(d.ze), stp + kue + sonstE);
  const sonstAlt = pos(d.sonstige_jahr);
  const r2 = (x) => Math.round(x * 100) / 100;
  if (!aufgeteilt) {
    return {
      zusatz_ertrag_jahr: ze > 0 ? Math.round(ze * 12) : null,
      zusatz_stellplatz_jahr: null, zusatz_kueche_jahr: null, zusatz_sonst_jahr: null,
      zusatz_aufgeteilt: false,
      sonstige_jahr: sonstAlt > 0 ? sonstAlt : null,
    };
  }
  /* Sonstiges: das eigene Feld; weicht die Summe ab (alter Stand, Import), traegt der Rest es */
  const sonst = r2(Math.max(sonstE, ze - stp - kue));
  const kap = stp + sonst;
  return {
    zusatz_ertrag_jahr: kap > 0 ? Math.round(kap * 12) : null,
    zusatz_stellplatz_jahr: stp > 0 ? Math.round(stp * 12) : 0,
    zusatz_kueche_jahr: kue > 0 ? Math.round(kue * 12) : 0,
    zusatz_sonst_jahr: sonst > 0 ? Math.round(sonst * 12) : 0,
    zusatz_aufgeteilt: true,
    sonstige_jahr: (sonstAlt + kue * 12) > 0 ? Math.round(sonstAlt + kue * 12) : null,
  };
}

/**
 * Ertrag aus Stellplaetzen und Zusatzeinnahmen im Rohertrag - EINE Rechnung fuer den
 * Ertragswertdienst und die BWK-Bezugsgroesse im CrossCheckService.
 * @returns {{jahr:number, ersetzt:boolean, stueck_jahr:number, zusatz_jahr:number}}
 */
export function stellplatzErtrag(ein) {
  ein = ein || {};
  const spAnz = pos(ein.stellplatz_anz), spMiete = pos(ein.stellplatz_miete_monat);
  const stueck = Math.round(spAnz * spMiete * 12);
  const zusatz = pos(ein.zusatz_jahr);
  const aufgeteilt = ein.zusatz_aufgeteilt === true;
  /* nicht aufgeteilt oder mit Stellplatzanteil: die Einnahme ersetzt Anzahl × Miete */
  const ersetzt = zusatz > 0 && (!aufgeteilt || pos(ein.zusatz_stellplatz_jahr) > 0);
  return { jahr: Math.round(ersetzt ? zusatz : stueck + zusatz), ersetzt, stueck_jahr: stueck, zusatz_jahr: Math.round(zusatz) };
}
