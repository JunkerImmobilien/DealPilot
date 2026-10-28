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

  // GrESt-Sätze pro Bundesland (Stand 05/2026; v2207: HB 5,5 seit 07/2025, TH 5,0 seit 01/2024 - beide waren falsch)
  const GREST_RATES = {
    'BW': 5.0,   // Baden-Württemberg
    'BY': 3.5,   // Bayern
    'BE': 6.0,   // Berlin
    'BB': 6.5,   // Brandenburg
    'HB': 5.5,   // Bremen (seit 01.07.2025; v2207)
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
    'TH': 5.0,   // Thüringen (seit 01.01.2024; v2207)
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
    /* ── v1823 · DIE LEITZONE 0 SIND VIER BUNDESLAENDER, NICHT EINES ───
     *
     * Hier stand [1000, 9999, 'SN'] — die ganze Leitzone 0 als Sachsen.
     * GEFUNDEN am 04.10.2026 bei einer Gegenprobe an echten Postleitzahlen
     * fuer den Telegram-Bot:
     *
     *   06184 Kabelsketal  ->  SN 5,5 %   richtig ist  ST 5,0 %
     *   07743 Jena         ->  SN 5,5 %   richtig ist  TH 6,5 %
     *   03046 Cottbus      ->  SN 5,5 %   richtig ist  BB 6,5 %
     *
     * Das ist kein Schoenheitsfehler: dieses Modul belegt bei jeder
     * PLZ-Eingabe das Feld `gest_p` vor (bindPlzListener unten). Wer in
     * Jena ein Objekt fuer 300.000 Euro rechnet, bekam 16.500 statt
     * 19.500 Euro Grunderwerbsteuer — 3.000 Euro zu wenig in der
     * Gesamtinvestition, und damit in Rendite, Cashflow und Score.
     *
     *   > Ein Satz, der fuer die halbe Leitzone stimmt, sieht genauso aus
     *   > wie einer, der fuer die ganze stimmt. Auffallen wuerde er erst
     *   > beim Finanzamt.
     *
     * Die Zuordnung der Leitzone 0 (05 ist nicht vergeben):
     *   01, 02      Sachsen            Dresden, Bautzen, Goerlitz
     *   03          Brandenburg        Cottbus, Lausitz
     *   04          Sachsen            Leipzig
     *   04900-04938 Brandenburg        Herzberg/Elster, Bad Liebenwerda
     *   06          Sachsen-Anhalt     Halle, Merseburg, Dessau
     *   07          Thueringen         Jena, Gera, Rudolstadt
     *   08, 09      Sachsen            Zwickau, Plauen, Chemnitz
     *
     * Die Reihenfolge zaehlt: der engere Bereich 04900-04938 steht VOR
     * dem weiteren 04000-04999, weil der erste Treffer gilt. */
    /* v3029-import · Die Bereiche ab hier sind an echten Postleitzahlen nachgemessen
       (140 Stichproben, tools: Agentenlauf 28.10.2026). Bis v3028 lagen 23 davon im
       falschen Land, u. a. Osnabrueck/Vechta/Nordhorn als NW (6,5 statt 5,0), Aschaffenburg
       und Miltenberg als HE (6,0 statt 3,5), Ulm/Wertheim/Tauberbischofsheim als BY
       (3,5 statt 5,0), Goettingen als HE, Bremerhaven als NI. Schmale Ausnahmen stehen
       VOR dem weiten Bereich (erster Treffer gilt). Grenzorte mit geteilter PLZ bleiben
       eine Naeherung - deshalb zeigt das Feld „Aus PLZ ermittelt: <Land>". */
    [1940, 1999, 'BB'],     // Ruhland, Senftenberg, Lauchhammer, Schipkau
    [1000, 2999, 'SN'],     // Dresden, Bautzen, Goerlitz
    [3000, 3999, 'BB'],     // Cottbus und die Lausitz
    [4600, 4639, 'TH'],     // Altenburger Land
    [4895, 4938, 'BB'],     // Falkenberg, Herzberg/Elster, Elsterwerda — VOR 04000-04999
    [4000, 4999, 'SN'],     // Leipzig
    [6556, 6578, 'TH'],     // Kyffhaeuserkreis (Artern, Bad Frankenhausen)
    [6000, 6999, 'ST'],     // Halle, Merseburg, Dessau
    [7919, 7919, 'SN'], [7952, 7952, 'SN'], [7985, 7985, 'SN'],   // Pausa, Elsterberg
    [7000, 7999, 'TH'],     // Jena, Gera, Rudolstadt
    [8000, 9999, 'SN'],     // Zwickau, Plauen, Chemnitz
    [12529, 12529, 'BB'],   // Schoenefeld
    [10000, 14199, 'BE'],
    [14200, 16999, 'BB'],
    [17261, 17291, 'BB'], [17326, 17326, 'BB'], [17337, 17337, 'BB'],   // Templin, Lychen, Prenzlau, Bruessow, Uckerland
    [17000, 18999, 'MV'],
    [19273, 19273, 'NI'],   // Amt Neuhaus
    [19307, 19369, 'BB'],   // Lenzen, Wittenberge, Perleberg, Karstaedt
    [19000, 19999, 'MV'],
    [20000, 21149, 'HH'],   // Hamburg
    [21150, 21449, 'NI'],   // Seevetal, Winsen, Lueneburg, Buchholz
    [21450, 21529, 'SH'],   // Reinbek, Lauenburg, Schwarzenbek, Geesthacht, Glinde
    [21530, 21999, 'NI'],   // Buxtehude, Stade, Otterndorf
    [22000, 22799, 'HH'],   // Hamburg
    [22800, 22999, 'SH'],   // Norderstedt, Wedel, Ahrensburg
    [23920, 23999, 'MV'],   // Schoenberg, Grevesmuehlen, Wismar
    [23000, 25999, 'SH'],
    [26000, 26999, 'NI'],
    [27498, 27498, 'SH'],   // Helgoland
    [27499, 27499, 'HH'],   // Neuwerk
    [27500, 27580, 'HB'],   // Bremerhaven
    [27000, 27999, 'NI'],   // Verden, Rotenburg, Cuxhaven, Delmenhorst
    [28000, 28779, 'HB'],   // Bremen
    [28780, 28999, 'NI'],   // Stuhr, Achim, Weyhe, Syke, Lilienthal
    [29410, 29416, 'ST'],   // Salzwedel
    [29000, 31999, 'NI'],
    [32000, 33999, 'NW'],   // Ostwestfalen-Lippe, Bielefeld, Paderborn
    [34346, 34355, 'NI'],   // Hann. Muenden, Staufenberg
    [34400, 34439, 'NW'],   // Warburg, Marsberg, Borgentreich
    [34000, 36399, 'HE'],
    [36400, 36469, 'TH'],   // Vacha, Bad Salzungen
    [36470, 36999, 'HE'],
    [37200, 37299, 'HE'],   // Witzenhausen, Hess. Lichtenau, Eschwege
    [37300, 37359, 'TH'],   // Eichsfeld
    [37670, 37671, 'NW'], [37688, 37688, 'NW'], [37696, 37696, 'NW'],   // Hoexter, Beverungen, Marienmuenster
    [37000, 37999, 'NI'],   // Goettingen, Northeim, Osterode, Holzminden
    [38486, 38489, 'ST'],   // Kloetze, Beetzendorf
    [38820, 38999, 'ST'],   // Halberstadt, Wernigerode
    [38000, 38819, 'NI'],   // Braunschweig, Wolfsburg, Helmstedt, Gifhorn, Goslar
    [39000, 39999, 'ST'],
    [48455, 48465, 'NI'],   // Bad Bentheim, Schuettorf
    [48479, 48484, 'NI'],   // Spelle
    [48486, 48492, 'NI'],   // Emsbueren
    [48499, 48531, 'NI'],   // Salzbergen, Nordhorn
    [40000, 48999, 'NW'],
    [49000, 49459, 'NI'],   // Osnabrueck, Melle, Diepholz, Vechta
    [49460, 49549, 'NW'],   // Ibbenbueren, Mettingen, Lotte, Lengerich, Tecklenburg
    [49550, 49999, 'NI'],   // Bramsche, Quakenbrueck, Meppen
    [51598, 51598, 'RP'],   // Friesenhagen
    [53400, 53599, 'RP'],   // Remagen, Bad Neuenahr-Ahrweiler, Sinzig, Linz
    [53619, 53619, 'RP'],   // Rheinbreitbach
    [50000, 53999, 'NW'],
    [54000, 56999, 'RP'],
    [57000, 57489, 'NW'],   // Siegen, Olpe
    [57490, 57999, 'RP'],   // Betzdorf, Altenkirchen, Hachenburg
    [58000, 59999, 'NW'],
    [63739, 63939, 'BY'],   // Aschaffenburg, Alzenau, Miltenberg, Amorbach
    [65558, 65558, 'RP'], [65582, 65582, 'RP'], [65623, 65626, 'RP'], [65629, 65629, 'RP'],   // Rhein-Lahn
    [60000, 65999, 'HE'],
    [66480, 66509, 'RP'],   // Zweibruecken, Contwig
    [66840, 66999, 'RP'],   // Landstuhl, Kusel, Pirmasens
    [66000, 66839, 'SL'],
    [67000, 67999, 'RP'],
    [68519, 68519, 'HE'],   // Viernheim
    [68600, 68649, 'HE'],   // Lampertheim, Buerstadt, Biblis
    [69434, 69434, 'HE'],   // Hirschhorn
    [69483, 69492, 'HE'],   // Wald-Michelbach, Birkenau
    [69509, 69513, 'HE'],   // Moerlenbach
    [69517, 69518, 'HE'],   // Gorxheimertal, Abtsteinach
    [68000, 79999, 'BW'],
    [88100, 88179, 'BY'],   // Lindau, Lindenberg, Scheidegg
    [80000, 87999, 'BY'],
    [88000, 88999, 'BW'],
    [89000, 89199, 'BW'],   // Ulm, Alb-Donau
    [89200, 89499, 'BY'],   // Neu-Ulm, Guenzburg, Dillingen
    [89500, 89999, 'BW'],   // Heidenheim, Ehingen
    [96515, 96529, 'TH'],   // Sonneberg
    [97877, 97877, 'BW'], [97896, 97896, 'BW'], [97900, 97900, 'BW'], [97910, 97999, 'BW'],   // Wertheim, Main-Tauber
    [90000, 97999, 'BY'],
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
    /* ── v1823 · PRUEFHAKEN FUER DEN EXTRAKTOR ────────────────────────
     *
     * `tools/frontend-konstanten.mjs` holt diese Tabelle ins Backend,
     * damit der Telegram-Bot die Kaufnebenkosten aus der PLZ hochrechnen
     * kann — ohne eine zweite Steuertabelle anzulegen.
     *
     *   > Eine zweite Steuertabelle ist die Stelle, an der ein Satz nach
     *   > der naechsten Gesetzesaenderung an EINEM Ort stimmt.
     *
     * Funktionen lassen sich nicht nach JSON extrahieren, Bereiche schon.
     * Faellt dieser Haken weg, bricht der Extraktor mit Namen — er darf
     * nicht still eine leere Tabelle schreiben. */
    _ranges: PLZ_RANGES,
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
      /* v2261 · Haken „Grunderwerbsteuer automatisch nach Bundesland" in den
         Einstellungen. Aus: der Satz des Profil-Bundeslands bleibt stehen. */
      try {
        var IPg = window.DealPilotInvestmentProfile;
        if (IPg && typeof IPg.get === 'function' && IPg.get('grest_auto') === false) return;
      } catch (e) {}
      const cur = parseFloat(String(gestPctInput.value).replace(',', '.'));
      /* v2261: „Default" ist jetzt der Satz des Profil-Bundeslands, nicht fest 6,5 */
      var _defBl = 6.5;
      try { var _bl = window.DealPilotInvestmentProfile && DealPilotInvestmentProfile.get('bundesland'); if (_bl && GREST_RATES[_bl] != null) _defBl = GREST_RATES[_bl]; } catch (e) {}
      /* v2261: auch den Satz, den die Automatik SELBST gesetzt hat - sonst blieb nach
         einem PLZ-Wechsel (Muenchen -> Herford) der alte Landessatz stehen. */
      var _auto = parseFloat(gestPctInput.dataset.autoRate || 'NaN');
      if (isNaN(cur) || Math.abs(cur - 6.5) < 0.01 || Math.abs(cur - _defBl) < 0.01 || cur === 0 || (isFinite(_auto) && Math.abs(cur - _auto) < 0.01)) {
        gestPctInput.value = String(info.rate).replace(".", ",");   /* v2263: Dezimalkomma wie die anderen Felder (stand "6.50") */
        gestPctInput.dataset.autoRate = String(info.rate);
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
      hint.textContent = `Aus PLZ ermittelt: ${info.name} ${info.rate.toFixed(1).replace('.', ',')} %`;   /* v2257: Dezimalkomma */
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
