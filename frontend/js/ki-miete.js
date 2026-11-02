// V63.27: KI-Mietpreis-Analyse für Tab Miete
// Eigene Implementation analog runKiLage in ki-lage.js — Vorschläge werden in der
// KI-Mietpreis-Analyse-Box gerendert (nicht inline am Feld).

function _kmEsc(s) { return ('' + (s == null ? '' : s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function runKiMiete() {
  var btn = document.getElementById('ki-miete-btn');
  var body = document.getElementById('ki-miete-body');
  if (!body) return;

  // V63.82: KI-Credits-Gate
  if (typeof Paywall !== 'undefined' && !Paywall.gate('ai_calls')) {
    if (btn) { btn.disabled = false; btn.textContent = 'Marktmiete recherchieren'; }
    return;
  }

  var str = (document.getElementById('str') || {}).value || '';
  var hnr = (document.getElementById('hnr') || {}).value || '';
  var plz = (document.getElementById('plz') || {}).value || '';
  var ort = (document.getElementById('ort') || {}).value || '';
  if (!str || !ort) {
    body.innerHTML = '<div class="ki-miete-err">⚠ Bitte zuerst Adresse (Straße + Ort) im Tab Objekt eintragen.</div>';
    return;
  }

  function _vN(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
  }
  var wfl = _vN('wfl');
  if (wfl <= 0) {
    body.innerHTML = '<div class="ki-miete-err">⚠ Bitte zuerst die Wohnfläche im Tab Objekt eintragen.</div>';
    return;
  }
  var nkm = _vN('nkm');

  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="font-size:13px">⏳</span> Analysiere…'; }
  body.innerHTML = '<div class="ki-miete-loading">' +
    '<div class="ki-miete-spinner"></div>' +
    'KI recherchiert Marktmiete und Mietausfall-Risiko…' +
  '</div>';

  var aiTemp = 0, aiSeed = 42, aiTone = '', aiRiskBias = '', aiLength = '';
  var aiDetailLevel = '', aiTonality = '', aiFocusAreas = [], aiCustomInstructions = '';
  var userApiKey = '';
  try {
    var settings = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    userApiKey = settings.openai_api_key || settings.openaiApiKey || '';
    if (settings.ai_temperature != null) aiTemp = parseFloat(settings.ai_temperature);
    if (settings.ai_seed != null)        aiSeed = parseInt(settings.ai_seed, 10) || 42;
    aiTone     = settings.ai_tone || '';
    aiRiskBias = settings.ai_risk_bias || '';
    aiLength   = settings.ai_length || '';
    aiDetailLevel = settings.ai_detail_level || '';
    aiTonality    = settings.ai_tonality || '';
    aiFocusAreas  = Array.isArray(settings.ai_focus_areas) ? settings.ai_focus_areas : [];
    aiCustomInstructions = (settings.ai_custom_instructions || '').toString().slice(0, 500);
  } catch (e) {}

  var token = localStorage.getItem('ji_token') || '';

  var fieldSpecs = {
    ds2_marktmiete: {
      type: 'number',
      label: 'Marktmiete (€/m²)',
      hint: 'Markt-übliche Kaltmiete für die Region',
      domain: 'mietmarkt'
    },
    ds2_mietausfall: {
      type: 'enum',
      label: 'Mietausfall-Risiko',
      values: ['sehr_niedrig', 'niedrig', 'mittel', 'erhoeht', 'hoch'],
      valueLabels: {
        sehr_niedrig: 'Sehr niedrig',
        niedrig: 'Niedrig',
        mittel: 'Mittel',
        erhoeht: 'Erhöht',
        hoch: 'Hoch'
      },
      hint: 'Risiko von Mietausfällen oder Leerstand am Markt',
      domain: 'mietmarkt'
    }
  };

  /* v2500 · Baujahr und mittlere Wohnungsgroesse fuer den Zensus-Leerstand
     nach Klasse; die Zensus-Groessenklassen gelten JE WOHNUNG (v2162c). */
  var _bj = ((document.getElementById('baujahr') || {}).value || '').trim();
  var _eh = parseInt(((document.getElementById('einheiten') || {}).value || ''), 10);
  var ctx = {
    adresse: [str + ' ' + hnr, plz + ' ' + ort].map(function(s){return s.trim()}).filter(Boolean).join(', '),
    str: str, hnr: hnr, plz: plz, ort: ort,
    kaufpreis: _vN('kp') || null,
    wohnflaeche: wfl,
    nettokaltmiete: nkm,
    baujahr: /^\d{4}$/.test(_bj) ? _bj : null,
    wfl_je_wohnung: Math.round((_eh > 1 ? wfl / _eh : wfl) * 10) / 10
  };

  /* v2500 · ueber Auth.apiCall statt nacktem fetch: der zentrale
     401-Handler greift, und die Frist fuer /ai/ betraegt 120 s. */
  var _body = {
        fields: ['ds2_marktmiete', 'ds2_mietausfall'],
        fieldSpecs: fieldSpecs,
        context: ctx,
        /* v2500 · damit der Server den letzten Marktbericht DIESES Objekts findet */
        objId: (typeof window._currentObjKey === 'string' && window._currentObjKey) ? window._currentObjKey : null,
        userApiKey: userApiKey,
        aiOptions: {
          temperature: aiTemp,
          seed: aiSeed,
          tone: aiTone,
          riskBias: aiRiskBias,
          length: aiLength,
          detailLevel: aiDetailLevel,
          tonality: aiTonality,
          focusAreas: aiFocusAreas,
          customInstructions: aiCustomInstructions
        }
  };
  try {
    var data;
    if (window.Auth && typeof Auth.apiCall === 'function') {
      data = await Auth.apiCall('/ai/ds2-suggest', { method: 'POST', body: _body });
    } else {
      var res = await fetch('/api/v1/ai/ds2-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(_body)
      });
      try { data = await res.json(); } catch(e) { data = {}; }
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    }
    data = data || {};
    var belege = data.belege || null;

    var sugMarkt = (data.suggestions || {}).ds2_marktmiete || null;
    var sugAusfall = (data.suggestions || {}).ds2_mietausfall || null;

    var istQm = wfl > 0 ? (nkm / wfl) : 0;
    var marktVal = sugMarkt && sugMarkt.value ? parseFloat(String(sugMarkt.value).replace(',', '.')) : null;
    var ausfallVal = sugAusfall && sugAusfall.value ? sugAusfall.value : null;
    /* v3002 · der Abgleich mit dem Marktbericht (mb-abgleich.js) stellt die Recherche neben den Bericht */
    try { window._lastKiMiete = { key: window._currentObjKey || null, markt_qm: (marktVal != null && isFinite(marktVal)) ? marktVal : null, ausfall: ausfallVal, belege: belege, zeit: Date.now() };
          window.dispatchEvent(new CustomEvent('dp:ki-miete', { detail: {} })); } catch (e) {}

    var ausfallMap = {
      sehr_niedrig: { label: 'Sehr niedrig', col: '#3FA56C' },
      niedrig:      { label: 'Niedrig', col: '#3FA56C' },
      mittel:       { label: 'Mittel', col: '#C9A84C' },
      erhoeht:      { label: 'Erhöht', col: '#B8625C' },
      hoch:         { label: 'Hoch', col: '#B8625C' }
    };

    /* v1242c: eine Quelle statt zwei — die Modulfassung _kmEsc gilt auch
       fuer _renderQuellen und _renderSrcLink, die ausserhalb dieser
       Funktion stehen und die lokale nie gesehen haetten. */
    var _esc = _kmEsc;

    /* v3080 · eine Antwort oben, Werte als Zeilen, Einzelheiten zugeklappt (_kmUebersicht unten).
       Bis v3079 standen hier Marktmiete-Block, Vergleichstabelle und Risiko-Block untereinander. */
    var html = (marktVal != null || ausfallVal || belege)
      ? _kmUebersicht({ belege: belege, marktVal: marktVal, istQm: istQm, wfl: wfl, nkm: nkm, sugMarkt: sugMarkt, sugAusfall: sugAusfall, ausfallVal: ausfallVal })
      : '<div class="ki-miete-err">Keine Empfehlungen erhalten.</div>';
    void ausfallMap; void _esc;

    body.innerHTML = html;

  } catch (err) {
    body.innerHTML = '<div class="ki-miete-err">⚠ Fehler bei der Analyse: ' + (err.message || err) + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span data-ico="sparkles" data-ico-size="14"></span> Mietpreis recherchieren'; }
    if (typeof refreshDataIcos === 'function') setTimeout(refreshDataIcos, 10);
  }
}

/* ══ v2500 · MEHRERE VERGLEICHSWERTE NEBENEINANDER, MIT HERKUNFT ══════════
   Marcel am 20.10.2026: „Vielleicht holen wir uns auch mehrere
   Vergleichswerte, und fuer das Mietausfallrisiko auch. Da koennten wir den
   Zensus gegenueberstellen, wenn es passt."
   Die Werte kommen vom SERVER (mietBelegeService.js), nicht vom Modell:
   amtliche Vergleichsmiete, aktueller Marktdurchschnitt, Marktueblichkeits-
   band, Ist-Miete; beim Risiko der Zensus-Leerstand (Stichtag 15.05.2022)
   und der Bevoelkerungstrend. Fehlt ein Wert, steht der Weg dorthin da.
   Worauf die KI sich stuetzt (stuetzt_sich_auf), wird markiert. */
function _kmStil() {
  if (document.getElementById('km-vgl-stil')) return;
  var s = document.createElement('style'); s.id = 'km-vgl-stil';
  s.textContent = [
    '.km-vgl{margin-top:10px;border-top:1px solid var(--border,rgba(0,0,0,.12));padding-top:8px}',
    '.km-vgl-k{font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin-bottom:6px}',
    '.km-vgl-z{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;padding:5px 0;border-bottom:1px dashed var(--border,rgba(0,0,0,.1));font:400 12.5px/1.45 Inter,system-ui,sans-serif}',
    '.km-vgl-z:last-child{border-bottom:0}',
    '.km-vgl-z b{white-space:nowrap;text-align:right}',
    '.km-vgl-h{grid-column:1/-1;font-size:11px;opacity:.68}',
    '.km-vgl-z.km-fehlt b{opacity:.55;font-weight:500}',
    '.km-vgl-tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font:600 9.5px/1.4 "JetBrains Mono",monospace;letter-spacing:.06em;border:1px solid var(--border,rgba(0,0,0,.15));opacity:.85;vertical-align:1px}',
    '.km-vgl-tag.km-genutzt{border-color:var(--wl-c9a84c,#C9A84C)}',
    '.km-vgl-text{font-style:normal}'
  ].join('');
  document.head.appendChild(s);
}
function _kmQm(n) { return (n == null || !isFinite(n)) ? null : Number(n).toFixed(2).replace('.', ',') + ' €/m²'; }
function _kmPct(n, d) { return (n == null || !isFinite(n)) ? null : Number(n).toFixed(d == null ? 1 : d).replace('.', ',') + ' %'; }
function _kmDat(s) { return s ? String(s).slice(8, 10) + '.' + String(s).slice(5, 7) + '.' + String(s).slice(0, 4) : null; }
function _kmZeile(titel, wert, hinweis, tag, genutzt, fehlt) {
  return '<div class="km-vgl-z' + (fehlt ? ' km-fehlt' : '') + '"><span>' + _kmEsc(titel)
    + (tag ? '<span class="km-vgl-tag' + (genutzt ? ' km-genutzt' : '') + '" title="' + (genutzt ? 'Die KI stützt sich darauf' : 'Herkunft') + '">' + _kmEsc(tag) + (genutzt ? ' ✓' : '') + '</span>' : '')
    + '</span><b>' + _kmEsc(wert) + '</b>'
    + (hinweis ? '<span class="km-vgl-h">' + _kmEsc(hinweis) + '</span>' : '') + '</div>';
}
function _kmAbw(w, ref) {
  if (w == null || ref == null || !(ref > 0)) return '';
  var p = (w / ref - 1) * 100;
  return ' (' + (p >= 0 ? '+' : '') + p.toFixed(0) + ' % zur Ist-Miete)';
}
function _kmVergleichHtml(b, kiWert, istQm, sug) {
  if (!b) return '';
  _kmStil();
  var g = (sug && Array.isArray(sug.stuetzt_sich_auf)) ? sug.stuetzt_sich_auf : [];
  var ist = istQm > 0 ? istQm : null;
  var o = '<div class="km-vgl"><div class="km-vgl-k">Vergleichswerte · €/m² kalt</div>';
  var a = b.amtlich || {};
  if (!a.fehlt && a.wert_qm != null) {
    o += _kmZeile('Amtliche Vergleichsmiete', _kmQm(a.wert_qm) + _kmAbw(a.wert_qm, ist),
      'Mietpreisübersicht des Gutachterausschusses' + (a.quelle ? ' · ' + a.quelle : '') + (a.stand ? ' · Marktbericht vom ' + _kmDat(a.stand) : '')
        + ' · bildet weitgehend Bestandsmieten ab' + (a.ausserhalb && a.hinweis ? ' · ' + a.hinweis : ''),
      'amtlich', g.indexOf('amtliche_vergleichsmiete') >= 0);
  } else {
    o += _kmZeile('Amtliche Vergleichsmiete', 'liegt nicht vor', (a.hinweis ? a.hinweis + ' ' : '') + (a.weg || ''), 'amtlich', false, true);
  }
  var m = b.markt || {};
  if (!m.fehlt && m.wert_qm != null) {
    o += _kmZeile('Aktueller Marktdurchschnitt', _kmQm(m.wert_qm) + _kmAbw(m.wert_qm, ist),
      'Angebotsmieten, Median' + (m.q25_qm != null && m.q75_qm != null ? ', mittlere Hälfte ' + _kmQm(m.q25_qm) + ' bis ' + _kmQm(m.q75_qm) : '')
        + (m.anzahl != null ? ' · ' + m.anzahl + ' Angebote' : '') + (m.umkreis_km != null ? ' im Umkreis von ' + String(m.umkreis_km).replace('.', ',') + ' km' : '')
        + (m.stand ? ' · Marktbericht vom ' + _kmDat(m.stand) : '') + ' · Angebote, keine Abschlüsse; ein Abschlag für Mieten ist nicht gemessen',
      'Markt', g.indexOf('marktdurchschnitt') >= 0);
  } else {
    o += _kmZeile('Aktueller Marktdurchschnitt', 'liegt nicht vor', m.weg || '', 'Markt', false, true);
  }
  if (b.band) {
    o += _kmZeile('Marktüblichkeitsband', _kmQm(b.band.unten_qm) + ' – ' + _kmQm(b.band.oben_qm),
      'Wertermittlung im Marktbericht: ' + (b.band.regel || 'Anker der Marktüblichkeit ± 20 %')   /* v3002: stand „× 0,7 bis × 1,3“, seit v2600 Anker ± 20 % */, 'Wertermittlung', g.indexOf('marktueblichkeitsband') >= 0);
  }
  if (b.ertrag && b.ertrag.wert_qm != null) {
    o += _kmZeile('Im Ertragswert angesetzt', _kmQm(b.ertrag.wert_qm), b.ertrag.quelle || '', 'Wertermittlung', g.indexOf('ertragswert_miete') >= 0);
  }
  if (kiWert != null) o += _kmZeile('Pilot-Recherche', _kmQm(kiWert) + _kmAbw(kiWert, ist), 'KI-Schätzung mit Websuche, Quellen oben', 'KI', false);
  if (ist != null) o += _kmZeile('Deine Ist-Miete', _kmQm(ist), 'Nettokaltmiete durch Wohnfläche', 'deine Angabe', g.indexOf('ist_miete') >= 0);
  return o + '</div>';
}
function _kmRisikoHtml(b, kiWert, sug) {
  if (!b) return '';
  _kmStil();
  var g = (sug && Array.isArray(sug.stuetzt_sich_auf)) ? sug.stuetzt_sich_auf : [];
  var WORT = { sehr_niedrig: 'Sehr niedrig', niedrig: 'Niedrig', mittel: 'Mittel', erhoeht: 'Erhöht', hoch: 'Hoch' };
  var o = '<div class="km-vgl"><div class="km-vgl-k">Belegte Daten zum Risiko</div>';
  var lz = b.leerstand || {};
  if (!lz.fehlt) {
    var h = (lz.gesamt_pct != null ? 'Gesamtleerstand ' + _kmPct(lz.gesamt_pct) : '')
      + (lz.dauerleer_anteil_pct != null ? ', davon ' + _kmPct(lz.dauerleer_anteil_pct) + ' seit über einem Jahr leer (Dauerleerstand, kein Mietausfall)' : '')
      + (lz.nach_baujahr ? ' · Baujahr ' + lz.nach_baujahr.klasse + ': ' + _kmPct(lz.nach_baujahr.pct) + ' (' + lz.nach_baujahr.ebene + ')' : '')
      + (lz.nach_groesse ? ' · Größe ' + lz.nach_groesse.klasse + ': ' + _kmPct(lz.nach_groesse.pct) + ' (' + lz.nach_groesse.ebene + ')' : '')
      + ' · Marktaktiv = leere Wohnungen, die kurzfristig vermietbar wären. Lage der ' + lz.ebene + ', nicht des Objekts. Einen jüngeren amtlichen Leerstand je Gemeinde gibt es nicht. '
      + (lz.quelle || '');
    o += _kmZeile('Leerstand laut Zensus 2022 (Stichtag 15.05.2022) · ' + lz.ebene + ' ' + (lz.name || ''),
      lz.marktaktiv_pct != null ? 'marktaktiv ' + _kmPct(lz.marktaktiv_pct) : 'nicht ausgewiesen', h, 'amtlich · 2022', g.indexOf('leerstand_zensus') >= 0);
    if (lz.anhalt) {
      var abw = kiWert && kiWert !== lz.anhalt.wert;
      o += _kmZeile('Anhalt aus dem Zensus-Leerstand', lz.anhalt.wort,
        'Stufen: ' + (lz.schwellen || '') + (kiWert ? (abw ? ' · Die Pilot-Einstufung „' + (WORT[kiWert] || kiWert) + '“ weicht ab — begründbar z. B. durch Mieterstruktur, Objektzustand oder Entwicklung seit 2022.' : ' · Passt zur Pilot-Einstufung.') : ''),
        'Vorschlag', false);
      o += '<div class="ki-miete-actions"><button type="button" class="btn btn-outline btn-sm" onclick="kiMieteApplyAusfall(\'' + _kmEsc(lz.anhalt.wert) + '\')">Zensus-Anhalt „' + _kmEsc(lz.anhalt.wort) + '“ übernehmen</button></div>';
    }
  } else {
    o += _kmZeile('Leerstand laut Zensus 2022', 'liegt nicht vor', lz.weg || '', 'amtlich · 2022', false, true);
  }
  var bv = b.bevoelkerung || {};
  if (!bv.fehlt && bv.trend_pct_pa != null) {
    o += _kmZeile('Bevölkerungsentwicklung (Kreis)', (bv.trend_pct_pa >= 0 ? '+' : '') + _kmPct(bv.trend_pct_pa, 2) + ' pro Jahr',
      (bv.stand ? 'Stand ' + bv.stand + ' · ' : '') + (bv.quelle || ''), 'amtlich', g.indexOf('bevoelkerung') >= 0);
  } else {
    o += _kmZeile('Bevölkerungsentwicklung (Kreis)', 'liegt nicht vor', bv.weg || '', 'amtlich', false, true);
  }
  if (b.haushalte && b.haushalte.fehlt) o += _kmZeile('Haushaltsentwicklung', 'liegt nicht vor', b.haushalte.weg || '', '', false, true);
  if (b.angebotsdauer_miete && b.angebotsdauer_miete.fehlt) o += _kmZeile('Angebotsdauer der Mietangebote', 'liegt nicht vor', b.angebotsdauer_miete.weg || '', '', false, true);
  return o + '</div>';
}

/* ── v1242 · Mehrere Quellen statt einer ──────────────────────────────────
   Marcels Vorgabe vom 07.09.2026: „die KI anfrage duerfte mehrere quellen
   ausgeben und moeglichst immer bei der gemeinde oder stadt nachschauen ob
   es da einen mietspiegel gibt, einen offiziellen."

   Der Tester hatte bemaengelt, er sehe „nur den Mietspiegel" als Quelle.
   Gemessen: es gab tatsaechlich nur eine — der Prompt verlangte genau eine
   (`source`, 80 Zeichen). Seit v1242 liefert das Backend `sources` als
   Liste; `source` bleibt als Kurzname erhalten.

   Ein amtlicher Mietspiegel wird hervorgehoben: er ist die belastbarste
   Quelle fuer eine Marktmiete, und der Nutzer soll auf einen Blick sehen,
   ob es einen gab. */
/* v1242c · Hervorgehoben wird, was AMTLICH ist — nicht, was "Mietspiegel"
   heisst. Der Gegenlauf gegen Huellhorst lieferte eine Quelle namens
   "Mietspiegel Huellhorst 2026" von immoportal.com, waehrend das reasoning
   im selben Atemzug sagte, es gebe keinen amtlichen. Wer auf das Wort
   hervorhebt, macht daraus optisch den amtlichen Mietspiegel. Das Backend
   entscheidet die Frage (Feld `amtlich`, Portal-Domains koennen es nicht
   tragen); hier wird sie nur noch angezeigt. */
function _renderQuellen(sug) {
  if (!sug) return '';
  var liste = Array.isArray(sug.sources) ? sug.sources : [];
  if (!liste.length && sug.source) liste = [{ label: sug.source }];
  if (!liste.length) return '';
  var teile = liste.map(function (q) {
    var s = _renderSrcLink(typeof q === 'object' ? q : { label: q });
    return (q && q.amtlich) ? '<b title="Amtliche Quelle">' + s + '</b>' : s;
  });
  var wort = liste.length > 1 ? 'Quellen' : 'Quelle';
  return '<div class="ki-miete-source">📎 ' + wort + ': ' + teile.join(' · ') + '</div>';
}

/* Labels und URLs kommen aus der KI-Antwort und landen in innerHTML —
   beide werden maskiert. Die URL zusaetzlich auf http(s) geprueft, damit
   kein javascript:-Schema in ein href geraet. */
function _renderSrcLink(src) {
  if (!src) return '';
  if (typeof src === 'string') src = { label: src };
  var label = String(src.label || src.title || src.name || src.url || 'Quelle');
  var url = String(src.url || src.href || '');
  if (url && !/^https?:\/\//i.test(url)) url = '';
  if (!url && /^https?:\/\//i.test(label)) url = label;
  if (url) {
    return '<a href="' + _kmEsc(url) + '" target="_blank" rel="noopener noreferrer">' + _kmEsc(label) + ' ↗</a>';
  }
  return _kmEsc(label);
}

function kiMieteApplyMarktmiete(value) {
  var el = document.getElementById('ds2_marktmiete');
  if (el) {
    el.value = value.toFixed(2).replace('.', ',');
    if (typeof dpUpdateAll === 'function') dpUpdateAll();
    else if (typeof renderDealScore2 === 'function') renderDealScore2();
    if (typeof toast === 'function') toast('✓ Marktmiete ' + value.toFixed(2).replace('.', ',') + ' €/m² übernommen');
  }
}

function kiMieteApplyNkm(value) {
  var el = document.getElementById('nkm');
  if (el) {
    el.value = String(value);
    if (typeof calc === 'function') calc();
    if (typeof toast === 'function') toast('✓ Nettokaltmiete ' + value.toLocaleString('de-DE') + ' € übernommen');
  }
}

function kiMieteApplyAusfall(value) {
  var el = document.getElementById('ds2_mietausfall');
  if (el) {
    el.value = value;
    if (typeof dpUpdateAll === 'function') dpUpdateAll();
    else if (typeof renderDealScore2 === 'function') renderDealScore2();
    var labelMap = {
      sehr_niedrig: 'Sehr niedrig', niedrig: 'Niedrig', mittel: 'Mittel', erhoeht: 'Erhöht', hoch: 'Hoch'
    };
    if (typeof toast === 'function') toast('✓ Mietausfall-Risiko: ' + (labelMap[value] || value));
  }
}

window.runKiMiete = runKiMiete;
window.kiMieteApplyMarktmiete = kiMieteApplyMarktmiete;
window.kiMieteApplyNkm = kiMieteApplyNkm;
window.kiMieteApplyAusfall = kiMieteApplyAusfall;

/* ══ v3080 · ÜBERSICHT STATT ZAHLENWAND ═══════════════════════════════════
   Marcel 02.11.2026: „brauchen wir überhaupt die ganzen Werte? Was muss der
   Kunde wissen? Ziel ist eine plausible Recherche, welche Miete ich
   tatsächlich ansetzen kann … orientieren, wie wir das unter Einheiten und
   Zielmiete gemacht haben."
   Oben EINE Antwort: die ansetzbare Miete mit Begründung in einem Satz.
   Darunter eine Skala mit dem marktüblichen Band und den Vergleichswerten,
   dann die Werte als Zeilen im Stil der Mietleiter (Punkt · Titel · Wert ·
   Übernehmen). Alles Weitere (Begründung der KI, Quellen, Zensus-Details)
   steht zugeklappt unter „Woher die Zahlen kommen".
   Gerechnet wird nichts Neues: der Ansatz ist der Wert, den der Ertragswert
   ansetzt (belege.ertrag); fehlt er, die Regel des Ertragswerts — Ist-Miete,
   solange sie im Band liegt, sonst die obere Kante. Ohne Band (kein
   Marktbericht) wird nur eingeordnet, nicht gekappt. */
function _kmUStil() {
  if (document.getElementById('kmu-stil')) return;
  var s = document.createElement('style'); s.id = 'kmu-stil';
  s.textContent = [
    '.kmu{display:flex;flex-direction:column;gap:10px}',
    '.kmu-urteil{border:1px solid #EFE7D6;border-left:4px solid #3FA56C;border-radius:10px;padding:10px 14px;background:#fff;display:flex;flex-direction:column;gap:2px}',
    '.kmu-urteil.kmu-hoch{border-left-color:#B8625C}.kmu-urteil.kmu-luft{border-left-color:#3d6fa8}.kmu-urteil.kmu-offen{border-left-color:#8A8272}',
    '.kmu-t{font:600 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370}',
    '.kmu-v{font:600 20px/1.25 "Space Grotesk",sans-serif;color:#2A2727}',
    '.kmu-v small{font:500 13px Inter,sans-serif;color:#7A7370;margin-left:6px}',
    '.kmu-u{font-size:12.5px;color:#4A4542;line-height:1.45}',
    '.kmu-skala{position:relative;height:44px;margin:4px 6px 0;border-radius:6px}',
    '.kmu-linie{position:absolute;left:0;right:0;top:20px;height:4px;border-radius:2px;background:#EFE7D6}',
    '.kmu-band{position:absolute;top:14px;height:16px;border-radius:5px;background:color-mix(in srgb,#3FA56C 22%,transparent);border:1px solid color-mix(in srgb,#3FA56C 55%,transparent)}',
    '.kmu-pkt{position:absolute;top:15px;width:14px;height:14px;margin-left:-7px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.18)}',
    '.kmu-pkt.kmu-ist{width:4px;height:28px;top:8px;margin-left:-2px;border-radius:2px;border:0;box-shadow:none;background:#2A2727}',
    '.kmu-ach{position:absolute;top:32px;font:500 10px "JetBrains Mono",monospace;color:#8A8272;transform:translateX(-50%);white-space:nowrap}',
    '.kmu-p-ist{background:#2A2727}.kmu-p-markt{background:#3d6fa8}.kmu-p-pilot{background:var(--wl-c9a84c,#C9A84C)}.kmu-p-amtlich{background:#2f7d55}',
    /* Zeilen im Stil der Mietleiter (potenzial.js leiterStil, dort privat) */
    '.kmu .dp-ml{display:flex;flex-direction:column;border:1px solid #EFE7D6;border-radius:10px;padding:2px 12px;background:#fff}',
    '.kmu .dp-ml-z{display:grid;gap:10px;align-items:center;padding:8px 0;border-top:1px solid #F1ECE1}',
    '.kmu .dp-ml-z:first-child{border-top:none}',
    '.kmu .dp-ml-p{width:10px;height:10px;border-radius:50%;margin:0 0 0 4px}',
    '.kmu .dp-ml-txt{display:flex;flex-direction:column;gap:1px;min-width:0}',
    '.kmu .dp-ml-t{font:600 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#7A7370}',
    '.kmu .dp-ml-t i{font:400 10.5px Inter,sans-serif;letter-spacing:0;text-transform:none;color:#8A8272;font-style:normal}',
    '.kmu .dp-ml-v{font:600 14px/1.35 "Space Grotesk",sans-serif;color:#2A2727}',
    '.kmu .dp-ml-k{border:1px solid var(--wl-c9a84c, #C9A84C);background:#fff;color:#2A2727;border-radius:7px;padding:5px 9px;font:500 12px Inter,sans-serif;cursor:pointer;white-space:nowrap}',
    '.kmu .dp-ml-k:hover{background:color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 12%,#fff)}',
    '.kmu .dp-ml-z{grid-template-columns:18px 1fr auto auto}',
    '.kmu .dp-ml-v small{font:500 11.5px Inter,sans-serif;color:#7A7370;margin-left:4px}',
    '.kmu-k-voll{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#050505;border-color:transparent}',
    '.kmu-risk{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;border:1px solid #EFE7D6;border-radius:10px;padding:8px 12px;background:#fff}',
    '.kmu-risk .kmu-u{grid-column:1/2}',
    '.kmu-mehr{border:1px solid #EFE7D6;border-radius:10px;padding:6px 12px;background:#fff}',
    '.kmu-mehr>summary{cursor:pointer;font:600 10.5px/1.6 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370}',
    '.kmu-fuss{font-size:11px;color:#8A8272;line-height:1.45;margin:0}',
    '@media (max-width:640px){.kmu .dp-ml-z{grid-template-columns:18px 1fr auto}.kmu .dp-ml-z .dp-ml-k{grid-column:2/4;justify-self:start}.kmu-risk{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(s);
}
function _kmEur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
function _kmQmK(n) { return Number(n).toFixed(2).replace('.', ',') + ' €/m²'; }
function _kmUebersicht(o) {
  _kmUStil();
  var b = o.belege || {}, ist = o.istQm > 0 ? o.istQm : null, wfl = o.wfl;
  var band = (b.band && b.band.unten_qm > 0 && b.band.oben_qm > 0) ? { lo: b.band.unten_qm, hi: b.band.oben_qm } : null;
  var m = (b.markt && !b.markt.fehlt && b.markt.wert_qm != null) ? b.markt : null;
  var a = (b.amtlich && !b.amtlich.fehlt && b.amtlich.wert_qm != null) ? b.amtlich : null;
  var pilot = (o.marktVal != null && isFinite(o.marktVal)) ? o.marktVal : null;

  /* ── der Ansatz ── */
  var ansatz = null, art = 'offen', satz = '';
  var bandTxt = band ? 'marktüblichen Band (' + _kmQmK(band.lo).replace(' €/m²', '') + ' – ' + _kmQmK(band.hi) + ')' : '';
  if (b.ertrag && b.ertrag.wert_qm != null) ansatz = b.ertrag.wert_qm;
  if (ist != null && band) {
    if (ist > band.hi + 0.005) { art = 'hoch'; if (ansatz == null) ansatz = band.hi;
      satz = 'Deine Ist-Miete liegt über dem ' + bandTxt + '. Dauerhaft ansetzbar ist höchstens die obere Kante — bei einer Neuvermietung trägt der Markt die heutige Miete voraussichtlich nicht.'; }
    else if (ist < band.lo - 0.005) { art = 'luft'; if (ansatz == null) ansatz = ist;
      satz = 'Deine Ist-Miete liegt unter dem ' + bandTxt + ' — angesetzt wird, was vereinbart ist. Was du wann erhöhen darfst, zeigt die Mietleiter unter Einheiten bzw. Zielmiete.'; }
    else { art = 'ok'; if (ansatz == null) ansatz = ist;
      satz = 'Deine Ist-Miete liegt im ' + bandTxt + ' und ist damit plausibel. So setzt sie auch der Ertragswert an.'; }
  } else if (ist != null && m && m.q25_qm != null && m.q75_qm != null) {
    ansatz = ansatz != null ? ansatz : ist;
    if (ist > m.q75_qm) { art = 'hoch'; satz = 'Deine Ist-Miete liegt über drei Vierteln der aktuellen Angebote in der Umgebung (mittlere Hälfte ' + _kmQmK(m.q25_qm).replace(' €/m²', '') + ' – ' + _kmQmK(m.q75_qm) + '). Prüfe, ob Ausstattung und Zustand das tragen.'; }
    else if (ist < m.q25_qm) { art = 'luft'; satz = 'Deine Ist-Miete liegt unter den meisten Angeboten der Umgebung — Luft nach oben. Was zulässig ist, zeigt die Mietleiter.'; }
    else { art = 'ok'; satz = 'Deine Ist-Miete liegt in der mittleren Hälfte der Angebote der Umgebung und ist damit plausibel.'; }
    satz += ' Ein marktübliches Band gibt es erst mit dem Marktbericht.';
  } else if (ist == null && band) {
    art = 'offen'; ansatz = (band.lo + band.hi) / 2;
    satz = 'Noch keine Ist-Miete eingetragen. Für die Planung ist der Anker der Marktüblichkeit (Mitte des Bands ' + _kmQmK(band.lo).replace(' €/m²', '') + ' – ' + _kmQmK(band.hi) + ') ein belastbarer Ansatz.';
  } else if (ist != null) {
    art = 'offen'; ansatz = ist;
    satz = 'Für eine belastbare Einordnung fehlen Vergleichswerte — mit dem Marktbericht kommen Marktdurchschnitt und marktübliches Band dazu.';
  } else {
    satz = 'Trag im Reiter Miete die Nettokaltmiete ein oder ruf den Marktbericht ab — dann ordnet die Analyse ein.';
  }

  var h = '<div class="kmu">';
  h += '<div class="kmu-urteil kmu-' + art + '"><span class="kmu-t">' + (ist == null && ansatz != null ? 'Ansatz für die Planung' : 'Ansetzbare Miete') + '</span>'
    + (ansatz != null ? '<b class="kmu-v">' + _kmQmK(ansatz) + (wfl > 0 ? '<small>' + _kmEur(ansatz * wfl) + ' / Monat</small>' : '') + '</b>' : '')
    + '<span class="kmu-u">' + _kmEsc(satz) + '</span></div>';

  /* ── Werte als Zeilen (Stil Mietleiter), mit Skala ── */
  var zeilen = [];
  if (ist != null) zeilen.push({ c: 'ist', t: 'Deine Ist-Miete', h: 'Nettokaltmiete durch Wohnfläche', v: ist });
  if (a) zeilen.push({ c: 'amtlich', t: 'Amtliche Vergleichsmiete', h: 'Mietpreisübersicht des Gutachterausschusses · eher Bestandsmieten', v: a.wert_qm });
  if (m) zeilen.push({ c: 'markt', t: 'Marktdurchschnitt', h: 'aktuelle Angebote der Umgebung (Median)' + (m.anzahl != null ? ', ' + m.anzahl + ' Angebote' : ''), v: m.wert_qm });
  if (pilot != null) zeilen.push({ c: 'pilot', t: 'Pilot-Recherche', h: 'Mietspiegel und Webquellen, Schätzung', v: pilot });
  /* Vorschlag für das Feld Marktmiete: amtlich > Marktdurchschnitt > Pilot */
  var vorschlag = a ? 'amtlich' : m ? 'markt' : pilot != null ? 'pilot' : null;

  if (zeilen.length) {
    var werte = zeilen.map(function (z) { return z.v; }); if (band) werte.push(band.lo, band.hi);
    var lo = Math.min.apply(null, werte), hi = Math.max.apply(null, werte), sp = (hi - lo) || 1;
    lo -= sp * 0.12; hi += sp * 0.12; sp = hi - lo;
    var x = function (v) { return ((v - lo) / sp * 100).toFixed(1) + '%'; };
    var sk = '<div class="kmu-skala" aria-hidden="true"><span class="kmu-linie"></span>';
    if (band) sk += '<span class="kmu-band" style="left:' + x(band.lo) + ';width:' + ((band.hi - band.lo) / sp * 100).toFixed(1) + '%" title="marktübliches Band"></span>'
      + '<span class="kmu-ach" style="left:' + x(band.lo) + '">' + _kmQmK(band.lo).replace(' €/m²', '') + '</span><span class="kmu-ach" style="left:' + x(band.hi) + '">' + _kmQmK(band.hi).replace(' €/m²', '') + '</span>';
    zeilen.forEach(function (z) { if (z.c !== 'ist') sk += '<span class="kmu-pkt kmu-p-' + z.c + '" style="left:' + x(z.v) + '" title="' + _kmEsc(z.t) + ' ' + _kmQmK(z.v) + '"></span>'; });
    if (ist != null) sk += '<span class="kmu-pkt kmu-ist" style="left:' + x(ist) + '" title="Deine Ist-Miete ' + _kmQmK(ist) + '"></span>';
    h += sk + '</div>';

    h += '<div class="dp-ml">' + zeilen.map(function (z) {
      var abw = (ist != null && z.c !== 'ist') ? ' <small>' + ((z.v / ist - 1) * 100 >= 0 ? '+' : '') + Math.round((z.v / ist - 1) * 100) + ' % zur Ist-Miete</small>' : '';
      var knopf = z.c === 'ist' ? '<span></span>'
        : '<button type="button" class="dp-ml-k' + (z.c === vorschlag ? ' kmu-k-voll' : '') + '" onclick="kiMieteApplyMarktmiete(' + Number(z.v).toFixed(2) + ')" title="In das Feld Marktmiete (€/m²) übernehmen — es fließt in den Investor Deal Score">als Marktmiete</button>';
      return '<div class="dp-ml-z"><span class="dp-ml-p kmu-p-' + z.c + '"></span><span class="dp-ml-txt"><span class="dp-ml-t">' + _kmEsc(z.t) + ' <i>' + _kmEsc(z.h) + '</i></span>'
        + '<span class="dp-ml-v">' + _kmQmK(z.v) + abw + '</span></span><span></span>' + knopf + '</div>';
    }).join('') + '</div>';
  }

  /* ── Mietausfall in einer Zeile ── */
  var WORT = { sehr_niedrig: 'Sehr niedrig', niedrig: 'Niedrig', mittel: 'Mittel', erhoeht: 'Erhöht', hoch: 'Hoch' };
  var lz = (b.leerstand && !b.leerstand.fehlt) ? b.leerstand : null, bv = (b.bevoelkerung && !b.bevoelkerung.fehlt) ? b.bevoelkerung : null;
  var risiko = o.ausfallVal || (lz && lz.anhalt ? lz.anhalt.wert : null);
  if (risiko && WORT[risiko]) {
    var bel = [];
    if (lz && lz.marktaktiv_pct != null) bel.push('Leerstand ' + String(Number(lz.marktaktiv_pct).toFixed(1)).replace('.', ',') + ' % (Zensus 2022, ' + _kmEsc(lz.name || lz.ebene || '') + ')');
    if (bv && bv.trend_pct_pa != null) bel.push('Bevölkerung ' + (bv.trend_pct_pa >= 0 ? '+' : '') + String(Number(bv.trend_pct_pa).toFixed(2)).replace('.', ',') + ' % pro Jahr');
    h += '<div class="kmu-risk"><span><span class="kmu-t">Mietausfall-Risiko</span> <b style="font:600 14px Space Grotesk,sans-serif;color:' + (/erhoeht|hoch/.test(risiko) ? '#B8625C' : risiko === 'mittel' ? '#b8932f' : '#2f7d55') + '">' + WORT[risiko] + '</b></span>'
      + '<button type="button" class="dp-ml-k" onclick="kiMieteApplyAusfall(\'' + _kmEsc(risiko) + '\')">übernehmen</button>'
      + (bel.length ? '<span class="kmu-u">' + bel.join(' · ') + '</span>' : '') + '</div>';
  }

  /* ── alles Weitere zugeklappt ── */
  var mehr = '';
  if (o.sugMarkt && o.sugMarkt.reasoning) mehr += '<div class="ki-miete-reasoning">' + _kmEsc(o.sugMarkt.reasoning) + '</div>';
  mehr += _renderQuellen(o.sugMarkt);
  if (o.sugMarkt && o.sugMarkt.vergleich_text) mehr += '<div class="ki-miete-reasoning km-vgl-text">' + _kmEsc(o.sugMarkt.vergleich_text) + '</div>';
  if (o.belege) mehr += _kmVergleichHtml(o.belege, pilot, o.istQm, o.sugMarkt);
  if (o.sugAusfall && o.sugAusfall.reasoning) mehr += '<div class="ki-miete-reasoning">' + _kmEsc(o.sugAusfall.reasoning) + '</div>';
  if (o.belege) mehr += _kmRisikoHtml(o.belege, o.ausfallVal, o.sugAusfall);
  if (mehr) h += '<details class="kmu-mehr"><summary>Woher die Zahlen kommen</summary>' + mehr + '</details>';

  h += '<p class="kmu-fuss">Die Pilot-Recherche ist eine Schätzung; Marktdurchschnitt und Band stammen aus dem Marktbericht und tragen dort ihren Stand.</p>';
  return h + '</div>';
}
