'use strict';
/**
 * v554: GeoMap-Guthaben-Schwellenwarnung.
 * Prueft das GeoMap-Restguthaben (account/v1/getBalance) und schickt bei
 * Unterschreitung der Schwelle (Default 10 EUR) EINE Mail/Tag an den Betreiber.
 * Spam-Schutz via app_alerts (alert_key='geomap_low').
 */
const { sendMail } = require('./mailerService');

const GEOMAP_BASE  = (process.env.GEOMAP_BASE || 'https://api.geomap.immo').replace(/\/+$/, '');
const GEOMAP_TOKEN = process.env.GEOMAP_TOKEN || '';
const THRESHOLD    = parseFloat(process.env.GEOMAP_ALERT_THRESHOLD_EUR || '10');
const ALERT_TO     = process.env.CREDIT_ALERT_TO || 'info@dealpilot.immo';

// Holt das GeoMap-Restguthaben (EUR netto) oder null.
async function fetchGeomapBalance() {
  if (!GEOMAP_TOKEN) return null;
  try {
    const r = await fetch(GEOMAP_BASE + '/account/v1/getBalance', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + GEOMAP_TOKEN }
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d && typeof d.amountEuroNetto === 'number') ? d.amountEuroNetto : null;
  } catch (e) { return null; }
}

// Prueft Schwelle + verschickt ggf. Mail (max 1x/24h). db = req.app.get('db').
async function checkAndAlert(db, balance) {
  try {
    if (balance == null || balance > THRESHOLD) return { sent: false, balance: balance };
    // Spam-Schutz: nur wenn letzte Mail > 24h her.
    const r = await db.query("SELECT last_sent_at FROM app_alerts WHERE alert_key = 'geomap_low'");
    const last = r.rows[0] && r.rows[0].last_sent_at ? new Date(r.rows[0].last_sent_at).getTime() : 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return { sent: false, balance: balance, throttled: true };

    const eur = balance.toFixed(2).replace('.', ',');
    await sendMail({
      to: ALERT_TO,
      subject: 'DealPilot: GeoMap-Guthaben niedrig (' + eur + ' EUR)',
      text: 'Das GeoMap-Restguthaben betraegt nur noch ' + eur + ' EUR (Schwelle: '
        + THRESHOLD.toFixed(2).replace('.', ',') + ' EUR).\n\n'
        + 'Bitte im GeoMap-Dashboard aufladen, damit Marktbewertung und Marktbericht '
        + 'weiterhin echte Daten liefern.\n\n-- DealPilot Admin'
    });
    await db.query(
      "INSERT INTO app_alerts (alert_key, last_sent_at, last_value) VALUES ('geomap_low', NOW(), $1) "
      + "ON CONFLICT (alert_key) DO UPDATE SET last_sent_at = NOW(), last_value = $1",
      [balance]
    );
    return { sent: true, balance: balance };
  } catch (e) {
    console.warn('[creditAlert] failed:', e.message);
    return { sent: false, balance: balance, error: e.message };
  }
}

module.exports = { fetchGeomapBalance, checkAndAlert, THRESHOLD };
