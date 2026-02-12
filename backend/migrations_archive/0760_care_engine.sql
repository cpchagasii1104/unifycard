/*
Arquivo: 033_care_engine.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Módulo: CARE (Chat Auto-Responder Engine)

Função do arquivo:
- Gerenciar sessões de conversa do motor CARE
- Persistir contexto, estado e histórico de mensagens
- Servir como base para respostas automáticas orientadas a intent

Escopo:
- Sessões de conversa (estado mutável)
- Mensagens imutáveis (usuário e sistema)
- Contexto incremental para IA/orchestrator

Integrações / Dependências diretas:
- tenants
- global_users
- update_updated_at_column()

Integrações indiretas:
- Social Chat Intelligence (031)
- Social Actions (030)
- Schedule (032)
- Orchestrator / AI Kernel

Decisões de arquitetura:
- Uma sessão CARE possui exatamente um alvo:
  → usuário global OU empresa
- Sessões são mutáveis → possuem updated_at
- Mensagens são imutáveis → sem updated_at
- RLS completa e herdada corretamente

Observações:
- Pronto para execução em lote
- Seguro para reprocessamento por IA
*/

-- =========================================================
-- CARE SESSIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS care_sessions (
  care_session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  target_global_user_id UUID
    REFERENCES global_users(global_user_id)
    ON DELETE SET NULL,

  target_company_id UUID,

  last_message TEXT,

  state   JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT care_sessions_single_target CHECK (
    (target_global_user_id IS NOT NULL)::int +
    (target_company_id IS NOT NULL)::int = 1
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_care_sessions_tenant
  ON care_sessions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_care_sessions_user
  ON care_sessions (global_user_id);

CREATE INDEX IF NOT EXISTS idx_care_sessions_target_user
  ON care_sessions (target_global_user_id)
  WHERE target_global_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_care_sessions_target_company
  ON care_sessions (target_company_id)
  WHERE target_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_care_sessions_updated_at
  ON care_sessions (updated_at DESC);

-- RLS
ALTER TABLE care_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'care_sessions'
      AND policyname = 'care_sessions_rls'
  ) THEN
    CREATE POLICY care_sessions_rls
      ON care_sessions
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_care_sessions_updated_at ON care_sessions;
CREATE TRIGGER trg_care_sessions_updated_at
  BEFORE UPDATE ON care_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- CARE MESSAGES
-- =========================================================
CREATE TABLE IF NOT EXISTS care_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  care_session_id UUID NOT NULL
    REFERENCES care_sessions(care_session_id)
    ON DELETE CASCADE,

  is_from_user BOOLEAN NOT NULL,
  content TEXT NOT NULL,

  intent TEXT,
  parameters JSONB,
  ai_reasoning JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_care_messages_session
  ON care_messages (care_session_id);

CREATE INDEX IF NOT EXISTS idx_care_messages_created_at
  ON care_messages (care_session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_care_messages_intent
  ON care_messages (intent)
  WHERE intent IS NOT NULL;

-- RLS (herda da sessão)
ALTER TABLE care_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'care_messages'
      AND policyname = 'care_messages_rls'
  ) THEN
    CREATE POLICY care_messages_rls
      ON care_messages
      USING (
        EXISTS (
          SELECT 1
          FROM care_sessions s
          WHERE s.care_session_id = care_messages.care_session_id
            AND s.tenant_id::text = current_setting('app.current_tenant', true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM care_sessions s
          WHERE s.care_session_id = care_messages.care_session_id
            AND s.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;

-- =========================================================
-- COMENTÁRIOS
-- =========================================================
COMMENT ON TABLE care_sessions IS
  'Sessões de conversa do motor CARE (Chat Auto-Responder Engine)';

COMMENT ON COLUMN care_sessions.global_user_id IS
  'Usuário consumidor da conversa';

COMMENT ON COLUMN care_sessions.target_global_user_id IS
  'Usuário/profissional alvo da conversa (opcional)';

COMMENT ON COLUMN care_sessions.target_company_id IS
  'Empresa alvo da conversa (opcional)';

COMMENT ON COLUMN care_sessions.state IS
  'Estado da conversa (ex: perguntas pendentes, fluxo atual)';

COMMENT ON COLUMN care_sessions.context IS
  'Contexto incremental da conversa para IA';

COMMENT ON TABLE care_messages IS
  'Mensagens imutáveis da conversa (usuário e sistema)';

COMMENT ON COLUMN care_messages.is_from_user IS
  'true = mensagem do usuário, false = mensagem do sistema';

COMMENT ON COLUMN care_messages.ai_reasoning IS
  'Raciocínio do AI Kernel para geração da resposta';

-- =========================================================
-- FIM DO ARQUIVO 033_care_engine.sql
-- =========================================================








