/* ═══════════════════════════════════════════════════════════════════════
   dealcheck-uebernahme.js · v3313 (11.11.2026)
   Der Deal-Check der Startseite (landing/dp2-dealcheck.js) wird nach
   Registrierung oder Anmeldung als neues Objekt angelegt — auf Nachfrage.

   Marcel 11.11.2026: „ja alles fertig machen" (Deal-Check-Werte in die App).

   ── DER WEG ──────────────────────────────────────────────────────────
   Landing (dealpilot.immo) und App (app.dealpilot.immo) sind verschiedene
   Origins, ein gemeinsamer Speicher existiert nicht. Die Landing hängt die
   fünf Zahlen deshalb als FRAGMENT an den Knopf:
       https://app.dealpilot.immo/?register=1#dc=1&kp=150000&nkm=880&ek=15000&zins=4.1&nk=10
   Das Fragment geht nie an einen Server (kein Log, kein Referrer) und trägt
   keine personenbezogenen Daten — nur Kaufpreis, Miete, Eigenkapital, Zins,
   Nebenkosten.

   Dieses Skript läuft SYNCHRON beim Laden, vor auth.js und vor
   register-easter-egg.js (die beide die Adresszeile leeren), legt die Werte
   in localStorage dieser App-Origin ab (`dp_dealcheck_uebergabe`, 7 Tage —
   die Bestätigungsmail kann dauern) und nimmt das Fragment aus der Zeile.

   Nach der Anmeldung (dp:plan-ready) erscheint EIN Band: „Deal-Check
   übernehmen?". Erst auf „Als Objekt anlegen" entsteht ein Objekt; die
   Übergabe wird VOR dem Anlegen gelöscht — Neuladen legt nichts doppelt an.
   Volles Objektlimit: freundlicher Hinweis, die Übergabe bleibt gemerkt.

   Angelegt wird über die kanonische Kette wie beim Quick-Check (qc-bridge.js
   _handleSave): newObj({ohneAuswahl}) abwarten → Felder → calc() → EIN
   saveObj({_qcFinal}) unter _qcTakeover (keine Sofort-Anlage daneben).
   Keine Adresse, keine Objektart, keine Wohnfläche werden erfunden; das
   Objekt heißt über das Kürzel „Deal-Check vom TT.MM." (storage.js _name).
   Die Bewirtschaftung folgt der Landing: 16 % der Nettokaltmiete nicht
   umlagefähig (Modus „% der NKM") + 1 % Leerstand = dieselben 17 %.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'dp_dealcheck_uebergabe';
  var TTL = 7 * 24 * 3600 * 1000;

  /* ── 1 · Annehmen (synchron, beim Laden) ────────────────────────────── */
  function grenze(x, lo, hi) { var n = parseFloat(x); return (isFinite(n) && n >= lo && n <= hi) ? n : null; }
  try {
    var h = String(location.hash || '');
    if (/^#(.*&)?dc=1(&|$)/.test(h)) {
      var p = new URLSearchParams(h.slice(1));
      var w = {
        kp: grenze(p.get('kp'), 10000, 50000000),
        nkm: grenze(p.get('nkm'), 50, 500000),
        ek: grenze(p.get('ek'), 0, 50000000),
        zins: grenze(p.get('zins'), 0, 15),
        nk: grenze(p.get('nk'), 0, 25),
        t: Date.now()
      };
      if (w.kp != null && w.nkm != null) localStorage.setItem(KEY, JSON.stringify(w));
      /* Nur das Fragment nehmen, ?register=1 bleibt für register-easter-egg.js stehen */
      history.replaceState(history.state, '', location.pathname + location.search);
    }
  } catch (e) { /* Übergabe ist Kür, nie App-blockierend */ }

  function lesen() {
    try {
      var w = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!w || !(w.kp > 0) || !(w.nkm > 0)) return null;
      if (!(Date.now() - (w.t || 0) < TTL)) { localStorage.removeItem(KEY); return null; }
      return w;
    } catch (e) { return null; }
  }
  function loeschen() { try { localStorage.removeItem(KEY); } catch (e) {} }

  /* ── 2 · Anbieten (nach der Anmeldung) ──────────────────────────────── */
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function dez(n, st) { return (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: 2 }); }
  function ekVon(w) { return w.ek != null ? w.ek : Math.round(w.kp * 0.10); }
  function zinsVon(w) { return w.zins != null ? w.zins : 4.0; }
  function nkVon(w) { return w.nk != null ? w.nk : 10; }
  function datum() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.'; }

  var gezeigt = false;
  function bandWeg() { var b = document.getElementById('dpDcBand'); if (b && b.parentNode) b.parentNode.removeChild(b); }

  function band(html, knoepfe) {
    bandWeg();
    var b = document.createElement('div');
    b.id = 'dpDcBand';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Deal-Check übernehmen');
    b.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100000;'
      + 'width:min(560px,calc(100vw - 32px));box-sizing:border-box;background:#FDFCFA;color:#2A2727;'
      + 'border:1px solid var(--wl-c9a84c, #C9A84C);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);'
      + 'padding:16px 18px;font:14px/1.45 Inter,system-ui,sans-serif';
    b.innerHTML = html + '<div class="dp-dc-kn" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"></div>';
    var leiste = b.querySelector('.dp-dc-kn');
    knoepfe.forEach(function (k) {
      var x = document.createElement('button');
      x.type = 'button';
      x.textContent = k.text;
      x.style.cssText = 'cursor:pointer;border-radius:9px;padding:9px 14px;font:600 13px Inter,system-ui,sans-serif;'
        + (k.haupt ? 'background:var(--wl-c9a84c, #C9A84C);color:#050505;border:1px solid var(--wl-c9a84c, #C9A84C)'
                   : 'background:transparent;color:#2A2727;border:1px solid #cfc8b8');
      x.addEventListener('click', k.tun);
      leiste.appendChild(x);
    });
    document.body.appendChild(b);
    return b;
  }

  /* v3342 · Marcel 12.11.2026: „Dealcheck übernehmen … das geht ja noch gar nicht, weil wir noch nicht angemeldet
     sind … legt das an, in welchem Account auch immer". Bis v3340 genügte ein ji_token im Speicher - auch ein
     abgelaufener oder der eines anderen Kontos in diesem Browser. Jetzt: das Band kommt erst, wenn der Server die
     Anmeldung bestätigt (/auth/me), kein Anmelde- oder Registrierfenster offen ist, und es NENNT das Konto. Bis dahin
     bleibt die Übergabe gemerkt (7 Tage) - zwischengespeichert, später übernommen. */
  function fensterOffen() {
    var f = document.querySelectorAll('#dp-register-modal, .auth-overlay-v39, #authOverlay, #auth-overlay');
    for (var i = 0; i < f.length; i++) { var r = f[i].getBoundingClientRect(); if (r.width > 0 && r.height > 0 && getComputedStyle(f[i]).display !== 'none') return true; }
    return false;
  }
  var konto = null;
  async function anbieten() {
    if (gezeigt) return;
    var w = lesen();
    if (!w) return;
    var tok = null; try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    if (!tok) return;   /* nicht angemeldet: der Register-Weg läuft, nach dem Neuladen kommt das Band */
    if (fensterOffen()) { setTimeout(anbieten, 2500); return; }
    try {
      var me = window.Auth && Auth.apiCall ? await Auth.apiCall('/auth/me') : null;
      konto = me && me.user ? (me.user.email || me.user.name || null) : null;
    } catch (e) { konto = null; }
    if (!konto) return;   /* Server kennt die Anmeldung nicht: nichts anbieten, Übergabe bleibt gemerkt */
    if (gezeigt || fensterOffen()) { if (!gezeigt) setTimeout(anbieten, 2500); return; }
    gezeigt = true;
    band('<div style="font:600 11px JetBrains Mono,monospace;letter-spacing:.08em;color:var(--wl-b8932f, #b8932f);text-transform:uppercase">Deal-Check von der Startseite</div>'
      + '<div style="font:600 16px Space Grotesk,Inter,sans-serif;margin:4px 0 6px">Deal-Check übernehmen?</div>'
      + '<div>Kaufpreis ' + eur(w.kp) + ' · Kaltmiete ' + eur(w.nkm) + ' im Monat · Eigenkapital ' + eur(ekVon(w))
      + ' · Zins ' + dez(zinsVon(w), 2) + ' % · Nebenkosten ' + dez(nkVon(w), 0) + ' %</div>'
      + '<div style="color:#6b655c;font-size:12.5px;margin-top:6px">Angemeldet als <b>' + String(konto).replace(/[<>&"]/g, '') + '</b> – das Objekt kommt in dieses Konto. DealPilot legt daraus ein neues Objekt als Entwurf an. '
      + 'Adresse, Wohnfläche und Hausgeld trägst du danach selbst ein — erst dann rechnen Lage, Steuer und Wert mit.</div>',
      [{ text: 'Als Objekt anlegen', haupt: true, tun: function () { anlegen(w); } },
       { text: 'Später', tun: function () { bandWeg(); } },
       { text: 'Nein, danke', tun: function () { loeschen(); bandWeg(); } }]);
  }

  /* ── 3 · Anlegen ────────────────────────────────────────────────────── */
  function setze(id, val) {
    var e = document.getElementById(id);
    if (!e) return false;
    e.value = val;
    try { e.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {}
    return true;
  }
  function zahlAus(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(e.value) : parseFloat(String(e.value).replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function pausiere(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function limitFrei() {
    /* Der Server zählt alle Objekte des Nutzers (middleware/planLimits.js);
       hier dieselbe Zählung über die Liste, damit der Hinweis VOR dem Anlegen kommt. */
    try {
      if (typeof Sub === 'undefined' || !Sub.getCurrent) return { frei: true };
      var sub = await Sub.getCurrent();
      var lim = sub && sub.limits ? sub.limits.max_objects : null;
      if (lim == null || lim < 0) return { frei: true };
      var liste = await Auth.apiCall('/objects?limit=500');
      var n = ((liste && liste.items) || []).length;
      return { frei: n < lim, n: n, lim: lim, plan: sub.plan_name || sub.plan_id || '' };
    } catch (e) { return { frei: true }; }   /* im Zweifel anlegen: der Server sperrt ohnehin (403) */
  }

  async function anlegen(w) {
    bandWeg();
    var l = await limitFrei();
    if (!l.frei) {
      band('<div style="font:600 16px Space Grotesk,Inter,sans-serif;margin-bottom:6px">Dein Tarif ist voll</div>'
        + '<div>Dein Tarif' + (l.plan ? ' (' + l.plan + ')' : '') + ' hat Platz für ' + l.lim + (l.lim === 1 ? ' Objekt' : ' Objekte')
        + ', und alle sind belegt. Mit einem größeren Tarif legst du den Deal-Check sofort an — wir merken ihn dir sieben Tage.</div>',
        [{ text: 'Tarife ansehen', haupt: true, tun: function () { bandWeg(); if (typeof window.openPricingModal === 'function') window.openPricingModal(); } },
         { text: 'Später', tun: function () { bandWeg(); } },
         { text: 'Verwerfen', tun: function () { loeschen(); bandWeg(); } }]);
      return;
    }
    /* Erst die Übergabe löschen, dann anlegen: ein Neuladen mitten im Anlegen legt nichts doppelt an. */
    loeschen();

    var ek = ekVon(w), zins = zinsVon(w), nkPct = nkVon(w), tilg = 1.5;
    window._qcTakeover = true;
    var frei = setTimeout(function () { window._qcTakeover = false; }, 8000);
    try {
      var r = null;
      if (typeof window.newObj === 'function') r = window.newObj({ ohneAuswahl: true });
      if (r && typeof r.then === 'function') await r;
      await pausiere(250);   /* Vorgaben aus dem Profil (setTimeout in den newObj-Hüllen) erst setzen lassen */

      ['_deal_won_state', '_deal_lost_state', '_deal_won_at_state'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });

      setze('kuerzel', 'Deal-Check vom ' + datum());
      setze('kp', String(Math.round(w.kp)));
      setze('nkm', String(Math.round(w.nkm)));
      setze('ze', '0');
      setze('ek', String(Math.round(ek)));

      /* Nebenkosten: die Landing kennt nur den Gesamtsatz. Die fünf Sätze des
         neuen Objekts (aus den Einstellungen) werden anteilig auf diesen Satz
         gebracht — mit der Adresse rechnet die App Grunderwerbsteuer und Notar
         danach genau. Ohne Sätze im Formular trägt die Grunderwerbsteuer alles. */
      var teile = ['gest_p', 'notar_p', 'gba_p', 'makler_p', 'ji_p'];
      var alt = teile.map(zahlAus), summe = alt.reduce(function (a, b) { return a + b; }, 0);
      var neu = teile.map(function (id, i) { return summe > 0 ? alt[i] * nkPct / summe : (id === 'gest_p' ? nkPct : 0); });
      teile.forEach(function (id, i) { setze(id, dez(neu[i], 2)); });
      try { ['gest', 'notar', 'gba', 'makler', 'ji'].forEach(function (k) { if (typeof window.syncCostPct === 'function') window.syncCostPct(k); }); } catch (e) {}

      var d1 = Math.max(0, w.kp * (1 + nkPct / 100) - ek);
      setze('d1', String(Math.round(d1)));
      setze('d1z', dez(zins, 2));
      setze('d1t', dez(tilg, 2));
      var typ = document.getElementById('d1_type');
      if (typ && !typ.value) { typ.value = 'annuitaet'; try { typ.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
      var ausz = document.getElementById('d1_auszahl');
      if (ausz && !ausz.value) { var n0 = new Date(); ausz.value = ('0' + (n0.getMonth() + 1)).slice(-2) + '.' + n0.getFullYear(); }

      /* Bewirtschaftung wie auf der Landing: 16 % nicht umlagefähig + 1 % Leerstand */
      if (typeof window.switchBwkMode === 'function') window.switchBwkMode('percent');
      else window._bwkMode = 'percent';
      window._bwkPctMode = 'nkm';
      setze('bwk_nul_pct', '16');
      setze('bwk_ul_pct', '0');
      setze('leerstand', '1');
      ['san', 'moebl', 'umlagef'].forEach(function (id) { setze(id, '0'); });

      setze('notizen', 'Aus dem Deal-Check der Startseite übernommen am ' + datum() + new Date().getFullYear()
        + ': Kaufpreis ' + eur(w.kp) + ', Nettokaltmiete ' + eur(w.nkm) + ' im Monat, Eigenkapital ' + eur(ek)
        + ', Zins ' + dez(zins, 2) + ' %, Tilgung 1,5 %, Nebenkosten pauschal ' + dez(nkPct, 0) + ' %, '
        + 'nicht umlagefähige Kosten 16 % der Kaltmiete und 1 % Leerstand. Adresse, Objektart, Wohnfläche und Hausgeld fehlen noch.');

      /* v3313a · calc() ist entprellt (300 ms): nach den Eingabe-Ereignissen oben lief
         er nur verzögert, und saveObj stempelte Kennzahlen 0 (gemessen 11.11.2026:
         _kpis_bmy = 0, _kpis_cf_vs = 0). calcNow() rechnet sofort, danach kurz warten,
         falls ein Hüllen-calc (financing.js, indicative-zins.js) nachzieht. */
      if (typeof window.calcNow === 'function') window.calcNow();
      else if (typeof window.calc === 'function') window.calc();
      await pausiere(600);
      if (typeof window.calcNow === 'function') window.calcNow();
      if (typeof window.saveObj === 'function') {
        var ps = window.saveObj({ _qcFinal: true });
        if (ps && typeof ps.then === 'function') await ps;
      }
      if (typeof window.switchTab === 'function') { try { window.switchTab(0); } catch (e) {} }
      if (typeof window.toast === 'function') window.toast('✓ Deal-Check als neues Objekt angelegt — trag jetzt Adresse und Wohnfläche ein.');
    } catch (e) {
      try { console.error('[dealcheck-uebernahme]', e); } catch (x) {}
      if (typeof window.toast === 'function') window.toast('Deal-Check konnte nicht angelegt werden — bitte neu laden.');
    } finally {
      clearTimeout(frei);
      window._qcTakeover = false;
    }
  }

  /* dp:plan-ready kommt, sobald der Plan des angemeldeten Nutzers bekannt ist (subscription.js) */
  function spaeter() { setTimeout(anbieten, 1800); }
  window.addEventListener('dp:plan-ready', spaeter);
  window.addEventListener('load', function () { if (window.DealPilotPlanReady) spaeter(); });
  window.DpDealCheckUebernahme = { anbieten: anbieten, lesen: lesen, _anlegen: anlegen };
})();
