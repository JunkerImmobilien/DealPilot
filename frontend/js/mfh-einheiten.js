/* ════════════════════════════════════════════════════════════════════
   MFH-KONFIGURATOR — EINHEITEN, IST/SOLL, ZUSTAND JE EINHEIT
   ════════════════════════════════════════════════════════════════════
   Backlog v22 Punkt 6, design/Vorschlaege/mfh-ist-soll-konfigurator.md.

   v1448 Stufe 1: Einheitenliste, Summen ins Objekt (Flaeche, Einheiten,
                  Ist-Kaltmiete der vermieteten Einheiten).
   v1451 Stufe 2: Massnahme + Kosten je Einheit (Summe nur auf Haken in die
                  Sanierung), Kennzahlen Ist gegen Soll im Ergebnis.
   v1454 Stufe 3: VIER SCHRITTE und Bewertung je Einheit nach den Kriterien
                  des Restnutzungsdauergutachtens (Anlage 2 ImmoWertV).
                  Marcel 20.09.2026: „nach den Kriterien vom
                  Restnutzungsdauergutachten … ausser das, was man vom
                  Haupthaus erbt, also Dach oder Heizung".

   Schritt 1 Gebaeude   die vier gemeinsamen Gewerke (Dach, Aussenwand,
                        Leitungen, Heizung) und die Vorgabe fuer die vier
                        wohnungsbezogenen — sie gilt fuer JEDE Einheit,
                        bis eine Einheit widerspricht (Vererbung).
   Schritt 2 Einheiten  die Liste wie bisher.
   Schritt 3 Zustand    je Einheit Fenster, Baeder, Innenausbau, Grundriss;
                        Vorgabe ist „wie Gebaeude".
   Schritt 4 Ergebnis   Punkte und Restnutzungsdauer je Einheit, flaechen-
                        gewichtet aufs Gebaeude, Uebernahme ins Objekt.

   KEIN eigener Rechenkern: Punkte und RND kommen aus DealPilotRND
   (rnd-calc.js, calcAll) und der GND-Tabelle (rnd-gnd-table.js) — dieselben
   Zahlen wie im RND-Assistenten.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  /* v2824 · GEW dazu (Marcel 22.10.2026: „das soll man auch machen können“) - Gewerbe-/
     Industriegebaeude mit Gewerbeeinheiten je Nutzungsart, wie das Geschaeftshaus. */
  var ARTEN_MIT_EINHEITEN = { MFH: 1, ZFH: 1, GESCH: 1, BUERO: 1, HOTEL: 1, GEW: 1 };
  /* v2824 · Art einer NEUEN Einheit: im Gewerbe-/Industriegebaeude Gewerbe, sonst Wohnen. */
  function standardArt() { return ((el('objart') && el('objart').value) || '') === 'GEW' ? 'gewerbe' : 'wohnen'; }
  var ZUSTAND = [['', '–'], ['5', 'neuwertig'], ['4', 'modernisiert'], ['3', 'gepflegt'], ['2', 'renovierungsbed.'], ['1', 'sanierungsbed.']];
  /* Anlage 2 ImmoWertV, aufgeteilt nach dem, was am Gebaeude haengt, und dem,
     was in der einzelnen Wohnung steckt. Punkte je Gewerk aus DealPilotRND. */
  var GEB_IDS = ['dach', 'aussenwand', 'leitungen', 'heizung'];
  var WE_IDS = ['fenster', 'baeder', 'innenausbau', 'grundriss'];
  var STUFEN = [['0', 'nicht modernisiert'], ['h', 'teilweise erneuert'], ['v', 'erneuert / modern']];
  var SCHRITTE = ['Gebäude', 'Einheiten', 'Zustand je Einheit', 'Ergebnis'];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(v) { if (v == null || String(v).trim() === '') return 0; var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function daten() { var d = window._dpMfh; if (!d || !Array.isArray(d.einheiten)) return { einheiten: [], gebaeude: {} }; if (!d.gebaeude) d.gebaeude = {}; return d; }

  /* ── Anlage-2-Punkte ─────────────────────────────────────────────── */
  function modListe() { return (window.DealPilotRND && window.DealPilotRND.MOD_ELEMENTS) || []; }
  function maxPunkte(id) { var e = modListe().filter(function (x) { return x.id === id; })[0]; return e ? e.max : 2; }
  function labelVon(id) { var e = modListe().filter(function (x) { return x.id === id; })[0]; return e ? e.label : id; }
  function punkteVon(id, stufe) { var m = maxPunkte(id); return stufe === 'v' ? m : (stufe === 'h' ? Math.ceil(m / 2) : 0); }
  /* Punkte einer Einheit = gemeinsame Gewerke (geerbt) + eigene Gewerke.
     Wo die Einheit nichts sagt, gilt die Vorgabe des Gebaeudes. */
  function punkteEinheit(e, geb) {
    var p = 0, geerbt = 0;
    GEB_IDS.forEach(function (id) { p += punkteVon(id, geb[id] || '0'); });
    WE_IDS.forEach(function (id) {
      var eigen = (e.mod && e.mod[id]) || '';
      if (!eigen) geerbt++;
      p += punkteVon(id, eigen || geb[id] || '0');
    });
    return { punkte: Math.min(20, p), geerbt: geerbt };
  }
  function gnd() {
    var d = daten();
    if (d.gnd) return zahl(d.gnd);
    var T = window.DealPilotRND_GND;
    var art = (el('objart') && el('objart').value) || 'MFH';
    /* v2824 · GEW -> Lager/Logistik (Anlage 1), derselbe Schluessel wie gewerbeGndSchluessel('gew') im Kern */
    var k = (art === 'GESCH' || art === 'BUERO') ? 'geschaeft' : (art === 'GEW' ? 'lager' : 'mfh');
    try { return (T && typeof T.getDefault === 'function' ? T.getDefault(k) : 80) || 80; } catch (x) { return 80; }
  }
  /* ══ v2095 · DIE EINHEITEN-RND LIEF IN DIE DEFAULTS ═══════════════════
   *
   * HIER STAND:
   *   calcAll({ baujahr: bj,
   *             stichtag: new Date().toISOString().slice(0,10),
   *             gnd: gnd(), modPoints: punkte })
   *
   * VIER Felder. `calcAll` liest ZEHN — gemessen am 10.10.2026:
   * `baujahr, stichtag, gnd, modPoints, gewerkeBewertung, gewerkeWeights,
   * gewerkeRestlebensdauer, schaeden, applySchadensAbschlag, kernsaniert`.
   * Die sechs ungenannten liefen still in die Vorgaben.
   *
   * ZWEI DAVON SIND TEUER:
   *
   * · `kernsaniert` fehlte. Der Kern sagt es in seinem eigenen Kommentar
   *   (`rnd-calc.js:896`): ohne diese Angabe gilt die Kappe **0,70 statt
   *   0,90** der GND. Bei GND 80 sind das 56 statt 72 Jahre — sechzehn
   *   Jahre Unterschied an jeder Einheit, und zwar lautlos.
   *
   * · `stichtag` war auf HEUTE festgenagelt. Das verstößt gegen Marcels
   *   fachliche Festlegung vom 10.10.2026: der Wertermittlungsstichtag
   *   ist der ausdrücklich gesetzte, nicht automatisch ein Datum, das
   *   das Programm sich selbst nimmt. `mapDealPilotObject` führt dafür
   *   eine Rangfolge (ausdrücklich gesetzt > wirtschaftlicher Übergang >
   *   Kaufdatum > heute) und schreibt mit, welcher Weg gegriffen hat.
   *
   * Statt diese Rangfolge hier ein ZWEITES Mal zu schreiben, wird sie
   * geholt: `mapDealPilotObject(collectData())` — derselbe Weg, den
   * `deal-action.js:1813` nimmt. Eine zweite Ableitung wäre genau der
   * Fehler, den `score-tiers.js` vier Kopien gekostet hat.
   *
   * Überschrieben wird nur, was an der EINHEIT anders ist: die Punkte
   * (mit Vererbung gerechnet) und die GND des Wizards.
   *
   * ── WAS DAMIT NICHT GELÖST IST, und das gehört gesagt ───────────────
   * `kernsaniert` erbt die Einheit vom GEBÄUDE. Eine einzelne
   * kernsanierte Wohnung in einem sonst unsanierten Haus lässt sich
   * heute nicht erfassen: `istKernsaniert()` sucht den Text
   * „kernsanier" in den Werten, die MFH-Stufen heißen aber `0/h/v`.
   * Auf den Einheitendaten wäre die Funktion also IMMER `false` — sie
   * dort aufzurufen hätte wie eine Prüfung ausgesehen und nie gegriffen.
   * Im Backlog unter N60.10 notiert.                                   */
  function rndBasis() {
    /* Einmal je Auswertung, nicht je Einheit: collectData() liest das
       ganze Formular. */
    try {
      if (typeof window.collectData === 'function'
          && window.DealPilotRND && window.DealPilotRND.mapDealPilotObject) {
        return window.DealPilotRND.mapDealPilotObject(window.collectData()) || null;
      }
    } catch (x) {}
    return null;
  }

  function rndFuer(punkte, basis) {
    var bj = zahl(el('baujahr') && el('baujahr').value);
    if (!bj || !window.DealPilotRND || !window.DealPilotRND.calcAll) return null;
    var eingabe = {};
    if (basis) {
      for (var k in basis) {
        if (Object.prototype.hasOwnProperty.call(basis, k)) eingabe[k] = basis[k];
      }
    }
    /* Ohne Basis bleibt nur der alte Notweg — aber er wird BENANNT,
       statt als vollwertige Rechnung durchzugehen. */
    if (!basis) {
      eingabe.stichtag = new Date().toISOString().slice(0, 10);
      eingabe.stichtag_herkunft = 'Notweg: collectData() nicht erreichbar, heutiges Datum';
    }
    eingabe.baujahr = bj;
    eingabe.gnd = gnd();
    eingabe.modPoints = punkte;
    eingabe.modPoints_herkunft = modQuelle() === 'felder' ? 'Punkte des Hauses aus den acht Feldern im Reiter Objekt'   /* v2540 */
      : 'Punkte des Hauses aus den Einheiten (flächengewichtet, Gebäudegewerke geerbt)';   /* v2483 */
    try {
      var r = window.DealPilotRND.calcAll(eingabe);
      var jahre = (r && r.methods && r.methods.punktraster)
        ? r.methods.punktraster.restnutzungsdauer
        : (r ? r.final_rnd : null);
      return { jahre: jahre,
               stichtag: eingabe.stichtag || null,
               stichtag_herkunft: eingabe.stichtag_herkunft || null,
               kernsaniert: eingabe.kernsaniert === true,
               gnd: eingabe.gnd };
    } catch (x) { return null; }
  }

  function summe(list) {
    var s = { anzahl: list.length, wohnen: 0, flaeche: 0, flaecheGew: 0, ist: 0, soll: 0, leer: 0, leerFl: 0, kosten: 0, hatSoll: false };
    list.forEach(function (e) {
      var fl = zahl(e.wfl);
      s.flaeche += fl;
      if (e.art === 'gewerbe') s.flaecheGew += fl; else s.wohnen++;
      if (e.status === 'leer') { s.leer++; s.leerFl += fl; } else s.ist += zahl(e.ist);
      s.soll += zahl(e.soll) || zahl(e.ist);
      if (zahl(e.soll) > 0) s.hatSoll = true;
      s.kosten += zahl(e.kosten);
    });
    /* v2966 · Massnahmen am ganzen Haus gehoeren in die Summe (und in „als Sanierung uebernehmen“) -
       im offenen Fenster der Arbeitsstand, sonst das Gespeicherte */
    s.kostenHaus = (el('mfh-modal') ? _hausM : (daten().haus_massnahmen || [])).reduce(function (a, m) { return a + zahl(m && m.k); }, 0);
    s.kosten += s.kostenHaus;
    /* ══ v2486 · DIE SOLL-MIETE AUS DERSELBEN QUELLE WIE DAS WOHNUNGSFENSTER ══
       Hier zaehlte nur die VON HAND eingetragene Soll-Miete (e.soll), sonst die
       Ist-Miete. Seit v2430 rechnet DealPilot die Soll-Miete selbst
       (Vergleichsmiete, Kappungsgrenze) - gemessen (Drehbuch Modul 26): die
       Summenzeile zeigte „Soll 2.265 €/Monat" gleich Ist, das Wohnungsfenster
       die gerechnete Mieterhoehung. Jetzt dieselbe Summe wie DpPotenzial
       (Soll ueber Ist, sonst Ist; Leerstand bleibt leer). Die eigene Angabe
       bleibt als sollEigen/hatSollEigen fuer die Felder me_soll/me_pct. */
    s.sollEigen = s.soll; s.hatSollEigen = s.hatSoll;
    try {
      var P = window.DpPotenzial && typeof window.DpPotenzial.modell === 'function' ? window.DpPotenzial.modell({ einheiten: list }) : null;
      if (P && P.art === 'mfh' && Array.isArray(P.wohnungen) && P.wohnungen.length) {
        s.soll = P.wohnungen.reduce(function (a, w) { return a + ((w.soll && w.soll.miete != null && w.soll.miete > w.ist) ? w.soll.miete : w.ist); }, 0);
        s.hatSoll = s.hatSollEigen || !!P.hat_soll;
        s.sollQuelle = 'DpPotenzial';
      }
    } catch (x) {}
    return s;
  }


  /* ── v1629 · Die Bruecke zum Objekt-Tab ────────────────────────────
     Siehe Kopf dieser Datei: dieselben acht Gewerke, zwei Skalen, und
     bis hierher kannten sich die beiden Seiten nicht. */
  var STUFE_ZU_OBJEKT = { '0': 'Keine/Nie', h: '10 - 20 Jahre', v: '< 5 Jahre' };

  /** Wie viele Punkte gibt ein Wert aus dem OBJEKT-TAB?
   *  Wortgleich zu rnd-wizard.js (Z. 890) - wer das hier aendert, muss
   *  es dort auch aendern, sonst rechnen zwei Stellen verschieden. */
  function punkteObjekt(id, wert) {
    var m = maxPunkte(id), z = String(wert || 'Keine/Nie');
    if (z.indexOf('< 5') >= 0 || z.indexOf('Kernsanierung') >= 0) return m;
    if (z.indexOf('5 - 10') >= 0 || z.indexOf('5-10') >= 0) return Math.round(m * 0.7);
    if (z.indexOf('10 - 20') >= 0 || z.indexOf('10-20') >= 0) return Math.round(m * 0.4);
    return 0;
  }

  /** Die Stufe des Modals, die denselben Punktwert traegt. */
  function objektZuStufe(id, wert) {
    var p = punkteObjekt(id, wert);
    if (p <= 0) return '0';
    return p >= maxPunkte(id) ? 'v' : 'h';
  }

  /** Was im Objekt-Tab steht, beim Oeffnen uebernehmen - sonst fragt das
   *  Modal noch einmal, was der Nutzer laengst gesagt hat. */
  var _objektVorher = {};
  function ausObjektVorbelegen() {
    _objektVorher = {};
    GEB_IDS.concat(WE_IDS).forEach(function (id) {
      var f = el('mod_' + id);
      var w = f ? String(f.value || '') : '';
      _objektVorher[id] = w;
      /* Nur vorbelegen, wo das Modal noch nichts weiss - eine im Modal
         getroffene Angabe ist die juengere und gilt. */
      if (w && !_geb[id]) _geb[id] = objektZuStufe(id, w);
    });
  }

  /** Und zurueck: die vier Gebaeude-Gewerke in den Objekt-Tab, damit das
   *  RND-Gutachten die Herleitung hat und nicht nur die Summe.
   *  Angefasst wird nur, was sich in den PUNKTEN unterscheidet - sonst
   *  wuerde "5 - 10 Jahre" still zu "10 - 20 Jahre" vergroebert. */
  function inObjektZurueck() {
    var geaendert = [];
    GEB_IDS.forEach(function (id) {
      var stufe = _geb[id] || '';
      if (!stufe) return;
      var f = el('mod_' + id);
      if (!f) return;
      var alt = _objektVorher[id] || '';
      if (punkteObjekt(id, alt) === punkteVon(id, stufe)) return;   /* gleich viel wert */
      var neu = STUFE_ZU_OBJEKT[stufe];
      if (!neu) return;
      f.value = neu;
      try { f.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {}
      geaendert.push(labelVon(id).replace(/^(Modernisierung|Verbesserung) /, ''));
    });
    return geaendert;
  }

  /* ── Einstieg unter der Wohnflaeche ─────────────────────────────── */
  function knopf() {
    var art = (el('objart') && el('objart').value) || '';
    var wfl = el('wfl'); var f = wfl && wfl.closest ? wfl.closest('.f') : null;
    var k = el('mfh-einstieg');
    if (!f) return;
    if (!k) {
      k = document.createElement('div'); k.id = 'mfh-einstieg'; k.style.cssText = 'margin-top:6px';
      f.appendChild(k);
    }
    objektfelderNachArt(art);
    if (!ARTEN_MIT_EINHEITEN[art]) { k.innerHTML = ''; k.style.display = 'none'; return; }
    var d = daten(), n = d.einheiten.length;
    k.style.display = '';
    k.innerHTML = '<button type="button" class="btn btn-outline btn-sm" id="mfh-oeffnen">▸ Einheiten erfassen'
      + (n ? ' (' + n + ' erfasst)' : ' — optional') + '</button>'
      + (n ? '<div class="cf-hint" style="margin-top:4px">Fläche, Einheiten und Ist-Kaltmiete aus ' + n + ' Einheiten übernommen.</div>' : '');
    el('mfh-oeffnen').onclick = function () { oeffnen(0); };
  }

  /* ══ v1738 · WAS BEI EINEM MEHRFAMILIENHAUS KEINEN SINN ERGIBT ══
     Marcel am 01.10.2026: „dass wir vielleicht auch Sachen einfach
     ausblenden bei Mehrfamilienhäusern, die dann keinen Sinn machen bei
     dem Tab Objekt" und „die Zimmer zusammenzählen und direkt eintragen …
     das könnte eine Automatik sein".

     ZWEI FELDER VERHALTEN SICH BEI EINHEITEN ANDERS:

     · Miteigentumsanteil — er beschreibt den Bruchteil, mit dem eine
       Eigentumswohnung am gemeinschaftlichen Eigentum hängt (§ 1 Abs. 2
       WEG). Wer das GANZE Haus kauft, hält 100 %, und 100 % einzutragen
       ist keine Angabe, sondern eine Pflichtübung. Das Feld wird
       ausgeblendet und auf 100 gesetzt, damit nachgelagerte Rechnungen
       (Bodenwertanteil) weiter aufgehen.

     · Zimmer — bei einer Wohnung ist das eine Eingabe, bei einem Haus mit
       zwölf Einheiten die SUMME aus zwölf Zeilen. Sie von Hand zu pflegen
       heißt, sie bei jeder Änderung zu vergessen.

     > Ein Feld, dessen Wert sich aus anderen Feldern ergibt, ist keine
     > Eingabe. Es als Eingabe stehen zu lassen lädt dazu ein, es falsch
     > zu füllen — und niemand merkt es, weil beides plausibel aussieht.

     Deshalb wird es schreibgeschützt, trägt den Hinweis, woher die Zahl
     kommt, und `uebernehmen()` schreibt sie mit. */
  function feldBox(id) {
    var e = el(id);
    return e ? (e.closest ? e.closest('.f') : null) : null;
  }
  function objektfelderNachArt(art) {
    art = art || ((el('objart') && el('objart').value) || '');
    var mitEinheiten = !!ARTEN_MIT_EINHEITEN[art];

    var meaBox = feldBox('mea'), mea = el('mea');
    if (meaBox) meaBox.style.display = mitEinheiten ? 'none' : '';
    if (mea && mitEinheiten && String(mea.value).trim() !== '100') {
      mea.value = '100';
      try { mea.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }

    var zi = el('zimmer');
    if (zi) {
      zi.readOnly = mitEinheiten;
      zi.title = mitEinheiten ? 'Summe aus den erfassten Einheiten — im Einheiten-Dialog pflegen' : '';
      var box = feldBox('zimmer');
      if (box) {
        var h = box.querySelector('.dp-zimmer-auto');
        if (mitEinheiten && !h) {
          h = document.createElement('div');
          h.className = 'cf-hint dp-zimmer-auto';
          h.style.marginTop = '4px';
          h.textContent = 'Summe aus den erfassten Einheiten.';
          box.appendChild(h);
        } else if (!mitEinheiten && h) { h.remove(); }
      }
    }
  }

  /* ── Modal mit vier Schritten ───────────────────────────────────── */
  var _arbeit = [], _geb = {}, _schritt = 0, _weg = false, _auftK = null, _hausM = [];   /* v2966: _hausM Massnahmen am ganzen Haus (N80) */   /* v2430: _auftK Kosten der Aufteilung */

  function selHtml(attrs, wert, opts) {
    return '<select class="mfh-in mfh-sel" ' + attrs + '>'
      + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(wert || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  }

  /* Schritt 1 — Gebaeude */
  function schritt1() {
    function zeile(id, fuerWohnung) {
      return '<tr><td style="padding:5px 10px 5px 0">' + esc(labelVon(id)) + '<div style="font-size:11px;color:#8A8272" title="Anlage 2: maximal ' + maxPunkte(id) + ' von 20 Punkten">'
        + (fuerWohnung ? ' · gilt für jede Einheit, bis sie widerspricht' : ' · gilt für das ganze Haus') + '</div></td>'
        + '<td style="padding:5px 0;text-align:right">' + selHtml('data-geb="' + id + '"', _geb[id], STUFEN) + '</td></tr>';
    }
    var _vor = GEB_IDS.concat(WE_IDS).filter(function (id) { return _objektVorher[id]; }).length;
    var bj = (el('baujahr') && el('baujahr').value) || '—';
    return '<div style="font-size:12.5px;color:#6B6356;margin-bottom:10px">Baujahr ' + esc(bj) + ' · Gesamtnutzungsdauer ' + gnd() + ' Jahre. '
      + 'Die Kriterien sind die der Anlage 2 ImmoWertV — dieselben wie im Restnutzungsdauer-Assistenten.</div>'
      + (_vor ? '<div style="font-size:12.5px;color:#6B6356;margin:-4px 0 10px">' + '<b>' + _vor + ' Angaben' + (_vor === 1 ? ' stammt' : ' stammen') + ' aus dem Tab Objekt</b> und sind unten schon gesetzt. Was du hier änderst, geht zurück dorthin.</div>' : '')
      + '<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>'
      + '<tr><td colspan="2" style="padding:8px 0 4px;font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A8272">Gemeinsam — vom Haus geerbt</td></tr>'
      + GEB_IDS.map(function (id) { return zeile(id, false); }).join('')
      + '<tr><td colspan="2" style="padding:12px 0 4px;font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A8272">Vorgabe für die Wohnungen</td></tr>'
      + WE_IDS.map(function (id) { return zeile(id, true); }).join('')
      + '</tbody></table>'
      + '<div style="margin-top:12px;padding:9px 11px;border:1px solid #E6E0D3;border-radius:8px;background:#FBFAF7;font-size:13px">'
        + '<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="mfh-weg"' + (_weg ? ' checked' : '') + '>'
        + '<span><b>In Wohnungseigentum aufgeteilt</b> (Teilungserklärung nach WEG)<div style="font-size:11.5px;color:#8A8272">'
        + 'Dann ist jede Einheit einzeln verkäuflich — für Bank und Exit ein Unterschied. Score und Cashflow bleiben unberührt; das Wertpotenzial (Pilot-Analyse, PDF) zeigt zusätzlich jede Wohnung als Eigentumswohnung und die Summe nach Aufteilung.</div></span></label>'
        /* v2430 · Kosten der Aufteilung, eigene Angabe mit Vorbelegung */
        + '<div style="margin:8px 0 0 21px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px">Kosten der Aufteilung '
        + '<input class="mfh-in mfh-md" id="mfh-auftk" inputmode="decimal" style="width:120px" value="' + esc(_auftK == null ? '' : String(_auftK)) + '" placeholder="' + (((window.DpPotenzial && window.DpPotenzial.AUFTEILUNG_JE_WE) || 1800) * Math.max(1, _arbeit.filter(function (x) { return x.art !== 'gewerbe'; }).length)).toLocaleString('de-DE') + ' (Vorbelegung)"> €'
        + '<span style="font-size:11.5px;color:#8A8272">Notar, Grundbuch, Teilungserklärung, Abgeschlossenheit · leer = Vorbelegung 1.800 € je Wohnung · schon aufgeteilt: 0</span></div></div>'
      /* v2541 · Jahr, in dem das Zielbild erreicht ist - dasselbe Feld wie im Reiter Objekt (zb_fertig_jahr) */
      + '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px">Zielbild fertig (Jahr) '
        + '<input class="mfh-in mfh-md" id="mfh-zbjahr" inputmode="numeric" maxlength="4" style="width:80px" value="' + esc((el('zb_fertig_jahr') && el('zb_fertig_jahr').value) || '') + '" placeholder="z. B. 2028">'
        + '<span style="font-size:11.5px;color:#8A8272">für Pilot-Analyse und PDF · leer = offen</span></div>'
      + '<div class="cf-hint" style="margin-top:8px">Gebäudepunkte: <b id="mfh-geb-p">—</b> von 20 (Anlage 2). Dach, Außenwand, Leitungen und Heizung kann eine einzelne Wohnung nicht abweichend haben.</div>'
      /* v2966 · N80 (Marcel 26.10.2026): Massnahmen am GANZEN Haus fuer das Zielbild. Der Zustand oben
         ist heute, die Massnahme hier das Ziel. Kosten nach Wohnflaeche auf die Wohnungen, Punkte fuer jede
         Wohnung (je Gewerk hoechstens einmal, auch neben der Elektrik einer Wohnung). */
      + '<div class="mfh-haus-mass" style="margin-top:14px;padding:10px 11px;border:1px solid #E6E0D3;border-radius:8px;background:#FBFAF7">'
        + '<div style="font:600 11px/1.3 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A8272">Maßnahmen am ganzen Haus · Zielbild <span style="text-transform:none;letter-spacing:0;font-weight:400">kann, nicht muss</span></div>'
        + '<div style="font-size:11.5px;color:#8A8272;margin:4px 0 8px">Dach, Fassade, Fenster, Heizung oder Leitungen für das ganze Haus — mit Kosten. Die Kosten werden nach Wohnfläche auf die Wohnungen verteilt, die Modernisierungspunkte gelten für jede Wohnung. Was eine einzelne Wohnung bekommt (z. B. ihr Bad), steht unter Einheiten › Details.</div>'
        + '<div id="mfh-haus-mass"></div><div class="cf-hint" id="mfh-haus-sum" style="margin-top:6px"></div></div>';
  }

  /* Schritt 2 — Einheitenliste */
  function zeileHtml(e, i) {
    /* v1627 · Vier Breitenstufen statt acht Einzelwerten - und KEINE
       Gestaltung am Element. Rahmen, Polster, Schrift und Fokus kommen
       aus dem Stilblock, genau wie bei .set-modal-v2. */
    function stufe(w) { return w <= 46 ? 'xs' : (w <= 62 ? 'sm' : (w <= 90 ? 'md' : 'lg')); }
    function inp(k, w, ph, typ) {
      return '<input class="mfh-in mfh-' + stufe(w) + '" data-i="' + i + '" data-k="' + k
        + '" value="' + esc(e[k] || '') + '" placeholder="' + (ph || '')
        + '" inputmode="' + (typ || 'text') + '">';
    }
    function sel(k, opts) { return selHtml('data-i="' + i + '" data-k="' + k + '"', e[k], opts); }
    /* v2430 · Marcel 19.10.2026: „Anlegen geht schnell, planen passiert in der
       Wohnung." Die Liste fuehrt nur noch Nr, Lage, Flaeche, Zimmer, Ist-Miete
       und Status. Art, Zustand, Soll-Miete, Zielbild und Massnahmen stehen im
       Wohnungsfenster (\u2026). Die Daten bleiben dieselben Felder. */
    var _plan = (zahl(e.soll) > 0 || zahl(e.ziel_qm) > 0 || (Array.isArray(e.massnahmen) && e.massnahmen.length) || String(e.massnahme || '').trim());
    return '<tr>' +
      '<td>' + inp('nr', 44, String(i + 1)) + (e.art === 'gewerbe' ? '<div class="mfh-tag">Gewerbe</div>' : '') + '</td>' +
      '<td>' + inp('lage', 86, 'EG links') + '</td>' +
      '<td>' + inp('wfl', 60, 'm²', 'decimal') + '</td>' +
      '<td>' + inp('zimmer', 44, '', 'decimal') + '</td>' +
      '<td>' + inp('ist', 72, '€/Mon', 'decimal') + '</td>' +
      '<td>' + sel('status', [['vermietet', 'vermietet'], ['leer', 'leer']]) + '</td>' +
      '<td style="white-space:nowrap"><button type="button" data-det="' + i + '" class="mfh-det' + (_plan ? ' mit-plan' : '') + '" title="Mietvertrag, Soll-Miete, Zielbild und Ertragswert dieser Wohnung">Details' + (_plan ? ' · Plan' : '') + '</button> ' +
      '<button type="button" data-dup="' + i + '" title="Zeile duplizieren" style="border:1px solid #E6E0D3;background:#fff;border-radius:6px;padding:5px 8px;cursor:pointer">⧉</button> ' +
      '<button type="button" data-del="' + i + '" title="Zeile löschen" style="border:1px solid #E6E0D3;background:#fff;border-radius:6px;padding:5px 8px;cursor:pointer;color:#B8625C">✕</button></td>' +
      '</tr>';
  }
  /* ══ v2021 · DAS WOHNUNGSFENSTER ════════════════════════════════

     Marcel: „wenn wir auf die Wohnung klicken, dass da drin dann
     wieder ein Modal aufgeht, wo wir dann alle Angaben machen
     können … auch mit Bildern nochmal zusätzlich."

     Die Tabellenzeile bleibt der Ueberblick. Alles, was eine
     einzelne Wohnung ausmacht, steht hier - und wird im selben
     Einheiten-Objekt gespeichert, das es schon gibt. */

  /* Die Vertragsformen des deutschen Mietrechts, mit Fundstelle.
     Staffel und Index tragen ihre naechste Erhoehung SCHON im
     Vertrag - sie sind kein Potenzial, sondern ein Termin. Wer
     beides gleich behandelt, rechnet dieselbe Steigerung zweimal. */
  var MIETVERTRAG_ARTEN = [
    ['', '– keine Angabe –'],
    ['unbefristet', 'Unbefristet (Regelfall)'],
    ['staffel', 'Staffelmiete (\u00a7 557a BGB)'],
    ['index', 'Indexmiete (\u00a7 557b BGB)'],
    ['zeitmiete', 'Zeitmietvertrag, befristet (\u00a7 575 BGB)'],
    ['kuendigungsverzicht', 'Mit K\u00fcndigungsverzicht'],
    ['gewerbe', 'Gewerbemietvertrag'],
    ['moebliert_kurz', 'M\u00f6bliert / Kurzzeit (\u00a7 549 Abs. 2 BGB)'],
    ['werkswohnung', 'Werks-/Dienstwohnung (\u00a7 576 BGB)'],
    ['sozial', 'Preisgebunden / Sozialwohnung'],
    ['unter', 'Untermietvertrag']
  ];
  var WOHNUNG_FOTOS_MAX = 6;

  /* v2210 · Gewerbe im Ertragswert. Anlage 3 ImmoWertV setzt die
     Instandhaltung gewerblicher Flaechen als Anteil der Wohn-Instandhaltung
     je m2 Nutzflaeche an: Buero/Praxen/Geschaefte 100 %, SB-Maerkte 50 %,
     Lager/Logistik 30 %. Ohne Nutzungsart rechnet der Marktbericht keine
     Gewerbe-Instandhaltung (und sagt es). */
  var GEWERBE_NUTZUNG = [
    ['', '– Nutzung –'],
    ['buero_praxis_laden', 'Büro / Praxis / Laden'],
    ['sb_markt', 'SB-Markt'],
    ['lager_logistik', 'Lager / Logistik']
  ];

  function wSchliessen() { var a = el("mfh-we-ov"); if (a && a.parentNode) a.parentNode.removeChild(a); }

  function wohnungOeffnen(i) {
    var e = _arbeit[i]; if (!e) return;
    wSchliessen();
    var P = window.DpPotenzial || null;
    /* v2430 · alte Felder massnahme/kosten werden zur Liste (migrationsfrei) */
    var _ml = P ? P.massnahmenVon(e).map(function (m) { var c = Object.assign({}, m); delete c.alt; return c; }) : [];
    e.massnahmen = _ml;
    function f(k, label, ph, typ, breit, extra) {
      return '<label class="mfh-we-f' + (breit ? ' mfh-we-breit' : '') + '"><span>' + esc(label) + '</span>'
        + '<input data-wk="' + k + '" value="' + esc(e[k] == null ? '' : e[k]) + '" placeholder="' + esc(ph || '')
        + '" inputmode="' + (typ || 'text') + '"' + (extra || '') + '></label>';
    }
    function s(k, label, opts) {
      return '<label class="mfh-we-f"><span>' + esc(label) + '</span>'
        + selHtml('data-wk="' + k + '"', e[k], opts) + '</label>';
    }
    function d(k, label, typ) {
      return '<label class="mfh-we-f"><span>' + esc(label) + '</span>'
        + '<input type="' + (typ || 'date') + '" data-wk="' + k + '" value="' + esc(e[k] || '') + '"></label>';
    }
    function blk(cls, titel, inhalt) { return '<section class="mfh-we-blk ' + cls + '"><div class="mfh-we-blk-t">' + titel + '</div>' + inhalt + '</section>'; }
    var titel = (e.lage || e.nr || (i + 1));
    var ov = document.createElement("div"); ov.id = "mfh-we-ov";
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(42,39,39,.60);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px';
    var _wort = e.art === 'gewerbe' ? 'Einheit' : 'Wohnung';   /* v2824 · eine Gewerbeeinheit ist keine Wohnung */
    ov.innerHTML = '<div class="mfh-we-karte" role="dialog" aria-modal="true" aria-label="' + _wort + ' ' + esc(String(titel)) + '">' +
      '<div class="mfh-we-kopf"><div><b>' + _wort + ' ' + esc(String(e.nr || (i + 1))) + (e.lage ? ' · ' + esc(e.lage) : '') + '</b>'
        + '<span class="mfh-we-unter" id="mfh-we-unter"></span></div>'
        + '<button type="button" id="mfh-we-zu" aria-label="Schließen">✕</button></div>' +
      '<div class="mfh-we-leib">' +
        blk('', 'Stammdaten', '<div class="mfh-we-raster">' +
          f('nr', 'Nummer', String(i + 1)) +
          f('lage', 'Lage im Haus', 'EG links') +
          s('art', 'Art', [['wohnen', 'Wohnen'], ['gewerbe', 'Gewerbe']]) +
          f('wfl', 'Wohnfläche (m²)', '', 'decimal') +
          f('zimmer', 'Zimmer', '', 'decimal') +
          f('etage', 'Etage', 'z. B. 2. OG') +
          f('balkon_qm', 'Balkon/Terrasse (m²)', '', 'decimal') +
          f('keller', 'Keller / Abstellraum', 'z. B. Kellerabteil 4') +
          f('stellplatz', 'Stellplatz / Garage', 'z. B. TG-Platz 7') +
          s('zustand', 'Gesamtzustand', ZUSTAND) +
          (_weg ? f('mea_anteil', 'Miteigentumsanteil (z. B. 125 von 1000)', 'optional', 'decimal') : '') +
        '</div>' +
        /* v2210 · erscheint nur, wenn die Einheit Gewerbe ist */
        '<div id="mfh-we-gew-box"><h4>Gewerbe</h4>' +
          '<p class="mfh-we-hint">Die Fläche gilt hier als <b>Nutzfläche</b>. Für den Ertragswert zählt die <b>marktübliche</b> Miete (§ 31 Abs. 2 ImmoWertV). ' +
          'Fehlt sie, setzt der Marktbericht die Ist-Miete an und kennzeichnet das Ergebnis als indikativ.</p>' +
          '<div class="mfh-we-raster">' +
            s('nutzung_gew', 'Nutzungsart', GEWERBE_NUTZUNG) +
            f('markt_qm', 'Marktübliche Miete (€/m² · Monat)', 'optional', 'decimal') +
          '</div></div>') +
        blk('', 'Mietvertrag · Ist',
          '<div class="mfh-we-raster">' +
            f('ist', 'Ist-Kaltmiete (€/Monat)', '', 'decimal') +
            s('status', 'Status', [['vermietet', 'vermietet'], ['leer', 'leer']]) +
            f('nk_vorauszahlung', 'NK-Vorauszahlung (€/Monat)', '', 'decimal') +
            f('stellplatz_miete', 'Stellplatzmiete (€/Monat)', '', 'decimal') +
            s('mv_art', 'Vertragsart', MIETVERTRAG_ARTEN) +
            d('mv_beginn', 'Mietbeginn') +
            d('mv_letzte_erhoehung', 'Letzte Erhöhung') +
            f('mv_letzte_erhoehung_betrag', 'Letzte Erhöhung um (€/Monat)', 'für die Kappungsgrenze', 'decimal') +
            d('mv_naechste_anpassung', 'Nächste Anpassung (Staffel/Index)') +
            f('mv_kaution', 'Kaution (€)', '', 'decimal') +
            d('mv_befristet_bis', 'Befristet bis') +
            d('mv_kuendigungsverzicht_bis', 'Kündigungsverzicht bis') +
            /* v2600 · E2 · Restlaufzeit einer Mietabweichung (Underrent: bis zur rechtlich moeglichen Anpassung) */
            f('mv_abw_jahre', 'Abweichung erwartet noch (Jahre)', 'nur bei Miete unter Markt', 'decimal') +
            f('mv_mieter', 'Mieter (Name, optional)', '') +
            f('mv_notiz', 'Notiz zum Vertrag', '', 'text', true) +
          '</div>' +
          /* v2600 · E2/E3 · Hinweis zur Restlaufzeit und der waehlbare Leerstandsabzug (nur bei „leer") */
          '<p class="mfh-we-hint">Liegt die Ist-Miete außerhalb von ± 20 % um die marktübliche Miete, rechnet der Ertragswert mit der marktüblichen Miete; '
            + 'die Abweichung wird über die <b>Restlaufzeit</b> beziffert: bei Miete <i>über</i> dem Markt nur mit <b>Befristet bis</b> oder <b>Kündigungsverzicht bis</b>, '
            + 'bei Miete darunter auch mit „Abweichung erwartet noch". Ohne Angabe zeigt der Bericht Szenarien (3/5/10 Jahre).</p>' +
          '<div id="mfh-we-leer-box" style="display:none"><h4>Leerstand</h4>' +
            '<p class="mfh-we-hint">Standard: voll vermietet zur marktüblichen Miete. Wahlweise ziehen Mietausfall bis zur Vermietung und Herrichtung vom Ertragswert ab.</p>' +
            '<label class="mfh-we-haken"><input type="checkbox" data-wkb="leer_abzug"' + (e.leer_abzug ? ' checked' : '') + '>' +
              '<span>Mietausfall und Herrichtung <b>abziehen</b></span></label>' +
            '<div class="mfh-we-raster">' +
              f('leer_monate', 'Monate bis zur Vermietung', 'z. B. 4', 'decimal') +
              f('herrichtung_eur', 'Herrichtung (€)', 'z. B. 6.000', 'decimal') +
            '</div></div>' +
          '<p class="mfh-we-hint">Staffel- und Indexmiete tragen ihre nächste Erhöhung schon im Vertrag — sie sind ein <b>Termin</b>, kein Potenzial. ' +
            '<b>Kündigungsverzicht</b> heißt: <i>beide</i> Seiten verzichten bis zu diesem Datum auf die ordentliche Kündigung (bei Staffelmiete höchstens vier Jahre, § 557a Abs. 3 BGB).</p>' +
          /* v2023 - die Erhoehung wird konkret, nur bei Staffel und Index */
          '<div id="mfh-we-erh-box" style="display:none">' +
            '<h4>Geplante Erhöhungen</h4>' +
            '<div id="mfh-we-index-warn" class="mfh-we-warn" style="display:none">' +
              '<b>Indexmiete — die Höhe ist eine Annahme.</b> Der <i>Termin</i> steht im Vertrag, ' +
              'die Höhe ergibt sich erst aus dem Verbraucherpreisindex. Was du hier einträgst, ' +
              'rechnet DealPilot als <b>Annahme</b> fort und kennzeichnet sie auch in der Mietentwicklung.' +
            '</div>' +
            '<div class="mfh-we-raster">' +
              s('mv_erhoehung_art', 'Erhöhung angeben als', [['', '–'], ['prozent', 'Prozent'], ['betrag', 'Euro je Monat']]) +
              f('mv_erhoehung_wert', 'Nächste Erhöhung (Höhe)', 'z. B. 3 oder 45', 'decimal') +
              f('mv_rhythmus_jahre', 'Rhythmus (alle … Jahre)', 'z. B. 2', 'decimal') +
              f('mv_stufen_offen', 'Noch offene Stufen', 'z. B. 3', 'decimal') +
            '</div>' +
            '<label class="mfh-we-haken"><input type="checkbox" data-wkb="mv_in_mietentwicklung"' +
              (e.mv_in_mietentwicklung ? ' checked' : '') + '>' +
              '<span>Diese Staffel in die <b>Mietentwicklung</b> des Objekts einrechnen</span></label>' +
          '</div>') +
        /* v2430 · SOLL-MIETE (MIETER BLEIBT) — Marcel 19.10.2026: „normale
           Mieterhoehung", freiwillig. DealPilot rechnet vor (§ 558 bis zur
           Vergleichsmiete, Kappungsgrenze, 15 Monate; § 559 bei Massnahmen im
           bewohnten Zustand); eine eigene Angabe ueberschreibt. */
        blk('soll', 'Soll-Miete (Mieter bleibt) <span class="mfh-we-kann">kann, nicht muss</span>',
          '<div class="mfh-we-raster">' +
            f('vgl_qm', 'Vergleichsmiete €/m² (Mietspiegel)', '', 'decimal') +
            f('soll', 'Soll-Miete (€/Monat, eigene Angabe)', '', 'decimal') +
            d('soll_ab', 'Erreichbar ab (eigene Angabe)', 'month') +
          '</div><div class="mfh-we-ergebnis" id="mfh-we-soll"></div>') +
        /* v2430 · ZIELBILD — nach Umbau oder Neuvermietung. Massnahmen als
           Chips mit Kosten und Modernisierungspunkten (Anlage 2). */
        blk('ziel', 'Zielbild · nach Umbau <span class="mfh-we-kann">kann, nicht muss</span>',
          '<div id="mfh-we-mass"></div>' +
          '<div class="mfh-we-raster">' +
            f('ziel_qm', 'Zielmiete (€/m²)', 'z. B. 9,20', 'decimal') +
            f('ziel_wann', 'Wann', 'z. B. bei Mieterwechsel') +
          '</div><div class="mfh-we-ergebnis" id="mfh-we-ziel"></div>') +
        blk('ew', 'Ertragswert dieser Wohnung',
          '<div class="mfh-we-schalter" role="group" aria-label="Bewertungsart">'
            + '<button type="button" data-ewart="etw">als Eigentumswohnung</button><button type="button" data-ewart="haus">Anteil am Haus</button></div>'
            + '<div id="mfh-we-ew"></div>') +
        '<h4>Bilder</h4>' +
        '<p class="mfh-we-hint">Höchstens ' + WOHNUNG_FOTOS_MAX + ' Bilder je Wohnung, automatisch verkleinert.</p>' +
        '<div id="mfh-we-bilder" class="mfh-we-bilder"></div>' +
        '<input type="file" id="mfh-we-datei" accept="image/*" multiple style="display:none">' +
        '<button type="button" class="btn btn-outline btn-sm" id="mfh-we-bild-neu">Bilder hinzufügen</button>' +
      '</div>' +
      '<div class="mfh-we-fuss"><button type="button" class="btn" id="mfh-we-ok">Fertig</button></div>' +
    '</div>';
    document.body.appendChild(ov);
    function zu() { if (P) P.massnahmenSpiegeln(e); wSchliessen(); zeichnen(); }
    ov.addEventListener("click", function (ev) { if (ev.target === ov) zu(); });
    el("mfh-we-zu").onclick = zu;
    el("mfh-we-ok").onclick = zu;
    ov.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') zu(); });

    /* ── Rechnungen der Blöcke (nichts davon ist ein Ertragswert) ── */
    var _ewArt = _weg ? 'etw' : 'haus';
    function opts() { return { einheiten: _arbeit, gebaeude: _geb, aufgeteilt: _weg, aufteilungskosten: _auftK, haus_massnahmen: _hausM }; }
    function aktualisieren() {
      var wfl = zahl(e.wfl), ist = e.status === 'leer' ? 0 : zahl(e.ist);
      var u = el('mfh-we-unter');
      if (u) u.textContent = (wfl ? Math.round(wfl) + ' m²' : '') + (zahl(e.zimmer) ? ' · ' + e.zimmer + ' Zimmer' : '') + ' · ' + (e.status === 'leer' ? 'leer' : 'vermietet')
        + (ist && wfl ? ' · Ist ' + (ist / wfl).toFixed(2).replace('.', ',') + ' €/m²' : '');
      if (!P) return;
      var m = P.modell(opts());
      var w = m.wohnungen.filter(function (x) { return x.i === i; })[0];
      var hS = el('mfh-we-soll');
      if (hS) {
        var so = w ? w.soll : null;
        if (!w || e.status === 'leer' || !(ist > 0)) hS.innerHTML = '<p class="mfh-we-hint">Leer stehend oder ohne Ist-Miete: keine Soll-Miete, die Wohnung geht direkt ins Zielbild.</p>';
        else hS.innerHTML = (so && so.miete != null
            ? '<div class="mfh-we-kv"><div><span>Soll-Miete</span><b class="c-soll">' + eur(so.miete) + '/Monat' + (wfl ? ' · ' + (so.miete / wfl).toFixed(2).replace('.', ',') + ' €/m²' : '') + '</b></div>'
              + '<div><span>erreichbar ab</span><b>' + esc(so.ab_text || '—') + '</b></div>'
              + '<div><span>Herkunft</span><b>' + esc(so.herkunft || '') + (so.grenze ? ' · ' + esc(so.grenze) : '') + '</b></div></div>'
              + (so.kapp_angerechnet ? '<p class="mfh-we-hint">Kappungsgrenze auf ' + eur(so.kapp_basis) + '/Monat gerechnet — die Miete vor der letzten Erhöhung; die Erhöhung um ' + eur(so.kapp_angerechnet) + ' liegt in den drei Jahren und ist angerechnet (§ 558 Abs. 3 BGB).</p>' : '')
              + (so.umlage559 ? '<p class="mfh-we-hint">Darin Modernisierungsumlage § 559 BGB: ' + eur(so.umlage559.monat) + '/Monat (8 % von ' + eur(so.umlage559.kosten) + (so.umlage559.gedeckelt ? ', gedeckelt auf ' + so.umlage559.kappe_qm + ' €/m²' : '') + ').</p>' : '')
              + (so.hinweise && so.hinweise.length ? '<p class="mfh-we-hint" style="color:#B8625C">Hinweis: ' + esc(so.hinweise.join(', ')) + '.</p>' : '')
            : '<p class="mfh-we-hint">' + esc((so && so.grund) || 'Keine Soll-Miete.') + ' Eine Vergleichsmiete hier oder die Marktmiete im Tab Miete lässt DealPilot vorrechnen.</p>')
          + '<p class="mfh-we-hint">' + esc(m.kappung.text) + (so && so.ab_herkunft ? ' Termin: ' + esc(so.ab_herkunft) + '.' : '') + '</p>';
      }
      var hZ = el('mfh-we-ziel');
      if (hZ && w) {
        var pkt = w.plus_ziel || 0;
        hZ.innerHTML = '<div class="mfh-we-kv">'
          + '<div><span>Zielmiete</span><b class="c-ziel">' + (w.ziel != null ? eur(w.ziel) + '/Monat' : '—') + '</b></div>'
          + '<div><span>Kosten gesamt</span><b>' + eur(w.kosten) + (w.kosten_haus ? '<small style="display:block;font-weight:400;color:#8A8272">davon Anteil Haus ' + eur(w.kosten_haus) + '</small>' : '') + '</b></div>'
          + '<div><span>Modernisierungspunkte</span><b>' + (pkt ? '+' + pkt : '0') + ' (Anlage 2)</b></div></div>'
          + '<p class="mfh-we-hint">Dach, Fassade, Heizung und Leitungen gehören dem Haus: Maßnahmen dafür trägst du im Schritt Gebäude unter „Maßnahmen am ganzen Haus“ ein — ihr Kostenanteil und ihre Punkte sind hier schon enthalten. Die Zielmiete fließt nicht in die Mietentwicklung — nur in Pilot-Analyse und PDF.</p>';
      }
      ewZeichnen(m);
    }
    function ewZeichnen(m) {
      var h = el('mfh-we-ew'); if (!h || !P) return;
      ov.querySelectorAll('[data-ewart]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-ewart') === _ewArt ? 'true' : 'false');
        if (b.getAttribute('data-ewart') === 'etw') { b.disabled = !_weg; b.title = _weg ? '' : 'Nur mit dem Haken „aufgeteilt“ in Schritt 1'; }
      });
      if (!m.aktiv) { h.innerHTML = '<p class="mfh-we-hint">Erst eine Soll-Miete oder ein Zielbild eintragen — dann rechnet DealPilot den Ertragswert je Stufe.</p>'; return; }
      var r = P.ergebnis(opts()), we = r ? P.wohnungErgebnis(r, m, i) : null;
      var feld = _ewArt === 'etw' ? 'als_etw' : 'anteil_am_haus';
      var werte = we && we[feld] ? we[feld] : null;
      var z = r && r.aufteilung && r.aufteilung.zins && r.aufteilung.zins.bestand;
      /* v2431 · eur(null) ergab hier „0 €" (Math.round(null)) - ein fehlender Wert sah aus wie ein Wert */
      var eurN = function (v) { return v != null && isFinite(v) ? eur(v) : '—'; };
      /* v2431 · ohne Stufe 3 kein Ertragswert: der Hinweis statt der Kacheln */
      if (P.gesperrt && P.gesperrt(r)) {
        h.innerHTML = '<p class="mfh-we-hint"><b>' + esc(P.GESPERRT_KURZ) + '</b> · ' + esc(P.GESPERRT_LANG)
          + ' Stufe 3 wählst du im Tab Objekt.</p>'
          + '<button type="button" class="btn btn-outline btn-sm" id="mfh-we-ew-los">Erneut prüfen</button>';
      } else
      h.innerHTML = (werte
          ? '<div class="mfh-we-ew3"><div><span>Bestand</span><b>' + eurN(werte.bestand) + '</b></div>'
            + '<div><span>Mieterhöhung</span><b class="c-soll">' + eurN(werte.mieterhoehung) + '</b></div>'
            + '<div><span>Zielbild</span><b class="c-ziel">' + eurN(werte.zielbild) + '</b></div></div>'
            + '<p class="mfh-we-hint">' + (_ewArt === 'etw'
                ? 'Zins ' + (z && z.pct != null ? String(z.pct).replace('.', ',') + ' % (Wohnungseigentum, Stufe ' + esc(z.stufe || '?') + (z.ausschuss ? ', ' + esc(String(z.ausschuss).replace(/^Der\s+/, '')) : '') + ')' : '—') + ' · Bodenwertanteil nach ' + esc(we.anteil_herkunft || 'Fläche')
                : 'Anteil am Ertragswert des Hauses nach dem Anteil am Rohertrag')
              + ' · ' + esc(P.KENNZEICHNUNG) + '</p>'
          : '<p class="mfh-we-hint">' + (P.ergebnisVeraltet() ? 'Die Angaben haben sich geändert. ' : '') + 'Der Ertragswert kommt aus demselben Rechenkern wie der Marktbericht Stufe 3 (kein Kontingent).</p>')
        + '<button type="button" class="btn btn-outline btn-sm" id="mfh-we-ew-los">Ertragswerte rechnen</button>';
      el('mfh-we-ew-los').onclick = function () {
        var b = el('mfh-we-ew-los'); b.disabled = true; b.textContent = 'wird gerechnet …';
        P.rechnen(Object.assign(opts(), { erzwingen: true })).then(function (res) {
          if (res && !res.verfuegbar && !res.ertragswert_gesperrt && typeof window.toast === 'function') window.toast('Ertragswert: ' + (res.grund || 'nicht verfügbar'));
          ewZeichnen(P.modell(opts()));
        });
      };
    }
    ov.querySelectorAll('[data-ewart]').forEach(function (b) {
      b.onclick = function () { if (b.disabled) return; _ewArt = b.getAttribute('data-ewart'); ewZeichnen(P.modell(opts())); };
    });
    if (P) P.massnahmenBinden(el('mfh-we-mass'), e.massnahmen, { e: e, geb: _geb, fuerEinheit: true, geaendert: function () { aktualisieren(); } });
    /* Jede Eingabe landet sofort im Einheiten-Objekt - es wird als
       Ganzes gespeichert, also braucht es keine Feldliste. */
    ov.querySelectorAll("[data-wk]").forEach(function (inp) {
      var k = inp.getAttribute("data-wk");
      inp.addEventListener("input", function () { e[k] = inp.value; aktualisieren(); });
      inp.addEventListener("change", function () { e[k] = inp.value; aktualisieren(); });
    });
    /* v2023 - Haken schreiben true/false, nicht .value ("on"). */
    ov.querySelectorAll("[data-wkb]").forEach(function (box) {
      var k = box.getAttribute("data-wkb");
      box.addEventListener("change", function () { e[k] = box.checked; });
    });
    var vArt = ov.querySelector('[data-wk="mv_art"]');
    function erhoehungZeigen() {
      var box = el('mfh-we-erh-box'); if (!box) return;
      var a = vArt ? vArt.value : '';
      box.style.display = (a === 'staffel' || a === 'index') ? '' : 'none';
      var warn = el('mfh-we-index-warn');
      if (warn) warn.style.display = (a === 'index') ? '' : 'none';
    }
    if (vArt) vArt.addEventListener("change", erhoehungZeigen);
    erhoehungZeigen();
    /* v2600 · E3 · Leerstandsblock nur bei Status „leer" */
    var sSt = ov.querySelector('[data-wk="status"]');
    function leerZeigen() { var b = el('mfh-we-leer-box'); if (b) b.style.display = (sSt && sSt.value === 'leer') ? '' : 'none'; }
    if (sSt) sSt.addEventListener('change', leerZeigen);
    leerZeigen();
    var gArt = ov.querySelector('[data-wk="art"]');
    function gewerbeZeigen() { var b = el('mfh-we-gew-box'); if (b) b.style.display = (gArt && gArt.value === 'gewerbe') ? '' : 'none'; }
    if (gArt) gArt.addEventListener("change", gewerbeZeigen);
    gewerbeZeigen();
    /* Vorgaben sichtbar machen: was DealPilot ohne eigene Angabe ansetzt. */
    if (P) {
      var m0 = P.modell(opts());
      var vglIn = ov.querySelector('[data-wk="vgl_qm"]');
      if (vglIn && m0.vgl && m0.vgl.qm) vglIn.placeholder = String(m0.vgl.qm).replace('.', ',') + ' (' + m0.vgl.herkunft + ')';
      if (P.kappungLaden) P.kappungLaden().then(function () { return P.agsHolen ? P.agsHolen() : null; }).then(aktualisieren);
    }
    aktualisieren();
    bilderZeichnen(e);
    el("mfh-we-bild-neu").onclick = function () { el("mfh-we-datei").click(); };
    el("mfh-we-datei").onchange = function (ev) { bilderAufnehmen(e, ev.target.files); };
  }

  function bilderZeichnen(e) {
    var host = el("mfh-we-bilder"); if (!host) return;
    var b = Array.isArray(e.bilder) ? e.bilder : [];
    if (!b.length) { host.innerHTML = '<span class="mfh-we-hint">Noch keine Bilder.</span>'; return; }
    host.innerHTML = b.map(function (src, n) {
      return '<span class="mfh-we-bild"><img src="' + src + '" alt="">'
        + '<button type="button" data-bild-weg="' + n + '" title="Bild entfernen">\u2715</button></span>';
    }).join("");
    host.querySelectorAll("[data-bild-weg]").forEach(function (btn) {
      btn.onclick = function () {
        var n = parseInt(btn.getAttribute("data-bild-weg"), 10);
        e.bilder.splice(n, 1); bilderZeichnen(e);
      };
    });
  }

  /* Verkleinert ueber den VORHANDENEN Verkleinerer (ui.js:505) - keine
     zweite Umrechnung. Gemessen am Bestand traegt ein Objekt bis
     1,8 MB Fotos; je Wohnung unbegrenzt waere bei zwanzig Einheiten
     ein Objekt, das nicht mehr speichert. */
  function bilderAufnehmen(e, dateien) {
    if (!dateien || !dateien.length) return;
    if (!Array.isArray(e.bilder)) e.bilder = [];
    var frei = WOHNUNG_FOTOS_MAX - e.bilder.length;
    if (frei <= 0) { alert("Mehr als " + WOHNUNG_FOTOS_MAX + " Bilder je Wohnung gehen nicht."); return; }
    var liste = Array.prototype.slice.call(dateien, 0, frei);
    var offen = liste.length;
    liste.forEach(function (datei) {
      var r = new FileReader();
      r.onload = function () {
        var roh = r.result;
        function fertig(src) {
          if (src) e.bilder.push(src);
          if (--offen <= 0) bilderZeichnen(e);
        }
        if (typeof window._dpResizeDataUrl === "function") {
          window._dpResizeDataUrl(roh, 1200, 0.78).then(fertig, function () { fertig(roh); });
        } else { fertig(roh); }
      };
      r.onerror = function () { if (--offen <= 0) bilderZeichnen(e); };
      r.readAsDataURL(datei);
    });
  }

  function schritt2() {
    return '<div style="font-size:12.5px;color:#6B6356;margin-bottom:10px">Hier nur das Nötigste. <b>Details</b> öffnet die Wohnung: Mietvertrag, Soll-Miete (Mieter bleibt), Zielbild mit Maßnahmen und den Ertragswert. Ähnliche Wohnungen mit ⧉ duplizieren. Übernommen werden Fläche, Einheitenzahl und Ist-Kaltmiete der vermieteten Einheiten.</div>'
      /* v1628 · KEIN min-width - feste Aufteilung in Prozent. v2430: sieben Spalten. */
      + '<table class="mfh-tab"><colgroup>'
      + ['9%','22%','11%','8%','14%','14%','22%'].map(function (w) {
          return '<col style="width:' + w + '">'; }).join('')
      + '</colgroup><thead><tr style="text-align:left;color:#8A8272">'
      + '<th>Nr.</th><th>Lage</th><th>m²</th><th>Zi.</th><th title="Aktuelle Nettokaltmiete dieser Einheit, in Euro pro Monat">Ist-Miete<br><small style="font-weight:400;text-transform:none;letter-spacing:0;opacity:.7">&euro;/Monat</small></th><th>Status</th><th></th></tr></thead>'
      + '<tbody id="mfh-zeilen">' + _arbeit.map(zeileHtml).join('') + '</tbody></table>'
      + '<div style="margin-top:8px"><button type="button" id="mfh-neu" class="btn btn-outline btn-sm">+ Einheit</button></div>';
  }

  /* Schritt 3 — Zustand je Einheit (Vererbung) */
  function schritt3() {
    if (!_arbeit.length) return '<div class="cf-hint">Erst im Schritt „Einheiten" mindestens eine Wohnung anlegen.</div>';
    var kopf = '<tr style="text-align:left;color:#8A8272"><th style="min-width:140px">Einheit</th>'
      + WE_IDS.map(function (id) { return '<th>' + esc(labelVon(id).replace(/^Modernisierung /, '').replace(/ \(.*/, '').replace(/^Verbesserung /, '')) + '</th>'; }).join('') + '<th style="text-align:right">Punkte</th></tr>';
    var zeilen = _arbeit.map(function (e, i) {
      var opts = [['', 'wie Gebäude']].concat(STUFEN);
      return '<tr><td style="padding:6px 8px 6px 0">' + esc((e.nr ? 'Nr. ' + e.nr : '#' + (i + 1)) + (e.lage ? ' · ' + e.lage : '')) + '</td>'
        + WE_IDS.map(function (id) { return '<td style="padding:4px 6px 4px 0">' + selHtml('data-mi="' + i + '" data-mk="' + id + '"', (e.mod && e.mod[id]) || '', opts) + '</td>'; }).join('')
        + '<td style="padding:4px 0;text-align:right;font-weight:600" data-punkte="' + i + '">—</td></tr>';
    }).join('');
    return '<div style="font-size:12.5px;color:#6B6356;margin-bottom:10px">Vorgabe ist „wie Gebäude" — nur abweichende Wohnungen anfassen. Dach, Außenwand, Leitungen und Heizung kommen immer vom Haus.</div>'
      + '<table class="mfh-tab" style="font-size:12.5px"><thead>' + kopf + '</thead><tbody>' + zeilen + '</tbody></table>';
  }

  /* Schritt 4 — Ergebnis */
  /* v1458 · dieselbe Auswertung fuer das Modal (Arbeitsstand) und fuer den
     Bankbericht (gespeicherter Stand) — eine Rechnung, zwei Aufrufer. */
  function auswerten(list, geb) {
    var s = summe(list), gp = 0;
    GEB_IDS.concat(WE_IDS).forEach(function (id) { gp += punkteVon(id, geb[id] || '0'); });
    /* v2095: die Rangfolge fuer Stichtag/kernsaniert EINMAL holen, nicht
       je Einheit - collectData() liest das ganze Formular. */
    /* ══ v2483 · EINE RESTNUTZUNGSDAUER FUER DAS HAUS ══════════════════
       HIER STAND: je Einheit eine eigene RND (calcAll mit den Punkten der
       Einheit) und als „Gebaeude gesamt" der flaechengewichtete MITTELWERT
       dieser RNDs. Gemessen an Westerfeldstr. 140 (20.10.2026):

         Mieterliste / Konfigurator   35 J.  (7 Punkte aus den Einheiten)
         Wertpotenzial / Ertragswert  32 J.  (6 Punkte aus dem Feld mod_punkte)

       Zwei Punktzahlen fuer dasselbe Gebaeude: der Konfigurator fuehrt
       Fenster „teilweise erneuert" (1 P.), der Reiter Objekt „> 20 Jahre"
       (0 P.) - und die Fenster gehen als Wohnungs-Gewerk NICHT ins Objekt
       zurueck (inObjektZurueck nimmt nur die vier Gebaeude-Gewerke).

       Anlage 2 ImmoWertV bewertet das GEBAEUDE: eine Punktzahl, eine RND.
       Die Punkte des Hauses sind die flaechengewichteten Punkte der
       Einheiten (`hausPunkte`, ganze Punkte wie die Tabelle der Anlage 2);
       dieselbe Zahl geht ins Feld mod_punkte und damit in Marktbericht,
       Ertragswert, Wertpotenzial und Zinssatz-Abfrage. Die RND des Hauses
       kommt aus `hausRnd` - vom Marktbericht-Dienst (GND aus dem Modell des
       Liegenschaftszinssatzes), sonst aus demselben Anlage-2-Kern hier. Eine
       eigene RND je Einheit gibt es nicht mehr. */
    var zeilen = list.map(function (e) {
      var p = punkteEinheit(e, geb), fl = zahl(e.wfl);
      return { e: e, fl: fl, punkte: p.punkte, geerbt: p.geerbt };
    });
    var flSum = zeilen.reduce(function (a, z) { return a + z.fl; }, 0);
    var pGew = flSum > 0 ? zeilen.reduce(function (a, z) { return a + z.punkte * z.fl; }, 0) / flSum
      : (zeilen.length ? zeilen.reduce(function (a, z) { return a + z.punkte; }, 0) / zeilen.length : 0);
    var hp = Math.min(20, Math.round(pGew));
    /* v2540 · Quelle „acht Felder": die Punkte des Feldes mod_punkte (leer = geschaetzt) */
    if (modQuelle() === 'felder') {
      var _mpF = parseInt(el('mod_punkte') && el('mod_punkte').value, 10);
      hp = isFinite(_mpF) ? _mpF : null;
    }
    var hr = zeilen.length ? hausRnd(hp) : null;
    return { s: s, gebPunkte: Math.min(20, gp), zeilen: zeilen, punkteGew: pGew, hausPunkte: hp,
             rndGew: hr && hr.jahre > 0 ? hr.jahre : 0, rndInfo: hr };
  }

  /* v2483 · Die Punkte des Hauses aus dem GESPEICHERTEN Stand der Einheiten.
     null, wenn die Objektart keine Einheiten fuehrt oder keine erfasst sind -
     dann gilt das Feld mod_punkte (Reiter Objekt) wie bisher. */
  /* v2540 · Marcel 20.10.2026 (Rest aus v2483): „konfigurierbar machen". Je Objekt
     waehlbar, woher die Modernisierungspunkte beim MFH kommen: aus den Einheiten
     (Vorgabe, flaechengewichtet) oder aus den acht Feldern im Reiter Objekt.
     Merker: verstecktes Feld mod_quelle ('' = einheiten, 'felder'). */
  function modQuelle() {
    var f = el('mod_quelle');
    return (f && f.value === 'felder') ? 'felder' : 'einheiten';
  }
  function hatEinheiten() {
    var art = (el('objart') && el('objart').value) || '';
    return !!ARTEN_MIT_EINHEITEN[art] && !!((daten().einheiten || []).length);
  }
  function hausPunkte() {
    var art = (el('objart') && el('objart').value) || '';
    if (!ARTEN_MIT_EINHEITEN[art]) return null;
    if (modQuelle() === 'felder') return null;   /* v2540 · dann gilt das Feld mod_punkte */
    var d = daten(), list = d.einheiten || [];
    if (!list.length) return null;
    var geb = d.gebaeude || {}, fl = 0, sp = 0, sn = 0;
    list.forEach(function (e) { var p = punkteEinheit(e, geb).punkte, f = zahl(e.wfl); fl += f; sp += p * f; sn += p; });
    var g = fl > 0 ? sp / fl : sn / list.length;
    return { punkte: Math.min(20, Math.round(g)), gewichtet: Math.round(g * 10) / 10, einheiten: list.length,
             herkunft: 'Einheiten flächengewichtet (MFH-Konfigurator)' };
  }

  /* v2483 · Die RND des Hauses. Erst die Antwort des Marktbericht-Dienstes
     (objekt-reiter.js legt sie als window._dpHausRnd ab - GND aus dem Modell
     des Liegenschaftszinssatzes, derselbe Weg wie der Bericht), wenn sie zu
     DIESEN Punkten und diesem Baujahr gehoert; sonst derselbe Anlage-2-Kern
     im Browser (GND nach Anlage 1, Stichtag heute wie der Bericht). */
  function hausRnd(punkte) {
    var bj = zahl(el('baujahr') && el('baujahr').value);
    var D = window._dpHausRnd;
    if (D && D.rnd != null && Number(D.punkte) === Number(punkte) && Number(D.baujahr) === bj
        && (D.key || null) === ((typeof window._currentObjKey === 'string' && window._currentObjKey) || null)) {
      return { jahre: Number(D.rnd), gnd: D.gnd || null, quelle: 'marktbericht', gnd_quelle: D.gnd_quelle || null,
               stichtag: new Date().toISOString().slice(0, 10), stichtag_herkunft: 'heute (Verkehrswert-Stichtag)' };
    }
    var r = rndFuer(punkte, rndBasis());
    if (r) r.quelle = 'browser';
    return r;
  }
  function ergebnisDaten() { return auswerten(_arbeit, _geb); }
  /* Fuer Bankunterlagen und PDF: aus dem GESPEICHERTEN Stand. */
  function berichtDaten() {
    var d = daten(), list = d.einheiten || [];
    if (!list.length) return null;
    var r = auswerten(list, d.gebaeude || {});
    r.sollAbJahr = d.sollAbJahr || null;
    r.aufgeteilt = !!d.aufgeteilt;
    r.geerbteGewerke = GEB_IDS.concat(WE_IDS).map(function (id) { return { id: id, label: labelVon(id), stufe: (d.gebaeude || {})[id] || '0', punkte: punkteVon(id, (d.gebaeude || {})[id] || '0') }; });
    return r;
  }
    function schritt4() {
    if (!_arbeit.length) return '<div class="cf-hint">Noch keine Einheit erfasst.</div>';
    var d = ergebnisDaten();
    var rows = d.zeilen.map(function (z) {
      return '<tr><td style="padding:5px 8px 5px 0">' + esc((z.e.nr ? 'Nr. ' + z.e.nr : '') + (z.e.lage ? ' · ' + z.e.lage : '')) + '</td>'
        + '<td style="text-align:right;padding:5px 8px">' + (z.fl ? Math.round(z.fl) + ' m²' : '—') + '</td>'
        + '<td style="text-align:right;padding:5px 0 5px 8px">' + z.punkte + ' P.<span style="color:#8A8272;font-size:11px">' + (z.geerbt === WE_IDS.length ? ' · ganz geerbt' : (z.geerbt ? ' · ' + z.geerbt + ' geerbt' : ' · eigen')) + '</span></td>'
        + '</tr>';
    }).join('');
    /* v2483 · eine RND fuer das Haus (siehe auswerten) - die Spalte je Einheit ist weg */
    var opt = d.hausPunkte, r = Math.round(d.rndGew);
    return '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#8A8272;font-size:11px"><th>Einheit</th><th style="text-align:right">Fläche</th><th style="text-align:right">Anlage 2</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div style="margin-top:12px;padding:10px 12px;border:1px solid #E6E0D3;border-radius:8px;background:#FBFAF7;font-size:13px">'
      + '<b>Gebäude gesamt:</b> ' + d.punkteGew.toFixed(1).replace('.', ',') + ' Punkte flächengewichtet, angesetzt <b>' + opt + ' Punkte</b>'
      + (r > 0 ? ' · Restnutzungsdauer des Gebäudes <b>' + r + ' Jahre</b>' : '')
      + (d.s.hatSoll ? '<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">Soll-Miete wirkt ab Jahr '
        + '<input class="mfh-in mfh-sm" id="mfh-soll-jahr" type="text" inputmode="numeric" value="' + esc(String(daten().sollAbJahr || '')) + '" placeholder="z. B. 2028">'
        /* v2410 - Kalenderjahr ODER Jahr der Mietentwicklung; ab 1900 gilt
           der Wert als Kalenderjahr (mietentwicklung.js, sollJahr()). Beide
           Bielefelder MFH trugen 2027/2028 - als Index gelesen griff die
           Soll-Miete nie. */
        + '<span style="font-size:12px;color:#6B6356">(Kalenderjahr wie 2028 oder Jahr der Mietentwicklung wie 3; leer = kein Sprung)</span></div>' : '')
      + '<div style="margin-top:8px;display:grid;gap:6px">'
      + '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mfh-uep" checked> Modernisierungsgrad ins Objekt übernehmen (<b>' + opt + ' Punkte</b> — gilt dann für Marktbericht, Ertragswert und Wertpotenzial)</label>'
      + (r > 0 ? '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mfh-uer"> Restnutzungsdauer <b>' + r + ' Jahre</b> in die AfA übernehmen (eigener Satz ' + (100 / r).toFixed(2).replace('.', ',') + ' %)</label>' : '')
      + '</div></div>'
      /* ── v2095a · DIE ZAHL TRÄGT IHREN STICHTAG ──────────────────────
       * Die Restnutzungsdauer hängt am Stichtag: sieben Jahre Unterschied
       * ergeben rund 1,7 Jahre RND (am echten Kern gemessen). Bis v2095
       * war der Stichtag auf HEUTE festgenagelt und stand nirgends — die
       * Zahl sah damit aus, als gelte sie zeitlos.
       *
       * `rndInfo` reist seit v2095 an jeder Zeile mit. Hier wird sie
       * gezeigt, weil jede Zahl ihre Herkunft trägt. Alle Zeilen haben
       * denselben Stichtag (eine Basis je Auswertung), also steht er
       * einmal unter der Tabelle statt elfmal darin. */
      + (function () {
          var i = d.rndInfo;   /* v2483 · die RND des Hauses */
          if (!i || !i.stichtag) return '';
          return '<div class="cf-hint" style="margin-top:6px">Stichtag <b>'
            + esc(i.stichtag.split('-').reverse().join('.')) + '</b>'
            + (i.stichtag_herkunft ? ' — ' + esc(i.stichtag_herkunft) : '')
            + ' · GND ' + esc(String(i.gnd)) + ' Jahre'
            + (i.quelle === 'marktbericht' ? (i.gnd_quelle === 'register' ? ' aus dem Modell des Liegenschaftszinssatzes' : ' nach Anlage 1 ImmoWertV') + ' · gerechnet vom Marktbericht-Dienst wie Bericht und Wertpotenzial' : '')
            + (i.kernsaniert ? ' · Kernsanierung angesetzt' : '')
            + '</div>';
        })()
      + '<div class="cf-hint" style="margin-top:6px">Gerechnet mit dem Punktraster der Anlage 2 aus dem RND-Kern (DealPilotRND ' + ((window.DealPilotRND && window.DealPilotRND.VERSION) || '') + '). Die Zahl ist indikativ — den Nachweis fürs Finanzamt liefert ein Gutachten.</div>';
  }

  function koerper() { return [schritt1, schritt2, schritt3, schritt4][_schritt](); }
  function zeichnen() {
    var b = el('mfh-body'); if (!b) return;
    b.innerHTML = koerper();
    el('mfh-schritte').innerHTML = SCHRITTE.map(function (t, i) {
      return '<button type="button" data-s="' + i + '" style="border:none;background:none;cursor:pointer;font:' + (i === _schritt ? '600' : '400') + ' 12.5px Inter,sans-serif;color:' + (i === _schritt ? '#1A1714' : '#8A8272') + ';padding:6px 2px;border-bottom:2px solid ' + (i === _schritt ? 'var(--wl-c9a84c, #C9A84C)' : 'transparent') + '">' + (i + 1) + '. ' + t + '</button>';
    }).join('<span style="color:#D8D2C6">›</span>');
    el('mfh-zurueck').style.visibility = _schritt === 0 ? 'hidden' : 'visible';
    el('mfh-weiter').textContent = _schritt === SCHRITTE.length - 1 ? 'Übernehmen' : 'Weiter ›';
    zeichnenSumme(); punkteZeigen(); hausBinden();
    var neu = el('mfh-neu'); if (neu) neu.onclick = function () { _arbeit.push({ nr: String(_arbeit.length + 1), art: standardArt(), status: 'vermietet' }); zeichnen(); };
  }
  /* v2966 · N80 · Chips und Kosten der Hausmassnahmen (dieselbe Bedienung wie je Wohnung) */
  function hausSumme() {
    var h = el('mfh-haus-sum'); if (!h) return;
    var k = _hausM.reduce(function (a, m) { return a + zahl(m.k); }, 0);
    h.textContent = _hausM.length ? 'Am Haus: ' + _hausM.length + ' Maßnahme' + (_hausM.length === 1 ? '' : 'n') + ' · ' + Math.round(k).toLocaleString('de-DE') + ' € — in den Kosten der Wohnungen nach Fläche enthalten.' : 'Keine Maßnahme am ganzen Haus.';
  }
  function hausBinden() {
    var host = el('mfh-haus-mass'), P = window.DpPotenzial;
    if (!host || !P || typeof P.massnahmenBinden !== 'function') return;
    P.massnahmenBinden(host, _hausM, { geb: _geb, fuerHaus: true, geaendert: function () { hausSumme(); zeichnenSumme(); } });
    hausSumme();
  }
  function punkteZeigen() {
    var g = el('mfh-geb-p');
    if (g) { var p = 0; GEB_IDS.concat(WE_IDS).forEach(function (id) { p += punkteVon(id, _geb[id] || '0'); }); g.textContent = Math.min(20, p); }
    _arbeit.forEach(function (e, i) { var t = document.querySelector('[data-punkte="' + i + '"]'); if (t) t.textContent = punkteEinheit(e, _geb).punkte + ' P.'; });
  }


  /* ═══ v1621 · DIE MARKE, EINMAL RICHTIG ══════════════════════════════
     Der Konfigurator trug 56 Inline-Stile und keine Klasse. Jetzt
     dieselbe Huelle wie das Einstellungs-Modal: Obsidian-Brandbar oben,
     goldener Rahmen, weisse Flaeche. Die Werte kommen aus den
     Whitelabel-Tokens, nicht aus festem Gold - ein Mandant faerbt das
     Modal damit mit um. */
  function stilEinhaengen() {
    if (document.getElementById('mfh-stil-v2')) return;
    var s = document.createElement('style');
    s.id = 'mfh-stil-v2';
    s.textContent = [
      /* ══ v2021b · DAS WOHNUNGSFENSTER ══════════════════════════
         Im selben Stilblock wie der Konfigurator - ein Fenster in
         einem zweiten Blatt faellt beim naechsten Umbau als erstes
         auseinander. Das Raster ohne feste Spaltenzahl: dieselbe
         Lehre wie v2005/v2006, ein 1fr mit fester Zahl waechst aus
         dem Fenster heraus statt umzubrechen. */
      '#mfh-we-ov .mfh-we-karte{background:#fff;border-radius:14px;max-width:860px;width:100%;',
      '  max-height:92vh;display:flex;flex-direction:column;overflow:hidden;color:#2A2727;',
      '  font-family:Inter,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.34);',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 34%, transparent)}',
      '#mfh-we-ov .mfh-we-kopf{display:flex;align-items:center;justify-content:space-between;',
      '  padding:14px 18px;border-bottom:1px solid rgba(42,39,39,.10);font-size:15px}',
      '#mfh-we-ov .mfh-we-kopf button{border:0;background:transparent;font-size:18px;cursor:pointer;color:#8A8272}',
      '#mfh-we-ov .mfh-we-leib{padding:16px 18px;overflow:auto}',
      '#mfh-we-ov h4{font:600 12px/1.2 "Space Grotesk",sans-serif;letter-spacing:.09em;',
      '  text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin:20px 0 8px}',
      '#mfh-we-ov h4:first-child{margin-top:0}',
      '#mfh-we-ov .mfh-we-raster{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 14px}',
      '#mfh-we-ov .mfh-we-f{display:flex;flex-direction:column;gap:4px;font-size:12.5px;min-width:0}',
      '#mfh-we-ov .mfh-we-f.mfh-we-breit{grid-column:1/-1}',
      '#mfh-we-ov .mfh-we-f span{color:#6B6356;font-size:11.5px}',
      '#mfh-we-ov .mfh-we-f input,#mfh-we-ov .mfh-we-f select{width:100%;box-sizing:border-box;',
      '  border:1px solid #E6E0D3;border-radius:8px;padding:7px 9px;font-size:13px;background:#fff;color:#2A2727}',
      '#mfh-we-ov .mfh-we-f input:focus,#mfh-we-ov .mfh-we-f select:focus{outline:0;',
      '  border-color:var(--wl-c9a84c, #C9A84C)}',
      '#mfh-we-ov .mfh-we-hint{font-size:11.5px;color:#8A8272;margin:0 0 8px;line-height:1.5}',
      /* v2025 - die Annahme-Warnung bei Indexmiete. Gold, nicht rot:
         es ist kein Fehler, nur eine Zahl mit anderer Herkunft. */
      '#mfh-we-ov .mfh-we-warn{font-size:12px;line-height:1.55;margin:0 0 10px;padding:9px 12px;',
      /* v2029 - war `rgba(201,168,76,.12)`. Der Gold-Audit zaehlt das
         zu Recht als hartes Gold: beim Mandanten bliebe dieses Feld
         DealPilot-golden, waehrend alles andere umfaerbt. */
      '  border-radius:9px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent);color:#8a6d1f;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent)}',
      '#mfh-we-ov .mfh-we-haken{display:flex;align-items:center;gap:8px;font-size:12.5px;margin:0 0 10px;cursor:pointer}',
      '#mfh-we-ov .mfh-we-bilder{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}',
      '#mfh-we-ov .mfh-we-bild{position:relative;display:inline-block}',
      '#mfh-we-ov .mfh-we-bild img{width:96px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #E6E0D3;display:block}',
      '#mfh-we-ov .mfh-we-bild button{position:absolute;top:-6px;right:-6px;width:20px;height:20px;',
      '  border-radius:50%;border:1px solid #E6E0D3;background:#fff;color:#B8625C;cursor:pointer;',
      '  font-size:11px;line-height:1;padding:0}',
      '#mfh-we-ov .mfh-we-fuss{padding:12px 18px;border-top:1px solid rgba(42,39,39,.10);text-align:right}',
      /* v2430 · Bloecke wie in der freigegebenen Vorlage: Mietvertrag, Soll (blau), Zielbild (gruen), Ertragswert (Gold) */
      '#mfh-we-ov .mfh-we-kopf .mfh-we-unter{display:block;font-size:12px;color:#8A8272;font-weight:400;margin-top:2px}',
      '#mfh-we-ov .mfh-we-blk{border:1px solid #EFE7D6;border-radius:12px;padding:12px 14px;margin:0 0 12px;display:grid;gap:10px}',
      '#mfh-we-ov .mfh-we-blk-t{display:flex;align-items:center;gap:8px;font:600 11.5px/1.2 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#6B6356}',
      '#mfh-we-ov .mfh-we-blk-t::before{content:"";width:8px;height:8px;border-radius:2px;background:#8A8272;flex:0 0 auto}',
      '#mfh-we-ov .mfh-we-blk.soll .mfh-we-blk-t{color:#3d6fa8}#mfh-we-ov .mfh-we-blk.soll .mfh-we-blk-t::before{background:#3d6fa8}',
      '#mfh-we-ov .mfh-we-blk.ziel .mfh-we-blk-t{color:#2f7d55}#mfh-we-ov .mfh-we-blk.ziel .mfh-we-blk-t::before{background:#2f7d55}',
      '#mfh-we-ov .mfh-we-blk.ew .mfh-we-blk-t{color:var(--wl-9a7f33, #9a7f33)}#mfh-we-ov .mfh-we-blk.ew .mfh-we-blk-t::before{background:var(--wl-c9a84c, #C9A84C)}',
      '#mfh-we-ov .mfh-we-blk.soll{border-color:color-mix(in srgb,#3d6fa8 22%,#EFE7D6)}#mfh-we-ov .mfh-we-blk.ziel{border-color:color-mix(in srgb,#2f7d55 22%,#EFE7D6)}',
      '#mfh-we-ov .mfh-we-kann{font:500 10.5px "JetBrains Mono",monospace;letter-spacing:0;text-transform:none;color:#2f7d55;border:1px solid #2f7d55;border-radius:999px;padding:1px 7px}',
      '#mfh-we-ov .mfh-we-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 14px}',
      '#mfh-we-ov .mfh-we-kv div{display:grid;gap:1px}#mfh-we-ov .mfh-we-kv span,#mfh-we-ov .mfh-we-ew3 span{font-size:11.5px;color:#8A8272}',
      '#mfh-we-ov .mfh-we-kv b{font:500 14px Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '#mfh-we-ov .c-soll{color:#3d6fa8}#mfh-we-ov .c-ziel{color:#2f7d55}',
      '#mfh-we-ov .mfh-we-ew3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 8px}',
      '#mfh-we-ov .mfh-we-ew3 div{border:1px solid #EFE7D6;border-radius:8px;padding:8px 10px;display:grid;gap:1px}',
      '#mfh-we-ov .mfh-we-ew3 b{font:600 15px "Space Grotesk",sans-serif;font-variant-numeric:tabular-nums}',
      '@media(max-width:480px){#mfh-we-ov .mfh-we-ew3{grid-template-columns:minmax(0,1fr)}}',
      '#mfh-we-ov .mfh-we-schalter{display:inline-flex;border:1px solid #E6E0D3;border-radius:999px;overflow:hidden;width:fit-content}',
      '#mfh-we-ov .mfh-we-schalter button{font:500 12px "JetBrains Mono",monospace;background:#fff;color:#6B6356;border:0;padding:6px 12px;cursor:pointer}',
      '#mfh-we-ov .mfh-we-schalter button[aria-pressed="true"]{background:var(--wl-c9a84c, #C9A84C);color:#050505}',
      '#mfh-we-ov .mfh-we-schalter button:disabled{opacity:.45;cursor:not-allowed}',
      '#mfh-we-ov .mfh-we-ergebnis .mfh-we-hint:last-child{margin-bottom:0}',
      '#mfh-modal .mfh-det{border:1px solid var(--wl-c9a84c, #C9A84C);background:#fff;border-radius:6px;padding:5px 8px;cursor:pointer;color:var(--wl-9a7f33, #9a7f33);font:500 12px Inter,sans-serif}',
      '#mfh-modal .mfh-det.mit-plan{background:color-mix(in srgb,#2f7d55 8%,#fff);border-color:#2f7d55;color:#2f7d55}',
      '#mfh-modal .mfh-tag{font:500 10px "JetBrains Mono",monospace;color:#8A8272;margin-top:2px}',
      '@media(max-width:560px){#mfh-we-ov .mfh-we-raster{grid-template-columns:minmax(0,1fr)}}',
      '#mfh-modal .mfh-karte{background:#fff;border-radius:14px;max-width:1180px;width:100%;',
      '  max-height:92vh;display:flex;flex-direction:column;position:relative;',
      '  overflow:hidden;color:#2A2727;font-family:Inter,sans-serif;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 34%, transparent);',
      '  box-shadow:0 24px 60px rgba(7,7,7,.32)}',
      /* v1628 · Die selbstgebaute Brandbar (::before/::after) ist raus -
         der echte .dp-modal-topband steht jetzt im Markup. */
      '#mfh-modal .mfh-kopf{padding:10px 24px 4px}',
      '#mfh-modal .mfh-kopf h3{margin:2px 0 10px;font:600 20px/1.3 "Space Grotesk",sans-serif;color:#070707}',
      '#mfh-modal .mfh-body{overflow:auto;padding:12px 24px;flex:1 1 auto}',
      '#mfh-modal .mfh-fuss{padding:10px 24px;border-top:1px solid #EFEBE3;font-size:13px}',
      '#mfh-modal .mfh-knoepfe{padding:12px 24px 18px;display:flex;gap:8px;flex-wrap:wrap;',
      '  border-top:1px solid #EFEBE3;background:#FDFCFA}',
      /* Der Hauptknopf traegt Obsidian, die Nebenknoepfe den goldenen
         Rahmen - dieselbe Ordnung wie ueberall sonst. */
      '#mfh-modal .mfh-haupt{background:#070707;color:#fff;border:1px solid #070707}',
      '#mfh-modal .mfh-haupt:hover{background:#2A2727}',
      '#mfh-modal table th{font:600 11px/1.4 "JetBrains Mono",monospace;letter-spacing:.04em;',
      '  text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33)}',
      /* ── Felder: dieselbe Handschrift wie .set-modal-v2 ────────────
         Rahmen, Radius, Fokus und der goldene Pfeil des BMF-Rechners.
         Nur das Polster ist kleiner (5/8 statt 9/12): diese Felder
         stehen in einer Tabellenzeile, nicht in einem Formular. */
      '#mfh-modal .mfh-in{background:#fff;color:var(--ch, #2A2727);',
      '  border:1px solid var(--border, #E6E0D3);border-radius:8px;',
      '  padding:5px 8px;font:13px/1.35 Inter,sans-serif;box-sizing:border-box;',
      '  transition:border-color .15s ease, box-shadow .15s ease}',
      '#mfh-modal .mfh-in:focus{outline:none;',
      '  border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 60%, transparent);',
      '  box-shadow:0 0 0 3px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent)}',
      '#mfh-modal .mfh-in::placeholder{color:rgba(42,39,39,.38)}',
      /* Vier Stufen statt acht Einzelbreiten - erst dadurch stehen die
         Spalten untereinander. */
      /* v1628 · Keine festen Breiten mehr. Das Feld fuellt SEINE ZELLE,
         und die Zelle bekommt ihren Anteil aus dem colgroup. So passt
         sich alles der Modalbreite an - vorher gab die Summe der
         Feldbreiten die Tabellenbreite vor, und die war groesser als
         das Modal. */
      '#mfh-modal .mfh-in{width:100%;min-width:0}',
      '#mfh-modal .mfh-xs,#mfh-modal .mfh-sm{text-align:right}',
      '#mfh-modal .mfh-tab{width:100%;table-layout:fixed;border-collapse:separate;',
      '  border-spacing:0;font-size:12px}',
      '#mfh-modal .mfh-tab th{line-height:1.25;vertical-align:bottom;padding-bottom:4px;',
      '  overflow:hidden}',
      '#mfh-modal .mfh-tab th small{display:block;font-weight:400;text-transform:none;',
      '  letter-spacing:0;opacity:.7}',
      /* Der goldene Pfeil des BMF-Rechners, statt des Systemdreiecks. */
      '#mfh-modal .mfh-sel{appearance:none;-webkit-appearance:none;-moz-appearance:none;',
      '  padding-right:26px;max-width:100%;',
      '  background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23C9A84C\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>");',
      '  background-repeat:no-repeat;background-position:right 8px center}',
      '#mfh-modal td{padding:4px 6px 4px 0;vertical-align:middle}',
      '#mfh-modal table{border-collapse:separate;border-spacing:0}',
      /* Marcel am 26.09.2026: "auch die Checkboxen sind noch gross."
         15 px waren der App-Durchschnitt - in einer Tabellenzeile mit
         13-px-Schrift sind sie trotzdem der groesste Klotz. Hier 13. */
      '#mfh-modal input[type="checkbox"]{width:13px;height:13px;margin:0;',
      '  accent-color:var(--wl-c9a84c, #C9A84C)}',
      '@media(max-width:700px){#mfh-modal .mfh-kopf,#mfh-modal .mfh-body,',
      '  #mfh-modal .mfh-fuss,#mfh-modal .mfh-knoepfe{padding-left:14px;padding-right:14px}}',
    ].join('');
    document.head.appendChild(s);
  }

  function oeffnen(schritt) {
    stilEinhaengen();
    ausObjektVorbelegen();
    schliessen();
    var d = daten();
    _arbeit = JSON.parse(JSON.stringify(d.einheiten || []));
    _geb = JSON.parse(JSON.stringify(d.gebaeude || {}));
    _weg = !!d.aufgeteilt;
    _auftK = (d.aufteilungskosten != null && String(d.aufteilungskosten).trim() !== '') ? d.aufteilungskosten : null;   /* v2430 */
    _hausM = JSON.parse(JSON.stringify(Array.isArray(d.haus_massnahmen) ? d.haus_massnahmen : []));   /* v2966 */
    _schritt = schritt || 0;
    if (!_arbeit.length) _arbeit.push({ nr: '1', art: standardArt(), status: 'vermietet' });
    var m = document.createElement('div'); m.id = 'mfh-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(42,39,39,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:12px';
    m.innerHTML = '<div class="mfh-karte">' +
      /* v1628 · DER TOPBAND DES EINSTELLUNGS-MODALS, nicht ein
         nachgebauter. Am laufenden Modal ausgelesen: .dp-modal-topband
         mit .dp-mtb-brand und .dp-mtb-hero. Wer die Marke nachbaut,
         trifft sie nie ganz - und beim naechsten Umbau gar nicht mehr. */
      '<div class="dp-modal-topband">' +
        '<div class="dp-mtb-brand">' +
          '<span class="dp-mtb-logo">DealPilot</span>' +
          '<span class="dp-mtb-tag">MEHRFAMILIENHAUS</span>' +
          '<button type="button" class="dp-band-close" id="mfh-band-zu" aria-label="Schließen">✕</button>' +
        '</div>' +
        '<div class="dp-mtb-hero dp-mtb-hero-titled">' +
          '<div class="dp-mtb-h-title">Einheiten und Zustand erfassen</div>' +
          '<div class="dp-mtb-h-sub">Fläche, Miete und Zustand je Einheit — daraus Restnutzungsdauer und Soll-Miete.</div>' +
        '</div>' +
      '</div>' +
      '<div class="mfh-kopf">' +
      '<div id="mfh-schritte" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"></div></div>' +
      '<div class="mfh-body" id="mfh-body"></div>' +
      '<div class="mfh-fuss" id="mfh-summe"></div>' +
      '<label id="mfh-san-zeile" style="display:none;gap:8px;align-items:center;padding:0 24px 10px;font-size:13px"><input type="checkbox" id="mfh-san"> <span id="mfh-san-text"></span></label>' +
      '<div class="mfh-knoepfe">' +
      '<button type="button" id="mfh-zurueck" class="btn btn-outline btn-sm">‹ Zurück</button>' +
      '<button type="button" id="mfh-zu" class="btn btn-outline btn-sm" style="margin-left:auto">Abbrechen</button>' +
      '<button type="button" id="mfh-ok" class="btn btn-outline btn-sm">Speichern</button>' +
      '<button type="button" id="mfh-weiter" class="btn btn-sm mfh-haupt">Weiter ›</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('input', function (ev) { var t = ev.target; if (t.id === 'mfh-auftk') { _auftK = String(t.value || '').trim() === '' ? null : t.value; return; }
      /* v2541 · Spiegel auf das Feld im Reiter Objekt (gespeichert ueber storage.js) */
      if (t.id === 'mfh-zbjahr') { var _zj = el('zb_fertig_jahr'); if (_zj) { _zj.value = String(t.value || '').replace(/[^0-9]/g, '').slice(0, 4); try { _zj.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {} } return; } if (t.dataset && t.dataset.k) { _arbeit[+t.dataset.i][t.dataset.k] = t.value; zeichnenSumme(); punkteZeigen(); } });
    m.addEventListener('change', function (ev) {
      var t = ev.target; if (t.tagName !== 'SELECT') return;
      if (t.dataset.k) { _arbeit[+t.dataset.i][t.dataset.k] = t.value; zeichnenSumme();
        if (t.dataset.k === 'art') { zeichnen(); return; } }   /* v2210: Nutzungsart erscheint/verschwindet */
      if (t.dataset.geb) { _geb[t.dataset.geb] = t.value; }
      if (t.dataset.mk) { var e = _arbeit[+t.dataset.mi]; e.mod = e.mod || {}; e.mod[t.dataset.mk] = t.value; }
      punkteZeigen();
    });
    m.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === m) schliessen();
      if (t.id === 'mfh-weg') { _weg = t.checked; }
      if (t.dataset && t.dataset.s != null) { _schritt = +t.dataset.s; zeichnen(); }
      if (t.dataset && t.dataset.dup != null) { var i = +t.dataset.dup, c = JSON.parse(JSON.stringify(_arbeit[i])); c.nr = String(_arbeit.length + 1); c.lage = ''; c.bilder = null; c.mv_mieter = ''; /* v2021 */ _arbeit.splice(i + 1, 0, c); zeichnen(); }
      /* v2021 - der Weg ins Wohnungsfenster, im selben delegierten
         Behandler wie dup und del. */
      if (t.dataset && t.dataset.det != null) { wohnungOeffnen(+t.dataset.det); }
      if (t.dataset && t.dataset.del != null) { _arbeit.splice(+t.dataset.del, 1); zeichnen(); }
    });
    el('mfh-zu').onclick = schliessen;
    if (el('mfh-band-zu')) el('mfh-band-zu').onclick = schliessen;
    el('mfh-ok').onclick = uebernehmen;
    el('mfh-zurueck').onclick = function () { if (_schritt > 0) { _schritt--; zeichnen(); } };
    el('mfh-weiter').onclick = function () { if (_schritt < SCHRITTE.length - 1) { _schritt++; zeichnen(); } else uebernehmen(); };
    zeichnen();
  }
  /* Beim Tippen nur die Summenzeile neu — die Tabelle bleibt stehen, damit
     der Cursor im Feld bleibt. */
  function zeichnenSumme() {
    var host = el('mfh-summe'); if (!host) return;
    var s = summe(_arbeit);
    host.innerHTML = s.anzahl
      ? '<b>' + s.anzahl + ' Einheiten</b> (' + s.wohnen + ' Wohnen' + (s.anzahl - s.wohnen ? ', ' + (s.anzahl - s.wohnen) + ' Gewerbe' : '') + ') · '
        + Math.round(s.flaeche).toLocaleString('de-DE') + ' m²' + (s.flaecheGew ? ' (davon Gewerbe ' + Math.round(s.flaecheGew) + ' m²)' : '') + ' · '
        + 'Ist ' + eur(s.ist) + '/Monat · Soll ' + eur(s.soll) + '/Monat'
        + (s.leer ? ' · <span style="color:#B8625C">Leerstand ' + s.leer + ' WE / ' + Math.round(s.leerFl) + ' m²</span>' : '')
        + (s.kosten ? ' · Maßnahmen ' + eur(s.kosten) : '')
      : 'Noch keine Einheit — „+ Einheit" legt die erste an.';
    sanZeile();
  }
  /* Massnahmenkosten -> Sanierung nur auf ausdruecklichen Haken.
     Ein vorhandener Sanierungsbetrag wird nie still ueberschrieben. */
  function sanZeile() {
    var z = el('mfh-san-zeile'); if (!z) return;
    var k = summe(_arbeit).kosten, alt = zahl(el('san') && el('san').value);
    z.style.display = k > 0 ? 'flex' : 'none';
    el('mfh-san-text').textContent = 'Maßnahmenkosten ' + eur(k) + ' als Sanierung übernehmen' + (alt > 0 && Math.round(alt) !== Math.round(k) ? ' (ersetzt ' + eur(alt) + ')' : '');
    if (!z._init) { z._init = true; el('mfh-san').checked = !(alt > 0) || Math.round(alt) === Math.round(k); }
  }
  function schliessen() { var m = el('mfh-modal'); if (m) m.remove(); }
  function setzen(id, wert) { var e = el(id); if (!e) return; e.value = String(Math.round(wert * 100) / 100).replace('.', ','); try { e.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {} }

  function uebernehmen() {
    if (window.DpPotenzial) _arbeit.forEach(function (e) { if (Array.isArray(e.massnahmen) || e.massnahme || e.kosten) window.DpPotenzial.massnahmenSpiegeln(e); });   /* v2430 */
    var list = _arbeit.filter(function (e) { return zahl(e.wfl) > 0 || zahl(e.ist) > 0 || String(e.lage || '').trim(); });
    var d = ergebnisDaten();
    var jahrFeld = el('mfh-soll-jahr');
    var sollAb = jahrFeld ? Math.round(zahl(jahrFeld.value)) : Math.round(zahl(daten().sollAbJahr));
    var wegFeld = el('mfh-weg');
    window._dpMfh = { einheiten: list, gebaeude: _geb, gnd: gnd(), aufgeteilt: wegFeld ? wegFeld.checked : _weg, sollAbJahr: sollAb > 0 ? sollAb : null, aufteilungskosten: _auftK, haus_massnahmen: _hausM.filter(function (m) { return m && m.id; }), stand: new Date().toISOString().slice(0, 10) };   /* v2430: aufteilungskosten · v2966: haus_massnahmen */
    var s = summe(list), meldung = list.length + ' Einheiten übernommen';
    if (list.length) {
      if (s.flaeche > 0) setzen('wfl', s.flaeche);
      setzen('einheiten', s.wohnen);
      if (s.ist > 0) setzen('nkm', s.ist);
      /* v3001b · Marcel 27.10.2026: „wenn man Einheiten anlegt, muss sich der Vermietungsstand
         automatisch anpassen“. Abgeleitet aus dem Status der Einheiten, nie geraten. */
      var vs = vermstandAus(s);
      var vsel = el('vermstand');
      if (vs && vsel && vsel.value !== vs) { vsel.value = vs; try { vsel.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {} meldung += ' · Vermietungsstand: ' + vs; }
      /* v1738 · die Zimmer wandern mit — bisher standen sie in jeder
         Einheitenzeile und mussten in den Objektdetails NOCH EINMAL von
         Hand gepflegt werden. Zwei Orte für dieselbe Zahl heisst: einer
         ist irgendwann falsch. Gezaehlt wird ueber alle Zeilen, auch
         Gewerbe — das Feld fragt nach dem Objekt, nicht nach den
         Wohnungen. */
      var zi = list.reduce(function (a, e) { return a + zahl(e.zimmer); }, 0);
      if (zi > 0) { setzen('zimmer', zi); meldung += ' · ' + zi + ' Zimmer'; }
      /* ═══ v1622 · DIE SOLL-MIETE GEHT IN DIE MIETENTWICKLUNG ═════════
         Marcels Vorgabe vom 26.09.2026: "bitte auch bei dem MFH-
         Konfigurator die Soll-Miete im Tab Miete unter Mietentwicklung
         eintragen."

         Sie wurde bisher BERECHNET (`s.soll`) und dann fallengelassen —
         der Konfigurator hat sie erhoben, gezeigt und niemandem
         weitergereicht. Wer sie nutzen wollte, musste sie abschreiben.

         EINHEITENWECHSEL, und genau daran waere es sonst gescheitert:
         der Konfigurator fuehrt die Soll-Miete je Einheit in EURO PRO
         MONAT, das Feld `me_soll` ("Soll-Mietspiegel") in EURO PRO
         QUADRATMETER. Uebertragen wird deshalb die Summe geteilt durch
         die Gesamtflaeche — nicht die Summe selbst. Eine Monatsmiete in
         ein Quadratmeterfeld zu schreiben waere ein Faktor in der
         Groessenordnung der Wohnflaeche.

         `s.soll` faellt je Einheit auf die Ist-Miete zurueck, wo keine
         Soll-Miete steht — die Summe ist also der erzielbare Gesamt-
         ertrag, nicht nur der veraenderte Teil. Leerstehende Einheiten
         zaehlen dort mit, bei `s.ist` nicht; genau das ist das
         Aufholpotenzial. */
      if (s.hatSollEigen && s.flaeche > 0 && s.sollEigen > 0) {   /* v2486: nur die eigene Angabe, wie bisher */
        setzen('me_soll', s.sollEigen / s.flaeche);
        meldung += ' · Soll-Mietspiegel ' +
          (Math.round(s.sollEigen / s.flaeche * 100) / 100).toFixed(2).replace('.', ',') + ' €/m²';
        /* Die angestrebte Entwicklung ergibt sich aus denselben zwei
           Zahlen. Sie NICHT mitzusetzen hiesse, den Nutzer dieselbe
           Rechnung von Hand machen zu lassen. */
        /* v2410 - NICHT, wenn ein Soll-Jahr steht: dann bringt der Sprung
           (mietentwicklung.js, sollSprung) dieselben Prozent schon einmal
           ein, und Detail rechnete Soll / Ist doppelt. */
        if (s.ist > 0 && s.sollEigen > s.ist && !(sollAb > 0)) {
          setzen('me_pct', (s.sollEigen - s.ist) / s.ist * 100);
          meldung += ' · Entwicklung ' +
            (Math.round((s.sollEigen - s.ist) / s.ist * 1000) / 10).toFixed(1).replace('.', ',') + ' %';
        }
      }
      if (s.kosten > 0 && el('mfh-san') && el('mfh-san').checked) { setzen('san', s.kosten); if (typeof window.syncSanTaxOnSanInput === 'function') try { window.syncSanTaxOnSanInput(); } catch (x) {} }
      /* Zustand und RND nur uebernehmen, wenn der Nutzer im Ergebnis
         zugestimmt hat — nie still. */
      /* v1629 · Die vier Gebaeude-Gewerke zurueck in den Objekt-Tab.
         Ohne sie steht im RND-Gutachten nur die Summe und keine
         Herleitung - und das faellt erst im fertigen Dokument auf. */
      var _zurueck = inObjektZurueck();
      if (_zurueck.length) meldung += ' · ' + _zurueck.join(', ') + ' ins Objekt übernommen';
      /* v2483 · die GENAUE Punktzahl des Hauses, nicht die naechste der fuenf
         festen Stufen (optionFuer machte aus 7 Punkten 8). Fehlt die Option,
         bekommt sie eine eigene - wie objekt-reiter.js modPunkteSchreiben. */
      if (el('mfh-uep') && el('mfh-uep').checked && el('mod_punkte') && modQuelle() !== 'felder' && d.hausPunkte != null) {   /* v2540 */
        var _mpSel = el('mod_punkte'), _mpV = String(d.hausPunkte);
        if (!Array.prototype.some.call(_mpSel.options || [], function (o) { return o.value === _mpV; })) {
          var _o = document.createElement('option'); _o.value = _mpV; _o.textContent = _mpV + ' Punkte (aus den Einheiten)'; _o.setAttribute('data-oe-auto', '1'); _mpSel.appendChild(_o);
        }
        _mpSel.value = _mpV;
        try { _mpSel.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {}
        meldung += ' · Modernisierungsgrad ' + _mpV + ' P.';
      }
      /* v2483 · die Zinssatz-Zeile (und mit ihr window._dpHausRnd) zu den neuen Punkten nachziehen */
      try { if (window.DealPilotObjektReiter && typeof DealPilotObjektReiter.automatik === 'function') setTimeout(DealPilotObjektReiter.automatik, 200); } catch (x) {}
      if (el('mfh-uer') && el('mfh-uer').checked && d.rndGew > 0) {
        var r = Math.round(d.rndGew), sel = el('afa_satz'), feld = el('afa_rnd_jahre');
        if (!feld && sel && window.DpAfaEigen) { sel.value = 'eigen'; try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {} feld = el('afa_rnd_jahre'); }
        if (feld) {
          var g = el('afa_eigen_grundlage'); if (g && !g.value) g.value = 'Einheitenbewertung MFH (Anlage 2, indikativ)';
          feld.value = String(r); try { feld.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {}
          meldung += ' · AfA aus RND ' + r + ' Jahre';
        }
      }
    }
    /* ═══ v2410 · DIE WOHNUNGEN RECHNEN AUCH ═════════════════════════
       Bis hier setzte das Uebernehmen `me_soll`/`me_pct` - Felder des
       Detail-Modus -, den Modus selbst aber nicht. Im Prognose-Modus
       (Auslieferungszustand) blieben beide wirkungslos, gemessen an
       Westerfeldstr. 140: me_modus „detail" mit leerer Anzahl
       Erhoehungen, also Faktor 1,0 auf alle Jahre.

       Das Ziel ist „Aus Wohnungen": es liest genau das, was hier gerade
       erhoben wurde (Ist, Staffel, Soll je Wohnung). Umgestellt wird
       nur, wenn der Modus etwas zu rechnen hat, und die Meldung sagt es. */
    var ME = window.MietEntwicklung;
    /* v2481 · auch die von DealPilot GERECHNETE Soll-Miete (Vergleichsmiete, Kappung) zaehlt -
       s.hatSoll kennt nur die eigene Angabe. Gemessen (Drehbuch Modul 26): sechs Wohnungen mit
       Vergleichsmiete, der Modus blieb auf Prognose. */
    var _hatSollP = false; try { _hatSollP = !!(window.DpPotenzial && window.DpPotenzial.modell({ einheiten: list, gebaeude: _geb }).hat_soll); } catch (x) {}
    if (list.length && ME && typeof ME.setMode === 'function' && typeof ME.einheitenNutzbar === 'function'
        && ME.einheitenNutzbar() && (s.hatSoll || _hatSollP || list.some(function (e) { return e.mv_in_mietentwicklung; }))) {
      if (ME.getMode() !== 'einheiten') meldung += ' · Mietentwicklung: aus Wohnungen';
      ME.setMode('einheiten');   /* ruft calc() selbst */
    } else if (typeof window.calc === 'function') window.calc();
    schliessen(); knopf();
    try { if (window.DpPotenzial) window.DpPotenzial.objektKarte(); } catch (x) {}   /* v2430 */
    if (typeof window.toast === 'function') window.toast('✓ ' + meldung);
  }

  /* ── Kennzahlen Ist gegen Soll (Stufe 2) ─────────────────────────── */
  function istSoll() {
    var host = el('mfh-istsoll');
    if (!host) { var a = el('r-sanfin'); if (!a) return; host = document.createElement('div'); host.id = 'mfh-istsoll'; host.style.cssText = 'margin-top:10px'; a.parentNode.insertBefore(host, a.nextSibling); }
    var d = daten(), s = summe(d.einheiten || []), K = (window.State && window.State.kpis) || {};
    if (!ARTEN_MIT_EINHEITEN[(el('objart') && el('objart').value) || ''] || !s.hatSoll || !(K.kp > 0)) { host.style.display = 'none'; return; }
    var ist_j = (K.nkm_j || 0), ze_j = zahl(el('ze') && el('ze').value) * 12, soll_j = s.soll * 12 + ze_j;
    var bmySoll = (window.DealKpis && typeof window.DealKpis.compute === 'function')
      ? window.DealKpis.compute({ kp: K.kp, nkm: s.soll, ze: ze_j / 12 }).bmy : null;   /* v2410 */
    var dscrSoll = null;
    if (window.Dscr && window.Dscr.compute) dscrSoll = window.Dscr.compute({ nkm_j: s.soll * 12, ze_j: ze_j, zins_j: K.zins_j, tilg_j: K.tilg_j, bsv_j: K.d1IsAussetzung ? (K.bspar_j || 0) : 0, bwk_cf: K.bwk_cf }).brutto;
    function p(n) { return (n == null || !isFinite(n)) ? '—' : n.toFixed(2).replace('.', ',') + ' %'; }
    function f(n) { return (n == null || !isFinite(n)) ? '—' : n.toFixed(2).replace('.', ','); }
    function z(l, a, b) { return '<tr><td style="padding:4px 0;color:var(--muted,#6B6356)">' + l + '</td><td style="text-align:right;padding:4px 8px">' + a + '</td><td style="text-align:right;padding:4px 0;font-weight:600">' + b + '</td></tr>'; }
    host.style.display = '';
    host.innerHTML = '<hr class="dvd"><div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Ist gegen Soll · ' + d.einheiten.length + ' Einheiten</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="font-size:11px;color:var(--muted,#8A8272)"><td></td><td style="text-align:right;padding:0 8px">Ist (heute)</td><td style="text-align:right">Soll</td></tr>' +
      z('Kaltmiete p. a.', eur(ist_j), eur(soll_j)) +
      /* v2410 - beide Spalten auf DERSELBEN Basis. Hier stand Ist = K.bmy
         (auf Kaufpreis) gegen Soll = soll_j / K.gi (auf Gesamtinvestition):
         der Soll-Wert lag damit allein durch den Nenner niedriger, um den
         Anteil der Nebenkosten und Sanierung. Die Soll-Rendite kommt jetzt
         aus demselben Kern wie die Ist-Rendite (DealKpis.compute, bmy =
         (NKM + Zusatzeinnahmen) x 12 / Kaufpreis) - nicht nachgerechnet.
         Die Zusatzeinnahmen stehen in beiden Spalten (K.nkm_j enthaelt sie). */
      z('Bruttomietrendite', p(K.bmy) + '<div style="font-size:10.5px;color:var(--muted,#8A8272)">auf Kaufpreis</div>', p(bmySoll) + '<div style="font-size:10.5px;font-weight:400;color:var(--muted,#8A8272)">auf Kaufpreis</div>') +
      z('DSCR', f(K.dscr), f(dscrSoll)) +
      z('Leerstand', s.leer ? s.leer + ' WE' : '—', '—') +
      (s.kosten ? z('Maßnahmen', '', eur(s.kosten)) : '') +
      '</table><div class="cf-hint" style="margin-top:4px">Soll = vereinbarte Soll-Mieten aller Einheiten nach den Maßnahmen, gleiche Finanzierung und Kosten. '
      + (d.sollAbJahr > 0 ? 'Ab Jahr ' + d.sollAbJahr + ' rechnet die Mietentwicklung mit der Soll-Miete.' : 'Die Rechnung oben bleibt beim Ist — ein Jahr für den Sprung steht im Konfigurator, Schritt 4.') + '</div>';
  }
  function anhaengen() {
    if (typeof window.calc !== 'function') return false;
    if (window.calc._dpMfhHook) return true;
    var alt = window.calc;
    var neu = function () { var r = alt.apply(this, arguments); try { setTimeout(istSoll, 380); } catch (e) {} return r; };
    for (var k in alt) { if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k]; }
    neu._dpMfhHook = true; window.calc = neu; return true;
  }
  var _n = 0;
  function haken() { if (!anhaengen() && ++_n < 12) setTimeout(haken, 400); }

  /* ══ v3001b · VERMIETUNGSSTAND: AUS DEN EINHEITEN, GEGEN DIE ANDEREN FELDER GEPRUEFT ══
     Marcel 27.10.2026: „das muss auch abgeprueft werden mit anderen Feldern, ob das da auch so ist“.
     Geprueft wird nur, was sich widersprechen KANN: Auswahl gegen Status der Einheiten, Status einer
     Einheit gegen ihre Ist-Miete, Ist-Miete im Reiter Miete gegen die Summe der Einheiten; ohne
     Einheiten die Auswahl gegen die Ist-Miete. Hinweis, keine Sperre - geaendert wird nur beim
     Uebernehmen der Einheiten. */
  function vermstandAus(s) {
    if (!s || !s.anzahl) return null;
    return s.leer === 0 ? 'Vollvermietet' : (s.leer >= s.anzahl ? 'Leer' : 'Teilweise leer');
  }
  function vermstandPruefen() {
    var sel = el('vermstand'); if (!sel) return [];
    var f = sel.closest ? sel.closest('.f') : null;
    var box = el('dp-verm-hinweis');
    if (!box && f) { box = document.createElement('div'); box.id = 'dp-verm-hinweis'; box.style.cssText = 'font-size:11.5px;line-height:1.4;color:#B8625C;margin-top:4px'; f.appendChild(box); }
    var h = [], v = sel.value, nkm = zahl(el('nkm') && el('nkm').value);
    var list = (artMitEinheiten() && window._dpMfh && Array.isArray(window._dpMfh.einheiten)) ? window._dpMfh.einheiten.filter(function (e) { return zahl(e.wfl) > 0 || zahl(e.ist) > 0 || String(e.lage || '').trim(); }) : [];
    if (list.length) {
      var s = summe(list), soll = vermstandAus(s);
      if (soll && v !== soll) h.push('Laut Einheiten ' + soll.toLowerCase() + ' (' + s.leer + ' von ' + s.anzahl + ' leer) — die Auswahl sagt „' + v + '“.');
      list.forEach(function (e, i) {
        var n = String(e.nr || (i + 1)) + (e.lage ? ' (' + e.lage + ')' : '');
        if (e.status === 'leer' && zahl(e.ist) > 0) h.push('Einheit ' + n + ' steht auf leer, trägt aber eine Ist-Miete von ' + eur(zahl(e.ist)) + ' — sie zählt nicht mit.');
        else if (e.status !== 'leer' && !(zahl(e.ist) > 0)) h.push('Einheit ' + n + ' steht auf vermietet, aber ohne Ist-Miete.');
      });
      if (s.ist > 0 && nkm > 0 && Math.abs(nkm - s.ist) > 1) h.push('Ist-Miete im Reiter Miete ' + eur(nkm) + ' weicht von der Summe der vermieteten Einheiten ' + eur(s.ist) + ' ab.');
    } else {
      if (v === 'Vollvermietet' && !(nkm > 0)) h.push('Vollvermietet, aber im Reiter Miete steht keine Ist-Miete.');
      if (v === 'Leer' && nkm > 0) h.push('Leer, aber im Reiter Miete steht eine Ist-Miete von ' + eur(nkm) + '.');
    }
    if (box) { box.innerHTML = h.map(function (t) { return '⚠ ' + esc(t); }).join('<br>'); box.style.display = h.length ? '' : 'none'; }
    return h;
  }
  document.addEventListener('change', function (e) { if (e.target && (e.target.id === 'vermstand' || e.target.id === 'objart')) vermstandPruefen(); });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'nkm') vermstandPruefen(); });
  window.addEventListener('dp:object-ready', function () { setTimeout(vermstandPruefen, 900); });

  function start() {
    haken();
    var a = el('objart'); if (a && !a._mfhBound) { a._mfhBound = true; a.addEventListener('change', knopf); }
    knopf();
  }
  window.addEventListener('dp:object-ready', function () { setTimeout(knopf, 250); setTimeout(istSoll, 700); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  /* v2027 - `artMitEinheiten` ist die AUSKUNFT zu ARTEN_MIT_EINHEITEN
     (Z. 32). Die Mietentwicklung braucht dieselbe Antwort, darf die
     Liste aber nicht kopieren: eine zweite Liste waere beim naechsten
     neuen Objekttyp veraltet - und sie wuerde lautlos falsch
     antworten, nicht fehlen. Ohne Argument liest sie das Feld selbst. */
  function artMitEinheiten(art) {
    if (art == null) art = (el('objart') && el('objart').value) || '';
    return !!ARTEN_MIT_EINHEITEN[art];
  }
  window.DpMfhEinheiten = { /* v2430: Punkte-Helfer fuer potenzial.js - keine zweite Tabelle */
    punkteVon: punkteVon, maxPunkte: maxPunkte, labelVon: labelVon, punkteObjekt: punkteObjekt, WE_IDS: WE_IDS, GEB_IDS: GEB_IDS,
    vermstandPruefen: vermstandPruefen /* v3001b */,
    oeffnen: oeffnen, knopf: knopf, istSoll: istSoll, berichtDaten: berichtDaten, artMitEinheiten: artMitEinheiten, hausPunkte: hausPunkte /* v2483 */, modQuelle: modQuelle, hatEinheiten: hatEinheiten /* v2540 */, _summe: summe, _punkte: punkteEinheit, _ergebnis: ergebnisDaten,
    /* v2087: die elf Vertragsformen mitexportiert. Der Reiter Miete
       braucht dieselbe Liste fuer die Objektebene (Backlog N60.8-alt) -
       eine zweite Liste dort waere der Anfang der Abweichung. */
    vertragsarten: MIETVERTRAG_ARTEN,
    /* v2156: die Stufen-Tabelle mitexportiert. `_buildAIPayload()`
       uebersetzt die Rohcodes `0/h/v`, bevor sie in den Prompt gehen —
       bis v2155 kam dort „dach=v" an und das Modell musste raten. Eine
       zweite Tabelle in ui.js waere der Anfang der Abweichung, genau wie
       bei den Vertragsarten eine Zeile hoeher. */
    STUFE_ZU_OBJEKT: STUFE_ZU_OBJEKT };
})();
