'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   wertvergleich.js · v2810 — Marktpreisindikation, Ertrags- und Sachwert
   gegenübergestellt (Pilot-Analyse, Unterreiter „Wert & Marktpreis")

   Marcel 22.10.2026: „dass wir in der Pilotanalyse den Unterschied zwischen
   Ertragswert, Sachwert … erklären, auch in Bezug auf die Marktpreis-
   indikation und wie sich das zusammensetzt … obere, untere und Durch-
   schnitt … in der Tabelle ordentlich gegenüberstellen, aber auch sagen,
   wenn wir da schon Abschläge runtergezogen haben und wie viel das ohne
   Abschläge wäre … warum zum Beispiel der Ertragswert mehr ist als die
   Marktpreisindikation und andersrum genauso."

   - Rechnet NICHTS neu. Jede Zahl kommt aus dem letzten Marktbericht des
     Objekts (GET /marktbericht/objects/history, Felder seit v2810 in
     marktbericht/backend/src/routes/api.js) bzw. der Kaufpreis aus dem
     Formular. Abgeleitet werden nur Verhältnisse (Abweichung in %,
     Vielfaches der Jahresmiete) aus diesen Zahlen.
   - Die Erklärung ist fest formuliert, keine KI: sie nennt nur Gründe, die
     am Bericht ablesbar sind (Abschlag, Miete gegen Vergleichsmiete,
     Vielfaches, führendes Verfahren, vorläufiger Sachwert).
   - Nach außen keine Datenquelle (CLAUDE.md, Anbieter-Neutralität): die
     Herkunft des Abschlags steht so, wie der Bericht sie formuliert
     (örtlich gemessen / Marktdurchschnitt / dein Wert).
   Gefüllt wird aus window._dpLoadVerlauf (ui.js), das den Verlauf ohnehin lädt.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  if (global.DpWertvergleich) return;

  function zahl(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function eur(v) { var n = zahl(v); return n == null ? '–' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function pct(v, st) { return Number(v).toLocaleString('de-DE', { minimumFractionDigits: st == null ? 1 : st, maximumFractionDigits: st == null ? 1 : st }); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function datum(d) { try { return new Date(d).toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  /* Abweichung von a gegen b in Prozent von b */
  function abw(a, b) { return (a != null && b) ? (a - b) / b * 100 : null; }
  /* „4,9 % unter" / „5,4 % darüber" / „gleichauf" */
  function lage(d) { return d == null ? '' : (Math.abs(d) < 0.05 ? 'gleichauf mit' : pct(Math.abs(d)) + ' % ' + (d < 0 ? 'unter' : 'über')); }
  function lageDar(d) { return lage(d).replace(/ mit$/, '').replace(/ (unter|über)$/, function (m, w) { return ' dar' + w; }); }
  function abwText(d) { return d == null ? '' : (d > 0 ? '+' : '−') + pct(Math.abs(d)) + ' %'; }

  function kaufpreis() {
    var el = document.getElementById('kp'); if (!el) return null;
    var s = String(el.value || '').replace(/[^\d,.-]/g, '');
    if (!s) return null;
    var n = Number(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) && n > 0 ? n : null;
  }
  /* Jahresrohertrag aus dem verdichteten Rechenweg (ertrag_weg: [{pos, wert}]) */
  function rohertrag(h) {
    var w = Array.isArray(h.ertrag_weg) ? h.ertrag_weg : [];
    for (var i = 0; i < w.length; i++) if (/^= Rohertrag/.test(String(w[i].pos || ''))) return zahl(w[i].wert);
    for (var j = 0; j < w.length; j++) if (/^Rohertrag/.test(String(w[j].pos || ''))) return zahl(w[j].wert);
    return null;
  }
  function herkunftAbschlag(h) {
    var q = String(h.angebot_abschlag_herkunft || '');
    if (/rtlich/i.test(q)) return q.replace(/^örtlich gemessen:?\s*/i, 'örtlich gemessen: ');
    if (/dein|eigen/i.test(q)) return 'dein Wert aus den Einstellungen';
    return 'aktueller Marktdurchschnitt';
  }
  var VERF = { ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert' };

  function html(h) {
    var mw = zahl(h.market_value), lo = zahl(h.market_value_low), hi = zahl(h.market_value_high);
    if (mw == null) return '';
    var ab = zahl(h.angebot_abschlag_pct), roh = zahl(h.market_value_roh);
    var rohLo = zahl(h.market_value_roh_low), rohHi = zahl(h.market_value_roh_high);
    var mitAb = ab != null && ab > 0 && roh != null;
    var ew = zahl(h.ertragswert_eur), ewV = zahl(h.ertragswert_von_eur), ewB = zahl(h.ertragswert_bis_eur);
    var sw = zahl(h.sachwert_eur), swVorl = !!h.sachwert_vorlaeufig || h.sw_marktangepasst === false;
    var vw = zahl(h.irw_vergleichswert_eur);
    if (vw == null && h.vergleichsfaktor_amtlich) vw = zahl(h.vergleichswert_eur);
    var kp = kaufpreis(), fu = String(h.fuehrend || '');
    var ro = rohertrag(h);

    function zeile(name, sub, a, m, b, fuehrend) {
      var d = abw(m, mw);
      return '<tr' + (fuehrend ? ' class="dp-wv-fuehrend"' : '') + '><td class="abw-wort">' + name
        + (fuehrend ? ' <span class="dp-wv-tag">führend</span>' : '')
        + (sub ? '<span class="dp-wv-sub">' + sub + '</span>' : '') + '</td>'
        + '<td class="abw-zahl">' + (a != null ? eur(a) : '') + '</td>'
        + '<td class="abw-zahl"><b>' + eur(m) + '</b></td>'
        + '<td class="abw-zahl">' + (b != null ? eur(b) : '') + '</td>'
        + '<td class="abw-zahl">' + (name === 'Marktpreisindikation' ? '' : abwText(d)) + '</td></tr>';
    }
    var t = '<div style="overflow-x:auto"><table class="abw-tafel dp-wv-tafel" style="min-width:540px"><thead><tr>'
      + '<th>Wert</th><th>untere</th><th>Mitte / Wert</th><th>obere</th><th>zur Marktpreis&shy;indikation</th></tr></thead><tbody>';
    t += zeile('Marktpreisindikation', mitAb ? 'nach ' + pct(ab) + ' % Abschlag auf Angebotspreise' : 'aus Angebotspreisen vergleichbarer Objekte', lo, mw, hi, fu === 'vergleichswert' && vw == null);
    if (mitAb) t += zeile('ohne Abschlag', 'Angebotsniveau, wie es im Markt ausgeschrieben ist', rohLo, roh, rohHi, false);
    if (ew != null) t += zeile(/vorläufig/.test(h.ertragswert_bezeichnung || '') ? 'Ertragswert (vorläufig)' : 'Ertragswert',
      (ewV != null ? 'Spanne aus dem Liegenschaftszins' : '') , ewV, ew, ewB, fu === 'ertragswert');
    if (sw != null) t += zeile(swVorl ? 'Sachwert (vorläufig)' : 'Sachwert', swVorl ? 'ohne Sachwertfaktor, nicht an den Markt angepasst' : '', null, sw, null, fu === 'sachwert');
    if (vw != null) t += zeile('Vergleichswert', h.irw_vergleichswert_eur != null ? 'aus dem Immobilienrichtwert' : 'mit amtlichem Vergleichsfaktor', null, vw, null, fu === 'vergleichswert');
    if (kp != null) t += zeile('Kaufpreis', 'deine Angabe', null, kp, null, false);
    t += '</tbody></table></div>';

    /* ── Wie sich die Werte zusammensetzen ── */
    var e = [];
    var mpi = 'Die <b>Marktpreisindikation</b> kommt aus den Angebotspreisen vergleichbarer Objekte';
    /* v2947 (N78.4) · „im Mittel 2.165 €/m² × 390 m²" ergab 844.350 €, die Mitte ohne Abschlag
       stand bei 960.000 € (Westerfeldstr. 140). Dazwischen liegen die Objektfaktoren des Berichts
       (Lage, Zustand/Qualität/Modernisierung, Ausstattung, Energie, Etage, Leerstand; hier × 1,05)
       und 73.615 € Stellplätze/Mehrfläche. Die Rechnung steht nur noch, wenn sie aus den
       gelieferten Faktoren auf den Wert aufgeht (±1 %); sonst ohne Multiplikation. */
    var _med = zahl(h.median_sqm), _wfl = zahl(h.living_area), _fk = h.mpi_faktoren;
    if (typeof _fk === 'string') { try { _fk = JSON.parse(_fk); } catch (e) { _fk = null; } }
    if (_med != null && _wfl != null) {
      var _basis = _med * _wfl, _ziel = mitAb ? roh : mw, _rechnung = null;
      if (_fk && typeof _fk === 'object') {
        var _F = ['location_factor', 'object_adjustment', 'amenity_factor', 'energy_factor', 'floor_factor', 'vacancy_factor']
          .reduce(function (p, k) { var f = zahl(_fk[k]); return p * (f != null ? f : 1); }, 1);
        var _add = (zahl(_fk.parking_value_eur) || 0) + (zahl(_fk.land_excess_value_eur) || 0) + (zahl(_fk.kostenabzug_eur) || 0);
        var _soll = _basis * _F + _add;
        if (_ziel != null && Math.abs(_soll - _ziel) <= 0.01 * _ziel) {
          _rechnung = ': Median ' + Math.round(_med).toLocaleString('de-DE') + ' €/m² × ' + Math.round(_wfl).toLocaleString('de-DE') + ' m² = ' + eur(_basis)
            + (Math.abs(_F - 1) >= 0.0005 ? ', angepasst an das Objekt ('
                + [['location_factor', 'Lage'], ['object_adjustment', 'Zustand/Qualität/Modernisierung'], ['amenity_factor', 'Ausstattung'], ['energy_factor', 'Energie'], ['floor_factor', 'Etage'], ['vacancy_factor', 'Leerstand']]
                    .filter(function (p) { var f = zahl(_fk[p[0]]); return f != null && Math.abs(f - 1) >= 0.0005; })
                    .map(function (p) { return p[1] + ' × ' + pct(zahl(_fk[p[0]]), 2); }).join(', ')
                + ') = ' + eur(_basis * _F) : '')
            + (_add ? ', ' + (_add > 0 ? 'zuzüglich ' : 'abzüglich ') + eur(Math.abs(_add)) + ' für Stellplätze, Mehrfläche und besondere Merkmale' : '')
            + ' — gerundet ' + eur(_ziel) + (mitAb ? ' vor Abschlag' : '');
        }
      }
      mpi += _rechnung || (': Median ' + Math.round(_med).toLocaleString('de-DE') + ' €/m² der Angebote, auf ' + Math.round(_wfl).toLocaleString('de-DE')
        + ' m² bezogen und an Lage und Objekt angepasst');
    }
    mpi += '. Die untere und obere Zahl sind die Bandbreite, in der vergleichbare Angebote liegen.';
    if (mitAb) {
      mpi += ' Angebotspreise liegen über dem, was am Ende tatsächlich bezahlt wird. Deshalb sind <b>' + pct(ab) + ' %</b> abgezogen ('
        + esc(herkunftAbschlag(h)) + ')' + (h.angebot_abschlag_kurz ? ', ' + esc(h.angebot_abschlag_kurz) : '') + '. Ohne diesen Abschlag läge die Mitte bei <b>' + eur(roh) + '</b>.';
      var na = zahl(h.abschlag_nicht_eur);
      if (na != null && na > 0) mpi += ' Nicht abgezogen wurde auf ' + eur(na) + ', die nicht aus Angebotspreisen stammen (z. B. Bodenwert einer Mehrfläche, Stellplätze).';
    }
    e.push(mpi);
    if (ew != null) {
      var ewt = 'Der <b>Ertragswert</b> fragt, was die Miete trägt: Jahresrohertrag' + (ro != null ? ' ' + eur(ro) : '')
        + ' abzüglich Bewirtschaftungskosten, kapitalisiert mit dem Liegenschaftszins' + (zahl(h.lzs_pct) != null ? ' von ' + pct(h.lzs_pct, 2) + ' %' : '')
        + (h.lzs_stufe ? ' (Stufe ' + esc(h.lzs_stufe) + ')' : '') + ' über die Restnutzungsdauer, dazu der Bodenwert.';
      /* v2947 (N78.6) · zwei Rohertraege fuer dasselbe Haus: der Bericht setzt Stellplaetze
         marktueblich an (Westerfeld 4 × 30 € = 1.440 €, Rohertrag 39.780 €), die Kalkulation
         rechnet mit der eingetragenen Zusatzeinnahme (1.080 €, 39.420 €). Benannt, nicht angeglichen:
         der Ertragswert verlangt den marktueblichen Ertrag (§ 31 ImmoWertV), die Kalkulation den Ist-Ertrag. */
      try {
        var _K = window.State && State.kpis, _nkmJ = _K ? zahl(_K.nkm_j) : null, _zeJ = _K ? zahl(_K.ze_j) : null;
        var _sp = (Array.isArray(h.ertrag_weg) ? h.ertrag_weg : []).filter(function (z) { return /^Stellpl/i.test(String(z.pos || '')); })[0];
        if (ro != null && _nkmJ != null && Math.abs(_nkmJ - ro) >= 1) {
          ewt += ' Der Rohertrag des Berichts (' + eur(ro) + ') weicht von der Jahresmiete der Kalkulation (' + eur(_nkmJ)
            + (_zeJ ? ', darin ' + eur(_zeJ) + ' Zusatzeinnahmen' : '') + ') ab'
            + (_sp ? ': der Bericht setzt die ' + esc(String(_sp.pos).replace(/^Stellplätze\s*/i, 'Stellplätze ')) + ' mit ' + eur(_sp.wert) + ' marktüblich an' : '')
            + '. Der Ertragswert rechnet mit dem marktüblichen Ertrag, die Kalkulation mit dem tatsächlichen.';
        }
      } catch (e2) {}
      if (zahl(h.ew_miete_ist_qm) != null && zahl(h.ew_miete_vergleich_qm) != null)
        ewt += ' Deine Ist-Miete liegt bei ' + pct(h.ew_miete_ist_qm, 2) + ' €/m², die Vergleichsmiete bei ' + pct(h.ew_miete_vergleich_qm, 2) + ' €/m²'
          + (h.ew_miete_stufe ? ' (' + esc(h.ew_miete_stufe) + ')' : '') + '.';
      if (ewV != null && ewB != null) ewt += ' Die Spanne ' + eur(ewV) + ' bis ' + eur(ewB) + ' zeigt, wie weit der Wert mit dem Zins schwankt'
        + (h.ertragswert_spanne_deckung ? ' (' + esc(h.ertragswert_spanne_deckung) + ' amtliche Sätze vergleichbarer Objekte lagen darin)' : '') + '.';
      e.push(ewt);
    }
    if (sw != null) {
      var swt = 'Der <b>Sachwert</b> fragt, was die Substanz wert ist: Bodenwert' + (zahl(h.sw_bodenwert_eur) != null ? ' ' + eur(h.sw_bodenwert_eur) : '')
        + ' plus Gebäude zu Herstellungskosten, gemindert um das Alter' + (zahl(h.sw_rnd_jahre) != null ? ' (Restnutzungsdauer ' + pct(h.sw_rnd_jahre, 0) + ' Jahre)' : '');
      swt += swVorl
        ? (h.sw_faktor_grund === 'objektart_nicht_abgeleitet'
            ? '. Für diese Objektart leitet der Gutachterausschuss keinen Sachwertfaktor ab. Der Wert gibt deshalb nur die Herstellungskosten wieder und ist noch nicht an den Markt angepasst.'
            : '. Für dieses Objekt liegt kein passender Sachwertfaktor vor. Der Wert ist deshalb nicht an den Markt angepasst und nur vorläufig.')
        : (zahl(h.sw_faktor) != null ? ', angepasst an den Markt mit dem Sachwertfaktor ' + pct(h.sw_faktor, 2) + '.' : ', angepasst an den Markt mit dem Sachwertfaktor des Gutachterausschusses.');
      e.push(swt);
    }

    /* ── Warum sie auseinanderliegen ── */
    var w = [];
    if (fu && VERF[fu]) w.push('Für dieses Objekt ist der <b>' + VERF[fu] + '</b> das führende Verfahren' + (h.fuehrend_grund ? ': ' + esc(String(h.fuehrend_grund).replace(/\.$/, '')) : '') + '. An ihm misst sich der Preis, die anderen Werte sind die Gegenprobe.');
    if (ew != null) {
      var d = abw(ew, mw), drin = lo != null && hi != null && ew >= lo && ew <= hi;
      var fak = ro ? ' Die Marktpreisindikation entspricht dem ' + pct(mw / ro) + '-Fachen des Jahresrohertrags, der Ertragswert dem ' + pct(ew / ro) + '-Fachen.' : '';
      if (Math.abs(d) <= 5) w.push('Ertragswert und Marktpreisindikation liegen nah beieinander (' + abwText(d) + '): Miete und Marktpreis passen zueinander.');
      else if (d < 0) {
        var t1 = 'Der Ertragswert liegt <b>' + pct(Math.abs(d)) + ' % unter</b> der Marktpreisindikation' + (drin ? ', aber noch innerhalb ihrer Spanne' : '') + '.' + fak
          + ' Die Miete allein trägt den Preis vergleichbarer Objekte also nicht ganz. Käufer zahlen hier mehr, als sich aus der Miete rechnet, etwa wegen der Nachfrage am Ort oder der Erwartung steigender Werte.';
        if (zahl(h.ew_miete_ist_qm) != null && zahl(h.ew_miete_vergleich_qm) != null && h.ew_miete_ist_qm < h.ew_miete_vergleich_qm)
          t1 += ' Dazu kommt: die Ist-Miete liegt unter der Vergleichsmiete. Mit steigender Miete rückt der Ertragswert näher an den Marktpreis.';
        w.push(t1);
      } else {
        var t2 = 'Der Ertragswert liegt <b>' + pct(d) + ' % über</b> der Marktpreisindikation' + (drin ? ', aber noch innerhalb ihrer Spanne' : '') + '.' + fak
          + ' Die Miete trägt mehr, als vergleichbare Objekte am Markt kosten. Das spricht für einen günstigen Preis im Verhältnis zur Miete.';
        if (zahl(h.ew_miete_ist_qm) != null && zahl(h.ew_miete_vergleich_qm) != null && h.ew_miete_ist_qm > h.ew_miete_vergleich_qm)
          t2 += ' Prüfe aber, ob die Miete nachhaltig ist: die Ist-Miete liegt über der Vergleichsmiete.';
        w.push(t2);
      }
      if (mitAb) {
        var d2 = abw(ew, roh);
        w.push('Gegen das Angebotsniveau ohne Abschlag (' + eur(roh) + ') läge der Ertragswert ' + lageDar(d2) + '. '
          + (Math.abs(d2) > Math.abs(d) ? 'Der Abschlag hat den Abstand also schon verkleinert' : 'Der Abschlag hat den Abstand also vergrößert')
          + ': er holt die Angebote auf das Niveau tatsächlich gezahlter Kaufpreise, die Miete bleibt davon unberührt.');
      }
    }
    if (sw != null) {
      var ds = abw(sw, mw);
      if (Math.abs(ds) > 10) w.push('Der Sachwert liegt ' + pct(Math.abs(ds)) + ' % ' + (ds < 0 ? 'unter' : 'über') + ' der Marktpreisindikation. '
        + (fu === 'ertragswert' ? 'Bei einem Renditeobjekt zahlt der Markt für die Miete, nicht für die Bausubstanz. Deshalb ist der Sachwert hier nur die Gegenprobe.'
          : (ds < 0 ? 'Der Markt zahlt hier mehr als die Substanz, typisch für gefragte Lagen oder ein älteres Gebäude auf wertvollem Grund.'
            : 'Die Substanz ist mehr wert, als vergleichbare Objekte am Markt kosten, etwa bei aufwendiger Bauweise oder großem Grundstück.'))
        + (swVorl ? ' Dazu ist der Sachwert hier nur vorläufig, ohne Sachwertfaktor.' : ''));
    }
    if (kp != null) {
      var dk = abw(kp, mw), inSp = lo != null && hi != null && kp >= lo && kp <= hi;
      w.push('Dein Kaufpreis liegt ' + lage(dk) + ' der Marktpreisindikation' + (inSp ? ', innerhalb ihrer Spanne' : (lo != null && kp < lo ? ', unter ihrer unteren Zahl' : (hi != null && kp > hi ? ', über ihrer oberen Zahl' : ''))) + '.'
        + (ew != null ? ' Gegenüber dem Ertragswert liegt er ' + lageDar(abw(kp, ew)) + '.' : ''));
    }

    return '<div class="dp-pa-card dp-wv">'
      + '<div class="abw-kopf"><h4>Marktpreisindikation, Ertragswert und Sachwert</h4><span class="abw-stand">Marktbericht vom ' + esc(datum(h.created_at)) + '</span></div>'
      + t
      + '<h4 class="dp-wv-h">Wie sich die Werte zusammensetzen</h4>' + e.map(function (x) { return '<p class="dp-pa-p">' + x + '</p>'; }).join('')
      + (w.length ? '<h4 class="dp-wv-h">Warum sie auseinanderliegen</h4>' + w.map(function (x) { return '<p class="dp-pa-p">' + x + '</p>'; }).join('') : '')
      + '<div class="dp-pa-fuss">Marktpreisindikation, Sach- und Ertragswert sind indikativ nach ImmoWertV-Logik, kein Gutachten nach § 194 BauGB. '
      + 'Den Rechenweg Zeile für Zeile zeigt der Marktbericht.</div></div>';
  }

  function css() {
    if (document.getElementById('dp-wv-style')) return;
    var s = document.createElement('style'); s.id = 'dp-wv-style';
    s.textContent = '.dp-wv-sub{display:block;font-size:10.5px;color:var(--muted,#8A8272);line-height:1.35}'
      + '.dp-wv-tag{font:600 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;padding:2px 5px;border-radius:4px;'
      + 'border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 55%, transparent);color:var(--wl-c9a84c, #C9A84C);vertical-align:1px}'
      + '.dp-wv-fuehrend td{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent)}'
      + '.dp-wv-tafel td:nth-child(5){white-space:nowrap}'
      + '.dp-wv-h{margin:16px 0 4px;font:600 13px/1.3 "Space Grotesk",system-ui,sans-serif;color:var(--dp-ink-1,#E8E3D8)}';
    document.head.appendChild(s);
  }

  /** hist: Verlauf des Objekts (objects/history). Füllt Reiter und Knopf. */
  function fuellen(hist) {
    var body = document.getElementById('dp-pa-wert-body'), knopf = document.getElementById('dp-pa-tab-wert');
    if (!body) return;
    var letzt = null;
    (hist || []).forEach(function (h) { if (h && h.market_value != null && (!letzt || new Date(h.created_at) >= new Date(letzt.created_at))) letzt = h; });
    var t = letzt ? html(letzt) : '';
    /* v2842 · der Knopf gehört jetzt auch dem Verlauf (ein Unterreiter) - ui.js _dpLoadVerlauf blendet ihn ein und aus */
    if (!t) { body.innerHTML = ''; return; }
    css();
    body.innerHTML = t;
    if (knopf) knopf.style.display = '';
  }

  global.DpWertvergleich = { fuellen: fuellen, html: html };
})(window);
