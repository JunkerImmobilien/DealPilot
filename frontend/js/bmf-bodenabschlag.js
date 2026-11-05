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
    if (!(inv > 0) && typeof window.dpInventarSumme === 'function') inv = window.dpInventarSumme();   /* v2269: auch #moebl */
    var immoKp = Math.max(0, kp - inv);
    /* Nebenkosten aus dem Reiter Anschaffungskosten — sie teilen sich im
       selben Verhaeltnis und gehoeren in die AfA-Bemessungsgrundlage. */
    /* Feldnamen am Modal gemessen (v1471): gba statt grundbuch, gutachten
       statt gutachter, dazu anwalt und ji. */
    /* v1478 · Seit der Korrektur in bmf-modal.js gehen auch Fahrtkosten,
       Wertgutachten, Anwalt und Sonstiges in die amtliche Aufteilung — es sind
       Anschaffungsnebenkosten. Verpflegung und Uebernachtung bleiben draussen.
       Kosten, die erst die AfA ermitteln, stehen weiter unten als eigener
       Posten: sie sind sofort abziehbar und teilen sich NICHT auf. */
    var nkFelder = ['ak_grest', 'ak_notar', 'ak_gba', 'ak_makler', 'ak_ji',
      'ak_fahrt', 'ak_gutachten', 'ak_anwalt', 'ak_sonst'];
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
    /* v3184 · Marcel 05.11.2026: „den Punkt, der nicht nummeriert ist, Bodenabschlag, dass das vielleicht
       der fünfte Punkt wird, wo wir dann noch mal die Übersicht sehen, was ausgewählt ist und dass wir dort
       dann halt alle Exporte machen." Der Reiter heißt jetzt Schritt 5 und trägt eine Nummer wie die anderen. */
    b.innerHTML = '<span class="mtab-num">5</span> Übersicht &amp; Ausgabe';
    b.onclick = function () { if (typeof window.switchPane === 'function') window.switchPane(PANE); rechnen(); };
    bar.appendChild(b);

    var vorlage = el('p-hebel') || document.querySelector('.bmfmo-pane');
    if (!vorlage) return false;
    var p = document.createElement('div');
    p.className = 'bmfmo-pane'; p.id = PANE;
    var feld = 'width:100%;margin-top:4px;padding:8px 10px;border:1px solid #E6E0D3;border-radius:8px;font:13.5px Inter,sans-serif;background:#fff';
    var zwi = 'font:600 10.5px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6356;margin:18px 0 8px';
    p.innerHTML =
      '<div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin-bottom:6px">BMF-Rechner · Schritt 5 von 5</div>' +
      '<h3 style="margin:0 0 6px;font:600 20px/1.3 \'Space Grotesk\',sans-serif;color:#1a1814">Übersicht und Ausgabe</h3>' +
      '<p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#6B6356">Was gewählt ist, wie es begründet wird und was du daraus ausgibst – für Finanzamt, Notar und Steuerberater.</p>' +
      '<div id="bmf-boden-wahl"></div>' +
      '<div id="bmf-boden-out" style="margin-top:12px"></div>' +
      '<div style="' + zwi + '">Begründung und Restnutzungsdauer</div>' +
      '<div style="display:grid;grid-template-columns:minmax(260px,1fr) 250px;gap:12px 18px;align-items:start">' +
        '<label style="font-size:12px;color:#3a352b">Begründung (geht in Vertragstext und Berater-Text)<br>' +
          '<input id="bmf-boden-grund" type="text" value="" placeholder="z. B. Hinterlandanteil, Zuschnitt, Lärmbelastung" style="' + feld + '"></label>' +
        '<label style="font-size:12px;color:#3a352b">Restnutzungsdauer von / bis<br><span style="display:inline-flex;align-items:center;gap:6px;margin-top:4px">' +
          '<input id="bmf-boden-rnd-von" type="text" inputmode="numeric" style="width:64px;padding:8px;border:1px solid #E6E0D3;border-radius:8px;font:13.5px Inter,sans-serif;text-align:right">' +
          '<b>bis</b><input id="bmf-boden-rnd-bis" type="text" inputmode="numeric" style="width:64px;padding:8px;border:1px solid #E6E0D3;border-radius:8px;font:13.5px Inter,sans-serif;text-align:right"><b>Jahre</b></span></label>' +
        /* Der Abschlag wird in Schritt 4 gewählt - das Feld bleibt nur als Träger für den klassischen PDF-Weg */
        '<label style="display:none">Abschlag<select id="bmf-boden-pct">' +
          '<option value="0">Amtlich · kein Abschlag</option><option value="15">Konservativ · 15 %</option>' +
          '<option value="20" selected>Optimiert · 20 %</option><option value="25">25 %</option></select></label>' +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px">' +
        '<button type="button" class="btn btn-outline btn-sm" id="bmf-boden-rnd-rechnen">Restnutzungsdauer berechnen</button>' +
        '<div id="bmf-boden-rnd-info" style="font-size:11.5px;color:#8A8272;line-height:1.45;flex:1 1 320px">Steht eine Spanne, rechnet das PDF jedes Jahr darin einzeln durch.</div>' +
      '</div>' +
      '<div style="' + zwi + '">Ausgabe</div>' +
      '<div id="bmf-boden-ausgabe"></div>' +
      '<div id="bmf-boden-klausel" style="margin-top:14px"></div>' +
      '<div id="bmf-boden-zusatz"></div>';
    vorlage.parentNode.appendChild(p);

    /* v1495-reste: das Feld fuer sofort abzugsfaehige Kosten ist weg. */
    var f = el('bmf-boden-pct'), gr = el('bmf-boden-grund');
    if (f) { f.addEventListener('input', rechnen); f.addEventListener('change', rechnen); }
    if (gr) gr.addEventListener('input', rechnen);
    ['bmf-boden-rnd-von', 'bmf-boden-rnd-bis'].forEach(function (i) { var e = el(i); if (e) e.addEventListener('input', rechnen); });
    /* Vorbelegung aus der ermittelten Restnutzungsdauer: der Wert selbst und
       vier Jahre darueber — die Bandbreite, die auch im Gutachten steht. */
    try {
      var r0 = window._lastRndResult && window._lastRndResult.result && window._lastRndResult.result.final_rnd;
      if (r0 && el('bmf-boden-rnd-von') && !el('bmf-boden-rnd-von').value) {
        el('bmf-boden-rnd-von').value = String(Math.round(r0));
        el('bmf-boden-rnd-bis').value = String(Math.round(r0) + 4);
      }
    } catch (e) {}
    return true;
  }

  /* ── Rechnen und zeichnen ─────────────────────────────────────────── */
  /* v3184 · Die Auswahl kommt aus Schritt 4 (Wahl-Tafel), nicht mehr aus einem eigenen Feld.
     Drei Pipeline-Varianten über den Abschlag auf den Bodenwert, Jacoby über den Gebäudeanteil
     der umgekehrten Ertragswertmethode. Das versteckte Feld #bmf-boden-pct wird mitgeführt -
     der klassische PDF-Weg (pdf-kaufpreisaufteilung.js) liest es. */
  var NAME_WAHL = { amtlich: 'Amtlich (BMF-Arbeitshilfe)', konservativ: 'Konservativ · Boden −15 %', optimiert: 'Optimiert · Boden −20 %',
    aggressiv: 'Abschlag 25 % auf den Bodenwert', jacoby: 'Umgekehrte Ertragswertmethode nach Jacoby' };
  function auswahl(B) {
    B = B || basis(); if (!B) return null;
    var st = window._v292State || {};
    var wahl = window._dpBmfTafelWahl || st.selectedVariant || 'amtlich';
    /* v3184b · ein Pipeline-Ergebnis eines anderen Objekts zaehlt nicht (es bleibt nach dem Objektwechsel stehen, bis Schritt 2 neu rechnet) */
    var stEigen = !!(st.response && (!st.response._fuer || st.response._fuer === window._currentObjKey));
    var j = stEigen && st.response.phase4_bmf && st.response.phase4_bmf.jacoby;
    /* Die Wahl lebt nur im Fenster - der Gebäudeanteil im Reiter Steuer ist das, was gilt. Passt er zu
       einer der Varianten, ist DAS die Auswahl (so druckt auch die Deal-Aktion ohne offenes Fenster richtig). */
    /* v3188 · Marcel: gewählt wird in Schritt 4, übernommen erst in Schritt 5 - eine Wahl im Fenster gilt,
       auch wenn sie noch nicht im Reiter Steuer steht. Ohne Wahl gilt, was im Reiter Steuer steht. */
    if (!window._dpBmfTafelWahl) try {
      var gs = zahl(el('geb_ant') && el('geb_ant').value);
      if (gs != null && B.immoKp > 0) {
        var kand = [['amtlich', 0], ['konservativ', 15], ['optimiert', 20]].map(function (x) {
          return [x[0], (B.immoKp - B.bodenAmtlich * (1 - x[1] / 100)) / B.immoKp * 100];
        });
        if (j && j.verfuegbar) kand.push(['jacoby', Number(j.gebaeudeanteil_prozent)]);
        /* v3184b · Optimiert 79,86 % und Jacoby 79,88 % (Ravensberger Weg) liegen in derselben Toleranz: eine
           ausdrueckliche Wahl im Fenster geht vor, sonst die naechstgelegene Variante - nicht die erste der Liste. */
        var nah = kand.filter(function (x) { return Math.abs(x[1] - gs) < 0.15; });
        var ausdr = nah.filter(function (x) { return x[0] === window._dpBmfTafelWahl; })[0];
        nah.sort(function (p, q) { return Math.abs(p[1] - gs) - Math.abs(q[1] - gs); });
        if (ausdr) wahl = ausdr[0]; else if (nah.length) wahl = nah[0][0];
      }
    } catch (e) {}
    if (wahl === 'jacoby' && j && j.verfuegbar && j.gebaeudeanteil_prozent > 0 && j.gebaeudeanteil_prozent < 100) {
      var g = Number(Number(j.gebaeudeanteil_prozent).toFixed(2)), gebJ = B.immoKp * g / 100;
      return { id: 'jacoby', name: NAME_WAHL.jacoby, ab: null, gebNeu: gebJ, bodenNeu: B.immoKp - gebJ, gebPctNeu: g, jacoby: j, spalte: 'Nach Jacoby' };
    }
    if (wahl === 'jacoby') wahl = st.selectedVariant || 'amtlich';
    var ab = ABSCHLAG_JE_VARIANTE[wahl];
    if (ab == null) ab = Math.min(90, Math.max(0, zahl(el('bmf-boden-pct') && el('bmf-boden-pct').value) || 0));
    var f = el('bmf-boden-pct'); if (f && String(f.value) !== String(ab)) { window._dpBodenStillsetzen = true; try { f.value = String(ab); } finally { window._dpBodenStillsetzen = false; } }
    var bodenNeu = B.bodenAmtlich * (1 - ab / 100), gebNeu = B.immoKp - bodenNeu;
    return { id: wahl, name: NAME_WAHL[wahl] || ('Abschlag ' + ab + ' % auf den Bodenwert'), ab: ab, gebNeu: gebNeu, bodenNeu: bodenNeu,
      gebPctNeu: B.immoKp > 0 ? gebNeu / B.immoKp * 100 : 0, spalte: ab ? 'Mit ' + pct(ab, 0) + ' Abschlag' : 'Gewählt: amtlich' };
  }

  function rechnen() {
    var out = el('bmf-boden-out'); if (!out) return;
    var B = basis();
    if (!B) {
      out.innerHTML = '<div class="cf-hint">Zuerst in Schritt 2 die amtliche Berechnung abwarten – diese Übersicht baut darauf auf.</div>';
      ['bmf-boden-klausel', 'bmf-boden-zusatz', 'bmf-boden-wahl'].forEach(function (i) { var k0 = el(i); if (k0) k0.innerHTML = ''; });
      ausgabeZeichnen(false);
      return;
    }
    var W = auswahl(B);
    var bodenNeu = W.bodenNeu, gebNeu = W.gebNeu, gebPctNeu = W.gebPctNeu;
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
        '<td style="padding:6px 0;text-align:right;border-bottom:1px solid #F0ECE3;color:' + (d > 0.005 ? '#2E8455' : (d < -0.005 ? '#B8625C' : 'inherit')) + '">' +
          (d == null || Math.abs(d) < 0.005 ? '' : (d > 0 ? '+' : '') + (o.fmt ? o.fmt(d) : eur(d))) + '</td></tr>';
    }
    out.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:13.5px">' +
      '<thead><tr style="font-size:11px;color:var(--muted,#8A8272);text-transform:uppercase;letter-spacing:.06em">' +
        '<th style="text-align:left;padding-bottom:6px">Position</th>' +
        '<th style="text-align:right;padding-bottom:6px">Amtliche Arbeitshilfe</th>' +
        '<th style="text-align:right;padding-bottom:6px">' + W.spalte + '</th>' +
        '<th style="text-align:right;padding-bottom:6px">Unterschied</th></tr></thead><tbody>' +
      zeile('Kaufpreis (ohne Inventar)', B.immoKp, B.immoKp) +
      zeile('davon Grund und Boden', B.bodenAmtlich, bodenNeu) +
      zeile('davon Gebäude', B.gebAmtlich, gebNeu) +
      zeile('Gebäudeanteil', B.gebPct, gebPctNeu, { fmt: function (v) { return pct(v, 2); } }) +
      zeile('Anschaffungsnebenkosten auf das Gebäude', nkGebAlt, nkGebNeu) +
      zeile('AfA-Bemessungsgrundlage', basisAlt, basisNeu, { summe: true }) +
      zeile('AfA pro Jahr bei ' + pct(satz, 2), afaAlt, afaNeu, { summe: true }) +
      '</tbody></table>';

    wahlZeichnen(B, W, { basisNeu: basisNeu, afaNeu: afaNeu, satz: satz });
    klausel(B, W, bodenNeu, gebNeu, { basisNeu: basisNeu, afaNeu: afaNeu, satz: satz });
    ausgabeZeichnen(true);
  }

  /* Die Übersicht oben: was gewählt ist und ob es im Reiter Steuer angekommen ist. */
  function wahlZeichnen(B, W, X) {
    var host = el('bmf-boden-wahl'); if (!host) return;
    var g = el('geb_ant'), imReiter = g ? zahl(g.value) : null;
    var drin = imReiter != null && Math.abs(imReiter - W.gebPctNeu) < 0.06;
    host.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">' +
        kachel('Gewählt', W.name, W.id === 'amtlich' ? 'ohne Abweichung' : 'Abweichung braucht Begründung') +
        kachel('Gebäudeanteil', pct(W.gebPctNeu, 2), 'amtlich ' + pct(B.gebPct, 2)) +
        kachel('AfA je Jahr', eur(X.afaNeu), 'bei ' + pct(X.satz, 2) + ' auf ' + eur(X.basisNeu)) +
        '<div style="padding:12px 14px;border:1px solid ' + (drin ? '#CFE3D6' : '#EAD9B0') + ';border-radius:10px;background:' + (drin ? '#F3F9F5' : '#FBF6E9') + '">' +
          '<div style="font:600 10.5px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6356;margin-bottom:6px">Reiter Steuer</div>' +
          (drin
            ? '<div style="font:600 14px/1.35 Inter,sans-serif;color:#2E8455">✓ übernommen</div><div style="font-size:12px;color:#3a352b;margin-top:3px">Gebäudeanteil ' + pct(imReiter, 2) + '</div>'
            : '<div style="font-size:12.5px;color:#3a352b;line-height:1.45">' + (imReiter != null ? 'Dort stehen ' + pct(imReiter, 2) + '.' : 'Noch nicht übernommen.') + '</div>' +
              '<button type="button" id="bmf-boden-uebernehmen" class="btn btn-sm" style="margin-top:6px;background:var(--wl-c9a84c, #C9A84C);color:#050505;border:none;font-weight:700">Jetzt übernehmen</button>') +
        '</div>' +
      '</div>';
    var k = el('bmf-boden-uebernehmen');
    if (k) k.onclick = function () {
      if (window.DpBmfWahlTafel && typeof DpBmfWahlTafel.uebernehmen === 'function') DpBmfWahlTafel.uebernehmen(W.id);
      setTimeout(rechnen, 400);
    };
    function kachel(t, w, u) {
      return '<div style="padding:12px 14px;border:1px solid #E6E0D3;border-radius:10px;background:#FFFFFF">' +
        '<div style="font:600 10.5px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6356;margin-bottom:6px">' + t + '</div>' +
        '<div style="font:600 14.5px/1.35 Inter,sans-serif;color:#1a1814">' + w + '</div>' +
        '<div style="font-size:11.5px;color:#6B6356;margin-top:3px">' + u + '</div></div>';
    }
  }

  /* Die Ausgaben als Karten - dieselben Wege wie in der Deal-Aktion (bmf-ausgabe.js). */
  function ausgabeZeichnen(bereit) {
    var host = el('bmf-boden-ausgabe'); if (!host) return;
    var K = [
      ['kpa', 'Kaufpreisaufteilung', 'PDF', 'Herleitung, gewählte Aufteilung und Vertragstext – Anlage für Finanzamt und Berater'],
      ['ah', 'BMF-Arbeitshilfe', 'PDF', 'Das amtliche Formular, mit den Werten dieses Objekts ausgefüllt'],
      ['xlsx', 'BMF-Original', 'XLSX', 'Die Arbeitshilfe (Fassung Juni 2023) als Excel-Datei'],
      ['berater', 'Text für den Berater', 'Kopieren', 'Kurzfassung mit Zahlen und Begründung für den Steuerberater'],
      ['vertrag', 'Text für den Kaufvertrag', 'Kopieren', 'Der Satz für die Urkunde – Grund und Boden, Gebäude, Inventar'],
      /* v3188 · Marcel: „wenn wir hinten bei der Übersicht … eine Anfrage machen … Gutachten“ - geht mit Objekt,
         Berater-Text und Kaufpreisaufteilung-PDF an DealPilot (deal-action.js openExpert, Leistung kaufpreisaufteilung) */
      ['gutachten', 'Gutachten anfragen', 'Anfrage', 'Kaufpreisaufteilung durch einen Sachverständigen – Objekt und Berechnung gehen mit']
    ];
    host.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">' +
      K.map(function (k) {
        return '<button type="button" data-ausgabe="' + k[0] + '"' + (bereit ? '' : ' disabled') + ' style="text-align:left;padding:12px 14px;border:1px solid #E6E0D3;border-radius:12px;background:' + (bereit ? '#FFFFFF' : '#F7F5F0') + ';cursor:' + (bereit ? 'pointer' : 'not-allowed') + ';display:flex;flex-direction:column;gap:4px;min-height:96px">' +
          '<span style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font:600 14px/1.3 Inter,sans-serif;color:#1a1814">' + k[1] + '</b>' +
          '<span style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:.06em;padding:4px 7px;border-radius:6px;background:' + (bereit ? 'var(--wl-c9a84c, #C9A84C)' : '#E6E0D3') + ';color:#050505">' + k[2] + '</span></span>' +
          '<span style="font-size:12px;line-height:1.45;color:#6B6356">' + (bereit ? k[3] : 'Fehlen noch Werte – erst Schritt 2 rechnen.') + '</span></button>';
      }).join('') + '</div>';
    [].forEach.call(host.querySelectorAll('[data-ausgabe]'), function (b) {
      b.addEventListener('click', function () {
        var A = window.DpBmfAusgabe, was = b.getAttribute('data-ausgabe'), T = window._dpKpaTexte || {};
        function kopieren(t, wort) {
          try { navigator.clipboard.writeText(t || ''); if (window.toast) window.toast('✓ ' + wort + ' kopiert'); } catch (e) {}
        }
        if (was === 'kpa') return A ? A.kaufpreisaufteilung() : (window.exportPDFKaufpreisaufteilung && window.exportPDFKaufpreisaufteilung());
        if (was === 'ah') return A && A.arbeitshilfe();
        if (was === 'xlsx') return A ? A.xlsx() : (window.downloadXlsx && window.downloadXlsx());
        if (was === 'berater') return kopieren(T.berater, 'Text für den Berater');
        if (was === 'vertrag') return kopieren(T.klausel, 'Text für den Kaufvertrag');
        if (was === 'gutachten') {
          if (window.DealPilotDealAction && typeof DealPilotDealAction.openExpert === 'function') {
            try { if (typeof window.closeBMFModal === 'function') window.closeBMFModal(); } catch (e) {}
            return DealPilotDealAction.openExpert({ typ: 'kaufpreisaufteilung', text: T.berater || '' });
          }
          if (window.toast) window.toast('Anfrage nicht geladen.');
        }
      });
    });
  }

  /* Vertragstext und Berater-Text - der Wortlaut nach Marcels Vorlage vom 21.09.2026 (v1478/v1495). */
  function klausel(B, W, bodenNeu, gebNeu, X) {
    var host = el('bmf-boden-klausel'); if (!host) return;
    function v(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
    var adr = ((v('str') + ' ' + v('hnr')).trim() + ', ' + (v('plz') + ' ' + v('ort')).trim()).replace(/^, |, $/, '');
    var grund = v('bmf-boden-grund');
    var rnd = null;
    try { rnd = window._lastRndResult && window._lastRndResult.result && window._lastRndResult.result.final_rnd; } catch (e) {}
    var rVon = zahl(v('bmf-boden-rnd-von')), rBis = zahl(v('bmf-boden-rnd-bis'));
    var verfahren = null;
    try { verfahren = window._lastBmfResults && window._lastBmfResults.ertragswert && window._lastBmfResults.ertragswert.value ? 'Ertragswertverfahren' : 'Sachwertverfahren'; } catch (e) {}
    var brw = zahl(el('bmf_brw') && el('bmf_brw').value) || zahl(el('brw') && el('brw').value);
    var gsfl = zahl(el('bmf_gsfl') && el('bmf_gsfl').value) || zahl(el('gsfl') && el('gsfl').value);
    var txt =
      'Hiermit erklären die Vertragsparteien rechtsverbindlich:\n\n' +
      'Der vereinbarte Gesamtkaufpreis in Höhe von ' + eur(B.kp, 2) + ' für das in der Vertragsurkunde ' +
      'näher bezeichnete Objekt ' + (adr || '[Objektadresse]') + ' entfällt nach übereinstimmender ' +
      'Bewertung wie folgt: Auf den Grund und Boden entfallen ' + eur(bodenNeu, 2) + ', auf das ' +
      'Gebäude einschließlich der wesentlichen Gebäudeteile entfallen ' + eur(gebNeu, 2) +
      (B.inv > 0 ? ' und auf das mitverkaufte Inventar entfallen ' + eur(B.inv, 2) : '') + '.\n' +
      /* v3188 · Marcel 05.11.2026: im Text für den Kaufvertrag „noch mal reinschreiben, dass das damit ermittelt wurde“ */
      (W.id === 'jacoby' ? 'Die Aufteilung wurde nach der umgekehrten Ertragswertmethode (Jacoby) ermittelt.\n'
        : W.ab > 0 ? 'Die Aufteilung wurde auf Grundlage der Arbeitshilfe des Bundesministeriums der Finanzen mit einem Abschlag von ' + pct(W.ab, 0) + ' auf den Bodenwert ermittelt.\n'
        : 'Die Aufteilung wurde nach der Arbeitshilfe des Bundesministeriums der Finanzen ermittelt.\n');
    var hinweis = 'Diese Aufteilung hat verbindlichen Charakter und ist wirtschaftlich angemessen im Sinne ' +
      'der Rechtsprechung des Bundesfinanzhofs (BFH, Urteil vom 21.07.2020, IX R 26/19).';
    /* Begründung je Auswahl - die Punkte werden fortlaufend nummeriert */
    var P = [];
    P.push('Verfahren. Die Aufteilung folgt der Arbeitshilfe des Bundesfinanzministeriums (Fassung Juni 2023). ' +
      'Maßgeblich ist das ' + (verfahren || 'dort vorgesehene Verfahren') + ', weil es der Grundstücksart entspricht. ' +
      'Der Bodenwert ergibt sich aus Grundstücksfläche und amtlichem Bodenrichtwert, der Gebäudeanteil als ' +
      'Differenz zum maßgebenden Verkehrswert' +
      (brw && gsfl ? '. Angesetzt wurde der lagespezifische Bodenrichtwert von ' + eur(brw, 0) + ' je m² für ' +
        new Intl.NumberFormat('de-DE').format(gsfl) + ' m² Grundstücksfläche' : '') + '.');
    if (W.id === 'jacoby') {
      var j = W.jacoby || {};
      P.push('Umgekehrte Ertragswertmethode. Abweichend von der Arbeitshilfe wurde der Gebäudeanteil nach der ' +
        'umgekehrten Ertragswertmethode (Jacoby) ermittelt: Vom Kaufpreis wird der Bodenwert abgezogen, der Rest über die ' +
        'Restnutzungsdauer' + (j.rnd_jahre ? ' von ' + j.rnd_jahre + ' Jahren' : '') + ' mit dem Liegenschaftszinssatz' +
        (j.lzs_pct != null ? ' von ' + String(j.lzs_pct).replace('.', ',') + ' %' : '') + ' auf den jährlichen Reinertrag ' +
        'zurückgerechnet und der Bodenrestwert nach Ablauf der Restnutzungsdauer dem Boden zugeschlagen. Der Gebäudeanteil ' +
        'beträgt danach ' + pct(W.gebPctNeu, 2) + (grund ? '; ergänzend begründet mit ' + grund : '') + '. Die Methode ist für ' +
        'vermietete Objekte zulässig (BFH, Urteil vom 20.09.2022, IX R 12/21).');
    } else if (W.ab > 0) {
      P.push('Bodenwertabschlag. Auf den so ermittelten Bodenwert wurde ein Abschlag von ' + pct(W.ab, 0) + ' angesetzt' +
        (grund ? ', begründet mit ' + grund : '') + '. Der Bodenrichtwert gilt für ein Grundstück mit den ' +
        'Merkmalen des Richtwertgrundstücks; weicht das bewertete Grundstück davon ab, ist der Wert anzupassen ' +
        '(§ 196 Abs. 1 Satz 3 BauGB in Verbindung mit § 15 ImmoWertV).');
    }
    P.push('Bindungswirkung. Die Arbeitshilfe ist ein Schätzhilfsmittel und bindet weder die Beteiligten noch ' +
      'die Gerichte (BFH, Urteil vom 21.07.2020, IX R 26/19). Eine vertragliche Aufteilung ist der Besteuerung ' +
      'zugrunde zu legen, solange sie wirtschaftlich vernünftig ist und keine nennenswerten Zweifel an ihrer ' +
      'Angemessenheit bestehen (BFH, Urteil vom 16.09.2015, IX R 12/14). Eine pauschale Aufteilung im ' +
      'Verhältnis 80/20 wäre im konkreten Fall nicht sachgerecht; eine abweichende Wertfeststellung ' +
      'durch das Finanzamt setzt eine substantiierte Gegenbewertung voraus (vgl. § 199 BewG).');
    if (rnd) P.push('Restnutzungsdauer. Für das Gebäude wurde eine Restnutzungsdauer von ' + Math.round(rnd) + ' Jahren ' +
      'ermittelt; die Abschreibung folgt § 7 Abs. 4 Satz 2 EStG. Die Herleitung liegt als gesonderte Berechnung bei.');
    var zusatz = 'Ergänzende Begründung der Aufteilung (auf Anforderung des Finanzamts)\n\n' +
      P.map(function (t, i) { return (i + 1) + '. ' + t; }).join('\n\n') + '\n\n' +
      'Die vollständige Herleitung mit allen Eingangswerten ist der beigefügten Kaufpreisaufteilung zu entnehmen.';
    /* v3184 · Marcel: „Ziel ist halt, dass wir einen Text für den Berater bekommen" */
    var berater =
      'Kaufpreisaufteilung ' + (adr || '[Objektadresse]') + '\n\n' +
      'Gewählt: ' + W.name + '. Gebäudeanteil ' + pct(W.gebPctNeu, 2) + (W.id === 'amtlich' ? '' : ' (amtliche Arbeitshilfe: ' + pct(B.gebPct, 2) + ')') + '.\n' +
      'Kaufpreis ' + eur(B.immoKp, 2) + ' ohne Inventar: Grund und Boden ' + eur(bodenNeu, 2) + ', Gebäude ' + eur(gebNeu, 2) +
      (B.inv > 0 ? '; Inventar ' + eur(B.inv, 2) + ' mit eigener AfA' : '') + '.\n' +
      'AfA-Bemessungsgrundlage Gebäude einschließlich anteiliger Nebenkosten: ' + eur(X.basisNeu, 2) + '; AfA ' + pct(X.satz, 2) + ' = ' + eur(X.afaNeu, 2) + ' je Jahr.\n' +
      (grund ? 'Begründung: ' + grund + '.\n' : (W.id === 'amtlich' ? '' : 'Begründung: noch einzutragen.\n')) +
      (rVon ? 'Restnutzungsdauer: ' + rVon + (rBis && rBis !== rVon ? ' bis ' + rBis : '') + ' Jahre.\n' : '') +
      '\nAnlagen: Kaufpreisaufteilung (PDF) mit Herleitung und Vertragstext, ausgefüllte BMF-Arbeitshilfe. ' +
      'Bitte prüfen und für die Anlage V übernehmen.\n\n' + zusatz;

    var ta = 'width:100%;padding:10px 12px;border:1px solid #E6E0D3;border-radius:8px;font:12.5px/1.6 Inter,sans-serif;background:#FBFAF7;color:#2A2727';
    var sum = 'cursor:pointer;font:600 13px Inter,sans-serif;color:#1a1814;padding:8px 0';
    host.innerHTML =
      '<details open style="border-top:1px solid #EEEAE1;padding-top:6px"><summary style="' + sum + '">Text für den Kaufvertrag</summary>' +
      '<textarea id="bmf-boden-klausel-text" readonly style="' + ta + ';min-height:120px"></textarea>' +
      '<div id="bmf-boden-hinweis" style="margin-top:6px;font-size:11.5px;color:#6B6356;line-height:1.5"></div>' +
      '<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="btn btn-outline btn-sm" id="bmf-boden-copy">Text kopieren</button>' +
      (grund || W.id === 'amtlich' ? '' : '<span class="cf-hint">Ohne Begründung bleibt die Abweichung angreifbar – sie gehört in den Text.</span>') + '</div></details>';
    el('bmf-boden-klausel-text').value = txt;
    el('bmf-boden-hinweis').textContent = hinweis;
    var zHost = el('bmf-boden-zusatz');
    if (zHost) {
      zHost.innerHTML =
        '<details style="border-top:1px solid #EEEAE1;padding-top:6px;margin-top:10px"><summary style="' + sum + '">Text für den Steuerberater</summary>' +
        '<textarea id="bmf-boden-zusatz-text" readonly style="' + ta + ';min-height:200px"></textarea>' +
        '<div style="margin-top:6px"><button type="button" class="btn btn-outline btn-sm" id="bmf-boden-zusatz-copy">Text kopieren</button></div></details>';
      el('bmf-boden-zusatz-text').value = berater;
      el('bmf-boden-zusatz-copy').onclick = function () {
        try { navigator.clipboard.writeText(berater); if (typeof window.toast === 'function') window.toast('✓ Text für den Berater kopiert'); } catch (e) {}
      };
    }
    window._dpKpaTexte = { klausel: txt, zusatz: zusatz, hinweis: hinweis, berater: berater, wahl: W.id, name: W.name, jacoby: W.jacoby || null,
      gebPct: W.gebPctNeu, boden: bodenNeu, geb: gebNeu, basis: X.basisNeu, afa: X.afaNeu, satz: X.satz, grund: grund,
      rndVon: rVon, rndBis: rBis, ab: W.ab, gebPctAmtlich: B.gebPct, bodenAmtlich: B.bodenAmtlich, gebAmtlich: B.gebAmtlich, immoKp: B.immoKp, inv: B.inv, kp: B.kp };
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
      var neu = function () { window._dpBmfTafelWahl = null; /* v3188: jede Sitzung beginnt beim Reiter Steuer */ var r = o.apply(this, arguments); setTimeout(function () { if (einhaengen()) rechnen(); }, 600); return r; };
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
  /* v1472 · GEMESSEN am Objekt Rinteln: die Live-Aktualisierung der Pipeline
     haengt an Bodenrichtwert, Flaeche, Baujahr, Datum und Miete — NICHT an der
     GRUNDSTUECKSART (#bmf_art). Wer sie korrigiert (hier: Wohnungseigentum ->
     Mietwohngrundstueck), bekam in Reiter 2 die neue Zahl (80,59 % Gebaeude),
     in Reiter 3 und 4 aber weiter die alte (81,54 %) — zwei Aufteilungen im
     selben Fenster. Die Art wird hier nachtraeglich angehaengt. */
  (function () {
    var n3 = 0;
    (function haengen() {
      var a = document.getElementById('bmf_art');
      if (a && typeof window._v292Pipeline === 'function' && !a._dpArtSync) {
        a._dpArtSync = true;
        a.addEventListener('change', function () {
          try { window._v292Pipeline(); } catch (e) {}
          setTimeout(rechnen, 1200);
        });
        return;
      }
      if (++n3 < 120) setTimeout(haengen, 700);
    })();
  })();

  /* v1474 · Die Umhuellung von _v292CollectInputs ist entfallen: die
     Grundstuecksart wird jetzt an der QUELLE gelesen (bmf-modal-v292.js,
     v1474, Freigabe Marcel 21.09.2026). Zwei Stellen fuer dieselbe Regel
     waeren eine Falle fuer den naechsten Leser. */

  /* v1485 · gemessen: nach runBmf() stand im Reiter weiter "zuerst die
     amtliche Berechnung starten", bis man den Reiter erneut anklickte. Der
     Lauf wird deshalb umhuellt und das Blatt danach neu gezeichnet. */
  (function () {
    var n5 = 0;
    (function wickeln() {
      var f = window.runBmf;
      if (typeof f === 'function' && !f._dpBoden) {
        var neuF = function () {
          var r = f.apply(this, arguments);
          var vorher = window._lastBmfResults, versuche = 0;
          var t = setInterval(function () {
            if (window._lastBmfResults && window._lastBmfResults !== vorher) { clearInterval(t); rechnen(); }
            else if (++versuche > 40) clearInterval(t);
          }, 800);
          return r;
        };
        for (var k in f) { if (Object.prototype.hasOwnProperty.call(f, k)) neuF[k] = f[k]; }
        neuF._dpBoden = true; window.runBmf = neuF;
        return;
      }
      if (++n5 < 120) setTimeout(wickeln, 700);
    })();
  })();

  window.DpBmfBodenabschlag = { rechnen: rechnen, einhaengen: einhaengen, _basis: basis, auswahl: function () { return auswahl(); } };

  /* v1491 · Marcel 21.09.2026: "auf der letzten Seite, dass wenn man das
     auswaehlt, dass das auch uebernommen wird und man dort nicht einfach eine
     Zahl eingeben kann. Vielleicht machen wir das so, dass man sie aendern
     koennte."
     Also: die Wahl in Reiter 4 setzt den Abschlag hier. Das Feld bleibt
     editierbar - wer eine eigene Zahl braucht, traegt sie ein, und die
     Herkunftszeile sagt dann, dass sie von Hand kommt. Ein gesperrtes Feld
     haette den Fall "ich brauche 18 %" unmoeglich gemacht. */
  var ABSCHLAG_JE_VARIANTE = { amtlich: 0, konservativ: 15, optimiert: 20, aggressiv: 25 };

  window._dpBodenAusVariante = function (name) {
    var pct = ABSCHLAG_JE_VARIANTE[name];
    if (pct == null) return;
    var feld = el('bmf-boden-pct');
    if (!feld) return;
    feld.value = String(pct);
    window._dpBodenQuelle = name;
    herkunftZeigen(name);
    try { rechnen(); } catch (e) { console.warn('[v1491] rechnen:', e.message); }
  };

  function herkunftZeigen(name) {
    var feld = el('bmf-boden-pct'); if (!feld) return;
    var box = el('bmf-boden-herkunft');
    if (!box) {
      box = document.createElement('div');
      box.id = 'bmf-boden-herkunft';
      box.className = 'cf-hint';
      box.style.cssText = 'margin-top:4px;font-size:11.5px';
      var heim = feld.closest ? feld.closest('label') : null;
      (heim || feld.parentNode).appendChild(box);
    }
    var namen = { amtlich: 'Amtlich', konservativ: 'Konservativ', optimiert: 'Optimiert', aggressiv: 'Aggressiv' };
    /* v1492: ae/oe/ue gehoeren in Kommentare, nicht in Nutztext. */
    box.textContent = name
      ? 'Übernommen aus Reiter 4, Variante ' + (namen[name] || name) + '. Änderbar.'
      : 'Von Hand eingetragen.';
  }

  /* Wer die Zahl selbst aendert, hat sie selbst gewaehlt. */
  document.addEventListener('input', function (ev) {
    if (!ev.target || ev.target.id !== 'bmf-boden-pct') return;
    /* v1500b: auch die Auswahl von Hand zaehlt als eigene Wahl. */
    if (window._dpBodenStillsetzen) return;
    window._dpBodenQuelle = null;
    herkunftZeigen(null);
  });


  /* v1492 · Marcel 21.09.2026: "bei der Restnutzungsdauer koennte man das
     Objekt ja einmal durch den Restnutzungsdauerrechner geben. Vielleicht
     macht man da auch einfach, wenn noch Daten fehlen, einen Button rein und
     wuerde dann die Restnutzungsdauer einmal berechnen."
     Der Knopf rechnet mit demselben Kern wie das Restnutzungsdauergutachten
     (window.DealPilotRND.calcAll) - kein zweiter Rechenweg. Gefuellt werden
     beide Felder: die technische Restnutzungsdauer als Untergrenze und das
     Punktraster nach Anlage 2 als Obergrenze. Wo beide gleich sind, steht
     eine Zahl statt einer Spanne. */
  function rndRechnen() {
    var info = el('bmf-boden-rnd-info');
    function sagen(t) { if (info) info.textContent = t; }
    /* v3044 · Marcel 29.10.2026 (Hüllhorst): „mit Klick direkt auf 46-51 Jahre … warum öffnet sich nicht das
       RND-Modal?" Der Knopf rechnete bisher SELBST aus den Modernisierungs-Auswahlen des BMF-Reiters und
       öffnete den Assistenten nur bei Lücken - der Marktbericht rechnet aber mit den Angaben aus dem Reiter
       Objekt (Hüllhorst 41,7 J.). Zwei Wege, zwei Zahlen. Jetzt immer der Assistent (rnd-wizard.js, Kern
       rnd-calc.js) mit der Vorbefüllung aus dem Objekt; die eigene Rechnung darunter bleibt nur als
       Rückfall, wenn der Assistent nicht geladen ist. */
    if (wizardOeffnen('')) return;

    if (!window.DealPilotRND || typeof window.DealPilotRND.calcAll !== 'function') {
      sagen('Der Restnutzungsdauer-Rechner ist nicht geladen.'); return;
    }
    var bj = zahl((el('bmf_bj') && el('bmf_bj').value) || (el('baujahr') && el('baujahr').value));
    if (!bj || bj < 1500) { sagen('Ohne Baujahr geht es nicht — es steht im Reiter Objekt.'); return; }

    /* v1501: Die Gesamtnutzungsdauer kommt aus der Grundstuecksart. Steht
       dort nichts, wird NICHT stillschweigend mit 80 gerechnet - dann fehlt
       eine Angabe, und das gehoert gesagt. */
    var gnd = 0, gndQuelle = '';
    try {
      var art = String((el('objart') && el('objart').value) || '').toUpperCase();
      var typId = ({ ETW: 'etw', MFH: 'mfh', EFH: 'efh', ZFH: 'efh', DHH: 'efh', RH: 'efh',
                     BUERO: 'buero', GESCH: 'geschaeft' })[art] || 'mfh';
      if (art && window.DealPilotRND_GND && window.DealPilotRND_GND.getDefault) {
        gnd = Number(window.DealPilotRND_GND.getDefault(typId)) || 0;
        gndQuelle = art;
      }
    } catch (e) {}

    /* Modernisierungen: die Auswahl aus Reiter 2 zaehlt, nicht eine Annahme. */
    /* v1501 · Marcel: "was passiert, wenn welche fehlen? Wir sollten schon
       drauf achten, dass dort die Pflichtfelder ausgefuellt werden."
       Gemessen an Rinteln: alle acht Modernisierungsfelder standen auf
       'nein' - das ist die Vorbelegung der Liste, nicht die Aussage 'nichts
       wurde gemacht'. Der Knopf hat daraus 'alles veraltet' gemacht und eine
       Restnutzungsdauer von 18 Jahren gerechnet. Eine nicht gestellte Frage
       darf nicht als Antwort gelten.
       Darum: fehlen Angaben, oeffnet sich derselbe Wizard wie im Reiter
       Steuer - mit derselben Vorbefuellung - und sein Ergebnis kommt zurueck
       in die Felder. */
    var GEWERKE = { bmf_mod_dach: 'dach', bmf_mod_fenster: 'fenster', mod_leit: 'leitungen',
                    mod_heiz: 'heizung', mod_daemm: 'aussenwand', mod_bad: 'baeder',
                    mod_innen: 'innenausbau', mod_grdr: 'grundriss' };
    /* ── v2075 · DIE PUNKTE KOMMEN AUS DEM KERN ──────────────────────────
       HIER WURDEN SIE SELBST VERGEBEN, mit pauschal 2 je Bauteil. Anlage 2
       gibt Dach und Aussenwand aber je 4; die Summe ist 20, nicht 16.
       Gemessen am 10.10.2026: ein voll modernisiertes Objekt bekam hier 16
       statt 20 Punkte, bei Alter 64 und GND 80 sind das 3,11 Jahre
       Restnutzungsdauer. Dasselbe Objekt rechnete im Wizard anders als
       hier - lautlos, weil beide Zahlen plausibel aussehen.

       Es war die vierte Stelle, die Punkte vergibt. Jetzt vergibt sie der
       Kern (`DealPilotRND.punkteAusJaTeilNein`), und die Gewerke-Grade
       bleiben hier - die beschreiben den ZUSTAND, nicht die Punkte. */
    var werte = {}, bewertung = {}, gezaehlt = 0;
    Object.keys(GEWERKE).forEach(function (id) {
      var e = el(id); if (!e) return;
      var v = String(e.value || '').toLowerCase();
      gezaehlt++;
      werte[GEWERKE[id]] = v;
      /* v2943: modernisiert = erneuert (Gutachten: „aktueller Standard"), nicht gehoben */
      if (v === 'ja' || v === 'voll' || v === 'v') bewertung[GEWERKE[id]] = 'erneuert';
      else if (v === 'teil' || v === 'teilweise' || v === 'h') bewertung[GEWERKE[id]] = 'standard';
      else bewertung[GEWERKE[id]] = 'veraltet';
    });
    var pk = (window.DealPilotRND && window.DealPilotRND.punkteAusJaTeilNein)
      ? window.DealPilotRND.punkteAusJaTeilNein(werte)
      : { total: 0, bewertet: 0 };
    var punkte = pk.total, bewertet = pk.bewertet;

    var luecken = [];
    if (!gnd) luecken.push('die Objektart');
    if (!bewertet) luecken.push('der Modernisierungsstand');
    if (luecken.length) {
      var fehltTxt = luecken.length > 1
        ? 'Dafür fehlen noch ' + luecken.join(' und ') + '.'
        : 'Dafür fehlt noch ' + luecken[0] + '.';
      if (wizardOeffnen(fehltTxt)) return;
      sagen(fehltTxt + ' Bitte im Reiter BMF-Aufteilung ergänzen.');
      return;
    }

    var stichtag = (el('bmf_datum') && el('bmf_datum').value)
                || (el('kaufdat') && el('kaufdat').value)
                || new Date().toISOString().slice(0, 10);

    var r;
    try {
      r = window.DealPilotRND.calcAll({ baujahr: bj, stichtag: stichtag, gnd: gnd,
                                        modPoints: punkte, gewerkeBewertung: bewertung });
    } catch (e) { sagen('Die Berechnung ist gescheitert: ' + e.message); return; }
    if (!r) { sagen('Die Berechnung hat nichts geliefert.'); return; }

    var tech = Math.round(Number(r.methods && r.methods.technisch && r.methods.technisch.restnutzungsdauer) || 0);
    var raster = Math.round(Number(r.methods && r.methods.punktraster && r.methods.punktraster.restnutzungsdauer) || 0);
    var werte = [tech, raster].filter(function (x) { return x > 0; });
    if (!werte.length) { sagen('Es kam keine brauchbare Restnutzungsdauer heraus.'); return; }
    var von = Math.min.apply(null, werte), bis = Math.max.apply(null, werte);

    spanneSetzen(von, bis);
    window._lastRndResult = { result: r };
    sagen('Baujahr ' + bj + ', Gesamtnutzungsdauer ' + gnd + ' Jahre' +
          (gndQuelle ? ' (' + gndQuelle + ')' : '') + ', ' + bewertet + ' von ' + gezaehlt +
          ' Gewerken bewertet, ' + punkte + ' von ' + (gezaehlt * 2) + ' Punkten. ' +
          'Technisch ' + tech + ' Jahre, nach Anlage 2 ' + raster + ' Jahre.');
    try { rechnen(); } catch (e) {}
  }

  /* v1502: eine Stelle, die die Spanne setzt - egal ob sie aus dem Knopf
     oder aus dem Wizard kommt. */
  function spanneSetzen(von, bis) {
    window._dpBodenStillsetzen = true;
    try {
      if (el('bmf-boden-rnd-von')) el('bmf-boden-rnd-von').value = String(von);
      if (el('bmf-boden-rnd-bis')) el('bmf-boden-rnd-bis').value = String(bis === von ? '' : bis);
    } finally { window._dpBodenStillsetzen = false; }
  }

  /* v1502 · Marcel: "im Tab Steuer kommt ein Modal." Genau das kommt jetzt
     auch hier - derselbe Wizard, dieselbe Vorbefuellung. Neu ist nur, was
     danach passiert: sein Ergebnis landet in den beiden Feldern, statt den
     Nutzer die Zahl abschreiben zu lassen. */
  function wizardOeffnen(fehltTxt) {
    var DA = window.DealPilotDealAction || {};
    var W  = window.DealPilotRND_Wizard;
    if (!W || typeof W.open !== 'function' || typeof DA.getRndPrefill !== 'function') return false;
    var info = el('bmf-boden-rnd-info');
    if (info) info.textContent = (fehltTxt ? fehltTxt + ' ' : '') + 'Der Restnutzungsdauer-Rechner ist geöffnet.';
    try {
      W.open({
        /* v1506: der Wizard soll hier einen Wert liefern, keine Anfrage
           ausloesen - der Knopf im letzten Schritt heisst entsprechend
           'Werte uebernehmen'. */
        modus: 'uebernehmen',
        prefill: DA.getRndPrefill(),
        onComplete: function (stand) {
          try {
            /* v1508 · gemessen: der Wizard zeigte 'Spanne 17 bis 26 Jahre',
               uebernommen wurden 17 bis 24. Ursache war diese Stelle: ich
               habe das Ergebnis hier NOCHMAL gerechnet, ueber
               _buildCalcInputFromWizard. Die Funktion erwartet
               g.gewerkeBewertung und g.modPoints - im Wizard-Zustand heissen
               die Felder aber state.gewerke und state.mod, also rechnete sie
               mit leeren Gewerken und kam auf eine andere Zahl.
               Der Wizard hat laengst gerechnet. Genommen wird SEIN Ergebnis;
               eine zweite Rechnung waere eine zweite Wahrheit. */
            var r = (stand && stand.result)
              || (window._lastRndResult && window._lastRndResult.result)
              || null;
            if (!r) return;
            var tech   = Math.round(Number(r.methods && r.methods.technisch && r.methods.technisch.restnutzungsdauer) || 0);
            var raster = Math.round(Number(r.methods && r.methods.punktraster && r.methods.punktraster.restnutzungsdauer) || 0);
            var werte  = [tech, raster].filter(function (x) { return x > 0; });
            if (!werte.length) return;
            spanneSetzen(Math.min.apply(null, werte), Math.max.apply(null, werte));
            window._lastRndResult = { result: r };
            /* v3044 · und im Reiter Steuer den eigenen AfA-Satz setzen (Modellwert des Kerns) */
            try { if (window.DpAfaEigen && window.DpAfaEigen.setzen) window.DpAfaEigen.setzen(r.final_rnd, 'RND-Ermittlung DealPilot (indikativ, Anlage 2 ImmoWertV)'); } catch (e) {}
            if (info) info.textContent = 'Aus dem Restnutzungsdauer-Rechner übernommen: technisch ' +
              tech + ' Jahre, nach Anlage 2 ' + raster + ' Jahre.';
            try { W.close(); } catch (e) {}
            try { rechnen(); } catch (e) {}
          } catch (e) { console.warn('[v1502] Übernahme:', e.message); }
        },
      });
      return true;
    } catch (e) { console.warn('[v1502] Wizard:', e.message); return false; }
  }

  document.addEventListener('click', function (ev) {
    if (ev.target && ev.target.id === 'bmf-boden-rnd-rechnen') { ev.preventDefault(); rndRechnen(); }
  });

})();

/* ════════════════════════════════════════════════════════════════════
   v3051 · N85 · WELCHE AUFTEILUNG SOLL GELTEN? — EINE VERGLEICHSTAFEL
   ════════════════════════════════════════════════════════════════════
   Marcel 29.10.2026: „im BMF-Rechner machen wir die 4 Optimierungen und
   die umgekehrte Ertragswertmethode nach Jacoby – da muss besser
   hervorgehen, dass man beides vergleicht, auch die optimierten Varianten,
   und dann entweder oder übernimmt. Das muss einfach dargestellt werden."
   Entwurf abgenommen am 29.10.2026 (Dateien/Entwuerfe-2026-10-29/
   N85-BMF-Varianten-vergleichen.dc.html): fünf Zeilen, je Zeile EIN Knopf.

   GERECHNET WIRD HIER NICHTS NEUES — jede Zahl kommt aus einer Rechnung,
   die es schon gibt:
     Gebäudeanteil   Pipeline phase5_varianten (amtlich/15/20/25 %),
                     Jacoby aus phase4_bmf.jacoby (jacobyService.js, am
                     Gutachten Am Markt 18 auf den Cent geprüft)
     Gebäude-AK      Pipeline phase8_finale_ak; für Jacoby derselbe Kern
                     DealKpis.gebaeudeAhk mit denselben Eingaben wie die
                     Pipeline (_ahkKern) — mit Gegenprobe an „amtlich":
                     weicht der Kern dort um mehr als 1 € von phase8 ab,
                     steht bei Jacoby keine AfA statt einer falschen.
     AfA-Satz        der Satz im Reiter Steuer (#afa_satz, auch ein eigener
                     Satz aus der Restnutzungsdauer) — genau der, mit dem
                     der Reiter nach dem Übernehmen rechnet. Er wird beim
                     Übernehmen NICHT überschrieben (bmf-modal.js
                     _applyBmfToAfaConfig, afa-eigen.js: „ein eigener Satz
                     wird nie von einer Automatik überschrieben").
     Grenzsteuersatz die Vorbelegung des Rechners, 40,45 %
                     (DealPilotConfig.investmentProfileDefaults, dieselbe
                     Zahl wie GRENZSTEUER_DEFAULT der Pipeline). Fehlt sie,
                     fallen die Steuer-Spalten weg — kein erfundener Satz.

   Die alten Karten (#varGrid) bleiben im DOM und werden weiter von
   bmf-modal-v292.js gezeichnet (Nicht anfassen) — sie sind nur verdeckt,
   die Tafel steht an ihrer Stelle. Übernommen wird für die vier
   Pipeline-Varianten über window._v292Apply (derselbe Weg wie der Knopf
   unten), für Jacoby über dasselbe Feld #geb_ant.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VARIANTEN = [
    { id: 'amtlich',     name: 'Amtlich (BMF-Arbeitshilfe)', kurz: 'Amtlich',     unter: 'Arbeitshilfe des BMF, Stand Juni 2023', nachweis: 'keiner nötig' },
    { id: 'konservativ', name: 'Konservativ',  kurz: 'Konservativ', unter: '15 % Abschlag auf den Bodenwert', nachweis: 'kurze Begründung' },
    { id: 'optimiert',   name: 'Optimiert',    kurz: 'Optimiert',   unter: '20 % Abschlag auf den Bodenwert', nachweis: 'Begründung + Belege' },
    { id: 'jacoby',      name: 'Umgekehrte Ertragswertmethode', kurz: 'Jacoby', unter: 'nach Jacoby, aus dem Ertragswert – nur bei vermieteten Objekten', nachweis: 'Herleitung + Begründung' }
  ];

  function el(id) { return document.getElementById(id); }
  function eur(v) {
    if (v == null || !isFinite(v)) return '—';
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' €';
  }
  function pct(v, d) {
    if (v == null || !isFinite(v)) return '—';
    d = d == null ? 1 : d;
    return Number(v).toFixed(d).replace('.', ',') + ' %';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── Die Daten der Tafel — reine Funktion, damit sie ohne Browser prüfbar ist ──
     r       Pipeline-Antwort (window._v292State.response)
     ein     Pipeline-Eingaben (window._v292State.lastInputs)
     o.afa   { methode, satzPct } aus Afa.parseSelectValue(#afa_satz)
     o.grenzPct  Grenzsteuersatz in % oder null
     o.gebaeudeAhk  DealKpis.gebaeudeAhk */
  function daten(r, ein, o) {
    o = o || {};
    if (!r || !r.ok || !r.phase5_varianten) return null;
    var p5 = r.phase5_varianten, p8 = r.phase8_finale_ak || {};
    var afa = o.afa || { methode: 'linear', satzPct: 2 };
    var satz = Number(afa.satzPct) || 0;
    var linear = afa.methode === 'linear';
    var grenz = (o.grenzPct > 0 && o.grenzPct < 100) ? o.grenzPct : null;

    function werte(gebAk) {
      if (gebAk == null || !isFinite(gebAk)) return { afa: null, steuer: null, zehn: null };
      var a = gebAk * satz / 100;
      var s = grenz != null ? a * grenz / 100 : null;
      /* Degressiv sinkt der Betrag jedes Jahr - zehnmal das erste Jahr waere falsch. */
      return { afa: a, steuer: s, zehn: (s != null && linear) ? s * 10 : null };
    }

    var zeilen = VARIANTEN.map(function (v) {
      var z = { id: v.id, name: v.name, kurz: v.kurz, unter: v.unter, nachweis: v.nachweis };
      if (v.id !== 'jacoby') {
        var pv = p5[v.id];
        if (!pv) { z.fehlt = 'nicht gerechnet'; return z; }
        z.geb = pv.gebaeude_pct;
        z.gebAk = p8[v.id] ? p8[v.id].gebaeude_ak : null;
        if (v.id === 'amtlich' && r.phase4_bmf && r.phase4_bmf.verfahren) {
          z.unter = 'Arbeitshilfe des BMF, Stand Juni 2023 · ' + ({ ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert' }[r.phase4_bmf.verfahren] || r.phase4_bmf.verfahren);
        }
      } else {
        var j = r.phase4_bmf && r.phase4_bmf.jacoby;
        if (!j || !j.verfuegbar) {
          z.fehlt = 'nicht gerechnet — ' + ((j && (j.grund || j.hinweis)) || 'keine Angaben aus dem Marktbericht-Dienst');
          return z;
        }
        /* dieselbe Rundung wie phase5 (zwei Stellen) - so steht im Reiter Steuer, was hier steht */
        z.geb = Number(Number(j.gebaeudeanteil_prozent).toFixed(2));
        z.unter = 'nach Jacoby · Liegenschaftszins ' + String(j.lzs_pct).replace('.', ',') + ' % (Stufe ' + (j.lzs_stufe || '?') + ')'
          + ' · RND ' + j.rnd_jahre + ' J.';
        /* v3054 · der Quellenvermerk des Ausschusses ist ein ganzer Absatz - in der Zeile nur als Tooltip */
        if (j.ausschuss) z.quelle = 'Liegenschaftszins: ' + j.ausschuss;
        z.jacoby = j;
        var inv = (ein && ein.phase1_inputs && ein.phase1_inputs.investition) || (ein && ein.investition) || {};
        var p2 = r.phase2_inventar || {}, p3 = r.phase3_prognose_ak || {};
        if (typeof o.gebaeudeAhk === 'function' && p3.nk_aufschluesselung) {
          var kern = function (g) {
            return o.gebaeudeAhk({ kp: Number(inv.kp_brutto) || 0, nk: p3.nk_gesamt, nkNurImmo: p3.nk_aufschluesselung.grest,
              nkAbzug: Number(inv.gs_kosten_ak) || 0, gebAntPct: g, inventar: p2.inventar_gesamt }).gebAhk;
          };
          /* Gegenprobe: derselbe Kern muss an „amtlich" die Zahl der Pipeline treffen. */
          var probe = (p5.amtlich && p8.amtlich) ? Math.abs(kern(p5.amtlich.gebaeude_pct) - p8.amtlich.gebaeude_ak) : Infinity;
          if (probe <= 1) z.gebAk = kern(z.geb);
          else z.akHinweis = 'Gebäude-AK nicht gegengeprüft';
        }
      }
      if (!(z.geb > 0 && z.geb < 100)) { z.fehlt = 'Gebäudeanteil ' + pct(z.geb, 1) + ' nicht plausibel'; return z; }
      var w = werte(z.gebAk);
      z.afa = w.afa; z.steuer = w.steuer; z.zehn = w.zehn;
      return z;
    });
    return { zeilen: zeilen, satz: satz, linear: linear, methode: afa.methode, grenz: grenz };
  }

  /* ── Woher die Eingaben kommen ── */
  function afaAusReiter() {
    var s = el('afa_satz'), v = s ? s.value : '2.0';
    if (window.Afa && typeof window.Afa.parseSelectValue === 'function') return window.Afa.parseSelectValue(v);
    var n = parseFloat(String(v || '').replace(',', '.'));
    return { methode: 'linear', satzPct: isFinite(n) && n > 0 ? n : 2 };
  }
  function grenzVorbelegung() {
    var D = window.DealPilotConfig && window.DealPilotConfig.investmentProfileDefaults;
    var g = D ? Number(D.grenzsteuersatz) : NaN;
    return isFinite(g) && g > 0 ? g : null;
  }

  function wahlJetzt() {
    /* v3184a · dieselbe Auswahl wie Schritt 5: was im Reiter Steuer gilt, sonst die Wahl im Fenster.
       Gemessen Westerfeldstr.: Tafel „Amtlich gewählt", Reiter Steuer 32,72 % (Optimiert), Vertragssatz Optimiert. */
    try { var a = window.DpBmfBodenabschlag && window.DpBmfBodenabschlag.auswahl(); if (a && a.id) return a.id; } catch (e) {}
    var st = window._v292State || {};
    return window._dpBmfTafelWahl || st.selectedVariant || 'amtlich';
  }

  /* ── Zeichnen ── */
  function zeichnen() {
    var pane = el('p-hebel'); if (!pane) return;
    var st = window._v292State || {};
    var D = daten(st.response, st.lastInputs, {
      afa: afaAusReiter(), grenzPct: grenzVorbelegung(),
      gebaeudeAhk: window.DealKpis && window.DealKpis.gebaeudeAhk
    });
    var host = el('bmf-wahl-tafel');
    if (!host) {
      host = document.createElement('div');
      host.id = 'bmf-wahl-tafel';
      pane.insertBefore(host, pane.firstChild);
    }
    if (!D) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    /* die alten Karten verdecken, nicht entfernen - bmf-modal-v292.js zeichnet weiter hinein */
    var grid = el('varGrid'); if (grid) grid.style.display = 'none';

    /* Jacoby nicht verfuegbar: die Wahl faellt auf die Pipeline-Variante zurueck */
    var wahl = wahlJetzt();
    var gew = D.zeilen.filter(function (z) { return z.id === wahl && !z.fehlt; })[0];
    if (!gew) { wahl = st.selectedVariant || 'amtlich'; gew = D.zeilen.filter(function (z) { return z.id === wahl; })[0]; }

    var mitSteuer = D.grenz != null;
    var spalten = mitSteuer ? '2.3fr 0.9fr 1fr 1fr 1.05fr 1.4fr 1.15fr' : '2.3fr 0.9fr 1fr 1.4fr 1.15fr';
    var kopfZelle = 'font:600 10.5px/1.3 \'JetBrains Mono\',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6356';
    var rechts = 'text-align:right;padding-right:14px';
    var kopf =
      '<div style="display:grid;grid-template-columns:' + spalten + ';align-items:end;padding:10px 18px;background:#F7F5F0;border-bottom:1px solid #E6E0D3">' +
        '<div style="' + kopfZelle + '">Variante</div>' +
        '<div style="' + kopfZelle + ';' + rechts + '">Gebäude</div>' +
        '<div style="' + kopfZelle + ';' + rechts + '">AfA / Jahr</div>' +
        (mitSteuer ? '<div style="' + kopfZelle + ';' + rechts + '">Steuer / Jahr</div><div style="' + kopfZelle + ';' + rechts + '">10 Jahre</div>' : '') +
        '<div style="' + kopfZelle + '">Nachweis</div><div></div>' +
      '</div>';

    var zeilen = D.zeilen.map(function (z, i) {
      var an = z.id === wahl;
      var stil = 'display:grid;grid-template-columns:' + spalten + ';align-items:center;padding:13px 18px;'
        + (i ? 'border-top:1px solid #EEEAE1;' : '')
        + (an ? 'background:#FBF6E9;box-shadow:inset 4px 0 0 var(--wl-c9a84c, #C9A84C);' : 'background:#FFFFFF;');
      var knopf = z.fehlt
        ? '<button type="button" disabled style="min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid #E6E0D3;background:#F7F5F0;color:#8A8272;font:600 13px Inter,sans-serif;cursor:not-allowed">Nicht verfügbar</button>'
        : (an
          ? '<button type="button" data-tafel="' + z.id + '" style="min-height:40px;padding:8px 12px;border-radius:10px;border:none;background:var(--wl-c9a84c, #C9A84C);color:#050505;font:700 13px Inter,sans-serif;cursor:pointer">Gewählt</button>'
          : '<button type="button" data-tafel="' + z.id + '" style="min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid #CFC9BC;background:#FFFFFF;color:#2A2727;font:600 13px Inter,sans-serif;cursor:pointer">Wählen</button>');
      var name = '<div><div style="font:600 14px/1.3 Inter,sans-serif;color:#1a1814">' + esc(z.name) + '</div>'
        + '<div style="font-size:11.5px;line-height:1.4;color:#6B6356;margin-top:2px"' + (z.quelle ? ' title="' + esc(z.quelle) + '"' : '') + '>' + esc(z.unter) + '</div></div>';
      if (z.fehlt) {
        return '<div style="' + stil + '">' + name
          + '<div style="grid-column:span ' + (mitSteuer ? 5 : 3) + ';font-size:12px;color:#6B6356;line-height:1.45;padding-right:14px">' + esc(z.fehlt) + '</div>'
          + '<div>' + knopf + '</div></div>';
      }
      var zahl = 'font:600 14px Inter,sans-serif;color:#1a1814;font-variant-numeric:tabular-nums;' + rechts;
      return '<div style="' + stil + '">' + name
        + '<div style="' + zahl + '">' + pct(z.geb, 1) + '</div>'
        + '<div style="' + zahl + '"' + (z.akHinweis ? ' title="' + esc(z.akHinweis) + '"' : '') + '>' + eur(z.afa) + '</div>'
        + (mitSteuer ? '<div style="' + zahl + '">' + eur(z.steuer) + '</div><div style="' + zahl + '">' + eur(z.zehn) + '</div>' : '')
        + '<div style="font-size:12.5px;color:#3a352b">' + esc(z.nachweis) + '</div>'
        + '<div>' + knopf + '</div></div>';
    }).join('');

    var satzTxt = pct(D.satz, 2) + (D.linear ? ' linear' : ' degressiv');
    var steuerZeile = gew && !gew.fehlt
      ? 'Gebäudeanteil ' + pct(gew.geb, 1) + ' · AfA ' + eur(gew.afa) + ' je Jahr · Nachweis: ' + gew.nachweis
      : '';
    var imReiter = el('geb_ant') ? String(el('geb_ant').value || '').trim() : '';
    /* v3184 · Marcel 05.11.2026: „Auf jeden Fall den Satz für die Kaufpreisaufteilung dazu" - derselbe
       Wortlaut wie in Schritt 5 (bmf-bodenabschlag.js klausel), für die gewählte Zeile. */
    var vertrag = '';
    try { if (window.DpBmfBodenabschlag && el('p-boden')) { window.DpBmfBodenabschlag.rechnen(); vertrag = (window._dpKpaTexte && window._dpKpaTexte.klausel) || ''; } } catch (e) {}
    vertrag = vertrag.replace(/^Hiermit erklären die Vertragsparteien rechtsverbindlich:\s*/, '').trim();

    host.innerHTML =
      '<div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin-bottom:6px">BMF-Rechner · Schritt 4 von 5</div>' +
      '<h3 style="margin:0 0 6px;font:600 20px/1.3 \'Space Grotesk\',sans-serif;color:#1a1814">Welche Aufteilung soll gelten?</h3>' +
      '<p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#6B6356">Die amtliche Arbeitshilfe, zwei Abschläge auf den Bodenwert und die umgekehrte Ertragswertmethode nach Jacoby – sie trägt nur bei vermieteten Objekten, sonst ist sie ausgegraut. Eine Zeile wählen – übernommen in den Reiter Steuer wird in Schritt 5.</p>' +
      '<div style="border:1px solid #E6E0D3;border-radius:12px;overflow:hidden;background:#FFFFFF">' +
        '<div style="overflow-x:auto"><div style="min-width:' + (mitSteuer ? 760 : 600) + 'px">' + kopf + zeilen + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:12px">' +
        '<div style="padding:12px 14px;border:1px solid #E6E0D3;border-radius:10px;background:#FBF6E9">' +
          '<div style="font:600 10.5px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6356;margin-bottom:6px">Gewählt</div>' +
          '<div style="font:600 15px/1.35 Inter,sans-serif;color:#1a1814">' + esc(gew ? gew.name : '—') + '</div>' +
          '<div style="font-size:12.5px;color:#3a352b;margin-top:3px">' + esc(steuerZeile) + '</div>' +
          '<div style="font-size:11.5px;color:#6B6356;margin-top:5px">' + (imReiter ? 'Im Reiter Steuer: ' + esc(imReiter) + ' % Gebäudeanteil · ' : '') + 'AfA-Satz bleibt ' + esc(satzTxt) + '</div>' +
        '</div>' +
        '<div style="padding:12px 14px;border:1px solid #E6E0D3;border-radius:10px;background:#FFFFFF">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><span style="font:600 10.5px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6356">Satz für den Kaufvertrag</span>' +
            (vertrag ? '<button type="button" id="bmf-tafel-satz-kopieren" style="padding:4px 10px;border-radius:8px;border:1px solid #CFC9BC;background:#fff;font:600 12px Inter,sans-serif;cursor:pointer">Kopieren</button>' : '') + '</div>' +
          '<div style="font-size:12.5px;line-height:1.55;color:#3a352b">' + (vertrag ? esc(vertrag) : 'Erscheint, sobald die amtliche Berechnung vorliegt.') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:11.5px;line-height:1.55;color:#6B6356">AfA auf die Gebäude-Anschaffungskosten einschließlich anteiliger Nebenkosten, volles Jahr' +
        (mitSteuer ? '; Steuer bei ' + pct(D.grenz, 2) + ' Grenzsteuersatz' : '') +
        '. Jede Abweichung von der Arbeitshilfe braucht eine Begründung (BFH IX R 26/19; Jacoby: BFH IX R 12/21) – sie wird in Schritt 5 eingetragen, dort stehen auch alle Ausgaben.</div>';

    /* Alles Übrige im Reiter (Varianten-Karten, 15-%-Grenze, Verteilung, alte Klausel, XLSX-Karte) aus:
       die Auswahl ist die Tafel, die Ausgaben stehen in Schritt 5. Nicht entfernt - v292 schreibt weiter hinein. */
    [].forEach.call(pane.children, function (c) { if (c !== host) c.style.display = 'none'; });
    var kk = el('bmf-tafel-satz-kopieren');
    if (kk) kk.onclick = function () { try { navigator.clipboard.writeText(vertrag); if (window.toast) window.toast('✓ Satz für den Kaufvertrag kopiert'); } catch (e) {} };

    [].forEach.call(host.querySelectorAll('[data-tafel]'), function (b) {
      b.addEventListener('click', function () { waehlen(b.getAttribute('data-tafel')); });
    });
  }

  /* ── Übernehmen ──
     Die vier Pipeline-Varianten gehen über window._v292Apply - denselben Weg
     wie der Knopf unten im Fenster (Feld, Kennzeichen, Rücksetzknopf, calc).
     Nur das Schliessen des Fensters wird hier ausgelassen: wer in der Tafel
     wählt, soll sehen, was gewählt ist, und kann zu Schritt 5 weiter. */
  function uebernehmen(id) {
    var st = window._v292State;
    if (!st || !st.response || !st.response.ok) return;
    if (id === 'jacoby') {
      window._dpBmfTafelWahl = 'jacoby';
      if (!jacobySchreiben()) { window._dpBmfTafelWahl = null; }
      try { if (typeof window.selectKlausel === 'function') window.selectKlausel('jacoby'); } catch (e) {}
      zeichnen();
      try { if (window.DpBmfBodenabschlag) window.DpBmfBodenabschlag.rechnen(); } catch (e) {}   /* v3184: Schritt 5 mitziehen */
      return;
    }
    if (typeof window._v292SelectVariant === 'function') window._v292SelectVariant(id);
    if (typeof window._v292Apply === 'function') {
      var zu = window.closeBMFModal;
      window.closeBMFModal = function () {};
      try { window._v292Apply(); } finally { window.closeBMFModal = zu; }
    }
    zeichnen();
  }

  /* v3188 · nur wählen (Schritt 4) - der Reiter Steuer bleibt unberührt, bis in Schritt 5 übernommen wird */
  function waehlen(id) {
    var st = window._v292State;
    if (!st || !st.response || !st.response.ok) return;
    if (id !== 'jacoby' && typeof window._v292SelectVariant === 'function') window._v292SelectVariant(id);
    window._dpBmfTafelWahl = id;
    zeichnen();
    try { if (window.DpBmfBodenabschlag) window.DpBmfBodenabschlag.rechnen(); } catch (e) {}
  }

  function jacobySchreiben() {
    var st = window._v292State;
    var j = st && st.response && st.response.phase4_bmf && st.response.phase4_bmf.jacoby;
    var p = j && j.verfuegbar ? Number(Number(j.gebaeudeanteil_prozent).toFixed(2)) : null;
    function toast(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
    if (!(p > 0 && p < 100)) { toast('⚠ Nicht übernommen: kein plausibler Gebäudeanteil nach Jacoby.'); return false; }
    var g = el('geb_ant');
    if (!g) { toast('Reiter Steuer nicht gefunden.'); return false; }
    g.value = p.toFixed(2).replace('.', ',');
    g.classList.add('from-bmf-v292');
    g.style.background = 'var(--gold-bg, #FFF7E0)';
    g.style.borderColor = 'var(--wl-c9a84c, #C9A84C)';
    g.title = 'Aus dem BMF-Rechner übernommen · umgekehrte Ertragswertmethode nach Jacoby · ' + new Date().toLocaleString('de-DE');
    g.dispatchEvent(new Event('input', { bubbles: true }));
    var label = g.closest('.f') && g.closest('.f').querySelector('label');
    if (label) {
      var badge = label.querySelector('.v292-bmf-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'v292-bmf-badge';
        badge.style.cssText = 'margin-left:6px;padding:2px 6px;background:var(--wl-c9a84c, #C9A84C);color:#fff;border-radius:3px;font-size:10px;font-weight:600;letter-spacing:.05em';
        label.appendChild(badge);
      }
      badge.title = 'Aus dem BMF-Rechner übernommen';
      badge.textContent = '🤖 BMF · Jacoby';
    }
    if (typeof window.calc === 'function') { try { window.calc(); } catch (e) {} }
    toast('✓ Umgekehrte Ertragswertmethode übernommen — Gebäudeanteil ' + pct(p, 2) + ' im Reiter Steuer');
    return true;
  }

  /* ── Einhängen: nach jedem Zeichnen der v292-Schicht, und beim Knopf unten ── */
  var n = 0;
  (function wickeln() {
    if (typeof window._v292RenderAll !== 'function' || typeof window._v292SelectVariant !== 'function') {
      if (++n < 120) setTimeout(wickeln, 500);
      return;
    }
    if (!window._v292RenderAll._dpTafel) {
      var alt = window._v292RenderAll;
      var neu = function () { var r = alt.apply(this, arguments); try { zeichnen(); } catch (e) { console.warn('[v3051] Tafel:', e.message); } return r; };
      neu._dpTafel = true; window._v292RenderAll = neu;
    }
    if (!window._v292SelectVariant._dpTafel) {
      var altS = window._v292SelectVariant;
      /* eine Wahl der vier (auch über die Klausel-Knöpfe) beendet die Jacoby-Wahl */
      var neuS = function (name) { if (['amtlich', 'konservativ', 'optimiert', 'aggressiv'].indexOf(name) >= 0) window._dpBmfTafelWahl = name; return altS.apply(this, arguments); };
      neuS._dpTafel = true; window._v292SelectVariant = neuS;
    }
    if (typeof window.applyToTax === 'function' && !window.applyToTax._dpTafel) {
      var altA = window.applyToTax;
      var neuA = function () {
        if (window._dpBmfTafelWahl === 'jacoby') {
          if (jacobySchreiben() && typeof window.closeBMFModal === 'function') window.closeBMFModal();
          return;
        }
        return altA.apply(this, arguments);
      };
      neuA._dpTafel = true; window.applyToTax = neuA;
    }
  })();

  window.DpBmfWahlTafel = { daten: daten, zeichnen: zeichnen, uebernehmen: uebernehmen, waehlen: waehlen, VARIANTEN: VARIANTEN };
})();
