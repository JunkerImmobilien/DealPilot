/* ═══════════════════════════════════════════════════════════════════════════
   v3800 · ANLAGE V — KERN DER ZUORDNUNG (ein Weg fuer alle Ansichten)
   ───────────────────────────────────────────────────────────────────────────
   Marcel 19.11.2026 nach dem Termin bei der Steuerkanzlei: „ALLES, was die
   Anlage V abfragt, muss man in DealPilot eingeben können", und die Kanzlei
   sagte, die Zeilennummerierung sei alt.

   Gemessen vor diesem Paket:
   - DREI Ansichten bauten die Zuordnung je fuer sich (Tooltip im Reiter
     Steuer, Werbungskosten-PDF werbungskosten-pdf.js, Steuer-Mappe
     dp-dokumente.js). Alle drei schrieben „Zeile 32", „Zeile 38", „Zeile 83",
     „Zeile 85" FEST in den Code — das sind die Nummern des Formulars 2025.
   - Fuer ein Jahr ohne Abschrift (2026 ff.) nahmen alle drei ersatzweise die
     Nummern von 2025, mit rotem Vorbehalt. Das sind fuer 2026 die „alten
     Nummern". Seit v3800 gilt die strenge Regel ueberall: ohne Abschrift des
     Jahres keine Zeilennummer und keine Anlage-V-Seite.

   Dieser Kern rechnet nichts Steuerliches neu. Er
   1. beschreibt die Angaben, die die Anlage V zusaetzlich abfragt
      (FELDER, jahresunabhaengig: was ein Feld BEDEUTET),
   2. sagt, wie sie auf Einnahmen, Werbungskosten und Ergebnis wirken
      (wirkung) — fuer _computeYearTotal UND die Steuer-Mappe, damit beide
      dieselbe Summe bilden,
   3. ordnet alles nach den Zeilen des Formulars GENAU DIESES JAHRES
      (window.AnlageV<Jahr>.felder / .summen). Die Nummern stehen nur dort.

   Ohne Eintrag in den neuen Feldern ist alles bitgleich zu vorher: jede
   Wirkung ist eine Summe von Nullen.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* art:
     'davon_km' — Teil der Mieteinnahmen (einnahmen_km), der in einer eigenen
                  Formularzeile steht. Aendert die Summe NICHT.
     'davon_nk' — Teil der Umlagen (einnahmen_nk), ebenso.
     'ein'      — zusaetzliche Einnahme, erhoeht die Summe der Einnahmen.
     'ein_minus'— mindert die Einnahmen (Zeile 30: Anteil eigengenutzt).
     'wk'       — zusaetzliche Werbungskosten, erhoehen die Summe.
     'info'     — Angabe ohne Wirkung auf die Summen (Vorsteuer, Zuschuesse
                  zu den Anschaffungskosten, Flaechen).
     'kuerzung_pct' / 'kuerzung_betrag' — verbilligte Vermietung: das
                  Formular nimmt die Werbungskosten in VOLLER Hoehe, das
                  Finanzamt kuerzt. DealPilot rechnet die Steuerwirkung mit
                  der Kuerzung (ergebnis), die Zeilen 83/85 bleiben ungekuerzt. */
  var FELDER = {
    /* Einnahmen */
    av_andere_raeume:  { art: 'davon_km', l: 'Einnahmen für andere Räume (z. B. Gewerbe, Büro)', hilfe: 'Teil der Kaltmiete, der auf Räume entfällt, die keine Wohnung sind. Ändert die Summe nicht, steht im Formular aber in einer eigenen Zeile.' },
    av_angehoerige:    { art: 'davon_km', l: 'Davon an Angehörige vermietete Wohnungen', hilfe: 'Teil der Kaltmiete aus Wohnungen, die an Angehörige vermietet sind. Ändert die Summe nicht. Liegt die Miete unter 66 % der ortsüblichen Miete, gilt § 21 Abs. 2 EStG (Zeile 87/88).' },
    av_garagen:        { art: 'davon_km', auto: true, l: 'Garagen, Stellplätze, Werbeflächen, Antennen', hilfe: 'Kommt aus dem Reiter Miete, „Zusätzliche Einnahmen › aufteilen“ (Stellplatz/Garage, Werbefläche, Antenne/Mobilfunk). Teil der Kaltmiete, ändert die Summe nicht. Wird eine Garage zusammen mit der Wohnung an denselben Mieter vermietet, kann sie auch bei der Wohnungsmiete stehen, dann hier 0 eintragen.' },
    av_nk_angehoerige: { art: 'davon_nk', l: 'Davon Umlagen der an Angehörige vermieteten Wohnungen', hilfe: 'Teil der umgelegten Nebenkosten, der auf Wohnungen an Angehörige entfällt. Ändert die Summe nicht.' },
    av_nk_nachzahlung: { art: 'ein', neg: true, l: 'Nebenkosten: erhaltene Nachzahlungen (+) / geleistete Erstattungen (−)', hilfe: 'Aus der Nebenkostenabrechnung des Vorjahres, im Jahr des Zahlungseingangs (§ 11 EStG). Erstattungen an den Mieter mit Minus.' },
    av_nk_nachz_angeh: { art: 'ein', neg: true, l: 'Davon Angehörige: Nachzahlungen (+) / Erstattungen (−)', hilfe: 'Nachzahlungen oder Erstattungen der Nebenkosten für an Angehörige vermietete Wohnungen.' },
    av_fruehere_mieten:{ art: 'ein', l: 'Mieten für frühere Jahre, verrechnete Kautionen, Mietvorauszahlungen aus Baukostenzuschüssen', hilfe: 'Im Jahr eingegangene Mietrückstände früherer Jahre, mit Forderungen verrechnete Mietkautionen und der auf das Jahr entfallende Teil von Mietvorauszahlungen.' },
    av_ust_vereinnahmt:{ art: 'ein', l: 'Vereinnahmte Umsatzsteuer', hilfe: 'Nur bei umsatzsteuerpflichtiger Vermietung (Option nach § 9 UStG, z. B. Gewerbe). DealPilot rechnet sonst ohne Umsatzsteuer.' },
    av_ust_erstattet:  { art: 'ein', l: 'Vom Finanzamt erstattete Umsatzsteuer', hilfe: 'Nur bei umsatzsteuerpflichtiger Vermietung: im Jahr vom Finanzamt erstattete oder verrechnete Umsatzsteuer.' },
    av_zuschuesse:     { art: 'ein', l: 'Öffentliche Zuschüsse, Aufwendungszuschüsse, Bauspar-Guthabenzinsen, sonstige Einnahmen', hilfe: 'Zuschüsse nach dem Wohnraumförderungsgesetz oder zu Erhaltungsaufwendungen, Aufwendungszuschüsse, Guthabenzinsen aus Bausparverträgen, die mit dem Objekt zusammenhängen, und sonstige Einnahmen.' },
    av_zuschuesse_eigen:{ art: 'ein_minus', l: 'Davon auf eigengenutzte oder unentgeltlich überlassene Wohnungen', hilfe: 'Anteil der Zuschüsse, der auf eigengenutzten oder unentgeltlich überlassenen Wohnraum entfällt. Wird abgezogen.' },
    /* Werbungskosten */
    av_7h7i:           { art: 'wk', l: 'Erhöhte Absetzungen §§ 7h, 7i EStG / Schutzbaugesetz', hilfe: 'Sanierungsgebiet oder Baudenkmal, laut Bescheinigung der Gemeinde bzw. Denkmalbehörde. DealPilot rechnet sie nicht selbst, deshalb Betrag eintragen.' },
    av_renten:         { art: 'wk', l: 'Renten, dauernde Lasten', hilfe: 'Z. B. Leibrente aus dem Erwerb des Objekts, soweit als Werbungskosten abziehbar (Ertragsanteil).' },
    av_erh_m1:         { art: 'wk', vj: 1, l: 'Verteilte Erhaltungsaufwendungen aus dem Vorjahr', hilfe: 'Anteil für dieses Jahr aus Erhaltungsaufwendungen des Vorjahres, die nach §§ 11a, 11b EStG, § 82b EStDV verteilt werden und NICHT in DealPilot erfasst sind. Was DealPilot selbst verteilt, steht schon im Erhaltungsaufwand.' },
    av_erh_m2:         { art: 'wk', vj: 2, l: 'Verteilte Erhaltungsaufwendungen von vor 2 Jahren', hilfe: 'Wie oben, Aufwand von vor zwei Jahren.' },
    av_erh_m3:         { art: 'wk', vj: 3, l: 'Verteilte Erhaltungsaufwendungen von vor 3 Jahren', hilfe: 'Wie oben, Aufwand von vor drei Jahren.' },
    av_erh_m4:         { art: 'wk', vj: 4, l: 'Verteilte Erhaltungsaufwendungen von vor 4 Jahren', hilfe: 'Wie oben, Aufwand von vor vier Jahren.' },
    av_ust_gezahlt:    { art: 'wk', l: 'An das Finanzamt gezahlte Umsatzsteuer', hilfe: 'Nur bei umsatzsteuerpflichtiger Vermietung.' },
    /* Angaben ohne Wirkung auf die Summen */
    av_vorsteuer:      { art: 'info', l: 'Davon in den Werbungskosten enthaltene abziehbare Vorsteuer', hilfe: 'Nur bei umsatzsteuerpflichtiger Vermietung: in den Werbungskosten enthaltene Vorsteuerbeträge. Ändert die Summe nicht.' },
    av_zuschuss_ahk:   { art: 'info', l: 'Zuschüsse aus öffentlichen Mitteln zu den Anschaffungs- oder Herstellungskosten', hilfe: 'Im Jahr vereinnahmte oder bewilligte Zuschüsse zu den Anschaffungs- oder Herstellungskosten. Sie mindern die Bemessungsgrundlage der AfA, das rechnet DealPilot nicht selbst: Gebäudewert entsprechend anpassen.' },
    av_wohnflaeche:    { art: 'info', einheit: 'm²', auto: true, l: 'Gesamtwohnfläche (m²)', hilfe: 'Aus dem Objekt (Wohnfläche).' },
    av_eigen_qm:       { art: 'info', einheit: 'm²', l: 'Davon eigengenutzt oder unentgeltlich überlassen (m²)', hilfe: 'Wohnraum, der selbst genutzt oder ohne Miete überlassen wird.' },
    av_kuerzung_pct:   { art: 'kuerzung_pct', einheit: '%', l: 'Kürzung wegen verbilligter Vermietung (%)', hilfe: 'Miete unter 50 % der ortsüblichen Miete (§ 21 Abs. 2 Satz 1 EStG): Werbungskosten nur anteilig. Im Formular stehen die Werbungskosten in voller Höhe, das Finanzamt kürzt. DealPilot rechnet die Steuerwirkung mit der Kürzung.' },
    av_kuerzung_betrag:{ art: 'kuerzung_betrag', l: 'Kürzung wegen verbilligter Vermietung eines Teils des Objekts (€)', hilfe: 'Betragsmäßige Kürzung, wenn nur ein Teil des Objekts verbilligt vermietet ist. Entweder Prozent oder Betrag, nicht beides.' }
  };
  var SCHLUESSEL = Object.keys(FELDER);

  function zahl(x) { var n = Number(x); return isFinite(n) ? n : 0; }

  /** Die Abschrift des Formulars fuer GENAU dieses Jahr - sonst null (kein Ersatzjahr). */
  function tabelle(jahr) {
    var t = (typeof window !== 'undefined') ? window['AnlageV' + jahr] : null;
    return t && t.zeilen && t.felder ? t : null;
  }
  /** Jahre, fuer die eine Abschrift vorliegt (aufsteigend). */
  function jahre() {
    try {
      return Object.keys(window).filter(function (k) { return /^AnlageV\d{4}$/.test(k) && tabelle(+k.slice(7)); })
        .map(function (k) { return +k.slice(7); }).sort(function (a, b) { return a - b; });
    } catch (e) { return []; }
  }

  /** Wirkung der zusaetzlichen Angaben auf die Summen. av = { av_*: Zahl }.
      Liefert { ein, wk, kuerzung(wk) } — kuerzung ist der Betrag, um den das
      Finanzamt die Werbungskosten kuerzt. */
  function wirkung(av, werbungskostenVoll) {
    av = av || {};
    var ein = 0, wk = 0;
    SCHLUESSEL.forEach(function (k) {
      var a = FELDER[k].art, b = zahl(av[k]);
      if (!b) return;
      if (a === 'ein') ein += b;
      else if (a === 'ein_minus') ein -= b;
      else if (a === 'wk') wk += b;
    });
    var pct = Math.max(0, Math.min(100, zahl(av.av_kuerzung_pct)));
    var kuerzung = ((zahl(werbungskostenVoll) + wk) * pct / 100) + Math.max(0, zahl(av.av_kuerzung_betrag));
    return { ein: ein, wk: wk, kuerzung: kuerzung };
  }

  /** Nur die av_*-Werte aus einem Objekt (Werte-Sammlung oder gespeicherter jsonb). */
  function auszug(quelle) {
    var o = {}; if (!quelle || typeof quelle !== 'object') return o;
    SCHLUESSEL.forEach(function (k) { if (quelle[k] != null && isFinite(Number(quelle[k])) && Number(quelle[k]) !== 0) o[k] = Number(quelle[k]); });
    return o;
  }

  /* ── Aufstellung nach den Zeilen des Formulars ─────────────────────────
     tot: { values (Werte der Steuerzeilen incl. av_*), einnahmen, werbungskosten,
            ergebnis, afaLinear, afaSonder7b, auto, erhV ({Ursprungsjahr: Betrag}
            der von DealPilot verteilten Erhaltung), erhG (Gesamtaufwand des Jahres,
            der verteilt wird), labels ({feld: Bezeichnung}) }
     Rueckgabe null, wenn fuer das Jahr keine Abschrift vorliegt. */
  function aufstellung(jahr, tot) {
    var T = tabelle(jahr); if (!T || !tot) return null;
    var v = tot.values || {}, L = tot.labels || {}, S = T.summen || {};
    var F = T.felder, Z = T.zeilen;
    var kz = function (nr) { return (Z[nr] || {}).kz || null; };
    var zeile = function (f) { var a = F[f]; return a && a.zeile != null ? a.zeile : null; };
    var mark = function (f) { var a = F[f] || {}; return a.quelle === 'sachlogik' ? ' °' : a.quelle === 'auffang' ? ' *' : ''; };
    var name = function (f) { return L[f] || (FELDER[f] && FELDER[f].l) || f; };
    var R = { jahr: jahr, formular: T.formular, quelle: T.quelle, stand: T.stand || null, einnahmen: [], wk: [], info: [], sach: [], ohne: [], hinweise: [],
              summen: S, nichtErfasst: [] };
    var push = function (liste, nr, text, betrag, extra) {
      if (nr == null) return false;
      var e = { zeile: nr, kz: kz(nr), text: text, betrag: betrag };
      if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
      liste.push(e); return true;
    };
    var sachlogik = function (f, nr) { var a = F[f] || {}; if (a.quelle === 'sachlogik' && a.grund) R.sach.push('Zeile ' + nr + ' · ' + name(f) + ' – ' + a.grund); };

    /* 1 · Einnahmen. Die davon-Felder ziehen ihren Teil aus der Wohnungsmiete
       bzw. den Umlagen; die Summe der Einnahmen bleibt dieselbe. */
    var km = zahl(v.einnahmen_km), nk = zahl(v.einnahmen_nk);
    var dKm = 0, dNk = 0;
    SCHLUESSEL.forEach(function (k) { if (FELDER[k].art === 'davon_km') dKm += zahl(v[k]); if (FELDER[k].art === 'davon_nk') dNk += zahl(v[k]); });
    if (dKm > km + 0.005) R.hinweise.push('Die Teile der Kaltmiete (andere Räume, Angehörige, Garagen und Werbeflächen) sind zusammen größer als die Kaltmiete von ' + Math.round(km) + ' €. Bitte die Angaben prüfen.');
    if (dNk > nk + 0.005) R.hinweise.push('Die Umlagen der an Angehörige vermieteten Wohnungen sind größer als alle Umlagen. Bitte prüfen.');
    push(R.einnahmen, zeile('einnahmen_km'), name('einnahmen_km') + (dKm ? ' (Wohnungen, ohne die Zeilen unten)' : ''), km - dKm, { feld: 'einnahmen_km' });
    ['av_andere_raeume', 'av_angehoerige'].forEach(function (f) { if (zahl(v[f])) { push(R.einnahmen, zeile(f), name(f) + mark(f), zahl(v[f]), { feld: f }); sachlogik(f, zeile(f)); } });
    if (nk || dNk) push(R.einnahmen, zeile('einnahmen_nk'), name('einnahmen_nk') + (dNk ? ' (ohne Angehörige)' : ''), nk - dNk, { feld: 'einnahmen_nk' });
    ['av_nk_nachzahlung', 'av_nk_angehoerige', 'av_nk_nachz_angeh', 'av_fruehere_mieten', 'av_garagen', 'av_ust_vereinnahmt', 'av_ust_erstattet'].forEach(function (f) {
      if (zahl(v[f])) { push(R.einnahmen, zeile(f), name(f) + mark(f), zahl(v[f]), { feld: f }); sachlogik(f, zeile(f)); }
    });
    var zu = zahl(v.av_zuschuesse), zuE = zahl(v.av_zuschuesse_eigen);
    if (zu || zuE) {
      push(R.einnahmen, zeile('av_zuschuesse'), name('av_zuschuesse'), zu, { feld: 'av_zuschuesse', teil: true });
      if (zuE) push(R.einnahmen, zeile('av_zuschuesse_eigen'), name('av_zuschuesse_eigen'), -zuE, { feld: 'av_zuschuesse_eigen', teil: true });
      push(R.einnahmen, S.zuschuesse_ergebnis, 'Ergebnis der Zuschüsse und sonstigen Einnahmen', zu - zuE, { feld: 'av_zuschuesse_erg' });
    }
    R.einnahmen.sort(function (a, b) { return a.zeile - b.zeile; });
    R.summeEinnahmen = { zeile: S.einnahmen, betrag: zahl(tot.einnahmen) };

    /* 2 · Werbungskosten */
    var summe = 0;
    var hatEigen = function (f) { var au = tot.auto || {}; return au[f] == null || Math.abs(zahl(v[f]) - zahl(au[f])) < 0.005; };
    Object.keys(F).forEach(function (f) {
      var a = F[f]; if (a.art !== 'wk') return;
      if (f.indexOf('av_') === 0) return;   /* die zusaetzlichen Angaben unten */
      var betrag = zahl(v[f]);
      if (a.zeile == null) { if (betrag) R.ohne.push({ feld: f, text: name(f), betrag: betrag, grund: a.grund }); return; }
      if (!betrag) return;
      if (f === 'afa') {
        var lin = tot.afaLinear, son = tot.afaSonder7b, eigen = hatEigen('afa');
        if (son != null && son > 0 && eigen && lin != null && S.sonder7b != null) {
          push(R.wk, a.zeile, 'AfA Gebäude (linear, ohne § 7b)', lin, { feld: 'afa' });
          push(R.wk, S.sonder7b, 'Sonderabschreibung § 7b EStG', son, { feld: 'afa_7b' });
          R.afaHinweis = { getrennt: true, text: 'Die Gebäude-AfA von ' + Math.round(betrag).toLocaleString('de-DE') + ' € enthält eine Sonderabschreibung nach § 7b EStG. Zeile ' + a.zeile + ' nimmt laut Formular nur den Betrag ohne die Sonderabschreibung auf, deshalb steht der § 7b-Anteil getrennt in Zeile ' + S.sonder7b + '.' };
          summe += betrag; return;
        }
        if (son == null) R.afaHinweis = { getrennt: false, text: 'Ob in dieser Gebäude-AfA eine Sonderabschreibung nach § 7b EStG steckt, geht aus dem gespeicherten Steuersatz nicht hervor. Zeile ' + a.zeile + ' nimmt laut Formular nur den Betrag ohne die Sonderabschreibung auf: enthält die AfA einen § 7b-Anteil, gehört dieser in Zeile ' + (S.sonder7b != null ? S.sonder7b : '(Sonderabschreibung § 7b)') + '.' };
      }
      if (f === 'erhaltungsaufwand') {
        /* von DealPilot verteilte Erhaltung (§ 82b EStDV) steht nicht bei der sofort abziehbaren */
        var erhV = tot.erhV || null, rest = betrag;
        if (erhV && hatEigen('erhaltungsaufwand')) {
          Object.keys(erhV).sort().forEach(function (o) {
            var b = zahl(erhV[o]); if (!b) return;
            var k = jahr - (+o), nr = k === 0 ? S.erh_verteilt_jahr : zeile('av_erh_m' + k);
            if (nr == null) return;
            push(R.wk, nr, k === 0 ? 'Verteilte Erhaltungsaufwendungen ' + jahr + ', davon ' + jahr + ' abzuziehen' : 'Verteilte Erhaltungsaufwendungen aus ' + o, b, { feld: 'erh_verteilt_' + o });
            rest -= b;
          });
        } else if (erhV && Object.keys(erhV).length) {
          R.hinweise.push('Der Erhaltungsaufwand wurde von Hand geändert. DealPilot weiß deshalb nicht, welcher Teil verteilt ist (§ 82b EStDV): der ganze Betrag steht in Zeile ' + a.zeile + '. Verteilte Anteile gehören in die Zeilen der verteilten Erhaltungsaufwendungen.');
        }
        if (rest > 0.005) push(R.wk, a.zeile, name(f) + mark(f), rest, { feld: f });
        summe += betrag; return;
      }
      push(R.wk, a.zeile, name(f) + mark(f), betrag, { feld: f });
      sachlogik(f, a.zeile);
      summe += betrag;
    });
    /* zusaetzliche Werbungskosten aus den Angaben der Anlage V */
    SCHLUESSEL.forEach(function (f) {
      if (FELDER[f].art !== 'wk') return;
      var b = zahl(v[f]); if (!b) return;
      var nr = zeile(f);
      var txt = FELDER[f].vj ? 'Verteilte Erhaltungsaufwendungen aus ' + (jahr - FELDER[f].vj) + ' (nicht in DealPilot erfasst)' : name(f);
      if (nr == null) { R.ohne.push({ feld: f, text: txt, betrag: b }); return; }
      push(R.wk, nr, txt + mark(f), b, { feld: f });
      sachlogik(f, nr);
    });
    R.wk.sort(function (a, b) { return a.zeile - b.zeile; });
    R.summeWk = { zeile: S.werbungskosten, betrag: zahl(tot.werbungskosten) };
    R.ueberschuss = { zeile: S.ueberschuss, betrag: zahl(tot.einnahmen) - zahl(tot.werbungskosten) };

    /* 3 · Angaben ohne Wirkung auf die Summen, Kuerzung */
    if (tot.erhG) push(R.info, S.erh_verteilt_gesamt, 'Gesamtaufwand ' + jahr + ' der auf bis zu 5 Jahre verteilten Erhaltungsaufwendungen', zahl(tot.erhG), { feld: 'erh_gesamt' });
    ['av_wohnflaeche', 'av_eigen_qm', 'av_vorsteuer', 'av_zuschuss_ahk', 'av_kuerzung_pct', 'av_kuerzung_betrag'].forEach(function (f) {
      var b = zahl(v[f]); if (!b) return;
      push(R.info, zeile(f), name(f), b, { feld: f, einheit: FELDER[f].einheit || '€' });
    });
    R.info.sort(function (a, b) { return a.zeile - b.zeile; });
    var w = wirkung(v, zahl(tot.werbungskosten) - wirkung(v, 0).wk);
    if (w.kuerzung > 0.005) R.kuerzung = { betrag: w.kuerzung, text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung: ' + Math.round(w.kuerzung).toLocaleString('de-DE') + ' €. Im Formular stehen die Werbungskosten in voller Höhe, die Kürzung nimmt das Finanzamt aus den Angaben in den Zeilen ' + [zeile('av_kuerzung_pct'), zeile('av_kuerzung_betrag')].filter(function (x) { return x != null; }).join(' und ') + ' vor. DealPilot rechnet die Steuerwirkung bereits mit der Kürzung.' };

    /* 4 · Zeilen, die DealPilot nicht fuehrt - was oben steht, gilt nicht als fehlend */
    var gedruckt = {}; R.einnahmen.concat(R.wk, R.info).forEach(function (e) { gedruckt[e.zeile] = 1; });
    R.nichtErfasst = (T.nicht_erfasst || []).filter(function (n) { return !gedruckt[n.zeile]; });
    return R;
  }

  /** Auskunft fuer den Tooltip im Reiter Steuer: Zeile, Kennzahl, Text - nur aus der Abschrift DIESES Jahres. */
  function zeileFuer(jahr, feld) {
    var T = tabelle(jahr); if (!T) return null;
    var a = T.felder[feld]; if (!a || a.zeile == null) return null;
    var z = T.zeilen[a.zeile] || {};
    return { zeile: a.zeile, kz: z.kz || null, text: z.text || '', quelle: a.quelle || null, grund: a.grund || null, formular: T.formular };
  }

  window.AnlageVKern = { FELDER: FELDER, SCHLUESSEL: SCHLUESSEL, tabelle: tabelle, jahre: jahre, wirkung: wirkung, auszug: auszug, aufstellung: aufstellung, zeileFuer: zeileFuer };
})();
