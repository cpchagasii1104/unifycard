-- ============================================================
-- 20260707030000: DECISION-0162 — refinamento de plateia de POSTS por tipo de relação
-- ============================================================
-- Ratificada por Clayton 2026-07-07 ("se eu escolher familiar, o post deve aparecer
-- somente para os familiares — definir um padrão e já deixar isto definido").
-- ESPELHO da DECISION-0161 (events, 20260706170000): o macro posts.visibility
-- (public|connections|only_me — CHECK 20260705120000) fica INTOCADO; o refinamento é
-- coluna OPCIONAL, subset do vocabulário GOVERNADO do typed-edge (SSOT actor_relationships).
-- Enforcement na LEITURA (postVisibilitySql): a ÓTICA DO AUTOR decide quem são os
-- "familiares" dele (requester_label se o autor enviou; target_label se aceitou).
-- ============================================================

BEGIN;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS audience_relationship_types TEXT[] DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_posts_audience_relationship_types'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT chk_posts_audience_relationship_types
      CHECK (
        audience_relationship_types IS NULL
        OR audience_relationship_types <@ ARRAY['amigo','conhecido','familiar','cliente','colaborador','fornecedor','parceiro']::text[]
      );
  END IF;
END $$;

COMMIT;
