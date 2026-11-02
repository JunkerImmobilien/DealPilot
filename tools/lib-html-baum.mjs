/* lib-html-baum.mjs — v3073
 *
 * Ein kleiner Baum aus index.html, ohne Abhängigkeit (kein jsdom im Repo).
 * Kommentare, <script> und <style> werden geleert, die Zeilen bleiben, damit
 * jede Fundstelle ihre echte Zeilennummer trägt.
 *
 * Er ist NICHT der Browser: Tags, die der Parser implizit schließt (p, li,
 * td …), werden hier erst am eigenen Schlusstag oder am Schluss des Eltern-
 * elements zu. Für die Frage „liegt Feld X in Karte Y?" reicht das, weil
 * die App ihre Karten aus <div> baut. Gezählt wird an DIESEM Baum, und
 * jede Zahl nennt das.
 */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function leeren(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + blank(b) + c)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, b, c) => a + blank(b) + c);
}

function attrs(s) {
  const a = {};
  const re = /([^\s=\/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(s))) a[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return a;
}

export function baum(src) {
  const text = leeren(src);
  const root = { tag: '#root', attrs: {}, klassen: [], kinder: [], eltern: null, zeile: 0 };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let m, zeile = 1, pos = 0;
  while ((m = re.exec(text))) {
    for (let i = pos; i < m.index; i++) if (text.charCodeAt(i) === 10) zeile++;
    pos = m.index;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const top = stack[stack.length - 1];
    const el = { tag, attrs: attrs(m[3]), kinder: [], eltern: top, zeile };
    el.klassen = (el.attrs.class || '').split(/\s+/).filter(Boolean);
    top.kinder.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(el);
  }
  return root;
}

export function alle(el, pred, out = []) {
  for (const k of el.kinder) { if (pred(k)) out.push(k); alle(k, pred, out); }
  return out;
}
export function vorfahr(el, pred) {
  for (let e = el.eltern; e; e = e.eltern) if (pred(e)) return e;
  return null;
}
export function enthaelt(a, b) { for (let e = b; e; e = e.eltern) if (e === a) return true; return false; }
export const istKarte = (e) => e.klassen && e.klassen.includes('card');
export const istFeld = (e) => (e.tag === 'input' && (e.attrs.type || '').toLowerCase() !== 'hidden') || e.tag === 'select' || e.tag === 'textarea';
