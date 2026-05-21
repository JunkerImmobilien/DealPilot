/* V258-08: WK-Dashboard-Widget
 * Zeigt Gesamt-WK aller Won-Objekte in der Sidebar.
 */
(function() {
  'use strict';

  function fmtEUR(n) {
    if (typeof n !== 'number') return '0 €';
    return (n >= 0 ? '+' : '') + Math.round(n).toLocaleString('de-DE') + ' €';
  }

  function renderWidgetHtml() {
    if (!window.DealPilotWKAggregator) return '';
    const objects = DealPilotWKAggregator.getAllObjectsWithWK();
    if (!Array.isArray(objects) || objects.length === 0) return '';

    const thisYear = new Date().getFullYear();
    const totalThisYear = DealPilotWKAggregator.getTotalWK(thisYear) || 0;

    let html = '<div class="dp-wk-dashboard" style="margin:10px 12px;padding:12px;background:#fff;border:1px solid rgba(201,168,76,0.20);border-radius:10px;font-family:var(--font-main,\'IBM Plex Sans\',sans-serif);font-size:12px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<span style="font-weight:600;color:var(--ch,#2A2727)">Gesamt-WK (gewonnene)</span>';
    html += '<span style="font-size:10px;color:var(--muted,#7A7370)">' + thisYear + '</span>';
    html += '</div>';

    html += '<div style="font-size:20px;font-weight:700;color:' + (totalThisYear < 0 ? 'var(--green,#3FA56C)' : 'var(--ch,#2A2727)') + ';margin-bottom:4px">';
    html += fmtEUR(totalThisYear);
    html += '</div>';
    html += '<div style="font-size:10.5px;color:var(--muted,#7A7370);margin-bottom:8px">Summe Überschuss/Verlust V+V (' + objects.length + ' Objekt' + (objects.length === 1 ? '' : 'e') + ')</div>';

    // Aufklappbare Liste
    html += '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:var(--gold,#C9A84C);font-weight:500;padding:3px 0">Details anzeigen</summary>';
    html += '<div style="margin-top:6px;border-top:1px solid rgba(201,168,76,0.15);padding-top:6px">';
    objects.forEach(function(obj) {
      const wk = obj.wk_per_year && obj.wk_per_year[String(thisYear)];
      const color = (typeof wk === 'number' && wk < 0) ? 'var(--green,#3FA56C)' : (wk > 0 ? 'var(--red,#B8625C)' : 'var(--muted,#7A7370)');
      html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px">';
      html += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%">' + (obj.address || '–') + '</span>';
      html += '<span style="color:' + color + ';font-weight:500">' + fmtEUR(typeof wk === 'number' ? wk : 0) + '</span>';
      html += '</div>';
    });
    html += '</div></details>';

    html += '</div>';
    return html;
  }

  function inject() {
    if (!window.DealPilotWKAggregator) return;
    const sidebar = document.querySelector('aside.sidebar') || document.getElementById('sidebar');
    if (!sidebar) return;
    let host = document.getElementById('dp-wk-dashboard-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'dp-wk-dashboard-host';
      // Am oberen Rand der Sidebar (nach Login-Section)
      const firstSection = sidebar.querySelector('.sb-section, .sb-user, .sb-actions');
      if (firstSection && firstSection.nextSibling) {
        sidebar.insertBefore(host, firstSection.nextSibling);
      } else {
        sidebar.appendChild(host);
      }
    }
    host.innerHTML = renderWidgetHtml();
  }

  async function refresh() {
    if (!window.DealPilotWKAggregator) return;
    await DealPilotWKAggregator.loadAll(true);
    inject();
  }

  window.DealPilotWKDashboard = {
    render: inject,
    refresh: refresh,
    renderWidgetHtml: renderWidgetHtml,
    _meta: 'V258-08'
  };

  // Initial: nach App-Start + nach jedem Save
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(refresh, 1200);
    });
  } else {
    setTimeout(refresh, 1200);
  }

  // Bei Tab-Wechsel zu Dashboard nochmal refreshen
  document.addEventListener('click', function(e) {
    const tab = e.target.closest('.tab, .sb-section');
    if (tab) setTimeout(inject, 100);
  });
})();
