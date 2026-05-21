/* V260-06: Mehrjaehriger Steuerverlauf — alle Won-Objekte beruecksichtigen */
(function() {
  'use strict';

  function token() {
    try { return localStorage.getItem('ji_token') || ''; } catch(e) { return ''; }
  }
  function authHeaders() {
    return {
      'Authorization': 'Bearer ' + token(),
      'Accept': 'application/json'
    };
  }
  function fmtEUR(n) {
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
  }
  function fmtPct(n) {
    if (typeof n !== 'number') return '0 %';
    return n.toFixed(1) + ' %';
  }

  /** EStG 2026 (Tarif §32a) — Grundtabelle.
   *  Vereinfachte Tarif-Berechnung fuer Single-Veranlagung.
   */
  function steuerEstG2026(zve) {
    if (zve <= 12096) return 0;
    if (zve <= 17443) {
      const y = (zve - 12096) / 10000;
      return Math.round((932.30 * y + 1400) * y);
    }
    if (zve <= 68480) {
      const z = (zve - 17443) / 10000;
      return Math.round((176.64 * z + 2397) * z + 1015.13);
    }
    if (zve <= 277825) {
      return Math.round(0.42 * zve - 10911.92);
    }
    return Math.round(0.45 * zve - 19246.67);
  }

  /** Lade alle Won-Objekte + ihre WK-Per-Year-Snapshots */
  async function loadWonObjects() {
    try {
      const res = await fetch('/api/v1/objects/wk-aggregate', { headers: authHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.objects) ? data.objects : [];
    } catch(e) {
      console.warn('[V260-06]', e.message);
      return [];
    }
  }

  /** Berechne Steuerverlauf fuer N Jahre ab Startjahr.
   *  Liefert Array [{year, ...kennzahlen}].
   */
  async function computeMultiYear(startYear, numYears) {
    startYear = startYear || new Date().getFullYear();
    numYears = numYears || 10;
    
    const objects = await loadWonObjects();
    
    // Tax-Periods laden
    let taxPeriods = [];
    if (window.DealPilotTaxPeriods) {
      taxPeriods = await DealPilotTaxPeriods.loadAll();
    }
    
    const rows = [];
    for (let i = 0; i < numYears; i++) {
      const year = startYear + i;
      
      // zvE fuer dieses Jahr (anteilig falls 2 Perioden)
      const zveYear = computeZveForYear(year, taxPeriods);
      
      // Summe Ueberschuss/Verlust aller Won-Objekte fuer dieses Jahr
      let totalWK = 0;
      let objectCount = 0;
      objects.forEach(obj => {
        const wk = obj.wk_per_year && obj.wk_per_year[String(year)];
        if (typeof wk === 'number' && wk !== 0) {
          totalWK += wk;
          objectCount++;
        }
      });
      
      // Steuer mit und ohne Immobilien
      const zveMit = Math.max(0, zveYear + totalWK);  // WK ist negativ wenn Verlust
      const steuerOhne = steuerEstG2026(zveYear);
      const steuerMit = steuerEstG2026(zveMit);
      const erstattung = steuerOhne - steuerMit;
      const grenzsteuer = zveYear > 0 ? Math.min(45, Math.max(0, ((steuerOhne / zveYear) * 100))) : 0;
      
      rows.push({
        year,
        zve_year: zveYear,
        wk_total: totalWK,
        zve_mit: zveMit,
        steuer_ohne: steuerOhne,
        steuer_mit: steuerMit,
        erstattung: erstattung,
        objekt_count: objectCount,
        grenzsteuer: grenzsteuer
      });
    }
    
    return rows;
  }
  
  /** Berechne anteiliges zvE fuer ein Jahr basierend auf tax_periods.
   *  Wenn 2+ Perioden das Jahr ueberlappen, gewichten nach Tagen.
   */
  function computeZveForYear(year, taxPeriods) {
    const yearStart = year + '-01-01';
    const yearEnd = year + '-12-31';
    
    // Filter: Perioden die das Jahr ueberlappen
    const relevant = taxPeriods.filter(p => {
      if (!p.valid_from) return false;
      if (p.valid_from > yearEnd) return false;
      if (p.valid_to && p.valid_to < yearStart) return false;
      return true;
    });
    
    if (relevant.length === 0) return 65891; // Default fallback
    if (relevant.length === 1) return relevant[0].zve;
    
    // Gewichteter Durchschnitt nach Tagen
    let weightedSum = 0;
    let totalDays = 0;
    relevant.forEach(p => {
      const pStart = (p.valid_from > yearStart) ? p.valid_from : yearStart;
      const pEnd = (p.valid_to && p.valid_to < yearEnd) ? p.valid_to : yearEnd;
      const days = daysBetween(pStart, pEnd) + 1;
      weightedSum += p.zve * days;
      totalDays += days;
    });
    
    return totalDays > 0 ? Math.round(weightedSum / totalDays) : relevant[0].zve;
  }
  
  function daysBetween(d1, d2) {
    const a = new Date(d1);
    const b = new Date(d2);
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  /** Render mehrjaehrige Tabelle in einen Container */
  async function renderInto(container) {
    if (!container) return;
    container.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted,#7A7370);font-family:var(--font-main,\'IBM Plex Sans\',sans-serif)">Berechne Steuerverlauf...</div>';
    
    const thisYear = new Date().getFullYear();
    const rows = await computeMultiYear(thisYear, 10);
    
    let html = '<div style="font-family:var(--font-main,\'IBM Plex Sans\',sans-serif)">';
    html += '<div style="font-size:13px;color:var(--muted,#7A7370);margin-bottom:10px">Berücksichtigt alle gewonnenen Immobilien und automatische zvE-Anpassung pro Jahr aus Steuerzeiträumen.</div>';
    html += '<div style="border:1px solid rgba(201,168,76,0.20);border-radius:10px;overflow:hidden;background:#fff">';
    html += '<div style="display:grid;grid-template-columns:60px 1fr 1fr 1fr 1fr 90px;gap:8px;padding:10px 14px;background:rgba(201,168,76,0.06);font-size:11px;font-weight:600;color:var(--ch,#2A2727);text-transform:uppercase;letter-spacing:0.04em">';
    html += '<div>Jahr</div><div>zvE</div><div>WK Σ</div><div>Steuer ohne</div><div>Steuer mit</div><div style="text-align:right">Erst.</div>';
    html += '</div>';
    
    rows.forEach((r, i) => {
      const rowBg = i % 2 === 0 ? '#fff' : 'rgba(201,168,76,0.03)';
      const erstColor = r.erstattung > 0 ? 'var(--green,#3FA56C)' : r.erstattung < 0 ? 'var(--red,#B8625C)' : 'var(--muted,#7A7370)';
      const erstSign = r.erstattung > 0 ? '+' : '';
      html += '<div style="display:grid;grid-template-columns:60px 1fr 1fr 1fr 1fr 90px;gap:8px;padding:10px 14px;background:' + rowBg + ';border-top:1px solid rgba(201,168,76,0.10);font-size:13px;align-items:center">';
      html += '<div style="font-weight:600">' + r.year + '</div>';
      html += '<div>' + fmtEUR(r.zve_year) + '</div>';
      html += '<div style="color:' + (r.wk_total < 0 ? 'var(--green,#3FA56C)' : 'var(--muted,#7A7370)') + '">' + (r.wk_total >= 0 ? '+' : '') + fmtEUR(r.wk_total) + ' <span style="font-size:10px;color:var(--muted,#7A7370)">(' + r.objekt_count + ')</span></div>';
      html += '<div>' + fmtEUR(r.steuer_ohne) + '</div>';
      html += '<div>' + fmtEUR(r.steuer_mit) + '</div>';
      html += '<div style="text-align:right;font-weight:600;color:' + erstColor + '">' + erstSign + fmtEUR(r.erstattung) + '</div>';
      html += '</div>';
    });
    
    html += '</div>';
    
    // Summary
    const totalErst = rows.reduce((sum, r) => sum + r.erstattung, 0);
    html += '<div style="margin-top:10px;padding:12px 14px;background:rgba(63,165,108,0.08);border:1px solid rgba(63,165,108,0.30);border-radius:8px;font-size:13px;display:flex;justify-content:space-between;align-items:center">';
    html += '<span style="font-weight:600">Gesamt-Steuereffekt (10 Jahre)</span>';
    html += '<span style="font-weight:700;color:var(--green,#3FA56C);font-size:15px">' + (totalErst >= 0 ? '+' : '') + fmtEUR(totalErst) + '</span>';
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
  }

  /** Auto-Inject in Steuer-Modul */
  function injectIntoSteuerModul() {
    // Suche das "Echte Progression 2026" Modul
    const heading = Array.from(document.querySelectorAll('.ct, .section-title, h3, h2'))
      .find(el => /Echte Progression 2026|Steuer-Modul.*Progression/.test(el.textContent || ''));
    if (!heading) return;
    
    let host = document.getElementById('dp-v260-multiyear');
    if (host) return; // schon da
    
    host = document.createElement('div');
    host.id = 'dp-v260-multiyear';
    host.style.cssText = 'margin-top:16px;padding-top:14px;border-top:1px dashed rgba(201,168,76,0.30)';
    host.innerHTML = '<details><summary style="cursor:pointer;font-family:var(--font-main,\'IBM Plex Sans\',sans-serif);font-size:13.5px;font-weight:600;color:var(--gold,#C9A84C);padding:6px 0">📈 Mehrjähriger Steuerverlauf (10 Jahre) — alle Immobilien</summary><div id="dp-v260-multiyear-content" style="margin-top:10px"></div></details>';
    
    // Nach dem Modul-Container einfuegen
    const section = heading.closest('.ct-pro, .sec-card, .ct')?.parentNode;
    if (section) {
      section.appendChild(host);
    }
    
    host.querySelector('summary').addEventListener('click', function(e) {
      const details = host.querySelector('details');
      if (!details.open) {
        setTimeout(() => {
          renderInto(document.getElementById('dp-v260-multiyear-content'));
        }, 50);
      }
    });
  }

  function watchSteuerTab() {
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-tab="s4"], [data-target="s4"], button[onclick*="s4"]')) {
        setTimeout(injectIntoSteuerModul, 350);
      }
    });
    setTimeout(injectIntoSteuerModul, 1500);
  }

  window.DealPilotMultiYearSteuer = {
    computeMultiYear,
    computeZveForYear,
    steuerEstG2026,
    renderInto,
    injectIntoSteuerModul,
    _meta: 'V260-06'
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchSteuerTab);
  } else {
    watchSteuerTab();
  }
})();
