-- ================================================
-- UNIFICARD - MIGRATION 023
-- Adiciona suporte a global_user_id em reviews e reputation
-- ================================================

-- ===========================
-- REVIEWS - Adicionar global_user_id
-- ===========================
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS author_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_author_global_user ON reviews (author_global_user_id) WHERE author_global_user_id IS NOT NULL;

-- ===========================
-- REPUTATION_SCORES - Adicionar global_user_id
-- ===========================
ALTER TABLE reputation_scores
ADD COLUMN IF NOT EXISTS entity_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reputation_entity_global_user ON reputation_scores (entity_global_user_id) WHERE entity_global_user_id IS NOT NULL;

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON COLUMN reviews.author_global_user_id IS 'Identidade global do autor da review (opcional, mantém compatibilidade com author_user_id)';
COMMENT ON COLUMN reputation_scores.entity_global_user_id IS 'Identidade global da entidade quando entity_type é relacionado a usuário (opcional)';








