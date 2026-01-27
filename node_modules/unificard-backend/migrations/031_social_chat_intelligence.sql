/*
Arquivo: 031_social_chat_intelligence.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Módulo: Social Chat Intelligence (SCI)

Função do arquivo:
- Persistir mensagens de chat inteligente
- Servir como base para detecção de intent, contexto e ações automáticas
- Atuar como fonte primária de dados conversacionais para IA/orchestrator

Escopo:
- Mensagens textuais e multimídia
- Conteúdo bruto (ex: áudio transcrito)
- Intent detectada automaticamente
- Confiança da detecção
- Sugestões de ações e metadados de inferência

Integrações / Dependências diretas:
- tenants                    (isolamento multi-tenant)
- global_users               (autor da mensagem)
- update_updated_at_column() (trigger padrão)

Integrações indiretas:
- Social Actions (030)
- Events, Marketplace, Serviços
- Orchestrator / IA

Decisões de arquitetura:
- Categorias NÃO são armazenadas diretamente na mensagem
  → Taxonomia relacional vive no módulo 040
  → Inferências livres ficam em metadata
- confidence usa NUMERIC para evitar imprecisão de FLOAT
- Chat é mutável → possui updated_at

Observações:
- conversation_id é opaco (UUID ou externo)
- RLS completa (USING + WITH CHECK)
- Pronto para execução em lote com todas as migrations
*/

-- =========================================================
-- SOCIAL CHAT MESSAGES
-- =========================================================
CREATE TABLE IF NOT EXISTS social_chat_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  raw_content TEXT,

  media JSONB NOT NULL DEFAULT '[]'::jsonb,

  intent TEXT,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),

  suggested_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- ÍNDICES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_social_chat_messages_conversation
  ON social_chat_messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_social_chat_messages_tenant
  ON social_chat_messages (tenant_id);

CREATE INDEX IF NOT EXISTS idx_social_chat_messages_user
  ON social_chat_messages (global_user_id);

CREATE INDEX IF NOT EXISTS idx_social_chat_messages_intent
  ON social_chat_messages (intent)
  WHERE intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_chat_messages_created_at
  ON social_chat_messages (conversation_id, created_at DESC);

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================
ALTER TABLE social_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'social_chat_messages'
      AND policyname = 'social_chat_messages_rls'
  ) THEN
    CREATE POLICY social_chat_messages_rls
      ON social_chat_messages
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- =========================================================
-- TRIGGER: updated_at (padrão global)
-- =========================================================
DROP TRIGGER IF EXISTS trg_social_chat_messages_updated_at ON social_chat_messages;
CREATE TRIGGER trg_social_chat_messages_updated_at
  BEFORE UPDATE ON social_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- COMENTÁRIOS
-- =========================================================
COMMENT ON TABLE social_chat_messages IS
  'Mensagens de chat inteligente usadas para detecção de intent e ações';

COMMENT ON COLUMN social_chat_messages.conversation_id IS
  'Identificador da conversa (UUID interno ou externo)';

COMMENT ON COLUMN social_chat_messages.content IS
  'Conteúdo processado da mensagem';

COMMENT ON COLUMN social_chat_messages.raw_content IS
  'Conteúdo original antes de processamento (ex: áudio transcrito)';

COMMENT ON COLUMN social_chat_messages.intent IS
  'Intent detectada automaticamente pelo orchestrator';

COMMENT ON COLUMN social_chat_messages.confidence IS
  'Confiança da detecção de intent (0 a 1)';

COMMENT ON COLUMN social_chat_messages.suggested_actions IS
  'Ações sugeridas com base na mensagem';

COMMENT ON COLUMN social_chat_messages.metadata IS
  'Metadados e inferências adicionais da IA';

-- =========================================================
-- FIM DO ARQUIVO 031_social_chat_intelligence.sql
-- =========================================================








