/* ════════════════════════════════════════════════════════════════════════
   paket-import.js · v3202 · Portfolio / Paket aus mehreren Objekten
   ────────────────────────────────────────────────────────────────────────
   Marcel 07.11.2026 (Harburg-Portfolio: 7 Mehrfamilienhäuser, Share Deal):
   „können wir ein Mehrfamilienhaus-Komplex mit mehreren Mehrfamilienhäusern
   rechnen … und beim Speichern als einzelne darstellen?"

   Ablauf:
   1. Der Import (object-actions.js) erkennt ein Exposé, das mehrere Objekte
      einzeln bepreist (erkennen()), und bietet „Als Paket anlegen" an.
   2. starten(text) liest das Exposé über /ai/extract-paket aus: je Objekt
      Anschrift, Kaufpreis, Eckdaten und die Einheiten der Mieterliste.
   3. Im Fenster werden die Objekte gezeigt (abwählbar) und nacheinander als
      EIGENE Objekte angelegt - verbunden über paket_id/paket_name/paket_nr.
   4. Im Reiter Objekt zeigt ein Hinweis „Teil des Pakets …" mit Übersicht
      (Summen über alle Objekte des Pakets).

   Gespeichert wird jedes Objekt mit dem EINEN finalen Save (wie der
   Quick-Check, _qcTakeover/_qcFinal), damit keine leeren Karten entstehen.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var FELDER = ['paket_id', 'paket_name', 'paket_nr', 'paket_anzahl', 'paket_kp_gesamt', 'paket_share_deal'];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(n) { return n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function zahlDe(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  /* Ein Exposé bietet mehrere Objekte an, wenn mindestens zwei Kaufpreise einzeln genannt sind
     und das Exposé von Portfolio, Paket oder mehreren Objekten spricht. Bewusst streng: im
     Zweifel bleibt es beim normalen Import. */
  function erkennen(text) {
    var t = String(text || '');
    var kp = t.match(/Kaufpreis\s*[:\s]\s*(?:EUR\s*|€\s*)?\d{1,3}(?:\.\d{3}){1,3}/gi) || [];
    var wort = /(Portfolio|Paket|Share[- ]?Deal|\b\d+\s+(?:Objekte|Mehrfamilienh(?:ä|ae)user|Immobilien)\b)/i.test(t);
    var n = kp.length;
    var m = t.match(/\b(\d{1,2})\s+(?:Objekte|Mehrfamilienh(?:ä|ae)user)\b/i);
    if (m) n = Math.max(2, parseInt(m[1], 10));
    return (kp.length >= 3 && wort) ? n : 0;
  }

  /* ── Fenster ─────────────────────────────────────────────────────────── */
  var CSS = '#dp-paket-ov{position:fixed;inset:0;z-index:10050;background:rgba(10,10,10,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '#dp-paket-ov .pk{background:#FDFCFA;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:12px;width:min(820px,100%);max-height:90vh;display:flex;flex-direction:column;font:13px Inter,system-ui,sans-serif;color:#2A2727}'
    + '#dp-paket-ov .pk-h{padding:16px 18px;border-bottom:1px solid #E7E2DC}#dp-paket-ov .pk-h b{font-size:16px}'
    + '#dp-paket-ov .pk-b{padding:12px 18px;overflow:auto}#dp-paket-ov table{width:100%;border-collapse:collapse}'
    + '#dp-paket-ov th,#dp-paket-ov td{padding:6px 8px;border-bottom:1px solid #EFEAE2;text-align:left;font-size:12.5px}#dp-paket-ov td.r,#dp-paket-ov th.r{text-align:right}'
    + '#dp-paket-ov .pk-f{padding:12px 18px;border-top:1px solid #E7E2DC;display:flex;gap:8px;justify-content:flex-end;align-items:center}'
    + '#dp-paket-ov .pk-hint{font-size:12px;color:#625c59;margin:8px 0 0}'
    + '#dp-paket-ov button{font:600 13px Inter,sans-serif;border-radius:8px;padding:9px 16px;cursor:pointer;border:1px solid #D9D2BF;background:#fff}'
    + '#dp-paket-ov button.p{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));border:0;color:#161310}'
    + '#dp-paket-box{margin:0 0 12px;padding:10px 14px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-left:3px solid var(--wl-c9a84c,#C9A84C);background:#FBF6E9;border-radius:2px;font:12.5px Inter,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    + '#dp-paket-box button{font:600 12px Inter,sans-serif;border:1px solid #D9D2BF;background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer}';
  function css() { if (el('dp-paket-css')) return; var s = document.createElement('style'); s.id = 'dp-paket-css'; s.textContent = CSS; document.head.appendChild(s); }
  function fenster(html) {
    css(); var alt = el('dp-paket-ov'); if (alt) alt.remove();
    var ov = document.createElement('div'); ov.id = 'dp-paket-ov'; ov.innerHTML = '<div class="pk">' + html + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov); return ov;
  }

  async function starten(text) {
    var ov = fenster('<div class="pk-h"><b>Paket auslesen</b></div><div class="pk-b"><p>Das Exposé wird Objekt für Objekt gelesen (Anschrift, Kaufpreis, Eckdaten, Mieterliste). Das dauert bei großen Exposés bis zu zwei Minuten …</p></div>');
    var r;
    try { r = await Auth.apiCall('/ai/extract-paket', { method: 'POST', timeout: 240000, body: { text: String(text || '') } }); }
    catch (e) { r = { success: false, error: (e && e.message) || 'Dienst nicht erreichbar' }; }
    if (!r || !r.success || !r.objekte || !r.objekte.length) {
      ov.querySelector('.pk-b').innerHTML = '<p>Das Paket konnte nicht ausgelesen werden: ' + esc((r && r.error) || 'keine Objekte gefunden') + '</p>';
      return;
    }
    zeigen(r);
  }

  function zeigen(r) {
    var P = r.paket || {}, O = r.objekte;
    var summe = O.reduce(function (a, o) { return a + (o.kaufpreis || 0); }, 0);
    var miete = O.reduce(function (a, o) { return a + mieteJahr(o); }, 0);
    var we = O.reduce(function (a, o) { return a + (o.wohneinheiten || o.einheiten.filter(function (e) { return e.art !== 'gewerbe'; }).length || 0); }, 0);
    var html = '<div class="pk-h"><b>' + esc(P.name || 'Paket') + '</b><div style="margin-top:4px;color:#625c59">' + O.length + ' Objekte · ' + we + ' Wohnungen · Kaufpreise zusammen ' + eur(summe)
      + (P.gesamtkaufpreis && Math.abs(P.gesamtkaufpreis - summe) > 1000 ? ' (Exposé nennt ' + eur(P.gesamtkaufpreis) + ')' : '') + ' · Miete ' + eur(miete) + ' p. a.</div></div>'
      + '<div class="pk-b"><label style="display:block;margin-bottom:8px">Paketname <input id="pk-name" value="' + esc(P.name || '') + '" style="width:60%;padding:6px 8px;border:1px solid #E0DBD3;border-radius:2px"></label>'
      + '<table><thead><tr><th></th><th>Objekt</th><th class="r">Kaufpreis</th><th class="r">Fläche</th><th class="r">Einheiten</th><th class="r">Miete p. a.</th><th class="r">Faktor</th></tr></thead><tbody>'
      + O.map(function (o, i) {
          var mj = mieteJahr(o);
          return '<tr><td><input type="checkbox" data-pk="' + i + '" checked></td><td>' + esc([o.strasse, o.hausnummer].filter(Boolean).join(' ')) + '<div style="color:#8A8272;font-size:11.5px">' + esc([o.plz, o.ort].filter(Boolean).join(' ')) + (o.baujahr ? ' · Bj ' + o.baujahr : '') + '</div></td>'
            + '<td class="r">' + eur(o.kaufpreis) + '</td><td class="r">' + (o.wohnflaeche ? Math.round(o.wohnflaeche) + ' m²' : '—') + '</td>'
            + '<td class="r">' + o.einheiten.length + '</td><td class="r">' + eur(mj) + '</td><td class="r">' + (mj > 0 && o.kaufpreis ? (o.kaufpreis / mj).toFixed(1).replace('.', ',') : '—') + '</td></tr>';
        }).join('') + '</tbody></table>'
      + (P.share_deal ? '<p class="pk-hint"><b>Share Deal:</b> Gekauft werden Gesellschaftsanteile, nicht die Grundstücke. Ob und wie viel Grunderwerbsteuer anfällt, hängt an der erworbenen Beteiligung (§ 1 Abs. 2a, 2b und 3 GrEStG) — die Grunderwerbsteuer in jedem Objekt bitte im Reiter Investition prüfen.</p>' : '')
      + '<p class="pk-hint">Jedes Objekt wird als eigenes Objekt angelegt, mit seinen Einheiten aus der Mieterliste, und trägt den Paketnamen. Im Reiter Objekt siehst du die Summen über das ganze Paket.</p></div>'
      + '<div class="pk-f"><span id="pk-stand" style="margin-right:auto;color:#625c59"></span><button type="button" id="pk-ab">Abbrechen</button><button type="button" class="p" id="pk-los">Objekte anlegen</button></div>';
    var ov = fenster(html);
    el('pk-ab').onclick = function () { ov.remove(); };
    el('pk-los').onclick = function () {
      var wahl = [].slice.call(ov.querySelectorAll('[data-pk]')).filter(function (c) { return c.checked; }).map(function (c) { return O[parseInt(c.getAttribute('data-pk'), 10)]; });
      if (!wahl.length) return;
      anlegen(wahl, { name: (el('pk-name').value || P.name || 'Paket').trim(), share_deal: !!P.share_deal, gesamt: summe, anzahl: O.length }, ov);
    };
  }

  function mieteJahr(o) {
    var s = (o.einheiten || []).reduce(function (a, e) { return a + (e.status === 'leer' ? 0 : (e.miete_monat || 0)); }, 0) * 12;
    return s > 0 ? s : (o.miete_ist_jahr || o.miete_soll_jahr || 0);
  }
  function setze(id, v) {
    var e = el(id); if (!e || v == null || v === '') return;
    e.value = String(v);
    try { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {}
  }

  async function anlegen(wahl, paket, ov) {
    var los = el('pk-los'), stand = el('pk-stand'); if (los) los.disabled = true;
    var id = 'pk-' + Date.now().toString(36), fertig = 0, fehler = [];
    window._dpPaketLaeuft = true;
    for (var i = 0; i < wahl.length; i++) {
      var o = wahl[i];
      if (stand) stand.textContent = 'Lege Objekt ' + (i + 1) + ' von ' + wahl.length + ' an …';
      window._qcTakeover = true;   /* nur der EINE Save unten - keine leere Karte (storage.js v968) */
      try {
        var r = window.newObj({ ohneAuswahl: true }); if (r && r.then) await r;
        await warte(250);
        setze('str', o.strasse); setze('hnr', o.hausnummer); setze('plz', o.plz); setze('ort', o.ort);
        setze('objart', 'MFH');
        setze('kp', o.kaufpreis); setze('baujahr', o.baujahr);
        setze('wfl', o.wohnflaeche ? String(o.wohnflaeche).replace('.', ',') : null);
        setze('gsfl', o.grundstuecksflaeche);
        setze('einheiten', o.wohneinheiten || o.einheiten.filter(function (e) { return e.art !== 'gewerbe'; }).length || null);
        setze('ds2_energie', o.energieklasse);
        var mj = mieteJahr(o); if (mj > 0) setze('nkm', String(Math.round(mj / 12 * 100) / 100).replace('.', ','));
        if (o.einheiten && o.einheiten.length) {
          window._dpMfh = { einheiten: o.einheiten.map(function (e, k) {
            return { nr: String(k + 1), lage: e.lage || '', art: e.art === 'gewerbe' ? 'gewerbe' : 'wohnen', wfl: e.wfl != null ? String(e.wfl) : '',
              ist: e.status !== 'leer' && e.miete_monat != null ? String(e.miete_monat) : '',
              /* leer: die Miete im Exposé ist eine Zielmiete, keine Ist-Miete */
              soll: e.status === 'leer' && e.miete_monat != null ? String(e.miete_monat) : '', status: e.status === 'leer' ? 'leer' : 'vermietet' };
          }), gebaeude: {}, aufgeteilt: false, stand: new Date().toISOString().slice(0, 10) };
        }
        setze('paket_id', id); setze('paket_name', paket.name); setze('paket_nr', i + 1); setze('paket_anzahl', wahl.length);
        setze('paket_kp_gesamt', Math.round(wahl.reduce(function (a, x) { return a + (x.kaufpreis || 0); }, 0)));
        setze('paket_share_deal', paket.share_deal ? 'ja' : '');
        await window.saveObj({ _qcFinal: true, silent: true });
        if (!window._currentObjKey) throw new Error('nicht gespeichert');
        fertig++;
      } catch (e) {
        fehler.push(([o.strasse, o.hausnummer].filter(Boolean).join(' ') || 'Objekt ' + (i + 1)) + ': ' + ((e && e.message) || 'Fehler'));
      } finally { window._qcTakeover = false; }
      await warte(400);
    }
    window._dpPaketLaeuft = false;
    try { if (typeof window.renderSaved === 'function') window.renderSaved(); } catch (x) {}
    if (stand) stand.textContent = fertig + ' von ' + wahl.length + ' Objekten angelegt' + (fehler.length ? ' · Fehler: ' + fehler.join('; ') : '');
    if (los) { los.textContent = 'Schließen'; los.disabled = false; los.onclick = function () { ov.remove(); }; }
    try { if (typeof window.toast === 'function') window.toast('Paket „' + paket.name + '": ' + fertig + ' Objekte angelegt'); } catch (x) {}
  }

  /* ── Hinweis im Reiter Objekt: Teil eines Pakets, mit Übersicht ─────── */
  var _zuletzt = null;
  function boxPruefen() {
    var id = (el('paket_id') || {}).value || '';
    var key = id + '|' + (window._currentObjKey || '');
    if (key === _zuletzt) return; _zuletzt = key;
    var alt = el('dp-paket-box'); if (alt) alt.remove();
    if (!id) return;
    var ziel = document.querySelector('#s0 .sec-desc'); if (!ziel) return;
    css();
    var b = document.createElement('div'); b.id = 'dp-paket-box';
    b.innerHTML = '<span>Teil des Pakets <b>' + esc((el('paket_name') || {}).value || '') + '</b> · Objekt ' + esc((el('paket_nr') || {}).value || '?') + ' von ' + esc((el('paket_anzahl') || {}).value || '?')
      + ((el('paket_share_deal') || {}).value === 'ja' ? ' · Share Deal' : '') + '</span><button type="button" id="dp-paket-ueb">Paket-Übersicht</button>';
    ziel.parentNode.insertBefore(b, ziel.nextSibling);
    el('dp-paket-ueb').onclick = function () { uebersicht(id); };
  }

  async function uebersicht(id) {
    var ov = fenster('<div class="pk-h"><b>Paket-Übersicht</b></div><div class="pk-b"><p>Lade die Objekte des Pakets …</p></div>');
    var liste = [];
    try {
      var l = await Auth.apiCall('/objects', { method: 'GET' });
      var arr = Array.isArray(l) ? l : (l.items || l.objects || l.data || []);   /* /objects liefert { items, count } */
      var kandidaten = arr.filter(function (o) { return o && o.paket_id === id; });
      for (var i = 0; i < kandidaten.length; i++) {
        var r = await Auth.apiCall('/objects/' + kandidaten[i].id, { method: 'GET' });
        if (r && r.data) liste.push(r);
      }
    } catch (e) { liste = []; }
    if (!liste.length) { ov.querySelector('.pk-b').innerHTML = '<p>Keine Objekte dieses Pakets gefunden.</p>'; return; }
    liste.sort(function (a, b) { return (zahlDe(a.data.paket_nr) || 0) - (zahlDe(b.data.paket_nr) || 0); });
    var S = { kp: 0, wfl: 0, we: 0, nkm: 0 };
    var zeilen = liste.map(function (o) {
      var d = o.data, kp = zahlDe(d.kp) || 0, wfl = zahlDe(d.wfl) || 0, nkm = (zahlDe(d.nkm) || 0) * 12, we = zahlDe(d.einheiten) || 0;
      S.kp += kp; S.wfl += wfl; S.nkm += nkm; S.we += we;
      return '<tr><td>' + esc([d.str, d.hnr].filter(Boolean).join(' ')) + '</td><td class="r">' + eur(kp) + '</td><td class="r">' + (wfl ? Math.round(wfl) + ' m²' : '—') + '</td><td class="r">' + (we || '—') + '</td><td class="r">' + eur(nkm) + '</td><td class="r">'
        + (nkm > 0 && kp ? (kp / nkm).toFixed(1).replace('.', ',') : '—') + '</td><td class="r">' + (kp && nkm ? (nkm / kp * 100).toFixed(2).replace('.', ',') + ' %' : '—') + '</td></tr>';
    }).join('');
    ov.querySelector('.pk-b').innerHTML = '<table><thead><tr><th>Objekt</th><th class="r">Kaufpreis</th><th class="r">Fläche</th><th class="r">WE</th><th class="r">Miete p. a.</th><th class="r">Faktor</th><th class="r">Bruttorendite</th></tr></thead><tbody>' + zeilen
      + '<tr style="font-weight:700"><td>Paket gesamt (' + liste.length + ' Objekte)</td><td class="r">' + eur(S.kp) + '</td><td class="r">' + Math.round(S.wfl) + ' m²</td><td class="r">' + S.we + '</td><td class="r">' + eur(S.nkm) + '</td><td class="r">'
      + (S.nkm > 0 ? (S.kp / S.nkm).toFixed(1).replace('.', ',') : '—') + '</td><td class="r">' + (S.kp ? (S.nkm / S.kp * 100).toFixed(2).replace('.', ',') + ' %' : '—') + '</td></tr></tbody></table>'
      + '<p class="pk-hint">Miete = Nettokaltmiete der Objekte × 12 (Ist laut Objekt). Faktor und Bruttorendite ohne Kaufnebenkosten.</p>';
    var f = document.createElement('div'); f.className = 'pk-f'; f.innerHTML = '<button type="button">Schließen</button>'; f.firstChild.onclick = function () { ov.remove(); };
    ov.querySelector('.pk').appendChild(f);
  }

  /* Knopf im Import-Prüffenster (object-actions.js legt den Exposé-Text in window._dpPaketText) */
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest || !e.target.closest('#oabi-paket')) return;
    var t = window._dpPaketText; if (!t) return;
    var ov = el('oabi-ov'); if (ov) ov.remove();
    try { if (document.body.classList.contains('qc-standalone-active') && typeof window.exitQuickCheckMode === 'function') window.exitQuickCheckMode(); } catch (x) {}
    starten(t);
  });
  setInterval(function () { try { boxPruefen(); } catch (e) {} }, 1200);
  window.DpPaket = { erkennen: erkennen, starten: starten, zeigen: zeigen, uebersicht: uebersicht, FELDER: FELDER };
})();
