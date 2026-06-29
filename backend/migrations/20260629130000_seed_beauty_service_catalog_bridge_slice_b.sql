-- ============================================================
-- 20260629130000: SEED TRIPLO DE BELEZA — SLICE-B (coloração + progressiva/alisamento)
-- Frente: F-SERVICE-CATALOG-SEED-BEAUTY-SLICE-B
-- Martelo soberano (Clayton, 2026-06-29): decisão de grão batida em
--   DT-SERVICE-CATALOG-COLORACAO-PROGRESSIVA-GRAIN-DECISION → DECIDED.
--   Base: docs HEAD d9d34affa · material HEAD a6147ec66.
-- ============================================================
-- DOUTRINA (idêntica à Slice-A 20260629120000): tornar um serviço publicável E
-- declarável exige TRÊS linhas coordenadas por grão, compartilhando UM concept_id:
--   (1) concepts (domain='servicos')        → coluna semântica (SSOT, Lei 7), 1x;
--   (2) canonical_services (scope='global',  → FACE PUBLICÁVEL (catálogo governado);
--       status='active', concept_id FK)        sem ela o ServiceCreate não acha;
--   (3) categories (scope='professional',    → FACE DECLARÁVEL (folha N2 sob N1 beleza);
--       level=2, parent='beleza-estetica',     sem ela o gate DECISION-0144 nunca
--       concept_id FK)                          deixa a PF declarar a capacidade.
--
-- CERCA ELÉTRICA (ratificada por Clayton): o eixo `ramo`/descoberta
--   (categories taxonomy='branch', ex. 'servicos-cabeleireiro') AJUDA descoberta /
--   agrupamento / navegação, mas NÃO é SSOT semântico. Quem define significado é o
--   CONCEPT. Categoria organiza para ACHAR; não batiza a realidade. Por isso NÃO se
--   cria umbrella semântico — o agrupamento de busca já existe no ramo.
--
-- 9 GRÃOS APROVADOS (família decomposta, sem umbrella):
--   Coloração:  coloracao-total · retoque-de-raiz · mechas · luzes-capilares · tonalizante
--   Progressiva/alisamento: progressiva · alisamento-capilar · selagem · botox-capilar
--   Refinamento de slug travado pelo soberano (anti-bomba-semântica): slug global
--   precisa sobreviver ao futuro → 'luzes-capilares' (não 'luzes') e 'alisamento-capilar'
--   (não 'alisamento'); 'progressiva' entra como GRÃO ESPECÍFICO, nunca como família.
--
-- PROIBIDO criar umbrella (veto soberano — pós-asserção fail-closed verifica):
--   coloracao · tratamento-capilar · corte-de-cabelo · beleza · alisamento
--
-- O QUE NÃO FAZ: não toca corte-de-cabelo-masculino nem os 6 grãos da Slice-A
--   (guard-pré prova preservação). NÃO cria alias / telemetria / curadoria.
--   NÃO altera DECISION-0144. NÃO toca frontend / runtime backend / oferta / preço /
--   estoque / checkout / order / payment-plan / payout / PORTA-1 / rides /
--   bank_ledger / bank_transactions. base_duration_minutes fica NULL (duração real
--   mora na oferta; o canonical carrega só identidade).
--
-- NORMA: Lei 2 (forward-only) · Lei 3 (fail-closed) · Lei 7 (concept = identidade SSOT).
-- GOVERNANÇA: trigger 0075 exige set_config('app.concept_governance','true') na MESMA txn.
-- IDEMPOTENTE: concepts ON CONFLICT (domain,slug) DO NOTHING; canonical via WHERE NOT
--   EXISTS; folha N2 via guarda (concept_id, scope='professional', level=2). Re-run = no-op.
-- ============================================================

BEGIN;

-- ── GUARD-PRÉ (fail-closed): masculino + os 6 grãos da Slice-A NÃO podem ter sumido.
DO $$
DECLARE
  v_masc_concept uuid;
  v_slice_a_count integer;
BEGIN
  SELECT concept_id INTO v_masc_concept
    FROM public.concepts WHERE domain = 'servicos' AND slug = 'corte-de-cabelo-masculino' LIMIT 1;
  IF v_masc_concept IS NULL THEN
    RAISE EXCEPTION 'SEED STOP: pré-req corte-de-cabelo-masculino (concept) ausente — estado inesperado.';
  END IF;
  PERFORM 1 FROM public.canonical_services
    WHERE scope = 'global' AND slug = 'corte-de-cabelo-masculino' AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEED STOP: canonical_service GLOBAL ativo de corte-de-cabelo-masculino ausente.';
  END IF;

  -- Os 6 canonical_services da Slice-A têm de estar intactos (preservação provada).
  SELECT count(*) INTO v_slice_a_count
    FROM public.canonical_services
    WHERE scope = 'global' AND status = 'active'
      AND slug IN ('corte-de-cabelo-feminino','barba','manicure','pedicure',
                   'design-de-sobrancelhas','escova');
  IF v_slice_a_count <> 6 THEN
    RAISE EXCEPTION 'SEED STOP: Slice-A esperava 6 canonical_services globais ativos, achou % — estado inesperado.', v_slice_a_count;
  END IF;
END $$;

-- ── (1) CONCEPTS (caminho governado — trigger 0075).
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO public.concepts (slug, domain) VALUES
  ('coloracao-total',     'servicos'),
  ('retoque-de-raiz',     'servicos'),
  ('mechas',              'servicos'),
  ('luzes-capilares',     'servicos'),
  ('tonalizante',         'servicos'),
  ('progressiva',         'servicos'),
  ('alisamento-capilar',  'servicos'),
  ('selagem',             'servicos'),
  ('botox-capilar',       'servicos')
ON CONFLICT (domain, slug) DO NOTHING;

-- ── (2) canonical_service GLOBAL/active  +  (3) folha N2 professional, por grão, mesmo concept_id.
DO $$
DECLARE
  v_parent_id    uuid;
  v_parent_path  text[];
  v_parent_level integer;
  v_concept      uuid;
  v_forbidden    text;
  grain          record;
BEGIN
  -- N1 profissional 'beleza-estetica' (0099) como parent válido.
  SELECT category_id, path, level
    INTO v_parent_id, v_parent_path, v_parent_level
    FROM public.categories
    WHERE slug = 'beleza-estetica' AND scope = 'professional' AND level = 1
    LIMIT 1;
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'SEED STOP: N1 professional beleza-estetica ausente (pré-req 0099).';
  END IF;
  IF v_parent_level <> 1 OR COALESCE(array_length(v_parent_path, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'SEED STOP: parent beleza-estetica com path/level inválido (path=% level=%).',
      v_parent_path, v_parent_level;
  END IF;

  FOR grain IN
    SELECT * FROM (VALUES
      ('coloracao-total',     'Coloração total'),
      ('retoque-de-raiz',     'Retoque de raiz'),
      ('mechas',              'Mechas'),
      ('luzes-capilares',     'Luzes capilares'),
      ('tonalizante',         'Tonalizante'),
      ('progressiva',         'Progressiva'),
      ('alisamento-capilar',  'Alisamento capilar'),
      ('selagem',             'Selagem'),
      ('botox-capilar',       'Botox capilar')
    ) AS g(slug, name)
  LOOP
    -- concept (criado acima) tem de existir.
    SELECT concept_id INTO v_concept
      FROM public.concepts
      WHERE domain = 'servicos' AND slug = grain.slug
      LIMIT 1;
    IF v_concept IS NULL THEN
      RAISE EXCEPTION 'SEED STOP: concept servicos/% não materializou (governança?).', grain.slug;
    END IF;

    -- (2) FACE PUBLICÁVEL: canonical_service GLOBAL ativo (idempotente).
    INSERT INTO public.canonical_services (tenant_id, scope, concept_id, name, slug, status)
    SELECT NULL, 'global', v_concept, grain.name, grain.slug, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.canonical_services WHERE scope = 'global' AND slug = grain.slug
    );

    -- (3) FACE DECLARÁVEL: folha N2 professional sob beleza-estetica (idempotente).
    IF NOT EXISTS (
      SELECT 1 FROM public.categories
        WHERE concept_id = v_concept AND scope = 'professional' AND level = 2
    ) THEN
      INSERT INTO public.categories
        (name, slug, level, path, parent_id, scope, concept_id, status, is_active, metadata)
      VALUES
        (grain.name,
         grain.slug,
         2,
         v_parent_path || ARRAY['beleza-estetica']::text[],
         v_parent_id,
         'professional',
         v_concept,
         'active',
         true,
         jsonb_build_object('seed', 'F-SERVICE-CATALOG-SEED-BEAUTY-SLICE-B'));
    END IF;

    -- pós-asserção fail-closed: as DUAS faces materializaram para este concept.
    PERFORM 1 FROM public.canonical_services
      WHERE scope = 'global' AND slug = grain.slug AND concept_id = v_concept AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEED STOP: canonical_service global % ausente/divergente (fail-closed).', grain.slug;
    END IF;
    PERFORM 1 FROM public.categories
      WHERE concept_id = v_concept AND scope = 'professional' AND level = 2;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEED STOP: folha N2 professional de % não materializou (fail-closed).', grain.slug;
    END IF;
  END LOOP;

  -- pós-asserção global: NENHUM umbrella vetado introduzido (veto soberano).
  FOREACH v_forbidden IN ARRAY ARRAY['coloracao','tratamento-capilar','corte-de-cabelo','beleza','alisamento']
  LOOP
    PERFORM 1 FROM public.canonical_services WHERE scope = 'global' AND slug = v_forbidden;
    IF FOUND THEN
      RAISE EXCEPTION 'SEED STOP: umbrella vetado "%" detectado como canonical_service — proibido nesta frente.', v_forbidden;
    END IF;
  END LOOP;
END $$;

COMMIT;
