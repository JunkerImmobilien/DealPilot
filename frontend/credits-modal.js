/**
 * v1194 — Was von der Kerosin-Kasse uebrig bleibt: die Rueckkehr vom Checkout.
 *
 * WAS DIESE DATEI BIS v1193 WAR UND WARUM DAS GEFAEHRLICH WURDE
 * Sie war der Kerosin-Laden aus V197/v489: vier Pakete (10/28/90/160 Liter
 * zu 2/5/15/25 EUR) und ein Kaufknopf je Paket. v1176 und v1183 haben diese
 * Waehrung abgeschafft — die Datei blieb, wurde aber nie abgehaengt.
 *
 * Sie war nicht bloss tote Zierde, sie stand auf dem GELDWEG:
 *
 *   1. Am Ende stand `window._buyCreditPack = ...`. `js/settings.js` setzt
 *      dieselbe globale Funktion — nur 100 Zeilen frueher in `index.html`
 *      (3151 vs. 3252). Bei gleichem Namen gewinnt der spaetere Setzer, also
 *      DIESE Datei. Damit fuehrte jedes „Dazubuchen" und „Kaufen" in
 *      Einstellungen -> Plan nicht zu Stripe, sondern in den Kerosin-Laden.
 *      Die Reparatur aus v1184 („der Kauf kommt an") lief auf diesem Weg
 *      also nie — sie war da, sie kam nur nie dran.
 *   2. Der Laden bot die ALTEN Preise an, und `creditPacks.js` kennt die
 *      SKUs kerosin_10..160 weiterhin. Ein Kauf waere durchgegangen — und
 *      `creditPackWebhook.js` haette ihn auf `bonus_credits` gebucht, die
 *      Spalte, von der `aiCreditsService` seit v1183 sagt: stillgelegt.
 *      Geld rein, nichts raus.
 *
 * WARUM DIE DATEI TROTZDEM BLEIBT
 * `checkPurchaseSuccess()` ist der EINZIGE Leser von `?credit_purchase=` —
 * dem Rueckkehr-Parameter, den `routes/credits.js:213` als `success_url` an
 * Stripe gibt. Wer die Datei loescht, nimmt jedem echten Kauf die
 * Rueckmeldung. Deshalb: ausgeraeumt, nicht entfernt.
 *
 * Verwendung:
 *   CreditsModal.checkPurchaseSuccess();  // im Boot, liest ?credit_purchase
 *   CreditsModal.open();                  // fuehrt aufs Preis-Modal
 */
'use strict';

const CreditsModal = (function() {

  /* v1194 · Es gibt hier keinen eigenen Laden mehr. Der Nachkauf laeuft
     ueber das Preis-Modal (`js/pricing-modal.js`), weil dort die Pakete
     aus `config.js` stehen — eine Quelle statt zwei. */
  function open() {
    if (typeof window.openPricingModal === 'function') { window.openPricingModal(); return; }
    if (typeof showSettings === 'function') { showSettings('plan'); return; }
    if (typeof toast === 'function') toast('Nachkauf konnte nicht geladen werden. Bitte Seite neu laden.');
  }

  function close() { /* nichts mehr zu schliessen — Signatur bleibt fuer alte Aufrufer */ }

  /** Wird im Boot aufgerufen: ?credit_purchase=success | canceled in URL? */
  function checkPurchaseSuccess() {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('credit_purchase');
    if (!result) return;

    // URL bereinigen
    params.delete('credit_purchase');
    params.delete('session_id');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);

    /* v1194 · Vorher stand hier „Kerosin erfolgreich getankt!". Das war der
       letzte Satz, den ein Kunde nach einem ECHTEN Kauf zu sehen bekam —
       in einer Waehrung, die es seit v1183 nicht mehr gibt. */
    if (result === 'success') {
      showResult('✓ Kauf abgeschlossen',
                 'Deine Bewertungen sind gutgeschrieben. Es kann bis zu 30 Sekunden dauern, ' +
                 'bis sie im Kontingent erscheinen.',
                 'success');
    } else if (result === 'canceled') {
      showResult('Kauf abgebrochen', 'Du hast den Kauf abgebrochen. Du kannst jederzeit erneut nachkaufen.', 'info');
    }
  }

  function showResult(title, msg, type) {
    const el = document.createElement('div');
    el.className = 'credits-result-toast credits-result-' + (type || 'info');
    el.innerHTML = `
      <div class="credits-result-title">${title}</div>
      <div class="credits-result-msg">${msg}</div>
      <button class="credits-result-close">OK</button>
    `;
    document.body.appendChild(el);
    el.querySelector('.credits-result-close').addEventListener('click', () => el.remove());
    setTimeout(() => { if (el.parentNode) el.remove(); }, 10000);
  }

  return { open, close, checkPurchaseSuccess };
})();

/* v1194 · HIER STAND `window._buyCreditPack = ...` UND DAS MUSS SO BLEIBEN:
   WEG. `js/settings.js:2109` setzt diese Funktion, und ihre Fassung ist die
   richtige — sie ruft `/credits/checkout` mit den Paketen aus `config.js`.
   Wer hier wieder etwas zuweist, ueberschreibt sie lautlos, weil diese Datei
   in `index.html` spaeter geladen wird. */

// Boot-Hook
document.addEventListener('DOMContentLoaded', () => {
  CreditsModal.checkPurchaseSuccess();
});

window.CreditsModal = CreditsModal;
