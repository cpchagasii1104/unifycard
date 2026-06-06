-- ============================================================
-- F-SERVICE-TAXONOMY-BRIDGE-SEED-SALON (DECISION-0109 D3 / ratificação Opção A)
-- Seed governado da ponte company_type_service_categories para o piloto SALÃO (5 linhas).
-- ------------------------------------------------------------
-- Liga o company_type `salao` às suas categorias de SERVIÇO (`domain='servicos'`), na subárvore
-- de `servicos-estetica-bem-estar`. NÃO repointa default_*_slugs (produto/marketplace), NÃO toca
-- company_type_allowed_concepts (atuação/concept), NÃO cria categoria nova, NÃO cria serviço/availability.
--
-- FAIL-CLOSED: resolve company_type por slug e categorias por slug; EXIGE que as 5 categorias existam E
-- sejam `domain='servicos'`. Se faltar qualquer uma OU houver domínio errado → RAISE (rollback total,
-- SEM seed parcial). IDEMPOTENTE: ON CONFLICT no par único (uq_ctsc_type_category) + verificação final.
--
-- Mapa salão: servicos-estetica-bem-estar (departamento/raiz, is_department=true) +
--             servicos-cabeleireiro / servicos-barbearia / servicos-manicure / servicos-estetica-facial (ramos).
-- Forward-only / transacional.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_ct        UUID;
  v_expected  INT := 5;
  v_found     INT;
  v_dept      TEXT := 'servicos-estetica-bem-estar';
  v_slugs     TEXT[] := ARRAY[
    'servicos-estetica-bem-estar',
    'servicos-cabeleireiro',
    'servicos-barbearia',
    'servicos-manicure',
    'servicos-estetica-facial'
  ];
BEGIN
  -- 1. company_type salão (por slug — schema vivo: company_types.id / .slug)
  SELECT id INTO v_ct FROM company_types WHERE slug = 'salao' LIMIT 1;
  IF v_ct IS NULL THEN
    RAISE EXCEPTION 'company_type slug=salao não encontrado — seed abortado (fail-closed).';
  END IF;

  -- 2. as 5 categorias precisam existir E ser domain=servicos (senão fail-closed, sem parcial)
  SELECT count(*) INTO v_found
  FROM categories
  WHERE slug = ANY(v_slugs)
    AND metadata->>'domain' = 'servicos';
  IF v_found <> v_expected THEN
    RAISE EXCEPTION 'Esperadas % categorias domain=servicos (%), encontradas % — seed abortado (fail-closed, sem parcial).',
      v_expected, array_to_string(v_slugs, ', '), v_found;
  END IF;

  -- 3. inserir (idempotente): is_department=true só para a raiz; demais=ramo
  INSERT INTO company_type_service_categories (company_type_id, service_category_id, is_department, source)
  SELECT v_ct, c.category_id, (c.slug = v_dept), 'clayton_curated_service_bridge_salon_2026_06_05'
  FROM categories c
  WHERE c.slug = ANY(v_slugs)
    AND c.metadata->>'domain' = 'servicos'
  ON CONFLICT (company_type_id, service_category_id) DO NOTHING;

  -- 4. estado final: exatamente 5 linhas para o salão (1 dept + 4 ramos)
  SELECT count(*) INTO v_found FROM company_type_service_categories WHERE company_type_id = v_ct;
  IF v_found <> v_expected THEN
    RAISE EXCEPTION 'Pós-seed: esperadas % linhas para salao, há % — abortado.', v_expected, v_found;
  END IF;

  SELECT count(*) INTO v_found
  FROM company_type_service_categories
  WHERE company_type_id = v_ct AND is_department = true;
  IF v_found <> 1 THEN
    RAISE EXCEPTION 'Pós-seed: esperado exatamente 1 departamento para salao, há % — abortado.', v_found;
  END IF;
END $$;

COMMIT;
