/* abweichung.js - v2034
 * ═════════════════════════════════════════════════════════════════════
 * DIE ABWEICHUNG: was aus dem Ankauf geworden ist.
 *
 * Marcel wollte sie nach der Doppelkarte: „Abweichungstafel im Objekt
 * weiter." Im Konzept (N60.12) steht der Grund:
 *
 *   > Die Abweichung ist das eigentliche Produkt. Ein eingefrorener
 *   > Stand allein ist ein Archiv; interessant wird er erst, wenn
 *   > DealPilot die Luecke benennt.
 *
 * ── WAS HIER NICHT PASSIERT ─────────────────────────────────────────
 *
 * Gerechnet wird NICHTS. `DealPilotAnkauf.abweichung()` liefert die
 * Zeilen fertig - aus zwei Saetzen persistierter Kennzahlen, jede von
 * den echten Kernen zu ihrer Zeit gerechnet. Dieses Modul formatiert
 * und zeigt.
 *
 * ── DREI REGELN, DIE DIE TAFEL EHRLICH HALTEN ───────────────────────
 *
 * 1. **Eine fehlende Zahl erzeugt keine Zeile.** Nicht „0 %", nicht
 *    „n/a" - gar nichts. `abweichung()` laesst sie schon weg; die
 *    Tafel sagt stattdessen, WIE VIELE von wie vielen vergleichbar
 *    sind. Eine Tafel, die vollstaendig aussieht und es nicht ist,
 *    ist schlimmer als eine kurze.
 *
 * 2. **Besser und schlechter ist nicht ueberall dasselbe.** Ein
 *    hoeherer Kaufpreis ist nicht gut, eine hoehere Miete schon. Die
 *    Richtung steht je Kennzahl in `KENNZAHLEN` (`besser`), nicht hier.
 *
 * 3. **Prozent nur, wo sie etwas heissen.** Beim DSCR ist „+8 %"
 *    irrefuehrend - die Zahl ist ein Verhaeltnis, kein Betrag. Dort
 *    steht die Differenz in Punkten.
 * ═════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function eur(v) {
    if (v === null || v === undefined || !isFinite(v)) return '–';
    return Math.round(v).toLocaleString('de-DE') + ' €';
  }
  function pct(v, stellen) {
    if (v === null || v === undefined || !isFinite(v)) return '–';
    return v.toLocaleString('de-DE', { minimumFractionDigits: stellen === undefined ? 2 : stellen,
                                       maximumFractionDigits: stellen === undefined ? 2 : stellen }) + ' %';
  }
  function zahl(v, stellen) {
    if (v === null || v === undefined || !isFinite(v)) return '–';
    return v.toLocaleString('de-DE', { minimumFractionDigits: stellen === undefined ? 2 : stellen,
                                       maximumFractionDigits: stellen === undefined ? 2 : stellen });
  }
  function wert(v, einheit) {
    return einheit === 'eur' ? eur(v) : einheit === 'pct' ? pct(v) : zahl(v);
  }

  /* Die Differenz in der Einheit der Kennzahl - mit Vorzeichen, damit
     man die Richtung ohne Nachdenken sieht. */
  function diffText(z) {
    var vz = z.diff > 0 ? '+' : '';
    if (z.einheit === 'eur') return vz + Math.round(z.diff).toLocaleString('de-DE') + ' €';
    if (z.einheit === 'pct') return vz + zahl(z.diff, 2) + ' %-Punkte';
    return vz + zahl(z.diff, 2);
  }

  /* Prozent NUR, wo sie etwas heissen: bei Betraegen. Ein DSCR von 0,90
     gegen 0,95 ist keine „5-Prozent-Verbesserung", sondern 0,05 Punkte. */
  function pctText(z) {
    if (z.einheit !== 'eur') return '';
    if (z.pct === null || !isFinite(z.pct)) return '';
    var vz = z.pct > 0 ? '+' : '';
    return vz + zahl(z.pct, 1) + ' %';
  }

  function datum(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return String(iso || '');
    var t = String(iso).split('-');
    return t[2] + '.' + t[1] + '.' + t[0];
  }

  function zeichnen() {
    var host = el('dp-abweichung');
    if (!host) return;
    var A = window.DealPilotAnkauf;
    if (!A || !A.vorhanden()) { host.innerHTML = ''; host.style.display = 'none'; return; }
    var a = A.abweichung();
    if (!a || !a.zeilen.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';

    var gesamt = (A.KENNZAHLEN || []).length;
    var reihen = a.zeilen.map(function (z) {
      var p = pctText(z);
      return '<tr class="abw-' + z.richtung + '">'
        + '<td class="abw-wort">' + z.wort + '</td>'
        + '<td class="abw-zahl">' + wert(z.ankauf, z.einheit) + '</td>'
        + '<td class="abw-zahl">' + wert(z.bestand, z.einheit) + '</td>'
        + '<td class="abw-zahl abw-diff">' + diffText(z)
        + (p ? '<span class="abw-pct">' + p + '</span>' : '') + '</td>'
        + '</tr>';
    }).join('');

    host.innerHTML =
      '<div class="abw-kopf">'
      + '<h4>Abweichung <span class="abw-sub">Bestand gegen Ankauf</span></h4>'
      + '<div class="abw-stand">Ankauf-Stand vom <b>' + datum(a.stichtag) + '</b>'
      + (a.korrekturen ? ' · ' + a.korrekturen + (a.korrekturen === 1 ? ' Korrektur' : ' Korrekturen') : '')
      + '</div></div>'
      + '<table class="abw-tafel"><thead><tr>'
      + '<th>Kennzahl</th><th>Ankauf</th><th>Bestand</th><th>Abweichung</th>'
      + '</tr></thead><tbody>' + reihen + '</tbody></table>'
      /* Die Deckung gehoert dazu: eine Tafel, die vollstaendig aussieht
         und es nicht ist, ist schlimmer als eine kurze. */
      + '<div class="abw-deckung">' + a.zeilen.length + ' von ' + gesamt
      + ' Kennzahlen vergleichbar'
      + (a.zeilen.length < gesamt
          ? ' — die übrigen lagen zu einem der beiden Zeitpunkte nicht vor und werden <b>nicht</b> geschätzt.'
          : '.')
      + '</div>';
  }

  /* Neu zeichnen, wenn sich etwas geaendert haben kann. `calc` laeuft
     bei jeder Eingabe - deshalb mit Verzoegerung, sonst rechnet die
     Tafel bei jedem Tastendruck. */
  var warten = null;
  function anstossen() { clearTimeout(warten); warten = setTimeout(zeichnen, 400); }

  window.addEventListener('dp:object-ready', function () { setTimeout(zeichnen, 600); });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(zeichnen, 900); });
  if (document.readyState !== 'loading') setTimeout(zeichnen, 900);

  window.DealPilotAbweichung = { zeichnen: zeichnen, anstossen: anstossen };
})();
