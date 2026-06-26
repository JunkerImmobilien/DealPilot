// DealPilot Admin v796 — Extras: Hart-Loeschen, Mail-Layouts, Empfaenger-Modal
// Additives Modul. Haengt sich an bestehende Tabellen + erweitert das API-Objekt.
'use strict';
(function () {
  function _token() { return localStorage.getItem('dp_admin_token') || ''; }
  var BASE = '/api/v1/admin';

  async function _call(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var t = _token(); if (t) headers['X-Admin-Token'] = t;
    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var r = await fetch(BASE + path, opts);
    var data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      var err = new Error((data && (data.message || data.error)) || ('HTTP ' + r.status));
      err.status = r.status; err.data = data; throw err;
    }
    return data;
  }

  // ── API erweitern (falls window.API existiert) ──────────────────
  function _extendAPI() {
    if (typeof API === 'undefined' || !API) return;
    var A = API;
    A.deleteFeedback       = function (id) { return _call('DELETE', '/feedback/' + id); };
    A.deleteSupportTicket  = function (id) { return _call('DELETE', '/support-tickets/' + id); };
    A.deleteAuditEntry     = function (id) { return _call('DELETE', '/audit-log/' + id); };
    A.deleteInvoice        = function (id) { return _call('DELETE', '/invoices/' + id); };
    A.listMailLayouts      = function (kind) { return _call('GET', '/mail-layouts' + (kind ? ('?kind=' + kind) : '')); };
    A.saveMailLayout       = function (payload) { return _call('POST', '/mail-layouts', payload); };
    A.deleteMailLayout     = function (id) { return _call('DELETE', '/mail-layouts/' + id); };
    A.broadcastRecipients  = function (mode) { return _call('GET', '/broadcast/recipients-list' + (mode ? ('?mode=' + encodeURIComponent(mode)) : '')); };
  }

  function _toast(msg, type) {
    try {
      var cont = document.getElementById('toast-container');
      if (cont) {
        var t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.textContent = msg;
        cont.appendChild(t);
        setTimeout(function () { t.remove(); }, 4000);
        return;
      }
    } catch (e) {}
    console.log('[toast]', msg);
  }
  function _esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Trash-Icon ──────────────────────────────────────────────────
  var TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  // ── Generische Loeschen-Verdrahtung per Delegation ──────────────
  // Sucht in Tabellen nach Zeilen mit data-del-id + data-del-kind und haengt Loeschen-Buttons an.
  var DEL_LABELS = {
    feedback: 'Diesen Zufriedenheits-Eintrag endgültig löschen?',
    ticket:   'Dieses Support-Ticket endgültig löschen (inkl. Nachrichten)?',
    audit:    'Diesen Auditlog-Eintrag endgültig löschen?',
    invoice:  'Diese Rechnung endgültig löschen?'
  };
  var DEL_FN = {
    feedback: function (id) { return API.deleteFeedback(id); },
    ticket:   function (id) { return API.deleteSupportTicket(id); },
    audit:    function (id) { return API.deleteAuditEntry(id); },
    invoice:  function (id) { return API.deleteInvoice(id); }
  };

  // Globaler Klick-Handler fuer alle Loeschen-Buttons (Delegation)
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.dpx-del-btn') : null;
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-del-id');
    var kind = btn.getAttribute('data-del-kind');
    if (!id || !kind || !DEL_FN[kind]) return;
    if (!window.confirm(DEL_LABELS[kind] || 'Endgültig löschen?')) return;
    btn.disabled = true;
    DEL_FN[kind](id).then(function () {
      _toast('✓ Gelöscht', 'success');
      var tr = btn.closest('tr');
      if (tr) tr.parentNode.removeChild(tr);
      else { var card = btn.closest('.dpx-row'); if (card) card.parentNode.removeChild(card); }
    }).catch(function (err) {
      btn.disabled = false;
      _toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
    });
  });

  // Baut einen Loeschen-Button-HTML-Schnipsel (fuer manuelle Einbettung)
  window.dpxDelButton = function (kind, id) {
    return '<button type="button" class="btn btn-sm btn-danger dpx-del-btn" data-del-kind="' + _esc(kind) + '" data-del-id="' + _esc(id) + '" title="Endgültig löschen">' + TRASH + '</button>';
  };

  // ── Auto-Inject: haengt an jede Tabelle mit data-dpx-del="<kind>" eine Aktionsspalte ──
  // Erwartet, dass Zeilen ein data-id-Attribut tragen.
  function _injectDeleteColumns(root) {
    var tables = (root || document).querySelectorAll('table[data-dpx-del]');
    tables.forEach(function (tbl) {
      var kind = tbl.getAttribute('data-dpx-del');
      if (tbl.getAttribute('data-dpx-wired') === '1') return;
      tbl.setAttribute('data-dpx-wired', '1');
      // Header-Spalte
      var headRow = tbl.querySelector('thead tr');
      if (headRow && !headRow.querySelector('.dpx-del-th')) {
        var th = document.createElement('th');
        th.className = 'dpx-del-th'; th.style.width = '48px'; th.textContent = '';
        headRow.appendChild(th);
      }
      // Body-Zeilen
      tbl.querySelectorAll('tbody tr').forEach(function (tr) {
        if (tr.querySelector('.dpx-del-td')) return;
        var id = tr.getAttribute('data-id');
        var td = document.createElement('td');
        td.className = 'dpx-del-td';
        if (id) td.innerHTML = window.dpxDelButton(kind, id);
        tr.appendChild(td);
      });
    });
  }
  window.dpxInjectDeleteColumns = _injectDeleteColumns;

  // Beobachtet DOM-Aenderungen und injiziert Loeschen-Spalten automatisch nach.
  var _mo = new MutationObserver(function () { try { _injectDeleteColumns(document); } catch (e) {} });
  function _startObserver() {
    try { _mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    _injectDeleteColumns(document);
  }

  // ── EMPFAENGER-MODAL (wie viele erreicht + Liste) ───────────────
  window.dpxShowRecipients = async function (mode) {
    var modal = document.createElement('div');
    modal.className = 'dpx-modal-overlay';
    modal.innerHTML =
      '<div class="dpx-modal">' +
        '<div class="dpx-modal-head"><strong>Empfänger</strong>' +
          '<button type="button" class="dpx-modal-x" aria-label="Schließen">×</button></div>' +
        '<div class="dpx-modal-body"><div class="dpx-loading">Lade Empfänger…</div></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal || (e.target.closest && e.target.closest('.dpx-modal-x'))) modal.remove();
    });
    try {
      var r = await API.broadcastRecipients(mode);
      var body = modal.querySelector('.dpx-modal-body');
      var rows = (r.recipients || []).map(function (u) {
        return '<tr><td>' + _esc(u.email) + '</td><td>' + _esc(u.name || '–') + '</td></tr>';
      }).join('');
      body.innerHTML =
        '<div class="dpx-recip-count">Diese Massenmail erreicht <strong>' + (r.count || 0) + '</strong> Empfänger.</div>' +
        '<table class="data-table dpx-recip-table"><thead><tr><th>E-Mail</th><th>Name</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="2">Keine Empfänger</td></tr>') + '</tbody></table>';
    } catch (err) {
      modal.querySelector('.dpx-modal-body').innerHTML = '<div class="error-msg">' + _esc(err.message || 'Fehler') + '</div>';
    }
  };

  // ── MAIL-LAYOUT-UI (speichern/laden/download/upload) ────────────
  // Haengt sich an ein Element mit id="dpx-mail-layout-host" (falls vorhanden),
  // sonst kann man dpxMountLayoutUI(el, getCurrent, applyLayout) manuell rufen.
  // getCurrent(): liefert {name?,subject,body_html,body_text}
  // applyLayout(obj): traegt geladenes Layout ins Editor-UI ein
  window.dpxMountLayoutUI = function (host, getCurrent, applyLayout) {
    if (!host) return;
    host.innerHTML =
      '<div class="dpx-ml-bar">' +
        '<select class="dpx-ml-select"><option value="">— Gespeicherte Layouts —</option></select>' +
        '<button type="button" class="btn btn-sm dpx-ml-load">Laden</button>' +
        '<button type="button" class="btn btn-sm dpx-ml-save">Speichern</button>' +
        '<button type="button" class="btn btn-sm dpx-ml-del">Löschen</button>' +
        '<span class="dpx-ml-sep"></span>' +
        '<button type="button" class="btn btn-sm dpx-ml-download">⬇ Datei</button>' +
        '<button type="button" class="btn btn-sm dpx-ml-upload">⬆ Datei</button>' +
        '<input type="file" class="dpx-ml-file" accept=".html,.htm,.json,.txt" style="display:none">' +
      '</div>';
    var sel = host.querySelector('.dpx-ml-select');

    async function refresh() {
      try {
        var r = await API.listMailLayouts();
        sel.innerHTML = '<option value="">— Gespeicherte Layouts —</option>' +
          (r.layouts || []).map(function (l) {
            return '<option value="' + _esc(l.id) + '">' + _esc(l.name) +
              (l.kind === 'snippet' ? ' (Baustein)' : '') + '</option>';
          }).join('');
        window._dpxLayouts = {}; (r.layouts || []).forEach(function (l) { window._dpxLayouts[l.id] = l; });
      } catch (e) { _toast('Layouts laden fehlgeschlagen: ' + (e.message || ''), 'error'); }
    }
    refresh();

    host.querySelector('.dpx-ml-load').addEventListener('click', function () {
      var id = sel.value; if (!id) { _toast('Bitte ein Layout wählen', 'error'); return; }
      var l = (window._dpxLayouts || {})[id]; if (!l) return;
      if (typeof applyLayout === 'function') applyLayout(l);
      _toast('✓ Layout geladen', 'success');
    });

    host.querySelector('.dpx-ml-save').addEventListener('click', async function () {
      var cur = (typeof getCurrent === 'function') ? getCurrent() : {};
      var name = window.prompt('Name für dieses Layout:', cur.name || '');
      if (!name) return;
      var kind = window.confirm('Als ganzes Layout speichern?\n\nOK = Layout (HTML)\nAbbrechen = Text-Baustein') ? 'layout' : 'snippet';
      try {
        await API.saveMailLayout({
          name: name, kind: kind,
          subject: cur.subject || null,
          body_html: cur.body_html || null,
          body_text: cur.body_text || null
        });
        _toast('✓ Gespeichert', 'success');
        refresh();
      } catch (e) { _toast('Speichern fehlgeschlagen: ' + (e.message || ''), 'error'); }
    });

    host.querySelector('.dpx-ml-del').addEventListener('click', async function () {
      var id = sel.value; if (!id) { _toast('Bitte ein Layout wählen', 'error'); return; }
      if (!window.confirm('Dieses gespeicherte Layout löschen?')) return;
      try { await API.deleteMailLayout(id); _toast('✓ Gelöscht', 'success'); refresh(); }
      catch (e) { _toast('Löschen fehlgeschlagen: ' + (e.message || ''), 'error'); }
    });

    host.querySelector('.dpx-ml-download').addEventListener('click', function () {
      var cur = (typeof getCurrent === 'function') ? getCurrent() : {};
      var payload = { name: cur.name || 'layout', subject: cur.subject || '', body_html: cur.body_html || '', body_text: cur.body_text || '' };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = (cur.name || 'mail-layout') + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 200);
    });

    var fileInput = host.querySelector('.dpx-ml-file');
    host.querySelector('.dpx-ml-upload').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var txt = String(reader.result || '');
        var obj;
        if (/\.json$/i.test(f.name)) {
          try { obj = JSON.parse(txt); } catch (e) { _toast('JSON ungültig', 'error'); return; }
        } else {
          // HTML/TXT direkt als body_html uebernehmen
          obj = { name: f.name.replace(/\.(html?|txt)$/i, ''), body_html: txt };
        }
        if (typeof applyLayout === 'function') applyLayout(obj);
        _toast('✓ Datei geladen', 'success');
      };
      reader.readAsText(f);
      fileInput.value = '';
    });
  };

  // ── Boot ────────────────────────────────────────────────────────
  function boot() {
    _extendAPI();
    _startObserver();
    // Falls ein Layout-Host existiert, mit Default-Hooks mounten (greift, wenn die
    // Massenmail-Sektion ein #dpx-mail-layout-host + Standard-Felder bereitstellt).
    var host = document.getElementById('dpx-mail-layout-host');
    if (host) {
      window.dpxMountLayoutUI(host, function () {
        var subj = document.querySelector('#broadcast-subject, [name="broadcast-subject"], #bc-subject');
        var bodyH = document.querySelector('#broadcast-body, [name="broadcast-body"], #bc-body');
        return {
          subject: subj ? subj.value : '',
          body_html: bodyH ? bodyH.value : '',
          body_text: bodyH ? bodyH.value : ''
        };
      }, function (l) {
        var subj = document.querySelector('#broadcast-subject, [name="broadcast-subject"], #bc-subject');
        var bodyH = document.querySelector('#broadcast-body, [name="broadcast-body"], #bc-body');
        if (subj && l.subject != null) subj.value = l.subject;
        if (bodyH && (l.body_html != null || l.body_text != null)) bodyH.value = l.body_html || l.body_text || '';
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
