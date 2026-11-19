/* ══════════════════════════════════════════════════════════════════════
 * miete-regel.js · v3845 · Neuvermietung OHNE Mietpreisbremse: wie viel
 * Prozent der Vergleichsmiete DealPilot ansetzt (Einstellung des Kontos)
 *
 * Marcel 19.11.2026: „könnten wir mit ins Set in den Einstellungen nehmen,
 * dann kann der Kunde auch selber auswählen und es einstellen", danach
 * „dann rechne mit 120 %". Also: Vorgabe 120 % (wie bisher, keine Zahl
 * ändert sich), wählbar 110 % (vorsichtig) und 115 %. 120 % ist die
 * rechtliche Grenze (§ 5 WiStG). MIT Mietpreisbremse gilt fest 110 %
 * (§ 556d BGB), das ist nicht einstellbar.
 *
 * Speicher: localStorage `dp_miete_neu_faktor` ("1.1" | "1.15" | "1.2"),
 * am Konto über vorgaben-sync.js (user_settings browser_vorgaben).
 * Ein Kern liest NIE diese Einstellung: der Faktor geht als Parameter in
 * lib/mietanker.js zielMaximum (Route /mietspiegel `faktor_ohne`,
 * /potenzial `neu_faktor_ohne`). Bei 120 % wird nichts mitgeschickt, damit
 * Abrufe und Zwischenspeicher unverändert bleiben.
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpMieteRegel) return;
  var KEY = 'dp_miete_neu_faktor';
  var VORGABE = 1.2;
  var OPTIONEN = [[1.1, '110 %', 'vorsichtig'], [1.15, '115 %', ''], [1.2, '120 %', 'Vorgabe, rechtliche Grenze § 5 WiStG']];
  function faktorOhne() {
    var v = null;
    try { v = parseFloat(global.localStorage.getItem(KEY)); } catch (e) { v = null; }
    var t = OPTIONEN.filter(function (o) { return Math.abs(o[0] - v) < 0.001; })[0];
    return t ? t[0] : VORGABE;
  }
  function pct() { return Math.round(faktorOhne() * 100); }
  function istVorgabe() { return Math.abs(faktorOhne() - VORGABE) < 0.001; }
  function query() { return istVorgabe() ? '' : '&faktor_ohne=' + faktorOhne(); }
  /** Kundentext: ein Satz, nur Punkt und Komma */
  function satz() {
    return 'DealPilot rechnet mit ' + pct() + ' % der Vergleichsmiete.' + (istVorgabe() ? ' Das ist die rechtliche Grenze (§ 5 WiStG).' : ' Rechtlich unbedenklich sind bis 120 % (§ 5 WiStG).');
  }
  function setzen(f) {
    var t = OPTIONEN.filter(function (o) { return Math.abs(o[0] - f) < 0.001; })[0];
    if (!t) return false;
    try { if (Math.abs(t[0] - VORGABE) < 0.001) global.localStorage.removeItem(KEY); else global.localStorage.setItem(KEY, String(t[0])); } catch (e) { return false; }
    try { global.dispatchEvent(new CustomEvent('dp:miete-regel', { detail: { faktor: t[0] } })); } catch (e) {}
    return true;
  }
  function karteHtml() {
    var f = faktorOhne();
    return '<div class="card" id="dp-miete-regel-karte" style="margin-top:14px"><div class="ct">Neuvermietung ohne Mietpreisbremse</div>'
      + '<p class="hint" style="margin:0 0 8px">Gilt an einer Adresse keine Mietpreisbremse, ist die Miete bei einer Neuvermietung frei vereinbar. Bis 120 % der Vergleichsmiete ist sie rechtlich unbedenklich (§ 5 WiStG). Hier wählst du, womit DealPilot im Zielbild und bei der Zielmiete rechnet. Mit Mietpreisbremse gilt immer 110 % (§ 556d BGB).</p>'
      + '<div class="f"><label for="dp-miete-regel-wahl">DealPilot rechnet mit</label><div class="iw"><select id="dp-miete-regel-wahl">'
      + OPTIONEN.map(function (o) { return '<option value="' + o[0] + '"' + (Math.abs(o[0] - f) < 0.001 ? ' selected' : '') + '>' + o[1] + ' der Vergleichsmiete' + (o[2] ? ' (' + o[2] + ')' : '') + '</option>'; }).join('')
      + '</select></div></div></div>';
  }
  /** In den Einstellungen (Reiter Standardwerte) unter die Karten hängen. */
  function einhaengen(host) {
    if (!host || !host.appendChild) return;
    var alt = host.querySelector('#dp-miete-regel-karte'); if (alt) alt.parentNode.removeChild(alt);
    var d = global.document.createElement('div'); d.innerHTML = karteHtml();
    var k = d.firstChild; host.appendChild(k);
    var s = k.querySelector('select');
    if (s) s.addEventListener('change', function () {
      if (setzen(parseFloat(s.value)) && typeof global.toast === 'function') global.toast('✓ Neuvermietung ohne Mietpreisbremse: ' + pct() + ' %');
    });
  }
  global.DpMieteRegel = { VERSION: 'v3845', KEY: KEY, VORGABE: VORGABE, OPTIONEN: OPTIONEN, faktorOhne: faktorOhne, pct: pct, istVorgabe: istVorgabe, query: query, satz: satz, setzen: setzen, karteHtml: karteHtml, einhaengen: einhaengen };
})(typeof window !== 'undefined' ? window : globalThis);
