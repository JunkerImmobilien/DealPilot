/* ═══════════════════════════════════════════════════════════════════════
   erbbau-ui.js · v1312 · die DOM-Seite des Erbbaurechts
   ═══════════════════════════════════════════════════════════════════════

   Trennung wie bei afa-engine/afa-ui: erbbau-engine.js rechnet und kennt
   kein DOM, diese Datei liest die Felder, ruft den Kern und malt das
   Ergebnis. Wer den Erbbauzins fuer den Cashflow braucht, ruft
   DealPilotErbbau.zinsJahr() - EINE Quelle, kein zweiter Rechenweg.

   Der Volleigentumswert ist der wunde Punkt. Kein Bewertungspartner nimmt
   das Erbbaurecht entgegen, also ist JEDE Marktbewertung an diesem Objekt
   ein Volleigentumswert - auch wenn oben "Erbpacht" steht. Genau den
   brauchen wir hier als Ausgangsgroesse, und genau deshalb sagt die
   Ergebniskarte immer dazu, welche Zahl sie gelesen hat.
   ═══════════════════════════════════════════════════════════════════════ */
(function (W, D) {
  'use strict';

  function $(id) { return D.getElementById(id); }

  function pd(x) {
    if (typeof W.parseDe === 'function') return W.parseDe(x);
    var n = parseFloat(String(x == null ? '' : x).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  function val(id) {
    var e = $(id);
    if (!e) return 0;
    return pd(e.value);
  }

  function txt(id) {
    var e = $(id);
    return e ? String(e.value || '') : '';
  }

  function eur(n, dez) {
    if (n == null || !isFinite(n)) return '—';
    try {
      return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: dez || 0, maximumFractionDigits: dez || 0
      }).format(n) + ' €';
    } catch (e) { return Math.round(n) + ' €'; }
  }

  function pct(n, dez) {
    if (n == null || !isFinite(n)) return '—';
    return n.toFixed(dez == null ? 1 : dez).replace('.', ',') + ' %';
  }

  function escH(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── an/aus ─────────────────────────────────────────────────────────── */

  function istAn() {
    var cb = $('erbpacht');
    return !!(cb && cb.checked);
  }

  function toggle(an) {
    var body = $('erbpacht_body');
    if (body) body.style.display = an ? 'block' : 'none';
    if (!an) {
      var erg = $('erb_ergebnis');
      if (erg) erg.style.display = 'none';
    }
  }

  /* ── der laufende Erbbauzins fuer den Cashflow ──────────────────────── */

  /**
   * zinsJahr() - der vertraglich vereinbarte Erbbauzins in EUR pro Jahr,
   * oder 0, wenn kein Erbbaurecht gesetzt ist. calc() haengt ihn an die
   * NICHT umlagefaehigen Bewirtschaftungskosten: er ist eine dauerhafte
   * Zahlung des Eigentuemers, steuerlich Werbungskosten, und er laesst
   * sich nicht auf den Mieter umlegen.
   */
  function zinsJahr() {
    if (!istAn()) return 0;
    var z = val('erbbauzins');
    return (z > 0) ? z : 0;
  }

  /* ── Bodenwert und Volleigentum aus dem Formular ────────────────────── */

  function bodenwertAnteilig() {
    /* Dieselbe Rechnung wie calc(): Grundstuecksflaeche x MEA x
       Bodenrichtwert. Bei ETW ist der Miteigentumsanteil entscheidend -
       ohne ihn faellt der Bodenwert um den Faktor 14 zu hoch aus. */
    var gsfl = val('gsfl');
    var mea = val('mea');
    var brw = val('brw');
    if (!(gsfl > 0) || !(brw > 0)) return null;
    var anteil = (mea > 0) ? (mea / 100) : 1;
    return gsfl * anteil * brw;
  }

  function volleigentum() {
    /* Kaskade wie wert_basis in calc.js, aber mit Herkunftsangabe: der
       Nutzer muss sehen, WORAUF der Abschlag gerechnet wurde. */
    var svw = val('svwert');
    if (svw > 0) return { wert: svw, quelle: 'Verkehrswert (§ 194 BauGB)' };
    var bv = val('bankval');
    var kp = val('kp');
    if (bv > kp && bv > 0) return { wert: bv, quelle: 'Bankbewertung' };
    if (kp > 0) return { wert: kp, quelle: 'Kaufpreis' };
    return null;
  }

  function restnutzungsdauer() {
    /* Kein eigenes Feld im Formular. Aus dem Baujahr abgeleitet, mit der
       Gesamtnutzungsdauer aus Anlage 1 zur ImmoWertV: Wohnen 80 Jahre,
       Gewerbe/Buero 60, Hotel 40. Naeherung, klar als solche benannt. */
    var bj = val('baujahr');
    if (!(bj > 1500)) return null;
    var art = String(txt('objart') || 'ETW').toUpperCase();
    var gnd = 80;
    if (art === 'BUERO' || art === 'GEW' || art === 'GESCH') gnd = 60;
    if (art === 'HOTEL') gnd = 40;
    if (art === 'GAR') gnd = 60;
    var alter = (new Date()).getFullYear() - bj;
    var rnd = gnd - alter;
    /* Unter 30 % der GND wird die Restnutzungsdauer ueblicherweise
       angehoben (Modernisierung, SW-RL Modellansatz). Wir setzen den
       Boden bei 20 Jahren statt bei null - eine Null wuerde den
       Heimfall-Abschlag ausschalten, obwohl das Gebaeude noch steht. */
    if (rnd < 20) rnd = 20;
    return rnd;
  }

  /* ── rechnen und malen ─────────────────────────────────────────────── */

  function rechnen() {
    var erg = $('erb_ergebnis');
    if (!istAn()) {
      if (erg) erg.style.display = 'none';
      return null;
    }
    if (!W.Erbbau) return null;

    var ve = volleigentum();
    var bw = bodenwertAnteilig();

    var r = W.Erbbau.compute({
      volleigentum: ve ? ve.wert : null,
      bodenwert: bw,
      restlaufzeit: val('erb_restlz'),
      erbbauzins: (val('erbbauzins') > 0) ? val('erbbauzins') : null,
      zinssatzAngemessen: (val('erb_zs_ang') > 0) ? val('erb_zs_ang') : null,
      entschaedigungPct: (val('erb_entsch') > 0) ? val('erb_entsch') : null,
      objektart: txt('objart'),
      restnutzungsdauer: restnutzungsdauer()
    });

    if (erg) erg.innerHTML = _malen(r, ve, bw);
    if (erg) erg.style.display = 'block';

    try { W.State = W.State || {}; W.State.erbbau = r; } catch (e) {}
    return r;
  }

  var FEHLT_TEXT = {
    volleigentum: 'ein Wert zum Rechnen — Verkehrswert, Bankbewertung oder wenigstens der Kaufpreis',
    bodenwert: 'der Bodenwert — Grundstücksfläche und Bodenrichtwert (BORIS abrufen geht direkt darüber)',
    restlaufzeit: 'die Restlaufzeit des Erbbaurechts in Jahren (steht im Erbbaurechtsvertrag)'
  };

  function _malen(r, ve, bw) {
    var G = 'var(--wl-c9a84c, #C9A84C)';
    if (!r || !r.ok) {
      var liste = (r && r.fehlt || []).map(function (k) {
        return '<li>' + escH(FEHLT_TEXT[k] || k) + '</li>';
      }).join('');
      return '<div style="font-size:12px;line-height:1.5">' +
        '<b>Erbbaurechts-Abschlag lässt sich noch nicht rechnen.</b>' +
        '<ul style="margin:6px 0 0 16px;padding:0">' + liste + '</ul>' +
        '<div style="margin-top:6px;color:var(--muted)">Der Erbbauzins läuft trotzdem schon im Cashflow mit.</div>' +
        '</div>';
    }

    var t = r.teile, a = r.annahmen;
    var zeilen = [
      ['Wert wie Volleigentum' + (ve ? ' <span style="color:var(--muted)">(' + escH(ve.quelle) + ')</span>' : ''), eur(t.gebaeudeanteil + t.bodenwert)],
      ['− Bodenwert (gehört dem Erbbaurechtsgeber)', '−' + eur(t.bodenwert)],
      [(t.zinsvorteil >= 0 ? '+ Vorteil aus günstigem Erbbauzins' : '− Nachteil aus hohem Erbbauzins'),
        (t.zinsvorteil >= 0 ? '+' : '−') + eur(Math.abs(t.zinsvorteil))],
      ['− Gebäude fällt am Ende teils entschädigungslos heim', '−' + eur(t.heimfallabschlag)]
    ];

    var h = '<div style="font-size:12px;line-height:1.6">';
    h += '<div style="font-weight:700;color:' + G + ';margin-bottom:4px">Erbbaurechts-Abschlag nach § 50 ImmoWertV</div>';
    h += '<table style="width:100%;border-collapse:collapse">';
    zeilen.forEach(function (z) {
      h += '<tr><td style="padding:1px 0">' + z[0] + '</td><td style="padding:1px 0;text-align:right;white-space:nowrap">' + z[1] + '</td></tr>';
    });
    h += '<tr><td style="padding:4px 0 1px;border-top:1px solid var(--border);font-weight:700">Erbbaurechtswert</td>' +
      '<td style="padding:4px 0 1px;border-top:1px solid var(--border);text-align:right;font-weight:700;white-space:nowrap">' + eur(r.erbbaurechtswert) + '</td></tr>';
    h += '<tr><td style="padding:1px 0;font-weight:700;color:' + G + '">Abschlag gegenüber Volleigentum</td>' +
      '<td style="padding:1px 0;text-align:right;font-weight:700;color:' + G + ';white-space:nowrap">' + eur(r.abschlag) + ' · ' + pct(r.abschlagPct) + '</td></tr>';
    h += '</table>';

    if (r.markt) {
      h += '<div style="margin-top:6px;color:var(--muted)">Am Markt beobachtet bei ' + escH(r.markt.text) +
        ': <b>' + r.markt.von + '–' + r.markt.bis + ' %</b>' +
        (r.markt.imRahmen ? ' — die Rechnung liegt darin.' : ' — die Rechnung liegt daneben.') + '</div>';
    }

    h += '<div style="margin-top:4px;color:var(--muted)">Gerechnet mit ' + pct(a.zinssatzAngemessen, 2).replace(' %', '') +
      ' % angemessenem Erbbauzins, ' + pct(a.kapitalzins, 2).replace(' %', '') + ' % Kapitalisierung' +
      (a.restnutzungsdauer != null ? ', ' + Math.round(a.restnutzungsdauer) + ' Jahren Restnutzungsdauer' : '') +
      ' und ' + pct(a.entschaedigungPct, 1).replace(' %', '') + ' % Entschädigung bei Zeitablauf.</div>';

    if (r.hinweise && r.hinweise.length) {
      h += '<ul style="margin:6px 0 0 16px;padding:0;color:var(--muted)">';
      r.hinweise.forEach(function (x) { h += '<li>' + escH(x) + '</li>'; });
      h += '</ul>';
    }

    h += '</div>';
    return h;
  }

  /* Beim Laden eines Objekts steht die Checkbox ohne change-Ereignis auf
     dem gespeicherten Wert - der Koerper muss dann von selbst aufgehen. */
  function sync() {
    toggle(istAn());
    if (istAn()) rechnen();
  }

  D.addEventListener('DOMContentLoaded', sync);
  try { W.addEventListener('dp:object-loaded', sync); } catch (e) {}

  W.DealPilotErbbau = {
    toggle: toggle,
    rechnen: rechnen,
    zinsJahr: zinsJahr,
    istAn: istAn,
    sync: sync,
    bodenwertAnteilig: bodenwertAnteilig,
    volleigentum: volleigentum,
    restnutzungsdauer: restnutzungsdauer
  };
})(window, document);
