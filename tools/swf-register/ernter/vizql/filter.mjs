// Kategorie-Filter eines Kalkulators (z. B. GAG Oldenburg-Cloppenburg "Lage mit Faktor Satz") lesen und setzen.
// filterInfo: Feldname + Domaene aus dem Bootstrap; setzeFilter: tabdoc/categorical-filter-by-index.
import * as T from './tab.mjs';
export function filterInfo(boot, caption) {
  let fn = null, domain = null;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o === 'object' && !Array.isArray(o)) {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string' && (v.startsWith('{')||v.startsWith('[')) && v.includes(caption)) { try { walk(JSON.parse(v)); } catch {} }
      }
    }
    if (o.fieldCaption === caption && o.table && Array.isArray(o.table.tuples)) {
      domain = o.table.tuples.map((t) => ({ sel: !!t.s, v: (t.t && t.t[0] && t.t[0].v) }));
      if (Array.isArray(o.name)) fn = '[' + o.name[0] + '].[' + o.name[1] + ']';
    }
    for (const k in o) walk(o[k]);
  };
  walk(boot);
  return { fn, domain };
}
export async function setzeFilter(s, fn, idx, worksheet = 'Berechnung', dashboard = 'Dash') {
  const r = await T.befehl(s, 'tabdoc', 'categorical-filter-by-index', { visualIdPresModel: JSON.stringify({ worksheet, dashboard }), globalFieldName: fn, membershipTarget: 'filter', filterIndices: JSON.stringify([idx]), filterUpdateType: 'filter-replace' });
  if (r && r.errorType) throw new Error('Filter: ' + (r.message || '').slice(0, 200));
  return r;
}
