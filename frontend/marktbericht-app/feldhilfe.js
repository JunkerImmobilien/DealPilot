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

  function box(feld, txt) {
    var alt = document.querySelector('.fh-box[data-fh-for="' + feld + '"]');
    if (alt) { alt.remove(); return null; }
    var el = $(feld);
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
    if (!t) return null;
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
        if (t) box(f, t);
      });
    });
    ['baustatus', 'cond'].forEach(function (f) {
      var e = $(f);
      if (!e) return;
      ankerZeigen(f);
      e.addEventListener('change', function () { ankerZeigen(f); });
    });
    var bs = $('baustatus');
    if (bs) { bs.addEventListener('change', baustatusAnwenden); baustatusAnwenden(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Feldhilfe = { texte: TEXTE, neuLaden: start };
})();
