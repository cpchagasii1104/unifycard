-- ============================================================
-- 20260629120000: SEED TRIPLO DE BELEZA — concept + canonical_service GLOBAL + folha N2 professional
-- Frente: F-SERVICE-CATALOG-SEED-BEAUTY-SLICE-A
-- Carimbo soberano: Clayton ratifica RATIFY_C_ENRICHED — primeira fatia material =
--   seed triplo/gêmeo de beleza, grãos específicos, SEM umbrella genérico, SEM alias,
--   SEM telemetria, SEM curadoria runtime, SEM dinheiro.
-- ============================================================
-- POR QUE TRIPLO (e não "seed de serviço"):
--   Tornar um serviço publicável E declarável exige TRÊS linhas coordenadas por grão,
--   compartilhando UM concept_id:
--     (1) concepts (domain='servicos')         → coluna semântica (SSOT, Lei 7), nasce 1x;
--     (2) canonical_services (scope='global',   → a FACE PUBLICÁVEL (catálogo governado);
--         status='active', concept_id FK)         sem ela o ServiceCreate não acha o serviço;
--     (3) categories (scope='professional',     → a FACE DECLARÁVEL (folha N2 sob N1 beleza);
--         level=2, parent='beleza-estetica',      sem ela o autocomplete profissional não
--         concept_id FK)                          surfacia o concept e o gate DECISION-0144
--                                                 (SERVICE_ELIGIBILITY_DECLARATION_REQUIRED)
--                                                 nunca deixa a PF declarar a capacidade —
--                                                 o funil de publicação morre no Perfil.
--   Esta é exatamente a doutrina provada pela ponte 20260627120000 (corte-de-cabelo-masculino),
--   aqui aplicada por grão para a vertical de beleza.
--
-- GRÃOS SEMEADOS (6 — claros, sem ambiguidade de granularidade/slug):
--   corte-de-cabelo-feminino · barba · manicure · pedicure · design-de-sobrancelhas · escova
--   Slugs livres em migration-time (verificado: nenhum aparece em backend/migrations; as 28
--   ocupações de beleza-estetica da taxonomia v2.1 NUNCA foram semeadas como categories).
--   Slugs de SERVIÇO (não de ocupação): distintos de cabeleireiro/barbeiro/escovista/etc.
--
-- GRÃOS DELIBERADAMENTE NÃO SEMEADOS (ambiguidade de granularidade — devolvidos como matriz,
--   conforme guarda soberana "não inventar"):
--   · coloracao  — família (coloração total / retoque de raiz / mechas-luzes / tonalizante)
--   · progressiva — família + slug (progressiva / alisamento / selagem / botox capilar)
--   Clayton confirmou que progressiva/coloração são os pontos ambíguos → ficam para decisão.
--
-- O QUE ESTA MIGRATION NÃO FAZ:
--   NÃO toca corte-de-cabelo-masculino (concept/canonical/folha preservados — guard-pré prova).
--   NÃO cria umbrella genérico 'corte-de-cabelo'. NÃO cria alias profissão→serviço.
--   NÃO cria telemetria. NÃO altera DECISION-0144 (apenas passa a EXISTIR mais concepts que
--   satisfazem ambos os lados do gate quando o actor os declarar). NÃO toca dinheiro/oferta/
--   preço/estoque/Bank/checkout. NÃO mexe na máquina de curadoria/RLS/cbo-matcher.
--   base_duration_minutes fica NULL (não inventamos duração operacional; a janela real mora
--   na oferta — durationMinutes do ServiceCreate; canonical só carrega identidade).
--
-- NORMA: Lei 2 (forward-only) · Lei 3 (falha explícita / fail-closed) ·
--        Lei 7 (concept = identidade SSOT; categoria = navegação/declaração que aponta p/ concept).
-- GOVERNANÇA: trigger 0075 exige set_config('app.concept_governance','true') na MESMA transação.
-- IDEMPOTENTE: concepts ON CONFLICT (domain,slug) DO NOTHING; canonical via WHERE NOT EXISTS;
--   folha N2 via guarda (concept_id, scope='professional', level=2). Re-execução = no-op seguro.
-- ============================================================

BEGIN;

-- ── GUARD-PRÉ (fail-closed): a ponte masculino existente NÃO pode ter sido perdida.
DO $$
DECLARE
  v_masc_concept uuid;
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
END $$;

-- ── (1) CONCEPTS (caminho governado — trigger 0075).
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO public.concepts (slug, domain) VALUES
  ('corte-de-cabelo-feminino', 'servicos'),
  ('barba',                    'servicos'),
  ('manicure',                 'servicos'),
  ('pedicure',                 'servicos'),
  ('design-de-sobrancelhas',   'servicos'),
  ('escova',                   'servicos')
ON CONFLICT (domain, slug) DO NOTHING;

-- ── (2) canonical_service GLOBAL/active  +  (3) folha N2 professional, por grão, mesmo concept_id.
DO $$
DECLARE
  v_parent_id    uuid;
  v_parent_path  text[];
  v_parent_level integer;
  v_concept      uuid;
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
      ('corte-de-cabelo-feminino', 'Corte de cabelo feminino'),
      ('barba',                    'Barba'),
      ('manicure',                 'Manicure'),
      ('pedicure',                 'Pedicure'),
      ('design-de-sobrancelhas',   'Design de sobrancelhas'),
      ('escova',                   'Escova')
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
         jsonb_build_object('seed', 'F-SERVICE-CATALOG-SEED-BEAUTY-SLICE-A'));
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

  -- pós-asserção global: nenhum umbrella genérico introduzido por esta migration.
  PERFORM 1 FROM public.canonical_services WHERE scope = 'global' AND slug = 'corte-de-cabelo';
  IF FOUND THEN
    RAISE EXCEPTION 'SEED STOP: umbrella genérico corte-de-cabelo detectado — proibido nesta frente.';
  END IF;
END $$;

COMMIT;
