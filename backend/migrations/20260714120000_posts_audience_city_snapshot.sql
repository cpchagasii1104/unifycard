-- 20260714120000_posts_audience_city_snapshot.sql
-- F-CURITIBA-OPERACIONAL · S-CITY-1 — SNAPSHOT TERRITORIAL DE AUDIÊNCIA DA PUBLICAÇÃO (DECISION-0176).
--
-- Adiciona SOMENTE a coluna de snapshot da PLATEIA TERRITORIAL da publicação:
--   posts.audience_city_id UUID NULL  →  FK real cities(city_id)
--
-- Semântica (DECISION-0176 D3/D4/D5): NULL = publicação SEM restrição territorial (comportamento atual);
-- não-NULL = audiência limitada aos RESIDENTES ATUAIS daquela cidade (enforcement na leitura pela casa
-- canônica de audiência). É a plateia da publicação — NÃO é cópia da residência do autor, NÃO é SSOT
-- residencial (a residência vive em address_assignments; a cidade no Location Core).
--
-- O QUE ELA NÃO FAZ: sem DEFAULT · sem backfill (posts existentes ficam NULL) · sem tabela auxiliar ·
-- sem enum DB novo · sem audience_neighborhood_id (bairro segue bloqueado por N5) · sem trigger territorial ·
-- sem escrita em Address · sem qualquer efeito financeiro. Forward-only; transação única.
--
-- Guard: audit-social-territory-city-audience.mjs.

BEGIN;

-- ── FAIL-CLOSED (PRÉ) ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.posts') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: posts ausente.'; END IF;
  IF to_regclass('public.cities') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: cities ausente.'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='audience_city_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: posts.audience_city_id já existe.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='audience_neighborhood_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: audience_neighborhood_id presente — bairro está bloqueado por N5.';
  END IF;
END $$;

-- ── COLUNA DE SNAPSHOT (FK real; sem default) ──────────────────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN audience_city_id UUID NULL
    CONSTRAINT fk_posts_audience_city REFERENCES cities (city_id) ON DELETE RESTRICT;

COMMENT ON COLUMN posts.audience_city_id IS
  'DECISION-0176 (S-CITY-1): snapshot da PLATEIA TERRITORIAL da publicação (dimensão ORTOGONAL a '
  'visibility). NULL = sem restrição territorial; não-NULL = residentes atuais daquela city_id (enforcement '
  'na leitura pela casa canônica de audiência). Gravado no publish via resolveActorTerritory(ACTOR_RESIDENCE) '
  '— piloto Curitiba-only, fail-closed. NÃO é cópia de residência, NÃO é SSOT residencial. Bairro bloqueado (N5).';

-- Índice parcial: acelera o predicado territorial na leitura sem custo nos posts comuns (NULL).
CREATE INDEX idx_posts_audience_city ON posts (audience_city_id) WHERE audience_city_id IS NOT NULL;

-- ── FAIL-CLOSED (PÓS) ──────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  -- coluna nullable, sem default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='posts' AND column_name='audience_city_id'
      AND data_type='uuid' AND is_nullable='YES' AND column_default IS NULL
  ) THEN RAISE EXCEPTION 'MIGRATION_ABORT: audience_city_id shape divergente (esperado uuid NULL sem default).'; END IF;
  -- FK real para cities(city_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.posts'::regclass AND conname='fk_posts_audience_city' AND contype='f'
  ) THEN RAISE EXCEPTION 'MIGRATION_ABORT: FK fk_posts_audience_city ausente.'; END IF;
  -- índice presente
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='posts' AND indexname='idx_posts_audience_city') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: índice idx_posts_audience_city ausente.';
  END IF;
  -- sem backfill: todos os posts existentes ficam NULL
  SELECT count(*) INTO v_cnt FROM posts WHERE audience_city_id IS NOT NULL;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % post(s) com audiência territorial — não deveria haver backfill.', v_cnt; END IF;
  -- bairro não foi aberto
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='audience_neighborhood_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: audience_neighborhood_id apareceu — bairro bloqueado.';
  END IF;
END $$;

COMMIT;
