/* ══════════════════════════════════════════════════════════════════════
 * bestand-analyse.js — v2985 · Pilot-Analyse im BESTAND
 *
 * Marcel 27.10.2026: „Pilot-Analyse ist im Ankauf für Ankauf und im Bestand
 * für Ankauf-Bestand-Zielbild-Vergleich, Steuer, Lage & Markt bzw. Wert &
 * Marktpreis — aber vielleicht auch Exit-Strategien und
 * Anschlussfinanzierungsszenarien mit Fragen beantworten."
 *
 * Dieses Modul liefert die RECHNERISCHEN Teile der zwei neuen Reiter -
 * ohne KI, nur aus dem, was die App schon gerechnet hat:
 *
 *   Anschlussfinanzierung  je Darlehen Ende der Zinsbindung, Restschuld dann
 *                          (D1: State.rs1 aus calc.js, dieselbe Zahl wie im
 *                          Reiter Finanzierung), neue Rate bei 3/4/5 % und dem
 *                          indikativen Marktzins (dpGetIndicativeZins), gleiche
 *                          Tilgung, Cashflow und DSCR danach (Dscr.compute).
 *   Exit-Strategien        Kaufdatum, Ende der Zehnjahresfrist (§ 23 EStG),
 *                          Marktpreisindikation aus dem letzten Marktbericht
 *                          (DpWertZielbild.bericht(), nicht neu gerechnet) gegen
 *                          Gesamtinvestition und Restschuld laut Projektion.
 *
 * Fehlt eine Angabe, steht „fehlt: …" - nie eine Schaetzung.
 *
 * Bestand heisst: ein Ankauf-Stand liegt vor (DealPilotAnkauf.vorhanden())
 * UND die App zeigt den heutigen Stand (nicht die Soll-Ansicht
 * DealPilotAnkaufAnsicht.aktiv()).
 *
 * restschuldNachJahren() ist DIESELBE Jahresformel wie die Schleife in
 * calc.js (Z. ~1668, „for(var y=0;y<bindj;y++)"): sie wird nur gebraucht,
 * wenn calc.js die Zahl fuer dieses Darlehen nicht fuehrt (Darlehen 2 mit
 * eigener Zinsbindung) - fuer Darlehen 1 gilt State.rs1.
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var VERSION = 'v2985';
  var SZENARIEN = [3, 4, 5];   /* Anschlusszins in % p.a. */

  function S() { return global.State || {}; }
  function K() { return (global.State && global.State.kpis) || {}; }
  function el(id) { try { return global.document ? global.document.getElementById(id) : null; } catch (e) { return null; } }
  function wert(id) { var e = el(id); return e && e.value != null ? String(e.value).trim() : ''; }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }

  function istBestand() {
    try {
      var AK = global.DealPilotAnkauf, AA = global.DealPilotAnkaufAnsicht;
      if (!AK || typeof AK.vorhanden !== 'function' || !AK.vorhanden()) return false;
      if (AA && typeof AA.aktiv === 'function' && AA.aktiv()) return false;
      return true;
    } catch (e) { return false; }
  }

  /* ── Datum ─────────────────────────────────────────────────────────── */
  function isoDatum(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) ? null : d;
  }
  function plusJahre(d, j) {
    if (!d || !istZahl(j)) return null;
    var g = Math.floor(j), r = Math.round((j - g) * 12);
    return new Date(d.getFullYear() + g, d.getMonth() + r, d.getDate());
  }
  function monateBis(von, bis) {
    if (!von || !bis) return null;
    var m = (bis.getFullYear() - von.getFullYear()) * 12 + (bis.getMonth() - von.getMonth());
    if (bis.getDate() < von.getDate()) m -= 1;
    return m;
  }
  function iso(d) { return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : null; }
  function datumDe(d) { return d ? String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear() : '–'; }
  function monateText(m) {
    if (m == null) return '';
    if (m <= 0) return 'abgelaufen';
    var j = Math.floor(m / 12), r = m % 12;
    return 'noch ' + m + ' Monate' + (j ? ' (' + j + ' J.' + (r ? ' ' + r + ' Mon.' : '') + ')' : '');
  }

  /* ── Rechnen ───────────────────────────────────────────────────────── */
  /* Jahresschritte wie calc.js: Zins auf die Restschuld zu Jahresbeginn,
     Tilgung = Jahresrate - Zins. */
  function restschuldNachJahren(betrag, zins, rateMonat, jahre) {
    var rs = betrag;
    for (var y = 0; y < jahre; y++) {
      var z = rs * zins, t = rateMonat * 12 - z;
      rs = Math.max(0, rs - t);
    }
    return rs;
  }

  /* Ein Darlehen. Eingabe:
       { name, betrag, zins (Anteil, 0,03), tilgung (Anteil), bindj (Jahre),
         start (Date|null), typ, restschuld (optional, aus calc.js),
         rate_m (optional, aus calc.js), zinsen_pct (Liste Anschlusszinsen) }
     Ausgabe: { name, fehlt[], hinweis, ende, monate_bis_ende, restschuld,
                rate_heute_m, anschluss:[{zins_pct, rate_m, delta_m, label}] } */
  function darlehenRechnen(d, heute) {
    heute = heute || new Date();
    var out = { name: d.name, fehlt: [], hinweis: null, ende: null, monate_bis_ende: null,
      restschuld: null, rate_heute_m: null, anschluss: [] };
    if (!(d.betrag > 0)) out.fehlt.push('Darlehenssumme');
    if (!(d.zins > 0)) out.fehlt.push('Zinssatz');
    if (!(d.bindj > 0)) out.fehlt.push('Zinsbindung');
    var aussetzung = d.typ === 'tilgungsaussetzung';
    if (!aussetzung && !(d.tilgung > 0)) out.fehlt.push('Tilgung');
    if (!d.start) out.fehlt.push('Startdatum (Auszahlung, Nutzen-/Lastenwechsel oder Kaufdatum)');
    if (d.start && d.bindj > 0) {
      out.ende = plusJahre(d.start, d.bindj);
      out.monate_bis_ende = monateBis(heute, out.ende);
    }
    if (!(d.betrag > 0) || !(d.zins > 0) || !(d.bindj > 0) || (!aussetzung && !(d.tilgung > 0))) return out;
    var rate = d.rate_m > 0 ? d.rate_m : d.betrag * (d.zins + (aussetzung ? 0 : d.tilgung)) / 12;
    out.rate_heute_m = rate;
    out.restschuld = istZahl(d.restschuld) && d.restschuld >= 0 ? d.restschuld
      : (aussetzung ? d.betrag : restschuldNachJahren(d.betrag, d.zins, rate, d.bindj));
    if (aussetzung) {
      out.hinweis = 'Tilgungsaussetzung: die Restschuld bleibt in voller Höhe stehen und wird über den Tilgungsträger (Bausparvertrag) abgelöst. Eine Anschlussrate wird hier nicht gerechnet.';
      return out;
    }
    var gesehen = {};
    (d.zinsen || SZENARIEN.map(function (z) { return { pct: z }; })).forEach(function (z) {
      if (!istZahl(z.pct) || z.pct <= 0) return;
      var key = z.pct.toFixed(2);
      if (gesehen[key]) { if (z.label) gesehen[key].label = gesehen[key].label ? gesehen[key].label + ' · ' + z.label : z.label; return; }
      var r = out.restschuld * (z.pct / 100 + d.tilgung) / 12;
      var e = { zins_pct: z.pct, rate_m: r, delta_m: r - rate, label: z.label || null };
      gesehen[key] = e; out.anschluss.push(e);
    });
    out.anschluss.sort(function (a, b) { return a.zins_pct - b.zins_pct; });
    return out;
  }

  /* Cashflow und DSCR nach dem Anschluss - bei heutiger Miete und heutigen
     Kosten. Geaendert wird nur der Schuldendienst dieses einen Darlehens. */
  function nachAnschluss(deltaMonat) {
    var k = K();
    var res = { cf_m: null, dscr: null };
    if (istZahl(k.cf_m)) res.cf_m = k.cf_m - deltaMonat;
    if (istZahl(k.kd_dscr) && global.Dscr && typeof global.Dscr.compute === 'function') {
      var kd = Math.max(0, k.kd_dscr + deltaMonat * 12);
      /* Dscr.compute braucht nur die Summe des Schuldendienstes; die Aufteilung
         in Zins und Tilgung aendert den DSCR nicht. */
      var r = global.Dscr.compute({ nkm_j: k.nkm_netto_j, ze_j: k.ze_j, zins_j: kd, tilg_j: 0, bsv_j: 0, bwk_cf: k.bwk_cf });
      if (r && istZahl(r.netto) && kd > 0) res.dscr = r.netto;   /* v3031: netto */
    }
    return res;
  }

  function startDatum(feld) {
    try {
      var A = global.DealPilotAnteilig;
      var s = A && typeof A.getFinanzierungStartDate === 'function' ? A.getFinanzierungStartDate(feld) : null;
      return isoDatum(s);
    } catch (e) { return null; }
  }
  function zahlFeld(id) {
    var s = wert(id);
    if (!s) return null;
    var n = typeof global.parseDe === 'function' ? global.parseDe(s) : parseFloat(s.replace(',', '.'));
    return istZahl(n) ? n : null;
  }

  /* Der indikative Marktzins von heute (indicative-zins.js) - fuer die
     Zinsbindung des Darlehens, bei der Beleihung nach dem Anschluss. */
  function marktzins(bindj, restschuld) {
    try {
      if (typeof global.dpGetIndicativeZins !== 'function') return null;
      var b = marktbericht(), basis = b && istZahl(b.wert) ? b.wert : (K().kp || null);
      var ltv = basis > 0 && restschuld > 0 ? restschuld / basis * 100 : null;
      var z = global.dpGetIndicativeZins(bindj || 10, null, ltv);
      return istZahl(z) && z > 0 ? { pct: z, ltv: ltv } : null;
    } catch (e) { return null; }
  }

  function anschluss(heute) {
    heute = heute || new Date();
    var s = S(), k = K(), liste = [];
    var annahme = zahlFeld('anschl_z');
    function zinsen(bindj, rs) {
      var z = SZENARIEN.map(function (p) { return { pct: p }; });
      var mz = marktzins(bindj, rs);
      if (mz) z.push({ pct: mz.pct, label: 'Marktzins heute (indikativ)' });
      if (annahme > 0) z.push({ pct: annahme, label: 'deine Annahme im Reiter Finanzierung' });
      return z;
    }
    var d1 = istZahl(k.d1) ? k.d1 : zahlFeld('d1');
    var d1typ = wert('d1_type') || 'annuitaet';
    var d1z = istZahl(s.d1z) && s.d1z > 0 ? s.d1z : (istZahl(k.d1z_pct) ? k.d1z_pct / 100 : null);
    var d1t = istZahl(k.d1t_pct) ? k.d1t_pct / 100 : (zahlFeld('d1t') != null ? zahlFeld('d1t') / 100 : null);
    var bindj = istZahl(s.bindj) && s.bindj > 0 ? s.bindj : zahlFeld('d1_bindj');
    var rs1 = istZahl(s.rs1) ? s.rs1 : null;
    var e1 = darlehenRechnen({ name: 'Darlehen 1', betrag: d1, zins: d1z, tilgung: d1t, bindj: bindj, typ: d1typ,
      start: startDatum(), restschuld: rs1, rate_m: s.d1_rate_monthly, zinsen: zinsen(bindj, rs1) }, heute);
    liste.push(e1);
    if (s.d2_enabled && s.d2 > 0) {
      var b2 = istZahl(s.d2_bindj) && s.d2_bindj > 0 ? s.d2_bindj : zahlFeld('d2_bindj');
      /* calc.js rechnet State.rs2 ueber die Bindung von Darlehen 1 - nur dann ist sie hier richtig */
      var rs2 = istZahl(s.rs2) && b2 === bindj ? s.rs2 : null;
      liste.push(darlehenRechnen({ name: 'Darlehen 2', betrag: s.d2, zins: s.d2z, tilgung: s.d2t, bindj: b2, typ: s.d2_type,
        start: startDatum('d2_auszahl'), restschuld: rs2, rate_m: s.d2_rate_m, zinsen: zinsen(b2, rs2) }, heute));
    }
    liste.forEach(function (e) { e.anschluss.forEach(function (a) { var n = nachAnschluss(a.delta_m); a.cf_m = n.cf_m; a.dscr = n.dscr; }); });
    return { darlehen: liste, cf_heute_m: istZahl(k.cf_m) ? k.cf_m : null, dscr_heute: istZahl(k.dscr) ? k.dscr : null };
  }

  /* ── Exit ──────────────────────────────────────────────────────────── */
  function marktbericht() {
    try {
      var W = global.DpWertZielbild, b = W && W.bericht ? W.bericht() : null;
      if (!b || b.market_value == null) return null;
      var w = Number(b.market_value);
      if (!isFinite(w) || w <= 0) return null;
      var d = b.created_at ? new Date(b.created_at) : null;
      return { wert: w, stand: d && !isNaN(d) ? d : null };
    } catch (e) { return null; }
  }
  function restschuldHeute(heute) {
    var rows = S().cfRows;
    if (!Array.isArray(rows) || !rows.length) return null;
    var j = heute.getFullYear();
    for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].cal === j && istZahl(rows[i].rs)) return { wert: rows[i].rs, jahr: j };
    return null;
  }
  function exit(heute) {
    heute = heute || new Date();
    var k = K(), out = { fehlt: [] };
    var kd = isoDatum(wert('kaufdat'));
    out.kaufdatum = kd;
    if (!kd) out.fehlt.push('Kaufdatum (Reiter Objekt)');
    out.frist_ende = kd ? plusJahre(kd, 10) : null;
    out.monate_bis_frist = out.frist_ende ? monateBis(heute, out.frist_ende) : null;
    var mb = marktbericht();
    out.marktwert = mb ? mb.wert : null;
    out.marktwert_stand = mb ? mb.stand : null;
    if (!mb) out.fehlt.push('Marktpreisindikation (Marktbericht abrufen)');
    out.kaufpreis = istZahl(k.kp) && k.kp > 0 ? k.kp : null;
    out.gesamtinvestition = istZahl(k.gi) && k.gi > 0 ? k.gi : null;
    if (!out.gesamtinvestition) out.fehlt.push('Gesamtinvestition (Kaufpreis und Nebenkosten)');
    var rs = restschuldHeute(heute);
    out.restschuld = rs ? rs.wert : null;
    out.restschuld_jahr = rs ? rs.jahr : null;
    if (!rs) out.fehlt.push('Restschuld (Projektion im Reiter Finanzierung)');
    out.netto_erloes = out.marktwert != null && out.restschuld != null ? out.marktwert - out.restschuld : null;
    out.wertzuwachs = out.marktwert != null && out.gesamtinvestition != null ? out.marktwert - out.gesamtinvestition : null;
    /* rechnerisch bei 80 % Beleihung - die Bank setzt ihren eigenen Beleihungswert an */
    out.beleihungsreserve = out.marktwert != null && out.restschuld != null ? Math.max(0, out.marktwert * 0.8 - out.restschuld) : null;
    return out;
  }

  /* ── Fuer den Prompt ───────────────────────────────────────────────── */
  function r0(x) { return istZahl(x) ? Math.round(x) : null; }
  function r2(x) { return istZahl(x) ? Math.round(x * 100) / 100 : null; }
  function payload(heute) {
    try {
      heute = heute || new Date();
      var a = anschluss(heute), x = exit(heute);
      return {
        darlehen: a.darlehen.map(function (d) {
          return { name: d.name, zinsbindung_ende: iso(d.ende), monate_bis_ende: d.monate_bis_ende,
            restschuld_ende: r0(d.restschuld), rate_heute_m: r2(d.rate_heute_m), fehlt: d.fehlt.length ? d.fehlt : null, hinweis: d.hinweis,
            anschluss: d.anschluss.map(function (s) { return { zins_pct: r2(s.zins_pct), rate_m: r2(s.rate_m), mehr_m: r2(s.delta_m), cf_m: r2(s.cf_m), dscr: r2(s.dscr), label: s.label }; }) };
        }),
        cf_heute_m: r2(a.cf_heute_m), dscr_heute: r2(a.dscr_heute),
        kaufdatum: iso(x.kaufdatum), steuerfrei_ab: iso(x.frist_ende), monate_bis_steuerfrei: x.monate_bis_frist,
        marktwert: r0(x.marktwert), marktwert_stand: iso(x.marktwert_stand),
        kaufpreis: r0(x.kaufpreis), gesamtinvestition: r0(x.gesamtinvestition),
        restschuld_heute: r0(x.restschuld), restschuld_jahr: x.restschuld_jahr,
        netto_erloes_vor_steuer: r0(x.netto_erloes), wertzuwachs: r0(x.wertzuwachs), beleihungsreserve_80: r0(x.beleihungsreserve),
        fehlt: x.fehlt.length ? x.fehlt : null
      };
    } catch (e) { return null; }
  }

  /* ── Anzeige ───────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function eurVz(x) { return istZahl(x) ? (x > 0 ? '+' : '') + Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function pct(x) { return istZahl(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %' : '–'; }
  function dscr(x) { return istZahl(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'; }
  function fehltZeile(f) { return f && f.length ? '<div class="dp-pa-fuss" style="margin-top:6px"><b>fehlt:</b> ' + f.map(esc).join(' · ') + '</div>' : ''; }

  function anschlussHtml() {
    var a = anschluss();
    return a.darlehen.map(function (d) {
      var kopf = '<div class="dp-pa-kv"><strong>' + esc(d.name) + ':</strong> Zinsbindung endet '
        + (d.ende ? '<b>' + datumDe(d.ende) + '</b>' + (d.monate_bis_ende != null ? ' (' + monateText(d.monate_bis_ende) + ')' : '') : '–')
        + ' · Restschuld dann <b>' + eur(d.restschuld) + '</b> · Rate heute ' + eur(d.rate_heute_m) + '/Monat</div>';
      var tafel = '';
      if (d.anschluss.length) {
        tafel = '<table class="abw-tafel" style="margin-top:8px"><thead><tr><th>Anschlusszins</th><th>Rate/Monat</th><th>Mehr/Monat</th><th>Cashflow v. St./Monat</th><th>DSCR</th></tr></thead><tbody>'
          + d.anschluss.map(function (s) {
              return '<tr><td class="abw-wort">' + pct(s.zins_pct) + (s.label ? '<div class="dp-pa-herk">' + esc(s.label) + '</div>' : '') + '</td>'
                + '<td class="abw-zahl">' + eur(s.rate_m) + '</td><td class="abw-zahl">' + eurVz(s.delta_m) + '</td>'
                + '<td class="abw-zahl">' + eur(s.cf_m) + '</td><td class="abw-zahl">' + dscr(s.dscr) + '</td></tr>';
            }).join('') + '</tbody></table>';
      }
      return '<div class="dp-pa-card" data-dp-bestand-darlehen="' + esc(d.name) + '">' + kopf + tafel
        + (d.hinweis ? '<div class="dp-pa-fuss">' + esc(d.hinweis) + '</div>' : '') + fehltZeile(d.fehlt) + '</div>';
    }).join('')
      + '<div class="dp-pa-fuss">Gleiche Tilgung wie heute auf die Restschuld. Cashflow und DSCR bei heutiger Miete und heutigen Kosten'
      + (a.cf_heute_m != null ? ' — heute ' + eur(a.cf_heute_m) + '/Monat, DSCR ' + dscr(a.dscr_heute) : '')
      + '. Der Marktzins ist eine Indikation, kein Angebot einer Bank.</div>';
  }

  function exitHtml() {
    var x = exit(), z = [];
    function zeile(w, v) { z.push('<tr><td class="abw-wort">' + w + '</td><td class="abw-zahl">' + v + '</td></tr>'); }
    zeile('Kaufdatum', x.kaufdatum ? datumDe(x.kaufdatum) : '–');
    zeile('Ende der Zehnjahresfrist (§ 23 EStG)', x.frist_ende ? '<b>' + datumDe(x.frist_ende) + '</b>' + (x.monate_bis_frist != null ? ' · ' + monateText(x.monate_bis_frist) : '') : '–');
    zeile('Marktpreisindikation' + (x.marktwert_stand ? ' (Marktbericht vom ' + datumDe(x.marktwert_stand) + ')' : ''), eur(x.marktwert));
    zeile('Gesamtinvestition (Kaufpreis ' + eur(x.kaufpreis) + ' + Nebenkosten)', eur(x.gesamtinvestition));
    zeile('Wertzuwachs gegen Gesamtinvestition', eurVz(x.wertzuwachs));
    zeile('Restschuld' + (x.restschuld_jahr ? ' Ende ' + x.restschuld_jahr + ' laut Projektion' : ''), eur(x.restschuld));
    zeile('<b>Netto-Erlös vor Steuer</b> (Marktpreis − Restschuld)', '<b>' + eur(x.netto_erloes) + '</b>');
    zeile('Beleihungsspielraum bei 80 % des Marktpreises', eur(x.beleihungsreserve));
    return '<div class="dp-pa-card"><table class="abw-tafel"><tbody>' + z.join('') + '</tbody></table>' + fehltZeile(x.fehlt)
      + '<div class="dp-pa-fuss">Indikativ, vor Verkaufskosten, Vorfälligkeitsentschädigung und Steuer. Verkaufst du vor Ende der Frist, ist der Gewinn als privates '
      + 'Veräußerungsgeschäft steuerpflichtig; die bisher abgesetzte AfA mindert dabei die Anschaffungskosten. Die Frist läuft ab dem notariellen Kaufvertrag — '
      + 'als Stichtag gilt hier das Kaufdatum im Objekt. Keine Steuerberatung: lass es von deinem Steuerberater bestätigen. '
      + 'Der Beleihungsspielraum ist rechnerisch; die Bank setzt ihren eigenen Beleihungswert an.</div></div>';
  }

  /* Fuer das PDF (pdf.js): Klartext, nur WinAnsi-Zeichen (kein U+2212, kein …) */
  function anschlussText() {
    var a = anschluss(), t = [];
    a.darlehen.forEach(function (d) {
      t.push(d.name + ': Zinsbindung endet ' + (d.ende ? datumDe(d.ende) + (d.monate_bis_ende != null ? ' (' + monateText(d.monate_bis_ende) + ')' : '') : '-')
        + ', Restschuld dann ' + eur(d.restschuld) + ', Rate heute ' + eur(d.rate_heute_m) + '/Monat.');
      d.anschluss.forEach(function (s) {
        t.push('• Anschluss ' + pct(s.zins_pct) + (s.label ? ' (' + s.label + ')' : '') + ': Rate ' + eur(s.rate_m) + '/Monat ('
          + eurVz(s.delta_m) + '), Cashflow v. St. ' + eur(s.cf_m) + '/Monat, DSCR ' + dscr(s.dscr));
      });
      if (d.hinweis) t.push(d.hinweis);
      if (d.fehlt.length) t.push('fehlt: ' + d.fehlt.join(', '));
    });
    t.push('Gleiche Tilgung wie heute, heutige Miete und Kosten. Der Marktzins ist eine Indikation, kein Angebot einer Bank.');
    return t.join('\n').replace(/−/g, '-').replace(/–/g, '-');
  }
  function exitText() {
    var x = exit(), t = [];
    t.push('Kaufdatum: ' + (x.kaufdatum ? datumDe(x.kaufdatum) : '-') + ' · Ende der Zehnjahresfrist (§ 23 EStG): '
      + (x.frist_ende ? datumDe(x.frist_ende) + (x.monate_bis_frist != null ? ' (' + monateText(x.monate_bis_frist) + ')' : '') : '-'));
    t.push('Marktpreisindikation' + (x.marktwert_stand ? ' (Marktbericht vom ' + datumDe(x.marktwert_stand) + ')' : '') + ': ' + eur(x.marktwert)
      + ' · Gesamtinvestition ' + eur(x.gesamtinvestition) + ' · Wertzuwachs ' + eurVz(x.wertzuwachs));
    t.push('Restschuld' + (x.restschuld_jahr ? ' Ende ' + x.restschuld_jahr : '') + ': ' + eur(x.restschuld) + ' · Netto-Erlös vor Steuer: ' + eur(x.netto_erloes)
      + ' · Beleihungsspielraum bei 80 %: ' + eur(x.beleihungsreserve));
    if (x.fehlt.length) t.push('fehlt: ' + x.fehlt.join(', '));
    t.push('Indikativ, vor Verkaufskosten, Vorfälligkeitsentschädigung und Steuer. Keine Steuerberatung.');
    return t.join('\n').replace(/−/g, '-').replace(/–/g, '-');
  }

  /* Fuellt alle Platzhalter der Pilot-Analyse (Haupt-Reiter und Kennzahlen-Block).
     Laeuft beim Rendern und beim Oeffnen der Unterreiter - beim Rendern ist das
     Objekt oft noch nicht fertig gerechnet (v2946). */
  var _laedt = false;
  function mountAll() {
    if (!global.document) return;
    var hs = global.document.querySelectorAll('[data-dp-bestand]');
    for (var i = 0; i < hs.length; i++) {
      var art = hs[i].getAttribute('data-dp-bestand');
      try { hs[i].innerHTML = art === 'exit' ? exitHtml() : anschlussHtml(); } catch (e) { hs[i].innerHTML = ''; }
    }
    /* der Marktbericht kommt asynchron - einmal nachladen, dann neu fuellen */
    var W = global.DpWertZielbild;
    if (hs.length && !_laedt && W && W.laden && !(W.bericht && W.bericht())) {
      _laedt = true;
      try { W.laden().then(function () { _laedt = false; if (W.bericht && W.bericht()) mountAll(); }, function () { _laedt = false; }); } catch (e) { _laedt = false; }
    }
  }

  global.DpBestand = { VERSION: VERSION, istBestand: istBestand, darlehenRechnen: darlehenRechnen,
    restschuldNachJahren: restschuldNachJahren, anschluss: anschluss, exit: exit, payload: payload,
    anschlussHtml: anschlussHtml, exitHtml: exitHtml, anschlussText: anschlussText, exitText: exitText, mountAll: mountAll };
})(window);
