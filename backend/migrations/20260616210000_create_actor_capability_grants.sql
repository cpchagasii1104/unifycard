-- ============================================================
-- F-ACTOR-CAPABILITY-GRANTS-SCHEMA-AND-NONFIN-ENFORCEMENT-SLICE-1 (Slice 1A)
-- DECISION-0136 — substrato de capability grants POR ACTOR.
-- ============================================================
-- Materializa o modelo prometido por DECISION-0134 (referral=lookup; grants contra actor_id) e
-- DECISION-0135 (capability key canônica `domain:action`). Esta migration cria APENAS o substrato.
-- NENHUMA rota de negócio recebe enforcement neste Slice (decisão IA Diretora 2026-06-16): availability
-- permanece owner-only (DECISION-0113 canal-1 / DECISION-0118 D2 selados). A autoridade de operador
-- não-owner em agenda é decisão de produto separada — DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION (OPEN).
--
-- INVARIANTES DE SEGURANÇA (espelham tenant_operator_grants / DECISION-0126):
--   - grantee = ACTOR (grantee_actor_id), nunca user/CPF/CNPJ; nunca slug/referral (lookup ≠ authority).
--   - concedente sempre server-side (granted_by_actor_id + granted_by_user_id); actorId client-declared
--     NUNCA é subject. A autoridade do concedente é provada em runtime por canRepresentActor(scope_actor).
--   - grant em tenant A NÃO vale tenant B (chave por tenant_id).
--   - Todos os grants nascem inexistentes — SEM backfill permissivo.
--   - SOMENTE capabilities NÃO-FINANCEIRAS (allowlist abaixo). Proibido financial/split/cards/cash_drawer/
--     customer_credit/payout/ledger/refund/payment/transfer — financeiro = CRITICAL (3 paralelas, fora).
--   - scope_type = 'actor' apenas no MVP (sem 'global').
--   - NÃO toca bank_*, ledger, payout, RBAC V2, actor_roles/company_roles, permission-keys.ts,
--     business-permissions.types.ts, availability, votes/organization/contextual-thread.
--
-- Reversibilidade: ALTA (DROP TABLE). Blast: BAIXO (tabela nova isolada, zero enforcement).
-- Forward-only, aditiva, idempotente. gen_random_uuid() (PG13+ nativo).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS actor_capability_grants (
  grant_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- QUEM recebe (actor resolvido server-side; nunca slug/referral).
  grantee_actor_id      UUID NOT NULL REFERENCES actors (id) ON DELETE CASCADE,

  -- O QUE permite (DECISION-0135 `domain:action`; allowlist NÃO-financeira MVP).
  capability_key        TEXT NOT NULL,

  -- ONDE vale (MVP: escopo por actor; sem 'global').
  scope_type            TEXT NOT NULL DEFAULT 'actor',
  scope_actor_id        UUID NOT NULL REFERENCES actors (id) ON DELETE CASCADE,

  -- QUEM concede (autoria + autoridade no contexto; provada em runtime via canRepresentActor(scope)).
  granted_by_user_id    UUID NOT NULL,
  granted_by_actor_id   UUID NOT NULL REFERENCES actors (id),
  authority_source      TEXT NOT NULL,

  -- Estado do grant.
  status                TEXT NOT NULL DEFAULT 'active',
  valid_from            TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until           TIMESTAMPTZ NULL,
  revoked_at            TIMESTAMPTZ NULL,
  revoked_by_actor_id   UUID NULL REFERENCES actors (id),
  reason                TEXT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- MVP: escopo só por actor.
  CONSTRAINT chk_acg_scope_type CHECK (scope_type = 'actor'),
  -- Estado canônico.
  CONSTRAINT chk_acg_status CHECK (status IN ('active', 'revoked', 'expired', 'suspended')),
  -- Allowlist NÃO-FINANCEIRA (MVP). Exclui por construção qualquer key financeira. Nenhuma destas está
  -- aplicada a rota de negócio neste Slice (enforcement = Slice futuro). Expandir a allowlist = nova migration.
  CONSTRAINT chk_acg_capability_nonfinancial CHECK (
    capability_key IN (
      'calendar:block',
      'calendar:unblock',
      'services:create',
      'services:edit',
      'services:disable'
    )
  )
);

-- Unique parcial: um grant ATIVO por (tenant, grantee, capability, scope).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_actor_capability_grants_active
  ON actor_capability_grants (tenant_id, grantee_actor_id, capability_key, scope_type, scope_actor_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_actor_capability_grants_grantee
  ON actor_capability_grants (tenant_id, grantee_actor_id);

CREATE INDEX IF NOT EXISTS idx_actor_capability_grants_scope
  ON actor_capability_grants (tenant_id, scope_actor_id);

COMMIT;
