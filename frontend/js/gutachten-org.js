/* ════════════════════════════════════════════════════════════════════
   v1447 · RND-GUTACHTEN DIREKT AN GUTACHTEN.ORG
   ════════════════════════════════════════════════════════════════════

   Backlog v22, Punkt 22 — Marcels Entscheidung vom 19.09.2026: „direkt an
   gutachten.org". Bisher ging die Anfrage aus dem RND-Wizard als JSON-Datei
   an den eigenen Server (/rnd-request) und per Mail an Junker Immobilien.

   Gutachten.org nimmt Anfragen oeffentlich auf zwei Wegen an (gemessen am
   19.09.2026 auf gutachten.org/restnutzungsdauergutachten/):
     · kostenlose Ersteinschaetzung  /restnutzungsdauergutachten-ersteinschaetzung/
     · Beauftragung                  /nutzungsdauer-anfrage/
     · E-Mail                        support@gutachten.org
   Eine Partner-Schnittstelle ist nicht oeffentlich beschrieben.

   Deshalb: DealPilot sendet NICHTS selbst an einen Dritten. Der Nutzer sieht
   vor dem Absenden, welche Daten rausgehen (Leitplanke: bewusste
   Bestaetigung), und schickt sie ueber sein eigenes Mailprogramm oder traegt
   sie in das Formular von Gutachten.org ein (Daten liegen in der
   Zwischenablage). Der Status „angefragt" wird am Objekt vermerkt.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ZIEL = 'support@gutachten.org';
  var URL_EINSCH = 'https://www.gutachten.org/restnutzungsdauergutachten-ersteinschaetzung/?attr=dealpilot';
  var URL_AUFTRAG = 'https://www.gutachten.org/nutzungsdauer-anfrage/?attr=dealpilot';

  function el(id) { return document.getElementById(id); }
  function val(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function schluessel() { return 'dp_gutachten_' + (window._currentObjKey || 'ohne'); }
  function statusLesen() { try { return JSON.parse(localStorage.getItem(schluessel()) || 'null'); } catch (e) { return null; } }
  function statusSetzen(weg) {
    var s = { anbieter: 'gutachten.org', status: 'angefragt', weg: weg, datum: new Date().toISOString().slice(0, 10) };
    try { localStorage.setItem(schluessel(), JSON.stringify(s)); } catch (e) {}
    try { if (window._currentObjData) window._currentObjData._gutachten_auftrag = s; } catch (e) {}
    return s;
  }

  /* Die Daten, die rausgehen — aus dem Objekt und dem Wizard-Ergebnis.
     Nichts wird neu gerechnet. */
  function daten(r) {
    var res = (r && r.result) || {}, st = (r && r.state) || {};
    var z = [];
    function zeile(k, v) { if (v !== '' && v != null) z.push([k, String(v)]); }
    zeile('Anschrift', [val('str') + ' ' + val('hnr'), (val('plz') + ' ' + val('ort')).trim()].filter(function (x) { return x.trim(); }).join(', '));
    zeile('Objektart', st.objekt_typ || val('objart'));
    zeile('Baujahr', st.baujahr || val('baujahr'));
    zeile('Wohnfläche (m²)', st.wohnflaeche || val('wfl'));
    zeile('Kaufpreis (€)', val('kp'));
    zeile('Kaufdatum', val('kaufdat'));
    zeile('Gebäudeanteil (%)', val('geb_ant'));
    zeile('Modernisierungspunkte (Anlage 2)', res.mod_punkte != null ? res.mod_punkte : (st.mod_punkte || ''));
    zeile('Gesamtnutzungsdauer (Jahre)', res.gnd);
    zeile('Ermittelte Restnutzungsdauer (Jahre, indikativ)', res.final_rnd);
    zeile('Daraus AfA-Satz (%, indikativ)', res.plausibilitaet && res.plausibilitaet.afa_satz_pct);
    zeile('Derzeitiger AfA-Satz (%)', val('afa_satz'));
    return z;
  }
  function alsText(z) {
    return 'Anfrage Restnutzungsdauergutachten (aus DealPilot)\n\n'
      + z.map(function (p) { return p[0] + ': ' + p[1]; }).join('\n')
      + '\n\nBitte um eine Ersteinschätzung, ob sich ein Restnutzungsdauergutachten lohnt.';
  }

  function schliessen() { var m = el('dp-gorg-modal'); if (m) m.remove(); }

  function anfragen(r) {
    schliessen();
    var z = daten(r), text = alsText(z), alt = statusLesen();
    var m = document.createElement('div');
    m.id = 'dp-gorg-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(42,39,39,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    m.innerHTML =
      '<div style="background:#fff;border-radius:12px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:24px;border:1px solid #E6E0D3;font-family:Inter,sans-serif;color:#2A2727">' +
        '<div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#9a7f33">Restnutzungsdauergutachten</div>' +
        '<h3 style="margin:6px 0 4px;font:600 20px/1.3 \'Space Grotesk\',sans-serif">Anfrage an Gutachten.org</h3>' +
        (alt ? '<div style="margin:6px 0 10px;padding:8px 10px;border-radius:8px;background:#F8F6F1;font-size:12.5px">Bereits angefragt am ' + esc(alt.datum) + ' (' + esc(alt.weg) + ') — Status: <b>' + esc(alt.status) + '</b></div>' : '') +
        '<p style="margin:0 0 12px;font-size:13px;color:#6B6356;line-height:1.5">Diese Daten gehen an Gutachten.org. DealPilot sendet selbst nichts — du schickst sie über dein Mailprogramm oder trägst sie in deren Formular ein.</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
          z.map(function (p) { return '<tr><td style="padding:5px 0;color:#6B6356;border-bottom:1px solid #F0ECE3">' + esc(p[0]) + '</td><td style="padding:5px 0;text-align:right;border-bottom:1px solid #F0ECE3"><b>' + esc(p[1]) + '</b></td></tr>'; }).join('') +
        '</table>' +
        '<label style="display:flex;gap:8px;align-items:flex-start;margin:14px 0 4px;font-size:13px"><input type="checkbox" id="dp-gorg-ok" style="margin-top:2px"> Ich bin einverstanden, dass diese Angaben an Gutachten.org übermittelt werden.</label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
          '<button type="button" id="dp-gorg-mail" class="btn btn-sm" disabled style="background:#2A2727;color:#fff;border:none;padding:9px 14px;border-radius:8px">E-Mail an Gutachten.org</button>' +
          '<button type="button" id="dp-gorg-form" class="btn btn-sm btn-outline" disabled style="padding:9px 14px;border-radius:8px">Kostenlose Ersteinschätzung (Formular)</button>' +
          '<button type="button" id="dp-gorg-zu" class="btn btn-sm btn-outline" style="padding:9px 14px;border-radius:8px;margin-left:auto">Schließen</button>' +
        '</div>' +
        '<p style="margin:10px 0 0;font-size:11.5px;color:#8A8272">Beauftragen kannst du danach direkt bei Gutachten.org (<a href="' + URL_AUFTRAG + '" target="_blank" rel="noopener">Anfrageformular</a>). Die ermittelte Restnutzungsdauer ist indikativ, das Gutachten ist der Nachweis fürs Finanzamt.</p>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (ev) { if (ev.target === m) schliessen(); });
    el('dp-gorg-zu').onclick = schliessen;
    el('dp-gorg-ok').onchange = function () { var an = this.checked; el('dp-gorg-mail').disabled = !an; el('dp-gorg-form').disabled = !an; };
    el('dp-gorg-mail').onclick = function () {
      var s = statusSetzen('E-Mail');
      window.location.href = 'mailto:' + ZIEL + '?subject=' + encodeURIComponent('Anfrage Restnutzungsdauergutachten – ' + (val('ort') || 'Objekt')) + '&body=' + encodeURIComponent(text);
      if (typeof window.toast === 'function') window.toast('✓ E-Mail vorbereitet — Status: ' + s.status);
      schliessen();
    };
    el('dp-gorg-form').onclick = function () {
      try { navigator.clipboard.writeText(text); } catch (e) {}
      var s = statusSetzen('Formular');
      window.open(URL_EINSCH, '_blank', 'noopener');
      if (typeof window.toast === 'function') window.toast('✓ Daten in der Zwischenablage — im Formular einfügen. Status: ' + s.status);
      schliessen();
    };
  }

  window.DpGutachtenOrg = { anfragen: anfragen, status: statusLesen, _daten: daten };
})();
