-- ================================================
-- UNIFICARD - MIGRATION 075
-- Organizer Plans (FASE 9A)
-- Sistema de planos para organizadores de eventos
-- ================================================

-- Adicionar coluna plan na tabela event_organizers
ALTER TABLE event_organizers 
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free' 
CHECK (plan IN ('free', 'basic', 'pro', 'enterprise'));

-- Adicionar coluna plan_expires_at para controle de assinatura
ALTER TABLE event_organizers 
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ NULL;

-- Criar índice para busca por plano
CREATE INDEX IF NOT EXISTS idx_organizers_plan ON event_organizers(plan);

-- Comentários
COMMENT ON COLUMN event_organizers.plan IS 'Plano do organizador: free, basic, pro ou enterprise';
COMMENT ON COLUMN event_organizers.plan_expires_at IS 'Data de expiração do plano (NULL = sem expiração)';













