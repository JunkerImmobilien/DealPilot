/* v3035 · Versionsanzeige — liest frontend/version.json ohne Cache und setzt das Abzeichen
   unten neben Abmelden (.sb-version-badge, gebaut in auth.js aus window.DealPilotVersion).
   Marcel 29.10.2026: „vernünftige Versionspflege … unten im Menü neben dem Abmelden … immer anpassen". */
(function () {
  'use strict';
  function setze(v) {
    var label = 'V' + v.major + '.' + v.minor + '.' + v.patch;
    var stand = String(v.stand || '').split('-').reverse().join('.');
    window.DealPilotVersion = Object.assign(window.DealPilotVersion || {}, {
      label: label, major: v.major, minor: v.minor, patch: v.patch,
      semver: v.major + '.' + v.minor + '.' + v.patch, build: v.stand, paket: v.paket
    });
    var titel = 'Version ' + window.DealPilotVersion.semver + (stand ? ' · Stand ' + stand : '') + (v.paket ? ' · Paket ' + v.paket : '');
    [].forEach.call(document.querySelectorAll('.sb-version-badge'), function (b) { b.textContent = label; b.title = titel; });
  }
  function laden() {
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!v || !isFinite(v.major)) return;
        /* Baut auth.js die Leiste spaeter neu, liest es window.DealPilotVersion - das ist dann schon gesetzt */
        setze(v);
      })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', laden); else laden();
})();
