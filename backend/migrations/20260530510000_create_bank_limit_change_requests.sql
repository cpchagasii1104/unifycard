BEGIN;

-- bank_limit_change_requests: registros de pedidos de mudança de limite de transação
-- Domínio: Bank (módulo bank-limit.service / bank-limit.repository)
-- FK para actors (actor_id) e users (requested_by_user_id)
-- RLS obrigatório (tabela multi-tenant com dados financeiros sensíveis)

CREATE TABLE IF NOT EXISTS bank_limit_change_requests (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  actor_id              UUID          NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  limit_type            TEXT          NOT NULL,
  requested_amount      BIGINT        NOT NULL,
  requested_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  effective_at          TIMESTAMPTZ   NOT NULL,
  status                TEXT          NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'applied', 'rejected')),
  requested_by_user_id  UUID          REFERENCES users (user_id) ON DELETE SET NULL,
  authority_source      TEXT          NOT NULL DEFAULT 'self',
  metadata              JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices para as queries do repository (por actor+tipo+status, por effective_at)
CREATE INDEX IF NOT EXISTS idx_bank_limit_change_requests_actor
  ON bank_limit_change_requests (tenant_id, actor_id, limit_type);

CREATE INDEX IF NOT EXISTS idx_bank_limit_change_requests_pending
  ON bank_limit_change_requests (tenant_id, actor_id, limit_type, effective_at)
  WHERE status = 'pending';

-- RLS obrigatório (domínio financeiro — LEI §4.6)
ALTER TABLE bank_limit_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_limit_change_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bank_limit_change_requests
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON TABLE bank_limit_change_requests IS
  'Pedidos de mudança de limite transacional por actor. SSOT de limites vigentes via status=applied.';

COMMIT;
