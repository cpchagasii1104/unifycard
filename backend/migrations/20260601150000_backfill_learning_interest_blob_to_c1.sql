-- ============================================================
-- C1 — Backfill Learning/Interest: global_users.metadata → actor_learning/interest_concepts (Fatia 3, DECISION-0067)
-- ============================================================
-- Migra declarações existentes no blob legado `global_users.metadata.learnings` / `.interests` para o
-- substrato C1 actor-first. Idempotente (ON CONFLICT), transacional, FAIL-CLOSED (nunca pula dado real
-- silenciosamente). Estado DEV em 2026-06-01: 0 itens no blob → backfill é NO-OP esperado.
--
-- Identidade: actor_id resolvido pelo mapeamento canônico vivo `actors.global_user_id =
--   global_users.global_user_id AND actor_type='user'` (NÃO cria actor; NÃO usa global_user_id como
--   identidade final — só ponte de resolução). concept_id (semântica) via categoria. source_category_id =
--   breadcrumb. progress (learning): learningPreferences[categoryId].progress
--   (beginner|intermediate|advanced → 1|2|3; numérico 1..3 preservado; nulo/ausente → NULL).
--
-- NÃO toca: global_users.metadata (não apaga/altera) · endpoints legados · frontend · lifestyle ·
--   professional C1 · categories/concepts · bank_*/split/payout. Reversibilidade: linhas C1 desativáveis.
-- ============================================================

BEGIN;

-- GUARD 0: substrato C1 deve existir (Fatia 1).
DO $$
BEGIN
  IF to_regclass('public.actor_learning_concepts') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_learning_concepts ausente'; END IF;
  IF to_regclass('public.actor_interest_concepts') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_interest_concepts ausente'; END IF;
END $$;

-- GUARDS FAIL-CLOSED (antes de inserir; abortam se algum dado real não for migrável com segurança).
DO $$
DECLARE
  v_bad_array_l    INTEGER;
  v_bad_array_i    INTEGER;
  v_no_actor_l     INTEGER;
  v_no_actor_i     INTEGER;
  v_items_l        INTEGER;
  v_ok_cat_l       INTEGER;
  v_items_i        INTEGER;
  v_ok_cat_i       INTEGER;
  v_bad_progress   INTEGER;
BEGIN
  -- (a) learnings/interests presentes mas NÃO-array (legado corrompido) = não migrável → abort.
  SELECT count(*) INTO v_bad_array_l FROM global_users g
   WHERE g.metadata ? 'learnings' AND jsonb_typeof(g.metadata->'learnings') <> 'array';
  IF v_bad_array_l <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % global_users com metadata.learnings nao-array', v_bad_array_l; END IF;
  SELECT count(*) INTO v_bad_array_i FROM global_users g
   WHERE g.metadata ? 'interests' AND jsonb_typeof(g.metadata->'interests') <> 'array';
  IF v_bad_array_i <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % global_users com metadata.interests nao-array', v_bad_array_i; END IF;

  -- (b) global_user com itens mas SEM actor user resolvível → abort (não perder dado real).
  SELECT count(*) INTO v_no_actor_l FROM global_users g
   WHERE jsonb_array_length(COALESCE(g.metadata->'learnings','[]'::jsonb)) > 0
     AND NOT EXISTS (SELECT 1 FROM actors a WHERE a.global_user_id = g.global_user_id AND a.actor_type='user');
  IF v_no_actor_l <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % global_users com learnings sem actor user resolvivel', v_no_actor_l; END IF;
  SELECT count(*) INTO v_no_actor_i FROM global_users g
   WHERE jsonb_array_length(COALESCE(g.metadata->'interests','[]'::jsonb)) > 0
     AND NOT EXISTS (SELECT 1 FROM actors a WHERE a.global_user_id = g.global_user_id AND a.actor_type='user');
  IF v_no_actor_i <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % global_users com interests sem actor user resolvivel', v_no_actor_i; END IF;

  -- (c) todo item learning deve resolver categoria scope='learning' com concept_id; idem interest.
  SELECT count(*) INTO v_items_l
    FROM global_users g
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(g.metadata->'learnings','[]'::jsonb)) AS e(cat_id)
   WHERE jsonb_typeof(COALESCE(g.metadata->'learnings','[]'::jsonb)) = 'array';
  SELECT count(*) INTO v_ok_cat_l
    FROM global_users g
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(g.metadata->'learnings','[]'::jsonb)) AS e(cat_id)
    JOIN categories c ON c.category_id = e.cat_id::uuid AND c.scope='learning' AND c.concept_id IS NOT NULL
   WHERE jsonb_typeof(COALESCE(g.metadata->'learnings','[]'::jsonb)) = 'array';
  IF v_items_l <> v_ok_cat_l THEN RAISE EXCEPTION 'MIGRATION_ABORT: learning itens=% resolviveis=% (categoria invalida/fora de scope/sem concept)', v_items_l, v_ok_cat_l; END IF;

  SELECT count(*) INTO v_items_i
    FROM global_users g
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(g.metadata->'interests','[]'::jsonb)) AS e(cat_id)
   WHERE jsonb_typeof(COALESCE(g.metadata->'interests','[]'::jsonb)) = 'array';
  SELECT count(*) INTO v_ok_cat_i
    FROM global_users g
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(g.metadata->'interests','[]'::jsonb)) AS e(cat_id)
    JOIN categories c ON c.category_id = e.cat_id::uuid AND c.scope='interest' AND c.concept_id IS NOT NULL
   WHERE jsonb_typeof(COALESCE(g.metadata->'interests','[]'::jsonb)) = 'array';
  IF v_items_i <> v_ok_cat_i THEN RAISE EXCEPTION 'MIGRATION_ABORT: interest itens=% resolviveis=% (categoria invalida/fora de scope/sem concept)', v_items_i, v_ok_cat_i; END IF;

  -- (d) progress (learning) com valor inesperado real → abort (não inventar mapeamento).
  SELECT count(*) INTO v_bad_progress
    FROM global_users g
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(g.metadata->'learnings','[]'::jsonb)) AS e(cat_id)
   WHERE jsonb_typeof(COALESCE(g.metadata->'learnings','[]'::jsonb)) = 'array'
     AND (g.metadata->'learningPreferences'->(e.cat_id)->>'progress') IS NOT NULL
     AND (g.metadata->'learningPreferences'->(e.cat_id)->>'progress') NOT IN
         ('beginner','intermediate','advanced','1','2','3');
  IF v_bad_progress <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % learning itens com progress inesperado (esperado beginner|intermediate|advanced|1|2|3)', v_bad_progress; END IF;
END $$;

-- BACKFILL LEARNING (idempotente; hoje insere 0).
INSERT INTO actor_learning_concepts
  (tenant_id, actor_id, concept_id, source_category_id, progress, is_active)
SELECT
  a.tenant_id,
  a.actor_id,
  c.concept_id,
  c.category_id AS source_category_id,
  CASE
    WHEN (g.metadata->'learningPreferences'->(e.cat_id)->>'progress') IN ('beginner','1')     THEN 1
    WHEN (g.metadata->'learningPreferences'->(e.cat_id)->>'progress') IN ('intermediate','2') THEN 2
    WHEN (g.metadata->'learningPreferences'->(e.cat_id)->>'progress') IN ('advanced','3')     THEN 3
    ELSE NULL
  END::smallint AS progress,
  true
FROM global_users g
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(g.metadata->'learnings','[]'::jsonb)) AS e(cat_id)
JOIN actors a ON a.global_user_id = g.global_user_id AND a.actor_type = 'user'
JOIN categories c ON c.category_id = e.cat_id::uuid AND c.scope = 'learning' AND c.concept_id IS NOT NULL
WHERE jsonb_typeof(COALESCE(g.metadata->'learnings','[]'::jsonb)) = 'array'
ON CONFLICT (tenant_id, actor_id, concept_id) DO NOTHING;

-- BACKFILL INTEREST (idempotente; hoje insere 0).
INSERT INTO actor_interest_concepts
  (tenant_id, actor_id, concept_id, source_category_id, is_active)
SELECT
  a.tenant_id,
  a.actor_id,
  c.concept_id,
  c.category_id AS source_category_id,
  true
FROM global_users g
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(g.metadata->'interests','[]'::jsonb)) AS e(cat_id)
JOIN actors a ON a.global_user_id = g.global_user_id AND a.actor_type = 'user'
JOIN categories c ON c.category_id = e.cat_id::uuid AND c.scope = 'interest' AND c.concept_id IS NOT NULL
WHERE jsonb_typeof(COALESCE(g.metadata->'interests','[]'::jsonb)) = 'array'
ON CONFLICT (tenant_id, actor_id, concept_id) DO NOTHING;

COMMIT;
