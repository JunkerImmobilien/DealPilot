/* ═══════════════════════════════════════════════════════════════════════
   dp2-lufeat.js · v1558 · Der Block "Jedes Modul, jede Kennzahl"
   ───────────────────────────────────────────────────────────────────────
   Gemessen am 23.09.2026: leistungsumfang.html enthaelt unter der
   Ueberschrift "Funktionsumfang im Detail" ein <div id="luFeat">, das
   KEIN geladenes Skript fuellt - der Renderer war in der alten
   index.html geblieben. Der Block stand also als leerer Kasten unter
   einer Ueberschrift, und die Hero-Zahl "4 Analyse-Phasen" zeigte auf
   nichts.

   Der Renderer ist von dort unveraendert uebernommen: vier Phasen,
   14 Eintraege, je drei Chips und ein Sprung ins passende Kapitel.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var host=document.getElementById('luFeat'); if(!host) return;
  var PH=[
    {n:'1',t:'Erfassen',s:'// Import',items:[
      ['Boarding &middot; 30 Sekunden','Schnellbewertung mit BMR, Faktor, Cashflow und LTV &mdash; live beim Tippen, direkt &uuml;bernehmbar in die Vollberechnung.'],
      ['PDF-Import mit OCR','Expos&eacute; rein &mdash; die KI liest Kaufpreis, Wohnfl&auml;che, Baujahr, Miete und Hausgeld und f&uuml;llt die Felder. Bilder werden mit &uuml;bernommen.'],
      ['Objekt &amp; Lage','Grunddaten, bis zu 30 Fotos, Makro-/Mikrolage, Energieklasse, Zustand &mdash; die Basis f&uuml;r Lage-Score und Bankexport.']
    ]},
    {n:'2',t:'Rechnen',s:'// Analyse',items:[
      ['Investition &amp; 15-%-Regel','Erwerbsnebenkosten, Sanierung nach 8 Gewerken, m&ouml;blierte Anteile &mdash; mit Live-Warnung an der 15-%-Grenze.'],
      ['Finanzierung','Annuit&auml;t, Tilgungsaussetzung, Bausparvertrag, Anschluss-Stresstest &mdash; mit Live-Marktzinsen aus der Bundesbank-Statistik.'],
      ['Miete, Werbungskosten &amp; Bewirtschaftung','Mietstruktur mit &euro;/m&sup2;-Vergleich, Werbungskosten &uuml;ber 15 Jahre, umlagef&auml;hige vs. nicht-umlagef&auml;hige Kosten getrennt.'],
      ['Steuer &amp; AfA','AfA linear, degressiv und &sect;&nbsp;7b Sonder-AfA, BMF-Rechner f&uuml;r Geb&auml;udeanteil, Steuerverlauf und V+V &uuml;ber die Haltedauer.']
    ]},
    {n:'3',t:'Bewerten','s':'// Co-Pilot',items:[
      ['Investor Deal Score','0&ndash;100 aus 24&nbsp;KPIs in f&uuml;nf Bereichen &mdash; mit anpassbaren Gewichten und lokaler Ampel-Bewertung ohne KI.'],
      ['Co-Pilot (KI)','Web-Recherche zu Lage und Markt, St&auml;rken &amp; Risiken, Verhandlungsempfehlung mit Zielpreis und fertiger Kaufpreis-Offerte als Text.'],
      ['Marktdaten &amp; Marktwert','DealPilot-Marktbewertung, Bodenrichtwert (BORIS), automatischer Mietspiegel-Vergleich &mdash; Marktwert-Indikation &uuml;ber PriceHubble &amp; Sprengnetter.'],
      ['RND-Gutachten','Restnutzungsdauer nach Sachverst&auml;ndigen-Methodik einsch&auml;tzen &mdash; und die Gutachten-Anfrage direkt aus der App stellen.']
    ]},
    {n:'4',t:'Exportieren',s:'// Bank &amp; Portfolio',items:[
      ['Bankexport-PDF','Bankf&auml;higer Investment-Case mit Charts, Tilgungsplan und Co-Pilot-Analyse &mdash; eigenes Logo &amp; Adresse ab Investor.'],
      ['Track-Record &amp; Portfolio','Alle Objekte als suchbare Tabelle, aggregierte Portfolio-Kennzahlen und ein Track-Record-PDF f&uuml;r die Folgefinanzierung.'],
      ['Excel/CSV &amp; API','25-Spalten-Bankexport, JSON-Objektsicherung &mdash; und die DealPilot-API f&uuml;r den programmatischen Zugriff auf deinen Bestand (Pro).']
    ]}
  ];
  var LUX=[
    {sec:'quick-check',chips:['6 Zahlen','30 Sek','1-Klick-Übernahme']},
    {sec:'pdf-import',chips:['1 Min','KI-Extraktion','Bilder inkl.']},
    {sec:'objekt',chips:['bis 30 Fotos','Makro/Mikro','AfA-Anteil']},
    {sec:'investition',chips:['8 Gewerke','15-%-Live-Warnung','Nebenkosten']},
    {sec:'finanzierung',chips:['Live-Zinsen','Anschluss-Stresstest','Bauspar-Zyklus']},
    {sec:'miete',chips:['€/m²-Vergleich','15-J-Verlauf','umlagefähig getrennt']},
    {sec:'steuer',chips:['linear/degressiv/§ 7b','BMF-Rechner','Grenzsteuer 2026']},
    {sec:'dealscore',chips:['24 KPIs','5 Bereiche','0–100']},
    {sec:'ki-analyse',chips:['9 Sektionen','Web-Recherche','1 Credit = 2']},
    {sec:'marktdaten',chips:['DealPilot-Bewertung','BORIS','Mietspiegel']},
    {sec:'rnd',chips:['Restnutzungsdauer','Modernisierung','Anfrage aus App']},
    {sec:'exports',chips:['6-Seiten-PDF','Charts + Tilgung','Logo ab Investor']},
    {sec:'portfolio',chips:['Suchbare Tabelle','Portfolio-KPIs','Track-Record-PDF']},
    {sec:'exports',chips:['25 Spalten','JSON-Sicherung','API (Pro)']}
  ];var _lx=0;
  host.innerHTML=PH.map(function(p){
    return '<div class="lu-phase"><div class="ph-h"><div class="ph-n">'+p.n+'</div><div><div class="ph-t">'+p.t+'</div><div class="ph-s">'+p.s+'</div></div></div>'+
      p.items.map(function(it){var x=LUX[_lx++]||{};var chips=(x.chips||[]).map(function(c){return '<span class="luc-chip">'+c+'</span>';}).join('');var more=x.sec?'<a class="lu-more" data-lugo="'+x.sec+'" href="#lu-'+x.sec+'">Details ansehen →</a>':'';return '<div class="lu-item"><h4>'+it[0]+'</h4><p>'+it[1]+'</p>'+(chips?'<div class="luc-chips">'+chips+'</div>':'')+more+'</div>';}).join('')+'</div>';
  }).join('');
  host.addEventListener('click',function(e){var a=e.target.closest('[data-lugo]');if(!a)return;e.preventDefault();var t=document.getElementById('lu-'+a.getAttribute('data-lugo'));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});});
  /* Jede zweite Phase dunkel - so war es in der alten Seite. */
  host.querySelectorAll(".lu-phase").forEach(function(p,i){ if(i%2===1) p.classList.add("d"); });
})();
