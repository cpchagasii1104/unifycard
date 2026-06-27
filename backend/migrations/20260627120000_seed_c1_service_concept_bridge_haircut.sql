-- ============================================================
-- 20260627120000: PONTE C1↔SERVIÇO — folha N2 profissional para um concept JÁ serviciável
-- Frente: F-MVP-C1-SERVICE-CONCEPT-SEED-BRIDGE
-- ============================================================
-- PROBLEMA (DATA_GAP confirmado empiricamente no READ-FIRST, DB unificard_dev):
--   - `corte-de-cabelo-masculino` (domain=servicos) possui canonical_service GLOBAL
--     ativo (20260611150000) → é o ÚNICO concept criável como serviço hoje.
--   - PORÉM não havia folha N2 profissional (scope='professional', level=2) com esse
--     concept_id → a aba Profissional não conseguia declará-lo no C1 (o autocomplete só
--     surfacia concept_id de folhas N2 professional) → o gate
--     SERVICE_ELIGIBILITY_DECLARATION_REQUIRED (DECISION-0144) bloqueava corretamente.
--   - Resultado: "declarável" (medicina, 0094) e "serviciável" (corte) eram DISJUNTOS.
--
-- O QUE ESTA MIGRATION FAZ (e o que NÃO faz):
--   - Cria UMA folha N2 professional sob a família N1 'beleza-estetica' (0099),
--     vinculada ao concept EXISTENTE 'corte-de-cabelo-masculino'.
--   - NÃO cria concept novo. NÃO cria canonical_service. NÃO cria serviço.
--     NÃO toca actor_professional_concepts. NÃO altera a regra de elegibilidade
--     (DECISION-0144 permanece intacta — apenas passa a EXISTIR um concept que satisfaz
--     ambos os lados do gate quando o actor o declarar). NÃO toca dinheiro.
--
-- POR QUE INSERT DIRETO (e não core_invariant.create_category_from_concept):
--   - O pipeline governado (0097/0110) é o caminho PRETENDIDO, mas está QUEBRADO contra o
--     schema vivo: a função faz INSERT na coluna `created_by_ai`, que NÃO existe em
--     public.categories (a coluna viva é `is_created_by_ai`). A função nunca rodou com
--     sucesso neste DB. Corrigi-la está FORA do escopo desta frente (mexer na máquina de
--     governança de categorias). Registro como DT-CREATE-CATEGORY-FROM-CONCEPT-COLUMN-DRIFT.
--   - Este INSERT segue o PADRÃO das migrations profissionais existentes (0094/0099) e é
--     validado pelos MESMOS invariantes de tabela que protegem o caminho governado:
--       · chk_n2_requires_concept  (level=2 exige concept_id NOT NULL)
--       · ux_category_concept_scope (UNIQUE (concept_id, scope) WHERE level=2 — 1 folha/concept)
--       · categories_slug_key       (UNIQUE(slug) global — slug livre, verificado)
--       · categories_scope_check / categories_level_check / FKs concept_id+parent_id
--     Não há trigger de governança em categories (verificado): o INSERT direto é legítimo.
--
-- NORMA: Lei 2 (forward-only) · Lei 3 (falha explícita / fail-closed) ·
--        Lei 7 (concept = identidade; categoria = navegação que aponta para o concept).
-- IDEMPOTENTE: pré-checa (concept_id, scope, level=2) e pula se já existe.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_concept      uuid;
  v_canon        uuid;
  v_parent_id    uuid;
  v_parent_path  text[];
  v_parent_level integer;
  v_existing     uuid;
  v_new          uuid;
BEGIN
  -- 1. concept serviciável tem de existir (fail-closed)
  SELECT concept_id INTO v_concept
    FROM public.concepts
    WHERE domain = 'servicos' AND slug = 'corte-de-cabelo-masculino'
    LIMIT 1;
  IF v_concept IS NULL THEN
    RAISE EXCEPTION 'BRIDGE STOP: concept servicos/corte-de-cabelo-masculino ausente (pré-req 20260611150000).';
  END IF;

  -- 2. INVARIANTE DA PONTE: o concept tem de ser realmente SERVICIÁVEL (canonical_service GLOBAL).
  --    A ponte só liga ao C1 um concept que JÁ pode virar serviço — nunca destrava texto solto.
  SELECT id INTO v_canon
    FROM public.canonical_services
    WHERE concept_id = v_concept AND scope = 'global' AND slug = 'corte-de-cabelo-masculino'
    LIMIT 1;
  IF v_canon IS NULL THEN
    RAISE EXCEPTION 'BRIDGE STOP: canonical_service GLOBAL de corte-de-cabelo-masculino ausente — a ponte só liga concept já serviciável.';
  END IF;

  -- 3. família N1 profissional 'beleza-estetica' (0099) tem de existir como parent válido
  SELECT category_id, path, level
    INTO v_parent_id, v_parent_path, v_parent_level
    FROM public.categories
    WHERE slug = 'beleza-estetica' AND scope = 'professional' AND level = 1
    LIMIT 1;
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'BRIDGE STOP: N1 professional beleza-estetica ausente (pré-req 0099).';
  END IF;
  IF v_parent_level <> 1 OR COALESCE(array_length(v_parent_path, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'BRIDGE STOP: parent beleza-estetica com path/level inválido (path=% level=%).',
      v_parent_path, v_parent_level;
  END IF;

  -- 4. idempotência: já existe a folha N2 para este concept/scope?
  SELECT category_id INTO v_existing
    FROM public.categories
    WHERE concept_id = v_concept AND scope = 'professional' AND level = 2
    LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'BRIDGE SKIP (idempotente): folha N2 já existe category_id=%', v_existing;
  ELSE
    INSERT INTO public.categories
      (name, slug, level, path, parent_id, scope, concept_id, status, is_active, metadata)
    VALUES
      ('Corte de cabelo masculino',
       'corte-de-cabelo-masculino',
       2,
       v_parent_path || ARRAY['beleza-estetica']::text[],
       v_parent_id,
       'professional',
       v_concept,
       'active',
       true,
       jsonb_build_object('seed', 'F-MVP-C1-SERVICE-CONCEPT-SEED-BRIDGE'))
    RETURNING category_id INTO v_new;
    RAISE NOTICE 'BRIDGE OK: folha N2 professional criada category_id=% concept=%', v_new, v_concept;
  END IF;

  -- 5. pós-asserção idempotente fail-closed: a folha N2 materializou e aponta para o concept serviciável
  PERFORM 1
    FROM public.categories
    WHERE concept_id = v_concept AND scope = 'professional' AND level = 2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BRIDGE STOP: folha N2 professional de corte-de-cabelo-masculino não materializou (fail-closed).';
  END IF;
END $$;

COMMIT;
