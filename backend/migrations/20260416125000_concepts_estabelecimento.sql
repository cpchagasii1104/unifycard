-- ============================================================
-- 20260416125000: concepts estabelecimento + company_type_allowed_concepts
-- Fonte: isto-e-para-voce/PLANO_EXECUCAO_SEED.md (Fase 3)
-- Nota: timestamp 20260416130000 já ocupado por inventory_movements.
-- Nota schema: concepts.domain = FK domains.domain_key (0074). Slugs do plano
-- mantidos; N0 por slug: varejo+farmácia → produtos-e-comercio; salão+restaurante → servicos.
-- ============================================================

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain)
VALUES
  ('varejo-alimentar-integrado', 'produtos-e-comercio'),
  ('varejo-alimentar-especializado-hortifruti', 'produtos-e-comercio'),
  ('varejo-alimentar-especializado-carnes', 'produtos-e-comercio'),
  ('varejo-alimentar-especializado-padaria', 'produtos-e-comercio'),
  ('saude-varejo-farmaceutico', 'produtos-e-comercio'),
  ('servicos-pessoais-beleza', 'servicos'),
  ('alimentacao-servico-preparado', 'servicos')
ON CONFLICT (domain, slug) DO NOTHING;

INSERT INTO company_type_allowed_concepts (company_type_id, concept_id)
SELECT ct.id, c.concept_id
FROM company_types ct
JOIN concepts c ON (
     (ct.slug = 'supermercado' AND c.slug = 'varejo-alimentar-integrado')
  OR (ct.slug = 'hortifruti'   AND c.slug = 'varejo-alimentar-especializado-hortifruti')
  OR (ct.slug = 'acougue'      AND c.slug = 'varejo-alimentar-especializado-carnes')
  OR (ct.slug = 'padaria'      AND c.slug = 'varejo-alimentar-especializado-padaria')
  OR (ct.slug = 'farmacia'     AND c.slug = 'saude-varejo-farmaceutico')
  OR (ct.slug = 'salao'        AND c.slug = 'servicos-pessoais-beleza')
  OR (ct.slug = 'restaurante'  AND c.slug = 'alimentacao-servico-preparado')
)
ON CONFLICT (company_type_id, concept_id) DO NOTHING;

COMMIT;
