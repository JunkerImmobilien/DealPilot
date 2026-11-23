/* miete-demo.js · v3870 · DEMO „Reiter Miete neu“, NUR AUF STAGING
 *
 * Marcel 19.11.2026: „Bau doch einfach mal so ein Demo-Tab dort mit ein, wie der dann tatsächlich aussehen würde,
 * mit den Werten und allem ... Pilot-Mietpreis-Analyse, Mietstruktur, Mietpreis-Analyse bleiben drin. Mietvertrag,
 * Mietrecht an der Adresse, Mietentwicklung, Mieterhöhung und Zielbild: da kannst du dich frei austoben."
 * Vorlage: design/Vorschläge/miete-und-einheiten-gesamt.html (Variante B, Cockpit).
 *
 * Wie: oben im Reiter Miete ein Umschalter „heute | neu (Demo)“ (gemerkt in localStorage dp_miete_demo).
 * „neu“ baut einen Block #dp-md an die Stelle der Karte Mietvertrag. Die echten Karten (Mietvertrag, Mietrecht,
 * Zielbild) werden NICHT nachgebaut, sondern in den Block umgehängt (Eingaben und Handler bleiben dieselben) und
 * beim Zurückschalten an ihren Platz zurückgestellt. Rechnet nichts selbst: Zahlen aus DpPotenzial.modell() und
 * mietrechtDaten() (dieselbe Leiter wie im Wohnungsfenster). Kundentext nur mit Punkt und Komma.
 */
/* v4005 · Marcel 23.11.2026: „komplett auf neu umstellen“. Der Umschalter „neu | bisher“ ist weg, die neue Ansicht
 * gilt immer (ein alter Merker dp_miete_demo=0 wird nicht mehr gelesen). Nur ohne Daten (kein Modell, keine Wohnung)
 * bleiben die Karten an ihrem Platz, weil der Block dann nichts zu zeigen hat. Gegenprobe, dass nichts fehlt: Mietvertrag,
 * Mietrecht und Zielbild hängen als echte Karten im Block. Beim MFH stand die Karte Mietvertrag bisher unsichtbar
 * (Vertragsarten der Wohnungen, Erhöhungen der Wohnungen, „Einheiten erfassen“): jetzt aufklappbar in der Karte „Das Haus“. */
(function () {
  'use strict';
  if (window.DpMieteDemo) return;
  var KEY = 'dp_miete_demo';   /* v4005 · nur noch Altlast, wird nicht mehr gelesen */
  function aktiv() { return true; }   /* v4005 · immer neu, kein Umschalter mehr */
  function erlaubt() { return true; }   /* v3880b · nicht mehr nur Staging */
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return Math.round(x).toLocaleString('de-DE') + ' €'; }
  function qm(x) { return (Math.round(x * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/m²'; }
  var _sel = 0, _platz = {};
  /* v3880b · Marcel: „optisch mehr an den DealPilot-Standard“. Echtes Karten-Markup (.card, .ct ct-pro, Symbolkasten) wie jede Karte im Reiter. */
  function kopf(ico, t, hint) { return '<div class="ct ct-pro"><span class="ct-ico"><svg width="22" height="22"><use href="#i-' + ico + '"/></svg></span>' + t + (hint ? '<span class="oe-ct-hint">' + hint + '</span>' : '') + '</div>'; }

  function stil() {
    if (el('dp-md-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-md-stil';
    s.textContent = [
      '.dp-md-schalter{display:inline-flex;border:1px solid color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 30%,transparent);border-radius:2px;overflow:hidden;margin:0 0 12px;background:#fff}',
      '.dp-md-schalter button{border:0;background:transparent;padding:7px 14px;font:500 12.5px Inter,sans-serif;color:#6B6356;cursor:pointer;min-height:34px}',
      '.dp-md-schalter button.an{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#1a1712;font-weight:600}',
      '.dp-md-schalter span{align-self:center;padding:0 12px;font:500 10px "JetBrains Mono",monospace;letter-spacing:.08em;color:#8A8272;text-transform:uppercase}',
      '#dp-md{min-width:0;max-width:100%;box-sizing:border-box}#dp-md *{box-sizing:border-box}',
      /* v3942 · der Block steht in voller Breite unter .col2 (siehe zeichnen). Heute und Haus/Wohnung über die ganze
         Breite, „Was hier gilt“ und „Zielbild“ nebeneinander (gemessen 260 / 200 px hoch), unter 861 px untereinander. */
      '#dp-md{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px;align-items:start;margin-top:14px}',
      '#dp-md>.dp-md-k{grid-column:1/-1}',
      '#mv-objekt-karte .mv-weitere{margin:6px 0 10px}#mv-objekt-karte .mv-weitere>summary{cursor:pointer;font-size:12px;color:#7A7370;padding:4px 0}#mv-objekt-karte .mv-weitere[open]>summary{margin-bottom:6px}',
      /* v4060 · der eine Satz, Kurzfassung „Was hier gilt“, Aufklapper „Wie wir die maximale Miete ermitteln“ */
      '#dp-md .stand{font-size:12.5px;color:#2A2727;line-height:1.5;border-left:3px solid var(--wl-c9a84c,#C9A84C);background:#FDFCFA;padding:7px 10px;margin:10px 0 4px;border-radius:2px}',
      '#dp-md .stand.s-pot{border-left-color:#3FA56C}#dp-md .stand.s-ueb{border-left-color:#B8625C}#dp-md .stand.s-leer{border-left-color:#C9C2B4}',
      '#dp-md .s-leer{border-color:#C9C2B4}#dp-md .s-leer .st{background:#C9C2B4;color:#2A2727}',
      '#dp-md .gilt-kurz{font:400 11.5px Inter,sans-serif;color:#7A7370;margin-left:10px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 auto}',
      '@media (max-width:640px){#dp-md .gilt-kurz{display:none}}',
      '#dp-md details.dp-mmax-wie,.dp-mmax-wie{margin:8px 0 0;font-size:11.5px;color:#625C59}#dp-md details.dp-mmax-wie>summary,.dp-mmax-wie>summary{cursor:pointer;color:#7A7370;font-size:11.5px}.dp-mmax-wie p{margin:4px 0 0;line-height:1.5}',
      '@media (max-width:860px){#dp-md{grid-template-columns:minmax(0,1fr)}}',
      '#dp-md .dp-md-k{min-width:0;overflow:hidden;margin:0 0 14px}',
      '#dp-md h3{margin:0 0 4px;font:600 15px "Space Grotesk",sans-serif;color:#2A2727;display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '#dp-md .lbl{font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370}',
      '#dp-md .satz{color:#625C59;font-size:11.5px;margin:-6px 0 12px;line-height:1.5}',
      '#dp-md .reihe{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}',
      '#dp-md .zahl{background:#FBF6E9;border:1px solid color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 18%,transparent);border-radius:2px;padding:10px 12px}#dp-md .zahl small{display:block;color:#6B645A;font-size:11px}#dp-md .zahl small:first-child{font:700 9.5px "JetBrains Mono",monospace;letter-spacing:1.1px;text-transform:uppercase;margin-bottom:3px}#dp-md .zahl b{display:block;font:600 19px "Space Grotesk",sans-serif;color:#2A2727}#dp-md .zahl b.gr{color:#3FA56C}#dp-md .zahl b.go{color:var(--wl-b8932f,#b8932f)}',
      '#dp-md .balken{display:flex;height:14px;border-radius:2px;overflow:hidden;margin:8px 0 4px}#dp-md .balken span{display:block}',
      '#dp-md .leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:#7A7370}#dp-md .leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}',
      '#dp-md .haus{display:grid;gap:6px;margin-top:8px}#dp-md .dach{height:26px;background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));clip-path:polygon(6% 100%,50% 0,94% 100%);opacity:.9}',
      '#dp-md .etage-z{display:grid;grid-template-columns:34px minmax(0,1fr);gap:6px;align-items:stretch}#dp-md .etage-n{font:700 9.5px "JetBrains Mono",monospace;letter-spacing:1px;color:#6B645A;display:flex;align-items:center}',
      '#dp-md .etage{display:grid;gap:6px}',
      '#dp-md .whg{display:block!important;width:100%;min-width:0;white-space:normal;height:auto;border-radius:2px;padding:8px 9px;border:1.5px solid #E6E0D3;background:#fff;cursor:pointer;text-align:left;font:inherit;color:#2A2727;min-height:78px;position:relative}',
      '#dp-md .whg.sel{outline:2px solid var(--wl-c9a84c,#C9A84C);outline-offset:1px}',
      '#dp-md .whg .n,#dp-md .whg .m,#dp-md .whg .q{display:block}#dp-md .whg .n{font:600 12px "Space Grotesk",sans-serif}#dp-md .whg .m{font:600 14.5px "Space Grotesk",sans-serif;margin-top:2px}#dp-md .whg .q{color:#7A7370;font-size:11px}',
      '#dp-md .whg .st{display:inline-block;font:700 8.5px "JetBrains Mono",monospace;letter-spacing:.08em;padding:2px 6px;border-radius:2px;margin-bottom:4px}',
      '#dp-md .s-pot{border-color:#3FA56C;box-shadow:inset 3px 0 0 #3FA56C}#dp-md .s-pot .st{background:#3FA56C;color:#fff}',
      '#dp-md .s-aus{border-color:var(--wl-c9a84c,#C9A84C);box-shadow:inset 3px 0 0 var(--wl-c9a84c,#C9A84C)}#dp-md .s-aus .st{background:var(--wl-c9a84c,#C9A84C);color:#1a1712}',
      '#dp-md .s-ueb{border-color:#B8625C;box-shadow:inset 3px 0 0 #B8625C}#dp-md .s-ueb .st{background:#B8625C;color:#fff}',
      '#dp-md .boden{height:7px;border-radius:4px;background:#E6E0D3}',
      '#dp-md .leiter{margin:8px 0 2px}#dp-md .bahn{position:relative;height:10px;border-radius:2px;background:#FBF6E9;border:1px solid #E6E0D3}',
      '#dp-md .bahn i{position:absolute;top:-3px;width:3px;height:16px;border-radius:2px}',
      '#dp-md .marken{display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:11px;color:#7A7370;margin-top:4px}',
      '#dp-md .grund{font-size:11.5px;color:#625C59;line-height:1.5;border-left:2px solid var(--wl-c9a84c,#C9A84C);padding:4px 0 4px 10px;margin:10px 0}',
      '#dp-md .knoepfe{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}#dp-md .knoepfe .btn{white-space:normal;max-width:100%;height:auto;min-height:32px;text-align:left}',   /* v4060 · am Handy brach „Nebenkosten in ViVi anpassen (180 € auf 188 €)“ nicht um und wurde abgeschnitten */
      '#dp-md .regel{display:grid;grid-template-columns:120px 1fr;gap:2px 12px;padding:7px 0;border-top:1px solid #F1ECE1;font-size:12.5px}#dp-md .regel:first-of-type{border-top:0}',
      '#dp-md .regel p{margin:2px 0 0;color:#7A7370;font-size:11.5px}',
      '#dp-md details.dp-md-auf>summary{cursor:pointer;list-style:none;font:600 13px "Space Grotesk",sans-serif;color:#2A2727;min-height:32px;display:flex;align-items:center}',
      '#dp-md details.dp-md-auf>summary::-webkit-details-marker{display:none}',
      '#dp-md details.dp-md-auf>summary::after{content:"aufklappen";margin-left:auto;font:400 11.5px Inter,sans-serif;color:#7A7370}',
      '#dp-md details.dp-md-auf[open]>summary::after{content:"einklappen"}',
      '#dp-md details.dp-md-auf>.card{margin-top:8px}',
      '#dp-md .demo-hin{font-size:11px;color:#8A8272;margin:0 0 10px}',
      '@media (max-width:640px){#dp-md .regel{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Zahlen aus dem Kern ─────────────────────────────────────────── */
  /* v4060 · Marcel 23.11.2026: „Mieterhöhung 9,12, Neuvermietung 8,88, aber Neuvermietung 620 €, und darunter kein
     Spielraum. Das macht doch keinen Sinn.“ Alle Zahlen kommen jetzt aus EINER Stelle (js/miete-max.js, DpMieteMax),
     die auch Häuschen, ViVi-Knopf, Mietpreis-Analyse und Zielbild lesen. Hier wird nichts mehr gerechnet. */
  function daten() {
    var A = window.DpMieteMax && DpMieteMax.alle(); if (!A) return null;
    var W = A.W.map(function (x) {
      var w = A.m.wohnungen[x.j] || {};
      var st = x.leer ? 'leer' : (x.bestand.mehr ? 'pot' : (x.vgl.qm && x.heute_qm > x.vgl.qm + 0.005 ? 'ueb' : 'aus'));
      return Object.assign({}, x, { ist: x.heute, istQ: x.heute_qm, vgl: x.vgl.qm || 0, soll: x.bestand.monat, neuQ: x.neu ? x.neu.qm : 0, neuM: x.neu ? x.neu.monat : 0,
        neuMehr: !!(x.neu && x.neu.mehr), st: st, ziel: Number(w.ziel) || 0, kosten: Number(w.kosten) || 0, status: w.status });
    });
    return { m: A.m, mfh: A.mfh, W: W };
  }

  function leiter(w) {
    if (!(w.bestand.mehr || w.neuMehr) || !(w.istQ > 0)) return '';   /* v4060 · ohne Spielraum keine Leiter mit drei gleichen Zahlen */
    var sQ = w.wfl > 0 ? w.soll / w.wfl : w.istQ;
    var pts = [w.istQ, sQ, w.vgl || w.istQ, w.neuMehr ? w.neuQ : w.istQ];
    var a = Math.min.apply(null, pts) - 0.4, b = Math.max.apply(null, pts) + 0.4;
    if (!(b > a)) return '';
    var p = function (x) { return ((x - a) / (b - a) * 100).toFixed(1) + '%'; };
    return '<div class="leiter"><div class="bahn">'
      + (w.vgl > 0 ? '<i style="left:' + p(w.vgl) + ';background:#9ED0B3;width:2px" title="Vergleichsmiete bis ' + qm(w.vgl) + '"></i>' : '')
      + '<i style="left:' + p(w.istQ) + ';background:#2A2727" title="heute"></i>'
      + (w.bestand.mehr ? '<i style="left:' + p(sQ) + ';background:#3FA56C" title="Mieterhöhung"></i>' : '')
      + (w.neuMehr ? '<i style="left:' + p(w.neuQ) + ';background:var(--wl-c9a84c,#C9A84C)" title="Neuvermietung"></i>' : '') + '</div>'
      + '<div class="marken"><span>heute ' + qm(w.istQ) + '</span>' + (w.bestand.mehr ? '<span>Mieterhöhung ' + qm(sQ) + '</span>' : '') + (w.neuMehr ? '<span>Neuvermietung ' + qm(w.neuQ) + '</span>' : '') + '</div></div>';
  }
  /* v4037 · Absprung nach ViVi, wo DealPilot Spielraum zeigt (ein Fenster: DpViviMieterhoehung). Neuvermietung bekommt
     keinen Absprung, das ist keine Mieterhöhung im laufenden Vertrag. */
  function viviKnopf(w, mfh) {
    var V = window.DpViviMieterhoehung;
    if (!V || !V.verfuegbar() || !w || !(w.ist > 0)) return '';
    /* v4042 · nur mit Spielraum (dieselbe Regel wie Pilot-Analyse › ViVi) */
    if (V.spielraum ? !V.spielraum(mfh && w.i != null ? w.i : null) : !(w.soll >= w.ist + 1)) return '';
    return '<button type="button" class="btn btn-sm" data-md-vivi="' + (mfh && w.i != null ? w.i : 'objekt') + '">Mieterhöhung in ViVi anlegen</button>';
  }
  /* v4042 · Nebenkosten-Vorauszahlung: weicht ViVi vom Soll in DealPilot ab (eigene Angabe, sonst umlagefähige Kosten
     nach Wohnfläche), steht die Abweichung hier mit Absprung (ein Fenster: DpViviNkAnpassung). */
  function nkKnopf(w, mfh) {
    var N = window.DpViviNkAnpassung;
    if (!N || !N.verfuegbar() || !w) return '';
    var a = null; try { a = N.abweichung(mfh && w.i != null ? w.i : null); } catch (e) { a = null; }
    if (!a) return '';
    return '<button type="button" class="btn btn-outline btn-sm" data-md-nk="' + (mfh && w.i != null ? w.i : 'objekt') + '" title="ViVi ' + eur(a.vivi) + ', DealPilot ' + eur(a.ziel) + ' im Monat">Nebenkosten in ViVi anpassen (' + eur(a.vivi) + ' auf ' + eur(a.ziel) + ')</button>';
  }
  /* v4060 · der EINE Satz aus DpMieteMax, eingefärbt wie die Kachel */
  function stand(w) { return '<div class="stand s-' + w.st + '">' + esc(w.satz) + '</div>'; }
  function vglTitel() { return 'Ortsübliche Vergleichsmiete, oberer Wert der Spanne für diese Wohnung (Größe, Baujahr, Merkmale). Bis dahin darf die Miete im Bestand steigen, begrenzt durch die Kappungsgrenze (§ 558 BGB).'; }
  function zahlen(w) {
    var z = [];
    if (w.bestand.mehr) z.push('<div class="zahl"><small>Mieterhöhung</small><b>' + eur(w.soll) + '</b><small>plus ' + eur(w.soll - w.ist) + ' im Monat' + (w.bestand.ab ? ', ' + esc(w.bestand.ab) : '') + '</small></div>');
    if (w.neuMehr) z.push('<div class="zahl"><small>Neuvermietung</small><b>' + eur(w.neuM) + '</b><small>' + qm(w.neuQ) + ', ' + esc(w.neu.kurz) + '</small></div>');
    return z.length ? '<div class="reihe" style="margin-top:8px">' + z.join('') + '</div>' : '';
  }
  function wie() { return window.DpMieteMax ? DpMieteMax.wieHtml() : ''; }
  function regelnHtml(D, w) {
    var m = D.m, k = m.kappung || {}, v = m.vgl || {}; w = w || D.W[0]; var br = w && w.bremse === true;
    var vq = (w && w.vgl) || v.qm;
    var kurz = 'Kappung ' + (k.pct || 20) + ' % in 3 Jahren · Vergleichsmiete bis ' + (vq ? qm(vq) : 'fehlt') + ' · Neuvermietung ' + (br ? 'mit Mietpreisbremse' : 'ohne Bremse');
    return '<details class="dp-md-auf dp-md-gilt" data-md-platz="mr"><summary>Was hier gilt<span class="gilt-kurz">' + kurz + '</span></summary>'
      + '<div class="regel"><span class="lbl">Kappung</span><div><b>' + (k.pct || 20) + ' % in 3 Jahren</b><p>' + (k.herkunft === 'verordnung' ? 'Die Gemeinde steht in der Verordnung.' : 'Gesetzlich nach § 558 Abs. 3 BGB.') + '</p></div></div>'
      + '<div class="regel"><span class="lbl">Vergleichsmiete</span><div><b>bis ' + (vq ? qm(vq) : '–') + '</b><p>' + esc(v.ms && v.ms.wahl_text ? (v.qualifiziert ? 'qualifizierter' : 'einfacher') + ' Mietspiegel, ' + v.ms.wahl_text : (v.art || '')) + (D.mfh ? '. Je Wohnung nach ihrer Größe.' : '.') + '</p></div></div>'
      + '<div class="regel"><span class="lbl">Neuvermietung</span><div><b>' + (br ? 'Mietpreisbremse, höchstens 110 %' : 'ohne Bremse, DealPilot rechnet mit ' + (window.DpMieteRegel ? DpMieteRegel.pct() : 120) + ' %') + '</b></div></div>'
      + '</details>';
  }

  /* ── Karten des Demo-Blocks ──────────────────────────────────────── */
  function karteHeute(D) {   /* nur beim Haus mit mehreren Wohnungen */
    var s = D.W.reduce(function (a, w) { return a + w.ist; }, 0), so = D.W.reduce(function (a, w) { return a + w.soll; }, 0), ne = D.W.reduce(function (a, w) { return a + Math.max(w.soll, w.neuMehr ? w.neuM : 0); }, 0);
    var fl = D.W.reduce(function (a, w) { return a + (w.ist > 0 ? w.wfl : 0); }, 0);
    var mehrB = so > s + 1, mehrN = ne > so + 1, max = Math.max(ne, so, s) || 1;
    var satz = mehrB || mehrN
      ? 'Im Monat möglich: ' + (mehrB ? eur(so) + ' mit den Mieterhöhungen im Bestand (plus ' + eur(so - s) + ')' : '') + (mehrB && mehrN ? ', ' : '') + (mehrN ? eur(ne) + ' bei Neuvermietung' : '') + '.'
      : 'Keine Wohnung hat heute Spielraum. Mehr ist nur über eine Modernisierung möglich (§ 559 BGB).';
    return '<div class="card dp-md-k">' + kopf('euro', 'Miete heute und Spielraum')
      + '<div class="reihe"><div class="zahl"><small>Kaltmiete</small><b>' + eur(s) + '</b><small>im Monat, ' + eur(s * 12) + ' im Jahr</small></div>'
      + '<div class="zahl"><small>im Schnitt</small><b>' + (fl > 0 ? qm(s / fl) : '–') + '</b><small>aus ' + D.W.length + ' Wohnungen</small></div>'
      + (mehrB || mehrN ? '<div class="zahl"><small>maximal</small><b class="gr">' + eur(Math.max(so, ne)) + '</b><small>plus ' + eur(Math.max(so, ne) - s) + ' im Monat</small></div>' : '') + '</div>'
      + '<div class="satz" style="margin:8px 0 0">' + satz + '</div>'
      + (mehrB || mehrN ? '<div class="balken"><span style="width:' + (s / max * 100).toFixed(1) + '%;background:#2A2727"></span>' + (mehrB ? '<span style="width:' + ((so - s) / max * 100).toFixed(1) + '%;background:#3FA56C"></span>' : '') + (mehrN ? '<span style="width:' + ((ne - so) / max * 100).toFixed(1) + '%;background:var(--wl-c9a84c,#C9A84C)"></span>' : '') + '</div>'
        + '<div class="leg"><span><i style="background:#2A2727"></i>heute</span>' + (mehrB ? '<span><i style="background:#3FA56C"></i>Mieterhöhung im Bestand</span>' : '') + (mehrN ? '<span><i style="background:var(--wl-c9a84c,#C9A84C)"></i>mehr bei Neuvermietung</span>' : '') + '</div>' : '')
      + wie() + '</div>';
  }
  var WORT = { pot: 'POTENZIAL', aus: 'AUSGEREIZT', ueb: 'ÜBER MIETSPIEGEL', leer: 'LEER' };
  function karteWohnung(D) {   /* Eigentumswohnung, Haus ohne Wohnungsliste: Heute, Spielraum und Regeln in EINER Karte */
    var w = D.W[0];
    return '<div class="card dp-md-k">' + kopf('euro', 'Miete heute und Spielraum')
      + '<div class="reihe"><div class="zahl"><small>Kaltmiete</small><b>' + (w.ist ? eur(w.ist) : 'leer') + '</b><small>' + (w.ist ? 'im Monat, ' + eur(w.ist * 12) + ' im Jahr' : '') + '</small></div>'
      + '<div class="zahl"><small>heute</small><b>' + (w.istQ ? qm(w.istQ) : '–') + '</b><small>' + Math.round(w.wfl) + ' m²</small></div>'
      + '<div class="zahl" title="' + esc(vglTitel()) + '"><small>Vergleichsmiete</small><b>' + (w.vgl ? 'bis ' + qm(w.vgl) : '–') + '</b><small>oberer Wert der Spanne</small></div></div>'
      + stand(w) + leiter(w) + zahlen(w)
      + (viviKnopf(w, false) || nkKnopf(w, false) ? '<div class="knoepfe">' + viviKnopf(w, false) + nkKnopf(w, false) + '</div>' : '')
      + wie() + regelnHtml(D)
      + '<details class="dp-md-auf" data-md-platz="mv"><summary>Mietvertrag und Mieterhöhungen</summary></details></div>';
  }
  function karteZiel(D) {
    var s = D.W.reduce(function (a, w) { return a + w.ist; }, 0), sb = D.W.reduce(function (a, w) { return a + w.soll; }, 0);
    var z = D.W.reduce(function (a, w) { return a + Math.max(w.ziel || 0, w.soll, w.neuMehr ? w.neuM : 0); }, 0), ko = D.W.reduce(function (a, w) { return a + w.kosten; }, 0);
    var auf = D.mfh ? '<div class="knoepfe"><button type="button" class="btn btn-outline btn-sm" data-md-einh="1">Zielmiete je Wohnung festlegen</button></div><details class="dp-md-auf" data-md-platz="zb"><summary>Mietspiegel, eigene Werte und Merkmale</summary></details>'
      : '<details class="dp-md-auf" data-md-platz="zb"><summary>Zielbild bearbeiten</summary></details>';
    if (z <= s + 1 && !(ko > 0)) return '<div class="card dp-md-k">' + kopf('target', 'Zielbild') + '<div class="satz" style="margin:0 0 6px">' + eur(s) + ' im Monat, wie heute. Ohne Modernisierung gibt es keinen Spielraum.</div>' + auf + '</div>';
    var z4 = ['<div class="zahl"><small>heute</small><b>' + eur(s) + '</b><small>im Monat</small></div>'];
    if (sb > s + 1) z4.push('<div class="zahl"><small>im Bestand möglich</small><b class="gr">' + eur(sb) + '</b><small>plus ' + eur(sb - s) + ', Mieterhöhung</small></div>');
    if (z > Math.max(sb, s) + 1) z4.push('<div class="zahl"><small>Zielbild</small><b class="go">' + eur(z) + '</b><small>plus ' + eur(z - Math.max(sb, s)) + (D.W.some(function (w) { return w.ziel > 0; }) ? ', mit deiner Zielmiete' : ', Neuvermietung') + '</small></div>');
    if (ko > 0) z4.push('<div class="zahl"><small>Maßnahmen</small><b>' + eur(ko) + '</b><small>Kosten</small></div>');
    return '<div class="card dp-md-k">' + kopf('target', 'Zielbild') + '<div class="reihe">' + z4.join('') + '</div>' + auf + '</div>';
  }

  function geschoss(t) {   /* v3880c · Rang und Name eines Geschosses aus freiem Text, null wenn nicht erkennbar */
    var x = String(t || '').toLowerCase();
    if (/\b(dg|dachgeschoss|dach|spitzboden|penthouse)\b/.test(x)) return { r: 100, name: 'DG' };
    var m = /(\d+)\s*\.?\s*(og|obergeschoss|etage|stock)/.exec(x) || /(og|obergeschoss)\s*(\d+)/.exec(x);
    if (m) { var n = parseInt(m[1], 10) || parseInt(m[2], 10) || 1; return { r: n, name: n + '. OG' }; }
    if (/\b(og|obergeschoss)\b/.test(x)) return { r: 1, name: 'OG' };
    if (/\b(eg|erdgeschoss|hochparterre|parterre)\b/.test(x)) return { r: 0, name: 'EG' };
    if (/\b(ug|kg|untergeschoss|kellergeschoss|souterrain|keller)\b/.test(x)) return { r: -1, name: 'UG' };
    return null;
  }
  function karteHaus(D) {
    if (_sel >= D.W.length) _sel = 0;
    /* v3880c · Marcel: „4 Wohnungen im EG, 3 im OG, 1 im DG, skaliert die Ansicht mit?" Bis hier nicht: feste 2er/3er-Reihen.
       Jetzt eine Reihe je Geschoss (Feld Etage der Einheit, sonst aus der Lage gelesen), oben DG, unten Keller,
       jede Reihe so breit wie ihre Wohnungszahl (ab 5 bricht sie um). Ohne erkennbares Geschoss: Reihen zu dritt, unten. */
    var E = (window._dpMfh && Array.isArray(window._dpMfh.einheiten)) ? window._dpMfh.einheiten : [];
    var gruppen = {}, ohne = [];
    D.W.forEach(function (x) {
      var e = E[x.i] || {}, t = String(e.etage || '') + ' ' + String(x.lage || ''), g = geschoss(t);
      if (g == null) ohne.push(x); else { (gruppen[g.r] = gruppen[g.r] || { r: g.r, name: g.name, L: [] }).L.push(x); }
    });
    var rows = Object.keys(gruppen).map(function (k) { return gruppen[k]; }).sort(function (a, b) { return b.r - a.r; });
    for (var i = 0; i < ohne.length; i += 3) rows.push({ r: -99, name: '', L: ohne.slice(i, i + 3) });
    var w = D.W[_sel];
    return '<div class="card dp-md-k">' + kopf('building', 'Das Haus', D.W.length + ' Wohnungen') + '<div class="satz">Jede Kachel ist eine Wohnung. Die Farbe zeigt den Spielraum der Miete. Klick wählt die Wohnung.</div>'
      + '<div class="haus"><div class="dach"></div>' + rows.map(function (r) {
        var sp = Math.min(4, r.L.length);
        return '<div class="etage-z"><span class="etage-n">' + esc(r.name) + '</span><div class="etage" style="grid-template-columns:repeat(' + sp + ',minmax(0,1fr))">' + r.L.map(function (x) {
          var j = D.W.indexOf(x);
          return '<button type="button" class="whg s-' + x.st + (j === _sel ? ' sel' : '') + '" data-md-sel="' + j + '"><span class="st">' + WORT[x.st] + '</span><div class="n">Wohnung ' + esc(x.nr) + '</div><div class="m">' + (x.ist ? eur(x.ist) : 'leer') + '</div><div class="q">' + (x.istQ ? qm(x.istQ) + ', ' : '') + Math.round(x.wfl) + ' m²</div></button>';
        }).join('') + '</div></div>';
      }).join('') + '<div class="boden"></div></div>'
      + '<div class="leg" style="margin-top:8px"><span><i style="background:#3FA56C"></i>Potenzial</span><span><i style="background:var(--wl-c9a84c,#C9A84C)"></i>ausgereizt</span><span><i style="background:#B8625C"></i>über dem Mietspiegel</span><span><i style="background:#C9C2B4"></i>leer</span></div>'
      + '<div style="border-top:1px solid #F1ECE1;margin-top:12px;padding-top:10px"><div class="lbl">Gewählte Wohnung</div><h3 style="margin-top:2px">Wohnung ' + esc(w.nr) + (w.lage ? ', ' + esc(w.lage) : '') + '</h3>'
      + '<div class="satz" style="margin:0 0 6px">' + Math.round(w.wfl) + ' m², heute ' + (w.ist ? eur(w.ist) + ' im Monat, ' + qm(w.istQ) : 'leer') + (w.vgl ? ', Vergleichsmiete bis ' + qm(w.vgl) : '') + '.</div>'
      + stand(w) + leiter(w) + zahlen(w)
      + '<div class="knoepfe">' + viviKnopf(w, true) + nkKnopf(w, true) + '<button type="button" class="btn btn-outline btn-sm" data-md-whg="' + w.i + '">Wohnung öffnen, Vertrag und Erhöhung</button><button type="button" class="btn btn-outline btn-sm" data-md-jahre="1">Miete je Wohnung: heute, geplant, Ziel</button></div></div>'
      + regelnHtml(D, w) + '<details class="dp-md-auf" data-md-platz="mv"><summary>Mietverträge der Wohnungen</summary></details></div>';   /* v4005 · Karte Mietvertrag beim MFH */
  }
  /* ── echte Karten umhängen und zurückstellen ─────────────────────── */
  var KARTEN = { mv: 'mv-objekt-karte', mr: 'dp-mietrecht-karte', zb: 'zb-karte' };
  function merken(k) {
    var c = el(KARTEN[k]); if (!c || _platz[k]) return c;
    var mk = document.createComment('dp-md-platz-' + k); c.parentNode.insertBefore(mk, c); _platz[k] = mk; return c;
  }
  function zurueck() {
    Object.keys(_platz).forEach(function (k) { var c = el(KARTEN[k]), mk = _platz[k]; if (c && mk && mk.parentNode) mk.parentNode.insertBefore(c, mk); if (mk && mk.parentNode) mk.parentNode.removeChild(mk); if (c) c.style.display = ''; });
    _platz = {};
  }

  function schalter() {
    /* v4005 · der Umschalter „neu | bisher“ ist weg; ein schon gezeichneter (alter Stand im Tab) wird entfernt */
    var alt = el('dp-md-schalter'); if (alt && alt.parentNode) alt.parentNode.removeChild(alt);
  }
  function zeichnen() {
    if (!erlaubt()) return;
    stil(); schalter();
    var box = el('dp-md');
    if (!aktiv()) { zurueck(); if (box) box.parentNode.removeChild(box); return; }
    var D = daten(), mv = merken('mv'), mr = merken('mr'), zb = merken('zb');
    if (!D || !mv) { zurueck(); if (box) box.parentNode.removeChild(box); return; }
    if (!box) { box = document.createElement('div'); box.id = 'dp-md'; }
    /* v3942 · URSACHE „linke Hälfte leer“ (Stichbild 07-0.6, gemessen Staging 21.11.2026 an Sachsenstraße 18):
       der Block stand an der Stelle der Karte Mietvertrag, also in der RECHTEN Spalte von #s2 .col2. Seine vier
       Karten (1.792 px) kamen zu Mietentwicklung und Prognose dazu: rechts endete die Spalte bei 2.501 px, links
       (Mietstruktur, Mietpreis-Analyse) bei 1.000 px - 1.500 px leere linke Hälfte beim Scrollen. Jetzt steht der
       Block in voller Breite direkt hinter .col2; die Spalten enden bei 1.000 / 695 px. Ohne .col2 wie bisher. */
    var c2 = (_platz.mv && _platz.mv.parentNode && _platz.mv.parentNode.closest) ? _platz.mv.parentNode.closest('.col2') : null;
    if (c2 && c2.parentNode) { if (box.parentNode !== c2.parentNode || box.previousElementSibling !== c2) c2.parentNode.insertBefore(box, c2.nextSibling); }
    else if (box.parentNode !== mv.parentNode && _platz.mv) _platz.mv.parentNode.insertBefore(box, _platz.mv);
    var aufMr = box.querySelector('[data-md-platz="mr"]'), aufZb = box.querySelector('[data-md-platz="zb"]'), aufMv = box.querySelector('[data-md-platz="mv"]');
    var offenMr = aufMr ? aufMr.open : false, offenZb = aufZb ? aufZb.open : false, offenMv = aufMv ? aufMv.open : false;
    /* echte Karten vor dem Neuzeichnen in Sicherheit bringen, sonst löscht innerHTML sie */
    [mv, mr, zb].forEach(function (c) { if (c && box.contains(c)) document.body.appendChild(c); if (c) c.style.display = 'none'; });
    box.innerHTML = (D.mfh ? karteHeute(D) + karteHaus(D) : karteWohnung(D)) + karteZiel(D);   /* v4060 · „Was hier gilt“ steckt eingeklappt in der ersten Karte */
    var setze = function (key, c, offen) { var h = box.querySelector('[data-md-platz="' + key + '"]'); if (h && c) { h.appendChild(c); c.style.display = ''; if (offen != null) h.open = h.open || offen; } };
    setze('mv', mv, offenMv);   /* v4060 · auch bei der ETW eingeklappt, Zustand bleibt beim Neuzeichnen */   /* v4005 · auch beim MFH, dort eingeklappt in „Das Haus“ */
    setze('mr', mr, offenMr);
    setze('zb', zb, offenZb);
    /* v4060 · „Weitere Angaben“ im Mietvertrag: von selbst offen, sobald dort etwas steht */
    try { var mw = document.querySelector('#mv-objekt-karte .mv-weitere'); if (mw && !mw.open && ['mv_befristet_bis', 'mv_kuendigungsverzicht_bis', 'mv_abw_jahre'].some(function (id) { var f = el(id); return f && String(f.value || '').trim(); })) mw.open = true; } catch (eMw) {}   /* v3880b · auch beim MFH: die Karte trägt Mietspiegel-Felder und Merkmale */
    /* beim MFH bleiben Mietvertrag-Liste und Zielbild-Karte unsichtbar: beides steht je Wohnung in den Einheiten */
    /* v4005 · bis v4004 blieb die Karte Mietvertrag beim MFH unsichtbar an ihrem Platz, jetzt hängt sie in „Das Haus“ (oben) */
    if (!box._bind) {
      box._bind = true;
      box.addEventListener('click', function (ev) {
        var vv = ev.target.closest('[data-md-vivi]');   /* v4037 */
        var vn = ev.target.closest && ev.target.closest('[data-md-nk]');   /* v4042 */
        if (vn) { ev.preventDefault(); var ne = vn.getAttribute('data-md-nk'); try { window.DpViviNkAnpassung.oeffnen({ einheit: ne === 'objekt' ? null : ne, quelle: 'Reiter Miete' }); } catch (e) {} return; }
        if (vv) { ev.preventDefault(); var ve = vv.getAttribute('data-md-vivi'); try { window.DpViviMieterhoehung.oeffnen({ einheit: ve === 'objekt' ? null : ve, quelle: 'Reiter Miete' }); } catch (e) {} return; }
        var t = ev.target.closest('[data-md-sel],[data-md-whg],[data-md-jahre],[data-md-einh]'); if (!t) return;
        var M = window.DpMfhEinheiten;
        if (t.hasAttribute('data-md-sel')) { _sel = +t.getAttribute('data-md-sel'); zeichnen(); return; }
        if (t.hasAttribute('data-md-whg') && M) { try { M.einheitOeffnen(+t.getAttribute('data-md-whg')); } catch (e) {} return; }
        if (t.hasAttribute('data-md-jahre') && M && M.jahreOeffnen) { try { M.jahreOeffnen(); } catch (e) {} return; }
        if (t.hasAttribute('data-md-einh') && M) { try { M.oeffnen(1); } catch (e) {} }
      });
    }
  }
  var _t = null;
  function spaeter(ms) { clearTimeout(_t); _t = setTimeout(function () { try { zeichnen(); } catch (e) { try { console.warn('[miete-demo]', e); } catch (x) {} } }, ms || 400); }
  window.addEventListener('dp:object-ready', function () { _sel = 0; spaeter(1500); });
  window.addEventListener('dp:jahre-geaendert', function () { spaeter(300); });
  /* v4036 · Demo-Durchlauf 23.11.2026: nach „Jetzt abgleichen“ setzte ViVi die Miete auf 620 €, das Zielbild zeigte weiter
     „heute 570 €“. vivi-felder setzt per input, hier hörte nur change. dp:vivi-stand kommt nach jeder ViVi-Übernahme. */
  window.addEventListener('dp:vivi-stand', function () { spaeter(600); });
  document.addEventListener('change', function (e) { if (aktiv() && e.target && e.target.closest && e.target.closest('#s2')) spaeter(600); });
  document.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('#mfh-ok, #mfh-zu, [onclick*="switchTab(2)"], [data-tab="s2"]')) spaeter(900); });
  window.DpMieteDemo = { zeichnen: zeichnen, aktiv: aktiv, daten: daten, geschoss: geschoss };   /* v4040 · geschoss für den Reiter ViVi */
})();
