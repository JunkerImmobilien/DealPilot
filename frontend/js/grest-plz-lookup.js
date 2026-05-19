/* V226: PLZ-Bundesland-Lookup für Grunderwerbsteuer
 * Stand: Mai 2026
 *
 * Quelle: https://www.gesetze-im-internet.de/grestg_1983/
 * Werte gelten ab 2024/2025 — bei späteren Änderungen anpassen.
 *
 * Logik: PLZ → erste Ziffer/Bereich → Bundesland → GrESt-Satz
 * Bei Mehrdeutigkeit (Grenzen) wird die häufigere Variante gewählt;
 * User kann manuell übersteuern.
 */
(function () {
  'use strict';

  // GrESt-Sätze pro Bundesland (Stand 05/2026)
  const GREST_RATES = {
    'BW': 5.0,   // Baden-Württemberg
    'BY': 3.5,   // Bayern
    'BE': 6.0,   // Berlin
    'BB': 6.5,   // Brandenburg
    'HB': 5.0,   // Bremen
    'HH': 5.5,   // Hamburg (seit 2023)
    'HE': 6.0,   // Hessen
    'MV': 6.0,   // Mecklenburg-Vorpommern
    'NI': 5.0,   // Niedersachsen
    'NW': 6.5,   // Nordrhein-Westfalen
    'RP': 5.0,   // Rheinland-Pfalz
    'SL': 6.5,   // Saarland
    'SN': 5.5,   // Sachsen (seit 2023)
    'ST': 5.0,   // Sachsen-Anhalt
    'SH': 6.5,   // Schleswig-Holstein
    'TH': 6.5,   // Thüringen
  };

  const BL_NAMES = {
    'BW': 'Baden-Württemberg',
    'BY': 'Bayern',
    'BE': 'Berlin',
    'BB': 'Brandenburg',
    'HB': 'Bremen',
    'HH': 'Hamburg',
    'HE': 'Hessen',
    'MV': 'Mecklenburg-Vorpommern',
    'NI': 'Niedersachsen',
    'NW': 'Nordrhein-Westfalen',
    'RP': 'Rheinland-Pfalz',
    'SL': 'Saarland',
    'SN': 'Sachsen',
    'ST': 'Sachsen-Anhalt',
    'SH': 'Schleswig-Holstein',
    'TH': 'Thüringen',
  };

  // PLZ-Ranges (vereinfacht; Quelle: Bundeszentralamt für Steuern / Wikipedia PLZ-Bereiche).
  // Format: [von, bis, BL-Kürzel]. Reihenfolge wichtig (erste Match gewinnt).
  // Vereinfachung: Wir nutzen 5-stellige Integer-Vergleiche.
  const PLZ_RANGES = [
    // 01000–09999 Sachsen
    [1000, 9999, 'SN'],
    // 10000–14999 Berlin (10xxx-14xxx) + teils Brandenburg (14xxx)
    [10000, 13999, 'BE'],
    [14000, 14199, 'BE'],
    [14200, 16999, 'BB'],
    // 17000–17999 Mecklenburg-Vorpommern (vorwiegend) + teils Brandenburg
    [17000, 17499, 'MV'],
    [17500, 17999, 'MV'],
    // 18000-19999 MV (teils SH bei 19xxx Grenze, aber 19xxx ist MV/Schwerin)
    [18000, 19999, 'MV'],
    // 20000-25999 Schleswig-Holstein und Hamburg
    [20000, 21149, 'HH'],   // Hamburg
    [21150, 21449, 'NI'],   // Niedersachsen Pendelbereich (Lüneburg etc.)
    [21450, 21929, 'SH'],   // S-H
    [21930, 22113, 'SH'],
    [22114, 22529, 'HH'],   // Hamburg
    [22530, 22999, 'SH'],
    [23000, 23999, 'SH'],
    [24000, 25999, 'SH'],
    // 26000-29999 Niedersachsen + Bremen
    [26000, 26999, 'NI'],
    [27000, 27499, 'HB'],   // Bremen-Stadt (28xxx primär, aber Bremerhaven 275xx)
    [27500, 27999, 'NI'],
    [28000, 28999, 'HB'],   // Bremen-Stadt
    [29000, 29999, 'NI'],
    // 30000-31999 Niedersachsen (Hannover Region)
    [30000, 31999, 'NI'],
    // 32000-33999 Niedersachsen + NRW (Ostwestfalen)
    [32000, 32849, 'NW'],   // NRW (Bielefeld-Region) — z.B. Hüllhorst 32609 ist NW
    [32850, 32849, 'NW'],
    [33000, 33999, 'NW'],
    // 34000-37999 Hessen + Niedersachsen + Sachsen-Anhalt
    [34000, 34329, 'HE'],
    [34330, 34399, 'NI'],
    [34400, 34629, 'HE'],
    [34630, 36399, 'HE'],
    [36400, 36469, 'TH'],
    [36470, 37199, 'HE'],
    [37200, 37999, 'NI'],
    // 38000-38999 Niedersachsen + Sachsen-Anhalt
    [38000, 38489, 'NI'],
    [38490, 38559, 'ST'],
    [38560, 38879, 'NI'],
    [38880, 38899, 'ST'],
    [38900, 39999, 'ST'],
    // 40000-48999 NRW
    [40000, 48999, 'NW'],
    // 49000-49999 NRW + Niedersachsen
    [49000, 49509, 'NW'],
    [49510, 49849, 'NI'],
    [49850, 49999, 'NI'],
    // 50000-53999 NRW (Köln/Bonn) + Rheinland-Pfalz
    [50000, 53999, 'NW'],
    // 54000-56999 Rheinland-Pfalz + Saarland
    [54000, 54439, 'RP'],
    [54440, 54559, 'RP'],
    [54560, 54669, 'RP'],
    [54670, 54699, 'RP'],
    [55000, 55299, 'RP'],
    [55300, 55999, 'RP'],
    [56000, 56999, 'RP'],
    // 57000-57999 NRW + RP
    [57000, 57489, 'NW'],
    [57500, 57647, 'RP'],
    [57648, 57939, 'RP'],
    // 58000-59999 NRW
    [58000, 59999, 'NW'],
    // 60000-65999 Hessen
    [60000, 65999, 'HE'],
    // 66000-66999 Saarland + RP
    [66000, 66459, 'SL'],
    [66460, 66509, 'RP'],
    [66510, 66839, 'SL'],
    [66840, 66999, 'SL'],
    // 67000-67999 RP
    [67000, 67999, 'RP'],
    // 68000-69999 BW + Hessen + RP (Mannheim/Heidelberg-Region)
    [68000, 68309, 'BW'],
    [68310, 68649, 'HE'],
    [68650, 69240, 'BW'],
    [69241, 69434, 'BW'],
    [69435, 69517, 'HE'],
    [69518, 69999, 'BW'],
    // 70000-89999 Baden-Württemberg + Bayern
    [70000, 79999, 'BW'],
    [80000, 87999, 'BY'],
    [88000, 88099, 'BW'],
    [88100, 88499, 'BW'],
    [88500, 88799, 'BW'],
    [88800, 88899, 'BW'],
    [89000, 89089, 'BY'],
    [89090, 89099, 'BW'],
    [89100, 89299, 'BY'],
    [89300, 89619, 'BW'],
    [89620, 89999, 'BY'],
    // 90000-96999 Bayern
    [90000, 96999, 'BY'],
    // 97000-97999 BY + Hessen
    [97000, 97999, 'BY'],
    // 98000-99999 Thüringen + Sachsen
    [98000, 99999, 'TH'],
  ];

  function lookupBundeslandByPlz(plz) {
    if (!plz) return null;
    const n = parseInt(String(plz).replace(/\D/g, ''), 10);
    if (!isFinite(n) || n < 1000 || n > 99999) return null;
    // Blacklist: 00000, 12345, 99999 etc.
    if (n === 0 || n === 12345) return null;
    for (const [from, to, bl] of PLZ_RANGES) {
      if (n >= from && n <= to) return bl;
    }
    return null;
  }

  function grestForPlz(plz) {
    const bl = lookupBundeslandByPlz(plz);
    if (!bl) return null;
    return { bundesland: bl, name: BL_NAMES[bl], rate: GREST_RATES[bl] };
  }

  // Export to window
  window.DealPilotGrest = {
    lookupBundesland: lookupBundeslandByPlz,
    forPlz: grestForPlz,
    rates: GREST_RATES,
    names: BL_NAMES,
  };

  // Auto-Wire: bei PLZ-Eingabe in Tab Objekt → Tab Investition GrESt updaten
  // (nur wenn User die GrESt nicht manuell überschrieben hat)
  function bindPlzListener() {
    const plzInput = document.getElementById('plz');
    const gestPctInput = document.getElementById('gest_p');
    if (!plzInput || !gestPctInput) return;

    // Marker: hat der User die GrESt schon manuell geändert?
    // Wir tracken das über data-user-edited
    gestPctInput.addEventListener('input', function () {
      gestPctInput.dataset.userEdited = '1';
    });

    function applyGrestFromPlz() {
      const info = grestForPlz(plzInput.value);
      if (!info) return;
      // Nur überschreiben wenn User noch nicht manuell editiert hat
      if (gestPctInput.dataset.userEdited === '1') return;
      const cur = parseFloat(String(gestPctInput.value).replace(',', '.'));
      // Nur überschreiben wenn aktueller Wert == Default oder leer
      if (isNaN(cur) || Math.abs(cur - 6.5) < 0.01 || cur === 0) {
        gestPctInput.value = info.rate.toFixed(2);
        // Trigger Sync auf Euro-Feld
        if (typeof window.syncCostPct === 'function') {
          window.syncCostPct('gest');
        }
        // Hinweis-Badge (optional, falls vorhanden)
        showGrestHint(info);
      }
    }

    function showGrestHint(info) {
      // Versuche einen Hint neben das GrESt-Feld zu setzen
      const parent = gestPctInput.closest('.f');
      if (!parent) return;
      let hint = parent.querySelector('.grest-auto-hint');
      if (!hint) {
        hint = document.createElement('span');
        hint.className = 'grest-auto-hint hint';
        hint.style.cssText = 'display:block;margin-top:4px;font-size:11px;color:var(--gold)';
        parent.appendChild(hint);
      }
      hint.textContent = `Aus PLZ ermittelt: ${info.name} ${info.rate.toFixed(1)}%`;
    }

    plzInput.addEventListener('change', applyGrestFromPlz);
    plzInput.addEventListener('blur', applyGrestFromPlz);
    // Auch bei initialer Befüllung (Objekt laden)
    setTimeout(applyGrestFromPlz, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPlzListener);
  } else {
    bindPlzListener();
  }
})();
