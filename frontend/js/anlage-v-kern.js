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

   ───────────────────────────────────────────────────────────────────────────
   v3800b · QUELLEN DER REGELN (Marcel 19.11.2026: „so machen, dass es richtig ist")
   ───────────────────────────────────────────────────────────────────────────
   VERBILLIGTE VERMIETUNG (§ 21 Abs. 2 EStG, ab VZ 2021):
     - Miete einschliesslich Umlagen unter 50 % der ortsueblichen Miete
       einschliesslich umlagefaehiger Kosten: Aufteilung in einen entgeltlichen
       und einen unentgeltlichen Teil, Werbungskosten nur zum entgeltlichen Teil
       (Satz 1). Vergleich warm gegen warm: R 21.3 Satz 2 EStR (tax.js _mieteQuote66).
     - 50 % bis unter 66 %: entgeltlich, wenn die Totalueberschussprognose
       positiv ist, sonst Aufteilung (Satz 2). Prognose nach BMF-Schreiben vom
       08.10.2004 (IV C 3 - S 2253 - 91/04, BStBl I S. 933) Rz. 34, Seite 10 bis 12:
       Prognosezeitraum 30 Jahre ab Anschaffung, Gebaeude-AfA nur linear nach
       § 7 Abs. 4 EStG (keine Sonderabschreibung, keine erhoehten Absetzungen,
       keine degressive AfA), Summe der Einnahmen + 10 %, Summe der Werbungskosten
       − 10 %, fehlende Jahre hochgerechnet (Durchschnitt der letzten Jahre).
     - ab 66 %: voll entgeltlich.
   FORMULAR (Anlage V 2025, Seite 2 vor Zeile 33 und Seite 4 vor Zeile 87, und
   ELSTER-Hilfe zur Anlage V 2025, Abschnitt „Verbilligte Ueberlassung"): die
   Werbungskosten stehen in den Zeilen 33 bis 84 in VOLLER Hoehe; die Kuerzung
   nur in Zeile 87 (Prozentsatz, um den zu kuerzen ist — ganzes Objekt) ODER
   Zeile 88 (Betrag — nur ein Teil verbilligt). Beispiel der Hilfe: Miete mit
   Umlagen 420 € gegen ortsueblich 1.050 € = 40 % entgeltlich, in Zeile 87
   „60". Das Finanzamt kuerzt; DealPilot rechnet die Steuerwirkung mit der Kuerzung.
   TEILWEISE EIGENNUTZUNG (ELSTER-Hilfe Anlage V 2025 zu den Zeilen 33 bis 84):
     direkt zuordenbare Aufwendungen in „durch direkte Zuordnung ermittelt",
     sonst „durch verhaeltnismaessige Zuordnung ermittelt" mit Gesamtbetrag und
     abzugsfaehigem Anteil (z. B. Flaechenverhaeltnis). DealPilot kennt die
     direkte Zuordnung nicht je Posten: mit abzugsfaehigem Anteil unter 100 %
     stehen alle Posten verhaeltnismaessig (av_anteil_pct, aus Zeile 11/12 vorgeschlagen).
   ZEILE 26 (ELSTER-Hilfe): Vermietung von Grundstuecksteilen fuer Mobilfunk-
     antennen, Windkraftanlagen, WLAN-Hotspots. Garagen und Stellplaetze stehen
     immer dort (Marcel 19.11.2026: „das hat nichts mit Kaltmiete zu tun").
   ZEILE 86 (ELSTER-Hilfe, Beispiel Familie Muster): bei gemeinsamem Eigentum
     beiden Ehegatten nach Anteil zugerechnet (dort haelftig). Die Anlage V ist bei
     Zusammenveranlagung gemeinsam auszufuellen (Kopf des Vordrucks).
   ZEILE 89 (ELSTER-Hilfe): Zuschuesse zu Anschaffungs- oder Herstellungskosten
     sind zusaetzlich von der AfA-Bemessungsgrundlage abzuziehen (R 21.5 Abs. 1
     EStR); ab dem Jahr der Bewilligung mindert sich die AfA (tax.js).
   §§ 7h, 7i EStG (Abs. 1 Satz 1): im Jahr der Herstellung und in den folgenden
     sieben Jahren jeweils bis zu 9 %, in den folgenden vier Jahren jeweils bis zu
     7 % der begünstigten Herstellungskosten laut Bescheinigung (tax.js av_7h7i).
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
    av_garagen:        { art: 'davon_km', auto: true, l: 'Garagen, Stellplätze, Werbeflächen, Antennen', hilfe: 'Kommt aus dem Reiter Miete, „Zusätzliche Einnahmen › aufteilen“ (Stellplatz/Garage, Werbefläche, Antenne/Mobilfunk). Teil der Kaltmiete, ändert die Summe nicht. Garagen und Stellplätze stehen immer hier, auch wenn sie an denselben Mieter wie die Wohnung gehen. Sind die zusätzlichen Einnahmen nicht aufgeteilt, zählen sie hier, sobald das Objekt Garagen oder Stellplätze führt.' },
    av_nk_angehoerige: { art: 'davon_nk', l: 'Davon Umlagen der an Angehörige vermieteten Wohnungen', hilfe: 'Teil der umgelegten Nebenkosten, der auf Wohnungen an Angehörige entfällt. Ändert die Summe nicht.' },
    av_nk_nachzahlung: { art: 'ein', neg: true, l: 'Nebenkosten: erhaltene Nachzahlungen (+) / geleistete Erstattungen (−)', hilfe: 'Aus der Nebenkostenabrechnung des Vorjahres, im Jahr des Zahlungseingangs (§ 11 EStG). Erstattungen an den Mieter mit Minus.' },
    av_nk_nachz_angeh: { art: 'ein', neg: true, l: 'Davon Angehörige: Nachzahlungen (+) / Erstattungen (−)', hilfe: 'Nachzahlungen oder Erstattungen der Nebenkosten für an Angehörige vermietete Wohnungen.' },
    av_fruehere_mieten:{ art: 'ein', l: 'Mieten für frühere Jahre, verrechnete Kautionen, Mietvorauszahlungen aus Baukostenzuschüssen', hilfe: 'Im Jahr eingegangene Mietrückstände früherer Jahre, mit Forderungen verrechnete Mietkautionen und der auf das Jahr entfallende Teil von Mietvorauszahlungen.' },
    av_ust_vereinnahmt:{ art: 'ein', l: 'Vereinnahmte Umsatzsteuer', hilfe: 'Nur bei umsatzsteuerpflichtiger Vermietung (Option nach § 9 UStG, z. B. Gewerbe). DealPilot rechnet sonst ohne Umsatzsteuer.' },
    av_ust_erstattet:  { art: 'ein', l: 'Vom Finanzamt erstattete Umsatzsteuer', hilfe: 'Nur bei umsatzsteuerpflichtiger Vermietung: im Jahr vom Finanzamt erstattete oder verrechnete Umsatzsteuer.' },
    av_zuschuesse:     { art: 'ein', l: 'Öffentliche Zuschüsse, Aufwendungszuschüsse, Bauspar-Guthabenzinsen, sonstige Einnahmen', hilfe: 'Zuschüsse nach dem Wohnraumförderungsgesetz oder zu Erhaltungsaufwendungen, Aufwendungszuschüsse, Guthabenzinsen aus Bausparverträgen, die mit dem Objekt zusammenhängen (Finanzierung des Objekts), und sonstige Einnahmen. Zuschüsse zu den Anschaffungs- oder Herstellungskosten gehören nicht hierher, sondern unter „Zuschüsse aus öffentlichen Mitteln zu den Anschaffungs- oder Herstellungskosten“. Zinsen auf die Erhaltungsrücklage der Eigentümergemeinschaft stehen nicht in der Anlage V (Kapitaleinkünfte, Anlage KAP), mit der Kanzlei abstimmen.' },
    av_zuschuesse_eigen:{ art: 'ein_minus', l: 'Davon auf eigengenutzte oder unentgeltlich überlassene Wohnungen', hilfe: 'Anteil der Zuschüsse, der auf eigengenutzten oder unentgeltlich überlassenen Wohnraum entfällt. Wird abgezogen.' },
    /* Werbungskosten */
    av_7h7i:           { art: 'wk', auto: true, l: 'Erhöhte Absetzungen §§ 7h, 7i EStG / Schutzbaugesetz', hilfe: 'Sanierungsgebiet (§ 7h) oder Baudenkmal (§ 7i). Vorschlag aus den Angaben im Reiter Steuer (Bemessungsgrundlage laut Bescheinigung der Gemeinde bzw. Denkmalbehörde und Jahr der Herstellung): im Jahr der Herstellung und den folgenden sieben Jahren bis zu 9 %, in den folgenden vier Jahren bis zu 7 %. Die begünstigten Kosten gehören dann nicht zusätzlich in die Gebäude-AfA.' },
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
    av_kuerzung_pct:   { art: 'kuerzung_pct', einheit: '%', auto: true, l: 'Kürzung wegen verbilligter Vermietung (%)', hilfe: 'Prozentsatz, um den die Werbungskosten zu kürzen sind (unentgeltlicher Teil), wenn das ganze Objekt verbilligt vermietet ist. Vorschlag aus der Miete im Verhältnis zur ortsüblichen Miete (Reiter Miete, warm gegen warm): unter 50 % immer, 50 bis unter 66 % nur bei negativer Totalüberschussprognose (30 Jahre, § 21 Abs. 2 EStG). Im Formular stehen die Werbungskosten in voller Höhe, das Finanzamt kürzt. DealPilot rechnet die Steuerwirkung mit der Kürzung.' },
    av_kuerzung_betrag:{ art: 'kuerzung_betrag', l: 'Kürzung wegen verbilligter Vermietung eines Teils des Objekts (€)', hilfe: 'Betragsmäßige Kürzung, wenn nur ein Teil des Objekts verbilligt vermietet ist. Entweder Prozent oder Betrag, nicht beides.' },
    /* v3800b · Zuordnungsart, Zurechnung, Ankreuzfelder */
    av_anteil_pct:     { art: 'anteil_pct', einheit: '%', auto: true, l: 'Abzugsfähiger Anteil der Werbungskosten (%), verhältnismäßige Zuordnung', hilfe: 'Nur wenn das Objekt teilweise selbst genutzt oder unentgeltlich überlassen wird: Anteil der Aufwendungen, der auf den vermieteten Teil entfällt (z. B. Flächenverhältnis). Vorschlag aus Wohnfläche und eigengenutzter Fläche. Unter 100 % stehen die Werbungskosten im Formular in den Zeilen „durch verhältnismäßige Zuordnung ermittelt“ (Gesamtbetrag und Anteil). Die erstmalige Aufteilung ist in einer gesonderten Aufstellung zu erläutern.' },
    av_zurechnung_a_pct:{ art: 'zurechnung', einheit: '%', auto: true, l: 'Zurechnung des Überschusses: Anteil Person A (%)', hilfe: 'Zeile 86: Anteil der steuerpflichtigen Person / Person A am Überschuss, der Rest geht an Person B. Vorschlag aus dem Eigentum im Reiter Steuer (Ehegatten gemeinsam: eigener Anteil zu Anteil Ehegatte, ohne Angabe hälftig) und der Veranlagung des Jahres. Bei Einzelveranlagung oder Alleineigentum 100 %.' },
    av_fewo:           { art: 'flag', l: 'Als Ferienwohnung genutzt (1 = Ja, 2 = Nein)', hilfe: 'Zeile 10. Bei Ja ist zusätzlich die Anlage V-FeWo abzugeben, DealPilot führt sie nicht.' },
    av_kurzfristig:    { art: 'flag', l: 'Kurzfristig vermietet (1 = Ja, 2 = Nein)', hilfe: 'Zeile 10. Bei Ja ist zusätzlich die Anlage V-FeWo abzugeben, DealPilot führt sie nicht.' },
    av_angeh_flag:     { art: 'flag', auto: true, l: 'An Angehörige zu Wohnzwecken vermietet (1 = Ja, 2 = Nein)', hilfe: 'Zeile 10. Vorschlag: Ja, sobald unter „Davon an Angehörige vermietete Wohnungen“ ein Betrag steht.' },
    av_nk_nicht_vereinbart:{ art: 'flag', l: 'Neben- / Betriebskosten nicht gesondert vereinbart (1 = Ja)', hilfe: 'Zeile 24: nur ankreuzen, wenn mit den Mietern keine Nebenkosten gesondert vereinbart sind (Inklusivmiete).' }
  };
  var SCHLUESSEL = Object.keys(FELDER);

  function zahl(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function anteil(av) { var a = zahl(av && av.av_anteil_pct); return a > 0 && a < 100 ? a : 100; }

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
    /* v3800b · verhaeltnismaessige Zuordnung: abzugsfaehiger Anteil (fehlend oder 0 = 100 %, bitgleich).
       Die Summenzeile (Zeile 83) traegt nur den abzugsfaehigen Teil: anteilMinus wird abgezogen. */
    var ant = anteil(av);
    var anteilMinus = (zahl(werbungskostenVoll) + wk) * (1 - ant / 100);
    var pct = Math.max(0, Math.min(100, zahl(av.av_kuerzung_pct)));
    var kuerzung = ((zahl(werbungskostenVoll) + wk - anteilMinus) * pct / 100) + Math.max(0, zahl(av.av_kuerzung_betrag));
    return { ein: ein, wk: wk - anteilMinus, kuerzung: kuerzung, anteil: ant, anteilMinus: anteilMinus };
  }

  /** v3800b · §§ 7h, 7i EStG Abs. 1 Satz 1: Jahr der Herstellung und 7 Folgejahre bis zu 9 %,
      die folgenden 4 Jahre bis zu 7 % der begünstigten Herstellungskosten. Rein, ohne Formular. */
  function sieben(basis, beginn, jahr) {
    var b = zahl(basis), j0 = Math.round(zahl(beginn)), k = Math.round(zahl(jahr)) - j0;
    if (!(b > 0) || !(j0 > 0) || k < 0 || k > 11) return { satz: 0, betrag: 0, jahrNr: k + 1 };
    var satz = k <= 7 ? 9 : 7;
    return { satz: satz, betrag: b * satz / 100, jahrNr: k + 1 };
  }
  /** v3800b · § 21 Abs. 2 EStG mit Totalueberschussprognose (BMF 08.10.2004 Rz. 34).
      p = { quote (Miete warm in % der ortsueblichen warm), jahre: [{ ein, wk }] je Jahr ab Anschaffung
      (wk mit linearer Gebaeude-AfA, ohne Sonderabschreibung / erhoehte Absetzungen) }.
      Rueckgabe { pct (Kuerzung in %), stufe, tue, jahre, grund }. Rein, ohne Formular. */
  function verbilligt(p) {
    p = p || {}; var q = zahl(p.quote);
    var r2 = function (x) { return Math.round(x * 100) / 100; };
    var pz = function (x) { return String(r2(x)).replace('.', ','); };
    if (!(q > 0)) return { pct: 0, stufe: 'unbekannt', grund: null };
    if (q >= 66) return { pct: 0, stufe: 'entgeltlich', grund: null };
    if (q < 50) return { pct: r2(100 - q), stufe: 'aufteilung', grund: 'Verbilligte Vermietung: die Miete beträgt einschließlich Umlagen ' + pz(q) + ' % der ortsüblichen Miete (unter 50 %). Die Werbungskosten sind um den unentgeltlichen Teil von ' + pz(100 - q) + ' % zu kürzen (§ 21 Abs. 2 Satz 1 EStG).' };
    var J = Array.isArray(p.jahre) ? p.jahre.slice(0, 30) : [], n = J.length;
    if (!n) return { pct: 0, stufe: 'prognose_fehlt', grund: 'Die Miete beträgt ' + pz(q) + ' % der ortsüblichen Miete (50 bis unter 66 %). Entgeltlich nur bei positiver Totalüberschussprognose (§ 21 Abs. 2 Satz 2 EStG); DealPilot hat für die Prognose keine Jahre. Bitte prüfen.' };
    var se = 0, sw = 0; J.forEach(function (j) { se += zahl(j.ein); sw += zahl(j.wk); });
    var m = Math.min(5, n), le = 0, lw = 0; J.slice(n - m).forEach(function (j) { le += zahl(j.ein); lw += zahl(j.wk); });
    se += (30 - n) * le / m; sw += (30 - n) * lw / m;
    var tue = 1.1 * se - 0.9 * sw;
    var t = 'Die Miete beträgt einschließlich Umlagen ' + pz(q) + ' % der ortsüblichen Miete (50 bis unter 66 %). Totalüberschussprognose über 30 Jahre (BMF-Schreiben vom 08.10.2004, Rz. 34: lineare AfA, Einnahmen + 10 %, Werbungskosten − 10 %'
      + (n < 30 ? ', ' + n + ' Jahre aus der Planung, die übrigen ' + (30 - n) + ' aus dem Durchschnitt der letzten ' + m + ' hochgerechnet' : '') + '): ' + (tue >= 0 ? '+' : '−') + Math.abs(Math.round(tue)).toLocaleString('de-DE') + ' €. ';
    if (tue > 0) return { pct: 0, stufe: 'entgeltlich_prognose', tue: tue, jahre: n, grund: t + 'Positiv, die Vermietung gilt als entgeltlich, keine Kürzung (§ 21 Abs. 2 Satz 2 EStG).' };
    return { pct: r2(100 - q), stufe: 'aufteilung_prognose', tue: tue, jahre: n, grund: t + 'Nicht positiv, die Werbungskosten sind um ' + pz(100 - q) + ' % zu kürzen (§ 21 Abs. 2 Satz 2 EStG).' };
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
            der verteilt wird), labels ({feld: Bezeichnung}),
            v3800b: einheiten ([{b: Bezeichnung, q: Flaeche, e: Miete je Monat, g: 1 = Gewerbe}]),
            afaArt ({m: 'linear'|'degressiv'|…, s: Satz %}), kaufjahr, verbilligt ({quote, tue, jahre, grund}) }
     Rueckgabe null, wenn fuer das Jahr keine Abschrift vorliegt.
     Jede Zeile mit teil: true ist eine Einzelangabe; die Summe der uebrigen ergibt die Summenzeilen. */
  function aufstellung(jahr, tot) {
    var T = tabelle(jahr); if (!T || !tot) return null;
    var v = tot.values || {}, L = tot.labels || {}, S = T.summen || {}, VERH = T.verh || {};
    var F = T.felder, Z = T.zeilen;
    var kz = function (nr, f) { return (f && F[f] && F[f].kz) || (Z[nr] || {}).kz || null; };
    var zeile = function (f) { var a = F[f]; return a && a.zeile != null ? a.zeile : null; };
    var mark = function (f) { var a = F[f] || {}; return a.quelle === 'sachlogik' ? ' °' : a.quelle === 'auffang' ? ' *' : ''; };
    var name = function (f) { return L[f] || (FELDER[f] && FELDER[f].l) || f; };
    var eur = function (n) { return (Math.round(zahl(n) * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; };
    var R = { jahr: jahr, formular: T.formular, quelle: T.quelle, stand: T.stand || null, einnahmen: [], wk: [], info: [], sach: [], ohne: [], hinweise: [],
              summen: S, nichtErfasst: [] };
    var push = function (liste, nr, text, betrag, extra) {
      if (nr == null) return false;
      var e = { zeile: nr, kz: kz(nr, extra && extra.feld), text: text, betrag: betrag };
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
    /* Einzelangaben je Wohnung / Einheit (Zeilen 13/14 und 16/17), auf die Summenzeilen skaliert */
    var EH = Array.isArray(tot.einheiten) ? tot.einheiten : [];
    var einzel = function (liste, summe, z1, z2, wort) {
      if (!liste.length || z1 == null) return;
      var roh = liste.reduce(function (a, e) { return a + zahl(e.e); }, 0);
      liste.forEach(function (e, i) {
        var b = roh > 0 ? summe * zahl(e.e) / roh : (liste.length === 1 ? summe : 0);
        push(R.einnahmen, i === 0 ? z1 : (z2 != null ? z2 : z1), (e.b ? String(e.b) : wort + ' ' + (i + 1)) + (zahl(e.q) > 0 ? ', ' + Math.round(zahl(e.q) * 100) / 100 + ' m²' : '') + (zahl(e.e) > 0 ? '' : ' (leer)'), b, { teil: true, feld: 'einheit_' + i });
      });
    };
    var wohnSumme = km - dKm;
    einzel(EH.filter(function (e) { return !e.g; }), wohnSumme, S.einzel_wohnung, S.einzel_wohnung_weitere, 'Wohnung');
    push(R.einnahmen, zeile('einnahmen_km'), name('einnahmen_km') + (dKm ? ' (Wohnungen, ohne die Teile in eigenen Zeilen)' : ''), wohnSumme, { feld: 'einnahmen_km' });
    einzel(EH.filter(function (e) { return !!e.g; }), zahl(v.av_andere_raeume), S.einzel_raum, S.einzel_raum_weitere, 'Einheit');
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
    R.einnahmen.sort(function (a, b) { return a.zeile - b.zeile || (a.teil ? 0 : 1) - (b.teil ? 0 : 1); });
    R.summeEinnahmen = { zeile: S.einnahmen, betrag: zahl(tot.einnahmen) };
    if (zahl(tot.zeUngeteilt) > 0.5) R.hinweise.push('Zusätzliche Einnahmen von ' + eur(tot.zeUngeteilt) + ' sind nicht aufgeteilt und stehen bei den Mieteinnahmen. Garagen, Stellplätze, Werbeflächen und Antennen gehören in eine eigene Zeile: im Reiter Miete unter „Zusätzliche Einnahmen › aufteilen“ eintragen.');

    /* 2 · Werbungskosten. Abzugsfaehiger Anteil unter 100 %: jede Summenzeile traegt den
       abzugsfaehigen Teil, die Zeile „durch verhaeltnismaessige Zuordnung ermittelt"
       Gesamtbetrag und Anteil (Formular Seite 2 bis 4). */
    var ant = anteil(v), fA = ant / 100;
    var wkPush = function (nr, text, betrag, extra) {
      if (nr == null) return false;
      if (ant >= 100) return push(R.wk, nr, text, betrag, extra);
      var vz = VERH[nr], ziel = (S.verh_selbst || []).indexOf(vz) >= 0 ? vz : nr;
      push(R.wk, ziel, text + ' (abzugsfähiger Anteil)', betrag * fA, extra);
      if (vz != null) push(R.wk, vz, 'durch verhältnismäßige Zuordnung ermittelt: Gesamtbetrag ' + eur(betrag) + ', abzugsfähiger Anteil ' + String(Math.round(ant * 100) / 100).replace('.', ',') + ' %', null, { teil: true });
      return true;
    };
    var hatEigen = function (f) { var au = tot.auto || {}; return au[f] == null || Math.abs(zahl(v[f]) - zahl(au[f])) < 0.005; };
    Object.keys(F).forEach(function (f) {
      var a = F[f]; if (a.art !== 'wk') return;
      if (f.indexOf('av_') === 0) return;   /* die zusaetzlichen Angaben unten */
      var betrag = zahl(v[f]);
      if (a.zeile == null) { if (betrag) R.ohne.push({ feld: f, text: name(f), betrag: betrag * fA, grund: a.grund }); return; }
      if (!betrag) return;
      if (f === 'afa') {
        var lin = tot.afaLinear, son = tot.afaSonder7b, eigen = hatEigen('afa');
        if (son != null && son > 0 && eigen && lin != null && S.sonder7b != null) {
          wkPush(a.zeile, 'AfA Gebäude (' + afaWort(tot.afaArt) + ', ohne § 7b)', lin, { feld: 'afa' });
          wkPush(S.sonder7b, 'Sonderabschreibung § 7b EStG', son, { feld: 'afa_7b' });
          R.afaHinweis = { getrennt: true, text: 'Die Gebäude-AfA von ' + eur(betrag) + ' enthält eine Sonderabschreibung nach § 7b EStG. Zeile ' + a.zeile + ' nimmt laut Formular nur den Betrag ohne die Sonderabschreibung auf, deshalb steht der § 7b-Anteil getrennt in Zeile ' + S.sonder7b + '.' };
          return;
        }
        if (son == null) R.afaHinweis = { getrennt: false, text: 'Ob in dieser Gebäude-AfA eine Sonderabschreibung nach § 7b EStG steckt, geht aus dem gespeicherten Steuersatz nicht hervor. Zeile ' + a.zeile + ' nimmt laut Formular nur den Betrag ohne die Sonderabschreibung auf: enthält die AfA einen § 7b-Anteil, gehört dieser in Zeile ' + (S.sonder7b != null ? S.sonder7b : '(Sonderabschreibung § 7b)') + '.' };
        wkPush(a.zeile, (tot.afaArt ? 'AfA Gebäude (' + afaWort(tot.afaArt) + ')' : name(f)) + mark(f), betrag, { feld: f });
        return;
      }
      if (f === 'erhaltungsaufwand') {
        /* von DealPilot verteilte Erhaltung (§ 82b EStDV) steht nicht bei der sofort abziehbaren */
        var erhV = tot.erhV || null, rest = betrag;
        if (erhV && hatEigen('erhaltungsaufwand')) {
          Object.keys(erhV).sort().forEach(function (o) {
            var b = zahl(erhV[o]); if (!b) return;
            var k = jahr - (+o), nr = k === 0 ? S.erh_verteilt_jahr : zeile('av_erh_m' + k);
            if (nr == null) return;
            wkPush(nr, k === 0 ? 'Verteilte Erhaltungsaufwendungen ' + jahr + ', davon ' + jahr + ' abzuziehen' : 'Verteilte Erhaltungsaufwendungen aus ' + o, b, { feld: 'erh_verteilt_' + o });
            rest -= b;
          });
        } else if (erhV && Object.keys(erhV).length) {
          R.hinweise.push('Der Erhaltungsaufwand wurde von Hand geändert. DealPilot weiß deshalb nicht, welcher Teil verteilt ist (§ 82b EStDV): der ganze Betrag steht in Zeile ' + a.zeile + '. Verteilte Anteile gehören in die Zeilen der verteilten Erhaltungsaufwendungen.');
        }
        if (rest > 0.005) wkPush(a.zeile, name(f) + mark(f), rest, { feld: f });
        return;
      }
      wkPush(a.zeile, name(f) + mark(f), betrag, { feld: f });
      sachlogik(f, a.zeile);
    });
    /* zusaetzliche Werbungskosten aus den Angaben der Anlage V */
    SCHLUESSEL.forEach(function (f) {
      if (FELDER[f].art !== 'wk') return;
      var b = zahl(v[f]); if (!b) return;
      var nr = zeile(f);
      var txt = FELDER[f].vj ? 'Verteilte Erhaltungsaufwendungen aus ' + (jahr - FELDER[f].vj) + ' (nicht in DealPilot erfasst)'
        : (f === 'av_7h7i' && tot.av7h ? 'Erhöhte Absetzungen nach § ' + (tot.av7h.art === '7i' ? '7i (Baudenkmal)' : '7h (Sanierungsgebiet)') + ', ' + tot.av7h.satz + ' % von ' + eur(tot.av7h.basis) : name(f));
      if (nr == null) { R.ohne.push({ feld: f, text: txt, betrag: b * fA }); return; }
      wkPush(nr, txt + mark(f), b, { feld: f });
      sachlogik(f, nr);
    });
    R.wk.sort(function (a, b) { return a.zeile - b.zeile || (a.teil ? 1 : 0) - (b.teil ? 1 : 0); });
    R.summeWk = { zeile: S.werbungskosten, betrag: zahl(tot.werbungskosten) };
    R.ueberschuss = { zeile: S.ueberschuss, betrag: zahl(tot.einnahmen) - zahl(tot.werbungskosten) };
    if (ant < 100) R.hinweise.push('Abzugsfähiger Anteil ' + String(Math.round(ant * 100) / 100).replace('.', ',') + ' %: DealPilot trägt alle Werbungskosten als verhältnismäßig zugeordnet ein. Direkt zuordenbare Aufwendungen (nur für den vermieteten Teil oder nur für den selbst genutzten) gehören in die Zeilen „durch direkte Zuordnung ermittelt“ und sind dann von Hand umzustellen. Die erstmalige Aufteilung ist in einer gesonderten Aufstellung zu erläutern.');

    /* 3 · Angaben ohne Wirkung auf die Summen, Ankreuzfelder, Kuerzung, Zurechnung */
    if (tot.afaArt && zeile('afa') != null) {
      var ersteZ = S.afa_angaben != null ? S.afa_angaben : null;
      if (ersteZ != null) push(R.info, ersteZ, 'AfA Gebäude: ' + afaWort(tot.afaArt) + (zahl(tot.afaArt.s) > 0 ? ', ' + String(Math.round(zahl(tot.afaArt.s) * 100) / 100).replace('.', ',') + ' %' : '') + ' · ' + (tot.kaufjahr && jahr > tot.kaufjahr ? '1 = wie Vorjahr' : '2 = laut Erläuterung (erstes Jahr)'), null, { feld: 'afa_angaben', text_nur: true });
    }
    if (tot.erhG) push(R.info, S.erh_verteilt_gesamt, 'Gesamtaufwand ' + jahr + ' der auf bis zu 5 Jahre verteilten Erhaltungsaufwendungen', zahl(tot.erhG), { feld: 'erh_gesamt' });
    ['av_fewo', 'av_kurzfristig', 'av_angeh_flag', 'av_nk_nicht_vereinbart'].forEach(function (f) {
      var b = zahl(v[f]); if (b !== 1 && b !== 2) return;
      if (f === 'av_nk_nicht_vereinbart' && b !== 1) return;
      push(R.info, zeile(f), name(f).replace(/ \(1 = Ja.*\)$/, '') + ': ' + (b === 1 ? '1 = Ja' : '2 = Nein'), null, { feld: f, text_nur: true });
    });
    if (zahl(v.av_fewo) === 1 || zahl(v.av_kurzfristig) === 1) R.hinweise.push('Ferienwohnung oder kurzfristige Vermietung: zusätzlich ist die Anlage V-FeWo abzugeben. DealPilot führt sie nicht.');
    /* v3900 · Vordrucke vor 2023 haben das Ankreuzfeld nicht (zeile null): dann kein Hinweis */
    if (!nk && zahl(v.av_nk_nicht_vereinbart) !== 1 && km > 0 && zeile('av_nk_nicht_vereinbart') != null) R.hinweise.push('Es sind keine Umlagen erfasst. Sind mit den Mietern keine Nebenkosten gesondert vereinbart (Inklusivmiete), gehört in Zeile ' + (zeile('av_nk_nicht_vereinbart') || '') + ' eine 1.');
    ['av_wohnflaeche', 'av_eigen_qm', 'av_anteil_pct', 'av_vorsteuer', 'av_zuschuss_ahk', 'av_kuerzung_pct', 'av_kuerzung_betrag'].forEach(function (f) {
      var b = zahl(v[f]); if (!b) return;
      if (f === 'av_anteil_pct' && b >= 100) return;
      push(R.info, zeile(f), name(f), b, { feld: f, einheit: FELDER[f].einheit || '€' });
    });
    R.info.sort(function (a, b) { return a.zeile - b.zeile; });
    var kuerzung = zahl(tot.werbungskosten) * Math.max(0, Math.min(100, zahl(v.av_kuerzung_pct))) / 100 + Math.max(0, zahl(v.av_kuerzung_betrag));
    /* v3900 · Vordrucke vor 2023 haben keine Zeile fuer die Kuerzung (Anleitung: Werbungskosten nur mit dem entgeltlichen Teil, Spalte 3) */
    var _kzZ = [zeile('av_kuerzung_pct'), zeile('av_kuerzung_betrag')].filter(function (x) { return x != null; });
    if (kuerzung > 0.005 && !_kzZ.length) R.kuerzung = { betrag: kuerzung, text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung: ' + eur(kuerzung) + '. Der Vordruck ' + jahr + ' hat dafür keine eigene Zeile: dort gehören die Werbungskosten nur mit dem entgeltlichen Teil in die Zeilen (verhältnismäßig ermittelt, Prozentsatz in Spalte 3). Die Zeilen auf diesem Blatt stehen in voller Höhe. DealPilot rechnet die Steuerwirkung bereits mit der Kürzung.' };
    else if (kuerzung > 0.005) R.kuerzung = { betrag: kuerzung, text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung: ' + eur(kuerzung) + '. Im Formular stehen die Werbungskosten in voller Höhe, die Kürzung nimmt das Finanzamt aus der Angabe in Zeile ' + [zeile('av_kuerzung_pct'), zeile('av_kuerzung_betrag')].filter(function (x) { return x != null; }).join(' oder ') + ' vor (§ 21 Abs. 2 EStG). DealPilot rechnet die Steuerwirkung bereits mit der Kürzung.' };
    if (tot.verbilligt && tot.verbilligt.grund) R.hinweise.push(tot.verbilligt.grund);
    /* Zeile 86: Zurechnung Person A / Person B */
    if (S.zurechnung != null) {
      var pa = zahl(v.av_zurechnung_a_pct); if (!(pa > 0 && pa <= 100)) pa = 100;
      R.zurechnung = { zeile: S.zurechnung, kz: kz(S.zurechnung), pct: pa, a: R.ueberschuss.betrag * pa / 100, b: R.ueberschuss.betrag * (100 - pa) / 100 };
    }

    /* 4 · Zeilen, die DealPilot nicht fuehrt - was oben steht, gilt nicht als fehlend */
    var gedruckt = {}; R.einnahmen.concat(R.wk, R.info).forEach(function (e) { gedruckt[e.zeile] = 1; });
    if (R.zurechnung) gedruckt[R.zurechnung.zeile] = 1;
    R.nichtErfasst = (T.nicht_erfasst || []).filter(function (n) { return !gedruckt[n.zeile]; });
    return R;
  }
  function afaWort(a) {
    var m = a && a.m;
    return m === 'degressiv' ? 'degressiv § 7 Abs. 5a' : m === 'degressiv_wechsel' ? 'degressiv § 7 Abs. 5a, Wechsel zu linear' : 'linear';
  }

  /** Auskunft fuer den Tooltip im Reiter Steuer: Zeile, Kennzahl, Text - nur aus der Abschrift DIESES Jahres. */
  function zeileFuer(jahr, feld) {
    var T = tabelle(jahr); if (!T) return null;
    var a = T.felder[feld]; if (!a || a.zeile == null) return null;
    var z = T.zeilen[a.zeile] || {};
    return { zeile: a.zeile, kz: z.kz || null, text: z.text || '', quelle: a.quelle || null, grund: a.grund || null, formular: T.formular };
  }

  /** v3900 · Stempel fuer den gespeicherten Steuersatz (tax_records.anlage_v): nach welchem Vordruck die
      Zeilen gelten, damit ein spaeter gelesener Satz weiss, welche Nummern beim Speichern galten - auch wenn
      dann eine neue Abschrift vorliegt. Mit Abschrift des Jahres:
        { _formular: { jahr, kennung, stand }, _zeilen: { feld: zeile } }  (nur Felder mit Betrag)
      ohne: { _formular: { jahr, fehlt: true } } und keine Zeilen (streng je Jahr, kein Ersatzjahr).
      werte: die Werte des Jahres (values aus _computeYearTotal, auch _afaSonder7b). */
  function stempel(jahr, werte) {
    var j = Math.round(zahl(jahr)), T = tabelle(j), o = {};
    if (!T) { o._formular = { jahr: j, fehlt: true }; return o; }
    o._formular = { jahr: j, kennung: String(T.formular || '').slice(0, 80), stand: String(T.stand || '').slice(0, 40) };
    var z = {}; werte = werte || {};
    Object.keys(T.felder).forEach(function (f) {
      var a = T.felder[f]; if (!a || a.zeile == null || /^_/.test(f)) return;
      if (zahl(werte[f]) !== 0) z[f] = a.zeile;
    });
    if (zahl(werte._afaSonder7b) > 0 && T.summen && T.summen.sonder7b != null) z.afa_7b = T.summen.sonder7b;
    if (Object.keys(z).length) o._zeilen = z;
    return o;
  }

  window.AnlageVKern = { FELDER: FELDER, SCHLUESSEL: SCHLUESSEL, tabelle: tabelle, jahre: jahre, wirkung: wirkung, auszug: auszug, aufstellung: aufstellung, zeileFuer: zeileFuer, anteil: anteil, sieben: sieben, verbilligt: verbilligt, stempel: stempel };
})();
