/* V257-07: zvE-Manager mit History und Bi-Sync
 *
 * Speichert zu versteuerndes Einkommen (zvE) zentral im InvestmentProfile.
 * Bi-direktional: Objekt-zvE-Feld <-> Profil
 * History pro Jahr fuer Steuerberechnung historischer Jahre.
 */
(function() {
  'use strict';

  function getProfile() {
    if (window.DealPilotInvestmentProfile && DealPilotInvestmentProfile.load) {
      try { return DealPilotInvestmentProfile.load() || {}; } catch(e) {}
    }
    return {};
  }

  function saveProfile(p) {
    if (window.DealPilotInvestmentProfile && DealPilotInvestmentProfile.save) {
      try { DealPilotInvestmentProfile.save(p); } catch(e) {
        console.warn('[V257-07] Profile-Save fehlgeschlagen:', e.message);
      }
    }
  }

  function parseDe(s) {
    if (typeof s === 'number') return s;
    if (!s) return 0;
    s = String(s).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  /** Aktueller zvE-Wert aus Profil. Fallback: 65891 (Default). */
  function getCurrent() {
    var p = getProfile();
    if (typeof p.zve_current === 'number' && p.zve_current > 0) return p.zve_current;
    // Migration: Falls History existiert, juengsten nehmen
    if (Array.isArray(p.zve_history) && p.zve_history.length > 0) {
      var sorted = p.zve_history.slice().sort(function(a,b) {
        return (b.valid_from || '').localeCompare(a.valid_from || '');
      });
      return sorted[0].amount;
    }
    return 65891;
  }

  /** zvE-Wert fuer ein bestimmtes Jahr aus History.
   *  Sucht den History-Eintrag mit groesstem valid_from <= year-12-31.
   *  Fallback: zve_current.
   */
  function getForYear(year) {
    var p = getProfile();
    var yearEnd = year + '-12-31';
    if (Array.isArray(p.zve_history) && p.zve_history.length > 0) {
      var match = null;
      p.zve_history.forEach(function(e) {
        if (e.valid_from && e.valid_from <= yearEnd) {
          if (!match || e.valid_from > match.valid_from) match = e;
        }
      });
      if (match) return match.amount;
    }
    return getCurrent();
  }

  /** Setzt aktuellen zvE und legt History-Eintrag mit heute an. */
  function setCurrent(amount) {
    amount = parseDe(amount);
    if (amount <= 0) return;
    var p = getProfile();
    p.zve_current = amount;
    if (!Array.isArray(p.zve_history)) p.zve_history = [];
    // History-Eintrag fuer heute (oder ueberschreibe falls heute schon einer)
    var today = todayISO();
    var existing = p.zve_history.find(function(e) { return e.valid_from === today; });
    if (existing) {
      existing.amount = amount;
    } else {
      p.zve_history.push({ amount: amount, valid_from: today });
    }
    saveProfile(p);
    console.log('[V257-07] zvE gesetzt:', amount, 'EUR ab', today);
  }

  /** Manueller History-Eintrag (z.B. nachtraeglich altes Jahr eintragen). */
  function addHistoryEntry(amount, validFrom) {
    amount = parseDe(amount);
    if (amount <= 0) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) return false;
    var p = getProfile();
    if (!Array.isArray(p.zve_history)) p.zve_history = [];
    var existing = p.zve_history.find(function(e) { return e.valid_from === validFrom; });
    if (existing) {
      existing.amount = amount;
    } else {
      p.zve_history.push({ amount: amount, valid_from: validFrom });
    }
    // Sortiert nach valid_from
    p.zve_history.sort(function(a,b) { return (a.valid_from||'').localeCompare(b.valid_from||''); });
    saveProfile(p);
    return true;
  }

  function removeHistoryEntry(validFrom) {
    var p = getProfile();
    if (!Array.isArray(p.zve_history)) return false;
    var before = p.zve_history.length;
    p.zve_history = p.zve_history.filter(function(e) { return e.valid_from !== validFrom; });
    saveProfile(p);
    return p.zve_history.length < before;
  }

  /** Bi-Sync: User tippt im Objekt zvE-Feld → ins Profil schreiben. */
  function onObjectInput(value) {
    var amount = parseDe(value);
    if (amount > 0) setCurrent(amount);
  }

  /** Beim Objekt-Render: zvE-Feld aus Profil befuellen falls leer. */
  function syncFromProfile() {
    var el = document.getElementById('zve');
    if (!el) return;
    if (!el.value || el.value.trim() === '') {
      el.value = getCurrent().toLocaleString('de-DE');
    }
  }

  /** History-Editor fuer das Profil-Pane. */
  function renderHistoryEditor() {
    var p = getProfile();
    var history = (Array.isArray(p.zve_history) ? p.zve_history : []).slice().sort(function(a,b) {
      return (b.valid_from||'').localeCompare(a.valid_from||'');
    });
    var current = getCurrent();

    var html = '<div class="zve-editor-wrap" style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(201,168,76,0.18)">';
    html += '<div style="font-family:var(--font-main,\'IBM Plex Sans\',sans-serif);font-weight:600;font-size:14px;color:var(--ch,#2A2727);margin-bottom:4px">Zu versteuerndes Einkommen (zvE)</div>';
    html += '<div style="font-size:12.5px;color:var(--muted,#7A7370);margin-bottom:12px">Dein zvE wird zentral hier gespeichert und in alle Objekte uebernommen. Fuer historische Jahre (z.B. vor einer Lohnerhoehung) kannst du eigene Eintraege hinzufuegen.</div>';

    html += '<div style="margin-bottom:14px"><label style="font-size:12px;color:var(--muted,#7A7370);display:block;margin-bottom:4px">Aktuelles zvE / Jahr</label>';
    html += '<div style="display:flex;gap:8px;align-items:center"><input type="text" id="zve-profile-current" inputmode="decimal" value="' + current.toLocaleString('de-DE') + '" placeholder="65000" style="height:38px;padding:0 11px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;font-family:var(--font-main,\'IBM Plex Sans\',sans-serif);width:200px;background:#fff" />';
    html += '<button type="button" onclick="DealPilotZvE.saveCurrentFromInput()" style="padding:10px 16px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-family:var(--font-main,\'IBM Plex Sans\',sans-serif);font-size:13px;font-weight:500;cursor:pointer">Speichern</button></div></div>';

    html += '<div style="font-size:12px;color:var(--muted,#7A7370);margin-bottom:6px">Historische Eintraege</div>';
    if (history.length === 0) {
      html += '<div style="font-size:13px;color:var(--muted,#7A7370);font-style:italic;padding:8px 0">Keine historischen Eintraege. Klick "Hinzufuegen" um z.B. den zvE vor einer Lohnerhoehung einzutragen.</div>';
    } else {
      html += '<div style="border:1px solid rgba(201,168,76,0.18);border-radius:8px;overflow:hidden;margin-bottom:10px">';
      history.forEach(function(e, i) {
        var rowBg = i % 2 === 0 ? '#fff' : 'rgba(201,168,76,0.04)';
        html += '<div style="padding:8px 12px;display:flex;align-items:center;justify-content:space-between;background:' + rowBg + ';border-bottom:1px solid rgba(201,168,76,0.10)">';
        html += '<div style="font-size:13px"><strong style="font-weight:600">' + e.amount.toLocaleString('de-DE') + ' €</strong> <span style="color:var(--muted,#7A7370);margin-left:8px">ab ' + (e.valid_from || '?') + '</span></div>';
        html += '<button type="button" onclick="DealPilotZvE.removeAndRefresh(\'' + e.valid_from + '\')" style="padding:6px 10px;background:#fff;color:var(--red,#B8625C);border:1px solid rgba(184,98,92,0.30);border-radius:6px;font-size:11.5px;cursor:pointer">Entfernen</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px;color:var(--gold,#C9A84C);font-weight:500;padding:4px 0">+ Historischen Eintrag hinzufuegen</summary>';
    html += '<div style="padding:10px 0;display:flex;gap:8px;align-items:end;flex-wrap:wrap">';
    html += '<div><label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Betrag (€)</label><input type="text" id="zve-history-amount" inputmode="decimal" placeholder="55000" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:140px" /></div>';
    html += '<div><label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Gueltig ab</label><input type="date" id="zve-history-from" value="2024-01-01" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px" /></div>';
    html += '<button type="button" onclick="DealPilotZvE.addAndRefresh()" style="padding:9px 14px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;font-weight:500;cursor:pointer">Hinzufuegen</button>';
    html += '</div></details>';

    html += '</div>';
    return html;
  }

  function saveCurrentFromInput() {
    var el = document.getElementById('zve-profile-current');
    if (!el) return;
    setCurrent(el.value);
    if (typeof toast === 'function') toast('zvE gespeichert: ' + getCurrent().toLocaleString('de-DE') + ' €');
    syncFromProfile();
    refreshEditor();
    if (typeof calc === 'function') try { calc(); } catch(e) {}
  }

  function addAndRefresh() {
    var amtEl = document.getElementById('zve-history-amount');
    var fromEl = document.getElementById('zve-history-from');
    if (!amtEl || !fromEl) return;
    var ok = addHistoryEntry(amtEl.value, fromEl.value);
    if (ok) {
      if (typeof toast === 'function') toast('Eintrag hinzugefuegt');
      refreshEditor();
    } else {
      if (typeof toast === 'function') toast('Eintrag fehlgeschlagen: pruefe Betrag und Datum');
    }
  }

  function removeAndRefresh(validFrom) {
    if (!confirm('Eintrag vom ' + validFrom + ' entfernen?')) return;
    removeHistoryEntry(validFrom);
    refreshEditor();
  }

  function refreshEditor() {
    var host = document.querySelector('.zve-editor-wrap');
    if (host && host.parentNode) {
      var newDiv = document.createElement('div');
      newDiv.innerHTML = renderHistoryEditor();
      host.parentNode.replaceChild(newDiv.firstChild, host);
    }
  }

  window.DealPilotZvE = {
    getCurrent: getCurrent,
    setCurrent: setCurrent,
    getForYear: getForYear,
    addHistoryEntry: addHistoryEntry,
    removeHistoryEntry: removeHistoryEntry,
    onObjectInput: onObjectInput,
    syncFromProfile: syncFromProfile,
    renderHistoryEditor: renderHistoryEditor,
    saveCurrentFromInput: saveCurrentFromInput,
    addAndRefresh: addAndRefresh,
    removeAndRefresh: removeAndRefresh,
    refreshEditor: refreshEditor,
    _meta: 'V257-07'
  };

  // Beim Laden: zvE-Feld im Objekt aus Profil befuellen falls leer
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFromProfile);
  } else {
    setTimeout(syncFromProfile, 200);
  }

  // V259-12: Migration bestehender zve_history aus InvestmentProfile in tax_periods
  async function migrateToTaxPeriods() {
    // V264-02: Session-Lock - laeuft nur einmal pro Tab
    if (window._tax_migration_done) return false;
    window._tax_migration_done = true;
    try {
      if (!window.DealPilotTaxPeriods) return false;
      const p = getProfile();
      const history = Array.isArray(p.zve_history) ? p.zve_history : [];
      const current = p.zve_current;
      const flag = p._zve_migrated_to_tax_periods;
      if (flag) return false; // bereits migriert
      
      // Existieren schon tax_periods?
      const existing = await DealPilotTaxPeriods.loadAll(true);
      if (existing.length > 0) {
        // Markiere als migriert, ohne Daten zu duplizieren
        p._zve_migrated_to_tax_periods = true;
        saveProfile(p);
        return false;
      }
      
      // Migration: jeden History-Eintrag in tax_periods kopieren
      const sorted = history.slice().sort((a,b) => (a.valid_from||'').localeCompare(b.valid_from||''));
      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const nextFrom = sorted[i+1] ? sorted[i+1].valid_from : null;
        let validTo = null;
        if (nextFrom) {
          // valid_to = day before next valid_from
          const d = new Date(nextFrom);
          d.setDate(d.getDate() - 1);
          validTo = d.toISOString().split('T')[0];
        }
        try {
          // V264-02: Pre-Check - existiert schon eine Periode mit diesem valid_from?
          const existsCheck = (await DealPilotTaxPeriods.loadAll()).find(
            p => p.valid_from === entry.valid_from
          );
          if (existsCheck) {
            console.log('[V264-02] Skip Migration - Periode existiert:', entry.valid_from);
            continue;
          }
          await DealPilotTaxPeriods.create({
            valid_from: entry.valid_from,
            valid_to: validTo,
            zve: entry.amount,
            reason: 'Migriert aus History',
            note: ''
          });
        } catch(e) {
          // V264-02: Duplikat-Fehler still ignorieren
          if (!/already exists|duplicate|409/i.test(e.message || '')) {
            console.warn('[V259-12] Migration-Eintrag fehlgeschlagen:', e.message);
          }
        }
      }
      
      // Wenn keine History aber aktueller Wert → einen Eintrag heute
      if (sorted.length === 0 && typeof current === 'number' && current > 0) {
        const today = todayISO();
        try {
          // V264-02: Pre-Check
          const existsCheck = (await DealPilotTaxPeriods.loadAll()).find(
            p => p.valid_from === today
          );
          if (!existsCheck) {
            await DealPilotTaxPeriods.create({
              valid_from: today,
              valid_to: null,
              zve: current,
              reason: 'Migriert aus Profil',
              note: 'Initialer Eintrag aus DealPilotZvE-Profil'
            });
          }
        } catch(e) {
          if (!/already exists|duplicate|409/i.test(e.message || '')) {
            console.warn('[V259-12] Initial-Eintrag fehlgeschlagen:', e.message);
          }
        }
      }
      
      p._zve_migrated_to_tax_periods = true;
      saveProfile(p);
      console.log('[V259-12] Migration zu tax_periods abgeschlossen');
      return true;
    } catch(e) {
      console.warn('[V259-12] Migration:', e.message);
      return false;
    }
  }

  window.DealPilotZvE.migrateToTaxPeriods = migrateToTaxPeriods;
  
  // Auto-Migration 2 Sekunden nach Init
  setTimeout(() => {
    if (window.DealPilotTaxPeriods) migrateToTaxPeriods();
  }, 2000);

})();
