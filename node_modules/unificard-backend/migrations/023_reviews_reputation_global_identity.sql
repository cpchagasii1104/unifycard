/*
Arquivo: 023_add_global_user_to_reviews_reputation.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Integração do Global User ID com Reviews e Reputation

Objetivo:
- Permitir associar reviews e scores de reputação a uma identidade global
- Manter compatibilidade com user_id local
- Preparar base para reputação cross-tenant

Dependências:
- reviews (006_reviews_and_reputation.sql)
- reputation_scores (006_reviews_and_reputation.sql)
- global_users (022_global_identity.sql)

Observações:
- Colunas opcionais (SET NULL)
- Não altera lógica existente
- Apenas extensão do modelo
*/

-- =========================================================
-- REVIEWS: GLOBAL AUTHOR
-- =========================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS author_global_user_id UUID
  REFERENCES global_users(global_user_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_author_global_user
  ON reviews (author_global_user_id)
  WHERE author_global_user_id IS NOT NULL;

-- =========================================================
-- REPUTATION SCORES: GLOBAL ENTITY
-- =========================================================

ALTER TABLE reputation_scores
  ADD COLUMN IF NOT EXISTS entity_global_user_id UUID
  REFERENCES global_users(global_user_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reputation_entity_global_user
  ON reputation_scores (entity_global_user_id)
  WHERE entity_global_user_id IS NOT NULL;

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON COLUMN reviews.author_global_user_id IS
  'Identidade global do autor da review (opcional, compatível com author_user_id)';

COMMENT ON COLUMN reputation_scores.entity_global_user_id IS
  'Identidade global da entidade quando entity_type se refere a usuário';











