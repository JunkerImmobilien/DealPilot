-- 075_partner_preis_v1536.sql
--
-- Marcel am 22.09.2026: das Partner-Paket kostete 49,00 EUR und lag damit
-- 99 Cent UNTER Pro (49,99) - bei vollem Pro-Umfang plus Whitelabel plus
-- Reseller-Konsole. Jeder Kunde haette statt Pro das Partner-Paket nehmen
-- koennen. Neu: 99,00 EUR im Monat, 1.089,00 EUR im Jahr (ein Freimonat).
--
-- Beim Messen fiel auf, dass das beworbene Versprechen "3 Berater-Seats
-- inklusive" keine technische Entsprechung hat: plans.max_users steht fuer
-- ALLE Plaene auf 1 und wird nirgends durchgesetzt, und die Tabelle
-- licenses kennt nur MANDANTEN-Seats. Marcels Entscheidung: drei
-- Mandanten-Plaetze inklusive - das kann die Software heute.
--
-- WICHTIG: der abgerechnete Betrag kommt NICHT aus dieser Migration,
-- sondern beim Backend-Start aus Stripe (plans-preise-sync.js ueber die
-- lookup_keys dp_plan_partner_monthly / _yearly). Diese Migration sorgt
-- nur dafuer, dass eine frisch aufgesetzte Datenbank nicht mit dem Stand
-- von v1176 (99 EUR aus Migration 064) startet und bis zum ersten Sync
-- etwas anderes zeigt.

UPDATE plans
   SET price_monthly_cents = 9900,
       price_yearly_cents   = 108900
 WHERE id = 'partner';
