'use strict';
/* pdf-dienst/server.js — die PDFs der App, auf dem Server erzeugt (v2961)
 *
 * Marcel am 26.10.2026: der Telegram-Bot soll die PDFs schicken. Die PDFs
 * entstehen aber im BROWSER (jsPDF in pdf.js, pdf-investment-bank.js,
 * storage.js) — mit allem, was die App dort weiss: Rechenkerne, Branding,
 * Whitelabel, Plan-Sperren, Fotos, Diagramme aus dem DOM.
 *
 * DER WEG IST KEIN NACHBAU. Eine zweite PDF-Fassung im Backend waere am
 * ersten Tag dieselbe und ab dem zweiten eine andere — und welche der
 * Kunde bekommt, entschiede der Weg, nicht das Objekt. Stattdessen:
 *
 *   1  Headless-Chromium oeffnet DIE ECHTE APP, angemeldet mit einem
 *      kurzlebigen Token (5 Minuten) fuer genau diesen Nutzer.
 *   2  Es laedt das Objekt (loadSaved) und ruft DIESELBE Funktion wie der
 *      Knopf: exportPDF · exportPDFBank · exportGlobalBankPDF.
 *   3  Die Datei, die jsPDF per doc.save() herunterlaedt, wird ueber das
 *      Chrome-Protokoll abgefangen (Browser.setDownloadBehavior).
 *
 * DER DIENST SCHREIBT NICHTS. Jeder nicht-lesende Aufruf an /api/v1 wird
 * abgewiesen — ausser /objects/track-usage, weil ein PDF-Export im Plan
 * gezaehlt wird, egal von welcher Tuer. So kann ein Auto-Speichern beim
 * Laden das Objekt nicht veraendern.
 *
 * GRENZEN: hoechstens PDF_GLEICHZEITIG Laeufe zugleich (Vorgabe 1), eine
 * Warteschlange von PDF_WARTESCHLANGE, eine Frist von PDF_FRIST_MS auf den
 * GANZEN Lauf (nicht je Schritt — „Frist auf dem Ganzen"). Der Browser wird
 * je Lauf neu gestartet und in jedem Fall geschlossen, notfalls per SIGKILL.
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = Number(process.env.PORT || 4100);
const GEHEIM = process.env.PDF_DIENST_SECRET || '';
const APP_URL = String(process.env.APP_URL || '').replace(/\/+$/, '');
const CHROMIUM = process.env.CHROMIUM_PFAD || '/usr/bin/chromium';
const GLEICHZEITIG = Math.max(1, Math.min(2, Number(process.env.PDF_GLEICHZEITIG || 1)));
const WARTE_MAX = Math.max(0, Number(process.env.PDF_WARTESCHLANGE || 4));
const FRIST_MS = Number(process.env.PDF_FRIST_MS || 120000);

/* Welche PDFs, und was jeweils im Browser passiert. Der Text in `ruf` ist
   genau der Aufruf, den der Knopf in der App macht. */
const ARTEN = {
  investment: { objekt: true, name: 'Investment-PDF (hell)' },
  investment_dunkel: { objekt: true, name: 'Investment-PDF (Obsidian)' },
  bank:       { objekt: true, name: 'Investment Case (Bankfassung)' },
  bank_kurz:  { objekt: true, name: 'Investment Case (Kurzfassung)' },
  bankexport: { objekt: false, name: 'Bankexport (alle Darlehen)' },
  marktbericht: { objekt: false, bericht: true, name: 'Marktbericht' }
};

/* Was die App schreiben darf, waehrend wir sie fernsteuern. */
/* GEMESSEN beim ersten Lauf (26.10.2026, Objekt Am Markt 9): beim Laden
   schickt die App acht nicht-lesende Aufrufe. Vier davon SCHREIBEN
   (PUT objects, PUT portfolio-spiegel x2, POST tax-snapshots) und bleiben
   gesperrt. Vier RECHNEN nur und speichern nichts — ohne sie fehlten im
   PDF Potenzial, Zinssatz, Ausstattung und Kaufpreisaufteilung: */
const SCHREIBEN_ERLAUBT = [
  /\/api\/v1\/objects\/track-usage(\?|$)/,              /* Plan zaehlt den Export */
  /\/api\/v1\/marktbericht\/potenzial(\?|$)/,           /* Rechnung, kein Abruf (nicht /potenzial/markt) */
  /\/api\/v1\/marktbericht\/wertparameter\/zinssatz(\?|$)/,
  /\/api\/v1\/marktbericht\/ausstattung\/vorschlag(\?|$)/,
  /\/api\/v1\/bmf\/(pipeline|aufteilung)(\?|$)/          /* LibreOffice-Rechnung, schreibt nichts */
];

function log(m) { try { console.log('[pdf-dienst] ' + m); } catch (e) {} }

/* ── Speicher ─────────────────────────────────────────────────────────────
 * GEMESSEN beim ersten erfolgreichen Lauf: die Summe VmRSS aller
 * Chromium-Prozesse ergab 1.534 MB — mehr als das Limit des Containers
 * (1.200 MB), der dabei nicht starb. Die Summe zaehlt den geteilten
 * Speicher jedes Renderers mit. Gemessen wird deshalb die cgroup des
 * Containers (memory.current, cgroup v2): das ist die Zahl, an der das
 * Limit greift. */
function containerMb() {
  try {
    const v = fs.readFileSync('/sys/fs/cgroup/memory.current', 'utf8');
    return Math.round(Number(v) / 1048576);
  } catch (e) {
    try { return Math.round(Number(fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8')) / 1048576); } catch (x) { return null; }
  }
}

/* ── Die Warteschlange ────────────────────────────────────────────────── */
let laufend = 0;
const schlange = [];
let zaehler = { gesamt: 0, ok: 0, fehler: 0 };

function einreihen(arbeit) {
  return new Promise((resolve, reject) => {
    if (laufend >= GLEICHZEITIG && schlange.length >= WARTE_MAX) {
      const e = new Error('Der PDF-Dienst ist gerade voll. Bitte gleich noch einmal.');
      e.status = 503; e.code = 'voll';
      return reject(e);
    }
    schlange.push({ arbeit, resolve, reject });
    weiter();
  });
}
function weiter() {
  while (laufend < GLEICHZEITIG && schlange.length) {
    const j = schlange.shift();
    laufend++;
    Promise.resolve().then(j.arbeit).then(j.resolve, j.reject).finally(() => { laufend--; weiter(); });
  }
}

/* ── Ein Lauf ─────────────────────────────────────────────────────────── */
async function erzeugen(auftrag) {
  const art = ARTEN[auftrag.art];
  const t0 = Date.now();
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
  const dlOrdner = path.join(ordner, 'dl');
  fs.mkdirSync(dlOrdner);
  const spur = { konsole: [], toasts: [], blockiert: [], speicherMaxMb: 0, schritte: [] };
  const schritt = (s) => spur.schritte.push(s + ' @' + (Date.now() - t0) + 'ms');
  let browser = null;
  const messer = setInterval(() => {
    const mb = containerMb();
    if (mb != null && mb > spur.speicherMaxMb) spur.speicherMaxMb = mb;
  }, 400);

  const lauf = (async () => {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM,
      headless: true,
      userDataDir: path.join(ordner, 'profil'),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run',
        '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--lang=de-DE']
    });
    schritt('browser');
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error' || t === 'warning' || /pdf/i.test(m.text())) {
        spur.konsole.push(t + ': ' + m.text().slice(0, 240));
        if (spur.konsole.length > 40) spur.konsole.shift();
      }
    });
    page.on('pageerror', (e) => spur.konsole.push('pageerror: ' + String(e && e.message).slice(0, 240)));

    /* Anmeldung: dieselben zwei Eintraege, die initAuth() nach dem Login
       setzt (auth.js v627). Dazu die Merker, die Willkommens-Fenster und
       Touren unterdruecken — die gehoeren einem Menschen, nicht uns. */
    await page.evaluateOnNewDocument((tok, ses) => {
      try {
        localStorage.setItem('ji_token', tok);
        localStorage.setItem('ji_session', ses);
      } catch (e) {}
      /* DER BLOB WIRD ABGEFANGEN, NICHT DER CODE ERSETZT. jsPDF speichert
         ueber FileSaver: Blob -> URL.createObjectURL -> <a download>.click.
         Wir lesen an genau dieser Stelle mit; alles davor (Wasserzeichen-
         Haken der App auf jsPDF.prototype.save, Branding, Whitelabel)
         laeuft unveraendert. Der Klick selbst wird verschluckt. */
      try {
        window.__dpPdf = [];
        const alt = URL.createObjectURL.bind(URL);
        URL.createObjectURL = function (b) {
          try {
            if (b && typeof b === 'object' && /pdf/i.test(b.type || '')) {
              const r = new FileReader();
              const e = { name: null, b64: null, groesse: b.size };
              window.__dpPdf.push(e);
              r.onload = () => { e.b64 = String(r.result).split(',')[1] || ''; };
              r.readAsDataURL(b);
              const url = alt(b);
              e.url = url;
              return url;
            }
          } catch (x) {}
          return alt(b);
        };
        const klick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          try {
            const e = (window.__dpPdf || []).find((x) => x.url && x.url === this.href);
            if (e) { e.name = this.download || e.name; return; }
          } catch (x) {}
          return klick.apply(this, arguments);
        };
        const ev = HTMLElement.prototype.dispatchEvent;
        HTMLAnchorElement.prototype.dispatchEvent = function (evt) {
          try {
            const e = (window.__dpPdf || []).find((x) => x.url && x.url === this.href);
            if (e && evt && evt.type === 'click') { e.name = this.download || e.name; return true; }
          } catch (x) {}
          return ev.apply(this, arguments);
        };
      } catch (e) {}
    }, auftrag.token, JSON.stringify(auftrag.sitzung));

    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const m = r.method();
      const u = r.url();
      if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && /\/api\/v1\//.test(u)
          && !SCHREIBEN_ERLAUBT.some((re) => re.test(u))) {
        spur.blockiert.push(m + ' ' + u.replace(/^https?:\/\/[^/]+/, '').slice(0, 120));
        return r.abort('blockedbyclient');
      }
      r.continue();
    });

    /* Der Download: jsPDF -> FileSaver -> <a download>. Chrome legt die
       Datei unter einer GUID ab; der Name kommt aus downloadWillBegin. */
    const cdp = await browser.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior',
      { behavior: 'allowAndName', downloadPath: dlOrdner, eventsEnabled: true });
    const downloads = {};
    let fertigAufloesen;
    const fertig = new Promise((res) => { fertigAufloesen = res; });
    cdp.on('Browser.downloadWillBegin', (e) => { downloads[e.guid] = { name: e.suggestedFilename }; });
    cdp.on('Browser.downloadProgress', (e) => {
      if (e.state === 'completed') fertigAufloesen({ guid: e.guid });
      if (e.state === 'canceled') fertigAufloesen({ guid: e.guid, abgebrochen: true });
    });

    /* ── Marktbericht: eigenes Dokument, eigener Weg ─────────────────────
       Die Marktbericht-App kennt `?report=ID&autopdf=1` (v949, gebaut fuer
       die Deal-Aktion): sie laedt den gespeicherten Bericht und ruft ihre
       eigene exportPdf(). Es wird nichts neu abgerufen und nichts gebucht —
       /reports/one ist ein GET. */
    if (auftrag.art === 'marktbericht') {
      await page.goto(APP_URL + '/marktbericht-app/index.html?report='
        + encodeURIComponent(String(auftrag.report_id)) + '&autopdf=1',
        { waitUntil: 'domcontentloaded', timeout: 45000 });
      schritt('marktbericht geladen');
      const t1 = Date.now();
      while (Date.now() - t1 < 60000) {
        const b = await page.evaluate(() => {
          const e = (window.__dpPdf || []).find((x) => x.b64);
          return e ? { b64: e.b64, name: e.name } : null;
        }).catch(() => null);
        if (b) {
          await new Promise((r) => setTimeout(r, 300));
          const n = await page.evaluate(() => { const e = (window.__dpPdf || []).find((x) => x.b64); return e ? e.name : null; }).catch(() => null);
          const pdf = Buffer.from(b.b64, 'base64');
          if (pdf.slice(0, 5).toString() !== '%PDF-') break;
          schritt('pdf da');
          return { pdf, dateiname: n || b.name || ('Marktbericht_' + auftrag.report_id + '.pdf') };
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      const e = new Error('Die Marktbericht-App hat kein PDF erzeugt.');
      e.status = 422; e.code = 'kein_pdf';
      throw e;
    }

    await page.goto(APP_URL + '/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    schritt('geladen');
    await page.waitForFunction(() => typeof window.loadSaved === 'function'
      && typeof window.exportPDF === 'function' && typeof window.exportPDFBank === 'function'
      && typeof window.jspdf !== 'undefined' && window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn(),
      { timeout: 45000, polling: 250 });
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 20000 }).catch(() => {});
    schritt('app bereit');

    /* Toasts mitschreiben: dort sagt die App, warum sie NICHT druckt
       (Plan-Sperre, fehlender Kaufpreis, Limit erreicht). */
    await page.evaluate(() => {
      window.__dpToasts = [];
      const alt = window.toast;
      window.toast = function (m) { try { window.__dpToasts.push(String(m)); } catch (e) {} return alt && alt.apply(this, arguments); };
      window.alert = function (m) { try { window.__dpToasts.push('alert: ' + String(m)); } catch (e) {} };
    });

    if (art.objekt) {
      await page.evaluate(async (id) => { await window.loadSaved(id); }, String(auftrag.objekt_id));
      await page.waitForFunction((id) => String(window._currentObjKey || '') === id,
        { timeout: 20000, polling: 250 }, String(auftrag.objekt_id));
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 20000 }).catch(() => {});
      await page.evaluate(() => { try { if (typeof window.calcNow === 'function') window.calcNow(); } catch (e) {} });
      schritt('objekt geladen');
    }

    /* Die Bankfassung prueft vorher selbst (pruefeInvestmentDaten, v1505).
       Fehlt etwas, zeigt sie ein Fenster statt zu drucken — wir lesen den
       Befund und geben ihn zurueck, statt auf eine Datei zu warten, die
       nie kommt. */
    if (auftrag.art === 'bank' || auftrag.art === 'bank_kurz') {
      const befund = await page.evaluate(() => window.pruefeInvestmentDaten());
      if (befund && !befund.ok) {
        const e = new Error('Fuer die Bankfassung fehlen Angaben.');
        e.status = 422; e.code = 'luecken'; e.luecken = befund.sperren;
        throw e;
      }
    }

    /* Was die App gerade weiss — fuer die Diagnose, falls nichts kommt. */
    spur.vorher = await page.evaluate(() => ({
      plan: (window.Plan && typeof window.Plan.key === 'function') ? window.Plan.key() : null,
      kp: (window.State && window.State.kpis) ? window.State.kpis.kp : null,
      objekt: window._currentObjKey || null
    })).catch(() => null);
    /* GEMESSEN beim zweiten Lauf: exportPDF() kehrte sofort zurueck, ohne
       jsPDF zu beruehren. pdf-wahl.js (v1636/v2900) UMHUELLT exportPDF und
       exportPDFBank und zeigt erst die Fassungswahl. Wir gehen den Weg, den
       der Dialog nach der Wahl geht (fuehreAus): Hell-Schalter setzen, dann
       mit { ohneRueckfrage: true }. Die Pilot-Vorgabe des Kontos liest die
       App dabei selbst (DealPilotPdfWahl.pilotAn). */
    const aufruf = page.evaluate(async (a) => {
      const hell = (h) => { if (typeof window._dpPdfSetLight === 'function') window._dpPdfSetLight(h); else window._dpPdfLight = h; };
      if (a === 'investment') { hell(true); return window.exportPDF({ ohneRueckfrage: true }); }
      if (a === 'investment_dunkel') { hell(false); return window.exportPDF({ ohneRueckfrage: true }); }
      if (a === 'bank') return window.exportPDFBank({ ohneRueckfrage: true });
      if (a === 'bank_kurz') return window.exportPDFBank({ ohneRueckfrage: true, kurz: true });
      if (a === 'bankexport') { await window.showBankexportView(); return window.exportGlobalBankPDF(); }
    }, auftrag.art).catch((e) => { spur.konsole.push('aufruf: ' + String(e && e.message).slice(0, 240)); });

    /* Entweder kommt die Datei, oder der Aufruf endet ohne Datei (dann
       hat die App etwas gesagt — Toast). 15 s Nachlauf fuer den Download. */
    let stop = false;
    const blob = (async () => {
      while (!stop) {
        const b = await page.evaluate(() => {
          const e = (window.__dpPdf || []).find((x) => x.b64);
          return e ? { b64: e.b64, name: e.name } : null;
        }).catch(() => null);
        if (b) return { blob: b };
        await new Promise((r) => setTimeout(r, 300));
      }
      return null;
    })();
    const ergebnis = await Promise.race([
      fertig,
      blob,
      aufruf.then(() => new Promise((res) => setTimeout(() => res(null), 15000)))
    ]);
    stop = true;
    spur.saves = await page.evaluate(() => (window.__dpPdf || []).map((x) => ({ name: x.name, groesse: x.groesse, gelesen: !!x.b64 }))).catch(() => null);
    spur.toasts = await page.evaluate(() => window.__dpToasts || []).catch(() => []);
    /* Ein offenes Fenster (Limit, Preise, Luecken) sagt, warum nichts kam. */
    spur.fenster = await page.evaluate(() => Array.prototype.slice.call(
      document.querySelectorAll('#limit-modal, #pricing-modal, .global-view-overlay, [id$="-modal"]'))
      .filter((e) => e.offsetParent !== null || getComputedStyle(e).display !== 'none')
      .map((e) => (e.id || e.className) + ': ' + String(e.innerText || '').replace(/\s+/g, ' ').slice(0, 160))
      .slice(0, 5)).catch(() => []);
    schritt('aufruf zurueck');
    if (!ergebnis || ergebnis.abgebrochen) {
      const e = new Error('Die App hat kein PDF erzeugt.');
      e.status = 422; e.code = 'kein_pdf';
      throw e;
    }
    let pdf, name0 = null;
    if (ergebnis.blob) {
      /* Den Namen setzt FileSaver erst beim Klick — kurz nachfassen. */
      await new Promise((r) => setTimeout(r, 300));
      name0 = await page.evaluate(() => { const e = (window.__dpPdf || []).find((x) => x.b64); return e ? e.name : null; }).catch(() => null);
      pdf = Buffer.from(ergebnis.blob.b64, 'base64');
    } else {
      pdf = fs.readFileSync(path.join(dlOrdner, ergebnis.guid));
      name0 = downloads[ergebnis.guid] && downloads[ergebnis.guid].name;
    }
    if (pdf.slice(0, 5).toString() !== '%PDF-') {
      const e = new Error('Die heruntergeladene Datei ist kein PDF.'); e.status = 500; e.code = 'kein_pdf';
      throw e;
    }
    return { pdf, dateiname: name0 || (auftrag.art + '.pdf') };
  })();

  let frist;
  try {
    const r = await Promise.race([lauf, new Promise((_, rej) => {
      frist = setTimeout(() => { const e = new Error('Frist von ' + FRIST_MS + ' ms ueberschritten.'); e.status = 504; e.code = 'frist'; rej(e); }, FRIST_MS);
    })]);
    r.ms = Date.now() - t0;
    r.speicherMaxMb = spur.speicherMaxMb;
    r.spur = spur;
    return r;
  } catch (e) {
    e.spur = spur; e.ms = Date.now() - t0;
    throw e;
  } finally {
    clearTimeout(frist);
    clearInterval(messer);
    if (browser) {
      const proc = browser.process();
      await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
      try { if (proc && proc.exitCode == null) proc.kill('SIGKILL'); } catch (e) {}
    }
    lauf.catch(() => {});
    try { fs.rmSync(ordner, { recursive: true, force: true }); } catch (e) {}
  }
}

/* ── HTTP ─────────────────────────────────────────────────────────────── */
function json(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length });
  res.end(b);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/gesund') {
    return json(res, 200, { ok: true, laufend, wartend: schlange.length, gleichzeitig: GLEICHZEITIG,
      app: APP_URL, zaehler, container_mb: containerMb() });
  }
  if (req.method !== 'POST' || req.url !== '/pdf') return json(res, 404, { fehler: 'unbekannt' });
  if (!GEHEIM || req.headers['x-pdf-geheimnis'] !== GEHEIM) return json(res, 401, { fehler: 'nicht berechtigt' });
  let roh = '';
  req.on('data', (c) => { roh += c; if (roh.length > 20000) req.destroy(); });
  req.on('end', async () => {
    let a;
    try { a = JSON.parse(roh || '{}'); } catch (e) { return json(res, 400, { fehler: 'kein JSON' }); }
    if (!ARTEN[a.art]) return json(res, 400, { fehler: 'unbekannte Art', arten: Object.keys(ARTEN) });
    if (!a.token || !a.sitzung) return json(res, 400, { fehler: 'token und sitzung fehlen' });
    if (ARTEN[a.art].objekt && !/^[0-9a-f-]{8,64}$/i.test(String(a.objekt_id || ''))) {
      return json(res, 400, { fehler: 'objekt_id fehlt' });
    }
    if (ARTEN[a.art].bericht && !/^\d{1,12}$/.test(String(a.report_id || ''))) {
      return json(res, 400, { fehler: 'report_id fehlt' });
    }
    if (!APP_URL) return json(res, 500, { fehler: 'APP_URL nicht gesetzt' });
    zaehler.gesamt++;
    try {
      const r = await einreihen(() => erzeugen(a));
      zaehler.ok++;
      log('ok ' + a.art + ' ' + r.pdf.length + ' B in ' + r.ms + ' ms, Container max ' + r.speicherMaxMb + ' MB'
        + (r.spur.blockiert.length ? ', blockiert: ' + r.spur.blockiert.length : ''));
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': r.pdf.length,
        'X-Dateiname': encodeURIComponent(r.dateiname),
        'X-Dauer-Ms': String(r.ms),
        'X-Speicher-Mb': String(r.speicherMaxMb),
        'X-Blockiert': String(r.spur.blockiert.length)
      });
      res.end(r.pdf);
    } catch (e) {
      zaehler.fehler++;
      log('FEHLER ' + a.art + ': ' + (e.code || '') + ' ' + e.message + ' (' + (e.ms || 0) + ' ms)');
      json(res, e.status || 500, { fehler: e.message, code: e.code || 'fehler', luecken: e.luecken,
        toasts: e.spur && e.spur.toasts, konsole: e.spur && e.spur.konsole.slice(-8),
        blockiert: e.spur && e.spur.blockiert.slice(-8), schritte: e.spur && e.spur.schritte, ms: e.ms,
        vorher: e.spur && e.spur.vorher, fenster: e.spur && e.spur.fenster, saves: e.spur && e.spur.saves });
    }
  });
});

server.listen(PORT, () => log('bereit auf ' + PORT + ', App ' + APP_URL + ', gleichzeitig ' + GLEICHZEITIG));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
