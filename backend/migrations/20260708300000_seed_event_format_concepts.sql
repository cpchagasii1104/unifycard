-- 20260708300000: SEED governado dos ~23 FORMATOS de evento (F-EVENT-CONCEPT-FIRST-MODEL Fatia 2).
-- Formato = CONCEPT (identidade) + event_format_concepts (aplicabilidade/comportamento). Reúsa o N0
-- existente 'cultura-lazer-e-eventos' (NÃO cria N0/N1/N2 novo). Idempotente. Statements SEPARADOS
-- (não CTE data-modifying) p/ o INSERT de canonical_services enxergar os concepts recém-criados.
-- Tema (futebol/sinuca/...) NÃO entra aqui — é concept livre buscável; formato × tema = composição. Δbank=0.
BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

-- (1) concepts dos formatos (domain = cultura-lazer-e-eventos).
INSERT INTO concepts (concept_id, slug, domain)
SELECT gen_random_uuid(), v.slug, 'cultura-lazer-e-eventos'
  FROM (VALUES
    ('festa'),('celebracao'),('encontro'),('reuniao'),('assembleia'),('mutirao'),
    ('campanha-beneficente'),('show'),('apresentacao'),('workshop'),('palestra'),
    ('treinamento'),('curso'),('feira'),('exposicao'),('campeonato'),('torneio'),
    ('live'),('transmissao'),('entrevista'),('debate'),('lancamento'),('inauguracao')
  ) v(slug)
 WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

-- (2) canonical_service global (rótulo pt-BR) de cada formato.
INSERT INTO canonical_services (concept_id, tenant_id, scope, name, slug, status, attributes)
SELECT c.concept_id, NULL, 'global', v.nome, c.slug, 'active', '{}'::jsonb
  FROM (VALUES
    ('festa','Festa'),('celebracao','Celebração'),('encontro','Encontro'),('reuniao','Reunião'),
    ('assembleia','Assembleia'),('mutirao','Mutirão'),('campanha-beneficente','Campanha beneficente'),
    ('show','Show'),('apresentacao','Apresentação'),('workshop','Workshop'),('palestra','Palestra'),
    ('treinamento','Treinamento'),('curso','Curso'),('feira','Feira'),('exposicao','Exposição'),
    ('campeonato','Campeonato'),('torneio','Torneio'),('live','Live'),('transmissao','Transmissão'),
    ('entrevista','Entrevista'),('debate','Debate'),('lancamento','Lançamento'),('inauguracao','Inauguração')
  ) v(slug, nome)
  JOIN concepts c ON c.slug = v.slug
 WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL);

-- (3) aplicabilidade: marca cada concept como FORMATO de evento (comportamento = defaults da tabela;
-- refino fino de flags por formato = ajuste posterior). sort_order pela ordem canônica de exibição.
INSERT INTO event_format_concepts (concept_id, sort_order)
SELECT c.concept_id, v.ord
  FROM (VALUES
    ('festa',10),('celebracao',20),('encontro',30),('reuniao',40),('assembleia',50),('mutirao',60),
    ('campanha-beneficente',70),('show',80),('apresentacao',90),('workshop',100),('palestra',110),
    ('treinamento',120),('curso',130),('feira',140),('exposicao',150),('campeonato',160),('torneio',170),
    ('live',180),('transmissao',190),('entrevista',200),('debate',210),('lancamento',220),('inauguracao',230)
  ) v(slug, ord)
  JOIN concepts c ON c.slug = v.slug
ON CONFLICT (concept_id) DO NOTHING;

COMMIT;
