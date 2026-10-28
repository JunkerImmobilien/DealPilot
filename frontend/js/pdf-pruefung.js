/* ═══════════════════════════════════════════════════════════════════════
   pdf-pruefung.js · v3018d — EIN Tor vor jedem PDF

   Marcel 28.10.2026: „PDF-Export nur dann erlauben, wenn das Dokument auch
   valide ist – vor allem auch bei Kaufpreisaufteilung, Anschaffungskosten
   und Steuer-PDF."

   GEMESSEN vorher (Staging, Lindenallee 2026-1123, Felder nur im Speicher
   geleert, Schreibzugriffe abgefangen):
     · Investment-PDF mit leerer Miete: 14 Seiten, Bruttomietrendite 0,00 %,
       DSCR 0,00 - ohne jeden Hinweis. (Die Bankfassung hielt an - sie hatte
       als einzige eine Pruefung, pruefeInvestmentDaten, v1505.)
     · Werbungskosten-PDF mit leerem Gebaeudeanteil und AfA-Satz: erzeugt,
       mit einer AfA aus Vorgabewerten.
     · Kaufpreisaufteilung mit geleerter Grundstuecksflaeche: erzeugt aus der
       ALTEN Rechnung - „Grundstücksfläche -" neben einem Bodenwert aus 1.150 m².
     · Ohne Rechnung: ein blockierendes alert(), das den Tab anhielt.
     · Die alte BMF-Anlage (exportBmfPdf): „Lage —", Dateiname
       „BMF_Anlage_Finanzamt_____" - sie las Felder, die es nicht gibt.

   Hier steht je PDF-Art EINE Pruefung. Jeder Knopf, der dieselbe Art
   erzeugt, laeuft ueber dasselbe Tor - die Exportfunktion selbst ruft es auf,
   nicht der Knopf. Gesperrt wird, was das Dokument falsch macht (fehlende
   Pflichtangabe, ungueltiges Ergebnis); was es nur duenner macht, bleibt ein
   Hinweis (Toast) und das PDF entsteht. Die Rechenkerne bleiben unberuehrt -
   geprueft werden ihre Eingaben und Ergebnisse.

   Befund: { ok, sperren: [{ was, wo, warum, feld, aktion }], warnen: [text] }
     feld   = id des Eingabefelds -> „Hinspringen" (Reiter oeffnen, Feld markieren)
     aktion = 'bmf' -> das Fenster Kaufpreisaufteilung oeffnen
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpPdfPruefung) return;

  function el(id) { return document.getElementById(id); }
  function roh(id) { var e = el(id); return e && e.value != null ? String(e.value).trim() : ''; }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function wv(o) { return (o && typeof o === 'object' && 'value' in o) ? o.value : o; }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }

  /* Reiter eines Felds aus dem DOM - nicht aus einer Liste, die veraltet */
  function reiterVon(feld) {
    var e = el(feld), sec = e && e.closest ? e.closest('.sec') : null;
    if (!sec) return null;
    var tabs = document.querySelectorAll('.tab[data-target-sec]');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-target-sec') === sec.id) {
        var l = tabs[i].querySelector('.tab-lbl');
        return { idx: i, name: 'Reiter ' + String((l || tabs[i]).textContent || '').trim() };
      }
    }
    return null;
  }
  function sperre(was, feld, warum, woErsatz) {
    var r = feld ? reiterVon(feld) : null;
    return { was: was, wo: r ? r.name : (woErsatz || ''), warum: warum || '', feld: feld || null };
  }

  /* ── Investment-PDF, Bank- und Kurzfassung ───────────────────────── */
  var FELD_INVEST = { 'Kaufpreis': 'kp', 'Mieteinnahme': 'nkm', 'Finanzierung': 'ek', 'Cashflow-Jahre': 'btj' };
  function investment() {
    var b = (typeof window.pruefeInvestmentDaten === 'function') ? window.pruefeInvestmentDaten() : { ok: true, sperren: [], warnen: [] };
    var s = (b.sperren || []).map(function (x) {
      var f = FELD_INVEST[x.was] || null, r = f ? reiterVon(f) : null;
      return { was: x.was, wo: r ? r.name : x.wo, warum: x.warum || '', feld: f };
    });
    return { ok: !s.length, sperren: s, warnen: b.warnen || [] };
  }

  /* ── Kaufpreisaufteilung (mit Anschaffungskosten und AfA) ─────────── */
  function kaufpreisaufteilung() {
    var S = [], W = [];
    /* dieselbe Pflichtliste wie das Fenster (bmf-modal.js BMF_PFLICHT) - keine zweite */
    try {
      if (typeof window._bmfFehlend === 'function') {
        window._bmfFehlend().forEach(function (e) {
          var f = e.alt && el(e.alt) ? e.alt : e.id;
          var x = sperre(e.name, f, e.warum, e.wo); S.push(x);
        });
      }
    } catch (e) {}
    /* Das Fenster prueft den Miteigentumsanteil nur, wenn es offen ist (bmf_art). Ohne Fenster
       entscheidet die Objektart: eine Eigentumswohnung ohne MEA hat keinen Bodenwert-Anteil. */
    if (!el('bmf_art') && roh('objart') === 'ETW' && !(zahl(roh('mea')) > 0) && !S.some(function (x) { return x.was === 'Miteigentumsanteil'; }))
      S.push(sperre('Miteigentumsanteil', 'mea', 'Bei einer Eigentumswohnung wird der Bodenwert darüber auf die Einheit umgelegt.', 'Reiter Objekt'));
    var kp = zahl(roh('ak_kp')) || zahl(roh('kp'));
    if (!(kp > 0) && !S.some(function (x) { return x.was === 'Kaufpreis'; })) S.push(sperre('Kaufpreis', 'kp', '', 'Reiter Investition'));
    var R = window._lastBmfResults, I = window._lastBmfInputs || {};
    if (!R) {
      S.push({ was: 'Berechnung der Kaufpreisaufteilung', wo: 'Fenster Kaufpreisaufteilung', aktion: 'bmf',
        warum: 'Das PDF gibt nur wieder, was die amtliche Arbeitshilfe dort gerechnet hat - ohne Rechnung gibt es nichts wiederzugeben.' });
    } else if (!S.length) {
      var g = zahl(wv(R.gebaeudeanteil_prozent)), bw = zahl(wv(R.bodenwert)), vw = zahl(wv(R.massgebender_verkehrswert));
      var kg = zahl(wv(R.kaufpreisanteil_gebaeude)), kb = zahl(wv(R.kaufpreisanteil_grund)), ak = zahl(I.kaufpreis);
      var bad = function (was, warum) { S.push({ was: was, wo: 'Fenster Kaufpreisaufteilung', aktion: 'bmf', warum: warum }); };
      if (g == null || !(g > 0 && g <= 100)) bad('Gebäudeanteil', 'Die Rechnung lieferte ' + (g == null ? 'keinen Wert' : String(g).replace('.', ',') + ' %') + ' - gültig ist ein Anteil über 0 und bis 100 %.');
      if (!(bw > 0)) bad('Bodenwert', 'Die Rechnung lieferte keinen Bodenwert - die Aufteilung hätte keinen Grund und Boden.');
      if (!(vw > 0)) bad('Verkehrswert der Arbeitshilfe', 'Die Rechnung lieferte keinen maßgebenden Verkehrswert.');
      if (kg == null || kb == null || kg < 0 || kb < 0) bad('Aufteilung Gebäude / Boden', 'Die Rechnung lieferte keine gültigen Anteile.');
      else if (ak > 0 && Math.abs(kg + kb - ak) > Math.max(2, ak * 0.0005))
        bad('Summe Gebäude + Boden', 'Gebäude ' + eur(kg) + ' und Boden ' + eur(kb) + ' ergeben ' + eur(kg + kb) + ', die angesetzten Anschaffungskosten sind ' + eur(ak) + '.');
    }
    return { ok: !S.length, sperren: S, warnen: W };
  }

  /* ── Werbungskosten-PDF (Steuer, je Objekt) ───────────────────────── */
  function steuer() {
    var S = [], W = [], St = window.State || {}, K = St.kpis || {};
    var kp = zahl(roh('kp'));
    if (!(kp > 0)) S.push(sperre('Kaufpreis', 'kp', 'Er ist die Grundlage der Abschreibung.', 'Reiter Investition'));
    var ga = zahl(roh('geb_ant'));
    if (ga == null || !(ga > 0 && ga <= 100)) S.push(sperre('Gebäudeanteil am Kaufpreis', 'geb_ant',
      ga == null ? 'Ohne ihn rechnet die AfA mit einer Vorgabe statt mit deiner Angabe.' : 'Eingetragen sind ' + String(ga).replace('.', ',') + ' % - gültig ist ein Anteil über 0 und bis 100 %.', 'Reiter Steuer'));
    var as = zahl(roh('afa_satz'));
    if (!(as > 0)) S.push(sperre('AfA-Satz', 'afa_satz', 'Ohne Satz gibt es keine Abschreibung - oder eine aus der Vorgabe.', 'Reiter Steuer'));
    if (!St.cfRows || !St.cfRows.length) S.push(sperre('Steuerjahre (Betrachtungszeitraum)', 'btj', 'Die Aufstellung ist je Steuerjahr - ohne Jahre gibt es keine Seite.', 'Reiter Finanzierung'));
    if (K.afa != null && !(isFinite(Number(K.afa)) && Number(K.afa) >= 0)) S.push({ was: 'Abschreibung', wo: 'Reiter Steuer', warum: 'Die Rechnung lieferte keinen gültigen Betrag.' });
    if (!(zahl(roh('nkm')) > 0)) W.push('Keine Miete eingetragen - die Aufstellung zeigt keine Einnahmen.');
    if (!(zahl(roh('zve')) > 0)) W.push('Kein zu versteuerndes Einkommen eingetragen - die Steuerwirkung entfällt.');
    return { ok: !S.length, sperren: S, warnen: W };
  }

  var PRUEFUNG = { investment: investment, kaufpreisaufteilung: kaufpreisaufteilung, steuer: steuer };
  function pruefen(art) {
    var f = PRUEFUNG[art];
    if (!f) return { ok: true, sperren: [], warnen: [] };   /* unbekannte Art: das Tor bleibt offen, wie bisher */
    try { return f(); } catch (e) { try { console.warn('[pdf-pruefung]', art, e); } catch (x) {} return { ok: true, sperren: [], warnen: [] }; }
  }

  function springe(s) {
    if (s.aktion === 'bmf') { if (typeof window.openBMFModal === 'function') window.openBMFModal(); return; }
    var e = s.feld ? el(s.feld) : null; if (!e) return;
    var r = reiterVon(s.feld);
    if (r && typeof window.switchTab === 'function') { try { window.switchTab(r.idx); } catch (x) {} }
    setTimeout(function () {
      try { e.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (x) { try { e.scrollIntoView(); } catch (y) {} }
      e.classList.add('dp-rc-flash'); setTimeout(function () { e.classList.remove('dp-rc-flash'); }, 1600);
      if (e.focus) { try { e.focus({ preventScroll: true }); } catch (x) {} }
    }, 260);
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Der Hinweis im Haus-Stil (wie zeigeLuecken der Bankfassung) - nie alert/confirm */
  function zeigen(befund, titel) {
    var alt = el('dp-pdf-luecken'); if (alt) alt.remove();
    var ov = document.createElement('div');
    ov.id = 'dp-pdf-luecken'; ov.className = 'dp-pdfp-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var li = befund.sperren.map(function (s, i) {
      var knopf = (s.feld && el(s.feld)) || s.aktion ? '<button type="button" class="dp-pdfp-hin" data-i="' + i + '">' + (s.aktion === 'bmf' ? 'Fenster öffnen' : 'Hinspringen') + '</button>' : '';
      return '<li><div class="dp-pdfp-z"><b>' + esc(s.was) + '</b>' + (s.wo ? ' <span class="dp-pdfp-wo">· ' + esc(s.wo) + '</span>' : '') + knopf + '</div>'
        + (s.warum ? '<div class="dp-pdfp-warum">' + esc(s.warum) + '</div>' : '') + '</li>';
    }).join('');
    ov.innerHTML = '<div class="dp-pdfp-box">'
      + '<div class="dp-pdfp-k">' + esc(titel || 'PDF') + '</div>'
      + '<div class="dp-pdfp-t">Das PDF wird noch nicht erzeugt</div>'
      + '<div class="dp-pdfp-e">Es entstünde mit Nullen, Strichen oder Vorgabewerten an Stellen, an denen das Dokument eine Aussage macht. Es fehlt:</div>'
      + '<ul class="dp-pdfp-l">' + li + '</ul>'
      + (befund.warnen && befund.warnen.length ? '<div class="dp-pdfp-w">Außerdem (macht das Dokument nicht ungültig): ' + esc(befund.warnen.join(' ')) + '</div>' : '')
      + '<div class="dp-pdfp-f"><button type="button" class="dp-pdfp-zu">Verstanden</button></div></div>';
    document.body.appendChild(ov);
    function zu() { ov.remove(); document.removeEventListener('keydown', taste, true); }
    function taste(ev) { if (ev.key === 'Escape') zu(); }
    document.addEventListener('keydown', taste, true);
    ov.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === ov || (t.classList && t.classList.contains('dp-pdfp-zu'))) { zu(); return; }
      if (t.classList && t.classList.contains('dp-pdfp-hin')) { var s = befund.sperren[+t.getAttribute('data-i')]; zu(); if (s) springe(s); }
    });
    try { ov.querySelector('.dp-pdfp-zu').focus(); } catch (e) {}
  }

  /** Das Tor: true = PDF darf entstehen. Sonst Hinweis, kein PDF. */
  function tor(art, titel) {
    var b = pruefen(art);
    if (!b.ok) { zeigen(b, titel); return false; }
    if (b.warnen && b.warnen.length && typeof window.toast === 'function') { try { window.toast('Hinweis: ' + b.warnen[0]); } catch (e) {} }
    return true;
  }

  window.DpPdfPruefung = { VERSION: 'v3018d', pruefen: pruefen, tor: tor, zeigen: zeigen, springe: springe };
})();
