/* haus-check-pdf.js · v5150pp6 · PDF „Haus-Check“ für Selbstnutzer
   Aufbau, Reihenfolge und Gestaltung wie das erste Muster (HH6, Dateien/Konzepte/Eigennutzer-Bericht-Muster/bericht.html),
   Marcel 26.11.2026: „Bitte den Bericht wie vorher auslegen, nur mit den extra Sachen.“ Echte Daten aus der Pipeline,
   dazu die neuen Teile: Markt am Ort (Angebote, Entwicklung, Marktpreisindikation), Nebenkosten einzeln mit Herkunft,
   Lage und Umfeld mit Karte und Tabelle, Zins und Tilgung, Förderung.
   RECHNET NICHTS SELBST (außer Darstellung):
     haus      Ergebnis von DpEigennutzerKern.kern(...)    gruppen  rechneDemo().gruppen (Leistbarkeit-Note)
     wert      Stufe-3-Wert aus dem Marktbericht            belw     indikativer Beleihungswert
     umfeld    Nähe-Kategorien                               karte    Kartenbild (data:-URL)
     lage, vmiete, amort (Marktdaten am Ort), stichtag, objekt { adresse, objektart, baujahr, wfl, gsfl, kaufpreis, ek, … }
   Datenschutz: das Netto-Einkommen verlässt den Browser nie. Die Fassung für den Druck auf dem Server kommt ohne Netto
   (quote null), dann steht hier, ab welchem Netto die Wohnkosten gut tragbar sind, gerechnet nur aus den Wohnkosten.
   „Verkehrswert“ steht NUR bei wert.vollstaendig. Kundentext ohne Gedankenstrich und Semikolon, keine Quellennamen im
   Fließtext, Lizenzvermerke nur im Kapitel Quellen. */
(function () {
  'use strict';
  var ARTNAME = { efh: 'Einfamilienhaus', zfh: 'Zweifamilienhaus', dhh: 'Doppelhaushälfte', rh: 'Reihenhaus', etw: 'Eigentumswohnung' };
  var CSS = [
    ':root{--gold:var(--wl-c9a84c,#C9A84C);--gold-d:var(--wl-b8932f,#b8932f);--ink:#1a1818;--mut:#6b6560;--linie:#e4ded2;--gruen:#3FA56C;--rot:#B8625C;--creme:#FBF6E9}',
    '@page{size:A4;margin:0}*{box-sizing:border-box}',
    'body{margin:0;background:#fff;font-family:Inter,Arial,sans-serif;color:var(--ink);font-size:10.5pt;line-height:1.45}',
    '.seite{width:210mm;height:297mm;margin:0 auto;background:#fff;position:relative;padding:16mm 17mm 20mm;overflow:hidden;page-break-after:always;break-after:page}',
    '.seite:last-child{page-break-after:auto;break-after:auto}',
    '.kopf{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.2px solid var(--ink);padding-bottom:5mm;margin-bottom:7mm}',
    '.kopf img{height:9mm;width:auto;display:block}.wort{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:15pt;letter-spacing:-.01em}',
    '.kopf .r{font-family:"JetBrains Mono",monospace;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;text-align:right;line-height:1.6}',
    '.fuss{position:absolute;left:17mm;right:17mm;bottom:9mm;display:flex;justify-content:space-between;font-size:7.5pt;color:var(--mut);border-top:.6px solid var(--linie);padding-top:2.5mm}',
    '.ober{font-family:"JetBrains Mono",monospace;font-size:7.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-d);margin:0 0 2mm}',
    'h1{font-family:"Space Grotesk",sans-serif;font-size:22pt;margin:0 0 2mm;letter-spacing:-.01em}',
    'h2{font-family:"Space Grotesk",sans-serif;font-size:17pt;margin:0 0 2mm}',
    'h3{font-family:"Space Grotesk",sans-serif;font-size:11.5pt;margin:6mm 0 2mm}',
    '.unter{color:var(--mut);margin:0 0 6mm}',
    'table{width:100%;border-collapse:collapse;font-size:9.5pt}',
    'th{font-family:"JetBrains Mono",monospace;font-weight:400;font-size:7pt;letter-spacing:.14em;text-transform:uppercase;text-align:left;color:var(--mut);border-bottom:1px solid var(--ink);padding:2mm 0}',
    'th.z,td.z{text-align:right}td{border-bottom:.6px solid var(--linie);padding:2.2mm 0;vertical-align:top}',
    'td small{display:block;color:var(--mut);font-size:7.8pt}td.z{font-family:"JetBrains Mono",monospace;white-space:nowrap;padding-left:4mm}',
    'tr.summe td{border-top:1px solid var(--ink);border-bottom:none;font-weight:600}',
    'table.eng td{padding:1.4mm 0}table.eng td small{font-size:7.2pt}',
    '.kacheln{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:5mm 0}',
    '.kachel{border:.8px solid var(--linie);border-top:2px solid var(--gold);padding:3mm}',
    '.kachel span{font-family:"JetBrains Mono",monospace;font-size:6.8pt;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);display:block}',
    '.kachel b{font-family:"Space Grotesk",sans-serif;font-size:15pt;display:block;margin:1.5mm 0 .5mm}.kachel small{font-size:7.5pt;color:var(--mut)}',
    '.karte{position:relative;height:92mm;margin:-16mm -17mm 8mm;overflow:hidden;background:#e9e6df}',
    '.karte img.bild{width:100%;height:100%;object-fit:cover;display:block}',
    '.karte .logo{position:absolute;left:17mm;top:12mm}.karte .logo img{height:11mm;width:auto;display:block}.karte .logo .wort{background:#050505;color:#fff;padding:2.5mm 3.5mm;border-radius:2mm;display:block}',
    '.karte .attr{position:absolute;right:2mm;bottom:1.5mm;font-size:6.5pt;background:rgba(255,255,255,.85);padding:.5mm 1.5mm}',
    '.lagekarte{height:70mm;border:.8px solid var(--linie);overflow:hidden;margin:4mm 0}.lagekarte img{width:100%;height:100%;object-fit:cover}',
    '.score{display:flex;gap:7mm;align-items:center;margin:5mm 0 2mm}.ring{width:34mm;height:34mm;position:relative;flex:0 0 34mm}',
    '.ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
    '.ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:"Space Grotesk",sans-serif;font-size:24pt}',
    '.urteil h2{margin:0}.gruppen{margin:4mm 0}',
    '.gr{display:grid;grid-template-columns:28mm 1fr 12mm;gap:3mm;align-items:center;padding:2.4mm 0;border-bottom:.6px solid var(--linie)}',
    '.gr .bal{height:2.6mm;background:#efebe2;border-radius:2mm;overflow:hidden}.gr .bal i{display:block;height:100%;border-radius:2mm}',
    '.gr b{font-family:"JetBrains Mono",monospace;text-align:right}.gr p{grid-column:2/4;margin:0;font-size:8.6pt;color:var(--mut)}',
    '.box{background:var(--creme);border-left:2px solid var(--gold);padding:3.5mm 4mm;margin:4mm 0;font-size:9.3pt}.box b{font-family:"Space Grotesk",sans-serif}',
    'ul.p{margin:2mm 0;padding-left:5mm}ul.p li{margin:1.2mm 0}',
    '.ampel{display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;margin-right:1.5mm;vertical-align:middle}',
    '.zwei{display:grid;grid-template-columns:1fr 1fr;gap:6mm}',
    '.check{padding:0;margin:1mm 0 3mm}.check li{list-style:none;position:relative;padding-left:6mm;margin:1.4mm 0;font-size:9pt}',
    '.check li::before{content:"";position:absolute;left:0;top:.6mm;width:3.2mm;height:3.2mm;border:.8px solid var(--ink);border-radius:.6mm}.check li small{color:var(--mut)}',
    '.toc td{padding:2.6mm 0;font-size:10.5pt}.toc td.n{width:10mm;font-family:"JetBrains Mono",monospace;color:var(--gold-d)}',
    '.quelle{font-size:7.6pt;color:var(--mut)}.chart{width:100%;height:auto;margin:2mm 0 0}',
    'table,.kacheln,.kachel,.box,.gr,.zwei,svg,.lagekarte,tr{break-inside:avoid;page-break-inside:avoid}h2,h3,.ober{break-after:avoid;page-break-after:avoid}p,li{orphans:3;widows:3}'
  ].join('');

  function bauen(e, D, logo) {
    var H = e.haus, O = e.objekt || {}, W = e.wert && e.wert.betrag ? e.wert : null, Wroh = e.wert || null, U = e.umfeld, L = e.belw, M = e.amort || null;
    var esc = D.esc, eur = D.eur, zahl = D.zahl, pct = D.pct;
    var g = H.haus.gruppen, LB = H.leistbarkeit, F = H.finanzierung, KM = H.kaufen_mieten, NK = H.nebenkosten;
    var ETW = O.objektart === 'etw', BJ = Number(O.baujahr) || null, ALTER = BJ ? new Date().getFullYear() - BJ : null;
    var ORT = (O.adresse || '').replace(/^.*?,\s*/, '') || (e.lage && e.lage.plz ? e.lage.plz + ' ' + (e.lage.ort || '') : '');
    var abN = function (p) { return LB.wohnkosten > 0 && p > 0 ? Math.ceil(LB.wohnkosten / p * 100 / 10) * 10 : null; };
    var abGruen = abN(LB.grenzen && LB.grenzen.gruen), abGelb = abN(LB.grenzen && LB.grenzen.gelb);
    var farbe = function (s) { return s == null ? '#efebe2' : s >= 70 ? 'var(--gruen)' : s >= 50 ? 'var(--gold)' : 'var(--rot)'; };
    var hex = function (s) { return s >= 70 ? '#3FA56C' : s >= 50 ? '#C9A84C' : '#B8625C'; };
    var wertName = function (w) { return w && w.vollstaendig ? 'Verkehrswert' : 'vorläufiger ' + (w && w.verfahren === 'vergleichswert' ? 'Vergleichswert' : 'Sachwert'); };
    var glatt = function (t) { return t == null ? '' : String(t).replace(/\s[–—]\s/g, ', ').replace(/[–—]/g, ' bis ').replace(/;/g, ','); };
    var zeile = function (l, klein, w, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + l + (klein ? '<small>' + klein + '</small>' : '') + '</td>' + (w === null ? '' : '<td class="z">' + w + '</td>') + '</tr>'; };
    var kachel = function (l, v, s) { return '<div class="kachel"><span>' + l + '</span><b>' + v + '</b><small>' + (s || '') + '</small></div>'; };
    var leist = (e.gruppen || []).filter(function (x) { return x.k === 'Leistbarkeit'; })[0] || null;
    var zinsSatz = 'Zins ' + pct(F.zins_pct, 2) + ' für ' + (F.bindung_jahre || 10) + ' Jahre' + (F.zins_herkunft ? ', ' + F.zins_herkunft : '') + ', ' + pct(F.tilgung_pct, 0) + ' Tilgung';

    var S = [];    /* [kurztitel, html ohne Kopf/Fuß] */
    var KAP = [];  /* Inhaltsverzeichnis: [nr, titel, seitenindex] */
    function seite(kurz, html, kapTitel) { if (kapTitel) KAP.push([KAP.length + 1, kapTitel, S.length]); S.push([kurz, html]); }
    function kapNr() { return KAP.length + 1; }

    /* 1 · Deckblatt */
    var deckWert = W ? kachel(esc(wertName(W)), eur(W.betrag), W.verfahren === 'vergleichswert' ? 'Vergleichswertverfahren' : 'Sachwertverfahren')
      : M && M.wert ? kachel('Marktpreisindikation', eur(M.wert), 'aus Angebotspreisen, kein Verkehrswert') : kachel('Haus-Score', String(H.haus.score), 'von 100');
    var urteilKurz = (g.preis && g.preis.abweichung_pct != null ? (g.preis.abweichung_pct > 10 ? 'Der Preis liegt deutlich über dem Wert.' : g.preis.abweichung_pct > 3 ? 'Der Preis liegt etwas über dem Wert.' : 'Der Preis passt.') : '')
      + (g.lage ? ' Die Lage ist ' + (g.lage.score >= 70 ? 'gut.' : g.lage.score >= 50 ? 'durchschnittlich.' : 'eher schwach.') : '');
    var U2 = 2 * Math.PI * 52;
    S.push(['Deckblatt',
      '<div class="karte">' + (e.karte ? '<img class="bild" src="' + e.karte + '" alt="Karte">' : '')
      + '<div class="logo">' + (logo ? '<img src="' + logo + '" alt="DealPilot">' : '<span class="wort">DealPilot</span>') + '</div>'
      + '<div class="attr">© OpenStreetMap-Mitwirkende</div></div>'
      + '<p class="ober">DealPilot Haus-Check · Selbst nutzen</p>'
      + '<h1>' + esc(ARTNAME[O.objektart] || 'Haus') + ' in ' + esc(ORT) + '</h1>'
      + '<p class="unter">' + [esc((O.adresse || '').split(',')[0]), zahl(O.wfl) + ' m² Wohnfläche', !ETW && O.gsfl ? zahl(O.gsfl) + ' m² Grundstück' : '', 'Baujahr ' + D.jahr(O.baujahr), 'Kaufpreis ' + eur(O.kaufpreis)].filter(Boolean).join(' · ') + '</p>'
      + '<div class="score"><div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="#efebe2" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="' + hex(H.haus.score) + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + U2.toFixed(1) + '" stroke-dashoffset="' + (U2 * (1 - H.haus.score / 100)).toFixed(1) + '"/></svg><b>' + H.haus.score + '</b></div>'
      + '<div class="urteil"><p class="ober">Ist das Haus gut?</p><h2>' + esc(H.haus.stufe.wort) + '. ' + esc(urteilKurz) + '</h2><p style="margin:1.5mm 0 0;color:var(--mut)">Für dich als Selbstnutzer: Preis, Zustand und Lage ergeben den Haus-Score. Ob es zu deinem Einkommen passt, steht getrennt in der Leistbarkeit.</p></div></div>'
      + '<div class="kacheln">' + deckWert + kachel('Ersparte Miete', eur(H.miete.monat), 'im Monat, ortsüblich') + kachel('Rate', eur(F.rate), 'im Monat, ' + pct(F.zins_pct, 2) + ' Zins')
      + kachel('Kaufen lohnt', KM.jahr ? 'ab Jahr ' + KM.jahr : 'nicht in 20 J.', 'gegen Mieten und Anlegen') + '</div>'
      + '<table><tr><th>Stand</th><th>Grundlage</th><th>Bewertungsstichtag</th></tr><tr><td>' + D.datum(new Date()) + '</td><td>deine Angaben, amtliche Daten, Marktdaten</td><td>' + (e.stichtag ? D.datum(e.stichtag) : D.datum(new Date())) + '</td></tr></table>']);

    /* 2 · Inhalt (wird am Ende gefüllt) */
    S.push(['Inhalt', '']);

    /* 3 · Kurzurteil */
    var lText = LB.quote != null ? 'Wohnkosten ' + pct(LB.quote, 1) + ' vom Netto-Einkommen.' : abGruen ? 'Gut tragbar ab ' + eur(abGruen) + ' Netto im Monat, knapp ab ' + eur(abGelb) + '.' : 'Ohne Einkommen keine Note.';
    var gr = function (k, s, t) { return '<div class="gr"><span>' + k + '</span><div class="bal"><i style="width:' + (s == null ? 0 : s) + '%;background:' + farbe(s) + '"></i></div><b>' + (s == null ? '–' : s) + '</b><p>' + t + '</p></div>'; };
    var wissen = (H.urteil || []).slice(1).map(function (t) { return '<li>' + esc(t) + '</li>'; });
    if (!ETW) wissen.push('<li><b>Pflicht nach dem Kauf:</b> Nach dem Eigentümerwechsel hast du zwei Jahre Zeit, die oberste Geschossdecke und die Leitungen im Keller zu dämmen, falls das noch nicht geschehen ist.</li>');
    seite('Kurzurteil', '<p class="ober">' + kapNr() + ' · Kurzurteil</p><h2>Ist das Haus gut? ' + esc(H.haus.stufe.wort) + ', ' + H.haus.score + ' von 100.</h2>'
      + '<p class="unter">Vier Fragen, die für dich als Selbstnutzer zählen. Jede Frage hat eine eigene Note.</p><div class="gruppen">'
      + (g.preis ? gr('Preis', g.preis.score, (H.miete.faktor ? 'Du zahlst ' + zahl(H.miete.faktor, 1) + ' Jahresmieten. Üblich sind rund 22 bis 26. ' : '') + (g.preis.abweichung_pct != null ? 'Der Kaufpreis liegt ' + (g.preis.abweichung_pct > 0 ? pct(g.preis.abweichung_pct, 1) + ' über' : pct(-g.preis.abweichung_pct, 1) + ' unter') + ' dem Wert.' : '')) : '')
      + gr('Zustand', g.zustand.score, 'Baujahr ' + D.jahr(O.baujahr) + '. ' + esc(g.zustand.punkte.slice(0, 2).join(', ')) + '.')
      + (g.lage ? gr('Lage', g.lage.score, e.lage && e.lage.makro != null ? 'Makrolage ' + e.lage.makro + ' von 100' + (e.lage.mikro != null ? ', Mikrolage ' + e.lage.mikro + ' von 100.' : '.') : 'Lage aus amtlichen Daten.') : '')
      + gr('Leistbarkeit', leist ? leist.s : null, lText) + '</div>'
      + '<h3>Was du wissen solltest</h3><ul class="p">' + wissen.join('') + '</ul>'
      + '<div class="box">Die Note folgt den Stufen von DealPilot: ab 85 sehr gut, ab 70 gut, ab 50 solide, ab 35 schwach, darunter kritisch. Der Haus-Score gewichtet Preis 35 %, Zustand 35 % und Lage 30 %. Die Leistbarkeit steht getrennt, weil sie von dir abhängt und nicht vom Haus.</div>', 'Kurzurteil: Ist das Haus gut?');

    /* 4 · Grundangaben */
    var KEL = { ja: 'unterkellert', nein: 'ohne Keller' }, GES = { '1': 'nur Erdgeschoss', '2': 'Erd- und Obergeschoss', '3': 'Erdgeschoss und 2 Obergeschosse', '4': '3 und mehr Vollgeschosse' },
      DAC = { '1': 'Dachgeschoss ausgebaut', '2': 'Dachgeschoss nicht ausgebaut', '3': 'Flachdach' };
    var ga = zeile('Objektart', 'deine Angabe', esc(ARTNAME[O.objektart] || '')) + zeile('Anschrift', 'deine Angabe', esc(O.adresse || ''))
      + zeile('Wohnfläche', 'deine Angabe', zahl(O.wfl) + ' m²') + (!ETW ? zeile('Grundstück', 'deine Angabe', O.gsfl ? zahl(O.gsfl) + ' m²' : 'nicht angegeben') : '')
      + zeile('Baujahr', ALTER != null ? ALTER + ' Jahre alt' : '', D.jahr(O.baujahr))
      + (!ETW && O.geschosse ? zeile('Geschosse und Keller', 'für den Gebäudetyp nach NHK 2010', esc((GES[O.geschosse] || O.geschosse) + (O.keller ? ', ' + (KEL[O.keller] || O.keller) : ''))) : '')
      + (!ETW && O.dach ? zeile('Dach', '', esc(DAC[O.dach] || O.dach)) : '') + (O.ausst ? zeile('Ausstattung', 'Standardstufe', esc(O.ausst)) : '')
      + (O.zustand_text ? zeile('Zustand', 'deine Angabe', esc(O.zustand_text)) : '')
      + zeile('Kaufpreis', 'deine Angabe', eur(O.kaufpreis)) + zeile('Eigenkapital', 'deine Angabe', eur(O.ek || 0));
    seite('Grundangaben', '<p class="ober">' + kapNr() + ' · Grundangaben</p><h2>Womit dieser Bericht rechnet</h2>'
      + '<p class="unter">Alle Merkmale stammen aus deiner Angabe beim Kauf. Dazu die Daten, die DealPilot für diese Anschrift geholt hat.</p>'
      + '<table class="eng"><tr><th>Merkmal</th><th class="z">Wert</th></tr>' + ga.replace(/<small>deine Angabe<\/small>/g, '') + '</table>'
      + '<h3>Was DealPilot dazu geholt hat</h3><table class="eng">'
      + zeile('Bodenrichtwert und Sachwertfaktor', 'des zuständigen Gutachterausschusses', W ? 'ja' : 'nicht vollständig')
      + zeile('Ortsübliche Vergleichsmiete', e.vmiete && e.vmiete.art === 'mietspiegel' ? 'Mietspiegel der Gemeinde' : 'DealPilot-Näherung', e.vmiete && e.vmiete.mittel ? eur(e.vmiete.mittel, 2) + ' je m²' : 'ja')
      + zeile('Bauzins', 'tagesaktuell je Beleihung und Zinsbindung', pct(F.zins_pct, 2))
      + zeile('Angebote am Ort', 'aktueller Marktdurchschnitt', M && M.kauf && M.kauf.n ? zahl(M.kauf.n) + ' Angebote' : 'keine')
      + zeile('Grundsteuer und Trinkwasser', 'je Gemeinde', 'ja') + zeile('Umfeld', 'Nahversorgung, Schulen, Verkehr', U && U.ok ? zahl(U.kategorien.length) + ' Kategorien' : 'nicht abrufbar') + '</table>'
      + '<p class="quelle">Mit Unterlagen wird es genauer: Exposé, Energieausweis und die Liste der Modernisierungen ändern Zustand, Heizkosten und Wert.</p>', 'Deine Grundangaben');

    /* 5 · Preis gegen Wert */
    var ab = g.preis ? g.preis.abweichung_pct : null;
    var pw = '<p class="ober">' + kapNr() + ' · Preis gegen Wert</p><h2>' + (W && ab != null ? 'Zahlst du zu viel? ' + (ab > 10 ? 'Ja.' : ab > 3 ? 'Etwas.' : 'Nein.') : 'Was ist das Haus wert?') + '</h2>'
      + '<p class="unter">' + (ETW ? 'Für eine Eigentumswohnung führt der Vergleichswert.' : 'Für ein selbst genutztes Haus ist das Sachwertverfahren der übliche Weg.') + ' Daneben steht, was vergleichbare Häuser am Ort kosten sollen.</p>';
    if (W && W.rechenweg && W.rechenweg.length) {
      pw += '<table class="eng"><tr><th>' + (W.verfahren === 'vergleichswert' ? 'Vergleichswertverfahren' : 'Sachwertverfahren') + ' · Rechenweg</th><th class="z">Betrag</th></tr>'
        + W.rechenweg.slice(0, 11).map(function (z) {
          var wert = typeof z.wert === 'number' ? (z.wert < 0 ? '− ' + eur(-z.wert) : eur(z.wert)) : (typeof z.faktor === 'number' ? '× ' + zahl(z.faktor, 3) : '');
          return zeile(esc(glatt(z.pos)), z.detail ? esc(glatt(z.detail)) : '', wert);
        }).join('') + zeile(esc(wertName(W)) + ', gerundet', '', eur(W.betrag), 'summe') + '</table>';
    } else if (W) pw += '<table>' + zeile(esc(wertName(W)), '', eur(W.betrag), 'summe') + '</table>';
    else if (!ETW && (O.geschosse === '3' || O.geschosse === '4')) pw += '<div class="box"><b>Kein Sachwert für dieses Haus.</b> Für Ein- und Zweifamilienhäuser mit mehr als zwei Vollgeschossen kennen die Normalherstellungskosten 2010 keinen Gebäudetyp. Kein Verfahren rechnet halb, deshalb weist dieser Bericht hier keinen Sachwert aus. Zur Einordnung dient die Marktpreisindikation unten. Für einen Verkehrswert braucht es ein Gutachten.</div>';
    else pw += '<div class="box">Für dieses Objekt liegt noch keine vollständige Wertermittlung vor. ' + esc(glatt(Wroh && (Wroh.weg || Wroh.grund) && !/^[a-z_]+$/.test(String(Wroh.weg || Wroh.grund)) ? (Wroh.weg || Wroh.grund) : 'Mit Straße, Hausnummer und Grundstücksfläche rechnet DealPilot den Wert nach ImmoWertV.')) + '</div>';
    pw += '<h3>Was Häuser am Ort kosten sollen</h3><table class="eng">'
      + (M && M.wert ? zeile('Marktpreisindikation', 'aus Angebotspreisen vergleichbarer Häuser' + (M.abschlag_pct ? ', nach ' + zahl(M.abschlag_pct) + ' % Abschlag' : '') + ', kein Verkehrswert', eur(M.wert)) : '')
      + zeile('Kaufpreis', O.wfl ? eur(O.kaufpreis / O.wfl) + ' je m²' : '', eur(O.kaufpreis))
      + (H.miete.faktor ? zeile('Kaufpreis in Jahresmieten', eur(O.kaufpreis) + ' geteilt durch ' + eur(H.miete.monat * 12) + ' ersparte Jahresmiete', zahl(H.miete.faktor, 1)) : '') + '</table>';
    if (W && ab != null) pw += '<div class="box">Der Kaufpreis liegt ' + (ab > 0 ? pct(ab, 1) + ' über' : pct(-ab, 1) + ' unter') + ' dem ' + esc(wertName(W)) + (M && M.wert ? ' und ' + (O.kaufpreis >= M.wert ? pct((O.kaufpreis / M.wert - 1) * 100, 0) + ' über' : pct((1 - O.kaufpreis / M.wert) * 100, 0) + ' unter') + ' der Marktpreisindikation' : '') + '. '
      + (ab > 10 ? 'Hier lohnt es sich, nachzuverhandeln.' : ab > 3 ? 'Ein Gespräch über den Preis lohnt sich.' : 'Das ist ein fairer Preis.') + (!W.vollstaendig ? ' Einen Verkehrswert weist dieser Bericht nicht aus, solange eine amtliche Angabe fehlt.' : '') + '</div>';
    pw += '<p class="quelle">Indikative Wertermittlung nach ImmoWertV mit den Daten des zuständigen Gutachterausschusses, ohne Ortsbesichtigung, kein Gutachten. Lizenzvermerke im Kapitel Quellen.</p>';
    seite('Wert', pw, 'Preis gegen Wert, mit Rechenweg');

    /* 6 · Markt am Ort (neu, Marktdaten) */
    if (M && M.aus_markt) {
      var linie = function (reihe, fmt, titel) {
        if (!reihe || reihe.length < 2) return '';
        var w = 300, h = 130, l = 14, r = 14, t = 18, b = 22, xs = reihe.map(function (p) { return p.jahr; }), ys = reihe.map(function (p) { return p.median; });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys) * 0.9, y1 = Math.max.apply(null, ys) * 1.06;
        var X = function (x) { return l + (x - x0) / (x1 - x0 || 1) * (w - l - r); }, Y = function (y) { return t + (1 - (y - y0) / (y1 - y0 || 1)) * (h - t - b); };
        var pfad = reihe.map(function (p, i) { return (i ? 'L' : 'M') + X(p.jahr).toFixed(1) + ' ' + Y(p.median).toFixed(1); }).join(' ');
        return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '"><text x="' + l + '" y="9" font-size="8" fill="#6b6560" font-family="JetBrains Mono">' + titel + '</text>'
          + '<line x1="' + l + '" x2="' + (w - r) + '" y1="' + (h - b) + '" y2="' + (h - b) + '" stroke="#e4ded2"/>'
          + '<path d="' + pfad + '" fill="none" stroke="#C9A84C" stroke-width="2"/>'
          + reihe.map(function (p) { return '<circle cx="' + X(p.jahr).toFixed(1) + '" cy="' + Y(p.median).toFixed(1) + '" r="2.2" fill="#b8932f"/><text x="' + X(p.jahr).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="7.5" fill="#6b6560" font-family="JetBrains Mono">' + p.jahr + '</text>'
            + '<text x="' + X(p.jahr).toFixed(1) + '" y="' + (Y(p.median) - 5).toFixed(1) + '" text-anchor="middle" font-size="7" fill="#1a1818" font-family="JetBrains Mono">' + fmt(p.median) + '</text>'; }).join('') + '</svg>';
      };
      var mk = '<p class="ober">' + kapNr() + ' · Markt am Ort</p><h2>Was Häuser am Ort kosten und einbringen</h2>'
        + '<p class="unter">Aktueller Marktdurchschnitt aus Angeboten im Umkreis. Angebotspreise sind Wunschpreise der Verkäufer und liegen meist über den gezahlten Preisen.</p>'
        + '<div class="kacheln">' + kachel('Angebotspreis', M.kauf && M.kauf.median ? eur(M.kauf.median) : '–', 'je m², Median' + (M.kauf && M.kauf.n ? ' aus ' + zahl(M.kauf.n) + ' Angeboten' : ''))
        + kachel('Spanne', M.kauf && M.kauf.q25 ? '<span style="font-size:11.5pt">' + zahl(M.kauf.q25) + ' bis ' + zahl(M.kauf.q75) + '</span>' : '–', '€ je m², mittlere Hälfte')
        + kachel('Angebotsmiete', M.miete && M.miete.median ? eur(M.miete.median, 2) : '–', 'je m², Median')
        + kachel('Marktpreisindikation', M.wert ? eur(M.wert) : '–', M.abschlag_pct ? 'nach ' + zahl(M.abschlag_pct) + ' % Abschlag' : 'kein Verkehrswert') + '</div>'
        + '<div class="zwei"><div>' + linie(M.reihe && M.reihe.preis, function (v) { return zahl(v); }, 'ANGEBOTSPREIS € JE M²') + '</div><div>' + linie(M.reihe && M.reihe.miete, function (v) { return zahl(v, 2); }, 'ANGEBOTSMIETE € JE M²') + '</div></div>'
        + (M.preis_trend_pct != null || M.miete_trend_pct != null ? '<p class="quelle">Entwicklung im Schnitt' + (M.preis_trend_pct != null ? ' ' + pct(M.preis_trend_pct, 1) + ' im Jahr beim Preis' : '') + (M.miete_trend_pct != null ? (M.preis_trend_pct != null ? ' und' : '') + ' ' + pct(M.miete_trend_pct, 1) + ' im Jahr bei der Miete' : '') + '.</p>' : '');
      if (M.angebote && M.angebote.length) mk += '<h3>Vergleichsangebote</h3><table class="eng"><tr><th>Preis je m²</th><th class="z">Wohnfläche</th><th class="z">Baujahr</th><th class="z">Entfernung</th></tr>'
        + M.angebote.slice(0, 8).map(function (a) { return '<tr><td>' + eur(a.qm_preis) + '</td><td class="z">' + (a.flaeche ? zahl(a.flaeche) + ' m²' : '–') + '</td><td class="z">' + (a.baujahr ? D.jahr(a.baujahr) : '–') + '</td><td class="z">' + (a.entfernung_m != null ? (a.entfernung_m < 1000 ? zahl(a.entfernung_m) + ' m' : zahl(a.entfernung_m / 1000, 1) + ' km') : '–') + '</td></tr>'; }).join('')
        + '</table><p class="quelle">Ohne Anschrift. Angebote, keine Kaufpreise. Dein Haus: ' + (O.wfl ? eur(O.kaufpreis / O.wfl) + ' je m²' : '') + '.</p>';
      seite('Markt', mk, 'Markt am Ort: Angebote und Entwicklung');
    }

    /* 7 · Kaufen oder mieten */
    var km = '<p class="ober">' + kapNr() + ' · Kaufen oder mieten?</p><h2>' + (KM.jahr ? 'Kaufen ist nach ' + KM.jahr + ' Jahren günstiger.' : 'In 20 Jahren wird Kaufen nicht günstiger.') + '</h2>'
      + '<p class="unter">Wir vergleichen dein Vermögen in zwei Fällen. Kaufen: Wert des Hauses minus Restschuld. Mieten: Eigenkapital und Kaufnebenkosten angelegt, dazu jeden Monat der Betrag, den der Kauf mehr kostet als die Miete.</p>';
    if (KM.reihe.length) {
      var R = KM.reihe, Wc = 640, Hc = 280, Lc = 56, Rc = 130, Tc = 22, Bc = 34;
      var mx = Math.max.apply(null, R.map(function (p) { return Math.max(p.kaufen, p.mieten); })), mn = Math.min(0, Math.min.apply(null, R.map(function (p) { return Math.min(p.kaufen, p.mieten); })));
      var sp = Math.max(1, mx - mn), st = Math.pow(10, Math.floor(Math.log(sp / 5) / Math.LN10)); st = sp / st > 25 ? st * 5 : sp / st > 10 ? st * 2 : st;
      var top = Math.ceil(mx / st) * st, bot = Math.floor(mn / st) * st;
      var Xc = function (t) { return Lc + t / 20 * (Wc - Lc - Rc); }, Yc = function (v) { return Tc + (1 - (v - bot) / (top - bot || 1)) * (Hc - Tc - Bc); };
      var sv = '';
      for (var v = bot; v <= top + 1; v += st) sv += '<line x1="' + Lc + '" x2="' + (Wc - Rc) + '" y1="' + Yc(v).toFixed(1) + '" y2="' + Yc(v).toFixed(1) + '" stroke="#ece7dc"/><text x="' + (Lc - 8) + '" y="' + (Yc(v) + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#6b6560" font-family="JetBrains Mono">' + zahl(v / 1000) + '</text>';
      for (var t = 0; t <= 20; t += 5) sv += '<text x="' + Xc(t) + '" y="' + (Hc - 12) + '" text-anchor="middle" font-size="10" fill="#6b6560" font-family="JetBrains Mono">Jahr ' + t + '</text>';
      var pf = function (k) { return R.map(function (p, i) { return (i ? 'L' : 'M') + Xc(p.jahr).toFixed(1) + ' ' + Yc(p[k]).toFixed(1); }).join(' '); };
      var le = R[R.length - 1];
      sv += '<path d="' + pf('mieten') + '" fill="none" stroke="#6b6560" stroke-width="2.2" stroke-dasharray="6 4"/><path d="' + pf('kaufen') + '" fill="none" stroke="#C9A84C" stroke-width="2.8"/>'
        + '<text x="' + (Wc - Rc + 8) + '" y="' + (Yc(le.kaufen) + 4).toFixed(1) + '" font-size="11" fill="#1a1818" font-family="Inter">Kaufen ' + zahl(le.kaufen / 1000) + ' Tsd.</text>'
        + '<text x="' + (Wc - Rc + 8) + '" y="' + (Yc(le.mieten) + 16).toFixed(1) + '" font-size="11" fill="#6b6560" font-family="Inter">Mieten ' + zahl(le.mieten / 1000) + ' Tsd.</text>'
        + '<text x="' + Lc + '" y="11" font-size="10" fill="#6b6560" font-family="JetBrains Mono">Vermögen in Tsd. €</text>';
      if (KM.jahr) sv += '<line x1="' + Xc(KM.jahr) + '" x2="' + Xc(KM.jahr) + '" y1="' + Tc + '" y2="' + (Hc - Bc) + '" stroke="#b8932f" stroke-dasharray="3 3"/><text x="' + (Xc(KM.jahr) + 4) + '" y="' + (Tc + 10) + '" font-size="10" fill="#b8932f" font-family="JetBrains Mono">ab Jahr ' + KM.jahr + ' liegt Kaufen vorn</text>';
      km += '<svg class="chart" viewBox="0 0 ' + Wc + ' ' + Hc + '">' + sv + '</svg>'
        + '<table class="eng"><tr><th>Nach Jahren</th><th class="z">Kaufen</th><th class="z">Mieten und anlegen</th><th class="z">Unterschied</th></tr>'
        + R.filter(function (p) { return p.jahr > 0 && (p.jahr % 5 === 0 || p.jahr === KM.jahr); }).map(function (p) { var d = p.kaufen - p.mieten;
          return '<tr><td>' + p.jahr + '</td><td class="z">' + eur(p.kaufen) + '</td><td class="z">' + eur(p.mieten) + '</td><td class="z">' + (d >= 0 ? '+ ' : '− ') + eur(Math.abs(d)) + '</td></tr>'; }).join('') + '</table>';
    }
    km += '<div class="box"><b>Ersparte Miete:</b> ' + eur(H.miete.monat) + ' im Monat. Das ist die ortsübliche Vergleichsmiete für ein Haus dieser Größe und dieses Baujahrs'
      + (e.vmiete && e.vmiete.mittel ? ' (' + eur(e.vmiete.unten, 2) + ' bis ' + eur(e.vmiete.oben, 2) + ' je m², Mittelwert ' + eur(e.vmiete.mittel, 2) + (e.vmiete.art === 'mietspiegel' ? ' laut Mietspiegel' : '') + ')' : '')
      + (H.miete.hauszuschlag_pct ? ', mit ' + zahl(H.miete.hauszuschlag_pct) + ' % Hauszuschlag' : '') + '. Für Selbstnutzer rechnen wir bewusst mit dem Mittelwert, nicht mit der höchstmöglichen Miete.</div>'
      + '<p class="quelle">Annahmen: Wertentwicklung ' + pct(KM.annahmen.wertsteigerung_pct, 1) + ' im Jahr, Mietsteigerung ' + pct(KM.annahmen.mietsteigerung_pct, 1) + ' im Jahr, Anlagezins ' + pct(KM.annahmen.anlagezins_pct, 1) + ' im Jahr. Heizung und Nebenkosten zahlst du als Mieter genauso, sie stehen deshalb nicht im Vergleich. Andere Annahmen ändern das Ergebnis. Keine Prognose.</p>';
    seite('Kaufen oder mieten', km, 'Kaufen oder mieten?');

    /* 8 · Leistbarkeit */
    var AU = LB.aufstellung || [], haupt = AU.filter(function (x) { return !x.teil && !x.summe; }), teile = AU.filter(function (x) { return x.teil; }), sum = AU.filter(function (x) { return x.summe; })[0];
    var lb = '<p class="ober">' + kapNr() + ' · Leistbarkeit</p><h2>Was dich das Haus im Monat kostet</h2><p class="unter">Gerechnet mit ' + esc(zinsSatz) + '.</p>'
      + '<table class="eng"><tr><th>Finanzierung</th><th class="z">Betrag</th></tr>' + zeile('Kaufpreis', '', eur(O.kaufpreis)) + zeile('Kaufnebenkosten', 'Kapitel Kaufnebenkosten', eur(NK.summe))
      + zeile('Eigenkapital', 'deine Angabe', '− ' + eur(O.ek || 0)) + zeile('Darlehen', '', eur(F.darlehen), 'summe') + zeile('Beleihung', 'Darlehen geteilt durch Kaufpreis', pct(F.ltv_pct, 0))
      + zeile('Zins ' + (F.bindung_jahre || 10) + ' Jahre', esc(F.zins_herkunft || 'Bauzins heute für diese Beleihung'), pct(F.zins_pct, 2)) + zeile('Tilgung', 'im ersten Jahr', pct(F.tilgung_pct, 1)) + '</table>'
      + '<div class="zwei"><div><h3>Monatliche Belastung</h3><table class="eng">' + haupt.map(function (x) {
        return zeile(esc(x.k === 'uebrige' ? 'Nebenkosten ohne Heizung' : x.l), x.k === 'uebrige' ? 'Posten rechts' : esc(x.herkunft || ''), eur(x.eur)); }).join('')
      + (sum ? zeile('Wohnkosten im Monat', '', eur(sum.eur), 'summe') : '')
      + (LB.quote != null ? zeile('Anteil am Netto-Haushaltseinkommen', '', '<span class="ampel" style="background:' + (LB.ampel === 'gruen' ? 'var(--gruen)' : LB.ampel === 'rot' ? 'var(--rot)' : 'var(--gold)') + '"></span>' + pct(LB.quote, 1))
        : abGruen ? zeile('Gut tragbar ab einem Netto-Einkommen von', 'knapp ab ' + eur(abGelb), eur(abGruen)) : '') + '</table></div><div>';
    lb += teile.length ? '<h3>Nebenkosten einzeln</h3><table class="eng">' + teile.map(function (x) { return zeile(esc(x.l.replace(/^davon /, '').replace(/^Strom für Außenbereich und Allgemeinflächen$/, 'Strom Allgemein')), esc(x.herkunft), eur(x.eur)); }).join('') + '</table>' : '';
    lb += '</div></div>';
    lb += '<div class="box">Grün bis ' + LB.grenzen.gruen + ' %, gelb bis ' + LB.grenzen.gelb + ' % vom Netto. Banken rechnen meist nur die Rate gegen höchstens 40 % vom Netto. Je Gemeinde heißt: aus den Zahlen deiner Gemeinde abgeleitet, kein Bescheid.</div>'
      + '<p class="quelle">Keine Finanzierungszusage. Die Bank prüft Einkommen, Ausgaben und Objekt selbst.</p>';
    seite('Leistbarkeit', lb, 'Leistbarkeit: Was dich das Haus im Monat kostet');

    /* 9 · Zustand */
    var HZ = LB.heizung || {};
    var ang = [];
    if (O.zustand_text) ang.push(esc(O.zustand_text) + ' <small>(deine Angabe)</small>');
    if (O.energieklasse) ang.push('Energieklasse ' + esc(O.energieklasse) + ' <small>(deine Angabe)</small>');
    if (O.heizung_baujahr) ang.push('Heizung von ' + esc(O.heizung_baujahr) + ' <small>(deine Angabe)</small>');
    g.zustand.hinweise.forEach(function (t) { ang.push(esc(t)); });
    if (!ang.length) ang.push('Keine Angaben zu Modernisierung, Heizung und Energieklasse. Wir rechnen mit dem Baujahr.');
    var zs = '<p class="ober">' + kapNr() + ' · Zustand, Energie und Sanierung</p><h2>Was in den nächsten Jahren auf dich zukommt</h2>'
      + '<div class="zwei"><div><h3 style="margin-top:0">Typisch für Baujahr ' + D.jahr(O.baujahr) + '</h3><ul class="p">' + g.zustand.punkte.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'
      + '<div><h3 style="margin-top:0">Aus deinen Angaben</h3><ul class="p">' + ang.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div></div>'
      + '<h3>Heizung und Gebäudeenergiegesetz</h3><table class="eng">'
      + zeile('Austauschpflicht nach 30 Jahren', 'Öl- und Gaskessel, gilt nicht für Brennwert- und Niedertemperaturkessel', O.heizung_baujahr ? (new Date().getFullYear() - O.heizung_baujahr >= 30 ? 'prüfen' : 'keine') : 'Typenschild')
      + zeile('Beim Tausch', 'neue Heizung mit 65 % erneuerbarer Energie, Übergangsfristen je nach Wärmeplanung der Gemeinde', 'ab Tausch')
      + (!ETW ? zeile('Nach dem Eigentümerwechsel', 'oberste Geschossdecke und Leitungen im Keller dämmen, falls noch nicht geschehen', '2 Jahre') : '')
      + (HZ.kwh_qm ? zeile('Heizkosten heute', zahl(HZ.kwh_qm * O.wfl) + ' kWh im Jahr × ' + zahl(HZ.ct / 100, 2) + ' €/kWh, ' + esc(HZ.herkunft || ''), eur(HZ.kwh_qm * O.wfl * HZ.ct / 100) + ' im Jahr') : '') + '</table>';
    if (BJ) zs += '<h3>Bauteile nach Alter</h3><table class="eng"><tr><th>Bauteil</th><th>worauf achten</th><th class="z">Alter</th></tr>'
      + [['Heizung', 'Typenschild, Wartung, Schornsteinfeger'], ['Dach', 'Eindeckung, Rinnen, Dämmung'], ['Fenster', 'Dichtungen, Beschläge, Verglasung'], ['Fassade', 'Risse, Feuchte, Algen'], ['Elektrik', 'Fehlerstromschutzschalter, Schutzleiter'], ['Bäder und Leitungen', 'Material der Rohre, Feuchte']]
        .map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td><td class="z">' + (O.modernisiert ? 'siehe Zustand' : ALTER + ' Jahre') + '</td></tr>'; }).join('') + '</table>'
      + '<p class="quelle">Ohne Liste der Modernisierungen nehmen wir an, dass die Bauteile so alt sind wie das Haus. Kosten je Gewerk schätzt ein Fachbetrieb oder Energieberater nach der Besichtigung, dafür gibt es Förderung (nächstes Kapitel). Stand der Regeln beim Erstellen, vor dem Kauf den aktuellen Stand prüfen.</p>';
    seite('Zustand', zs, 'Zustand, Energie und Sanierung');

    /* 10 · Förderung */
    var FO = O.foerderung || [];
    seite('Förderung', '<p class="ober">' + kapNr() + ' · Förderung</p><h2>Wofür es Geld vom Staat geben kann</h2><p class="unter">Öffentliche Programme ändern sich oft. Prüfe vor jedem Auftrag, was am Tag der Antragstellung gilt.</p>'
      + (FO.length ? '<table class="eng"><tr><th style="width:42%">Programm und wofür</th><th>Förderung, Größenordnung</th></tr>' + FO.slice(0, 7).map(function (f) {
        return '<tr><td style="padding-right:4mm"><b>' + esc(f.name) + '</b><small>' + esc(f.warum || f.satz || '') + '</small></td><td style="font-size:8.6pt">' + esc(f.betrag || '') + '</td></tr>'; }).join('') + '</table>'
        : '<p>Für diese Angaben haben wir kein passendes Programm gefunden.</p>')
      + '<div class="box"><b>Tipp:</b> Lass vor dem ersten Auftrag einen Sanierungsfahrplan erstellen. Er bringt bei vielen Einzelmaßnahmen einen Bonus und zeigt dir die sinnvolle Reihenfolge, zum Beispiel erst Dach und Dämmung, dann die Heizung.</div>'
      + '<p class="quelle">Hinweis: Diese Übersicht ist allgemein. Höhe, Bedingungen und Fristen bestimmen die Programme selbst. Vor Vorhabenbeginn bzw. vor dem Kaufvertrag beantragen. DealPilot vermittelt keine Förderung.</p>', 'Förderung');

    /* 11 · Lage, dazu eine Seite Umfeld */
    var LG = e.lage || {};
    var lt = (g.lage ? zeile('Lage im Haus-Score', 'Gewicht 30 %', g.lage.score + ' von 100') : '')
      + (LG.mikro != null ? zeile('Mikrolage', 'direkte Umgebung: Nahversorgung, Verkehr, Grün', LG.mikro + ' von 100') : '')
      + (LG.makro != null ? zeile('Makrolage', 'Wirtschaft, Kaufkraft, Erreichbarkeit des Ortes', LG.makro + ' von 100') : '')
      + (LG.bevoelkerung_trend_pct != null ? zeile('Bevölkerung', 'Entwicklung der letzten Jahre', (Math.abs(LG.bevoelkerung_trend_pct) < 0.2 ? 'stabil, ' : LG.bevoelkerung_trend_pct > 0 ? 'wächst, ' : 'schrumpft, ') + (LG.bevoelkerung_trend_pct >= 0 ? '+ ' : '− ') + pct(Math.abs(LG.bevoelkerung_trend_pct), 1) + ' im Jahr') : '')
      + (LG.angebotsdauer_tage ? zeile('Markttempo', 'wie lange Angebote im Schnitt online sind', zahl(LG.angebotsdauer_tage) + ' Tage') : '');
    var lageNr = kapNr();
    seite('Lage', '<p class="ober">' + lageNr + ' · Lage und Umfeld</p><h2>' + (g.lage ? (g.lage.score >= 70 ? 'Gute Lage' : g.lage.score >= 50 ? 'Durchschnittliche Lage' : 'Einfache Lage') : 'Lage') + (LG.ort ? ' in ' + esc(LG.ort) : '') + '</h2>'
      + '<table>' + lt + '</table>' + (e.karte ? '<div class="lagekarte"><img src="' + e.karte + '" alt="Karte der Umgebung"></div>' : '')
      + '<div class="box">Für den Wert zählt die Lage stark. Für dich zählt dazu, was die Karte nicht zeigt: Nachbarschaft, Schulweg, Licht am Abend. Geh einmal am Abend und einmal am Wochenende vorbei.</div>'
      + '<p class="quelle">Was in der Nähe ist, steht auf der nächsten Seite.</p>', 'Lage und Umfeld');
    var ut = U && U.ok ? '<table class="eng"><tr><th>In der Nähe</th><th class="z">Entfernung</th><th class="z">zu Fuß</th></tr>' + U.kategorien.slice(0, 14).map(function (k) {
      var n = k.naechster;
      return '<tr><td>' + esc(k.label) + (n && n.name ? '<small>' + esc(n.name) + '</small>' : '') + '</td><td class="z">' + (k.nicht_ermittelt ? 'nicht ermittelt' : n ? (n.luftlinie_m < 1000 ? zahl(n.luftlinie_m) + ' m' : zahl(n.luftlinie_m / 1000, 1) + ' km') : 'nicht im Umkreis') + '</td><td class="z">' + (n ? 'ca. ' + n.fuss_min + ' Min.' : '–') + '</td></tr>';
    }).join('') + '</table><p class="quelle">' + esc(U.hinweis || '') + '</p>' : '<p>Das Umfeld war beim Erstellen nicht abrufbar.</p>';
    seite('Umfeld', '<p class="ober">' + lageNr + ' · Lage und Umfeld</p><h2>Was ist in der Nähe?</h2><p class="unter">Supermarkt, Schule, Arzt, Bus und Bahn rund um die Anschrift.</p>' + ut);

    /* 11b · Region wie im Marktbericht (pp6): Bevölkerung, Wanderung, Kaufkraft, Arbeitsmarkt, Wohnen (Zensus 2022), Bodenrichtwert.
       Dieselben Werte und Bezeichnungen wie der Marktbericht, jede Zahl mit Stand und Gebiet, Quellen nur im Kapitel Quellen. */
    var RG = e.region || null;
    if (RG && (RG.werte && RG.werte.length || RG.zensus || RG.brw)) {
      var fmtW = function (w) { var n = w.nachkomma != null ? w.nachkomma : 1, v = Number(w.wert); return (w.vorzeichen && v > 0 ? '+ ' : w.vorzeichen && v < 0 ? '− ' : '') + zahl(w.vorzeichen ? Math.abs(v) : v, n); };
      var EINH = function (w) { return String(w.einheit || '').replace(/p\. ?a\./, 'im Jahr').replace(/\((Deutschland = 100)\)/, '$1').trim(); };
      var rk = (RG.werte || []).slice(0, 4).map(function (w) {
        var einh = EINH(w), kurz = einh === '%' || einh === '% im Jahr' ? ' %' : '';
        return kachel(esc(w.label), fmtW(w) + kurz, esc((kurz ? einh.replace(/^%\s*/, '') : einh) + (einh && einh !== '%' ? ', ' : '') + (w.ebene ? w.ebene + ' ' : '') + (w.gebiet || '')) + (w.jahr ? ', Stand ' + w.jahr : ''));
      }).join('');
      var zz = RG.zensus, zg = zz && zz.gemeinde, zk = zz && zz.kreis;
      var zt = function (l, klein, k) { return zeile(l, klein, (zg && zg[k] != null ? pct(zg[k], 1) : '–') + (zk && zk[k] != null ? ' <span style="color:var(--mut)">(Kreis ' + pct(zk[k], 1) + ')</span>' : '')); };
      var reg = '<p class="ober">' + lageNr + ' · Lage und Umfeld</p><h2>Region' + (zg && zg.name ? ' ' + esc(zg.name) : '') + '</h2>'
        + '<p class="unter">Wie sich Ort und Kreis entwickeln. Dieselben Kennzahlen wie im DealPilot-Marktbericht, jeweils mit Stand.</p>'
        + (rk ? '<div class="kacheln">' + rk + '</div>' : '')
        + (RG.makro_score != null ? '<p class="quelle">Makrolage ' + RG.makro_score + ' von 100, gebildet aus diesen Kennzahlen.</p>' : '');
      if (zz) reg += '<h3>Wohnen am Ort</h3><table class="eng"><tr><th>Kennzahl</th><th class="z">' + esc(zg && zg.name ? zg.name : 'Gemeinde') + '</th></tr>'
        + zt('Leerstand', 'Anteil leer stehender Wohnungen', 'leerstand_pct') + zt('Marktaktiver Leerstand', 'sofort vermietbar, kürzer als ein Jahr leer', 'leerstand_markt_pct')
        + zt('Eigentumsquote', 'Wohnungen, die vom Eigentümer selbst bewohnt werden', 'eigentum_pct')
        + zeile('Durchschnittliche Nettokaltmiete', 'alle Mietwohnungen im Bestand', zg && zg.miete_qm ? eur(zg.miete_qm, 2) + ' je m²' : '–')
        + '</table><p class="quelle">Stand Zensus ' + D.datum(zz.stichtag) + '. Die Bestandsmiete aller Wohnungen liegt meist unter der Miete bei Neuvermietung.</p>';
      if (RG.brw) { var bw = RG.brw, dv = bw.vor_qm && bw.vor_stichtag ? (bw.qm / bw.vor_qm - 1) * 100 : null;
        reg += '<h3>Bodenrichtwert</h3><table class="eng">' + zeile('Bodenrichtwert', 'Richtwertzone der Anschrift, Stichtag ' + D.datum(bw.stichtag), eur(bw.qm) + ' je m²')
          + (dv != null ? zeile('Entwicklung', 'seit ' + D.datum(bw.vor_stichtag) + ' (' + eur(bw.vor_qm) + ' je m²)', (dv >= 0 ? '+ ' : '− ') + pct(Math.abs(dv), 1)) : '') + '</table>'; }
      if (M && M.reihe && M.reihe.preis && M.reihe.preis.length > 1) { var p0 = M.reihe.preis[0], p1 = M.reihe.preis[M.reihe.preis.length - 1], m0 = M.reihe.miete && M.reihe.miete[0], m1 = M.reihe.miete && M.reihe.miete[M.reihe.miete.length - 1];
        reg += '<h3>Preise und Mieten am Ort</h3><table class="eng">' + zeile('Angebotspreise', p0.jahr + ' bis ' + p1.jahr + ', je m²', eur(p0.median) + ' auf ' + eur(p1.median))
          + (m0 && m1 ? zeile('Angebotsmieten', m0.jahr + ' bis ' + m1.jahr + ', je m²', eur(m0.median, 2) + ' auf ' + eur(m1.median, 2)) : '') + '</table><p class="quelle">Verlauf als Diagramm im Kapitel Markt am Ort.</p>'; }
      seite('Region', reg);
    }

    /* 12 · Checkliste */
    var BS = window.DpBesichtigung, grp = [];
    try { grp = BS && BS.gruppen ? BS.gruppen({ bj: BJ, art: String(O.objektart || '').toUpperCase() }) : []; } catch (x) { grp = []; }
    var liste = function (G, n, erste) { return '<h3' + (erste ? ' style="margin-top:0"' : '') + '>' + esc(G.titel) + '</h3><ul class="check">' + G.punkte.slice(0, n).map(function (p) { return '<li>' + esc(p.titel) + '</li>'; }).join('') + '</ul>'; };
    var links = grp.filter(function (G) { return G.art !== 'allgemein'; }), rechts = grp.filter(function (G) { return G.art === 'allgemein'; });
    var eigen = '<h3 style="margin-top:0">Aus deinen Angaben</h3><ul class="check">'
      + (O.heizung_baujahr ? '<li>Heizung von ' + esc(O.heizung_baujahr) + ': Typenschild, Wartung</li>' : '<li>Heizung: Baujahr vom Typenschild notieren</li>')
      + (!ETW ? '<li>Oberste Geschossdecke gedämmt? <small>(Pflicht nach Kauf)</small></li>' : '') + '<li>Wohnflächenberechnung zeigen lassen</li></ul>';
    seite('Besichtigung', '<p class="ober">' + kapNr() + ' · Checkliste für die Besichtigung</p><h2>Zum Ausdrucken und Abhaken</h2>'
      + '<div class="zwei"><div>' + eigen + links.map(function (G) { return liste(G, 6, false); }).join('') + '</div>'
      + '<div>' + rechts.map(function (G) { return liste(G, 10, true); }).join('')
      + '<h3>Meine Notizen</h3>' + new Array(4).join('<div style="border-bottom:.6px solid var(--linie);height:9mm"></div>') + '</div></div>'
      + '<p class="quelle">Hinweise für die Besichtigung, keine Gutachteraussage.</p>', 'Checkliste für die Besichtigung');

    /* 13 · Kaufnebenkosten und Bank */
    seite('Nebenkosten', '<p class="ober">' + kapNr() + ' · Kaufnebenkosten</p><h2>Was zum Kaufpreis dazukommt</h2><table><tr><th>Posten</th><th class="z">Betrag</th></tr>'
      + zeile('Grunderwerbsteuer', NK.grest_pct ? pct(NK.grest_pct, 1) + ' im Bundesland' : 'Satz des Bundeslands', eur(NK.grest))
      + zeile('Notar', 'Kaufvertrag und Grundschuld nach Gerichts- und Notarkostengesetz, mit Umsatzsteuer', eur(NK.notar))
      + zeile('Grundbuchamt', 'Eigentumsumschreibung und Grundschuld', eur(NK.grundbuch))
      + zeile('Makler', NK.makler_pct ? pct(NK.makler_pct, 2) + ' Käuferanteil mit Umsatzsteuer' : 'Käuferanteil laut Exposé', eur(NK.makler))
      + zeile('Kaufnebenkosten gesamt', pct(NK.pct, 1) + ' des Kaufpreises', eur(NK.summe), 'summe') + '</table>'
      + '<div class="box">Notar- und Grundbuchkosten sind gesetzlich festgelegt und bei jedem Notar gleich. Banken finanzieren die Nebenkosten oft nicht mit, plane sie aus dem Eigenkapital.</div>'
      + (L && L.verfuegbar !== false && L.beleihungswert ? '<h3>Für das Bankgespräch</h3><table class="eng">' + zeile('Beleihungswert, indikativ', 'nach der Beleihungswertverordnung, die Bank bewertet selbst', eur(L.beleihungswert))
        + zeile('Beleihungsauslauf', 'Darlehen geteilt durch Beleihungswert', L.auslauf_pct != null ? pct(L.auslauf_pct, 0) : pct(F.darlehen / L.beleihungswert * 100, 0)) + '</table>' : '')
      + '<h3>Unterlagen für die Bank</h3><ul class="p"><li>Exposé, Grundriss, Wohnflächenberechnung</li><li>Energieausweis</li><li>Grundbuchauszug, Flurkarte</li>'
      + (ETW ? '<li>Teilungserklärung, letzte drei Protokolle, Wirtschaftsplan</li>' : '<li>Baubeschreibung, Liste der Modernisierungen</li>') + '<li>Einkommensnachweise, Eigenkapitalnachweis</li></ul>'
      + (e.anrechnung && e.anrechnung.code ? '<div class="box"><b>Weiter in DealPilot:</b> Buchst du bis ' + esc(D.datum(e.anrechnung.bis)) + ' ein Paket, rechnet DealPilot ' + esc((e.anrechnung.cents / 100).toFixed(2).replace('.', ',')) + ' € an. Code ' + esc(e.anrechnung.code) + '.</div>' : ''), 'Kaufnebenkosten und Bank');

    /* 14 · Quellen */
    var q = zeile('Objektdaten', 'deine Angaben, Kapitel Grundangaben', null)
      + zeile('Wert', 'Verfahren nach ImmoWertV mit Bodenrichtwert, Normalherstellungskosten und Sachwertfaktor des zuständigen Gutachterausschusses', null)
      + zeile('Marktpreisindikation und Markt am Ort', 'Angebotspreise und Angebotsmieten vergleichbarer Objekte im Umkreis, mit Abschlag auf übliche Kaufpreise', null)
      + zeile('Ersparte Miete', 'Mietspiegel der Gemeinde, sonst DealPilot-Näherung aus amtlichen Marktmieten, mit Hauszuschlag', null)
      + zeile('Zins', 'Bauzins von heute je Beleihung und Zinsbindung', null) + zeile('Nebenkosten', 'Grundsteuer und Trinkwasserentgelt je Gemeinde, übrige Posten als Durchschnitt', null)
      + zeile('Kaufnebenkosten', 'Grunderwerbsteuer des Landes, Gerichts- und Notarkostengesetz', null) + zeile('Lage und Umfeld', 'amtliche Statistiken, Kartendaten', null);
    var lz = [];
    (W && W.quellen || []).forEach(function (x) { lz.push(esc(glatt(x.vermerk)) + (x.kennzahlen && x.kennzahlen.length ? ' (' + esc(x.kennzahlen.join(', ')) + ')' : '')); });
    lz.push('Grundsteuer und Trinkwasserentgelt: Statistische Ämter des Bundes und der Länder, Deutschland, dl-de/by-2-0, eigene Ableitung je m² Wohnfläche');
    if (M && M.aus_markt) lz.push('© by RealEstatePilot (Angebotspreise und Angebotsmieten am Markt)');
    lz.push('Kartendaten © OpenStreetMap-Mitwirkende' + (U && U.vermerk && /Geoapify/.test(U.vermerk) ? ', Geoapify' : ''));
    seite('Quellen', '<p class="ober">' + kapNr() + ' · Quellen und Methodik</p><h2>Woher die Zahlen kommen</h2><table class="eng">' + q + '</table>'
      + '<h3>Quellennachweis</h3><ul class="p quelle">' + lz.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'
      + '<div class="box"><b>Grenzen.</b> Dieser Bericht ist eine Entscheidungshilfe, kein Gutachten und keine Finanzierungszusage. Er ersetzt nicht die Besichtigung, die Prüfung durch einen Fachbetrieb und den Blick ins Grundbuch. Für Bank, Erbschaft oder Gericht ein Verkehrswertgutachten beauftragen.</div>', 'Quellen und Methodik');

    /* Inhalt füllen und Seiten zusammensetzen */
    var N = S.length;
    S[1][1] = '<p class="ober">Inhalt</p><h2>Was in diesem Bericht steht</h2><table class="toc">' + KAP.map(function (k) { return '<tr><td class="n">' + k[0] + '</td><td>' + esc(k[1]) + '</td><td class="z">' + (k[2] + 1) + '</td></tr>'; }).join('') + '</table>'
      + '<div class="box"><b>So liest du den Bericht.</b> Seite 3 sagt dir in einer Minute, ob das Haus zu dir passt. Die folgenden Kapitel zeigen, wie wir darauf kommen. Jede Zahl steht mit ihrer Herkunft da: aus deiner Angabe, aus amtlichen Daten oder aus dem aktuellen Marktdurchschnitt.</div>';
    var html = S.map(function (s, i) {
      var kopf = i === 0 ? '' : '<div class="kopf">' + (logo ? '<img src="' + logo + '" alt="DealPilot">' : '<span class="wort">DealPilot</span>') + '<div class="r">Haus-Check · ' + esc(s[0]) + '<br>' + esc(ORT) + '</div></div>';
      var fuss = '<div class="fuss"><span>' + (i === 0 || i === N - 1 ? 'DealPilot · Junker Solution · info@dealpilot.immo' : 'DealPilot · Haus-Check') + '</span><span>' + (i === 0 ? 'Entscheidungshilfe, kein Gutachten · ' : 'Stand ' + D.datum(new Date()) + ' · ') + 'Seite ' + (i + 1) + ' von ' + N + '</span></div>';
      return '<section class="seite">' + kopf + s[1] + (e.mitFuss ? fuss : '') + '</section>';
    }).join('\n');
    return '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>DealPilot Haus-Check · ' + esc(O.adresse || '') + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">'
      + '<style>' + CSS + '</style></head><body>' + html + '</body></html>';
  }

  function hilfen() {
    var istZahl = function (v) { return v != null && v !== '' && isFinite(Number(v)); };
    var zahl = function (v, d) { return istZahl(v) ? Number(v).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '–'; };
    return {
      esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); },
      zahl: zahl, eur: function (v, d) { return istZahl(v) ? zahl(v, d || 0) + ' €' : '–'; }, pct: function (v, d) { return istZahl(v) ? zahl(v, d == null ? 2 : d) + ' %' : '–'; },
      jahr: function (v) { return istZahl(v) ? String(Math.round(Number(v))) : '–'; },
      datum: function (s) { if (!s) return ''; var d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleDateString('de-DE'); }
    };
  }

  /** e wie oben. Rückgabe Promise<html>. */
  /* Logo IMMER die Originaldatei, dieselbe wie im Deal-Check-PDF (landing/assets/dealpilot-logo-2026.png, 512 x 161, eigener
     schwarzer Rahmen mit Goldkante). Als data:-URL, damit der Druckdienst sie ohne Netz hat. Kein Nachbau, keine Ersatzschrift. */
  var LOGO = null;
  function logoLaden() {
    if (LOGO) return Promise.resolve(LOGO);
    var basis = /^app./.test(location.hostname) ? location.origin + '/landing' : location.origin;
    return fetch(basis + '/assets/dealpilot-logo-2026.png').then(function (r) { return r.ok ? r.blob() : null; }).then(function (bl) {
      if (!bl) return null;
      return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { LOGO = String(fr.result || '') || null; ok(LOGO); }; fr.onerror = function () { ok(null); }; fr.readAsDataURL(bl); });
    }).catch(function () { return null; });
  }
  function dokument(e) {
    return logoLaden().then(function (logo) { return bauen(e, hilfen(), logo); });
  }
  window.DpHausCheck = { dokument: dokument, bauen: function (e) { return bauen(e, hilfen(), null); },
    vorschau: function (e) { return dokument(e).then(function (h) { window.DpDokument.vorschau(h, 'Haus-Check'); return h; }); }, version: 'v5150pp6' };
})();
