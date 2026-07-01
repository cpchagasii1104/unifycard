-- ============================================================
-- 20260701140000: NORMALIZAÇÃO DE PATH — vertical Limpeza (Slice A).
-- Frente: F-SERVICE-CLEANING-CATEGORY-PATH-NORMALIZATION-SLICE
-- Origem: warning YALA W-M1 de F-SERVICE-VERTICAL-SEED-CLEANING-SLICE
--   → DT-SERVICE-CLEANING-CATEGORY-PATH-DUPLICATED-PROFISSOES.
-- Carimbo soberano: Clayton (GO material B1 — só a placa torta; não redesenhar o prédio).
-- ============================================================
-- PROBLEMA: o campo denormalizado categories.path das 5 categorias da slice ficou com
--   "profissoes" duplicado (montei o path à mão em vez de herdar do pai). parent_id CORRETO.
--     ATUAL   bucket L1 limpeza-conservacao : ["profissoes","profissoes"]
--     ATUAL   4 grãos L2                    : ["profissoes","profissoes","limpeza-conservacao"]
--   CONVENÇÃO real (molde Beleza — beleza-estetica=["profissoes"], barba=["profissoes","beleza-estetica"]):
--     ALVO    bucket L1 limpeza-conservacao : ["profissoes"]
--     ALVO    4 grãos L2                    : ["profissoes","limpeza-conservacao"]
--
-- ESCOPO ESTRITO: atualiza SOMENTE categories.path das 5 categorias da slice.
--   NÃO altera concept_id / parent_id / scope / level / status / display / name.
--   NÃO toca aliases / labels / canonical_services / concepts.
--   NÃO toca limpeza-servicos nem qualquer bucket vazio/scaffold. NÃO mexe em browse.
--   NÃO toca frontend / backend runtime / endpoint / dinheiro. W-M2 permanece aberta (fatia própria).
--
-- NORMA: Lei 2 (forward-only) · Lei 3 (fail-closed). IDEMPOTENTE: UPDATE para valor-alvo
--   é convergente (rodar 2x = mesmo estado); resolve por slug, não por UUID hardcoded.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_root            uuid;
  v_bucket          uuid;
  v_bucket_parent   uuid;
  v_ls_path_before  text[];
  v_ls_concept      uuid;
  v_ls_children     integer;
  n_grain           integer;
  n_bad             integer;
  bad_path          text[];
BEGIN
  -- ── GUARD-PRÉ: raiz professional 'profissoes' (level 0) existe.
  SELECT category_id INTO v_root FROM public.categories
   WHERE slug = 'profissoes' AND scope = 'professional' AND level = 0 LIMIT 1;
  IF v_root IS NULL THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: raiz professional "profissoes" (level 0) ausente.';
  END IF;

  -- ── GUARD-PRÉ: bucket limpeza-conservacao existe EXATAMENTE 1 vez (professional L1).
  SELECT count(*) INTO n_grain FROM public.categories
   WHERE slug = 'limpeza-conservacao' AND scope = 'professional' AND level = 1;
  IF n_grain <> 1 THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: bucket limpeza-conservacao esperado 1x, achou %.', n_grain;
  END IF;
  SELECT category_id, parent_id INTO v_bucket, v_bucket_parent FROM public.categories
   WHERE slug = 'limpeza-conservacao' AND scope = 'professional' AND level = 1 LIMIT 1;

  -- ── GUARD-PRÉ: os 4 grãos existem EXATAMENTE 4x (professional L2, concept-bound, sob o bucket).
  SELECT count(*) INTO n_grain FROM public.categories
   WHERE parent_id = v_bucket AND scope = 'professional' AND level = 2 AND concept_id IS NOT NULL;
  IF n_grain <> 4 THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: esperado 4 grãos L2 concept-bound sob o bucket, achou %.', n_grain;
  END IF;

  -- ── SNAPSHOT do vizinho intocável limpeza-servicos (para provar não-alteração no pós).
  SELECT path, concept_id INTO v_ls_path_before, v_ls_concept FROM public.categories
   WHERE slug = 'limpeza-servicos' AND scope = 'professional' AND level = 1 LIMIT 1;
  SELECT count(*) INTO v_ls_children FROM public.categories p
    JOIN public.categories c ON c.parent_id = p.category_id
   WHERE p.slug = 'limpeza-servicos' AND p.scope = 'professional';

  -- ══ UPDATE 1: bucket L1 → ["profissoes"] (path do pai as-is; parent_id intocado).
  UPDATE public.categories
     SET path = ARRAY['profissoes']::text[]
   WHERE category_id = v_bucket;

  -- ══ UPDATE 2: 4 grãos L2 sob o bucket → ["profissoes","limpeza-conservacao"] (parent_id intocado).
  UPDATE public.categories
     SET path = ARRAY['profissoes','limpeza-conservacao']::text[]
   WHERE parent_id = v_bucket AND scope = 'professional' AND level = 2;

  -- ── PÓS 1: bucket com path EXATO e sem concept, parent inalterado.
  PERFORM 1 FROM public.categories
   WHERE category_id = v_bucket
     AND path = ARRAY['profissoes']::text[]
     AND concept_id IS NULL
     AND parent_id = v_bucket_parent;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: bucket limpeza-conservacao não ficou com path=["profissoes"]/concept NULL/parent inalterado.';
  END IF;
  -- parent do bucket segue sendo a raiz profissoes.
  PERFORM 1 FROM public.categories WHERE category_id = v_bucket_parent AND slug = 'profissoes';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: parent do bucket deixou de ser "profissoes".';
  END IF;

  -- ── PÓS 2: os 4 grãos com path EXATO, ainda concept-bound, parent = bucket.
  SELECT count(*) INTO n_grain FROM public.categories
   WHERE parent_id = v_bucket AND scope = 'professional' AND level = 2
     AND concept_id IS NOT NULL
     AND path = ARRAY['profissoes','limpeza-conservacao']::text[];
  IF n_grain <> 4 THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: esperado 4 grãos com path=["profissoes","limpeza-conservacao"]/concept-bound/parent=bucket, achou %.', n_grain;
  END IF;

  -- ── PÓS 3: ZERO duplicação path[1]=path[2] nas 5 categorias da slice.
  SELECT count(*) INTO n_bad FROM public.categories
   WHERE (category_id = v_bucket OR parent_id = v_bucket)
     AND array_length(path,1) >= 2 AND path[1] = path[2];
  IF n_bad <> 0 THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: % categorias da slice ainda com path[1]=path[2].', n_bad;
  END IF;

  -- ── PÓS 4: vizinho limpeza-servicos NÃO foi tocado (path/concept/filhos idênticos ao snapshot).
  SELECT count(*) INTO n_bad FROM public.categories
   WHERE slug = 'limpeza-servicos' AND scope = 'professional' AND level = 1
     AND path IS NOT DISTINCT FROM v_ls_path_before
     AND concept_id IS NOT DISTINCT FROM v_ls_concept;
  IF n_bad <> 1 THEN
    RAISE EXCEPTION 'PATH NORMALIZE STOP: limpeza-servicos divergiu do snapshot (alteração proibida).';
  END IF;

  RAISE NOTICE 'PATH NORMALIZE OK: bucket=["profissoes"], 4 grãos=["profissoes","limpeza-conservacao"], limpeza-servicos intocado (filhos=%).', v_ls_children;
END $$;

COMMIT;
