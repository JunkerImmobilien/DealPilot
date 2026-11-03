/* ══════════════════════════════════════════════════════════════════════
   v3097 · Umsetzungswünsche der Entwicklungspartner

   Marcel 03.11.2026: Der Entwicklungspartner soll Umsetzungswünsche ins Backlog
   geben können, „kannst du ihm dort vlt was in der app bauen?“

   Der Menüpunkt „Umsetzungswünsche“ (System, .sb-act-wuensche) ist versteckt und
   erscheint nur, wenn /wuensche/zugang ok meldet (Zusatz 'entwicklungspartner',
   Admin-Portal). Das Fenster hat oben das Formular und darunter die gemeinsame Liste
   mit Stand, Backlog-Nummer und Antwort. Den Stand kann jeder Partner setzen.
   Claude liest neue Wünsche mit tools/wuensche-holen.mjs.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpWuensche) return;

  var BEREICHE = [['quickcheck', 'Quick-Check'], ['objekt', 'Objekt & Kennzahlen'], ['steuer', 'Steuer'],
    ['finanzierung', 'Finanzierung & Bank'], ['marktbericht', 'Marktbericht & Bewertung'], ['unterlagen', 'Unterlagen & Import'],
    ['admin', 'Admin & Konten'], ['design', 'Optik & Bedienung'], ['sonstiges', 'Sonstiges']];
  var DRINGLICH = [['spaeter', 'Irgendwann'], ['normal', 'Normal'], ['dringend', 'Dringend']];
  var ARTEN = [['fehler', 'Fehler'], ['wunsch', 'Wunsch'], ['idee', 'Idee']];   /* v3110 · Bordbuch */
  var STATUS = [['neu', 'Neu'], ['backlog', 'Im Backlog'], ['arbeit', 'In Arbeit'], ['erledigt', 'Erledigt'], ['abgelehnt', 'Abgelehnt']];
  var name = function (liste, k) { for (var i = 0; i < liste.length; i++) if (liste[i][0] === k) return liste[i][1]; return k; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var datum = function (d) { try { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } };

  function stil() {
    if (document.getElementById('dpw-stil')) return;
    var s = document.createElement('style'); s.id = 'dpw-stil';
    s.textContent = [
      '.dpw-hg{position:fixed;inset:0;background:rgba(5,5,5,.55);z-index:100050;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}',
      '.dpw{background:#FDFCFA;color:#2A2727;border-radius:16px;width:100%;max-width:760px;box-shadow:0 20px 60px rgba(0,0,0,.35);font:400 14px/1.5 Inter,system-ui,sans-serif}',
      '.dpw-kopf{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #EFE7D6}',
      '.dpw-kopf h3{margin:0;font:600 19px "Space Grotesk",sans-serif}',
      '.dpw-kopf p{margin:2px 0 0;font-size:12.5px;color:#7A7370}',
      '.dpw-zu{border:0;background:transparent;font-size:22px;cursor:pointer;color:#7A7370;line-height:1}',
      '.dpw-inhalt{padding:18px 22px 22px;display:flex;flex-direction:column;gap:16px}',
      '.dpw-l{display:block;font:600 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370;margin:0 0 4px}',
      '.dpw input,.dpw textarea,.dpw select{width:100%;box-sizing:border-box;border:1px solid #E3D9C4;border-radius:9px;padding:8px 10px;font:inherit;background:#fff;color:#2A2727}',
      '.dpw textarea{min-height:110px;resize:vertical}',
      '.dpw-reihe{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.dpw-knopf{border:0;border-radius:9px;padding:9px 16px;font:600 13.5px "Space Grotesk",sans-serif;cursor:pointer;background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#050505}',
      '.dpw-knopf[disabled]{opacity:.55;cursor:default}',
      '.dpw-meldung{font-size:12.5px;color:#7A7370;margin-left:10px}',
      '.dpw-meldung.fehler{color:#B8625C}',
      '.dpw-liste{display:flex;flex-direction:column;gap:10px}',
      '.dpw-w{border:1px solid #EFE7D6;border-radius:12px;padding:12px 14px;background:#fff}',
      '.dpw-w-kopf{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}',
      '.dpw-w-kopf b{font:600 15px/1.3 "Space Grotesk",sans-serif}',
      '.dpw-w-meta{font-size:11.5px;color:#7A7370;margin-top:2px}',
      '.dpw-w-text{margin:8px 0 0;white-space:pre-wrap;font-size:13px;color:#4A4542}',
      '.dpw-w-antwort{margin:8px 0 0;padding:8px 10px;border-left:3px solid var(--wl-c9a84c,#C9A84C);background:#FBF6E9;font-size:12.5px;white-space:pre-wrap}',
      '.dpw-pille{white-space:nowrap;font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:20px;background:#F1ECE1;color:#4A4542}',
      '.dpw-pille.neu{background:#FBF6E9;color:var(--wl-b8932f,#b8932f)}.dpw-pille.erledigt{background:#E6F3EB;color:#2E7D50}.dpw-pille.abgelehnt{background:#F6E7E6;color:#B8625C}',
      '.dpw-w-pflege{display:grid;grid-template-columns:150px 110px 1fr auto;gap:8px;margin-top:10px;align-items:center}',
      '.dpw-w-pflege .dpw-knopf{padding:7px 12px;font-size:12.5px}',
      '.dpw-filter{display:flex;gap:6px;flex-wrap:wrap}',
      '.dpw-bilder{margin-top:8px;display:flex;flex-direction:column;gap:8px}',
      '.dpw-bildknopf{align-self:flex-start;border:1px solid #E3D9C4;background:#fff;border-radius:8px;padding:5px 10px;font:500 12.5px Inter,sans-serif;cursor:pointer;color:#2A2727}',
      '.dpw-bilder a{display:block;border:1px solid #E3D9C4;border-radius:8px;overflow:hidden;line-height:0}',
      '.dpw-bilder img{width:100%;height:auto}',
      '.dpw-filter button{border:1px solid #E3D9C4;background:#fff;border-radius:20px;padding:4px 11px;font:500 12px Inter,sans-serif;cursor:pointer;color:#2A2727}',
      '.dpw-filter button.an{background:#2A2727;color:#FDFCFA;border-color:#2A2727}',
      '@media (max-width:600px){.dpw-hg{padding:12px 8px}.dpw-reihe,.dpw-w-pflege{grid-template-columns:1fr}.dpw-kopf,.dpw-inhalt{padding-left:16px;padding-right:16px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var filter = 'offen', daten = [];

  function api(pfad, opt) { return Auth.apiCall('/wuensche' + pfad, opt || {}); }

  function zeichneListe() {
    var host = document.getElementById('dpw-liste'); if (!host) return;
    var sicht = daten.filter(function (w) {
      return filter === 'alle' ? true : filter === 'offen' ? ['neu', 'backlog', 'arbeit'].indexOf(w.status) >= 0 : ['erledigt', 'abgelehnt'].indexOf(w.status) >= 0;
    });
    if (!sicht.length) { host.innerHTML = '<p style="color:#7A7370;font-size:13px;margin:0">Hier ist noch nichts.</p>'; return; }
    host.innerHTML = sicht.map(function (w) {
      var opt = function (liste, wert) { return liste.map(function (e) { return '<option value="' + e[0] + '"' + (e[0] === wert ? ' selected' : '') + '>' + e[1] + '</option>'; }).join(''); };
      return '<div class="dpw-w" data-id="' + w.id + '">'
        + '<div class="dpw-w-kopf"><div><b>W-' + w.id + ' · ' + esc(w.titel) + '</b>'
        + '<div class="dpw-w-meta">' + esc(name(ARTEN, w.art || 'wunsch')) + ' · ' + esc(name(BEREICHE, w.bereich)) + ' · ' + esc(name(DRINGLICH, w.dringlichkeit)) + ' · von ' + esc(w.von || '–') + ' am ' + datum(w.created_at)
        + (w.backlog_nr ? ' · Backlog ' + esc(w.backlog_nr) : '') + '</div></div>'
        + '<span class="dpw-pille ' + esc(w.status) + '">' + esc(name(STATUS, w.status)) + '</span></div>'
        + (w.beschreibung ? '<p class="dpw-w-text">' + esc(w.beschreibung) + '</p>' : '')
        + (w.kontext ? '<div class="dpw-w-meta">' + esc([w.kontext.reiter && ('Reiter „' + w.kontext.reiter + '“'), w.kontext.objekt && ('Objekt ' + w.kontext.objekt), w.kontext.fenster && ('Fenster ' + w.kontext.fenster), w.kontext.version && ('Version ' + w.kontext.version)].filter(Boolean).join(' · ')) + '</div>' : '')
        + (w.bild_anzahl > 0 ? '<div class="dpw-bilder" data-bilder="' + w.id + '"><button type="button" class="dpw-bildknopf" data-akt="bilder">📷 ' + w.bild_anzahl + (w.bild_anzahl === 1 ? ' Bild' : ' Bilder') + ' ansehen</button></div>' : '')
        + (w.antwort ? '<p class="dpw-w-antwort">' + esc(w.antwort) + '</p>' : '')
        + '<div class="dpw-w-pflege"><select data-f="status">' + opt(STATUS, w.status) + '</select>'
        + '<input data-f="backlog_nr" placeholder="Backlog-Nr." value="' + esc(w.backlog_nr || '') + '">'
        + '<input data-f="antwort" placeholder="Antwort / Notiz" value="' + esc(w.antwort || '') + '">'
        + '<button class="dpw-knopf" data-akt="sichern">Sichern</button></div>'
        + '</div>';
    }).join('');
  }

  function laden() {
    return api('').then(function (r) { daten = (r && r.wuensche) || []; zeichneListe(); })
      .catch(function (e) { var h = document.getElementById('dpw-liste'); if (h) h.innerHTML = '<p class="dpw-meldung fehler">Liste nicht geladen: ' + esc(e.message) + '</p>'; });
  }

  function oeffnen() {
    stil();
    var alt = document.getElementById('dpw-hg'); if (alt) alt.remove();
    var hg = document.createElement('div'); hg.className = 'dpw-hg'; hg.id = 'dpw-hg';
    var opts = function (liste, wert) { return liste.map(function (e) { return '<option value="' + e[0] + '"' + (e[0] === wert ? ' selected' : '') + '>' + e[1] + '</option>'; }).join(''); };
    hg.innerHTML = '<div class="dpw" role="dialog" aria-modal="true" aria-labelledby="dpw-titel">'
      + '<div class="dpw-kopf"><div><h3 id="dpw-titel">Bordbuch · Umsetzungswünsche</h3><p>Was soll in DealPilot gebaut oder geändert werden? Neue Einträge landen im Backlog.' + (window.DpBordbuch ? ' <button type="button" class="dpw-bildknopf" data-akt="screenshot" style="margin-left:4px">📷 mit Screenshot eintragen</button>' : '') + (window.DpBordbuch && DpBordbuch.ausgeblendet() ? ' <button type="button" class="dpw-bildknopf" data-akt="mechaniker" style="margin-left:4px">Mechaniker wieder einblenden</button>' : '') + '</p></div>'
      + '<button class="dpw-zu" type="button" aria-label="Schließen">×</button></div>'
      + '<div class="dpw-inhalt">'
      + '<div><label class="dpw-l" for="dpw-t">Titel</label><input id="dpw-t" maxlength="200" placeholder="z. B. Quick-Check: Hausgeld aus dem Exposé übernehmen"></div>'
      + '<div><label class="dpw-l" for="dpw-b">Was genau, und warum?</label><textarea id="dpw-b" maxlength="8000" placeholder="Wo in der App, was passiert heute, was soll passieren. Ein Beispiel hilft."></textarea></div>'
      + '<div class="dpw-reihe"><div><label class="dpw-l" for="dpw-be">Bereich</label><select id="dpw-be">' + opts(BEREICHE, 'sonstiges') + '</select></div>'
      + '<div><label class="dpw-l" for="dpw-d">Dringlichkeit</label><select id="dpw-d">' + opts(DRINGLICH, 'normal') + '</select></div></div>'
      + '<div><button class="dpw-knopf" type="button" id="dpw-senden">Wunsch eintragen</button><span class="dpw-meldung" id="dpw-meldung"></span></div>'
      + '<div style="border-top:1px solid #EFE7D6;padding-top:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'
      + '<span class="dpw-l" style="margin:0">Alle Wünsche</span><div class="dpw-filter">'
      + '<button type="button" data-filter="offen">Offen</button><button type="button" data-filter="fertig">Erledigt / abgelehnt</button><button type="button" data-filter="alle">Alle</button></div></div>'
      + '<div class="dpw-liste" id="dpw-liste"><p style="color:#7A7370;font-size:13px;margin:0">lädt …</p></div>'
      + '</div></div>';
    document.body.appendChild(hg);
    var zu = function () { hg.remove(); document.removeEventListener('keydown', taste); };
    var taste = function (e) { if (e.key === 'Escape') zu(); };
    document.addEventListener('keydown', taste);
    hg.addEventListener('click', function (e) { if (e.target === hg) zu(); });
    hg.querySelector('.dpw-zu').addEventListener('click', zu);
    var sk = hg.querySelector('[data-akt="screenshot"]');
    if (sk) sk.addEventListener('click', function () { zu(); DpBordbuch.start(); });
    var mk = hg.querySelector('[data-akt="mechaniker"]');
    if (mk) mk.addEventListener('click', function () { DpBordbuch.einblenden(); mk.remove(); });
    var setzeFilter = function () { hg.querySelectorAll('[data-filter]').forEach(function (b) { b.classList.toggle('an', b.getAttribute('data-filter') === filter); }); };
    hg.querySelectorAll('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-filter'); setzeFilter(); zeichneListe(); }); });
    setzeFilter();

    hg.querySelector('#dpw-senden').addEventListener('click', function () {
      var knopf = this, m = hg.querySelector('#dpw-meldung');
      var titel = hg.querySelector('#dpw-t').value.trim();
      if (titel.length < 3) { m.className = 'dpw-meldung fehler'; m.textContent = 'Bitte einen Titel eintragen.'; return; }
      knopf.disabled = true; m.className = 'dpw-meldung'; m.textContent = 'wird eingetragen …';
      api('', { method: 'POST', body: { titel: titel, beschreibung: hg.querySelector('#dpw-b').value,
        bereich: hg.querySelector('#dpw-be').value, dringlichkeit: hg.querySelector('#dpw-d').value } })
        .then(function (r) {
          m.textContent = 'Eingetragen als W-' + r.id + '.';
          hg.querySelector('#dpw-t').value = ''; hg.querySelector('#dpw-b').value = '';
          filter = 'offen'; setzeFilter(); return laden();
        })
        .catch(function (e) { m.className = 'dpw-meldung fehler'; m.textContent = 'Nicht eingetragen: ' + e.message; })
        .then(function () { knopf.disabled = false; });
    });

    hg.querySelector('#dpw-liste').addEventListener('click', function (e) {
      /* v3110 · Bilder erst auf Klick laden (die Liste trägt nur die Anzahl) */
      var bk = e.target.closest('[data-akt="bilder"]');
      if (bk) {
        var box = bk.closest('[data-bilder]'), wid = box.getAttribute('data-bilder');
        bk.disabled = true; bk.textContent = 'lädt …';
        api('/' + wid + '/bilder').then(function (r) {
          box.innerHTML = (r.bilder || []).map(function (u, i) {
            return /^data:image\/(jpeg|png|webp);base64,/.test(u) ? '<a href="' + u + '" download="W-' + wid + '-' + (i + 1) + '.jpg" title="Herunterladen"><img alt="Bild ' + (i + 1) + ' zu W-' + wid + '" src="' + u + '"></a>' : '';
          }).join('');
        }).catch(function (err) { bk.disabled = false; bk.textContent = 'Bilder nicht geladen: ' + err.message; });
        return;
      }
      var b = e.target.closest('[data-akt="sichern"]'); if (!b) return;
      var karte = b.closest('.dpw-w'), id = karte.getAttribute('data-id');
      var wert = function (f) { return karte.querySelector('[data-f="' + f + '"]').value; };
      b.disabled = true; b.textContent = '…';
      api('/' + id, { method: 'PATCH', body: { status: wert('status'), backlog_nr: wert('backlog_nr'), antwort: wert('antwort') } })
        .then(laden)
        .catch(function (err) { b.disabled = false; b.title = err.message; b.textContent = 'Fehler – nochmal'; });
    });
    setTimeout(function () { var t = hg.querySelector('#dpw-t'); if (t) t.focus(); }, 30);
    laden();
  }

  /* Menüpunkt nur für freigeschaltete Konten */
  function pruefeZugang() {
    try {
      if (!(window.Auth && Auth.isApiMode && Auth.isApiMode() && Auth.isLoggedIn())) return;
      Auth.apiCall('/wuensche/zugang').then(function (r) {
        document.querySelectorAll('.sb-act-wuensche').forEach(function (el) { el.style.display = (r && r.ok) ? '' : 'none'; });
      }).catch(function () {});
    } catch (e) { /* still */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(pruefeZugang, 1500); });
  else setTimeout(pruefeZugang, 1500);
  window.addEventListener('dp:plan-ready', pruefeZugang);

  window.DpWuensche = { oeffnen: oeffnen, pruefeZugang: pruefeZugang };
})();
