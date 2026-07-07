-- ============================================================
-- 20260707020000: Preferência de frequência no feed por conexão
-- ============================================================
-- Ideia Clayton 2026-07-07: além de classificar a conexão (amigo/família/...),
-- cada lado escolhe com que frequência quer ver os posts daquela conexão.
-- DUAL-ÓTICA na MESMA aresta (espelho exato de requester_label/target_label):
-- requester_feed_priority = ótica de quem enviou; target_feed_priority = de quem aceitou.
-- Vocabulário GOVERNADO (governed-vocabularies.manifest.ts):
--   padrao | ver_primeiro | ver_mais | ver_menos
-- Efeito material: motor de relevância do feed (social-2.0.service).
-- Δbank=0; relação ≠ autoridade (fronteiras da fatia 1 intactas).
-- ============================================================

BEGIN;

ALTER TABLE actor_relationships
  ADD COLUMN IF NOT EXISTS requester_feed_priority TEXT NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS target_feed_priority TEXT NOT NULL DEFAULT 'padrao';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_actor_relationships_requester_feed_priority'
  ) THEN
    ALTER TABLE actor_relationships
      ADD CONSTRAINT chk_actor_relationships_requester_feed_priority
      CHECK (requester_feed_priority IN ('padrao', 'ver_primeiro', 'ver_mais', 'ver_menos'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_actor_relationships_target_feed_priority'
  ) THEN
    ALTER TABLE actor_relationships
      ADD CONSTRAINT chk_actor_relationships_target_feed_priority
      CHECK (target_feed_priority IN ('padrao', 'ver_primeiro', 'ver_mais', 'ver_menos'));
  END IF;
END $$;

COMMIT;
