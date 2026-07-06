// app.js — Dashboard-Logik (Vanilla JS, kein Build-Step; passt zu DealPilot).
const API = '/api/v1/marktbericht';
let map, marker, compLayer, chart;

const $ = (id) => document.getElementById(id);
const fmt = (n, s = '') => (n == null || isNaN(n) ? '–' : new Intl.NumberFormat('de-DE').format(n) + s);

// Health
fetch(API + '/health').then(r => r.json()).then(h => {
  $('healthPill').textContent = h.db ? 'Bereit' : 'Eingeschränkt'; /* v564-chips-progress */
  renderChips(h);
}).catch(() => { $('healthPill').textContent = 'Backend nicht erreichbar'; });

function renderChips(h) {
  /* v564-chips-progress: Anbieter-Chips bewusst ausgeblendet (keine Quellen-Offenlegung). */
  var el = $('srcChips'); if (el) el.innerHTML = '';
}

$('goBtn').addEventListener('click', generate);
// Replay: gespeicherten Bericht laden (keine API-Kosten) – fürs Weiterentwickeln/Designen.
$('replayBtn').addEventListener('click', async () => {
  const btn = $('replayBtn');
  $('errBox').classList.add('hide');
  btn.disabled = true; btn.textContent = '↺ lade…';
  try {
    const res = await fetch(API + '/reports/replay');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kein gespeicherter Bericht');
    render(data);
  } catch (err) {
    $('errBox').textContent = '✗ ' + err.message; $('errBox').classList.remove('hide');
  } finally {
    btn.disabled = false; btn.textContent = '↺ Letzten Bericht laden (gratis, Demo)';
  }
});

async function generate() {
  /* v647-cost: Kostenhinweis vor dem kostenpflichtigen Abruf */
  if (!window.confirm('Marktbericht jetzt erstellen?\n\nKosten: 5 L Kerosin – nur wenn ein Marktwert ermittelt wird. Liegen keine Marktdaten vor, wird nichts abgebucht.')) return; /* v654-cost-text */
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} /* v569-appbeh scroll */
  const btn = $('goBtn');
  $('errBox').classList.add('hide');
  const _sig = $('loadSignal'); if (_sig) _sig.classList.add('hide');
  btn.style.boxShadow = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> erstelle…';

  const body = {
    address: $('address').value,
    property_type: $('ptype').value,
    usage_type: $('usage').value,
    living_area: parseFloat($('area').value) || null,
    rooms: parseFloat($('rooms').value) || null,
    build_year: parseInt($('year').value) || null,
    floor: parseInt($('floor').value),
    condition: $('cond').value,
    quality: $('quality') ? $('quality').value : null,
    modernization: $('modern') ? $('modern').value : null,
    modernization_year: $('modyear') ? (parseInt($('modyear').value) || null) : null,
    energy_class: $('energy').value,
    bathrooms: $('baths') ? (parseFloat($('baths').value) || null) : null,
    balcony_area: $('balcony') ? (parseFloat($('balcony').value) || null) : null,
    garden_area: $('garden') ? (parseFloat($('garden').value) || null) : null,
    plot_area: $('plot') ? (parseFloat($('plot').value) || null) : null,
    units: $('units') ? (parseInt($('units').value, 10) || null) : null,
    elevator: $('elevator') ? $('elevator').checked : false,
    garages: $('garages') ? (parseFloat($('garages').value) || null) : null,
    outdoor_parking: $('outdoor') ? (parseFloat($('outdoor').value) || null) : null,
    purchase_price: parseFloat($('price').value) || null,
    monthly_net_rent: parseFloat($('rent').value) || null,
    fast: $('fastMode') ? $('fastMode').checked : false,
    /* v736-mb-eq: 8 Ausstattungsfelder -> Keys wie DealPilotObjectMapper (v727) */
    heating: $('eq_heating') ? ($('eq_heating').value || null) : null,
    windows: $('eq_windows') ? ($('eq_windows').value || null) : null,
    floor_covering: $('eq_floor') ? ($('eq_floor').value || null) : null,
    bath: $('eq_bath') ? ($('eq_bath').value || null) : null,
    guest_wc: $('eq_guest_wc') ? ($('eq_guest_wc').value || null) : null,
    store_room: $('eq_store_room') ? ($('eq_store_room').value || null) : null,
    exterior_walls: $('eq_walls') ? ($('eq_walls').value || null) : null,
    roof: $('eq_roof') ? ($('eq_roof').value || null) : null,
  };

  const prog = $('genProgress');
  const steps = [];
  const pushStep = (msg) => {
    steps.push(msg);
    if (!prog) return;
    prog.classList.remove('hide');
    var bar = document.getElementById('genProgBar');
    if (bar) { /* v570-prog: sanfte, monotone Kurve (kein Sprung) */
      var _frac = steps.length / EXPECTED_STEPS;
      var _pct = Math.round((1 - Math.pow(1 - Math.min(1, _frac), 1.7)) * 92) + 4;
      var _cur = parseFloat(bar.style.width) || 0;
      bar.style.width = Math.max(_cur, Math.min(96, _pct)) + '%'; }
    var stepsBox = document.getElementById('genProgSteps') || prog;
    stepsBox.innerHTML = steps.slice(-6).map((s, i, arr) => {
      const isLast = i === arr.length - 1;
      const mark = isLast
        ? '<span class="spin" style="width:11px;height:11px;"></span>'
        : '<span style="color:#3FA56C;">✓</span>';
      const col = isLast ? '#C9A84C' : '#7a7a83';
      return `<div style="font-size:12px;color:${col};padding:2px 0;display:flex;gap:7px;align-items:center;">${mark}<span>${s}</span></div>`;
    }).join('');
  };
  // v564-chips-progress: Progress in den Ergebnis-Bereich schieben + Progressbar.
  if (prog) {
    try {
      var rb = $('resultBody'), ph = $('placeholder');
      if (ph) ph.classList.add('hide');
      if (rb) { rb.classList.remove('hide'); if (prog.parentNode !== rb) rb.insertBefore(prog, rb.firstChild); }
    } catch (e) {}
    prog.classList.remove('hide');
    prog.innerHTML = '<div style="height:8px;background:#16161b;border-radius:999px;overflow:hidden;margin-bottom:12px;box-shadow:inset 0 1px 3px rgba(0,0,0,.4);"><div id="genProgBar" style="height:100%;width:4%;background:linear-gradient(90deg,#bd9a3e,#C9A84C 50%,#E8CC7A);border-radius:999px;transition:width .65s cubic-bezier(.22,.61,.36,1);box-shadow:0 0 10px rgba(201,168,76,.55);"></div></div><div id="genProgSteps"></div>';
  }
  var EXPECTED_STEPS = 14;

  try {
    const res = await fetch(API + '/reports/generate-stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Fallback auf den klassischen (nicht-streamenden) Endpoint, falls Stream nicht verfuegbar.
    if (!res.ok || !res.body || !res.body.getReader) {
      const r2 = await fetch(API + '/reports/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || 'Fehler');
      render(d2);
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', done = null, errMsg = null;
    for (;;) {
      const { value, done: rd } = await reader.read();
      if (rd) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'step') pushStep(ev.msg);
        else if (ev.type === 'done') done = ev.result;
        else if (ev.type === 'error') errMsg = ev.error;
      }
    }
    if (errMsg) throw new Error(errMsg);
    if (!done) throw new Error('Kein Ergebnis erhalten');
    render(done);
  } catch (e) {
    $('errBox').textContent = '✗ ' + e.message;
    $('errBox').classList.remove('hide');
  } finally {
    if (prog) { prog.classList.add('hide'); prog.innerHTML = ''; }
    btn.disabled = false;
    btn.textContent = 'Marktbericht erstellen';
  }
}


// Formular aus einer geladenen Ausgabe befuellen (alle Felder, inkl. Erweiterte Angaben)
function fillFormFromOut(d) {
  const rf = (d && d.ref) || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el || v == null || v === '') return false;
    if (el.type === 'checkbox') { el.checked = !!v; }
    else if (el.tagName === 'SELECT') {
      const has = [...el.options].some((o) => String(o.value) === String(v));
      if (!has) return false; el.value = String(v);
    } else { el.value = v; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  set('address', (d.address && d.address.formatted) || rf.address);
  set('ptype', rf.property_type); set('usage', rf.usage);
  set('area', rf.living_area); set('rooms', rf.rooms);
  set('year', rf.build_year); set('floor', rf.floor);
  set('rent', rf.monthly_net_rent); set('price', rf.purchase_price);
  let adv = 0;
  ['cond|condition', 'energy|energy_class', 'quality|quality', 'modern|modernization',
   'modyear|modernization_year', 'baths|bathrooms', 'balcony|balcony_area', 'garden|garden_area',
   'plot|plot_area', 'units|units', 'garages|garages', 'outdoor|outdoor_spaces', 'elevator|elevator']
    .forEach((pair) => {
      const [id, key] = pair.split('|');
      if (set(id, rf[key] != null ? rf[key] : rf[key.replace('_spaces', '_parking')])) adv++;
    });
  // Erweiterte Angaben aufklappen, wenn dort etwas befuellt wurde
  if (adv > 0) {
    const box = document.getElementById('precBox'), caret = document.getElementById('precCaret');
    if (box && box.style.display === 'none') { box.style.display = ''; if (caret) caret.textContent = '\u25be'; }
  }
}

function _scoreWord(s) {
  if (s == null) return '';
  return s >= 80 ? 'sehr gut' : s >= 65 ? 'gut' : s >= 45 ? 'durchschnittlich' : s >= 25 ? 'schwach' : 'sehr schwach';
}
function render(out) {
  const d = out.data;
  try { fillFormFromOut(d); } catch (e) { /* Formular-Befuellung optional */ }
  $('placeholder').classList.add('hide');
  $('resultBody').classList.remove('hide');
  $('reportPanel').classList.remove('hide');

  // v565-no-mbcard: Mini-Marktbewertung-Karte entfernt (echte Tachos via renderValuation bleiben)
  try { var _h = $('mbCard'); if (_h) _h.style.display = 'none'; } catch (e) {}

  // DealScore-2-Box: echter DS2 (bei .dpkt) oder vereinfachter Hinweis (manuell)
  const dm = $('dsMeta');
  if (dm) {
    const m = d.dealscore_meta;
    if (m && !m.simplified) {
      const k = m.kpis || {};
      const kpiChips = [
        k.dscr != null ? ['DSCR', k.dscr.toFixed ? k.dscr.toFixed(2) : k.dscr] : null,
        k.ltv_pct != null ? ['LTV', Math.round(k.ltv_pct) + ' %'] : null,
        k.cashflow_monthly != null ? ['Cashflow', Math.round(k.cashflow_monthly) + ' €/M'] : null,
      ].filter(Boolean).map(([n, v]) =>
        `<span style="background:#1a1a1f;border:1px solid #2a2a30;border-radius:8px;padding:4px 10px;font-size:12px;color:#cfcfd6;">${n}: <b style="color:#fff;">${v}</b></span>`).join(' ');
      dm.classList.remove('hide');
      dm.innerHTML = `<div style="background:linear-gradient(135deg,#16210f,#1a1a1f);border:1px solid #C9A84C;border-radius:12px;padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-family:'Space Grotesk';font-weight:700;font-size:22px;color:#C9A84C;">DealScore 2: ${m.value}</span>
          <span style="font-size:12px;color:#8a8a93;">aus DealPilot übernommen${m.kpis_complete ? ' · vollständige Finanzierungsdaten' : ''}</span>
        </div>
        ${kpiChips ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">${kpiChips}</div>` : ''}
        <div style="font-size:11px;color:#6a6a72;margin-top:8px;">Markt-Score dieses Berichts (ohne Finanzierung): ${m.market_score}</div>
      </div>`;
    } else if (m && m.simplified) {
      dm.classList.remove('hide');
      dm.innerHTML = `<div style="background:#16161b;border:1px solid #2a2a30;border-radius:12px;padding:12px 14px;">
        <span style="font-size:13px;color:#cfcfd6;"><b>Vereinfachter Score</b> — ${m.note}</span></div>`;
    } else dm.classList.add('hide');
  }


  const cn = $('costNote');
  if (cn) {
    const ge = out.cost && out.cost.geomap_eur;
    if (ge != null) {
      cn.textContent = ge === 0
        ? '' /* v565-no-share: Kostenzeile entfernt */
        : ''
          + (out.cost.geomap_balance_eur != null ? '  ·  Restguthaben ' + out.cost.geomap_balance_eur.toFixed(2).replace('.', ',') + ' €' : '');
    } else cn.textContent = '';
  }

  // Objektkarte: im Dashboard NUR die interaktive Leaflet-Karte (#map) zeigen.
  // Die Geoapify-Static-Map (#objImage) bleibt ausgeblendet – sie wird weiterhin
  // fürs PDF genutzt (d.object_image), war im Dashboard aber eine Dopplung.
  const img = $('objImage');
  img.classList.add('hide'); img.removeAttribute('src');

  // Objektkarte / Stammdaten-Überblick (Obsidian + Partikel) – "welches Objekt ist das?"
  const osEl = $('objSummary');
  if (osEl) { osEl.classList.add('hide'); } /* v569-appbeh: Objektkarte aus */
  if (false) {
    const rf = d.ref || {}, adr = (d.address && d.address.formatted) || rf.address || '–';
    const chip = (t) => `<span style="display:inline-block;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.35);color:#e7e2d4;border-radius:999px;padding:3px 10px;font-size:11.5px;font-family:'JetBrains Mono';">${t}</span>`;
    const facts = [
      rf.property_type, rf.living_area ? rf.living_area + ' m²' : null, rf.rooms ? rf.rooms + ' Zi.' : null,
      rf.build_year ? 'Bj. ' + rf.build_year : null, rf.floor != null ? rf.floor + '. Etage' : null,
      rf.energy_class ? 'Energie ' + rf.energy_class : null, rf.condition ? 'Zustand ' + rf.condition : null,
      rf.quality ? 'Ausstattung ' + rf.quality : null,
      rf.modernization ? 'Modernisierung ' + rf.modernization + (rf.modernization_year ? ' (' + rf.modernization_year + ')' : '') : null,
      rf.bathrooms ? rf.bathrooms + ' Bad' + (rf.bathrooms > 1 ? 'ezimmer' : '') : null,
      rf.balcony_area ? 'Balkon/Terrasse ' + rf.balcony_area + ' m²' : null,
      rf.garden_area ? 'Garten ' + rf.garden_area + ' m²' : null,
      rf.plot_area ? 'Grundstück ' + rf.plot_area + ' m²' : null,
      rf.units ? rf.units + ' Wohneinheiten' : null,
      (rf.garages || rf.outdoor_spaces || rf.outdoor_parking) ? 'Stellplätze ' + [(rf.garages ? rf.garages + ' Garage/TG' : null), ((rf.outdoor_spaces || rf.outdoor_parking) ? (rf.outdoor_spaces || rf.outdoor_parking) + ' außen' : null)].filter(Boolean).join(' · ') : null,
      rf.elevator ? 'Aufzug' : null,
      rf.usage ? 'Nutzung ' + rf.usage : null,
      rf.purchase_price ? 'Kaufpreis ' + fmt(rf.purchase_price, ' €') : null,
      rf.monthly_net_rent ? 'Miete ' + fmt(rf.monthly_net_rent, ' €') : null,
    ].filter(Boolean);
    osEl.classList.remove('hide');
    osEl.style.cssText = 'position:relative;overflow:hidden;margin-bottom:16px;padding:16px 18px;border-radius:14px;'
      + 'border:1px solid rgba(201,168,76,.35);background-color:#070708;background-image:'
      + 'radial-gradient(circle at 18% 22%,rgba(201,168,76,.13),transparent 42%),'
      + 'radial-gradient(circle at 88% 78%,rgba(70,100,120,.12),transparent 46%),'
      + 'radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);'
      + 'background-size:auto,auto,22px 22px;';
    osEl.innerHTML = `
      <div style="font-size:10px;letter-spacing:1.4px;color:#C9A84C;font-weight:700;margin-bottom:4px;">OBJEKT</div>
      <div style="font-family:'Space Grotesk';font-weight:700;font-size:17px;color:#fff;margin-bottom:10px;">${adr}</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">${facts.map(chip).join('')}</div>`;
  }

  // Score (Donut + Gauge, beide Optiken)
  const ds = d.deal_score || {};
  renderScore(d);

  // KPIs
  const mv = d.valuation.market_value || {}, y = d.valuation.yield || {}, inp = d.valuation.inputs || {};
  $('kMv').textContent = fmt(mv.estimated, ' €');
  $('kYield').textContent = (y.gross_yield_pct ?? '–') + ' %';
  $('kFactor').textContent = y.rent_multiplier ?? '–';
  $('kSqm').textContent = fmt(inp.price_per_sqm, ' €');
  $('kMrent').textContent = fmt(inp.market_rent_sqm, ' €');
  $('kDisc').textContent = (mv.discount_to_market_pct ?? '–') + ' %';
  /* v877-kpi-spannen: Sub-Zeilen mit Spannen (nur wo Daten vorliegen) */
  (function(){
    var _sale = d.sale || {}, _rent = d.rent || {};
    var _set = function(id, txt){ var e = $(id); if (e) e.textContent = txt || ''; };
    var _r = function(n){ return Math.round(n); };
    _set('kMvSp', (mv.low != null && mv.high != null) ? ('Spanne ' + fmt(_r(mv.low), '\u2013') + fmt(_r(mv.high), ' \u20ac')) : '');
    _set('kSqmSp', (_sale.q25_per_sqm != null && _sale.q75_per_sqm != null) ? ('Median-Band ' + fmt(_r(_sale.q25_per_sqm), '\u2013') + fmt(_r(_sale.q75_per_sqm), ' \u20ac/m\u00b2')) : '');
    _set('kMrentSp', (_rent.q25_per_sqm != null && _rent.q75_per_sqm != null) ? (fmt(_r(_rent.q25_per_sqm), '\u2013') + fmt(_r(_rent.q75_per_sqm), ' \u20ac/m\u00b2')) : '');
    _set('kDiscSp', (mv.discount_to_market_pct != null) ? (mv.discount_to_market_pct >= 0 ? 'Kaufpreis unter Wert' : 'Kaufpreis \u00fcber Wert') : '');
  })();

  // Marktwert-/Marktmiete-Spanne + Lage-/Potenzialbewertung
  renderValuation(d);
  renderAssessment(d);
  renderHistory(d);
  renderMicro(d);
  renderObjectHistory(out);

  // Score-Komponenten im DealPilot-Stil: Label + tier-farbiger Balken + Wert/100 + erklärender Wert.
  const labels = { preisabschlag:'Preisabschlag', bruttorendite:'Bruttorendite', makrolage:'Makrolage',
    mikrolage:'Mikrolage', mietentwicklung:'Mietentwicklung', risiko:'Risiko' };
  const mvv = (d.valuation && d.valuation.market_value) || {};
  const yld = (d.valuation && d.valuation.yield) || {};
  const subFor = {
    preisabschlag: mvv.discount_to_market_pct != null
      ? `Kaufpreis ${mvv.discount_to_market_pct >= 0 ? mvv.discount_to_market_pct + ' % unter' : Math.abs(mvv.discount_to_market_pct) + ' % über'} Marktwert`
      : null,
    bruttorendite: yld.gross_yield_pct != null ? `${yld.gross_yield_pct} % Rendite · Faktor ${yld.rent_multiplier ?? '–'}` : null,
    makrolage: (d.macro && d.macro.score != null) ? `Makro-Score ${d.macro.score}/100` : null,
    mikrolage: (d.micro && d.micro.score != null) ? `Mikro-Score ${d.micro.score}/100` : null,
    mietentwicklung: 'mangels Miet-Zeitreihe konservativ angesetzt',
    risiko: mvv.confidence_pct != null ? `Datenkonfidenz ${mvv.confidence_pct} %` : 'Markt-/Mietausfallrisiko',
  };
  $('scoreBars').innerHTML = Object.entries(ds.breakdown || {}).map(([k, v]) => {
    const col = _scoreCol(v);
    return `<div style="margin-bottom:13px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="font-family:'Space Grotesk';font-weight:600;font-size:13.5px;color:#e8e8ea;">${labels[k] || k}</span>
        <span style="font-family:'JetBrains Mono';font-size:13px;color:${col};font-weight:600;">${v}<span style="color:#6a6a72;font-size:11px;"> / 100</span></span>
      </div>
      <div style="height:8px;background:#1c1c22;border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${Math.max(0, Math.min(100, v))}%;background:${col};border-radius:999px;box-shadow:0 0 8px ${col}66;transition:width .6s ease-out;"></div>
      </div>
      ${subFor[k] ? `<div style="font-size:11px;color:#7a7a82;margin-top:4px;">${subFor[k]}</div>` : ''}
    </div>`;
  }).join('');

  // Karte
  drawMap(d.address.lat, d.address.lon, d.sale.comparables || []);

  // Chart: Vergleichs-€/m² Verteilung vs. Objekt
  drawChart(d.sale, inp.price_per_sqm);

  // Bericht
  $('aiMode').textContent = '· ' + out.ai_mode + (out.ai_error ? ' (' + out.ai_error + ')' : '');
  $('reportMd').innerHTML = mdToHtml(out.report_md || '');
  renderProvenance(out);
  window._lastOut = out;
  // Letzte Ausgabe lokal sichern (ohne grosse Karten) -> jederzeit gratis neu ladbar.
  try {
    const slim = Object.assign({}, out); delete slim._covMap; delete slim._lightMap;
    localStorage.setItem('mb_last_out', JSON.stringify(slim));
    const _lb = document.getElementById('loadLastBtn'); if (_lb) _lb.style.display = '';
  } catch (e) { /* Quota o.ae. ignorieren */ }
  fillInputsFromReport(out);

  $('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Konfidenz-Ampel: 0..1 -> Label, Farbe, Erklärung
function confInfo(c) {
  if (c == null) return null;
  if (c >= 0.85) return { label: 'Hoch', color: '#3FA56C', text: 'Große Vergleichsstichprobe – belastbare Marktwertindikation.' };
  if (c >= 0.65) return { label: 'Gut', color: '#3FA56C', text: 'Solide Datenbasis – gute Indikation mit geringer Unsicherheit.' };
  if (c >= 0.45) return { label: 'Mittel', color: '#C9A84C', text: 'Eingeschränkte Stichprobe – als Orientierung zu verstehen, nicht als exakter Wert.' };
  return { label: 'Gering', color: '#B86250', text: 'Kleine Stichprobe – nur grobe Orientierung, mit Vorsicht zu nutzen.' };
}

// ===== SVG-Visualisierungen (DealPilot-Stil) =====
// DealPilot-Statuslogik (aus Design-Handoff): >=70 gruen, 50-69 gold, <50 rot.
const DP_GREEN = '#3FA56C', DP_GOLD = '#C9A84C', DP_RED = '#B86250';
function _scoreCol(s) { s = s || 0; return s >= 70 ? DP_GREEN : s >= 50 ? DP_GOLD : DP_RED; }
function _scoreTier(s) { s = s || 0; return s >= 85 ? 'Top' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : 'Schwach'; }
function _kiRaet(s) { s = s || 0; return s >= 85 ? 'Aktiv ausbauen' : s >= 70 ? 'Kauf erwägen' : s >= 50 ? 'Genau prüfen' : 'Zurückhaltung'; }
// Donut-Ring im DealPilot-Stil: dicker Ring, tier-farbig, Score gross, Tier-Pille unten.
function svgDonut(score) {
  const s = Math.max(0, Math.min(100, score || 0)), cx = 75, cy = 75, r = 60, col = _scoreCol(s);
  const tier = _scoreTier(s);
  const n = Math.max(2, Math.round(s / 100 * 90)), pts = [];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (s / 100) * 2 * Math.PI * i / n; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
  return `<svg viewBox="0 0 150 162" style="width:150px;height:162px;flex:none;">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#22222a" stroke-width="11"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round"
      style="filter:drop-shadow(0 0 6px ${col}55);"/>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#fff" font-family="Space Grotesk" font-weight="700" font-size="44">${score ?? '–'}</text>
    <text x="${cx}" y="${cy + 26}" text-anchor="middle" fill="#8a8a93" font-size="12">/ 100</text>
    <g transform="translate(${cx},${cy + r + 11})">
      <rect x="-28" y="-12" width="56" height="23" rx="11.5" fill="#0a0a0c" stroke="${col}" stroke-width="1.4"/>
      <text x="0" y="4" text-anchor="middle" fill="${col}" font-family="Space Grotesk" font-weight="600" font-size="12.5">${tier}</text>
    </g>
  </svg>`;
}
function _arcPts(cx, cy, r, t0, t1, n) {
  const p = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, w = Math.PI * (1 - t); p.push((cx + r * Math.cos(w)).toFixed(1) + ',' + (cy - r * Math.sin(w)).toFixed(1)); }
  return p.join(' ');
}
// Halbkreis-Tacho: Skala lo..hi, Farbzonen, Zeiger bei value (+ optional Marker)
function svgGauge(value, lo, hi, opts) {
  opts = opts || {};
  if (lo == null || hi == null || hi <= lo || value == null) return '';
  const cx = 110, cy = 104, r = 86, t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const zones = opts.zones || [[0, 0.34, '#3FA56C'], [0.34, 0.66, '#C9A84C'], [0.66, 1, '#B86250']];
  const arcs = zones.map(([a, b, c]) => `<polyline points="${_arcPts(cx, cy, r, a, b, 16)}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="butt"/>`).join('');
  const w = Math.PI * (1 - t), nx = cx + (r - 8) * Math.cos(w), ny = cy - (r - 8) * Math.sin(w);
  const needle = `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#e8e8ea" stroke-width="2.6" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="#e8e8ea"/>`;
  let marker = '';
  if (opts.marker != null) { const tm = Math.max(0, Math.min(1, (opts.marker - lo) / (hi - lo))), wm = Math.PI * (1 - tm); marker = `<circle cx="${(cx + r * Math.cos(wm)).toFixed(1)}" cy="${(cy - r * Math.sin(wm)).toFixed(1)}" r="5" fill="#E8E2D4" stroke="#0a0a0c" stroke-width="1.6"/>`; }
  return `<svg viewBox="0 0 220 122" style="width:100%;max-width:230px;display:block;margin:0 auto;">${arcs}${marker}${needle}
    <text x="${cx}" y="${cy - 12}" text-anchor="middle" fill="#e8e8ea" font-family="Space Grotesk" font-weight="700" font-size="19">${opts.valueText != null ? opts.valueText : value}</text>
    ${opts.caption ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" fill="#6a6a72" font-size="9">${opts.caption}</text>` : ''}
    <text x="20" y="119" text-anchor="middle" fill="#8a8a93" font-size="9.5">${opts.loLabel || ''}</text>
    <text x="200" y="119" text-anchor="middle" fill="#8a8a93" font-size="9.5">${opts.hiLabel || ''}</text>
  </svg>`;
}
// Spannenbalken (HTML) mit Min/Median/Max + optionalem Marker
function rangeStrip(lo, mid, hi, fmt, marker, markerLabel) {
  if (lo == null || hi == null || mid == null || hi <= lo) return '';
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  const mk = marker != null ? `<div style="position:absolute;top:-3px;left:${pos(marker)}%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #E8E2D4;"></div>` : '';
  const mkl = (marker != null && markerLabel) ? `<div style="font-size:10px;color:#E8E2D4;text-align:center;margin-top:2px;">${markerLabel}</div>` : '';
  return `<div style="position:relative;height:8px;border-radius:999px;margin:8px 0 4px;overflow:visible;
      background:linear-gradient(90deg,#2f4030 0%,#2f4030 34%,#3d3a24 34%,#3d3a24 66%,#3f2a24 66%,#3f2a24 100%);">
      <div style="position:absolute;top:50%;left:${pos(mid)}%;transform:translate(-50%,-50%);width:13px;height:13px;border-radius:50%;background:#C9A84C;box-shadow:0 0 0 3px #141417;"></div>${mk}</div>
    <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono';font-size:10.5px;color:#8a8a93;">
      <span>${fmt(lo)}</span><span style="color:#e8e8ea;font-weight:600;">${fmt(mid)}</span><span>${fmt(hi)}</span></div>${mkl}`;
}

// Score-Bereich: Donut + Rating + KI-rät-Zeile (DealPilot-Look)
function renderScore(d) {
  const ds = d.deal_score || {};
  const box = document.querySelector('.scorebox');
  if (!box) return;
  const s = ds.score || 0, col = _scoreCol(s);
  const ratingText = ds.rating || _scoreTier(s);
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;width:100%;">
      ${svgDonut(ds.score)}
      <div style="flex:1;min-width:170px;">
        <div style="display:inline-block;font-size:10px;letter-spacing:1.3px;font-weight:700;color:${col};border:1px solid ${col};border-radius:999px;padding:3px 11px;margin-bottom:9px;">DEAL-SCORE</div>
        <div style="font-family:'Space Grotesk';font-weight:700;font-size:24px;color:${col};">${ratingText}</div>
        <div class="muted" style="margin-top:3px;font-size:13px;">Markt- &amp; Chance-Risiko-Bewertung dieses Objekts</div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:11px;font-size:13px;color:${col};font-weight:600;">
          <span style="font-size:14px;">✦</span> KI rät: ${_kiRaet(s)}
        </div>
      </div>
    </div>`;
}


// --- Marktwert & Marktmiete: Gauge + Spannenbalken (wie PDF) ---
function renderValuation(d) {
  const mv = (d.valuation && d.valuation.market_value) || {};
  const inp = (d.valuation && d.valuation.inputs) || {};
  const area = d.ref && d.ref.living_area;
  const kaufpreis = d.ref && d.ref.purchase_price;
  $('valBox').classList.remove('hide');
  const euro = (n) => fmt(n, ' €');
  const k = (n) => n != null ? Math.round(n / 1000) + 'k' : '';

  // -- Marktwert-Karte --
  const conf = mv.confidence != null ? mv.confidence : (d.sale && d.sale.confidence);
  const n = d.sale && d.sale.sample_size;
  const ci = confInfo(conf);
  const gaugeW = (mv.low != null && mv.high != null)
    ? svgGauge(mv.estimated, mv.low, mv.high, { caption: 'Lage in der Spanne', loLabel: k(mv.low), hiLabel: k(mv.high), valueText: euro(mv.estimated), marker: kaufpreis })
    : '';
  $('vwCard').innerHTML = `
    <div class="cap">Marktwert (Indikation)</div>
    ${gaugeW}
    <div class="big" style="color:var(--gold);">${euro(mv.estimated)}</div>
    <div class="sub">${mv.basis_median_sqm != null ? fmt(mv.basis_median_sqm, ' €/m²') + ' · Median' : ''}${(d.sale && d.sale.q25_per_sqm != null && d.sale.q75_per_sqm != null) ? `  ·  Spanne ${fmt(Math.round(d.sale.q25_per_sqm), '')}–${fmt(Math.round(d.sale.q75_per_sqm), ' €/m²')}` : ''}</div>
    ${rangeStrip(mv.low, mv.estimated, mv.high, euro, kaufpreis, kaufpreis != null ? 'Kaufpreis ' + euro(kaufpreis) : null)}
    ${(() => {
      const pct = mv.confidence_pct, lbl = mv.confidence_label;
      if (pct == null) {
        return ci ? `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">
            <span style="width:11px;height:11px;border-radius:50%;background:${ci.color};display:inline-block;box-shadow:0 0 8px ${ci.color}66;"></span>
            <span style="font-weight:700;color:${ci.color};">Konfidenz: ${ci.label}</span>
            ${n ? `<span style="color:#8a8a93;font-size:12px;">(${n.toLocaleString('de-DE')} Angebote)</span>` : ''}
          </div>
          <div style="color:#9a9aa2;font-size:12px;margin-top:4px;line-height:1.4;">${ci.text}</div>` : '';
      }
      const col = pct >= 70 ? '#3FA56C' : pct >= 55 ? '#C9A84C' : '#B86250';
      const miss = mv.input_missing || [];
      return `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">
          <span style="width:11px;height:11px;border-radius:50%;background:${col};display:inline-block;box-shadow:0 0 8px ${col}66;"></span>
          <span style="font-weight:700;color:${col};">Aussagekraft: ${lbl} · ${pct}%</span>
          ${n ? `<span style="color:#8a8a93;font-size:12px;">(${n.toLocaleString('de-DE')} Vergleiche${mv.input_filled != null ? `, ${mv.input_filled}/${mv.input_total} Objektangaben` : ''})</span>` : ''}
        </div>
        <div style="color:#9a9aa2;font-size:12px;margin-top:4px;line-height:1.4;">${miss.length ? 'Genauer wird die Bewertung mit: <b style="color:#c9a84c;">' + miss.join(', ') + '</b>.' : (ci ? ci.text : 'Alle wertrelevanten Objektangaben berücksichtigt.')}</div>`;
    })()}`;

  // -- Marktmiete-Karte --
  const r = d.rent || {};
  let mmInner = '<div class="cap">Marktmiete (kalt)</div><div class="sub">–</div>';
  if (r.median_per_sqm != null && area) {
    const est = Math.round(r.median_per_sqm * area);
    const lo = r.q25_per_sqm != null ? Math.round(r.q25_per_sqm * area) : null;
    const hi = r.q75_per_sqm != null ? Math.round(r.q75_per_sqm * area) : null;
    const gaugeM = (lo != null && hi != null)
      ? svgGauge(est, lo, hi, { caption: 'Mietspanne', loLabel: lo + '€', hiLabel: hi + '€', valueText: euro(est),
          zones: [[0, 0.34, '#B86250'], [0.34, 0.66, '#C9A84C'], [0.66, 1, '#3FA56C']] })
      : '';
    mmInner = `<div class="cap">Marktmiete kalt (Monat)</div>
      ${gaugeM}
      <div class="big">${euro(est)}</div>
      <div class="sub">${fmt(r.median_per_sqm, ' €/m²')} · Median${(r.q25_per_sqm != null && r.q75_per_sqm != null) ? `  ·  Spanne ${fmt(r.q25_per_sqm, '')}–${fmt(r.q75_per_sqm, ' €/m²')}` : ''}</div>
      ${rangeStrip(lo, est, hi, euro, null, null)}`;
  } else if (r.median_per_sqm != null) {
    mmInner = `<div class="cap">Marktmiete (kalt)</div><div class="big">${fmt(r.median_per_sqm, ' €/m²')}</div><div class="sub">kalt, Median</div>`;
  }
  $('mmCard').innerHTML = mmInner;
}

// --- Lage-/Potenzialbewertung (aus DealPilot-Daten) ---
function renderAssessment(d) {
  const a = d.assessment;
  const grid = $('assessGrid'), title = $('assessTitle');
  const rows = a ? [
    ['Mikrolage', a.mikrolage], ['Makrolage', a.makrolage], ['Bevölkerung', a.bevoelkerung],
    ['Nachfrage', a.nachfrage], ['Entwicklung', a.entwicklung], ['Wertsteigerung', a.wertsteigerung],
    ['Mietentwicklung', a.mietentwicklung],
    ['Mietausfallrisiko', a.mietausfallrisiko], ['Ausstattung', a.ausstattung], ['Vermietung', a.vermietungsstand],
  ].filter(([, v]) => v != null && v !== '') : [];

  // Task 4: Bodenrichtwert gehoert (wie im DealPilot) in die Lage-/Potenzialbewertung.
  const lv = d.land_value;
  let extra = '';
  if (lv && lv.available && lv.value_sqm != null) {
    const stich = lv.stichtag ? ' · Stichtag ' + String(lv.stichtag).slice(0, 10) : '';
    extra = `<div class="assess rate-neutral"><div class="l">Bodenrichtwert (amtlich)${lv.source ? ' · ' + lv.source : ''}${stich}</div>
       <div class="v" style="text-transform:none;"><span class="dot" style="background:var(--gold);"></span>${new Intl.NumberFormat('de-DE').format(lv.value_sqm)} €/m²</div></div>`;
  }

  // Zensus 2022: amtlicher Leerstand + Eigentuemerquote (+ Ø-Miete) als eigene Karten.
  const z = d.zensus;
  if (z && z.available) {
    const card = (label, valHtml) => `<div class="assess rate-neutral"><div class="l">${label}</div>
       <div class="v" style="text-transform:none;"><span class="dot" style="background:var(--gold);"></span>${valHtml}</div></div>`;
    const de = (n, dec) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
    if (z.leerstandsquote != null) extra += card('Leerstandsquote (Zensus 2022)', de(z.leerstandsquote, 1) + ' %');
    if (z.eigentuemerquote != null) extra += card('Eigentümerquote (Zensus 2022)', de(z.eigentuemerquote, 1) + ' %');
    if (z.nettokaltmiete_qm != null) extra += card('Ø Nettokaltmiete (Zensus 2022)', de(z.nettokaltmiete_qm, 2) + ' €/m²');
  }

  if (!rows.length && !extra) { grid.classList.add('hide'); title.classList.add('hide'); return; }
  title.classList.remove('hide'); grid.classList.remove('hide');
  grid.innerHTML = rows.map(([l, v]) =>
    `<div class="assess rate-${rateClass(l, v)}"><div class="l">${l}</div>
       <div class="v"><span class="dot"></span>${v}</div></div>`).join('') + extra;
}
function rateClass(label, val) {
  const v = String(val || '').toLowerCase();
  let cls = 'neutral';
  if (/(sehr gut|gut|hoch|stabil|steigend|positiv|wachsend|neuwertig|gehoben|vollvermietet)/.test(v)) cls = 'good';
  else if (/(begrenzt|niedrig|gering|schwach|fallend|rückläufig|negativ|leer)/.test(v)) cls = 'low';
  else if (/(mittel|durchschnitt|moderat|normal)/.test(v)) cls = 'mid';
  if (/risiko/.test(label.toLowerCase())) { if (cls === 'good') cls = 'low'; else if (cls === 'low') cls = 'good'; }
  return cls;
}

// --- Marktentwicklung (echte GeoMap-Historie) ---
let histChart;
function renderHistory(d) {
  const h = d.market_history;
  const title = $('histTitle'), note = $('histNote'), cv = $('histChart');
  const hasPrice = h && h.price && h.price.some((p) => p.median != null);
  if (!h || !h.usable || !hasPrice) {
    title.classList.add('hide'); cv.classList.add('hide'); note.classList.add('hide');
    if (histChart) { histChart.destroy(); histChart = null; }
    return;
  }
  title.classList.remove('hide'); cv.classList.remove('hide'); note.classList.remove('hide');
  _ensureChartDefaults();
  const labels = h.price.map((p) => p.year);
  const goldFill = (ctx) => {
    const ch = ctx.chart, ca = ch.chartArea;
    if (!ca) return 'rgba(201,168,76,.10)';
    const g = ch.ctx.createLinearGradient(0, ca.top, 0, ca.bottom);
    g.addColorStop(0, 'rgba(201,168,76,.32)'); g.addColorStop(0.55, 'rgba(201,168,76,.10)'); g.addColorStop(1, 'rgba(201,168,76,0)');
    return g;
  };
  const datasets = [{ label: 'Kaufpreis €/m²', data: h.price.map((p) => p.median),
    borderColor: '#C9A84C', backgroundColor: goldFill, cubicInterpolationMode: 'monotone', tension: .35,
    spanGaps: true, fill: true, borderWidth: 2.6, borderCapStyle: 'round', borderJoinStyle: 'round',
    pointRadius: 0, pointBackgroundColor: '#C9A84C', pointBorderColor: '#0a0a0c', pointBorderWidth: 1.4,
    pointHoverRadius: 6, pointHoverBackgroundColor: '#C9A84C', pointHoverBorderColor: '#0a0a0c', pointHoverBorderWidth: 2 }];
  if (h.rent && h.rent.some((p) => p.median != null))
    datasets.push({ label: 'Miete €/m²', data: h.rent.map((p) => p.median),
      borderColor: '#A89F8E', backgroundColor: 'transparent', cubicInterpolationMode: 'monotone', tension: .35,
      spanGaps: true, yAxisID: 'y1', borderWidth: 2.0, borderDash: [5, 4], borderCapStyle: 'round',
      pointRadius: 0, pointBackgroundColor: '#A89F8E', pointBorderColor: '#0a0a0c', pointBorderWidth: 1.2,
      pointHoverRadius: 5, pointHoverBackgroundColor: '#A89F8E', pointHoverBorderColor: '#0a0a0c', pointHoverBorderWidth: 2 });
  if (histChart) histChart.destroy();
  histChart = new Chart(cv, {
    type: 'line', data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: true, devicePixelRatio: 2.6,
      layout: { padding: { top: 8, right: 6, bottom: 2, left: 2 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { color: '#9a9aa3', boxWidth: 8, usePointStyle: true, font: { family: "'Space Grotesk'", size: 11 } } },
        tooltip: { backgroundColor: 'rgba(10,10,14,.96)', borderColor: 'rgba(201,168,76,.45)', borderWidth: 1,
          titleColor: '#C9A84C', bodyColor: '#e8e8ea', padding: 11, cornerRadius: 9, displayColors: false,
          titleFont: { family: "'Space Grotesk'", weight: '600', size: 12 }, bodyFont: { family: "'JetBrains Mono'", size: 11.5 },
          callbacks: { label: (c) => c.dataset.label + ': ' + (c.parsed.y != null ? c.parsed.y.toLocaleString('de-DE') : '\u2013') } },
      },
      scales: {
        x: { ticks: { color: '#8a8a93', font: { size: 10.5 } }, grid: { display: false }, border: { color: '#26262e' } },
        y: { ticks: { color: '#8a8a93', font: { size: 10.5 }, padding: 6 }, grid: { color: 'rgba(255,255,255,.04)' }, border: { display: false },
          title: { display: true, text: '€/m² Kauf', color: '#C9A84C', font: { size: 10.5, weight: '600' } } },
        y1: { position: 'right', ticks: { color: '#A89F8E', font: { size: 10.5 } }, grid: { drawOnChartArea: false }, border: { display: false },
          title: { display: true, text: '€/m² Miete', color: '#A89F8E', font: { size: 10.5, weight: '600' } } },
      },
    },
  });
  const dom = d.market_dynamics && d.market_dynamics.days_on_market;
  const parts = [];
  if (h.price_cagr_pct != null) parts.push(`Preistrend: ${h.price_cagr_pct > 0 ? '+' : ''}${h.price_cagr_pct} %/Jahr seit ${h.start_year}`);
  if (h.rent_cagr_pct != null) parts.push(`Miettrend: ${h.rent_cagr_pct > 0 ? '+' : ''}${h.rent_cagr_pct} %/Jahr`);
  if (dom != null) parts.push(`Ø Vermarktungsdauer: ${Math.round(dom)} Tage (Markttempo)`);
  note.textContent = parts.join('   ·   ');
}

// --- Lage & Infrastruktur (6 Gruppen) ---
function renderMicro(d) {
  const groups = d.micro && d.micro.groups;
  const title = $('microTitle'), grid = $('microGrid');
  if (!groups || !Object.keys(groups).length) {
    title.classList.add('hide'); grid.classList.add('hide'); grid.innerHTML = ''; return;
  }
  title.classList.remove('hide'); grid.classList.remove('hide');
  const order = ['einkaufen', 'verkehr', 'gesundheit', 'freizeit', 'bildung', 'gastronomie'];
  const scoreColor = (s) => _scoreCol(s);
  grid.innerHTML = order.filter((k) => groups[k]).map((k) => {
    const g = groups[k];
    const items = (g.items || []).map((it) =>
      `<div style="display:flex;justify-content:space-between;font-size:12px;color:#b8b8c0;padding:1px 0;">
         <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">${it.name}</span>
         <span style="color:#8a8a93;">${it.distance_m} m</span></div>`).join('');
    return `<div style="background:#141418;border:1px solid #26262c;border-radius:12px;padding:12px 14px;">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
         <span style="font-family:'Space Grotesk';font-weight:600;color:#e8e8ea;">${g.label}</span>
         <span style="font-weight:700;color:${scoreColor(g.score)};">${g.score5 ?? '–'}<span style="font-size:11px;color:#8a8a93;">/5</span>${g.score != null ? `<span style=\"font-size:11px;color:#8a8a93;\"> · ${g.score}/100</span>` : ''}</span>
       </div>${items || '<div style="font-size:12px;color:#8a8a93;">keine Orte gefunden</div>'}</div>`;
  }).join('');
}

// --- Marktwert-Verlauf dieses Objekts (aus gespeicherten Snapshots) ---
let objHistChartObj = null;
async function renderObjectHistory(out) {
  const key = out && out.object_key;
  const t = $('objHistTitle'), c = $('objHistChart'), note = $('objHistNote');
  if (!key) { [t, c, note].forEach((e) => e.classList.add('hide')); return; }
  let hist = [];
  try {
    const res = await fetch(API + '/objects/history?key=' + encodeURIComponent(key));
    const j = await res.json();
    hist = j.history || [];
  } catch { return; }
  if (hist.length < 2) {
    t.classList.remove('hide'); note.classList.remove('hide'); c.classList.add('hide');
    note.textContent = 'Erster gespeicherter Stand. Der Marktwert-Verlauf wird ab dem nächsten Bericht für dieses Objekt sichtbar.';
    return;
  }
  [t, c, note].forEach((e) => e.classList.remove('hide'));
  _ensureChartDefaults();
  const labels = hist.map((h) => new Date(h.created_at).toLocaleDateString('de-DE'));
  if (objHistChartObj) objHistChartObj.destroy();
  objHistChartObj = new Chart(c.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Marktwert €', data: hist.map((h) => h.market_value), borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,.12)', yAxisID: 'y', tension: .35, fill: true, borderWidth: 2.4, pointRadius: 0, pointHoverRadius: 5 },
      { label: 'Deal-Score', data: hist.map((h) => h.deal_score), borderColor: '#3FA56C', yAxisID: 'y1', tension: .35, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 5 },
    ] },
    options: { plugins: { legend: { labels: { color: '#9a9aa3', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#8a8a93' }, grid: { color: '#1c1c22' } },
        y: { ticks: { color: '#8a8a93', callback: (v) => v.toLocaleString('de-DE') }, grid: { color: '#1c1c22' }, title: { display: true, text: 'Marktwert €', color: '#C9A84C' } },
        y1: { position: 'right', min: 0, max: 100, ticks: { color: '#3FA56C' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Score', color: '#3FA56C' } },
      } },
  });
  note.textContent = hist.length + ' gespeicherte Stände · ältester ' + labels[0] + ', neuester ' + labels[labels.length - 1];
}

// --- .dpkt-Upload -> Bericht aus DealPilot-Objekt ---
$('dpktDrop').addEventListener('click', () => $('dpktFile').click());
$('dpktFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  $('errBox').classList.add('hide');
  try {
    const json = JSON.parse(await file.text());
    const obj = Array.isArray(json) ? json[0] : (json.object || json);
    fillInputsFromDpkt(obj);   // Eingabefelder sichtbar befüllen
    // "Genauere Angaben" aufklappen, damit man sofort ergänzen kann
    const box = $('precBox'), caret = $('precCaret');
    if (box) box.style.display = 'block';
    if (caret) caret.textContent = '\u25BE';
    if (typeof window._precUpd === 'function') window._precUpd();
    // Signal: Objekt geladen, ergänzen + weiterklicken
    const sig = $('loadSignal');
    if (sig) {
      sig.classList.remove('hide');
      sig.innerHTML = '\u2713 <b>Objekt geladen</b> \u2014 die Felder sind ausgefüllt. '
        + 'Du kannst unter <b>\u201eGenauere Angaben\u201c</b> noch ergänzen (Zustand, Ausstattung, Stellplätze, Aufzug \u2026) '
        + 'und dann auf <b>\u201eMarktbericht erstellen\u201c</b> klicken.';
    }
    const btn = $('goBtn');
    if (btn) { btn.style.boxShadow = '0 0 0 3px rgba(201,168,76,.4)'; btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  } catch (err) {
    $('errBox').textContent = '\u2717 ' + err.message; $('errBox').classList.remove('hide');
  } finally {
    e.target.value = '';
  }
});

// Eingabefelder aus einem DealPilot-Objekt vorbefuellen, damit sichtbar ist, was geladen wurde.
// Task 6: geladenen Bericht (Replay/.dpkt/Generate) in die Eingabefelder spiegeln,
// damit immer sichtbar ist, um WELCHES Objekt es geht.
function fillInputsFromReport(out) {
  const ref = out && out.data && out.data.ref;
  if (!ref) return;
  const set = (id, v) => { const el = $(id); if (el && v != null && v !== '') el.value = v; };
  const addr = (out.data.address && out.data.address.formatted) || ref.address;
  set('address', addr);
  set('ptype', ref.property_type); set('usage', ref.usage_type);
  set('area', ref.living_area); set('rooms', ref.rooms); set('year', ref.build_year);
  if (ref.floor != null) set('floor', ref.floor);
  set('cond', ref.condition);
  if (ref.quality) set('quality', ref.quality);
  if (ref.modernization) set('modern', ref.modernization);
  if (ref.energy_class) set('energy', String(ref.energy_class).toUpperCase().trim()[0]);
  set('price', ref.purchase_price); set('rent', ref.monthly_net_rent);
  if (ref.plot_area) set('plot', ref.plot_area);
  if (ref.units) set('units', ref.units);
}

function fillInputsFromDpkt(o) {
  if (!o || typeof o !== 'object') return;
  // Objekt rekursiv flach machen -> { lowercaseKey: primitiveValue }. Findet auch verschachtelte
  // Felder (z.B. unter .data/.kpis) – Ursache dafuer, dass vorher "nichts" ankam.
  const flat = {};
  (function walk(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 5) return;
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === 'object') { walk(v, depth + 1); continue; }
      const kk = String(k).toLowerCase();
      if (flat[kk] == null || flat[kk] === '') flat[kk] = v;
    }
  })(o, 0);
  const g = (keys) => { for (const k of keys) { const kk = String(k).toLowerCase(); if (flat[kk] != null && flat[kk] !== '') return flat[kk]; } return null; };
  const set = (id, v) => { const el = $(id); if (el && v != null && v !== '') el.value = v; };

  let addr = g(['adresse', 'address', 'objekt_adresse', 'standort', 'strasse_nr', 'strassehausnr']);
  if (!addr) {
    const str = g(['strasse', 'street', 'str']); const hnr = g(['hausnummer', 'hausnr', 'nr']);
    const plz = g(['plz', 'postleitzahl', 'postcode', 'zip']); const ort = g(['ort', 'stadt', 'city', 'gemeinde']);
    addr = [[str, hnr].filter(Boolean).join(' '), [plz, ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
  set('address', addr);
  const pt = g(['objekttyp', 'property_type', 'typ', 'objektart', 'art']);
  if (pt && /haus/i.test(String(pt))) set('ptype', 'haus'); else if (pt) set('ptype', 'wohnung');
  const us = g(['nutzung', 'usage_type', 'usage', 'nutzungsart']);
  if (us && /eigen/i.test(String(us))) set('usage', 'eigennutzung'); else if (us) set('usage', 'kapitalanlage');
  set('area', g(['wohnflaeche', 'wohnflaeche_qm', 'wohnflaeche_m2', 'flaeche', 'living_area', 'wfl']));
  set('rooms', g(['zimmer', 'anzahl_zimmer', 'zimmeranzahl', 'rooms']));
  set('year', g(['baujahr', 'build_year', 'baujahr_jahr']));
  set('floor', g(['etage', 'geschoss', 'floor', 'stockwerk']));
  set('price', g(['kaufpreis', 'kaufpreis_eur', 'preis', 'price', 'kp']));
  set('rent', g(['kaltmiete', 'kaltmiete_monat', 'nettokaltmiete', 'miete', 'rent', 'monatsmiete']));
  const en = g(['ds2_energie', 'energieklasse', 'energie_label', 'energy_class', 'energieeffizienzklasse']);
  if (en) set('energy', String(en).toUpperCase().trim()[0]);
  const zu = g(['zustand', 'condition']);
  if (zu) { const z = String(zu).toLowerCase().trim(); const opt = ['gepflegt', 'neuwertig', 'saniert', 'modernisiert', 'normal', 'renovierungsbeduerftig'].find((x) => x === z || z.includes(x.slice(0, 5))); if (opt) set('cond', opt); }
}

function drawMap(lat, lon, comps) {
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([lat, lon], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO', maxZoom: 19,
    }).addTo(map);
  } else {
    map.setView([lat, lon], 14);
  }
  if (marker) map.removeLayer(marker);
  if (compLayer) map.removeLayer(compLayer);

  marker = L.circleMarker([lat, lon], { radius: 10, color: '#C9A84C', fillColor: '#C9A84C', fillOpacity: 1 })
    .addTo(map).bindPopup('<b>Objekt</b>');

  compLayer = L.layerGroup();
  (comps || []).forEach(c => {
    if (typeof c.lat === 'number' && typeof c.lon === 'number') {
      L.circleMarker([c.lat, c.lon], { radius: 5, color: '#5a8dd6', fillColor: '#5a8dd6', fillOpacity: .8 })
        .bindPopup(`${c.living_area} m² · ${new Intl.NumberFormat('de-DE').format(c.price_per_sqm)} €/m²`)
        .addTo(compLayer);
    }
  });
  compLayer.addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

// Profi-Defaults fuer alle Charts (DealPilot-Look), einmalig + lazy (Chart muss geladen sein).
let _chartDefaultsDone = false;
function _ensureChartDefaults() {
  if (_chartDefaultsDone || typeof Chart === 'undefined') return;
  _chartDefaultsDone = true;
  Chart.defaults.font.family = "'Inter','Space Grotesk',-apple-system,sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.font.weight = '500';
  Chart.defaults.color = '#8a8a93';
  const t = Chart.defaults.plugins.tooltip;
  t.backgroundColor = 'rgba(10,10,12,.96)'; t.borderColor = 'rgba(201,168,76,.4)';
  t.borderWidth = 1; t.cornerRadius = 8; t.padding = 10; t.usePointStyle = true;
  t.titleColor = '#e8e8ea'; t.bodyColor = '#cfcfd6';
  const l = Chart.defaults.plugins.legend.labels;
  l.usePointStyle = true; l.pointStyle = 'circle'; l.boxWidth = 8; l.color = '#9a9aa3';
  if (Chart.defaults.animation) Chart.defaults.animation.easing = 'easeOutQuart';
}

function drawChart(sale, objSqm) {
  _ensureChartDefaults();
  const ctx = $('chart').getContext('2d');
  if (chart) chart.destroy();
  const stat = [
    ['Minimum', sale.min_per_sqm], ['25 %-Quartil', sale.q25_per_sqm],
    ['Median', sale.median_per_sqm], ['75 %-Quartil', sale.q75_per_sqm],
    ['Maximum', sale.max_per_sqm], ['Dieses Objekt', objSqm],
  ];
  const labels = stat.map((s) => s[0]);
  const data = stat.map((s) => (s[1] != null ? Math.round(s[1]) : null));
  const median = sale.median_per_sqm != null ? Math.round(sale.median_per_sqm) : null;
  // Gold-Verlauf fuers eigene Objekt, warmer Stein fuer die Verteilung, dunkles Gold fuer Median.
  const bg = (c) => {
    const s0 = stat[c.dataIndex] ? stat[c.dataIndex][0] : '';
    const a = c.chart.chartArea;
    if (s0 === 'Dieses Objekt' && a) {
      const g = c.chart.ctx.createLinearGradient(0, a.bottom, 0, a.top);
      g.addColorStop(0, '#a8842c'); g.addColorStop(1, '#E8CC7A'); return g;
    }
    return s0 === 'Median' ? '#9a7f33' : '#5A5350';
  };
  // Inline-Plugin: Wert-Labels ueber den Balken + gestrichelte Median-Linie.
  const deco = {
    id: 'mbDeco',
    afterDatasetsDraw(ch) {
      const x = ch.ctx, a = ch.chartArea, scales = ch.scales; if (!a) return;
      const meta = ch.getDatasetMeta(0);
      x.save();
      x.font = "700 10.5px 'JetBrains Mono',monospace"; x.textAlign = 'center';
      meta.data.forEach((bar, i) => {
        const v = data[i]; if (v == null) return;
        x.fillStyle = labels[i] === 'Dieses Objekt' ? '#E8CC7A' : '#b8b0a0';
        x.fillText(v.toLocaleString('de-DE'), bar.x, bar.y - 7);
      });
      if (median != null && scales.y) {
        const yy = scales.y.getPixelForValue(median);
        x.strokeStyle = 'rgba(201,168,76,.6)'; x.lineWidth = 1; x.setLineDash([4, 4]);
        x.beginPath(); x.moveTo(a.left, yy); x.lineTo(a.right, yy); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#C9A84C'; x.textAlign = 'right';
        x.fillText('Median ' + median.toLocaleString('de-DE'), a.right - 2, yy - 5);
      }
      x.restore();
    }
  };
  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Kaufpreis \u20ac/m\u00b2', data, backgroundColor: bg, borderColor: bg, borderWidth: 0, borderRadius: 7, maxBarThickness: 66 }] },
    options: {
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => (c.parsed.y != null ? c.parsed.y.toLocaleString('de-DE') + ' \u20ac/m\u00b2' : '\u2013') } },
      },
      scales: {
        x: { ticks: { color: '#8a8a93', font: { size: 11 } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: '#8a8a93', callback: (v) => v.toLocaleString('de-DE') }, grid: { color: 'rgba(255,255,255,.04)' }, border: { display: false },
             title: { display: true, text: '\u20ac/m\u00b2', color: '#8a8a93' } },
      },
    },
    plugins: [deco],
  });
}

// Mini-Markdown -> HTML (Überschriften, Listen, fett). Bewusst klein gehalten.
function mdToHtml(md) {
  md = String(md || '').split('\n').filter((l) => !/^\s*\*{0,2}Fakten:?\*{0,2}/i.test(l)).join('\n');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let html = '', inList = false;
  for (let raw of lines) {
    let line = raw.trimEnd();
    if (/^#\s+/.test(line)) { html += closeL(); html += '<h1>' + inline(esc(line.replace(/^#\s+/, ''))) + '</h1>'; continue; }
    if (/^##\s+/.test(line)) { html += closeL(); html += '<h2>' + inline(esc(line.replace(/^##\s+/, '').replace(/^[A-Z]\d?\)\s*/, ''))) + '</h2>'; continue; }
    if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(esc(line.replace(/^[-*]\s+/, ''))) + '</li>'; continue; }
    html += closeL();
    if (line.trim() === '') continue;
    html += '<p>' + inline(esc(line)) + '</p>';
  }
  html += closeL();
  function closeL() { if (inList) { inList = false; return '</ul>'; } return ''; }
  function inline(s) { return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>'); }
  return html;
}

// --- Datengrundlage / Echtheits-Kennzeichnung ---
function renderProvenance(out) {
  const prov = out && out.data && out.data.meta && out.data.meta.provenance;
  const el = $('provList');
  if (!el) return; /* v877-datengrundlage-out */
  if (!prov || !prov.length) { el.innerHTML = ''; return; }
  el.innerHTML = prov.map((p) =>
    `<div class="prov-row"><span class="pl">${p.label}</span>
       <span class="ps">${p.source}</span>
       <span class="badge b-${p.trust}">${p.trust}</span></div>`).join('');
}

// --- PDF-Export (DealPilot-Stil, an PriceHubble/Sprengnetter orientiert) ---
$('pdfBtn').addEventListener('click', async () => {
  const out = window._lastOut;
  if (!out) return;
  const btn = $('pdfBtn'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'erstelle PDF…';
  try { await exportPdf(out); } catch (e) { alert('PDF-Fehler: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = old; }
});

// Laedt ein Bild (z.B. Objektkarte) als DataURL fuer die PDF-Einbettung.
// Cover-Karte nachschaerfen: Grauschleier raus, Gold leuchtet (Canvas-Filter).
async function enhanceCoverMap(dataUrl) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.filter = 'brightness(0.9) contrast(1.5) saturate(1.55)';
    x.drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.86);
  } catch (e) { return dataUrl; }
}
// Butterweicher Links- + Unten-Fade als PNG (ersetzt den Streifen-Scrim -> kein Banding).
function makeCoverFadePNG() {
  const c = document.createElement('canvas'); c.width = 840; c.height = 1188;
  const x = c.getContext('2d');
  const gH = x.createLinearGradient(0, 0, c.width, 0);
  gH.addColorStop(0.00, 'rgba(3,3,4,1)');
  gH.addColorStop(0.42, 'rgba(3,3,4,0.97)');
  gH.addColorStop(0.60, 'rgba(3,3,4,0.62)');
  gH.addColorStop(0.78, 'rgba(3,3,4,0.16)');
  gH.addColorStop(1.00, 'rgba(3,3,4,0)');
  x.fillStyle = gH; x.fillRect(0, 0, c.width, c.height);
  const gV = x.createLinearGradient(0, c.height * 0.78, 0, c.height);
  gV.addColorStop(0, 'rgba(3,3,4,0)'); gV.addColorStop(1, 'rgba(3,3,4,0.62)');
  x.fillStyle = gV; x.fillRect(0, c.height * 0.78, c.width, c.height * 0.22);
  return c.toDataURL('image/png');
}

async function loadImageDataUrl(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result); fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function exportPdf(out) {
  const d = out.data;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 18;
  const GOLD = [201, 168, 76], INK = [20, 20, 23], TXT = [34, 34, 38], MUT = [120, 120, 130];
  let y = 0;
  const euro = (n) => (n == null ? '–' : Number(n).toLocaleString('de-DE') + ' €');
  const a = d.address || {}, ref = d.ref || {}, mv = (d.valuation && d.valuation.market_value) || {},
        yld = (d.valuation && d.valuation.yield) || {}, inp = (d.valuation && d.valuation.inputs) || {},
        ds = d.deal_score || {};
  const theme = 'dark'; // Deckblatt + Inhalt immer dunkel, Inhaltsseiten bleiben hell
  // v-Cover-Art: Marcels Mockup-Artwork als Cover-Hintergrund (statt Live-Karte).
  // Spart den static-map-Call; Live-Karte bleibt Fallback, falls Asset fehlt.
  if (window._bgCoverArt === undefined) window._bgCoverArt = await loadImageDataUrl('assets/bg-cover-art.jpg?v=49k');
  const bgCoverArt = window._bgCoverArt;
  // Deckblatt-Karte je nach Theme: dunkel = gold-auf-schwarz, hell = positron. Pin zeichnen wir selbst.
  const coverMapStyle = theme === 'dark' ? 'dark-matter-yellow-roads' : 'positron';
  let objImg = out._covMap || null;
  if (!objImg && !bgCoverArt && a.lat != null && a.lon != null) {
    // Eleganter Stadtteil-Ausschnitt (zoom 15): das goldene Strassennetz dominiert,
    // Gebaeude bleiben klein -> Look wie Vorlage. Hohe Aufloesung fuer Hochglanz.
    const cu = API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
      + '&zoom=15&width=1448&height=2048&marker=0&style=' + coverMapStyle;
    objImg = await loadImageDataUrl(cu);
    if (objImg) out._covMap = objImg; // cachen -> Wiederverwendung/Export ohne erneuten Abruf
  }
  if (!objImg && d.object_image) objImg = await loadImageDataUrl(d.object_image);

  // Helle Karte (positron) als dezentes Wasserzeichen fuer die Inhaltsseiten (helles Design).
  let lightImg = out._lightMap || null;
  if (!lightImg && a.lat != null && a.lon != null) {
    const lu = API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
      + '&zoom=17&width=1024&height=1448&marker=0&style=positron';
    lightImg = await loadImageDataUrl(lu);
    if (lightImg) out._lightMap = lightImg;
  }
  // Marcels Mockup-Hintergruende (statische Assets, einmal laden + cachen)
  if (window._bgLightAsset === undefined) window._bgLightAsset = await loadImageDataUrl('assets/bg-content-light.jpg?v=49k');
  if (window._bgDarkAsset === undefined) window._bgDarkAsset = await loadImageDataUrl('assets/bg-cover-dark.jpg?v=49k');
  const bgLightAsset = window._bgLightAsset, bgDarkAsset = window._bgDarkAsset;
  // Heller Seitenhintergrund (Off-White + feines Karten-Wasserzeichen) fuer alle Inhaltsseiten.
  function contentBg() {
    doc.setFillColor(250, 250, 249); doc.rect(0, 0, W, H, 'F');
    if (bgLightAsset) { // Marcels Mockup-Hintergrund (bereits dezent) 1:1
      try { doc.addImage(bgLightAsset, 'JPEG', 0, 0, W, H, 'bgl'); return; } catch (e) { /* fallback */ }
    }
    if (lightImg && doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.30 }));
      try { doc.addImage(lightImg, 'PNG', 0, 0, W, H, 'lightwm'); } catch (e) { /* optional */ }
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
  }

  function footer(pageNo) {
    doc.setDrawColor(228, 226, 220); doc.setLineWidth(0.3); doc.line(M, H - 11, W - M, H - 11);
    doc.setFillColor(...GOLD); doc.circle(M + 1, H - 8.3, 0.9, 'F');
    doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.setFont('helvetica', 'normal');
    doc.text('DealPilot · Marktbericht — Marktpreisindikation, kein Gutachten n. § 194 BauGB', M + 4, H - 8);
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold');
    doc.text('Seite ' + pageNo, W - M, H - 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  }
  let page = 1;
  function newPage() { footer(page); doc.addPage(); page++; y = M; contentBg(); }
  function need(h) { if (y + h > H - 16) newPage(); }
  let secNo = 0;
  const tocEntries = [];
  function sectionTitle(t, reserve) {
    if (reserve && y + reserve > H - 16) newPage(); // Überschrift nicht allein am Seitenende lassen
    need(20);
    secNo++;
    const num = String(secNo).padStart(2, '0');
    tocEntries.push({ num, title: t, page });
    // Gold-Nummern-Badge + Titel + Doppellinie (Hochglanz-Redesign 07.06.)
    doc.setFillColor(247, 243, 233); doc.setDrawColor(...GOLD); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, 9, 7, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GOLD);
    doc.text(num, M + 4.5, y + 4.8, { align: 'center' });
    doc.setFontSize(13.5); doc.setTextColor(...INK);
    doc.text(t, M + 13, y + 5.3, { charSpace: 0.2 });
    doc.setDrawColor(...GOLD); doc.setLineWidth(1.0); doc.line(M, y + 10.4, M + 9, y + 10.4);
    doc.setDrawColor(225, 223, 217); doc.setLineWidth(0.3); doc.line(M + 9, y + 10.4, W - M, y + 10.4);
    y += 15; doc.setFont('helvetica', 'normal');
  }
  function kv(label, val, x, w) {
    doc.setFontSize(8); doc.setTextColor(...MUT); doc.text(label, x, y);
    doc.setFontSize(11); doc.setTextColor(...TXT); doc.setFont('helvetica', 'bold');
    doc.text(String(val == null ? '–' : val), x, y + 5); doc.setFont('helvetica', 'normal');
  }
  // KPI-Kachel: weiße Karte mit Soft-Shadow + Tier-Akzentleiste (Hochglanz 07.06.)
  function tile(x, ty, w, h, label, value, accent) {
    if (doc.GState) { // weicher Schatten unter der Karte
      doc.setGState(new doc.GState({ opacity: 0.06 })); doc.setFillColor(20, 20, 23);
      doc.roundedRect(x + 0.5, ty + 1.0, w, h, 1.8, 1.8, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setFillColor(255, 255, 255); doc.setDrawColor(232, 230, 224); doc.setLineWidth(0.25);
    doc.roundedRect(x, ty, w, h, 1.8, 1.8, 'FD');
    doc.setFillColor(...(accent || GOLD)); doc.roundedRect(x, ty + 3, 1.8, h - 6, 0.9, 0.9, 'F');
    doc.setFontSize(7); doc.setTextColor(...MUT); doc.text(label.toUpperCase(), x + 5.5, ty + 6, { charSpace: 0.5 });
    doc.setFontSize(14.5); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold');
    doc.text(String(value == null ? '–' : value), x + 5.5, ty + 14.2); doc.setFont('helvetica', 'normal');
  }
  // Score-Balken 0-100 mit Farbverlauf-Segmenten + Marker
  // Bogen aus kurzen Segmenten (jsPDF hat kein natives arc)
  function arc(cx, cy, r, a0, a1) {
    const steps = Math.max(2, Math.round(Math.abs(a1 - a0) / 6));
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const ang = (a0 + (a1 - a0) * i / steps) * Math.PI / 180;
      const px = cx + r * Math.cos(ang), py = cy + r * Math.sin(ang);
      if (prev) doc.line(prev[0], prev[1], px, py);
      prev = [px, py];
    }
  }
  // Score-Donut im DealPilot-Look: grauer Ring + farbiger Fortschrittsbogen + Zahl in der Mitte
  function scoreDonut(cx, cy, r, score) {
    const s = Math.max(0, Math.min(100, score || 0));
    const col = s >= 70 ? [63, 165, 108] : s >= 50 ? GOLD : [184, 98, 80];
    doc.setLineCap('round');
    doc.setLineWidth(4.8);
    doc.setDrawColor(44, 44, 52); arc(cx, cy, r, 0, 360);              // Hintergrundring
    doc.setDrawColor(...col); arc(cx, cy, r, -90, -90 + s / 100 * 360); // Fortschritt ab oben
    doc.setLineCap('butt');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(String(score ?? '–'), cx, cy + 1.5, { align: 'center' });
    doc.setTextColor(150, 150, 160); doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.text('/ 100', cx, cy + 7, { align: 'center' });
  }

  // Kleiner Kategorie-Ring für die helle Lage-Seite (Score 0..100, Anzeige txt zentriert)
  function microRing(cx, cy, r, score, txt) {
    // eleganter dünner Ring (Instrument-Linie wie die Tachos) + dezenter Glow
    const c = score >= 70 ? [67, 183, 124] : score >= 50 ? [217, 180, 90] : [217, 104, 95];
    const sweep = (Math.max(0, Math.min(100, score)) / 100) * 360;
    const sw = Math.max(1.3, r * 0.16);
    doc.setLineCap('round');
    doc.setDrawColor(236, 234, 229); doc.setLineWidth(sw); arc(cx, cy, r, 0, 360);
    if (doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.2 })); doc.setDrawColor(...c); doc.setLineWidth(sw * 2.1); arc(cx, cy, r, -90, -90 + sweep);
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setDrawColor(...c); doc.setLineWidth(sw); arc(cx, cy, r, -90, -90 + sweep);
    doc.setLineCap('butt');
    doc.setTextColor(...c); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(String(txt), cx, cy + 2.6, { align: 'center' });
  }

  function scoreBar(x, by, w, score) {
    const segs = [[0, 50, [217, 104, 95]], [50, 70, [217, 180, 90]], [70, 100, [67, 183, 124]]];
    const h = 5;
    if (doc.GState) { // weicher Glow unter der Leiste
      doc.setGState(new doc.GState({ opacity: 0.16 }));
      segs.forEach(([from, to, c]) => { doc.setFillColor(...c); doc.roundedRect(x + (from / 100) * w - 0.5, by - 0.8, ((to - from) / 100) * w + 1, h + 1.6, 1.2, 1.2, 'F'); });
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    segs.forEach(([from, to, c]) => {
      doc.setFillColor(...c); doc.rect(x + (from / 100) * w, by, ((to - from) / 100) * w, h, 'F');
    });
    const mx = x + (Math.max(0, Math.min(100, score)) / 100) * w;
    doc.setFillColor(...GOLD); doc.triangle(mx - 2, by - 1.8, mx + 2, by - 1.8, mx, by + 1.4, 'F');
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.7); doc.line(mx, by, mx, by + h);
  }
  // Marktwert-Spanne low —●estimate— high
  function rangeBar(x, ry, w, low, est, high) {
    if (low == null || high == null || est == null || high <= low) return false;
    const h = 4; doc.setFillColor(232, 230, 224); doc.roundedRect(x, ry, w, h, 1, 1, 'F');
    const pos = (v) => x + ((v - low) / (high - low)) * w;
    doc.setFillColor(...GOLD); const px = Math.max(x, Math.min(x + w, pos(est)));
    doc.circle(px, ry + h / 2, 2.1, 'F');
    return true;
  }
  // Halbkreis-Tacho: Skala lo..hi mit farbigen Zonen + Zeiger bei val (+ optional Kaufpreis-Marker)
  // v489: satte DealPilot-Ampelfarben + Glow-Halo (mehrlagige, transparente Bögen) = Wow-Optik.
  function gauge(cx, cy, r, lo, hi, val, opts) {
    opts = opts || {};
    if (lo == null || hi == null || hi <= lo) return;
    const dark = !!opts.dark;
    const GREEN = [67, 183, 124];   // sattes DealPilot-Grün
    const GOLDT = [217, 180, 90];   // strahlendes Gold (statt mattem Gelb)
    const REDT  = [217, 104, 95];   // sattes Rot
    const clamp = (v) => Math.max(lo, Math.min(hi, v));
    const ratio = (v) => (clamp(v) - lo) / (hi - lo);
    const ang = (v) => 180 + ratio(v) * 180; // 180°=links .. 360°=rechts (oben über 270°)
    const pt = (t, rad) => { const a = (180 + t * 180) * Math.PI / 180; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    const zones = opts.zones || [[0, 0.34, GREEN], [0.34, 0.66, GOLDT], [0.66, 1, REDT]];
    // Instrument-Tacho (Variante 3): dünner Track-Bogen + Gold-Füllung bis zum Wert +
    // Skalenstriche (lang bei 0/50/100 %) + schlanke weiße Nadel + Gold-Nabe.
    const t = ratio(val);
    const sw = Math.max(2.0, r * 0.11);
    doc.setLineCap('round');
    // Ampel-Bogen (Zonen) wie Web-Karte: grün→gold→rot (bei Miete invertiert)
    zones.forEach(([f, to, c]) => { doc.setLineWidth(sw); doc.setDrawColor(...c); arc(cx, cy, r, 180 + f * 180, 180 + to * 180); });
    doc.setLineCap('butt');
    // Skalenstriche
    for (let i = 0; i <= 10; i++) {
      const lng = (i % 5 === 0);
      const a1 = pt(i / 10, r - sw / 2 - 1.2), a2 = pt(i / 10, r - sw / 2 - 1.2 - (lng ? 2.6 : 1.5));
      doc.setLineWidth(lng ? 0.5 : 0.35); doc.setDrawColor(...(dark ? (lng ? [165, 165, 175] : [95, 95, 105]) : (lng ? [120, 120, 130] : [180, 178, 170])));
      doc.line(a1[0], a1[1], a2[0], a2[1]);
    }
    // optionaler Marker (Kaufpreis)
    if (opts.marker != null) {
      const mp = pt(ratio(opts.marker), r);
      doc.setFillColor(...(opts.markerColor || (dark ? [232, 226, 212] : [150, 142, 120])));
      doc.circle(mp[0], mp[1], 1.6, 'F');
    }
    // Dünne, durchgehende Nadel wie in der Web-Anzeige — KEIN Glow, kleine helle Nabe
    const tip = pt(t, r - sw * 0.9);
    const needleCol = dark ? [232, 232, 234] : [60, 60, 66];
    doc.setLineCap('round');
    doc.setDrawColor(...needleCol); doc.setLineWidth(0.4); doc.line(cx, cy, tip[0], tip[1]);
    doc.setLineCap('butt');
    doc.setFillColor(...needleCol); doc.circle(cx, cy, 0.95, 'F');
    doc.setFillColor(...GOLD); doc.circle(cx, cy, 0.42, 'F');
    // Wert mittig im Tacho (wie Web-Karte) — über der Nadel, mit feinem dunklem Halo für Lesbarkeit
    if (opts.valueText) {
      doc.setFont('helvetica', 'bold');
      let fs = 10.5; doc.setFontSize(fs);
      const maxW = r * 1.78;
      while (doc.getTextWidth(opts.valueText) > maxW && fs > 6.5) { fs -= 0.5; doc.setFontSize(fs); }
      const vy = cy - r * 0.34;
      if (doc.GState) {
        doc.setGState(new doc.GState({ opacity: 0.55 })); doc.setTextColor(6, 6, 8);
        doc.text(opts.valueText, cx + 0.3, vy + 0.3, { align: 'center' });
        doc.setGState(new doc.GState({ opacity: 1 }));
      }
      doc.setTextColor(...(opts.valueColor || [255, 255, 255]));
      doc.text(opts.valueText, cx, vy, { align: 'center' });
    }
    // Labels: lo/hi an den Enden, Caption mittig darunter (Wert steht unter der Anzeige)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...(dark ? [150, 150, 160] : MUT));
    if (opts.loLabel) doc.text(opts.loLabel, cx - r, cy + 6.5, { align: 'center' });
    if (opts.hiLabel) doc.text(opts.hiLabel, cx + r, cy + 6.5, { align: 'center' });
    doc.setFontSize(5.8); doc.setTextColor(...(dark ? [140, 140, 150] : MUT));
    if (opts.caption) doc.text(opts.caption, cx, cy + 6.5, { align: 'center' });
  }
  // Obsidian-Karte mit Gold-Hairline + dezenten Partikeln (DealPilot-Look auf heller Seite)
  // v489: äußerer Gold-Glow (2 Lagen) + goldene Partikel = Hochglanz.
  function obsidianCard(x, cy, w, h) {
    // weicher Aussen-Schatten (Tiefe auf heller Seite)
    if (doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.06 })); doc.setFillColor(20, 20, 23);
      doc.roundedRect(x - 0.6, cy + 1.1, w + 1.2, h, 3.6, 3.6, 'F');
      doc.setGState(new doc.GState({ opacity: 0.04 }));
      doc.roundedRect(x - 1.6, cy + 2.4, w + 3.2, h, 4.2, 4.2, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    // Korpus mit dezentem vertikalem Verlauf (oben minimal heller)
    doc.setFillColor(13, 13, 17); doc.roundedRect(x, cy, w, h, 3, 3, 'F');
    doc.setFillColor(8, 8, 11); doc.roundedRect(x, cy + h * 0.42, w, h * 0.58, 3, 3, 'F');
    doc.setFillColor(8, 8, 11); doc.rect(x, cy + h * 0.42, w, 2, 'F');
    // feine obere Gold-Sheen-Linie (wie Web-Karte)
    if (doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.55 }));
      doc.setDrawColor(232, 199, 102); doc.setLineWidth(0.4);
      doc.line(x + w * 0.30, cy + 0.35, x + w * 0.70, cy + 0.35);
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.35); doc.roundedRect(x, cy, w, h, 3, 3, 'S');
    doc.setFillColor(...GOLD); doc.roundedRect(x, cy + 5, 1.8, h - 10, 0.9, 0.9, 'F');
  }
  // Spannenbalken mit Min/Mid/Max-Labels + optionalem Kaufpreis-Marker
  function rangeBarPro(x, ry, w, lo, mid, hi, fmt, marker, markerLabel) {
    if (lo == null || hi == null || mid == null || hi <= lo) return ry;
    const h = 5; const pos = (v) => x + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * w;
    // Verlauf in 3 Tönen
    doc.setFillColor(238, 236, 230); doc.roundedRect(x, ry, w, h, 1.2, 1.2, 'F');
    doc.setFillColor(214, 226, 214); doc.rect(x, ry, w * 0.34, h, 'F');
    doc.setFillColor(245, 238, 214); doc.rect(x + w * 0.34, ry, w * 0.32, h, 'F');
    doc.setFillColor(245, 224, 214); doc.rect(x + w * 0.66, ry, w * 0.34, h, 'F');
    // Median-Marker (gold)
    const mx = pos(mid); doc.setFillColor(...GOLD); doc.circle(mx, ry + h / 2, 2.3, 'F');
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(mx, ry - 1, mx, ry + h + 1);
    // optionaler Kaufpreis-Marker (blau, Dreieck)
    if (marker != null) {
      const px = pos(marker); doc.setFillColor(150, 142, 120);
      doc.triangle(px - 1.8, ry + h + 1.5, px + 1.8, ry + h + 1.5, px, ry + h - 0.5, 'F');
    }
    // Labels
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TXT);
    doc.text(fmt(lo), x, ry + h + 6);
    doc.setFont('helvetica', 'bold'); doc.text(fmt(mid), mx, ry + h + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.text(fmt(hi), x + w, ry + h + 6, { align: 'right' });
    if (marker != null && markerLabel) {
      doc.setFontSize(7); doc.setTextColor(120, 113, 100);
      doc.text(markerLabel, pos(marker), ry + h + 10.5, { align: 'center' });
      return ry + h + 13;
    }
    return ry + h + 9;
  }

  // Soft-Glow-Orb (ohne Alpha): konzentrische Kreise vom Hintergrund zur Glow-Farbe interpoliert.
  function glowOrb(cx, cy, R, glow, bg, intensity) {
    intensity = intensity == null ? 0.5 : intensity;
    const steps = 26;
    for (let i = steps; i >= 1; i--) {
      const rr = (R * i) / steps;
      const tt = Math.pow(1 - i / steps, 1.7) * intensity; // außen 0 -> innen max
      const col = [0, 1, 2].map((k) => Math.round(bg[k] + (glow[k] - bg[k]) * tt));
      doc.setFillColor(col[0], col[1], col[2]); doc.circle(cx, cy, rr, 'F');
    }
  }

  // Premium-Halbkreis-Tacho: siehe gauge() weiter oben (mit Track + runden Kappen).

  // ===== Theme-Helfer (Deckblatt + Inhalt) =====
  const OBS = [8, 8, 10];
  function leftScrim(col, x0, x1, op0, op1) {
    if (!doc.GState) return; // ältere jsPDF ohne Alpha: dunkle Karte trägt den Text auch so
    const steps = 60, bw = (x1 - x0) / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1), op = op0 + (op1 - op0) * t;
      doc.setGState(new doc.GState({ opacity: Math.max(0, Math.min(1, op)) }));
      doc.setFillColor(col[0], col[1], col[2]); doc.rect(x0 + i * bw, 0, bw + 0.6, H, 'F');
    }
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
  function radarPin(cx, cy, accent) {
    if (doc.GState) {
      // weicher Gold-Halo: gestapelte transparente Scheiben (KEIN Schwarz auf der Karte)
      for (let i = 6; i >= 1; i--) {
        doc.setGState(new doc.GState({ opacity: 0.05 }));
        doc.setFillColor(accent[0], accent[1], accent[2]); doc.circle(cx, cy, i * 5.5, 'F');
      }
      // konzentrische Radar-Ringe (transparent)
      for (let i = 3; i >= 1; i--) {
        doc.setGState(new doc.GState({ opacity: 0.5 - i * 0.11 }));
        doc.setDrawColor(accent[0], accent[1], accent[2]); doc.setLineWidth(0.7);
        doc.circle(cx, cy, 8 + i * 6, 'S');
      }
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    // Pin (Tropfen + weißer Punkt)
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.circle(cx, cy - 4.5, 5.4, 'F');
    doc.triangle(cx - 4.6, cy - 1.4, cx + 4.6, cy - 1.4, cx, cy + 6.6, 'F');
    doc.setFillColor(255, 255, 255); doc.circle(cx, cy - 4.5, 2.0, 'F');
  }
  function drawSkyline(x, baseY, w, maxH, col) {
    doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(0.35);
    const hs = [0.30, 0.55, 0.42, 0.78, 0.5, 0.68, 0.38, 0.88, 0.52, 0.62,
      0.4, 0.72, 0.48, 0.58, 0.82, 0.45, 0.66, 0.36, 0.6, 0.5];
    const bw = w / hs.length;
    hs.forEach((hf, i) => {
      const bh = maxH * hf, bx = x + i * bw;
      doc.lines([[0, -bh], [bw * 0.82, 0], [0, bh]], bx, baseY, [1, 1], 'S');
      if (i % 4 === 2) doc.line(bx + bw * 0.41, baseY - bh, bx + bw * 0.41, baseY - bh - maxH * 0.2);
    });
    doc.line(x, baseY, x + w, baseY);
  }

  // Mini-Vektor-Icons fuers Deckblatt (Stroke-basiert, ~3 mm, Mockup-Look)
  function covIcon(type, x, yy, col, sc) {
    const k = sc || 1; doc.setDrawColor(...col); doc.setLineWidth(0.45); doc.setFillColor(...col);
    if (type === 'pin') {
      doc.circle(x + 1.5 * k, yy - 1.7 * k, 1.25 * k, 'S');
      doc.circle(x + 1.5 * k, yy - 1.7 * k, 0.4 * k, 'F');
      doc.line(x + 0.62 * k, yy - 0.75 * k, x + 1.5 * k, yy + 0.6 * k);
      doc.line(x + 2.38 * k, yy - 0.75 * k, x + 1.5 * k, yy + 0.6 * k);
    } else if (type === 'home') {
      doc.line(x, yy - 0.9 * k, x + 1.4 * k, yy - 2.1 * k); doc.line(x + 1.4 * k, yy - 2.1 * k, x + 2.8 * k, yy - 0.9 * k);
      doc.lines([[0, 1.6 * k], [2.0 * k, 0], [0, -1.6 * k]], x + 0.4 * k, yy - 0.9 * k, [1, 1], 'S');
    } else if (type === 'area') {
      doc.roundedRect(x, yy - 2.2 * k, 2.6 * k, 2.6 * k, 0.3, 0.3, 'S');
      doc.line(x + 0.7 * k, yy - 0.5 * k, x + 1.9 * k, yy - 1.7 * k);
      doc.line(x + 1.3 * k, yy - 1.7 * k, x + 1.9 * k, yy - 1.7 * k); doc.line(x + 1.9 * k, yy - 1.7 * k, x + 1.9 * k, yy - 1.1 * k);
    } else if (type === 'bed') {
      doc.roundedRect(x, yy - 1.6 * k, 3.0 * k, 1.3 * k, 0.25, 0.25, 'S');
      doc.line(x, yy - 0.3 * k, x, yy + 0.3 * k); doc.line(x + 3.0 * k, yy - 0.3 * k, x + 3.0 * k, yy + 0.3 * k);
      doc.circle(x + 0.75 * k, yy - 1.95 * k, 0.42 * k, 'S');
    } else if (type === 'cal') {
      doc.roundedRect(x, yy - 2.1 * k, 2.6 * k, 2.5 * k, 0.3, 0.3, 'S');
      doc.line(x, yy - 1.35 * k, x + 2.6 * k, yy - 1.35 * k);
      doc.line(x + 0.7 * k, yy - 2.45 * k, x + 0.7 * k, yy - 1.85 * k); doc.line(x + 1.9 * k, yy - 2.45 * k, x + 1.9 * k, yy - 1.85 * k);
    } else if (type === 'user') {
      doc.circle(x + 1.3 * k, yy - 1.8 * k, 0.7 * k, 'S');
      doc.lines([[0.35 * k, -0.85 * k], [1.9 * k, 0], [0.35 * k, 0.85 * k]], x, yy + 0.25 * k, [1, 1], 'S');
    } else if (type === 'bars') {
      doc.rect(x, yy - 0.9 * k, 0.6 * k, 0.9 * k, 'F');
      doc.rect(x + 0.9 * k, yy - 1.5 * k, 0.6 * k, 1.5 * k, 'F');
      doc.rect(x + 1.8 * k, yy - 2.1 * k, 0.6 * k, 2.1 * k, 'F');
    }
  }

  // ---------- Deckblatt ----------
  const C = (theme === 'dark') ? {
    bg: OBS, scrim: OBS, scrimOp: 0.94, brand: GOLD, sub: [150, 150, 160], div: GOLD,
    title: [255, 255, 255], addr: [232, 232, 234], obj: [165, 165, 175], eyebrow: [140, 140, 150],
    value: GOLD, range: [188, 188, 196], pin: GOLD, foot: [150, 150, 160], footAccent: GOLD, bar: GOLD,
  } : {
    bg: [255, 255, 255], scrim: [255, 255, 255], scrimOp: 0.86, brand: INK, sub: [120, 120, 130], div: [168, 162, 150],
    title: INK, addr: [44, 44, 50], obj: [120, 120, 130], eyebrow: [130, 130, 140],
    value: GOLD, range: [96, 96, 104], pin: [150, 150, 158], foot: [120, 120, 130], footAccent: [150, 150, 158], bar: [210, 206, 196],
  };
  const LX = 14.3; // Deckblatt-Rand exakt nach Mockup (PIL-vermessen 07.06.)
  doc.setFillColor(...C.bg); doc.rect(0, 0, W, H, 'F');
  // 1. Wahl: Mockup-Artwork (Pin + Glow sind im Bild). 2. Wahl: Live-Karte + eigener Pin.
  let covArtUsed = false;
  if (bgCoverArt) {
    try { doc.addImage(bgCoverArt, 'JPEG', 0, 0, W, H, 'covart'); covArtUsed = true; } catch (e) {}
  }
  if (!covArtUsed) {
    let covMapImg = objImg;
    if (covMapImg && theme === 'dark') covMapImg = await enhanceCoverMap(covMapImg);
    if (covMapImg) { try { doc.addImage(covMapImg, 'JPEG', 0, 0, W, H); } catch (e) { try { doc.addImage(covMapImg, 'PNG', 0, 0, W, H); } catch (e2) {} } }
  }
  // Butterweicher Links-/Unten-Fade (Canvas-Gradient, KEIN Banding) — deckt links/unten ab
  if (theme === 'dark') {
    try { doc.addImage(makeCoverFadePNG(), 'PNG', 0, 0, W, H); } catch (e) { leftScrim(C.scrim, 0, W * 0.62, C.scrimOp, 0); }
  } else {
    leftScrim(C.scrim, 0, W * 0.62, C.scrimOp, 0);
  }
  // Radar-Pin nur bei Live-Karte zeichnen (Artwork bringt den leuchtenden Pin mit)
  if (!covArtUsed) radarPin(165, 132, C.pin);
  // Marke 25pt (Mockup): "Deal" weiss/ink + "Pilot" gold — Baseline 32.4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(25);
  doc.setTextColor(...(theme === 'dark' ? [255, 255, 255] : INK));
  doc.text('Deal', LX, 32.4);
  doc.setTextColor(...GOLD);
  doc.text('Pilot', LX + doc.getTextWidth('Deal'), 32.4);
  doc.setTextColor(...C.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text('MARKTBERICHT', LX, 43.6, { charSpace: 1.9 });
  // Gold-Dash (Mockup: y57.4, 15.8 x 1.2)
  doc.setFillColor(...C.div); doc.rect(LX, 57.4, 15.8, 1.2, 'F');
  // Titel 44pt, zweizeilig — Baselines 92.8 / 109.9 (Mockup)
  doc.setTextColor(...C.title); doc.setFont('helvetica', 'bold'); doc.setFontSize(44);
  doc.text('Marktwert-', LX, 92.8);
  doc.text('einschätzung', LX, 109.9);
  // Feine Gold-Trennlinie UNTER dem Titel — y127.1, Länge 97 (Mockup)
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 0.5 })); }
  doc.setDrawColor(...C.div); doc.setLineWidth(0.4); doc.line(LX, 127.1, LX + 97, 127.1);
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 1 })); }
  // Adresse 2-zeilig (Straße / PLZ Ort) mit Pin-Icon (Mockup)
  const fullAddr = a.formatted || ref.address || '–';
  let addr1 = fullAddr, addr2 = '';
  const ciAddr = fullAddr.indexOf(',');
  if (ciAddr > 0) { addr1 = fullAddr.slice(0, ciAddr).trim(); addr2 = fullAddr.slice(ciAddr + 1).trim(); }
  covIcon('pin', LX, 138.6, C.value, 1.05);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(...C.addr);
  doc.text(addr1, LX + 6.5, 139.2);
  if (addr2) doc.text(addr2, LX + 6.5, 147.2);
  // Objektzeile mit Icons + Trennstrichen (Mockup)
  doc.setFontSize(9.5);
  {
    const segs = [
      ['home', ref.property_type],
      ['area', ref.living_area ? ref.living_area + ' m²' : null],
      ['bed', ref.rooms ? ref.rooms + ' Zi.' : null],
      ['cal', ref.build_year ? 'Bj. ' + ref.build_year : null],
    ].filter((sg) => sg[1]);
    let ox = LX;
    segs.forEach((sg, i) => {
      covIcon(sg[0], ox, 158.6, C.value, 0.95); ox += sg[0] === 'bed' ? 4.6 : 4.2;
      doc.setTextColor(...C.addr); doc.text(String(sg[1]), ox, 158.8); ox += doc.getTextWidth(String(sg[1])) + 3.4;
      if (i < segs.length - 1) { doc.setTextColor(...C.obj); doc.text('|', ox, 158.6); ox += 4.2; }
    });
  }
  // Marktwert prominent — Eyebrow Baseline 217, Wert 51pt Baseline 236.7 (Mockup)
  doc.setFontSize(9); doc.setTextColor(...C.eyebrow);
  doc.text('MARKTWERT-INDIKATION', LX, 217, { charSpace: 1.6 });
  doc.setTextColor(...C.value); doc.setFont('helvetica', 'bold'); doc.setFontSize(51);
  doc.text(euro(mv.estimated), LX, 236.7);
  doc.setFontSize(12.5); doc.setTextColor(...C.range); doc.setFont('helvetica', 'normal');
  if (mv.low != null && mv.high != null)
    doc.text(euro(mv.low) + '  –  ' + euro(mv.high) + (mv.basis_median_sqm ? '   ·   ' + Math.round(mv.basis_median_sqm).toLocaleString('de-DE') + ' €/m²' : ''), LX, 247);
  // Aussagekraft-Pille (Mockup: y255.2, h8.6)
  if (mv.confidence_pct != null) {
    const pl = 'Aussagekraft: ' + mv.confidence_label + ' · ' + mv.confidence_pct + ' %';
    doc.setFontSize(9.5); const pw = doc.getTextWidth(pl) + 17;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.roundedRect(LX, 255.2, pw, 8.6, 4.3, 4.3, 'S');
    covIcon('bars', LX + 4.5, 261.0, GOLD, 0.95);
    doc.setTextColor(...GOLD); doc.text(pl, LX + 11, 260.8);
  }
  // OSM-Lizenz (rechtlich nötig) nur bei Live-Karte; Artwork-Cover braucht sie nicht
  if (!covArtUsed) {
    doc.setFontSize(6.5); doc.setTextColor(...(theme === 'dark' ? [110, 110, 120] : [150, 150, 160]));
    doc.text('\u00A9 OpenStreetMap-Mitwirkende', LX, 271.5);
  }
  // Fußzeile (Mockup: Hairline y278.4, Baseline 284.3)
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 0.45 })); }
  doc.setDrawColor(...C.bar); doc.setLineWidth(0.3); doc.line(LX, 278.4, W - LX, 278.4);
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 1 })); }
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  {
    let fx = LX;
    covIcon('cal', fx, 284.0, C.footAccent, 0.85); fx += 4.2;
    doc.setTextColor(...C.foot); const f1 = 'Erstellt am ' + new Date().toLocaleDateString('de-DE');
    doc.text(f1, fx, 284.3); fx += doc.getTextWidth(f1) + 4;
    doc.setTextColor(...C.obj); doc.text('|', fx, 284.1); fx += 4;
    covIcon('user', fx, 284.0, C.footAccent, 0.85); fx += 4.4;
    doc.setTextColor(...C.foot); doc.text('Junker Immobilien', fx, 284.3);
  }
  doc.setTextColor(...C.footAccent); doc.setFont('helvetica', 'bold');
  doc.text('dealpilot.junker-immobilien.io', W - LX, 284.3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  // Inhaltsverzeichnis-Seite reservieren (wird am Ende gefuellt, wenn alle Sektionen bekannt sind).
  doc.addPage();
  const tocPageNo = doc.getNumberOfPages();
  footer(page);                 // "Seite 1" (= Inhalt)
  doc.addPage(); page++; y = M; contentBg(); // Content ab "Seite 2"

  // ---------- Kennzahlen-Überblick ----------
  sectionTitle('Kennzahlen-Überblick');
  // Score-Panel (dunkel) mit Donut-Ring im DealPilot-Look
  need(54);
  const _sc = ds.score || 0, _scol = _sc >= 70 ? [63, 165, 108] : _sc >= 50 ? GOLD : [184, 98, 80];
  const panH = 46;
  doc.setFillColor(10, 10, 13); doc.roundedRect(M, y, W - 2 * M, panH, 2.5, 2.5, 'F');
  [[0.55, 0.25], [0.7, 0.7], [0.8, 0.4], [0.9, 0.75], [0.62, 0.5], [0.86, 0.2], [0.74, 0.88], [0.48, 0.8]].forEach(([px, py], i) => {
    doc.setFillColor(i % 3 === 0 ? 60 : 40, i % 3 === 0 ? 54 : 40, i % 3 === 0 ? 34 : 48);
    doc.circle(M + px * (W - 2 * M), y + py * panH, i % 3 === 0 ? 0.7 : 0.45, 'F');
  });
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.3); doc.roundedRect(M, y, W - 2 * M, panH, 2.5, 2.5, 'S');
  doc.setFillColor(...GOLD); doc.roundedRect(M, y + 6, 2, panH - 12, 1, 1, 'F');
  glowOrb(M + 30, y + 23, 17, _scol, [10, 10, 13], 0.18); // Score-Glow hinter Donut
  scoreDonut(M + 30, y + 23, 16, ds.score);
  const sbx = M + 58;
  doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('DEAL-SCORE', sbx, y + 12, { charSpace: 1.2 });
  doc.setTextColor(..._scol); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text(ds.rating ?? '–', sbx, y + 25);
  const _rw = doc.getTextWidth(ds.rating ?? '–'); doc.setFillColor(..._scol); doc.rect(sbx, y + 28, Math.min(_rw, 70), 0.8, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(178, 178, 188);
  const scoreText = (ds.score >= 75) ? 'Sehr attraktives Chance-Risiko-Profil.'
    : (ds.score >= 60) ? 'Attraktives Objekt mit solider Ausgangslage.'
    : (ds.score >= 45) ? 'Durchschnittliches Profil – Detailprüfung empfohlen.'
    : 'Erhöhtes Risiko – kritische Prüfung nötig.';
  const stl = doc.splitTextToSize(scoreText, W - 2 * M - (sbx - M) - 8);
  doc.text(stl, sbx, y + 35);
  y += panH + 7;
  // Score-Zusammensetzung: macht sichtbar, woraus sich der Deal-Score speist (Backend-Breakdown)
  {
    const bd0 = ds.breakdown || {};
    const COMP = [['Preisabschlag', 'preisabschlag', 30], ['Bruttorendite', 'bruttorendite', 20],
      ['Makrolage', 'makrolage', 20], ['Mikrolage', 'mikrolage', 15],
      ['Mietentwicklung', 'mietentwicklung', 10], ['Risiko', 'risiko', 5]];
    const have = COMP.filter(([, k]) => bd0[k] != null);
    if (have.length) {
      need(26);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
      doc.text('SCORE-ZUSAMMENSETZUNG', M, y + 3, { charSpace: 1.1 });
      const cw2 = (W - 2 * M) / have.length;
      have.forEach(([lab, k, wt], i) => {
        const x = M + i * cw2, v = Math.max(0, Math.min(100, bd0[k]));
        const c = v >= 70 ? [67, 183, 124] : v >= 50 ? [201, 168, 76] : [217, 104, 95];
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...c);
        doc.text(String(Math.round(v)), x, y + 10);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(130, 130, 138);
        doc.text('· Gewicht ' + wt + ' %', x + doc.getTextWidth(String(Math.round(v))) + 2, y + 10);
        const bw2 = cw2 - 8;
        doc.setFillColor(232, 230, 224); doc.roundedRect(x, y + 12, bw2, 1.6, 0.8, 0.8, 'F');
        doc.setFillColor(...c); doc.roundedRect(x, y + 12, Math.max(1.6, bw2 * v / 100), 1.6, 0.8, 0.8, 'F');
        doc.setFontSize(6.6); doc.setTextColor(...MUT);
        doc.text(lab, x, y + 17.4);
      });
      doc.setFontSize(6.4); doc.setTextColor(150, 150, 158);
      doc.text('Deal-Score = gewichtete Summe der Teilwerte (0–100): 30 % Preisabschlag · 20 % Bruttorendite · 20 % Makro · 15 % Mikro · 10 % Mietentwicklung · 5 % Risiko.', M, y + 22);
      y += 26;
    }
  }
  // DealScore 2 (DealPilot) bzw. Vereinfacht-Hinweis
  const dsm = d.dealscore_meta;
  if (dsm && !dsm.simplified) {
    need(13);
    doc.setFillColor(245, 242, 232); doc.roundedRect(M, y, W - 2 * M, 11, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text('DealScore 2 (DealPilot): ' + dsm.value + ' / 100', M + 4, y + 7);
    const k = dsm.kpis || {};
    const parts = [];
    if (k.dscr != null) parts.push('DSCR ' + (k.dscr.toFixed ? k.dscr.toFixed(2) : k.dscr));
    if (k.ltv_pct != null) parts.push('LTV ' + Math.round(k.ltv_pct) + ' %');
    if (k.cashflow_monthly != null) parts.push('Cashflow ' + Math.round(k.cashflow_monthly) + ' €/M');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 98);
    if (parts.length) doc.text(parts.join('   ·   '), W - M - 4, y + 7, { align: 'right' });
    y += 16;
  } else if (dsm && dsm.simplified) {
    need(11);
    doc.setFontSize(8); doc.setTextColor(150, 150, 160);
    const nl = doc.splitTextToSize('Vereinfachter Score ohne Finanzierungsdaten – für den vollen DealScore 2 ein DealPilot-Objekt laden.', W - 2 * M);
    doc.text(nl, M, y); y += nl.length * 4 + 3;
  }
  // KPI-Kacheln 3×2
  const tw = (W - 2 * M - 2 * 4) / 3, th = 18;
  const tiles = [
    ['Marktwert', mv.estimated != null ? euro(mv.estimated) : null, GOLD],
    ['Bruttorendite', yld.gross_yield_pct != null ? yld.gross_yield_pct + ' %' : null, [67, 183, 124]],
    ['Kaufpreisfaktor', yld.rent_multiplier != null ? yld.rent_multiplier : null, [150, 142, 120]],
    ['Abw. z. Marktwert', mv.discount_to_market_pct != null ? mv.discount_to_market_pct + ' %' : null, GOLD],
    ['Kaufpreis €/m²', inp.price_per_sqm ? Math.round(inp.price_per_sqm).toLocaleString('de-DE') + ' €' : null, [138, 138, 147]],
    ['Marktmiete €/m²', inp.market_rent_sqm ? inp.market_rent_sqm.toLocaleString('de-DE') + ' €' : null, [138, 138, 147]],
  ].filter((t) => t[1] != null); // leere Kacheln (z.B. Kauf-Szenario ohne Preis) NICHT zeigen
  const tileRows = Math.ceil(tiles.length / 3);
  need(tileRows * (th + 4));
  tiles.forEach((t, i) => {
    const cx = M + (i % 3) * (tw + 4), cy = y + Math.floor(i / 3) * (th + 4);
    tile(cx, cy, tw, th, t[0], t[1], t[2]);
  });
  y += tileRows * (th + 4) + 2;
  // Marktwert-Spanne-Balken
  if (mv.low != null && mv.high != null && mv.estimated != null) {
    need(20); doc.setFontSize(8); doc.setTextColor(...MUT); doc.text('MARKTWERT-SPANNE', M, y); y += 4;
    if (rangeBar(M, y, W - 2 * M, mv.low, mv.estimated, mv.high)) {
      y += 8; doc.setFontSize(8.5); doc.setTextColor(...TXT);
      doc.text(euro(mv.low), M, y);
      doc.setFont('helvetica', 'bold'); doc.text(euro(mv.estimated), M + (W - 2 * M) / 2, y, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.text(euro(mv.high), W - M, y, { align: 'right' });
      y += 8;
    }
  }
  // Aussagekraft: kombinierte Konfidenz (Marktdaten-Stichprobe + Vollständigkeit der Objektangaben)
  const cval = mv.confidence != null ? mv.confidence : (d.sale && d.sale.confidence);
  const ci = confInfo(cval);
  if (mv.confidence_pct != null || ci) {
    need(24); doc.setFontSize(8); doc.setTextColor(...MUT); doc.text('AUSSAGEKRAFT DER INDIKATION', M, y); y += 5;
    const pct = mv.confidence_pct;
    const lbl = mv.confidence_label || (ci && ci.label) || '';
    const cc = pct != null ? (pct >= 70 ? [63, 165, 108] : pct >= 55 ? GOLD : [184, 98, 80])
      : (ci && ci.color === '#3FA56C' ? [63, 165, 108] : ci && ci.color === '#C9A84C' ? GOLD : [184, 98, 80]);
    doc.setFillColor(...cc); doc.circle(M + 2, y - 1, 1.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...cc);
    const head = pct != null ? `${lbl} · ${pct} %` : `Konfidenz: ${lbl}`;
    doc.text(head, M + 6, y);
    const ns = d.sale && d.sale.sample_size;
    const meta = [ns ? ns.toLocaleString('de-DE') + ' Vergleiche' : null,
      mv.input_filled != null ? `${mv.input_filled}/${mv.input_total} Objektangaben` : null].filter(Boolean).join(' · ');
    if (meta) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUT);
      doc.text('(' + meta + ')', M + 6 + doc.getTextWidth(head) + 4, y);
    }
    y += 6;
    if (pct != null) {
      const bw = W - 2 * M;
      doc.setFillColor(235, 233, 227); doc.roundedRect(M, y, bw, 2.6, 1.3, 1.3, 'F');
      doc.setFillColor(...cc); doc.roundedRect(M, y, bw * Math.max(0.04, pct / 100), 2.6, 1.3, 1.3, 'F');
      y += 7;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...TXT);
    const msg = (mv.input_missing && mv.input_missing.length)
      ? 'Genauer wird die Bewertung mit: ' + mv.input_missing.join(', ') + '.'
      : (ci ? ci.text : 'Alle wertrelevanten Objektangaben berücksichtigt.');
    const cw = doc.splitTextToSize(msg, W - 2 * M); doc.text(cw, M, y); y += cw.length * 4.4;
  }
  y += 2;

  // ---------- Stammdaten ----------
  sectionTitle('Objekt-Stammdaten', 60);
  const col = (W - 2 * M) / 3; const rows = [
    ['Objekttyp', ref.property_type], ['Wohnfläche', ref.living_area ? ref.living_area + ' m²' : null], ['Zimmer', ref.rooms],
    ['Baujahr', ref.build_year], ['Etage', ref.floor], ['Energieklasse', ref.energy_class],
    ['Zustand', ref.condition || '–'], ['Ausstattung', ref.quality || '–'], ['Modernisierung', ref.modernization || '–'],
  ];
  if (ref.modernization_year) rows.push(['Modernisierungsjahr', ref.modernization_year]);
  if (ref.bathrooms) rows.push(['Badezimmer', ref.bathrooms]);
  if (ref.balcony_area) rows.push(['Balkon/Terrasse', ref.balcony_area + ' m²']);
  if (ref.garden_area) rows.push(['Garten', ref.garden_area + ' m²']);
  if (ref.plot_area) rows.push(['Grundstück', Math.round(ref.plot_area).toLocaleString('de-DE') + ' m²']);
  if (ref.units) rows.push(['Wohneinheiten', ref.units]);
  const stell = [ref.garages ? ref.garages + ' Garage/TG' : null, ref.outdoor_parking ? ref.outdoor_parking + ' außen' : null].filter(Boolean).join(' · ');
  if (stell) rows.push(['Stellplätze', stell]);
  if (ref.elevator) rows.push(['Aufzug', 'ja']);
  rows.push(['Kaufpreis', euro(ref.purchase_price)], ['Kaltmiete/Monat', euro(ref.monthly_net_rent)]);
  for (let i = 0; i < rows.length; i += 3) {
    need(14);
    for (let j = 0; j < 3 && i + j < rows.length; j++) kv(rows[i + j][0], rows[i + j][1], M + j * col, col);
    y += 14;
  }
  y += 2;

  // -- Energie-Label-Skala (A+..H, farbig, Marker auf der Objektklasse) --
  const enCls = ref.energy_class ? String(ref.energy_class).toUpperCase().trim() : null;
  if (enCls) {
    const SCALE = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const COLS = [[46,168,104],[78,176,110],[140,190,90],[190,200,80],[218,196,70],[218,168,70],[214,134,72],[200,100,80],[184,82,80]];
    const idx = SCALE.indexOf(enCls);
    if (idx >= 0) {
      need(18);
      doc.setFontSize(8); doc.setTextColor(...MUT); doc.text('ENERGIEKLASSE', M, y + 3, { charSpace: 0.8 });
      const segW = (W - 2 * M) / SCALE.length, segH = 6, sy = y + 6;
      SCALE.forEach((s, i) => {
        const sx = M + i * segW;
        doc.setFillColor(...(i === idx ? COLS[i] : COLS[i].map((c) => Math.round(c + (250 - c) * 0.72))));
        doc.roundedRect(sx, sy, segW - 1.2, segH, 1, 1, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', i === idx ? 'bold' : 'normal');
        doc.setTextColor(...(i === idx ? [255, 255, 255] : [120, 120, 128]));
        doc.text(s, sx + (segW - 1.2) / 2, sy + 4.2, { align: 'center' });
      });
      // Marker-Dreieck über der Objektklasse
      const mx = M + idx * segW + (segW - 1.2) / 2;
      doc.setFillColor(...COLS[idx]);
      doc.triangle(mx - 2, sy - 1.2, mx + 2, sy - 1.2, mx, sy + 1.4, 'F');
      doc.setFont('helvetica', 'normal');
      y = sy + segH + 6;
    }
  }

  // ---------- Marktwert & Marktmiete (Gauge + Spannenbalken) ----------
  sectionTitle('Marktwert & Marktmiete', 104);
  const area = ref.living_area;
  const blockW = W - 2 * M;

  // -- Marktwert & Marktmiete: zwei Karten nebeneinander (Web-Karten-Look) --
  const rmed = d.rent && d.rent.median_per_sqm;
  const rMonth = (rmed && area) ? Math.round(rmed * area) : null;
  const rLo = (d.rent && d.rent.q25_per_sqm && area) ? Math.round(d.rent.q25_per_sqm * area) : null;
  const rHi = (d.rent && d.rent.q75_per_sqm && area) ? Math.round(d.rent.q75_per_sqm * area) : null;
  if (mv.estimated != null || rmed) {
    const hw = (blockW - 6) / 2, ch = 92;
    need(ch + 6);
    const sale = d.sale || {};
    const fmtSqm = (v, dec) => (v != null ? (dec ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('de-DE')) : null);
    const segMW = [[0, 0.33, [67, 183, 124]], [0.34, 0.66, [201, 168, 76]], [0.67, 1, [217, 104, 95]]];
    const segMiete = [[0, 0.33, [217, 104, 95]], [0.34, 0.66, [201, 168, 76]], [0.67, 1, [67, 183, 124]]];
    const drawValueCard = (x, o) => {
      obsidianCard(x, y, hw, ch);
      const ix = x + 8, iw = hw - 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(165, 165, 175);
      doc.text(o.title, ix, y + 10, { charSpace: 1.1 });
      // Tacho zentral, Wert im Tacho (wie Web-Karte)
      gauge(x + hw / 2, y + 38, 16.5, o.lo, o.hi, o.val, {
        dark: true, caption: o.caption,
        loLabel: o.loLbl, hiLabel: o.hiLbl, marker: o.marker, markerColor: [232, 226, 212],
        zones: o.zones, valueText: o.valTxt, valueColor: [255, 255, 255],
      });
      // grosser Wert + Median-Zeile + €/m²-Spanne — Wert auto-skaliert, damit er nie ueberlaeuft
      doc.setFont('helvetica', 'bold');
      let vfs = 20; doc.setFontSize(vfs);
      while (doc.getTextWidth(o.valTxt) > iw && vfs > 12) { vfs -= 1; doc.setFontSize(vfs); }
      doc.setTextColor(...o.valCol);
      doc.text(o.valTxt, ix, y + 58);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(200, 200, 208);
      if (o.medLine) doc.text(o.medLine, ix, y + 64);
      doc.setFontSize(7); doc.setTextColor(150, 150, 160);
      if (o.spanLine) doc.text(o.spanLine, ix, y + 68.5);
      // Spannen-Balken mit Gold-Punkt (Wert) + weissem Dreieck (Kaufpreis)
      if (o.lo != null && o.hi != null && o.hi > o.lo) {
        const by = y + 72.5, bh = 2.6;
        o.segs.forEach(([f, t, c]) => {
          doc.setFillColor(...c);
          doc.roundedRect(ix + iw * f, by, iw * (t - f), bh, bh / 2, bh / 2, 'F');
        });
        const frac = Math.max(0, Math.min(1, (o.val - o.lo) / (o.hi - o.lo)));
        const mxp = ix + iw * frac;
        if (doc.GState) { doc.setGState(new doc.GState({ opacity: 0.28 })); doc.setFillColor(...GOLD); doc.circle(mxp, by + bh / 2, 2.6, 'F'); doc.setGState(new doc.GState({ opacity: 1 })); }
        doc.setFillColor(...GOLD); doc.circle(mxp, by + bh / 2, 1.7, 'F');
        doc.setFillColor(255, 255, 255); doc.circle(mxp, by + bh / 2, 0.6, 'F');
        if (o.marker != null && o.marker >= o.lo && o.marker <= o.hi) {
          const kf = (o.marker - o.lo) / (o.hi - o.lo), kx = ix + iw * kf;
          doc.setFillColor(232, 226, 212);
          doc.triangle(kx - 1.5, by - 1.6, kx + 1.5, by - 1.6, kx, by + 0.4, 'F');
        }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(150, 150, 160);
        doc.text(o.loFull, ix, by + bh + 4);
        doc.text(o.hiFull, ix + iw, by + bh + 4, { align: 'right' });
      }
      // Fusszeile der Karte: Aussagekraft (MW) bzw. Kaufpreis-Hinweis
      if (o.foot) {
        doc.setFillColor(...o.footCol); doc.circle(ix + 1.2, y + ch - 6.6, 1.2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...o.footCol);
        doc.text(o.foot, ix + 4, y + ch - 5.6);
      }
    };
    if (mv.estimated != null) {
      const cl = mv.confidence_label || '', cp = mv.confidence_pct;
      const footCol = (cp != null && cp >= 75) ? [67, 183, 124] : (cp != null && cp >= 50) ? [217, 180, 90] : [217, 104, 95];
      drawValueCard(M, {
        title: 'MARKTWERT (INDIKATION)',
        lo: mv.low, hi: mv.high, val: mv.estimated,
        valTxt: euro(mv.estimated), valCol: GOLD, caption: 'Lage in der Spanne',
        loLbl: mv.low != null ? Math.round(mv.low / 1000) + 'k' : null,
        hiLbl: mv.high != null ? Math.round(mv.high / 1000) + 'k' : null,
        marker: ref.purchase_price, zones: undefined, segs: segMW,
        medLine: mv.basis_median_sqm ? fmtSqm(mv.basis_median_sqm) + ' €/m²  ·  Median' : null,
        spanLine: (sale.q25_per_sqm != null && sale.q75_per_sqm != null)
          ? 'Spanne ' + fmtSqm(sale.q25_per_sqm) + ' – ' + fmtSqm(sale.q75_per_sqm) + ' €/m²' : null,
        loFull: mv.low != null ? euro(mv.low) : '', hiFull: mv.high != null ? euro(mv.high) : '',
        foot: (cl && cp != null) ? 'Aussagekraft: ' + cl + ' · ' + cp + ' %' : null, footCol,
      });
    }
    if (rmed) {
      drawValueCard(mv.estimated != null ? M + hw + 6 : M, {
        title: 'MARKTMIETE KALT (MONAT)',
        lo: rLo, hi: rHi, val: rMonth != null ? rMonth : rmed,
        valTxt: rMonth != null ? euro(rMonth) : rmed.toLocaleString('de-DE') + ' €/m²',
        valCol: [255, 255, 255], caption: 'Mietspanne',
        loLbl: rLo != null ? rLo + '€' : null, hiLbl: rHi != null ? rHi + '€' : null,
        marker: null, zones: [[0, 0.34, [184, 98, 80]], [0.34, 0.66, [201, 168, 76]], [0.66, 1, [46, 168, 104]]],
        segs: segMiete,
        medLine: fmtSqm(rmed, true) + ' €/m²  ·  Median',
        spanLine: (d.rent.q25_per_sqm != null && d.rent.q75_per_sqm != null)
          ? 'Spanne ' + fmtSqm(d.rent.q25_per_sqm, true) + ' – ' + fmtSqm(d.rent.q75_per_sqm, true) + ' €/m²' : null,
        loFull: rLo != null ? euro(rLo) : '', hiFull: rHi != null ? euro(rHi) : '',
        foot: ref.purchase_price != null && rMonth != null
          ? 'Brutto-Faktor: ' + (ref.purchase_price / (rMonth * 12)).toFixed(1) : null,
        footCol: [165, 165, 175],
      });
    }
    y += ch + 6;
  }

  // -- €/m²-Spannen (Kauf + Miete) nebeneinander --
  need(24);
  const halfW = (blockW - 6) / 2;
  doc.setFontSize(8); doc.setTextColor(...MUT);
  doc.text('KAUFPREIS €/m²', M, y + 4);
  doc.text('MIETE €/m²', M + halfW + 6, y + 4);
  const sale = d.sale || {};
  if (sale.q25_per_sqm != null && sale.q75_per_sqm != null && sale.median_per_sqm != null) {
    rangeBarPro(M, y + 8, halfW, sale.q25_per_sqm, sale.median_per_sqm, sale.q75_per_sqm,
      (v) => Math.round(v).toLocaleString('de-DE') + ' €', inp.price_per_sqm, null);
  }
  if (d.rent && d.rent.q25_per_sqm != null && d.rent.q75_per_sqm != null && rmed != null) {
    rangeBarPro(M + halfW + 6, y + 8, halfW, d.rent.q25_per_sqm, rmed, d.rent.q75_per_sqm,
      (v) => v.toLocaleString('de-DE') + ' €', null, null);
  }
  y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT);
  doc.text('Spanne = mittlere 50 % der Vergleichsangebote (Quartile q25–q75) · Mitte = Median · Dreieck = dieses Objekt', M, y);
  y += 4;
  // Gesamtspanne (min–max) der Vergleichsdaten als Zusatzinfo
  if ((sale.min_per_sqm != null && sale.max_per_sqm != null) || (d.rent && d.rent.min_per_sqm != null && d.rent.max_per_sqm != null)) {
    const gp = [];
    if (sale.min_per_sqm != null && sale.max_per_sqm != null)
      gp.push('Kauf gesamt ' + Math.round(sale.min_per_sqm).toLocaleString('de-DE') + '–' + Math.round(sale.max_per_sqm).toLocaleString('de-DE') + ' €/m²');
    if (d.rent && d.rent.min_per_sqm != null && d.rent.max_per_sqm != null)
      gp.push('Miete gesamt ' + d.rent.min_per_sqm.toLocaleString('de-DE') + '–' + d.rent.max_per_sqm.toLocaleString('de-DE') + ' €/m²');
    doc.text('Gesamtspanne aller Vergleiche: ' + gp.join('  ·  '), M, y + 3.5);
    y += 9;
  }

  // KPIs
  need(16);
  const kpis = [
    yld.gross_yield_pct != null ? ['Bruttorendite', yld.gross_yield_pct + ' %'] : null,
    yld.rent_multiplier != null ? ['Kaufpreisfaktor', yld.rent_multiplier] : null,
    ds.score != null ? ['Deal-Score', ds.score + ' (' + (ds.rating ?? '–') + ')'] : null,
  ].filter(Boolean);
  if (kpis.length) { kpis.forEach((k, i) => kv(k[0], k[1], M + i * col, col)); y += 16; }

  // ---------- Preisstrategie (Min — Marktwert — Max) ----------
  if (mv.estimated != null && mv.low != null && mv.high != null && mv.high > mv.low) {
    sectionTitle('Preisstrategie', 46);
    need(40);
    const pw = blockW, ph = 7, py0 = y + 16;
    const span = mv.high - mv.low;
    const px = (v) => M + (Math.max(mv.low, Math.min(mv.high, v)) - mv.low) / span * pw;
    // Kopfwerte: Mindest | Marktwert | Maximal
    const colsW = pw / 3;
    const head3 = (lab, val, sub, cx, big, goldVal) => {
      doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.text(lab, cx, y + 3, { align: 'center', charSpace: 0.6 });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 15 : 11.5);
      doc.setTextColor(...(goldVal ? GOLD : TXT)); doc.text(val, cx, y + (big ? 10 : 9), { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
      if (sub) doc.text(sub, cx, y + 13.5, { align: 'center' });
    };
    const sq = (v) => area ? Math.round(v / area).toLocaleString('de-DE') + ' €/m²' : null;
    head3('MINDESTPREIS', euro(mv.low), sq(mv.low), M + colsW * 0.5, false, false);
    head3('MARKTWERT (INDIKATION)', euro(mv.estimated), sq(mv.estimated), M + colsW * 1.5, true, true);
    head3('MAXIMALPREIS', euro(mv.high), sq(mv.high), M + colsW * 2.5, false, false);
    // Band im Vorlagen-Look: helle Aussen-Segmente + dunkler Kern, mit feinen Luecken
    const ph2 = 5.5, gap = 1.6;
    doc.setFillColor(214, 212, 206); doc.roundedRect(M, py0, pw * 0.115 - gap, ph2, 1.6, 1.6, 'F');
    doc.setFillColor(...INK); doc.roundedRect(M + pw * 0.115, py0, pw * 0.77, ph2, 1.6, 1.6, 'F');
    doc.setFillColor(214, 212, 206); doc.roundedRect(M + pw * 0.885 + gap, py0, pw * 0.115 - gap, ph2, 1.6, 1.6, 'F');
    // Marktwert-Marker (gold)
    const mx = px(mv.estimated);
    doc.setFillColor(...GOLD); doc.triangle(mx - 2.8, py0 - 2.0, mx + 2.8, py0 - 2.0, mx, py0 + 2.4, 'F');
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.7); doc.line(mx, py0, mx, py0 + 5.5);
    // Kaufpreis-Marker (falls vorhanden)
    if (ref.purchase_price != null) {
      const kx = px(ref.purchase_price);
      doc.setFillColor(150, 142, 120);
      doc.triangle(kx - 2, py0 + 5.5 + 2.4, kx + 2, py0 + 5.5 + 2.4, kx, py0 + 5.5 - 0.2, 'F');
      doc.setFontSize(7); doc.setTextColor(120, 113, 100);
      doc.text('Kaufpreis ' + euro(ref.purchase_price), kx, py0 + 5.5 + 6.5, { align: 'center' });
    }
    y = py0 + 5.5 + (ref.purchase_price != null ? 10 : 6);
    doc.setFontSize(7); doc.setTextColor(...MUT);
    {
      const recl = doc.splitTextToSize('Empfehlung: Angebote unterhalb des Marktwerts bieten Verhandlungspuffer; oberhalb des Maximalpreises ist besondere Begründung (Lage, Zustand, Ausstattung) erforderlich.', W - 2 * M);
      doc.text(recl, M, y);
      y += recl.length * 3.6 + 2.5;
    }
  }

  // ---------- Bodenrichtwert (BORIS) ----------
  const lv = d.land_value;
  if (lv && lv.available && lv.value_sqm != null) {
    sectionTitle('Bodenrichtwert (amtlich)');
    need(30);
    doc.setFillColor(...INK); doc.roundedRect(M, y, blockW, 26, 2, 2, 'F');
    doc.setFillColor(...GOLD); doc.roundedRect(M, y, 2.5, 26, 1, 1, 'F');
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('BODENRICHTWERT', M + 8, y + 8);
    doc.setTextColor(255, 255, 255); doc.setFontSize(22);
    doc.text(Math.round(lv.value_sqm).toLocaleString('de-DE') + ' €/m²', M + 8, y + 19);
    const lcomp = (d.valuation && d.valuation.land_component) || null;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 188);
    const info = [];
    if (lv.nutzung) info.push('Nutzung ' + lv.nutzung);
    if (lv.stichtag) info.push('Stichtag ' + lv.stichtag);
    if (lv.used_year) info.push('Jahrgang ' + lv.used_year);
    doc.text(info.join('  ·  '), M + 60, y + 9);
    doc.setTextColor(210, 210, 216); doc.setFontSize(9);
    if (lcomp && lcomp.land_value_total_eur != null) {
      doc.text('Grundstück ' + Math.round(lcomp.plot_area_sqm).toLocaleString('de-DE') + ' m² · Bodenwert ' + euro(lcomp.land_value_total_eur), M + 60, y + 16);
    } else {
      const bodenAnteil = area && lv.value_sqm ? Math.round(lv.value_sqm * area) : null;
      if (bodenAnteil != null) doc.text('Rechnerischer Bodenwertanteil (' + area + ' m²): ' + euro(bodenAnteil), M + 60, y + 16);
    }
    doc.setFontSize(7); doc.setTextColor(150, 150, 160);
    if (lv.license) doc.text(lv.license, M + 60, y + 22);
    y += 30;
    if (lcomp && lcomp.value_eur > 0) {
      need(8);
      doc.setFontSize(8); doc.setTextColor(120, 113, 100);
      doc.text('Im Marktwert berücksichtigt: +' + euro(lcomp.value_eur) + ' Mehrflächen-Bodenwert (' +
        Math.round(lcomp.excess_sqm).toLocaleString('de-DE') + ' m² über typischem Grundstück von ' + lcomp.typical_plot_sqm +
        ' m², Marktfaktor ' + lcomp.market_factor + ').', M, y);
      y += 7;
    }
  }



  // ---------- Wertverfahren im Vergleich (Sachwert/Ertragswert-Quercheck) ----------
  const cc = d.cross_check;
  if (cc && cc.available && cc.comparison) {
    sectionTitle('Wertverfahren im Vergleich', 70);
    need(56);
    const cardW = (blockW - 12) / 3, cardH = 40;
    const card3 = (x, title, value, lines, lead) => {
      doc.setFillColor(...(lead ? INK : [245, 243, 238])); doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'F');
      doc.setFillColor(...GOLD); doc.roundedRect(x, y, 2, cardH, 1, 1, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6);
      doc.setTextColor(...(lead ? GOLD : [120, 113, 100]));
      doc.text(title, x + 6, y + 7, { charSpace: 0.3 });
      doc.setFontSize(15); doc.setTextColor(...(lead ? GOLD : TXT));
      doc.text(value != null ? euro(value) : '–', x + 6, y + 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(...(lead ? [185, 185, 192] : [110, 110, 118]));
      let ly = y + 22;
      lines.filter(Boolean).slice(0, 4).forEach((l) => { doc.text(l, x + 6, ly); ly += 4.4; });
    };
    const sw = cc.sachwert || {}, ew = cc.ertragswert || {};
    card3(M, 'VERGLEICHSWERT · FÜHREND', cc.comparison.vergleichswert_eur, [
      mv.basis_median_sqm ? Math.round(mv.basis_median_sqm).toLocaleString('de-DE') + ' €/m² Median' : null,
      (d.sale && d.sale.sample_size) ? d.sale.sample_size + ' Vergleichsangebote' : null,
      'Vergleichswertverfahren (führend)',
    ], true);
    card3(M + cardW + 6, 'SACHWERT · INDIKATIV', sw.available ? sw.value_eur : null, sw.available ? [
      sw.bodenwert_eur != null ? 'Bodenwert ' + euro(sw.bodenwert_eur) : 'ohne Bodenwert',
      'Gebäude ' + euro(sw.gebaeude_sachwert_eur),
      'RND ' + sw.restnutzungsdauer_jahre + ' J. / GND ' + (cc.assumptions.gnd_jahre) + ' J.',
    ] : ['nicht berechenbar']);
    card3(M + 2 * (cardW + 6), 'ERTRAGSWERT · INDIKATIV', ew.available ? ew.value_eur : null, ew.available ? [
      'Rohertrag ' + euro(ew.rohertrag_pa_eur) + ' p.a.',
      'Reinertrag ' + euro(ew.reinertrag_pa_eur) + ' p.a.',
      'LZ ' + ew.liegenschaftszins_pct + ' % · V ' + ew.vervielfaeltiger,
    ] : ['nicht berechenbar']);
    y += cardH + 5;
    if (cc.comparison.spread_pct != null) {
      doc.setFontSize(8); doc.setTextColor(...TXT);
      const sp = cc.comparison.spread_pct;
      doc.text('Verfahrens-Spread: ' + sp.toLocaleString('de-DE') + ' % — ' +
        (sp <= 15 ? 'die Verfahren stützen sich gegenseitig (hohe Plausibilität der Indikation).'
          : sp <= 30 ? 'moderate Abweichung; Objektbesonderheiten prüfen.'
          : 'große Abweichung; Wert nur mit weiterer Prüfung verwenden.'), M, y + 3);
      y += 7;
    }
    doc.setFontSize(6.5); doc.setTextColor(...MUT);
    doc.text('Vereinfachte Verfahren n. ImmoWertV-Logik (indikativ): NHK 2010 ' + cc.assumptions.nhk_efh_bgf_eur + ' €/m² BGF × Baupreisindex ' +
      cc.assumptions.baupreisindex_2010_heute + ' · BWK ' + Math.round(cc.assumptions.bwk_quote * 100) + ' % · Liegenschaftszins ' +
      (cc.assumptions.liegenschaftszins * 100) + ' % · Sachwertfaktor ' + cc.assumptions.sachwertfaktor + '. Kein Gutachten n. § 194 BauGB.', M, y + 3);
    y += 8;
  }

  // ---------- Lage-/Potenzialbewertung ----------
  const _z = d.zensus;
  const _arProbe = d.assessment ? Object.values(d.assessment).filter((v) => v != null && v !== '').length : 0;
  if ((_arProbe >= 2) || (_z && _z.available)) {
    sectionTitle('Lage- & Potenzialbewertung');
    const A = d.assessment || {}; const ar = [
      ['Mikrolage', A.mikrolage], ['Makrolage', A.makrolage], ['Bevölkerungsentwicklung', A.bevoelkerung],
      ['Nachfrage', A.nachfrage], ['Entwicklungsmöglichkeiten', A.entwicklung], ['Wertsteigerungspotenzial', A.wertsteigerung],
      ['Mietausfallrisiko', A.mietausfallrisiko], ['Ausstattung', A.ausstattung], ['Vermietungsstand', A.vermietungsstand],
    ].filter((r) => r[1] != null && r[1] !== '');
    // Zensus-2022-Kennzahlen (amtlich) anhaengen:
    if (_z && _z.available) {
      const de = (n, dec) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
      if (_z.leerstandsquote != null) ar.push(['Leerstandsquote (Zensus 2022)', de(_z.leerstandsquote, 1) + ' %']);
      if (_z.eigentuemerquote != null) ar.push(['Eigentümerquote (Zensus 2022)', de(_z.eigentuemerquote, 1) + ' %']);
      if (_z.nettokaltmiete_qm != null) ar.push(['Ø Nettokaltmiete (Zensus 2022)', de(_z.nettokaltmiete_qm, 2) + ' €/m²']);
    }
    const rateCol = (label, v) => {
      const s = String(v || '').toLowerCase();
      let c = MUT;
      if (/(sehr gut|gut|hoch|stabil|steigend|positiv|wachsend|neuwertig|gehoben|vollvermietet)/.test(s)) c = [63, 165, 108];
      else if (/(mittel|durchschnitt|moderat|normal)/.test(s)) c = GOLD;
      else if (/(begrenzt|niedrig|gering|schwach|fallend|rückläufig|negativ|leer)/.test(s)) c = [184, 98, 80];
      if (/risiko/.test(label.toLowerCase())) { if (c[0] === 63) c = [184, 98, 80]; else if (c[0] === 184) c = [63, 165, 108]; }
      return c;
    };
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, theme: 'plain',
      body: ar.map((r) => [r[0], String(r[1])]),
      styles: { fontSize: 9.5, cellPadding: 2.4, textColor: TXT },
      columnStyles: { 0: { textColor: MUT, cellWidth: 72 }, 1: { fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = rateCol(ar[data.row.index][0], ar[data.row.index][1]);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 6;
    if (_z && _z.available && _z.license) { need(6); doc.setFontSize(7); doc.setTextColor(...MUT);
      doc.text('Zensus-Kennzahlen: ' + _z.license, M, y); y += 5; }
    if (A.marktmiete_eur_qm != null) { need(8); doc.setFontSize(9); doc.setTextColor(...MUT);
      doc.text('Eingeschätzte Marktmiete: ' + A.marktmiete_eur_qm + ' €/m²' + (A.marktfaktor != null ? '   ·   Marktfaktor: ' + A.marktfaktor : ''), M, y); y += 8; }
  }

  // ---------- Makrolage & Sozioökonomie (echte Destatis-Subscores) ----------
  const mac = d.macro || {};
  const mbd = mac.breakdown || {};
  if (Object.keys(mbd).length) {
    sectionTitle('Makrolage & Sozioökonomie', 72);
    const labelMap = { bevoelkerung: 'Bevölkerung', kaufkraft: 'Kaufkraft', arbeitslosigkeit: 'Arbeitsmarkt',
      wanderung: 'Wanderung', miet_trend: 'Miettrend', kaufpreis_trend: 'Kaufpreistrend' };
    const order = ['bevoelkerung', 'kaufkraft', 'arbeitslosigkeit', 'wanderung', 'miet_trend', 'kaufpreis_trend'];
    const entries = order.filter((k) => mbd[k] != null).map((k) => [labelMap[k] || k, mbd[k]]);
    need(8);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TXT);
    doc.text('Makro-Gesamtscore', M, y);
    const mcol = mac.score >= 70 ? [63, 165, 108] : mac.score >= 50 ? GOLD : [184, 98, 80];
    doc.setTextColor(...mcol); doc.text((mac.score ?? '–') + ' / 100', W - M, y, { align: 'right' });
    y += 7;
    const barX = M + 52, barW = (W - M) - barX - 14;
    entries.forEach(([lab, val]) => {
      need(9);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUT);
      doc.text(lab, M, y + 3.2);
      doc.setFillColor(233, 231, 225); doc.roundedRect(barX, y, barW, 4.4, 2.2, 2.2, 'F');
      const c = val >= 70 ? [67, 183, 124] : val >= 50 ? [217, 180, 90] : [217, 104, 95];
      if (doc.GState) { // dezenter Glow unter dem Füllbalken
        doc.setGState(new doc.GState({ opacity: 0.18 })); doc.setFillColor(...c);
        doc.roundedRect(barX - 0.4, y - 0.5, barW * Math.max(0.03, val / 100) + 0.8, 5.4, 2.6, 2.6, 'F');
        doc.setGState(new doc.GState({ opacity: 1 }));
      }
      doc.setFillColor(...c); doc.roundedRect(barX, y, barW * Math.max(0.03, val / 100), 4.4, 2.2, 2.2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...c);
      doc.text(String(val), W - M, y + 3.4, { align: 'right' });
      y += 9;
    });
    const _mm = (mac && (mac.metrics || mac)) || {};
    const _trend = _mm.bevoelkerung_trend;
    if (_trend != null) {
      need(6); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT);
      doc.text('Bevölkerungstrend ' + (_trend > 0 ? '+' : '') + _trend.toFixed(2) + ' %/Jahr', M, y); y += 8;
    }
  }

  // ---------- Marktentwicklung (Chart aus Dashboard) ----------
  try {
    if (typeof histChart !== 'undefined' && histChart) {
      const cimg = histChart.toBase64Image('image/png', 1);
      if (cimg && cimg.length > 200) {
        sectionTitle('Marktentwicklung');
        need(70);
        obsidianCard(M, y, W - 2 * M, 64);
        doc.addImage(cimg, 'PNG', M + 6, y + 4, W - 2 * M - 10, 56);
        y += 68;
        const hh = d.market_history || {};
        const dom = d.market_dynamics && d.market_dynamics.days_on_market;
        const cap = [
          hh.price_cagr_pct != null ? `Kaufpreistrend ${hh.price_cagr_pct > 0 ? '+' : ''}${hh.price_cagr_pct} %/Jahr${hh.start_year ? ' seit ' + hh.start_year : ''}` : null,
          hh.rent_cagr_pct != null ? `Miettrend ${hh.rent_cagr_pct > 0 ? '+' : ''}${hh.rent_cagr_pct} %/Jahr` : null,
          dom != null ? `Ø Vermarktungsdauer ${Math.round(dom)} Tage` : null,
        ].filter(Boolean).join('   ·   ');
        if (cap) { need(6); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.text(cap, M, y); y += 6; }
      }
    }
  } catch (e) { /* Chart optional */ }

  // ---------- Lage & Infrastruktur ----------
  const mg = d.micro && d.micro.groups;
  if (mg && Object.keys(mg).length) {
    sectionTitle('Lage & Infrastruktur', 44);
    const ord = ['einkaufen', 'verkehr', 'gesundheit', 'freizeit', 'bildung', 'gastronomie'];
    const list = ord.filter((k) => mg[k]).map((k) => mg[k]);
    // Ring-Leiste: ein Ring je Kategorie (DealPilot-Look) mit echtem Score + Anzahl/Distanz
    if (list.length) {
      need(40);
      const cellW = (W - 2 * M) / list.length;
      list.forEach((g, idx) => {
        const cx = M + cellW * idx + cellW / 2, cy = y + 11;
        microRing(cx, cy, 9, g.score, g.score != null ? g.score : '–');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TXT);
        doc.text(g.label, cx, cy + 16.5, { align: 'center' });
        const cnt = g.count != null ? g.count : (g.items ? g.items.length : null);
        const near = (g.items && g.items[0] && g.items[0].distance_m != null) ? g.items[0].distance_m + ' m' : null;
        const sub = [cnt != null ? cnt + ' Orte' : null, near ? 'ab ' + near : null].filter(Boolean).join(' · ');
        if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUT); doc.text(sub, cx, cy + 20.8, { align: 'center' }); }
      });
      y += 40;
    }
    const colW = (W - 2 * M) / 2;
    for (let i = 0; i < list.length; i += 2) {
      const n1 = (list[i].items || []).length, n2 = list[i + 1] ? (list[i + 1].items || []).length : 0;
      const rowH = 8 + Math.min(5, Math.max(n1, n2)) * 5 + 6;
      need(rowH);
      for (let j = 0; j < 2 && i + j < list.length; j++) {
        const g = list[i + j], x = M + j * colW;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TXT);
        doc.text(g.label, x, y);
        const sc = g.score >= 70 ? [63, 165, 108] : g.score >= 50 ? GOLD : [184, 98, 80];
        doc.setTextColor(...sc); doc.text((g.score5 ?? '–') + ' / 5', x + colW - 10, y, { align: 'right' });
        doc.setDrawColor(225, 223, 217); doc.setLineWidth(0.25);
        doc.line(x, y + 1.8, x + colW - 10, y + 1.8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT);
        let yy = y + 6.6;
        (g.items || []).slice(0, 5).forEach((it) => {
          const nm = it.name && it.name.length > 28 ? it.name.slice(0, 27) + '…' : (it.name || '–');
          doc.text(nm, x, yy); doc.text(it.distance_m + ' m', x + colW - 10, yy, { align: 'right' });
          yy += 5;
        });
      }
      y += rowH;
    }
    if (d.micro.score != null) {
      need(7); doc.setFontSize(8.5); doc.setTextColor(...MUT);
      doc.text('Mikrolage-Gesamtscore: ' + d.micro.score + ' / 100', M, y); y += 7;
    }
    y += 2;
  }

  // ---------- Vergleichsobjekte ----------
  const comps = (d.sale && d.sale.comparables) || [];
  if (comps.length) {
    sectionTitle('Vergleichsobjekte (' + comps.length + ')');
    doc.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [['Typ', 'Fläche', 'Baujahr', 'Preis', '€/m²', 'Entf.']],
      body: comps.map((c) => [c.property_type || '–', c.living_area ? c.living_area + ' m²' : '–',
        c.build_year || '–', euro(c.price), c.price_per_sqm ? Math.round(c.price_per_sqm).toLocaleString('de-DE') : '–',
        c.distance_m != null ? c.distance_m + ' m' : '–']),
      headStyles: { fillColor: INK, textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 2, textColor: TXT },
      alternateRowStyles: { fillColor: [245, 244, 240] },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ---------- Bericht (Fließtext) ----------
  if (out.report_md) {
    sectionTitle('Ausführlicher Marktbericht');
    const lines = mdToPdfLines(out.report_md);
    // Teil-Score je Kapitel: macht sichtbar, woraus sich der Gesamtscore speist.
    const bd = ds.breakdown || {};
    const SECTION_SCORE = {}; // keine Teil-Score-Pillen mehr — ein maßgeblicher Score (Seite 1)
    const partialScore = (key) => {
      const mk = SECTION_SCORE[key]; if (!mk) return null;
      const v = mk === 'overall' ? ds.score : bd[mk];
      return v == null ? null : Math.round(v);
    };
    const tierRgb = (s) => s >= 70 ? [63, 165, 108] : s >= 50 ? GOLD : [184, 98, 80];
    doc.setFontSize(9.5);
    for (const ln of lines) {
      if (ln.h) {
        // Überschrift nie allein am Seitenende: Platz für Titel + ~3 Textzeilen reservieren
        need(22);
        y += 3.5; // etwas Luft vor der Überschrift
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...GOLD); doc.setFontSize(11);
        doc.text(ln.t, M, y);
        // dezenter kurzer Gold-Akzent statt voller Linie über die ganze Breite
        doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y + 2.6, M + 14, y + 2.6);
        y += 8.5;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...TXT); doc.setFontSize(9.5);
        continue;
      }
      if (ln.bullet) {
        const wrapped = doc.splitTextToSize('•  ' + ln.t, W - 2 * M - 3);
        need(wrapped.length * 4.8 + 3.4); doc.text(wrapped, M + 3, y); y += wrapped.length * 4.8 + 3.4;
        continue;
      }
      // "Fakten:"-Zeilen NICHT mehr rendern (Marcel: keine Eckdaten-Wiederholung im Bericht)
      if (/^Fakten:/i.test(ln.t)) { continue; }
      if (false) {
        const body = ln.t.replace(/^Fakten:\s*/i, '');
        const wrapped = doc.splitTextToSize(body, W - 2 * M - 9);
        const boxH = wrapped.length * 4.0 + 8; need(boxH + 2);
        doc.setFillColor(247, 245, 239); doc.roundedRect(M, y - 3, W - 2 * M, boxH, 1.6, 1.6, 'F');
        doc.setFillColor(...GOLD); doc.roundedRect(M, y - 3, 1.6, boxH, 0.8, 0.8, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...GOLD);
        doc.text('ECKDATEN', M + 5, y + 0.8, { charSpace: 0.8 });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(95, 95, 103);
        doc.text(wrapped, M + 5, y + 5.4);
        y += boxH + 2;
        doc.setFontSize(9.5); doc.setTextColor(...TXT);
        continue;
      }
      // Fließtext im BLOCKSATZ (jsPDF: maxWidth + align justify; letzte Zeile bleibt ungestreckt)
      const wrapped = doc.splitTextToSize(ln.t, W - 2 * M);
      need(wrapped.length * 4.8 + 3.4);
      doc.text(ln.t, M, y, { maxWidth: W - 2 * M, align: 'justify' });
      y += wrapped.length * 4.8 + 3.4;
    }
    y += 3.5;
  }

  // (Datengrundlage & Verlässlichkeit absichtlich NICHT im PDF — bleibt im Dashboard.)

  footer(page);

  // ---------- Inhaltsverzeichnis (reservierte Seite jetzt befuellen) ----------
  if (tocEntries.length) {
    doc.setPage(tocPageNo);
    const dark = theme === 'dark';
    const T = dark
      ? { bg: OBS, head: [255, 255, 255], accent: GOLD, sub: [150, 150, 160], num: GOLD,
          title: [228, 228, 232], page: [165, 165, 175], div: [40, 40, 48], sky: GOLD }
      : { bg: [255, 255, 255], head: INK, accent: [168, 162, 150], sub: [120, 120, 130], num: GOLD,
          title: TXT, page: [120, 120, 130], div: [224, 222, 216], sky: [186, 182, 174] };
    doc.setFillColor(...T.bg); doc.rect(0, 0, W, H, 'F');
    // Hintergrund: Marcels dunkles Mockup-Asset 1:1; Fallback Cover-Karte transparent
    if (dark && bgDarkAsset) {
      try { doc.addImage(bgDarkAsset, 'JPEG', 0, 0, W, H, 'bgd'); } catch (e) {}
    } else if (dark && objImg && doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.14 }));
      try { doc.addImage(objImg, 'PNG', 0, 0, W, H); } catch (e) { /* optional */ }
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    if (dark) glowOrb(W - 26, 64, 44, [201, 168, 76], OBS, 0.16);
    radarPin(W - 30, 58, T.num); // dezenter Pin oben rechts (Mockup)
    let ty = M + 18;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.setTextColor(...T.head);
    doc.text('Inhalt', M, ty, { charSpace: 0.2 });
    doc.setFillColor(...T.accent); doc.rect(M, ty + 5, 22, 1.3, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...T.sub);
    doc.text('Marktwerteinschätzung · ' + (a.formatted || ref.address || ''), M, ty + 13);
    ty += 28;
    const rowH = Math.max(11, Math.min(15.5, (H - ty - 52) / tocEntries.length));
    for (const e of tocEntries) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...T.num);
      doc.text(e.num, M, ty);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(12.5); doc.setTextColor(...T.title);
      doc.text(e.title, M + 16, ty);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...T.page);
      doc.text(String(e.page != null ? e.page : ''), W - M, ty, { align: 'right' });
      doc.setDrawColor(...T.div); doc.setLineWidth(0.2); doc.line(M, ty + rowH * 0.46, W - M, ty + rowH * 0.46);
      ty += rowH;
    }
    // Skyline ist im Briefpapier-Asset (Version 4) bereits enthalten — keine zweite zeichnen
    footer(1); // Footer neu zeichnen (lag unter der Hintergrundfläche)
  }

  const fname = 'Marktbericht_' + (a.postcode || '') + '_' + (a.city || ref.address || 'Objekt').replace(/[^a-z0-9]/gi, '_').slice(0, 30) + '.pdf';
  doc.save(fname);
}

// Sprechende Kapiteltitel (statt "A) ...", "B) ..."). Fallback = Text hinter dem Buchstaben.
const PDF_SECTION_TITLES = {
  A: 'Zusammenfassung & Empfehlung', B: 'Objekt, Lage & Markt', C: 'Bewertung, Rendite & Ausblick',
};
// Markdown grob in PDF-Zeilen ({h:bool, bullet:bool, t:string, sectionKey})
function mdToPdfLines(md) {
  const out = [];
  md.split('\n').forEach((raw) => {
    let l = raw.trim();
    if (!l) return;
    const strip = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(?<![A-Za-z0-9])_([^_]+?)_(?![A-Za-z0-9])/g, '$1').replace(/`/g, '');
    if (/^#{1,3}\s/.test(l)) {
      let t = strip(l.replace(/^#{1,3}\s/, ''));
      const m = t.match(/^([A-P])\)\s*(.*)$/);  // "A) Executive Summary"
      let key = null;
      if (m) { key = m[1]; t = PDF_SECTION_TITLES[key] || m[2]; }
      else t = t.replace(/^[A-Z]\d?\)\s*/, '');  // z.B. "D2) Lage…" -> "Lage…"
      out.push({ h: true, t, sectionKey: key });
    }
    else if (/^[-*]\s/.test(l)) out.push({ bullet: true, t: strip(l.replace(/^[-*]\s/, '')) });
    else out.push({ t: strip(l) });
  });
  return out;
}

// ===== Präzisierung: Ausklappen + Live-Genauigkeitsanzeige =====
(function () {
  function initPrec() {
    const head = document.getElementById('precHead');
    const box = document.getElementById('precBox');
    const caret = document.getElementById('precCaret');
    if (head && box) head.addEventListener('click', function () {
      const open = box.style.display !== 'none';
      box.style.display = open ? 'none' : 'block';
      if (caret) caret.textContent = open ? '\u25B8' : '\u25BE';
    });
    const labels = { cond: 'Zustand', energy: 'Energieklasse', quality: 'Ausstattung', modern: 'Modernisierung',
      /* v736-mb-eq: 8 Ausstattungsfelder zaehlen mit (X/12) */
      eq_heating: 'Heizung', eq_windows: 'Verglasung', eq_floor: 'Bodenbelag', eq_bath: 'Bad',
      eq_guest_wc: 'Gäste-WC', eq_store_room: 'Keller', eq_walls: 'Außenwände', eq_roof: 'Dacheindeckung' };
    const fields = Object.keys(labels);
    function upd() {
      const isFilled = function (id) { const e = document.getElementById(id); return !!(e && e.value && e.value.trim() !== ''); };
      const filled = fields.filter(isFilled).length;
      const total = fields.length;
      // gleiche Logik wie Backend (angenommene Marktdaten-Konfidenz ~0.9): 78%..100% des Datenwerts
      const pct = Math.round(90 * (0.78 + 0.22 * (filled / total)));
      const bar = document.getElementById('precBar');
      const pe = document.getElementById('precPct');
      const cnt = document.getElementById('precCount');
      const hint = document.getElementById('precHint');
      if (bar) bar.style.width = pct + '%';
      if (pe) pe.textContent = '\u2248 ' + pct + '%';
      if (cnt) cnt.textContent = filled + '/' + total;
      if (hint) {
        const missing = fields.filter(function (id) { return !isFilled(id); }).map(function (id) { return labels[id]; });
        hint.innerHTML = filled >= total
          ? 'Alle wertrelevanten Angaben gemacht \u2014 h\u00f6chste Eingabe-Konfidenz. Der exakte Wert ergibt sich mit der Vergleichsdatenbasis.'
          : 'F\u00fcr h\u00f6here Genauigkeit erg\u00e4nzen: <b style="color:#c9a84c;">' + missing.join(', ') + '</b>.';
      }
    }
    fields.forEach(function (id) { const e = document.getElementById(id); if (e) e.addEventListener('change', upd); });
    window._precUpd = upd;
    upd();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPrec);
  else initPrec();
})();

// ===== Adress-/Standortsuche (Geoapify-Autocomplete, Key serverseitig) =====
(function () {
  function initAddrAC() {
    const inp = document.getElementById('address');
    if (!inp) return;
    const dd = document.createElement('div');
    dd.id = 'addrAC';
    dd.style.cssText = 'position:absolute;z-index:9999;display:none;background:#0d0d11;border:1px solid #2a2a30;'
      + 'border-radius:10px;overflow-y:auto;max-height:300px;box-shadow:0 12px 30px rgba(0,0,0,.55);';
    document.body.appendChild(dd);
    let items = [], timer = null, lastQ = '';
    function place() {
      const r = inp.getBoundingClientRect();
      dd.style.left = (r.left + window.scrollX) + 'px';
      dd.style.top = (r.bottom + window.scrollY + 4) + 'px';
      dd.style.width = r.width + 'px';
    }
    function hide() { dd.style.display = 'none'; }
    function render() {
      if (!items.length) { hide(); return; }
      dd.innerHTML = items.map(function (it, i) {
        return '<div data-i="' + i + '" style="padding:9px 12px;cursor:pointer;font-size:13px;color:#e6e6ea;border-bottom:1px solid #1c1c22;">'
          + '<span style="color:#C9A84C;margin-right:7px;">\u25CE</span>' + it.formatted + '</div>';
      }).join('');
      place(); dd.style.display = 'block';
      dd.querySelectorAll('[data-i]').forEach(function (el) {
        el.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          const it = items[+el.getAttribute('data-i')];
          inp.value = it.formatted;
          window._lastGeo = { lat: it.lat, lon: it.lon };
          lastQ = it.formatted; hide();
        });
        el.addEventListener('mouseenter', function () { el.style.background = '#16161c'; });
        el.addEventListener('mouseleave', function () { el.style.background = 'transparent'; });
      });
    }
    async function query(q) {
      try {
        const r = await fetch(API + '/geocode/autocomplete?text=' + encodeURIComponent(q));
        const d = await r.json();
        items = (d && d.results) || []; render();
      } catch (e) { items = []; hide(); }
    }
    inp.setAttribute('autocomplete', 'off');
    inp.addEventListener('input', function () {
      const q = inp.value.trim();
      if (q.length < 3) { hide(); return; }
      if (q === lastQ) return; lastQ = q;
      clearTimeout(timer); timer = setTimeout(function () { query(q); }, 250);
    });
    inp.addEventListener('blur', function () { setTimeout(hide, 150); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAddrAC);
  else initAddrAC();
})();

// ===== Standort-Finder (eigener Tab) =====
(function () {
  function initFinder() {
    const tabs = document.getElementById('mainTabs');
    const vReport = document.getElementById('view-report');
    const vFinder = document.getElementById('view-finder');
    if (!tabs || !vReport || !vFinder) return;

    function setView(v) {
      vReport.classList.toggle('hide', v !== 'report');
      vFinder.classList.toggle('hide', v !== 'finder');
      tabs.querySelectorAll('.mtab').forEach(function (b) {
        const on = b.getAttribute('data-view') === v;
        b.style.background = on ? '#C9A84C' : 'transparent';
        b.style.color = on ? '#0a0a0a' : '#9a9aa3';
        b.style.borderColor = on ? '#C9A84C' : '#2a2a30';
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    tabs.querySelectorAll('.mtab').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });
    window._lfSetView = setView;

    const selI = document.getElementById('lfIntent'), selR = document.getElementById('lfRegion'),
      descEl = document.getElementById('lfIntentDesc'), btn = document.getElementById('lfBtn'),
      errEl = document.getElementById('lfErr'), prog = document.getElementById('lfProgress'),
      resEl = document.getElementById('lfResults');
    let intentsMeta = [];

    fetch(API + '/location-finder/meta').then(function (r) { return r.json(); }).then(function (m) {
      intentsMeta = m.intents || [];
      selI.innerHTML = intentsMeta.map(function (i) { return '<option value="' + i.key + '">' + i.label + '</option>'; }).join('');
      selR.innerHTML = (m.regions || []).map(function (r) { return '<option value="' + r.key + '">' + r.label + ' (' + r.count + ')</option>'; }).join('');
      updateDesc();
    }).catch(function () { if (descEl) descEl.textContent = 'Konnte Absichten nicht laden.'; });

    function updateDesc() {
      const it = intentsMeta.find(function (x) { return x.key === selI.value; });
      if (descEl) descEl.textContent = it ? it.desc : '';
    }
    selI.addEventListener('change', updateDesc);

    function col(s) { return s >= 70 ? '#3FA56C' : s >= 50 ? '#C9A84C' : '#B86250'; }

    function card(r, rank) {
      const c = col(r.score);
      const parts = [['Lage/POI', r.parts.poi], ['Demografie', r.parts.demografie]];
      if (r.parts.jung != null) parts.push(['18\u201330', r.parts.jung]);
      if (r.parts.rendite != null) parts.push(['Rendite', r.parts.rendite]);
      const bars = parts.map(function (p) {
        return '<div style="flex:1;min-width:90px;"><div style="display:flex;justify-content:space-between;font-size:10.5px;color:#9a9aa3;margin-bottom:3px;"><span>' + p[0] + '</span><span style="color:#e6e6ea;">' + p[1] + '</span></div>'
          + '<div style="height:5px;background:#1c1c22;border-radius:999px;overflow:hidden;"><div style="height:100%;width:' + Math.max(3, p[1]) + '%;background:' + col(p[1]) + ';"></div></div></div>';
      }).join('');
      const reasons = (r.reasons || []).slice(0, 5).map(function (x) {
        return '<span style="display:inline-block;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.3);color:#e7e2d4;border-radius:999px;padding:2px 9px;font-size:11px;font-family:\'JetBrains Mono\';">' + x + '</span>';
      }).join(' ');
      return '<div style="position:relative;overflow:hidden;padding:16px 18px;border-radius:14px;border:1px solid rgba(201,168,76,.3);'
        + 'background-color:#070708;background-image:radial-gradient(circle at 16% 20%,rgba(201,168,76,.12),transparent 42%),radial-gradient(circle at 90% 80%,rgba(70,100,120,.10),transparent 46%),radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:auto,auto,22px 22px;">'
        + '<div style="display:flex;align-items:center;gap:14px;">'
        + '<div style="width:54px;height:54px;border-radius:50%;border:3px solid ' + c + ';display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 0 14px ' + c + '55;">'
        + '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:19px;color:' + c + ';">' + r.score + '</span></div>'
        + '<div style="flex:1;"><div style="font-size:11px;color:#8a8a93;">#' + rank + ' · Match-Score</div>'
        + '<div style="font-family:\'Space Grotesk\';font-weight:700;font-size:18px;color:#fff;">' + r.name + '</div></div>'
        + '<button data-city="' + r.name.replace(/"/g, '') + '" class="lfPick" style="background:transparent;border:1px solid #C9A84C;color:#C9A84C;border-radius:999px;padding:8px 14px;font-size:12px;cursor:pointer;white-space:nowrap;">Marktbericht erstellen →</button>'
        + '</div>'
        + '<div style="display:flex;gap:14px;margin-top:14px;flex-wrap:wrap;">' + bars + '</div>'
        + (reasons ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">' + reasons + '</div>' : '')
        + '</div>';
    }

    btn.addEventListener('click', async function () {
      errEl.classList.add('hide'); resEl.innerHTML = '';
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> suche…';
      prog.classList.remove('hide'); prog.textContent = 'Werte Standorte aus (POI + Demografie) — das kann einen Moment dauern…';
      try {
        const r = await fetch(API + '/location-finder', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: selI.value, region: selR.value }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Fehler');
        const list = d.results || [];
        const note = d.geomap_calls
          ? '<div style="font-size:11.5px;color:#6a6a72;margin-top:10px;">GeoMap-Rendite für die Top-' + Math.min(5, list.length) + ' nachgeladen · ' + d.geomap_calls + ' Abrufe (~' + String(d.cost_hint_eur).replace('.', ',') + ' €). Übrige Standorte: kostenlose Signale (POI + Demografie).</div>'
          : '<div style="font-size:11.5px;color:#6a6a72;margin-top:10px;">Ranking aus kostenlosen Signalen (POI + Demografie). GeoMap-Rendite nicht aktiv/verfügbar.</div>';
        resEl.innerHTML = '<div style="font-size:13px;color:#9a9aa3;margin-bottom:4px;">Top-Standorte für <b style="color:#C9A84C;">' + d.intentLabel + '</b> in ' + d.regionLabel + ':</div>'
          + list.map(function (x, i) { return card(x, i + 1); }).join('') + note;
        resEl.querySelectorAll('.lfPick').forEach(function (b) {
          b.addEventListener('click', function () {
            const city = b.getAttribute('data-city');
            const addr = document.getElementById('address'); if (addr) addr.value = city;
            if (window._lfSetView) window._lfSetView('report');
          });
        });
      } catch (e) {
        errEl.textContent = '✗ ' + e.message; errEl.classList.remove('hide');
      } finally {
        prog.classList.add('hide'); btn.disabled = false; btn.textContent = 'Standorte finden';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFinder);
  else initFinder();
})();

// ===== Demo / Ausgabe speichern & laden (ohne erneute Abfrage) =====
(function () {
  const byId = (id) => document.getElementById(id);
  async function ensureMaps(out) {
    try {
      const a = out && out.data && out.data.address;
      if (!a || a.lat == null || a.lon == null) return;
      if (!out._covMap) {
        out._covMap = await loadImageDataUrl(API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
          + '&zoom=15&width=1448&height=2048&marker=0&style=dark-matter-yellow-roads');
      }
      if (!out._lightMap) {
        out._lightMap = await loadImageDataUrl(API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
          + '&zoom=17&width=1024&height=1448&marker=0&style=positron');
      }
    } catch (e) { /* Karten optional */ }
  }
  // "Letzte Ausgabe" aus localStorage
  const lb = byId('loadLastBtn');
  if (lb) {
    try { if (localStorage.getItem('mb_last_out')) lb.style.display = ''; } catch (e) {}
    lb.addEventListener('click', () => {
      try {
        const s = localStorage.getItem('mb_last_out');
        if (!s) { alert('Noch keine gespeicherte Ausgabe vorhanden. Bitte erst einen Bericht erstellen oder eine Datei laden.'); return; }
        render(JSON.parse(s));
      } catch (e) { alert('Konnte gespeicherte Ausgabe nicht laden: ' + e.message); }
    });
  }
  // Aktuelle Ausgabe als .json-Datei speichern (mit eingebetteten Karten -> spaeter PDF ohne Abruf)
  const sb = byId('saveFileBtn');
  if (sb) sb.addEventListener('click', async () => {
    const out = window._lastOut;
    if (!out) { alert('Keine Ausgabe vorhanden. Erst einen Bericht erstellen oder laden.'); return; }
    const old = sb.innerHTML; sb.disabled = true; sb.textContent = 'speichere…';
    try {
      await ensureMaps(out);
      const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ad = document.createElement('a');
      const plz = (out.data && out.data.address && out.data.address.postcode) || '';
      ad.href = url; ad.download = 'marktbericht-demo' + (plz ? '-' + plz : '') + '.json';
      document.body.appendChild(ad); ad.click(); ad.remove(); URL.revokeObjectURL(url);
    } catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); }
    finally { sb.disabled = false; sb.innerHTML = old; }
  });
  // .json-Datei laden -> rendern (komplett offline, keine Abfrage)
  const fb = byId('loadFileBtn'), fi = byId('loadFileInput');
  if (fb && fi) {
    fb.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => {
      const f = fi.files && fi.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { render(JSON.parse(r.result)); } catch (e) { alert('Ungueltige Datei: ' + e.message); } };
      r.onerror = () => alert('Datei konnte nicht gelesen werden.');
      r.readAsText(f); fi.value = '';
    });
  }
  // Teilbaren Angebot-Link kopieren (nutzt den gespeicherten object_key)
  const shb = byId('shareBtn');
  if (shb) shb.addEventListener('click', async () => {
    const out = window._lastOut;
    const k = out && out.object_key;
    if (!k) { alert('Bitte zuerst einen Bericht erstellen oder laden (für die Link-Erzeugung wird das gespeicherte Objekt benötigt).'); return; }
    const url = location.origin + '/angebot.html?key=' + encodeURIComponent(k);
    try { await navigator.clipboard.writeText(url); const o = shb.textContent; shb.textContent = '✓ Link kopiert'; setTimeout(() => shb.textContent = o, 1800); }
    catch (e) { prompt('Angebot-Link:', url); }
  });
  // Auto-Replay, wenn von der Angebot-Seite zurückverlinkt: index.html?angebot=KEY
  try {
    const ak = new URLSearchParams(location.search).get('angebot');
    if (ak) {
      fetch(API + '/reports/replay?key=' + encodeURIComponent(ak))
        .then((r) => r.ok ? r.json() : Promise.reject(new Error('Angebot nicht gefunden')))
        .then((out) => render(out))
        .catch(() => {});
    }
  } catch (e) { /* optional */ }
})();

// v565-imgguard: objImage nie ohne gueltige src anzeigen (vermeidet Browser-Bruch-Icon)
(function(){try{var oi=document.getElementById('objImage');if(oi){var mo=new MutationObserver(function(){if(!oi.classList.contains('hide')&&(!oi.getAttribute('src')||oi.getAttribute('src')==='')){oi.classList.add('hide');}});mo.observe(oi,{attributes:true,attributeFilter:['class','src']});}}catch(e){}})();

/* v565-no-share */

/* v569-appbeh: obere Buttons PDF + Schliessen */
(function(){
  function bind(){
    var pdf = document.getElementById('mbTopPdf');
    if (pdf && !pdf._v569) { pdf._v569 = 1; pdf.addEventListener('click', function(){ var b = document.getElementById('pdfBtn'); if (b) b.click(); }); }
    var cl = document.getElementById('mbTopClose');
    if (cl && !cl._v569) { cl._v569 = 1; cl.addEventListener('click', function(){ try { parent.postMessage({ type:'mbv-close' }, '*'); } catch(e){} }); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  setTimeout(bind, 500);
})();

/* v570-prog */
