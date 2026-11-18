// tools/steuer-kontext-mappe-test.mjs · v3700 — Mappen-Gleichheitstest P2 (NUR STAGING)
//
// Marcel 18.11.2026: „dieselbe Steuer-Mappe, beim Kunden und beim Partner (aus dem Kundenstand) erzeugt, muss Zahl
// fuer Zahl gleich sein, auch mit GmbH-Objekten.“
//
// Ablauf (eigener Headless-Chrome, echte App auf https://app.staging.dealpilot.immo, echte Kurz-Tokens):
//   1. Container: tools/steuer-kontext-live.js einrichten  (Kunde = Kopie des Steuer-Mappe-Testkontos, Partner bekommt
//      eine abweichende eigene Steuer: zvE 250.000, Einzel, 9 % KiSt)
//   2. Kunde: jedes Objekt laden, Werbungskosten mit Anlage V ueber ALLE Jahre (finanzamt_anlagev) und die
//      Steuer-Mappe 2025/2026 erzeugen, Zahlen (EUR und %) einsammeln, dazu Steuer je Jahr aus State.cfRows.
//      Dann den Bestand senden, mit dem im Browser eingesammelten Steuerprofil (derselbe Weg wie der Senden-Dialog).
//   3. Container: pruefen (Fassung, _steuerbasis, nichts beim Partner geschrieben)
//   4. Partner: jeden Kundenstand laden, dieselben Dokumente, Zahl fuer Zahl vergleichen.
//      Gegenprobe: Kontext abgeschaltet -> die Zahlen MUESSEN abweichen (sonst misst der Test nichts).
//   5. Container: uebernehmen (fuer den Kunden / eigener Bestand, Verlustverrechnung)
//   6. Partner: weitergefuehrte Objekte oeffnen und speichern (Steuersaetze), Steuer-Mappe des Kunden 2025/2026 = Kunde.
//   7. Gesperrt: Freigabe ohne Steuerdaten, Stand neu senden -> beim Partner keine Steuerzahl, kein Steuerdokument.
//   8. Messkabine 390/1440 der neuen Ansichten, Bilder nach Dateien/Mandantenkonzept/P2-Messkabine/.
//   9. Container: abraeumen.
//
//   node tools/steuer-kontext-mappe-test.mjs [--bleiben]   (--bleiben: Testdaten nicht abraeumen)
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

const SERVER = 'root@116.203.214.11';
const APP = 'https://app.staging.dealpilot.immo';
const PORT = 9617;
const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const KRATZ = process.env.SK_KRATZ || path.join(WURZEL, '..', 'sk-kratz');
const BILDER = path.join(WURZEL, 'Dateien/Mandantenkonzept/P2-Messkabine');
fs.mkdirSync(KRATZ, { recursive: true }); fs.mkdirSync(BILDER, { recursive: true });
let n = 0, rot = 0;
const ok = (was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + was + (ist !== undefined && !b ? ' → ' + JSON.stringify(ist).slice(0, 400) : '')); };
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

function container(arg) {
  const live = path.join(WURZEL, 'tools/steuer-kontext-live.js');
  execSync(`scp -q "${live}" ${SERVER}:/tmp/skl.js`);
  const aus = execSync(`ssh ${SERVER} "docker cp /tmp/skl.js dealpilot-backend:/app/steuer-kontext-live.js && docker exec dealpilot-backend node /app/steuer-kontext-live.js ${arg}; echo RC=\\$?"`, { encoding: 'utf8' });
  return aus;
}
function liveZaehlen(aus, was) {
  process.stdout.write(aus.split('\n').filter((z) => /^\s+(ok|ROT)/.test(z)).join('\n') + '\n');
  const m = aus.match(/LIVE (\d+) Punkte, (\d+) rot/);
  ok('Container ' + was + ' vollstaendig', !!m && m[2] === '0', m && m[0]);
}

/* ── Chrome ─────────────────────────────────────────────────────────────── */
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(KRATZ, 'profil-' + Date.now()), '--no-first-run', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let ws = null, id = 0; const offen = new Map();
async function verbinden() {
  for (let i = 0; i < 40; i++) { try { const t = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); const p = t.find((x) => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await schlaf(250); }
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } });
  await cdp('Page.enable'); await cdp('Runtime.enable');
}
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; offen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(x) {
  const r = await cdp('Runtime.evaluate', { expression: '(async()=>{' + x + '})()', awaitPromise: true, returnByValue: true, timeout: 120000 });
  if (r.result && r.result.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result && r.result.result ? r.result.result.value : null;
}
async function breite(w, h) { await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h || 900, deviceScaleFactor: 1, mobile: w < 600 }); }
async function anmelden(k) {
  await cdp('Page.navigate', { url: APP + '/impressum.html' }); await schlaf(1500);
  await ev(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('ji_token', ${JSON.stringify(k.t)});
    localStorage.setItem('ji_session', JSON.stringify({ mode: 'api', userId: ${JSON.stringify(k.id)}, email: ${JSON.stringify(k.email)}, name: ${JSON.stringify(k.name)}, role: 'user', token: ${JSON.stringify(k.t)}, createdAt: new Date().toISOString(), expires: Date.now() + 3 * 3600 * 1000 }));
    localStorage.setItem('dp_detailgrad', '3'); return 1;`);
  await cdp('Page.navigate', { url: APP + '/?_=' + Date.now() });
  for (let i = 0; i < 120; i++) { await schlaf(500); if (await ev(`return !!(window.loadSaved && document.querySelector('.sb-card') && window.DpSteuerKontext && window.DpDokumente)`)) break; }
  await ev(`for (let i = 0; i < 60; i++) { const a = window.DealPilotTaxPeriods && DealPilotTaxPeriods.status(), b = window.DealPilotWKAggregator && DealPilotWKAggregator.status(); if (a === 'geladen' && b === 'geladen') break; await new Promise(r => setTimeout(r, 500)); }
    document.querySelectorAll('.dp-onboarding').forEach(e => e.remove()); return 1;`);
  await schlaf(1500);
}
/* Speichern stumm (Messung darf nicht speichern), ausser ausdruecklich */
async function laden(oid) {
  await ev(`window.__skSave = window.__skSave || window.saveObj; window.saveObj = function () { return Promise.resolve(null); };
    await window.loadSaved(${JSON.stringify(oid)});
    for (let i = 0; i < 60 && window._currentObjKey !== ${JSON.stringify(oid)}; i++) await new Promise(r => setTimeout(r, 250));
    await new Promise(r => setTimeout(r, 2500));
    try { calcNow(); } catch (e) {} try { renderTaxModule(); } catch (e) {} try { renderTaxTimeline && renderTaxTimeline(); } catch (e) {}
    await new Promise(r => setTimeout(r, 1200)); return 1;`);
}
const ZAHL = /[+\-−]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?(?:€|%)/g;
async function messen() {
  return ev(`const h = await DpDokumente.dokument('finanzamt_anlagev', { alle: true });
    const t = String(h).replace(/<style[\\s\\S]*?<\\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\\s+/g, ' ');
    const z = (t.match(${ZAHL.toString()}) || []).map(s => s.replace(/\\s/g, '').replace('−', '-'));
    const rows = (State.cfRows || []).slice(0, 15).map(r => [r.cal, Math.round((r.tax_y || 0) * 100) / 100, Math.round((r.cfns || r.cf_ns || 0) * 100) / 100]);
    const d = window._currentObjData || {};
    return { zahlen: z, rows, halter: (document.getElementById('halter') || {}).value, orig: d._steuerbasis ? d._steuerbasis.orig_id : window._currentObjKey,
      str: d.str, kontext: !!(window.DpSteuerKontext && DpSteuerKontext.aktiv()), gesperrt: !!(window.DpSteuerKontext && DpSteuerKontext.gesperrt()) };`);
}
async function mappe(jahr, kunde) {
  return ev(`const h = await DpDokumente.dokument('steuermappe', { jahr: ${jahr}${kunde ? ', kunde: ' + JSON.stringify(kunde) : ''} });
    const t = String(h).replace(/<style[\\s\\S]*?<\\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\\s+/g, ' ');
    return (t.match(${ZAHL.toString()}) || []).map(s => s.replace(/\\s/g, '').replace('−', '-'));`).catch((e) => ({ fehler: e.message }));
}
function gleich(a, b) {
  if (!a || !b || a.length !== b.length) return { ok: false, grund: 'Laenge ' + (a && a.length) + ' / ' + (b && b.length) };
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { ok: false, grund: 'Stelle ' + i + ': ' + a[i] + ' / ' + b[i] };
  return { ok: true };
}
async function bild(name, w) {
  await breite(w, w < 600 ? 844 : 900); await schlaf(900);
  const m = await ev(`const d = document.documentElement; let klein = 99, raus = 0;
    document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return;
      if (e.childNodes.length && [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) { const f = parseFloat(cs.fontSize); if (f < klein && r.right > 0 && r.left < innerWidth) klein = f; }
      if (r.right > innerWidth + 1 && cs.position !== 'fixed' && !e.closest('[style*="overflow"],.pk-st-wrap,.tl-scroll,table')) raus++; });
    return { sw: d.scrollWidth, cw: d.clientWidth, klein, raus };`);
  const s = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(BILDER, name + '-' + w + '.png'), Buffer.from(s.result.data, 'base64'));
  return m;
}

(async () => {
  let T = null;
  try {
    console.log('── 1 · einrichten'); const a1 = container('einrichten'); console.log(a1.split('\n').filter((z) => /eingerichtet|Fehler|Error/.test(z)).join('\n'));
    T = JSON.parse(execSync(`ssh ${SERVER} "docker exec dealpilot-backend cat /tmp/sk-tokens.json"`, { encoding: 'utf8' }));
    await verbinden(); await breite(1440, 900);

    console.log('── 2 · Kunde misst und sendet');
    await anmelden(T.kunde);
    const ids = Object.values(T.objekte);
    const kunde = {};
    for (const oid of ids) { await laden(oid); kunde[oid] = await messen(); }
    ok('Kunde: alle Objekte gemessen, eigener Rechenweg ohne Kontext', ids.every((i) => kunde[i] && kunde[i].zahlen.length > 20 && !kunde[i].kontext), ids.map((i) => kunde[i] && kunde[i].zahlen.length));
    const km = {}; for (const j of [2025, 2026]) km[j] = await mappe(j);
    ok('Kunde: Steuer-Mappe 2025 und 2026 erzeugt', Array.isArray(km[2025]) && Array.isArray(km[2026]) && km[2026].length > 10, [km[2025] && km[2025].length, km[2026] && km[2026].length]);
    const se = await ev(`const sp = await DpSteuerKontext.einsammeln(); window.__sp = sp;
      const r = await Auth.apiCall('/mein-partner/senden', { method: 'POST', body: { bestand: true, steuerprofil: sp } }); return { r, z: sp.zeitraeume.length, m: sp.mandanten.length, b: sp.bestand.length, a: sp.angaben };`);
    ok('Kunde sendet den Bestand mit Steuerprofil (eingesammelt im Browser)', se && se.r && se.r.gesendet === ids.length && se.z === 2 && se.b >= 2, se);

    console.log('── 3 · Server'); liveZaehlen(container('pruefen'), 'pruefen');

    console.log('── 4 · Partner misst die Kundenstaende');
    await anmelden(T.partner);
    const ks = await ev(`const r = await Auth.apiCall('/partner/kundenstaende'); return (r.kundenstaende || []).filter(x => x.client_id === ${JSON.stringify(T.client_id)}).map(x => ({ kopie: x.kopie_object_id, share: x.share_id, mit: x.mit_steuerprofil }));`);
    ok('Partner sieht alle Kundenstaende mit Steuerprofil', ks.length === ids.length && ks.every((x) => x.mit), ks);
    let gleichAlle = true, gmbhGleich = 0;
    for (const x of ks) {
      await laden(x.kopie); const p = await messen();
      const k = kunde[p.orig];
      const g = gleich(k && k.zahlen, p.zahlen), gr = JSON.stringify(k && k.rows) === JSON.stringify(p.rows);
      if (!(g.ok && gr)) gleichAlle = false;
      if (p.halter === 'mtest-steuer-gmbh' && g.ok && gr) gmbhGleich++;
      ok('Kundenstand ' + p.str + ' (' + p.halter + '): ' + p.zahlen.length + ' Zahlen und Steuer je Jahr gleich wie beim Kunden, Kontext aktiv', g.ok && gr && p.kontext && !p.gesperrt && p.halter === k.halter, [g.grund, gr, p.kontext, p.halter, k && k.halter]);
    }
    ok('Mappen-Gleichheit: alle Objekte Zahl fuer Zahl, darunter beide GmbH-Objekte', gleichAlle && gmbhGleich === 2, gmbhGleich);
    /* Gegenprobe: Kontext aus -> Partner rechnet mit seinen Daten, Zahlen MUESSEN abweichen */
    const priv = ks[0];
    await laden(priv.kopie);
    const roh = await ev(`const a = DpSteuerKontext.aktiv; DpSteuerKontext.aktiv = () => null; try { if (window._zveCache) _zveCache.ts = 0; calcNow(); renderTaxModule(); await new Promise(r => setTimeout(r, 1200));
      const h = await DpDokumente.dokument('finanzamt_anlagev', { alle: true }); const t = String(h).replace(/<style[\\s\\S]*?<\\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\\s+/g, ' ');
      return { z: (t.match(${ZAHL.toString()}) || []).map(s => s.replace(/\\s/g, '').replace('−', '-')), rows: (State.cfRows || []).slice(0, 15).map(r => [r.cal, Math.round((r.tax_y || 0) * 100) / 100]) }; } finally { DpSteuerKontext.aktiv = a; if (window._zveCache) _zveCache.ts = 0; calcNow(); }`);
    const kp = Object.values(kunde).find((k) => k.zahlen.length === (roh.z || []).length) || kunde[ids[0]];
    ok('Gegenprobe: ohne Kontext rechnet der Partner mit seiner eigenen Steuer, die Zahlen weichen ab (der Test misst den Kontext)', !gleich(kp.zahlen, roh.z).ok || JSON.stringify(kp.rows.map((r) => r.slice(0, 2))) !== JSON.stringify(roh.rows), roh.rows && roh.rows.slice(0, 3));
    const lsP = await ev(`return { ip: localStorage.getItem('dp_investment_profile'), m: localStorage.getItem('dp_mandanten') };`);
    ok('Browser des Partners: weder Investmentprofil noch Mandanten tragen Daten des Kunden', !(lsP.m || '').includes('mtest-steuer-gmbh') && !(lsP.ip || '').includes('140000'), lsP);

    console.log('── 4b · Messkabine Kundenstand');
    const gmbhKs = ks.find(() => true);
    await laden(ks[ks.length - 1].kopie);
    await ev(`try { if (typeof switchTab === 'function') switchTab(4); } catch (e) {} const t = document.querySelector('#tax-result-box'); if (t) t.scrollIntoView({ block: 'start' }); return 1;`);
    for (const w of [1440, 390]) { const m = await bild('kundenstand-steuer', w); ok('Messkabine Kundenstand Steuer ' + w + ': kein Querscrollen, Schrift >= 8,5 px', m.sw <= m.cw + 1 && m.klein >= 8.5, m); }

    console.log('── 5 · Uebernehmen'); const a5 = container('uebernehmen'); liveZaehlen(a5, 'uebernehmen');
    const weiter = JSON.parse((a5.match(/WEITER (\{.*\})/) || [0, '{}'])[1]);

    console.log('── 6 · Partner fuehrt fuer den Kunden weiter: oeffnen, speichern, Steuer-Mappe des Kunden');
    await breite(1440, 900);
    for (const orig of Object.keys(weiter)) {
      await laden(weiter[orig]);
      const p = await messen();
      const k = kunde[orig];
      ok('weitergefuehrt ' + p.str + ' (' + p.halter + '): Zahlen gleich wie beim Kunden', gleich(k.zahlen, p.zahlen).ok && JSON.stringify(k.rows) === JSON.stringify(p.rows) && p.kontext, gleich(k.zahlen, p.zahlen).grund);
      await ev(`window.saveObj = window.__skSave; await window.saveObj(); await new Promise(r => setTimeout(r, 2500)); window.saveObj = function () { return Promise.resolve(null); }; return 1;`);
    }
    for (const j of [2025, 2026]) {
      const pm = await mappe(j, T.client_id);
      const g = gleich(km[j], pm);
      ok('Steuer-Mappe ' + j + ' des Kunden beim Partner = beim Kunden, Zahl fuer Zahl (' + (Array.isArray(pm) ? pm.length : 0) + ' Zahlen)', g.ok, g.grund || pm);
    }
    await ev(`const b = document.querySelector('#dppk-wf'); return b ? b.textContent : null;`).then((t) => ok('Band „Für den Kunden weitergeführt“ mit Steuerprofil des Kunden', !!t && /Für den Kunden weitergeführt/.test(t) && /Steuer mit den Angaben von/.test(t), t));
    for (const w of [1440, 390]) { const m = await bild('weitergefuehrt', w); ok('Messkabine weitergefuehrt ' + w, m.sw <= m.cw + 1 && m.klein >= 8.5, m); }

    console.log('── 7 · Gesperrt: Freigabe ohne Steuerdaten');
    container('freigabe dauer 0');
    await anmelden(T.kunde);
    await ev(`return Auth.apiCall('/mein-partner/senden', { method: 'POST', body: { object_ids: [${JSON.stringify(ids[0])}] } });`);
    await anmelden(T.partner);
    const ks2 = await ev(`const r = await Auth.apiCall('/partner/kundenstaende'); return (r.kundenstaende || []).filter(x => x.client_id === ${JSON.stringify(T.client_id)}).map(x => ({ kopie: x.kopie_object_id, mit: x.mit_steuerprofil, b: x.bereiche }));`);
    const ohne = ks2.find((x) => !x.mit);
    ok('neuer Stand ohne Steuerdaten traegt kein Steuerprofil', !!ohne && ohne.b && ohne.b.steuerdaten === false, ks2);
    if (ohne) {
      await laden(ohne.kopie);
      const g = await ev(`try { if (typeof switchTab === 'function') switchTab(4); } catch (e) {}
        await new Promise(r => setTimeout(r, 800)); DpSteuerKontext.anwenden();
        const box = document.getElementById('tax-result-box'); const sicht = box ? [...box.children].filter(c => getComputedStyle(c).display !== 'none').map(c => c.className) : null;
        const cf = document.getElementById('cr-cfns'); let dok = null; try { await DpDokumente.dokument('finanzamt', {}); dok = 'erstellt'; } catch (e) { dok = e.message; }
        return { ges: DpSteuerKontext.gesperrt(), body: document.body.classList.contains('dp-sk-gesperrt'), sicht, cfFont: cf ? getComputedStyle(cf).fontSize : null, dok, band: (document.getElementById('dppk-ks') || {}).textContent };`);
      ok('Gesperrt: keine Steuerzahl (nur der Hinweis im Reiter Steuer), CF nach Steuern ausgeblendet, kein Steuerdokument, Band „Steuerdaten nicht freigegeben“',
        g.ges && g.body && g.sicht && g.sicht.length === 1 && /dp-sk-hinweis/.test(g.sicht[0]) && g.cfFont === '0px' && /nicht freigegeben/.test(g.dok || '') && /Steuerdaten nicht freigegeben/.test(g.band || ''), g);
      for (const w of [1440, 390]) { const m = await bild('kundenstand-gesperrt', w); ok('Messkabine gesperrt ' + w, m.sw <= m.cw + 1 && m.klein >= 8.5, m); }
    }

    console.log('── 8 · Messkabine Partner-Ansichten');
    await breite(1440, 900);
    const kk = ks[0];
    await ev(`if (window.DpPartnerKunden && DpPartnerKunden.cockpit) DpPartnerKunden.cockpit('staende'); else document.querySelector('[data-pk-reiter]') ; return 1;`).catch(() => null);
    const dlg = await ev(`const r = await Auth.apiCall('/partner/kundenstaende'); const x = (r.kundenstaende || []).find(y => y.share_id === ${JSON.stringify(kk.share)});
      if (!window.DpPartnerKunden || !DpPartnerKunden._uebernehmenDialog) return 'kein Zugriff'; DpPartnerKunden._uebernehmenDialog(x); await new Promise(r => setTimeout(r, 500)); return !!document.getElementById('dppk-dlg');`);
    ok('Übernehmen-Dialog mit Wahl geöffnet', dlg === true, dlg);
    if (dlg === true) for (const w of [1440, 390]) { const m = await bild('uebernehmen-dialog', w); ok('Messkabine Übernehmen-Dialog ' + w, m.sw <= m.cw + 1 && m.klein >= 8.5, m); }
    await ev(`const d = document.getElementById('dppk-dlg'); if (d) d.remove(); return 1;`);
    const hub = await ev(`if (!window.DpPartnerKunden || !DpPartnerKunden._kundeDialog) return 'kein Zugriff'; await DpPartnerKunden._kundeDialog(${JSON.stringify(T.client_id)}); await new Promise(r => setTimeout(r, 1500));
      const box = document.getElementById('dppk-hub-kunde'); if (!box) return 'kein Fenster'; box._zeigen(1); await new Promise(r => setTimeout(r, 300));
      const t = box.querySelector('[data-pk-steuer]'); return t ? t.textContent.slice(0, 400) : 'kein Reiter';`);
    ok('Reiter Steuer im Kundenfenster zeigt Zeiträume, Gesellschaft, Überführungen und Fassungen', typeof hub === 'string' && /Steuerzeiträume/.test(hub) && /Muster Immobilien GmbH/.test(hub), hub);
    if (typeof hub === 'string' && /Steuerzeiträume/.test(hub)) for (const w of [1440, 390]) { const m = await bild('reiter-steuer', w); ok('Messkabine Reiter Steuer ' + w, m.sw <= m.cw + 1 && m.klein >= 8.5, m); }
  } catch (e) { ok('Lauf', false, e.message); }
  finally {
    try { if (!process.argv.includes('--bleiben')) console.log(container('abraeumen').split('\n').filter((z) => /abgeraeumt/.test(z)).join('')); } catch (e) { console.error('abraeumen', e.message); }
    try { ws && ws.close(); } catch (e) {} try { chrome.kill(); } catch (e) {}
    console.log('\nsteuer-kontext-mappe-test v3700 · ' + n + ' Punkte, ' + (n - rot) + ' gruen, ' + rot + ' rot');
    process.exit(rot ? 1 : 0);
  }
})();
