-- 061_partner_stripe_live.sql
-- Migration 056 hat den Partner-Plan mit TEST-Stripe-IDs eingespielt
-- (prod_UsCIoKVXP3UVWR / price_1TsRt...KEjyPDo0wo... = Staging-Konto).
-- Auf Prod wurde das am 15.07. per Hand korrigiert — eine FRISCHE DB bekaeme
-- aber wieder die TEST-IDs. Diese Migration zieht sie nach.
-- Idempotent: setzt nur, wenn noch eine TEST-ID (…KEjyPDo0wo…) drinsteht.
UPDATE public.plans SET
  stripe_product_id       = 'prod_Ut8G0Zt5bgSMQj',
  stripe_price_monthly_id = 'price_1TtM0CGefFev8arzACdni0a9',
  stripe_price_yearly_id  = 'price_1TtM0CGefFev8arzixIUNCYo',
  stripe_price_id_monthly = 'price_1TtM0CGefFev8arzACdni0a9',
  stripe_price_id_yearly  = 'price_1TtM0CGefFev8arzixIUNCYo',
  updated_at = now()
WHERE id = 'partner'
  AND (stripe_product_id IS NULL
       OR stripe_product_id = 'prod_UsCIoKVXP3UVWR'
       OR stripe_price_monthly_id LIKE '%KEjyPDo0wo%'
       OR stripe_price_id_monthly IS NULL);
