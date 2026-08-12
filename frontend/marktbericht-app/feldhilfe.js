/* feldhilfe.js — Erklärungen an den Eingabefeldern der Wertermittlung.
 * ────────────────────────────────────────────────────────────────────────────
 * Konzept Kap. 6: drei Ebenen.
 *   1  Ankertext   steht unter der Option, immer sichtbar, kein Klick
 *   2  Kurzhilfe   ⓘ am Feld: was ist gemeint, was ist ein typischer Wert
 *   3  Ausführlich aufklappbar: Rechtsgrundlage, Wirkung, Beispiel
 *
 * KONTEXTSENSITIV: die Hilfe kennt den Zustand des Formulars. Bei Baustatus
 * "Neubau" steht am Modernisierungsblock nicht die allgemeine Erklärung,
 * sondern der Hinweis, dass dort nichts einzutragen ist — und der Block wird
 * ausgeblendet, NICHT auf null gesetzt. Eine Null wird mitgerechnet,
 * ein "nicht anwendbar" nicht.
 *
 * Texte stehen hier als Daten, nicht im Code — änderbar ohne Logik anzufassen.
 * Farben über die --wl-Ebene, keine harte Marke in den Texten.
 */
(function () {
  'use strict';

  var AN = 'dp_feldhilfe';          // Einstellung: Erklärungen anzeigen
  var $ = function (id) { return document.getElementById(id); };

  /* ── Die Texte ─────────────────────────────────────────────────────────── */
  var TEXTE = {
    baustatus: {
      kurz: 'Steuert, welche weiteren Angaben nötig sind. Ein Neubau hat keine Modernisierung — dort verschwindet der Block, statt auf null zu stehen.',
      lang: 'Neubau-Erstbezug und Erstbezug nach Sanierung sind bewertungstechnisch gegensätzlich: der Neubau hat die volle Nutzungsdauer und keine Alterswertminderung, die sanierte Bestandsimmobilie einen maximalen Modernisierungsgrad bei verkürzter Restnutzungsdauer. Steuerlich ist der Unterschied noch größer — beim Erstbezug nach Sanierung wird die 15-%-Grenze für anschaffungsnahe Herstellungskosten scharf.',
      grund: 'ImmoWertV 2021; § 6 Abs. 1b EStG',
      anker: {
        bestand: 'Gebäude ist in Nutzung, keine Erstvermietung.',
        bestand_erstbezug_saniert: 'Umfassend modernisiert, danach erstmals wieder vermietet oder bezogen.',
        neubau_erstbezug: 'Fertiggestellt und noch nie genutzt.',
        neubau_im_bau: 'Noch nicht fertiggestellt — Bewertung auf den Zustand nach Fertigstellung.',
        geplant: 'Baubeginn steht aus. Wertermittlung nur eingeschränkt möglich.'
      }
    },
    cond: {
      kurz: 'Zustand des Gebäudes zum Bewertungsstichtag. Zwei Nutzer sollen beim selben Objekt dieselbe Stufe wählen — deshalb die Kurzbeschreibungen.',
      anker: {
        erstbezug: 'Neubau, noch nie genutzt.',
        neuwertig: 'Wie neu, keinerlei Gebrauchsspuren.',
        gepflegt: 'Laufende Instandhaltung, keine erkennbaren Mängel.',
        saniert: 'Wesentliche Gewerke erneuert.',
        kernsaniert: 'Bis auf den Rohbau zurückgebaut und neu aufgebaut.',
        renovierungsbeduerftig: 'Nutzbar, aber Instandhaltungsstau erkennbar.',
        renovierungsstau: 'Mehrere Gewerke überfällig, Investition kurzfristig nötig.'
      }
    },
    plot: {
      kurz: 'Grundstücksfläche in m². Ohne sie kein Bodenwert — und ohne Bodenwert rechnet das Ertragswertverfahren nur in der vereinfachten Form.',
      lang: 'Steht im Kaufvertrag, im Grundbuchauszug oder im Liegenschaftskataster. Bei einer Eigentumswohnung ist es die Fläche des gesamten Grundstücks; der eigene Anteil ergibt sich erst über den Miteigentumsanteil.',
      grund: '§ 40 ImmoWertV'
    },
    mea: {
      kurz: 'Miteigentumsanteil in Prozent, nur bei Eigentumswohnungen. Aus der Teilungserklärung, dort meist als Bruch (z. B. 125/1000 = 12,5 %).',
      lang: 'Der Bodenwert des Gesamtgrundstücks wird mit diesem Anteil multipliziert. Ohne Angabe rechnet die Wertermittlung mit dem vollen Grundstück und überschätzt den Wohnungswert erheblich.',
      grund: '§ 3 WEG'
    },
    /* v1142-GARMEA · Das Feld trug ein ⓘ, das nichts tat: `garagenBgf` stand
     * als Hilfe-Schlüssel in wertermittlung.js, aber nicht hier — und
     * textFuer() kennt keinen Rückfall auf die dortigen Texte.
     *
     * Inhaltlich der Punkt, der den Hinweis nötig macht: lib/nhk2010.js
     * kennt weder mea noch ist_wohnung, die Fläche geht also UNGEKÜRZT in
     * den Sachwert. Beim Bodenwert wird der Miteigentumsanteil abgezogen,
     * hier nicht, und dieser Unterschied stand nirgends. Am Prüfobjekt
     * Hüllhorst standen 64,58 m² für eine von drei Einheiten. */
    garagenBgf: {
      kurz: 'Länge × Breite der Garagen, die zu <b>dieser</b> Bewertung gehören — nicht die Zahl der Stellplätze. Bei einer Eigentumswohnung also nur die eigene Garage oder der eigene Anteil; wird das ganze Gebäude bewertet, kommen alle hinein.',
      lang: '<b>Der Miteigentumsanteil wird hier nicht automatisch abgezogen</b> — anders als beim Bodenwert. Die Fläche geht so in den Sachwert ein, wie sie hier steht. Die NHK 2010 führen für Garagen eigene Kostenkennwerte (Gebäudeart 14.1) und eine eigene Gesamtnutzungsdauer von 60 Jahren; eine Garage hält nicht so lange wie das Wohnhaus. Ohne Fläche wird sie nicht angesetzt.',
      grund: '§ 36 ImmoWertV · NHK 2010, Gebäudeart 14.1'
    },
    /* ── v1146-FHTEXT · Neun Felder trugen ein ⓘ, das nichts tat ──────────
     * `wertermittlung.js` vergab 18 Hilfe-Schlüssel, `TEXTE` führte 10 —
     * und `textFuer()` kennt keinen Rückfall: fehlt der Schlüssel, gibt es
     * `null` zurück und der Klick verpufft still. Betroffen waren
     * ausgerechnet die erklärungsbedürftigsten Felder.
     *
     * Sechs Texte gab es längst — im HILFE-Block von `wertermittlung.js`,
     * wo sie nie jemand zu sehen bekam. Sie sind hierher überführt und in
     * kurz/lang geteilt; drei (Standardstufe, Modernisierungsgrad,
     * Grundriss) sind neu. */
    standardstufe: {
      kurz: 'Bauqualität des Gebäudes in fünf Stufen. Stufe 3 ist der Durchschnitt, Stufe 1 einfachst, Stufe 5 aufwendig. Sie steuert den Kostenkennwert und damit den ganzen Sachwert.',
      lang: 'Die Stufen der Sachwertrichtlinie beschreiben Fenster, Dach, Heizung, Sanitär und Ausbau zusammengefasst. Eine Stufe Unterschied verschiebt die Herstellungskosten je nach Gebäudetyp um 15 bis 25 Prozent — es lohnt, hier genau zu sein. Wer es feiner will, füllt stattdessen die neun Gewerke einzeln aus; sind alle gesetzt, haben sie Vorrang vor dieser glatten Stufe.',
      grund: 'SW-RL 2012, Anlage 1 · NHK 2010'
    },
    modGrad: {
      kurz: 'Modernisierungspunkte nach SW-RL. Sie verlängern die Restnutzungsdauer eines älteren Gebäudes — ohne sie rechnet der Bericht mit dem reinen Baujahr.',
      lang: 'Bewertet werden Dach, Fenster, Leitungen, Heizung, Bäder, Böden, Grundriss und Wärmedämmung mit je 0 bis 4 Punkten. Aus der Summe leitet sich das fiktive Baujahr ab. Bei einem Haus von 1964 macht eine durchgreifende Modernisierung schnell zwanzig Jahre Restnutzungsdauer aus — und die geht über den Barwertfaktor direkt in den Ertragswert.',
      grund: 'SW-RL 2012, Anlage 4 · § 4 Abs. 3 ImmoWertV'
    },
    grundriss: {
      kurz: 'Wohnungszuschnitt im Gebäude — Zweispänner, Dreispänner, Laubengang. Er korrigiert den Kostenkennwert nach oben oder unten.',
      lang: 'Je mehr Wohnungen an einem Treppenhaus hängen, desto günstiger wird der Quadratmeter: die Erschließungsfläche verteilt sich auf mehr Einheiten. Die NHK 2010 führen dafür eigene Korrekturfaktoren. Ohne Angabe rechnet der Bericht ohne Korrektur — das ist die neutrale Annahme, kein Schätzwert.',
      grund: 'NHK 2010, Korrektur Grundrissart'
    },
    hinterland: {
      kurz: 'Nur die zusätzliche Fläche eintragen, die über das normale Baugrundstück hinausgeht — nicht die gesamte Grundstücksfläche, sie würde doppelt gezählt.',
      lang: 'Beispiel: 1.000 m² Grundstück, davon 800 m² Bauland und 200 m² Hinterland — hier gehören die 200 hinein, nicht die 800 und nicht die 1.000. Die Fläche wird getrennt bewertet, weil sie nicht denselben Wert hat wie das Baugrundstück (§ 41 ImmoWertV).',
      grund: '§ 41 ImmoWertV'
    },
    hinterlandRent: {
      kurz: 'Rentierlich heißt: die Fläche wirft einen Ertrag ab, etwa weil sie verpachtet ist. Das ist die Ausnahme.',
      lang: 'Eine <b>nicht</b> rentierliche Fläche geht in den Bodenwert ein, unterliegt aber nicht der Bodenwertverzinsung im Ertragswertverfahren — sonst mindert sie den Gebäudeertrag, obwohl sie gar keinen tragen soll. Der Haken ist damit eine der wenigen Stellen, an denen eine einzelne Angabe den Ertragswert spürbar verschiebt.',
      grund: '§ 41 ImmoWertV'
    },
    garagenStufe: {
      kurz: 'Stufe 3 sind Fertiggaragen, Stufe 4 Massivbauweise, Stufe 5 massiv mit besonderer Ausführung (Ziegel- oder Gründach, Fliesen, Wasser und Heizung).',
      lang: 'Kostenkennwerte 245 / 485 / 780 €/m² BGF, Stand 2010 — sie werden mit dem Baupreisindex auf den Stichtag gebracht. Zwischen Stufe 3 und 5 liegt gut das Dreifache; bei einer Doppelgarage macht das im Sachwert mehrere zehntausend Euro aus.',
      grund: 'NHK 2010, Gebäudeart 14.1'
    },
    aussenPct: {
      kurz: 'Wege, Hofflächen, Einfriedungen, Ver- und Entsorgungsanlagen — als Prozentsatz des Gebäudesachwerts.',
      lang: 'Übliche Ansätze liegen zwischen 5 und 7 Prozent; manche Gutachterausschüsse geben stattdessen feste Beträge vor (Minden-Lübbecke: Kanal 2.900 €, Einfahrt 2.500 €, Terrasse 2.000 €). Ist oben ein Eurobetrag eingetragen, hat der Vorrang. Weil der Wert am Gebäudesachwert hängt, skaliert er bei einer Eigentumswohnung automatisch mit — anders als die Garagenfläche.',
      grund: '§ 36 Abs. 3 ImmoWertV'
    },
    ausstGewerk: {
      kurz: 'Feinere Alternative zur glatten Standardstufe: je Gewerk eine Stufe 1–5, halbe Stufen erlaubt.',
      lang: 'Gerechnet wird nur, wenn <b>alle neun</b> Gewerke gesetzt sind — sonst gilt die glatte Standardstufe oben. Das ist Absicht: eine halb gefüllte Gewerkeliste wäre genauer aussehend, aber ungenauer. Die Gewichte stehen in der Feldbezeichnung (Außenwände 23 % … sonstige Technik 6 %).',
      grund: 'SW-RL 2012, Anlage 2'
    },
    bauteilHk: {
      kurz: 'Herstellungskosten besonderer Bauteile zum heutigen Stichtag, ohne erneute Indexierung.',
      lang: 'Sie unterliegen derselben Alterswertminderung wie das Gebäude. Größenordnung am Beispiel Löhner Straße: Gauben 51.000, Balkone 13.000, Vordach 10.000, Terrassen 18.000, Sonstiges 3.000 €. Gemeint sind Bauteile, die im Kostenkennwert nicht enthalten sind — nicht die normale Ausstattung.',
      grund: '§ 36 Abs. 2 ImmoWertV'
    },
    lzs: {
      kurz: 'Liegenschaftszinssatz in Prozent. Die größte Stellschraube im ganzen Verfahren — ein halber Punkt verschiebt den Ertragswert um rund acht Prozent.',
      lang: 'Er stammt aus dem Grundstücksmarktbericht des örtlichen Gutachterausschusses. Liegt keiner vor, greift der gesetzliche Auffangwert nach § 256 BewG — der ist nicht marktabgeleitet, liegt in der Regel darunter und erzeugt damit einen eher hohen Ertragswert. Die verwendete Stufe steht im Ergebnis und im PDF.',
      grund: '§ 21 Abs. 2 ImmoWertV; § 256 BewG'
    },
    bgf: {
      kurz: 'Die Bruttogrundfläche ist die Summe aller Grundrissebenen, außen gemessen — nicht die Wohnfläche.',
      lang: 'Gemessen werden alle Geschosse an den Außenkanten, einschließlich Wände, Treppenhaus, Keller und ausgebautem Dachgeschoss. Sie ist deshalb deutlich größer als die Wohnfläche: bei einem Einfamilienhaus grob das Anderthalbfache. Der Sachwert rechnet mit ihr, weil die Herstellungskosten je Quadratmeter Bruttogrundfläche angegeben sind. Steht sie in den Bauunterlagen, trag sie ein — jede Schätzung überträgt sich eins zu eins auf den Sachwert.',
      grund: 'DIN 277 · Anlage 4 ImmoWertV'
    },
    sachwertfaktor: {
      kurz: 'Rechnet den Sachwert auf das örtliche Marktniveau um. Leer lassen, wenn kein amtlicher Wert vorliegt.',
      lang: 'Der Sachwert aus Herstellungskosten und Bodenwert ist noch kein Marktwert — er sagt, was der Bau kosten würde, nicht was jemand zahlt. Der Sachwertfaktor stellt diese Verbindung her: in schwachen Märkten liegt er bei 0,7, in gefragten Lagen über 1,3. Er wird vom Gutachterausschuss aus tatsächlichen Kaufpreisen abgeleitet und steht im Grundstücksmarktbericht. Ohne ihn weist der Bericht nur den vorläufigen Sachwert aus, mit entsprechendem Hinweis.',
      grund: '§ 21 Abs. 3 ImmoWertV'
    },
    brwManuell: {
      kurz: 'Bodenrichtwert in €/m². Leer lassen, wenn der amtliche Abruf funktioniert — er wird dann automatisch geholt.',
      lang: 'In Bayern, Baden-Württemberg, im Saarland und in Schleswig-Holstein gibt es keinen freien Abrufdienst; dort ist die manuelle Eingabe der einzige Weg. Den Wert findest du im BORIS-Portal deines Bundeslandes: Adresse suchen, auf das Grundstück klicken, Wert und Stichtag ablesen. Achte darauf, den Richtwert für die richtige Nutzungsart zu nehmen — für eine Wohnung ist das die Wohnbaufläche.',
      grund: '§ 196 BauGB'
    },
    brwAnp: {
      kurz: 'Prozentuale Anpassung des Bodenrichtwerts für Zuschnitt, Ecklage oder Tiefe. Ohne Begründung im Dossier nicht verwertbar.',
      grund: '§ 40 Abs. 3 ImmoWertV'
    }
  };

  /* ── Anzeige ───────────────────────────────────────────────────────────── */
  function aktiv() {
    try { return localStorage.getItem(AN) !== '0'; } catch (e) { return true; }
  }

  function stil() {
    if ($('fh-css')) return;
    var s = document.createElement('style');
    s.id = 'fh-css';
    s.textContent =
      '.fh{cursor:pointer;color:var(--wl-c9a84c,#C9A84C);font-size:13px;margin-left:5px;opacity:.75}' +
      '.fh:hover{opacity:1}' +
      '.fh-box{margin:6px 0 2px;padding:9px 11px;background:rgba(201,168,76,.06);' +
      'border-left:2px solid var(--wl-c9a84c,#C9A84C);border-radius:4px;font-size:12px;line-height:1.5;color:#b9b9c2}' +
      '.fh-box b{color:var(--wl-e8cc7a,#E8CC7A);font-weight:600}' +
      '.fh-more{margin-top:6px;cursor:pointer;color:var(--wl-c9a84c,#C9A84C);font-size:11.5px}' +
      '.fh-grund{margin-top:5px;font-size:11px;color:#7a7a84;font-style:italic}' +
      '.fh-anker{font-size:11.5px;color:#8a8a93;margin-top:4px;line-height:1.45}';
    document.head.appendChild(s);
  }

  function box(feld, txt, anker) {
    var alt = document.querySelector('.fh-box[data-fh-for="' + feld + '"]');
    if (alt) { alt.remove(); return null; }
    /* v1146b-FHANKER · Nicht jeder Hilfe-Schlüssel ist eine Feld-Id.
     * `hinterland`, `ausstGewerk` und `bauteilHk` stehen für ganze
     * Feldgruppen — das ⓘ hängt dort 9× bzw. 5× an verschiedenen Feldern
     * (`ausstAussenwaende`, `btlGauben`, …). `$(feld)` findet dann nichts
     * und der Kasten wurde **still** gar nicht erst gebaut: der Text war
     * vorhanden, `textFuer()` warnte zu Recht nicht, und trotzdem passierte
     * beim Klick nichts. Genau der Fehler, den v1146 beheben sollte — nur
     * eine Ebene tiefer.
     *
     * Rückfall auf das angeklickte Zeichen selbst: es steht immer im Label
     * des Feldes, zu dem die Erklärung gehört. */
    var el = $(feld) || anker;
    if (!el) return null;
    var d = document.createElement('div');
    d.className = 'fh-box';
    d.setAttribute('data-fh-for', feld);
    var html = '<b>' + (txt.titel || 'Hinweis') + '</b><br>' + txt.kurz;
    if (txt.lang) html += '<div class="fh-more" data-lang="1">▸ mehr</div><div style="display:none">' + txt.lang + '</div>';
    if (txt.grund) html += '<div class="fh-grund">' + txt.grund + '</div>';
    d.innerHTML = html;
    (el.parentNode || document.body).appendChild(d);
    var m = d.querySelector('.fh-more');
    if (m) m.addEventListener('click', function () {
      var n = m.nextSibling;
      var auf = n.style.display === 'none';
      n.style.display = auf ? 'block' : 'none';
      m.textContent = auf ? '▾ weniger' : '▸ mehr';
    });
    return d;
  }

  /* Kontextsensitiv: der Text richtet sich nach dem, was gewählt ist. */
  function textFuer(feld) {
    var t = TEXTE[feld];
    /* v1146-FHTEXT · Ein stiller Rückfall sieht aus wie ein bestandener
     * Lauf. Genau so blieben neun Info-Zeichen unbemerkt wirkungslos: der
     * Klick fand keinen Text, gab `null` zurück, und niemand erfuhr davon
     * — weder Nutzer noch Entwickler. Fehlende Module laut melden, nicht
     * im Rückfall verschwinden lassen (dieselbe Lehre wie beim
     * DPC-Alias). */
    if (!t) {
      try {
        console.warn('[feldhilfe] kein Text für Feld "' + feld
          + '" — das Info-Zeichen bleibt wirkungslos. Eintrag in TEXTE fehlt.');
      } catch (e) {}
      return null;
    }
    var out = { kurz: t.kurz, lang: t.lang, grund: t.grund, titel: null };

    if (feld === 'lzs') {
      var bs = $('baustatus') ? $('baustatus').value : '';
      if (bs === 'neubau_erstbezug' || bs === 'neubau_im_bau') {
        out.kurz = 'Bei Neubauten liegt der Liegenschaftszinssatz meist am unteren Rand der örtlichen Spanne. ' + out.kurz;
      }
    }
    if (feld === 'plot') {
      var pt = $('ptype') ? String($('ptype').value).toLowerCase() : '';
      if (/etw|wohnung/.test(pt)) {
        out.titel = 'Bei einer Eigentumswohnung';
        out.kurz = 'Hier gehört die Fläche des GESAMTEN Grundstücks hinein, nicht ein Anteil davon. Den Anteil trägst du separat als Miteigentumsanteil ein.';
      }
    }
    /* v1145-SWFART · Ein Eingabefeld, das den Wert wegwirft, ist schlimmer
     * als keins. Für Eigentumswohnungen (und MFH/Gewerbe) leitet kein
     * Gutachterausschuss Sachwertfaktoren ab; seit v1144 wird ein
     * eingetragener Wert deshalb verworfen — bis dahin verschluckte ihn
     * ohnehin ein Feldname-Fehler. Am Prüfobjekt stand 1,15 im Feld und
     * blieb wirkungslos, ohne dass irgendwo etwas dazu stand. */
    if (feld === 'sachwertfaktor') {
      var pt2 = $('ptype') ? String($('ptype').value).toLowerCase() : '';
      if (/etw|wohnung|whg|mfh|mehrfamilien|gewerbe|buero/.test(pt2)) {
        out.titel = 'Für diese Objektart ohne Wirkung';
        out.kurz = 'Sachwertfaktoren werden nur für Ein- und Zweifamilien-, Doppel- und '
          + 'Reihenhäuser abgeleitet (Abschnitt 5.1.4). Ein hier eingetragener Wert '
          + '<b>wird nicht angewandt</b> — der Bericht weist den vorläufigen Sachwert aus.';
        out.lang = 'Das ist kein Mangel des Berichts: bei einer Eigentumswohnung führt das '
          + 'Vergleichswertverfahren, der Sachwert steht nur zur Einordnung daneben. Einen '
          + 'Faktor aus der Häuser-Ableitung auf eine Wohnung anzuwenden wäre ein '
          + 'Modellbruch (§ 10 ImmoWertV). ' + out.lang;
      }
    }
    return out;
  }

  /* Anker unter den Optionen eines Selects. */
  function ankerZeigen(feld) {
    var t = TEXTE[feld];
    var el = $(feld);
    if (!t || !t.anker || !el) return;
    var id = 'fh-anker-' + feld;
    var d = $(id);
    if (!d) {
      d = document.createElement('div');
      d.id = id; d.className = 'fh-anker';
      (el.parentNode || document.body).appendChild(d);
    }
    d.textContent = t.anker[el.value] || '';
  }

  /* ── v1145-SWFART · Sichtbar, ohne Klick ────────────────────────────────
   * Die Feldhilfe erklärt es erst auf Klick — gemerkt hat es aber niemand:
   * am Prüfobjekt stand 1,15 im Feld und blieb wirkungslos. `ankerZeigen()`
   * taugt hier nicht, es hängt am eigenen Feldwert; hier entscheidet die
   * Objektart nebenan. Deshalb eine eigene kleine Anzeige, die derselben
   * Klasse folgt. */
  function swfWirkung() {
    var el = $('sachwertfaktor');
    var id = 'fh-swf-aus';
    var d = $(id);
    if (!el) { if (d) d.remove(); return; }
    var pt = $('ptype') ? String($('ptype').value).toLowerCase() : '';
    if (!/etw|wohnung|whg|mfh|mehrfamilien|gewerbe|buero/.test(pt)) {
      if (d) d.remove();
      return;
    }
    if (!d) {
      d = document.createElement('div');
      d.id = id; d.className = 'fh-anker';
      (el.parentNode || document.body).appendChild(d);
    }
    d.textContent = 'Für diese Objektart ohne Wirkung — Sachwertfaktoren werden nur '
      + 'für Ein- und Zweifamilien-, Doppel- und Reihenhäuser abgeleitet.';
  }

  /* Baustatus schaltet den Modernisierungsblock. */
  function baustatusAnwenden() {
    var el = $('baustatus');
    if (!el) return;
    var neubau = /^neubau|^geplant/.test(el.value);
    ['modern', 'modyear'].forEach(function (f) {
      var e = $(f);
      if (!e) return;
      var wrap = e.closest ? e.closest('div') : e.parentNode;
      if (!wrap) return;
      wrap.style.display = neubau ? 'none' : '';
      /* NIE auf 0 setzen — eine Null wird mitgerechnet, "nicht anwendbar" nicht. */
      if (neubau) e.value = '';
    });
    var id = 'fh-neubau-hinweis';
    var alt = $(id);
    if (alt) alt.remove();
    if (neubau) {
      var d = document.createElement('div');
      d.id = id; d.className = 'fh-box';
      d.innerHTML = '<b>Neubau &mdash; hier ist nichts einzutragen.</b><br>'
        + 'Die Restnutzungsdauer entspricht der vollen Gesamtnutzungsdauer, eine Alterswertminderung f&auml;llt nicht an. '
        + 'Der Modernisierungsblock ist deshalb ausgeblendet.';
      (el.parentNode || document.body).appendChild(d);
    }
    /* Erstbezug nach Sanierung: Modernisierung auf Maximum vorbelegen. */
    if (el.value === 'bestand_erstbezug_saniert' && $('modern') && !$('modern').value) {
      $('modern').value = 'kernsaniert';
    }
  }

  function start() {
    if (!aktiv()) return;
    stil();
    document.querySelectorAll('.fh').forEach(function (i) {
      i.addEventListener('click', function () {
        var f = i.getAttribute('data-fh');
        var t = textFuer(f);
        if (t) box(f, t, i.parentNode || i);   /* v1146b: Anker für Gruppen-Schlüssel */
      });
    });
    ['baustatus', 'cond'].forEach(function (f) {
      var e = $(f);
      if (!e) return;
      ankerZeigen(f);
      e.addEventListener('change', function () { ankerZeigen(f); });
    });
    /* v1145-SWFART · Das Feld `sachwertfaktor` liegt im Block wm-b3 und
     * entsteht erst beim Hochstufen — ein einmaliger Aufruf beim Start
     * verpufft deshalb. Am `document` lauschen ist hier billiger als ein
     * Beobachter: die Prüfung ist zwei Feldzugriffe lang. */
    document.addEventListener('change', swfWirkung, true);
    document.addEventListener('input', swfWirkung, true);
    swfWirkung();
    var bs = $('baustatus');
    if (bs) { bs.addEventListener('change', baustatusAnwenden); baustatusAnwenden(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Feldhilfe = { texte: TEXTE, neuLaden: start };
})();
