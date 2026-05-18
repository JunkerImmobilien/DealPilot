// DealPilot Admin V197 — Vanilla SVG Line Chart (unverändert von V196)
'use strict';

const Charts = (function() {

  function renderLineChart(container, data, opts) {
    opts = opts || {};
    const color = opts.color || '#c9a042';
    const fmt = opts.valueFormat || (v => String(v));
    const height = opts.height || 200;

    container.innerHTML = '';

    if (!data || !data.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Keine Daten</div>';
      return;
    }

    const width = container.clientWidth || 600;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map(d => d.value);
    const max = Math.max(...values, 1);
    const min = 0;
    const range = max - min || 1;

    const xStep = data.length > 1 ? chartW / (data.length - 1) : 0;

    function xCoord(i) { return padding.left + i * xStep; }
    function yCoord(v) { return padding.top + chartH - ((v - min) / range) * chartH; }

    const points = data.map((d, i) => `${xCoord(i)},${yCoord(d.value)}`).join(' ');

    let areaPath = `M ${xCoord(0)} ${yCoord(0)} `;
    data.forEach((d, i) => { areaPath += `L ${xCoord(i)} ${yCoord(d.value)} `; });
    areaPath += `L ${xCoord(data.length - 1)} ${yCoord(0)} Z`;

    const yTicks = [];
    for (let i = 0; i <= 4; i++) {
      const v = min + (range / 4) * i;
      yTicks.push({ v, y: yCoord(v) });
    }

    const xLabelStep = Math.max(1, Math.floor(data.length / 7));
    const xLabels = [];
    for (let i = 0; i < data.length; i += xLabelStep) {
      xLabels.push({ x: xCoord(i), label: data[i].label });
    }

    const svg = `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:${height}px;">
        ${yTicks.map(t => `
          <line x1="${padding.left}" y1="${t.y}" x2="${width - padding.right}" y2="${t.y}"
                stroke="#e5dfd2" stroke-width="1" stroke-dasharray="${t.v === 0 ? '0' : '3,3'}"/>
          <text x="${padding.left - 8}" y="${t.y + 4}" text-anchor="end" font-size="11" fill="#6a6a6a" font-family="DM Sans, sans-serif">
            ${fmt(t.v)}
          </text>
        `).join('')}
        ${xLabels.map(l => `
          <text x="${l.x}" y="${height - padding.bottom + 20}" text-anchor="middle" font-size="10" fill="#6a6a6a" font-family="DM Sans, sans-serif">
            ${l.label}
          </text>
        `).join('')}
        <path d="${areaPath}" fill="${color}" opacity="0.12"/>
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
        ${data.length <= 31 ? data.map((d, i) => `
          <circle cx="${xCoord(i)}" cy="${yCoord(d.value)}" r="3" fill="${color}">
            <title>${d.label}: ${fmt(d.value)}</title>
          </circle>
        `).join('') : ''}
      </svg>
    `;
    container.innerHTML = svg;
  }

  function renderDonut(container, data, opts) {
    opts = opts || {};
    const size = opts.size || 220;
    container.innerHTML = '';

    if (!data || !data.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Keine Daten</div>';
      return;
    }

    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    if (total === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Noch keine Daten</div>';
      return;
    }

    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 20;
    const innerR = r * 0.65;

    let angle = -Math.PI / 2;
    const arcs = data.map((d, i) => {
      const pct = d.value / total;
      const a1 = angle;
      const a2 = angle + pct * 2 * Math.PI;
      angle = a2;
      if (d.value === 0) return '';

      const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
      const x1 = cx + Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r;
      const y2 = cy + Math.sin(a2) * r;
      const x3 = cx + Math.cos(a2) * innerR;
      const y3 = cy + Math.sin(a2) * innerR;
      const x4 = cx + Math.cos(a1) * innerR;
      const y4 = cy + Math.sin(a1) * innerR;

      return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z"
                    fill="${d.color}" opacity="0.9">
                <title>${d.label}: ${d.value} (${(pct * 100).toFixed(0)}%)</title>
              </path>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
        <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="width:${size}px;height:${size}px;flex-shrink:0;">
          ${arcs}
          <text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="24" font-weight="700" fill="#1a1a1a" font-family="DM Sans, sans-serif">${total}</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="11" fill="#6a6a6a" font-family="DM Sans, sans-serif">User gesamt</text>
        </svg>
        <div style="flex:1;min-width:140px;">
          ${data.map(d => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.9em;">
              <span style="display:inline-block;width:14px;height:14px;background:${d.color};border-radius:3px;flex-shrink:0;"></span>
              <span style="flex:1;">${d.label}</span>
              <strong>${d.value}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return { renderLineChart, renderDonut };
})();
