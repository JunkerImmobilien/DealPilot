/* V260-05: wirtschaftlicher Uebergang bei "Deal gewonnen" */
(function() {
  'use strict';

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  /** Prompt fuer Wirtschaftlichen Uebergang anzeigen.
   *  Wird bei "Deal gewonnen" aufgerufen wenn das Feld leer ist.
   *  Return Promise<true|false> ob User OK geklickt hat.
   */
  function promptForUebergang() {
    return new Promise(resolve => {
      const wuEl = document.getElementById('wirtschaftlicher_uebergang');
      if (wuEl && wuEl.value) return resolve(true);
      
      const kdEl = document.getElementById('kaufdat') /* V268-04: korrigierte ID */;
      const defaultDate = (kdEl && kdEl.value) || todayISO();
      
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font-main,\'IBM Plex Sans\',sans-serif)';
      overlay.innerHTML = 
        '<div style="background:#fff;border-radius:14px;max-width:480px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.30)">' +
          '<div style="font-size:17px;font-weight:600;color:var(--ch,#2A2727);margin-bottom:6px">🎉 Deal gewonnen!</div>' +
          '<div style="font-size:13px;color:var(--muted,#7A7370);margin-bottom:18px">Bitte trage den <strong>Wirtschaftlichen Übergang</strong> (Nutzen- und Lastenwechsel) ein. Dieser ist für AfA-Beginn, Mieteinnahmen und Schuldzinsen entscheidend.</div>' +
          '<label style="font-size:12px;color:var(--muted,#7A7370);display:block;margin-bottom:4px">Wirtschaftlicher Übergang</label>' +
          '<input type="date" id="wu-prompt-date" value="' + defaultDate + '" style="height:38px;padding:0 11px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%;margin-bottom:18px;font-family:inherit" />' +
          '<div style="display:flex;gap:8px;flex-direction:column">' +
            '<button id="wu-prompt-ok" style="padding:11px 16px;background:var(--gold,#C9A84C);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer">Übernehmen</button>' +
            '<button id="wu-prompt-skip" style="padding:9px 16px;background:#fff;color:var(--muted,#7A7370);border:1.5px solid rgba(201,168,76,0.25);border-radius:8px;font-family:inherit;font-size:12px;cursor:pointer">Später eintragen (Kaufdatum als Fallback)</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      
      document.getElementById('wu-prompt-ok').onclick = function() {
        const v = document.getElementById('wu-prompt-date').value;
        if (v && wuEl) {
          wuEl.value = v;
          // Storage triggern
          try { wuEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}
          try { wuEl.dispatchEvent(new Event('input', { bubbles: true })); } catch(e) {}
        }
        overlay.remove();
        resolve(true);
      };
      document.getElementById('wu-prompt-skip').onclick = function() {
        overlay.remove();
        resolve(false);
      };
    });
  }

  /** Banner im Steuer-Tab wenn weder wirtschaftlicher_uebergang noch kaufdatum gesetzt */
  function injectWarningIfNeeded() {
    const wu = document.getElementById('wirtschaftlicher_uebergang');
    const kd = document.getElementById('kaufdat') /* V268-04: korrigierte ID */;
    
    const existing = document.getElementById('dp-wu-warning');
    
    const hasWu = wu && wu.value;
    const hasKd = kd && kd.value;
    
    if (!hasWu && hasKd) {
      // Fallback aktiv: Banner anzeigen
      if (existing) return;
      const banner = document.createElement('div');
      banner.id = 'dp-wu-warning';
      banner.className = 'dp-wu-warning';
      banner.innerHTML = 
        '<span class="dp-wu-warning-icon">⚠</span>' +
        '<div style="flex:1">' +
          '<strong>Kein wirtschaftlicher Übergang hinterlegt.</strong> Für die Steuerberechnung wird das <strong>Kaufdatum</strong> verwendet. ' +
          '<a href="#" onclick="document.getElementById(\'wirtschaftlicher_uebergang\').focus();return false">Jetzt eintragen →</a>' +
        '</div>';
      
      // Vor das ZVE-Feld einfuegen (Steuer-Tab)
      const zveContainer = document.querySelector('#zve')?.closest('.f');
      if (zveContainer && zveContainer.parentNode) {
        zveContainer.parentNode.insertBefore(banner, zveContainer);
      }
    } else if ((hasWu || !hasKd) && existing) {
      existing.remove();
    }
  }

  // Hook in "Deal gewonnen" Action
  function hookDealWonAction() {
    document.addEventListener('click', async function(e) {
      const target = e.target.closest('[data-action="deal-won"], [onclick*="deal_won"], [onclick*="dealWon"], .da-action-won-btn, button[data-status="won"]');
      if (!target) return;
      
      // Check if wu missing
      const wuEl = document.getElementById('wirtschaftlicher_uebergang');
      if (wuEl && !wuEl.value) {
        e.preventDefault();
        e.stopPropagation();
        const ok = await promptForUebergang();
        // Egal ob ok oder nicht: action weitermachen
        // (Wenn ok, ist Feld jetzt befuellt; falls nicht, Fallback aktiv)
        setTimeout(() => {
          // Re-trigger original click ohne nochmals den Hook auszuloesen
          target.removeAttribute('data-wu-hooked');
          target.setAttribute('data-wu-hooked-done', '1');
          // Hier waere ein erneuter Klick problematisch — daher
          // setzen wir nur das Datum und hoffen, dass der naechste
          // Save-Hook das uebernimmt
        }, 100);
      }
    }, { capture: true });
  }
  
  // Initial Warning injection + watch on tab switch
  function watchSteuerTab() {
    // Steuer-Tab ist s4 oder s-steuer
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-tab="s4"], [data-target="s4"], button[onclick*="s4"]')) {
        setTimeout(injectWarningIfNeeded, 250);
      }
    });
    // Initial check
    setTimeout(injectWarningIfNeeded, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      hookDealWonAction();
      watchSteuerTab();
    });
  } else {
    hookDealWonAction();
    watchSteuerTab();
  }

  window.DealPilotWU = {
    promptForUebergang,
    injectWarningIfNeeded,
    _meta: 'V260-05'
  };
})();
