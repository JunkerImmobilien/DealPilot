/* v4060 · DIE MAXIMALE MIETE AN EINER STELLE (Marcel 23.11.2026)
 *
 * „Heute steht in jedem Reiter etwas anderes.“ Gemessen an der Demostraße 5 (ETW 68 m², 620 €): der Reiter Miete
 * zeigte „Mieterhöhung 9,12 €/m²“ (= heute, weil kein Spielraum), „Neuvermietung 8,88 €/m²“ (= 7,40 × 1,20) und
 * dazu „Neuvermietung 620 €“ (max aus heute und 8,88 × 68 = 604 €), darunter „mehr geht … bei Neuvermietung“ aus
 * potenzial.js, obwohl 604 € unter 620 € liegen. Drei Rechenwege in einer Karte, zwei davon nur in der Anzeige.
 *
 * Diese Datei ist KEIN zweiter Kern. Sie liest, was es schon gibt, und setzt es einmal zusammen:
 *   Bestand (§ 558 mit Kappung und Sperrfrist, Staffel, Index)  DpPotenzial.modell() → wohnung.soll / .index
 *                                                                 (rechnet mietpotenzial-kern.js sollFuer)
 *   Vergleichsmiete (Oberwert) und Mietpreisbremse               DpPotenzial.mietrechtDaten()
 *   Neuvermietung ohne Bremse                                    DpMieteRegel.faktorOhne() (Vorgabe 120 %, § 5 WiStG)
 *   Ergebnis der Mietrecherche (Marktmiete)                      Feld ds2_marktmiete, nur Zusatzinfo
 * Investorensicht (Memory berichte-investorensicht): das Maximum ist, was rechtlich geht, nicht was der Markt im
 * Mittel zahlt. Jede Anzeige (Reiter Miete, Häuschen, ViVi-Knopf, Mietpreis-Analyse, Zielbild) liest NUR einheit().
 */
(function (g) {
  'use strict';
  function zahl(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim().replace(/[€\s]/g, '');
    if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : 0;
  }
  function eur(x) { return Math.round(x).toLocaleString('de-DE') + ' €'; }
  function qm(x) { return (Math.round(x * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/m²'; }
  function r2(x) { return Math.round(x * 100) / 100; }

  var WIE = 'So ermittelt DealPilot die maximale Miete: Im Bestand die ortsübliche Vergleichsmiete am oberen Wert der Spanne, '
    + 'begrenzt durch die Kappungsgrenze (15 oder 20 % in 3 Jahren) und die Sperrfrist (§ 558 BGB). Staffel- und Indexmiete folgen dem Vertrag. '
    + 'Bei Neuvermietung mit Mietpreisbremse höchstens Vergleichsmiete plus 10 % (§ 556d BGB), ohne Bremse rechnet DealPilot mit der Grenze '
    + 'von 120 % der Vergleichsmiete (§ 5 WiStG, in den Einstellungen wählbar). Die Mietrecherche zeigt dazu, was der Markt heute zahlt.';

  function modell() {
    var P = g.DpPotenzial; if (!P || !P.modell) return null;
    try { return P.modell(); } catch (e) { return null; }
  }

  /* je Wohnung j des Modells */
  function rechne(m, j) {
    var P = g.DpPotenzial, w = m.wohnungen[j] || {}, d = {};
    try { d = (P.mietrechtDaten && P.mietrechtDaten(m, j)) || {}; } catch (e) { d = {}; }
    var ist = zahl(w.ist), wfl = zahl(w.wfl), leer = !(ist > 0) || w.status === 'leer';
    var so = w.soll || {}, vgl = zahl(d.vgl_qm) || zahl(so.vgl_qm) || zahl(w.vgl_qm);
    var br = d.bremse || null, brGilt = br ? br.gilt : null;
    var fo = g.DpMieteRegel ? g.DpMieteRegel.faktorOhne() : 1.2, pct = Math.round(fo * 100);
    var istQ = wfl > 0 && ist > 0 ? ist / wfl : 0;

    /* 1 · Bestand: § 558, sonst Vertrag (Staffel/Index), sonst die nächste Indexanpassung */
    var b = { monat: ist, mehr: false, art: null, ab: '', grenze: '' };
    if (!leer) {
      if (so.vertrag) {
        var vm = zahl(so.vertrag_monat);
        if (vm > ist + 0.5) b = { monat: r2(vm), mehr: true, art: 'vertrag', ab: so.ab_text || '', grenze: so.vertrag_text || 'laut Vertrag' };
      } else if (so.miete != null && zahl(so.miete) > ist + 0.5) {
        b = { monat: r2(zahl(so.miete)), mehr: true, art: '558', ab: so.ab_text || '', grenze: so.grenze || '',
          umlage559: so.umlage559 && zahl(so.umlage559.monat) > 0.5 ? r2(zahl(so.umlage559.monat)) : 0 };
      }
      var ix = w.index && w.index.ok && w.index.naechste ? w.index.naechste : null;
      if (ix && zahl(ix.miete_neu) > b.monat + 0.5) b = { monat: r2(zahl(ix.miete_neu)), mehr: true, art: 'index', ab: ix.wirksam || '', grenze: 'Indexanpassung' };
    }

    /* 2 · Neuvermietung: Bremse = Vergleichsmiete + 10 %, sonst die gewählte Grenze (Vorgabe 120 %) */
    var n = null;
    if (wfl > 0) {
      if (brGilt === true && zahl(d.obergrenze) > 0) n = { qm: r2(zahl(d.obergrenze)), regel: 'Mietpreisbremse, Vergleichsmiete plus 10 % nach § 556d BGB', kurz: '110 %, Mietpreisbremse' };
      else if (vgl > 0) n = { qm: r2(vgl * fo), regel: (brGilt === false ? 'keine Mietpreisbremse, ' : 'Mietpreisbremse nicht geprüft, ') + pct + ' % der Vergleichsmiete nach § 5 WiStG', kurz: pct + ' %, ohne Bremse' };
      if (n) { n.monat = r2(n.qm * wfl); n.mehr = n.monat > Math.max(ist, b.monat) + 0.5; }
    }

    /* 3 · Maximum und Spielraum */
    var max = Math.max(ist, b.monat, n ? n.monat : 0);
    var markt = zahl(g.document && (g.document.getElementById('ds2_marktmiete') || {}).value);

    /* 4 · EIN Satz */
    var s, ueber = null;
    if (leer) {
      s = n ? 'Leer. Bei Neuvermietung bis ' + eur(n.monat) + ' (' + qm(n.qm) + ', ' + n.regel + ').' : 'Leer. Für die Neuvermietung fehlt die Vergleichsmiete.';
    } else {
      if (b.mehr) {
        s = (b.art === '558' ? 'Mieterhöhung auf ' : b.art === 'index' ? 'Indexanpassung auf ' : 'Nächste Stufe laut Vertrag auf ')
          + eur(b.monat) + ' möglich (plus ' + eur(b.monat - ist) + ' im Monat' + (b.umlage559 ? ', davon ' + eur(b.umlage559) + ' Modernisierungsumlage nach § 559 BGB' : '') + (b.ab ? ', ' + b.ab : '') + ').';
      } else if (vgl > 0 && istQ > vgl + 0.005) {
        s = 'Die Miete liegt bereits über der ortsüblichen Vergleichsmiete (bis ' + qm(vgl) + '). Eine Erhöhung nach § 558 BGB ist nicht möglich.';
      } else if (so.vertrag) {
        s = 'Die Miete folgt dem Vertrag (' + (so.vertrag_text || 'Staffel oder Index') + '), eine Erhöhung nach § 558 BGB ist ausgeschlossen.';
      } else if (vgl > 0 && istQ < vgl - 0.005) {
        s = 'Eine Erhöhung nach § 558 BGB ist derzeit nicht möglich' + (so.grund && typeof so.grund === 'string' ? ': ' + String(so.grund).replace(/\.$/, '') : '') + '.';
      } else if (vgl > 0) {
        s = 'Die Miete hat die ortsübliche Vergleichsmiete (bis ' + qm(vgl) + ') erreicht. Eine Erhöhung nach § 558 BGB ist nicht möglich.';
      } else {
        s = 'Ohne Vergleichsmiete rechnet DealPilot keine Erhöhung. Trag sie im Zielbild ein oder lass den Mietspiegel laufen.';
      }
      if (n && n.mehr) s += ' Bei Neuvermietung bis ' + eur(n.monat) + ' (' + qm(n.qm) + ', ' + n.regel + ').';
      else if (n && !b.mehr) s += ' Auch bei Neuvermietung nicht mehr: DealPilot rechnet dort mit höchstens ' + qm(n.qm) + ' (' + n.kurz + ').';
      if (!b.mehr && !(n && n.mehr)) s += ' Mehr ist nur über eine Modernisierung möglich (§ 559 BGB).';
      /* v4290 · Marcel 23.11.2026: die heutige Miete wird nie gesetzt oder gedeckelt gerechnet. Liegt sie über der
         zulässigen Höchstmiete, sagt es der Satz klar, mit dem Risiko. */
      if (n && istQ > n.qm + 0.005) {
        ueber = { ist_qm: r2(istQ), max_qm: n.qm, kurz: n.kurz };
        s += ' Die heutige Miete liegt mit ' + qm(istQ) + ' über der zulässigen Höchstmiete von ' + qm(n.qm) + '. DealPilot rechnet mit der vereinbarten Miete weiter und ändert sie nicht. Der Mieter kann unter Umständen eine Herabsetzung oder Rückzahlung verlangen. Bitte rechtlich prüfen lassen.';
      }
    }
    return {
      i: w.i == null ? null : w.i, j: j, nr: w.nr || '', lage: w.lage || '', wfl: wfl, leer: leer,
      heute: ist, heute_qm: r2(istQ),
      vgl: { qm: vgl > 0 ? r2(vgl) : null, herkunft: d.vgl_herkunft || so.vgl_herkunft || '' },
      bestand: b, neu: n, bremse: brGilt,
      max: r2(max), max_qm: wfl > 0 ? r2(max / wfl) : null,
      spielraum_bestand: r2(Math.max(0, b.monat - ist)),
      spielraum: r2(Math.max(0, max - ist)),
      markt_qm: markt > 0 ? markt : null,
      satz: s,
      ueber_hoechst: ueber   /* v4290 */
    };
  }

  /* einheit(i): i = Index der Wohnung im MFH (wohnung.i), null oder 'objekt' = die erste/einzige */
  function alle(m) {
    m = m || modell();
    if (!m || !Array.isArray(m.wohnungen) || !m.wohnungen.length) return null;
    var W = m.wohnungen.map(function (_, j) { return rechne(m, j); });
    return { m: m, mfh: m.art === 'mfh', W: W };
  }
  function einheit(i, m) {
    var A = alle(m); if (!A) return null;
    if (i == null || i === 'objekt') return A.W[0];
    for (var k = 0; k < A.W.length; k++) if (String(A.W[k].i) === String(i)) return A.W[k];
    return null;
  }
  /* ein Aufklapper, überall gleich (Reiter Miete, Mietpreis-Analyse, ViVi) */
  function wieHtml() {
    return '<details class="dp-mmax-wie"><summary>Wie wir die maximale Miete ermitteln</summary><p>' + WIE + '</p></details>';
  }
  g.DpMieteMax = { VERSION: 'v4290', alle: alle, einheit: einheit, rechne: rechne, wieHtml: wieHtml, WIE: WIE };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.DpMieteMax;
})(typeof window !== 'undefined' ? window : globalThis);
