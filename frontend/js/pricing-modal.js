/**
 * DealPilot V63.5 — Pricing-Modal
 *
 * Integriert das angehängte DealPilot-Pakete-Plugin als In-App-Modal.
 * Wird von "Mein Plan" im Sidebar-User-Submenü geöffnet.
 * Stripe-Anbindungs-Hooks vorbereitet (siehe _onPlanSelect / _onCreditsBuy / _onSupportBuy).
 *
 * Plan-Datenstruktur ist mit DealPilotConfig.pricing.plans synchronisiert,
 * aber zusätzlich angereichert für die Plugin-UI (lead, result, ctaText etc.).
 */
(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // PLAN-DEFINITION (synchronisiert mit DealPilotConfig.pricing.plans)
  // ═══════════════════════════════════════════════════════════════
  var PLANS = [
    {
      key: 'free', letter: 'F', label: 'Free', tag: 'Einstieg', title: 'Free',
      lead: 'Beeindrucken, nicht arbeiten. Lernen Sie DealPilot kennen — mit voller Score-Logik im Hintergrund, aber Wasserzeichen auf den Exporten.',
      price_monthly: 0, price_yearly: 0,
      features: [
        '1 Objekt',
        '3 Speicherungen',
        'DealPilot Score (5 Faktoren)',
        'Investor Deal Score (24 KPIs) — Demo',
        '2 L Kerosin / Monat' /* v493-liter */,
        'Alle PDFs mit Wasserzeichen'
      ],
      not_included: null,
      result: 'Sie sehen die volle Tiefe von DealPilot — und entscheiden danach, ob Sie upgraden.',
      ctaText: 'Kostenlos starten',
      /* TR7-trial */
      footnote: '7 Tage Pro inklusive · danach automatisch Free · keine Kreditkarte'
    },
    {
      key: 'starter', letter: 'S', label: 'Starter', tag: 'Privat-Investor', title: 'Starter',
      lead: 'Fühlt sich vollständig an. Volle PDFs ohne Wasserzeichen, Werbungskosten-Modul, Mietspiegel-Vergleich — für die ersten echten Deals.',
      price_monthly: 29, price_yearly: 290,
      features: [
        '5 Objekte',
        'DealPilot Score (5 Faktoren)',
        'Investment-PDF ohne Wasserzeichen',
        'Werbungskosten-Modul vollständig',
        'Mietspiegel-Vergleich (manuell)',
        'Manuelle Marktzinsen',
        '10 L Kerosin / Monat inklusive'
      ],
      not_included: [
        'Investor Deal Score (24 KPIs)',
        'Track-Record',
        'Bankexport',
        'Logo im PDF',
        'Live-Marktzinsen',
        'BMF-Rechner & Export'
      ],
      result: 'Sie liefern professionelle Unterlagen — und sparen sich Excel-Kämpfe.',
      ctaText: 'Starter-Plan starten',
      footnote: 'Bei jährlicher Zahlung sparen Sie 58 € (~17 %)'
    },
    {
      key: 'investor', letter: 'I', label: 'Investor', tag: 'Bestseller', title: 'Investor',
      lead: 'Der Plan für aktive Investoren. Investor Deal Score mit 24 KPIs, Track-Record-PDF, Bankexport, Live-Marktzinsen und BMF-Rechner — alles, was Sie für ernstgemeinte Investments brauchen.',
      price_monthly: 59, price_yearly: 590,
      best: true,
      features: [
        '25 Objekte',
        'Investor Deal Score (24 KPIs)',
        'Track-Record-PDF',
        'Bankexport',
        'Logo & Footer im PDF',
        'Live-Marktzinsen',
        'Mietspiegel — Auto-Vergleich',
        'BMF-Rechner & Export',
        '40 L Kerosin / Monat inklusive'
      ],
      not_included: null,
      result: 'Sie investieren wie ein institutioneller Investor — mit allen KPIs, die Banken und Steuerberater erwarten.',
      ctaText: 'Investor-Plan starten',
      footnote: 'Bei jährlicher Zahlung sparen Sie 118 € (~17 %)'
    },
    {
      key: 'pro', letter: 'P', label: 'Pro', tag: 'Profis · Sachverständige', title: 'Pro',
      lead: 'Für Investoren, Sachverständige und Vermögensverwalter. Unbegrenzte Objekte, Premium-PDF-Layouts, Custom Track-Record Cover und Migration & Setup-Service inklusive.',
      price_monthly: 99, price_yearly: 990,
      features: [
        'Unbegrenzte Objekte',
        'Alle Investor-Features',
        'Premium-PDF-Layouts',
        'Custom Track-Record Cover',
        'BMF-Rechner & Export',
        'Priorisierter Support',
        '100 L Kerosin / Monat inklusive',
        'Migration & Einrichtungsservice (bis 3 h) inkl.'
      ],
      not_included: null,
      result: 'Sie skalieren Ihre Analyse-Kapazität — und können DealPilot direkt im Kundengespräch einsetzen.',
      ctaText: 'Pro-Plan starten',
      footnote: 'Bei jährlicher Zahlung sparen Sie 198 € (~17 %)'
    }
  ];

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  var STATE = {
    period: 'monthly',     // 'monthly' | 'yearly'
    activeKey: 'investor'  // V63.6: Default IMMER 'investor' beim ersten Öffnen
  };

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  window.openPricingModal = function() {
    // V63.6: Beim Öffnen IMMER auf Investor starten (Bestseller-Highlight),
    // unabhängig vom aktuellen Plan. Der aktuelle Plan ist im UI als "✓ Aktueller Plan"
    // markiert (auf der jeweiligen Plan-Karte), aber initial sichtbar ist Investor.
    STATE.activeKey = 'investor';
    _renderModal();
  };
  window.closePricingModal = function() {
    var modal = document.getElementById('pricing-modal');
    if (modal) modal.remove();
  };

  // ═══════════════════════════════════════════════════════════════
  // MODAL-RENDER
  // ═══════════════════════════════════════════════════════════════
  /* v884-flugklassen: Plan-Karten im Landing-Look (geteilte Optik) */
  function _esc(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function _planCardsHtml(){
    var KER={free:2,starter:10,investor:40,pro:100};
    var _cur=(window.DealPilotConfig&&DealPilotConfig.pricing&&DealPilotConfig.pricing.currentKey)?DealPilotConfig.pricing.currentKey():'';
    return '<div class="ppg">'+PLANS.map(function(p,i){
      var stars=''; for(var z=0;z<=i;z++)stars+='\u2605';
      var feats=(p.features||[]).filter(function(f){return !/Kerosin/.test(f);}).slice(0,8);
      var note=(p.price_yearly>0)?('oder '+p.price_yearly+' \u20ac/Jahr'):(p.footnote||'');
      return '<div class="tk'+(p.best?' best':'')+'" data-plan="'+p.key+'">'+
        '<div class="tk-stub"><div class="tk-stars">'+stars+'</div>'+
          (p.best?'<span class="tk-bs">\u2605 Bestseller</span>':'')+
          '<div class="tk-tag">'+_esc(p.tag||'')+'</div><div class="tk-name">'+_esc(p.title||p.label)+'</div></div>'+
        '<div class="tkperf"></div>'+
        '<div class="tk-body">'+
          '<div class="tk-price" data-m="'+(p.price_monthly||0)+'" data-y="'+(p.price_yearly||0)+'"><b>'+(p.price_monthly||0)+'</b><span class="cur">\u20ac</span>'+(p.price_monthly>0?'<span class="per">/ Monat</span>':'')+'</div>'+
          '<div class="tk-note">'+_esc(note)+'</div>'+
          '<div class="tk-ker"><span>\u2708</span>'+(KER[p.key]||0)+' L Kerosin&nbsp;/&nbsp;Monat</div>'+
          '<ul class="tk-feat">'+feats.map(function(f){return '<li>'+_esc(f)+'</li>';}).join('')+'</ul>'+
          (p.key===_cur?'<a class="tk-cta tk-cta-cur" href="#" data-plan="'+p.key+'">\u2713 Dein aktueller Plan</a>':'<a class="tk-cta" href="#" data-plan="'+p.key+'">'+_esc(p.ctaText||((p.title||p.label)+' w\u00e4hlen'))+'</a>')+
          '<div class="tk-rip"><span class="bar"></span><span class="bp-txt">\u2708 Boarding Pass \u00b7 DP-0'+(i+1)+'</span></div>'+
        '</div>'+
      '</div>';
    }).join('')+'</div>';
  }
  function _injectPlanCss(){
    if(document.getElementById('ppg-css'))return;
    var st=document.createElement('style'); st.id='ppg-css';
    var P='#pricing-modal .ppg';
    st.textContent=
      P+'{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:8px 0 4px;align-items:stretch}'+
      P+' .tk{display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 66px -38px rgba(0,0,0,.8),0 0 0 1px rgba(201,168,76,.28)}'+
      P+' .tk.best{box-shadow:0 42px 92px -38px rgba(201,168,76,.5),0 0 0 1.6px #C9A84C}'+
      P+' .tk-stub{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;padding:14px 20px 12px;position:relative}'+
      P+' .tk-stars{font-size:11px;letter-spacing:3px;color:#221a06;line-height:1;margin-bottom:5px}'+
      P+" .tk-bs{position:absolute;top:13px;right:14px;font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;background:#0a0a0a;color:#E8CC7A;border-radius:20px;padding:3px 9px;font-weight:700}"+
      P+" .tk-tag{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#5a4711}"+
      P+" .tk-name{font-family:'Space Grotesk',sans-serif;font-size:23px;font-weight:700;color:#1a1305;margin-top:1px}"+
      P+' .tk-body{background:#fff;padding:16px 20px 20px;display:flex;flex-direction:column;flex:1}'+
      P+' .tk-price{display:flex;align-items:baseline;gap:3px;margin-bottom:2px}'+
      P+" .tk-price b{font-family:'Space Grotesk',sans-serif;font-size:42px;font-weight:700;color:#1a1305;line-height:1}"+
      P+' .tk.best .tk-price b{background:linear-gradient(110deg,#b8932f,#8a6d24);-webkit-background-clip:text;background-clip:text;color:transparent}'+
      P+" .tk-price .cur{font-family:'Space Grotesk',sans-serif;font-size:18px;color:#1a1305}"+
      P+" .tk-price .per{font-family:'JetBrains Mono',monospace;font-size:11px;color:#6b6250;margin-left:3px}"+
      P+" .tk-note{font-family:'JetBrains Mono',monospace;font-size:10px;color:#b8932f;min-height:14px;margin-bottom:14px}"+
      P+" .tk-ker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.03em;color:#1a1305;background:rgba(201,168,76,.14);border:1px solid rgba(201,168,76,.34);border-radius:9px;padding:7px 10px;display:flex;align-items:center;gap:7px;margin-bottom:16px}"+
      P+' .tk-ker span{color:#b8932f}'+
      P+' .tk-feat{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:9px;flex:1}'+
      P+' .tk-feat li{font-size:13px;line-height:1.4;color:#3a352c;padding-left:22px;position:relative}'+
      P+" .tk-feat li::before{content:'\u2713';position:absolute;left:0;top:0;color:#2f8a58;font-weight:700}"+
      P+" .tk-cta{display:block;text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.05em;text-transform:uppercase;text-decoration:none;border-radius:11px;padding:13px 16px;border:1px solid #b8932f;color:#b8932f;cursor:pointer;transition:.16s}"+
      P+' .tk-cta:hover{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;border-color:transparent;font-weight:700}'+
      P+' .tk.best .tk-cta{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;border-color:transparent;font-weight:700}'+
      P+' .tkperf{height:15px;position:relative;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f)}'+
      P+' .tkperf::before{content:"";position:absolute;left:14px;right:14px;top:50%;transform:translateY(-50%);border-top:2px dotted rgba(10,8,3,.5)}'+
      P+' .tk-rip{position:relative;background:#fff;border-top:2px dashed #d8d2c2;padding:9px 4px 2px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px}'+
      P+' .tk-rip .bar{flex:1;max-width:56%;height:20px;background:repeating-linear-gradient(90deg,#1a1305 0 2px,transparent 2px 4px,#1a1305 4px 5px,transparent 5px 9px);border-radius:2px;opacity:.8}'+
      P+" .tk-rip .bp-txt{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#8a7c60;white-space:nowrap}"+
      '@media(max-width:820px){'+P+'{grid-template-columns:1fr 1fr}}'+
      '@media(max-width:520px){'+P+'{grid-template-columns:1fr}}'+
      _kerosinMatrixCss();
    document.head.appendChild(st);
  }
  // ═══════════════════════════════════════════════════════════════
  // v885-plan-landing: Kerosin-Streifen (bw) + Cockpit-Matrix (mx) + CSS
  // ═══════════════════════════════════════════════════════════════
  var KPACKS = [
    { l:10,  p:2,  ppl:'0,20',  id:'kerosin_10',  cls:'\u2708 Kurzstrecke',        use:'Mal schnell pr\u00fcfen',     reach:'\u2248 2 Reports oder 5 Markteinsch\u00e4tzungen' },
    { l:28,  p:5,  ppl:'0,18',  id:'kerosin_28',  cls:'\u2708\u2708 Mittelstrecke', use:'Mehrere Deals',           reach:'\u2248 7 Reports oder 14 Markteinsch\u00e4tzungen' },
    { l:90,  p:15, ppl:'0,167', id:'kerosin_90',  cls:'\u2708\u2708\u2708 Langstrecke', use:'Aktiver Investor',    reach:'\u2248 22 Reports oder 45 Markteinsch\u00e4tzungen', best:true },
    { l:160, p:25, ppl:'0,156', id:'kerosin_160', cls:'\ud83c\udf0d Interkontinental', use:'Maximale Reichweite', reach:'\u2248 40 Reports oder 80 Markteinsch\u00e4tzungen' }
  ];
  function _bwSegsHtml(idx){
    return '<div class="bw-segs">' + KPACKS.map(function(k,i){
      return '<div class="bw-seg'+(i===idx?' on':'')+'" data-i="'+i+'">' +
        '<span class="bw-seg-l">'+k.l+' L</span><span class="bw-seg-p">'+k.p+' \u20ac</span></div>';
    }).join('') + '</div>';
  }
  function _bwPassHtml(idx){
    var k = KPACKS[idx];
    return '<div class="bw'+(k.best?' best':'')+'" id="pm-bw">' +
      (k.best?'<span class="bw-pop">Beliebt</span>':'') +
      '<div class="bw-stub"><div class="bw-class">'+k.cls+'</div><div class="bw-l">'+k.l+'</div><div class="bw-ll">Liter Kerosin</div></div>' +
      '<div class="bw-perf"></div>' +
      '<div class="bw-body">' +
        '<div class="bw-col"><span class="bw-k">Reichweite</span><span class="bw-v">'+k.reach+'</span></div>' +
        '<div class="bw-col"><span class="bw-k">Preis / Liter</span><span class="bw-v"><span class="dp">'+k.ppl+' \u20ac</span> / L</span></div>' +
        '<div class="bw-col"><span class="bw-k">Einsatz</span><span class="bw-v">'+k.use+'</span></div>' +
        '<div class="bw-col"><span class="bw-k">Verfall</span><span class="bw-v"><span class="dp">nie</span> \u00b7 kein Abo</span></div>' +
      '</div>' +
      '<div class="bw-gate"><div class="bw-price">'+k.p+' \u20ac<small>einmalig \u00b7 '+k.l+' L</small></div>' +
        '<a class="bw-cta" href="#" data-pack-id="'+k.id+'" onclick="window._buyCreditPackDirect(this); return false;">Kerosin kaufen</a></div>' +
    '</div>';
  }
  function _kerosinStripHtml(){
    var i = 2; // 90 L (Beliebt) als Default
    return '<div id="pm-kerosin-strip">' + _bwSegsHtml(i) + _bwPassHtml(i) + '</div>';
  }
  function _wireKerosinStrip(){
    var wrap = document.getElementById('pm-kerosin-strip');
    if (!wrap) return;
    function bind(){
      Array.prototype.forEach.call(wrap.querySelectorAll('.bw-seg'), function(seg){
        seg.addEventListener('click', function(){
          var i = +seg.getAttribute('data-i');
          wrap.innerHTML = _bwSegsHtml(i) + _bwPassHtml(i);
          bind();
        });
      });
    }
    bind();
  }
  function _mxCell(v){
    if (v === '\u2713') return '<span class="mxck">\u2713</span>';
    if (v === '\u2013') return '<span class="mxds">\u2013</span>';
    if (v === '\u221e') return '<span class="mxinf">\u221e</span>';
    if (v.indexOf('\u2713 ') === 0) return '<span class="mxck">\u2713</span> <span class="mxlbl">'+v.slice(2)+'</span>';
    return '<span class="mxlbl">'+v+'</span>';
  }
  function _cockpitMatrixHtml(){
    var R = [
      ['Objekte','1','5','25','\u221e'],
      ['Kerosin / Monat','2 L','10 L','40 L','100 L'],
      ['Kerosin nachtanken (Liter-Pakete)','\u2013','\u2713','\u2713','\u2713'],
      ['DealPilot Score (5 Faktoren)','\u2713','\u2713','\u2713','\u2713'],
      ['Investor Deal Score (24 KPIs)','Demo','\u2013','\u2713','\u2713'],
      ['Boarding (Schnellpr\u00fcfung)','\u2713','\u2713','\u2713','\u2713'],
      ['Pilot-Analyse (KI)','vereinfacht','vereinfacht','Vollversion','Vollversion'],
      ['Pilot-Lagebewertung (KI)','\u2013','\u2713','\u2713','\u2713'],
      ['DealPilot Marktreport','\u2013','\u2713','\u2713','\u2713'],
      ['Deal-Aktion (Anfragen / Gutachten)','\u2713','\u2713','\u2713','\u2713'],
      ['RND-Einsch\u00e4tzung &amp; Gutachten-Anfrage','nur Anfrage','nur Anfrage','\u2713','\u2713'],
      ['Marktdatenfelder','gesperrt*','gesperrt*','\u2713','\u2713'],
      ['Live-Marktzinsen','\u2013','\u2013','\u2713','\u2713'],
      ['Mietspiegel-Vergleich','\u2013','manuell','automatisch','automatisch'],
      ['Marktdaten-Schnittstellen (Marktwert-Abrufe)','Demo','zubuchbar','zubuchbar','zubuchbar'],
      ['BMF-Rechner &amp; Export','\u2013','\u2013','\u2713','\u2713 Advanced'],
      ['Finanzierung','alle Modelle als Demo','Hauptdarlehen','Haupt- + Zusatz + KfW + BSV','wie Investor'],
      ['AfA-Methoden','Demo','linear + \u00a7 7b','linear + degressiv + \u00a7 7b','wie Investor'],
      ['Werbungskosten-Modul','Demo','\u2713','\u2713','\u2713'],
      ['Investment-PDF','Wasserzeichen','\u2713','\u2713','\u2713'],
      ['Werbungskosten-PDF','\u2013','\u2013','\u2713','\u2713'],
      ['Track-Record-PDF','Wasserzeichen','\u2013','\u2713','\u2713'],
      ['Eigenes Logo &amp; Footer im PDF','\u2013','\u2013','\u2713','\u2713'],
      ['Bankexport (PDF / Excel)','\u2013','\u2013','\u2713','\u2713'],
      ['Rohdatenexport (CSV / XLSX)','\u2013','\u2013','\u2013','\u2713'],
      ['JSON-Objektsicherung','\u2013','\u2013','\u2013','\u2713'],
      ['Expos\u00e9-Import','\u2713','\u2713','\u2713','\u2713'],
      ['Marktbericht-Import','\u2713','\u2713','\u2713','\u2713'],
      ['Excel-Import','\u2013','\u2713','\u2713','\u2713'],
      ['API-Zugang','\u2013','\u2013','\u2013','\u2713'],
      ['Migration &amp; Setup-Service','\u2013','\u2013','\u2013','\u2713 (3 h)']
    ];
    var h = '<div class="mx-wrap"><table class="mx"><thead><tr>' +
      '<th class="ft">Funktion</th><th>Free</th><th>Starter</th>' +
      '<th class="best"><span class="bstar">\u2605</span>Investor</th><th>Pro</th></tr></thead><tbody>';
    R.forEach(function(r){
      h += '<tr><td class="ft">'+r[0]+'</td>' +
        '<td>'+_mxCell(r[1])+'</td>' +
        '<td>'+_mxCell(r[2])+'</td>' +
        '<td class="best">'+_mxCell(r[3])+'</td>' +
        '<td>'+_mxCell(r[4])+'</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function _kerosinMatrixCss(){
    var M = '#pricing-modal ';
    return (
      M+'.dp-ac{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);-webkit-background-clip:text;background-clip:text;color:transparent}' +
      M+'.ppg .tk-cta-cur{border-color:rgba(201,168,76,.4);color:#8a7c60;background:#f7f2e6;pointer-events:none;font-weight:600}' +
      /* bw-Streifen */
      M+'.bw-segs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:720px;margin:8px auto 20px}' +
      M+'.bw-seg{display:flex;flex-direction:column;gap:2px;align-items:center;font-family:\'JetBrains Mono\',monospace;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 8px;cursor:pointer;transition:.15s;color:rgba(255,255,255,.6)}' +
      M+'.bw-seg .bw-seg-l{font-family:\'Space Grotesk\',sans-serif;font-size:19px;font-weight:700;color:#fff}' +
      M+'.bw-seg .bw-seg-p{font-size:11px}' +
      M+'.bw-seg.on{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);border-color:transparent}' +
      M+'.bw-seg.on .bw-seg-l,'+M+'.bw-seg.on .bw-seg-p{color:#221a06}' +
      M+'.bw{width:100%;margin:0;position:relative;display:grid;grid-template-columns:220px 22px 1fr 230px;align-items:stretch;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 40px 90px -40px rgba(0,0,0,.8),0 0 0 1px rgba(201,168,76,.35)}' +
      M+'.bw.best{box-shadow:0 44px 100px -40px rgba(201,168,76,.5),0 0 0 1.5px #C9A84C}' +
      M+'.bw-pop{position:absolute;top:12px;right:18px;font-family:\'JetBrains Mono\',monospace;font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#221a06;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);border-radius:20px;padding:3px 11px;font-weight:700;z-index:3}' +
      M+'.bw-stub{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;padding:26px 20px;text-align:center;display:flex;flex-direction:column;justify-content:center}' +
      M+'.bw-class{font-family:\'JetBrains Mono\',monospace;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;font-weight:700;opacity:.88}' +
      M+'.bw-l{font-family:\'Space Grotesk\',sans-serif;font-size:50px;font-weight:700;line-height:1;margin-top:3px}' +
      M+'.bw-ll{font-family:\'JetBrains Mono\',monospace;font-size:9px;font-weight:600}' +
      M+'.bw-perf{background-image:radial-gradient(circle,#0d0c0a 3.5px,transparent 3.8px);background-size:20px 14px;background-position:center;background-repeat:repeat-y}' +
      M+'.bw-body{background:#fff;display:grid;grid-template-columns:repeat(4,1fr);gap:0}' +
      M+'.bw-col{padding:22px;border-right:1px solid rgba(27,24,21,.08);display:flex;flex-direction:column;justify-content:center}' +
      M+'.bw-col:last-child{border-right:0}' +
      M+'.bw-k{display:block;font-family:\'JetBrains Mono\',monospace;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#6b6250;margin-bottom:5px}' +
      M+'.bw-v{font-size:13px;color:#1a1305;font-weight:500;line-height:1.35}' +
      M+'.bw-v .dp{color:#b8932f;font-weight:600}' +
      M+'.bw-gate{background:#fff;padding:22px 20px;text-align:center;border-left:1px dashed rgba(27,24,21,.22);display:flex;flex-direction:column;justify-content:center;gap:12px}' +
      M+'.bw-price{font-family:\'Space Grotesk\',sans-serif;font-size:34px;font-weight:700;color:#1a1305}' +
      M+'.bw-price small{font-family:\'JetBrains Mono\',monospace;font-size:10px;color:#6b6250;display:block;font-weight:400;margin-top:2px}' +
      M+'.bw-cta{font-family:\'JetBrains Mono\',monospace;font-size:12px;letter-spacing:.05em;text-transform:uppercase;text-decoration:none;border-radius:11px;padding:12px 16px;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;font-weight:700;cursor:pointer}' +
      /* mx-Matrix */
      M+'.mx-wrap{overflow-x:auto;border-radius:16px;background:#fff;box-shadow:0 30px 66px -40px rgba(0,0,0,.8),0 0 0 1px rgba(201,168,76,.3)}' +
      M+'.mx{width:100%;border-collapse:collapse;min-width:720px;font-size:13px}' +
      M+'.mx thead th{position:sticky;top:0;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;font-family:\'JetBrains Mono\',monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:15px 14px;text-align:center}' +
      M+'.mx thead th.ft{text-align:left;background:#efe6cf;color:#5a4711}' +
      M+'.mx thead th.best .bstar{margin-right:5px}' +
      M+'.mx td{padding:12px 14px;text-align:center;border-bottom:1px solid rgba(27,24,21,.07);color:#1a1305;background:#fff;vertical-align:middle}' +
      M+'.mx td.ft{text-align:left;font-weight:500}' +
      M+'.mx td.best{background:rgba(201,168,76,.1)}' +
      M+'.mx tbody tr:hover td{background:#faf6ea}' +
      M+'.mx tbody tr:hover td.best{background:rgba(201,168,76,.16)}' +
      M+'.mx tbody tr:last-child td{border-bottom:0}' +
      M+'.mxck{color:#2f8a58;font-weight:700}' +
      M+'.mxds{color:rgba(27,24,21,.28)}' +
      M+'.mxinf{font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:18px;color:#1a1305}' +
      M+'.mxlbl{font-family:\'JetBrains Mono\',monospace;font-size:10px;color:#6b5410;font-weight:600;background:rgba(201,168,76,.16);border:1px solid rgba(201,168,76,.32);border-radius:6px;padding:3px 8px;display:inline-block;line-height:1.35}' +
      M+'.mx-foot{font-family:\'JetBrains Mono\',monospace;font-size:10px;color:rgba(255,255,255,.55);margin-top:12px;text-align:center}' +
      '@media(max-width:900px){'+M+'.bw{grid-template-columns:150px 16px 1fr}'+M+'.bw-gate{grid-column:1/-1;border-left:0;border-top:1px dashed rgba(27,24,21,.22);flex-direction:row;justify-content:space-between}'+M+'.bw-body{grid-template-columns:1fr}'+M+'.bw-col{border-right:0;border-bottom:1px solid rgba(27,24,21,.08)}'+M+'.bw-col:last-child{border-bottom:0}}' +
      '@media(max-width:520px){'+M+'.bw-segs{grid-template-columns:1fr 1fr}}'
    );
  }

  function _updatePpgPrices(period){
    var host=document.getElementById('pricing-plugin-host'); if(!host)return;
    Array.prototype.forEach.call(host.querySelectorAll('.ppg .tk-price'),function(pr){
      var m=pr.getAttribute('data-m'),y=pr.getAttribute('data-y');
      var b=pr.querySelector('b'),per=pr.querySelector('.per');
      if(period==='yearly'&&y&&(+y)>0){ if(b)b.textContent=y; if(per)per.textContent='/ Jahr'; }
      else { if(b)b.textContent=m; if(per)per.textContent=((+m)>0?'/ Monat':''); }
    });
  }
  function _mountPlanCards(){
    var host=document.getElementById('pricing-plugin-host'); if(!host)return;
    var tl=host.querySelector('.dp-timeline'); if(tl){var tc=tl.closest('.dp-container'); if(tc)tc.style.display='none';}
    var card=host.querySelector('.dp-card'); var target=card?card.closest('.dp-container'):null; if(!target)return;
    target.innerHTML=_planCardsHtml();
    Array.prototype.forEach.call(host.querySelectorAll('.ppg .tk-cta'),function(a){
      a.addEventListener('click',function(e){e.preventDefault();_onPlanSelect(a.getAttribute('data-plan'),(typeof STATE!=='undefined'&&STATE.period)||'monthly');});
    });
    Array.prototype.forEach.call(host.querySelectorAll('.dp-toggle-btn'),function(bt){
      bt.addEventListener('click',function(){_updatePpgPrices(bt.getAttribute('data-period')||'monthly');});
    });
    _updatePpgPrices((typeof STATE!=='undefined'&&STATE.period)||'monthly');
  }

  function _renderModal() {
    // Wenn schon offen, nicht doppelt rendern
    if (document.getElementById('pricing-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'pricing-modal';
    modal.className = 'pricing-modal-overlay';
    modal.innerHTML =
      '<div class="pricing-modal-shell">' +
        '<button class="pricing-modal-close" type="button" onclick="closePricingModal()" aria-label="Schließen">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '<div class="dp-wrap" id="pricing-plugin-host">' + _pluginHtml() + '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Klick aufs Overlay (nicht aufs Shell) → schließen
    modal.addEventListener('click', function(e) {
      if (e.target === modal) window.closePricingModal();
    });

    // Plugin-JS initialisieren (nach kurzem Delay damit DOM ready ist)
    setTimeout(function() {
      _injectPlanCss(); /* v884-flugklassen */
      _initToggle();
      _bindCtaHandlers();
      _mountPlanCards();
      _wireKerosinStrip();
    }, 30);
  }

  // ═══════════════════════════════════════════════════════════════
  // PLUGIN-HTML (aus dem angehängten Plugin extrahiert + adaptiert)
  // ═══════════════════════════════════════════════════════════════
  function _pluginHtml() {
    return '' +
      // Header
      '<div class="dp-container dp-header">' +
        '<span class="dp-pill">Dein Plan</span>' +
        '<h2 class="dp-h1">Vier Pakete. <span class="dp-ac">Ein Cockpit.</span></h2>' +
        '<p class="dp-sub">Vom kostenlosen Testflug bis zum Profi-Cockpit f\u00fcr Sachverst\u00e4ndige. Jederzeit wechselbar, kein Abo-Kleingedrucktes.</p>' +
        '<div class="dp-toggle" role="tablist" aria-label="Abrechnungszeitraum">' +
          '<button type="button" class="dp-toggle-btn dp-on" data-period="monthly" aria-selected="true">Monatlich</button>' +
          '<button type="button" class="dp-toggle-btn" data-period="yearly" aria-selected="false">Jährlich <span class="dp-toggle-save">~17 % gespart</span></button>' +
        '</div>' +
      '</div>' +

      // Timeline
      '<div class="dp-container">' +
        '<nav class="dp-timeline" aria-label="Pläne">' +
          '<div class="dp-timeline-line" aria-hidden="true"></div>' +
        '</nav>' +
      '</div>' +

      // Plan-Detail-Karte
      '<div class="dp-container">' +
        '<article class="dp-card" aria-live="polite">' +
          '<div class="dp-card-left">' +
            '<div class="dp-card-meta">' +
              '<span class="dp-card-badge" data-field="badge"></span>' +
              '<span class="dp-card-tag" data-field="tag"></span>' +
            '</div>' +
            '<h3 class="dp-card-title" data-field="title"></h3>' +
            '<p class="dp-card-lead" data-field="lead"></p>' +
            '<ul class="dp-card-features" data-field="features"></ul>' +
            '<div class="dp-card-notincl" data-field="notincl-wrap" hidden>' +
              '<div class="dp-card-notincl-label">Nicht enthalten:</div>' +
              '<ul class="dp-card-notincl-list" data-field="notincl"></ul>' +
            '</div>' +
            '<a class="dp-cta" href="#" data-field="cta-link" onclick="return false;">' +
              '<span data-field="cta-text">Plan wählen</span>' +
              '<span class="dp-cta-arrow" aria-hidden="true">⟶</span>' +
            '</a>' +
          '</div>' +
          '<div class="dp-card-right">' +
            '<span class="dp-card-watermark" data-field="watermark" aria-hidden="true"></span>' +
            '<div class="dp-card-right-inner">' +
              '<span class="dp-card-pricelabel">Preis</span>' +
              '<div class="dp-card-price" data-field="price"></div>' +
              '<div class="dp-card-pricenote" data-field="price-note"></div>' +
              '<div class="dp-card-divider"></div>' +
              '<span class="dp-card-resultlabel">Ihr Ergebnis</span>' +
              '<p class="dp-card-result" data-field="result"></p>' +
            '</div>' +
          '</div>' +
        '</article>' +
      '</div>' +

      // v885-plan-landing: Kerosin-Nachtank-Streifen (bw-Boarding-Pass, Landing-Look)
      '<div class="dp-container dp-section">' +
        '<div class="dp-section-head">' +
          '<span class="dp-pill dp-pill-alt">Kerosin nachtanken</span>' +
          '<h2 class="dp-h2">Volltanken. Durchstarten.</h2>' +
          '<p class="dp-sub"><strong>1 Liter = 1 Pilot-Anfrage.</strong> Ein Pass, umschaltbar \u2014 gekauftes Kerosin kommt obendrauf, wird zuletzt verbraucht und verf\u00e4llt nie.</p>' +
        '</div>' +
        _kerosinStripHtml() +
        '<p class="dp-note" style="text-align:center;margin-top:14px">Kerosin ist ab dem Starter-Plan zubuchbar \u00b7 verf\u00e4llt nicht \u00b7 kein Abo.</p>' +
      '</div>' +

      // V63.82: Feature-Übersicht — vollständige Vergleichstabelle
      '<div class="dp-container dp-feature-table-wrap">' +
        '<h3 class="dp-feature-table-h">Cockpit-Matrix</h3>' +
        '<p class="dp-feature-table-sub">Klare Gegen\u00fcberstellung aller Features pro Plan.</p>' +
        _cockpitMatrixHtml() +
        '<div class="mx-foot">* Marktdatenfelder in Free &amp; Starter als Vorschau gesperrt, ab Investor freigeschaltet.</div>' +
      '</div>' +

      // V192: Service & Support-Block entfernt (auf User-Wunsch)


      // Footer-Hinweise
      '<div class="dp-container dp-footer-note">' +
        '<p>Pläne jederzeit kündbar. Plan-Änderungen werden zum Beginn der nächsten Abrechnungsperiode wirksam. Kerosin verfällt nicht.</p>' +
      '</div>';
  }

  // V63.82: Service-Card-Helper
  // V63.82: Feature-Übersicht-Tabelle — alle Features alle Pläne
  function _renderFeatureTable() {
    var rows = [ /* v493-matrix — Feature-Matrix Stand 05.06.2026 */
      { cat: 'Nutzung & Kerosin', items: [
        ['Objekte',                              '1', '5', '25', '∞'],
        ['Kerosin / Monat',                      '2 L', '10 L', '40 L', '100 L'],
        ['Kerosin nachtanken (Liter-Pakete)',    '–', '✓', '✓', '✓']
      ]},
      { cat: 'Analyse & Bewertung', items: [
        ['DealPilot Score (5 Faktoren)',         '✓', '✓', '✓', '✓'],
        ['Investor Deal Score (24 KPIs)',        'Demo', '–', '✓', '✓'],
        ['Quick-Check (Schnellbewertung)',       '✓', '✓', '✓', '✓'],
        ['Pilot-Analyse (KI)',                   'vereinfacht', 'vereinfacht', 'Vollversion', 'Vollversion'],
        ['Pilot-Lagebewertung (KI)',             '–', '✓', '✓', '✓'],
        ['DealPilot Marktreport',                '–', '✓', '✓', '✓'],
        ['Deal-Aktion (Anfragen / Gutachten)',   '✓', '✓', '✓', '✓'],
        ['RND-Einschätzung & Gutachten-Anfrage', 'nur Anfrage', 'nur Anfrage', '✓', '✓']
      ]},
      { cat: 'Markt & Daten', items: [
        ['Marktdatenfelder',                     'gesperrt*', 'gesperrt*', '✓', '✓'],
        ['Live-Marktzinsen',                     '–', '–', '✓', '✓'],
        ['Mietspiegel-Vergleich',                '–', 'manuell', 'automatisch', 'automatisch'],
        ['Marktdaten-Schnittstellen (Marktwert-Abrufe)', 'Demo', 'zubuchbar', 'zubuchbar', 'zubuchbar'],
        ['BMF-Rechner & Export',                 '–', '–', '✓', '✓ Advanced']
      ]},
      { cat: 'Finanzierung & Steuer', items: [
        ['Finanzierung',                         'alle Modelle als Demo', 'Hauptdarlehen', 'Haupt- + Zusatzdarlehen + KfW + BSV', 'wie Investor'],
        ['AfA-Methoden',                         'Demo', 'linear + § 7b', 'linear + degressiv + § 7b', 'wie Investor'],
        ['Werbungskosten-Modul',                 'Demo', '✓', '✓', '✓']
      ]},
      { cat: 'Reports & Exporte', items: [
        ['Investment-PDF',                       'Wasserzeichen', '✓', '✓', '✓'],
        ['Werbungskosten-PDF',                   '–', '–', '✓', '✓'],
        ['Track-Record-PDF',                     'Wasserzeichen', '–', '✓', '✓'],
        ['Eigenes Logo & Footer im PDF',         '–', '–', '✓', '✓'],
        ['Bankexport (PDF / Excel)',             '–', '–', '✓', '✓'],
        ['Rohdatenexport (CSV / XLSX)',          '–', '–', '–', '✓'],
        ['JSON-Objektsicherung',                 '–', '–', '–', '✓']
      ]},
      { cat: 'Import & Datenübernahme', items: [
        ['Exposé-Import',                   '✓', '✓', '✓', '✓'],
        ['Marktbericht-Import',                  '✓', '✓', '✓', '✓'],
        ['Excel-Import',                         '–', '✓', '✓', '✓']
      ]},
      { cat: 'Service & Integration', items: [
        ['API-Zugang',                           '–', '–', '–', '✓'],
        ['Migration & Setup-Service',            '–', '–', '–', '✓ (3 h)']
      ]}
    ];

    var html = '<table class="dp-feature-table">' +
      '<thead><tr>' +
        '<th class="dp-ft-feature">Feature</th>' +
        '<th class="dp-ft-plan">Free</th>' +
        '<th class="dp-ft-plan">Starter</th>' +
        '<th class="dp-ft-plan dp-ft-plan-best">Investor ⭐</th>' +
        '<th class="dp-ft-plan">Pro</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function(group) {
      html += '<tr class="dp-ft-cat-row"><td colspan="5">' + group.cat + '</td></tr>';
      group.items.forEach(function(row) {
        html += '<tr>' +
          '<td class="dp-ft-feature">' + row[0] + '</td>' +
          '<td class="dp-ft-cell">' + _ftCell(row[1]) + '</td>' +
          '<td class="dp-ft-cell">' + _ftCell(row[2]) + '</td>' +
          '<td class="dp-ft-cell dp-ft-cell-best">' + _ftCell(row[3]) + '</td>' +
          '<td class="dp-ft-cell">' + _ftCell(row[4]) + '</td>' +
        '</tr>';
      });
    });
    html += '</tbody></table>' +
      '<p class="dp-note" style="margin-top:10px;font-size:11.5px">* sichtbar, aber deaktiviert — die Felder zeigen, was im Upgrade steckt.</p>';
    return html;
  }

  function _ftCell(value) {
    if (value === '✓')   return '<span class="dp-ft-yes">✓</span>';
    if (value === '–')   return '<span class="dp-ft-no">–</span>';
    return '<span class="dp-ft-text">' + value + '</span>';
  }

  function _serviceCard(key, icon, title, price, benefits, highlight) {
    return '<div class="dp-service-card' + (highlight ? ' dp-service-card-best' : '') + '" data-service="' + key + '">' +
      (highlight ? '<div class="dp-service-best-badge">Empfohlen</div>' : '') +
      '<div class="dp-service-icon">' + icon + '</div>' +
      '<div class="dp-service-title">' + title + '</div>' +
      '<div class="dp-service-price">' + price + '</div>' +
      '<ul class="dp-service-list">' +
        benefits.map(function(b) { return '<li>' + b + '</li>'; }).join('') +
      '</ul>' +
      '<button type="button" class="dp-service-cta" onclick="_dpServiceSelect(\'' + key + '\')">Anfragen</button>' +
    '</div>';
  }
  // Globaler Handler für Service-Anfrage
  window._dpServiceSelect = function(key) {
    if (typeof toast === 'function') toast('Service "' + key + '" angefragt — Marcel meldet sich.');
    // V63.82: Bei aktivem Backend-Mailer wäre hier ein POST /service-request möglich.
    // Für jetzt: einfach toasten — Marcel sieht's beim Plan-Wechsel-Workflow.
  };

  /* v490-kerosin-modal: Tacho-Karte — CTA nutzt den bestehenden Direkt-Checkout */
  function _kerosinGauge(off, deg) {
    var gid = 'kgm' + String(Math.abs(off)).replace('.', '');
    return '<svg class="kp-tacho" viewBox="0 0 184 96" aria-hidden="true">' +
      '<path d="M28 88 A64 64 0 0 1 156 88" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M149 59 A64 64 0 0 1 156 88" fill="none" stroke="rgba(184,98,80,.55)" stroke-width="8" stroke-linecap="round"/>' +
      '<path class="kp-arc" style="--off:' + off + '" d="M28 88 A64 64 0 0 1 156 88" fill="none" stroke="url(#' + gid + ')" stroke-width="8" stroke-linecap="round"/>' +
      '<g stroke="rgba(244,236,216,.2)" stroke-width="2"><line x1="28" y1="88" x2="36" y2="88"/><line x1="46.8" y1="42.8" x2="52.4" y2="48.4"/><line x1="92" y1="24" x2="92" y2="32"/><line x1="137.2" y1="42.8" x2="131.6" y2="48.4"/><line x1="156" y1="88" x2="148" y2="88"/></g>' +
      '<g class="kp-needle" style="--deg:' + deg + 'deg"><line x1="92" y1="88" x2="92" y2="34" stroke="#F4ECD8" stroke-width="3" stroke-linecap="round"/></g>' +
      '<circle cx="92" cy="88" r="5.5" fill="#C9A84C"/>' +
      '<defs><linearGradient id="' + gid + '" x1="0" x2="1"><stop offset="0" stop-color="#C9A84C"/><stop offset="1" stop-color="#3FA56C"/></linearGradient></defs>' +
    '</svg>';
  }

  function _kerosinCard(liter, price, perLiter, packId, target, flight, off, deg, reach, best) {
    var perLiterStr = perLiter.toFixed(perLiter < 0.17 ? 3 : 2).replace('.', ',') + ' €';
    return '<div class="dp-credits-card kp-card' + (best ? ' dp-credits-card-best' : '') + '">' +
      (best ? '<span class="dp-credits-best">Beliebt</span>' : '') +
      '<div class="kp-flight">' + flight + '</div>' +
      _kerosinGauge(off, deg) +
      '<div class="dp-credits-amount">' + liter + '</div>' +
      '<div class="dp-credits-amount-label">Liter = ' + liter + ' Pilot-Anfragen</div>' +
      '<div class="dp-credits-divider"></div>' +
      '<div class="dp-credits-price">' + price + ' €</div>' +
      '<div class="dp-credits-perunit">' + perLiterStr + ' / Liter</div>' +
      '<div class="dp-credits-target">' + target + '</div>' +
      '<div class="kp-reach">' + reach + '</div>' +
      '<a class="dp-credits-cta" href="#" data-pack-id="' + packId + '" onclick="window._buyCreditPackDirect(this); return false;">Kerosin kaufen</a>' +
    '</div>';
  }

  function _creditCard(credits, price, packId, target, best) {
    // V197.2: Direkt zu Stripe, ohne Zwischenmodal.
    // 1 Credit = 2 Anfragen → Anfragen-Anzahl + Preis pro Anfrage berechnet.
    var anfragen = credits * 2;
    var perAnfrage = (price / anfragen);
    var perAnfrageStr = perAnfrage.toFixed(2).replace('.', ',') + ' €';
    return '<div class="dp-credits-card' + (best ? ' dp-credits-card-best' : '') + '">' +
      (best ? '<span class="dp-credits-best">Beliebt</span>' : '') +
      '<div class="dp-credits-amount">' + credits + '</div>' +
      '<div class="dp-credits-amount-label">Credits = ' + anfragen + ' Anfragen</div>' +
      '<div class="dp-credits-divider"></div>' +
      '<div class="dp-credits-price">' + price + ' €</div>' +
      '<div class="dp-credits-perunit">' + perAnfrageStr + ' / Anfrage</div>' +
      '<div class="dp-credits-target">' + target + '</div>' +
      '<a class="dp-credits-cta" href="#" data-pack-id="' + packId + '" onclick="window._buyCreditPackDirect(this); return false;">Credits kaufen</a>' +
    '</div>';
  }

  function _avmCard(credits, price, packId, target, best) {
    var priceStr = price.toFixed(2).replace('.', ',');
    var perCallStr = (price / credits).toFixed(2).replace('.', ',') + ' €';
    var credLabel = credits === 1 ? '1 Credit' : credits + ' Credits';
    var abrufLabel = credits === 1 ? '1 Abruf' : credits + ' Abrufe';
    return '<div class="dp-credits-card' + (best ? ' dp-credits-card-best' : '') + '">' +
      (best ? '<span class="dp-credits-best">Beliebt</span>' : '') +
      '<div class="dp-credits-amount">' + credits + '</div>' +
      '<div class="dp-credits-amount-label">' + credLabel + ' = ' + abrufLabel + '</div>' +
      '<div class="dp-credits-divider"></div>' +
      '<div class="dp-credits-price">' + priceStr + ' €</div>' +
      '<div class="dp-credits-perunit">' + perCallStr + ' / Abruf</div>' +
      '<div class="dp-credits-target">' + target + '</div>' +
      '<a class="dp-credits-cta" href="#" data-pack-id="' + packId + '" onclick="window._buyCreditPackDirect(this); return false;">Credits kaufen</a>' +
    '</div>';
  }

  // V197.2: Direkter Checkout-Aufruf — Stripe ohne Zwischenmodal
  window._buyCreditPackDirect = async function(el) {
    var packId = el.dataset.packId;
    var origText = el.textContent;
    el.style.pointerEvents = 'none';
    el.textContent = 'Wird gestartet…';
    try {
      var token = localStorage.getItem('ji_token') || '';
      var apiBase = (window.JI_API_BASE || '/api/v1');
      var r = await fetch(apiBase + '/credits/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ pack_id: packId })
      });
      var data = null;
      try { data = await r.json(); } catch (e) {}
      if (r.ok && data && data.url) {
        window.location.href = data.url;
        return;
      }
      el.style.pointerEvents = '';
      el.textContent = origText;
      // Spezialbehandlung Free-User
      if (r.status === 403 && data && data.error === 'upgrade_required') {
        alert(data.message || 'Credits können nur ab dem Starter-Plan zugebucht werden. Bitte upgrade dein Abo.');
        return;
      }
      alert('Fehler: ' + ((data && (data.message || data.error)) || 'Checkout konnte nicht gestartet werden'));
    } catch (err) {
      el.style.pointerEvents = '';
      el.textContent = origText;
      alert('Netzwerkfehler: ' + err.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // TIMELINE (Plan-Steps)
  // ═══════════════════════════════════════════════════════════════
  function _initTimeline() {
    var nav = document.querySelector('#pricing-plugin-host .dp-timeline');
    if (!nav) return;
    var html = '<div class="dp-timeline-line" aria-hidden="true"></div>';
    PLANS.forEach(function(p) {
      var isBest = p.best;
      var isActive = p.key === STATE.activeKey;
      html += '<button type="button" class="dp-step' + (isActive ? ' dp-active' : '') + (isBest ? ' dp-best' : '') + '" data-key="' + p.key + '">' +
        '<span class="dp-step-circle">' + p.letter + '</span>' +
        '<span class="dp-step-label">' + p.label + '</span>' +
        (isBest ? '<span class="dp-step-bestmark">★ Bestseller</span>' : '') +
      '</button>';
    });
    nav.innerHTML = html;
    nav.querySelectorAll('.dp-step').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var k = btn.getAttribute('data-key');
        STATE.activeKey = k;
        nav.querySelectorAll('.dp-step').forEach(function(b) { b.classList.remove('dp-active'); });
        btn.classList.add('dp-active');
        _renderCard(k);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOGGLE Monatlich / Jährlich
  // ═══════════════════════════════════════════════════════════════
  function _initToggle() {
    var toggle = document.querySelector('#pricing-plugin-host .dp-toggle');
    if (!toggle) return;
    toggle.querySelectorAll('.dp-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var p = btn.getAttribute('data-period');
        STATE.period = p;
        toggle.querySelectorAll('.dp-toggle-btn').forEach(function(b) {
          var on = b.getAttribute('data-period') === p;
          b.classList.toggle('dp-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        _renderCard(STATE.activeKey);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PLAN-KARTE rendern
  // ═══════════════════════════════════════════════════════════════
  function _renderCard(key) {
    var plan = PLANS.filter(function(p) { return p.key === key; })[0];
    if (!plan) return;
    var host = document.querySelector('#pricing-plugin-host .dp-card');
    if (!host) return;

    // V63.6: Investor-Ribbon-Overlay auf der Karte wenn investor aktiv ist
    host.classList.remove('dp-card-with-investor-ribbon');
    var existingRibbon = host.querySelector('.dp-card-investor-ribbon');
    if (existingRibbon) existingRibbon.remove();
    if (key === 'investor' || plan.best) {
      host.classList.add('dp-card-with-investor-ribbon');
      var ribbon = document.createElement('div');
      ribbon.className = 'dp-card-investor-ribbon';
      ribbon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> <span>INVESTOR</span>';
      host.appendChild(ribbon);
    }

    function _set(field, val) {
      var el = host.querySelector('[data-field="' + field + '"]');
      if (el) el.innerHTML = val;
    }

    _set('badge', plan.letter);
    _set('tag', plan.tag);
    _set('title', plan.title);
    _set('lead', plan.lead);
    _set('watermark', plan.label);

    // Preis
    var price, priceNote;
    if (STATE.period === 'monthly') {
      price = plan.price_monthly === 0 ? '0 €' : plan.price_monthly + ' €<small>/ Monat</small>';
      priceNote = plan.price_monthly === 0 ? 'kostenlos' : 'monatliche Abrechnung';
    } else {
      price = plan.price_yearly === 0 ? '0 €' : plan.price_yearly + ' €<small>/ Jahr</small>';
      priceNote = plan.price_yearly === 0 ? 'kostenlos' : 'entspricht ' + Math.round(plan.price_yearly / 12) + ' € / Monat';
    }
    _set('price', price);
    _set('price-note', priceNote);
    _set('result', plan.result);

    // Features
    var feat = host.querySelector('[data-field="features"]');
    if (feat) {
      feat.innerHTML = plan.features.map(function(f) {
        return '<li>' + f + '</li>';
      }).join('');
    }

    // Not-included
    var notInclWrap = host.querySelector('[data-field="notincl-wrap"]');
    var notIncl = host.querySelector('[data-field="notincl"]');
    if (plan.not_included && plan.not_included.length) {
      notInclWrap.removeAttribute('hidden');
      notIncl.innerHTML = plan.not_included.map(function(f) {
        return '<li>' + f + '</li>';
      }).join('');
    } else {
      notInclWrap.setAttribute('hidden', '');
    }

    // CTA — bei aktivem Plan deaktiviert, sonst Plan-Wechsel-Trigger
    var ctaText = host.querySelector('[data-field="cta-text"]');
    var ctaLink = host.querySelector('[data-field="cta-link"]');
    var isCurrent = (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.currentKey() === key);
    if (isCurrent) {
      if (ctaText) ctaText.textContent = '✓ Aktueller Plan';
      if (ctaLink) {
        ctaLink.classList.add('dp-cta-current');
        ctaLink.onclick = function(e) { e.preventDefault(); return false; };
      }
    } else {
      if (ctaText) ctaText.textContent = plan.ctaText;
      if (ctaLink) {
        ctaLink.classList.remove('dp-cta-current');
        ctaLink.onclick = function(e) {
          e.preventDefault();
          _onPlanSelect(key, STATE.period);
          return false;
        };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STRIPE-HOOKS — hier kommt später Stripe rein
  // ═══════════════════════════════════════════════════════════════

  /**
   * Plan-Wechsel angefordert.
   *
   * STRIPE-INTEGRATION (später):
   * 1. POST /api/stripe/create-checkout-session  { plan, period }
   * 2. Backend ruft stripe.checkout.sessions.create() mit dem zugehörigen
   *    price_id (siehe DealPilotConfig.pricing.plans[plan].stripe_price_id_{monthly|yearly})
   * 3. Frontend redirected mit der zurückgelieferten URL: window.location = data.url
   * 4. Webhook /api/stripe/webhook empfängt 'checkout.session.completed' und
   *    aktualisiert subscriptions in PostgreSQL
   * 5. Bei Erfolg-Redirect zurück → Sub.invalidateCache() + applyFeatureGates()
   *
   * Aktuell (Dev-Mode): direkter setOverride()-Call für lokales Testen.
   */
  function _onPlanSelect(planKey, period) {
    if (!window.DealPilotConfig || !DealPilotConfig.pricing) return;

    // v885-plan-landing: status-basiert. Aktueller Plan -> Hinweis; zahlendes Abo -> Portal;
    // Free/kein Abo -> Stripe-Checkout (Entscheidung A).
    var _cur = (DealPilotConfig.pricing.currentKey ? DealPilotConfig.pricing.currentKey() : 'free') || 'free';
    if (planKey === _cur) {
      if (typeof toast === 'function') toast('Das ist bereits dein aktueller Plan.');
      return;
    }
    if (_cur !== 'free' && typeof Sub !== 'undefined' && typeof Sub.openPortal === 'function') {
      // bestehendes zahlendes Abo -> Plan-Wechsel im Stripe Customer Portal
      Sub.openPortal();
      return;
    }

    // V181: Stripe-Checkout ist jetzt der einzige Flow (kein Demo-Switch mehr).
    _startStripeCheckout(planKey, period);
    return;

    // ──────────────────────────────────────────────────────────────────
    // Folgender Code ist V181 deaktiviert — nur als Fallback aufgehoben:
    // Dev-Mode: Plan-Override setzen
    DealPilotConfig.pricing.setOverride(planKey);
    if (typeof toast === 'function') {
      toast('✓ Plan auf "' + DealPilotConfig.pricing.get(planKey).label + '" gewechselt');
    }
    // Cache invalidieren + UI refresh
    if (typeof Sub !== 'undefined' && typeof Sub.invalidateCache === 'function') {
      Sub.invalidateCache();
    }
    if (typeof window.renderSubscriptionBadge === 'function') {
      window.renderSubscriptionBadge();
    }
    if (typeof applyFeatureGates === 'function') {
      applyFeatureGates();
    } else if (typeof window.applyFeatureGates === 'function') {
      window.applyFeatureGates();
    }
    if (typeof updHeaderBadges === 'function') updHeaderBadges();
    // Modal nach kurzem Delay schließen
    setTimeout(function() {
      window.closePricingModal();
    }, 800);
  }

  /**
   * Stripe-Checkout starten (Stub für später).
   */
  async function _startStripeCheckout(planKey, period) {
    // V181: Stripe-Checkout aktiviert.
    console.log('[pricing-modal stripe-checkout] starting:', planKey, period);

    if (typeof Sub === 'undefined' || typeof Sub.startCheckout !== 'function') {
      console.error('[pricing-modal] Sub-Modul nicht geladen');
      if (typeof toast === 'function') toast('❌ Stripe-Modul nicht geladen — Seite neu laden');
      return;
    }

    // billingInterval: pricing-modal nutzt 'monthly'/'yearly', Sub erwartet auch das
    var interval = (period === 'yearly') ? 'yearly' : 'monthly';

    try {
      // V234: Doppelklick-Schutz — wenn User schon auf diesem Plan ist,
      // biete Customer-Portal statt erneutem Checkout an.
      if (typeof window._v234CheckPlanBeforeCheckout === 'function') {
        var shouldContinue = await window._v234CheckPlanBeforeCheckout(planKey);
        if (!shouldContinue) {
          console.log('[pricing-modal V234] Checkout abgebrochen — User bereits auf', planKey);
          return;
        }
      }
      await Sub.startCheckout(planKey, interval);
      // Erfolg: Browser redirected zu Stripe — falls hier ankommen, ist was schiefgelaufen
    } catch (e) {
      console.error('[pricing-modal stripe-checkout] error:', e);
      var msg = (e && e.message) ? e.message : 'Stripe-Checkout fehlgeschlagen';
      if (msg.indexOf('not yet available') >= 0 || msg.indexOf('503') >= 0) {
        msg = 'Dieser Plan kann aktuell nicht online abonniert werden. Bitte info@dealpilot.immo kontaktieren.';
      }
      if (typeof toast === 'function') toast('❌ ' + msg);
    }
  }

  /**
   * KI-Credit-Paket gekauft.
   *
   * STRIPE-INTEGRATION (später):
   * 1. POST /api/stripe/buy-credits  { credits: 5|15|40|100 }
   * 2. Backend erstellt einmaliges Stripe-Payment-Intent
   * 3. Frontend zeigt Stripe Elements oder Redirect auf Checkout
   * 4. Webhook /api/stripe/webhook → 'payment_intent.succeeded' →
   *    Backend addiert credits in user_credits Tabelle
   */
  function _onCreditsBuy(credits) {
    if (typeof toast === 'function') {
      toast('💳 Credit-Paket "' + credits + ' Credits" — Stripe-Checkout noch nicht aktiv.');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CTA-Handler binden
  // ═══════════════════════════════════════════════════════════════
  function _bindCtaHandlers() {
    var host = document.getElementById('pricing-plugin-host');
    if (!host) return;
    // Credit-Pakete
    host.querySelectorAll('[data-credits-cta]').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        var credits = parseInt(a.getAttribute('data-credits-cta'), 10);
        _onCreditsBuy(credits);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ESC-Key zum Schließen
  // ═══════════════════════════════════════════════════════════════
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('pricing-modal')) {
      window.closePricingModal();
    }
  });

})();
