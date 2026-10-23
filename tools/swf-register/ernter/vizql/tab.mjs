// Lesender VizQL-Client fuer Tableau Public (Sitzung, Bootstrap, Parameter setzen, SVG-Export).
// Gemessen 22.10.2026: der Faktor kommt als Text im SVG-Export des Blatts "Berechnung"
// (tabsrv/export-image-server, mediaType svg, Abruf ueber tempfile). Kein Browser noetig.
import { writeFileSync } from 'node:fs';
const H = 'https://public.tableau.com';
const UA = 'Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)';

export function teile(txt) {
  const out = []; let i = 0;
  while (i < txt.length) {
    const s = txt.indexOf(';', i); if (s < 0) break;
    const n = Number(txt.slice(i, s)); if (!Number.isFinite(n)) break;
    out.push(JSON.parse(txt.slice(s + 1, s + 1 + n))); i = s + 1 + n;
  }
  return out;
}

function hdr(s) {
  const h = { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/javascript', 'X-Requested-With': 'XMLHttpRequest' };
  if (s.gsh) h['global-session-header'] = s.gsh;
  if (s.sid) h['X-Session-Id'] = s.sid;
  return h;
}

export async function viewName(wb) {
  const r = await fetch(`${H}/profile/api/workbook/${wb}`, { headers: { 'User-Agent': UA } });
  const j = await r.json();
  return { view: j.defaultViewName, sheets: (j.viewInfos || []).map((v) => [v.sheetRepoUrl.split('/').pop(), v.sheetTitle]), update: j.lastUpdateDate };
}

export async function sitzung(wb, view) {
  const q = ':embed=y&:showVizHome=no&:display_count=n';
  const r = await fetch(`${H}/vizql/w/${wb}/v/${view}/startSession/viewing?${q}`, { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/json' } });
  const gsh = r.headers.get('global-session-header');
  const j = await r.json();
  const s = { wb, view, sid: j.sessionid, root: j.vizql_root, gsh, sticky: j.stickySessionKey, sheet: j.sheetId };
  const body = new URLSearchParams({
    worksheetPortSize: '{"w":1600,"h":1200}', dashboardPortSize: '{"w":1600,"h":1200}', clientDimension: '{"w":1600,"h":1200}',
    renderMapsClientSide: 'true', isBrowserRendering: 'true', browserRenderingThreshold: '100000', formatDataValueLocally: 'false',
    clientNum: '', navType: 'Reload', navSrc: 'Top', devicePixelRatio: '1', clientRenderPixelLimit: '25000000',
    allowAutogenWorksheetPhoneLayouts: 'true', sheet_id: j.sheetId, showParams: '{"checkpoint":false,"refresh":false,"refreshUnmodified":false,"unknownParams":""}',
    stickySessionKey: j.stickySessionKey, filterTileSize: '200', locale: 'de_DE', language: 'de', verboseMode: 'false',
    ':session_feature_flags': '{}', keychain_version: '1'
  });
  const b = await fetch(`${H}${s.root}/bootstrapSession/sessions/${s.sid}`, { method: 'POST', body, headers: hdr(s) });
  s.boot = teile(await b.text());
  s.params = parameter(s.boot);
  return s;
}

export function parameter(obj) {
  const seen = new Map();
  (function w(o) {
    if (!o || typeof o !== 'object') return;
    if (o.parameterName && o.fieldCaption && !seen.has(o.parameterName)) {
      seen.set(o.parameterName, { name: o.parameterName, caption: o.fieldCaption, typ: o.dataType, domain: o.parameterDomainType, wert: o.formattedValue, roh: o.unformattedValue, liste: o.valuesAliases || null, min: o.formattedMin || null, max: o.formattedMax || null });
    }
    for (const k in o) w(o[k]);
  })(obj);
  return [...seen.values()];
}

export async function befehl(s, ns, cmd, felder) {
  const body = new URLSearchParams(felder);
  for (let v = 1; v <= 3; v++) {
    try {
      const r = await fetch(`${H}${s.root}/sessions/${s.sid}/commands/${ns}/${cmd}`, { method: 'POST', body, headers: { ...hdr(s), Accept: 'application/json' } });
      const t = await r.text();
      try { return JSON.parse(t); } catch { if (v === 3) return { status: r.status, text: t.slice(0, 500) }; }
    } catch (e) { if (v === 3) throw e; }
    await new Promise((res) => setTimeout(res, 1500 * v));
  }
}

export async function setze(s, caption, wert) {
  const p = s.params.find((x) => x.caption === caption);
  if (!p) throw new Error('Parameter fehlt: ' + caption);
  const r = await befehl(s, 'tabdoc', 'set-parameter-value', { globalFieldName: p.name, valueString: String(wert), useUsLocale: 'true' });
  if (r && r.errorType) throw new Error('set ' + caption + ': ' + (r.message || '').slice(0, 200));
  return r;
}

export async function setzeIndex(s, caption, idx) {
  const p = s.params.find((x) => x.caption === caption);
  if (!p) throw new Error('Parameter fehlt: ' + caption);
  const r = await befehl(s, 'tabdoc', 'set-parameter-value-from-index', { parameterName: p.name, idx: String(idx) });
  if (r && r.errorType) throw new Error('setIdx ' + caption + ': ' + (r.message || '').slice(0, 200));
  return r;
}

export async function svg(s, sheet) {
  const r = await befehl(s, 'tabsrv', 'export-image-server', { sheet, mediaType: 'svg', scrollOffsetSheets: '[]', scrollOffsetPoints: '[]' });
  const key = (JSON.stringify(r).match(/"resultKey":"([^"]+)"/) || [])[1];
  if (!key) throw new Error('kein resultKey fuer ' + sheet + ': ' + JSON.stringify(r).slice(0, 200));
  const f = await fetch(`${H}${s.root}/tempfile/sessions/${s.sid}?key=${key}&keepfile=yes&attachment=yes`, { headers: { 'User-Agent': UA, 'global-session-header': s.gsh || '' } });
  return f.text();
}

export function texte(svgText) {
  return [...svgText.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).trim()).filter((t) => t && t !== 'Rendered by Tableau' && !/^TEMP_/.test(t));
}

/** Texte mit absoluter Position (Summe der translate-Anteile der umgebenden <g transform="matrix(...)">). */
export function texteMitPos(svgText) {
  const out = []; const stack = [[0, 0]];
  const re = /<g\b([^>]*)>|<\/g>|<text\b([^>]*)>([^<]*)<\/text>/g; let m;
  while ((m = re.exec(svgText))) {
    if (m[0].startsWith('</g')) { stack.pop(); continue; }
    if (m[1] !== undefined && m[0].startsWith('<g')) {
      const [px, py] = stack[stack.length - 1]; let dx = 0, dy = 0;
      const t = /transform="matrix\(([^)]*)\)"/.exec(m[1]); if (t) { const v = t[1].split(/[ ,]+/).map(Number); dx = v[4] || 0; dy = v[5] || 0; }
      const tr = /transform="translate\(([^)]*)\)"/.exec(m[1]); if (tr) { const v = tr[1].split(/[ ,]+/).map(Number); dx = v[0] || 0; dy = v[1] || 0; }
      stack.push([px + dx, py + dy]); continue;
    }
    const [px, py] = stack[stack.length - 1];
    const x = Number((/\bx="([^"]*)"/.exec(m[2]) || [])[1] || 0), y = Number((/\by="([^"]*)"/.exec(m[2]) || [])[1] || 0);
    const t = m[3].replace(/&amp;/g, '&').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).trim();
    if (t && t !== 'Rendered by Tableau' && !/^TEMP_/.test(t)) out.push({ t, x: px + x, y: py + y });
  }
  return out;
}
