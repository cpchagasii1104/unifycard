-- 🔴 LEGADO — Estrutura temporal paralela (group_schedules).
-- 🔴 PROIBIDO USO EM NOVO CÓDIGO.
-- 🔴 Migrar para Unified Availability (migration 144).
-- ============================================================
-- UNIFICARD — MIGRATION 114
-- Arquivo: 114_groups_community_governance.sql
-- Sistema de Grupos como ONGs Digitais Auto-Reguladas
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Transformar grupos em núcleos comunitários auto-regulados com:
-- • Governança transparente
-- • Participação comunitária (posts, comentários, reações, votos)
-- • Transparência financeira
-- • Agenda e eventos
-- • Campanhas de ação
-- • Timeline/histórico
-- • Canal de contato
--
-- ESCOPO
-- ✔ Adiciona campos de localização e escopo em groups
-- ✔ Cria tabelas de interação (posts, comentários, reações, denúncias)
-- ✔ Cria sistema de votação
-- ✔ Cria agenda e eventos
-- ✔ Cria timeline
-- ✔ Cria campanhas
-- ✔ Cria transparência financeira
-- ✔ Cria canal de contato
--
-- ❌ Não remove dados
-- ❌ Não altera funcionalidades existentes
-- ❌ Não expõe CPF ou dados bancários sensíveis
--
-- ============================================================

BEGIN;

-- ============================================================
-- PARTE 1: CAMPOS DE LOCALIZAÇÃO E ESCOPO
-- ============================================================

-- Adicionar campos de localização e escopo
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) CHECK (scope IN ('national', 'state', 'city', 'neighborhood')) DEFAULT 'national',
  ADD COLUMN IF NOT EXISTS country_id UUID,
  ADD COLUMN IF NOT EXISTS state_id UUID,
  ADD COLUMN IF NOT EXISTS city_id UUID,
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS rules_text TEXT;

-- Índices para busca por localização
CREATE INDEX IF NOT EXISTS idx_groups_country ON groups(tenant_id, country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_state ON groups(tenant_id, state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_city ON groups(tenant_id, city_id) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_scope ON groups(tenant_id, scope);

-- ============================================================
-- PARTE 2: ATUALIZAR PAPÉIS DE MEMBROS
-- ============================================================

-- Atualizar enum de papéis para incluir 'collaborator' e 'admin'
DO $$
BEGIN
  -- Se o enum não tem 'admin' e 'collaborator', precisamos recriar
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'admin' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'group_member_role')
  ) THEN
    -- Adicionar novos valores ao enum
    ALTER TYPE group_member_role ADD VALUE IF NOT EXISTS 'admin';
    ALTER TYPE group_member_role ADD VALUE IF NOT EXISTS 'collaborator';
  END IF;
END $$;

-- ============================================================
-- PARTE 3: CANAL DE CONTATO
-- ============================================================

CREATE TABLE IF NOT EXISTS group_contact_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL, -- global_user_id
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_contact_messages_group ON group_contact_messages(group_id, status);
CREATE INDEX IF NOT EXISTS idx_group_contact_messages_sender ON group_contact_messages(sender_user_id);

ALTER TABLE group_contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_contact_messages_rls ON group_contact_messages
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 4: POSTS DE GRUPO (específicos para grupos)
-- ============================================================

CREATE TABLE IF NOT EXISTS group_posts (
  post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  author_id UUID NOT NULL, -- global_user_id
  content TEXT NOT NULL,
  media JSONB DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_posts_group ON group_posts(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_posts_author ON group_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_pinned ON group_posts(group_id, is_pinned) WHERE is_pinned = true;

ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_posts_rls ON group_posts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 5: COMENTÁRIOS GENÉRICOS (para posts, eventos, campanhas, finanças)
-- ============================================================

CREATE TABLE IF NOT EXISTS group_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'event', 'campaign', 'finance')),
  target_id UUID NOT NULL,
  user_id UUID NOT NULL, -- global_user_id
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_comments_target ON group_comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_group_comments_group ON group_comments(group_id);
CREATE INDEX IF NOT EXISTS idx_group_comments_user ON group_comments(user_id);

ALTER TABLE group_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_comments_rls ON group_comments
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 6: REAÇÕES GENÉRICAS
-- ============================================================

CREATE TABLE IF NOT EXISTS group_reactions (
  reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'event', 'campaign', 'finance')),
  target_id UUID NOT NULL,
  user_id UUID NOT NULL, -- global_user_id
  type VARCHAR(20) NOT NULL CHECK (type IN ('like', 'disagree')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (target_type, target_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_reactions_target ON group_reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_group_reactions_group ON group_reactions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_reactions_user ON group_reactions(user_id);

ALTER TABLE group_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_reactions_rls ON group_reactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 7: DENÚNCIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS group_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'event', 'campaign', 'comment')),
  target_id UUID NOT NULL,
  reporter_user_id UUID NOT NULL, -- global_user_id
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_reports_target ON group_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_group_reports_group ON group_reports(group_id);
CREATE INDEX IF NOT EXISTS idx_group_reports_status ON group_reports(status) WHERE status = 'open';

ALTER TABLE group_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_reports_rls ON group_reports
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 8: VOTAÇÕES (GOVERNANÇA COMUNITÁRIA)
-- ============================================================

CREATE TABLE IF NOT EXISTS group_polls (
  poll_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array de opções: ["Opção 1", "Opção 2", ...]
  created_by UUID NOT NULL, -- global_user_id
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_polls_group ON group_polls(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_polls_active ON group_polls(group_id, ends_at);

ALTER TABLE group_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_polls_rls ON group_polls
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TABLE IF NOT EXISTS group_poll_votes (
  poll_id UUID NOT NULL REFERENCES group_polls(poll_id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- global_user_id
  option_index INTEGER NOT NULL, -- Índice da opção escolhida no array options
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_poll_votes_poll ON group_poll_votes(poll_id);

ALTER TABLE group_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_poll_votes_rls ON group_poll_votes
  USING (
    EXISTS (
      SELECT 1 FROM group_polls gp
      WHERE gp.poll_id = group_poll_votes.poll_id
        AND gp.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

-- ============================================================
-- PARTE 9: AGENDA
-- ============================================================

CREATE TABLE IF NOT EXISTS group_schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  recurrence VARCHAR(20) CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'yearly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = domingo, 6 = sábado
  time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_schedules_group ON group_schedules(group_id);

ALTER TABLE group_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_schedules_rls ON group_schedules
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 10: EVENTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS group_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'secret')),
  created_by UUID NOT NULL, -- global_user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_events_group ON group_events(group_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_events_upcoming ON group_events(group_id, starts_at);

ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_events_rls ON group_events
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 11: TIMELINE / HISTÓRICO
-- ============================================================

CREATE TABLE IF NOT EXISTS group_timeline (
  timeline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('event', 'campaign', 'finance', 'milestone')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  media_url TEXT,
  related_id UUID, -- ID do evento, campanha, transação ou milestone relacionado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_timeline_group ON group_timeline(group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_group_timeline_type ON group_timeline(type, related_id) WHERE related_id IS NOT NULL;

ALTER TABLE group_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_timeline_rls ON group_timeline
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 12: CAMPANHAS
-- ============================================================

CREATE TABLE IF NOT EXISTS group_campaigns (
  campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('donation', 'action', 'fundraising', 'awareness')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  goal_value NUMERIC(15, 2), -- Meta em reais (se aplicável)
  current_value NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Valor atual arrecadado/atingido
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_by UUID NOT NULL, -- global_user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_campaigns_group ON group_campaigns(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_campaigns_active ON group_campaigns(group_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_group_campaigns_type ON group_campaigns(type);

ALTER TABLE group_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_campaigns_rls ON group_campaigns
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 13: TRANSPARÊNCIA FINANCEIRA
-- ============================================================

CREATE TABLE IF NOT EXISTS group_balance (
  group_id UUID PRIMARY KEY REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_balance_tenant ON group_balance(tenant_id);

ALTER TABLE group_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_balance_rls ON group_balance
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TABLE IF NOT EXISTS group_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(100) NOT NULL, -- Ex: 'donation', 'event_revenue', 'expense_rent', etc
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  created_by UUID NOT NULL, -- global_user_id (owner/admin/collaborator financeiro)
  related_campaign_id UUID REFERENCES group_campaigns(campaign_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_transactions_group ON group_transactions(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_transactions_type ON group_transactions(type);
CREATE INDEX IF NOT EXISTS idx_group_transactions_campaign ON group_transactions(related_campaign_id) WHERE related_campaign_id IS NOT NULL;

ALTER TABLE group_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_transactions_rls ON group_transactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- PARTE 14: TRIGGERS E FUNÇÕES
-- ============================================================

-- Função para atualizar saldo do grupo quando há transação
CREATE OR REPLACE FUNCTION update_group_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO group_balance (group_id, tenant_id, current_balance, updated_at)
    VALUES (
      NEW.group_id,
      NEW.tenant_id,
      CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END,
      now()
    )
    ON CONFLICT (group_id) DO UPDATE SET
      current_balance = group_balance.current_balance + 
        CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_group_balance
  AFTER INSERT ON group_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_group_balance();

-- Função para criar entrada na timeline quando há evento importante
CREATE OR REPLACE FUNCTION add_to_group_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'group_events' THEN
    INSERT INTO group_timeline (group_id, tenant_id, type, title, description, date, related_id)
    VALUES (NEW.group_id, NEW.tenant_id, 'event', NEW.title, NEW.description, NEW.starts_at, NEW.event_id);
  ELSIF TG_TABLE_NAME = 'group_campaigns' THEN
    INSERT INTO group_timeline (group_id, tenant_id, type, title, description, date, related_id)
    VALUES (NEW.group_id, NEW.tenant_id, 'campaign', NEW.title, NEW.description, NEW.starts_at, NEW.campaign_id);
  ELSIF TG_TABLE_NAME = 'group_transactions' AND NEW.amount >= 1000 THEN
    -- Adicionar transações grandes à timeline
    INSERT INTO group_timeline (group_id, tenant_id, type, title, description, date, related_id)
    VALUES (
      NEW.group_id,
      NEW.tenant_id,
      'finance',
      CASE WHEN NEW.type = 'income' THEN 'Receita registrada' ELSE 'Despesa registrada' END,
      NEW.description || ' - R$ ' || NEW.amount,
      NEW.created_at,
      NEW.transaction_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_event_to_timeline
  AFTER INSERT ON group_events
  FOR EACH ROW
  EXECUTE FUNCTION add_to_group_timeline();

CREATE TRIGGER trg_add_campaign_to_timeline
  AFTER INSERT ON group_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION add_to_group_timeline();

CREATE TRIGGER trg_add_transaction_to_timeline
  AFTER INSERT ON group_transactions
  FOR EACH ROW
  EXECUTE FUNCTION add_to_group_timeline();

COMMIT;

-- ============================================================
-- FIM 114_groups_community_governance.sql
-- ============================================================







