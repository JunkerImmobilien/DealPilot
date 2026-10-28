/* ═══════════════════════════════════════════════════════════════════════
   js/indexmiete.js · v3026 — mögliche Erhöhung einer Indexmiete je Jahr

   Marcel 28.10.2026: „kann der [Verbraucherpreisindex] auch bei Indexmieten
   die mögliche Mieterhöhung für jedes Jahr berechnen?"

   § 557b BGB (gesetze-im-internet.de, gelesen 28.10.2026), wörtlich:
     (1) Die Vertragsparteien können schriftlich vereinbaren, dass die Miete
         durch den vom Statistischen Bundesamt ermittelten Preisindex für die
         Lebenshaltung aller privaten Haushalte in Deutschland bestimmt wird
         (Indexmiete).
     (2) Während der Geltung einer Indexmiete muss die Miete, von Erhöhungen
         nach den §§ 559 bis 560 abgesehen, jeweils mindestens ein Jahr
         unverändert bleiben. Eine Erhöhung nach § 559 oder § 559e kann nur
         verlangt werden, soweit der Vermieter bauliche Maßnahmen auf Grund von
         Umständen durchgeführt hat, die er nicht zu vertreten hat, es sei denn,
         es wurde eine Modernisierungsmaßnahme nach § 555b Nummer 1a
         durchgeführt. Eine Erhöhung nach § 558 ist ausgeschlossen.
     (3) Eine Änderung der Miete nach Absatz 1 muss durch Erklärung in
         Textform geltend gemacht werden. Dabei sind die eingetretene Änderung
         des Preisindexes sowie die jeweilige Miete oder die Erhöhung in einem
         Geldbetrag anzugeben. Die geänderte Miete ist mit Beginn des
         übernächsten Monats nach dem Zugang der Erklärung zu entrichten.
     (4) Die §§ 556d bis 556g sind nur auf die Ausgangsmiete einer
         Indexmietvereinbarung anzuwenden.
     (5) Eine zum Nachteil des Mieters abweichende Vereinbarung ist unwirksam.

   DER RECHENWEG (Monate als 'JJJJ-MM'):
     Basis      VPI im Monat der letzten Anpassung, sonst des Mietbeginns
                (Feld „Letzte Erhöhung" bzw. „Mietbeginn").
     Schritt 1  Erklärung (Zugang) E1 = max(heute, Basis + 10 Monate)
                wirksam W1 = E1 + 2 Monate (Abs. 3: Beginn des übernächsten
                Monats) — damit W1 ≥ Basis + 12 (Abs. 2: ein Jahr unverändert).
                Indexmonat I1 = der jüngste veröffentlichte Monat vor E1.
     Schritt k  E_k = E_(k-1) + 12, W_k = W_(k-1) + 12, I_k = E_k − 1;
                neue Basis ist der Index des vorigen Schritts (die Erklärung
                nennt die eingetretene Änderung SEIT der letzten Anpassung).
     Miete neu  = Miete alt × VPI(I_k) / VPI(Basis_k), auf Cent.
   Vergangenheit: echte VPI-Werte (Destatis 61111-0002, 2020 = 100).
   Zukunft: KEIN amtlicher Wert — VPI(letzter Monat) × (1 + a)^(Monate/12),
   a = Annahme des Nutzers (Investmentprofil), Vorgabe 2,0 % p. a. Jede Zeile
   mit Annahme trägt annahme: true und wird so beschriftet.
   Ein Schritt mit fallendem Index ist eine SENKUNG (der Mieter darf sie
   verlangen) und wird als solche gezeigt.

   Ein Kern liest NIE Einstellungen: VPI-Reihe, Annahme und „heute" kommen
   als Parameter. Prüfstrecke: tools/indexmiete-pruefen.mjs.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var ANNAHME_VORGABE_PCT = 2.0;
  var JAHRE_VORGABE = 5;

  function ym(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + '-' + m[2] : null; }
  function idx(k) { return Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1; }
  function ausIdx(n) { var j = Math.floor(n / 12), m = n - j * 12 + 1; return j + '-' + (m < 10 ? '0' : '') + m; }
  function plus(k, n) { return ausIdx(idx(k) + n); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function monatText(k) { return k ? k.slice(5, 7) + '/' + k.slice(0, 4) : ''; }

  /**
   * @param {object} o
   *   miete        Ist-Kaltmiete €/Monat (heute gültig)
   *   beginn       Mietbeginn 'JJJJ-MM(-TT)'
   *   letzte       letzte Erhöhung 'JJJJ-MM(-TT)' (wirksam)
   *   vpi          { monate: {'JJJJ-MM': wert} } — Basis 2020 = 100
   *   annahme_pct  VPI-Annahme für die Zukunft, % p. a. (Vorgabe 2,0)
   *   heute        'JJJJ-MM' (Pflicht in Prüfungen; sonst Systemuhr)
   *   jahre        Zahl der Schritte (Vorgabe 5)
   */
  function rechne(o) {
    o = o || {};
    var fehlt = [];
    var miete = Number(o.miete);
    if (!(miete > 0)) fehlt.push('Ist-Kaltmiete');
    var letzte = ym(o.letzte), beginn = ym(o.beginn);
    var basisMonat = letzte || beginn;
    if (!basisMonat) fehlt.push('Mietbeginn oder letzte Erhöhung (Datum)');
    var monate = (o.vpi && o.vpi.monate) || null;
    var keys = monate ? Object.keys(monate).filter(function (k) { return /^\d{4}-\d{2}$/.test(k) && Number(monate[k]) > 0; }).sort() : [];
    if (!keys.length) fehlt.push('Verbraucherpreisindex (Reihe noch nicht geladen)');
    var heute = ym(o.heute) || (function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
    var a = (o.annahme_pct == null || o.annahme_pct === '' || !isFinite(Number(o.annahme_pct))) ? ANNAHME_VORGABE_PCT : Number(o.annahme_pct);
    var jahre = Math.max(1, Math.min(10, Math.round(Number(o.jahre) || JAHRE_VORGABE)));
    var out = { ok: false, fehlt: fehlt, annahme_pct: a, heute: heute };
    if (fehlt.length) return out;
    if (basisMonat > heute) { out.fehlt = [(letzte ? 'Letzte Erhöhung' : 'Mietbeginn') + ' liegt in der Zukunft (' + monatText(basisMonat) + ')']; return out; }
    var lk = keys[keys.length - 1];
    if (monate[basisMonat] == null) {
      out.fehlt = ['Verbraucherpreisindex für ' + monatText(basisMonat) + ' liegt nicht vor (Reihe ' + monatText(keys[0]) + ' bis ' + monatText(lk) + ')'];
      return out;
    }
    function wert(k) {
      if (k <= lk) {
        if (monate[k] != null) return { wert: Number(monate[k]), annahme: false, monat: k };
        var vor = keys.filter(function (x) { return x <= k; }).pop();
        return vor ? { wert: Number(monate[vor]), annahme: false, monat: vor } : null;
      }
      var n = idx(k) - idx(lk);
      return { wert: r1(Number(monate[lk]) * Math.pow(1 + a / 100, n / 12)), annahme: true, monat: k };
    }
    var basis = { monat: basisMonat, wert: Number(monate[basisMonat]), herkunft: letzte ? 'letzte Erhöhung' : 'Mietbeginn' };
    var e1 = basisMonat && plus(basisMonat, 10) > heute ? plus(basisMonat, 10) : heute;
    var schritte = [], alt = miete, bWert = basis.wert, bMonat = basisMonat;
    for (var k = 0; k < jahre; k++) {
      var E = plus(e1, 12 * k);
      var I = plus(E, -1);
      if (k === 0 && I > lk && E <= heute) I = lk;   /* jetzt erklären: der jüngste veröffentlichte Monat */
      var v = wert(I);
      if (!v) break;
      var neu = r2(alt * v.wert / bWert);
      schritte.push({
        nr: k + 1, erklaerung: E, wirksam: plus(E, 2), indexmonat: v.monat, index: v.wert, annahme: v.annahme,
        basis_monat: bMonat, basis_index: bWert, aenderung_pct: Math.round((v.wert / bWert - 1) * 10000) / 100,
        miete_alt: r2(alt), miete_neu: neu, plus_monat: r2(neu - alt), plus_jahr: r2((neu - alt) * 12),
        plus_monat_kum: r2(neu - miete), senkung: neu < alt
      });
      alt = neu; bWert = v.wert; bMonat = v.monat;
    }
    out.ok = schritte.length > 0;
    out.basis = basis;
    out.miete = r2(miete);
    out.letzter_vpi = { monat: lk, wert: Number(monate[lk]) };
    out.schritte = schritte;
    out.naechste = schritte[0] || null;
    out.in_jahren = schritte.length ? { jahre: schritte.length, miete: schritte[schritte.length - 1].miete_neu, plus_monat: r2(schritte[schritte.length - 1].miete_neu - miete) } : null;
    out.annahme_text = 'Annahme ' + String(a).replace('.', ',') + ' % Preisanstieg p. a. – kein amtlicher Wert';
    return out;
  }

  /** Summe je Haus aus mehreren Ergebnissen (nur ok). */
  function haus(liste) {
    var ok = (liste || []).filter(function (x) { return x && x.ok; });
    if (!ok.length) return null;
    var naechsteAb = ok.map(function (x) { return x.naechste.wirksam; }).sort()[0];
    return {
      n: ok.length,
      plus_monat_naechste: r2(ok.reduce(function (s, x) { return s + x.naechste.plus_monat; }, 0)),
      plus_jahr_naechste: r2(ok.reduce(function (s, x) { return s + x.naechste.plus_jahr; }, 0)),
      naechste_ab: naechsteAb,
      jahre: Math.min.apply(null, ok.map(function (x) { return x.schritte.length; })),
      plus_monat_in_jahren: r2(ok.reduce(function (s, x) { return s + (x.in_jahren ? x.in_jahren.plus_monat : 0); }, 0)),
      annahme_pct: ok[0].annahme_pct,
      annahme: ok.some(function (x) { return x.schritte.some(function (s) { return s.annahme; }); })
    };
  }

  /* ── Darstellung (nur Browser) ─────────────────────────────────────── */
  function eur(x) { return (Math.round(x * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahlDe(x, n) { return Number(x).toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n }); }

  /** kleine Tabelle je Wohnung: Jahr | Index | mögliche Miete | Erhöhung €/Monat | wirksam ab */
  function tabelleHtml(r, titel) {
    var kopf = titel ? '<div class="dp-idx-t">' + esc(titel) + '</div>' : '';
    if (!r || !r.ok) {
      return '<div class="dp-idx">' + kopf + '<div class="dp-idx-fehlt">Indexmiete: zum Rechnen fehlt ' + esc(((r && r.fehlt) || []).join(', ') || 'eine Angabe') + '.</div></div>';
    }
    var zeilen = r.schritte.map(function (s) {
      return '<tr' + (s.annahme ? ' class="dp-idx-ann"' : '') + '><td>' + s.wirksam.slice(0, 4) + '</td>'
        + '<td>' + zahlDe(s.index, 1) + (s.annahme ? '*' : '') + ' <small>(' + monatText(s.indexmonat) + ')</small></td>'
        + '<td>' + eur(s.miete_neu) + '</td>'
        + '<td>' + (s.plus_monat >= 0 ? '+' : '') + eur(s.plus_monat) + (s.senkung ? ' <small>Senkung</small>' : '') + '</td>'
        + '<td>01.' + monatText(s.wirksam).replace('/', '.') + '</td></tr>';
    }).join('');
    return '<div class="dp-idx">' + kopf
      + '<table class="dp-idx-tab"><thead><tr><th>Jahr</th><th>Index</th><th>mögliche Miete</th><th>Erhöhung €/Monat</th><th>wirksam ab</th></tr></thead><tbody>' + zeilen + '</tbody></table>'
      + '<div class="dp-idx-fuss">Basis: VPI ' + zahlDe(r.basis.wert, 1) + ' (' + monatText(r.basis.monat) + ', ' + esc(r.basis.herkunft) + '), Miete heute ' + eur(r.miete) + '. '
      + 'Erklärung in Textform, wirksam ab dem übernächsten Monat; frühestens ein Jahr nach der letzten Änderung (§ 557b Abs. 2 und 3 BGB). '
      + 'Echte Werte bis ' + monatText(r.letzter_vpi.monat) + (r.schritte.some(function (s) { return s.annahme; }) ? '; * = Szenario: ' + esc(r.annahme_text) : '') + '.</div></div>';
  }

  /** eine Zeile für Pilot-Analyse und PDF */
  function zeileText(h) {
    if (!h) return '';
    return 'Indexmiete' + (h.n > 1 ? ' (' + h.n + ' Wohnungen)' : '') + ': nächste Anpassung ab ' + monatText(h.naechste_ab) + ' möglich, '
      + (h.plus_monat_naechste >= 0 ? '+' : '') + eur(h.plus_monat_naechste) + '/Monat (' + (h.plus_jahr_naechste >= 0 ? '+' : '') + eur(h.plus_jahr_naechste) + '/Jahr); in '
      + h.jahre + ' Jahren +' + eur(h.plus_monat_in_jahren) + '/Monat'
      + (h.annahme ? ' (Annahme ' + String(h.annahme_pct).replace('.', ',') + ' % VPI p. a., kein amtlicher Wert)' : '') + '.';
  }

  var STIL = '.dp-idx{margin:8px 0 4px}.dp-idx-t{font:600 12px Inter,sans-serif;color:#2A2727;margin:0 0 4px}'
    + '.dp-idx-tab{width:100%;border-collapse:collapse;font:12px Inter,sans-serif;color:#2A2727}'
    + '.dp-idx-tab th{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B645A;text-align:left;padding:4px 6px;border-bottom:1px solid #E6DCC2}'
    + '.dp-idx-tab td{padding:4px 6px;border-bottom:1px solid #F0E9D6;white-space:nowrap}.dp-idx-tab td small{color:#6B645A}'
    + '.dp-idx-tab tr.dp-idx-ann td{color:#6B645A;font-style:italic}'
    + '.dp-idx-fuss,.dp-idx-fehlt{font:11.5px/1.4 Inter,sans-serif;color:#6B645A;margin-top:4px}'
    + '.dp-idx-wrap{overflow-x:auto}';
  function stil() {
    if (typeof document === 'undefined' || document.getElementById('dp-idx-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-idx-stil'; s.textContent = STIL; document.head.appendChild(s);
  }

  var API = { rechne: rechne, haus: haus, tabelleHtml: tabelleHtml, zeileText: zeileText, stil: stil,
    ANNAHME_VORGABE_PCT: ANNAHME_VORGABE_PCT, JAHRE_VORGABE: JAHRE_VORGABE, _plus: plus };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DpIndexmiete = API;
})(typeof window !== 'undefined' ? window : this);
