# DealPilot — Offene To-dos für nächste Session

## Priorität 1: KI-Credit-Käufe via Stripe (eigener Sprint)

**Status heute (13.05.2026):** Frontend zeigt Credit-Pakete, aber Kauf ist ein Stub.

**Was zu tun:**

### Stripe-Setup
- [ ] 4 Stripe-Produkte anlegen (one-time, NICHT subscription):
  - Quick: 5 Credits / 5 €
  - Mehrere Deals: 15 Credits / 12 €
  - Aktiv (Bestseller): 40 Credits / 29 €
  - Pro: 100 Credits / 59 €
- [ ] Price-IDs notieren

### Backend
- [ ] Neue DB-Spalten oder Tabelle für Credit-Pack-Mapping:
  - Option A: `plans`-Tabelle erweitern um type='credit_pack'
  - Option B: Neue Tabelle `credit_packs` mit stripe_price_id + credits_amount
- [ ] `POST /api/v1/ai/credits/checkout`-Endpoint (analog zu /subscription/checkout)
- [ ] Stripe createCheckoutSession mit `mode: 'payment'` (one-time)
- [ ] Webhook-Handler erweitern: bei `checkout.session.completed` UND mode=payment → Credits in DB schreiben
  - `INSERT INTO ai_credits_log (user_id, delta, source='stripe_purchase', stripe_session_id)`
- [ ] Idempotenz-Check: gleiche `stripe_session_id` nicht doppelt verarbeiten

### Frontend
- [ ] `_buyCreditPack(packKey)` in settings.js: Stub durch echten Stripe-Call ersetzen
- [ ] Toast nach erfolgreicher Bezahlung: "X Credits hinzugefügt"
- [ ] `AiCredits.refresh(true)` aufrufen nach Redirect

### Test
- [ ] Test-Karte 4242: Kauf 5-Credits-Paket
- [ ] DB-Verify: Credits sind in ai_credits_log
- [ ] UI-Verify: Header-Pill zeigt neue Credit-Anzahl

**Geschätzte Dauer:** 2 Stunden

---

## Priorität 2: Plan-Upgrade mit Proration testen

- [ ] Test: Starter (29€/Mo) → Pro (99€/Mo) im laufenden Monat
- [ ] Stripe rechnet Proration aus
- [ ] DB-Update funktioniert?

## Priorität 3: Customer-Portal

- [ ] `Sub.openPortal()` testen (sollte zu Stripe-Portal redirecten)
- [ ] User kann dort: Karte ändern, Abo kündigen, Rechnungen runterladen
- [ ] Stripe-Webhook für subscription.deleted greift

## Priorität 4: Welcome-Mail nach Stripe-Checkout

- [ ] Im Webhook-Handler bei checkout.session.completed auch Mail rausschicken?
- [ ] mailerService.js erweitern

## Priorität 5: Live-Mode-Vorbereitung

- [ ] Stripe-Account-Verifikation (Steuer, Bank, Personalausweis) — dauert 1-3 Werktage
- [ ] AGB / Widerrufsbelehrung rechtssicher prüfen lassen
- [ ] Live-Stripe-Produkte (parallel zu Test) anlegen
- [ ] Auszahlungs-Bankverbindung hinterlegen
- [ ] Live-Webhook für dealpilot.junker-immobilien.io
- [ ] Live-Price-IDs in Prod-DB
- [ ] Erste reale Test-Bestellung (z.B. selbst Starter buchen)

