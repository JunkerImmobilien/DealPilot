/* ════════════════════════════════════════════════════════════════════
   v1471 · KAUFPREISAUFTEILUNG: ABSCHLAG AUF DEN GRUND UND BODEN
   ════════════════════════════════════════════════════════════════════
   Marcel 21.09.2026: „ein Reiter mit 20% Abzug vom Grund und Boden".

   WICHTIG — und der Grund, warum das ein EIGENER Reiter ist:
   Die Aufteilung in `p-bmf` rechnet die AMTLICHE Arbeitshilfe des BMF
   selbst (Backend faehrt das Original-Excel ueber LibreOffice). Diese Zahl
   wird hier nicht angefasst. Der Abschlag ist ein ZWEITES Szenario
   daneben: derselbe Kaufpreis, der Bodenwert um X Prozent niedriger, die
   Differenz wandert ins Gebaeude.

   Wofuer das gut ist: Der BFH hat entschieden, dass die Arbeitshilfe das
   Finanzgericht NICHT bindet (IX R 26/19 vom 21.07.2020). Wer eine
   niedrigere Bodenkomponente begruendet — schlechter Zuschnitt, Hinterland,
   Lärm, Erbbaurecht, Bebauung, die den Boden nicht ausnutzt — kann eine
   abweichende Aufteilung ansetzen. Dieses Blatt zeigt, was das in Euro
   bedeutet, und sagt dazu, dass es eine BEGRUENDUNG braucht.

   Gerechnet wird hier nichts Neues: Bodenwert, Gebaeudeanteil und Kaufpreis
   kommen aus `window._lastBmfResults` (amtlicher Lauf), die Nebenkosten aus
   dem Reiter Anschaffungskosten.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PANE = 'p-boden';

  function el(id) { return document.getElementById(id); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function eur(v, dec) {
    if (v == null || !isFinite(v)) return '—';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec == null ? 0 : dec, maximumFractionDigits: dec == null ? 0 : dec }).format(v) + ' €';
  }
  function pct(v, dec) {
    if (v == null || !isFinite(v)) return '—';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec == null ? 2 : dec, maximumFractionDigits: dec == null ? 2 : dec }).format(v) + ' %';
  }
  function wert(o) { return (o && typeof o === 'object' && 'value' in o) ? o.value : o; }

  /* ── Daten aus dem amtlichen Lauf und aus den Anschaffungskosten ──── */
  function basis() {
    var r = window._lastBmfResults;
    if (!r) return null;
    var kp = zahl(el('ak_kp') && el('ak_kp').value) || zahl(el('kp') && el('kp').value);
    var boden = zahl(wert(r.bodenwert));
    var gebPct = zahl(wert(r.gebaeudeanteil_prozent));
    if (kp == null || gebPct == null) return null;
    /* Inventar gehoert nicht in die Aufteilung (Phase 6 der Pipeline). */
    var inv = ['inv_kueche', 'inv_moebel', 'inv_geraete', 'inv_pv', 'inv_stellplatz', 'inv_sonst']
      .reduce(function (a, i) { return a + (zahl(el(i) && el(i).value) || 0); }, 0);
    var immoKp = Math.max(0, kp - inv);
    /* Nebenkosten aus dem Reiter Anschaffungskosten — sie teilen sich im
       selben Verhaeltnis und gehoeren in die AfA-Bemessungsgrundlage. */
    /* Feldnamen am Modal gemessen (v1471): gba statt grundbuch, gutachten
       statt gutachter, dazu anwalt und ji. */
    var nkFelder = ['ak_grest', 'ak_notar', 'ak_gba', 'ak_makler', 'ak_gutachten', 'ak_anwalt', 'ak_ji', 'ak_fahrt', 'ak_verpfl', 'ak_hotel', 'ak_sonst'];
    var nk = nkFelder.reduce(function (a, i) { return a + (zahl(el(i) && el(i).value) || 0); }, 0);
    return { kp: kp, inv: inv, immoKp: immoKp, nk: nk, gebPct: gebPct, boden: boden,
      gebAmtlich: immoKp * gebPct / 100, bodenAmtlich: immoKp * (100 - gebPct) / 100 };
  }

  function afaSatz() {
    var s = el('afa_satz');
    var v = s ? zahl(s.value) : null;
    return (v && v > 0) ? v : 2;
  }

  /* ── Reiter und Blatt einhaengen ──────────────────────────────────── */
  function einhaengen() {
    var leiste = document.querySelector('.bmfmo-tab');
    if (!leiste || el('bmf-boden-tab')) return !!el('bmf-boden-tab');
    var bar = leiste.parentNode;
    var b = document.createElement('button');
    b.className = 'bmfmo-tab'; b.id = 'bmf-boden-tab'; b.dataset.pane = PANE;
    b.textContent = 'Bodenabschlag';
    b.onclick = function () { if (typeof window.switchPane === 'function') window.switchPane(PANE); rechnen(); };
    bar.appendChild(b);

    var vorlage = el('p-hebel') || document.querySelector('.bmfmo-pane');
    if (!vorlage) return false;
    var p = document.createElement('div');
    p.className = 'bmfmo-pane'; p.id = PANE;
    p.innerHTML =
      '<div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin-bottom:6px">Szenario neben der amtlichen Aufteilung</div>' +
      '<h3 style="margin:0 0 6px;font:600 19px/1.3 \'Space Grotesk\',sans-serif">Abschlag auf den Grund und Boden</h3>' +
      '<p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:var(--muted,#6B6356)">Die Arbeitshilfe des BMF bindet das Finanzgericht nicht (BFH IX R 26/19). Wer eine niedrigere Bodenkomponente begründen kann, darf abweichend aufteilen. Dieses Blatt lässt die amtliche Zahl unangetastet und stellt das Szenario daneben.</p>' +
      '<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">' +
        '<label style="font-size:12px">Abschlag auf den Bodenwert<br><span style="display:inline-flex;align-items:center;gap:6px;margin-top:4px">' +
          '<input id="bmf-boden-pct" type="text" inputmode="decimal" value="20" style="width:70px;padding:7px 8px;border:1px solid #E6E0D3;border-radius:6px;font:14px Inter,sans-serif;text-align:right"><b>%</b></span></label>' +
        '<label style="font-size:12px;flex:1 1 320px">Begründung (kommt in den Vertragstext)<br>' +
          '<input id="bmf-boden-grund" type="text" value="" placeholder="z. B. Hinterlandanteil, Zuschnitt, Lärmbelastung, Bebauung nutzt den Boden nicht aus" style="width:100%;margin-top:4px;padding:7px 8px;border:1px solid #E6E0D3;border-radius:6px;font:13px Inter,sans-serif"></label>' +
      '</div>' +
      '<div id="bmf-boden-out"></div>' +
      '<div id="bmf-boden-klausel" style="margin-top:14px"></div>';
    vorlage.parentNode.appendChild(p);

    var f = el('bmf-boden-pct'), gr = el('bmf-boden-grund');
    if (f) f.addEventListener('input', rechnen);
    if (gr) gr.addEventListener('input', rechnen);
    return true;
  }

  /* ── Rechnen und zeichnen ─────────────────────────────────────────── */
  function rechnen() {
    var out = el('bmf-boden-out'); if (!out) return;
    var B = basis();
    if (!B) {
      out.innerHTML = '<div class="cf-hint">Zuerst im Reiter „BMF-Aufteilung" die amtliche Berechnung starten — dieses Blatt baut darauf auf.</div>';
      var k0 = el('bmf-boden-klausel'); if (k0) k0.innerHTML = '';
      return;
    }
    var ab = Math.min(90, Math.max(0, zahl(el('bmf-boden-pct') && el('bmf-boden-pct').value) || 0));
    var bodenNeu = B.bodenAmtlich * (1 - ab / 100);
    var gebNeu = B.immoKp - bodenNeu;
    var gebPctNeu = B.immoKp > 0 ? gebNeu / B.immoKp * 100 : 0;
    /* Nebenkosten teilen sich im jeweiligen Verhaeltnis mit auf. */
    var nkGebAlt = B.nk * B.gebPct / 100, nkGebNeu = B.nk * gebPctNeu / 100;
    var basisAlt = B.gebAmtlich + nkGebAlt, basisNeu = gebNeu + nkGebNeu;
    var satz = afaSatz();
    var afaAlt = basisAlt * satz / 100, afaNeu = basisNeu * satz / 100;

    function zeile(label, alt, neu, o) {
      o = o || {};
      var d = (typeof alt === 'number' && typeof neu === 'number') ? (neu - alt) : null;
      return '<tr' + (o.summe ? ' style="font-weight:600"' : '') + '>' +
        '<td style="padding:6px 8px 6px 0;border-bottom:1px solid #F0ECE3">' + label + '</td>' +
        '<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #F0ECE3">' + (o.fmt ? o.fmt(alt) : eur(alt)) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #F0ECE3">' + (o.fmt ? o.fmt(neu) : eur(neu)) + '</td>' +
        '<td style="padding:6px 0;text-align:right;border-bottom:1px solid #F0ECE3;color:' + (d > 0 ? '#2E8455' : (d < 0 ? '#B8625C' : 'inherit')) + '">' +
          (d == null ? '' : (d > 0 ? '+' : '') + (o.fmt ? o.fmt(d) : eur(d))) + '</td></tr>';
    }
    out.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:13.5px">' +
      '<thead><tr style="font-size:11px;color:var(--muted,#8A8272);text-transform:uppercase;letter-spacing:.06em">' +
        '<th style="text-align:left;padding-bottom:6px">Position</th>' +
        '<th style="text-align:right;padding-bottom:6px">Amtliche Arbeitshilfe</th>' +
        '<th style="text-align:right;padding-bottom:6px">Mit ' + pct(ab, 0) + ' Abschlag</th>' +
        '<th style="text-align:right;padding-bottom:6px">Unterschied</th></tr></thead><tbody>' +
      zeile('Kaufpreis (ohne Inventar)', B.immoKp, B.immoKp) +
      zeile('davon Grund und Boden', B.bodenAmtlich, bodenNeu) +
      zeile('davon Gebäude', B.gebAmtlich, gebNeu) +
      zeile('Gebäudeanteil', B.gebPct, gebPctNeu, { fmt: function (v) { return pct(v, 2); } }) +
      zeile('Anschaffungsnebenkosten auf das Gebäude', nkGebAlt, nkGebNeu) +
      zeile('AfA-Bemessungsgrundlage', basisAlt, basisNeu, { summe: true }) +
      zeile('AfA pro Jahr bei ' + pct(satz, 2), afaAlt, afaNeu, { summe: true }) +
      '</tbody></table>' +
      '<div class="cf-hint" style="margin-top:8px">Die linke Spalte ist das Ergebnis der amtlichen Arbeitshilfe und bleibt unverändert. Der Abschlag verschiebt nur, was auf den Boden entfällt — der Kaufpreis bleibt gleich. Ohne tragfähige Begründung trägt das Finanzamt die Aufteilung der Arbeitshilfe ein.</div>';

    klausel(B, ab, bodenNeu, gebNeu);
  }

  /* Vertragstext — dieselbe Form wie im Reiter „Hebel", aber mit dem
     Abschlag und seiner Begruendung. */
  function klausel(B, ab, bodenNeu, gebNeu) {
    var host = el('bmf-boden-klausel'); if (!host) return;
    function v(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
    var adr = ((v('str') + ' ' + v('hnr')).trim() + ', ' + (v('plz') + ' ' + v('ort')).trim()).replace(/^, |, $/, '');
    var grund = v('bmf-boden-grund');
    var txt =
      'Kaufpreisaufteilung\n\n' +
      'Die Vertragsparteien teilen den Gesamtkaufpreis in Höhe von ' + eur(B.kp, 2) +
      ' für das Objekt ' + (adr || '[Objektadresse]') + ' wie folgt auf:\n' +
      '  · auf den Grund und Boden entfallen ' + eur(bodenNeu, 2) + '\n' +
      '  · auf das Gebäude entfallen ' + eur(gebNeu, 2) + '\n' +
      (B.inv > 0 ? '  · auf mitverkauftes Inventar entfallen ' + eur(B.inv, 2) + '\n' : '') +
      '\nDie Aufteilung folgt der Arbeitshilfe des Bundesfinanzministeriums und berücksichtigt ' +
      'zusätzlich einen Abschlag von ' + pct(ab, 0) + ' auf den Bodenwert' +
      (grund ? ' wegen ' + grund : '') + '. Die Arbeitshilfe bindet das Gericht nicht ' +
      '(BFH, Urteil vom 21.07.2020, IX R 26/19); eine abweichende Aufteilung ist zulässig, wenn sie ' +
      'begründet ist. Die Aufteilung ist Grundlage für die Absetzung für Abnutzung nach § 7 EStG und ' +
      'steht unter dem Vorbehalt abweichender Feststellung durch das Finanzamt.';
    host.innerHTML =
      '<div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#8A8272);margin-bottom:6px">Text für den Kaufvertrag</div>' +
      '<textarea id="bmf-boden-klausel-text" readonly style="width:100%;min-height:150px;padding:10px 12px;border:1px solid #E6E0D3;border-radius:8px;font:12.5px/1.6 Inter,sans-serif;background:#FBFAF7;color:#2A2727"></textarea>' +
      '<div style="margin-top:6px"><button type="button" class="btn btn-outline btn-sm" id="bmf-boden-copy">Text kopieren</button>' +
      (grund ? '' : '<span class="cf-hint" style="margin-left:10px">Ohne Begründung bleibt der Abschlag angreifbar — sie gehört in den Text.</span>') + '</div>';
    el('bmf-boden-klausel-text').value = txt;
    el('bmf-boden-copy').onclick = function () {
      try { navigator.clipboard.writeText(txt); if (typeof window.toast === 'function') window.toast('✓ Text kopiert'); } catch (e) {}
    };
  }

  /* ── Start: das Modal wird erst beim Oeffnen nachgeladen ───────────
     v1471b: eine begrenzte Warteschleife lief ab, bevor der Nutzer das
     Fenster ueberhaupt geoeffnet hatte — dann fehlte der Reiter. Jetzt
     haengt der Einbau am Oeffnen selbst und zusaetzlich an einem Beobachter. */
  (function () {
    var alt = window.openBMFModal;
    function wickeln() {
      if (typeof window.openBMFModal !== 'function' || window.openBMFModal._dpBoden) return false;
      var o = window.openBMFModal;
      var neu = function () { var r = o.apply(this, arguments); setTimeout(function () { if (einhaengen()) rechnen(); }, 600); return r; };
      for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) neu[k] = o[k]; }
      neu._dpBoden = true; window.openBMFModal = neu; return true;
    }
    var n2 = 0;
    (function warten() { if (!wickeln() && ++n2 < 60) setTimeout(warten, 500); })();
    try {
      new MutationObserver(function () {
        if (document.querySelector('.bmfmo-tab') && !document.getElementById('bmf-boden-tab')) {
          if (einhaengen()) rechnen();
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  })();

  /* ── Start: warten, bis das Modal im DOM ist ──────────────────────── */
  var n = 0;
  function start() {
    if (einhaengen()) { rechnen(); return; }
    if (++n < 300) setTimeout(start, 500);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t && t.closest && t.closest('[onclick*="openBMF"], #bmf-open, [data-bmf-open]')) setTimeout(start, 400);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.DpBmfBodenabschlag = { rechnen: rechnen, einhaengen: einhaengen, _basis: basis };
})();
