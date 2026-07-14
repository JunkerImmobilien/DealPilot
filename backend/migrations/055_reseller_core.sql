-- 055_reseller_core.sql
-- Reseller-/Whitelabel-Grundschema — rekonstruiert 1:1 aus der Staging-DB.
-- Idempotent: ENUMs via DO-Guard, Tabellen/Indizes via IF NOT EXISTS.
-- Reihenfolge: ENUMs -> resellers -> members -> clients -> licenses -> shares -> audit.

-- ── ENUM-Typen ────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE public.billing_cycle   AS ENUM ('monatlich', 'jaehrlich'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.license_kind     AS ENUM ('berater', 'client'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.license_status   AS ENUM ('pool', 'zugewiesen', 'pausiert', 'gekuendigt'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.member_role      AS ENUM ('owner', 'berater'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reseller_role    AS ENUM ('steuerberater', 'makler', 'finanzierer', 'hausverwalter', 'sonstige', 'master'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reseller_status  AS ENUM ('aktiv', 'pausiert', 'gesperrt'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.share_level      AS ENUM ('ansehen', 'mitarbeiten', 'pruefen'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.share_status     AS ENUM ('offen', 'eingereicht', 'in_pruefung', 'bestaetigt', 'zurueckgegeben', 'widerrufen'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── resellers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resellers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    role public.reseller_role NOT NULL,
    status public.reseller_status DEFAULT 'aktiv' NOT NULL,
    is_master boolean DEFAULT false NOT NULL,
    whitelabel_enabled boolean DEFAULT false NOT NULL,
    brand_name text,
    brand_logo_b64 text,
    brand_accent text,
    brand_accent_hi text,
    brand_accent_lo text,
    brand_obsidian text,
    brand_domain text,
    stripe_subscription_id text,
    billing_cycle public.billing_cycle DEFAULT 'jaehrlich' NOT NULL,
    override_price_cents integer,
    can_sell_licenses boolean DEFAULT true NOT NULL,
    owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resellers_owner  ON public.resellers USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_resellers_status ON public.resellers USING btree (status);

-- ── reseller_members ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reseller_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role public.member_role DEFAULT 'berater' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (reseller_id, user_id)
);

-- ── reseller_clients ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reseller_clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    status public.reseller_status DEFAULT 'aktiv' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (reseller_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_clients_reseller ON public.reseller_clients USING btree (reseller_id);

-- ── licenses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    kind public.license_kind DEFAULT 'client' NOT NULL,
    status public.license_status DEFAULT 'pool' NOT NULL,
    client_id uuid REFERENCES public.reseller_clients(id) ON DELETE SET NULL,
    billing_cycle public.billing_cycle DEFAULT 'jaehrlich' NOT NULL,
    stripe_subscription_item_id text,
    current_period_end timestamptz,
    assigned_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_client          ON public.licenses USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_licenses_reseller_status ON public.licenses USING btree (reseller_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_license_active_per_client
    ON public.licenses USING btree (client_id)
    WHERE ((status = 'zugewiesen'::public.license_status) AND (client_id IS NOT NULL));

-- ── object_shares ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.object_shares (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    object_id uuid NOT NULL REFERENCES public.objects(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.reseller_clients(id) ON DELETE CASCADE,
    reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    access_level public.share_level DEFAULT 'ansehen' NOT NULL,
    status public.share_status DEFAULT 'offen' NOT NULL,
    submitted_at timestamptz,
    reviewed_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (object_id, reseller_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_client          ON public.object_shares USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_shares_reseller_status ON public.object_shares USING btree (reseller_id, status);

-- ── share_audit ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.share_audit (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    share_id uuid NOT NULL REFERENCES public.object_shares(id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    meta jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_audit_share ON public.share_audit USING btree (share_id, created_at);
