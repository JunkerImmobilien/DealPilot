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
(function () {
  'use strict';
  if (window.DpMieteDemo) return;
  var KEY = 'dp_miete_demo';
  function aktiv() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function erlaubt() { return /staging|localhost|127\.0\.0\.1/.test(location.hostname); }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return Math.round(x).toLocaleString('de-DE') + ' €'; }
  function qm(x) { return (Math.round(x * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/m²'; }
  var _sel = 0, _platz = {};

  function stil() {
    if (el('dp-md-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-md-stil';
    s.textContent = [
      '.dp-md-schalter{display:inline-flex;border:1px solid #E6E0D3;border-radius:999px;overflow:hidden;margin:0 0 12px;background:#fff}',
      '.dp-md-schalter button{border:0;background:transparent;padding:7px 14px;font:500 12.5px Inter,sans-serif;color:#6B6356;cursor:pointer;min-height:34px}',
      '.dp-md-schalter button.an{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#1a1712;font-weight:600}',
      '.dp-md-schalter span{align-self:center;padding:0 12px;font:500 10px "JetBrains Mono",monospace;letter-spacing:.08em;color:#8A8272;text-transform:uppercase}',
      '#dp-md{min-width:0;max-width:100%;box-sizing:border-box}#dp-md *{box-sizing:border-box}',
      '#dp-md .dp-md-k{min-width:0;overflow:hidden;background:#fff;border:1px solid #E6E0D3;border-radius:14px;padding:14px 16px;margin:0 0 14px}',
      '#dp-md h3{margin:0 0 4px;font:600 15px "Space Grotesk",sans-serif;color:#2A2727;display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '#dp-md .lbl{font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370}',
      '#dp-md .satz{color:#6B6356;font-size:12.5px;margin:2px 0 10px;line-height:1.45}',
      '#dp-md .reihe{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}',
      '#dp-md .zahl{background:#FBF6E9;border-radius:10px;padding:9px 11px}#dp-md .zahl b{display:block;font:600 17px "Space Grotesk",sans-serif;color:#2A2727}#dp-md .zahl small{color:#7A7370;font-size:11px}',
      '#dp-md .balken{display:flex;height:18px;border-radius:6px;overflow:hidden;margin:8px 0 4px}#dp-md .balken span{display:block}',
      '#dp-md .leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:#7A7370}#dp-md .leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}',
      '#dp-md .haus{display:grid;gap:6px;margin-top:8px}#dp-md .dach{height:26px;background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));clip-path:polygon(6% 100%,50% 0,94% 100%);opacity:.9}',
      '#dp-md .etage{display:grid;gap:6px}',
      '#dp-md .whg{display:block!important;width:100%;min-width:0;white-space:normal;height:auto;border-radius:10px;padding:8px 9px;border:1.5px solid #E6E0D3;background:#fff;cursor:pointer;text-align:left;font:inherit;color:#2A2727;min-height:78px;position:relative}',
      '#dp-md .whg.sel{outline:2px solid var(--wl-c9a84c,#C9A84C);outline-offset:1px}',
      '#dp-md .whg .n,#dp-md .whg .m,#dp-md .whg .q{display:block}#dp-md .whg .n{font:600 12px "Space Grotesk",sans-serif}#dp-md .whg .m{font:600 14.5px "Space Grotesk",sans-serif;margin-top:2px}#dp-md .whg .q{color:#7A7370;font-size:11px}',
      '#dp-md .whg .st{display:inline-block;font:600 9px "JetBrains Mono",monospace;letter-spacing:.04em;padding:2px 6px;border-radius:999px;margin-bottom:3px}',
      '#dp-md .s-pot{border-color:#9ED0B3}#dp-md .s-pot .st{background:#EAF5EE;color:#2f7d55}',
      '#dp-md .s-aus{border-color:#E3D3A4}#dp-md .s-aus .st{background:#F7F0DC;color:#8a6d1f}',
      '#dp-md .s-ueb{border-color:#DDB0AC}#dp-md .s-ueb .st{background:#F8EDEC;color:#B8625C}',
      '#dp-md .boden{height:7px;border-radius:4px;background:#E6E0D3}',
      '#dp-md .leiter{margin:8px 0 2px}#dp-md .bahn{position:relative;height:12px;border-radius:6px;background:#FBF6E9;border:1px solid #E6E0D3}',
      '#dp-md .bahn i{position:absolute;top:-3px;width:3px;height:16px;border-radius:2px}',
      '#dp-md .marken{display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:11px;color:#7A7370;margin-top:4px}',
      '#dp-md .grund{font-size:12px;color:#5E5850;line-height:1.45;border-left:3px solid #E6E0D3;padding:4px 0 4px 10px;margin:8px 0}',
      '#dp-md .knoepfe{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
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
  function daten() {
    var P = window.DpPotenzial; if (!P || !P.modell) return null;
    var m = null; try { m = P.modell(); } catch (e) { return null; }
    if (!m || !m.wohnungen || !m.wohnungen.length) return null;
    var fo = window.DpMieteRegel ? DpMieteRegel.faktorOhne() : 1.2;
    var W = m.wohnungen.map(function (w, j) {
      var d = {}; try { d = P.mietrechtDaten(m, j) || {}; } catch (e) {}
      var ist = Number(w.ist) || 0, wfl = Number(w.wfl) || 0, vgl = Number(d.vgl_qm || w.vgl_qm) || 0;
      var br = d.bremse && d.bremse.gilt === true;
      var neuQ = br && d.obergrenze ? Number(d.obergrenze) : (vgl > 0 ? vgl * fo : 0);
      var soll = w.soll && w.soll.miete != null && w.soll.miete >= ist + 1 ? Number(w.soll.miete) : ist;
      var istQ = wfl > 0 ? ist / wfl : 0;
      var st = (vgl > 0 && istQ > vgl + 0.005) ? 'ueb' : (soll - ist < 10 ? 'aus' : 'pot');
      var z = (d.zeilen || []).filter(function (r) { return r.k === 'Nächste Erhöhung'; })[0];
      return { i: w.i, nr: w.nr, lage: w.lage, wfl: wfl, ist: ist, istQ: istQ, vgl: vgl, soll: soll, neuQ: neuQ, neuM: Math.max(ist, neuQ * wfl), bremse: br, st: st,
        grund: z ? (z.v + '. ' + (z.u || '')) : '', ziel: Number(w.ziel) || 0, kosten: Number(w.kosten) || 0, status: w.status, ab: w.soll && w.soll.ab_text };
    });
    return { m: m, mfh: m.art === 'mfh', W: W };
  }

  function leiter(w) {
    var a = Math.min(w.istQ || w.vgl, w.vgl || w.istQ) - 0.4, b = Math.max(w.neuQ, w.istQ) + 0.4;
    if (!(b > a)) return '';
    var p = function (x) { return ((x - a) / (b - a) * 100).toFixed(1) + '%'; };
    var sQ = w.wfl > 0 ? w.soll / w.wfl : w.istQ;
    return '<div class="leiter"><div class="bahn">'
      + (w.vgl > 0 ? '<i style="left:' + p(w.vgl) + ';background:#9ED0B3;width:2px" title="Vergleichsmiete bis"></i>' : '')
      + '<i style="left:' + p(w.istQ) + ';background:#2A2727" title="heute"></i><i style="left:' + p(sQ) + ';background:#3FA56C" title="Mieterhöhung"></i>'
      + (w.neuQ > 0 ? '<i style="left:' + p(w.neuQ) + ';background:var(--wl-c9a84c,#C9A84C)" title="Neuvermietung"></i>' : '') + '</div>'
      + '<div class="marken"><span>heute ' + qm(w.istQ) + '</span><span>Mieterhöhung ' + qm(sQ) + '</span>' + (w.neuQ > 0 ? '<span>Neuvermietung ' + qm(w.neuQ) + '</span>' : '') + '</div></div>';
  }
  function zweiZahlen(w) {
    return '<div class="reihe" style="margin-top:8px"><div class="zahl"><small>Mieterhöhung</small><b>' + (w.soll >= w.ist + 1 ? eur(w.soll) : 'kein Spielraum') + '</b><small>' + (w.soll >= w.ist + 1 ? '+' + eur(w.soll - w.ist) + ' im Monat' + (w.ab ? ', ' + esc(w.ab) : '') : (w.st === 'ueb' ? 'über dem Oberwert ' + qm(w.vgl) : 'am Oberwert')) + '</small></div>'
      + (w.neuQ > 0 ? '<div class="zahl"><small>Neuvermietung</small><b>' + eur(w.neuM) + '</b><small>' + qm(w.neuQ) + ', ' + (w.bremse ? '110 %, Mietpreisbremse' : (window.DpMieteRegel ? DpMieteRegel.pct() : 120) + ' %, ohne Bremse') + '</small></div>' : '') + '</div>';
  }

  /* ── Karten des Demo-Blocks ──────────────────────────────────────── */
  function karteHeute(D) {
    var s = D.W.reduce(function (a, w) { return a + w.ist; }, 0), so = D.W.reduce(function (a, w) { return a + w.soll; }, 0), ne = D.W.reduce(function (a, w) { return a + Math.max(w.soll, w.neuM); }, 0);
    var fl = D.W.reduce(function (a, w) { return a + w.wfl; }, 0), vgl = D.W.filter(function (w) { return w.vgl > 0; })[0];
    var max = Math.max(ne, so, s) || 1;
    return '<div class="dp-md-k"><h3>Miete heute und Spielraum</h3>'
      + '<div class="reihe"><div class="zahl"><small>Kaltmiete</small><b>' + eur(s) + '</b><small>im Monat' + (D.mfh ? ', aus ' + D.W.length + ' Wohnungen' : '') + '</small></div>'
      + '<div class="zahl"><small>Kaltmiete</small><b>' + eur(s * 12) + '</b><small>im Jahr</small></div>'
      + '<div class="zahl"><small>im Schnitt</small><b>' + (fl > 0 ? qm(s / fl) : '–') + '</b><small>' + (vgl ? 'Vergleichsmiete bis ' + qm(vgl.vgl) : 'ohne Vergleichsmiete') + '</small></div></div>'
      + '<div class="satz" style="margin-top:8px">Im Monat: heute ' + eur(s) + ', mit den möglichen Mieterhöhungen ' + eur(so) + ', bei Neuvermietung bis ' + eur(ne) + '.</div>'
      + '<div class="balken"><span style="width:' + (s / max * 100).toFixed(1) + '%;background:#2A2727"></span><span style="width:' + ((so - s) / max * 100).toFixed(1) + '%;background:#3FA56C"></span><span style="width:' + ((ne - so) / max * 100).toFixed(1) + '%;background:var(--wl-c9a84c,#C9A84C)"></span></div>'
      + '<div class="leg"><span><i style="background:#2A2727"></i>heute</span><span><i style="background:#3FA56C"></i>Mieterhöhung im Bestand</span><span><i style="background:var(--wl-c9a84c,#C9A84C)"></i>mehr bei Neuvermietung</span></div></div>';
  }
  var WORT = { pot: 'POTENZIAL', aus: 'AUSGEREIZT', ueb: 'ÜBER MIETSPIEGEL' };
  function karteHaus(D) {
    if (_sel >= D.W.length) _sel = 0;
    var n = D.W.length, sp = n <= 2 ? n : (n % 3 === 0 ? 3 : 2), rows = [];
    for (var i = 0; i < n; i += sp) rows.push(D.W.slice(i, i + sp));
    rows.reverse();
    var w = D.W[_sel];
    return '<div class="dp-md-k"><h3>Das Haus</h3><div class="satz">Jede Kachel ist eine Wohnung. Die Farbe zeigt den Spielraum der Miete. Klick wählt die Wohnung.</div>'
      + '<div class="haus"><div class="dach"></div>' + rows.map(function (r) {
        return '<div class="etage" style="grid-template-columns:repeat(' + sp + ',minmax(0,1fr))">' + r.map(function (x) {
          var j = D.W.indexOf(x);
          return '<button type="button" class="whg s-' + x.st + (j === _sel ? ' sel' : '') + '" data-md-sel="' + j + '"><span class="st">' + WORT[x.st] + '</span><div class="n">Wohnung ' + esc(x.nr) + '</div><div class="m">' + (x.ist ? eur(x.ist) : 'leer') + '</div><div class="q">' + (x.istQ ? qm(x.istQ) + ', ' : '') + Math.round(x.wfl) + ' m²</div></button>';
        }).join('') + '</div>';
      }).join('') + '<div class="boden"></div></div>'
      + '<div class="leg" style="margin-top:8px"><span><i style="background:#3FA56C"></i>Potenzial</span><span><i style="background:var(--wl-c9a84c,#C9A84C)"></i>ausgereizt</span><span><i style="background:#B8625C"></i>über dem Mietspiegel</span></div>'
      + '<div style="border-top:1px solid #F1ECE1;margin-top:12px;padding-top:10px"><div class="lbl">Gewählte Wohnung</div><h3 style="margin-top:2px">Wohnung ' + esc(w.nr) + (w.lage ? ', ' + esc(w.lage) : '') + '</h3>'
      + '<div class="satz">' + Math.round(w.wfl) + ' m², heute ' + (w.ist ? eur(w.ist) + ' im Monat' : 'leer') + '.</div>'
      + leiter(w) + zweiZahlen(w) + (w.grund ? '<div class="grund">' + esc(w.grund) + '</div>' : '')
      + '<div class="knoepfe"><button type="button" class="btn btn-outline btn-sm" data-md-whg="' + w.i + '">Wohnung öffnen, Vertrag und Erhöhung</button><button type="button" class="btn btn-outline btn-sm" data-md-jahre="1">Miete je Wohnung: heute, geplant, Ziel</button></div></div></div>';
  }
  function karteWohnung(D) {
    var w = D.W[0];
    return '<div class="dp-md-k"><h3>Die Wohnung</h3><div class="satz">' + Math.round(w.wfl) + ' m², heute ' + (w.ist ? eur(w.ist) + ' im Monat' : 'leer') + '. Wo die Miete steht und wie weit sie steigen darf.</div>'
      + leiter(w) + zweiZahlen(w) + (w.grund ? '<div class="grund">' + esc(w.grund) + '</div>' : '')
      + '<details class="dp-md-auf" open data-md-platz="mv"><summary>Mietvertrag und Mieterhöhung</summary></details></div>';
  }
  function karteRegeln(D) {
    var m = D.m, k = m.kappung || {}, v = m.vgl || {}, w = D.W[0], br = w && w.bremse;
    return '<div class="dp-md-k"><h3>Was hier gilt</h3>'
      + '<div class="regel"><span class="lbl">Kappung</span><div><b>' + (k.pct || 20) + ' % in 3 Jahren</b><p>' + (k.herkunft === 'verordnung' ? 'Die Gemeinde steht in der Verordnung.' : 'Gesetzlich nach § 558 Abs. 3 BGB.') + '</p></div></div>'
      + '<div class="regel"><span class="lbl">Vergleichsmiete</span><div><b>bis ' + (v.qm ? qm(v.qm) : '–') + '</b><p>' + esc(v.ms && v.ms.wahl_text ? (v.qualifiziert ? 'qualifizierter' : 'einfacher') + ' Mietspiegel, ' + v.ms.wahl_text : (v.art || '')) + (D.mfh ? '. Je Wohnung nach ihrer Größe.' : '.') + '</p></div></div>'
      + '<div class="regel"><span class="lbl">Neuvermietung</span><div><b>' + (br ? 'Mietpreisbremse, höchstens 110 %' : 'ohne Bremse, DealPilot rechnet mit ' + (window.DpMieteRegel ? DpMieteRegel.pct() : 120) + ' %') + '</b></div></div>'
      + '<details class="dp-md-auf" data-md-platz="mr"><summary>Langfassung mit Quellen</summary></details></div>';
  }
  function karteZiel(D) {
    var s = D.W.reduce(function (a, w) { return a + w.ist; }, 0), z = D.W.reduce(function (a, w) { return a + (w.ziel || w.soll); }, 0), ko = D.W.reduce(function (a, w) { return a + w.kosten; }, 0);
    return '<div class="dp-md-k"><h3>Zielbild</h3>'
      + '<div class="reihe"><div class="zahl"><small>heute</small><b>' + eur(s) + '</b></div><div class="zahl"><small>Zielbild</small><b>' + eur(z) + '</b><small>im Monat</small></div><div class="zahl"><small>Maßnahmen</small><b>' + eur(ko) + '</b></div></div>'
      + (D.mfh ? '<div class="satz" style="margin-top:8px">Zielmiete, Zeitpunkt und Maßnahmen legst du je Wohnung fest.</div><div class="knoepfe"><button type="button" class="btn btn-outline btn-sm" data-md-einh="1">In den Einheiten ändern</button></div>'
        : '<details class="dp-md-auf" data-md-platz="zb"><summary>Zielbild bearbeiten</summary></details>') + '</div>';
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
    var sec = el('s2'); if (!sec || !erlaubt()) return;
    var b = el('dp-md-schalter');
    if (!b) {
      b = document.createElement('div'); b.id = 'dp-md-schalter'; b.className = 'dp-md-schalter';
      b.innerHTML = '<span>Ansicht</span><button type="button" data-md-an="0">heute</button><button type="button" data-md-an="1">neu (Demo)</button>';
      var d = sec.querySelector('.sec-desc'); if (d && d.nextSibling) sec.insertBefore(b, d.nextSibling); else sec.insertBefore(b, sec.firstChild);
      b.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-md-an]'); if (!t) return;
        try { localStorage.setItem(KEY, t.getAttribute('data-md-an')); } catch (e) {}
        zeichnen();
      });
    }
    b.querySelectorAll('[data-md-an]').forEach(function (x) { x.classList.toggle('an', x.getAttribute('data-md-an') === (aktiv() ? '1' : '0')); });
  }

  function zeichnen() {
    if (!erlaubt()) return;
    stil(); schalter();
    var box = el('dp-md');
    if (!aktiv()) { zurueck(); if (box) box.parentNode.removeChild(box); return; }
    var D = daten(), mv = merken('mv'), mr = merken('mr'), zb = merken('zb');
    if (!D || !mv) { zurueck(); if (box) box.parentNode.removeChild(box); return; }
    if (!box) { box = document.createElement('div'); box.id = 'dp-md'; }
    if (box.parentNode !== mv.parentNode && _platz.mv) _platz.mv.parentNode.insertBefore(box, _platz.mv);
    var aufMr = box.querySelector('[data-md-platz="mr"]'), aufZb = box.querySelector('[data-md-platz="zb"]');
    var offenMr = aufMr ? aufMr.open : false, offenZb = aufZb ? aufZb.open : false;
    /* echte Karten vor dem Neuzeichnen in Sicherheit bringen, sonst löscht innerHTML sie */
    [mv, mr, zb].forEach(function (c) { if (c && box.contains(c)) document.body.appendChild(c); if (c) c.style.display = 'none'; });
    box.innerHTML = '<div class="demo-hin">Demo des neuen Reiters, nur auf Staging. Rechnet mit den echten Werten dieses Objekts. Pilot-Mietpreis-Analyse, Mietstruktur und Mietpreis-Analyse bleiben wie heute.</div>'
      + karteHeute(D) + (D.mfh ? karteHaus(D) : karteWohnung(D)) + karteRegeln(D) + karteZiel(D);
    var setze = function (key, c, offen) { var h = box.querySelector('[data-md-platz="' + key + '"]'); if (h && c) { h.appendChild(c); c.style.display = ''; if (offen != null) h.open = h.open || offen; } };
    if (!D.mfh) setze('mv', mv, null);
    setze('mr', mr, offenMr);
    if (!D.mfh) setze('zb', zb, offenZb);
    /* beim MFH bleiben Mietvertrag-Liste und Zielbild-Karte unsichtbar: beides steht je Wohnung in den Einheiten */
    if (D.mfh) { [mv, zb].forEach(function (c) { if (c && c.parentNode === document.body && _platz[c === mv ? 'mv' : 'zb']) { var mk = _platz[c === mv ? 'mv' : 'zb']; mk.parentNode.insertBefore(c, mk); c.style.display = 'none'; } }); }
    if (!box._bind) {
      box._bind = true;
      box.addEventListener('click', function (ev) {
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
  document.addEventListener('change', function (e) { if (aktiv() && e.target && e.target.closest && e.target.closest('#s2')) spaeter(600); });
  document.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('#mfh-ok, #mfh-zu, [onclick*="switchTab(2)"], [data-tab="s2"]')) spaeter(900); });
  window.DpMieteDemo = { zeichnen: zeichnen, aktiv: aktiv, daten: daten };
})();
