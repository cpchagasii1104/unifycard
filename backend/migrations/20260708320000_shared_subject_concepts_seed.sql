-- 20260708320000: F-SHARED-SUBJECT-CONCEPT-SEED (GO Clayton 2026-07-08). Starter set pequeno de ASSUNTOS
-- COMPARTILHADOS (não "temas de evento") — UM concept por assunto, reutilizável por interesse do perfil
-- (actor_interest_concepts.concept_id) E tema de evento (event_theme_links.concept_id) E orquestração/
-- recomendação futura. SSOT = concepts.id (autoridade); canonical_services é só índice/projeção de busca.
-- NÃO duplica: 5 já existiam (corrida/futebol/musica/mutirao/teatro) e são REUSADOS. Reusa N0
-- cultura-lazer-e-eventos (não cria N0/N1/N2/CONTEXT novo). Idempotente. Δbank=0.
BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

-- (1) concepts dos 27 assuntos FALTANTES (domain cultura-lazer-e-eventos). Os 5 existentes NÃO entram aqui.
INSERT INTO concepts (concept_id, slug, domain)
SELECT gen_random_uuid(), v.slug, 'cultura-lazer-e-eventos'
  FROM (VALUES
    ('sinuca'),('video-game'),('kart'),('ciclismo'),('trilha'),('caminhada'),('skate'),
    ('carros-antigos'),('carros'),('motos'),('sertanejo'),('rock'),('pagode'),('samba'),('funk'),
    ('hip-hop'),('stand-up'),('danca'),('churrasco'),('feijoada'),('gastronomia'),('pizza'),
    ('festa-infantil'),('casamento'),('beneficente'),('bairro'),('voluntariado')
  ) v(slug)
 WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

-- (2) canonical_service global (rótulo pt-BR) — p/ TODOS os 32 (inclui os 5 já existentes, que podem não
-- ter canonical_service e por isso não apareceriam na busca de tema). Statement SEPARADO (não CTE).
INSERT INTO canonical_services (concept_id, tenant_id, scope, name, slug, status, attributes)
SELECT c.concept_id, NULL, 'global', v.nome, c.slug, 'active', '{}'::jsonb
  FROM (VALUES
    ('futebol','Futebol'),('sinuca','Sinuca'),('video-game','Video game'),('kart','Kart'),
    ('corrida','Corrida'),('ciclismo','Ciclismo'),('trilha','Trilha'),('caminhada','Caminhada'),
    ('skate','Skate'),('carros-antigos','Carros antigos'),('carros','Carros'),('motos','Motos'),
    ('musica','Música'),('sertanejo','Sertanejo'),('rock','Rock'),('pagode','Pagode'),('samba','Samba'),
    ('funk','Funk'),('hip-hop','Hip-hop'),('teatro','Teatro'),('stand-up','Stand-up'),('danca','Dança'),
    ('churrasco','Churrasco'),('feijoada','Feijoada'),('gastronomia','Gastronomia'),('pizza','Pizza'),
    ('festa-infantil','Festa infantil'),('casamento','Casamento'),('mutirao','Mutirão'),
    ('beneficente','Beneficente'),('bairro','Bairro'),('voluntariado','Voluntariado')
  ) v(slug, nome)
  JOIN concepts c ON c.slug = v.slug
 WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL);

COMMIT;
