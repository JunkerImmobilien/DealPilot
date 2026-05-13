'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V141 — Datenraum (datenraum.js)

   Pro-Objekt-Architektur:
     - persoenlich:    EIN globaler Ordner für persönliche Standard-Dokumente
                       (Personalausweis, Gehalt, Steuerbescheide, SCHUFA, etc.)
     - objekte[id]:    EIN Hauptordner pro Objekt — User strukturiert intern selbst

   Storage in localStorage 'dp_datenraum_v141':
     {
       persoenlich: { url, label, provider, docs_checked: {personalausweis,...} },
       objekte: {
         '<obj_id>': { url, label, provider, docs_checked: {...} }
       },
       updated_at: ISO
     }
═══════════════════════════════════════════════════════════════ */

window.DealPilotDatenraum = (function() {

  var STORAGE_KEY = 'dp_datenraum_v141';
  var STORAGE_KEY_OLD = 'dp_datenraum';

  var DOCS_PERSOENLICH = [
    { key: 'personalausweis', label: 'Personalausweis (Vorder- & Rückseite)', pflicht_bank: true,  pflicht_fb: true },
    { key: 'schufa',          label: 'SCHUFA-Auskunft (max. 3 Mon.)',          pflicht_bank: true,  pflicht_fb: false },
    { key: 'gehalt',          label: 'Gehaltsabrechnungen (letzte 3 Mon.)',    pflicht_bank: true,  pflicht_fb: true },
    { key: 'lohnsteuer',      label: 'Lohnsteuerbescheinigung (letztes Jahr)', pflicht_bank: true,  pflicht_fb: false },
    { key: 'steuerbescheide', label: 'Steuerbescheide (letzte 2 Jahre)',       pflicht_bank: true,  pflicht_fb: false },
    { key: 'selbstauskunft',  label: 'Selbstauskunft Bank',                    pflicht_bank: true,  pflicht_fb: true },
    { key: 'rentenbescheid',  label: 'Rentenbescheid (Selbstständige/Renter)', pflicht_bank: false, pflicht_fb: false },
    { key: 'eur',             label: 'EÜR (Selbstständige)',                   pflicht_bank: false, pflicht_fb: false },
    { key: 'kontoauszuege',   label: 'Kontoauszüge (letzte 3 Mon.)',           pflicht_bank: true,  pflicht_fb: false }
  ];

  var DOCS_OBJEKT = [
    { key: 'expose',           label: 'Exposé / Verkaufsunterlagen',            pflicht_bank: true,  pflicht_fb: true  },
    { key: 'objektbilder',     label: 'Objektbilder',                            pflicht_bank: true,  pflicht_fb: true  },
    { key: 'grundriss',        label: 'Grundrisse',                              pflicht_bank: true,  pflicht_fb: false },
    { key: 'wohnflaeche',      label: 'Wohnflächenberechnung',                   pflicht_bank: true,  pflicht_fb: false },
    { key: 'lageplan',         label: 'Lageplan / Flurkarte',                    pflicht_bank: true,  pflicht_fb: false },
    { key: 'energieausweis',   label: 'Energieausweis',                          pflicht_bank: true,  pflicht_fb: false },
    { key: 'mietvertraege',    label: 'Mietverträge (alle Mieter)',              pflicht_bank: true,  pflicht_fb: false },
    { key: 'mieterliste',      label: 'Mieterliste mit aktuellen Mieten',        pflicht_bank: true,  pflicht_fb: false },
    { key: 'nebenkosten',      label: 'Nebenkostenabrechnung (letztes Jahr)',    pflicht_bank: false, pflicht_fb: false },
    { key: 'grundbuchauszug',  label: 'Grundbuchauszug (max. 6 Mon.)',           pflicht_bank: true,  pflicht_fb: false },
    { key: 'kaufvertrag',      label: 'Kaufvertrag-Entwurf (Notar)',             pflicht_bank: true,  pflicht_fb: true  },
    { key: 'teilungserklaerung', label: 'Teilungserklärung (bei ETW)',           pflicht_bank: true,  pflicht_fb: false },
    { key: 'protokolle_eigent', label: 'Eigentümer­versammlungs­protokolle (3J)', pflicht_bank: false, pflicht_fb: false },
    { key: 'wirtschaftsplan',   label: 'Wirtschaftsplan WEG',                     pflicht_bank: false, pflicht_fb: false },
    { key: 'versicherung',      label: 'Wohngebäude­versicherung',                pflicht_bank: false, pflicht_fb: false },
    { key: 'gutachten_vw',     label: 'Verkehrswert-Gutachten (falls vorhanden)', pflicht_bank: false, pflicht_fb: false },
    { key: 'gutachten_rnd',    label: 'RND-Gutachten (falls vorhanden)',         pflicht_bank: false, pflicht_fb: false }
  ];

  function _migrateOldData(state) {
    try {
      var oldRaw = localStorage.getItem(STORAGE_KEY_OLD);
      if (oldRaw && (!state.persoenlich || !state.persoenlich.url)) {
        var old = JSON.parse(oldRaw);
        if (old && old.slots && old.slots.bank) {
          state.persoenlich = {
            url: old.slots.bank.url,
            label: old.slots.bank.label || 'Persönlicher Datenraum',
            provider: old.slots.bank.provider,
            docs_checked: old.slots.bank.docs_checked || {}
          };
        }
      }
    } catch (e) {}
    return state;
  }

  function _read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        var fresh = { persoenlich: null, objekte: {}, updated_at: null };
        return _migrateOldData(fresh);
      }
      var parsed = JSON.parse(raw);
      if (!parsed.objekte) parsed.objekte = {};
      return parsed;
    } catch (e) {
      return { persoenlich: null, objekte: {}, updated_at: null };
    }
  }

  function _write(state) {
    state.updated_at = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function detectProvider(url) {
    if (!url) return null;
    var u = String(url).toLowerCase();
    if (u.indexOf('drive.google.com') >= 0 || u.indexOf('docs.google.com') >= 0) return 'gdrive';
    if (u.indexOf('onedrive.live.com') >= 0 || u.indexOf('1drv.ms') >= 0
        || u.indexOf('sharepoint.com') >= 0 || u.indexOf('-my.sharepoint') >= 0) return 'onedrive';
    if (u.indexOf('dropbox.com') >= 0 || u.indexOf('db.tt') >= 0) return 'dropbox';
    if (u.indexOf('icloud.com') >= 0) return 'icloud';
    if (u.indexOf('mega.nz') >= 0 || u.indexOf('mega.io') >= 0) return 'mega';
    if (u.indexOf('nextcloud') >= 0 || u.indexOf('owncloud') >= 0) return 'nextcloud';
    if (/^https?:\/\//.test(u)) return 'other';
    return null;
  }

  function providerLabel(p) {
    return ({ gdrive: 'Google Drive', onedrive: 'Microsoft OneDrive / SharePoint',
      dropbox: 'Dropbox', icloud: 'iCloud', mega: 'MEGA',
      nextcloud: 'Nextcloud / ownCloud', other: 'Anderer Cloud-Speicher' })[p] || 'Unbekannt';
  }

  function providerIcon(p) {
    return ({ gdrive: '🟢', onedrive: '🔵', dropbox: '🟦',
      icloud: '⚪', mega: '🔴', nextcloud: '🟧', other: '🔗' })[p] || '🔗';
  }

  // V142: Cache für Objekt-Liste (wird async vom Backend geladen)
  var _cachedObjekteList = null;

  function _getObjekteList() {
    // Wenn schon geladen, aus Cache zurückgeben
    if (_cachedObjekteList !== null) return _cachedObjekteList;
    // Sonst leer + async-Load triggern
    _refreshObjekteFromBackend();
    return [];
  }

  function _refreshObjekteFromBackend() {
    // Backend-Funktion getAllObjectsData() ist async, lädt /api/objects
    if (typeof window.getAllObjectsData !== 'function') {
      // Fallback: alter localStorage-Weg (falls offline)
      try {
        var raw = localStorage.getItem('ji_objects') || '[]';
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          _cachedObjekteList = arr.map(function(o) {
            var d = o.data || {};
            var addr = ((d.str || '') + ' ' + (d.hnr || '')).trim();
            if (d.ort) addr += (addr ? ', ' : '') + d.ort;
            return { id: o.id || o._id || d.kuerzel || '?',
                     kuerzel: d.kuerzel || '–',
                     adresse: addr || '(ohne Adresse)' };
          });
        } else {
          _cachedObjekteList = [];
        }
      } catch (e) { _cachedObjekteList = []; }
      return Promise.resolve(_cachedObjekteList);
    }
    return Promise.resolve(window.getAllObjectsData())
      .then(function(arr) {
        if (!Array.isArray(arr)) {
          _cachedObjekteList = [];
          return _cachedObjekteList;
        }
        _cachedObjekteList = arr.map(function(o) {
          var d = o.data || {};
          var addr = ((d.str || '') + ' ' + (d.hnr || '')).trim();
          if (d.ort) addr += (addr ? ', ' : '') + d.ort;
          // o.name aus dem Backend ist oft schon "Dealstreet 1 Köln" — als Fallback
          return {
            id:      o.id || d.kuerzel || '?',
            kuerzel: d.kuerzel || (o.name || '').split(' ')[0] || '–',
            adresse: addr || o.name || '(ohne Adresse)'
          };
        });
        return _cachedObjekteList;
      })
      .catch(function(e) {
        console.warn('[Datenraum] Backend-Load fehlgeschlagen:', e);
        _cachedObjekteList = [];
        return _cachedObjekteList;
      });
  }

  function _invalidateCache() {
    _cachedObjekteList = null;
  }

  function _getCurrentObjId() {
    // V143: Mehrere Quellen für die aktuelle Objekt-ID prüfen
    try {
      // 1. Explizit gesetzter Key
      var fromStorage = localStorage.getItem('dp_current_object_id');
      if (fromStorage) return fromStorage;
      // 2. window._currentObjData (Backend-Objekt das gerade geladen ist)
      if (typeof window._currentObjData === 'object' && window._currentObjData) {
        if (window._currentObjData.id) return window._currentObjData.id;
        if (window._currentObjData._id) return window._currentObjData._id;
        if (window._currentObjData.data && window._currentObjData.data.kuerzel) {
          // Match per Kürzel gegen Cache
          var k = window._currentObjData.data.kuerzel;
          if (_cachedObjekteList) {
            var match = _cachedObjekteList.find(function(o) { return o.kuerzel === k; });
            if (match) return match.id;
          }
        }
      }
      // 3. window.currentObjectId (manche älteren UI-Versionen)
      if (typeof window.currentObjectId === 'string' && window.currentObjectId) {
        return window.currentObjectId;
      }
      // 4. Aktives Kürzel-Feld im DOM
      var kuerzelEl = document.getElementById('input-kuerzel');
      if (kuerzelEl && kuerzelEl.value && _cachedObjekteList) {
        var byKuerzel = _cachedObjekteList.find(function(o) { return o.kuerzel === kuerzelEl.value; });
        if (byKuerzel) return byKuerzel.id;
      }
    } catch (e) {}
    return null;
  }

  function getAll() { return _read(); }
  function getPersoenlich() { var s = _read(); return s.persoenlich || null; }

  function setPersoenlich(data) {
    var s = _read();
    var url = (data && data.url) ? String(data.url).trim() : '';
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    var existing = s.persoenlich || {};
    s.persoenlich = {
      url: url,
      label: (data.label || '').trim() || 'Persönlicher Datenraum',
      provider: detectProvider(url),
      docs_checked: existing.docs_checked || {}
    };
    _write(s);
    return true;
  }

  function clearPersoenlich() {
    var s = _read();
    s.persoenlich = null;
    _write(s);
  }

  function getObjektOrdner(objId) {
    var s = _read();
    return (s.objekte && s.objekte[objId]) || null;
  }

  function setObjektOrdner(objId, data) {
    if (!objId) return false;
    var s = _read();
    var url = (data && data.url) ? String(data.url).trim() : '';
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    var existing = (s.objekte && s.objekte[objId]) || {};
    s.objekte[objId] = {
      url: url,
      label: (data.label || '').trim() || 'Objekt-Datenraum',
      provider: detectProvider(url),
      docs_checked: existing.docs_checked || {}
    };
    _write(s);
    return true;
  }

  function clearObjektOrdner(objId) {
    var s = _read();
    if (s.objekte && s.objekte[objId]) {
      delete s.objekte[objId];
      _write(s);
    }
  }

  // V188: optionaler 2. Parameter setValue — wenn true/false übergeben,
  // wird der Wert explizit gesetzt (statt getoggled). Backward-compatible
  // mit allen Aufrufern, die nur 1 Argument übergeben.
  function togglePersDoc(docKey, setValue) {
    var s = _read();
    if (!s.persoenlich) s.persoenlich = { url: '', label: '', provider: null, docs_checked: {} };
    if (!s.persoenlich.docs_checked) s.persoenlich.docs_checked = {};
    if (typeof setValue === 'boolean') {
      s.persoenlich.docs_checked[docKey] = setValue;
    } else {
      s.persoenlich.docs_checked[docKey] = !s.persoenlich.docs_checked[docKey];
    }
    _write(s);
    return s.persoenlich.docs_checked[docKey];
  }

  function toggleObjDoc(objId, docKey, setValue) {
    var s = _read();
    if (!s.objekte[objId]) s.objekte[objId] = { url: '', label: '', provider: null, docs_checked: {} };
    if (!s.objekte[objId].docs_checked) s.objekte[objId].docs_checked = {};
    if (typeof setValue === 'boolean') {
      s.objekte[objId].docs_checked[docKey] = setValue;
    } else {
      s.objekte[objId].docs_checked[docKey] = !s.objekte[objId].docs_checked[docKey];
    }
    _write(s);
    return s.objekte[objId].docs_checked[docKey];
  }

  function openPersoenlich() {
    var p = getPersoenlich();
    if (!p || !p.url) {
      alert('Persönlicher Datenraum nicht verknüpft. Bitte in Settings → Datenraum verknüpfen.');
      return false;
    }
    window.open(p.url, '_blank', 'noopener,noreferrer');
    return true;
  }

  function openObjekt(objId) {
    var o = getObjektOrdner(objId);
    if (!o || !o.url) {
      alert('Datenraum für dieses Objekt nicht verknüpft. Bitte in Settings → Datenraum verknüpfen.');
      return false;
    }
    window.open(o.url, '_blank', 'noopener,noreferrer');
    return true;
  }

  function getCompletionForRequest(objId, requestType) {
    var pflichtFlag = requestType === 'fb' ? 'pflicht_fb' : 'pflicht_bank';
    var pers = getPersoenlich();
    var obj = getObjektOrdner(objId);

    var persPflicht = DOCS_PERSOENLICH.filter(function(d) { return d[pflichtFlag]; });
    var persConfirmed = [], persMissing = [];
    persPflicht.forEach(function(d) {
      if (pers && pers.docs_checked && pers.docs_checked[d.key]) persConfirmed.push(d);
      else persMissing.push(d);
    });

    var objPflicht = DOCS_OBJEKT.filter(function(d) { return d[pflichtFlag]; });
    var objConfirmed = [], objMissing = [];
    objPflicht.forEach(function(d) {
      if (obj && obj.docs_checked && obj.docs_checked[d.key]) objConfirmed.push(d);
      else objMissing.push(d);
    });

    return {
      persoenlich: { slot: pers, hatOrdner: !!(pers && pers.url), pflicht: persPflicht, confirmed: persConfirmed, missing: persMissing },
      objekt: { slot: obj, hatOrdner: !!(obj && obj.url), pflicht: objPflicht, confirmed: objConfirmed, missing: objMissing },
      gesamt_pflicht: persPflicht.length + objPflicht.length,
      gesamt_confirmed: persConfirmed.length + objConfirmed.length,
      gesamt_missing: persMissing.length + objMissing.length,
      complete: persMissing.length === 0 && objMissing.length === 0,
      hatBeideOrdner: !!(pers && pers.url) && !!(obj && obj.url)
    };
  }

  // ───────────────────── Settings-Tab ──────────────────────
  function renderSettingsTab() {
    var state = _read();
    var objekteList = _getObjekteList();
    var currentObjId = _getCurrentObjId() || (objekteList[0] && objekteList[0].id) || null;
    var loadedAsync = (_cachedObjekteList !== null);

    // Falls Liste leer ist UND wir noch nicht versucht haben zu laden,
    // setzen wir einen Async-Re-Render nach dem Backend-Call auf.
    if (!loadedAsync) {
      _refreshObjekteFromBackend().then(function() {
        var host = document.getElementById('dr-settings-host');
        if (host) host.innerHTML = renderSettingsTab();
      });
    }

    var html = [];
    html.push('<div class="dr-settings">');
    html.push('  <div class="dr-intro">');
    html.push('    <h3 style="margin:0 0 6px 0">Datenraum verknüpfen</h3>');
    html.push('    <p style="margin:0 0 12px 0;font-size:13px;color:var(--muted);line-height:1.5">');
    html.push('      Verknüpfe deinen <strong>persönlichen Cloud-Ordner</strong> (für SCHUFA, Steuerbescheide, Gehaltsabrechnungen etc.) und für jedes Objekt einen <strong>eigenen Cloud-Ordner</strong>. DealPilot speichert nur die URLs — keine Datei-Inhalte werden gelesen oder hochgeladen.');
    html.push('    </p>');
    html.push('    <div class="dr-privacy">');
    html.push('      <strong>Hinweis zur Datensicherheit:</strong> Links liegen nur in deinem Browser (localStorage). Bei Bank-Anfragen wird der entsprechende Link in die E-Mail eingefügt — der Empfänger sieht den Ordner mit deinen Freigabe-Einstellungen.');
    html.push('    </div>');
    html.push('  </div>');

    var pers = state.persoenlich;
    var hasPers = !!(pers && pers.url);
    html.push('  <div class="dr-section">');
    html.push('    <h3 class="dr-section-h">Persönlicher Datenraum</h3>');
    html.push('    <p class="dr-section-desc">Ein Ordner für alle Objekte: Personalausweis, SCHUFA, Gehalt, Lohnsteuer, Steuerbescheide, Selbstauskunft, Rentenbescheid, Kontoauszüge.</p>');

    html.push('    <div class="dr-slot' + (hasPers ? ' dr-slot-active' : '') + '">');
    html.push('      <div class="dr-slot-head">');
    html.push('        <div class="dr-slot-title">');
    html.push('          <span class="dr-slot-icon">' + (hasPers ? providerIcon(pers.provider) : '⬚') + '</span>');
    html.push('          <strong>' + esc(hasPers ? (pers.label || 'Persönlicher Datenraum') : 'Persönlicher Datenraum') + '</strong>');
    html.push('          <span class="dr-slot-status ' + (hasPers ? 'dr-slot-status-active' : 'dr-slot-status-empty') + '">' + (hasPers ? 'verknüpft' : 'nicht verknüpft') + '</span>');
    html.push('        </div>');
    html.push('      </div>');
    html.push('      <div class="dr-slot-body">');
    if (hasPers) {
      html.push('        <div class="dr-slot-link-row"><span class="dr-provider-label">' + esc(providerLabel(pers.provider)) + '</span></div>');
      html.push('        <div class="dr-slot-url">' + esc(pers.url) + '</div>');
      html.push('        <div class="dr-slot-actions">');
      html.push('          <button class="dr-btn" type="button" onclick="DealPilotDatenraum.openPersoenlich()">Öffnen</button>');
      html.push('          <button class="dr-btn dr-btn-outline" type="button" onclick="DealPilotDatenraum._editPers()">Ändern</button>');
      html.push('          <button class="dr-btn dr-btn-danger" type="button" onclick="DealPilotDatenraum._removePersConfirm()">Entfernen</button>');
      html.push('        </div>');
      var persDocsConfirmed = Object.keys(pers.docs_checked || {}).filter(function(k){return pers.docs_checked[k];}).length;
      html.push('        <details class="dr-doc-details" style="margin-top:14px">');
      html.push('          <summary>Pflicht-Dokumente bestätigen (' + persDocsConfirmed + ' bestätigt)</summary>');
      html.push('          <div class="dr-doc-grid">');
      DOCS_PERSOENLICH.forEach(function(d) {
        var ck = !!(pers.docs_checked && pers.docs_checked[d.key]);
        var marker = d.pflicht_bank ? '<span class="dr-doc-marker">Bank</span>' : '';
        html.push('            <label class="dr-doc-item' + (ck ? ' dr-doc-item-checked' : '') + '">');
        html.push('              <input type="checkbox" ' + (ck ? 'checked' : '') + ' onclick="DealPilotDatenraum._togglePersFromUI(\'' + d.key + '\', this)">');
        html.push('              <span class="dr-doc-label">' + esc(d.label) + '</span>' + marker);
        html.push('            </label>');
      });
      html.push('          </div>');
      html.push('        </details>');
    } else {
      html.push('        <div class="dr-slot-empty">');
      html.push('          <button class="dr-btn dr-btn-primary" type="button" onclick="DealPilotDatenraum._editPers()">Ordner-Link einfügen</button>');
      html.push('        </div>');
    }
    html.push('      </div>');
    html.push('    </div>');
    html.push('  </div>');

    html.push('  <div class="dr-section">');
    html.push('    <h3 class="dr-section-h">Objekt-Datenräume</h3>');
    html.push('    <p class="dr-section-desc">Pro Objekt ein eigener Cloud-Ordner. Strukturiere intern wie du möchtest — DealPilot prüft nur, ob die Pflicht-Dokumente bestätigt sind.</p>');

    if (objekteList.length === 0) {
      if (!loadedAsync) {
        html.push('    <div class="dr-empty-state">Lade Objekte aus dem Backend …</div>');
      } else {
        html.push('    <div class="dr-empty-state">Noch keine Objekte angelegt. Lege ein Objekt im Tab "Objekt" an, dann erscheint es hier.</div>');
      }
    } else {
      html.push('    <div class="dr-obj-selector">');
      html.push('      <label class="dr-input-label">Objekt auswählen</label>');
      html.push('      <select id="dr-obj-select" class="dr-input" onchange="DealPilotDatenraum._switchObjekt(this.value)">');
      objekteList.forEach(function(o) {
        var sel = (o.id === currentObjId) ? ' selected' : '';
        var marker = (state.objekte[o.id] && state.objekte[o.id].url) ? ' ✓' : '';
        html.push('        <option value="' + esc(o.id) + '"' + sel + '>' + esc(o.kuerzel) + ' — ' + esc(o.adresse) + marker + '</option>');
      });
      html.push('      </select>');
      html.push('    </div>');
      html.push('    <div id="dr-obj-host">' + _renderObjektCard(currentObjId, state) + '</div>');
    }
    html.push('  </div>');

    html.push('  <div class="dr-howto">');
    html.push('    <h4 style="margin:0 0 8px 0;font-size:13px">So bekommst du den Freigabe-Link:</h4>');
    html.push('    <ul style="margin:0;padding-left:20px;font-size:12px;line-height:1.6;color:var(--muted)">');
    html.push('      <li><strong>Google Drive:</strong> Ordner rechts­klicken → Freigeben → "Jeder mit dem Link" → Link kopieren</li>');
    html.push('      <li><strong>OneDrive:</strong> Ordner → Teilen → "Personen mit dem Link können anzeigen" → Link kopieren</li>');
    html.push('      <li><strong>Dropbox:</strong> Ordner → Teilen → Link erstellen → Kopieren</li>');
    html.push('      <li><strong>Eigener Server / Nextcloud:</strong> WebDAV- oder Freigabe-Link einfügen</li>');
    html.push('    </ul>');
    html.push('    <p style="margin:8px 0 0 0;font-size:12px;color:var(--muted)">Tipp: Setze beim Bank-Ordner ein <strong>Ablaufdatum</strong> auf den Freigabe-Link (z.B. 30 Tage), damit der Zugriff nach Abschluss automatisch endet.</p>');
    html.push('  </div>');

    html.push('</div>');
    return html.join('');
  }

  function _renderObjektCard(objId, state) {
    if (!objId) return '';
    var ord = state.objekte[objId];
    var hasOrd = !!(ord && ord.url);

    var html = [];
    html.push('<div class="dr-slot' + (hasOrd ? ' dr-slot-active' : '') + '" data-obj="' + esc(objId) + '">');
    html.push('  <div class="dr-slot-head">');
    html.push('    <div class="dr-slot-title">');
    html.push('      <span class="dr-slot-icon">' + (hasOrd ? providerIcon(ord.provider) : '⬚') + '</span>');
    html.push('      <strong>' + esc(hasOrd ? (ord.label || 'Objekt-Datenraum') : 'Objekt-Datenraum') + '</strong>');
    html.push('      <span class="dr-slot-status ' + (hasOrd ? 'dr-slot-status-active' : 'dr-slot-status-empty') + '">' + (hasOrd ? 'verknüpft' : 'nicht verknüpft') + '</span>');
    html.push('    </div>');
    html.push('  </div>');
    html.push('  <div class="dr-slot-body">');

    if (hasOrd) {
      html.push('    <div class="dr-slot-link-row"><span class="dr-provider-label">' + esc(providerLabel(ord.provider)) + '</span></div>');
      html.push('    <div class="dr-slot-url">' + esc(ord.url) + '</div>');
      html.push('    <div class="dr-slot-actions">');
      html.push('      <button class="dr-btn" type="button" onclick="DealPilotDatenraum.openObjekt(\'' + esc(objId) + '\')">Öffnen</button>');
      html.push('      <button class="dr-btn dr-btn-outline" type="button" onclick="DealPilotDatenraum._editObj(\'' + esc(objId) + '\')">Ändern</button>');
      html.push('      <button class="dr-btn dr-btn-danger" type="button" onclick="DealPilotDatenraum._removeObjConfirm(\'' + esc(objId) + '\')">Entfernen</button>');
      html.push('    </div>');
      var ckCount = Object.keys(ord.docs_checked || {}).filter(function(k){return ord.docs_checked[k];}).length;
      html.push('    <details class="dr-doc-details" style="margin-top:14px">');
      html.push('      <summary>Pflicht-Dokumente bestätigen (' + ckCount + ' bestätigt)</summary>');
      html.push('      <div class="dr-doc-grid">');
      DOCS_OBJEKT.forEach(function(d) {
        var ck = !!(ord.docs_checked && ord.docs_checked[d.key]);
        var marker = d.pflicht_bank ? '<span class="dr-doc-marker">Bank</span>' : '';
        html.push('        <label class="dr-doc-item' + (ck ? ' dr-doc-item-checked' : '') + '">');
        html.push('          <input type="checkbox" ' + (ck ? 'checked' : '') + ' onclick="DealPilotDatenraum._toggleObjFromUI(\'' + esc(objId) + '\', \'' + d.key + '\', this)">');
        html.push('          <span class="dr-doc-label">' + esc(d.label) + '</span>' + marker);
        html.push('        </label>');
      });
      html.push('      </div>');
      html.push('    </details>');
    } else {
      html.push('    <div class="dr-slot-empty">');
      html.push('      <button class="dr-btn dr-btn-primary" type="button" onclick="DealPilotDatenraum._editObj(\'' + esc(objId) + '\')">Ordner-Link einfügen</button>');
      html.push('    </div>');
    }
    html.push('  </div>');
    html.push('</div>');
    return html.join('');
  }

  // ───────────────────── Edit-Modal ──────────────────────
  function _editPers() {
    _editModal({
      titel: 'Persönlicher Datenraum',
      hint: 'Ein Cloud-Ordner für alle persönlichen Standard-Dokumente: Personalausweis, SCHUFA, Gehalt, Steuerbescheide, Selbstauskunft. Wird bei jeder Bankanfrage verlinkt.',
      currentSlot: getPersoenlich(),
      onSave: function(url, label) { return setPersoenlich({ url: url, label: label }); }
    });
  }

  function _editObj(objId) {
    var objList = _getObjekteList();
    var obj = objList.find(function(o) { return o.id === objId; });
    var hint = obj ? ('Cloud-Ordner für Objekt "' + obj.kuerzel + ' — ' + obj.adresse + '". Strukturiere intern (Bank/Notar/Mieter etc.) wie du möchtest.') : 'Cloud-Ordner für dieses Objekt.';
    _editModal({
      titel: obj ? ('Datenraum für ' + obj.kuerzel) : 'Objekt-Datenraum',
      hint: hint,
      currentSlot: getObjektOrdner(objId),
      onSave: function(url, label) { return setObjektOrdner(objId, { url: url, label: label }); }
    });
  }

  function _editModal(opts) {
    var slot = opts.currentSlot;
    var currentUrl = slot ? slot.url : '';
    var currentLabel = slot ? slot.label : '';

    var modal = document.createElement('div');
    modal.className = 'dr-modal';
    modal.id = 'dr-edit-modal';
    modal.innerHTML = [
      '<div class="dr-modal-backdrop" onclick="DealPilotDatenraum._closeEditModal()"></div>',
      '<div class="dr-modal-panel">',
      '  <h3 style="margin-top:0">' + esc(opts.titel) + '</h3>',
      '  <p style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:14px">' + esc(opts.hint) + '</p>',
      '  <label class="dr-input-label">Freigabe-Link (URL)</label>',
      '  <input id="dr-edit-url" type="url" placeholder="https://drive.google.com/drive/folders/..." value="' + esc(currentUrl) + '" class="dr-input" autocomplete="off">',
      '  <div class="dr-input-hint" id="dr-provider-detect">Provider wird automatisch erkannt</div>',
      '  <label class="dr-input-label" style="margin-top:14px">Bezeichnung (optional)</label>',
      '  <input id="dr-edit-label" type="text" placeholder="z.B. \'Bank-Ordner Apostelnstr. 5\'" value="' + esc(currentLabel) + '" class="dr-input" maxlength="60">',
      '  <div class="dr-modal-actions">',
      '    <button class="dr-btn dr-btn-outline" type="button" onclick="DealPilotDatenraum._closeEditModal()">Abbrechen</button>',
      '    <button class="dr-btn dr-btn-primary" type="button" id="dr-save-btn">Speichern</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var urlField = document.getElementById('dr-edit-url');
    var labelField = document.getElementById('dr-edit-label');
    var detectEl = document.getElementById('dr-provider-detect');
    var saveBtn = document.getElementById('dr-save-btn');

    var updateDetect = function() {
      var u = urlField.value.trim();
      var p = detectProvider(u);
      if (!u) {
        detectEl.textContent = 'Provider wird automatisch erkannt';
        detectEl.style.color = 'var(--muted)';
      } else if (p) {
        detectEl.innerHTML = providerIcon(p) + ' Erkannt: <strong>' + esc(providerLabel(p)) + '</strong>';
        detectEl.style.color = 'var(--ch)';
      } else {
        detectEl.textContent = '⚠ Kein gültiger URL — bitte mit https:// beginnen';
        detectEl.style.color = 'var(--red, #B8625C)';
      }
    };
    urlField.addEventListener('input', updateDetect);
    saveBtn.addEventListener('click', function() {
      var url = urlField.value.trim();
      if (!url) { alert('Bitte einen Freigabe-Link einfügen.'); return; }
      var ok = opts.onSave(url, labelField.value);
      if (!ok) { alert('Speichern fehlgeschlagen — bitte URL prüfen.'); return; }
      _closeEditModal();
      var container = document.getElementById('dr-settings-host');
      if (container) container.innerHTML = renderSettingsTab();
      if (typeof window.DealPilotDealAction !== 'undefined' &&
          typeof window.DealPilotDealAction.refreshDatenraum === 'function') {
        try { window.DealPilotDealAction.refreshDatenraum(); } catch(e){}
      }
    });
    updateDetect();
    setTimeout(function() { urlField.focus(); }, 50);
  }

  function _closeEditModal() {
    var m = document.getElementById('dr-edit-modal');
    if (m) m.remove();
  }

  function _removePersConfirm() {
    if (!confirm('Persönlichen Datenraum-Link wirklich entfernen?')) return;
    clearPersoenlich();
    var c = document.getElementById('dr-settings-host');
    if (c) c.innerHTML = renderSettingsTab();
  }

  function _removeObjConfirm(objId) {
    if (!confirm('Objekt-Datenraum-Link wirklich entfernen?')) return;
    clearObjektOrdner(objId);
    var c = document.getElementById('dr-settings-host');
    if (c) c.innerHTML = renderSettingsTab();
  }

  function _switchObjekt(objId) {
    try { localStorage.setItem('dp_current_object_id', objId); } catch(e){}
    var host = document.getElementById('dr-obj-host');
    if (host) host.innerHTML = _renderObjektCard(objId, _read());
  }

  function _togglePersFromUI(docKey, checkbox) {
    togglePersDoc(docKey);
    var el = checkbox.closest('.dr-doc-item');
    if (el) el.classList.toggle('dr-doc-item-checked', checkbox.checked);
  }

  function _toggleObjFromUI(objId, docKey, checkbox) {
    toggleObjDoc(objId, docKey);
    var el = checkbox.closest('.dr-doc-item');
    if (el) el.classList.toggle('dr-doc-item-checked', checkbox.checked);
  }

  // ───────────────────── Deal-Aktion-Panel ──────────────────────
  // V179: Renderpanel mit klickbarer Pflicht-Doc-Checkliste pro Datenraum.
  // Häkchen wirken direkt auf den Storage; nach jedem Klick wird das Panel
  // neu gerendert und die Step-Validation neu ausgewertet.
  function renderDealActionPanel(currentObjId, requestType) {
    if (!currentObjId) currentObjId = _getCurrentObjId();
    requestType = requestType || 'bank';
    var status = currentObjId ? getCompletionForRequest(currentObjId, requestType) : null;

    var html = [];
    html.push('<div class="dr-da-panel">');
    html.push('  <div class="dr-da-head"><strong>Datenraum für diese Anfrage</strong></div>');

    if (!currentObjId || !status) {
      html.push('  <div class="dr-da-warn">⚠ Kein aktives Objekt — bitte zuerst Objekt im Tab "Objekt" laden.</div>');
      html.push('</div>');
      return html.join('');
    }

    var pflichtFlag = requestType === 'fb' ? 'pflicht_fb' : 'pflicht_bank';

    // ── PERSÖNLICHER DATENRAUM ──
    var pers = status.persoenlich;
    html.push('  <div class="dr-da-block">');
    html.push('    <div class="dr-da-block-head">');
    html.push('      <span class="dr-da-block-title">Persönlicher Datenraum</span>');
    if (pers.hatOrdner) {
      html.push('      <span class="dr-da-provider">' + providerIcon(pers.slot.provider) + ' ' + esc(providerLabel(pers.slot.provider)) + '</span>');
      html.push('      <button type="button" class="dr-mini-btn" onclick="DealPilotDatenraum.openPersoenlich()">Öffnen</button>');
    } else {
      html.push('      <span class="dr-da-empty">— nicht verknüpft</span>');
      html.push('      <button type="button" class="dr-mini-btn dr-mini-btn-primary" onclick="DealPilotDatenraum._editPers()">Verknüpfen</button>');
    }
    html.push('    </div>');
    if (pers.pflicht.length > 0) {
      html.push('    <div class="dr-da-progress-mini">');
      html.push('      <span>' + pers.confirmed.length + '/' + pers.pflicht.length + ' Pflicht-Dokumente</span>');
      var persPct = Math.round(pers.confirmed.length / pers.pflicht.length * 100);
      var persColor = persPct === 100 ? '#3FA56C' : persPct >= 50 ? '#C9A84C' : '#B8625C';
      html.push('      <div class="dr-da-bar"><div style="width:' + persPct + '%;background:' + persColor + '"></div></div>');
      html.push('    </div>');

      // V179: Klickbare Checkliste — Pflicht-Docs (persönlich)
      var persChecked = (pers.slot && pers.slot.docs_checked) || {};
      html.push('    <div class="dr-da-checklist" ' + (pers.hatOrdner ? '' : 'data-disabled="1" title="Erst Ordner verknüpfen"') + '>');
      pers.pflicht.forEach(function(d) {
        var ck = !!persChecked[d.key];
        var disabled = pers.hatOrdner ? '' : ' disabled';
        html.push(
          '      <label class="dr-da-check-item' + (ck ? ' is-checked' : '') + (pers.hatOrdner ? '' : ' is-disabled') + '">' +
          '<input type="checkbox" ' + (ck ? 'checked' : '') + disabled +
          ' onclick="DealPilotDatenraum._togglePersFromPanel(\'' + esc(d.key) + '\', \'' + esc(requestType) + '\', this)">' +
          '<span class="dr-da-check-lbl">' + esc(d.label) + '</span></label>'
        );
      });
      html.push('    </div>');
    }
    html.push('  </div>');

    // ── OBJEKT-DATENRAUM ──
    var obj = status.objekt;
    html.push('  <div class="dr-da-block">');
    html.push('    <div class="dr-da-block-head">');
    html.push('      <span class="dr-da-block-title">Objekt-Datenraum</span>');
    if (obj.hatOrdner) {
      html.push('      <span class="dr-da-provider">' + providerIcon(obj.slot.provider) + ' ' + esc(providerLabel(obj.slot.provider)) + '</span>');
      html.push('      <button type="button" class="dr-mini-btn" onclick="DealPilotDatenraum.openObjekt(\'' + esc(currentObjId) + '\')">Öffnen</button>');
    } else {
      html.push('      <span class="dr-da-empty">— nicht verknüpft</span>');
      html.push('      <button type="button" class="dr-mini-btn dr-mini-btn-primary" onclick="DealPilotDatenraum._editObj(\'' + esc(currentObjId) + '\')">Verknüpfen</button>');
    }
    html.push('    </div>');
    if (obj.pflicht.length > 0) {
      html.push('    <div class="dr-da-progress-mini">');
      html.push('      <span>' + obj.confirmed.length + '/' + obj.pflicht.length + ' Pflicht-Dokumente</span>');
      var objPct = Math.round(obj.confirmed.length / obj.pflicht.length * 100);
      var objColor = objPct === 100 ? '#3FA56C' : objPct >= 50 ? '#C9A84C' : '#B8625C';
      html.push('      <div class="dr-da-bar"><div style="width:' + objPct + '%;background:' + objColor + '"></div></div>');
      html.push('    </div>');

      // V179: Klickbare Checkliste — Pflicht-Docs (objekt)
      var objChecked = (obj.slot && obj.slot.docs_checked) || {};
      html.push('    <div class="dr-da-checklist" ' + (obj.hatOrdner ? '' : 'data-disabled="1" title="Erst Ordner verknüpfen"') + '>');
      obj.pflicht.forEach(function(d) {
        var ck = !!objChecked[d.key];
        var disabled = obj.hatOrdner ? '' : ' disabled';
        html.push(
          '      <label class="dr-da-check-item' + (ck ? ' is-checked' : '') + (obj.hatOrdner ? '' : ' is-disabled') + '">' +
          '<input type="checkbox" ' + (ck ? 'checked' : '') + disabled +
          ' onclick="DealPilotDatenraum._toggleObjFromPanel(\'' + esc(currentObjId) + '\', \'' + esc(d.key) + '\', \'' + esc(requestType) + '\', this)">' +
          '<span class="dr-da-check-lbl">' + esc(d.label) + '</span></label>'
        );
      });
      html.push('    </div>');
    }
    html.push('  </div>');

    if (status.complete && status.hatBeideOrdner) {
      html.push('  <div class="dr-da-complete">✓ Alle Pflicht-Dokumente bestätigt — beide Ordner-Links werden der Anfrage automatisch beigefügt.</div>');
    } else if (!status.hatBeideOrdner) {
      var fehlt = [];
      if (!pers.hatOrdner) fehlt.push('Persönlicher Datenraum');
      if (!obj.hatOrdner) fehlt.push('Objekt-Datenraum');
      html.push('  <div class="dr-da-warn">⚠ Noch nicht verknüpft: ' + fehlt.join(' + ') + '</div>');
    } else if (status.gesamt_missing > 0) {
      html.push('  <div class="dr-da-warn">⚠ Noch ' + status.gesamt_missing + ' Pflicht-Dokumente ausstehend.</div>');
    }

    html.push('</div>');
    return html.join('');
  }

  // V179: Toggle-Handler für Klicks AUS dem Deal-Action-Panel.
  // Unterschied zu _togglePersFromUI: triggert Panel-Refresh + Step-Validation
  // in deal-action.js (falls geladen).
  function _togglePersFromPanel(docKey, requestType, checkbox) {
    togglePersDoc(docKey);
    _refreshDealActionPanelAndValidate(requestType);
  }

  function _toggleObjFromPanel(objId, docKey, requestType, checkbox) {
    toggleObjDoc(objId, docKey);
    _refreshDealActionPanelAndValidate(requestType);
  }

  function _refreshDealActionPanelAndValidate(requestType) {
    // 1) Panel im Bank/FB-Modal neu rendern
    if (typeof window.DealPilotDealAction !== 'undefined' &&
        typeof window.DealPilotDealAction.refreshDatenraum === 'function') {
      try { window.DealPilotDealAction.refreshDatenraum(); } catch (e) {}
    }
    // 2) Step-2-Validation neu auswerten (Senden-Button (de)aktivieren)
    if (typeof window.DealPilotDealAction !== 'undefined' &&
        typeof window.DealPilotDealAction._revalidateStep2 === 'function' &&
        requestType) {
      try { window.DealPilotDealAction._revalidateStep2(requestType); } catch (e) {}
    }
  }

  // V179: buildBankSnippet erzeugt jetzt eine Doc-für-Doc-Aufzählung mit
  // Direkt-Link zum jeweiligen Cloud-Ordner. Cloud-Provider (Google Drive,
  // OneDrive, Dropbox, Nextcloud) bieten keinen verlässlichen Deep-Link
  // pro Datei aus einem geteilten Ordner — wir verlinken konsequent den
  // Ordner-Root und benennen den Dokumenttyp, sodass der Empfänger im
  // Ordner direkt fündig wird.
  function buildBankSnippet(currentObjId, requestType) {
    requestType = requestType || 'bank';
    var status = currentObjId ? getCompletionForRequest(currentObjId, requestType) : null;
    if (!status) return null;

    var lines = [];
    lines.push('── Datenraum ──');

    if (status.persoenlich.hatOrdner) {
      var pp = status.persoenlich.slot;
      lines.push('Persönlicher Ordner (' + providerLabel(pp.provider) + '):');
      lines.push('  ' + pp.url);
      if (status.persoenlich.confirmed.length > 0) {
        lines.push('  Bestätigte Dokumente:');
        status.persoenlich.confirmed.forEach(function(d) {
          lines.push('    ✓ ' + d.label);
          lines.push('      → ' + pp.url);
        });
      }
      if (status.persoenlich.missing.length > 0) {
        lines.push('  Noch ausstehend:');
        status.persoenlich.missing.forEach(function(d) { lines.push('    ○ ' + d.label); });
      }
      lines.push('');
    }

    if (status.objekt.hatOrdner) {
      var oo = status.objekt.slot;
      lines.push('Objekt-Ordner (' + providerLabel(oo.provider) + '):');
      lines.push('  ' + oo.url);
      if (status.objekt.confirmed.length > 0) {
        lines.push('  Bestätigte Dokumente:');
        status.objekt.confirmed.forEach(function(d) {
          lines.push('    ✓ ' + d.label);
          lines.push('      → ' + oo.url);
        });
      }
      if (status.objekt.missing.length > 0) {
        lines.push('  Noch ausstehend:');
        status.objekt.missing.forEach(function(d) { lines.push('    ○ ' + d.label); });
      }
    }

    if (!status.persoenlich.hatOrdner && !status.objekt.hatOrdner) return null;
    return lines.join('\n');
  }

  return {
    DOCS_PERSOENLICH: DOCS_PERSOENLICH,
    DOCS_OBJEKT: DOCS_OBJEKT,
    getAll: getAll,
    getPersoenlich: getPersoenlich,
    setPersoenlich: setPersoenlich,
    clearPersoenlich: clearPersoenlich,
    getObjektOrdner: getObjektOrdner,
    setObjektOrdner: setObjektOrdner,
    clearObjektOrdner: clearObjektOrdner,
    togglePersDoc: togglePersDoc,
    toggleObjDoc: toggleObjDoc,
    openPersoenlich: openPersoenlich,
    openObjekt: openObjekt,
    getCompletionForRequest: getCompletionForRequest,
    detectProvider: detectProvider,
    providerLabel: providerLabel,
    renderSettingsTab: renderSettingsTab,
    renderDealActionPanel: renderDealActionPanel,
    buildBankSnippet: buildBankSnippet,
    _editPers: _editPers,
    _editObj: _editObj,
    _closeEditModal: _closeEditModal,
    _removePersConfirm: _removePersConfirm,
    _removeObjConfirm: _removeObjConfirm,
    _switchObjekt: _switchObjekt,
    _togglePersFromUI: _togglePersFromUI,
    _togglePersFromPanel: _togglePersFromPanel,
    _toggleObjFromPanel: _toggleObjFromPanel,
    invalidateCache: _invalidateCache,
    refreshObjekteFromBackend: _refreshObjekteFromBackend,
    _toggleObjFromUI: _toggleObjFromUI
  };
})();
