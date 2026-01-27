/*
Arquivo: 030_social_actions.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Módulo: Social Actions

Função do arquivo:
- Persistir ações executáveis derivadas de posts sociais
- Atuar como ponte entre detecção de intent (IA) e execução real
- Registrar status, parâmetros e resultados das ações

Escopo:
- Ações geradas automaticamente a partir de posts
- Controle de execução (available, executed, failed, cancelled)
- Auditoria de quem executou e quando

Integrações / Dependências diretas:
- posts                 (origem da ação)
- tenants               (isolamento multi-tenant)
- global_users          (autor/ator da ação)
- update_updated_at_column() (trigger padrão)

Integrações indiretas:
- Orchestrator / IA
- Módulos de serviços, marketplace, eventos, pagamentos

Decisões de arquitetura:
- Uma ação pertence a um único post
- Ação é mutável (status e resultado), portanto possui updated_at
- confidence usa NUMERIC para consistência com Social Core (029)

Observações:
- Tabela multi-tenant com RLS completa
- Pronta para execução em lote com todas as migrations
*/

-- =========================================================
-- SOCIAL ACTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS social_actions (
  action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  intent TEXT NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),

  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,

  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'executed', 'failed', 'cancelled')),

  execution_result JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- =========================================================
-- ÍNDICES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_social_actions_post
  ON social_actions (post_id);

CREATE INDEX IF NOT EXISTS idx_social_actions_tenant
  ON social_actions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_social_actions_user
  ON social_actions (global_user_id);

CREATE INDEX IF NOT EXISTS idx_social_actions_intent
  ON social_actions (intent);

CREATE INDEX IF NOT EXISTS idx_social_actions_status
  ON social_actions (status);

CREATE INDEX IF NOT EXISTS idx_social_actions_created_at
  ON social_actions (created_at DESC);

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================
ALTER TABLE social_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'social_actions'
      AND policyname = 'social_actions_rls'
  ) THEN
    CREATE POLICY social_actions_rls
      ON social_actions
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- =========================================================
-- TRIGGER: updated_at (padrão global)
-- =========================================================
DROP TRIGGER IF EXISTS trg_social_actions_updated_at ON social_actions;
CREATE TRIGGER trg_social_actions_updated_at
  BEFORE UPDATE ON social_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- COMENTÁRIOS
-- =========================================================
COMMENT ON TABLE social_actions IS
  'Ações executáveis geradas automaticamente a partir de posts sociais';

COMMENT ON COLUMN social_actions.post_id IS
  'Post que originou esta ação';

COMMENT ON COLUMN social_actions.intent IS
  'Intent detectada no post que gerou a ação';

COMMENT ON COLUMN social_actions.confidence IS
  'Confiança da detecção de intent (0 a 1)';

COMMENT ON COLUMN social_actions.parameters IS
  'Parâmetros extraídos do post para execução da ação';

COMMENT ON COLUMN social_actions.status IS
  'Status da ação: available, executed, failed, cancelled';

COMMENT ON COLUMN social_actions.execution_result IS
  'Resultado da execução da ação';

COMMENT ON COLUMN social_actions.executed_at IS
  'Timestamp da execução da ação';

-- =========================================================
-- FIM DO ARQUIVO 030_social_actions.sql
-- =========================================================








