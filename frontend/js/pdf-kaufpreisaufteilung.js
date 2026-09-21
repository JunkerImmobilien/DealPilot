/* ════════════════════════════════════════════════════════════════════
   v1475 · KAUFPREISAUFTEILUNG ALS PDF
   ════════════════════════════════════════════════════════════════════
   Marcel 21.09.2026: „ein sauberes PDF … mit den Sachen die du hier
   ausgegeben hast fuer die Aufteilung, auch mit dem Aufteilungssatz, den
   Daten und der Herleitung."

   Gestaltung wie die Bankfassung des Investment Case (pdf-investment-bank):
   weisse Seite, Tinte, Gold nur als Akzent, Absender aus den Einstellungen.

   DIESE DATEI RECHNET NICHTS. Sie liest:
     · window._lastBmfInputs   — was in die amtliche Arbeitshilfe ging
     · window._lastBmfResults  — was sie ausgegeben hat (LibreOffice-Lauf)
     · die Felder des Reiters Anschaffungskosten (ak_*)
     · den Abschlag aus dem Reiter Bodenabschlag (#bmf-boden-pct)
     · window._lastRndResult   — die Restnutzungsdauer, falls ermittelt
   Fehlt die amtliche Rechnung, sagt das Dokument das und bricht ab.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function txt(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function num(id) { return zahl(txt(id)); }
  function wertVon(o) { return (o && typeof o === 'object' && 'value' in o) ? o.value : o; }
  function eur(v, dec) {
    if (v == null || !isFinite(v)) return '-';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec == null ? 0 : dec, maximumFractionDigits: dec == null ? 0 : dec }).format(v) + ' €';
  }
  function pct(v, dec) {
    if (v == null || !isFinite(v)) return '-';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec == null ? 2 : dec, maximumFractionDigits: dec == null ? 2 : dec }).format(v) + ' %';
  }
  /* v1480 · Marcel 21.09.2026: "bitte PDF ohne Umlaute". Jeder Text wird
     umgeschrieben (ae oe ue ss), bevor er ins Dokument geht - auch die Texte
     aus der Oberflaeche (Vertragstext, Begruendung, Absender, Adresse). */
  function ohneUmlaut(t) {
    return String(t == null ? '' : t)
      .replace(/\u00C4/g, 'Ae').replace(/\u00D6/g, 'Oe').replace(/\u00DC/g, 'Ue')
      .replace(/\u00E4/g, 'ae').replace(/\u00F6/g, 'oe').replace(/\u00FC/g, 'ue')
      .replace(/\u00DF/g, 'ss');
  }
  function sauber(t) {
    return ohneUmlaut(String(t == null ? '' : t))
      .replace(/[✓✔]/g, '+').replace(/[✗✘⚠️]/g, '!')
      .replace(/[−‑‒–—]/g, '-')
      .replace(/[^\x00-\xFF]/g, '').replace(/\s+/g, ' ').trim();
  }
  function heute() {
    var t = new Date();
    return ('0' + t.getDate()).slice(-2) + '.' + ('0' + (t.getMonth() + 1)).slice(-2) + '.' + t.getFullYear();
  }
  function marke() {
    try {
      if (window.DealPilotConfig && DealPilotConfig.branding && typeof DealPilotConfig.branding.get === 'function') {
        return DealPilotConfig.branding.get() || {};
      }
    } catch (e) {}
    return {};
  }
  function gold() {
    try { if (typeof window._pdfGold === 'function') return window._pdfGold(); } catch (e) {}
    return [201, 168, 76];
  }

  window.exportPDFKaufpreisaufteilung = function () {
    if (typeof window.jspdf === 'undefined') { alert('PDF-Bibliothek noch nicht geladen.'); return; }
    var R = window._lastBmfResults;
    if (!R) {
      alert('Zuerst im Fenster Kaufpreisaufteilung die amtliche Berechnung starten — dieses PDF gibt nur wieder, was dort gerechnet wurde.');
      return;
    }
    var I = window._lastBmfInputs || {};

    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210, H = 297, L = 18, R_ = 18, CW = W - L - R_, y = 22;
    var G = gold(), GD = [Math.round(G[0] * 0.82), Math.round(G[1] * 0.82), Math.round(G[2] * 0.82)];
    var b = marke();
    var firma = sauber(b.company) || 'DealPilot';
    /* v1483 · Marcel 21.09.2026: "zwei E-Mail-Adressen - welche nimmt er?"
       Gemessen: branding.get() liefert name = "info@junker-immobilien.io" (im
       Einstellungsfeld Name steht eine Adresse) und email = "info@dealpilot.immo".
       Beide standen untereinander. Jetzt: der Name wird nur gedruckt, wenn er
       KEINE Adresse ist; als Kontakt steht genau eine Adresse - die aus dem Feld
       E-Mail, sonst die aus dem Namensfeld. Geaendert wird das in den
       Einstellungen unter Marke. */
    function istMail(s) { return /\S+@\S+\.\S+/.test(String(s || '')); }
    var absZeilen = [firma];
    if (b.name && b.name !== b.company && !istMail(b.name)) absZeilen.push(sauber(b.name) + (b.role ? ' · ' + sauber(b.role) : ''));
    var l2 = [sauber(b.address), sauber(((b.plz || '') + ' ' + (b.city || '')).trim())].filter(Boolean).join(' · ');
    if (l2) absZeilen.push(l2);
    var mail = sauber(b.email) || (istMail(b.name) ? sauber(b.name) : '');
    var kontakt = [b.phone ? 'Tel ' + sauber(b.phone) : '', mail].filter(Boolean).join(' · ');
    if (kontakt) absZeilen.push(kontakt);

    var _titel = 'Kaufpreisaufteilung', _unter = '';
    function kopf(titel, unter) {
      y = 22;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(26, 26, 26);
      doc.text(sauber(firma), L, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(120);
      doc.text('K A U F P R E I S A U F T E I L U N G   N A C H   B M F - A R B E I T S H I L F E', L, y + 4.6);
      doc.setFontSize(8); doc.setTextColor(110);
      var zl = absZeilen.slice(0, 4), schritt = 3.6;
      var by = (y + 6.5) - (zl.length - 1) * schritt;
      zl.forEach(function (t) { doc.text(sauber(t), W - R_, by, { align: 'right' }); by += schritt; });
      y += 8.5;
      doc.setDrawColor(G[0], G[1], G[2]); doc.setLineWidth(0.8); doc.line(L, y, W - R_, y); doc.setLineWidth(0.2);
      y += 10;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(26, 26, 26); doc.text(sauber(titel), L, y); y += 5.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110); doc.text(sauber(unter || ''), L, y);
      y += 10;
    }
    function platz(bedarf, titel, unter) {
      if (titel) { _titel = titel; _unter = unter || ''; }
      if (y + bedarf > H - 24) { doc.addPage(); kopf(_titel, _unter); return true; }
      return false;
    }
    function abschnitt(t) {
      if (y > H - 34) { doc.addPage(); kopf(_titel, _unter); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.4); doc.setTextColor(GD[0], GD[1], GD[2]);
      /* v1483: Ueberschriften in normaler Schreibweise statt Versalien. */
      doc.text(sauber(String(t)), L, y);
      doc.setDrawColor(226, 221, 210); doc.line(L, y + 1.8, W - R_, y + 1.8);
      y += 7.5;
    }
    function einleitung(t) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.splitTextToSize(sauber(t), CW).forEach(function (z) { doc.text(z, L, y); y += 4.2; });
      y += 2.5;
    }
    function zeile(label, wert, o) {
      o = o || {};
      if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
      if (o.summe) { doc.setDrawColor(G[0], G[1], G[2]); doc.setLineWidth(0.6); doc.line(L, y - 3.8, W - R_, y - 3.8); doc.setLineWidth(0.2); }
      doc.setFont('helvetica', (o.summe || o.fett) ? 'bold' : 'normal'); doc.setFontSize(9.2);
      doc.setTextColor(o.summe ? 26 : (o.klein ? 110 : 50));
      doc.text(sauber(label), L + (o.einzug ? 4 : 0), y);
      if (o.summe) doc.setTextColor(GD[0], GD[1], GD[2]); else doc.setTextColor(26, 26, 26);
      doc.text(sauber(String(wert)), W - R_, y, { align: 'right' });
      if (!o.summe) { doc.setDrawColor(236, 232, 223); doc.setLineWidth(0.15); doc.line(L, y + 2, W - R_, y + 2); doc.setLineWidth(0.2); }
      y += o.summe ? 8 : 6.1;
    }
    /* Drei-Spalten-Vergleich: vorher, nachher, Unterschied. */
    function vergleich(spalten, zeilen, hinweis) {
      var fak = CW / spalten.reduce(function (a, s) { return a + s[1]; }, 0);
      function tz(werte, kopfzeile, fett) {
        if (y > H - 24) { doc.addPage(); kopf(_titel, _unter); }
        var x = L;
        doc.setFont('helvetica', (kopfzeile || fett) ? 'bold' : 'normal'); doc.setFontSize(kopfzeile ? 7.4 : 8.6);
        doc.setTextColor(kopfzeile ? 110 : (fett ? 26 : 45));
        werte.forEach(function (w, i) {
          var bw = spalten[i][1] * fak;
          if (i === 0) doc.text(sauber(w), x, y); else doc.text(sauber(w), x + bw - 1, y, { align: 'right' });
          x += bw;
        });
        doc.setDrawColor(kopfzeile ? G[0] : 236, kopfzeile ? G[1] : 232, kopfzeile ? G[2] : 223);
        doc.setLineWidth(kopfzeile ? 0.5 : 0.15); doc.line(L, y + 2.2, W - R_, y + 2.2); doc.setLineWidth(0.2);
        y += kopfzeile ? 7 : 6.4;
      }
      tz(spalten.map(function (s) { return s[0]; }), true);
      zeilen.forEach(function (z) { tz(z.werte || z, false, !!z.fett); });
      if (hinweis) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130); doc.splitTextToSize(sauber(hinweis), CW).forEach(function (t) { doc.text(t, L, y + 1); y += 4; }); }
      y += 5;
    }
    function fuss() {
      var n = doc.getNumberOfPages();
      for (var p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 221, 210); doc.line(L, H - 16, W - R_, H - 16);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
        doc.text(firma + ' · Kaufpreisaufteilung · erstellt am ' + heute(), L, H - 11.5);
        doc.text('Seite ' + p + ' von ' + n, W - R_, H - 11.5, { align: 'right' });
      }
    }

    /* ── Daten ───────────────────────────────────────────────────── */
    var adr = [[txt('str'), txt('hnr')].filter(Boolean).join(' '), [txt('plz'), txt('ort')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var kp = num('ak_kp') || num('kp');
    var nkFelder = [['ak_grest', 'Grunderwerbsteuer'], ['ak_notar', 'Notar'], ['ak_gba', 'Grundbuchamt'],
      ['ak_makler', 'Maklercourtage'], ['ak_gutachten', 'Gutachten'], ['ak_anwalt', 'Rechtsberatung'],
      ['ak_ji', 'Vermittlung / Beratung'], ['ak_fahrt', 'Fahrtkosten'], ['ak_verpfl', 'Verpflegung'],
      ['ak_hotel', 'Übernachtung'], ['ak_sonst', 'Sonstige Nebenkosten']];
    /* v1476 · GEMESSEN: in die amtliche Arbeitshilfe geht nur
       Kaufpreis + Grunderwerbsteuer + Notar + Grundbuch + Makler +
       Vermittlung (bmf-modal.js, runBmf). Fahrtkosten, Gutachten, Anwalt,
       Verpflegung, Uebernachtung und Sonstiges gehen NICHT mit. Dieses
       Dokument darf deshalb nicht die volle Summe als Grundlage ausweisen -
       sonst stehen zwei Zahlen fuer dieselbe Sache im selben Blatt. */
    /* v1481 · seit v1478 gehen auch Fahrt, Gutachten, Anwalt und Sonstiges in
       die amtliche Aufteilung (bmf-modal.js runBmf). Diese Liste muss der dort
       entsprechen, sonst weist das PDF eine andere Bemessungsgrundlage aus als
       die Rechnung - gemessen 605.332 statt 605.939 EUR. */
    var IN_BMF = { ak_grest: 1, ak_notar: 1, ak_gba: 1, ak_makler: 1, ak_ji: 1,
      ak_fahrt: 1, ak_gutachten: 1, ak_anwalt: 1, ak_sonst: 1 };
    var nkSumme = nkFelder.reduce(function (a, f) { return a + (num(f[0]) || 0); }, 0);
    var nkInBmf = nkFelder.reduce(function (a, f) { return a + (IN_BMF[f[0]] ? (num(f[0]) || 0) : 0); }, 0);
    var nkAussen = nkSumme - nkInBmf;
    var ak = (kp || 0) + nkSumme;
    var akBmf = (kp || 0) + nkInBmf;

    var gebPct = zahl(wertVon(R.gebaeudeanteil_prozent));
    var bodenwert = zahl(wertVon(R.bodenwert));
    var ertrag = zahl(wertVon(R.ertragswert));
    var sachwert = zahl(wertVon(R.sachwert_marktangepasst)) || zahl(wertVon(R.sachwert_vorlaeufig));
    var vw = zahl(wertVon(R.massgebender_verkehrswert));
    var kpGrund = zahl(wertVon(R.kaufpreisanteil_grund));
    var kpGeb = zahl(wertVon(R.kaufpreisanteil_gebaeude));

    var abschlag = zahl(txt('bmf-boden-pct'));
    if (abschlag == null) abschlag = 20;
    var grundBegr = txt('bmf-boden-grund');

    var bodenAnteilKp = (kp || 0) * (100 - gebPct) / 100;
    var gebAnteilKp = (kp || 0) * gebPct / 100;
    var bodenNeu = bodenAnteilKp * (1 - abschlag / 100);
    var gebNeu = (kp || 0) - bodenNeu;
    var gebPctNeu = kp ? gebNeu / kp * 100 : 0;
    var nkGebAlt = nkInBmf * gebPct / 100, nkGebNeu = nkInBmf * gebPctNeu / 100;
    var basisAlt = gebAnteilKp + nkGebAlt, basisNeu = gebNeu + nkGebNeu;

    /* ── Seite 1 ─────────────────────────────────────────────────── */
    kopf('Kaufpreisaufteilung', (adr || 'Objekt') + ' · Stand ' + heute());

    abschnitt('Objekt und Grundlagen');
    zeile('Anschrift', adr || '-');
    zeile('Grundstücksart (Arbeitshilfe)', sauber(I.grundstuecksart || txt('bmf_art')) || '-');
    zeile('Baujahr', String(I.baujahr || txt('bmf_bj') || '-'));
    zeile('Wohn- und Nutzfläche', (I.wohnflaeche || num('bmf_wfl')) ? new Intl.NumberFormat('de-DE').format(I.wohnflaeche || num('bmf_wfl')) + ' m²' : '-');
    zeile('Grundstücksfläche', (I.grundstuecksflaeche || num('bmf_gsfl')) ? new Intl.NumberFormat('de-DE').format(I.grundstuecksflaeche || num('bmf_gsfl')) + ' m²' : '-');
    zeile('Bodenrichtwert', (I.bodenrichtwert || num('bmf_brw')) ? eur(I.bodenrichtwert || num('bmf_brw'), 0) + ' je m²' : '-');
    if (num('bmf_miete')) zeile('Angesetzte Nettokaltmiete', eur(num('bmf_miete'), 2) + ' je Monat');
    zeile('Stichtag', sauber(I.kaufdatum || txt('bmf_datum')) || '-');
    y += 2;

    platz(60);
    abschnitt('Anschaffungskosten');
    zeile('Kaufpreis laut Vertrag', eur(kp, 2));
    nkFelder.forEach(function (f) {
      var v = num(f[0]);
      if (!v) return;
      var zus = '';
      if (f[0] === 'ak_fahrt' && num('ak_fahrt_km')) zus = ' (' + new Intl.NumberFormat('de-DE').format(num('ak_fahrt_km')) + ' km × ' + eur(num('ak_fahrt_satz'), 2) + ')';
      zeile(f[1] + zus, eur(v, 2), { einzug: true, klein: true });
    });
    zeile('Anschaffungsnebenkosten' + (kp ? ' (' + pct(nkSumme / kp * 100, 2) + ' vom Kaufpreis)' : ''), eur(nkSumme, 2), { fett: true });
    zeile('Anschaffungskosten gesamt', eur(ak, 2), { summe: true });
    y += 1;
    zeile('davon in der amtlichen Aufteilung angesetzt', eur(akBmf, 2), { fett: true });
    if (nkAussen > 0.005) zeile('nicht angesetzt (Fahrt, Gutachten, Anwalt, Reise, Sonstiges)', eur(nkAussen, 2), { einzug: true, klein: true });
    einleitung('Die Arbeitshilfe teilt die Anschaffungskosten einschliesslich Nebenkosten auf; die Nebenkosten folgen demselben Verhaeltnis wie der Kaufpreis. Angesetzt sind alle Anschaffungsnebenkosten des Erwerbs: Grunderwerbsteuer, Notar, Grundbuch, Makler und Vermittlung ebenso wie Fahrten zur Besichtigung und zum Notartermin, ein Wertgutachten zur Kaufentscheidung sowie Rechtsberatung des Erwerbs (BFH VIII R 195/77; BFH IX R 20/08). Kosten, die erst die Abschreibung ermitteln, stehen gesondert und sind sofort abziehbar.');

    /* ── Herleitung der amtlichen Aufteilung ─────────────────────── */
    platz(80, 'Kaufpreisaufteilung', 'Herleitung nach der amtlichen Arbeitshilfe');
    abschnitt('Herleitung der amtlichen Arbeitshilfe');
    einleitung('Gerechnet hat die Arbeitshilfe des Bundesfinanzministeriums selbst; die Werte stammen aus ihrem Berechnungsblatt. Bei einem Mietwohngrundstueck fuehrt sie ueber das Ertragswertverfahren, sonst ueber den Sachwert.');
    zeile('Bodenwert (Flaeche × Bodenrichtwert)', eur(bodenwert));
    if (sachwert) zeile('Sachwert (marktangepasst)', eur(sachwert));
    if (ertrag) zeile('Ertragswert', eur(ertrag));
    zeile('Massgebender Verkehrswert', eur(vw), { fett: true });
    zeile('davon Gebaeude (Verkehrswert abzüglich Bodenwert)', eur((vw || 0) - (bodenwert || 0)));
    zeile('Gebaeudeanteil = Gebaeude ÷ Verkehrswert', pct(gebPct, 2), { summe: true });
    y += 1;
    zeile('Anschaffungskosten × Gebaeudeanteil', eur(kpGeb, 2), { fett: true });
    zeile('Anschaffungskosten × Bodenanteil', eur(kpGrund, 2), { fett: true });

    /* ── Aufteilung mit Abschlag ─────────────────────────────────── */
    platz(90, 'Kaufpreisaufteilung', 'Angepasste Aufteilung mit Abschlag auf den Grund und Boden');
    abschnitt('Angepasste Kaufpreisaufteilung - amtlich gegen ' + pct(abschlag, 0) + ' Abschlag');
    einleitung('Die Arbeitshilfe bindet das Finanzgericht nicht (BFH, Urteil vom 21.07.2020, IX R 26/19). Eine niedrigere Bodenkomponente ist ansetzbar, wenn sie begruendet ist' + (grundBegr ? ' - hier: ' + grundBegr : '') + '.');
    function zv(label, a, n, fmt, fett) {
      var d = (a != null && n != null) ? n - a : null;
      return { fett: !!fett, werte: [label, fmt ? fmt(a) : eur(a), fmt ? fmt(n) : eur(n),
        d == null ? '' : ((d > 0 ? '+' : '') + (fmt ? fmt(d) : eur(d)))] };
    }
    vergleich(
      [['Position', 52], ['Amtlich', 30], ['Mit Abschlag', 30], ['Unterschied', 28]],
      [
        zv('Kaufpreis (ohne Inventar)', kp, kp),
        zv('davon Grund und Boden', bodenAnteilKp, bodenNeu),
        zv('davon Gebaeude', gebAnteilKp, gebNeu),
        zv('Gebaeudeanteil', gebPct, gebPctNeu, function (v) { return pct(v, 2); }, true),
        zv('Nebenkosten auf das Gebaeude', nkGebAlt, nkGebNeu),
        zv('AfA-Bemessungsgrundlage', basisAlt, basisNeu, null, true),
        (nkAussen > 0.005 ? zv('zuzueglich weiterer Nebenkosten (Gebaeudeanteil)', nkAussen * gebPct / 100, nkAussen * gebPctNeu / 100) : null)
      ].filter(Boolean).concat([
      ]),
      'Der Kaufpreis bleibt gleich; der Abschlag verschiebt nur, was auf den Boden entfaellt. Ohne tragfaehige Begruendung setzt das Finanzamt die Aufteilung der Arbeitshilfe an.');

    /* ── AfA ─────────────────────────────────────────────────────── */
    var rnd = null;
    try { rnd = window._lastRndResult && window._lastRndResult.result && window._lastRndResult.result.final_rnd; } catch (e) {}
    /* v1477 · gemessen: die lange Beschriftung lief in die Zahlenspalte.
       Kurz in der Tabelle, die Fundstelle steht in der Fussnote. */
    /* v1479 · Marcel: „wenn eine Spanne rauskommt, die Tabelle erweitern
       durch mehrere Jahre — dann alle Jahre mit Rechnung." Steht im Reiter
       eine Spanne (von/bis), bekommt jedes Jahr darin eine eigene Zeile. */
    var saetze = [[2, 'gesetzliche Pauschale']];
    var rvon = num('bmf-boden-rnd-von'), rbis = num('bmf-boden-rnd-bis');
    if (rvon && rbis && rbis > rvon && (rbis - rvon) <= 25) {
      for (var jj = Math.round(rvon); jj <= Math.round(rbis); jj++) {
        saetze.push([100 / jj, 'Restnutzungsdauer ' + jj + ' Jahre']);
      }
    } else if (rvon) {
      saetze.push([100 / Math.round(rvon), 'Restnutzungsdauer ' + Math.round(rvon) + ' Jahre']);
    } else if (rnd && rnd > 0) {
      saetze.push([100 / rnd, 'Restnutzungsdauer ' + Math.round(rnd) + ' Jahre']);
    }
    var eigen = num('afa_eigen');
    if (eigen && (!rnd || Math.abs(eigen - 100 / rnd) > 0.01)) saetze.push([eigen, 'im Objekt hinterlegter Satz']);

    platz(60, 'Kaufpreisaufteilung', 'Abschreibung');
    abschnitt('Abschreibung je Aufteilung');
    vergleich(
      [['AfA-Satz', 62], ['Amtlich', 28], ['Mit Abschlag', 28], ['Unterschied', 26]],
      saetze.map(function (s) {
        return zv(pct(s[0], 2) + ' · ' + s[1], basisAlt * s[0] / 100, basisNeu * s[0] / 100);
      }),
      'AfA je Jahr auf die jeweilige Bemessungsgrundlage. Die Pauschale von 2,00 % folgt § 7 Abs. 4 Satz 1 EStG; ein hoeherer Satz aus einer kuerzeren Nutzungsdauer folgt § 7 Abs. 4 Satz 2 EStG und setzt deren Nachweis voraus.');

    /* Sofort abzugsfaehige Kosten — sie teilen sich NICHT auf. */
    var sofort = num('bmf-boden-sofort');
    if (sofort) {
      var grenz = num('grenz') || 42;
      platz(34);
      abschnitt('Sofort abzugsfaehige Kosten');
      zeile('Honorar Kaufpreisaufteilung, Restnutzungsdauer, Steuerberatung', eur(sofort, 2));
      zeile('Steuerwirkung im Jahr der Zahlung bei ' + pct(grenz, 2), eur(sofort * grenz / 100, 2), { summe: true });
      einleitung('Diese Kosten dienen der Ermittlung der Abschreibung, nicht dem Erwerb. Sie sind Werbungskosten und im Jahr der Zahlung in voller Hoehe abziehbar; sie erhoehen die Bemessungsgrundlage nicht.');
    }

    /* ── Vertragstext ────────────────────────────────────────────── */
    platz(70, 'Kaufpreisaufteilung', 'Formulierung für den Kaufvertrag');
    abschnitt('Text für den Kaufvertrag');
    var klausel = (el('bmf-boden-klausel-text') && el('bmf-boden-klausel-text').value) || '';
    if (!klausel) {
      klausel = 'Die Vertragsparteien teilen den Gesamtkaufpreis in Höhe von ' + eur(kp, 2) + ' für das Objekt ' + (adr || '[Objektadresse]') + ' wie folgt auf: auf den Grund und Boden entfallen ' + eur(bodenNeu, 2) + ', auf das Gebäude entfallen ' + eur(gebNeu, 2) + '.';
    }
    /* v1483 · Marcel: "kursiv machen und mittig zentrieren". Der Text soll sich
       vom Rechenteil absetzen - er geht woertlich in die Urkunde. */
    var TW = CW - 20;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(45);
    String(klausel).split('\n').forEach(function (absatz) {
      if (!absatz.trim()) { y += 2.5; return; }
      doc.splitTextToSize(sauber(absatz), TW).forEach(function (z) {
        if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
        doc.text(z, W / 2, y, { align: 'center' }); y += 4.8;
      });
    });
    y += 4;
    /* Der Zusatz steht NUR hier - als moeglicher Anhang zum Vertragstext. */
    var zusatzTxt = (window._dpKpaTexte && window._dpKpaTexte.zusatz) || '';
    if (zusatzTxt) {
      if (y > H - 46) { doc.addPage(); kopf(_titel, _unter); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); doc.setTextColor(110);
      doc.text(sauber('Moeglicher Zusatz, falls das Finanzamt die Aufteilung hinterfragt'), W / 2, y, { align: 'center' });
      y += 6;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.6); doc.setTextColor(60);
      String(zusatzTxt).split('\n').forEach(function (absatz) {
        if (!absatz.trim()) { y += 2.2; return; }
        doc.splitTextToSize(sauber(absatz), TW).forEach(function (z) {
          if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
          doc.text(z, W / 2, y, { align: 'center' }); y += 4.5;
        });
      });
      y += 6;
    }
    doc.setFont('helvetica', 'normal');

    platz(40);
    abschnitt('Grundlagen und Hinweise');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(60);
    [
      'Die amtliche Aufteilung stammt aus der Arbeitshilfe des Bundesfinanzministeriums (Berechnungsblatt), ausgefuehrt mit den oben genannten Angaben.',
      'Der Abschlag auf den Grund und Boden ist ein Szenario daneben und ersetzt die Arbeitshilfe nicht. Er braucht eine Begruendung, die zum Grundstueck passt, und ist im Zweifel nachzuweisen.',
      'Dieses Dokument ist eine Aufbereitung der Berechnung und keine Steuerberatung. Die Feststellung trifft das Finanzamt.'
    ].forEach(function (t) {
      doc.splitTextToSize(sauber(t), CW).forEach(function (z) {
        if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
        doc.text(z, L, y); y += 4.4;
      });
      y += 2;
    });

    fuss();
    /* v1483: auch der Dateiname ohne Umlaute. */
    var slug = ohneUmlaut(adr || 'Objekt').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    doc.save('Kaufpreisaufteilung_' + slug + '_' + heute().split('.').reverse().join('') + '.pdf');
  };
})();
