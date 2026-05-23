BEGIN;

-- bank_policies: políticas configuráveis do domínio Bank
-- Domínio: Bank (bank-policy.service.ts / BankPolicyService)
-- Suporta versionamento (version INT) e ciclo de vida (active/deprecated/draft)
-- getPolicy busca por (tenant_id, key, status='active') ORDER BY version DESC LIMIT 1
-- setPolicy depreca versões anteriores ao ativar nova versão

CREATE TABLE IF NOT EXISTS bank_policies (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  key          TEXT        NOT NULL,
  version      INTEGER     NOT NULL DEFAULT 1,
  status       TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'deprecated', 'draft')),
  value_json   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_policies_tenant_key_version_key UNIQUE (tenant_id, key, version)
);

-- Índice para getPolicy: (tenant_id, key, status) ORDER BY version DESC
CREATE INDEX IF NOT EXISTS idx_bank_policies_lookup
  ON bank_policies (tenant_id, key, status, version DESC);

-- RLS obrigatório (domínio financeiro — LEI §4.6)
ALTER TABLE bank_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_policies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bank_policies
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON TABLE bank_policies IS
  'Políticas configuráveis do Bank por tenant. Versionadas e deprecáveis.
   Suporte a: limites, split rules, thresholds. Tabela vazia = usar defaults hardcoded.';

COMMIT;
