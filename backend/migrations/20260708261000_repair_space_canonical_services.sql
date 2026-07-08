-- 20260708261000: REPARO — cria os canonical_services dos 12 concepts de espaço (a migration anterior
-- não os criou: o INSERT de canonical_services no MESMO statement da CTE data-modifying não enxergava os
-- concepts recém-inseridos, snapshot do Postgres). Agora os concepts existem; statement separado resolve.
-- Sem isto, os concepts de espaço não aparecem no /concepts (que exige canonical_service ativo). Δbank=0.
BEGIN;
INSERT INTO canonical_services (concept_id, tenant_id, scope, name, slug, status, attributes)
SELECT c.concept_id, NULL, 'global', v.nome, c.slug, 'active', '{}'::jsonb
  FROM (VALUES
    ('sala-de-reuniao', 'Sala de reunião'),
    ('salao-de-festa', 'Salão de festa'),
    ('area-de-churrasco', 'Área de churrasco'),
    ('quadra-esportiva', 'Quadra esportiva'),
    ('estudio', 'Estúdio'),
    ('vaga-de-garagem', 'Vaga de garagem'),
    ('box-de-garagem', 'Box de garagem'),
    ('quiosque', 'Quiosque'),
    ('estande', 'Estande'),
    ('estacao-de-barbeiro', 'Estação de barbeiro'),
    ('estacao-de-cabeleireiro', 'Estação de cabeleireiro'),
    ('box-de-mecanica', 'Box de mecânica')
  ) v(slug, nome)
  JOIN concepts c ON c.slug = v.slug
 WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL);
COMMIT;
