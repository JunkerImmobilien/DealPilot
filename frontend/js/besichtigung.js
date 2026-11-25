/* js/besichtigung.js — v5020 · Checkliste für die Besichtigung (Pilot-Analyse, Ankauf, Reiter Kaufpreis & Offerte)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Marcel 25.11.2026: „kann man in der Pilot-Analyse im Ankauf auch bei der Offerte für die Besichtigung Punkte
 * angeben, eine Art Checkliste, die wichtig wären anzuschauen? Gibt es da was, was man für gewisse Baujahre
 * macht? Und kann man das auch aus den Unterlagen und Informationen auswerten, die wir haben?"
 *
 * Drei Quellen, jeder Punkt nennt seine Herkunft:
 *   1. allgemein und nach Baualtersklasse (typische Schwachstellen, allgemein bekannte Bauweisen und Stoffe)
 *   2. nach Objektart (ETW: Gemeinschaft und Unterlagen der WEG, Haus: Grundstück, Mehrfamilienhaus: Mieter)
 *   3. aus diesem Objekt: Objektdaten (Baujahr, Energieklasse, Zustand, Modernisierung laut Exposé),
 *      das Feld „Bekannte Risiken", die Auswertung der Unterlagen (Risiken, Beschlüsse, Sonderumlagen)
 *
 * RECHNET NICHTS und schreibt kein Rechenfeld. Gemerkt wird nur Haken und Notiz je Punkt im versteckten Feld
 * #_besichtigung (JSON, mit dem Objekt gespeichert, storage.js Feldliste und Rücksetzliste).
 * Hinweise, keine Gutachteraussage. Kundentext ohne Gedankenstriche, ohne Semikolons, ohne Quellennamen.
 */
(function () {
  'use strict';
  if (window.DpBesichtigung) return;
  var g = window;
  var JAHR = new Date().getFullYear();

  function el(id) { return document.getElementById(id); }
  function val(id) { var e = el(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function zahl(v) { if (v == null || v === '') return null; var n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kurz(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + ' …'; }
  function idAus(t) { var h = 0, s = String(t || ''); for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return 'u' + (h >>> 0).toString(36); }

  /* ── Gedächtnis ─────────────────────────────────────────────────────────── */
  function laden() { try { var o = JSON.parse(val('_besichtigung') || 'null'); return o && typeof o === 'object' ? o : { haken: {}, notiz: {} }; } catch (e) { return { haken: {}, notiz: {} }; } }
  function merken(o) {
    var f = el('_besichtigung'); if (!f) return;
    o.stand = new Date().toISOString().slice(0, 10);
    f.value = JSON.stringify(o);
    try { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  /* ── 1 · Allgemein und Baualtersklasse ─────────────────────────────────── */
  var ALLGEMEIN = [
    ['feuchte', 'Feuchtigkeit im Keller und am Sockel', 'Auf muffigen Geruch, Salzausblühungen, abplatzenden Putz und Stockflecken achten. Feuchte Wände sind teuer und kommen selten allein.', 1],
    ['dach', 'Dach, Rinnen und Schornstein von außen', 'Verrutschte oder gebrochene Ziegel, durchhängende Dachfläche, undichte Rinnen und Fallrohre. Wenn möglich einen Blick auf den Dachboden werfen.'],
    ['risse', 'Risse in Fassade, Wänden und Decken', 'Haarrisse im Putz sind meist harmlos. Breite oder schräge Risse, besonders an Fenster- und Türecken, deuten auf Setzungen hin.'],
    ['fenster', 'Fenster und Türen', 'Verglasung, Dichtungen, Beschläge und Rahmen prüfen. Beschlagene Scheiben zwischen den Gläsern heißen: Isolierglas defekt.'],
    ['heizung', 'Heizung: Typenschild und Wartung', 'Baujahr vom Typenschild notieren, letzte Wartung und Schornsteinfegerprotokoll zeigen lassen.'],
    ['elektrik', 'Elektrik und Sicherungskasten', 'Schraub- oder Automatensicherungen, Fehlerstromschutzschalter vorhanden, Steckdosen mit Schutzkontakt.'],
    ['wasser', 'Wasser und Abwasser', 'Wasserdruck, Abfluss in Bad und Küche, Material der sichtbaren Leitungen, Rostspuren am Warmwasser.'],
    ['bad', 'Bäder und Küche', 'Fugen und Silikon, lose Fliesen, Feuchte hinter Wanne und Dusche, Lüftung ohne Fenster.'],
    ['energieausweis', 'Energieausweis vorlegen lassen', 'Er muss spätestens bei der Besichtigung vorliegen. Energieklasse, Baujahr der Heizung und empfohlene Maßnahmen ablesen.', 1]
  ];
  function klassen(bj) {
    var k = [];
    if (bj == null) return k;
    if (bj < 1950) k.push(['Baujahr vor 1950', [
      ['holzbalken', 'Holzbalkendecken', 'Durchbiegen, Knarzen und Feuchte an den Balkenköpfen in den Außenwänden. Bei Verdacht auf Holzschädlinge genauer ansehen lassen.'],
      ['sperre', 'Aufsteigende Feuchte', 'Ältere Häuser haben oft keine wirksame Horizontalsperre. Sockelbereich innen und außen prüfen.'],
      ['altleitung', 'Elektrik aus der Bauzeit', 'Zweiadrige Leitungen ohne Schutzleiter und Stoffkabel sollten ersetzt werden. Das ist ein großer Kostenpunkt.'],
      ['denkmal', 'Denkmalschutz', 'Fragen, ob das Haus oder das Ensemble unter Denkmalschutz steht. Das bestimmt, was du ändern darfst, und kann Steuervorteile bringen.']]]);
    if (bj >= 1950 && bj <= 1973) k.push(['Baujahr 1950 bis 1973', [
      ['blei', 'Trinkwasserleitungen aus Blei', 'In Häusern bis etwa 1973 sind Bleirohre möglich. Sie dürfen nicht mehr betrieben werden. Leitungen im Keller am Hausanschluss ansehen: Blei ist grau, weich und hat keine Gewinde.'],
      ['daemmung', 'Kaum Wärmedämmung', 'Fassade, oberste Geschossdecke und Kellerdecke sind oft ungedämmt. Das treibt Heizkosten und Sanierungsbedarf.']]]);
    if (bj >= 1950 && bj <= 1993) k.push(['Baujahr 1950 bis 1993', [
      ['asbest', 'Asbest', 'Bis 1993 verbaut, etwa in Bodenplatten (Floor-Flex) mit schwarzem Kleber, Faserzementplatten an Fassade und Dach sowie in Nachtspeicheröfen. Nicht anbohren, im Zweifel untersuchen lassen.']]]);
    if (bj >= 1955 && bj <= 1980) k.push(['Baujahr 1955 bis 1980', [
      ['pcb', 'Schadstoffe in Fugen und Klebern', 'Dauerelastische Fugen können PCB enthalten, schwarze Parkettkleber PAK. Bei Sanierung fällt dann Entsorgung an.'],
      ['formaldehyd', 'Spanplatten und Formaldehyd', 'Spanplatten in Decken, Wänden und Einbauten der 1960er und 1970er Jahre können ausdünsten. Auf stechenden Geruch achten.']]]);
    if (bj >= 1960 && bj <= 1990) k.push(['Baujahr 1960 bis 1990', [
      ['flachdach', 'Flachdach und Balkone', 'Flachdächer der Zeit sind häufig am Ende ihrer Abdichtung. Balkonplatten auf Abplatzungen und rostende Bewehrung prüfen.'],
      ['isoglas', 'Fenster der ersten Isolierglas-Generation', 'Holz- und Kunststofffenster der Zeit sind oft verbraucht. Austausch ist ein typischer Posten.']]]);
    if (bj >= 1990 && bj <= 2010) k.push(['Baujahr 1990 bis 2010', [
      ['wdvs', 'Wärmedämmverbundsystem der Fassade', 'Risse, Algen und Spechtlöcher in gedämmten Fassaden kosten bei Reparatur schnell viel. Sockel und Fensteranschlüsse ansehen.'],
      ['lueftung', 'Lüftung und Schimmel', 'Dichtere Hüllen brauchen regelmäßiges Lüften. Ecken hinter Schränken und an Außenwänden auf Schimmel prüfen.']]]);
    if (bj > 2010) k.push(['Baujahr nach 2010', [
      ['gewaehr', 'Gewährleistung und Abnahme', 'Abnahmeprotokoll und offene Mängel zeigen lassen. Ansprüche aus dem Bau verjähren in der Regel fünf Jahre nach Abnahme.'],
      ['lueftkonz', 'Lüftungskonzept und Wärmepumpe', 'Lüftungsanlage und Filterwechsel, bei Wärmepumpen Wartung und Stromverbrauch der letzten Jahre zeigen lassen.']]]);
    return k;
  }
  /* ── 2 · Objektart ─────────────────────────────────────────────────────── */
  function nachArt(art) {
    if (art === 'ETW') return ['Eigentumswohnung', [
      ['weg-prot', 'Protokolle der letzten drei Eigentümerversammlungen', 'Beschlossene oder vertagte Sanierungen, Streit in der Gemeinschaft, Rechtsstreitigkeiten.', 1],
      ['weg-ruecklage', 'Erhaltungsrücklage und Hausgeld', 'Höhe der Rücklage im Verhältnis zum Zustand des Hauses. Wirtschaftsplan und letzte Abrechnung zeigen lassen.'],
      ['weg-su', 'Sonderumlagen', 'Sind Sonderumlagen beschlossen oder angekündigt? Bis zum Übergang trägt sie der Verkäufer, später du.', 1],
      ['weg-te', 'Teilungserklärung', 'Was gehört zu deiner Wohnung: Keller, Stellplatz, Sondernutzungsrechte an Garten oder Terrasse.'],
      ['weg-ge', 'Gemeinschaftseigentum ansehen', 'Treppenhaus, Keller, Heizungsraum, Dach und Fassade. Ihr Zustand landet über Umlagen auch bei dir.']]];
    if (art === 'MFH' || art === 'ZFH') return [art === 'MFH' ? 'Mehrfamilienhaus' : 'Zweifamilienhaus', [
      ['mfh-alle', 'Alle Wohnungen ansehen', 'Nicht nur die leere Musterwohnung. Zustand je Einheit notieren, er bestimmt Mietpotenzial und Kosten.', 1],
      ['mfh-mieter', 'Mieterliste und Mietverträge', 'Ist-Mieten, letzte Erhöhung, Kautionen, Rückstände und Kündigungen mit den Verträgen abgleichen.', 1],
      ['mfh-technik', 'Heizungsraum, Zähler und Hausanschlüsse', 'Zählerstände notieren, Heizung und Warmwasser für das ganze Haus ansehen.'],
      ['mfh-brand', 'Rauchmelder und Brandschutz', 'Rauchmelder in Schlafräumen und Fluren sind Pflicht. Treppenhaus frei von Lasten.']]];
    if (art === 'EFH' || art === 'DHH' || art === 'RH') return ['Haus', [
      ['haus-grund', 'Grundstück und Grenzen', 'Grenzverlauf, Zufahrt, Zustand von Garten, Zaun und Nebengebäuden.'],
      ['haus-baulast', 'Baulasten und Leitungsrechte', 'Fragen, ob Baulasten oder Rechte Dritter eingetragen sind. Das Baulastenverzeichnis führt die Gemeinde.']]];
    return null;
  }

  /* ── 3 · Aus diesem Objekt ─────────────────────────────────────────────── */
  function ausObjekt() {
    var p = [], bj = zahl(val('baujahr'));
    /* Heizung: Jahr aus dem Exposé (Modernisierung laut Text), sonst Punkte der Anlage 2 */
    var heizJahr = null, heizBeleg = '';
    try {
      var r = JSON.parse(val('mod_ableitung') || 'null'), t = r && r.roh && Array.isArray(r.roh.text) ? r.roh.text : [];
      t.forEach(function (x) { if (x && x.gewerk === 'heizung' && x.jahr && x.richtung !== 'negativ' && (!heizJahr || x.jahr > heizJahr)) { heizJahr = +x.jahr; heizBeleg = x.zitat || ''; } });
    } catch (e) {}
    var modH = zahl(val('mod_heizung'));
    if (heizJahr && JAHR - heizJahr >= 28) p.push({ id: 'o-heiz-j', prio: 1, titel: 'Heizung von ' + heizJahr + ': Austauschpflicht prüfen',
      text: 'Öl- und Gaskessel, die älter als 30 Jahre sind, müssen in vielen Fällen ersetzt werden. Ausgenommen sind Brennwert- und Niedertemperaturkessel. Typenschild ansehen.',
      herkunft: 'Exposé' + (heizBeleg ? ': „' + kurz(heizBeleg, 70) + '“' : '') });
    /* Energieklasse A+ bis C spricht gegen einen Kessel aus der Bauzeit (gemessen Westerfeldstr. 140: Bj 1967, Klasse B) */
    else if (!heizJahr && bj && JAHR - bj >= 30 && (modH == null || modH === 0) && !/^(A+?|B|C)$/.test(val('ds2_energie').toUpperCase())) p.push({ id: 'o-heiz-bj', prio: 1, titel: 'Heizung womöglich aus dem Baujahr ' + bj,
      text: 'Ohne Angabe zur Modernisierung kann die Heizung über 30 Jahre alt sein. Dann gilt oft eine Austauschpflicht. Baujahr vom Typenschild notieren.',
      herkunft: 'Objektdaten: Baujahr, keine Heizungsmodernisierung eingetragen' });
    var ek = val('ds2_energie').toUpperCase();
    if (/^[FGH]$/.test(ek)) p.push({ id: 'o-ek', prio: 1, titel: 'Energieklasse ' + ek + ': Sanierungsbedarf genau ansehen',
      text: 'Dämmung, Fenster und Heizung sind die großen Hebel. Empfehlungen im Energieausweis lesen und Kosten grob schätzen lassen.', herkunft: 'Objektdaten: Energieklasse' });
    else if (!ek) p.push({ id: 'o-ek-fehlt', prio: 0, titel: 'Energieklasse fehlt noch', text: 'Den Energieausweis bei der Besichtigung abfotografieren und die Klasse im Reiter Objekt eintragen.', herkunft: 'Objektdaten: Energieklasse leer' });
    var zu = val('ds2_zustand');
    if (zu === 'renovierungsbeduerftig' || zu === 'stark_sanierungsbeduerftig') p.push({ id: 'o-zustand', prio: 1,
      titel: (zu === 'stark_sanierungsbeduerftig' ? 'Stark sanierungsbedürftig' : 'Renovierungsbedürftig') + ': Umfang festhalten',
      text: 'Je Raum notieren, was gemacht werden muss. Fotos helfen später beim Angebot von Handwerkern und bei der Verhandlung.', herkunft: 'Objektdaten: Zustand' });
    try {
      var r2 = JSON.parse(val('mod_ableitung') || 'null');
      (r2 && Array.isArray(r2.widersprueche) ? r2.widersprueche : []).slice(0, 3).forEach(function (w) {
        p.push({ id: idAus('w' + w), prio: 1, titel: kurz(w, 90), text: 'Exposé und Fotos passen hier nicht zusammen. Vor Ort klären, was stimmt.', herkunft: 'Exposé und Fotos' });
      });
    } catch (e) {}
    /* Feld „Bekannte Risiken" (Reiter Objekt) */
    val('risiken').split(/\n+|(?:^|\s)[•·]\s+/).map(function (s) { return s.replace(/^[\s\-*•·–—]+/, '').trim(); }).filter(function (s) { return s.length > 6; }).slice(0, 6).forEach(function (s) {
      p.push({ id: idAus('r' + s), prio: 1, titel: kurz(s, 110), text: '', herkunft: 'Bekannte Risiken im Reiter Objekt' });
    });
    return p;
  }
  function ausUnterlagen() {
    var p = [], H = g.DpHausverlauf;
    if (!H || typeof H.lesen !== 'function') return p;
    var L = null; try { L = H.lesen(); } catch (e) { L = null; }
    if (!L) return p;
    var push = function (x) { p.push(x); };
    /* Risiken der Auswertung (ohne die entfernter Unterlagen), hoch zuerst */
    var R = []; try { R = H.risikenAktiv ? H.risikenAktiv(L.d) : []; } catch (e) { R = []; }
    R.filter(function (x) { return x && String(x.schwere || 'mittel').toLowerCase() !== 'niedrig'; })
      .sort(function (a, b) { return (String(a.schwere) === 'hoch' ? 0 : 1) - (String(b.schwere) === 'hoch' ? 0 : 1); })
      .slice(0, 8).forEach(function (x) {
        var t = x.titel || x.text; if (!t) return;
        push({ id: idAus('k' + t), prio: 1, titel: (x.jahr ? String(x.jahr).slice(0, 4) + ': ' : '') + kurz(t, 100), text: x.titel && x.text ? kurz(x.text, 220) : 'Vor Ort ansehen und nachfragen, was seitdem passiert ist.',
          herkunft: 'Unterlagen' + (x.quelle || x.fundstelle ? ': ' + kurz(x.quelle || x.fundstelle, 70) : '') });
      });
    /* Beschlüsse, Sonderumlagen, Schäden, Streit der letzten fünf Jahre */
    (L.liste || []).filter(function (e) { return e && /^(sonderumlage|instandhaltung|schaden|rechtsstreit)$/.test(e.art) && (!e.jahr || e.jahr >= JAHR - 5); })
      .slice(-8).reverse().forEach(function (e) {
        var art = { sonderumlage: 'Sonderumlage', instandhaltung: 'Maßnahme', schaden: 'Schaden', rechtsstreit: 'Rechtsstreit' }[e.art];
        push({ id: idAus('e' + e.titel + e.jahr), prio: 1, titel: (e.jahr ? e.jahr + ' ' : '') + art + ': ' + kurz(e.titel || e.text, 90),
          text: (e.text && e.text !== e.titel ? kurz(e.text, 200) + ' ' : '') + (e.status ? 'Stand: ' + e.status + '. ' : '') + 'Bei der Besichtigung ansehen, ob und wie es umgesetzt ist.',
          herkunft: 'Unterlagen' + (e.quelle ? ': ' + kurz(e.quelle, 70) : '') });
      });
    return p;
  }

  var THEMEN = [/dach/, /fassade|anstrich/, /feucht|keller|lichtschacht|schimmel/, /heiz|w(ä|ae)rmepumpe|kessel/, /fenster/, /sonderumlage/, /leerstand/, /miete/, /energie/, /elektr/, /leitung|wasser|abwasser/, /aufzug/, /balkon/, /streit|\bklage|gericht/, /asbest|schadstoff/];
  function themen(t) { t = String(t || '').toLowerCase(); var r = []; THEMEN.forEach(function (re, i) { if (re.test(t)) r.push('t' + i); }); return r; }
  /** Alle Gruppen: [{titel, quelle:'objekt'|'art'|'allgemein'|'baujahr', punkte:[{id,titel,text,herkunft,prio}]}] */
  function gruppen() {
    var G = [], bj = zahl(val('baujahr')), art = val('objart');
    /* v5020 · gemessen Lindenallee 14: 21 Punkte, fünf davon dasselbe Flachdach (Risiko, Sonderumlage, Beschluss, Maßnahme, dazu
       das Feld Bekannte Risiken, das aus denselben Protokollen gefüllt wurde). Ein Punkt fällt, wenn alle seine Themen schon
       vorkommen. Unterlagen vor Objektdaten vor eigenem Feld, höchstens zehn. */
    var gesehen = {}, obj = [];
    ausUnterlagen().concat(ausObjekt()).forEach(function (x) {
      var t = themen(x.titel); if (obj.length >= 10) return;
      if (t.length && t.every(function (k) { return gesehen[k]; })) return;
      if (!t.length) { var k0 = String(x.titel).toLowerCase().slice(0, 40); if (gesehen[k0]) return; gesehen[k0] = 1; }
      t.forEach(function (k) { gesehen[k] = 1; }); obj.push(x);
    });
    if (obj.length) G.push({ titel: 'Aus deinen Unterlagen und Angaben', art: 'objekt', punkte: obj });
    var na = nachArt(art);
    if (na) G.push({ titel: na[0], art: 'art', punkte: na[1].map(function (x) { return { id: x[0], titel: x[1], text: x[2], herkunft: 'typisch für ' + na[0], prio: x[3] ? 1 : 0 }; }) });
    /* eine Gruppe je Baujahr, jeder Punkt nennt seine Baualtersklasse */
    var kl = []; klassen(bj).forEach(function (k) { k[1].forEach(function (x) { kl.push({ id: x[0], titel: x[1], text: x[2], herkunft: 'typisch für ' + k[0].replace(/^Baujahr /, 'Häuser mit Baujahr '), prio: 1 }); }); });
    if (kl.length) G.push({ titel: 'Typisch für Baujahr ' + bj, art: 'baujahr', punkte: kl });
    G.push({ titel: 'Bei jeder Besichtigung', art: 'allgemein', punkte: ALLGEMEIN.map(function (x) { return { id: x[0], titel: x[1], text: x[2], herkunft: '', prio: x[3] ? 1 : 0 }; }) });
    return G;
  }

  /* ── Anzeige ───────────────────────────────────────────────────────────── */
  function zaehlen(G, M) {
    var n = 0, h = 0, w = 0, wh = 0;
    G.forEach(function (gr) { gr.punkte.forEach(function (x) { n++; if (M.haken[x.id]) h++; if (x.prio) { w++; if (M.haken[x.id]) wh++; } }); });
    return { n: n, h: h, w: w, wh: wh };
  }
  function kopfText(z) { return z.h + ' von ' + z.n + ' angesehen' + (z.w ? ' · ' + z.wh + ' von ' + z.w + ' wichtigen' : ''); }
  function html() {
    var G = gruppen(), M = laden(); M.haken = M.haken || {}; M.notiz = M.notiz || {};
    var z = zaehlen(G, M);
    var punkt = function (x) {
      var an = !!M.haken[x.id], no = M.notiz[x.id] || '';
      return '<li class="dp-bs-p' + (x.prio ? ' wichtig' : ' dp-pa-d') + (an ? ' an' : '') + (no ? ' mitnotiz' : '') + '" data-dp-bs-id="' + esc(x.id) + '">'
        + '<label class="dp-bs-z"><input type="checkbox"' + (an ? ' checked' : '') + ' data-dp-bs-haken="' + esc(x.id) + '"><span class="dp-bs-t">' + esc(x.titel) + '</span></label>'
        + (x.herkunft ? '<span class="dp-bs-h">' + esc(x.herkunft) + '</span>' : '')
        + (x.text ? '<p class="dp-bs-x dp-pa-d">' + esc(x.text) + '</p>' : '')
        + '<button type="button" class="btn-clean dp-bs-nk" data-dp-bs-notizauf="' + esc(x.id) + '">' + (no ? 'Notiz' : '+ Notiz') + '</button>'
        + '<textarea class="dp-bs-n" rows="2" placeholder="Notiz zur Besichtigung" data-dp-bs-notiz="' + esc(x.id) + '">' + esc(no) + '</textarea></li>';
    };
    var body = G.map(function (gr) {
      var nurD = gr.punkte.every(function (x) { return !x.prio; });
      return '<div class="dp-bs-g' + (nurD ? ' dp-pa-d' : '') + '"><h5>' + esc(gr.titel) + '</h5><ul class="dp-bs-l">' + gr.punkte.map(punkt).join('') + '</ul></div>';
    }).join('');
    return '<div class="dp-bs" data-dp-bs="1">'
      + '<div class="dp-bs-kopf"><div><h4>Besichtigung · worauf du achten solltest</h4><span class="dp-bs-stand" data-dp-bs-stand="1">' + esc(kopfText(z)) + '</span></div>'
      + '<button type="button" class="btn-clean dp-bs-druck" data-dp-bs-druck="1">Drucken</button></div>'
      + '<p class="dp-bs-intro dp-pa-e">Die wichtigsten Punkte für dieses Objekt. Alle Punkte mit Erklärung unter Detail.</p>'
      + '<p class="dp-bs-intro dp-pa-d">Abhaken, was du dir angesehen hast, und Notizen festhalten. Alles wird mit dem Objekt gespeichert. Die Punkte sind Hinweise und ersetzen kein Gutachten.</p>'
      + body + '</div>';
  }
  function standNeu(root) {
    try {
      var G = gruppen(), M = laden(); M.haken = M.haken || {};
      var s = (root || document).querySelector('[data-dp-bs-stand]'); if (s) s.textContent = kopfText(zaehlen(G, M));
    } catch (e) {}
  }

  /* ── Bedienung: eine Stelle für alle Zeichnungen der Pilot-Analyse ─────── */
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute) return;
    var id = t.getAttribute('data-dp-bs-haken'); if (!id) return;
    var M = laden(); M.haken = M.haken || {}; M.notiz = M.notiz || {};
    if (t.checked) M.haken[id] = 1; else delete M.haken[id];
    merken(M);
    var li = t.closest('.dp-bs-p'); if (li) li.classList.toggle('an', !!t.checked);
    standNeu(t.closest('.dp-bs'));
  });
  var _nt = null;
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute) return;
    var id = t.getAttribute('data-dp-bs-notiz'); if (!id) return;
    clearTimeout(_nt);
    _nt = setTimeout(function () {
      var M = laden(); M.haken = M.haken || {}; M.notiz = M.notiz || {};
      var v = String(t.value || '').trim(); if (v) M.notiz[id] = v.slice(0, 600); else delete M.notiz[id];
      merken(M);
    }, 500);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var a = t.closest('[data-dp-bs-notizauf]');
    if (a) { var li = a.closest('.dp-bs-p'); if (li) { li.classList.add('notizauf'); var ta = li.querySelector('textarea'); if (ta) ta.focus(); } return; }
    if (t.closest('[data-dp-bs-druck]')) drucken();
  });

  /* ── Drucken: eigene, schlichte Seite (auch am Handy als PDF sichern) ──── */
  function drucken() {
    var G = gruppen(), M = laden(); M.haken = M.haken || {}; M.notiz = M.notiz || {};
    var adr = [val('str') + ' ' + val('hnr'), (val('plz') + ' ' + val('ort')).trim()].filter(function (s) { return s.trim(); }).join(', ');
    var h = '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Besichtigung ' + esc(adr) + '</title><style>'
      + 'body{font:13px/1.45 Inter,Arial,sans-serif;color:#2A2727;margin:24px}h1{font:600 18px Arial,sans-serif;margin:0 0 4px}'
      + '.u{color:#7A7370;margin:0 0 16px}h2{font:600 12px Arial,sans-serif;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 6px;color:#6B645A}'
      + 'li{list-style:none;margin:0 0 8px;padding-left:24px;position:relative;page-break-inside:avoid}li::before{content:"";position:absolute;left:0;top:2px;width:12px;height:12px;border:1.5px solid #2A2727;border-radius:2px}'
      + 'li.an::before{background:#2A2727}ul{padding:0;margin:0}b{font-weight:600}small{color:#7A7370;display:block}.n{border-bottom:1px solid #ccc;min-height:18px;margin-top:4px}'
      + '</style></head><body><h1>Besichtigung</h1><p class="u">' + esc(adr || 'Objekt') + ' · Stand ' + new Date().toLocaleDateString('de-DE') + '</p>'
      + G.map(function (gr) {
        return '<h2>' + esc(gr.titel) + '</h2><ul>' + gr.punkte.map(function (x) {
          return '<li class="' + (M.haken[x.id] ? 'an' : '') + '"><b>' + esc(x.titel) + '</b>' + (x.herkunft ? '<small>' + esc(x.herkunft) + '</small>' : '')
            + (M.notiz[x.id] ? '<div>' + esc(M.notiz[x.id]) + '</div>' : '<div class="n"></div>') + '</li>';
        }).join('') + '</ul>';
      }).join('') + '<p class="u" style="margin-top:20px">Hinweise zur Besichtigung, kein Gutachten.</p></body></html>';
    var w = null; try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (!w) { try { if (typeof toast === 'function') toast('Bitte Pop-ups für DealPilot erlauben, dann erneut drucken.'); } catch (e) {} return; }
    w.document.open(); w.document.write(h); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400);
  }

  /* ── Stil: Karte wie Kachel A, Gold nur als Akzent über Whitelabel-Token ─ */
  (function stil() {
    if (document.getElementById('dp-bs-stil')) return;
    var G = 'var(--gold,var(--wl-c9a84c,#C9A84C))';
    var s = document.createElement('style'); s.id = 'dp-bs-stil';
    s.textContent = [
      '.dp-bs{margin:18px 0 6px;padding:14px 16px;background:var(--card,#FFFFFF);border:1px solid var(--line,#E6E0D3);border-radius:12px}',
      '.dp-bs-kopf{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}',
      '.dp-bs-kopf h4{margin:0;font:600 15px/1.3 "Space Grotesk",Inter,system-ui,sans-serif;color:#2A2727}',
      '.dp-bs-stand{display:block;margin-top:3px;font:500 10.5px/1.3 Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B645A}',
      '.dp-bs .dp-bs-druck{flex:0 0 auto;padding:7px 14px !important;border:1px solid var(--line,#E6E0D3) !important;border-radius:8px !important;background:#fff !important;color:#2A2727 !important;font:600 12.5px Inter,system-ui,sans-serif !important;cursor:pointer;min-height:0 !important}',
      '.dp-bs-intro{margin:8px 0 4px;font:400 12px/1.45 Inter,system-ui,sans-serif;color:#6B645A}',
      '.dp-bs-g h5{margin:14px 0 6px;font:500 10.5px/1.3 Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B645A}',
      '.dp-bs .dp-bs-l{list-style:none !important;margin:0 !important;padding:0 !important;display:grid;gap:8px}',
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-bs .dp-pa-d,.dp-pa-wrap[data-dp-pa-modus="detail"] .dp-bs .dp-pa-e{display:none !important}',
      '@media (min-width:1100px){.dp-bs-l{grid-template-columns:repeat(auto-fill,minmax(380px,1fr))}}',
      '.dp-bs .dp-bs-p{margin:0 !important;list-style:none !important;}.dp-bs .dp-bs-p::before,.dp-bs .dp-bs-p::marker{content:none !important}.dp-bs-p{position:relative;padding:9px 10px 9px 12px;border:1px solid var(--line,#E6E0D3);border-radius:10px;background:var(--surface,#FDFCFA)}',
      '.dp-bs-p.wichtig{border-left:3px solid ' + G + '}',
      '.dp-bs-p.an{opacity:.62}.dp-bs-p.an .dp-bs-t{text-decoration:line-through}',
      '.dp-bs-z{display:flex;align-items:flex-start;gap:10px;cursor:pointer;min-height:24px}',
      '.dp-bs-z input{flex:0 0 auto;width:20px;height:20px;margin:1px 0 0;accent-color:#2A2727;cursor:pointer}',
      '.dp-bs-t{font:500 13.5px/1.4 Inter,system-ui,sans-serif;color:#2A2727;min-width:0;overflow-wrap:anywhere}',
      '.dp-bs-h{display:block;margin:3px 0 0 30px;font:400 11px/1.35 Inter,system-ui,sans-serif;color:#7A7370;overflow-wrap:anywhere}',
      '.dp-bs-x{margin:5px 0 0 30px;font:400 12.5px/1.45 Inter,system-ui,sans-serif;color:#4A4540}',
      '.dp-bs .dp-bs-nk{min-height:0 !important;width:auto !important;text-align:left !important;line-height:1.3 !important}.dp-bs-nk{display:inline-block;margin:5px 0 0 30px;padding:2px 0;border:0 !important;background:none !important;box-shadow:none !important;cursor:pointer;font:500 11.5px Inter,system-ui,sans-serif;color:#6B645A;text-decoration:underline;text-underline-offset:2px}',
      '.dp-bs-n{display:none;box-sizing:border-box;width:calc(100% - 30px);margin:6px 0 0 30px;padding:7px 9px;font:400 13px/1.4 Inter,system-ui,sans-serif;border:1px solid var(--line,#E6E0D3);border-radius:8px;background:#fff;color:#2A2727;resize:vertical}',
      '.dp-bs-p.mitnotiz .dp-bs-n,.dp-bs-p.notizauf .dp-bs-n{display:block}.dp-bs-p.mitnotiz .dp-bs-nk,.dp-bs-p.notizauf .dp-bs-nk{display:none}',
      '@media (max-width:640px){.dp-bs{padding:12px}.dp-bs-z input{width:22px;height:22px}.dp-bs-t{font-size:14px}}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  })();

  g.DpBesichtigung = { VERSION: 'v5020', html: html, gruppen: gruppen, laden: laden, drucken: drucken };
})();
