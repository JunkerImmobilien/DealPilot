'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V36 — KI-Lage-Bewertung (Makro + Mikro)
   Ruft den Backend-Endpoint /api/v1/ai/lage auf.
═══════════════════════════════════════════════════════════════ */

/* ══ v2175 · ERST MESSEN, DANN DIE KI — UND BEIDES IM VERGLEICH ═══════════
   Marcel am 13.10.2026: „Macht im Tab Objekt die ‚Lage analysieren' noch
   Sinn? ... koennen wir das mit unseren vorhandenen Daten ... besser? Oder
   vielleicht auch beides und im Vergleich?"
   GEMESSEN vorher: reine KI mit Websuche, Quellen ungeprueft, sechs Felder
   (die Box versprach acht). Jetzt holt /marktbericht/lage/gemessen vier
   Felder aus unseren Daten (Makro, Mikro, Bevoelkerung, Nachfrage) in
   rund einer Sekunde - ohne KI, in jedem Tarif. Die KI laeuft daneben und
   liefert Texte, Wertsteigerung und Entwicklung. Beim Uebernehmen gewinnt
   die Messung; wo sie fehlt, die KI. */
var _LAGE_FELDER = [
  { id: 'makrolage',          t: 'Makrolage',             ki: 'makro' },
  { id: 'mikrolage',          t: 'Mikrolage',             ki: 'mikro' },
  { id: 'ds2_bevoelkerung',   t: 'Bevölkerung',           ki: 'bevoelkerung' },
  { id: 'ds2_nachfrage',      t: 'Nachfrage',             ki: 'nachfrage' },
  { id: 'ds2_wertsteigerung', t: 'Wertsteigerung',        ki: 'wertsteigerung' },
  { id: 'ds2_entwicklung',    t: 'Entwicklung',           ki: 'entwicklung' },
  /* v2518 · der Zensus-Leerstand gehoert zum Mietausfallrisiko (Marcel 20.10.2026) */
  { id: 'ds2_mietausfall',    t: 'Mietausfallrisiko',     ki: 'mietausfall' }
];
/* ══ v2515 · HERKUNFT JE LAGE-FELD ═══════════════════════════════════
   Gemessen am 20.10.2026 (Bestandsaufnahme): „Lage analysieren" fuellt die
   Lage-Felder - gemessen, wo es eine Messung gibt, sonst mit dem KI-Wert -
   und speicherte nicht, WOHER der Wert kam. Der Marktbericht zeigte dann
   jeden davon als „Ihre Angabe". Eine KI-Einschaetzung als eigene Angabe
   des Investors auszugeben, ist eine falsche Herkunft.

   Jetzt haelt das versteckte Feld #_lage_herkunft je Feld {art, wert}:
   art = gemessen | ki | eigen. Der WERT steht mit drin: aendert sich das
   Feld spaeter auf einem anderen Weg, passt der Wert nicht mehr und die
   Kennzeichnung verfaellt von selbst (der Bericht behauptet dann nichts).
   Eine Hand-Aenderung (echtes Nutzerereignis) markiert „eigen".
   Das Feld steht in storage.js FIELDS und resetFields (versteckte Felder
   erben sonst ins naechste Objekt). */
(function () {
  var IDS = ['makrolage', 'mikrolage', 'ds2_bevoelkerung', 'ds2_nachfrage',
             'ds2_wertsteigerung', 'ds2_entwicklung', 'ds2_mietausfall'];
  function feld() { return document.getElementById('_lage_herkunft'); }
  function lesen() {
    try { var e = feld(); var h = e && e.value ? JSON.parse(e.value) : {}; return (h && typeof h === 'object') ? h : {}; }
    catch (x) { return {}; }
  }
  function schreiben(h) { var e = feld(); if (e) e.value = Object.keys(h).length ? JSON.stringify(h) : ''; }
  function setze(id, art) {
    if (IDS.indexOf(id) < 0) return;
    var f = document.getElementById(id); if (!f) return;
    var h = lesen();
    if (f.value) h[id] = { art: art, wert: String(f.value) }; else delete h[id];
    schreiben(h);
  }
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || !ev.isTrusted || IDS.indexOf(t.id) < 0) return;
    setze(t.id, 'eigen');
  }, true);
  window.DpLageHerkunft = { setze: setze, lesen: lesen, IDS: IDS };
})();

function _lageOptText(id, val) {
  var el = document.getElementById(id);
  var o = el && val ? el.querySelector('option[value="' + val + '"]') : null;
  return o ? o.textContent.replace(/\s*\(.*\)\s*$/, '') : (val || '–');
}
function _lageMessen(str, hnr, plz, ort) {
  if (typeof Auth === 'undefined' || !Auth.apiCall) return Promise.resolve(null);
  var adr = [(str + ' ' + hnr).trim(), (plz + ' ' + ort).trim()].filter(Boolean).join(', ');
  return Auth.apiCall('/marktbericht/lage/gemessen?adresse=' + encodeURIComponent(adr)
    + '&plz=' + encodeURIComponent(plz) + '&ort=' + encodeURIComponent(ort)
    + '&objektart=' + encodeURIComponent(((document.getElementById('objart') || {}).value) || ''), { method: 'GET' })   /* v2518 */
    .then(function (r) { return (r && r.felder) ? r : null; })
    .catch(function () { return null; });
}
function _lageVergleichHtml(m, ki) {
  var f = (m && m.felder) || {};
  var zeilen = _LAGE_FELDER.map(function (x) {
    var g = f[x.id];
    var k = ki && ki[x.ki] && ki[x.ki].value ? ki[x.ki].value : null;
    var gTxt = g ? '<b>' + _escKi(_lageOptText(x.id, g.stufe)) + '</b><span class="lv-w">'
      + _escKi(String(g.wert).replace('.', ',') + ' ' + g.einheit) + '</span>' : '<span class="lv-leer">nicht gemessen</span>';
    var kTxt = ki ? (k ? _escKi(_lageOptText(x.id, k)) : '–') : '<span class="lv-leer">läuft …</span>';
    var urteil = (g && k) ? (g.stufe === k ? '<span class="lv-ok" title="Messung und KI stimmen überein">✓</span>'
      : '<span class="lv-ab" title="Messung und KI weichen ab — übernommen wird die Messung">≠</span>') : '';
    var tip = g ? (g.quelle + (g.stand ? ' · Stand ' + (typeof g.stand === 'object' ? JSON.stringify(g.stand).replace(/[{}"]/g, '') : g.stand) : '')
      + (g.zusatz ? ' · ' + g.zusatz : '') + '\nSchwelle (Modellannahme): ' + g.schwelle) : 'Für dieses Merkmal gibt es keine Messung — hier zählt die KI-Einschätzung.';
    return '<tr title="' + _escKi(tip) + '"><td>' + x.t + '</td><td>' + gTxt + '</td><td>' + kTxt + '</td><td class="lv-u">' + urteil + '</td></tr>';
  }).join('');
  return '<div class="ki-lage-vergleich">'
    + '<div class="lv-kopf">Gemessen aus unseren Daten · im Vergleich zur KI</div>'
    + '<table class="lv-tab"><thead><tr><th>Merkmal</th><th>Gemessen</th><th>KI</th><th></th></tr></thead><tbody>' + zeilen + '</tbody></table>'
    + '<div class="lv-fuss">Gemessen: Regionaldatenbank, Zensus 2022, Umfeld-Analyse — Quelle und Schwelle beim Darüberfahren. '
    + 'Beim Übernehmen gilt die Messung, wo es eine gibt.</div></div>';
}
function _lageCss() {
  if (document.getElementById('ki-lage-v2175-css')) return;
  var st = document.createElement('style'); st.id = 'ki-lage-v2175-css';
  st.textContent = '.ki-lage-vergleich{margin:0 0 14px;padding:12px 14px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:12px}'
    + '.lv-kopf{font:600 11px/1.4 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--wl-b8932f, #b8932f);margin-bottom:8px}'
    + '.lv-tab{width:100%;border-collapse:collapse;font-size:12.5px}.lv-tab th{text-align:left;font:500 10.5px/1.3 "JetBrains Mono",monospace;color:#8b8678;padding:4px 6px;border-bottom:1px solid rgba(140,134,120,.3)}'
    + '.lv-tab td{padding:6px;border-bottom:1px solid rgba(140,134,120,.15);vertical-align:top}.lv-tab tr{cursor:help}'
    + '.lv-w{display:block;font:400 11px/1.3 "JetBrains Mono",monospace;color:#8b8678}.lv-leer{color:#8b8678;font-style:italic}'
    + '.lv-u{text-align:center;width:28px;font-weight:700}.lv-ok{color:#3FA56C}.lv-ab{color:#B8625C}'
    + '.lv-fuss{margin-top:8px;font-size:11.5px;color:#8b8678}';
  document.head.appendChild(st);
}

/* ══ v3007 · ABGLEICH MIT DER WEBRECHERCHE — TABELLE, QUELLEN, AUSWAHL ════
   Marcel am 27.10.2026: nach „Entwicklung per Webrecherche ergaenzen" stand
   je Merkmal nur ein „≠" oder ein Haekchen. Gemessen vorher: die Spalte
   „jetzt" zeigte den FELDWERT, nicht die Messung - ≠ hiess also „Feld weicht
   von der Messung ab", und die Recherche schrieb Entwicklung/Wertsteigerung
   ungefragt ins Feld (auch ueber einen eigenen Wert). Die Quelle stand nur
   bei zwei Zeilen, und nur eine je Merkmal.

   Jetzt: je Merkmal Ermittelt (Marktbericht oder unsere Messung) neben der
   Recherche, eine Ampel (gleich / weicht ab / fehlt) und die freie Wahl, was
   ins Feld kommt: Ermittelt, Recherche oder ein eigener Wert. Geschrieben
   wird erst mit „Auswahl uebernehmen" - in dieselben Felder wie bisher, und
   die Herkunft geht wie seit v2515 nach #_lage_herkunft (gemessen/ki/eigen).
   Darunter die Fundstellen der Recherche, nummeriert und klickbar.
   Ein Portal-Link bleibt ein Link, heisst aber nach aussen nur
   „Aktueller Marktdurchschnitt" (CLAUDE.md, Anbieter-Neutralitaet). */
var _dpLageWahl = {};      /* key|feld -> {art, eigen} */
var _dpLageOffen = {};     /* key -> true/false (aufgeklappt) */
var _dpLageCtx = {};       /* key -> {zeilen, neu} fuer Auswahl und Neuzeichnen */
var _LV_PORTAL = /(immobilienscout|immoscout|scout24|immowelt|immonet|immoportal|wohnungsb(oe|ö)rse|homeday|meinestadt|miete-aktuell|mietspiegel\.(com|net|org)|wohnpreis|kleinanzeigen|ebay\.|ohne-makler|immopreise|wohnungsmarkt24|sprengnetter|pricehubble)/i;
function _lvAttr(s) { return _escKi(s).replace(/"/g, '&quot;'); }
function _lvNeutral(t) {
  return typeof window._dpOhnePortal === 'function' ? window._dpOhnePortal(t) : String(t == null ? '' : t);
}
function _lvHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
/* Fundstellen einer KI-Dimension: neu "sources", alt "source" */
function _lvQuellenVon(d) {
  if (!d) return [];
  var roh = Array.isArray(d.sources) && d.sources.length ? d.sources : (d.source ? [d.source] : []);
  return roh.map(function (q) {
    if (!q || typeof q !== 'object') return null;
    var url = /^https?:\/\//i.test(String(q.url || '')) ? String(q.url) : '';
    if (url && typeof window._urlSauber === 'function') url = window._urlSauber(url);
    var portal = !!q.portal || _LV_PORTAL.test(url) || _LV_PORTAL.test(String(q.label || ''));
    var text = portal ? 'Aktueller Marktdurchschnitt (Angebotsdaten)' : _lvNeutral(String(q.label || '').trim());
    if (!text) text = _lvHost(url) || 'Quelle';
    return (url || text) ? { url: url, text: text, host: portal ? '' : _lvHost(url) } : null;
  }).filter(Boolean);
}
/* ctx: {key, erm: {feld: {stufe, detail, tip}}, ki: Antwort von /ai/lage, kopf, fuss, neu()} */
function _lageAbgleichHtml(ctx) {
  _lageCss(); _lvCss();
  var key = ctx.key || '';
  var ki = ctx.ki || {};
  var quellen = [];                                   /* global nummeriert, entdoppelt */
  function nr(q) {
    var s = (q.url || q.text).toLowerCase();
    for (var i = 0; i < quellen.length; i++) if ((quellen[i].url || quellen[i].text).toLowerCase() === s) return i + 1;
    quellen.push(q); return quellen.length;
  }
  var zeilen = [], n = { gleich: 0, ab: 0, fehlt: 0 };
  _LAGE_FELDER.forEach(function (x) {
    var el = document.getElementById(x.id);
    if (!el) return;
    var g = (ctx.erm || {})[x.id] || null;
    var k = ki[x.ki] && ki[x.ki].value && el.querySelector('option[value="' + ki[x.ki].value + '"]') ? ki[x.ki] : null;
    if (!g && !k) return;
    var amp = (g && g.stufe && k) ? (g.stufe === k.value ? 'gleich' : 'ab') : 'fehlt';
    n[amp]++;
    var refs = k ? _lvQuellenVon(k).map(function (q) { return { n: nr(q), q: q }; }) : [];
    var jetzt = el.value || '';
    var w = _dpLageWahl[key + '|' + x.id];
    if (!w) {
      var art = (g && g.stufe && jetzt === g.stufe) ? 'erm' : (k && jetzt === k.value) ? 'ki'
        : jetzt ? 'eigen' : (g && g.stufe ? 'erm' : 'ki');
      w = _dpLageWahl[key + '|' + x.id] = { art: art, eigen: jetzt };
    }
    zeilen.push({ x: x, g: g, k: k, amp: amp, refs: refs, jetzt: jetzt, w: w, el: el });
  });
  _dpLageCtx[key] = { zeilen: zeilen, neu: ctx.neu };
  if (!zeilen.length) return '';
  var AMP = { gleich: ['gleich', 'Ermittelt und Recherche kommen zum selben Ergebnis'],
              ab: ['weicht ab', 'Ermittelt und Recherche kommen zu verschiedenen Stufen — wählen Sie, was gilt'],
              fehlt: ['fehlt', 'Für dieses Merkmal liegt nur eine Seite vor'] };
  var rows = zeilen.map(function (z) {
    var id = z.x.id, nm = 'lvw-' + id;
    var erm = z.g && z.g.stufe
      ? '<b>' + _escKi(_lageOptText(id, z.g.stufe)) + '</b>' + (z.g.detail ? '<span class="lv-w">' + _escKi(z.g.detail) + '</span>' : '')
      : '<span class="lv-leer">' + (z.g && z.g.detail ? _escKi(z.g.detail) : 'nicht ermittelt') + '</span>';
    var rec = z.k
      ? '<b>' + _escKi(_lageOptText(id, z.k.value)) + '</b>'
        + (z.refs.length ? ' ' + z.refs.map(function (r) {
            return r.q.url ? '<a class="lv-ref" href="' + _lvAttr(r.q.url) + '" target="_blank" rel="noopener noreferrer" title="' + _lvAttr(r.q.text) + '">[' + r.n + ']</a>'
              : '<span class="lv-ref" title="' + _lvAttr(r.q.text) + '">[' + r.n + ']</span>';
          }).join('') : '')
        + (z.k.text ? '<span class="lv-kt" title="' + _lvAttr(_lvNeutral(z.k.text)) + '">' + _escKi(_lvNeutral(z.k.text)) + '</span>' : '')
      : '<span class="lv-leer">nicht recherchiert</span>';
    function opt(art, label, an) {
      return '<label class="lv-o' + (an ? '' : ' lv-o-aus') + '"><input type="radio" name="' + nm + '" value="' + art + '"'
        + (z.w.art === art ? ' checked' : '') + (an ? '' : ' disabled')
        + ' onchange="_dpLageWahlSetzen(\'' + _lvAttr(ctx.key || '') + '\',\'' + id + '\',this.value)"> ' + label + '</label>';
    }
    var eigenOpts = Array.prototype.map.call(z.el.options, function (o) {
      return '<option value="' + _lvAttr(o.value) + '"' + (o.value === (z.w.eigen || '') ? ' selected' : '') + '>'
        + _escKi(o.value ? o.textContent.replace(/\s*\(.*\)\s*$/, '') : '— leer —') + '</option>';
    }).join('');
    var wahl = '<div class="lv-wahl">' + opt('erm', 'Ermittelt', !!(z.g && z.g.stufe)) + opt('ki', 'Recherche', !!z.k) + opt('eigen', 'Eigener', true) + '</div>'
      + (z.w.art === 'eigen' ? '<select class="lv-eigen" aria-label="Eigener Wert ' + _lvAttr(z.x.t) + '" onchange="_dpLageEigenSetzen(\'' + _lvAttr(ctx.key || '') + '\',\'' + id + '\',this.value)">' + eigenOpts + '</select>' : '');
    return '<tr class="lv-z lva-' + z.amp + '"' + (z.g && z.g.tip ? ' title="' + _lvAttr(z.g.tip) + '"' : '') + '>'
      + '<td data-l="Merkmal"><span class="lv-amp" title="' + _lvAttr(AMP[z.amp][1]) + '"><i></i>' + AMP[z.amp][0] + '</span><b class="lv-mm">' + _escKi(z.x.t) + '</b>'
      + '<span class="lv-w">im Feld: ' + _escKi(z.jetzt ? _lageOptText(id, z.jetzt) : '–') + '</span></td>'
      + '<td data-l="Ermittelt (DealPilot)">' + erm + '</td>'
      + '<td data-l="Webrecherche">' + rec + '</td>'
      + '<td data-l="Übernehmen">' + wahl + '</td></tr>';
  }).join('');
  var qHtml = quellen.length
    ? '<div class="lv-qk">Quellen der Webrecherche</div><ol class="lv-q">' + quellen.map(function (q) {
        return '<li>' + (q.url ? '<a href="' + _lvAttr(q.url) + '" target="_blank" rel="noopener noreferrer" title="' + _lvAttr(q.host ? q.url : q.text) + '">' + _escKi(q.text) + '</a>'
          + (q.host && q.host !== q.text ? ' <span class="lv-host">' + _escKi(q.host) + '</span>' : '') : _escKi(q.text) + ' <span class="lv-host">ohne Link</span>') + '</li>';
      }).join('') + '</ol>'
    : '<div class="lv-qk">Quellen der Webrecherche</div><div class="lv-fuss">Die Recherche hat keine Fundstellen genannt.</div>';
  var zus = [n.gleich ? n.gleich + ' gleich' : '', n.ab ? n.ab + (n.ab > 1 ? ' weichen ab' : ' weicht ab') : '', n.fehlt ? n.fehlt + (n.fehlt > 1 ? ' fehlen' : ' fehlt') + ' auf einer Seite' : ''].filter(Boolean).join(' · ');
  var offen = !!_dpLageOffen[key];
  return '<details class="lv-abgl"' + (offen ? ' open' : '') + ' ontoggle="_dpLageOffen[\'' + _lvAttr(key) + '\']=this.open">'
    + '<summary><span class="lv-sk">' + _escKi(ctx.kopf || 'Abgleich mit der Webrecherche') + '</span><span class="lv-sz">' + _escKi(zus) + '</span></summary>'
    + '<table class="lv-tab lv-tab4"><thead><tr><th>Merkmal</th><th>Ermittelt (DealPilot)</th><th>Webrecherche</th><th>Übernehmen</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="lv-akt"><button class="btn btn-gold btn-sm" type="button" onclick="_dpLageAuswahlUebernehmen(\'' + _lvAttr(key) + '\')">⤓ Auswahl übernehmen</button>'
    + '<span class="lv-fuss">' + _escKi(ctx.fuss || 'Ermittelt: Marktbericht bzw. Regionaldatenbank, Zensus 2022, Umfeld-Analyse — Quelle und Schwelle beim Darüberfahren.') + '</span></div>'
    + qHtml + '</details>';
}
function _dpLageWahlSetzen(key, id, art) {
  var w = _dpLageWahl[key + '|' + id] || (_dpLageWahl[key + '|' + id] = { art: art, eigen: '' });
  w.art = art;
  if (art === 'eigen' && !w.eigen) { var el = document.getElementById(id); w.eigen = el ? el.value : ''; }
  var c = _dpLageCtx[key]; if (c && typeof c.neu === 'function') c.neu();
}
function _dpLageEigenSetzen(key, id, v) {
  var w = _dpLageWahl[key + '|' + id] || (_dpLageWahl[key + '|' + id] = { art: 'eigen', eigen: '' });
  w.eigen = v;
}
function _dpLageAuswahlUebernehmen(key) {
  var c = _dpLageCtx[key]; if (!c) return;
  var HK = { erm: 'gemessen', ki: 'ki', eigen: 'eigen' }, geaendert = 0;
  c.zeilen.forEach(function (z) {
    var w = _dpLageWahl[key + '|' + z.x.id]; if (!w) return;
    var v = w.art === 'erm' ? (z.g && z.g.stufe) : w.art === 'ki' ? (z.k && z.k.value) : w.eigen;
    var el = document.getElementById(z.x.id); if (!el || v == null) return;
    if (v !== '' && !el.querySelector('option[value="' + v + '"]')) return;
    if (el.value !== v) { el.value = v; el.dispatchEvent(new Event('change')); geaendert++; }
    if (window.DpLageHerkunft) window.DpLageHerkunft.setze(z.x.id, HK[w.art]);   /* v2515: leerer Wert loescht die Herkunft */
    w.eigen = w.art === 'eigen' ? v : w.eigen;
  });
  if (typeof dpUpdateAll === 'function') dpUpdateAll();
  if (typeof toast === 'function') toast(geaendert ? '✓ ' + geaendert + (geaendert > 1 ? ' Lage-Felder' : ' Lage-Feld') + ' übernommen' : '✓ Auswahl entspricht schon den Feldern');
  if (typeof c.neu === 'function') c.neu();
}
window._dpLageWahlSetzen = _dpLageWahlSetzen;
window._dpLageEigenSetzen = _dpLageEigenSetzen;
window._dpLageAuswahlUebernehmen = _dpLageAuswahlUebernehmen;
window._dpLageOffen = _dpLageOffen;
/* Ermittelt aus der eigenen Messung (/lage/gemessen) */
function _lvErmAusMessung(m) {
  var f = (m && m.felder) || {}, out = {};
  Object.keys(f).forEach(function (id) {
    var g = f[id]; if (!g || !g.stufe) return;
    out[id] = { stufe: g.stufe, detail: (g.wert != null ? String(g.wert).replace('.', ',') + ' ' + (g.einheit || '') + ' · ' : '') + 'Regionaldaten',
      tip: (g.quelle || '') + (g.stand ? ' · Stand ' + (typeof g.stand === 'object' ? JSON.stringify(g.stand).replace(/[{}"]/g, '') : g.stand) : '')
        + (g.schwelle ? '\nSchwelle (Modellannahme): ' + g.schwelle : '') };
  });
  return out;
}
function _lvCss() {
  if (document.getElementById('ki-lage-v3007-css')) return;
  var G = 'var(--wl-c9a84c, #C9A84C)';
  var st = document.createElement('style'); st.id = 'ki-lage-v3007-css';
  st.textContent = ''
    + '.lv-abgl{margin:10px 0 0;border:1px solid color-mix(in srgb, ' + G + ' 35%, transparent);border-radius:12px;padding:0 12px}'
    + '.lv-abgl>summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;padding:10px 0}'
    + '.lv-abgl>summary::-webkit-details-marker{display:none}'
    + '.lv-abgl>summary::before{content:"▸";color:var(--wl-b8932f, #b8932f);font-size:11px}.lv-abgl[open]>summary::before{content:"▾"}'
    + '.lv-sk{font:600 11px/1.4 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-b8932f, #b8932f)}'
    + '.lv-sz{font-size:12px;color:#8b8678}'
    + '.lv-tab4 td{font-size:12.5px}.lv-tab4 tr{cursor:default}.lv-tab4 td:nth-child(4){min-width:200px}'
    + '.lv-mm{display:block}.lv-amp{display:inline-flex;align-items:center;gap:4px;font:500 10px/1.2 "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;color:#8b8678}'
    + '.lv-amp i{width:8px;height:8px;border-radius:50%;background:#8b8678;display:inline-block}'
    + '.lva-gleich .lv-amp{color:#3FA56C}.lva-gleich .lv-amp i{background:#3FA56C}'
    + '.lva-ab .lv-amp{color:#D8564C}.lva-ab .lv-amp i{background:#D8564C}'
    + '.lv-kt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:11.5px;line-height:1.35;color:#8b8678;margin-top:2px}'
    + '.lv-ref{font:500 10.5px/1 "JetBrains Mono",monospace;color:var(--wl-b8932f, #b8932f);text-decoration:none;margin-left:2px}a.lv-ref:hover{text-decoration:underline}'
    + '.lv-wahl{display:flex;flex-wrap:wrap;gap:2px 10px}.lv-o{display:inline-flex;align-items:center;gap:3px;font-size:12px;cursor:pointer;white-space:nowrap}'
    + '.lv-o input{margin:0;accent-color:' + G + '}.lv-o-aus{opacity:.4;cursor:not-allowed}'
    + '.lv-eigen{margin-top:4px;font-size:12px;padding:3px 6px;max-width:100%;border-radius:6px;border:1px solid rgba(140,134,120,.45);background:transparent;color:inherit}'
    + '.lv-eigen option{color:#1a1a1a;background:#fff}'
    + '.lv-akt{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:10px 0 4px}.lv-akt .lv-fuss{margin:0}'
    + '.lv-qk{margin-top:10px;font:600 10.5px/1.4 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#8b8678}'
    + '.lv-q{margin:4px 0 12px;padding-left:22px;font-size:12px;line-height:1.5}.lv-q a{color:var(--wl-b8932f, #b8932f);word-break:break-word}'
    + '.lv-host{font:400 10.5px/1.3 "JetBrains Mono",monospace;color:#8b8678;margin-left:4px}'
    + '@media (max-width:640px){'
    + '.lv-tab4 thead{display:none}.lv-tab4,.lv-tab4 tbody,.lv-tab4 tr,.lv-tab4 td{display:block;width:auto}'
    + '.lv-tab4 tr{border:1px solid rgba(140,134,120,.25);border-radius:10px;padding:6px 10px;margin:0 0 8px}'
    + '.lv-tab4 td{border:0;padding:4px 0}.lv-tab4 td:nth-child(4){min-width:0}'
    + '.lv-tab4 td:not(:first-child)::before{content:attr(data-l);display:block;font:500 10px/1.3 "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.05em;color:#8b8678}'
    + '}';
  document.head.appendChild(st);
}

function runKiLage(opts) {
  /* v2177: {ergaenzen:true} = ein Marktbericht hat die Lage schon gemessen;
     die KI ergaenzt nur, was er nicht misst. */
  var _erg = !!(opts && opts.ergaenzen);
  var btn = document.getElementById('ki-lage-btn');
  var body = document.getElementById('ki-lage-body');
  if (!body) return;

  // Adresse aus den Feldern bauen
  var str = (document.getElementById('str') || {}).value || '';
  var hnr = (document.getElementById('hnr') || {}).value || '';
  var plz = (document.getElementById('plz') || {}).value || '';
  var ort = (document.getElementById('ort') || {}).value || '';
  var adresse = [str + ' ' + hnr, plz + ' ' + ort].map(function(s) { return s.trim(); }).filter(Boolean).join(', ');
  if (!adresse) {
    body.innerHTML = '<div class="ki-lage-err">⚠ Bitte zuerst eine Adresse im Tab Objekt eintragen.</div>';
    return;
  }

  /* v2175: die Messung laeuft in JEDEM Tarif und zuerst - sie kostet keine KI. */
  _lageCss();
  window._lastLageMessung = null;
  window._lastKiLageData = null;
  var _kiFertig = false;
  var _ladeKi = '<div class="ki-lage-loading"><div class="ki-lage-spinner"></div>KI ergänzt Texte, Wertsteigerung und Entwicklung …</div>';
  if (_erg) window._kiLageErgaenzt = window._currentObjKey || '';
  var _messP = (_erg ? Promise.resolve(null) : _lageMessen(str, hnr, plz, ort)).then(function (m) {
    window._lastLageMessung = m;
    if (!_kiFertig) body.innerHTML = (m ? _lageVergleichHtml(m, null) : '') + _ladeKi;
    return m;
  });
  function _nurMessung(hinweis) {
    _messP.then(function (m) {
      body.innerHTML = (m ? _lageVergleichHtml(m, null) : '<div class="ki-lage-err">⚠ Für diese Adresse liegt keine Messung vor.</div>')
        + (hinweis ? '<div class="ki-lage-err" style="margin-top:8px">' + hinweis + '</div>' : '')
        + (m ? '<div class="ki-lage-actions"><button class="btn btn-gold ki-lage-apply-btn" type="button" onclick="applyKiLageToFields()">⤓ Gemessene Werte übernehmen</button></div>' : '');
      if (btn) { btn.disabled = false; btn.textContent = 'Lage neu analysieren'; }
    });
  }

  // V63.82: KI-Credits-Gate (v2175: gilt nur noch fuer den KI-Teil)
  if (typeof Paywall !== 'undefined' && !Paywall.gate('ai_calls')) { _nurMessung(''); return; }
  // V63.82: Wenn ki_market_analysis nicht im Plan → Hinweis
  if (typeof Plan !== 'undefined' && !Plan.can('ai_market_analysis')) {
    _nurMessung('🔒 Die KI-Ergänzung (Texte, Wertsteigerung, Entwicklung) ist Teil des <strong>Investor</strong>-Plans und höher. Die Messung oben gilt in jedem Plan.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Analysiere…'; }
  body.innerHTML = '<div class="ki-lage-loading">' +
    '<div class="ki-lage-spinner"></div>' +
    'KI recherchiert Makro- und Mikrolage…' +
  '</div>';
  // V187-h2: merken welche Adresse benutzt wurde (für Cache + Banner)
  window._kiLageCurrentRequest = { adresse: adresse, str: str, hnr: hnr, plz: plz, ort: ort, ts: Date.now() };

  // User-Key aus Settings (falls gesetzt) als Fallback mitgeben
  var userApiKey = '';
  // V51: Determinismus + Stil aus Settings ziehen
  var aiTemp = 0, aiSeed = 42, aiTone = '', aiRiskBias = '', aiLength = '';
  // V63.21: Prompt-Qualitätseinstellungen
  var aiDetailLevel = '', aiTonality = '', aiFocusAreas = [], aiCustomInstructions = '';
  try {
    var settings = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    userApiKey = settings.openai_api_key || settings.openaiApiKey || '';
    if (settings.ai_temperature != null) aiTemp = parseFloat(settings.ai_temperature);
    if (settings.ai_seed != null)        aiSeed = parseInt(settings.ai_seed, 10) || 42;
    aiTone     = settings.ai_tone || '';
    aiRiskBias = settings.ai_risk_bias || '';
    aiLength   = settings.ai_length || '';
    // V63.21
    aiDetailLevel = settings.ai_detail_level || '';
    aiTonality    = settings.ai_tonality || '';
    aiFocusAreas  = Array.isArray(settings.ai_focus_areas) ? settings.ai_focus_areas : [];
    aiCustomInstructions = (settings.ai_custom_instructions || '').toString().slice(0, 500);
  } catch (e) {}

  var token = localStorage.getItem('ji_token') || '';

  // V63.6: Zusätzliche Daten mitsenden für die Deal-Bewertung
  function _kn(id) {
    var e = document.getElementById(id);
    if (!e) return null;
    return (typeof parseDe === 'function') ? parseDe(e.value) || null : (parseFloat((e.value||'').replace(',','.')) || null);
  }
  var kpForLage     = _kn('kp');
  var wflForLage    = _kn('wfl');
  var nkmForLage    = _kn('nkm');

  fetch('/api/v1/ai/lage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      adresse: adresse,
      str: str, hnr: hnr, plz: plz, ort: ort,
      kaufpreis:      kpForLage,
      wohnflaeche:    wflForLage,
      nettokaltmiete: nkmForLage,
      userApiKey: userApiKey,
      // V51: Determinismus + Stil
      aiOptions: {
        temperature: aiTemp,
        seed: aiSeed,
        tone: aiTone,
        riskBias: aiRiskBias,
        length: aiLength,
        // V63.21: Prompt-Qualitätseinstellungen
        detailLevel: aiDetailLevel,
        tonality: aiTonality,
        focusAreas: aiFocusAreas,
        customInstructions: aiCustomInstructions
      }
    })
  })
  .then(function(r) {
    if (!r.ok) {
      // V56: Bessere Fehlermeldung — auch wenn keine JSON-Antwort kommt
      return r.text().then(function(text) {
        var msg;
        try { msg = JSON.parse(text).error || ('HTTP ' + r.status); }
        catch(e) { msg = 'HTTP ' + r.status + ' — Backend nicht erreichbar oder Server-Fehler.'; }
        console.error('[KI-Lage] Backend-Antwort:', r.status, text);
        throw new Error(msg);
      });
    }
    return r.json();
  })
  .then(function(data) {
    if (!data.success || (!data.makro && !data.mikro)) {
      throw new Error(data.error || 'Keine Daten zurückgekommen');
    }
    _kiFertig = true;
    if (_erg) {
      /* v3007 · die ganze Antwort bleibt fuer den Abgleich (sie kostet dasselbe,
         ob wir zwei oder sechs Merkmale zeigen), und NICHTS wird ungefragt ins
         Feld geschrieben - bis v3006 ueberschrieb die Recherche Entwicklung und
         Wertsteigerung, auch einen eigenen Wert. Gewaehlt wird in der Tabelle. */
      var _k = window._currentObjKey || '';
      window._kiLageErgaenzung = window._kiLageErgaenzung || {};
      window._kiLageErgaenzung[_k] = { ki: data, adresse: adresse };
      _dpLageOffen[_k] = true;
      try {
        if (window.currentDeal && typeof window.currentDeal === 'object') {
          window.currentDeal.ai_lage_cache = { html: '', ts: Date.now(), address: adresse, str: str, hnr: hnr, plz: plz, ort: ort,
            daten: { ki: data, messung: null, modus: 'ergaenzen' } };
          if (typeof scheduleSave === 'function') scheduleSave();
        }
      } catch (e) {}
      window._kiLageErgaenzt = null;
      if (typeof window._kiLageBerichtZeichnen === 'function') window._kiLageBerichtZeichnen();
      if (typeof toast === 'function') toast('✓ Webrecherche fertig — im Abgleich wählen, welcher Wert gilt');
      return;
    }
    /* v2175: die Messung abwarten (sie ist fast immer schon da), dann beides zeigen */
    return _messP.then(function () { _renderKiLage(data); });
  })
  .catch(function(err) {
    _kiFertig = true;
    _nurMessung('⚠ KI-Ergänzung fehlgeschlagen: ' + _escKi(err.message || 'Fehler bei der Lage-Analyse'));
  })
  .finally(function() {
    if (btn) { btn.disabled = false; btn.textContent = 'Lage neu analysieren'; }
  });
}

function _renderKiLage(data, opts) {
  var body = document.getElementById('ki-lage-body');
  if (!body) return;

  // V63.8: Helper für Quelle pro Kategorie (klickbarer Link)
  function _renderSourceLink(source) {
    if (!source || !source.label) return '';
    if (source.url) {
      return '<a class="ki-lage-src-link" href="' + _escKi(source.url) + '" target="_blank" rel="noopener noreferrer" title="Quelle öffnen">📚 Quelle: ' + _escKi(source.label) + '</a>';
    }
    return '<span class="ki-lage-src-link ki-lage-src-link-inert">📚 Quelle: ' + _escKi(source.label) + '</span>';
  }

  function renderBox(title, kind, d) {
    if (!d) return '';
    var score = parseInt(d.score) || 0;
    var color = score >= 85 ? '#10A65C' : score >= 70 ? '#2FBE6E' : score >= 50 ? '#E5BD53' : '#D55B5B';
    return '<div class="ki-lage-card ki-lage-card-' + kind + '">' +
      '<div class="ki-lage-card-head">' +
        '<div class="ki-lage-card-title">' + title + '</div>' +
        '<div class="ki-lage-score" style="color:' + color + ';border-color:' + color + '">' + score + '<span>/100</span></div>' +
      '</div>' +
      '<div class="ki-lage-card-label" style="color:' + color + '">' + _escKi(d.label || '') + '</div>' +
      '<div class="ki-lage-card-text">' + _escKi(d.text || '') + '</div>' +
      _renderSourceLink(d.source) +
    '</div>';
  }

  // V63.6/8: Erweiterte Bewertungs-Box für die zusätzlichen Aspekte
  function renderAspect(title, kind, d, fieldId) {
    if (!d) return '';
    var score = parseInt(d.score) || 0;
    var color = score >= 85 ? '#10A65C' : score >= 70 ? '#2FBE6E' : score >= 50 ? '#E5BD53' : '#D55B5B';
    return '<div class="ki-lage-aspect-card">' +
      '<div class="ki-lage-aspect-head">' +
        '<span class="ki-lage-aspect-title">' + title + '</span>' +
        '<span class="ki-lage-aspect-score" style="color:' + color + '">' + (d.label || score + '/100') + '</span>' +
      '</div>' +
      '<div class="ki-lage-aspect-bar">' +
        '<div class="ki-lage-aspect-bar-fill" style="width:' + score + '%;background:' + color + '"></div>' +
      '</div>' +
      '<div class="ki-lage-aspect-text">' + _escKi(d.text || '') + '</div>' +
      _renderSourceLink(d.source) +
    '</div>';
  }

  // Kaufpreis-Bewertung
  function renderDealVerdict(verdict) {
    if (!verdict) return '';
    var color = verdict.tier === 'good' ? '#10A65C' :
                verdict.tier === 'fair' ? '#E5BD53' :
                verdict.tier === 'poor' ? '#D55B5B' : '#999';
    var icon  = verdict.tier === 'good' ? '✓' :
                verdict.tier === 'fair' ? '~' :
                verdict.tier === 'poor' ? '!' : '?';
    return '<div class="ki-lage-deal-verdict" style="border-color:' + color + '">' +
      '<div class="ki-lage-deal-icon" style="color:' + color + '">' + icon + '</div>' +
      '<div class="ki-lage-deal-body">' +
        '<div class="ki-lage-deal-headline" style="color:' + color + '">' + _escKi(verdict.headline || 'Deal-Bewertung') + '</div>' +
        '<div class="ki-lage-deal-text">' + _escKi(verdict.text || '') + '</div>' +
      '</div>' +
    '</div>';
  }

  // V63.6/8: 4 Zusatz-Aspekte als Grid
  var aspectsHtml = '';
  if (data.bevoelkerung || data.nachfrage || data.wertsteigerung || data.entwicklung) {
    aspectsHtml = '<div class="ki-lage-aspects-grid">' +
      renderAspect('Bevölkerungsentwicklung', 'bevoelkerung',  data.bevoelkerung, 'ds2_bevoelkerung') +
      renderAspect('Nachfrage (Vermarktungsdauer)', 'nachfrage',     data.nachfrage,    'ds2_nachfrage') +
      renderAspect('Wertsteigerungs-Potenzial','wertsteigerung',data.wertsteigerung,'ds2_wertsteigerung') +
      renderAspect('Entwicklungs-Möglichkeiten','entwicklung', data.entwicklung,  'ds2_entwicklung') +
    '</div>';
  }

  /* v3007 · statt Vergleich + Karten EIN Abgleich: Ermittelt · Webrecherche ·
     Uebernehmen, die KI-Texte und Quellen stehen in der Zeile. Die Karten
     (renderBox/renderAspect) wiederholten dieselben Texte ein zweites Mal. */
  void renderBox; void renderAspect; void aspectsHtml; void renderDealVerdict;
  var _key = window._currentObjKey || '';
  _dpLageOffen[_key] = !opts || !opts.zu;   /* frisch recherchiert: offen; aus dem Speicher: zu */
  var _messung = opts && ('messung' in opts) ? opts.messung : window._lastLageMessung;
  var _banner = opts && opts.banner != null ? opts.banner
    : (typeof window.KiLage !== 'undefined' && typeof window.KiLage.getAccuracyBanner === 'function' ? window.KiLage.getAccuracyBanner() : '');
  var _neu = function () {
    var b = document.getElementById('ki-lage-body'); if (!b) return;
    b.innerHTML = _banner + _lageAbgleichHtml({ key: _key, erm: _lvErmAusMessung(_messung), ki: data, neu: _neu });
  };
  _neu();

  // V63.6: Daten zwischenspeichern für späteres "In Felder übernehmen"
  if (opts && opts.zu) return;   /* v3007: aus dem Speicher - kein frischer Abruf, nichts neu cachen */
  window._lastKiLageData = data;
  // V187-h2: Cache in currentDeal speichern
  try { if (window.KiLage && typeof window.KiLage.cacheResult === 'function') window.KiLage.cacheResult(); } catch(e){}
}

/**
 * V63.6/V63.8: KI-Lage-Daten in DS2-Felder im Tab Objekt übernehmen.
 * V63.8: Nutzt direkt die KI-gelieferten ENUM-Werte (keine Score-Mapping mehr).
 */
function applyKiLageToFields() {
  var d = window._lastKiLageData || {};
  var mg = (window._lastLageMessung && window._lastLageMessung.felder) || {};
  if (!window._lastKiLageData && !Object.keys(mg).length) {
    if (typeof toast === 'function') toast('⚠ Keine KI-Lage-Daten verfügbar — bitte zuerst "Lage analysieren"');
    return;
  }

  function _setSelect(id, value) {
    var el = document.getElementById(id);
    if (!el || !value) return;
    // Prüfen ob die Option im Select existiert
    var opt = el.querySelector('option[value="' + value + '"]');
    if (opt) {
      el.value = value;
      el.dispatchEvent(new Event('change'));
      return true;
    } else {
      console.warn('[applyKiLage] Option "' + value + '" nicht im Select #' + id);
    }
    return false;
  }

  /* v2175: je Feld die Messung, wo es eine gibt - sonst der KI-Wert */
  var _n = { gemessen: 0, ki: 0 };
  _LAGE_FELDER.forEach(function (x) {
    var g = mg[x.id] && mg[x.id].stufe;
    var k = d[x.ki] && d[x.ki].value;
    /* v2515: Herkunft je Feld mitschreiben */
    if (g) { if (_setSelect(x.id, g)) window.DpLageHerkunft.setze(x.id, 'gemessen'); _n.gemessen++; }
    else if (k) { if (_setSelect(x.id, k)) window.DpLageHerkunft.setze(x.id, 'ki'); _n.ki++; }
  });

  if (typeof toast === 'function') toast('✓ Lage übernommen — ' + _n.gemessen + ' gemessen, ' + _n.ki + ' aus der KI');
  if (typeof dpUpdateAll === 'function') dpUpdateAll();
}
window.applyKiLageToFields = applyKiLageToFields;

function _escKi(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sparkles-Icon einsetzen
(function() {
  function fillIcon() {
    var el = document.getElementById('ki-lage-icon');
    if (el && window.Icons && window.Icons.sparkles) {
      el.innerHTML = window.Icons.sparkles({ size: 18 });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillIcon);
  else setTimeout(fillIcon, 100);
})();

window.runKiLage = runKiLage;


// ═══════════════════════════════════════════════════════════════
// V187-h2: KI-Lage API für Object-Switch + Cache + Kontext-Banner
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict';
  
  function _getBody() { return document.getElementById('ki-lage-body'); }
  function _getBtn() { return document.getElementById('ki-lage-btn'); }
  
  function _getCurrentAddress() {
    var str = (document.getElementById('str') || {}).value || '';
    var hnr = (document.getElementById('hnr') || {}).value || '';
    var plz = (document.getElementById('plz') || {}).value || '';
    var ort = (document.getElementById('ort') || {}).value || '';
    return { str: str.trim(), hnr: hnr.trim(), plz: plz.trim(), ort: ort.trim() };
  }
  
  function _buildAccuracyBanner(addr) {
    if (!addr) addr = _getCurrentAddress();
    var hasStrasse = addr.str && addr.str.length > 0;
    var hasHnr = addr.hnr && addr.hnr.length > 0;
    var hasPlzOrt = addr.plz && addr.ort;
    
    var cls, icon, title, text;
    if (hasStrasse && hasHnr && hasPlzOrt) {
      cls = 'high';
      icon = '✓';
      title = 'Detailanalyse';
      text = 'Mit Straße + Hausnummer + PLZ/Ort — die KI liefert eine Mikrolagen-Analyse auf Straßenebene.';
    } else if (hasStrasse && hasPlzOrt) {
      cls = 'medium';
      icon = '◐';
      title = 'Detaillierte Analyse';
      text = 'Mit Straße + PLZ/Ort — die KI bewertet die Straßenebene. Für noch präzisere Ergebnisse die Hausnummer ergänzen.';
    } else if (hasPlzOrt) {
      cls = 'low';
      icon = 'ℹ';
      title = 'Generelle Lage-Einschätzung';
      text = 'Nur PLZ + Ort vorhanden — die Analyse ist generisch für das Quartier/die Stadt. Für eine präzisere Mikrolagen-Bewertung Straße und Hausnummer im Tab Objekt ergänzen.';
    } else {
      cls = 'low';
      icon = '⚠';
      title = 'Wenig Daten';
      text = 'Die Adressdaten sind unvollständig. Bitte PLZ und Ort eintragen.';
    }
    
    var bgColor, textColor, borderColor;
    if (cls === 'high') {
      bgColor = 'rgba(63, 165, 108, 0.08)';
      borderColor = 'rgba(63, 165, 108, 0.35)';
      textColor = '#2a6e48';
    } else if (cls === 'medium') {
      bgColor = 'color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 8%, transparent)';
      borderColor = 'color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent)';
      textColor = '#8b7330';
    } else {
      bgColor = 'color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 6%, transparent)';
      borderColor = 'rgba(0, 0, 0, 0.10)';
      textColor = '#5f5e5a';
    }
    
    return (
      '<div style="background:' + bgColor + ';border:0.5px solid ' + borderColor + ';' +
      'border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;display:flex;' +
      'gap:8px;align-items:flex-start;color:' + textColor + ';">' +
        '<div style="font-size:14px;line-height:1;margin-top:2px">' + icon + '</div>' +
        '<div>' +
          '<div style="font-weight:600;margin-bottom:2px">' + title + '</div>' +
          '<div style="line-height:1.4">' + text + '</div>' +
        '</div>' +
      '</div>'
    );
  }
  
  // Public API
  window.KiLage = {
    // Beim Object-Switch: Anzeige zurücksetzen auf Initial-Stand
    clearResult: function() {
      var body = _getBody();
      var btn = _getBtn();
      if (body) {
        body.innerHTML = '<div class="ki-lage-empty" style="color:#888780;font-size:13px;padding:14px 0">' +
          'Klicke "Lage analysieren" für eine KI-gestützte Makro- und Mikrolagen-Bewertung.' +
        '</div>';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lage analysieren';
      }
      window._kiLageCurrentRequest = null;
    },
    
    // Beim Object-Load: Cache hydrieren wenn vorhanden
    hydrate: function(cache) {
      if (!cache || (!cache.html && !(cache.daten && cache.daten.ki))) {
        this.clearResult();
        return;
      }
      var body = _getBody();
      var btn = _getBtn();
      if (!body) return;
      
      var ageMs = cache.ts ? (Date.now() - cache.ts) : 0;
      var ageDays = Math.round(ageMs / 86400000);
      var ageTxt = ageDays === 0 ? 'heute' : ageDays === 1 ? 'gestern' : 'vor ' + ageDays + ' Tagen';
      
      var addrTxt = cache.address || '(unbekannte Adresse)';
      
      var cacheBanner = 
        '<div style="background:rgba(63,165,108,0.06);border:0.5px solid rgba(63,165,108,0.30);' +
        'border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;display:flex;' +
        'gap:8px;align-items:center;justify-content:space-between;color:#2a6e48;">' +
          '<div>' +
            '<strong>Gespeicherte KI-Analyse</strong> für ' + addrTxt + ' · ' + ageTxt +
          '</div>' +
          '<button type="button" onclick="if(typeof runKiLage===\'function\')runKiLage()" ' +
          'style="background:transparent;border:0.5px solid rgba(63,165,108,0.4);' +
          'border-radius:6px;padding:4px 10px;font-size:11px;color:#2a6e48;cursor:pointer;white-space:nowrap">' +
          '↻ Neu analysieren</button>' +
        '</div>';
      
      /* v3007 · liegen die Daten mit im Speicher, wird der Abgleich neu gebaut
         (Auswahl und Quellen bleiben bedienbar), zugeklappt. Alte Speicher
         ohne Daten zeigen weiter ihr HTML. */
      if (cache.daten && cache.daten.ki && typeof _renderKiLage === 'function') {
        _renderKiLage(cache.daten.ki, { zu: true, messung: cache.daten.messung || null, banner: cacheBanner });
      } else {
        body.innerHTML = cacheBanner + cache.html;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lage neu analysieren';
      }
    },
    
    // Nach erfolgreicher Analyse: Cache in currentDeal speichern
    cacheResult: function() {
      try {
        if (typeof window.currentDeal !== 'object' || !window.currentDeal) return;
        var body = _getBody();
        if (!body) return;
        var req = window._kiLageCurrentRequest;
        if (!req) return;
        
        // HTML im Body merken (ohne Banner — die werden bei Hydrate neu gemacht)
        var html = body.innerHTML;
        // Falls Loading/Empty/Error noch drin: nicht speichern
        if (html.indexOf('ki-lage-loading') >= 0 || html.indexOf('ki-lage-err') >= 0 || html.indexOf('ki-lage-empty') >= 0) {
          return;
        }
        
        window.currentDeal.ai_lage_cache = {
          html: html,
          ts: Date.now(),
          address: req.adresse,
          str: req.str, hnr: req.hnr, plz: req.plz, ort: req.ort,
          /* v3007 · die Daten selbst, damit der Abgleich nach dem Laden bedienbar bleibt */
          daten: window._lastKiLageData ? { ki: window._lastKiLageData, messung: window._lastLageMessung || null } : null
        };
        // Trigger save (debounced via storage.js)
        if (typeof scheduleSave === 'function') scheduleSave();
      } catch (e) {
        console.warn('[KiLage] cacheResult fail:', e);
      }
    },
    
    // Genauigkeits-Banner für Anzeige
    getAccuracyBanner: _buildAccuracyBanner
  };
})();


// V229: PLZ-Halluzinationsschutz — Frontend-Helper.
// Wird bei 422-Response von /api/v1/ai/lage oder /miete oder /bodenrichtwert aufgerufen.
window._v229ShowPlzError = function(errorBody, targetEl) {
  if (!targetEl) return;
  var reason = (errorBody && errorBody.reason) || 'invalid_plz';
  var plz = (errorBody && errorBody.plz) || (document.getElementById('plz') || {}).value || '';
  var icon = '⚠';
  var title = 'PLZ-Problem';
  var hint = '';
  if (reason === 'test_plz') {
    icon = '🤖';
    title = 'PLZ sieht nach Test-Eingabe aus';
    hint = 'Die PLZ "' + plz + '" wird häufig als Demo-Wert verwendet. Damit die KI keine ' +
           'erfundenen Lage-Bewertungen liefert, ist sie geblockt. Bitte echte PLZ eintragen.';
  } else if (reason === 'out_of_range') {
    icon = '📮';
    title = 'PLZ außerhalb des deutschen Bereichs';
    hint = 'Die PLZ "' + plz + '" liegt nicht im gültigen deutschen Bereich (01067–99998).';
  } else if (reason === 'invalid_format') {
    icon = '✏';
    title = 'Ungültiges PLZ-Format';
    hint = 'Eine deutsche Postleitzahl hat genau 5 Ziffern (z.B. 32049).';
  } else {
    hint = (errorBody && errorBody.error) || 'Die KI-Analyse wurde aus PLZ-Gründen geblockt.';
  }
  targetEl.innerHTML =
    '<div class="ki-lage-err" style="text-align:left;padding:16px;background:rgba(245,180,40,0.10);border-left:3px solid #E5A847;border-radius:6px">' +
      '<div style="font-size:24px;margin-bottom:4px">' + icon + '</div>' +
      '<div style="font-weight:600;color:#9C7223;margin-bottom:6px">' + title + '</div>' +
      '<div style="font-size:13px;color:var(--muted)">' + hint + '</div>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById(\'plz\').focus();document.getElementById(\'plz\').scrollIntoView({behavior:\'smooth\',block:\'center\'})">PLZ-Feld öffnen →</button></div>' +
    '</div>';
};

/* ══ v2177 · LIEGT EIN MARKTBERICHT VOR, WIRD NICHT NOCHMAL ANALYSIERT ════
   Marcel am 13.10.2026: „wenn wir einen Marktbericht abgerufen haben, der
   es bereits eingetragen hat, sollten wir die Moeglichkeit des Abrufes
   nicht mehr anbieten ... dann koennen wir dort reinschreiben als Info,
   dass wir den Stand aus Marktbericht uebernommen haben. ... man koennte
   sonst noch den Abgleich gegenueber Webrecherche anbieten, aber ist das
   sinnvoll?"
   Entschieden: der Bericht hat die Lage GEMESSEN (dealpilot-mb.js autoLage,
   dieselben Schwellen wie hier seit v2177). Eine Web-Recherche ergaenzt nur,
   was er nicht misst - die Entwicklungsmoeglichkeiten (und die Wertsteigerung,
   wenn der Bericht keine Preisreihe hatte). Fuer gemessene Felder bringt ein
   Abgleich mit dem Web nichts. */
(function () {
  'use strict';
  function bericht() {
    var D = window.DealPilotMB && typeof DealPilotMB.letzter === 'function' ? DealPilotMB.letzter() : null;
    if (!D || (D.macroRaw == null && D.microRaw == null && D.bevRaw == null && D.tageRaw == null)) return null;
    return D;
  }
  function fz(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toString().replace('.', ','); }
  function S() { return (window.DealPilotMB && DealPilotMB.lageStufen) || {}; }
  /* v3007 · die Webrecherche zu DIESEM Objekt: frisch aus der Sitzung, sonst
     aus dem Objekt (ai_lage_cache.daten), aber nur fuer dieselbe Adresse. */
  function recherche() {
    var k = window._currentObjKey || '';
    var E = (window._kiLageErgaenzung || {})[k];
    if (E && E.ki) return E.ki;
    var c = window.currentDeal && window.currentDeal.ai_lage_cache;
    if (!c || !c.daten || !c.daten.ki) return null;
    var v = function (id) { return ((document.getElementById(id) || {}).value || '').trim().toLowerCase(); };
    if (c.plz && String(c.plz).trim().toLowerCase() !== v('plz')) return null;
    if (c.str && String(c.str).trim().toLowerCase() !== v('str')) return null;
    return c.daten.ki;
  }
  function zeilen(D) {
    var S = (window.DealPilotMB && DealPilotMB.lageStufen) || {};
    var z = [];
    if (D.macroRaw != null) z.push(['makrolage', 'Makrolage', S.makro && S.makro(D.macroRaw), 'Score ' + Math.round(D.macroRaw)]);
    if (D.microRaw != null) z.push(['mikrolage', 'Mikrolage', S.mikro && S.mikro(D.microRaw), 'Score ' + Math.round(D.microRaw)]);
    if (D.bevRaw != null) z.push(['ds2_bevoelkerung', 'Bevölkerung', S.bev && S.bev(D.bevRaw), fz(D.bevRaw, 2) + ' %/Jahr']);
    if (D.tageRaw != null) z.push(['ds2_nachfrage', 'Nachfrage', S.nachfrage && S.nachfrage(D.tageRaw), Math.round(D.tageRaw) + ' Tage Vermarktungsdauer']);
    if (D.trendRaw != null) z.push(['ds2_wertsteigerung', 'Wertsteigerung', S.wert ? S.wert(D.trendRaw) : null, fz(D.trendRaw, 1) + ' %/Jahr Preisentwicklung']);   /* v3007: Stufe wie autoLage */
    return z;
  }
  function zeichnen() {
    var body = document.getElementById('ki-lage-body');
    var btn = document.getElementById('ki-lage-btn');
    var tag = document.querySelector('#ki-lage-box .ki-lage-tag');
    if (!body) return;
    var D = bericht();
    if (!D) {
      if (btn) btn.style.removeProperty('display');
      if (tag) tag.textContent = '4 gemessen · 2 KI';
      if (body.getAttribute('data-aus-bericht')) {
        body.removeAttribute('data-aus-bericht');
        body.innerHTML = '<div class="ki-lage-empty">Adresse oben eintragen, dann Button klicken — DealPilot misst Makrolage, Mikrolage, Bevölkerung und Nachfrage aus amtlichen Daten und stellt die KI-Einschätzung daneben; Wertsteigerung und Entwicklung ergänzt die KI.</div>';
      }
      return;
    }
    /* !important: eine Regel setzt .btn auf display:flex !important (gemessen) */
    if (btn) btn.style.setProperty('display', 'none', 'important');
    if (tag) tag.textContent = 'aus dem Marktbericht';
    /* v2177a · Ein Stufe-1-Bericht misst nur die Mikrolage (gemessen an
       Bismarckstr.: Makro, Bevoelkerung, Nachfrage fehlten). Was er nicht
       hat, kommt aus unserer eigenen Messung (/lage/gemessen, ohne KI) -
       einmal je Objekt, und nur in LEERE Felder, wie autoLage. */
    var k = window._currentObjKey || '';
    var fehlt = (D.macroRaw == null || D.bevRaw == null || D.tageRaw == null);
    if (fehlt && !messungen[k] && !laeuft[k]) {
      laeuft[k] = true;
      var v = function (id) { return (document.getElementById(id) || {}).value || ''; };
      _lageMessen(v('str'), v('hnr'), v('plz'), v('ort')).then(function (m) {
        messungen[k] = m || { felder: {} }; laeuft[k] = false;
        var ff = messungen[k].felder || {}, gesetzt = 0;
        [['makrolage', D.macroRaw], ['ds2_bevoelkerung', D.bevRaw], ['ds2_nachfrage', D.tageRaw]].forEach(function (p) {
          var el = document.getElementById(p[0]);
          if (p[1] == null && ff[p[0]] && el && !el.value && el.querySelector('option[value="' + ff[p[0]].stufe + '"]')) {
            el.value = ff[p[0]].stufe; el.dispatchEvent(new Event('change')); gesetzt++;
          }
        });
        if (gesetzt && typeof dpUpdateAll === 'function') dpUpdateAll();
        zeichnen();
      });
    }
    if (window._kiLageErgaenzt === (window._currentObjKey || '')) return;   /* KI-Ergaenzung steht gerade da */
    /* v3007 · liegt eine Webrecherche vor (frisch oder im Objekt gespeichert),
       steht der Abgleich mit Auswahl statt der ≠/✓-Liste. */
    var KI = recherche();
    if (KI) {
      var erm = _lvErmAusMessung(messungen[window._currentObjKey || '']);
      zeilen(D).forEach(function (r) {
        erm[r[0]] = { stufe: r[2] || null, detail: r[3] + ' · Marktbericht', tip: 'Gemessen im Marktbericht' + (D.bericht_datum ? ' vom ' + D.bericht_datum : '') };
      });
      var kk = window._currentObjKey || '';
      var neu = function () {
        var b = document.getElementById('ki-lage-body'); if (!b) return;
        var h = '<div class="ki-lage-vergleich lv-mark"><div class="lv-kopf">✓ Lage aus dem Marktbericht' + (D.bericht_datum ? ' vom ' + _escKi(D.bericht_datum) : '') + ' übernommen</div>'
          + '<div class="lv-fuss" style="margin-top:0">Eine erneute Analyse ist nicht nötig. Die Webrecherche steht daneben — Sie wählen je Merkmal, was gilt.</div>'
          + _lageAbgleichHtml({ key: kk, erm: erm, ki: KI, neu: neu,
              fuss: 'Ermittelt: Marktbericht, sonst Regionaldatenbank, Zensus 2022 — Quelle beim Darüberfahren.' })
          + '<div class="ki-lage-actions" style="margin-top:10px"><button class="btn btn-sm" type="button" onclick="runKiLage({ergaenzen:true})">Webrecherche erneuern</button></div></div>';
        if (b._dpLvHtml === h && b.querySelector('.lv-mark')) return;
        b.innerHTML = h; b._dpLvHtml = h;
      };
      _lageCss();
      body.setAttribute('data-aus-bericht', '1');
      neu();
      return;
    }
    var rows = zeilen(D).map(function (r) {
      var feld = document.getElementById(r[0]);
      var jetzt = feld && feld.value ? _lageOptText(r[0], feld.value) : '–';
      var soll = r[2] ? _lageOptText(r[0], r[2]) : null;
      var anders = soll && feld && feld.value && feld.value !== r[2];
      return '<tr><td>' + r[1] + '</td><td><b>' + _escKi(jetzt) + '</b><span class="lv-w">' + _escKi(r[3]) + '</span></td>'
        + '<td class="lv-u">' + (anders ? '<span class="lv-ab" title="Im Feld steht ein anderer Wert als die Messung des Berichts (' + _escKi(soll) + ') — von Hand geändert?">≠</span>' : '<span class="lv-ok">✓</span>') + '</td></tr>';
    }).join('');
    var M = (messungen[window._currentObjKey || ''] || {}).felder || {};
    [['makrolage', 'Makrolage', D.macroRaw], ['ds2_bevoelkerung', 'Bevölkerung', D.bevRaw], ['ds2_nachfrage', 'Nachfrage', D.tageRaw]].forEach(function (p) {
      var g = M[p[0]];
      if (p[2] != null || !g) return;
      var el = document.getElementById(p[0]);
      var anders = el && el.value && el.value !== g.stufe;
      rows += '<tr title="' + _escKi(g.quelle + String.fromCharCode(10) + 'Schwelle: ' + g.schwelle) + '"><td>' + p[1] + '</td><td><b>' + _escKi(_lageOptText(p[0], el && el.value ? el.value : g.stufe)) + '</b><span class="lv-w">'
        + _escKi(String(g.wert).replace('.', ',') + ' ' + g.einheit) + ' · Regionaldaten (nicht im Bericht)</span></td><td class="lv-u">'
        + (anders ? '<span class="lv-ab" title="Im Feld steht ein anderer Wert als die Messung (' + _escKi(_lageOptText(p[0], g.stufe)) + ')">≠</span>' : '<span class="lv-ok">✓</span>') + '</td></tr>';
    });
    /* v3007: die KI-Zeilen (Entwicklung/Wertsteigerung) stehen jetzt im Abgleich oben */
    var offen = ['ds2_entwicklung'].concat(D.trendRaw == null ? ['ds2_wertsteigerung'] : []);
    var html = '<div class="ki-lage-vergleich"><div class="lv-kopf">✓ Lage aus dem Marktbericht' + (D.bericht_datum ? ' vom ' + _escKi(D.bericht_datum) : '') + ' übernommen</div>'
      + '<table class="lv-tab"><tbody>' + rows + '</tbody></table>'
      + '<div class="lv-fuss">Gemessen im Marktbericht — eine erneute Analyse ist nicht nötig. '
      + 'Nicht gemessen werden ' + (offen.length > 1 ? 'Wertsteigerung und Entwicklungsmöglichkeiten' : 'die Entwicklungsmöglichkeiten (B-Plan, Stadtentwicklung)') + '; die ergänzt auf Wunsch eine Web-Recherche.</div>'
      + '<div class="ki-lage-actions" style="margin-top:10px"><button class="btn btn-sm" type="button" onclick="runKiLage({ergaenzen:true})">'
      + (offen.length > 1 ? 'Wertsteigerung & Entwicklung' : 'Entwicklung') + ' per Web-Recherche ergänzen</button></div></div>';
    _lageCss();
    body.setAttribute('data-aus-bericht', '1');
    if (body.innerHTML !== html) body.innerHTML = html;
  }
  window._kiLageBerichtZeichnen = zeichnen;
  var messungen = {}, laeuft = {};
  var letzterKey = null;
  function takt() {
    var k = window._currentObjKey || '';
    if (k !== letzterKey) { letzterKey = k; window._kiLageErgaenzt = null; }
    try { zeichnen(); } catch (e) {}
  }
  window.addEventListener('dp:mb-ready', function () { setTimeout(takt, 300); });
  window.addEventListener('dp:object-ready', function () { setTimeout(takt, 1500); });
  setInterval(takt, 2500);
})();
