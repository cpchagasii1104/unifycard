-- ============================================================
-- 20260701130000: SEED VERTICAL LIMPEZA (Slice A) — 1ª vertical nova depois de Beleza.
-- Frente: F-SERVICE-VERTICAL-SEED-CLEANING-SLICE
-- Carimbo soberano: Clayton (GO material) — replica o MOLDE provado da Beleza:
--   concept + canonical_service GLOBAL + categoria professional N2 + alias + concept_label.
-- ============================================================
-- 4 GRÃOS aprovados (labor puro, risco baixo, PF-first):
--   faxina-residencial · passadoria · limpeza-comercial · organizacao-residencial
-- BUCKET professional novo N1: limpeza-conservacao ("Limpeza e Conservação"), parent=profissoes, SEM concept.
-- ALIASES: diarista/faxineira/faxineiro → faxina-residencial (profissão = lente, nunca autoridade).
--
-- FRONTEIRAS (o que esta migration NÃO faz):
--   NÃO cria umbrella (limpeza / servicos-de-limpeza / servicos-domesticos / casa / trabalho-domestico).
--   NÃO reaproveita as categorias GLOBAL de marketplace ("Limpeza"/"Limpeza e facilities"/
--     "Limpeza residencial") — são buckets scope='global' SEM concept, não são grão professional.
--   NÃO inclui grãos de risco (pos-obra/vidros/hospitalar/dedetizacao/caixa-dagua/higienizacao).
--   NÃO cria PJ mapping (company_type_service_categories — HOLD). NÃO toca dinheiro/oferta/preço/
--     estoque/Bank/checkout. NÃO toca frontend/endpoint/backend runtime. base_duration_minutes NULL.
--
-- NORMA: Lei 2 (forward-only) · Lei 3 (fail-closed) · Lei 7 (concept=identidade SSOT; categoria=
--   navegação/declaração; alias=lente; label=apresentação; canonical=grão ofertável).
-- GOVERNANÇA: trigger 0075 exige set_config('app.concept_governance','true') na MESMA transação.
-- IDEMPOTENTE: concepts ON CONFLICT (domain,slug) DO NOTHING; canonical/categoria via NOT EXISTS;
--   alias ON CONFLICT (normalized_term,concept_id) DO NOTHING; label ON CONFLICT (...) DO UPDATE.
-- ============================================================

BEGIN;

-- ── GUARD-PRÉ (fail-closed): raiz professional 'profissoes' TEM de existir (parent do bucket).
DO $$
DECLARE v_root uuid;
BEGIN
  SELECT category_id INTO v_root FROM public.categories
   WHERE slug = 'profissoes' AND scope = 'professional' AND level = 0 LIMIT 1;
  IF v_root IS NULL THEN
    RAISE EXCEPTION 'CLEANING SEED STOP: raiz professional "profissoes" (level 0) ausente.';
  END IF;
END $$;

-- ── (1) CONCEPTS (caminho governado — trigger 0075). domain='servicos'.
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO public.concepts (slug, domain) VALUES
  ('faxina-residencial',      'servicos'),
  ('passadoria',              'servicos'),
  ('limpeza-comercial',       'servicos'),
  ('organizacao-residencial', 'servicos')
ON CONFLICT (domain, slug) DO NOTHING;

-- ── (2) BUCKET N1 professional + por grão: canonical_service GLOBAL/active + categoria N2 concept-bound.
DO $$
DECLARE
  v_root       uuid;
  v_root_path  text[];
  v_bucket     uuid;
  v_concept    uuid;
  grain        record;
BEGIN
  SELECT category_id, path INTO v_root, v_root_path FROM public.categories
   WHERE slug = 'profissoes' AND scope = 'professional' AND level = 0 LIMIT 1;

  -- BUCKET N1 'limpeza-conservacao' (sem concept), idempotente (guarda por slug+scope).
  IF NOT EXISTS (
    SELECT 1 FROM public.categories WHERE slug = 'limpeza-conservacao' AND scope = 'professional'
  ) THEN
    INSERT INTO public.categories
      (name, slug, level, path, parent_id, scope, concept_id, status, is_active, metadata)
    VALUES
      ('Limpeza e Conservação', 'limpeza-conservacao', 1,
       COALESCE(v_root_path, ARRAY[]::text[]) || ARRAY['profissoes']::text[],
       v_root, 'professional', NULL, 'active', true,
       jsonb_build_object('seed', 'F-SERVICE-VERTICAL-SEED-CLEANING-SLICE'));
  END IF;

  SELECT category_id INTO v_bucket FROM public.categories
   WHERE slug = 'limpeza-conservacao' AND scope = 'professional' AND level = 1 LIMIT 1;
  IF v_bucket IS NULL THEN
    RAISE EXCEPTION 'CLEANING SEED STOP: bucket N1 limpeza-conservacao não materializou.';
  END IF;

  FOR grain IN
    SELECT * FROM (VALUES
      ('faxina-residencial',      'Faxina residencial'),
      ('passadoria',              'Passadoria'),
      ('limpeza-comercial',       'Limpeza comercial'),
      ('organizacao-residencial', 'Organização residencial')
    ) AS g(slug, name)
  LOOP
    SELECT concept_id INTO v_concept FROM public.concepts
     WHERE domain = 'servicos' AND slug = grain.slug LIMIT 1;
    IF v_concept IS NULL THEN
      RAISE EXCEPTION 'CLEANING SEED STOP: concept servicos/% não materializou (governança?).', grain.slug;
    END IF;

    -- (2a) FACE PUBLICÁVEL: canonical_service GLOBAL ativo (idempotente).
    INSERT INTO public.canonical_services (tenant_id, scope, concept_id, name, slug, status)
    SELECT NULL, 'global', v_concept, grain.name, grain.slug, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.canonical_services WHERE scope = 'global' AND slug = grain.slug
    );

    -- (2b) FACE DECLARÁVEL: folha N2 professional sob limpeza-conservacao (idempotente).
    IF NOT EXISTS (
      SELECT 1 FROM public.categories
        WHERE concept_id = v_concept AND scope = 'professional' AND level = 2
    ) THEN
      INSERT INTO public.categories
        (name, slug, level, path, parent_id, scope, concept_id, status, is_active, metadata)
      VALUES
        (grain.name, grain.slug, 2,
         COALESCE(v_root_path, ARRAY[]::text[]) || ARRAY['profissoes','limpeza-conservacao']::text[],
         v_bucket, 'professional', v_concept, 'active', true,
         jsonb_build_object('seed', 'F-SERVICE-VERTICAL-SEED-CLEANING-SLICE'));
    END IF;

    -- pós-asserção fail-closed por grão: as DUAS faces materializaram.
    PERFORM 1 FROM public.canonical_services
      WHERE scope = 'global' AND slug = grain.slug AND concept_id = v_concept AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CLEANING SEED STOP: canonical_service global % ausente/divergente.', grain.slug;
    END IF;
    PERFORM 1 FROM public.categories
      WHERE concept_id = v_concept AND scope = 'professional' AND level = 2;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CLEANING SEED STOP: folha N2 professional de % não materializou.', grain.slug;
    END IF;
  END LOOP;
END $$;

-- ── (3) ALIASES (lente de busca; INNER JOIN a concepts garante resolução; nunca autoridade).
INSERT INTO public.service_search_aliases
  (alias_term, normalized_term, concept_id, confidence, review_status, is_active, source, catalog_version)
SELECT
  p.alias_term, p.normalized_term, c.concept_id,
  'high', 'approved', true,
  'clayton_curated_cleaning_slice_a_2026_07_01', 'cleaning-v1'
FROM (VALUES
  -- faxina-residencial (8) — diarista/faxineira/faxineiro = profissão → serviço
  ('Faxina',                 'faxina',                 'faxina-residencial'),
  ('Faxineira',              'faxineira',              'faxina-residencial'),
  ('Faxineiro',              'faxineiro',              'faxina-residencial'),
  ('Diarista',               'diarista',               'faxina-residencial'),
  ('Faxina casa',            'faxina-casa',            'faxina-residencial'),
  ('Limpeza casa',           'limpeza-casa',           'faxina-residencial'),
  ('Limpeza apartamento',    'limpeza-apartamento',    'faxina-residencial'),
  ('Limpeza residencial',    'limpeza-residencial',    'faxina-residencial'),
  -- passadoria (4)
  ('Passar roupa',           'passar-roupa',           'passadoria'),
  ('Passadeira',             'passadeira',             'passadoria'),
  ('Passadoria',             'passadoria',             'passadoria'),
  ('Engomar',                'engomar',                'passadoria'),
  -- limpeza-comercial (4)
  ('Limpeza comercial',      'limpeza-comercial',      'limpeza-comercial'),
  ('Limpeza de escritório',  'limpeza-de-escritorio',  'limpeza-comercial'),
  ('Limpeza de loja',        'limpeza-de-loja',        'limpeza-comercial'),
  ('Faxina comercial',       'faxina-comercial',       'limpeza-comercial'),
  -- organizacao-residencial (5)
  ('Organização',            'organizacao',            'organizacao-residencial'),
  ('Organizadora',           'organizadora',           'organizacao-residencial'),
  ('Personal organizer',     'personal-organizer',     'organizacao-residencial'),
  ('Arrumação',              'arrumacao',              'organizacao-residencial'),
  ('Organização de armário', 'organizacao-de-armario', 'organizacao-residencial')
) AS p(alias_term, normalized_term, concept_slug)
INNER JOIN public.concepts c ON c.domain = 'servicos' AND c.slug = p.concept_slug
ON CONFLICT (normalized_term, concept_id) DO NOTHING;

-- ── (4) CONCEPT_LABELS pt-BR/default/primary (apresentação governada — DECISION-0107).
INSERT INTO public.concept_labels (concept_id, locale, context_key, label, short_label, is_primary, source)
SELECT c.concept_id, 'pt-BR', 'default', v.label, v.short_label, true, 'clayton_curated_cleaning_slice_a_2026_07_01'
FROM (VALUES
  ('faxina-residencial',      'Faxina residencial',       'Faxina'),
  ('passadoria',              'Passadoria',               'Passar roupa'),
  ('limpeza-comercial',       'Limpeza comercial',        'Comercial'),
  ('organizacao-residencial', 'Organização residencial',  'Organização')
) AS v(concept_slug, label, short_label)
JOIN public.concepts c ON c.domain = 'servicos' AND c.slug = v.concept_slug
ON CONFLICT (concept_id, locale, context_key) WHERE is_primary = true
DO UPDATE SET label = EXCLUDED.label, short_label = EXCLUDED.short_label,
              source = EXCLUDED.source, updated_at = now();

-- ── PÓS-ASSERÇÃO GLOBAL (fail-closed): as 5 camadas materializaram e nenhum umbrella foi criado.
DO $$
DECLARE
  n_concept  integer;
  n_canon    integer;
  n_bucket   integer;
  n_cat      integer;
  n_alias    integer;
  n_terms    integer;
  n_label    integer;
  n_umbrella integer;
  n_orphan   integer;
BEGIN
  SELECT count(*) INTO n_concept FROM public.concepts
   WHERE domain='servicos' AND slug IN ('faxina-residencial','passadoria','limpeza-comercial','organizacao-residencial');
  IF n_concept <> 4 THEN RAISE EXCEPTION 'CLEANING SEED STOP: esperado 4 concepts, achou %.', n_concept; END IF;

  SELECT count(*) INTO n_canon FROM public.canonical_services
   WHERE scope='global' AND status='active'
     AND slug IN ('faxina-residencial','passadoria','limpeza-comercial','organizacao-residencial');
  IF n_canon <> 4 THEN RAISE EXCEPTION 'CLEANING SEED STOP: esperado 4 canonical_services, achou %.', n_canon; END IF;

  SELECT count(*) INTO n_bucket FROM public.categories
   WHERE slug='limpeza-conservacao' AND scope='professional' AND level=1 AND concept_id IS NULL;
  IF n_bucket <> 1 THEN RAISE EXCEPTION 'CLEANING SEED STOP: bucket N1 limpeza-conservacao (sem concept) ausente (n=%).', n_bucket; END IF;

  SELECT count(*) INTO n_cat FROM public.categories ca
    JOIN public.concepts co ON co.concept_id = ca.concept_id
   WHERE ca.scope='professional' AND ca.level=2
     AND co.slug IN ('faxina-residencial','passadoria','limpeza-comercial','organizacao-residencial');
  IF n_cat <> 4 THEN RAISE EXCEPTION 'CLEANING SEED STOP: esperado 4 categorias N2 concept-bound, achou %.', n_cat; END IF;

  SELECT count(*), count(DISTINCT normalized_term) INTO n_alias, n_terms
    FROM public.service_search_aliases WHERE source='clayton_curated_cleaning_slice_a_2026_07_01';
  IF n_alias <> 21 THEN RAISE EXCEPTION 'CLEANING SEED STOP: esperado 21 aliases, achou %.', n_alias; END IF;
  IF n_terms <> 21 THEN RAISE EXCEPTION 'CLEANING SEED STOP: esperado 21 termos distintos, achou %.', n_terms; END IF;

  -- aliases não podem apontar para fora de servicos (FK+join garantem; defesa extra).
  SELECT count(*) INTO n_orphan FROM public.service_search_aliases a
    JOIN public.concepts c ON c.concept_id = a.concept_id
   WHERE a.source='clayton_curated_cleaning_slice_a_2026_07_01' AND c.domain <> 'servicos';
  IF n_orphan > 0 THEN RAISE EXCEPTION 'CLEANING SEED STOP: % alias fora de domínio servicos.', n_orphan; END IF;

  SELECT count(*) INTO n_label FROM public.concept_labels
   WHERE source='clayton_curated_cleaning_slice_a_2026_07_01' AND locale='pt-BR' AND context_key='default' AND is_primary=true;
  IF n_label <> 4 THEN RAISE EXCEPTION 'CLEANING SEED STOP: esperado 4 labels primárias, achou %.', n_label; END IF;

  -- NENHUM umbrella genérico virou canonical_service.
  SELECT count(*) INTO n_umbrella FROM public.canonical_services
   WHERE scope='global' AND slug IN ('limpeza','servicos-de-limpeza','servicos-domesticos','casa','trabalho-domestico','trabalho');
  IF n_umbrella > 0 THEN RAISE EXCEPTION 'CLEANING SEED STOP: umbrella genérico virou canonical (proibido).'; END IF;
END $$;

COMMIT;
