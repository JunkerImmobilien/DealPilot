/* V259-07: Auto-Sync — Hinweis wenn zvE im Objekt-Feld vom aktiven Steuerzeitraum abweicht */
(function() {
  'use strict';

  function parseDe(s) {
    if (typeof s === 'number') return s;
    if (!s) return 0;
    s = String(s).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function getRelevantDate() {
    // Bevorzugt wirtschaftlicher Uebergang, sonst Kaufdatum, sonst heute
    const wuEl = document.getElementById('wirtschaftlicher_uebergang');
    const kdEl = document.getElementById('purchase_date') || document.getElementById('kaufdatum');
    if (wuEl && wuEl.value) return wuEl.value;
    if (kdEl && kdEl.value) return kdEl.value;
    const t = new Date();
    return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
  }

  async function checkAndPrompt(value) {
    if (!window.DealPilotTaxPeriods) return;
    const newZve = parseDe(value);
    if (newZve <= 0) return;
    
    const date = getRelevantDate();
    const period = await DealPilotTaxPeriods.getForDate(date);
    
    if (!period) {
      // Kein aktiver Zeitraum → Vorschlag: neuen Zeitraum mit diesem zvE anlegen
      if (confirm('Für den Zeitraum um ' + date + ' ist noch kein Steuerzeitraum hinterlegt. Soll dieser zvE-Wert (' + newZve.toLocaleString('de-DE') + ' €) als neuer Steuerzeitraum gespeichert werden?')) {
        try {
          await DealPilotTaxPeriods.create({
            valid_from: date,
            valid_to: null,
            zve: newZve,
            reason: 'Auto-Anlage aus Objekt',
            note: 'Automatisch beim Eintrag im Steuer-Tab erstellt'
          });
          if (typeof toast === 'function') toast('Steuerzeitraum angelegt: ' + newZve.toLocaleString('de-DE') + ' €');
        } catch(e) {
          console.warn('[V259-07]', e.message);
        }
      }
      return;
    }
    
    // Aktiver Zeitraum gefunden — Vergleich
    if (period.zve === newZve) return;  // identisch, kein Hinweis
    
    const diff = newZve - period.zve;
    const sign = diff > 0 ? '+' : '';
    const msg = 'Für den Zeitraum ' + period.valid_from + ' – ' + (period.valid_to || 'laufend') + ' ist aktuell zvE = ' + period.zve.toLocaleString('de-DE') + ' € hinterlegt.\n\n' +
                'Du hast ' + newZve.toLocaleString('de-DE') + ' € eingetragen (Δ ' + sign + diff.toLocaleString('de-DE') + ' €).\n\n' +
                'Möchtest du den Steuerzeitraum aktualisieren?';
    if (confirm(msg)) {
      try {
        await DealPilotTaxPeriods.update(period.id, {
          valid_from: period.valid_from,
          valid_to: period.valid_to,
          zve: newZve,
          reason: period.reason,
          note: period.note
        });
        if (typeof toast === 'function') toast('Steuerzeitraum aktualisiert: ' + newZve.toLocaleString('de-DE') + ' €');
      } catch(e) {
        console.warn('[V259-07]', e.message);
      }
    }
  }

  window.DealPilotTaxPeriodsSync = {
    checkAndPrompt,
    getRelevantDate
  };
})();
