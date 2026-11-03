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
     /ust\.?-?\s*id|steuer-?nr|umsatzsteuer|mwst|mehrwertsteuer|19\s*%/i, /grundsteuerbescheid|beitragsrechnung|versicherungsschein/i].forEach(function (r) { if (r.test(t)) treffer++; });
    if (/rechnung|quittung|beleg|invoice/i.test(n)) treffer++;
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
    return t.join(' · ');
  }
  /** Übernimmt einen Mietvertrag in die gewählte Einheit. Überschreibt Miete und Vertragsdaten (neuer
      Vertrag gilt), Fläche/Zimmer nur, wenn leer. Gesamtmiete wie „Einheiten erfassen" (DpMfhEinheiten._summe). */
  function mvUebernehmen(i, ext, quelle) {
    var E = einheiten(); if (!E || !E[i] || !ext) return false;
    var e = E[i], alt = JSON.parse(JSON.stringify(e)), heute = new Date().toISOString().slice(0, 10);
    var setz = function (k, v) { if (v !== null && v !== undefined && v !== '') e[k] = String(v); };
    /* v3120a · ein NEUER Vertrag (anderer Mietbeginn) ersetzt den alten ganz - gemessen: Whg. 1 behielt
       „nächste Anpassung 01.04.2027" des alten Staffelvertrags, obwohl der neue unbefristet ist. Der Name
       des Mieters wird nie ausgelesen (Datenschutz); beim neuen Vertrag wird der alte geleert. */
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
    if (Array.isArray(ext.staffeln)) {
      var naechste = ext.staffeln.map(function (s) { return isoAus(s && s.ab); }).filter(function (d) { return d && d > heute; }).sort()[0];
      setz('mv_naechste_anpassung', naechste);
    }
    if (!zahl(e.wfl)) setz('wfl', zahl(ext.wohnflaeche_m2));
    if (!zahl(e.zimmer)) setz('zimmer', zahl(ext.zimmer));
    /* Gesamtmiete des Objekts nachziehen - dieselbe Summe wie „Einheiten erfassen" */
    try {
      var M = window.DpMfhEinheiten, s = M && M._summe ? M._summe(E) : null, nk = el('nkm');
      if (s && s.ist > 0 && nk) { nk.value = String(Math.round(s.ist * 100) / 100).replace('.', ','); nk.dispatchEvent(new Event('input', { bubbles: true })); }
    } catch (x) {}
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
  function einhaengen() {
    if (typeof window._setYearOverride === 'function' && !window._setYearOverride._dpEingang) {
      var orig = window._setYearOverride;
      var neu = function (year, field, value) { var r = orig.apply(this, arguments); try { herkunftSetzen(year, field, value); } catch (e) {} return r; };
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
    o.verlauf = o.verlauf.concat([{ am: new Date().toISOString(), dokumente: (e.dokumente || []).slice(0, 30), uebernommen: (e.uebernommen || []).slice(0, 60) }]).slice(-50);
    schreiben(o);
    /* v3120a · gemessen: der Reiter Unterlagen & WEG zeigte den Verlauf erst nach dem nächsten Zeichnen */
    setTimeout(function () { try { if (typeof window._dpPaNeuZeichnen === 'function') window._dpPaNeuZeichnen(); } catch (x) {} }, 300);
  }
  function verlaufHtml() {
    var o = lesen(), v = o.verlauf.slice().reverse(), ae = (o.einheiten_aenderungen || []).slice().reverse();
    if (!v.length && !ae.length) return '';
    var datum = function (s) { try { return new Date(s).toLocaleDateString('de-DE'); } catch (x) { return ''; } };
    var h = '<div style="overflow-x:auto"><table class="abw-tafel" style="min-width:520px"><thead><tr><th>Eingelesen</th><th>Unterlagen</th><th>Übernommen</th></tr></thead><tbody>'
      + v.map(function (x) {
        return '<tr><td class="abw-wort" style="white-space:nowrap">' + esc(datum(x.am)) + '</td><td>' + x.dokumente.map(function (d) { return esc((d.typ ? d.typ + ': ' : '') + d.name); }).join('<br>') + '</td>'
          + '<td>' + (x.uebernommen.length ? x.uebernommen.map(esc).join('<br>') : '<i>nichts übernommen</i>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (ae.length) h += '<p class="dp-pa-p" style="margin-top:10px"><b>Mietverträge den Einheiten zugeordnet:</b> ' + ae.map(function (a) { return esc(a.einheit) + ' (' + esc(datum(a.am)) + ', vorher ' + (a.vorher.ist ? esc(a.vorher.ist) + ' €' : '–') + ')'; }).join(' · ') + '</p>';
    return h;
  }

  /* tax.js, beleg-import.js und object-actions.js laden vor dieser Datei; sicherheitshalber auch später */
  einhaengen();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', einhaengen); else setTimeout(einhaengen, 0);

  window.DpEingang = { VERSION: 'v3120', oeffnen: oeffnen, istRechnung: istRechnung, belegeAuslesen: belegeAuslesen,
    einheiten: einheiten, mvVorschlag: mvVorschlag, mvOptionen: mvOptionen, mvText: mvText, mvUebernehmen: mvUebernehmen,
    jahrStand: jahrStand, protokoll: protokoll, verlaufHtml: verlaufHtml, lesen: lesen };
})();
