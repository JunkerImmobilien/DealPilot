/* ═══════════════════════════════════════════════════════════════════════
   gewinnspiel.js · messe-schleife-5 — DER SCHALTER FÜR DIE GEWINNSPIEL-TAFEL
   (immocation Festival 2026, EXPO-Gewinnspiel, unser Stand-QR)

   AUS-SCHALTEN:  an: true  →  an: false   (sonst nichts ändern)
   Am Stand ohne Datei-Änderung: Taste G (gilt bis das Fenster zu ist) oder
   messe-schleife.html?gewinnspiel=0. Fehlt die Bilddatei, entfällt die Tafel.

   bild      relativ zum Ordner messe-schleife/
   sekunden  Anzeigedauer je Tafel (Echtzeit)
   url       nur zur Kontrolle: was der QR-Code liefert (geprüft 21.10.2026)
   ═══════════════════════════════════════════════════════════════════════ */
window.MESSE_GEWINNSPIEL = {
  an: true,
  sekunden: 15,
  bild: 'gewinnspiel/qr-expo-2026.svg',
  url: 'https://gewinnspiel.immocation.de/a/dealpilot'
};
