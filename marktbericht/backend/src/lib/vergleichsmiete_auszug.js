/* ═══════════════════════════════════════════════════════════════════════
   lib/vergleichsmiete_auszug.js · v3944 — DIE VERGLEICHSMIETE FUER DEN EINZEL-CHECK

   Marcel 22.11.2026: „Vergleichsmieten angeben und Obergrenze für Investoren,
   was max drin ist." Der Einzel-Check der Landing laeuft seit v3941 auf Stufe 2.
   Die ortsuebliche Vergleichsmiete ist dort nicht im Umfang: sie steckt im
   Quercheck (CrossCheckService, ertragswert.miete_stufe = Anker der
   Marktueblichkeit), und den verwirft der Orchestrator unter Stufe 3.

   GEMESSEN 22.11.2026 im Code: der Quercheck laeuft auf JEDER Stufe und wird
   erst danach verworfen (ReportOrchestrator „_stufe < 3“). Stufe 3 nimmt als
   Vergleichsmiete den Anker aus CrossCheckService (v2600/v3343) in dieser Folge:
     1 mietspiegel  Mietspiegel-Werte der Gemeinde (lib/mietanker.js vergleichsmieteWohnung)
     2 amtlich      amtliche Mietpreisuebersicht des Gutachterausschusses
     3 naeherung    DealPilot-Naeherung der Vergleichsmiete (Zensus der Gemeinde x Kalibrierfaktor)
     4 satz_mittel / zensus / angebot  -> KEINE ortsuebliche Vergleichsmiete (§ 558 BGB),
                    sondern Ø Miete der Zinsstichprobe, Bestandsmiete des Zensus bzw.
                    Angebotsmiete. Dafuer gibt dieser Auszug KEINEN Wert heraus.
   Hier wird nichts neu gerechnet: dieselbe Zahl, die Stufe 3 im Ertragswert
   nutzt, als Auszug, ohne Ertrags-, Sach- oder Bodenwert und ohne Liegenschaftszins.

   Nach aussen nur feste Woerter (keine Quellennamen, kein Dokumenttitel).
   Kein Treffer heisst kein Wert: ohne Anker der Stufen 1 bis 3 { verfuegbar: false }.
   Kern ohne Einstellung, Datei oder Datenbank. Pruefer: tools/einzelcheck-pruefen.mjs (Teil N).
   ═══════════════════════════════════════════════════════════════════════ */

export const VGL_STUFEN = ['mietspiegel', 'amtlich', 'naeherung'];

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const r2 = (x) => Math.round(x * 100) / 100;

/** crossCheck (Ergebnis CrossCheckService.compute, VOR der Stufensperre)
 *  → { verfuegbar: true, qm, art, ca, unten, mittel, oben, einordnung } | { verfuegbar: false, grund } */
/* GEMESSEN 22.11.2026 am echten CrossCheckService (ETW 70 m², Wolfsburg, ohne Miteigentumsanteil): der
   Ertragswert ist dann nicht ausgewiesen (Bodenwert fehlt) und ertragswert.miete_stufe FEHLT - der Anker
   steht aber oben im Quercheck als crossCheck.miete_band (anker_stufe, anker_qm, spanne, einordnung), gesetzt
   unabhaengig davon, ob der Ertragswert rechnet. Deshalb zuerst dort lesen, dann im Ertragswert. */
export function vergleichsmieteAuszug(crossCheck) {
  const ew = (crossCheck && crossCheck.ertragswert) || {};
  const ms = ew.miete_stufe || null;
  const b = (crossCheck && crossCheck.miete_band && crossCheck.miete_band.anker_stufe) ? crossCheck.miete_band : (ew.miete_band || null);
  const code = (b && b.anker_stufe) || (ms && ms.code) || null;
  if (!code) return { verfuegbar: false, grund: 'nicht_ermittelt' };
  if (VGL_STUFEN.indexOf(code) < 0) return { verfuegbar: false, grund: 'keine_vergleichsmiete' };
  const qm = num(b && b.anker_stufe ? b.anker_qm : (ms && ms.qm));
  if (!(qm > 0)) return { verfuegbar: false, grund: 'keine_vergleichsmiete' };
  const sp = (b && b.spanne) || null;
  const spanne = (sp && num(sp.mittel) > 0) ? {
    unten: num(sp.unten) > 0 ? r2(num(sp.unten)) : null,
    mittel: r2(num(sp.mittel)),
    oben: num(sp.oben) > 0 ? r2(num(sp.oben)) : null
  } : null;
  /* CrossCheckService fuehrt die Einordnung in miete_band als Objekt (lib/mietanker.js einordnung(): { wahl, … }) */
  const einRoh = b && b.einordnung ? (typeof b.einordnung === 'string' ? b.einordnung : b.einordnung.wahl) : null;
  const ein = /^(oben|mittel|unten)$/.test(String(einRoh || '')) ? einRoh : null;
  return {
    verfuegbar: true,
    qm: r2(qm),
    art: code,
    ca: code === 'naeherung',
    unten: spanne ? spanne.unten : null,
    mittel: spanne ? spanne.mittel : null,
    oben: spanne ? spanne.oben : null,
    einordnung: ein
  };
}
