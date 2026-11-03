/* unterlagen-eingang.js — v3120 · EIN EINGANG FÜR BELEGE, UNTERLAGEN, RECHNUNGEN
   ───────────────────────────────────────────────────────────────────────────
   Marcel 03.11.2026: „Im Bestand kommen vielleicht nur Wirtschaftspläne, neue Mietverträge …
   auslesen und im Modal zeigen, was ausgelesen wurde, mit einem Vorschlag, wohin der Mietvertrag
   zugeordnet wird … Beim Wirtschaftsplan in den Werbungskosten eintragen, mit Jahr … EIN Bereich
   ‚Belege, Unterlagen, Rechnungen', egal was man reinpackt … und im Reiter Unterlagen & WEG den
   Verlauf tracken."

   NICHTS DOPPELT. Gemessen, was es gibt:
     object-actions.js  openCombinedImport („PDFs einlesen"): mehrere Dateien und Fotos, Typ je
                        Datei, Auslesen (DokumentImport: Mietvertrag, Hausgeld = Wirtschaftsplan/
                        Abrechnung, WEG-Protokoll, Mietaufstellung …), EIN Prüf-Fenster, Steuer je
                        Jahr (v3017, nie vorgehakt), Sonderumlage (N100), WEG-Auswertung (unterlagen.js)
     beleg-import.js    Rechnungen/Belege → Werbungskosten je Jahr (Modus 'wk', dpWkUebernehmen)
   Diese Datei ergänzt nur, was fehlte:
     · der Eingang (oeffnen) - derselbe Import, aus Pilot-Analyse und Reiter Steuer
     · Rechnungen im selben Eingang erkennen (istRechnung) und an den Beleg-Leser geben
     · Mietvertrag → Einheit und Mieter (MFH): Vorschlag, bei Unsicherheit Pflicht zur Wahl
     · Herkunftsmarke je übernommenem Steuerposten (Unterlage / Beleg); eine Änderung von Hand
       löscht sie wieder - „durch Unterlagen belegt" heißt: der Wert stammt noch aus dem Dokument
     · Verlauf: was wann eingelesen und übernommen wurde
   Gespeichert im Objekt: #_dok_eingang (JSON, storage.js FIELDS) = { herkunft, verlauf }. */
(function () {
  'use strict';
  if (window.DpEingang) return;

  function el(id) { return document.getElementById(id); }
  /* Punkt ist nur dann Tausender, wenn danach genau drei Ziffern folgen („1.410"); „8.5" bleibt 8,5 */
  function zahl(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/\s|€/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    var n = Number(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(v) { return Math.round(v).toLocaleString('de-DE') + ' €'; }

  /* ── Speicher ─────────────────────────────────────────────────────────── */
  function lesen() {
    var f = el('_dok_eingang'), o = null;
    try { o = f && f.value ? JSON.parse(f.value) : null; } catch (e) { o = null; }
    o = o && typeof o === 'object' ? o : {};
    if (!o.herkunft || typeof o.herkunft !== 'object') o.herkunft = {};
    if (!Array.isArray(o.verlauf)) o.verlauf = [];
    return o;
  }
  function schreiben(o) {
    var f = el('_dok_eingang'); if (!f) return;
    f.value = JSON.stringify(o);
    try { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  /* ── Eingang ──────────────────────────────────────────────────────────── */
  function oeffnen() {
    var OA = window.ObjectActions;
    if (!OA || typeof OA.openImport !== 'function') { try { if (window.toast) window.toast('Import nicht geladen – Seite neu laden.'); } catch (e) {} return; }
    var ergaenzen = false;
    try { ergaenzen = !!(window.DpUnterlagen && window.DpUnterlagen.laden()); } catch (e) {}
    OA.openImport(null, { ergaenzen: ergaenzen, eingang: true });
  }

  /* ── Rechnungen erkennen ──────────────────────────────────────────────────
     Nur eindeutige Merkmale. Wirtschaftsplan, Haus-/Jahresabrechnung, Protokoll, Mietvertrag gehen
     den Weg der Unterlagen (sie tragen Werbungskosten, Beschlüsse, Einheiten), nie den der Rechnung. */
  var NICHT = /wirtschaftsplan|hausgeldabrechnung|jahresabrechnung|einzelabrechnung|gesamtabrechnung|eigent(ü|ue)merversammlung|niederschrift|mietvertrag|teilungserkl(ä|ae)rung|grundbuch|expos(é|e)|verkehrswert|marktbericht/i;
  function istRechnung(text, name) {
    var t = String(text || '').slice(0, 6000), n = String(name || '');
    if (NICHT.test(t.slice(0, 2500)) || NICHT.test(n)) return false;
    var treffer = 0;
    [/rechnungs\s*-?\s*(nummer|nr\.?|datum)/i, /\brechnung\b/i, /quittung|betrag dankend erhalten/i, /zahlbar (bis|innerhalb)|zahlungsziel|f(ä|ae)llig am/i,
     /ust\.?-?\s*id|steuer-?nr|umsatzsteuer|mwst|mehrwertsteuer|19\s*%/i, /grundsteuerbescheid|beitragsrechnung|versicherungsschein/i,
     /* v3154 · gemessen an einer zweisprachigen Hotelrechnung („Invoice No.", „VAT", „Gross EUR"): kam nur auf 2 Treffer
        und lief als Exposé durch - nichts übernommen. Englische Merkmale und der Rechnungsbetrag zählen mit. */
     /invoice\s*(no|number|date|nr)|\bvat\b|gross\s*(eur|amount)|net\s*(eur|amount)|amount\s*due|total\s*(eur|amount|due)/i,
     /(rechnungs|gesamt|end|zahl)betrag|betrag:?\s*(eur|€)|summe\s*brutto|bruttobetrag/i].forEach(function (r) { if (r.test(t)) treffer++; });
    if (/rechnung|quittung|beleg|invoice/i.test(n)) treffer++;
    if (/quittung|betrag dankend erhalten/i.test(t)) treffer++;   /* v3120c · eine Quittung ist eindeutig - gemessen: Schornsteinfeger-Quittung kam nur auf 2 */
    return treffer >= 3;
  }
  function belegeAuslesen(files) {
    var B = window.DealPilotBelegImport;
    if (!B) return false;
    if (typeof B.oeffnenMit === 'function') { B.oeffnenMit(files, 'wk'); return true; }
    B.open('wk'); return true;
  }

  /* ── Mietvertrag → Einheit ────────────────────────────────────────────── */
  function einheiten() {
    var m = window._dpMfh;
    return m && Array.isArray(m.einheiten) && m.einheiten.length >= 2 ? m.einheiten : null;
  }
  function einheitName(e, i) {
    return (e.art === 'gewerbe' ? 'Gewerbe ' : 'Whg. ') + (e.nr || (i + 1)) + (e.lage ? ' · ' + e.lage : '') + (zahl(e.wfl) ? ' · ' + String(e.wfl).replace('.', ',') + ' m²' : '')
      + (e.mv_mieter ? ' · Mieter ' + e.mv_mieter : '') + (e.status === 'leer' ? ' · leer' : '');
  }
  /** Vorschlag: { i, sicher, grund } oder null. Sicher nur bei eindeutiger Nummer oder Lage. */
  function mvVorschlag(ext) {
    var E = einheiten(); if (!E) return null;
    var lage = String((ext && ext.lage_einheit) || '').trim(), wfl = zahl(ext && ext.wohnflaeche_m2);
    /* v3150 · derselbe Mieter steht schon an einer Einheit (Name ohne KI gelesen, routes/ai.js) */
    var mn = ext && ext.mieter_name && ext.mieter_name.name ? String(ext.mieter_name.name).toLowerCase().replace(/\s+/g, ' ').trim() : '';
    if (mn) {
      var t0 = E.map(function (e, i) { return e.mv_mieter && String(e.mv_mieter).toLowerCase().replace(/\s+/g, ' ').trim() === mn ? i : -1; }).filter(function (i) { return i >= 0; });
      if (t0.length === 1) return { i: t0[0], sicher: true, grund: 'Mieter „' + ext.mieter_name.name + '" steht schon an dieser Einheit' };
    }
    var nr = (lage.match(/(?:whg|wohnung|we|einheit|nr)\.?\s*(\d+)/i) || [])[1];
    if (nr) {
      var t = E.map(function (e, i) { return String(e.nr || (i + 1)) === nr ? i : -1; }).filter(function (i) { return i >= 0; });
      if (t.length === 1) return { i: t[0], sicher: true, grund: 'Nummer „' + lage + '" im Vertrag' };
    }
    if (lage) {
      var l = lage.toLowerCase();
      var t2 = E.map(function (e, i) { return e.lage && (String(e.lage).toLowerCase() === l || l.indexOf(String(e.lage).toLowerCase()) >= 0) ? i : -1; }).filter(function (i) { return i >= 0; });
      if (t2.length === 1) return { i: t2[0], sicher: true, grund: 'Lage „' + lage + '" im Vertrag' };
    }
    if (wfl) {
      var t3 = E.map(function (e, i) { var w = zahl(e.wfl); return w && Math.abs(w - wfl) / w <= 0.03 ? i : -1; }).filter(function (i) { return i >= 0; });
      if (t3.length === 1) return { i: t3[0], sicher: false, grund: 'Wohnfläche ' + String(wfl).replace('.', ',') + ' m² passt – bitte bestätigen' };
    }
    return { i: -1, sicher: false, grund: 'Einheit aus dem Vertrag nicht eindeutig – bitte zuordnen' };
  }
  function mvOptionen(sel) {
    var E = einheiten() || [];
    return '<option value="">– Einheit wählen –</option>' + E.map(function (e, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + esc(einheitName(e, i)) + '</option>'; }).join('');
  }
  function isoAus(de) { var m = String(de || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : (/^\d{4}-\d{2}-\d{2}$/.test(String(de || '')) ? String(de) : ''); }
  var ART = { unbefristet: 'unbefristet', staffel: 'staffel', index: 'index', zeitmiete: 'zeitmiete', gewerbe: 'gewerbe', moebliert: 'moebliert_kurz' };
  /** Zusammenfassung für die Zeile im Prüf-Fenster */
  function mvText(ext) {
    var t = [];
    if (zahl(ext.kaltmiete_eur)) t.push('Kaltmiete ' + eur(zahl(ext.kaltmiete_eur)) + '/Monat');
    if (ext.vertragsart) t.push({ staffel: 'Staffelmiete', index: 'Indexmiete', unbefristet: 'unbefristet', zeitmiete: 'befristet', gewerbe: 'Gewerbe', moebliert: 'möbliert' }[ext.vertragsart] || ext.vertragsart);
    if (ext.mietbeginn) t.push('ab ' + ext.mietbeginn);
    if (zahl(ext.kaution_eur)) t.push('Kaution ' + eur(zahl(ext.kaution_eur)));
    if (zahl(ext.nebenkosten_vorauszahlung_eur)) t.push('NK ' + eur(zahl(ext.nebenkosten_vorauszahlung_eur)));
    if (Array.isArray(ext.staffeln) && ext.staffeln.length) t.push(ext.staffeln.length + ' Staffeln');
    if (ext.lage_einheit) t.push('laut Vertrag: ' + ext.lage_einheit);
    if (ext.mieter_name && ext.mieter_name.name) t.push('Mieter ' + ext.mieter_name.name + (ext.mieter_name.sicher ? '' : ' (bitte prüfen)') + ' – ohne KI gelesen');   /* v3150 */
    return t.join(' · ');
  }
  /** Übernimmt einen Mietvertrag in die gewählte Einheit. Überschreibt Miete und Vertragsdaten (neuer
      Vertrag gilt), Fläche/Zimmer nur, wenn leer. Gesamtmiete wie „Einheiten erfassen" (DpMfhEinheiten._summe). */
  function mvUebernehmen(i, ext, quelle) {
    var E = einheiten(); if (!E || !E[i] || !ext) return false;
    var e = E[i], alt = JSON.parse(JSON.stringify(e)), heute = new Date().toISOString().slice(0, 10);
    var setz = function (k, v) { if (v !== null && v !== undefined && v !== '') e[k] = String(v); };
    /* v3120a · ein NEUER Vertrag (anderer Mietbeginn) ersetzt den alten ganz - gemessen: Whg. 1 behielt
       „nächste Anpassung 01.04.2027" des alten Staffelvertrags, obwohl der neue unbefristet ist. Beim neuen
       Vertrag wird auch der alte Mietername geleert.
       v3150 · Marcel 03.11.2026: der Name des Mieters wird jetzt ausgelesen, aber NICHT von der KI - Regeln auf
       unserem Server vor dem Schwärzen (backend/src/services/mieterName.js), Feld ext.mieter_name. */
    var neuerVertrag = isoAus(ext.mietbeginn) && isoAus(ext.mietbeginn) !== String(e.mv_beginn || '');
    if (neuerVertrag) ['mv_art', 'mv_letzte_erhoehung', 'mv_letzte_erhoehung_betrag', 'mv_naechste_anpassung', 'mv_befristet_bis', 'mv_kuendigungsverzicht_bis',
      'mv_kaution', 'nk_vorauszahlung', 'stellplatz_miete', 'mv_mieter', 'mv_abw_jahre'].forEach(function (k) { if (k in e) e[k] = ''; });
    setz('ist', zahl(ext.kaltmiete_eur));
    if (zahl(ext.kaltmiete_eur)) e.status = 'vermietet';
    setz('mv_art', ART[ext.vertragsart] || '');
    setz('mv_beginn', isoAus(ext.mietbeginn));
    setz('mv_kaution', zahl(ext.kaution_eur));
    setz('nk_vorauszahlung', zahl(ext.nebenkosten_vorauszahlung_eur));
    setz('stellplatz_miete', zahl(ext.stellplatz_miete_eur));
    setz('mv_befristet_bis', isoAus(ext.befristet_bis));
    setz('mv_kuendigungsverzicht_bis', isoAus(ext.kuendigungsverzicht_bis));
    setz('mv_letzte_erhoehung', isoAus(ext.letzte_erhoehung));
    if (ext.mieter_name && ext.mieter_name.name && (neuerVertrag || !String(e.mv_mieter || '').trim())) setz('mv_mieter', ext.mieter_name.name);   /* v3150 */
    if (Array.isArray(ext.staffeln)) {
      var naechste = ext.staffeln.map(function (s) { return isoAus(s && s.ab); }).filter(function (d) { return d && d > heute; }).sort()[0];
      setz('mv_naechste_anpassung', naechste);
    }
    if (!zahl(e.wfl)) setz('wfl', zahl(ext.wohnflaeche_m2));
    if (!zahl(e.zimmer)) setz('zimmer', zahl(ext.zimmer));
    /* Gesamtmiete des Objekts nachziehen - dieselbe Summe wie „Einheiten erfassen" */
    var nkVor = feldStand('nkm');   /* v3154 */
    try {
      var M = window.DpMfhEinheiten, s = M && M._summe ? M._summe(E) : null, nk = el('nkm');
      if (s && s.ist > 0 && nk) { nk.value = String(Math.round(s.ist * 100) / 100).replace('.', ','); nk.dispatchEvent(new Event('input', { bubbles: true })); }
    } catch (x) {}
    txMerk({ t: 'einheit', i: i, label: 'Mietvertrag → ' + einheitName(e, i), vor: alt, nach: JSON.parse(JSON.stringify(e)) });
    var nkE = el('nkm');
    if (nkVor && nkE && feldWert(nkE) !== nkVor.wert) txMerk({ t: 'feld', id: 'nkm', label: 'Nettokaltmiete', vor: nkVor.wert, nach: feldWert(nkE) });
    var o = lesen();
    o.einheiten_aenderungen = (Array.isArray(o.einheiten_aenderungen) ? o.einheiten_aenderungen : []).concat([{ am: heute, einheit: einheitName(e, i), quelle: quelle || 'Mietvertrag',
      vorher: { ist: alt.ist || '', mv_art: alt.mv_art || '', mv_beginn: alt.mv_beginn || '' } }]).slice(-50);
    schreiben(o);
    return true;
  }

  /* ── Herkunftsmarke je Steuerposten ───────────────────────────────────────
     tax.js schreibt alle Jahreswerte über _setYearOverride. Läuft das Schreiben aus einer Unterlage
     (dpSteuerSetzen mit Quelle) oder aus dem Beleg-Leser (dpWkUebernehmen), wird die Herkunft
     gemerkt; schreibt jemand von Hand, wird sie gelöscht. */
  var _ctx = null;
  function herkunftSetzen(year, field, val) {
    var o = lesen(), k = 'y' + year;
    if (_ctx && val !== '' && val != null && !isNaN(val)) {
      (o.herkunft[k] = o.herkunft[k] || {})[field] = { quelle: _ctx.quelle, dok: _ctx.dok || '', am: new Date().toISOString().slice(0, 10), betrag: Math.round(Number(val)) };
    } else if (o.herkunft[k] && o.herkunft[k][field]) {
      delete o.herkunft[k][field];
      if (!Object.keys(o.herkunft[k]).length) delete o.herkunft[k];
    } else return;
    schreiben(o);
  }
  /* ── v3154 · Änderungen eines Imports merken (für „Zurücknehmen" im Verlauf) ──────────────
     Marcel 03.11.2026: „im Verlauf eingelesen und übernommen … wenn wir das löschen können und auch
     zurücknehmen können". Jeder Import läuft als Vorgang: Steuerwerte (über _setYearOverride),
     Formularfelder (object-actions.js) und Einheiten (mvUebernehmen) merken je vorher/nachher.
     Zurückgenommen wird nur, was seitdem niemand geändert hat - sonst wird es benannt. */
  var _tx = null;
  function txStart() { _tx = []; }
  function txMerk(a) {
    if (!_tx || !a) return;
    if (a.t === 'steuer') {
      var d = _tx.filter(function (x) { return x.t === 'steuer' && x.jahr === a.jahr && x.feld === a.feld; })[0];
      if (d) { d.nach = a.nach; return; }
    }
    if (a.t === 'feld') {
      var d2 = _tx.filter(function (x) { return x.t === 'feld' && x.id === a.id; })[0];
      if (d2) { d2.nach = a.nach; return; }
    }
    _tx.push(a);
  }
  function txEnde() { var t = _tx || []; _tx = null; return t; }
  function feldWert(el) { return el.type === 'checkbox' ? !!el.checked : String(el.value == null ? '' : el.value); }
  /** Stand eines Formularfelds vor dem Schreiben (object-actions.js) */
  function feldStand(id) { var e = el(id); return e ? { wert: feldWert(e) } : null; }
  var NICHT_ZURUECK = { sonderumlage: 'Sonderumlage', merken: 'Unterlagen-Auswertung', einheiten: 'Einheitenliste', star: 'Bewertung (Sterne)' };
  /** Nach dem Schreiben: was hat sich geändert? kind steuer/mv_einheit merken ihre Hooks selbst. */
  function feldGeaendert(id, vor, it) {
    if (!_tx || !it) return;
    if (it.kind === 'steuer' || it.kind === 'mv_einheit') return;
    var e = el(id);
    if (NICHT_ZURUECK[it.kind] || id === 'me_modus' || id === 'mfh_wohnungen' || !e || !vor) {
      txMerk({ t: 'nicht', label: it.label || NICHT_ZURUECK[it.kind] || id }); return;
    }
    var nach = feldWert(e);
    if (nach !== vor.wert) txMerk({ t: 'feld', id: id, label: it.label || id, vor: vor.wert, nach: nach });
  }

  function einhaengen() {
    if (typeof window._setYearOverride === 'function' && !window._setYearOverride._dpEingang) {
      var orig = window._setYearOverride;
      var neu = function (year, field, value) {
        var ov = window._taxYearlyOverrides || {}, k = 'y' + year;
        var vor = ov[k] && typeof ov[k][field] === 'number' ? ov[k][field] : null;
        var r = orig.apply(this, arguments);
        try { herkunftSetzen(year, field, value); } catch (e) {}
        try {
          var ov2 = window._taxYearlyOverrides || {}, nach = ov2[k] && typeof ov2[k][field] === 'number' ? ov2[k][field] : null;
          if (_tx && vor !== nach) txMerk({ t: 'steuer', jahr: Number(year), feld: field, vor: vor, nach: nach });   /* v3154 */
        } catch (e) {}
        return r;
      };
      neu._dpEingang = true; window._setYearOverride = neu;
    }
    if (typeof window.dpSteuerSetzen === 'function' && !window.dpSteuerSetzen._dpEingang) {
      var o1 = window.dpSteuerSetzen;
      var n1 = function (year, field, val, meta) {
        _ctx = meta && meta.quelle ? { quelle: 'Unterlage', dok: meta.quelle } : null;
        try { return o1.apply(this, arguments); } finally { _ctx = null; }
      };
      n1._dpEingang = true; window.dpSteuerSetzen = n1;
    }
    if (typeof window.dpWkUebernehmen === 'function' && !window.dpWkUebernehmen._dpEingang) {
      var o2 = window.dpWkUebernehmen;
      var n2 = function () { _ctx = { quelle: 'Beleg', dok: 'Belege & Abrechnungen' }; try { return o2.apply(this, arguments); } finally { _ctx = null; } };
      n2._dpEingang = true; window.dpWkUebernehmen = n2;
    }
  }
  /** Stand eines Steuerjahres: belegt = Posten, deren Wert noch aus einer Unterlage/einem Beleg stammt */
  function jahrStand(year) {
    var o = lesen(), h = o.herkunft['y' + year] || {}, ov = (window._taxYearlyOverrides || {})['y' + year] || {};
    var belegt = 0, eigen = 0;
    Object.keys(ov).forEach(function (f) {
      if (typeof ov[f] !== 'number' || !isFinite(ov[f])) return;
      if (h[f] && Math.round(h[f].betrag) === Math.round(ov[f])) belegt++; else eigen++;
    });
    return { belegt: belegt, eigen: eigen };
  }

  /* ── Verlauf ──────────────────────────────────────────────────────────── */
  function protokoll(e) {
    if (!e) return;
    var o = lesen();
    /* v3154 · je Eintrag eine Kennung, die gemerkten Änderungen (Zurücknehmen) und die Dateien, aus denen nichts kam */
    var aend = Array.isArray(e.aenderungen) ? e.aenderungen : [];
    o.verlauf = o.verlauf.concat([{ id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), am: new Date().toISOString(),
      quelle: e.quelle || null, dokumente: (e.dokumente || []).slice(0, 30), uebernommen: (e.uebernommen || []).slice(0, 60),
      nicht_gelesen: (e.nicht_gelesen || []).slice(0, 30), aenderungen: aend.slice(0, 200) }]).slice(-50);
    schreiben(o);
    /* v3120a · gemessen: der Reiter Unterlagen & WEG zeigte den Verlauf erst nach dem nächsten Zeichnen */
    setTimeout(neuZeichnen, 300);
  }
  function neuZeichnen() { try { if (typeof window._dpPaNeuZeichnen === 'function') window._dpPaNeuZeichnen(); } catch (x) {} }
  function gleich(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function nahe(a, b) { return (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005); }

  /** v3154 · Einen Import zurücknehmen: jede gemerkte Änderung rückwärts, nur wo der Wert noch der übernommene ist. */
  function zuruecknehmen(id) {
    var o = lesen(), x = o.verlauf.filter(function (v) { return v.id === id; })[0];
    if (!x || x.zurueck) return null;
    var ok = 0, konflikt = [], nicht = [], steuer = false;
    (x.aenderungen || []).slice().reverse().forEach(function (a) {
      if (a.t === 'nicht') { nicht.push(a.label); return; }
      if (a.t === 'feld') {
        var e = el(a.id);
        if (!e || feldWert(e) !== a.nach) { konflikt.push(a.label); return; }
        if (e.type === 'checkbox') e.checked = !!a.vor; else e.value = a.vor;
        try { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } catch (y) {}
        ok++; return;
      }
      if (a.t === 'steuer') {
        var ov = window._taxYearlyOverrides || {}, k = 'y' + a.jahr, jetzt = ov[k] && typeof ov[k][a.feld] === 'number' ? ov[k][a.feld] : null;
        if (!nahe(jetzt, a.nach) || typeof window._setYearOverride !== 'function') { konflikt.push(a.feld + ' ' + a.jahr); return; }
        window._setYearOverride(a.jahr, a.feld, a.vor == null ? '' : a.vor);
        steuer = true; ok++; return;
      }
      if (a.t === 'einheit') {
        var m = window._dpMfh, E = m && m.einheiten;
        if (!E || !E[a.i] || !gleich(E[a.i], a.nach)) { konflikt.push(a.label); return; }
        var ziel = E[a.i];
        Object.keys(ziel).forEach(function (kk) { delete ziel[kk]; });
        Object.keys(a.vor || {}).forEach(function (kk) { ziel[kk] = a.vor[kk]; });
        ok++;
      }
    });
    if (steuer) {
      ['renderYearlyTaxForm', 'renderTaxTimeline', 'renderTaxModule'].forEach(function (f) { try { if (typeof window[f] === 'function') window[f](); } catch (y) {} });
    }
    try { if (typeof window.calc === 'function') setTimeout(window.calc, 60); } catch (y) {}
    o = lesen();
    o.verlauf.forEach(function (v) { if (v.id === id) v.zurueck = { am: new Date().toISOString(), anzahl: ok, konflikt: konflikt, nicht: nicht }; });
    schreiben(o);
    setTimeout(neuZeichnen, 120);
    var msg = ok + ' Wert(e) zurückgenommen.' + (konflikt.length ? ' Seitdem von Hand geändert, deshalb belassen: ' + konflikt.join(', ') + '.' : '')
      + (nicht.length ? ' Nicht automatisch zurücknehmbar: ' + nicht.join(', ') + '.' : '');
    try { if (window.toast) window.toast(msg); } catch (y) {}
    return { anzahl: ok, konflikt: konflikt, nicht: nicht };
  }
  /** v3154 · Eintrag aus dem Verlauf löschen - die übernommenen Werte bleiben stehen. */
  function eintragLoeschen(id) {
    var o = lesen(), n = o.verlauf.length;
    o.verlauf = o.verlauf.filter(function (v) { return v.id !== id; });
    if (o.verlauf.length === n) return false;
    schreiben(o); setTimeout(neuZeichnen, 120);
    return true;
  }
  /* Zwei Klicks statt Bestätigungsfenster: der erste fragt im Knopf selbst nach.
     v3154g · gemessen: die Pilot-Analyse zeichnet nach dem Speichern neu - ein Merker AM Knopf ging
     zwischen erstem und zweitem Klick verloren. Der Merker liegt deshalb hier und übersteht das Neuzeichnen. */
  var _scharf = null;   /* { art, id, bis } */
  function knopfText(art, id) {
    var s = _scharf && _scharf.art === art && _scharf.id === id && _scharf.bis > Date.now();
    return s ? (art === 'zurueck' ? 'Wirklich zurücknehmen?' : 'Wirklich löschen?') : (art === 'zurueck' ? 'Zurücknehmen' : 'Löschen');
  }
  function knopf(art, id, btn) {
    var s = _scharf && _scharf.art === art && _scharf.id === id && _scharf.bis > Date.now();
    if (!s) {
      _scharf = { art: art, id: id, bis: Date.now() + 8000 };
      if (btn) btn.textContent = knopfText(art, id);
      setTimeout(function () {
        if (_scharf && _scharf.id === id && _scharf.bis <= Date.now()) {
          _scharf = null;
          document.querySelectorAll('button[data-eg-knopf="' + art + ':' + id + '"]').forEach(function (b) { b.textContent = knopfText(art, id); });
        }
      }, 8100);
      return;
    }
    _scharf = null;
    if (art === 'zurueck') zuruecknehmen(id); else eintragLoeschen(id);
  }
  /** Eintrag ohne Kennung (vor v3154) bekommt beim ersten Zeichnen eine - löschen geht dann auch dort */
  function kennungenNachziehen(o) {
    var neu = false;
    o.verlauf.forEach(function (v, i) { if (!v.id) { v.id = 'a' + i + '-' + String(v.am || '').replace(/\D/g, '').slice(0, 14); neu = true; } });
    return neu;
  }
  function verlaufHtml() {
    var o = lesen();
    if (kennungenNachziehen(o)) { var f0 = el('_dok_eingang'); if (f0) f0.value = JSON.stringify(o); }   /* still, ohne Speicher-Ereignis */
    var v = o.verlauf.slice().reverse(), ae = (o.einheiten_aenderungen || []).slice().reverse();
    if (!v.length && !ae.length) return '';
    var datum = function (s) { try { return new Date(s).toLocaleDateString('de-DE'); } catch (x) { return ''; } };
    var kb = 'font:600 11.5px/1 inherit;padding:5px 9px;border-radius:6px;cursor:pointer;margin:2px 0;white-space:nowrap;';
    var h = '<div style="overflow-x:auto"><table class="abw-tafel" style="min-width:620px"><thead><tr><th>Eingelesen</th><th>Unterlagen</th><th>Übernommen</th><th></th></tr></thead><tbody>'
      + v.map(function (x) {
        var ng = (x.nicht_gelesen || []).length
          ? '<div style="margin-top:6px;color:#B8625C;font-weight:600">⚠ Nichts gelesen aus: ' + x.nicht_gelesen.map(esc).join(', ') + ' – bitte von Hand prüfen</div>' : '';
        var zr = x.zurueck
          ? '<div style="margin-top:6px;color:#8a7a55"><b>Zurückgenommen am ' + esc(datum(x.zurueck.am)) + '</b> (' + x.zurueck.anzahl + ' Wert(e))'
            + (x.zurueck.konflikt && x.zurueck.konflikt.length ? ' · belassen, weil seitdem geändert: ' + x.zurueck.konflikt.map(esc).join(', ') : '')
            + (x.zurueck.nicht && x.zurueck.nicht.length ? ' · nicht automatisch: ' + x.zurueck.nicht.map(esc).join(', ') : '') + '</div>' : '';
        var kannZurueck = !x.zurueck && (x.aenderungen || []).some(function (a) { return a.t !== 'nicht'; });
        var aktion = (kannZurueck ? '<button type="button" data-eg-knopf="zurueck:' + esc(x.id) + '" style="' + kb + 'border:1px solid var(--wl-c9a84c,#C9A84C);background:transparent;color:inherit" onclick="DpEingang.knopf(\'zurueck\',\'' + esc(x.id) + '\',this)">' + knopfText('zurueck', x.id) + '</button><br>' : '')
          + '<button type="button" data-eg-knopf="loeschen:' + esc(x.id) + '" style="' + kb + 'border:1px solid rgba(184,98,92,.55);background:transparent;color:#B8625C" onclick="DpEingang.knopf(\'loeschen\',\'' + esc(x.id) + '\',this)" title="Nur den Eintrag aus dem Verlauf entfernen - übernommene Werte bleiben">' + knopfText('loeschen', x.id) + '</button>';
        return '<tr' + (x.zurueck ? ' style="opacity:.6"' : '') + '><td class="abw-wort" style="white-space:nowrap">' + esc(datum(x.am)) + '</td><td>' + x.dokumente.map(function (d) { return esc((d.typ ? d.typ + ': ' : '') + d.name); }).join('<br>') + ng + '</td>'
          + '<td>' + (x.uebernommen.length ? x.uebernommen.map(esc).join('<br>') : '<i>nichts übernommen</i>') + zr + '</td><td style="text-align:right">' + aktion + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<p class="dp-pa-p" style="margin-top:6px;font-size:12px;opacity:.75">Zurücknehmen setzt die übernommenen Werte auf den Stand davor – nur dort, wo seitdem niemand etwas geändert hat. Löschen entfernt nur den Eintrag; die Werte bleiben.</p>';
    if (ae.length) h += '<p class="dp-pa-p" style="margin-top:10px"><b>Mietverträge den Einheiten zugeordnet:</b> ' + ae.map(function (a) { return esc(a.einheit) + ' (' + esc(datum(a.am)) + ', vorher ' + (a.vorher.ist ? esc(a.vorher.ist) + ' €' : '–') + ')'; }).join(' · ') + '</p>';
    return h;
  }

  /* ── v3154 · PRÜFANSICHT: links das eingescannte Bild, rechts die gelesenen Werte ─────────────
     Marcel 03.11.2026: „dass man immer das eingescannte Bild sieht und daneben auch die eingelesenen
     Werte … wenn er da keine Werte übernehmen kann, müssen wir natürlich davor warnen."
     opts = { titel, bilder: [dataURL] | null, datei: File | null, werte: [[Wort, Wert]], warnung, hinweise: [] }
     Die Bilder bleiben im Browser (nichts wird gespeichert oder verschickt). */
  function vorschau(opts) {
    opts = opts || {};
    var alt = el('dp-eg-vorschau'); if (alt) alt.remove();
    var ov = document.createElement('div');
    ov.id = 'dp-eg-vorschau';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100060;background:rgba(5,5,5,.72);display:flex;align-items:center;justify-content:center;padding:16px');
    var werte = (opts.werte || []).filter(function (w) { return w && w[1] != null && String(w[1]).trim() !== ''; });
    var warn = opts.warnung || (!werte.length ? 'Aus dieser Datei konnte nichts gelesen werden. Bitte die Werte von Hand eintragen oder ein schärferes Bild verwenden.' : '');
    ov.innerHTML = '<div style="background:var(--surface,#FDFCFA);color:var(--text,#2A2727);border-radius:14px;max-width:1180px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
      + '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--wl-c9a84c,#C9A84C)"><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(opts.titel || 'Beleg') + '</b>'
      + '<button type="button" data-zu style="border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:inherit" aria-label="Schließen">×</button></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:16px;padding:16px;overflow:auto">'
      + '<div data-bilder style="flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:10px;background:#efece4;border-radius:8px;padding:8px;min-height:200px;align-items:center;justify-content:flex-start"><span style="opacity:.6;padding:30px">Bild wird geladen …</span></div>'
      + '<div style="flex:1 1 300px;min-width:0">'
      + (warn ? '<div style="margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(184,98,92,.12);border:1px solid rgba(184,98,92,.5);color:#B8625C;font-weight:600">⚠ ' + esc(warn) + '</div>' : '')
      + (opts.hinweise && opts.hinweise.length ? '<div style="margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.04);border:1px solid var(--wl-c9a84c,#C9A84C)"><b>Bitte prüfen:</b><br>' + opts.hinweise.map(esc).join('<br>') + '</div>' : '')
      + (werte.length ? '<table style="width:100%;border-collapse:collapse;font-size:13.5px">' + werte.map(function (w) {
          return '<tr><td style="padding:6px 8px 6px 0;border-bottom:1px solid rgba(0,0,0,.07);opacity:.75;vertical-align:top">' + esc(w[0]) + '</td><td style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,.07);font-weight:600;text-align:right">' + esc(w[1]) + '</td></tr>';
        }).join('') + '</table>' : '')
      + '<p style="font-size:12px;opacity:.65;margin-top:12px">Links die Datei, rechts was daraus gelesen wurde. Stimmt etwas nicht, die Zeile abwählen oder den Wert nach der Übernahme von Hand korrigieren.</p>'
      + '</div></div></div>';
    document.body.appendChild(ov);
    var zu = function () { try { ov.remove(); } catch (e) {} document.removeEventListener('keydown', esc1); };
    var esc1 = function (e) { if (e.key === 'Escape') zu(); };
    document.addEventListener('keydown', esc1);
    ov.addEventListener('click', function (e) { if (e.target === ov || (e.target.hasAttribute && e.target.hasAttribute('data-zu'))) zu(); });
    var box = ov.querySelector('[data-bilder]');
    var zeige = function (b) {
      if (!b || !b.length) { box.innerHTML = '<span style="opacity:.6;padding:30px">Keine Bildansicht für diese Datei.</span>'; return; }
      box.innerHTML = b.slice(0, 12).map(function (src, i) { return '<img alt="Seite ' + (i + 1) + '" src="' + src + '" style="max-width:100%;height:auto;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.2);background:#fff">'; }).join('');
    };
    if (opts.bilder) zeige(opts.bilder);
    else if (opts.datei && window.DealPilotBelegImport && typeof window.DealPilotBelegImport.bilder === 'function') {
      window.DealPilotBelegImport.bilder(opts.datei).then(zeige, function () { zeige(null); });
    } else zeige(null);
    return ov;
  }

  /* tax.js, beleg-import.js und object-actions.js laden vor dieser Datei; sicherheitshalber auch später */
  einhaengen();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', einhaengen); else setTimeout(einhaengen, 0);

  window.DpEingang = { VERSION: 'v3154', oeffnen: oeffnen, istRechnung: istRechnung, belegeAuslesen: belegeAuslesen,
    einheiten: einheiten, mvVorschlag: mvVorschlag, mvOptionen: mvOptionen, mvText: mvText, mvUebernehmen: mvUebernehmen,
    jahrStand: jahrStand, protokoll: protokoll, verlaufHtml: verlaufHtml, lesen: lesen,
    /* v3154 */ txStart: txStart, txEnde: txEnde, feldStand: feldStand, feldGeaendert: feldGeaendert,
    zuruecknehmen: zuruecknehmen, eintragLoeschen: eintragLoeschen, knopf: knopf, vorschau: vorschau };
})();
