/* ═══ v3215 · W-17 · LISTE „WEITERE DARLEHEN" IM REITER FINANZIERUNG ═════════
 *
 * Nur die Bedienung. Gerechnet wird ausschliesslich im Kern
 * js/darlehen-weitere.js (DpDarlehenWeitere) - hier steht keine Formel ausser
 * der Anzeige der Monatsrate, und auch die kommt aus dem Kern (rateM).
 *
 * Gespeichert im versteckten Feld #darlehen_weitere (JSON, storage.js FIELDS
 * und Leerliste von loadData). Muster: js/sonderumlage.js (v3092).
 * calc.js ruft window._dwUiSync() bei jedem Rechenlauf - gezeichnet wird nur
 * neu, wenn sich der Feldwert von aussen geaendert hat (Laden, Reset), damit
 * Eingaben in der Liste den Fokus behalten.
 * ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FELD = 'darlehen_weitere';
  var _gerendert = null;

  function el(id) { return document.getElementById(id); }
  function K() { return window.DpDarlehenWeitere || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(n, d) { return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) + ' €'; }
  function zahlText(n) { return (n == null || n === '') ? '' : String(n).replace('.', ','); }

  /* Rohliste aus dem Feld - auch Eintraege ohne Betrag (die stehen gerade in Arbeit) */
  function roh() {
    var f = el(FELD); if (!f || !f.value) return [];
    try { var l = JSON.parse(f.value); return Array.isArray(l) ? l.filter(function (x) { return x && typeof x === 'object'; }) : []; } catch (e) { return []; }
  }
  function speichern(l, neuZeichnen) {
    var f = el(FELD); if (!f) return;
    f.value = l.length ? JSON.stringify(l) : '';
    if (!neuZeichnen) _gerendert = f.value;
    try { f.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}   /* storage.js: als geändert markieren */
    if (typeof window.calc === 'function') { try { window.calc(); } catch (e) {} }
    else render();
  }

  function rateZeile(e, i) {
    var k = K(); if (!k) return '';
    var n = k.lesen([e])[0];
    if (!n) return 'Betrag eintragen, dann rechnet das Darlehen mit.';
    var r = k.rateM(n);
    var aus = n.art === 'tilgungsaussetzung';
    /* v3256 · Wortwahl bei Tilgungsaussetzung: Zinsen, keine Tilgung, Restschuld bleibt */
    var t = aus ? 'Zinsen ' + eur(r, 2) + ' / Monat · Tilgung ausgesetzt' : 'Rate ' + eur(r, 2) + ' / Monat';
    var by = (window.State && State.dw_basisjahr) || null;
    if (n.start_jahr && !k.abKauf(n, by)) t += ' · ab ' + n.start_jahr + ' (nicht in Darlehenssumme und LTV beim Kauf)';
    if (aus) {
      t += ' · Restschuld bleibt ' + eur(n.betrag, 0) + ' (Ablösung über Tilgungsträger, z. B. Bausparvertrag oder Versicherung)';
    } else {
      var rs = k.restBindungsende(n);
      t += ' · Restschuld nach ' + (n.bindj || 10) + ' J. ' + eur(rs, 0);
    }
    return t;
  }

  function render() {
    var host = el('dw-box'); if (!host) return;
    var f = el(FELD), stand = f ? f.value : '';
    var l = roh();
    if (stand !== _gerendert) {
      _gerendert = stand;
      var h = l.map(function (e, i) {
        var id = 'dw-' + i + '-', aus = e.art === 'tilgungsaussetzung';
        return '<div class="dw-eintrag" data-i="' + i + '" style="border-top:1px solid var(--line,rgba(42,39,39,.12));padding:10px 0">'
          + '<div class="g2">'
          + '<div class="f"><label>Bezeichnung</label><input id="' + id + 'bez" data-dw="bez" type="text" placeholder="Darlehen ' + (['III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] || (i + 3)) + ' · z. B. KfW 261" value="' + esc(e.bez) + '"></div>'
          + '<div class="f"><label>Art des Darlehens</label><select id="' + id + 'art" data-dw="art">'
          + '<option value="annuitaet"' + (!aus ? ' selected' : '') + '>Annuitätendarlehen</option>'
          + '<option value="tilgungsaussetzung"' + (aus ? ' selected' : '') + '>Tilgungsaussetzung (nur Zins)</option></select></div>'
          + '</div>'
          + '<div class="f"><label>Darlehenssumme</label><div class="iw"><span class="pfx">€</span><input id="' + id + 'betrag" data-dw="betrag" type="text" inputmode="decimal" class="trl" placeholder="0" value="' + esc(e.betrag != null ? Math.round(e.betrag) : '') + '"></div></div>'
          + '<div class="g2">'
          + '<div class="f"><label>Zinssatz nominal (%)</label><div class="iw"><input id="' + id + 'zins" data-dw="zins" type="text" inputmode="decimal" class="tr" value="' + esc(zahlText(e.zins)) + '"><span class="sfx">%</span></div></div>'
          /* v3256 · bei Tilgungsaussetzung kein Tilgungsfeld mit 0 %, sondern „ausgesetzt" */
          + (aus
            ? '<div class="f"><label>Tilgung</label><div class="cf" id="' + id + 'tilg-aus" title="Tilgungsaussetzung: während der Laufzeit nur Zinsen, die Restschuld wird am Ende über einen Tilgungsträger abgelöst">ausgesetzt · nur Zinsen</div></div>'
            : '<div class="f"><label>Tilgung (%)</label><div class="iw"><input id="' + id + 'tilg" data-dw="tilg" type="text" inputmode="decimal" class="tr" value="' + esc(zahlText(e.tilg)) + '"><span class="sfx">%</span></div></div>')
          + '</div>'
          + '<div class="g2">'
          + '<div class="f"><label>Zinsbindung (Jahre)</label><div class="iw"><input id="' + id + 'bindj" data-dw="bindj" type="text" inputmode="numeric" class="tr" value="' + esc(e.bindj != null ? e.bindj : '') + '"><span class="sfx">J.</span></div></div>'
          + '<div class="f"><label>Start-Jahr <span style="color:var(--muted);font-weight:400">· optional</span></label><input id="' + id + 'start_jahr" data-dw="start_jahr" data-zf-aus="1" type="text" inputmode="numeric" placeholder="mit dem Kauf" value="' + esc(e.start_jahr || '') + '"></div>'
          + '</div>'
          + '<div class="hint dw-rate" style="display:block;margin-top:2px"></div>'
          /* v3256 · Marcel 09.11.2026: dieselben Werkzeuge wie Darlehen I - Plan ansehen
             (financing.js openTilgungsplanModal(i), gerechnet im Kern) und Bank-PDF
             (financing.js triggerPdfImportTo('dw:i'), Leser financing-pdf.js) */
          + '<div class="dw-werkzeuge" style="display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:6px">'
          + '<button type="button" class="btn-ghost btn-sm" data-dw-plan="' + i + '">' + (aus ? 'Zinsplan' : 'Tilgungsplan') + ' ansehen</button>'
          + '<button type="button" class="btn-ghost btn-sm" data-dw-pdf="' + i + '" title="Darlehensvertrag einlesen — die erkannten Werte prüfst du vor dem Übernehmen">Daten aus Bank-PDF importieren</button>'
          + '<button type="button" class="btn btn-sm dw-btn" data-dw-weg="' + i + '">Entfernen</button>'
          + '</div>'
          + '</div>';
      }).join('');
      host.innerHTML = (l.length ? h : '<div class="hint" style="display:block">Kein weiteres Darlehen erfasst.</div>')
        + '<button type="button" class="btn btn-sm dw-btn" data-dw-neu="1" style="margin-top:8px">+ Weiteres Darlehen</button>';
    }
    [].forEach.call(host.querySelectorAll('.dw-eintrag'), function (box) {
      var i = +box.getAttribute('data-i'), e = l[i]; if (!e) return;
      var r = box.querySelector('.dw-rate'); if (r) r.textContent = rateZeile(e, i);
    });
  }

  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || !t.getAttribute('data-dw')) return;
    var box = t.closest('.dw-eintrag'); if (!box) return;
    var l = roh(), e = l[+box.getAttribute('data-i')]; if (!e) return;
    var k = t.getAttribute('data-dw'), v = String(t.value || '').trim();
    var zahl = K() ? K().zahl : function (x) { var n = parseFloat(String(x).replace(',', '.')); return isFinite(n) ? n : null; };
    if (k === 'bez') e.bez = v;
    else if (k === 'art') { e.art = v === 'tilgungsaussetzung' ? 'tilgungsaussetzung' : 'annuitaet'; if (e.art === 'tilgungsaussetzung') e.tilg = 0; }
    else e[k] = zahl(v);
    speichern(l, k === 'art');   /* die Art schaltet das Tilgungsfeld → neu zeichnen */
  });
  /* die Art (select) feuert auch change - in manchen Browsern ohne input */
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || t.getAttribute('data-dw') !== 'art') return;
    var box = t.closest('.dw-eintrag'); if (!box) return;
    var l = roh(), e = l[+box.getAttribute('data-i')]; if (!e) return;
    var neu = t.value === 'tilgungsaussetzung' ? 'tilgungsaussetzung' : 'annuitaet';
    if (e.art === neu) return;
    e.art = neu; if (neu === 'tilgungsaussetzung') e.tilg = 0;
    speichern(l, true);
  });
  document.addEventListener('click', function (ev) {
    /* v3256 · Plan und Bank-PDF je Eintrag */
    var w = ev.target && ev.target.closest ? ev.target.closest('[data-dw-plan],[data-dw-pdf]') : null;
    if (w) {
      if (w.hasAttribute('data-dw-plan')) {
        if (typeof window.openTilgungsplanModal === 'function') window.openTilgungsplanModal(+w.getAttribute('data-dw-plan'));
      } else if (typeof window.triggerPdfImportTo === 'function') {
        window.triggerPdfImportTo('dw:' + (+w.getAttribute('data-dw-pdf')));
      }
      return;
    }
    var t = ev.target && ev.target.closest ? ev.target.closest('.dw-btn') : null; if (!t) return;
    var l = roh();
    if (t.hasAttribute('data-dw-neu')) {
      l.push({ bez: '', betrag: null, zins: 3.5, tilg: 2, art: 'annuitaet', bindj: 10, start_jahr: null });
      speichern(l, true); return;
    }
    if (t.hasAttribute('data-dw-weg')) {
      var i = +t.getAttribute('data-dw-weg'); if (l[i]) { l.splice(i, 1); speichern(l, true); } return;
    }
  });

  /* v3256 · Werte aus dem Bank-PDF (financing-pdf.js applyFinPdfValues) in Eintrag i.
     w: { betrag, zins, tilg, bindj, art, bez } als Text aus dem Prüfdialog; leere
     Felder lassen den Eintrag unverändert, die Bezeichnung nur, wenn noch keine da ist. */
  function uebernehmen(i, w) {
    var l = roh(), e = l[i]; if (!e || !w) return false;
    var zahl = K() ? K().zahl : function (x) { var n = parseFloat(String(x).replace(',', '.')); return isFinite(n) ? n : null; };
    ['betrag', 'zins', 'tilg', 'bindj'].forEach(function (k) {
      if (w[k] == null || String(w[k]).trim() === '') return;
      var n = zahl(w[k]); if (n != null && n >= 0) e[k] = n;
    });
    if (w.art) e.art = String(w.art).trim() === 'tilgungsaussetzung' ? 'tilgungsaussetzung' : 'annuitaet';
    /* Vertrag nennt eine Tilgung > 0 und keine Aussetzung: es ist ein Annuitätendarlehen
       (gemessen: sonst setzte ein Eintrag mit Aussetzung die gelesene Tilgung still auf 0) */
    else if (zahl(w.tilg) > 0) e.art = 'annuitaet';
    if (e.art === 'tilgungsaussetzung') e.tilg = 0;
    if (w.bez && !String(e.bez || '').trim()) e.bez = String(w.bez).trim().slice(0, 60);
    speichern(l, true);
    return true;
  }

  window._dwUiSync = render;
  window.DpDarlehenWeitereUi = { render: render, roh: roh, uebernehmen: uebernehmen };
  if (document.readyState !== 'loading') render();
  else document.addEventListener('DOMContentLoaded', render);
})();
