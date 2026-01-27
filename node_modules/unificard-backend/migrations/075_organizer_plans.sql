-- ============================================================
-- UNIFICARD — MIGRATION 075
-- Arquivo: 075_event_organizer_plans.sql
-- Tipo: MONETIZAÇÃO / GOVERNANÇA (Events)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Organizadores de eventos podem operar sob diferentes
-- planos comerciais, que afetam limites, features e visibilidade.
--
-- Esta migration adiciona suporte estrutural a planos,
-- sem impor lógica de billing no banco de dados.
--
-- MODELO DE PLANOS
-- • free
-- • basic
-- • pro
-- • enterprise
--
-- GOVERNANÇA
-- • O banco NÃO bloqueia ações por plano
-- • O banco NÃO valida expiração automaticamente
-- • plan_expires_at é informativo
-- • Toda lógica de feature-gating ocorre na aplicação
--
-- IDEMPOTÊNCIA
-- • Colunas criadas com IF NOT EXISTS
-- • Constraints protegidas por guard
--
-- DEPENDÊNCIAS
-- • event_organizers
--
-- ============================================================


-- ============================================================
-- 1) COLUNAS DE PLANO
-- ============================================================

ALTER TABLE event_organizers
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';

ALTER TABLE event_organizers
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ NULL;


-- ============================================================
-- 2) CONSTRAINT DE DOMÍNIO (COM GUARD)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_organizers_plan_check'
  ) THEN
    ALTER TABLE event_organizers
      ADD CONSTRAINT event_organizers_plan_check
      CHECK (plan IN ('free', 'basic', 'pro', 'enterprise'));
  END IF;
END $$;


-- ============================================================
-- 3) ÍNDICES
-- ============================================================

-- Lookup simples por plano
CREATE INDEX IF NOT EXISTS idx_event_organizers_plan
  ON event_organizers(plan);

-- Queries de plano com expiração
CREATE INDEX IF NOT EXISTS idx_event_organizers_plan_expiry
  ON event_organizers(plan, plan_expires_at)
  WHERE plan_expires_at IS NOT NULL;


-- ============================================================
-- 4) COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN event_organizers.plan IS
  'Plano do organizador: free, basic, pro ou enterprise';

COMMENT ON COLUMN event_organizers.plan_expires_at IS
  'Data de expiração do plano. NULL indica plano sem vencimento. Enforcement ocorre na aplicação';


-- ============================================================
-- FIM 075_event_organizer_plans.sql
-- ============================================================




















