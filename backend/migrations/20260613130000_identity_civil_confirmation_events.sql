-- 20260613130000_identity_civil_confirmation_events.sql
-- DECISION-0120 — confirmação/trava de identidade civil em camada identity auditável.
-- F-CIVIL-IDENTITY-CONFIRMATION-SSOT-SEPARATION.
--
-- CAUSA-RAIZ: profiles.is_profile_personal_confirmed / metadata.profile_personal_confirmed /
-- metadata.personal_data_locked operavam como AUTORIDADE da confirmação/trava civil — violação
-- do Perfil-como-projeção (DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT). Esta migration cria a
-- fonte auditável append-only e BACKFILLA o estado legado SEM perda (usuário hoje travado
-- permanece travado), deixando as flags de profiles como projeção/tombstone (D7).
--
-- Schema vivo: `identities`/`global_users` são keyed por `global_user_id` (não há `identity_id`
-- separado) — a referência de identidade é `global_user_id`. CPF NÃO é guardado em claro no
-- snapshot (apenas hash + últimos 3 dígitos). Append-only; sem UPDATE de reescrita. Zero Bank.
-- Forward-only; gen_random_uuid() (PG13+).

BEGIN;

-- ── 1. Tabela de eventos de confirmação civil (append-only) ──────────────────
CREATE TABLE IF NOT EXISTS identity_civil_confirmation_events (
  event_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  -- Identidade civil (identities/global_users são keyed por global_user_id).
  global_user_id        uuid NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  -- Quem confirmou (usuário autenticado) e actor resolvido server-side (nullable: backfill/legado).
  confirmed_by_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id              uuid REFERENCES actors(id),
  event_type            text NOT NULL DEFAULT 'civil_data_confirmed'
                          CHECK (event_type IN ('civil_data_confirmed')),
  event_version         integer NOT NULL DEFAULT 1 CHECK (event_version >= 1),
  -- Snapshot do QUE foi confirmado (campos civis); CPF só por hash/parcial, nunca em claro.
  payload_snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- "Uma confirmação vigente" por (tenant, identidade): idempotência segura (DO NOTHING).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_identity_civil_confirmation_vigente
  ON identity_civil_confirmation_events (tenant_id, global_user_id)
  WHERE event_type = 'civil_data_confirmed';

CREATE INDEX IF NOT EXISTS idx_identity_civil_confirmation_user
  ON identity_civil_confirmation_events (tenant_id, confirmed_by_user_id);

-- RLS tenant-safe (padrão vivo: app.current_tenant via set_config).
ALTER TABLE identity_civil_confirmation_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'identity_civil_confirmation_events'
      AND policyname = 'identity_civil_confirmation_tenant_isolation'
  ) THEN
    CREATE POLICY identity_civil_confirmation_tenant_isolation
      ON identity_civil_confirmation_events
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;
END $$;

-- ── 2. BACKFILL fail-safe do estado legado (D7 — sem perda) ──────────────────
-- Preserva a TRAVA vigente: todo profile hoje "travado" (canEditPersonalData=false, i.e.
-- is_profile_personal_confirmed OR metadata.profile_personal_confirmed OR
-- metadata.personal_data_locked) recebe um evento civil confirmado, resolvendo a identidade
-- via users. Idempotente; não sobrescreve confirmação existente.
INSERT INTO identity_civil_confirmation_events
  (tenant_id, global_user_id, confirmed_by_user_id, actor_id, event_type, event_version, payload_snapshot, confirmed_at)
SELECT
  p.tenant_id,
  u.global_user_id,
  u.id,
  (SELECT a.id FROM actors a WHERE a.user_id = u.id AND a.actor_type = 'user' LIMIT 1),
  'civil_data_confirmed',
  1,
  jsonb_build_object('source', 'backfill_decision_0120'),
  COALESCE(p.updated_at, now())
FROM profiles p
JOIN users u ON u.id = p.user_id AND u.global_user_id IS NOT NULL
WHERE (
        COALESCE(p.is_profile_personal_confirmed, false)
        OR COALESCE((p.metadata->>'profile_personal_confirmed')::boolean, false)
        OR COALESCE((p.metadata->>'personal_data_locked')::boolean, false)
      )
ON CONFLICT (tenant_id, global_user_id) WHERE event_type = 'civil_data_confirmed' DO NOTHING;

-- Aviso visto (notice seen) preservado como PROJEÇÃO em profiles.metadata para quem já clicou
-- "Entendi, continuar" (is_profile_personal_confirmed) e ainda não tem o marcador novo.
UPDATE profiles p
   SET metadata = COALESCE(p.metadata, '{}'::jsonb)
                  || jsonb_build_object('first_access_notice_seen_at', COALESCE(p.updated_at, now())::text)
 WHERE (
         COALESCE(p.is_profile_personal_confirmed, false)
         OR COALESCE((p.metadata->>'profile_personal_confirmed')::boolean, false)
       )
   AND (p.metadata->>'first_access_notice_seen_at') IS NULL;

COMMIT;
