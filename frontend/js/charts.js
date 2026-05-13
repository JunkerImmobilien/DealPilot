'use strict';

/* ═══════════════════════════════════════════════════
   DealPilot — charts.js V63.45 (Pro-Stil)
═══════════════════════════════════════════════════ */

var _charts = { cf: null, val: null, verm: null, scher: null };

function _dpColors() {
  var root = getComputedStyle(document.documentElement);
  var pick = function(name, fallback) {
    var v = root.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    gold:    pick('--gold',  '#C9A84C'),
    goldL:   'rgba(201,168,76,0.85)',
    goldF:   'rgba(201,168,76,0.18)',
    green:   pick('--green', '#3FA56C'),
    greenL:  'rgba(63,165,108,0.85)',
    greenF:  'rgba(63,165,108,0.16)',
    red:     pick('--red',   '#B8625C'),
    redL:    'rgba(184,98,92,0.85)',
    redF:    'rgba(184,98,92,0.16)',
    ch:      pick('--ch',    '#2A2727'),
    chF:     'rgba(42,39,39,0.06)',
    grid:    'rgba(42,39,39,0.07)',
    text:    '#7A7370'
  };
}

function _destroy(name) {
  if (_charts[name]) { try { _charts[name].destroy(); } catch(e) {} _charts[name] = null; }
}
function _fmtK(v) {
  if (Math.abs(v) >= 1000) return (v/1000).toFixed(0) + 'k';
  return Math.round(v).toString();
}
function _fmtEUR(v) {
  return Math.round(v).toLocaleString('de-DE') + ' €';
}

function _gradient(ctx, area, colorTop, colorBottom) {
  if (!area) return colorTop;
  var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, colorTop);
  g.addColorStop(1, colorBottom);
  return g;
}

function _baseOpts(c) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 8, right: 12, left: 4, bottom: 4 } },
    plugins: {
      legend: {
        position: 'top', align: 'start',
        labels: {
          font: { size: 11, family: 'DM Sans', weight: '500' },
          color: c.ch, boxWidth: 12, boxHeight: 12,
          usePointStyle: true, padding: 14
        }
      },
      tooltip: {
        backgroundColor: c.ch, titleColor: c.gold, bodyColor: '#fff',
        borderColor: c.gold, borderWidth: 1, padding: 11, cornerRadius: 6,
        titleFont: { size: 12, family: 'DM Sans', weight: '600' },
        bodyFont:  { size: 11, family: 'DM Sans' },
        displayColors: true, boxPadding: 4
      }
    },
    scales: {
      x: { grid: { color: c.grid, drawBorder: false },
           ticks: { font: { size: 10, family: 'DM Sans' }, color: c.text, padding: 4 } },
      y: { grid: { color: c.grid, drawBorder: false },
           ticks: { font: { size: 10, family: 'DM Sans' }, color: c.text, padding: 6,
                    callback: function(v) { return _fmtK(v) + ' €'; } } }
    }
  };
}

function _ezbLine(c, bindjIdx, label) {
  return {
    id: 'ezbLine_' + Math.random().toString(36).slice(2, 8),
    afterDraw: function(chart) {
      if (!chart.scales || !chart.scales.x) return;
      if (bindjIdx == null || bindjIdx < 0 || bindjIdx >= chart.data.labels.length) return;
      var ctx = chart.ctx;
      var x = chart.scales.x.getPixelForValue(bindjIdx);
      var area = chart.chartArea;
      ctx.save();
      ctx.strokeStyle = c.gold;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, area.top);
      ctx.lineTo(x, area.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      if (label) {
        ctx.fillStyle = c.gold;
        ctx.font = '600 9.5px DM Sans';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, area.top - 2);
      }
      ctx.restore();
    }
  };
}

function buildCharts() {
  if (!State.cfRows || !State.cfRows.length) { calcNow(); return; }
  var sec = document.getElementById('s6');
  if (sec && getComputedStyle(sec).display === 'none') return;

  var c = _dpColors();
  var labels = State.cfRows.map(function(r) { return "'" + String(r.cal).slice(2); });
  var bindjIdx = (function() {
    var bj = parseInt((document.getElementById('d1_bindj') || {}).value || 10);
    return Math.min(bj - 1, State.cfRows.length - 1);
  })();
  var K = State.kpis;

  // ── 1) CASHFLOW NACH STEUERN ─────────────────────────────────
  _destroy('cf');
  var cc = document.getElementById('cfChart');
  if (cc) {
    var cfData = State.cfRows.map(function(r) { return Math.round(r.cfns_y); });
    var cfBefore = State.cfRows.map(function(r) { return Math.round(r.cfop_y); });
    var base = _baseOpts(c);

    _charts.cf = new Chart(cc, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'CF nach Steuern / Jahr',
            data: cfData,
            backgroundColor: function(ctx) { return ctx.raw >= 0 ? c.greenL : c.redL; },
            borderColor: function(ctx) { return ctx.raw >= 0 ? c.green : c.red; },
            borderWidth: 0, borderRadius: 6, borderSkipped: false,
            barPercentage: 0.78, categoryPercentage: 0.82, order: 2
          },
          {
            label: 'CF v. Steuern / Jahr',
            data: cfBefore, type: 'line',
            borderColor: c.ch, backgroundColor: c.ch,
            borderWidth: 1.6, borderDash: [3, 3],
            pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: false, order: 1
          }
        ]
      },
      options: Object.assign(base, {
        plugins: Object.assign(base.plugins, {
          tooltip: Object.assign(base.plugins.tooltip, {
            callbacks: {
              label: function(ctx) {
                var v = ctx.raw, sign = v >= 0 ? '+' : '';
                return ' ' + ctx.dataset.label + ': ' + sign + _fmtEUR(v);
              }
            }
          })
        })
      }),
      plugins: [_ezbLine(c, bindjIdx, 'EZB')]
    });
  }

  // ── 2) WERT / RESTSCHULD / EIGENKAPITAL ──────────────────────
  _destroy('val');
  var vc = document.getElementById('valChart');
  if (vc) {
    var b2 = _baseOpts(c);
    _charts.val = new Chart(vc, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Immobilienwert',
            data: State.cfRows.map(function(r) { return Math.round(r.wert_y); }),
            borderColor: c.gold,
            backgroundColor: function(ctx) {
              return _gradient(ctx.chart.ctx, ctx.chart.chartArea, c.goldF, 'rgba(201,168,76,0.0)');
            },
            borderWidth: 2.6, pointRadius: 0, pointHoverRadius: 5,
            pointBackgroundColor: c.gold, pointBorderColor: '#fff', pointBorderWidth: 2,
            tension: 0.35, fill: 'origin'
          },
          {
            label: 'Restschuld',
            data: State.cfRows.map(function(r) { return Math.round(r.rs); }),
            borderColor: c.red, backgroundColor: 'transparent',
            borderWidth: 2.2, borderDash: [5, 4],
            pointRadius: 0, pointHoverRadius: 5,
            pointBackgroundColor: c.red, pointBorderColor: '#fff', pointBorderWidth: 2,
            tension: 0.35, fill: false
          },
          {
            label: 'Eigenkapital',
            data: State.cfRows.map(function(r) { return Math.round(r.eq_y); }),
            borderColor: c.green,
            backgroundColor: function(ctx) {
              return _gradient(ctx.chart.ctx, ctx.chart.chartArea, c.greenF, 'rgba(63,165,108,0.0)');
            },
            borderWidth: 2.4, pointRadius: 0, pointHoverRadius: 5,
            pointBackgroundColor: c.green, pointBorderColor: '#fff', pointBorderWidth: 2,
            tension: 0.35, fill: 'origin'
          }
        ]
      },
      options: Object.assign(b2, {
        plugins: Object.assign(b2.plugins, {
          tooltip: Object.assign(b2.plugins.tooltip, {
            callbacks: { label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + _fmtEUR(ctx.raw); } }
          })
        })
      }),
      plugins: [_ezbLine(c, bindjIdx, 'EZB')]
    });
  }

  // ── 3) VERMÖGENSAUFBAU kumuliert (gestapelte Flächen) ────────
  _destroy('verm');
  var vm = document.getElementById('vermChart');
  if (vm) {
    var kp0 = K.kp || 0, tk = 0, ck = 0;
    var ta = [], ca = [], wa = [];
    State.cfRows.forEach(function(r) {
      tk += r.ty;
      ck += Math.max(0, r.cfns_y);
      ta.push(Math.round(tk));
      ca.push(Math.round(ck));
      wa.push(Math.round(r.wert_y - kp0));
    });
    var b3 = _baseOpts(c);

    _charts.verm = new Chart(vm, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Tilgung (Schulden abgebaut)',
            data: ta, borderColor: c.ch, backgroundColor: c.chF,
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
            tension: 0.3, fill: 'origin', stack: 'verm'
          },
          {
            label: 'Cashflow-Überschuss',
            data: ca, borderColor: c.gold, backgroundColor: c.goldF,
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
            tension: 0.3, fill: '-1', stack: 'verm'
          },
          {
            label: 'Wertsteigerung',
            data: wa, borderColor: c.green, backgroundColor: c.greenF,
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
            tension: 0.3, fill: '-1', stack: 'verm'
          }
        ]
      },
      options: Object.assign(b3, {
        plugins: Object.assign(b3.plugins, {
          tooltip: Object.assign(b3.plugins.tooltip, {
            callbacks: {
              label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + _fmtEUR(ctx.raw); },
              footer: function(items) {
                var total = 0;
                items.forEach(function(i) { total += i.raw; });
                return 'Σ Vermögenszuwachs: ' + _fmtEUR(total);
              }
            }
          })
        }),
        scales: Object.assign(b3.scales, {
          y: Object.assign(b3.scales.y, { stacked: true })
        })
      }),
      plugins: [_ezbLine(c, bindjIdx, 'EZB')]
    });
  }

  // ── 4) IMMOBILIENSCHERE — Equity-Spread ──────────────────────
  _destroy('scher');
  var sc = document.getElementById('scherChart');
  if (sc) {
    var wertData = State.cfRows.map(function(r) { return Math.round(r.wert_y); });
    var rsData   = State.cfRows.map(function(r) { return Math.round(r.rs); });
    var b4 = _baseOpts(c);

    _charts.scher = new Chart(sc, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Immobilienwert',
            data: wertData,
            borderColor: c.green, backgroundColor: c.greenF,
            borderWidth: 2.8,
            pointRadius: function(ctx) {
              var i = ctx.dataIndex; var n = ctx.chart.data.labels.length - 1;
              return (i === 0 || i === n || i === bindjIdx) ? 5 : 0;
            },
            pointBackgroundColor: c.green, pointBorderColor: '#fff', pointBorderWidth: 2,
            tension: 0.3, fill: '+1', order: 2
          },
          {
            label: 'Restschuld',
            data: rsData,
            borderColor: c.red, backgroundColor: 'transparent',
            borderWidth: 2.4,
            pointRadius: function(ctx) {
              var i = ctx.dataIndex; var n = ctx.chart.data.labels.length - 1;
              return (i === 0 || i === n || i === bindjIdx) ? 5 : 0;
            },
            pointBackgroundColor: c.red, pointBorderColor: '#fff', pointBorderWidth: 2,
            tension: 0.3, fill: false, order: 1
          }
        ]
      },
      options: Object.assign(b4, {
        layout: { padding: { top: 14, right: 90, left: 4, bottom: 4 } },
        plugins: Object.assign(b4.plugins, {
          tooltip: Object.assign(b4.plugins.tooltip, {
            callbacks: {
              label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + _fmtEUR(ctx.raw); },
              footer: function(items) {
                if (items.length < 2) return '';
                var w = items.find(function(i) { return i.dataset.label === 'Immobilienwert'; });
                var r = items.find(function(i) { return i.dataset.label === 'Restschuld'; });
                if (!w || !r) return '';
                var eq = w.raw - r.raw;
                return '↳ Equity: ' + (eq >= 0 ? '+' : '') + _fmtEUR(eq);
              }
            }
          })
        })
      }),
      plugins: [
        _ezbLine(c, bindjIdx, 'EZB'),
        {
          id: 'endLabels',
          afterDraw: function(chart) {
            var ctx = chart.ctx, area = chart.chartArea;
            if (!area) return;
            var lastWert = wertData[wertData.length - 1];
            var lastRs   = rsData[rsData.length - 1];
            var lastEq   = lastWert - lastRs;
            var ySc = chart.scales.y;
            var yWert = ySc.getPixelForValue(lastWert);
            var yRs   = ySc.getPixelForValue(lastRs);

            ctx.save();
            ctx.font = '600 11px DM Sans';
            ctx.textAlign = 'left';
            ctx.fillStyle = c.green;
            ctx.fillText(_fmtK(lastWert) + ' €', area.right + 8, yWert + 4);
            ctx.font = '9px DM Sans';
            ctx.fillStyle = c.text;
            ctx.fillText('Marktwert', area.right + 8, yWert + 16);

            ctx.font = '600 11px DM Sans';
            ctx.fillStyle = c.red;
            ctx.fillText(_fmtK(lastRs) + ' €', area.right + 8, yRs + 4);
            ctx.font = '9px DM Sans';
            ctx.fillStyle = c.text;
            ctx.fillText('Restschuld', area.right + 8, yRs + 16);

            var midY = (yWert + yRs) / 2;
            ctx.font = '700 12px DM Sans';
            ctx.fillStyle = c.gold;
            ctx.fillText('+' + _fmtK(lastEq) + ' €', area.right + 8, midY + 2);
            ctx.font = '9px DM Sans';
            ctx.fillStyle = c.text;
            ctx.fillText('Equity', area.right + 8, midY + 14);
            ctx.restore();
          }
        }
      ]
    });
  }

  // V63.63: V25-Bank-Charts (4 SVG-Charts) parallel rendern
  if (window.BankCharts && window.BankCharts.renderAll) {
    try { window.BankCharts.renderAll(State); }
    catch(e) { console.warn('[BankCharts] render failed:', e); }
  }
}
