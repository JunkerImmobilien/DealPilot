/* partner-plan-kauf.js · v3610 — Partner-Plan kaufen und kuendigen (Marcel 17.11.2026)
 *
 * Eine Karte unter den vier Plaenen im Preis-Fenster (pricing-modal.js haengt sie ein) und der
 * Kuendigungs-Dialog, den Preis-Fenster, Einstellungen (Plan) und Partner-Cockpit (Verwaltung) teilen.
 *
 * Preise und Platzstaffel kommen aus GET /subscription/partner/angebot, also aus Stripe (lookup_key
 * dp_plan_partner_* und dp_seat_*, Volume-Staffel). Diese Datei rechnet nur die Vorschau mit genau
 * diesen Stufen; abgerechnet wird der Stripe-Preis.
 * Keine Testphase, kein Rabattcode (POST /subscription/partner/checkout nimmt keinen an).
 * Was eine Kuendigung fuer die Kunden bedeutet, kommt aus GET /subscription/partner/folgen
 * (Regel in partnerKunden.js: 30 Tage Frist je Kunde mit Partnerplatz, danach Trennung und Loeschung
 * seines Kontos, ausser er bucht ein eigenes Abo; Kunden mit eigenem Abo sind nicht betroffen).
 */
(function () {
  'use strict';
  var S = { angebot: null, plaetze: 0, iv: 'monthly' };

  function api(p, o) { return Auth.apiCall(p, o || {}); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(cent) {
    var v = (Number(cent) || 0) / 100;
    return v.toLocaleString('de-DE', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  }
  function fehlerText(e) { return (e && e.data && (e.data.message || e.data.error)) || (e && e.message) || 'Das hat nicht geklappt.'; }
  function meldung(t) { if (typeof window.toast === 'function') window.toast(t); else alert(t); }
  function aktuellerPlan() {
    try { return (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.currentKey()) || 'free'; } catch (e) { return 'free'; }
  }

  /* Volume-Staffel wie Stripe: alle Plaetze zum Satz der erreichten Stufe */
  function platzSatz(stufen, n) {
    if (!stufen || !stufen.length || n <= 0) return 0;
    for (var i = 0; i < stufen.length; i++) { if (stufen[i].bis == null || n <= stufen[i].bis) return stufen[i].cent; }
    return stufen[stufen.length - 1].cent;
  }
  function platzSumme(a, iv, n) {
    var p = a && a.platz && a.platz[iv]; if (!p || n <= 0) return 0;
    if (p.tiers_mode === 'graduated') {
      var rest = n, unten = 0, sum = 0;
      p.stufen.forEach(function (t) { var oben = t.bis == null ? Infinity : t.bis, k = Math.max(0, Math.min(rest, oben - unten)); if (k > 0) sum += k * t.cent + (t.pauschal || 0); rest -= k; unten = oben; });
      return sum;
    }
    return n * platzSatz(p.stufen, n);
  }
  function stufenText(a, iv) {
    var p = a && a.platz && a.platz[iv]; if (!p || !p.stufen) return '';
    var von = 1, ein = iv === 'yearly' ? 'Jahr' : 'Monat';
    return p.stufen.map(function (t) {
      var txt = (t.bis == null ? 'ab ' + von : von + '–' + t.bis) + ' Plätze: ' + eur(t.cent);
      von = (t.bis || 0) + 1; return txt;
    }).join(' · ') + ' je Platz und ' + ein;
  }

  function stil() {
    if (document.getElementById('dppp-stil')) return;
    var GD = 'var(--wl-b8932f,#b8932f)', RW = 'linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f))';
    var P = '#pricing-modal .dppp', D = '.dppp-dlg';
    var s = document.createElement('style'); s.id = 'dppp-stil';
    s.textContent =
      P + '{margin:18px 0 6px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 66px -38px rgba(0,0,0,.8),0 0 0 1px var(--wl-c9a84c-28,rgba(201,168,76,.28));display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}' +
      P + ' .dppp-l{padding:18px 22px;border-right:2px dashed #d8d2c2}' +
      P + ' .dppp-r{padding:18px 22px;display:flex;flex-direction:column;gap:10px}' +
      P + " .dppp-tag{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:" + GD + '}' +
      P + " .dppp-name{font-family:'Space Grotesk',sans-serif;font-size:23px;font-weight:700;color:#1a1305;margin:2px 0 8px}" +
      P + ' .dppp-l ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}' +
      P + ' .dppp-l li{font-size:13px;line-height:1.4;color:#3a352c;padding-left:20px;position:relative}' +
      P + " .dppp-l li::before{content:'\\2713';position:absolute;left:0;color:#2f8a58;font-weight:700}" +
      P + " .dppp-preis b{font-family:'Space Grotesk',sans-serif;font-size:34px;font-weight:700;color:#1a1305}" +
      P + " .dppp-preis span{font-family:'JetBrains Mono',monospace;font-size:11px;color:#6b6250;margin-left:4px}" +
      P + " .dppp-k{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6b6250}" +
      P + ' .dppp-step{display:flex;align-items:center;gap:6px}' +
      P + ' .dppp-step button{width:34px;height:34px;border-radius:9px;border:1px solid #d8d2c2;background:#fff;font-size:18px;cursor:pointer;color:#1a1305}' +
      P + ' .dppp-step input{width:70px;height:34px;text-align:center;border:1px solid #d8d2c2;border-radius:9px;font-size:15px;color:#1a1305;background:#fff}' +
      P + ' .dppp-zeile{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#3a352c}' +
      P + ' .dppp-summe{border-top:1px solid #ece6d6;padding-top:8px;font-weight:700;color:#1a1305;font-size:15px}' +
      P + ' .dppp-klein{font-size:11.5px;line-height:1.45;color:#6b6250;margin:0}' +
      P + " .dppp-cta{display:block;text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.05em;text-transform:uppercase;border-radius:11px;padding:13px 16px;border:0;cursor:pointer;background:" + RW + ';color:#221a06;font-weight:700}' +
      P + " .dppp-cta.zweit{background:#fff;border:1px solid " + GD + ';color:' + GD + ';font-weight:600}' +
      P + ' .dppp-cta[disabled]{opacity:.55;cursor:default}' +
      P + ' .dppp-knoepfe{display:flex;gap:8px;flex-wrap:wrap}.dppp-knoepfe .dppp-cta{flex:1;min-width:150px}' +
      '@media(max-width:720px){' + P + '{grid-template-columns:1fr}' + P + ' .dppp-l{border-right:0;border-bottom:2px dashed #d8d2c2}}' +
      D + '{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100050;display:flex;align-items:center;justify-content:center;padding:16px}' +
      D + ' .dppp-box{background:#fff;border-radius:14px;max-width:540px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.4);color:#2A2727;max-height:90vh;overflow:auto}' +
      D + " h3{margin:0 0 10px;font-family:'Space Grotesk',sans-serif;font-size:19px;color:#1a1305}" +
      D + ' p,' + D + ' li{font-size:13.5px;line-height:1.5;color:#3a352c}' +
      D + ' ul{padding-left:18px;margin:8px 0 14px}' +
      D + ' .dppp-knoepfe{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}' +
      D + " button{flex:1;min-width:150px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.04em;text-transform:uppercase;border-radius:10px;padding:12px 14px;cursor:pointer;border:1px solid #d8d2c2;background:#fff;color:#1a1305}" +
      D + ' button.rot{background:#B8625C;border-color:#B8625C;color:#fff;font-weight:700}';
    document.head.appendChild(s);
  }

  function angebotHolen() {
    if (S.angebot) return Promise.resolve(S.angebot);
    return api('/subscription/partner/angebot').then(function (a) { S.angebot = a; return a; });
  }

  /* ── Karte im Preis-Fenster ─────────────────────────────────────────────── */
  function karteZeichnen(el) {
    var a = S.angebot, iv = S.iv, cur = aktuellerPlan();
    var plan = a ? a.plan[iv] : null, n = S.plaetze, ps = platzSumme(a, iv, n), ein = iv === 'yearly' ? 'Jahr' : 'Monat';
    var links =
      '<div class="dppp-l"><div class="dppp-tag">Für Steuerberater, Finanzierer, Makler und Sachverständige</div>' +
        '<div class="dppp-name">Partner-Plan</div>' +
        '<ul><li>Alles aus Pro, dazu Partner-Cockpit für deine Kunden</li>' +
        '<li>Deine Marke: Logo und Farben für deine Kunden</li>' +
        '<li>Kundenplätze nach Bedarf, je mehr, desto günstiger jeder Platz</li>' +
        '<li>Plätze jederzeit im Partner-Cockpit nachkaufen oder reduzieren</li></ul></div>';
    var rechts;
    if (!a) {
      rechts = '<div class="dppp-r"><p class="dppp-klein">Preise werden geladen …</p></div>';
    } else if (cur === 'partner') {
      rechts = '<div class="dppp-r"><div class="dppp-preis"><b>' + eur(plan) + '</b><span>/ ' + ein + '</span></div>' +
        '<p class="dppp-klein">✓ Das ist dein aktueller Plan. Plätze änderst du im Partner-Cockpit unter Verwaltung.</p>' +
        '<div class="dppp-knoepfe"><button type="button" class="dppp-cta" data-a="cockpit">Plätze verwalten</button>' +
        '<button type="button" class="dppp-cta zweit" data-a="kuendigen">Partner-Plan kündigen</button></div></div>';
    } else {
      rechts = '<div class="dppp-r"><div class="dppp-preis"><b>' + eur(plan) + '</b><span>/ ' + ein + '</span></div>' +
        '<div class="dppp-k">Kundenplätze</div>' +
        '<div class="dppp-step"><button type="button" data-d="-1" aria-label="weniger">−</button><input type="number" min="0" max="' + (a.max_plaetze || 500) + '" value="' + n + '" aria-label="Anzahl Kundenplätze"><button type="button" data-d="1" aria-label="mehr">+</button></div>' +
        '<div class="dppp-zeile"><span>Partner-Plan</span><span>' + eur(plan) + '</span></div>' +
        '<div class="dppp-zeile"><span>' + n + (n === 1 ? ' Platz' : ' Plätze') + (n > 0 ? ' à ' + eur(platzSatz(a.platz[iv].stufen, n)) : '') + '</span><span>' + eur(ps) + '</span></div>' +
        '<div class="dppp-zeile dppp-summe"><span>Zusammen je ' + ein + '</span><span>' + eur(plan + ps) + '</span></div>' +
        '<p class="dppp-klein">' + esc(stufenText(a, iv)) + '. Im Partner-Plan ist kein Platz enthalten. Keine Testphase, die Abrechnung beginnt mit dem Kauf. Kündigung jederzeit zum Ende der Laufzeit.</p>' +
        (a.darf_kaufen === false ? '<p class="dppp-klein"><b>Du hast bereits ein Abo.</b> Kündige es zuerst zum Laufzeitende, danach kannst du den Partner-Plan buchen.</p>' : '') +
        '<button type="button" class="dppp-cta" data-a="kaufen"' + (a.darf_kaufen === false ? ' disabled' : '') + '>Partner-Plan kaufen</button></div>';
    }
    el.innerHTML = links + rechts;
    var inp = el.querySelector('.dppp-step input');
    if (inp) {
      var setzen = function (v) { S.plaetze = Math.max(0, Math.min(a.max_plaetze || 500, parseInt(v, 10) || 0)); karteZeichnen(el); var i2 = el.querySelector('.dppp-step input'); if (i2) i2.focus(); };
      [].forEach.call(el.querySelectorAll('.dppp-step button'), function (b) { b.onclick = function () { setzen(S.plaetze + Number(b.getAttribute('data-d'))); }; });
      inp.onchange = function () { setzen(inp.value); };
    }
    var k = el.querySelector('[data-a="kaufen"]'); if (k) k.onclick = function () { kaufen(k); };
    var c = el.querySelector('[data-a="cockpit"]'); if (c) c.onclick = cockpitOeffnen;
    var q = el.querySelector('[data-a="kuendigen"]'); if (q) q.onclick = kuendigenDialog;
  }

  function einhaengen(nach, period) {
    if (!nach || !nach.parentNode) return;
    stil();
    S.iv = period === 'yearly' ? 'yearly' : 'monthly';
    var el = document.getElementById('dppp-karte');
    if (!el) { el = document.createElement('div'); el.id = 'dppp-karte'; el.className = 'dppp'; nach.parentNode.insertBefore(el, nach.nextSibling); }
    karteZeichnen(el);
    angebotHolen().then(function () { karteZeichnen(el); }, function (e) {
      el.innerHTML = '<div class="dppp-l"><div class="dppp-name">Partner-Plan</div></div><div class="dppp-r"><p class="dppp-klein">' + esc(fehlerText(e)) + '</p></div>';
    });
  }
  function periode(period) {
    S.iv = period === 'yearly' ? 'yearly' : 'monthly';
    var el = document.getElementById('dppp-karte'); if (el) karteZeichnen(el);
  }

  async function kaufen(knopf) {
    var _wv = (window.DpWiderruf && typeof DpWiderruf.einholen === 'function') ? await DpWiderruf.einholen('Partner-Plan buchen') : null;
    if (!_wv) return;
    if (knopf) { knopf.disabled = true; knopf.textContent = 'Weiterleitung …'; }
    try {
      var r = await api('/subscription/partner/checkout', { method: 'POST', body: {
        billingInterval: S.iv, plaetze: S.plaetze,
        successUrl: location.origin + location.pathname + '?subscription=success&partner=1&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: location.origin + location.pathname + '?subscription=cancel',
        widerruf_verzicht: true, widerruf_version: _wv.widerruf_version } });
      if (r && r.url) { location.href = r.url; return; }
      meldung('Der Kauf konnte nicht gestartet werden.');
    } catch (e) { meldung(fehlerText(e)); }
    if (knopf) { knopf.disabled = false; knopf.textContent = 'Partner-Plan kaufen'; }
  }

  function cockpitOeffnen() {
    try { if (typeof window.closePricingModal === 'function') window.closePricingModal(); } catch (e) {}
    try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (e) {}
    if (window.DpPartnerKunden && typeof DpPartnerKunden.reiterWahl === 'function') { DpPartnerKunden.reiterWahl('verwaltung'); return; }
    if (typeof window.openResellerPortal === 'function') window.openResellerPortal();
  }

  /* ── Kuendigungs-Dialog ─────────────────────────────────────────────────── */
  function datum(s) { try { return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } }
  async function kuendigenDialog() {
    stil();
    var f = null, sub = null;
    try { f = await api('/subscription/partner/folgen'); } catch (e) { f = null; }
    try { sub = (window.Sub && typeof Sub.getCurrent === 'function') ? await Sub.getCurrent(true) : null; } catch (e) { sub = null; }
    var frist = (f && f.frist_tage) || 30, np = f ? f.kunden_platz : null, ne = f ? f.kunden_eigen : null;
    var ende = sub && sub.current_period_end ? datum(sub.current_period_end) : '';
    var schonGekuendigt = !!(sub && sub.cancel_at_period_end);
    var alt = document.querySelector('.dppp-dlg'); if (alt) alt.remove();
    var d = document.createElement('div'); d.className = 'dppp-dlg';
    d.innerHTML = '<div class="dppp-box" role="dialog" aria-modal="true" aria-labelledby="dppp-dlg-t"><h3 id="dppp-dlg-t">Partner-Plan kündigen</h3>' +
      (schonGekuendigt ? '<p><b>Dein Partner-Plan ist bereits gekündigt' + (ende ? ' und endet am ' + ende : '') + '.</b> Im Abo-Portal kannst du die Kündigung zurücknehmen.</p>' :
        '<p>Die Kündigung wirkt zum Ende des bezahlten Zeitraums' + (ende ? ', also zum <b>' + ende + '</b>' : '') + '. Bis dahin läuft alles weiter wie heute.</p>') +
      '<p><b>Danach passiert mit deinen Kunden:</b></p><ul>' +
      '<li><b>Kunden mit Partnerplatz' + (np != null ? ' (' + np + ')' : '') + ':</b> Jeder bekommt ' + frist + ' Tage Frist und kann in dieser Zeit lesen, exportieren oder ein eigenes Abo buchen. Danach wird die Verbindung getrennt und sein Konto gelöscht, außer er hat ein eigenes Abo gebucht.</li>' +
      '<li><b>Kunden mit eigenem Abo' + (ne != null ? ' (' + ne + ')' : '') + ':</b> Ihr Konto und Abo bleiben unverändert.</li>' +
      '<li><b>Deine Kundenplätze</b> enden mit dem Abo, das Partner-Cockpit und deine Marke stehen dir dann nicht mehr zur Verfügung.</li></ul>' +
      '<p>Die Kündigung bestätigst du im Abo-Portal unseres Zahlungsanbieters.</p>' +
      '<div class="dppp-knoepfe"><button type="button" data-a="zu">Abbrechen</button><button type="button" class="rot" data-a="weiter">' + (schonGekuendigt ? 'Zum Abo-Portal' : 'Weiter zur Kündigung') + '</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d) d.remove(); });
    d.querySelector('[data-a="zu"]').onclick = function () { d.remove(); };
    d.querySelector('[data-a="weiter"]').onclick = async function () {
      var b = this; b.disabled = true;
      try {
        var r = schonGekuendigt && window.Sub && Sub.openPortal ? (await Sub.openPortal(), null)
          : await api('/subscription/partner/kuendigen', { method: 'POST', body: { returnUrl: location.origin + location.pathname + '?partner_kuendigung=1' } });
        if (r && r.url) { location.href = r.url; return; }
      } catch (e) { meldung(fehlerText(e)); b.disabled = false; }
    };
  }

  /* ── Rueckweg aus Stripe ────────────────────────────────────────────────── */
  (function rueckweg() {
    var q = new URLSearchParams(location.search);
    /* subscription.js raeumt die Adresse beim Laden auf und merkt sich die Sitzung in window._dpPartnerSitzung */
    var sid = window._dpPartnerSitzung || (q.get('subscription') === 'success' && q.get('partner') === '1' && q.get('session_id')) || null;
    if (sid) {
      var los = function () {
        if (!window.Auth || typeof Auth.apiCall !== 'function') return;
        api('/subscription/partner/bestaetigen', { method: 'POST', body: { sessionId: sid } }).then(function (r) {
          try { if (window.Sub && Sub.clearCache) Sub.clearCache(); } catch (e) {}
          if (r && r.ok) setTimeout(function () { meldung('✓ Partner-Plan aktiv' + (r.pool ? ', ' + r.pool.gekauft + ' Kundenplätze' : '')); }, 900);
          setTimeout(function () { try { location.reload(); } catch (e) {} }, 2200);
        }, function () { /* der Webhook bucht trotzdem */ });
      };
      if (document.readyState === 'complete') setTimeout(los, 800); else window.addEventListener('load', function () { setTimeout(los, 800); });
    }
    if (q.get('partner_kuendigung') === '1') {
      try { history.replaceState({}, '', location.pathname); } catch (e) {}
      try { if (window.Sub && Sub.clearCache) Sub.clearCache(); } catch (e) {}
    }
  })();

  /* ── v3610d · von der Landing „Partner-Plan buchen“ (?register=1&partner_kauf=1) ──────────────────────
     Merker im localStorage, damit er Registrierung, Mail-Bestaetigung und Anmeldung im selben Browser ueberlebt
     (auth.js raeumt die Adresse beim Start, dieses Skript liest sie vorher). Ist jemand angemeldet, oeffnet sich
     das Preis-Fenster an der Partner-Karte; der Merker wird dabei verbraucht. */
  (function vonDerLanding() {
    var K = 'dp_partner_kauf';
    try { if (new URLSearchParams(location.search).get('partner_kauf') === '1') localStorage.setItem(K, String(Date.now())); } catch (e) {}
    var versuche = 0;
    function pruefen() {
      var seit = 0; try { seit = parseInt(localStorage.getItem(K), 10) || 0; } catch (e) {}
      if (!seit) return;
      if (Date.now() - seit > 7 * 864e5) { try { localStorage.removeItem(K); } catch (e) {} return; }
      var drin = window.Auth && typeof Auth.isLoggedIn === 'function' && Auth.isLoggedIn();
      if (!drin || typeof window.openPricingModal !== 'function') { if (++versuche < 120) setTimeout(pruefen, 1000); return; }
      try { localStorage.removeItem(K); } catch (e) {}
      if (aktuellerPlan() === 'partner') { cockpitOeffnen(); return; }
      window.openPricingModal();
      setTimeout(function () { var k = document.getElementById('dppp-karte'); if (k) k.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 1200);
    }
    if (document.readyState === 'complete') setTimeout(pruefen, 1500); else window.addEventListener('load', function () { setTimeout(pruefen, 1500); });
    window.addEventListener('dp:plan-ready', function () { versuche = 0; setTimeout(pruefen, 800); });   /* nach der Anmeldung */
  })();

  window.DpPartnerPlan = { einhaengen: einhaengen, periode: periode, kuendigenDialog: kuendigenDialog, angebotHolen: angebotHolen,
    platzSumme: platzSumme, platzSatz: platzSatz, stufenText: stufenText, eur: eur, _state: S };
})();
