#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1851 · N4 · DER REITER OBJEKT WIRD NEU GEORDNET — das Umbau-Skript
   ═══════════════════════════════════════════════════════════════════════

   Marcel, 04.10.2026: „Die Vorlage sieht gut aus. dass wäre jetzt sinnvoll
   im Tab Objekt zu integrieren. Natürlich in dem Stil und layout wie es
   aktuell auch im dealpilot ist." Und: „dass wir die Felder dann auch alle
   passend verknüpft haben … dass unser PDF noch passt, dass wir passend
   importieren können, dass alle unsere Exporte vernünftig funktionieren."

   ── DIE REGEL, AN DER ALLES HÄNGT ───────────────────────────────────────
   KEINE FELD-ID ÄNDERT SICH. Dieses Skript schneidet die vorhandenen
   `.f`-Kästen und Steuerelemente AUS und setzt sie an anderer Stelle
   WIEDER EIN. PDF, pdf-import, voice-import, xlsx/docx, Bankexport,
   storage.FIELDS lesen weiter dieselben IDs. Was sich ändert, ist die
   Ordnung — drei Ebenen statt elf Gruppen — und die Ableitung (Gewerke-
   Tabelle, Automatik-Leiste; siehe js/objekt-reiter.js).

   ── ALLES ODER NICHTS ───────────────────────────────────────────────────
   Jeder Anker muss GENAU EINMAL treffen, sonst Abbruch ohne Schreiben.
   Am Ende der Wächter: jede id, die vorher da war, ist nachher genau so
   oft da; neue ids nur aus der Liste; die div-Bilanz ist unverändert.

   Aufruf (einmalig, aus dem Repo-Wurzelverzeichnis):
     node tools/n4-umbau-index.mjs            # schreibt frontend/index.html
     node tools/n4-umbau-index.mjs --probe    # schreibt nur nach /tmp-Pfad
   Doppellauf: der Marker `oe-details` ist dann schon da → „skip".
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';

const PFAD = path.resolve('frontend/index.html');
const PROBE = process.argv.includes('--probe');
let h = fs.readFileSync(PFAD, 'utf8');
const NL = h.includes('\r\n') ? '\r\n' : '\n';
if (h.includes('id="oe-details"')) { console.log('skip: Umbau ist schon drin (oe-details).'); process.exit(0); }

/* ── Mess-Basis für den Wächter ─────────────────────────────────────── */
function idZaehler(s) {
  const m = {}; for (const x of s.matchAll(/\sid="([^"]+)"/g)) m[x[1]] = (m[x[1]] || 0) + 1; return m;
}
const idsVorher = idZaehler(h);
const divBilanzVorher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;

/* ── Helfer ─────────────────────────────────────────────────────────── */
function abbruch(msg) { console.error('ABBRUCH: ' + msg); process.exit(1); }
function einmal(needle, from = 0) {
  const i = h.indexOf(needle, from);
  if (i < 0) abbruch('Anker nicht gefunden: ' + needle.slice(0, 80));
  if (h.indexOf(needle, i + 1) >= 0) abbruch('Anker mehrfach: ' + needle.slice(0, 80));
  return i;
}
/* Ende des <div …> das bei `start` beginnt (inklusive schließendem </div>). */
function divEnde(start) {
  const re = /<div\b|<\/div>/g; re.lastIndex = start + 1;
  let tiefe = 1, m;
  while ((m = re.exec(h))) {
    tiefe += m[0] === '</div>' ? -1 : 1;
    if (tiefe === 0) return m.index + 6;
  }
  abbruch('div ohne Ende ab ' + start);
}
/* Der `.f`-Kasten, der das Element mit dieser id umschließt. */
function fBlock(id) {
  const i = einmal('id="' + id + '"');
  const re = /<div class="f[" ]/g; let start = -1, m;
  while ((m = re.exec(h)) && m.index < i) start = m.index;
  if (start < 0) abbruch('kein .f vor ' + id);
  const end = divEnde(start);
  if (end < i) abbruch('.f endet vor ' + id);
  return { start, end, html: h.slice(start, end) };
}
function cutF(id) { const b = fBlock(id); h = h.slice(0, b.start) + h.slice(b.end); return b.html; }
function cutDivAt(anker) { const s = einmal(anker); const e = divEnde(s); const html = h.slice(s, e); h = h.slice(0, s) + h.slice(e); return html; }
/* Nur das Steuerelement aus einem .f-Block (für die Gewerke-Tabelle). */
function ctrl(html, id) {
  let m = html.match(new RegExp('<select[^>]*id="' + id + '"[^>]*>[\\s\\S]*?<\\/select>'));
  if (!m) m = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
  if (!m) abbruch('kein Steuerelement ' + id);
  return m[0];
}
function tipOf(html) { const m = html.match(/<button type="button" class="dp-tip"[^>]*><\/button>/); return m ? m[0] : ''; }
function cutCtrl(id) { const html = cutF(id); return { ctrl: ctrl(html, id), tip: tipOf(html) }; }
function insertBefore(anker, html) { const i = einmal(anker); h = h.slice(0, i) + html + h.slice(i); }
function insertAfterBlock(id, html) { const b = fBlock(id); h = h.slice(0, b.end) + html + h.slice(b.end); }
function replaceOnce(a, b) { einmal(a); h = h.replace(a, b); }

/* ═══ 1 · EBENE 1 — Objektdaten bekommt, was der Bericht rechnet ═══════ */
const bNutzung = cutF('nutzungsart');
const bZimmer = cutF('zimmer');
const bEtage = cutF('etage');
const bEtagen = cutF('etagen_ges');
const bEinheiten = cutF('einheiten');
const bZustand = cutF('ds2_zustand');
const bStandard = cutF('standardstufe');
const bEnergie = cutF('ds2_energie');
const bVerm = cutF('vermstand');
const bGsfl = cutF('gsfl');
const bMea = cutF('mea');
const bExit = cutF('exitstr');
insertBefore('<div class="f"><label class="dp-required" data-v236-required-set="1">Wohnfläche (m²)', bNutzung + NL + '      ');
insertAfterBlock('wfl', NL + '      ' + bZimmer);
insertBefore('<div class="f"><label>Kürzel ', [bEtage, bEtagen, bEinheiten, bZustand, bStandard, bEnergie, bVerm, bGsfl, bMea].join(NL + '      ') + NL + '      ');
insertAfterBlock('risiken', NL + '      ' + bExit);

/* ═══ 2 · „Weitere Objektdetails" wird eine eigene Karte (Ebene 2) ═════ */
/* 2a · Gewerke: Steuerelemente aus ihren Kästen lösen */
const eq = {};
for (const id of ['eq_heating', 'eq_windows', 'eq_floor', 'eq_walls', 'eq_roof']) eq[id] = cutCtrl(id);
const mod = {};
for (const id of ['mod_dach', 'mod_fenster', 'mod_leitungen', 'mod_heizung', 'mod_aussenwand', 'mod_baeder', 'mod_innenausbau', 'mod_grundriss']) mod[id] = cutCtrl(id);
const au = {};
for (const id of ['ausst_aussenwaende', 'ausst_dach', 'ausst_fenster', 'ausst_innenwaende', 'ausst_decken', 'ausst_fussboeden', 'ausst_sanitaer', 'ausst_heizung', 'ausst_technik']) au[id] = cutCtrl(id);
/* eq_bath war ein verstecktes Feld ohne Eingabe (gemessen: nichts schreibt es).
   Jetzt ein echtes Auswahlfeld mit den Werten, die ausstattung_stufen.js kennt. */
replaceOnce('<input type="hidden" id="eq_bath">', '');
const selBad = '<select id="eq_bath"><option value="">– keine Angabe –</option><option value="EIN_BAD">Ein Bad</option><option value="INNENLIEGEND">Innenliegend, ohne Fenster</option><option value="MIT_FENSTER">Mit Fenster</option><option value="MEHR_ALS_EIN_BAD">Mehr als ein Bad</option></select>';
/* 2b · Bauteile-Kästen */
const bBauteile = ['eq_elevator', 'eq_guest_wc', 'eq_store_room', 'bad_anz', 'balkon_flae', 'garagen', 'stellpl_aussen', 'modernis'].map(cutF);
const bBaustatus = cutF('baustatus');
const bHinter = ['hinterland_qm', 'hinterland_eur_qm', 'hinterland_rentierlich'].map(cutF);
const bFlur = ['gemarkung', 'flur', 'flurstueck'].map(cutF);
const bUnterlagen = cutDivAt('<div class="f s2" style="display:flex;align-items:flex-end">');
const bErbKopf = cutDivAt('<div class="f s2" style="border-top:1px solid var(--border);padding-top:10px;margin-top:6px">');
const bErbBody = cutDivAt('<div class="f s2" id="erbpacht_body"');
/* 2c · Lage */
const bLage = ['makrolage', 'mikrolage', 'ds2_bevoelkerung', 'ds2_nachfrage', 'ds2_wertsteigerung', 'ds2_entwicklung'].map(cutF);
const bKiLage = cutDivAt('<div class="ki-lage-box ki-lage-box-bottom" id="ki-lage-box">');
const bAnker = ['bankval', 'svwert', 'wert_soll'].map(cutF);
/* 2d · das alte Akkordeon samt Rest (Zwischenüberschrift, Kommentare) raus;
   _dp_herkunft (hidden) kommt zurück in die Objektdaten. */
replaceOnce('<input type="hidden" id="_dp_herkunft">', '');
{
  const s = einmal('<div class="obj-extra-acc" id="obj-extra-toggle"');
  const eMarker = '</div><!-- /obj-extra-wrap -->';
  const e = einmal(eMarker) + eMarker.length;
  h = h.slice(0, s) + '<input type="hidden" id="_dp_herkunft">' + h.slice(e);
}

/* ═══ 3 · Karte „Ausstattungsqualität" wird „Automatisch ermittelt" ════ */
const bBrw = cutF('brw');
const bStichtag = cutF('brw_stichtag');
const bGsAnt = cutF('gs_ant');
const bBodenwert = cutF('bodenwert');
replaceOnce('<svg width="14" height="14"><use href="#i-quality"/></svg></span>Ausstattungsqualität</div>',
            '<svg width="14" height="14"><use href="#i-calculator"/></svg></span>Automatisch ermittelt <span class="oe-ct-hint">Wert · Quelle · Stichtag — kein Eingabefeld</span></div>');
replaceOnce('<div class="f" data-v363-ausst><label>Ausstattung</label>', '<div class="f" data-v363-ausst style="display:none"><label>Ausstattung (Altfeld, ersetzt durch die Standardstufe)</label>');
insertBefore('<div class="f" data-v363-ausst style="display:none">',
  [bBrw, bStichtag, bGsAnt, bBodenwert,
   '<div class="f s2" id="oe-auto-wrap"><div id="oe-auto" class="oe-auto"></div><div id="oe-stufen" class="oe-stufen"></div></div>'].join(NL + '        ') + NL + '        ');
/* Die alte Sterne-Bewertung bleibt im DOM (Altobjekte, StarRating-Init), aber unsichtbar. */
insertBefore('<div class="qz-divider"></div>', '<div id="oe-sterne-alt" style="display:none">');
{
  const a = '<span class="qz-footer-v" id="qz_avg_label">noch keine Bewertung</span>';
  const i = einmal(a);
  const j = h.indexOf('</div>', i) + 6;
  h = h.slice(0, j) + '</div>' + h.slice(j);
}

/* ═══ 4 · Karte 6 (Lage & Markt) fällt, an ihrer Stelle kommt Ebene 2 ══ */
let cardC;
{
  const s = einmal('<!-- V53: Lage- & Markt-Indikatoren');
  const cs = einmal('<div class="card lage-markt-card">');
  const e = divEnde(cs);
  const P = NL + '    ';
  /* Jedes Steuerelement bleibt in einem `.f` mit (unsichtbarem) <label>:
     daran haengen der Konstanten-Extraktor (tools/frontend-konstanten.mjs,
     Beschriftung fuer den Bot) und objektart-felder.js (closest('.f')). */
  const zelle = (ctrlHtml, name, spalte) => ctrlHtml
    ? '<div class="f oe-cell"><label class="oe-sr">' + name + ' · ' + spalte + '</label>' + ctrlHtml + '</div>'
    : '<span class="oe-leer">—</span>';
  const gew = (name, tip, art, jahr, stufe, gewicht) =>
    '<tr><td class="oe-g">' + name + (tip ? ' ' + tip : '') + '</td><td>' + zelle(art, name, 'Art') + '</td><td>'
    + zelle(jahr, name, 'modernisiert') + '</td><td>' + zelle(stufe, name, 'Standardstufe') + '</td><td class="oe-wg">' + gewicht + '</td></tr>';
  cardC = [
    '<!-- ═══ v1851 · N4 · EBENE 2 — Weitere Objektdetails ═══════════════════',
    '     Gewerke-Tabelle (Art · modernisiert · Standardstufe), Bauteile & Grundstück,',
    '     Lage als Einschätzung NEBEN der Datenlage, Wertanker. Alle Feld-IDs sind',
    '     die alten — nur die Ordnung ist neu. Umgebaut von tools/n4-umbau-index.mjs. -->',
    '<div class="card" id="oe-details"><div class="ct ct-pro"><span class="ct-ico"><svg width="14" height="14"><use href="#i-home"/></svg></span>Weitere Objektdetails <span class="oe-ct-hint">verfeinern den Marktbericht</span></div>',
    '  <div class="obj-extra-acc" id="obj-extra-toggle" role="button" tabindex="0" aria-expanded="false"><span class="obj-extra-chev" aria-hidden="true">▸</span><span class="obj-extra-acc-lbl">Gewerke, Bauteile, Grundstück, Lage</span><span class="obj-extra-acc-hint">eine Zeile je Gewerk — die Stufe wird vorgeschlagen</span></div>',
    '  <div id="obj-extra-wrap" class="obj-extra-wrap">',
    '    <div class="card-title">Gewerke · Art, Modernisierung, Standardstufe (Anlage 4 ImmoWertV)</div>',
    '    <table class="oe-gewerke" id="oe-gewerke"><thead><tr><th>Gewerk</th><th>Art / Ausführung</th><th>modernisiert</th><th>Standardstufe</th><th>Gewicht</th></tr></thead><tbody>',
    gew('Außenwände', eq.eq_walls.tip, eq.eq_walls.ctrl, mod.mod_aussenwand.ctrl, au.ausst_aussenwaende.ctrl, '23'),
    gew('Dach', eq.eq_roof.tip, eq.eq_roof.ctrl, mod.mod_dach.ctrl, au.ausst_dach.ctrl, '15'),
    gew('Fenster / Außentüren', eq.eq_windows.tip, eq.eq_windows.ctrl, mod.mod_fenster.ctrl, au.ausst_fenster.ctrl, '11'),
    gew('Heizung', eq.eq_heating.tip, eq.eq_heating.ctrl, mod.mod_heizung.ctrl, au.ausst_heizung.ctrl, '9'),
    gew('Bad / Sanitär', mod.mod_baeder.tip, selBad, mod.mod_baeder.ctrl, au.ausst_sanitaer.ctrl, '9'),
    gew('Fußböden', eq.eq_floor.tip, eq.eq_floor.ctrl, '', au.ausst_fussboeden.ctrl, '5'),
    gew('Innenwände', mod.mod_innenausbau.tip, '', mod.mod_innenausbau.ctrl, au.ausst_innenwaende.ctrl, '11'),
    gew('Decken / Treppen', '', '', '', au.ausst_decken.ctrl, '11'),
    gew('Technik / Leitungen', mod.mod_leitungen.tip, '', mod.mod_leitungen.ctrl, au.ausst_technik.ctrl, '6'),
    gew('Grundriss (Anlage 2)', mod.mod_grundriss.tip, '', mod.mod_grundriss.ctrl, '', '—'),
    '    </tbody></table>',
    '    <p class="hint oe-gew-hint" id="oe-gewerke-hint">Die Stufe je Gewerk wird aus Art und Modernisierung <b>vorgeschlagen</b> (gestrichelt) und lässt sich überschreiben. Aus den Stufen entstehen die Standardstufe oben, die Modernisierungspunkte (Anlage 2) und der Modernisierungsgrad der Restnutzungsdauer — früher die Sterne.</p>',
    '    <div class="card-title">Bauteile &amp; Grundstück</div>',
    '    <div class="g3">',
    '      ' + bBauteile.join(NL + '      '),
    '      ' + bBaustatus,
    '      ' + bFlur.join(NL + '      '),
    '      ' + bUnterlagen,
    '      ' + bHinter.join(NL + '      '),
    '      ' + bErbKopf,
    '      ' + bErbBody,
    '    </div>',
    '    <div class="card-title">Lage — Ihre Einschätzung neben der Datenlage <span class="ds2-tag" title="Investor Deal Score (DS2): Diese Felder fließen in die Bewertung ein. Im Marktbericht stehen sie als Ihre Einschätzung NEBEN der gemessenen Datenlage — getrennt beschriftet.">DS2</span></div>',
    '    <div class="g3">',
    '      ' + bLage.join(NL + '      '),
    '    </div>',
    '    <div id="oe-lage-vergleich" class="oe-lage-vergleich" style="display:none"></div>',
    '    ' + bKiLage,
    '    <div class="card-title">Wertanker</div>',
    '    <div class="g3">',
    '      ' + bAnker.join(NL + '      '),
    '    </div>',
    '  </div><!-- /obj-extra-wrap -->',
    '</div>'
  ].join(P);
  h = h.slice(0, s) + cardC + h.slice(e);
}

/* ═══ 5 · Karte „Grund & Boden" ist leer — sie fällt ═══════════════════ */
cutDivAt('<div class="card"><div class="ct ct-pro"><span class="ct-ico"><svg width="14" height="14"><use href="#i-land"/>');

/* ═══ 6 · Karte „Wertermittlung" wird Ebene 3 „Für das Gutachten" ═════ */
replaceOnce('data-collapse-title="Wertermittlung (Marktbericht)"', 'data-collapse-title="Für das Gutachten · Stufe 3"');
replaceOnce('<use href="#i-calculator"/></svg></span>Wertermittlung (Marktbericht)</div>', '<use href="#i-calculator"/></svg></span>Für das Gutachten · Stufe 3 (Sach- und Ertragswert)</div>');
replaceOnce('<p class="sec-desc" style="margin:0 0 16px">Diese Angaben braucht der Marktbericht für Sachwert- und Ertragswertverfahren. Sie bleiben am Objekt gespeichert und werden bei der Objektwahl im Marktbericht wieder eingesetzt — hier lassen sie sich ansehen und ändern, ohne einen Bericht zu erzeugen. Alles freiwillig: was fehlt, rechnet der Bericht nicht halb, sondern gar nicht.</p>',
  '<p class="sec-desc oe-hint3" style="margin:0 0 16px">Nur für die Wertermittlung nach ImmoWertV (Stufe 3). Die Marktpreisindikation braucht nichts davon. Fehlt hier eine Pflichtangabe, erscheint das Verfahren im Bericht nicht — es rechnet nie halb. Die Überschreibungen der automatisch ermittelten Werte (Zins, Bodenrichtwert, Sachwertfaktor) stehen unten bei den Ansätzen des Sachverständigen — mit Begründung.</p>');
replaceOnce('<div class="card-title">Grundstück, Garage, Außenanlagen</div>', '<div class="card-title">Garage und Außenanlagen</div>');
{
  const t = einmal('<div class="card-title">Ausstattung nach Gewerken · nur Häuser</div>');
  const hr = h.lastIndexOf('<hr class="dvd">', t);
  const g3 = h.indexOf('<div class="g3">', t);
  const e = divEnde(g3);
  h = h.slice(0, hr) + h.slice(e);
}

/* ═══ Wächter ══════════════════════════════════════════════════════════ */
const NEU = new Set(['oe-details', 'oe-gewerke', 'oe-gewerke-hint', 'oe-auto-wrap', 'oe-auto', 'oe-stufen', 'oe-sterne-alt', 'oe-lage-vergleich']);
const idsNachher = idZaehler(h);
const fehler = [];
for (const id of Object.keys(idsVorher)) if (idsVorher[id] !== (idsNachher[id] || 0)) fehler.push(id + ': ' + idsVorher[id] + ' → ' + (idsNachher[id] || 0));
for (const id of Object.keys(idsNachher)) if (!(id in idsVorher) && !NEU.has(id)) fehler.push('unbekannte neue id ' + id);
const divBilanzNachher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
if (divBilanzNachher !== divBilanzVorher) fehler.push('div-Bilanz ' + divBilanzVorher + ' → ' + divBilanzNachher);
if (/undefined|\[object Object\]/.test(h.slice(h.indexOf('id="s0"'), h.indexOf('id="s0"') + 200000)) && !/undefined/.test(fs.readFileSync(PFAD, 'utf8').slice(0, 10))) {
  const i = h.indexOf('undefined', h.indexOf('id="s0"'));
  if (i >= 0 && i < h.indexOf('v235-tab-nav-footer')) fehler.push('„undefined" im Reiter bei ' + i);
}
if (fehler.length) { console.error('WÄCHTER ROT:\n  ' + fehler.join('\n  ')); process.exit(1); }

const ziel = PROBE ? path.resolve('tools/.n4-probe-index.html') : PFAD;
fs.writeFileSync(ziel, h, 'utf8');
console.log((PROBE ? 'PROBE geschrieben: ' : 'GESCHRIEBEN: ') + ziel);
console.log('  ids vorher ' + Object.keys(idsVorher).length + ', nachher ' + Object.keys(idsNachher).length + ' (+' + NEU.size + ' neue) · div-Bilanz ' + divBilanzNachher + ' · Zeilenende ' + (NL === '\r\n' ? 'CRLF' : 'LF'));
